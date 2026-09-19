---
title: 并发请求限流：信号量、令牌桶与超时预算的完整实现
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/api_request_parallel_processor.py
author: OpenAI Cookbook（api_request_parallel_processor.py）
license: MIT
fetched_at: 2026-09-19
translated: true
versions: openai-python 2026-09 最新稳定版（AsyncOpenAI + httpx2 传输层）；Python 3.10+；示例模型 gpt-5.4-mini
order: 15
group: 可靠性、安全与成本
---
《错误处理、重试与限流》讲的是**单请求**视角：捕获 429、退避重试、配超时。真实场景是另一件事——离线跑 20 万条改写任务，或者线上同时服务 300 个会话。Cookbook 开头那段话说得很直白：一个个 trickle 一百万个请求要好几天；一百万个请求一起 parallel 出去会撞限流报错。**要最大化吞吐，就得把并发请求节流到限额之下。** 本篇给一份可直接跑的完整实现：信号量管并发、令牌桶管速率、超时预算管尾部延迟，外加优雅退出。

## 一、三层限流分别解决什么

**表：并发工程的三个正交旋钮**

| 机制 | 控制什么 | 不控制会怎样 |
| --- | --- | --- |
| 信号量 `asyncio.Semaphore` | 同时在途的请求数（并发度） | 协程全速创建，连接池打满、内存爆、瞬时 QPS 冲垮网关 |
| 令牌桶（RPM + TPM 两个桶） | 单位时间允许的请求数与 token 数 | 并发不高但速率超限，持续 429，重试又放大流量 |
| 超时预算（deadline） | 单个任务与整批任务的最长等待 | 少数慢请求拖住槽位，整批任务的 p99 由最慢的决定 |

三层缺一不可。常见误解是"我只设并发数就够了"：RPM 与 TPM 是**分开计量**的两条限额（见《错误处理、重试与限流》），20 并发 × 每条 6 秒 = 200 RPM，但如果每条请求 3 万 token，TPM 先到顶。

## 二、完整实现

