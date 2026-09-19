---
title: 推理服务生产化运维：Kubernetes、production stack 与负载均衡
source_url: https://docs.vllm.ai/en/latest/deployment/k8s/
author: vLLM 项目（vLLM 官方文档 deployment 章节）
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: vLLM 0.29.x（2026-09-19 按 docs.vllm.ai latest 与仓库 docs/ 目录同源核实）
order: 17
group: 部署与服务化
---
上一篇把 vLLM 跑了起来，这一篇解决"跑在生产里"：Kubernetes 原生部署（探针、共享内存、GPU 调度）、官方 production stack（Helm 一键部署 + 路由器 + 可观测性）、Nginx 负载均衡方案，再加上三块真正的运维功课——**可观测性（该看哪些指标、怎么采）**、**推理成本核算（tokens/s、TTFT/TPOT、单请求成本）**、**负载扩展与故障处置**。前三节完整翻译自 vLLM 官方文档 deployment 章节，后三节基于官方 metrics/benchmark/per-request-metrics 文档与代价模型整理，文末逐节署名。

# 在 Kubernetes 上使用 vLLM（译自官方文档 Using Kubernetes）

在 Kubernetes 上部署 vLLM 是一种可扩展、高效的模型服务方式。本指南带你用原生 Kubernetes 部署 vLLM。内容依次为：CPU 部署、GPU 部署、gRPC 服务、故障排查。

除原生方式外，还可以用以下项目把 vLLM 部署到 Kubernetes（均有官方文档页）：Helm、NVIDIA Dynamo、InftyAI/llmaz、llm-d、KAITO、KServe、Kthena、KubeRay、kubernetes-sigs/lws、meta-llama/llama-stack、substratusai/kubeai、vllm-project/AIBrix、vllm-project/production-stack。

## 使用 CPU 部署

> **注意**：这里使用 CPU 仅为演示与测试，其性能无法与 GPU 相提并论。

首先创建 Kubernetes PVC 与 Secret，用于下载和存储 Hugging Face 模型（PVC 申请 50Gi 存储；Secret 的 `token` 字段存放你的 **Hugging Face 访问令牌**，生成方式见 HF 官方文档）：

```bash
cat <<EOF |kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: vllm-models
spec:
  accessModes:
    - ReadWriteOnce
  volumeMode: Filesystem
  resources:
    requests:
      storage: 50Gi
---
apiVersion: v1
kind: Secret
metadata:
  name: hf-token-secret
type: Opaque
stringData:
  token: "REPLACE_WITH_TOKEN"
EOF
```

接着以 Deployment + Service 的形式启动 vLLM 服务器。注意按处理器架构选择 vLLM 镜像（x86_64 用 `public.ecr.aws/q9t5s3a7/vllm-cpu-release-repo:latest`，arm64 用 `public.ecr.aws/q9t5s3a7/vllm-arm64-cpu-release-repo:latest`）：

```bash
cat <<EOF |kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: vllm
  template:
    metadata:
      labels:
        app.kubernetes.io/name: vllm
    spec:
      containers:
      - name: vllm
        image: $VLLM_IMAGE
        command: ["/bin/sh", "-c"]
        args: [
          "vllm serve meta-llama/Llama-3.2-1B-Instruct"
        ]
        env:
        - name: HF_TOKEN
          valueFrom:
            secretKeyRef:
              name: hf-token-secret
              key: token
        ports:
          - containerPort: 8000
        volumeMounts:
          - name: llama-storage
            mountPath: /root/.cache/huggingface
      volumes:
      - name: llama-storage
        persistentVolumeClaim:
          claimName: vllm-models
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-server
spec:
  selector:
    app.kubernetes.io/name: vllm
  ports:
  - protocol: TCP
    port: 8000
    targetPort: 8000
  type: ClusterIP
EOF
```

通过日志确认 vLLM 服务器启动成功（模型下载可能需要几分钟）：

```bash
kubectl logs -l app.kubernetes.io/name=vllm
...
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

## 使用 GPU 部署

**前置条件**：已有一个带 GPU 的 Kubernetes 集群（GPU 调度参见 Kubernetes 官方文档 Scheduling GPUs）。

**第 1 步：为 vLLM 创建 PVC、Secret 与 Deployment。**

PVC 用于存放模型缓存（可选，也可用 hostPath 等其他存储）；Secret 仅在访问受限模型（gated models）时需要：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mistral-7b
  namespace: default
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: default
  volumeMode: Filesystem
```

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: hf-token-secret
  namespace: default
type: Opaque
stringData:
  token: "REPLACE_WITH_TOKEN"
