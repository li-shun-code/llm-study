---
title: "OpenAI Agents SDK 实战：从第一个 Agent 到交接、护栏与会话"
source_url: https://openai.github.io/openai-agents-python/
author: OpenAI（Agents SDK 官方文档与源码）
license: MIT
fetched_at: 2026-09-19
translated: true
versions: openai-agents 0.22.3（PyPI 当前版，Python >=3.10）；SDK 默认模型 gpt-5.6-luna（`agents.models.get_default_model()` 的返回值）
order: 18
group: 编排框架
---
## 它解决什么：把 Agent 循环的"脏活"标准化

手写一个 Agent 循环不难：调模型 → 有 tool_call 就执行 → 把结果塞回消息 → 再调模型。难的是循环之外的部分：**什么时候把控制权交给另一个 Agent**、**哪些输入根本不该进模型**、**多轮历史存哪儿**、**中途要人批准时状态怎么办**。OpenAI Agents SDK（MIT，Python 包名 `openai-agents`）把这几件事做成了原语：`Agent`（指令 + 工具 + 交接 + 护栏）、`Runner`（驱动循环）、`handoff()`（Agent 之间转移控制权）、guardrail（输入/输出/工具三个卡点）、`Session`（历史）、tracing（轨迹）。它是 provider 无关的：除 OpenAI Responses / Chat Completions 外，也能通过 LiteLLM 适配层跑上百种模型。

它是 OpenAI 早期实验项目 Swarm 的"生产化继任者"，设计原则写得很直白：**功能多到值得用，原语少到容易学；开箱即用，但每一处都能改**。

先回答一个前置问题：什么时候根本不需要这个 SDK。

| 直接用 Responses API | 用 Agents SDK |
| --- | --- |
| 你想自己掌管循环、工具分发与状态 | 想让运行时托管轮次、工具执行、护栏、交接、会话 |
| 流程短，主要目的就是拿回模型回答 | 智能体要跨多步协作、要产出工件 |
| 单模型调用就够 | 需要真实隔离工作区（Sandbox agents）或可恢复执行 |

两者不必全局二选一：同一个应用里，托管流程走 SDK、低层路径直接调 Responses API 是常见做法。

## 一、依赖、版本与可选能力

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "openai-agents>=0.22"      # 核心；Python >= 3.10
export OPENAI_API_KEY=...              # 密钥走环境变量，不要写进代码
```

按需加可选依赖组（这些是 `openai-agents` 0.22.3 元数据里真实存在的 extra）：

```bash
pip install "openai-agents[litellm]"    # 非 OpenAI 模型：上百种 provider
pip install "openai-agents[redis]"      # Redis 会话后端
pip install "openai-agents[sqlalchemy]" # SQLAlchemy 会话后端
pip install "openai-agents[mongodb]"    # MongoDB 会话后端
pip install "openai-agents[dapr]"       # Dapr 会话后端（另有 s3 后端）
pip install "openai-agents[encrypt]"    # 会话内容加密（cryptography）
pip install "openai-agents[voice]"      # 语音管线；实时语音用 [realtime]
pip install "openai-agents[e2b]"        # E2B 沙箱（另有 docker / modal / daytona / vercel / cloudflare / blaxel / runloop / temporal）
```

`SQLiteSession` 在核心包里就有，不需要 extra。没装 extra 就导入对应模块，会得到一条明确的错误（这是排查"为什么导不进来"时最有价值的一行）：

```text
ImportError: `litellm` is required to use the LitellmModel. You can install it via
the optional dependency group: `pip install 'openai-agents[litellm]'`.
```

## 二、最小闭环：Agent + Runner + 结果

```python
import asyncio
from agents import Agent, Runner

agent = Agent(name="History Tutor", instructions="清楚简洁地回答历史问题。")

async def main():
    result = await Runner.run(agent, "用一句话说明什么是勾股定理。")
    print(result.final_output)

