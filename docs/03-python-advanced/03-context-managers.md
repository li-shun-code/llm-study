---
title: 上下文管理器与 with 语句
source_url: https://docs.python.org/zh-cn/3/library/contextlib.html
author: Python 软件基金会
license: PSF 许可证第 2 版（GPL 兼容）
fetched_at: 2026-09-13
translated: false
order: 3
versions: Python 3.14
---
## 基本协议（编者补充）

`with` 语句背后是两个方法：进入时调用 `__enter__()`，无论正常离开还是抛异常离开，都会调用 `__exit__()`。这就是"保证清理"的语言级方案——文件一定会关闭、锁一定会释放，不需要在每个函数结尾散落 `close()`。

用类实现一个上下文管理器：

```python
class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self                    # as 后面拿到的就是这个返回值

    def __exit__(self, exc_type, exc_value, traceback):
        print(f"耗时 {time.perf_counter() - self.start:.3f}s")
        return False                   # False = 不吞异常；True = 已处理

with Timer():
    ...  # 计时代码
```

不过大多数时候不必写类——`contextlib.contextmanager` 装饰器用生成器就够了，这正是本篇主战场。管理数据库连接、HTTP 会话（如 `httpx.Client`）、临时目录，乃至 FastAPI 的应用生命周期，用的都是同一套协议。

## `contextlib` 工具一览

此模块为涉及 `with` 语句的常见任务提供了实用的工具。

### @contextmanager

此函数是一个装饰器，它可被用来定义一个支持 `with` 语句上下文管理器的工厂函数，而无需创建一个类或单独的 `__enter__()` 和 `__exit__()` 方法。

下面是一个抽象的示例，展示如何确保正确的资源管理:

```python
from contextlib import contextmanager

@contextmanager
def managed_resource(*args, **kwds):
    # 获取资源的代码，例如：
    resource = acquire_resource(*args, **kwds)
    try:
        yield resource
    finally:
        # 释放资源的代码，例如：
        release_resource(resource)
```

随后可以这样使用此函数:

```python
>>> with managed_resource(timeout=3600) as resource:
...     # 资源将在此代码块的末尾被释放，
...     # 即使代码块中的代码引发了异常
```

被装饰的函数在被调用时，必须返回一个生成器迭代器。这个迭代器必须只 `yield` 一个值出来，这个值会被用在 `with` 语句中，绑定到 `as` 后面的变量（如果给定了的话）。

当生成器发生 `yield` 时，嵌套在 `with` 语句中的语句体会被执行。语句体执行完毕离开之后，该生成器将被恢复执行。如果在该语句体中发生了未处理的异常，则该异常会在生成器发生 `yield` 时重新被引发。因此，你可以使用 `try...except...finally` 语句来捕获该异常（如果有的话），或确保进行了一些清理。如果仅出于记录日志或执行某些操作（而非完全抑制异常）的目的捕获了异常，生成器必须重新引发该异常。否则生成器的上下文管理器将向 `with` 语句指示该异常已经被处理，程序将立即在 `with` 语句之后恢复并继续执行。

`@contextmanager` 使用了 `ContextDecorator`，所以它创建的上下文管理器既能用在 `with` 语句中，也能作为装饰器使用。用作装饰器时，每次函数调用都会隐式创建一个新的生成器实例。

### @asynccontextmanager

与 `@contextmanager` 类似，但创建的是**异步**上下文管理器，配合 `async with` 使用。它必须应用在异步生成器函数上。一个简单的示例:

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_connection():
    conn = await acquire_db_connection()
    try:
        yield conn
    finally:
        await release_db_connection(conn)

async def get_all_users():
    async with get_connection() as conn:
        return conn.query('SELECT ...')
```

`@asynccontextmanager` 定义的上下文管理器既可以作为装饰器使用，也可以用于 `async with` 语句：

```python
import time
from contextlib import asynccontextmanager

@asynccontextmanager
async def timeit():
    now = time.monotonic()
    try:
        yield
    finally:
        print(f'it took {time.monotonic() - now}s to run')

@timeit()
async def main():
    # ... 异步代码 ...
```

> 编者注：FastAPI 0.1xx 之后的现代写法中，应用启动/关闭钩子（ lifespan ）正是要求传入一个 `@asynccontextmanager` 函数——启动时建连接池、关闭时释放，见本模块 FastAPI 一篇。

### closing 与 aclosing

`closing(thing)` 返回一个在语句块执行完成时关闭 *thing* 的上下文管理器，等价于 `try: yield thing; finally: thing.close()`。它对不支持上下文管理器协议的第三方类型最有用：

```python
from contextlib import closing
from urllib.request import urlopen

with closing(urlopen('https://www.python.org')) as page:
    for line in page:
        print(line)
```

即使发生错误，在退出 `with` 语句块时，`page.close()` 也同样会被调用。

`aclosing(thing)` 是对应的异步版本，在语句块结束时调用 `thing.aclose()`。它对异步生成器因 `break` 或异常而提前退出时的确定性清理尤其重要：

```python
from contextlib import aclosing

async with aclosing(my_generator()) as values:
    async for value in values:
        if value == 42:
            break
```

### nullcontext

返回一个从 `__enter__()` 返回 *enter_result*、除此之外不做任何事的上下文管理器。它的目的是用作**可选**上下文管理器的替身：

```python
def myfunction(arg, ignore_exceptions=False):
    if ignore_exceptions:
        # 使用 suppress 来忽略所有异常。
        cm = contextlib.suppress(Exception)
    else:
        # 不忽略任何异常，cm 将没有影响。
        cm = contextlib.nullcontext()
    with cm:
        # 执行某些操作
