---
title: asyncio 并发限流与重试范式
source_url: https://docs.python.org/3/library/asyncio-task.html
author: Python 官方文档团队（asyncio）与 etix / Julian Taylor 等（tenacity）
license: PSF 许可证第 2 版（asyncio）；Apache License 2.0（tenacity）
fetched_at: 2026-09-19
translated: true
versions: Python 3.11+（TaskGroup / asyncio.timeout）；tenacity 9.x
order: 10
group: 并发与异步
---
## 为什么需要：批量调用不是一句 `gather` 能收工的

《asyncio 异步编程》讲清了事件循环、任务与 `await` 的机制，《并发编程：concurrent.futures 与 threading》给了线程池的选型。但当你真的拿它们去跑一批 LLM 调用——几千条文档做抽取、几十万条语料做打分、一晚上跑完一轮评测——第一版代码通常长这样：

```python
# 反例：能跑，但四个地方都会出事
results = await asyncio.gather(*[call_llm(p) for p in prompts])
```

它会以四种方式失败，而每一种都对应本篇一节：

1. **瞬间打出几千个并发请求，被上游以 429 打回。** LLM 服务给的是**每分钟请求数（RPM）与每分钟 token 数（TPM）** 双限额，客户端自己不限流，就是让服务端替你限流——而服务端的选择通常是拒绝。
2. **一个请求挂住，整批卡死。** 没有超时的 `await` 可以永远等下去；更糟的是有些实现会在连接半开状态下挂着几十分钟。
3. **一个任务抛异常，剩下的要么被丢弃、要么变成孤儿继续跑。** `gather` 默认把第一个异常立刻向上抛，但**其余 awaitable 不会被取消，它们继续运行**，你既拿不到结果也停不下来。
4. **重试写成了灾难放大器。** 对 429 用固定间隔重试、不加抖动，等于在限流最严重的时候按同一节奏再撞一次墙；对 4xx 重试则纯属烧钱。

把四件事做对，需要的不是更多 API，而是一个**结构**：一个明确区分「同时在跑多少个」「一条数据总共有多少时间」「每次尝试有多少时间」「哪些错误值得再试」的骨架。这个骨架是可以抄的，本文就给一份能直接落地、并且能离线跑通验证的实现。

顺带明确一个容易混的分工（细节在《HTTPX 实战：异步客户端、流式响应与重试》）：**`max_connections` 管「对上游开多少条 TCP 连接」，`Semaphore` 管「同时在跑多少个业务请求」**。前者是传输层参数，后者是调度层参数，数值一般不同——长连接复用率高时前者可以明显小于后者。

## 概念：四块积木

### `asyncio.Semaphore`：并发计数闸门

信号量维护一个内部计数器，每次 `acquire()` 减一、每次 `release()` 加一；计数器到 0 时 `acquire()` 就阻塞等待，直到有任务 `release()`。官方文档给的首选用法就是 `async with`：

```python
sem = asyncio.Semaphore(10)

# ... 稍后
async with sem:
    # 使用共享资源：此刻最多只有 10 个任务在这里面
    ...
```

这等价于手写的 `await sem.acquire()` + `try/finally: sem.release()`。三个 API 值得记住：`locked()` 报告「是否能立即获取」，`release()` 可以唤醒等待者，以及**普通 `Semaphore` 允许 `release()` 次数多于 `acquire()`**——这在多线程语义下是 bug，在单线程 `async with` 下几乎不会发生，但一旦你在别处手动 release，计数就会虚高，限流静默失效。需要防这个就用 `BoundedSemaphore`，超过初值的 `release()` 会抛 `ValueError`。

还有一条铁律：**`asyncio` 的信号量不是线程安全的**，别把它传给 `threading` 的代码用，也别跨事件循环实例化使用。

### `asyncio.timeout` / `timeout_at`：把截止时间写成结构

3.11 起官方推荐用异步上下文管理器管理超时，而不是 `wait_for`：

```python
try:
    async with asyncio.timeout(10):
        await long_running_task()
except TimeoutError:
    print("超时了，但我们处理掉了")
```

