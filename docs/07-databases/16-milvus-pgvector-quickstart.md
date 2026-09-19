---
title: Milvus 与 pgvector 实战
source_url: https://raw.githubusercontent.com/milvus-io/milvus-docs/v3.0.x/site/en/getstarted/quickstart.md
author: Milvus 官方文档（milvus-docs v3.0.x）/ pgvector（Andrew Kane）
license: Apache-2.0（Milvus）/ PostgreSQL Licence（pgvector）
fetched_at: 2026-09-19
translated: true
versions: Milvus Lite 与 pymilvus 当前版（Lite 仅 FLAT 索引、一致性恒为 Strong）；pgvector 0.8.x（HNSW m=16/ef_construction=64/ef_search=40，IVFFlat probes 默认 1，iterative index scans 自 0.8.0）
order: 16
group: 向量数据库
---
这一篇和《Chroma 与 Qdrant 单库实战》是同一层的两篇，覆盖另外两条路线：**Milvus**（专用向量数据库，从 `pip install` 起步、可一路扩到 K8s 集群）与 **pgvector**（不新增系统，给已有 PostgreSQL 加一列向量）。两者的选择逻辑完全不同：前者为向量检索专门设计了一套存储与服务架构，后者把向量塞进你已经会运维的那个数据库里。所以本篇除了给可运行代码，还要交代各自的**边界**——Milvus Lite 到底砍掉了什么、pgvector 的近似索引在带 `WHERE` 的查询上会出什么问题。索引算法本身的原理与参数含义在《向量数据库原理：从 HNSW 论文与公开基准说起》，要不要为向量单起一套系统的判据在《向量库选型：用基准测试代替宣传页》。

## Milvus：从 Milvus Lite 开始

向量是神经网络模型的输出格式，能有效编码信息，在知识库、语义搜索、检索增强生成（RAG）等 AI 应用中扮演关键角色。Milvus 是一个开源向量数据库，适配各种规模的 AI 应用——从 Jupyter Notebook 里的演示聊天机器人，到服务数十亿用户的 Web 级搜索。本指南演示如何在几分钟内于本地搭好 Milvus，并用 Python 客户端生成、存储和检索向量。

### 安装

本指南使用 Milvus Lite——`pymilvus` 自带的 Python 库，可嵌入客户端应用。生产环境也支持 Docker 与 Kubernetes 部署。确保本地有 Python 3.8+，然后：

```python
$ pip install -U pymilvus
```

### 搭建向量数据库

创建本地 Milvus 向量数据库：指定一个存数据的文件名，实例化 `MilvusClient` 即可。

```python
from pymilvus import MilvusClient

client = MilvusClient("milvus_demo.db")
```

### 创建集合（Collection）

Milvus 用集合存储向量及其关联元数据，可以类比为传统 SQL 数据库里的表。创建时可以定义 schema 与索引参数（向量维度、索引类型、距离度量等）；入门阶段全部用默认值，最少只需集合名和向量维度：

```python
if client.has_collection(collection_name="demo_collection"):
    client.drop_collection(collection_name="demo_collection")
client.create_collection(
    collection_name="demo_collection",
    dimension=768,  # 本演示使用的向量是 768 维
)
```

上述默认设置为：主键与向量字段用默认名（`id` 与 `vector`）；度量类型（向量距离定义）默认 COSINE 余弦相似度；主键字段接受整数且不自增（未启用 auto-id）。

### 用向量表示文本

用默认 Embedding 模型生成向量（首次会下载约 50MB 的小模型 paraphrase-albert-small-v2；连不上 Hugging Face 时可设置 `HF_ENDPOINT=https://hf-mirror.com`，或直接用后面的随机向量占位——但检索结果将不反映语义相似性）。Milvus 期望插入的数据是字典列表，每个字典代表一条数据记录（实体，Entity）：

```python
from pymilvus import model

embedding_fn = model.DefaultEmbeddingFunction()

docs = [
    "Artificial intelligence was founded as an academic discipline in 1956.",
    "Alan Turing was the first person to conduct substantial research in AI.",
    "Born in Maida Vale, London, Turing was raised in southern England.",
]

vectors = embedding_fn.encode_documents(docs)
print("Dim:", embedding_fn.dim, vectors[0].shape)  # Dim: 768 (768,)

# 每个实体含 id、向量表示、原始文本，以及稍后演示元数据过滤用的主题标签
data = [
    {"id": i, "vector": vectors[i], "text": docs[i], "subject": "history"}
    for i in range(len(vectors))
]
```

