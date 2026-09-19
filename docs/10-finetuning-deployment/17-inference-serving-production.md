---
title: 推理服务生产化运维：Kubernetes、production stack 与负载均衡
source_url: https://docs.vllm.ai/en/latest/deployment/k8s/
author: vLLM 项目（vLLM 官方文档 deployment 章节）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: vLLM 官方文档 latest（2026-09，docs.vllm.ai 与仓库 docs/ 目录同源）
order: 17
group: 部署与服务化
---
上一篇把 vLLM 跑了起来，这一篇解决"跑在生产里"：Kubernetes 原生部署（探针、共享内存、GPU 调度）、官方 production stack（Helm 一键部署 + 路由器 + 可观测性），以及 Nginx 负载均衡方案。三节均完整翻译自 vLLM 官方文档 deployment 章节，文末逐节署名。

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

---

> **来源**：抓取于 2026-09-13。三节均完整翻译自 vLLM 官方文档（docs.vllm.ai 与 GitHub 仓库 vllm-project/vllm 的 docs/ 目录同源，作者 vLLM 项目，许可 Apache 2.0）：① 第一节译自 [Using Kubernetes](https://docs.vllm.ai/en/latest/deployment/k8s/)（原文 MkDocs 折叠框已展开为正文，目录、生态替代方案列表、CPU/GPU/gRPC/排查各节为完整翻译）；② 第二节译自 [Production stack](https://docs.vllm.ai/en/latest/deployment/integrations/production-stack/)（完整翻译；两个 curl 输出 JSON 为原文保留）；③ 第三节译自 [Using Nginx](https://docs.vllm.ai/en/latest/deployment/nginx/)（完整翻译）。导语与本行之前无编者改写，仅术语首现标注英文。
