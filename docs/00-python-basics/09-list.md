---
title: 列表：增删改查与切片
source_url: https://docs.python.org/zh-cn/3/tutorial/datastructures.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 9
group: 容器与推导式
---
列表（`list`）是 Python 里出场率最高的容器：一段对话的 `messages`、一批待处理的文件路径、一次批量调用拿回的结果，全都先落进列表。它有序、可变、元素类型可以任意混合，理解它的三件事——**索引与切片**、**原地修改的方法**、**可变带来的拷贝陷阱**——就够覆盖日常 90% 的用法。

需要先建立的基础概念是**序列**（sequence）：列表、字符串、元组、`range` 都属于序列，它们的共同点是元素有确定顺序、可以用整数下标访问、支持切片。因此本文讲的下标与切片规则，对字符串和元组同样成立（参见《数字与字符串（f-string 与 UTF-8 编码）》与《元组与序列解包》）。

## 创建列表与访问元素

列表写成方括号里逗号分隔的值，元素不必同类型：

```python
titles = ["RAG", "Agent", "微调"]
mixed = ["Google", 1997, 3.14, True, None]
empty = []                      # 空列表
nested = [["a", "b"], [1, 2]]   # 可以嵌套，常用来表示二维数据
```

下标从 0 开始，负数从尾部倒数（`-1` 是最后一个）：

```python
titles = ["RAG", "Agent", "微调"]
print(titles[0])     # RAG
print(titles[-1])    # 微调
print(len(titles))   # 3 —— 长度用内置函数 len()，不是 titles.len()
```

越界访问会抛 `IndexError`，这是新手最常见的报错之一：

```python
titles = ["RAG", "Agent", "微调"]
print(titles[3])
# IndexError: list index out of range
```

## 切片：左闭右开

切片 `a[start:stop:step]` 返回**新列表**，规则是「含头不含尾」。记住这一点，几乎所有切片问题都能口算出来：

```python
nums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
print(nums[2:5])     # [2, 3, 4]         从 2 号位取 3 个
print(nums[:4])      # [0, 1, 2, 3]      省略 start 即从头
print(nums[7:])      # [7, 8, 9]         省略 stop 即到末尾
print(nums[-3:])     # [7, 8, 9]         最后三个
print(nums[::2])     # [0, 2, 4, 6, 8]   步长 2
print(nums[::-1])    # [9, 8, ..., 0]    整表反转
```

切片还能赋值和删除，这是列表相对元组多出的能力：

```python
colors = ["red", "green", "blue", "yellow"]
colors[1:3] = ["cyan"]          # 用一个元素替换两个元素
print(colors)                   # ['red', 'cyan', 'yellow']
del colors[1:]                  # 删除切片
print(colors)                   # ['red']
colors[:] = ["only"]            # 清空并写入（原地！引用同一对象的别处也会看到）
```

## 序列通用操作

这些操作对多数容器都适用，来自官方教程「序列和其他类型的比较」与小节「列表详解」：

| 表达式 | 结果 | 说明 |
| --- | --- | --- |
| `len([1, 2, 3])` | `3` | 元素个数 |
| `[1, 2, 3] + [4, 5]` | `[1, 2, 3, 4, 5]` | 拼接，产生新列表 |
| `["Hi"] * 3` | `["Hi", "Hi", "Hi"]` | 重复 |
| `3 in [1, 2, 3]` | `True` | 成员检测 |
| `for x in [1, 2, 3]: ...` | 依次取 1、2、3 | 迭代 |

嵌套列表按下标逐层取值：

```python
matrix = [["a", "b", "c"], [1, 2, 3]]
print(matrix[0])        # ['a', 'b', 'c']
print(matrix[0][1])     # b
```

不同类型的序列之间不能比较大小：`[1, 2] < (1, 2)` 会抛 `TypeError`。序列之间的比较是「字典序」——逐项比较，先分出胜负就停，短的若是长的前缀则短的小，`'ABC' < 'C' < 'Pascal' < 'Python'` 就是按 Unicode 码位逐字符比出来的。

## 更新列表：append、extend 还是 insert

