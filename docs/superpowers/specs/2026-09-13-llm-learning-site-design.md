# 设计文档：LLM 应用开发完全学习路线（VitePress 学习站）

日期：2026-09-13
状态：已获用户批准（经 6 轮问答迭代定稿）

## 1. 目标与读者

构建一个 VitePress 中文学习网站「LLM 应用开发完全学习路线」，内容全部来自网络优质教程的**抓取（中文）或翻译（英文）**，非原创教程。面向从零基础到入门 LLM 应用开发的读者，一条路线走完：开发者内功 → LLM 应用开发 → AI 时代工作方式。

每篇文章必须署名：原作者、原文链接、抓取/翻译日期；英文资料标注"翻译自"。

## 2. 站点结构（3 板块 · 12 模块 · 约 175 篇）

### 第一部分 · 开发者内功（约 70 篇）

| # | 模块 | 目录 | 知识点覆盖 | 篇数 |
|---|---|---|---|---|
| 0 | Python 基础 | `00-python-basics/` | 环境搭建、变量与类型、数字/字符串、列表、元组、字典、集合、条件、循环、函数与参数、lambda/高阶函数、类与对象、继承/多态/魔法方法、模块与包、异常、文件 IO、JSON/时间处理、pip 与虚拟环境 | ~18 |
| 1 | 数据结构与算法 | `01-dsa/` | 复杂度分析、数组、链表、栈、队列、哈希表、树、二叉树遍历、BST、堆、图、DFS/BFS、冒泡/插入/快排/归并、二分查找、双指针、滑动窗口、递归与回溯、动态规划、贪心 | ~19 |
| 2 | 计算机基础 | `02-cs-fundamentals/` | 操作系统（概述、进程、线程、调度、内存管理、虚拟内存、文件系统、并发与锁）、计算机网络（分层模型、TCP、UDP、HTTP、HTTPS、DNS、REST）、Linux（常用命令、Shell 入门、权限、SSH）。**来源排除小林 coding，优先英文一手资料翻译** | ~19 |
| 3 | Python 进阶与框架 | `03-python-advanced/` | 装饰器、迭代器/生成器、上下文管理器、asyncio、类型注解、requests/httpx、Pydantic、FastAPI、Flask、Gradio、Streamlit、pytest、日志、uv/poetry 工程化 | ~14 |

### 第二部分 · LLM 应用开发（约 91 篇）

| # | 模块 | 目录 | 知识点覆盖 | 篇数 |
|---|---|---|---|---|
| 4 | LLM 基础 | `04-llm-basics/` | Transformer/注意力、GPT 演进、Token 与上下文窗口、采样参数、主流模型对比、幻觉、推理模型 | ~10 |
| 5 | Prompt 工程 | `05-prompt-engineering/` | 提示词结构、零/少样本、CoT、自洽性、ReAct 提示、结构化输出、系统提示、攻击与防护、多模态提示 | ~10 |
| 6 | API 与应用开发 | `06-api-development/` | 首个 API 调用、流式输出、Function Calling/Tool Use、JSON Mode、Embedding API、视觉 API、错误重试与限流、多轮会话管理、成本优化、LangChain 入门、LiteLLM、实战项目 | ~13 |
| 7 | 数据库 | `07-databases/` | 关系模型与 SQL 入门、增删改查、JOIN、索引、事务、SQLite、PostgreSQL 入门、SQLAlchemy、Redis、MongoDB、向量库原理、Milvus/Chroma/Qdrant/pgvector、选型对比 | ~15 |
| 8 | RAG | `08-rag/` | 什么是 RAG、Embedding 深入、分块策略、向量检索、RAG 全流程实战、评估、混合检索、rerank、Query 改写、多模态 RAG、GraphRAG、Agentic RAG、常见问题排查 | ~14 |
| 9 | Agent | `09-agents/` | Agent 概念、ReAct、Tool Use 实战、规划与记忆、MCP 协议、Function Calling vs MCP、多智能体、LangGraph、AutoGen/CrewAI、OpenAI Agents SDK、代码解释器、Computer Use、生产化 | ~17 |
| 10 | 微调与部署 | `10-finetuning-deployment/` | 微调 vs RAG、全参微调、LoRA/QLoRA、数据准备、PEFT 实战、量化、Ollama、vLLM、本地模型选择、评测、多模态模型、安全与合规 | ~12 |

### 第三部分 · AI 时代工作方式（约 14 篇）

| # | 模块 | 目录 | 知识点覆盖 | 篇数 |
|---|---|---|---|---|
| 11 | Vibe Coding | `11-vibe-coding/` | Vibe Coding 概念与争议、AI 编程工具全景（Cursor/Claude Code/Copilot/Cline/Windsurf）、提示词驱动开发工作流、CLAUDE.md/AGENTS.md 规范文件、Spec 驱动开发、上下文工程、Cursor Rules、MCP 在编码中的应用、AI 代码审查、TDD with AI、多智能体协作编码、安全与代码质量陷阱、从 0 到 1 用 AI 做产品实战 | ~14 |

## 3. 内容来源与抓取策略

- **批量优先**：能从整本开源书的 GitHub raw Markdown 批量获取的，优先脚本化批量拉取（如 hello-algo、DataWhale 系列：llm-universe / happy-llm / self-llm / llm-cookbook，其开源协议允许转载）。这是数量与可靠性的主力。
- **英文来源（翻译收录）**：模块 2 优先 OSTEP、Beej's Guide to Network Concepts、Cloudflare Learning Center、MDN、MIT Missing Semester、The Linux Command Line；LLM 各模块优先 OpenAI Cookbook、Anthropic 文档/最佳实践、Hugging Face 教程、LangChain/LangGraph 文档、Lilian Weng 博客、Cursor 官方文档、Geoffrey Huntley 系列。逐篇核对许可（如 OSTEP 允许非商业翻译并需署名），翻译后标注"翻译自 + 原文链接"。
- **网页抓取**：其余用网页抓取（HTML→Markdown）。
- **反爬替换**：知乎、微信公众号等抓不到的站点，替换为同主题可抓取文章，保证总数。
- **frontmatter 契约**：每篇 md 头部含 `title / source_url / author / license / fetched_at / translated(bool)`；页面顶部渲染来源署名卡片。
- **失败记录**：抓取失败的 URL 记入 `sources-report.md` 并说明替代。

## 4. 技术实现

- VitePress 1.x 默认主题 + local search；首页 Hero + 12 模块路线图卡片；侧边栏按 3 板块 12 模块分组，顺序即学习顺序。
- 项目根：`~/.zcode/workspace/default/llm-learning-site/`，站点文档在 `docs/`。
- 抓取转换：Node 脚本（GitHub raw 批量）+ 网页抓取转换；英文篇由 AI 翻译为中文后收录。
- 不引入评论/统计等额外系统（YAGNI）。

## 5. 验证与交付

- `vitepress build` 通过（含死链检查）为完成标准。
- 交付：本地预览地址（`npm run docs:dev`）、`sources-report.md` 文章清单（来源/许可/翻译状态）。
- 构建后用 judge 对渲染页面做视觉验收。

## 6. 错误处理

- 单篇抓取失败不阻塞整体：记录、替换、继续。
- 目录/侧边栏由脚本从 frontmatter 生成一致性检查，避免死链。

## 7. 范围外

- 不写原创教程正文（路线图页、模块导读页允许少量原创组织性文字）。
- 不做用户系统、评论、部署上线（仅本地构建与预览）。
