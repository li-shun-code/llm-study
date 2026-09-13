---
title: PEFT/TRL 实战：SFTTrainer 做有监督微调
source_url: https://huggingface.co/docs/trl/sft_trainer
author: Hugging Face（TRL 文档）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 10
versions: TRL（2026-09 主分支文档，SFTTrainer/SFTConfig 现行 API）
---

原理已在前面几篇铺垫完毕：SFT 学什么（[训练范式回顾](./03-training-paradigms-full-finetuning)）、数据什么格式（[数据准备](./06-training-data-preparation)）、超参怎么给（[超参与过拟合](./09-hyperparams-overfitting)）。这篇进入实战：用 TRL 的 `SFTTrainer`，十几行代码完成一次有监督微调。

## 概述

TRL 支持用于训练语言模型的有监督微调（SFT）Trainer。该后训练方法由 Younes Belkada 贡献。

## 快速开始

下面的例子演示如何用 TRL 的 `SFTTrainer` 训练语言模型：在 [Capybara 数据集](https://huggingface.co/datasets/trl-lib/Capybara)（一个紧凑、多样的多轮对话数据集）上训练 [Qwen3 0.6B](https://huggingface.co/Qwen/Qwen3-0.6B)：

```python
from trl import SFTTrainer
from datasets import load_dataset

trainer = SFTTrainer(
    model="Qwen/Qwen3-0.6B",
    train_dataset=load_dataset("trl-lib/Capybara", split="train"),
)
trainer.train()
```

注意 `SFTTrainer` 自动完成了：数据集格式识别、chat template 应用、tokenize、loss 计算。你需要给的就是模型名 + 数据集。

## 期望的数据集类型与格式

SFT 支持[语言建模](./06-training-data-preparation)与[提示-补全](./06-training-data-preparation)两类数据，同时兼容标准与对话两种格式。提供对话数据集时，Trainer 会自动应用 chat template：

```python
# 标准格式 · 语言建模
{"text": "The sky is blue."}

# 对话格式 · 语言建模
{"messages": [{"role": "user", "content": "What color is the sky?"},
              {"role": "assistant", "content": "It is blue."}]}

# 标准格式 · 提示-补全
{"prompt": "The sky is",
 "completion": " blue."}

# 对话格式 · 提示-补全
{"prompt": [{"role": "user", "content": "What color is the sky?"}],
 "completion": [{"role": "assistant", "content": "It is blue."}]}
```

如果数据集不是以上格式，先预处理转换。以 [FreedomIntelligence/medical-o1-reasoning-SFT](https://huggingface.co/datasets/FreedomIntelligence/medical-o1-reasoning-SFT) 数据集为例：

```python
from datasets import load_dataset

dataset = load_dataset("FreedomIntelligence/medical-o1-reasoning-SFT", "en")

def preprocess_function(example):
    return {
        "prompt": [{"role": "user", "content": example["Question"]}],
        "completion": [
            {"role": "assistant", "content": f"<think>{example['Complex_CoT']}</think>{example['Response']}"}
        ],
    }

dataset = dataset.map(preprocess_function, remove_columns=["Question", "Response", "Complex_CoT"])
print(next(iter(dataset["train"])))
```

## 深入 SFT 方法

有监督微调（SFT）是把语言模型适配到目标数据集上最简单、最常用的方法：以完全有监督的方式，用输入/输出序列对训练模型，目标是最小化目标序列在给定输入条件下的负对数似然（NLL）。关键步骤：**预处理**、**tokenize** 与 **loss 计算**。

### 预处理与 tokenize

训练时每个样本应包含**文本字段**或 **(prompt, completion) 对**。`SFTTrainer` 用模型的 tokenizer 对每个输入做 tokenize；若 prompt 与 completion 分别提供，会先拼接再 tokenize。

### 计算 loss

SFT 使用 **token 级交叉熵损失（Cross-Entropy Loss）**：

```text
L_SFT(θ) = - Σ_t log p_θ( y_t | y_<t )
```

其中 `y_t` 是时刻 `t` 的目标 token——模型训练"给定前面所有 token 预测下一个"。实践中，填充（padding）token 会在 loss 计算中被遮蔽。

::: tip 默认 loss 与两个进阶选项
- 默认 `loss_type="chunked_nll"`：数学上与 `"nll"` 相同，但 `lm_head` 投影会跳过被忽略的标签 token，且交叉熵分块处理，峰值激活显存不再随"词表 × 序列长度"的 logits 张量膨胀（想回退标准路径设 `loss_type="nll"`）。
- 论文《On the Generalization of SFT》提出 **DFT（Dynamic Fine-Tuning）**损失，通过校正奖励信号改善泛化：`SFTConfig` 中设 `loss_type="dft"` 即可启用。
:::

### 标签偏移与遮蔽

训练时 loss 用**一位偏移（one-token shift）**计算：模型基于序列中所有前序 token 预测每个 token——具体地，输入序列右移一位构成目标标签。填充 token 通过忽略索引（默认 `-100`）被排除在 loss 之外，确保 loss 只关注有意义的非填充 token。

## 记录的指标

训练与评估时记录：`global_step`（累计优化器步数）、`epoch`、`num_tokens`（已处理 token 总数）、`loss`（当前日志区间内非遮蔽 token 的平均交叉熵）、`entropy`（预测分布平均熵）、`mean_token_accuracy`（top-1 预测命中率，比 loss 更直观）、`learning_rate`（学习率，可能随调度器动态变化）、`grad_norm`（裁剪前梯度 L2 范数）；MoE 模型还会记录 `aux_loss`（负载均衡辅助损失）。

## 定制化

### 模型初始化

`AutoModelForCausalLM.from_pretrained()` 的所有关键字参数都可以经 `SFTConfig` 传入。例如以 bfloat16 精度加载：

```python
from trl import SFTConfig

training_args = SFTConfig(
    model_init_kwargs={"dtype": torch.bfloat16},
)
```

### 打包（Packing）

`SFTTrainer` 支持**样本打包**：把多个样本拼进同一条输入序列以提升训练效率。在 `SFTConfig` 中传 `packing=True` 即可：

```python
training_args = SFTConfig(packing=True)
```

### 只对 assistant 消息计算 loss

使用对话数据集并设 `assistant_only_loss=True`：loss **只**在助手回复上计算，忽略用户/系统消息——这正是 [happy-llm 手写流程](./03-training-paradigms-full-finetuning)中 label 遮蔽逻辑的内置版：

```python
training_args = SFTConfig(assistant_only_loss=True)
```

::: warning
此功能要求 chat template 包含 `{% generation %}` / `{% endgeneration %}` 关键字。对已知模型家族（如 Qwen3），TRL 会在 `assistant_only_loss=True` 时自动打补丁；其他模型请检查模板。
:::

### 只对 completion 计算 loss

使用提示-补全数据集时，Trainer 默认只对 completion token 计算 loss（忽略 prompt）。想对整条序列训练则设 `completion_only_loss=False`：

```python
from trl import SFTConfig, SFTTrainer
from datasets import load_dataset

# 加载提示-补全数据集；默认仅在 completion 上计算 loss
dataset = load_dataset("trl-lib/kto-mix-14k", split="train")

trainer = SFTTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",
    args=SFTConfig(completion_only_loss=True),  # 提示-补全数据集默认即为 True
    train_dataset=dataset,
)
trainer.train()
```

"只训 completion"与"只训 assistant 消息"可以叠加：用对话格式的提示-补全数据集并设 `assistant_only_loss=True`。

### 配合 PEFT 训练适配器

TRL 与 PEFT 库深度集成，让用户方便地训练适配器并分享到 Hub，而不必训练整个模型：

```python
from datasets import load_dataset
from trl import SFTTrainer
from peft import LoraConfig

dataset = load_dataset("trl-lib/Capybara", split="train")

trainer = SFTTrainer(
    "Qwen/Qwen3-0.6B",
    train_dataset=dataset,
    peft_config=LoraConfig(),
)

trainer.train()
```

也可以继续训练已有的 `PeftModel`：在 Trainer 外加载好，直接传入而不传 `peft_config`：

```python
from peft import AutoPeftModelForCausalLM

model = AutoPeftModelForCausalLM.from_pretrained("trl-lib/Qwen3-4B-LoRA", is_trainable=True)
dataset = load_dataset("trl-lib/Capybara", split="train")

trainer = SFTTrainer(model=model, train_dataset=dataset)
trainer.train()
```

::: tip 适配器要用更高的学习率
训练适配器时只学新参数，通常用更高的学习率（约 1e-4）：

```python
SFTConfig(learning_rate=1e-4, ...)
```
:::

### 其他加速与提效选项

- **Liger Kernel**：面向 LLM 训练的 Triton 内核合集，多 GPU 吞吐提升约 20%、显存降低约 60%（支持约 4 倍长上下文），与 FlashAttention、FSDP、DeepSpeed 兼容。
- **Unsloth**：开源微调/强化学习框架，最高 2 倍提速、节省 70% 显存，提供与 Hugging Face 兼容的工作流。
- **RapidFire AI**：架在 TRL 之上的实验引擎，单卡即可同时启动多个 SFT 配置，提前看到所有学习曲线、砍掉差的运行、克隆有希望的运行继续调。

## 指令微调示例

**指令微调（Instruction Tuning）**把基座模型改造成能遵循指令、进行对话的模型。这需要：**chat template**（定义如何把对话结构化为文本序列，含角色标记、特殊 token、轮次边界）与**对话数据集**（指令-回复对）。

下面的例子把 [Qwen3 0.6B Base](https://huggingface.co/Qwen/Qwen3-0.6B-Base) 变成指令跟随模型——用 Capybara 数据集 + SmolLM3-3B 的 chat template：

```python
from trl import SFTConfig, SFTTrainer
from datasets import load_dataset

trainer = SFTTrainer(
    model="Qwen/Qwen3-0.6B-Base",
    args=SFTConfig(
        output_dir="Qwen3-0.6B-Instruct",
        chat_template_path="HuggingFaceTB/SmolLM3-3B",
    ),
    train_dataset=load_dataset("trl-lib/Capybara", split="train"),
)
trainer.train()
```

::: warning
某些基座模型（如 Qwen）的 tokenizer 自带预定义 chat template——此时无需额外套模板，但必须**把 EOS token 与模板对齐**以保证模型回复正确终止。例如对 `Qwen/Qwen2.5-1.5B` 应设 `eos_token="<|im_end|>"`。
:::

训完即可用新模板对话：

```python
>>> from transformers import pipeline
>>> pipe = pipeline("text-generation", model="Qwen3-0.6B-Instruct/checkpoint-5000")
>>> prompt = [{"role": "user", "content": "What is the capital of France? Answer in one word."}]
>>> response = pipe(prompt)
>>> response[0]["generated_text"]
[{'role': 'user', 'content': 'What is the capital of France? Answer in one word.'},
 {'role': 'assistant', 'content': 'The capital of France is Paris.'}]
```

## 工具调用 SFT 与 VLM 训练

`SFTTrainer` 完整支持**工具调用**微调：数据集每条样本需包含带 `tool_calls` 的对话消息与 `tools` 列（JSON Schema，格式见 [数据准备](./06-training-data-preparation)）。也完整支持**视觉语言模型（VLM）**训练：提供 `image`/`images` 列即可，例如用 LLaVA Instruct Mix 训练 Qwen2.5-VL-3B-Instruct：

```python
from trl import SFTConfig, SFTTrainer
from datasets import load_dataset

trainer = SFTTrainer(
    model="Qwen/Qwen2.5-VL-3B-Instruct",
    args=SFTConfig(max_length=None),
    train_dataset=load_dataset("trl-lib/llava-instruct-mix", split="train"),
)
trainer.train()
```

::: tip VLM 的截断陷阱
对 VLM 截断序列可能截掉图像 token，导致训练报错。确认全数据集截断安全之前，设 `max_length=None` 让模型处理完整序列。
:::

## 小结

- 最小可用 SFT = 模型名 + 对话数据集，两行配置；`SFTTrainer` 负责模板、tokenize、loss 遮蔽。
- 三个最常用的开关：`packing`（提效）、`assistant_only_loss` / `completion_only_loss`（loss 范围）、`peft_config`（LoRA + 高学习率 1e-4）。
- 基座模型 → 指令模型：`chat_template_path` 换模板 + 对齐 EOS token。
- 下一步：SFT 之后做偏好对齐，见 [DPO 与偏好优化](./11-dpo-preference-optimization)。

---

> **来源**：本文翻译自 [SFT Trainer（TRL 官方文档）](https://huggingface.co/docs/trl/sft_trainer)，作者 Hugging Face（TRL 文档），许可 Apache 2.0。抓取于 2026-09-13。文首学习路径说明为编者补充。