机制要说清：`asyncio.timeout()` **取消当前任务并在内部吞掉 `CancelledError`，把它转换成 `TimeoutError`**。因此有个反直觉但重要的推论——**`TimeoutError` 只能在上下文管理器外面捕获**，在里面写 `except TimeoutError` 是抓不到的。

需要「先建上下文、后知道超时值」时用 `asyncio.timeout(None)` 起手，再用 `cm.reschedule(loop.time() + 10)` 补上；`cm.expired()` 用来区分「正常完成」和「恰好卡在边界完成」。要表达**绝对截止时间**就用 `timeout_at(when)`——批量重试场景里这才是正确工具：预算是一个绝对时刻，而不是每次重试重新计一段时间。超时上下文可以安全嵌套，这正是「总预算套单次尝试」的结构基础。

`asyncio.wait_for(aw, timeout)` 仍然可用，但要理解它的代价：它会把 `aw` 包进任务、超时后取消并**等待取消真正完成**，所以总等待时间可能超过 timeout。

### `TaskGroup`：结构化并发，别再自己收拾孤儿

3.11 引入的 `asyncio.TaskGroup` 把「创建任务」和「可靠地等待一组任务」合成一个 API。它的语义比 `gather` 强，强在四处：

```python
async def main():
    async with asyncio.TaskGroup() as tg:
        task1 = tg.create_task(some_coro(...))
        task2 = tg.create_task(another_coro(...))
    print(f"两个都完成了：{task1.result()}, {task2.result()}")
```

- `async with` 退出时**等待组内所有任务完成**；等待期间还能继续 `tg.create_task()`（把 `tg` 传进协程里就能动态加任务）。
- 组内**第一个**抛出非 `CancelledError` 异常的任务，会导致**其余任务全部被取消**，然后所有异常被聚合成 `ExceptionGroup`（或 `BaseExceptionGroup`）抛出。`gather` 不会取消其余任务——这是两者最本质的差别。
- `KeyboardInterrupt` / `SystemExit` 走特殊路径：仍然取消并等待其余任务，但抛出的是那个原始异常本身，不包成异常组。
- 组本身持有每个任务的强引用。

最后一条要展开，因为它是一个真实且安静的 bug 源。官方文档在 `create_task` 下写了一条 Important：**事件循环只保存任务的弱引用**，没被别处引用的任务可能在执行完成前就被垃圾回收。文档给的「fire-and-forget」补救是塞进一个 set 并注册 `add_done_callback(background_tasks.discard)`——但这套写法从不 await 任务，任务失败了异常没人取，GC 时你会看到 `Task exception was never retrieved`。文档明确说：**要避免这个，就用 `TaskGroup`**，它持强引用、会 await、会传播异常。这也是《Python 内存管理实战：引用计数、gc、弱引用与内存泄漏排查》里把「任务被全局集合持有」列为泄漏症状时给出的解法。

配套的等待原语：`asyncio.wait(aws, return_when=...)` 返回 `(done, pending)` 两个集合、**超时不抛异常也不取消**（适合「先到先处理、剩下的自己收尾」）；`asyncio.as_completed(aws)` 按完成顺序产出，3.13 起可以直接异步迭代原始任务对象，便于把结果和任务对应起来。两者都不像 `TaskGroup` 那样自动兜底，超时或迭代被取消时**剩余任务继续跑**。

### `tenacity`：把重试策略写成声明

为什么不自己写 `for` 循环 try/except：退避抖动、按异常类型筛选、耗尽后的行为、指标埋点，每一件都容易写错。`tenacity` 把这几件事拆成四个正交维度：

| 维度 | 常用取值 | 语义 |
| --- | --- | --- |
| `retry=` | `retry_if_exception_type(...)`、`retry_if_result(...)`、`retry_any/retry_all` | 哪些结果/异常值得重试 |
| `stop=` | `stop_after_attempt(n)`、`stop_after_delay(s)`、`stop_before_delay(s)`、`a \| b` | 什么时候放弃 |
| `wait=` | `wait_fixed`、`wait_random`、`wait_exponential`、`wait_random_exponential`、`a + b`、`wait_chain(...)` | 每次重试前睡多久 |
| 钩子 | `before`、`after`、`before_sleep`、`retry_error_callback`、`reraise` | 观测与耗尽后的行为 |

