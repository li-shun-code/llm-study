---
title: Cursor 入门与 Rules 规则系统
source_url: https://cursor.com/docs/context/rules
author: Anysphere（Cursor 官方文档）
license: 署名翻译（官方文档版权归 Anysphere 所有，仅作教学用途全文翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 4
---

> **来源**：本文翻译自 [Rules - Cursor Docs](https://cursor.com/docs/context/rules)，作者 Anysphere（Cursor 官方文档），许可署名翻译（官方文档版权归 Anysphere 所有，仅作教学用途全文翻译并署名）。抓取于 2026-09-13。

## Cursor 入门速览

Cursor 是 AI 原生代码编辑器。按官方文档的当前结构，它的能力面大致分几块：

- **Agent（智能体）**：编辑器内 Agent、Agents Window（多智能体窗口）、Agent Review（审查）、Plan Mode（计划模式）、Prompting（提示技巧）、Debugging（调试）、Design Mode（设计模式）。
- **自定义（Customize）**：Plugins 插件、**Rules 规则**、Skills 技能、Subagents 子智能体、Hooks 钩子、MCP。
- **云端智能体（Cloud Agents）**：云端跑任务与 Builds、Bugbot（PR 找虫）、Security Agents、PR 路由与审批、移动端。
- **CLI 与 SDK**：命令行与编程接口。

本文主体翻译其中最常用、也最能体现"项目级约定"思想的 **Rules** 一章。Cursor 之外的工具（Claude Code 的 CLAUDE.md、Cline 的 `.clinerules` 等）都在解决同一个问题——见本模块第 5 篇《AGENTS.md/CLAUDE.md 项目规范文件》。

## Rules：给 Agent 的系统级指令

Rules 为 Agent 提供系统级指令。它们把提示词、脚本等打包在一起，让团队的工作流易于管理与共享。

Cursor 支持四类规则：

- **Project Rules（项目规则）**：存放在 `.cursor/rules`，纳入版本控制，作用于你的代码库。
- **User Rules（用户规则）**：对你整个 Cursor 环境全局生效，由 Agent（Chat）使用。
- **Team Rules（团队规则）**：在管理后台统一管理的团队级规则，Team 与 Enterprise 套餐可用。
- **AGENTS.md**：Markdown 格式的智能体指令，是 `.cursor/rules` 的简化替代。

## Rules 的工作原理

大语言模型在两次补全之间不会保留记忆。Rules 在提示词层面提供持久、可复用的上下文。规则被应用时，其内容会被插入模型上下文的开头，让 AI 在生成代码、理解编辑或协助工作流时获得一致的指引。

## 项目规则

项目规则以 `.mdc` 文件形式存放在 `.cursor/rules` 中并纳入版本控制。它们通过路径模式（glob）限定作用范围、被手动调用、或按相关性自动纳入。

项目规则的典型用途：

- 沉淀关于代码库的领域知识
- 将项目特有的工作流或模板自动化
- 统一风格或架构决策

### 规则文件结构

每条规则是一个 `.mdc` 文件，文件名随意。**项目规则必须用 `.mdc` 扩展名**——`.cursor/rules` 下的普通 `.md` 文件会被规则系统忽略，因为它没有用于指定 `description`、`globs`、`alwaysApply` 的 frontmatter。如果你更想用朴素 Markdown，请改用 AGENTS.md。

```text
.cursor/rules/
  react-patterns.mdc      # 识别为项目规则
  api-guidelines.md       # 被忽略（扩展名不对）
  frontend/               # 规则可分目录组织
    components.mdc
```

### 规则解剖：frontmatter 与触发方式

每条规则是带 frontmatter 元数据与正文的 Markdown 文件。通过类型下拉框（改变 `description`、`globs`、`alwaysApply` 三个属性）控制规则的生效方式。

**表：规则类型（下拉选项）与含义**

| 规则类型 | 说明 |
| --- | --- |
| `Always Apply` | 应用于每一次对话 |
| `Apply Intelligently` | Agent 根据 description 自行判断相关性后应用 |
| `Apply to Specific Files` | 文件匹配指定模式时应用 |
| `Apply Manually` | 在对话中 @ 提及时应用（如 `@my-rule`） |

底层由三个 frontmatter 字段的组合决定规则何时被纳入：

**表：frontmatter 字段组合与行为**

| `alwaysApply` | `description` | `globs` | 行为 |
| --- | --- | --- | --- |
| `true` | — | — | 总是纳入。globs 与 description 被忽略 |
| `false` | — | 提供 | 上下文中出现匹配文件时自动附加 |
| `false` | 提供 | 省略 | Agent 读取 description，认为相关时拉入规则 |
| `false` | 省略 | 省略 | 仅当你在对话中 @ 提及该规则时纳入 |

四种触发方式的示例：

**总是应用：**

```markdown
---
alwaysApply: true
---
- All source files must include the company copyright header
- When you are unsure about implementation details, read the relevant
  source files before proposing changes
- Never modify generated files in the `dist/` or `build/` directories
```

**按文件模式自动附加：**

```markdown
---
globs: src/components/**/*.tsx
alwaysApply: false
---
- Use named exports, not default exports
- Co-locate styles in a module CSS file next to the component
- Keep components under 200 lines. Extract subcomponents into the same
  directory when a file grows beyond that
- Prefer composition over prop drilling. Pass children or render props
  instead of threading data through multiple layers
```

**由 Agent 按 description 选择：**

```markdown
---
description: RPC service conventions and patterns for the backend
alwaysApply: false
---
- Define each service in its own file under `src/services/`
- Always validate inputs at the service boundary before passing data
  to internal functions
- Return structured error objects with a `code` and `message` field,
  never throw raw strings
- Add a `@service-template.ts` reference file when creating a new
  service for the standard boilerplate
```

**手动——仅通过 @ 提及：**

```markdown
---
alwaysApply: false
---
- Every database migration must have both `up` and `down` functions
  so it can be fully reversed
- Never alter a column type in-place. Add a new column, backfill,
  then drop the old one in a separate migration
- Reference the template for the expected file structure
  @migration-template.sql
```

### Glob 模式示例

用 `globs` 把规则限定到特定文件或目录，多个模式用逗号分隔。

**表：glob 模式与匹配范围**

| 模式 | 匹配 |
| --- | --- |
| `*` | 任意单个文件名段 |
| `**` | 任意层级目录（递归） |
| `*.ts` | 根目录下所有 `.ts` 文件 |
| `**/*.ts` | 任意目录下的所有 `.ts` 文件 |
| `src/**` | `src/` 下任意层级的所有文件 |
| `src/**/*.tsx` | `src/` 下任意层级的所有 `.tsx` 文件 |
| `docs/**/*.md, docs/**/*.mdx` | `docs/` 下的 `.md` 与 `.mdx` 文件（逗号分隔） |
| `tailwind.config.*` | 任意扩展名的 `tailwind.config` |

### 创建规则

两种方式：

- **对话中 `/create-rule`**：在 Agent 里输入 `/create-rule` 并描述你想要什么，Agent 会生成带正确 frontmatter 的规则文件并保存到 `.cursor/rules`。
- **从 Customize 面板**：打开侧边栏 **Customize**，进入 **Rules**，点击 **Add Rule**。在 Customize 里可以看到所有规则及其状态。

## 最佳实践

好的规则：聚焦、可执行、范围明确。

- 单条规则不超过 500 行
- 把大规则拆成多条可组合的小规则
- 提供具体示例或引用文件
- 避免空泛的指导。像写清晰的内部文档一样写规则
- 当你在对话里反复输入同样的提示词时，把它沉淀为规则
- **引用文件而不是复制其内容**——规则更短，也不会随代码演进而过时

### 规则中要避免的事

- **整本复制风格指南**：用 linter 代替。Agent 本来就知道常见的风格惯例。
- **罗列每一条可能的命令**：Agent 认识 npm、git、pytest 这些常用工具。
- **给极少触发的边界情况写指令**：规则聚焦在常用模式上。
- **复述代码库里已有的内容**：指向典范示例即可，别复制代码。

从简单开始。只有当你注意到 Agent 反复犯同一个错误时才加规则；理解自己的模式之前不要过度优化。

把规则提交进 git，让整个团队受益。看到 Agent 犯错，就更新规则。你甚至可以在 GitHub 的 issue 或 PR 上 `@cursor`，让 Agent 替你更新规则。

## 规则文件格式

每条规则是带 frontmatter 元数据与正文的 Markdown 文件。frontmatter 控制生效方式，正文就是规则本身：

```markdown
---
description: "This rule provides standards for frontend components and API validation"
alwaysApply: false
---
...规则的其余内容
```

`alwaysApply: true` 时规则应用于每一次对话；否则，规则描述会呈现给 Cursor Agent，由它决定是否应用。

## 示例

### 前端组件与 API 校验标准

在 components 目录工作时：

- 一律使用 Tailwind 做样式
- 动画使用 Framer Motion
- 遵循组件命名约定

在 API 目录中：

- 所有校验用 zod
- 用 zod schema 定义返回类型
- 导出由 schema 生成的类型

### Express 服务与 React 组件模板

创建 Express 服务时使用此模板：

- 遵循 RESTful 原则
- 包含错误处理中间件
- 设置好日志

（`@express-service-template.ts`）

React 组件遵循此结构：

- Props 接口放顶部
- 组件用具名导出
- 样式放底部

（`@component-template.tsx`）

### 自动化开发工作流与文档生成

被要求分析应用时：

1. 用 `npm run dev` 启动开发服务器
2. 从控制台取日志
3. 提出性能改进建议

协助起草文档时：

- 抽取代码注释
- 分析 README.md
- 生成 Markdown 文档

### 给 Cursor 加一个设置项（仓库实战示例）

先在 `@reactiveStorageTypes.ts` 里创建开关属性，再在 `@reactiveStorageService.tsx` 的 `INIT_APPLICATION_USER_PERSISTENT_STORAGE` 中加默认值。Beta 功能的开关加在 `@settingsBetaTab.tsx`，否则加在 `@settingsGeneralTab.tsx`。开关可以写成 `<SettingsSubSection>`（通用复选框）。参照文件中其余示例：

```tsx
<SettingsSubSection
  label="Your feature name"
  description="Your feature description"
  value={
    vsContext.reactiveStorageService.applicationUserPersistentStorage
      .myNewProperty ?? false
  }
  onChange={(newVal) => {
    vsContext.reactiveStorageService.setApplicationUserPersistentStorage(
      "myNewProperty",
      newVal,
    );
  }}
/>
```

在应用中使用时，导入 reactiveStorageService 并读取属性：

```ts
const flagIsEnabled =
  vsContext.reactiveStorageService.applicationUserPersistentStorage
    .myNewProperty;
```

各家框架与语言提供方也发布了自己的规则示例；社区众包的规则集合在网上亦有多个仓库。

## 团队规则

Team 与 Enterprise 套餐可以在 Cursor 管理后台为整个组织创建并强制执行规则。管理员可配置某条规则对成员是否必选。

团队规则与其他规则类型并存，且具有更高优先级，以保证组织级标准在所有项目中得到维持。它是在整个团队内统一编码标准、实践与工作流的有力手段——无需每个人单独配置。

管理员在后台直接创建与管理规则；规则创建后自动对全体成员生效，并在后台可见。

> 译注：把"反复纠正过的错误"沉淀为规则、把"示例文件引用而非内容复制"作为规则写法，与本模块第 5 篇 AGENTS.md 的官方建议、第 3 篇 Claude Code 对 CLAUDE.md"像代码一样维护"的要求完全同构——项目规范文件的工程学是跨工具通用的。
