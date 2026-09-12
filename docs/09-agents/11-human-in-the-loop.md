---
title: Human-in-the-Loop：用 LangGraph interrupt 实现中断、恢复与人工审批
source_url: https://docs.langchain.com/oss/python/langgraph/interrupts
author: LangChain 团队（LangGraph 官方文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: LangGraph 1.x（docs.langchain.com 当前版，stream_events v3 API）
order: 11
---

> **来源**：本文翻译自 LangGraph 官方文档 [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)，作者 LangChain 团队，许可 MIT。抓取于 2026-09-13。原文部分完整示例以折叠块形式重复内联代码，译文保留全部模式与关键代码、省略重复折叠示例；LangSmith 示例追踪链接见原文。

# 中断（Interrupts）

中断允许你在特定位置暂停图的执行，等待外部输入后再继续。这是实现 **Human-in-the-Loop（HITL，人在回路）** 模式的基础：当你需要外部输入才能往下走时，就用中断。中断被触发时，LangGraph 用它的[持久化](https://docs.langchain.com/oss/python/langgraph/persistence)层保存图状态，并无限期等待，直到你恢复执行。

中断的工作方式：在图节点的**任意位置**调用 `interrupt()` 函数。函数接受任何可 JSON 序列化的值，并把它呈现给调用方。准备好继续时，用 `Command` 重新调用图来恢复执行——你传入的值会成为节点内 `interrupt()` 调用的返回值。

与静态断点（在特定节点之前或之后暂停）不同，中断是**动态的**：可以放在代码的任何地方，还可以根据应用逻辑条件触发。

三个关键机制：

- **检查点保住现场**：检查点器写入确切的图状态，让你稍后可以恢复——即使处于错误状态；
- **`thread_id` 是你的指针**：设置 `config={"configurable": {"thread_id": ...}}` 告诉检查点器加载哪份状态；
- **中断载荷通过 `stream.interrupts` 呈现**：使用事件流（`graph.stream_events(..., version="v3")`）时，传给 `interrupt()` 的值出现在 `stream.interrupts` 上；运行因等待输入而暂停时 `stream.interrupted` 为 `True`。

你选择的 `thread_id` 实际上就是一个持久游标：复用它就恢复同一检查点；用新值则开启一条全新线程、全新状态。

# 用 interrupt 暂停

`interrupt` 函数暂停图执行并把一个值返回给调用方。在节点内调用它时，LangGraph 保存当前图状态并等待你恢复：

使用 `interrupt` 需要：

1. 一个**检查点器**来持久化图状态（生产环境用持久化检查点器）；
2. config 中的**线程 ID**，让运行时知道从哪份状态恢复；
3. 在想暂停的位置调用 `interrupt()`（载荷必须可 JSON 序列化）。

```python
from langgraph.types import interrupt

def approval_node(state: State):
    # 暂停并请求审批
    approved = interrupt("Do you approve this action?")
    # 恢复时，Command(resume=...) 的值会作为这里 interrupt() 的返回值
    return {"approved": approved}
```

调用 `interrupt` 后发生的事情：

1. **图执行在调用点被挂起**；
2. **状态被保存**（借助检查点器）以便稍后恢复——生产环境应使用持久化检查点器（如数据库后端）；
3. **值被返回给调用方**：事件流 API 下出现在 `stream.interrupts`，默认 `invoke()` API 下在 `result["__interrupt__"]`；值可以是任何可 JSON 序列化的东西（字符串、对象、数组等）；
4. **图无限期等待**，直到你带着响应恢复执行；
5. **响应被传回节点**，成为 `interrupt()` 调用的返回值。

# 恢复执行

中断暂停执行后，用包含恢复值的 `Command` 再次调用图来恢复。恢复值被传回 `interrupt` 调用处，节点带着外部输入继续执行。

推荐用事件流驱动可能中断的图——它通过 `stream.interrupts`/`stream.interrupted` 呈现中断，并通过 `stream.output` 暴露最终状态：

```python
from langgraph.types import Command

# 首次运行 - 触发中断并暂停
# thread_id 是持久指针（生产环境应存一个稳定 ID）
config = {"configurable": {"thread_id": "thread-1"}}
stream = graph.stream_events({"input": "data"}, config=config, version="v3")

# 排空流以驱动运行；stream.output 给出最终状态
final = stream.output

# 运行因等待人工输入暂停时 stream.interrupted 为 True，
# stream.interrupts 包含传给 interrupt() 的载荷
if stream.interrupted:
    print(stream.interrupts)
    # > (Interrupt(value='Do you approve this action?'),)

# 带人工的响应恢复
# 恢复载荷成为节点内 interrupt() 的返回值
resumed = graph.stream_events(Command(resume=True), config=config, version="v3")
final = resumed.output
```

> **注**：默认的 `graph.invoke(...)` API 仍然可用，中断出现在 `result["__interrupt__"]` 下。不需要流式投影时可以用它；否则优先用 `graph.stream_events(..., version="v3")`。

**关于恢复的要点**：

- 恢复时必须使用与中断发生时**相同的线程 ID**；
- 传给 `Command(resume=...)` 的值会成为 `interrupt` 调用的返回值；
- 恢复时节点**从头重新执行**，因此 `interrupt()` 之前的代码会再跑一遍；
- 恢复值可以是任何可 JSON 序列化的值。

> **警告**：`Command(resume=...)` 是唯一设计用于 `invoke()`/`stream()`/`stream_events()` 输入的 `Command` 模式。`Command` 的其他参数（`update`、`goto`、`graph`）是为"从节点函数返回"设计的——不要用 `Command(update=...)` 作为输入来继续多轮对话，应传普通输入字典。

# 常见模式

中断解锁的核心能力是"暂停并等待外部输入"，典型用例：

- **审批工作流**：在执行关键动作（API 调用、数据库变更、金融交易）前暂停；
- **处理多个中断**：一次恢复中把中断 ID 与恢复值配对；
- **审查与编辑**：让人类在继续之前审查、修改 LLM 输出或工具调用；
- **中断工具调用**：在工具执行前暂停，审查/编辑这次调用；
- **校验人工输入**：继续下一步之前校验人工输入的合法性。

## 带 HITL 中断的流式交互

构建交互式智能体时，可以用事件流并发地消费消息块与状态快照，同时处理中断——循环使用 `stream_events` 直到运行结束：

```python
from langgraph.types import Command

stream_input: dict | Command = initial_input
while True:
    stream = graph.stream_events(stream_input, config=config, version="v3")
    # 流式接收 LLM 消息块（含子图中的）
    for message in stream.messages:
        for token in message.text:
            display_streaming_content(token)
    # 运行结束（或暂停）后，检查中断并恢复
    if not stream.interrupted:
        final_state = stream.output
        break
    interrupt_info = stream.interrupts[0].value
    user_response = get_user_input(interrupt_info)
    stream_input = Command(resume=user_response)
```

- **`stream.messages`**：聊天模型输出的内容块；遍历 `message.text` 得到 token 增量；嵌套子图从 `stream.subgraphs[*].messages` 读取；
- **`stream.values`**：每步之后的完整状态快照；
- **`stream.interrupted` / `stream.interrupts`**：每次运行后检查是否暂停、读取载荷；
- **`Command(resume=...)`**：作为下一次 `stream_events` 的输入传入以恢复；循环直到不再中断。

## 处理多个中断

当并行分支同时中断（例如扇出到多个节点、每个都调用 `interrupt()`），可能需要在一次调用中恢复多个中断：把每个中断的 ID 映射到它的恢复值，确保每个响应在运行时与正确的中断配对。

```python
from typing import Annotated, TypedDict
import operator
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

class State(TypedDict):
    vals: Annotated[list[str], operator.add]

def node_a(state):
    answer = interrupt("question_a")
    return {"vals": [f"a:{answer}"]}

def node_b(state):
    answer = interrupt("question_b")
    return {"vals": [f"b:{answer}"]}

graph = (
    StateGraph(State)
    .add_node("a", node_a)
    .add_node("b", node_b)
    .add_edge(START, "a")
    .add_edge(START, "b")
    .add_edge("a", END)
    .add_edge("b", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "1"}}
# 第 1 步：驱动运行；两个并行节点都命中 interrupt() 并暂停
stream = graph.stream_events({"vals": []}, config, version="v3")
_ = stream.output  # 排空流

print(stream.interrupts)
# > (Interrupt(value='question_a', id='...'), Interrupt(value='question_b', id='...'))

# 第 2 步：一次性恢复所有待决中断
resume_map = {
    i.id: f"answer for {i.value}" for i in stream.interrupts
}
resumed = graph.stream_events(Command(resume=resume_map), config, version="v3")
print("Final state:", resumed.output)
# Final state: {'vals': ['a:answer for question_a', 'b:answer for question_b']}
```

## 审批或拒绝

中断最常见的用途：在关键动作前暂停请求审批。在节点内把问题和细节暴露给调用方，恢复后按布尔值路由：

```python
from typing import Literal
from langgraph.types import interrupt, Command

def approval_node(state: State) -> Command[Literal["proceed", "cancel"]]:
    # 暂停执行；载荷出现在 stream.interrupts（事件流）或 result["__interrupt__"]（invoke）
    is_approved = interrupt({
        "question": "Do you want to proceed with this action?",
        "details": state["action_details"]
    })
    # 按响应路由
    if is_approved:
        return Command(goto="proceed")
    else:
        return Command(goto="cancel")
```

恢复图时，传 `True` 批准、`False` 拒绝：

```python
# 批准
graph.stream_events(Command(resume=True), config=config, version="v3").output
# 拒绝
graph.stream_events(Command(resume=False), config=config, version="v3").output
```

完整图（审批节点 + proceed/cancel 两个分支节点，`InMemorySaver` 检查点）运行后：初始运行因 "Transfer $500"（转账 500 美元）暂停等待审批，`Command(resume=True)` 恢复后状态变为 `"approved"`。

## 审查并编辑状态

有时你想让人类在继续之前审查并修改部分图状态——用于纠正 LLM、补充缺失信息或做调整：

```python
from langgraph.types import interrupt

def review_node(state: State):
    # 暂停并展示当前内容供审查
    edited_content = interrupt({
        "instruction": "Review and edit this content",
        "content": state["generated_text"]
    })
    # 用编辑后的版本更新状态
    return {"generated_text": edited_content}
```

恢复时提供编辑后的内容（它成为 `interrupt()` 的返回值）：

```python
graph.stream_events(
    Command(resume="The edited and improved text"),
    config=config,
    version="v3",
).output
```

## 在工具内部中断

还可以把中断直接放进工具函数：工具每次被调用都会暂停，等人类审查、编辑之后再执行。

```python
from langchain.tools import tool
from langgraph.types import interrupt

@tool
def send_email(to: str, subject: str, body: str):
    """Send an email to a recipient."""
    # 发送前暂停；事件流下载荷出现在 stream.interrupts
    response = interrupt({
        "action": "send_email",
        "to": to,
        "subject": subject,
        "body": body,
        "message": "Approve sending this email?"
    })
    if response.get("action") == "approve":
        # 恢复值可以在执行前覆盖输入
        final_to = response.get("to", to)
        final_subject = response.get("subject", subject)
        final_body = response.get("body", body)
        return f"Email sent to {final_to} with subject '{final_subject}'"
    return "Email cancelled by user"
```

这种做法让审批逻辑内聚在工具本身，可在图的不同位置复用：LLM 自然地发起工具调用，中断在工具被调用的瞬间暂停执行，你可以批准、编辑或取消该动作。例如恢复时传 `Command(resume={"action": "approve", "subject": "Updated subject"})`，即可"批准的同时修改邮件主题"。

## 校验人工输入

需要校验人类输入、无效时重新询问时，推荐模式是：**每次节点调用只调用一次 `interrupt()`**，把错误信息存进状态后从节点返回，再用**条件边**循环回该节点，直到拿到合法值。

> **警告**：避免在单个节点内写 `while True` + `interrupt()` 循环。因为每次恢复时节点都从头重跑，多次调用 `interrupt()` 的循环会导致每次恢复重放之前所有迭代：第一次恢复重放 1 次迭代、第二次重放 2 次……循环体内代码呈指数级重复执行。

正确模式：

1. 把追问的问题存进状态（如 `pending_question`）；
2. 节点内**只调用一次** `interrupt()`，传入状态里的当前问题；
3. 答案非法时，返回更新后的 `pending_question`，让下一次调用重新提问；
4. 用 `add_conditional_edges` 把图路由回该节点，直到收集到合法值。

```python
from typing import TypedDict
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

class FormState(TypedDict):
    age: int | None
    pending_question: str | None

def get_age_node(state: FormState):
    question = state.get("pending_question") or "What is your age?"
    answer = interrupt(question)  # 每次调用只调用一次
    if isinstance(answer, int) and answer > 0:
        return {"age": answer, "pending_question": None}
    return {"pending_question": f"'{answer}' is not a valid age. Please enter a positive number."}

def route(state: FormState):
    return END if state.get("age") is not None else "collect_age"

builder = StateGraph(FormState)
builder.add_node("collect_age", get_age_node)
builder.add_edge(START, "collect_age")
builder.add_conditional_edges("collect_age", route)
```

每次恢复只触发一次 `get_age_node`、执行一次 `interrupt()` 并退出。答案非法时条件边绕回，下一次中断带着更新后的问题重新询问——任何代码都不会在单次恢复中运行超过一次。

# 中断的规则

在节点内调用 `interrupt` 时，LangGraph 通过抛出一个特殊异常来挂起执行，通知运行时暂停。该异常沿调用栈向上传播，由运行时捕获并保存状态、等待外部输入。**恢复执行时，运行时从节点开头重新启动整个节点**——不是从 `interrupt()` 被调用的那一行继续。因此 `interrupt()` 之前运行过的代码都会再次执行。由此有几条重要规则。

## 不要用 try/except 包裹 interrupt 调用

`interrupt` 靠抛出特殊异常来在调用点暂停执行。用 try/except 包住它会把这个异常捕获掉，中断就不会传回图。

```python
def node_a(state: State):
    # ✅ 好：先中断，再单独处理易错代码
    interrupt("What's your name?")
    try:
        fetch_data()  # 这里可能失败
    except Exception as e:
        print(e)
    return state
```

或者捕获具体异常类型（不会误捕中断异常）：

```python
def node_a(state: State):
    try:
        name = interrupt("What's your name?")
        fetch_data()  # 这里可能失败
    except NetworkException as e:
        print(e)
    return state
```

反面示例（🔴）：

```python
def node_a(state: State):
    # ❌ 差：裸 try/except 会捕获中断异常
    try:
        interrupt("What's your name?")
    except Exception as e:
        print(e)
    return state
```

## 不要在节点内打乱 interrupt 调用的顺序

一个节点里可以有多个中断调用，但处理不当会有意外行为。节点含多个 `interrupt` 调用时，LangGraph 为执行该节点的任务维护一份恢复值列表；每次恢复都从节点开头重新执行，每遇到一个中断就检查恢复列表中是否有匹配值——匹配**严格按索引**进行，所以节点内中断调用的顺序至关重要。

```python
def node_a(state: State):
    # ✅ 好：interrupt 调用每次执行都保持相同顺序
    name = interrupt("What's your name?")
    age = interrupt("What's your age?")
    city = interrupt("What's your city?")
    return {"name": name, "age": age, "city": city}
```

反面示例（🔴）：

```python
def node_a(state: State):
    # ❌ 差：条件跳过 interrupt 会改变顺序
    name = interrupt("What's your name?")
    # 首次运行可能跳过这个中断；恢复时可能不跳过——导致索引错位
    if state.get("needs_age"):
        age = interrupt("What's your age?")
    city = interrupt("What's your city?")
    return {"name": name, "city": city}

def node_a(state: State):
    # ❌ 差：基于非确定性数据的循环（两次执行之间中断数量会变）
    results = []
    for item in state.get("dynamic_list", []):  # 列表可能在运行间变化
        result = interrupt(f"Approve {item}?")
        results.append(result)
    return {"results": results}
```

如果需要循环式确认，应改用条件边（见"校验人工输入"一节）。

## 不要在 interrupt 中传复杂值

取决于所用检查点器，复杂值可能无法序列化（比如函数）。为了让图适配任何部署，最佳实践是只传"可合理序列化"的值。

```python
def node_a(state: State):
    # ✅ 好：可序列化的简单类型
    name = interrupt("What's your name?")
    count = interrupt(42)
    approved = interrupt(True)
    return {"name": name, "count": count, "approved": approved}

def node_a(state: State):
    # ✅ 好：简单值组成的字典
    response = interrupt({
        "question": "Enter user details",
        "fields": ["name", "email", "age"],
        "current_values": state.get("user", {})
    })
    return {"user": response}
```

反面示例（🔴）：不要把函数、类实例等复杂对象传给 `interrupt`——它们无法被序列化，恢复时会失败。

## interrupt 之前的副作用必须是幂等的

因为中断靠"重跑所在节点"实现，`interrupt()` 之前调用的副作用（理想情况下）应当**幂等（Idempotent）**——同一操作执行多次，结果与执行一次相同。

例如节点里有一个"更新记录"的 API 调用，若 `interrupt()` 在该调用之后才发生，恢复时会重跑多次，可能覆盖初始更新或创建重复记录。

```python
def node_a(state: State):
    # ✅ 好：upsert 是幂等操作，重跑结果一致
    db.upsert_user(
        user_id=state["user_id"],
        status="pending_approval"
    )
    approved = interrupt("Approve this change?")
    return {"approved": approved}

def node_a(state: State):
    # ✅ 好：把副作用放在 interrupt 之后，批准后只执行一次
    approved = interrupt("Approve this change?")
    if approved:
        db.create_audit_log(
            user_id=state["user_id"],
            action="approved"
        )
    return {"approved": approved}

def approval_node(state: State):
    # ✅ 好：这个节点只处理中断
    approved = interrupt("Approve this change?")
    return {"approved": approved}

def notification_node(state: State):
    # ✅ 好：副作用放在独立节点，批准后才执行、只执行一次
    if (state.approved):
        send_notification(
            user_id=state["user_id"],
            status="approved"
        )
    return state
```

反面示例（🔴）：在 `interrupt` 之前创建新记录、追加历史——每次恢复都会重复执行，产生重复数据。

# 与"作为函数调用的子图"配合

在节点内调用子图时，父图会从**调用子图的那个节点的开头**恢复执行；子图同样会从触发 `interrupt` 的节点开头恢复。也就是说，子图调用点之前的父节点代码、以及子图节点内中断之前的代码，恢复时都会重新执行——设计时同样要遵守幂等原则。

# 用静态中断调试

调试和测试图时，可以用**静态中断**（Static Interrupts）当断点，逐节点单步执行。静态中断在节点执行前或执行后的固定位置触发，通过编译参数 `interrupt_before` / `interrupt_after` 设置。

> **注**：静态中断**不推荐**用于 Human-in-the-Loop 工作流——请用 `interrupt` 函数。

```python
graph = builder.compile(
    interrupt_before=["node_a"],
    interrupt_after=["node_b", "node_c"],
    checkpointer=checkpointer,
)
# 运行到断点
config = {"configurable": {"thread_id": "some_thread"}}
graph.invoke(inputs, config=config)
# 恢复：输入传 None，运行到下一个断点
graph.invoke(None, config=config)
```

要点：断点也可以在运行时通过 `graph.invoke(inputs, interrupt_before=[...], interrupt_after=[...], config=config)` 传入，每次调用可以不同；启用断点必须有检查点器。用 [LangSmith Studio](https://docs.langchain.com/langsmith/studio) 还可以在 UI 里设置静态中断、并检查执行中任意时点的图状态。

# 小结

`interrupt()` + `Command(resume=...)` + 检查点器，构成了 LangGraph 生产级 HITL 的三件套：

- **审批/拒绝**：转账、删库、对外发送等高危动作前挂起等人拍板；
- **审查/编辑**：人可以直接改写状态或工具参数，再放行；
- **输入校验**：配合条件边安全地反复追问；
- **多中断恢复**：按中断 ID 配对恢复值，支持并行分支同时挂起。

记住四条军规：别包裸 try/except、别打乱中断顺序、只传可序列化值、中断前副作用要幂等——这四条覆盖了中断在生产环境里绝大多数"灵异问题"。