几个细节决定生产可用性：

- **`stop_before_delay(s)`**：在「会超过时间窗」的前一次就放弃，适合有硬性 SLA 的场景；`stop_after_delay` 则会跑完触发超时的那一轮。
- **`reraise=True`**：不设的话重试用尽后你收到的是 `tenacity.RetryError`，原始异常被埋在 `.last_attempt` 里——上层 `except httpx.HTTPStatusError`、`except RateLimited` 全部失效，日志也失去意义。
- **`before_sleep`** 是「注定会被重试」的失败才触发的钩子，正是打 WARNING 日志的位置（`before_sleep_log(logger, logging.WARNING)`），也适合做重连、刷新 token。
- **`retry_state`**（`RetryCallState`）带 `attempt_number`、`outcome`（一个持有最后一次结果或异常的 Future）、`seconds_since_start`、`idle_for`、`start_time`。自定义 `wait` 函数就是靠读它来做「按 429 的 `Retry-After` 等待」这类逻辑。
- **`retry_with(...)`** 可以在调用点覆盖策略，`enabled=False` 能在测试里整体关掉重试；被装饰函数上还挂着 `statistics` 字典，直接给你 `attempt_number`、`idle_for` 等指标。
- 异步代码原生支持：`@retry` 可以直接装饰 `async def`，睡眠也是异步的（`await asyncio.sleep`），不阻塞事件循环。Trio 需要传 `sleep=trio.sleep`。

`tenacity` 还提供 `AsyncRetrying` 这种**迭代器形式**，用来重试一段代码而不是整个函数——这是批量场景更合适的形态，因为「一次尝试」和「单次超时」「剩余预算」必须在同一个作用域里互相看见。官方给的模板是：

```python
from tenacity import AsyncRetrying, RetryError, stop_after_attempt

async def function():
    try:
        async for attempt in AsyncRetrying(stop=stop_after_attempt(3)):
            with attempt:
                raise Exception("My code is failing!")
    except RetryError:
        pass
```

需要把结果喂给 `retry_if_result` 时，文档给的写法是在 `with attempt:` 块外手动 `attempt.retry_state.set_result(result)`。

`@retry` 对生成器/异步生成器**无效**：装饰器包的是函数调用本身，对生成器而言那只是返回一个生成器对象，迭代时抛出的异常根本进不了重试逻辑。同理，把一个生成器**作为参数**传给被重试的函数，它会在第一次尝试后耗尽且不会自动重置——要传就传工厂函数。

## 可运行代码

下面这份是给 LLM 批量调用的完整骨架：**信号量限流 + 总预算（绝对截止时刻）+ 单次尝试超时 + 尊重 `Retry-After` 的指数退避重试 + `TaskGroup` 结构化并发**。它不依赖网络（用一个会随机失败的假客户端演示三条分支：限流、5xx、不可重试），存成 `batch_llm.py` 直接 `python batch_llm.py` 就能看结果。

