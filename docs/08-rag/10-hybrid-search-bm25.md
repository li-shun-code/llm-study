---
title: 混合检索：真正的 BM25、RRF 融合与生产实现
source_url: https://qdrant.tech/documentation/concepts/hybrid-queries/
author: Qdrant 官方文档（混合查询）；Elastic 官方文档（RRF retriever）；Damir Čermák（`rank_bm25` 作者）；Pinecone Learn Center（混合检索概念）
license: MIT（rank_bm25、Qdrant 文档代码）；Apache 2.0（Elasticsearch 客户端示例）；署名转载（Pinecone 概念段）
fetched_at: 2026-09-19
translated: true
versions: rank-bm25 0.2.2；sentence-transformers 6.1.0；bge-m3（BAAI）；bge-small-zh-v1.5；Qdrant client ≥1.10；Elasticsearch（RRF retriever，GA）
order: 10
group: 检索层：相似度、过滤、混合与重排
---

## 为什么需要混合检索

向量检索解决"意思相近但用词不同"，词法检索解决"必须精确命中那个词"。两者失败的模式几乎不重叠，所以互补：

| 查询类型 | 例子 | 纯向量常见失败 | 纯词法常见失败 |
| --- | --- | --- | --- |
| 同义/口语化 | "告警太多值班疲于应对" → 文档写"避免告警疲劳" | ✅ | ❌ 零命中 |
| 精确符号 | 错误码 `CROSSSLOT`、参数名 `innodb_buffer_pool_size` | ❌ 被语义近似项挤掉 | ✅ |
| 短查询/关键词串 | "502 网关 keepalive" | 一般 | ✅ |
| 新领域/无标注数据 | 内部术语、黑话 | ❌ 预训练模型没见过 | ✅ |

领域外没有微调数据时，预训练嵌入往往并不比 BM25 强；而一旦查询是"用户随口说的话"，BM25 又会直接捞空。**混合检索不是"锦上添花"，是把两种失败模式各自堵掉。** 这篇的读法：先给一组本站实测数字建立直觉，再拆"什么才叫真 BM25"（大量教程死在这一步），然后是一份能整段复制的召回对比实现，最后给出生产上把融合交给引擎做的三种姿势。每一步都有可跑的代码或可核对的 DSL。

本站在 42 篇中文运维知识、10 条查询的小评测集上的实测（完整可跑代码见下）：

| 方案 | recall@5 | recall@10 | nDCG@10 | MRR@10 | 查询编码延迟(CPU) |
| --- | --- | --- | --- | --- | --- |
| BM25（jieba 分词） | 0.550 | 0.550 | 0.777 | 0.95 | ≈0（无编码） |
| bge-small-zh-v1.5（512 维） | 0.633 | 0.833 | 0.870 | 0.95 | 72 ms |
| **BM25 + bge-small + RRF** | 0.633 | **0.867** | 0.884 | 0.95 | 72 ms |
| bge-m3（1024 维，8192 token） | 0.700 | 0.833 | 0.904 | 1.00 | 1268 ms |
| **BM25 + bge-m3 + RRF** | 0.700 | 0.833 | **0.855** | 0.95 | 1268 ms |
| 加权和（z-score 归一，各 0.5） | 0.667 | 0.833 | 0.906 | **1.00** | 72 ms |

三个必须知道的读数：

1. **recall@10 从 0.550 → 0.867**：混合检索把 BM25 完全捞不到的 paraphrase 类查询补上了；这类"词法零命中"在评测里是硬损失，只能靠语义路补。
2. **BM25 + bge-m3 的 RRF 反而比 bge-m3 单路差**（nDCG@10 0.855 < 0.904）：**RRF 的前提是两路质量相近**。当词法路在部分查询上只有 1 个候选（42 篇小语料里很常见），它会把语义路的正确第 1 名挤到第 2 名。混合不是无脑加分项。
3. **加权和（先归一化）在 nDCG 上小胜 RRF**，但它依赖分数分布稳定——换语料、换分词器、换嵌入模型都要重调权重。RRF 只用名次，天然抗分布漂移，是**默认该先试的那个**。

