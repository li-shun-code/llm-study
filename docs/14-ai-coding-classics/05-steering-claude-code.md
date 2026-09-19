---
title: 驾驭 Claude Code：CLAUDE.md、rules、skills、hooks 与子智能体的使用时机（Anthropic 官方博客全文翻译）
source_url: https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more
author: Anthropic（官方博客，作者 Michael Segner）
license: 署名翻译（官方博客 Copyright Anthropic PBC，教学用途全文翻译并署名）
fetched_at: 2026-09-19
translated: true
order: 5
group: 官方最佳实践
---
**编者按**：本篇是 Anthropic 官方团队 2026 年 6 月 18 日发布的 Claude Code 配置方法论原文全文翻译，讲的是同一件事的官方答案：**你写给 Claude 的每一条指令，应该放在哪里**。它的判据只有三条——什么时候进上下文、长对话被压缩时会不会丢、占多少 token。全文翻译，未删节知识章节；文末两节为本站编者补充并已标明。

## 正文（Anthropic 官方博客全文翻译）

*以下译自 [Steering Claude Code: when to use CLAUDE.md, skills, hooks, and subagents](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)（2026-06-18）。*

Claude 就是按你的工作方式构建的，而在 Claude Code 里你可以进一步定制它。

一共有**七种方法**用于指示 Claude 的行为：CLAUDE.md 文件、rules（规则）、[**skills**](https://code.claude.com/docs/en/skills)（技能）、[**subagents**](https://code.claude.com/docs/en/sub-agents)（子智能体）、[**hooks**](https://code.claude.com/docs/en/hooks-guide)（钩子）、output styles（输出风格），以及追加系统提示词（appending the system prompt）。

每种方法都控制着三件事：

- 一条指令**什么时候**被加载进上下文；
- 它能否在长会话中**存活下来**（压缩行为，compaction behavior）；以及
- 它携带**多大的权威**。

下表给出各方法关键差异的快速概览，正文随后展开细节，并给出"你的每条 Claude 指令该归到哪儿"的决策框架。

**表：七种指令方式的差异对照（原文表格全译）**

| 方法 | 何时加载 | 压缩行为 | 上下文成本 | 何时使用 |
| --- | --- | --- | --- | --- |
| CLAUDE.md（根目录） | 会话开始时加载，并整场会话常驻上下文 | 记忆化（memoized）。读一次并缓存供本次会话使用；压缩后清缓存并重读 | 高。每一行都花 token，无论是否与当前任务相关 | 构建命令、目录布局、monorepo 结构、编码规范、团队约定 |
| CLAUDE.md（子目录） | 按需：当 Claude 读取该子目录下的文件时 | 在再次触碰到该子目录之前会丢失 | 低。只有在做相关子目录的工作时才消耗上下文 | 某个子目录特有的约定 |
| Rules | 会话开始时（用户级规则），或仅当匹配的文件被触碰时（路径作用域） | 压缩时重新注入 | 中。除非是路径作用域，否则始终加载 | 具体的约束或约定（例如：所有 API 处理器必须用 Zod 校验输入） |
| Skills | 会话开始时只加载名称与描述；完整正文在技能被调用时加载 | 已调用的技能按共享预算重新注入；最早的先被丢弃 | 低。完整正文只在被调用时加载，且受"所有已调用技能共享"的 token 预算约束 | 流程化工作（部署、发布检查清单） |
| Subagents | 会话开始时加载名称、描述与工具列表；正文只在通过 Agent 工具被调用时加载 | 只有最终消息（摘要加元数据）返回主会话 | 低。主上下文零成本，直到被调用；它运行在自己隔离的上下文窗口里 | 并行推进的工作，或那些应当隔离运行、只回传摘要的旁支任务（深度检索、日志分析、依赖审计） |
| Hooks | 在生命周期事件上触发 | 完全绕开压缩 | 低。配置不在主上下文里；部分输出可能返回（例如拦截报错） | 确定性自动化：跑 linter、完成时发 Slack、拦截命令、PreCompact 时备份聊天记录 |
| Output styles | 会话开始时注入到系统提示词中 | 永不压缩 | 高。占据上下文窗口，并且会**覆盖**默认系统提示词 | 重大角色变化（从代码助手变成通用助手） |
| 追加系统提示词 | 会话开始时，作为 CLI 旗标传入 | 永不压缩；且只对当次调用生效 | 中。会话首个请求之后会被缓存 | 语气、回复长度、格式偏好 |

### 交付指令的七种方法

定制 Claude Code 行为有七种方式：CLAUDE.md 文件负责常驻的项目上下文，rules 负责硬约束，skills 负责可复用的流程，subagents 负责委派出去的工作，hooks 负责确定性自动化，output styles 或系统提示词追加则用于全局性改动。

每种方法都在**上下文成本**与**权威程度**之间做取舍。这些方式影响的是 Claude 的**行为**；另有两只独立的旋钮——[你选择的模型与 effort 档位](https://claude.com/blog/claude-model-and-effort-level-in-claude-code)——控制它**有多能干**以及**有多卖力**。

#### CLAUDE.md 文件

CLAUDE.md 是放在项目根目录的 Markdown 文件。它在会话开始时加载，并整场会话留在上下文里。

构建命令、目录布局、monorepo 结构、编码规范与团队约定，天然都归这里。

它有两类，加载方式不同：

- **始终加载**：第一类是根目录的 CLAUDE.md——可以是共享仓库里的那一份，和/或本地保存的、针对该项目的个人偏好。这些文件全部在会话开始时加载，不会在长会话中丢失或退化。当 Claude Code 压缩对话时，会重新读取它们。
- **按需加载**：第二类是你初始化会话所在目录之下各子目录里的 CLAUDE.md。例如 `app/api/CLAUDE.md` 是在 Claude 读取 `app/api` 下的文件时才加载，而不是在会话开始时。它的压缩行为与路径作用域规则相同：在那个目录再次被触碰之前，它就没了。

（原文配图说明：位于当前工作目录之下的所有子目录 CLAUDE.md，都会在 Claude 读取该目录内某个文件时加载。）

在共享仓库里，CLAUDE.md 会像任何"没有归属人"的配置文件那样生长：每个团队往里加自己的指令，谁都不删。这个成本在规模化时会不断累加。

它的每一行都会加载进**每一次会话、每一位在这个仓库里工作的工程师**的上下文，无论是否与他们的任务相关。这既消耗 token，也**稀释**了对真正重要指令的遵循度。文件越长，就越应该把团队专属的约定推到路径作用域规则里、把流程推到 skills 里——它们只在相关时才加载。

> **提示**：把 CLAUDE.md 控制在 200 行以内，给它指定一个 owner，并像评审代码一样评审它的改动。内容本身应当遵守和任何提示词一样的规则：[写出有效提示词](https://claude.com/blog/best-practices-for-prompt-engineering)意味着明确、解释约束背后的原因、给出示例。

把这个文件当成"给 Claude 的一份代码库总览"，或者当成一个**索引**，指向其他文件，让 Claude 在需要时自己去查更多信息。

在 monorepo 里，给每个团队的目录各自一份子目录 CLAUDE.md，这样各团队只加载自己的约定；开发者还可以用 `claudeMdExcludes` 设置跳过那些自己从不碰的团队的文件。

对于那些必须适用于组织内**每一个**仓库的标准——安全策略、合规要求——可以通过 MDM 或配置管理把一份集中管理的 CLAUDE.md 下发到开发者机器上，而且它**不能被个人设置排除掉**。

关于如何配置 CLAUDE.md，见我们另一篇博文 [CLAUDE.md files: Customizing Claude Code for your codebase](https://claude.com/blog/using-claude-md-files)。

#### Rules

[**Rules**](https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/) 是放在 `.claude/rules/` 目录下的 Markdown 文件，用来给 Claude 具体的约束或约定。

**未加作用域**的规则表现得像 CLAUDE.md：会话开始时始终加载，压缩时重新注入。这会因为把与当前任务无关的上下文也加载进来而浪费 token。

**路径作用域**的规则则允许你通过一个 `paths` 字段控制加载时机，只在相关时把规则指令装进上下文。

举例：一条作用域限定在 `src/api/**` 的规则，在只做文档的会话里根本不进上下文；只有当 Claude 读取 `src/api/` 目录下的文件时它才会被加载。长这样：

```yaml
---
paths:
  - "src/api/**"
  - "**/*.handler.ts"
---
All API handlers must validate input with Zod before processing.
```

（译：所有 API 处理器在处理之前必须用 Zod 校验输入。）

> **提示**：像"迁移文件只增不改"这类针对特定文件的约束，最适合作为一条**规则**放进它的 `paths` frontmatter 里。当某条指令关乎的是**横切关注点**、或在代码库多个（但不是全部）角落都会出现的文件时，优先选路径作用域规则，而不是嵌套的 CLAUDE.md 文件。

#### Skills

[**Skills**](https://code.claude.com/docs/en/skills)（技能）住在 `.claude/skills/` 目录下，每个技能是一个文件夹，装着指令、脚本与资源，由 Claude 动态加载。每个技能有一个 `SKILL.md` 文件，含名称、描述与正文。

会话开始时只有名称和描述加载；完整正文在 Claude **调用**该技能时才加载——要么通过斜杠命令（`/code-review`），要么通过任务自动匹配。

（原文配图说明：技能由你的系统提示词触发。）

举例来说，`/code-review` 就是一个内置技能：它审查你当前的 diff 并报告发现，但不编辑文件。技能把这套打法（playbook）定义下来，于是每次你调用它，Claude 都按同一个结构化方式来。

在压缩时，Claude Code 会按"所有已调用技能合计的一个总预算"重新注入技能；如果一次会话里调用了很多技能，**最早的会先被丢掉**。

> **提示**：流程性的指令——部署工作流、发布检查清单、评审流程——属于技能，而不是 CLAUDE.md。

Claude Code 自带若干技能，你也可以写自己的。我们的 [Claude 技能构建完全指南](https://claude.com/blog/complete-guide-to-building-skills-for-claude)会教你怎么做。

#### Subagents

[**Subagents**](https://code.claude.com/docs/en/sub-agents)（子智能体）是 `.claude/agents/` 目录下的 Markdown 文件，为特定的旁支任务定义隔离的助手。每个文件用 YAML frontmatter（name、description，以及可选的 model 与工具访问字段），其后紧跟的正文成为该子智能体的系统提示词。

子智能体与技能相似的地方在于：名称、描述和工具列表在会话开始时加载；但智能体正文里那更大的上下文**不会自动调用**。Claude 通过 Agent 工具调用它们，传入一个提示词字符串。

（原文配图说明：Claude Code 的上下文窗口装着 Claude 关于你这次会话的全部所知。[这个交互式时间线](https://code.claude.com/docs/en/context-window)会逐项演示"什么在什么时候加载"。）

不仅正文里那更大的指令性上下文不会自动加载——它**根本不会进入父对话**。

随后子智能体在一个全新的、属于自己的上下文窗口里运行，返回给你主会话的只有它的**最终消息**（往往是许多子任务聚合后的结果）加元数据。

这个模式可以规模化：子智能体最多可嵌套**五层**，而[动态工作流](https://claude.com/blog/a-harness-for-every-task-dynamic-workflows-in-claude-code)可以编排数十到数百个后台智能体，无需你逐条指定子智能体架构。编排计划与中间结果住在脚本变量里，而不是 Claude 的上下文窗口里——正是这一点让规模化的同时不丢失指令保真度。

> **提示**：这种隔离，正是你选子智能体而不是选技能的主要理由之一。当某个旁支任务——深度检索、一轮日志分析、一次依赖审计——会把你主对话里塞满你不会再引用的中间结果时，用子智能体。当你希望流程**在主线程里展开**、好让你看见并引导每一步时，用技能。

#### Hooks

[**Hooks**](https://code.claude.com/docs/en/hooks-guide)（钩子）是用户自定义的命令、HTTP 端点或 LLM 提示词，通过在 [Claude 生命周期中的特定事件](https://code.claude.com/docs/en/hooks#hook-lifecycle)（文件编辑、工具调用、会话开始等）上触发，对 Claude 的行为提供更**确定**的控制。

（原文配图说明：一张地图，标出一次 Claude Code 会话中钩子可以在哪些事件上触发。）

你在 `settings.json`、managed policy settings（托管策略设置），或技能/智能体的 frontmatter 里注册钩子。

钩子有若干类型：command、HTTP、`mcp_tool`、prompt 和 agent。**所有钩子都是确定性地触发的**：前三种确定性地执行；后两种（prompt 与 agent）使用 Claude 的判断而非一组规则来决定输出。

钩子的上下文成本很低，因为配置或指令住在主上下文窗口之外。具体由 harness 来运行处理程序（command、http、`mcp_tool`），或按钩子类型用**独立窗口**发起模型调用（prompt、agent）。

某些钩子的输出会被保存进主上下文窗口。例如，一个**拦截型**钩子的标准错误会被写进上下文，好让 Claude 知道这次调用为什么被拒绝。

但大多数钩子的输出除非配置里显式返回，否则不会进入主窗口。如果你用 `PreCompact` 事件在压缩前把聊天记录备份到另一个文件供日后查阅，Claude 并不会知道哪个文件里存着聊天记录。

这让这几类钩子在根本上不同于 CLAUDE.md、rules 和 skills。更多细节见我们的文章 [如何配置 hooks](https://claude.com/blog/how-to-configure-hooks)。

> **提示**：任何"应当确定性地发生"的事都交给钩子：编辑后跑 linter、完成时发 Slack、在执行前拦截特定命令。一个 `PreToolUse` 钩子可以检查任意工具调用，并用 **exit code 2** 拒绝它。

它们的上下文成本低，是因为它们是 **harness 运行的代码**，而不是被加载进上下文给 Claude 的指令。技能与钩子也是[设计智能体循环](https://claude.com/blog/getting-started-with-loops)的基本构件——重复运行直到满足停止条件的工作流。

#### Output styles

[**Output styles**](https://code.claude.com/docs/en/output-styles)（输出风格）是 `.claude/output-styles/` 目录下的文件，把指令注入系统提示词。它们永不被压缩，每次会话开始时加载，并在会话首个请求之后被缓存——也就是说它们有中等偏高的上下文成本。

因为它们坐在系统提示词里，所以在本文覆盖的所有方法中，输出风格携带的**指令遵循权重最高**，应当谨慎使用。

**对输出风格的修改会替换掉默认输出风格**（除非你在该风格的 frontmatter 里设置 `keep-coding-instructions: true`）。

在 Claude Code 里，这意味着会移除那些告诉 Claude "你正在帮用户做软件工程任务"的指令，以及其他关键的默认指令，例如：

- 如何界定改动范围；
- 何时添加、何时省略代码注释；
- 遇到安全问题该怎么做；以及
- 验证习惯——比如在宣布工作完成之前先跑测试。

默认情况下，自定义输出风格会把以上全部丢掉，于是 Claude Code 更像"通用助手"而不是"软件工程助手"。

> **提示**：在写自定义输出风格之前，先看内置的。**Proactive**（主动）、**Explanatory**（详解）、**Learning**（学习）三种已覆盖最常见需求（自主性、教学模式、协作式编码），而且你不必自己维护风格文件。

#### 追加系统提示词

替代修改输出风格的另一条路是 `append-system-prompt` 旗标。修改输出风格文件可能带来对 Claude 行为的巨大且非预期改变，而追加旗标对原始系统提示词**只做加法**：它不改变 Claude 的角色，只是往它的默认角色上增加指令。

它也是在**调用时**传入、只对当次调用生效，而不是作为文件跨会话持久化。

与其他传指令的方式相比，追加系统提示词的上下文成本可能更高。它会增加输入 token，不过 prompt caching 会在会话首个请求之后降低这部分成本。让 Claude 使用更啰嗦或更长的风格，同样会增加输出 token。

> **提示**：追加系统提示词最适合补充具体的编码标准、输出格式或领域知识。请记住：它在遵循度上**收益递减**——通常你通过这种方式提供的指令越多，Claude 对每条的遵循就越严格不起来，尤其是指令彼此矛盾时。

### 每种方法该在什么时候用

如果你发现自己在做下面任何一件事，就说明你的指令可能放错了地方：

**在 CLAUDE.md 里写"每次 X 时总要做 Y"。** 如果这个行为需要**可靠地**发生——比如每次编辑后跑 prettier、完成时发 Slack——那就改用 `settings.json` 里的钩子。**模型选择去跑格式化工具**，与**格式化工具自动跑起来**，是两件不同的事。

**在 CLAUDE.md 里写"绝不要做这件事"。** 当某件事绝对不能发生时，指令就是**错误的工具**。Claude 大多数时候会遵循它，但在压力下——长会话、情况模糊、或者任务中读到的某个文件里藏着提示注入——模型可能不遵守一条被提示出来的规则。真正的护栏必须是**确定性的**，而执行手段是 [hooks](https://code.claude.com/docs/en/hooks) 与 [permissions](https://code.claude.com/docs/en/permissions)。一个 `PreToolUse` 钩子可以检查一次调用并以 exit code 2 阻塞它。[**Managed settings**](https://code.claude.com/docs/en/settings#managed-settings) 更进一步：由管理员下发、不能被用户本地配置覆盖，而且是实现**组织级确定性护栏**的唯一手段。

**在 CLAUDE.md 里放一段 30 行的流程。** 流程属于技能。CLAUDE.md 是给 Claude 始终持有的**事实**：构建命令、monorepo 布局、团队约定。一份部署 runbook 或安全评审检查清单应该住在 `.claude/skills/`，正文只在被调用时加载。

**写了一条针对某个 API 的规则，却没加 `paths`。** 如果一条规则只适用于 `src/api/**`，用 `paths:` 限定作用域就能在无关工作时把它挡在上下文之外。**未加作用域的规则，在机制上等同于把内容写进 CLAUDE.md**：始终加载、始终花 token。

**把个人偏好写进项目级 CLAUDE.md。** 所有基于文件的方式都有一个对应用户级形态，无论你身处哪个仓库，它们都会在每次 Claude Code 会话里加载。个人偏好（"永远用语义化提交信息"）用**本地文件**；项目级文件只放**属于团队全员、但又是特定代码库所需**的偏好。

### 从定制 Claude Code 开始

我们会在 [Claude Code 最佳实践](https://code.claude.com/docs/en/best-practices#write-an-effective-claude-md)文档里给更多关于把 Claude Code 用到极致的技巧与模式，从配置环境到跨并行会话扩展。

等你把其中几种跑通了，就可以把它们中的许多（技能、子智能体、钩子、输出风格）打包成一个 [plugin](https://code.claude.com/docs/en/plugins)，在同事或项目之间分享一套自洽的配置。

*（原文注：本文由 Anthropic 团队成员 Michael Segner 撰写。）*

## 编者补充一：三条判据与一张落位速查

> 本节为本站编者补充，非原文内容。原文的判据散落在各节提示里，这里压成可执行版本。

| 你的指令长这样 | 落位 | 理由（原文依据） |
| --- | --- | --- |
| "构建用 `pnpm build`，测试用 `bin/go test ./...`" | 根 CLAUDE.md | 始终加载的事实，且需要每场会话都在 |
| "`src/api/**` 必须校验入参" | 路径作用域 rule | 横切且只相关时加载；写成未加作用域等于塞进 CLAUDE.md |
| "`app/api/` 目录下的错误码约定" | 子目录 CLAUDE.md | 该目录被触碰才加载，成本最低 |
| "发布流程：跑回归 → 打 tag → 生成 changelog → 通知" | skill | 流程，且大多数会话用不到 |
| "审这份 diff，只看 diff 与判据，别告诉我你是怎么写的" | subagent | 隔离上下文，只回摘要，避免自我偏袒 |
| "每次编辑后跑 prettier" | PostToolUse hook | 要确定性发生，不能指望模型记性 |
| "绝不能改 `db/migrations/`" | PreToolUse hook + 权限（组织级用 managed settings） | 指令在长会话/注入下会失效 |
| "回复请只用中文、不要寒暄" | `--append-system-prompt` 或本地偏好文件 | 语气与格式偏好，项目级文件不该放个人偏好 |

三条判据：**是事实还是流程**（事实→CLAUDE.md，流程→skill）；**是全仓适用还是局部适用**（局部→`paths:` 或子目录 CLAUDE.md）；**是希望模型尽量做到、还是必须发生**（必须发生→hook + 权限）。

## 编者补充二：把"绝不能做 X"落成可运行防线

> 本节为本站编者补充，示例配置与脚本取自 Claude Code 官方 [Hooks 文档](https://code.claude.com/docs/en/hooks)（Copyright Anthropic PBC，教学用途翻译并署名），非上文博文内容。

下面这段配置实现了原文那句判断的最小落地：`PreToolUse` 拦截 `rm` 类命令。把它写进项目的 `.claude/settings.json`（可提交、团队共享）：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(rm *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-rm.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

脚本从 stdin 读取钩子输入（JSON），取出 `tool_input.command` 判断；返回 `permissionDecision: "deny"` 即拒绝，或直接以 exit code 2 退出并把原因写到 stderr：

```bash
#!/bin/bash
# .claude/hooks/block-rm.sh —— 拦截破坏性命令
# 记得 chmod +x .claude/hooks/block-rm.sh
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -q 'rm -rf'; then
  jq -n '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "破坏性命令已被 hook 拦截"
    }
  }'
else
  exit 0   # 不做判断，交回常规权限流程
fi
```

同理可把它换成"禁止改测试文件"：matcher 用 `Edit|Write|MultiEdit`，脚本里判断 `tool_input.file_path` 是否落在 `tests/`，命中即 deny——这正是《AI 代码的安全与质量陷阱：六大陷阱与检测清单》里"陷阱三/陷阱四"的机械化版本。

## 常见坑

- **把 CLAUDE.md 写成百科全书**：原文上限是 200 行，超出后指令遵循度会明显下降；正确姿势是当**索引**，指向 `docs/` 下的细则文件与技能。
- **规则不加 `paths`**：与写进 CLAUDE.md 完全等价，白付 token。
- **一次会话调用太多技能**：压缩时按共享预算重注入，**最早的先丢**，你会以为"它忘了我的部署流程"。
- **自定义输出风格**：默认替换掉整套编码指令（改动范围界定、注释取舍、安全处理、完工前跑测试）。先试内置的 Proactive / Explanatory / Learning。
- **指望指令兜住安全**："绝不要 X"在长会话、上下文压缩、文件里的提示注入下都可能失效——护栏必须确定性（hook + 权限 + managed settings）。
- **个人偏好写进项目文件**：会给全组每次会话加成本；个人偏好用用户级/本地文件。

## 延伸阅读

- 《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》——跨工具通用的规范文件写法
- 《Claude Skills：可复用技能包》与《开源编码 Skills 精选：Superpowers 与 Anthropic 官方技能族深度指南》——技能族的写法与现成技能
- 《Claude Code 权限系统与安全机制》——permissions 与沙箱：本文"确定性护栏"一节的机制细节
- 《Claude Code 工作流与最佳实践》——把七种方式放进一次真实会话的完整流程
- 《AI 结对与代码审查》——子智能体对抗式审查与 `REVIEW.md` 配方
- 《Vibe Coding 中文实战精选：vibe-coding-cn 的核心命题、经验心法与拼好码》——中文社区对"机器门禁优先于自然语言"的同一结论

---

> **来源**：本文正文完整翻译自 Anthropic 官方博客 [Steering Claude Code: when to use CLAUDE.md, skills, hooks, and subagents](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)（2026-06-18，作者 Michael Segner，Anthropic 团队成员），许可为署名翻译（官方博客内容 Copyright Anthropic PBC，本站作教学用途翻译并署名，原站未附开放许可证）；正文全文翻译，开头编者按、表头标注、括注的"原文配图说明"、文末两节编者补充与"常见坑""延伸阅读"均为本站编者内容并已标明。原文首图与各节配图未搬运，其说明性文字已在对应位置以"原文配图说明"译出。编者补充二的配置与脚本译自 Claude Code 官方 [Hooks 文档](https://code.claude.com/docs/en/hooks)（2026-09 当前版，Copyright Anthropic PBC，教学用途翻译并署名），脚本中的 `jq` 为依赖项（macOS `brew install jq`，Debian/Ubuntu `apt-get install jq`）。文中命令名与文件路径按 2026-09 官方文档当前版核对。抓取于 2026-09-19。
