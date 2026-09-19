---
title: 训练超参与过拟合诊断：学习率、秩与 loss 曲线判读
source_url: https://huggingface.co/docs/trl/lora_without_regret
author: Hugging Face（TRL 文档，基于 Thinking Machines Lab《LoRA Without Regret》）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: TRL（2026-09 主分支文档）/ SFTConfig 现行 API
order: 9
group: 训练
---
微调调的是什么超参？学习率、epoch、batch size、LoRA 秩……它们互相纠缠，网上建议互相矛盾。这份 TRL 官方指南把《LoRA Without Regret》的核心结论翻译成了可复现的配置：**配置正确的 LoRA 可以追平全参微调（Full Fine-Tuning，FullFT），而只花约 67% 的算力**。

## LoRA 相比全参微调的好处

LoRA 在基座模型之上添加适配器层，其参数量远小于基座本身，从而降低 GPU 显存需求、提升训练效率。人们曾认为 LoRA 存在性能折损，但研究表明：**精心配置可以消除这一折损，追平全参微调**。

## 在 TRL 中复现实验

### SFT（有监督微调）

按博客的实验设置，在以下模型与数据集组合上做 SFT：Llama-3.2-1B-Instruct / Llama-3.1-8B-Instruct × tulu-3-sft-mixture / OpenThoughts-114k。Python API 写法：

```python
from datasets import load_dataset
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig

dataset = load_dataset("open-thoughts/OpenThoughts-114k", split="train")

peft_config = LoraConfig(r=256, lora_alpha=16, target_modules="all-linear")

training_args = SFTConfig(
    learning_rate=2e-4,
    per_device_train_batch_size=1,
    gradient_accumulation_steps=4,
    num_train_epochs=1,
    report_to=["trackio"],
)

trainer = SFTTrainer(
    model="Qwen/Qwen2.5-3B-Instruct",
    train_dataset=dataset,
    peft_config=peft_config,
    args=training_args,
)

trainer.train()
```

也可以用命令行脚本（本地或 Hugging Face Jobs）：

```bash
uv run "https://raw.githubusercontent.com/huggingface/trl/main/trl/scripts/sft.py" \
    --model_name_or_path Qwen/Qwen2.5-3B-Instruct \
    --dataset_name open-thoughts/OpenThoughts-114k \
    --learning_rate 2.0e-5 \
    --num_train_epochs 1 \
    --packing \
    --per_device_train_batch_size 2 \
    --gradient_accumulation_steps 16 \
    --use_peft \
    --lora_r 256 \
    --lora_alpha 16 \
    --lora_target_modules all-linear \
    --output_dir Qwen2.5-3B-OpenThoughts-LoRA \
    --report_to trackio
```

训练启动后，可以在 Trackio 中监控进度与学习曲线。

## 优化 LoRA 的四个关键发现

### 1. LoRA 应用到所有权重矩阵效果更好

作者建议把 LoRA 应用到**所有权重矩阵**而不是只加在注意力层——提高秩弥补不了这个限制。只调注意力的 LoRA 即使把秩提到参数量对齐，仍然落后。TRL/PEFT 中的配置：

```python
from peft import LoraConfig

peft_config = LoraConfig(target_modules="all-linear")
```

### 2. 适配器要有足够容量去"学得动"数据集

秩决定 LoRA 适配器的可训练参数量。"对超出 LoRA 容量的数据集，LoRA 会落后于全参微调。" 博客按任务与数据规模给出了推荐秩：

**表：SFT 与 RL 的推荐 LoRA 秩**

| 任务类型 | 数据集规模 | 推荐秩 |
| --- | --- | --- |
| **SFT** | 后训练规模（Post-training scale） | 256 |
| **RL** | 任意规模 | 1–32 |

RL 任务通常只需要较低容量：策略梯度算法每轮（episode）大约只提取约 1 bit 信息，对参数容量需求很小。

### 3. 全参微调与高秩 LoRA 的学习曲线相似——但学习率要更大

反直觉的一点：LoRA 应该使用比全参微调**更高**的学习率。上文的复现实验中 LoRA 用 `1.0e-5`，全参用 `1.0e-6`。原因是 LoRA 前向中的 `1/r` 缩放使最优学习率近似与秩无关。TRL 脚本中用 `--learning_rate` 设置。

### 4. LoRA 对大 batch 更敏感