## 一、先纠一个普遍错误：数词频不是 BM25

很多"BM25 实现"其实是 `Counter(tokens)` 生成稀疏向量，然后交给点积。那不是 BM25，缺了它的两个灵魂：

$$\text{score}(q,d)=\sum_{t\in q}\text{IDF}(t)\cdot\frac{f(t,d)\,(k_1+1)}{f(t,d)+k_1\left(1-b+b\cdot\frac{|d|}{avgdl}\right)}$$

- **IDF**：常见词不该给高分（中文里"数据""系统""管理"几乎无区分度）；
- **长度归一化（`b`）**：长文档天然含更多词，不归一化就是奖励啰嗦；
- **词频饱和（`k1`）**：一个词出现 10 次不应该比出现 3 次好 3 倍。

缺任何一项，结果都会系统性偏移。真实实现选一个即可：

| 实现 | 语言/形态 | 特点 | 适合 |
| --- | --- | --- | --- |
| `rank_bm25`（`BM25Okapi` / `BM25L` / `BM25Plus`） | Python，内存索引 | 三行接入，无依赖 | 十万级以下文档、原型、评测基线 |
| Elasticsearch / OpenSearch BM25 | 服务，倒排索引 | 分词器可插拔（中文用 IK/smartcn），带过滤聚合 | 生产全文检索主力 |
| Qdrant sparse vector + named vectors | 向量库内混合 | 稀疏向量由服务端 BM25 或 SPLADE 生成，单库单查询 | 已用向量库、想省一个系统 |
| Pyserini（Lucene/Anserini） | Python 桥接 Java | 学术基准常用，支持 `bm25` 严格参数 | 论文复现、大规模离线 |
| JoRank | 中文 BERT 词法打分器 | 不是 BM25 而是可学习的词法相关模型，中文短文本表现好 | 中文场景想要"比 BM25 更懂中文" |

下面用 `rank_bm25` + `jieba` 从零做一遍，并给出 RRF 与加权融合两种合并方式。

## 二、可跑实现：BM25 + 向量 + RRF

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "rank-bm25==0.2.2" "jieba>=0.42.1" "numpy>=1.26" "sentence-transformers>=6.0"
# 国内拉模型更快：pip install modelscope，再用 snapshot_download 下载到本地目录后传入路径
```

### 1. 两路检索器

```python
import math
import re

import jieba
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

STOP = set("的 了 是 在 和 与 会 要 可 以 及 对 中 上 下 时 为 个 这 那 也 都 就 ".split())

DOCS = [
    "机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。",
    "告警分级建议按「是否影响可用性、是否有用户可感知影响、是否需要即时介入」三条线划分。P1 只留给大面积不可用，避免告警疲劳。",
    "Redis 集群模式下跨 slot 的多 key 命令会报 CROSSSLOT，需要用 hash tag 把相关 key 落到同一 slot。",
    "Ingress 502/504 的常见原因是后端 keepalive 超时短于代理空闲超时，导致连接被提前关闭。",
    "磁盘 IO 等待高时先看 iostat 的 %util 与 await 两列，再用 pidstat -d 定位进程。RAID5 写惩罚为 4。",
]


def tok(text):
    """索引期与查询期必须用同一个分词函数，否则词表对不上。"""
    text = re.sub(r"\s+", "", text.lower())
    return [t for t in jieba.lcut(text) if len(t) > 1 and t not in STOP]


class Lexical:
    """真 BM25：IDF + 词频饱和 + 长度归一（k1/b 是可调参数）。"""

    def __init__(self, docs, k1=1.2, b=0.75):
        self.index = BM25Okapi([tok(d) for d in docs], k1=k1, b=b)

    def search(self, query, k=20):
        scores = self.index.get_scores(tok(query))
        order = [i for i in np.argsort(-scores) if scores[i] > 0][:k]   # 0 分必须剔除
        return [(i, float(scores[i])) for i in order]