asyncio.run(main())
```

`Runner` 有三个入口：`Runner.run()`（异步，返回 `RunResult`）、`Runner.run_sync()`（同步壳）、`Runner.run_streamed()`（流式，返回 `RunResultStreaming`）。循环语义是：调当前 Agent 的模型 → 判定是"最终输出"还是"交接"还是"工具调用" → 后两者更新状态后再来一轮 → 超过 `max_turns`（默认 10）抛 `MaxTurnsExceeded`。"最终输出"的判定规则是：产出了符合期望类型的文本、且没有工具调用。

`RunResult` 上你真正会用到的是这些字段（对照 0.22.3 的 dataclass 定义）：

| 字段 / 方法 | 含义 |
| --- | --- |
| `final_output` | 本轮最终输出（`output_type` 为 Pydantic 模型时是实例）；`final_output_as(cls)` 做类型收窄 |
| `new_items` | 最丰富的过程视图：`MessageOutputItem` / `ToolCallItem` / `ToolCallOutputItem` / `HandoffCallItem` / `HandoffOutputItem` / `ReasoningItem` / `ToolApprovalItem` / `MCPListToolsItem` 等 |
| `last_agent` | 最后实际在跑的 Agent。**交接之后多轮续聊时，下一轮该用它起步**（流式下用 `current_agent` 可实时观察） |
| `to_input_list()` | 把本轮转成下一轮的输入列表；`mode="normalized"` 在交接裁剪过历史时给出规范续接输入 |
| `interruptions` / `to_state()` | 待批准的工具调用与可恢复状态（见第六节） |
| `input_guardrail_results` / `output_guardrail_results` / `tool_input_guardrail_results` / `tool_output_guardrail_results` | 各类护栏结果 |
| `raw_responses`、`context_wrapper` | 原始模型响应与运行上下文（含 `usage` token 统计） |

流式消费：

```python
result = Runner.run_streamed(agent, "总结一下这次运行。")
async for event in result.stream_events():
    # event.type: "raw_response_event" | "run_item_stream_event" | "agent_updated_stream_event"
    if event.type == "run_item_stream_event":
        print("·", event.item.type)
print("最终：", result.final_output)
```

护栏触发时，终态异常从 `stream_events()` 抛出——这点很容易漏：只包 `Runner.run_streamed(...)` 的调用处是接不住的。

## 三、工具：schema 从哪来，坑在哪

`@tool`（`agents.decorators.tool`，与 `function_tool` 同一族）把 Python 函数变成工具：docstring 成为描述、类型注解成为参数 schema。

```python
from agents import function_tool

@function_tool
def get_weather(city: str, unit: str = "celsius") -> str:
    """查询城市天气。

    Args:
        city: 城市名
        unit: 温度单位
    """
    return f"{city}: 21 {unit}"

print(get_weather.name)                 # get_weather
print(get_weather.description)          # 查询城市天气。
print(get_weather.params_json_schema)   # 见下方输出
```

上面这段**不需要 API Key** 就能跑，输出是：

```text
get_weather
查询城市天气。
{"properties": {"city": {"description": "城市名", "title": "City", "type": "string"},
 "unit": {"default": "celsius", "description": "温度单位", "title": "Unit", "type": "string"}},
 "required": ["city", "unit"], "title": "get_weather_args", "type": "object",
 "additionalProperties": false}
```

盯住 `required`：**默认值是 `celsius` 的 `unit` 仍然出现在 `required` 里**。原因是 `strict_mode=True` 是默认值，而 OpenAI 的严格结构校验要求所有属性都可枚举。想让参数真正可选，两种写法：

```python
@function_tool                          # 严格模式 + 可空：type 变成 ["string","null"]，仍在 required 里
def f(a: str, b: str | None = None) -> str: ...

