---
title: Text2SQL 实战：用 Vanna 让自然语言直达数据库
source_url: https://raw.githubusercontent.com/vanna-ai/vanna/main/README.md
author: Vanna 项目（Vanna AI）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 17
group: 进阶范式
---
RAG 一直在讨论"非结构化文档"，但企业里最规整、最有价值的知识往往躺在数据库里。**Text2SQL**（自然语言转 SQL）是结构化数据检索的并行路线：不把表内容嵌进向量库，而是把**表结构（Schema）与问答示例**做检索增强，让 LLM 生成 SQL 去数据库里查。Vanna 是这一路线最有代表性的开源框架（GitHub 2 万+ star），其 2.0 版本是一套"用户感知"的 Text2SQL Agent 框架。

Vanna 2.0 的定位：**自然语言 → SQL → 答案**，并新增企业级安全与用户感知权限。

## 2.0 版本亮点

- 🔐 **每一层都感知用户**——查询按用户权限自动过滤；
- 🎨 **现代化 Web 界面**——预置 `<vanna-chat>` 组件；
- ⚡ **流式响应**——实时表格、图表与进度更新；
- 🔒 **企业安全**——行级安全（Row-level Security）、审计日志、限流；
- 🔄 **生产就绪**——FastAPI 集成、可观测性、生命周期钩子。

## 你会得到什么

用自然语言提问，实时流式返回：

1. 进度更新（流式）；
2. SQL 代码块（默认仅"管理员"用户可见）；
3. 可交互数据表；
4. 图表（Plotly 可视化）；
5. 自然语言总结。

## 为什么选 Vanna 2.0？

### ✅ 即刻上手

- 生产级聊天界面；
- 接你数据库的自定义 Agent；
- 可嵌入任意网页。

### ✅ 企业级安全

- **用户感知的每一层**：身份贯穿系统提示词、工具执行与 SQL 过滤；
- **行级安全**：查询按用户权限自动过滤；
- **审计日志**：每条查询按用户留痕，满足合规；
- **限流**：通过生命周期钩子实现按用户配额。

### ✅ 与你的技术栈协同

- **任意 LLM**：OpenAI、Anthropic、Ollama、Azure、Google Gemini、AWS Bedrock、Mistral 等；
- **任意数据库**：PostgreSQL、MySQL、Snowflake、BigQuery、Redshift、SQLite、Oracle、SQL Server、DuckDB、ClickHouse 等；
- **自带认证系统**：cookies、JWT、OAuth token 均可接入；
- **自带框架**：FastAPI、Flask。

### ✅ 可扩展但自有主见

- **自定义工具**：继承 `Tool` 基类扩展；
- **生命周期钩子**：配额检查、日志、内容过滤；
- **LLM 中间件**：缓存、提示词工程；
- **可观测性**：内置追踪与指标。

## 工作原理

一次提问的完整时序（原文 Mermaid 图改写）：

1. 用户在 `<vanna-chat>` 组件输入"Show Q4 sales"；
2. 前端向你的服务器 POST `/api/vanna/v2/chat_sse`（带认证）；
3. 服务器把解析出的用户身份 `User(id=alice, groups=[read_sales])` 交给 Agent；
4. Agent 调用 SQL 工具（用户感知）；
5. 工具施加行级安全过滤；
6. Agent 把"表格 → 图表 → 总结"以流式组件回传；
7. 前端组件渲染呈现。

四个关键概念：

1. **User Resolver（用户解析器）**——你定义如何从请求中提取用户身份（cookies、JWT 等）；
2. **User-Aware Tools（用户感知工具）**——工具按用户所属组自动检查权限；
3. **Streaming Components（流式组件）**——后端向前端流式推送结构化 UI 组件（表格、图表）；
4. **Built-in Web UI（内置 Web UI）**——预置 `<vanna-chat>` 组件负责渲染。

## 接入你自己的认证与 FastAPI

完整示例：把 Vanna 集成进现有 FastAPI 应用与认证体系。

