---
title: 字典：键值映射与 JSON
source_url: https://docs.python.org/zh-cn/3/tutorial/datastructures.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 15
group: 容器与推导式
---
字典（`dict`）是「按名字取值」的容器：键 → 值的映射，平均 O(1) 查找。它比其他任何容器都更贴近 Python 的日常——函数关键字参数是字典、模块命名空间是字典、JSON 对象解析出来是字典、调用模型 API 的请求体也是字典。可以说，把字典用顺手，Python 就通了三分之一。

官方教程的定义是：字典是**键值对的集合，且键必须唯一**；与以连续整数索引的序列不同，字典以键索引，键可以是任何不可变类型。自 Python 3.7 起，字典**保证保持插入顺序**（3.6 是实现细节，3.7 起写进语言规范），因此遍历顺序可预期。

## 创建字典

```python
tel = {"jack": 4098, "sape": 4139}      # 字面量
empty = {}                               # 空字典（注意：不是空集合）
nested = {"messages": [{"role": "user", "content": "你好"}], "model": "gpt-5-mini"}
```

`dict()` 构造函数的三种常用形式，都来自官方教程：

```python
print(dict([("sape", 4139), ("guido", 4127)]))   # 由键值对序列构造
# {'sape': 4139, 'guido': 4127}
print(dict(sape=4139, guido=4127, jack=4098))    # 键是简单字符串时用关键字参数
# {'sape': 4139, 'guido': 4127, 'jack': 4098}
print(dict.fromkeys(["a", "b"], 0))              # 共用一个初始值
# {'a': 0, 'b': 0}
print({x: x ** 2 for x in (2, 4, 6)})            # 字典推导式
# {2: 4, 4: 16, 6: 36}
```

**键必须不可变（可哈希）。** 字符串、数字、`True`/`False`/`None`、只含不可变元素的元组都可以；列表、字典、集合不行，因为它们能被原地修改、哈希值会变：

```python
bad = {["a"]: 1}
# TypeError: unhashable type: 'list'
ok = {("x", "y"): 1}        # 元组作键，见《元组与序列解包》
```

同一个键写两次，后一个值生效；`1` 与 `True`、`1` 与 `1.0` 在字典里算同一个键（哈希与相等性都成立），这类隐式合并要在处理用户输入时特别当心。

## 取值：d[k]、get、in、setdefault

选哪个读法，取决于「键不存在时你希望发生什么」：

```python
tel = {"jack": 4098, "guido": 4127}

print(tel["jack"])              # 4098 —— 确定该存在时用下标
print(tel.get("irv"))           # None —— 可能不存在，且「没有」就是答案
print(tel.get("irv", 0))        # 0    —— 给默认值
print("guido" in tel)           # True —— 只判断存在性，不取值
print(tel.setdefault("irv", 0)) # 0    —— 不存在则写入并返回默认值
print(tel)                      # {'jack': 4098, 'guido': 4127, 'irv': 0}

try:
    print(tel["irv2"])
except KeyError as exc:
    print("KeyError:", exc)     # KeyError: 'irv2' —— 下标取不存在的键直接抛错
```

`d[key]` 触发 `KeyError`，官方教程建议：不确定键是否存在时用 `get()`，它会返回 `None` 或指定的默认值。

`get()` 有一个易忽视的歧义：当某个键的值**本来就是 `None`**时，`d.get(k)` 返回 `None`，无法区分「键不存在」与「值就是 None」。这时用 `k in d` 或 `d.get(k, sentinel)` 配一个哨兵对象：

```python
MISSING = object()
profile = {"nickname": None}
print(profile.get("nickname", MISSING) is MISSING)        # False（键在，值是 None）
print(profile.get("avatar", MISSING) is MISSING)          # True （键不存在）
```

## 增、改、删

```python
d = {"model": "gpt-5-mini", "top_k": 5}
d["temperature"] = 0.2        # 新增，与覆盖用的是同一个语法
d["model"] = "gpt-5"          # 覆盖旧值，旧值丢失
print(d)                      # {'model': 'gpt-5', 'top_k': 5, 'temperature': 0.2}

removed = d.pop("temperature")        # 删除并返回被删的值 -> 0.2
missing = d.pop("seed", None)         # 键不存在时返回默认值，不抛 KeyError
last = d.popitem()                    # 弹出最后插入的一项 -> ('top_k', 5)
print(d)                              # {'model': 'gpt-5'}
del d["model"]                        # 按下标删，无返回值
print(d, bool(d))                     # {} False —— 空字典真值为假
```