```python
"""batch_llm.py —— 信号量 + 超时预算 + 指数退避重试（可离线跑通）。"""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Protocol

from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("batch_llm")


# ---------------------------------------------------------------- 异常分层
class RateLimited(Exception):
    """429：上游明确告诉你等多久。带 retry_after 时优先于退避策略。"""

    def __init__(self, message: str = "rate limited", retry_after: float | None = None) -> None:
        super().__init__(message)
        self.retry_after = retry_after


class UpstreamError(Exception):
    """5xx / 连接中断：重试有意义。"""


class BadResponse(Exception):
    """4xx / 内容不合法：重试没有意义，直接放弃这一条。"""


class RetryingClient(Protocol):
    """只声明批量器需要的那一个能力（见《typing.Protocol 与结构化子类型》）。"""

    async def complete(self, prompt: str) -> str: ...


# ---------------------------------------------------------------- 配置对象
@dataclass(frozen=True, slots=True)
class BatchPolicy:
    concurrency: int = 8             # 同时在跑多少个业务请求（不是 TCP 连接数）
    per_call_timeout: float = 15.0   # 单次尝试的超时
    total_budget: float = 60.0       # 一条数据从第一次尝试到全部重试的总预算
    max_attempts: int = 4            # 含首次在内的最大尝试次数
    backoff_multiplier: float = 0.5  # 指数退避基数（秒）
    backoff_max: float = 8.0         # 单次退避封顶


@dataclass(slots=True)
class BatchOutcome:
    results: dict[int, str] = field(default_factory=dict)
    errors: dict[int, Exception] = field(default_factory=dict)
    attempts: int = 0
    retries: int = 0

    @property
    def ok_count(self) -> int:
        return len(self.results)

    @property
    def failed_indices(self) -> list[int]:
        return sorted(self.errors)


# ---------------------------------------------------------------- 重试核心
def _wait_with_retry_after(retry_state: RetryCallState) -> float:
    """尊重 429 的 Retry-After；没有就退回随机指数退避。

    服务端给了等待时间还用固定退避瞎猜，是在主动制造第二次 429。
    """
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exc, RateLimited) and exc.retry_after is not None:
        # 加一点抖动，避免整批同时按同一个 Retry-After 醒来
        return float(exc.retry_after) + random.uniform(0, 0.3)
    return wait_random_exponential(multiplier=0.5, max=8)(retry_state)


async def call_one(
    client: RetryingClient, index: int, prompt: str, policy: BatchPolicy
) -> tuple[int, str | Exception, int]:
    """处理单条数据：总预算 -> (N 次尝试 × 单次超时)，返回 (序号, 结果或异常, 尝试次数)。

    刻意不抛异常：批量场景里一条失败不该掀掉整批。
    """
    attempts = 0
    try:
        # 外层：一条数据的**总时间预算**。预算用完后，内层任何一次尝试都会被取消。
        loop = asyncio.get_running_loop()
        deadline = loop.time() + policy.total_budget
        async with asyncio.timeout_at(deadline):
            async for attempt in AsyncRetrying(
                # 只重试「再试可能成功」的三类：限流、上游 5xx、单次超时
                retry=retry_if_exception_type((RateLimited, UpstreamError, TimeoutError)),
                stop=stop_after_attempt(policy.max_attempts),
                wait=_wait_with_retry_after,
                reraise=True,  # 用尽后抛原始异常，而不是 RetryError（否则上层 except 全失效）
                before_sleep=lambda rs: logger.warning(
                    "#%s 第 %s 次失败（%s），准备重试",
                    index,
                    rs.attempt_number,
                    type(rs.outcome.exception()).__name__ if rs.outcome else "?",
                ),
            ):
                with attempt:
                    attempts += 1
                    # 内层：单次尝试的超时。取「单次上限」和「剩余预算」的较小值，
                    # 保证不会为了一个请求把预算烧穿。
                    remaining = deadline - loop.time()
                    per_call = min(policy.per_call_timeout, max(remaining, 0.01))
                    async with asyncio.timeout(per_call):
                        text = await client.complete(prompt)
                if not attempt.retry_state.outcome.failed:
                    return index, text, attempts
    except TimeoutError:
        logger.error("#%s 超出总预算 %.0fs，放弃", index, policy.total_budget)
        return index, TimeoutError("超出总时间预算"), attempts
    except Exception as exc:  # noqa: BLE001 —— 这里就是要兜住所有单条失败
        logger.error("#%s 最终失败：%s: %s", index, type(exc).__name__, exc)
        return index, exc, attempts
    return index, RuntimeError("重试循环异常退出"), attempts


async def run_batch(
    client: RetryingClient,
    prompts: Sequence[str],
    policy: BatchPolicy = BatchPolicy(),
) -> BatchOutcome:
    """批量驱动：信号量限流 + TaskGroup 结构化并发。"""

    sem = asyncio.Semaphore(policy.concurrency)
    outcome = BatchOutcome()

    async def gated(index: int, prompt: str) -> None:
        # 信号量在重试**之外**：重试期间继续占着坑，防止退避结束后一批同时涌入
        async with sem:
            idx, value, attempts = await call_one(client, index, prompt, policy)
            outcome.attempts += attempts
            if isinstance(value, Exception):
                outcome.errors[idx] = value
            else:
                outcome.results[idx] = value

    async with asyncio.TaskGroup() as tg:
        for i, p in enumerate(prompts):
            tg.create_task(gated(i, p), name=f"item-{i}")

    outcome.retries = outcome.attempts - (outcome.ok_count + len(outcome.errors))
    return outcome


# ---------------------------------------------------------------- 离线替身
class FlakyFakeClient:
    """不依赖网络的假客户端：按概率造出 429 / 5xx / 4xx，用来演示三种分支。"""

    def __init__(self, fail_rate: float = 0.35, hard_fail_indices: Iterable[int] = ()) -> None:
        self.fail_rate = fail_rate
        self.hard_fail = set(hard_fail_indices)
        self.calls = 0
        self._inflight = 0
        self.max_inflight = 0

    async def complete(self, prompt: str) -> str:
        self.calls += 1
        self._inflight += 1
        self.max_inflight = max(self.max_inflight, self._inflight)
        try:
            await asyncio.sleep(random.uniform(0.05, 0.25))  # 模拟网络耗时
            idx = int(prompt.split("#")[-1])
            if idx in self.hard_fail:
                raise BadResponse("内容无法解析")            # 不重试，立刻放弃
            roll = random.random()
            if roll < self.fail_rate * 0.5:
                raise RateLimited("too many requests", retry_after=random.uniform(0.1, 0.6))
            if roll < self.fail_rate:
                raise UpstreamError("bad gateway")
            return f"摘要结果 #{idx}"
        finally:
            self._inflight -= 1


async def demo() -> None:
    prompts = [f"请总结这段话 #{i}" for i in range(24)]
    client = FlakyFakeClient(fail_rate=0.5, hard_fail_indices={3, 11})
    policy = BatchPolicy(concurrency=6, per_call_timeout=1.0, total_budget=4.0, max_attempts=4)

    outcome = await run_batch(client, prompts, policy)

    print("\n===== 汇总 =====")
    print(f"成功 {outcome.ok_count} / {len(prompts)}，失败 {len(outcome.errors)}")
    print(f"总请求次数 {outcome.attempts}（其中重试 {outcome.retries} 次）")
    print(f"客户端观测到的最大并发：{client.max_inflight}（信号量上限 {policy.concurrency}）")
    print(f"失败序号：{outcome.failed_indices}")
    for i, exc in outcome.errors.items():
        print(f"  #{i}: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(demo())
```

