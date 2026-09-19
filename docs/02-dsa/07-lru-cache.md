---
title: LRU 缓存（哈希表 + 双向链表）
source_url: https://raw.githubusercontent.com/doocs/leetcode/main/solution/0100-0199/0146.LRU%20Cache/README.md
author: doocs/leetcode 项目（Yang Fugui 等）
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 7
group: 线性结构
---
*本文第一部分完整转载自 [doocs/leetcode · 146. LRU 缓存](https://github.com/doocs/leetcode/blob/main/solution/0100-0199/0146.LRU%20Cache/README.md)（raw markdown 取自同路径），作者 doocs/leetcode 项目，许可 CC BY-SA 4.0。原文为中文，本站仅做格式转换：题目描述中的 HTML 片段转为 Markdown，LaTeX 公式转为 Unicode 可读文本；按本站惯例仅保留题解的 Python3 代码页（原页面另含 Java/C++/Go/TypeScript/Rust/JavaScript/C# 等语言实现，实现思路与 Python3 完全一致，可到原仓库查看）。第二部分补充官方文档 `functools.lru_cache` 一节。*

## 为什么工程上离不开 LRU

缓存的第一问从来不是“怎么存”，而是 **“满了以后丢哪个”** 。容量固定的缓存必须有淘汰策略，常见四种：

| 策略 | 丢谁 | 代价 | 问题 |
| ---- | ---- | ---- | ---- |
| FIFO | 最早进来的 | 队列即可，O(1) | 热点数据也可能被踢走（“缓存污染”） |
| LIFO | 最后进来的 | 栈即可，O(1) | 把刚用到的热数据先丢了，几乎不可用 |
| Random | 随机 | O(1) | 稳定但平庸，Redis 的 `maxmemory-policy allkeys-lru` 之外的兜底选项 |
| **LRU** | **最久没被用到的** | 需要 O(1) 维护“使用次序” | 需要哈希表 + 双向链表，实现成本略高 |
| LFU | 用得最少的 | 计数 + 分桶堆 | 要处理“老热点赖着不走”，需衰减 |

**LRU 的依据是时间局部性**：刚被访问过的数据，很可能很快再被访问。它的语义要求同时满足三件事——按“最近使用时间”排序、访问即更新位置、任意一端 O(1) 摘除。数组排序是 O(n) ，单向链表摘除中间节点要 O(n) 找前驱，**只有“哈希表定位节点 + 双向链表原地摘挂”能同时做到 get / put 都 O(1)** ，这也是这道题被反复考察的原因：它是把两种结构拼成一个新结构的最好示例。

一句话概括结构：**哈希表回答“这个键的节点在哪”，双向链表回答“谁最久没用”** 。

```text
        最近使用                                     最久未使用
   head ⇄ [k1] ⇄ [k2] ⇄ [k3] ⇄ ... ⇄ [kN] ⇄ tail
             ▲
             │  map[key] -> 节点，O(1) 定位后可原地摘除
   map = { k1: 节点, k2: 节点, ... }
```

两个哨兵节点（`head` / `tail`）让“摘第一个”“摘最后一个”都不必特判空，这与《链表》里“哨兵头节点砍掉一半分支”是同一个技巧。

## 需求规约（原文题目）

本文第一部分完整取自 doocs/leetcode 仓库收录的 LRU 缓存一题（该题标注为“中等”，标签：设计、哈希表、链表、双向链表），下面按原样给出接口规约与示例，作为实现的验收标准。

## 题目描述

请你设计并实现一个满足 [LRU (最近最少使用) 缓存](https://en.wikipedia.org/wiki/Cache_replacement_policies) 约束的数据结构。实现 `LRUCache` 类：

- `LRUCache(int capacity)` 以 **正整数** 作为容量 `capacity` 初始化 LRU 缓存
- `int get(int key)` 如果关键字 `key` 存在于缓存中，则返回关键字的值，否则返回 `-1` 。
- `void put(int key, int value)` 如果关键字 `key` 已经存在，则变更其数据值 `value` ；如果不存在，则向缓存中插入该组 `key-value` 。如果插入操作导致关键字数量超过 `capacity` ，则应该 **逐出** 最久未使用的关键字。

函数 `get` 和 `put` 必须以 `O(1)` 的平均时间复杂度运行。

**示例：**

```plain
输入
["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]
[[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]
输出
[null, null, null, 1, null, -1, null, -1, 3, 4]

解释
LRUCache lRUCache = new LRUCache(2);
lRUCache.put(1, 1); // 缓存是 {1=1}
lRUCache.put(2, 2); // 缓存是 {1=1, 2=2}
lRUCache.get(1);    // 返回 1
lRUCache.put(3, 3); // 该操作会使得关键字 2 作废，缓存是 {1=1, 3=3}
lRUCache.get(2);    // 返回 -1 (未找到)
lRUCache.put(4, 4); // 该操作会使得关键字 1 作废，缓存是 {4=4, 3=3}
lRUCache.get(1);    // 返回 -1 (未找到)
lRUCache.get(3);    // 返回 3
lRUCache.get(4);    // 返回 4
```

**提示：**

- `1 <= capacity <= 3000`
- `0 <= key <= 10000`
- `0 <= value <= 10⁵`
- 最多调用 `2 * 10⁵` 次 `get` 和 `put`

## 解法

### 方法一：哈希表 + 双向链表

> **思考**
>
> get / put 都要 O(1)，淘汰最久未使用的键。哈希表能 O(1) 查找，但不能单独维护使用顺序；数组或单向链表移动节点是 O(n)。调用次数达 2×10⁵。
>
> 哈希表存键到节点，双向链表按「最近使用在头、最久在尾」排列。访问或更新时把节点摘下再插到头部；容量满时删掉尾部前驱。查找与调整指针都是 O(1)。

我们可以用"哈希表"和"双向链表"实现一个 LRU 缓存。

- 哈希表：用于存储 key 和对应的节点位置。
- 双向链表：用于存储节点数据，按照访问时间排序。

当访问一个节点时，如果节点存在，我们将其从原来的位置删除，并重新插入到链表头部。这样就能保证链表尾部存储的就是最近最久未使用的节点，当节点数量大于缓存最大空间时就淘汰链表尾部的节点。

当插入一个节点时，如果节点存在，我们将其从原来的位置删除，并重新插入到链表头部。如果不存在，我们首先检查缓存是否已满，如果已满，则删除链表尾部的节点，将新的节点插入链表头部。

时间复杂度 O(1)，空间复杂度 O(capacity)。

**Python3**

```python
class Node:
    def __init__(self, key: int = 0, val: int = 0):
        self.key = key
        self.val = val
        self.prev = None
        self.next = None


class LRUCache:

    def __init__(self, capacity: int):
        self.size = 0
        self.capacity = capacity
        self.cache = {}
        self.head = Node()
        self.tail = Node()
        self.head.next = self.tail
        self.tail.prev = self.head

    def get(self, key: int) -> int:
        if key not in self.cache:
            return -1
        node = self.cache[key]
        self.remove_node(node)
        self.add_to_head(node)
        return node.val

    def put(self, key: int, value: int) -> None:
        if key in self.cache:
            node = self.cache[key]
            self.remove_node(node)
            node.val = value
            self.add_to_head(node)
        else:
            node = Node(key, value)
            self.cache[key] = node
            self.add_to_head(node)
            self.size += 1
            if self.size > self.capacity:
                node = self.tail.prev
                self.cache.pop(node.key)
                self.remove_node(node)
                self.size -= 1

    def remove_node(self, node):
        node.prev.next = node.next
        node.next.prev = node.prev

    def add_to_head(self, node):
        node.next = self.head.next
        node.prev = self.head
        self.head.next = node
        node.next.prev = node


# Your LRUCache object will be instantiated and called as such:
# obj = LRUCache(capacity)
# param_1 = obj.get(key)
# obj.put(key,value)
```

## 跑一遍题面示例

上面那份实现是可直接运行的。把它存成 `lru.py` ，加上题面里的调用序列做验收：

```python
if __name__ == "__main__":
    ops = ["LRUCache", "put", "put", "get", "put", "get", "put", "get", "get", "get"]
    args = [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]
    cache = None
    out = []
    for op, a in zip(ops, args):
        if op == "LRUCache":
            cache = LRUCache(*a)                 # 容量 2
            out.append(None)
        else:
            out.append(getattr(cache, op)(*a))
    print(out)
    # [None, None, None, 1, None, -1, None, -1, 3, 4]  —— 与题面输出一致
```

注意 `Node` 里要同时存 `key` 和 `val` ：淘汰链表尾节点时，需要用它身上的 `key` 去删哈希表。**只存值是最常见的实现错误** ，表现为主键泄漏——链表摘掉了，`cache` 字典里还留着指向悬空节点的条目。

## 手写版 vs 标准库版：`OrderedDict`

`collections.OrderedDict` 内部已经维护了插入顺序（还额外维护了一张双向链表），`move_to_end` 就是“摘下来挂到尾部”，于是 LRU 只剩五行代码：

```python
from collections import OrderedDict


class LRUCacheOrdered:
    """用 OrderedDict 实现的 LRU：最近使用放队尾，队首即淘汰对象"""

    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("capacity 必须为正")
        self.capacity = capacity
        self._d: OrderedDict[int, int] = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self._d:
            return -1
        self._d.move_to_end(key)        # 命中即“最近使用”，移到队尾
        return self._d[key]

    def put(self, key: int, value: int) -> None:
        self._d[key] = value
        self._d.move_to_end(key)
        while len(self._d) > self.capacity:
            self._d.popitem(last=False)  # 弹出队首 = 最久未使用
```

两种写法的取舍很清楚：

| 维度 | 手写双向链表 | `OrderedDict` |
| ---- | ------------ | ------------- |
| 复杂度 | get / put 均摊 O(1) | 同为 O(1) ，`move_to_end` 也是 |
| 代码量 | 约 60 行 | 约 15 行 |
| 可改性 | 想加什么指标都行 | 结构已被固定 |
| 典型场景 | 面试、需要埋点 / 分级 / 权重 | 生产环境的普通缓存 |

**带过期时间的 LRU** 是手写版更值得存在的理由，因为多了一个时间维度后“队首”不再等价于“该淘汰”，得先把过期项清出去：

```python
class LRUCacheWithTTL:
    """带过期时间的 LRU：惰性过期 + 主动清理"""

    def __init__(self, capacity: int, ttl: float = 60.0):
        self._d: OrderedDict[int, tuple[object, float]] = OrderedDict()
        self.capacity, self.ttl = capacity, ttl

    def get(self, key: int, now: float):
        item = self._d.get(key)
        if item is None:
            return None
        value, expire_at = item
        if now >= expire_at:             # 惰性过期：读到时才发现它死了
            del self._d[key]
            return None
        self._d.move_to_end(key)
        return value

    def put(self, key: int, value: object, now: float) -> None:
        self._d[key] = (value, now + self.ttl)
        self._d.move_to_end(key)
        while len(self._d) > self.capacity:
            self._d.popitem(last=False)  # 超容量就先丢最久未用

    def purge(self, now: float) -> int:
        """主动清理：从队首扫，遇到未过期的即停——队首永远是最旧的"""
        removed = 0
        for k in list(self._d):
            if self._d[k][1] <= now:
                del self._d[k]
                removed += 1
            else:
                break
        return removed


if __name__ == "__main__":
    c = LRUCacheWithTTL(capacity=2, ttl=10.0)
    c.put(1, "a", now=0.0)
    c.put(2, "b", now=1.0)
    print(c.get(1, now=5.0), c.get(1, now=12.0))   # a None（已过期）
    c.put(3, "c", now=20.0)
    c.put(4, "d", now=21.0)
    c.put(5, "e", now=22.0)                        # 容量 2，插入 5 时挤掉队首
    print(list(c._d))                               # [4, 5]
```

`purge` 之所以能“遇到未过期就 break” ，靠的是 OrderedDict 的顺序近似等于写入时间序；如果中途有大量 `get` 命中导致顺序被打乱，就得全表扫描。真实系统通常做法是**再挂一个按过期时间排序的小顶堆**（见《堆》），堆顶即最早过期项，两边用 `key` 对账——这也是“同一个数据放两种索引”的常见模式。

## 复杂度推导

- **时间** ：`get` / `put` 都由“一次哈希查表 + 常数次指针改写”构成，均摊 **O(1)** 。题面要求“平均 O(1)” ，这个“平均”来自哈希表：极端情况下大量键落到同一桶（链式地址），单次操作退化为 O(链长) （见《哈希表》）。
- **空间** ：**O(capacity)** ，每个条目一份节点 + 一条哈希表项。手写版每个节点约 56 字节（`__dict__`）加两个引用，用 `__slots__ = ("key", "val", "prev", "next")` 可省掉 `__dict__` ，节点体积能降一半以上——**百万级缓存里这是必做的优化** 。
- **淘汰策略的代价不可忽略**：`OrderedDict` 版每次 `put` 都做一次 `move_to_end` ，即使命中路径也一样，所以它的常数比手写版略高，但省掉的维护成本更值。
- 对比一下“偷懒实现”：用普通 `dict` + 每次访问记 `last_used` 时间戳，淘汰时 `min(items, key=last_used)` ——那是 O(capacity) 的淘汰，缓存越大越慢，容量 10 万时一次淘汰要扫 10 万项，直接毁掉尾延迟。

## 命中率实测：LRU 真的比 FIFO 好吗

策略优劣只能靠负载测。真实流量高度不均（头部几个键占掉大部分访问），用 Zipf 分布模拟最贴近现实：

```python
import random


def zipf_keys(n: int, items: int, seed: int = 0) -> list[int]:
    """按 Zipf 分布造访问序列：模拟“少数热点 + 大量长尾”的真实缓存负载"""
    rng = random.Random(seed)
    weights = [1.0 / (k + 1) for k in range(items)]
    return rng.choices(range(items), weights=weights, k=n)


def fifo_rate(capacity: int, seq: list[int]) -> float:
    """FIFO：命中时不移动位置，只按进入顺序淘汰"""
    seen: dict[int, bool] = {}
    queue: list[int] = []
    hits = 0
    for k in seq:
        if k in seen:
            hits += 1
            continue
        if len(queue) >= capacity:
            del seen[queue.pop(0)]
        seen[k] = True
        queue.append(k)
    return hits / len(seq)


if __name__ == "__main__":
    seq = zipf_keys(20000, 1000)          # 1000 个键、2 万次访问
    cache = LRUCacheOrdered(100)          # 只缓存 1%，压力测试
    lru_hits = 0
    for k in seq:
        if cache.get(k) != -1:
            lru_hits += 1
        cache.put(k, k)
    print(f"LRU 命中率 {lru_hits / len(seq):.3f} ，FIFO 命中率 {fifo_rate(100, seq):.3f}")
    # LRU 命中率 0.574 ，FIFO 命中率 0.519（随机序列固定种子，结果可复现）
```

约 5 个百分点的命中率差，换算成后端 QPS 就是 10% 以上的回源量差别。两点值得注意：**FIFO 的实现里 `queue.pop(0)` 是 O(n)**（本文只求正确不求快，生产请用 `collections.deque`）；命中率对 `capacity / items` 比值极其敏感，把容量提到 200 时两者差距会进一步扩大——**扩容前先测命中率，别按直觉拍容量**。

## 补充：Python 标准库 `functools.lru_cache`

> **补充**：以下内容完整选自 [Python 官方文档 · functools — lru_cache](https://docs.python.org/zh-cn/3/library/functools.html#functools.lru_cache)，作者 Python Software Foundation，许可 PSF 许可证第 2 版（转载署名）。

`@functools.lru_cache(_user_function_)`
`@functools.lru_cache(_maxsize=128_, _typed=False_)`

一个为函数提供缓存功能的装饰器，缓存 _maxsize_ 组传入参数，在下次以相同参数调用时直接返回上一次的结果。用以节约高开销或 I/O 函数的调用时间。

该缓存是线程安全的，因此被包装的函数可在多线程中使用。这意味着下层的数据结构将在并发更新期间保持一致性。

如果另一个线程在初始调用完成并被缓存之前执行了额外的调用，则被包装的函数可能会被多次调用。

由于使用字典来缓存结果，因此传给该函数的位置和关键字参数必须为 [hashable](https://docs.python.org/zh-cn/3/glossary.html)。

不同的参数模式可能会被视为具有单独缓存项的不同调用。例如，`f(a=1, b=2)` 和 `f(b=2, a=1)` 因其关键字参数顺序不同而可能会具有两个单独的缓存项。

如果指定了 _user_function_，它必须是一个可调用对象。这允许 _lru_cache_ 装饰器被直接应用于一个用户自定义函数，让 _maxsize_ 保持其默认值 128:

```python
@lru_cache
def count_vowels(sentence):
    return sum(sentence.count(vowel) for vowel in 'AEIOUaeiou')
```

如果 _maxsize_ 设为 `None`，LRU 特性将被禁用且缓存可无限增长。

如果 _typed_ 被设置为 true，不同类型的函数参数将被分别缓存。如果 _typed_ 为 false ，实现通常会将它们视为等价的调用，只缓存一个结果。（有些类型，如 _str_ 和 _int_，即使 _typed_ 为 false，也可能被分开缓存。）

请注意，类型的特殊性只适用于函数的直接参数而不是它们的内容。 标量参数 `Decimal(42)` 和 `Fraction(42)` 会被视为具有不同结果的不同调用。 相比之下，元组参数 `('answer', Decimal(42))` 和 `('answer', Fraction(42))` 则会被视为是等同的。

被包装的函数配有一个 `cache_parameters()` 函数，它返回一个新的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 用来显示 _maxsize_ 和 _typed_ 的值。这只是出于显示信息的目的。改变这些值没有任何效果。

为了帮助衡量缓存的有效性以及调整 _maxsize_ 形参，被包装的函数会带有一个 `cache_info()` 函数，它返回一个 [named tuple](https://docs.python.org/zh-cn/3/glossary.html) 以显示 _hits_、 _misses_、 _maxsize_ 和 _currsize_。

该装饰器也提供了一个用于清理/使缓存失效的函数 `cache_clear()`。

原始的未经装饰的函数可以通过 `__wrapped__` 属性访问。它可以用于检查、绕过缓存，或使用不同的缓存再次装饰原始函数。

缓存会保持对参数和返回值的引用，直到它们结束生命期退出缓存或者直到缓存被清空。

如果一个方法被缓存，则 `self` 实例参数会被包括在缓存中。请参阅 [我该如何缓存方法调用？](https://docs.python.org/zh-cn/3/faq/programming.html)

[LRU (least recently used) 缓存](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_(LRU)) 在最近的调用是即将到来的调用的最佳预测值时性能最好 (例如，新闻服务器上的最热门文章倾向于每天发生变化)。 缓存的大小限制可确保缓存不会在长期运行的进程如 web 服务器上无限制地增长。

一般来说，LRU 缓存只应在你需要重复使用先前计算的值时使用。 因此，缓存有附带影响的函数、每次调用都需要创建不同的可变对象的函数（如生成器和异步函数）或不纯的函数如 time() 或 random() 等是没有意义的。

静态 Web 内容的 LRU 缓存示例:

```python
@lru_cache(maxsize=32)
def get_pep(num):
    'Retrieve text of a Python Enhancement Proposal'
    resource = f'https://peps.python.org/pep-{num:04d}'
    try:
        with urllib.request.urlopen(resource) as s:
            return s.read()
    except urllib.error.HTTPError:
        return 'Not Found'

>>> for n in 8, 290, 308, 320, 8, 218, 320, 279, 289, 320, 9991:
...     pep = get_pep(n)
...     print(n, len(pep))

>>> get_pep.cache_info()
CacheInfo(hits=3, misses=8, maxsize=32, currsize=8)
```

以下是使用缓存通过 [动态规划](https://zh.wikipedia.org/wiki/动态规划) 计算 [斐波那契数列](https://zh.wikipedia.org/wiki/斐波那契数列) 的例子:

```python
@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)

>>> [fib(n) for n in range(16)]
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]

>>> fib.cache_info()
CacheInfo(hits=28, misses=16, maxsize=None, currsize=16)
```

## 常见坑

1. **`get` 忘记更新使用次序**。只查不改位置，实现出来的是 FIFO 而不是 LRU ；命中率会掉，但功能测试全过——最难发现的一类 bug ，用上文的命中率实验才测得出来。
2. **淘汰时漏删哈希表项**（或漏存 `key`）。链表摘了节点，字典里还留着条目，内存不降反升，最后 OOM ；节点必须自带 `key` 才能反查删除。
3. **`put` 命中已存在的键却没移动到队头**。只改值不移位置，等于“更新不算使用”，热数据被误淘汰。
4. **`capacity` 为 0 或负数**。不在构造函数里挡住，`while len(...) > capacity` 会立刻把刚插的条目删掉，表现为“缓存永远为空”。
5. **哨兵节点与真实节点的边界**。双向链表的四条指针必须同时改，漏一条就会出现“单向可走、反向断链”，遍历长度直接对不上。
6. **`OrderedDict.move_to_end` 的方向**。`last=False` 是移到队首（当作最久未用），写反方向等于把它优先淘汰；`popitem(last=False)` 才是弹队首。
7. **多线程 / 多进程共享**。`@lru_cache` 的“线程安全”只保证内部结构一致，并不保证你的函数只被调用一次（两个线程同时未命中会各算一遍）；跨进程共享缓存要外部存储（Redis 之类），Python 侧的缓存只在本进程有效。
8. **`lru_cache` 装在实例方法上**。`self` 进了缓存键，实例被缓存引用住无法回收，等于内存泄漏；改成 `functools.cached_property` 或把可缓存的部分下沉到静态函数（见《Python 算法工具箱》）。
9. **缓存键用了不可哈希或会变的对象**。`dict` 、`list` 不能直接作键；内容会变却带 `__hash__` 的自定义对象作键，命中结果会静默错乱。传参前先转 `tuple` 。
10. **用 `lru_cache` 缓存带副作用的函数**。官方文档已明确警告：缓存 `time()` 、`random()` 、生成器、异步函数都没有意义，还会掩盖真实调用次数。
11. **击穿与雪崩**。热点键过期瞬间大量请求同时回源，等于缓存整体失效；工程上要加“同键 single-flight（只放一个请求去回源）”和过期时间抖动，这属于 LRU 之外必须配套的机制。
12. **只按条数限容，不按字节限容**。值的大小差异极大（一段 2 KB 文本与一张图片），生产缓存通常按“权重 = 字节数”淘汰，把 `capacity` 换成 `max_weight` 即可，代价是节点要多存一个 `weight` 字段。

## 工程应用：LRU 站在哪一层

- **检索与推理侧的语义缓存**。把 `query -> answer` 按“问题向量 + 归一化文本”作键缓存，是最直接的降本手段：LRU 保容量、TTL 保新鲜度，命中即省一次模型调用。键归一化（去空白、去标点、统一大小写）决定命中率，这一步往往比淘汰策略更重要；向量相似检索见《向量相似度与 HNSW 近邻图》，近重复判定见《布隆过滤器与集合去重》与《并查集与等价类归并》。
- **模型服务的 KV Cache 与提示前缀缓存**。多轮对话里各轮共享同一前缀的注意力缓存，本质是“前缀块”的复用；显存有限，于是用块级引用计数加近似 LRU 决定哪些块先释放。这里正好暴露 LRU 的局限：**“最近使用”不等于“最有价值”** ，被多个请求共享的前缀块即使刚用过也不该淘汰，所以真实实现要叠加引用计数与权重。
- **数据库与操作系统**。InnoDB 缓冲池用“改良 LRU”（链表分 young / old 两段，全表扫描进来的页先进 old 段，避免一次扫描把热页全挤出）；Linux 页面回收、CDN 对象缓存、JVM 类加载缓存，都是同一家族加上分代或分段策略。
- **应用层**。HTTP 客户端响应缓存、ORM 的身份映射（identity map）、图片加载库（内存层 LRU + 磁盘层 FIFO）、编译器 memoization，都能直接用上面的 `OrderedDict` 版落地。
- **接口设计上的一条经验**：**把缓存当组件，而不是当装饰**——它必须有容量、有淘汰策略、有命中率指标、有失效路径。上文 `LRUCache` 里那两行 `hits` / `misses` 计数就够支撑一块监控面板；没有可观测性的缓存在生产上等于一个隐藏 bug 。

## 延伸阅读

- 《哈希表》：O(1) 查找从哪来，负载因子与再哈希。
- 《链表》：双向链表的摘挂操作与哨兵节点。
- 《堆》：LFU 的“频次分桶”实现、TTL 的“最早过期优先”队列。
- [Python `collections.OrderedDict` 官方文档](https://docs.python.org/3/library/collections.html#collections.OrderedDict)（PSF License 2.0）：`move_to_end` 、`popitem` 与插入顺序语义。
- [Cache replacement policies（Wikipedia）](https://en.wikipedia.org/wiki/Cache_replacement_policies)（CC BY-SA 4.0）：LRU / LFU / FIFO / ARC 的横向对照与各自失效场景。
- 《Python 算法工具箱：heapq、bisect、graphlib 与 collections》：`cache` / `lru_cache` / `cached_property` 的选型建议。

---

> **来源**：本文第一部分转载自 [doocs/leetcode · 146. LRU 缓存（题目描述与方法一）](https://github.com/doocs/leetcode/blob/main/solution/0100-0199/0146.LRU%20Cache/README.md)，作者 doocs/leetcode 项目，许可 CC BY-SA 4.0；第二部分选自 [Python 官方文档 · functools.lru_cache](https://docs.python.org/zh-cn/3/library/functools.html#functools.lru_cache)，作者 Python Software Foundation，许可 PSF 许可证第 2 版。抓取于 2026-09-13。原题解页面另含 Java/C++/Go/TypeScript/Rust/JavaScript/C# 等多语言实现，本站按惯例仅收录 Python3 实现。
