---
title: 装饰器实战：从手写第一个装饰器到 functools 速查
source_url: https://docs.python.org/zh-cn/3/reference/compound_stmts.html#function-definitions
author: Python 软件基金会（PSF）文档团队；示例与编者注由本站补充
license: PSF 许可证第 2 版
fetched_at: 2026-09-19
translated: false
versions: Python 3.14 官方文档
order: 1
group: 语言机制进阶
---

# 装饰器实战：从手写第一个装饰器到 functools 速查

## 为什么需要装饰器

假设你写了 30 个函数，某天需求变了：每个函数都要记录耗时。最直白的做法是在每个函数首尾各插两行：

```python
import time

def get_user(uid):
    t0 = time.perf_counter()
    user = query_user(uid)          # 业务逻辑
    print(f"get_user 耗时 {time.perf_counter() - t0:.3f}s")
    return user
```

30 个函数就是 60 处重复，而且这些代码和业务毫无关系——它们属于所谓**横切关注点**（cross-cutting concern）：计时、重试、鉴权、缓存、日志、参数校验。这类代码有三个特点：到处都要用、写出来都长一样、混进业务函数里会掩盖真正逻辑。

装饰器就是 Python 给这类代码准备的语法工具。它不引入任何新的运行时能力——**它只是一个赋值**：

```python
@timer
def get_user(uid):
    ...

# 完全等价于
def get_user(uid):
    ...
get_user = timer(get_user)
```

官方文档对 `@` 的说明就一句话：函数定义执行完毕后，把函数对象传给表达式的可调用对象，并用**返回值重新绑定**原来那个名字。理解这一句，装饰器就没有秘密了：

> **装饰器 = 接收一个可调用对象、返回一个可调用对象的函数。**

由此也推出一个常被误用的事实：装饰发生在**定义时**（import 时），不是调用时。被装饰的函数名从那一刻起就已经指向新函数了。

## 先补两块地基：一等对象与闭包

写装饰器只需要两个前置能力。

**函数是一等对象**——可以被赋值、放进容器、当参数传、当返回值返回：

```python
def shout(text):
    return text.upper()

whisper = shout        # 没有括号：传的是函数本身，不是调用结果
print(whisper("hi"))   # HI
print([shout, str.upper])
```

**闭包**——内层函数记住了外层函数的局部变量，即使外层已经返回：

```python
def outer(factor):
    def inner(x):
        return x * factor      # factor 被 inner 捕获
    return inner

double = outer(2)
print(double(21))              # 42
```

装饰器就是「用一个闭包把原函数包起来」。

## 第一个函数装饰器

把开头那段计时代码抽出来：

```python
import functools
import time


def timer(func):
    """打印被装饰函数的单次调用耗时。"""

    @functools.wraps(func)               # 先记住这一步，下一节解释为什么必须有
    def wrapper(*args, **kwargs):
        t0 = time.perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            cost = time.perf_counter() - t0
            print(f"{func.__name__} 耗时 {cost:.3f}s")

    return wrapper


@timer
def slow_sum(n):
    """计算 0..n-1 的平方和。"""
    return sum(i * i for i in range(n))


slow_sum(5_000_000)          # 输出：slow_sum 耗时 0.31s
```

`*args, **kwargs` 是转发约定：不改变被装饰函数的签名，也不假设它有几个参数。返回值直接 `return`，异常用 `finally` 保证耗时仍然打印——装饰器不应该悄悄改变原函数的行为语义。

## 坑 1：元信息被吃掉，所以必须有 functools.wraps

去掉 `@functools.wraps(func)` 再试：

```python
print(slow_sum.__name__)     # wrapper，而不是 slow_sum
print(slow_sum.__doc__)      # None
help(slow_sum)               # 看到的是 wrapper 的签名
```

因为名字重新绑定到了 `wrapper`。这会连带搞坏：`doctest`、Sphinx 文档、依赖 `__name__` 的日志与序列化、框架的路由注册表、`inspect.signature()`，以及 pytest 的参数化报告。

`functools.wraps` 做的就是把原函数的 `__name__`、`__qualname__`、`__doc__`、`__module__`、`__annotations__` 和 `__wrapped__` 复制过来。经验法则：

> **只要是给人写的装饰器，`@functools.wraps(func)` 是不可省略的第一行。**

