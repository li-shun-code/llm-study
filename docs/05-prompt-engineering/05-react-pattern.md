---
title: ReAct 提示模式：推理与行动交替
source_url: https://www.promptingguide.ai/techniques/react
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 5
versions: 提示技术通用；实战示例按 OpenAI Responses API/函数调用校订（原文 LangChain 旧接口已废弃，见译注）
---

Yao et al., 2022 提出了一个名为 **ReAct** 的框架：让 LLM 以交错（interleaved）的方式同时生成**推理轨迹**（reasoning traces）与**任务相关的行动**（task-specific actions）。

生成推理轨迹让模型能够归纳、跟踪、更新行动计划，甚至处理异常情况；行动步骤则让模型可以与外部源（知识库、环境等）交互并从中获取信息。

ReAct 框架让 LLM 能够调用外部工具检索额外信息，从而给出更可靠、更符合事实的回答。结果表明，ReAct 在语言任务和决策任务上都能超过多个当时最先进的基线；它还提升了 LLM 的可解释性与可信度。作者总结发现：最佳方案是将 ReAct 与思维链（CoT）结合，同时利用模型内部知识与推理过程中从外部获取的信息。

## 工作原理

ReAct 的灵感来自人类学习和决策时"行动"与"推理"之间的协同。

思维链（CoT）提示已经展示了 LLM 生成推理轨迹、解答算术与常识推理问题的能力（Wei et al., 2022）。但 CoT 缺乏与外部世界的连接、无法更新自身知识，会导致事实幻觉（fact hallucination）和错误传播（error propagation）等问题。

ReAct 是一个将推理与行动结合的通用范式：它提示 LLM 为任务生成"语言化的推理轨迹 + 行动"。这让系统可以进行动态推理——创建、维护并调整行动计划——同时与外部环境（如维基百科、搜索引擎）交互，把额外信息纳入推理。下图展示了用 ReAct 做问答的各个步骤：

