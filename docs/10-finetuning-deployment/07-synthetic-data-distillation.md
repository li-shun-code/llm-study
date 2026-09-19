---
title: 数据蒸馏与合成：用大模型造小模型的训练数据
source_url: https://github.com/huggingface/smol-course/tree/main/v1/6_synthetic_datasets
author: Hugging Face（smol-course）、TRL 文档
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: distilabel / TRL DistillationTrainer（2026-09 现行版）
order: 7
group: 训练
---
给小模型做 SFT，最贵的不是算力而是数据。两条主流的"造数据"路线：**合成（Synthetic Data）**——用大模型生成指令-回答对；**蒸馏（Distillation）**——让小模型直接学习大模型的输出分布。本文各用一份官方一手文档讲透。

## 第一部分：生成指令数据集（smol-course）

前面章节我们学习了如何用有监督微调（SFT）微调模型；本节探讨如何**为 SFT 生成指令数据集**：从基础提示（Basic Prompting）到论文中的精细方法——SelfInstruct、EvolInstruct、Magpie，最后用 distilabel 流水线工程化生成。

### 从提示到数据

合成数据听起来玄乎，本质上就是**通过有效的提示词从模型中提取知识来创建数据**。挑战在于：既要提示得有效，又要保证数据**多样**且**有代表性**。先从手动提示开始。

### 基础提示

用 distilabel 的 Transformers 集成加载一个小模型，先生成一条合成 `prompt`，再用它生成 `completion`：

```python
from distilabel.llms import TransformersLLM
from distilabel.steps.tasks import TextGeneration

llm = TransformersLLM(model="HuggingFaceTB/SmolLM2-1.7B-Instruct")
gen = TextGeneration(llm=llm)
gen.load()
```

::: note
distilabel 会把 `llm` 加载进内存，在 notebook 中用完记得 `gen.unload()` 以免内存不足。
:::

```python
next(gen.process([{"instruction": "Generate a questions about the Hugging Face Smol-Course on small AI models."}]))
# What is the purpose of Smol-Course?
```

再用这条 prompt 生成回答：

```python
next(gen.process([{"instruction": "What is the purpose of Smol-Course?"}]))
# The Smol-Course is a platform designed to learning computer science concepts.
```

把这一简单做法规模化就能生成大量数据，但质量不高、多样性也不足。解决办法就是下面这些论文方法。

### SelfInstruct：种子自展

SelfInstruct 基于一小撮种子数据（一条指令或一段上下文），用上下文学习（In-Context Learning）让模型生成新指令。简化版提示模板：

```text
# Task Description
Develop {{ num_instructions }} user queries that can be received by the given
AI application and applicable to the provided context. Emphasize diversity in
verbs and linguistic structures within the model's textual capabilities.

# Context
{{ input }}

# Output
```

在 distilabel 中一行接入：

```python
from distilabel.steps.tasks import SelfInstruct

self_instruct = SelfInstruct(llm=llm)
self_instruct.load()

next(self_instruct.process([{"input": text}]))["instructions"][0]
# What is the process of generating synthetic data through manual prompting?
```

生成的指令明显更贴合领域内容。还可以更进一步——"进化"它。

### EvolInstruct：指令进化

EvolInstruct 把一条输入指令按一组标准（加深、具体化、增加约束、增加推理步骤等）改写成更复杂的版本，可以反复多轮：

```python
from distilabel.steps.tasks import EvolInstruct

evol_instruct = EvolInstruct(llm=llm, num_evolutions=1)
evol_instruct.load()

next(evol_instruct.process([{"instruction": text}]))
# What is the process of generating synthetic data through manual prompting?
# And, how does the artificial intelligence system, GPT4, use machine learning
# algorithms to manipulate the input data into synthetic data?
```

注意：进化让指令更复杂，但也可能**丢失原意**——进化是双刃剑，要警惕生成数据的质量。

### Magpie：借对话模板"白嫖"数据

Magpie 利用语言模型的自回归特性与指令微调时使用的 chat template：从模板的 pre-query 前缀开始（停在用户消息标识之前，如 `<|im_start|>user\n`），让模型自己续写出用户问题，直到助手段落结束符。三步示意：