@function_tool(strict_mode=False)       # 关掉严格模式，required 只剩 ["a"]，默认值才真的生效
def g(a: str, b: str = "x") -> str: ...
```

其余高频参数：`name_override` / `description_override`（改名改描述）、`docstring_style`（google/nurses/jinja）、`failure_error_function`（工具抛异常时喂给模型的错误文案，默认会把异常文本当观察返回）、`timeout_seconds` 与 `timeout_behavior`、`is_enabled`（可以是 `(ctx, agent) -> bool` 的动态开关）、`needs_approval`（人工批准）、`tool_input_guardrails` / `tool_output_guardrails`。`Agent` 侧还有 `tool_use_behavior`（默认 `run_llm_again`）与 `reset_tool_choice`（默认 `True`）两个常被忽略的开关：前者能设成 `stop_on_first_tool` 之类让工具输出直接成为最终答案，后者防止模型沿用上一轮被强制的 `tool_choice`。

工具还有两类"不由你执行"的形态：**托管工具**（`WebSearchTool`、`FileSearchTool`、`CodeInterpreterTool`、`ImageGenerationTool`、`HostedMCPTool` 等，由 OpenAI 侧执行）与 **MCP 工具**（`MCPServerStdio` / `MCPServerStreamableHttp` / `MCPServerSse`，参数含 `cache_tools_list`、`tool_filter`、`client_session_timeout_seconds` 等）。MCP 与 Function Calling 的分层关系见《Function Calling vs MCP：两代工具接入方式如何取舍》，协议本身见《MCP 协议详解：架构、分层与核心原语（2026-07-28 版规范）》。

## 四、模型与 Provider：显式写死，别留给默认

```python
from agents import Agent, ModelSettings, OpenAIProvider, RunConfig

agent = Agent(
    name="Ops",
    instructions="你是机房运维助手。",
    model="gpt-5.6-luna",                       # 显式指定，避免升级时行为漂移
    model_settings=ModelSettings(
        tool_choice="auto",
        reasoning={"effort": "medium"},         # 思考档位
        parallel_tool_calls=True,
    ),
)

# 换成任意 OpenAI 兼容端点（自建网关、区域服务）
provider = OpenAIProvider(api_key="...", base_url="https://your-gateway/v1")
result = await Runner.run(agent, "列出昨晚的告警", run_config=RunConfig(model_provider=provider))
```

三条硬约束值得单独记（模型分层与命名以《推理模型（o1/R1 类）》《主流模型生态对比（2026-09）》为准）：

1. SDK 对 OpenAI 模型**默认走 Responses API**，工具调用与思考 token 的组合只有在 Responses API 下才完整；`GPT-6 Astra` 的工具调用更是**要求** Responses API。
2. `ModelSettings` 里控制输出上限的字段名叫 `max_tokens`，SDK 在 Chat Completions 通路上会把它映射成现行的 `max_completion_tokens`；若你绕过 SDK 直接发 HTTP 请求，请写 `max_completion_tokens`（`max_tokens` 已弃用）。注意这个上限**同时覆盖**思考、可见输出与格式 token。
3. 推理模型跨轮要**回传思考条目**：用 `previous_response_id`，或把上一次响应的 output items 复制进下一个 `input`，模型才能接着同一思路推理而不是从头再想。

非 OpenAI 模型：`pip install "openai-agents[litellm]"` 后用 `agents.extensions.models.litellm_model.LitellmModel(model="anthropic/claude-sonnet-5", api_key=..., base_url=...)` 传给 `Agent.model`（第一个参数名是 `model`，不是 `model_name`）。

## 五、多智能体：agents-as-tools 还是 handoffs

| 模式 | 机制 | 适合 |
| --- | --- | --- |
| **Agents as tools** | 主管 Agent 始终掌握对话，通过 `agent.as_tool()` 调用专家，把专家输出当工具返回值 | 要**一个 Agent 拥有最终答案**、要汇总多个专家输出、想在一处统一施加护栏 |
| **Handoffs** | 分诊 Agent 把对话**移交**给专家，此后本轮由专家直接面对用户 | 路由本身就是工作流；换 Agent 时希望顺带换掉指令，而不是让主管"复述"专家结果 |

选型经验：**能用 agents-as-tools 就别用 handoffs**。交接会换掉 system prompt 与工具集，一旦路由错，后续每一步都在错的指令下跑；工具式调用保留主管控制权，失败时还能兜住。需要交接的典型信号是：专家的对话风格、工具集、输出契约与主管差异大到"共享一份 prompt 会互相污染"。

交接本质就是一个工具调用。这一点不用 API Key 也能验证：

```python
from agents import Agent, Handoff

