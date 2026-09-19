---
title: Chroma 与 Qdrant 单库实战
source_url: https://docs.trychroma.com/docs/overview/getting-started
author: Chroma（docs.trychroma.com 官方文档）、Qdrant 与 qdrant-client（官方仓库 README）
license: Apache-2.0（chroma-core/chroma、qdrant/qdrant、qdrant/qdrant-client 三个仓库的 LICENSE 均为 Apache-2.0；Chroma 文档站内容按项目文档署名转载）
fetched_at: 2026-09-19
translated: true
versions: chromadb 当前版（单节点 HNSW / 分布式 SPANN 双索引路线）；qdrant 与 qdrant-client 当前版（`query_points` 新 API，`search` 为旧名）；HNSW 默认 ef_search=100、ef_construction=100、sync_threshold=1000、resize_factor=1.2
order: 15
group: 向量数据库
---
上一篇《向量数据库原理：从 HNSW 论文与公开基准说起》讲的是"为什么快、参数管什么"；本篇只干一件事：**把 Chroma 和 Qdrant 各跑通一遍**——建库、写入、过滤检索、调索引参数，每一步都给可运行代码和它出自哪份官方文档。两者的分工也很清楚：Chroma 代表"嵌进进程里、零部署"的路线，Qdrant 代表"起一个服务、过滤与量化能力齐全"的路线。至于"到底该选哪一个"，本篇不下结论，判断依据与决策树在《向量库选型：用基准测试代替宣传页》。

## 一、Chroma：一个客户端对象就是整个数据库

安装只要一步，Python 与 JS/TS 各有客户端：

```bash
pip install chromadb          # Python；装好后同时得到 chroma CLI
# npm install chromadb        # JavaScript / TypeScript
```

### 1. 三种客户端，对应三种生命周期

官方文档把客户端分成几类，最容易搞混的就是"数据到底存不存在"这件事：

```python
import chromadb

# ① 内存模式：进程内起一个 Chroma，程序退出数据就没了
client = chromadb.Client()

# ② 持久模式：同一套 API，数据落到本地目录
client = chromadb.PersistentClient(path="/path/to/save/to")

# ③ 客户端-服务器模式：先 `chroma run --path /chroma_db_path` 起服务，再连
client = chromadb.HttpClient(host="localhost", port=8000)
```

`PersistentClient` 的 `path` 就是数据库目录，启动时自动加载已有数据；**不传则默认用 `.chroma`**。两个便捷方法要记住：`heartbeat()`（探活）、`reset()`（清空整个库，官方原文直接标注 "WARNING: This is destructive and not reversible"，别在生产连接上敲）。

### 2. 四步跑通：建集合、写入、查询

官方上手文档的完整例子（把 `create_collection` 换成 `get_or_create_collection`、`add` 换成 `upsert` 就能反复运行而不报错）：

```python
import chromadb

chroma_client = chromadb.Client()

# 集合：存放 embeddings、文档与元数据的地方，负责索引与高效检索/过滤
collection = chroma_client.get_or_create_collection(name="my_collection")

# 必须提供唯一的字符串 id；不传 embeddings 时由内置 Embedding 函数自动向量化
collection.upsert(
    documents=[
        "This is a document about pineapple",
        "This is a document about oranges",
    ],
    ids=["id1", "id2"],
)

results = collection.query(
    query_texts=["This is a query document about hawaii"],  # Chroma 帮你 embed
    n_results=2,
)
print(results)
```

输出长这样（`distances` 是查询向量到命中文档的距离，越小越相似）：

```text
{ 'documents': [['This is a document about pineapple', 'This is a document about oranges']],
  'ids': [['id1', 'id2']],
  'distances': [[1.0404009819030762, 1.243080496788025]],
  'uris': None, 'data': None,
  'metadatas': [[None, None]],
  'embeddings': None }
```

三条要点：

1. **`n_results` 不给就返回 10 条**——文档里专门说明了这点，也是"我只要 3 条却拿到 10 条"的原因；
2. **默认 Embedding 函数是双刃剑**：`add`/`query` 传 `documents`/`query_texts` 时它会自己下载模型并向量化，原型很省事，但生产上写入侧与查询侧必须是**同一个模型、同一个版本**，否则向量不在同一空间里。换成自己算好的向量（例如《Embedding API 与文本相似度》里那套）就传 `embeddings=[[...]]`；
3. **过滤是 `where`（元数据）与 `where_document`（文档内容）两个参数**，写在 `query` 里，不用另建索引表。

### 3. 索引配置：`configuration={"hnsw": ...}`

单节点 Chroma 用 HNSW。集合创建时可以显式指定空间与建图参数：

