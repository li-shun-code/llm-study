---
title: 长时运行 Agent 的上下文管理：压缩（Compaction）
source_url: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
author: Anthropic Engineering、LangChain 团队（LangChain / Deep Agents 官方文档）、Anthropic（Claude Code 官方文档）
license: 原文页面未附开源许可，按署名转载处理（LangChain 文档部分为 MIT）
fetched_at: 2026-09-13
translated: true
versions: docs.langchain.com 当前版（LangChain 1.x / Deep Agents）；Claude Code 文档 v2.1.x（2026-09）
order: 11
---

本模块第 1 篇讲过上下文窗口是 Agent 的"工作内存"；模块 5 已全文翻译过 Anthropic《Effective context engineering for AI agents》的通论部分。这一篇聚焦其中与**长时运行 Agent**最相关的技术——**压缩（Compaction）**，并整合 LangChain/Deep Agents 官方文档与 Claude Code 官方文档中的对应内容，构成"原理 → 框架实现 → 产品实践"三层对照。全文逐节署名。

# 长时程任务的上下文工程（译自 Anthropic Engineering《Effective context engineering for AI agents》"Context engineering for long-horizon tasks"一节）

长时程任务（long-horizon tasks）要求智能体在动作序列中维持连贯性、上下文与目标导向的行为，而这些序列的 token 量会超过 LLM 的上下文窗口。对于持续工作数十分钟到数小时的任务——比如大型代码库迁移或综合性研究项目——智能体需要专门的技术来绕开上下文窗口大小的限制。

等待更大的上下文窗口看似是显而易见的策略。但很可能在可预见的未来，各种尺寸的上下文窗口都将受制于上下文污染（context pollution）与信息相关性问题——至少在你追求最强智能体表现的情况下如此。为了让智能体在更长的时间跨度内有效工作，我们开发了几个直接应对上下文污染约束的技术：**压缩（compaction）**、**结构化记笔记（structured note-taking）**与**多智能体架构（multi-agent architectures）**。

## 压缩（Compaction）

压缩是指：当对话接近上下文窗口上限时，对内容做摘要，然后用摘要重新启动一个新的上下文窗口。压缩通常是上下文工程中改善长期连贯性的第一根杠杆。其核心是以高保真的方式蒸馏上下文窗口的内容，让智能体在性能几乎不退化的情况下继续工作。

以 Claude Code 为例，我们通过把消息历史传给模型来摘要并压缩最关键的细节。模型保留架构决策、未解决的 bug 与实现细节，同时丢弃冗余的工具输出或消息。智能体随后可以带着这份压缩后的上下文加上最近访问的五个文件继续工作。用户获得了连续性，而不必担心上下文窗口限制。

压缩的艺术在于"保留什么、丢弃什么"的选择：过度激进的压缩会丢失那些微妙但关键的上下文，其重要性往往到后面才显现。对实现压缩系统的工程师，我们建议在复杂的智能体轨迹上仔细调优你的提示词。先把召回率最大化——确保压缩提示词捕获轨迹中每一条相关信息；再迭代改进精确率——剔除多余内容。

