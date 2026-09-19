---
title: 最短路径与 NetworkX 实践
source_url: https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html
author: 本站整理；参考 NetworkX 官方文档、Python heapq 文档、OI Wiki《最短路》
license: BSD-3-Clause（NetworkX）；PSF License 2.0（Python 文档）；CC BY-SA 4.0（OI Wiki 定义）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12，networkx 3.4
order: 19
group: 图
---
## 为什么需要最短路径

> **难度**：★★☆。算法思想只有一个“贪心 + 优先队列”，工程上更重要的是选对算法与库。
> **适合**：要在依赖图、知识图谱、社交/引用网络、路由与调度问题里算“最短/最少跳数”的读者。
> **前置**：《图》《图的遍历（DFS/BFS）》《堆》。本篇不重复邻接表的存储细节。


“两点之间怎么走最好”听起来像地图专用问题，实际上这类结构到处都是：

- **网络与网关路由**：OSPF、IS-IS 就是在链路代价图上跑 Dijkstra ；API 网关按“延迟 + 成本 + 剩余配额”给上游多个 region 选路，本质是同一件事。
- **调用链与超时预算**：一次请求经过 `gateway → order → inventory → pricing` ，端到端开销是各段之和。知道“从入口到某个服务的最小累计开销”，才能给它配一个既不会误杀、也不会拖死上游的超时值。
- **社交与引用网络**：两个用户之间的最短关系链（六度分隔）、论文引用路径。
- **知识图谱与 GraphRAG**：从实体 A 到实体 B 的多跳推理路径，路径长度与边权常被直接当作召回重排特征。
- **代码与依赖图**：`import` 环、微服务调用链中最短的故障传播路径（离故障源最近的服务最先被判定为受影响）。
- **状态机与博弈**：把状态当顶点、转移当边，最少步数就是无权最短路。

需要先划清一个概念：**“最短”指路径上边的权重之和最小，不是经过的边数最少**。若所有边权都是 1 ，两者才等价，此时广度优先遍历就是最短路径算法。

## 四类问题与算法选择

| 问题 | 边权要求 | 常用算法 | 复杂度 |
| ---- | -------- | -------- | ------ |
| 单源无权最短路 | 无权 / 全为 1 | BFS | O(V + E) |
| 单源非负权最短路 | 权重 ≥ 0 | Dijkstra（堆优化） | O((V + E) log V) |
| 单源含负权最短路 | 允许负权，无负权环 | Bellman-Ford / SPFA | O(V E) |
| 全源最短路 | 无负权环 | 反复 Dijkstra；或 Floyd-Warshall | O(V³) |
| 单对最短路 | 非负、目标明确 | A\*（带启发式）、双向 Dijkstra | 视启发式而定 |

三点结论值得背下来：

1. **无权图直接 BFS ，别上 Dijkstra**，白付 log 因子。
2. **有负权就没有“已经确定”的说法**，Dijkstra 的正确性依赖“后续路径不会更短”，负权边会打破它，必须换 Bellman-Ford 。
3. **全源 O(V³) 的 Floyd-Warshall 只在 V 很小（几百）时才实用**，大图算全源要用“稀疏多源”的近似或分块策略。

## 先推两件小事：BFS 为什么对、Dijkstra 为什么需要非负权

**BFS 给出的层数就是无权最短路。** 广度优先遍历按“离起点的跳数”一圈一圈往外扩：第 k 圈里的顶点，都存在一条 k 跳的路径（沿树的父指针回上去即可构造）；同时它不可能存在更短的路径，因为更短就意味着它会在更早的某一圈被发现并归入那一圈。两头一夹，层号 = 最短路长度。这也解释了为什么“六度分隔”“几跳内可达”这类问题用 `networkx` 的 BFS 就够，不需要任何带权算法。

