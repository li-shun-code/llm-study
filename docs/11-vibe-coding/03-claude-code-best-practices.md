---
title: Claude Code 工作流与最佳实践
source_url: https://code.claude.com/docs/en/best-practices
author: Anthropic（Claude Code 官方文档）
license: 署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途全文翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 3
---

> **来源**：本文翻译自 [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)，作者 Anthropic（Claude Code 官方文档），许可署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途全文翻译并署名）。抓取于 2026-09-13。

Claude Code 是一个智能体化的编码环境（Agentic Coding Environment）。与"回答问题然后等待"的聊天机器人不同，Claude Code 可以读取你的文件、运行命令、修改代码，并在你旁观、随时纠偏、甚至完全离开的情况下自主解决问题。这改变了你的工作方式：你不再亲自写代码再让 Claude 审查，而是描述你想要什么，由 Claude 弄清楚怎么构建。Claude 会探索、规划、实现。但这种自主性仍伴随一条学习曲线——Claude 在某些约束条件下工作，你需要理解它们。本指南汇总了在 Anthropic 内部团队以及各类代码库、语言、环境中被反复验证有效的实践模式。关于智能体循环（Agentic Loop）的底层机制，参见官方文档《How Claude Code works》。

> 本指南官网原文（www.anthropic.com/engineering/claude-code-best-practices）现已重定向至 code.claude.com 文档站的本页面，本文以 2026-09 的最新文档版本为准。

大多数最佳实践都建立在同一个约束之上：**Claude 的上下文窗口（Context Window）消耗得很快，而且性能会随占用上升而下降**。上下文窗口容纳你的整个对话——每条消息、Claude 读过的每个文件、每段命令输出。一次调试会话或代码库探索就可能消耗数万 token。这一点至关重要，因为 LLM 的表现会随上下文变满而退化：当窗口接近上限时，Claude 可能开始"遗忘"早期指令，或犯更多错误。上下文窗口是需要管理的最重要资源。你可以用自定义状态行（statusline）持续追踪上下文用量，并参考官方文档中的"Reduce token usage"策略来降低 token 消耗。

## 给 Claude 一种验证自身工作的手段

给 Claude 一个它能运行的检查：测试、构建、用于对比的截图。这是"你在旁边盯着"和"你可以走开"的区别。

当工作"看起来完成了"，Claude 就会停下。如果没有任何可运行的检查，"看起来完成"就是唯一信号，而你自己就成了验证回路：每个错误都在等你去发现。给 Claude 一个能产出通过/失败结果的手段，回路就自动闭合了——Claude 完成工作、运行检查、读取结果、迭代直到检查通过。这个检查可以是任何能在对话中返回可读信号的东西：测试套件、构建退出码、linter、将输出与固定样例（fixture）做 diff 的脚本，或与设计稿比对的浏览器截图。在 Claude 的检查通过后，你可以亲自运行 `/verify` 再对照运行中的应用确认一次。

**表：提示词策略——修改前后对比**

| 策略 | 修改前 | 修改后 |
| --- | --- | --- |
| 提供验证标准 | "实现一个校验邮箱地址的函数" | "写一个 validateEmail 函数。测试用例：user@example.com 为 true，invalid 为 false，user@.com 为 false。实现后运行测试" |
| 用视觉方式验证 UI 改动 | "把仪表盘弄好看点" | "[粘贴截图] 按这个设计实现。对结果截图并与原图对比。列出差异并修复" |
| 解决根因而非症状 | "构建挂了" | "构建报这个错：[粘贴错误]。修复并验证构建成功。解决根因，不要压制错误" |

检查手段就位后，再决定它以多强的力度拦截"停止"：

- **在单条提示内**：在同一条消息里要求 Claude 运行检查并迭代（如上表）。
- **跨越整个会话**：把检查设为 `/goal` 条件。一个独立的评估器在每轮结束后重新检查，Claude 会持续工作直到目标达成。若 Claude 停滞不前，Claude Code 最终会带着未完成的目标停止运行。
- **作为确定性闸门**：一个 Stop hook（停止钩子）以脚本形式运行你的检查，未通过就不允许本轮结束。连续被拦截 8 次后，Claude Code 会越过钩子强制结束本轮。
- **借助第二意见**：一个验证型子智能体（subagent）或动态工作流会派一个"全新的模型"去试图反驳结果——做工作的智能体不再给自己打分。