唯一的例外是你**故意**要改变签名语义（比如把 `async def` 包成同步入口），此时应显式在文档里写清楚。

顺带一个实用副产品：`__wrapped__` 保留了对原函数的引用，测试里可以绕过装饰器直接调用。

```python
raw = slow_sum.__wrapped__          # 拿到未被包装的原始实现
```

## 带参数的装饰器：再多包一层

`@timer` 只能固定行为。想 `@retry(attempts=3)`、`@cache(ttl=60)` 这种带配置的写法，需要**三层**：最外层接收配置并返回真正的装饰器。

```python
def repeat(times):
    """把被装饰函数执行 times 次，返回结果列表。"""

    def decorator(func):                 # 这一层才是装饰器：func -> wrapper
        @functools.wraps(func)
        def wrapper(*args, **kwargs):    # 这一层才是替换上去的函数
            return [func(*args, **kwargs) for _ in range(times)]
        return wrapper
    return decorator


@repeat(times=3)         # 等价于 log = repeat(3)(log)
def log(msg):
    print(f"[log] {msg}")


log("hi")                # 打印三行
```

判别口诀：**看 `@` 后面有没有括号**。没有括号 → 一层嵌套就够；有括号 → 需要最外层的参数工厂。写不清层数时，把装饰器手工展开成 `f = dec(f)` 反推一次，立刻明白该有几层。

一个隐蔽的自伤写法是 `@repeat` 后面忘记括号：

```python
@repeat                # 少了 (times=3)：repeat 收到的是函数，被绑到了 times 上
def log(msg):
    print(f"[log] {msg}")


factory = log("hi")    # 不报错！这其实返回了一个 wrapper 工厂
log2 = factory         # log2 才是「真正的」包装结果
log2()                 # TypeError: 'function' object cannot be interpreted as an integer
```

难查的地方在于**报错点离错误来源很远**，而且中间那一步静默成功。带参装饰器请统一写成 `@repeat(times=3)`，并在函数里对 `times` 做类型断言，让这类误用在定义时就炸出来。

## 装饰类中的方法：self 陷阱

实例方法的第一个参数是 `self`，`*args` 会把它一起吃掉，所以通用装饰器对方法天然有效。但要注意两件事：

```python
class Service:
    @timer
    def fetch(self, url):                  # OK：wrapper(self, url)
        return f"fetched {url}"

    @classmethod
    @timer
    def build(cls, name):                  # 顺序敏感：timer 在 classmethod 下面
        return cls()

    @staticmethod
    @timer
    def parse(raw):                        # 同理，staticmethod 写在最上层
        return raw.strip()
```

装饰器叠加是**由下往上应用、由内而外包裹**：

```python
@A
@B
def f(): ...
# 等价于 f = A(B(f))
```

因此 `@classmethod` / `@staticmethod` / `@property` 必须写在**最上面**（也就是最后应用），把自定义装饰器写在它们下面。反过来 `@timer @classmethod` 会让 `timer` 收到一个 `classmethod` 对象而不是函数。

`property` 同理：它也是「接收函数、返回描述符」的装饰器，因此**必须写在最上面**，自定义装饰器写在它下面。

## 类装饰器

「类装饰器」有两种含义，务必分清。

**（a）装饰类的装饰器**：输入输出都是类。常用于批量给类加方法或打标记：

```python
def register(registry):
    """把被装饰的类登记进一个字典，供工厂按名字取用。"""

    def decorator(cls):
        registry[cls.__name__] = cls
        cls.registry_name = cls.__name__
        return cls                  # 装饰类时记得把类还回去
    return decorator


MODELS = {}


@register(MODELS)
class GPTModel:
    pass


@register(MODELS)
class QwenModel:
    pass


print(sorted(MODELS))               # ['GPTModel', 'QwenModel']
```

这套写法就是 FastAPI 的路由表、pytest 的插件注册、SQLAlchemy 声明式基类的底层思路，值得亲手实现一遍。

**（b）用类来实现装饰器**：靠 `__call__`。优势是状态放在实例上，比闭包更清晰，还能提供重置接口：