```

一个使用 *enter_result* 的例子：

```python
def process_file(file_or_path):
    if isinstance(file_or_path, str):
        # 如果是字符串，打开文件
        cm = open(file_or_path)
    else:
        # 调用方要负责关闭文件
        cm = nullcontext(file_or_path)

    with cm as file:
        # 在文件上执行处理
```

### suppress

返回一个当指定的异常在 `with` 语句体中发生时会屏蔽它们、然后从 `with` 语句结束后的第一条语句开始恢复执行的上下文管理器。

```python
from contextlib import suppress

with suppress(FileNotFoundError):
    os.remove('somefile.tmp')

with suppress(FileNotFoundError):
    os.remove('someotherfile.tmp')
```

这段代码等价于两个 `try/except FileNotFoundError: pass`，但意图更清晰。与完全抑制异常的任何其他机制一样，该上下文管理器应当只用来抑制非常具体的错误，并确保该场景下静默地继续执行程序是通用的正确做法。

### redirect_stdout / redirect_stderr / chdir

`redirect_stdout(new_target)` 用于将 `sys.stdout` 临时重定向到一个文件或类文件对象，给已有"硬编码写 stdout"的函数提供了额外灵活性：

```python
with redirect_stdout(io.StringIO()) as f:
    help(pow)
s = f.getvalue()

with open('help.txt', 'w') as f:
    with redirect_stdout(f):
        help(pow)
```

需要注意 `sys.stdout` 的全局副作用意味着此上下文管理器不适合在库代码和大多数多线程应用程序中使用。`redirect_stderr()` 与之类似。

`chdir(path)`（3.11+）在进入时改变当前工作目录并在退出时恢复。由于这会改变一个全局状态，因此它不适合在大多数线程或异步上下文中使用。

### ContextDecorator：把上下文管理器用作装饰器

一个使上下文管理器能用作装饰器的基类。继承它的类正常实现 `__enter__()` 和 `__exit__()` 即可：

```python
from contextlib import ContextDecorator

class mycontext(ContextDecorator):
    def __enter__(self):
        print('Starting')
        return self

    def __exit__(self, *exc):
        print('Finishing')
        return False
```

随后两种用法皆可：

```python
>>> @mycontext()
... def function():
...     print('The bit in the middle')
...
>>> function()
Starting
The bit in the middle
Finishing

>>> with mycontext():
...     print('The bit in the middle')
...
Starting
The bit in the middle
Finishing
```

这能清楚地表明 `cm` 作用于整个函数，而不仅仅是函数的一部分（同时也能保持不错的缩进层级）。`@contextmanager` 创建的上下文管理器自动具备这一能力；对应的异步版本是 `AsyncContextDecorator`（3.10+）。

### ExitStack：动态组合任意数量的上下文管理器

`ExitStack` 的设计目标是使得在编码中组合其他上下文管理器和清理函数更加容易，尤其是那些**可选的或由输入数据驱动**的上下文管理器。

例如，通过一个如下的 `with` 语句可以很容易处理一组文件:

```python
with ExitStack() as stack:
    files = [stack.enter_context(open(fname)) for fname in filenames]
    # 所有已打开的文件都将在 with 语句结束时
    # 自动被关闭，即使此后打开列表中文件的
    # 尝试引发了异常
```

每个实例维护一个注册了一组回调的栈，这些回调在实例关闭时以相反的顺序被调用。主要方法：

- `enter_context(cm)`：进入一个新的上下文管理器并将其 `__exit__()` 添加到回调栈中，返回该管理器 `__enter__()` 的结果；
- `push(exit)`：把一个 `__exit__()` 或同签名回调压栈；
- `callback(callback, *args, **kwds)`：注册任意回调（无法屏蔽异常）；
- `pop_all()`：把整个回调栈转移到新实例——用于"全有或全无"的打开模式：

```python
with ExitStack() as stack:
    files = [stack.enter_context(open(fname)) for fname in filenames]
    # 持有 close 方法，但暂时不调用它。
    close_files = stack.pop_all().close
    # 如果任何文件打开失败，则所有之前打开的文件
    # 将自动被关闭。如果所有文件都被成功地打开，
    # 即使在 with 语句结束后它们仍将保持打开状态。
    # 随后可以显式唤起 close_files() 来全部关闭它们。
```

异步对应物是 `AsyncExitStack`，支持组合同步和异步上下文管理器：

```python
async with AsyncExitStack() as stack:
    connections = [await stack.enter_async_context(get_connection())
        for i in range(5)]
    # 所有已打开连接都将在 async with 语句结束时
    # 自动被关闭，即使此后打开列表中连接的尝试
    # 引发了异常。
```

## 单次使用、可重用与可重进入

官方文档特别提醒（编者摘要）：大多数由 `@contextmanager` 创建的上下文管理器是"单次使用"的——生成器耗尽后就不能再次进入。而 `suppress()`、`redirect_stdout()` 等是可重进入（reentrant）的；`ExitStack` 也是可重用的。自己写上下文管理器并打算复用时，务必确认它支持多次 `with`，否则应保留显式 `with` 语句的形式。

---

> **来源**：本文转载自 [contextlib — 为 with 语句上下文提供的工具 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/library/contextlib.html)，作者 Python 软件基金会，许可 PSF 许可证第 2 版。抓取于 2026-09-13。

---

> 编者注：`contextlib` 官方文档默认你已理解 `with` 语句协议。为便于阅读，本篇开头用两个短例补充了上下文管理器（Context Manager）的基本协议，其余主体内容节选自官方文档，结构略有调整。
