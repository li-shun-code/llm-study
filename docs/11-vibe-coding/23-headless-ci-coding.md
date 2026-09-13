---
title: Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体
source_url: https://code.claude.com/docs/en/headless
author: Anthropic（Claude Code Headless、Agent SDK、GitHub Actions 官方文档）；GitHub（Copilot cloud agent 官方文档）；Microsoft（Copilot Copyright Commitment 相关声明见第 26 篇）
license: 署名翻译（Anthropic 与 GitHub 官方文档版权归原厂所有，教学用途编译翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 23
---

**编者按**：上一篇结尾把工具收敛到了生态选型；本篇讲 AI 编码的"下半场"——**没有人的地方**。正文主体是四份官方文档的完整翻译：Claude Code《Run Claude Code programmatically》（Headless/CLI 形态）、《Agent SDK overview》（库形态）、《Claude Code GitHub Actions》（事件驱动形态），以及 GitHub《About Copilot cloud agent》（云端 PR 智能体形态）。四篇合起来正好是"把整个智能体循环嵌入流水线"的三种工业形态加一家的对照产品。编者内容仅限本按语与文末已标明的编者注。

## 一、Headless：以编程方式运行 Claude Code（官方文档全文翻译）

*译自 [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)（Claude Code 官方文档，2026-09 当前版）。*

