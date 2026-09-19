---
title: 代码解释器型 Agent：让 LLM 用代码思考（smolagents 与 CodeAct）
source_url: https://github.com/huggingface/smolagents
author: Aymeric Roucher 等（Hugging Face smolagents 团队）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: smolagents 当前版（Apache 2.0）
order: 19
group: 行动型 Agent
---
# 概念：什么是代码解释器型 Agent

本模块第 3 篇讲过，智能体的"动作"有两种主流表达：**JSON 工具调用**（Function Calling）与**代码**。代码解释器型 Agent（也叫 Code Agent、CodeAct 风格智能体）选择后者：把"生成并执行一段 Python 代码"作为智能体的通用动作语言，循环的每一轮都在一个受控的 Python 解释器里执行模型写下的代码，把执行结果（打印输出、变量状态、错误栈）作为观察反馈给模型。

这带来三个直接收益：一个代码块可以顺序调用多个工具、带循环与条件逻辑（一次动作干多件事）；错误信息天然是可读的调试信号；模型在海量真实代码上预训练过，"写代码调用工具"贴合它的先验。代价则是安全：等于给模型任意代码执行能力，必须放进沙箱。smolagents 是这一路线的代表性开源实现。

# smolagents

`smolagents` 是一个让你用几行代码运行强大智能体的库。它提供：

