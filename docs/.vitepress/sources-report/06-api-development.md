# 模块 6 · API 与应用开发（06-api-development）来源报告

抓取日期：2026-09-13。目标 ≥14 篇，实际完成 **14 篇**，全部通过 `node scripts/check-frontmatter.mjs docs/06-api-development`（PASS (14 articles)）。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [openai-python README](https://github.com/openai/openai-python)（Apache 2.0，raw 抓取 main 分支） | 01 主来源（Responses/Chat Completions 首调、异步、Vision、Realtime）；03 的 Responses 流式与 parse/流式助手；09 的异常体系/重试/超时；14 的素材之一 | Apache 2.0 | 对应篇 frontmatter + 署名块 |
| [OpenAI Cookbook](https://github.com/openai/openai-cookbook)（MIT，raw 抓取 examples/ 下 notebook） | 01 的 responses_example；02 的 format_inputs（概念）与 responses_example（会话状态）；03 的流式实测；04 的 function calling 双 API 示例；05 的 Structured Outputs；06 的 embeddings 两篇；07 的图片打标；08 的转写四法 + steering TTS；09 的限流策略；10 的 Prompt Caching 101 + Batch API；14 的素材 | MIT | 各篇 frontmatter + 署名块，`source_url` 指向 raw 原文 |
| [openai-python helpers.md / api.md / 源码](https://github.com/openai/openai-python)（Apache 2.0） | 05 的 `chat.completions.parse` 助手；14 的 `client.responses.stream()` + `get_final_response()` 写法核实（阅读 src/openai/lib/streaming/responses/_responses.py 与 resources/responses/responses.py 后采用） | Apache 2.0 | 05/14 署名块标注 |
| [LiteLLM 官方文档](https://docs.litellm.ai/docs/)（BerriAI/litellm 仓库 docs，MIT，enterprise 目录除外） | 11 主来源（Getting Started + Completion Input + Streaming） | MIT | 11 frontmatter + 署名块，license 字段注明 enterprise 例外 |
| [LangChain 官方 Quickstart](https://docs.langchain.com/oss/python/langchain/quickstart)（langchain-ai/docs 仓库，MIT） | 12 主来源 | MIT | 12 frontmatter + 署名块 |
| [FastAPI 官方文档中文版](https://fastapi.tiangolo.com/zh/)（fastapi 仓库，MIT） | 13 主来源（第一步 / 更大的应用 / 流式数据 三页，转载+编译） | MIT | 13 frontmatter + 署名块（中文来源，translated: false） |

## 时效性核实记录（硬约束执行）

- **Responses API 与 Chat Completions 并讲**：01/03/05/14 均以 Responses API 为主线、Chat Completions 作对照；04 给出两套 API 的工具调用对照表；11 的兼容端点讨论基于 Chat Completions 事实标准并注明。**Assistants API 零出现作为教学内容**，仅在 01/02/03/05 的"编者注"中以"已废弃，勿用"的身份一笔带过。
- **模型版本**：示例模型沿用抓取到的来源原文写法（openai-python README 当前版为 `gpt-5.5`；Cookbook 各 notebook 为 gpt-4o-mini/gpt-4o/gpt-5；LiteLLM 文档为 gpt-5.6-terra/luna、claude-sonnet-5、gemini-3.1-pro-preview；LangChain 文档为 gpt-5.5、claude-sonnet-4-6、GLM-5.2 等），与模块 4 报告核实的 2026-09 模型生态一致。
- **LangChain 仅 ≥1.0 `create_agent`**：12 全篇为官方 Quickstart 的 `create_agent` 写法（含 `@tool`、`init_chat_model`、`InMemorySaver` checkpointer、`thread_id`），无任何旧 `LLMChain`/`initialize_agent` 内容，并在编者注中声明本站不收旧写法。
- **旧示例校订**：02 的原文 notebook 基于 gpt-3.5-turbo 时代，概念（角色/少样本）保留翻译，代码改写为现行 API（`developer` 角色、现行模型），并在 frontmatter `versions` 与编者注中注明；05 原文的 `client.beta.chat.completions.parse` 已注明现去掉 beta 前缀；09 的 batching 示例保留原 notebook 写法并加注。

## 抓取失败与替代

| 主题 | 原计划来源 | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| 全模块（OpenAI 官方文档 guides，如 quickstart/text/function-calling/text-to-speech） | platform.openai.com/docs | Cloudflare 403（curl 与 WebFetch 均确认不可达） | 按预案改用 openai-cookbook raw notebook + openai-python GitHub README/api.md/helpers.md + SDK 源码核实，已全部落地 |
| 04 Function Calling 的 Anthropic 视角 | docs.anthropic.com / platform.claude.com（tool use overview） | docs.anthropic.com 重定向至 "App unavailable in region"（区域封锁；与模块 4 遇到的一致）；anthropic-cookbook raw 本身可通（tool_use/ 目录已列目录核实）但属模块 9 Agent 范畴 | 04 以 OpenAI Cookbook 双 notebook 为底稿并在结尾交叉引用模块 9；Anthropic tool use 留待模块 9 处理 |
| 14 实战篇的中文底稿（DataWhale llm-universe C2"使用 LLM API 开发应用"） | raw.githubusercontent.com/datawhalechina/llm-universe | 仓库可抓取（C2.ipynb 200），但 GitHub API `license: null`、README 无许可声明，按默认版权不作转载源（沿用模块 4 对 so-large-lm 的处理先例） | 14 改为基于许可明确的 openai-python README（Apache 2.0）+ Cookbook 流式/Responses notebook（MIT）的实战改编，署名块如实标注 |
| 06 的 cosine_similarity 工具函数 | openai-cookbook utils/embeddings_utils.py | raw 返回 404（该文件路径已不在 main 分支） | 按标准数学定义以 numpy 补全 4 行实现，并在注释中标注"本站按 numpy 标准实现补全" |

## 其他抓取过程记录

- platform.openai.com 为 JS+Cloudflare 站；docs.langchain.com/docs.litellm.ai/fastapi.tiangolo.com 均为 JS 渲染但返回内容可经 html2md 提取（FastAPI 有 SSR 中文译文，质量可用；LangChain 页面代码块完整）。
- LangChain 文档 URL 结构已迁移：python.langchain.com/docs/tutorials/get-started 现重定向至 Deep Agents RAG 教程；最终以 docs.langchain.com/oss/python/langchain/quickstart 为准（langchain-ai/docs 仓库 MIT 已核实）。
- LiteLLM 主仓库 GitHub license 字段显示 NOASSERTION，实读 LICENSE 文件确认：enterprise/ 目录之外（含 docs）为 MIT。
- notebook 大文件（Speech 466KB、Vision 307KB）含 base64 音频/图片输出，转文本时已剥离，仅保留代码与文本输出。
- 所有文章正文无裸 HTML 标签；两处表格附 `**表：xxx**` 题注；交叉引用（模块 0 .env、模块 2 SSE、模块 5 结构化输出、模块 7/8/9 延伸）已按计划写入。
- manifest 记录于 `docs/.vitepress/manifest/06-api-development.json`（14 条）。