**Dijkstra 的每一步都在赌“当前最小的临时距离不会再变小”。** 这个赌注只有在边权非负时成立：设本轮从未确定集合里弹出的是 u ，其 `dist[u]` 是堆中最小值；任何一条还没走完的路径若要经过未确定的顶点 x 再绕到 u ，它到 x 的那一段长度不小于 `dist[x] ≥ dist[u]` ，而剩下的段不会为负，所以总长不可能比 `dist[u]` 更小——u 的答案就此锁定。把边权换成负数，最后这句不等式崩掉，Dijkstra 会把“先贵后便宜”的路径永久错过（且**不报错**，只是返回偏大的结果）。

顺带说明 Dijkstra 的复杂度 O((V + E) log V) 从哪来：一个顶点被“真正确定”后不会再被扫描，所以每条边只会被扫一次；每扫一次至多产生一次入堆，于是堆里的操作总数是 O(V + E) ，每次 O(log V) 。注意 `dist[v]` 在 v 被弹出之前可能被改好几次，过期记录会留在堆里，这正是下面代码要用 `if d > dist[u]: continue` 丢弃它们的原因。

## 手写 Dijkstra：把《堆》用起来

Dijkstra 的思路是维护一张“已确定的最短距离表” `dist` ，每轮从未确定的顶点里取出 `dist` 最小者——**这一步正好是堆的拿手好戏**——然后用它去松弛邻居。

```python
import heapq
from math import inf


def dijkstra(graph: dict[str, list[tuple[str, float]]], start: str) -> dict[str, float]:
    """单源最短路（Dijkstra），返回 start 到各顶点的最短距离

    graph：邻接表，graph[u] = [(v, weight), ...]，要求 weight >= 0
    """
    dist: dict[str, float] = {start: 0.0}
    # 小顶堆元素为 (距离, 顶点)。Python 元组按字典序比较，
    # 因此距离相同时会比顶点名，这不影响正确性
    heap: list[tuple[float, str]] = [(0.0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, inf):
            continue  # 堆里的过期记录，直接丢弃（惰性删除）
        for v, w in graph.get(u, []):
            nd = d + w
            if nd < dist.get(v, inf):  # 松弛成功
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist


def reconstruct(graph_rev: dict[str, list[tuple[str, int]]], dist: dict[str, int],
                start: str, target: str) -> list[str]:
    """沿“入边”从终点往回走，还原最短路径（需另建反向图）"""
    if target not in dist:
        return []
    path = [target]
    cur = target
    while cur != start:
        # 找到满足 dist[p] + w == dist[cur] 的前驱
        for p, w in graph_rev.get(cur, []):
            if p in dist and dist[p] + w == dist[cur]:
                cur = p
                path.append(p)
                break
        else:
            return []  # 图被改动或存在负权，路径还原失败
    return path[::-1]


if __name__ == "__main__":
    g = {
        "a": [("b", 7), ("c", 9), ("f", 14)],
        "b": [("a", 7), ("c", 10), ("d", 15)],
        "c": [("a", 9), ("b", 10), ("d", 11), ("f", 2)],
        "d": [("b", 15), ("c", 11), ("e", 6)],
        "e": [("d", 6), ("f", 9)],
        "f": [("a", 14), ("c", 2), ("e", 9)],
    }
    print(dijkstra(g, "a"))
    # {'a': 0.0, 'b': 7.0, 'c': 9.0, 'f': 11.0, 'd': 20.0, 'e': 20.0}
```

把这张 6 顶点小图的执行过程摊开，能一次看清三件事：堆按什么顺序吐顶点、`dist` 怎样被反复改写、以及过期记录是怎么产生的。

| 轮次 | 弹出 | 松弛结果 | 弹出后堆里的内容 |
| ---- | ---- | -------- | ---------------- |
| 1 | (0, a) | b: ∞→7 ，c: ∞→9 ，f: ∞→14 | (7,b) (9,c) (14,f) |
| 2 | (7, b) | d: ∞→22 | (9,c) (14,f) (22,d) |
| 3 | (9, c) | d: 22→20 ，f: 14→11 | (11,f) (14,f) (20,d) (22,d) |
| 4 | (11, f) | e: ∞→20 | (14,f) (20,d) (20,e) (22,d) |
| — | (14, f) | 已过期，`14 > dist[f] = 11` ，丢弃 | — |
| 5 | (20, d) | 无改进 | (20,e) (22,d) |
| 6 | (20, e) | 无改进 | (22,d) → 随后作为过期记录丢弃 |

