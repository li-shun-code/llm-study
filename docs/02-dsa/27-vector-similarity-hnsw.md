---
title: 向量相似度与 HNSW 近邻图
source_url: https://arxiv.org/abs/1603.09320
author: 本站整理；参考 Malkov & Yashunin (2016/2020)、hnswlib 仓库、NumPy 文档
license: Apache-2.0（hnswlib）；arXiv 预印本按原论文引用（CC BY 4.0 版本以论文页为准）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12，numpy 2.x，hnswlib 0.8
order: 27
group: 图
---
> **难度**：★★★。RAG 检索质量的天花板由这一篇决定；概念比代码更重要。
> **定位**：《图》讲一般的图与遍历，《Top-K 与堆》讲怎么从候选里挑最好的 k 个；本篇把两者合成一件工具——**在几十万条向量里毫秒级取回最相近的 100 条** 。
> **前置**：《图的遍历（DFS/BFS）》《堆》。嵌入模型本身的选型不在此篇范围。

## 为什么需要近似最近邻

一条文本嵌入成 1536 维单位向量后，“语义相近”就是“向量距离近”。检索于是变成几何问题：**给定查询向量 q ，在库中 n 条向量里找出与 q 最近的 k 条**（k-NN）。

精确解的代价是 O(n · d) ：每条向量都要算一次距离。n = 10 万、d = 1024 时，一次查询要做一亿次乘加——单条查询几十毫秒尚可，高并发或亿级库就完全不可接受。而且向量维数升高后，KD 树、-ball 树这类“空间划分”结构会因**维数灾难**退化到接近线性扫描，不再有优势。

近似最近邻（Approximate Nearest Neighbor, ANN）换一个目标：**允许偶尔漏掉个别真近邻，换取查询快一到两个数量级**，用 recall@k 来衡量“漏了多少”。主流路线有四类：

| 路线 | 代表 | 思路 | 特点 |
| ---- | ---- | ---- | ---- |
| 图索引 | **HNSW**、NSG、DiskANN | 建一张“跳一跳就到”的近邻图，贪心搜索 | 召回高、查询快；内存与建索引成本较高 |
| 倒排聚类 | IVF、IVF-PQ | 先聚类，再只搜最近的几个簇 | 内存友好，可与量化组合 |
| 量化 | PQ、OPQ、SQ8 | 压缩向量，用查表近似算距离 | 极致省内存，精度损失可控 |
| 哈希 | LSH | 随机投影使相近向量落入同桶 | 理论漂亮，工程上精度常不敌前两路 |

生产上最常见的是 **HNSW** （或其与量化组合，如 `IVF-PQ + HNSW 粗量化器`），Milvus、Qdrant、Weaviate、pgvector 都实现了它。

## 先把“相似度”定义清楚

不同嵌入模型的训练目标不同，**该用哪个距离由模型决定，不能猜**。

| 度量 | 公式 | 方向 | 适用 |
| ---- | ---- | ---- | ---- |
| 内积 IP | `dot(a, b) = Σ aᵢbᵢ` | 越大越相似 | 明确说明用 IP 的模型 |
| 余弦 | `dot(a,b) / (‖a‖·‖b‖)` | 越大越相似 | 最常用；归一化后与内积等价 |
| L2 距离 | `sqrt(Σ(aᵢ-bᵢ)²)` | 越小越相似 | 归一化向量下与余弦单调等价 |
| L2 平方 | 不开根 | 越小越相似 | 只比较大小，省一次开方 |

关键事实：**向量全部 L2 归一化之后，`‖a-b‖² = 2 - 2·dot(a,b)` ，于是三种度量的排序完全一致** 。因此标准做法是“入库与查询都用归一化向量 + 内积”，最省事也最不容易出错。

```python
import math


def normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


print(round(cosine([1.0, 2.0], [2.0, 4.0]), 6))   # 1.0，方向相同即完全相似
print(round(cosine([1.0, 0.0], [0.0, 1.0]), 6))   # 0.0，正交
```

## 基线：numpy 暴力检索

任何 ANN 索引都该先和它比。**在十万条以内、并发不高时，暴力检索常常已经够用**，别过早优化。

