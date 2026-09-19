---
title: 集合：去重与成员运算
source_url: https://docs.python.org/zh-cn/3/library/stdtypes.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 13
group: 容器与推导式
---
集合（`set`）是**无序、不重复**的元素容器，底层是哈希表。它只回答三类问题：这个元素在不在？这批东西去过重后剩多少？两批东西的交集/差集是什么？看起来窄，但正是这三个问题支撑了日常里最常用的几段代码：去重、判断命中、比对两份清单的差异。

需要保序或需要重复计数时不要用集合，用列表或 `Counter`（见《collections 常用容器：Counter、defaultdict 与 deque》）。

## 创建集合

```python
letters = {"a", "b", "c"}              # 花括号 + 逗号
from_list = set([1, 2, 2, 3, 3])       # 从可迭代对象构造，顺带去重
from_string = set("abracadabra")       # 字符串会被拆成单字符
empty = set()                          # 空集合只能这样写
```

两个反直觉的地方，官方教程都专门提醒过：

- `{}` 创建的是**空字典**，不是空集合。
- 集合是无序的，`print` 出来的顺序、`for` 迭代的顺序都**不保证**与插入顺序一致，也不要依赖它跨运行稳定。要保序去重请另想办法（见下文最小项目）。

集合的元素必须可哈希，因此列表、字典、集合不能进集合，需要嵌套时换成 `frozenset`：

```python
ok = {(1, 2), "a", 3.5, True}
nested_ok = {frozenset({1, 2}), frozenset({3})}
bad = {[1, 2]}
# TypeError: cannot use 'list' as a set element (unhashable type: 'list')
```

顺带一个经典坑：`True` 与 `1`、`False` 与 `0` 哈希相同且相等，所以 `{1, True}` 的长度是 1。

## 成员检测：这就是集合存在的理由

```python
allowed = {"read", "write", "admin"}
print("admin" in allowed)        # True
print("delete" not in allowed)   # True
```

`in` 对集合是平均 O(1)，对列表是 O(n)。把「待匹配的一大批词」放进集合再逐个判断，是集合最典型的性能收益：

```python
keywords = {"prompt", "token", "embedding", "agent"}
tokens = ["hello", "prompt", "world"] * 10000

hits_via_set = sum(1 for t in tokens if t in keywords)
# 若写成 `t in ["prompt", "token", ...]`，每个 token 都要线性扫一遍关键字表
print(hits_via_set)     # 10000
```

## 集合运算：交集、并集、差集、对称差

官方教程用两个单词演示了四种运算，语义一目了然：

```python
a = set("abracadabra")
b = set("alacazam")

print(a)      # {'a', 'r', 'b', 'c', 'd'}        a 中的独有字母
print(a - b)  # {'r', 'b', 'd'}                  在 a 不在 b
print(a | b)  # {'a', 'c', 'r', 'd', 'b', 'm', 'z', 'l'}   并集
print(a & b)  # {'a', 'c'}                       两者都有
print(a ^ b)  # {'r', 'b', 'd', 'm', 'z', 'l'}   不同时在两者中
```

每种运算都有对应的方法形式，方法形式的好处是**参数可以是任意可迭代对象**，而运算符要求两边都是集合：

```python
old_docs = {"a.md", "b.md", "c.md"}
new_docs = {"b.md", "c.md", "d.md"}

print(new_docs - old_docs)                       # 新增：{'d.md'}
print(old_docs - new_docs)                       # 下架：{'a.md'}
print(old_docs & new_docs)                       # 保留：{'b.md', 'c.md'}
print(old_docs ^ new_docs)                       # 变动的两边合计：{'a.md', 'd.md'}

print(old_docs.difference(["a.md", "x"]))        # 参数可以是列表：{'b.md', 'c.md'}
print(old_docs.isdisjoint({"z.md"}))             # True：无交集
```

用运算符混合 `set` 与 `frozenset` 是可以的（结果类型取第一个操作数），但 `set - [1, 2]` 会抛 `TypeError: unsupported operand type(s)`，改用 `set.difference([1, 2])`。