每一步都在用配置成本换注意力。提示词版本今天就能用于任何任务；`/goal` 和 Stop hook 版本则能让无人值守的运行在没有你的情况下正确收尾。要让 Claude 出示证据而不是口头宣称成功：测试输出、它跑过的命令及返回值、或结果截图。审证据比自己重跑验证更快，而且对那些你没盯着的会话同样有效。

## 先探索、再计划、后编码

把研究与规划和实现分开，避免解错问题。

让 Claude 直接上手写码，可能产出"解决了错误问题"的代码。请使用计划模式（Plan Mode）把探索与执行分开。推荐的工作流分四个阶段：

**表：探索—计划—实现—提交 四阶段**

| 阶段 | 做法 |
| --- | --- |
| 1. 探索（Explore） | 按 `Shift+Tab` 直到状态栏显示 `⏸ plan mode on` 进入计划模式，或以 `claude --permission-mode plan` 启动会话。Claude 只读文件、回答问题，不做修改。 |
| 2. 计划（Plan） | 让 Claude 制定详细的实现计划。按 `Ctrl+G` 可在文本编辑器中直接编辑计划，然后再让 Claude 继续。 |
| 3. 实现（Implement） | 批准计划或再按 `Shift+Tab` 退出计划模式，让 Claude 对照计划写码。 |
| 4. 提交（Commit） | 让 Claude 用描述性的提交信息提交并创建 PR。 |

各阶段的示例提示词：

```text
# 阶段 1（计划模式）
read /src/auth and understand how we handle sessions and login.
also look at how we manage environment variables for secrets.

# 阶段 2（计划模式）
I want to add Google OAuth. What files need to change?
What's the session flow? Create a plan.

# 阶段 3
implement the OAuth flow from your plan. write tests for the
callback handler, run the test suite and fix any failures.

# 阶段 4
commit with a descriptive message and open a PR
```

计划模式有用，但也会带来开销。对范围明确的小修复（改错别字、加一行日志、重命名变量），直接让 Claude 做即可。**当你不确定技术方案、改动会波及多个文件、或你对要改的代码不熟悉时，规划最有价值。**如果你能用一句话描述这个 diff，那就跳过计划。

## 在提示词里提供具体的上下文

指令越精确，需要返工的次数越少。

Claude 能推断意图，但不能读心。请引用具体文件、说明约束、指向示例模式。

**表：提示词具体化策略**

| 策略 | 修改前 | 修改后 |
| --- | --- | --- |
| 限定任务范围：指明文件、场景、测试偏好 | "给 foo.py 加测试" | "给 foo.py 写一个测试，覆盖用户已登出的边界情况。不要用 mock" |
| 指向信息源：让 Claude 去能回答问题的地方找答案 | "为什么 ExecutionFactory 的 API 这么奇怪？" | "翻一下 ExecutionFactory 的 git 历史，总结一下它的 API 是怎么演化成现在这样的" |
| 参照既有模式：指向代码库中已有的范式 | "加一个日历组件" | "看看首页现有组件是怎么实现的以理解模式，HotDogWidget.php 是个好例子。照这个模式实现一个新日历组件，支持选择月份、前后翻页选年份。只用代码库已有的依赖，从零实现" |
| 描述症状：给出症状、可能位置和"修好了"的判据 | "修一下登录 bug" | "用户反馈会话超时后登录失败。检查 src/auth/ 的认证流程，尤其是 token 刷新。先写一个能复现问题的失败测试，再修复" |

模糊的提示词在探索阶段也有用武之地——当你付得起"再纠正一轮"的成本时。像"你觉得这个文件有什么可以改进的？"这样的提示，能暴露出你没想到要问的问题。

### 提供富内容

用 `@` 引用文件、直接粘贴截图/图片，或用管道直接灌入数据：

- **用 `@` 引用文件**，而不是描述代码在哪里。Claude 会在回答前读取该文件。
- **直接粘贴图片**。把图片复制/拖放进提示词即可。
- **给出文档与 API 参考的 URL**。用 `/permissions` 把常用域名加白。
- **用管道灌数据**：运行 `cat error.log | claude` 直接发送文件内容。
- **让 Claude 自取所需**：告诉 Claude 用 Bash 命令、MCP 工具或读文件自行拉取上下文。

