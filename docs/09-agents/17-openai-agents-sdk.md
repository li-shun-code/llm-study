---
title: OpenAI Agents SDK：交接（Handoffs）与护栏（Guardrails）的用法与边界
source_url: https://openai.github.io/openai-agents-python/handoffs/
author: OpenAI（Agents SDK 官方文档与源码）
license: MIT
fetched_at: 2026-09-19
translated: true
versions: openai-agents 0.22.3（PyPI 当前版，Python 3.10+）；默认模型 gpt-5.6-luna（`agents.models.get_default_model()` 实测）
order: 17
group: 编排框架
---

## 它解决什么：把 Agent 循环的"脏活"标准化

手写一个 Agent 循环不难：调模型 → 有 tool_call 就执行 → 把结果塞回消息 → 再调模型。难的是循环之外的部分：**什么时候把控制权交给另一个 Agent**、**哪些输入根本不该进模型**、**中间结果怎么持久化**、**出错时状态怎么办**。OpenAI Agents SDK（MIT，Python 包名 `openai-agents`）就是把这几件事做成原语：`Agent`（指令 + 工具 + 交接 + 护栏）、`Runner`（驱动循环）、`handoff()`（Agent 之间转移控制权）、guardrail（进/出/工具三个卡点）、session（历史）、tracing（轨迹）。它是 provider 无关的：除 OpenAI Responses / Chat Completions 外，也能通过 LiteLLM 之类适配层跑上百种模型。

本篇不讲"能做什么"，只讲**两个最容易用错的原语**（handoffs、guardrails）与它们的边界——这两处是官方文档写得最细、而教程最常略过的地方。

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "openai-agents>=0.22"          # 语音：'openai-agents[voice]'；Redis 会话：'openai-agents[redis]'
export OPENAI_API_KEY=...                  # 密钥走环境变量，不要写进代码
```

## 一、两种编排：agents-as-tools 还是 handoffs

官方文档给的核心对照（`Agent` = LLM + instructions + tools + handoffs）：

| 模式 | 机制 | 适合 |
| --- | --- | --- |
| **Agents as tools** | 主管 Agent 始终掌握对话，通过 `Agent.as_tool()` 调用专家，把专家输出当工具返回值 | 你要**一个 Agent 拥有最终答案**、需要汇总多个专家输出、想在一处统一施加护栏 |
| **Handoffs** | 分诊 Agent 把对话**移交**给专家，此后本轮由专家直接面对用户 | 路由本身就是工作流；希望换 Agent 时顺带换掉指令，而不需要主管"复述"专家结果 |

两者可以嵌套：分诊 → 专家，专家内部再把窄任务当工具调用别的 Agent。

选型经验：**能用 agents-as-tools 就别用 handoffs**。交接会换掉 system prompt 与工具集，一旦路由错，后续每一步都在错的指令下跑；而工具式调用保留主管的控制权，失败时还能兜住。需要交接的典型信号是：专家的对话风格/工具集/输出契约与主管差异大到"共享一份 prompt 会互相污染"。

## 二、Handoffs：交接就是一个工具调用

### 1. 默认形态

```python
from agents import Agent

billing = Agent(name="Billing", instructions="处理账单与发票问题。")
triage = Agent(name="Triage", instructions="判断用户诉求并转给对应专家。", handoffs=[billing])
```

`handoffs=[billing]` 会由 SDK 生成一个**函数工具**暴露给模型。这一点可以离线验证（不需要 API Key）：

```python
from agents import Agent, Handoff

refund = Agent(name="Refund", instructions="处理退款")
triage = Agent(name="Triage", handoffs=[refund])
print([type(x).__name__ for x in triage.handoffs])   # ['Agent'] —— 传 Agent 会自动包成默认 Handoff
print(Handoff.default_tool_name(refund))             # transfer_to_refund
print(Handoff.default_tool_description(refund))
```

本机实测输出（openai-agents 0.22.3）：

```text
['Agent']
transfer_to_refund
Handoff to the Refund agent to handle the request.
```

也就是说：**模型看到的交接，名字默认是 `transfer_to_<agent_name>`**。专家名（`name=`）与 `handoff_description=` 会直接进入工具名与描述——所以 Agent 名字要用稳定的英文标识，别拿它当展示文案。

### 2. 用 `handoff()` 定制：参数、回调与历史裁剪

```python
from agents import Agent, RunContextWrapper, handoff
from pydantic import BaseModel


class Escalation(BaseModel):
    reason: str          # 让模型顺手给出转接原因，便于审计
    priority: str = "normal"


async def on_handoff(ctx: RunContextWrapper[None], payload: Escalation) -> None:
    # 交接被调用时立刻执行：记工单、预热数据、埋点
    print("交接元数据：", payload)