refund = Agent(name="Refund", instructions="处理退款")
triage = Agent(name="Triage", handoffs=[refund])
print([type(x).__name__ for x in triage.handoffs])   # ['Agent']：传 Agent 会自动包成默认 Handoff
print(Handoff.default_tool_name(refund))             # transfer_to_refund
print(Handoff.default_tool_description(refund))
```

```text
['Agent']
transfer_to_refund
Handoff to the Refund agent to handle the request.
```

也就是说模型看到的交接工具名默认是 `transfer_to_<agent_name>`，专家的 `name` 与 `handoff_description` 直接进入工具名与描述——**Agent 名字要用稳定英文标识，别拿它当展示文案**。

定制用 `handoff()`，签名参数依次为 `agent`、`tool_name_override`、`tool_description_override`、`on_handoff`、`input_type`、`input_filter`、`nest_handoff_history`、`is_enabled`：

```python
from agents import Agent, RunContextWrapper, handoff
from pydantic import BaseModel

class Escalation(BaseModel):
    reason: str            # 让模型顺手给出转接原因，便于审计
    priority: str = "normal"

async def on_handoff(ctx: RunContextWrapper[None], payload: Escalation) -> None:
    ...                    # 交接被调用时立刻执行：记工单、预热数据、埋点

triage = Agent(
    name="Triage",
    handoffs=[handoff(
        agent=refund,
        tool_name_override="transfer_to_refund_desk",
        tool_description_override="仅在涉及金额退回时使用",
        on_handoff=on_handoff,
        input_type=Escalation,
    )],
)
```

四条关键语义：

1. **`input_type` 必须与 `on_handoff` 成对**，否则构造期就报错：`agents.exceptions.UserError: You must provide on_handoff when input_type is provided`。
2. `input_type` 描述的是**交接工具自身的参数 schema**（模型在交接那一刻决定的元数据），它不是 `RunContext` 里的应用状态，也不会替你选目的地——要多目标就注册多个 handoff。
3. **`is_enabled` 做不了参数级授权**：它在准备候选 handoff 时求值，早于模型给出参数。要按参数鉴权，把检查写在 `on_handoff` 开头并 **raise**（`on_handoff` 正常返回后 SDK 就继续完成交接）。
4. 交接默认把**完整对话历史**交给下一个 Agent。裁剪用 `input_filter`，官方给了现成模式：`handoff(agent=faq, input_filter=handoff_filters.remove_all_tools)`，把历史里的 tool_call/tool_output 全清掉，避免专家被上一手的工具噪声带偏。

再补一句提示层的事：把官方的 `RECOMMENDED_PROMPT_PREFIX` 拼进分诊 Agent 的 instructions，模型才真正理解"交接"这个动作的语义。

## 六、护栏：三个卡点，别只盯着输入

| 类型 | 何时运行 | 作用域与限制 |
| --- | --- | --- |
| Input guardrails | 只在**链条第一个 Agent**、初始用户输入时 | 挂在后续 Agent 上的输入护栏不会运行 |
| Output guardrails | 只在**产生最终输出的那个 Agent** | 总在 Agent 完成后运行，不支持并行模式 |
| Tool guardrails | **每次**被包裹的 `FunctionTool` 调用前/后 | 托管工具与 handoff 本身不走这条管线 |

Tripwire 机制：护栏函数返回 `GuardrailFunctionOutput(output_info=..., tripwire_triggered=True)`，runner 立即抛 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`（工具侧 `ToolInputGuardrailTripwireTriggered` / `ToolOutputGuardrailTripwireTriggered`）并停止执行。

