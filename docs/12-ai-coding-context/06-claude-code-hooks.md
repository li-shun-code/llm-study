---
title: "Claude Code Hooks：用确定性脚本守住智能体循环"
source_url: https://code.claude.com/docs/en/hooks-guide
author: Anthropic（Claude Code 官方文档 Automate actions with hooks 与 Hooks reference）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途翻译并署名；编者补充部分已标明）
fetched_at: 2026-09-19
translated: true
order: 6
group: 项目规范与技能包
---
《Claude Code 工作流与最佳实践》里反复出现一句话：**给 Claude 可验证的手段，但守住闸门**。问题是"闸门"如果靠模型自己记得去踩，它就只是建议。**Hooks 的作用是把闸门变成代码**：在智能体循环的固定时点自动执行你定义的 shell 命令、HTTP 请求、MCP 工具调用、甚至一次轻量 LLM 判断。官方对它的定位说得很准——"某些动作**一定会发生**，而不是依赖 LLM 决定要不要做"。

本篇是入门 + 可抄配方；完整事件 schema 与决策字段属于参考手册，末尾给出索引。相关机制参见《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》（常驻约定）与《Claude Skills：可复用技能包》（按需加载的指令）——三者合起来才是"让智能体守规矩"的完整工具箱。

## 一、一个最小可用 hook：桌面通知

*以下译自官方 [Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide) 的 "Set up your first hook"。*

创建 hook 就是往设置文件里加一个 `hooks` 块。下面这个例子在 **Claude 需要你输入时**发一条桌面通知，这样你就不必盯着终端。编辑 `~/.claude/settings.json`（不存在就新建）：

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

三步验证它真的生效（官方流程，别省）：

