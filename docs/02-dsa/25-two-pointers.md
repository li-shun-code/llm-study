---
title: 双指针与滑动窗口
source_url: https://raw.githubusercontent.com/doocs/leetcode/main/solution/0000-0099/0011.Container%20With%20Most%20Water/README.md
author: 本站整理；参考 doocs/leetcode、CPython 官方教程
license: CC BY-SA 4.0（doocs/leetcode 题面）；PSF License 2.0（Python 文档）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（标准库，无第三方依赖）
order: 25
group: 查找、排序与数组技巧
---
## 为什么需要双指针

> **难度**：★★☆。双指针不是算法，而是“把 O(n²) 嵌套循环压成 O(n) 单遍”的一种书写方式。
> **适合**：想把数组/字符串遍历类题目写成模板，而不是一道一背的读者。
> **前置**：《数组》《二分查找》。贪心角度的正确性论证见《贪心算法（面试选学）》的“最大容量问题”。


处理有序或线性数据时，最常见的低效写法是两层循环：枚举所有 (i, j) 组合，O(n²) 。双指针的洞察是：

> **当 i 增大时，最优的 j 往往只朝一个方向移动**——那么就没必要为每个 i 从头扫一遍，让 j 顺着 i 走即可，整体降到 O(n) 。

这个“单向移动”的性质一旦成立，两个指针各自最多走 n 步，总步数不超过 2n 。三类用法分别对应三种“单向性”：

| 模板 | 指针走向 | 依赖的前提 | 典型问题 |
| ---- | -------- | ---------- | -------- |
| 对撞双指针 | 相向而行 | 数据有序，或“移动短板必然不更优” | 两数之和 II、盛水容器、反转、回文判断 |
| 快慢双指针 | 同向、速度不同 | 需要在单遍中维护某种进度差 | 原地去重、链表环检测、第 k 个节点 |
| 滑动窗口 | 同向、右扩左缩 | 窗口满足某单调条件（扩大只会更坏/更好） | 最长无重复子串、最小覆盖子串、定长统计 |

在 LLM 与后端语境里，第三类用得最凶，而且往往不是“算法题”，是**日常代码的形状**：

- **上下文窗口切分**：会话历史是一个列表，约束是“条数 ≤ N 且总 token ≤ M”——两个上界同时约束左边界该停在哪，这就是一个收缩式窗口。
- **流式限长与截断**：token 一个一个吐出来，缓冲区只能装那么多，旧的必须滑出去。用 `deque` 写就是三行，用“每次切片重算”写就是 O(n²) 。
- **限流与配额统计**：“最近 60 秒的请求数”是一个定长滑动窗口；日志按时间戳进出，队首过期就弹出。
- **文档分片的重叠窗口**：切 chunk 时保留 overlap ，本质是左右指针以 `step = size - overlap` 步进。
- **两路召回合并**：BM25 与向量结果都各自有序，对撞指针单遍算交集/并集/RRF，避免两两比较。

这些场景的共同点是：**数据是流式的或规模很大，而“窗口”是唯一能负担得起的记忆**。所以本文把滑动窗口当作主线，模板一、二当作理解指针移动的手感练习。

## 模板一：对撞双指针

> **【题面】LeetCode 11. 盛最多水的容器**（doocs/leetcode，CC BY-SA 4.0）：给定长度为 n 的整数数组 `height` ，第 i 条垂线两端点是 (i, 0) 和 (i, height[i]) 。找出两条线，使它们与 x 轴共同构成的容器可以容纳最多的水，返回最大水量。你不能倾斜容器。

朴素解法枚举所有 (i, j) ，O(n²) 。对撞双指针的做法：从两端开始，**每轮向内移动较短的那块板**。

```python
def max_area(height: list[int]) -> int:
    """盛最多水的容器：对撞双指针，O(n)"""
    i, j = 0, len(height) - 1
    res = 0
    while i < j:
        # 高度由短板决定，宽度是两指针距离
        res = max(res, min(height[i], height[j]) * (j - i))
        if height[i] < height[j]:
            i += 1   # 移动短板：宽度变小，但高度可能变大
        else:
            j -= 1   # 移动长板：宽度变小且高度不可能变大，纯属浪费
    return res


print(max_area([1, 8, 6, 2, 5, 4, 8, 3, 7]))  # 49
print(max_area([1, 1]))                         # 1
```

