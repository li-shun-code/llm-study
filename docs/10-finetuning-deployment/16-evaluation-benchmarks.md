---
title: LLM 评测方法与基准：lm-evaluation-harness 实战
source_url: https://github.com/EleutherAI/lm-evaluation-harness
author: EleutherAI（lm-evaluation-harness）、Hugging Face（smol-course）
license: MIT（lm-evaluation-harness）、Apache 2.0（smol-course）
fetched_at: 2026-09-13
translated: true
order: 16
versions: lm-eval（2026-09 主分支，lm_eval 可选后端 extras 安装方式）
---

> **来源**：本文主体翻译自 [Language Model Evaluation Harness 官方 README](https://github.com/EleutherAI/lm-evaluation-harness)，作者 EleutherAI，许可 MIT；"基准的局限与评测策略"部分翻译自 [Automatic Benchmarks（smol-course v1 · Evaluation 单元）](https://github.com/huggingface/smol-course/tree/main/v1/4_evaluation)，作者 Hugging Face，许可 Apache 2.0。抓取于 2026-09-13。

微调完的模型"到底变好了没有"，不能靠感觉——需要一个统一、可复现的评测框架。lm-evaluation-harness（lm-eval）是社区事实标准：Hugging Face Open LLM Leaderboard 的后端，被数百篇论文采用。

## lm-evaluation-harness 是什么

该项目提供了一个统一框架，用于在大量不同的评测任务上测试生成式语言模型。

**特性**：

- 60 余个标准学术基准，含数百个子任务与变体
- 支持 transformers 加载的模型（含 GPTQModel/AutoGPTQ 量化模型）、GPT-NeoX、Megatron-DeepSpeed，接口与分词器无关
- 支持 [vLLM](https://github.com/vllm-project/vllm) 快速省显存推理
- 支持 OpenAI、TextSynth 等商业 API 模型
- 支持 HuggingFace PEFT 库的适配器（如 LoRA）评测
- 支持本地模型与本地基准
- 使用公开可得的提示词，保证可复现与论文间可比性
- 易于自定义提示词与评测指标

它是 Hugging Face Open LLM Leaderboard 的后端，被 NVIDIA、Cohere、BigScience、BigCode、Nous Research、Mosaic ML 等数十家机构内部使用。

## 安装

从 GitHub 仓库安装 `lm-eval` 包：

```bash
git clone --depth 1 https://github.com/EleutherAI/lm-evaluation-harness
cd lm-evaluation-harness
pip install -e .
```

### 安装模型后端

基础安装只提供评测框架，**模型后端需通过可选 extras 单独安装**：

```bash
pip install "lm_eval[hf]"       # HuggingFace transformers 模型
pip install "lm_eval[vllm]"     # vLLM 推理
pip install "lm_eval[api]"      # API 模型（OpenAI、Anthropic 等）
pip install "lm_eval[hf,vllm,api]"  # 可组合安装
```

## 基本用法

命令行帮助：`lm-eval -h`（评测选项用 `lm-eval run -h`）；列出可用任务：`lm-eval ls tasks`。文档入口：CLI Reference、Configuration Guide（YAML 配置文件）、Python API（`simple_evaluate()`）、Task Guide。

### HuggingFace transformers 后端

先安装 `pip install "lm_eval[hf]"`。评测 Hub 上的模型（如 GPT-J-6B）在 `hellaswag` 任务上的表现：

```bash
lm_eval --model hf \
    --model_args pretrained=EleutherAI/gpt-j-6B \
    --tasks hellaswag \
    --device cuda:0 \
    --batch_size 8
```

`--model_args` 可传模型构造参数，典型用法是指定 Hub 的 revision（如训练中间检查点）或数据类型：

```bash
lm_eval --model hf \
    --model_args pretrained=EleutherAI/pythia-160m,revision=step100000,dtype="float" \
    --tasks lambada_openai,hellaswag \
    --device cuda:0 \
    --batch_size 8
```

通过 `transformers.AutoModelForCausalLM`（自回归 GPT 风格）与 `transformers.AutoModelForSeq2SeqLM`（T5 等编码-解码模型）加载的模型均受支持。

batch size 可以自动化：`--batch_size auto` 会自动探测设备能容纳的最大 batch size；长短样本差距大的任务可加 `:N` 周期性重算（如 `--batch_size auto:4` 重算 4 次）。与 transformers 一样，`pretrained=` 也可以传本地路径——**评测自己微调的模型就是这样做**。

GGUF 格式模型（llama.cpp 转换产物）也可用 hf 后端评测。

### vLLM 后端：张量/数据并行加速

对支持的模型类型，可用 vLLM 加速评测，多卡切分模型时尤其快：

```bash
lm_eval --model vllm \
    --model_args pretrained={model_name},tensor_parallel_size={GPUs_per_model},dtype=auto,gpu_memory_utilization=0.8,data_parallel_size={model_replicas} \
    --tasks lambada_openai \
    --batch_size auto
```

先 `pip install "lm_eval[vllm]"`。几点提示：

- `data_parallel_size>1` 会把每个副本作为独立 ray actor 分发（需 `pip install ray`），每个 actor 占用 `tensor_parallel_size` 张卡。
- vLLM 与 HF 的输出偶有差异——项目把 HF 视为参考实现，提供 `scripts/model_comparator.py` 校验 vLLM 结果的有效性。
- **追求速度尽量用 `--batch_size auto`**，以利用 vLLM 的连续批处理（continuous batching）能力。
- 传 `max_model_len=4096` 之类的合理默认值可提速或避免 OOM（如 Mistral-7B-v0.1 默认最大长度 32k，自动 batch size 下容易爆显存）。

另有 SGLang 后端（`lm_eval --model sglang`），支持张量/数据并行与 FP8/INT4/AWQ/GPTQ 量化模型的高效离线批量推理。

::: tip 编者注：Python API 调用示例
命令行之外，`simple_evaluate()` 更适合集成进训练脚本：

```python
import lm_eval

results = lm_eval.simple_evaluate(
    model="vllm",
    model_args={"pretrained": "./my-finetuned-model", "gpu_memory_utilization": 0.8},
    tasks=["mmlu", "gsm8k"],
)
print(results["results"])
```

在 [训练超参与过拟合诊断](./08-hyperparams-overfitting) 的多 checkpoint 筛选环节，把 lm-eval 挂进训练流水线即可自动化"选最好的检查点"。
:::

## 基准与它们的局限（smol-course）

自动基准是跨任务、跨能力评测语言模型的标准化工具：由精心整理的数据集、预定义任务与评测指标构成，最大优势是**标准化**——不同模型可一致比较、结果可复现。但**基准成绩不能直接等同于真实场景效果**：学术基准上的优等生，照样可能在特定领域应用中水土不服。

**表：常见基准及其考察点**

| 类别 | 代表基准 | 考察内容 | 局限 |
| --- | --- | --- | --- |
| 通用知识 | MMLU | 57 个学科的知识覆盖 | 不反映具体领域的专业深度 |
| 真实性 | TruthfulQA | 复现常见误解的倾向 | 覆盖不了所有错误信息形态 |
| 复杂推理 | BBH、GSM8K | 逻辑思考/规划、数学解题 | 捕捉不到真实场景的细微推理 |
| 语言理解 | HELM（框架）、WinoGrande | 全面评测、常识消歧 | 代表不了自然对话与领域术语的复杂性 |

### 替代与补充的评测方法

- **LLM-as-Judge（大模型当裁判）**：用一个模型评另一个模型的输出，比传统指标反馈更细腻，但自带偏好与局限（编者注：注意位置偏差与"偏爱长答案"等已知问题，裁判模型最好与被评模型不同源）。
- **评测竞技场（Arenas）**：让模型在受控环境中互相对比，能暴露传统基准看不到的强弱项（编者注：如今的代表是 LMSYS Chatbot Arena 的人类盲测投票）。
- **自建基准套件**：面向自身需求与用例构建内部评测集——领域知识测试或还原真实部署条件的场景。

## 构建你自己的评测策略

标准基准给基线，不能只靠标准基准。smol-course 给出的完整方法论：

1. **先跑相关标准基准**，建立基线并支持与其他模型对比。
2. **明确用例的具体要求与挑战**：模型实际要执行什么任务？哪类错误的代价最大？
3. **构建反映真实用例的自建评测集**：
   - 领域内真实用户查询
   - 常见边界情况
   - 特别有挑战性的场景样本
4. **实施多层评测策略**：
   - 自动化指标——快速反馈（回归测试）
   - 人工评估——细腻理解
   - 领域专家评审——专业应用
   - 受控环境的 A/B 测试

## 微调闭环怎么搭（编者注）

把本模块串起来，一个可复现的微调-评测闭环是：

1. **基线**：`lm_eval --model vllm --model_args pretrained=Qwen/Qwen3.5-4B ...` 跑基座模型基准 + 自建领域集基线；
2. **训练**：TRL SFT/DPO（见 [SFT 实战](./09-trl-sft-practice) / [DPO](./10-dpo-preference-optimization)），训练中盯 loss 曲线（见 [超参与过拟合](./08-hyperparams-overfitting)）；
3. **筛检查点**：对每个候选 checkpoint 跑 `simple_evaluate`（自建集为主、公开基准为辅）；
4. **防污染**：确保自建评测集与训练集零重叠（见 [数据准备](./06-training-data-preparation) 的清洗清单）；
5. **上线后**：A/B 与线上反馈回流为新评测样本。

## 小结

- lm-eval 是开源模型评测事实标准：60+ 基准、多后端（hf/vllm/api/sglang）、支持 PEFT 适配器与本地模型。
- 公开基准的三重价值是"可比、可复现、防退化"，但领域效果必须靠自建评测集。
- 评测策略要分层：自动指标 + LLM-as-Judge + 人工/专家评审 + A/B。
