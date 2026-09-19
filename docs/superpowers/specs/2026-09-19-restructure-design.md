# 设计文档：2026-09-19 全站重排与内容整改

状态：已执行（结构重排已落地，内容整改随后置批次完成）
背景：站方反馈「文章太乱、部分质量低」，要求全部重新整理并用更好的文章替换差稿。
本文件是对 `2026-09-13-llm-learning-site-design.md` 第 2 节（站点结构）的替代，其余契约（署名、frontmatter、抓取策略、验证标准）继续有效。

## 1. 审计结论（重排前）

对全部 261 篇逐篇通读，按 keep/polish/replace/drop/move 判定：

- replace（主题保留、须换更强来源重写）31 篇；polish 约 128 篇；drop/合并 3 篇。
- 三类系统性缺陷：
  1. **结构**：14 个模块无统一层级，Vibe Coding 单模块 35 篇平铺；「Python 进阶」排在 DSA/CS 之后；同主题文章散在多个模块。
  2. **时效**：API 模块十余篇仍用上一代模型名与已废弃参数（`max_tokens`、`purpose="assistants"`、旧 Azure API 版本），RAG 侧 notebook 直译导致代码不可跑。
  3. **呈现**：正文残留内部工作流话术（「本篇为重做版」「curl HTTP 000」等）；454 处「第 N 篇/模块 N」编号引用（且部分已错位）；未装 mermaid 插件却使用 mermaid 代码块；DSA 从 hello-algo 抓取时 Python 代码块被成片丢弃。

## 2. 新结构：5 板块 · 17 模块

| 板块 | 模块目录 | 名称 |
|---|---|---|
| ① 开发内功 | `00-python-basics` | Python 基础 |
| | `01-python-advanced` | Python 进阶与工程化（原 03，前移） |
| | `02-dsa` | 数据结构与算法（原 01） |
| | `03-cs-fundamentals` | 计算机基础（原 02） |
| ② 原理与提示 | `04-llm-basics` | LLM 原理与模型生态 |
| | `05-prompt-engineering` | 提示工程与上下文工程 |
| ③ LLM 应用开发 | `06-api-development` | 模型 API 与应用开发 |
| | `07-databases` | 数据库与向量存储 |
| | `08-rag` | RAG 检索增强生成 |
| | `09-agents` | Agent 智能体 |
| | `10-finetuning-deployment` | 微调与部署 |
| ④ AI 编程实战 | `11-ai-coding-tools` | AI 编程工具与环境（原 Vibe Coding 拆出） |
| | `12-ai-coding-context` | 规范、上下文与技能 |
| | `13-ai-coding-engineering` | AI 工程实践与质量安全 |
| | `14-ai-coding-classics` | 名篇与视野 |
| ⑤ 源码与延伸 | `15-project-analysis` | 优质项目源码分析（原 12） |
| | `16-design-patterns-java` | Java 设计模式专栏（原 13，作为延伸支线保留） |

要点：

- **每个模块都有子分组**（frontmatter `group`），侧边栏按「模块 → 分组 → 文章」三层展示；分组顺序即学习顺序。
- **原 35 篇的 Vibe Coding 拆为四模块**：工具与环境 / 规范与上下文 / 工程实践与质量安全 / 名篇与视野。概念与操作、方法论与视野不再混排。
- **归属修正**：LangChain 快速入门从 API 模块移入 Agent 模块；多模态提示并入视觉 API；自洽性并入思维链。
- **去重**：`context-engineering`（与提示工程模块同源重复）、`self-consistency`、`multimodal-prompting` 三篇移除或合并。
- 模块目录由脚本从磁盘推导（`scripts/lib/gen-sidebar-lib.mjs` 的 `moduleDirs`），不再硬编码清单。

## 3. 编号与引用规则（新增强制约定）

- 文章内交叉引用一律写《文章标题》，**禁止**「第 N 篇」「模块 N」——重排编号会让这类引用失效。历史引用由 `scripts/normalize-refs.mjs` 归一化。
- 序号、分组、导读页、来源登记表全部脚本生成：`reorg.mjs`（按规格重排）→ `renumber.mjs`（连续编号）→ `gen-sidebar.mjs`（侧边栏）→ `gen-manifest.mjs`（来源登记表）。`npm run build` 已串好这条链。
- 质量闸门：`check-frontmatter.mjs`（契约与署名块）、`scan-leaks.mjs`（内部话术）、`fix-links.mjs`（重排后的相对链接）、`node --test tests`。

## 4. 内容整改范围

按审计清单执行：31 篇换源重写、128 篇就地增强、缺口补写（DSA 的 Python 算法工具箱与 HNSW、数据库的窗口函数/EXPLAIN/psycopg3/PITR、API 的 MCP 客户端与可观测性、Agent 的 Skills、微调部署的 LlamaFactory/Unsloth 与 SGLang/TensorRT-LLM 对照、AI 编程的 Codex CLI/hooks/subagents 等）、DSA 回源补码与图片本地化、超长篇拆分（信号与 IPC、开源 Skills）。