refund = Agent(name="Refund")
triage = Agent(
    name="Triage",
    handoffs=[
        handoff(
            agent=refund,
            tool_name_override="transfer_to_refund_desk",
            tool_description_override="仅在涉及金额退回时使用",
            on_handoff=on_handoff,
            input_type=Escalation,
        )
    ],
)
```

`handoff()` 的完整参数（源码签名核对）：`agent`、`tool_name_override`、`tool_description_override`、`on_handoff`、`input_type`、`input_filter`、`nest_handoff_history`、`is_enabled`。

四条关键语义：

1. **`input_type` 必须与 `on_handoff` 成对出现**，否则 SDK 直接拒绝构建：

```text
agents.exceptions.UserError: You must provide on_handoff when input_type is provided
```

2. `input_type` 描述的是**交接工具自身的参数 schema**：SDK 把它作为工具 `parameters` 暴露给模型，本地校验后再把解析结果传给 `on_handoff`。它是"模型在交接那一刻决定的元数据"（reason/priority/summary），**不是** `RunContext` 里的应用状态，也不会替你选择目的地——要多个专家就注册多个 handoff。
3. **`is_enabled` 不能用来做参数级授权**。它在 SDK 准备候选 handoff 时求值，早于模型给出参数，因此拿不到 `input_type` 里的字段。需要按参数鉴权时，把检查写在 `on_handoff` 开头并 **raise**——`on_handoff` 正常返回后 SDK 就会继续完成交接。
4. 交接默认把**完整对话历史**交给下一个 Agent。想裁剪就用 `input_filter`，官方给了现成的常见模式：

```python
from agents import handoff
from agents.extensions import handoff_filters

handoff(agent=faq_agent, input_filter=handoff_filters.remove_all_tools)
# 交接前把历史里的 tool_call/tool_output 全清掉，避免专家被上一手的工具噪声带偏
```

另外，为了让模型真正理解"交接"这个动作，官方建议把 `RECOMMENDED_PROMPT_PREFIX` 拼进分诊 Agent 的 instructions：

```python
from agents.extensions.handoff_prompt import RECOMMENDED_PROMPT_PREFIX

triage = Agent(
    name="Triage",
    instructions=f"""{RECOMMENDED_PROMPT_PREFIX}
你是分诊员。只负责判断归属并交接，不要自己回答业务问题。""",
    handoffs=[billing, refund],
)
```

## 三、Guardrails：三个卡点，别只盯着输入

护栏的价值是**用便宜模型/规则挡住不该发生的事**。官方文档明确区分三类，运行时机完全不同：

| 类型 | 何时运行 | 作用域与限制 |
| --- | --- | --- |
| Input guardrails | 只在**链条第一个 Agent** 上、初始用户输入时 | 挂在后续 Agent 上的输入护栏不会运行（多智能体链里只有首Agent生效） |
| Output guardrails | 只在**产生最终输出的那个 Agent** 上 | 总在 Agent 完成后运行，不支持并行模式 |
| Tool guardrails | **每次**被包裹的 `FunctionTool` 调用前/后 | 托管工具（WebSearch/FileSearch/CodeInterpreter/ComputerTool…）与 handoff 本身不走这条管线 |

Tripwire 机制：护栏函数返回 `GuardrailFunctionOutput(output_info=..., tripwire_triggered=True)`，runner 立即抛 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`（工具侧是 `ToolInput/ToolOutputGuardrailTripwireTriggered`）并停止执行。

```python
from agents import (
    Agent, GuardrailFunctionOutput, InputGuardrailTripwireTriggered,
    RunContextWrapper, Runner, TResponseInputItem,
)
from agents.decorators import input_guardrail
from pydantic import BaseModel


class OffTopicOutput(BaseModel):
    is_off_topic: bool
    reason: str


guardrail_agent = Agent(
    name="Off-topic check",
    instructions="判断用户是否在服务范围之外（例如让你写作业、写与业务无关的代码）。",
    output_type=OffTopicOutput,
)


@input_guardrail
async def scope_guardrail(
    ctx: RunContextWrapper[None], agent: Agent, request_input: str | list[TResponseInputItem]
) -> GuardrailFunctionOutput:
    result = await Runner.run(guardrail_agent, request_input, context=ctx.context)
    verdict: OffTopicOutput = result.final_output
    return GuardrailFunctionOutput(output_info=verdict, tripwire_triggered=verdict.is_off_topic)


support = Agent(
    name="Customer support",
    instructions="你是机房运维客服，只回答运维与容量相关问题。",
    input_guardrails=[scope_guardrail],
)

try:
    Runner.run_sync(support, "帮我算一下 2x+3=11 的 x")
except InputGuardrailTripwireTriggered as e:
    print("已被输入护栏拦截：", e.guardrail_result.output.output_info.reason)
```

### 并行还是阻塞：一个容易忽视的成本开关

输入护栏有两种执行模式：

- **并行**（默认，`run_in_parallel=True`）：护栏与主 Agent 同时起跑，延迟最好；但护栏判定拦截时，主 Agent **可能已经消耗了 token、甚至已经执行了工具**（副作用已发生）。
- **阻塞**（`run_in_parallel=False`）：护栏先跑完再启动 Agent；命中即根本不进主模型。

