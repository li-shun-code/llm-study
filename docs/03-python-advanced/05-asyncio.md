---
title: asyncio 异步编程
source_url: https://docs.python.org/zh-cn/3/howto/a-conceptual-overview-of-asyncio.html
author: Alexander Nordin（Python 官方文档团队）
license: PSF 许可证第 2 版（GPL 兼容）
fetched_at: 2026-09-13
translated: false
order: 5
versions: Python 3.14 / asyncio
---
## asyncio 是什么

`asyncio` 是用来编写**并发**代码的库，使用 **async/await** 语法。它被用作多个 Python 异步框架的基础，这些框架提供高性能网络和网站服务、数据库连接库、分布式任务队列等等。asyncio 往往是构建 IO 密集型和高层级**结构化**网络代码的最佳选择。

上一篇我们说过：I/O 密集任务可以用线程池并发。但当并发量成百上千时（例如流式代理上千个用户的请求），线程的内存与调度开销会成为瓶颈。asyncio 用**单线程 + 事件循环**解决问题：等待 I/O 时挂起当前任务、切换去跑别的任务——切换发生在你写出来的 `await` 处，可控、可调试。

## 概念概述第 1 部分：高层次

这部分介绍主要的、高层级的 `asyncio` 构成部分：事件循环、协程函数、协程对象、任务和 `await`。

### 事件循环

`asyncio` 中的一切都与事件循环相关。它是演出的主角。它就像一名乐队指挥一样在幕后管理资源。

用更专业的术语来说，事件循环包含一组待运行的作业。有些作业是由你直接添加的，有些则是由 `asyncio` 间接添加的。事件循环会从其待处理事项中取出一个作业并唤起它（或称"给予其控制权"），然后该作业就会运行。一旦它暂停或完成，它会将控制权返回给事件循环。然后事件循环会从作业池中选择另一个作业并唤起它。此过程将无限地重复，事件循环也不停地循环下去。如果没有待执行的作业，事件循环会足够智能地转入休息状态以避免浪费 CPU 周期，并在有更多工作需完成时恢复运行。

有效的执行依赖于作业的良好共享和合作；一个贪婪的作业可能会霸占控制权，让其他作业陷入饥饿，从而使整个事件循环机制变得毫无用处。

### 异步函数和协程

这是一个基本的、无趣的 Python 函数：

```python
def hello_printer():
    print("Hi, I am a lowly, simple printer.")
```

调用一个普通函数会执行它的逻辑或函数体。

与普通的 `def` 不同，`async def` 使它成为一个异步函数（或"协程函数"）。调用它会创建并返回一个**协程对象**：

```python
async def loudmouth_penguin(magic_number: int):
    print(f"... my lucky number is: {magic_number}.")

>>> loudmouth_penguin(magic_number=3)
<coroutine object loudmouth_penguin at 0x104ed2740>
```

注意：调用协程函数**不会执行**函数体，只创建协程对象。"协程函数"和"协程对象"经常被混称为"协程"，阅读文档时要区分。

协程代表函数体或逻辑。协程必须显式启动；仅仅创建协程并不能启动它。值得注意的是，协程可以在函数体的不同位置**暂停和恢复**。这种暂停和恢复能力使得异步行为成为可能！

协程和协程函数是利用生成器和生成器函数构建的（生成器见本模块第 2 篇）。与协程函数类似，调用生成器函数并不会运行该函数，而是创建一个生成器对象，再用 `next()` 驱动它运行到下一个 `yield`。

### 任务

粗略地说，**任务（Task）**是绑定到事件循环的协程（而非协程函数）。推荐使用 `asyncio.create_task()` 创建任务——创建任务会自动安排它的执行。

实际上，推荐（且常见）的做法是使用 `asyncio.run()`，它负责管理事件循环并确保提供的协程在继续执行之前结束。许多异步程序都遵循以下设置：

```python
import asyncio

async def main():
    # 执行各种异步操作……
    ...

if __name__ == "__main__":
    asyncio.run(main())
    # 直到协程 main() 结束，程序才会继续往下走。
```

**重要的坑**：事件循环将只保留对任务的**弱引用**。未在其他地方被引用的任务可能在任何时候被作为垃圾回收，即使是在它被完成之前。保存一个指向任务结果的引用，以避免任务在执行过程中消失：

