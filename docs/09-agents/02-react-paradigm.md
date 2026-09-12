---
title: ReAct 范式：思考、行动与观察的循环
source_url: https://huggingface.co/learn/agents-course/en/unit1/thoughts
author: Hugging Face Agents Course 团队
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 2
---

> **来源**：本文翻译自 Hugging Face Agents Course 第一单元 [Thought: Internal Reasoning and the ReAct Approach](https://huggingface.co/learn/agents-course/en/unit1/thoughts) 与 [Observe: Integrating Feedback to Reflect and Adapt](https://huggingface.co/learn/agents-course/en/unit1/observations) 两节，作者 Hugging Face Agents Course 团队，许可 Apache 2.0。抓取于 2026-09-13。

# 思考（Thought）：内部推理与 ReAct 方法

> **提示**：本节深入 AI 智能体的内部工作方式——它的推理与规划能力。我们将探索智能体如何利用"内心独白"来分析信息、把复杂问题拆解为可管理的步骤，并决定下一步采取什么行动。此外，我们还将介绍 ReAct 方法——一种鼓励模型在行动前"一步一步思考"的提示技术。

思考（Thought）代表**智能体为解决任务而进行的内部推理与规划过程**。

它利用大语言模型（LLM）**分析提示中所呈现信息**的能力——本质上是智能体解决问题时的内心独白。

智能体的思考帮助它评估当前的观察（Observation）、决定接下来应采取哪些行动。通过这一过程，智能体可以**把复杂问题拆解为更小、更易管理的步骤**，反思过去的经验，并根据新信息持续调整计划。

## 常见思考类型举例

| 思考类型 | 示例 |
| --- | --- |
| 规划 | "我需要把这个任务拆成三步：1) 收集数据，2) 分析趋势，3) 生成报告" |
| 分析 | "根据错误信息，问题似乎出在数据库连接参数上" |
| 决策 | "考虑到用户的预算限制，我应该推荐中档方案" |
| 解决问题 | "要优化这段代码，我应该先做性能分析找出瓶颈" |
| 记忆整合 | "用户之前提到偏好 Python，所以我会用 Python 给出示例" |
| 自我反思 | "上一种方法效果不好，我应该换个策略" |
| 目标设定 | "要完成这个任务，我需要先确立验收标准" |
| 优先级排序 | "应该先修复安全漏洞，再添加新功能" |

> **注**：对为函数调用（Function Calling）微调过的 LLM 而言，思考过程是可选的，详见"行动（Actions）"一节。

## 思维链（Chain-of-Thought，CoT）

**思维链**是一种引导模型**在给出最终答案之前一步一步思考**的提示技术。它通常以一句

> "Let's think step by step."（让我们一步一步思考。）

开始。这种方法帮助模型**在内部完成推理**，尤其适合逻辑或数学任务，**全程不与外部工具交互**。

### 示例（CoT）

```
Question: What is 15% of 200?
Thought: Let's think step by step. 10% of 200 is 20, and 5% of 200 is 10, so 15% is 30.
Answer: 30
```

## ReAct：推理 + 行动

一个关键方法是 **ReAct 方法**，它把"推理（Reasoning）"与"行动（Acting）"结合起来。

ReAct 是一种提示技术：鼓励模型一步一步思考，并在推理步骤之间交错插入动作（如使用工具）。

这让智能体能够在三种状态之间交替，解决复杂的多步任务：

- **Thought（思考）**：内部推理；
- **Action（行动）**：使用工具；
- **Observation（观察）**：接收工具输出。

### 示例（ReAct）

```
Thought: I need to find the latest weather in Paris.
Action: Search["weather in Paris"]
Observation: It's 18°C and cloudy.
Thought: Now that I know the weather...
Action: Finish["It's 18°C and cloudy in Paris."]
```

*图：(d) 是 ReAct 方法的示例——我们提示"Let's think step by step"，模型在思考之间执行动作。（图片来源：Hugging Face Agents Course 配图）*

## 对比：ReAct vs. CoT

| 特性 | 思维链（CoT） | ReAct |
| --- | --- | --- |
| 逐步逻辑 | 有 | 有 |
| 外部工具 | 无 | 有（行动 + 观察） |
| 最适合 | 逻辑、数学、内部任务 | 信息检索类、动态多步任务 |

> **提示**：近期的模型（如 **DeepSeek R1** 或 **OpenAI 的 o1 系列**）经过了"先思考再回答"的微调。它们使用 `<think>` 与 `</think>` 这类结构化 token，把推理阶段与最终答案显式分开。与 ReAct 或 CoT 这类*提示策略*不同，这是一种**训练层面的技术**——模型通过样例学会思考。

# 观察（Observe）：整合反馈以反思与调整

观察是**智能体感知自身行动后果的方式**。

它提供关键信息，为智能体的思考过程提供燃料，并引导后续行动。

观察是**来自环境的信号**——可能是 API 返回的数据、错误消息或系统日志——它们驱动下一轮思考。

在观察阶段，智能体：

- **收集反馈**：接收数据或确认，了解行动是否成功；
- **追加结果**：把新信息整合进现有上下文，实际上是在更新它的记忆；
- **调整策略**：用更新后的上下文来完善后续的思考与行动。

例如，天气 API 返回 *"partly cloudy, 15°C, 60% humidity"*（局部多云，15°C，湿度 60%），这条观察会被追加到智能体的记忆里（提示末尾）。智能体随后据此决定是否还需要更多信息，还是可以给出最终回答。

这种**反馈的迭代式融入，确保智能体始终与目标动态对齐**，不断依据真实世界的结果学习与调整。

观察可以有多种形态：从读取网页文本到监控机械臂的位置。可以把观察理解为工具的"日志"——以文本形式反馈动作执行的结果。

| 观察类型 | 示例 |
| --- | --- |
| 系统反馈 | 错误消息、成功通知、状态码 |
| 数据变化 | 数据库更新、文件系统修改、状态变更 |
| 环境数据 | 传感器读数、系统指标、资源使用 |
| 响应分析 | API 响应、查询结果、计算输出 |
| 基于时间的事件 | 截止日期到达、计划任务完成 |

## 结果是如何被追加的？

执行一个动作之后，框架按顺序做三件事：

1. **解析动作**：确定要调用的函数与使用的参数；
2. **执行动作**；
3. **把结果作为观察（Observation）追加**。

---

至此，我们学完了智能体的"思考-行动-观察"（Thought-Action-Observation）循环。如果有些地方还觉得模糊，不必担心——后续单元会重新回顾并深化这些概念。下一篇我们就来看看循环中"行动"一环的具体实现：工具。