## 配置你的环境

几步环境配置，能让你所有会话的效率显著提升。

### 写一份高效的 CLAUDE.md

运行 `/init` 可基于当前项目结构生成一份 CLAUDE.md 起步文件，之后逐步打磨。

CLAUDE.md 是 Claude 在每次对话开始时都会读取的特殊文件。把 Bash 命令、代码风格、工作流规则写进去，为 Claude 提供它无法从代码本身推断的持久上下文。CLAUDE.md 没有规定格式，但请保持简短、人类可读。例如：

```markdown
# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

# Workflow
- Be sure to typecheck when you're done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
```

运行 `/context` 可以确认 Claude 已加载该文件。CLAUDE.md 每个会话都会加载，所以只放普遍适用的内容；只在特定场景相关的领域知识或工作流请改用 Skills——它们按需加载，不会撑大每一次对话。保持精简：对每一行自问"删掉这行会导致 Claude 犯错吗？"不会就删。臃肿的 CLAUDE.md 会让 Claude 忽略你真正的指令！

**表：CLAUDE.md 该写与不该写**

| 应该写 | 不该写 |
| --- | --- |
| Claude 猜不到的 Bash 命令 | Claude 读代码就能搞清楚的内容 |
| 与默认不同的代码风格规则 | Claude 已知的标准语言惯例 |
| 测试指令与首选测试运行器 | 详细的 API 文档（改为给链接） |
| 仓库礼仪（分支命名、PR 约定） | 经常变动的信息 |
| 项目特有的架构决策 | 长篇解释或教程 |
| 开发环境怪癖（必需的环境变量） | 逐文件的代码库说明 |
| 常见坑与不显然的行为 | "写干净代码"之类不言自明的空话 |

如果 Claude 反复做你明令禁止的事，多半是文件太长、规则被淹没了。如果 Claude 问的问题 CLAUDE.md 里有答案，可能是措辞有歧义。像对待代码一样对待 CLAUDE.md：出问题时回头审、定期修剪、通过观察 Claude 行为是否真的改变来测试每次修改。对已入库的 CLAUDE.md，运行 `/doctor`，Claude 会为它能从代码库自行推导的内容提出裁剪建议。如果 Claude 总是跳过某条指令，只给那一行加强调（如 "IMPORTANT"）；强调太多行等于没有强调。把 CLAUDE.md 提交进 git 让团队共同维护，它的价值会随时间复利增长。CLAUDE.md 还能用 `@path/to/import` 语法导入其他文件。

### 配置权限

想要更少的确认弹窗又不想失控，可以用 `/permissions` 预批准你信任的工具，用 `/sandbox` 让沙箱化命令免确认运行。想亲自批准每次修改和命令时切到 Manual 模式。

在 Pro、Max、Team 套餐上，auto mode 是交互式终端与 VS Code 会话的默认权限模式：一个独立的分类器模型替你审查大多数操作，只拦截看起来有风险的动作，比如权限范围扩大、未知基础设施、或由恶意内容驱动的行为。Manual 模式（其他套餐的默认模式）下，Claude Code 在可能修改系统的动作前会先询问：写文件、Bash 命令、MCP 工具。这很安全但很繁琐——到第十次批准时你已经是在无脑点击而不是在审查了。两个工具可以削减 Manual 模式下的打断（auto 模式下同样适用）：

- **权限白名单**：允许你确认安全的特定工具，如 `npm run lint` 或 `git commit`。
- **沙箱化**：启用操作系统级隔离，限制文件系统与网络访问，让 Claude 在划定边界内更自由地工作。

### 用好 CLI 工具

让 Claude Code 在与外部服务交互时优先使用 `gh`、`aws`、`gcloud`、`sentry-cli` 这类 CLI 工具。

CLI 是与外部服务交互时上下文效率最高的方式。如果你用 GitHub，装上 `gh` CLI——Claude 知道怎么用它建 issue、开 PR、读评论。没有 `gh` 时 Claude 也能走 GitHub API，但未认证请求常常撞限流。Claude 也很擅长自学没见过的 CLI，试试这样的提示：`Use 'foo-cli-tool --help' to learn about foo tool, then use it to solve A, B, C.`

