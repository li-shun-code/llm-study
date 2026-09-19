---
title: vLLM 高吞吐部署：从 vllm serve 到多 LoRA、前缀缓存与投机解码
source_url: https://docs.vllm.ai/en/latest/getting_started/quickstart.html
author: vLLM 项目
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: vLLM 0.29.x（最新 release tag v0.29.0，V1 引擎；参数名与默认值按 2026-09-19 的 vllm-project/vllm main 分支逐条核实，一手路径：docs/features/automatic_prefix_caching.md、docs/features/lora.md、docs/features/structured_outputs.md、docs/features/reasoning_outputs.md、docs/features/speculative_decoding/{README,eagle,n_gram}.md、docs/configuration/optimization.md、docs/configuration/conserving_memory.md、docs/serving/parallelism_scaling.md、docs/benchmarking/cli.md，以及源码 vllm/config/{cache,speculative,vllm}.py、vllm/engine/arg_utils.py）
order: 18
group: 部署与服务化
---
上一篇讲了 vLLM 为什么快（[推理原理](./16-inference-principles)），这一篇把它跑起来并跑到能服务真实业务：安装、离线批量推理、OpenAI 兼容在线服务、Docker 容器化，再加五项真正决定生产吞吐与成本的能力——**自动前缀缓存（APC）**、**投机解码**、**多 LoRA 在线服务**、**结构化输出与推理内容解析**、**并发与显存调优**，最后交代 **V1 引擎现状**：哪些开关已经不用你管，哪些老功能已经被砍。容器化基础（镜像/卷/端口映射）见「Python 进阶与框架」的 Docker 篇。

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

### 什么场景收益最大

官方文档点名的两个"巨大收益（huge performance benefit）"负载，正是生产里最常见的两类：

| 负载形态 | 为什么命中高 | 典型提升来自哪 |
| --- | --- | --- |
| **长文档反复问答**（手册、年报、代码库 RAG） | 同一段长文档被 N 个不同问题复用，文档部分只 prefill 一次 | TTFT 与 prefill 算力同时省；后续请求"只用算问题那几十 token" |
| **多轮会话**（同一 session 聊 10 轮） | 每轮把全部历史重发，历史前缀逐轮累积命中 | 第 k 轮的 prefill 从 O(全历史) 降到 O(新增) |
| **共享 system prompt / few-shot 模板** | 成千上万请求共享同一段固定前缀 | 只要模板排在最前面且逐字节一致，命中率接近常量 |
| 反向例子：输出很长、请求之间无公共前缀 | — | 官方明确 APC **只加速 prefill，不加速 decode**，这类负载基本无收益 |

一条实操结论：**收益大小 ≈ 可复用前缀 token 数 / 总 prompt token 数**，且必须对齐 block 边界（见上）。所以优化顺序永远是"先把可变内容往后挪、把公共内容往前挪"，再谈命中率。

### 怎么确认它真的生效

看两个计数器（Prometheus 端点，详见[推理服务生产化运维](./19-inference-serving-production)）：

```bash
curl -s http://localhost:8000/metrics | grep -E "vllm:prefix_cache_(queries|hits)"
```

`hits / queries` 就是命中率。想逐 block 观察命中与占用，加 `--kv-cache-metrics`。

::: note 别把命中率读成"省了多少 prompt"
官方两处口径措辞并不完全一致：Metrics 设计文档说"每次前缀缓存被查询时，记录查询量与命中量"，日志一节则写明是"最近 1k 次 **kv-cache block** 查询的命中率"。也就是说这是**按块/按查询**计数的比值，而不是"百分之多少的 prompt token 被跳过"。要估算真实收益，用 `命中率 × 可复用前缀长度` 再去对 `prompt_tokens_total` 的增速，别直接拿这个数向业务汇报。
:::

不接 Prometheus 也有最省事的观察口：默认的 `LoggingStatLogger` 每 5 秒打一条 INFO，官方列明其中含五件事——当前 running/waiting 请求数、当前 GPU cache 使用率、近 5 秒 prompt tokens/s、近 5 秒新生成 tokens/s，以及**最近 1k 次 KV block 查询的前缀缓存命中率**：