第 3 轮是本题的“教训时刻”：`c` 一旦确定，就同时改掉了 `d` 和 `f` 的临时距离，堆里于是留下 `(14, f)` 这条再也用不上的旧记录。**顶点被弹出的那一刻才是它被确定的时刻** ，而不是“入堆的那一刻”——这是惰性删除版 Dijkstra 唯一需要记住的一句话。另外第 5、6 轮并列在 20 ，谁先出堆取决于元组第二项的字典序（`d` 在 `e` 前），这不影响结果正确性，但如果你的路径还原依赖弹出顺序，就会得到“同样最短、不同路径”的结果，别把断言写死。

两个实现细节最容易写错：

- **`if d > dist[u]: continue` 是必须的**。Python 的 `heapq` 没有 `decrease_key` ，标准做法是“插入更小的新记录 + 弹出时跳过过期记录”，这叫惰性删除；不跳过会让复杂度退化。
- **记录路径要单独存 `prev` 或建反向图**。上面 `reconstruct` 用反向图，好处是不改主逻辑；面试里更常见的是在松弛成功时写 `prev[v] = u` 。

## 含负权：Bellman-Ford 与“还能松弛 = 有负权环”

如果边权可以为负（常见于“收益”“增量”“对数汇率”这类建模），就必须换 Bellman-Ford ：不做“取最小即确定”的赌注，而是**把所有边重复扫描 V-1 轮**，第 k 轮保证能算出“至多 k 条边”的最短路。它比 Dijkstra 慢（O(V E) ），换来的是对负权的正确性，以及一个额外红利——**多扫一轮就能判断是否存在负权环** 。

```python
from math import inf


def bellman_ford(edges: list[tuple[str, str, float]], nodes: list[str], start: str):
    """返回 (dist, 负权环上的某个顶点或 None)

    edges：[(u, v, w), ...]，允许负权；nodes：全部顶点（含孤立点）
    """
    dist = {n: inf for n in nodes}
    dist[start] = 0.0
    for _ in range(len(nodes) - 1):
        changed = False
        for u, v, w in edges:
            if dist[u] + w < dist[v]:       # 注意 dist[u] 为 inf 时不会误更新
                dist[v] = dist[u] + w
                changed = True
        if not changed:
            break                           # 一整轮没有改进，提前收敛，工程上很常见
    for u, v, w in edges:                   # 还能松弛，说明存在可从 start 到达的负权环
        if dist[u] + w < dist[v]:
            return dist, v
    return dist, None


# 换汇套利检测：边权取 -log(汇率)，于是“换一圈的总权”= -log(各汇率连乘)
# 连乘 > 1（换一圈还有剩）时总权为负，即存在负权环
from math import log

rates = {("usd", "eur"): 0.92, ("eur", "gbp"): 0.86, ("gbp", "usd"): 1.28}
edges = [(u, v, round(-log(r), 4)) for (u, v), r in rates.items()]
print(edges)                     # [('usd','eur',0.0834), ('eur','gbp',0.1508), ('gbp','usd',-0.2469)]
print(round(0.92 * 0.86 * 1.28, 4))   # 1.0127，换一圈还剩 1.27%
dist, neg = bellman_ford(edges, ["usd", "eur", "gbp"], "usd")
print({k: round(v, 4) for k, v in dist.items()}, "负环顶点 =", neg)
# {'usd': -0.0254, 'eur': 0.0707, 'gbp': 0.2215} 负环顶点 = eur   ->  第二个返回值非 None，检出负权环

# 对照组：有负权但无负环，正常收敛，第二个返回值为 None
print(bellman_ford([("a", "b", -2), ("b", "c", 5), ("a", "c", 5)], ["a", "b", "c"], "a"))
# ({'a': 0.0, 'b': -2.0, 'c': 3.0}, None)
```

