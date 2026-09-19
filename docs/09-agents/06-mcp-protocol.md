---
title: MCP 协议详解：架构、分层与核心原语（2026-07-28 版规范）
source_url: https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture
author: Model Context Protocol 项目（Anthropic 等维护）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: MCP 规范 2026-07-28（当前最新）
order: 6
group: 工具与协议
---
# 什么是 MCP（Model Context Protocol）

MCP（Model Context Protocol，模型上下文协议）是一个把 AI 应用连接到外部系统的开放标准。借助 MCP，Claude、ChatGPT 这类 AI 应用可以连接数据源（如本地文件、数据库）、工具（如搜索引擎、计算器）和工作流（如专用提示模板），从而获取关键信息并执行任务。

可以把 MCP 想象成 AI 应用的 USB-C 接口：正如 USB-C 为电子设备提供了标准化的连接方式，MCP 为 AI 应用与外部系统的连接提供了标准化方式。

## MCP 能带来什么

- 智能体（Agent）可以访问你的 Google Calendar 和 Notion，成为更懂你的个性化 AI 助手。
- Claude Code 可以根据一份 Figma 设计稿生成完整的 Web 应用。
- 企业聊天机器人可以连接组织内的多个数据库，让用户通过对话来分析数据。
- AI 模型可以在 Blender 里创建 3D 设计，并通过 3D 打印机打印出来。

## 为什么 MCP 重要

在生态中身处不同角色，MCP 能带来的收益也不同：

- **开发者**：在构建或集成 AI 应用/智能体时，MCP 降低了开发时间与复杂度。
- **AI 应用或智能体**：MCP 让它们接入一个由数据源、工具和应用组成的生态，增强能力并改善最终用户体验。
- **最终用户**：MCP 催生出更强的 AI 应用或智能体，能够访问用户数据并在必要时代表用户执行操作。

## 广泛的生态支持

MCP 是一个开放协议，被大量客户端和服务器支持。Claude、ChatGPT 等 AI 助手，Visual Studio Code、Cursor、MCPJam 等开发工具，以及许多其他产品都支持 MCP——这意味着"构建一次，处处集成"。

# 架构总览

本节讨论 MCP 的范围与核心概念，并通过示例逐一演示每个核心概念。由于 MCP SDK 已经抽象掉了许多细节，对大多数开发者而言，"数据层协议"一节最有用——它讲的是 MCP 服务器如何向 AI 应用提供上下文。

## 范围（Scope）

Model Context Protocol 项目包括以下组成部分：

- **MCP 规范（Specification）**：定义客户端与服务器实现要求的协议规范。
- **MCP SDK**：实现 MCP 的多语言 SDK。
- **MCP 开发工具**：用于开发 MCP 服务器和客户端的工具，包括 MCP Inspector（交互式调试工具）。
- **MCP 参考服务器实现**：官方维护的 MCP 服务器参考实现。

> **注**：MCP 只关注"上下文交换协议"本身——它不规定 AI 应用如何使用 LLM、也不规定如何管理所提供的上下文。

## MCP 的核心概念

### 参与者（Participants）

MCP 采用客户端-服务器架构：一个 **MCP 主机（Host）**——例如 Claude Code、Claude Desktop 这样的 AI 应用——与一个或多个 MCP 服务器建立连接。主机通过为每个 MCP 服务器创建一个 **MCP 客户端（Client）** 来做到这一点。每个 MCP 客户端与它对应的 MCP 服务器维护一条专用连接。

使用 STDIO 传输的本地 MCP 服务器通常只服务单个 MCP 客户端；而使用 Streamable HTTP 传输的远程 MCP 服务器通常会服务许多 MCP 客户端。

MCP 架构中的关键参与者：

- **MCP Host（主机）**：协调并管理一个或多个 MCP 客户端的 AI 应用。
- **MCP Client（客户端）**：维护与某个 MCP 服务器的连接、并从该服务器获取上下文供主机使用的组件。
- **MCP Server（服务器）**：向 MCP 客户端提供上下文的程序。

