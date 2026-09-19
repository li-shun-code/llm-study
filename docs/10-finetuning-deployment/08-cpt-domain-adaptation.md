---
title: 继续预训练（CPT）与领域自适应
source_url: https://huggingface.co/docs/trl/main/dataset_formats
author: Hugging Face（TRL 官方文档）、Qwen 团队（官方 README 微调章节）、hiyouga（LLaMA-Factory 官方文档）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: TRL 主分支文档、LLaMA-Factory main、Qwen3.5/Qwen3 README（均为 2026-09 当前版）
order: 8
---

前面几篇讲的都是"在指令/偏好数据上做后训练"。当目标变成**把一个强基座模型适配到垂直领域**——医疗、法律、金融或某种新语言——第一块拼图往往是**继续预训练（Continued Pre-Training, CPT）**：用领域纯文本，以语言建模目标继续训练已有的基座模型。GRPO 论文里的 DeepSeekMath 正是"CPT（120B 数学 token）+ RL"的经典组合。本文整合翻译三份官方文档：TRL 的语言建模数据集与 SFT packing 文档、LLaMA-Factory 的预训练数据集文档、Qwen 官方 README 的微调章节，文末逐节署名。

# 一、TRL 中的继续预训练：语言建模数据集与 SFTTrainer（译自 TRL 官方文档）

## 语言建模数据集（译自 dataset_formats 文档 "Language modeling" 一节）

TRL 支持两大类数据集：**语言建模（language modeling）**与**提示-补全（prompt-completion）**；同时兼容**标准（standard）**与**会话（conversational）**两种格式。继续预训练使用的是语言建模一型——每行就是一段纯文本：

```python
# 标准语言建模
{"text": "The sky is blue."}

# 会话式语言建模
{"messages": [{"role": "user", "content": "What color is the sky?"},
              {"role": "assistant", "content": "It is blue."}]}
```

作为对照，其他任务的格式形如：

```python
# 标准提示-补全
{"prompt": "The sky is",
 "completion": " blue."}

# 会话式提示-补全
{"prompt": [{"role": "user", "content": "What color is the sky?"}],
 "completion": [{"role": "assistant", "content": "It is blue."}]}
```

语言建模数据集（只有 `text` 或 `messages` 列、包含完整文本序列）正是 CPT 的数据形态：领域语料清洗后放进 `text` 列，模型在完整序列上学习语言分布。

## SFTTrainer 的数据集类型（译自 sft_trainer 文档 "Expected dataset type and format" 一节）

`SFTTrainer` 同时支持语言建模与提示-补全数据集、标准与会话两种格式。提供会话数据集时，训练器会自动对其应用聊天模板（chat template）。若数据集不在上述格式中，需要先预处理转换（文档给出医疗推理数据集转 prompt-completion 的完整示例，见原文）。

也就是说，**在 TRL 中做继续预训练的"官方姿势"就是：用 `SFTTrainer` + 语言建模格式的数据集 + 开启 packing**。

## Packing（译自 reducing_memory_usage 文档 "Packing" 一节）

> **TIP**：该技术仅适用于 **SFT** 训练，且需要 **FlashAttention**（或其变体）。

截断（truncation）有几个缺点：

1. **信息丢失**：序列末尾的重要 token 可能被丢弃；
2. **截断长度难选**：太短丢数据，太长降效率。

Packing 的做法是把多条序列打包进同一个训练行，把每行填满到 `max_length`，从而缓解上述问题。

TRL 使用 **Best-Fit Decreasing（BFD）装箱算法**实现 packing，在最小化填充的同时高效分组序列。当序列超过 `max_length` 时，不同策略决定溢出 token 的处理方式。TRL 支持三种策略：

- `"bfd"`（默认）：Best-Fit Decreasing 装箱；序列超过 `max_length` 时溢出 token 被丢弃；
- `"bfd_split"`：同样 BFD 装箱，但长序列先切成 ≤ `max_length` 的块再装箱。保留全部 token，遵循《Fewer Truncations Improve Language Modeling》的做法；
- `"wrapped"`：所有 token 拼成一条流再切成定长块。填充最少，但可能把不相关的样本混在一起（即文献中的 concatenate-then-split 预处理）。缺点是会打断相当比例数据的序列连续性，损害性能——正如《Qwen3-Coder-Next Technical Report》所讨论的。

