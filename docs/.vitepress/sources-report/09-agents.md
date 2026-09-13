# 模块 9 · Agent（09-agents）来源报告

抓取日期：2026-09-13（本次补充与重做）。目标 21 篇（18 篇既有 + 3 篇新增），全部通过 `node scripts/check-frontmatter.mjs docs/09-agents`（PASS, 21 articles）。

## 本次变更概览

- **新增 3 篇**：07 A2A 协议与跨厂商互操作、10 长期记忆系统进阶（Mem0/Letta/Zep）、11 长时运行 Agent 的上下文管理（compaction）；
- **重排**：原 07–18 顺延为 08–21（两段式重命名），frontmatter order 同步；
- 全部新增内容均为 GitHub 官方仓库/官方文档的**完整翻译**，编者内容仅限导语、节间衔接与署名块内的说明，逐节署名见各篇文末。

## 来源与许可（含既有篇目）

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Lilian Weng, Lil'Log](https://lilianweng.github.io/posts/2023-06-23-agent/)《LLM Powered Autonomous Agents》(2023-06) | 01 什么是 Agent（全文翻译，含编者注说明 2023 年语境） | CC BY-NC 4.0 | frontmatter + 文末署名块 |
| [Hugging Face Agents Course](https://huggingface.co/learn/agents-course)（GitHub raw：units/en/unit1） | 02 ReAct 范式、03 Tool Use 实战（全文翻译） | Apache 2.0 | 每篇 frontmatter + 署名块 |
| [Anthropic Engineering《Building Effective Agents》](https://www.anthropic.com/research/building-effective-agents) | 08 规划与任务分解（原 04，全文翻译） | 未附开源许可，署名转载 | frontmatter + 署名块 |
| [LangGraph 官方文档](https://docs.langchain.com/oss/python/langgraph) | 09 记忆机制（原 05）、13 LangGraph 入门（原 10）、14 Human-in-the-loop（原 11） | MIT | 每篇 frontmatter + 署名块 |
| [MCP 官方文档](https://modelcontextprotocol.io/llms.txt)（2026-07-28 版） | 05 MCP 协议详解、06 MCP server 实战 | MIT | 每篇 frontmatter + 署名块 |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | 04 Function Calling vs MCP、16 OpenAI Agents SDK（原 13） | MIT | 每篇 frontmatter + 署名块 |
| [Anthropic Engineering《How we built our multi-agent research system》](https://www.anthropic.com/engineering/built-multi-agent-research-system) | 12 多智能体模式（原 09，全文翻译） | 未附开源许可，署名转载 | frontmatter + 署名块 |
| [microsoft/agent-framework](https://github.com/microsoft/agent-framework)、[crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) README | 15 AutoGen 与 CrewAI 现状（原 12） | MIT | frontmatter + 署名块并列标注 |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) README | 17 代码解释器型 Agent（原 14，全文翻译） | Apache 2.0 | frontmatter + 署名块 |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) README | 18 Computer Use Agent（原 15，全文翻译） | MIT | frontmatter + 署名块 |
| [LangSmith 官方文档](https://docs.langchain.com/langsmith) | 19 可观测性（原 16）、20 Agent 评测（原 17） | MIT | frontmatter + 署名块 |
| [microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners) 第 10 课 + MCP Security Best Practices | 21 生产化与安全（原 18） | MIT | frontmatter + 署名块并列标注 |
| [a2aproject/A2A](https://github.com/a2aproject/A2A) 官方仓库 README + docs/ 目录（what-is-a2a、key-concepts、a2a-and-mcp；与 a2a-protocol.org 文档站同源） | **07 新增**：A2A 协议与跨厂商 Agent 互操作（README 全译 + 三篇官方文档全译，含 mermaid 时序图） | Apache 2.0（仓库 LICENSE 核实） | 07 frontmatter + 文末逐节署名 |
| [mem0ai/mem0](https://github.com/mem0ai/mem0) README（raw，含 2026-04 新记忆算法与 LoCoMo/LongMemEval/BEAM 基准） | **10 新增**之一：Mem0 节全文翻译 | Apache 2.0 | 10 frontmatter + 文末逐节署名 |
| [letta-ai/letta](https://github.com/letta-ai/letta) README（raw，letta-code 当前形态 + archive 分支说明） | **10 新增**之二：Letta 节全文翻译 | Apache 2.0 | 10 frontmatter + 文末逐节署名 |
| [getzep/zep](https://github.com/getzep/zep) README（raw，Zep Cloud 示例与集成仓库 + Graphiti 指引） | **10 新增**之三：Zep 节全文翻译 | Apache 2.0 | 10 frontmatter + 文末逐节署名 |
| [Anthropic《Effective context engineering for AI agents》](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) "Context engineering for long-horizon tasks" 一节 | **11 新增**之一：compaction/结构化记笔记/子代理架构全译（模块 5 已有该文通论全文翻译，本篇按要求聚焦 Agent 视角） | 未附开源许可，署名转载 | 11 frontmatter + 文末逐节署名 |
| [LangChain 官方文档](https://docs.langchain.com/oss/python/langchain/context-engineering)（Life-cycle context/SummarizationMiddleware）+ [Deep Agents context-engineering](https://docs.langchain.com/oss/python/deepagents/context-engineering)（Context compression：offloading + summarization + 按需压缩工具） | **11 新增**之二：框架侧摘要压缩全译 | MIT | 11 frontmatter + 文末逐节署名 |
| [Claude Code 官方文档](https://code.claude.com/docs/en/compaction)（Glossary "Compaction"、costs 页 Reduce token usage、context-window 页 What survives compaction 全表、model-config 页 auto-compact window） | **11 新增**之三：产品侧压缩实践全译 | 未附开源许可，署名转载 | 11 frontmatter + 文末逐节署名 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| A2A 文档站 | a2a-protocol.org/latest/... | curl 连接失败（HTTP 000） | 官方仓库 docs/ 目录与文档站同源（mkdocs 源），经 raw/sparse clone 获取，内容一致 |
| Letta 文档站 | docs.letta.com | 未列入任务要求且 README 已给出当前入口 | 按 README 完整翻译，文档站以链接形式给出 |
| HF Agents Course 网页版 / LangGraph 旧文档站 / LangSmith 旧文档站 / Langfuse / MCP docs 网页版 / GitHub API | （同上次会话记录） | JS 渲染、整体迁移、限流等 | 维持上次会话的替代方案不变 |

## 时效性核实与改写记录

抓取时点 2026-09-13：

| 主题 | 处理方式 |
| --- | --- |
| A2A | 按仓库 main 分支当前版（README 含 2026 年 SDK 生态与 DeepLearning.AI 课程信息；文档为 latest 同源）；协议许可经仓库 LICENSE 文件核实为 Apache 2.0 |
| Mem0 | 按含"New Memory Algorithm (April 2026)"的当前版：ADD-only 单趟抽取、实体链接、多信号检索、时间推理；平台/开源版数字差异的原文免责说明如实保留 |
| Letta | 按当前版：letta-code（npm 安装、letta server、channels、Agent SDK）；V1 API 已退役进 archive 分支的现状如实翻译 |
| Zep | 按当前版：Community Edition 已废弃（legacy/），生产走向 Zep Cloud、开源图谱为 Graphiti |
| compaction | LangChain 部分为 docs.langchain.com 当前版（SummarizationMiddleware、Deep Agents 内建压缩 85% 阈值/20K 卸载阈值等当前参数）；Claude Code 部分为 v2.1.x 当前文档（What survives compaction 机制表为 v2.1.198 起行为、/autocompact 窗口 100K–1M、原生 1M 模型默认约 967K 提前压缩） |
| 既有 18 篇 | 未改动正文；仅重命名与 order 同步 |
