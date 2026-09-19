---
title: "Subagents 与并行会话：把探索外包出去"
source_url: https://code.claude.com/docs/en/sub-agents
author: Anthropic（Claude Code 官方文档 Create custom subagents、Run agents in parallel、Run parallel sessions with worktrees）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途翻译并署名；编者补充部分已标明）
fetched_at: 2026-09-19
translated: true
order: 12
group: 多智能体与自动化
---
《心智模型：LLM 如何"看"你的代码》里说过：**上下文窗口是稀缺资源**。最浪费它的行为之一，是让主会话自己去全仓搜索——上百次文件读取的结果涌进对话，而你之后只会用到其中两三句结论。解决办法有两条路：**委派**（派一个子智能体去查，只把摘要带回来）与**并行**（多个会话各干一件事，别互相踩文件）。这两条路的边界、配置和坑，就是本篇的内容。

先给结论式的地图，因为 Claude Code 在这件事上有**五种**能力，名字还都很像：

| 能力 | 它给你什么 | 什么时候用 |
| --- | --- | --- |
| **Subagents（子智能体）** | 在**同一个会话内**委派出拥有独立上下文的工人，只返回摘要 | 一个旁支任务会把搜索结果、日志、文件内容灌进主对话，而这些你之后不会再引用 |
| **Agent view（后台智能体）** | `claude agents` 一屏派发并监控后台会话。研究预览 | 有好几件互不相关的事，想甩出去、瞄一眼状态、只在需要时介入 |
| **Agent teams（智能体编队）** | 多个协同会话 + 共享任务列表 + 智能体之间互相发消息，由 lead 管理。实验特性、默认关闭 | 你要 Claude 自己把项目拆开、分派并让工人保持同步（详见《多智能体协作编码》） |
| **Dynamic workflows（动态工作流）** | 一段脚本驱动大量子智能体并交叉验证它们的结论 | 活儿超出"几个子智能体"的规模，或需要多轮互查：全仓审计、500 文件迁移 |
| **Projects（项目）** | claude.ai/code 或桌面端里的长期会话，云端并行 threads，机器关了也继续跑。Pro/Max 公测 | 工作跨天跨周、希望只描述一次而不是每轮都派发 |

三个**辅助**能力，它们本身不是"运行智能体的方式"：**Worktrees** 给每个会话一份独立检出（隔离文件编辑）；**Cross-session messaging** 让你自己跑的会话之间互传结论；**`/batch`** 是一个技能，让 Claude 把一个大改动切成 5–30 个 worktree 隔离的子智能体、各开一个 PR。

判断顺序官方也写明了，就三个问题：**谁在协调？**（Claude 在会话内委派 → 子智能体；你自己交出去回头看 → agent view；Claude 规划分派监督 → agent teams；计划写在脚本里 → 动态工作流）**工人之间要不要通信？**（子智能体只向派出它的会话汇报；agent view 的会话只向你汇报；编队里的队友能互发消息并共享任务列表）**任务会不会碰同一批文件？**（会就用 worktree 隔离；注意 agent teams **不会**自动为队友隔离 worktree，得自己按文件分区。）

## 一、子智能体：一个 Markdown 文件定义一个专家

