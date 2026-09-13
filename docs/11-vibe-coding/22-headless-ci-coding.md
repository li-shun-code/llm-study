---
title: Headless 与 CI 中的 AI 编码：Agent SDK、GitHub Actions 与 Copilot 云端智能体
source_url: https://code.claude.com/docs/en/agent-sdk
author: Anthropic（Claude Agent SDK 与 GitHub Actions 官方文档）；GitHub（Copilot cloud agent 官方文档）
license: 署名翻译（两家官方文档版权归原厂所有，教学用途编译翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 22
---

上一篇工具链生态的结尾留了一个钩子：AI 编码的"下半场"在**没有人的地方**。第 21 篇已经用 `claude -p` 演示了把单条命令塞进脚本；本篇把这条线走到底——从"调一次 CLI"上升到**把整个智能体循环嵌入 CI 流水线**的三种工业形态：Claude Agent SDK（程序化 embedding）、Claude Code GitHub Actions（事件驱动）与 GitHub Copilot cloud agent（云端 PR 智能体）。第 7 篇的权限配方在这里全部派上用场。

## 一、Agent SDK：把 Claude Code 当库用（译自官方 Agent SDK Overview）

Claude Agent SDK 让你以 Python 或 TypeScript 的库形态，使用驱动 Claude Code 的同一套工具、智能体循环与上下文管理来构建生产级 AI 智能体。

### 选型对照

