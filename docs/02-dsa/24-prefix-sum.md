---
title: 前缀和与差分
source_url: https://raw.githubusercontent.com/doocs/leetcode/main/solution/0300-0399/0303.Range%20Sum%20Query%20-%20Immutable/README.md
author: 本站整理；参考 doocs/leetcode、Python itertools 官方文档
license: CC BY-SA 4.0（doocs/leetcode 题面）；PSF License 2.0（Python 文档）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（标准库，无第三方依赖）
order: 24
group: 查找、排序与数组技巧
---
## 为什么需要前缀和

> **难度**：★★☆。前缀和是“O(1) 换 O(n)”的最典型例子，差分是它在“批量更新”方向的镜像。
> **适合**：要做区间统计、窗口聚合、批量加权、时间序列分析的读者。
> **前置**：《数组》《二分查找》。本篇会用到 `itertools.accumulate` 与 `bisect` ，后者在《Python 算法工具箱：heapq、bisect、graphlib 与 collections》里有完整索引。


“求第 100 到第 500 个元素的和”——直接 `sum(a[100:501])` 每次都要 O(n) 。如果这种查询有 q 次，总代价就是 O(nq) 。而在真实系统里，这种“区间统计 + 高频查询”的组合非常常见：

- 对话日志里统计任意时间段的 token 消耗、请求数、成本。
- RAG 中按 chunk 切分上下文：给定 token 预算，快速定位“能塞进窗口的第 1 到第 k 个片段”。
- 监控指标做滑动窗口聚合（均值、分位数计数、命中率）。
- 一维/二维图像或网格的区域求和（积分图，integral image）。
- 配合二分查找做“前缀和 + 单调性”的二分答案（数组非负时，前缀和单调递增）。

前缀和的核心是一句非常朴素的话：**把“区间和”变成“两个前缀差”**。一次 O(n) 预处理，换 q 次 O(1) 查询。

## 一维前缀和

定义 `pre[i] = a[0] + a[1] + … + a[i-1]` （即 `pre[i]` 是前 i 个元素之和，`pre[0] = 0` ）。于是：

**区间 [l, r] 的和 = pre[r + 1] - pre[l]**

这个定义刻意把 `pre[0] = 0` 放进去，是为了让“从 0 开始的区间”不必特判——这是消除 off-by-one 的唯一有效手段。

```python
from itertools import accumulate

a = [3, -1, 4, 1, 5, 9, 2, 6]

# initial=0 让前缀和数组长度为 n+1，pre[0] == 0
pre = list(accumulate(a, initial=0))


def range_sum(l: int, r: int) -> int:
    """闭区间 [l, r] 的和，O(1)"""
    return pre[r + 1] - pre[l]


print(pre)                    # [0, 3, 2, 6, 7, 12, 21, 23, 29]
print(range_sum(0, 2))        # 6
print(range_sum(2, 5))        # 19
print(range_sum(0, len(a) - 1))  # 29，等于 sum(a)
```

如果不想依赖 `initial` 参数（Python 3.8 之前的写法），手工构造等价：

```python
a = [3, -1, 4, 1, 5, 9, 2, 6]
pre = [0] * (len(a) + 1)
for i, x in enumerate(a):
    pre[i + 1] = pre[i] + x   # 递推式：pre[i+1] = pre[i] + a[i]
```

> **【题面】LeetCode 303. 区域和检索 - 数组不可变**（doocs/leetcode，CC BY-SA 4.0）：给定整数数组 `nums` ，实现 `NumArray` 类，`sumRange(left, right)` 返回索引 left 到 right（含两端）之间元素的总和。多次调用同一实例。

把它写成类，就是最常见的面试形态：

```python
from itertools import accumulate


class NumArray:
    """前缀和：构造 O(n) ，单次查询 O(1)"""

    def __init__(self, nums: list[int]):
        self.pre = list(accumulate(nums, initial=0))

    def sum_range(self, left: int, right: int) -> int:
        return self.pre[right + 1] - self.pre[left]


qa = NumArray([-2, 0, 3, -5, 2, -1])
print(qa.sum_range(0, 2), qa.sum_range(2, 5), qa.sum_range(0, 5))  # 1 -1 -3
```

**注意“不可变”这个前提**：一旦中间某个元素被改，整段后缀的前缀和都失效，此时要么重建（O(n) ），要么换数据结构——树状数组（Fenwick Tree）或线段树能把单点更新与区间查询都做进 O(log n) ，本文后文给了树状数组的完整实现。