```python
background_tasks = set()

for i in range(10):
    task = asyncio.create_task(some_coro(param=i))

    # 将任务加入集合。这将创建一个强引用。
    background_tasks.add(task)

    # 为避免永远保留对已结束任务的引用，
    # 让每个任务在完成后将对自己的引用移出集合：
    task.add_done_callback(background_tasks.discard)
```

### await

`await` 是一个 Python 关键字，通常以两种不同的方式使用：

```python
await task
await coroutine
```

从关键方面来说，`await` 的行为取决于所等待对象的类型。

**等待任务会将控制权交还给事件循环。**例如：

```python
async def plant_a_tree():
    dig_the_hole_task = asyncio.create_task(dig_the_hole())
    await dig_the_hole_task

    # 与植树相关的其他指令。
    ...
```

`await dig_the_hole_task` 这条指令会将一个回调函数（用于恢复 `plant_a_tree()` 的执行）添加到 `dig_the_hole_task` 对象的回调函数列表中，随后将控制权交还给事件循环。一般来说，当等待的任务完成时，原先的任务或协程将被添加回事件循环的待办列表以便恢复运行。

**与任务不同，等待协程并不会将控制权交还给事件循环！**`await coroutine` 的行为实际上与调用常规的同步 Python 函数相同。考虑以下程序：

```python
import asyncio

async def coro_a():
   print("I am coro_a(). Hi!")

async def coro_b():
   print("I am coro_b(). I sure hope no one hogs the event loop...")

async def main():
   task_b = asyncio.create_task(coro_b())
   num_repeats = 3
   for _ in range(num_repeats):
      await coro_a()
   await task_b

asyncio.run(main())
```

输出是三次 `coro_a()` 之后才出现 `coro_b()`——因为循环里控制权从未交还事件循环，`task_b` 一直没机会运行：

```
I am coro_a(). Hi!
I am coro_a(). Hi!
I am coro_a(). Hi!
I am coro_b(). I sure hope no one hogs the event loop...
```

如果将 `await coro_a()` 改为 `await asyncio.create_task(coro_a())`，行为就会发生变化：每次等待都会交还控制权，事件循环得以穿插调度其他任务。这个例子强调了：仅使用 `await coroutine` 可能会无意中霸占控制权并**在实际上阻塞事件循环**。`asyncio.run()` 可以通过 `debug=True` 旗标启用调试模式来检测这种情况，它还会记录任何独占执行时间 100 毫秒以上的协程。

### Future

Future 是一个用来表示计算**状态和结果**的对象。其一是它的状态，可以是"待处理""已取消"或"已完成"；其二是它的结果，当状态转换为已完成时它就会被设定。与协程不同，Future 并不代表要执行的实际计算；相反，它代表该计算的状态和结果。

`asyncio.Task` 继承了 `asyncio.Future` 类。通常没有必要在应用层级的代码中创建 Future 对象；它们更多由库和某些 asyncio API 暴露给用户。可等待对象因此有三种主要类型：**协程、任务和 Future**。

## 概念概述第 2 部分：核心细节（编者摘要）

`asyncio` 利用四个组件传递控制权，其中最核心的是：`await` 会调用给定对象的 `__await__()` 方法；该方法中的 `yield` 像（上一篇）生成器的 `yield` 一样暂停执行，并且 `await` 会把接收到的任何 `yield` 沿调用链向上传播，最终到达事件循环——事件循环用 `coroutine.send(...)` 恢复协程。协程完成时引发 `StopIteration` 异常并把返回值附在 `e.value` 中。

也就是说：**协程 = 能在任意 `await` 处暂停恢复的生成器**，事件循环 = 一个不断 `send()` 驱动所有任务的大循环。想要自己动手复现 `asyncio.sleep` 的官方示例（用 Future + 一个监视任务实现），请阅读原文。

## 实用 API（节选自官方《协程与任务》参考页）

> **来源**：以下小节转载自 [协程与任务 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/library/asyncio-task.html)，作者 Python 软件基金会，许可 PSF 许可证第 2 版。

### 运行一个协程

通过 async/await 语法声明协程是编写 asyncio 应用的推荐方式：

```python
>>> import asyncio

>>> async def main():
...     print('hello')
...     await asyncio.sleep(1)
...     print('world')

>>> asyncio.run(main())
hello
world
```

