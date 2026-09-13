---
title: DPO 与偏好优化：TRL DPOTrainer 实践
source_url: https://huggingface.co/docs/trl/dpo_trainer
author: Hugging Face（TRL 文档）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 10
versions: TRL（2026-09 主分支文档，DPOTrainer/DPOConfig 现行 API）
---

## 为什么需要偏好对齐（happy-llm）

Pretrain 更关注语言规律和世界知识的学习，SFT 更关注让模型学会遵循指令，而偏好对齐则更强调"什么样的回答更符合人类预期"。例如，在问答、代码生成或复杂推理任务中，模型不仅要给出答案，还要尽量做到表达清晰、内容安全、推理过程稳定，并尽量避免答非所问或有害输出。从训练流程上看，偏好对齐承接在 SFT 之后，是 Post-Training 中非常关键的一环。其核心思路不是让模型继续单纯地拟合文本，而是让模型学会在多个候选回答之间更偏向人类更喜欢的输出。

DPO（Direct Preference Optimization，直接偏好优化）是当下最常用的偏好对齐算法。下面进入 TRL 官方文档。

## 概述

TRL 支持用于训练语言模型的 DPO Trainer，对应论文 [Direct Preference Optimization: Your Language Model is Secretly a Reward Model](https://huggingface.co/papers/2305.18290)（Rafael Rafailov 等）。

论文摘要（节译）：虽然大规模无监督语言模型学到了广泛的世界知识与推理技能，但其训练的完全无监督性质使精确控制模型行为非常困难。现有方法收集人类对模型生成质量相对高低的标注，再用 RLHF 微调模型以对齐偏好——但 RLHF 是一个复杂且常常不稳定的过程：先拟合一个反映人类偏好的奖励模型，再用强化学习微调大型无监督 LM 以最大化该估计奖励，同时不偏离原模型太远。本文提出 RLHF 中奖励模型的一种新参数化，能以闭式解提取最优策略，从而**只需一个简单的分类损失即可求解标准 RLHF 问题**。所得算法 DPO 稳定、高性能、计算轻量，免去了微调期间从 LM 采样与大量超参调优。实验表明 DPO 的对齐效果不输现有方法：在控制生成情感上超过基于 PPO 的 RLHF，在摘要与单轮对话上持平或更好，而实现与训练大幅简化。

## 快速开始

用 `DPOTrainer` 在 [UltraFeedback 数据集](https://huggingface.co/datasets/openbmb/UltraFeedback)上训练 Qwen3 0.6B：

```python
from trl import DPOTrainer
from datasets import load_dataset

trainer = DPOTrainer(
    model="Qwen/Qwen3-0.6B",
    train_dataset=load_dataset("trl-lib/ultrafeedback_binarized", split="train"),
)
trainer.train()
```

## 期望的数据集类型与格式

DPO 需要[偏好（preference）数据集](./06-training-data-preparation)：同一条提示的两个补全，一个偏好（`chosen`）、一个被拒（`rejected`）。兼容标准与对话两种格式：

```python
# 标准格式
## 显式提示（推荐）
preference_example = {"prompt": "The sky is", "chosen": " blue.", "rejected": " green."}
## 隐式提示
preference_example = {"chosen": "The sky is blue.", "rejected": "The sky is green."}

# 对话格式
## 显式提示（推荐）
preference_example = {"prompt": [{"role": "user", "content": "What color is the sky?"}],
                      "chosen": [{"role": "assistant", "content": "It is blue."}],
                      "rejected": [{"role": "assistant", "content": "It is green."}]}
```

数据格式不符时先做预处理转换，以 [Vezora/Code-Preference-Pairs](https://huggingface.co/datasets/Vezora/Code-Preference-Pairs) 为例：

```python
from datasets import load_dataset

dataset = load_dataset("Vezora/Code-Preference-Pairs")

def preprocess_function(example):
    return {
        "prompt": [{"role": "user", "content": example["input"]}],
        "chosen": [{"role": "assistant", "content": example["accepted"]}],
        "rejected": [{"role": "assistant", "content": example["rejected"]}],
    }

dataset = dataset.map(preprocess_function, remove_columns=["instruction", "input", "accepted", "ID"])
```

## 深入 DPO 方法

DPO 用偏好数据对齐语言模型：不再用有监督的输入-输出对，而是在同一提示的两个补全对上训练——直接优化模型**拉大偏好补全与被拒补全的对数似然差**（相对于参考模型），无需显式奖励模型。实践中，这通常是通过**压低被拒补全的似然**实现的，而不是抬高偏好补全。

### 计算 loss

DPO 损失定义为：

```text
L_DPO(θ) = -E_(x,y+,y-) [ log σ( β · ( log π_θ(y+|x)/π_ref(y+|x) − log π_θ(y-|x)/π_ref(y-|x) ) ) ]
```

其中 `x` 为提示，`y+` 为偏好补全，`y-` 为被拒补全；`π_θ` 是被训练的策略模型，`π_ref` 是参考模型（通常就是 SFT 后的初始模型，冻结不动），`σ` 是 sigmoid 函数，`β > 0` 控制偏好信号强度的超参数。

### loss 变体（loss_type）

文献中提出了多种目标函数变体，`DPOConfig` 的 `loss_type` 参数可选。常用的几个：

**表：DPO loss_type 速查（节选）**

| `loss_type=` | 说明 |
| --- | --- |
| `"sigmoid"`（默认） | 原版 DPO：按 Bradley-Terry 模型拟合二元分类器，对归一化似然做 logsigmoid。 |
| `"hinge"` | RSO/SLiC 提出的 hinge 损失，此时 `beta` 为 margin 的倒数。 |
| `"ipo"` | IPO 认为对数变换可能过拟合，改用恒等变换直接优化偏好。 |
| `"robust"` | 噪声偏好下的无偏 DPO（cDPO），用 `label_smoothing` 建模标签翻转概率，取值 `[0.0, 0.5)`。 |
| `"bco_pair"` | BCO：训练二元分类器，其 logit 作为奖励，适合非配对数据（推荐直接用 BCOTrainer）。 |
| `"sigmoid_norm"` | SimPO：按非遮蔽 token 数归一化，解决原版 sigmoid 损失的长度偏差。 |
| `"sft"` | 即 NLL 损失，训练模型生成偏好回复（常与其他 loss 组合使用）。 |
| `"apo_zero"` / `"apo_down"` | APO 锚定目标：zero 抬高胜者压低败者（模型不如胜者时用）；down 两者同压、败者压得更狠（模型已胜过胜者时用）。 |

## 记录的指标

除常规的 `loss`、`learning_rate`、`grad_norm`、`mean_token_accuracy` 外，DPO 特有的关键指标：

- `logits/chosen`、`logits/rejected`：模型给偏好/被拒补全 token 的平均 logit。
- `logps/chosen`、`logps/rejected`：偏好/被拒补全的平均对数概率。
- `rewards/chosen`、`rewards/rejected`：隐式奖励，即 `β·log(π_θ/π_ref)`。
- `rewards/margins`：偏好与被拒补全之间的隐式奖励差（margin 应稳步变大）。
- `rewards/accuracies`：偏好补全的隐式奖励高于被拒补全的样本比例——**这是 DPO 最该盯的指标**。

## 定制化

### 多损失组合

DPO trainer 支持以不同权重组合多个损失，可实现 MPO（Mixed Preference Optimization）等算法：

```python
# MPO：偏好用 DPO(sigmoid)，质量用 BCO(bco_pair)，权重取自 MPO 论文
training_args = DPOConfig(
    loss_type=["sigmoid", "bco_pair", "sft"],
    loss_weights=[0.8, 0.2, 1.0]
)
```

### 模型初始化与 PEFT

与 `SFTTrainer` 一致：`model_init_kwargs` 支持所有 `from_pretrained` 参数；`peft_config` 一行切到 LoRA 训练：

```python
from datasets import load_dataset
from trl import DPOTrainer
from peft import LoraConfig

dataset = load_dataset("trl-lib/ultrafeedback_binarized", split="train")

trainer = DPOTrainer(
    "Qwen/Qwen3-0.6B",
    train_dataset=dataset,
    peft_config=LoraConfig(),
)

trainer.train()
```

::: tip DPO 的学习率更小
DPO 训练适配器时学习率约 1e-5——比 SFT 的 1e-4 低一个量级。DPO 训练过猛的典型症状是偏好补全的对数概率也一起塌缩（`logps/chosen` 大幅下降），输出开始"变怪"。
:::

### 兼容性约束（节选）

`sync_ref_model=True`（参考模型滑动同步）不能与 `precompute_ref_log_probs=True` 同用；`precompute_ref_log_probs=True` 不支持 `IterableDataset`；使用 Liger Kernel 时只支持单一 `loss_type` 且不支持 `compute_metrics`。完整列表见原文档。

### Liger Kernel / Unsloth / RapidFire

与 SFTTrainer 相同，DPOTrainer 也支持 Liger Kernel（多卡吞吐 +20%、显存 -60%）、Unsloth（2 倍速、省 70% 显存）与 RapidFire AI（多配置并行实验）。

## 工具调用与 VLM

`DPOTrainer` 完整支持工具调用微调（数据需含 `tool_calls` 消息与 `tools` 列）与 VLM 训练（提供 `image`/`images` 列；同样注意截断会截掉图像 token，未确认前设 `max_length=None`）。例如用 RLAIF-V 数据集训练 Qwen2.5-VL-3B-Instruct。

## 实践清单（编者注）

- **DPO 之前必须先有 SFT**：参考模型 `π_ref` 就是 SFT 模型，DPO 是在它之上做偏好修正，不是从 base 模型直接起步。
- **数据质量 > 数量**：chosen/rejected 差距要真实、可区分；用大模型打分构建偏好对时（RLAIF）注意分数偏差，必要时加 `label_smoothing`（`loss_type="robust"`）。
- **盯三条曲线**：`rewards/accuracies` 上升、`rewards/margins` 扩大、`logps/chosen` 不塌缩。chosen 概率明显下滑时减学习率或减 epoch。
- **β 的直觉**：偏小（如 0.1）时更新更激进、易偏离参考模型；偏大（如 0.5）更保守。默认 0.1 起步。
- 其他偏好算法路线：ORPO（免参考模型，SFT+对齐合一）、KTO（非配对数据）、SimPO（长度归一化），TRL 均有对应 Trainer；从 DPO 入门再按数据形态扩展。

## 小结

- DPO 把 RLHF 的"奖励模型 + 强化学习"折叠成一个分类损失：拉大 chosen/rejected 相对参考模型的似然差。
- 数据就是"提示 + 好答案 + 差答案"三元组；显式提示列是推荐写法。
- 实战配置：SFT 起点 + LoRA + 学习率约 1e-5 + 默认 sigmoid loss；盯 `rewards/accuracies` 与 `logps/chosen`。

---

> **来源**：本文翻译自 [DPO Trainer（TRL 官方文档）](https://huggingface.co/docs/trl/dpo_trainer)，作者 Hugging Face（TRL 文档），许可 Apache 2.0。抓取于 2026-09-13。开头"为什么需要偏好对齐"一节转载自 [happy-llm 第六章 6.4](https://github.com/datawhalechina/happy-llm)（CC BY-NC-SA 4.0），已标注。
