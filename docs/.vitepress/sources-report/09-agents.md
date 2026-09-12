# 模块 9 · Agent（09-agents）来源报告

抓取日期：2026-09-13。目标 ≥17 篇，实际完成 **18 篇**（知识点 01-18 每点一篇），全部通过 `node scripts/check-frontmatter.mjs docs/09-agents`。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Lilian Weng, Lil'Log](https://lilianweng.github.io/posts/2023-06-23-agent/)《LLM Powered Autonomous Agents》(2023-06) | 01 什么是 Agent（全文翻译，含编者注说明 2023 年语境与历史性产品示例） | CC BY-NC 4.0 | frontmatter + 文首署名块 |
| [Hugging Face Agents Course](https://huggingface.co/learn/agents-course)（GitHub raw：units/en/unit1 的 thoughts/observations/tools/actions.mdx） | 02 ReAct 范式（thoughts+observations 两节）、03 Tool Use 实战（tools+actions 两节），全文翻译 | Apache 2.0 | 每篇 frontmatter + 署名块 |
| [Anthropic Engineering《Building Effective Agents》](https://www.anthropic.com/research/building-effective-agents)（Erik Schluntz、Barry Zhang, 2024-12-19） | 04 规划与任务分解（全文翻译，含 Anthropic 2026 更新提示） | 原文页面未附开源许可，按署名转载处理 | frontmatter + 署名块 |
| [LangGraph 官方文档](https://docs.langchain.com/oss/python/langgraph)（docs.langchain.com，add-memory/quickstart/interrupts 三页） | 05 记忆机制、10 LangGraph 入门、11 Human-in-the-loop（全文翻译；05 略去与 Postgres 同构的其他数据库示例代码及超长输出转储，11 略去重复折叠示例，均已在署名块标注） | MIT | 每篇 frontmatter + 署名块 |
| [MCP 官方文档](https://modelcontextprotocol.io/llms.txt)（2026-07-28 版规范：intro/architecture/build-server 页，站点直接提供 .md 源文件） | 06 MCP 协议详解（intro+architecture 全文翻译）、07 MCP server 实战（build-server 的 Python 路线全文翻译） | MIT | 每篇 frontmatter + 署名块 |
| [OpenAI Agents SDK](https://github.com/openai/openai-agents-python)（raw README + raw docs/mcp.md） | 08 Function Calling vs MCP（docs/mcp.md 全文翻译 + 编者对比综述）、13 OpenAI Agents SDK（README 全文翻译） | MIT | 每篇 frontmatter + 署名块 |
| [Anthropic Engineering《How we built our multi-agent research system》](https://www.anthropic.com/engineering/built-multi-agent-research-system)（Jeremy Hadfield 等, 2025-06-13） | 09 多智能体模式（全文翻译） | 原文页面未附开源许可，按署名转载处理 | frontmatter + 署名块 |
| [microsoft/agent-framework](https://github.com/microsoft/agent-framework) README（raw） | 12 主来源之一（**AutoGen 已并入 Microsoft Agent Framework 的现状**全文翻译；迁移指南链接来自原文） | MIT | 12 frontmatter + 署名块并列标注 |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) README（raw） | 12 主来源之一（Crews/Flows、安装、JSON-first 脚手架部分翻译） | MIT | 12 frontmatter + 署名块并列标注 |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) README（raw） | 14 代码解释器型 Agent（全文翻译 + CodeAct 概念导语） | Apache 2.0 | frontmatter + 署名块 |
| [browser-use/browser-use](https://github.com/browser-use/browser-use) README（raw） | 15 Computer Use/浏览器操作 Agent（全文翻译 + 三条实现路线对比导语） | MIT | frontmatter + 署名块 |
| [LangSmith 官方文档](https://docs.langchain.com/langsmith)（observability-concepts/observability-quickstart 页，.md 源文件） | 16 可观测性与 Tracing（两页全文翻译；Langfuse/OpenTelemetry 生态段落为编者综述） | MIT | frontmatter + 署名块 |
| [LangSmith《How to evaluate agents》](https://docs.langchain.com/langsmith/evaluate-llm-application)（.md 源文件） | 17 Agent 评测（Python 路线全文翻译；方法论一节引用第 9 篇 Anthropic 评估经验） | MIT | frontmatter + 署名块 |
| [microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners) 第 10 课（raw，README） | 18 生产化与成本部分（关键指标/常见问题/成本管理三节翻译） | MIT | 18 frontmatter + 署名块并列标注 |
| [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)（2026-07-28 版） | 18 安全与权限部分（五类攻击与缓解翻译，含准确级别 MUST/SHOULD 保留） | MIT | 18 frontmatter + 署名块并列标注 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| HF Agents Course 网页版 | huggingface.co/learn/agents-course/unit1/... | 站点为 JS 渲染，curl 抓不到正文；Web Reader 工具限流 | 改用课程官方仓库 raw mdx（huggingface/agents-course，units/en/unit1/*），内容与网页一致 |
| LangGraph 旧文档站 | langchain-ai.github.io/langgraph/concepts/memory 等 | 文档已整体迁移（返回 Redirecting 页面） | 改用新官方文档站 docs.langchain.com 的对应页面（.md 源文件直抓成功） |
| LangSmith 旧文档站 | docs.smith.langchain.com/observability/concepts/tracing.md | 308 重定向 | 跟随重定向至 docs.langchain.com/langsmith/*，.md 源文件抓取成功 |
| Langfuse docs | langfuse.com/docs/tracing、langfuse.com/llms.txt | curl 返回空响应（连接失败/反爬） | 16 改用 LangSmith 官方文档为主来源；Langfuse/OpenTelemetry 部分以编者综述呈现（仅概述，不引用其正文），已在署名块标注 |
| MCP docs 网页版 | modelcontextprotocol.io/docs/getting-started/intro（HTML） | Mintlify JS 壳，正文抓不全 | 发现站点提供 llms.txt 与 .md 源文件（modelcontextprotocol.io/docs/2026-07-28/*.md），全部改走 .md 直抓 |
| GitHub API 核实文件名 | api.github.com/repos/... | 未认证请求限流（rate limit exceeded） | 改用 raw.githubusercontent.com 逐个探测文件名（200/404）核实，未影响任何一篇的抓取 |
| NirDiamant/GenAI_Agents notebooks（候选来源） | raw.githubusercontent.com/NirDiamant/GenAI_Agents/... | 未采用：18 篇知识点已由官方一手文档覆盖，notebook 为二手实现示例 | 由上述官方文档与课程替代 |

## 时效性核实与改写记录（硬约束执行）

抓取时点 2026-09-13。全部内容按当前稳定版校订：

| 主题 | 处理方式 |
| --- | --- |
| LangChain/LangGraph ≥1.0 | 10/11/05 三篇全部采用 docs.langchain.com 当前版：`langchain.messages` 新导入路径、`init_chat_model`、`stream_events(..., version="v3")`、`Runtime`/`context_schema` 新写法；未收旧版 `create_react_agent` 快捷方式教程 |
| MCP 规范 | 06/07/18 按 2026-07-28 最新版规范：`server/discover` 无状态发现、Sampling/Logging 废弃、`subscriptions/listen` 通知模式；07 按 Python MCP SDK 2.0+ 的 `MCPServer` 新写法（含 `httpx2`） |
| OpenAI | 13 按 Agents SDK 当前版（含 SandboxAgent、`gpt-realtime-2.1` RealtimeAgent、Responses API 托管工具）；08 按 SDK 当前 MCP 集成（含 MCP Python SDK v1/v2 兼容说明）；Assistants API 未出现 |
| AutoGen 现状 | 12 显式标注 AutoGen（与 Semantic Kernel）已并入 Microsoft Agent Framework，仓库定位转为研究/历史，生产开发在 microsoft/agent-framework，并附官方迁移指南链接 |
| 17/18 的模型名 | 保留原文中出现的当前模型字符串（gpt-5.4-mini、claude-haiku-4-5 等），并注明读者可替换为任意 OpenAI 兼容端点 |
| Lilian Weng 2023 文 | 01 文首加编者注：三大组件框架为概念地基，AutoGPT/ChatGPT Plugins 等示例属历史脉络，最新工具链由本模块后续篇目展开 |
