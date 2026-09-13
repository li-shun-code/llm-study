---
title: 消息角色与多轮会话管理
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb
author: OpenAI Cookbook（How to format inputs to ChatGPT models、responses_example.ipynb）、OpenAI（openai-python README）
license: MIT / Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 2
versions: openai-python 2026-09 最新稳定版；原 notebook 基于 gpt-3.5-turbo/gpt-4 时代撰写，本站示例按现行 API 校订
---

聊天模型把**一系列消息（messages）**作为输入，返回一条模型生成的消息作为输出。这一篇讲清楚：消息有哪些角色、如何组织多轮对话、以及"谁来记住历史"的两种方案。

## 一、消息与角色

Chat Completions 的每条消息对象必填两个字段：

- `role`：发信者角色（`system` / `developer`、`user`、`assistant`、`tool`）；
- `content`：消息内容。

消息还可以带可选的 `name` 字段给发信者起名（如 `example-user`、`BlackbeardBot`），名字中不能有空格。

角色分工：

- **system / developer**：设定模型的行为方式与身份。openai-python README 的对照示例中使用了 `developer` 角色——这是现行文档对"开发者指令"的叫法，与老教程里的 `system` 语义相同（新模型更服从 `developer` 指令）；
- **user**：终端用户的输入；
- **assistant**：模型的历史回复；
- **tool**：工具调用结果（详见第 04 篇 Function Calling）。

一个典型的多轮请求（Knock-knock 冷笑话需要上下文才能接住）：

```python
# OpenAI Python 库请求示例
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "developer", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Knock knock."},
        {"role": "assistant", "content": "Who's there?"},
        {"role": "user", "content": "Orange."},
    ],
    temperature=0,
)
print(response.choices[0].message.content)
# 输出：Orange who?
```

注意第三条 `assistant` 消息：**对话历史里的模型回复必须原样回填**到请求里，模型才知道自己说过什么。

响应对象中值得认识的字段（原文以早期模型为例，字段沿用至今）：

- `id`：请求 ID；
- `choices`：候选列表（默认 1 个，`n` 参数可多个）；
  - `finish_reason`：停止原因——`stop`（自然结束）或 `length`（触达长度上限）；
  - `message`：模型生成的消息（`content` / `role` / `tool_calls`）；
- `usage`：本次请求消耗的 token 统计（prompt/completion/total）。

只要一行即可取出回复文本：

```python
response.choices[0].message.content
# 'Orange who?'
```

## 二、系统消息决定行为基调

原文用两个对照实验说明系统消息的威力——同一个问题，两种人设：

```python
# 引导模型深入讲解的系统消息
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "developer", "content": "You are a friendly and helpful teaching assistant. You explain concepts in great depth using simple terms, and you give examples to help people learn. At the end of each explanation, you ask a question to check for understanding"},
        {"role": "user", "content": "Can you explain how fractions work?"},
    ],
    temperature=0,
)
print(response.choices[0].message.content)
# 输出：长篇讲解分数概念，结尾还会提问检验理解
```

```python
# 引导模型只给简短回答的系统消息
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "developer", "content": "You are a laconic assistant. You reply with brief, to-the-point answers with no elaboration."},
        {"role": "user", "content": "Can you explain how fractions work?"},
    ],
    temperature=0,
)
print(response.choices[0].message.content)
# 输出：Fractions represent parts of a whole. They have a numerator (top number) and a denominator (bottom number).
```

系统提示词的设计方法论见模块 5《系统提示词设计》。

## 三、少样本对话示例（Few-shot）

有时"演示"比"描述"更有效——伪造几轮示例消息，让模型模仿模式。原文的"黑话翻译"例子：

```python
# 用伪造的少样本对话，引导模型把商业黑话翻译成大白话
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "developer", "content": "You are a helpful, pattern-following assistant."},
        {"role": "user", "content": "Help me translate the following corporate jargon into plain English."},
        {"role": "assistant", "content": "Sure, I'd be happy to!"},
        {"role": "user", "content": "New synergies will help drive top-line growth."},
        {"role": "assistant", "content": "Things working well together will increase revenue."},
        {"role": "user", "content": "Let's circle back when we have more bandwidth to touch base on opportunities for increased leverage."},
        {"role": "assistant", "content": "Let's talk later when we're less busy about how to do better."},
        {"role": "user", "content": "This late pivot means we don't have time to boil the ocean for the client deliverable."},
    ],
    temperature=0,
)
print(response.choices[0].message.content)
# 输出：This sudden change in direction means we don't have enough time to complete the entire project for the client.
```

为了让模型明确"示例消息不是真实对话、不要回头引用"，可以给示例消息加 `name` 标记，把 `system` 消息的 `name` 字段设为 `example_user` / `example_assistant`：