**为什么移动短板是安全的**（这才是本题的全部难点）：设当前 `height[i] < height[j]` ，那么所有以 i 为左边界、右边界落在 (i, j] 之间的容器，高度都不超过 `height[i]` 、宽度都小于 j - i ，因此容量必然小于当前容器。也就是说，“包含短板 i 的状态”已经全部被排除，可以放心地把 i 右移；反之移动 j 会丢失尚未验证的状态。这是《贪心算法（面试选学）》里“反证法证明贪心”的最简样本。

同一模板还能解决有序数组的两数之和：

```python
def two_sum_sorted(nums: list[int], target: int) -> tuple[int, int]:
    """有序数组中找两数之和为 target ，返回下标；找不到返回 (-1, -1)"""
    i, j = 0, len(nums) - 1
    while i < j:
        s = nums[i] + nums[j]
        if s == target:
            return i, j
        if s < target:
            i += 1   # 和太小，只有左移指针 i 能让和变大（数组有序）
        else:
            j -= 1
    return -1, -1


print(two_sum_sorted([2, 7, 11, 15], 9))   # (0, 1)
print(two_sum_sorted([2, 3, 4], 5))        # (0, 1)
```

对比《哈希表》里的“两数之和”解法：哈希版 O(n) 时间、O(n) 空间，且不要求有序；双指针版 O(n) 时间、O(1) 空间，但要求输入已排序。**数据本来有序、或允许先排序时用双指针；要求单遍、且需要原始下标时用哈希表**。

## 模板二：快慢双指针

两个指针同向移动，但步调不同，用来在单遍中维护“进度差”。

### 原地删除重复项

> **【题面】LeetCode 26. 删除有序数组中的重复项**：升序数组原地去重，返回新长度 k ，要求前 k 个位置存放去重后的结果，不允许使用额外数组。

```python
def remove_duplicates(nums: list[int]) -> int:
    """快慢双指针：slow 指向下一个可写位置"""
    if not nums:
        return 0
    slow = 1
    for fast in range(1, len(nums)):
        if nums[fast] != nums[slow - 1]:   # 与已保留的最后一个不同
            nums[slow] = nums[fast]
            slow += 1
    return slow


a = [1, 1, 2, 2, 3]
k = remove_duplicates(a)
print(k, a[:k])  # 3 [1, 2, 3]
```

工程上这种“慢指针写、快指针读”的原地压缩，在日志清洗、流式过滤里比 `list(set(...))` 更有价值：**它保序、O(1) 额外空间、且可以在生成器上一次成型**。Python 里等价的写法是 `itertools.filterfalse` 配合自定义谓词，但需要“与前一个已保留元素比较”时，还是手写双指针最清楚。

### 链表环检测（Floyd 判圈）

快指针每次两步、慢指针每次一步，若有环必然相遇：

```python
class ListNode:
    def __init__(self, val: int):
        self.val = val
        self.next = None


def has_cycle(head: ListNode | None) -> bool:
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

链表相关定义与操作见《链表》。这里的关键是**循环条件要同时保证 `fast` 和 `fast.next` 非空**，否则 `fast.next.next` 会抛 `AttributeError` 。

## 模板三：滑动窗口

滑动窗口是快慢双指针的应用形态。它的标准骨架只有一句话：**右指针负责扩张窗口、更新答案；左指针负责在不满足条件时收缩**。

```python
def length_of_longest_substring(s: str) -> int:
    """无重复字符的最长子串（LeetCode 3）"""
    seen: dict[str, int] = {}   # 字符 -> 最近一次出现的下标
    left = res = 0
    for right, ch in enumerate(s):
        # 只有落在窗口内的重复才需要收缩
        if ch in seen and seen[ch] >= left:
            left = seen[ch] + 1
        seen[ch] = right
        res = max(res, right - left + 1)
    return res


print(length_of_longest_substring("abcabcbb"))  # 3
print(length_of_longest_substring("pwwkew"))    # 3
```

### 变长窗口：最小覆盖子串

“满足条件时尝试收缩左边界以逼近最小”，是变长窗口的另一种写法：

```python
def min_window(s: str, t: str) -> str:
    """覆盖 t 全部字符（含重复计数）的最小子串（LeetCode 76）"""
    from collections import Counter
    need, window = Counter(t), Counter()
    required = len(need)   # 需要满足的字符“种类”数
    formed = 0             # 当前窗口内已满足数量要求的种类数
    left = 0
    ans_len, ans_start = float("inf"), 0
    for right, ch in enumerate(s):
        window[ch] += 1
        # 恰好达标的那一刻才 +1，避免重复计数
        if ch in need and window[ch] == need[ch]:
            formed += 1
        while formed == required:      # 合法 -> 收缩左边界逼近最小
            if right - left + 1 < ans_len:
                ans_len, ans_start = right - left + 1, left
            out = s[left]
            window[out] -= 1
            if out in need and window[out] < need[out]:
                formed -= 1
            left += 1
    return "" if ans_len == float("inf") else s[ans_start: ans_start + ans_len]


