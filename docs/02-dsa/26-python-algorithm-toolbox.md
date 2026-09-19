---
title: Python 算法工具箱：heapq、bisect、graphlib 与 collections
source_url: https://docs.python.org/zh-cn/3/library/heapq.html
author: 本站整理；参考 Python 官方文档 heapq / bisect / collections / graphlib / itertools / functools
license: PSF License 2.0
fetched_at: 2026-09-19
translated: true
versions: Python 3.12（`itertools.batched` 需 3.12+，其余模块 3.9+ 均可用）
order: 26
group: 查找、排序与数组技巧
---
## 为什么要先查标准库

> **难度**：★★☆（清单类，随查随用）。
> **定位**：本篇不是新算法，而是一张“标准库索引”。写算法题或做检索系统之前先查一遍，能省掉大量手写代码。
> **前置**：《堆》《二分查找》《哈希表》《拓扑排序与依赖调度》。数据结构原理在那几篇里，这里只讲怎么把标准库用对。


排序、堆、二分、计数、图依赖，这些问题的正确实现需要处理一堆边界条件。标准库版本经过长期测试、由 C 实现（`_heapq`、`_bisect` 、`collections.deque` 都是 C 扩展），比手写纯 Python 快数倍。本站其他文章里出现的手写实现是为了讲清原理，**生产代码应当优先用这里列出的接口**。

一张速查表：

| 我要做什么 | 用什么 | 复杂度 |
| ---------- | ------ | ------ |
| 取最大/最小的 k 个 | `heapq.nlargest` / `nsmallest` | O(n log k) |
| 持续维护“当前最小” | `heapq.heappush` / `heappop` | O(log n) |
| 多路有序流合并 | `heapq.merge` | 惰性，O(log m) 每元素 |
| 优先队列 / 任务调度 | `queue.PriorityQueue`（线程安全）或 `heapq` | O(log n) |
| 有序数组里找位置 / 保持有序插入 | `bisect.bisect_left` / `insort` | 查找 O(log n)，插入 O(n) |
| 统计频次、求 Top 词 | `collections.Counter` | O(n) |
| 分组、按 key 累加 | `collections.defaultdict` | O(n) |
| 两端增删、BFS、滑动窗口 | `collections.deque` | 两端 O(1) |
| 一次性视图叠加（配置层叠） | `collections.ChainMap` | 查找 O(层数) |
| 前缀和、前缀最大值、分组迭代 | `itertools.accumulate` / `groupby` | O(n) |
| 按大小分批处理 | `itertools.batched`（3.12+） | O(n) |
| 记忆化 / LRU | `functools.cache` / `lru_cache` | 命中 O(1) |
| 只读实例属性懒算 | `functools.cached_property` | 首次 O(1) 之后 O(1) |
| 依赖图执行顺序、查环 | `graphlib.TopologicalSorter` | O(V + E) |
| 稳定排序、多级排序 | `sorted(iterable, key=...)` | O(n log n) |

## heapq：小顶堆与 Top-K

`heapq` 只提供**小顶堆**，直接把列表当堆用：

```python
import heapq

heap: list[tuple[float, str]] = []
heapq.heappush(heap, (0.42, "doc-a"))
heapq.heappush(heap, (0.11, "doc-b"))
heapq.heappush(heap, (0.99, "doc-c"))
print(heapq.heappop(heap))     # (0.11, 'doc-b')  弹出最小
print(heap)                    # [(0.42, 'doc-a'), (0.99, 'doc-c')]

# 由已有列表建堆：O(n)，比逐个 heappush 的 O(n log n) 快
nums = [5, 2, 8, 1, 9]
heapq.heapify(nums)            # 原地整理成堆
print(nums[0])                 # 1，堆顶一定是最小值，但其余位置无序
```

要模拟大顶堆，三种办法按优先级排列：取负键（数值型）、`(优先级, 递增序号, 对象)` 三元组（对象不可比较时的标准做法）、或 `functools.total_ordering` 自定义比较。**元组比较是最常踩的坑**：分数相同时 Python 会继续比第二个元素，若第二个元素是不可比较的自定义对象就会抛 `TypeError` ，所以固定加一个自增计数器：