```python
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

collection = client.create_collection(
    name="my-collection",
    embedding_function=OpenAIEmbeddingFunction(model_name="text-embedding-3-small"),
    configuration={
        "hnsw": {
            "space": "cosine",       # 默认是 l2！另可选 cosine / ip
            "ef_construction": 200,  # 建图候选宽度，默认 100
        }
    },
)
```

官方文档给出的参数语义与默认值，和《向量数据库原理：从 HNSW 论文与公开基准说起》里的定义一一对应：

| 参数 | 官方定义（译） | 默认 | 建后可改 |
| --- | --- | --- | --- |
| `space` | 距离函数：`l2`（平方 L2）/`cosine`/`ip` | `l2` | 否 |
| `ef_construction` | 建索引时选邻居用的候选列表大小；越大索引质量越好，但更耗内存与时间 | 100 | 否 |
| `ef_search` | 查询时的动态候选列表大小；越大召回越高、查询越慢 | 100 | **是** |
| `num_threads` | 建索引/查询用的线程数 | `multiprocessing.cpu_count()` | 是 |
| `sync_threshold` | 多久把索引同步到持久层 | 1000 | 是 |
| `resize_factor` | 索引需要扩容时的增长倍数 | 1.2 | 是 |

真正值得抄进笔记的是文档里那组对照实验——**50,000 条 2048 维随机向量**，两个集合只差参数：

- A 集合 `ef_search=10`：查询耗时 `0.00529` 秒，返回距离 `[3629.02, 3666.58, 3684.57]`；
- B 集合 `ef_search=100` + `ef_construction=1000`：查询耗时 `0.00753` 秒（**慢约 42%**），返回距离 `[0.0, 3620.59, 3623.28]`。

那次查询用的是集合内某个真实存在的向量（`id=1`），它本身必然在库里，正确结果的第一条距离应该是 `0.0`。**A 集合压根没找到它**——这就是"召回"最直观的定义：不是结果不够好，而是该出现的根本没出现。多花 42% 的延迟，换来的是索引真的把答案找回来了。调 `ef_search` 时脑子里要有这张表：它换的不是"排序更漂亮"，而是"漏没漏"。

## 二、Qdrant：服务化 + 载荷过滤

Qdrant（读作 _quadrant_）是 Rust 写的向量相似度搜索引擎与向量数据库，官方 README 的自我定位是"提供生产就绪的服务与便于存储、搜索、管理**点（Point，即带载荷的向量）**的 API"，并强调**面向扩展过滤**（extended filtering support）做了专门设计。

### 1. 起服务，或者不起

```bash
docker run -p 6333:6333 qdrant/qdrant
```

官方 README 紧接着提醒：这样起的是**无认证、对所有网卡开放**的部署，上生产前必须读它的 installation 与 security 指南。

客户端侧最容易被忽略的一件事：`qdrant-client` 自带 **local mode**，同一套 API 不需要服务器：

```python
from qdrant_client import QdrantClient

client = QdrantClient(":memory:")            # 纯内存，测试/CI 用
client = QdrantClient(path="path/to/db")     # 落盘（README 原文：Persists changes to disk）
client = QdrantClient(url="http://localhost:6333")   # 连服务器
client = QdrantClient(host="localhost", port=6333)   # 等价写法
```

README 对 local mode 的定位很坦白：用于**开发、原型与测试**（可以在 Colab/Notebook 里跑，CI 里也能用），"When you need to scale, simply switch to server mode"。也就是说它是**协议兼容的替身**，不是性能对等的嵌入式引擎——基准数字请以 server 模式为准。

要走 gRPC（官方标注"typically, much faster"，尤其批量上传）：

```python
client = QdrantClient(host="localhost", grpc_port=6334, prefer_grpc=True)
```

异步同理，把 `QdrantClient` 换成 `AsyncQdrantClient`，方法名一致、前面加 `await`。

### 2. 建集合、写点、查最近邻

```python
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = QdrantClient(url="http://localhost:6333")

client.create_collection(
    collection_name="my_collection",
    vectors_config=VectorParams(size=100, distance=Distance.COSINE),
)

vectors = np.random.rand(100, 100)
# README 原文提醒：逐点上传因请求开销不推荐；
# 要么自己切块，要么直接用 upload_collection / upload_points（它们替你处理分批）
client.upsert(
    collection_name="my_collection",
    points=[
        PointStruct(id=idx, vector=vec.tolist(), payload={"color": "red", "rand_number": idx % 10})
        for idx, vec in enumerate(vectors)
    ],
)

hits = client.query_points(collection_name="my_collection", query=np.random.rand(100), limit=5)
```

三个 API 面的坑，都是新手会撞的：

