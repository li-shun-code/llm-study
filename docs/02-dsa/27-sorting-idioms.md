---
title: 排序惯用法：sorted、key 与稳定性
source_url: https://docs.python.org/3/howto/sorting.html
author: 本站整理；参考 Python HOWTO "Sorting How To"、CPython listsort 文档
license: PSF License 2.0
fetched_at: 2026-09-19
translated: true
versions: Python 3.12（Timsort 实现位于 CPython `Objects/listsort.txt`）
order: 27
group: 查找、排序与数组技巧
---
## sorted 与 list.sort ：先选对入口

> **难度**：★★☆（清单类）。看起来谁都会写 `sorted` ，但排序结果的“次序细节”经常决定线上行为。
> **定位**：《排序算法》讲“排序怎么实现”，本篇讲“在 Python 里怎么把排序写对、写快”。
> **前置**：《排序算法》。知道冒泡/归并/快排的复杂度之后，本篇只谈 `sorted` 的用法与语义。


| | `sorted(iterable, **kw)` | `lst.sort(**kw)` |
| - | ------------------------ | ---------------- |
| 返回 | **新列表** | `None`（原地修改） |
| 输入 | 任意可迭代对象 | 必须是 `list` |
| 是否改动原数据 | 否 | 是 |
| 适用 | 需要保留原序、源是生成器/元组 | 大列表且不再需要原序 |

```python
rows = [{"id": 3, "score": 0.9}, {"id": 1, "score": 0.7}, {"id": 2, "score": 0.9}]

top = sorted(rows, key=lambda r: r["score"], reverse=True)
print(top[0]["id"])           # 3
print(rows is top)            # False，原列表未变

# 常见错误：把 sort 的返回值当列表用
nums = [3, 1, 2]
nums = nums.sort()            # nums 变成 None，列表内容反而还在原对象里
print(nums)                   # None
```

`lst.sort()` 返回 `None` 是刻意设计（提示“原地操作”），`rows = rows.sort()` 是新手最痛的一行代码。

两者底层是**同一个算法：Timsort** ，因此结果完全一致。

## Timsort：稳定、自适应、O(n log n)

CPython、Java、Swift、V8、NumPy 的默认排序都是 Timsort 。它的三个关键词：

1. **稳定**：值相等的元素保持原有相对次序。这是“多级排序”技巧成立的基础。
2. **自适应**：现实数据里常有已经有序的小段（run） 。Timsort 先找出天然有序段，再用归并合并。完全有序输入只需 O(n) ，完全乱序为 O(n log n) 。
3. **最坏 O(n log n) 且需要 O(n) 辅助空间**：不像快排会退化到 O(n²) ，所以 `sorted` 可以放心用于任意输入。

对使用者的实际含义：**“近乎有序”的数据排序特别快**（日志按时间追加、只有少量乱序时），而“完全随机”就是标准 n log n 。另外 Timsort 有“galloping（飞奔）模式”，合并时若某一路连续胜出就改用二分定位，因此两个高度重叠的有序序列合并非常快。

Python 的 `heapq` 与 `sorted` 是不同权衡：`heapq.nlargest(k, xs)` 是 O(n log k) ，`sorted(xs)[-k:]` 是 O(n log n) 。k 很小时用前者，见《Top-K 与堆：召回重排里的取前 N 个》。

## key= 的机制：为什么它比 cmp 快

`key` 函数在**每个元素上只求值一次**（CPython 先把 `[(key(item), item)]` 排好再取出，即“装饰-排序-去饰” Schwartzian transform）；而 `cmp_to_key` 的比较函数会被调用 O(n log n) 次。

```python
import time
from functools import cmp_to_key


def slow_len(s: str) -> int:
    time.sleep(0)  # 模拟有成本的 key 计算
    return len(s)


data = ["bb", "a", "cccc", "ddd"]
# 一次求值：4 次调用
sorted(data, key=slow_len)
# O(n log n) 次调用
sorted(data, key=cmp_to_key(lambda a, b: len(a) - len(b)))
```

因此规则很简单：**能用 `key` 就不要用 `cmp_to_key`** ，并把 key 计算做成 O(1) 。当 key 昂贵时，先自己算好缓存再排；或者对 `(key, value)` 列表排序。

### 用 operator 取代 lambda

