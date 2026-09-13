---
title: AutoGen 与 CrewAI：多智能体框架现状（AutoGen 已并入 Microsoft Agent Framework）
source_url: https://github.com/microsoft/agent-framework
author: Microsoft（Agent Framework 团队）、CrewAIInc 贡献者
license: MIT
fetched_at: 2026-09-13
translated: true
versions: Microsoft Agent Framework（当前版，Python/.NET/Go）；CrewAI 0.x 当前版（Python >=3.10,<3.14）
order: 12
---
# Microsoft Agent Framework（AutoGen 的继任者）

Microsoft Agent Framework（MAF）是一个开放的多语言框架，用于在 **.NET 与 Python** 中构建**生产级 AI 智能体与多智能体工作流**（Go SDK 见 [microsoft/agent-framework-go](https://github.com/microsoft/agent-framework-go/)）。

MAF 为"把智能体从原型带到生产"的团队而设计：为构建、编排和运维智能体系统提供一致的基础，同时保持架构选择的开放性；支持包括 Microsoft Foundry、Azure OpenAI、OpenAI 与 GitHub Copilot SDK 在内的广泛生态，并为本地开发和云端部署提供样例与托管模式。

## 这是否是适合你的框架？

如果你符合以下情形，MAF 是很好的选择：

- 构建预期要在生产环境运行的智能体与工作流；
- 需要超出"单次提示或无状态聊天循环"的编排能力；
- 想要基于图的模式：顺序（sequential）、并发（concurrent）、交接（handoff）、群组协作（group collaboration）；
- 在意持久性、可重启性、可观测性、治理或 human-in-the-loop 控制；
- 需要提供商灵活性，让架构随需求演进而不必大规模重写。

## 关键特性

- **Python 与 C#/.NET 双支持**：两个语言栈提供一致的 API；
- **多智能体提供商支持**：支持多种 LLM 提供商且持续增加；
- **中间件（Middleware）**：灵活的中间件系统，用于请求/响应处理、异常处理与自定义管线；
- **编排模式与工作流**：基于图的工作流支持顺序、并发、交接、群组协作模式，包含检查点（checkpointing）、流式、human-in-the-loop 与时间旅行（time-travel）；
- **Foundry 托管智能体（新）**：只需额外两行代码即可把智能体部署到 Foundry 托管基础设施；
- **可观测性**：内置 OpenTelemetry 集成，支持分布式追踪、监控与调试（见第 16 篇）；
- **声明式智能体**：用 YAML 定义智能体，便于快速启动与版本管理；
- **Agent Skills**：从文件、内联代码、类库等多来源构建领域知识库供智能体发现和使用；
- **AF Labs**：面向基准测试、强化学习等前沿特性的实验性包；
- **DevUI**：用于智能体开发、测试与工作流调试的交互式开发者 UI。

## 安装

Python：

```bash
pip install agent-framework
# 安装标准包集合；实验模块需单独安装 `agent-framework-lab`。
```

.NET：

```bash
dotnet add package Microsoft.Agents.AI
# Foundry 集成（下方 .NET 快速上手用到）：
dotnet add package Microsoft.Agents.AI.Foundry
dotnet add package Azure.AI.Projects
dotnet add package Azure.Identity
```

## 快速上手

### 基础智能体（Python）

创建一个用 Microsoft Foundry 写俳句的简单智能体：

```python
# pip install agent-framework
# 使用 `az login` 完成 Azure CLI 认证
import os
import asyncio
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential


async def main():
    # 用 Microsoft Foundry 初始化聊天智能体
    # endpoint、部署名与 api version 可通过环境变量设置，
    # 也可直接传给 FoundryChatClient 构造函数
    agent = Agent(
      client=FoundryChatClient(
          credential=AzureCliCredential(),
          # project_endpoint=os.environ["FOUNDRY_PROJECT_ENDPOINT"],
          # model=os.environ["FOUNDRY_MODEL_DEPLOYMENT_NAME"],
      ),
      name="HaikuAgent",
      instructions="You are an upbeat assistant that writes beautifully.",
    )

    print(await agent.run("Write a haiku about Microsoft Agent Framework."))

if __name__ == "__main__":
    asyncio.run(main())
```

### 基础智能体（.NET）

```c#
using Azure.AI.Projects;
using Azure.Identity;
using Microsoft.Agents.AI;

string endpoint = Environment.GetEnvironmentVariable("AZURE_AI_PROJECT_ENDPOINT") ?? throw new InvalidOperationException("AZURE_AI_PROJECT_ENDPOINT is not set.");
string deploymentName = Environment.GetEnvironmentVariable("AZURE_AI_MODEL_DEPLOYMENT_NAME") ?? "gpt-5.4-mini";

AIAgent agent =
    new AIProjectClient(new Uri(endpoint), new DefaultAzureCredential())
    .AsAIAgent(model: deploymentName, instructions: "You are an upbeat assistant that writes beautifully.", name: "HaikuAgent");

// 拿到智能体后，可以像任何其他 AIAgent 一样调用它。
Console.WriteLine(await agent.RunAsync("Write a haiku about Microsoft Agent Framework."));
```

## 更多样例

Python 侧的学习路径：[Getting Started](https://github.com/microsoft/agent-framework/tree/main/python/samples/01-get-started)（从 hello-world 到 workflows 的渐进教程）→ [Agent Concepts](https://github.com/microsoft/agent-framework/tree/main/python/samples/02-agents)（工具、中间件、提供商等专题）→ [Workflows](https://github.com/microsoft/agent-framework/tree/main/python/samples/03-workflows)（工作流创建与智能体集成）→ [Hosting](https://github.com/microsoft/agent-framework/tree/main/python/samples/04-hosting)（A2A、Foundry 托管智能体）→ [End-to-End](https://github.com/microsoft/agent-framework/tree/main/python/samples/05-end-to-end)（完整应用与评测）。

## 故障排查要点

| 问题 | 原因 | 解决 |
| --- | --- | --- |
| 使用 Azure 凭据时认证报错 | 未登录 Azure CLI | 启动应用前先 `az login` |
| API key 报错 | Key 错误或缺失 | 校验 Key 是否对应正确的资源/提供商 |

**表：MAF 常见认证问题。**

> **提示**：`DefaultAzureCredential` 开发时方便，但生产环境建议使用具体凭据（如 `ManagedIdentityCredential`），以避免延迟问题、意外的凭据探测以及回退机制带来的安全风险。

## 重要声明（摘要）

用 MAF 构建与任何第三方服务器、智能体、代码或非 Azure 直连模型交互的应用时，风险自担；第三方系统受其自身许可条款约束，使用与相关费用由你负责。微软建议审查所有与第三方系统交换的数据，自行实现负责任 AI 缓解措施（如元提示、内容过滤或其他安全系统），并确保应用满足质量、可靠性、安全与可信标准。

# CrewAI：角色驱动的多智能体框架

[ CrewAI](https://github.com/crewAIInc/crewAI) 是一个开源 Python 框架，用高层抽象与低层 API 构建生产可用的多智能体工作流。它通过 **Crews（团队）** 给予开发者自主的智能体协作，通过 **Flows（流）** 给予精确的、事件驱动的控制。许可 MIT，要求 `Python >=3.10 且 <3.14`。

## 为什么选 CrewAI？

- **为智能体编排而生的架构**：轻量 Python 内核与干净的原语，面向真实自动化场景；
- **高性能**：为速度与最小资源占用优化，执行更快；
- **灵活的底层定制**：从工作流、系统架构到智能体行为、内部提示、执行逻辑，都可以完全自定义；
- **适配各种用例**：从简单任务、复杂工作流到生产级自动化都有验证；
- **活跃社区**：超过 10 万名认证开发者提供支持与资源。

## 理解 Flows 与 Crews

CrewAI 提供两种互补的方法：

1. **Crews（团队）**：具有真正自主性（agency）的 AI 智能体团队，通过**基于角色的协作**完成复杂任务。Crew 支持：
   - 智能体之间自然、自主的决策；
   - 动态任务委派与协作；
   - 有明确目标与专长的专门化角色；
   - 灵活的问题解决方式。

2. **Flows（流）**：生产可用、事件驱动的工作流，对复杂自动化提供精确控制。Flows 提供：
   - 对执行路径的细粒度控制；
   - 任务之间安全、一致的状态管理；
   - AI 智能体与生产 Python 代码的干净集成；
   - 支持复杂业务逻辑的条件分支。

CrewAI 的真正威力在于**把 Crews 与 Flows 组合**：既能保持自主性又有精确控制，代码结构清晰可维护。

## 安装与上手

CrewAI 使用 [uv](https://docs.astral.sh/uv/) 管理依赖。先安装 uv，再安装 CrewAI CLI：

```shell
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install crewai
uv tool list   # 验证安装，应看到 crewai v0.102.0 之类输出
```

创建项目（JSON-first 脚手架：智能体在 `agents/*.jsonc`，任务与团队级设置在 `crew.jsonc`）：

```shell
crewai create crew latest-ai-development
cd latest_ai_development
```

如需旧的 Python/YAML 脚手架（`crew.py`、`config/agents.yaml`、`config/tasks.yaml`），加 `--classic` 参数。

### 定义一个顺序流程的 Crew

**agents/researcher.jsonc**

```jsonc
{
  "role": "{topic} Senior Data Researcher",
  "goal": "Uncover cutting-edge developments in {topic}",
  "backstory": "You're a seasoned researcher who finds relevant information and presents it clearly.",
  "llm": "openai/gpt-4o",
  "tools": ["SerperDevTool"],
  "settings": {
    "verbose": true
  }
}
```

**agents/reporting_analyst.jsonc**

```jsonc
{
  "role": "{topic} Reporting Analyst",
  "goal": "Create detailed reports based on {topic} data analysis and research findings",
  "backstory": "You're a meticulous analyst who turns complex data into clear, concise reports.",
  "llm": "openai/gpt-4o",
  "settings": {
    "verbose": true
  }
}
```

**crew.jsonc**

```jsonc
{
  "name": "Latest AI Development",
  "agents": ["researcher", "reporting_analyst"],
  "tasks": [
    {
      "name": "research_task",
      "description": "Conduct thorough research about {topic}. Find recent, relevant information.",
      "expected_output": "A list with 10 bullet points of the most relevant information about {topic}.",
      "agent": "researcher"
    },
    {
      "name": "reporting_task",
      "description": "Review the research and expand each topic into a full section for a report.",
      "expected_output": "A markdown report with the main topics, each with a full section of information.",
      "agent": "reporting_analyst",
      "context": ["research_task"],
      "output_file": "output/report.md",
      "markdown": true
    }
  ],
  "process": "sequential",
  "verbose": true,
  "inputs": {
    "topic": "AI Agents"
  }
}
```

每个智能体由 **role（角色）/ goal（目标）/ backstory（背景故事）** 三要素定义——这是 CrewAI 的标志性设计，通过角色扮演引导分工。

### 运行

在 `.env` 中配置模型提供商 API Key（以及使用网络搜索时的 [Serper.dev](https://serper.dev/) Key），然后：

```shell
crewai install
crewai run
```

除顺序流程（sequential）外，还可以用**层级流程（hierarchical）**：框架自动为团队指定一个管理者（manager），通过委派与结果校验来协调任务的规划与执行。

### 用 Flows 编排多个 Crews

Flows 支持 `or_` / `and_` 逻辑算子组合触发条件，配合 `@start`、`@listen`、`@router` 装饰器构建复杂触发逻辑：

```python
from crewai.flow.flow import Flow, listen, start, router, or_
from crewai import Crew, Agent, Task, Process
from pydantic import BaseModel

# 定义结构化状态以精确控制
class MarketState(BaseModel):
    sentiment: str = "neutral"
    confidence: float = 0.0
```

## 核心特性一览

- **Crews 提供自主性**：为专门化的 AI 智能体建模角色、目标、工具与任务；
- **Flows 提供控制**：事件驱动的工作流，带状态、分支、路由与生产逻辑；
- **无缝集成**：组合 Crews 与 Flows 构建复杂真实自动化；
- **Python 原生定制**：提示、工具、执行路径、状态与集成皆可定制；
- **智能体能力**：工具、记忆、知识、检查点、异步执行与 MCP/A2A 支持；
- **生产就绪模式**：确定性步骤、人工输入（human input）、结构化输出、检查点。

# 选型小结

| 框架 | 定位 | 适合谁 |
| --- | --- | --- |
| Microsoft Agent Framework（原 AutoGen + Semantic Kernel） | 生产级多智能体编排（.NET/Python/Go），图工作流 + 治理 + OpenTelemetry | 微软生态、企业生产、需要 .NET 的团队 |
| CrewAI | 角色驱动的团队协作（Crews）+ 事件驱动控制流（Flows） | 想快速搭"角色分工小组"原型的 Python 开发者 |
| LangGraph | 显式图状态机，精细控制中断/持久化 | 需要完全掌控执行拓扑的团队（本模块第 10-11 篇） |
| OpenAI Agents SDK | 轻量 handoff/工具优先 | OpenAI 生态、想要最小抽象的团队（第 13 篇） |

**表：主流多智能体框架选型对比。**

学习建议：多智能体是"加速器"也是"成本放大器"——先确保单智能体 + 工具的链路可靠（第 1-8 篇），再引入多智能体协作；框架本身没有高下之分，选与你团队语言栈和生产约束匹配的那个。

---

> **来源**：本文主体翻译自 [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) 官方 README（作者 Microsoft Agent Framework 团队，许可 MIT），CrewAI 部分译自 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) 官方 README（作者 CrewAIInc 贡献者，许可 MIT）。抓取于 2026-09-13。

---

> **重要版本现状（务必先读）**：**AutoGen 已并入 Microsoft Agent Framework（MAF）**。微软把 AutoGen（多智能体研究框架）与 Semantic Kernel（企业级 AI 编排框架）两条产品线合并，形成统一的 Microsoft Agent Framework。现在，AutoGen 官方仓库定位为研究/历史资料，**新的生产开发都发生在 `microsoft/agent-framework`**；微软官方提供了《[从 AutoGen 迁移](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen)》与《[从 Semantic Kernel 迁移](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-semantic-kernel)》两份指南。网上大量 AutoGen 教程（`autogen.ConversableAgent`、`GroupChatManager` 等写法）仍可运行，但已不代表微软推荐的当前路线。本文按 MAF 现状讲授。