- **方法名换代**：现在官方 README 用的是 `query_points(...)`，返回值取 `.points`；旧文档/旧博客里的 `search()` 是同一件事的旧名，新代码统一用 `query_points`。
- **`size` 必须和向量维度严格相等**，否则 upsert 直接报错；换 Embedding 模型 = 全量重算，这在《向量数据库原理：从 HNSW 论文与公开基准说起》第六节里是"为什么需要一个数据库"的第一条。
- **别逐点 `upsert`**。README 明确写了这句警告（"uploading points one-by-one is not recommended due to requests overhead"），批量灌库用 `upload_collection`/`upload_points`，它们自带分批。

### 3. 载荷过滤：Qdrant 的主场

带条件的相似检索，官方 README 给的就是这个形状：

```python
from qdrant_client.models import Filter, FieldCondition, Range

hits = client.query_points(
    collection_name="my_collection",
    query=query_vector,
    query_filter=Filter(
        must=[  # 这些条件必须满足
            FieldCondition(key="rand_number", range=Range(gte=3))  # rand_number >= 3
        ]
    ),
    limit=5,
)
```

`must` / `should` / `must_not` 三个子句组合成布尔条件；条件字段来自任意 JSON 载荷，可用关键词匹配、全文、数值范围、地理位置等。为什么它能做到过滤后召回还不塌？因为**过滤是在索引层参与的**，而不是取回一批再丢掉——原理那篇用 pgvector 的数字讲过"过滤在索引扫描之后应用"的代价，这里是对照的另一面。

配套的 `full_scan_threshold` 也值得记：Qdrant 源码里它的注释是"当某条件命中的向量总量（按 1 KB ≈ 一条 256 维向量折算）小于该阈值时，查询规划器改用全量扫描而不是遍历 HNSW"，默认值 `DEFAULT_FULL_SCAN_THRESHOLD = 10_000`（KB，即约一万条 256 维向量；稀疏向量的对应常量是 5_000）。换句话说：**过滤极强、命中集很小的时候，图索引本来就打不过暴力扫**，这不是 bug 是设计。

### 4. 顺手做 Embedding：Inference API + FastEmbed

README 里那条最短路径值得单独一节——本地跑语义检索可以完全不碰模型代码：

```bash
pip install "qdrant-client[fastembed]"
```

```python
from qdrant_client import QdrantClient, models

client = QdrantClient(":memory:")
model_name = "sentence-transformers/all-MiniLM-L6-v2"
payload = [
    {"document": "Qdrant has Langchain integrations", "source": "Langchain-docs"},
    {"document": "Qdrant also has Llama Index integrations", "source": "LlamaIndex-docs"},
]

client.create_collection(
    "demo_collection",
    vectors_config=models.VectorParams(
        size=client.get_embedding_size(model_name), distance=models.Distance.COSINE
    ),
)
client.upload_collection(
    collection_name="demo_collection",
    vectors=[models.Document(text=d["document"], model=model_name) for d in payload],
    ids=[42, 2],
    payload=payload,
)
result = client.query_points(
    collection_name="demo_collection",
    query=models.Document(text="This is a query document", model=model_name),
).points
```

同一套 API 换到 Qdrant Cloud 时只需 `QdrantClient(..., cloud_inference=True)` 就能用云端预置模型（官方注明该远程推理仅付费套餐可用）。FastEmbed 是 CPU 上跑 ONNX 的向量库，也支持 GPU（`qdrant-client[fastembed-gpu]`，与 `fastembed` 互斥，需换干净环境安装）。

## 三、同一件事的两种写法

两库的对象模型不一样，但要做的事逐条对得上。把这张表记住，换库时基本只需要改调用形状：

| 要做的事 | Chroma | Qdrant |
| --- | --- | --- |
| 逻辑容器 | `create_collection(name=...)` | `create_collection(collection_name=..., vectors_config=VectorParams(size=D, distance=...))` |
| 维度与度量声明 | 由 embedding 函数决定，度量在 `configuration.hnsw.space` | 建集合时就要定死 `size` 与 `Distance.COSINE` |
| 写一条记录 | `add/upsert(ids=..., documents=[...], metadatas=[...])` | `upsert(points=[PointStruct(id=..., vector=[...], payload={...})])` |
| 批量灌数据 | `add` 传列表即可 | `upload_collection` / `upload_points`（自动分批） |
| 相似检索 | `query(query_texts=[...], n_results=k)` | `query_points(query=向量或文档, limit=k)` |
| 业务过滤 | `where={"source": "notion"}`、`where_document={"$contains": "..."}` | `query_filter=Filter(must=[FieldCondition(...)])` |
| 不走向量、按条件取回 | `collection.get(ids=..., where=...)` | `client.scroll(filter=..., with_payload=True)` |
| 换 Embedding 模型 | 传 `embeddings=[[...]]`，或换 `embedding_function` | 自己算好向量再 `upsert`（或用 FastEmbed/Cloud Inference） |
| 从零依赖到服务 | `Client()` → `PersistentClient` → `HttpClient` | `QdrantClient(":memory:")` → `path=` → `url=` |