```python
from operator import attrgetter, itemgetter, methodcaller

users = [{"name": "bob", "score": 9}, {"name": "amy", "score": 7}]
points = [type("P", (), {"x": 2, "y": 5})()]

sorted(users, key=itemgetter("score"))          # 比 lambda r: r["score"] 快约 30%
sorted(points, key=attrgetter("x", "y"))        # 多属性：等价于 key=lambda p: (p.x, p.y)
words = ["banana", "Apple", "cherry"]
sorted(words, key=methodcaller("lower"))        # 忽略大小写：按方法返回值排
```

`attrgetter("x", "y")` 直接返回元组，比 lambda 构造元组更快，也更容易读。

## 多级排序与稳定性

**核心结论：`reverse=True` 只反转比较结果，不反转相等元素的相对次序** 。也就是说 `sorted(x, key=k, reverse=True)` 恒等于 `sorted(x, key=k)` 的“稳定逆序”，同分项之间仍是原序。想要同分项按另一个键升序，有两种写法：

```python
recs = [
    {"doc": "a", "score": 0.9, "ts": 3},
    {"doc": "b", "score": 0.9, "ts": 1},
    {"doc": "c", "score": 0.95, "ts": 2},
    {"doc": "d", "score": 0.7, "ts": 0},
]

# 写法一：利用稳定性，先按次要键排，再按主键排
tmp = sorted(recs, key=lambda r: r["ts"])            # 次要键升序
out = sorted(tmp, key=lambda r: r["score"], reverse=True)  # 主键降序，同分保留 ts 升序
print([(r["doc"], r["ts"]) for r in out])
# [('c', 2), ('b', 1), ('a', 3), ('d', 0)]

# 写法二：一次搞定，把方向编码进 key（数值取负）
out2 = sorted(recs, key=lambda r: (-r["score"], r["ts"]))
print([(r["doc"], r["ts"]) for r in out2])
# [('c', 2), ('b', 1), ('a', 3), ('d', 0)]
```

写法二更快（只排一遍），但对“降序的主键必须是数值”有要求。字符串想降序、或方向混杂时，退回写法一的“从次要到主要依次稳定排序”，或用 `functools.cmp_to_key` 。**记忆口诀：稳定性排序可以叠，方向不一致就取负或换 cmp** 。

## 让排序不报错：混合类型、None、空串

Python 3 不允许比较不同类型，`sorted([1, "a"])` 直接 `TypeError` 。带 `None` 的字段也常见（数据库可空列）：

```python
data = [3, 1, None, 2]
# TypeError: '<' not supported between instances of 'int' and 'NoneType'
# sorted(data)

print(sorted(data, key=lambda x: (x is None, x if x is not None else 0)))
# [1, 2, 3, None]  —— 把 None 排到最后
```

`(x is None, ...)` 这个“标志位 + 值”的二段式 key 是通用技巧：第一个元素决定分组（False 在前），第二个只在同组内比较。**用 `math.inf` 做哨兵更简洁**：`key=lambda x: x if x is not None else float("inf")` ，但要求 x 与 inf 类型可比。

### 自然排序：`item10` 不该排在 `item2` 前面

字符串按码点比较，`"item10" < "item2"` 为 True ，这与人的直觉相反。把数字段抠出来排序即可：

```python
import re


def natural_key(s: str) -> tuple:
    """把 'item12' 拆成 ('item', 12) ，数字段按整数比较"""
    parts = re.split(r"(\d+)", s)
    return tuple((0, int(p)) if p.isdigit() else (1, p.lower()) for p in parts if p != "")


files = ["part10.txt", "part2.txt", "part1.txt", "part9.txt"]
print(sorted(files))                 # 字典序：part1, part10, part2, part9
print(sorted(files, key=natural_key))
# ['part1.txt', 'part2.txt', 'part9.txt', 'part10.txt']
```

`(0, int)` / `(1, str)` 的元组设计是为了让“数字段永远排在文字段之前”且两类不相等的元素不会互相比较（否则又是 `TypeError` ）。生产环境更省心的方案是第三方库 `natsort` （MIT）。

### 中文排序

Python 默认按 Unicode 码点排中文，既不是拼音也不是笔画。需要拼音序时：

