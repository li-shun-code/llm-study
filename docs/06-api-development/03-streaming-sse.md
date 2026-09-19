---
title: 流式输出（SSE）
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_stream_completions.ipynb
author: OpenAI Cookbook（How to stream completions）、OpenAI（openai-python README）
license: MIT / Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 3
versions: openai-python 2026-09 最新稳定版（SSE 流式）
---

默认情况下，API 会**等整个回复生成完毕**才一次性返回。如果回复很长，你可能要干等几秒甚至几十秒。流式输出（streaming）让响应在生成过程中就逐段（chunk）下发——首字节可以在 0.1 秒左右到达，而不是几秒。

## 一、开启流式：stream=True

把 `stream` 设为 `True` 后，返回对象变成一个**服务器推送事件**（Server-Sent Events，SSE）流。用普通 `for` 循环即可逐个事件消费。

**Responses API 写法**（openai-python README）：

```python
from openai import OpenAI

client = OpenAI()

stream = client.responses.create(
    model="gpt-5.5",
    input="Write a one-sentence bedtime story about a unicorn.",
    stream=True,
)

for event in stream:
    print(event)
```

异步客户端接口完全一致：

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI()


async def main():
    stream = await client.responses.create(
        model="gpt-5.5",
        input="Write a one-sentence bedtime story about a unicorn.",
        stream=True,
    )

    async for event in stream:
        print(event)


asyncio.run(main())
```

**Chat Completions 写法**（Cookbook 原文示例）：从 `delta` 字段（而非非流式的 `message` 字段）取增量内容：

```python
# 带 stream=True 的 Chat Completions 请求
response = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[
        {'role': 'user', 'content': "What's 1+1? Answer in one word."}
    ],
    temperature=0,
    stream=True  # 这次设置 stream=True
)

for chunk in response:
    print(chunk)
    print(chunk.choices[0].delta.content)
    print("****************")
```

输出（节选）：

```text
ChatCompletionChunk(id='chatcmpl-9lMgfRSWPHcw51s6wxKT1YEO2CKpd', choices=[Choice(delta=ChoiceDelta(content='', function_call=None, role='assistant', tool_calls=None), finish_reason=None, index=0, logprobs=None)], ...)
****************
ChatCompletionChunk(..., delta=ChoiceDelta(content='Two', ...), ...)
```

可以看到流式响应的每个分块（chunk）携带的是 `delta` 字段而不是 `message` 字段。`delta` 里可能是：

- 角色标识（如 `{"role": "assistant"}`，通常是第一个分块）；
- 一段增量内容（如 `{"content": "\n\n"}`）；
- 空对象 `{}`——流结束时出现。

## 二、流式到底省了多少时间

Cookbook 用"数到 100"做了实测对比（原始运行记录）：

```python
# 记录请求发出前的时间
start_time = time.time()

# 流式请求：数到 100，逗号分隔、不换行
response = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[
        {'role': 'user', 'content': 'Count to 100, with a comma between each number and no newlines. E.g., 1, 2, 3, ...'}
    ],
    temperature=0,
    stream=True  # 再次设置 stream=True
)
collected_chunks = []
collected_messages = []
for chunk in response:
    chunk_time = time.time() - start_time  # 计算该分块的到达延迟
    collected_chunks.append(chunk)
    chunk_message = chunk.choices[0].delta.content  # 取增量文本
    collected_messages.append(chunk_message)
    print(f"Message received {chunk_time:.2f} seconds after request: {chunk_message}")

print(f"Full response received {chunk_time:.2f} seconds after request")
collected_messages = [m for m in collected_messages if m is not None]
full_reply_content = ''.join(collected_messages)
```

实测输出（节选）：

```text
Message received 1.14 seconds after request: 
Message received 1.14 seconds after request: 1
Message received 1.14 seconds after request: ,
Message received 1.14 seconds after request:  
Message received 1.16 seconds after request: 2
Message received 1.35 seconds after request: 3
...
```

结论（原文）：两种请求完成的总时长差不多（示例中约 4–5 秒），但**流式请求在 0.1 秒后就收到了第一个 token**，之后每 0.01–0.02 秒到达一个。对聊天界面来说，这就是"秒回"与"转圈"的差距。

## 三、拼接完整回复

流式拿到的是碎片，最终要自己拼接：

```python
collected_messages = []
for chunk in response:
    delta = chunk.choices[0].delta.content
    if delta is not None:
        collected_messages.append(delta)
