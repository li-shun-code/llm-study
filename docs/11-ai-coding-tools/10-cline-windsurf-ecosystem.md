---
title: 开源工具生态：Cline 与 Windsurf
source_url: https://docs.cline.bot/cline-overview
author: Cline Bot Inc.（Cline 官方文档）；Cognition（Devin Desktop/Cascade 官方文档）；Microsoft（VS Code README/LICENSE）
license: 署名翻译（Cline/Cognition/Microsoft 官方文档与仓库资料版权归原厂所有，教学用途编译翻译并署名；对比表与收束为本站编者内容并已标明）
fetched_at: 2026-09-13
translated: true
order: 10
group: Cursor 与其他工具
---
**编者按**：Headless 与 CI 的话题已全部移至《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》），本篇收敛为**开源工具生态的选型对比**：两家非 Anthropic/OpenAI 系的代表——开源的 Cline 与并入 Cognition/Devin Desktop 的 Windsurf。正文主体译自两家的官方文档，另译 VS Code 官方仓库的"Code-OSS 与 Visual Studio Code"说明作背景（为什么编辑器分叉生态会长成今天这样）。对比表与收束一节为本站编者内容，已标明。

## 一、背景：编辑器生态的 fork 结构（译自 VS Code 官方仓库）

*译自 [microsoft/vscode README](https://github.com/microsoft/vscode)（MIT 许可）。理解这一节，才能理解 Cline（装进各家编辑器的扩展）与 Windsurf（编辑器分叉）两条路线的分野。*

> 本仓库（"`Code - OSS`"）是 Microsoft 与社区共同开发 Visual Studio Code 的地方。我们不仅在这里处理代码与 issue，还发布路线图（roadmap）、月度迭代计划（iteration plans）与收官计划（endgame plans）。源码对所有人以标准 MIT 许可开放。

> Visual Studio Code 是 `Code - OSS` 仓库的一个发行版（distribution），带有 Microsoft 专属定制，以传统 Microsoft 产品许可发布。

也就是说：编辑器的"上游内核"是 MIT 开源的 Code-OSS；你实际下载的 Visual Studio Code 是带品牌与专属定制的发行版。Cursor、Windsurf 都属于"从 Code-OSS 分叉并做深度定制"的路线，Cline 则选择了"做扩展，装进任何一家"的路线——包括 VS Code、Cursor、Windsurf、VSCodium、Antigravity 与 JetBrains 全家。

## 二、Cline：开源 BYOK 智能体的完整工具链（译自官方文档）

### Cline 是什么

*译自 [Cline Overview](https://docs.cline.bot/cline-overview)。*

Cline 是一个活在你编辑器与终端里的 AI 编码智能体：读写文件、运行终端命令、使用浏览器，通过自然对话帮你构建功能。**每个动作都需要你的明确批准。控制权始终在你手里。**

模型接入按你的工作流选择三条路径之一：

* **Cline（用量计费）**：最快的上手路径，一次登录、内置计费、含免费模型选项。
* **ClinePass**：每月 9.99 美元的固定订阅，热门开源编码模型的用量是标准 API 费率的 2-5 倍。
* **BYOK（自带密钥）**：使用你自己的云提供商凭据或本地运行时（Anthropic、OpenAI（含 Codex OAuth）、DeepSeek、Gemini、OpenRouter、Qwen、Z AI（智谱 GLM）等 30+ 供应商，以及 Ollama/LM Studio 本地模型）。

### 四种应用形态

*译自 Cline 官方文档《Installing Cline》《Cline Overview》。*

* **IDE 扩展**：编辑器内的 AI 编码助手（VS Code Marketplace 与 JetBrains Marketplace 均可安装；Windsurf 与 VSCodium 走 Open VSX，安装流程相同）。创建文件、运行命令、浏览网页、用工具——全部经"人在回路"批准。
* **CLI**：`npm i -g cline` 安装，交互聊天或完全 headless 的 CI/CD 与脚本自动化。
* **Kanban**：`npx kanban` 启动的网页任务板，每张卡片一个隔离 worktree，自动提交与依赖链。
* **SDK（Agent Core）**：`npm install @cline/sdk`，用驱动 CLI、Kanban 与两个官方插件的同一核心引擎构建你自己的应用与集成。

此外 Cline 经 **ACP（Agent Client Protocol）** 模式接入 Zed、JetBrains IDE（AI Assistant）、Neovim、Emacs 等任何支持该开放标准的客户端：客户端以 `cline --acp` 拉起进程、经 stdio 通信——终端里同一个智能体，嵌进你已在用的工具。

### CLI：交互与 headless 双模式

*译自 [CLI Overview](https://docs.cline.bot/usage/cli-overview)。*

```bash
# 交互会话
cline

# 立即执行一个任务
cline "refactor this module to use async/await"

# 给脚本的结构化输出
cline --json "list TODO comments"
```

**headless 模式**在以下情况自动触发：使用 `--json` 等旗标、stdin 被管道、或输出被重定向（如 `cline "task" > output.txt`）。CI/脚本风格的执行：

```bash
git diff | cline "review these changes"
cline --json "summarize this changelog" | jq -r '.text'
```

**自主执行**用自动批准实现：`cline --auto-approve true "run tests and fix failures"`。模式选择在 headless 下同样有效：`cline -p "design migration plan"`（先计划）/ `cline "apply migration"`（直接执行，默认）。

> 警告（官方原文）：自主执行可以在不再提示的情况下修改文件、运行命令。请使用干净的分支并审查结果。

高价值命令：`cline auth`（认证并选提供商/模型）、`cline config`、`cline mcp`、`cline doctor`（诊断配置）、`cline history`、`cline schedule`（定时任务）、`cline kanban`。常用全局旗标：`-p/--plan`（计划模式起跑）、`--auto-approve`（默认 true）、`-m/--model`、`-P/--provider`、`--json`（按行输出 JSON 消息）、`--thinking <level>`（推理力度 none|low|medium|high|xhigh）、`-t/--timeout`。

自动化模式样例（官方原文）：管道注入上下文（`cat README.md | cline "summarize key setup steps"`）、任务串联（`git diff | cline "explain these changes" | cline "write a commit message"`）、限制命令执行（`CLINE_COMMAND_PERMISSIONS` 的 allow/deny 列表，如允许 `npm *`、`git *`，拒绝 `rm -rf *`、`sudo *`）、任务附图（`cline -i "fix the layout issue shown in @./screenshot.png"`）、设超时（`cline --timeout 600 "run full test suite"`）。

`--json` 输出每行一个 JSON 消息对象，字段含 `type`（"ask"/"say"）、`text`、`ts`、`say`/`ask` 子类型、`reasoning`（可选模型推理）、`partial`（流式标记）。

### Kanban：隔离 worktree 的并行看板

*译自 [Kanban](https://docs.cline.bot/usage/kanban)（研究预览）。*

```bash
cd /path/to/your/repo
npx kanban
```

启动本地服务器并在浏览器打开任务板。核心工作流：在板上**创建任务**（手动或经侧栏聊天）→ 用 play **启动任务**（每张卡片获得一个隔离 git worktree + 终端）→ 从卡片状态与最新智能体输出**监控进度** → 在卡片详情里**评审 diff**并可对 diff 行内评论 → 经 Commit 或 Open PR **交付改动** → 把卡片移入回收站完成清理（worktree 一并移除）。

关键能力：**并行执行**（每任务一个独立 worktree，避免冲突）；**任务链接**（依赖链自动启动下一个任务）；**行内评审循环**（直接在 diff 行上评论以引导智能体）；**自动提交/自动 PR**（可选自动化）；**侧栏聊天编排**（让智能体把工作拆成卡片并启动流程）。智能体兼容性：面向 CLI 型编码智能体设计，当前支持 Cline CLI、Claude Code、Codex、OpenCode 等运行时（在设置中选择）。

## 三、Windsurf：并入 Devin Desktop 的 Cascade（译自 Cognition 官方文档）

*译自 [Devin Desktop 文档：Cascade](https://docs.windsurf.com/windsurf/cascade)（2026-09 当前版；2025 年 7 月 Cognition 收购 Windsurf 后，原 Windsurf 编辑器已演进为 Devin Desktop，docs.windsurf.com 现直接服务 Devin Desktop 文档）。*

> Cascade 是 Devin Desktop 的智能体化 AI 助手，具备 Code/Chat 双模式、工具调用、语音输入、检查点、实时感知与 linter 集成。Devin Desktop 的 Cascade 开启了人与 AI 协作的新层级。

Cascade 是 Devin Desktop 中的**两个本地智能体之一**；另一个是 Devin Local（未选偏好智能体时，新标签页默认使用它）。按 `Cmd/Ctrl+L` 或点击窗口右上角的 Cascade 图标打开；编辑器或终端中选中的文本会自动并入对话。工作区处于受限模式（Restricted Mode）时，Cascade、Devin Local 与所有其他 ACP 智能体均不可用。

**功能速览**（官方文档"Quick links"原文）：网页搜索（为建议引用的网上信息）；Memories 与 Rules（定制行为）；MCP（扩展智能体能力）；终端（升级的终端体验）；Workflows（自动化重复轨迹）；应用部署（一键部署应用）。

**模型选择**：在 Cascade 对话输入框下方的选择菜单中选模型；各模型在不同计划与定价下的可用性见官方 Models 页。

**Code / Chat 双模式**：Code 模式允许 Cascade 创建并修改你的代码库；Chat 模式针对围绕代码库或通用编码原则的提问优化。Chat 模式下 Cascade 也可能向你建议新代码，你可以接受并插入。

**计划与 Todo 列表**：Cascade 内置规划能力以改善长任务的性能。后台有一个专职规划智能体持续打磨长期计划，而你选的模型专注按该计划执行短期动作。复杂任务会在对话中生成 Todo 列表跟踪进度；让它修改计划，直接说更新 Todo 即可。对话中获取到新信息（如 Memory）时，Cascade 也可能自动更新计划。

**排队消息**：等 Cascade 完成当前任务时，可以排队新消息，任务完成后按序执行。输入消息按 Enter 入队；空文本框再按 Enter 立即发送；发送前可删除任何队列消息。

**工具调用**：Cascade 拥有 Search、Analyze、Web Search、MCP、终端等多种工具。它能检测你在用哪些包与工具、哪些需要安装，甚至代你安装——直接问它怎么运行你的项目，然后按 Accept。每个提示词最多 20 次工具调用；轨迹停止时按 continue 按钮从断点继续（每次 continue 因工具调用成本计一次新的提示词额度）；可配置 Auto-Continue 让它在触顶时自动继续。

**语音输入**：当前形态为语音转文字。

**命名检查点与回滚**：可以把鼠标悬停在原始提示词上点回滚箭头，或从目录（table of contents）直接回滚——所有代码改动会回到目标步骤时的代码库状态。回滚当前不可逆，请小心！也可以在对话中为项目当前状态创建命名快照/检查点，随时跳转与回滚。

**实时感知**：Devin Desktop 与 Cascade 的独特能力——它感知你的实时动作，无需为先前动作补充上下文，直接说"Continue"即可。

**把问题发给 Cascade**：编辑器下方 Problems 面板出现问题时，点 Send to Cascade 按钮即可把问题交给它处理。

> 时效注记（编者，已标明）：2024 年及以前的"Windsurf 独立产品"类对比文章已过时——引用任何工具对比前，先确认该工具 2025-2026 的归属与形态变迁（《AI 编程工具全景对比（2026-09 版）》按 2026-09 现状对比了六家工具）。

## 四、横向对比与选型（本站编者内容）

> 本节为本站编者依据上述官方文档整理，非翻译。

**表：Cline 与 Windsurf/Devin Desktop 生态对比（2026-09）**

| 维度 | Cline | Windsurf / Devin Desktop |
| --- | --- | --- |
| 开源程度 | **核心开源（Apache-2.0）**，GitHub 可审计 | 闭源（编辑器为 Code-OSS 的分叉） |
| 形态 | VS Code/JetBrains 扩展 + CLI + Kanban + SDK + ACP | 独立桌面 IDE（原 Windsurf） |
| 接入编辑器 | 任何主流编辑器（含 Cursor、Windsurf、Zed、Neovim） | 自家 Devin Desktop |
| 模型接入 | BYOK 30+ 供应商 / 本地模型 / ClinePass 订阅 | Cognition 自有模型（SWE-1.5 等）与内置选择 |
| 批准模型 | 默认每动作批准；`--auto-approve` 显式开启自主 | Code 模式直接改码，检查点+回滚兜底 |
| 并行智能体 | Kanban（每卡一 worktree，支持 Claude Code/Codex 等混跑） | Cascade/Devin Local 双智能体 + 云端 Devin |
| 安全边界 | CLINE_COMMAND_PERMISSIONS allow/deny、人工批准 | 工作区受限模式、检查点/回滚 |
| 适合谁 | 预算敏感、要求数据自持、想用国产/开源模型、多编辑器混用 | 想要"编辑器即智能体"一体体验、偏好图形化规划与检查点 |

收束两句话：**分叉（Windsurf/Devin Desktop）换取深度整合，扩展（Cline）换取普适与开放**——两条路线没有绝对优劣，绑定成本与可迁移性才是决策变量。工具会继续换名字（《Vibe Coding 是什么：概念源起与工程争议》写下之后这两年就发生了 Windsurf→Cognition 一例），方法论不会：无论选谁，"批准模型 + 可验证完成标准 + Git 存档"这套骨架——见《Claude Code 工作流与最佳实践》《Claude Code 权限系统与安全机制》《第一次 AI 结对：从零做一个命令行小工具》与《Git in AI 工作流：commit 即存档、worktree 隔离与审查流》——原样适用。Headless 与 CI 形态见《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》。

---

> **来源**：本文第一节译自 [microsoft/vscode README](https://github.com/microsoft/vscode)（MIT 许可），第二节译自 [Cline Overview](https://docs.cline.bot/cline-overview)、《Installing Cline》、《CLI Overview》、《Kanban》（Cline 官方文档，Cline Bot Inc.），第三节译自 [Cascade / Devin Desktop 文档](https://docs.windsurf.com/windsurf/cascade)（Cognition）。均为官方文档/仓库资料的教学用途翻译并署名。开头编者按、时效注记与第四节"横向对比与选型"为本站编者内容并已标明。抓取于 2026-09-13。