这就是最典型的**套利 / 一致性约束检测**建模：把“1 单位 usd 换 0.92 单位 eur”记作边权 `-log(0.92)` ，三条边连乘大于 1 就构成负环。上面打印时特意做了 `round` ，因为浮点连加必然带尾差（`usd` 的真实值是 `-0.025400000000000034` ）；同样的原因，**判断负环、判断“两条路径等长”都要用容差而不是 `==`** ，例如 `abs(dist[u] + w - dist[v]) < 1e-9` 。日常后端更常见的用法是反过来——发现负环说明喂进来的数据彼此不自洽，值得报警；而“距离一路变小却没有负环”往往提示某处把“收益”错写成了“代价”的符号。生产上不想自己写，可以用 `networkx.find_negative_cycle(G, source, weight="weight")` ，套路完全一样。

需要提醒的是 Bellman-Ford 的“提前 break”只影响速度不影响正确性，但**最后一轮的检测扫描不能省** ，否则负环会被静默吞掉，返回一组“看起来收敛”的距离。

## 工程做法：直接用 NetworkX

生产代码很少手写 Dijkstra 。NetworkX 提供了完整的经典算法，API 一致、经过长期测试，代价是纯 Python 实现的常数较大（几十万边以上要换 `rustworkx` 或 `igraph` ，或者用 `scipy.sparse.csgraph` ）。安装：

```bash
pip install "networkx>=3.4"
```

```python
import networkx as nx

# 知识图谱片段：实体为顶点，关系带“置信度代价”
G = nx.Graph()  # 无向图；有向用 nx.DiGraph
G.add_edge("向量数据库", "HNSW", weight=1.0)
G.add_edge("HNSW", "近邻图", weight=1.0)
G.add_edge("近邻图", "ANN 检索", weight=1.0)
G.add_edge("向量数据库", "IVF", weight=1.0)
G.add_edge("IVF", "聚类", weight=2.0)
G.add_edge("聚类", "ANN 检索", weight=5.0)

# 1) 无权：最少跳数 + 路径（内部就是 BFS）
print(nx.shortest_path(G, "向量数据库", "ANN 检索"))
# ['向量数据库', 'HNSW', '近邻图', 'ANN 检索']
print(nx.shortest_path_length(G, "向量数据库", "ANN 检索"))  # 3

# 2) 带权：把 weight 属性名传给关键字参数，否则会当成无权图
print(nx.dijkstra_path(G, "向量数据库", "ANN 检索", weight="weight"))
print(nx.dijkstra_path_length(G, "向量数据库", "ANN 检索", weight="weight"))  # 3.0

# 3) 单源到所有目标：一次算完，比循环调用快得多
lengths, paths = nx.single_source_dijkstra(G, "向量数据库", weight="weight")
print(lengths["ANN 检索"], paths["ANN 检索"])

# 4) 多起点（多个召回入口同时扩散）
d, p = nx.multi_source_dijkstra(G, {"HNSW", "IVF"}, weight="weight")

# 5) k 跳以内可达：GraphRAG 里做子图召回的常用操作
hops = nx.single_source_dijkstra_path_length(G, "HNSW", weight="weight", cutoff=2.0)
print(dict(hops))  # 只保留 2 跳以内的邻居，cutoff 直接控制检索半径
```

常用的还有这些入口，按需选用：

| 需求 | API |
| ---- | --- |
| 任意两点最短路径（无权） | `nx.shortest_path(G, s, t)` |
| 任意两点最短路径（带权） | `nx.dijkstra_path(G, s, t, weight="weight")` |
| 单源全部距离 | `nx.single_source_dijkstra_path_length` |
| 全源距离矩阵 | `nx.all_pairs_dijkstra_path_length` / `nx.floyd_warshall` |
| 含负权 | `nx.bellman_ford_path(G, s, t, weight="weight")` |
| 检测负权环 | `nx.find_negative_cycle(G, source, weight="weight")` |
| 所有最短路径 | `nx.all_shortest_paths(G, s, t)` |
| 启发式（地图、网格） | `nx.astar(G, s, t, heuristic=h, weight="weight")` |