`pop`、`popitem`、`clear`、`setdefault`、`copy`、`fromkeys`、`get`、`items`、`keys`、`values`、`update` 是 `dict` 的全部常用方法；`str(dict)` 这种老写法在 Python 3 里没有意义，直接用 `repr()` 或 `pprint`。

## 合并字典

Python 3.9 起有专门的合并运算符，比 `update` 更清晰：

```python
defaults = {"temperature": 0.0, "max_tokens": 1024, "stream": False}
user_opts = {"temperature": 0.7}

merged = defaults | user_opts          # 新字典；右侧的同名键胜出
print(merged)                          # {'temperature': 0.7, 'max_tokens': 1024, 'stream': False}

defaults |= user_opts                  # 原地更新，等价于 defaults.update(user_opts)
```

`{**a, **b}` 是老写法，效果与 `a | b` 相同，见旧代码时能认出来即可。

## 遍历：keys、values、items

```python
scores = {"RAG": 88, "Agent": 92, "微调": 79}

for name, score in scores.items():        # 同时拿键和值，最常用
    print(f"{name}: {score}")

for name in scores:                       # 默认迭代键（不要写 for name in scores.keys()）
    print(name)

total = sum(scores.values())              # 只要值
print(total)                              # 259

ordered = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
print(ordered)                            # [('Agent', 92), ('RAG', 88), ('微调', 79)]
```

`items()`、`keys()`、`values()` 返回的是**视图**（view）而不是列表：它们不复制数据，会随字典变化，因此 `len(d.items())` 可以正常用，但 `d.items()[0]` 不行（视图不支持下标），要写成 `list(d.items())[0]` 或用 `next(iter(d.items()))`。

字典推导式是「转换整个字典」的标准工具：

```python
raw = {"Name": "Alice", "  Age ": " 30 "}
cleaned = {k.strip().lower(): v.strip() for k, v in raw.items()}
print(cleaned)                        # {'name': 'Alice', 'age': '30'}
long_enough = {k: v for k, v in cleaned.items() if len(v) >= 3}
print(long_enough)                    # {'name': 'Alice'}
```

## 常见坑

**1. 别拿内置名当变量名。** 用 `dict = {}` 之后，`dict(...)` 就不再是构造函数了；`items`、`values`、`keys` 作为循环变量名也会遮蔽同名方法，写出 `items.items()` 这类自伤代码。

**2. 遍历中改变字典大小。** 增删键会抛 `RuntimeError: dictionary changed size during iteration`。删除要遍历副本：

```python
counts = {"a": 1, "b": 0, "c": 3}
for k in list(counts):          # list() 先生成键的快照
    if counts[k] == 0:
        del counts[k]
print(counts)                   # {'a': 1, 'c': 3}
```

修改已有键的值是安全的，只有增删键不行。

**3. `dict.fromkeys` 的默认值被共享。** 默认值必须是不可变对象：

```python
grid = dict.fromkeys(["a", "b"], [])
grid["a"].append(1)
print(grid)          # {'a': [1], 'b': [1]} —— 两个键指向同一个列表
```

需要每个键一个独立容器时，用 `collections.defaultdict(list)`（见《collections 常用容器：Counter、defaultdict 与 deque》）或 `copy.deepcopy`。

**4. `copy()` 是浅拷贝。** 嵌套字典里的内层对象仍然是共享的，详见《可变/不可变与深浅拷贝》。

**5. 用 `in` 判存在，别用 `try/except` 包一层下标。** `if k in d:` 可读性更好；只有在「大概率存在」的高并发写入场景下，`try: v = d[k] except KeyError:` 这种 EAFP 写法才更划算。

**6. 值可重复，键不可重复。** 反查需要自己建反向字典，且要考虑多对一：

```python
by_id = {"u1": "Ann", "u2": "Bob", "u3": "Ann"}
by_name = {}
for uid, name in by_id.items():
    by_name.setdefault(name, []).append(uid)
print(by_name)      # {'Ann': ['u1', 'u3'], 'Bob': ['u2']}
```

## 最小项目：把一段 JSON 变成可用的统计

字典与 JSON 是同一套结构，模型 API 返回的就是嵌套字典。下面这段无需第三方库即可运行：