跑出来的输出（因为随机性，具体数字每轮不同，但下面这几条不变式恒成立）：

```console
$ python batch_llm.py
WARNING #4 第 3 次失败（RateLimited），准备重试
ERROR #11 最终失败：BadResponse: 内容无法解析
ERROR #1 超出总预算 4s，放弃

===== 汇总 =====
成功 22 / 24，失败 2
总请求次数 38（其中重试 14 次）
客户端观测到的最大并发：6（信号量上限 6）
失败序号：[3, 11]
  #3: BadResponse: 内容无法解析
  #11: BadResponse: 内容无法解析
```

要验证的四条不变式：**最大并发严格等于 `concurrency`**（`FlakyFakeClient.max_inflight` 就是为此存在的）；**不可重试的 `BadResponse` 只消耗一次尝试**；**总预算到期时该条被整体放弃，而不是又起一次新尝试**；**任何一条失败都不会掀掉整批**（`call_one` 不抛异常，异常被收进 `outcome.errors`，`TaskGroup` 因此看不到任何异常）。

换回真实客户端只需要替换 `complete()` 的实现。把《HTTPX 实战》里那个带 `httpx.AsyncClient` 的客户端接上即可：

```python
class OpenAICompatClient:
    """真实实现：把 HTTP 细节收在这里，批量器只依赖 RetryingClient 协议。"""

    def __init__(self, http, *, model: str, max_completion_tokens: int = 512) -> None:
        self._http = http
        self._model = model
        self._max_tokens = max_completion_tokens

    async def complete(self, prompt: str) -> str:
        resp = await self._http.post(
            "/v1/chat/completions",
            json={
                "model": self._model,
                "messages": [{"role": "user", "content": prompt}],
                "max_completion_tokens": self._max_tokens,
                "temperature": 0,
            },
        )
        if resp.status_code == 429:
            # 把 Retry-After 抬到异常层，交给自定义 wait 处理
            raw = resp.headers.get("retry-after")
            raise RateLimited("429", retry_after=float(raw) if raw else None)
        if resp.status_code >= 500:
            raise UpstreamError(f"upstream {resp.status_code}")
        if resp.status_code != 200:
            raise BadResponse(f"{resp.status_code}: {resp.text[:200]}")
        try:
            return resp.json()["choices"][0]["message"]["content"]
        except (KeyError, ValueError) as exc:
            raise BadResponse(f"响应结构异常：{exc}") from exc
```