网络不便时可用随机向量占位完成示例：

```python
import random

vectors = [[random.uniform(-1, 1) for _ in range(768)] for _ in docs]
data = [
    {"id": i, "vector": vectors[i], "text": docs[i], "subject": "history"}
    for i in range(len(vectors))
]
```

### 插入数据

```python
res = client.insert(collection_name="demo_collection", data=data)
print(res)
```

```text
{'insert_count': 3, 'ids': [0, 1, 2], 'cost': 0}
```

### 语义搜索

把查询文本表示成向量，然后在 Milvus 上做向量相似度检索。`data` 参数接受一个或多个查询向量：

```python
query_vectors = embedding_fn.encode_queries(["Who is Alan Turing?"])

res = client.search(
    collection_name="demo_collection",  # 目标集合
    data=query_vectors,  # 查询向量
    limit=2,  # 返回实体数
    output_fields=["text", "subject"],  # 指定返回字段
)
print(res)
```

```text
data: ["[{'id': 2, 'distance': 0.5859944820404053, 'entity': {'text': 'Born in Maida Vale, London, Turing was raised in southern England.', 'subject': 'history'}}, {'id': 1, 'distance': 0.5118255615234375, 'entity': {'text': 'Alan Turing was the first person to conduct substantial research in AI.', 'subject': 'history'}}]"] , extra_info: {'cost': 0}
```

输出是结果列表，每个查询对应一个列表；每条结果含实体主键、与查询向量的距离，以及 `output_fields` 指定的实体详情。

### 带元数据过滤的向量检索

检索时可以结合标量（Scalar，即非向量）字段的值，用 filter 表达式指定条件。例如只搜 biology 主题：

```python
docs = [
    "Machine learning has been used for drug design.",
    "Computational synthesis with AI algorithms predicts molecular properties.",
    "DDR1 is involved in cancers and fibrosis.",
]
vectors = embedding_fn.encode_documents(docs)
data = [
    {"id": 3 + i, "vector": vectors[i], "text": docs[i], "subject": "biology"}
    for i in range(len(vectors))
]
client.insert(collection_name="demo_collection", data=data)

# 尽管 history 主题的文本离查询向量很近，也会被排除
res = client.search(
    collection_name="demo_collection",
    data=embedding_fn.encode_queries(["tell me AI related information"]),
    filter="subject == 'biology'",
    limit=2,
    output_fields=["text", "subject"],
)
```

默认标量字段不建索引；大数据集上要做元数据过滤检索时，可用固定 schema 并开启标量索引提升性能。除向量检索外，`query()` 可按过滤表达式或主键直接取回所有匹配实体：

```python
res = client.query(
    collection_name="demo_collection",
    filter="subject == 'history'",
    output_fields=["text", "subject"],
)

res = client.query(
    collection_name="demo_collection",
    ids=[0, 2],
    output_fields=["vector", "text", "subject"],
)
```

### 删除与后续

按主键或按过滤表达式删除实体：

```python
res = client.delete(collection_name="demo_collection", ids=[0, 2])
res = client.delete(
    collection_name="demo_collection",
    filter="subject == 'biology'",
)
```

Milvus Lite 的全部数据都在本地文件里，程序结束后用同一文件名新建 `MilvusClient` 即可恢复集合继续写入；删库用 `client.drop_collection(collection_name="demo_collection")`。

### Milvus Lite 到底"Lite"在哪

"同一套 API"这句承诺要连着官方那张限制表一起读，否则会在迁移时踩空。官方文档明确列出的边界：

