---
title: vLLM 高吞吐部署：从 vllm serve 到多 LoRA、前缀缓存与投机解码
source_url: https://docs.vllm.ai/en/latest/getting_started/quickstart.html
author: vLLM 项目
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: vLLM 0.29.x（V1 引擎；本文所有参数名均按 2026-09-19 的 vllm-project/vllm main 分支 docs/ 与 vllm/config/*.py 逐条核实）
order: 16
group: 部署与服务化
---
上一篇讲了 vLLM 为什么快（[推理原理](./14-inference-principles)），这一篇把它跑起来并跑到能服务真实业务：安装、离线批量推理、OpenAI 兼容在线服务、Docker 容器化，再加四项真正决定生产吞吐与成本的能力——**自动前缀缓存（APC）**、**投机解码**、**多 LoRA 在线服务**、**结构化输出引导**，最后交代 **V1 引擎现状**：哪些开关已经不用你管，哪些老功能已经被砍。容器化基础（镜像/卷/端口映射）见「Python 进阶与框架」的 Docker 篇。

::: important 本文的版本口径
参数名与默认值以 vLLM **0.29.x（main 分支，2026-09-19 核实）** 为准，官方最新 release tag 为 `v0.29.0`。vLLM 迭代很快，上线前请用 `vllm serve --help` 在你自己的版本上复核（下文会明确标出几个已被删除的旧写法）。
:::

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
vLLM 默认从 Hugging Face 下载模型。想从 ModelScope（魔搭）下载，初始化引擎前设置环境变量 `VLLM_USE_MODELSCOPE=True`——国内网络环境推荐（`export VLLM_USE_MODELSCOPE=True`）。该变量在当前 main 分支的 `vllm/envs.py` 中仍然存在并有效。
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

vLLM 可以部署为实现 OpenAI API 协议的服务器——对使用 OpenAI API 的应用来说可以**无缝替换（drop-in replacement）**。默认监听 `http://localhost:8000`，可用 `--host`/`--port` 指定地址。服务器一次托管一个基座模型（但一个基座可以同时挂多个 LoRA adapter，见"多 LoRA 在线服务"一节），实现 list models、create chat completion、create completion 等端点。

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

Completions 接口（`/v1/completions` 用的是 Completions API 的字段名 `max_tokens`，与 Chat Completions 的 `max_completion_tokens` 不是一回事，别混用）：

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

## 自动前缀缓存（APC）：多轮对话与 RAG 的第一优先级优化

### 它解决什么

自回归解码每生成一个 token 都要读一遍全部历史的 K/V。如果 1000 个用户问同一份 20 页手册的不同问题，或者同一个会话来回聊了 10 轮，那这段公共前缀的 K/V 就被重算了 1000 次、10 次。**APC（Automatic Prefix Caching）** 把已算好的 KV block 缓存下来，新请求只要前缀相同就直接复用，跳过公共段的 prefill 计算。

### 现状：V1 里它默认就是开的

这一点必须说清楚，否则很多人还在写 `--enable-prefix-caching` 试图"开启"它：

- `vllm/config/cache.py` 中 `enable_prefix_caching: bool = True`——**V1 引擎默认启用**，CLI 侧对应 `--enable-prefix-caching`（要关掉用 `--no-enable-prefix-caching`）。
- 哈希算法 `prefix_caching_hash_algo` 默认 `sha256`；CLI 为 `--prefix-caching-hash-algo`，可选 `sha256`（用 Python `pickle` 序列化，跨 Python/vLLM 版本**不保证可复现**）、`sha256_cbor`（用 `cbor2`，可复现、跨语言，官方推荐用于确定性缓存）、`xxhash` 与 `xxhash_cbor`（需可选包 `xxhash`，更快但非密码学安全，多租户场景要权衡碰撞导致的隐私风险）。
- 官方文档明确写了"APC 通常不会降低 vLLM 的性能"，但它**只加速 prefill，不加速 decode**。回答很长、或新请求与已有请求没有公共前缀时，APC 帮不上忙。

### 实现要点：只缓存整块

vLLM 选的是**基于哈希**的方案：每个 KV block 的键由「父块哈希 + 本块 token + extra hashes（LoRA ID、多模态输入哈希、用于多租户隔离的 cache salt）」组成，并且**只缓存完整块**。所以命中率天然受 block size 约束——共享前缀 12 token、block size 16，那就是 0 命中；20 token 才命中 1 块。混合 Mamba 模型另有 `--mamba-cache-mode align`、`--prefix-match-unit`、`--enable-mamba-fine-grained-prefix-cache` 一组参数做块内细粒度命中（见 APC 特性页）。

离线用法（在线服务无需任何改动，默认已开）：

```python
from vllm import LLM, SamplingParams

# 显式写出只是为了演示；V1 默认值就是 True
llm = LLM(
    model="Qwen/Qwen2.5-7B-Instruct",
    enable_prefix_caching=True,
    prefix_caching_hash_algo="sha256",
)
sampling_params = SamplingParams(temperature=0.0, max_tokens=64)

# 同一份长文档前缀，只会被 prefill 一次
doc = open("annual_report.txt").read()
prompts = [f"{doc}\n\n问题：{q}" for q in ["营收多少？", "主要风险？", "员工人数？"]]
outputs = llm.generate(prompts, sampling_params)
```

### 怎么确认它真的生效

看两个计数器（Prometheus 端点，详见[推理服务生产化运维](./17-inference-serving-production)）：

```bash
curl -s http://localhost:8000/metrics | grep -E "vllm:prefix_cache_(queries|hits)"
```

`hits / queries` 就是命中率。想逐 block 观察命中与占用，加 `--kv-cache-metrics`。

::: note 压测时的坑
`vllm bench serve` 重复打同一个服务时，上一轮留在前缀缓存里的 prompt 会被复用，**吞吐会虚高**。官方建议：换 `--seed`（random 数据集的 seed 默认为 `0`）、重启服务，或用 `vllm bench sweep serve`（它在每轮之间重置服务端缓存）。
:::

## 投机解码：低 QPS 下把 TPOT 压下来

### 什么时候该开

投机解码用一个小成本的方式先"猜"若干 token，再由目标模型一次前向并行验证，接受多少算多少。它的收益场景很窄但很实在：**中等偏低 QPS、显存带宽受限（memory-bound）的负载**——也就是用户能感知的逐 token 卡顿（TPOT）比总吞吐更要命的场景。高 QPS 时 GPU 已接近算力饱和，草稿反而增加额外计算，收益会明显缩水。

### 参数形态：只有一个 `--speculative-config`

vLLM 现在把投机解码的所有配置收进一个 JSON 对象（CLI 别名 `-sc`）：

```bash
# 最省事：n-gram 草稿，不需要额外模型
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --speculative-config '{
    "method": "ngram",
    "num_speculative_tokens": 4,
    "prompt_lookup_min": 2,
    "prompt_lookup_max": 5
  }'
```

```bash
# 效果最好：独立草稿模型
vllm serve Qwen/Qwen3-8B \
  --speculative-config '{
    "method": "draft_model",
    "model": "HuggingFaceTB/SmolLM2-135M-Instruct",
    "num_speculative_tokens": 5
  }'
```

Python 侧键名完全一致：`LLM(model=..., speculative_config={...})`。

官方给的方法选型表（定性，实际收益取决于模型族、流量形态、硬件与采样设置）：

| 方法 | 低 QPS（延迟优先） | 高 QPS（吞吐优先） | 备注 |
| --- | --- | --- | --- |
| EAGLE | 收益高 | 中到高 | 通用性最好的模型类方法 |
| MTP（多 token 预测） | 收益高 | 中到高 | 目标模型原生支持 MTP 时首选 |
| Draft model（独立草稿） | 收益高 | 中等 | 需要额外一个草稿模型 |
| Parallel Draft Model（PARD） | 收益高 | 中到高 | 草稿侧延迟低 |
| MLP speculator | 中到高 | 中等 | 需要有兼容的 MLP speculator |
| N-gram | 低到中等 | 中等 | 最轻量，开关即用 |
| Suffix decoding | 低到中等 | 中等 | 无需草稿模型，推测深度动态 |
| Dynamic Speculative Decoding | 收益高 | 高于基线方法 | 适合 QPS 波动大的 RL/在线学习负载 |

常用键（节选自官方 schema 表）：`method`、`model`、`num_speculative_tokens`、`draft_tensor_parallel_size`、`max_model_len`、`parallel_drafting`（仅 EAGLE 与 draft_model）、`rejection_sample_method`（`standard`/`synthetic`/`block`）、`use_heterogeneous_vocab`（跨词表草稿，仅 `draft_model`）。

::: important 三个写错就起不来的点
1. `speculative_config` 里**没有** `tensor_parallel_size`，要给草稿模型设并行度请用 `draft_tensor_parallel_size`。
2. `temperature`、`top_p` 是采样参数，**不是** `--speculative-config` 的字段。
3. `--speculative-config` 在 CLI 上收的是 JSON 字符串；写在 YAML 配置文件里时应直接用嵌套映射，不要写转义后的 JSON 字符串。
:::

兼容性（官方 Known Feature Incompatibility）：`vllm<=0.15.0` 里流水线并行（PP）不能与投机解码组合使用；`vllm<=0.10.0` 不支持 draft model 投机解码。

### 会不会改变输出

官方给了三层答案，值得逐字读：

1. **理论无损**——投机采样在硬件数值精度极限内是 lossless 的。
2. **算法无损**——vLLM 的实现有专门测试验证：rejection sampler 的采样分布对齐目标分布；贪心采样下，开与不开投机解码结果应完全一致。
3. **但 logprobs 不保证稳定**——vLLM 本来就不承诺跨运行稳定输出 logprobs；加上 batch 大小变化带来的数值差异，同一请求不同批次下仍可能出现分歧。

还有一个观测上的坑：**开了投机解码后 ITL 与 TPOT 不再相等**。一次流式输出可能打包多个被接受的 token，`vllm:inter_token_latency_seconds` 只记录输出事件之间的间隔（打包 token 不产生额外的 0 间隔样本），而 `vllm:request_time_per_output_token_seconds` 是按 `(端到端时延 - TTFT) / (输出 token 数 - 1)` 摊销。官方举的例子：观测到两个 40 ms 的 ITL 样本，第二个输出打包了 3 个 token，则 mean ITL = 40 ms，而 TPOT = (180-100)/(5-1) = 20 ms/token。

## 多 LoRA 在线服务：一个基座喂多个业务

### 先把参数名钉对

::: important 更正一个常见误传
vLLM **没有** `--lora-devices` 这个参数（在 `vllm/engine/arg_utils.py` 的 LoRA 参数组里检索 0 命中）。想控制"LoRA 放在哪块卡"，实际手段是 `--tensor-parallel-size` / `--data-parallel-size` 决定实例切分，以及 `--fully-sharded-loras` 决定 LoRA 权重是否随 TP 全分片。控制"同时服务多少个 adapter、占多少显存"的参数则是 `--max-loras`、`--max-lora-rank`、`--max-cpu-loras`。
:::

当前真实存在的 LoRA 相关 CLI 参数（逐一在 `arg_utils.py` 的 `lora_group` 中核对）：

| 参数 | 作用 | 默认 |
| --- | --- | --- |
| `--enable-lora` | 打开 LoRA 支持总开关 | `False` |
| `--lora-modules name=path` | 启动时挂载若干 adapter（可多组） | — |
| `--max-loras` | 单个 batch 内并存的 adapter 上限 | `1` |
| `--max-lora-rank` | 允许的 adapter 最大秩 | `16` |
| `--max-cpu-loras` | 可暂存在 CPU 的 adapter 数上限 | `None` |
| `--fully-sharded-loras` | LoRA 权重随 TP 全分片 | `False` |
| `--lora-dtype` | LoRA 计算 dtype | `auto` |
| `--lora-target-modules` | 限定哪些模块挂 LoRA（按模块后缀，如 `o_proj`） | `None`（全部支持模块） |
| `--default-mm-loras` | 多模态按模态映射默认 LoRA | `None` |
| `--enable-tower-connector-lora` | 允许给多模态 tower/connector 挂 LoRA | `False` |
| `--specialize-active-lora` | 按当前活跃 adapter 特化内核 | `False` |
| `--enable-mixed-moe-lora-format` | 同实例混用 2D/3D MoE adapter | `False` |
| `--enable-moe-shared-loras` | MoE 共享 LoRA | `False` |

### 静态挂载：把 adapter 当成模型名来调用

```bash
vllm serve meta-llama/Llama-3.2-3B-Instruct \
    --enable-lora \
    --max-loras 4 \
    --max-lora-rank 64 \
    --lora-modules \
        sql-lora=jeeejeee/llama32-3b-text2sql-spider \
        legal-lora=your-org/llama32-3b-legal
```

`/v1/models` 会同时列出基座与每个 adapter 的昵称；客户端把昵称当 `model` 传即可，与基座请求并行处理：

```bash
curl http://localhost:8000/v1/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "sql-lora",
        "prompt": "San Francisco is a",
        "max_tokens": 7,
        "temperature": 0
    }'
```

`--lora-modules` 现在还支持 JSON 新格式，好处是能带上基座信息、让模型卡片正确显示血缘：

```bash
--lora-modules '{"name": "sql-lora", "path": "jeeejeee/llama32-3b-text2sql-spider", "base_model_name": "meta-llama/Llama-3.2-3B-Instruct"}'
```

### 动态挂载（dynamic LoRA）

启动时不想预知所有 adapter，可以开运行时更新：

```bash
export VLLM_ALLOW_RUNTIME_LORA_UPDATING=True
vllm serve meta-llama/Llama-3.2-3B-Instruct --enable-lora --max-loras 8 --max-lora-rank 64
```

```bash
# 加载
curl -X POST http://localhost:8000/v1/load_lora_adapter \
  -H "Content-Type: application/json" \
  -d '{"lora_name": "sql_adapter", "lora_path": "/path/to/sql-lora-adapter"}'

# 卸载
curl -X POST http://localhost:8000/v1/unload_lora_adapter \
  -H "Content-Type: application/json" \
  -d '{"lora_name": "sql_adapter"}'
```

`load_lora_adapter` 另有 `load_inplace` 参数：同名替换权重、不打断在跑的推理——异步 RL 里持续换 adapter 的标准做法。不想用 HTTP 端点，也可以写 **LoRAResolver 插件**从本地盘或 S3 按需解析加载（同样要求 `VLLM_ALLOW_RUNTIME_LORA_UPDATING=True`）。

::: warning
官方对动态 LoRA 的态度是明确的警告：该特性带来安全风险，**只应在隔离、完全可信的环境中使用**——`lora_path` 本质上是让服务端去加载任意权重文件。
:::

### 显存账怎么算

`--max-lora-rank` 直接决定预分配的显存大小，官方给的例子很直白：adapter 实际秩为 [16, 32, 64] 时，写 `--max-lora-rank 64`，不要为了省事写 256（白白浪费显存）。同理，只在特定层需要 LoRA 时用 `--lora-target-modules o_proj` 收窄作用面，比"全模块都挂"更快：

```bash
# 只给输出投影层挂 LoRA
vllm serve model --enable-lora --lora-target-modules o_proj
```

## 结构化输出：让模型稳定吐 JSON / 枚举 / 正则

vLLM 用 xgrammar 或 guidance 作为后端做约束解码，OpenAI 兼容服务器上开箱即用。

### 请求侧：字段名已经换过一代

::: important 旧写法已失效
`guided_json` / `guided_regex` / `guided_choice` / `guided_grammar` / `guided_whitespace_pattern` / `guided_decoding_backend` 这批字段**在 v0.12.0 已移除**。现在统一走 `structured_outputs`（离线则用 `StructuredOutputsParams`）：

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="-")
model = client.models.list().data[0].id

completion = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": "Classify this sentiment: vLLM is wonderful!"}],
    extra_body={"structured_outputs": {"choice": ["positive", "negative"]}},
)
print(completion.choices[0].message.content)
```

支持的键：`json`（按 JSON Schema）、`regex`、`choice`、`grammar`（上下文无关文法）、`structural_tag`（在指定标签内套 schema）、`whitespace_pattern`。
:::

服务端配置整体收在 `--structured-outputs-config` 里，后端用 `.backend` 指定，默认 `auto`（按请求细节自动挑）：

```bash
vllm serve Qwen/Qwen2.5-7B-Instruct \
    --structured-outputs-config '{"backend": "xgrammar"}'
```

两个容易踩的细节：

- **正则方言跟后端绑定**：`xgrammar`、`guidance`、`outlines` 用 Rust 风格正则，`lm-format-enforcer` 用 Python 的 `re`。同一份 schema 换后端可能直接不合法。
- **推理模型里默认不约束思考段**。要让结构化输出也作用于 reasoning，显式加 `--structured-outputs-config.enable_in_reasoning=True`。
- V1 已经**移除了"按请求指定后端"**（request-level structured output backend），改为服务端统一配置 + 后端回退（outlines、guidance）。还在给每个请求塞 `guided_decoding_backend` 的代码要清理。

## V1 引擎现状：哪些不用管，哪些已经没了

官方 V1 指南开篇的公告是一句话：**V0 已完全废弃（fully deprecated）**，见 RFC #18571。也就是说"要不要切 V1""怎么退回 V0"这类问题已经不存在了，剩下的都是行为差异与迁移清单。

V1 的重构目标是"模块化、near-zero CPU overhead、**zero config**——能力与优化默认打开"。落到日常运维上的差异：

| 事项 | V1 现状 |
| --- | --- |
| Chunked prefill | 尽可能可用时**默认开启**（V0 里要看模型类型条件开启），所以 `--enable-chunked-prefill` 在新版本里通常是冗余开关 |
| 调度器 | 统一调度器把 prompt token 与 output token 一视同仁，按 `{request_id: num_tokens}` 分配每请求 token 预算，正是这套设计让 chunked prefill / 前缀缓存 / 投机解码可以共存；策略用 `--scheduling-policy` 选（FCFS 或 priority，优先级实现里 FCFS 作为同分裁决） |
| CUDA Graph | V1 的图捕获比 V0 **更吃显存**——显存预算要重估 |
| logprobs 语义 | 默认返回模型原始输出算出的 logprobs（未经 temperature/penalty 后处理）。用 `--logprobs-mode` 调整为 `raw_logprobs`（默认）/`processed_logprobs`/`raw_logits`/`processed_logits` |
| prompt logprobs × 前缀缓存 | 支持，但**不再缓存 logprobs**：需要 prompt logprobs 的请求会忽略前缀缓存、重算整段 prefill。这两者同时用等于放弃加速 |
| 硬件 | NVIDIA / AMD / Intel GPU / TPU / CPU 全绿；昇腾等走插件（vllm-ascend、vllm-spyre、vllm-gaudi、vllm-openvino） |
| 模型 | Decoder-only、Pooling、Mamba、多模态全绿；Encoder-Decoder 只有 Whisper 原生，BART/Florence-2 走官方 bart-plugin |
| Pooling 模型 | 已完全支持，last-pooling 类新增前缀缓存与 chunked prefill |

**已从 V1 移除的能力**（写老代码时最容易撞上）：

- `best_of`：因使用面窄被移除（RFC #13361）。
- **按请求的 logits processors**：改为启动期配置的 **global logits processors**（RFC #17799）。
- **GPU ↔ CPU KV cache swapping**：新架构下处理抢占不再需要换入换出。
- **request-level structured output backend**：改为服务端统一后端 + 回退。
- Mamba 类模型的前缀缓存：V1 指南仍写"暂不支持"，但 APC 特性页已给出 `--mamba-cache-mode align` + `--enable-mamba-fine-grained-prefix-cache` 的混合 Mamba 用法。两处文档口径不完全一致，以你安装版本的启动日志为准。

## 选型与容量规划（编者补充）

**表：Ollama vs vLLM 定位对照**

| 维度 | Ollama | vLLM |
| --- | --- | --- |
| 定位 | 个人本地运行、离线试用 | 生产高吞吐服务 |
| 并发/吞吐 | 低 | 高（连续批处理 + PagedAttention + 统一调度器） |
| API 兼容 | OpenAI 兼容（子集） | OpenAI 兼容 |
| 上手成本 | 一行命令 | 中（需规划显存/并行） |
| 多 adapter 服务 | 弱 | `--lora-modules` + 动态加载 |

与 SGLang、TensorRT-LLM 的横向选型不在这里展开，见《SGLang、TensorRT-LLM 与 vLLM：推理引擎选型对照》。

容量规划要点：

- **显存 = 权重 + KV cache 池**：`--gpu-memory-utilization` 决定引擎可以占用多大比例的显存，**当前默认是 0.92**（`vllm/config/cache.py` 中 `Field(default=0.92, gt=0, le=1)`），剩余部分留给激活值与其他进程。想精确控制 KV 池可以直接给 `--kv-cache-memory-bytes`，它会绕过比例设置。
- **并行策略**：单卡放不下权重用 `--tensor-parallel-size`（`-tp`）按层切；多副本扛流量用 `--data-parallel-size`（`-dp`）复制（V1 下 DP 会自动扩展 API server 与 engine core，见[推理原理](./14-inference-principles)的进程表）；API server 本身也可以用 `--api-server-count` 横向扩。
- **batch 上限**：`--max-num-seqs` 限制并发序列数，`--max-num-batched-tokens` 限制每个 engine step 的 token 预算——这两个是 TTFT 与吞吐之间最主要的旋钮。
- **国内获取模型**：`VLLM_USE_MODELSCOPE=True` 走魔搭，或手动下载后 `vllm serve /path/to/model` 用本地路径。
- **上线前压测**：`vllm bench serve` 测目标 QPS 下的 TTFT/TPOT/ITL 与吞吐；要做正式的容量报告，官方更推荐同属 vLLM 项目的 [GuideLLM](https://github.com/vllm-project/guidellm)（有实时进度与自动报告，数据集与负载形态也更灵活）。

## 常见坑

1. **以为要手动开前缀缓存**。V1 默认开；`--enable-prefix-caching` 的 CLI 默认值是 `None`（三态，用于区分"用户显式指定"与"跟随引擎默认"），不是关闭开关。
2. **共享前缀没对齐 block 边界**。只缓存整块：把可变内容（时间戳、用户名、随机 request id）放在 system prompt 之后是通用做法，反过来放前面会直接打爆缓存。
3. **多轮对话每轮重发全量历史却期望自动命中**。前缀缓存是服务端按 token 哈希命中的，不需要客户端配合，但一旦你改了历史中间的任何 token（比如做了截断/摘要），后续 block 的哈希链就断了。
4. **`--max-lora-rank` 拍脑袋给大值**。它按最大值预分配显存，不是"按需"。
5. **在不可信网络暴露动态 LoRA**。`VLLM_ALLOW_RUNTIME_LORA_UPDATING=True` + `/v1/load_lora_adapter` 等于允许调用方指定服务端加载的权重路径。
6. **压测数字虚高**。同进程反复 `vllm bench serve` 会吃到上一轮的前缀缓存（random 数据集 `--seed` 默认 0），换 seed 或每轮重置缓存。
7. **prompt logprobs 和前缀缓存同时开**，以为两者叠加，实际是前者把后者旁路了。
8. **照抄旧教程的 `guided_json`**——v0.12.0 起已移除，改成 `structured_outputs`；同时 `best_of`、按请求 logits processor、GPU↔CPU KV swapping 都已随 V1 消失。
9. **`--enable-chunked-prefill` 当性能开关**。V1 里它默认开启，真正该调的是 `--max-num-batched-tokens`。

## 小结

- 离线用 `LLM` + `SamplingParams`；在线一条 `vllm serve` 起步，OpenAI SDK 直接可用。
- 生产部署三件套：官方 Docker 镜像、HF 缓存卷、vllm 编译缓存卷；安全加固用非 root 用户（`--user 2000:0` 或 `vllm-openai-nonroot`）。
- **APC 在 V1 默认开启**，收益全在 prefill 阶段：长文档重复问答与多轮对话是两大甜点场景；命中率看 `vllm:prefix_cache_hits/queries`。
- **投机解码**统一走 `--speculative-config` JSON，低 QPS 延迟敏感场景才划算；开了之后 ITL ≠ TPOT。
- **多 LoRA 在线服务**：`--enable-lora` + `--lora-modules`（或 `VLLM_ALLOW_RUNTIME_LORA_UPDATING` 动态加载），旋钮是 `--max-loras`/`--max-lora-rank`/`--max-cpu-loras`；`--lora-devices` 不存在。
- **结构化输出**统一走 `structured_outputs`（`guided_*` 已移除），后端在 `--structured-outputs-config.backend` 里配。
- V0 已完全退场：chunked prefill 默认开、CUDA Graph 更吃显存、`best_of`/按请求 logits processor/KV swapping/按请求结构化后端都已移除。

## 延伸阅读

- 为什么这些优化有效：[推理原理：KV Cache、PagedAttention 与 continuous batching](./14-inference-principles)
- 指标采集、SLO 与成本核算：[推理服务生产化运维](./17-inference-serving-production)
- 多轮对话与 RAG 场景下的前缀缓存打法：[前缀缓存与 KV 复用在多轮对话与 RAG 中的实战](./24-prefix-caching-kv-reuse)
- 引擎横评：[SGLang、TensorRT-LLM 与 vLLM 选型](./22-inference-engine-comparison)
- 微调产物如何变成 adapter 上线：[LoRA 原理](./04-lora-principles)、[LLaMA-Factory 与 Unsloth 微调框架实战对比](./21-llama-factory-vs-unsloth)

---

> **来源**：抓取于 2026-09-19（2026-09-13 首抓，本次按 main 分支重新逐条核对参数名并增补五节）。① 安装、离线推理、在线服务、注意力后端与 Docker 各节译自 [vLLM 官方文档 Quickstart](https://docs.vllm.ai/en/latest/getting_started/quickstart.html) 与 [Using Docker](https://docs.vllm.ai/en/latest/deployment/docker.html)；② "自动前缀缓存"节译自 [Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html) 与 [Prefix Caching 设计文档](https://docs.vllm.ai/en/latest/design/prefix_caching.html)；③ "投机解码"节译自 [Speculative Decoding](https://docs.vllm.ai/en/latest/features/speculative_decoding/) 与 [Benchmark CLI](https://docs.vllm.ai/en/latest/benchmarking/cli.html)；④ "多 LoRA 在线服务"节译自 [LoRA Adapters](https://docs.vllm.ai/en/latest/features/lora.html)；⑤ "结构化输出"节译自 [Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html)；⑥ "V1 引擎现状"节译自 [vLLM V1](https://docs.vllm.ai/en/latest/usage/v1_guide.html)。作者 vLLM 项目，许可 Apache 2.0。参数默认值与存在性另经仓库源码 `vllm/config/cache.py`、`vllm/config/lora.py`、`vllm/engine/arg_utils.py`、`vllm/envs.py` 逐条核对（Apache 2.0），官方最新 release tag 为 `v0.29.0`。"选型与容量规划"与"常见坑"两节为编者补充，已标注；"没有 `--lora-devices`"、"`--gpu-memory-utilization` 默认 0.92"两处为编者对旧版本文表述的更正。