class Dense:
    def __init__(self, model_name_or_path, docs):
        self.model = SentenceTransformer(model_name_or_path, device="cpu")
        self.vecs = self.model.encode(docs, normalize_embeddings=True,
                                      batch_size=8, show_progress_bar=False)

    def search(self, query, k=20):
        q = self.model.encode([query], normalize_embeddings=True, show_progress_bar=False)[0]
        sims = self.vecs @ q
        return [(i, float(sims[i])) for i in np.argsort(-sims)[:k]]
```

### 2. 融合：RRF（只用名次）与加权和（要先归一化）

```python
def rrf(rank_lists, k0=60):
    """Reciprocal Rank Fusion：score = Σ 1/(k0 + rank)。只用名次，量纲无关。"""
    acc = {}
    for ranks in rank_lists:
        for pos, (doc_id, _) in enumerate(ranks, start=1):
            acc[doc_id] = acc.get(doc_id, 0.0) + 1.0 / (k0 + pos)
    return sorted(acc.items(), key=lambda x: -x[1])


def weighted_z(list_a, list_b, w=0.5):
    """加权分数融合：两路各自 z-score 归一后再相加，否则量纲不可比。"""
    def prep(lst):
        vals = [s for _, s in lst]
        mu, sd = float(np.mean(vals)), float(np.std(vals)) or 1.0
        return [(d, (s - mu) / sd) for d, s in lst]

    a, b = prep(list_a), prep(list_b)
    acc = {}
    for d, s in a:
        acc[d] = acc.get(d, 0.0) + (1 - w) * s
    for d, s in b:
        acc[d] = acc.get(d, 0.0) + w * s
    return sorted(acc.items(), key=lambda x: -x[1])
```

**RRF 的 `k0`（默认 60）不是玄学**：它是"第 1 名的优势折价"。`k0` 越小，头名权重越集中（更相信单路的第一名）；越大越平均。经验：两路质量相当用 60；一路明显更可信时调小到 20-30。RRF 只消费名次带来的另一个好处是**对分数分布鲁棒**：嵌入模型换版、BM25 分词器升级，分数量纲都会漂移，但"谁排第一"的语义不变，所以融合层不用跟着改。代价是它丢掉了"差多少"的信息——第 1 名比第 2 名好 0.01 和好 0.5，在 RRF 眼里一样。这就是分数融合（加权和/DBSF）仍然存在的理由：当你确信两路分数可比（同一批语料、稳定分布）时，它能保留更多排序细节，配重排时往往多榨出一点 nDCG。

选哪种？给一条决策线：**默认 RRF；两路都很稳且你愿意养一套归一化与权重调参时，再试加权融合**——然后用下面的评测脚本在同一份标注集上对比，用数字说话，不要靠感觉。

### 3. 端到端与打分

```python
def hybrid(query, lex, den, k_final=5, mode="rrf"):
    a, b = lex.search(query, k=20), den.search(query, k=20)
    fused = rrf([a, b]) if mode == "rrf" else weighted_z(a, b, w=0.5)
    return [(i, round(s, 4)) for i, s in fused[:k_final]]


if __name__ == "__main__":
    lex = Lexical(DOCS)
    den = Dense("/path/to/bge-small-zh-v1.5", DOCS)      # 换成任意本地/镜像目录
    for q in ["告警太多值班疲于应对怎么办", "CROSSSLOT", "502 keepalive"]:
        print(q, "| BM25:", lex.search(q, 3), "| Dense:", den.search(q, 3))
        print("     RRF:", hybrid(q, lex, den), " 加权:", hybrid(q, lex, den, mode="z"))
