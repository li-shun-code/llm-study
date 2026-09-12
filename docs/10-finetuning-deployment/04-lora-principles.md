---
title: LoRA 原理：低秩适应为什么有效
source_url: https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter6/%E7%AC%AC%E5%85%AD%E7%AB%A0%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E6%B5%81%E7%A8%8B%E5%AE%9E%E8%B7%B5.md
author: DataWhale happy-llm 项目组
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 4
versions: PEFT ≥0.15（编者注部分）
---

> **来源**：本文转载自 [第六章 6.3 高效微调（happy-llm）](https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter6/%E7%AC%AC%E5%85%AD%E7%AB%A0%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E6%B5%81%E7%A8%8B%E5%AE%9E%E8%B7%B5.md)，作者 DataWhale happy-llm 项目组，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。文末"PEFT 现状与最佳实践"一节为编者补充，已显式标注。

全参微调需要更新模型全部权重，对 7B 以上的模型来说资源压力非常大。LoRA（Low-Rank Adaptation，低秩适应）是目前高效微调 LLM 的主流方法。本文从"为什么只需要低秩更新"讲起，推导 LoRA 的数学原理，并看它的代码实现。

## 高效微调的两条路线

针对全量微调的昂贵问题，目前主要有两种解决方案：

**Adapt Tuning（适配器微调）**：在模型中添加 Adapter 层，在微调时冻结原参数，仅更新 Adapter 层。具体而言，在预训练模型每层中插入用于下游任务的 Adapter 模块，微调时冻结模型主体，仅训练特定于任务的参数。每个 Adapter 模块由两个前馈子层组成：第一个前馈子层将 Transformer 块的输出作为输入，将原始输入维度 `d` 投影到 `m`（通常 `m << d`），通过控制 `m` 的大小来限制 Adapter 模块的参数量；输出阶段由第二个前馈子层将 `m` 重新投影回 `d`。

**LoRA 事实上就是一种改进的 Adapt Tuning 方法**。但传统 Adapt Tuning 存在推理延迟问题：由于增加了额外参数和额外计算量，微调之后的模型计算速度相较原预训练模型更慢。

**Prefix Tuning（前缀微调）**：固定预训练 LM，为 LM 添加可训练、任务特定的前缀，为不同任务保存不同的前缀，微调成本也小。具体而言，在每一个输入 token 前构造一段与下游任务相关的 virtual tokens 作为 prefix，在微调时只更新 prefix 部分的参数。常用的 P-Tuning 其实就是 Prefix Tuning 的一种改进。但 Prefix Tuning 存在固定缺陷：**模型可用序列长度减少**——virtual tokens 占用了可用序列长度，越高的微调质量，模型可用序列长度就越低。

## LoRA 的出发点：本征秩

如果一个大模型是将数据映射到高维空间进行处理，那么在处理一个细分的小任务时，可能只需要在某个子空间范围内就可以解决，也就不需要对全量参数进行优化。我们可以定义：当对某个子空间参数进行优化时，能够达到全量参数优化的性能的一定水平（如 90% 精度），那么这个子空间参数矩阵的秩就可以称为对应当前待解决问题的**本征秩（Intrinsic Rank）**。

