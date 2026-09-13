# 模块 7 · 数据库 —— 来源抓取报告

抓取日期：2026-09-13（本轮增补同日完成）。目标 ≥15 篇，当前 **19 篇**（原 16 篇 + 新增 3 篇；另在 07 篇内并入"隔离级别与 MVCC"一节，不新增文章）。全部通过 `node scripts/check-frontmatter.mjs docs/07-databases`（PASS, 19 articles）。

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

## 本轮增补记录（2026-09-13）

| 主题 | 来源 | 许可 | 说明 |
| --- | --- | --- | --- |
| PostgreSQL 全文检索（含中文分词） | PostgreSQL 18 官方文档第 12 章（textsearch 及 12.1–12.4、12.7–12.9、12.11 各子页）+ amutu/zhparser README + jaiminpan/pg_jieba README | PostgreSQL Licence；zhparser 为 PostgreSQL 许可风格自由许可；pg_jieba BSD-3-Clause | 新增 10 篇。第 12 章正文节完整翻译；12.5/12.6/12.10（解析器/词典内部机制与 psql 支持）未收录并已在文末署名块注明。zhparser/pg_jieba 两节为 README 完整翻译 |
| 07 篇并入"隔离级别与 MVCC" | PostgreSQL 18 官方文档第 13 章 Concurrency Control（mvcc.html 章引言 + 13.1 + 13.2 含三个小节） | PostgreSQL Licence | 追加于 07 篇内，不新增文章；13.2 全文翻译（含 Read Committed 的 MERGE/ON CONFLICT 细则） |
| Alembic 数据库迁移 | alembic.sqlalchemy.org/en/latest/tutorial.html（Alembic 1.20.0） | MIT | 新增 12 篇。教程页全部小节完整翻译（迁移环境、ini、pyproject、转义、脚本、升降级、历史区间等） |
| Redis 语义缓存与 RediSearch | redis/docs 仓库 raw：ai/search-and-query/_index.md、ai/search-and-query/query/vector-search.md、use-cases/semantic-cache/_index.md、use-cases/semantic-cache/redis-py/_index.md | CC BY-SA 4.0 | 新增 14 篇。四页完整翻译；Hugo 短代码（clients-example/relref）按渲染结果转写为普通代码块与链接 |

### 编号变化（两段式重命名）

原 10→11（SQLAlchemy）、11→13（Redis）、12→15（MongoDB）、13→16、14→17、15→18、16→19；新增 10（FTS）、12（Alembic）、14（Redis 语义缓存）。所有受影响文章 frontmatter `order` 已同步，站内"下一篇"类相对引用不受影响。

## 最终来源清单

| 序号 | 文章 | 来源 | 许可 | 翻译/转载 |
| --- | --- | --- | --- | --- |
| 01 | 关系模型与 SQL 入门 | Watt《Database Design 2e》1.7（LibreTexts）+ PostgreSQL 教程 2.1/2.2 | CC BY 4.0 / PostgreSQL Licence | 翻译 |
| 02 | E-R 建模与范式 | Watt《Database Design 2e》1.8 + 1.12（LibreTexts） | CC BY 4.0 | 翻译 |
| 03 | SELECT 增删改查 | PostgreSQL 18 教程 2.3-2.5、2.8-2.9 | PostgreSQL Licence | 翻译 |
| 04 | 聚合与分组 | PostgreSQL 18 教程 2.7 | PostgreSQL Licence | 翻译 |
| 05 | JOIN 多表 | PostgreSQL 18 教程 2.6 | PostgreSQL Licence | 翻译 |
| 06 | 索引原理与使用 | PostgreSQL 18 文档 11.1/11.2/11.12 | PostgreSQL Licence | 翻译 |
| 07 | 事务与 ACID（含隔离级别与 MVCC） | PostgreSQL 18 教程 3.4 + 官方文档 13.1/13.2 | PostgreSQL Licence | 翻译 |
| 08 | SQLite 上手 | sqlite.org whentouse + cli | 公有领域 | 翻译 |
| 09 | PostgreSQL 入门 | PostgreSQL 18 教程 1.2/1.3 | PostgreSQL Licence | 翻译 |
| 10 | PostgreSQL 全文检索（含中文分词） | PostgreSQL 18 文档第 12 章 + zhparser/pg_jieba README | PostgreSQL Licence / 自由许可 / BSD-3-Clause | 翻译 |
| 11 | SQLAlchemy ORM | docs.sqlalchemy.org 2.0 ORM Quick Start + Engine 教程 | MIT | 翻译 |
| 12 | Alembic 数据库迁移 | alembic.sqlalchemy.org Tutorial（1.20.0） | MIT | 翻译 |
| 13 | Redis 核心数据结构与缓存 | redis-doc（redis.io 文档源）数据类型与键空间页 | CC BY-SA 4.0 | 翻译 |
| 14 | Redis 语义缓存与 RediSearch | redis/docs：search-and-query 总览、vector-search、semantic-cache 总览与 redis-py 指南 | CC BY-SA 4.0 | 翻译 |
| 15 | MongoDB 文档模型 | MongoDB 文档手册 Documents + Introduction | CC BY-NC-SA 3.0 US | 翻译 |
| 16 | 向量数据库原理 | Milvus 官方文档 overview.md | Apache-2.0 | 翻译 |
| 17 | Chroma 与 Qdrant 单库实战 | qdrant/qdrant 与 chroma-core/chroma README | Apache-2.0 | 翻译 |
| 18 | Milvus 与 pgvector 实战 | Milvus Quickstart + pgvector README v0.8.6 | Apache-2.0 / PostgreSQL Licence | 翻译 |
| 19 | 向量库选型对比 | Milvus 官方文档 comparison.md | Apache-2.0 | 翻译 |

## 时效性说明

- SQLAlchemy 全部采用 2.0 风格（`DeclarativeBase`/`Mapped`/`mapped_column()`/`select()`/`Session.scalars()`），未用遗留 `Query` API；抓取时当前版本 2.0.52。
- Redis 内容来自官方文档仓库当前版（数据类型教程已按新版拆分结构重组）；search-and-query 已按 2026 年新版路径（develop/ai/search-and-query）抓取，`$SHARD_K_RATIO` 集群优化等新内容一并收录；语义缓存示例中的模型版本字段示例为 `gpt-4.5-2026`（原文如此）。
- Alembic 教程为 1.20.0 版（含 1.16 pyproject 模板、1.18 file_template 目录路径等新特性）。
- PostgreSQL 为 18 系官方文档（站点页头显示 18.6，2026-08-13 发行说明在页）。
- MongoDB 内容为文档手册当前版（含 5.0/6.1 起的行为说明）。
- Milvus 文档取自 milvus-docs v3.0.x 分支；pgvector 取 v0.8.6 tag 对应 README。
- zhparser/pg_jieba 取各仓库默认分支当前 README。
