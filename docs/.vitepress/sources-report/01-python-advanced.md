# 模块 3 · Python 进阶与框架 — 来源抓取报告

抓取日期：2026-09-13。目标 22 篇（重做 15 篇 + 新增 5 篇 + 保留 2 篇），实际完成 22 篇。全部文章为**完整原文翻译**（非编译摘要），编者补充仅出现在文末"编者注"。

## 来源结构

| 来源域名 | 使用篇数 | 许可 |
| --- | --- | --- |
| docs.python.org/zh-cn/3（Python 官方文档，3.14） | 9（01 functools、02 functional HOWTO、03 contextlib、04 refcounting+gc+intro、05 concurrent.futures+threading、07 typing、08 regex HOWTO、11 dataclasses、19 logging HOWTO+logging.config、20 profile） | PSF 许可证第 2 版 |
| requests.readthedocs.io（requests 官方文档，psf/requests 仓库 rst 源） | 1（09，quickstart + advanced 双页） | Apache 2.0 |
| python-httpx.org（httpx 官方文档，encode/httpx 仓库 md 源） | 1（10，quickstart/async/advanced 下 11 页） | BSD 三条款 |
| docs.pydantic.dev（Pydantic 官方文档，pydantic 仓库 md 源） | 1（12，concepts/models 全页） | MIT |
| fastapi.tiangolo.com/zh（FastAPI 官方中文文档，fastapi 仓库 docs/zh md 源） | 2（13 保留、14 依赖注入 5 页 + 中间件 + 自定义响应/流式 + stream-data + JSON Lines 共 9 页） | MIT |
| docs.docker.com（Docker 官方文档，docker/docs 仓库 content/guides/python.md 源） | 1（15，containerize/develop/lint 全系列） | Apache 2.0 |
| gradio.app（Gradio 官方指南，gradio-app/gradio 仓库 guides 源） | 1（16，quickstart） | Apache 2.0 |
| docs.streamlit.io（Streamlit 官方文档，streamlit/docs 仓库 md 源） | 1（17，get-started/fundamentals 的 main-concepts + advanced-concepts） | Apache 2.0 |
| docs.pytest.org（pytest 官方文档，pytest-dev/pytest 仓库 rst 源） | 1（18，getting-started + how-to 索引 + usage/assert/parametrize/skipping/monkeypatch 共 6 页） | MIT |
| docs.astral.sh/uv（uv 官方文档，astral-sh/uv 仓库 md 源） | 1（21，projects 指南 + concepts/projects 下 6 页） | MIT OR Apache-2.0 |
| github.com/benfred/py-spy（py-spy README） | 1（20，与 profile 页合并） | MIT |
| github.com/astral-sh/ruff、python/mypy、pre-commit.com（pre-commit/pre-commit.com 仓库 sections 源） | 1（22，ruff tutorial + mypy README + pre-commit intro/install/usage，各来源逐节署名） | MIT（三者均 MIT） |
| realpython.com（Real Python） | 0（01 原候选来源，因版权未采用，仅在文末保留延伸阅读链接） | © Real Python（版权所有） |

## 重做与新增记录（对照任务清单）