预训练模型本身就隐式地降低了本征秩。当针对特定任务进行微调后，模型中权重矩阵其实具有更低的本征秩；同时，越简单的下游任务，对应的本征秩越低（参见论文 [Intrinsic Dimensionality Explains the Effectiveness of Language Model Fine-Tuning](https://arxiv.org/abs/2012.13255)）。因此，权重更新的那部分参数矩阵尽管随机投影到较小的子空间，仍然可以有效地学习——可以理解为针对特定的下游任务，这些权重矩阵就不要求满秩。我们可以通过优化密集层在适应过程中变化的秩分解矩阵，来间接训练神经网络中的一些密集层，从而实现仅优化密集层的秩分解矩阵来达到微调效果。

例如，假设预训练参数为 `θ0^D`，在特定下游任务上密集层权重参数矩阵对应的本征秩为 `θ^d`，对应特定下游任务微调参数为 `θ^D`，那么有：

```text
θ^D = θ0^D + θ^d · M
```

这个 `M` 即为 LoRA 优化的秩分解矩阵。

相对于其他高效微调方法，LoRA 存在以下优势：

1. 可以针对不同的下游任务构建小型 LoRA 模块，从而在共享预训练模型参数基础上有效地切换下游任务。
2. LoRA 使用自适应优化器（Adaptive Optimizer），不需要计算梯度或维护大多数参数的优化器状态，训练更有效、硬件门槛更低。
3. LoRA 使用简单的线性设计，在部署时将可训练矩阵与冻结权重合并，**不存在推理延迟**。
4. LoRA 与其他方法正交，可以组合。

因此，LoRA 成为目前高效微调 LLM 的主流方法，尤其是对于资源受限、有监督训练数据受限的情况，LoRA 微调往往会成为 LLM 微调的首选方法。

## LoRA 的原理

### 低秩参数化更新矩阵

LoRA 假设权重更新的过程中也有一个较低的本征秩。对于预训练的权重参数矩阵 `W0 ∈ R^(d×k)`（`d` 为上一层输出维度，`k` 为下一层输入维度），使用低秩分解来表示其更新：

```text
W0 + ΔW = W0 + B·A，  其中 B ∈ R^(d×r)，A ∈ R^(r×k)
```

在训练过程中，`W0` 冻结不更新，`A`、`B` 包含可训练参数。`r` 就是 LoRA 的秩（rank），通常远小于 `d` 和 `k`。

因此，LoRA 的前向传递函数为：

```text
h = W0·x + ΔW·x = W0·x + B·A·x
```

在开始训练时，对 `A` 使用随机高斯初始化，对 `B` 使用零初始化（这样训练开始时 `ΔW = B·A = 0`，模型行为与原模型一致），然后使用 Adam 进行优化。

### 应用于 Transformer

在 Transformer 结构中，LoRA 技术主要应用在注意力模块的四个权重矩阵：`Wq`、`Wk`、`Wv`、`W0`（注意力输出投影），而冻结 MLP 的权重矩阵。通过消融实验发现同时调整 `Wq` 和 `Wv` 会产生最佳结果。

在上述条件下，可训练参数个数为：

```text
Θ = 2 × L_LoRA × d_model × r
```

其中，`L_LoRA` 为应用 LoRA 的权重矩阵的个数，`d_model` 为 Transformer 的输入输出维度，`r` 为设定的 LoRA 秩。一般情况下，`r` 取到 4、8、16。

## LoRA 的代码实现

目前一般通过 peft 库来实现模型的 LoRA 微调。peft 库是 Hugging Face 开发的第三方库，其中封装了包括 LoRA、Adapt Tuning、P-Tuning 等多种高效微调方法。

LoRA 微调的内部实现流程主要包括以下几个步骤：

1. **确定要使用 LoRA 的层**。peft 库目前支持调用 LoRA 的层包括：`nn.Linear`、`nn.Embedding`、`nn.Conv2d` 三种。
2. **对每一个要使用 LoRA 的层，替换为 LoRA 层**。所谓 LoRA 层，实则是在该层原结果基础上增加了一个旁路，通过低秩分解（即矩阵 `A` 和矩阵 `B`）来模拟参数更新。
3. **冻结原参数，进行微调**，更新 LoRA 层参数。

其中，确定 LoRA 层的关键参数是 `target_modules`。它一般是一个字符串列表，每一个字符串是需要进行 LoRA 的层名称，例如：

```python
target_modules = ["q_proj", "v_proj"]
```

这里的 `q_proj` 即为注意力机制中的 `Wq`，`v_proj` 即为注意力机制中的 `Wv`。在创建 LoRA 模型时，peft 会获取该参数，然后在原模型中对层名做正则匹配，找到对应的层并替换为 LoRA 层。LoRA 层的核心实现（节选）：

```python
class LoraLayer:
    def __init__(
        self,
        r: int,               # LoRA 的秩
        lora_alpha: int,      # 归一化参数
        lora_dropout: float,  # LoRA 层的 dropout 比例
        merge_weights: bool,  # eval 模式中，是否将 LoRA 矩阵的值加到原权重矩阵上
    ):
        self.r = r
        self.lora_alpha = lora_alpha
        ...

class Linear(nn.Linear, LoraLayer):
    # LoRA 层（节选）
    def __init__(self, in_features: int, out_features: int,
                 r: int = 0, lora_alpha: int = 1, lora_dropout: float = 0.0,
                 fan_in_fan_out: bool = False, merge_weights: bool = True, **kwargs):
        # 继承两个基类的构造函数
        nn.Linear.__init__(self, in_features, out_features, **kwargs)
        LoraLayer.__init__(self, r=r, lora_alpha=lora_alpha,
                           lora_dropout=lora_dropout, merge_weights=merge_weights)
        if r > 0:
            # 参数矩阵 A
            self.lora_A = nn.Linear(in_features, r, bias=False)
            # 参数矩阵 B
            self.lora_B = nn.Linear(r, out_features, bias=False)
            # 归一化系数
            self.scaling = self.lora_alpha / self.r
            # 冻结原参数，仅更新 A 和 B
            self.weight.requires_grad = False
```

替换时，直接将原层的 weight 和 bias 复制给新的 LoRA 层，再将新的 LoRA 层分配到指定设备即可。训练时前向计算对应调整为：先计算原参数与输入的乘积，再加上 A、B 分别与输入的乘积：

```python
def forward(self, x: torch.Tensor):
    ...
    elif self.r > 0 and not self.merged:
        result = F.linear(x, transpose(self.weight, self.fan_in_fan_out), bias=self.bias)
        if self.r > 0:
            result += self.lora_B(self.lora_A(self.lora_dropout(x))) * self.scaling
        return result
    ...
```

### 使用 peft 实现 LoRA 微调

peft 进行了很好的封装，支持我们便捷、高效地对大模型进行微调。首先加载所需使用库与基座模型：

```python
import torch.nn as nn
from transformers import AutoTokenizer, AutoModel
from peft import get_peft_model, LoraConfig, TaskType, PeftModel
from transformers import Trainer

# 加载基座模型
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
model = AutoModel.from_pretrained(MODEL_PATH, trust_remote_code=True)
```

接着，设定 peft 参数：

```python
peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            inference_mode=False,
            r=8,
            lora_alpha=32,
            lora_dropout=0.1,
        )
```

注意，对不同的模型，LoRA 参数可能有所区别。`task_type` 是模型的任务类型，大模型一般都是 CAUSAL_LM 即传统语言模型。然后获取 LoRA 模型，并使用 Trainer 训练即可，训练占用的显存就会有大幅度的降低：

```python
model = get_peft_model(model, peft_config)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset= IterableWrapper(train_dataset),
    tokenizer=tokenizer
)
trainer.train()
```

要注意的是，LoRA 微调能够大幅度降低显卡占用，且在下游任务适配上能够取得较好的效果；但如果是需要**学习对应知识的任务**，LoRA 由于只调整低秩矩阵，难以实现知识的注入，一般效果不佳，因此不推荐使用 LoRA 进行模型预训练或后训练。

## PEFT 现状与最佳实践（编者注）

以上是 LoRA 的 timeless 原理。补充 2026 年使用 PEFT（当前版本 ≥0.15）时需要知道的三件事：

**1. `target_modules="all-linear"` 已成默认推荐。** 原理篇讲"只调注意力四矩阵"是 2021 年论文的结论；2025 年 Thinking Machines Lab 的《LoRA Without Regret》研究证实：把 LoRA 应用到**所有线性层**（而不只是注意力层）效果显著更好，单纯提高秩弥补不了只调注意力带来的损失。在 PEFT/TRL 中的写法：

```python
from peft import LoraConfig

peft_config = LoraConfig(target_modules="all-linear")
```

**2. 秩与任务类型匹配。** SFT 建议 `r=256` 左右（配合 all-linear），强化学习类任务每轮只有约 1 bit 的信息量，`r=1–32` 即可；`lora_alpha/r` 的缩放使学习率近似与秩无关，LoRA 学习率通常比全参微调高一到两个数量级。详见本模块 [训练超参与过拟合诊断](./08-hyperparams-overfitting)。

**3. 合并权重消除推理开销。** 训练完的 adapter 可以直接加载使用，也可以合并回基座模型消除旁路计算；PEFT 支持 `merge_and_unload()` 一行完成。LoRA 与量化组合即 QLoRA，见下一篇文章。

## 小结

- 高效微调的两条路线：加 Adapter 层（Adapt Tuning）与加可训练前缀（Prefix Tuning）；LoRA 是前者的低秩改进，无推理延迟。
- 核心假设：下游任务适配时权重更新具有低本征秩，因此可以用 `ΔW = B·A`（秩 `r`）近似全量更新。
- 冻结 `W0`、只训练 `A`/`B`；`A` 高斯初始化、`B` 零初始化保证起点无损。
- LoRA 适合"教行为/教风格"；注入新知识仍需全参或更大容量方案。
