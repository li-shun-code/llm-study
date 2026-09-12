# 模块 7 · 数据库 —— 来源抓取报告

抓取日期：2026-09-13。目标 ≥15 篇，实际完成 16 篇。

## 失败与替代记录

| 主题 | 原 URL | 失败原因 | 替代文章 |
| --- | --- | --- | --- |
| SQL 教学（关系模型/CRUD/聚合/JOIN） | https://sqlbolt.com/ | SQLBolt 为纯前端 SPA，HTML 无正文（curl 得到空文档） | 01/03/04/05 篇改用 PostgreSQL 18 官方教程（PostgreSQL Licence）+ Watt《Database Design 2e》（CC BY 4.0，LibreTexts 版） |
| E-R 建模与范式 | https://opentextbc.ca/dbdesign/ | Cloudflare 拦截（HTTP 403 "Just a moment..."） | 02 篇改用同一开放教科书在 LibreTexts 的镜像（CC BY 4.0） |
| 关系模型补充 | https://en.wikipedia.org/wiki/Database_normalization 等 | en.wikipedia.org 连接超时（网络不可达） | 未使用；范式内容已由 Watt 书覆盖 |
| Chroma 官方文档站 | https://docs.trychroma.com/docs/overview/getting-started | 可访问，但 chroma-core/docs 仓库无 LICENSE（默认保留所有权利），不宜整篇翻译 | 14 篇改用 Apache-2.0 的 chroma-core/chroma 仓库 README |
| Qdrant 官方文档站 | https://qdrant.tech/documentation/quickstart/ | 可访问，但 qdrant/landing_page 仓库无仓库级 LICENSE，许可不明 | 14 篇改用 Apache-2.0 的 qdrant/qdrant 仓库 README |
| Redis 数据类型教程 | https://redis.io/docs/latest/develop/data-types-tutorial/ | 404（文档站已改版，原"数据类型教程"拆分为按类型页面） | 11 篇改用 redis-doc 仓库（CC BY-SA 4.0）按类型页面组合 |
| MongoDB 手册 HTML | https://www.mongodb.com/docs/manual/introduction/ | 页面为 Next.js 动态渲染、turndown 提取不完整 | 12 篇改用官方 llms.txt 提供的同 URL 加 `.md` 的 Markdown 版（内容相同） |

## 最终来源清单

| 序号 | 文章 | 来源 | 许可 | 翻译/转载 |
| --- | --- | --- | --- | --- |
| 01 | 关系模型与 SQL 入门 | Watt《Database Design 2e》1.7（LibreTexts）+ PostgreSQL 教程 2.1/2.2 | CC BY 4.0 / PostgreSQL Licence | 翻译 |
| 02 | E-R 建模与范式 | Watt《Database Design 2e》1.8 + 1.12（LibreTexts） | CC BY 4.0 | 翻译 |
| 03 | SELECT 增删改查 | PostgreSQL 18 教程 2.3-2.5、2.8-2.9 | PostgreSQL Licence | 翻译 |
| 04 | 聚合与分组 | PostgreSQL 18 教程 2.7 | PostgreSQL Licence | 翻译 |
| 05 | JOIN 多表 | PostgreSQL 18 教程 2.6 | PostgreSQL Licence | 翻译 |
| 06 | 索引原理与使用 | PostgreSQL 18 文档 11.1/11.2/11.12 | PostgreSQL Licence | 翻译 |
| 07 | 事务与 ACID | PostgreSQL 18 教程 3.4 | PostgreSQL Licence | 翻译 |
| 08 | SQLite 上手 | sqlite.org whentouse + cli | 公有领域 | 翻译 |
| 09 | PostgreSQL 入门 | PostgreSQL 18 教程 1.2/1.3 | PostgreSQL Licence | 翻译 |
| 10 | SQLAlchemy ORM | docs.sqlalchemy.org 2.0 ORM Quick Start + Engine 教程 | MIT | 翻译 |
| 11 | Redis 核心数据结构与缓存 | redis-doc（redis.io 文档源）数据类型与键空间页 | CC BY-SA 4.0 | 翻译 |
| 12 | MongoDB 文档模型 | MongoDB 文档手册 Documents + Introduction | CC BY-NC-SA 3.0 US | 翻译 |
| 13 | 向量数据库原理 | Milvus 官方文档 overview.md | Apache-2.0 | 翻译 |
| 14 | Chroma 与 Qdrant 单库实战 | qdrant/qdrant 与 chroma-core/chroma README | Apache-2.0 | 翻译 |
| 15 | Milvus 与 pgvector 实战 | Milvus Quickstart + pgvector README v0.8.6 | Apache-2.0 / PostgreSQL Licence | 翻译 |
| 16 | 向量库选型对比 | Milvus 官方文档 comparison.md | Apache-2.0 | 翻译 |

## 时效性说明

- SQLAlchemy 全部采用 2.0 风格（`DeclarativeBase`/`Mapped`/`mapped_column()`/`select()`/`Session.scalars()`），未用遗留 `Query` API；抓取时当前版本 2.0.52。
- Redis 内容来自官方文档仓库当前版（数据类型教程已按新版拆分结构重组）。
- MongoDB 内容为文档手册当前版（含 5.0/6.1 起的行为说明）。
- Milvus 文档取自 milvus-docs v3.0.x 分支；pgvector 取 v0.8.6 tag 对应 README。
