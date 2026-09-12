---
title: MCP 在编码中的应用
source_url: https://code.claude.com/docs/en/mcp
author: Anthropic（Claude Code 官方文档）
license: 署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 10
---

> **来源**：本文翻译自 [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)，作者 Anthropic（Claude Code 官方文档），许可署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途翻译并署名）。抓取于 2026-09-13。协议本身的概念详解与自建 server 实战见模块 9《MCP 协议详解》与《MCP server 实战》，本文聚焦"在编码工作流中怎么用"。长尾小节（WebSocket 传输、channels、插件分发、企业托管配置等）从略，见原文。

Claude Code 可以通过**模型上下文协议（Model Context Protocol，MCP）**连接数百种外部工具与数据源——这是一个面向 AI 工具集成的开源标准。MCP 服务器让 Claude Code 访问你的工具、数据库和 API。

什么时候该连一个服务器？**当你发现自己在把另一个工具里的数据复制粘贴进对话时**——issue 跟踪器、监控面板。连接之后，Claude 可以直接读写那个系统，而不是靠你粘贴的内容工作。

## 用 MCP 能做什么

连上 MCP 服务器后，你可以让 Claude Code：

- **从 issue 跟踪器实现功能**："Add the feature described in JIRA issue ENG-4521 and create a PR on GitHub."（实现 JIRA issue 描述的功能并在 GitHub 开 PR）
- **分析监控数据**："Check Sentry and Statsig to check the usage of the feature described in ENG-4521."（查 Sentry 和 Statsig 看 ENG-4521 功能的用量）
- **查询数据库**："Find emails of 10 random users who used feature ENG-4521, based on our PostgreSQL database."（从 PostgreSQL 找 10 个用过该功能的随机用户邮箱）
- **整合设计稿**："Update our standard email template based on the new Figma designs that were posted in Slack"（按 Slack 里新发的 Figma 设计更新邮件模板）
- **自动化工作流**："Create Gmail drafts inviting these 10 users to a feedback session about the new feature."（写 Gmail 草稿邀请 10 个用户参加反馈会）
- **响应外部事件**：MCP 服务器还可以作为 channel（通道）向会话推送消息——你不在时 Claude 也能响应 Telegram 消息、Discord 聊天或 webhook 事件。

一句话总结编码场景的 MCP 价值：**把"复制粘贴上下文"变成"智能体直连系统"**。

## 找到并构建 MCP 服务器

