---
title: vLLM 高吞吐部署：从 vllm serve 到 Docker 容器化
source_url: https://docs.vllm.ai/en/latest/getting_started/quickstart.html
author: vLLM 项目
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 14
versions: vLLM（V1 引擎，2026-09 官方文档最新版）
---

> **来源**：本文翻译自 [vLLM 官方文档 Quickstart](https://docs.vllm.ai/en/latest/getting_started/quickstart.html) 与 [Using Docker](https://docs.vllm.ai/en/latest/deployment/docker.html)，作者 vLLM 项目，许可 Apache 2.0。抓取于 2026-09-13。"选型与容量规划"一节为编者补充，已标注。

上一篇讲了 vLLM 为什么快（[推理原理](./12-inference-principles)），这一篇把它跑起来：安装、离线批量推理、OpenAI 兼容在线服务，以及生产环境必备的 Docker 容器化。容器化基础（镜像/卷/端口映射）见模块 3 的 Docker 篇。

## 前提条件

- 操作系统：Linux
- Python：3.10 – 3.13

::: note
vLLM 也可以通过 vLLM-Metal 在 macOS 上使用 Apple Silicon GPU 加速。
:::

## 安装

**NVIDIA CUDA**：直接用 pip 安装即可。推荐用 uv 创建和管理 Python 环境：

```bash
uv venv --python 3.12 --seed
source .venv/bin/activate
uv pip install vllm --torch-backend=auto
```

`--torch-backend=auto` 会让 uv 运行时自动检查已安装的 CUDA 驱动版本、选择匹配的 PyTorch 索引；也可指定具体后端（如 `--torch-backend=cu126`）。更省事的玩法是 `uv run --with vllm vllm --help`——不建环境直接跑。当然 conda 也可以：

```bash
conda create -n myenv python=3.12 -y
conda activate myenv
pip install --upgrade uv
uv pip install vllm --torch-backend=auto
```

vLLM 还支持 AMD ROCm、Intel GPU（XPU 后端）、Google TPU（`vllm-tpu` 包）与华为昇腾 NPU（[vLLM Ascend](https://github.com/vllm-project/vllm-ascend) 社区硬件插件，国内部署 A 结算国产算力时常用），各自安装方式见[安装指南](https://docs.vllm.ai/en/latest/getting_started/installation.html)。

## 离线批量推理

装好后即可对一批提示词批量生成文本。示例脚本从导入两个类开始：

```python
from vllm import LLM, SamplingParams
```

- `LLM` 是使用 vLLM 引擎做离线推理的主类。
- `SamplingParams` 指定采样过程的参数。

定义提示词列表与采样参数（采样温度 0.8、核采样概率 0.95）：

```python
prompts = [
    "Hello, my name is",
    "The president of the United States is",
    "The capital of France is",
    "The future of AI is",
]
sampling_params = SamplingParams(temperature=0.8, top_p=0.95)
```

::: important
默认情况下，如果 HF 模型仓库中带有 `generation_config.json`，vLLM 会采用模型作者推荐的采样参数——多数情况下这就是最佳默认值。若想强制使用 vLLM 自己的默认采样参数，创建 `LLM` 实例时设 `generation_config="vllm"`。
:::

初始化引擎并加载模型：

```python
llm = LLM(model="facebook/opt-125m")
```

::: note
vLLM 默认从 Hugging Face 下载模型。想从 ModelScope（魔搭）下载，初始化引擎前设置环境变量 `VLLM_USE_MODELSCOPE=True`——国内网络环境推荐（编者注：`export VLLM_USE_MODELSCOPE=True`）。
:::

生成输出：

```python
outputs = llm.generate(prompts, sampling_params)

for output in outputs:
    prompt = output.prompt
    generated_text = output.outputs[0].text
    print(f"Prompt: {prompt!r}, Generated text: {generated_text!r}")
```

::: note
`llm.generate` **不会**自动应用模型的 chat template。使用 Instruct/Chat 模型时应手动套模板，或改用 `llm.chat` 方法（接收与 OpenAI `client.chat.completions` 相同格式的消息列表）：

```python
# 使用 chat 接口
outputs = llm.chat(messages_list, sampling_params)
```
:::

## 在线服务

vLLM 可以部署为实现 OpenAI API 协议的服务器——对使用 OpenAI API 的应用来说可以**无缝替换（drop-in replacement）**。默认监听 `http://localhost:8000`，可用 `--host`/`--port` 指定地址。服务器一次服务一个模型，实现 list models、create chat completion、create completion 等端点。

启动 Qwen2.5-1.5B-Instruct 的服务：

```bash
vllm serve Qwen/Qwen2.5-1.5B-Instruct
```

::: important
默认情况下服务器会读取 HF 模型仓库中的 `generation_config.json`，某些采样参数的默认值会被模型作者的推荐值覆盖；要禁用这一行为，启动时传 `--generation-config vllm`。另外可用 `--api-key` 参数或 `VLLM_API_KEY` 环境变量开启请求头 API Key 校验，且可传多个 Key 用于轮换。
:::

以 OpenAI API 的格式查询。列模型：

```bash
curl http://localhost:8000/v1/models
```

Completions 接口：

```bash
curl http://localhost:8000/v1/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "Qwen/Qwen2.5-1.5B-Instruct",
        "prompt": "San Francisco is a",
        "max_tokens": 7,
        "temperature": 0
    }'
```

既然兼容 OpenAI API，也可以用 `openai` Python 包调用：

```python
from openai import OpenAI

# 把 OpenAI 的 key 与 base_url 指向 vLLM 服务
openai_api_key = "EMPTY"
openai_api_base = "http://localhost:8000/v1"
client = OpenAI(
    api_key=openai_api_key,
    base_url=openai_api_base,
)
completion = client.completions.create(
    model="Qwen/Qwen2.5-1.5B-Instruct",
    prompt="San Francisco is a",
)
print("Completion result:", completion)
```

Chat Completions 接口（支持多轮上下文，更适合对话场景）：

```bash
curl http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "Qwen/Qwen2.5-1.5B-Instruct",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Who won the world series in 2020?"}
        ]
    }'
```

## 注意力后端

vLLM 支持多种高性能注意力后端，会根据系统与模型自动选择最优者；也可用 `--attention-backend` 手动指定：

```bash
# 在线服务
vllm serve Qwen/Qwen2.5-1.5B-Instruct --attention-backend FLASH_ATTN

# 离线推理
python script.py --attention-backend FLASHINFER
```

NVIDIA CUDA 上可选 `FLASH_ATTN` 或 `FLASHINFER`；AMD ROCm、Intel XPU 各有对应选项（详见原文档）。

## Docker 容器化部署

### 预构建镜像

vLLM 官方发布预构建镜像（如 `vllm/vllm-openai:latest`，含 CUDA 运行时），免去本地装环境的烦恼——生产部署首选。

### 基本运行

```bash
docker run --rm --gpus all \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    meta-llama/Llama-3.1-8B-Instruct
```

`--gpus all` 把宿主机 GPU 交给容器；挂载 HF 缓存卷可跨容器复用模型权重；`-p 8000:8000` 暴露 OpenAI 兼容 API。

### vLLM Recipes 配置

[vLLM Recipes](https://recipes.vllm.ai/) 可以转换成 `config.yaml` 与 `env.sh`。Docker 运行时把两个文件挂进容器、启动前 source 一下：

```bash
docker run --rm --gpus all \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -v "$PWD/config.yaml:/recipe/config.yaml:ro" \
    -v "$PWD/env.sh:/recipe/env.sh:ro" \
    -p 8000:8000 \
    --ipc=host \
    --entrypoint /bin/bash \
    vllm/vllm-openai:latest \
    -lc 'source /recipe/env.sh && exec vllm serve --config /recipe/config.yaml'
```

### 让编译缓存跨容器生效

挂载 HF 缓存能复用权重，但每个新容器的 `VLLM_CACHE_ROOT`（默认 `~/.cache/vllm`）是空的，`torch.compile` 产物会重新编译。在该路径挂一个命名卷，从第二个容器起即可复用 inductor、Triton、AOT 产物：

```bash
docker run --rm --gpus all \
    -v ~/.cache/huggingface:/root/.cache/huggingface \
    -v vllm-cache:/root/.cache/vllm \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    meta-llama/Llama-3.1-8B-Instruct
```

### 以非 root 用户运行

CUDA 镜像 `vllm/vllm-openai` 为兼容考虑默认以 root 运行，但也内置了 `vllm` 用户（UID 2000，GID 0）：

```bash
docker run --rm --gpus all \
    --user 2000:0 \
    -p 8000:8000 \
    vllm/vllm-openai:latest \
    meta-llama/Llama-3.1-8B-Instruct
```

非 root 容器挂载模型/缓存卷时，应挂到 `/home/vllm` 下的可写路径（例如 `/home/vllm/.cache/huggingface`），并保证挂载目录对 GID 0 可写。要构建默认非 root 的镜像，用可选构建目标 `vllm-openai-nonroot`；它还支持 OpenShift 风格的任意 UID 运行（K8s 中配合 `securityContext: runAsNonRoot: true` 使用）。

### 从源码构建镜像

`docker/Dockerfile` 支持本地构建自定义镜像（如需内置 FlashInfer 等），命令与说明见官方安装指南的 build-from-source 小节。

## 选型与容量规划（编者补充）

**表：Ollama vs vLLM vs SGLang 快速选型**

| 维度 | Ollama | vLLM | SGLang |
| --- | --- | --- | --- |
| 定位 | 个人本地运行 | 生产高吞吐服务 | 生产服务（RadixAttention 前缀复用见长） |
| 并发/吞吐 | 低 | 高（连续批处理 + PagedAttention） | 高 |
| API 兼容 | OpenAI 兼容（子集） | OpenAI 兼容 | OpenAI 兼容 |
| 上手成本 | 一行命令 | 中（需规划显存/并行） | 中 |

容量规划要点：

- **显存 = 权重 + KV cache 池**：vLLM 的 `--gpu-memory-utilization`（默认 0.9）决定让引擎占多大比例的显存，剩余部分留作激活与其他进程。
- **并行策略**：单卡放不下权重用 `--tensor-parallel-size`（TP）按层切；多副本扛流量用 `--data-parallel-size`（DP）复制（V1 下 DP 会自动扩展 API server 与 engine core，见[推理原理](./12-inference-principles)的进程表）。
- **国内获取模型**：`VLLM_USE_MODELSCOPE=True` 走魔搭，或手动下载后 `vllm serve /path/to/model` 本地路径。
- **上线前压测**：用 `vllm bench serve`（仓库自带 benchmark 工具）测目标 QPS 下的 TTFT/TPOT，再定副本数。

## 小结

- 离线推理用 `LLM` + `SamplingParams`；在线服务一条 `vllm serve` 起步，OpenAI SDK 直接可用。
- 生产部署三件套：官方 Docker 镜像、HF 缓存卷、vllm 编译缓存卷；安全加固用非 root 用户。
- 多卡场景按"单卡放不放得下权重"决定 TP/DP；昇腾等国产算力走 vLLM Ascend 插件。