**举例**：Visual Studio Code 充当 MCP 主机。当 VS Code 连接到某个 MCP 服务器（例如 Sentry MCP 服务器）时，VS Code 运行时会实例化一个 MCP 客户端对象来维护这条连接；随后 VS Code 又连接另一个 MCP 服务器（例如本地文件系统服务器）时，运行时会再实例化一个新的 MCP 客户端对象来维护这条新连接。

MCP 主机与服务器拓扑（结构如下所示）：

```text
┌─ MCP Host（AI Application，AI 应用）
│
│   MCP Client 1 ──专用连接──► MCP Server A（Local · 例：Filesystem 文件系统）
│   MCP Client 2 ──专用连接──► MCP Server B（Local · 例：Database 数据库）
│   MCP Client 3 ──专用连接──► MCP Server C（Remote · 例：Sentry）
│   MCP Client 4 ──专用连接──► MCP Server C（Remote · 例：Sentry）
│
└─ 每个 MCP Client 只对应一条到某个 MCP Server 的专用连接（1:1）
```

注意：**MCP 服务器**指的是提供上下文数据的程序本身，与它运行在哪里无关——可以在本地也可以在远程。例如 Claude Desktop 启动文件系统服务器时，该服务器使用 STDIO 传输、运行在同一台机器上，这就是通常所说的"本地 MCP 服务器"；官方 Sentry MCP 服务器运行在 Sentry 平台上、使用 Streamable HTTP 传输，则是典型的"远程 MCP 服务器"。

### 分层（Layers）

MCP 由两层组成：

- **数据层（Data Layer）**：定义基于 JSON-RPC 的客户端-服务器通信协议，包括能力与版本发现，以及工具（Tools）、资源（Resources）、提示（Prompts）、通知（Notifications）等核心原语。
- **传输层（Transport Layer）**：定义客户端与服务器之间交换数据的通信机制与通道，包括传输相关的连接建立、消息成帧（Message Framing）与授权（Authorization）。

概念上，数据层是内层，传输层是外层。

#### 数据层

