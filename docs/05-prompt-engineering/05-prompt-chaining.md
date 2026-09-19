---
title: 提示链与任务分解（Prompt Chaining）
source_url: https://www.promptingguide.ai/techniques/prompt_chaining
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: 提示技术通用；原文示例基于 gpt-4-1106-preview 时代（长上下文），概念在当前模型上仍然适用；文末补充小节来自 OpenAI Cookbook 的链式调用指南
order: 5
group: 推理与任务分解
---
要提升 LLM 的可靠性与性能，一个重要的提示工程技术是**把任务拆解为子任务**。一旦确定了这些子任务，就可以先用一个提示让 LLM 处理某个子任务，再把它的响应用作下一个提示的输入。这就是所谓的**提示链**（prompt chaining）：把一个任务拆成多个子任务，用一系列提示操作把它们串成一条链。

提示链适用于完成那些"用一条非常详细的提示直接丢给 LLM"时难以处理好的复杂任务。在提示链中，链上的每个提示会对上一环生成的响应做某种转换或附加处理，逐步逼近最终想要的状态。

除了获得更好的性能，提示链还能提升 LLM 应用的**透明度**（transparency）、**可控性**（controllability）与**可靠性**（reliability）——这意味着你可以更容易地排查模型响应中的问题，并对需要改进的各个环节分别做分析与优化。

在构建由 LLM 驱动的对话助手、提升应用个性化与用户体验时，提示链尤其有用。

> 原文在本节附有一段视频讲解（YouTube："Prompt Chaining"，约 7 分钟），可在原页面观看。

## 提示链的使用场景

### 用提示链做文档问答

提示链可以用于涉及多步操作或转换的各种场景。一个常见用例是：**就一篇很长的文档回答问题**。有效的做法是设计两个不同的提示——第一个提示负责从文档中抽取与问题相关的引文（quotes），第二个提示以这些引文和原始文档为输入来回答问题。换句话说，用两个提示接力完成"根据文档回答问题"这一个任务。