```bash
# 字段措辞随版本略有变化，用不区分大小写的关键词兜住
docker logs -f <容器名> 2>&1 | grep -Ei "prefix cache hit rate|cache usage|throughput"
```

::: note 压测时的坑
`vllm bench serve` 重复打同一个服务时，先前那次请求留在前缀缓存里的 prompt 会被复用，**吞吐会虚高**。官方建议：换 `--seed`（random 数据集的 seed 默认为 `0`）、重启服务，或用 `vllm bench sweep serve`（它在各轮之间重置服务端缓存）。
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

### ngram / EAGLE / Medusa：三条路线到底差在哪

三者的差别不在"要不要投机"，而在**草稿是谁生成的、要不要额外权重、接受率能到多高**：

| 路线 | 草稿来源 | 要不要额外权重 | vLLM 里的 method 取值 | 适用判断 |
| --- | --- | --- | --- | --- |
| **n-gram** | 在 prompt 与已生成文本里做子串匹配，命中就拿来当草稿 | 不要 | `ngram`（另有 `ngram_gpu`） | 零成本试水首选；输出高度重复/可预测（SQL、模板、翻译、代码补全）时效果好 |
| **EAGLE** | 一个**特征级 draft head**：拿目标模型隐层特征 + 已生成 token，自回归外推若干步 | 要（一个很小的 head/ckpt） | `eagle`、`eagle3`（同族还有 `mtp`、`dflash`、`dspark`） | 官方表里通用性最好的模型类方法，低 QPS 收益高 |
| **Medusa** | 多个**并行解码头**：第 k 个头一次性预测第 t+k 个 token，草稿侧只有一层前向 | 要（LM head + 若干 medusa head） | `medusa` | 与 EAGLE 同属 draft-head 家族、走同一套 draft runner 加载；因为头之间不共享隐状态，接受率通常低于 EAGLE |

::: note Medusa 在 vLLM 里是"能配但没有文档页"的状态
`vllm/config/speculative.py` 的 `SpeculativeMethod` 枚举里确实有 `medusa`，并且：显式写 `"method": "medusa"` 时 vLLM 会给草稿侧注入 `model_type: "medusa"` 以走 `MedusaConfig.from_pretrained`（老格式 checkpoint 如 `FasterDecoding/medusa-*` 的 `config.json` 缺 `model_type`/`vocab_size`，还需要按目标模型词表回填 `vocab_size`/`truncated_vocab_size`）；不写 method 时也会从 `hf_config.model_type == "medusa"` 自动识别。但 `docs/features/speculative_decoding/` 下**没有** medusa 独立页面（只有 eagle / mtp / draft_model / parallel_draft_model / mlp / n_gram / suffix / extract_hidden_states / speculators / dynamic / adaptive_verification / acceptance_metrics），官方选型表里也不列它——官方主推的是 EAGLE 一族。**结论：新项目选 EAGLE/EAGLE-3 或模型原生 MTP；只有已经持有 Medusa head 权重时才用 `medusa`。**
:::

EAGLE 的可复制命令（在线服务同样支持，离线示例更常见，注意草稿侧并行度用 `draft_tensor_parallel_size`）：

```bash
vllm serve meta-llama/Meta-Llama-3-8B-Instruct \
  --tensor-parallel-size 4 \
  --speculative-config '{
    "method": "eagle",
    "model": "yuhuili/EAGLE-LLaMA3-Instruct-8B",
    "draft_tensor_parallel_size": 1,
    "num_speculative_tokens": 2
  }'
```

```bash
# EAGLE-3 + RedHatAI 官方 speculator 集合（草稿侧 TP 与主模型对齐）
vllm serve meta-llama/Meta-Llama-3-8B-Instruct \
  --tensor-parallel-size 2 \
  --speculative-config '{
    "method": "eagle3",
    "model": "RedHatAI/Llama-3.1-8B-Instruct-speculator.eagle3",
    "draft_tensor_parallel_size": 2,
    "num_speculative_tokens": 2
  }'
```

