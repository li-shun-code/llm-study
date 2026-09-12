---
title: Agent 记忆机制：LangGraph 的短期记忆与长期记忆
source_url: https://docs.langchain.com/oss/python/langgraph/add-memory
author: LangChain 团队（LangGraph 官方文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: LangGraph 1.x（docs.langchain.com 当前版）
order: 5
---

> **来源**：本文翻译自 LangGraph 官方文档 [Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)，作者 LangChain 团队，许可 MIT。抓取于 2026-09-13。原文为多数据库对照教程（Postgres/MongoDB/Redis/Oracle 各附同步/异步示例），译文保留全部概念与关键代码，省略了与 Postgres 示例同构的其他数据库变体代码及超长输出转储；需要时请查阅原文。

AI 应用需要**记忆（Memory）**来在多次交互之间共享上下文。在 LangGraph 中，你可以添加两种类型的记忆：

- **短期记忆（Short-term Memory）**：作为智能体**状态（State）**的一部分，支持多轮对话。
- **长期记忆（Long-term Memory）**：跨会话存储用户特定或应用级数据。

这个划分与 Lilian Weng 在本模块第 1 篇中提出的人脑记忆映射一致：短期记忆对应"上下文内学习"（这里由检查点机制持久化对话线程），长期记忆对应"外部向量存储"（这里由 Store 提供）。

# 添加短期记忆

**短期记忆**（线程级持久化，Thread-level Persistence）让智能体能跟踪多轮对话。用法是在编译图时挂一个**检查点器（Checkpointer）**，并在每次调用时传入 `thread_id`：

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph

checkpointer = InMemorySaver()

builder = StateGraph(...)
graph = builder.compile(checkpointer=checkpointer)

graph.invoke(
    {"messages": [{"role": "user", "content": "hi! i am Bob"}]},
    {"configurable": {"thread_id": "1"}},
)
```

`InMemorySaver` 把状态保存在内存里，适合开发与测试。同一个 `thread_id` 的多次调用共享同一份对话状态——第二轮问 "what's my name?" 时，模型能答出 "Bob"。

## 在生产环境中使用

生产环境应使用数据库支持的检查点器，例如 Postgres：

```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    builder = StateGraph(...)
    graph = builder.compile(checkpointer=checkpointer)
```

LangGraph 官方生态还提供 MongoDB（`langgraph-checkpoint-mongodb`）、Redis（`langgraph-checkpoint-redis`）、Oracle（`langgraph-oracledb`）等检查点器实现，API 形状与 Postgres 版一致（`from_conn_string` + 编译时传入）。使用数据库版检查点器时，首次使用前需要调用一次 `checkpointer.setup()` 来初始化表结构。

一个完整的生产示例（同步版，异步版只需把 `invoke` 换成 `ainvoke` 系列方法）：

```python
from langchain.chat_models import init_chat_model
from langgraph.graph import StateGraph, MessagesState, START
from langgraph.checkpoint.postgres import PostgresSaver

model = init_chat_model(model="claude-haiku-4-5-20251001")

DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    # checkpointer.setup()  # 首次使用时执行

    def call_model(state: MessagesState):
        response = model.invoke(state["messages"])
        return {"messages": response}

    builder = StateGraph(MessagesState)
    builder.add_node(call_model)
    builder.add_edge(START, "call_model")

    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "1"}}

    stream = graph.invoke(
        {"messages": [{"role": "user", "content": "hi! I'm bob"}]},
        config,
    )
    stream = graph.invoke(
        {"messages": [{"role": "user", "content": "what's my name?"}]},
        config,
    )
```

## 在子图中使用

如果你的图包含子图（Subgraph），只需要在编译**父图**时提供检查点器——LangGraph 会自动把检查点器传播给子图：

```python
from langgraph.graph import START, StateGraph
from langgraph.checkpoint.memory import InMemorySaver
from typing import TypedDict

class State(TypedDict):
    foo: str

# 子图
def subgraph_node_1(state: State):
    return {"foo": state["foo"] + "bar"}

subgraph_builder = StateGraph(State)
subgraph_builder.add_node(subgraph_node_1)
subgraph_builder.add_edge(START, "subgraph_node_1")
subgraph = subgraph_builder.compile()

# 父图
...
builder = StateGraph(State)
builder.add_node("subgraph", subgraph)
builder.add_edge(START, "subgraph")
graph = builder.compile(checkpointer=InMemorySaver())
```

# 添加长期记忆

**长期记忆**用于跨对话（跨 `thread_id`）存储用户特定或应用特定的数据。LangGraph 用 **Store** 来承载它：

```python
from langgraph.store.memory import InMemoryStore
from langgraph.graph import StateGraph

store = InMemoryStore()

builder = StateGraph(...)
graph = builder.compile(store=store)
```

图以 `store=store` 编译后，LangGraph 会自动把 store 注入你的节点函数。当前推荐的访问方式是通过 `Runtime` 对象：

```python
from dataclasses import dataclass
from langgraph.runtime import Runtime
from langgraph.graph import StateGraph, MessagesState, START
import uuid

@dataclass
class Context:
    user_id: str