```python
from agents import (Agent, GuardrailFunctionOutput, InputGuardrail,
                    InputGuardrailTripwireTriggered, RunContextWrapper, Runner,
                    TResponseInputItem)
from agents.decorators import input_guardrail
from pydantic import BaseModel

class OffTopic(BaseModel):
    is_off_topic: bool
    reason: str

judge = Agent(name="Scope check",
              instructions="判断请求是否在服务范围之外。",
              output_type=OffTopic)

@input_guardrail
async def scope_guardrail(ctx: RunContextWrapper[None], agent: Agent,
                          request_input: str | list[TResponseInputItem]) -> GuardrailFunctionOutput:
    result = await Runner.run(judge, request_input, context=ctx.context)
    verdict: OffTopic = result.final_output
    return GuardrailFunctionOutput(output_info=verdict, tripwire_triggered=verdict.is_off_topic)

support = Agent(name="Customer support",
                instructions="你是机房运维客服，只回答运维与容量相关问题。",
                input_guardrails=[scope_guardrail])

try:
    Runner.run_sync(support, "帮我算一下 2x+3=11 的 x")
except InputGuardrailTripwireTriggered as e:
    print("已拦截：", e.guardrail_result.output.output_info.reason)
```

`InputGuardrail` 的第三个参数是 `run_in_parallel: bool = True`——这是本篇最重要的一个成本/安全开关。`@input_guardrail` 装饰器本身就会返回一个 `InputGuardrail` 实例，并直接接受这两个参数：

```python
@input_guardrail(name="scope", run_in_parallel=False)   # 阻塞式：先判完再进主模型
async def scope_guardrail(ctx, agent, request_input) -> GuardrailFunctionOutput: ...
```

- **并行**（默认）：护栏与主 Agent 同时起跑，延迟最好；但护栏判定拦截时，主 Agent 可能已经消耗了 token、甚至**已经执行了工具**（副作用已发生）。
- **阻塞**（`run_in_parallel=False`）：护栏先跑完再启动 Agent，命中即根本不进主模型。

判据一句话：**被拦动作只要有副作用（下单、改配置、执行 SQL），就用阻塞模式**；纯问答为省延迟才用并行。这个决定要在写护栏之前做，而不是上线后发现"明明拦住了但工单已创建"。

Agent 级输入/输出护栏在交接链里只跑两次（首/末）。要给每个自定义函数调用加检查，就用 `@tool_input_guardrail` / `@tool_output_guardrail` 装饰后挂到工具上：SQL 工具的"只允许 SELECT"、写操作工具的"必须带工单号"都属于这一层。

## 七、会话：四种记忆的取舍

| 策略 | 状态在哪 | 适合 | 下一轮传什么 |
| --- | --- | --- | --- |
| `result.to_input_list()` | 你的应用内存 | 小对话循环、完全手动、provider 无关 | 该列表 + 新的用户消息 |
| `session=` | 你的存储 + SDK | 持久会话状态、可恢复运行、自定义后端 | 同一个 session 实例（或指向同一存储的实例） |
| `conversation_id` | OpenAI Conversations API | 要跨进程/服务共享的命名会话 | 同一个 `conversation_id` + 仅新消息 |
| `previous_response_id` | OpenAI Responses API | 不想建会话资源的轻量服务端续接 | `result.last_response_id` + 仅新消息 |

前两种是客户端管理，后两种是 OpenAI 管理且只在使用 Responses API 时可用。**同一个会话只选一种持久策略**：客户端管理与服务端管理混用会重复堆上下文。硬限制：`session` 不能与 `conversation_id` / `previous_response_id` / `auto_previous_response_id` 出现在同一次 `Runner.run` 调用里。

```python
from agents import Agent, Runner, SQLiteSession

agent = Agent(name="Assistant", instructions="回答尽量简洁。")
session = SQLiteSession("conversation_123", db_path="agent_sessions.db")

await Runner.run(agent, "金门大桥在哪座城市？", session=session)
await Runner.run(agent, "它在哪个州？", session=session)   # 历史由 SDK 自动拼接
```