print(min_window("ADOBECODEBANC", "ABC"))  # BANC
print(min_window("a", "aa"))               # 空串：无解
```

### 定长窗口

窗口大小固定时，代码更短：进一个、出一个，天然 O(n) 。

```python
def find_anagrams(s: str, p: str) -> list[int]:
    """找到 s 中所有 p 的字母异位词的起始下标（LeetCode 438）"""
    from collections import Counter
    n, k = len(s), len(p)
    if n < k:
        return []
    need = Counter(p)
    window = Counter(s[:k])
    res = [0] if window == need else []
    for i in range(k, n):
        window[s[i]] += 1          # 右边进
        window[s[i - k]] -= 1      # 左边出
        if window[s[i - k]] == 0:
            del window[s[i - k]]   # 删掉零计数，否则 == 比较会失败
        if window == need:
            res.append(i - k + 1)
    return res
```

**`del` 那一行是本题的真正陷阱**：`Counter` 里留着 `{'a': 0}` 会让 `window == need` 判断失败，因为字典比较会比对键集合。

### 为什么它是 O(n)：一次摊还论证

变长窗口最容易让人怀疑“里面还套了个 `while` ，怎么会是线性的”。答案在于**收缩的总次数被扩张的上界锁死了**：

- `right` 单调右移，全程最多走 n 步；
- `left` 单调右移，同样最多走 n 步，而且它每一步都必须在前一步的基础上前进——**没有任何代码路径会让 `left` 后退**；
- 因此 `while` 体的累计执行次数 ≤ n ，即使单次窗口里执行很多次，均摊到每个 `right` 上仍是 O(1) 。

一旦你写出让 `left` 回退的代码（有些题里为了“再试一次”会这么做），这个论证立刻失效，复杂度回到 O(n²) 。这也是滑动窗口的**唯一硬前提**：存在一个谓词 `ok(window)` ，使得“窗口扩大 ⇒ 若原本不 ok 则之后也不 ok”（求最短型）或“窗口扩大 ⇒ 若原本 ok 则之后仍 ok”（求最长型）。找不到这个单调性，就别硬套窗口——例如“和为 S 的子数组”在含负数时，扩张既可能让和变大也可能让它变小，窗口失效，得改用《前缀和与差分》里的“前缀和 + 哈希表”。

## 工程应用：上下文窗口切分与流式限长

把上面的骨架搬到真实系统里，第一个变化是：**窗口里装的不是字符下标，而是消息对象**；第二个变化是：**约束不止一个**（条数、token 数、甚至图片数）。双指针的形状不变，变的只是收缩条件。

```python
from collections import deque


def trim_to_budget(turns: list[str], max_items: int, max_chars: int) -> deque[str]:
    """保留最近的不超过 max_items 条，且总长度不超过 max_chars。
    真实场景里把 len() 换成 tokenizer 的 token 计数即可。"""
    win: deque[str] = deque()
    total = 0
    for t in turns:
        win.append(t)                    # 右指针扩张
        total += len(t)
        while win and (len(win) > max_items or total > max_chars):
            total -= len(win[0])         # 左指针收缩：撤销这条的贡献
            win.popleft()                # 只前进不后退，所以整体仍是 O(n)
    return win


out = trim_to_budget(["a" * 100, "b" * 50, "c" * 400, "d" * 30], max_items=3, max_chars=500)
print([len(x) for x in out])             # [50, 400, 30]  总长 480，条数 3
```

这段代码里 `total` 的维护方式是重点：**窗口和用“进加出减”增量更新，而不是每次重新 `sum()`** 。后者看着更短，但每轮都 O(窗口长度) ，整段就退化成 O(n·w) 。凡是“窗口里要放聚合量”的场合（token 数、字符频次、向量和），都该用增量式写法。

流式产出（token 一个一个来、日志一行一行到）时，同样的骨架换成生成器，内存只占一个窗口：

```python
from collections import deque