```python
import heapq
import itertools


class PriorityQueue:
    """按优先级出队；分数相同则先到先出"""

    def __init__(self):
        self._heap: list[tuple[float, int, object]] = []
        self._count = itertools.count()  # 单调递增序号，保证元组第二位永不平手

    def put(self, item, priority: float) -> None:
        heapq.heappush(self._heap, (-priority, next(self._count), item))  # 取负 → 大顶

    def get(self):
        return heapq.heappop(self._heap)[2]


q = PriorityQueue()
q.put("低优先级", 1)
q.put("高优先级", 9)
q.put("中优先级", 5)
print(q.get(), q.get())  # 高优先级 中优先级
```

**Top-K 一律用 `nlargest` / `nsmallest` ，不要 `sorted(...)[:k]`** ：前者 O(n log k) 且只用 O(k) 额外内存，后者 O(n log n) 且拷贝整个列表。k 很小（远小于 n）时差距巨大，k 接近 n 时两者相当。详细的召回重排用法见《Top-K 与堆：召回重排里的取前 N 个》。

`heapq.merge` 是**惰性的多路归并**，天生适合“多个已排序的大文件/生成器合并取前 N 个”：

```python
import heapq

a = iter([1, 4, 7, 10, 13])          # 已排序的流
b = iter([2, 3, 5, 8, 11])
c = iter([0, 6, 9, 12])
from itertools import islice

top5 = list(islice(heapq.merge(a, b, c), 5))   # 只消费前 5 个元素
print(top5)                          # [0, 1, 2, 3, 4]
```

`heapq` 还贴心地提供了 `heappushpop`（先压后弹）和 `heapreplace`（先弹后压），二者都只走一次堆调整，比分两步快，容量固定的 Top-K 里必须用它们。

## bisect：有序数组的查找与插入

`bisect` 作用在**已经有序**的列表上：

```python
import bisect

scores = [55, 60, 60, 70, 80, 95]
print(bisect.bisect_left(scores, 60))    # 1  第一个 >= 60 的位置
print(bisect.bisect_right(scores, 60))   # 3  第一个 > 60 的位置
print(bisect.bisect_right(scores, 60) - bisect.bisect_left(scores, 60))  # 2，等于 60 的个数

# 保持列表有序地插入：O(log n) 查找 + O(n) 挪动
bisect.insort(scores, 62)
print(scores)  # [55, 60, 60, 62, 70, 80, 95]

# 值分档：“阈值表 + 一次二分”，比一串 if-elif 好维护
def grade(x: int) -> str:
    bounds = [60, 70, 80, 90]     # 升序阈值表
    return "FDCBA"[bisect.bisect_right(bounds, x)]


print(grade(59), grade(60), grade(95))   # F D A
```

三个高频用法：

1. **区间命中**：时间戳排序后，`bisect_left(ts, t)` 给出“早于 t 的条数”，两两次二分即得区间计数，比线性扫描快得多。
2. **前缀范围查询**：所有键排序后，以 `prefix` 开头的键必然连续，用 `bisect_left(prefix)` 与 `bisect_left(prefix + "\uffff")` 框出区间，这是 Trie 的省内存替代品（见《Trie 前缀树（字典树）》）。
3. **单调性二分答案**：`bisect` 支持 `key=` （3.10+）与 `lo/hi` ，可以在“前缀和数组”上直接二分，见《前缀和与差分》的 token 预算例子。

**注意 `insort` 的 O(n) 挪动成本**：十万级元素频繁插入时，Python 列表不合适，应换成跳表、`sortedcontainers.SortedList` （第三方，BSD）或改为“批量累积 + 定期整体排序”。

## collections：四个最值的容器

### Counter：计数与 Top 词

```python
from collections import Counter

tokens = ["模型", "检索", "模型", "模型", "重排", "检索"]
c = Counter(tokens)
print(c.most_common(2))          # [('模型', 3), ('检索', 2)]
print(c["不存在"])                # 0，而不是 KeyError
c.subtract(["模型"])
print(c["模型"])                  # 2

# 词频向量 + 余弦相似度的最小实现
def cosine(a: Counter, b: Counter) -> float:
    common = set(a) & set(b)
    dot = sum(a[k] * b[k] for k in common)
    na = sum(v * v for v in a.values()) ** 0.5
    nb = sum(v * v for v in b.values()) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


print(round(cosine(Counter("aab"), Counter("abb")), 3))  # 0.8
```