```python
import numpy as np


def brute_force(query: np.ndarray, corpus: np.ndarray, k: int = 10) -> np.ndarray:
    """corpus 形状 (n, d) ，已按行 L2 归一化。返回最近 k 条的下标（按距离升序）"""
    scores = corpus @ query                     # (n,) 内积即余弦
    # argpartition 平均 O(n) 把前 k 个“堆”到左边，但不保证内部有序
    idx = np.argpartition(-scores, kth=k - 1)[:k]
    return idx[np.argsort(-scores[idx])]        # 只对这 k 个排序，O(k log k)


corpus = np.random.default_rng(0).normal(size=(50_000, 256)).astype("float32")
corpus /= np.linalg.norm(corpus, axis=1, keepdims=True)
q = np.random.default_rng(1).normal(size=256).astype("float32")
q /= np.linalg.norm(q)
print(brute_force(q, corpus, k=5))
```

`np.argpartition` 就是《Top-K 与堆》里“快速选择”的向量化版本：整体 O(n) 而非 O(n log n) ，并且只返回“前 k 个、内部无序”，所以要再排一次。numpy 2.x 也提供了 `np.partition` 系列，语义相同。

## HNSW 的思想：可导航的小世界图

HNSW 要解决的问题很朴素：**图上贪心走最短路的“局部最优”陷阱**。普通近邻图（NSW）里从任意点出发、每步跳到当前更近的邻居，很容易卡在与查询无关的局部低谷。论文的解法是把图做成**多层**：

1. **层级结构**：每个元素被分配一个最大层级，服从几何分布（概率 p 的幂），因此第 0 层有全部 n 个元素，往上指数级变少。
2. **搜索从顶层开始**：在高层用大步长“宏观定位”到查询附近，再逐层下降，在底层做精细搜索。这正是**跳表（skip list）在高维空间的推广**。
3. **层内用贪心 + 候选堆**：不是“一步跳最近”，而是维护一个大小为 `ef` 的动态候选集（best-first），从候选里不断扩展邻居，直到没有更优的候选可展。
4. **连边用邻居选择启发式**：每个节点只连 M 条边，且优先保留“不同方向”的边（论文 4 节 Algorithm 4），使图兼具可达性（ragged 多路径）与导航性。

搜索过程用两个堆表达，正好是《堆》的直接应用：

```python
import heapq


def greedy_search(entry, graph: dict[int, list[int]], query, dist, ef: int):
    """单层 best-first 搜索，返回最近的至多 ef 个候选，按 (距离, 节点) 升序

    graph[level] 的 value 是邻居下标表；dist(a, b) 越小越近
    """
    d0 = dist(query, entry)
    visited = {entry}
    candidates: list[tuple[float, int]] = [(d0, entry)]   # 小顶堆：待扩展，取最小
    results: list[tuple[float, int]] = [(-d0, entry)]     # 大顶堆（取负）：最近的 ef 个，堆顶最远
    while candidates:
        d, node = heapq.heappop(candidates)
        if d > -results[0][0]:       # 候选比结果集中最远的还远 -> 停止
            break
        for nb in graph[node]:
            if nb in visited:
                continue
            visited.add(nb)
            dn = dist(query, nb)
            if len(results) < ef or dn < -results[0][0]:
                heapq.heappush(candidates, (dn, nb))
                heapq.heappush(results, (-dn, nb))
                if len(results) > ef:
                    heapq.heappop(results)   # 挤掉最远的那个
    return sorted(results, reverse=True)


if __name__ == "__main__":
    # 一条 6 个点的路径图：0-1-2-3-4-5 ，坐标即下标
    graph = {i: [j for j in (i - 1, i + 1) if 0 <= j < 6] for i in range(6)}
    dist = lambda q, x: abs(q - x)
    print([(d, n) for d, n in greedy_search(0, graph, 4.5, dist, ef=3)])
    # 从 0 出发也能走到 4、5 ：[(-0.5, 5), (-0.5, 4), (-1.5, 3)] 取负后即真实距离

一个可跑的“迷你多层图”演示，把上面两个堆和分层联系起来（**教学用，不追求工业级召回**；生产请用下文 hnswlib 或向量库）：

```python
import heapq
import random


