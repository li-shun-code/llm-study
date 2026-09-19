---
title: "ReAct 范式：循环的机制与工程实现"
source_url: https://huggingface.co/learn/agents-course/en/unit1/thoughts
author: Hugging Face Agents Course 团队（概念底座）；机制与代码为对照官方 API 的工程化整理
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: 概念通用；实现按 openai Python SDK 2.x（Responses API）与当前主流 Agent 框架的循环语义校订
order: 2
group: 奠基：智能体如何思考
---
## 本篇的分工：提示层交给另一篇，这里只谈循环作为软件

ReAct 让模型**交错生成推理轨迹与行动**——想一步、动一步、看一眼结果、再想下一步。这件事在**提示层**怎么写（论文里的 `Thought/Action/Observation` 示范轨迹、HotpotQA 例子、少样本格式与论文结论），本站《ReAct 提示模式：推理与行动交替》已经完整讲过；思维链本身（`Let's think step by step`、Self-Consistency、失效边界）见《思维链与多路采样：CoT、Self-Consistency 与失效边界》。**本篇不再复述那部分历史与提示模板**，只回答工程问题：

- 一个能跑的 ReAct 循环，状态机长什么样？
- "动作"怎么从模型输出里取出来——文本协议解析 vs 原生函数调用，代价各是什么？
- 停止条件、失败恢复、循环检测、Observation 截断、每步埋点怎么写？
- 为什么今天几乎没人手写 ReAct 提示词，但人人都跑着 ReAct 循环？

## 一、状态机：三态只是表象，本质是"带观察的循环"

```text
                 ┌──────────── 停止判定 ────► 最终答案（终态）
                 │      ▲ 无动作 / 命中 Finish / max_steps / 护栏
                 │      │
   提示 + 历史 ──┴──► [模型] ──动作意图──► [解析器] ──► [执行器/工具] ──► [观察]
      ▲                                                          │
      └──────────── 追加到消息历史（Observation 回灌） ◄─────────┘
```

三个概念到运行时实体的映射只有一层薄纸：

| ReAct 概念 | 运行时实体 | 工程注意点 |
| --- | --- | --- |
| Thought（思考） | 模型输出里的推理文本 / reasoning item | 可能被思考 token 吞掉不可见；跨轮要按 provider 规则回传 |
| Action（行动） | 工具调用（函数名 + 参数）或代码块 | 参数校验在**执行前**做，失败要回灌成可读观察 |
| Observation（观察） | 工具返回值、错误栈、页面/DOM 状态、系统指标 | **必须截断**；它是历史膨胀的主源 |

观察的类型比"工具输出"宽：系统反馈（错误码、状态变更）、数据变化（DB 更新、文件写入）、环境数据（传感器、资源指标）、响应分析（查询结果）、基于时间的事件（截止到达、定时任务完成）。**任何能改变下一步决策的信号都是观察**，这也是为什么"把执行日志原样贴回上下文"常常比"贴结论"更有效。

思考也不是玄学名词，它承担可观察的职责：规划、分析、决策、解决问题、记忆整合、自我反思、目标设定、优先级排序。给循环加一条"每轮先写一句下一步意图"的约束，收益经常大于换模型——因为它把"分支选择"显式化了，出错时你在 trace 里能看到它是**怎么决定**的。

## 二、两种动作协议，以及为什么后者赢了

ReAct 最初是**文本协议**：模型用固定小语法打印动作，宿主用正则解析、执行、把观察拼回提示。它的好处是能跑在任何纯文本模型上；代价是把解析错误、转义、停止词、格式漂移全变成你的 bug。

### 1. 文本协议版：一个能跑的最小循环

下面 60 行是完整可跑的（`pip install openai>=1.99`，需 `OPENAI_API_KEY`）：环境里有两个假工具，故意让一次调用失败，好观察"错误回灌后自纠"。

