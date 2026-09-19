---
title: Python 内存管理实战：引用计数、gc、弱引用与内存泄漏排查
source_url: https://docs.python.org/zh-cn/3/library/weakref.html
author: Python 软件基金会（PSF）文档团队；示例与编者注由本站补充
license: PSF 许可证第 2 版
fetched_at: 2026-09-19
translated: false
versions: Python 3.14 官方文档
order: 4
group: 语言机制进阶
---

# Python 内存管理实战：引用计数、gc、弱引用与内存泄漏排查

## 为什么需要关心这件事

「Python 有 GC，不用管内存」是新手期最有毒的一句话。真实工程里反复出现的三类问题全都需要你懂机制：

- **进程越跑越大**。服务挂一周从 300 MB 涨到 6 GB，最后被 OOM killer 干掉。
- **内存没问题但吞吐上不去**。批处理脚本每处理一批就触发一次全量 GC，停顿时间吃掉 20% 的 CPU。
- **`__del__` 不执行 / 执行时机诡异**。你以为的「关闭文件」逻辑其实要等进程退出才跑。

这一篇的目标是：让你知道**该用哪个工具看**、**看到什么算异常**、**改哪一行代码**。全部命令在 CPython 3.12+ 可直接运行。

## 一、三套机制各管什么

CPython 的内存管理是三层叠加，不是一套 GC 包打天下：

| 层 | 负责什么 | 何时释放 | 代价 | 你会在哪儿感知到它 |
| --- | --- | --- | --- | --- |
| **引用计数** | 绝大多数对象的释放（`dict`、`list`、自定义类实例…） | 引用数归零的**那一瞬间**，确定性释放 | 每次赋值/传参都要增减计数；无法处理循环引用 | `del x` 后内存立刻回落，靠的就是它 |
| **分代循环 GC**（`gc` 模块） | 只处理「容器之间互相引用成环」这一种情况 | 计数分配超过阈值时批量扫描 | 扫描有停顿；对象越多越慢 | `gc.collect()`、GC 停顿、`gc.callbacks` |
| **内存分配器**（pymalloc + 系统 `malloc`） | 小块内存的复用与对齐 | 由前两层触发归还 | arena 可以「已释放但不还给 OS」 | RSS 不降但 tracemalloc 显示已释放 |

> 关键推论：**「Python 进程 RSS 没降」不等于「内存泄漏」。** 小对象内存被 pymalloc 的 arena 缓存住是为下一次分配提速；只有 tracemalloc/统计显示**仍被引用的对象数量持续增长**才是真泄漏。

关于 C 层的 `Py_INCREF()` / `Py_DECREF()`：那是给写 C 扩展和嵌入 Python 的人准备的（见官方 C-API 手册），纯 Python 代码里解释器自动插好，你不需要也无法手动调用。3.12 起 `None`、`True`、小整数等「永生对象」的引用计数不再变化（一个哨兵值），所以你在下一节会看到 `getrefcount(True)` 返回一个巨大的固定数——不是 bug。

## 二、亲手看引用计数

```python
import sys

class Node:
    pass

a = Node()
b = a
print(sys.getrefcount(a))   # 3：a、b、以及「作为参数传给 getrefcount 的临时引用」
print(sys.getrefcount(Node()))  # 2：临时对象 + 参数引用
```

第一个坑就在注释里：**传给 `getrefcount()` 本身会增加一次计数**，所以读数永远比实际多 1。第二个坑：容器持有元素，`d = {}` 是 1，`d["k"] = v` 后 `v` 的计数变 3（`v` 的局部名 + 字典槽位 + 参数）。

真实排查里，`getrefcount` 的用法是**对比**而不是看绝对值：

```python
import gc, sys

def refs_of(cls):
    """返回当前内存中该类型的实例数量。"""
    return sum(1 for obj in gc.get_objects() if type(obj) is cls)

before = refs_of(Node)
objs = [Node() for _ in range(1000)]
print(refs_of(Node) - before)   # 1000
del objs
gc.collect()
print(refs_of(Node) - before)   # 0 —— 如果这里不是 0，就是被什么东西持有了
```

