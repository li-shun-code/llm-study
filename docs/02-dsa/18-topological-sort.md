---
title: 拓扑排序与依赖调度
source_url: https://docs.python.org/zh-cn/3/library/graphlib.html
author: 本站整理；参考 Python 官方文档 graphlib、OI Wiki《拓扑排序》
license: PSF License 2.0（Python 文档）；CC BY-SA 4.0（OI Wiki 定义与配图）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（graphlib 自 3.9 起进入标准库）
order: 18
group: 图
---
## 为什么需要拓扑排序

> **难度**：★★☆。算法只有一个队列，价值全在“把依赖关系建模成 DAG”这一步。
> **适合**：要做任务编排、构建流水线、工作流引擎、模块依赖检查的读者。
> **前置**：《图》《队列》。本篇的实现以邻接表存图，遍历部分沿用《图的遍历（DFS/BFS）》的写法。


现实系统里到处是“必须先把某件事做完，才能做另一件事”：

- 构建工具：编译 `module_b` 之前必须先编译它依赖的 `module_a` 。
- 数据流水线：清洗任务 → 特征任务 → 训练任务 → 评估任务。
- 工作流引擎（Airflow、Dify 的 Workflow、n8n）：节点连成有向图后，需要一个合法执行顺序，还要在**保存/发布那一刻**就判断这张图画得对不对。
- Agent 编排（LangGraph 这类图式框架）：节点是步骤、边是状态流转，执行前要检查可达性与非法环；一次多步任务里，“查库存”必须早于“下单”，“检索文档”必须早于“生成回答”。
- 数据库：视图依赖视图、`CREATE TABLE` 的外键顺序、迁移脚本（migration）的依赖。
- 语言运行时：`import` 解析、包管理器（`pip` / `npm`）判断循环依赖。

这些都可以抽象成同一个问题：**给定一个有向无环图（DAG），排出一个顶点序列，使得每条边 u → v 都满足 u 排在 v 前面**。这个序列就是拓扑序，求它的算法叫拓扑排序。

请注意“无环”是前提：只要图里存在环，拓扑序就不存在（A 依赖 B、B 依赖 A，谁也走不到前面）。因此拓扑排序在生产里还有第二个用途——**检测循环依赖**。

## 定义与直观例子

以大学排课为例。「数据结构」要求在学完「离散数学」之后修，「编译技术」要求先学「算法语言」和「离散数学」。把每门课看成一个顶点，课程之间的先后要求看成有向边 (u, v) （即 u 是 v 的前置），那么教务处在“符合逻辑关系”的前提下排出的课表，就是一次拓扑排序。

![排课依赖图（OI Wiki 原图）](assets/oi_graph__topo-example-1.svg)

两个必须理解的性质：

1. **拓扑序通常不唯一**。上面这张图里，「离散数学」和「普通物理」谁先谁后都合法。想让它唯一，需要额外规则（比如“同层按名称字典序”）。
2. **拓扑序不违反任何偏序关系，但会“保留”所有依赖**。它是偏序的一个线性扩展（linear extension）。

## 方法一：Kahn 算法（入度 + BFS）

代码实现维护一个入度为 0 的顶点集合，核心步骤是：

1. 统计每个顶点的入度（有多少条边指向它）。
2. 把所有入度为 0 的顶点入队——它们没有任何前置条件。
3. 弹出队首顶点，把它加入结果序列；它的所有后继顶点入度减 1 ，减到 0 就入队。
4. 重复步骤 3 ，直到队列为空。若结果序列长度小于顶点数，说明图中有环。

![Kahn 算法过程（OI Wiki 原图）](assets/oi_graph__topo-example.svg)

Python 实现如下。这里用邻接表（`dict[顶点, list[后继]]` ）存图，与《图》中的 `GraphAdjList` 同构：