```python
"""并发调用 LLM API：信号量 + 令牌桶 + 超时预算 + 优雅退出。

用法：
    python llm_batch.py --rpm 480 --tpm 180000 --concurrency 12
依赖：
    pip install openai python-dotenv tiktoken
"""

import argparse
import asyncio
import json
import random
import time
from collections import defaultdict
from pathlib import Path

import tiktoken
from openai import AsyncOpenAI, APIConnectionError, APIStatusError, RateLimitError

MODEL = "gpt-5.4-mini"
ENCODING = tiktoken.encoding_for_model(MODEL)


class TokenBucket:
    """经典令牌桶：容量决定能容忍多大的突发，速率决定长期均速。"""

    def __init__(self, rate_per_minute: float, capacity: float | None = None) -> None:
        self.rate = rate_per_minute / 60.0
        self.capacity = capacity if capacity is not None else max(rate_per_minute / 60.0 * 10, 1.0)
        self.tokens = self.capacity
        self.updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, amount: float = 1.0) -> None:
        async with self._lock:                      # 锁内只做记账，不做 IO
            while True:
                now = time.monotonic()
                self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
                self.updated = now
                if self.tokens >= amount:
                    self.tokens -= amount
                    return
                await asyncio.sleep((amount - self.tokens) / self.rate)


async def estimate_cost(messages: list[dict]) -> int:
    """TPM 桶按"输入 token + 计划输出上限"预扣，与平台的限流口径保持一致。"""
    text = "".join(str(m.get("content", "")) for m in messages)
    return len(ENCODING.encode(text)) + 512  # 512 为本批任务的输出上限


async def call_one(
    client: AsyncOpenAI,
    rpm: TokenBucket,
    tpm: TokenBucket,
    sem: asyncio.Semaphore,
    messages: list[dict],
    stats: dict,
    deadline: float,
) -> str | None:
    async with sem:                                 # 1) 并发度
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            stats["dropped_no_budget"] += 1
            return None

        cost = await estimate_cost(messages)
        async with asyncio.timeout(min(remaining, 60)):   # 2) 超时预算（3.11+）
            await rpm.acquire()                     # 3) 请求速率
            await tpm.acquire(cost)                 # 4) token 速率
            try:
                resp = await client.responses.create(
                    model=MODEL,
                    input=messages[-1]["content"],
                    instructions=messages[0]["content"],
                    max_output_tokens=512,
                    timeout=min(remaining, 45),     # 5) 客户端超时不超过剩余预算
                )
                stats["success"] += 1
                return resp.output_text
            except RateLimitError:
                stats["rate_limited"] += 1
                # 尊重服务端建议的重试时长（若有），加抖动避免同步重试风暴
                retry_after = 1.0 + random.random() * 2
                await asyncio.sleep(retry_after)
                return await call_one(client, rpm, tpm, sem, messages, stats, deadline)  # 仅重试一次
            except (APIConnectionError, APIStatusError) as exc:
                stats["error:" + type(exc).__name__] += 1
                return None
            except TimeoutError:
                stats["timeout"] += 1
                return None


async def run_batch(prompts: list[list[dict]], rpm_limit: int, tpm_limit: int, concurrency: int,
                    save_path: Path, batch_budget: float) -> None:
    client = AsyncOpenAI()                          # api_key 走环境变量
    rpm = TokenBucket(rpm_limit, capacity=rpm_limit * 0.2)   # 允许 20% 的突发
    tpm = TokenBucket(tpm_limit, capacity=tpm_limit * 0.2)
    sem = asyncio.Semaphore(concurrency)
    stats: dict = defaultdict(int)
    deadline = time.monotonic() + batch_budget

    save_path.parent.mkdir(parents=True, exist_ok=True)
    write_lock = asyncio.Lock()

    async def worker(idx: int, messages: list[dict]) -> None:
        try:
            out = await call_one(client, rpm, tpm, sem, messages, stats, deadline)
        except asyncio.CancelledError:               # Ctrl-C / 超时后清理，保证已写出的行不损坏
            stats["cancelled"] += 1
            raise
        if out is not None:
            async with write_lock:                   # 增量落盘，不要等全批完成
                with save_path.open("a", encoding="utf-8") as f:
                    f.write(json.dumps({"idx": idx, "output": out}, ensure_ascii=False) + "\n")

    tasks = [asyncio.create_task(worker(i, m)) for i, m in enumerate(prompts)]
    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        for t in tasks:
            t.cancel()
        raise
    finally:
        await client.close()
        remaining = max(0.0, deadline - time.monotonic())
        print(f"完成：{dict(stats)}｜耗时 {batch_budget - remaining:.1f}s｜"
              f"吞吐 {len(prompts) / max(batch_budget - remaining, 1) * 60:.0f} 条/分钟")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--rpm", type=int, default=480)
    parser.add_argument("--tpm", type=int, default=180_000)
    parser.add_argument("--concurrency", type=int, default=12)
    parser.add_argument("--budget", type=float, default=600, help="整批超时预算（秒）")
    args = parser.parse_args()

    prompts = [[
        {"role": "developer", "content": "把用户输入的标题改写为更清晰的中文标题，只输出标题。"},
        {"role": "user", "content": f"原标题：条目 {i}"},
    ] for i in range(200)]

    asyncio.run(run_batch(prompts, args.rpm, args.tpm, args.concurrency,
                          Path("out/results.jsonl"), args.budget))
```

两处与官方脚本的差异值得说明：脚本用"每分钟窗口计数"节流，**窗口交界处会短暂允许双倍突发**，本文换成令牌桶（容量吸收突发、速率决定均速）；脚本的重试走"进重试队列、由主循环统一取"，本文把重试收在单次调用内并受 deadline 约束，逻辑更短、也更容易嵌进 Web 服务。`asyncio.timeout` 需要 Python 3.11+；3.10 下用 `asyncio.wait_for` 包一层。

## 三、参数怎么定：从限额倒推

先查你项目/组织的实际限额（控制台 Rate limits 页，或用 `x-ratelimit-limit-requests`、`x-ratelimit-remaining-tokens`、`x-ratelimit-reset-requests` 响应头读，见《错误处理、重试与限流》），再倒推：

