---
title: 并发编程：GIL、threading 与 concurrent.futures
source_url: https://docs.python.org/zh-cn/3/library/concurrent.futures.html
author: Python 软件基金会
license: PSF 许可证第 2 版（GPL 兼容）
fetched_at: 2026-09-13
translated: false
order: 4
versions: Python 3.14
---

> **来源**：本文转载自 [concurrent.futures — 启动并行任务 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/library/concurrent.futures.html)，作者 Python 软件基金会，许可 PSF 许可证第 2 版。抓取于 2026-09-13。

> 编者注：为便于选型，开头补一节 GIL（全局解释器锁）与线程/进程的背景（摘编自官方术语表与 threading 文档），主体为 `concurrent.futures` 官方文档节选。注意：本篇的线程/进程池面向"并发执行阻塞任务"；如果要写高并发网络服务（如 LLM 应用中同时调用多家 API），首选下一篇的 asyncio。

## 背景先修：GIL 与线程 vs 进程（编者补充）

**全局解释器锁（Global Interpreter Lock，GIL）**是 CPython 解释器用来确保同一时刻只有一个线程执行 Python 字节码的互斥锁。它简化了 CPython 的实现与对象模型的线程安全，但代价是：**多线程无法让纯 CPU 计算在多核上并行**。

由此得出经典选型结论：

| 任务类型 | 推荐 | 原因 |
| --- | --- | --- |
| I/O 密集（网络请求、读写文件、调 LLM API） | `ThreadPoolExecutor` 或 asyncio | 线程在等待 I/O 时会释放 GIL，并发等待即收益 |
| CPU 密集（批处理数据、本地向量化、图像处理） | `ProcessPoolExecutor` | 每个进程有独立解释器与 GIL，真正多核并行 |
| 兼顾两者（实验性） | `InterpreterPoolExecutor`（3.14+） | 多解释器各自持有 GIL，真并行且比进程更轻 |

好消息是：无论选哪种，`concurrent.futures` 提供的接口完全一致——学会一次，随处替换。

（自 Python 3.13 起官方还提供了 `--disable-gil` 的自由线程构建版本，多线程可真正并行，但截至 2026-09 仍属可选构建，主流场景仍按上表选型。）

## concurrent.futures 总览

`concurrent.futures` 模块提供异步执行可调用对象的高层级接口。

异步执行可以使用线程来实现，即使用 `ThreadPoolExecutor` 或 `InterpreterPoolExecutor`，或者使用进程，即使用 `ProcessPoolExecutor`。每种方式实现了相同的接口，它是由抽象类 `Executor` 来定义的。

注意：`concurrent.futures.Future` 不可与 `asyncio.Future` 混淆，后者被设计用于 asyncio 任务和协程。

## Executor 对象

抽象类 `Executor` 提供异步执行调用的方法，要通过它的子类调用，而不是直接调用。

**submit(fn, /, \*args, \*\*kwargs)**：调度可调用对象 *fn*，以 `fn(*args, **kwargs)` 方式执行并返回一个代表该可调用对象执行的 `Future` 对象。

```python
with ThreadPoolExecutor(max_workers=1) as executor:
    future = executor.submit(pow, 323, 1235)
    print(future.result())
```

**map(fn, \*iterables, timeout=None, chunksize=1)**：类似于内置 `map(fn, *iterables)`，但 *fn* 是异步执行的，可并发地对 *fn* 发起多个调用。使用 `ProcessPoolExecutor` 时，这个方法会将 *iterables* 分块并作为单独的任务提交到执行池中，对非常长的迭代器，较大的 *chunksize* 能显著提升性能。

**shutdown(wait=True, \*, cancel_futures=False)**：向执行器发送完成信号并释放资源。若通过 `with` 语句将执行器作为上下文管理器使用，则可避免显式调用此方法：

