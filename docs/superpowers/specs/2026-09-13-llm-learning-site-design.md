# 设计文档：LLM 应用开发完全学习路线（VitePress 学习站）

日期：2026-09-13
状态：已获用户批准（经 6 轮问答迭代定稿）

## 1. 目标与读者

构建一个 VitePress 中文学习网站「LLM 应用开发完全学习路线」，内容全部来自网络优质教程的**抓取（中文）或翻译（英文）**，非原创教程。面向从零基础到入门 LLM 应用开发的读者，一条路线走完：开发者内功 → LLM 应用开发 → AI 时代工作方式。

每篇文章必须署名：原作者、原文链接、抓取/翻译日期；英文资料标注"翻译自"。

## 2. 站点结构（3 板块 · 12 模块 · 约 200 篇）

> **本节已被 2026-09-19 全站重排替代**：现为 5 板块 17 模块，每模块带子分组。见 `2026-09-19-restructure-design.md`。以下保留作历史决策记录。

> 2026-09-13 修订：经 CS 教学体系与 LLM 岗位需求双视角子代理审查后补充知识点（新增 Git、Docker、文档解析、Tracing、DPO、训练范式总览等；Flask 替换为 Docker）。

### 第一部分 · 开发者内功（约 84 篇）

| # | 模块 | 目录 | 知识点覆盖 | 篇数 |
|---|---|---|---|---|
| 0 | Python 基础 | `00-python-basics/` | 环境搭建、变量与类型、数字与字符串（含 f-string 与 UTF-8 编码）、列表推导式、列表、元组、字典、集合、条件、循环、函数与参数、lambda/高阶函数、类与对象、继承/多态/魔法方法、可变/不可变与深浅拷贝、模块与包、异常、文件 IO、JSON/时间处理、pip 与虚拟环境、环境变量与 API Key 管理（.env/python-dotenv） | ~22 |
| 1 | 数据结构与算法 | `01-dsa/` | 复杂度分析、数组、链表、栈、队列、哈希表、递归入门（前置于树）、树、二叉树遍历、BST、堆、图、DFS/BFS、拓扑排序（呼应 LangGraph DAG）、最短路径、排序（冒泡/插入/快排/归并）、二分查找、双指针与滑动窗口、递归与回溯（面试选学）、动态规划（面试选学）、贪心（面试选学） | ~21 |
| 2 | 计算机基础 | `02-cs-fundamentals/` | Linux 与工具前置（常用命令、Shell 入门、文件权限、SSH、Git 基础、分支/合并/PR 协作）；操作系统（概述、进程、线程、CPU 调度、内存管理、虚拟内存、文件系统、并发与锁、I/O 多路复用）；计算机网络（分层模型、TCP、UDP、HTTP、HTTPS、SSE 与 WebSocket、DNS、REST）。**来源排除小林 coding，优先英文一手资料翻译** | ~23 |
| 3 | Python 进阶与框架 | `03-python-advanced/` | 装饰器、迭代器/生成器、上下文管理器、并发编程（GIL/threading/concurrent.futures）、asyncio、类型注解、正则表达式、requests/httpx、Pydantic、FastAPI 入门与 API Key 鉴权、Docker 容器化、Gradio、Streamlit、pytest、日志、uv/poetry 工程化（Flask 移除：2026 岗位以 FastAPI 为主流，Docker 为生产化前置） | ~18 |

### 第二部分 · LLM 应用开发（约 104 篇）

| # | 模块 | 目录 | 知识点覆盖 | 篇数 |
|---|---|---|---|---|
| 4 | LLM 基础 | `04-llm-basics/` | Transformer/注意力、GPT 演进、Token 与上下文窗口（含 BPE/tiktoken 计数）、采样参数、训练范式总览（预训练→SFT→RLHF/DPO，为模块 5/10 铺垫）、主流模型对比、幻觉、推理模型 | ~11 |
| 5 | Prompt 工程 | `05-prompt-engineering/` | 提示词结构、零/少样本、CoT、自洽性、ReAct 提示、结构化输出、系统提示、攻击与防护、多模态提示 | ~10 |
| 6 | API 与应用开发 | `06-api-development/` | 首个 API 调用、消息角色与多轮会话管理、流式输出、Function Calling/Tool Use、JSON Mode、Embedding API、视觉 API、语音 API（ASR/TTS/Realtime，选学）、错误重试与限流、成本优化（**显式覆盖 Prompt Caching 与 Batch API**）、OpenAI 兼容端点与 LiteLLM、LangChain 入门、FastAPI 封装 LLM 服务、实战项目 | ~14 |
| 7 | 数据库 | `07-databases/` | 关系模型与 SQL 入门、E-R 建模与范式、增删改查、聚合与分组（GROUP BY/HAVING）、JOIN、索引、事务、SQLite、PostgreSQL 入门、SQLAlchemy（含连接池）、Redis、MongoDB、向量库原理、Milvus/Chroma/Qdrant/pgvector、选型对比 | ~17 |
| 8 | RAG | `08-rag/` | 什么是 RAG、文档解析与摄取（PDF/OCR/表格→文本，Docling/MinerU/Unstructured）、Embedding 深入、分块策略（含 Contextual Retrieval）、向量检索、RAG 全流程实战、评估、混合检索、rerank、Query 改写、多模态 RAG、GraphRAG、Agentic RAG、Text2SQL、常见问题排查 | ~16 |
| 9 | Agent | `09-agents/` | Agent 概念、ReAct、Tool Use 实战、规划与记忆、MCP 协议、MCP server 实战、Function Calling vs MCP、多智能体、LangGraph（含 Human-in-the-loop 中断恢复）、AutoGen/CrewAI（标注 AutoGen 已并入 Microsoft Agent Framework）、OpenAI Agents SDK、代码解释器、Computer Use、可观测性与 Tracing（Langfuse/LangSmith）、Agent 评测、安全与权限、生产化 | ~19 |
| 10 | 微调与部署 | `10-finetuning-deployment/` | 微调 vs RAG、训练范式与全参微调、GPU 环境基础（CUDA/显存估算/AutoDL/Colab）、LoRA、QLoRA、数据准备与合成、训练超参与过拟合诊断、PEFT/TRL 实战、DPO 与偏好优化、数据蒸馏与小模型训练、量化、推理原理（KV Cache/continuous batching/PagedAttention）、Ollama、vLLM（含 Docker 容器化部署）、本地模型选择、评测、安全与合规 | ~17 |