```python
class CountCalls:
    """统计调用次数，超过阈值时告警；状态挂在实例上，还能提供 reset()。"""

    def __init__(self, func, limit=100):
        functools.update_wrapper(self, func)   # 让实例看起来像原函数
        self.func = func
        self.limit = limit
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        if self.count > self.limit:
            print(f"{self.func.__name__} 已调用 {self.count} 次，超过阈值 {self.limit}")
        return self.func(*args, **kwargs)

    def reset(self):
        self.count = 0


def count_calls(limit=100):
    """带参入口：partial 先冻住 limit，剩下等 Python 把函数传进来。"""
    return functools.partial(CountCalls, limit=limit)


@count_calls(limit=2)
def ping():
    """返回 pong。"""
    return "pong"


for _ in range(3):
    ping()                    # 第三次触发告警
print(ping.count)             # 3 —— 状态可以直接查
ping.reset()
```

`@CountCalls`（不带括号）也能直接用：Python 会把被装饰函数当作 `func` 传给 `__init__`，此时用默认 `limit=100`。想要配置就必须像上面那样再包一个返回可调用对象的函数——这正是「带参装饰器多一层」的规则在类上的体现。

## 实战一：参数校验

结构化输出是 LLM 应用最常见的失败点，用装饰器把「解析 + 校验」挡在业务函数之前很划算。下面用 Pydantic 做校验模型（详见《Pydantic 模型（Models）：数据校验的核心》）：

```python
import functools
from typing import get_type_hints

from pydantic import BaseModel, Field, ValidationError


class QueryPlan(BaseModel):
    keywords: list[str] = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=50)


def validate_params(func):
    """按函数注解校验参数；返回类型注解若是 BaseModel 也一并校验。"""
    hints = get_type_hints(func)

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # 位置参数映射到形参名
        names = func.__code__.co_varnames[: func.__code__.co_argcount]
        bound = dict(zip(names, args)) | kwargs
        for name, value in bound.items():
            expected = hints.get(name)
            if isinstance(expected, type) and issubclass(expected, BaseModel):
                bound[name] = expected.model_validate(value)
        result = func(**bound)
        if isinstance(hints.get("return"), type) and issubclass(hints["return"], BaseModel):
            return hints["return"].model_validate(result)
        return result
    return wrapper


@validate_params
def search(plan: QueryPlan) -> str:
    return ", ".join(plan.keywords) + f" (top_k={plan.top_k})"


try:
    print(search({"keywords": ["向量库"], "top_k": 200}))
except ValidationError as exc:
    print(exc)                      # top_k 越界，定位到具体字段
```

要点：装饰器只做「边界翻译」，把外部脏数据换成合法对象，业务函数内部就只跟合法对象打交道。这正是《typing.Protocol 与结构化子类型》里可测试客户端设计的入口防线。

## 实战二：计时与慢调用日志

生产上更常用的版本是「只在超过阈值时才记日志」，并把结果交给 `logging`（见《日志 logging：HOWTO 与 logging.config》）而不是 `print`：

```python
import functools
import logging
import time

log = logging.getLogger(__name__)


def slow_only(threshold: float = 0.5):
    """耗时超过 threshold 秒时记一条 WARNING。"""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            t0 = time.perf_counter()
            try:
                return func(*args, **kwargs)
            finally:
                cost = time.perf_counter() - t0
                if cost >= threshold:
                    log.warning(
                        "slow call %s cost=%.3fs args=%d",
                        func.__qualname__, cost, len(args),
                    )
        return wrapper
    return decorator


@slow_only(threshold=0.2)
def embed(texts: list[str]) -> list[list[float]]:
    time.sleep(0.5)
    return [[0.1] for _ in texts]
```

注意 `finally` 里不要 `return`，否则会吞掉业务异常。

## 实战三：重试

重试要处理三件事：**只重试该重试的异常**、**指数退避**、**总预算上限**。手写一版，理解它之后再用 `tenacity` 心里才有底：