## 二维前缀和（积分图）

网格上任意子矩形求和，是图像与统计里的基础操作。定义 `pre[i][j]` 为“左上角到 (i-1, j-1) 这个矩形内所有元素之和”，则容斥关系为：

**pre[i][j] = pre[i-1][j] + pre[i][j-1] - pre[i-1][j-1] + grid[i-1][j-1]**

查询时同理：

**矩形 (r1,c1)~(r2,c2) 的和 = pre[r2+1][c2+1] - pre[r1][c2+1] - pre[r2+1][c1] + pre[r1][c1]**

```python
def build_prefix2d(grid: list[list[int]]) -> list[list[int]]:
    n, m = len(grid), len(grid[0])
    pre = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n):
        for j in range(m):
            pre[i + 1][j + 1] = pre[i][j + 1] + pre[i + 1][j] - pre[i][j] + grid[i][j]
    return pre


def rect_sum(pre: list[list[int]], r1: int, c1: int, r2: int, c2: int) -> int:
    """闭区间矩形 (r1,c1)~(r2,c2) 的和"""
    return pre[r2 + 1][c2 + 1] - pre[r1][c2 + 1] - pre[r2 + 1][c1] + pre[r1][c1]


grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
pre = build_prefix2d(grid)
print(rect_sum(pre, 1, 1, 2, 2))  # 5+6+8+9 = 28
print(rect_sum(pre, 0, 0, 2, 2))  # 45，全网格
```

记忆方法：**构造时“右上相加、左上多算了一次要减”；查询时“整个右上减去上下两块，减重了左上要加回来”**。两次都是同一个容斥式，只是方向相反。

下面这张图把容斥关系画了出来（OI Wiki 原图）：设 `S` 是矩阵 `A` 的二维前缀和，则 `S[3][3]` 是虚线框内整个子矩阵的和。`S[3][2]` 是蓝色矩形的和、`S[2][3]` 是红色矩形的和，两者重叠的部分恰好是 `S[2][2]` 。于是直接相加会把 `S[2][2]` 算两遍，必须减掉一次：

**S[3][3] = A[3][3] + S[2][3] + S[3][2] - S[2][2] = 5 + 18 + 15 - 9 = 29**

![二维前缀和的容斥关系（OI Wiki 原图）](assets/oi_basic__prefix-sum-2d.svg)

把这张图记牢，二维前缀和的查询式就不用手推了：**查询右下角 `(r2,c2)` 、左上角 `(r1,c1)` 的矩形时，要的是“大矩形减去上边那条、减去左边那条，再把被减了两次的左上角补回来”** 。工程上真正会用到它的场景比想象中多：图像里的区域积分、混淆矩阵分片统计、以及“按（日期 × 渠道）两个维度做累计”的报表——只要查询形式是轴对齐矩形、且矩阵不常改动，二维前缀和就是 O(1) 的答案。

## 差分：前缀和的逆运算

前缀和擅长“多次查询、单次构建”；差分擅长它的对偶问题——**多次区间批量加、最后一次性统计**。

给区间 [l, r] 全体加 v ，若老老实实循环就是 O(r - l + 1) 。差分数组 `d` 满足 `a[i] = d[0] + … + d[i]` （即 a 是 d 的前缀和），于是区间加法只需要改两个点：

**d[l] += v；d[r + 1] -= v**

```python
from itertools import accumulate


def difference_array(n: int) -> list[int]:
    d = [0] * (n + 1)  # 多开一位，避免 r+1 越界

    def add(l: int, r: int, v: int) -> None:
        d[l] += v
        d[r + 1] -= v  # 越界部分靠多开的一位吞掉

    add(1, 3, 2)   # a 变为 [0, 2, 2, 2, 0, 0]
    add(2, 5, 1)   # a 变为 [0, 2, 3, 3, 1, 1]
    add(0, 0, 5)   # a 变为 [5, 2, 3, 3, 1, 1]
    # 最后做一次前缀和，才还原出真实数组
    return list(accumulate(d[:n]))


print(difference_array(6))  # [5, 2, 3, 3, 1, 1]
```

注意 `d` 里的中间值是 `[5, -3, 1, 0, -2, 0, -1]` ，完全不像真实数据——**差分只是“批量加”的记账本，必须再做一次前缀和才能看到结果**，忘记这一步是差分最常见的错误。另外 `add(2, 5, 1)` 会写 `d[6]` ，这正是数组要多开一位的原因：右端点落在数组末尾时不会越界，多余的一位在还原时被自然丢弃。