```python
"""ReAct 文本协议最小实现：解析 → 执行 → 观察回灌 → 终止判定。"""
import json
import re

from openai import OpenAI

client = OpenAI()
MODEL = "gpt-5.6-luna"

inventory = {"apple": 12, "banana": 0}
BROKEN_ONCE = {"flag": True}          # 模拟一次不稳定依赖，用于演示错误恢复


def tool_search(item: str) -> str:
    if item not in inventory:
        return f"UNKNOWN_ITEM: 仓库里没有 {item}"
    return f"{item} 库存 {inventory[item]}"


def tool_ship(item: str) -> str:
    if BROKEN_ONCE["flag"]:
        BROKEN_ONCE["flag"] = False
        raise RuntimeError("503 upstream shipping service unavailable")
    if inventory.get(item, 0) <= 0:
        return f"OUT_OF_STOCK: {item} 无法发货"
    inventory[item] -= 1
    return f"OK: {item} 已发货"


PROMPT = """你用固定格式解决任务，每轮只输出三行：
Thought: <一句话下一步意图>
Action: <search|ship|Finish>
Action Input: <JSON 字符串；Finish 时放最终答案>

可用工具：
- search: {"item": "商品名"}
- ship:   {"item": "商品名"}

任务：{task}
历史：
{scratchpad}
"""

STEP = re.compile(r"Thought:\s*(?P<th>.*?)\s*Action:\s*(?P<ac>\w+)\s*"
                  r"Action Input:\s*(?P<in>.*)", re.S)


def parse(text: str) -> tuple[str, str, dict] | None:
    m = STEP.search(text)
    if not m:
        return None
    try:
        args = json.loads(m.group("in").strip())
    except json.JSONDecodeError:
        args = {"_raw": m.group("in").strip()}      # 交给执行器当成参数错误回灌
    return m.group("th").strip(), m.group("ac").strip(), args


def execute(action: str, args: dict) -> str:
    if action == "search":
        return tool_search(args.get("item", ""))
    if action == "ship":
        try:
            return tool_ship(args.get("item", ""))
        except Exception as exc:                     # 异常文本就是下一轮的观察
            return f"ERROR: {exc}"
    return f"UNKNOWN_ACTION: {action}"


def react(task: str, max_steps: int = 6) -> str:
    scratchpad: list[str] = []
    for step in range(max_steps):
        out = client.responses.create(
            model=MODEL,
            input=PROMPT.format(task=task, scratchpad="\n".join(scratchpad) or "（空）"),
        ).output_text
        parsed = parse(out)
        if parsed is None:                            # 格式不合法：把要求再念一遍
            scratchpad.append(f"[系统] 上一步没按格式输出，请严格输出三行。")
            continue
        thought, action, args = parsed
        if action == "Finish":
            return str(args.get("_raw") or next(iter(args.values()), ""))
        observation = execute(action, args)
        scratchpad.append(f"Step {step + 1}\nThought: {thought}\n"
                          f"Action: {action}({json.dumps(args, ensure_ascii=False)})\n"
                          f"Observation: {observation[:800]}")   # 观察必须截断
    return "未完成：达到 max_steps"


print(react("把 apple 发出去，然后告诉我还剩几个。"))
```

三个"看起来琐碎"的行是这套循环能不能跑起来的关键：`observation[:800]`（不截断则第二轮就爆窗口）、`except Exception` 把异常文本回灌（模型下一轮会改用别的动作或先补库存查询）、`parsed is None` 时补一句格式要求而不是崩掉。

### 2. 原生函数调用版：解析交给模型服务

同一件事在今天的写法：把工具声明成 schema，模型直接返回结构化的 `tool_calls`，宿主只负责执行与回灌。**没有正则、没有格式漂移**，参数校验还能拿 JSON Schema / 严格模式兜底。API 细节见《Function Calling / Tool Use：让模型调用你的函数》；框架化写法见《OpenAI Agents SDK 实战：从第一个 Agent 到交接、护栏与会话》（`Runner` 的循环判定就是"有工具调用就执行再来一轮；没有工具调用且输出符合类型 → 结束"）与《LangGraph 入门：用 Graph API 与 Functional API 构建你的第一个智能体》（`should_continue` 那条条件边就是 `Action` 分派器）。