```python
stack = [3, 4, 5]
stack.append(6)             # 末尾加一个元素 -> [3, 4, 5, 6]
stack.append([7, 8])        # 注意：整个列表成为「一个」元素 -> [3, 4, 5, 6, [7, 8]]

rows = []
rows.extend(["a", "b"])     # 把可迭代对象逐个摊平追加 -> ['a', 'b']
rows += ["c"]               # 等价写法，读起来更直白
rows.insert(0, "z")         # 在指定位置插入 -> ['z', 'a', 'b', 'c']
```

`append` 与 `extend` 的区别是新手最容易踩的坑：`append(x)` 永远只加一个元素，`extend(iterable)` 会把可迭代对象拆开。把整段文本当成一个元素塞进去时想用的就是 `append`。

## 删除元素：del、pop、remove

```python
a = [-1, 1, 66.25, 333, 333, 1234.5]
del a[0]          # 按下标删，无返回值
print(a)                       # [1, 66.25, 333, 333, 1234.5]
del a[2:4]        # 按切片删
print(a)                       # [1, 66.25, 1234.5]
del a[:]          # 清空（保留列表对象本身）
print(a)                       # []

b = ["x", "y", "z"]
last = b.pop()    # 弹出并返回最后一个元素 -> 'z'
second = b.pop(0) # 弹出指定下标 -> 'x'；从头部弹出是 O(n)
b.remove("y")     # 按值删除第一个匹配项，找不到抛 ValueError
```

三者的分工：知道**下标**且不关心返回值用 `del`；知道**值**用 `remove`；要**拿到被删的元素**用 `pop`。

## 列表方法一览

官方教程 5.1「列表详解」列出的全部方法（多数示例来自原文，变量名已换为不遮蔽内置名的写法）：

| 方法 | 作用 |
| --- | --- |
| `a.append(value)` | 末尾添加一项，等价 `a[len(a):] = [value]` |
| `a.extend(iterable)` | 把可迭代对象的所有项追加到末尾 |
| `a.insert(index, value)` | 在 `index` 处插入；`insert(len(a), x)` 等同 `append` |
| `a.remove(value)` | 删除第一个值为 `value` 的项，不存在则 `ValueError` |
| `a.pop(index=-1)` | 删除并返回该位置的项，越界则 `IndexError` |
| `a.clear()` | 移除所有项，等价 `del a[:]` |
| `a.index(value[, start[, stop]])` | 首次出现的下标，找不到抛 `ValueError` |
| `a.count(value)` | 出现次数 |
| `a.sort(*, key=None, reverse=False)` | 原地排序，返回 `None` |
| `a.reverse()` | 原地反转，返回 `None` |
| `a.copy()` | 浅拷贝 |

串起来跑一遍官方示例：

```python
fruits = ["orange", "apple", "pear", "banana", "kiwi", "apple", "banana"]
print(fruits.count("apple"))         # 2
print(fruits.index("banana"))        # 3
print(fruits.index("banana", 4))     # 6 —— 从 4 号位往后找下一个
fruits.reverse()
fruits.append("grape")
fruits.sort()
print(fruits)
# ['apple', 'apple', 'banana', 'banana', 'grape', 'kiwi', 'orange', 'pear']
print(fruits.pop())                  # 'pear' —— 排序后 pop 取出的是最大值
```

官方教程在这里特别提醒两点设计原则：

- `insert`、`remove`、`sort` 这类**只修改列表**的方法一律返回 `None`。这不是疏忽，而是 Python 对所有可变数据结构的统一约定，因此 `fruits = fruits.sort()` 会把列表变成 `None`。
- 不是所有元素都能排序。`[None, "hello", 10]` 排不了，因为整数与字符串不可比较、`None` 与其他类型不可比较；`3+4j < 5+7j` 也不是合法比较。混合类型时要用 `key` 把比较目标统一到可比较的类型。

## 用列表当堆栈，用 deque 当队列

末尾添加、末尾弹出，列表天然就是栈（后进先出）：

```python
history = []
for turn in ["问题1", "问题2", "问题3"]:
    history.append(turn)
print(history.pop())     # 问题3
```