`Session` 是一套异步协议：`add_items` / `get_items(limit=…)` / `pop_item()` / `clear_session()` / `session_settings`（`close()` 是同步的）。单独验证它不需要模型：

```python
import asyncio
from agents import SQLiteSession

async def main():
    s = SQLiteSession("conv-1", db_path="demo.db")
    await s.add_items([{"role": "user", "content": "你好"},
                       {"role": "assistant", "content": "Hi"}])
    print(await s.get_items(limit=1))
    print(await s.pop_item())
    await s.clear_session()
    print(await s.get_items())

asyncio.run(main())
```

```text
[{'role': 'assistant', 'content': 'Hi'}]
{'role': 'assistant', 'content': 'Hi'}
[]
```

`pop_item()` 弹出的是**最后一条**——用它做"回滚最后一句"很方便，但也意味着它不是队列头出队。生产后端在 `agents.extensions.memory` 下：`AsyncSQLiteSession`、`AdvancedSQLiteSession`、`SQLAlchemySession`、`RedisSession`、`MongoDBSession`、`DaprSession`（分别需要同名 extra），以及包装任意后端做透明加密的 `EncryptedSession`（需 `openai-agents[encrypt]`）。记忆的分层设计见《Agent 记忆机制：LangGraph 的短期记忆与长期记忆》。

## 八、人在回路：工具批准与可恢复状态

给工具加 `needs_approval=True`，运行遇到它时不会执行，而是把待批准项放进 `result.interruptions`：

```python
result = await Runner.run(agent, "清理不再需要的临时文件。")
if result.interruptions:
    state = result.to_state()                  # 可恢复状态
    for item in result.interruptions:
        state.approve(item)                    # 或 state.reject(item)
    result = await Runner.run(agent, state)    # 从暂停处继续
```

`RunState` 支持 `to_json()` / `from_json()`（还有 `add_input()` 在恢复前追加一句话），所以"暂停—落库—几小时后由审批人恢复"是能做的：把状态连同 `thread`/工单号存进你自己的表，恢复时反序列化再 `Runner.run(agent, state)`。MCP 工具也有对应的审批流（`MCPServerStdio` 的 `require_approval` 与 `MCPApprovalRequestItem`）。跨框架的图级中断做法见《Human-in-the-Loop：用 LangGraph interrupt 实现中断、恢复与人工审批》。

## 九、运行控制与追踪

- `RunConfig` 是"不改 Agent 定义也能改变运行"的地方：`model`、`model_provider`、`model_settings`、`handoff_input_filter`、`nest_handoff_history`、`tracing_disabled`、`trace_id`、`group_id`、`workflow_name`、`trace_metadata`、`session_input_callback`、`call_model_input_filter`、`tool_error_formatter`、`tool_not_found_behavior`、`output_guardrail_blocked_message` 等。
- 追踪内置且默认开启，上报到 OpenAI 控制台。三种粒度：`trace(workflow_name="...", group_id=thread_id)` 圈住一次业务流；`@with_custom_span(name=...)` / `custom_span(name=...)` 记你自己的步骤；`add_trace_processor(...)` 把 span 转发给外部平台（Langfuse、Datadog 等，见《可观测性与 Tracing：Agent 生产排障的第一工具（LangSmith / Langfuse / OpenTelemetry）》）。
- 全局开关：`set_tracing_disabled(True)`、`set_tracing_export_api_key(...)`（追踪用的 key 与业务 key 分开）、`set_default_openai_api("chat_completions")`、`set_default_openai_client(...)`。
- 出错兜底：`error_handlers=RunErrorHandlers(max_turns_exceeded_handler=...)` 能在 `MaxTurnsExceeded` 前返回一个受控结果而不是抛异常；异常对象上的 `run_data`（`RunErrorDetails`）带 `input`、`new_items`、`last_agent` 与各类护栏结果，是排查误拦/跑偏的第一现场。