```python
from fastapi import FastAPI
from vanna import Agent
from vanna.servers.fastapi.routes import register_chat_routes
from vanna.servers.base import ChatHandler
from vanna.core.user import UserResolver, User, RequestContext
from vanna.integrations.anthropic import AnthropicLlmService
from vanna.tools import RunSqlTool
from vanna.integrations.sqlite import SqliteRunner
from vanna.core.registry import ToolRegistry

# 你现有的 FastAPI 应用
app = FastAPI()

# 1. 定义用户解析器（使用你自己的认证系统）
class MyUserResolver(UserResolver):
    async def resolve_user(self, request_context: RequestContext) -> User:
        # 从 cookies、JWT 或会话中提取
        token = request_context.get_header('Authorization')
        user_data = self.decode_jwt(token)  # 你现有的逻辑
        return User(
            id=user_data['id'],
            email=user_data['email'],
            group_memberships=user_data['groups']  # 用于权限判断
        )

# 2. 组装 Agent 与工具
llm = AnthropicLlmService(model="claude-sonnet-4-5")
tools = ToolRegistry()
tools.register(RunSqlTool(sql_runner=SqliteRunner("./data.db")))
agent = Agent(
    llm_service=llm,
    tool_registry=tools,
    user_resolver=MyUserResolver()
)

# 3. 把 Vanna 路由挂到应用上
chat_handler = ChatHandler(agent)
register_chat_routes(app, chat_handler)

# 现在你拥有了：
# - POST /api/vanna/v2/chat_sse（流式端点）
# - GET /（可选 Web UI）
```

前端只需一行：

```html
<vanna-chat sse-endpoint="/api/vanna/v2/chat_sse"></vanna-chat>
```

自定义工具、生命周期钩子与高级配置见[完整文档](https://vanna.ai/docs)。

## 自定义工具

为你的用例扩展 Vanna：

```python
from vanna.core.tool import Tool, ToolContext, ToolResult
from pydantic import BaseModel, Field
from typing import Type

class EmailArgs(BaseModel):
    recipient: str = Field(description="Email recipient")
    subject: str = Field(description="Email subject")

class EmailTool(Tool[EmailArgs]):
    @property
    def name(self) -> str:
        return "send_email"

    @property
    def access_groups(self) -> list[str]:
        return ["send_email"]  # 权限检查

    def get_args_schema(self) -> Type[EmailArgs]:
        return EmailArgs

    async def execute(self, context: ToolContext, args: EmailArgs) -> ToolResult:
        user = context.user  # 自动注入
        # 你的业务逻辑
        await self.email_service.send(
            from_email=user.email,
            to=args.recipient,
            subject=args.subject
        )
        return ToolResult(success=True, result_for_llm=f"Email sent to {args.recipient}")

# 注册工具
tools.register(EmailTool())
```

## 进阶特性

- **生命周期钩子**：在请求生命周期的关键节点做配额检查、日志、内容过滤；
- **LLM 中间件**：为 LLM 调用实现缓存、提示词工程、成本追踪；
- **会话存储**：按用户持久化会话历史；
- **可观测性**：内置追踪与指标集成；
- **上下文富化器（Context Enrichers）**：加入 RAG、记忆或文档来增强 Agent 回答；
- **Agent 配置**：控制流式、temperature、最大迭代次数等。

## 适用场景

Vanna 适合：

- 需要自然语言界面的数据分析应用；
- 需要用户感知权限的多租户 SaaS；
- 想要"预置 Web 组件 + 后端"的团队；
- 有安全/审计要求的企业环境；
- 需要丰富流式响应（表格、图表、SQL）的应用；
- 需要与现有认证系统集成的场景。

## 从 0.x 迁移

Vanna 2.0 是聚焦"用户感知 Agent 与生产部署"的完全重写，关键变化：

- **新 API**：基于 Agent，取代旧的 `VannaBase` 类方法；
- **用户感知**：每个组件都知道用户身份；
- **流式**：输出富 UI 组件而非纯文本/DataFrame；
- **Web 优先**：内置 `<vanna-chat>` 组件与服务器。

---

> 编者注：Text2SQL 与文档向量 RAG 不是二选一，而是互补的两条检索路线——"上季度华东区销量前十的产品是什么？"该走 SQL，"产品说明书里对保修条款怎么说的？"该走向量检索。生产系统常用一个路由层（或第 17 篇的 Agent）先判断问题类型，再分别调用 SQL 工具与向量检索工具。Text2SQL 的评估同样重要：SQL 语法正确不等于语义正确（执行结果对不对），可以用"生成 SQL 与基准 SQL 的执行结果比对"来构建评估集，方法参照《RAG 评估实战：用 RAGAS 量化检索与生成质量》。

---

> **来源**：本文翻译自 [Vanna 2.0: Turn Questions into Data Insights](https://raw.githubusercontent.com/vanna-ai/vanna/main/README.md)，作者 Vanna 项目（Vanna AI），许可 MIT。抓取于 2026-09-13。
> 编者注：原文的时序图为 Mermaid 图，本站改写为文字流程；原文代码完整保留。