数据层实现了基于 [JSON-RPC 2.0](https://www.jsonrpc.org/) 的交换协议，定义消息的结构与语义。该层包括：

- **发现（Discovery）**：让客户端通过 `server/discover` 请求查询服务器支持的协议版本、能力与身份信息。
- **服务器特性（Server Features）**：让服务器提供核心功能——工具（AI 可执行的动作）、资源（上下文数据）、提示（交互模板）。
- **客户端特性（Client Features）**：让服务器向用户征求输入。Sampling 自协议版本 `2026-07-28` 起已[废弃（deprecated）](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)。
- **实用特性（Utility Features）**：支持实时更新的通知、长时间运行操作的进度跟踪等附加能力。

#### 传输层

传输层管理客户端与服务器之间的通信通道与认证，处理连接建立、消息成帧，以及 MCP 参与者之间的安全通信。

MCP 支持两种传输机制：

- **Stdio 传输**：使用标准输入/输出流，在同一台机器的本地进程之间直接通信，无网络开销、性能最佳。
- **Streamable HTTP 传输**：客户端到服务器的消息使用 HTTP POST，并可选地用服务器推送事件（SSE）实现流式能力。该传输支持远程服务器通信，并支持 bearer token、API key、自定义 header 等标准 HTTP 认证方式。MCP 建议使用 OAuth 获取认证 token。

传输层把通信细节从协议层中抽象出来，使所有传输机制都能使用同一套 JSON-RPC 2.0 消息格式。

### 数据层协议

MCP 的核心是定义 MCP 客户端与服务器之间的模式（Schema）与语义。开发者最关心的往往是数据层——尤其是[原语（Primitives）](#原语-primitives)集合：它定义了开发者能把哪些上下文从 MCP 服务器共享给 MCP 客户端。

MCP 使用 [JSON-RPC 2.0](https://www.jsonrpc.org/) 作为底层 RPC 协议。客户端与服务器互相发送请求并作出响应；不需要响应时可以使用通知（Notification）。

#### 无状态与发现（Statelessness and Discovery）

MCP 是一个无状态协议——每个请求都包含处理它所需的全部信息，服务器不从先前的请求中做任何推断。每个请求都在 `_meta` 字段中携带协议版本以及与该请求相关的**能力（Capabilities）**（客户端或服务器支持的特性与操作，如工具、资源、提示），因此服务器可以独立处理每个请求。除非另有配置，客户端也应在同一字段中表明自己的身份。服务器通过强制的 [`server/discover`](https://modelcontextprotocol.io/specification/2026-07-28/server/discover) 请求来宣告自己支持的版本与能力，客户端可以在发送任何其他请求之前先调用它。

#### 原语（Primitives）

原语是 MCP 中最重要的概念：它们定义了客户端和服务器能向对方提供什么。这些原语规定了可以与 AI 应用共享的上下文类型，以及可以执行的动作范围。

MCP 定义了*服务器*可以暴露的三类核心原语：

- **工具（Tools）**：AI 应用可以调用来执行动作的可执行函数（如文件操作、API 调用、数据库查询）。
- **资源（Resources）**：为 AI 应用提供上下文信息的数据源（如文件内容、数据库记录、API 响应）。
- **提示（Prompts）**：帮助结构化与语言模型交互的可复用模板（如系统提示、少样本示例）。

每类原语都有对应的发现（`*/list`）、获取（`*/get`）以及某些情况下的执行（`tools/call`）方法。MCP 客户端用 `*/list` 方法发现可用原语：例如客户端可以先列出所有可用工具（`tools/list`）再执行它们。这一设计使列表可以是动态的。

举一个具体例子：一个提供数据库上下文的 MCP 服务器，可以暴露查询数据库的工具、包含数据库模式（Schema）的资源，以及包含与这些工具交互的少样本示例的提示。

关于服务器原语的更多细节，参见[服务器概念](https://modelcontextprotocol.io/docs/2026-07-28/learn/server-concepts)。

MCP 也定义了*客户端*可以暴露的原语，让 MCP 服务器作者能构建更丰富的交互：

- **引导输入（Elicitation）**：允许服务器向用户请求额外信息。当服务器作者想从用户那里获得更多信息、或请求用户确认某个动作时非常有用。服务器通过 `elicitation/create` 方法请求用户输入。引导输入请求通过[多往返请求（Multi Round-Trip Requests）](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)模式传递。

**已废弃**：以下客户端原语自协议版本 `2026-07-28` 起废弃。

- **Sampling**：允许服务器向客户端的 AI 应用请求语言模型补全——服务器作者想用语言模型、但又想保持模型无关、不想在 MCP 服务器里引入 LLM SDK 时使用。通过 `sampling/createMessage` 方法请求，同样经由多往返请求模式传递。新实现应直接集成 LLM 提供商的 API。
- **Logging**：让服务器向客户端发送日志消息以便调试与监控。新实现应把日志写到 `stderr`（stdio 传输）或使用 OpenTelemetry。

除了服务器与客户端原语，协议还支持在核心协议之上构建的可选[扩展（Extensions）](https://modelcontextprotocol.io/extensions/overview)。例如 Tasks 扩展允许服务器为长时间运行的请求返回一个持久句柄，客户端可以轮询状态、稍后取回结果。

#### 通知（Notifications）

协议支持实时通知，实现服务器与客户端之间的动态更新。例如当服务器可用的工具发生变化时（新功能上线、已有工具被修改），服务器可以发送工具更新通知告知已连接的客户端。通知以 JSON-RPC 2.0 通知消息发送（不期望响应）。变更通知是可选加入（opt-in）的：客户端打开一条长期存活的 [`subscriptions/listen`](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions) 流，在其中指明希望接收的通知类型，服务器在该流上投递匹配的通知。

# 示例：一次完整的客户端-服务器交互

本节逐步拆解一次 MCP 客户端-服务器交互（聚焦数据层协议），演示发现、工具操作与通知。

## 第 1 步：发现（Discovery）

如"无状态与发现"所述，每个 MCP 请求都在 `_meta` 字段中携带协议版本与客户端能力，客户端还应包含自己的身份信息。想在发出其他请求前了解服务器支持什么的客户端，可以发送 `server/discover` 请求——每个服务器都必须实现它。发现响应通常可缓存，因此无需每个请求都重复发现流程。

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "example-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {}
      }
    }
  }
}
```

发现响应示例：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {
        "listChanged": true
      },
      "resources": {}
    },
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "example-server",
        "version": "1.0.0"
      }
    },
    "ttlMs": 3600000,
    "cacheScope": "public"
  }
}
```

**理解这次发现交换**：`_meta` 字段与发现响应共同完成几件事：

1. **协议版本选择**：请求中的 `io.modelcontextprotocol/protocolVersion` 声明本次请求客户端使用的版本；响应中的 `supportedVersions` 列出服务器接受的版本。若服务器不支持请求的版本，会以 `UnsupportedProtocolVersionError` 拒绝并列出自己支持的版本，客户端改用双方都支持的版本重试。
2. **能力发现**：客户端在每个请求的 `io.modelcontextprotocol/clientCapabilities` 中声明自己的能力，服务器通过 `server/discover` 返回自己的 `capabilities` 对象。双方由此知道对方能处理哪些原语（工具、资源、提示）、是否支持变更通知，从而不会尝试不支持的操作。
3. **身份交换**：请求 `_meta` 中的 `io.modelcontextprotocol/clientInfo` 与结果 `_meta` 中的 `io.modelcontextprotocol/serverInfo` 提供身份与版本信息，用于调试与兼容。

示例中的能力声明：

**客户端能力**：`"elicitation": {}`——声明客户端可以在服务器请求时向用户收集额外输入。

**服务器能力**：`"tools": {"listChanged": true}`——支持工具原语，并能响应 [`subscriptions/listen`](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions) 中的 `toolsListChanged` 过滤器（客户端请求该过滤后，工具列表变化时会收到 `notifications/tools/list_changed`）；`"resources": {}`——同样支持资源原语（可处理 `resources/list` 与 `resources/read`）。

调用 `server/discover` 是可选的：因为每个请求都携带同样的 `_meta` 字段，客户端完全可以直接发送任意请求、出现版本错误再处理。发现请求的价值在于用一个请求拿到服务器的身份、能力与支持版本。

**在 AI 应用中如何运作**：AI 应用的 MCP 客户端管理器连接已配置的服务器并保存发现到的能力；应用据此判断哪些服务器能提供哪类功能（工具/资源/提示）、是否支持实时更新。在 Python SDK 中，发现发生在客户端连接时，结果保存在客户端对象上：

```python
# 伪代码
async with Client(stdio_client(server_config)) as client:
    if client.server_capabilities.tools:
        app.register_mcp_server(client, supports_tools=True)
    app.set_server_ready(client)
```

## 第 2 步：工具发现（工具原语）

客户端发送 `tools/list` 请求即可发现可用工具。这是 MCP 工具发现机制的基础：客户端在真正使用工具之前，先了解服务器上有哪些工具。

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "example-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {}
      }
    }
  }
}
```

响应示例（两个工具：计算器与天气查询）：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resultType": "complete",
    "tools": [
      {
        "name": "calculator_arithmetic",
        "title": "Calculator",
        "description": "Perform mathematical calculations including basic arithmetic, trigonometric functions, and algebraic operations",
        "inputSchema": {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string",
              "description": "Mathematical expression to evaluate (e.g., '2 + 3 * 4', 'sin(30)', 'sqrt(16)')"
            }
          },
          "required": ["expression"]
        }
      },
      {
        "name": "weather_current",
        "title": "Weather Information",
        "description": "Get current weather information for any location worldwide",
        "inputSchema": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City name, address, or coordinates (latitude,longitude)"
            },
            "units": {
              "type": "string",
              "enum": ["metric", "imperial", "kelvin"],
              "description": "Temperature units to use in response",
              "default": "metric"
            }
          },
          "required": ["location"]
        }
      }
    ],
    "ttlMs": 300000,
    "cacheScope": "public"
  }
}
```

