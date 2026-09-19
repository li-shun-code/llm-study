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

# 146. LRU 缓存

难度：中等；标签：设计、哈希表、链表、双向链表。

## 题目描述

请你设计并实现一个满足 [LRU (最近最少使用) 缓存](https://baike.baidu.com/item/LRU) 约束的数据结构。实现 `LRUCache` 类：

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

---

> **来源**：本文第一部分转载自 [doocs/leetcode · 146. LRU 缓存（题目描述与方法一）](https://github.com/doocs/leetcode/blob/main/solution/0100-0199/0146.LRU%20Cache/README.md)，作者 doocs/leetcode 项目，许可 CC BY-SA 4.0；第二部分选自 [Python 官方文档 · functools.lru_cache](https://docs.python.org/zh-cn/3/library/functools.html#functools.lru_cache)，作者 Python Software Foundation，许可 PSF 许可证第 2 版。抓取于 2026-09-13。原题解页面另含 Java/C++/Go/TypeScript/Rust/JavaScript/C# 等多语言实现，本站按惯例仅收录 Python3 实现。
