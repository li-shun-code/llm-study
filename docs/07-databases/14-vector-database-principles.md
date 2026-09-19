---
title: 向量数据库原理：从 HNSW 论文与公开基准说起
source_url: https://arxiv.org/abs/1603.09320
author: Yury A. Malkov, Dmitry A. Yashunin（arXiv:1603.09320）；Martin Aumueller / Erik Bernhardsson / Alec Faitfull（ann-benchmarks）；pgvector、Qdrant、Milvus 官方文档与源码
license: arXiv 论文按预印本署名学习翻译；ann-benchmarks 为 MIT；pgvector 为 PostgreSQL Licence；Qdrant / Milvus 文档与源码为 Apache-2.0
fetched_at: 2026-09-19
translated: true
versions: HNSW 论文 v4（2018-01-23 提交，2016-03 首发）；ann-benchmarks 站点当前批次（sift-128 / gist-960 / glove-100 等单查询基准）；pgvector 0.8.x（HNSW 默认 m=16、ef_construction=64、ef_search=40）；Qdrant 当前版（HNSW 默认 m=16、ef_construct=100）
order: 14
group: 向量数据库
---
"向量数据库为什么快"这个问题，用厂商宣传页回答会得到一堆形容词；用一手资料回答，答案只有一句话：**它不保证找到真正的最近邻，而是用可控的错误率换取数量级的速度。** 本篇把这条主线讲透——近似最近邻（ANN）问题的代价模型、HNSW 图索引的构造与搜索、量化的另一条路线、以及三个决定一切的工程参数，最后给出参数在 pgvector / Qdrant 里的真实默认值与调法。选型结论放在《向量库选型：用基准测试代替宣传页》。

## 一、先把代价算出来：为什么必须近似

一个 n 维向量的表有 N 条时，精确暴力检索（brute-force / flat）一次查询的代价是 N 次 n 维距离计算，约 `N × n` 次浮点乘加。取常见规模：N = 1,000,000、n = 768 ≈ 7.7 × 10⁸ 次乘加。单核每秒约 10⁹ 次浮点操作的上界意味着**一次查询就要半秒以上**，而线上检索要求 20 毫秒内返回、每秒上千次查询——差三个数量级。

三条通用出路：

| 路线 | 思路 | 代表 | 代价 |
| --- | --- | --- | --- |
| 图索引 | 把点连成可导航的稀疏图，查询时在图上贪心走 | **HNSW**、NSG、DiskANN/Vamana | 内存高（要存边）、建索引慢、删除更新麻烦 |
| 倒排/聚类 | 先粗量化把向量分簇，查询只探最近的几簇 | IVF（`nlist`/`probes`）、IVF-PQ | 召回受簇质量影响，边界点易漏 |
| 压缩/量化 | 牺牲精度换内存与带宽：把 float32 压成低比特码 | PQ、SQ、二值化、标量量化 | 需要重排（rerank）补精度 |

**关键认知：这三条不是互斥选项，而是可以叠加的层。** pgvector 的 `ivfflat` 是聚类路线、`hnsw` 是图路线；Milvus/Qdrant 则同时提供 HNSW + 量化 + IVF 家族，生产上常见"HNSW 图 + PQ/SQ 压缩 + 精排"的组合。

## 二、HNSW：可导航小世界 + 分层

HNSW 论文的标题就是方案本身：*Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs*（arXiv:1603.09320，Malkov & Yashunin，2016 首发、2018-01-23 提交 v4）。

### 1. 两个前置概念

- **可导航小世界（NSW）**：一张"任意两点间跳跃距离短、且局部可贪心路由"的图。论文的洞察是高维向量空间本身就带小世界性质，只要按邻近度连边就能贪心搜索。但**纯 NSW 有两个毛病**：度数分布高度偏斜（hub 节点过载）、查询距离长时对数复杂度只在特定范围内成立。
- **分层 + 尺度分离**：解决办法是把图做成多层。

### 2. 论文的三条机制（照原话记最省事）

1. **多层结构，逐层嵌套**："Hierarchical NSW incrementally builds a multi-layer structure consisting from hierarchical set of proximity graphs (layers) for nested subsets of the stored elements."（增量地为一层层嵌套的元素子集构建邻近图）。
2. **层高按指数衰减分布随机抽取**："The maximum layer in which an element is present is selected randomly with an exponentially decaying probability distribution."——这就是它和"跳表"形似的部分：绝大多数点只在第 0 层，越往上点越稀。
3. **从最高层进入 + 尺度分离 → 对数复杂度**："Starting search from the upper layer together with utilizing the scale separation boosts the performance compared to NSW and allows a logarithmic complexity scaling." 高层是"粗看全局"的快线（长边），一层层往下落到"细看局部"的短边。

另外一条工程上的关键："Additional employment of a heuristic for selecting proximity graph neighbors significantly increases performance at high recall and in case of highly clustered data."（**邻居选择启发式**——不是简单取 M 个最近的就连边，而是要求候选"比已选邻居离查询点更远"才接受）。论文说这条启发式对**高召回**和**聚簇数据**（真实 embedding 就是这样，同主题文档挤成一团）提升明显。理解到这里，你就能解释"为什么我的 HNSW 在合成数据上表现好、上真数据就掉召回"。