```

下面以部署 `Mistral-7B-Instruct-v0.3` 为例，分别给出 NVIDIA GPU 与 AMD GPU 两个版本。

**NVIDIA GPU：**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mistral-7b
  namespace: default
  labels:
    app: mistral-7b
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mistral-7b
  template:
    metadata:
      labels:
        app: mistral-7b
    spec:
      volumes:
      - name: cache-volume
        persistentVolumeClaim:
          claimName: mistral-7b
      # vLLM 张量并行推理需要访问宿主机的共享内存。
      - name: shm
        emptyDir:
          medium: Memory
          sizeLimit: "2Gi"
      containers:
      - name: mistral-7b
        image: vllm/vllm-openai:latest
        command: ["/bin/sh", "-c"]
        args: [
          "vllm serve mistralai/Mistral-7B-Instruct-v0.3 --trust-remote-code --enable-chunked-prefill --max-num-batched-tokens 1024"
        ]
        env:
        - name: HF_TOKEN
          valueFrom:
            secretKeyRef:
              name: hf-token-secret
              key: token
        ports:
        - containerPort: 8000
        resources:
          limits:
            cpu: "10"
            memory: 20G
            nvidia.com/gpu: "1"
          requests:
            cpu: "2"
            memory: 6G
            nvidia.com/gpu: "1"
        volumeMounts:
        - mountPath: /root/.cache/huggingface
          name: cache-volume
        - name: shm
          mountPath: /dev/shm
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 5
```

**AMD GPU（如 MI300X 等 ROCm 卡）：**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mistral-7b
  namespace: default
  labels:
    app: mistral-7b
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mistral-7b
  template:
    metadata:
      labels:
        app: mistral-7b
    spec:
      volumes:
      - name: cache-volume
        persistentVolumeClaim:
          claimName: mistral-7b
      # vLLM 张量并行推理需要访问宿主机的共享内存。
      - name: shm
        emptyDir:
          medium: Memory
          sizeLimit: "8Gi"
      hostNetwork: true
      hostIPC: true
      containers:
      - name: mistral-7b
        image: rocm/vllm:rocm6.2_mi300_ubuntu20.04_py3.9_vllm_0.6.4
        securityContext:
          seccompProfile:
            type: Unconfined
          runAsGroup: 44
          capabilities:
            add:
            - SYS_PTRACE
        command: ["/bin/sh", "-c"]
        args: [
          "vllm serve mistralai/Mistral-7B-v0.3 --port 8000 --trust-remote-code --enable-chunked-prefill --max-num-batched-tokens 1024"
        ]
        env:
        - name: HF_TOKEN
          valueFrom:
            secretKeyRef:
              name: hf-token-secret
              key: token
        ports:
        - containerPort: 8000
        resources:
          limits:
            cpu: "10"
            memory: 20G
            amd.com/gpu: "1"
          requests:
            cpu: "6"
            memory: 6G
            amd.com/gpu: "1"
        volumeMounts:
        - name: cache-volume
          mountPath: /root/.cache/huggingface
        - name: shm
          mountPath: /dev/shm
```

完整步骤与示例 YAML 见 ROCm/k8s-device-plugin 仓库的 vllm-serve 示例。

**第 2 步：为 vLLM 创建 Kubernetes Service**（label selector 需与 Deployment 标签匹配；这对前缀缓存 feature 也很有用）：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mistral-7b
  namespace: default
spec:
  ports:
  - name: http-mistral-7b
    port: 80
    protocol: TCP
    targetPort: 8000
  selector:
    app: mistral-7b
  sessionAffinity: None
  type: ClusterIP
```

**第 3 步：部署并测试。**

```bash
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
```

用 curl 测试：

```bash
curl http://mistral-7b.default.svc.cluster.local/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
        "model": "mistralai/Mistral-7B-Instruct-v0.3",
        "prompt": "San Francisco is a",
        "max_tokens": 7,
        "temperature": 0
      }'
```

部署正确时应收到 vLLM 模型的响应。

## 用 gRPC 提供服务

vLLM 可以通过 `--grpc` 标志改用 gRPC 而非 HTTP 提供服务。这需要可选的 gRPC 依赖：`pip install vllm[grpc]`。

使用 `--grpc` 时，服务器暴露标准 **gRPC 健康检查协议**（`grpc.health.v1.Health`），可与 Kubernetes 原生 gRPC 探针集成（Kubernetes 1.24 起可用）。

以 gRPC 部署时，把 `vllm serve` 命令加上 `--grpc`，并把 `httpGet` 探针替换为 `grpc` 探针：

```yaml
containers:
- name: mistral-7b
  image: vllm/vllm-openai:latest
  command: ["/bin/sh", "-c"]
  args: [
    "pip install vllm[grpc] && vllm serve mistralai/Mistral-7B-Instruct-v0.3 --grpc --port 50051 --trust-remote-code"
  ]
  ports:
  - containerPort: 50051
  livenessProbe:
    grpc:
      port: 50051
    initialDelaySeconds: 120
    periodSeconds: 10
  readinessProbe:
    grpc:
      port: 50051
    initialDelaySeconds: 120
    periodSeconds: 5
```

