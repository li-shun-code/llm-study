# 模块 12 · 优质项目源码分析（12-project-analysis）来源报告

本模块与前 11 个模块不同：文章不基于网页/文档翻译，而是**基于项目仓库源码的分析撰写**（clone 自 GitHub main 分支，逐字引用真实代码并标注仓库相对路径，分析文字为本站编者视角）。本报告当前覆盖编者撰写的第 2、3、4 篇（n8n、RAGFlow 与 browser-use）；第 1 篇（Dify）由另行批次撰写后补录本表。

抓取/分析日期：2026-09-13。已通过 `node scripts/check-frontmatter.mjs docs/12-project-analysis`（PASS, 4 articles）。

## 来源与许可

| 来源仓库 | 分析篇目 | 版本与 commit（2026-09-13 clone） | 许可 | 引用方式 |
| --- | --- | --- | --- | --- |
| [n8n-io/n8n](https://github.com/n8n-io/n8n)（★204K） | 02《n8n 执行引擎源码解析——任务运行器与节点式自动化》 | main，commit `8bff5da5`（2026-09-14 +0000） | Sustainable Use License（仓库 LICENSE.md 原文核实；`.ee.` 文件为企业版，文中未引用） | 代码片段逐字引自 `packages/core/src/execution-engine/workflow-execute.ts`、`packages/workflow/src/workflow.ts`、`packages/workflow/src/interfaces.ts`、`packages/cli/src/task-runners/task-runner-process-js.ts`、`packages/@n8n/task-runner/src/task-runner.ts`，共 12 段，均标注相对路径并经脚本比对逐字一致 |
| [infiniflow/ragflow](https://github.com/infiniflow/ragflow)（★91K） | 03《RAGFlow 源码解析：深度文档理解与企业级 RAG 管线》 | v0.27.2，commit `58035bd`（main，2026-09-14 +0800） | Apache-2.0（仓库 LICENSE 原文核实） | 代码片段逐字引自 `rag/svr/task_executor.py`、`rag/app/naive.py`、`rag/nlp/__init__.py`、`rag/nlp/query.py`、`rag/nlp/search.py`、`deepdoc/parser/pdf_parser.py`、`deepdoc/vision/layout_recognizer.py`，共 10 段，均标注相对路径并经脚本比对逐字一致 |
| [browser-use/browser-use](https://github.com/browser-use/browser-use)（★115K） | 04《browser-use 源码解析：浏览器 Agent 的控制循环与 DOM 提取》 | v0.13.10，commit `843819c`（main，2026-09-13 -0700） | MIT（仓库 LICENSE 原文核实，Copyright (c) 2024 Gregor Zunic） | 代码片段逐字引自 `browser_use/agent/service.py`、`browser_use/agent/message_manager/service.py`、`browser_use/dom/service.py`、`browser_use/dom/serializer/serializer.py`、`browser_use/dom/serializer/clickable_elements.py`、`browser_use/tools/registry/service.py`、`browser_use/tools/service.py`，共 16 段，均标注相对路径并经脚本比对逐字一致 |

## 引用与署名规范

- 三篇 frontmatter 均含 `source_url`（仓库地址）、`author`（项目方）、`license`（Sustainable Use License / Apache-2.0 / MIT）、`fetched_at: 2026-09-13`、`translated: false`（源码分析非翻译）、`order: 2/3/4`。
- 署名块置于文末（`---` 分隔 + `> **来源**：…`），声明"基于开源项目源码分析撰写、代码片段引自指定 commit、依许可注明出处"。
- 星数引用自站点 `docs/12-project-analysis/index.md` 项目表（2026-09 抓取口径），与仓库当前 README 一致量级。

## 事实核查要点（编者注）

- n8n 篇：执行主体为 `packages/core/src/execution-engine/workflow-execute.ts` 的 `WorkflowExecute`（约 3200 行）；执行顺序由 `workflow.settings.executionOrder` 决定（v0 `push` / v1 `unshift`，多分支「画布左上先执行」）；`packages/@n8n/engine/` 为官方正在抽离的引擎 v2（package.json 自述 "n8n workflow execution engine (v2)"）；任务运行器 internal 模式（主进程 spawn 子进程，类注释自述 "NOT recommended for production"）与 external 模式并存；老资料中提到的 `NodeExecuteFunctions` 在当前代码中已演化为 `packages/core/src/execution-engine/node-execution-context/` 下的各 Context 类。
- RAGFlow 篇：仓库已将 `deepdoc/` 提升为顶层目录（不再是 `rag/deepdoc/`）；PDF 解析默认引擎 DeepDOC（OCR + LayoutRecognizer + TableStructureRecognizer + XGBoost 跨行拼接模型），另支持 MinerU/Docling/PaddleOCR 等可切换引擎——文中按当前结构描述。
- browser-use 篇：**v0.13.x 已移除 Playwright 运行时依赖**，浏览器通信改用 `cdp-use`（CDP 直连，`pyproject.toml` 中 `cdp-use==1.4.5`）；网上"基于 Playwright"的旧说法在文中已作事实修正说明。动作超时默认 180s、`llm_timeout`、历史压缩 `trigger_char_count` 默认 40000 等数值均出自源码。

## 自检记录

- `node scripts/check-frontmatter.mjs docs/12-project-analysis` → `PASS (4 articles)`（4 篇 = 本批 2 篇 + 01 Dify 篇 + 03/04 批次篇目）
- 代码片段逐字校验：自定义脚本将 02 篇全部 12 段代码围栏内容与对应仓库源文件（commit `8bff5da5`）做包含匹配，12/12 段全部 verbatim；此前批次 26/26 段（10 段 RAGFlow + 16 段 browser-use）同样逐字一致。
- 字数：02 篇中文 4017 字（12 段代码）；03 篇中文 4069 字（10 段代码，合计约 1.5 万字符）；04 篇中文 4099 字（16 段代码，合计约 2.1 万字符）。
- 格式：三篇均无围栏外 `{{ }}`、无未闭合裸 HTML；署名块位于文末并通过校验器头部检查。