预训练 EAGLE head 的出处：Hugging Face 集合 `RedHatAI/speculator-models` 与 `yuhuili`（搜 eagle）。n-gram 侧只需 `method`/`num_speculative_tokens`/`prompt_lookup_min`/`prompt_lookup_max`，`method` 与 `model` 都不写时 vLLM 会尽力从配置推断方法，但**显式写 `method` 更稳**。

### 什么时候反而变慢

投机解码不是免费的，下面几种情况会**净亏**：

1. **高 QPS / GPU 已接近算力饱和**。官方文档的定位就是"在中低 QPS、memory-bound 负载下降 token 间时延"。批已经打满时，草稿与验证的额外算力会直接挤掉正经请求，吞吐下降、TTFT 变差。
2. **`num_speculative_tokens` 给太大**。接受长度是衰减的：第 k 个草稿 token 被接受的概率递减，猜 8 个往往只中 1–2 个，但验证那一次前向要按 8 个 token 的宽度算。经验做法从 2–4 起扫。
3. **草稿分布和业务不匹配**（尤其 draft model / Medusa head 换领域）。接受率掉下来，开销留下——`vllm:spec_decode_draft_acceptance_rate`、`vllm:spec_decode_num_accepted_tokens` 是唯一可靠的退出判据。
4. **草稿模型挤占 KV 池**。草稿侧权重 + 它的 CUDA graph 都要显存，`gpu_memory_utilization` 不变时 KV block 变少 → 并发上限下降、更容易触发抢占。
5. **依赖 logprobs 一致性或对输出逐字敏感**。投机解码理论/算法上无损（贪心采样下开关结果应一致），但 vLLM 本就不承诺 logprobs 跨运行稳定，batch 形状变化会带来分歧。
6. **想同时上流水线并行**。官方 Known Feature Incompatibility 记录：`vllm<=0.15.0` 里 PP 与投机解码不能组合。

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

## 结构化输出与推理内容解析：让模型稳定吐 JSON，并把"思考"和"答案"分开

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

### 推理模型的"思考段"：`--reasoning-parser` 与思考预算

结构化输出解决"格式对不对"，**推理内容解析解决"哪一段是思考、哪一段是答案"**。思考链模型会把推理写在 `content` 里（或用 `<think>…</think>` 包裹），下游想拿干净 JSON 就必须先把思考剥掉。vLLM 的做法是在服务端装一个 parser，把响应拆成两个字段：

```bash
vllm serve deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B \
    --reasoning-parser deepseek_r1
```

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")
model = client.models.list().data[0].id