`gc.get_objects()` 会返回上百万对象，遍历本身很吃内存。生产代码里不要用它做常规监控：改用 `weakref.WeakSet` 自己登记实例，或按代取 `gc.get_objects(0)`。

## 三、循环引用与 gc 模块

### 环是怎么产生的、又为什么必须靠 gc

```python
class TreeNode:
    def __init__(self, name):
        self.name = name
        self.parent = None
        self.children = []

    def add(self, child):
        child.parent = self
        self.children.append(child)
        return child

root = TreeNode("root")
root.add(TreeNode("a"))
del root          # 此时 root 与 a 互相引用，计数都不为 0，但外部已无人可达
```

`del root` 之后对象并没有释放——引用计数只能处理单向所有权，处理不了「两个对象互相抬着」。这类情况由 `gc` 判定为**不可达**后回收。

### 什么时候需要自己 `collect()`

大多数时候不需要——GC 有自动阈值。真正需要手写 `gc.collect()` 的场景只有三个：

1. **长任务里阶段性释放**：处理完一个大批次，希望立刻把内存还给下一级分配器，而不是等阈值。
2. **禁用自动 GC 期间的兜底**：见下面的性能小节。
3. **测试里确认「能不能回收」**：`assert gc.collect() == 0` 是判断循环是否被打破的最省事的断言。

`gc.collect()` 的返回值就是**本轮发现的不可达对象数**——这个数字非零，说明确实有环被回收；长期非零说明你的代码到处在造环。

### gc 常用接口速查

| 接口 | 作用 | 实战备注 |
| --- | --- | --- |
| `gc.get_count()` | 返回三代各自的计数 `(g0, g1, g2)` | 净增分配数超过 `threshold0` 就触发 0 代回收 |
| `gc.get_threshold()` | 查看当前阈值 | 文档长期写 `(700, 10, 10)`；3.14 上实测返回 `(2000, 10, 10)`，以本机读数为准 |
| `gc.set_threshold(a, b, c)` | 调阈值；`a=0` 即关闭自动回收 | 调大 `a` = 少做 GC、多占内存。注意 3.14.0~3.14.4 会忽略 `c`，3.14.5 起恢复生效 |
| `gc.collect(gen=2)` | 回收 `gen` 及更年轻代，默认全量 | 返回回收掉的不可达对象数 |
| `gc.disable()` / `gc.enable()` | 关闭/开启自动循环 GC | 引用计数照常工作，所以「关 GC 会泄漏」是误解；关 GC 只让**环**回收不掉 |
| `gc.isenabled()` | 是否启用 | — |
| `gc.freeze()`（3.7+） | 把当前所有受追踪对象移进「永久代」，后续回收不再扫描它们 | 官方推荐姿势：父进程早期 `disable()`、fork 前 `freeze()`、子进程早期 `enable()` |
| `gc.unfreeze()` | 解冻，把永久代对象放回正常代 | — |
| `gc.get_objects(generation=None)`（3.8 起可传代） | 取受追踪对象列表 | 一次全取会有上百万对象，务必传代参数或换更窄的手段 |
| `gc.callbacks` | 回调列表，回收前后各调一次 | 用于把 GC 停顿打进监控指标，见下文示例 |
| `gc.garbage` | 无法回收又无法复活的对象列表 | 正常情况下应始终为空；PEP 442（3.4）后带 `__del__` 的环已能回收 |
| `gc.get_referrers(*objs)` / `gc.get_referents(*objs)` | 谁引用了它 / 它引用了谁 | 定位泄漏主力工具。官方警告：仅供调试，返回的对象可能仍在构造中；想只拿到活对象，先 `collect()` 再查 |
| `gc.is_tracked(obj)` | 对象是否被 GC 追踪 | 标量返回 `False`，见下文「只有容器才被追踪」 |

### 把 GC 停顿打进日志