> **注意**：gRPC 健康服务在每次探针时检查引擎状态。引擎不健康或服务器正在关闭时，探针返回 `NOT_SERVING`。

也可以用 `grpcurl` 手动验证健康服务：`grpcurl -plaintext localhost:50051 grpc.health.v1.Health/Check`。

## 故障排查

**启动/就绪探针失败，容器日志出现 "KeyboardInterrupt: terminated"**

如果 startup/readiness 探针的 failureThreshold 相对于服务器启动所需时间太低，Kubernetes 调度器会杀掉容器。两个迹象：

1. 容器日志包含 "KeyboardInterrupt: terminated"；
2. `kubectl get events` 显示 `Container $NAME failed startup probe, will be restarted`。

缓解方法：增大 failureThreshold，给模型服务器更多启动时间。合理的 failureThreshold 可通过从清单中移除探针、实测服务器就绪所需时间来确定。

## 小结

在 Kubernetes 上部署 vLLM 可以高效地扩缩容并借助 GPU 资源管理机器学习模型。按上述步骤应能在你的集群内搭建并测试 vLLM 部署。

# vLLM production stack（译自官方文档 Production stack 一文）

在 Kubernetes 上部署 vLLM 是可扩展、高效的模型服务方式。本指南介绍用 [vLLM production stack](https://github.com/vllm-project/production-stack) 部署 vLLM。它诞生于伯克利与芝加哥大学的合作，是 vLLM 项目旗下正式发布、面向生产优化的代码库，为 LLM 部署提供：

- **与上游 vLLM 兼容**——在不修改 vLLM 代码的前提下对其封装；
- **易用**——通过 Helm chart 简化部署，用 Grafana 面板观测；
- **高性能**——为 LLM 负载优化：多模型支持、模型感知与前缀感知路由（model-aware / prefix-aware routing）、快速 vLLM 引导启动，以及配合 [LMCache](https://github.com/LMCache/LMCache) 的 KV cache 卸载（在 vLLM 中经 `--kv-offloading-backend lmcache` 接入）。

如果你不熟悉 Kubernetes也不用担心：production stack 仓库提供手把手教程与短视频，**4 分钟**即可搭好环境。

## 前置条件

一个带 GPU 的 Kubernetes 环境（官方教程可在裸金属 GPU 机器上装好 Kubernetes）。

## 用 production stack 部署

标准安装使用 Helm chart（GPU 服务器上可用官方 bash 脚本安装 Helm）。在桌面机执行：

```bash
sudo helm repo add vllm https://vllm-project.github.io/production-stack
sudo helm install vllm vllm/vllm-stack -f tutorials/assets/values-01-minimal-example.yaml
```

这会实例化一个名为 `vllm` 的部署，运行一个小模型（Facebook opt-125M）。

**验证安装**：

```bash
sudo kubectl get pods
```

`vllm` 部署的 Pod 应转为 `Running`：

```text
NAME                                           READY   STATUS    RESTARTS   AGE
vllm-deployment-router-859d8fb668-2x2b7        1/1     Running   0          2m38s
vllm-opt125m-deployment-vllm-84dfc9bd7-vb9bs   1/1     Running   0          2m38s
```

> **注意**：容器下载 Docker 镜像与 LLM 权重可能需要一些时间。

**向 stack 发送查询**——先把 `vllm-router-service` 端口转发到本机：

```bash
sudo kubectl port-forward svc/vllm-router-service 30080:80
```

查询 OpenAI 兼容 API 查看可用模型：

```bash
curl -o- http://localhost:30080/v1/models
```

```json
{
  "object": "list",
  "data": [
    {
      "id": "facebook/opt-125m",
      "object": "model",
      "created": 1737428424,
      "owned_by": "vllm",
      "root": null
    }
  ]
}
```

发送真实的补全请求（OpenAI `/completion` 端点）：

```bash
curl -X POST http://localhost:30080/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "facebook/opt-125m",
    "prompt": "Once upon a time,",
    "max_tokens": 10
  }'
```

**卸载**：`sudo helm uninstall vllm`。

## （进阶）配置 production stack

核心配置用 YAML 管理。上面安装使用的示例配置：

```yaml
servingEngineSpec:
  runtimeClassName: ""
  modelSpec:
  - name: "opt125m"
    repository: "vllm/vllm-openai"
    tag: "latest"
    modelURL: "facebook/opt-125m"

    replicaCount: 1

    requestCPU: 6
    requestMemory: "16Gi"
    requestGPU: 1

    pvcStorage: "10Gi"
```

字段含义：

- **`modelSpec`**：`name`（模型昵称）、`repository`（vLLM Docker 仓库）、`tag`（镜像 tag）、`modelURL`（要用的 LLM 模型）；
- **`replicaCount`**：副本数；
- **`requestCPU` / `requestMemory`**：Pod 的 CPU 与内存资源请求；
- **`requestGPU`**：所需 GPU 数；
- **`pvcStorage`**：为模型分配的持久存储。

> **TIP**：production stack 还提供更多特性（如 CPU 卸载与多种路由算法），见官方 tutorials 目录。

# 使用 Nginx 做负载均衡（译自官方文档 Using Nginx 一文）

本文展示如何启动多个 vLLM 服务容器，并让 Nginx 在服务器之间充当负载均衡器。

**构建 Nginx 容器**（假定你刚克隆 vLLM 项目、位于仓库根目录）：

```dockerfile
# Dockerfile.nginx
FROM nginx:latest
RUN rm /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

```bash
export vllm_root=`pwd`
docker build . -f Dockerfile.nginx --tag nginx-lb
```

**创建简单的 Nginx 配置** `nginx_conf/nginx.conf`。可以加任意多的服务器；下例从两个开始。要加更多，向 `upstream backend` 追加 `server vllmN:8000 max_fails=3 fail_timeout=10000s;` 条目即可：

```console
upstream backend {
    least_conn;
    server vllm0:8000 max_fails=3 fail_timeout=10000s;
    server vllm1:8000 max_fails=3 fail_timeout=10000s;
}
server {
    listen 80;
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**构建 vLLM 容器**（走代理时把代理设置经 `--build-arg http_proxy/https_proxy` 传给 docker build）：

```bash
cd $vllm_root
docker build -f docker/Dockerfile . --tag vllm
```

**创建 Docker 网络**：`docker network create vllm_nginx`

**启动 vLLM 容器**。注意：

- 若 HuggingFace 模型缓存在别处，更新下面的 `hf_cache_dir`；
- 若还没有 HF 缓存，先启动 `vllm0` 并等模型下载完、服务器就绪，这样 `vllm1` 可复用刚下载的模型；
- 下例假定 GPU 后端。用 CPU 后端时：去掉 `--gpus device=ID`，并在 docker run 中加 `VLLM_CPU_KVCACHE_SPACE` 与 `VLLM_CPU_OMP_THREADS_BIND` 环境变量；
- 模型名可按需替换。

```console
mkdir -p ~/.cache/huggingface/hub/
hf_cache_dir=~/.cache/huggingface/
docker run \
    -itd \
    --ipc host \
    --network vllm_nginx \
    --gpus device=0 \
    --shm-size=10.24gb \
    -v $hf_cache_dir:/root/.cache/huggingface/ \
    -p 8081:8000 \
    --name vllm0 vllm \
    --model meta-llama/Llama-2-7b-chat-hf
docker run \
    -itd \
    --ipc host \
    --network vllm_nginx \
    --gpus device=1 \
    --shm-size=10.24gb \
    -v $hf_cache_dir:/root/.cache/huggingface/ \
    -p 8082:8000 \
    --name vllm1 vllm \
    --model meta-llama/Llama-2-7b-chat-hf
```

**启动 Nginx**：

```bash
docker run \
    -itd \
    -p 8000:80 \
    --network vllm_nginx \
    -v ./nginx_conf/:/etc/nginx/conf.d/ \
    --name nginx-lb nginx-lb:latest
```

**确认 vLLM 服务器就绪**：

```bash
docker logs vllm0 | grep Uvicorn
docker logs vllm1 | grep Uvicorn
```

两者都应输出：

```console
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

# 可观测性：该看哪些指标、怎么采

跑起来只是第一步；没有指标的服务等于黑盒。vLLM 的可观测性分三层：**引擎指标（Prometheus）**、**逐请求指标（响应体）**、**链路追踪（OpenTelemetry）**。

## 采集链路

引擎侧指标通过 OpenAI 兼容服务器的 `/metrics` 端点以 Prometheus 文本格式暴露，Prometheus 每 1s 左右抓取一次，Grafana 出图：

```bash
curl -s http://localhost:8000/metrics | grep -E "^vllm:" | head -20
```

三个必须知道的机制：

- **`LoggingStatLogger`**：默认每 **5 秒**打一条 `INFO` 日志，内容含当前 running/waiting 请求数、GPU cache 使用率、近 5 秒 prompt tokens/s、近 5 秒生成 tokens/s、以及**最近 1k 次 KV block 查询的前缀缓存命中率**。也就是说即使不接 Prometheus，光看日志也能判断实例是否吃满。用 `--disable-log-stats` 可关掉（关掉后 `--enable-per-request-metrics` 会被拒绝启动）。
- **`PrometheusStatLogger`**：所有指标都带 `model_name` 标签；counter 的 `_total` 后缀由 OpenMetrics 兼容层处理。
- **多进程与 API server 扩缩**：指标在 **API server 进程**里采集，只有 `--api-server-count > 1` 时才启用 prometheus_client 的多进程模式。副作用是 `process_*`、`python_gc_*` 这类内置进程指标在 `--api-server-count > 1` 时**不可用**。
- **指标弃用策略**：某指标在 `X.Y` 版本被标记弃用后，`X.Y+1` 隐藏，可用 `--show-hidden-metrics-for-version=X.Y` 临时找回，`X.Y+2` 彻底删除。升级 vLLM 前先跑一遍这条参数，别等到面板变空白。

## 面板上真正该长期挂着的六个

| 指标 | 类型 | 含义 | 为什么是它 |
| --- | --- | --- | --- |
| `vllm:time_to_first_token_seconds` | Histogram | TTFT | 用户"等到回复开始"的体感，prefill + 排队瓶颈 |
| `vllm:request_time_per_output_token_seconds` | Histogram | 请求级 TPOT | 流式输出的"逐字蹦"速度；定义 `(端到端时延 - TTFT) / (输出 token 数 - 1)`，只生成 ≤1 token 的请求记为 0 |
| `vllm:inter_token_latency_seconds` | Histogram | ITL | 每个流式输出事件之间的墙钟间隔，抓尾部卡顿 |
| `vllm:e2e_request_latency_seconds` | Histogram | 端到端时延 | SLA 直接对齐这个 |
| `vllm:kv_cache_usage_perc` | Gauge | KV block 使用率（0–1） | 接近 1 就要排队/抢占，是扩容最灵敏的先行指标 |
| `vllm:num_requests_running` / `_waiting` / `_swapped` | Gauge | 运行中 / 排队 / 换出 | 判断实例是否饱和，别只看 CPU/GPU util |

再加四个用于定位问题而非报警的：`vllm:prefix_cache_queries`、`vllm:prefix_cache_hits`（命中率必须自己算 ratio，见下）、`vllm:request_queue_time_seconds`、`vllm:request_prefill_time_seconds` / `vllm:request_decode_time_seconds`（区分"排队久"与"算得慢"）、`vllm:request_success_total`（按 `finished_reason` 分 label：`stop` / `length` / `abort`——`length` 占比高说明 `max_tokens` 设小了或在截断，`abort` 高说明客户端超时或上游取消）。

HTTP 层还有 `prometheus_fastapi_instrumentator` 提供的 `http_requests_total{handler,method,status}` 等，用来区分"引擎慢"与"网关/序列化慢"。

**前缀缓存命中率不要写成 gauge 去看**。官方文档给的理由很实在：应该记录 queries 与 hits 两个 counter，让 Prometheus 的时间序列特性去承载"任意区间上的命中率"，例如近 5 分钟：

```promql
rate(vllm:prefix_cache_hits[5m]) / rate(vllm:prefix_cache_queries[5m])
```

**TTFT 的 P95 查询模板**（直方图必须用 `histogram_quantile` + `le` label）：

```promql
histogram_quantile(0.95,
  sum by (le) (rate(vllm:time_to_first_token_seconds_bucket{model_name="$model"}[5m]))
)
```

**实例吞吐（tokens/s）**：

```promql
sum by (model_name) (rate(vllm:generation_tokens_total[1m]))   # 生成侧
sum by (model_name) (rate(vllm:prompt_tokens_total[1m]))        # prefill 侧
```

两条曲线要分开看：prefill 吃算力（输入长），decode 吃显存带宽（输出生成），两者的成本结构和扩容触发条件完全不同。

## 投机解码与 LoRA 的专属指标

- 开了投机解码：`vllm:spec_decode_num_draft_tokens`、`vllm:spec_decode_num_accepted_tokens`、`vllm:spec_decode_draft_acceptance_rate`、`vllm:spec_decode_efficiency`。**接受率掉了就说明草稿模型和业务分布不匹配，收益会变成纯开销**，这是唯一可靠的退出判据。
- 多 LoRA 服务：`vllm:lora_requests_info`（Gauge，值是墙钟时间，每 iteration 更新），label 为 `running_lora_adapters` / `waiting_lora_adapters`（逗号分隔的 per-adapter 计数串）与 `max_lora`。这个把计数塞进字符串的设计官方自己都标注了"值得重访"，做告警时按字符串解析要小心。
- KV cache 驻留：加 `--kv-cache-metrics` + `--kv-cache-metrics-sample`（采样，开销极小）后有 `vllm:kv_block_lifetime_seconds`、`vllm:kv_block_idle_before_evict_seconds`、`vllm:kv_block_reuse_gap_seconds`。把 lifetime 与 idle time 画在一张图上，很容易看出"被钉住的缓存"（长 decode 把 prompt 占着不放）或"根本没人复用却占着显存"的前缀。
- 算力利用率：`--enable-mfu-metrics` 打开 Model FLOPs Utilization 系列，判断是不是真把 GPU 用满了。

## 逐请求指标与链路追踪

聚合指标告诉你"整体变慢了"，但**计费、SLA 归因、单个客户投诉排查**要的是单请求数据：

```bash
vllm serve meta-llama/Llama-3.1-8B-Instruct --enable-per-request-metrics
```

响应体里会多一个 `metrics` 对象：

```json
{
  "usage": {"prompt_tokens": 42, "completion_tokens": 128, "total_tokens": 170},
  "metrics": {
    "time_to_first_token_ms": 85.2,
    "generation_time_ms": 1240.5,
    "queue_time_ms": 12.3,
    "mean_itl_ms": 9.1,
    "tokens_per_second": 103.2
  }
}
```

字段语义（官方表）：`time_to_first_token_ms` 从被调度到首个 token；`generation_time_ms` 是**纯 decode**时间（首 token 到末 token，不含排队与 prefill）；`queue_time_ms` 是调度队列等待；`tokens_per_second` 是"全部生成 token / 从调度到末 token 的区间"，**包含 prefill**，所以它是端到端生成速度而不是纯 decode 速度。三点注意：高并发下开启会引入不可忽略的 CPU 开销，先在业务负载上压一遍；`n > 1` 的请求会抑制（`metrics` 为 `null`）因为时间数据只对应一条序列；流式响应下 metrics 挂在**最后一个 usage chunk** 上，客户端要带 `stream_options: {"include_usage": true}`，或服务端加 `--enable-force-include-usage`。

链路追踪用 OpenTelemetry：`--otlp-traces-endpoint` 指定 collector，`--collect-detailed-traces=all/model/worker` 打开细粒度 span。开了 OTel 后额外暴露 `vllm:model_forward_time_milliseconds`（模型 forward 时长）与 `vllm:model_execute_time_milliseconds`（含跨 worker 同步、CPU-GPU 同步与采样），二者只在 tracing + detailed traces 时存在。官方也提醒：detailed traces 涉及可能昂贵甚至阻塞的操作。指标看趋势、trace 看单请求穿过各组件的路径，两者同属可观测性但互不替代。

# 推理成本核算

自部署的成本结构和 API 供应商完全不同：**你付的是"卡时"，不是"token"**。所以单位成本必须自己算出来，否则没法判断该扩容、该换小模型还是该上缓存。

## 先定三个时间常数

| 量 | 定义 | 从哪拿 |
| --- | --- | --- |
| TTFT | 请求发出 → 收到第一个流式输出 | `vllm:time_to_first_token_seconds`（服务端）或 `vllm bench serve`（客户端视角） |
| TPOT | `(端到端时延 − TTFT) / (输出 token 数 − 1)`，逐请求算完再聚合 | `vllm:request_time_per_output_token_seconds`；注意别拿 ITL 冒充它——投机解码下一个输出事件可能打包多个 token，两条曲线会明显分叉 |
| 单实例吞吐 | tokens/s（生成侧与 prefill 侧分开统计） | `rate(vllm:generation_tokens_total[1m])`、日志里近 5 秒的 tokens/s |

`vllm bench serve` 的输出就是按这三类分组给的（`Mean/Median/P99 TTFT`、`Mean/Median/P99 TPOT`、`Mean/Median/P99 ITL`），并且明确说明它的度量点都在**压测客户端**。跨工具对比时官方也提醒：指标命名没有统一标准，**用"测量点 + 公式"对齐，而不是指标名**。

## 单请求成本公式

先求出实例在 SLO 内的"有效产能"，再摊到请求上：

```text
① 卡时单价        = GPU 每小时租金（含存储/网络分摊）
② 实例产出 token  = 生成侧吞吐(tokens/s) × 3600          # 单位：token/小时
③ 每 token 成本   = ① / ②                                 # 单位：元/token
④ 单请求成本      = prompt_tokens × prefill 单价
                  + completion_tokens × decode 单价
```

关键是**④ 里 prefill 与 decode 的单价不能混用**。工程上更稳的做法是分别测两组：固定输入长度扫输出、固定输出长度扫输入，从 `prompt_tokens_total` 与 `generation_tokens_total` 的增量反推各自耗时，因为 prefill 是算力瓶颈（近似与输入长度线性/超线性相关），decode 是带宽瓶颈（近似与输出长度线性、与并发强相关）。

一个可直接照抄的算法骨架（数据来自 `/metrics` 或 per-request metrics）：

```python
# 单位：元。GPU 小时单价、实例在 SLO 内的平均吞吐、平均 token 数
GPU_HOURLY_COST = 6.80          # 例：单卡 80GB 卡按小时计费
DECODE_TPS = 1450.0             # 该实例在目标并发下的生成侧吞吐（实测）
TTFT_SLO_P95 = 0.4              # SLO 内可接受的 P95 首 token 时延

def cost_per_request(prompt_tokens: int, completion_tokens: int,
                     prefill_tokens_per_s: float = 12000.0) -> float:
    """prefill 与 decode 分开计价：两者瓶颈不同，混算会系统性低估长输入成本。"""
    prefill_cost = prompt_tokens / prefill_tokens_per_s / 3600.0 * GPU_HOURLY_COST
    decode_cost = completion_tokens / DECODE_TPS / 3600.0 * GPU_HOURLY_COST
    return prefill_cost + decode_cost

# 2k 输入 + 512 输出
print(round(cost_per_request(2048, 512) * 100, 3), "分/请求")
```

三个必须一起报的衍生指标：

1. **每请求 GPU 占用秒数** = 排队时间 + prefill 时间 + decode 时间（`request_queue_time_seconds` + `request_prefill_time_seconds` + `request_decode_time_seconds`），比"耗时"更能反映你实际烧掉了多少卡时。
2. **空闲率**：`vllm:num_requests_running` 长期低于 `--max-num-seqs` 说明按峰值买卡了，应该考虑降副本数、上动态扩缩或混部多模型。
3. **命中率的价值**：一次前缀缓存命中省下的是一段 prefill。用 `rate(vllm:prefix_cache_hits[5m]) × 平均命中 token 数 / prefill_tokens_per_s` 换算成"每秒省下的 GPU 时间"，再乘卡时单价——这是决定"要不要为多轮对话/RAG 专门做前缀对齐"的直接依据。

## 用 SLO 反推该买几张卡

```text
所需副本数 N = ceil( 峰值请求数/秒 × 平均输出 token 数 / 单实例生成侧吞吐 )
             并且要满足：在该并发下，P95 TTFT ≤ SLO 且 P95 TPOT ≤ SLO
```

两个约束经常给出不同的 N，取更大的那个。判据别看 CPU/GPU 利用率，看 **`vllm:kv_cache_usage_perc` 与 `num_requests_waiting`**：KV 池接近满 → 新请求只能排队或触发抢占，TTFT 会先崩、TPOT 后崩。这也是官方文档里对"饱和点"的定义方向的落地版：**用能观测到的队列与缓存占用近似那个拐点**。

# 负载扩展与故障处置

## 扩展的四个层级，按顺序用

1. **单实例内**：先调 `--max-num-seqs`（并发序列上限）与 `--max-num-batched-tokens`（每 step token 预算）。这层免费，不动拓扑。
2. **权重放不进单卡** → `--tensor-parallel-size`（`-tp`）按层切，需要 `/dev/shm`（K8s 里那个 `emptyDir: {medium: Memory}` 就是这个用途，NVIDIA 示例给 2Gi、AMD ROCm 示例给 8Gi）。TP 数越大通信开销越大，优先在同机 NVLink 域内。
3. **单卡放得下但扛不住流量** → 多副本 + 水平扩展，走 `--data-parallel-size`（`-dp`），V1 下 DP 会自动扩展 API server 与 engine core；API server 单独不够时再加 `--api-server-count`。
4. **网关/路由层**：Nginx（上文第三节）是简单做法，但**默认轮询对 LLM 是错的**——请求长度差异极大，`least_conn` 只是及格线。production stack 的路由器提供 **model-aware / prefix-aware routing**，把同前缀的请求送到同一实例，这正是让 APC 在多副本下仍然命中的关键；官方 K8s 文档里那句"Service 的 label selector 要与 Deployment 标签匹配——这对前缀缓存 feature 也很有用"就是这个意思。KV 还想进一步外置时，用 LMCache 做卸载（vLLM 侧经 `--kv-offloading-backend lmcache` 接入）。

扩缩容指标选择上，官方文档的态度很坦诚：LLM 服务的自动扩缩"是个不平凡的话题"，Kubernetes Serving WG 的 `Inference Perf` 提案与 vLLM 的 issue #5041 / PR #12726 都还在推进；核心难点是"什么信号能代表实例接近饱和"。因此现阶段**不要**用 GPU util 做 HPA 目标，用 `vllm:num_requests_waiting > 0 持续 N 秒` 或 `vllm:kv_cache_usage_perc > 0.9` 这类直接反映队列积压的信号，并保留 `vllm:time_to_first_token_seconds` 的 P95 作为回滚触发器。

## 故障处置手册

| 症状 | 先看什么 | 常见原因与处置 |
| --- | --- | --- |
| 探针失败、日志出现 `KeyboardInterrupt: terminated` | `kubectl get events` 是否有 `failed startup probe, will be restarted` | 模型下载/编译比 `failureThreshold × periodSeconds` 长。做法是**先摘掉探针实测就绪耗时**，再据此设 `initialDelaySeconds`/`failureThreshold`（官方给的排查路径就是这个）。长启动镜像建议预拉 + 挂 HF 缓存卷 |
| TTFT 崩、TPOT 尚可 | `num_requests_waiting`、`request_queue_time_seconds`、`kv_cache_usage_perc` | 排队瓶颈：prefill 太大或 KV 池不够。降 `--max-num-batched-tokens` 之外的 chunked prefill 干扰、限长输入、扩副本 |
| TPOT 崩、TTFT 尚可 | `request_decode_time_seconds`、`inter_token_latency_seconds` 尾部 | decode 带宽饱和：降并发（`--max-num-seqs`）、检查是否被长 decode 钉住（`kv_block_idle_before_evict_seconds`）、考虑投机解码（仅在低 QPS） |
| 吞吐忽然翻倍又掉回 | `prefix_cache_hits/queries` | 前缀缓存命中/被驱逐。看是不是流量打散了前缀，或副本数变化导致同前缀请求落到不同实例 |
| 结果偶发不一致、logprob 抖动 | — | 官方明确 vLLM 不保证 logprobs 跨运行稳定；batch 形状变化与浮点精度都会影响。需要可复现时读 FAQ"Can the output of a prompt vary across runs"，或按 `--seed`/固定并发压测 |
| 内存/OOM 且随上下文增长 | `vllm:cache_config_info`、`process_resident_memory_bytes` | V1 的 CUDA Graph 捕获比 V0 更吃显存；降 `--gpu-memory-utilization` 或 `--max-model-len`，必要时 `--num-gpu-blocks-override` |
| 多模态/长上下文单请求打爆实例 | `request_prompt_tokens` 直方图 | 在网关层做输入长度准入控制；`abort` 计数高说明客户端超时，把上游超时与 `max_tokens` 一起收敛 |

## 上线前的三件事

1. **一份带真实流量的基线**：`vllm bench serve` 或 GuideLLM 扫并发阶梯，记录每档的 P95 TTFT / P95 TPOT / tokens/s，取满足 SLO 的最大并发作为单实例容量；**每轮之间重置服务端缓存**（换 `--seed` 或用 `vllm bench sweep serve`），否则前缀缓存会让数字虚高。
2. **一张固定面板 + 三条告警**：TTFT P95、TPOT P95、`kv_cache_usage_perc`（或 `num_requests_waiting`）。
3. **一次主动的 kill pod 演练**：确认路由层会做健康摘除、客户端能重试，并且新副本起来后探针不会把启动中的实例提前判死。

## 小结

- Kubernetes 上部署 vLLM 能高效扩缩容并利用 GPU 资源；把探针（含 gRPC 探针）、`/dev/shm`、模型缓存卷这三件事做对，比调十个参数更重要。
- production stack 用 Helm 一次拉起 vLLM + 路由器 + Grafana 观测；prefix-aware 路由是多副本下保住前缀缓存命中率的机制。
- Nginx 能做最简单的负载均衡，但 `least_conn` 对长度差异极大的 LLM 流量只是及格线。
- 可观测性盯六个指标即可覆盖 90% 决策：TTFT、TPOT、ITL、E2E、`kv_cache_usage_perc`、running/waiting；投机解码额外盯接受率；命中率自己用 PromQL 算 ratio。
- 成本核算的关键是**卡时→token 单价**的换算，且 prefill 与 decode 分开定价；扩容量用队列与 KV 占用判，不用 GPU util 判。

---

> **来源**：抓取于 2026-09-19（2026-09-13 首抓，本次按 main 分支核实参数名并新增可观测性、成本核算、负载扩展三节）。① 第一节译自 [Using Kubernetes](https://docs.vllm.ai/en/latest/deployment/k8s/)（原文 MkDocs 折叠框已展开为正文，目录、生态替代方案列表、CPU/GPU/gRPC/排查各节为完整翻译）；② 第二节译自 [Production stack](https://docs.vllm.ai/en/latest/deployment/integrations/production-stack/)（完整翻译；两个 curl 输出 JSON 为原文保留）；③ 第三节译自 [Using Nginx](https://docs.vllm.ai/en/latest/deployment/nginx/)（完整翻译）；④ "可观测性"一节整理自 [Production Metrics](https://docs.vllm.ai/en/latest/usage/metrics.html)、[Metrics 设计文档](https://docs.vllm.ai/en/latest/design/metrics.html) 与 [Per-Request Metrics](https://docs.vllm.ai/en/latest/features/per_request_metrics.html)（含指标全名、`LoggingStatLogger` 5 秒日志、`--kv-cache-metrics`、`--enable-mfu-metrics`、`--show-hidden-metrics-for-version`、OTel 的 `--otlp-traces-endpoint`/`--collect-detailed-traces`）；⑤ "推理成本核算"与"负载扩展与故障处置"两节整理自 [Benchmark CLI](https://docs.vllm.ai/en/latest/benchmarking/cli.html)（TTFT/ITL/TPOT 定义与测量点）、上述 metrics 文档，以及各节内已标注的编者推算。作者 vLLM 项目，许可 Apache 2.0。PromQL 查询模板、`cost_per_request` 代码与容量反推公式、故障处置表为编者整理，非原文内容；参数存在性另经仓库 `vllm/engine/arg_utils.py`、`vllm/config/cache.py` 核对。导语与本行之前除标注"编者"处外为原文翻译，仅术语首现标注英文。