```python
from collections import deque


def topological_sort(graph: dict[str, list[str]]) -> list[str]:
    """Kahn 算法求拓扑序；存在环时抛出 ValueError

    graph：邻接表，graph[u] 是 u 的所有后继（u 完成后才能做的那些任务）
    """
    # 1. 统计入度。先把只出现在边右端、没有出边的顶点补齐
    indeg: dict[str, int] = {v: 0 for v in graph}
    for u, nxt in graph.items():
        for v in nxt:
            indeg.setdefault(v, 0)
            indeg[v] += 1

    # 2. 所有入度为 0 的顶点入队
    queue = deque([v for v, d in indeg.items() if d == 0])
    order: list[str] = []

    # 3. 逐个出队，并让后继的入度减 1
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in graph.get(u, []):
            indeg[v] -= 1
            if indeg[v] == 0:  # 前置任务全部完成，可以排进来
                queue.append(v)

    # 4. 若顶点未被全部输出，说明存在环
    if len(order) != len(indeg):
        cyclic = [v for v, d in indeg.items() if d > 0]
        raise ValueError(f"图中存在循环依赖，涉及顶点：{cyclic}")
    return order


if __name__ == "__main__":
    dag = {
        "fetch_docs": ["clean"],
        "clean": ["embed", "summary"],
        "embed": ["index"],
        "summary": ["index"],
        "index": ["evaluate"],
        "evaluate": [],
    }
    print(topological_sort(dag))
    # ['fetch_docs', 'clean', 'embed', 'summary', 'index', 'evaluate']
```

把 `deque` 换成 `heapq` 的小顶堆，就能得到**字典序最小的拓扑序**——这是面试里常见的追问：

```python
import heapq


def topological_sort_lexicographic(graph: dict[str, list[str]]) -> list[str]:
    """字典序最小的拓扑序：把队列换成优先队列"""
    indeg: dict[str, int] = {v: 0 for v in graph}
    for u, nxt in graph.items():
        for v in nxt:
            indeg.setdefault(v, 0)
            indeg[v] += 1
    heap = [v for v, d in indeg.items() if d == 0]
    heapq.heapify(heap)
    order: list[str] = []
    while heap:
        u = heapq.heappop(heap)  # 每次取当前可选任务里名字最小的
        order.append(u)
        for v in graph.get(u, []):
            indeg[v] -= 1
            if indeg[v] == 0:
                heapq.heappush(heap, v)
    return order if len(order) == len(indeg) else []
```

### 为什么 Kahn 算法是对的

值得记的不是代码，而是它维持的两条不变式——面试追问、以及排查“为什么我的调度器少跑了一个任务”，答案都在这里。

- **不变式一：队列里的顶点，入度确实为 0。** 顶点入队只有一个时机，即它的入度被减到 0 的那一刻；而入度只减不增，所以出队时它的所有前置都已经在 `order` 里出现过。
- **不变式二：`order` 的任何前缀都是合法的部分拓扑序。** 由不变式一，每次追加的顶点的所有前置都已在序列中，故新前缀仍满足“每条边 u → v 有 u 在前”。

终止时若 `len(order) < |V|` ，剩下那批顶点（入度始终 > 0）中**任意一个顶点沿任一入度非 0 的前驱往回走，因为顶点有限必然重复，就构造出了一个环**。这也是为什么 `raise ValueError` 时可以直接把 `d > 0` 的顶点全部列出来当“嫌疑名单”：它们要么在环上，要么依赖了环上的顶点。反过来，若图无环，每一轮至少存在一个入度为 0 的顶点（否则又回到上面的构造），队列永不提前干涸，算法必然输出全部顶点。

顺带说明它为什么是 O(V + E) ：每个顶点进出队一次，每条边只在处理其左端点时被访问一次。

## 方法二：DFS 后序逆序

另一种等价的实现是深度优先搜索：**把每个顶点在其所有后继都被访问完之后才记录，最后整体反转**，即得拓扑序。三原色标记法可以同时完成环检测：

```python
WHITE, GRAY, BLACK = 0, 1, 2  # 未访问 / 在当前递归栈上 / 已完成


def topological_sort_dfs(graph: dict[str, list[str]]) -> list[str]:
    """DFS 版拓扑排序；遇到反向边（指向 GRAY 的边）即存在环"""
    color = {v: WHITE for v in graph}
    for nxt in graph.values():
        for v in nxt:
            color.setdefault(v, WHITE)
    post: list[str] = []

    def dfs(u: str):
        color[u] = GRAY  # 入栈
        for v in graph.get(u, []):
            if color[v] == GRAY:  # 后向边：u -> v -> … -> u
                raise ValueError(f"存在环：{v} 是 {u} 的祖先")
            if color[v] == WHITE:
                dfs(v)
        color[u] = BLACK  # 出栈，后继已全部处理
        post.append(u)

    for v in color:
        if color[v] == WHITE:
            dfs(v)
    post.reverse()  # 后序遍历结果的逆序即拓扑序
    return post
```