> 请注意 `nx.shortest_path` 与 `nx.dijkstra_path` 是两个不同函数：前者的 `weight` 参数默认是 `None`（即按跳数），后者才按权重累加。只写 `nx.shortest_path(G, s, t)` 却期待得到加权结果，是 NetworkX 新手最高频的错误。

## 实战：把最短路变成 RAG 的重排特征

图谱增强的检索里，一个常见做法是：把用户问题里的实体作为起点，在知识图谱上跑受限的 Dijkstra ，再用“到候选文档实体的最短距离”给召回结果打分。

```python
# 复用上一节建好的 NetworkX 图 G
def graph_rerank(question_entities: list[str], doc_entities: dict[str, list[str]],
                 G, weight: str = "weight", max_hops: float = 3.0,
                 decay: float = 0.5) -> list[tuple[float, str]]:
    """doc_entities：文档名 -> 该文档涉及的实体列表

    分数 = 文档中每个实体的“最近距离衰减”之和
    """
    scores: dict[str, float] = {d: 0.0 for d in doc_entities}
    for qe in question_entities:
        if qe not in G:
            continue
        # 一次单源最短路，服务所有文档，避免重复计算
        dist = dict(nx.single_source_dijkstra_path_length(G, qe, weight=weight,
                                                         cutoff=max_hops))
        for doc, ents in doc_entities.items():
            for e in ents:
                if e in dist and e != qe:
                    scores[doc] += decay ** dist[e]  # 越近贡献越大
    return sorted(((s, d) for d, s in scores.items()), reverse=True)


docs = {"doc-hnsw": ["HNSW", "近邻图"], "doc-ivf": ["IVF", "聚类"], "doc-other": ["无关实体"]}
print(graph_rerank(["向量数据库"], docs, G))
# [(0.75, 'doc-hnsw'), (0.625, 'doc-ivf'), (0.0, 'doc-other')]
# HNSW 与 IVF 都是 1 跳，但 doc-hnsw 里两个实体都近，聚类的路径更长，贡献被衰减掉
```

这段代码体现的“**单源算一次、多目标查表**”是图检索的性能关键：对每个问题实体跑一次 `single_source_dijkstra` ，而不是对每个“实体-文档”对跑 `dijkstra_path` ，查询量从 O(实体数 × 文档数) 降到 O(实体数) 。

## 实战：给调用链配超时预算

微服务里最烦人的配置是超时：给大了，上游线程被拖住、雪崩从下游一路漫上来；给小了，正常的 P99 被误杀。调用链本身就是一张有向图，**边权 = 该跳的 P99 开销** ，那么“从入口到某个服务的最小累计开销”正好是一次单源最短路——用它当下界，再按倍数放余量，比凭感觉写 `timeout=3s` 有依据得多。

```python
import heapq
from math import inf


def call_chain_cost(sla: dict[tuple[str, str], float], gateway: str) -> list[tuple[float, str]]:
    """sla[(a, b)]：a 调 b 的 P99 累计开销（ms，含网络与排队）。
    返回从网关到每个下游服务的最小开销，按从大到小排——最需要保护的就是它。"""
    adj: dict[str, list[tuple[str, float]]] = {}
    for (u, v), w in sla.items():
        adj.setdefault(u, []).append((v, w))
        adj.setdefault(v, [])                 # 只做过目标的服务也要出现在顶点集里
    dist: dict[str, float] = {gateway: 0.0}
    heap: list[tuple[float, str]] = [(0.0, gateway)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, inf):
            continue                          # 惰性删除：丢弃过期记录
        for v, w in adj[u]:
            if d + w < dist.get(v, inf):
                dist[v] = d + w
                heapq.heappush(heap, (d + w, v))
    return sorted(((d, s) for s, d in dist.items() if s != gateway), reverse=True)


sla = {
    ("gateway", "auth"): 12.0,
    ("gateway", "order"): 30.0,
    ("auth", "profile"): 9.0,
    ("order", "profile"): 40.0,       # 直连 profile 反而更慢
    ("order", "inventory"): 18.0,
    ("inventory", "pricing"): 15.0,
}
for cost, svc in call_chain_cost(sla, "gateway"):
    print(f"{svc:10} {cost:6.1f} ms")
# pricing      63.0 ms
# inventory    48.0 ms
# order        30.0 ms
# profile      21.0 ms
# auth         12.0 ms
```

