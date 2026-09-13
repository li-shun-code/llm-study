---
title: 提示词的基本要素与格式
source_url: https://www.promptingguide.ai/introduction/elements
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 1
versions: 提示技术通用；示例适用于当前主流对话模型（GPT/Claude/Gemini 等）
---
随着提示词工程（Prompt Engineering）的例子和应用程序越来越多，你会发现一个提示词（prompt）是由若干固定的要素组合而成的。

一个提示词可以包含以下任意要素：

- **指令（Instruction）**——你希望模型执行的具体任务或指令；
- **上下文（Context）**——外部信息或额外语境，可以引导模型给出更好的回答；
- **输入数据（Input Data）**——需要处理的输入或问题；
- **输出指示（Output Indicator）**——输出的类型或格式。

为了更直观地展示这些要素，下面用一个简单的文本分类任务提示词来说明：

_提示词：_

```
Classify the text into neutral, negative, or positive

Text: I think the food was okay.

Sentiment:
```

在上面的示例中，指令对应分类任务本身（"Classify the text into neutral, negative, or positive"）；输入数据对应 "I think the food was okay." 这一句；输出指示则是 `Sentiment:`。注意这个基础示例没有用到上下文，但上下文同样可以作为提示词的一部分提供——例如为文本分类任务附上额外的示例，帮助模型更好地理解任务，并引导它输出你期望的结果类型。

并非每个提示词都必须包含全部四个要素，格式取决于具体任务。后续章节会给出更多具体例子。

## 与模型交互

简单的提示词能完成很多事情，但结果的质量取决于你提供的信息量以及提示词本身的打磨程度。一个提示词可以包含传给模型的指令或问题，也可以包含上下文、输入、示例等其他细节。善用这些要素，可以更有效地指挥模型、提升结果质量。

先看一个最简单的例子：

_提示词：_

```
The sky is
```

_输出：_

```
blue.
```

模型只是顺着上下文补全了一个"合理"的词，输出可能完全不是你想要的。这正说明了提供更多上下文或明确指令的必要性。试着稍微改进一下：

_提示词：_

```
Complete the sentence: 

The sky is
```

_输出：_

```
blue during the day and dark at night.
```

效果好多了——因为我们明确指示模型"补全句子"，它的输出严格遵循了这一指令。这种通过设计有效提示词来指挥模型完成目标任务的思路，就是**提示词工程**的核心。

另一个值得了解的结构化约定：在使用对话模型时，提示词通常由三种角色（role）组成：

- `system`：系统消息，不是必需项，但有助于设定助手的整体行为（详见本模块"系统提示词设计"一篇）；
- `user`：用户消息，直接向模型下达任务；
- `assistant`：助手消息，对应模型的回复，也可以用来给出期望行为的示例。

现代 API（如 OpenAI 的 Responses API/Chat Completions、Anthropic Messages API）都建立在"消息列表 + 角色"这一结构之上，提示词工程正是在这个结构里展开的。

## 提示词格式

一个标准提示词（standard prompt）的格式非常简单：

```
<问题>?
```

或

```
<指令>
```

也可以组织成问答（QA）格式——这在很多问答数据集中是标准形式：

```
Q: <问题>?
A: 
```

上面这种不提供任何示例、直接要求模型作答的方式，被称为**零样本提示**（zero-shot prompting）。许多大模型具备零样本能力，但效果取决于任务难度、所需知识以及模型训练时擅长哪些任务。一个具体的例子：

_提示词：_

```
Q: What is prompt engineering?
```

对较新的模型来说，`Q:` 前缀可以省略——模型会根据语句的构成自行理解为问答任务：

_提示词：_

```
What is prompt engineering?
```

与之相对，一种常用且有效的技术是**少样本提示**（few-shot prompting），即在提示词中给出范例（演示）。少样本提示的格式如下：

```
<问题>?
<答案>

<问题>?
<答案>

<问题>?
<答案>

<问题>?
```

QA 格式版本：

```
Q: <问题>?
A: <答案>

Q: <问题>?
A: <答案>

Q: <问题>?
A: <答案>

Q: <问题>?
A:
```

注意：并不强制使用 QA 格式，提示词格式取决于任务。例如一个简单的分类任务，可以这样给出示范：

_提示词：_

```
This is awesome! // Positive
This is bad! // Negative
Wow that movie was rad! // Positive
What a horrible show! //
```

_输出：_

```
Negative
```

少样本提示让模型得以进行**上下文学习**（in-context learning）——仅凭少量演示就学会执行任务。零样本与少样本的深入讨论见本模块下一篇。

## 小结

- 一个提示词 = 指令 + 上下文 + 输入数据 + 输出指示的任意组合；
- 对话模型的世界观是"角色 + 消息列表"，系统消息设定行为，用户消息下达任务；
- 标准格式（直接提问）对应零样本，附带演示的格式对应少样本——这是后续所有进阶技术（CoT、自洽性、ReAct）的地基。

---

> **来源**：本文翻译自 [Elements of a Prompt](https://www.promptingguide.ai/introduction/elements)，作者 DAIR.AI（Elvis Saravia），许可 MIT。抓取于 2026-09-13。

---

> **补充来源**：本文"与模型交互""提示词格式"两节同时编译自 [Basics of Prompting](https://www.promptingguide.ai/introduction/basics)，许可同上。原文示例中的 `gpt-3.5-turbo`/`gpt-4` 等旧模型名已按当前主流对话模型口径校订，概念本身仍然成立。
