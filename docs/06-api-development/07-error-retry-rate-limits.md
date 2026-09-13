---
title: 错误处理、重试与限流
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_handle_rate_limits.ipynb
author: OpenAI Cookbook（How to handle rate limits）、OpenAI（openai-python README · Handling errors / Retries / Timeouts）
license: MIT / Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 7
versions: openai-python 2026-09 最新稳定版（默认重试 2 次、默认超时 10 分钟）
---

生产环境的 LLM 应用一定会遇到三类故障：请求太快被限流（429）、网络/超时、服务端 5xx。这一篇把 SDK 的异常体系、自动重试机制，以及 Cookbook 的限流应对策略一次讲全。

## 一、为什么存在限流（Rate Limits）

Cookbook 原文给出的三条理由：

1. **防滥用**：恶意行为者可能用请求洪流冲击 API、干扰服务；
2. **保证公平**：防止个别用户占满容量，让大家都能正常使用；
3. **管理聚合负载**：请求量激增会压垮基础设施，限流维持整体体验平滑。

限额与配额随用量与付费记录自动提升（tier 分级）。撞限流时的报错长这样：

```text
RateLimitError: Rate limit reached for default-codex in organization org-{id} on
requests per min. Limit: 20.000000 / min. Current: 24.000000 / min. ...
```

触发方式往往就是一段无心之失的循环：

```python
# 在循环里密集请求
for _ in range(100):
    client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=10,
    )
```

## 二、SDK 的异常体系：先分清错误类型

openai-python README 定义的异常层级（翻译）：

- 连不上 API（网络问题、超时）→ 抛 `APIConnectionError` 的子类；
- API 返回非 2xx 状态码 → 抛 `APIStatusError` 的子类，带 `status_code` 与 `response` 属性；
- 所有错误都继承自 `openai.APIError`。

**表：HTTP 状态码与 SDK 异常类型对照**

| 状态码 | 异常类型 |
| --- | --- |
| 400 | `BadRequestError` |
| 401 | `AuthenticationError` |
| 403 | `PermissionDeniedError` |
| 404 | `NotFoundError` |
| 422 | `UnprocessableEntityError` |
| 429 | `RateLimitError` |
| ≥500 | `InternalServerError` |
| N/A（网络层） | `APIConnectionError` |

标准捕获模式（README 原文示例）：

```python
import openai
from openai import OpenAI

client = OpenAI()

try:
    client.fine_tuning.jobs.create(
        model="gpt-4o",
        training_file="file-abc123",
    )
except openai.APIConnectionError as e:
    print("The server could not be reached")
    print(e.__cause__)  # 底层异常（HTTPX2 内抛出）
except openai.RateLimitError as e:
    print("A 429 status code was received; we should back off a bit.")
except openai.APIStatusError as e:
    print("Another non-200-range status code was received")
    print(e.status_code)
    print(e.response)
```

排障利器：每个响应对象都有 `_request_id` 属性（来自 `x-request-id` 响应头），失败请求要记录它反馈给官方；失败请求的 request id 必须从 `APIStatusError` 异常上取（`exc.request_id`）。

## 三、SDK 自带的重试与超时

不用引入任何第三方库，SDK 默认就会重试（README 原文要点）：

- **默认重试 2 次**，短指数退避；
- 可重试的错误：连接错误、408 请求超时、409 冲突、429 限流、≥500 服务端错误；
- 默认超时 **10 分钟**，可整体或分阶段（读/写/连接）配置；
- 超时的请求默认也会重试两次；
- 流式响应（`Stream`/`AsyncStream`）**不会自动重试**——重放可能重复输出内容（见第 03 篇）。

```python
from openai import OpenAI

# 全局配置（max_retries 默认为 2，这里改为 0 禁用）
client = OpenAI(max_retries=0)

# 或按单次请求配置
client.with_options(max_retries=5).chat.completions.create(
    messages=[
        {
            "role": "user",
            "content": "How can I get the name of the current day in JavaScript?",
        }
    ],
    model="gpt-5.5",
)
```

```python
import httpx2
from openai import OpenAI

# 整体超时：20 秒
client = OpenAI(timeout=20.0)

# 更细粒度的控制
client = OpenAI(
    timeout=httpx2.Timeout(60.0, read=5.0, write=10.0, connect=2.0),
)
```

## 四、自己动手：随机指数退避（Exponential Backoff）

需要在应用层接管重试时，Cookbook 给出三种方案。核心思想：撞限流后先睡一小段再重试；仍失败就拉长睡眠再来，直到成功或达到上限。

> 注意（原文）：失败的请求也计入每分钟限额，所以**无脑连续重发是无效的**。

**方案 1：Tenacity 库**

```python
from tenacity import (
    retry,
    stop_after_attempt,
    wait_random_exponential,
)  # 用于指数退避

@retry(wait=wait_random_exponential(min=1, max=60), stop=stop_after_attempt(6))
def completion_with_backoff(**kwargs):
    return client.chat.completions.create(**kwargs)


completion_with_backoff(model="gpt-4o-mini", messages=[{"role": "user", "content": "Once upon a time,"}])
```

**方案 2：backoff 库**

```python
import backoff  # 指数退避

@backoff.on_exception(backoff.expo, openai.RateLimitError, max_time=60, max_tries=6)
def completions_with_backoff(**kwargs):
    return client.chat.completions.create(**kwargs)
```