两种方法的选择：Kahn 更适合**在线/流式**场景（可以在运行中持续拿到“当前可执行集合”），也更容易改成分层并行；DFS 写法更短，但受递归深度限制，几万个节点的任务图会直接 `RecursionError` ，**生产代码优先用 Kahn** 。

### 为什么“后序逆序”是拓扑序

DFS 版依赖一个关于“后向边”的结论：在有向图的深度优先森林里，**一条边 u → v 只有在 v 的后序编号小于 u 时才可能是正常的树边/前向边/横叉边；出现 v 是 u 的祖先（GRAY 状态）就说明有环**。反过来说，对于无环图里的任意一条边 u → v ，v 必然在 u 变 BLACK 之前就已变 BLACK （若 u 是 v 的祖先则成环，矛盾；若 v 尚未被访问，它会在 u 的子树里被处理完；若 v 已被别的搜索处理完，它的后序编号自然更小）。于是「后序序列」中 v 总在 u 之后，整体反转后 u 就排在 v 前面——正是拓扑序。

这段推理同时解释了代码里为什么只判断 `color[v] == GRAY` ：指向 BLACK 的边是完全合法的（只是“已经完成的任务被另一个任务再次依赖”），只有指向 GRAY （还在当前递归栈上）的边才构成环。

## 实战一：工作流引擎的“编译期”检查

Dify、n8n、Airflow 这类引擎在保存或发布一张流程图时做的并不是排序，而是**校验**：有没有引用了不存在节点的悬空边？有没有环？有没有从入口根本走不到的死节点？这三问全都用一次拓扑排序 + 一次可达性遍历解决。下面这份实现可以直接搬到自己的编排层里：

```python
from collections import defaultdict, deque


def analyze_workflow(nodes: list[str], edges: list[tuple[str, str]], start: str) -> dict:
    """工作流“编译期”检查：悬空边、环、从入口不可达的节点。"""
    for u, v in edges:
        if u not in nodes or v not in nodes:
            raise ValueError(f"悬空边：{u} -> {v} 引用了未注册的节点")

    succ: dict[str, list[str]] = defaultdict(list)
    indeg = {n: 0 for n in nodes}
    for u, v in edges:
        succ[u].append(v)
        indeg[v] += 1

    # 1) 全图跑一遍 Kahn：跑不完的那批顶点，就是环上或被环卡住的节点
    q = deque([n for n, d in indeg.items() if d == 0])
    visited = set()
    while q:
        u = q.popleft()
        visited.add(u)
        for v in succ[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    cyclic = [n for n in nodes if n not in visited]

    # 2) 可达性：从入口做一次遍历，走不到的节点在真实引擎里通常是静默失败
    seen, stack = {start}, [start]
    while stack:
        for v in succ[stack.pop()]:
            if v not in seen:
                seen.add(v)
                stack.append(v)
    unreachable = [n for n in nodes if n not in seen]
    return {"cyclic": cyclic, "unreachable": unreachable, "ok": not cyclic and not unreachable}


nodes = ["入口", "检索", "重排", "生成", "校验", "存档"]
edges = [("入口", "检索"), ("检索", "重排"), ("重排", "生成"),
         ("生成", "校验"), ("校验", "检索")]   # 故意留一个环 + 一个孤立的存档节点
print(analyze_workflow(nodes, edges, "入口"))
# {'cyclic': ['检索', '重排', '生成', '校验'], 'unreachable': ['存档'], 'ok': False}
```

值得注意的细节：`cyclic` 与 `unreachable` 是**两个正交的问题**。环上节点的入度永远归不了零，所以它们既出现在 `cyclic` 里也会连锁导致下游不可达；而“孤立的存档节点”只是被忘了连线，图本身完全合法。把它们混成一个“排序失败”错误抛出去，运维就只能靠肉眼画图排查了。同理，LangGraph 之类框架报的 “Unreachable node” 与 “Found cycles in graph” 也是两类不同的诊断，别在封装层里合并掉。

## 标准库方案：graphlib.TopologicalSorter

Python 3.9 起，标准库就提供了拓扑排序，不必手写。它内部用的正是“计数 + 可执行集合”的思路，并额外处理了重复添加节点、自动环检测。

