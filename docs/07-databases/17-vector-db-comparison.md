---
title: 向量库选型：用基准测试代替宣传页
source_url: https://ann-benchmarks.com/
author: Erik Bernhardsson、Martin Aumüller、Alexander Faithfull（ann-benchmarks）；pgvector、Qdrant、Milvus、Chroma 官方文档
license: MIT（erikbern/ann-benchmarks）；Apache-2.0（Milvus / Qdrant / Chroma 文档与源码）；PostgreSQL Licence（pgvector）；arXiv 论文按预印本署名引用。本页不采用任何厂商互评材料
fetched_at: 2026-09-19
translated: true
versions: ann-benchmarks 结果批次为 2025-04（r6i.16xlarge、--parallelism 31、关闭超线程、单核查询）；pgvector 0.8.x；Qdrant（HNSW m=16 / ef_construct=100 / full_scan_threshold=10000 KB）；Milvus Lite（仅 FLAT 索引）；Chroma 单节点 HNSW / 分布式 SPANN
order: 17
group: 向量数据库
---
向量库选型是本站四篇里最容易写坏的一篇：手上只要有"厂商 A 对比厂商 B 的功能勾选表"和"某张别人跑过的 QPS 柱状图"，就能很顺地拼出一篇文章——但那张勾选表是竞品相互拆台的产物，那张柱状图跟你没有任何关系。本篇换一路做法：**先讲清公开基准到底测了什么、没测什么，再给一套自己跑的复现步骤，最后落到"数据规模 / 过滤需求 / 运维成本"三个维度上的可执行结论。** 索引本身的原理与参数在《向量数据库原理：从 HNSW 论文与公开基准说起》，四套系统的具体写法在两篇实战里。

## 一、为什么不能拿宣传页和互评表选型

三份一手材料各自暴露了一个失效原因：

1. **曲线是交叉的。** ann-benchmarks 的结果不是排行榜而是一堆 Recall–QPS 散点图：同一个数据集上，高召回区间的领先者往往不是低召回区间的领先者。任何"X 比 Y 快"的单值结论，都必然隐含了"在某个召回点上、某台机器、某个数据集、某个 k"这四个前提——厂商对比表通常不会写这四个前提。
2. **默认参数不等于你的负载。** 公开基准测的是**实现 + 默认参数 + 单查询**：ann-benchmarks 的方法学条款明确写了"默认单查询、实验期间只压满一个 CPU（不开多线程）、避免建索引超过几小时、数据集要装得进内存"。也就是说它既没有并发、也没有过滤条件、更不是十亿级——这三件事恰恰是生产向量检索的主要成本来源（十亿级另有 big-ann-benchmarks 这条线）。
3. **各家砍掉的东西不一样，而且砍在文档表格里。** 这一条最实用，因为它意味着"功能勾选表"必须换成"限制清单"：pgvector 的 `vector` 列超过 2000 维不能建索引（要用 `halfvec` 到 4000 维）、近似索引的过滤是**在索引扫描之后**才应用的；Milvus Lite 的 `create_index()` **只支持 FLAT 索引**、一致性恒为 Strong、没有 partition/alias/users；Chroma 单节点是 HNSW、分布式与 Cloud 换成 SPANN 且**参数不可配置**；Qdrant 在命中集小于 `full_scan_threshold`（默认 10,000 KB，按 1 KB ≈ 一条 256 维向量折算）时会**放弃 HNSW 改走全量扫描**。这些都不是"支持/不支持"两个字能装下的。