```python
import gc, logging, time

log = logging.getLogger(__name__)
_t = {}

def gc_hook(phase, info):
    """gc.callbacks 回调：phase 为 "start" 或 "stop"，info 是 dict。"""
    if phase == "start":
        _t["t0"] = time.perf_counter()
    else:
        cost = (time.perf_counter() - _t.get("t0", 0)) * 1000
        if cost > 5:      # 只关心 5 ms 以上的停顿
            log.warning("gc pause %.1fms gen=%s collected=%s uncollectable=%s",
                        cost, info["generation"], info["collected"],
                        info["uncollectable"])

gc.callbacks.append(gc_hook)
```

`info` 这个 dict 在 3.14 上提供 `generation`、`collected`、`uncollectable` 三个键；`duration` 与 `candidates` 要到 3.15 才有，跨版本代码请用 `info.get("duration")` 读，或像上面这样自己掐表。回调按注册顺序被调用，其内部抛出的异常只会打到 stderr，不会中断回收。

早期资料里常见的 `callback(start: bool, stats: dict)` 布尔签名已不可依赖，写 `phase == "start"` 的字符串判断才是当前文档承诺的行为。

### 只有容器才被追踪

GC 只追踪「可能持有引用」的类型（`list`、`dict`、`set`、自定义类实例等）。`gc.is_tracked(1)` 是 `False`——整数不是容器；`gc.is_tracked([])` 是 `True`。但有个反直觉优化：**只含非容器元素（且都不含 `__del__`）的 tuple 会被免追踪**：

```python
import gc
print(gc.is_tracked((1, 2, 3)))          # False：整个元组免追踪
print(gc.is_tracked((1, 2, [])))         # True：内部有容器
```

这个特性对海量记录处理有实际意义：**用 tuple 装一行数据比用 dict 少一份 GC 负担**。同理 `__slots__` 的类若字段全是标量，实例也更容易被优化掉。

## 四、弱引用：把「不该拥有」的引用改成不计数

弱引用是**不增加引用计数**的引用，用来打断「我只是为了记住它，却把它钉在内存里」的关系。

| 类型 | 用法 | 特点 | 典型场景 |
| --- | --- | --- | --- |
| `weakref.ref(obj[, cb])`（别名 `weakref`） | `r = ref(obj)`；取对象要 `r()`，已回收返回 `None` | 可作 dict 键；可哈希 | 观察者列表、缓存槽 |
| `weakref.proxy(obj[, cb])` | `p = proxy(obj)`；像直接用对象一样 | 对象死了访问抛 `ReferenceError`；**不能**作 dict 键 | 透明代理、避免测试里对象被 fixture 钉住 |
| `weakref.WeakKeyDictionary` | 键是弱引用 | 键对象死亡自动剔除 | 以对象为键挂额外数据（不污染对象本身） |
| `weakref.WeakValueDictionary` | 值是弱引用 | 值死亡自动剔除 | 享元/对象池缓存 |
| `weakref.WeakSet` | 元素是弱引用 | 同上 | 追踪存活实例数（本文第二节的 `refs_of` 就有它的轻量替代） |
| `weakref.WeakMethod(m)` | 绑定的实例方法 | 实例死亡即失效 | 事件总线注册回调 |
| `weakref.finalize(obj, func, *a, **k)` | 对象被回收时调用 `func` | 比 `__del__` 可靠，解释器退出时也会执行 | 关闭句柄、归还连接 |

哪些对象不能弱引用？`list`、`dict`、`set`、`frozenset`、`tuple`、`str`、`bytes`、`int`、`float`、`complex` 这些内置类型直接 `ref()` 会抛 `TypeError`。两条出路：① 写个薄子类 `class TrackedList(list): pass`——子类实例默认带 `__dict__` 和 `__weakref__`，可以弱引用；② 别弱引用容器本身，改为把容器放进一个自定义对象里再引用那个对象。反过来，带 `__slots__` 却没列出 `"__weakref__"` 的类同样不可弱引用——这正好和《dataclasses 与 NamedTuple》里 `weakref_slot=True` 的用途呼应。

### 用法一：观察者列表不再阻止回收