full_reply_content = ''.join(collected_messages)
```

## 四、获取流式请求的 token 用量

设置 `stream_options={"include_usage": True}` 后，流的**最后一个分块**会附带整个请求的用量统计（原文规则）：

- 除最后一个分块外，其余分块的 `usage` 字段都是 `None`；
- 最后一个分块的 `usage` 包含整次请求的 token 统计；
- 最后一个分块的 `choices` 恒为空数组 `[]`。

```python
response = client.chat.completions.create(
    model='gpt-4o-mini',
    messages=[
        {'role': 'user', "content": "What's 1+1? Answer in one word."}
    ],
    temperature=0,
    stream=True,
    stream_options={"include_usage": True},  # 获取流式响应的 token 用量
)

for chunk in response:
    print(f"choices: {chunk.choices}\nusage: {chunk.usage}")
    print("****************")
```

## 五、SDK 的高级流式助手（可选）

openai-python 还提供 `client.chat.completions.stream()` 上下文管理器——它在原始分块之上提供更细粒度的事件（内容增量、拒绝增量、工具调用参数增量等）与自动累积（原文见 SDK 的 Structured Outputs Parsing / Streaming Helpers 文档）：

```python
from openai import AsyncOpenAI

client = AsyncOpenAI()

async with client.chat.completions.stream(
    model='gpt-5.5',
    messages=[...],
) as stream:
    async for event in stream:
        if event.type == 'content.delta':
            print(event.content, flush=True, end='')
```

常用事件类型：`chunk`（每个原始分块）、`content.delta` / `content.done`（内容增量与完成）、`refusal.delta` / `refusal.done`（拒绝内容）、`tool_calls.function.arguments.delta` / `.done`（工具调用参数流式生成）。流结束后 `stream.get_final_completion()` 可直接取回累积完成的完整响应对象。

> 编者提示：SDK 文档中的 Assistants 流式助手（`beta.threads.runs.stream` 等）随 Assistants API 一并废弃，请勿在新项目中使用；Responses API 的事件流用 `client.responses.create(..., stream=True)` 迭代即可。

## 六、何时不要用流式

原文的两点提醒值得记牢：

1. **内容审核更困难**：`stream=True` 下内容是一段段到达的，部分内容难以在展示前整体评估，生产应用需要自己在流上叠加审核/过滤逻辑；
2. **流不可自动重试**：openai-python 文档明确——消费 `Stream`/`AsyncStream` 时的读超时抛 `APITimeoutError`、其他请求失败抛 `APIConnectionError`，且**流式消费不会被 SDK 自动重试**，因为重放请求可能把已经输出给用户的内容再输出一遍（错误处理详见《错误处理、重试与限流》）。

## 七、本篇小结

- `stream=True` 让响应以 SSE 事件流下发，首 token 延迟从秒级降到约 0.1 秒；
- Chat Completions 从 `chunk.choices[0].delta.content` 取增量；Responses API 迭代 `client.responses.create(..., stream=True)` 返回的事件流；
- 拼接碎片得到完整文本；`stream_options={"include_usage": True}` 拿整次请求用量；
- 流式不可自动重试，展示侧需自建审核与中断恢复逻辑。

---

> **来源**：本文翻译自 [How to stream completions](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_stream_completions.ipynb)（OpenAI Cookbook，MIT）与 [openai-python README · Streaming responses](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。抓取于 2026-09-13。
> 编者注：原文基于 Chat Completions 演示，流式机制对 Responses API 完全一致（`stream=True`）；本篇按"Responses 为主、Chat Completions 对照"组织，SSE 的网络层原理另见《SSE 与 WebSocket》。