### 差分应用：并发峰值与区间重叠

“一批任务的起止时间，求最大并发数”，用差分 + 扫描线，比两两比较干净得多：

```python
def max_concurrent(intervals: list[tuple[int, int]]) -> int:
    """intervals：每个 (start, end) 表示占用的时间范围，返回峰值并发数"""
    events: dict[int, int] = {}
    for s, e in intervals:
        events[s] = events.get(s, 0) + 1  # 差分：进入时刻 +1
        events[e] = events.get(e, 0) - 1  # 离开时刻 -1（右端开区间）
    cur = peak = 0
    for _, delta in sorted(events.items()):  # 按时间排序即扫描线
        cur += delta
        peak = max(peak, cur)
    return peak


# 例如 LLM 网关：每个请求的 [开始, 结束] 时间戳，求峰值并发以定 semaphore 上限
print(max_concurrent([(0, 5), (1, 3), (2, 8), (7, 9)]))  # 3
```

同一套模板可以直接改造成：会议室最少数量、每个时间点的配额占用、以及“给某时间段内所有分片加权”的批量操作。

## 树状数组：能被修改的前缀和

前缀和的死穴是“改一个点要重建整段后缀”。工程上常见的应对不是每次都 O(n) 重建，而是换一棵**能同时支持单点加与区间查** 的结构：树状数组（Fenwick Tree）。它把 `pre` 拆成若干长度为 `lowbit(i)` 的段，每段负责一小截连续区间，于是查前缀和只需要沿 `i -= i & -i` 跳 O(log n) 步。

```python
class Fenwick:
    """树状数组：单点加 + 前缀和查询都是 O(log n)"""

    def __init__(self, n: int):
        self.n = n
        self.bit = [0.0] * (n + 1)     # 对外 0-based，对内 1-based

    def add(self, i: int, delta: float) -> None:
        """把 a[i] 加上 delta"""
        i += 1                          # 转成 1-based
        while i <= self.n:
            self.bit[i] += delta
            i += i & -i                 # 跳到下一个覆盖到 i 的区间

    def prefix(self, i: int) -> float:
        """前 i 个元素之和（即 a[0..i-1]），i 取 0..n"""
        s = 0.0
        while i:
            s += self.bit[i]
            i -= i & -i                 # 抹掉最低位的 1，向左跳
        return s

    def range_sum(self, l: int, r: int) -> float:
        """闭区间 [l, r] 的和"""
        return self.prefix(r + 1) - self.prefix(l)


bit = Fenwick(5)
for i, x in enumerate([10, 20, 30, 40, 50]):
    bit.add(i, x)
print(bit.range_sum(1, 3))              # 90.0
bit.add(2, 5)                            # 第 3 个元素 +5，只花 O(log n)
print(bit.range_sum(1, 3), bit.prefix(5))   # 95.0 155.0
```

`i & -i` 取的是二进制最低位的 1 ，这一行决定了整棵树的形状，也是它比线段树短一半的原因。什么时候该从 `accumulate` 升级到它？判据只有一条：**是否存在“先改后查”或“边改边查”** 。比如实时统计每个分片被引用次数（每次召回都 `add` 一次、定时查 Top 区间），或者边写日志边累计 token 消耗——用普通前缀和就得每次重建，用 `dict` 累加又拿不到区间和，树状数组刚好卡在中间。若还要支持区间加、区间查，把它套两层或改用线段树（`sortedcontainers` 之类第三方库除外，标准库没有现成实现）。

## 应用一：Token 计数与成本核算

会话日志天然是一个“每条消息 token 数”的数组，而业务侧的问法几乎全是区间式的：这一段对话花了多少 token？第 i 轮到第 j 轮之间累计输入多少？给定预算能回放到第几轮？这就是前缀和的标准地形。