但列表**不适合当队列**：在开头 `insert(0, x)` 或 `pop(0)` 要把后面所有元素整体后移，是 O(n) 操作。官方教程给出的正解是 `collections.deque`（两端都 O(1)）：

```python
from collections import deque

queue = deque(["Eric", "John", "Michael"])
queue.append("Terry")      # Terry 到了
queue.append("Graham")     # Graham 到了
print(queue.popleft())     # Eric —— 最早到的先处理
print(queue.popleft())     # John
print(queue)               # deque(['Michael', 'Terry', 'Graham'])
```

需要「滑动窗口」「任务队列」时直接换 `deque`，用法详见《collections 常用容器：Counter、defaultdict 与 deque》。

## 常见坑

**1. 别拿内置名当变量名。** `list = [...]`、`dict = {}`、`sum = 0` 都会在当前作用域遮蔽同名内置类型/函数，之后想调用 `list(range(3))` 就只会得到 `TypeError: 'list' object is not callable`，而且报错位置离真正的赋值行很远。模块级的循环计数变量尤其要留意。

**2. `b = a` 不是拷贝。** 它只是给同一个列表起了个新名字：

```python
a = [1, 2, 3]
b = a          # 只是别名，不是拷贝
b.append(4)
print(a)          # [1, 2, 3, 4] —— a 也被改了
```

要独立副本用 `a.copy()` 或 `a[:]`；里面还套着列表时需要 `copy.deepcopy()`，参见《可变/不可变与深浅拷贝》。

**3. 遍历时增删元素会跳项。** 迭代器的位置是按索引推进的，边遍历边删除会让后面的元素前移：

```python
nums = [1, 2, 3, 4, 5, 6]
for n in nums:            # 错误示范：删掉偶数
    if n % 2 == 0:
        nums.remove(n)    # 结果只删掉了 2 和 4，6 被跳过
```

正确做法是遍历副本或直接写推导式：`nums = [n for n in nums if n % 2]`（详见《列表推导式》）。

**4. `[[0] * 3] * 3` 造不出真正的二维列表。** 外层 `* 3` 复制的是**同一个内层列表的引用**，改 `grid[0][0]` 会让三行同时变化。用推导式：`[[0] * 3 for _ in range(3)]`。

**5. `sort()` 与 `sorted()` 别混。** 前者原地改、返回 `None`；后者返回新列表、原表不动。想在循环里「拿到排好序的结果」时用 `sorted()`，并配合 `key`（详见《lambda 与高阶函数》）。

**6. 空列表是真值 `False`。** `if not rows:` 就够判断「没有数据」，不必写 `if len(rows) == 0:`；但要小心它同时把 `None`、空字符串、空字典一并判为假，需要区分「空」与「未设置」时得显式写 `if rows is None:`。

## 最小项目：清洗一批模型输出

把「收集 → 去噪 → 排序 → 截断」这条最常见的链路串起来：

```python
raw_outputs = [
    "  检索增强生成（RAG） \n",
    "\n\n",
    "  智能体（Agent）  ",
    "微调（Fine-tuning）",
    "  ",
    "  检索增强生成（RAG）  ",
]

answers = []
for line in raw_outputs:
    cleaned = line.strip()          # 去掉首尾空白与换行
    if cleaned:                     # 过滤空字符串（空串真值为 False）
        answers.append(cleaned)

answers = sorted(set(answers))      # 去重后按字典序排列
top2 = answers[:2]                  # 取前两条

print(answers)
# ['智能体（Agent）', '检索增强生成（RAG）', '微调（Fine-tuning）']
print(f"共 {len(answers)} 条，截断后：{top2}")
```

这段代码里出现的模式——`append` 收集、`strip` 清洗、真值过滤、`sorted(set(...))` 去重排序、切片截断——几乎每个数据预处理脚本都会重放一遍。

## 延伸阅读