```text
# Step 1: 提供pre-query-prompt
<|im_start|>user\n

# Step 2: 语言模型生成用户prompt
<|im_start|>user\n
What is the purpose of Smol-Course?

# Step 3: 停止生成
<|im_end|>
```

```python
from distilabel.steps.tasks import Magpie

magpie = Magpie(llm=llm)
magpie.load()

next(magpie.process([{"system_prompt": "You are a helpful assistant."}]))
# [{"role": "user", "content": "Can you provide me with a list of the top 3 universities?"},
#  {"role": "assistant", "content": "The top 3 universities are: MIT, Yale, Stanford."}]
```

这种方式生成效率极高，还能扩展到多轮对话。有假说认为这类数据"复现"了该模型指令微调阶段所用的训练数据分布。要在特定领域定向生成，可在 system prompt 中注入领域上下文——注意写法：应写 "You're an AI assistant that **will help users** solving math problems."（面向"帮用户解题"），而不是 "You're an AI assistant that **generates** math problems."（面向"自己出题"）——语言模型对后者这类注入的服从性较差。

### 从提示到流水线

把上面的类组合成 distilabel `Pipeline`：加载数据 → 生成 prompt → 生成 completion，用 `>>` 连接、`output_mappings` 对齐列名：

```python
from distilabel.llms import TransformersLLM
from distilabel.pipeline import Pipeline
from distilabel.steps import LoadDataFromDicts
from distilabel.steps.tasks import TextGeneration

with Pipeline() as pipeline:
    data = LoadDataFromDicts(data=[{"instruction": "Generate a short question about the Hugging Face Smol-Course."}])
    llm = TransformersLLM(model="HuggingFaceTB/SmolLM2-1.7B-Instruct")
    gen_a = TextGeneration(llm=llm, output_mappings={"generation": "instruction"})
    gen_b = TextGeneration(llm=llm, output_mappings={"generation": "response"})
    data >> gen_a >> gen_b

if __name__ == "__main__":
    distiset = pipeline.run(use_cache=False)
    print(distiset["default"]["train"][0])
# [{"instruction": "What is the purpose of Smol-Course?",
#   "response": "The Smol-Course is a platform designed to learning computer science concepts."}]
```

流水线自带生成结果缓存（不必重跑）、容错（单步失败不中断）与并行执行。最佳实践：

- 保证种子数据多样，覆盖广泛场景
- 定期评估数据集，确保生成数据多样且高质量
- 迭代（系统）提示词以提升数据质量

## 第二部分：蒸馏 Trainer（TRL）

合成数据学的是"老师写出来的答案文本"；蒸馏更进一步——直接学老师的**输出概率分布**。

### 概述