def windowed_batches(stream, size: int, overlap: int):
    """定长重叠窗口：先进满一个窗口，再按 step = size - overlap 步进。
    适用于 token 序列 / 行迭代器，不需要把整份数据读进内存。"""
    if not (0 <= overlap < size):
        raise ValueError("要求 0 <= overlap < size")
    buf: deque = deque()
    step = size - overlap
    covered = -1                      # 最后一个已产出窗口覆盖到的元素序号
    for i, item in enumerate(stream):
        buf.append(item)
        if len(buf) == size:
            covered = i
            yield list(buf)
            for _ in range(step):     # 丢掉 step 个元素，留下 overlap 个作为重叠
                buf.popleft()
    if buf and i > covered:           # 收尾：末尾不足一个窗口的残留也要发出去
        yield list(buf)


for n in (12, 5, 3):
    print(n, list(windowed_batches(range(n), 5, 2)))
# 12 [[0,1,2,3,4], [3,4,5,6,7], [6,7,8,9,10], [9,10,11]]
# 5  [[0,1,2,3,4]]
# 3  [[0,1,2]]
```

三个容易漏掉的边界：**`overlap >= size` 必须直接报错**（否则窗口永远在原地打转）；**数据不足一个窗口时仍要有产出**（最后那个短窗口，切文档时漏了它就等于丢了尾部内容）；**恰好等于一个窗口时不要重复产出**（`covered` 这个变量就是为它存在的）。分片大小与重叠的选择本身属于检索侧的权衡，见《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》。

限流是同一套骨架的第三个化身：把“窗口内的字符数”换成“窗口内的请求数”，把“超预算就收缩”换成“过期就弹出”。

```python
import time
from collections import deque


class SlidingWindowLimiter:
    """精确的“最近 window_sec 秒内不超过 limit 个请求”，双端队列本身就是窗口。"""

    def __init__(self, limit: int, window_sec: float, clock=time.monotonic):
        self.limit, self.window, self.clock = limit, window_sec, clock
        self.hits: deque[float] = deque()

    def allow(self) -> bool:
        now = self.clock()
        while self.hits and now - self.hits[0] >= self.window:
            self.hits.popleft()                    # 左指针收缩：过期请求滑出窗口
        if len(self.hits) >= self.limit:
            return False                           # 窗口已满
        self.hits.append(now)                      # 右指针扩张
        return True

    def retry_after(self) -> float:
        """最早可能放行的等待时间——即队首滑出窗口的时刻"""
        if not self.hits:
            return 0.0
        return max(0.0, self.window - (self.clock() - self.hits[0]))


class FakeClock:
    t = 10.0

    def __call__(self) -> float:
        return self.t


clock = FakeClock()
limiter = SlidingWindowLimiter(limit=3, window_sec=1.0, clock=clock)
for t in [10.0, 10.2, 10.4, 10.5, 10.9, 11.1]:
    clock.t = t
    print(f"t={t:5.1f} allow={limiter.allow()} retry_after={limiter.retry_after():.2f}")