```python
import functools
import random
import time


def retry(exc=Exception, attempts=3, base=0.2, cap=5.0):
    """指数退避 + 抖动的重试装饰器。

    exc:      只捕获这些异常类型，其他异常直接向外抛。
    attempts: 总尝试次数（含第一次）。
    base:     退避基数秒。
    cap:      单次休眠上限。
    """

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for i in range(attempts):
                try:
                    return func(*args, **kwargs)
                except exc as err:                       # 精确捕获，别用裸 except
                    last_exc = err
                    if i == attempts - 1:
                        break
                    sleep = min(cap, base * (2 ** i)) * random.uniform(0.5, 1.5)
                    time.sleep(sleep)                    # 异步场景请换 asyncio.sleep
            raise last_exc
        return wrapper
    return decorator


@retry(exc=(ConnectionError, TimeoutError), attempts=4)
def call_llm(prompt: str) -> str:
    """演示用的假调用：网络抖动时前两次失败，第三次成功。"""
    call_llm.attempt = getattr(call_llm, "attempt", 0) + 1
    if call_llm.attempt < 3:
        raise ConnectionError("connection reset by peer")
    return f"echo: {prompt}"


print(call_llm("hello"))     # 第三次尝试成功，输出 echo: hello
```

三个必须写进注释的限制：① 被重试的函数必须**幂等**（写入类操作盲目重试会重复扣费/重复插入）；② 同步 `time.sleep` 会阻塞事件循环，协程要写一个 `async def` 版本用 `await asyncio.sleep()`；③ 重试要受**总超时预算**约束，否则最坏耗时是 `attempts × 单次超时`。异步限流 + 重试的完整范式见《asyncio 并发限流与重试范式》。

## 给装饰器写类型注解

不写注解的装饰器会让 mypy 把被装饰函数的签名丢掉。正确工具是 `ParamSpec` + `TypeVar`（详见《类型注解：typing 模块核心章节》）：

```python
from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

P = ParamSpec("P")          # 捕获「整串参数」
R = TypeVar("R")            # 捕获返回值类型


def logged(func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        print(f"call {func.__qualname__}")
        return func(*args, **kwargs)
    return wrapper


@logged
def add(a: int, b: int) -> int:
    return a + b


add("x", "y")   # mypy 仍然会报错：签名被完整保留
```

带参数的装饰器要返回 `Callable[[Callable[P, R]], Callable[P, R]]`。**不要用 `Callable[..., Any]`** 偷懒——它等于对整个被装饰函数关闭检查。

## 常见坑清单

| 症状 | 原因 | 修法 |
| --- | --- | --- |
| `__name__` 变成 `wrapper`，文档/日志/Sphinx 全乱 | 忘了 `@functools.wraps(func)` | 每个 wrapper 前加上它 |
| 装饰后调用报 `TypeError: missing 1 required positional argument` | 装饰器写了两层却按一层来用（或反之） | 展开 `f = dec(f)` 数一遍层数 |
| `@classmethod` 加自定义装饰器顺序报错 | 自定义装饰器收到了 `classmethod` 对象 | 内置描述符写在最上层 |
| 装饰器里的 `if` 分支在 import 时就执行了 | 装饰发生在定义时，不是调用时 | 把逻辑挪进 `wrapper` 函数体内 |
| 带可变的默认参数（如 `def wrapper(x, acc=[])`）在多次调用间串数据 | 默认参数只创建一次 | 用 `None` 哨兵，函数体内新建 |
| `lru_cache` 装饰的方法内存不释放 | 缓存挂在实例上，实例被缓存引用 | 类级缓存改用显式 key，或 `cached_property` |
| 重试装饰器导致重复扣费 | 非幂等操作被重试 | 只重试幂等操作，或引入幂等键 |
| 异步函数被同步装饰器包了，返回值不是协程 | `wrapper` 不是 `async def` | 写异步版装饰器，或用 `@contextlib.asynccontextmanager` 一类异步专用工具 |

## 延伸阅读与自我检查

能回答这三个问题就算过关：① `@a @b def f()` 展开成什么？② 为什么带参装饰器要三层？③ `functools.wraps` 到底复制了哪些属性、漏掉它会在哪些下游工具上暴露？

