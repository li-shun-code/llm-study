---
title: 迭代与解包技巧
source_url: https://docs.python.org/zh-cn/3/tutorial/datastructures.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 10
group: 控制流
---
同样一段「遍历并处理数据」的代码，写成 `for i in range(len(items))` 还是 `for i, item in enumerate(items)`，读起来的差别就是「机器思维」和「Python 思维」的差别。官方教程用一小节 5.6「循环的技巧」总结了这套惯用法，本篇把它展开，并补上解包在循环里的用法——它们同时是读懂他人 Python 代码的钥匙。

前提：已了解《列表：增删改查与切片》《字典：键值映射与 JSON》《元组与序列解包》。

## 字典：用 items() 同时拿键和值

```python
knights = {"gallahad": "the pure", "robin": "the brave"}
for k, v in knights.items():
    print(k, v)
# gallahad the pure
# robin the brave
```

反面写法是「遍历键再回查值」，多一次哈希查找且更啰嗦：

```python
knights = {"gallahad": "the pure", "robin": "the brave"}

for k in knights:
    print(k, knights[k])       # 能跑，但不如 items()
```

只要值时可以 `for v in knights.values():`，只要键时直接 `for k in knights:`（默认就是迭代键）。

## 序列：用 enumerate() 拿序号

```python
for i, v in enumerate(["tic", "tac", "toe"]):
    print(i, v)
# 0 tic
# 1 tac
# 2 toe
```

`enumerate` 还接受 `start` 参数，用来生成人类可读的编号：

```python
for no, doc in enumerate(["rag.md", "agent.md"], start=1):
    print(f"{no}. {doc}")
# 1. rag.md
# 2. agent.md
```

注意 `enumerate` 返回的是惰性的迭代器而不是列表，`list(enumerate(...))` 才会真的展开。

## 多个序列：zip() 一一配对

```python
questions = ["name", "quest", "favorite color"]
answers = ["lancelot", "the holy grail", "blue"]

for q, a in zip(questions, answers):
    print(f"What is your {q}?  It is {a}.")
# What is your name?  It is lancelot.
# What is your quest?  It is the holy grail.
# What is your favorite color?  It is blue.
```

**默认行为是「最短的算」。** 长度不等时多出来的元素被静默丢弃，这是数据管道里最隐蔽的 bug 来源之一。Python 3.10 起可以显式要求等长：

```python
names = ["Ann", "Bob", "Cindy"]
scores = [90, 85]

list(zip(names, scores, strict=True))
# ValueError: zip() argument 2 is shorter than argument 1  —— 立刻暴露长度不一致
```

需要按最长的补齐时用 `itertools.zip_longest`，缺失位置填 `fillvalue`：

```python
from itertools import zip_longest

names = ["Ann", "Bob", "Cindy"]
scores = [0.82, 0.91]

pairs = list(zip_longest(names, scores, fillvalue=None))
print(pairs)      # [('Ann', 0.82), ('Bob', 0.91), ('Cindy', None)]
```

`zip` 还能「转置」二维数据（星号是解包运算符，详见《函数：参数种类与返回值设计》）：

```python
columns = [["a1", "b1", "c1"], ["a2", "b2", "c2"]]   # 两行三列
rows = list(zip(*columns))                            # 三组，每组两个值
print(rows)                # [('a1', 'a2'), ('b1', 'b2'), ('c1', 'c2')]
print(dict(zip(["id", "name"], ["u1", "Ann"])))       # 两个列表拼成字典
# {'id': 'u1', 'name': 'Ann'}
```

## 反向与排序遍历

逆向循环用 `reversed()`，它返回迭代器、不复制原序列：

```python
for i in reversed(range(1, 10, 2)):
    print(i, end=" ")      # 9 7 5 3 1
```

按指定顺序遍历但不改动原序列，用 `sorted()`（不是 `list.sort()`，后者原地排序并返回 `None`）：

```python
basket = ["apple", "orange", "apple", "pear", "orange", "banana"]
for item in sorted(basket):
    print(item, end=" ")      # apple apple banana orange orange pear
```

`sorted()` 加 `set()` 是官方教程点名的组合——先去重再按序遍历：