# t= 10.0 allow=True  retry_after=1.00
# t= 10.2 allow=True  retry_after=0.80
# t= 10.4 allow=True  retry_after=0.60
# t= 10.5 allow=False retry_after=0.50
# t= 10.9 allow=False retry_after=0.10
# t= 11.1 allow=True  retry_after=0.10
```

把 `clock` 作为参数注入不是为了炫技：限流逻辑的正确性强依赖时间，能改时钟才能写出**不靠 sleep 的确定性单元测试** 。另外注意 `retry_after()` 的语义——它能塞进 `Retry-After` 响应头，比让客户端瞎猜重试间隔礼貌得多。窗口内计数与令牌桶各自的取舍（突发容忍度、精度、内存），见《并发请求限流：信号量、令牌桶与超时预算的完整实现》。

## 还会在哪些地方撞上它

1. **归并两段有序结果**。重排阶段融合 BM25 与向量两路召回（RRF）时，两路都是有序的，用两个同向指针单遍即可算交集与并集，避免 O(n²) 的两两比较；标准库 `heapq.merge` 做的是同一件事的多路版本。
2. **流式去重与有序压缩**。日志、指标点、向量列表按某个键排序后，快慢指针单遍合并相邻重复项——比 `set` 保序，还顺带能统计“连续重复次数”（哪个分片被连着写了 500 次，往往就是 bug 现场）。
3. **二分答案的判定函数**。判断“是否存在长度 ≤ L 的窗口满足条件”时，判定函数往往就是双指针，比枚举所有区间快一个量级；这套“判定函数 + 二分答案”的骨架见《二分查找》。
4. **父子块/句子窗口的对齐读取**。用小块召回、大块作答时，要把命中的小片段映射回大段落区间并合并相邻命中——两个指针在两个有序下标序列上走一遍就完了，见《句子窗口与父子块检索：用小块召回、大块作答》。
5. **回文与中心扩展**。对撞指针从中心向两边扩，是“以某点为中心看多远”的最小模型。

## 常见坑

1. **循环不变量说不清**。写之前先固定语义：`[left, right]` 是否闭区间？循环开始时窗口是否已经合法？**同一份代码里 left/right 的开闭必须始终一致**，混用是绝大多数 off-by-one 的来源。
2. **收缩条件用 `<` 还是 `<=`**。这取决于区间定义：左闭右开用 `while left < right` ，闭区间常用 `while left <= right` 。先定区间，再定符号。
3. **忘记 `while` 收缩**。用 `if` 收缩只能保证一次合法，窗口可能仍不满足约束（例如最小覆盖子串会给出偏大的答案）。
4. **答案更新时机**。有的题在扩张时更新（最长型），有的在收缩时更新（最短型），搞反就完全得不出结果。判断依据：“窗口变大时答案变好 → 扩张后更新；窗口变小时答案变好 → 收缩时更新”。
5. **`Counter` 的比较包含零计数键**，见上面的 `del` 。
6. **指针移动与元素修改的顺序**。原地去重、原地移动零时，先读后写、先 `+=` 后判断，顺序错了会覆盖掉尚未处理的数据。
7. **对撞指针要求有序**。数组无序时用对撞指针求两数之和是错的，需要先排序（但排序会打乱原始下标，要另存索引）。
8. **窗口里的聚合量必须增量维护**。`sum(window)` 、`len("".join(win))` 这类“每轮整体重算”的写法会把 O(n) 拖回 O(n·w) ；进一个加、出一个减才是滑动窗口的本意。增减必须严格配对，异常分支里漏一次减法，预算就会“越用越少”，而且很难复现。
9. **窗口收缩条件不能只写一个上界**。上下文裁剪常见“条数超了”和“token 超了”两个约束，用 `or` 连起来；只判断 token 会留出成千上万条微小消息，把序列化与网络开销喂给对端；只判断条数则可能被一条超长消息直接顶穿预算。
10. **用 `list.pop(0)` 冒充 `popleft()`**。前者是 O(n) 的整表搬移，窗口类算法直接退化；限流、裁剪这类热路径必须用 `collections.deque` 。

## 延伸阅读

- doocs/leetcode 题解仓库（CC BY-SA 4.0）的 11、26、76、167、438 题，含 Python3 实现与多种解法对照。
- 《二分查找》《前缀和与差分》：与双指针常互为替代方案——“有序 + 单调”可以用二分，也可以用双指针单遍扫描；含负数时两者都可能失效，回到前缀和 + 哈希表。
- 《贪心算法（面试选学）》：对撞双指针的“移动短板”本质上是一步贪心，需要反证法支撑。
- 《排序算法》：`sorted` + 双指针是处理无序输入的标准组合。
- 《Token 与上下文窗口》：本文“工程应用”里那两个上界（条数、token 数）从哪里来、怎么估。
- 《队列》：`deque` 的两端操作与它适用的场景，是滑动窗口在 Python 里的落地容器。

---

> **来源**：抓取于 2026-09-19。LeetCode 11 题面转引自 [doocs/leetcode · 11. 盛最多水的容器](https://github.com/doocs/leetcode/blob/main/solution/0000-0099/0011.Container%20With%20Most%20Water/README.md)（doocs/leetcode 项目，CC BY-SA 4.0），26 / 76 / 167 / 438 题面为本站按其官方描述转述。原 OI Wiki《双指针》页面（CC BY-SA 4.0）中的 C++ 实现、竞赛例题与习题未收录；本文的三类模板、复杂度与正确性论证、上下文裁剪 / 重叠分片 / 滑动窗口限流三段 Python 代码及全部中文说明为本站编写，已在 CPython 3.12/3.14 下运行验证。