一个唾手可得的多余内容例子是清理工具调用与结果——当某个工具早在消息历史深处被调用过之后，智能体为什么还需要再看一次原始结果？最安全、最轻量的压缩形式就是工具结果清理（tool result clearing），该能力最近已作为 [Claude Developer Platform 的功能](https://www.anthropic.com/news/context-management)上线。

## 结构化记笔记（Structured Note-taking）

结构化记笔记，或称智能体记忆（agentic memory），是指智能体定期把笔记写入上下文窗口之外的持久化存储，并在之后的时刻重新拉回上下文窗口。

这一策略以最小开销提供持久记忆。就像 Claude Code 创建待办清单，或你的自定义智能体维护一个 NOTES.md 文件，这个简单的模式让智能体在复杂任务中跟踪进度，保住那些否则会在数十次工具调用间丢失的关键上下文与依赖关系。

[Claude 玩宝可梦](https://www.twitch.tv/claudeplayspokemon)演示了记忆如何在非编码领域转变智能体能力：该智能体在数千个游戏步骤间维持精确的计数——追踪"过去 1234 步我一直在 1 号道路训练我的宝可梦，皮卡丘已朝 10 级目标升了 8 级"这样的目标。没有任何关于记忆结构的提示，它自行发展出已探索区域的地图、记住已解锁的关键成就、维护战斗策略笔记，学会对不同对手哪些招式最有效。

在上下文重置后，智能体阅读自己的笔记，继续数小时的训练序列或地宫探索。这种跨越摘要步骤的连贯性，使长时程策略成为可能——只靠 LLM 上下文窗口装下所有信息是做不到的。

作为 [Sonnet 4.5 发布](https://www.anthropic.com/effective-context-engineering-for-ai-agents)的一部分，我们在 Claude Developer Platform 上以公开测试版发布了[记忆工具](http://anthropic.com/news/context-management)，通过基于文件的系统更轻松地在上下文窗口之外存储与查阅信息。这让智能体得以随时间积累知识库、跨会话维持项目状态、引用以往工作，而不必把一切都留在上下文里。

## 子代理架构（Sub-agent Architectures）

子代理架构提供了绕开上下文限制的另一条路。与其让一个智能体试图在整个项目期间维持状态，不如让专职子代理以干净的上下文窗口处理聚焦的任务。主智能体依据高层计划进行协调，子代理执行深入的技术工作或用工具检索相关信息。每个子代理可能大量探索、消耗数万 token 或更多，但只返回一份浓缩的、蒸馏过的工作摘要（通常 1000–2000 token）。

这种方式实现了清晰的关注点分离——详细的搜索上下文被隔离在子代理内部，而主智能体专注于综合与分析结果。这一模式（见《How we built our multi-agent research system》）在复杂研究任务上比单智能体系统展现出显著优势。

如何选择取决于任务特征：

- **压缩**适合需要大量来回交互的任务，维持对话流；
- **记笔记**擅长有清晰里程碑的迭代式开发；
- **多智能体架构**处理可从并行探索中获益的复杂研究与分析。

即使模型持续进步，在长时间交互中维持连贯性的挑战仍将是构建更高效智能体的核心。

# LangChain 与 Deep Agents 中的摘要压缩（译自 LangChain 官方文档）

## 生命周期上下文：SummarizationMiddleware（译自 docs.langchain.com "Context engineering in agents" 一页的 Life-cycle context 部分）

生命周期上下文（Life-cycle context）控制核心 Agent 步骤**之间**发生的事——拦截数据流以实现摘要（summarization）、护栏、日志等横切关注点。

中间件（middleware）是让上下文工程落地的机制：它允许你挂入智能体生命周期的任何一步，并且可以：

1. **更新上下文**——修改 state 与 store 以持久化变更、更新对话历史或保存洞见；
2. **在生命周期中跳转**——基于上下文移动到智能体周期的不同步骤（例如条件满足时跳过工具执行，或带着修改过的上下文重复模型调用）。

最常见的生命周期模式之一，是在对话过长时自动压缩历史。与模型上下文一节展示的"瞬态消息裁剪"不同，摘要会**持久更新 state**——用一条摘要永久替换旧消息，供之后所有轮次使用。

LangChain 为此内置了中间件：

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware

agent = create_agent(
    model="gpt-5.4-mini",
    tools=[...],
    middleware=[
        SummarizationMiddleware(
            model="gpt-5.4-mini",
            max_tokens=4000,
            keep=("messages", 20),
        ),
    ],
)
```

当对话超过 token 上限时，`SummarizationMiddleware` 自动：

1. 用一次独立的 LLM 调用摘要较旧的消息；
2. 在 State 中用摘要消息**永久**替换它们；
3. 保留最近的消息原样作为上下文。

被摘要后的对话历史已永久更新——未来的轮次看到的是摘要而非原始消息。

## Deep Agents 的内建上下文压缩（译自 docs.langchain.com Deep Agents "Context engineering" 一页的 Context compression 部分）

每次 `create_deep_agent` 调用都自带内建上下文压缩——你不需要为了卸载（offloading）或摘要（summarization）而额外添加中间件。

长时运行任务会产生巨大的工具输出与漫长的对话历史。上下文压缩在保留与任务相关细节的同时，缩小智能体工作内存中的信息量。以下是保证传给 LLM 的上下文不超过其窗口上限的内建机制：

- **卸载（Offloading）**：大的工具输入与结果存入文件系统，替换为引用；
- **摘要（Summarization）**：接近上限时，旧消息被压缩成 LLM 生成的摘要。

### 卸载（Offloading）

Deep Agents 使用内建文件系统工具自动卸载内容，并按需搜索、取回被卸载的内容。当工具调用输入或结果超过 token 阈值（默认 20,000）时触发：

1. **工具调用输入超过 20,000 token**：文件写入与编辑操作会把完整文件内容留在会话历史的工具调用里。既然内容已经持久化到文件系统，这些往往是冗余的。当会话上下文超过模型可用窗口的 85% 时，deep agent 会截断较旧的工具调用，替换为指向磁盘文件的指针，缩减活跃上下文；
2. **工具调用结果超过 20,000 token**：deep agent 把响应卸载到配置的后端，替换为文件路径引用与前 10 行预览。智能体之后可以按需重读或搜索该内容。

> 内建压缩不会缩放图片、降低图片分辨率或生成视觉嵌入。多模态输入详见官方 Multimodal 文档。

### 摘要（Summarization）

每次 `create_deep_agent` 的裸栈（bare stack）中都包含 `SummarizationMiddleware`。当上下文越过模型窗口上限（例如 `max_input_tokens` 的 85%）、且没有更多可卸载的上下文时，deep agent 自动摘要消息历史。

这个过程有两个组成部分：

- **上下文内摘要**：LLM 生成一份结构化摘要，包含会话意图、已创建的产物与下一步——它替换智能体工作内存中的完整对话历史；
- **文件系统保全**：原始对话消息的文本渲染会被写入文件系统，作为权威记录。

这种双重方案保证智能体既维持对目标与进展的感知（经由摘要），又保留了在需要时找回文本细节的能力（经由文件系统搜索）。

**配置要点：**

- 在模型 `max_input_tokens` 的 85% 触发（来自 model profile）；
- 保留 10% 的 token 作为近期上下文；
- 若拿不到模型 profile，回退为 170,000 token 触发 / 保留 6 条消息；
- 任何模型调用抛出标准 `ContextOverflowError` 时，立即回退为"摘要 + 保留近期消息"重试；
- 较旧的消息交给模型摘要。

流式场景下，摘要步骤产生的 token 通常也会出现在流里，可用其元数据过滤（`metadata.get("lc_source") == "summarization"` 时跳过）。

### 按需压缩工具（On-demand compaction tool）

默认情况下，自动摘要在上下文阈值达到时运行。除此之外，你还可以给智能体一个 `compact_conversation` 工具，让它在任务间隙等时机**按需**触发压缩，而不必等到 85% 阈值。启用方式是把 `create_summarization_tool_middleware` 通过 `create_deep_agent` 的 `middleware` 参数传入：

```python
from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from deepagents.middleware.summarization import create_summarization_tool_middleware

backend = StateBackend  # 使用默认后端时

agent = create_deep_agent(
    model="anthropic:claude-sonnet-4-6",
    middleware=[
        create_summarization_tool_middleware(model, backend),
    ],
)
```

添加压缩工具不会关掉 85% 阈值的自动摘要。两者共用同一摘要引擎与状态。

# Claude Code 中的压缩实践（译自 Claude Code 官方文档）

## 压缩是什么（译自 Glossary "Compaction" 词条）

**压缩（Compaction）**：当上下文窗口接近上限时，对会话自动做摘要。较旧的工具输出先被清理，然后对话被摘要。项目根目录的 CLAUDE.md 与自动记忆（auto memory）在压缩后幸存并从磁盘重新加载；仅在对话中给出过的指令则可能丢失。手动触发用 `/compact`，可附加聚焦指令，如 `/compact focus on the API changes`。

## 降低 token 消耗（译自 "Manage costs effectively" 一页的 Reduce token usage 部分）

Token 成本随上下文大小而扩展：Claude 处理的上下文越多，你消耗的 token 越多。Claude Code 通过提示缓存与自动压缩（auto-compaction，接近上下文上限时摘要对话历史）自动优化成本。

- **任务间清理**：切换到无关工作时用 `/clear` 全新开始。陈旧上下文会让之后的每条消息都白白消耗 token。清理前可先 `/rename` 以便日后找回会话，需要时 `/resume` 恢复；
- **自定义压缩指令**：`/compact Focus on code samples and API usage` 告诉 Claude 摘要时保留什么。全新会话中运行 `/compact` 会打印 `Not enough messages to compact.`，因为还没有可摘要的历史。

也可以在项目根目录的 CLAUDE.md 中定制压缩行为：

```markdown
# Compact instructions

When you are using compact, please focus on test output and code changes
```

## 压缩后什么能幸存（译自 "Explore the context window" 一页的 What survives compaction 部分）

长会话触发压缩时，Claude Code 摘要对话历史以适配上下文窗口。自 v2.1.198 起，摘要请求继承会话的扩展思考（extended thinking）配置；思考只影响摘要的生成方式，会话设置本身不变。各类内容的去向取决于其加载方式：

| 机制 | 压缩之后 |
| :--- | :--- |
| 系统提示与输出风格 | 两者仍然生效 |
| 项目根 CLAUDE.md 与无作用域规则 | 从磁盘重新注入 |
| 自动记忆（Auto memory） | 从磁盘重新注入 |
| Claude 在计划模式（plan mode）写下的计划 | 从磁盘重新注入 |
| 带 `paths:` frontmatter 的规则 | 当 Claude 读取匹配的文件时重新加载 |
| 子目录中的嵌套 CLAUDE.md | 当 Claude 读取该子目录文件时重新加载 |
| Claude 读过或编辑过的文件 | 重读最多五个，最近修改的优先 |
| 已调用技能（skill）的正文 | 重新注入，每个技能上限 5,000 token、总计 25,000 token；最旧的先丢弃 |
| 此前由钩子（hooks）添加的上下文 | 与其余对话一起被摘要 |
| 匹配 `compact` 来源的 SessionStart 钩子 | Claude Code 运行它们并把输出加入压缩后的上下文 |

路径作用域规则与嵌套 CLAUDE.md 在触发文件被读取时才进入消息历史，因此会随其他内容一起被摘要掉。压缩刚结束，Claude Code 会重读本会话中 Claude 读过或编辑过的最多五个文件（优先最近修改的），并重新加载适用于这些文件的规则与嵌套 CLAUDE.md。超过 5,000 token 的文件回来时只带路径引用（显示为 `Referenced file` 而非 `Read`），其规则仍会重新加载。若某条规则必须跨压缩幸存，去掉 `paths:` frontmatter 或把它移到项目根 CLAUDE.md。

技能正文压缩后会被重新注入，但过大的技能会被截断以适配单技能上限；超出总预算时最旧的先被丢弃。截断保留文件开头，因此要把最重要的指令放在 `SKILL.md` 靠前的位置。

## 自动压缩窗口（译自 "Model configuration" 一页的 Context window and auto-compaction 部分）

**自动压缩窗口（auto-compact window）**指上下文窗口在被压缩前允许被填到多满。设置窗口的三种方式：

- **对本次及以后的会话**：运行 `/autocompact 500k` 这样的命令。Claude Code 将其保存到用户设置的 `autoCompactWindow` 并应用于当前会话；若更高优先级的设置作用域（如托管设置）已设该键，命令会保存你的值但会话仍沿用该作用域的窗口，并如实提示。`/autocompact auto` 恢复为模型调优的默认窗口；
- **单次启动**：启动时传 `--autocompact`。该标志仅覆盖本次启动而不改动保存的设置；
- **脚本与云端环境**：设置环境变量 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`。设置后优先级高于命令、标志与设置项。

窗口大小接受 100K 到 1M token：纯数字（`200000`）、带 `k`/`M` 后缀（`500k`、`1M`）、或 100–1000 之间的裸数字（表示千，`200` 即 200,000）。窗口上限不会超过模型的上下文窗口。

**默认阈值**：未设置时，对话到达模型上下文上限才压缩，例外包括：Sonnet 4.6/Opus 4.6（未开扩展上下文）在 200K 边界压缩；原生 1M 窗口的模型（如 Sonnet 5）默认在约 967K token 时提前压缩，可用 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` 另设。

**主动压缩之外的手段**：

- **带焦点的压缩**：在开始长任务前运行 `/compact focus on the auth bug fix`，摘要保留你指定的内容而非自动猜测的重点；
- **压缩部分对话**：`/rewind` 选中消息后选择 **Summarize from here** 或 **Summarize up to here**；
- **更早压缩**：如 `/autocompact 500k` 提前设定触发点；
- **任务间清理**：切换任务时 `/clear`。

---

> **来源**：抓取于 2026-09-13。① 第一节译自 Anthropic Engineering《[Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)》（Erik Schluntz、Barry Zhang 等）中"Context engineering for long-horizon tasks"一节，作者 Anthropic，原文页面未附开源许可，按署名转载处理（本站模块 5 已有该文通论部分全文翻译，本篇按要求只取长时程 Agent 视角；该节"压缩/记笔记/子代理"三小节及取舍结论为全文翻译）；② 第二节译自 LangChain 官方文档 [Context engineering in agents](https://docs.langchain.com/oss/python/langchain/context-engineering) 的 Life-cycle context/Summarization 部分与 [Deep Agents: Context engineering](https://docs.langchain.com/oss/python/deepagents/context-engineering) 的 Context compression 部分，作者 LangChain 团队，许可 MIT（原文 MDX 布局组件、图片与多供应商重复的示例代码块未逐一保留，仅在文中保留一份代表性代码；其余知识内容完整翻译）；③ 第三节译自 Claude Code 官方文档 [Glossary](https://code.claude.com/docs/en/glossary)、[Manage costs effectively](https://code.claude.com/docs/en/costs)、[Explore the context window](https://code.claude.com/docs/en/context-window)、[Model configuration](https://code.claude.com/docs/en/model-config) 四页的压缩相关内容，作者 Anthropic，原文页面未附开源许可，按署名转载处理（网关/自定义模型 ID 的窗口修正等与压缩无关的细节未译，已注明；表格为全文翻译）。各节之间的导语与小结为本篇编者注，不属原文。
