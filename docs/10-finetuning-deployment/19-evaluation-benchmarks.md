---
title: LLM 评测方法与基准：lm-evaluation-harness README 完整指南
source_url: https://github.com/EleutherAI/lm-evaluation-harness
author: EleutherAI（lm-evaluation-harness 官方 README）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: lm-eval 主分支（2026-09 当前版，含 Plugins 与 CLI 子命令重构）
order: 19
---

本篇为重做版：正文主体完整翻译 lm-evaluation-harness 官方 README（替换原先的编者总结内容）。lm-eval 是开源 LLM 评测的事实标准——Hugging Face Open LLM Leaderboard 的后端、数百篇论文的评测工具。

# Language Model Evaluation Harness（译自官方 README）

## 最新动态 📣

- [2026/09] **插件机制**：模型后端、过滤器、指标与聚合器现在可以从你自己的包注册，无需 fork 仓库——声明一个 `lm_eval.*` entry point 即可零配置发现，或用 `--plugins` 指向本地模块。见 Plugin Guide；
- [2025/12] **CLI 重构**：引入子命令（`run`、`ls`、`validate`），并经 `--config` 支持 YAML 配置文件。见 CLI Reference 与 Configuration Guide；
- [2025/12] **更轻的安装**：基础包不再包含 `transformers`/`torch`，按需安装模型后端：`pip install lm_eval[hf]`、`lm_eval[vllm]` 等；
- [2025/07] `hf`（token/字符串）、`vllm` 与 `sglang`（字符串）后端新增 `think_end_token` 参数，可为支持的模型剥离 CoT 推理痕迹；
- [2025/03] 支持对 HF 模型应用转向向量（steering）；
- [2025/02] 支持 SGLang；
- [2024/09] 原型支持文本+图像多模态输入、文本输出任务（`hf-multimodal`、`vllm-vlm` 模型类型与 `mmmu` 任务）；更全面的多模态评测推荐 [lmms-eval](https://github.com/EvolvingLMMs-Lab/lmms-eval)（自本仓库 fork 的优秀项目）；
- [2024/07] API 模型支持更新重构：支持批量与异步请求；**运行 Llama 405B 建议用 vLLM 的 OpenAI 兼容 API 托管、以 `local-completions` 模型类型评测**；新增 Open LLM Leaderboard 任务组。

## 公告

v0.4.0 版本发布，主要更新：新增 Open LLM Leaderboard 任务组；内部重构；基于配置的任务创建；更方便地导入/共享外部任务配置 YAML；支持 Jinja2 提示词设计与从 Promptsource 导入提示；更高级的配置选项（输出后处理、答案抽取、每文档多次生成、可配置 few-shot 等）；提速与新建模库支持（数据并行 HF、vLLM、MPS 等）；日志与易用性改进；新任务（CoT BIG-Bench-Hard、Belebele、自定义任务分组等）。

开发在 `main` 分支持续进行，欢迎在 GitHub issues/PR 或 [EleutherAI discord](https://discord.gg/eleutherai) 反馈。

## 概述（Overview）

本项目提供统一框架，在大量不同的评测任务上测试生成式语言模型。

**特性：**

- 60 多个 LLM 标准学术基准，含数百个子任务与变体实现；
- 支持经 [transformers](https://github.com/huggingface/transformers/) 加载的模型（含 [GPTQModel](https://github.com/ModelCloud/GPTQModel) 与 [AutoGPTQ](https://github.com/PanQiWei/AutoGPTQ) 量化）、[GPT-NeoX](https://github.com/EleutherAI/gpt-neox)、[Megatron-DeepSpeed](https://github.com/microsoft/Megatron-DeepSpeed/)，接口灵活、与分词器无关；
- 支持 [vLLM](https://github.com/vllm-project/vllm) 快速省显存推理；
- 支持商业 API（[OpenAI](https://openai.com)、[TextSynth](https://textsynth.com/) 等）；
- 支持 [PEFT](https://github.com/huggingface/peft) 适配器（如 LoRA）评测；
- 支持本地模型与基准；
- 使用公开可得的提示词，保证可复现性与论文间可比性；
- 轻松支持自定义提示词与评测指标。

本框架是 🤗 Hugging Face [Open LLM Leaderboard](https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard) 的后端，已被[数百篇论文](https://scholar.google.com/scholar?oi=bibs&hl=en&authuser=2&cites=15052937328817631261)采用，NVIDIA、Cohere、BigScience、BigCode、Nous Research、Mosaic ML 等数十个组织内部使用。

## 安装（Install）

```bash
git clone --depth 1 https://github.com/EleutherAI/lm-evaluation-harness
cd lm-evaluation-harness
pip install -e .
```

### 安装模型后端

基础安装只提供核心评测框架，**模型后端需用可选 extras 单独安装**：

```bash
pip install "lm_eval[hf]"          # HuggingFace transformers 模型
pip install "lm_eval[vllm]"        # vLLM 推理
pip install "lm_eval[api]"         # API 模型（OpenAI、Anthropic 等）
pip install "lm_eval[hf,vllm,api]" # 多个后端可同时安装
```

全部可选 extras 的详细表格见文末。

## 基本用法（Basic Usage）

### 文档

| 指南 | 描述 |
|-------|-------------|
| CLI Reference | 命令行参数与子命令 |
| Configuration Guide | YAML 配置文件格式与示例 |
| Python API | 用 `simple_evaluate()` 编程调用 |
| Task Guide | 可用任务与任务配置 |

用 `lm-eval -h` 查看选项，`lm-eval run -h` 查看评测选项。列出可用任务：`lm-eval ls tasks`。

### Hugging Face `transformers` 后端

> 重要：使用 HF 后端先安装 `pip install "lm_eval[hf]"`。

评测 Hub 上的模型（如 GPT-J-6B）跑 `hellaswag`（假定有 CUDA GPU）：

```bash
lm_eval --model hf \
    --model_args pretrained=EleutherAI/gpt-j-6B \
    --tasks hellaswag \
    --device cuda:0 \
    --batch_size 8
```

`--model_args` 可向模型构造器传额外参数——最常用的如用 Hub 的 `revisions` 特性加载部分训练的检查点、或指定数据类型：

```bash
lm_eval --model hf \
    --model_args pretrained=EleutherAI/pythia-160m,revision=step100000,dtype="float" \
    --tasks lambada_openai,hellaswag \
    --device cuda:0 \
    --batch_size 8
```

支持 `transformers.AutoModelForCausalLM`（自回归 decoder-only GPT 风格）与 `transformers.AutoModelForSeq2SeqLM`（如 T5 等编码-解码模型）加载的所有模型。

批次大小可自动选择：`--batch_size auto` 自动探测设备能容纳的最大批次。长短样本差异大的任务上，周期性重算最大批次能进一步提速：加 `:N`（如 `auto:4` 表示重算 4 次）。

> 提示：与能给 `transformers.AutoModel` 传本地路径一样，`--model_args pretrained=/path/to/model` 也接受本地路径。

#### 评测 GGUF 模型

`lm-eval` 经 HF（`hf`）后端支持评测 GGUF 格式模型。把模型权重目录、`gguf_file`、（可选）单独的 `tokenizer` 路径经 `--model_args` 传入即可。

**🚨 重要**：不单独提供 tokenizer 时，HF 会尝试从 GGUF 文件重建 tokenizer——可能耗时**数小时**甚至无限挂起；传单独 tokenizer 可把加载时间从数小时降到数秒：

```bash
lm_eval --model hf \
    --model_args pretrained=/path/to/gguf_folder,gguf_file=model-name.gguf,tokenizer=/path/to/tokenizer \
    --tasks hellaswag \
    --device cuda:0 \
    --batch_size 8
```

> TIP：tokenizer 路径须指向有效的 HF tokenizer 目录（含 tokenizer_config.json、vocab.json 等）。

#### 评测 llama.cpp 服务的 GGUF 模型

`gguf` 模型类型经 llama.cpp 服务器（`llama-server`）的 OpenAI 兼容 `/v1/completions` 端点评测：

```bash
lm_eval --model gguf \
    --model_args base_url=http://127.0.0.1:8080 \
    --tasks hellaswag
```

- 需要 2024 年 12 月以后的 llama.cpp 版本（以新 OpenAI 格式返回 logprobs；已弃用的 `token_logprobs` 旧格式不支持）；
- 服务器以路由模式（多模型）运行时传模型名：`--model_args base_url=http://127.0.0.1:8080,model=my-model-alias`；
- 请求并发发出，默认并行度从服务器槽位数自动探测（`/props` → `total_slots`，即 `--parallel` 设置），可用 `parallel=<N>` 覆盖。`loglikelihood` 请求还会经 `id_slot` 钉在槽位上：连续请求（如同一选择题的各候选续写）共享同一槽位以复用其缓存前缀；`generate_until` 不钉槽（动态空闲槽分配对变长生成负载均衡更好）；
- `loglikelihood` 经精确 teacher forcing 实现：llama.cpp 忽略 `echo` 且从不返回提示词 logprobs，因此续写用服务器 `/tokenize` 端点分词（上下文与续写分开编码，与 HF 后端一致），每个续写 token 以其自然前缀作为 token-id 提示并加 `logit_bias` 强制采样，llama.cpp 返回被强制 token 的*采样前* logprob 与无偏 `top_logprobs`，得到的 loglikelihood 与 HF 后端一致到量化噪声量级。（朴素替代方案——用 GBNF 文法强制续写——**不**可行：文法约束解码可能选择碎片化分词，其 logprobs 不是自然分词的 loglikelihood，会系统性压低分数。）
- `loglikelihood_rolling`（wikitext 等困惑度任务）在该模型类型上未实现。

#### 用 Hugging Face `accelerate` 做多 GPU 评测

支持三种主要方式：

**数据并行评测**（每 GPU 加载**独立完整副本**）——经 accelerate 启动器：

```bash
accelerate launch -m lm_eval --model hf \
    --tasks lambada_openai,arc_easy \
    --batch_size 16
```

模型能装进单卡时，K 张卡可获得 K 倍速。**警告**：此方式不兼容 FSDP 模型分片——`accelerate config` 中必须禁用 FSDP 或用 NO_SHARD 选项。

**模型太大单卡装不下时**——在 accelerate 启动器之外运行，向 `--model_args` 传 `parallelize=True`：

```bash
lm_eval --model hf \
    --tasks lambada_openai,arc_easy \
    --model_args parallelize=True \
    --batch_size 16
```

模型权重会切分到所有可用 GPU。更高级的选项：`device_map_option`（切分方式，默认 "auto"）、`max_memory_per_gpu`、`max_cpu_memory`、`offload_folder`。

**两者结合**——数据并行 + 模型分片：

```bash
accelerate launch --multi_gpu --num_processes {模型副本数} \
    -m lm_eval --model hf \
    --tasks lambada_openai,arc_easy \
    --model_args parallelize=True \
    --batch_size 16
```

**警告**：`hf` 模型类型原生不支持多节点评测；请参考 GPT-NeoX 库集成中自定义多机评测脚本的写法，或对外部托管服务器发起推理请求。

#### 张量并行（PyTorch 原生）

对支持 PyTorch 原生张量并行（经 DTensor）的模型，不依赖 accelerate 的 device-map，在 `--model_args` 传 `tp_plan=auto`，用 `torchrun` 或 `accelerate launch` 启动：

```bash
torchrun --nproc-per-node=4 -m lm_eval \
    --model hf \
    --model_args pretrained=google/gemma-4-31B-it,tp_plan=auto \
    --tasks lambada_openai,arc_easy \
    --batch_size 16
```

**约束**：`tp_plan` 与 `parallelize=True` 互斥；模型 KV 头数必须被 `--nproc-per-node`（TP 度）整除；需 PyTorch >= 2.4 与暴露该模型 TP plan 的 transformers 版本（v4.47+）。

### Steered HF `transformers` 模型

评测应用了转向向量的模型：模型类型设为 `steered`，提供含预定义转向向量的 PyTorch 文件，或指定如何从 `sparsify`/`sae_lens` 模型导出转向向量的 CSV（需安装相应可选依赖）。示例配置与运行命令见原文（`steer_config.pt` 的 layers.3 层向量注入，或经 SAE 特征索引导出；运行时 `--model steered --model_args pretrained=...,steer_path=steer_config.pt`）。

### NVIDIA `nemo` 模型

[NVIDIA NeMo Framework](https://github.com/NVIDIA/NeMo) 是面向语言模型研究者的生成式 AI 框架。按官方文档安装 NeMo（强烈建议用 NVIDIA PyTorch 或 NeMo 容器），模型可从 NVIDIA NGC Catalog 或 NVIDIA 的 HF 页获取，仓库内含 llama/falcon/mixtral/mpt 等 HF 检查点转 `nemo` 的转换脚本。

单卡运行 `nemo` 模型：

```bash
lm_eval --model nemo_lm \
    --model_args path=<path_to_nemo_model> \
    --tasks hellaswag \
    --batch_size 32
```

建议解包 `.nemo` 模型再评测（避免容器内解包撑爆磁盘）：`mkdir MY_MODEL && tar -xvf MY_MODEL.nemo -c MY_MODEL`。

**多 GPU**：默认单卡；单节点上支持数据复制或张量/流水线并行。数据复制：`model_args` 设 `devices`（8 卡 8 副本：`torchrun --nproc-per-node=8 --no-python lm_eval --model nemo_lm --model_args path=...,devices=8 ...`）；张量/流水线并行：设 `tensor_model_parallel_size`/`pipeline_model_parallel_size` 且 `devices` 等于两者乘积（4 卡 TP=2、PP=2：`--model_args path=...,devices=4,tensor_model_parallel_size=2,pipeline_model_parallel_size=2`）。建议用 `torchrun --nproc-per-node=<设备数> --no-python` 替代 `python` 便于加载。尚不支持：多节点、数据复制与张量/流水线并行的组合。

### Megatron-LM 模型

该后端直接评测 Megatron-LM 检查点、无需转换。要求：Megatron-LM 已安装或经 `MEGATRON_PATH` 环境变量可访问；带 CUDA 的 PyTorch。`export MEGATRON_PATH=/path/to/Megatron-LM` 后：

```bash
lm_eval --model megatron_lm \
    --model_args load=/path/to/checkpoint,tokenizer_type=HuggingFaceTokenizer,tokenizer_model=/path/to/tokenizer \
    --tasks hellaswag \
    --batch_size 1
```

支持标准 Megatron 检查点（`model_optim_rng.pt`）与分布式检查点（`.distcp`，自动检测）。

**并行模式**：

| 模式 | 配置 | 描述 |
|------|---------------|-------------|
| 单卡 | `devices=1`（默认） | 标准单卡评测 |
| 数据并行 | `devices>1, TP=1` | 每卡完整副本，数据分发 |
| 张量并行 | `TP == devices` | 模型层切分到多卡 |
| 专家并行 | `EP == devices, TP=1` | MoE 模型的专家分布到多卡 |

> 注意：暂不支持流水线并行（PP > 1）；专家并行（EP）不能与张量并行（TP）组合。数据并行（4 卡）：`torchrun --nproc-per-node=4 -m lm_eval --model megatron_lm --model_args load=...,tokenizer_model=...,devices=4 ...`；张量并行（TP=2）：加 `devices=2,tensor_model_parallel_size=2`；MoE 专家并行（EP=4）：加 `expert_model_parallel_size=4`。额外 Megatron 选项经 `extra_args` 传入（如 `--no-rope-fusion --trust-remote-code`）。`--use-checkpoint-args` 默认启用（从检查点加载架构参数）。

#### OpenVINO 模型的多 GPU 评测

OpenVINO 模型支持评测时流水线并行：`model_args` 设 `pipeline_parallel`，且 `device` 设为 `HETERO:<GPU索引1>,<GPU索引2>`：

```bash
lm_eval --model openvino \
    --tasks wikitext \
    --model_args pretrained=<path_to_ov_model>,pipeline_parallel=True \
    --device HETERO:GPU.1,GPU.0
```

### 用 `vLLM` 做张量+数据并行与优化推理

vLLM 后端对[支持的模型](https://docs.vllm.ai/en/latest/models/supported_models.html)推理更快，多卡切分模型时尤甚。单卡/多卡（张量并行、数据并行或两者结合）示例：

```bash
lm_eval --model vllm \
    --model_args pretrained={model_name},tensor_parallel_size={每模型GPU数},dtype=auto,gpu_memory_utilization=0.8,data_parallel_size={模型副本数} \
    --tasks lambada_openai \
    --batch_size auto
```

使用 vLLM：`pip install "lm_eval[vllm]"`。完整配置见 vLLM 集成文档。

> 注意：`data_parallel_size>1` 时每个副本作为独立的 [ray](https://github.com/ray-project/ray) actor 分发，需要 `pip install ray`；每个 actor 占用 `tensor_parallel_size` 张卡（默认 1）。

vLLM 输出偶尔与 HuggingFace 不同。我们把 HF 视为参考实现，提供[脚本](https://github.com/EleutherAI/lm-evaluation-harness/blob/main/scripts/model_comparator.py)校验 vLLM 结果的有效性。

> TIP：追求最快速度时尽可能用 `--batch_size auto`，以利用 vLLM 的 continuous batching！
>
> TIP：经 model args 给 vLLM 传 `max_model_len=4096` 等合理默认值，可在自动批次时提速或避免 OOM（如 Mistral-7B-v0.1 默认最大长度 32k）。

### 用 `SGLang` 做张量+数据并行与快速离线批量推理

SGLang 后端支持高效离线批量推理，其 Fast Backend Runtime 经优化的内存管理与并行处理提供高性能：张量并行、continuous batching、多种量化（FP8/INT4/AWQ/GPTQ）。请先按 SGLang 文档安装。

> TIP：因 [Flashinfer](https://docs.flashinfer.ai/) 的安装方式，SGLang 依赖未包含在 pyproject.toml 中；Flashinfer 对 torch 版本也有要求。

```bash
lm_eval --model sglang \
    --model_args pretrained={model_name},dp_size={数据并行},tp_size={张量并行},dtype=auto \
    --tasks gsm8k_cot \
    --batch_size auto
```

> TIP：遇到 OOM（尤其多选题任务）时：① 用手动 `batch_size` 而非 `auto`；② 调低 `mem_fraction_static` 减少 KV cache 池占用（如 `--model_args pretrained=...,mem_fraction_static=0.7`）；③ 多卡时增大 `tp_size`。

### ONNX Runtime GenAI

支持 [ONNX Runtime GenAI *Model Builder*](https://onnxruntime.ai/docs/genai/howto/model=build.html) 产出的 ONNX LLM 的跨平台评测。与 Windows ML 后端不同，此后端运行于 Linux/macOS/Windows，经跨平台 `og.Config` API 选择执行提供者（CPU、CUDA、DirectML、WebGPU，以及经 VitisAI/RyzenAI 的 AMD NPU）：

```bash
# CPU
pip install "lm_eval[onnxruntime-genai]"
# CUDA / DirectML（与 CPU wheel 互斥）：
#   pip install onnxruntime-genai-cuda
#   pip install onnxruntime-genai-directml
```

```bash
lm_eval --model onnxruntime-genai \
    --model_args pretrained=/path/to/model_builder_output,execution_provider=cuda \
    --tasks hellaswag \
    --batch_size 1
```

`pretrained` 为 Model Builder 输出目录（含 `genai_config.json`、ONNX 图与 HF tokenizer）；`execution_provider` 默认 `cpu`，可传 `cuda`/`dml`/`VitisAI` 等；额外提供者设置经 `provider_options`。支持的架构即 Model Builder 所支持的（Llama、Phi、Qwen、Gemma、Mistral、Granite、ChatGLM 等）。推理为 batch-size 1、每次运行一个执行提供者。

### ONNX Runtime

同一 Model Builder 导出也可经原始 `onnxruntime.InferenceSession` 运行（而非 GenAI 循环）。当你希望分数来自部署实际使用的运行时、或需要 `onnxruntime-genai` 未编译的执行提供者——特别是 AMD GPU 的 **ROCm** 与 **MIGraphX**——用此后端：

```bash
# CPU
pip install "lm_eval[onnxruntime]"
# CUDA / ROCm（与 CPU wheel 互斥）：
#   pip install onnxruntime-gpu
#   pip install onnxruntime-rocm
```

```bash
lm_eval --model onnxruntime \
    --model_args pretrained=/path/to/model_builder_output,execution_provider=rocm \
    --tasks hellaswag,arc_easy,wikitext \
    --batch_size 1
```

`execution_provider` 接受短别名（`cpu`、`cuda`、`rocm`、`migraphx`、`dml`、`openvino`、`tensorrt`、`vitisai`、`webgpu`、`qnn`）及完整 ONNX Runtime 提供者名。不设时遵循导出的 `genai_config.json` 声明。非 CPU 提供者保留 `CPUExecutionProvider` 作逐节点回退（Model Builder 图使用并非所有提供者都实现的 contrib ops）。两个 ONNX 后端共享同一打分实现与 ORT 内核，同模型同提供者结果一致（有常设一致性测试）。注意：此後端当前覆盖 `loglikelihood`、`multiple_choice`、`loglikelihood_rolling`（hellaswag、arc、mmlu、wikitext 等）；gsm8k 等生成任务用 `--model onnxruntime-genai`。已安装的 onnxruntime 须足够新以加载 contrib-op 模式（旧运行时可能直接拒绝图，如 12 输入的 GroupQueryAttention 在 ONNX Runtime 1.22 上无法加载）。

### Windows ML

Windows 平台硬件加速推理（CPU、GPU 与 **NPU**）：

```bash
pip install wasdk-Microsoft.Windows.AI.MachineLearning[all] wasdk-Microsoft.Windows.ApplicationModel.DynamicDependency.Bootstrap onnxruntime-windowsml onnxruntime-genai-winml
```

```bash
lm_eval --model winml \
    --model_args pretrained=/path/to/onnx/model \
    --tasks mmlu \
    --batch_size 1
```

> 注意：Windows ML 后端仅支持 ONNX Runtime GenAI 模型格式（模型文件夹中有 `genai_config.json` 可验证）；`transformers.js` 目标的模型不可用。目标设备上运行 GenAI 模型必须先把原模型转换为对应厂商与设备类型（见 Microsoft AI Tool Kit 的模型转换文档）。

### 模型 API 与推理服务器

> 重要：使用 API 模型先安装 `pip install "lm_eval[api]"`。

也支持经商业 API 服务的模型评测：

```bash
export OPENAI_API_KEY=YOUR_KEY_HERE
lm_eval --model openai-completions \
    --model_args model=davinci-002 \
    --tasks lambada_openai,hellaswag
```

支持镜像 OpenAI Completions 与 ChatCompletions API 的自有本地推理服务器：

```bash
lm_eval --model local-completions --tasks gsm8k --model_args model=facebook/opt-125m,base_url=http://{yourip}:8000/v1/completions,num_concurrent=1,max_retries=3,tokenized_requests=False,batch_size=16
```

注意：外部托管模型不应使用也不生效 `--device` 等本地模型相关配置。`--model_args` 可向模型 API 传任意参数（以托管服务文档为准）。

| API 或推理服务器 | 已实现？ | `--model <xxx>` 名称 | 支持的模型 | 请求类型 |
|---|---|---|---|---|
| OpenAI Completions | ✅ | `openai-completions`、`local-completions` | 所有 OpenAI Completions API 模型 | `generate_until`、`loglikelihood`、`loglikelihood_rolling` |
| OpenAI ChatCompletions | ✅ | `openai-chat-completions`、`local-chat-completions` | 所有 ChatCompletions API 模型 | `generate_until`（无 logprobs） |
| Anthropic | ✅ | `anthropic` | 支持的 Anthropic 模型 | `generate_until`（无 logprobs） |
| Anthropic Chat | ✅ | `anthropic-chat`、`anthropic-chat-completions` | 支持的 Anthropic 模型 | `generate_until`（无 logprobs） |
| LiteLLM（100+ 提供商网关） | ✅ | `litellm`、`litellm-chat`、`litellm-chat-completions` | 所有 LiteLLM 支持的提供商 | `generate_until`（无 logprobs） |
| Textsynth | ✅ | `textsynth` | 所有支持的引擎 | `generate_until`、`loglikelihood`、`loglikelihood_rolling` |
| Cohere | ⏳（受 Cohere API bug 阻塞） | N/A | 所有 `cohere.generate()` 引擎 | `generate_until`、`loglikelihood`、`loglikelihood_rolling` |
| Llama.cpp（经 llama-cpp-python） | ✅ | `gguf`、`ggml` | llama.cpp 支持的所有模型 | `generate_until`、`loglikelihood`（困惑度未实现） |
| vLLM | ✅ | `vllm` | 多数 HF 因果语言模型 | `generate_until`、`loglikelihood`、`loglikelihood_rolling` |
| Mamba | ✅ | `mamba_ssm` | 经 `mamba_ssm` 包的 Mamba 架构模型 | `generate_until`、`loglikelihood`、`loglikelihood_rolling` |
| HF Optimum（因果 LM） | ✅ | `openvino` | 经 Optimum 转 OpenVINO IR 的 decoder-only 模型 | 同上三类 |
| HF Optimum-intel IPEX | ✅ | `ipex` | 任意 decoder-only AutoModelForCausalLM | 同上三类 |
| HF Optimum-habana | ✅ | `habana` | 任意 decoder-only AutoModelForCausalLM | 同上三类 |
| AWS Inf2 Neuron | ✅ | `neuronx` | Inferentia2 支持的 decoder-only 模型 | 同上三类 |
| NVIDIA NeMo | ✅ | `nemo_lm` | 所有支持的模型 | 同上三类 |
| NVIDIA Megatron-LM | ✅ | `megatron_lm` | Megatron-LM GPT 模型（标准与分布式检查点） | 同上三类 |
| Watsonx.ai | ✅ | `watsonx_llm` | 支持的 Watsonx.ai 引擎 | `generate_until`、`loglikelihood` |
| ONNX Runtime GenAI | ✅ | `onnxruntime-genai` | GenAI 格式 ONNX 模型（跨平台 CPU/CUDA/DirectML/NPU） | 同上三类 |
| ONNX Runtime | ✅ | `onnxruntime` | GenAI 格式 ONNX 经原始 InferenceSession（增加 ROCm/MIGraphX） | `loglikelihood`、`loglikelihood_rolling` |
| Windows ML | ✅ | `winml` | GenAI 格式 ONNX 模型 | 同上三类 |
| 你的本地推理服务器 | ✅ | `local-completions` 或 `local-chat-completions` | OpenAI API 兼容服务器，其他 API 易于定制 | 同上三类 |

不提供 logits/logprobs 的模型只能跑 `generate_until` 类任务；提供 logprobs 的本地模型或 API 可跑全部四类：`generate_until`、`loglikelihood`、`loglikelihood_rolling`、`multiple_choice`。

> 注意：对 Anthropic Claude 3、GPT-4 等闭源聊天 API，建议先用 `--limit 10` 查看少量样例输出，确认生成任务的答案抽取与打分符合预期；为 anthropic-chat-completions 在 `--model_args` 里提供 `system="<系统提示>"` 指定回答格式可能有帮助。

### 其他框架

GPT-NeoX、Megatron-DeepSpeed、mesh-transformer-jax 等库内含调用评测框架的脚本；自定义集成教程见 interface 文档。

### 附加特性

> 注意：对不适合直接评测的任务（执行不可信代码的风险或评测流程复杂），可用 `--predict_only` 获取解码生成结果做事后评测。

Metal 兼容的 Mac 可用 MPS 后端：把 `--device cuda:0` 换成 `--device mps`（需 PyTorch 2.1+）。**注意 MPS 后端尚处早期，可能有正确性问题或不支持的操作；若 MPS 上模型表现异常，建议先核对 `--device cpu` 与 `--device mps` 的前向输出是否一致。**

> 注意：可用以下命令检查 LM 输入的样子（每个任务输出一个文本文件）：
>
> ```bash
> python write_out.py \
>     --tasks <task1,task2,...> \
>     --num_fewshot 5 \
>     --num_examples 10 \
>     --output_base_path /path/to/output/folder
> ```

除运行任务本身，还可验证任务数据完整性：`--check_integrity` 标志。

## 高级用法技巧（Advanced Usage Tips）

HF `transformers` 加载的模型，`--model_args` 的参数直接传给相应构造器——`AutoModel` 能做的都能做。例如经 PEFT 评测微调模型（在评测基座模型的调用上加 `,peft=PATH`）：

```bash
lm_eval --model hf \
    --model_args pretrained=EleutherAI/gpt-j-6b,parallelize=True,load_in_4bit=True,peft=nomic-ai/gpt4all-j-lora \
    --tasks openbookqa,arc_easy,winogrande,hellaswag,arc_challenge,piqa,boolq \
    --device cuda:0
```

增量权重（delta weights）模型：

```bash
lm_eval --model hf \
    --model_args pretrained=Ejafa/llama_7B,delta=lmsys/vicuna-7b-delta-v1.1 \
    --tasks hellaswag
```

GPTQ 量化模型用 [GPTQModel](https://github.com/ModelCloud/GPTQModel)（更快）或 [AutoGPTQ](https://github.com/PanQiWei/AutoGPTQ) 加载：GPTQModel 加 `,gptqmodel=True`；AutoGPTQ 加 `,autogptq=model.safetensors,gptq_use_triton=True`。

任务名支持通配符：`--task lambada_openai_mt_*` 运行全部机器翻译版 lambada 任务。

## 保存与缓存结果（Saving & Caching Results）

用 `--output_path` 保存评测结果；`--log_samples` 记录模型响应供事后分析。

> TIP：`--use_cache <DIR>` 缓存评测结果，恢复同一（模型，任务）对运行时跳过已评测样本。缓存与排名（rank）相关，中断后请以相同 GPU 数重启。`--cache_requests` 还可保存数据集预处理步骤，加快评测恢复。

推送结果与样本到 Hugging Face Hub：先在 `HF_TOKEN` 设有写权限的访问令牌，再用 `--hf_hub_log_args` 指定组织、仓库名、可见性与是否推送：

```bash
lm_eval --model hf \
    --model_args pretrained=model-name-or-path,autogptq=model.safetensors,gptq_use_triton=True \
    --tasks hellaswag \
    --log_samples \
    --output_path results \
    --hf_hub_log_args hub_results_org=EleutherAI,hub_repo_name=lm-eval-results,push_results_to_hub=True,push_samples_to_hub=True,public_repo=False \
```

然后可从 Hub 下载结果与样本：`load_dataset("EleutherAI/lm-eval-results-private", "hellaswag", "latest")`。全部参数见 interface 指南。

## 可视化结果（Visualizing Results）

### Zeno

用 [Zeno](https://zenoml.com) 可视化评测结果：注册 [hub.zenoml.com](https://hub.zenoml.com) 获取 API key（`export ZENO_API_KEY=...`），安装 `lm_eval[zeno]` extra。带 `--log_samples --output_path output/gpt-j-6B` 运行评测（output_path 按模型名分文件夹），然后用 `zeno_visualize` 脚本上传：`python scripts/zeno_visualize.py --data_path output --project_name "Eleuther Project"`——`data_path` 下每个子文件夹视为一个模型，多任务时 `project_name` 作前缀、每任务一个项目。完整工作流见 examples/visualize-zeno.ipynb。

### Weights and Biases

W&B 集成自动记录评测结果、样本记为 W&B Tables、`results.json` 记为 artifact 版本管理、有样本时记录 `<task_name>_eval_samples.json`、生成含全部关键指标的综合报告、记录任务与 CLI 配置、以及运行命令/GPU-CPU 数/时间戳等开箱即用的信息。

安装 `pip install lm_eval[wandb]`；`wandb login` 认证；运行时加 `wandb_args` 标志（逗号分隔的 wandb.init 参数）：

```bash
lm_eval \
    --model hf \
    --model_args pretrained=microsoft/phi-2,trust_remote_code=True \
    --tasks hellaswag,mmlu_abstract_algebra \
    --device cuda:0 \
    --batch_size 8 \
    --output_path output/phi-2 \
    --limit 10 \
    --wandb_args project=lm-eval-harness-integration \
    --log_samples
```

stdout 中会给出 W&B 运行页与报告链接。示例见 examples/visualize-wandb.ipynb。

## 参与贡献（Contributing）

欢迎查看 open issues 并提交 PR！开发起步：

```bash
git clone https://github.com/EleutherAI/lm-evaluation-harness
cd lm-evaluation-harness
pip install -e ".[dev,hf]"
```

### 实现新任务

见官方新任务指南。对于提示词与其他评测细节的争议，我们按以下优先级处理：

1. 若 LLM 训练者之间存在广泛共识，采用共识流程；
2. 若存在清晰无歧义的官方实现，采用之；
3. 若 LLM 评测者之间存在广泛共识，采用共识流程；
4. 若存在多种常见实现但无普遍共识，选用我们在常见实现中偏好的选项——同样优先从 LLM 训练论文中的实现里选。

这些是指南而非规则，特殊情况可推翻。我们尽量与其他团体的流程保持一致，以减轻跨论文比较带来的伤害（尽管我们不鼓励这种比较）。历史上我们也优先采用《Language Models are Few Shot Learners》的实现，因为项目初衷就是与该论文对比。

### 支持

最好的求助方式是在仓库提 issue 或加入 [EleutherAI Discord](https://discord.gg/eleutherai)：`#lm-thunderdome` 频道专事本项目建设，`#release-discussion` 频道提供发布支持。

## 可选 Extras

经 `pip install -e ".[NAME]"` 安装。

**模型后端**：`hf`（Transformers：torch/transformers/accelerate/peft）、`vllm`（vLLM 快速推理）、`api`（API 模型：OpenAI、Anthropic、本地服务器）、`gptq`（AutoGPTQ）、`gptqmodel`（GPTQModel）、`ibm_watsonx_ai`、`ipex`（Intel IPEX）、`habana`（Intel Gaudi）、`optimum`（Intel OpenVINO）、`neuronx`（AWS Inferentia2）、`onnxruntime-genai`（跨平台 CPU/CUDA/DirectML/NPU）、`onnxruntime`（原始 session，增加 ROCm/MIGraphX）、`winml`（Windows ML：CPU/GPU/NPU）、`sparsify` 与 `sae_lens`（模型转向）。

**任务依赖**：`tasks`（全部任务依赖）、`acpbench`、`audiolm_qwen`、`ifeval`、`japanese_leaderboard`、`longbench`、`math`（数学答案判定）、`multilingual`（多语种分词器）、`ruler`。

**开发与工具**：`dev`（lint 与贡献）、`hf_transfer`（加速 HF 下载）、`sentencepiece`、`unitxt`、`wandb`、`zeno`。

## 引用（Cite as）

BibTeX：`The Language Model Evaluation Harness`（Gao, Leo 等 24 位作者，2024-07，DOI 10.5281/zenodo.10256836），完整条目见原文。

---

> **来源**：抓取于 2026-09-13。本篇为编者总结版的重做：正文主体替换为 [EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) 官方 README 的完整翻译（作者 Gao, Leo 等，EleutherAI，许可 MIT，经仓库 LICENSE.md 核实）。Latest News/公告/Overview/Install/Basic Usage（HF 后端、GGUF 两种评测、accelerate 多 GPU、原生张量并行、steered/nemo/Megatron-LM/OpenVINO/vLLM/SGLang/ONNX 双后端/Windows ML/API 服务器总表/其他框架/附加特性）/高级用法/保存与缓存/可视化（Zeno、W&B）/贡献与新任务优先级/支持/可选 Extras 三表/引用各节均为完整翻译。仅以下内容未逐一保留并注明：DOI 与徽章图片、指向仓库内部文件的长链接改为文字表述、nemo/steered 小节中与正文重复的完整配置代码块（已要点转述并注明见原文）、Zeno 小节中与正文重复的示例命令、引用部分的完整 BibTeX（24 位作者名单过长，条目信息如实转述）、原文个别链接笔误保持原义未改。头部导语一句为本篇编者注。