| 维度 | 文本协议 | 原生函数调用 |
| --- | --- | --- |
| 动作解析 | 你的正则/状态机 | 模型服务端，结构化返回 |
| 失败模式 | 格式漂移、截断、转义、少一行 | 参数不合 schema（可严格模式拒）、幻觉工具名 |
| 可停止性 | 靠 stop 词与解析终止 | 天然按 `tool_calls` 有无终止 |
| 适用 | 不支持工具调用的模型、需要自定义 DSL（如代码块） | 绝大多数现代模型 |
| 思考可见性 | Thought 显式可见（可审计） | 常被打进不可见的 reasoning token |

最后一条是真取舍：ReAct 论文强调的可解释性（能看见它为什么这么选）在原生函数调用 + 推理模型下会**部分丢失**——你能看到动作序列，但看不到自由文本的思考。审计要求高的场景，仍值得让模型显式产出一句"下一步意图"，或干脆用可显式输出的推理文本（各家对思考可见性的差异见《推理模型（o1/R1 类）》）。

## 三、循环之外：让它在生产里不失控

写通一次不难，写稳才难。逐条给最小做法：

**终止条件要三重冗余。** ①模型显式终止（`Finish` / 无 `tool_calls`）；②步数上限（`max_steps` / SDK 的 `max_turns`，默认 10，`None` 等于关保险）；③预算上限（token 累计、墙钟时间、成本）。三者任一命中都要能返回**可解释的降级结果**，而不是抛异常给上层。

**循环检测。** 同一 `(action, args)` 连续重复 N 次，或滑动窗口内状态指纹不再变化，就说明它卡住了：把"你已经这样做过 3 次且结果相同"作为观察显式塞回去，或强制转人工。开源实现里这类检测通常是开关 + 窗口参数（例如 browser-use 的 `loop_detection_enabled` / `loop_detection_window=20`；《Computer Use 与浏览器操作 Agent：坐标、DOM 与动作循环的完整实现》第 4 节同款问题）。

**副作用要么幂等，要么过人工确认。** ReAct 循环里最贵的事故是"重复扣款"：一次网络超时、模型以为没成功、再来一次。规则与中断式实现见《Human-in-the-Loop：用 LangGraph interrupt 实现中断、恢复与人工审批》——**先中断、后副作用**，`interrupt()` 之前的副作用必须幂等。

**Observation 的压缩策略。** 保留头尾 + 中间省略、结构化成字段（`status`/`error_code`/`n_items`）、或把长文档交给抽取小模型只回一句结论。这一步做糙，第五轮之后模型就开始"忘"第一轮的关键事实——它的表现不是报错，而是答非所问（见《长时运行 Agent 的上下文管理：压缩（Compaction）》）。

**每步一个 span。** 记录：轮次、模型输入摘要、Thought、动作与参数、观察摘要、耗时与 token、失败原因。有了它，"这次为什么走 12 步"才有答案；没有它，Agent 排障只能靠复现（见《可观测性与 Tracing：Agent 生产排障的第一工具（LangSmith / Langfuse / OpenTelemetry）》）。

**评估看轨迹不只看答案。** 单步出错会被后续步骤掩盖或放大，所以除了终态对不对，还要问：该用的工具用了没、调用次数是否合理、最早出错的是哪一步（见《Agent 评测：数据集、评估器与 LLM-as-Judge 实战》）。

## 四、为什么"手写 ReAct 提示"退场，而 ReAct 循环无处不在

三件事同时发生，让文本协议那套模板淡出：

1. **模型侧内化**：为工具调用微调后的模型会把"想—做—看"当成默认行为，思考过程也搬进了不可见的 reasoning token；再在提示里教一遍格式，收益很小、还常常和模型自己的输出习惯打架。
2. **运行时接管**：`Runner.run`、LangGraph 的图/函数、Deep Agents、smolagents 等都把循环、重试、状态、审批、追踪做成了库（本站《LangGraph 入门：用 Graph API 与 Functional API 构建你的第一个智能体》《OpenAI Agents SDK 实战：从第一个 Agent 到交接、护栏与会话》《代码解释器型 Agent：让 LLM 用代码思考（smolagents 与 CodeAct）》）。
3. **动作体进化成代码**：`Action` 不必是单个函数调用。CodeAct 路线让模型一轮里写一段 Python——顺序调用多个工具、带循环与条件、错误栈天然可读。这是同一个循环换了动作语言（详见《代码解释器型 Agent：让 LLM 用代码思考（smolagents 与 CodeAct）》）。