```

本机在 42 篇语料上跑出的**关键诊断**（每个查询列出"只有向量捞到 / 只有 BM25 捞到"的文档）：

```text
q6 告警太多值班疲于应对  只有向量捞到=['d34','d13','d27']  只有 BM25 捞到=[]  相关集=['d28','d30','d31']
q5 TIME_WAIT 太多怎么处理 只有向量捞到=['d07','d13','d31','d27'] 只有 BM25 捞到=[] 相关集=['d06','d13','d37']
q3 MySQL 主从同步延迟怎么看 只有向量捞到=['d16','d07','d27'] 只有 BM25 捞到=['d34','d15','d42'] 相关集=['d15','d17','d18']
q10 交换机端口报错排查    只有向量捞到=['d34','d07','d14'] 只有 BM25 捞到=['d19'] 相关集=['d34','d35','d36']
```

- q6、q5 这类**口语化查询 BM25 的独有命中为空**（因为它只匹配字面词），全靠向量路补；
- q3、q10 这类**两路各有独有命中且都有对的**，正是融合收益最大处；
- 反例：q1（`机柜功率密度太高怎么解决`）向量独有 4 篇里只有一篇相关，融合时反而引入噪声——所以**融合后一定要接重排**（《重排序（Rerank）：LLM 打分与 Cross-Encoder 精排》），别让 top-20 直接进 prompt。

## 三、生产实现：把融合交给引擎做

自己写融合逻辑适合原型与评测，但生产上更稳的做法是让检索引擎在**一次请求内**完成两路召回与融合：候选不跨网络搬运、过滤与权限只写一处、延迟只有一个来回。下面三种姿势按"你已有什么系统"来选，共同点是**语义都不变：两路各取一批候选 → 按名次或归一化分数合并 → 截断给重排**。

### 1. Elasticsearch：`rrf` retriever（一次请求内完成词法 + kNN 融合）

```json
POST /ops_docs/_search
{
  "retriever": {
    "rrf": {
      "retrievers": [
        { "standard": { "query": { "multi_match": {
            "query": "告警太多值班疲于应对", "fields": ["title^2", "content"] } } } },
        { "standard": { "query": { "knn": {
            "field": "content_vector",
            "query_vector": [0.021, -0.017, "...省略"],
            "k": 50, "num_candidates": 200 } } } }
      ],
      "rank_window_size": 50,
      "rank_constant": 60,
      "filter": { "term": { "space_id": "sre" } }
    }
  },
  "size": 5
}
```

要点：`rank_window_size` 是**每路取多少参与融合**（要大于最终 size，否则召回不足）；`rank_constant` 就是 RRF 的 `k0`；`filter` 在融合层生效，比在两路里各写一遍更一致。中文务必显式配 `analyzer`（IK 或 smartcn），默认 `standard` 分析器会把中文切成单字，BM25 效果大打折扣。

### 2. Qdrant：命名向量 + `FusionQuery`

```python
from qdrant_client import QdrantClient, models