### 第三部分 · AI 时代工作方式（约 16 篇）

| # | 模块 | 目录 | 知识点覆盖 | 篇数 |
|---|---|---|---|---|
| 11 | Vibe Coding | `11-vibe-coding/` | Vibe Coding 概念与争议、AI 编程工具全景（Cursor/Claude Code/Copilot/Cline/Windsurf）、Claude Code 工作流与最佳实践、Cursor 入门与 Rules、CLAUDE.md/AGENTS.md 规范文件、Claude Skills（可复用技能包）、Git in AI 工作流（commit 存档/分支隔离实验/生成代码 review 流）、Spec 驱动开发、上下文工程、MCP 在编码中的应用、AI 代码审查、TDD with AI、多智能体协作编码、安全与代码质量陷阱、从 0 到 1 用 AI 做产品实战 | ~16 |

## 3. 内容来源与抓取策略

- **批量优先**：能从整本开源书的 GitHub raw Markdown 批量获取的，优先脚本化批量拉取（如 hello-algo、DataWhale 系列：llm-universe / happy-llm / self-llm / llm-cookbook，其开源协议允许转载）。这是数量与可靠性的主力。
- **英文来源（翻译收录）**：模块 2 优先 OSTEP、Beej's Guide to Network Concepts、Cloudflare Learning Center、MDN、MIT Missing Semester、The Linux Command Line；LLM 各模块优先 OpenAI Cookbook、Anthropic 文档/最佳实践、Hugging Face 教程、LangChain/LangGraph 文档、Lilian Weng 博客、Cursor 官方文档、Geoffrey Huntley 系列。逐篇核对许可（如 OSTEP 允许非商业翻译并需署名），翻译后标注"翻译自 + 原文链接"。
- **网页抓取**：其余用网页抓取（HTML→Markdown）。
- **反爬替换**：知乎、微信公众号等抓不到的站点，替换为同主题可抓取文章，保证总数。
- **技术时效性（硬性）**：内容以抓取时点（2026-09）最新稳定版为准：Python 3.13+、OpenAI Responses API 与 Chat Completions（Assistants API 已废弃不收）、LangChain ≥1.0、AutoGen 按 Microsoft Agent Framework 现状、vLLM V1、VitePress 最新稳定版；模型对比以抓取时最新模型为准。过时 API 仅可在"历史演进"语境中提及。每篇可选 `versions` frontmatter 记录版本。
- **frontmatter 契约**：每篇 md 头部含 `title / source_url / author / license / fetched_at / translated(bool)`；来源署名块渲染在文章**文末**（2026-09-13 调整：由顶部改为底部，用分隔线隔开）。
- **失败记录**：抓取失败的 URL 记入 `sources-report.md` 并说明替代。

## 4. 技术实现

- VitePress 1.x 默认主题 + local search；首页 Hero + 12 模块路线图卡片；侧边栏按 3 板块 12 模块分组，顺序即学习顺序。
- 项目根：`~/.zcode/workspace/default/llm-learning-site/`，站点文档在 `docs/`。
- 抓取转换：Node 脚本（GitHub raw 批量）+ 网页抓取转换；英文篇由 AI 翻译为中文后收录。
- **AI 学习助手（纯前端）**：全站右下角悬浮聊天组件；用户自行配置 OpenAI 兼容端点（Base URL / 模型名 / API Key），浏览器直连该端点发起流式对话。配置存储方案：
  - API Key 用 Web Crypto **AES-GCM 加密后存 localStorage**；加密密钥为首次使用时生成、存于 IndexedDB 的**不可导出（non-extractable）CryptoKey**——localStorage 中任何时刻不存在明文 Key。
  - Base URL 与模型名非敏感，明文存 localStorage。
  - 提供"清除配置"一键删除；设置面板注明本地存储的安全边界（无法防御本机恶意软件）。
  - 不经过任何自建服务端，无 Key 上传。
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
