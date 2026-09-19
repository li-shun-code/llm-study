---
title: AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件
source_url: https://agents.md/
author: OpenAI 等生态共建方（agents.md 官方站）；Anthropic（Claude Code Memory 文档，延伸阅读）
license: 署名翻译（agents.md 站点及 openai/agents.md 仓库内容为开放格式说明文档；CLAUDE.md 部分为官方文档教学翻译，均署名）
fetched_at: 2026-09-13
translated: true
order: 1
group: 项目规范与技能包
---
## 为什么需要 AGENTS.md？

README.md 是写给人看的：快速上手、项目介绍、贡献指南。

AGENTS.md 补足了另一半：**编码智能体需要的额外上下文**——构建步骤、测试命令、项目约定，这些内容写进 README 会显得杂乱，或者与人类贡献者无关。

我们有意把它单独分出来，为的是：

- 给智能体一个清晰、可预测的指令存放位置；
- 让 README 保持精炼，聚焦人类贡献者；
- 提供精确的、面向智能体的指导，与既有 README 和文档互补。

我们没有引入又一个私有格式，而是选择了一个对所有人都适用的名字与格式。如果你在构建或使用编码智能体，觉得它有用，欢迎采纳。

## 一份 AGENTS.md，通吃多个智能体

你的智能体定义兼容一个不断增长的 AI 编码工具生态，包括（摘录自官方站列表）：OpenAI 的 Codex、Google 的 Jules、Cursor、VS Code、Devin（Cognition）、JetBrains 的 Junie、Factory、Aider、goose、opencode、Zed、Warp、UiPath 等。

这份兼容性正是 AGENTS.md 的核心价值：**规范文件不绑定任何一家工具**。你写一遍，所有采纳该标准的智能体都会读取。

官方仓库 README 中给出的定位说明：