`Counter` 的 `&` / `|` 分别取交集（最小值）与并集（最大值），`elements()` 可按计数展开；它继承 `dict` ，**不要用 `Counter` 当高频读的性能热点**，纯查表用普通 `dict` 更快一点。计数用 `Counter.update(iterable)` 是 O(n) ，且 `most_common` 内部用堆（O(n + k log n)）。

### defaultdict：省掉 key 初始化

```python
from collections import defaultdict

graph: dict[str, list[str]] = defaultdict(list)          # 邻接表
depth: dict[str, int] = defaultdict(lambda: -1)          # 自定义初值
for u, v in [("a", "b"), ("b", "c"), ("a", "c")]:
    graph[u].append(v)
print(dict(graph))  # {'a': ['b', 'c'], 'b': ['c']}

# 二级嵌套：defaultdict 工厂必须用 lambda 之外的显式函数才好看懂
def new_counter():
    return defaultdict(int)


totals: dict[str, dict[str, int]] = defaultdict(new_counter)
totals["2026-09"]["gpt-5"] += 1200
print(totals["2026-09"]["gpt-5"])   # 1200
```

**`defaultdict` 的读操作会产生写入**：`if totals["typo_key"]["x"]` 会把 `typo_key` 静默加进字典。这是排查“字典里莫名多出一堆键”的头号原因；只读场景请写 `totals.get("typo_key", {})` 。

### deque：双端队列

```python
from collections import deque

dq = deque([1, 2, 3], maxlen=4)   # maxlen 天然实现“有界窗口”
dq.appendleft(0)                  # [0, 1, 2, 3]
dq.append(4)                      # 已满，从左端挤出 0
print(list(dq), dq.maxlen)        # [1, 2, 3, 4] 4
dq.rotate(1)                      # 循环右移一位，O(1)
print(list(dq))                   # [4, 1, 2, 3]

# 滑动窗口最大值：单调队列，每个元素至多进出一次 -> 总 O(n)
def sliding_max(nums: list[int], k: int) -> list[int]:
    idx = deque()
    res: list[int] = []
    for i, x in enumerate(nums):
        while idx and nums[idx[-1]] <= x:   # 维护递减队列
            idx.pop()
        idx.append(i)
        if idx[0] <= i - k:                 # 队首滑出窗口
            idx.popleft()
        if i >= k - 1:
            res.append(nums[idx[0]])        # 队首即窗口最大值
    return res


print(sliding_max([1, 3, -1, -3, 5, 3, 6, 7], 3))  # [3, 3, 5, 5, 6, 7]
```

`deque` 两端 O(1) 、`list` 头部 `pop(0)` 是 O(n) ——**用 `list` 做队列是最常见的性能 bug** 。但 `deque[i]` 索引是 O(n) ，需要随机访问时不要用它。

### ChainMap：配置层叠

```python
from collections import ChainMap
import os

config = ChainMap({"model": "gpt-5"}, os.environ, {"model": "default", "timeout": 30})
print(config["model"], config["timeout"])   # gpt-5 30
print(len(config.maps), config.maps[1] is os.environ)  # 3 True，maps 即层叠顺序
```

ChainMap 是“视图”而非拷贝，改上层即改底层字典，适合实现“参数 > 环境变量 > 默认值”的读取顺序。

## graphlib：拓扑排序

详细用法见《拓扑排序与依赖调度》，这里只给最小示例，提醒它已是标准库：

```python
from graphlib import TopologicalSorter

# add(node, *前置依赖)：embed 依赖 clean
order = TopologicalSorter({"embed": {"clean"}, "clean": {"fetch"}, "fetch": set()})
print(list(order.static_order()))  # ['fetch', 'clean', 'embed']
```

## functools 与 itertools