### 连接 MCP 服务器

运行 `claude mcp add` 加上服务器名称和 URL 或命令，即可连接 Notion、Figma 或你的数据库等外部工具。例如：`claude mcp add --transport http notion https://mcp.notion.com/mcp`。

借助 MCP 服务器，你可以让 Claude 从 issue 跟踪器里取需求实现功能、查询数据库、分析监控数据、整合 Figma 设计稿、自动化工作流。

### 设置 hooks

对"必须每次发生、零例外"的动作使用 hooks。

Hooks 在 Claude 工作流的特定节点自动运行脚本。CLAUDE.md 里的指令是建议性的，hooks 则是确定性的，能保证动作必然发生。hooks 可以让 Claude 替你写，试试这样的提示："Write a hook that runs eslint after every file edit" 或 "Write a hook that blocks writes to the migrations folder."。也可以直接编辑 `.claude/settings.json` 手工配置，用 `/hooks` 查看已配置的钩子。

### 创建 skills

在 `.claude/skills/` 下创建 `SKILL.md` 文件，赋予 Claude 领域知识和可复用工作流。

Skills 用项目、团队或领域特定的信息扩展 Claude 的知识。Claude 会在相关时自动应用，你也可以用 `/skill-name` 直接调用。创建方法是在 `.claude/skills/` 下添加一个含 `SKILL.md` 的目录：

```markdown
# .claude/skills/api-conventions/SKILL.md
---
name: api-conventions
description: REST API design conventions for our services
---
# API Conventions
- Use kebab-case for URL paths
- Use camelCase for JSON properties
- Always include pagination for list endpoints
- Version APIs in the URL path (/v1/, /v2/)
```

Skills 也可以定义你直接调用的可重复工作流：

```markdown
# .claude/skills/fix-issue/SKILL.md
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---
Analyze and fix the GitHub issue: $ARGUMENTS.

1. Use `gh issue view` to get the issue details
2. Understand the problem described in the issue
3. Search the codebase for relevant files
4. Implement the necessary changes to fix the issue
5. Write and run tests to verify the fix
6. Ensure code passes linting and type checking
7. Create a descriptive commit message
8. Push and create a PR
```

运行 `/fix-issue 1234` 即可调用。对有副作用、只想手动触发的工作流，使用 `disable-model-invocation: true`。

### 创建自定义子智能体

在 `.claude/agents/` 下定义专职助手，让 Claude 能把隔离的任务委托出去。

子智能体（subagents）在自己的上下文、自己的工具白名单里运行。适合要读大量文件、或需要专门聚焦而又不想弄乱主对话的任务：

```markdown
# .claude/agents/security-reviewer.md
---
name: security-reviewer
description: Reviews code for security vulnerabilities
tools: Read, Grep, Glob, Bash
model: opus
---
You are a senior security engineer. Review code for:
- Injection vulnerabilities (SQL, XSS, command injection)
- Authentication and authorization flaws
- Secrets or credentials in code
- Insecure data handling

Provide specific line references and suggested fixes.
```

明确地告诉 Claude 使用子智能体："Use a subagent to review this code for security issues."

### 安装插件

运行 `/plugin` 浏览插件市场。插件无需配置即可添加 skills、工具与集成。

插件（Plugins）把 skills、hooks、子智能体和 MCP 服务器打包成单一可安装单元，来自社区与 Anthropic。如果你用强类型语言，装一个代码智能（code intelligence）插件，Claude 就能精确导航符号并在编辑后自动检测错误。

## 高效沟通

像问另一位工程师那样向 Claude 提问；做较大的功能时，先让 Claude"采访"你并写出规格说明，再动手实现。

### 向代码库提问

在熟悉新代码库时，把 Claude Code 当学习与探索工具。你可以问那些平时会问资深同事的问题：

- 日志是怎么工作的？
- 怎么新增一个 API 端点？
- `foo.rs` 第 134 行的 `async move { ... }` 是什么意思？
- `CustomerOnboardingFlowImpl` 处理了哪些边界情况？
- 为什么第 333 行调用的是 `foo()` 而不是 `bar()`？