经审核的连接器可在 [Anthropic Directory](https://claude.ai/directory) 浏览；目录里的远程服务器都能用 `claude mcp add` 添加。

> **警告**：连接前务必确认信任该服务器。抓取外部内容的服务器可能带来提示注入（prompt injection）风险。

自建服务器可参考 MCP 官方文档的 server 开发指南；也可以让 Claude 替你搭骨架——安装官方 `mcp-server-dev` 插件后运行 `/mcp-server-dev:build-mcp-server`，Claude 会询问你的用例并生成远程 HTTP 或本地 stdio 服务器脚手架。

## 安装 MCP 服务器

### 方式一：远程 HTTP 服务器（推荐）

HTTP 是连接远程 MCP 服务器的推荐方式，云端服务支持最广：

```bash
# 基本语法
claude mcp add --transport http <name> <url>

# 实例：连接 Notion
claude mcp add --transport http notion https://mcp.notion.com/mcp

# 带 Bearer token 的实例
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

在 `.mcp.json`、`~/.claude.json` 或 `claude mcp add-json` 中以 JSON 配置时，`type` 字段接受 `streamable-http` 作为 `http` 的别名（MCP 规范用语），从服务器文档抄来的配置无需改动即可使用。注意：JSON 条目有 `url` 却没有 `type` 会被当作 stdio 配置而跳过并报错——老版本曾把它误报为 `command: expected string, received undefined`。

### 方式二：远程 SSE 服务器（已弃用）

SSE（Server-Sent Events）传输已弃用，优先用 HTTP。某些服务仍只提供 SSE 端点：新版会先尝试 HTTP、服务器不接受时自动切换；旧版或直连时用 `--transport sse`：

```bash
# 实例：连接 Asana
claude mcp add --transport sse asana https://mcp.asana.com/sse

# 带认证头的实例
claude mcp add --transport sse private-api https://mcp.company.com/sse \
  --header "X-API-Key: your-key-here"
```

### 方式三：本地 stdio 服务器

stdio 服务器以本地进程运行，适合需要直接访问系统或自定义脚本的工具：

```bash
# 基本语法
claude mcp add [options] <name> -- <command> [args...]
```

Claude Code 会在派生的服务器环境中把 `CLAUDE_PROJECT_DIR` 设为项目根，服务器因此可以解析项目相对路径。限制文件系统访问范围的服务器应实现 MCP 的 `roots/list` 请求，Claude Code 会回答启动目录加全部附加工作目录，并在集合变化时发送 `notifications/roots/list_changed`。

### 管理服务器

```bash
# 列出所有已配置服务器
claude mcp list

# 查看某个服务器详情
claude mcp get <name>

# 移除服务器
claude mcp remove <name>

# （会话内）查看连接状态
/mcp
```

会话中运行 `/mcp` 可以看到每个服务器 `connected`（已连接）或 `failed`（失败，含 HTTP 状态码如 401）。

## 安装作用域

**表：MCP 服务器的三种作用域**

| 作用域 | 加载范围 | 与团队共享 | 存储位置 |
| --- | --- | --- | --- |
| Local（本地，默认） | 仅当前项目 | 否 | `~/.claude.json` |
| Project（项目） | 仅当前项目 | 是，经版本控制 | 项目根的 `.mcp.json` |
| User（用户） | 你所有项目 | 否 | `~/.claude.json` |

**Local 作用域**（默认）：只在添加它的项目里加载，仅自己可见。适合个人开发服务器、实验配置、或带凭据不想进版本控制的服务器：

```bash
# 添加本地作用域服务器（默认）
claude mcp add --transport http stripe https://mcp.stripe.com
```

**Project 作用域**：配置写入项目根的 `.mcp.json` 并提交进版本控制，全团队共享同样的 MCP 工具：

```bash
claude mcp add --transport http shared-server --scope project https://example.com/mcp
```

生成的文件遵循标准格式：

```json
{
  "mcpServers": {
    "shared-server": {
      "type": "http",
      "url": "https://example.com/mcp"
    }
  }
}
```

出于安全考虑，交互会话在使用 `.mcp.json` 里的项目级服务器前会请求批准（`claude -p` 非交互运行与 Agent SDK 会话无法弹窗，会直接加载；要强制排除可用 `disabledMcpjsonServers` 设置或 `--strict-mcp-config` 标志）。

**User 作用域**：跨项目可用、私有于你的账号，适合个人实用服务器与常用开发工具：

```bash
claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic
```

**优先级**：同一服务器多处定义时按 Local > Project > User > 插件提供 > claude.ai 连接器的顺序取最高优先级定义（整个条目采用，不跨作用域合并）；组织经托管设置下发的服务器高于一切。

**环境变量展开**：`.mcp.json` 支持 `${VAR}` 与 `${VAR:-default}` 语法，可出现在 `command`、`args`、`env`、`url`、`headers` 中——团队共享配置的同时把机器相关路径与 API Key 留在环境变量里：

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

变量未设置且无默认值时配置仍会加载，只是该服务器报缺失警告并按未展开文本使用——请补上变量或 `:-default` 回退。

## 实战示例

### 连接 GitHub 做代码审查

GitHub 的远程 MCP 服务器用个人访问令牌（PAT）认证。在 GitHub 令牌设置里生成一个细粒度（fine-grained）令牌、授予相关仓库权限，然后：

```bash
claude mcp add --transport http github https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer YOUR_GITHUB_PAT"
```

运行 `/mcp` 确认 `github` 显示 `connected` 后，就可以自然语言驱动 GitHub：

```text
Review PR #456 and suggest improvements
```

```text
Create a new issue for the bug we just found
```

```text
Show me all open PRs assigned to me
```

### 连接 PostgreSQL 查数据库

[DBHub](https://github.com/bytebase/dbhub)（npm 包 `@bytebase/dbhub`）是一个通过连接串接入关系型数据库的 MCP 服务器。**连接串里用只读数据库用户**，保证 Claude 跑的查询改不了数据：

```bash
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"
```

然后就能自然语言查询：

```text
What's our total revenue this month?
```

```text
Show me the schema for the orders table
```

```text
Find customers who haven't made a purchase in 90 days
```

## 远程服务器的认证

许多云端 MCP 服务器需要认证，Claude Code 支持 OAuth 2.0。当远程服务器返回 `401 Unauthorized` 或 `403 Forbidden` 时，Claude Code 会将其标记为需要认证，随后引导完成 OAuth 流程；命令行也提供 `/mcp` 内的认证入口（详见原文"Authenticate with remote MCP servers"一节）。

> 译注：编码场景选 MCP 服务器的小抄——issue/PR 协作选 GitHub/GitLab 官方服务器；设计对齐选 Figma；数据库用 DBHub 之类 + 只读账号；内部系统自建 stdio 服务器并放进项目级 `.mcp.json`（凭据走环境变量）。MCP 与 Function Calling 的取舍对比见模块 9；在 CI 中用 MCP 的完整链路见本模块第 16 篇。