注意：简单地调用一个协程并不会使其被调度执行——`main()` 只会返回协程对象并触发 `RuntimeWarning`。要实际运行协程，用 `asyncio.run()`、`await` 或 `create_task()`。

### 并发运行任务：gather 与 TaskGroup

`asyncio.gather(*aws, return_exceptions=False)` **并发**运行可等待对象序列。如果所有可等待对象都成功完成，结果将是一个由所有返回值聚合而成的列表，**结果值的顺序与传入顺序一致**：

```python
import asyncio

async def factorial(name, number):
    f = 1
    for i in range(2, number + 1):
        print(f"Task {name}: Compute factorial({number}), currently i={i}...")
        await asyncio.sleep(1)
        f *= i
    print(f"Task {name}: factorial({number}) = {f}")
    return f

async def main():
    # *并发地* 调度这三次调用：
    L = await asyncio.gather(
        factorial("A", 2),
        factorial("B", 3),
        factorial("C", 4),
    )
    print(L)

asyncio.run(main())
# [2, 6, 24]
```

3.11 起官方更推荐**任务组（TaskGroup）**——针对嵌套子任务的调度提供比 gather 更强的安全保证：如果一个任务引发了异常，TaskGroup 将**取消剩余的已排期任务**（gather 默认不会），并在退出时以 `ExceptionGroup` 形式聚合所有异常：

```python
async def main():
    async with asyncio.TaskGroup() as tg:
        task1 = tg.create_task(some_coro(...))
        task2 = tg.create_task(another_coro(...))
    print(f"Both tasks have completed now: {task1.result()}, {task2.result()}")
```

### 休眠

`await asyncio.sleep(delay)` 阻塞 *delay* 指定的秒数，且**总是会挂起当前任务，以允许其他任务运行**——它与 `time.sleep()`（阻塞整个线程）的本质区别就在这里。将 delay 设为 0 将提供一个经优化的路径以允许其他任务运行，可供长期间运行的函数使用以避免阻塞事件循环。

### 超时

`asyncio.timeout(delay)`（3.11+）返回一个限制操作耗时时间的异步上下文管理器：

```python
async def main():
    async with asyncio.timeout(10):
        await long_running_task()
```

如果 `long_running_task` 耗费 10 秒以上完成，该上下文管理器将取消当前任务并处理所引发的 `CancelledError`，将其转化为可被捕获和处理的 `TimeoutError`。对 LLM API 调用加超时，就该这么写（结合 `httpx.AsyncClient` 见本模块第 9 篇）。

### 任务取消

任务可以便捷和安全地取消。当任务被取消时，`asyncio.CancelledError` 将在遇到机会时在任务中被引发。推荐协程使用 `try/finally` 代码块来可靠地执行清理逻辑。`asyncio.CancelledError` 会直接子类化 `BaseException`，因此大多数代码都不需要关心这一点。

## 小结

- `async def` 定义协程函数；调用产生协程对象，不会运行；
- `asyncio.run(main())` 是程序入口；`await` 驱动执行；
- `await coroutine` 不让出控制权，`await task` 让出——想让出就先 `create_task()`；
- 并发一批协程用 `asyncio.gather()`（老牌）或 `asyncio.TaskGroup`（3.11+，更安全）；
- 睡眠用 `asyncio.sleep`，超时用 `asyncio.timeout`，阻塞调用考虑丢进线程池（`loop.run_in_executor`）；
- 单线程事件循环最怕被同步阻塞代码卡住——`requests`、`time.sleep` 这类阻塞调用混进协程会拖垮整个循环，请改用异步库（如 httpx 的异步客户端）。

---

> **来源**：本文转载自 [asyncio 的概念概述 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/howto/a-conceptual-overview-of-asyncio.html)，作者 Alexander Nordin（Python 官方文档团队），许可 PSF 许可证第 2 版。抓取于 2026-09-13。

---

> 编者注：本篇主体为官方《asyncio 的概念概述》HOWTO（讲"为什么"），并节选了官方《协程与任务》参考页（https://docs.python.org/zh-cn/3/library/asyncio-task.html ，讲"怎么用"）中的实用 API 部分，文内分别署名。LLM 应用是典型的 I/O 密集场景（等 API 响应、等数据库），asyncio 是把并发等待做省资源的标准答案；FastAPI 原生基于 asyncio。