```python
import weakref

class Bus:
    def __init__(self):
        self._subs = weakref.WeakKeyDictionary()   # 弱键：订阅者死了自动消失

    def subscribe(self, obj, handler):
        self._subs[obj] = handler

    def publish(self, event):
        for obj, handler in list(self._subs.items()):
            handler(obj, event)


class Listener:
    def on_event(self, owner, event):
        print(f"{owner.name} 收到 {event}")

    name = "listener"


bus = Bus()
li = Listener()
bus.subscribe(li, Listener.on_event)
print(len(bus._subs))      # 1
del li
print(len(bus._subs))      # 0 —— Bus 没有把 Listener 钉住
```

如果用普通 `dict`，`Bus` 就强引用了所有订阅者，这是 GUI/事件框架里最经典的一类泄漏。

### 用法二：用 finalize 替代 `__del__`

```python
import weakref

class Resource:
    def __init__(self, name):
        self.name = name
        # 注意：回调里绝不能引用 self，否则又把对象救活了
        self._finalizer = weakref.finalize(
            self, print, f"[close] {name} 释放")

    def close(self):
        self._finalizer()          # 显式关闭；重复调用不会二次触发


r = Resource("db")
r.close()                          # [close] db 释放
del r                              # 不再有输出
```

`__del__` 的三个不可靠之处：析构顺序不确定、异常被吞掉只打印到 stderr、和循环引用一起出现时历史上曾完全无法回收（3.4 起 PEP 442 已能回收，但顺序仍不可指望）。需要「确定性地释放外部资源」，用**上下文管理器**（见《上下文管理器：contextlib 完全指南》）；兜底才用 `finalize`。

## 五、定位内存到底被谁吃了

### sys.getsizeof 的三层局限

```python
import sys
print(sys.getsizeof({}))              # 64：空 dict 骨架
print(sys.getsizeof({"k": 1}))        # 184（CPython 3.14 实测值）
print(sys.getsizeof([1, 2, 3]))       # 88 —— 只算外层列表
```

局限：① 只测**浅层**大小，容器里的元素另算；② 不同实现/版本数字不同，别把它当业务指标；③ 共享对象（intern 后的字符串、小整数）会重复计入。要测深大小，自己写递归（用 `id` 集合去重，或用 `pympler.asizeof`）。

### tracemalloc：官方主力工具

`tracemalloc` 记录**每一次 Python 内存分配发生在哪个文件哪一行**，是定位泄漏最快的路。

```bash
# 方式一：启动时就开启，记录 5 层调用栈（-n 越大越准、越慢）
python -X tracemalloc=5 myapp.py

# 方式二：代码里按需开启
python -c "import tracemalloc; tracemalloc.start(10)"
```

```python
import tracemalloc

tracemalloc.start(10)                       # 保留 10 层归属栈帧

snapshot1 = tracemalloc.take_snapshot()
big = [bytearray(1024) for _ in range(5000)]   # 模拟一次内存增长
snapshot2 = tracemalloc.take_snapshot()

# 1) 按「文件名+行号」看增长最多的 5 处
for stat in snapshot2.compare_to(snapshot1, "lineno")[:5]:
    print(stat)

# 2) 看某个文件当前分配的总量与条数
top = snapshot2.statistics("filename")
print(top[0])

# 3) 打印某行的完整调用栈
stat = snapshot2.compare_to(snapshot1, "traceback")[0]
for line in stat.traceback.format():
    print(line)
```

`compare_to()` / `statistics()` 的聚合维度 `key_type` **只接受三个值**（传别的会 `ValueError: unknown key_type`）：

| `key_type` | 聚合维度 | 什么时候用 |
| --- | --- | --- |
| `"filename"` | 按文件 | 先看是哪个模块在长；噪声最小 |
| `"lineno"` | 按文件 + 行号 | 定位到具体分配语句，最常用 |
| `"traceback"` | 按完整调用栈 | 同一行被多处调用、要区分调用来源；结果条数最多 |

两点补充：`cumulative=True` 只能配合 `"filename"` 或 `"lineno"` 使用（表示把整条栈上的分配都算到最外层）；返回的元素是 `Statistic`（有 `size`/`count`/`traceback`）或 `StatisticDiff`（有 `size_diff`/`count_diff`/`size`/`count`），已按 `size` 从大到小排好序。

