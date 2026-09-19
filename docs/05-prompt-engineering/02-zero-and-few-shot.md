---
title: 零样本与少样本提示
source_url: https://www.promptingguide.ai/techniques/fewshot
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: 提示技术通用
order: 2
group: 提示基础
---
## 零样本提示

如今的大语言模型（LLM）经过指令微调（instruction tuning）并在海量数据上训练，已经能够以"零样本"（zero-shot）的方式完成不少任务。**零样本提示**指的是：与模型交互的提示词中不包含任何示例或演示，直接指示模型执行任务。

前面章节我们用过一些零样本例子，例如文本分类：

_提示词：_

```
Classify the text into neutral, negative or positive. 

Text: I think the vacation is okay.
Sentiment:
```

_输出：_

```
Neutral
```

注意上面的提示词没有给模型提供任何"文本 + 分类"的示例，但 LLM 已经理解 "sentiment" 是什么——这正是零样本能力在起作用。

研究表明，指令微调（instruction tuning）可以提升零样本学习效果（Wei et al. 2022）——本质是在"用指令描述的数据集"上对模型做微调；在此基础上再引入人类反馈强化学习（RLHF，Reinforcement Learning from Human Feedback），让模型对齐人类偏好，这一路线造就了 ChatGPT 等对话模型。

当零样本方式不够用时，推荐的下一步就是在提示词中提供演示或示例——也就是少样本提示。

## 少样本提示

尽管大模型的零样本能力已经很强，但在更复杂的任务上，零样本设定仍然力不从心。**少样本提示**（few-shot prompting）可以作为启用**上下文学习**（in-context learning）的技术：在提示词中提供演示（demonstrations），引导模型取得更好的表现。这些演示相当于为后续输入提供了"条件"，模型据此生成我们想要的回答。

据 Touvron et al. 2023 等文献，少样本特性最早是在模型规模扩展到足够大时才出现的（Kaplan et al., 2020）。

让我们通过 Brown et al. 2020 论文中的一个例子来演示少样本提示。任务是正确地在句子中使用一个新造的词：

_提示词：_

```
A "whatpu" is a small, furry animal native to Tanzania. An example of a sentence that uses the word whatpu is:
We were traveling in Africa and we saw these very cute whatpus.
 
To do a "farduddle" means to jump up and down really fast. An example of a sentence that uses the word farduddle is:
```

_输出：_

```
When we won the game, we all started to farduddle in celebration.
```

可以看到，只提供**一个**示例（即 1-shot），模型就学会了这个任务。对更难的任务，可以实验增加演示数量（如 3-shot、5-shot、10-shot 等）。

根据 Min et al. (2022) 的发现，关于少样本中的演示/范例还有几点值得注意：

- "演示所指定的标签空间和输入文本的分布都很重要（即使个别输入的标签是错的）"；
- 你使用的格式对性能也起关键作用——即便只用随机标签，也远好于完全没有标签；
- 额外结果表明，从真实标签分布（而非均匀分布）中抽取随机标签同样有帮助。

我们来试几个例子。第一个使用随机标签（Negative 和 Positive 被随机分配给输入）：

_提示词：_

```
This is awesome! // Negative
This is bad! // Positive
Wow that movie was rad! // Positive
What a horrible show! //
```

_输出：_

```
Negative
```

尽管标签被打乱了，模型仍给出了正确答案。注意我们还保持了格式一致，这同样有帮助。事实上，进一步实验表明较新的模型对随机的格式也变得更鲁棒了：

_提示词：_

```
Positive This is awesome! 
This is bad! Negative
Wow that movie was rad!
Positive
What a horrible show! --
```

_输出：_

```
Negative
```

上面的格式毫无一致性，但模型依然预测出了正确标签。这在不同、更复杂任务和不同提示词变体下是否仍然成立，还需要更细致的分析验证。

### 少样本提示的局限

标准少样本提示对许多任务有效，但并不是完美技术，尤其是面对更复杂的推理任务。让我们看看为什么。回忆上一篇末尾的例子：

```
The odd numbers in this group add up to an even number: 15, 32, 5, 13, 82, 7, 1. 

A: 
```

如果再来一次，模型会输出：

```
Yes, the odd numbers in this group add up to 107, which is an even number.
```

答案错了（奇数是 15, 5, 13, 7, 1，和为 41，是奇数）。这不仅暴露了这类系统的局限，也说明我们需要更高级的提示词工程。

试着加上一些示例，看少样本能否改善结果：

_提示词：_

```
The odd numbers in this group add up to an even number: 4, 8, 9, 15, 12, 2, 1.
A: The answer is False.

The odd numbers in this group add up to an even number: 17,  10, 19, 4, 8, 12, 24.
A: The answer is True.

The odd numbers in this group add up to an even number: 16,  11, 14, 4, 8, 13, 24.
A: The answer is True.

The odd numbers in this group add up to an even number: 17,  9, 10, 12, 13, 4, 2.
A: The answer is False.

The odd numbers in this group add up to an even number: 15, 32, 5, 13, 82, 7, 1. 
A: 
```

_输出：_

```
The answer is True.
```

还是不行。看起来对这类推理问题，少样本提示不足以获得可靠的回答。仔细观察会发现，我们引入的任务类型需要多步推理。换句话说，如果把问题拆解成步骤并把拆解过程演示给模型看，也许会有帮助——这正是下一篇要讲的**思维链提示**（chain-of-thought prompting, CoT）解决的场景（Wei et al., 2022），它因在算术、常识和符号推理等复杂任务上的表现而广受欢迎。

总体而言：提供示例对某些任务有用；当零样本和少样本都不奏效时，可能意味着模型学到的东西不足以完成该任务——此时可以考虑微调模型，或尝试更高级的提示技术。

## 小结

| 方式 | 提示词构成 | 适用场景 |
|---|---|---|
| 零样本 | 只有指令/问题 | 简单、常见任务，模型见过大量类似数据 |
| 少样本 | 指令 + 若干输入/输出演示 | 任务模式特殊、需要校准输出格式时 |

- 演示的**标签空间**与**格式**比标签本身的正确性更重要；
- 涉及多步推理的任务，先给示例未必有用——需要把"推理过程"本身演示出来，这正是 CoT 的出发点。

---

> **来源**：本文翻译自 [Few-Shot Prompting](https://www.promptingguide.ai/techniques/fewshot)，作者 DAIR.AI（Elvis Saravia），许可 MIT。抓取于 2026-09-13。

---

> **补充来源**：本文"零样本提示"一节编译自同站的 [Zero-Shot Prompting](https://www.promptingguide.ai/techniques/zeroshot)，许可同上。