## 十、端到端：一个能跑的运维分诊助手

把前面几节拼起来。`app.py`，`pip install "openai-agents>=0.22" openai pydantic` 后可直接 `python app.py`（需要 `OPENAI_API_KEY`）：

```python
"""机房运维分诊助手：护栏 + 交接 + 工具 + 会话 + 追踪。"""
import asyncio

from agents import (Agent, GuardrailFunctionOutput, InputGuardrailTripwireTriggered,
                    Runner, RunConfig, SQLiteSession, custom_span, handoff, trace)
from agents.decorators import input_guardrail, tool
from agents.extensions import handoff_filters
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX
from pydantic import BaseModel


class Verdict(BaseModel):
    out_of_scope: bool
    reason: str


@tool
def list_alerts(since_hours: int = 24) -> str:
    """拉取最近 N 小时的机房告警。"""
    return f"[{since_hours}h] cpu_high@node-7; disk_full@nas-3"


@tool
def rebuild_snapshot(disk: str) -> str:
    """重建指定磁盘的快照（有副作用，必须走审批）。"""
    return f"snapshot rebuilt for {disk}"


judge = Agent(name="ScopeJudge", instructions="判断请求是否与机房运维无关。", output_type=Verdict)


@input_guardrail(name="scope", run_in_parallel=False)      # 阻塞：判完才允许进主模型
async def scope_guardrail(ctx, agent, request_input) -> GuardrailFunctionOutput:
    res = await Runner.run(judge, request_input, run_config=RunConfig(tracing_disabled=True))
    v: Verdict = res.final_output
    return GuardrailFunctionOutput(output_info=v, tripwire_triggered=v.out_of_scope)


ops = Agent(name="Ops", instructions="你处理机房运维问题，优先用工具查证再回答。",
            tools=[list_alerts, rebuild_snapshot])
faq = Agent(name="FAQ", handoff_description="账号、发票、计费等通用咨询",
            instructions="只回答通用咨询，一句话以内。")
triage = Agent(
    name="Triage",
    instructions=f"{RECOMMENDED_PROMPT_PREFIX}\n你是分诊员：只做归属判断并交接，不要自己回答业务问题。",
    handoffs=[
        faq,
        # 交接时清掉历史里的工具噪声，专家不被上一手带偏
        handoff(agent=ops, input_filter=handoff_filters.remove_all_tools),
    ],
    input_guardrails=[scope_guardrail],
)


async def main() -> None:
    session = SQLiteSession("ops-demo", db_path="ops.db")
    for q in ["nas-3 磁盘满了怎么办？", "我上个月发票在哪下载？", "帮我写一首关于服务器的诗"]:
        with custom_span(name="turn", data={"question": q}):
            try:
                with trace(workflow_name="ops-triage", group_id="ops-demo"):
                    res = await Runner.run(triage, q, session=session, max_turns=8)
                print(f"[{q}] -> {res.last_agent.name}: {res.final_output}")
            except InputGuardrailTripwireTriggered as e:
                print(f"[{q}] 已被输入护栏拦截：{e.guardrail_result.output.output_info.reason}")


asyncio.run(main())
```

三个值得注意的写法：护栏内部那次判定运行要 `RunConfig(tracing_disabled=True)`，否则每次提问都会多出一条"看起来像主流程"的 trace；`max_turns=8` 是循环失控的唯一硬保护（`None` 表示不设限，别在生产里这么写）；`res.last_agent.name` 用来核对"这轮到底是谁在答"，交接类应用每次都要打这个。

## 常见坑