resp = client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": "9.11 和 9.8 哪个大？"}],
)
# reasoning = 推理过程；content = 最终结论（OpenAI 兼容响应上的独立字段）
print("reasoning:", resp.choices[0].message.reasoning)
print("content:", resp.choices[0].message.content)
```

三件配套能力，逐条对应官方 Reasoning Outputs 文档：

1. **边界 token 与思考预算**。`--reasoning-parser` 负责抽取，`--reasoning-config` 负责定义 `reasoning_start_str` / `reasoning_end_str`（不给就尝试从 parser 自动推），请求侧的采样参数 `thinking_token_budget` 设**每请求**推理 token 上限：从 `reasoning_start_str` 开始计数，一到预算就强制产出结束 token。`reasoning_end_str` 里可以先塞一句过渡语再跟结束标记，让截断读起来自然。

   ```bash
   vllm serve Qwen/Qwen3-0.6B \
       --reasoning-parser qwen3 \
       --reasoning-config '{"reasoning_start_str": "<think>", "reasoning_end_str": "我不得不直接给出解答了。</think>"}'

   curl http://localhost:8000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model": "Qwen/Qwen3-0.6B",
          "messages": [{"role": "user", "content": "9.11 和 9.8 哪个大？"}],
          "thinking_token_budget": 10}'
   ```

   不写 `thinking_token_budget` 就没有额外的推理上限，只受 `max_tokens` 之类常规约束——**这是长思考模型把延迟和成本打爆的常见原因**，线上建议按业务给一个显式预算。

2. **默认开关与按请求覆盖**。服务端可通过 chat template kwargs 把思考模式设为默认关或默认开（官方 Reasoning Outputs 的 "Server-Level Default Chat Template Kwargs" 一节），请求侧再用 `extra_body={"chat_template_kwargs": {"enable_thinking": False}}` 覆盖（Qwen3 系列）或 `{"chat_template_kwargs": {"thinking": True}}`（Granite 系列）。另有"自动激活"：传 `reasoning_effort` 时，对需要显式开关的模型会自动打开思考。

3. **只隐藏、不生成成本不变**。`include_reasoning=False` 让思考 token 仍被生成（**质量与耗时都不变**），只是不出现在响应里，省的是网络流量；同时 vLLM 会连带抑制逐 token 元数据（logprobs、token id），防止从解码后的 token 文本反推出思考内容。Responses API 侧同名参数 `include_reasoning=False`。想真正省时间要用上面的 `thinking_token_budget`，不是这个。

::: warning 结构化输出 × 思考段
默认情况下结构化输出的约束**不作用于思考段**（否则会把推理也框成 JSON）。要让 schema 覆盖 reasoning，显式加 `--structured-outputs-config.enable_in_reasoning=True`。
:::

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

## 并发与显存调优：`--gpu-memory-utilization`、`--max-num-seqs`、`--max-model-len` 怎么配合

前面四项能力都在"少算点"，这一节是"把卡用满且不炸"。三个旋钮之所以要一起讲，是因为它们**共同决定同一件事：KV 池有多大、每个请求从里面预占多少**。

### 显存的分配顺序

vLLM 启动时按固定顺序切显存，理解这个顺序就知道每个旋钮在动谁的奶酪：

```text
总显存
 └─ × gpu-memory-utilization（默认 0.92）  ← 引擎可占用的总量（per-instance 上限）
     ├─ 模型权重（+ LoRA 预分配槽位、草稿模型权重）
     ├─ 激活峰值 + CUDA Graph 捕获（V1 比 V0 更吃显存）
     └─ 剩下的全部 → KV cache 池（num_gpu_blocks × block_size）
 └─ 未被覆盖的 8%  ← 留给采样、通信、同卡其他进程
