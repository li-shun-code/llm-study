---
title: LangChain 快速入门（1.0 · create_agent）
source_url: https://docs.langchain.com/oss/python/langchain/quickstart
author: LangChain（官方文档 Quickstart，langchain-ai/docs）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: langchain ≥1.0（create_agent 风格）；deepagents ≥0.6 为可选扩展；Python 3.11+
order: 14
group: 编排框架
---
LangChain 1.0 把"用模型 + 工具 + 系统提示词组装一个 Agent"压缩成了一个函数：`create_agent`。官方 Quickstart 声称"几分钟内创建一个功能完整的 AI Agent"，本篇带你走完它。

## 一、安装依赖

```sh
uv python pin 3.11
uv init
uv add langchain
uv sync
```

```sh
# 也可用 pip（需 Python 3.11+）
pip install -U langchain
```

## 二、配置 API Key

从任一受支持的模型供应商获取 Key，写进 shell 环境或 `.env` 文件（配合 `python-dotenv` 的 `load_dotenv()` 加载——与「Python 基础」的方案一致）：

```sh
export OPENAI_API_KEY="your-api-key"
```

```text
# .env
OPENAI_API_KEY=your-api-key
```

支持的供应商包括 OpenAI、Google Gemini、Anthropic Claude、OpenRouter、Fireworks、Baseten、Ollama（本地）、Azure、AWS Bedrock、HuggingFace 等，完整列表见官方 chat model integrations 页。

## 三、构建第一个 Agent

定义一个普通 Python 函数当工具，然后 `create_agent` 一把组装：

```python
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
    system_prompt="You are a helpful assistant",
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "What's the weather in San Francisco?"}]}
)
print(result["messages"][-1].content_blocks)
```

换模型只改模型名前缀（如 `"claude-sonnet-4-6"`、`"google_genai:gemini-2.5-flash-lite"`、`"openrouter:anthropic/claude-sonnet-4-6"`、`"baseten:zai-org/GLM-5.2"`、`"ollama:devstral-2"`）并配好对应 Key——模型字符串的 `provider:model` 语法与《OpenAI 兼容端点与 LiteLLM：一套代码调用所有模型》 LiteLLM 的思路异曲同工。

当你提示旧金山天气时，Agent 会理解这是在问该市的天气，**自动调用天气工具**并组织回答。这就是模型 + 工具 + 循环的最小闭环（Function Calling 原理见《Function Calling / Tool Use：让模型调用你的函数》，Agent 体系在「Agent」展开）。

## 四、构建一个真实世界的 Agent

官方接着带做一个"文学数据助手"：读网上的文档、回答统计问题。涉及六个概念：

### 1. 详细的系统提示词

```python
SYSTEM_PROMPT = """You are a literary data assistant.

## Capabilities

- `fetch_text_from_url`: loads document text from a URL into the conversation.
Do not guess line counts or positions—ground them in tool results from the saved file."""
```

要点：写清角色与能力边界，并**明令禁止模型凭空猜测**——答案必须落在工具结果上。

### 2. 用 @tool 装饰器创建工具

```python
import urllib.error
import urllib.request

from langchain.tools import tool


@tool
def fetch_text_from_url(url: str) -> str:
    """Fetch the document from a URL.
    """
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; quickstart-research/1.0)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
    except urllib.error.URLError as e:
        return f"Fetch failed: {e}"
    text = raw.decode("utf-8", errors="replace")
    return text
```

官方强调：**工具要写好文档**——工具名、描述、参数名都会成为模型提示词的一部分（这正是《Function Calling / Tool Use：让模型调用你的函数》 Function Calling 的原则在框架层的体现）。`@tool` 装饰器负责补充元数据，并支持通过 `ToolRuntime` 参数做运行时注入。

### 3. 配置模型参数

```python
from langchain.chat_models import init_chat_model

model = init_chat_model(
    "openai:gpt-5.5",
    temperature=0.5,
    timeout=300,
    max_tokens=25000,
)
```

不同供应商的初始化参数略有差异（如 Azure 需 `azure_deployment`），参考各自的 reference 页。

### 4. 加入记忆（Memory）

用 LangGraph 的 checkpointer 让 Agent 跨交互保持状态（记住之前的对话与上下文）：

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
```

生产环境应换用**持久化 checkpointer**，把消息历史存进数据库（详见官方 Add and manage memory 指南）。

### 5. 组装并运行

```python
from langchain.agents import create_agent

