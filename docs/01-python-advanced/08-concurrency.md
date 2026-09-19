---
title: 并发编程：concurrent.futures 与 threading
source_url: https://docs.python.org/zh-cn/3/library/concurrent.futures.html
author: Python 软件基金会（PSF）文档团队
license: PSF 许可证第 2 版
fetched_at: 2026-09-13
translated: false
versions: Python 3.14 官方文档
order: 8
group: 并发与异步
---
版本 3.2 中新增。

**源代码:**[Lib/concurrent/futures/thread.py](https://github.com/python/cpython/tree/3.14/Lib/concurrent/futures/thread.py), [Lib/concurrent/futures/process.py](https://github.com/python/cpython/tree/3.14/Lib/concurrent/futures/process.py) 和 [Lib/concurrent/futures/interpreter.py](https://github.com/python/cpython/tree/3.14/Lib/concurrent/futures/interpreter.py)

* * *

`concurrent.futures` 模块提供异步执行可调用对象的高层级接口。

异步执行可以使用线程来实现，即使用 `ThreadPoolExecutor` 或 `InterpreterPoolExecutor` 或者使用进程，即使用 `ProcessPoolExecutor`。 每种方式实现了相同的接口，它是由抽象类 `Executor` 来定义的。

`concurrent.futures.Future` 不可与 `asyncio.Future` 混淆，后者被设计用于 `asyncio` 任务和协程。 请参阅 asyncio 的 Future 文档查看两者的详细比较。

适用范围: not WASI.

此模块在 WebAssembly 平台上无效或不可用。 请参阅 WebAssembly 平台 了解详情。

## 先给结论：三种执行器怎么选

`concurrent.futures` 的价值在于：`ThreadPoolExecutor`、`InterpreterPoolExecutor`、`ProcessPoolExecutor` 实现同一个抽象接口 `Executor`，所以换执行器不用改业务代码。下表是三者与 `asyncio` 的横向对照（依据官方文档各节整理）：

| 维度 | `ThreadPoolExecutor` | `InterpreterPoolExecutor`（3.14+） | `ProcessPoolExecutor` | `asyncio` + `TaskGroup` |
| --- | --- | --- | --- | --- |
| 并行单位 | 线程 | 线程，但每个线程跑在独立子解释器里 | 进程 | 单线程事件循环里的协程 |
| 受 GIL 限制 | 是（CPU 密集无法多核加速） | 否，每个解释器有自己的 GIL，可真多核 | 否，各进程独立 GIL | 不适用（单线程） |
| 最适合的负载 | I/O 等待（HTTP、数据库、文件）；调用会释放 GIL 的 C 扩展 | CPU 密集且不想付进程开销 | CPU 密集、需要真并行 | 高并发 I/O，成千上万路同时等待 |
| 参数/返回值约束 | 直接引用共享对象，无需序列化 | 需用 `pickle` 序列化，且工作解释器之间**不能共享可变对象** | 参数与返回值必须可 pickle，`__main__` 必须可被导入 | 无序列化开销，直接共享内存对象 |
| `max_workers` 默认值 | `min(32, (os.process_cpu_count() or 1) + 4)` | 同 `ThreadPoolExecutor` | `os.process_cpu_count()`；Windows 上上限 61 | 无此概念，用 `Semaphore` 限流 |
| 提交任务的相对开销 | 低 | 中（序列化 + 跨解释器） | 高（序列化 + 进程间通信），故 `map()` 有 `chunksize` | 最低 |
| 崩溃隔离 | 一个线程抛未捕获异常只影响该任务；`initializer` 失败会让池 `BrokenThreadPool` | `initializer` 失败可能被替换为 `ExecutionFailed` | 子进程被杀（如 OOM）会让池 `BrokenProcessPool` | 一个未处理异常可能掀掉整个循环 |
| 典型坑 | 不适合长驻任务：解释器退出前会 join 所有线程；`Future` 互相等待会死锁 | 依赖模块全局状态的代码会表现不一致 | 交互式解释器里不能用；必须放进 `if __name__ == "__main__"` 守卫 | 任何一处同步阻塞调用（`time.sleep`、`requests`）都会卡住整个循环 |

据此的选择顺序（本站推荐的决策路径）：

1. **先问是不是 I/O 密集**。是 → 优先 `asyncio`（单线程就能压住上万并发，且和 LLM SDK 的异步客户端天然契合）；如果代码必须是同步的（很多老库、某些 SDK 只有同步接口），用 `ThreadPoolExecutor` 把阻塞调用挪出事件循环。
2. **CPU 密集**（分词、嵌入计算、特征工程、大批 JSON 解析）→ `ProcessPoolExecutor`；在 3.14+ 且代码不依赖跨任务共享可变对象时，`InterpreterPoolExecutor` 是开销更小的替代。
3. **混合负载**（边下载边解析）→ 外层 `asyncio`，重计算段 `await loop.run_in_executor(process_pool, fn, *args)`。

下面这张 GIL 决策表用来回答「换线程池到底有没有用」：

| 你的任务实际在做什么 | 多线程能否加速 | 推荐做法 |
| --- | --- | --- |
| 等待网络/磁盘（`urllib`、`requests`、数据库驱动、`socket`） | 能，等待期间解释器会释放 GIL | `ThreadPoolExecutor` 或 `asyncio` |
| 调用会释放 GIL 的 C 扩展（NumPy 大矩阵运算、`zlib`、部分 `hashlib`） | 能 | `ThreadPoolExecutor` |
| 纯 Python CPU 运算（循环、解析、字符串处理） | **不能**，只是轮流持有 GIL | `ProcessPoolExecutor` / 子解释器 |
| 依赖全局解释器状态或大量模块级可变量 | 多线程安全但多进程/子解释器会割裂状态 | 保持单进程，改用批处理或优化算法 |
| Python 3.13+ 且启用自由线程构建 | 多线程可多核（实验性） | 直接 `ThreadPoolExecutor`，注意扩展需为 free-threaded 重编 |

> **一句话选型**：I/O 密集用 `asyncio`（同步生态才用线程池）；CPU 密集用进程池；分不清就先测 —— 用《性能分析：profile/cProfile 与 py-spy》里的方法确认时间到底花在等待还是在算。

## Executor 对象

**concurrent.futures.Executor**

抽象类提供异步执行调用方法。要通过它的子类调用，而不是直接调用。

**submit(_fn_, _/_, _\*args_, _\*\*kwargs_)**

调度可调用对象 _fn_，以 `fn(*args, **kwargs)` 方式执行并返回一个代表该可调用对象的执行的 `Future` 对象。

```python
with ThreadPoolExecutor(max_workers=1) as executor:
    future = executor.submit(pow, 323, 1235)
    print(future.result())
```

**map(_fn_, _\*iterables_, _timeout\=None_, _chunksize\=1_, _buffersize\=None_)**

类似于 `map(fn, *iterables)` 但有以下差异：

-   _iterables_ 的收集是立即而非惰性的，除非指定了 _buffersize_ 来限制提交结果尚未产生的任务数量。 如果缓冲区已满，对 _iterables_ 的迭代将暂停直到缓冲区产生了一个结果。

-   _fn_ 是异步执行的并且可以并发对 _fn_ 的多个调用。


如果 `__next__()` 被调用且从对 `Executor.map()` 原始调用 _timeout_ 秒之后其结果还不可用则已返回的迭代器将引发 `TimeoutError`。 _timeout_ 可以是整数或浮点数。 如果 _timeout_ 未指定或为 `None`，则不限制等待时间。

如果 _fn_ 调用引发了异常，那么当从迭代器获取其值时该异常将被引发。

当使用 `ProcessPoolExecutor` 时，这个方法会将 _iterables_ 分块并作为单独的任务提交到执行池中。 这些分块的（近似）大小可通过将 _chunksize_ 设为一个正整数来指定。 对于非常长的迭代器来说，使用较大的 _chunksize_ 值相比默认大小 1 能显著地提升性能。 对于 `ThreadPoolExecutor` 和 `InterpreterPoolExecutor`，_chunksize_ 将没有效果。

在 3.5 版本发生变更: 增加了 _chunksize_ 形参。

在 3.14 版本发生变更: 增加了 _buffersize_ 形参。

**shutdown(_wait\=True_, _\*_, _cancel\_futures\=False_)**

当待执行的 future 对象完成执行后向执行者发送信号，它就会释放正在使用的任何资源。 在关闭后调用 `Executor.submit()` 和 `Executor.map()` 将会引发 `RuntimeError`。

如果 _wait_ 为 `True` 则此方法只有在所有待执行的 future 对象完成执行且释放已分配的资源后才会返回。 如果 _wait_ 为 `False`，方法立即返回，所有待执行的 future 对象完成执行后会释放已分配的资源。 不管 _wait_ 的值是什么，整个 Python 程序将等到所有待执行的 future 对象完成执行后才退出。

如果 _cancel\_futures_ 为 `True`，此方法将取消所有执行器还未开始运行的挂起的 Future。无论 _cancel\_futures_ 的值是什么，任何已完成或正在运行的 Future 都不会被取消。

如果 _cancel\_futures_ 和 _wait_ 均为 `True`，则执行器已开始运行的所有 Future 将在此方法返回之前完成。 其余的 Future 会被取消。

若通过 `with` 语句将执行器作为 context manager 使用，则可避免显式调用此方法，因为该语句会自动关闭 `Executor` (其等待行为等同于调用 `Executor.shutdown()` 并将 _wait_ 参数设为 `True` 的情况):

```python
import shutil
with ThreadPoolExecutor(max_workers=4) as e:
    e.submit(shutil.copy, 'src1.txt', 'dest1.txt')
    e.submit(shutil.copy, 'src2.txt', 'dest2.txt')
    e.submit(shutil.copy, 'src3.txt', 'dest3.txt')
    e.submit(shutil.copy, 'src4.txt', 'dest4.txt')
```

在 3.9 版本发生变更: 增加了 _cancel\_futures_。

## ThreadPoolExecutor

`ThreadPoolExecutor` 是 `Executor` 的子类，它使用线程池来异步执行调用。

当可调用对象已关联了一个 `Future` 然后在等待另一个 `Future` 的结果时就会导致死锁情况。例如:

```python
import time
def wait_on_b():
    time.sleep(5)
    print(b.result())  # b 永远不会结束因为它在等待 a。
    return 5

def wait_on_a():
    time.sleep(5)
    print(a.result())  # a 永远不会结束因为它在等待 b。
    return 6

executor = ThreadPoolExecutor(max_workers=2)
a = executor.submit(wait_on_b)
b = executor.submit(wait_on_a)
```

以及:

```python
def wait_on_future():
    f = executor.submit(pow, 5, 2)
    # 这将永远不会完成因为只有一个工作线程
    # 并且它正在执行此函数
    print(f.result())

executor = ThreadPoolExecutor(max_workers=1)
future = executor.submit(wait_on_future)
# 注意：调用 future.result() 也会导致死锁因为
# 这个工作线程已经在等待 wait_on_future()。
```

**concurrent.futures.ThreadPoolExecutor(_max\_workers\=None_, _thread\_name\_prefix\=''_, _initializer\=None_, _initargs\=()_)**

`Executor` 子类使用最多 _max\_workers_ 个线程的线程池来异步执行调用。

所有排入 `ThreadPoolExecutor` 的线程将在解释器退出之前被合并。 请注意执行此操作的退出处理器会在任何使用 `atexit` 添加的退出处理器 _之前_ 被执行。 这意味着主线程中的异常必须被捕获和处理以便向线程发出信号使其能够优雅地退出。 由于这个原因，建议不要将 `ThreadPoolExecutor` 用于长期运行的任务。

_initializer_ 是在每个工作者线程开始处调用的一个可选可调用对象。 _initargs_ 是传递给初始化器的元组参数。如果 _initializer_ 引发了异常，所有当前等待的任务以及任何向池提交更多任务的尝试都将引发 `BrokenThreadPool`。

在 3.5 版本发生变更: 如果 _max\_workers_ 为 `None` 或没有指定，将默认为机器处理器的个数乘以 `5`，因为假定 `ThreadPoolExecutor` 通常用来重叠 I/O 操作而非 CPU 运算，并且工作线程的数量应当高于 `ProcessPoolExecutor` 的工作进程数量。

在 3.6 版本发生变更: 增加了 _thread\_name\_prefix_ 形参来允许用户控制由线程池创建的 `threading.Thread` 工作线程名称以方便调试。

在 3.7 版本发生变更: 加入 _initializer_ 和 _initargs_ 参数。

在 3.8 版本发生变更: _max\_workers_ 的默认值已改为 `min(32, os.cpu_count() + 4)`。 这个默认值会保留至少 5 个工作线程用于 I/O 密集型任务。 对于那些释放了 GIL 的 CPU 密集型任务，它最多会使用 32 个 CPU 核心。这样能够避免在多核机器上不知不觉地使用大量资源。

现在 ThreadPoolExecutor 在启动 _max\_workers_ 个工作线程之前也会重用空闲的工作线程。

在 3.13 版本发生变更: _max\_workers_ 的默认值已改为 `min(32, (os.process_cpu_count() or 1) + 4)`。

### ThreadPoolExecutor 例子

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

## InterpreterPoolExecutor

版本 3.14 中新增。

`InterpreterPoolExecutor` 类使用一个解释器池来异步地执行调用。 它是 `ThreadPoolExecutor` 的子类，这意味着每个工作解释器在它自己的线程中运行。 它与其父类的区别在于每个工作线程都具有自己的解释器，并使用该解释器运行每个任务。

使用解释器而非只用线程的最大好处是真正的多核心并行。 每个解释器都有自己的 全局解释器锁，因此在一个解释器中运行的代码可以在一个 CPU 核心上运行，而在另一个解释器中运行的代码可以在不同的核心上无阻塞地运行。

作为交换的是编写用于多解释器的并发代码需要额外的考量。 不过，这是由于它会迫使你谨慎处理多解释器要怎样以及何时进行交互，并明确哪些数据要在解释器之间进行共享。 这导致几项有助于对额外的考量进行平衡的好处，包括真正的多核心并行。 例如，以这种方式编写的代码可以更容易地理顺并发过程。另一项重要的好处是你不必处理某些使用线程的关键痛点，比如竞争条件等。

每个工作线程的解释器都是与其他所有解释器隔离的。“隔离”意味着每个解释器都有自己的运行时状态，并且完全独立地运行。例如，如果你在一个解释器中重定向 `sys.stdout` ，它不会自动重定向到任何其他解释器。如果你在一个解释器中导入了一个模块，它不会在其他解释器中自动导入。你需要在需要它的解释器中单独导入模块。事实上，在解释器中导入的每个模块都是与不同解释器中的相同模块完全独立的对象，包括 `sys`、`builtins` 甚至 `__main__`。

隔离意味着可变对象或其他数据不能同时被多个解释器使用。这实际上意味着解释器实际上不能共享这些对象或数据。相反，每个解释器必须有自己的副本，并且必须手动同步副本之间的任何更改。不可变对象和数据，如不可变对象的内置单例、字符串和元组，就没有这些限制。

解释器之间的通信和同步使用专用工具是最有效的，就像在 [**PEP 734**](https://peps.python.org/pep-0734/) 中建议的那样。 一种效率较低的替代方法是使用 `pickle` 进行序列化，然后通过共享的 `套接字` 或 `管道` 发送字节。

**concurrent.futures.InterpreterPoolExecutor(_max\_workers\=None_, _thread\_name\_prefix\=''_, _initializer\=None_, _initargs\=()_)**

一个 `ThreadPoolExecutor` 子类，使用最多 _max\_workers_ 线程的池异步执行调用。 每个线程在自己的解释器中运行任务。 工作解释器彼此隔离，这意味着每个解释器都有自己的运行时状态，并且它们不能共享任何可变对象或其他数据。 每个解释器都有自己的 全局解释器锁，这意味着使用该执行器运行的代码具有真正的多核并行性。

可选的 _initializer_ 和 _initargs_ 参数与 `ThreadPoolExecutor` 具有相同的含义：初始化器在每个工作线程被创建时运行，尽管在这种情况下它是在工作线程的解释器中运行的。 当执行器将 _initializer_ 和 _initargs_ 发送给工作线程的解释器时，使用 `pickle` 对它们进行序列化。

备注

执行器可以将来自 _initializer_ 的未捕获异常替换为 `ExecutionFailed`。

来自 `ThreadPoolExecutor` 的其他警告也适用于此。

`submit()` 和 `map()` 的工作方式与正常情况一样，只是工作线程在将可调用函数和参数发送到其解释器时使用 `pickle` 对其进行序列化。 在发送返回值时，工作线程同样会对其进行序列化。

当一个工作线程的当前任务引发未捕获的异常时，工作线程总是会尝试原样保留异常。 如果成功则它还会将 `__cause__` 设为对应的 `ExecutionFailed` 实例，该实例包含原始异常的概要信息。 在工作线程不能原样保留异常的少数情况下它会改为直接保留对应的 `ExecutionFailed` 实例。

## ProcessPoolExecutor

`ProcessPoolExecutor` 类是 `Executor` 的子类，它使用进程池来异步地执行调用。 `ProcessPoolExecutor` 会使用 `multiprocessing` 模块，这允许它绕过 全局解释器锁 但也意味着只可以处理和返回可封存的对象。

`__main__` 模块必须可以被工作者子进程导入。这意味着 `ProcessPoolExecutor` 不可以工作在交互式解释器中。

从已提交给 `ProcessPoolExecutor` 的可调用对象中调用 `Executor` 或 `Future` 的方法会导致死锁。

请注意，在 `ProcessPoolExecutor` 上使用 `submit()` 和 `map()` 时函数和参数需要如 `multiprocessing.Process` 那样应用必要的限制条件以支持 pickle 操作。 在 REPL 或 lambda 中定义的函数不应被期望能正确工作。

**concurrent.futures.ProcessPoolExecutor(_max\_workers\=None_, _mp\_context\=None_, _initializer\=None_, _initargs\=()_, _max\_tasks\_per\_child\=None_)**

异步地执行调用的 `Executor` 子类使用最多 _max\_workers_ 个进程的进程池。 如果 _max\_workers_ 为 `None` 或未给出，它将默认为 `os.process_cpu_count()`。 如果 _max\_workers_ 小于等于 `0`，则将引发 `ValueError`。 在 Windows 上，_max\_workers_ 必须小于等于 `61`。 如果不是这样则将引发 `ValueError`。 如果 _max\_workers_ 为 `None`，则选择的默认值最多为 `61`，即使存在更多的处理器。 _mp\_context_ 可以是一个 `multiprocessing` 上下文或是 `None`。 它将被用来启动工作进程。 如果 _mp\_context_ 为 `None` 或未给出，则将使用默认的 `multiprocessing` 上下文。 参见 上下文和启动方法。

_initializer_ 是一个可选的可调用对象，它会在每个工作进程启动时被调用；_initargs_ 是传给 initializer 的参数元组。 如果 _initializer_ 引发了异常，则所有当前在等待的任务以及任何向进程池提交更多任务的尝试都将引发 `BrokenProcessPool`。

_max\_tasks\_per\_child_ 是指定单个进程在其退出并替换为新工作进程之前可以执行的最大任务数量的可选参数。 在默认情况下 _max\_tasks\_per\_child_ 为 `None` 表示工作进程将存活与进程池一样长的时间。 当指定了最大数量时，则如果不存在 _mp\_context_ 形参则将默认使用 "spawn" 多进程启动方法。 此特性不能兼容 "fork" 启动方法。

在 3.3 版本发生变更: 当某个工作进程突然终止时，现在将引发 `BrokenProcessPool`。 在之前版本中，它的行为是未定义的但在执行器上的操作或它的 future 对象往往会被冻结或死锁。

在 3.7 版本发生变更: 添加 _mp\_context_ 参数允许用户控制由进程池创建的工作者进程的启动方法。

加入 _initializer_ 和 _initargs_ 参数。

在 3.11 版本发生变更: 增加了 _max\_tasks\_per\_child_ 参数以允许用户控制进程池中工作进程的生命期。

在 3.12 版本发生变更: 在 POSIX 系统上，如果你的应用程序有多个线程而 `multiprocessing` 上下文使用了 `"fork"` 启动方法：内部调用的 `os.fork()` 函数来生成工作进程可能会引发 `DeprecationWarning`。 请传递配置为使用不同启动方法的 _mp\_context_。 进一步的解释请参阅 `os.fork()` 文档。

在 3.13 版本发生变更: 在默认情况下 _max\_workers_ 将使用 `os.process_cpu_count()`，而不是 `os.cpu_count()`。

在 3.14 版本发生变更: 默认的进程启动方法 (参见 上下文和启动方法) 已改为不再使用 _fork_。 如果你需要为 `ProcessPoolExecutor` 使用 _fork_ 启动方法你必须显式地传入 `mp_context=multiprocessing.get_context("fork")`。

在 3.14.7 版本发生变更: 修复当一个工作进程达到其 _max\_tasks\_per\_child_ 限制而退出之后如果仍有任务在队列中时执行器可能挂起而导致的死锁问题 ([gh-115634](https://github.com/python/cpython/issues/115634))。

**terminate\_workers()**

尝试通过对每个存活的工作进程调用 `Process.terminate` 来立即终止它们。 在内部，它还将调用 `Executor.shutdown()` 以确保所有与执行器相关联的其他资源被释放。

在调用此方法之后调用方不应再向执行器提交任务。

版本 3.14 中新增。

**kill\_workers()**

尝试通过对每个进程调用 `Process.kill` 来立即杀死所有存活的工作进程。 在内部，它还将调用 `Executor.shutdown()` 来确保释放与执行器相关的所有其他资源。

在调用此方法之后调用方不应再向执行器提交任务。

版本 3.14 中新增。

### ProcessPoolExecutor 例子

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

`Future` 类将可调用对象封装为异步执行。`Future` 实例由 `Executor.submit()` 创建。

**concurrent.futures.Future**

将可调用对象封装为异步执行。`Future` 实例由 `Executor.submit()` 创建，除非测试，不应直接创建。

**cancel()**

尝试取消调用。 如果调用正在执行或已结束运行不能被取消则该方法将返回 `False`，否则调用会被取消并且该方法将返回 `True`。

**cancelled()**

如果调用成功取消返回 `True`。

**running()**

如果调用正在执行而且不能被取消那么返回 `True` 。

**done()**

如果调用已被取消或正常结束那么返回 `True`。

**result(_timeout\=None_)**

返回调用所返回的值。 如果调用尚未完成则此方法将等待至多 _timeout_ 秒。 如果调用在 _timeout_ 秒内仍未完成，则将引发 `TimeoutError`。 _timeout_ 可以为整数或浮点数。 如果 _timeout_ 未指定或为 `None`，则不限制等待时间。

如果 future 在完成前被取消则 `CancelledError` 将被触发。

如果调用引发了一个异常，这个方法也会引发同样的异常。

**exception(_timeout\=None_)**

返回调用所引发的异常。 如果调用尚未完成则此方法将等待至多 _timeout_ 秒。 如果调用在 _timeout_ 秒内仍未完成，则将引发 `TimeoutError`。 _timeout_ 可以为整数或浮点数。 如果 _timeout_ 未指定或为 `None`，则不限制等待时间。

如果 future 在完成前被取消则 `CancelledError` 将被触发。

如果调用正常完成那么返回 `None`。

**add\_done\_callback(_fn_)**

附加可调用 _fn_ 到 future 对象。当 future 对象被取消或完成运行时，将会调用 _fn_，而这个 future 对象将作为它唯一的参数。

加入的可调用对象总被属于添加它们的进程中的线程按加入的顺序调用。如果可调用对象引发一个 `Exception` 子类，它会被记录下来并被忽略掉。如果可调用对象引发一个 `BaseException` 子类，这个行为没有定义。

如果 future 对象已经完成或已取消，_fn_ 会被立即调用。

下面这些 `Future` 方法用于单元测试和 `Executor` 实现。

**set\_running\_or\_notify\_cancel()**

这个方法只可以在执行关联 `Future` 工作之前由 `Executor` 实现调用或由单元测试调用。

如果此方法返回 `False` 则 `Future` 已被取消，即 `Future.cancel()` 已被调用并返回 `True`。 任何等待 `Future` 完成 (即通过 `as_completed()` 或 `wait()`) 的线程将被唤醒。

如果此方法返回 `True` 则 `Future` 没有被取消并已被置为正在运行的状态，即对 `Future.running()` 的调用将返回 `True`。

这个方法只可以被调用一次并且不能在调用 `Future.set_result()` 或 `Future.set_exception()` 之后再调用。

**set\_result(_result_)**

将 `Future` 关联工作的结果设为 _result_。

这个方法只可以由 `Executor` 实现和单元测试使用。

在 3.8 版本发生变更: 如果 `Future` 已经完成则此方法会引发 `concurrent.futures.InvalidStateError`。

**set\_exception(_exception_)**

将 `Future` 关联工作的异常设为 `Exception` _exception_。

这个方法只可以由 `Executor` 实现和单元测试使用。

在 3.8 版本发生变更: 如果 `Future` 已经完成则此方法会引发 `concurrent.futures.InvalidStateError`。

### Future 方法速查

| 方法 | 作用 | 未取消/未完成时的行为 | 会抛出的异常 |
| --- | --- | --- | --- |
| `cancel()` | 尝试取消调用 | 尚未开始的挂起任务可被取消 | — |
| `cancelled()` | 是否已成功取消 | — | — |
| `running()` | 是否正在执行且不可取消 | — | — |
| `done()` | 是否已取消或正常结束 | — | — |
| `result(timeout=None)` | 取返回值，最多等待 `timeout` 秒 | 阻塞等待 | `TimeoutError`（超时）、`CancelledError`（已取消）、任务自身异常 |
| `exception(timeout=None)` | 取任务抛出的异常 | 阻塞等待；任务正常结束返回 `None` | `TimeoutError`、`CancelledError` |
| `add_done_callback(fn)` | 注册回调，回调以 future 为唯一参数 | 若已完成/已取消则立即调用 | 回调抛 `Exception` 会被记录并忽略 |

`set_running_or_notify_cancel()`、`set_result()`、`set_exception()` 只供 `Executor` 实现与单元测试使用，业务代码不要调用。

## 模块函数

**concurrent.futures.wait(_fs_, _timeout\=None_, _return\_when\=ALL\_COMPLETED_)**

等待由 _fs_ 指定的 `Future` 实例（可能由不同的 `Executor` 实例创建）完成。 重复传给 _fs_ 的 future 会被移除并将只返回一次。 返回一个由集合组成的具名 2 元组。 第一个集合的名称为 `done`，包含在等待完成之前已完成的 future（包括正常结束或被取消的 future）。 第二个集合的名称为 `not_done`，包含未完成的 future（包括挂起的或正在运行的 future）。

_timeout_ 可以用来控制返回前最大的等待秒数。 _timeout_ 可以为 int 或 float 类型。 如果 _timeout_ 未指定或为 `None` ，则不限制等待时间。

_return\_when_ 指定此函数应在何时返回。它必须为以下常数之一:

| 常量 | 描述 |
| --- | --- |
| `concurrent.futures.FIRST_COMPLETED` | 函数将在任意 future 对象结束或取消时返回。 |
| `concurrent.futures.FIRST_EXCEPTION` | 该函数将在任何 future 对象通过引发异常而结束时返回。如果没有任何 future 对象引发异常那么它将等价于 `ALL_COMPLETED`。 |
| `concurrent.futures.ALL_COMPLETED` | 函数将在所有 future 对象结束或取消时返回。 |

**concurrent.futures.as\_completed(_fs_, _timeout\=None_)**

返回一个迭代器，每当 _fs_ 所给出的 `Future` 实例（可能由不同的 `Executor` 实例创建）完成时这个迭代器会产生新的 future（包括正常结束或被取消的 future 对象）。 任何由 _fs_ 给出的重复的 future 对象将只被返回一次。 任何在 `as_completed()` 被调用之前完成的 future 对象将优先被产生。 如果 `__next__()` 被调用并且在最初调用 `as_completed()` 之后的 _timeout_ 秒内其结果仍不可用，这个迭代器将引发 `TimeoutError`。 _timeout_ 可以为整数或浮点数。 如果 _timeout_ 未指定或为 `None`，则不限制等待时间。

参见

**[**PEP 3148**](https://peps.python.org/pep-3148/) -- future 对象 - 异步执行指令。**

该提案描述了将此特性纳入 Python 标准库。

## Exception 类

**concurrent.futures.CancelledError**

future 对象被取消时会触发。

**concurrent.futures.TimeoutError**

`TimeoutError` 的一个已被弃用的别名，会在 future 操作超出了给定的时限时被引发。

在 3.11 版本发生变更: 这个类是 `TimeoutError` 的别名。

**concurrent.futures.BrokenExecutor**

派生自 `RuntimeError`，当执行器因某些原因而中断且不能用来提交或执行新任务时将被引发。

版本 3.7 中新增。

**concurrent.futures.InvalidStateError**

当某个操作在一个当前状态所不允许的 future 上执行时将被引发。

版本 3.8 中新增。

**concurrent.futures.thread.BrokenThreadPool**

派生自 `BrokenExecutor`，这个异常类会在 `ThreadPoolExecutor` 的某个工作线程初始化失败时被引发。

版本 3.7 中新增。

**concurrent.futures.interpreter.BrokenInterpreterPool**

派生自 `BrokenThreadPool`，这个异常类会在 `InterpreterPoolExecutor` 的某个工作线程初始化失败时被引发。

版本 3.14 中新增。

**concurrent.futures.process.BrokenProcessPool**

派生自 `BrokenExecutor` (原为 `RuntimeError`)，这个异常类会在 `ProcessPoolExecutor` 的某个工作进程以不完整的方式终结（例如，从外部杀掉）时被引发。

版本 3.3 中新增。


## threading —— 基于线程的并行

**源代码:**[Lib/threading.py](https://github.com/python/cpython/tree/3.14/Lib/threading.py)

* * *

这个模块在低层级的 `_thread` 模块之上构造了高层级的线程接口。

适用范围: not WASI.

此模块在 WebAssembly 平台上无效或不可用。请参阅 WebAssembly 平台 了解详情。

## 概述

`threading` 模块提供了一种在单个进程内部并发地运行多个 [线程](https://en.wikipedia.org/wiki/Thread_\(computing\)) (从进程分出的更小单位) 的方式。 它允许创建和管理线程，以便能够平行地执行多个任务，并共享内存空间。线程特别适用于 I/O 密集型的任务，如文件操作或发送网络请求，在此类任务中大部分时间都会消耗于等待外部资源。

典型的 `threading` 使用场景包括管理一个工作线程池来并发地处理多个任务。下面是一个使用 `Thread` 创建并启动线程的简单示例:

```python
import threading
import time

def crawl(link, delay=3):
    print(f"crawl started for {link}")
    time.sleep(delay)  # 阻塞 I/O (模拟网络请求)
    print(f"crawl ended for {link}")

links = [
    "https://python.org",
    "https://docs.python.org",
    "https://peps.python.org",
]

# 针对每个链接启动线程
threads = []
for link in links:
    # 使用 `args` 传入位置参数并使用 `kwargs` 传入关键字参数
    t = threading.Thread(target=crawl, args=(link,), kwargs={"delay": 2})
    threads.append(t)

# 启动每个线程
for t in threads:
    t.start()

# 等待所有线程结束
for t in threads:
    t.join()
```

在 3.7 版本发生变更: 这个模块曾经为可选项，但现在总是可用。

参见

`concurrent.futures.ThreadPoolExecutor` 提供了一个高层级接口用来向后台线程推送任务而不会阻塞调用方线程的执行，同时仍然能够在需要时获取任务的结果。

`queue` 提供了一个线程安全的接口用来在运行中的线程之间交换数据。

`asyncio` 提供了一个替代方式用来实现任务层级的并发而不要求使用多个操作系统线程。

备注

在 Python 2.x 系列中，此模块包含有某些方法和函数 `camelCase` 形式的名称。它们在 Python 3.10 中已弃用，但为了与 Python 2.5 及更旧版本的兼容性而仍受到支持。

在 CPython 中，由于存在 全局解释器锁，同一时刻只有一个线程可以执行 Python 代码（虽然某些性能导向的库可能会去除此限制）。如果你想让你的应用更好地利用多核心计算机的计算资源，推荐你使用 `multiprocessing` 或 `concurrent.futures.ProcessPoolExecutor`。 但是，如果你想要同时运行多个 I/O 密集型任务，则多线程仍然是一个合适的模型。

## GIL 和性能的考量

与使用多个进程来绕过 global interpreter lock (GIL) 的 `multiprocessing` 模块不同，threading 模块是在单个进程内部操作的，这意味着所有线程共享相同的内存空间。不过，对于 CPU 密集型任务来说 GIL 会限制 threading 带来的性能提升，因为在同一时刻只有一个线程能执行 Python 字节码。尽管如此，在许多场景中线程仍然是实现并发的有用工具。

对于 Python 3.13， 自由线程 构建版可以禁用 GIL，启用真正的线程并行执行，但此特性在默认情况下不可用 (参见 [**PEP 703**](https://peps.python.org/pep-0703/))。

## threading 同步原语速查

下面这张表把 `threading` 提供的锁与信号对象放在一处对照（各条目细节见后文对应小节）。它们都支持作为上下文管理器使用（`Lock`、`RLock`、`Condition`、`Semaphore`、`BoundedSemaphore`），进入时 `acquire()`、退出时 `release()`，因此正常情况下不必手写 `try/finally`。

| 原语 | 解决什么问题 | 关键方法 | 常见坑 |
| --- | --- | --- | --- |
| `Lock` | 互斥：同一时刻只允许一个线程进入临界区 | `acquire(blocking=True, timeout=-1)`、`release()` | 不可重入：同一线程二次 `acquire()` 会自锁死；`acquire(False)` 返回布尔而非抛异常 |
| `RLock` | 同一线程可重复加锁（递归调用、方法间共享锁） | 同 `Lock`；`_release_save()`/`_acquire_restore()`/`_is_owned()` 供 `Condition` 用 | 本质是工厂函数，返回平台相关实现，别用 `isinstance` 判定类型；跨线程释放仍会死锁 |
| `Condition` | 等待「某条件成立」，避免忙轮询 | `wait(timeout=None)`、`wait_for(predicate)`、`notify(n=1)`、`notify_all()` | 必须在持有锁时调用 `wait()`/`notify()`；`notify()` 不会立即释放锁，被唤醒的线程要等通知方退出 `with` 才继续 |
| `Semaphore` | 限流：允许最多 N 个线程并发访问 | `acquire()`、`release()` | 忘记 `release()` 会永久占坑；`release()` 可以超过初值 |
| `BoundedSemaphore` | 同上，但阻止把计数放回超过初值 | 同上 | 多余的 `release()` 会抛 `ValueError`，正是用它来抓「release 比 acquire 多」的 bug |
| `Event` | 一次性/可重复的「开关」，一对多广播 | `set()`、`wait(timeout=None)`、`clear()`、`is_set()` | `wait()` 返回布尔表示是否超时；`clear()` 与 `set()` 竞争会造成漏唤醒 |
| `Timer` | 延迟 N 秒后在某线程执行 | `start()`、`cancel()` | `cancel()` 只在计时器尚未触发时有效 |
| `Barrier` | 让 N 个线程在同一屏障点会合 | `wait(timeout=None)`、`abort()`、`reset()` | 某个线程掉队会让屏障进入 broken 态，之后所有 `wait()` 抛 `BrokenBarrierError`；建议创建时给合理 timeout |

## 参考

这个模块定义了以下函数：

**threading.active\_count()**

返回当前存活的 `Thread` 对象的数量。返回值与 `enumerate()` 所返回的列表长度一致。

函数 `activeCount` 是此函数的已弃用别名。

**threading.current\_thread()**

返回当前对应于调用方控制线程的 `Thread` 对象。如果调用方的控制线程不是通过 `threading` 模块创建的，则会返回一个功能受限的假线程对象。

函数 `currentThread` 是此函数的已弃用别名。

**threading.excepthook(_args_, _/_)**

处理由 `Thread.run()` 引发的未捕获异常。

_args_ 参数具有以下属性：

-   _exc\_type_: 异常类型

-   _exc\_value_: 异常值，可以是 `None`.

-   _exc\_traceback_: 异常回溯，可以是 `None`.

-   _thread_: 引发异常的线程，可以为 `None`。


如果 _exc\ 为 `SystemExit`，则异常会被静默地忽略。在其他情况下，异常将被打印到 `sys.stderr`.

如果此函数引发了异常，则会调用 `sys.excepthook()` 来处理它。

`threading.excepthook()` 可以被重载以控制由 `Thread.run()` 引发的未捕获异常的处理方式。

使用定制钩子存放 _exc\_value_ 可能会创建引用循环。它应当在不再需要异常时被显式地清空以打破引用循环。

如果一个对象正在被销毁，那么使用自定义的钩子储存 _thread_ 可能会将其复活。请在自定义钩子生效后避免储存 _thread_，以避免对象的复活。

参见

`sys.excepthook()` 处理未捕获的异常。

版本 3.8 中新增。

**threading.\_\_excepthook\_\_**

保存 `threading.excepthook()` 的原始值。它被保存以便在原始值碰巧被已损坏或替代对象所替换的情况下可被恢复。

版本 3.10 中新增。

**threading.get\_ident()**

返回当前线程的“线程标识符”。它是一个非零的整数。它的值没有直接含义，主要是用作 magic cookie，比如作为含有线程相关数据的字典的索引。线程标识符可能会在线程退出，新线程创建时被复用。

版本 3.3 中新增。

**threading.get\_native\_id()**

返回内核分配给当前线程的原生集成线程 ID。这是一个非负整数。它的值可被用来在整个系统中唯一地标识这个特定线程（直到线程终结，在那之后该值可能会被 OS 回收再利用）。

适用范围: Windows, FreeBSD, Linux, macOS, OpenBSD, NetBSD, AIX, DragonFlyBSD, GNU/kFreeBSD.

版本 3.8 中新增。

在 3.13 版本发生变更: 增加了对 GNU/kFreeBSD 的支持。

**threading.enumerate()**

返回当前所有存活的 `Thread` 对象的列表。该列表包括守护线程以及 `current_thread()` 创建的空线程。 它不包括已终结的和尚未开始的线程。但是，主线程将总是结果的一部分，即使是在已终结的时候。

**threading.main\_thread()**

返回主 `Thread` 对象。一般情况下，主线程是 Python 解释器开始时创建的线程。

版本 3.4 中新增。

**threading.settrace(_func_)**

为所有从 `threading` 模块启动的线程设置追踪函数，在每个线程的 `run()` 方法被调用前，_func_ 会被传递给 `sys.settrace()`。

**threading.settrace\_all\_threads(_func_)**

为从 `threading` 模块启动的所有线程以及当前正在执行的所有 Python 线程设置追踪函数。

_func_ 将为每个线程传递给 `sys.settrace()`，在其 `run()` 方法被调用之前。

版本 3.12 中新增。

**threading.gettrace()**

返回由 `settrace()` 设置的跟踪函数。

版本 3.10 中新增。

**threading.setprofile(_func_)**

为从 `threading` 模块启动的所有线程设置性能分析函数。在每个线程的 `run()` 方法被调用前，_func_ 会被传递给 `sys.setprofile()`。

**threading.setprofile\_all\_threads(_func_)**

为从 `threading` 模块启动的所有线程和当前正在执行的所有 Python 线程设置性能分析函数。

_func_ 将为每个线程传递给 `sys.setprofile()`，在其 `run()` 方法被调用之前。

版本 3.12 中新增。

**threading.getprofile()**

返回由 `setprofile()` 设置的性能分析函数。

版本 3.10 中新增。

**threading.stack\_size(\[_size_\])**

返回创建线程时使用的堆栈大小。可选参数 _size_ 指定之后新建的线程的堆栈大小，而且一定要是 0（根据平台或者默认配置）或者最小是 32,768(32KiB) 的一个正整数。如果 _size_ 没有指定，默认是 0。如果不支持改变线程堆栈大小，会抛出 `RuntimeError` 错误。如果指定的堆栈大小不合法，会抛出 `ValueError` 错误并且不会修改堆栈大小。32KiB 是当前最小的能保证解释器有足够堆栈空间的堆栈大小。需要注意的是部分平台对于堆栈大小会有特定的限制，例如要求大于 32KiB 的堆栈大小或者需要根据系统内存页面的整数倍进行分配 - 应当查阅平台文档有关详细信息（4KiB 页面比较普遍，在没有更具体信息的情况下，建议的方法是使用 4096 的倍数作为堆栈大小）。

适用范围: Windows, pthreads.

带有 POSIX 线程支持的 Unix 平台。

这个模块同时定义了以下常量：

**threading.TIMEOUT\_MAX**

阻塞函数（ `Lock.acquire()`, `RLock.acquire()`, `Condition.wait()`, ...）中形参 _timeout_ 允许的最大值。传入超过这个值的 timeout 会抛出 `OverflowError` 异常。

版本 3.2 中新增。

这个模块定义了许多类，详见以下部分。

该模块的设计基于 Java 的线程模型。但是，在 Java 里面，锁和条件变量是每个对象的基础特性，而在 Python 里面，这些被独立成了单独的对象。 Python 的 `Thread` 类只是 Java 的 Thread 类的一个子集；目前还没有优先级，没有线程组，线程还不能被销毁、停止、暂停、恢复或中断。Java 的 Thread 类的静态方法在实现时会映射为模块级函数。

下述方法的执行都是原子性的。

### 线程局部数据

线程局部数据是指具有线程专属值的数据。如果你希望某些数据是线程局部数据，则创建一个 `local` 对象并使用其属性:

```python
>>> mydata = local()
>>> mydata.number = 42
>>> mydata.number
42
```

你也可以访问 `local` 对象的字典:

```python
>>> mydata.__dict__
{'number': 42}
>>> mydata.__dict__.setdefault('widgets', [])
[]
>>> mydata.widgets
[]
```

如果我们在另一个线程中访问此数据:

```python
>>> log = []
>>> def f():
...     items = sorted(mydata.__dict__.items())
...     log.append(items)
...     mydata.number = 11
...     log.append(mydata.number)

>>> import threading
>>> thread = threading.Thread(target=f)
>>> thread.start()
>>> thread.join()
>>> log
[[], 11]
```

我们将得到不同的数据。此外，在其他线程中进行的修改也不会影响在本线程中看到的数据:

```python
>>> mydata.number
42
```

当然，你从 `local` 对象获取的值，包括其 `__dict__` 属性，都只针对属性被读取时的当前线程。 出于此理由，通常你不会跨线程保存这些值，因为它们仅适用于它们所在的线程。

你可以通过子类化 `local` 类来创建自定义的 `local` 对象:

```python
>>> class MyLocal(local):
...     number = 2
...     def __init__(self, /, **kw):
...         self.__dict__.update(kw)
...     def squared(self):
...         return self.number **2
```

这适用于提供默认值、方法和初始化支持。请注意如果你定义了 `__init__()` 方法，则每当该 `local` 对象在不同线程中被使用时都将调用它。这对于初始化每个线程的字典是必要的。

现在如果我们创建一个 `local` 对象:

```python
>>> mydata = MyLocal(color='red')
```

我们将有一个默认的 number 值:

```python
>>> mydata.number
2
```

一个初始的 color 值:

```python
>>> mydata.color
'red'
>>> del mydata.color
```

以及一个操作数据的方法:

```python
>>> mydata.squared()
4
```

像之前一样，我们可以在不同的线程中访问该数据:

```python
>>> log = []
>>> thread = threading.Thread(target=f)
>>> thread.start()
>>> thread.join()
>>> log
[[('color', 'red')], 11]
```

而不会影响本线程的数据:

```python
>>> mydata.number
2
>>> mydata.color
Traceback (most recent call last):
...
AttributeError: 'MyLocal' object has no attribute 'color'
```

请注意子类可以定义 \_\_slots\_\_，但它们不是线程局部的。它们会被跨线程共享:

```python
>>> class MyLocal(local):
...     __slots__ = 'number'

>>> mydata = MyLocal()
>>> mydata.number = 42
>>> mydata.color = 'red'
```

因此，不同的线程:

```python
>>> thread = threading.Thread(target=f)
>>> thread.start()
>>> thread.join()
```

会影响我们的值:

```python
>>> mydata.number
11
```

**threading.local**

一个代表线程本地数据的类。

### 线程对象

`Thread` 类代表一个在独立控制线程中运行的活动。指定活动有两种方式：向构造器传递一个可调用对象，或在子类中重载 `run()` 方法。其他方法不应在子类中重载（除了构造器）。换句话说，_只能_ 重载这个类的 `__init__()` 和 `run()` 方法。

当线程对象一旦被创建，其活动必须通过调用线程的 `start()` 方法开始。这会在独立的控制线程中唤起 `run()` 方法。

一旦线程活动开始，该线程会被认为是 '存活的' 。当它的 `run()` 方法终结了（不管是正常的还是抛出未被处理的异常），就不是'存活的'。 `is_alive()` 方法用于检查线程是否存活。

其他线程可以调用一个线程的 `join()` 方法。这会阻塞调用该方法的线程，直到被调用 `join()` 方法的线程终结。

线程有名字。名字可以传递给构造函数，也可以通过 `name` 属性读取或者修改。

如果 `run()` 方法引发了异常，则会调用 `threading.excepthook()` 来处理它。 在默认情况下，`threading.excepthook()` 会静默地忽略 `SystemExit`。

一个线程可以被标记成一个“守护线程”。这个标识的意义是，当剩下的线程都是守护线程时，整个 Python 程序将会退出。初始值继承于创建线程。 这个标识可以通过 `daemon` 特征属性或者 _daemon_ 构造器参数来设置。

备注

守护线程在程序关闭时会突然关闭。他们的资源（例如已经打开的文档，数据库事务等等）可能没有被正确释放。如果你想你的线程正常停止，设置他们成为非守护模式并且使用合适的信号机制，例如： `Event`.

有个 "主线程" 对象；这对应 Python 程序里面初始的控制线程。它不是一个守护线程。

创建“虚拟线程对象”是有可能的。它们是与“外部线程”相对应 的线程对象，是在 threading 模块之外启动的控制线程，例如直接来自 C 代码。 虚拟线程对象的功能是受限的；它们总是会被视为处于激活和守护状态，且无法被 合并。 它们绝不会被删除，因为检测外部线程的终结是不可能做到的。

**threading.Thread(_group\=None_, _target\=None_, _name\=None_, _args\=()_, _kwargs\={}_, _\*_, _daemon\=None_, _context\=None_)**

应当始终使用关键字参数调用此构造函数。参数如下：

_group_ 必须为 `None`，它是保留给将来实现 `ThreadGroup` 类的扩展使用的。

_target_ 是用于 `run()` 方法调用的可调用对象。默认是 `None`，表示不需要调用任何方法。

_name_ 是线程名称。在默认情况下，会以 "Thread-_N_" 的形式构造唯一名称，其中 _N_ 为一个较小的十进制数值，或是 "Thread-_N_ (target)" 的形式，其中 "target" 为 `target.__name__`，如果指定了 _target_ 参数的话。

_args_ 是用于唤起目标函数的参数列表或元组。默认为 `()`。

_kwargs_ 是用于调用目标函数的关键字参数字典。默认是 `{}`。

如果不是 `None`，_daemon_ 参数将显式地设置该线程是否为守护模式。如果是 `None` (默认值)，线程将继承当前线程的守护模式属性。

_context_ 是 `Context` 值，以便在启动线程时使用。默认值是 `None`，表示 `sys.flags.thread_inherit_context` 标志控制行为。如果该标志为 true，线程将从 `start()` 调用程序的上下文副本开始。如果为 false，它们将从空上下文开始。要显式地从空上下文开始，传递 `Context()` 的新实例。要显式地从当前上下文的副本开始，请传递来自 `copy_context()` 的值。该标志在自由线程构建时默认为 true，否则为 false。

如果子类型重载了构造函数，它一定要确保在做任何事前，先唤起基类构造器 (`Thread.__init__()`)。

在 3.3 版本发生变更: 增加了 _daemon_ 形参。

在 3.10 版本发生变更: 使用 _target_ 名称，如果 _name_ 参数被省略的话。

在 3.14 版本发生变更: 增加了 _context_ 形参。

**start()**

开始线程活动。

它在一个线程里最多只能被调用一次。它安排对象的 `run()` 方法在一个独立的控制线程中被调用。

如果同一个线程对象中调用这个方法的次数大于一次，会抛出 `RuntimeError`。

如果支持，将操作系统线程名设置为 `threading.Thread.name`。该名称可以根据操作系统线程名称限制进行截断。

在 3.14 版本发生变更: 设置操作系统线程名称。

**run()**

代表线程活动的方法。

你可以在子类型里重载这个方法。标准的 `run()` 方法会对作为 _target_ 参数传递给该对象构造器的可调用对象（如果存在）被唤起，并附带从 _args_ 和 _kwargs_ 参数分别获取的位置和关键字参数。

使用列表或元组作为传给 `Thread` 的 _args_ 参数可以达成同样的效果。

示例：

```python
>>> from threading import Thread
>>> t = Thread(target=print, args=[1])
>>> t.run()
1
>>> t = Thread(target=print, args=(1,))
>>> t.run()
1
```

**join(_timeout\=None_)**

等待，直到线程终结。这会阻塞调用这个方法的线程，直到被调用 `join()` 的线程终结 -- 不管是正常终结还是抛出未处理异常 -- 或者直到发生超时，超时选项是可选的。

当 _timeout_ 参数存在而且不是 `None` 时，它应该是一个用于指定操作超时的以秒为单位的浮点数（或者分数）。因为 `join()` 总是返回 `None`，所以你一定要在 `join()` 后调用 `is_alive()` 才能判断是否发生超时 -- 如果线程仍然存活，则 `join()` 超时。

当 _timeout_ 参数不存在或者是 `None`，这个操作会阻塞直到线程终结。

一个线程可以被合并多次。

如果尝试加入当前线程会导致死锁， `join()` 会引起 `RuntimeError` 异常。如果尝试 `join()` 一个尚未开始的线程，也会抛出相同的异常。

如果在 Python 最终化 的后期阶段尝试加入正在运行的守护线程则 `join()` 会引发 `PythonFinalizationError`。

在 3.14 版本发生变更: 可能引发 `PythonFinalizationError`。

**name**

只用于识别的字符串。它没有语义。多个线程可以赋予相同的名称。初始名称由构造函数设置。

在某些平台上，线程名称在线程启动时在操作系统级别设置，以便在任务管理器中可见。该名称可以被截断以适应特定于系统的限制（例如，Linux 上是 15 字节或 macOS 上是 63 字节）。

对 _name_ 的更改仅在当前运行的线程被重命名时反映在操作系统级别。（设置不同线程的 _name_ 属性只会更新 Python 线程对象。）

**getName()**

**setName()**

已被弃用的 `name` 的取值/设值 API；请改为直接以特征属性方式使用它。

自 3.10 版本弃用.

**ident**

这个线程的 '线程标识符'，如果线程尚未开始则为 `None`。这是个非零整数。参见 `get_ident()` 函数。当一个线程退出而另外一个线程被创建，线程标识符会被复用。即使线程退出后，仍可得到标识符。

**native\_id**

此线程的线程 ID (`TID`)，由 OS (内核) 分配。这是一个非负整数，或者如果线程还未启动则为 `None`。请参阅 `get_native_id()` 函数。这个值可被用来在全系统范围内唯一地标识这个特定线程 (直到线程终结，在那之后该值可能会被 OS 回收再利用)。

备注

类似于进程 ID，线程 ID 的有效期（全系统范围内保证唯一）将从线程被创建开始直到线程被终结。

适用范围: Windows, FreeBSD, Linux, macOS, OpenBSD, NetBSD, AIX, DragonFlyBSD.

版本 3.8 中新增。

**is\_alive()**

返回线程是否存活。

当 `run()` 方法刚开始直到 `run()` 方法刚结束，这个方法返回 `True` 。模块函数 `enumerate()` 返回包含所有存活线程的列表。

**daemon**

一个布尔值，表示这个线程是否属于守护线程 (`True`) 或不属于 (`False`)。 这个值必须在调用 `start()` 之前设置，否则会引发 `RuntimeError`。 它的初始值继承自创建线程；主线程不是一个守护线程，因此所有在主线程中创建的线程默认为 `daemon` = `False`。

当没有存活的非守护线程时，整个 Python 程序才会退出。

**isDaemon()**

**setDaemon()**

已被弃用的 `daemon` 的取值/设值 API；请改为直接以特征属性方式使用它。

自 3.10 版本弃用.

### Lock 对象

原始锁是一个在锁定时不属于特定线程的同步基元组件。在 Python 中，它是能用的最低级的同步基元组件，由 `_thread` 扩展模块直接实现。

原始锁处于 "锁定" 或者 "非锁定" 两种状态之一。它被创建时为非锁定状态。它有两个基本方法， `acquire()` 和 `release()`。当状态为非锁定时， `acquire()` 将状态改为 锁定 并立即返回。当状态是锁定时， `acquire()` 将阻塞至其他线程调用 `release()` 将其改为非锁定状态，然后 `acquire()` 调用重置其为锁定状态并返回。 `release()` 只在锁定状态下调用；它将状态改为非锁定并立即返回。如果尝试释放一个非锁定的锁，则会引发 `RuntimeError`  异常。

锁同样支持 上下文管理协议。

当多个线程在 `acquire()` 等待状态转变为未锁定被阻塞，然后 `release()` 重置状态为未锁定时，只有一个线程能继续执行；至于哪个等待线程继续执行没有定义，并且会根据实现而不同。

所有方法的执行都是原子性的。

**threading.Lock**

实现原始锁对象的类。一旦一个线程获得一个锁，会阻塞随后尝试获得锁的线程，直到它被释放；任何线程都可以释放它。

在 3.13 版本发生变更: 现在 `Lock` 是一个类。在更早的 Python 版本中，`Lock` 是一个返回下层私有锁类型的实例的工厂函数。

**acquire(_blocking\=True_, _timeout\=\-1_)**

可以阻塞或非阻塞地获得锁。

当调用时参数 _blocking_ 设置为 `True` (缺省值)，阻塞直到锁被释放，然后将锁锁定并返回 `True`。

在参数 _blocking_ 被设置为 `False` 的情况下调用，将不会发生阻塞。如果调用时 _blocking_ 设为 `True` 会阻塞，并立即返回 `False`；否则，将锁锁定并返回 `True`。

当参数 _timeout_ 使用设置为正值的浮点数调用时，最多阻塞 _timeout_ 指定的秒数，在此期间锁不能被获取。设置 _timeout_ 参数为 `-1` 表示无限期等待。当 _blocking_ 为 `False` 时不允许指定 _timeout_。

如果成功获得锁，则返回 `True`，否则返回 `False` (例如发生 _超时_ 的时候)。

在 3.2 版本发生变更: 新的 _timeout_ 形参。

在 3.2 版本发生变更: 现在如果底层线程实现支持，则可以通过 POSIX 上的信号中断锁的获取。

在 3.14 版本发生变更: 在 Windows 上现在可以通过信号来中断锁的获取。

**release()**

释放一个锁。这个方法可以在任何线程中调用，不单指获得锁的线程。

当锁被锁定，将它重置为未锁定，并返回。如果其他线程正在等待这个锁解锁而被阻塞，只允许其中一个继续。

当在未锁定的锁上唤起时，会引发 `RuntimeError`。

没有返回值。

**locked()**

当锁被获取时，返回 `True`。

### RLock 对象

重入锁是一个可以被同一个线程多次获取的同步基元组件。在内部，它在基元锁的锁定/非锁定状态上附加了 "所属线程" 和 "递归等级" 的概念。在锁定状态下，某些线程拥有锁；在非锁定状态下，没有线程拥有它。

线程调用锁的 `acquire()` 方法来锁定它，并调用 `release()` 方法来解锁。

备注

重入型锁支持 上下文管理协议，因此推荐使用 `with` 而不是手动调用 `acquire()` 和 `release()` 来针对一个代码块处理锁的获取和释放。

RLock 的 `acquire()`/`release()` 调用对可以嵌套，这不同于 Lock 的 `acquire()`/`release()`。只有最终的 `release()` (最外面一对的 `release()`) 会将锁重置为已解锁状态并允许在 `acquire()` 中被阻塞的其他线程继续执行。

`acquire()`/`release()` 必须成对使用：每个 acquire 必须在获取锁的线程中有对应的 release。如果锁调用 release 的次数未能与 acquire 的次数一致则会导致死锁。

**threading.RLock**

此类实现了重入锁对象。重入锁必须由获取它的线程释放。一旦线程获得了重入锁，同一个线程再次获取它将不阻塞；线程必须在每次获取它时释放一次。

需要注意的是 `RLock` 其实是一个工厂函数，返回平台支持的具体递归锁类中最有效的版本的实例。

**acquire(_blocking\=True_, _timeout\=\-1_)**

可以阻塞或非阻塞地获得锁。

参见

**将 RLock 用作上下文管理器**

在大多数场合下相比手动的 `acquire()` 和 `release()` 调用更为推荐。

当被唤起时将 _blocking_ 参数设为 `True` (默认值):

> -   如无任何线程持有锁，则获取锁并立即返回。
>
> -   如有其他线程持有锁，则阻塞执行直至能够获取锁，或直至 _timeout_，如果将其设为一个正浮点数值的话。
>
> -   如同一线程持有锁，则再次获取该锁，并立即返回。这是 `Lock` 和 `RLock` 之间的区别；`Lock` 将以与之前相同的方式处理此情况，即阻塞执行直至能够获取锁。
>

当被唤起时将 _blocking_ 参数设为 `False`:

> -   如无任何线程持有锁，则获取锁并立即返回。
>
> -   如有其他线程持有锁，则立即返回。
>
> -   如同一线程持有锁，则再次获取该锁并立即返回。
>

在所有情况下，如果线程能够获取锁，则返回 `True`。如果线程不能获取锁（即未阻塞执行或达到超时限制）则返回 `False`。

如果被多次调用，则未能调用相同次数的 `release()` 可能导致死锁。请考虑将 `RLock` 用作上下文管理器而不是直接调用 acquire/release。

在 3.2 版本发生变更: 新的 _timeout_ 形参。

**release()**

释放锁，自减递归等级。如果减到零，则将锁重置为非锁定状态 (不被任何线程拥有)，并且，如果其他线程正被阻塞着等待锁被解锁，则仅允许其中一个线程继续。如果自减后，递归等级仍然不是零，则锁保持锁定，仍由调用线程拥有。

只有在调用方线程持有锁时才能调用此方法。如果在未获取锁的情况下调用此方法则会引发 `RuntimeError`。

没有返回值。

**locked()**

返回一个指明该对象目前是否被锁定的布尔值。

版本 3.14 中新增。

### Condition 对象

条件变量总是与某种类型的锁对象相关联，锁对象可以通过传入获得，或者在缺省的情况下自动创建。当多个条件变量需要共享同一个锁时，传入一个锁很有用。锁是条件对象的一部分，你不必单独地跟踪它。

条件变量遵循 上下文管理协议：使用 `with` 语句会在它包围的代码块内获取关联的锁。 `acquire()` 和 `release()` 方法也能调用关联锁的相关方法。

其它方法必须在持有关联的锁的情况下调用。 `wait()` 方法释放锁，然后阻塞直到其它线程调用 `notify()` 方法或 `notify_all()` 方法唤醒它。一旦被唤醒， `wait()` 方法重新获取锁并返回。它也可以指定超时时间。

如果有线程正在等待条件变量，`notify()` 方法会唤醒其中之一；`notify_all()` 方法则会唤醒所有正在等待该条件变量的线程。

注意： `notify()` 方法和 `notify_all()` 方法并不会释放锁，这意味着被唤醒的线程不会立即从它们的 `wait()` 方法调用中返回，而是会在调用了 `notify()` 方法或 `notify_all()` 方法的线程最终放弃了锁的所有权后返回。

使用条件变量的典型编程风格是将锁用于同步某些共享状态的权限，那些对状态的某些特定改变感兴趣的线程，它们重复调用 `wait()` 方法，直到看到所期望的改变发生；而对于修改状态的线程，它们将当前状态改变为可能是等待者所期待的新状态后，调用 `notify()` 方法或者 `notify_all()` 方法。例如，下面的代码是一个通用的无限缓冲区容量的生产者 - 消费者情形：

```python
# 消费一个条目
with cv:
    while not an_item_is_available():
        cv.wait()
    get_an_available_item()

# 生产一个条目
with cv:
    make_an_item_available()
    cv.notify()
```

使用 `while` 循环检查所要求的条件成立与否是有必要的，因为 `wait()` 方法可能要经过不确定长度的时间后才会返回，而此时导致 `notify()` 方法调用的那个条件可能已经不再成立。这是多线程编程所固有的问题。 `wait_for()` 方法可自动化条件检查，并简化超时计算。

```python
# 消费一个条目
with cv:
    cv.wait_for(an_item_is_available)
    get_an_available_item()
```

选择 `notify()` 还是 `notify_all()` ，取决于一次状态改变是只能被一个还是能被多个等待线程所用。例如在一个典型的生产者 - 消费者情形中，添加一个项目到缓冲区只需唤醒一个消费者线程。

**threading.Condition(_lock\=None_)**

实现条件变量对象的类。一个条件变量对象允许一个或多个线程在被其它线程所通知之前进行等待。

如果给出了非 `None` 的 _lock_ 参数，则它必须为 `Lock` 或者 `RLock` 对象，并且它将被用作底层锁。否则，将会创建新的 `RLock` 对象，并将其用作底层锁。

在 3.3 版本发生变更: 从工厂函数变为类。

**acquire(_\*args_)**

请求底层锁。此方法调用底层锁的相应方法，返回值是底层锁相应方法的返回值。

**release()**

释放底层锁。此方法调用底层锁的相应方法。没有返回值。

**locked()**

返回一个指明该对象目前是否被锁定的布尔值。

版本 3.14 中新增。

**wait(_timeout\=None_)**

等待直到被通知或发生超时。如果线程在调用此方法时没有获得锁，将会引发 `RuntimeError` 异常。

这个方法释放底层锁，然后阻塞，直到在另外一个线程中调用同一个条件变量的 `notify()` 或 `notify_all()` 唤醒它，或者直到可选的超时发生。一旦被唤醒或者超时，它重新获得锁并返回。

当提供了 _timeout_ 参数且不是 `None` 时，它应该是一个浮点数，代表操作的超时时间，以秒为单位（可以为小数）。

当底层锁是个 `RLock`，不会使用它的 `release()` 方法释放锁，因为当它被递归多次获取时，实际上可能无法解锁。相反，使用了 `RLock` 类的内部接口，即使多次递归获取它也能解锁它。 然后，在重新获取锁时，使用另一个内部接口来恢复递归级别。

返回 `True`，除非提供的 _timeout_ 过期，这种情况下返回 `False`。

在 3.2 版本发生变更: 在此之前，方法总是返回 `None`。

**wait\_for(_predicate_, _timeout\=None_)**

等待，直到条件计算为真。 _predicate_ 应该是一个可调用对象而且它的返回值可被解释为一个布尔值。可以提供 _timeout_ 参数给出最大等待时间。

这个实用方法会重复地调用 `wait()` 直到满足判断式或者发生超时。返回值是判断式最后一个返回值，而且如果方法发生超时会返回 `False` .

忽略超时功能，调用此方法大致相当于编写:

```python
while not predicate():
    cv.wait()
```

因此，规则同样适用于 `wait()`：锁必须在被调用时保持获取，并在返回时重新获取。随着锁定执行判断式。

版本 3.2 中新增。

**notify(_n\=1_)**

默认唤醒一个等待这个条件的线程。如果调用线程在没有获得锁的情况下调用这个方法，会引发 `RuntimeError` 异常。

这个方法唤醒最多 _n_ 个正在等待这个条件变量的线程；如果没有线程在等待，这是一个空操作。

当前实现中，如果至少有 _n_ 个线程正在等待，准确唤醒 _n_ 个线程。但是依赖这个行为并不安全。未来，优化的实现有时会唤醒超过 _n_ 个线程。

注意：被唤醒的线程并没有真正恢复到它调用的 `wait()`，直到它可以重新获得锁。因为 `notify()` 不释放锁，其调用者才应该这样做。

**notify\_all()**

唤醒所有正在等待这个条件的线程。这个方法行为与 `notify()` 相似，但并不只唤醒单一线程，而是唤醒所有等待线程。如果调用线程在调用这个方法时没有获得锁，会引发 `RuntimeError` 异常。

`notifyAll` 方法是此方法的已弃用别名。

### Semaphore 对象

这是计算机科学史上最古老的同步原语之一，早期的荷兰科学家 Edsger W. Dijkstra 发明了它。 (他使用名称 `P()` 和 `V()` 而不是 `acquire()` 和 `release()`)。

一个信号量管理一个内部计数器，该计数器因 `acquire()` 方法的调用而递减，因 `release()` 方法的调用而递增。计数器的值永远不会小于零；当 `acquire()` 方法发现计数器为零时，将会阻塞，直到其它线程调用 `release()` 方法。

信号量对象也支持 上下文管理协议。

**threading.Semaphore(_value\=1_)**

该类实现信号量对象。信号量对象管理一个原子性的计数器，代表 `release()` 方法的调用次数减去 `acquire()` 的调用次数再加上一个初始值。如果需要， `acquire()` 方法将会阻塞直到可以返回而不会使得计数器变成负数。在没有显式给出 _value_ 的值时，默认为 1。

可选参数 _value_ 赋予内部计数器初始值，默认值为 `1`。如果 _value_ 被赋予小于 0 的值，将会引发 `ValueError` 异常。

在 3.3 版本发生变更: 从工厂函数变为类。

**acquire(_blocking\=True_, _timeout\=None_)**

获取一个信号量。

在不带参数的情况下调用时：

-   如果在进入时内部计数器的值大于零，则将其减一并立即返回 `True`。

-   如果在进入时内部计数器的值为零，则将会阻塞直到被对 `release()` 的调用唤醒。一旦被唤醒（并且计数器的值大于 0），则将计数器减 1 并返回 `True`。每次对 `release()` 的调用将只唤醒一个线程。 线程被唤醒的次序是不可确定的。


当 _blocking_ 设置为 `False` 时调用，不会阻塞。如果没有参数的调用会阻塞，立即返回 `False`；否则，做与无参数调用相同的事情时返回 `True`。

当被唤起时如果 _timeout_ 不为 `None`，则它将阻塞最多 _timeout_ 秒。请求在此时段时未能成功完成获取则将返回 `False`。在其他情况下返回 `True`。

在 3.2 版本发生变更: 新的 _timeout_ 形参。

**release(_n\=1_)**

释放一个信号量，将内部计数器的值增加 _n_。当进入时值为零且有其他线程正在等待它再次变为大于零时，则唤醒那 _n_ 个线程。

在 3.9 版本发生变更: 增加了 _n_ 形参以一次性释放多个等待线程。

**threading.BoundedSemaphore(_value\=1_)**

该类实现有界信号量。有界信号量通过检查以确保它当前的值不会超过初始值。如果超过了初始值，将会引发 `ValueError` 异常。在大多情况下，信号量用于保护数量有限的资源。如果信号量被释放的次数过多，则表明出现了错误。没有指定时， _value_ 的值默认为 1。

在 3.3 版本发生变更: 从工厂函数变为类。

### `Semaphore` 示例

信号量通常用于保护数量有限的资源，例如数据库服务器。在资源数量固定的任何情况下，都应该使用有界信号量。在生成任何工作线程前，应该在主线程中初始化信号量。

```python
maxconnections = 5
# ...
pool_sema = BoundedSemaphore(value=maxconnections)
```

工作线程生成后，当需要连接服务器时，这些线程将调用信号量的 acquire 和 release 方法：

```python
with pool_sema:
    conn = connectdb()
    try:
        # ... 使用连接 ...
    finally:
        conn.close()
```

使用有界信号量能减少这种编程错误：信号量的释放次数多于其请求次数。

### Event 对象

这是线程之间通信的最简单机制之一：一个线程发出事件信号，而其他线程等待该信号。

一个事件对象管理一个内部标识，调用 `set()` 方法可将其设置为 true，调用 `clear()` 方法可将其设置为 false，调用 `wait()` 方法将进入阻塞直到标识为 true。

**threading.Event**

实现事件对象的类。事件对象管理一个内部标识，调用 `set()` 方法可将其设置为 true。调用 `clear()` 方法可将其设置为 false。调用 `wait()` 方法将进入阻塞直到标识为 true。这个标识初始时为 false。

在 3.3 版本发生变更: 从工厂函数变为类。

**is\_set()**

当且仅当内部标识为 true 时返回 `True`。

`isSet` 方法是此方法的已弃用别名。

**set()**

将内部标识设置为 true。所有正在等待这个事件的线程将被唤醒。当标识为 true 时，调用 `wait()` 方法的线程不会被阻塞。

**clear()**

将内部标识设置为 false。之后调用 `wait()` 方法的线程将会被阻塞，直到调用 `set()` 方法将内部标识再次设置为 true .

**wait(_timeout\=None_)**

只要内部旗标为假值且未超出所给出的 timeout 值就保持阻塞。返回值表示阻塞方法返回的原因；如果返回是因为内部旗标被设为真值则为 `True`，或者如果给出了 timeout 值而内部旗标在给定的等待时间内没有变成真值则为 `False`。

当提供了 timeout 参数且不为 `None` 时，它应当为一个指定操作的超时限制秒数的浮点值，也可以为分数。

在 3.1 版本发生变更: 在此之前，方法总是返回 `None`。

### Timer 对象

此类表示一个操作应该在等待一定的时间之后运行 --- 相当于一个定时器。 `Timer` 类是 `Thread` 类的子类，因此可以像一个自定义线程一样工作。

与线程一样，定时器也是通过调用其 `Timer.start` 方法来启动的。定时器可以通过调用 `cancel()` 方法来停止（在其动作开始之前）。定时器在执行其行动之前要等待的时间间隔可能与用户指定的时间间隔不完全相同。

例如：

```python
def hello():
    print("hello, world")

t = Timer(30.0, hello)
t.start()  # 30 秒之后，将打印 "hello, world"
```

**threading.Timer(_interval_, _function_, _args\=None_, _kwargs\=None_)**

创建一个定时器，在经过 _interval_ 秒的间隔事件后，将会用参数 _args_ 和关键字参数 _kwargs_ 调用 _function_。 如果 _args_ 为 `None` (默认值)，则会使用一个空列表。 如果 _kwargs_ 为 `None` (默认值)，则会使用一个空字典。

在 3.3 版本发生变更: 从工厂函数变为类。

**cancel()**

停止定时器并取消执行计时器将要执行的操作。仅当计时器仍处于等待状态时有效。

### Barrier 对象

版本 3.2 中新增。

栅栏类提供一个简单的同步原语，用于应对固定数量的线程需要彼此相互等待的情况。线程调用 `wait()` 方法后将阻塞，直到所有线程都调用了 `wait()` 方法。此时所有线程将被同时释放。

栅栏对象可以被多次使用，但线程的数量不能改变。

这是一个使用简便的方法实现客户端线程与服务端线程同步的例子：

```python
b = Barrier(2, timeout=5)

def server():
    start_server()
    b.wait()
    while True:
        connection = accept_connection()
        process_server_connection(connection)

def client():
    b.wait()
    while True:
        connection = make_connection()
        process_client_connection(connection)
```

**threading.Barrier(_parties_, _action\=None_, _timeout\=None_)**

创建一个需要 _parties_ 个线程的栅栏对象。如果提供了可调用的 _action_ 参数，它会在所有线程被释放时在其中一个线程中自动调用。 _timeout_ 是默认的超时时间，如果没有在 `wait()` 方法中指定超时时间的话。

**wait(_timeout\=None_)**

冲出栅栏。当栅栏中所有线程都已经调用了这个函数，它们将同时被释放。如果提供了 _timeout_ 参数，这里的 _timeout_ 参数优先于创建栅栏对象时提供的 _timeout_ 参数。

函数返回值是一个整数，取值范围在 0 到 _parties_ -- 1，在每个线程中的返回值不相同。可用于从所有线程中选择唯一的一个线程执行一些特别的工作。例如：

```python
i = barrier.wait()
if i == 0:
    # 只有一个线程需要打印此文本
    print("passed the barrier")
```

如果创建栅栏对象时在构造函数中提供了 _action_ 参数，它将在其中一个线程释放前被调用。如果此调用引发了异常，栅栏对象将进入损坏态。

如果发生了超时，栅栏对象将进入破损态。

如果栅栏对象进入破损态，或重置栅栏时仍有线程等待释放，将会引发 `BrokenBarrierError` 异常。

**reset()**

重置栅栏为默认的初始态。如果栅栏中仍有线程等待释放，这些线程将会收到 `BrokenBarrierError` 异常。

请注意使用此函数时，如果存在状态未知的其他线程，则可能需要执行外部同步。如果栅栏已损坏则最好将其废弃并新建一个。

**abort()**

使栅栏处于损坏状态。这将导致任何现有和未来对 `wait()` 的调用失败并引发 `BrokenBarrierError`。 例如可以在需要中止某个线程时使用此方法，以避免应用程序的死锁。

更好的方式是：创建栅栏时提供一个合理的超时时间，来自动避免某个线程出错。

**parties**

冲出栅栏所需要的线程数量。

**n\_waiting**

当前时刻正在栅栏中阻塞的线程数量。

**broken**

一个布尔值，值为 `True` 表明栅栏为破损态。

**threading.BrokenBarrierError**

异常类，是 `RuntimeError` 异常的子类，在 `Barrier` 对象重置时仍有线程阻塞时和对象进入破损态时被引发。

## 在 `with` 语句中使用锁、条件和信号量

本模块提供的所有具有 `acquire` 和 `release` 方法的对象都可用作 `with` 语句的上下文管理器。 进入语句块时将调用 `acquire` 方法，退出语句块时将调用 `release` 方法。因此，下面的代码段:

```python
with some_lock:
    # 执行某种操作...
```

相当于:

```python
some_lock.acquire()
try:
    # 执行某种操作...
finally:
    some_lock.release()
```

现在 `Lock`、 `RLock`、 `Condition`、 `Semaphore` 和 `BoundedSemaphore` 对象可以用作 `with` 语句的上下文管理器。

---

> **来源**：本文由 Python 官方文档两部分组成并完整翻译：① [concurrent.futures —— 启动并行任务](https://docs.python.org/zh-cn/3/library/concurrent.futures.html)；② [threading —— 基于线程的并行](https://docs.python.org/zh-cn/3/library/threading.html)。作者 Python 软件基金会（PSF），许可 PSF 许可证第 2 版。抓取于 2026-09-13（Python 3.14 官方文档）。