这种用法是非常有效的入职（onboarding）工作流，既能缩短上手时间，也能减轻其他工程师的负担。不需要任何特殊提示，直接问就行。

### 让 Claude 采访你

做较大的功能时，先让 Claude 采访你。从一个最小说明开始，让 Claude 用 `AskUserQuestion` 工具向你提问。Claude 会问到你可能还没考虑过的事情：技术实现、UI/UX、边界情况、权衡取舍。

```text
I want to build [brief description]. Interview me in detail using the AskUserQuestion tool.

Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. Don't ask obvious questions, dig into the hard parts I might not have considered.

Keep interviewing until we've covered everything, then write a complete spec to SPEC.md.
```

规格说明（spec）完成后，开一个全新会话去执行它：新会话拥有聚焦于实现的干净上下文，而你手里有一份书面规格可对照。最有用的规格是自成一体的：点名涉及的文件与接口、声明范围外的事项、并以一个端到端验证步骤收尾来证明功能可用。花在把规格磨精确上的时间，比花在盯实现上的时间回报更高。

## 管理你的会话

对话是持久的、可回退的。善用这一点！

### 尽早、频繁地纠偏

一旦发现 Claude 跑偏，立刻纠正。最好的结果来自紧凑的反馈回路。虽然 Claude 偶尔能一次做对，但快速纠正通常能更快得到更好的方案：

- **`Esc`**：在动作中途叫停 Claude。上下文保留，可以重新指挥。
- **`Esc + Esc` 或 `/rewind`**：打开回退菜单，恢复到之前的对话或代码状态，或从选定消息做摘要。
- **"Undo that"**：让 Claude 撤销它刚做的修改。
- **`/clear`**：在不相关的任务之间重置上下文。塞满无关信息的长会话会降低性能。

如果在同一个问题上你已纠正 Claude 超过两次，说明上下文已被失败尝试塞满。运行 `/clear`，带着你学到的教训用一条更具体的提示重开。带着更好提示的干净会话，几乎总是胜过堆满纠偏的长会话。

### 主动管理上下文

在不相关的任务之间运行 `/clear` 重置上下文。Claude Code 会在接近上下文上限时自动压缩（compact）历史——保留重要的代码与决策，释放空间。长会话中上下文可能被无关对话、文件内容、命令填满，这会降低性能，有时还会让 Claude 分心：

- 任务之间勤用 `/clear` 彻底重置上下文窗口
- 自动压缩触发时，Claude 会总结最重要的内容：代码模式、文件状态、关键决策
- 想要更多控制就运行 `/compact <instructions>`，如 `/compact Focus on the API changes`
- 只压缩部分对话：用 `Esc + Esc` 或 `/rewind` 选定一个消息检查点，选择"从此处摘要"或"摘要到此为止"
- 在 CLAUDE.md 里定制压缩行为，比如"When compacting, always preserve the full list of modified files and any test commands"，确保关键上下文在摘要后幸存
- 对不需要留在上下文里的提问，用 `/btw`：答案不会进入对话历史，查个细节也不会撑大上下文

### 用子智能体做调研

用 "use subagents to investigate X" 把调研委托出去。它们在独立上下文里探索，让主对话保持干净、留给实现。

既然上下文是根本性约束，就让调研远离主上下文。Claude 调研代码库时要读大量文件，而这些都会消耗你的上下文。子智能体在独立的上下文窗口里运行，只汇报摘要：

```text
Use subagents to investigate how our authentication system handles token
refresh, and whether we have any existing OAuth utilities I should reuse.
```

Claude 实现完之后，也可以用子智能体做验证，见下文"增加对抗式审查步骤"。

### 用检查点回退

你发出的每条开启新一轮的提示都会创建一个检查点（checkpoint）。你可以把对话、代码或二者恢复到任意历史检查点。Claude 会在每次修改前自动给文件拍快照，检查点因此能恢复它们。双击 `Escape` 或运行 `/rewind` 打开回退菜单：只恢复对话、只恢复代码、二者都恢复，或从选定消息开始摘要。你不必步步谨慎，可以让 Claude 大胆尝试；不行就回退换个路子。检查点随对话保存，关掉终端、之后恢复会话，依然可以回退。