```python
import json

raw = """
{"choices": [{"message": {"content": "检索增强生成"}}], "usage": {"prompt_tokens": 18, "completion_tokens": 6}}
{"choices": [{"message": {"content": "智能体"}}],     "usage": {"prompt_tokens": 22, "completion_tokens": 4}}
"""

total_prompt = 0
total_completion = 0
answers = []

for line in raw.strip().splitlines():
    payload = json.loads(line)                       # JSON 对象 -> dict
    answers.append(payload["choices"][0]["message"]["content"])
    total_prompt += payload["usage"]["prompt_tokens"]
    total_completion += payload["usage"]["completion_tokens"]

stats = {
    "count": len(answers),
    "prompt_tokens": total_prompt,
    "completion_tokens": total_completion,
    "total_tokens": total_prompt + total_completion,
}
print(json.dumps(stats, ensure_ascii=False))
# {"count": 2, "prompt_tokens": 40, "completion_tokens": 10, "total_tokens": 50}
print(answers)                                        # ['检索增强生成', '智能体']
```

逐层取嵌套键时，如果结构可能缺失，用 `payload.get("choices", [{}])[0].get("message", {})` 这类链式 `get`，或者干脆用 Pydantic 做校验（进阶模块有专篇）。

## 延伸阅读

- 官方教程 5.5 字典：<https://docs.python.org/zh-cn/3/tutorial/datastructures.html#dictionaries>
- 映射类型 — dict：<https://docs.python.org/zh-cn/3/library/stdtypes.html#mapping-types-dict>
- 站内相邻文章：《集合：去重与成员运算》《列表：增删改查与切片》《迭代与解包技巧》《collections 常用容器：Counter、defaultdict 与 deque》《JSON 与时间日期》

<details>
<summary>参考：映射类型（dict）的完整操作表（译自官方库文档）</summary>

以下译自 [映射类型 — dict](https://docs.python.org/zh-cn/3/library/stdtypes.html#mapping-types-dict)。`d` 表示字典，`k` 表示键，`default` 表示默认值。

| 操作 | 说明 |
| --- | --- |
| `d[k] = v` | 将值 `v` 关联到键 `k` |
| `len(d)` | 返回字典中的项数 |
| `d[k]` | 以 `k` 为键的值，键不存在则抛 `KeyError` |
| `del d[k]` | 删除键为 `k` 的项 |
| `list(d)` / `iter(d)` / `k in d` | 分别返回键的列表、键的迭代器、判断键是否存在；空字典视为假值 |
| `clear()` | 移除所有项 |
| `copy()` | 返回浅拷贝 |
| `classmethod fromkeys(seq, value=None)` | 以 `seq` 为键、`value` 为公共值创建新字典 |
| `get(k, default=None)` | `d[k]` 的安全版本，键不存在时返回 `default` |
| `items()` | 返回「键, 值」元组的视图 |
| `keys()` | 返回键的视图 |
| `pop(k[, default])` | 删除并返回 `k` 的值；`k` 不存在且未给 `default` 则抛 `KeyError` |
| `popitem()` | 删除并返回最后插入的键值对（LIFO 顺序）；字典为空则抛 `KeyError` |
| `setdefault(k, default=None)` | 若 `k` 存在返回值；否则插入 `k: default` 并返回 `default` |
| `update([other, **kwargs])` | 用另一字典或键值对覆盖式更新 |
| `values()` | 返回值的视图 |

比较规则：字典只保证 `==` 与 `!=` 有意义（键值对完全相同才相等）。`<`、`>`、`<=`、`>=` 对字典**不受支持**，会抛 `TypeError: '<' not supported between instances of 'dict' and 'dict'`——老教程里「字典比较是子集测试」的说法在现代版本已不适用。想做子集判断，用视图的集合运算；想按内容比较或排序，先把 `items()` 转成列表（详见《集合：去重与成员运算》）：

```python
d1 = {"a": 1}
d2 = {"a": 1, "b": 2}
print(d1.items() <= d2.items())                  # True —— 子集关系
print(sorted(d1.items()) == sorted(d2.items()))  # False —— 内容是否相同
```


</details>

---

> **来源**：抓取于 2026-09-19。译自 [5.5 字典 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/datastructures.html#dictionaries)（Python Software Foundation，PSF 许可证第 2 版），并引 [映射类型 — dict — Python 标准库](https://docs.python.org/zh-cn/3/library/stdtypes.html#mapping-types-dict)（作者与许可同上）。`get` 歧义、反向字典、JSON 统计等小节为本站补充。