```python
basket = ["apple", "orange", "apple", "pear", "orange", "banana"]

for f in sorted(set(basket)):
    print(f, end=" ")         # apple banana orange pear
```

## 循环里解包：让结构自己说话

右侧是元组或列表时，循环变量可以直接写成解包形式：

```python
points = [(0, 0), (1, 2), (3, 4)]
for x, y in points:
    print(x + y, end=" ")         # 0 3 7

records = [("rag", 0.91, 12), ("agent", 0.78, 30)]
for name, score, _ in records:    # 不关心的字段用 _
    print(f"{name}={score}")
# rag=0.91
# agent=0.78
```

配合星号可以吸收任意长度的尾部：

```python
lines = ["cmd arg1 arg2", "run x"]
for head, *rest in (line.split() for line in lines):
    print(head, rest)
# cmd ['arg1', 'arg2']
# run ['x']
```

字典项本质也是元组，所以 `for k, v in d.items()` 就是这个规则的普通应用。

## 边循环边改列表：官方教程的选择

官方教程的最后一句建议很直白：**在循环里修改列表时，创建新列表通常更简单也更安全。**

```python
import math

raw_data = [56.2, float("nan"), 51.7, 55.3, 52.5, float("nan"), 47.8]
filtered_data = []
for value in raw_data:
    if not math.isnan(value):
        filtered_data.append(value)

print(filtered_data)     # [56.2, 51.7, 55.3, 52.5, 47.8]
```

同一个需求用推导式更紧凑（详见《列表推导式》）：

```python
import math

raw_data = [56.2, float("nan"), 51.7]
filtered_data = [v for v in raw_data if not math.isnan(v)]
print(filtered_data)   # [56.2, 51.7]
```

在原地删除的写法会出问题，原因见《列表：增删改查与切片》的「遍历时增删元素会跳项」。

## 循环的 else 子句

`for`/`while` 可以带 `else`，含义是「循环**没有被 break 打断**就执行」。这是官方教程 4.5 明确列出、却在他人代码里最常被误读的结构：

```python
for n in range(2, 10):
    if n % 2 == 0:
        continue
    if n == 7:
        break
else:
    print("循环完整跑完，没有遇到 7")
# 因为 break 提前退出，else 分支不执行；上面没有任何输出
```

`continue` 不影响 `else`，只有 `break` 会。读不懂时把它翻译成「没找到反例才执行」。

## 海象运算符：在表达式里赋值

Python 与 C 不同，表达式内部赋值必须显式使用 `:=`（官方教程 5.7）：

```python
data = ["a", "", "abc", "abcd"]
longest = 0
if (length := max(len(s) for s in data)) > 3:
    longest = length
print(longest)        # 4
```

在 `while` 里读入并判断特别顺手：

```python
values = iter(["1", "2", ""])
while (line := next(values, "")) != "":
    print(line, end=" ")      # 1 2
```

不要为了少写一行而滥用；`:=` 的价值是「这次求值的结果后面还要用」。

## 标准库的循环工具

`itertools` 是这一族的正规军，常用几个足够应付大部分场景：

```python
from itertools import chain, islice, cycle

# 多个可迭代对象首尾相接，不生成中间列表
print(list(chain([1, 2], (3, 4), "ab")))        # [1, 2, 3, 4, 'a', 'b']

# 取前 n 个，等价切片但对任意可迭代对象有效
print(list(islice(range(100), 3)))              # [0, 1, 2]

# 无限循环（务必配合 islice 或 break 使用）
it = cycle(["primary", "secondary"])
print([next(it) for _ in range(5)])             # ['primary', 'secondary', 'primary', 'secondary', 'primary']
```

批量切块（每 1000 条一批送进模型）用推导式加切片即可，不必引第三方库：

```python
def batched(items, size):
    return [items[i:i + size] for i in range(0, len(items), size)]

print(batched(list(range(7)), 3))     # [[0, 1, 2], [3, 4, 5], [6]]
```

## 常见坑

**1. `zip` 静默截断。** 只用 `zip(a, b)` 时长度不一致不会报警，处理数据集时可能悄悄丢掉一半样本。默认写 `strict=True`（3.10+）是一个便宜的保险。

