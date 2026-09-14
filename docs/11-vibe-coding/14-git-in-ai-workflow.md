---
title: Git in AI 工作流：commit 即存档、worktree 隔离与审查流
source_url: https://code.claude.com/docs/en/worktrees
author: Anthropic（Claude Code 官方文档，主篇）；Simon Willison / Geoffrey Huntley（实践引言）
license: 署名翻译（官方文档 Copyright Anthropic PBC；引言部分为博客署名转载）
fetched_at: 2026-09-13
translated: true
order: 14
---

## 引言：为什么 Git 在 AI 时代更重了

（本节摘译自两篇实践文章。）

Simon Willison 在《Vibe engineering》中把"良好的版本控制习惯"列为 LLM 最奖励的工程实践之一：

> 当改动可能出自一个编码智能体时，"撤销错误、理解何时何地为何改动"变得更加重要。LLM 的 Git 功力极强——它们能自己翻历史追查 bug 起源，用起 git bisect 比大多数开发者都溜。把这一点变成你的优势。

Geoffrey Huntley 在《Ralph Wiggum as a "software engineer"》中则把"高频提交"上升为智能体循环的硬性纪律：

> Have the agent commit and push as often as possible… Have the agent manage its own branches and PRs. It does this brilliantly.
>
> （译：让智能体尽可能频繁地 commit 和 push……让智能体管理自己的分支和 PR。它干这个非常出色——我让它在 PR 收尾时把提交 squash 掉，它二话不说就照做。Squash merge？提交信息？解释它做了什么？它就是一台机器。）

如果你还没掌握 Git 的暂存/提交/分支/合并，请先学习模块 2 的 Git 基础两篇——《Git 基础（暂存/提交/回退）》与《Git 分支/合并/PR 协作》——再回到本篇。AI 工作流没有引入新的 Git 概念，它只是把三件事的优先级提到了最高：**提交是存档点**（智能体跑偏时回退的最小成本手段）、**分支是实验隔离舱**（多个智能体互不踩脚）、**审查是唯一的质量闸门**（你不再是唯一的作者）。

下面翻译 Claude Code 官方文档中把"分支隔离"产品化的完整方案——git worktree。其他工具（Cline Kanban、Cursor 等）的并行方案在原理上相同。

## 用 worktree 运行并行会话

> 以下为 Claude Code 官方文档译文（节选）。

git worktree 是一个独立的工作目录，拥有自己的文件与分支，但与主 checkout 共享同一套仓库历史和远端。让每个 Claude Code 会话跑在自己的 worktree 里，一个会话的编辑永远不会碰另一个会话的文件——一个会话构建功能的同时，另一个可以修 bug。

> 注意：worktree 需要 git 仓库；其他版本控制系统可用 hook 替换 git 逻辑（见原文）。桌面应用中启动会话时勾选 worktree 选项即可获得同等隔离。

worktree 只是并行方式之一：子智能体（subagents）把工作拆进单个会话内部，跨会话消息让 worktree 里的会话互通发现。

### 在 worktree 中启动 Claude

传 `--worktree` 或 `-w` 加名字，即可创建隔离 worktree 并在其中启动 Claude。默认创建于仓库根的 `.claude/worktrees/<name>/`，分支名为 `worktree-<name>`：

```bash
claude --worktree feature-auth
```

在另一个终端用不同名字再跑一遍，即得到第二个隔离会话。省略名字时 Claude 会生成一个，比如 `bright-running-fox`。

> 提示：把 `.claude/worktrees/` 加进 `.gitignore`，worktree 内容就不会在主 checkout 里显示为未跟踪文件。

**准备 worktree 环境**：worktree 是全新 checkout，需要初始化开发环境——让 Claude 装依赖，或你在 `.claude/worktrees/` 下自行跑项目 setup。想让 `.env` 这类被 gitignore 的文件自动进入每个新 worktree，加一个 `.worktreeinclude` 文件（见下文）。

**让 Claude 自己开 worktree**：会话中直接说"work in a worktree"，Claude 会用 EnterWorktree 工具创建。进入仓库 `.claude/worktrees/` 之外的路径时，Claude Code 会先征求你的批准——因为这一步会把会话的工作目录、写权限和项目配置（CLAUDE.md、设置）都带过去。

### 清理 worktree

退出交互式 worktree 会话时，Claude 会检查 worktree 里有没有删除即丢失的工作（改动/未跟踪文件、新提交）：

- **干净**：未命名会话的 worktree 和分支自动移除；命名会话会先询问你，方便保留。
- **有工作**：提示你保留或移除。保留则目录与分支原样留着供日后回来；移除则连同其中全部工作一起删除。

带 `-p` 的非交互运行没有退出提示，Claude 不会清理其 worktree；可手动 `git worktree remove`（被锁则先 `git worktree unlock`）。

### 恢复 worktree 会话

恢复在 worktree 内创建的会话时，Claude Code 会把会话带回那个 worktree——交互恢复、非交互 `--continue`/`--resume`、Agent SDK 皆然。回到 worktree 前，它会校验这仍是一个独立于主 checkout 的 checkout。

**清理时机**：Claude Code 会周期性清扫为子智能体和后台会话创建的 worktree（超过 `cleanupPeriodDays` 设置的才清）。仍持有工作的 worktree（有改动、未推送提交）一律保留。

### Claude Code 如何强制隔离