class MiniHNSW:
    """极简单层 NSW + 随机长程边：演示“图检索”而不是完整 HNSW"""

    def __init__(self, dim: int, m: int = 8, seed: int = 0):
        self.dim = dim
        self.m = m
        self.vectors: list[list[float]] = []
        self.graph: dict[int, list[int]] = {}
        self.rng = random.Random(seed)

    def add(self, v: list[float]) -> None:
        i = len(self.vectors)
        self.vectors.append(v)
        if i == 0:
            self.graph[i] = []
            return
        # 用图检索找到候选，再挑 m 个最近的连边（双向）
        cand = self.search(v, k=self.m * 2)
        self.graph[i] = [idx for _, idx in cand[: self.m]]
        for nb in self.graph[i]:
            self.graph[nb].append(i)
            if len(self.graph[nb]) > self.m * 2:      # 度数上限，防图过密
                self.graph[nb] = self.graph[nb][: self.m]
        # 随机长程边：让图“可导航”，模拟小世界特性
        self.graph[i].append(self.rng.randrange(len(self.vectors) - 1))

    def search(self, q: list[float], k: int = 10, ef: int = 40) -> list[tuple[float, int]]:
        def dist(a, b):                               # 平方欧氏距离
            return sum((x - y) ** 2 for x, y in zip(a, b))

        entry = self.rng.randrange(len(self.vectors))  # 真实 HNSW 从顶层入口下降
            return self._best_first(entry, q, dist, max(ef, k))[:k]

    def _best_first(self, entry, q, dist, ef):
        """best-first 图搜索（与上一小节同一算法，此处内联以便独立运行）"""
        candidates = [(dist(q, entry), entry)]        # 小顶堆：待扩展
        results = [(-dist(q, entry), entry)]          # 大顶堆：最近 ef 个
        visited = {entry}
        while candidates:
            d, node = heapq.heappop(candidates)
            if d > -results[0][0]:
                break
            for nb in self.graph.get(node, []):
                if nb in visited:
                    continue
                visited.add(nb)
                dn = dist(q, nb)
                if len(results) < ef or dn < -results[0][0]:
                    heapq.heappush(candidates, (dn, nb))
                    heapq.heappush(results, (-dn, nb))
                    if len(results) > ef:
                        heapq.heappop(results)
        return [(-nd, i) for nd, i in sorted(results, reverse=True)]


random.seed(7)
idx = MiniHNSW(dim=16)
data = [[random.gauss(0, 1) for _ in range(16)] for _ in range(2000)]
for v in data:
    idx.add(v)
q = data[42]
hits = idx.search(q, k=5)
print("返回下标:", [i for _, i in hits])   # 一定包含 42，且多为几何近邻
print("自身距离:", round(hits[0][0], 4))   # 0.0
```

## 生产用法：hnswlib

安装：`pip install hnswlib`（Apache-2.0，纯 C++ 扩展，无 Python 侧依赖）。

```python
import hnswlib
import numpy as np

dim, n = 64, 20_000
data = np.random.default_rng(0).normal(size=(n, dim)).astype("float32")
data /= np.linalg.norm(data, axis=1, keepdims=True)

# space 可选 "cosine" / "l2" / "ip"
index = hnswlib.Index(space="cosine", dim=dim)
index.init_index(max_elements=n * 2, ef_construction=200, M=16)
index.add_items(data, ids=np.arange(n))
index.set_ef(80)                    # 查询期可调，ef >= k

labels, distances = index.knn_query(data[:3], k=5)
print(labels[0][:3], distances[0][:3])
# 第 0 条查询的最近邻是它自己，cosine 距离 = 1 - 余弦，故为 0.0

# 持久化
index.save_index("hnsw.bin")
other = hnswlib.Index(space="cosine", dim=dim)
other.load_index("hnsw.bin")
print(other.knn_query(data[:1], k=1)[0])

# 增量扩容：max_elements 不够时显式 resize
index.resize_index(n * 4)
```

三个参数的实际含义：

| 参数 | 作用 | 调大的代价 | 经验值 |
| ---- | ---- | ---------- | ------ |
| `M` | 每层最大出边数（图中第 0 层可达 2M） | 内存、建索引时间近似线性上升 | 16~48；高维或高质量需求取大 |
| `ef_construction` | 建索引时候选队列长度 | 建索引时间线性上升 | 200~500 |
| `ef`（查询期） | 查询时候选队列长度 | 查询延迟线性上升，召回上升后饱和 | 取 `max(k, 64)` 起步，压 recall 时优先调它 |

## 怎么评估：recall@k 与 QPS

**不测召回率的 ANN 都是玄学**。做法是拿暴力检索的结果当 ground truth：

```python
import time


def evaluate(index, queries: np.ndarray, corpus: np.ndarray, k: int = 10) -> dict:
    truth = np.argsort(-(corpus @ queries.T), axis=0)[:k]        # (k, q) 精确前 k
    t0 = time.perf_counter()
    labels, _ = index.knn_query(queries, k=k)                    # (q, k)
    latency_ms = (time.perf_counter() - t0) * 1000 / len(queries)
    hits = sum(len(set(labels[i]) & set(truth[:, i])) for i in range(len(queries)))
    return {
        "recall@k": hits / (k * len(queries)),
        "avg_latency_ms": latency_ms,          # 单条查询平均耗时
        "qps": 1000.0 / latency_ms,            # 单线程吞吐
    }
