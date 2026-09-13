---
title: AI 结对与代码审查
source_url: https://code.claude.com/docs/en/code-review
author: Anthropic（Claude Code 官方文档）
license: 署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 19
---

## AI 结对：让"第二双眼睛"成为默认配置

AI 时代写代码的常态是"人机结对"：智能体写实现，人负责方向与验收。这个模式最大的风险在于**作者自己审查自己**——无论是人审 AI 的产出，还是 AI 偏袒自己刚写的代码。业界因此收敛出三条互补做法（见第 6 篇 Claude Code 最佳实践）：

1. **Writer/Reviewer 双会话**：一个会话写、一个全新上下文的会话审，消除"自我偏袒"；
2. **对抗式审查子智能体**：审查者只看 diff 与判据、看不到产生变更的推理，就结果本身做评价；
3. **无人值守后的强制审查**：智能体跑得越久越自动，合并前的独立审查越不可省。

本文翻译的 Claude Code Code Review 文档，正是第 3 条的工业化形态——多智能体分析整个代码库、自动审查 GitHub PR、把发现钉在具体代码行上。同一赛道的其他玩家：GitHub Copilot 的 Copilot Code Review（PR 页面点 "Request Copilot review"）、Cursor 的 Bugbot、Cline 的 GitHub PR Review 样例（第 2 篇对比表）。

## Code Review：自动化的 PR 审查

> 以下为官方文档译文。

Code Review 分析你的 GitHub 拉取请求，把发现以行内评论（inline comment）形式钉在发现问题的代码行上。一支专职智能体编队在**完整代码库**的上下文中检查代码变更，寻找逻辑错误、安全漏洞、失效的边界情况与隐蔽回归。

发现按严重度打标，**不会批准或阻塞你的 PR**——既有审查工作流保持不变。你可以通过在仓库里加 `CLAUDE.md` 或 `REVIEW.md` 来调整 Claude 的审查口径。

> 注：Code Review 目前为 research preview，面向 Team 与 Enterprise 订阅。其他套餐仍可在本地用 `/code-review` 命令审查 diff。要在你自己的 CI 基础设施上跑，见 GitHub Actions / GitLab CI/CD 文档。

### 审查如何运作

组织启用后，PR 打开时、每次推送时、或手动请求时触发审查（取决于仓库配置）。任何模式下评论 `@claude review` 都能启动审查。

审查运行时，多个智能体在 Anthropic 基础设施上**并行**分析 diff 与周边代码，每个智能体负责一类问题；随后一个**验证步骤**对照代码实际行为核查候选发现、过滤误报。结果去重、按严重度排序、以行内评论钉在具体代码行，并在审查正文给摘要。没有问题时，GitHub check run 会显示未发现问题。审查平均 20 分钟完成，成本随 PR 规模与复杂度伸缩。

### 严重度分级

**表：审查发现的严重度标记**

| 标记 | 严重度 | 含义 |
| --- | --- | --- |
| 🔴 | Important | 合并前应当修复的 bug |
| 🟡 | Nit | 次要问题，值得修但不阻塞 |
| 🟣 | Pre-existing | 代码库中已存在、非本 PR 引入的 bug |

每条发现都带可折叠的扩展推理段——展开即可了解 Claude 为什么标记该问题、以及它如何验证了问题确实存在。

### 评价与回复发现

Claude 的每条审查评论自带 👍/👎 按钮供一键评价：有用点 👍，错误或噪声点 👎。Anthropic 在 PR 合并后收集反应计数用于调优审查者。**回复行内评论不会让 Claude 响应或更新 PR**——要对发现采取行动，修代码然后 push；若该 PR 订阅了推送触发审查，下一次运行会在问题修复后自动解决该讨论线程。不 push 就想复审，则发顶层评论 `@claude review`。

### Check run 输出

除行内评论外，每次审查都会填充与 CI 检查并列的 **Claude Code Review** check run。展开 Details 可看到按严重度排序的全部发现汇总，每条发现还会在 Files changed 标签页中作为注解标在相关 diff 行上。这些注解与严重度表独立于行内评论写入——即使 GitHub 拒绝了某行（因代码移动）的行内评论，它们仍然可见。

check run 总是以中性结论结束，**不会经分支保护规则阻塞合并**。想让发现参与合并门禁，可在自己的 CI 中解析 check run 输出的严重度统计（Details 文本最后一行是机器可读注释，可用 `gh` + jq 解析），例如返回 `{"normal": 2, "nit": 1, "pre_existing": 0}`——`normal` 即 Important 计数，非零表示 Claude 发现了至少一个合并前值得修复的 bug。

### 审查什么

默认聚焦**正确性**：会破坏生产的 bug，而不是格式偏好或测试覆盖率缺失。可通过"指导文件"扩展审查口径。

## 配置与触发

Owner 在管理后台一次性启用，选择要覆盖的仓库，并为每个仓库选择审查触发时机：

- **PR 创建后一次**：PR 打开或标记 ready 时审查一次
- **每次推送后**：PR 分支每次推送都审查，随 PR 演进捕获新问题、修复后自动解决线程
- **手动**：打开或推送不触发；评论 `@claude review` 请求，或 `@claude review always` 让该 PR 此后订阅推送触发

手动评论命令须作为**顶层 PR 评论**（不是 diff 行内评论）发布在评论开头；需要仓库 write 及以上权限；PR 须处于打开状态。fork 而来的 PR 一律不自动审查，只能评论 `@claude review` 启动。

## 定制审查：CLAUDE.md 与 REVIEW.md

Code Review 从仓库读取两个文件来校准审查行为：