进一步：官方教程的 [装饰器语法](https://docs.python.org/zh-cn/3/reference/compound_stmts.html#function-definitions)、[PEP 318](https://peps.python.org/pep-00318/)（装饰器与类方法的由来）、[PEP 612](https://peps.python.org/pep-0612/)（`ParamSpec`）。本站相关：《上下文管理器：contextlib 完全指南》里 `@contextmanager` 本身就是个装饰器，读完本篇再回去看它如何实现，会有「原来如此」的感觉。

---

## 附录：functools 现成装饰器速查

自己造轮子之前先查这张表——标准库已经实现了一批高质量装饰器，绝大多数「我想给函数加个通用能力」的需求都能命中。

| 名称 | 作用 | 典型用法 | 注意 |
| --- | --- | --- | --- |
| `functools.wraps(wrapped, assigned=…, updated=…)` | 复制原函数元信息 | 每个手写 wrapper 的第一行 | 本质是 `update_wrapper` 的偏函数 |
| `functools.cache` | 无界缓存（等价 `lru_cache(maxsize=None)`，3.9+） | 纯函数、参数可哈希 | 参数不可哈希会 `TypeError`；会长期持有引用 |
| `functools.lru_cache(maxsize=128, typed=False)` | 固定容量 LRU 缓存，有 `cache_info()`/`cache_clear()` | 热点查询、递归拆分 | `typed=True` 时 `3` 与 `3.0` 分开算；装饰方法容易泄漏实例 |
| `functools.cached_property(func)` | 首次访问时计算并存进实例 `__dict__` | 懒加载昂贵属性 | 需要类支持 `__dict__`（别和 `__slots__` 混用）；`frozen=True` 的 dataclass 不适用 |
| `functools.singledispatch(func)` | 按**第一个参数**的类型分派 | `@register.register` 注册实现 | 只依据第一参数，不看 `**kwargs` |
| `functools.singledispatchmethod(func)` | 同上，作用于类/实例方法 | 3.8+ | 可与 `classmethod`/`staticmethod` 组合 |
| `functools.cmp_to_key(func)` | 把老式「两参数比较函数」转成 `key` 函数，供 `sorted(key=…)` 使用 | 迁移早期代码里的 `cmp` 逻辑 | 每次比较都走 Python 调用，比原生 key 慢 |
| `functools.total_ordering(func)` | 给定 `__eq__` 与一个比较方法（`__lt__`/`__le__`/`__gt__`/`__ge__`），补齐其余比较 | 自定义排序类型 | 需要类同时定义 `__eq__`；补齐出的方法是 Python 实现，性能有代价；类必须是可哈希一致的 |
| `functools.partial(func, /, *args, **keywords)` | 冻结部分参数，返回新的可调用对象 | 回调适配、把两参函数变一参 | 返回对象无 `__name__`/`__doc__`，弱引用与属性行为与普通函数不同 |
| `functools.partialmethod(func, /, *args, **keywords)` | `partial` 的类方法版，能被 `__doc__` 与继承正确处理 | 类内部预置参数 | 3.4+ |
| `functools.reduce(function, iterable, /[, initial])` | 累积折叠；有 `initial` 时不会在空序列上抛异常 | 累乘、扁平化、链式合并 | 多数场景列表推导更清晰；官方建议「用 `for` 循环或内置函数替代」 |
| `functools.Placeholder` | `partial` 对象上表示「留空位」的占位符单例 | 先把后面的参数冻住、留出前面的位置 | 3.14 新增 |

附录仅作提示：本篇正文的教学目标是「能自己写」，附录的目标是「知道不必自己写」。两者配合使用——先手写一遍重试和缓存，再改用 `tenacity` 与 `lru_cache`，你会清楚它们替你处理了哪些边界。

---

> **来源**：抓取于 2026-09-19。装饰器语义与 `@` 的重新绑定规则译自 [4.9. 函数定义 — Python 语言参考（中文）](https://docs.python.org/zh-cn/3/reference/compound_stmts.html#function-definitions)（Python Software Foundation，PSF 许可证第 2 版）；附录速查表译自 [functools —— 高阶函数与可调用对象上的操作](https://docs.python.org/zh-cn/3/library/functools.html)（作者与许可同上，Python 3.14）；`ParamSpec` 用法参照 [typing — ParamSpec](https://docs.python.org/zh-cn/3/library/typing.html#typing.ParamSpec)（作者与许可同上）。正文全部示例、坑清单与选型建议为本站编写，未收录原 functools 页的部分逐函数长注释（仅保留速查表）。延伸阅读：[PEP 318](https://peps.python.org/pep-00318/)、[PEP 612](https://peps.python.org/pep-0612/)（PSF，公共领域）。