如果批量结果的**顺序**很重要，用序号索引而不是 zip：本例的 `outcome.results` 就是 `dict[int, str]`，`{i: results[i] for i in range(n)}` 即可还原输入顺序；用 `gather` 也可以（结果列表按提交顺序排列），但代价是丢掉 `TaskGroup` 的异常与取消保证。

## 常见坑

**1. 把信号量放在重试循环里面。** 于是每次重试都重新获取一次许可，退避结束后同一批任务同时抢坑，瞬时并发翻倍。正确位置是**整条数据（含其全部重试）包在 `async with sem:` 之内**——代价是退避期间这个槽位被占着。若你的并发额度就是上游的 RPM 额度，这是想要的行为；若你只是怕压垮本地资源，可以把信号量下移到单次尝试。两种都成立，但要**显式选一个**，别混着写。

**2. 用 `asyncio.timeout(policy.total_budget)` 写在循环里。** 那样每次重试都重置预算，最坏总耗时是 `attempts × total_budget`。预算必须是**绝对截止时刻**：先 `deadline = loop.time() + total_budget`，再用 `timeout_at(deadline)`，内层单次超时取 `min(per_call, deadline - now)`。

**3. 在 `async with asyncio.timeout(...)` 块内部写 `except TimeoutError`。** 抓不到。转换发生在上下文管理器退出时，只能在它外面捕获。

**4. `tg.create_task(...)` 的返回值不接、也不放进组。** 事件循环只持弱引用，任务可能中途被 GC。用 `TaskGroup`，或至少 `task.add_done_callback(background_tasks.discard)`；后者仍不 await 失败任务，异常会以 `Task exception was never retrieved` 的形式在 GC 时才打出来。

**5. 期望 `gather` 帮你取消兄弟任务。** 默认 `return_exceptions=False` 时 `gather` 只把第一个异常向上抛，**其余 awaitable 继续运行**；`return_exceptions=True` 能把异常收进结果列表，但也仍然不会取消别人。要「一处失败、其余全部取消并等待干净」，只有 `TaskGroup` 提供这个语义。批量场景里反过来：你想要的是**单条失败不影响整批**，所以每条数据的协程内部要吞异常——本文 `call_one` 就是这么设计的。

**6. 用 `except Exception` 接 `TaskGroup` 的失败。** 抛出的通常是 `ExceptionGroup`，普通 `except ValueError` 抓不住（异常被包在组里）。用 `except* ValueError as eg:` 按类型解包，或对每条数据自己处理异常，让组根本看不到异常。

**7. 对 429 用不带抖动的退避。** 一批任务同时失败、同时退避、同时醒来，就是教科书上的惊群。至少 `wait_random_exponential(multiplier, max)`；更好是**尊重服务端的 `Retry-After`**（本文 `_wait_with_retry_after`）并在其上再加小段随机抖动。

