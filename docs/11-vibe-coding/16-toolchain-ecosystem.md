---
title: 工具链生态：Cline、Windsurf 与 Headless CI 中的 AI 编码
source_url: https://code.claude.com/docs/en/headless
author: Anthropic（主篇，Headless/Agent SDK 文档）；Cline Docs、Cognition/Devin（Windsurf）Docs（生态部分）
license: 署名翻译（官方文档 Copyright Anthropic PBC；Cline/Cognition 部分为官方文档教学翻译，均署名）
fetched_at: 2026-09-13
translated: true
order: 16
---

> **来源**：本文主篇翻译自 [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)（Claude Code 官方文档，2026-09 当前版），作者 Anthropic，许可署名翻译（Copyright Anthropic PBC，教学用途）；"生态两翼"一节分别译自 [Cline Overview](https://docs.cline.bot/cline-overview) 及其文档站的 CLI 样例（Cline Bot Inc.）与 [Cascade / Devin Desktop 文档](https://docs.windsurf.com/windsurf/cascade)（Cognition）。抓取于 2026-09-13。

AI 编码工具链的"下半场"不在编辑器里，而在**没有人的地方**：CI 流水线、定时任务、issue 自动响应、PR 自动审查。本篇讲三件事：Claude Code 的 Headless/Agent SDK（`claude -p` 进脚本与 CI）、Cline 的 CLI/Kanban 生态、以及 Windsurf（并入 Devin Desktop）的现况。

## Headless：以编程方式运行 Claude Code

> 以下为官方文档译文。

[Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) 提供与 Claude Code 相同的工具、智能体循环与上下文管理，形态有二：面向脚本与 CI/CD 的 CLI，以及提供完整编程控制的 [Python](https://code.claude.com/docs/en/agent-sdk/python) 与 [TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript) 包。

以非交互模式运行 Claude Code，给 `claude` 传 `-p` 与你的提示词即可：

```bash
claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"
```

### 基本用法

任何 `claude` 命令加 `-p`（或 `--print`）即以非交互运行。Claude Code 成功时以退出码 0 退出、失败时非零，脚本可以据此分支。常与 `-p` 组合的选项：`--continue`（续聊）、`--allowedTools`（预批准工具）、`--output-format`（结构化输出）。

```bash
claude -p "What does the auth module do?"
```

### bare 模式：更快启动、跨机器一致

加 `--bare` 跳过 hooks、skills、自定义命令、子智能体、插件、MCP 服务器、auto memory 与 CLAUDE.md 的自动发现，显著缩短启动时间。**这对 CI 和脚本尤其重要**：你需要每台机器上结果一致——队友 `~/.claude` 里的 hook、项目 `.mcp.json` 里的服务器都不会被读取。官方注记：`--bare` 是脚本与 SDK 调用的推荐模式，未来将成为 `-p` 的默认值。

bare 模式不读 OAuth 凭据或系统钥匙串：Anthropic API 需在环境里设 `ANTHROPIC_API_KEY`（或经 `--settings` 提供 `apiKeyHelper`）。所有需要的上下文用旗标显式传入：`--append-system-prompt`（系统提示追加）、`--settings`（设置）、`--mcp-config`（MCP 服务器）、`--agents`（自定义智能体）。

### 管道与脚本：把 Claude 当命令行工具用

非交互模式读 stdin，因此可以像其他命令行工具一样管道进出：

```bash
# 把构建日志灌进去，把解释写到文件
cat build-error.txt | claude -p 'concisely explain the root cause of this build error' > output.txt
```

把 Claude 包装成项目专属的 linter/reviewer——下面这个 `package.json` 脚本把对 `main` 的 diff 管道给 Claude 让它报错别字（管道意味着 Claude 不需要 Bash 权限就能读到 diff）：

```json
{
  "scripts": {
    "lint:claude": "git diff main | claude -p \"you are a typo linter. for each typo in this diff, report filename:line on one line and the issue on the next. return nothing else.\""
  }
}
```

### 结构化输出与流式输出

`--output-format` 控制返回格式：`text`（默认纯文本）、`json`（含结果、会话 ID 与元数据的结构化 JSON）、`stream-json`（按行分隔的实时流式 JSON）。配 `--json-schema` 可拿到符合 JSON Schema 的结构化输出（落在 `structured_output` 字段）：

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'

# 用 jq 解析
claude -p "Summarize this project" --output-format json | jq -r '.result'
```

流式场景用 `--output-format stream-json --verbose --include-partial-messages`，每行一个 JSON 事件，最后一行是含最终文本、成本与会话元数据的 `result` 消息；配合 jq 可以实时打印增量 token。

### 无人值守运行的权限控制

- **`--allowedTools`**：预批准特定工具，如跑测试修错时允许 Bash/Read/Edit。
- **权限模式**：`--permission-mode auto`（分类器模型代审大多数动作）、`acceptEdits`（自动批准写文件与常见文件系统命令）、`dontAsk`（一切会弹窗的调用一律拒绝——适合锁死的 CI）。
- **`--permission-prompts none`**：没人应答权限提示的定时任务用。会弹窗的动作一律拒绝、告诉 Claude 无人可批且不要重试、运行继续；拒绝项出现在 `permission_denied` 系统消息与最终结果的 `permission_denials` 里。

```bash
claude -p "Update the dependency pins and run the tests" --permission-mode auto --permission-prompts none
```

### 实用样例

创建提交（注意权限规则语法的 ` *` 前缀匹配，`Bash(git diff *)` 允许任何 git diff 开头的命令）：

```bash
claude -p "Look at my staged changes and create an appropriate commit" \
  --allowedTools "Bash(git diff *),Bash(git log *),Bash(git status *),Bash(git commit *)"
```

自定义系统提示做安全审查（保存为 `review.sh`，`bash review.sh 123` 即审查 PR 123）：

```bash
gh pr diff "$1" | claude -p \
  --append-system-prompt "You are a security engineer. Review for vulnerabilities." \
  --output-format json
```

多轮续跑：`--continue` 接最近一次对话，`--resume "$session_id"` 接指定会话（可跨目录）：

```bash
# First request
claude -p "Review this codebase for performance issues"

# Continue the most recent conversation
claude -p "Now focus on the database queries" --continue
```

**进 GitHub Actions**：把以上任何形态放进 workflow——用官方 Claude Code GitHub Actions（可在 issue/PR 里 `@claude` 触发，支持经 Amazon Bedrock、Google Cloud 或 Microsoft Foundry 走非 Anthropic API），或直接在 workflow step 里跑 `claude -p`（环境变量给 API Key，加 `--bare` 保证环境一致）。配合第 10 篇的 MCP 与第 11 篇的 `/code-review --comment`，就能搭出"issue 认领 → 实现 → PR → 自动审查"的全自动链路。

## 生态两翼：Cline 与 Windsurf/Devin Desktop

### Cline：开源 BYOK 智能体的完整工具链

> 译自 Cline 官方文档。

Cline 是活在编辑器和终端里的开源 AI 编码智能体：读写文件、跑终端命令、用浏览器，**每个动作都需要你明确批准**。它的工具链覆盖四种形态：IDE 扩展、CLI、SDK 与 Kanban。模型接入走 BYOK（Bring Your Own Key）：Anthropic、OpenAI（含 Codex OAuth）、DeepSeek、Gemini、OpenRouter、Qwen、GLM 等 30+ 供应商，也支持本地模型（Ollama/LM Studio）与 Cline 自营计费。

- **CLI headless**：交互 TUI 与自动化两种模式，官方样例直接给出 GitHub Actions 集成——issue 评论 `@cline` 自动响应根因分析、PR 自动审查（`docs.cline.bot/cli/samples/github-integration`、`/github-pr-review`）；
- **Cline Kanban**：用**隔离 git worktree** 并行运行多个编码智能体的看板（创建任务 → 跑智能体 → 审查变更 → 合并），是多智能体并行的另一种产品化（对照第 13 篇）；
- **ACP**：Cline 可作为编码智能体接入 Zed、JetBrains、Neovim、Emacs 等任何支持 Agent Client Protocol 的客户端。

### Windsurf：并入 Devin Desktop 的 Cascade

> 译自 Cognition 官方文档。

2025 年 7 月 Cognition 收购 Windsurf 后，原 Windsurf 编辑器已演进为 **Devin Desktop**（docs.windsurf.com 现直接服务 Devin Desktop 文档）。其中的 **Cascade** 智能体：

- `Cmd/Ctrl+L` 唤起，编辑器选中文本自动附带进对话；
- **Code / Chat 双模式**：Code 模式可直接修改代码库，Chat 模式面向代码库提问（也可建议代码供你采纳插入）；
- **内置规划智能体**：后台专职规划智能体持续打磨长期计划，所选模型专注短期动作；复杂任务生成 Todo 列表跟踪进度，并随新信息（如 Memories 记忆）自动更新。

> 时效注记：2024 年及以前的"Windsurf 独立产品"类对比文章已过时——引用任何工具对比前，先确认该工具 2025-2026 的归属与形态变迁（本模块第 2 篇按 2026-09 现状对比）。

## 收束：工具链的收敛与你的选型

**表：Headless AI 编码的三条生态路线（2026-09）**

| 路线 | 代表 | 接入方式 | 适用 |
| --- | --- | --- | --- |
| 官方 CI 集成 | Claude Code GitHub Actions、Copilot coding agent | GitHub App / `@提及`触发 | issue 驱动、PR 审查 |
| CLI headless | `claude -p`、`cline` CLI、`codex exec` | workflow step 里跑命令 | 自定义流水线、批处理、定时任务 |
| 开源自托管 | Cline（Apache-2.0）、Codex CLI（Apache-2.0） | BYOK + 本地/私有模型 | 数据自持、成本控制 |

无论哪条路线，决定成败的都是同一组工程要素：**无人值守时的权限收敛**（allowlist/dontAsk/none）、**可验证的完成标准**（第 3、12 篇）、**产物走 PR 与审查**（第 7、11 篇）。工具会继续换名字——方法论不会。
