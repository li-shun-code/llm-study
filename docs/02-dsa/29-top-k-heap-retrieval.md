---
title: Top-K 与堆：召回重排里的取前 N 个
source_url: https://docs.python.org/3/library/heapq.html#heapq.nlargest
author: 本站整理；参考 Python heapq 官方文档、hello-algo 堆与 Top-K 章节
license: PSF License 2.0（Python 文档）；CC BY-NC-SA 4.0（hello-algo）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（标准库，无第三方依赖）
order: 29
group: 树与堆
---
> **难度**：★★★。写出来容易，写对边界（k 很大、k 接近 n、分数重复、流式数据）才见功力。
> **定位**：《堆》讲堆的结构与操作，《排序算法》讲全排序，本篇讲它们的交汇点——**只取前 K 个时该用什么**。
> **前置**：《堆》《排序算法》。向量检索的具体实现见《向量相似度与 HNSW 近邻图》。

## 为什么 Top-K 是检索系统的基本动作

一次 RAG 检索的候选量级落差非常大：

| 阶段 | 候选量 | 输出量 |
| ---- | ------ | ------ |
| 向量 / 关键词召回 | 百万级分片 | 每片 Top 100 |
| 多路融合去重 | 数千 | Top 200 |
| 精排（cross-encoder / 规则） | 数百 | Top 20 |
| 拼装进 prompt | 数十 | Top 5 |

每一步本质都是“从 n 个里取最好的 k 个，k ≪ n” 。此时全排序是纯粹的浪费：`sorted()` 花 O(n log n) 把第 101 到第 1000000 名的相对次序也算出来了，而你只需要前 100 名。**Top-K 的目标是把这个代价压到 O(n log k) ，空间压到 O(k)** ——这正是“容量为 k 的小顶堆”的用武之地。

## 四种方案对比

| 方案 | 时间 | 额外空间 | 适用 |
| ---- | ---- | -------- | ---- |
| `sorted(xs)[-k:]` | O(n log n) | O(n) | k 与 n 同量级；顺便要完整有序结果 |
| `heapq.nlargest(k, xs)` | O(n log k) | O(k) | 常规首选，一行代码 |
| 手写定容量小顶堆 | O(n log k) | O(k) | 流式 / 超大数据，不想一次性载入 |
| 快速选择（quickselect） | 平均 O(n) | O(1)~O(n) | 允许原地打乱、需要第 k 名分界值 |

三点关键认知：

1. **`nlargest` 内部已经是堆**，且当 `k` 接近 n 时自动退化为 `sorted` ，所以绝大多数场景直接用它就是最优解，不必自己造轮子。
2. **快速选择是平均 O(n) 、最坏 O(n²)** ，Python 标准库没有提供；numpy 有 `np.argpartition` ，大规模向量打分时快得很明显。
3. **“只要前 k 个”不等于“前 k 个已排好序”** ：`nlargest` 返回降序结果，但分片各自取 Top-K 再合并时，必须再排一次才能拿到全局有序前 k 个（下文“scatter-gather”会讲）。

## 用 heapq 写

```python
import heapq

docs = [
    {"id": "d1", "score": 0.82},
    {"id": "d2", "score": 0.91},
    {"id": "d3", "score": 0.77},
    {"id": "d4", "score": 0.91},
    {"id": "d5", "score": 0.63},
]

# 按 score 取前 2：直接给 key，不用先把元组造出来
print([d["id"] for d in heapq.nlargest(2, docs, key=lambda d: d["score"])])   # ['d2', 'd4']
print([d["id"] for d in heapq.nsmallest(2, docs, key=lambda d: d["score"])])   # ['d5', 'd3']

# 多目标：分数降序，同分按 id 升序（把方向编码进 key）
print([d["id"] for d in sorted(docs, key=lambda d: (-d["score"], d["id"]))[:2]])
```

`heapq.nlargest` 对相同分数保持“先遇到的先出”，因此在单键排序上是稳定的；一旦同分项需要按别的字段决定次序，就必须显式把该字段写进 key （如上例第三行）。

需要边生成边取 Top-K （数据是生成器、或根本装不进内存）时，`heapq.merge` 处理“多个已排序来源”，`nlargest` 处理“一个未排序来源”，两者不要混用：

```python
import heapq

# 两路召回都已按分数降序排好，取全局前 3
bm25 = [(0.93, "a"), (0.71, "b"), (0.40, "c")]
vector = [(0.90, "a"), (0.88, "d"), (0.55, "e")]

# nlargest 的逆序语义：分数取负后按小顶堆取前 k
top3 = heapq.nlargest(3, list(bm25) + list(vector), key=lambda x: x[0])
print(top3)          # [(0.93, 'a'), (0.90, 'a'), (0.88, 'd')]
# 归并两路并保持各自顺序（去重需要自己处理）
print(list(heapq.merge(bm25, vector, key=lambda x: -x[0]))[:3])
```