两个结论是直接从这张表里读出来的：`profile` 走 `auth` 只有 21 ms ，配 40 ms 的超时是从 `order` 直连那条路的误解；`pricing` 在最深的 63 ms 处，如果 `gateway` 的整体预算只有 50 ms ，那这条链**在任何情况下都超时**，要么改依赖结构（把 `pricing` 提到 `order` 那一层并行调用），要么砍掉这一跳。把边权换成“失败率”“成本单价”还能算同一条链上的其它最优解，只要保证非负，Dijkstra 就仍然适用；真要建模“命中缓存就省 20 ms”这种带收益的边，就得退回上一节的 Bellman-Ford 。

## 实战：限制跳数的路由

“最多允许 k 次中转的最低成本路径”是网关与 CDN 选路的常见约束（多一跳就多一份握手与失败概率）。注意这**不是**朴素最短路加上“跳数 ≤ k”的判断：最短路本身可能已经有 10 跳。正确做法是把 Bellman-Ford 的“轮数”当作资源约束用——第 i 轮结束时的 `dist` 恰好是“至多 i 条边”的答案：

```python
from math import inf


def cheapest_with_hops(flights: list[tuple[str, str, float]], src: str, dst: str,
                       max_hops: int) -> float:
    """最多 max_hops 次中转（即至多 max_hops + 1 条边）的最低代价"""
    dist = {src: 0.0}
    for _ in range(max_hops + 1):
        nxt = dict(dist)                     # 关键：第 r 次迭代只读第 r-1 次的结果
        for u, v, price in flights:
            if u in dist and dist[u] + price < nxt.get(v, inf):
                nxt[v] = dist[u] + price
        dist = nxt
    return dist.get(dst, inf)


flights = [("A", "B", 100), ("B", "C", 100), ("A", "C", 350),
           ("C", "D", 100), ("B", "D", 500)]
print(cheapest_with_hops(flights, "A", "D", 1))   # 450.0：只能 A->B->D 或 A->C->D 里挑
print(cheapest_with_hops(flights, "A", "D", 2))   # 300.0：放开一跳，A->B->C->D 才可达
```

那句 `nxt = dict(dist)` 是整个实现的分水岭：如果在 `dist` 上原地更新，同一次迭代里新拿到的距离会立刻被后面的边继续使用，等于**一次迭代跨了任意多条边** ，算出来的就是普通最短路而不是“至多 k 跳”。把“只读上一次迭代的结果、本次迭代写进新副本”这件事写对，需要分层推进的算法（含《动态规划》里的滚动数组）都是同一个套路。

## 常见坑