```python
from graphlib import TopologicalSorter, CycleError

dag = {
    "index": {"embed", "summary"},      # key 依赖 value（注意方向与手写版相反）
    "embed": {"clean"},
    "summary": {"clean"},
    "clean": {"fetch_docs"},
    "fetch_docs": set(),
}

ts = TopologicalSorter(dag)
print(list(ts.static_order()))
# ['fetch_docs', 'clean', 'embed', 'summary', 'index']

# 有环时不再返回错误结果，而是抛出 CycleError
try:
    TopologicalSorter({"a": {"b"}, "b": {"c"}, "c": {"a"}}).prepare()
except CycleError as e:
    print("循环依赖：", e.args[1])  # ('a', 'b', 'c', 'a')
```

三个要点：

1. **方向与手写版相反**。`TopologicalSorter` 的 `add(node, *predecessors)` 声明的是“前置依赖”，即 `add("index", "embed")` 表示 embed 必须先做；而邻接表 `graph["embed"] = ["index"]` 表示“embed 完成后才能做 index”。混用最容易出错。
2. `static_order()` 一次性拿到完整序列；它要求图在排序期间不再变化。
3. `prepare()` + `get_ready()` / `is_active()` / `done()` 是**流式接口**，可以边执行边回报完成，这正是任务调度需要的形态。

## 实战二：一个能并行的最小任务调度器

Agent 的多步任务、离线批处理常常需要“拓扑序 + 同层并行”。下面这个调度器只依赖标准库，就能做到“依赖满足就提交、并发跑、跑完解锁后继”：

```python
import time
from collections import defaultdict
from collections.abc import Callable
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait


def run_dag(tasks: dict[str, Callable[[], object]], deps: dict[str, set[str]],
            workers: int = 4) -> list[str]:
    """按拓扑序执行 tasks：就绪即提交、跑完解锁后继、同层自动并行。

    tasks：任务名 -> 无参可调用对象
    deps ：任务名 -> 该任务依赖的任务名集合
    返回完成顺序，便于写审计日志。
    """
    indeg = {name: 0 for name in tasks}
    successors: dict[str, list[str]] = defaultdict(list)
    for name, pre in deps.items():
        for p in pre:
            successors[p].append(name)
            indeg[name] += 1

    finished: list[str] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        running: dict[Future, str] = {}
        for n, d in indeg.items():                    # 入度为 0 的先提交
            if d == 0:
                running[pool.submit(tasks[n])] = n
        while running:
            done, _ = wait(running, return_when=FIRST_COMPLETED)  # 阻塞等待，不空转轮询
            for fut in done:
                name = running.pop(fut)
                fut.result()                          # 任务里的异常在这里抛出
                finished.append(name)
                for nxt in successors[name]:
                    indeg[nxt] -= 1
                    if indeg[nxt] == 0:               # 前置齐了，立刻提交，不必等一整层
                        running[pool.submit(tasks[nxt])] = nxt
    if len(finished) != len(tasks):                   # 池子空了但任务没跑完 ⇒ 有环
        blocked = [n for n in tasks if n not in finished]
        raise RuntimeError(f"这些任务从未就绪（图中可能有环）：{blocked}")
    return finished


def make(name: str, cost: float):
    def job():
        time.sleep(cost)                              # 模拟一次真实的耗时步骤
        return f"{name} ok"
    return job


cost = {"fetch_docs": 0.1, "clean": 0.1, "embed": 0.3, "summary": 0.3, "index": 0.1}
tasks = {k: make(k, v) for k, v in cost.items()}
deps = {
    "clean": {"fetch_docs"},
    "embed": {"clean"},
    "summary": {"clean"},
    "index": {"embed", "summary"},
}
t0 = time.perf_counter()
print(run_dag(tasks, deps, workers=4))
print(f"并行耗时 {time.perf_counter() - t0:.2f}s，串行需要 {sum(cost.values()):.2f}s")
# ['fetch_docs', 'clean', 'embed', 'summary', 'index']   # embed / summary 并行，完成顺序不保证
# 并行耗时 0.62s，串行需要 0.90s
```

三个设计细节对应着三段常见的踩坑经历：**用 `wait(..., FIRST_COMPLETED)` 而不是轮询 `fut.done()`** ，否则 CPU 会空转在忙等上；**任务完成即刻解锁后继** ，而不是“整层跑完再开下一层”——按层同步时，同层最慢的那个任务会拖住下一层所有本可以开工的任务，只有把并行度换成“依赖满足即提交”才拿得到关键路径给出的那个下限；**收尾必须核对完成数** ，否则图里有环时调度器会静默少跑任务，比抛异常危险得多。