```

- `--gpu-memory-utilization`：`vllm/config/cache.py` 里是 `Field(default=0.92, gt=0, le=1)`，官方 docstring 特别强调这是**每实例**限制——"同一张卡上跑两个 vLLM 实例时，每个都设 0.92 会一起 OOM，应该各设 0.5"。同卡混部、或和训练/其他服务共卡时，这是第一个要降的值。
- `--kv-cache-memory-bytes`：直接给 KV 池字节数，**非 None 时会绕过（ignores）比例设置**，比调百分比更可预测，适合"同一份配置在 A100/H100 上都想要一样大的池"。
- `--num-gpu-blocks-override`：直接指定 block 数，官方定位是"覆盖 profiled 值，用于测试抢占"。日常调参别用它掩盖真实的显存问题。
- 想腾显存的三条正道：`--enforce-eager`（放弃 CUDA graph 换显存与启动速度）、收窄 `compilation_config.cudagraph_capture_sizes`（默认会一路捕获到 `max_num_seqs`）、量化权重。

### 三个旋钮各自管什么

| 旋钮 | 管的是 | 调大的直接后果 | 调小的直接后果 |
| --- | --- | --- | --- |
| `--gpu-memory-utilization` | KV **池的总大小**（分母） | 池更大 → 能同时容纳更多/更长请求；抢占更少 | 池更小，省出的显存给激活；设太低会明显掉并发 |
| `--max-num-seqs` | **同时在跑的序列条数**（并发数上限） | 吞吐↑、显存峰值↑、单请求 TPOT 可能变差 | 延迟更稳，但打不满卡 |
| `--max-model-len` | **单请求最坏 KV 占用**（调度按它预留） | 支持更长上下文，但 `Maximum concurrency` 同比例下降 | 省 KV、更快启动，代价是长请求被拒 |

关键关系式（官方 Parallelism and Scaling 文档给的口径）：

```text
可并发上限 ≈ GPU KV cache size（tokens） ÷ max_model_len（tokens）
```

启动日志里能直接读到这两个数：

```text
INFO ... [kv_cache_utils.py:...] GPU KV cache size: 643,232 tokens
INFO ... [kv_cache_utils.py:...] Maximum concurrency for 40,960 tokens per request: 15.70x
```

`Maximum concurrency` 的 tokens-per-request 就取自 `ModelConfig.max_model_len`。官方还提醒：**这两个数低于吞吐要求时，该加卡而不是继续调参**。（编者估算式，用于交叉验证日志：每 token KV 字节 ≈ `2 × n_layer × n_kv_head × head_dim × dtype_size`，GQA 模型务必按 KV head 数而非 query head 数算。）

`--max-num-seqs` 与 `--max-num-batched-tokens` 的默认值是**按显存容量和使用场景自动选的**（`EngineArgs.get_batch_defaults`），没有单一固定值：

| 设备显存 | 场景 | `max_num_batched_tokens` 默认 | `max_num_seqs` 默认 |
| --- | --- | --- | --- |
| < 70 GB（如 4090/A10-24G） | `vllm serve` | 2048 | 256 |
| < 70 GB | 离线 `LLM` | 8192 | 256 |
| ≥ 70 GB 且非 A100（H100/H200） | `vllm serve` | 8192 | 1024 |
| ≥ 70 GB 且非 A100 | 离线 `LLM` | 16384 | 1024 |
| ≥ 160 GB（B200/B300） | 两者 | 16384 | 1024 |

两条容易被忽略的源码规则：① 你没显式给 `--max-num-seqs` 时，它会再被 `min(max_num_seqs, max_num_batched_tokens)` 夹一道；② `--performance-mode throughput`（取值 `balanced`（默认）/ `interactivity` / `throughput`）在你没手动设时把这两个默认值**各翻倍**——`interactivity` 则偏向小批次低时延（更细的 CUDA graph、面向时延的 kernel），`throughput` 面向高并发聚合 tokens/s。先选 mode 再精调，比一上来硬灌数字省事。

`--max-num-batched-tokens` 是 chunked prefill 下 TTFT/ITL 的主要旋钮，官方四条结论：小（如 2048）ITL 更好；大则 TTFT 更好；**追极致吞吐时建议 > 8192**（尤其"小模型 + 大卡"）；若它等于 `max_model_len`，除仍优先 decode 外基本退化成 V0 的默认调度。注意：**关掉 chunked prefill 时 `max_num_batched_tokens` 必须大于 `max_model_len`，否则服务可能在启动阶段直接崩掉**。

### 抢占：显存不够时的真实表现

KV 不够时 vLLM 会抢占请求、事后重算。日志长这样：

```text
WARNING ... scheduler.py:... Sequence group 0 is preempted by PreemptionMode.RECOMPUTE
mode because there is not enough KV cache space. This can affect the end-to-end
performance. Increase gpu_memory_utilization or tensor_parallel_size to provide more
KV cache memory. total_cumulative_preemption_cnt=1
```

V1 的默认抢占模式是 `RECOMPUTE`（不再是 `SWAP`，新架构下重算开销更低）。官方的四条处置，正好对应上面三个旋钮：提高 `gpu_memory_utilization`；降低 `max_num_seqs` 或 `max_num_batched_tokens`；提高 `tensor_parallel_size`（每卡权重更少、KV 更多，但通信开销上升）；提高 `pipeline_parallel_size`（按层切，同样留出显存，但延迟代价更大）。计数可通过 Prometheus 指标观察，或保持 `--disable-log-stats` 不设来让日志累积计数可见。

### 先测吞吐再调参（可复制流程）

顺序很重要：**不测就调 = 猜**。下面这套是"一次只动一个旋钮"的最小闭环。

```bash
MODEL=Qwen/Qwen2.5-7B-Instruct