1. **权重方向搞反**。若 `weight` 表示“相似度”，最短路会去找最不相似的边。要么存“代价 = 1 - 相似度”，要么改用最长路（拓扑有序时用 DP，一般图上是 NP-hard）。
2. **有向图忘了指定方向**。`nx.Graph()` 会静默合并反向边，`nx.DiGraph()` 才区分 `u→v` 与 `v→u` 。两者在依赖图、调用链场景下结果差异巨大。
3. **`weight` 属性必须是数值**。从 CSV/JSON 读入后若还是字符串，NetworkX 会在累加时抛 `TypeError` ，或在比较时给出诡异结果；导入后统一 `nx.set_edge_attributes(G, {...}, "weight")` 并显式转 `float` 。
4. **负权 + Dijkstra 不报错，只给错答案**。它不会抛异常，只会悄悄返回偏大的距离。怀疑数据里有负权时，先用 `nx.bellman_ford` 跑一遍并 `find_negative_cycle` 检查。
5. **不连通的顶点不会出现在结果里**。`single_source_dijkstra_path_length` 只返回可达顶点，`dist.get(v, inf)` 而不是 `dist[v]` ，否则 `KeyError` 会藏在批量评估脚本里。
6. **大图性能**。NetworkX 是纯 Python ，百万边级别明显吃力。性能敏感时按顺序考虑：`scipy.sparse.csgraph.dijkstra`（稀疏矩阵，快很多）→ `rustworkx`（Rust 实现）→ 专用引擎（OSRM、GraphHopper、Neo4j）。
7. **别滥用全源最短路**。`nx.floyd_warshall` 是 O(V³) 且要存稠密矩阵，V 上万就是灾难；需要“社区/中心性”类指标时应该用采样近似（`nx.approximation` 或 `nx.betweenness_centrality` 的 `k` 参数）。
8. **Python 递归不是问题，但 `RecursionError` 是**：图的深度遍历请用 `nx.bfs_tree` / `nx.dfs_tree` 的迭代版本，或显式自己维护栈。
9. **把分位数当边权相加**。端到端的 P99 不等于各跳 P99 之和（分位数不可加），把 `sla` 表里的 P99 直接累加得到的只是**保守上界的近似**，用它可以，但别在报告里写成“端到端 P99 = 63 ms”。要严格计算需要各跳延迟分布做卷积，或者干脆用链路追踪的真实端到端样本对齐一次。
10. **图上跑最短路之前先看是不是 DAG**。依赖图、工作流图通常无环，此时“最长路”用拓扑序 DP 是 O(V + E) ，比任何带权最短路都快，见《拓扑排序与依赖调度》。

## 延伸阅读

- NetworkX 官方文档 [Shortest Paths (NetworkX Reference)](https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html)：各类最短路的完整签名与注意事项。
- SciPy 文档 `scipy.sparse.csgraph.dijkstra`：稀疏矩阵版，一次传入多个源点 `indices` 就能批量算，大图上比 NetworkX 快一个量级以上。
- 《堆》《Top-K 与堆：召回重排里的取前 N 个》：Dijkstra 的优先队列与 `heapq` 的用法。
- 《图的遍历（DFS/BFS）》：无权最短路的来源。
- 《拓扑排序与依赖调度》：DAG 上的最长路（关键路径）与环检测。
- 《向量相似度与 HNSW 近邻图》：同样是“在图上用距离做检索”，HNSW 里的贪心下降可以看作没有回溯的单目标最近似路径。
- 《GraphRAG：用知识图谱回答"全局性"问题》：多跳检索与图社区划分的完整工程链路。

---

> **来源**：抓取于 2026-09-19。API 与参数语义依据 [NetworkX Shortest Paths 参考文档](https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html)（NetworkX Developers，BSD-3-Clause）与 [Python `heapq` 官方文档](https://docs.python.org/3/library/heapq.html)（PSF，PSF License 2.0）；问题分类与术语参考 [OI Wiki《最短路径》](https://oi-wiki.org/graph/shortest-path/)（OI Wiki 项目，CC BY-SA 4.0）。原文的 C++ 实现、SPFA 队列优化与竞赛习题未收录；手写 Dijkstra 执行过程表、Bellman-Ford 与负环检测、调用链超时预算、限跳数路由四段代码及全部推导与中文说明为本站编写，已在 CPython 3.12/3.14 下运行验证；NetworkX 两段按 3.4+ 的稳定 API 编写，并在 networkx 3.6 下复核过输出（安装：`pip install "networkx>=3.4"` ）。
