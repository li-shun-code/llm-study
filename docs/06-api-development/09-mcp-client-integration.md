---
title: MCP 客户端接入：把外部工具生态接到你的模型调用里
source_url: https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/tool.py
author: OpenAI（openai-python SDK 类型定义）；Model Context Protocol 项目（python-sdk README）
license: Apache 2.0 / MIT
fetched_at: 2026-09-19
translated: true
versions: openai-python 2026-09 最新稳定版；MCP Python SDK 2.x（支持 2026-07-28 规范及更早修订）；示例模型 gpt-5.4
order: 9
group: 工具与输出契约
---
协议层的概念（server/client/host、tools/resources/prompts、生命周期与分层）本站已在《MCP 协议详解：架构、分层与核心原语（2026-07-28 版规范）》讲过，"该用 Function Calling 还是 MCP"的取舍在《Function Calling vs MCP：两代工具接入方式如何取舍》里，动手写服务器在《MCP Server 实战：从零构建一个天气查询服务器》。**本篇只解决一件事：站在调用侧，怎么把别人写好的 MCP Server 接进我的模型请求里。**

接法有两条，选择取决于"谁去连服务器"：

- **路线 A：托管接入**。把 MCP Server 的 URL 交给 Responses API，服务端替你连、替你执行（`tools` 里声明 `{"type": "mcp"}`）。
- **路线 B：自建客户端**。你的进程用 MCP Python SDK 连服务器、拿到工具清单，翻译成模型的 `function` 工具，自己执行并回传。

## 一、路线 A：托管 MCP，一次声明即可

```python
from openai import OpenAI

client = OpenAI()  # Key 从 .env / 环境变量读取（全站约定）

response = client.responses.create(
    model="gpt-5.4",
    input="帮我查一下工单系统里分配给我的未关闭工单，并总结最紧急的一条。",
    tools=[
        {
            "type": "mcp",
            "server_label": "ticket_system",          # 必填，出现在工具调用项里
            "server_url": "https://mcp.example.com/tickets/mcp",  # Streamable HTTP 端点
            "server_description": "内部工单系统，支持按人查询与评论",  # 帮模型判断何时用
            "headers": {"X-Tenant": "acme"},          # 透传自定义头
            "allowed_tools": ["list_tickets", "get_ticket"],   # 也可写成过滤对象 {"tool_names": [...], "read_only": True}
            # 审批策略：整体 "always" / "never"，或按工具名与"是否只读"分别规定
            "require_approval": {
                "always": {"tool_names": ["close_ticket", "assign_ticket"]},
                "never": {"read_only": True},          # 只读工具不打断流程
            },
        }
    ],
)

for item in response.output:
    if item.type == "mcp_call":
        print("调用：", item.name, "| 服务器：", item.server_label, "| 参数：", item.arguments)
    elif item.type == "mcp_list_tools":
        print("服务器工具清单：", [t.name for t in item.tools])
print(response.output_text)
```

字段取自 SDK 由 OpenAPI 规范生成的 `mcp` 工具类型定义，几个值得单独说明：

**表：Responses API 的 mcp 工具字段**

| 字段 | 说明 |
| --- | --- |
| `server_label` | 必填。该服务器在调用项里的标识 |
| `server_url` / `tunnel_id` | 二选一：公网 URL，或用 Secure MCP Tunnel（内网服务器不出公网时） |
| `connector_id` | 直接用官方连接器（Dropbox、Gmail、Google Calendar/Drive、Teams、Outlook 邮件/日历、SharePoint），不用自己填 URL |
| `headers` | 透传 HTTP 头（注意别把长期密钥写进去） |
| `authorization` | 走 OAuth 时的凭据引用；配合 OpenAI 的 vaults 存 token，别把 bearer token 明文塞进代码 |
| `allowed_tools` | 工具名白名单；过滤对象支持 `tool_names` 与 `read_only` |
| `require_approval` | `"always"`/`"never"`，或 `{"always": {...}, "never": {...}}` 按 `tool_names`/`read_only` 细分；写操作几乎都该要审批 |
| `defer_loading` | 置为 true 时工具不随请求加载，由模型按需"搜工具"发现——服务器工具很多时可省上下文 |
| `allowed_callers` | `direct` / `programmatic`，指明是模型直接调用还是程序化调用 |

`require_approval` 命中时，响应不会自己完成调用，而是返回 `type: "mcp_call"` 且 `status` 为待批准项；你要把用户确认结果作为 `function_call_output` 类项目回传再续一轮（与《Tool Use 实战：工具的定义、注入与调用》里的审批循环同构，LangGraph 侧的实现见《Human-in-the-Loop：用 LangGraph interrupt 实现中断、恢复与人工审批》）。

## 二、路线 B：自建 MCP 客户端，工具清单喂给模型

MCP Python SDK v2 同一个包既是 server 也是 client。`pip install "mcp[cli]"`（Python 3.10+）；注意 v2 是破坏性重构，锁版本要写清楚（`mcp>=2`，或暂留 `mcp>=1.28,<2` 用 v1 API）。