async def call_model(state: MessagesState, runtime: Runtime[Context]):
    user_id = runtime.context.user_id
    namespace = (user_id, "memories")

    # 按语义相似度检索该用户的记忆
    memories = await runtime.store.asearch(
        namespace, query=state["messages"][-1].content, limit=3
    )
    info = "\n".join([d.value["data"] for d in memories])

    # 写入一条新记忆
    await runtime.store.aput(
        namespace, str(uuid.uuid4()), {"data": "User prefers dark mode"}
    )

builder = StateGraph(MessagesState, context_schema=Context)
builder.add_node(call_model)
builder.add_edge(START, "call_model")
graph = builder.compile(store=store)

graph.invoke(
    {"messages": [{"role": "user", "content": "hi"}]},
    {"configurable": {"thread_id": "1"}},
    context=Context(user_id="1"),
)
```

要点：

- **命名空间（Namespace）**：Store 用元组形式的命名空间组织数据，如 `(user_id, "memories")`，实现"每个用户一份记忆"的隔离；
- **调用时传上下文**：`context=Context(user_id="1")` 在调用图时传入运行时上下文，节点内通过 `runtime.context` 读取；
- **生产环境**：用数据库支持的 Store，例如 `PostgresStore`（来自 `langgraph-checkpoint-postgres`，支持向量索引以启用语义检索）：

```python
from langgraph.store.postgres import PostgresStore

DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
with PostgresStore.from_conn_string(DB_URI) as store:
    builder = StateGraph(...)
    graph = builder.compile(store=store)
```

## 使用语义搜索

在图的记忆 Store 上启用语义搜索后，智能体可以按语义相似度检索 Store 中的条目，而不仅仅是按键取值：

```python
from langchain.embeddings import init_embeddings
from langgraph.store.memory import InMemoryStore

# 创建启用语义搜索的 store
embeddings = init_embeddings("openai:text-embedding-3-small")
store = InMemoryStore(
    index={
        "embed": embeddings,
        "dims": 1536,
    }
)
store.put(("user_123", "memories"), "1", {"text": "I love pizza"})
store.put(("user_123", "memories"), "2", {"text": "I am a plumber"})
items = store.search(
    ("user_123", "memories"), query="I'm hungry", limit=1
)
```

在智能体节点里结合语义搜索的长期记忆（异步写法）：

```python
from langchain.embeddings import init_embeddings
from langchain.chat_models import init_chat_model
from langgraph.store.memory import InMemoryStore
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.runtime import Runtime

model = init_chat_model("gpt-5.4-mini")

# 创建启用语义搜索的 store
embeddings = init_embeddings("openai:text-embedding-3-small")
store = InMemoryStore(
    index={
        "embed": embeddings,
        "dims": 1536,
    }
)
store.put(("user_123", "memories"), "1", {"text": "I love pizza"})
store.put(("user_123", "memories"), "2", {"text": "I am a plumber"})

async def chat(state: MessagesState, runtime: Runtime):
    # 基于用户最后一条消息做语义检索
    items = await runtime.store.asearch(
        ("user_123", "memories"),
        query=state["messages"][-1].content,
    )
    ...
```

这正是"向量存储 + 快速检索"在 Agent 记忆场景的落地——与本站模块 8 的向量检索一脉相承。

# 查看与操作检查点状态

短期记忆的本质是"线程状态快照（Checkpoint）"。你可以直接查看某个 `thread_id` 的当前状态与完整历史：

```python
# 查看当前状态快照
config = {"configurable": {"thread_id": "1"}}
graph.get_state(config)

# 查看线程的完整检查点历史
list(graph.get_state_history(config))

# 删除某线程的全部检查点
checkpointer.delete_thread("1")
```

`get_state` 返回的 `StateSnapshot` 包含当时的消息列表、元数据（写入来源、步骤号、时间戳）与父检查点指针；`get_state_history` 则按时间倒序列出整条"时间线"。这个能力是第 11 篇 Human-in-the-loop（中断恢复）与"时间旅行"（Time Travel）调试的基础。

# 数据库管理

使用任何数据库后端的持久化实现（Postgres、Redis、Oracle 等）存储短期/长期记忆时，需要先运行迁移（Migration）建立所需的表结构。按惯例，大多数数据库专用库都在检查点器或 Store 实例上定义了 `setup()` 方法来执行迁移；不同实现的方法名可能不同，请查阅你所用实现（`BaseCheckpointSaver` 或 `BaseStore` 的子类）的文档确认。官方建议把迁移作为独立的部署步骤执行，或保证其在服务器启动阶段运行。

# 小结

| 维度 | 短期记忆 | 长期记忆 |
| --- | --- | --- |
| 载体 | Checkpointer（检查点器） | Store |
| 作用域 | 单个对话线程（`thread_id`） | 跨线程、跨会话（按命名空间隔离） |
| 典型内容 | 对话消息、图状态 | 用户偏好、事实档案、应用级数据 |
| 检索方式 | 按线程回放状态 | 按命名空间 + 语义相似度搜索 |
| 开发实现 | `InMemorySaver` | `InMemoryStore` |
| 生产实现 | Postgres/MongoDB/Redis/Oracle Saver | Postgres Store（含向量索引）等 |

**表：LangGraph 两种记忆机制对比。**

工程实践中的组合拳是：短期记忆用检查点器维持对话连贯，长期记忆用 Store 沉淀"关于用户的一切"，并定期用 LLM 从对话中提炼记忆写入 Store（即"记忆固化"）；上下文窗口吃紧时，再把较旧的短期记忆摘要降级为长期记忆。
