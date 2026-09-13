---
title: QLoRA 与显存优化：单卡微调大模型
source_url: https://huggingface.co/docs/peft/developer_guides/quantization
author: Hugging Face（PEFT 文档）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 5
versions: PEFT ≥0.15 / transformers（BitsAndBytesConfig 现行 API）/ bitsandbytes（2026-09）
---

QLoRA（Quantized LoRA）回答的是一个问题：**怎么在一张消费级 GPU 上微调一个几十亿参数的模型**。答案是"4-bit 量化底座 + LoRA 旁路"——本文译自 PEFT 官方文档，给出完整的可运行配置。

## bitsandbytes 提供了什么（背景）

[bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) 通过 k-bit 量化让大语言模型变得触手可及，为大幅降低推理与训练内存提供了三大特性：

- **8-bit 优化器**：使用分块量化（Block-wise Quantization），以极小的内存代价维持 32-bit 优化器性能。
- **LLM.int8()（8-bit 量化）**：所需内存减半即可运行大模型推理且无性能损失。该方法基于向量级量化（Vector-wise Quantization），把大多数特征量化到 8-bit，而离群值（Outliers）单独用 16-bit 矩阵乘法处理。
- **QLoRA（4-bit 量化）**：把模型量化到 4-bit，再插入少量可训练的低秩适应（LoRA）权重，从而支持大模型训练而不牺牲性能。

库中通过 `bitsandbytes.nn.Linear8bitLt` 与 `bitsandbytes.nn.Linear4bit` 提供 8-bit/4-bit 算子，通过 `bitsandbytes.optim` 模块提供 8-bit 优化器。系统要求：Python 3.10+，PyTorch 2.4+。

## 量化 + PEFT：为什么能组合

量化（Quantization）用更少的比特表示数据，是降低内存占用、加速推理的有效手段，对大语言模型尤其如此。常见的量化方式包括：