```

看三个数字：**recall@k（≥0.95 通常可接受）、延迟、内存**。内存的粗估公式是 `n × (4d + M × 8)` 字节左右（向量本身 + 边表），百万条 768 维、M=16 时约 3~4 GB ，这时要考虑量化（PQ/SQ8）或换 `DiskANN` 类磁盘索引。

## 与检索管线的接合

- **前置过滤**：先按 `user_id`、时间、权限过滤再检索。HNSW 的图搜索对过滤不友好（被过滤的点仍在图上，只是不可作结果），大规模强过滤会显著掉召回；向量库通常用“过滤位图 + 允许穿越”实现，必要时改用“先过滤、后在小集合上暴力”的两段式。
- **混合检索**：HNSW 出向量近邻、BM25 出关键词命中，再用 RRF 融合——融合与取前 N 的代码见《Top-K 与堆：召回重排里的取前 N 个》。
- **精排**：ANN 的“近”不等于“有用”，Top-100 常交给 cross-encoder 重排到 Top-10 。
- **入库去重**：向量高度重复会让 HNSW 图退化，先去重（可用并查集归并近重复，见《并查集与等价类归并》）再建索引。
- **数据库侧**：pgvector 的 `hnsw` 索引（`ivfflat` 是另一条路线）把上面的能力放进了 SQL ，选型对比见模块《向量数据库》。

## 常见坑

1. **度量与模型不匹配**：模型要求用余弦却按 L2 建库（或反之）。归一化 + 内积是安全默认值。
2. **归一化只做了一半**：入库归一化、查询忘了，或 `cosine` 空间下又自己除模长。hnswlib 的 `cosine` 距离是 `1 - 余弦` ，**越小越相似**，把它的返回值当“分数”降序排会得到完全相反的结果。
3. **`ef < k`** ：ef 是候选队列长度，必须不小于 k ，否则召回断崖式下跌（部分实现会直接报错）。
4. **只调参数不测召回**：没有 ground truth 的调参等于瞎调。
5. **删除的代价**：hnswlib 提供 `mark_deleted` 但只是打墓碑，被删点仍占图与内存；大量删除后要重建索引。
6. **建索引比查询更贵**：百万级向量的 HNSW 建索引可能几十分钟起，且多线程下内存峰值高；批量重建要规划好，增量在线建则注意 `max_elements` 与 `resize_index` 。
7. **维度爆炸下的“距离集中”**：d 上千时任意两点的距离都差不多，此时应该先降维（PCA/MRL 截断）或改用语义更明确的重排模型，而不是一味加大 ef 。
8. **把图索引当精确索引**：ANN 天生可能漏，业务上“必须找到全部命中”的场景（如合规检索）要用暴力或精确索引兜底。
9. **多线程设置**：`set_num_threads()` 在建索引阶段影响巨大；`add_items` 的并发写入需要自己加锁，多线程主要用来加速查询。

## 延伸阅读

- Yu. A. Malkov 与 D. A. Yashunin，《Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs》（arXiv:1603.09320 ，IEEE TPAMI 2020）：HNSW 一手论文，第 4 节的邻居选择启发式是理解“为什么图能导航”的关键。
- hnswlib 仓库 README（Apache-2.0）：参数与 Python 接口的一手说明。
- ann-benchmarks.com：中立 ANN 算法横评，看 recall/延迟/内存曲线再选型。
- 《图的遍历（DFS/BFS）》《堆》：HNSW 搜索的两个组成部分。
- 《Trie 前缀树（字典树）》：稀疏高维数据（词表、ID）的另一种“前缀式”索引。

---

> **来源**：抓取于 2026-09-19。HNSW 的分层结构、邻居选择启发式与 `M` / `efConstruction` / `ef` 语义依据 [arXiv:1603.09320](https://arxiv.org/abs/1603.09320)（Malkov & Yashunin，2016；期刊版 IEEE TPAMI 2020）与 [hnswlib 仓库](https://github.com/nmslib/hnswlib)（Apache-2.0，已核对 LICENSE ）；`argpartition` 语义依据 NumPy 官方文档（BSD-3-Clause）。文中全部 Python 代码为本站编写，`MiniHNSW` 与距离函数在 Python 3.12 + 标准库下运行验证，hnswlib 与 numpy 片段需 `pip install hnswlib numpy` 后运行。