最后一行值得多说两句：**两库都把"嵌入式起步 → 服务化上线"做成了一条同 API 的升级路径**，这正是它们适合教学与快速迭代的原因；但升级点上也各有代价——Chroma 换成 client-server 后数据仍在单机目录，要横向扩展就得走分布式/Cloud，而那里的索引换成了 SPANN；Qdrant 的 local mode 换到 server 后，才是它在《向量库选型：用基准测试代替宣传页》里被讨论的那个形态。

## 四、常见坑

1. **Chroma 的默认 `space` 是 `l2`，不是 `cosine`**。句向量检索习惯上用余弦，忘了改 `space` 就会让排名莫名其妙变差——这是两库之间最容易互相"背刺"的一处：Qdrant 建集合时必须显式给 `Distance.COSINE`，Chroma 不配置就是 `l2`。
2. **Chroma 单节点是 HNSW，分布式/Cloud 是 SPANN**。官方文档明说 SPANN 配置**目前不允许自定义，传了会被服务端忽略**：你在本地调好的 `ef_search`/`ef_construction` 到了云上不是同一套旋钮。
3. **`client.reset()`（Chroma）与 `drop_collection` 都不可回滚**。本地库随手 reset 无所谓，连到远端时先确认路径/URI。
4. **Qdrant local mode 不是性能档位**。它解决的是"零依赖跑测试"，别拿它的耗时去估算服务器。
5. **上传方式决定建库时长**：Qdrant 用 `upload_collection`/`upload_points` 而非逐点 `upsert`；Chroma 的 `add` 记得 `ids` 唯一，重复 id 想覆盖请用 `upsert`。
6. **返回条数要显式给**：Chroma 的 `query` 不传 `n_results` 就返回 10 条（官方文档明写），Qdrant 的 `query_points` 在 README 示例里每次都带了 `limit`——跨库对齐结果条数时别依赖默认值。
7. **持久化与否**：Chroma 的 `chromadb.Client()` 与 Qdrant 的 `QdrantClient(":memory:")` 都会在进程结束时丢数据——教程里跑通了不代表第二天还在。

## 五、小结

- Chroma 的三档客户端（内存 / 持久 / client-server）+ 四函数 API（`create_collection`/`add`/`upsert`/`query`）覆盖原型到单机上线；索引参数走 `configuration={"hnsw": {...}}`，`ef_search` 是唯一可事后改的那个。
- Qdrant 走服务化路线（`docker run` + REST/gRPC），载荷过滤与 `full_scan_threshold` 是它的看家能力；客户端另有 local mode 与 FastEmbed 推理，方便测试与快速起步。
- 两个库的官方文档都把自己按在"工具"位置上：真正决定效果的是**距离函数与向量是否归一化匹配**、**参数与召回目标是否对齐**——原理与判据在《向量数据库原理：从 HNSW 论文与公开基准说起》，跨库比较与决策在《向量库选型：用基准测试代替宣传页》。

**延伸阅读**：《元数据过滤与多维过滤检索》《混合检索：真正的 BM25、RRF 融合与生产实现》《Embedding 模型选型实战（中文优先）》。

---

> **来源**：本文整合翻译自三份一手资料。Chroma 部分：[Getting Started](https://docs.trychroma.com/docs/overview/getting-started)、[Chroma Clients](https://docs.trychroma.com/docs/run-chroma/clients)、[Configure Collections](https://docs.trychroma.com/docs/collections/configure)（含 HNSW 参数表、`ef_search=10` vs `ef_search=100 + ef_construction=1000` 的 50,000×2048 对照实验，以及分布式 SPANN 不可配置这一条）与 [chroma-core/chroma README](https://raw.githubusercontent.com/chroma-core/chroma/main/README.md)，作者 Chroma，许可 Apache-2.0。Qdrant 部分：[qdrant/qdrant README](https://raw.githubusercontent.com/qdrant/qdrant/master/README.md)（定位、docker 启动与安全提示、客户端矩阵、Qdrant Edge）与 [qdrant/qdrant-client README](https://raw.githubusercontent.com/qdrant/qdrant-client/master/README.md)（local mode、create_collection/upsert/query_points、Filter+Range 示例、gRPC、异步客户端、FastEmbed Inference API 全部为原文代码的中文注释版），作者 Qdrant，许可 Apache-2.0。`full_scan_threshold` 的语义另见 [Qdrant 源码 `lib/segment/src/types.rs`](https://raw.githubusercontent.com/qdrant/qdrant/master/lib/segment/src/types.rs)。文中参数默认值以官方文档为准（抓取于 2026-09-19），"对照与选择"类的判断不取自任何厂商对比页，均为本站编者依据上述资料整理。