1. **以为挂在专家 Agent 上的输入护栏会执行**：不会，输入护栏只对链条第一个 Agent 生效；要逐调用检查就用工具护栏。
2. **`handoff_description` 忘光**：交接时模型只看得到每个专家的 `handoff_description`。不给描述，路由就靠猜——专家名 + 一句话职责 + 禁用条件是最低要求。
3. **交接后历史里全是上一手的 tool_call**：专家被无关工具结果带偏。用 `handoff_filters.remove_all_tools`。
4. **把 `input_type` 当路由参数用**：它不改变目的地、也不做鉴权（见第五节）。
5. **并行护栏 + 有副作用的工具**：拦住了输出但动作已发生。有副作用一律 `run_in_parallel=False`。
6. **默认模型不显式指定**：SDK 默认模型是 `gpt-5.6-luna`（`get_default_model()` 的返回值），跨团队/跨环境请写死 `model=`，避免升级时行为漂移。
7. **`strict_mode` 的默认值幻觉**：默认真严格，带默认值的参数仍被要求填写。要么 `str | None = None`，要么 `strict_mode=False`（第三节有可离线复现的输出）。
8. **混用会话策略**：`session` 与 `conversation_id`/`previous_response_id` 同一次调用会冲突；两套历史同时生长会让上下文翻倍。
9. **只在调用处捕获流式异常**：护栏 tripwire 在 `stream_events()` 迭代时才抛，异步 `for` 循环外面包 try 才接得住。
10. **把 `reset_tool_choice` 关掉后不测路由**：强制 `tool_choice` 会黏到下一轮，分诊 Agent 可能一直"被要求交接"。默认 `True` 是安全值。
11. **只测 happy path**：交接类应用必须测"路由错误"的恢复——给 20 条应拒绝/该转人工的样本，量 tripwire 命中率与误拦率；评测方法见《Agent 评测：数据集、评估器与 LLM-as-Judge 实战》。

## 延伸阅读

- 官方文档：[Overview](https://openai.github.io/openai-agents-python/)、[Quickstart](https://openai.github.io/openai-agents-python/quickstart/)、[Running agents](https://openai.github.io/openai-agents-python/running_agents/)、[Results](https://openai.github.io/openai-agents-python/results/)、[Tools](https://openai.github.io/openai-agents-python/tools/)、[Agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)、[Handoffs](https://openai.github.io/openai-agents-python/handoffs/)、[Guardrails](https://openai.github.io/openai-agents-python/guardrails/)、[Sessions](https://openai.github.io/openai-agents-python/sessions/)、[Tracing](https://openai.github.io/openai-agents-python/tracing/)。
- 源码示例：`examples/basic/`（hello world、tools）、`examples/agent_patterns/routing.py`（多智能体路由）。
- 站内：同类框架对比见《LangGraph 入门：用 Graph API 与 Functional API 构建你的第一个智能体》《AutoGen 与 CrewAI：多智能体框架现状（AutoGen 已并入 Microsoft Agent Framework）》；提示层的路由写法（结构化输出分类 + 代码分发）见《规划与任务分解：构建高效智能体的工作流模式》；把流程与口径沉淀成文件夹的另一种做法见《Agent Skills：用文件夹给智能体装上可复用的专业能力》。

---

> **来源**：抓取于 2026-09-19。译自/整理自 [OpenAI Agents SDK 官方文档](https://openai.github.io/openai-agents-python/)（OpenAI，MIT 许可）的 Overview、Quickstart、Running agents、Results、Tools、Agent orchestration、Handoffs、Guardrails、Sessions、Tracing 各章，并对照 PyPI 包 `openai-agents` 0.22.3 的签名与 dataclass 定义逐条核对。
> **编者注**：文中工具 schema JSON、`transfer_to_refund` 与默认交接描述、`input_type` 必须配 `on_handoff` 的 `UserError`、`litellm` 缺失时的 `ImportError` 文案、`SQLiteSession` 的 `get_items/pop_item/clear_session` 输出、`RunConfig`/`ModelSettings`/`function_tool` 的参数清单与 `Session` 后端列表，均为按 0.22.3 实际执行得到的结果；需要 `OPENAI_API_KEY` 的端到端行为（分诊、护栏拦截、流式）依官方文档描述给出，未在离线环境重复调用线上接口。SDK 的语音/实时 Agent、Sandbox agents 与 Temporal/Dapr 持久化章节未收录，属独立主题。