![ReAct 流程图](https://www.promptingguide.ai/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Freact.8e7c93ae.png&w=1920&q=75)

*图：ReAct 在 HotpotQA 上的问答轨迹（图片来源：Yao et al., 2022）*

以 HotpotQA 的一个典型问题为例：

```
Aside from the Apple Remote, what other devices can control the program Apple Remote was originally designed to interact with?
```

（实际提示中还会加入上下文示例，此处为简洁省略。）可以看到，模型生成**任务求解轨迹**（task solving trajectories）：Thought（想法）与 Act（行动）交替出现，Obs（Observation，观测）则对应来自被交互环境（如搜索引擎）的反馈。本质上，ReAct 让"检索支撑推理、推理指导检索"形成闭环。

## ReAct 提示词

要演示 ReAct 提示如何工作，我们沿用论文中的例子。

第一步是从训练集（如 HotpotQA）中选取案例，编写 ReAct 格式的轨迹，作为提示词中的少样本示范。轨迹由多个"想法—行动—观测"步骤构成。其中自由格式的想法（thought）承担不同职责：分解问题、抽取信息、执行常识/算术推理、引导搜索词的构造、以及综合最终答案。

下面是 ReAct 提示示范的样子（取自论文，为简洁只保留一个示例）：

```
Question What is the elevation range for the area that the eastern sector of the
Colorado orogeny extends into?
Thought 1 I need to search Colorado orogeny, find the area that the eastern sector
of the Colorado orogeny extends into, then find the elevation range of the
area.
Action 1 Search[Colorado orogeny]
Observation 1 The Colorado orogeny was an episode of mountain building (an orogeny) in
Colorado and surrounding areas.
Thought 2 It does not mention the eastern sector. So I need to look up eastern
sector.
Action 2 Lookup[eastern sector]
Observation 2 (Result 1 / 1) The eastern sector extends into the High Plains and is called
the Central Plains orogeny.
Thought 3 The eastern sector of Colorado orogeny extends into the High Plains. So I
need to search High Plains and find its elevation range.
Action 3 Search[High Plains]
Observation 3 High Plains refers to one of two distinct land regions
Thought 4 I need to instead search High Plains (United States).
Action 4 Search[High Plains (United States)]
Observation 4 The High Plains are a subregion of the Great Plains. From east to west, the
High Plains rise in elevation from around 1,800 to 7,000 ft (550 to 2,130
m).[3]
Thought 5 High Plains rise in elevation from around 1,800 to 7,000 ft, so the answer
is 1,800 to 7,000 ft.
Action 5 Finish[1,800 to 7,000 ft]
...
```

注意，不同类型的任务使用不同的提示设置：以推理为主的问题（如 HotpotQA）会使用多个"想法—行动—观测"步骤；而涉及大量行动步骤的决策任务中，想法则用得较稀疏。

## 知识密集型任务上的结果

论文首先在问答（HotpotQA）与事实验证（Fever）等知识密集型推理任务上评估 ReAct，基座模型为 PaLM-540B。结果显示 ReAct 总体优于只行动不思考的 Act；在 Fever 上超过 CoT，在 HotpotQA 上略逊于 CoT。论文中的错误分析可总结为：

- CoT 容易产生事实幻觉；
- ReAct 的结构化约束降低了推理步骤编排的灵活性；
- ReAct 高度依赖检索到的信息——无效的搜索结果会把模型推理带偏，且难以恢复和重整思路。

能够在 ReAct 与 CoT + 自洽性（Self-Consistency）之间切换或组合的提示方法，总体上优于其他所有方法。

## 决策类任务上的结果

论文还在两个决策基准上评估了 ReAct：[ALFWorld](https://alfworld.github.io/)（文字游戏）与 [WebShop](https://webshop-pnlp.github.io/)（网购环境模拟），二者都需要"边推理边行动"地探索复杂环境。ReAct 在两个基准上都优于 Act——没有想法（thought）的 Act 无法把目标正确分解为子目标。推理对这些任务是有利的，但基于提示的方法离专家人类的表现仍有距离。

## 实战：从旧式 Chain 到现代函数调用

原文给出的实战示例使用的是旧版 LangChain 接口（`OpenAI(model_name="text-davinci-003")` 与 `initialize_agent(..., agent="zero-shot-react-description")`）。这套 Completion 模型与 Chain 写法如今均已废弃，因此本节不照录旧代码，只保留其执行轨迹并按现代 API 校订。

原文示例的执行轨迹如下（搜索引擎查男友、计算器算幂）：

```
> Entering new AgentExecutor chain...
 I need to find out who Olivia Wilde's boyfriend is and then calculate his age raised to the 0.23 power.
Action: Search
Action Input: "Olivia Wilde boyfriend"
Observation: Olivia Wilde started dating Harry Styles after ending her years-long engagement to Jason Sudeikis — see their relationship timeline.
Thought: I need to find out Harry Styles' age.
Action: Search
Action Input: "Harry Styles age"
Observation: 29 years
Thought: I need to calculate 29 raised to the 0.23 power.
Action: Calculator
Action Input: 29^0.23
Observation: Answer: 2.169459462491557
 
Thought: I now know the final answer.
Final Answer: Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557.
 
> Finished chain.
```

> **译注（按 2026-09 现状校订）**：今天实现同样的 ReAct 循环，不需要再用提示词去"模拟"行动格式，而是把"行动"表达为**函数调用/工具调用**：在 Responses API 中给模型提供 `tools`，模型输出的 `function_call` 就是 Action，我们把执行结果作为观测回填、循环直到模型给出最终回答。骨架示意如下：

```python
import json
import openai

client = openai.OpenAI()  # 从环境变量读取 OPENAI_API_KEY

TOOLS = [
    {"type": "function", "name": "web_search", "description": "搜索外部信息",
     "parameters": {"type": "object", "properties": {"query": {"type": "string"}},
                    "required": ["query"]}},
]

def run_react(question: str, max_steps: int = 8) -> str:
    input_items = [{"role": "user", "content": question}]
    for _ in range(max_steps):
        resp = client.responses.create(
            model="gpt-5.1",
            instructions="用 ReAct 方式工作：先简短写出 Thought（当前想法），"
                         "再决定是否调用工具；信息足够时直接给出 Final Answer。",
            input=input_items,
            tools=TOOLS,
        )
        # 模型决定"行动"：调用工具
        calls = [o for o in resp.output if o.type == "function_call"]
        if not calls:
            return resp.output_text  # Thought 之后直接得出最终答案
        input_items += calls  # 把模型输出的调用加入对话
        for call in calls:
            # 这里执行真正的"行动"（搜索/计算器等），结果作为 Observation 回填
            observation = do_search(json.loads(call.arguments)["query"])
            input_items.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": observation,
            })
    raise RuntimeError("超过最大步数，仍未收敛")
```

这套"Thought → Action → Observation"循环，正是「Agent」Agent 章节里 Agent 执行循环的原型。

原文的示例 notebook 见 [dair-ai/Prompt-Engineering-Guide/notebooks/react.ipynb](https://github.com/dair-ai/Prompt-Engineering-Guide/blob/main/notebooks/react.ipynb)。

## 小结

- ReAct = Reasoning + Acting：推理轨迹与外部行动交替，检索支撑推理、推理指导检索；
- 提示形态：少样本给出"想法—行动—观测"轨迹示范；推理密集的任务多写 Thought，行动密集的任务少写；
- 现代实现中，Action 通常由函数调用（function calling）承载，ReAct 从"纯提示技术"演化为 Agent 框架的执行内核。

---

> **来源**：本文翻译自 [ReAct Prompting](https://www.promptingguide.ai/techniques/react)，作者 DAIR.AI（Elvis Saravia），许可 MIT。抓取于 2026-09-13。