```python
from bisect import bisect_right
from itertools import accumulate


class ConversationLedger:
    """一次会话的 token 账本：建一次，查多次"""

    def __init__(self, turn_tokens: list[int]):
        self.turns = turn_tokens
        # pre[i] = 前 i 轮（不含第 i 轮）的累计 token 数，pre[0] = 0
        self.pre = list(accumulate(turn_tokens, initial=0))

    def between(self, l: int, r: int) -> int:
        """第 l 轮到第 r 轮（含两端）的 token 总数，O(1)"""
        return self.pre[r + 1] - self.pre[l]

    def total(self) -> int:
        return self.pre[-1]

    def fits(self, budget: int) -> int:
        """从最早一轮开始，最多能保留多少轮而不超预算。
        token 数非负 => pre 单调不减 => 可以二分"""
        return bisect_right(self.pre, budget) - 1


ledger = ConversationLedger([1200, 300, 950, 2100, 480, 1600])
print(ledger.between(1, 3))          # 3350
print(ledger.total())                 # 6630
print(ledger.fits(2500))              # 3：前 3 轮共 2450，再加第 4 轮就超
print(ledger.fits(6630))              # 6：刚好全放
```

`fits()` 里那句“非负 ⇒ 单调 ⇒ 可以二分”是本文最值钱的一步推理：它把“遍历累加直到超预算”的 O(n) 变成 O(log n) 。当数组含负数时这个前提就不成立了（比如把“省下的 token”记成负值），那时老老实实线性扫描，或者改用《双指针与滑动窗口》里的收缩式窗口。

固定窗口的滑动统计则完全不必二分——**定长窗口 + 前缀和就是 O(1) 一次** ：

```python
from itertools import accumulate


def window_usage(turn_tokens: list[int], window: int) -> list[tuple[int, int]]:
    """返回每个起点 i 上、长度为 window 的区间 token 和（尾部不足则取到末尾）"""
    pre = list(accumulate(turn_tokens, initial=0))
    n = len(turn_tokens)
    return [(i, pre[min(i + window, n)] - pre[i]) for i in range(n)]


print(window_usage([1200, 300, 950, 2100, 480, 1600], 3))
# [(0, 2450), (1, 3350), (2, 3530), (3, 4180), (4, 2080), (5, 1600)]
```

这套账算清楚之后，才能把《成本与 Token 优化：Prompt Caching 与 Batch API》里的“命中率、可省比例”落到具体数字上。

## 应用二：分块边界——按 token 预算决定装几个片段

RAG 拼装 prompt 时，常要回答“从第几个 chunk 开始、连续最多 k 个片段的 token 数不超过预算”。这正是**前缀和 + 二分**的组合：各片段 token 数非负 ⇒ 前缀和单调递增 ⇒ 可以二分。

```python
import bisect
from itertools import accumulate


def fit_chunks(chunk_tokens: list[int], start: int, budget: int) -> int:
    """从 start 出发，最多能装下多少个完整片段（不含 start 之前已被裁掉的部分）"""
    pre = list(accumulate(chunk_tokens, initial=0))
    limit = pre[start] + budget          # 允许的后缀和上界
    # bisect_right 返回第一个 > limit 的位置，减 1 即可在区间的右端点
    end = bisect.bisect_right(pre, limit, lo=start) - 1
    return max(end - start, 0)


tokens = [300, 1200, 800, 450, 900, 1500, 200]
print(fit_chunks(tokens, 1, 2000))  # 2：1200 + 800 刚好，再加 450 就超
print(fit_chunks(tokens, 1, 2500))  # 3
```

把 `pre` 在语料入库时算一次并缓存，每次拼装 prompt 就是 O(log n) ；否则每个请求重算前缀和，就变成了 O(n) 的隐藏成本。

## 应用三：批量统计——给一段分片整体加权

反馈、点击、引用这类事件是“作用在一批分片上”的：某条用户好评覆盖了第 2 到第 7 个片段，某次检索命中了第 0 到第 3 个片段。要统计“每个分片被加权了多少次”，直接对每条操作遍历它的区间是 O(操作数 × 区间长度) ，而差分把它压成 O(操作数 + 分片数) ：每次只在两端记一笔账，最后做一次前缀和收账。

```python
from itertools import accumulate


def boost_chunks(n: int, boosts: list[tuple[int, int, float]]) -> list[float]:
    """n：分片总数；boosts：一批 (l, r, weight) 闭区间加权操作。
    返回每个分片累计到的权重。"""
    d = [0.0] * (n + 1)
    for l, r, w in boosts:
        d[l] += w
        d[r + 1] -= w       # 右端点落在末尾时，多开的一位把越界写入吞掉
    return list(accumulate(d[:n]))


print(boost_chunks(6, [(0, 2, 1.0), (1, 5, 0.5), (4, 5, 2.0)]))
# [1.0, 1.5, 1.5, 0.5, 2.5, 2.5]
```

