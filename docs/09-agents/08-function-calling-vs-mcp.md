---
title: Function Calling vs MCP：两代工具接入方式如何取舍
source_url: https://github.com/openai/openai-agents-python/blob/main/docs/mcp.md
author: OpenAI（OpenAI Agents SDK 文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: openai-agents 当前版（依赖 mcp>=1.19,<3，兼容 MCP Python SDK v1/v2）
order: 8
---

# 概念对比：Function Calling 与 MCP 的关系

先澄清一个常见误解：**Function Calling 与 MCP 不是竞争关系，而是互补的两层**。

| 维度 | Function Calling（函数调用） | MCP（Model Context Protocol） |
| --- | --- | --- |
| 是什么 | 模型厂商 API 的原生能力：请求里带工具签名，模型返回结构化调用意图 | 开放协议：标准化"应用如何把工具与上下文暴露给 LLM" |
| 工具定义在哪 | 每个应用自己写 schema、自己实现执行 | 任何第三方写成可复用的 MCP server，一次实现、处处接入 |
| 生态复用 | 无——同一工具每个应用重写一遍 | 有——文件系统、GitHub、Slack 等现成 server 直接挂 |
| 换模型/框架 | 工具格式各家略有差异，绑定较强 | 协议无关，换模型/框架不用重写工具 |
| 安全边界 | 应用内函数，权限随应用 | 接入外部 server，需信任与审批机制（见下文警告） |

**表：Function Calling 与 MCP 的定位对比。**

在工程上，两者在同一个智能体里共存：Function Calling 承担"模型与工具对话的最后一公里"（把工具签名注入上下文、解析调用意图、回填结果），MCP 承担"工具的发现、分发与复用"。下面翻译的 OpenAI Agents SDK 文档正是这种共存的实例——同一个 `Agent` 里，函数工具（`function_tool`）与若干 MCP server 同时挂载。

值得注意的是该文档透露的行业演进：MCP 传输层从"HTTP+SSE"演进到"Streamable HTTP"；MCP Python SDK v2 配合 MCP 规范 2026-07-28 引入的 `server/discover` 发现机制（自动回退旧版 `initialize` 握手）；OpenAI 更是把 MCP 工具的执行整体搬进了模型端（Hosted MCP）。这些细节对理解"两代工具接入方式"的边界变化非常有价值。

# Model Context Protocol（MCP）：OpenAI Agents SDK 视角

模型上下文协议（MCP）标准化了应用向语言模型暴露工具与上下文的方式。引用官方文档的说法：

> MCP 是一个把应用连接到 LLM 上下文的开放协议。可以把 MCP 想象成 AI 应用的 USB-C 接口：正如 USB-C 提供了把设备连接到各种外设与配件的标准化方式，MCP 提供了把 AI 模型连接到不同数据源与工具的标准化方式。

Agents Python SDK 理解多种 MCP 传输（transport）。这让你既能复用现有 MCP 服务器，也能自建服务器，把文件系统、HTTP 或连接器（connector）支撑的工具暴露给智能体。

> **警告：连接前先信任 MCP 服务器**
> MCP 工具可以暴露模型上下文中的数据、并用你提供的凭据执行动作。只连接你信任的服务器；使用最小权限凭据；把访问令牌放在授权字段或 header 中而不是 URL 里；对敏感操作要求审批。参见 OpenAI 的 MCP 安全指引。

## 选择 MCP 集成方式

把 MCP 服务器接进智能体之前，先决定：工具调用应在哪里执行？你能连通哪些传输？下表总结 Python SDK 支持的选项。

| 你的需求 | 推荐选项 |
| --- | --- |
| 让 OpenAI 的 Responses API 代表模型调用一个公网可达的 MCP 服务器 | **托管 MCP 服务器工具**（`HostedMCPTool`） |
| 连接你自建（本地或远程）的 Streamable HTTP 服务器 | **Streamable HTTP MCP 服务器**（`MCPServerStreamableHttp`） |
| 与实现了 HTTP + 服务器推送事件（SSE）的服务器通信 | **HTTP with SSE MCP 服务器**（`MCPServerSse`） |
| 启动本地进程、经 stdin/stdout 通信 | **stdio MCP 服务器**（`MCPServerStdio`） |

**表：四种 MCP 集成方式的选择矩阵。**

## MCP Python SDK v1 与 v2

Agents SDK 通过依赖范围 `mcp>=1.19.0,<3` 同时支持 `mcp` Python 包的两个大版本。安装的 `mcp` 包版本与"和服务器协商的 MCP 协议版本"是两回事。SDK 会检测所装包的大版本，自动适配 stdio、SSE 与 Streamable HTTP 连接，普通服务器配置无需版本开关。