agent = create_agent(
    model=model,
    tools=[fetch_text_from_url],
    system_prompt=SYSTEM_PROMPT,
    checkpointer=checkpointer,
)

agent_result = agent.invoke(
    {"messages": [{"role": "user", "content": content}]},
    config={"configurable": {"thread_id": "great-gatsby-lc"}},
)
print(agent_result["messages"][-1].content_blocks)
```

`thread_id` 是会话标识：同一个 thread 的多次 `invoke` 共享记忆——第 02 篇"多轮会话管理"在框架层的对应物。

官方示例的任务是让 Agent 分析《了不起的盖茨比》全文（数 `Gatsby` 出现行数、找 `Daisy` 首现行号、写两句话简介）。裸 Agent 的原始输出诚实但无能为力：

```text
**1) Number of lines containing `Gatsby`:** `null`

**2) First line containing `Daisy`:** `null`

**3) Synopsis:**
The Great Gatsby follows the mysterious millionaire Jay Gatsby and his obsession
with reuniting with his former lover, Daisy Buchanan, ...

**how_you_computed_counts:**
... because I do not have access to a code execution environment (like Python)
or text-processing tools (like `grep`), I cannot deterministically split the text
by line breaks ... As instructed, rather than fabricating or guessing a number,
I have output `null` for the exact counts and positions.
```

### 6. 进阶对照：Deep Agents

官方在同一教程里介绍了 **Deep Agents**（`pip install -U deepagents`）：与 LangChain Agent 共享同样的接口，但**内置**了计划（todo 列表）、文件系统工具（grep/read_file）、子代理（subagents）等常用能力：

```python
from deepagents import create_deep_agent

deep_agent = create_deep_agent(
    model=model,
    tools=[fetch_text_from_url],
    system_prompt=SYSTEM_PROMPT,
    checkpointer=checkpointer,
)

deep_agent_result = deep_agent.invoke(
    {"messages": [{"role": "user", "content": content}]},
    config={"configurable": {"thread_id": "great-gatsby-da"}},
)
```

同一个任务，Deep Agent 的输出（原始记录节选）：文件过大时自动转存文件系统、用 `grep` 精确匹配并统计——**258 行包含 `Gatsby`、第 181 行首次出现 `Daisy`**，还附上了计算过程的完整说明。

官方的选型建议：**要"开箱即用的最强能力"选 Deep Agents；要细粒度控制选 LangChain Agent**（自行组装所需能力）。

### 对比结论（原文要点）

裸 LangChain Agent 给出的行数统计只是估算（它缺少精确计算类工具）；Deep Agent 则能：

1. 用内置 `write_todos` 工具**规划**研究步骤；
2. 调用 `fetch_text_from_url` **加载文件**；
3. 用文件系统工具（`grep` / `read_file`）**管理上下文**，避免长文撑爆上下文窗口；
4. 按需**派生子代理**分派子任务。

## 五、可观测性：接上 LangSmith

官方建议给 Agent 挂上 LangSmith 追踪（tracing）——复杂应用里"模型到底被调了多少次、每步发生了什么"必须可观测：

```sh
export LANGSMITH_TRACING="true"
export LANGSMITH_API_KEY="..."
```

设置后重跑脚本，即可在 LangSmith 控制台检查每次 Agent 调用的完整轨迹。（「Agent」的"可观测性与 Tracing"专题会系统展开。）

## 六、本篇小结

- LangChain ≥1.0 的门槛动作只剩一个：`create_agent(model, tools, system_prompt)`；
- 工具就是带 docstring 的 Python 函数 + `@tool` 装饰器；名字与描述直接进提示词，认真写；
- `checkpointer`（如 `InMemorySaver`）+ `thread_id` = 跨轮次记忆；
- Deep Agents 是"内置规划/文件系统/子代理"的超集，粗粒度需求先试它；
- 接 LangSmith 看 trace，是调试 Agent 行为的第一手段。

Agent 的完整知识地图（ReAct、规划、记忆、多智能体、MCP）在「Agent」。

---

> **来源**：本文翻译自 [LangChain Quickstart](https://docs.langchain.com/oss/python/langchain/quickstart)（LangChain 官方文档，langchain-ai/docs 仓库，MIT），作者 LangChain。抓取于 2026-09-13。
> 编者注：本站**仅收录 LangChain ≥1.0 的 `create_agent` 风格**新教程；网上大量基于旧版 `LLMChain` / `initialize_agent` / `AgentExecutor` 的教程已过时，请以官方当前文档为准。