```python
import asyncio
import json

from mcp import Client
from openai import OpenAI

client = OpenAI()


async def main() -> None:
    # 一个 URL 就是 Streamable HTTP（部署形态）；本地进程则用 stdio 由 Client 拉起
    async with Client("http://localhost:8000/mcp") as mcp_client:
        tools_meta = await mcp_client.list_tools()

        # 1) MCP 工具定义 → OpenAI function 工具定义
        tools = [
            {
                "type": "function",
                "name": t.name,
                "description": t.description or "",
                "parameters": t.input_schema,   # MCP 的 inputSchema 本身就是 JSON Schema
                "strict": False,                # 上游 schema 常不满足 strict 全必填要求
            }
            for t in tools_meta.tools
        ]

        # 2) 让模型决定调哪个
        resp = client.responses.create(
            model="gpt-5.4",
            input="上海中心大厦附近 3 公里内有哪些我们在服务的机房？",
            tools=tools,
        )

        calls = [i for i in resp.output if i.type == "function_call"]
        if not calls:
            print(resp.output_text)
            return

        # 3) 本地执行 MCP 调用，把结果作为输出项回传
        inputs = []
        for call in calls:
            result = await mcp_client.call_tool(call.name, json.loads(call.arguments or "{}"))
            inputs.append({
                "type": "function_call_output",
                "call_id": call.call_id,
                "output": json.dumps(result.structured_content, ensure_ascii=False),
            })

        final = client.responses.create(
            model="gpt-5.4",
            previous_response_id=resp.id,   # 会话状态续接，见《Responses API 会话与后台任务》
            input=inputs,
        )
        print(final.output_text)


asyncio.run(main())
```

这条路线的三个好处：**鉴权在你手里**（token 不出你的进程）、**可以插自己的守卫**（调用前做参数校验、租户隔离、审计落库）、**能接不暴露公网的内部服务器**（stdio 或内网 HTTP）。代价是你要自己管连接生命周期、超时与重试。

## 三、两条路线怎么选

**表：托管 MCP vs 自建 MCP 客户端**

| 维度 | 路线 A（Responses API 托管） | 路线 B（自建客户端） |
| --- | --- | --- |
| 谁连服务器 | OpenAI 服务端 | 你的进程 |
| 凭据落点 | 平台侧（headers / authorization / vault） | 你的环境变量或密钥服务 |
| 网络要求 | 服务器必须公网可达，或走 Secure Tunnel | 内网即可 |
| 自定义守卫 | 只有 `allowed_tools` 与 `require_approval` | 任意（代码在你手里） |
| 审计粒度 | `mcp_call` 输出项 | 自己写日志/指标（见《生产可观测性：OpenTelemetry GenAI 语义约定与调用侧埋点》） |
| 适用 | 第三方 SaaS 连接器、快速试验 | 内部系统、强合规、需要复杂编排 |

需要多智能体编排时，Agent SDK 侧也有 MCP 支持，写法见《OpenAI Agents SDK：轻量多智能体框架入门》。

## 四、常见坑

1. **工具投毒与名称劫持**。允许一个不受信服务器把工具名注册成 `send_email`、`read_credentials` 之类，等于把选择权交给别人。上线前把 `allowed_tools` 白名单写死，并把工具清单落库做变更对比（服务器改描述=改行为）。
2. **描述即攻击面**。MCP 工具的 `description` 会进上下文，恶意服务器可在描述里塞提示注入；处理方式与《提示注入：最坏会发生什么？》一致——不信任外部文本、写操作一律要审批。
3. **schema 转换不兼容**。`strict: True` 要求所有字段必填且有 `additionalProperties: false`，很多 MCP 服务器的 `inputSchema` 不满足；要么转换 schema，要么放宽为 `strict: False` 并接受偶发格式错。
4. **工具数量撑爆上下文**。挂三个各 40 个工具的服务器，光工具定义就能吃掉几万 token。用 `allowed_tools` 收窄，或 `defer_loading` + 工具检索。
5. **传输层与规范版本**。v2 SDK 同时支持 2026-07-28 规范及更早修订，传输有 stdio、Streamable HTTP 与（历史）SSE；跨网络部署优先 Streamable HTTP，别在 SSE 上继续加新代码。
6. **没管超时与断连**。`call_tool` 卡住会拖死整轮对话；给 MCP 调用套 `asyncio.timeout(...)`，并把失败作为工具结果回传给模型，让它换策略（细节见《并发请求限流：信号量、令牌桶与超时预算》）。
7. **忘了 MCP 也有可观测语义**。OTel 的 GenAI 语义约定里已有 MCP 指标（`mcp.client.operation.duration`、`mcp.client.session.duration` 等），自建客户端时顺手打上，跨进程排障会感谢自己。

## 五、小结

- 接入 MCP 有两条路：平台代连（`tools` 里 `{"type":"mcp"}`）与自己当客户端（`mcp` SDK 的 `Client`）；
- 托管路线的关键字段是 `server_url`/`tunnel_id`/`connector_id`、`allowed_tools`、`require_approval`、`defer_loading`；
- 自建路线的价值是凭据、守卫与审计都留在你手里，转换点只有一处：MCP `inputSchema` → function 工具 `parameters`；
- 白名单、审批、schema 兼容、工具数量、超时，是接 MCP 时最容易翻车的五处。

---

> **来源**：抓取于 2026-09-19。托管 MCP 的字段与语义取自 openai-python SDK（Apache 2.0）由 OpenAPI 规范生成的类型定义与文档字符串：[responses/tool.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/tool.py)（`Mcp`、`McpAllowedTools`、`McpRequireApproval`）与 [resources/responses/responses.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/responses/responses.py)；客户端写法与版本线（v2、支持 2026-07-28 规范、`pip install "mcp[cli]"`、`Client` / `call_tool` / `structured_content`）译自 Model Context Protocol 官方 [python-sdk README](https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md)（MIT，作者 MCP 项目）。协议概念与自建服务器教程见站内《MCP 协议详解》《MCP Server 实战》两篇；两路线对照与守卫建议为本站编者整理。