**理解请求**：`tools/list` 除每个 MCP 请求都带的标准 `_meta` 字段外不需要其他参数；它还接受可选的 `cursor` 参数用于分页（上例省略）。

**理解响应**：响应中的 `tools` 数组给出每个工具的完整元数据。数组结构让服务器可以同时暴露多个工具，同时保持不同功能之间清晰的边界。每个工具对象包含几个关键字段：

- **`name`**：工具在该服务器命名空间内的唯一标识，是工具执行的主键，应有清晰的命名模式（如 `calculator_arithmetic` 而不是简单的 `calculate`）。
- **`title`**：面向人类阅读的展示名，客户端可以显示给用户。
- **`description`**：详细说明工具做什么、何时使用。
- **`inputSchema`**：一个 JSON Schema，定义预期的输入参数，支持类型校验，并清晰记录必填/可选参数。

结果标记为 `"resultType": "complete"` 并带有两个缓存字段：`ttlMs` 是以毫秒为单位的保鲜提示（本例工具列表可缓存五分钟）；`cacheScope` 指明谁可以复用该响应。

**在 AI 应用中如何运作**：应用从所有已连接的 MCP 服务器拉取工具，合并成语言模型可访问的统一工具注册表，使 LLM 明白自己能执行哪些动作，并在对话中自动生成相应的工具调用：

