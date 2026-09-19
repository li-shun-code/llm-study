---
title: 推理模型（o1/R1 类）
source_url: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/reasoning
author: Microsoft Learn（Azure OpenAI 文档）· 本站补充
license: CC BY 4.0
fetched_at: 2026-09-13
translated: true
order: 9
---

## 一、什么是推理模型

推理模型（reasoning models）是为应对推理与问题解决任务设计的模型：它们会花**更多时间处理和理解用户请求**，把问题拆解、权衡不同路径、放弃走不通的思路，然后在科学、编码、数学等领域的表现远超普通模型（译自 Microsoft Learn 文档）。

与常规 GPT 类模型的本质区别：普通模型"边想边说"，每个输出 token 直接就是你看到的回答；推理模型会先生成**思考 token**（reasoning tokens），再给出最终回答——相当于把思维链（CoT）从"提示词技巧"变成了模型内建能力（概念起源见本模块《幻觉：成因与缓解》第三节的 `Let's think step by step` 实验）。

**推理模型擅长什么**（译自官方文档的关键能力清单）：

- 复杂代码生成：生成算法、处理高级编码任务；
- 高级问题求解：全面头脑风暴、应对多维度挑战；
- 复杂文档比对：分析合同、案卷、法律文件中的细微差异；
- 指令遵循与工作流管理：管理需要较短上下文的工作流。

反过来说，对"简单问答、短摘要"这类任务，推理模型**更贵且更慢**，收益为零——选型时不要无脑上推理模型。

## 二、演进脉络：从 o1 到 GPT-6（编者注）

| 时间 | 里程碑 |
| ---- | ------ |
| 2024-09 | OpenAI 发布 o1-preview，首创"思考后回答"商用范式 |
| 2025-01 | DeepSeek 发布 R1，用强化学习（GRPO 类可验证奖励）复现推理能力并开源，引爆行业 |
| 2025–2026 | 推理成为旗舰标配：GPT-5.x 统一"快/慢"两档；DeepSeek V4 系内置 `thinking` 开关；Gemini 3.1 Deep Think、Qwen3-Thinking、GLM 思考模式相继跟进 |
| 2026-07 / 09 | GPT-5.6 系列（sol/terra/luna）与 GPT-6 Astra 把推理深度（`reasoning_effort`）与回答详尽度（`verbosity`）变成一等 API 参数 |

## 三、核心机制：思考 token（译自官方文档）

推理模型在熟悉的输入/输出 token 之外，还会生成**思考 token**。模型用它们消化提示：拆解问题、权衡方法、放弃站不住的路径。思考 token**不会出现在回复内容里**，但占用上下文窗口、**按输出 token 计费**。

查看一次请求消耗了多少思考 token：Chat Completions 响应看 `completion_tokens_details.reasoning_tokens`；Responses API 响应看 `output_tokens_details.reasoning_tokens`。

```
{
  "usage": {
    "input_tokens": 75,
    "output_tokens": 1186,
    "output_tokens_details": { "reasoning_tokens": 1024 },
    "total_tokens": 1261
  }
}
```

（上例中可见回复名义上只有 162 个可见输出 token，实际思考消耗了 1024 个。）

`gpt-5.4`、`gpt-5.5` 等模型还支持**交错思考**（interleaved thinking，Responses API）：在思考阶段前后输出可见内容、在工具调用之间继续思考。

## 四、成本与上下文管理（译自官方文档）

- **计费**：思考 token 按输出计费——想得越久越贵，哪怕可见答案很短。可用 Responses API 的 `max_output_tokens`（或 Chat Completions 的 `max_completion_tokens`）设上限；该上限**同时覆盖**思考、可见输出与格式 token。
- **窗口占用**：思考 token 与输入、可见输出共享上下文窗口。单个请求的思考量从几百到数万 token 不等。文档建议：起步阶段给思考 + 输出**预留至少 25,000 token**，摸清自己工作负载的思考量后再调整。
- **截断风险**：如果生成触及窗口上限或 token 上限，响应会以 `status: "incomplete"` 返回——**这可能发生在模型输出任何可见内容之前**，此时你为输入和思考买了单却拿不到答案。务必检查每个响应的 `status`。
- **多轮成本**：多轮对话中每轮都要重发不断增长的历史；开启"跨轮保留思考"会在此基础上叠加早前的思考条目。官方建议配合 Prompt Caching 降低重复输入成本（详见《成本与 Token 优化》）。

## 五、reasoning_effort：思考深度旋钮