# 1) 用默认参数起服务，先记录基线（注意 --max-model-len 显式写死，否则继承模型上限）
vllm serve $MODEL --max-model-len 8192 &

# 2) 从日志抄下两个数：GPU KV cache size 与 Maximum concurrency
#    例：643,232 tokens / Maximum concurrency for 8,192 tokens per request: 78.5x

# 3) 扫并发阶梯（"Maximum Throughput" 模式：--request-rate inf + --max-concurrency 限流）
#    官方建议容量规划的探测点取"上报上限"的 80%~90%
#    --ignore-eos 保证输出真的写满 --random-output-len，否则各档并发压不实
for K in 8 16 32 48 64 80; do
  vllm bench serve \
    --backend vllm --model $MODEL --host 127.0.0.1 --port 8000 \
    --dataset-name random --random-input-len 2048 --random-output-len 256 \
    --num-prompts $((K * 20)) --max-concurrency $K --seed $K --ignore-eos \
    --percentile-metrics ttft,tpot,itl,e2el,client_queue_time \
    2>&1 | tee "bench_c${K}.log"
done
```

```bash
# 4) 从每档日志里抽指标，找"SLO 内最大并发"
grep -E "Median TTFT|Median TPOT|Benchmark duration|Request throughput|Output token throughput" bench_c*.log
```

判读与调参决策（每改一项，回到第 3 步复测）：

| 观察到的现象 | 结论 | 先动哪个 |
| --- | --- | --- |
| tokens/s 随并发近似线性上升，还没到 SLO 边界 | 卡没吃满，继续加并发 | 加 `--max-num-seqs`（或 `--performance-mode throughput`） |
| tokens/s 走平、TPOT 明显恶化 | 已到带宽/算力拐点 | **停手**，这就是单实例容量；要更多吞吐去加副本（`-dp`） |
| 日志出现 preemption 警告、`kv_cache_usage_perc` 接近 1 | KV 池不够 | 降 `--max-model-len`（按业务真实分布，别留 8 倍余量）→ 再不够才提 `--gpu-memory-utilization` |
| TTFT 高但 TPOT 正常，`num_requests_waiting` 有积压 | prefill 排队 | 提 `--max-num-batched-tokens`（利好 TTFT），并确认前缀缓存命中是否正常 |
| TTFT 正常但流式"一顿一顿"（ITL 尾部大） | prefill 挤占 decode | 降 `--max-num-batched-tokens`（如 2048），或选 `--performance-mode interactivity` |
| `--max-num-seqs` 提不上去就 OOM | 激活/CUDA graph 峰值超限 | 收窄 `cudagraph_capture_sizes` 或 `--enforce-eager` 验证是不是 graph 占的 |

::: warning 两个让数字骗你的坑
① **每轮换 `--seed`**（或重启服务、或用 `vllm bench sweep serve`），否则前缀缓存复用会让吞吐虚高；② 压测指标测点都在**压测客户端**（含网络与序列化），和服务端 `/metrics` 的数不完全一致——跨工具对比时按"测量点 + 公式"对齐，别按指标名对齐。
:::

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

容量规划要点（旋钮细节与压测流程见上一节）：

- **并行策略**：单卡放不下权重用 `--tensor-parallel-size`（`-tp`）按层切；多副本扛流量用 `--data-parallel-size`（`-dp`）复制（V1 下 DP 会自动扩展 API server 与 engine core，见[推理原理](./16-inference-principles)的进程表）；API server 本身也可以用 `--api-server-count` 横向扩。多机则 TP × PP 组合（TP = 每节点 GPU 数，PP = 节点数）。
- **CPU 别省**：V1 是多进程架构，官方给的底线是 **`2 + N` 个物理核**（1 API server + 1 engine core + 每 GPU 一个 worker；开 hyperthreading 时换算成 vCPU 要翻倍）。开 DP 或多 API server 时为 `A + DP + N + (DP > 1 ? 1 : 0)`。GPU 利用率莫名其妙上不去时，先怀疑 CPU 抢占。
- **国内获取模型**：`VLLM_USE_MODELSCOPE=True` 走魔搭，或手动下载后 `vllm serve /path/to/model` 用本地路径。
- **上线前压测**：`vllm bench serve` 测目标 QPS 下的 TTFT/TPOT/ITL 与吞吐；要做正式的容量报告，官方更推荐同属 vLLM 项目的 [GuideLLM](https://github.com/vllm-project/guidellm)（有实时进度与自动报告，数据集与负载形态也更灵活）。

## 常见坑

1. **以为要手动开前缀缓存**。V1 默认开；`--enable-prefix-caching` 的 CLI 默认值是 `None`（三态，用于区分"用户显式指定"与"跟随引擎默认"），不是关闭开关。
2. **共享前缀没对齐 block 边界**。只缓存整块：把可变内容（时间戳、用户名、随机 request id）放在 system prompt 之后是通用做法，反过来放前面会直接打爆缓存。
3. **多轮对话每轮重发全量历史却期望自动命中**。前缀缓存是服务端按 token 哈希命中的，不需要客户端配合，但一旦你改了历史中间的任何 token（比如做了截断/摘要），后续 block 的哈希链就断了。
4. **`--max-lora-rank` 拍脑袋给大值**。它按最大值预分配显存，不是"按需"。
5. **在不可信网络暴露动态 LoRA**。`VLLM_ALLOW_RUNTIME_LORA_UPDATING=True` + `/v1/load_lora_adapter` 等于允许调用方指定服务端加载的权重路径。
6. **压测数字虚高**。同进程反复 `vllm bench serve` 会吃到前一次请求留下的前缀缓存（random 数据集 `--seed` 默认 0），换 seed 或在各轮之间重置缓存。
7. **prompt logprobs 和前缀缓存同时开**，以为两者叠加，实际是前者把后者旁路了。
8. **照抄旧教程的 `guided_json`**——v0.12.0 起已移除，改成 `structured_outputs`；同时 `best_of`、按请求 logits processor、GPU↔CPU KV swapping 都已随 V1 消失。
9. **`--enable-chunked-prefill` 当性能开关**。V1 里它默认开启，真正该调的是 `--max-num-batched-tokens`。
10. **同一张卡跑多个实例却各设 `--gpu-memory-utilization 0.9`**。它是 per-instance 上限、互相不知情，官方给的对策就是按实例数分摊（两实例各 0.5）。
11. **`--max-model-len` 照抄模型上限**。128k 上下文模型按 128k 预留 KV，`Maximum concurrency = KV tokens ÷ max_model_len` 会直接掉到个位数；按你们业务 prompt 长度的 P99 设，比按模型能力设更省。
12. **只提 `--max-num-seqs` 不看 `--max-num-batched-tokens`**。没显式指定时前者会被 `min(max_num_seqs, max_num_batched_tokens)` 夹住，改大数字却"没生效"通常是这个原因。
13. **关掉 chunked prefill 后 `max_num_batched_tokens < max_model_len`**——官方文档明确这会让服务在启动期崩。
14. **把 `include_reasoning=False` 当省钱开关**。它只是不把思考写进响应，思考 token 照样生成、时延与卡时一分不少；真要限就用 `thinking_token_budget`。
15. **压测不带 `--ignore-eos`、或各档并发不带 `--seed`**。前者让输出提前结束、并发压不实，后者让前缀缓存把数字抬虚。

## 小结

- 离线用 `LLM` + `SamplingParams`；在线一条 `vllm serve` 起步，OpenAI SDK 直接可用。
- 生产部署三件套：官方 Docker 镜像、HF 缓存卷、vllm 编译缓存卷；安全加固用非 root 用户（`--user 2000:0` 或 `vllm-openai-nonroot`）。
- **APC 在 V1 默认开启**，收益全在 prefill 阶段：长文档反复问答、多轮会话、共享 system prompt 是三大甜点场景；命中率看 `vllm:prefix_cache_hits/queries`（比值口径见上文注意框），不接 Prometheus 就看每 5 秒那条 INFO 日志。
- **投机解码**统一走 `--speculative-config` JSON。n-gram 零额外权重、EAGLE 通用性最好、Medusa 能配但官方不再主推；只在低 QPS 延迟敏感场景划算，高 QPS、`num_speculative_tokens` 过大、接受率下滑、草稿挤占 KV 池四种情况会净亏；开了之后 ITL ≠ TPOT。
- **多 LoRA 在线服务**：`--enable-lora` + `--lora-modules`（或 `VLLM_ALLOW_RUNTIME_LORA_UPDATING` 动态加载），旋钮是 `--max-loras`/`--max-lora-rank`/`--max-cpu-loras`；`--lora-devices` 不存在。
- **结构化输出**统一走 `structured_outputs`（`guided_*` 已移除），后端在 `--structured-outputs-config.backend` 里配；思考链模型再叠 `--reasoning-parser` / `--reasoning-config` / `thinking_token_budget`，把 reasoning 与 content 拆开。
- **并发与显存**：`--gpu-memory-utilization`（池子大小，默认 0.92、per-instance）、`--max-num-seqs`（并发条数）、`--max-model-len`（单请求最坏占用）三者共同决定 `Maximum concurrency ≈ KV tokens ÷ max_model_len`；先 `vllm bench serve` 扫并发拿基线，再一次只动一个旋钮。
- V0 已完全退场：chunked prefill 默认开、CUDA Graph 更吃显存、`best_of`/按请求 logits processor/KV swapping/按请求结构化后端都已移除。

## 延伸阅读

- 为什么这些优化有效：[推理原理：KV Cache、PagedAttention 与 continuous batching](./16-inference-principles)
- 指标采集、SLO 与成本核算：[推理服务生产化运维](./19-inference-serving-production)
- 多轮对话与 RAG 场景下的前缀缓存打法（prompt 布局、命中率实测、KV 外置）：[前缀缓存与 KV 复用在多轮对话与 RAG 中的实战](./20-prefix-caching-kv-reuse)
- 引擎横评：《SGLang、TensorRT-LLM 与 vLLM：推理引擎选型对照》
- 微调产物如何变成 adapter 上线：[LoRA 原理](./04-lora-principles)、[LLaMA-Factory 与 Unsloth 微调框架实战对比](./11-llama-factory-vs-unsloth)

---

> **来源**：抓取于 2026-09-19。① 安装/离线推理/在线服务/注意力后端/Docker：[Quickstart](https://docs.vllm.ai/en/latest/getting_started/quickstart.html)、[Using Docker](https://docs.vllm.ai/en/latest/deployment/docker.html)；② 自动前缀缓存：[Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html)、[Prefix Caching 设计文档](https://docs.vllm.ai/en/latest/design/prefix_caching.html)，5 秒日志五项见 [Metrics 设计文档](https://docs.vllm.ai/en/latest/design/metrics.html)；③ 投机解码（n-gram/EAGLE 子页同页）：[Speculative Decoding](https://docs.vllm.ai/en/latest/features/speculative_decoding/)；④ 多 LoRA：[LoRA Adapters](https://docs.vllm.ai/en/latest/features/lora.html)；⑤ 结构化输出与思考段解析：[Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html)、[Reasoning Outputs](https://docs.vllm.ai/en/latest/features/reasoning_outputs.html)；⑥ V1 现状：[vLLM V1](https://docs.vllm.ai/en/latest/usage/v1_guide.html)；⑦ 并发与显存调优：[Optimization and Tuning](https://docs.vllm.ai/en/latest/configuration/optimization.html)、[Conserving Memory](https://docs.vllm.ai/en/latest/configuration/conserving_memory.html)、[Parallelism and Scaling](https://docs.vllm.ai/en/latest/serving/parallelism_scaling.html)、[Benchmark CLI](https://docs.vllm.ai/en/latest/benchmarking/cli.html)。作者 vLLM 项目，许可 Apache 2.0。参数存在性与默认值另按 v0.29.0 对应 main 分支源码核对（一手路径全列于 frontmatter 的 versions）。"选型与容量规划""常见坑"、并发阶梯脚本、每 token KV 估算式与"`--lora-devices` 不存在"为编者整理/更正，非原文内容。