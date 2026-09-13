---
title: Spec 驱动开发（Spec-Driven Development）
source_url: https://github.com/github/spec-kit
author: GitHub（Spec Kit 项目 README，主篇）；Geoffrey Huntley（Ralph 实践视角，延伸）
license: MIT（Spec Kit README）；Ralph 文章署名转载
fetched_at: 2026-09-13
translated: true
order: 14
---

## 什么是 Spec 驱动开发（Spec-Driven Development）？

Spec 驱动开发**颠覆了传统软件开发的剧本**。几十年来，代码是王——规格说明只是脚手架，一旦"真正的工作"（写码）开始就被丢掉。Spec 驱动开发改变了这一点：**规格说明成为可执行的（executable）**，直接生成能跑的实现，而不再只是"指导"实现。

这一思潮的实践源头之一是 Geoffrey Huntley：他在 2025 年 3 月的《From Design doc to code》一文中描述了用 Cursor 的 `/specs` 命令把设计文档变成代码的新工作法（"vibecoding meta"），并在同年 7 月的 Ralph Wiggum 一文中把流程固化为"规格 + 提示脚本 + 智能体循环"。GitHub 随后开源的 Spec Kit 把这套方法论做成了可安装的工具包。

## SDD 快速上手

把 `vX.Y.Z` 替换为[最新发布标签](https://github.com/github/spec-kit/releases)（保留前导 `v`）：

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z
specify init my-project --integration copilot
cd my-project
```

在项目目录中启动你的编码智能体，然后：

0. **确立**项目原则（`/speckit-constitution`）——每个项目一次性的步骤
1. **Specify（规格化）**你要构建什么（`/speckit-specify`）
2. **Plan（计划）**如何构建（`/speckit-plan`）
3. **Tasks（拆解）**为可执行任务（`/speckit-tasks`）
4. **Implement（实现）**这些任务（`/speckit-implement`）
5. **Converge（收敛）**——对照规格、计划与任务校验实现（`/speckit-converge`）

> 注：重复第 4、5 步，直到 `/speckit-converge` 报告 **Converged**。

## 用 Spec Kit 修 bug

当智能体从"缺陷报告"直接跳到"补丁"，既不验证诊断、也不确认修复真的消除了原始症状时，修 bug 是危险的。内置的可选 bug 扩展提供了可重复的**评估 → 修复 → 测试**工作流，让每个修复都范围受控、有据可查、从根因到验证全程留痕：

```bash
specify extension add bug
```

1. 评估 bug：`/speckit-bug-assess "<bug report>" slug=login-crash`
2. 修复已评估的根因：`/speckit-bug-fix slug=login-crash`
3. 测试修复：`/speckit-bug-test slug=login-crash`

## 用 Spec Kit 评估想法

好想法在投入之前值得先拿证据——无论它最终是否变成软件。可选的 assess 扩展通过**收集 → 调研 → 定义 → 塑形 → 决策**的独立流程，把一个原始想法变成有文档记录的 **go / needs-clarification / kill** 决定：

1. `/speckit-assess-intake "<idea>" slug=offline-mode`——收集想法
2. `/speckit-assess-research slug=offline-mode`——调研支持与反对证据
3. `/speckit-assess-define slug=offline-mode`——定义问题、目标与成功指标
4. `/speckit-assess-shape slug=offline-mode`——塑形候选方案及其权衡
5. `/speckit-assess-decide slug=offline-mode`——决定推进、澄清还是叫停

> 注：想法评估是独立的。若决策为 go，可直接交给 `/speckit-specify` 进入构建流程。

## 安装与初始化

```bash
# 安装 CLI（依赖 uv；也可从 PyPI：uv tool install specify-cli）
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z

# 初始化项目（--integration 指定你的智能体；支持 30+ 编码智能体）
specify init my-project --integration copilot

# CI / 无人值守环境加 --non-interactive 防止卡在交互选择器
specify init --here --force --non-interactive --integration claude

# 自升级
specify self check            # 只读检查新版本
specify self upgrade          # 原地升级到最新稳定版
```

## 完整工作流示例

在项目目录启动编码智能体后，依次执行（多数智能体暴露为 `/speckit.*` 斜杠命令）：

**1. 确立项目原则**——创建治理原则与开发指南，约束后续所有开发：

```bash
/speckit.constitution Create principles focused on code quality, testing standards, user experience consistency, and performance requirements
```

**2. 创建规格**——只描述"做什么、为什么"，不谈技术栈：

```bash
/speckit.specify Build an application that can help me organize my photos in separate photo albums. Albums are grouped by date and can be re-organized by dragging and dropping on the main page. Albums are never in other nested albums. Within each album, photos are previewed in a tile-like interface.
```

**3. 创建技术实现计划**——在这里给出技术栈与架构选择：

```bash
/speckit.plan The application uses Vite with minimal number of libraries. Use vanilla HTML, CSS, and JavaScript as much as possible. Images are not uploaded anywhere and metadata is stored in a local SQLite database.
```

**4. 拆解任务**：

```bash
/speckit.tasks
```

**5. 执行实现**：

```bash
/speckit.implement
```

## 全部命令一览

**表：Spec Kit 核心命令**

| 命令 | 对应技能 | 说明 |
| --- | --- | --- |
| `/speckit.constitution` | `speckit-constitution` | 创建或更新项目治理原则与开发指南 |
| `/speckit.specify` | `speckit-specify` | 定义要构建什么（需求与用户故事） |
| `/speckit.plan` | `speckit-plan` | 用你选择的技术栈创建技术实现计划 |
| `/speckit.tasks` | `speckit-tasks` | 生成可执行任务清单 |
| `/speckit.taskstoissues` | `speckit-taskstoissues` | 把任务清单转成 GitHub issue 跟踪执行 |
| `/speckit.implement` | `speckit-implement` | 执行全部任务、按计划构建功能 |
| `/speckit.converge` | `speckit-converge` | 对照 spec/plan/tasks 评估代码库，把剩余工作追加为新任务 |

**表：可选质量命令**

| 命令 | 说明 |
| --- | --- |
| `/speckit.clarify` | 澄清规格中欠明确的区域（建议在 plan 之前运行） |
| `/speckit.analyze` | 跨产物一致性与覆盖度分析（tasks 之后、implement 之前） |
| `/speckit.checklist` | 生成自定义质量检查清单，校验需求的完整性、清晰度与一致性——号称"给英语写的单元测试" |

## 扩展、预设与捆绑包

Spec Kit 通过三层机制定制（优先级从高到低：项目本地覆盖 > Preset > Extension > 内核；模板在运行时自顶向下解析，取第一个匹配）：

- **Extension（扩展）**：添加新命令与能力——Jira 集成、实现后代码审查、V 模型测试追溯等。`specify extension search` / `specify extension add <name>`。
- **Preset（预设）**：不改能力、只改"怎么干活"——强制合规化规格格式、领域术语、组织标准、测试先行任务排序，甚至整体本地化为另一种语言。`specify preset search` / `specify preset add <name>`。
- **Bundle（捆绑包）**：把一组扩展/预设打包成版本化的"角色套装"——产品经理、业务分析师、安全研究员、开发者各一套，一条命令为整个团队角色完成配置。`specify bundle search / info / install / list / update / remove`。

**表：什么时候用哪个**

| 目标 | 用 |
| --- | --- |
| 新增命令或工作流 | Extension |
| 自定义 spec/plan/tasks 的格式 | Preset |
| 集成外部工具或服务 | Extension |
| 强制组织或合规标准 | Preset |
| 一条命令配置完整的角色环境 | Bundle |

## 核心哲学

Spec 驱动开发是一个强调以下要点的结构化流程：

- **意图驱动开发**：规格先定义"做什么"，再谈"怎么做"
- **富规格创建**：在护栏与组织原则的约束下写规格
- **多步精化**：而不是从提示词一次性生成代码
- **重度依赖**高级 AI 模型对规格的解读能力

> 官方自注（Dogfooding）：Spec Kit 团自己也用 Spec Kit 开发 Spec Kit，尤其是大功能与工作流变更；小修复仍走正常的 issue/PR/审查/测试流程。

## 延伸实践：Ralph 循环——把规格交给智能体跑一整晚

> 以下摘译自 Geoffrey Huntley《Ralph Wiggum as a "software engineer"》（2025-07-25）。

Ralph 的核心是"原始智能体循环"：给智能体一个包含 `spec.md`（规格）、`prompt.md`（每轮重复的提示）和 `PRICE`（预算上限，如 `$10-$50`）的目录，然后用一行 shell 循环驱动：

```bash
while :; do cat PROMPT.md | npx claude-code ; done
```

每一轮提示都让智能体：读规格、从 `specs/PLAN.md` 里挑一个小块、写测试、写实现、提交、并更新计划文档。Geoffrey 对规格的定位是："**spec.md 是给未来那几轮智能体的交接文档（handoff document）**"——因为每一轮都是全新会话，规格与计划就是唯一的持久记忆。他还强调两条纪律：给智能体高频提交的自助权（"commit and push as often as possible"），以及让"完成"由测试定义而非由自我报告定义。

这个循环粗糙但有效：预算封顶、可随时打断、产物是 PR。它的精神内核——把"做什么"写清楚，把"怎么做"交给循环——正是 Spec Kit 把它工程化的起点。

> 译注：Spec 驱动与本模块其他篇章的关系——Spec Kit 的 `/speckit-implement` 本质是第 7 篇"可验证的完成标准"的项目化；`/speckit-tasks` 对应第 29 篇 0→1 流程中的任务拆解；`/speckit-converge` 与第 20 篇代码审查共享同一个思想：**让另一个上下文对照规格检查实现**。

---

> **来源**：本文主篇翻译自 [github/spec-kit](https://github.com/github/spec-kit) 项目 README（英文原版），作者 GitHub（Spec Kit 团队），许可 MIT；延伸实践一节摘译自 Geoffrey Huntley《[Ralph Wiggum as a "software engineer"](https://ghuntley.com/ralph/)》（2025-07-25），署名转载。抓取于 2026-09-13。Spec Kit 于 2026-08 发布 1.0.0，本文以该版本文档为准。