注意：检查点只跟踪经 Claude 文件编辑工具做出的修改。经 Bash 命令或外部进程的改动不会被捕获。**它不是 git 的替代品。**

### 恢复对话

用 `/rename` 给会话命名，把它们当作分支对待：每条工作流一个持久上下文。Claude Code 把对话保存在本地，任务跨多次进行时无需重复解释背景。运行 `claude --continue` 从上次中断处继续，或 `claude --resume` 从列表中选择。给会话起描述性名字（如 `oauth-migration`）方便日后查找。

## 自动化与规模化

当你和单个 Claude 配合高效后，用并行会话、非交互模式和扇出（fan-out）模式放大产出。

### 运行非交互模式

在 CI、pre-commit 钩子或脚本里用 `claude -p "prompt"`。加 `--output-format stream-json --verbose` 可获得流式 JSON 输出。

`claude -p "your prompt"` 让 Claude 以非交互方式运行。除非传入 `--no-session-persistence`，运行仍会创建可恢复的会话。非交互模式是把 Claude 集成进 CI 流水线、pre-commit 钩子或任何自动化流程的方式。输出格式让你能以程序方式解析结果：纯文本、JSON 或流式 JSON：

```bash
# One-off queries
claude -p "Explain what this project does"

# Structured output for scripts
claude -p "List all API endpoints" --output-format json

# Streaming for real-time processing
claude -p "Analyze this log file" --output-format stream-json --verbose
```

第一条命令输出纯文本；`json` 格式返回含 `result` 字段的单个 JSON 对象；`stream-json` 每行一个 JSON 对象，以 init 事件开始。

### 并行运行多个 Claude 会话

并行跑多个 Claude 会话来加速开发、隔离实验或启动复杂工作流。按你愿意亲自协调的程度选择并行方式，需要互相传递发现时再加消息机制：

- **Worktrees（工作树）**：在隔离的 git checkout 中运行各自独立的 CLI 会话，互不冲突
- **跨会话消息**：让你手动管理的会话互相传递发现
- **桌面应用**：可视化管理多个本地会话，可各自独占工作树
- **网页版 Claude Code**：在 Anthropic 托管的基础设施上云端运行会话
- **Agent view**：运行 `claude agents` 派发在后台持续运行的会话，并在一个屏幕上监督它们
- **Agent teams**：实验性功能，默认关闭。多会话自动协同：共享任务、消息传递、队长角色

除了并行干活，多会话还能支撑"以质量为核心"的工作流：全新上下文能提升代码审查质量，因为 Claude 不会偏袒自己刚写的代码。例如 Writer/Reviewer 模式：

**表：Writer/Reviewer 双会话模式**

| 会话 A（Writer） | 会话 B（Reviewer） |
| --- | --- |
| `Implement a rate limiter for our API endpoints` | `Review the rate limiter implementation in @src/middleware/rateLimiter.ts. Look for edge cases, race conditions, and consistency with our existing middleware patterns.` |
| `Here's the review feedback: [Session B output]. Address these issues.` | |

测试也可以如法炮制：让一个 Claude 先写测试，另一个再写代码让测试通过。

### 跨文件扇出

循环对每个任务调用 `claude -p`。批量操作时用 `--allowedTools` 限定权限。

大型迁移或分析可以把工作分发给许多并行 Claude 调用。在 git 仓库里运行 `/batch <instruction>`，Claude 会把变更拆给 5 到 30 个子智能体，每个在自己的工作树里干活并开一个 PR。想用自己的脚本驱动扇出，就循环调用 `claude -p`：

1. **生成任务清单**：让 Claude 把待迁移文件列表写入文件，供下一步循环读取，如 `list all 2,000 Python files that need migrating and save the list to files.txt`。
2. **写脚本循环处理**：

```bash
for file in $(cat files.txt); do
  claude -p "Migrate $file from Python 2 to Python 3. Return OK or FAIL." \
    --allowedTools "Edit,Bash(git commit *)"
done
```

3. **先在几个文件上测试，再全量运行**：根据前 2-3 个文件暴露的问题打磨提示词，然后跑全量。`--allowedTools` 限制了 Claude 能做的事，这在无人值守运行时尤为重要。

也可以把 Claude 集成进既有数据/处理管道：

