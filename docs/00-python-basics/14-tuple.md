---
title: 元组与序列解包
source_url: https://docs.python.org/zh-cn/3/tutorial/datastructures.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 14
group: 容器与推导式
---
元组（`tuple`）常常被解释成「不可变的列表」，这个说法只对了三分之一。官方教程给出的定位更准确：**列表用来装一堆同类的东西，元组用来装一条记录的不同字段**。一次函数返回的 `(值, 错误)`、一条数据库记录的 `(id, 名称, 时间)`、棋盘上的一格坐标 `(x, y)`——它们是「结构」而不是「集合」，长度和每个位置的含义是固定的。正因为结构固定且不可变，元组才能被哈希、当字典的键、放进集合，也才能被解包成语义清晰的变量。

## 创建：真正的语法是逗号，不是括号

```python
t = 12345, 54321, "hello!"     # 不写括号也是元组
print(t[0])                    # 12345
print(t)                       # (12345, 54321, 'hello!')
```

括号在大多数场合只是为了让嵌套和表达式更易读：

```python
t = (12345, 54321, "hello!")
u = t, (1, 2, 3, 4, 5)         # 元组可以嵌套
print(u)                       # ((12345, 54321, 'hello!'), (1, 2, 3, 4, 5))
```

只有 0 个和 1 个元素的元组需要额外语法，这是官方教程都承认「丑陋但有效」的地方：

```python
empty = ()                     # 空元组
singleton = "hello",           # 注意末尾的逗号
print(len(empty), len(singleton))   # 0 1
print(singleton)                    # ('hello',)
```

少了逗号，`(50)` 就是整数 50，`type((50))` 是 `<class 'int'>`。这类 bug 不会报错，只会让后面的解包突然炸出 `TypeError: cannot unpack non-iterable int object`。

## 不可变的是「绑定」，不是「内容」

元组不允许元素重新赋值：

```python
t = (1, 2, 3)
t[0] = 88888
# TypeError: 'tuple' object does not support item assignment
```

（上面这行是故意的错误写法，用来展示报错信息。）但元组可以包含可变对象，且那些对象**照样能改**：

```python
v = ([1, 2, 3], [3, 2, 1])
v[0].append(99)          # 允许：改的是列表对象本身
print(v)                 # ([1, 2, 3, 99], [3, 2, 1])
```

想换掉元组里的某个槽位则不行——这两件事的区别正是「内容可变」与「绑定可变」：

```python
v = ([1, 2, 3], [3, 2, 1])
v[0] = [0]
# TypeError: 'tuple' object does not support item assignment
```

由此推出两条实用结论：

- 「元组不可变」≠「元组一定可哈希」。含列表的元组不可哈希，因此不能当字典键，`hash(([1], 2))` 会抛 `TypeError: unhashable type: 'list'`。
- 重新赋值 `t = (...)` 不是修改原对象，而是让名字指向一个**新对象**（`id(t)` 会变）。这跟《可变/不可变与深浅拷贝》里讲的绑定模型是同一件事。

## 序列解包：元组最实用的半边

官方教程把 `t = 12345, 54321, "hello!"` 称为**元组打包**（packing），反过来叫**序列解包**（unpacking）：

```python
t = 12345, 54321, "hello!"
x, y, z = t              # 左侧变量个数必须与右侧元素个数相等
print(x, z)              # 12345 hello!
```

用 `*` 接住剩余项（Python 3 起，解包赋值左侧允许恰好一个 `*`）：

```python
first, *rest = [1, 2, 3, 4, 5]
print(first, rest)       # 1 [2, 3, 4, 5]

*head, last = (1, 2, 3, 4)
print(head, last)        # [1, 2, 3] 4

x, y, *_ = (1, 2, 3, 4)  # 不关心的部分用惯用名 `_` 丢弃
```

交换两个变量不需要临时变量，本质就是「右边打包、左边解包」：

```python
a, b = 1, 2
a, b = b, a              # 右边先整体求值成元组 (2, 1)，再赋给左边
```

多重赋值其实是打包与解包的组合，`a = b = 0` 让两个名字指向同一个对象——如果右边是可变对象，改动会同时体现在两个名字上。

## 元组支持哪些操作

作为序列，元组支持列表能做的**读取**类操作，但没有 `append`/`sort` 等修改类方法：

```python
row = ("RAG", 0.91, 128)
print(len(row))                 # 3
print(row[1])                   # 0.91
print(row[1:])                  # (0.91, 128)
print(row.count("RAG"))         # 1
print(row.index(0.91))          # 1
print("Agent" in row)           # False
print(("微调",) + row)          # ('微调', 'RAG', 0.91, 128) —— 生成新元组
print(("x",) * 3)               # ('x', 'x', 'x')
```