- 标准库方案：`locale.strxfrm` + `locale.setlocale(locale.LC_COLLATE, "zh_CN.UTF-8")` ，**但依赖系统 locale 是否安装，跨平台结果不稳定**。
- 可靠方案：`pypinyin` 转拼音再排（`key=lambda s: lazy_pinyin(s)` ），或 `pyuca` 按 UCA 规则排（Unicode 官方排序算法，正确处理多语言）。

## 大对象与外部排序

`sorted` 会一次性把所有元素读进内存并生成新列表，**峰值内存约为 2 倍数据量** 。数据太大时：

```python
import heapq
import json
from pathlib import Path


def external_sort(shard_paths: list[Path], out_path: Path) -> None:
    """多路归并已排序的分片 -> 单个有序文件，内存只占每分片一行"""
    def lines(p: Path):
        with p.open(encoding="utf-8") as f:
            for line in f:
                yield json.loads(line)

    # 每个分片内部先用 sorted 排序写出，再整体归并
    with out_path.open("w", encoding="utf-8") as out:
        for rec in heapq.merge(*[lines(p) for p in shard_paths], key=lambda r: r["ts"]):
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
```

这是“分片内排序 + 堆归并”的经典外部排序骨架，与《Top-K 与堆》里的 `heapq.merge` 是同一套工具。日志、向量导出、批量评估结果合并都会用到。

## 完整可跑的工程例子

### 例一：一张真实报表的排序

评测报表是最典型的“多键 + 脏值 + 中文 + 版本号”排序现场：token 数降序、延迟升序、可空字段排最后、版本号要自然序。这份脚本把前文四条规则全用上了，只用标准库（`pypinyin` 是可选项，未装就退回码点序并明确告知）：

```python
"""报表排序：多级排序 + None 兜底 + 版本号自然序 + 中文排序兜底"""
import functools
import locale
import re

rows = [
    {"model": "gpt-5",       "tokens": 1800, "latency": 2.4, "ok": True,  "ver": "v1.10.2"},
    {"model": "qwen3-32b",   "tokens": 1800, "latency": 1.1, "ok": False, "ver": "v1.9.4"},
    {"model": "DeepSeek-V3", "tokens": 900,  "latency": 0.8, "ok": None,  "ver": "v1.10.1"},
    {"model": "嵌入检索服务", "tokens": 900,  "latency": 3.2, "ok": True,  "ver": "v1.9.10"},
    {"model": "llama-4-70b", "tokens": 1800, "latency": 1.1, "ok": None,  "ver": "v2.0.0"},
]


def natural_key(s: str) -> tuple:
    """把 'v1.10.2' 拆成「文字段 / 数字段」交替的元组，数字按整数比较"""
    parts = re.split(r"(\d+)", s)
    return tuple((0, int(p)) if p.isdigit() else (1, p.lower()) for p in parts if p)


def none_last(v):
    """None 排最后：标志位 True(是 None) > False ，同组内再比值"""
    return (v is None, v if v is not None else 0)


# 写法一：三趟稳定排序（从次要键到主要键），方向混杂时也照样成立
out = sorted(rows, key=lambda r: r["model"])
out = sorted(out, key=lambda r: r["latency"])
out = sorted(out, key=lambda r: r["tokens"], reverse=True)
print("三趟稳定:", [(r["model"], r["tokens"], r["latency"]) for r in out])

# 写法二：一次搞定，方向编码进 key；数值取负，脏值用标志位
out2 = sorted(rows, key=lambda r: (-r["tokens"], r["latency"],
                                   none_last(r["ok"]), natural_key(r["ver"])))
print("一趟多键:", [(r["model"], r["ok"], r["ver"]) for r in out2])

# 版本号的自然序：字典序会把 v1.9.10 判在 v1.9.4 前面
print("字典序:", sorted([r["ver"] for r in rows]))
print("自然序:", sorted([r["ver"] for r in rows], key=natural_key))

# 中文：pypinyin 未安装时退回码点序；locale 方案依赖系统是否装了 zh_CN.UTF-8
try:
    from pypinyin import lazy_pinyin
    print("拼音序:", sorted(["嵌入检索服务", "向量数据库", "安全审计"],
                            key=lambda s: "".join(lazy_pinyin(s))))
except ImportError:
    print("未安装 pypinyin ，退回码点序:", sorted(["嵌入检索服务", "向量数据库", "安全审计"]))
try:
    locale.setlocale(locale.LC_COLLATE, "zh_CN.UTF-8")
    print("locale 序:", sorted(["安全审计", "向量数据库"], key=locale.strxfrm))
except locale.Error:
    print("系统未安装 zh_CN.UTF-8 locale ，跳过 locale 方案")


# 方向确实无法取负（按三态布尔排）时才用 cmp_to_key：比较函数被调用 O(n log n) 次
def by_status(a, b):
    rank = {True: 0, False: 1, None: 2}
    return (rank[a["ok"]] > rank[b["ok"]]) - (rank[a["ok"]] < rank[b["ok"]])


print("cmp_to_key:", [r["ok"] for r in sorted(rows, key=functools.cmp_to_key(by_status))])
```

