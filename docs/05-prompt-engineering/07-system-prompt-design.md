---
title: 系统提示词设计
source_url: https://cookbook.openai.com/examples/gpt4-1_prompting_guide
author: OpenAI（Carrie Liu、Marco Ramponi 等）
license: MIT（OpenAI Cookbook）
fetched_at: 2026-09-13
translated: true
order: 7
versions: OpenAI Responses API 时代（GPT-4.1 提示指南，2025-04；原则适用于当前模型系）
---
许多通用最佳实践仍然适用：提供上下文示例、让指令尽可能具体清晰、通过提示词引导规划来最大化模型智力。但值得特别注意的是：这一代模型被训练得**比前辈更贴近、更字面地遵循指令**（前辈们更倾向于从用户与系统提示中"自由发挥"地推断意图）。这意味着两点——模型高度**可引导**（steerable），一条明确、不容歧义的澄清语句几乎总能把行为扳回来；同时你的指令必须写得明确，"言外之意"不再被可靠地脑补。

另外要记住：AI 工程本质上是一门经验学科，大语言模型本质上是非确定性的。遵循任何指南之外，还应构建有信息量的评估（evals）并频繁迭代，确保提示词的改动确实为你的场景带来收益（详见本模块"提示迭代评估方法"一篇）。

## 设计与调试指令的推荐工作流

这是原文给出的系统提示词指令开发与调试流程：

1. 先写一个总体的 "Response Rules" 或 "Instructions" 小节，用高层指导 + 要点列表；
2. 如果想调整某个更具体的行为，为该类别增加一个小节补充细节，如 `# Sample Phrases`（示例话术）；
3. 如果希望模型按特定步骤执行工作流，加入**有序列表**并指示模型遵循这些步骤；
4. 如果行为仍不符合预期：
   1. 检查是否存在冲突、欠明确或错误的指令与示例。若指令相互冲突，模型倾向于遵循**更靠近提示词末尾**的那条；
   2. 增加演示期望行为的示例；并确保示例中体现的重要行为同样写进了规则里；
   3. 一般**没有必要**使用全大写、利诱或小费等"激励话术"。建议先不用这些手段，确有必要再尝试；已有提示词里若包含这些技巧，反而可能导致模型过度字面地对待它们。

原文还特别推荐：用你顺手的 AI 编程 IDE 来迭代提示词——检查一致性或冲突、补充示例、做"加一条指令同时更新示例以演示该指令"的成套修改。

## 常见失败模式

这些失败模式并非某代模型独有，列举在此便于排查：

- **绝对化指令的反噬**：要求模型"必须先调用工具再回答用户"，模型可能在信息不足时幻觉出工具入参、或用空值调用工具。补一句"若没有足够信息调用工具，先向用户询问所需信息"即可缓解。
- **示例话术复读机**：给了样例话术，模型可能逐字引用，让回复显得机械重复。应指示模型按需变换措辞。
- **多余的散文与格式**：不加约束时，有些模型热衷于额外解释自己的决策，或输出过多格式。需要用指令（必要时加示例）收敛。

## Agent 系统提示词的三类提醒

构建 Agent 类应用时，原文建议所有 Agent 提示词都包含三类关键提醒（以下模板针对编码工作流优化，很容易改成通用场景）：

**1. 持续性（Persistence）**——让模型明白自己处于多轮消息的工作过程中，防止它过早把控制权交还给用户：

```
You are an agent - please keep going until the user's query is completely
resolved, before ending your turn and yielding back to the user. Only terminate
your turn when you are sure that the problem is solved.
```

**2. 工具调用（Tool-calling）**——促使模型充分利用工具，减少幻觉或瞎猜答案的倾向：

```
If you are not sure about file content or codebase structure pertaining to the
user's request, use your tools to read files and gather the relevant information:
do NOT guess or make up an answer.
```

**3. 规划（Planning，可选）**——让模型在文本中显式规划并复盘每次工具调用，而不是用一连串静默的工具调用拼完整个任务：

```
You MUST plan extensively before each function call, and reflect extensively on
the outcomes of the previous function calls. DO NOT do this entire process by
making function calls only, as this can impair your ability to solve the problem
and think insightfully.
```

模型在 Agent 场景下对系统提示词的响应非常贴近。内部测试中，仅靠这三条简单指令就将 SWE-bench Verified 成绩提升了近 20%——它们把模型从"聊天机器人"状态切换成"主动推进任务"的 Agent 状态。

## 工具定义：走 API 字段，别手写进提示词

工具请通过 API 请求的 `tools` 字段传入，而不要把工具描述手工注入提示词、再自己写解析器。这是最小化错误、让工具调用轨迹保持在模型分布内的最佳方式——实验显示，用 API 解析的工具描述相比手工注入 Schema，SWE-bench Verified 通过率高约 2%。