原地版本用于「一边扫一边累积」：

```python
seen = set()
for batch in [["a", "b"], ["b", "c"], ["d"]]:
    seen.update(batch)          # 等价于 |=，但接受任意可迭代对象
print(seen)                     # {'a', 'b', 'c', 'd'}
```

`update()` 一次可以接多个可迭代对象：`s.update({1, 3}, [4, 5])`。

## 增删元素

```python
s = {"google", "runoob", "taobao"}
s.add("facebook")               # 加入一个元素（已存在则无效果）
s.discard("not-here")           # 删除，不存在时**不报错**
s.remove("google")              # 删除，不存在时抛 KeyError
print(sorted(s))                # ['facebook', 'runoob', 'taobao']

pool = {"task-a", "task-b", "task-c"}
picked = pool.pop()             # 移除并返回「任意」一个元素；空集合抛 KeyError
print(picked, len(pool))        # 例如 task-a 2 —— 返回哪个元素不固定
```

因为集合无序，`pop()` 返回哪个元素不可预测，只适合「随便拿一个」的场景（比如任务池）。**不要**把它当成「取第一个」。

## 子集、超集与相等

```python
readonly = {"read"}
default = {"read", "write"}

print(readonly < default)        # True：真子集
print(default >= readonly)       # True：超集
print(readonly == {"read"})      # True：忽略顺序与重复
print(default.issuperset(readonly))
```

集合的比较是**偏序**（子集关系），不是全序：两个互不包含的非空集合，`a < b`、`a == b`、`a > b` 全为 `False`。这意味着把一堆集合丢进 `list.sort()` 结果是不确定的——要排序请先转成排序后的元组作为 key。

## 集合推导式

与列表推导式同构，只是外层用花括号且结果去重：

```python
unique_lengths = {len(w) for w in ["ab", "abc", "ab", "abcd", "abc"]}
print(sorted(unique_lengths))            # [2, 3, 4]

both = {c for c in "abracadabra"} & {c for c in "alacazam"}
print(sorted(both))                      # ['a', 'c']
```

## 常见坑

**1. 以为集合有序。** `list(set(my_list))[0]` 取到的不是原来的第一个元素；集合也不能下标访问，`my_set[0]` 抛 `TypeError: 'set' object is not subscriptable`。想「按集合去重、按原顺序输出」就写推导式（见最小项目）。

**2. 需要「集合的集合」时用 `frozenset`。** 普通 `set` 不可哈希，不能当元素也不能当字典键；`frozenset` 是完全不可变的集合版本，支持除 `add`/`update`/`remove`/`discard` 之外的全部集合运算。

**3. `remove` 与 `discard` 混用。** 批量清洗数据时优先 `discard`，避免为「可能不存在」写 `if x in s`；确属异常状态时才用 `remove`，让 `KeyError` 暴露问题。

**4. 遍历中改大小。** 与字典一样，`for x in s: s.discard(x)` 会抛 `RuntimeError: Set changed size during iteration`。要边遍历边删就遍历副本：`for x in set(s): ...` 或构造新集合。

**5. 别拿内置名当变量名。** `set = {...}`、`dict`、`list` 一样会遮蔽内置构造器，写完这一行后下一行的 `set(...)` 就是 `TypeError: 'set' object is not callable`。

**6. `set("abc")` 拆字符。** 想把一个字符串整体放进集合要写 `{"abc"}` 或 `set(["abc"])`；对含中文的字符串 `set(s)` 得到的是单字集合，常被误当成「分词去重」。

## 最小项目：两版知识库的差异与去重保序

集合最常见的实战形态就是「对比两份清单」加「批量去重」：