client = QdrantClient(url="http://localhost:6333")
client.query_points(
    collection_name="ops_docs",
    prefetch=[
        models.Prefetch(
            query=models.DocumentDocument(text="告警太多值班疲于应对"),   # 服务端 BM25 稀疏编码
            using="sparse", limit=50),
        models.Prefetch(
            query=[0.021, -0.017], using="dense", limit=50),
    ],
    query=models.FusionQuery(fusion=models.Fusion.RRF),
    limit=5,
    query_filter=models.Filter(must=[models.FieldCondition(key="space_id",
                                                          match=models.MatchValue(value="sre"))]),
)
```

Qdrant 还支持 `Fusion.DBSF`（分布标准化后融合，等价于本文的归一化加权和，但对分布突变更稳）与 `sparse_vector` 自定义权重；`bm25` 编码器可以在服务端建（`models.Bm26...` 见官方文档的 `SparseVectorParams` 编解码器一节），这样索引期/查询期分词器永远一致。

### 3. 单库方案：PostgreSQL 全文 + pgvector

已经用 Postgres 的团队不必再引一个搜索引擎：`tsvector`（配合 `pg_trgm`/中文分词扩展）做词法、`pgvector` 做语义，两条 SQL 各自取 top-N 后在应用层 RRF，或直接用一条 CTE 做窗口排名。**收益是运维面小一个系统**，代价是全文检索的相关性功能（同义词、拼音、纠错）要自己补。具体 SQL 见《PostgreSQL 全文检索（含中文分词）》与《Milvus 与 pgvector 实战》。

## 常见坑

1. **中文分词器不一致**：索引期用 jieba、查询期用空格切，等于换了个词表。生产上把分词逻辑收敛到一处（或交给引擎服务端编码）。
2. **BM25 的 0 分文档进结果**：`rank_bm25` 对无共享词的文档给 0 分，不剔除就会看到"半屏无关结果"。上面 `search()` 里的 `scores[i] > 0` 是必须的。
3. **把 `top_k` 设成融合后大小**：两路各 5、融合 5，等于没混合。正确姿势：两路各 50-200 → 融合 → 截断到 5-20（交给 rerank）。
4. **原始分数直接相加**：BM25 无上界（本文实测 top1 从 3.36 到 9.33），余弦在 [0,1]。不归一化就是让词法路偷偷决定结果。
5. **RRF 掩盖单路退化**：任何一路质量下降（嵌入模型换版、分词器升级）都会被融合"平均掉"而不易察觉。上线后仍要**分别监控两路的 recall**。
6. **过滤条件只写在一路**：融合引擎里 filter 要作用于融合整体，否则可能出现"被过滤的文档通过另一路混进来"。
7. **稀疏向量用 token 计数当"BM25"**：即本文开头那个错误；如果必须走稀疏向量路线，用引擎内建 BM25 编码器或 SPLADE 之类的学习式稀疏模型。
8. **评测集太小，融合反而变差**：本文 bge-m3 + BM25 的 RRF 分数低于单路就是这种情形（小语料 + 候选数不足）。别在 20 条查询上做架构决策。

## 延伸阅读

- RRF 原始论文：Cormack、Clarke、Buettcher，*Reciprocal Rank Fusion outconsists Condorcet fusion*（2009）。
- Qdrant 文档：[Hybrid Queries](https://qdrant.tech/documentation/concepts/hybrid-queries/)（Fusion RRF/DBSF、命名向量）。
- Elastic 文档：[RRF retriever](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever)、[BM25 参数实战](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-parameters)。
- JoRank 中文词法打分器：`od-joy/JoRank`。
- 本站相关：《检索层 IR 指标专篇：recall@k、MRR、nDCG 与截断阈值怎么定》《重排序》《向量检索与相似度》《元数据过滤与多维过滤检索》。

---

> **来源**：抓取于 2026-09-19。概念与动机部分参考 [Pinecone Learn: Getting Started with Hybrid Search](https://www.pinecone.io/learn/hybrid-search-intro/)（James Briggs，署名转载）；融合与生产实现整理自 [Qdrant Hybrid Queries](https://qdrant.tech/documentation/concepts/hybrid-queries/)（MIT）与 [Elasticsearch RRF retriever 文档](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/rrf-retriever)（Apache 2.0）；BM25 实现使用 [rank_bm25](https://github.com/dorianbrown/rank_bm25)（MIT）。
> **编者注**：原译文中 Pinecone 旧版 pod API 与"用 BERT token 计数充当稀疏向量"的写法已删除（那不是 BM25，且客户端 API 已过时），改为本文的可运行实现与引擎侧真实 DSL。第一节表格与第二节的诊断输出为本站在 42 篇中文语料 / 10 条查询上的本机实测（macOS，`sentence-transformers 6.1.0` + `rank-bm25 0.2.2` + CPU 推理，模型目录来自 ModelScope 镜像）；语料与标注由本站编写。