```python
from functools import cache, cached_property
from itertools import accumulate, groupby, batched, islice


@cache                                    # 等价于 lru_cache(maxsize=None)
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)


print(fib(200))                           # 1 个调用式记忆化，瞬间返回


class Embedding:
    def __init__(self, path: str):
        self.path = path

    @cached_property
    def dim(self) -> int:                  # 只算一次，之后当普通属性
        return 1536


# 前缀和 / 前缀最大值
print(list(accumulate([3, 1, 4, 1, 5], initial=0)))       # [0, 3, 4, 8, 9, 14]
print(list(accumulate([3, 1, 4, 1, 5], max)))             # [3, 3, 4, 4, 5]

# groupby 必须先排序！否则同名会被拆成多段
words = ["apple", "avocado", "banana", "blueberry"]
for first, grp in groupby(sorted(words), key=lambda w: w[0]):
    print(first, list(grp))                               # a [...] b [...]

# 按固定大小分批处理（3.12+），比手写切片索引干净
for batch in batched(range(10), 3):
    print(list(batch))                                     # [0,1,2] [3,4,5] [6,7,8] [9]

# 只取前 k 个而不完全消费无限生成器
print(list(islice(iter(range(10**9)), 3)))                 # [0, 1, 2]
```

`groupby` 的坑值得单独强调：它按“**相邻**”分组，`groupby(data)` 之前几乎总要先 `sorted(data, key=...)` ，且排序 key 必须与分组 key 完全一致，否则结果静默错误。

## 选型与迁移建议

- 需要**线程安全**的优先队列用 `queue.PriorityQueue` ，纯单线程性能用 `heapq` 。
- 需要“有序 + 可变”的集合（区间调度、排行榜）标准库没有，考虑 `sortedcontainers` （BSD-3-Clause ）。
- 大规模数值 Top-K / 相似度计算，`numpy.argpartition` 比 `heapq` 快一个量级以上，见《向量相似度与 HNSW 近邻图》。
- 记忆化：纯函数用 `cache` ；需要上界与淘汰用 `lru_cache(maxsize=...)` ；实例方法上要用 `cached_property` 或在类上挂 `functools.lru_cache` （否则 `self` 进入缓存键会造成对象泄漏）。

## 常见坑

1. **`heapq` 不保证列表整体有序**，只有 `heap[0]` 是最值。直接 `print(heap)` 看到“乱序”不是 bug 。
2. **元组堆的比较级联**，见上文 `PriorityQueue` 的序号解法。
3. **`bisect` 要求严格有序**。列表一旦被 `append` 破坏顺序，二分结果错误且不报错；用 `insort` 维护。
4. **`defaultdict` 读时写**、**`groupby` 要先排序**、**`list.pop(0)` 是 O(n)** ——这三条能解决八成的“代码看着对但结果/性能不对”。
5. **`cache` / `lru_cache` 缓存的是参数对象**，传入大列表或自定义对象会长期占内存；对不可哈希参数需先转 `tuple` ，或改用手写字典。
6. **`functools.lru_cache` 在实例方法上用会隐式缓存 `self`** ，导致对象无法回收，正确做法是 `cached_property` 或把缓存下沉到静态函数。

## 延伸阅读

- Python 官方文档：`heapq`（含 `merge`、`nlargest` 复杂度说明）、`bisect`（“Notes”一节讲插入成本）、`collections`（含 `deque` 复杂度表）、`graphlib`、`itertools` 的 “Itertools Recipes” 。
- 《Top-K 与堆：召回重排里的取前 N 个》《向量相似度与 HNSW 近邻图》《布隆过滤器与集合去重》：本工具箱在检索系统里的三个实战场景。

---

> **来源**：抓取于 2026-09-19。本文全部接口签名与复杂度结论依据 Python 官方文档（[heapq](https://docs.python.org/zh-cn/3/library/heapq.html)、[bisect](https://docs.python.org/zh-cn/3/library/bisect.html)、[collections](https://docs.python.org/zh-cn/3/library/collections.html)、[graphlib](https://docs.python.org/zh-cn/3/library/graphlib.html)、[itertools](https://docs.python.org/zh-cn/3/library/itertools.html)、[functools](https://docs.python.org/zh-cn/3/library/functools.html)；Python Software Foundation，PSF License 2.0）整理，正文与示例代码为本站编写，已在 Python 3.12 下运行验证；`deque` 的 `maxlen` 示例输出依赖淘汰顺序，实际运行结果以本机为准。