实测输出（CPython 3.12 / 3.14 一致）：

```text
三趟稳定: [('llama-4-70b', 1800, 1.1), ('qwen3-32b', 1800, 1.1), ('gpt-5', 1800, 2.4), ('DeepSeek-V3', 900, 0.8), ('嵌入检索服务', 900, 3.2)]
一趟多键: [('qwen3-32b', False, 'v1.9.4'), ('llama-4-70b', None, 'v2.0.0'), ('gpt-5', True, 'v1.10.2'), ('DeepSeek-V3', None, 'v1.10.1'), ('嵌入检索服务', True, 'v1.9.10')]
字典序: ['v1.10.1', 'v1.10.2', 'v1.9.10', 'v1.9.4', 'v2.0.0']
自然序: ['v1.9.4', 'v1.9.10', 'v1.10.1', 'v1.10.2', 'v2.0.0']
```

三点值得对照着看：**三趟写法里 `llama` 排在 `qwen3` 之前** ，因为第一趟按 `model` 排过、同 token 同延迟时保留了那个次序——这就是“稳定性可以叠加”的实体样子；**字典序把 `v1.10.1` 判在 `v1.9.4` 前面** ，自然序才符合人的直觉；`cmp_to_key` 那份是最后手段，只在“既不能取负、又不值得为此多跑几趟”时才用。

### 例二：外部排序端到端（分片内排序 + `heapq.merge` 归并）

数据量超过内存时，`sorted` 会把峰值内存推到 2 倍以上。标准骨架是“分片内排好落盘 → 多路归并写出”，全程内存只占“每片一行的游标”：

```python
"""外部排序：4 个有序分片 -> heapq.merge 归并成单个有序文件（用 tempfile ，不写死路径）"""
import heapq
import json
import tempfile
from pathlib import Path

ROWS = 50_000


def make_shards(tmp: Path, n_shards: int = 4) -> list[Path]:
    """模拟“内存装不下的数据”：每片内部先排好再落盘"""
    paths = []
    for s in range(n_shards):
        p = tmp / f"shard-{s}.jsonl"
        data = sorted(({"ts": (i * 37 + s * 13) % ROWS, "shard": s}
                       for i in range(ROWS // n_shards)), key=lambda r: r["ts"])
        with p.open("w", encoding="utf-8") as f:
            for rec in data:
                f.write(json.dumps(rec) + "\n")
        paths.append(p)
    return paths


def external_sort(shard_paths: list[Path], out_path: Path) -> int:
    """多路归并：每个分片是一个惰性生成器，内存里同时只存 n_shards 行"""

    def lines(p: Path):
        with p.open(encoding="utf-8") as f:
            for line in f:                 # 逐行读，绝不 readlines()
                yield json.loads(line)

    n = 0
    with out_path.open("w", encoding="utf-8") as out:
        for rec in heapq.merge(*[lines(p) for p in shard_paths], key=lambda r: r["ts"]):
            out.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n += 1
    return n


if __name__ == "__main__":
    with tempfile.TemporaryDirectory(prefix="sort-demo-") as d:
        tmp = Path(d)
        shards = make_shards(tmp)
        written = external_sort(shards, tmp / "all.jsonl")
        prev, ordered = -1, True
        with (tmp / "all.jsonl").open(encoding="utf-8") as f:
            for line in f:
                ts = json.loads(line)["ts"]
                if ts < prev:
                    ordered = False
                    break
                prev = ts
        print(f"归并 {written} 行 ，结果有序: {ordered}")
        print("分片大小(字节):", [p.stat().st_size for p in shards],
              "归并结果:", (tmp / "all.jsonl").stat().st_size)
```