**方案 3：手写装饰器**（不引第三方库时）

```python
import random
import time

# 定义重试装饰器
def retry_with_exponential_backoff(
    func,
    initial_delay: float = 1,
    exponential_base: float = 2,
    jitter: bool = True,
    max_retries: int = 10,
    errors: tuple = (openai.RateLimitError,),
):
    """带指数退避的重试。"""

    def wrapper(*args, **kwargs):
        num_retries = 0
        delay = initial_delay

        while True:
            try:
                return func(*args, **kwargs)

            except errors as e:
                num_retries += 1

                if num_retries > max_retries:
                    raise Exception(
                        f"Maximum number of retries ({max_retries}) exceeded."
                    )

                # 加入随机抖动（jitter），避免所有重试同时到达
                delay *= exponential_base * (1 + jitter * random.random())

                time.sleep(delay)

            except Exception as e:
                raise e

    return wrapper


@retry_with_exponential_backoff
def completions_with_backoff(**kwargs):
    return client.chat.completions.create(**kwargs)
```

退避三要素：指数增长（第一次快速重试，后续越来越慢）、随机抖动（防止重试风暴）、上限（放弃并上报）。

## 五、更多策略：降级模型、精确 max_tokens、主动限速、合并请求

**1. 降级到备用模型（fallback）**：主模型被限流时切到次级模型保住可用性。原文提醒：备用模型的准确率、延迟、成本可能差异显著，且部分模型**共享限额**；上线前要用评测验证降级方案不影响质量：

```python
def completions_with_fallback(fallback_model, **kwargs):
    try:
        return client.chat.completions.create(**kwargs)
    except openai.RateLimitError:
        kwargs['model'] = fallback_model
        return client.chat.completions.create(**kwargs)


completions_with_fallback(fallback_model="gpt-4o", model="gpt-4o-mini", messages=[{"role": "user", "content": "Once upon a time,"}])
```

**2. `max_tokens` 贴近预期输出长度**：限流用量按"max_tokens 与输入估算 token 的较大者"计算——设得过高会提前撞限（`max_tokens` 的对应概念在 Responses API 中为 `max_output_tokens`，见第 01 篇的参数对照）。

**3. 批处理场景：按限额倒数主动加延迟**。与其"撞限→退避→再撞限"，不如算好节奏（每分钟 20 个请求就每次隔 3–6 秒），贴近限额上限又不浪费重试：

```python
import time

def delayed_completion(delay_in_seconds: float = 1, **kwargs):
    """给补全请求加上指定延迟。"""
    time.sleep(delay_in_seconds)
    return client.chat.completions.create(**kwargs)


rate_limit_per_minute = 20
delay = 60.0 / rate_limit_per_minute

delayed_completion(
    delay_in_seconds=delay,
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Once upon a time,"}]
)
```

**4. RPM 紧张但 TPM 有余量时：合并多个任务进一个请求**。RPM（requests per minute）与 TPM（tokens per minute）分开计量。把 10 个"讲故事"任务合成一条请求、再用 Structured Outputs 拿回结构化数组（第 06 篇的原语）：

```python
from pydantic import BaseModel

# 定义结构化输出的 Pydantic 模型
class StoryResponse(BaseModel):
    stories: list[str]
    story_count: int

num_stories = 10
content = "Once upon a time,"

prompt_lines = [f"Story #{i+1}: {content}" for i in range(num_stories)]
prompt_text = "\n".join(prompt_lines)

messages = [
    {
        "role": "developer",
        "content": "You are a helpful assistant. Please respond to each prompt as a separate short story."
    },
    {
        "role": "user",
        "content": prompt_text
    }
]

# 一次请求生成全部故事，并用结构化输出约束格式
response = client.beta.chat.completions.parse(
    model="gpt-4o-mini",
    messages=messages,
    response_format=StoryResponse,
)

print(response.choices[0].message.content)
```

> 编者注：`parse` 现已去掉 `beta` 前缀（`client.chat.completions.parse`）；原文此处的 `beta.` 写法保留自抓取时的 notebook。
> 合并请求的注意点（原文）：单请求 token 上限可能截断；任务会互相等凑批；返回顺序不保证与输入一致。

**5. 官方并行处理脚本**：Cookbook 提供 [api_request_parallel_processor.py](https://github.com/openai/openai-cookbook/blob/main/examples/api_request_parallel_processor.py)——从文件流式读任务避免撑爆内存、并发请求、同时限制请求与 token 用量、失败重试、记录错误。大规模离线处理可直接复用。

## 六、本篇小结

- 异常分三类抓：`APIConnectionError`（网络）、`RateLimitError`（429）、其他 `APIStatusError`；记录 `request_id` 便于排障；
- SDK 默认重试 2 次（连接/408/409/429/5xx）、默认超时 10 分钟，均可配置；流式不自动重试；
- 自管重试的公式：指数退避 + 随机抖动 + 重试上限；
- 系统性策略：降级模型、`max_tokens` 贴身设置、按限额倒数主动限速、合并请求省 RPM、大规模离线用并行脚本（或下一篇的 Batch API）。

---

> **来源**：本文翻译自 [How to handle rate limits](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_handle_rate_limits.ipynb)（OpenAI Cookbook，MIT）与 [openai-python README · Handling errors / Retries / Timeouts](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。抓取于 2026-09-13。