*本节译自 [Create custom subagents](https://code.claude.com/docs/en/sub-agents)。*

子智能体运行在**自己的上下文窗口**里，有自己的系统提示、工具集与独立权限。Claude 遇到与某个 `description` 匹配的任务就会委派过去，它独立完成后把结果返回主对话。它解决五件事：**保上下文、上约束（限制能用哪些工具）、跨项目复用、按领域特化行为、控成本（把活儿路由给更快更便宜的模型）**。

### 内置的三个

Claude Code 自带若干会被自动使用的子智能体，都继承父会话权限、多数工具受限。**Explore** 是只读的搜索/分析智能体（`Write`、`Edit` 被拒），模型继承主会话但在 Anthropic API 上**封顶在 Opus**，也就是说它不会比你在主会话选定的模型更贵；v2.1.198 起它从"永远跑 Haiku"改成继承主会话模型。**Plan** 是 plan 模式期间做调研的研究智能体，同样只读。这两个都**跳过你的 `CLAUDE.md` 与父会话 git 状态**，以保持快与省；其余内置子智能体与所有自定义子智能体默认会加载两者，除非在定义里设 `omitClaudeMd`。想让探索跑在便宜模型上，就建一个**同名** `Explore` 的用户/项目子智能体并写 `model: haiku`——同名定义会覆盖内置并保留自己的 `model` 字段。

### 作用域：文件放哪决定谁能见

| 位置 | 作用域 | 优先级 |
| --- | --- | --- |
| 托管设置（managed settings） | 全组织 | 1（最高） |
| `--agents` 命令行旗标 | 当前会话（JSON 传入，不落盘） | 2 |
| `.claude/agents/` | 当前项目 | 3 |
| `~/.claude/agents/` | 你的所有项目 | 4 |
| 插件的 `agents/` 目录 | 启用该插件之处 | 5（最低） |

同名时高优先级作用域胜出。项目级子智能体**从当前工作目录向上逐级发现**，路径上每个 `.claude/agents/` 都会被扫描；v2.1.178 起，若多个嵌套目录都定义了同一个 `name`，**离工作目录最近的那个**胜出。`.claude/agents/` 与 `~/.claude/agents/` 会被**递归扫描**，可以用 `agents/review/`、`agents/research/` 组织——子目录路径不影响识别，身份只来自 `name` 字段。建议把项目子智能体**提交进版本库**，让团队一起改进它。

### 文件与字段

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

只有 `name` 与 `description` 必填。要点：

- **`description` 就是路由表**：Claude 靠它决定要不要委派，所以要写"什么时候该用它"。但**所有子智能体的 description 合起来会占上下文**——除内置外的自定义 description 合计超过 **15,000 token**，Claude Code 会在启动时给出带总 token 数的警告。把细节挪进系统提示正文（它只在该子智能体真正运行时才加载）。
- **`tools` 省略即继承**所有可用工具；`disallowedTools` 做减法。注意带限定符的条目（`Bash(git push *)`）**仍然会移除整个工具**。若列表里一个都解析不出可用工具，子智能体通常直接启动失败并点名这些条目。
- **`model`** 可写 `sonnet`/`opus`/`haiku`/`fable`、完整模型 id（如 `claude-opus-5`）或 `inherit`。**省略时由 Claude Code 按"子智能体模型顺序"挑**，而不是继承你现在这个最贵的会话模型——`openai/codex` 的同节建议与此一致：派子智能体时**永远显式指定模型**。
- **`permissionMode`**、**`maxTurns`**（到上限后返回标记为 partial 的输出，可以 resume 继续）等字段控制行为；插件子智能体忽略 `permissionMode`。
- **子智能体只拿到这段系统提示 + 基本环境（工作目录）**，拿不到 Claude Code 的系统提示，也看不到你的对话历史、已调用的技能、已经读过的文件。Claude 会自己组织一段"任务摘要"作为交接。
- 改动**几分钟内被自动侦测**（目录被 watch），无需重启。三种情况例外：某个作用域下**第一个** agent 文件新建在原本不存在的 `agents/` 目录里；`--add-dir` 加进来的目录不被 watch；用 `--disable-slash-commands` 启动的会话根本不 watch。
- 非交互模式下还有 `--append-subagent-system-prompt`（把文本追加到**每个**子智能体系统提示末尾，含嵌套的；v2.1.205+），太长可用 `--append-subagent-system-prompt-file`（v2.1.261+）。

## 二、两个限制：并发数与嵌套深度

这是两个独立开关，容易混。

**嵌套深度**：默认允许子智能体再生子智能体，**主会话之下最多三层**。到顶之后，除 fork 之外所有子智能体的 `Agent` 工具会被收走——它只能自己做委派工作并返回一份摘要；fork 到顶仍保留 `Agent`，但调用会报错而不是派出新智能体。改法：

```json
{
  "env": {
    "CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH": "2"
  }
}
```

设 `1` 就关掉嵌套。历史上这个默认值改过三次：v2.1.172–v2.1.216 默认可嵌套五层且不可改；v2.1.217–v2.1.218 默认降到 1；v2.1.219 起抬到 3。**要某个子智能体无论如何都不派生（比如评审者应当保持只读），就从它的 `tools` 里去掉 `Agent` 或写进 `disallowedTools`。**嵌套子智能体在提示框下方的面板里以树形展示，有后代的行标 `(+N)`。

**并发数**：默认**同时有 20 个**子智能体在跑时，再用 `Agent` 工具派生会失败并返回 `Concurrent subagent limit reached`，且错误明确告诉模型**不要重试**；在跑数量降下来后自动恢复。改法：`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`（v2.1.217+）。会话开着 ultracode 时不强制该上限。注意两点：`/subtask` 起的 in-session fork 会占一个槽但**永远不会被这个上限拦住**；**resume 一个已完成的子智能体会无条件占一个新槽**，所以恢复操作可以把在跑数量推过上限。工作流智能体与编队队友走各自的限制。

**没有"整场会话最多派生多少子智能体"的限制**——限制的是同时在跑的数量。

## 三、fork：唯一"继承上下文"的子智能体

普通的隔离是子智能体的立命之本，但有时成本太高——为了不重复解释现状，你要一个**继承整段对话**的分身。这就是 fork：它看到相同的系统提示、工具、模型与消息历史，而**它自己的工具调用仍然留在你的对话之外**，只有最终结果回来，所以主上下文依然干净。

- 用 `/subtask <任务>` 自己起一个（需 v2.1.212+；v2.1.161–v2.1.211 上这条命令叫 `/fork`）。它跑在后台，出现在提示框下方的面板里（一行主会话、每个 fork 一行），完成后结果作为一条消息进主对话。典型用法：**你在主会话继续实现，让它并行去起草测试**——`/subtask draft unit tests for the parser changes so far`。
- 想从同一份起点并行试多个方案，fork 是最省事的：不必为每条路线重述背景。
- 关掉 agent view 时 `/subtask` 不可用，`/fork` 变成起 fork 的命令；agent view 开着时 `/fork` 是把**整个会话**复制成一个新的后台会话。
- 交互会话里，**只有顶层子智能体的摘要会回到你这里**，中间产出留在外面；派生了后台子智能体的那个子智能体会等它们的结果再收尾。但在非交互模式与 Agent SDK 下，**派生者不会等**——一个在派生者结束后才完成的嵌套后台子智能体会直接向主会话汇报。
- fork 是**显式**控制手段：`--append-subagent-system-prompt` 会应用到嵌套子智能体，但**fork 除外**，它复用会话自己的提示。

## 四、并行会话：worktree 才是隔离文件的东西

*本节译自 [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)。*

子智能体隔离的是**上下文**，worktree 隔离的是**文件**。git worktree 是一个独立的工作目录 + 独立分支，但共享同一份仓库历史与远端。

```bash
claude --worktree feature-auth
```

它在仓库根的 `.claude/worktrees/<name>/` 建工作树、开一条新分支 `worktree-<name>`；**在另一个终端换个名字再跑一次**，你就有了第二个隔离会话。不给名字就自动生成（形如 `bright-running-fox`）。几条必须知道的约束：

- **交互运行需要 workspace trust**：没在该目录跑过的话，`--worktree` 会报错让你先运行一次 `claude` 接受信任对话框。`-p` 非交互运行会跳过这个检查。
- **把 `.claude/worktrees/` 加进 `.gitignore`**，否则工作树内容会以未跟踪文件出现在主检出里。
- **工作树是全新检出**：依赖要重装（让 Claude 装，或自己在 `.claude/worktrees/<name>/` 里跑）。要把 `.env` 这类被 git 忽略的文件带进每个新工作树，用 `.worktreeinclude`。
- **仓库必须至少有一次提交**：在没有提交的仓库里，该命令会报 `Failed to resolve base branch "HEAD": git rev-parse failed`。
- **清理在会话退出时发生**；子智能体与后台会话的工作树也有各自的清理路径。
- 需要换基线分支、从某个 PR 分叉、或**用 hook 完全接管工作树创建**（`WorktreeCreate` 事件），见该文档的 Customize 一节。非 git 版本控制系统则要靠 hooks 替换掉 git 逻辑。
- 想在一块屏上监督多个并行会话而不是开多个终端，用 **agent view**（`claude agents`）；桌面应用里也可以在启动会话时勾选 worktree。

**子智能体也能隔离**：在定义里写 `isolation: worktree`，它的 Bash/PowerShell 命令就在自己的 worktree 里跑。Claude Code 会检查工作目录——若某条命令的工作目录解析回了主检出（例如运行期间工作树被删），该命令**直接报错**而不是悄悄改到主检出（v2.1.203 之前存在这种风险）。对 Bash 命令还有第二重检查：**阻止把 git 操作重定向回主检出的命令**；当它无法从命令文本确认 git 会留在工作树内（比如命令名是运行时算出来的）时，**拒绝执行该命令**。PowerShell 命令只有工作目录这一重检查。

## 五、`/agents` 已经不是面板了

*编者注（已标明）：这是新手最容易踩空的一处文档落差。*

截至 v2.1.198，**`/agents` 不再打开管理面板**，它只打印一条指向子智能体文件位置的提示。**创建和编辑自定义子智能体要么直接问 Claude、要么自己编辑文件。**检查在跑的东西用不同的命令：后台会话看 `claude agents`（agent view）；当前会话的子智能体状态出现在 @-mention 补全里；后台运行的东西用 `/tasks` 列（可查看、附加、停止，也包含已完成的子智能体）；动态工作流看 `/workflows`。名字都带 "agent"，但**没有一个是"配置界面"**——这套东西已经完全文件化了，这既是好事（可评审、可回滚、可 diff），也是初学时的困惑来源。

## 六、常见坑与实践建议

1. **description 写得太长**。它决定路由，也常驻上下文。15,000 token 的警告不是摆设；一个仓库里塞二十个描述啰嗦的子智能体，等于每轮都在交租金。
2. **不给 `model`，以为会"便宜的默认"**。省略时 Claude Code 按子智能体模型顺序挑，可能挑到你没预期的档位。**显式写 `model` 是可预算化的前提**，批量派发时尤其重要。
3. **以为 hook/规则会继承**。子智能体有**独立权限**；`tools`/`disallowedTools` 是每个定义自己的事。要给评审者"只读"，就把 `Write`/`Edit` 排除掉，别指望父会话的模式自动生效。
4. **拿子智能体做需要连续澄清的活**。它看不到你的对话历史，也不能像你一样回头问；委派语要**自包含**——这正是《开源编码 Skills（一）：Superpowers 编码流程族》里 `dispatching-parallel-agents` 强调"聚焦、自包含、对输出具体"的原因。
5. **并行不等于免费**。官方直接提醒：同时跑多个会话或子智能体会**成倍放大 token 消耗**（详见《成本管理：Token 消耗、订阅选择与用量优化》）。20 个并发子智能体跑在最贵档位上，一次会话就能吃掉整天的预算。
6. **别用并行掩盖拆解问题**。如果两个"并行任务"要频繁互相知会，那它们其实是一个任务，拆开只会制造合并冲突——按文件分区（或用 worktree）再并行。
7. **非交互模式下的等待语义变了**（嵌套后台子智能体会向主会话汇报）。在 CI 里用嵌套委派前，先在本地 `-p` 跑一遍确认输出形状。

## 延伸阅读

- 《多智能体协作编码》：agent teams 的完整机制与适用判据。
- 《开源编码 Skills（一）：Superpowers 编码流程族》：`subagent-driven-development` 与 `dispatching-parallel-agents` 把委派做成一整套带评审的流水线。
- 《Claude Code Hooks：用确定性脚本守住智能体循环》：`SubagentStart`/`SubagentStop` 事件可做成本与策略闸门。
- 《大型与遗留代码库上的 AI 落地策略》：稀疏检出、`additionalDirectories` 与分层规范在大型仓库里的用法。
- 《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》：另一家的子智能体（协议层 `SubAgentSource`）与技能编排写法。

---

> **来源**：本文第一至四节译自 Claude Code 官方文档（Copyright Anthropic PBC，教学用途署名翻译）：[Create custom subagents](https://code.claude.com/docs/en/sub-agents)（内置子智能体、作用域优先级、frontmatter 字段、嵌套深度与并发上限、fork）、[Run agents in parallel](https://code.claude.com/docs/en/agents)（五种并行能力的对照与选择判据）、[Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees)（`--worktree`、隔离强制规则、`.worktreeinclude`、清理）。开头的能力对照表与判断顺序译自 `agents` 页原文，模型成本提示取自该页 Note。第五节"`/agents` 已不是面板"、第六节坑与实践建议、以及各处衔接语为本站编者补充并已标明；子智能体模型选择的建议同时参考了 [openai/codex](https://github.com/openai/codex)（Apache-2.0）中 `subagent-driven-development` 类实践与官方发布说明。抓取于 2026-09-19。