作者发现 LoRA 对大 batch size 的容忍度低于全参微调，且无法靠提高秩缓解，建议**有效 batch size < 32**（`per_device_train_batch_size × gradient_accumulation_steps`）。

### 复现验证：奖励曲线与显存

TRL 团队用 SmolLM3-3B 在 OpenR1-Math-220k 数据集上（RL/GRPO 任务，LoRA `r=1`、学习率 `1.0e-5`；全参学习率 `1.0e-6`）训练 500 步复现了博客结论：LoRA 模型的平均训练奖励曲线与全参微调曲线重合，而显存占用显著更低。也就是说，用上述四条配置，你可以以全参微调的性能、远低于它的成本完成训练。

## loss 曲线判读与过拟合诊断（编者补充）

有了超参，还要会看训练曲线。微调日志里最值得盯的是这三条：

**1. 训练 loss 与验证 loss 的"剪刀差"。** 健康的训练：两条曲线同步下降，随后趋于平缓。过拟合（Overfitting）的典型形态：训练 loss 继续下降、验证 loss 触底回升——两线张开即"剪刀差"。处理顺序：减 epoch（或早停）→ 增数据/增强多样性 → 加 dropout/减 LoRA 秩 → 缩学习率。

**2. 选 checkpoint 不选"最后一个"。** 验证 loss 最低的检查点通常出现在训练结束之前。保留多个 checkpoint（`save_steps`/`save_total_limit`），用验证集（或下游任务评测）挑一个，而不是盲信最后一步——这也是 generative-ai-for-beginners 课程强调的最佳实践。

**3. 常见曲线形态速查：**

**表：训练曲线形态与处置**

| 曲线形态 | 诊断 | 处置 |
| --- | --- | --- |
| loss 一路平线不降 | 学习率太小 / 数据或标签有误 / 学习率预热未结束 | 提学习率 3–10 倍；抽查样本与标签 |
| loss 剧烈震荡、偶有尖峰 | 学习率太大 / batch 太小 / 数据里混入脏样本 | 降学习率；增大有效 batch；梯度裁剪；清洗数据 |
| 训练降、验证升 | 过拟合 | 早停、减 epoch、增数据、降秩、加正则 |
| 训练与验证都停在高位高位震荡 | 欠拟合 / 容量不足 | 提高秩（SFT 建议 256）、all-linear、加长训练 |
| loss 先升后骤降 | 预热（warmup）机制正常工作 | 无需处理 |

其他实用指标：`mean_token_accuracy`（SFT 时 token 级准确率，比 loss 更直观）、`grad_norm`（裁剪前梯度范数，长期 >1 说明学习率偏大）、DPO 的 `rewards/accuracies` 与 `rewards/margins`（见 [DPO 与偏好优化](./13-dpo-preference-optimization)）。

## 超参速查表（编者注）

**表：微调超参推荐起点（7B 级模型，单卡/少卡）**

| 超参 | LoRA SFT | QLoRA SFT | 全参 SFT | LoRA DPO |
| --- | --- | --- | --- | --- |
| 学习率 | 1e-4 ~ 2e-4 | 1e-4 ~ 2e-4 | 1e-5 ~ 2e-5 | 5e-6 ~ 1e-5 |
| 有效 batch size | < 32（建议 8–16） | 8–16 | 32–128 | 8–32 |
| epoch | 1–3 | 1–3 | 1–2 | 1 |
| LoRA 秩 | 256（all-linear） | 64–256 | — | 16–64 |
| lora_alpha | 16–32 | 16–32 | — | 16–32 |

记住口径：这些是"起点"而非"答案"——先跑通，再按曲线微调；每改一个变量跑一次对照，别一次改三个。

## 小结

- LoRA 配置正确可追平全参微调：all-linear + 足够秩（SFT 256 / RL 1–32）+ 更高学习率 + 有效 batch < 32。
- 过拟合的判据是训练/验证 loss 的剪刀差；选 checkpoint 以验证指标为准。
- 调参方法论：一次一个变量、小规模快跑、先看曲线再下结论。

---

> **来源**：本文翻译自 [LoRA Without Regret（TRL 官方指南）](https://huggingface.co/docs/trl/lora_without_regret)，作者 Hugging Face（TRL 文档，基于 Thinking Machines Lab（Schulman et al., 2025）的研究），许可 Apache 2.0。抓取于 2026-09-13。"loss 曲线判读与过拟合诊断"一节为编者补充，已显式标注。