| 如果你在… | 用 | 理由 |
| --- | --- | --- |
| 构建智能体但不想自己实现工具循环 | **Agent SDK** | 在你自己的进程里跑智能体循环的库（Python/TypeScript） |
| 终端交互开发或跑一次性任务 | [Claude Code CLI](https://code.claude.com/docs/en/overview) | 为日常交互设计的终端界面 |
| 直接调 API、自己实现工具循环 | [Client SDK](https://platform.claude.com/docs/en/api/client-sdks) | 直达 Anthropic API，工具循环自己写 |
| 跑长期/异步智能体、不想自建沙箱与会话基础设施 | [Managed Agents](https://platform.claude.com/docs/en/managed-agents/overview) | 托管 REST API，Anthropic 替你跑智能体与沙箱 |

SDK 只提供 Python 与 TypeScript；其他语言要驱动同一循环，官方给出的路径是**以子进程方式跑 CLI**（`-p` 加 `--output-format json`）——这正是第 21 篇 Headless 章节的机制，两条路在这里会合。

### SDK 具备的能力

内置工具（读写文件、跑命令、搜网页）、Hooks（智能体生命周期关键点运行自定义代码）、子智能体（为专注子任务派生专职智能体）、MCP（接入外部工具与数据源）、**权限**（控制哪些工具自动执行、哪些需要批准）、会话（跨轮次维持上下文、可恢复或分叉）、技能/命令/记忆（与 Claude Code 一样自动从项目 `.claude/` 与 `~/.claude/` 加载）、插件（打包分发技能、智能体、hooks 与 MCP 服务器）。

> 注意：Anthropic 不允许第三方开发者的产品（包括基于 Agent SDK 构建的智能体）提供 claude.ai 登录或其速率额度——必须走 API Key 认证。官方 Quickstart 的第一个示例就是一个"在既有代码里找出并修复 Bug"的智能体。

## 二、Claude Code GitHub Actions：事件驱动的仓库智能体（译自官方文档）

第 21 篇提过官方 Action 支持 `@claude` 触发；这里译出它的完整运行模型。安装后，**同一个 Action 会根据 workflow 配置自动区分两种模式**：

- **交互模式**：workflow 未提供 `prompt` 输入时，Claude 等待触发短语（默认 `@claude`）——出现在 issue/PR 评论、PR 评审、或新开 issue 的标题正文里——然后响应；进度与结果以评论形式出现在触发处
- **自动化模式**：workflow 提供了 `prompt` 输入时，Claude 不等提及直接运行，只受"谁能触发"检查约束；结果默认进 workflow 运行日志（提示词指示且有可发布工具时也可发到 issue/PR）

### 谁能触发：两道闸门

两种模式下，Claude 启动前都对触发者做两项检查，任一拒绝则运行失败：

1. **写权限检查**：issue/PR 事件中，触发用户必须对仓库有写权限（例外用户需配 `allowed_non_write_users` 并自备 `github_token`；schedule 这类无用户事件跳过）
2. **人类检查**：机器人账户一律拒绝，除非列入 `allowed_bots`——防止机器人之间互相触发形成死循环。定时运行同样过此检查（GitHub 把它归到仓库某个用户，通常是最后改过 cron 的人）

### 官方最佳实践

- **项目标准写进 CLAUDE.md**：代码风格、评审标准、项目规则与惯用模式——Claude 建 PR 和响应请求时都会遵守（每次运行都会读，所以保持精简）
- **保护凭据**：绝不把 API Key 直接提交进仓库——存 GitHub Secrets 并在 workflow 中引用；只授予 workflow 所需的最小权限；合并前人工审查 Claude 的改动
- **管理成本**：每次运行消耗两类资源——GitHub Actions 分钟数与 API token（OAuth token 认证则消耗订阅额度）。降耗手段：把 `@claude` 请求写具体（减少轮次）、用 issue 模板前置上下文、`claude_args` 设 `--max-turns` 限制迭代、workflow 级超时防失控、用并发控制限制并行数

## 三、GitHub Copilot cloud agent：另一家的云端形态（译自 GitHub 官方文档）

GitHub 这边把同类能力称为 **Copilot cloud agent**：Copilot 在后台独立完成任务，"就像一个人类开发者"。它能研究仓库、创建实现计划、修 Bug、实现增量特性、提升测试覆盖率、更新文档、处理技术债、解决合并冲突。

入口形态多样：在 GitHub.com 的智能体面板让它研究、规划、在分支上改代码、迭代后再开 PR；从 Issue 或 VS Code 直接发起会话；在已有 PR 里 `@copilot` 让它改动；配置自动化按计划或响应事件（如 issue 被打开）自动运行；安全活动里把安全告警直接指派给它。

**与 IDE 内助手的关键差异**（官方对比译文）：IDE 助手的编码发生在**本地**、同步会话、决策不落轨迹；开发者仍要手动建分支、写提交信息、push、开 PR、写描述。而 cloud agent 的一切发生在 **GitHub 上**：分支创建、提交信息、push 全部自动化，每一步都落在一个 commit 里、日志可查——**透明性**与**团队协作**是云端形态的结构性优势。工作时它拥有一个由 GitHub Actions 驱动的**临时开发环境**，可以探索代码、做改动、执行自动化测试与 lint。

**计费模型**：消耗 GitHub Actions 分钟数与 AI 额度（AI 额度取决于所用模型与会话处理 token 数）；额度内使用不产生额外费用；私有仓库上的 Copilot code review 同样消耗 Actions 分钟数。注意它**不同于 IDE 里的 agent mode**——后者是在你本地环境直接自主编辑。

> 译注：把第 21 篇的 Cline GitHub Actions 样例与本篇两家官方方案并排，可以看到"云端 PR 智能体"已经是行业标准形态：触发（mention/事件/定时）→ 沙箱环境 → 分支改动 → PR → 评审。区别只在生态位——Anthropic 系开放 SDK 自建编排，GitHub 系原生绑定平台。

## 四、无人值守的工程配方（本站编者小结）

把三篇合起来（第 21 篇 CLI 层、本篇平台层），无人值守 AI 编码的配方收敛为四件套，每件都指向本模块已建立的知识：

1. **权限收敛**：CI 场景用 `dontAsk` 模式 + 显式 allowlist + 沙箱严格域名白名单（第 7 篇）；人类检查与最小权限是防"机器人死循环"与凭据外泄的两道闸
2. **可验证的完成标准**：`--max-turns`、workflow 超时、测试/编译作为裁判（第 6 篇）；没有裁判就没有退出条件（第 16 篇）
3. **产物走 PR**：无论 Claude Code Action 还是 Copilot cloud agent，产出一律是分支 + PR——审查是唯一闸门（第 12、19 篇）
4. **成本可观测**：Actions 分钟与 token 双计费，配 analytics 与预算告警——这正是下一篇要展开的主题

---

> 下一篇预告：当智能体真的在无人值守跑、成批产出代码时，"安全与质量陷阱"就不再是理论问题。第 23 篇用一个真实的科学虚构级事件——模型越狱并攻入 Hugging Face——讲 AI 代码的风险模型。

> **来源**：本文第一节译自 [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk)，第二节译自 [Claude Code GitHub Actions](https://code.claude.com/docs/en/github-actions)（Anthropic 官方文档，Copyright Anthropic PBC）；第三节译自 [About GitHub Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)（GitHub 官方文档）。作者为 Anthropic 与 GitHub 官方文档，许可署名翻译（官方文档版权归原厂所有，教学用途编译翻译并署名）。两处"译注"与第四节为本站编者补充并已标明。抓取于 2026-09-13。