配合 `StatisticDiff.size_diff` / `count_diff` 写断言，可以把它做成回归测试：

```python
import tracemalloc

tracemalloc.start()
snapshot1 = tracemalloc.take_snapshot()
junk = [bytearray(2048) for _ in range(300)]      # 被测代码
snapshot2 = tracemalloc.take_snapshot()

diff = snapshot2.compare_to(snapshot1, "lineno")
grow = sum(s.size_diff for s in diff if s.size_diff > 0)
assert grow < 5_000_000, f"内存增长 {grow / 1e6:.1f}MB 超过阈值"
print("增长在预算内", grow)
del junk
```

两个限制：`tracemalloc` 只跟踪 **Python 层**分配（C 扩展里 `malloc` 的看不到，NumPy 大数组常常看不见！），且有明显性能开销，生产上按需短时开启。C 扩展占用的排查交给 `memray attach` 或 `py-spy`（见《性能分析：profile/cProfile 与 py-spy》）。

### 谁持有了这个对象：get_referrers

```python
import gc, reprlib

victim = big[0]
for ref in gc.get_referrers(victim):
    # 只看容器和帧对象，避免把本次循环的局部变量打印出来
    if isinstance(ref, dict) and "__name__" in ref:
        print("module:", ref["__name__"])
    elif type(ref).__name__ == "frame":
        print("frame:", ref.f_code.co_filename, ref.f_lineno)
    else:
        print(reprlib.repr(ref)[:120])
```

输出里最常看到三类「凶手」：模块级 dict/list（全局缓存）、`frame`（被异常 traceback 或正在运行的协程持有）、`cell`（闭包）。

## 六、常见泄漏模式与对策

| 模式 | 症状 | 怎么验证 | 修法 |
| --- | --- | --- | --- |
| 模块级缓存无界增长（`CACHE[key] = embedding`） | RSS 单调上升，`get_referrers` 指向某个 module dict | `len(CACHE)` 打点，或 gc 回调里输出对象数 | `functools.lru_cache(maxsize=…)`、`WeakValueDictionary`，或自己加 TTL 淘汰 |
| `lru_cache` / `cached_property` 装饰实例方法 | 实例永不释放（缓存字典挂在类上并强引用 `self`） | 类计数用 `WeakSet` 观察存活实例数 | 缓存 key 用显式 `id`/字段元组；改 `WeakKeyDictionary`；或降级为普通属性 |
| 事件监听器 / 回调只注册不注销 | 注册表越来越大，被监听对象无法回收 | 打印订阅表 `len()` | 用 `WeakKeyDictionary`/`WeakMethod`（上文示例），或提供 `unsubscribe` 并在上下文管理器 `finally` 中调用 |
| 闭包/lambda 捕获大对象 | 返回的小函数带着整个外层作用域 | `fn.__closure__` 逐个 cell 检查 `cell_contents` | 只捕获需要的字段而不是整个对象；用完置 `None` |
| 异常 traceback 持有帧局部变量 | 循环里 `except Exception as e: log(e)` 之后大对象仍在 | `gc.get_referrers` 出现 `frame`/`TracebackType` | 记录完就 `del e`（`__traceback__` 会随异常变量一起释放）；Python 3 里 `except ... as e` 在块尾自动删，但**把 `e` 存进全局就会泄漏** |
| 循环引用 + `__del__` | 对象要等到全量 GC 才消失，甚至长期滞留 | `gc.collect()` 返回值、`len(gc.garbage)` | 拆环（父指向子改为弱引用 `WeakMethod`/`ref`），或改用 `weakref.finalize` |
| `threading.local` 缓存请求上下文 | 线程池复用线程，数据永不清理 | 遍历线程本地字典统计条目 | 请求结束显式 `.reset()`/清空；不要往 thread-local 里放大对象 |
| asyncio 任务被全局集合持有 | `asyncio.create_task()` 的结果存进 set 却从不 discard | tracemalloc 里 `Task`/`TimerHandle` 数量异常 | 用 `TaskGroup`（见《asyncio 并发限流与重试范式》）或 `add_done_callback(task_set.discard)` |
| DataFrame/数组切片是视图 | 想留 3 列却留住了整张底表 | `df._mgr` 指向的大块内存 | 立刻 `.copy()` 或用 `df.query()` 后立即 `del` 原表 |
| 日志 handler 反复 `addHandler` | 每次初始化 logger 都多一个 handler，输出翻倍且句柄泄漏 | `logging.getLogger(...).handlers` 长度 | 只在入口 `basicConfig`/`dictConfig` 一次；用 `logger.propagate` 而非重复挂 handler |
| `atexit` / 全局单例开了不关 | 进程退出时资源才释放，长驻服务里等同泄漏 | `finalize` 注册数量 | 用上下文管理器包住生命周期（见《上下文管理器：contextlib 完全指南》） |