```python
# 基于 MCP Python SDK 模式的伪代码
available_tools = []
for client in app.mcp_clients():
    tools_response = await client.list_tools()
    available_tools.extend(tools_response.tools)
conversation.register_available_tools(available_tools)
```

需要聚合众多服务器的客户端可以采用"渐进式工具发现"（progressive tool discovery）策略，而不是一次性加载全部工具。

## 第 3 步：工具执行（工具原语）

客户端现在可以用 `tools/call` 方法执行工具。注意请求使用的是发现响应中的正式工具名 `weather_current`：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "weather_current",
    "arguments": {
      "location": "San Francisco",
      "units": "imperial"
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "example-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {}
      }
    }
  }
}
```

响应示例：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "resultType": "complete",
    "content": [
      {
        "type": "text",
        "text": "Current weather in San Francisco: 68°F, partly cloudy with light winds from the west at 8 mph. Humidity: 65%"
      }
    ]
  }
}
```

**请求的关键组成**：

1. **`name`**：必须与发现响应中的工具名完全一致（`weather_current`），确保服务器能正确识别要执行的工具。
2. **`arguments`**：按工具 `inputSchema` 定义传入输入参数。本例中 `location` 是必填参数，`units` 是可选参数（未指定时默认 `metric`）。
3. **`_meta`**：携带每个 MCP 请求必备的协议版本与客户端能力，以及客户端身份。
4. **JSON-RPC 结构**：使用标准 JSON-RPC 2.0 格式，唯一的 `id` 用于请求-响应关联。

**响应的关键组成**：

1. **`content` 数组**：工具响应返回一个内容对象数组，支持文本、图片、资源等多种类型的富响应。
2. **内容类型**：每个内容对象都有 `type` 字段，本例 `"type": "text"` 表示纯文本。
3. **结构化输出**：响应提供 AI 应用可用作语言模型上下文的可操作信息。

**在 AI 应用中如何运作**：当语言模型在对话中决定使用某个工具时，AI 应用拦截该工具调用、路由到对应的 MCP 服务器执行、再把结果作为对话的一部分返回给 LLM。这使 LLM 能访问实时数据、在外部世界执行动作：

```python
# AI 应用工具执行的伪代码
async def handle_tool_call(conversation, tool_name, arguments):
    client = app.find_mcp_client_for_tool(tool_name)
    result = await client.call_tool(tool_name, arguments)
    conversation.add_tool_result(result.content)
```