```python
import shutil
with ThreadPoolExecutor(max_workers=4) as e:
    e.submit(shutil.copy, 'src1.txt', 'dest1.txt')
    e.submit(shutil.copy, 'src2.txt', 'dest2.txt')
    e.submit(shutil.copy, 'src3.txt', 'dest3.txt')
    e.submit(shutil.copy, 'src4.txt', 'dest4.txt')
```

## ThreadPoolExecutor

`ThreadPoolExecutor` 是 `Executor` 的子类，它使用线程池来异步执行调用，最多使用 *max_workers* 个线程。

关于默认工作线程数：3.8 起默认值改为 `min(32, os.cpu_count() + 4)`（3.13 起用 `os.process_cpu_count()`），官方的理由是：假定 `ThreadPoolExecutor` 通常用来重叠 I/O 操作而非 CPU 运算，工作线程的数量应当高于 `ProcessPoolExecutor` 的工作进程数量；同时保留至少 5 个工作线程用于 I/O 密集型任务，对释放了 GIL 的 CPU 密集型任务最多使用 32 个 CPU 核心，避免在多核机器上不知不觉地使用大量资源。

文档还特别给出了两种**死锁**反例：任务在池内等待另一个 Future 的结果，而池中工作单元已耗尽——例如 `max_workers=1` 时，任务里再 `submit` 并 `result()` 等待，永远不会完成。写任务函数时不要让它内部等待同一池中的其他任务。

### ThreadPoolExecutor 例子：并发抓取网页

```python
import concurrent.futures
import urllib.request

URLS = ['http://www.foxnews.com/',
        'http://www.cnn.com/',
        'http://europe.wsj.com/',
        'http://www.bbc.co.uk/',
        'http://nonexistent-subdomain.python.org/']

# 获取一个页面并报告其 URL 和内容
def load_url(url, timeout):
    with urllib.request.urlopen(url, timeout=timeout) as conn:
        return conn.read()

# 我们可以使用一个 with 语句来确保线程被迅速清理
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
    # 开始加载操作并以每个 Future 对象的 URL 对其进行标记
    future_to_url = {executor.submit(load_url, url, 60): url for url in URLS}
    for future in concurrent.futures.as_completed(future_to_url):
        url = future_to_url[future]
        try:
            data = future.result()
        except Exception as exc:
            print('%r generated an exception: %s' % (url, exc))
        else:
            print('%r page is %d bytes' % (url, len(data)))
```

`as_completed(futures)` 返回一个迭代器，哪个 Future 先完成就先产出哪个——这是并发编程里最常用的模式之一。把 `load_url` 换成"调用一个 LLM API"（配合本模块的 requests/httpx 篇），就是批量并发调用大模型的最小骨架。

> 编者注：对纯 LLM API 调用场景，asyncio + `httpx.AsyncClient` 通常比线程池更省资源（单线程可挂起成千上万个等待）；线程池的优势在于**零改造成本**——现有同步代码直接塞进 `submit` 即可。

## InterpreterPoolExecutor（3.14+）

`InterpreterPoolExecutor` 类（3.14 新增）使用一个**解释器池**来异步地执行调用。它是 `ThreadPoolExecutor` 的子类：每个工作线程都具有自己的解释器，并使用该解释器运行每个任务。

使用解释器而非只用线程的最大好处是**真正的多核心并行**。每个解释器都有自己的全局解释器锁，因此在一个解释器中运行的代码可以在一个 CPU 核心上运行，而在另一个解释器中运行的代码可以在不同的核心上无阻塞地运行。

每个工作线程的解释器都是与其他所有解释器隔离的。"隔离"意味着每个解释器都有自己的运行时状态，并且完全独立地运行。隔离也意味着可变对象或其他数据不能同时被多个解释器使用——不可变对象（字符串、元组等内置单例）没有这些限制。解释器之间的通信和同步推荐使用专用工具（PEP 734），效率较低的替代方法是用 `pickle` 序列化后经套接字或管道发送字节。

`submit()` 和 `map()` 的工作方式与正常情况一样，只是工作线程在收发可调用对象、参数与返回值时会用 `pickle` 序列化。