```python
response = client.chat.completions.create(
    model="gpt-5.5",
    messages=[
        {"role": "developer", "content": "You are a helpful, pattern-following assistant that translates corporate jargon into plain English."},
        {"role": "system", "name": "example_user", "content": "New synergies will help drive top-line growth."},
        {"role": "system", "name": "example_assistant", "content": "Things working well together will increase revenue."},
        {"role": "system", "name": "example_user", "content": "Let's circle back when we have more bandwidth to touch base on opportunities for increased leverage."},
        {"role": "system", "name": "example_assistant", "content": "Let's talk later when we're less busy about how to do better."},
        {"role": "user", "content": "This late pivot means we don't have time to boil the ocean for the client deliverable."},
    ],
    temperature=0,
)
```

## 四、多轮会话管理：谁来记住历史？

API 本身是无状态的——Chat Completions 每次调用都要把完整历史重新发一遍。应用侧最基础的管理方式就是维护一个列表、每轮追加：

```python
messages = [
    {"role": "developer", "content": "You are a helpful assistant."},
]
while True:
    user_input = input("你：")
    messages.append({"role": "user", "content": user_input})
    response = client.chat.completions.create(model="gpt-5.5", messages=messages)
    reply = response.choices[0].message.content
    messages.append({"role": "assistant", "content": reply})  # 回答回填历史
    print("AI：", reply)
```

历史越滚越长时，token 成本与上下文窗口都会成为瓶颈，因此要做"裁剪"或"摘要"（完整工程化讨论见第 10 篇成本优化与第 14 篇实战）。

**Responses API 提供了另一种答案：让 API 替你保存状态。** Cookbook 的 `responses_example` 演示了三种玩法：

```python
# 1) 每个响应有 id，可随时取回（含完整会话上下文）
fetched_response = client.responses.retrieve(response_id=response.id)
print(fetched_response.output[0].content[0].text)

# 2) 用 previous_response_id 续接，无需重发历史
response_two = client.responses.create(
    model="gpt-4o-mini",
    input="tell me another",
    previous_response_id=response.id
)

# 3) 从任意节点"分叉"出新对话分支
response_two_forked = client.responses.create(
    model="gpt-4o-mini",
    input="I didn't like that joke, tell me another",
    previous_response_id=response.id  # 以第一个响应为父节点
)
```

**表：两种会话管理方案对比**

| 方案 | 做法 | 适用场景 |
| --- | --- | --- |
| 应用自管历史 | 维护 `messages` 列表，每轮全量重发 | Chat Completions、需要完全掌控历史（裁剪/改写/注入） |
| API 托管状态 | Responses API + `previous_response_id` / `retrieve` | 多轮续接、分叉对话，省流量省代码 |

> 编者提示：API 托管状态依赖服务端存储（与 `store` 参数相关）；对数据保留有合规要求的应用，仍应选择自管历史。

## 五、Counting Tokens：预估历史开销

提交请求时，消息序列会被转换成 token 序列。原文给出一个用 tiktoken 估算消息列表 token 数的函数骨架（模型相关常量随模型而变，此处按现行模型示意——精确计数建议直接读响应的 `usage.prompt_tokens` 回填校准）：

```python
import tiktoken

def num_tokens_from_messages(messages, model="gpt-5.5"):
    """估算一批消息将消耗的 token 数（粗估，非精确值）。"""
    encoding = tiktoken.get_encoding("o200k_base")
    # 不同模型的每条消息固定开销不同，需按模型实测校准
    tokens_per_message = 3
    num_tokens = 0
    for message in messages:
        num_tokens += tokens_per_message
        for key, value in message.items():
            num_tokens += len(encoding.encode(str(value)))
    num_tokens += 3  # 每条回复都以 <|start|>assistant<|message|> 起始
    return num_tokens
```

> 编者注：原文函数针对 `gpt-3.5-turbo-0613` 等历史模型定义了精确常量；对现行模型，官方建议将此函数视为估算工具，并在生产中用 API 返回的 `usage` 字段校准。tiktoken 的完整讲解见模块 4《Token 与上下文窗口》。

## 六、本篇小结

- 消息 = `role` + `content`；角色有 developer/system、user、assistant、tool 四类；
- 多轮 = 把历史（含 assistant 回复）逐条回填进请求；
- 少样本可用伪造对话 + `name: example_user/example_assistant` 标注；
- 会话状态两条路线：应用自管 `messages`，或 Responses API 的 `previous_response_id` 托管；
- 用 tiktoken 估算、用 `usage` 校准，控制历史长度。

---

> **来源**：本文翻译自 [How to format inputs to ChatGPT models](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_format_inputs_to_ChatGPT_models.ipynb) 与 [responses_example.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb)（OpenAI Cookbook，MIT），并参考 [openai-python README](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。抓取于 2026-09-13。
> 编者注：原文示例基于 gpt-3.5-turbo/gpt-4 早期版本。消息角色的概念至今未变，但本站代码与参数说明已按现行 API（`developer` 角色、Responses API 会话状态）校订，过时细节（如 4K/8K 上下文上限）仅作历史对照。