拿到这组权重后，“哪些分片该留在语料里、哪些从来没被加分过”就是一个 Top-K 问题，接《Top-K 与堆：召回重排里的取前 N 个》继续做。注意差分只在**所有更新做完之后**才出结果：如果业务要“边反馈边看排行”，就得换树状数组（区间加、单点查同样是 O(log n) ），或者按固定周期批量收账——真实系统里后者更常见，因为它顺带给了你一个可回放的中间态。

## 常见坑

1. **off-by-one**。统一采用“`pre[0] = 0` ，区间用 `pre[r+1] - pre[l]` ”的约定，并用 `accumulate(initial=0)` 保证长度是 n+1 ，能消灭绝大多数事故。
2. **前缀和不能应对修改**。数组会变，就要换树状数组或线段树；只在“建一次、查多次”时使用前缀和。
3. **负数会破坏单调性**。前缀和用于二分答案的前提是原数组非负（这样前缀和严格不减）。含负数时前缀和不再单调，二分不成立。
4. **浮点累积误差**。`accumulate` 对 float 逐次相加会累积误差，需要高精度时改用 `math.fsum` 重算，或用整数（放大 10⁶ 倍）存储。
5. **从 Java/C++ 迁移过来的习惯**。那些语言里前缀和容易在 `int` 上溢出，得刻意换 `long` ；Python 的 `int` 是任意精度，不存在这个问题，但反过来说它也不会替你发现“累加口径混了 float 和 int ”。
6. **差分还原要显式做**。差分只是中间态，`d` 里没有真实值，别把 `d[i]` 当成 `a[i]` 用。
7. **区间开闭必须自洽**。`d[l]+=v, d[r+1]-=v` 对应闭区间；扫描线里 `(start,+1)(end,-1)` 对应左闭右开。混用会出现“端点差一个”的经典 bug ，尤其在统计并发数时。
8. **二维前缀和的空间**。n × m 的 `pre` 是 O(nm) ，很大时考虑按行滚动累加，或用稀疏结构。
9. **树状数组只支持“单点改”**。要区间改再看单点值，就再套一层差分（双 BIT 或“BIT 维护差分数组”）；别指望一个 `add` 循环能做区间加。
10. **`bisect` 找边界时要传 `lo` 。** 在 `pre` 上二分预算，如果不限制搜索区间，会把“起点之前的累计值”也算进来，得到比预期更长的片段数——见本文“应用二”的 `lo=start` 。

## 延伸阅读

- Python 官方文档 [itertools](https://docs.python.org/3/library/itertools.html#itertools.accumulate)：`accumulate` 的 `initial` 参数与自定义 `func` （可求前缀积、前缀最大值）。
- doocs/leetcode 的 303 与 304（二维区域和检索）题解，含 Python3 实现（CC BY-SA 4.0）。
- 《二分查找》与《Python 算法工具箱：heapq、bisect、graphlib 与 collections》：前缀和 + `bisect` 是“单调性”类查询的通用套路。
- 《双指针与滑动窗口》：窗口固定或收缩式统计时，滑动窗口与“前缀和 + 二分”常常等价，前者 O(n) 、后者 O(n log n) 。
- 《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》：本文“应用二”的分块边界问题，在检索侧的完整工程背景。
- 《并查集与等价类归并》：另一类“批量归并”的思路，与差分一样解决“逐个操作太慢”的问题。

---

> **来源**：抓取于 2026-09-19。303 题面转引自 [doocs/leetcode · 303. 区域和检索 - 数组不可变](https://github.com/doocs/leetcode/blob/main/solution/0300-0399/0303.Range%20Sum%20Query%20-%20Immutable/README.md)（doocs/leetcode 项目，CC BY-SA 4.0）；`accumulate` 语义依据 [Python itertools 官方文档](https://docs.python.org/3/library/itertools.html#itertools.accumulate)（PSF，PSF License 2.0）；二维前缀和的容斥示例图取自 [OI Wiki《前缀和 & 差分》](https://oi-wiki.org/basic/prefix-sum/)（OI Wiki 项目，CC BY-SA 4.0，图已下载至本模块 `assets/` 目录，配文由本站按原图重写）。原页面中的 C++ 代码、树上点差分/边差分、子集和搜索与竞赛习题未收录；一维/二维前缀和、差分扫描线、树状数组、token 账本、分块边界与批量加权的全部 Python 代码为本站编写，已在 CPython 3.12/3.14 下运行验证。
