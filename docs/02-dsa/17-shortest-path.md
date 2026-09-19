---
title: 最短路径与 NetworkX 实践
source_url: https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html
author: 本站整理；参考 NetworkX 官方文档、Python heapq 文档、OI Wiki《最短路》
license: BSD-3-Clause（NetworkX）；PSF License 2.0（Python 文档）；CC BY-SA 4.0（OI Wiki 定义）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12，networkx 3.4
order: 17
group: 图
---
## 为什么需要最短路径

> **难度**：★★☆。算法思想只有一个“贪心 + 优先队列”，工程上更重要的是选对算法与库。
> **适合**：要在依赖图、知识图谱、社交/引用网络、路由与调度问题里算“最短/最少跳数”的读者。
> **前置**：《图》《图的遍历（DFS/BFS）》《堆》。本篇不重复邻接表的存储细节。


“两点之间怎么走最好”听起来像地图专用问题，实际上这类结构到处都是：

- **网络路由**：OSPF、IS-IS 就是在链路代价图上跑 Dijkstra。
- **社交与引用网络**：两个用户之间的最短关系链（六度分隔）、论文引用路径。
- **知识图谱与 GraphRAG**：从实体 A 到实体 B 的多跳推理路径，路径长度与边权常被直接当作召回重排特征。
- **代码与依赖图**：`import` 环、微服务调用链中最短的故障传播路径。
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
    # {'a': 0.0, 'c': 9, 'f': 11, 'b': 7, 'e': 20, 'd': 20}
```

两个实现细节最容易写错：

- **`if d > dist[u]: continue` 是必须的**。Python 的 `heapq` 没有 `decrease_key` ，标准做法是“插入更小的新记录 + 弹出时跳过过期记录”，这叫惰性删除；不跳过会让复杂度退化。
- **记录路径要单独存 `prev` 或建反向图**。上面 `reconstruct` 用反向图，好处是不改主逻辑；面试里更常见的是在松弛成功时写 `prev[v] = u` 。

## 工程做法：直接用 NetworkX

生产代码很少手写 Dijkstra 。NetworkX 提供了完整的经典算法，API 一致、经过长期测试，代价是纯 Python 实现的常数较大（几十万边以上要换 `rustworkx` 或 `igraph` ，或者用 `scipy.sparse.csgraph` ）。

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
# 分数排序：HNSW 与 IVF 都是 1 跳，聚类的路径更长因此贡献更低
```

这段代码体现的“**单源算一次、多目标查表**”是图检索的性能关键：对每个问题实体跑一次 `single_source_dijkstra` ，而不是对每个“实体-文档”对跑 `dijkstra_path` ，查询量从 O(实体数 × 文档数) 降到 O(实体数) 。

## 常见坑

1. **权重方向搞反**。若 `weight` 表示“相似度”，最短路会去找最不相似的边。要么存“代价 = 1 - 相似度”，要么改用最长路（拓扑有序时用 DP，一般图上是 NP-hard）。
2. **有向图忘了指定方向**。`nx.Graph()` 会静默合并反向边，`nx.DiGraph()` 才区分 `u→v` 与 `v→u` 。两者在依赖图、调用链场景下结果差异巨大。
3. **`weight` 属性必须是数值**。从 CSV/JSON 读入后若还是字符串，NetworkX 会在累加时抛 `TypeError` ，或在比较时给出诡异结果；导入后统一 `nx.set_edge_attributes(G, {...}, "weight")` 并显式转 `float` 。
4. **负权 + Dijkstra 不报错，只给错答案**。它不会抛异常，只会悄悄返回偏大的距离。怀疑数据里有负权时，先用 `nx.bellman_ford` 跑一遍并 `find_negative_cycle` 检查。
5. **不连通的顶点不会出现在结果里**。`single_source_dijkstra_path_length` 只返回可达顶点，`dist.get(v, inf)` 而不是 `dist[v]` ，否则 `KeyError` 会藏在批量评估脚本里。
6. **大图性能**。NetworkX 是纯 Python ，百万边级别明显吃力。性能敏感时按顺序考虑：`scipy.sparse.csgraph.dijkstra`（稀疏矩阵，快很多）→ `rustworkx`（Rust 实现）→ 专用引擎（OSRM、GraphHopper、Neo4j）。
7. **别滥用全源最短路**。`nx.floyd_warshall` 是 O(V³) 且要存稠密矩阵，V 上万就是灾难；需要“社区/中心性”类指标时应该用采样近似（`nx.approximation` 或 `nx.betweenness_centrality` 的 `k` 参数）。
8. **Python 递归不是问题，但 `RecursionError` 是**：图的深度遍历请用 `nx.bfs_tree` / `nx.dfs_tree` 的迭代版本，或显式自己维护栈。

## 延伸阅读

- NetworkX 官方文档《Shortest Paths (NetworkX Reference)》：各类最短路的完整签名与注意事项。
- SciPy 文档 `scipy.sparse.csgraph.dijkstra`：稀疏矩阵版，适合大图与批量查询。
- 《堆》《Top-K 与堆：召回重排里的取前 N 个》：Dijkstra 的优先队列与 `heapq` 的用法。
- 《图的遍历（DFS/BFS）》：无权最短路的来源。
- OI Wiki《最短路径》，含 SPFA、Johnson 等竞赛向算法与严格证明。

---

> **来源**：抓取于 2026-09-19。API 与参数语义依据 [NetworkX Shortest Paths 参考文档](https://networkx.org/documentation/stable/reference/algorithms/shortest_paths.html)（NetworkX Developers，BSD-3-Clause）与 [Python `heapq` 官方文档](https://docs.python.org/3/library/heapq.html)（PSF，PSF License 2.0）；问题分类与术语参考 [OI Wiki《最短路径》](https://oi-wiki.org/graph/shortest-path/)（OI Wiki 项目，CC BY-SA 4.0）。原文（OI Wiki 页面）的 C++ 实现、SPFA 队列优化与竞赛习题未收录，全部 Python 代码为本站编写并在 Python 3.12 + networkx 3.4 下运行验证。
