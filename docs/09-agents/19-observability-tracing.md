---
title: 可观测性与 Tracing：Agent 生产排障的第一工具（LangSmith / Langfuse / OpenTelemetry）
source_url: https://docs.langchain.com/langsmith/observability-concepts
author: LangChain 团队（LangSmith 官方文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: LangSmith 当前版（docs.langchain.com）
order: 19
---

# 为什么 Tracing 是 Agent 生产排障的第一工具

本模块第 9 篇（Anthropic 多智能体系统）里有一段亲身经历：用户报告智能体"找不到明显的信息"，团队却看不出为什么——是搜索词太差、来源选得不好，还是工具调用失败？**加上完整的生产追踪（Tracing）之后，才能系统性地诊断失败并修复**。

传统 Web 应用的排障工具是日志 + 指标 + 链路追踪（如 OpenTelemetry）。Agent 应用多了一层复杂性：一次用户请求内部有"模型调用 → 工具调用 → 再模型调用"的多步嵌套链路，每步的输入输出都是长文本，且执行路径不确定。因此 Agent 可观测性的核心是 **Trace（追踪）**：把一次请求中每一步的完整输入、输出、耗时、token 用量、错误都记录成树状结构。这是调试失败、监控质量、构建评估数据集的基础。

主流方案有三类：LangSmith（LangChain 出品，SaaS/自托管）、Langfuse（开源、基于 OpenTelemetry 构建，可自托管，MIT 核心许可）、以及直接使用 OpenTelemetry 的 GenAI 语义约定（Semantic Conventions for Generative AI）把 trace 导入任意兼容后端（Jaeger、Grafana Tempo、Datadog 等）。三者数据模型高度相似，学会下面 LangSmith 的概念即可触类旁通。

# LangSmith 如何结构与可视化数据

LangSmith Observability 让你记录、检查并分析 AI 智能体执行的每一步。本节解释这些数据在 LangSmith 中如何结构与可视化，以及如何开始发送 trace。

在 LangSmith 中，智能体执行的每个工作单元——模型调用、工具调用、信息检索——都被记录为一个 *run*。一次操作的全部 run 收集为一条 *trace*。多轮会话的多条 trace 可以串成一条 *thread*（线程）。

*trajectory*（轨迹）是组织与可视化这些数据的另一种方式：thread 保留一个会话中各条 trace 的嵌套结构，而 trajectory 把整个会话**摊平**成一份按顺序排列的消息列表，展示智能体从头到尾走过的路径。