- **运行环境**：Ubuntu ≥ 20.04（x86_64/arm64）与 macOS ≥ 11.0，**没有 Windows 支持**；官方直接写明它"只适合小规模向量检索场景"，规模一大就转 Standalone/Distributed。
- **`create_index()` 只支持 `FLAT` 索引**——也就是说 Milvus Lite 里做的是**精确检索**，HNSW/IVF 那些图与聚类索引要等 Standalone 或分布式才有。这解释了为什么 Lite 上手很顺、数据一上万条就变慢。
- **一致性级别只有 `Strong`**（任何配置都会被当成 Strong）；`num_shards`、`partition_key_field`、`num_partitions` 均不支持。
- **不支持 partition、users/roles、alias 及相关方法**；`rename_collection()` 也不支持。
- 支持面里该有的还是有的：稀疏向量、多向量、`hybrid_search`、元数据过滤、动态字段。

要上生产或上规模，用 Docker / Kubernetes 部署完整 Milvus——**客户端代码几乎不用改**，只要指向服务器 URI 与凭据：

```python
client = MilvusClient(uri="http://localhost:19530", token="root:Milvus")
```

Lite 里已经灌进去的数据可以导出再导入 Standalone / Distributed / Zilliz Cloud：安装 `pip install -U "pymilvus[bulk_writer]"` 后会带一个 `milvus-lite` 命令行，`milvus-lite dump -d <db文件> -c <集合名> -p <输出路径>` 把集合导成 JSON 供后续导入。

（官方文档另提到可安装 Milvus Skill 让 AI 编码助手生成正确的 Milvus 代码，以及面向 Agent 的 MCP 服务器等工具。）

## pgvector：给 PostgreSQL 加上向量能力

**pgvector** 是 Postgres 的开源向量相似度检索扩展。把向量和其余数据存在一起。支持：

- 精确与近似最近邻检索；
- 单精度、半精度、二进制与稀疏向量；
- L2 距离、内积、余弦距离、L1 距离、Hamming 距离与 Jaccard 距离；
- 任何带 Postgres 客户端的语言。

外加 ACID 合规、时间点恢复（PITR）、JOIN 以及 Postgres 的所有其他优秀特性。向量多到放不下？用量化（quantization）扩展。

### 快速上手

在要使用它的每个数据库里启用扩展（一次即可）：

```sql
CREATE EXTENSION vector;
```

建一个 3 维向量列的表并插入向量：

```sql
CREATE TABLE items (id bigserial PRIMARY KEY, embedding vector(3));

INSERT INTO items (embedding) VALUES ('[1,2,3]'), ('[4,5,6]');
```

按 L2 距离取最近邻：

```sql
SELECT * FROM items ORDER BY embedding <-> '[3,1,2]' LIMIT 5;
```

还支持内积（`<#>`）、余弦距离（`<=>`）、L1 距离（`<+>`）。注意 `<#>` 返回的是**负**内积——因为 Postgres 只支持运算符上的 `ASC` 序索引扫描。

### 存储与查询要点

向量列可以加到既有表：`ALTER TABLE items ADD COLUMN embedding vector(3);`，也支持半精度（halfvec）、二进制（bit）与稀疏（sparsevec）向量；批量装载用 `COPY ... FROM STDIN WITH (FORMAT BINARY)`；upsert 用 `INSERT ... ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding;`。

距离函数一览：

- `<->` — L2 距离
- `<#>` — （负）内积
- `<=>` — 余弦距离
- `<+>` — L1 距离
- `<~>` — Hamming 距离（二进制向量）
- `<%>` — Jaccard 距离（二进制向量）

取某行的最近邻、或取一定距离范围内的行（注意：要与 `ORDER BY` 和 `LIMIT` 组合才能用上索引）：

```sql
SELECT * FROM items WHERE id != 1
    ORDER BY embedding <-> (SELECT embedding FROM items WHERE id = 1) LIMIT 5;

SELECT * FROM items WHERE embedding <-> '[3,1,2]' < 5;
```

相似度换算：余弦相似度 = 1 − 余弦距离；内积需把 `<#>` 的结果乘以 −1。向量本身也能聚合（`AVG(embedding)`，可配合 `GROUP BY`）。

### 索引：精确换近似

默认情况下 pgvector 执行**精确**最近邻检索（完美召回）。加索引后改用**近似**最近邻检索（ANN）——以部分召回换速度。与常规索引不同：加了近似索引之后，同样的查询会返回不同的结果。支持的索引类型：

- **HNSW**：构建多层图。速度-召回权衡优于 IVFFlat，但构建更慢、更耗内存；且因为没有 IVFFlat 那样的训练步骤，空表也能建索引。

