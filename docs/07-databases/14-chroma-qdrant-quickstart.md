---
title: Chroma 与 Qdrant 单库实战
source_url: https://github.com/qdrant/qdrant
author: Qdrant / Chroma（两项目官方 README）
license: Apache-2.0
fetched_at: 2026-09-13
translated: true
order: 14
versions: Qdrant 与 Chroma 官方仓库当前版 README（均为 Apache-2.0 项目）
---
这两个库是轻量级向量数据库的代表：Chroma 以"嵌入式、开箱即用"著称，适合本地原型与中小规模；Qdrant 以 Rust 编写、过滤能力突出，既能单机跑也能分布式部署。本篇把两库的官方上手路径放在一起对照。

## Qdrant：向量相似度搜索引擎

**Qdrant**（读作 _quadrant_）是一个向量相似度搜索引擎和向量数据库。它提供生产就绪的服务与易用的 API，用于存储、搜索和管理**点（Point）**——即带有额外载荷（Payload）的向量。Qdrant 特别强化了过滤支持，适合各类基于神经网络或语义的匹配、分面搜索等应用。它用 Rust 编写，高负载下依然快速可靠（基准见官方 benchmarks 页）。

借助 Qdrant，Embedding 或神经网络编码器可以变成完整的应用：匹配、搜索、推荐等等。除自部署外，也有全托管的 Qdrant Cloud（含免费档）。

### 本地启动与连接

在本地体验完整功能：

```bash
docker run -p 6333:6333 qdrant/qdrant
```

注意：这样启动的是**无认证的非安全部署**，对所有网络接口开放；上生产前务必阅读官方的安装（installation）与安全（security）指南。

然后用任意客户端连接，以 Python 为例：

```python
from qdrant_client import QdrantClient

client = QdrantClient(url="http://localhost:6333")
```

官方客户端库覆盖 Go、Rust、JavaScript/TypeScript、Python、.NET/C#、Java，社区另有 Kotlin、PHP 客户端。接口层面提供带 OpenAPI 3.0 规范的 REST API（可为几乎任何框架/语言生成客户端），以及面向更快生产级检索的 gRPC 接口。此外还有轻量的 **Qdrant Edge**：运行在应用进程内、数据本地存储查询、可与 Qdrant 服务器同步，适合低延迟与离线场景。

### 核心特性

- **稠密、稀疏与多向量检索**：稠密向量做语义相似，稀疏向量做全文检索，多向量支持多 Embedding 对象与 ColBERT 类后交互（Late Interaction）模型；
- **载荷过滤（Filtering on Payload）**：向量可附任意 JSON 载荷，用关键词匹配、全文、数值范围、地理位置等丰富条件，以 `should`/`must`/`must_not` 子句组合过滤；
- **混合检索（Hybrid Search）**：单次查询组合多个向量，用可配置的融合策略（如 RRF 倒数排名融合、DBSF 分布式分数融合）合并结果，兼得语义理解与关键词精度；
- **向量量化与磁盘存储**：内置量化最多省 97% 内存，可调节速度与精度权衡；
- **分布式部署**：分片 + 副本横向扩展，集合更新与扩缩容零停机。

其他亮点：分面聚合（Faceting）、正负例推荐（Recommendation）、区域限定发现（Discovery）、检索相关性调优（MMR、相关性反馈）、多租户、可观测性（指标/遥测/审计日志）、查询规划与载荷索引、SIMD 硬件加速、GPU 索引（NVIDIA 与 AMD）、基于 `io_uring` 的异步 I/O、写前日志（WAL）保证断电也持久。自带 Web UI 可视化管理集合、查看部署健康状态并调试 REST API。

## Chroma：四函数上手

Chroma 定位为"AI 时代的开源数据基础设施"。安装：

```bash
pip install chromadb # Python 客户端
# JavaScript 用 npm install chromadb
# 客户端-服务器模式：chroma run --path /chroma_db_path
```

官方 README 的招牌是"核心 API 只有 4 个函数"：

```python
import chromadb
# 内存模式起个 Chroma，方便原型；之后可轻松加持久化
client = chromadb.Client()

# 创建集合。get_collection / get_or_create_collection / delete_collection 同样可用！
collection = client.create_collection("all-my-documents")

# 添加文档。也可以 update 和 delete。按行的 API 即将推出！
collection.add(
    documents=["This is document1", "This is document2"], # 我们自动处理分词、embedding 和索引；你也可以跳过这些、直接提供自己的 embedding
    metadatas=[{"source": "notion"}, {"source": "google-docs"}], # 用这些做过滤！
    ids=["doc1", "doc2"], # 每个文档唯一
)

# 查询/搜索最相似的 2 个结果。也可以按 id .get
results = collection.query(
    query_texts=["This is a query document"],
    n_results=2,
    # where={"metadata_field": "is_equal_to_this"}, # 可选的元数据过滤
    # where_document={"$contains":"search_string"}  # 可选的文档内容过滤
)
```

注意其中的默认行为：`add` 时不传 `embeddings`，Chroma 会调用内置的默认 Embedding 模型自动向量化——这正是"嵌入式数据库"省事的地方；要从模块 6 的 Embedding API 换成自己生成的向量，把向量传给 `embeddings` 参数即可。

## 对照与选择（站内补充）

- **想 5 分钟内跑通 RAG 原型**：Chroma 的 `Client()` 零部署 + 自动 Embedding 最快；模块 8 的最小 RAG 可以直接用它。
- **想要更贴近生产的过滤、量化与横向扩展**：Qdrant 的载荷过滤体系与分布式特性更完整；单机 `docker run` 起步，后续平滑升级。
- **两者都支持元数据过滤 + 向量检索的混合查询**，语义与"在哪个会话/哪个用户的数据里搜"这类业务过滤可以一次完成。
- 下一篇的 Milvus（含 Milvus Lite）与 pgvector 则分别代表"大规模专用向量数据库"与"复用现有 PostgreSQL"两条路线。

---

> **来源**：本文翻译自 [Qdrant 官方仓库 README](https://github.com/qdrant/qdrant)，作者 Qdrant，许可 Apache-2.0。抓取于 2026-09-13。

---

> **补充来源**：本文"Chroma：四函数上手"一节翻译自 [Chroma 官方仓库 README](https://github.com/chroma-core/chroma)，作者 Chroma，许可 Apache-2.0。说明：Chroma 与 Qdrant 的官方文档站（docs.trychroma.com / qdrant.tech/documentation）未在站点层面声明开放许可，本篇因此仅选用两个 Apache-2.0 代码仓库的官方 README 作为底本。