### 3. 搜索过程（一次查询实际发生了什么）

```text
入口点 = 顶层唯一元素
for level from top down to 1:
    在该层图上贪心走：反复跳到更近的邻居，直到局部最优      ← 只用 1 个候选（ef=1）
第 0 层：以同样的方式走，但维护一个大小为 efSearch 的动态候选列表
返回其中最近的 k 个
```

于是三个参数各司其职：**M** 决定图的连通度（每点连几条边，第 0 层通常放宽到 2M）；**efConstruction** 决定建图时的搜索宽度（图质量）；**efSearch / ef** 决定查询时的搜索宽度（召回 ↔ QPS 的直接旋钮）。

## 三、三个参数：把默认值和调法落到具体引擎

| 参数 | 含义 | pgvector 0.8.x | Qdrant | Milvus（HNSW 家族） |
| --- | --- | --- | --- | --- |
| 每点边数 | 图连通度、内存占用 | `m`，默认 **16** | `hnsw_config.m`，默认 **16** | `M`（建索引时给） |
| 建图候选宽度 | 索引质量与建索引耗时 | `ef_construction`，默认 **64** | `hnsw_config.ef_construct`，默认 **100**（下限 4） | `efConstruction` |
| 查询候选宽度 | 召回 ↔ QPS | `hnsw.ef_search`，默认 **40** | 查询时 `params.quantization` 之前的 `exact`/`ef` | `ef`（搜索时给） |

pgvector 文档的表述最朴素也最有用："`ef_construction` 越大召回越好，代价是索引构建时间与插入速度"；`m` 越大越准越吃内存。**索引不是越大越好**：pgvector 明确单列索引上限——`vector` 类型 2000 维以内才能建索引，超过就要用 `halfvec`（可索引到 4000 维）或表达式索引，这是很多人第一次上 3072 维 embedding 就报错的原因。

Qdrant 源码里对参数的注释同样直白（`lib/segment/src/types.rs`）："`m`：图中每点的边数，值越大搜索越准、占空间越多"；"`ef_construct`：建索引时考虑的邻居数，越大越准、建索引越慢"；"`full_scan_threshold`：当条件命中的向量体量小于该阈值（KB）时，查询规划器**放弃 HNSW 改用全量扫描**（1 KB ≈ 一条 256 维向量）"。最后这句很重要：**小集合与高选择性过滤下，"索引"会被自动跳过**——不是 bug，是图索引在这种场景下本来就打不过暴力扫。

## 四、过滤检索：ANN 最容易被忽略的难题

向量检索几乎从不孤立发生："只在这个租户 / 最近 30 天 / 状态为已发布的文档里找相似"。麻烦在于 ANN 图是**为整体拓扑优化**的，加了谓词后走图可能一直撞到被过滤掉的点，导致召回崩塌。

pgvector 文档给了一组极具体的数字：**近似索引的过滤是在索引扫描之后应用的（"filtering is applied *after* the index is scanned"）。若条件只匹配 10% 的行，HNSW 在默认 `ef_search=40` 下平均只有 4 行命中。** 解法是 0.8.0 起的 **iterative index scans**：结果不够就自动继续扫索引（受 `hnsw.max_scan_tuples` 限制）。

工程上的四条应对（按优先级）：

1. **提高 `ef_search`**：最省事，直接抬召回，QPS 线性下降；
2. **开迭代索引扫描**（pgvector）/ 精确搜索开关（Qdrant `exact`）；
3. **把强过滤维度变成"物理隔离"**：Qdrant 的 payload index 与分片/分区、Milvus 的 partition key，让检索只在小子集里做——这是"filter-first"的正解；
4. **过滤极强时直接退回全量扫描**（Qdrant 的 `full_scan_threshold` 自动做这件事；pgvector 则让规划器按选择率选顺序扫描）。

## 五、评价一次检索：四个轴，不是"谁最快"

ann-benchmarks（`ann-benchmarks.com`，代码在 `github.com/erikbern/ann-benchmarks`）是这件事的中立参照系。它的方法学要点比结果更值得记：

- 结果**按数据集 × 距离度量分图**（当前批次含 `sift-128-euclidean`、`gist-960-euclidean`、`glove-100-angular`、`word2bits-800-hamming`、`kosarak-jaccard` 等；README 的数据集表逐条给出维度、训练/查询规模与 k，SIFT 与 NYTIMES 这类主力集是 k=100），横轴 Recall（平均找到的真最近邻比例）、纵轴 QPS（每秒查询数），点图上再给出索引大小与建索引时间；
- 它测的是**算法实现**（`hnswlib`、`pgvector`、`qdrant`、`Milvus(Knowhere)`、`faiss-ivf`、`scann`、`redisearch`、`weaviate`、`luceneknn` …），因此数字反映"默认参数 + 单查询"，不是你集群上的数字；
- 曲线**互相交叉**：同一数据集上，高召回区间的领先者往往不是低召回区间的领先者。所以"哪个向量库最快"这个问题本身不成立，成立的问法是"**在我要求的召回水平上，谁在我的数据上满足延迟且总成本最低**"。
- 时效说明：这批结果的时间戳是 **2025-04**（AWS r6i.16xlarge、`--parallelism 31`、关闭超线程、单核查询），且仓库 README 已声明**不再积极维护**、建议把新实现提交给更新的基准项目（如 VIBE），十亿级场景另有 big-ann-benchmarks。把它当**方法学与曲线形状**用，别把它当今天的排行榜。

