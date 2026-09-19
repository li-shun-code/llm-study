---
title: Milvus 与 pgvector 实战
source_url: https://milvus.io/docs/quickstart.md
author: Milvus（Zilliz）/ pgvector（Andrew Kane）
license: Apache-2.0 / PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
versions: Milvus 官方文档 Quickstart（milvus-docs v3.0.x）；pgvector v0.8.6 README
order: 18
group: 向量数据库
---
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

规模变大或要上生产时，可在 Docker/Kubernetes 部署完整 Milvus——**所有部署模式共享同一套 API**，客户端代码几乎不用改，只要指定服务器 URI 与 Token：

```python
client = MilvusClient(uri="http://localhost:19530", token="root:Milvus")
```

（原文最后还提到：可安装 Milvus Skill 让 Claude Code、Cursor 等 AI 编码助手写出正确的 Milvus 代码，另有面向 Agent 的 MCP 服务器等工具。）

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
SET hnsw.ef_search = 100;
```

## 两条路线怎么选（站内补充）

- **已有 PostgreSQL、数据量中等、想和业务数据同库同事务**：pgvector——向量与业务表直接 JOIN，备份/权限/生态全部复用（本「Agent」 篇的 PG 技能直接迁移）。
- **向量规模大、检索负载重、需要专门的分布式架构**：Milvus——Milvus Lite 本地起步，Standalone/Distributed 平滑扩容，API 不变；「RAG」的 RAG 实战会再见到它。
- 下一篇把 Chroma、Qdrant、Milvus、pgvector 与云上托管方案放到同一张表里做选型对比。

---

> **来源**：本文前半部分翻译自 [Milvus Quickstart](https://milvus.io/docs/quickstart.md)，作者 Milvus（Zilliz），许可 Apache-2.0。抓取于 2026-09-13。

---

> **补充来源**：本文后半部分翻译自 [pgvector 官方仓库 README](https://github.com/pgvector/pgvector)（v0.8.6），作者 Andrew Kane，许可 PostgreSQL Licence。两库分别代表"专用向量数据库"与"在现有 PostgreSQL 上加向量能力"两条路线。