`embed` 和 `summary` 的入度同时归零，因此会被并行提交——这正是“按拓扑分层执行”的效果。同样的模型可以搬到 Agent 场景：把节点换成“检索 / 重排 / 生成 / 校验”，`deps` 就是提示词里写死的执行约束，而拓扑排序保证模型给出的步骤图能被可靠执行，也能在编译期就发现“步骤 A 引用了尚未产生的步骤 B 的输出”。

## 分层：拓扑序之外的信息

很多调度问题关心的不是“一个序列”，而是“有几层”：

```python
def topological_levels(deps: dict[str, set[str]]) -> list[list[str]]:
    """返回按依赖深度分层的任务列表，levels[0] 可立即执行"""
    indeg = {n: len(deps.get(n, set())) for n in deps}
    successors: dict[str, list[str]] = {n: [] for n in deps}
    for n, pre in deps.items():
        for p in pre:
            successors.setdefault(p, []).append(n)
    levels: list[list[str]] = []
    cur = [n for n, d in indeg.items() if d == 0]
    seen = len(cur)
    while cur:
        levels.append(sorted(cur))
        nxt = []
        for u in cur:
            for v in successors.get(u, []):
                indeg[v] -= 1
                if indeg[v] == 0:
                    nxt.append(v)
        seen += len(nxt)
        cur = nxt
    if seen != len(indeg):
        raise ValueError("图中存在循环依赖")
    return levels


print(topological_levels({
    "fetch_docs": set(), "clean": {"fetch_docs"},
    "embed": {"clean"}, "summary": {"clean"}, "index": {"embed", "summary"},
}))
# [['fetch_docs'], ['clean'], ['embed', 'summary'], ['index']]
```

层数就是关键路径长度的下界（假设每层内并行、每任务耗时相同），是估算流水线总耗时的第一手依据。要做**带权**的精确工期估算，只需把拓扑序上的计数换成一次动态规划：拓扑图里没有环，所以“最长路”这个在一般图上 NP-hard 的问题，在 DAG 上就是 O(V + E) 的线性扫描。

## 实战三：关键路径 = 拓扑序上的 DP

每个任务耗时不同（`embed` 3 分钟、`summary` 10 秒）时，端到端总耗时由**最长的那条依赖链**决定——这就是项目管理里的“关键路径”。它的求法和最短路径几乎一样，只把 `min` 换成 `max` ，并且只在拓扑序上推进：

```python
from collections import defaultdict, deque


def critical_path(dur: dict[str, float], deps: dict[str, list[str]]) -> tuple[float, list[str]]:
    """dur[name]：任务耗时；deps[name]：该任务的前置任务列表。
    返回 (端到端最短可能耗时, 关键路径上的任务序列)。"""
    indeg = {n: len(deps.get(n, [])) for n in dur}
    succ: dict[str, list[str]] = defaultdict(list)
    for n, pre in deps.items():
        for p in pre:
            succ[p].append(n)

    earliest: dict[str, float] = {}     # 该任务完成的时刻
    prev: dict[str, str | None] = {}    # 决定它完成时刻的那个前置（用于回溯路径）
    q = deque()
    for n, d in indeg.items():
        earliest[n] = dur[n]
        prev[n] = None
        if d == 0:
            q.append(n)

    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in succ[u]:
            # 松弛方向与最短路相反：取 max，得到“最早完成时刻”
            if earliest[u] + dur[v] > earliest[v]:
                earliest[v] = earliest[u] + dur[v]
                prev[v] = u
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(order) != len(dur):
        raise ValueError("图中存在环，无法求关键路径")

    end = max(earliest, key=earliest.get)      # 最晚完成的任务就是终点
    path = []
    while end is not None:
        path.append(end)
        end = prev[end]
    return max(earliest.values()), path[::-1]


dur = {"fetch": 1.0, "clean": 2.0, "embed": 3.0, "summary": 1.0, "index": 1.5, "eval": 0.5}
deps = {"clean": ["fetch"], "embed": ["clean"], "summary": ["clean"],
        "index": ["embed", "summary"], "eval": ["index"]}
print(critical_path(dur, deps))
# (8.0, ['fetch', 'clean', 'embed', 'index', 'eval'])
```