- 官方教程 5.1 列表详解：<https://docs.python.org/zh-cn/3/tutorial/datastructures.html#more-on-lists>
- 官方教程 3.1.3 列表：<https://docs.python.org/zh-cn/3/tutorial/introduction.html#lists>
- 可变序列类型的完整操作表：<https://docs.python.org/zh-cn/3/library/stdtypes.html#mutable-sequence-types>
- 站内相邻文章：《列表推导式》《元组与序列解包》《可变/不可变与深浅拷贝》《迭代与解包技巧》《collections 常用容器：Counter、defaultdict 与 deque》

<details>
<summary>参考：内置序列类型的完整操作表（译自官方库文档）</summary>

以下表格译自 [The Python Standard Library — 序列类型](https://docs.python.org/zh-cn/3/library/stdtypes.html#sequence-types-list-tuple-range)。`p`、`q` 表示序列，`i`、`j` 表示整数，`t` 表示可迭代对象。字符串只能与字符串拼接，字节串只能与字节串拼接。

| 运算 | 结果 | 适用类型 |
| --- | --- | --- |
| `x in p` | `p` 中含值 `x` 时为真 | 列表、元组、字符串、字节串、`range` |
| `x not in p` | `(x in p)` 的否定 | 同上 |
| `p + q` | 拼接两个序列 | 同类序列 |
| `p * n`、`n * p` | 重复 `n` 次；`n` 小于 0 时结果为空序列 | 列表、元组、字节串 |
| `p[i]` | 第 `i` 个元素，负数从尾部计数，越界抛 `IndexError` | 列表、元组、字符串、字节串、`range` |
| `p[i:j]` | 切片；`i`、`j` 缺省时分别取边界值 | 同上 |
| `p[i:j:k]` | 步长为 `k` 的切片 | 同上 |
| `len(p)` | 元素个数 | 同上 |
| `min(p)`、`max(p)` | 最小/最大元素；空序列抛 `ValueError`；可用 `key` 自定义比较 | 同上 |
| `p[i] = x` | 第 `i` 个元素重新绑定为 `x` | **仅列表** |
| `p[i:j] = t` | 切片内容替换为可迭代对象 `t` 的项 | **仅列表** |
| `del p[i:j]` | 移除该切片 | **仅列表** |
| `p[i:j:k] = t` | 以步长 `k` 的切片方式赋值，`t` 的长度必须匹配 | **仅列表** |
| `p.append(x)` | 等价于 `p[len(p):] = [x]` | **仅列表** |
| `p.clear()` | 等价于 `del p[:]` | **仅列表** |
| `p.extend(t)` | 等价于 `p[len(p):] = t` | **仅列表** |
| `p += t`、`p = p + t` | 与 `extend` 近似，但 `+=` 是原地操作，会影响共享同一对象的别名 | **仅列表** |
| `p.pop()` | 移除并返回最后一项 | **仅列表** |
| `p.remove(x)` | 移除第一个等于 `x` 的项，不存在抛 `ValueError` | **仅列表** |
| `p.reverse()` | 原地反转 | **仅列表** |
| `p.count(x)` | `x` 出现的次数 | 列表、元组、字符串、字节串、`range` |
| `p.index(x[, i[, j]])` | 在 `[i, j)` 内首次出现 `x` 的下标，找不到抛 `ValueError` | 列表、元组、`range` |
| `x = list(p)` | 把任意可迭代对象转为列表 | 通用 |
| `p *= n` | 原地重复 `n` 次 | **仅列表** |

用户自定义对象实现了 `__getitem__` 即可被索引与切片；实现 `__len__` 才能被 `in`、`min`、`max` 等正确使用。

</details>

---

> **来源**：抓取于 2026-09-19。译自 [5. 数据结构 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/datastructures.html)（Python Software Foundation，PSF 许可证第 2 版），并引 [3.1.3 列表 — Python 官方教程](https://docs.python.org/zh-cn/3/tutorial/introduction.html#lists) 与 [序列类型 — list、tuple、range — Python 标准库](https://docs.python.org/zh-cn/3/library/stdtypes.html#sequence-types-list-tuple-range)（作者与许可同上）。本文方法表为官方库文档对应小节的中文翻译，示例变量名与编者注为本站所加。