[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) 提供与 Claude Code 相同的工具、智能体循环与上下文管理。它以面向脚本与 CI/CD 的 CLI 形态提供，也以 [Python](https://code.claude.com/docs/en/agent-sdk/python) 与 [TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript) 包的形态提供完整编程控制。

以非交互模式运行 Claude Code，给 `claude` 传 `-p` 与你的提示词以及所需的 [CLI 选项](https://code.claude.com/docs/en/cli-reference)：

```bash
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"
```

本页介绍经 CLI（`claude -p`）使用 Agent SDK。关于带结构化输出、工具批准回调与原生消息对象的 Python/TypeScript SDK 包，见[完整 Agent SDK 文档](https://code.claude.com/docs/en/agent-sdk/overview)。

### 基本用法

给任意 `claude` 命令加 `-p`（或 `--print`）旗标即以非交互运行。并非每个 [CLI 选项](https://code.claude.com/docs/en/cli-reference)都能与 `-p` 组合：Claude Code 拒绝 `--bg`；带任务描述的 `--cloud` 会被拒绝并报错说明冲突——而带会话 ID 的 `--cloud` 加 `-p` 则向该云会话[排队一条消息](https://code.claude.com/docs/en/claude-code-on-the-web#send-follow-ups-from-the-cli)后退出。常与 `-p` 组合的选项包括：

* `--continue`：[继续对话](#继续对话)
* `--allowedTools`：[自动批准工具](#自动批准工具)
* `--output-format`：[结构化输出](#获取结构化输出)

下例向 Claude 问一个关于你代码库的问题并打印回答：

```bash
claude -p "What does the auth module do?"
```

Claude Code 成功时以退出码 0 退出、运行失败时以非零码退出，脚本可以据此分支。传入无效旗标时，Claude Code 在运行开始前把错误报告到 stderr；运行内部发生失败（如缺少认证）时，Claude Code 把失败作为结果打印在 stdout。

#### bare 模式：更快启动

加 `--bare` 跳过 hooks、skills、自定义命令、[子智能体](https://code.claude.com/docs/en/sub-agents)、插件、MCP 服务器、auto memory 与 CLAUDE.md 的自动发现，从而缩短启动时间。不加时，`claude -p` 会加载与交互式会话相同的[上下文](https://code.claude.com/docs/en/how-claude-code-works#the-context-window)，包括工作目录或 `~/.claude` 中配置的一切。

bare 模式适用于 CI 与脚本这类"每台机器上都要同样结果"的场景：队友 `~/.claude` 里的 hook、项目 `.mcp.json` 里的 MCP 服务器都不会运行，因为 bare 模式根本不读它们。用 `--add-dir` 指定的目录是个部分例外：bare 模式会从其 `.claude/skills/` 加载技能，但仍跳过其 `.claude/commands/` 与 `.claude/agents/` 目录。详见[来自额外目录的技能](https://code.claude.com/docs/en/skills#skills-from-additional-directories)。

不加 `--bare` 时，`-p` 会话会运行项目 `.claude/settings.json` 中的 hooks、连接其 `.mcp.json` 中的服务器——哪怕你从未信任过那个文件夹。`-p` 会话不显示工作区信任对话框，也没有逐服务器批准提示。各类仓库内容在 `-p` 下的行为与隔离方法见[在你信任文件夹之前会运行什么](https://code.claude.com/docs/en/permissions#what-runs-before-you-trust-a-folder)。

下例以 bare 模式运行一次性摘要任务，并预批准 Read 工具使调用无需权限提示即可完成。运行前请设置 `ANTHROPIC_API_KEY`，因为 bare 模式不使用你的订阅登录：

```bash
claude --bare -p "Summarize README.md" --allowedTools "Read"
```

bare 模式下，Claude Code 绝不读取 OAuth 凭据或系统钥匙串。对 Anthropic API，在环境里设置在 [Claude Console](https://platform.claude.com) 创建的 `ANTHROPIC_API_KEY`，或在 `--settings` JSON 中提供 `apiKeyHelper`。Amazon Bedrock、Google Cloud's Agent Platform 与 Microsoft Foundry 仍照常读取各自的提供商凭据。

bare 模式下 Claude 可使用 Bash、文件读与文件编辑工具。所需上下文用旗标显式传入：

| 要加载 | 使用 |
| --- | --- |
| 系统提示词追加 | `--append-system-prompt`、`--append-system-prompt-file` |
| 设置 | `--settings <file-or-json>` |
| MCP 服务器 | `--mcp-config <file-or-json>` |
| 自定义智能体 | `--agents <json>` |
| 插件 | `--plugin-dir <path>`、`--plugin-url <url>` |

> 注：`--bare` 是脚本与 SDK 调用的推荐模式，未来发布中将成为 `-p` 的默认值。

#### 退出时的后台任务

如果 Claude 在 `claude -p` 运行期间启动了[后台 Bash 任务](https://code.claude.com/docs/en/tools-reference#bash-tool-behavior)（例如开发服务器或 watch 构建），该 shell 会在 Claude 返回最终结果且 stdin 关闭后约五秒钟被终止。这段宽限期让"恰好在结果之后结束"的任务仍能交付输出。

如果 Claude 启动的是后台[子智能体](https://code.claude.com/docs/en/sub-agents)或工作流，`claude -p` 会保持打开直到该工作完成，因为其结果是最终输出的一部分。

默认情况下，连续空闲等待 10 分钟后等待即结束，卡死的子智能体或工作流不能无限期占住进程。届时 Claude Code 会停止仍在运行的内容并丢弃其部分结果。要更改上限，设置 [`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`](https://code.claude.com/docs/en/env-vars)，或设为 `0` 表示不设上限。

如果 Claude 在 `claude -p` 运行期间启动了 [Monitor](https://code.claude.com/docs/en/tools-reference#monitor-tool) 监视，Claude Code 会等待该监视直到超时或十分钟上限先到。等待期间，Claude 会持续响应监视报告的内容。默认情况下，监视在 Claude 启动它五分钟后超时。

#### 用 SIGTERM 停止运行

如果你用 SIGTERM 停止 `claude -p` 运行（例如用 `kill` 或进程管理器），Claude Code 以退出码 143 退出，正在进行的那一轮保持未完成、不记录结果。想正常结束那一轮，请在停止进程前发送 SIGINT，或调用 Agent SDK 的 `interrupt()`。

收到 SIGTERM 时，Claude Code 终止仍在运行的任何 Bash 命令的进程树，然后运行 [`SessionEnd` hooks](https://code.claude.com/docs/en/hooks#sessionend) 并退出。退出过程中不会启动新的工具调用、发送新的模型请求，除 `SessionEnd` 外不运行任何 hook。如果信号到达时正在执行命令或等待权限提示，处理方式如下：

* **正在执行命令**：Claude Code 在会话中把该命令记录为被杀死。
* **正在等待权限提示答复**：向进程发送 SIGTERM 时，Claude Code 让提示保持未答复；若你的程序经 Agent SDK 关闭会话，SDK 会在发送任何信号之前结束 Claude Code 的输入，输入一结束 Claude Code 即取消该提示。

[恢复会话](#继续对话)时，Claude Code 会继续被 SIGTERM 打断的那一轮。

### 实用样例

以下样例展示常见 CLI 模式。命令中出现的 `auth.py`、`build-error.txt` 等文件名，请替换为你自己项目里的文件。在 CI 等脚本环境中，加 [`--bare`](#bare-模式更快启动)，让 Claude Code 不加载宿主机的 hooks、插件、auto memory 或 `CLAUDE.md`。

#### 把数据管道给 Claude

非交互模式读 stdin，所以可以像其他命令行工具一样把数据灌入、把响应重定向出去。

下例把构建日志灌入 Claude，把解释写到文件：

```bash
cat build-error.txt | claude -p 'concisely explain the root cause of this build error' > output.txt
```

配 `--output-format json` 时，响应载荷包含 `total_cost_usd` 与按模型分解的成本，脚本调用方无需查[用量面板](https://code.claude.com/docs/en/costs)即可跟踪每次调用的花费。两项数字均为[客户端估算](https://code.claude.com/docs/en/agent-sdk/cost-tracking)，可能与实际账单不同。

> 注：管道 stdin 上限 10MB。超限时 Claude Code 以明确错误与非零状态退出。处理更大输入时，把内容写入文件、在提示词中引用文件路径，而不是管道传输。

如果 Claude Code 读不到 stdin（例如启动它的进程断开了自己那一端），Claude Code 向 stderr 打印警告并继续用命令行里的提示词。v2.1.211 之前，Windows 上不可读的 stdin 会让会话崩溃或无输出静默退出。

#### 把 Claude 加进构建脚本

把非交互调用包进脚本，把 Claude 当作项目专属的 linter 或 reviewer。

这个 `package.json` 脚本把对 `main` 的 diff 管道给 Claude，请它报告错别字。管道传输意味着 Claude 读 diff 不需要 Bash 权限；转义的双引号让脚本可移植到 Windows：

```json
{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"you are a typo linter. for each typo in this diff, report filename:line on one line and the issue on the next. return nothing else.\""
  }
}
```

用 `npm run lint:claude` 运行。

#### 获取结构化输出

用 `--output-format` 控制响应返回格式：

* `text`（默认）：纯文本输出
* `json`：含结果、会话 ID 与元数据的结构化 JSON
* `stream-json`：按行分隔的 JSON，用于实时流式传输

下例返回带会话元数据的项目摘要 JSON，文本结果在 `result` 字段：

```bash
claude -p "Summarize this project" --output-format json
```

要得到符合特定模式的输出，用 `--output-format json` 加 `--json-schema` 与一个 [JSON Schema](https://json-schema.org/) 定义。响应包含请求元数据（会话 ID、用量等），结构化输出在 `structured_output` 字段。

下例提取函数名并返回字符串数组：

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

如果值不是合法 JSON Schema，`claude` 以 `Error: --json-schema is not a valid JSON Schema` 退出并附校验器诊断。Claude Code 接受使用 `format` 关键字（如 `"format": "email"`）的模式，但把 `format` 当作注解、不做强制。v2.1.205 之前，Claude Code 会静默忽略非法模式并返回非结构化文本，且把任何含 `format` 的模式视为非法。

> 技巧：用 [jq](https://jqlang.org/) 之类的工具解析响应、提取字段：

```bash
# 提取文本结果
claude -p "Summarize this project" --output-format json | jq -r '.result'

# 提取结构化输出
claude -p "Extract function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}' \
  | jq '.structured_output'
```

#### 流式响应

用 `--output-format stream-json` 配 `--verbose` 与 `--include-partial-messages`，在生成的同时逐 token 接收。每行是一个代表事件的 JSON 对象：

```bash
claude -p "Explain recursion" --output-format stream-json --verbose --include-partial-messages
```

流的最后一行是 `result` 消息，含最终响应文本、成本与会话元数据。

如果消费方读取流较慢，Claude Code 会等排队输出排空后再退出，等待时长随剩余队列伸缩、上限 30 秒。v2.1.214 之前退出等待上限约两秒，可能截断大响应的结尾。

下例用 [jq](https://jqlang.org/) 过滤文本增量、只显示流式文本。`-r` 输出原始字符串（无引号），`-j` 连接时不加换行，让 token 连续流出：

```bash
claude -p "Write a poem" --output-format stream-json --verbose --include-partial-messages | \
  jq -rj 'select(.type == "stream_event" and .event.delta.type? == "text_delta") | .event.delta.text'
```

要程序化流式（回调与消息对象），见 Agent SDK 文档中的[实时流式响应](https://code.claude.com/docs/en/agent-sdk/streaming-output)。

##### 跟踪子智能体消息

来自[子智能体](https://code.claude.com/docs/en/sub-agents)的消息以 `assistant` 与 `user` 消息出现在流中，其 `parent_tool_use_id` 字段是孵化该子智能体的工具调用 ID；主对话的消息该字段为 `null`。

[前台](https://code.claude.com/docs/en/sub-agents#run-subagents-in-foreground-or-background)运行的子智能体的第一条消息是携带驱动它的提示词的 `user` 消息。此后 Claude Code 输出：

* **默认**：子智能体的 `tool_use` 与 `tool_result` 块。
* **启用 [`--forward-subagent-text`](https://code.claude.com/docs/en/cli-reference#cli-flags) 或 [`CLAUDE_CODE_FORWARD_SUBAGENT_TEXT`](https://code.claude.com/docs/en/env-vars) 时**：还有子智能体的文本与思考块，可以重建每个子智能体的完整记录。需要 Claude Code v2.1.211 或更高。

启用任一选项后，Claude Code 会转发[每一层嵌套](https://code.claude.com/docs/en/sub-agents#let-subagents-spawn-their-own-subagents)的子智能体消息：子智能体再孵化自己的子智能体时，嵌套消息的 `parent_tool_use_id` 携带孵化它的 Agent 工具调用 ID，顺着这些 ID 可重建完整嵌套树。v2.1.219 之前，嵌套子智能体的消息不出现在流中。

[在子智能体中运行](https://code.claude.com/docs/en/skills#run-skills-in-a-subagent)的技能以同样方式出现在流中：被分叉技能的第一条消息是携带技能内容的 `user` 消息；启用任一选项时，流也携带其文本与思考块。v2.1.265 之前，被分叉技能只有 `tool_use` 与 `tool_result` 块出现在流中。

##### 处理 API 重试

API 请求遇到可重试错误时，Claude Code 会在重试前发出 `system/api_retry` 事件。v2.1.246 起，当 `401` 或 `403` 拒绝 [`apiKeyHelper`](https://code.claude.com/docs/en/settings-reference#apikeyhelper) 凭据时，前两次重试静默进行、不发事件，从第三次连续重试起照常发出。静默重试也计入 `attempt`。可以用该事件在自己的界面展示重试进度。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `"system"` | 消息类型 |
| `subtype` | `"api_retry"` | 标识这是重试事件 |
| `attempt` | 整数 | 当前尝试次数，从 1 起 |
| `max_retries` | 整数 | 该失败原因允许的总重试数，可能小于会话级预算 |
| `retry_delay_ms` | 整数 | 距下次尝试的毫秒数 |
| `error_status` | 整数或 null | 失败尝试的 HTTP 状态码；未收到 HTTP 响应时为 `null` |
| `no_response` | 对象，可选 | 仅当失败尝试[未及时收到响应头](https://code.claude.com/docs/en/errors#no-response-from-api)时出现。`waited_ms` 是该次等待时长、`retry_wait_ms` 是重试将等待的时长。这些事件中 `max_retries` 反映该原因通常仅有的 1 次重试而非会话级预算。需要 v2.1.261 或更高 |
| `error` | 字符串 | 错误类别：`authentication_failed`、`oauth_org_not_allowed`、`account_on_hold`、`billing_error`、`rate_limit`、`overloaded`、`invalid_request`、`model_not_found`、`server_error`、`max_output_tokens`、`cloud_credential_error` 或 `unknown` |
| `uuid` | 字符串 | 事件唯一标识 |
| `session_id` | 字符串 | 事件所属会话 |

##### 读取会话元数据

`system/init` 事件报告会话元数据，包括模型、工具、MCP 服务器与已加载插件。除非有启动事件先行，它是流中的第一个事件：

* 设置了 [`CLAUDE_CODE_SYNC_PLUGIN_INSTALL`](https://code.claude.com/docs/en/env-vars) 时的 `plugin_install` 事件。
* 配置的 [`SessionStart`](https://code.claude.com/docs/en/hooks#sessionstart) 或 [`Setup`](https://code.claude.com/docs/en/hooks#setup) hook 运行期间的 [`hook_started`、`hook_progress`、`hook_response` 事件](https://code.claude.com/docs/en/agent-sdk/typescript#sdkhookstartedmessage)，随 hook 产生即流式发出（v2.1.169-2.1.203 曾在 hook 完成后一批发出，仍在 `system/init` 之前；v2.1.204 恢复实时发送）。

该事件还携带可选的 `capabilities` 字符串数组，列出本版本 Claude Code 实现的协议行为（如 `interrupt_receipt_v1`、`interrupt_cancel_queued_v1`）。请用它做特性探测而非比较版本字符串，忽略不认识的值。该字段需要 v2.1.205 或更高。能力清单见 [`SDKSystemMessage`](https://code.claude.com/docs/en/agent-sdk/typescript#sdksystemmessage)。

##### 插件或 MCP 服务器未加载时让 CI 失败

用 `system/init` 事件中的插件字段捕获未加载的插件：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `plugins` | 数组 | 成功加载的插件，各含 `name` 与 `path` |
| `plugin_errors` | 数组 | 插件加载期错误，各含 `plugin`、`type`、`message`。包括未满足的依赖版本与 `--plugin-dir` 加载失败（如路径缺失或归档非法）。受影响插件被降级且不出现在 `plugins` 中。无错误时省略该键 |

MCP 服务器字段用法相同。用 `-p` 传 [`--mcp-config`](https://code.claude.com/docs/en/cli-reference#cli-flags) 时，Claude Code 会在第一轮之前等待仍待连接的服务器，等待上限为 [`MCP_TIMEOUT`](https://code.claude.com/docs/en/env-vars) 启动超时（默认 30 秒）。带[缓存工具列表](https://code.claude.com/docs/en/agent-sdk/mcp#connection-timing)的远程服务器跳过等待、在 `system/init` 中显示 `pending`、在其首次工具调用时连接。该等待需要 v2.1.221 或更高。

Claude Code 启动时校验每个 `--mcp-config` 条目，跳过校验失败的条目（例如没有 `type` 的 `url` 条目）。运行继续并正常退出，所以要检查这些字段以捕获从未加载的服务器：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mcp_servers` | 数组 | 会话中的 MCP 服务器，各含 `name` 与 `status` |
| `mcp_server_errors` | 数组 | 被配置校验跳过的 `--mcp-config` 条目，各含 `name`、`type`、`message`。`type` 是跳过类别（如 `unknown_type`、`url_missing_type`、`invalid_config`、`reserved_name`），不认识的值按一般跳过处理。受影响服务器不出现在 `mcp_servers` 中。无错误时省略该键，CI 门禁可以对非空数组判失败。需要 v2.1.219 或更高 |

在终端手工运行时，Claude Code 还会向 stderr 打印启动警告（如 `Warning: 1 MCP server skipped due to invalid config:`，后跟每个被跳过条目的原因）；重定向 stderr 或由 CI runner、SDK 宿主捕获时，则不打印警告、只在 `mcp_server_errors` 字段报告。该警告需要 v2.1.219 或更高。

##### 跟踪插件安装

设置 [`CLAUDE_CODE_SYNC_PLUGIN_INSTALL`](https://code.claude.com/docs/en/env-vars) 后，Claude Code 在第一轮之前安装市场插件期间发出 `system/plugin_install` 事件，可用于在自己的 UI 展示安装进度：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `"system"` | 消息类型 |
| `subtype` | `"plugin_install"` | 标识这是插件安装事件 |
| `status` | `"started"`、`"installed"`、`"failed"` 或 `"completed"` | `started` 与 `completed` 界定整体安装；`installed` 与 `failed` 报告各市场 |
| `name` | 字符串，可选 | 市场名，出现在 `installed` 与 `failed` 上 |
| `error` | 字符串，可选 | 失败信息，出现在 `failed` 上 |
| `uuid` | 字符串 | 事件唯一标识 |
| `session_id` | 字符串 | 事件所属会话 |

#### 自动批准工具

用 `--allowedTools` 让 Claude 无需提示即使用某些工具。下例运行测试套件并修复失败，允许 Claude 执行 Bash 命令、读写文件而无需逐次询问：

```bash
claude -p "Run the test suite and fix any failures" \
  --allowedTools "Bash,Read,Edit"
```

想为整个会话设基线而非逐个列工具，传一个[权限模式](https://code.claude.com/docs/en/permission-modes)。对 `-p` 而言，所有计划的[内置起始权限模式](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)都是 Manual，所以要显式传你想要的模式：

* **`auto`**：传 `--permission-mode auto`，由分类器代你审查大多数动作
* **`dontAsk`**：Claude Code 拒绝每个原本会弹窗的调用，适合锁死的 CI 运行。Manual 模式下无需批准的动作照常执行，例如工作目录内的文件读取与[只读命令集](https://code.claude.com/docs/en/permissions#read-only-commands)，你的 `--allowedTools` 条目或 `permissions.allow` 规则覆盖的动作也照常执行。`AskUserQuestion`、组织设为 `ask` 的连接器工具、标记 [`requiresUserInteraction`](https://code.claude.com/docs/en/mcp#require-approval-for-a-specific-tool) 的 MCP 工具即使有 allow 规则也会被拒绝
* **`acceptEdits`**：Claude 写文件不再提示，Claude Code 自动批准 `mkdir`、`touch`、`mv`、`cp` 等常见文件系统命令。[任何模式都不自动批准的动作](https://code.claude.com/docs/en/permission-modes#actions-no-mode-auto-approves)仍然适用。除只读命令集外，其他 shell 命令与网络请求仍需 `--allowedTools` 条目或 `permissions.allow` 规则。完整清单见 [acceptEdits 自动批准什么](https://code.claude.com/docs/en/permission-modes#auto-approve-file-edits-with-acceptedits-mode)

下例以 `acceptEdits` 为基线应用 lint 修复：

```bash
claude -p "Apply the lint fixes" --permission-mode acceptEdits
```

#### 无人值守运行时关闭权限提示

没人应答权限提示时（例如定时任务），传 `--permission-prompts none`。该旗标在运行带权限宿主时最要紧：带 [`canUseTool` 回调](https://code.claude.com/docs/en/agent-sdk/user-input)的 Agent SDK 应用，或经 [`--permission-prompt-tool`](https://code.claude.com/docs/en/cli-reference#cli-flags) 传入的 MCP 工具。不加旗标时，运行会等待该宿主应答每个权限请求。

加了旗标，运行不咨询宿主、也不等待。任何原本会弹窗的动作都被拒绝，除非 `PermissionRequest` hook 允许；Claude 会被告知无人可批准该请求、不要重试，然后运行继续。无宿主的 `-p` 运行中这些请求本来也会被拒绝，旗标额外告诉 Claude 不要重试。权限规则、[`PermissionRequest` hooks](https://code.claude.com/docs/en/hooks#permissionrequest) 与所设权限模式仍先于一切决定每个调用；Claude Code 只拒绝其他机制都未放行的请求。

配 `--permission-prompts none` 时，Claude Code 会移除需要人来答复的工具（如 [`AskUserQuestion`](https://code.claude.com/docs/en/tools-reference#askuserquestion-tool-behavior)），Claude 无法调用它们；任何没有 [`Elicitation` hook](https://code.claude.com/docs/en/hooks#elicitation) 应答的 [MCP elicitation 请求](https://code.claude.com/docs/en/mcp#respond-to-mcp-elicitation-requests)都会被取消。

配 `--output-format stream-json` 时，拒绝以 `permission_denied` 系统消息出现，最终结果消息在 `permission_denials` 中列出它们。

下例以 [auto 模式](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode)运行无人值守任务：分类器照常审查每个动作，任何原本要回退到弹窗的都会被拒绝：

```bash
claude -p "Update the dependency pins and run the tests" --permission-mode auto --permission-prompts none
```

> 注：`--permission-prompts` 旗标需要 Claude Code v2.1.259 或更高；更早版本会以未知选项错误拒绝。

#### 创建提交

下例审查暂存区改动并创建一条合适的提交：

```bash
claude -p "Look at my staged changes and create an appropriate commit" \
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)"
```

`--allowedTools` 使用[权限规则语法](https://code.claude.com/docs/en/settings-reference#permission-rule-syntax)。结尾的 ` *` 启用前缀匹配：`Bash(git diff *)` 允许任何以 `git diff` 开头的命令。`*` 前的空格很重要——没有它，`Bash(git diff*)` 还会匹配到 `git diff-index`。

> 注：用户调用的[技能](https://code.claude.com/docs/en/skills)与自定义命令在 `-p` 模式可用：把 `/skill-name` 写进提示词字符串，Claude Code 会在运行前展开。只能在终端界面运行的内置命令（如 `/login`）在 `-p` 模式不可用。`/model`、`/effort`、`/fast`、`/color`、`/rename` 接受值作参数（如 `/model sonnet`），无参数的 `/mcp` 打印服务器状态文本摘要；这些形式需要 v2.1.205 或更高并遵循各命令的可用性说明。要从 `-p` 调用改设置，给 `/config` 传 `key=value`（如 `/config thinking=false`）。

#### 自定义系统提示词

用 `--append-system-prompt` 在保留 Claude Code 默认行为的同时追加指令。下例把 PR diff 管道给 Claude，指示它做安全漏洞审查。保存为 shell 脚本（如 `review.sh`）：

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

脚本中 `"$1"` 代表命令行第一个参数：运行 `bash review.sh 123`，shell 把 `"$1"` 替换为 `123`，脚本即拉取 PR 123 的 diff。Claude Code 以 JSON 打印评审，文本在 `result` 字段。

更多选项（含完整替换默认提示词的 `--system-prompt`）见[系统提示词旗标](https://code.claude.com/docs/en/cli-reference#system-prompt-flags)。

#### 继续对话

用 `--continue` 继续最近一次对话，或用 `--resume` 加会话 ID 继续指定对话。v2.1.257 起，传 `--continue` 时，Claude Code 会接续已完成的[后台会话](https://code.claude.com/docs/en/sessions#resume-a-session)，但不接仍在运行的。下例先跑一次评审，再发后续提示：

```bash
# 第一次请求
claude -p "Review this codebase for performance issues"

# 继续最近的对话
claude -p "Now focus on the database queries" --continue
claude -p "Generate a summary of all issues found" --continue
```

并行跑多个对话时，捕获会话 ID 以恢复指定的那个：

```bash
session_id=$(claude -p "Start a review" --output-format json | jq -r '.session_id')
claude -p "Continue that review" --resume "$session_id"
```

两条命令可以在不同目录运行：Claude Code 在本机任何项目中[按 ID 查找会话](https://code.claude.com/docs/en/sessions#resume-a-session)。v2.1.223 之前只在当前项目目录及其 git worktree 中查找，两条命令必须在同一目录运行。

也可以不给会话 ID，而把某会话 `.jsonl` [记录文件](https://code.claude.com/docs/en/sessions#where-transcripts-are-stored)的绝对路径传给 `--resume`，Claude Code 会继续该文件中的对话。

### 下一步

* [Agent SDK 快速入门](https://code.claude.com/docs/en/agent-sdk/quickstart)：用 Python 或 TypeScript 构建你的第一个智能体
* [CLI 参考](https://code.claude.com/docs/en/cli-reference)：全部 CLI 旗标与选项
* [GitHub Actions](https://code.claude.com/docs/en/github-actions)：在 GitHub 工作流中使用 Agent SDK
* [GitLab CI/CD](https://code.claude.com/docs/en/gitlab-ci-cd)：在 GitLab 流水线中使用 Agent SDK

## 二、Agent SDK：把 Claude Code 当库用（官方文档全文翻译）

*译自 [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk)（Claude Code 官方文档，2026-09 当前版）。*

把 Claude Code 作为库，构建生产级 AI 智能体。

智能体是一种应用：它通过规划自己的步骤、调用读取文件/运行命令/编辑代码的工具来完成任务。Agent SDK 提供驱动 Claude Code 的同一套工具、[智能体循环](https://code.claude.com/docs/en/agent-sdk/agent-loop)与上下文管理，可用 Python 与 TypeScript 编程。

### 把 Agent SDK 与其他 Claude 工具对比

Agent SDK、CLI、Client SDK 与 Managed Agents 各适配不同需求。用下表找到匹配你构建目标的那个：

| 如果你在…… | 用 | 理由 |
| --- | --- | --- |
| 构建智能体但不想自己实现工具循环 | **Agent SDK** | 在你自己的进程里运行智能体循环的库，Python 或 TypeScript |
| 终端交互开发或跑一次性任务 | [**Claude Code CLI**](https://code.claude.com/docs/en/overview) | 为日常交互使用打造的终端界面 |
| 直接调 API、自己实现工具循环 | [**Client SDK**](https://platform.claude.com/docs/en/api/client-sdks) | 直达 Anthropic API 而非 Claude Code，工具循环自己写 |
| 跑长期/异步智能体、不想自管沙箱与会话基础设施 | [**Managed Agents**](https://platform.claude.com/docs/en/managed-agents/overview) | 托管 REST API，与 Agent SDK 是两个产品；Anthropic 替你运行智能体与沙箱 |

SDK 仅有 Python 与 TypeScript 库形态。要从其他语言驱动同一智能体循环，[以子进程方式运行 CLI](https://code.claude.com/docs/en/headless)，用 `-p` 旗标加 `--output-format json`——即上一节的 Headless 形态。

### 能力

以下 Claude Code 能力在 SDK 中可用：

| 能力 | 作用 | 了解更多 |
| --- | --- | --- |
| 内置工具 | 读、写、编辑文件，运行命令，搜索网页 | [工具参考](https://code.claude.com/docs/en/tools-reference) |
| Hooks | 在智能体生命周期关键点运行自定义代码 | [Hooks](https://code.claude.com/docs/en/agent-sdk/hooks) |
| 子智能体 | 为专注的子任务孵化专职智能体 | [子智能体](https://code.claude.com/docs/en/agent-sdk/subagents) |
| MCP | 经模型上下文协议连接外部工具与数据源 | [MCP](https://code.claude.com/docs/en/agent-sdk/mcp) |
| 权限 | 控制哪些工具自动运行、哪些需要批准 | [权限](https://code.claude.com/docs/en/agent-sdk/permissions) |
| 会话 | 跨交换维持上下文，之后可恢复或分叉 | [会话](https://code.claude.com/docs/en/agent-sdk/sessions) |
| 技能、命令与记忆 | 自动从项目 `.claude/` 与 `~/.claude/` 加载，与 Claude Code 相同 | [技能](https://code.claude.com/docs/en/agent-sdk/skills)、[命令](https://code.claude.com/docs/en/agent-sdk/skills#commands-in-agent-sdk-sessions)、[记忆](https://code.claude.com/docs/en/agent-sdk/modifying-system-prompts)、[配置加载](https://code.claude.com/docs/en/agent-sdk/claude-code-features) |
| 插件 | 打包技能、智能体、hooks 与 MCP 服务器，按本地路径加载 | [插件](https://code.claude.com/docs/en/agent-sdk/plugins) |

### 开始

按[快速入门](https://code.claude.com/docs/en/agent-sdk/quickstart)安装 SDK、设置 API 密钥并构建你的第一个智能体——一个在既有代码里找出并修复 Bug 的智能体。

> 注：除非事先获批，Anthropic 不允许第三方开发者的产品（包括基于 Claude Agent SDK 构建的智能体）提供 claude.ai 登录或其速率额度。请改用[快速入门](https://code.claude.com/docs/en/agent-sdk/quickstart)所述的 API 密钥认证方式。

### 更新日志

查看 SDK 更新、修复与新功能的完整日志：

* **TypeScript SDK**：[查看 CHANGELOG.md](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)
* **Python SDK**：[查看 CHANGELOG.md](https://github.com/anthropics/claude-agent-sdk-python/blob/main/CHANGELOG.md)

### 报告缺陷

遇到 Agent SDK 的缺陷或问题：

* **TypeScript SDK**：[在 GitHub 上报告](https://github.com/anthropics/claude-agent-sdk-typescript/issues)
* **Python SDK**：[在 GitHub 上报告](https://github.com/anthropics/claude-agent-sdk-python/issues)

### 品牌指南

对集成 Claude Agent SDK 的合作伙伴，Claude 品牌的使用是可选的。在你的产品中提到 Claude 时：

**允许：**

* "Claude Agent"——下拉菜单首选
* "Claude"——在已标注 "Agents" 的菜单内
* "\{你的智能体名} Powered by Claude"——当你已有自己的智能体名

**不允许：**

* "Claude Code" 或 "Claude Code Agent"
* Claude Code 品牌的 ASCII 艺术或模仿 Claude Code 的视觉元素

你的产品应保持自己的品牌，不得看起来像 Claude Code 或任何 Anthropic 产品。品牌合规问题请联系 Anthropic [销售团队](https://www.anthropic.com/contact-sales)。

### 许可与条款

Claude Agent SDK 的使用受 [Anthropic 商业服务条款](https://www.anthropic.com/legal/commercial-terms)约束——包括当你用它驱动向自己的客户与最终用户提供的产品与服务时；特定组件或依赖在其 LICENSE 文件中标注了其他许可的除外。

### 下一步

以下资源覆盖用 Agent SDK 构建的更深入技术细节与示例项目：

* [快速入门](https://code.claude.com/docs/en/agent-sdk/quickstart)：构建你的第一个"找 Bug 修 Bug"智能体
* [迁移指南](https://code.claude.com/docs/en/agent-sdk/migration-guide)：从 Claude Code SDK 包迁移到 Agent SDK
* [智能体循环](https://code.claude.com/docs/en/agent-sdk/agent-loop)：Claude 如何规划、调用工具并判断任务完成
* [示例智能体](https://github.com/anthropics/claude-agent-sdk-demos)：本地开发的演示应用
* [TypeScript SDK](https://code.claude.com/docs/en/agent-sdk/typescript)：完整 TypeScript API 参考与示例
* [Python SDK](https://code.claude.com/docs/en/agent-sdk/python)：完整 Python API 参考与示例
* [智能体 harness 设计](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code)：Claude Code 团队如何用动态工作流一次编排大量子智能体

## 三、Claude Code GitHub Actions：事件驱动的仓库智能体（官方文档核心章节全译）

*译自 [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)（Claude Code 官方文档，2026-09 当前版，核心章节全译）。*

Claude Code GitHub Action 会从你的 workflow 配置判断以何种方式运行：

* **交互模式**：workflow 未提供 `prompt` 输入时，Claude 等待触发短语（默认 `@claude`）——出现在 issue/PR 评论、PR 评审、或新开 issue 的标题正文里——然后响应请求。进度与结果以评论形式出现在触发它的 issue/PR 上。
* **自动化模式**：workflow 提供了 `prompt` 输入时，Claude 不等提及直接运行，只受[触发者检查](#谁能触发运行)约束。默认结果出现在 workflow 运行日志而非评论中；当提示词指示且 Claude 拥有能发帖的工具时，它也可以发到 issue/PR（如代码评审示例）。

#### 谁能触发运行

两种模式下，Claude 启动前都会对触发者做两项检查，任一被拒则运行失败：

* **写权限**：issue 与 PR 事件中，触发用户必须对仓库有写权限。要允许特定无写权限用户，设置 `allowed_non_write_users` 并传入你自己的 `github_token` 输入。无用户发起的事件（如 `schedule` 触发）跳过此检查。
* **人类检查**：所有事件中，Claude Code GitHub Action 拒绝机器人触发者，除非你把它列入 `allowed_bots`——防止机器人互相触发形成循环。该检查同样适用于定时运行：GitHub 把定时运行归到某个仓库用户名下（通常是最后修改 workflow `cron` 的人）；如果该用户是机器人，把它列入 `allowed_bots`。

#### 示例：响应 @claude 提及

```yaml
name: Claude Code
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      issues: write
      id-token: write
      actions: read
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 1
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

这个 workflow 里非模板的部分：`id-token: write` 是 Action 默认 GitHub App 认证所需；`actions: read` 让 Claude 能读 PR 上的 CI 结果；`actions/checkout` 给 Claude 一份可工作的仓库本地副本；`if` 防止未提及 `@claude` 的评论触发 runner（Action 本身在响应前也会再查一次触发短语）。

workflow 就位后，在任意 issue/PR 评论里提及 `@claude` 提请求：

```text
@claude implement this feature based on the issue description
@claude how should I implement user authentication for this endpoint?
@claude fix the TypeError in the user dashboard component
```

Claude 在同一 issue/PR 的评论中回复，并随工作进展更新该评论。

#### 示例：定时运行

有了 `prompt` 输入，Claude Code GitHub Action 即可以自动化模式在任何 GitHub 事件上运行，包括 cron 计划。对纯文本提示词，在你授予工具之前，Claude 没有 shell 与 GitHub API 访问——用 `claude_args` 里的 `--allowedTools` 或 `settings` 输入中的 [`permissions.allow` 规则](https://code.claude.com/docs/en/permissions#permission-rule-syntax)。若改为调用技能，Claude 可以用技能 [`allowed-tools` frontmatter](https://code.claude.com/docs/en/skills#pre-approve-tools-for-a-skill) 授予的工具。GitHub 只从默认分支运行定时 workflow；公开仓库 60 天无活动会停用计划。

下例每天 UTC 09:00 在 workflow 运行日志中生成报告，`claude_args` 行传递选择模型并允许两个 GitHub MCP 工具的 CLI 参数；Claude 经 GitHub API 读提交与 issue，因此可省去 checkout 步骤：

```yaml
name: Daily Report
on:
  schedule:
    - cron: "0 9 * * *"
jobs:
  report:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: read
      id-token: write
    steps:
      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: "Generate a summary of yesterday's commits and open issues"
          claude_args: |
            --model claude-opus-4-8
            --allowedTools "mcp__github__list_commits,mcp__github__list_issues"
```

（官方文档另给出"运行技能"的完整 workflow 示例：安装 `code-review` 插件、在 PR 打开/更新/标记就绪时运行 `/code-review:code-review --comment …`，用 `claude_args` 的 `--allowedTools` 命名发评论的 MCP 工具——Claude 会跳过草稿与已关闭的 PR、判定无需评审的自动化/琐碎 PR，以及已有 Claude 评论的 PR。全文见[官方页面](https://code.claude.com/docs/en/github-actions)。）

#### 最佳实践

**把项目标准写进 CLAUDE.md**：在仓库根目录建 `CLAUDE.md`，定义代码风格、评审标准、项目专属规则与惯用模式。Claude 建 PR 和响应请求时都会遵守。详见[记忆文档](https://code.claude.com/docs/en/memory)。

**保护凭据**：

> 警告：绝不把 API 密钥或 OAuth 令牌直接提交进仓库。始终存为 GitHub Secrets 并在 workflow 中通过 secrets 上下文引用（如把 `ANTHROPIC_API_KEY` 传给动作的 `anthropic_api_key` 输入）。

只授予 workflow 所需的权限，合并前审查 Claude 的改动。包括权限与认证的完整安全指引见 [Claude Code Action 安全文档](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md)。

**管理成本**：每次运行消耗两类资源——

* **GitHub Actions 分钟数**：Action 跑在 GitHub 托管 runner 上，消耗你的 Actions 分钟。定价与额度见 GitHub 计费文档。
* **API token**：每次交互按提示词/响应长度、任务复杂度与代码库大小消耗 token。当前费率见 Claude 定价页。若用 OAuth 令牌认证，运行消耗你的 Claude 订阅而非 API 计费。

两类成本都可以靠"更清晰的上下文 + 限制单次运行的工作量"来降低：把 `@claude` 请求写具体（减少轮次）；用 issue 模板前置上下文；保持 `CLAUDE.md` 精简（每次运行都会读）；`claude_args` 设 `--max-turns` 限制迭代；workflow 级超时防失控；用 GitHub 并发控制限制并行数。组织级用量跟踪见 [analytics 面板](https://code.claude.com/docs/en/analytics)与[监控](https://code.claude.com/docs/en/monitoring-usage)。

#### 使用云提供商

默认情况下 Action 用你的 API 密钥或 OAuth 令牌直调 Claude API。要改经你自己的云账户路由推理，设置对应输入并按官方指引操作：**Amazon Bedrock** 用 `use_bedrock: "true"`；**Google Cloud's Agent Platform** 用 `use_vertex: "true"`；**Microsoft Foundry** 用 `use_foundry: "true"`。三家都以 OIDC 身份联合认证取代 Claude API 密钥，仓库中无需存放静态云凭据。

## 四、GitHub Copilot cloud agent：另一家的云端形态（官方文档全文翻译）

*译自 [About GitHub Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)（GitHub 官方文档，2026-09 当前版；原文中的链接与站内引用从略）。*

### Copilot cloud agent 概览

有了 Copilot cloud agent，GitHub Copilot 可以像人类开发者一样在后台独立完成任务。

Copilot cloud agent 能：

* 研究仓库
* 创建实现计划
* 修复 Bug
* 实现增量新特性
* 提升测试覆盖率
* 更新文档
* 处理技术债
* 解决合并冲突

把任务委派给 Copilot cloud agent 时，你可以：

* 用 GitHub.com 上的智能体面板（或其他智能体入口），让 Copilot 研究、计划、在分支上改代码，并在创建 PR 之前迭代；你也可以在提示词中直接要求立刻创建 PR。
* 从其他入口（包括 GitHub Issues 与 VS Code）让 Copilot 开新 PR。
* 在已有 PR 的评论中 `@copilot`，请它做改动。
* 配置自动化（automation），按计划或响应事件（如 issue 被打开）自动运行 Copilot。
* 在安全活动中把安全告警指派给 Copilot。

Copilot cloud agent 会根据你给的提示词评估分派给它的任务。

处理编码任务期间，Copilot cloud agent 拥有自己的**临时开发环境**（由 GitHub Actions 驱动），可以在其中探索你的代码、做改动、执行自动化测试与 linter 等。

> 注：创建 PR 之前的深度研究、计划与迭代，仅在 GitHub.com 上的 Copilot cloud agent 可用；Microsoft Teams 与 Slack 集成为公开预览。其他集成（如 Azure Boards、JIRA、Linear）只支持直接创建 PR。

### 相较传统 AI 工作流的优势

用得得当时，Copilot cloud agent 相较 IDE 内的传统 AI 助手有生产力优势：

* **IDE 内 AI 助手**：编码发生在**本地**。开发者与 AI 助手**同步**结对。会话中的决策**不被跟踪**、随时间丢失（除非被提交）。尽管助手帮忙写代码，开发者仍有大量**手动步骤**：建分支、写提交信息、push、开 PR、写 PR 描述、求评审、回 IDE 迭代、再重复。这些步骤消耗的时间精力，对简单或例行问题来说难以证成。
* **Copilot cloud agent**：一切编码与迭代都发生在 **GitHub 上**。你可以让 Copilot **研究**仓库、**创建计划**、在分支上**改代码**——全部在开 PR 之前完成。你可以创建多个专精不同任务类型的**自定义智能体**。Copilot **自动化**了建分支、写提交信息与 push。开发者让智能体**在后台工作**，准备好后选择**创建 PR**。在 GitHub 上工作带来**透明性**（每一步都落在一个 commit、日志可查）与整个团队的**协作**机会。

### Copilot Chat 与 cloud agent 会话间共享上下文

从 GitHub 上的 Copilot Chat 启动 cloud agent 会话时，会话会带上你的聊天上下文。会话运行期间你可以继续聊天，在同一对话中追问进度。

### Copilot cloud agent 与 agent mode 的区别

Copilot cloud agent 不同于 IDE 中的 "agent mode"。cloud agent 在由 GitHub Actions 驱动的环境中自主工作，完成经 GitHub issue 或 Copilot Chat 提示词分派的开发任务：可以研究仓库、创建计划、在分支上改代码并可选地开 PR。而 IDE 里的 agent mode 直接在你的本地开发环境中做自主编辑。

### 用 cloud agent 精简软件开发

把任务分派给 Copilot cloud agent 能改进你的开发工作流。例如：把 backlog 上直截了当的 issue 指派给 Copilot（选它为 assignee），把时间留给更复杂、更有趣或需要高度创造性思考的工作；cloud agent 还能处理那些"有了更好"但总排在后面的 issue——改进代码库或产品质量的那种。有了这个额外的编码资源，你也可以启动原本因人力不足而不敢启动的任务：建 issue 请它重构代码或补日志，然后立刻指派。你还可以让它先研究仓库、创建计划再写任何代码——帮助理解代码库或在动手前对齐方案。它开工后你也可以接手自己继续。为不同任务创建专门的自定义智能体：专精 React 组件与样式的前端智能体、擅长写技术文档的文档智能体、专攻全面单元测试的测试智能体——每个都能配特定的提示词与工具。

### 度量 cloud agent 的 PR 成果

企业管理员与组织所有者可用 Copilot 用量指标分析 cloud agent 所开 PR 的成果。Copilot 用量指标 API 包含 PR 生命周期指标：创建与合并的 PR 总数；由 cloud agent 创建且已合并的 PR 数；已合并 PR（含 cloud agent 创建的）的中位合并时间。这些指标帮你跟踪 cloud agent 的采纳，并监测 PR 吞吐与合并时间的变化。

### 与第三方工具集成

你可以从外部工具调用 cloud agent：分派任务、提供上下文、开 PR，无需离开你的工作流。在 Microsoft Teams 与 Slack 中使用 cloud agent，与团队协作完成智能体辅助的工作：在频道、会话串与私信中 @mention GitHub，与队友和 Copilot 一起做研究、计划与编码任务。队友可以补充上下文、引导 Copilot 会话、监控进度，然后评审产出物。

### 让 cloud agent 可用

分派任务前，必须先启用。Copilot cloud agent 对所有付费 Copilot 计划可用。若你是 Copilot Business 或 Copilot Enterprise 订阅者，管理员须先启用相应策略。仓库所有者可以选择让部分或全部仓库退出 cloud agent。

### cloud agent 使用的 AI 模型

根据你启动任务的方式，也许可以选用 cloud agent 所用的模型。不同模型对不同类型的任务可能表现更好、回答更有用。

### 增强 cloud agent 对仓库的了解

cloud agent 对你仓库中的代码、所用工具、编码标准与实践了解越多，就越有效。两种方式：

* **自定义指令（Custom instructions）**：你编写、以一个或多个文件存放在仓库中的简短自然语言语句。组织所有者还可以在组织设置中定义。
* **Copilot memory**（公开预览）：Pro、Pro+ 或 Max 计划可启用。Copilot 会存下它自己总结的仓库相关有用细节，cloud agent 在该仓库工作时会利用这些信息。

### cloud agent 使用成本

cloud agent 消耗 GitHub Actions 分钟数与 **AI 额度（AI credits）**；AI 额度的消耗取决于所用模型与会话中处理的 token 数。在套餐包含的 Actions 分钟与 AI 额度之内使用 cloud agent 不产生额外费用。私有仓库上的 Copilot code review 同样消耗 Actions 分钟数。

### 自定义 cloud agent

* **自定义指令**：给 Copilot 关于项目以及如何构建、测试、验证改动的额外上下文。
* **MCP 服务器**：给 Copilot 访问不同数据源与工具的能力。GitHub 上的仓库 MCP 设置同时作用于 cloud agent 与 Copilot code review；GitHub MCP 服务器与 Playwright MCP 服务器默认对两者启用。
* **自定义智能体（Custom agents）**：为不同任务创建 Copilot 的不同专门版本——例如把 Copilot 定制成遵循你团队规范的前端专家。
* **Hooks**：在智能体执行的关键点执行自定义 shell 命令，可加校验、日志、安全扫描或工作流自动化。
* **Skills**：用指令、脚本与资源增强 Copilot 完成专门任务的能力。

### cloud agent 的限制

**开发工作流上的限制：**

* Copilot 只能在你启动任务时指定的仓库中做改动，单次运行不能跨多个仓库。
* 默认只能访问所指定仓库中的上下文（Copilot MCP 服务器默认配置为允许访问其工作仓库的 issue 与历史 PR）；可以通过仓库 MCP 设置配置更广的访问。
* 同一时间只能处理一条分支，且每个任务恰好开一个 PR。
* 每个 cloud agent 会话最长执行时间 **59 分钟**——硬限制、不可延长或绕过。超时即会话终止。复杂任务请拆成更小、更聚焦的任务。可用 `copilot-setup-steps.yml` 中的 `timeout-minutes` 配置更短超时。

**与其他功能兼容性的限制：**

* Copilot 无法遵守你为仓库配置的某些规则：如果 ruleset 或分支保护规则与 cloud agent 不兼容，对智能体的访问会被阻断——例如"只允许特定提交作者"的规则会阻止它创建或更新 PR。规则以 rulesets 配置时，可把 Copilot 加为 bypass 主体以恢复访问。
* cloud agent 只能处理托管在 GitHub 上的仓库；仓库在其他代码托管平台上则无法工作。

### 上手练习

试一下官方 Skills 练习 "Expand your team with Copilot cloud agent"，获得实战经验。

> 编者注（本站补充，已标明）：把本篇三节与上一节并排可以看出，"云端 PR 智能体"已是行业标准形态：触发（mention/事件/定时）→ 沙箱环境 → 分支改动 → PR → 评审。区别只在生态位——Anthropic 系开放 SDK 供你自建编排（CLI→SDK→Actions 三层可单独用也可组合），GitHub 系原生绑定平台流程。无论哪条路线，无人值守的成败都取决于同一组要素：**权限收敛**（第 8 篇的 allowlist/沙箱/dontAsk）、**可验证的完成标准**（`--max-turns`、超时、测试当裁判）、**产物一律走 PR 审查**（第 13、20 篇）、**成本可观测**（第 27 篇）。

---

> 下一篇预告：当智能体真的在无人值守跑、成批产出代码时，"安全与质量陷阱"就不再是理论问题。下一篇用一个真实的科学虚构级事件——模型越狱并攻入 Hugging Face——讲 AI 代码的风险模型。

> **来源**：本文第一节译自 [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)，第二节译自 [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk)，第三节译自 [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)（均为 Claude Code 官方文档 2026-09 当前版，作者 Anthropic，Copyright Anthropic PBC）；第四节译自 [About GitHub Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)（GitHub 官方文档）。四节均为完整或核心章节全译，教学用途编译翻译并署名。开头编者按与文末"编者注"为本站编者补充并已标明。抓取于 2026-09-13。