## 第 4 步：实时更新（通知）

MCP 支持实时通知，让服务器无需被轮询就能告知客户端变化。

**订阅变更**：变更通知是可选加入的。客户端发送 `subscriptions/listen` 请求打开一条长期存活的通知流，用 `notifications` 过滤器指明想接收的事件类型。这里客户端订阅"工具列表变化"：

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "example-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {}
      }
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

服务器以 `notifications/subscriptions/acknowledged` 确认订阅——这是第一条携带该订阅 ID 的消息：

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 4
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

**理解工具列表变更通知**：确认之后，当服务器的可用工具变化时（例如新功能上线、已有工具被修改、或工具暂时不可用），服务器在该流上投递通知：

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/tools/list_changed",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 4
    }
  }
}
```

**MCP 通知的关键特性**：

1. **无需响应**：通知里没有 `id` 字段——这遵循 JSON-RPC 2.0 的通知语义，不期望也不发送响应。
2. **按需订阅**：只有请求过滤器里声明了 `"toolsListChanged": true` 的客户端才会收到；也只有服务器在工具能力中声明了 `"listChanged": true` 时才可用。
3. **订阅 ID 标记**：流上的每条通知都在 `_meta` 中携带 `io.modelcontextprotocol/subscriptionId`，取值为打开该流的 `subscriptions/listen` 请求的 JSON-RPC ID（本例为 `4`），客户端据此把通知与订阅关联。
4. **事件驱动**：服务器根据内部状态变化决定何时发送，使 MCP 连接动态且灵敏。
5. **尽力而为（Best Effort）**：不保证每条通知都被发送或接收（尤其跨传输重连时），客户端仍应依赖轮询来保证结果新鲜度。

**客户端对通知的反应**：收到通知后，客户端通常会重新请求工具列表，形成保持工具信息最新的刷新循环。

**为什么通知重要**：

1. **动态环境**：工具会随服务器状态、外部依赖或用户权限而增减。
2. **效率**：客户端无需轮询，更新发生时会被主动告知。
3. **一致性**：确保客户端始终掌握可用能力的准确信息。
4. **实时协作**：让 AI 应用能够适应不断变化的上下文。

这一通知模式同样适用于其他 MCP 原语，实现客户端与服务器之间全面的实时同步。

**在 AI 应用中如何运作**：应用为其关心的变更保持通知流开启；通知到达时立即刷新工具注册表、更新 LLM 可用的能力，确保进行中的对话总能用到最新的工具集：

```python
# AI 应用通知处理的伪代码
async def follow_tool_changes(client):
    async with client.listen(tools_list_changed=True) as sub:
        async for _event in sub:
            tools_response = await client.list_tools()
            app.update_available_tools(client, tools_response.tools)
            if app.conversation.is_active():
                app.conversation.notify_llm_of_new_capabilities()
```

# 小结

MCP 用"客户端-服务器 + JSON-RPC 数据层 + STDIO/Streamable HTTP 传输层"的标准组合，把"给 LLM 接工具"这件事从各家自定义的胶水代码，变成了一个开放生态协议。理解三个参与者（Host/Client/Server）、三类服务器原语（Tools/Resources/Prompts）与发现-列举-调用这条主链路，就抓住了 MCP 的骨架；传输、授权、通知与扩展（如 Tasks、Elicitation）则是工程落地时的进阶主题。下一篇我们将亲手写一个 MCP server。

---

> **来源**：本文翻译自 [Architecture overview](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)，作者 Model Context Protocol 项目（Anthropic 等维护），许可 MIT。抓取于 2026-09-13。开头"什么是 MCP"一节译自 [What is the Model Context Protocol (MCP)?](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro)（同许可）。译文按 MCP 规范 **2026-07-28** 版（抓取时的最新版）翻译：该版引入了无状态的 `server/discover` 发现机制，并将 Sampling、Logging 两个客户端原语标记为废弃。