- 用 [AWQ](https://hf.co/papers/2306.00978) 算法优化选择量化哪些模型权重
- 用 [GPTQ](https://hf.co/papers/2210.17323) 算法逐行独立量化权重矩阵
- 用 [bitsandbytes](https://github.com/TimDettmers/bitsandbytes) 库量化到 8-bit 与 4-bit 精度
- 用 [AQLM](https://huggingface.co/papers/2401.06118) 算法量化到低至 2-bit 的精度

模型量化之后通常不会再继续训练——因为权重与激活的精度降低会让训练不稳定。但 **PEFT 方法只添加"额外的"可训练参数**，这让你可以在量化模型之上训练 PEFT 适配器！把量化与 PEFT 组合，是在单张 GPU 上训练最大模型的良策。例如 [QLoRA](https://hf.co/papers/2305.14314) 先把模型量化到 4-bit，再用 LoRA 训练——**它让你能在一张 48GB GPU 上微调 65B 参数的模型**。

本指南演示如何把模型量化到 4-bit 并用 LoRA 训练。

## 量化模型

bitsandbytes 是一个与 Transformers 深度集成的量化库。通过配置 `BitsAndBytesConfig`，你可以把模型量化到 8-bit 或 4-bit，并启用许多其他选项。例如：

- 设 `load_in_4bit=True`，在加载模型时就量化到 4-bit
- 设 `bnb_4bit_quant_type="nf4"`，对从正态分布初始化的权重使用专用的 4-bit 数据类型 NF4（NormalFloat4）
- 设 `bnb_4bit_use_double_quant=True`，使用嵌套量化方案，对已量化的权重再量化一次（进一步压缩量化常数）
- 设 `bnb_4bit_compute_dtype=torch.bfloat16`，用 bfloat16 加快计算

```python
import torch
from transformers import BitsAndBytesConfig

config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
    bnb_4bit_compute_dtype=torch.bfloat16,
)
```

把 `config` 传给 `AutoModelForCausalLM.from_pretrained`：

```python
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("mistralai/Mistral-7B-v0.1", quantization_config=config)
```

接下来，调用 `prepare_model_for_kbit_training` 函数，对量化模型做训练前预处理（如冻结部分层、启用输入梯度检查点等）：

```python
from peft import prepare_model_for_kbit_training

model = prepare_model_for_kbit_training(model)
```

量化模型就绪后，配置 LoRA。

## LoraConfig

创建一个 `LoraConfig`（参数可以自选）：

```python
from peft import LoraConfig

config = LoraConfig(
    r=16,
    lora_alpha=8,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)
```

然后使用 `get_peft_model` 从量化模型与配置创建 `PeftModel`：

```python
from peft import get_peft_model

model = get_peft_model(model, config)
```

至此就可以用你喜欢的任何训练方式开始训练了（配合 TRL 的 `SFTTrainer` 只需把 `peft_config` 传入即可，见本模块 [PEFT/TRL 实战](./09-trl-sft-practice)）。

### QLoRA 风格的 target_modules

QLoRA 论文的做法是给 Transformer 架构中的**所有线性层**添加可训练权重。由于不同架构的线性层属性名不同，把 `target_modules` 设为 `"all-linear"` 即可给所有线性层加 LoRA：

```python
config = LoraConfig(target_modules="all-linear", ...)
```

### LoftQ 初始化（可选优化）

[LoftQ](https://hf.co/papers/2310.08659) 通过特殊的 LoRA 权重初始化来最小化量化误差，训练量化模型时可以提升表现。要点：

- 让 LoRA 覆盖尽可能多的层（`target_modules="all-linear"`），因为未覆盖的层无法应用 LoftQ。
- 4-bit 量化时配合 `bnb_4bit_quant_type="nf4"` 使用。

最省事的接入方式是 `replace_lora_weights_loftq`：输入量化后的 PEFT 模型，就地用 LoftQ 初始化值替换 LoRA 权重：

```python
from peft import replace_lora_weights_loftq
from transformers import BitsAndBytesConfig

bnb_config = BitsAndBytesConfig(load_in_4bit=True, ...)
base_model = AutoModelForCausalLM.from_pretrained(..., quantization_config=bnb_config)
# 注意：不要传 init_lora_weights="loftq" 或 loftq_config！
lora_config = LoraConfig(task_type="CAUSAL_LM")
peft_model = get_peft_model(base_model, lora_config)
replace_lora_weights_loftq(peft_model)
```

该函数只执行 LoftQ 的一次迭代（只更新 LoRA 权重），性能可能略低于完整迭代版，但优点是可以直接使用原始量化权重，无需额外保存一份修改过的量化权重。当前限制：模型文件必须是 `safetensors` 格式，且只支持 bitsandbytes 4-bit 量化。

## 其他可与 LoRA 组合的量化方案

PEFT 的量化指南还覆盖了以下方案（均可在量化模型上训练 LoRA 适配器）：

| 方案 | 精度 | 要点 |
| --- | --- | --- |
| GPTQ（经 GPTQModel） | 2/3/4/8-bit | 逐行量化；`pip install "gptqmodel>=7.0.0"` 后经 `GPTQConfig` 加载 |
| AQLM | 低至 2-bit | 多权重联合量化；量化过程昂贵，推荐直接用预量化模型；适配器不能合并回权重 |
| EETQ | 8-bit | 号称比 LLM.int8() 更快的 8-bit 方案 |
| HQQ | 4-bit 等 | 半二次方量化，免校准数据、量化速度快 |
| torchao | int8 等 | PyTorch 官方量化库；目前仅支持线性层，且仅 `int8_weight_only` 可安全合并 |
| INC（Intel Neural Compressor） | FP8 | 面向 Intel Gaudi（HPU）设备 |

::: warning 注意
除 LoRA 外，VeRA、AdaLoRA、(IA)³ 等方法也支持部分量化方案；但**合并（merge）与反合并（unmerge）在多数量化后端上不可用或结果不正确**——部署量化+LoRA 训练的模型时，要么保留 adapter 分离加载，要么用支持合并的后端（如 bitsandbytes 的特定配置）。以各后端文档为准。
:::

## 显存账单（编者注）

以 7B 模型、bf16 混合精度、AdamW 为例（估算口径见 [GPU 环境基础](./02-gpu-environment-basics)）：

| 方案 | 权重显存 | 优化器/梯度 | 合计（约） | 单卡可行性 |
| --- | --- | --- | --- | --- |
| 全参微调 | 14 GB | ~35 GB（fp32 副本 + 动量 + 梯度） | 50 GB+ | A100 80G 或多卡 ZeRO |
| LoRA（bf16 底座） | 14 GB | <1 GB | 15 GB+激活 | 24 GB 卡可跑 |
| QLoRA（NF4 底座） | 3.5–4.5 GB | <1 GB | 5 GB+激活 | 12–16 GB 卡可跑 7B；65B 需 48 GB |

组合拳的优先级：**QLoRA（NF4 + 双重量化 + all-linear LoRA）→ gradient checkpointing → 减小 batch size / 缩短序列 → 8-bit 优化器**。推理部署侧的量化格式（GPTQ/AWQ/GGUF/FP8）与本篇训练侧量化是两套体系，见 [模型量化基础](./11-quantization-basics)。

## 小结

- QLoRA = 4-bit 量化底座（NF4 + 双重量化 + bf16 计算）+ LoRA 旁路，训练只更新 LoRA 参数，绕开了"量化模型不可训练"的问题。
- 三行配置即可用上：`BitsAndBytesConfig` → `prepare_model_for_kbit_training` → `LoraConfig`。
- 追求贴近 QLoRA 论文效果时用 `target_modules="all-linear"`，必要时加 LoftQ 初始化。
- 训练侧量化（QLoRA）与部署侧量化（GPTQ/AWQ/GGUF/FP8）目标不同：前者省训练显存，后者省推理显存与带宽。

---

> **来源**：本文翻译自 [Quantization（PEFT 官方文档 Quantization 指南）](https://huggingface.co/docs/peft/developer_guides/quantization)，作者 Hugging Face（PEFT 文档），许可 Apache 2.0。抓取于 2026-09-13。开头一节补充翻译自 [bitsandbytes README](https://github.com/bitsandbytes-foundation/bitsandbytes)（Apache 2.0），编者补充内容均已标注。