TRL 的 `DistillationTrainer` 实现了**在线策略知识蒸馏（On-Policy Knowledge Distillation）**，对应论文 [On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes](https://huggingface.co/papers/2306.13649)（GKD，Generalized Knowledge Distillation）。

论文摘要（节译）：知识蒸馏（KD）通过训练更小的学生模型来压缩教师模型，降低推理成本与内存占用。但现有自回归序列模型的 KD 方法存在**分布失配**：训练时看到的输出序列与学生在推理时自己生成的序列并不一致。为此 GKD 让学生在**自己生成的序列**上接受教师模型的反馈。与有监督 KD 不同，GKD 还允许在师生之间灵活选择其他散度损失——当学生没有足够表达力去模仿教师分布时尤其有用。

`DistillationTrainer` 的做法：在学生自己 on-policy 生成的补全上，让学生匹配教师的完整下一 token 分布，使用内存高效的分块 Jensen-Shannon 散度（JSD）损失，不需要把教师的稠密分布完整物化出来。

### 快速开始

用一个 Qwen2.5-1.5B-Instruct 教师，把 Qwen2.5-0.5B-Instruct 学生蒸馏到 UltraFeedback 的提示上：

```python
# train_distillation.py
from datasets import load_dataset
from trl import DistillationTrainer

dataset = load_dataset("trl-lib/ultrafeedback-prompt", split="train")

trainer = DistillationTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",
    teacher_model="Qwen/Qwen2.5-1.5B-Instruct",
    train_dataset=dataset,
)
trainer.train()
```

```bash
accelerate launch train_distillation.py
```

### 深入方法

在线策略蒸馏训练学生在**学生自己生成**的补全上复现教师的下一 token 分布，而不是在固定的教师输出集合上。从自己的生成中学习让学生能纠正自己的错误，通常优于离线策略蒸馏。两个关键步骤：

1. **生成补全**：每个训练步，学生对采样的提示生成一批补全。
2. **计算损失**：损失是学生分布 `p_S` 与教师分布 `p_T` 在生成 token 上的**广义 Jensen-Shannon 散度**，由 `beta` 插值：

```text
L_beta = beta · KL[p_T ‖ p_M] + (1 - beta) · KL[p_S ‖ p_M]，  p_M = (1-beta)·p_S + beta·p_T
```

两个端点即纯散度：`beta=0.0` 得到前向 KL（`KL[p_T ‖ p_S]`），`beta=1.0` 得到反向 KL（`KL[p_S ‖ p_T]`）。实践中，投影到词表 logits 与散度计算都按块进行，峰值激活显存不会随"词表 × 序列长度"的 logits 张量膨胀。

### 数据要求

数据集应为**对话格式的仅提示（prompt-only）**数据——学生自己生成补全，所以只需要提示：

```python
{"prompt": [{"role": "user", "content": "What color is the sky?"}]}
```

### 用 vLLM 加速生成

在线策略方法的主要瓶颈往往是生成。TRL 支持两种 vLLM 加速模式：**colocate 模式**（默认；vLLM 跑在训练进程内、与训练共享 GPU 显存，省去独立服务但可能争抢显存）与 **server 模式**（独立 vLLM 服务，通过 HTTP 打分）。开启方式：

```python
from trl import DistillationConfig

training_args = DistillationConfig(
    ...,
    use_vllm=True,  # vllm_mode="colocate" 默认
)
```

此外，`DistillationTrainer` 还完整支持工具调用（Agent 训练）、多模态工具返回与视觉语言模型（VLM）训练，并可通过命令行接口运行全量或 LoRA 蒸馏。

## 两种路线怎么选（编者注）

| 维度 | 合成数据（SFT 路线） | 蒸馏（分布对齐路线） |
| --- | --- | --- |
| 学什么 | 老师生成的**文本答案** | 老师的**完整概率分布** |
| 数据形态 | `{"instruction", "response"}` 对 | 只需提示列表，学生 on-policy 生成 |
| 工程门槛 | 低（调 API/本地大模型即可） | 中（师生同时驻留显存，或配 vLLM 服务） |
| 适用场景 | 快速扩充领域数据、冷启动 | 压缩能力/风格、对齐小模型分布 |
| 代表方法 | SelfInstruct / EvolInstruct / Magpie | GKD / On-Policy Distillation（Qwen3、Gemini 等团队公开报告均在使用） |

实践中常见组合：**先用大模型合成指令数据做 SFT 冷启动，再用 on-policy 蒸馏拉齐分布**；合成的偏好数据（chosen/rejected 由不同大模型打分产生）则喂给 DPO（见 [DPO 与偏好优化](./13-dpo-preference-optimization)）。

## 小结

- 合成数据三件套：SelfInstruct 自展、EvolInstruct 进化、Magpie 借模板续写；流水线化（distilabel）才有工程质量。
- 蒸馏的正确姿势是 on-policy：学生在自己的生成上匹配教师分布，JSD 损失 + 分块计算控制显存。
- 合成数据必须过滤质量与多样性；蒸馏需要同时养得起师生两个模型。

---

> **来源**：本文第一部分翻译自 [Generating Instruction Datasets（smol-course v1 · Synthetic Datasets 单元）](https://github.com/huggingface/smol-course/tree/main/v1/6_synthetic_datasets)，作者 Hugging Face（smol-course），许可 Apache 2.0；第二部分翻译自 [Distillation Trainer（TRL 官方文档）](https://huggingface.co/docs/trl/distillation_trainer)，作者 Hugging Face（TRL 文档），许可 Apache 2.0。抓取于 2026-09-13。