> [AGENTS.md](https://agents.md) is a simple, open format for guiding coding agents.
>
> Think of AGENTS.md as a README for agents: a dedicated, predictable place to provide context and instructions to help AI coding agents work on your project.
>
> （译：AGENTS.md 是一个指导编码智能体的简单、开放格式。把它想成"写给智能体的 README"：一个专属、可预测的位置，提供帮助 AI 编码智能体在你的项目上工作所需的上下文与指令。）

## 一个最小示例

```markdown
# Sample AGENTS.md file

## Dev environment tips
- Use `pnpm dlx turbo run where <project_name>` to jump to a package instead of scanning with `ls`.
- Run `pnpm install --filter <project_name>` to add the package to your workspace so Vite, ESLint, and TypeScript can see it.
- Use `pnpm create vite@latest <project_name> -- --template react-ts` to spin up a new React + Vite package with TypeScript checks ready.
- Check the name field inside each package's package.json to confirm the right name—skip the top-level one.

## Testing instructions
- Find the CI plan in the .github/workflows folder.
- Run `pnpm turbo run test --filter <project_name>` to run every check defined for that package.
- From the package root you can just call `pnpm test`. The commit should pass all tests before you merge.
- To focus on one step, add the Vitest pattern: `pnpm vitest run -t "<test name>"`.
- Fix any test or type errors until the whole suite is green.
- After moving files or changing imports, run `pnpm lint --filter <project_name>` to be sure ESLint and TypeScript rules still pass.
- Add or update tests for the code you change, even if nobody asked.

## PR instructions
- Title format: [<project_name>] <Title>
- Always run `pnpm lint` and `pnpm test` before committing.
```

## 如何使用 AGENTS.md？

1. **添加 AGENTS.md**：在仓库根目录创建 AGENTS.md 文件。好好跟你的编码智能体说一声，它多半还能替你生成一个初稿。
2. **覆盖关键内容**：添加能帮智能体高效工作的小节。常见选择：
   - 项目概览
   - 构建与测试命令
   - 代码风格指南
   - 测试说明
   - 安全注意事项
3. **补充额外指令**：提交信息或 PR 规范、安全陷阱、大型数据集说明、部署步骤——凡是你会告诉新同事的，这里也都该写。
4. **大型 monorepo？为子项目使用嵌套 AGENTS.md**：在每个包内再放一份 AGENTS.md。智能体会自动读取目录树中最近的那份——**离被编辑文件最近者优先生效**，每个子项目都可以携带量身定制的指令。例如撰写本文时，OpenAI 的主仓库里有 88 份 AGENTS.md 文件。

## 关于本项目

AGENTS.md 源自 AI 软件开发生态的跨厂协作，参与方包括 OpenAI Codex、Amp、Google Jules、Cursor、Factory 等。我们致力于把它作为开放格式来维护与演进，让整个开发者社区受益——无论你用哪家编码智能体。AGENTS.md 现由 Linux 基金会旗下的 Agentic AI Foundation 托管。

## FAQ（官方问答）

**有必填字段吗？**
没有。AGENTS.md 就是标准 Markdown。随便用什么标题结构，智能体只是解析你提供的文本。

**指令冲突怎么办？**
离被编辑文件最近的 AGENTS.md 获胜；用户在对话里的显式提示覆盖一切。

**智能体会自动运行 AGENTS.md 里列的测试命令吗？**
会——只要你列了。智能体会尝试执行相关的程序化检查，并在完成任务前修复失败项。

**以后能更新吗？**
当然。把 AGENTS.md 当作活文档（living documentation）对待。

**如何迁移既有文档到 AGENTS.md？**
把现有文件改名为 AGENTS.md，并建立符号链接保持向后兼容：

```bash
mv AGENT.md AGENTS.md && ln -s AGENTS.md AGENT.md
```

**Aider 怎么配置？**
在 `.aider.conf.yml` 中配置 `read: AGENTS.md`。

## 延伸阅读：Claude Code 的 CLAUDE.md 体系

> 以下译自 Anthropic《How Claude remembers your project》（Claude Code 官方文档），展示"单一厂商规范文件"与开放标准如何互通。

每个 Claude Code 会话都以全新的上下文窗口开始。有两个机制让知识跨会话延续：**CLAUDE.md 文件**（你写的持久指令）与 **Auto memory**（Claude 根据你的纠正与偏好自己记的笔记）。二者都在每次对话开始时加载。Claude 把它们当作上下文而非强制配置——要无条件阻止某个动作，应该用 PreToolUse hook。指令越具体、越简洁，Claude 遵循得越一致。

**表：CLAUDE.md 与 Auto memory 的分工**

| | CLAUDE.md 文件 | Auto memory |
| --- | --- | --- |
| 谁来写 | 你 | Claude |
| 内容 | 指令与规则 | 经验与模式 |
| 作用域 | 项目/用户/组织 | 每个仓库（worktree 间共享） |
| 加载方式 | 每个会话 | 每个会话（前 200 行或 25KB） |
| 适用 | 编码标准、工作流、项目架构 | 你的偏好、给 Claude 的纠正、代码里推不出来的项目背景 |

### 什么时候往 CLAUDE.md 里加内容？

把 CLAUDE.md 当作"否则就要反复解释"的记录处。出现这些情况就加：

- Claude 第二次犯同一个错误
- 代码审查发现 Claude 本应知道的代码库事实
- 你在对话里打的纠正话术和上个会话一模一样
- 新同事上手也需要同样的背景

只放"每个会话都该持有"的事实：构建命令、约定、项目结构、"总是做 X"类规则。多步骤流程或只关乎局部的内容，移到 skill 或路径限定规则里去。

### 放在哪里？

**表：CLAUDE.md 的位置与作用域（按加载顺序，从宽到窄）**

| 作用域 | 位置 | 用途 | 与谁共享 |
| --- | --- | --- | --- |
| 托管策略 | macOS：`/Library/Application Support/ClaudeCode/CLAUDE.md`；Linux/WSL：`/etc/claude-code/CLAUDE.md`；Windows：`C:\Program Files\ClaudeCode\CLAUDE.md` | IT/DevOps 管理的组织级指令 | 组织内所有用户 |
| 用户指令 | `~/.claude/CLAUDE.md` | 所有项目的个人偏好 | 仅自己 |
| 项目指令 | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 团队共享的项目指令，随源码版本控制 | 团队成员 |
| 本地指令 | `./CLAUDE.local.md` | 个人的项目特定偏好；应加入 `.gitignore` | 仅自己 |

Claude Code 会从当前目录向上逐级加载 CLAUDE.md/CLAUDE.local.md（越靠近工作目录的越后加载、越"新"）；子目录中的同名文件按需加载。

### 与 AGENTS.md 打通

Claude Code 读取的是 `CLAUDE.md` 而非 `AGENTS.md`。如果仓库已经用 AGENTS.md 服务其他智能体，官方建议的做法是建一份导入它的 CLAUDE.md，让两个工具读同一份指令而不重复：

```markdown
# CLAUDE.md
@AGENTS.md

## Claude Code
Use plan mode for changes under `src/billing/`.
```

不需要追加 Claude 专属内容时，符号链接亦可：

```bash
ln -s AGENTS.md CLAUDE.md
```

此外，运行 `/init` 时 Claude Code 会读取 `.cursor/rules/`、`.github/copilot-instructions.md` 等既有规则文件并入生成的 CLAUDE.md；设置 `CLAUDE_CODE_NEW_INIT=1` 后还会读取 `AGENTS.md`、`.windsurf/rules/`、`.clinerules` 等。`/import` 命令（v2.1.213+）则能把受支持智能体的配置一次性迁入。

### 排障小抄

- **Claude 不遵守 CLAUDE.md？**先运行 `/context` 确认文件真的被加载了；规则太多太长会被淹没——修剪，或把个别指令改写为 hook 强制执行。
- **文件太大？**把多步骤流程移到 skills，把局部规则移到 `.claude/rules/`（按路径限定作用域的规则文件）。
- **`/compact` 之后指令像丢了？**在 CLAUDE.md 里写明压缩时应保留哪些关键上下文。

> 译注：本站实践建议——个人项目从一份 20 行以内的 AGENTS.md 起步，只写"AI 猜不到且会反复出错"的内容；团队项目把 AGENTS.md 作为唯一事实源，CLAUDE.md 用 `@AGENTS.md` 导入。Skills（《Claude Skills：可复用技能包》）承接"多步骤流程"，Rules（《Cursor 入门与 Rules 规则系统》）承接"按路径/按需加载"，三层各司其职。

---

> **来源**：本文主体翻译自 [AGENTS.md 官方站](https://agents.md/)（与 GitHub 仓库 [openai/agents.md](https://github.com/openai/agents.md) README 同源），作者 OpenAI 等生态共建方，许可署名翻译（开放格式说明文档）；延伸阅读一节译自 Anthropic《[How Claude remembers your project](https://code.claude.com/docs/en/memory)》（Claude Code 官方文档）。抓取于 2026-09-13。
