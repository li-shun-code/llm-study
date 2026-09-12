---
title: 思维链提示（Chain-of-Thought）
source_url: https://www.promptingguide.ai/techniques/cot
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 3
versions: 提示技术通用
---

> **来源**：本文翻译自 [Chain-of-Thought Prompting](https://www.promptingguide.ai/techniques/cot)，作者 DAIR.AI（Elvis Saravia），许可 MIT。抓取于 2026-09-13。

**思维链提示**（Chain-of-Thought, CoT）由 Wei et al. (2022) 提出，通过中间推理步骤（intermediate reasoning steps）来启用复杂推理能力。它可以与少样本提示结合，在那些"回答前需要先推理"的复杂任务上取得更好的效果。

![思维链示意图](https://www.promptingguide.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fcot.1933d9fe.png&w=1920&q=75)

*图：CoT 少样本提示与标准提示的对比（图片来源：Wei et al., 2022）*

回忆上一篇中少样本提示失败的那道题，这次在演示里把推理步骤写出来：

_提示词：_

```
The odd numbers in this group add up to an even number: 4, 8, 9, 15, 12, 2, 1.
A: Adding all the odd numbers (9, 15, 1) gives 25. The answer is False.

The odd numbers in this group add up to an even number: 17,  10, 19, 4, 8, 12, 24.
A: Adding all the odd numbers (17, 19) gives 36. The answer is True.

The odd numbers in this group add up to an even number: 16,  11, 14, 4, 8, 13, 24.
A: Adding all the odd numbers (11, 13) gives 24. The answer is True.

The odd numbers in this group add up to an even number: 17,  9, 10, 12, 13, 4, 2.
A: Adding all the odd numbers (17, 9, 13) gives 39. The answer is False.

The odd numbers in this group add up to an even number: 15, 32, 5, 13, 82, 7, 1. 
A:
```

_输出：_

```
Adding all the odd numbers (15, 5, 13, 7, 1) gives 41. The answer is False.
```

在演示中提供推理步骤之后，我们得到了完美结果。事实上这个任务甚至不需要那么多示例——一个示例就足够了：

_提示词：_

```
The odd numbers in this group add up to an even number: 4, 8, 9, 15, 12, 2, 1.
A: Adding all the odd numbers (9, 15, 1) gives 25. The answer is False.

The odd numbers in this group add up to an even number: 15, 32, 5, 13, 82, 7, 1. 
A:
```

_输出：_

```
Adding all the odd numbers (15, 5, 13, 7, 1) gives 41. The answer is False.
```

注意，论文作者指出：CoT 是一种**涌现能力**（emergent ability）——只有当语言模型规模足够大时才会出现，小模型上并不奏效。

## 零样本 CoT 提示

一个稍晚出现的思路是**零样本 CoT**（Kojima et al. 2022）：在原始提示词后附上一句 "Let's think step by step"（让我们一步步思考），无需任何示例就能引出推理。

![零样本 CoT 示意图](https://www.promptingguide.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fzero-cot.79793bee.png&w=1920&q=75)

*图：零样本 CoT（图片来源：Kojima et al., 2022）*

来试一个简单的问题，先不用特殊提示：

_提示词：_

```
I went to the market and bought 10 apples. I gave 2 apples to the neighbor and 2 to the repairman. I then went and bought 5 more apples and ate 1. How many apples did I remain with?
```

_输出：_

```
11 apples
```

答案错了（正确答案是 10）！现在加上那句魔法咒语：

_提示词：_

```
I went to the market and bought 10 apples. I gave 2 apples to the neighbor and 2 to the repairman. I then went and bought 5 more apples and ate 1. How many apples did I remain with?

Let's think step by step.
```

_输出：_

```
First, you started with 10 apples.
You gave away 2 apples to the neighbor and 2 to the repairman, so you had 6 apples left.
Then you bought 5 more apples, so now you had 11 apples.
Finally, you ate 1 apple, so you would remain with 10 apples.
```

如此简单的提示就奏效了，令人印象深刻。当你没有足够多的示例可以放进提示词时，这种技巧尤其有用。

> **译注**：对当前一代"推理模型"（如 OpenAI o 系列与 GPT-5 级思考模式、DeepSeek-R1 类模型），推理过程已被内化为模型能力，通常无需再手动附加 "step by step" 一类的指令；对普通非推理模型，零样本 CoT 仍是简单有效的增益手段。二者关系见模块 4"推理模型"一篇。

## 自动思维链（Auto-CoT）

在带演示的 CoT 提示中，人工编写有效且多样的示例既费力又可能得不到最优解。Zhang et al. (2022) 提出了一种消除人工投入的方法：利用 LLM 本身（配合 "Let's think step by step" 提示）逐个为演示生成推理链（reasoning chain）。自动生成的链仍可能出错，为减轻错误影响，演示的**多样性**就很重要。这项工作提出的 Auto-CoT 会先对问题做多样性采样，再生成推理链来构建演示。

Auto-CoT 包含两个主要阶段：

- **阶段一：问题聚类**（question clustering）——把给定数据集的问题划分为若干簇；
- **阶段二：演示采样**（demonstration sampling）——从每个簇中选一个有代表性的问题，用零样本 CoT 加简单启发式（如问题长度约 60 token、推理链约 5 步）生成其推理链。

这些启发式促使模型使用简单、准确的演示。流程如下图：

![Auto-CoT 流程图](https://www.promptingguide.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fauto-cot.642d9bad.png&w=3840&q=75)

*图：Auto-CoT 两阶段流程（图片来源：Zhang et al., 2022）*

Auto-CoT 的代码开源于 [amazon-science/auto-cot](https://github.com/amazon-science/auto-cot)。

## 小结

- CoT 的本质：把"推理过程"作为演示/输出的一部分，让模型在给出最终答案前先展开中间步骤；
- 三种形态：少样本 CoT（演示含推理）、零样本 CoT（"step by step" 咒语）、Auto-CoT（自动构造多样化推理演示）；
- CoT 是后续"自洽性"与 ReAct 的共同基础，也是如今推理模型训练范式的源头之一。