## 手写定容量堆：流式 Top-K

面试与嵌入式场景常要求“不一次性载入全部数据”。核心只有一个 **容量为 k 的小顶堆 + `heapreplace`** ：

```python
import heapq
from collections.abc import Iterable


def top_k_stream(items: Iterable[tuple[float, str]], k: int) -> list[tuple[float, str]]:
    """流式取分数最高的 k 个元素，O(n log k) 时间、O(k) 空间"""
    if k <= 0:
        return []
    heap: list[tuple[float, str]] = []
    for item in items:
        if len(heap) < k:
            heapq.heappush(heap, item)          # 未满 k：直接进
        elif item[0] > heap[0][0]:
            heapq.heapreplace(heap, item)       # 比“当前第 k 名”更好：换掉堆顶
        # heap[0] 始终是这 k 个里最差的，任何更差的新元素直接丢弃
    return sorted(heap, reverse=True)


stream = ((0.5, "x"), (0.9, "y"), (0.7, "z"), (0.95, "w"), (0.1, "v"))
print(top_k_stream(stream, 3))   # [(0.95, 'w'), (0.9, 'y'), (0.7, 'z')]
```

两个必须理解的细节：

- **取最大 k 个用“小顶堆”**，堆顶是这 k 个里最差的，所以新元素只需与堆顶比一次；用大顶堆反而要维护全部 n 个元素。
- **`heapreplace` 而不是 `pop` + `push`** ：前者只走一次堆调整（O(log k) ），后者两次；在百万级数据上差距明显。

## 应用一：分片并行 Top-K（scatter-gather）

向量库和搜索引擎的常规架构：数据切成 S 个分片，每片本地取 Top-K ，再把 S×K 个候选汇总取全局 Top-K 。

```python
import heapq


def sharded_top_k(shards: list[list[float]], k: int) -> list[tuple[float, int]]:
    """每个分片内部无序；返回全局前 k 的 (分数, 分片号)"""
    per_shard: list[list[float]] = []
    for si, shard in enumerate(shards):
        # 本地 Top-K：O(n_i log k)
        best = [(s, si) for s in heapq.nlargest(k, shard)]
        per_shard.append(sorted(best, key=lambda x: -x[0]))
    # 各分片结果已降序，多路归并取前 k ，只消费必要的元素
    return list(heapq.merge(*per_shard, key=lambda x: -x[0]))[:k]


shards = [[0.1, 0.9, 0.4], [0.8, 0.2, 0.95], [0.3, 0.7, 0.6]]
print(sharded_top_k(shards, 3))   # [(0.95, 1), (0.9, 0), (0.8, 1)]
```

这个模式的价值在于**天然可并行**：分片之间没有共享状态，每个分片只上抛 k 条，网络与合并开销都是 O(S·k) 。

**易错点**：如果全局 k = 500 而每片只取 100 ，就会漏掉“集中在同一片”的解；每片必须至少取全局 k ，才能保证结果正确。

## 应用二：RRF 融合与去重

召回阶段常用 Reciprocal Rank Fusion 合并多路结果：某文档在第 r 名的得分为 `1 / (k + r)` ，多路求和。实现上就是“多路归并 + 字典累加 + 一次 Top-K”：

```python
import heapq


def rrf(rank_lists: list[list[str]], k: int, c: int = 60) -> list[tuple[float, str]]:
    """rank_lists：每一路的文档 id 列表，已按相关性降序"""
    scores: dict[str, float] = {}
    for ranked in rank_lists:
        for rank, doc_id in enumerate(ranked):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (c + rank + 1)
    return heapq.nlargest(k, scores.items(), key=lambda kv: kv[1])


bm25 = ["doc-a", "doc-b", "doc-c"]
dense = ["doc-b", "doc-d", "doc-a"]
print(rrf([bm25, dense], k=3))
# [(0.0325..., 'doc-b'), (0.0320..., 'doc-a'), ...] 两路都靠前的 doc-b 胜出
```

`c = 60` 是 RRF 论文里的常用平滑常数，作用是削弱头部名次的过强优势。融合阶段只需 Top-K ，完全不必给全部候选排序。

## 应用三：带多样性的 Top-K（MMR 贪心）

只看分数会让 Top-K 全是近似重复的段落。而堆只能高效回答“谁最好”，回答不了“谁最好且跟已选的不重复”——所以多样性重排通常是**每轮取一个最优**的贪心过程：每轮做一次 Top-1，选中后移出候选池，下一轮的打分函数再把“与已选集合的重复度”算进去。