`summary` 那一路只花 1 秒，因此不在关键路径上——它有多少松弛时间（slack），运维就敢在它身上省多少算力。这个模型对 LLM 流水线同样直接：把 `embed` 换成“向量化 20 万篇文档”，把 `index` 换成“重建 HNSW 索引”，就能算出“改一次清洗规则最少要等多久才能看到新索引”，进而决定哪些环节值得增量执行。若还想量化“这一步并行度够不够”，要加上资源约束，那已经不是纯拓扑问题（列表调度是 NP-hard ），一般用启发式 + 实测。

## 常见坑

1. **只给拓扑序，不给“为什么这个顺序”**。日志里一定要同时打印入度变化或分层结果，否则排查依赖配置错误极其痛苦。
2. **忘了把“只有入边、没有出边”的顶点放进图**。手写版里必须用 `setdefault` 补齐这些顶点，否则它们永远不会出现在结果里；`TopologicalSorter` 会自动处理。
3. **环的信息要能读**。`CycleError.args[1]` 直接给出环路径，而自己写的 Kahn 版本要显式抛出剩余顶点列表，只返回“排序失败”等于没报错。
4. **别在遍历图的同时修改图**。调度系统常在任务完成时动态加边，Kahn 支持（新顶点入度非 0 就排队），`TopologicalSorter` 则要求 `prepare()` 之后不再改动。
5. **拓扑序不是最优执行序**。它只保证依赖合法，不考虑耗时与资源。要评估真实总耗时至少要按“实战三”的关键路径算；要进一步压缩则是带资源约束的列表调度问题（NP-hard ），靠启发式加实测。
6. **字符串拓扑序不保证稳定**。`dict` 保持插入序，但 `set` 不保持任何序；如果希望两次运行输出一致，把 `deps` 的值换成有序结构（`list` 或排序后的结果）。本文示例里 `graphlib` 用 `set` 声明依赖，输出顺序只对“依赖关系”成立，不要拿字符串序列去做 diff 断言。
7. **“有环”不一定是错误，Agent 图常常需要环**。重试、人在环审批、反思循环都会画出 `生成 → 校验 → 生成` 。这时不要指望拓扑排序给你一个序，而要把环显式拆成 DAG：给环设最大迭代次数，把每一轮展开成 `生成#1 → 校验#1 → 生成#2` 这样的分层实例，再排序；或者把循环边界交给框架（LangGraph 的 `recursion_limit`、Airflow 的 `max_active_runs` + 重跑策略）处理。工程上更稳的划分是：**“一次运行的展开图”用拓扑序执行，“跨运行的循环”交给状态机**。

## 延伸阅读

- Python 官方文档 [graphlib —— 提供 Python 风格的拓扑排序功能](https://docs.python.org/zh-cn/3/library/graphlib.html)：`TopologicalSorter` 的完整语义与线程安全性说明。
- 《图》《图的遍历（DFS/BFS）》：邻接表、访问标记与遍历框架。
- 《最短路径与 NetworkX 实践》：拓扑排序只处理“无环 + 无权”，带权路径要换成最短/最长路算法。
- 《并查集与等价类归并》：与拓扑排序互补，用于无向图的连通性判断。
- 《Python 算法工具箱：heapq、bisect、graphlib 与 collections》：`graphlib` 与 `heapq` 的选型对照，以及 `static_order()` / `get_ready()` 的适用边界。
- 《Dify 工作流引擎源码解析——节点编排、变量系统与沙箱执行》：一份真实编排层怎么处理节点状态与依赖。
- 《LangGraph 入门：用 Graph API 与 Functional API 构建你的第一个智能体》：图式 Agent 编排里“合法图”的判定与循环处理。

---

> **来源**：抓取于 2026-09-19。`graphlib.TopologicalSorter` 的用法与语义依据 [Python 官方文档 graphlib 章节](https://docs.python.org/zh-cn/3/library/graphlib.html)（Python Software Foundation，PSF License 2.0）；“排课”例子与两张示意图取自 [OI Wiki《拓扑排序》](https://oi-wiki.org/graph/topo/)（OI Wiki 项目，CC BY-SA 4.0，原图已下载至本模块 `assets/` 目录）。原文的 C++ 实现、链式前向星写法与竞赛习题未收录；Kahn / DFS / 分层 / 关键路径 / 并行调度器与工作流校验代码、两条正确性证明以及全部中文说明均为本站编写，已在 CPython 3.12/3.14 下运行验证。
