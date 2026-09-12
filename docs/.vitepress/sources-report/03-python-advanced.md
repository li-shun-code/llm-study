# 模块 3 · Python 进阶与框架 — 来源抓取报告

抓取日期：2026-09-13。目标 17 篇，实际完成 17 篇，无最终失败项。

## 来源结构

| 来源域名 | 使用篇数 | 许可 |
| --- | --- | --- |
| docs.python.org/zh-cn/3（Python 官方中文文档，3.14） | 6（02/03/04/06/07/16，另 05 的次来源 asyncio-task 页） | PSF 许可证第 2 版 |
| realpython.com（Real Python） | 1（01，**编译摘要**而非转载，文首已注明"编译自"并附原文链接） | © Real Python（版权所有，未开放转载） |
| requests.readthedocs.io（requests 官方文档） | 1（08） | Apache 2.0 |
| python-httpx.org（httpx 官方文档） | 1（09） | BSD 三条款 |
| docs.pydantic.dev（Pydantic 官方文档） | 1（10） | MIT |
| fastapi.tiangolo.com/zh（FastAPI 官方中文文档） | 1（11，first-steps + security/first-steps 双页） | MIT |
| docs.docker.com（Docker 官方文档） | 1（12） | Apache 2.0 |
| gradio.app（Gradio 官方指南） | 1（13） | Apache 2.0 |
| docs.streamlit.io（Streamlit 官方文档） | 1（14） | Apache 2.0 |
| docs.pytest.org（pytest 官方文档） | 1（15） | MIT |
| docs.astral.sh/uv（uv 官方文档） | 1（17，guides/projects + features 双页） | MIT OR Apache-2.0 |

## 抓取失败与替代记录

| 主题 | 原候选 URL | 失败原因 | 最终采用文章 |
| --- | --- | --- | --- |
| 装饰器（01） | realpython.com/primer-on-python-decorators（直接抓取） | Real Python 站点对爬取返回 403，且其内容版权所有不可全文转载 | 按 Plan 允许的方式改为**中文编译摘要**：保留原文结构与核心示例框架，代码为编者改写的等价简版，文首注明"编译自"并附原文链接，另补充官方 functools 文档要点 |
| FastAPI 入门与 API Key 鉴权（11） | fastapi.tiangolo.com/advanced/security/api-key（原"API Key"页） | 该页在 2026-09 当前版文档中已不存在（404，官方安全教程现仅 first-steps / get-current-user） | 改用官方《安全 - 第一步》（OAuth2PasswordBearer + 依赖注入）为主体，API Key 一节为编者基于官方 `fastapi.security.APIKeyHeader` 工具的补充实战，文内已注明 |
| asyncio 异步（05） | docs.python.org/zh-cn/3/library/asyncio.html（模块首页） | 该页仅为目录式索引，正文单薄 | 改用官方 HOWTO《asyncio 的概念概述》为主 + 《协程与任务》参考页为辅（双页署名） |

## 时效性处理记录

- 全部来源以 2026-09 当前稳定版为准：Python 3.14 官方文档、requests 2.34、pytest 9.1、Pydantic 2.x（纯 v2 语法，文首注明 `.dict()`/`.parse_obj()` 等 v1 写法已过时）、FastAPI 最新版（`uv run fastapi dev` 新 CLI）、Docker 官方 Python 指南当前版（含 2025+ 的 Docker Hardened Images，编者注补充了 `python:3.12-slim` 社区常见写法）、uv 当前版（`uv_build` 构建后端、`requires-python >= 3.14`）、Gradio 6（热重载/vibe mode/`gr.ChatInterface`）、Streamlit 当前版（`streamlit skills` 命令）。
- 04 篇：补充 GIL 选型背景与 Python 3.13+ 自由线程构建的一句话说明（3.14 起 `ProcessPoolExecutor` 默认不再用 fork 启动法，已按官方文档收录）。
- 09 篇：requests"默认不超时"与 httpx"默认 5 秒超时"的对照已按官方文档如实呈现。
- 10 篇：全部 API 为 Pydantic v2（`model_dump` / `model_validate` / `model_config = ConfigDict`），未收录 v1 语法。
- 相对路径图片处理：FastAPI/Gradio 原文的界面截图未随文转载（保持文内文字描述），未引入相对路径或不可控外链图片。

## 未收录 HTML 残留的自检说明

全部文章以 Markdown 纯文本写入：无未闭合裸 HTML 标签，表格均使用管道语法，题注无需 HTML 辅助。代码块内如有原站残留的转义符（`\_`、`\[` 等，官方文档 HTML→MD 转换产生）已逐一还原为原始字符。