由此得到一条通用调参经验：先定**召回目标**（RAG 场景常 0.90–0.95 起步，再靠重排补精度），再在曲线上找满足该召回的最快工作点。

## 六、向量之外：为什么还需要一个"数据库"

把 ANN 库当全部，会在第二周撞上这些需求（Milvus 的能力清单可以当作一张 checklist，而不是广告）：

- **CRUD 与更新语义**：embedding 会变（换模型 = 全量重算），删除要能真正回收空间（图索引的墓碑节点会拖慢检索，需要重建/压缩策略）；
- **过滤检索**（上一节）、**范围检索**（半径 r 内全部点）、**多向量字段与混合检索**（稠密 + 稀疏一路，融合排序）、**全文检索/BM25**、**重排序**（Cross-Encoder / LLM 打分）；
- **一致性与持久性**：写前日志（WAL）、副本、备份恢复；
- **多租户隔离**：collection / partition / payload 隔离三档强度，成本差别很大；
- **模式与标量类型**：JSON、数组、地理坐标——决定你能不能在检索处直接完成业务过滤。

这些正是"专用向量数据库"与"一个 ANN 索引 + 一个关系库"的分水岭，本站两篇实战篇分别演示：《Chroma 与 Qdrant 单库实战》《Milvus 与 pgvector 实战》；而"要不要复用已有 PostgreSQL"的完整判断在《向量库选型：用基准测试代替宣传页》。

## 七、常见坑

1. **拿 Recall=1.0 验收**。图索引不保证找到真最近邻；要精确结果请用 flat/精确检索档位，并重新算延迟预算。
2. **只调 `ef_search` 不调 `ef_construction`**。图本身建得差时，查询侧再宽的候选列表也捞不回来，只是白烧 CPU。
3. **忘了距离与归一化的对应关系**。同一批向量：未归一化时用余弦，归一化后余弦与内积单调等价；混用会让"看起来更近"的结果反序。
4. **维度直接超索引上限**（pgvector：`vector` 2000 维、`halfvec` 4000 维可建索引），报"column cannot be indexed"时先查这里。
5. **强过滤下召回莫名下降**。按第四节的顺序排查，而不是先加内存。
6. **用别人的基准数字做决策**。数据集、维度、k、并发数、机器全不一样；ann-benchmarks 的价值是方法学，最终数字要自己测（复现脚本见选型篇）。

## 八、小结

- 向量检索的可行性来自"近似"：`N × n` 的精确代价 → 图上跳若干步的量级；
- HNSW = 分层 NSW + 指数层高远抽 + 从上层下降（对数复杂度）+ 邻居选择启发式（高召回与聚簇数据的关键）；
- 三个旋钮 `M` / `efConstruction` / `efSearch` 分别管连通度、建图质量、查询召回，pgvector 默认 16/64/40、Qdrant 默认 16/100；
- 过滤检索是 ANN 的结构性难题：要么加宽候选、要么让过滤先缩小搜索空间、要么退回全量扫描；
- 评价看四个轴（Recall / QPS / 内存 / 建索引时间），"最快的库"不存在，交叉的曲线才是常态。

---

> **来源**：抓取于 2026-09-19。核心一手资料为论文 [Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs](https://arxiv.org/abs/1603.09320)（Yury A. Malkov、Dmitry A. Yashunin，arXiv 预印本，v4 提交于 2018-01-23；按预印本学习翻译并署名，引用以 arXiv 条目为准），本文对分层结构、层高随机抽取、上层起搜与邻居选择启发式四处的中文表述均为该摘要原文的翻译。基准方法学与数据集/实现清单来自 [ann-benchmarks](https://ann-benchmarks.com/)（代码 [erikbern/ann-benchmarks](https://github.com/erikbern/ann-benchmarks)，MIT）；参数默认值与"过滤在索引扫描之后应用""10% 匹配率下 `ef_search=40` 平均只命中 4 行""iterative index scans""维度上限"等结论来自 [pgvector README](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md)（PostgreSQL Licence，Andrew Kane）；`m`/`ef_construct`/`full_scan_threshold` 的含义与默认值来自 [Qdrant 源码 `lib/segment/src/types.rs`](https://raw.githubusercontent.com/qdrant/qdrant/master/lib/segment/src/types.rs)（Apache-2.0）；检索类型清单（ANN/过滤/范围/混合/全文/重排/Fetch/Query）取自 [Milvus 文档概览](https://milvus.io/docs/overview.md)（Apache-2.0，Zilliz / LF AI & Data）。本文不采用任何厂商互评结论，性能相关表述均以论文与公开基准为准。