![thread 与 trajectory 的区别](https://mintcdn.com/langchain-5e9cc07a/_6XeQZT2NAQ4WqkK/langsmith/images/thread-trajectory-light.png?fit=max&auto=format&n=_6XeQZT2NAQ4WqkK&q=85&s=e770ae021710ef231582cd59aae3a403)

*图：thread 保留会话 trace 的嵌套；trajectory 把同一会话摊平为有序消息列表。*

## Run（运行）

一个 *run* 代表智能体执行的单个工作单元：调用一次 LLM、格式化一个提示、检索一批文档。如果你熟悉 [OpenTelemetry](https://opentelemetry.io/)，可以把 run 想象成一个 span。

## Trace（追踪）

一条 *trace* 是单次操作的全部 run 的集合。例如用户请求触发了一个智能体，它调用模型、运行工具、再调用模型——这些 run 都属于同一条 trace。run 通过唯一的 trace ID 绑定到 trace。

> **注**：每条 trace 最多 25,000 个 run，达到上限后 LangSmith 会拒绝该 trace 的新增 run。

## Thread（线程）

一个 *thread* 是代表一次多轮会话的 trace 序列。一轮（turn）是会话中的一次交互：用户的一条消息 + 智能体为响应它所做的一切，每轮记录为一条独立 trace。把 trace 分组到 thread 的方式是传入带唯一值的 `thread_id` 元数据键。

## Trajectory（轨迹）

trajectory 是一份扁平、有序的消息列表，展示智能体从头到尾的路径。它是对 thread 内 trace 的投影：包含会话中出现过的人类、AI 与工具消息，每条消息只出现一次、按首次出现的顺序排列，去掉 run 的嵌套。

## Trace、Thread、Trajectory 对比

| | Trace | Thread | Trajectory |
| --- | --- | --- | --- |
| 形态 | run 组成的树 | trace 组成的序列 | 扁平有序的消息列表 |
| 包含 | 每个 run 的完整输入输出 | 每条关联 trace 中的每个 run | 每条关联 trace 中的每条消息（去重） |
| 适用场景 | 调试"这次操作为什么失败/慢" | 检查智能体跨轮次的行为（保留时序与嵌套） | 阅读会话里交换了什么，无需执行细节 |

**表：三种数据组织单位的对比。**

### Project（项目）

一个 *project* 是与单个应用或服务相关的所有 trace 的容器。

## Trace 增强

- **Feedback（反馈）**：按某些标准给单个 run 打分。每条反馈由标签与分数组成，通过唯一 run ID 绑定到 run；可以是连续分数或离散类别；
- **Tags（标签）**：附加在 run 上的字符串，用于在界面中分类、过滤与分组；
- **Metadata（元数据）**：附加在 run 上的键值对（应用版本、环境等上下文信息），同样支持过滤与分组。

## 发送 trace 的两种方式

**1. 集成（Integrations）**：为流行的 LLM 提供商与智能体框架提供自动追踪（相当于通用可观测性里的自动插桩）。使用 LangChain、LangGraph、OpenAI、Anthropic、CrewAI 等受支持框架时，集成会自动捕获输入、输出与元数据，无需改代码。

**2. 手动插桩（Manual instrumentation）**：给任意代码加追踪、完全控制追踪粒度。LangSmith 提供三种机制：

- `@traceable` 装饰器：追踪任意函数；
- `trace` 上下文管理器（Python）：包裹特定代码块；
- `RunTree` API：底层、显式地构造 trace。

## 数据保留

LangSmith（SaaS）把 trace 数据保留 180 天，之后永久删除（仅保留少量用于用量统计的元数据）。想把数据保留更久，可以把它加入数据集（Dataset）——数据集永久保存，即使源 trace 已被删除。

# 追踪快速上手

LangSmith 通过捕获 *trace*（一次请求中每一步的完整记录：从传入的输入到最终返回的输出）给你的 LLM 应用端到端的可见性。

> **提示**：如果你在用 LangChain 或 LangGraph，一个环境变量就能开启 LangSmith 追踪（`LANGSMITH_TRACING=true`），详见官方 trace-with-LangChain/LangGraph 页。本模块第 10-11 篇的 LangGraph 代码加上环境变量即可自动出 trace。

## 前置条件

- 一个 LangSmith 账号（[smith.langchain.com](https://smith.langchain.com) 注册，无需信用卡）；
- 一个 LangSmith API Key（Settings > API Keys > Create API Key）；
- 一个 OpenAI API Key（示例用 OpenAI 作为 LLM 提供商，可替换为你的提供商）。

## 第 1 步：配置环境

```bash
mkdir ls-quickstart && cd ls-quickstart
python -m venv .venv && source .venv/bin/activate
pip install -U langsmith openai
```

在 shell 中导出环境变量：

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY="<your-langsmith-api-key>"
export OPENAI_API_KEY="<your-openai-api-key>"
```

要把 trace 发到指定项目，设置 `LANGSMITH_PROJECT` 环境变量；未设置时 LangSmith 会在收到第一条 trace 时自动创建默认项目。美国以外区域还需设置 `LANGSMITH_ENDPOINT`（如 EU 区域 `https://eu.api.smith.langchain.com`，URL 末尾不要加斜杠，否则认证会失败）。

## 第 2 步：构建应用

下面的应用用到两个 LangSmith 工具：

- **OpenAI 包装器（wrap_openai）**：包装 OpenAI 客户端，让每次 LLM 调用自动记录为嵌套 span；
- **Traceable 包装器（@traceable）**：包装函数，使其输入、输出与嵌套 span 呈现为一条完整 trace。

`assistant` 函数先调用工具（`get_context`）取回上下文，再把上下文交给模型。两个函数都用 traceable 包装后，整条管线（工具调用 + LLM 调用）就被捕获为一条 trace，其中工具调用和 LLM 调用是嵌套 span。

创建 `app.py`：

```python
from openai import OpenAI
from langsmith.wrappers import wrap_openai
from langsmith import traceable

client = wrap_openai(OpenAI())  # 自动记录每次 OpenAI 调用

@traceable(run_type="tool")  # 作为 tool span 追踪
def get_context(question: str) -> str:
    # 真实应用中，这里会查询知识库或向量库
    return "LangSmith traces are stored for 14 days on the Developer plan."

@traceable  # 把完整管线捕获为单条 trace
def assistant(question: str) -> str:
    context = get_context(question)
    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {
                "role": "system",
                "content": f"Answer using the context below.\n\nContext: {context}",
            },
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content

print(assistant("How long are traces stored?"))
```

运行后打开 LangSmith 控制台，即可看到这条 trace 的树状结构：`assistant` 根节点下挂着 `get_context` 工具 span 与一次 OpenAI 模型调用 span，每一步的输入输出、延迟与 token 计数一目了然。

# OpenTelemetry 与 Langfuse：开放标准路线

如果不想绑定特定 SaaS，可以用 **OpenTelemetry（OTel）** 路线。OTel 社区维护了 GenAI 语义约定（把 LLM 调用、工具调用、token 用量等建模为标准 span 属性），Langfuse 自身就是基于 OTel 构建的：

- **Langfuse**：开源 LLM 可观测性平台，核心 MIT 许可、可自托管；Python/JS SDK 之外支持通过 OTel endpoint 直接接入（OpenAI Agents SDK、LangGraph、AutoGen 等框架都有现成的 OTel 导出方案）。数据模型同样是 trace → span/observation（generation、tool）树；
- **LangSmith 导出 OTel**：LangSmith 也支持把遥测数据导出到你自己的可观测性后端（Datadog、Splunk 等），与现有 APM 体系共存；
- **自建**：任何能产生 OTel span 的代码（`opentelemetry-sdk` + GenAI 约定）都能接入任意兼容后端。

选型建议：团队已重仓 LangChain 生态、要"评估-追踪-提示管理"一体化，选 LangSmith；要开源自托管、多云厂商中立，选 Langfuse（或纯 OTel + 自选后端）。无论哪条路线，落地的关键动作是相同的：**给每次运行带上 trace_id/thread_id、给每步记录输入输出与 token、把用户反馈挂回 run**——做到这三点，Agent 上线后的"玄学问题"就都有了可回放的现场。

---

> **来源**：本文主体翻译自 LangSmith 官方文档 [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts) 与 [Tracing quickstart](https://docs.langchain.com/langsmith/observability-quickstart) 两页，作者 LangChain 团队，许可 MIT。抓取于 2026-09-13。开头与结尾关于 Langfuse/OpenTelemetry 生态的段落为编者综述。