```sql
CREATE INDEX ON items USING hnsw (embedding vector_l2_ops);
```

每种距离函数建各自的索引（`vector_ip_ops` 内积、`vector_cosine_ops` 余弦距离等）。支持的类型与维度上限：`vector` 2000 维、`halfvec` 4000 维、`bit` 64000 维、`sparsevec` 1000 个非零元素。

HNSW 参数：`m`（每层最大连接数，默认 16）、`ef_construction`（建图的动态候选列表大小，默认 64，越高召回越好但建索引/插入越慢）；查询参数 `hnsw.ef_search`（检索候选列表大小，默认 40，越高召回越好、速度越慢；事务内可用 `SET LOCAL` 只对单查询生效）：

```sql
CREATE INDEX ON items USING hnsw (embedding vector_l2_ops) WITH (m = 16, ef_construction = 64);

SET hnsw.ef_search = 100;

BEGIN;
SET LOCAL hnsw.ef_search = 100;   -- 只影响这一事务内的查询
SELECT ...
COMMIT;
```

**IVFFlat** 是另一条路线：先把向量分成若干列表，查询时只扫最接近的几个列表。官方 README 把权衡说得很直白——**构建更快、更省内存，但速度-召回表现不如 HNSW**。三条召回要点也是原文给的：

1. **一定要在有数据之后**再建索引（它有个训练步骤，空表建出来的聚类中心没意义）；
2. `lists` 取值：不超过 100 万行时用 `rows / 1000`，超过 100 万行用 `sqrt(rows)`；
3. 查询时 `ivfflat.probes`（默认 **1**）——起步值用 `sqrt(lists)`，越大召回越高、越快失效。

```sql
CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
SET ivfflat.probes = 10;
SELECT * FROM items ORDER BY embedding <=> '[3,1,2]' LIMIT 5;
```

### 带 WHERE 的近似检索：pgvector 最容易翻车的地方

README 的 Iterative Index Scans 一节讲清了机制：**近似索引的过滤是在索引扫描之后应用的**，所以 `WHERE` 越挑，返回条数越容易不够。0.8.0 起可以打开迭代扫描，让它自动继续扫直到凑够（上限由 `hnsw.max_scan_tuples` / `ivfflat.max_probes` 控制）：

```sql
SET hnsw.iterative_scan = strict_order;   -- 严格按距离排序
SET hnsw.iterative_scan = relaxed_order;  -- 允许轻微乱序，召回更好
SET ivfflat.iterative_scan = relaxed_order;
```

用了 `relaxed_order` 时，官方给的补救办法是物化 CTE 再外层排序：

```sql
WITH relaxed_results AS MATERIALIZED (
    SELECT id, embedding <-> '[1,2,3]' AS distance
    FROM items WHERE category_id = 123
    ORDER BY distance LIMIT 5
)
SELECT * FROM relaxed_results ORDER BY distance + 0;  -- Postgres 17+ 需要 + 0 才能避免被合并优化掉
```

### 建索引慢怎么办

README 的 Index Build Time 一节三条实操（都是可复制的 SQL）：

```sql
SET maintenance_work_mem = '8GB';        -- 图能整个装进去时建得快得多
SET max_parallel_maintenance_workers = 7; -- 并行 worker，默认 2
```

装不下时 Postgres 会给提示（`NOTICE: hnsw graph no longer fits into maintenance_work_mem after 100000 tuples`，HINT 让你调大），但原文也警告**不要把 `maintenance_work_mem` 调到把服务器内存榨干**。另外两条：像其他索引一样，**先灌数据再建索引**更快；想看清进度就查 `pg_stat_progress_create_index`（HNSW 的阶段是 `initializing` → `loading tuples`）：

```sql
SELECT phase, round(100.0 * blocks_done / nullif(blocks_total, 0), 1) AS "%"
FROM pg_stat_progress_create_index;
```

维度超过 `vector` 的 2000 维上限时，README 给的路子是 `halfvec`（半精度，可索引到 4000 维）、`bit`（64,000 维）、`sparsevec`（最多 1,000 个非零元素）；再往下还有量化路线（`binary`/`quantization` 扩展，原文建议"向量多到放不下"时才用）。

