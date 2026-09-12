---
title: 第一个 API 调用：Responses API 与 Chat Completions
source_url: https://raw.githubusercontent.com/openai/openai-python/main/README.md
author: OpenAI（openai-python README）、OpenAI Cookbook（responses_example.ipynb）
license: Apache 2.0 / MIT
fetched_at: 2026-09-13
translated: true
order: 1
versions: openai-python 2026-09 最新稳定版（HTTPX2 传输层）、示例模型 gpt-5.5 / gpt-4o-mini
---

> **来源**：本文翻译自 [OpenAI Python API library（README）](https://raw.githubusercontent.com/openai/openai-python/main/README.md) 与 [What is the Responses API?（openai-cookbook/examples/responses_api/responses_example.ipynb）](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb)，作者 OpenAI，许可 Apache 2.0 / MIT。抓取于 2026-09-13。

本篇是整个模块的起点：安装官方 SDK、配置 API Key（用模块 0 讲过的 `.env` 方案，不要把 Key 写进代码），然后分别用 **Responses API** 与 **Chat Completions API** 发出第一个调用。OpenAI 现在的主推接口是 Responses API；Chat Completions 是长期支持（"supported indefinitely"）的上一代标准，两者并讲、互相印证。

> 编者注：早期的 Assistants API 已废弃，本站一律不作为教学内容；如你读到基于 Assistants/Threads 的旧教程，请按本模块的 Responses API 写法对照迁移。

## 一、安装

```sh
# 从 PyPI 安装
pip install openai
```

该库要求 Python 3.10+，由 OpenAI 的 OpenAPI 规范自动生成，包含所有请求参数与响应字段的类型定义，同步、异步客户端并存。

## 二、配置 API Key：用 .env，不进代码

库的主 README 中给出的推荐做法是：使用 [python-dotenv](https://pypi.org/project/python-dotenv/)，把 Key 放进 `.env` 文件，避免 Key 被提交进版本库：

```text
# .env
OPENAI_API_KEY="sk-..."
```

```python
from dotenv import load_dotenv

load_dotenv()  # 读取当前目录下的 .env，把变量注入环境

# 之后 OpenAI() 会自动读取环境变量 OPENAI_API_KEY，无需显式传参
```

`.env`、虚拟环境、环境变量管理的完整细节见模块 0《环境变量与 API Key 管理》。Key 可在 platform.openai.com 的 API Keys 设置页申请。

## 三、Responses API：当前的主接口

主 README 开宗明义："The primary API for interacting with OpenAI models is the Responses API."（与 OpenAI 模型交互的主接口是 Responses API。）第一个调用只需 `model` 和 `input` 两个参数：

```python
import os
from openai import OpenAI

client = OpenAI(
    # 默认会读取环境变量 OPENAI_API_KEY，这行可以省略
    api_key=os.environ.get("OPENAI_API_KEY"),
)

response = client.responses.create(
    model="gpt-5.5",
    instructions="You are a coding assistant that talks like a pirate.",
    input="How do I check if a Python object is an instance of a class?",
)

print(response.output_text)
```

两个要点：

- `instructions` 相当于"系统指令"，告诉模型以什么身份、风格回答（Chat Completions 里对应的角色消息见下一篇）；
- `response.output_text` 是 SDK 提供的便捷属性，直接取出第一条文本输出，免去遍历结构。

Cookbook 的示例则演示了最裸的形态——只给 `input`：

```python
response = client.responses.create(
    model="gpt-4o-mini",
    input="tell me a joke",
)
print(response.output[0].content[0].text)
```

输出（Cookbook 原始运行结果）：

```text
Why did the scarecrow win an award?
Because he was outstanding in his field!
```

`response.output` 是一个列表：模型的一次回答可能包含多个输出项（文本、工具调用等），`output[0].content[0].text` 是手工取第一项文本的方式；日常用 `output_text` 即可。

## 四、Chat Completions：长期支持的对照写法

同样的任务在 Chat Completions 里长这样——输入从 `input` 字符串变成 `messages` 消息列表：

```python
from openai import OpenAI

client = OpenAI()

completion = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "developer", "content": "Talk like a pirate."},
        {
            "role": "user",
            "content": "How do I check if a Python object is an instance of a class?",
        },
    ],
)

print(completion.choices[0].message.content)
```

两条 API 的对应关系先建立直觉（细节在后续篇章展开）：

**表：Responses API 与 Chat Completions 首次调用对照**

| 维度 | Responses API | Chat Completions |
| --- | --- | --- |
| 方法 | `client.responses.create` | `client.chat.completions.create` |
| 输入 | `input`（字符串或消息列表） | `messages`（消息列表） |
| 系统指令 | `instructions` 参数 / `system` 角色 | `system` / `developer` 角色 |
| 取回文本 | `response.output_text` | `completion.choices[0].message.content` |
| 会话状态 | 可由 API 保存（`previous_response_id`，见第 02 篇） | 应用自己维护 `messages` 列表 |

## 五、异步客户端

把 `OpenAI` 换成 `AsyncOpenAI`，每个调用前加 `await` 即可，功能完全一致：

```python
import os
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),  # 默认值，可省略
)


async def main() -> None:
    response = await client.responses.create(
        model="gpt-5.5", input="Explain disestablishmentarianism to a smart five year old."
    )
    print(response.output_text)


asyncio.run(main())
```

异步写法在 Web 服务（本模块第 13 篇的 FastAPI）与高并发批处理场景中是标配。

## 六、Responses API 的差异化能力：有状态与托管工具

Cookbook 的这篇示例解释了为什么 OpenAI 要推 Responses API——它为多轮交互、托管工具（hosted tools）与精细的上下文控制而生：

**1. API 侧保存会话状态。** 每个响应有 `id`，可随时取回，包含完整上下文：

```python
fetched_response = client.responses.retrieve(
    response_id=response.id
)

print(fetched_response.output[0].content[0].text)
```

**2. 用 `previous_response_id` 续接对话。** 不用手动重发历史消息：

```python
response_two = client.responses.create(
    model="gpt-4o-mini",
    input="tell me another",
    previous_response_id=response.id
)
print(response_two.output[0].content[0].text)
```

输出：

```text
Why don't skeletons fight each other?
They don't have the guts!
```

**3. 从任意节点"分叉"对话。** 让两条新对话共享同一个父响应：

```python
response_two_forked = client.responses.create(
    model="gpt-4o-mini",
    input="I didn't like that joke, tell me another and tell me the difference between the two jokes",
    previous_response_id=response.id  # 从第一个响应分叉续接
)
```

**4. 托管工具。** 传入 `web_search` 等工具类型，模型在服务端自动调用，无需你自己执行：

```python
response = client.responses.create(
    model="gpt-4o",  # 或其他支持该工具的模型
    input="What's the latest news about AI?",
    tools=[
        {
            "type": "web_search"
        }
    ]
)
```

响应的 `output` 里会交替出现 `web_search_call`（搜索动作）与 `message`（带引用注释的回答）两种输出项。

多模态输入也可以在一条请求里完成——图片 + 文本 + 工具的组合（`input_image` 内容块的用法详见本模块第 07 篇）：

```python
response_multimodal = client.responses.create(
    model="gpt-4o",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text":
                 "Come up with keywords related to the image, and search on the web using the search tool for any news related to the keywords"
                 ", summarize the findings and cite the sources."},
                {"type": "input_image", "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Cat_August_2010-4.jpg/2880px-Cat_August_2010-4.jpg"}
            ]
        }
    ],
    tools=[
        {"type": "web_search"}
    ]
)
```

Cookbook 对两种 API 的工作流差异总结得很到位：同样"看图 + 联网搜索 + 总结"，Responses API 一条请求即可完成；Chat Completions 则需要应用自己执行工具调用、再追加一轮请求把结果喂回去。

## 七、本篇小结

- 安装 `openai`，Key 走 `.env`（模块 0 方案），客户端默认读环境变量；
- Responses API 是主接口：`client.responses.create(model, input)` + `response.output_text`；
- Chat Completions 长期支持：`messages` 列表 + `choices[0].message.content`；
- Responses API 额外提供 API 侧会话状态（`retrieve` / `previous_response_id`）与托管工具；
- 异步用 `AsyncOpenAI`。

下一篇我们把 `messages` / `input` 的角色体系与多轮会话管理讲透。