**8. 忘了 `reraise=True`。** 上层拿到的永远是 `RetryError`，所有基于异常类型的分支判断形同虚设。想看原始异常在栈尾，就必须设。

**9. 用 `@retry` 装饰异步生成器（流式函数）。** 装饰不报错但完全不起作用：迭代期抛出的异常进不了重试逻辑。流式路径本来也不该盲目重试——已经吐给用户的 token 撤不回来。做法是把「开始流之前的握手」单独包进重试，把「恢复/续写」交给上层决策。

**10. 重试时机与幂等性。** 网络类失败（连接失败、DNS、超时）意味着**请求可能已经到达服务端并生效**。对纯读的补全调用问题不大，但凡是带副作用的调用（写库、下单、发扣费任务），必须带幂等键再重试。这条判断标准和《HTTPX 实战：异步客户端、流式响应与重试》里那张「哪层重试」的表一致。

**11. 限流只限并发、不看速率。** `Semaphore(8)` 限的是「同时在跑 8 个」，不等于「每分钟不超过 N 个请求」。请求很快时（短 prompt、低延迟），8 并发能打出很高的 RPM。真要守 RPM/TPM，需要再加一层令牌桶或按窗口计数——参见《错误处理、重试与限流》。

**12. 把 `asyncio.wait` 当超时用。** 它**不抛 `TimeoutError` 也不取消**，超时未完成的只是被放回 `pending` 集合里继续跑。用完要自己收尾（取消并等待，或放进 `TaskGroup`）。

**13. 用 `asyncio.Semaphore` 跨线程 `release()`。** 它是非线程安全的。要在线程池回调里唤醒异步等待者，用 `loop.call_soon_threadsafe()`。

## 延伸阅读

- 官方《asyncio — Coroutines and tasks》（`create_task`、`TaskGroup`、`timeout`、`gather`、`wait`、`as_completed`）：https://docs.python.org/3/library/asyncio-task.html
- 官方《asyncio — Synchronization primitives》（`Semaphore`、`BoundedSemaphore`、`Lock`、`Event`、`Barrier`）：https://docs.python.org/3/library/asyncio-sync.html
- `tenacity` 官方文档与 API 参考（全部 `stop`/`wait`/`retry`/`before_sleep` 取值）：https://tenacity.readthedocs.io/
- `tenacity` 仓库（Apache 2.0）：https://github.com/jd/tenacity
- PEP 654 – Exception Groups and `except*`（`TaskGroup` 的抛出形态）：https://peps.python.org/pep-0654/
- 本站相关：《asyncio 异步编程》（事件循环与任务机制）、《并发编程：concurrent.futures 与 threading》（线程池侧的对照与 `threading.Semaphore`）、《HTTPX 实战：异步客户端、流式响应与重试》（传输层超时与连接池）、《typing.Protocol 与结构化子类型》（本文 `RetryingClient` 协议的来由与替身写法）、《Pydantic 校验器与字段约束》（重试之外另一条自救路径：把非法输出回喂给模型）、《错误处理、重试与限流》（供应商限流语义与降级策略）、《Python 内存管理实战：引用计数、gc、弱引用与内存泄漏排查》（弱引用任务被回收这一类静默故障）

> **来源**：抓取于 2026-09-19。译自/引自 Python 官方文档 [asyncio — Coroutines and tasks](https://docs.python.org/3/library/asyncio-task.html) 与 [asyncio — Synchronization primitives](https://docs.python.org/3/library/asyncio-sync.html)（Python 软件基金会，PSF 许可证第 2 版；含 3.14 文档中 `TaskGroup`、`asyncio.timeout`、`create_task` 弱引用告警等小节）以及 [Tenacity 官方文档](https://tenacity.readthedocs.io/)（`doc/source/index.rst`，Julian Taylor 与 contributors，Apache License 2.0，已核对仓库 LICENSE）。`BatchPolicy`、`call_one`、`run_batch`、`_wait_with_retry_after` 与 `FlakyFakeClient` 为编者按上述 API 组合的分层实现，示例可离线运行验证。