```text
目标并发 ≈ min( RPM × 平均单请求秒数 / 60 ,  TPM × 平均单请求秒数 / 60 / 平均单请求 token 数 )
```

例：RPM=500、TPM=200,000，单请求平均 8 秒、约 2,000 token → RPM 侧允许并发 500×8/60≈67，TPM 侧允许 200,000×8/60/2,000≈13 → **取小的 13，再留 20% 余量 → concurrency=10、rpm 桶设 400、tpm 桶设 160,000**。

三条经验：

1. **桶容量 ≠ 速率**。容量决定能吸收多大突发（`capacity=rpm*0.2` 意味着最多先冲 20%），速率决定长期均速。做交互型服务时容量小一点更稳，做离线批处理时容量可以放大。
2. **TPM 要按预扣口径记账**：平台按"输入 token + 输出上限"估，不是按实际输出。`max_output_tokens` 设多大，就等于在桶里多扣多少。
3. **别把三层写在一个函数里**。信号量在调用方、速率桶在网关层、超时预算在任务编排层，混在一起就没法单独测。

## 四、什么时候不要用这套

- **可容忍延迟的大规模离线任务**：用 Batch API，半价且不吃你的实时限额（《成本与 Token 优化：Prompt Caching 与 Batch API》）。
- **需要跨模型路由、多租户配额、自动 fallback**：用 LiteLLM Router 或多智能体框架的执行层，别手写（《OpenAI 兼容端点与 LiteLLM：一套代码调用所有模型》）。
- **只有几个请求的脚本**：`for` + `await` 就够，加限流是给自己找麻烦。

本篇的价值在中间地带：**几千到几百万条、要实时、要可控**。

## 五、常见坑

1. **`asyncio.gather` 一把梭创建百万协程**：内存与调度都会炸。要么用信号量把协程数压住（本文做法），要么流式读入任务（Cookbook 脚本按行流式读 JSONL 正是为此）。
2. **在令牌桶锁里做网络 IO**：锁变成串行瓶颈，并发度形同虚设。锁内只记账。
3. **重试无预算**：一次 429 → 退避 → 再试，如果外层已经有 deadline，重试必须看到剩余时间，否则超时后仍在跑（本文里重试只在剩余预算内进行）。
4. **递归重试叠深度**：示例中 `RateLimitError` 只重试一次就是防止无限递归；多层重试要和 SDK 的自动重试（默认 2 次）合起来算总次数。
5. **结果不落中间态**：跑 3 小时失败后要全部重来。用 JSONL 增量写 + `idx` 幂等键，重跑时跳过已完成项。
6. **忘了 `client.close()`**：`AsyncOpenAI` 持有连接池，长期运行的服务里不关闭会泄漏。
7. **只测吞吐不测尾部**：加限流后 p99 会变差，用超时预算和队列深度做闭环，观测方法见《生产可观测性：OpenTelemetry GenAI 语义约定与调用侧埋点》。

## 六、小结

- 三个正交旋钮：信号量管并发度、令牌桶管 RPM/TPM、超时预算管尾部；
- 限额从控制台或响应头读，用"并发 ≈ 限额 × 平均时长"倒推，取 RPM/TPM 两侧较小值再留余量；
- TPM 按"输入 + 输出上限"预扣记账；桶容量只吸收突发，桶速率管长期均速；
- 增量落盘 + 幂等键让长跑任务可恢复；离线大批量交给 Batch API，跨模型路由交给 Router。

---

> **来源**：抓取于 2026-09-19。设计依据 OpenAI Cookbook（MIT）官方脚本 [api_request_parallel_processor.py](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/api_request_parallel_processor.py)（脚本头部对"并行需节流"的论述、流式读入避免撑爆内存、按分钟窗口同时限制请求与 token、失败重试进重试队列、错误写 JSONL、Ctrl-C 优雅退出）与其配套指南 [How to handle rate limits](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_handle_rate_limits.ipynb)；异步客户端与 `max_output_tokens` 用法依据 [openai-python README](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。将原文的"每秒窗口计数"改写为令牌桶、加入超时预算与增量落盘，为本站编者改动。