| 文件 | 重做/新增 | 来源与完整性 |
| --- | --- | --- |
| 01-decorators.md | 重做 | Real Python《Primer on Python Decorators》不可全文转载（403 + 版权所有），且 Python 3.14 的 functional HOWTO 已无独立装饰器章节，按预案改用 **functools 官方文档全文翻译**，source_url 已更新；装饰器机制极简模型在文末编者注中给出 |
| 02-iterators-and-generators.md | 重做 | functional HOWTO 完整翻译（概述→迭代器→生成器表达式→生成器→内置函数→itertools→functools→lambda；略去文末修订记录与参考文献） |
| 03-context-managers.md | 重做 | contextlib 全页完整翻译 |
| 04-memory-management-gc.md | **新增** | c-api/refcounting 全页 + c-api/intro"对象、类型和引用计数"节 + library/gc 全页 |
| 05-concurrency.md | 重做 | concurrent.futures 全页 + threading 全页（原 04，含 3.13/3.14 自由线程相关条目按官方文档如实收录） |
| 06-asyncio.md | 保留 | 原 05-asyncio（order 5→6；文中"第 9 篇"交叉引用同步改为"第 10 篇"） |
| 07-type-hints.md | 重做 | typing 核心章节完整翻译：类型系统规范说明全部小节 + 模块内容（特殊类型原语、协议、函数与装饰器、内省辅助器、常量、已弃用别名）；仅略去"主要特性的弃用时间线"（版本变更性质内容） |
| 08-regex.md | 重做 | regex HOWTO 完整翻译 |
| 09-requests.md | 重做 | quickstart + advanced 两页完整翻译 |
| 10-httpx.md | 重做 | quickstart + async + advanced 下 clients/authentication/timeouts/proxies/event-hooks/ssl/text-encodings/resource-limits/extensions 共 11 页完整翻译；advanced/transports（自定义 transport 开发）未收录 |
| 11-dataclasses-namedtuple.md | **新增** | dataclasses 全页完整翻译；NamedTuple 指向 typing 文档（已完整收录于 07 篇），文末编者注给出两者对比 |
| 12-pydantic.md | 重做 | concepts/models 全页完整翻译（v2 语法）；原文 5 处默认折叠的"API Documentation"折叠块以括注保留指向 |
| 13-fastapi.md | 保留 | 原 11-fastapi（order 11→13） |
| 14-fastapi-advanced.md | **新增** | 官方中文文档 9 页：依赖注入（index/classes/sub/global/with-yield）+ 高级中间件 + 自定义响应（含 StreamingResponse）+ 流式数据 + JSON Lines；`{* docs_src *}` 代码宏已用官方仓库对应源码文件替换内嵌；SSE 要点在文末编者注 |
| 15-docker.md | 重做 | Docker 官方 Python 语言指南完整系列（containerize/develop/run + lint），对应仓库 content/guides/python.md 全文 |
| 16-gradio.md | 重做 | Gradio 官方 Quickstart 完整翻译（当前版：Interface/Blocks/ChatInterface/分享/生态） |
| 17-streamlit.md | 重做 | Streamlit get-started/fundamentals 两页（main-concepts + advanced-concepts）完整翻译 |
| 18-pytest.md | 重做 | getting-started 全文 + how-to 索引 + usage/assert/parametrize/skipping/monkeypatch 五篇全文；fixtures/mark/output 等其余 how-to 页未收录（篇幅），文末编者注附官方索引链接 |
| 19-logging.md | 重做 | logging HOWTO 全文 + logging.config 全页完整翻译 |
| 20-profiling.md | **新增** | profile 官方页完整翻译（zh-cn 未译的英文段落已补译）+ py-spy README 完整翻译 |
| 21-uv-poetry.md | 重做 | uv projects 指南全文 + concepts/projects 下 index/layout/init/dependencies/sync/build 六页完整翻译（run/export/workspaces/config 未收录） |
| 22-code-quality.md | **新增** | ruff Tutorial 全文 + mypy README 核心（what is mypy/quick start/IDE 集成/mypyc）+ pre-commit intro/install/quick start/usage，各部分来源逐节署名 |

## 时效性处理记录

- 全部来源以 2026-09 当前稳定版为准：Python 3.14 官方文档、requests 2.x、httpx 当前版、Pydantic v2（纯 v2 语法）、FastAPI 官方中文文档当前版（含 stream-data / JSON Lines 新页）、Docker 当前版指南（Docker Hardened Images + Compose Watch，编者注补充 `python:3.12-slim` 社区常见写法）、pytest 9.x、uv 当前版（`uv_build` 构建后端、`uv version`、恶意软件检查预览特性）、Gradio 6（hot reload / vibe mode）、Ruff/mypy/pre-commit 当前版。
- docs.python.org 的 `_sources` 在 zh-cn 域名下返回英文源码，实际抓取采用 zh-cn 渲染页正文（HTML→Markdown 管线）；zh-cn 未翻译的英文句子已由编者逐句补译（涉及 01/02/03/05/07/08/11/19/20 各篇）。
- 相对路径图片/截图未随文转载：FastAPI、Gradio、Streamlit、py-spy、Docker 原文的界面截图以文字描述替代，未引入相对路径或不可控外链图片。

## 未收录 HTML 残留的自检说明

全部文章以 Markdown 纯文本写入并经脚本扫描：无未闭合裸 HTML（`<dfn>`/`<img>`/`<abbr>` 等已清理）、代码围栏配对完整、正文（围栏外）无 `{{ }}` 模板插值残留、`scripts/check-frontmatter.mjs docs/03-python-advanced` 输出 `PASS (22 articles)`。