但循环本身没变：**Thought 决定下一步查什么，Observation 决定下一个 Thought 是什么**。今天你写的每一个 Agent runtime——包括各家"规划—执行—反思"的变体、Reflexion 式的自我批评回路——都是这三态的换装。所以读懂它仍然是必要的：框架给的默认循环在什么时候会失控、该在哪一条边上加人工确认、该在哪一步插压缩，都是这套机制的知识。

## 常见坑

1. **把整段工具输出原样回灌**：一次搜索返回 30KB 页面文本，两轮就把窗口吃完。截断、摘要、只回结论字段。
2. **不给显式终止动作**：只靠"模型不再调工具"来判断结束，遇到它输出半句总结又继续调工具时会提前收尾。保留显式 `Finish`/最终输出类型约束（框架侧对应 `tool_use_behavior`）。
3. **解析失败只重试不纠偏**：同一提示再跑一次多半还是错。把"格式要求"作为观察显式回灌，或直接降级为"少样本示例 + 再来一轮"。
4. **把异常吞成空字符串**：`Observation: ""` 等于告诉模型"什么都没发生"，它会原样再试。异常要带类型和可行动信息（`503 upstream unavailable`、`UNKNOWN_ITEM`）。
5. **不限制并发/串行**：一轮里多个工具调用若互相冲突（都写同一行记录），并发执行会打架。默认并行是常态，写操作要显式串行化或加幂等键。
6. **`max_steps` 当成唯一护栏**：步数少但每步 20 万 token 照样烧穿预算。步数、token、时间、成本四个上限一起设。
7. **在无思考可见性的模型上依赖 Thought 审计**：你看到的"Thought"可能是事后编的合理化文本。审计要落在动作序列与观察上，别只信自由文本。
8. **循环检测漏在子任务层**：主循环没重复，但某个子智能体/工具内部在反复调用同一接口。埋点要覆盖到每一层 span。

## 延伸阅读

- 提示层与论文证据：《ReAct 提示模式：推理与行动交替》（Yao et al., 2022 的轨迹示例、HotpotQA/CoT 对比与结果）；全景与反思式回路：《LLM 驱动的自主智能体（Agent）全景：规划、记忆与工具使用》。
- 工作流侧的替代形态（提示链、路由、并行、编排者-工作者）：《规划与任务分解：构建高效智能体的工作流模式》。
- 概念底座译自 Hugging Face Agents Course 的 [Thought](https://huggingface.co/learn/agents-course/en/unit1/thoughts) 与 [Observe](https://huggingface.co/learn/agents-course/en/unit1/observations) 两节（Apache 2.0）。

---

> **来源**：抓取于 2026-09-19。概念与两类清单（思考类型、观察类型）译自 Hugging Face Agents Course 的 [Thought: Internal Reasoning and the ReAct Approach](https://huggingface.co/learn/agents-course/en/unit1/thoughts) 与 [Observe: Integrating Feedback to Reflect and Adapt](https://huggingface.co/learn/agents-course/en/unit1/observations)，作者 Hugging Face Agents Course 团队，许可 Apache 2.0。
> **编者注**：提示层的 ReAct 轨迹示例、论文实验结果与 CoT 对照不再重复，见《ReAct 提示模式：推理与行动交替》《思维链与多路采样：CoT、Self-Consistency 与失效边界》；第二节的文本协议循环、第三节的六项工程控制与"常见坑"为按当前模型 API 与主流框架循环语义整理的实现内容，假工具环境用于离线演示，未接入真实外部服务。原文课程中的图片配图未收录。