下面第一个提示从文档中抽取与问题相关的引文。注意为了简化，文档位置用占位符 `{document}` 表示。测试时可以从维基百科复制一篇文章（比如[提示工程](https://en.wikipedia.org/wiki/Prompt_engineering)这一页）粘贴进去。由于该任务要用较大的上下文，原文使用的是 OpenAI 的 `gpt-4-1106-preview` 模型；这套提示也可以用于 Claude 等其他长上下文 LLM。

提示 1：

```
You are a helpful assistant. Your task is to help answer a question given in a document. The first step is to extract quotes relevant to the question from the document, delimited by ####. Please output the list of quotes using <quotes></quotes>. Respond with "No relevant quotes found!" if no relevant quotes were found.


####
{{document}}
####
```

（问题本身通过 `user` 角色与上述提示一并传入。）提示 1 的输出：

```
<quotes>
- Chain-of-thought (CoT) prompting[27]
- Generated knowledge prompting[37]
- Least-to-most prompting[38]
- Self-consistency decoding[39]
- Complexity-based prompting[41]
- Self-refine[42]
- Tree-of-thought prompting[43]
- Maieutic prompting[45]
- Directional-stimulus prompting[46]
- Textual inversion and embeddings[59]
- Using gradient descent to search for prompts[61][62][63][64]
- Prompt injection[65][66][67]
</quotes>
```

第一个提示返回的引文，现在可以作为下面第二个提示的输入。注意你还可以把引文再清理一下，比如去掉引用编号——这些编号可以在链上再加一个提示来移除，此处先不处理。第二个提示拿到提示 1 抽取的相关引文后，结合原始文档组织出对问题的有帮助的回答：

提示 2：

```
Given a set of relevant quotes (delimited by <quotes></quotes>) extracted from a document and the original document (delimited by ####), please compose an answer to the question. Ensure that the answer is accurate, has a friendly tone, and sounds helpful.

####
{{document}}
####

<quotes>
- Chain-of-thought (CoT) prompting[27]
- Generated knowledge prompting[37]
- Least-to-most prompting[38]
- Self-consistency decoding[39]
- Complexity-based prompting[41]
- Self-refine[42]
- Tree-of-thought prompting[43]
- Maieutic prompting[45]
- Directional-stimulus prompting[46]
- Textual inversion and embeddings[59]
- Using gradient descent to search for prompts[61][62][63][64]
- Prompt injection[65][66][67]
</quotes>
```

提示 2 的输出：

```
The prompting techniques mentioned in the document include:

1. Chain-of-thought (CoT) prompting[27]
2. Generated knowledge prompting[37]
3. Least-to-most prompting[38]
4. Self-consistency decoding[39]
5. Complexity-based prompting[41]
6. Self-refine[42]
7. Tree-of-thought prompting[43]
8. Maieutic prompting[45]
9. Directional-stimulus prompting[46]
10. Textual inversion and embeddings[59]
11. Using gradient descent to search for prompts[61][62][63][64]
12. Prompt injection[65][66][67]

Each of these techniques employs unique strategies to enhance or specify the interactions with large language models to produce the desired outcomes.
```

可以看到，当响应需要经过多次操作或转换时，把任务简化并组织成提示链是一种非常有效的提示方法。作为练习，不妨设计一个提示，在把最终响应交给应用用户之前，先从中移除引用编号（如 `[27]`）。

原文还指出：在 Anthropic 关于提示链的[文档](https://docs.anthropic.com/claude/docs/prompt-chaining)中可以找到更多基于 Claude 的提示链示例——上文的示例正是受其启发并改编而来。

## 补充：用链式调用接上结构化输出（OpenAI Cookbook）

> 本节翻译自 OpenAI Cookbook《Using chained calls for reasoning structured outputs》的核心思路（MIT），作为提示链在 API 层的一个现代实例。

推理模型刚发布时并不支持[结构化输出](https://platform.openai.com/docs/guides/structured-outputs/examples)，请求缺少可靠的类型安全，只能靠提示词本身约束模型返回可用的 JSON。Cookbook 给出的解法正是提示链：**把两个模型调用串起来，让每个调用做自己最擅长的一环**。

第一条链环：用推理模型完成"重活"——抓取某维基百科公司列表页，判断哪些公司最能从 AI 能力中受益，并要求以 JSON 格式返回。此时 JSON 只是提示词约定的产物：你需要手工把它解析进类型安全的结构，而且模型拒答时 API 也不会返回显式的拒答结构。

第二条链环：把第一步返回的文本喂给 `gpt-4o-mini`，对这次调用启用**结构化输出**（JSON Schema），由它负责把上游内容严格整理成带类型的目标结构。这样，链头负责推理与判断，链尾负责可靠的格式收敛：

```python
response = client.responses.parse(
    model="gpt-4o-mini",
    input=[
        {"role": "user", "content": raw_text_from_previous_call},
    ],
    text_format=CompanyList,  # Pydantic 模型定义目标结构
)
```

Cookbook 的结论是：结构化输出让代码获得可靠的类型安全、让提示更简单，还能复用同一套 Schema 便于集成；通过把两次请求链在一起，可以复用 `gpt-4o-mini` 已有的结构化输出能力，而第二次小模型调用的成本相对上游推理模型的调用可以忽略不计。

> **译注（按 2026-09 现状校订）**：现行的推理模型已原生支持结构化输出（`responses.parse` / `text.format`，见《JSON Mode 与结构化输出》），上面"补一环做格式化"的写法已不再是必需。但它演示的链式分工思想——"重推理"与"轻格式化/轻校验"各占一环——在多步工作流里依然普遍适用，也正是本章与 ReAct 一脉相承的地方：复杂任务不靠一条巨型提示，而靠职责单一的环节串接。

## 小结

- 提示链 = 任务分解 + 环节串联：每个提示只负责一个子任务，上一环的输出是下一环的输入；
- 收益：性能更好（避免"一条提示干所有事"的互相干扰）、更透明（每环可单独调试）、更可控、更可靠；
- 文档问答的两段式（先抽引文、再作答）是最经典的链式模式，天然的延伸是"再补一环清理格式"；
- 在 API 层，链式调用可以和结构化输出组合：一环推理、一环收敛格式。

---

> **来源**：本文翻译自 [Prompt Chaining — Prompt Engineering Guide](https://www.promptingguide.ai/techniques/prompt_chaining)，作者 DAIR.AI（Elvis Saravia），许可 MIT（对应仓库 dair-ai/Prompt-Engineering-Guide）；"补充"一节翻译自 [Using chained calls for reasoning structured outputs](https://cookbook.openai.com/examples/o1/using_chained_calls_for_o1_structured_outputs)（OpenAI Cookbook，MIT）。抓取于 2026-09-13。