顺带一条时效事实：`ann-benchmarks.com` 的图表停留在 **2025-04** 那一批（AWS r6i.16xlarge、`--parallelism 31`、关闭超线程），仓库 README 也已声明**不再积极维护**，并建议把工作提交给更新的基准项目（如 [VIBE](https://github.com/vector-index-bench/vibe)）。它的价值是**方法学与可复现协议**（设计原则见 Aumüller / Bernhardsson / Faithfull 的 [arXiv:1807.05614](https://arxiv.org/abs/1807.05614)，Information Systems 2019），不是那几张图里的名次。

## 二、公开基准怎么读：以 SIFT / NYTIMES 为例

读图先读数据集表。ann-benchmarks 给每个数据集标了五列（维度、训练点数、查询点数、k、度量），例如：

| 数据集 | 维度 | 训练向量 | 查询 | k | 度量 |
| --- | --- | --- | --- | --- | --- |
| SIFT | 128 | 1,000,000 | 10,000 | 100 | Euclidean |
| NYTIMES | 256 | 290,000 | 10,000 | 100 | Angular |

两个可直接迁移的判断：**维度只有 128/256、规模百万级**——和 768/1024/1536 维、几千万条的现代 embedding 场景差着一截；**k=100** 比常见 RAG 的 `top-k=5~20` 宽松得多，取更少结果时召回曲线形状会变。所以拿它的绝对数字做决策是错的，拿它的**参数—召回—延迟形状**做直觉校准是对的：HNSW 类实现在高召回段通常仍保持较高 QPS，而聚类类（IVF 家族）需要把 probes 拉高才追得上，代价是延迟上升更快。

## 三、自己跑：从复现到自测

### 1. 复现公开基准（要 Docker）

官方仓库的步骤就是三条命令，前提是 Python（README 注明测的是 3.10.6）与 Docker：

```bash
git clone https://github.com/erikbern/ann-benchmarks && cd ann-benchmarks
pip install -r requirements.txt
python install.py                    # 在 Docker 容器里编译各实现，10-30 分钟起
python run.py --dataset glove-100-angular   # 指定数据集；全量跑可能要好几天
python plot.py --dataset glove-100-angular --x-scale logit --y-scale log
python create_website.py --plottype recall/time --scatter --outputdir website/
```

想改算法参数，编辑 `ann_benchmarks/algorithms/{实现}/config.yml`；想加自己的库，在 `ann_benchmarks/algorithms/` 下放 `module.py` + `Dockerfile` + `config.yml` 并挂进 CI。

### 2. 自测：用自己的向量，别用随机数

真实决策只需要三样东西：**你的向量、你的查询、你的过滤谓词**。下面这段最小评测把 Recall@10 对暴力检索取真值，扫一遍 `ef` 旋钮，输出"召回—延迟—建索引时间"三元组，可直接换 `hnswlib` 之外的实现：

```python
"""召回-延迟自测：同一份向量上比较暴力检索与 ANN 的真实召回。

注意：`data` / `queries` 这里是随机向量，只用来把骨架跑通；
正式测一定要换成你自己的 embedding 与真实查询分布（见下文"一定用真实向量"）。
"""
import time
import numpy as np
import hnswlib  # pip install hnswlib numpy

N, DIM, K = 200_000, 1024, 10
rng = np.random.default_rng(0)
data = rng.random((N, DIM), dtype=np.float32)
data /= np.linalg.norm(data, axis=1, keepdims=True)   # 归一化后与内积/余弦一致
queries = data[rng.choice(N, size=200, replace=False)]

# 真值：暴力检索（慢，但它是唯一可信的召回基准）；向量已归一化，余弦相似度即点积
t0 = time.perf_counter()
sims = queries @ data.T
truth = np.argsort(-sims, axis=1)[:, :K]
brute_s = (time.perf_counter() - t0) / len(queries)

for m, ef_c in [(16, 100), (32, 200)]:                # 连通度 × 建图宽度
    index = hnswlib.Index(space="cosine", dim=DIM)
    index.init_index(max_elements=N, ef_construction=ef_c, M=m)
    t0 = time.perf_counter()
    index.add_items(data, np.arange(N))
    build_s = time.perf_counter() - t0
    index.set_ef(100)                                  # 查询宽度：召回↔延迟的主旋钮
    preds = index.knn_query(queries, k=K)[1]
    recall = np.mean([len(set(a) & set(b)) / K for a, b in zip(truth, preds)])
    t0 = time.perf_counter()
    index.knn_query(queries, k=K)
    qps = len(queries) / (time.perf_counter() - t0)
    print(f"M={m:<3} efC={ef_c:<4} recall@{K}={recall:.3f} QPS={qps:>9.0f} "
          f"建索引={build_s:>6.1f}s 原始向量≈{data.nbytes / 1e6:.0f}MB "
          f"(暴力检索单查询 {brute_s * 1e3:.1f}ms)")
```

三点使用注意：

- **一定用真实向量**（哪怕是同一模型跑出来的公开语料）。用 `np.random` 造出来的向量没有聚簇结构，HNSW 论文里那条"邻居选择启发式在高召回与**高聚簇数据**上收益明显"正是说真实 embedding 的情形——合成数据会系统性高估所有实现。
- **`brute_s` 那一行就是"要不要用 ANN"的答案**：如果暴力扫你的数据已经能满足延迟预算，索引只是徒增运维与召回不确定性。
- **把过滤谓词加进第二轮测试**：只测纯向量检索的召回，等于没测。带 `WHERE` 的召回塌方在原理篇用 pgvector 的"10% 匹配率下默认 `ef_search=40` 平均只命中 4 行"讲过成因。

## 四、决策树：三个维度给出可执行结论

先按**数据规模**划，再看过滤，最后算运维账——顺序反了就会为一个千万级以下的库去运维一套分布式系统。

**表：按规模与需求给出默认选择**

| 你的情况 | 选什么 | 依据（可核查） |
| --- | --- | --- |
| < 10 万条、单机、还在做原型 | 暴力检索或 Chroma `PersistentClient` / Qdrant local mode / Milvus Lite | 十万条 1024 维一次暴力检索在 BLAS 并行下通常几十毫秒量级，百万条才到几百毫秒；这个规模下索引主要是"顺手"而不是必需 |
| 已有 PostgreSQL、向量 ≤ 数百万条、要和业务表同库同事务同备份 | **pgvector** | 默认就是精确检索（完美召回），要提速再上 HNSW；`vector` 2000 维可索引、`halfvec` 4000 维；带过滤时开 `hnsw.iterative_scan` 或提高 `ef_search` |
| 千万级、过滤条件多且选择性强（租户/时间/状态）、单机能装下 | **Qdrant**（Standalone） | 载荷过滤参与索引遍历 + payload index；命中集极小时自动退回全量扫描；Rust 单进程服务、`docker run` 起 |
| 亿级以上、要多向量字段 / 稀疏+稠密混合 / 分区多租户 / 横向扩容 | **Milvus**（Standalone 起步，K8s 集群化） | 分布式架构与 collection/partition/partition key 三级隔离；`search` 与 `query` 语义分离；Lite→Standalone→Distributed API 不变 |
| 需要多模态向量、云端全托管、不想自己运维 | 任一托管服务（Chroma Cloud / Qdrant Cloud / Zilliz Cloud / 各家向量托管实例） | 但要先确认**参数面是否对等**：Chroma 的 SPANN 不接受 HNSW 参数，这是本地调参经验失效的典型 |

**过滤需求单独判**：如果每次检索都要带一个把候选集砍到千分之几的谓词，那么"再快的 ANN 也没用"——正确顺序是①把强过滤维度做成物理隔离（Milvus partition key、Qdrant payload 隔离、pgvector 部分索引/分区表），②让索引在过滤后的小集合上工作，③实在不行就在这个小集合上暴力扫。指望换一个引擎解决过滤塌方，是这类选型里最常见的错判。

**运维成本算三笔账**：

1. **内存**：原始向量 `N × dim × 4` 字节（float32）是下界；HNSW 还要为每个点存邻居 id（pgvector/Qdrant 默认 `m=16`，第 0 层放宽），量化（PQ/SQ/二值化）就是拿召回换这块。1,000 万条 1024 维 float32 ≈ 41 GB——这个数量级决定了"能不能单机"，比任何 QPS 数字都先决。
2. **建索引时间**：pgvector 明确"图装不进 `maintenance_work_mem` 会显著变慢"，并建议先灌数据后建索引、调 `max_parallel_maintenance_workers`；IVFFlat 必须有数据后才能建（训练步骤）。
3. **人力**：多一套系统 = 多一份备份、监控、升级、权限与故障域。pgvector 的运维成本几乎为零（沿用现有 PG），Milvus 分布式的组件数最多；Qdrant/Chroma 居中。这笔账只有在**检索质量或延迟确实换到了东西**时才值得付。

## 五、概念对照：同一个东西的四种叫法

读文档最容易浪费时间的地方是名词。下表按各官方文档整理（含义以官方定义为准）：

| 本篇说法 | Chroma | Qdrant | Milvus | pgvector |
| --- | --- | --- | --- | --- |
| 向量容器 | collection | collection | collection | 表 + `vector` 列 |
| 一条记录 | id + document + metadata | point（vector + payload） | entity（主键 + 向量 + 标量字段） | 一行 |
| 业务过滤字段 | metadata / `where` | payload / `query_filter` | scalar field / `filter` 表达式 | 任意列 / SQL `WHERE` |
| 索引参数位置 | `configuration={"hnsw": …}` | `hnsw_config` | `index_params`（Lite 仅 FLAT） | `WITH (m=…, ef_construction=…)` + GUC |
| 数据隔离强度 | 多集合 | collection / payload 索引 | collection / partition / partition key | 表 / 分区表 / schema |
| 按条件取回（不走模型） | `collection.get` | `scroll` | `client.query` | `SELECT ... WHERE` |

## 六、常见坑

1. **拿别人的数字当自己的结论**：数据集、维度、k、并发、机器全不同；公开基准还不测过滤与并发。
2. **只看 QPS 不看分位延迟**：单查询平均值会掩盖尾部，而公开基准恰恰只报吞吐。线上要看 p95/p99 与超时预算，压测时必须带上真实并发。
3. **验收 Recall=1.0**：ANN 不提供该保证；要精确就用精确档（pgvector 默认、Milvus Lite 的 FLAT、Qdrant 的全量扫描路径），并重新做延迟预算。
4. **忘了 embedding 换代 = 全量重算**：模型一换，旧向量与新查询向量不在同一空间，索引必须重建。这件事在"能不能同库同事务"的维度上，pgvector 用起来代价最低（`UPDATE` 而已）。
5. **把 Lite / local mode 的数字当生产**：Milvus Lite 只有 FLAT 索引，Chroma 与 Qdrant 的内存模式是**协议兼容的替身**，不是性能对等的部署。
6. **过度信任功能勾选表**：厂商写"支持标量过滤"，实际可能是"索引后过滤"，召回塌方就发生在这一格对勾里。

## 七、小结

- 公开基准的正确用法是**方法学与曲线形状**，不是名次；`ann-benchmarks` 已停在 2025-04 批次并声明不再积极维护，十亿级看 big-ann-benchmarks、现代数据集看 VIBE。
- 选型三问按顺序问：**规模与内存装得下吗（决定能不能单机）→ 过滤有多强（决定索引能不能用上）→ 你愿意多运维一套系统吗（决定 pgvector 还是专用库）**。
- 结论可以很短：已有 PG 就先用 pgvector（必要时 `halfvec` + `iterative_scan`）；过滤密集的千万级选 Qdrant；亿级、混合检索、多租户选 Milvus；原型阶段 Chroma 最省；托管服务先核对参数面是否对等。
- 最后一定回到自己数据上测一轮：Recall@k、p99、建索引时间、内存占用四个数一起看。

**延伸阅读**：《向量数据库原理：从 HNSW 论文与公开基准说起》《Chroma 与 Qdrant 单库实战》《Milvus 与 pgvector 实战》《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》《Embedding 模型选型实战（中文优先）》。

---

> **来源**：本文基准方法学与"单查询/单核/k=100/数据集表/2025-04 批次/不再积极维护/VIBE 与 big-ann-benchmarks 指针/复现命令"均取自 [erikbern/ann-benchmarks README](https://raw.githubusercontent.com/erikbern/ann-benchmarks/main/README.md)（MIT，作者 Erik Bernhardsson，另有 Martin Aumüller、Alexander Faithfull 的重要贡献）与 [ann-benchmarks.com](https://ann-benchmarks.com/)；设计原则引自 [ANN-Benchmarks: A Benchmarking Tool for Approximate Nearest Neighbor Algorithms](https://arxiv.org/abs/1807.05614)（Aumüller、Bernhardsson、Faithfull，Information Systems 2019，DOI 10.1016/j.is.2019.02.006）；HNSW 的分层结构与邻居选择启发式引自 [arXiv:1603.09320](https://arxiv.org/abs/1603.09320)（Malkov & Yashunin）。各库限制与参数：[pgvector README](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md)（PostgreSQL Licence）之维度上限、HNSW/IVFFlat 参数、Index Build Time 与 Iterative Index Scans；[Qdrant 源码 `lib/segment/src/types.rs`](https://raw.githubusercontent.com/qdrant/qdrant/master/lib/segment/src/types.rs)（Apache-2.0）之 `m=16`、`DEFAULT_HNSW_EF_CONSTRUCT=100`、`DEFAULT_FULL_SCAN_THRESHOLD=10_000` 与稀疏向量对应常量；[Milvus Lite 文档](https://raw.githubusercontent.com/milvus-io/milvus-docs/v3.0.x/site/en/getstarted/milvus_lite.md)（Apache-2.0）之限制表；[Chroma Configure Collections](https://docs.trychroma.com/docs/collections/configure)（Apache-2.0）之 HNSW 与 SPANN 一节。抓取与核实于 2026-09-19。**本篇不使用厂商自写的竞品对比表**：原 `milvus.io/docs/comparison.md` 一类的"Milvus vs Pinecone"勾选表与成本排名立场偏向自家产品，本次改版已将其全部移除，仅保留可核实的各家官方限制与默认值；概念对照表与决策树为本站编者依据上述一手资料整理。