## 七、GC 与性能：什么时候真该动它

批处理脚本里最常见的一个提速手段，前提是**你确认程序不造环**：

```python
import gc

def process(batch):
    return len(batch)        # 你的批处理逻辑；确认内部不制造循环引用

gc.disable()                    # 关掉自动循环 GC
try:
    for batch in range(20):     # 每批生成百万级短命小对象
        data = [{"i": i, "s": str(i)} for i in range(batch * 50_000)]
        process(data)
finally:
    gc.enable()
    collected = gc.collect()    # 兜底：把关窗期间攒下的环收掉
    print("补收不可达对象", collected)
```

收益来自避免「对象总数巨大时 0 代回收也要扫很多」。风险是环不回收了——所以上面的 `finally` 之外还要定期 `gc.collect()` 兜底，并用 tracemalloc 验证峰值。

多进程（`multiprocessing` / `ProcessPoolExecutor`）用 fork 启动时，官方给出的组合姿势是：**父进程早期 `gc.disable()` → 每次 `fork()` 之前 `gc.freeze()` → 子进程早期 `gc.enable()`**。这样子进程的回收不会去碰父进程传来的长命对象的 `gc_refs` 计数，既避免复制页、又降低长驻 worker 的 GC 停顿。

判断「是否 GC 拖慢」的量化手段就是第三节那段 `gc.callbacks` 打点：正常服务里 GC 停顿占比应在千分位；若超过 1%~2%，先减少活对象数（真正的解法），再考虑调阈值。

## 八、一分钟自检清单

1. `python -X tracemalloc=5` 跑两个业务周期，比较 snapshot —— 增长是不是集中在同几行？
2. 对可疑对象 `gc.get_referrers()` —— 凶手是 module dict、frame 还是 cell？
3. `gc.collect()` 返回值长期 > 0？说明代码到处造环，去拆环而不是加 `collect()`。
4. `len(gc.garbage)` 应该恒为 0；不为 0 表示有 3.4 前语义的东西在堵（通常是 C 扩展对象）。
5. 类实例数用 `WeakSet` 打点：`live = WeakSet(); live.add(obj)`，看长度是否随请求数单调上升。

---

> **来源**：抓取于 2026-09-19。弱引用各类型与 `finalize` 语义译自 [weakref —— 非强引用对象](https://docs.python.org/zh-cn/3/library/weakref.html)（Python Software Foundation，PSF 许可证第 2 版）；分代回收、`gc.freeze()`、回调签名等接口说明译自 [gc —— 垃圾回收器接口](https://docs.python.org/zh-cn/3/library/gc.html)（作者与许可同上，Python 3.14）；`tracemalloc` 用法与 `key_type` 取值译自 [tracemalloc —— 用来跟踪 Python 内存分配的模块](https://docs.python.org/zh-cn/3/library/tracemalloc.html)（作者与许可同上）；`sys.getrefcount` 与 immortal object 说明另见 [sys](https://docs.python.org/zh-cn/3/library/sys.html) 与 [引用计数（C-API 手册）](https://docs.python.org/zh-cn/3/c-api/refcounting.html)（作者与许可同上）。本文全部示例、机制对照表、泄漏模式清单与排查步骤为本站编写；原 C-API 手册中 `Py_INCREF()` 等 C 层细节仅一句带过，需要写扩展的读者请直接阅读上述 C-API 原文。