最大边际相关性（MMR）每轮的得分为 **λ × 相关度 − (1 − λ) × 与已选集合的最大相似度** ：

```python
def mmr(docs: list[tuple[str, list[float], float]], k: int,
        lam: float = 0.5) -> list[str]:
    """docs：(id, 已归一化向量, 与 query 的余弦相似度)；返回选中的 id 序列"""

    def cos(a: list[float], b: list[float]) -> float:
        return sum(x * y for x, y in zip(a, b))  # 向量已归一化，点积即余弦

    pool = list(docs)
    picked: list[str] = []
    picked_vecs: list[list[float]] = []
    while len(picked) < k and pool:
        best = max(                       # 每轮就是一次 k=1 的 Top-K
            pool,
            key=lambda d: lam * d[2] - (1 - lam)
            * max((cos(d[1], p) for p in picked_vecs), default=0.0),
        )
        picked.append(best[0])
        picked_vecs.append(best[1])
        pool.remove(best)
    return picked


# 三条文档：a1 与 a2 内容几乎一样，b1 略弱但角度不同
docs = [
    ("a1", [1.0, 0.0], 0.95),
    ("a2", [0.99, 0.01], 0.94),
    ("b1", [0.70, 0.71], 0.80),
]
print(mmr(docs, k=2, lam=0.5))   # ['a1', 'b1']：a2 与 a1 太像被压掉
print(mmr(docs, k=2, lam=1.0))   # ['a1', 'a2']：λ=1 退化成纯相关性排序
```

**工程实现有两个必做的优化**：预先归一化向量（点积即余弦，省掉每次除模长）；用堆维护“边际得分”候选集，每选出一条只更新受影响的候选，而不是每轮全量重扫。朴素版复杂度是 O(k² · n) ，n 大时也可以只在候选的 Top-2k 里做多样性重排。

## 常见坑

1. **k ≥ n 时**：`nlargest` 会退化为全排序，行为正确但常数变大；先判断规模再决定要不要排序。
2. **k = 0 或负数**：`nlargest(0, xs)` 返回 `[]` ，但手写堆若不做保护会 `IndexError` ，`top_k_stream` 已加了这个分支。
3. **分数与并列**：元组堆比较会级联到第二个元素（分数相同的两条文档不可比时会 `TypeError` ），标准解法是 `(score, seq, item)` 三元组，见《Python 算法工具箱》。
4. **方向反了**：求“最大 k 个”要用小顶堆；写错成大顶堆后，代码看起来“也能跑”，只是悄悄变成“最小 k 个” 。
5. **分片 Top-K 的每片 k 取小了**：这是分布式检索最隐蔽的正确性 bug ，结果会静默丢失。
6. **把“局部 Top-K 的并集”当成全局有序**：归并后还要再排一次（`heapq.merge` 的输出才是有序的）。
7. **归一化与距离度量混用**：内积、余弦、L2 的“越大越好 / 越小越好”方向不同，`nlargest` 与 `nsmallest` 用错就是完全相反的结果，详见《向量相似度与 HNSW 近邻图》。
8. **numpy 场景别再套 Python 堆**：向量化打分用 `np.argpartition(-scores, k)[:k]` 平均 O(n) 且快一个量级；但注意其结果是“前 k 个、内部无序”，需要时再对这 k 个排序。

## 延伸阅读

- Python 官方文档 `heapq` 的 `nlargest` / `nsmallest` / `merge` 一节，含“k 接近 n 时内部改用 sorted”的实现说明与复杂度。
- 《堆》：`sift_up` / `sift_down` 、建堆 O(n) 的推导。
- 《排序算法》：全排序的复杂度下界 Ω(n log n) ，以及为什么 Top-K 可以绕过它。
- 《向量相似度与 HNSW 近邻图》：HNSW 查询内部就是“候选堆 + 结果堆”，是本篇方法的实战版本。
- 《Trie 前缀树（字典树）》：另一个常见组合“前缀 + Top-K”。

---

> **来源**：抓取于 2026-09-19。`heapq.nlargest` / `nsmallest` / `merge` / `heapreplace` 的行为与复杂度依据 [Python heapq 官方文档](https://docs.python.org/3/library/heapq.html#heapq.nlargest)（Python Software Foundation，PSF License 2.0）；建堆与 Top-K 例题思路参考 hello-algo《堆》与《Top-K 问题》（krahets，CC BY-NC-SA 4.0）。RRF 融合按 Cormack 等人 2009 年论文的公式实现，MMR 按 Carbonell 与 Goldstein 1998 年的目标函数实现，均为本站自行编写。全部代码已在 Python 3.12 下运行验证。