选法：**只要被拦的操作有副作用（下单、改配置、执行 SQL），就用阻塞模式**；纯问答为了省延迟才用并行。这个决定应该在写护栏之前做，而不是上线后发现"明明拦住了但工单已创建"。

### 工具护栏：多步工作流里的唯一逐调用卡点

Agent 级输入/输出护栏在交接链里只跑两次（首/末）。要给每个自定义函数调用加检查，就用 `@tool_input_guardrail` / `@tool_output_guardrail` 装饰后挂到 `function_tool` 上（本地 MCP server 也可以配 `tool_input_guardrails` / `tool_output_guardrails` 列表）。典型用法：SQL 工具的"只允许 SELECT"、写操作工具的"必须带工单号"。详见《Text2SQL 的方法与评测》里 `validate_sql` 的三层校验，把它搬进 tool guardrail 就是标准做法。

## 四、运行、会话与可观测

```python
from agents import Runner, RunConfig

res = await Runner.run(triage, "上月电费超了，能退吗？", max_turns=8)
print(res.final_output)
print("走过的 Agent：", [a.name for a in res.agent_list])
print("输入护栏结果：", [(g.guardrail.name, g.output.tripwire_triggered) for g in res.input_guardrail_results])
for item in res.new_items:                 # 逐步轨迹：交接、工具调用、消息
    print(item.type)
```

- `max_turns` 默认 10，超限抛 `MaxTurnsExceeded`——**这是循环失控的唯一硬保护，别设成 None**。
- 流式：`Runner.run_streamed(...)` + `async for ev in result.stream_events()`（`RunResultStreaming`）。护栏触发时终态异常从 `stream_events()` 抛出。
- 会话：`session=` 传入 session 实现（SDK 提供多种后端，Redis 版本要 `openai-agents[redis]`），历史自动拼接，见《Agent 记忆机制》。
- 追踪：内置 tracing 上报到 OpenAI 控制台；`RunConfig(tracing_disabled=True)` 关闭，或导出 OpenTelemetry 接自建平台（本站《可观测性与 Tracing》）。生产建议保留 trace 并把 `workflow_name`、`trace_id` 与业务工单号关联。

## 常见坑

1. **把 `handoff_description` 忘光**：交接时模型只看得到每个专家的 `handoff_description`。不给描述，路由就靠猜——专家名 + 一句话职责 + 禁用条件是最低要求。
2. **`input_type` 当路由参数用**：它不改变目的地，也不做鉴权（见上）。多个目的地要注册多个 handoff。
3. **交接后历史里全是上一手的 tool_call**：专家被无关工具结果带偏。用 `handoff_filters.remove_all_tools`。
4. **以为挂在专家 Agent 上的输入护栏会执行**：不会，输入护栏只对链条第一个 Agent 生效；需要逐调用检查请改用工具护栏。
5. **并行护栏 + 有副作用的工具**：拦住了输出但动作已发生。有副作用一律 `run_in_parallel=False`。
6. **捕获异常后丢弃上下文**：tripwire 抛异常时，`exception.run_data.input_guardrail_results` / `output_guardrail_results` 里有已完成的全部护栏结果，排查误拦必用。
7. **默认模型不明确指定**：SDK 默认模型是 `gpt-5.6-luna`（实测 `get_default_model()`），跨团队/跨环境请显式写 `model=`，避免升级时行为漂移。
8. **只测 happy path**：交接类应用必须测"路由错误"的恢复：给 20 条应该拒绝/该转人工的样本，量 tripwire 命中率与误拦率（评测方法见《Agent 评测》）。

## 延伸阅读

- 官方文档：[Handoffs](https://openai.github.io/openai-agents-python/handoffs/)、[Guardrails](https://openai.github.io/openai-agents-python/guardrails/)、[Agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)。
- 同类框架的取舍：《LangGraph 入门》《AutoGen 与 CrewAI》《代码解释器型 Agent》。
- 提示层的路由写法（结构化输出分类 + 代码分发）见《规划与任务分解》。

---

> **来源**：抓取于 2026-09-19。译自/整理自 [OpenAI Agents SDK 官方文档](https://openai.github.io/openai-agents-python/handoffs/)（OpenAI，MIT 许可）的 Handoffs、Guardrails、Agent orchestration 三章，并对照 `openai-agents` 0.22.3 源码签名核实。
> **编者注**：文中 `transfer_to_refund`、默认工具描述、`input_type` 必须配 `on_handoff` 的报错、默认模型名 `gpt-5.6-luna` 等，均为本机安装 0.22.3 后离线执行 `python -c` 得到的真实输出；需要 `OPENAI_API_KEY` 的端到端运行未在本环境执行，相关预期行为以官方文档描述为准。原文 README 中的架构图、语音/实时 Agent 章节与致谢段落未收录（与本篇主题无关）。