`tuple(iterable)` 负责类型转换，`list(tuple_obj)` 反向转换：

```python
print(tuple([1, 2, 3]))     # (1, 2, 3)
print(list((1, 2, 3)))      # [1, 2, 3]
```

想要「有字段名的元组」时用 `collections.namedtuple` 或 `dataclasses.dataclass`，可以用 `point.x` 这样的属性访问而不是 `p[0]`，详见《collections 常用容器：Counter、defaultdict 与 deque》与进阶模块的数据类篇目。

## 元组当字典键与集合元素

只有内容全部不可变的元组才能当键，这正是「多维坐标 → 值」这类映射的标准写法：

```python
distances = {(0, 0): 0, (0, 1): 1.0, (1, 1): 1.414}
print(distances[(0, 1)])              # 1.0

visited = {(1, 2), (3, 4)}            # 集合元素同理
print((1, 2) in visited)              # True
```

用列表当键会直接抛 `TypeError: unhashable type: 'list'`——字典要求键可哈希，而列表可以被原地修改，哈希值就会失效。这条规则也解释了为什么 `dict` 的键必须是字符串、数字、元组这类不可变对象（参见《字典》）。

## 常见坑

**1. 单元素元组忘写逗号。** `t = (50)` 是整数。函数返回单值时若下游按元组解包，就会在调用点炸开。

**2. 括号掩盖函数调用。** `func((1, 2))`、`func((1, 2, 3))` 里的双层括号容易看错；`tup = (1,)` 与 `tup = (1)` 的差别只能靠逗号区分。

**3. 用元组当「可变的累加器」。** 循环里 `result += (item,)` 每轮都会新建一个元组，是 O(n²) 的写法。正确做法是先 `append` 到列表，最后 `tuple(...)` 转一次。

**4. 解包数量不匹配。** `x, y = get_pair()` 在 `get_pair()` 返回三元组时抛 `ValueError: too many values to unpack`。不确定的结构用 `x, y, *rest = ...` 或先打印长度。

**5. 混淆「同一种结构」和「同一类元素」。** 官方教程的表述是：元组一般装异质元素、按位置语义访问；列表一般装同质元素、按整体迭代。把 `(姓名, 年龄)` 与 `[姓名1, 姓名2, 姓名3]` 用成同一种容器，是后续维护时读不懂代码的根源。

**6. 不要拿内置名当变量名。** `tuple = ...`、`list = ...`、`dict = ...` 会遮蔽内置类型；本文示例统一使用 `t`、`row`、`record` 之类的名字。

## 最小项目：一次调用的「值 + 元信息」

实际工程里最常见的元组用法是函数返回多个值，调用侧解包：

```python
def summarize(docs):
    """返回 (条数, 平均长度, 最长的一条)。"""
    if not docs:
        return 0, 0.0, ""
    total_len = sum(len(d) for d in docs)
    return len(docs), total_len / len(docs), max(docs, key=len)


chunks = ["检索增强生成", "智能体", "监督微调"]
count, avg_len, longest = summarize(chunks)
print(f"共 {count} 条，平均 {avg_len:.1f} 字，最长：{longest}")
# 共 3 条，平均 4.3 字，最长：检索增强生成

# 暂时只关心一条时，用 _ 丢弃其余位置
_, average, _ = summarize(chunks)
print(average)     # 4.333333333333334

# 输入为空也安全，返回结构保持一致
print(summarize([]))     # (0, 0.0, '')
```

固定返回元组的好处是调用侧一眼能看出「这个函数给出几个结果、分别是什么」；字段一旦超过三个或者需要命名，就该换成数据类。

## 延伸阅读

- 官方教程 5.3 元组和序列：<https://docs.python.org/zh-cn/3/tutorial/datastructures.html#tuples-and-sequences>
- 官方教程 3.1.2 元组：<https://docs.python.org/zh-cn/3/tutorial/introduction.html#tuples-and-sequences>
- 元组类型参考：<https://docs.python.org/zh-cn/3/library/stdtypes.html#tuple>
- 站内相邻文章：《列表：增删改查与切片》《迭代与解包技巧》《字典》《可变/不可变与深浅拷贝》

---

> **来源**：抓取于 2026-09-19。译自 [5.3 元组和序列 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/datastructures.html#tuples-and-sequences)（Python Software Foundation，PSF 许可证第 2 版），并引 [元组 — Python 标准库](https://docs.python.org/zh-cn/3/library/stdtypes.html#tuple)（作者与许可同上）。「字典键」「最小项目」等小节与编者注为本站补充。