**2. `for i in range(len(seq))`。** 能用 `enumerate` 或 `for item in seq` 时就不要按下标遍历；需要同时改原序列时（原地写回）才保留下标写法。

**3. 混淆 `sorted(x)` 与 `x.sort()`。** 前者返回新列表、可接任意可迭代对象；后者原地排序、返回 `None`，且只有列表有。

**4. 在 `for x in list_a:` 里改 `list_a`。** 迭代器按下标推进，删除会让元素被跳过。要过滤就构造新列表，要原地清就写 `list_a[:] = [x for x in list_a if keep(x)]`。

**5. 忘记可迭代对象只能消费一次。** 生成器、`map`、`filter`、`zip` 的对象用完即空，第二次遍历得到空结果。需要多次遍历就先 `list(...)` 物化。

```python
once = map(str.upper, ["a", "b"])
print(list(once))     # ['A', 'B']
print(list(once))     # []  —— 已经耗尽了
```

**6. 变量名遮蔽。** 循环里写 `sum = 0`、`list = []`、`max = 1` 会把同名内置函数覆盖掉，后续调用出现 `TypeError: 'int' object is not callable`。累加用 `total`、计数用 `count_so_far` 之类的名字（见《PEP 8 命名与代码风格基线》）。

**7. 把 `_` 当业务变量。** `for _, v in items:` 里丢弃值符合惯例，但别在后续代码里读取 `_`；需要保留时用有意义的名字。

## 最小项目：把两份清单对齐并汇总

典型的「读取 → 配对 → 编号 → 聚合」链路，只用本篇讲到的工具：

```python
doc_ids = ["d1", "d2", "d3", "d4"]
scores = [0.82, 0.91, 0.66]          # 少了一条：d4 没有打分
labels = ["相关", "相关", "不相关", "待复核"]

results = []
for idx, (doc_id, score, label) in enumerate(
        zip(doc_ids, scores, labels), start=1):
    results.append(f"{idx}. {doc_id} {score:.2f} {label}")

print("\n".join(results))
# 1. d1 0.82 相关
# 2. d2 0.91 相关
# 3. d3 0.66 不相关
#    —— d4 与「待复核」被 zip 静默丢掉了，一行都没输出

good = [line for line in results if "相关" in line and "不相关" not in line]
print(len(good))       # 2
```

最后一行的注释就是本篇第一号坑的现场：三份清单长度不一致时，`zip` 按最短的那份截断，`d4` 无声消失，报表看起来却「一切正常」。把 `zip(doc_ids, scores, labels)` 换成 `zip(doc_ids, scores, labels, strict=True)`，这段代码会立刻抛 `ValueError: zip() argument 2 is shorter than argument 1`，数据错位在上架前就暴露。

## 延伸阅读

- 官方教程 5.6 循环的技巧：<https://docs.python.org/zh-cn/3/tutorial/datastructures.html#looping-techniques>
- 官方教程 4.5 循环的 else 子句、5.7 深入条件控制：<https://docs.python.org/zh-cn/3/tutorial/controlflow.html#else-clauses-on-loops>
- itertools 迭代器工具：<https://docs.python.org/zh-cn/3/library/itertools.html>
- 内置函数 `enumerate`、`zip`、`reversed`：<https://docs.python.org/zh-cn/3/library/functions.html#enumerate>
- 站内相邻文章：《循环》《列表推导式》《函数：参数种类与返回值设计》《PEP 8 命名与代码风格基线》

---

> **来源**：抓取于 2026-09-19。译自 [5.6 循环的技巧 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/datastructures.html#looping-techniques)（Python Software Foundation，PSF 许可证第 2 版），并引 [5.7 深入条件控制](https://docs.python.org/zh-cn/3/tutorial/datastructures.html#more-on-conditions)、[4.5 循环的 else 子句](https://docs.python.org/zh-cn/3/tutorial/controlflow.html#else-clauses-on-loops) 与 [itertools — 创建高效迭代器的-building blocks](https://docs.python.org/zh-cn/3/library/itertools.html)（作者与许可同上）；`zip(strict=)`、可迭代对象一次性消费与最小项目为本站补充。