装了 MCP Python SDK v2 时，SDK 会以 `mode="auto"` 创建 v2 的 `mcp.Client`：先用所装 MCP SDK 支持的最新协议版本发送 `server/discover` 探测；新式服务器应答该探测并采用结果；老式服务器若不支持 `server/discover`，客户端回退到旧的 `initialize` 握手并使用协商出的协议版本。因此安装 v2 不会强令所有连接使用最新 MCP 协议版本。

大多数应用让依赖解析器自选兼容版本即可。若必须锁定大版本，在 `openai-agents` 之外加显式约束：

```bash
# MCP Python SDK v1
pip install "mcp>=1.19.0,<2"
# MCP Python SDK v2
pip install "mcp>=2,<3"
```

HTTP 传输的自定义必须使用所装 `mcp` 包自带的 HTTP 栈（v1 基于 `httpx`，v2 基于 `httpx2`）；`Authorization` header 两种版本通用。这些本地 `mcp` 依赖要求不适用于 `HostedMCPTool`——因为远程 MCP 连接由 OpenAI Responses API 持有。

## 智能体级 MCP 配置

除选择传输外，可以用 `Agent.mcp_config` 微调 MCP 工具的准备方式：

```python
from agents import Agent

agent = Agent(
    name="Assistant",
    mcp_servers=[server],
    mcp_config={
        # 尽力把 MCP 工具 schema 转换为严格 JSON schema。
        "convert_schemas_to_strict": True,
        # 设为 None 时，MCP 工具失败会抛异常，
        # 而不是返回模型可见的错误文本。
        "failure_error_function": None,
        # 给本地 MCP 工具名加服务器名前缀。
        "include_server_in_tool_names": True,
    },
)
```

要点：`convert_schemas_to_strict` 是尽力而为（转不动就用原 schema）；`failure_error_function` 控制工具失败如何呈现给模型，服务器级配置优先于智能体级；`include_server_in_tool_names` 是可选项——启用后每个本地 MCP 工具以确定性的"服务器前缀名"暴露给模型，避免多个 MCP 服务器发布同名工具时冲突，SDK 内部仍以原始工具名调用原始服务器。

# 四种集成方式

## 1. 托管 MCP 服务器工具（Hosted MCP）

托管工具把整段工具往返过程推进 OpenAI 的基础设施：你的代码不再负责列举和调用工具，`HostedMCPTool` 把服务器标签（及可选的连接器元数据）转发给 Responses API，模型在模型端直接列举远程服务器工具并调用，**无需额外回调你的 Python 进程**。

```python
import asyncio
from agents import Agent, HostedMCPTool, Runner

async def main() -> None:
    agent = Agent(
        name="Assistant",
        instructions="Use the DeepWiki hosted MCP server to inspect openai/openai-agents-python.",
        tools=[
            HostedMCPTool(
                tool_config={
                    "type": "mcp",
                    "server_label": "deepwiki",
                    "server_url": "https://mcp.deepwiki.com/mcp",
                    "require_approval": "never",
                }
            )
        ],
    )
    result = await Runner.run(
        agent,
        "Which language is the repository openai/openai-agents-python written in?",
    )
    print(result.final_output)

asyncio.run(main())
```

托管服务器自动暴露其工具，不要把它加进 `mcp_servers`。托管工具的流式输出与函数工具一致（`Runner.run_streamed`）。

**可选审批流**：若服务器能执行敏感操作，可以要求每次工具执行前先获得（人工或程序化）审批。`tool_config` 的 `require_approval` 支持 `"always"`、`"never"` 或"工具名 → 策略"的字典；要在 Python 内做决策，提供 `on_approval_request` 回调：

```python
from agents import MCPToolApprovalFunctionResult, MCPToolApprovalRequest

SAFE_TOOLS = {"read_wiki_structure", "read_wiki_contents", "ask_question"}

def approve_tool(request: MCPToolApprovalRequest) -> MCPToolApprovalFunctionResult:
    if request.data.name in SAFE_TOOLS:
        return {"approve": True}
    return {"approve": False, "reason": "Escalate to a human reviewer"}

agent = Agent(
    name="Assistant",
    tools=[
        HostedMCPTool(
            tool_config={
                "type": "mcp",
                "server_label": "deepwiki",
                "server_url": "https://mcp.deepwiki.com/mcp",
                "require_approval": "always",
            },
            on_approval_request=approve_tool,
        )
    ],
)
```

托管 MCP 也支持 OpenAI 连接器：不传 `server_url`，改传 `connector_id` 与访问令牌（如 `connector_googlecalendar`），认证由 Responses API 处理。

## 2. Streamable HTTP MCP 服务器

想自己管理网络连接时，用 `MCPServerStreamableHttp`——适合你控制传输层、或想让服务器跑在自己的基础设施里且保持低延迟的场景：

