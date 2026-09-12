---
title: 装饰器（Decorator）完全入门
source_url: https://realpython.com/primer-on-python-decorators/
author: Geir Arne Hjelle（Real Python）
license: © Real Python（版权所有，未开放转载——本篇为中文编译摘要并附原文链接）
fetched_at: 2026-09-13
translated: true
order: 1
versions: Python 3.13+
---

> **来源**：本文编译自 [Primer on Python Decorators](https://realpython.com/primer-on-python-decorators/)，作者 Geir Arne Hjelle（Real Python），许可 © Real Python（版权所有，未开放转载，故本篇为中文编译摘要而非全文翻译，完整内容请阅读原文）。抓取于 2026-09-13。

> 编者注：装饰器是 FastAPI、pytest、Dataclasses 等现代 Python 库的基础机制（`@app.get()`、`@pytest.fixture` 都是装饰器）。本篇为 Real Python 经典长文《Primer on Python Decorators》的中文编译摘要，按原文结构摘编其核心概念与示例，代码为编译者改写的等价简版。

## 函数是一等公民

要理解装饰器，先要接受一个前提：在 Python 中**函数是对象**，可以像普通值一样被赋值、传递、存储。

```python
def greet(name):
    return f"你好，{name}！"

say_hello = greet        # 函数可以赋值给另一个名字
print(say_hello("小明"))  # 你好，小明！

funcs = [greet, say_hello]  # 也可以放进列表
```

函数体内还可以**定义函数**（内嵌函数，inner function），并且内嵌函数可以访问外层函数的变量（闭包，closure）：

```python
def parent():
    message = "来自 parent"

    def child():
        print(message)   # 闭包：读取外层作用域的变量
    child()
```

更进一步，外层函数可以把内嵌函数**作为返回值**返回：

```python
def make_greeter(prefix):
    def greeter(name):
        return f"{prefix}，{name}！"
    return greeter        # 注意：返回函数本身，不加括号

hello = make_greeter("Hello")
hi = make_greeter("Hi")
print(hello("Alice"))  # Hello，Alice！
print(hi("Bob"))       # Hi，Bob！
```

`hello` 和 `hi` 记住了各自的 `prefix`——这就是装饰器背后的全部机制。

## 第一个装饰器

装饰器本质上就是：**接收一个函数，返回一个新函数（或原函数的包装）**。

```python
def must_login(func):
    def wrapper():
        print("先检查登录状态……")
        func()
    return wrapper

def view_feed():
    print("展示信息流")

view_feed = must_login(view_feed)   # 手动包装
view_feed()
# 先检查登录状态……
# 展示信息流
```

`@` 符号只是上面手动包装的**语法糖**，效果完全等价：

```python
@must_login
def view_feed():
    print("展示信息流")
```

也就是说 `@must_login` 等价于一行 `view_feed = must_login(view_feed)`。原函数并没有被修改，而是被"包"了一层，因此装饰器可以**无侵入地**给多个函数统一添加横切逻辑（日志、鉴权、缓存、计时……）。

## 装饰带参数的函数

被装饰的函数可能带任意参数，标准做法是让 `wrapper` 接收 `*args, **kwargs` 并原样转发：

```python
import functools

def log_call(func):
    @functools.wraps(func)          # 保留原函数的名字与文档字符串
    def wrapper(*args, **kwargs):
        print(f"调用 {func.__name__}，参数 {args} {kwargs}")
        return func(*args, **kwargs)
    return wrapper

@log_call
def add(a, b):
    """计算两数之和。"""
    return a + b

print(add(3, b=4))  # 调用 add，参数 (3,) {'b': 4} → 7
```

两个细节：

- 包装函数要 `return func(*args, **kwargs)`，否则被装饰函数的返回值会丢掉；
- `@functools.wraps(func)` 会把原函数的 `__name__`、`__doc__` 等元信息拷贝到 `wrapper` 上。没有它，`add.__name__` 会变成 `"wrapper"`，调试和文档工具都会失灵。**写装饰器应当默认加 `functools.wraps`**。

## 实用示例：计时器

原文给了若干真实场景示例（慢速执行、插件注册、调试打印、Web 鉴权等），这里摘编最有用的计时器：

```python
import functools
import time

def timer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        value = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"[timer] {func.__name__} 耗时 {elapsed:.4f} 秒")
        return value
    return wrapper

@timer
def train_fake(data):
    for _ in data:
        time.sleep(0.1)
    return "done"
```

这个模式在排查 LLM 应用里"哪一步慢"时几乎是随手要写的工具（更系统的做法见本模块《日志 logging》一篇）。

## 带参数的装饰器

如果想让装饰器本身接收参数（如 `@repeat(num_times=3)`），需要**再包一层**——写一个"装饰器工厂"：

```python
import functools

def repeat(num_times):
    def decorator_repeat(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for _ in range(num_times):
                value = func(*args, **kwargs)
            return value
        return wrapper
    return decorator_repeat

@repeat(num_times=3)
def hello(name):
    print(f"Hello, {name}!")

hello("World")  # 打印 3 次
```

调用 `@repeat(num_times=3)` 时先执行 `repeat(3)` 返回真正的装饰器 `decorator_repeat`，再套用到函数上。区分两种形式：`@repeat`（直接接函数）与 `@repeat(num_times=3)`（先调用再装饰）。

## 用类写装饰器与装饰类

装饰器不一定是函数，任何可调用对象都可以。有状态的装饰器常用**类**实现，关键是实现 `__call__`：

```python
import functools

class CountCalls:
    def __init__(self, func):
        functools.update_wrapper(self, func)
        self.func = func
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        print(f"第 {self.count} 次调用 {self.func.__name__}")
        return self.func(*args, **kwargs)

@CountCalls
def say_hi():
    print("Hi!")
```

反过来，装饰器也可以作用在**类**上（常见于单例、注册、给类附加属性等模式），因为类同样是可调用对象。原文还展示了**叠加装饰器**——从上到下依次包裹，最靠近 `def` 的先包：

```python
@timer
@log_call
def heavy():
    ...
# 等价于 heavy = timer(log_call(heavy))
```

## 常见坑与小结

- 装饰器在**导入时**执行一次（不是每次调用函数时），这是注册型装饰器的原理；
- 忘记 `functools.wraps` 会丢失函数元信息；
- 忘记在 `wrapper` 里 `return` 会静默把返回值变成 `None`；
- `functools` 标准库还内置了 `@lru_cache`（缓存）、`@cache`、`@singledispatch`（基于类型的分派）、`@cached_property` 等现成装饰器，优先复用。

学习建议：读完本篇后，去 FastAPI 入门篇（本模块第 11 篇）看 `@app.get()` 如何用装饰器完成路由注册，再看 pytest 篇的 `@pytest.fixture`——同一个机制支撑了整个现代 Python 生态。

## 参考与延伸

- 原文全文（英文）：[Primer on Python Decorators](https://realpython.com/primer-on-python-decorators/)
- `functools` 官方中文文档（`wraps`/`lru_cache` 等内置装饰器）：[functools — 高阶函数和可调用对象上的操作](https://docs.python.org/zh-cn/3/library/functools.html)