1. **看配置**：会话里输入 `/hooks` 打开 hook 浏览器，每个已配置的事件旁会显示计数；选中 `Notification` 能看到事件、matcher、类型、来源文件与命令。注意 **`/hooks` 菜单是只读的**，增删改都要回去编辑 JSON 或直接让 Claude 改。
2. **测触发**：按 `Shift+Tab` 切到 `⏸ manual mode on`，让 Claude 做一件需要授权的事，然后切走窗口——应当收到通知。
3. **确认结构**：如果设置文件里已经有 `hooks` 键，把 `Notification` 作为**已有事件键的兄弟节点**加进去，**不要替换整个 `hooks` 对象**。事件名是那个唯一 `hooks` 对象里的键：

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }
        ]
      }
    ],
    "Notification": [
      { "matcher": "", "hooks": [{ "type": "command", "command": "osascript -e '...'" }] }
    ]
  }
}
```

## 二、事件到底有哪些：三种节奏

*表格译自官方 [Hooks reference](https://code.claude.com/docs/en/hooks) 的 Hook lifecycle 一节（2026-09 当前版共 30+ 个事件）。*

事件按频率分三档：**每会话一次**（`SessionStart`、`SessionEnd`）、**每轮一次**（`UserPromptSubmit`、`Stop`、`StopFailure`）、**智能体循环里每次工具调用**（`PreToolUse`、`PostToolUse`；`EndConversation` 调用除外，它两者都不触发）。最常用的这些：

| 事件 | 何时触发 | 典型用途 |
| --- | --- | --- |
| `SessionStart` | 会话开始或恢复。matcher 可取 `compact` 等来源 | 注入上下文、恢复环境变量 |
| `UserPromptSubmit` | 你提交提示、Claude 处理**之前** | 追加约束、校验/改写提示 |
| `PreToolUse` | 工具调用执行**之前**，可以拦下它 | 挡住危险命令、保护文件 |
| `PermissionRequest` | 某次工具调用需要一个权限决定时 | 把权限决策接到自己的审批系统 |
| `PermissionDenied` | auto 模式拒绝了某次工具调用时 | 用 JSON `hookSpecificOutput.retry: true` 告诉模型可以重试 |
| `PostToolUse` | 工具调用**成功之后** | 格式化、跑校验、记录审计 |
| `PostToolUseFailure` | 工具调用失败之后 | 失败诊断、告警 |
| `PostToolBatch` | 一批并行工具调用全部结束、下一次模型调用之前 | 批量后处理 |
| `SubagentStart` / `SubagentStop` | 子智能体派生 / 结束 | 统计与预算控制 |
| `Stop` / `StopFailure` | Claude 回答完毕 / 本轮因 API 错误结束 | 完成校验、质量闸门 |
| `Notification` | Claude Code 发送通知时 | 桌面/IM 提醒 |
| `PreCompact` / `PostCompact` | 上下文压缩前后 | 压缩前存档、压缩后重注入 |
| `FileChanged` | 被监视的文件在磁盘上变化 | 外部编辑联动 |
| `CwdChanged` / `DirectoryAdded` | 工作目录改变 / 中途 `--add-dir` 加目录 | 配合 direnv 之类的环境管理 |
| `InstructionsLoaded` | `CLAUDE.md` 或 `.claude/rules/*.md` 被载入上下文 | 检查规范是否真被读到 |
| `ConfigChange` | 会话期间配置文件变化 | 配置审计 |
| `WorktreeCreate` / `WorktreeRemove` | 创建/移除 worktree | 接管隔离工作区生命周期 |
| `PreModelSwitch` / `PostModelSwitch` | 应用模型切换之前 / 模型变化之后 | 拦截切到某个模型 |
| `SessionEnd` | 会话终止 | 收尾清理 |
| `Setup` | 用 `--init-only`，或 `-p` 模式下 `--init`/`--maintenance` 启动时 | CI 里的一次性准备 |

处理器类型除常见的 `"type": "command"` 外还有 `"http"`（把事件数据 POST 到 URL）、`"mcp_tool"`（调已连接 MCP 服务器上的工具）、`"prompt"`（单轮 LLM 判断）、`"agent"`（带工具的多轮校验，官方标注**实验性、可能变动**）。

## 三、四个能直接抄走的配方

*以下配方译自官方文档，路径与命令按 2026-09 版本核对；示例里的 Bash 脚本用 `jq` 解析 JSON，需要先 `brew install jq`（macOS）或 `apt-get install jq`（Debian/Ubuntu）。*

### 1）编辑后自动格式化（`PostToolUse`）

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write" }
        ]
      }
    ]
  }
}
```

放进项目根的 `.claude/settings.json`。测试方法：让 Claude 在一个 JS 文件里写几行单引号字符串，然后打开文件——默认配置下 Prettier 会把它们改成双引号。**hook 成功时对话里什么都不显示**，所以"没提示"不等于"没跑"。想连 `Bash` 命令改写的文件一起重排，改用 `FileChanged` 事件。

### 2）保护敏感文件（`PreToolUse` + 退出码 2）

脚本 `.claude/hooks/protect-files.sh`：

```bash
#!/bin/bash
# 被保护的文件模式：命中就拦下这次编辑
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# 规范化 Windows 反斜杠，让下面的模式在两边都能匹配
FILE_PATH="${FILE_PATH//\\//}"

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
```

然后 `chmod +x .claude/hooks/protect-files.sh`（**官方明确：hook 脚本必须可执行，否则 Claude Code 跑不了它**），再注册：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh" }
        ]
      }
    ]
  }
}
```

测试：让 Claude 往 `.env` 里加一行注释——编辑会在执行前被拦下，脚本写到 stderr 的那句 `Blocked: ...` 会作为反馈交给 Claude，它会据此调整做法。**这就是"退出码 2 = 阻塞并把 stderr 当反馈"这一最核心的通信方式。**

### 3）压缩后把关键约定重新塞回去（`SessionStart` + `compact`）

上下文塞满时压缩会把细节摘要掉。用 `compact` matcher 让每次压缩之后都重注入一遍：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          { "type": "command", "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing. Current sprint: auth refactor.'" }
        ]
      }
    ]
  }
}
```

命令写到 **stdout 的纯文本会被加进 Claude 的上下文**。把 `echo` 换成任何动态输出都行，例如 `git log --oneline -5`。**如果是每次会话都要注入的静态内容，用 `CLAUDE.md` 更合适；要注入环境变量，用参考页里的 `CLAUDE_ENV_FILE`。**

### 4）按目录推荐该用的插件（`SessionStart`）

这条来自官方《Set up Claude Code in a monorepo or large codebase》：当团队规范已经收敛成插件、但同事在陌生的子目录里启动会话时，根本不知道该装哪个插件。写一个 `SessionStart` hook：从 hook 输入里读启动目录，查一张**提交进仓库的"路径 → 插件"映射表**，把推荐打印到 stdout，Claude 会在首轮回答里转述。

## 四、多条 hook 同时命中会怎样

*这一节是官方 "Combine results from multiple hooks" 与 "Limitations" 两节的要点。*

- 同一个事件被多条 hook 命中时，**它们并行执行，且每条都会跑完**——某条返回 `deny` **不会**阻止兄弟 hook 产生副作用。所以**不要指望用一条 hook 的 deny 去抑制另一条的副作用**。
- 全部跑完后再合并结果：`PreToolUse` 的权限决策取**最严格**的那个，严格程度顺序为 `deny` > `defer` > `ask` > `allow`；各条 `additionalContext` 的文本都会保留并一起交给 Claude。
- **例外**：多条 `PreToolUse` 都返回 `updatedInput` 去改写工具入参时，**最后完成的那个生效**，而 hook 是并行跑的——顺序不可确定。**不要让两条 hook 改同一个工具的输入。**

**超时默认值**：`command`/`http`/`mcp_tool` 为 10 分钟，但 `UserPromptSubmit`、`PreModelSwitch`、`PostModelSwitch` 被降到 30 秒，`MessageDisplay` 只有 10 秒；`prompt` 30 秒；`agent` 60 秒；`SessionEnd` 所有类型**共享 1.5 秒**预算（设置里写了更长值会跟着抬，最多 60 秒）。用每条 hook 的 `timeout` 字段（单位秒）覆盖。

## 五、hooks 与权限模式：能收紧，不能放松

*译自官方 "Hooks and permission modes"，这是整篇最该记住的一条安全性质。*

`PreToolUse` **在任何权限模式检查之前**触发，在**每一种**权限模式下都会跑，包括 `dontAsk`。因此：

- 一条返回 `permissionDecision: "deny"` 的 hook，**即使在 `bypassPermissions` 模式或加了 `--dangerously-skip-permissions` 时也能拦住工具**。这就是"用户可以改模式但绕不过策略"的实现方式。
- 反过来不成立：hook 返回 `"allow"` **不能**越过设置里的 deny 规则，也不能为标了 `requiresUserInteraction` 的 MCP 工具、或组织设为 `ask` 的连接器工具跳过提示。**hook 只能收紧，不能松到权限规则允许范围之外。**

## 六、排障：hook 配了却没跑、跑了却没效果

*以下译自官方 "Limitations and troubleshooting" 各小节，这一节的价值在于它解释了三种"静默失败"。*

**hook 不触发**：`/hooks` 里确认事件与条目；**matcher 区分大小写且必须精确匹配工具名**；确认事件选对了（`PreToolUse` 在前、`PostToolUse` 在后）。

**`PostToolUse` 改不回已经做过的事**：它在工具执行**之后**才跑，撤消防问只能靠 `PreToolUse`。

**`Stop` hook 不是"任务完成"hook**：Claude **每次**回答完都会触发，不是只在任务结束；用户打断不触发；API 错误走 `StopFailure`。想把它当质量闸门用，就要在脚本里自己判断"是否真的做完了"。

**`/hooks` 里看不到刚写的 hook**：文件编辑通常会自动被读取，几秒没出现就是文件监视器漏了，**重启会话**强制重载；同时确认 JSON 合法——**不允许尾随逗号，也不允许注释**。

**脚本报错**：用样例 JSON 手测它——

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
echo $?   # 看退出码
```

`command not found` 就用绝对路径或 `${CLAUDE_PROJECT_DIR}`；想彻底绕开 shell 引号问题，给处理器加 `"args": []` 切到 **exec 形态**（不经 shell 直接 spawn 脚本）。`jq: command not found` 就装 jq 或改用 Python/Node 解析。脚本完全没跑，八成是忘了 `chmod +x`。

**"我的 hook 返回了合法 JSON，却什么都没发生，也没有报错"**——两种典型原因：

1. **JSON 前面混进了别的内容**。shell 形态的 hook 在 macOS/Linux 上是 `sh -c`（Windows 用 Git Bash，没有则 PowerShell）。这个 shell 虽非交互，但在某些配置下（比如 `BASH_ENV` 指向 `~/.bashrc`）仍会 source 你的 profile；profile 里一条**无条件的 `echo`** 就会把输出变成：

```text
Shell ready on arm64
{"decision": "block", "reason": "Not allowed"}
```

输出不以 `{` 开头，于是整段 stdout 被当纯文本、JSON 被忽略，退出码 0 时**转录里毫无提示**（只在调试日志里留一条解析记录）。修法是把 profile 里的 echo 包成只在交互 shell 下执行：

```bash
# 放进 ~/.zshrc 或 ~/.bashrc
if [[ $- == *i* ]]; then
  echo "Shell ready"
fi
```

2. **字段放错层**。`permissionDecision`、`additionalContext` 必须在 **`hookSpecificOutput` 里面**，放在顶层时 JSON 照样能解析，Claude Code **只是忽略这些字段且不报错**。查法：用 `claude --debug` 启动，在调试日志里搜 `Hook JSON output had unrecognized keys`。

**看执行细节**：`Ctrl+O` 打开转录视图（成功时通常什么都不显示；阻塞错误会显示 hook 的反馈或它的原因；非阻塞错误显示 `<hook 名> hook error` 加 stderr 首行）。要完整细节（哪些 hook 命中、退出码、stdout/stderr）就用 `claude --debug-file /tmp/claude.log` 启动，另一个终端 `tail -f /tmp/claude.log`；已经启动了就在会话里 `/debug` 打开并查看日志路径。

## 七、跨工具一句：Codex 与 Cursor 也有 hooks

同一套思路已经成了行业标准。`openai/codex` 仓库的协议 schema 里 `HookEventName` 取值为 `preToolUse`、`permissionRequest`、`postToolUse`、`preCompact`、`postCompact`、`sessionStart`、`sessionEnd`、`userPromptSubmit`、`subagentStart`、`subagentStop`、`stop`、`interrupt`——**与 Claude Code 的事件集合几乎一一对应**，只是驼峰命名；其 `ConfiguredHookHandler` 同样支持 `command`/`mcp_tool`/`prompt`/`agent` 四类处理器，并带 `async`、`timeoutSec`、`additionalContextLimit`（约 2500 token 阈值把 `additionalContext` 溢写到磁盘）。Cursor 的 hooks 写在 `hooks.json`（项目级或用户级，也能由插件安装），官方描述同样是"以 stdio 传 JSON 的子进程，在智能体循环各阶段前后观察、阻塞或修改行为"，用途列表——编辑后跑格式化、扫 PII 与密钥、拦住高危操作、控制子智能体执行、会话开始时注入上下文——与本篇配方基本重合，还支持加载来自 Claude Code 的**第三方 hooks**。差别在治理：Codex 的管理员可以在 `requirements.toml` 里设 `allow_managed_hooks_only = true`，只承认托管来源的 hook。**换句话说：hook 写一次大概率能跨工具用，但"谁能强制启用哪些 hook"每家的答案不一样。**

## 八、什么时候不该用 hook

官方文档在多处给出了边界，收在这里：

- **需要判断而非规则的决定**，用 `prompt`/`agent` 型 hook（或干脆写进 `CLAUDE.md`），别用正则硬凑。
- **command 型 hook 只能靠 stdout/stderr/退出码通信**，不能触发 `/` 命令，也不能发起工具调用；`additionalContext` 只是被当纯文本读入的系统提醒。
- **每次工具调用都跑的重活要慎用**——它在智能体循环的关键路径上，会把延迟叠在你每一次编辑操作上。
- 想要"给 Claude 更多指令和可执行命令"，那是技能的活；想"在隔离上下文里跑子任务"，那是子智能体的活；想"把技能+hook+命令打包分发"，那是插件的活。

## 延伸阅读

- 《Claude Code 权限系统与安全机制》：hooks 的 deny 为什么能压过权限模式。
- 《Claude Code 工作流与最佳实践》：什么该交给模型判断、什么该交给脚本。
- 《开源编码 Skills（一）：Superpowers 编码流程族》：把"完成前先验证"这类纪律做成 hook 闸门的做法。
- 《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》：`Setup` 事件与 `-p` 模式下的权限差异。
- 《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》：另一家的 hook 事件与托管策略。

---

> **来源**：本文译自 Claude Code 官方文档（Copyright Anthropic PBC，教学用途署名翻译）：[Automate actions with hooks](https://code.claude.com/docs/en/hooks-guide)（首个 hook 走查、四个配方、机制说明、局限与排障）与 [Hooks reference](https://code.claude.com/docs/en/hooks)（事件表、生命周期、超时与限制）；第六节第 4 条配方取自 [Set up Claude Code in a monorepo or large codebase](https://code.claude.com/docs/en/large-codebases)；第七节的 Codex 部分取自 [openai/codex](https://github.com/openai/codex)（Apache-2.0）中 `codex-rs/app-server-protocol/schema/typescript/v2/` 的 `HookEventName`、`ConfiguredHookHandler` 与 `docs/config.md`，Cursor 部分取自 [Cursor Hooks](https://cursor.com/docs/hooks)（Anysphere 官方文档）。小节归纳、"什么时候不该用 hook"与延伸阅读为本站编者补充并已标明。抓取于 2026-09-19。