输出 `归并 50000 行 ，结果有序: True` 。两个必须理解的点：**`heapq.merge` 要求各输入已经有序** ，它对“输入是否有序”不做任何检查，所以分片内那趟 `sorted` 是正确性的一部分而不是优化；**每个分片是一个生成器**，`heapq.merge` 内部维护一棵 k 个元素的小堆，每输出一条只调整一次，因此时间 O(N log k) 、空间 O(k) ，比“全部读进内存再 sorted”的 O(N log N) + O(N) 更适合大文件。同样的骨架可以换成数据库的“多路归并排序”、日志导出、向量库的分片快照合并；一旦分片数远超可用内存，就要改成两层归并（先两两合并减少分片数）。

## 常见坑

1. **`list.sort()` 返回 `None`** ：`rows = rows.sort()` 会把列表丢掉。
2. **key 里做有副作用的事**：key 只求值一次且顺序不保证是原序，别在 key 里计数或写日志。
3. **误以为 `reverse=True` 会反转同分项**：它不会（见上文）。
4. **元组 key 的比较会一路级联**：`key=lambda r: (r.score, r.name)` 在 score 相同时会去比 `name` ，若 `name` 有 `None` 又抛 `TypeError` 。解决：给次要键也补上安全默认值。
5. **对不可比对象排序**：自定义类要么实现 `__lt__` ，要么加 `@functools.total_ordering` ，要么干脆只用 `key=` 。
6. **中文/带重音字符排序结果“看着不对”**：那是码点序，需要 UCA/拼音方案。
7. **在生成器上调用 `list.sort()`**：生成器没有 `sort` 方法，只能 `sorted(gen)` ，且会耗尽它。
8. **依赖未排序数据的稳定性**：稳定性只在**同一趟**排序内成立，跨多次读取（如从不同数据库查询）不要假设次序。
9. **把排序当去重**：`sorted(set(xs))` 会丢类型信息且打乱 None；需要去重又保序时用 `dict.fromkeys(xs)` 。
10. **`key` 里调用有成本的函数却指望它只跑一次**：确实只跑一次，但**每趟排序都重新跑一次**；多趟稳定排序时 key 计算会重复 k 遍，昂贵就自己先算好存进元组。
11. **元组 key 里混进不可比类型**：`(-score, name)` 中 `name` 只要有 `None` 就 `TypeError` ；`(0, int)` / `(1, str)` 这种“标志位 + 值”的分段写法是为了让两类永不互比（上文自然排序就用了它）。
12. **以为 `sorted` 会保留生成器**：`sorted(gen)` 会把生成器耗尽，第二次排序同一对象得到空列表；要复用先 `list(...)` 。
13. **用 `reverse=True` 实现“最新在前”却没先按时间稳定排过**：同秒记录会按插入序（可能正是数据库返回序）出现，不同查询返回顺序不同就表现为“分页偶尔跳记录”。**分页排序必须有全序键**（时间 + 主键）。
14. **key 返回了会被改动的可变对象**：key 只求值一次，但比较发生在之后；若返回的是对象内部那个列表 / 字典本身，期间被别处改动就会得到无法复现的次序。让 key 返回 `tuple(...)` 快照即可。

## 延伸阅读

- Python HOWTO《Sorting How To》：`key` / `reverse` 语义、`cmp_to_key` 、稳定排序的多趟技巧。
- CPython 源码文档 `Objects/listsort.txt`：Timsort 的 minrun 选取与飞奔模式，是理解“为什么它对真实数据特别快”的一手资料。
- 《排序算法》：冒泡、插入、选择、快排、归并、堆、计数、桶、基数排序的实现与复杂度对照。
- 《Top-K 与堆：召回重排里的取前 N 个》：`sorted(xs)[-k:]` 与 `heapq.nlargest(k, xs)` 的取舍。
- 《Python 算法工具箱：heapq、bisect、graphlib 与 collections》：标准库索引。

---

> **来源**：抓取于 2026-09-19。排序语义、`key` 只求值一次、`reverse` 与稳定性、Timsort 的自适应与复杂度结论依据 Python 官方文档 [Sorting HOW TO](https://docs.python.org/3/howto/sorting.html) 与 CPython `Objects/listsort.txt`（Python Software Foundation，PSF License 2.0）。本文全部示例代码为本站编写，已在 Python 3.12 下运行验证。
