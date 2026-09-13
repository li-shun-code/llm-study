---
title: 实战：命令行聊天机器人
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_stream_completions.ipynb
author: OpenAI Cookbook（How to stream completions、responses_example.ipynb）、OpenAI（openai-python README）
license: MIT / Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 17
versions: openai-python 2026-09 最新稳定版；Python 3.10+
---

这是模块 6 的收官实战：把前面学的**客户端初始化（01）、多轮会话（02）、流式输出（03）**组装成一个能跑起来的命令行聊天机器人（CLI chatbot）。目标体验：打字机效果逐字输出、支持多轮上下文、`/reset` 清空对话、`/quit` 退出。

## 一、准备

```text
# .env —— 模块 0 的方案
OPENAI_API_KEY=sk-...
```

```sh
pip install openai python-dotenv
```

## 二、版本一：Chat Completions + 应用自管历史

这是最经典的实现：`messages` 列表由程序维护，每轮把用户输入与模型回复依次追加——第 02 篇的多轮模式；输出用第 03 篇的流式循环与分块拼接：

```python
# chatbot_v1.py
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

SYSTEM = "你是一个简洁、友好的中文学习助手。"


def stream_reply(messages: list[dict]) -> str:
    """流式请求并逐字打印，返回拼接后的完整回复。"""
    response = client.chat.completions.create(
        model="gpt-5.5",
        messages=messages,
        stream=True,
    )
    collected = []  # 对应 Cookbook 的 collected_messages
    for chunk in response:
        delta = chunk.choices[0].delta.content
        if delta:
            print(delta, end="", flush=True)  # 打字机效果
            collected.append(delta)
    print()
    return "".join(collected)


def main() -> None:
    messages = [{"role": "developer", "content": SYSTEM}]
    print("命令行聊天机器人（/reset 清空对话，/quit 退出）")
    while True:
        try:
            user_input = input("\n你：").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not user_input:
            continue
        if user_input == "/quit":
            break
        if user_input == "/reset":
            messages = [{"role": "developer", "content": SYSTEM}]
            print("（对话已清空）")
            continue

        messages.append({"role": "user", "content": user_input})
        print("AI：", end="", flush=True)
        reply = stream_reply(messages)
        messages.append({"role": "assistant", "content": reply})  # 回答回填历史


if __name__ == "__main__":
    main()
```

对照知识点（均来自前面各篇）：

- `stream=True` + `delta.content` + 拼接：**第 03 篇**流式输出的标准循环（Cookbook 原文即用 `collected_messages` 收集、过滤 `None`、`''.join` 成全文）；
- `role: "developer"` 系统指令与历史回填：**第 02 篇**消息角色；
- 历史越滚越长，`usage.prompt_tokens` 会持续增长——观察并考虑裁剪策略（**第 09 篇**）。

## 三、版本二：Responses API + `previous_response_id`

第二版把"记住历史"的活儿交给 API——这正是 Cookbook `responses_example` 演示的有状态模式。程序里不再维护 `messages` 列表，只记一个 `previous_response_id`。流式助手改用 SDK 的 `client.responses.stream()` 上下文管理器（流结束后 `get_final_response()` 取回累积完成的响应对象，从中拿本轮 id）：

```python
# chatbot_v2.py
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()

INSTRUCTIONS = "你是一个简洁、友好的中文学习助手。"


def main() -> None:
    previous_response_id = None
    print("命令行聊天机器人 · Responses API 版（/quit 退出）")
    while True:
        try:
            user_input = input("\n你：").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not user_input or user_input == "/quit":
            break

        with client.responses.stream(
            model="gpt-5.5",
            instructions=INSTRUCTIONS,
            input=user_input,
            previous_response_id=previous_response_id,  # 首轮为 None，之后续接
        ) as stream:
            print("AI：", end="", flush=True)
            for event in stream:
                delta = getattr(event, "delta", None)
                if delta:
                    print(delta, end="", flush=True)
            # 流读完后取回完整响应（含 id），下一轮用它续接
            previous_response_id = stream.get_final_response().id


if __name__ == "__main__":
    main()
```

两个版本的取舍（与第 02 篇的对照表一致）：

**表：自管历史 vs API 托管状态**

| 维度 | 版本一（Chat Completions + messages） | 版本二（Responses + previous_response_id） |
| --- | --- | --- |
| 历史在哪 | 应用内存里，全量重发 | API 侧，客户端只存一个 id |
| 上下文控制 | 自由（裁剪/摘要/注入） | 依赖 `store` 与 API 能力 |
| 换模型/换厂商 | 任意 OpenAI 兼容端点（第 10 篇） | 需要 Responses API 支持 |
| 教学价值 | 理解无状态 API 的本质 | 体验有状态 API 的省心 |

## 四、继续打磨的方向

跑通之后，按模块 6 的知识地图逐项升级：

1. **工具调用**（第 04 篇）：加一个 `get_time` 或 `get_weather` 函数，体会"模型出参数、你执行"的循环；
2. **结构化输出**（第 06 篇）：让机器人在每轮回复末尾附一个 JSON 情绪标签；
3. **错误处理**（第 07 篇）：把请求包进 try/except，`RateLimitError` 提示稍后再试、`APIConnectionError` 自动重试；
4. **成本意识**（第 09 篇）：打印每轮 `usage`，估算一天的对话成本；
5. **服务化**（第 16 篇）：把逻辑搬进 FastAPI 的 `/chat/stream` 接口，终端只是它的一个客户端；
6. **前端化**：本站右上角的 AI 学习助手组件就是"浏览器版聊天机器人"（SSE 流式 + 本地加密存储配置），可对照阅读源码。

## 五、本篇小结

- 一个 CLI 聊天机器人 = 客户端初始化 + 会话循环 + 流式渲染，全部素材来自本模块前几篇；
- 版本一是"教科书式"无状态循环，版本二用 `previous_response_id` 把状态交给 API；
- `/reset` 的本质是丢掉历史（或换一个新 response id）；
- 从 CLI 到 Web 服务只差一个 FastAPI——模块 6 到此闭环，下一步进入模块 7 数据库（给聊天记录一个家）或模块 8 RAG（给机器人一个知识库）。

---

> **来源**：本文为实战篇，改编并翻译自 [How to stream completions](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_stream_completions.ipynb) 与 [responses_example.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb)（OpenAI Cookbook，MIT）及 [openai-python README](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。抓取于 2026-09-13。
> 代码组织与中文注释为本站编辑所加；所用原语（流式循环、分块拼接、`previous_response_id` 续接）均来自上述原文。