## 常见坑

1. **加了近似索引，结果就变了**：README 特意提醒 "you will see different results for queries after adding an approximate index"——这是 ANN 的定义，不是 bug。要完全可复现就用默认的精确检索，并重新算延迟预算。
2. **`<->` / `<=>` / `<#>` 与索引的 operator class 必须成对**：`vector_l2_ops`、`vector_cosine_ops`、`vector_ip_ops` 各建各的索引；查询用的距离运算符没有对应索引时，规划器只能全表扫。想同时用两种距离，就建两个索引。
3. **`<#>` 返回的是负内积**（Postgres 的索引扫描只支持升序），换算相似度时别忘乘 −1。
4. **`ORDER BY 距离 LIMIT n` 是索引生效的前提**：把距离写进 `WHERE`（`WHERE embedding <-> '[3,1,2]' < 5`）是范围检索，写法不同、计划也不同。
5. **过滤条件强就先看 `iterative_scan`，再加内存**——"提高 `ef_search` → 开迭代扫描 → 把强过滤维度做成物理隔离 → 极端选择性直接退回全量扫描"这条排查顺序适用于所有 ANN 引擎（成因见《向量数据库原理：从 HNSW 论文与公开基准说起》的过滤检索一节）。
6. **Milvus Lite 没有 HNSW**：它只支持 `FLAT`，拿 Lite 的耗时去推算生产 Milvus 会得出完全错误的结论。
7. **两条路线的"事务"语义不同**：pgvector 直接吃到 Postgres 的 ACID、备份、权限与 JOIN；Milvus 的向量库自成一系，业务一致性要靠应用层或 `Strong` 一致性级别（Lite 恒为 Strong）保证。

## 两条路线怎么选

- **已有 PostgreSQL、向量要和业务表同库同事务、能接受单机纵向扩展**：pgvector——`ALTER TABLE ... ADD COLUMN embedding vector(3)` 就够了，备份/权限/JOIN 全部复用；过滤复杂时它还有完整 SQL `WHERE`。
- **向量规模大、检索负载重、要多向量字段与混合检索、需要分布式横向扩展**：Milvus（Lite 起步做原型 → Standalone/Docker → K8s 集群），或用 Qdrant（《Chroma 与 Qdrant 单库实战》）。
- 判断"到底要不要为此多运维一套系统"、以及量化到多少钱/多少 QPS 才值得迁移，见《向量库选型：用基准测试代替宣传页》；检索质量层面的相邻主题在《元数据过滤与多维过滤检索》《混合检索：真正的 BM25、RRF 融合与生产实现》。

---

> **来源**：Milvus 部分翻译自官方文档 [Quickstart with Milvus Lite](https://raw.githubusercontent.com/milvus-io/milvus-docs/v3.0.x/site/en/getstarted/quickstart.md)（安装、`MilvusClient`、`create_collection`、insert、`search`/`query`/`delete` 与 filter 表达式、返回结构示例）与 [Run Milvus Lite Locally](https://raw.githubusercontent.com/milvus-io/milvus-docs/v3.0.x/site/en/getstarted/milvus_lite.md)（运行环境要求、限制表：`create_index()` 仅支持 `FLAT`、一致性仅 `Strong`、不支持 partition/users/roles/alias、`rename_collection`，以及 `milvus-lite dump` 迁移路径），作者 Milvus（Zilliz / LF AI & Data），许可 Apache-2.0；文档源文件取自 milvus-docs 仓库 `v3.0.x` 分支 raw 内容，核实于 2026-09-19。

---

> **补充来源**：pgvector 部分翻译自 [pgvector 官方仓库 README](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md)（Andrew Kane，PostgreSQL Licence，v0.8.x），涵盖 Indexing / HNSW（含 `m`、`ef_construction`、`hnsw.ef_search`、Index Build Time、Indexing Progress）/ IVFFlat（`lists`、`probes` 与三条召回建议）/ Iterative Index Scans（`strict_order`、`relaxed_order`、物化 CTE 与 `+ 0`）与距离运算符；"Milvus Lite 无 HNSW""近似索引改变结果集"两处对照结论为本站编者依据上述两份资料整理。抓取于 2026-09-13，补充核实于 2026-09-19。