```python
import asyncio
import os
from agents import Agent, Runner
from agents.mcp import MCPServerStreamableHttp
from agents.model_settings import ModelSettings

async def main() -> None:
    token = os.environ["MCP_SERVER_TOKEN"]
    async with MCPServerStreamableHttp(
        name="Streamable HTTP Python Server",
        params={
            "url": "http://localhost:8000/mcp",
            "headers": {"Authorization": f"Bearer {token}"},
            "timeout": 10,
        },
        cache_tools_list=True,
        max_retry_attempts=3,
    ) as server:
        agent = Agent(
            name="Assistant",
            instructions="Use the MCP tools to answer the questions.",
            mcp_servers=[server],
            model_settings=ModelSettings(tool_choice="required"),
        )
        result = await Runner.run(agent, "Add 7 and 22.")
        print(result.final_output)

asyncio.run(main())
```

构造器还接受：`client_session_timeout_seconds`（MCP 会话读超时）、`use_structured_content`（优先取结构化输出）、`max_retry_attempts` 与 `retry_backoff_seconds_base`（`list_tools()`/`call_tool()` 自动重试）、`tool_filter`（只暴露部分工具）、`require_approval`（本地 MCP 工具的人工审批策略）、`failure_error_function`（自定义失败信息）、`tool_meta_resolver`（按调用注入 `_meta` 元数据，如租户 ID、追踪上下文）。

**本地 MCP 服务器的审批策略**：`require_approval` 支持全局 `"always"`/`"never"`、布尔值、按工具映射（`{"delete_file": "always", "read_file": "never"}`）或分组对象：

```python
async with MCPServerStreamableHttp(
    name="Filesystem MCP",
    params={"url": "http://localhost:8000/mcp"},
    require_approval={"always": {"tool_names": ["delete_file"]}},
) as server:
    ...
```

完整的暂停/恢复流程参见官方 human-in-the-loop 文档与本模块第 11 篇。

**MCP 工具输出的多模态内容**：文本按文本转发；图片内容映射为图片型工具输出；音频、资源块等其他类型以 JSON 序列化文本转发；含多个内容块的响应以列表转发。若 `use_structured_content=True` 且存在非空非错误的 `structuredContent`，以结构化载荷优先。

## 3. HTTP with SSE MCP 服务器

> **警告**：MCP 项目已弃用 SSE 传输。新集成请用 Streamable HTTP 或 stdio，SSE 仅用于遗留服务器。

若服务器实现了 HTTP+SSE 传输，用 `MCPServerSse`——除传输外，API 与 Streamable HTTP 服务器完全一致。

## 4. stdio MCP 服务器

以本地子进程运行的 MCP 服务器用 `MCPServerStdio`：SDK 负责拉起进程、保持管道、退出上下文管理器时自动关闭。适合快速原型或只有命令行入口的服务器：

```python
from pathlib import Path
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

current_dir = Path(__file__).parent
samples_dir = current_dir / "sample_files"

async with MCPServerStdio(
    name="Filesystem Server via npx",
    params={
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", str(samples_dir)],
    },
) as server:
    agent = Agent(
        name="Assistant",
        instructions="Answer questions using the files.",
        mcp_servers=[server],
    )
    result = await Runner.run(agent, "What files are available?")
    print(result.final_output)
```

## 5. MCP 服务器管理器

一个智能体可以同时挂多个 MCP 服务器（`mcp_servers=[server_a, server_b]`）；`MCPServerManager` 类型的辅助器则可以统一管理多个服务器的连接生命周期、聚合工具列表（完整用法见官方文档）。

# 选型建议

回到标题的问题，给三条实战判断：

1. **工具只服务你一个应用**（如"查自家订单库"）→ 直接写 Function Calling 函数工具，最简单、无额外依赖；
2. **工具要跨应用/跨框架复用，或想接入现成生态**（文件系统、GitHub、浏览器……）→ 把工具包成 MCP server，用 stdio（本地）或 Streamable HTTP（远程）接入；
3. **敏感操作无论哪种方式都要加审批**：`require_approval`（MCP）或工具内 `interrupt`（LangGraph，见第 11 篇），并把高危工具从"自动允许"清单里剔除。

Function Calling 是"模型怎么调工具"的机制，MCP 是"工具从哪来、如何被发现和复用"的协议——理解了这层关系，就不会再把它们当成二选一。

---

> **来源**：本文主体翻译自 OpenAI Agents SDK 官方文档 [Model context protocol (MCP)](https://github.com/openai/openai-agents-python/blob/main/docs/mcp.md)，作者 OpenAI，许可 MIT。抓取于 2026-09-13。"概念对比"一节为编者综述，依据的是同一份文档与 MCP 官方文档（本模块第 6 篇）两份一手资料。