```python
v1_docs = ["rag.md", "agent.md", "prompt.md", "eval.md", "rag.md"]
v2_docs = ["agent.md", "prompt.md", "rag.md", "mcp.md"]

s1, s2 = set(v1_docs), set(v2_docs)

added = sorted(s2 - s1)          # 新增（sorted 让输出稳定）
removed = sorted(s1 - s2)        # 删除
kept = sorted(s1 & s2)           # 保留

print("新增:", added)             # 新增: ['mcp.md']
print("删除:", removed)           # 删除: ['eval.md']
print("保留:", kept)              # 保留: ['agent.md', 'prompt.md', 'rag.md']

# 保序去重：用集合做「已见」判重，用列表保持顺序
deduped = []
seen = set()
for name in v1_docs:
    if name not in seen:
        seen.add(name)
        deduped.append(name)
print(deduped)                   # ['rag.md', 'agent.md', 'prompt.md', 'eval.md']
```

这段「集合负责判断、列表负责顺序」的配合，比试图让集合去记顺序要可靠得多。

## 延伸阅读

- 集合类型 — set、frozenset：<https://docs.python.org/zh-cn/3/library/stdtypes.html#set-types-set-frozenset>
- 官方教程 5.4 集合：<https://docs.python.org/zh-cn/3/tutorial/datastructures.html#sets>
- 站内相邻文章：《字典：键值映射与 JSON》《列表：增删改查与切片》《collections 常用容器：Counter、defaultdict 与 deque》

<details>
<summary>参考：集合的完整方法表（译自官方库文档）</summary>

以下译自 [集合类型 — set、frozenset](https://docs.python.org/zh-cn/3/library/stdtypes.html#set-types-set-frozenset)。除特别说明外，`s`、`t`、`u` 表示集合，方法形式（`s.union(t, u)`）接受任意可迭代对象作参数，而运算符形式（`s | t | u`）要求所有参与方都是集合。

| 方法 / 运算符 | 说明 |
| --- | --- |
| `len(s)` | 元素个数 |
| `x in s`、`x not in s` | 成员检测 |
| `s.issubset(t)`、`s <= t` | `s` 是否为 `t` 的子集 |
| `s < t` | `s` 是否为 `t` 的真子集 |
| `s.issuperset(t)`、`s >= t`、`s > t` | 超集与真超集 |
| `s.union(t, ...)`、`s \| t` | 并集 |
| `s.intersection(t, ...)`、`s & t` | 交集 |
| `s.difference(t, ...)`、`s - t` | 差集（在 `s` 不在其余集合） |
| `s.symmetric_difference(t)`、`s ^ t` | 对称差集（只在其中之一） |
| `s.update(t, ...)`、`s \|= t`、`s = s \| t` | 原地并集 |
| `s.intersection_update(t, ...)`、`s &= t` | 原地交集 |
| `s.difference_update(t, ...)`、`s -= t` | 原地差集 |
| `s.symmetric_difference_update(t)`、`s ^= t` | 原地对称差 |
| `s.add(x)` | 加入元素 |
| `s.remove(x)` | 移除元素，不存在抛 `KeyError` |
| `s.discard(x)` | 移除元素，不存在时静默 |
| `s.pop()` | 移除并返回任意元素，空集合抛 `KeyError` |
| `s.clear()` | 清空 |
| `s.copy()` | 浅拷贝 |
| `s.isdisjoint(t)` | 是否无交集 |

集合的相等定义为「元素完全相同」，与插入顺序无关；`<=` 与 `>=` 构成偏序而非全序，因此 `set` 不能可靠地参与排序。

`frozenset` 与 `set` 的构造方式相同（`frozenset(iterable)`），但没有 `add`、`update`、`remove`、`discard`、`pop`、`clear` 这些修改方法；其他方法（含 `copy()`）行为一致。构造时若迭代器多次产出同一元素，只保留一个。

</details>

---

> **来源**：抓取于 2026-09-19。译自 [集合类型 — set、frozenset — Python 标准库（中文）](https://docs.python.org/zh-cn/3/library/stdtypes.html#set-types-set-frozenset)（Python Software Foundation，PSF 许可证第 2 版），并引 [5.4 集合 — Python 官方教程](https://docs.python.org/zh-cn/3/tutorial/datastructures.html#sets)（作者与许可同上）。性能对照、差异比对与去重保序等实战小节为本站补充。