`reasoning_effort` 控制模型回答前思考多少。不同模型支持的取值不同，包括 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`，默认值也因模型而异（译自官方文档）：

**表：reasoning_effort 取值与适用场景（译）**

| 档位 | 最适合 |
| ---- | ------ |
| `none` | 对时延敏感、用不上推理或链式工具调用的场景：语音、快速检索、分类 |
| `low` | 折中的高效推理，时延略增：工具使用、规划、搜索、多步决策 |
| `medium` | 大多数工作负载的均衡起点，尤其涉及规划、复杂推理、判断时 |
| `high` | 高难度推理、复杂调试、深度规划，质量重于时延的高价值任务 |
| `xhigh` | 深度研究、异步工作流、长程 Agent 任务——评测证明收益能抵消额外成本时使用 |
| `max` | 最复杂的任务；官方建议从 `xhigh` 切换前先做对比 |

模型会在档位内自适应：简单任务少想、复杂任务多想。档位越高，思考 token 一般越多。注意：`GPT-6 Astra` 不支持 `none` 档；旧 `o1-mini` 不支持该参数。

Python（OpenAI SDK，Responses API）示例：

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5.6-sol",
    reasoning={"effort": "high"},       # 思考深度
    text={"verbosity": "low"},          # 回答详尽度（部分模型支持）
    input="分析这段合同条款的三处潜在法律风险：……",
)
print(response.output_text)
```

## 六、推理模型 + 工具调用（译自官方文档）

把推理与函数/自定义工具结合时，**官方推荐使用 Responses API**。两个硬约束（2026-09 文档原文要点）：

- **GPT-6 Astra**：工具调用**要求** Responses API，且不支持 `none` 推理档，因此 Chat Completions 的绕过方案不适用；
- **GPT-5.6 系列**：支持 Chat Completions + 工具，但**无法在 Chat Completions 上同时开推理与工具**——即使不传 `reasoning_effort` 也会报错（默认 `medium`）：

```
Function tools with reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions.
To use function tools, use /v1/responses or set reasoning_effort to 'none'.
```

官方给出两条出路：推荐迁移到 Responses API；或滞留 Chat Completions 时，在每个带 `tools` 的请求上设 `reasoning_effort: "none"`（代价是失去推理带来的规划质量）。

**跨轮保留思考条目**：推理模型通过 Responses API 调用函数时，应把上一次响应的 reasoning items 连同函数输出一起传回（用 `previous_response_id` 或把 output items 复制进下一个 `input`）。模型就能**接着同一思路继续推理**而不是从头再来，用更少 token 得到好答案。如果对上下文做了裁剪，请保持"最后一条用户消息到函数输出之间"的内容完整。

## 七、R1 类开源推理模型（编者注）

推理能力并非 OpenAI 专属。2025 年初 DeepSeek-R1 证明：用**可验证奖励的强化学习**（数学答案对错、代码测试通过与否作为奖励信号，GRPO 类算法）也能从基座模型中"长出"长思维链，且完全开源——它把推理模型的成本拉低了一个数量级，也确立了"基座 + RL 后训练"的开源推理范式。

到 2026-09，"混合推理"已是所有主流家族的标配，API 形态高度趋同——以 DeepSeek 为例（译自 [DeepSeek API 文档](https://api-docs.deepseek.com/)）：

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"),
    base_url="https://api.deepseek.com",   # OpenAI 兼容端点
)
response = client.chat.completions.create(
    model="deepseek-flash",                # 当前模型名（由 DeepSeek-V4.1-Flash 服务）
    messages=[{"role": "user", "content": "证明：√2 是无理数。"}],
    thinking={"type": "enabled"},          # 开启思考模式
    reasoning_effort="high",
)
print(response.choices[0].message.content)
```

学习建议：推理模型不是"更强的聊天模型"，而是**用 token 换正确率的工具**。把它放在你的应用里最难的 5% 问题上（复杂调试、深度规划、高风险判断），其余交给普通档位——这条"分层调用"原则同样适用于「Agent」的 Agent 架构设计与「微调与部署」的模型部署选型。

## 参考文献

1. Microsoft Learn, *Azure OpenAI reasoning models*. CC BY 4.0.
2. DeepSeek, *API Docs*.（`thinking` / `reasoning_effort` 参数）
3. OpenAI, *Learning to Reason with LLMs*（o1 技术报告页，2024）.
4. DeepSeek-AI, *DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning*（arXiv:2501.12948）.

---

> **来源**：本文翻译自 [Microsoft Learn · Azure OpenAI reasoning models](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/reasoning)（微软官方文档，CC BY 4.0），作者 Microsoft。抓取/翻译于 2026-09-13。
> "R1 类开源推理模型"与"演进脉络"两节为本站补充，数据核实自 DeepSeek API 文档与各官方页面（2026-09-13）；文中 API 示例按 Responses API 时代写法保留。
