---
title: 第一次 AI 结对：从零做一个命令行小工具
source_url: https://code.claude.com/docs/en/quickstart
author: Anthropic（Claude Code 官方文档 Quickstart、Common workflows）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途翻译并署名；编者过渡与本站实操小节已明确标注）
fetched_at: 2026-09-13
translated: true
order: 5
---

**编者按**：前一篇装好了工具，本篇带你走完第一次完整的 AI 结对。正文主体是 Claude Code 官方《Quickstart》与《Common workflows》两页的完整翻译——前者是官方设计的"第一次会话"全流程，后者是官方的日常配方库。为保留"从零做一个命令行小工具"的实操主线，编者只在各部分之间加了最少量的过渡（均以"编者"字样标明），并在文末附一节把官方流程映射到该小工具的实操对照（编者补充，已标明）。除该节与过渡句外，以下内容均为官方原文翻译。

## 一、Quickstart：五分钟上手 Claude Code（官方文档全文翻译）

*译自 [Claude Code 官方文档 Quickstart](https://code.claude.com/docs/en/quickstart)（2026-09 当前版）。*

欢迎使用 Claude Code！

本快速入门指南将让你在几分钟内用上 AI 编码助手。读完本页，你将掌握如何用 Claude Code 完成常见开发任务。

### 开始之前

请确认你已具备：

* 打开了一个终端或命令提示符
  * 如果你从未用过终端，请参阅[终端指南](https://code.claude.com/docs/en/terminal-guide)
* 一个可以工作的代码项目
* 一个 [Claude 订阅](https://claude.com/pricing)（Pro、Max、Team 或 Enterprise）、[Claude Console](https://platform.claude.com/) 账号，或通过[受支持的云提供商](https://code.claude.com/docs/en/third-party-integrations)获得的访问权限

> 注：本指南介绍终端 CLI。Claude Code 也可在[网页端](https://claude.ai/code)、[桌面应用](https://code.claude.com/docs/en/desktop)、[VS Code](https://code.claude.com/docs/en/vs-code)与 [JetBrains IDE](https://code.claude.com/docs/en/jetbrains) 插件、[Slack](https://code.claude.com/docs/en/slack)，以及通过 [GitHub Actions](https://code.claude.com/docs/en/github-actions) 和 [GitLab](https://code.claude.com/docs/en/gitlab-ci-cd) 的 CI/CD 中使用。

### 第 1 步：安装 Claude Code

安装 Claude Code 可用以下任一方式。

**原生安装（推荐）**

macOS、Linux、WSL：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://claude.ai/install.ps1 | iex
```

Windows CMD：

```batch
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

如果看到 `The token '&&' is not a valid statement separator`，说明你在 PowerShell 而不是 CMD；如果看到 `'irm' is not recognized as an internal or external command`，说明你在 CMD 而不是 PowerShell。PowerShell 的提示符显示 `PS C:\`，CMD 显示不带 `PS` 的 `C:\`。

如果安装命令报 `syntax error near unexpected token '<'`、`403` 或其他 curl 错误，请参阅[安装排障](https://code.claude.com/docs/en/troubleshoot-install#find-your-error)将错误对应到解决办法，并了解替代安装方式。

原生 Windows 上推荐安装 [Git for Windows](https://git-scm.com/downloads/win)，这样 Claude Code 才能使用 Bash 工具；未安装时，Claude Code 会改用 PowerShell 作为 shell 工具。WSL 环境不需要 Git for Windows。

> 信息：原生安装会在后台自动更新，让你始终使用最新版本。

**Homebrew**

```bash
brew install --cask claude-code
```

Homebrew 提供两个 cask：`claude-code` 跟踪稳定发布通道（通常约落后一周，并跳过有重大回归的版本）；`claude-code@latest` 跟踪最新通道，新版本一发布即更新。

> 信息：Homebrew 安装不会自动更新。请根据所装 cask 运行 `brew upgrade claude-code` 或 `brew upgrade claude-code@latest` 获取最新功能与安全修复。

**WinGet**

```powershell
winget install Anthropic.ClaudeCode
```

> 信息：WinGet 安装不会自动更新。请定期运行 `winget upgrade Anthropic.ClaudeCode` 获取最新功能与安全修复。

在 Debian、Fedora、RHEL 和 Alpine 上还可以用 [apt、dnf 或 apk](https://code.claude.com/docs/en/setup#install-with-linux-package-managers) 安装。

确认安装是否成功，运行：

```bash
claude --version
```

命令会打印一个版本号，后跟 `(Claude Code)`。

### 第 2 步：登录账号

Claude Code 需要账号才能使用。用 `claude` 命令启动交互式会话，首次使用时会提示你登录：

```bash
claude
```

对 Claude 订阅或 Console 账号，按提示在浏览器中完成认证。如果你已设置 `ANTHROPIC_API_KEY` 环境变量，Claude Code 会跳过登录提示并请你确认使用该密钥。之后若要切换账号或重新认证，在会话中输入 `/login`。

可以使用以下任意一种账号类型登录：

* [Claude Pro、Max、Team 或 Enterprise](https://claude.com/pricing)（推荐）
* [Claude Console](https://platform.claude.com/)（API 访问，预付费额度。首次登录时 Console 会自动创建一个 "Claude Code" 工作区，便于集中跟踪成本）
* [Amazon Bedrock、Google Cloud's Agent Platform 或 Microsoft Foundry](https://code.claude.com/docs/en/third-party-integrations)（企业云提供商）
* 自托管的 Claude 应用网关（如果你的组织有部署）：管理员预先配置网关 URL，`/login` 会直接打开**云网关**界面，用企业 SSO 登录

登录后凭据会被保存，无需再次登录。详见[凭据管理](https://code.claude.com/docs/en/authentication#credential-management)。

### 第 3 步：启动第一个会话

在任意项目目录打开终端并启动 Claude Code：

```bash
cd /path/to/your/project
claude
```

把 `/path/to/your/project` 换成你要处理的项目的路径。

你会看到 Claude Code 提示符，上方显示版本号、当前模型与工作目录。输入 `/help` 查看可用命令，输入 `/resume` 继续上一次对话。

> 编者过渡：官方 Quickstart 的第 4-8 步在"既有项目"里演示第一次会话。想直接体会"从零做一个命令行小工具"的读者，可以现在就新建一个空目录再启动 `claude`——官方每一步的提示词原样可用；本节先按官方原文翻译，实战对照见文末编者小节。

### 第 4 步：问第一个问题

从理解你的代码库开始。试试这些命令：

```text
what does this project do?
```

Claude 会分析你的文件并给出摘要。你也可以问更具体的问题：

```text
what technologies does this project use?
```

```text
where is the main entry point?
```

```text
explain the folder structure
```

还可以问 Claude 关于它自身能力的问题：

```text
what can Claude Code do?
```

```text
how do I create custom skills in Claude Code?
```

```text
can Claude Code work with Docker?
```

> 注：Claude Code 按需读取你的项目文件，你不需要手动添加上下文。

### 第 5 步：做第一处代码修改

现在让 Claude Code 真正写代码。给它一个简单任务：

```text
add a hello world function to the main file
```

Claude Code 会找到合适的文件并把改动展示给你。如果它在修改前询问，选择 **Yes** 批准即可。

auto 模式是 Pro、Max、Team 计划交互式终端会话的[内置起始权限模式](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode)：由一个分类器代你审查动作，Claude 无需询问即可编辑大多数文件、运行大多数命令。在其他计划上，Manual（手动）模式是内置的起始权限模式。安装后紧接着的第一次会话详见[安装或升级后的第一次会话](https://code.claude.com/docs/en/env-vars#first-session-after-an-install-or-upgrade)。

> 注：你的设置或所在组织可以设置不同的起始权限模式，详见[会话以哪种模式启动](https://code.claude.com/docs/en/permission-modes#which-mode-a-session-starts-in)。随时按 `Shift+Tab` 可切换当前会话的权限模式。

### 第 6 步：配合 Git 使用

Claude Code 让 Git 操作变得对话化：

```text
what files have I changed?
```

```text
commit my changes with a descriptive message
```

也可以提示它做更复杂的 Git 操作：

```text
create a new branch called feature/quickstart
```

```text
show me the last 5 commits
```

```text
help me resolve merge conflicts
```

### 第 7 步：修 Bug 或加功能

Claude 擅长调试与功能实现。

用自然语言描述你想要的东西：

```text
add input validation to the user registration form
```

或修复现有问题：

```text
there's a bug where users can submit empty forms - fix it
```

Claude Code 会：

* 定位相关代码
* 理解上下文
* 实现解决方案
* （若有测试）运行测试

### 第 8 步：试用其他常见工作流

与 Claude 协作的方式有很多：

**重构代码**

```text
refactor the authentication module to use async/await instead of callbacks
```

**写测试**

```text
write unit tests for the calculator functions
```

**更新文档**

```text
update the README with installation instructions
```

**代码审查**

```text
review my changes and suggest improvements
```

> 技巧：像对待一位乐于助人的同事那样跟 Claude 说话。描述你想达成什么，它会帮你到达那里。

### 常用命令

以下是日常使用中最重要的命令。Shell 命令在终端里运行，用于启动或恢复 Claude Code；会话命令在 Claude Code 启动后的会话内使用。

**Shell 命令**

| 命令 | 作用 | 示例 |
| --- | --- | --- |
| `claude` | 启动交互模式 | `claude` |
| `claude "task"` | 带初始提示启动交互模式 | `claude "fix the build error"` |
| `claude -p "query"` | 运行单次查询后退出 | `claude -p "explain this function"` |
| `claude -c` | 继续当前目录最近一次对话 | `claude -c` |
| `claude -r` | 恢复某次历史对话 | `claude -r` |

**会话命令**

| 命令 | 作用 | 示例 |
| --- | --- | --- |
| `/clear` | 清空对话历史 | `/clear` |
| `/help` | 显示可用命令 | `/help` |
| `/exit` 或连按两次 Ctrl+D | 退出 Claude Code | `/exit` |

完整 Shell 命令列表见 [CLI 参考](https://code.claude.com/docs/en/cli-reference)，完整会话命令列表见[命令参考](https://code.claude.com/docs/en/commands)。

### 新手技巧

更多内容见[最佳实践](https://code.claude.com/docs/en/best-practices)与[常见工作流](https://code.claude.com/docs/en/common-workflows)。

**请求要具体。** 与其说"fix the bug"，不如试："fix the login bug where users see a blank screen after entering wrong credentials"。

**用分步指令。** 把复杂任务拆成步骤：

```text
1. create a new database table for user profiles
2. create an API endpoint to get and update user profiles
3. build a webpage that allows users to see and edit their information
```

**先让 Claude 探索。** 改代码之前，先让它理解你的代码：

```text
analyze the database schema
```

```text
build a dashboard showing products that are most frequently returned by our UK customers
```

**用快捷键省时间。**

* 输入 `/` 查看可用命令与技能
* 用 Tab 补全命令
* 按 ↑ 翻阅命令历史
* 按 `Shift+Tab` 循环切换权限模式

### 下一步

学完基础后，可以探索更多进阶功能：了解 Claude Code 的工作原理（智能体循环、内置工具、与项目的交互）、最佳实践（高效提示与项目配置）、常见工作流（常见任务的分步指南），以及扩展 Claude Code（CLAUDE.md、skills、hooks、MCP 等）。

### 获取帮助

* **在 Claude Code 内**：输入 `/help` 或直接问 "how do I..."
* **文档**：就在本站，浏览其他指南即可
* **社区**：加入 [Discord](https://www.anthropic.com/discord) 获取技巧与支持

## 二、Common workflows：日常配方库（官方文档全文翻译）

*译自 [Claude Code 官方文档 Common workflows](https://code.claude.com/docs/en/common-workflows)（2026-09 当前版）。*

本页收录日常开发的短配方。关于提示词与上下文管理的高阶指引，参见[最佳实践](https://code.claude.com/docs/en/best-practices)。

本页覆盖：探索代码、修 Bug、重构、测试、PR、文档的提示词配方；恢复历史对话让任务跨多次进行；用 worktree 跑并行会话；编辑前先计划；把研究外包给子智能体；把 Claude 接入脚本用于 CI 与批处理。

### 提示词配方

这些是日常任务的提示词模式：探索陌生代码、调试、重构、写测试、创建 PR 等。每个配方在任何 Claude Code 界面都可用，措辞请按你的项目调整。

#### 理解新代码库

monorepo 或大型代码库的 Claude Code 配置见[Monorepo 与大型仓库](https://code.claude.com/docs/en/large-codebases)。

**快速获得代码库概览**

假设你刚加入一个新项目，需要快速理解它的结构。

1. 进入项目根目录：

```bash
cd /path/to/project
```

2. 启动 Claude Code：

```bash
claude
```

3. 请求高层概览：

```text
give me an overview of this codebase
```

4. 深入具体组件：

```text
explain the main architecture patterns used here
```

```text
what are the key data models?
```

```text
how is authentication handled?
```

> 技巧：先问宽泛问题，再收窄到具体区域；询问项目使用的编码约定与模式；索要项目专属术语的词汇表。

**查找相关代码**

假设你需要定位与某个特性或功能相关的代码。

1. 让 Claude 找相关文件：

```text
find the files that handle user authentication
```

2. 了解组件间如何协作：

```text
how do these authentication files work together?
```

3. 理解执行流：

```text
trace the login process from front-end to database
```

> 技巧：具体说明你在找什么；使用项目中的领域语言；为你的语言安装[代码智能插件](https://code.claude.com/docs/en/discover-plugins#code-intelligence)，给 Claude 精确的"跳转定义"与"查找引用"导航。

#### 高效修 Bug

假设你遇到一条报错信息，需要找到并修复根源。

1. 把错误分享给 Claude：

```text
I'm seeing an error when I run npm test
```

2. 请它给出修复建议：

```text
suggest a few ways to fix the @ts-ignore in user.ts
```

3. 应用修复：

```text
update user.ts to add the null check you suggested
```

> 技巧：告诉 Claude 复现命令以获得堆栈跟踪；提及复现错误的步骤；说明错误是偶发还是必现。

#### 重构代码

假设你需要让旧代码用上现代模式与实践。（把整个代码库移植到新语言，参见博客[Anthropic 如何用 Claude Code 跑大规模代码迁移](https://claude.com/blog/ai-code-migration)。）

1. 找出要重构的遗留代码：

```text
find deprecated API usage in our codebase
```

2. 获取重构建议：

```text
suggest how to refactor utils.js to use modern JavaScript features
```

3. 安全地应用改动：

```text
refactor utils.js to use ES2024 features while maintaining the same behavior
```

4. 验证重构：

```text
run tests for the refactored code
```

> 技巧：让 Claude 解释现代方案的好处；需要时要求改动保持向后兼容；用小的、可测试的增量做重构。

#### 与测试协作

假设你需要给未被覆盖的代码补测试。

1. 找出未被测试的代码：

```text
find functions in NotificationsService.swift that are not covered by tests
```

2. 生成测试脚手架：

```text
add tests for the notification service
```

3. 补充有意义的测试用例：

```text
add test cases for edge conditions in the notification service
```

4. 运行并验证测试：

```text
run the new tests and fix any failures
```

Claude 能按照你项目既有的模式与约定生成测试。请求写测试时，具体说明你要验证什么行为。Claude 会检查你现有的测试文件，匹配已在使用的风格、框架与断言模式。

要获得全面覆盖，请 Claude 找出你可能遗漏的边界情况。Claude 能分析代码路径，为错误条件、边界值和容易被忽视的意外输入建议测试。

#### 创建拉取请求

你可以直接让 Claude 创建 PR（"create a pr for my changes"），也可以一步步引导它：

1. 总结你的改动：

```text
summarize the changes I've made to the authentication module
```

2. 生成拉取请求：

```text
create a pr
```

3. 审查与打磨：

```text
enhance the PR description with more context about the security improvements
```

之后要找回该会话，用你自己的 PR 号运行 `claude --from-pr 1234`，它会打开按该 PR 过滤的会话选择器；或把 PR URL 粘贴进 [`/resume` 选择器](https://code.claude.com/docs/en/sessions#use-the-session-picker)搜索框。当 Claude 用 `gh pr create` 或 `glab mr create` 创建 PR、或[处理既有 PR](https://code.claude.com/docs/en/agent-view#pull-request-status) 时，会话会自动关联到该 PR。

> 技巧：提交前审查 Claude 生成的 PR，并让 Claude 标出潜在风险或注意事项。

#### 处理文档

假设你需要为代码添加或更新文档。

1. 找出无文档的代码：

```text
find functions without proper JSDoc comments in the auth module
```

2. 生成文档：

```text
add JSDoc comments to the undocumented functions in auth.js
```

3. 审查与增强：

```text
improve the generated documentation with more context and examples
```

4. 验证文档：

```text
check if the documentation follows our project standards
```

> 技巧：指定你想要的文档风格（JSDoc、docstring 等）；要求文档附示例；为公开 API、接口与复杂逻辑请求文档。

#### 在笔记与非代码目录中工作

Claude Code 可在任何目录中工作。把它跑在笔记库、文档目录或任何 markdown 文件集合里，即可像处理代码一样搜索、编辑与重组内容。

`.claude/` 目录与 `CLAUDE.md` 与其他工具的配置目录并排存放、互不冲突。Claude 每次工具调用都重新读取文件，所以你在其他应用里做的编辑，它下一次读取时就能看到。

#### 处理图片

假设你需要处理代码库中的图片，并希望 Claude 帮你分析图像内容。

**把图片加入对话**，可用以下任一方式：

1. 把图片拖拽进 Claude Code 窗口
2. 复制图片后粘贴进 CLI（`Ctrl+V`；Windows 与 WSL 用 [`Alt+V`](https://code.claude.com/docs/en/interactive-mode#general-controls)）
3. 给 Claude 一个图片路径，例如 "Analyze this image: /path/to/your/image.png"

**让 Claude 分析图片**：

```text
What does this image show?
```

```text
Describe the UI elements in this screenshot
```

```text
Are there any problematic elements in this diagram?
```

**用图片提供上下文**：

```text
Here's a screenshot of the error. What's causing it?
```

```text
This is our current database schema. How should we modify it for the new feature?
```

**从视觉内容获得代码建议**：

```text
Generate CSS to match this design mockup
```

```text
What HTML structure would recreate this component?
```

> 技巧：当文字描述不清晰或繁琐时用图片；附上错误、UI 设计或图表的截图以提供更好上下文；一个对话里可以处理多张图片；图像分析支持图表、截图、设计稿等；当 Claude 引用图片（例如 `[Image #1]`）时，Mac 上 `Cmd+Click`、Windows/Linux 上 `Ctrl+Click` 该链接即可用默认看图器打开。

#### 引用文件与目录

用 `@` 快速把文件或目录纳入上下文，无需等 Claude 去读。

**引用单个文件**：

```text
Explain the logic in @src/utils/auth.js
```

这会把文件的完整内容纳入对话。

**引用目录**：

```text
What's the structure of @src/components?
```

**引用 MCP 资源**：

```text
Show me the data from @github:repos/owner/repo/issues
```

这会按 `@server:resource` 格式从已连接的 MCP 服务器取数据，详见 [MCP 资源](https://code.claude.com/docs/en/mcp#use-mcp-resources)。

> 技巧：路径可用相对或绝对路径；输入 `@` 打开路径建议菜单，按 Enter 或 Tab 接受高亮路径，再按 Enter 发送消息；`@` 文件引用会把该文件所在目录及父目录的 `CLAUDE.md` 一并加入上下文；目录引用显示文件列表而非内容；一条消息可引用多个文件（例如 "@file1.js and @file2.js"）。

#### 让 Claude 定时运行

假设你想让 Claude 按计划自动处理任务：每天早上评审 open 的 PR、每周审计依赖、夜里检查 CI 失败。

按任务运行的位置选择调度方式：

| 方式 | 运行位置 | 适用 |
| --- | --- | --- |
| [Routines](https://code.claude.com/docs/en/routines) | 云端（默认 Anthropic 托管） | 关机也要跑的任务。除按计划外，还可由 API 调用或 GitHub 事件触发。在 [claude.ai/code/routines](https://claude.ai/code/routines) 配置。 |
| [桌面计划任务](https://code.claude.com/docs/en/desktop-scheduled-tasks) | 你的机器（经桌面应用） | 需要直接访问本地文件、工具或未提交改动的任务。 |
| [GitHub Actions](https://code.claude.com/docs/en/github-actions) | 你的 CI 流水线 | 与仓库事件（如新开 PR）绑定、或希望与 workflow 配置放在一起的定时任务。 |
| [`/loop`](https://code.claude.com/docs/en/scheduled-tasks) | 当前 CLI 会话 | 会话打开期间的快速轮询。新开对话即停止；`--resume` 与 `--continue` 可恢复未过期任务。 |

> 技巧：给计划任务写提示词时，明确"成功长什么样"以及"结果如何处置"。任务自主运行，无法追问澄清问题。例如："Review open PRs labeled `needs-review`, leave inline comments on any issues, and post a summary in the `#eng-reviews` Slack channel."

#### 询问 Claude 自身的能力

Claude 内置了自身文档，可以回答关于其功能与限制的问题。

示例问题：

```text
can Claude Code create pull requests?
```

```text
how does Claude Code handle permissions?
```

```text
what skills are available?
```

```text
how do I use MCP with Claude Code?
```

```text
how do I configure Claude Code for Amazon Bedrock?
```

```text
what are the limitations of Claude Code?
```

> 注：Claude 会基于文档回答这些问题。想看上手演示，可运行 `/powerup` 获取带动画演示的交互课程，或参考上文各工作流小节。

> 技巧：无论你用哪个版本，Claude 总能访问最新的 Claude Code 文档；问具体的问题以获得详细的答案；Claude 能解释 MCP 集成、企业配置与高级工作流等复杂特性。

### 恢复历史对话

任务跨多次进行时，直接接着上次继续，而不用重新解释上下文。Claude Code 会在本地保存每一次对话。

```bash
claude --continue
```

这会恢复当前目录最近的会话；若没有，会打印 `No conversation found to continue` 并退出。用 `claude --resume` 从列表选择，或在运行中的会话里用 `/resume`。命名、分支与完整选择器参考见[管理会话](https://code.claude.com/docs/en/sessions)。

### 用 worktree 跑并行会话

在一个终端里做功能开发，同时让 Claude 在另一个终端修 Bug，两边改动互不冲突。每个 [git worktree](https://git-scm.com/docs/git-worktree) 都是一个独立检出、各自在一条分支上，从既有提交创建——所以仓库需要先有至少一次提交。

```bash
claude --worktree feature-auth
```

在第二个终端用不同名字运行同一条命令，即可开始一个隔离的并行会话。在没有提交的仓库里，该命令会报错 `Failed to resolve base branch "HEAD": git rev-parse failed`。清理方式、`.worktreeinclude` 与非 git VCS 支持见 [Worktrees](https://code.claude.com/docs/en/worktrees)。想在一块屏幕上监督多个并行会话而非多个终端，见[后台智能体](https://code.claude.com/docs/en/agent-view)。

### 编辑前先计划

对希望"落盘之前先审查"的改动，切换到 plan 模式：Claude 读文件、提出计划，但在你批准前不做任何修改。plan 模式激活时状态栏显示 `⏸ plan mode on`。

```bash
claude --permission-mode plan
```

也可以在会话中按 `Shift+Tab` 直到状态栏出现 `⏸ plan mode on`。批准流程与在文本编辑器中编辑计划见 [Plan mode](https://code.claude.com/docs/en/permission-modes#analyze-before-you-edit-with-plan-mode)。

### 把研究外包给子智能体

探索大型代码库会用文件读取填满你的上下文。把探索外包出去，只让结论回来。

```text
use a subagent to investigate how our auth system handles token refresh
```

子智能体在它自己的上下文窗口里读文件，只汇报摘要。用各自的工具与提示词定义自定义智能体见[子智能体](https://code.claude.com/docs/en/sub-agents)。

### 把 Claude 接进脚本

以非交互方式运行 Claude，用于 CI、pre-commit 钩子或批处理。stdin 与 stdout 的用法与任何 Unix 工具一样。

```bash
git log --oneline -20 | claude -p "summarize these recent commits"
```

输出格式、权限旗标与扇出模式见[非交互模式](https://code.claude.com/docs/en/headless)（即本模块前述的主题）。

## 三、从零实战对照：把官方流程走成一个命令行小工具（本站编者补充）

> 本节为本站编者补充（已在编者按标明）。它不做新的事情——只是把上面两份官方翻译里的提示词原样映射到"从零做一个 Python 命令行词频统计工具 `wcount`"上，方便你第一次结对就有一个可对照的脚本。

```bash
mkdir wcount && cd wcount && git init && claude
```

| 轮次 | 你对 Claude 说什么 | 用的是官方哪一条 |
| --- | --- | --- |
| 1 | "我想做一个叫 wcount 的 Python 命令行工具：输入文本文件路径，输出频率最高的前 N 个单词，N 用 --top 指定（默认 10）。先用标准库实现。" | Quickstart 第 5 步（描述目标，让它动手）+ 新手技巧"请求要具体" |
| 2 | "给它配 pytest：构造样例文本，断言大小写不敏感、按次数降序、同次数按字母序。先写测试跑给我看，再实现。" | Common workflows"与测试协作"（先测试后实现，用测试定义"完成"） |
| 3 | "用 python -m wcount 对样例跑 --top 5，把输出贴给我。" | Quickstart 第 7 步（Claude 自己跑测试/命令验证） |
| 4 | "commit my changes with a descriptive message" | Quickstart 第 6 步（对话式 Git） |

三个提醒，全部来自上面的官方译文：结果不对时**继续对话纠正**而不是重开会话（会话本身就是迭代的地方）；复杂任务**拆成编号步骤**；改代码前先让它**探索**。第一次结对的最小循环就是：**目标 → 生成 → 验证 → 提交**。走熟这四拍，后面的权限（《Claude Code 权限系统与安全机制》）、规范文件（《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》）、Spec 驱动（《Spec 驱动开发（Spec-Driven Development）》）都是在这个循环上做加固。

---

> 下一篇预告：工具用起来了，但"AI 到底是怎么'看'你的代码的"——上下文窗口、分词与智能体循环的底层心智模型，值得在读工作流进阶之前先建立。

> **来源**：本文第一、二部分完整翻译自 Claude Code 官方文档 [Quickstart](https://code.claude.com/docs/en/quickstart) 与 [Common workflows](https://code.claude.com/docs/en/common-workflows)（2026-09 当前版），作者 Anthropic，许可署名翻译（Copyright Anthropic PBC，教学用途）。开头编者按、两处"编者过渡"与第三部分"从零实战对照"为本站编者补充，均已在文中标明；其余正文均为官方原文翻译。抓取于 2026-09-13。