会话被隔离在 worktree 中时，以下工具调用会被拦截（对 `--worktree` 启动、EnterWorktree 进入、恢复会话三种情形一视同仁，也覆盖派生的所有子智能体）：

- **文件编辑**：目标是主 checkout 路径的 `Edit`/`Write`/`NotebookEdit` 一律拦截。
- **命令工作目录**：解析到主 checkout、或无法验证留在主 checkout 之外的 Bash/PowerShell 命令拦截。
- **Git 重定向**：通过 `git -C`、`--git-dir`、`GIT_DIR`/`GIT_WORK_TREE` 变量或先 `cd` 进主 checkout 再跑 git 的重定向拦截。
- **命令形态**：无法从命令文本确认 git 操作留在 worktree 内（如运行时拼接命令名、语法不可解析）时拦截，并告知 Claude 如何改写（如拆成朴素的独立命令）。此项不可关闭。

Claude 会把每次拒绝当作工具错误读到，其中写明 worktree 与继续方法。

### 用 worktree 隔离子智能体

让子智能体跑在各自的 worktree 里，并行编辑就不会冲突。对话里说 "use worktrees for your agents"，或在自定义子智能体的 frontmatter 中写 `isolation: worktree` 固化下来：

```markdown
---
name: refactorer
description: Applies mechanical refactors across many files
isolation: worktree
---

Apply the requested refactor across every affected file, then run the tests
and report the results.
```

每个子智能体获得一个临时 worktree：子智能体完成且无改动时自动移除；有改动的保留到周期清扫时安全回收。

### 定制 worktree 创建

- **选择基准分支**：新 worktree 默认从仓库默认分支（远端最新，`"fresh"`）分出，保证从干净的树开始。设置 `worktree.baseRef: "head"` 则从当前本地 HEAD 分出，携带你未推送的提交——适合需要接力在制品（in-progress work）的隔离子智能体：

```json
{
  "worktree": {
    "baseRef": "head"
  }
}
```

- **从 PR 分支**：`--worktree` 接受 `#编号`、GitHub PR URL 或 GitLab MR URL，Claude Code 会抓取该变更的 head commit，创建于 `.claude/worktrees/pr-<编号>`：

```bash
claude --worktree "#1234"
```

- **复制 gitignore 文件**：worktree 是全新 checkout，`.env` 等未跟踪文件不会出现。在项目根加 `.worktreeinclude`（语法同 `.gitignore`；只有匹配模式且确实被 gitignore 的文件才复制，跟踪文件绝不重复）：

```text
# .worktreeinclude
.env
.env.local
config/secrets.json
```

- **复用名字**：`--worktree` 传入已存在的名字会打开既有 worktree 而非新建。默认 `"fresh"` 基准时，满足"无未提交内容、仍在其专属分支、无自有提交（或 PR 已合并、远端分支已删）"全部条件时，重开即重置回默认分支。

### worktree 与主 checkout 共享什么

worktree 有自己的文件和分支，但共享：**仓库 `.git` 目录**（worktree 里的 `git commit` 直接写主仓库历史——这正是"每个 worktree 的提交都进同一份历史"的机制）；**项目级插件**；**权限批准**（"不再询问"规则存进主 checkout 的 `.claude/settings.local.json`，对所有 worktree 生效）。

### 手动管理 worktree

需要检出特定既有分支、或把 worktree 放到仓库之外时，直接用 Git：

```bash
# 新建分支并创建 worktree
git worktree add ../project-feature-a -b feature-a

# 从既有分支创建 worktree（fix-issue-456 为已有分支）
git worktree add ../hotfix-456 fix-issue-456
```

查看、移除：

```bash
git worktree list
git worktree remove ../hotfix-456
```

> 译注：worktree 是模块 2《Git 分支/合并/PR 协作》中"分支隔离"思想的多目录形态——分支给历史画叉，worktree 给工作区画叉。AI 时代它的价值被放大：每个智能体一个舱位，合并前互不干扰。

## 把三件事串成一个流程

结合上文与两篇引言文章，一个可落地的"Git in AI 工作流"：

1. **开任务即开分支/worktree**：`claude --worktree <task>`，物理隔离实验。
2. **commit 即存档**：要求智能体每完成一个可验证的单元就提交（Geoffrey Huntley 的做法是最短每 30 分钟 push 一次）；跑偏就 `/rewind` 或 `git reset`——存档点越密，试错越便宜。
3. **让智能体自理分支与 PR**：命名分支、写提交信息、收尾 squash，智能体都能胜任；你省下的时间花在审查上。
4. **审查是唯一闸门**：AI 生成代码一律走 PR review——Writer/Reviewer 双会话（第 7 篇）、`/code-review` 技能或 Copilot/Bugbot（第 2 篇）、加上人眼终审。审查流程详见第 21 篇。
5. **合并不代表责任转移**：按 Simon Willison 的黄金法则——你不能向别人解释的代码，不进你的仓库。

---

> **来源**：本文主篇翻译自 [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)，作者 Anthropic（Claude Code 官方文档），许可署名翻译（Copyright Anthropic PBC，教学用途）。引言部分摘译自 Simon Willison《[Vibe engineering](https://simonwillison.net/2025/Oct/7/vibe-engineering/)》与 Geoffrey Huntley《[Ralph Wiggum as a "software engineer"](https://ghuntley.com/ralph/)》，署名转载。抓取于 2026-09-13。