> **NOTE**：若所有序列都短于 `max_length`，`bfd` 与 `bfd_split` 行为一致（无需截断或切分）。

```python
from trl import SFTConfig

training_args = SFTConfig(
    ...,
    packing=True,
)
```

CPT 场景启示：领域语料的文档长度往往差异巨大，选 `"bfd_split"` 可保留全部 token；而 `"wrapped"` 虽然填充最少，却会跨文档拼接、破坏文档边界——对讲究文档完整性的领域语料（合同、病历、论文）并不合适。

# 二、LLaMA-Factory：预训练数据集格式（译自官方 data/README.md "Pre-training Dataset" 一节）

LLaMA-Factory 是 Qwen 官方 README 推荐的微调框架之一。其文档明确规定了预训练（即继续预训练）数据集的格式：

- 示例数据集：`c4_demo.jsonl`；
- 在预训练中，**只有 `text` 列**会被用于模型学习：

```json
[
  {"text": "document"},
  {"text": "document"}
]
```

对应地，`dataset_info.json` 中的*数据集描述*应写成：

```json
"dataset_name": {
  "file_name": "data.json",
  "columns": {
    "prompt": "text"
  }
}
```

（ Sharegpt 格式下同样存在 Pre-training Dataset 条目，`text` 列语义相同。）LLaMA-Factory 的训练配置中，`stage: sft` 配合上述纯文本数据集即为继续预训练；全流程（YAML 配置、`llamafactory-cli train` 启动）见其官方 README 与示例。

# 三、Qwen 官方微调文档要点（译自 Qwen 官方 README Finetuning 章节）

**Qwen3.5 系列 README 的 Finetuning 章节：**

> 我们建议使用以下训练框架对模型进行 SFT、DPO、GRPO 等微调：[Unsloth](https://github.com/unslothai/unsloth)、[Swift（modelscope/ms-swift）](https://github.com/modelscope/swift)、[Llama-Factory](https://github.com/hiyouga/LLaMA-Factory)。

**Qwen3 系列 README 的 Finetuning 章节：**

> 我们建议使用以下训练框架对模型进行 SFT、DPO、GRPO 等微调：[Axolotl](https://github.com/OpenAccess-AI-Collective/axolotl)、[UnSloth](https://github.com/unslothai/unsloth)、[Swift](https://github.com/modelscope/swift)、[Llama-Factory](https://github.com/hiyouga/LLaMA-Factory) 等。

两代 Qwen 官方 README 的微调指引一致：官方不绑定特定训练器，而是推荐成熟的社区框架；其中 ms-swift（Swift）由 ModelScope 官方维护，对 Qwen 全系列的 CPT/SFT/对齐支持最全（含 `--stage pt` 纯文本继续预训练模式），LLaMA-Factory 与 Unsloth 亦都提供继续预训练模式。Qwen 开源权重许可为 Apache 2.0（见 Qwen3 README License 一节），允许商用场景下的领域自适应改造。

---

> **来源**：抓取于 2026-09-13。本文逐节整合翻译自三份现役官方文档：第一节译自 TRL 官方文档 [dataset_formats](https://huggingface.co/docs/trl/main/dataset_formats) 的 Language modeling 节、[sft_trainer](https://huggingface.co/docs/trl/main/sft_trainer) 的 Expected dataset type 一节与 [reducing_memory_usage](https://huggingface.co/docs/trl/main/reducing_memory_usage) 的 Packing 一节（GitHub 主分支源文件，作者 Hugging Face，Apache 2.0；原文中 trackio/dataset-profiler 两个 iframe 嵌入未收录，其余知识内容完整翻译，文末策略启示段为编者注）；第二节译自 [hiyouga/LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) data/README.md 的 Pre-training Dataset 一节（作者 hiyouga，Apache 2.0，完整翻译；Alpaca/Sharegpt 两种变体的重复 JSON 未重复收录，文末 stage 说明为编者注）；第三节译自 [QwenLM/Qwen3.5](https://github.com/QwenLM/Qwen3.5) 与 [QwenLM/Qwen3](https://github.com/QwenLM/Qwen3) 官方 README 的 Finetuning 章节全文（作者 Qwen 团队，Apache 2.0；框架选择补充说明与 ms-swift stage 细节为编者注）。导语与各节衔接为本篇编者注，不属原文。