## ProcessPoolExecutor

`ProcessPoolExecutor` 类是 `Executor` 的子类，它使用进程池来异步地执行调用。`ProcessPoolExecutor` 会使用 `multiprocessing` 模块，这允许它**绕过全局解释器锁**，但也意味着只可以处理和返回可封存（pickle）的对象。

几个必须知道的限制：

- `__main__` 模块必须可以被工作者子进程导入，因此它不能工作在交互式解释器中；
- 在 REPL 或 lambda 中定义的函数不能期望能正确工作；
- 从已提交给 `ProcessPoolExecutor` 的可调用对象中调用 `Executor` 或 `Future` 的方法会导致死锁；
- 如果 *max_workers* 为 `None` 或未给出，它将默认为 `os.process_cpu_count()`；在 Windows 上 *max_workers* 必须小于等于 61；
- *max_tasks_per_child* 参数（3.11+）可控制单个工作进程在退出并被替换前最多执行的任务数，用于规避内存泄漏类问题；
- **3.14 起，默认的进程启动方法已改为不再使用 fork**——如果确需 fork 启动，必须显式传入 `mp_context=multiprocessing.get_context("fork")`。

### ProcessPoolExecutor 例子：CPU 密集的素数检测

```python
import concurrent.futures
import math

PRIMES = [
    112272535095293,
    112582705942171,
    112272535095293,
    115280095190773,
    115797848077099,
    1099726899285419]

def is_prime(n):
    if n < 2:
        return False
    if n == 2:
        return True
    if n % 2 == 0:
        return False

    sqrt_n = int(math.floor(math.sqrt(n)))
    for i in range(3, sqrt_n + 1, 2):
        if n % i == 0:
            return False
    return True

def main():
    with concurrent.futures.ProcessPoolExecutor() as executor:
        for number, prime in zip(PRIMES, executor.map(is_prime, PRIMES)):
            print('%d is prime: %s' % (number, prime))

if __name__ == '__main__':
    main()
```

## Future 对象

`Future` 类将可调用对象封装为异步执行。`Future` 实例由 `Executor.submit()` 创建，除非测试，不应直接创建。

常用方法：

- **cancel()**：尝试取消调用。如果调用正在执行或已结束运行不能被取消则该方法将返回 `False`，否则调用会被取消并且该方法将返回 `True`。
- **cancelled()** / **running()** / **done()**：查询 Future 的状态。
- **result(timeout=None)**：返回调用所返回的值。如果调用尚未完成则此方法将等待至多 *timeout* 秒，超时引发 `TimeoutError`。如果调用引发了一个异常，这个方法也会引发同样的异常——这就是上面例子里 `try/except Exception as exc` 能捕获工作线程异常的原因。
- **exception(timeout=None)**：返回调用所引发的异常（正常完成返回 `None`）。
- **add_done_callback(fn)**：附加可调用 *fn* 到 future 对象，当 future 被取消或完成运行时调用 *fn*（以该 future 为唯一参数）。

## 模块级便捷函数

- `concurrent.futures.wait(fs, timeout=None, return_when=...)`：等待给定的 Future 完成（可指定 `FIRST_COMPLETED` / `FIRST_EXCEPTION` / `ALL_COMPLETED`）；
- `concurrent.futures.as_completed(fs, timeout=None)`：按完成顺序迭代 Future。

## 小结与选型速查

1. 默认写法：I/O 密集用 `ThreadPoolExecutor`（或 asyncio），CPU 密集用 `ProcessPoolExecutor`；
2. 永远用 `with` 语句管理 Executor 生命周期；
3. 批量同构任务用 `executor.map`，异构/需定位来源的任务用 `submit` + `as_completed`；
4. 异常在 `future.result()` 调用时抛出，别忘了捕获；
5. 你的下一把并发工具，未必是线程——遇到高并发 I/O 时，请阅读下一篇《asyncio 异步》。
