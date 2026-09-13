---
title: Claude Skills：可复用技能包
source_url: https://code.claude.com/docs/en/skills
author: Anthropic（Claude Code 官方文档）
license: 署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 11
---

Skills 扩展 Claude 的能力。创建一个带指令的 `SKILL.md` 文件，Claude 就会把它加入自己的工具箱。Claude 会在相关时自动使用 skill，你也可以用 `/skill-name` 直接调用。

**什么时候该建 skill**：当你不断往对话里粘贴同样的指令、检查清单或多步骤流程时；当 CLAUDE.md 里的某一节已经长成"流程"而不是"事实"时。与 CLAUDE.md 内容不同，**skill 的正文只有被用到时才加载**——大段参考资料在需要之前几乎零成本。

> 注：自定义命令（custom commands）已并入 skills。`.claude/commands/deploy.md` 与 `.claude/skills/deploy/SKILL.md` 都会创建 `/deploy`，工作方式相同；你现有的 `.claude/commands/` 文件继续有效。Skills 额外提供：支持文件目录、控制"由你调用还是 Claude 自动调用"的 frontmatter、以及按相关性自动加载的能力。

Claude Code 的 skills 遵循 [Agent Skills](https://agentskills.io) 开放标准（跨多个 AI 工具通用），并做了扩展：调用控制、子智能体执行、动态上下文注入。

## 内置技能（Bundled skills）

Claude Code 自带一组内置技能，如 `/doctor`、`/code-review`、`/batch`、`/debug`、`/loop`、`/claude-api`。它们是提示词式的：给 Claude 详细指令，让它用自己的工具编排工作。

与"跑应用并验证"相关的三个内置技能配合使用：

| 技能 | 用途 |
| --- | --- |
| `/run` | 启动并驱动你的应用，看到改动真实生效 |
| `/verify` | 构建并运行应用，确认代码改动确实做到了该做的事——不允许退回到"测试通过/类型检查通过"交差 |
| `/run-skill-generator` | 教会 `/run` 和 `/verify` 如何构建并启动你的项目 |

`/run` 与 `/verify` 无需配置即可工作：它们从项目类型（CLI、服务器、TUI、浏览器）和 README/`package.json`/`Makefile` 推断启动方式。超出标准启动方式的项目（需要数据库、env 文件、图形会话、多步构建）推断会不可靠。此时用 `/run-skill-generator` **把配方记录下来**：它从干净环境把应用跑起来，捕获有效的安装命令、环境变量、启动脚本，并提交为项目级技能 `.claude/skills/run-<name>/`。此后 `/run`、`/verify` 和仓库里的其他智能体都遵循记录的配方，而不必重新摸索。构建或启动流程变了就再跑一次。

## 上手：创建你的第一个技能

本例创建一个总结 git 未提交改动并标记风险点的技能。它在 Claude 读取提示词之前就把实时 diff 注入进来，让回答基于你的真实工作区而不是猜测。当你问"我改了什么"时 Claude 会自动加载它，你也可以直接 `/summarize-changes` 调用。

1. **创建技能目录**（个人技能在所有项目可用）：

```bash
mkdir -p ~/.claude/skills/summarize-changes
```

2. **写 SKILL.md**（frontmatter 告诉 Claude 何时用它；正文是执行时遵循的指令；目录名就是你输入的命令；`description` 帮 Claude 判断何时自动加载）。保存到 `~/.claude/skills/summarize-changes/SKILL.md`：

```yaml
---
description: Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.
---

## Current changes

!`git diff HEAD`

## Instructions

Summarize the changes above in two or three bullet points, then list any risks you notice such as missing error handling, hardcoded values, or tests that need updating. If the diff is empty, say there are no uncommitted changes.
```

其中 `` !`git diff HEAD` `` 用到**动态上下文注入**：Claude Code 先运行该命令，把这一行替换为输出，再让 Claude 看到技能内容——指令到达时当前 diff 已经内联在其中。

3. **测试技能**：打开一个 git 项目，做点小改动，运行 `claude`。两种方式验证：问一句 "What did I change?"（匹配 description，自动触发）；或直接输入 `/summarize-changes`。

## 技能放在哪里

保存位置决定哪些会话能加载它：

**表：技能位置与加载范围**

| 位置 | 路径 | 加载范围 |
| --- | --- | --- |
| 企业级 | 托管设置目录中的 `.claude/skills/<skill-name>/SKILL.md` | 组织部署覆盖的所有用户 |
| 个人级 | `~/.claude/skills/<skill-name>/SKILL.md` | 本机所有项目（Cowork/云会话除外） |
| 项目级 | `.claude/skills/<skill-name>/SKILL.md` | 本仓库的会话；提交进版本库团队共享 |
| 嵌套 | `<subdir>/.claude/skills/<skill-name>/SKILL.md` | 在 `<subdir>` 内或以下启动的会话 |
| 附加目录 | `--add-dir` 传入目录中的 `.claude/skills/…` | 当前会话 |
| 插件 | `<plugin>/skills/<skill-name>/SKILL.md` | 插件启用之处，命令为 `/plugin-name:skill-name` |

monorepo 场景：Claude Code 会从启动目录及其所有父目录（直至仓库根）加载项目技能——在 `packages/frontend/` 启动仍会拿到根目录的技能；启动目录**之下**的嵌套技能则在 Claude 首次读写该子目录文件时按需加载。同名的根技能与嵌套技能会同时可用：`/deploy` 跑根技能，`/apps/web:deploy` 跑嵌套技能。

**同名冲突的解析**：企业级 > 个人级 > 项目级；你的技能会顶替同名内置技能（但不顶替它的别名）；技能 > `.claude/commands/` 旧格式文件；插件技能带命名空间，不冲突。

**会话内热更新**：Claude Code 会监视技能目录的文件变化——在会话中增删改技能，无需重启即可生效（仅限 `SKILL.md` 文本）。

**删除技能**：个人/项目技能直接删除其目录；插件技能经 `/plugin uninstall` 卸载；内置技能用 `disableBundledSkills` 设置关闭。

## 配置技能

### 两类技能内容

- **参考型（Reference）**：给 Claude 增加应用于当前工作的知识——约定、模式、风格指南、领域知识。内联运行，与对话上下文并用：

```yaml
---
name: api-conventions
description: API design patterns for this codebase
---

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
- Include request validation
```

- **任务型（Task）**：给 Claude 特定动作的分步指令——部署、提交、代码生成。通常你希望直接 `/skill-name` 调用而不是让 Claude 自行决定，加 `disable-model-invocation: true` 禁止自动触发。下例还加了 `context: fork`，让技能在自己的子智能体上下文中运行：

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

正文务必精炼：技能加载后其内容会跨轮次驻留上下文，每一行都是持续的 token 开销。写"做什么"而不是叙述"怎么做、为什么"，用与 CLAUDE.md 同样的精简标准。

### Frontmatter 参考

所有字段可选，仅 `description` 为推荐必写（Claude 靠它判断何时使用技能；注意 description 与 when_to_use 合计在技能列表中被截断到 1536 字符——把关键用例写在前面）。

**表：SKILL.md 常用 frontmatter 字段（节选）**

| 字段 | 说明 |
| --- | --- |
| `name` | 列表中的显示名，默认取目录名 |
| `description` | 技能做什么、何时使用；Claude 据此决定是否自动应用 |
| `when_to_use` | 补充触发短语/示例请求，并入 description 计入截断上限 |
| `argument-hint` | 自动补全时的参数提示，如 `[issue-number]` |
| `arguments` | 具名位置参数，供正文中 `$name` 替换 |
| `disable-model-invocation` | `true` 时禁止 Claude 自动加载，仅供手动 `/name` 调用 |
| `user-invocable` | `false` 时仅 Claude 可调用（从 `/` 菜单隐藏） |
| `allowed-tools` | 技能激活轮次内免确认可用的工具；下一条消息发出即收回 |
| `disallowed-tools` | 技能激活期间从可用池移除的工具 |
| `model` / `effort` | 技能激活时使用的模型 / 思考力度档位 |
| `context: fork` | 在分叉的子智能体上下文中运行；`agent` 指定子智能体类型；`background` 控制是否后台 |
| `paths` | glob 模式限定技能仅在处理匹配文件时自动激活 |
| `hooks` | 技能调用时注册、本会话内持续的钩子 |

### 字符串替换

技能正文支持动态值替换：`$ARGUMENTS`（全部参数）、`$0`/`$1`（按位置的索引参数，shell 式引号规则）、`$name`（frontmatter `arguments` 声明的具名参数）、`${CLAUDE_SESSION_ID}`（会话 ID）、`${CLAUDE_SKILL_DIR}`（技能目录）、`${CLAUDE_PROJECT_DIR}`（项目根）等。一个实用的组合模式——让技能免确认运行自带脚本：

```yaml
---
name: render-chart
description: Render a chart from a CSV file
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)
---

Run `${CLAUDE_SKILL_DIR}/scripts/render.sh <csv-file>` to render the chart.
```

`allowed-tools` 规则与正文指向同一个经替换的精确命令，脚本因此无需弹窗即可运行。

### 添加支持文件

技能目录可以包含多个文件，让 `SKILL.md` 聚焦主干，详细参考资料按需加载：

```text
my-skill/
├── SKILL.md (required - overview and navigation)
├── reference.md (detailed API docs - loaded when needed)
├── examples.md (usage examples - loaded when needed)
└── scripts/
    └── helper.py (utility script - executed, not loaded)
```

在 `SKILL.md` 里引用这些支持文件，Claude 才知道各文件是什么、何时加载：

```markdown
## Additional resources

- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

**建议 SKILL.md 控制在 500 行以内**，详细参考材料移到单独文件。

## 控制谁可以调用

默认你和 Claude 都能调用任何技能。两个 frontmatter 字段收窄这一点：

- `disable-model-invocation: true`：只许你手动 `/name` 调用（有副作用的工作流适用）。
- `user-invocable: false`：只许 Claude 自动调用（从 `/` 菜单隐藏，适合背景知识类技能）。

不想改文件时，也可用 `skillOverrides` 设置（如 `"doctor": "off"` 或 `"user-invocable-only"`）从设置层面覆盖可见性。

## 排障

- **技能没触发**：检查 `description` 是否覆盖了用户的问法——Claude 靠它匹配相关性；用 `/context` 看技能列表。
- **触发太频繁**：收紧 description，或加 `disable-model-invocation: true` 改为手动。
- **描述被截断**：description 与 when_to_use 合计上限 1536 字符，把关键用例放最前面。

## 与 AGENTS.md / Rules 的分工

把三者放进一张图：**CLAUDE.md/AGENTS.md 放"每次会话都要在"的事实与规则**（常驻、最小化）；**Rules/paths 放"处理特定文件才需要"的规则**（按路径挂载）；**Skills 放"多步骤流程与大段参考资料"**（按需加载、可带脚本与支持文件、可 fork 到子智能体）。三者都是"写给智能体的项目知识"，差别只在加载时机与成本模型——选型的判据永远是上下文经济学。

> 译注：Agent Skills 开放标准（agentskills.io）意味着 SKILL.md 格式不限于 Claude Code——Cursor 也已提供 Skills 支持（见第 8 篇文档结构），生态正在收敛。

---

> **来源**：本文翻译自 [Extend Claude with skills](https://code.claude.com/docs/en/skills)，作者 Anthropic（Claude Code 官方文档），许可署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途翻译并署名）。抓取于 2026-09-13。篇幅所限，claude.ai 同步技能与插件打包的少量实现细节从略（原文可查）。