工具命名要清晰达意，`description` 字段写清楚详细说明；每个工具参数同样依靠良好的命名与描述确保正确使用。如果工具特别复杂、想给使用示例，建议在系统提示词里开一个 `# Examples` 小节放示例，而不是塞进 `description`（后者应保持详尽但相对简洁）。示例有助于说明何时用工具、调用时是否附带用户原文、不同输入该填什么参数。

## 提示组织：指令放哪里

在长上下文场景下，指令与上下文的**摆放位置**会影响性能：

- 如果提示词里有很长的上下文，最好把指令放在提供内容的**开头和结尾各一份**——这比只放一头效果更好；
- 如果只想写一遍指令，放在上下文**上方**优于下方。

## 规划与思维链的注入

非推理模型不会在回答前产生内部思维链，但开发者可以用提示词诱导模型"出声思考"（thinking out loud），产出显式的分步计划。在 SWE-bench Verified 的 Agent 任务实验中，诱导显式规划使通过率提升了 4%。

推荐先在提示词末尾放一条基础的思维链指令：

```
First, think carefully step by step about what documents are needed to answer
the query. Then, print out the TITLE and ID of each document. Then, format the
IDs into a list.
```

随后，根据你的具体用例与评估中的失败审计来改进 CoT 提示：无约束的自由 CoT 策略存在随机性，一旦观察到某种策略效果好，就把它**固化成提示词里的明确策略**。错误一般源于三类：误解用户意图、上下文收集/分析不足、分步思考不足或出错——用更有倾向性的指令逐类击破。下面是原文给出的"推理策略"模板：

```
# Reasoning Strategy
1. Query Analysis: Break down and analyze the query until you're confident about
   what it might be asking. Consider the provided context to help clarify any
   ambiguous or confusing information.
2. Context Analysis: Carefully select and analyze a large set of potentially
   relevant documents. Optimize for recall - it's okay if some are irrelevant,
   but the correct documents must be in this list, otherwise your final answer
   will be wrong. Analysis steps for each:
	a. Analysis: An analysis of how it may or may not be relevant to answering the query.
	b. Relevance rating: [high, medium, low, none]
3. Synthesis: summarize which documents are most relevant and why, including all
   documents with a relevance rating of medium or higher.
```

## 客服 Agent 示例骨架

原文用一个虚构的客服 Agent 演示上述全部实践。留意规则的**多样性**与**具体性**、用小节承载细节层次、以及用示例精确演示"同时满足所有前述规则"的行为：

```python
SYS_PROMPT_CUSTOMER_SERVICE = """You are a helpful customer service agent working
for NewTelco, helping a user efficiently fulfill their request while adhering
closely to provided guidelines.

# Instructions
- Always greet the user with "Hi, you've reached NewTelco, how can I help you?"
- Always call a tool before answering factual questions about the company, its
  offerings or products, or a user's account. Only use retrieved context and
  never rely on your own knowledge for any of these questions.
  ...
# Precise Response Steps (for each response)
...
# Sample Phrases
...
# Output Format
...
"""
```

（此处为节选骨架；完整提示词与运行效果见原文 notebook。其结构正是前文推荐工作流的落地：`# Instructions` 总纲 → `# Precise Response Steps` 有序步骤 → `# Sample Phrases` 细节小节 → `# Output Format` 输出约束。）

## 小结：一个健壮系统提示词的常见骨架

综合原文实践，系统提示词通常按如下层次组织：

1. **角色与目标**（Role & Objective）——开头一两句定调；
2. **指令 / 响应规则**（Instructions / Response Rules）——要点列表，冲突时"末尾优先"；
3. **精确步骤**（Precise Response Steps）——有序列表规定工作流；
4. **示例**（Examples）——演示规则，规则中同时复述示例要点；
5. **输出格式**（Output Format）——与模块 6"结构化输出"衔接。

设计系统提示词是一项经验工作：改一版、评一轮（本模块第 11 篇），永远以评估结果为准。

---

> **来源**：本文翻译自 [GPT-4.1 Prompting Guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)（节选编译），作者 OpenAI（Carrie Liu、Marco Ramponi 等），许可 MIT（OpenAI Cookbook）。抓取于 2026-09-13。

---

> **编译说明**：原文是面向 GPT-4.1 系列的完整提示指南，本文节选其中与**系统提示词设计**直接相关的章节（指令遵循、Agent 提醒、提示组织、思维链策略与客服示例）。文中"GPT-4.1"保留原文表述；这些结构性原则同样适用于当前一代模型，个别结论（如"非推理模型"）请结合具体模型对号入座。