- **简洁**：智能体的核心逻辑只有约 1,000 行代码（见 [agents.py](https://github.com/huggingface/smolagents/blob/main/src/smolagents/agents.py)）——抽象被压缩到裸代码之上的最小形态；
- **一等公民的 Code Agent**：[`CodeAgent`](https://huggingface.co/docs/smolagents/reference/agents#smolagents.CodeAgent) 用代码书写自己的动作（注意，是"智能体用代码行动"，而不是"智能体被用来写代码"）。为保证安全，支持通过 [Blaxel](https://blaxel.ai)、[E2B](https://e2b.dev/)、[Modal](https://modal.com/) 或 Docker 在沙箱环境中执行；
- **Hub 集成**：可以把工具或智能体[分享到 Hub / 从 Hub 拉取](https://huggingface.co/docs/smolagents/reference/tools#smolagents.Tool.from_hub)，即时共享最高效的智能体；
- **模型无关**：支持任何 LLM——本地 `transformers` 或 `ollama` 模型、[Hub 上的众多推理提供商](https://huggingface.co/blog/inference-providers)，或经 [LiteLLM](https://www.litellm.ai/) 集成接入 OpenAI、Anthropic 等任意模型；
- **模态无关**：智能体支持文本、视觉、视频甚至音频输入（视觉示例见[官方教程](https://huggingface.co/docs/smolagents/examples/web_browser)）；
- **工具无关**：可以使用来自任何 [MCP 服务器](https://huggingface.co/docs/smolagents/reference/tools#smolagents.ToolCollection.from_mcp)的工具、[LangChain](https://huggingface.co/docs/smolagents/reference/tools#smolagents.Tool.from_langchain) 的工具，甚至把一个 [Hub Space](https://huggingface.co/docs/smolagents/reference/tools#smolagents.Tool.from_space) 当作工具。

完整文档见[官方文档站](https://huggingface.co/docs/smolagents/index)。

> **注**：发布博客《[smolagents: a simple library to make AI agents](https://huggingface.co/blog/smolagents)》有更多背景介绍。

## 快速演示

先安装带默认工具集的包：

```bash
pip install "smolagents[toolkit]"
```

然后定义你的智能体，给它所需的工具并运行：

```python
from smolagents import CodeAgent, WebSearchTool, InferenceClientModel

model = InferenceClientModel()

agent = CodeAgent(tools=[WebSearchTool()], model=model, stream_outputs=True)

agent.run("How many seconds would it take for a leopard at full speed to run through Pont des Arts?")
```

你甚至可以把智能体作为 Space 仓库分享到 Hub：

```python
agent.push_to_hub("m-ric/my_agent")
# agent.from_hub("m-ric/my_agent") 从 Hub 加载一个智能体
```

库是 LLM 无关的，上面的示例可以切换到任何推理提供商，例如：

```python
# LiteLLM 接入 100+ LLM
from smolagents import LiteLLMModel
model = LiteLLMModel(
    model_id="anthropic/claude-4-sonnet-latest",
    temperature=0.2,
    api_key=os.environ["ANTHROPIC_API_KEY"]
)

# OpenAI 兼容服务器（Together AI / OpenRouter 等，同样适配国内各类 OpenAI 兼容端点）
from smolagents import OpenAIModel
model = OpenAIModel(
    model_id="deepseek-ai/DeepSeek-R1",
    api_base="https://api.together.xyz/v1/",
    api_key=os.environ["TOGETHER_API_KEY"],
)

# 本地 transformers 模型
from smolagents import TransformersModel
model = TransformersModel(
    model_id="Qwen/Qwen3-Next-80B-A3B-Thinking",
    max_new_tokens=4096,
    device_map="auto"
)
```

## 命令行

可以用两个命令从 CLI 运行智能体：`smolagent` 与 `webagent`。

`smolagent` 是通用命令，运行可装备各种工具的多步 `CodeAgent`：

```bash
# 直接带提示与选项运行
smolagent "Plan a trip to Tokyo, Kyoto and Osaka between Mar 28 and Apr 7."  --model-type "InferenceClientModel" --model-id "Qwen/Qwen3-Next-80B-A3B-Thinking" --imports pandas numpy --tools web_search
# 交互模式（不带提示时启动设置向导）
smolagent
```

交互模式会引导你选择：智能体类型（CodeAgent vs ToolCallingAgent）、工具箱中的工具、模型配置（类型、ID、API 设置）、高级选项（如额外 imports），最后输入任务提示。

`webagent` 则是使用 [helium](https://github.com/mherrmann/helium) 的网页浏览智能体：

```bash
webagent "go to xyz.com/men, get to sale section, click the first clothing item you see. Get the product details, and the price, return them. note that I'm shopping from France" --model-type "LiteLLMModel" --model-id "gpt-5"
```

# Code Agent 是如何工作的？

`CodeAgent` 的运行方式与经典 ReAct 智能体几乎一样——唯一的差别是：**LLM 引擎用 Python 代码片段书写它的动作**。

```text
User Task（用户任务）
    │  把任务加入 agent.memory（Add task to agent.memory）
    ▼
agent.memory          ← 以下三步构成 ReAct 循环（ReAct loop）
    │  记忆作为聊天消息（Memory as chat messages）
    ▼
Generate from agent.model（由 agent.model 生成）
    │  解析输出以提取代码动作（Parse output to extract code action）
    ▼
Execute Code action（执行代码动作 —— 工具调用写成函数）
    │
    ├─ 未调用 'final_answer' 工具 ──► 把执行日志存入 agent.memory 并继续运行
    │                                 回到上面的 agent.memory，进入下一轮
    │
    └─ 调用 'final_answer' 工具 ──► 退出循环
                                      │
                                      ▼
                                  Answer（返回传给 'final_answer' 的参数）
```

*流程说明：CodeAgent 的 ReAct 循环。动作现在是 Python 代码片段，工具调用以 Python 函数调用的形式执行。*

例如，智能体可以在**一个动作里**对多个网站执行搜索：

```python
requests_to_search = ["gulf of mexico america", "greenland denmark", "tariffs"]
for request in requests_to_search:
    print(f"Here are the search results for {request}:", web_search(request))
```

若用 JSON 工具调用风格，这是三次独立的"调用-等待-观察"循环；而代码风格一个动作就完成了。

**把动作写成代码片段，已被证明优于当前业界"让 LLM 输出待调用工具字典"的惯例**：[减少 30% 的步骤](https://huggingface.co/papers/2402.01030)（即减少 30% 的 LLM 调用），并在困难基准上[取得更高性能](https://huggingface.co/papers/2411.01747)（后者即 CodeAct 论文）。更多理论背景见 smolagents 的[智能体概念指南](https://huggingface.co/docs/smolagents/conceptual_guides/intro_agents)。

# 安全：必须在沙箱中执行

代码执行是一个严重的安全问题（这是任意代码执行！），**你应该把智能体代码放进沙箱运行**。官方支持的选项：

- [E2B](https://e2b.dev/)、[Blaxel](https://blaxel.ai)、[Modal](https://modal.com/)——托管云沙箱，设置最简单；
- [Docker](https://www.docker.com/)——自托管容器隔离。

> **警告**：内置的 `LocalPythonExecutor` **不是安全沙箱**。它施加了一些限制，但可以被绕过，绝不能作为安全边界来运行不受信任的代码。安全策略与漏洞报告见仓库的 [Security Policy](https://github.com/huggingface/smolagents/blob/main/SECURITY.md)。

除 `CodeAgent` 外，库也提供经典的 `ToolCallingAgent`（用 JSON/文本块书写动作）。按用例选择即可。

# 这个库有多"smol"（小）？

团队把抽象压缩到严格的最小：`agents.py` 主代码不到 1,000 行。即便如此，它实现了多种智能体类型：用 Python 代码片段写动作的 `CodeAgent`、使用内置工具调用方法的经典 `ToolCallingAgent`，以及多智能体层级、工具集合导入、远程代码执行、视觉模型等。

顺带一提：为什么要用框架？因为其中很多环节并不平凡——比如 Code Agent 必须让代码格式在系统提示、解析器、执行三处保持一致。框架替你消化了这些复杂度。当然，官方依然鼓励你深入源码、只取你需要的部分。

# 开源模型跑智能体工作流有多强？

团队用多个领先模型创建 `CodeAgent` 实例，在一个汇集了多个基准问题、挑战多样的[基准](https://huggingface.co/datasets/m-ric/agents_medium_benchmark_2)上做了对比（[基准代码](https://github.com/huggingface/smolagents/blob/main/examples/smolagents_benchmark/run.py)）：代码智能体优于普通（vanilla）LLM，且开源模型已经可以与最好的闭源模型掰手腕。

# 小结

代码解释器型 Agent 的本质，是把"动作空间"从"有限个 JSON 工具签名"升级为"完整的编程语言"：

| 维度 | JSON 工具调用（ToolCallingAgent） | 代码动作（CodeAgent） |
| --- | --- | --- |
| 单步能力 | 一次一个（或并行几个）工具调用 | 任意逻辑：循环、条件、组合多工具 |
| 步数/成本 | 步数多、LLM 调用多 | 平均少约 30% 步 |
| 出错形态 | 结构化解析错误、参数幻觉 | 运行时异常（但栈信息可读、易自纠） |
| 安全要求 | 常规护栏 | 必须沙箱（E2B/Docker/Modal 等） |

**表：两种动作风格的对比。**

与《LangGraph 入门：用 Graph API 与 Functional API 构建你的第一个智能体》 OpenAI Agents SDK 的沙箱智能体、《AutoGen 与 CrewAI：多智能体框架现状（AutoGen 已并入 Microsoft Agent Framework）》 Computer Use 对照着看：三者都在回答同一个问题——"给模型多大的行动自由，配多大的安全边界"。

---

> **来源**：本文翻译自 [huggingface/smolagents](https://github.com/huggingface/smolagents) 官方 README，作者 Aymeric Roucher 等（Hugging Face smolagents 团队），许可 Apache 2.0。抓取于 2026-09-13。译文补充了概念导语；"代码解释器型 Agent"的另一常见形态——把代码解释器作为单个托管工具（如 OpenAI Responses API 的 Code Interpreter 托管工具、Anthropic 的 code execution 工具）——思路相同，只是"执行代码"被收敛为一个工具调用，而非智能体的通用行动语言。