- **`CLAUDE.md`**：Claude Code 所有任务共享的项目指令。审查时作为项目上下文读取，把"新引入的违反"标为 nit。这是双向的：如果你的 PR 改动让某条 CLAUDE.md 陈述过时了，Claude 也会标记文档需要更新。它读取目录树每一层的 CLAUDE.md，子目录的规则只作用于该路径下的文件。
- **`REVIEW.md`**：仅审查使用的指令，发给发现与验证智能体，并由定级与报告智能体参考。用它声明你的团队想标记什么、什么严重度、如何报告。文件按原文阅读（`@` 导入语法不展开），规则直接写进文件。

### REVIEW.md 可以调什么

- **严重度**：重新定义你仓库里 🔴 Important 的含义。默认校准面向生产代码；文档仓库、配置仓库或原型可以收窄得多。也可反向升级——比如把任何 CLAUDE.md 违规从默认 nit 升为 Important。
- **Nit 数量上限**：限制单次审查发多少条 🟡。散文与配置文件可以无限抛光——"最多发五条 nit，其余在摘要中计数"能保持审查可行动。
- **跳过规则**：列出不该发发现的路径、分支模式与类别——生成代码、lockfile、vendored 依赖、机器 authored 的分支，以及 CI 已强制的 lint/拼写检查。对"需要一点审查但不值得全力"的路径，设更高门槛而不是完全跳过："在 `scripts/` 中，仅在几乎确定且严重时报告。"
- **仓库专属检查**：每条 PR 都要核查的规则，如"新 API 路由必须有集成测试"。因为 REVIEW.md 直达每个发现与验证智能体，这些规则比塞进冗长 CLAUDE.md 更可靠。
- **验证门槛**：某类发现须先出示证据——"行为断言需要源码中的 `file:line` 引用，不许从命名推断"——砍掉让作者白跑一圈的误报。
- **复审收敛**：规定 PR 已被审查过之后怎么审——"首轮之后抑制新 nit、只发 Important 发现"，避免一行修复为风格问题进到第七轮。
- **摘要形态**：要求审查正文以一行统计开头（如 `2 factual, 4 style`），没有事实问题时明确说"no factual issues"。作者想知道工作的形状，再谈细节。

**表：审查发现严重度统计字段示例**

| 字段 | 含义 |
| --- | --- |
| `normal` | 🔴 Important 发现数 |
| `nit` | 🟡 Nit 发现数 |
| `pre_existing` | 🟣 既有 bug 发现数 |

### REVIEW.md 示例

```markdown
# Review instructions

## What Important means here

Reserve Important for findings that would break behavior, leak data,
or block a rollback: incorrect logic, unscoped database queries, PII
in logs or error messages, and migrations that aren't backward
compatible. Style, naming, and refactoring suggestions are Nit at
most.

## Cap the nits

Report at most five Nits per review. If you found more, say "plus N
similar items" in the summary instead of posting them inline. If
everything you found is a Nit, lead the summary with "No blocking
issues."

## Do not report

- Anything CI already enforces: lint, formatting, type errors
- Generated files under `src/gen/` and any `*.lock` file
- Test-only code that intentionally violates production rules

## Always check

- New API routes have an integration test
- Log lines don't include email addresses, user IDs, or request bodies
- Database queries are scoped to the caller's tenant
```

（译：Important 保留给破坏行为、泄露数据或阻断回滚的发现——错误逻辑、未限定范围的数据库查询、日志或错误信息中的个人敏感信息（PII）、不向后兼容的迁移。风格、命名、重构建议至多算 Nit。每次审查最多发五条 Nit；更多就在摘要里说"另有 N 条类似项"；如果发现全是 Nit，摘要以"No blocking issues"开头。不报告 CI 已强制的任何内容（lint、格式、类型错误）、`src/gen/` 下的生成文件与任何 `*.lock`、故意违反生产规则的测试专用代码。总是检查：新 API 路由有集成测试；日志不含邮箱、用户 ID 或请求体；数据库查询按调用方租户限定范围。）

**保持聚焦**：长度有代价——冗长的 REVIEW.md 会稀释最重要的规则。只放"改变审查行为"的指令，一般项目背景留给 CLAUDE.md。

## 本地审查 diff：/code-review

`/code-review` 命令在终端审查 diff，无需安装 GitHub App。它报告正确性 bug 与复用、简化、效率类清理项（`/review` 是其别名）：

```text
/code-review
```

默认审查"本分支领先上游的提交 + 未提交改动"；要审查别的东西可以传目标：文件路径、PR 编号、分支名、或 `main...my-feature` 这类 ref 区间。可用旗标：`--fix`（审查后把发现应用到工作区）、`--comment`（把发现发成 GitHub PR 行内评论或 GitLab MR 备注）。审查以后台子智能体身份运行，自带独立上下文窗口——不占你的对话；发现完成后送回会话，你再让 Claude 修掉它们。

`ultra` 级别（`/code-review ultra`）是云端深度多智能体审查：编队先找 bug、再独立验证，最后由汇总智能体按严重度统一汇报，适合合并前的关键变更终审（详见官方 ultrareview 文档）。`low`/`medium` 力度只报最有把握的发现（更少误报），`high` 到 `max` 扩大覆盖面。

> 译注：把"审查指令"写进仓库（REVIEW.md）、把"审查成本"暴露给团队（分析面板）、把"审查结论"做成可机读输出（check run JSON）——这套设计让 AI 审查可以被工程化管理，而不是一个黑盒评分器。它对应着本模块的一个反复出现的母题：**AI 能力的每一次跃升，都把瓶颈推回工程纪律**。

---

> **来源**：本文翻译自 [Code Review](https://code.claude.com/docs/en/code-review)（Claude Code 官方文档，2026-09 当前版），作者 Anthropic，许可署名翻译（官方文档，Copyright Anthropic PBC，仅作教学用途翻译并署名）。抓取于 2026-09-13。
