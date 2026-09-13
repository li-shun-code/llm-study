---
title: LangGraph 入门：用 Graph API 与 Functional API 构建你的第一个智能体
source_url: https://docs.langchain.com/oss/python/langgraph/quickstart
author: LangChain 团队（LangGraph 官方文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: LangGraph 1.x（docs.langchain.com 当前版）
order: 13
---

# 快速开始

本快速入门演示如何用 LangGraph 的 **Graph API** 或 **Functional API** 构建一个计算器智能体（Agent）。

- **使用 Graph API**：如果你喜欢把智能体定义为"节点 + 边"组成的图。
- **使用 Functional API**：如果你喜欢把智能体定义为单个函数。

概念性介绍参见官方 [Graph API 概览](https://docs.langchain.com/oss/python/langgraph/graph-api) 与 [Functional API 概览](https://docs.langchain.com/oss/python/langgraph/functional-api)。

> **信息**：本示例需要一个 [Claude (Anthropic)](https://www.anthropic.com/) 账号与 API Key，并在终端设置 `ANTHROPIC_API_KEY` 环境变量（API Key 管理方式参见本站模块 0 的 .env 方案）。所有可用的聊天模型提供商参见官方 [chat model integrations](https://docs.langchain.com/oss/python/integrations/chat) 页。中文读者也可以用任何 OpenAI 兼容端点替换 `init_chat_model` 的模型参数。

先安装依赖：

```bash
pip install -U langgraph langchain
```

# 路线一：使用 Graph API

## 第 1 步：定义工具与模型

本示例使用 Claude Sonnet 模型，并定义加法、乘法、除法三个工具：

```python
from langchain.tools import tool
from langchain.chat_models import init_chat_model


model = init_chat_model(
    "claude-sonnet-4-6",
    temperature=0
)


# 定义工具
@tool
def multiply(a: int, b: int) -> int:
    """Multiply `a` and `b`.

    Args:
        a: First int
        b: Second int
    """
    return a * b


@tool
def add(a: int, b: int) -> int:
    """Adds `a` and `b`.

    Args:
        a: First int
        b: Second int
    """
    return a + b


@tool
def divide(a: int, b: int) -> float:
    """Divide `a` and `b`.

    Args:
        a: First int
        b: Second int
    """
    return a / b


# 把工具增强给 LLM
tools = [add, multiply, divide]
tools_by_name = {tool.name: tool for tool in tools}
model_with_tools = model.bind_tools(tools)
```

## 第 2 步：定义状态

图的状态（State）用于存储消息列表和 LLM 调用次数：

```python
from langchain.messages import AnyMessage
from typing_extensions import TypedDict, Annotated
import operator


class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int
```

> **提示**：LangGraph 的状态在智能体的整个执行过程中持久存在。`Annotated` 类型配合 `operator.add`，确保新消息是**追加**到现有列表，而不是替换它——这就是模块 1 数据结构里"半群/monoid 归并"思想在状态合并上的应用。

## 第 3 步：定义模型节点

模型节点负责调用 LLM，并决定是否调用工具：

```python
from langchain.messages import SystemMessage


def llm_call(state: dict):
    """LLM 决定是否调用工具"""

    return {
        "messages": [
            model_with_tools.invoke(
                [
                    SystemMessage(
                        content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
                    )
                ]
                + state["messages"]
            )
        ],
        "llm_calls": state.get('llm_calls', 0) + 1
    }
```

## 第 4 步：定义工具节点

工具节点负责真正执行工具调用并返回结果：

```python
from langchain.messages import ToolMessage


def tool_node(state: dict):
    """执行工具调用"""

    result = []
    for tool_call in state["messages"][-1].tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    return {"messages": result}
```

## 第 5 步：定义结束逻辑

条件边（Conditional Edge）函数根据"LLM 是否发起了工具调用"来决定路由到工具节点还是结束：

```python
from typing import Literal
from langgraph.graph import StateGraph, START, END


def should_continue(state: MessagesState) -> Literal["tool_node", END]:
    """根据 LLM 是否发起了工具调用，决定继续循环还是停止"""

    messages = state["messages"]
    last_message = messages[-1]

    # 如果 LLM 发起了工具调用，就执行动作
    if last_message.tool_calls:
        return "tool_node"

    # 否则停止（回复用户）
    return END
```

## 第 6 步：构建并编译智能体

用 `StateGraph` 类构建智能体，用 `compile` 方法编译：

```python
# 构建工作流
agent_builder = StateGraph(MessagesState)

# 添加节点
agent_builder.add_node("llm_call", llm_call)
agent_builder.add_node("tool_node", tool_node)

# 添加边连接节点
agent_builder.add_edge(START, "llm_call")
agent_builder.add_conditional_edges(
    "llm_call",
    should_continue,
    ["tool_node", END]
)
agent_builder.add_edge("tool_node", "llm_call")

# 编译智能体
agent = agent_builder.compile()
```

这个图是一个典型的 ReAct 循环：`llm_call` →（有工具调用？）→ `tool_node` → 回到 `llm_call`……直到没有工具调用、走到 `END`。

## 第 7 步：运行

```python
# 可视化（Jupyter 中）
from IPython.display import Image, display
display(Image(agent.get_graph(xray=True).draw_mermaid_png()))

# 调用
from langchain.messages import HumanMessage
messages = [HumanMessage(content="Add 3 and 4.")]
messages = agent.invoke({"messages": messages})
for m in messages["messages"]:
    m.pretty_print()
```

> **提示**：可以用 [LangSmith](https://smith.langchain.com) 追踪和调试你的智能体（详见本模块第 16 篇）。

恭喜！你已经用 LangGraph Graph API 构建了第一个智能体。

# 路线二：使用 Functional API

Functional API 不显式定义节点和边，而是在**单个函数里写普通控制流**（循环、条件），同时保留 LangGraph 的持久化、流式等能力。

## 第 1 步：定义工具与模型

与 Graph API 完全相同（见上文第 1 步），再补充 Functional API 的导入：

```python
from langgraph.graph import add_messages
from langchain.messages import (
    SystemMessage,
    HumanMessage,
    ToolCall,
)
from langchain_core.messages import BaseMessage
from langgraph.func import entrypoint, task
```

## 第 2 步：用 @task 定义模型调用

`@task` 装饰器把函数标记为可在智能体中执行的任务；任务可以在入口函数内同步或异步调用：

```python
@task
def call_llm(messages: list[BaseMessage]):
    """LLM 决定是否调用工具"""
    return model_with_tools.invoke(
        [
            SystemMessage(
                content="You are a helpful assistant tasked with performing arithmetic on a set of inputs."
            )
        ]
        + messages
    )
```

## 第 3 步：用 @task 定义工具调用

```python
@task
def call_tool(tool_call: ToolCall):
    """执行工具调用"""
    tool = tools_by_name[tool_call["name"]]
    return tool.invoke(tool_call)
```

## 第 4 步：用 @entrypoint 定义智能体

```python
@entrypoint()
def agent(messages: list[BaseMessage]):
    model_response = call_llm(messages).result()

    while True:
        if not model_response.tool_calls:
            break

        # 并发执行工具
        tool_result_futures = [
            call_tool(tool_call) for tool_call in model_response.tool_calls
        ]
        tool_results = [fut.result() for fut in tool_result_futures]
        messages = add_messages(messages, [model_response, *tool_results])
        model_response = call_llm(messages).result()

    messages = add_messages(messages, model_response)
    return messages

# 调用
messages = [HumanMessage(content="Add 3 and 4.")]
stream = agent.stream_events(messages, version="v3")
for snapshot in stream.values:
    print(snapshot)
    print("\n")
```

注意 `while True` 循环就是 ReAct 循环本身——这就是 Functional API 的哲学：**把图的拓扑藏进普通 Python 控制流**，更适合逻辑直白的场景；而 Graph API 的显式拓扑更适合需要可视化、需要精细控制中断/并行/子图的复杂系统。

# 两种 API 怎么选

| 维度 | Graph API | Functional API |
| --- | --- | --- |
| 心智模型 | 节点 + 边的显式图 | 单函数内的普通控制流 |
| 循环/分支 | 条件边（`add_conditional_edges`） | `while`/`if` |
| 可视化 | `get_graph().draw_mermaid_png()` 直接出图 | 需自行梳理 |
| 中断恢复（HITL） | 图拓扑上标注 `interrupt` | 同样支持（见下一篇） |
| 适合场景 | 复杂多角色工作流、需要审批/检查点 | 快速原型、逻辑简单的循环智能体 |

**表：LangGraph 两种 API 的对比。**

两条路线共享同一套底层运行时：检查点持久化（第 8 篇记忆机制）、中断（下一篇 Human-in-the-loop）、流式输出与 LangSmith 追踪。掌握其中一条，另一条只是"组织代码的方式"不同。

---

> **来源**：本文翻译自 LangGraph 官方文档 [Quickstart](https://docs.langchain.com/oss/python/langgraph/quickstart)，作者 LangChain 团队，许可 MIT。抓取于 2026-09-13。本文按 LangGraph 1.x 当前 API 翻译（`langchain.messages`、`init_chat_model`、`@entrypoint`/`@task` 等新写法；旧版教程中的 `create_react_agent` 快捷方式与 `langchain_core.messages` 导入路径已在 1.x 中更新）。原文另含 TypeScript 版本与给 AI 编程助手使用的 Prompt 模板，译文从略。