```bash
claude -p "<your prompt>" --output-format json | your_command
```

开发期用 `--verbose` 调试，生产环境关掉。

### 用 auto mode 自主运行

要无中断执行加后台安全检查，用 auto mode：分类器模型在命令运行前审查，拦截权限扩大、未知基础设施和恶意内容驱动的动作，让例行工作免弹窗通过。

```bash
claude --permission-mode auto -p "fix all lint errors"
```

在带 `-p` 的非交互运行中，若分类器反复拦截动作，Claude Code 不会直接停掉运行，具体回退行为见官方文档。

### 增加对抗式审查步骤

在把任务标记为完成之前，让一个子智能体在全新上下文中审查 diff 并报告缺口。无人值守时间越长，独立检查越重要。跑在全新子智能体上下文中的审查者只看到 diff 和你给的判据，看不到产生变更的推理过程，因此能就结果本身做评价。做正确性检查可直接运行内置的 `/code-review` skill；要对照计划检查 diff，就自己写审查提示——点名要检查的工作、对照的计划、什么算发现：

```text
Use a subagent to review the rate limiter diff against PLAN.md. Check that
every requirement is implemented, the listed edge cases have tests, and
nothing outside the task's scope changed. Report gaps, not style preferences.
```

由于审查者以子智能体身份运行，实现会话能直接收到缺口清单，自行修复并复审，无需你在窗口之间搬结果。

注意：被要求"找缺口"的审查者通常总能报出一些缺口，哪怕工作本身无懈可击——因为它被要求干的就是这个。追逐每一条发现会导致过度工程：多余的抽象层、防御性代码、给不可能场景写的测试。告诉审查者只标记影响正确性或既定需求的缺口，其余视为可选。

## 避开常见失败模式

这些都是常见错误，及早识别能省时间：

- **大杂烩会话（kitchen sink session）**：从一个任务开始，中途插进无关问题，再回到第一个任务，上下文塞满无关信息。
  > **修复**：不相关任务之间用 `/clear`。
- **反复纠正**：Claude 做错了，你纠正，还错，再纠正。上下文被失败尝试污染。
  > **修复**：纠正两次仍失败后，`/clear` 并带着学到的教训写一条更好的初始提示。
- **过度膨胀的 CLAUDE.md**：文件太长，Claude 无视其中一半，重要规则淹没在噪声里。
  > **修复**：无情修剪。Claude 不需要这条指令也能做对的话，删掉，或改写成 hook。
- **先信任后验证的落差**：Claude 产出一个看似合理的实现，却不处理边界情况。
  > **修复**：始终提供验证手段（测试、脚本、截图）。无法验证就不要上线。
- **无限探索**：让 Claude "调研"某事却不给范围。Claude 读了几百个文件，撑爆上下文。
  > **修复**：把调研范围收窄，或改用子智能体，别让探索吃掉主上下文。

## 培养你的直觉

本指南的模式并非铁律，它们是普遍有效、但未必处处最优的起点。有时你*应该*让上下文累积，因为你正深陷一个复杂问题而历史极具价值；有时你应该跳过规划让 Claude 自行摸索，因为任务本身就是探索性的；有时模糊的提示恰到好处，因为你想先看看 Claude 如何理解问题再收紧约束。留意什么有效：Claude 产出绝佳结果时，注意你做了什么——提示结构、提供的上下文、所处模式。Claude 挣扎时，问为什么：上下文太吵？提示太模糊？任务对单轮来说太大？日积月累，你会形成任何指南都写不出来的直觉：何时具体、何时开放，何时规划、何时探索，何时清空上下文、何时任其累积。

## 相关资源

- How Claude Code works：智能体循环、工具与上下文管理
- Extend Claude Code：skills、hooks、MCP、子智能体与插件
- Common workflows：调试、测试、PR 等日常任务的分步配方
- CLAUDE.md：存放项目约定与持久上下文

> 译注：本文与模块 5《Prompt 工程》、模块 9《Agent》多有呼应：给 Claude 可运行的验证手段即"让智能体闭合回路"，子智能体与并行会话即模块 13《多智能体协作编码》的实践基础，CLAUDE.md 与 Skills 则详见本模块第 5、6 篇。
