---
title: Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化
source_url: https://github.com/openai/codex
author: OpenAI（openai/codex 仓库 README、docs/、codex-rs/ 源码与提示词模板、GitHub Releases）
license: Apache-2.0（openai/codex 仓库 LICENSE）
fetched_at: 2026-09-19
translated: true
order: 11
group: Cursor 与其他工具
---
Claude Code 之外，被问得最多的终端智能体就是 **Codex CLI**。它和 Claude Code 的心智模型高度相似（都是"读代码 → 改文件 → 跑命令 → 迭代"的智能体循环），但三处设计明显不同：**权限拆成"审批策略 × 沙箱模式"两个正交维度**、**AGENTS.md 是一等公民**（这套规范本来就是 OpenAI 主推的跨工具格式）、**核心完全开源**（Apache-2.0，Rust 实现）。会用 Claude Code 的人学它不需要重学方法论，需要学的是**它自己的开关在哪**。

本篇依据 `openai/codex` 仓库与其源码在 2026-09-19 的当前状态整理：稳定发布 **`rust-v0.155.1`（2026-09-18）**，主线 `0.156.0-alpha` 已在滚动。官方开发者文档站在 `developers.openai.com/codex`，仓库 `docs/` 下的多数页面已改为指向该站的索引页——**本篇的机制描述取自仓库源码里的提示词模板与协议 schema，它们是行为的权威定义**。

## 一、装哪一份：四个 Codex 形态

*以下取自 [openai/codex](https://github.com/openai/codex) 仓库 README。*

| 形态 | 入口 | 说明 |
| --- | --- | --- |
| **Codex CLI** | `codex` | 跑在你本机终端的编码智能体，本仓库本体，开源 Apache-2.0 |
| **IDE 扩展** | VS Code / Cursor / Windsurf | 见 `developers.openai.com/codex/ide` |
| **Codex App** | `codex app` 或 chatgpt.com/codex 落地页 | 桌面应用形态 |
| **Codex Web** | chatgpt.com/codex | 云端智能体（不是本仓库的 CLI） |

安装：

```bash
# macOS / Linux（推荐：官方安装脚本）
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# Windows（PowerShell）
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"

# 包管理器
npm install -g @openai/codex
brew install --cask codex
```

三个细节值得先知道：

1. **独立安装器默认从 `https://releases.openai.com/codex` 下载**，某个元数据或资源拉不到时才回落到 GitHub Releases。想强制走 GitHub Releases，把环境变量 `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM` 设为 `false`（官方说明 `0` 与 `no` 同样有效）：`curl -fsSL https://chatgpt.com/codex/install.sh | CODEX_INSTALLER_USE_RELEASES_OPENAI_COM=false sh`。
2. **GitHub Release 里混着很多可执行文件，你多半只要一个**：macOS Apple Silicon 取 `codex-aarch64-apple-darwin.tar.gz`、Intel 取 `codex-x86_64-apple-darwin.tar.gz`；Linux 取 `codex-x86_64-unknown-linux-musl.tar.gz` 或 `codex-aarch64-unknown-linux-musl.tar.gz`。解压出来的文件名带平台后缀，**要自己 `mv` 成 `codex`** 才能直接调用。
3. 仓库还提供一个 **DotSlash** 文件 `codex`：把"哪个平台用哪个版本的二进制"提交进仓库，可以让同一个项目的协作者强制跑同一个可执行版本——这是 Claude Code 没有的**版本钉死**思路。

系统要求（`docs/install.md`）：macOS 12+、Ubuntu 20.04+/Debian 10+、Windows 11 **需经 WSL2**；Git 可选但推荐（2.23+，内置 PR 辅助命令要用）；内存最低 4 GB、建议 8 GB。

## 二、登录：ChatGPT 套餐优先，API Key 是第二条路

```bash
codex
# 首次运行选择 "Sign in with ChatGPT"
```

官方推荐的用法是**登录 ChatGPT 账号**，作为 Plus / Pro / Business / Edu / Enterprise 套餐的一部分使用 Codex 的额度。用 API Key 也能跑，但要额外配置（见官方 auth 文档），且计费方式变成按 token 走。凭据保存后不需要每次登录。

> 编者注（已标明）：这一条决定了成本归属——**订阅制下你消耗的是套餐额度，`claude --version` 那种"版本决定能用哪些模型"的问题在 Codex 上表现为"套餐决定能用哪些 Codex 模型"**。把 Codex 接进 CI 时要用 API Key 或服务账号，别拿个人登录态去跑流水线。

## 三、三层权限模型：approval_policy × sandbox_mode × execpolicy

这是 Codex 与 Claude Code 差异最大、也最值得先搞清楚的地方。Claude Code 用"权限模式 + 规则白名单"一套东西解决；Codex 把它拆成**两个正交维度**加一个**规则引擎**。下面的取值直接取自仓库里注入模型系统提示的模板文件 `codex-rs/prompts/templates/permissions/`。

**沙箱模式 `sandbox_mode`——决定"能不能"：**

| 取值 | 行为（模板原文要点） |
| --- | --- |
| `read-only` | 沙箱只允许读文件；能不能联网由 `network_access` 单独决定 |
| `workspace-write` | 允许读文件，允许在 `cwd` 与 `writable_roots` 里写；改其他目录需要批准 |
| `danger-full-access` | 不做文件系统沙箱，所有命令放行。名字本身就在劝退 |

**审批策略 `approval_policy`——决定"问不问"：**

| 取值 | 行为 |
| --- | --- |
| `never` | 从不请求批准。模板直接告诉模型"不要为了请求提权而提供 `sandbox_permissions`，命令会被拒" |
| `on-request` | 命令经用户批准、或命中一条已存在的放行规则时，可在沙箱外执行 |
| `unless-trusted` | 除非有显式的 exec policy 规则放行，否则**每条命令都要用户批准** |

**execpolicy——决定"哪条命令算受信任"**。`on-request` 与 `unless-trusted` 都依赖它。这里有一条极易踩的实现细节，模板里写得很清楚：**命令字符串会按 shell 控制符切分成独立片段**——管道 `|`、逻辑运算符 `&&` `||`、分隔符 `;`、子 shell 边界 `(...)`、`$(...)` 都会切开。也就是说，你为 `git` 写的放行规则**不会**自动放行 `curl ... | sh` 里的 `curl`，但反过来，一个被放行的前缀命令如果拼上了子 shell，切分后的每一段都要各自判定。仓库里 `codex-rs/execpolicy/` 就是这个规则引擎的独立 crate。

**怎么组合**：日常开发用 `workspace-write` + `on-request`（改工作区内文件不问，出界才问）；让智能体在 CI 里跑就 `workspace-write` + `never` 并把网络关掉；`unless-trusted` 留给"你在一个不熟悉的仓库里第一次跑它"。

macOS 上沙箱由 Seatbelt（`/usr/bin/sandbox-exec`）实现，子进程会看到 `CODEX_SANDBOX=seatbelt`；被禁用网络时会有 `CODEX_SANDBOX_NETWORK_DISABLED=1`。仓库自己的 `AGENTS.md` 明确写着**禁止改动引用这两个变量的代码**，因为大量集成测试靠它们提前退出——这是读一个开源智能体源码时最好的那种细节：**它直接告诉你沙箱的边界在哪。**

## 四、AGENTS.md：把项目规范写成可分层的文件

Codex 原生读 `AGENTS.md`（这套格式由 OpenAI 等生态方共建，见《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》）。它不是"一个大文件"，而是**分层叠加**：仓库根放全局约定，子目录放该目录专属约定，越靠近被改文件的作用域越具体。`openai/codex` 仓库本身就是示范：根目录 `AGENTS.md` 写 Rust workspace 的编码规范（crate 名前缀 `codex-`、`format!` 必须内联变量、`if` 链要折叠、trait 要写文档注释……），`codex-rs/tui/src/bottom_pane/AGENTS.md` 再写那个局部目录的约定。

三条从它自己的 AGENTS.md 里能学到的写法：

- **把"不许碰什么"写死**：`Never add or modify any code related to CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR`——不是"注意"，是点名禁止。
- **把校验命令交给智能体自己跑**：文中给出 `just fmt`、`just fix -p <crate>`、`just test -p codex-tui`、`just argument-comment-lint`，并明确"多数情况下直接提 PR 让 CI 去查，本地跑反而慢"。**规范里写清楚哪些检查是本地该跑的、哪些交给 CI，能省掉大量无效循环。**
- **写明"什么时候不要写测试"**：`Do not add tests for values that are statically defined`。这类反向约束比"要写测试"有用得多。

## 五、协作模式、Plan 模式与子智能体

- **Collaboration modes**：`codex-rs/collaboration-mode-templates/templates/` 下有 `default.md` 与 `plan.md` 两套模板，即"直接干"和"先给计划再干"两种行为基线。
- **子智能体**：协议 schema 里有 `SubAgentSource`，说明子智能体是**协议层概念**而不只是界面功能——外部客户端（IDE 扩展、app-server）能看见委派关系。
- **Skills**：`docs/skills.md` 指向官方 skills 文档，而仓库自己的 `.codex/skills/` 就是**生产级示范**：`code-review` 是一个编排技能，正文写得很直白——"用子智能体跑评审，**每个 `code-review-*` 技能派一个子智能体**，把完整路径传给子智能体，用 xhigh 推理，必须返回所有发现、每条都要带文件路径与行号"。此外还有 `code-review-breaking-changes`、`code-review-change-size`、`code-review-context`、`code-review-testing` 四个维度技能，以及 `babysit-pr`（盯 PR 评审意见/CI/冲突）。
- **技能的目录形态**：`SKILL.md` + `agents/openai.yaml`（放 `display_name`、`short_description`、`default_prompt`）+ `references/` + `scripts/`。这与 Claude Code / Superpowers 的 `SKILL.md` 属同一开放标准，**可以直接互搬**。`babysit-pr` 的 `default_prompt` 甚至细到"只保留一个 watcher 会话，别把 `--watch` 终端开重复""推完代码要在同一轮里立刻重启 watch""不要把 CI 抖动当成终点"——值得当作写长时运行技能的范本。

## 六、把它接进自动化

- **非交互模式**：`codex exec "..."`（`docs/exec.md` 指向官方 noninteractive 文档），这是进 CI 与脚本的入口；`docs/execpolicy.md` 对应规则引擎。
- **app-server / 协议**：`codex-rs/app-server/` 与 `codex-rs/protocol/` 定义了 CLI、TUI 与外部客户端之间的类型契约；生成的 JSON/TypeScript schema 在 `codex-rs/app-server-protocol/schema/` 下，**协议 v1 文档在 `codex-rs/docs/protocol_v1.md`**。想做自己的前端或编排层，直接读 schema 比猜接口快。
- **Hooks**：协议里已有一等公民的 hook 事件与处理器类型（详见《Claude Code Hooks：用确定性脚本守住智能体循环》一文的跨工具一节）。管理员还能在 `requirements.toml` 里设 `allow_managed_hooks_only = true`，只承认托管来源的 hook、忽略用户/项目/会话级配置——注意官方文档特别写明：**这个键写在 `config.toml` 里不生效**，只有 `requirements.toml` 认。
- **云端任务**：本地 CLI 之外，长任务可交给 Codex Web/App；仓库 `.github/codex/labels/` 下有 `codex-attempt`、`codex-review`、`codex-triage` 等标签定义，即"打标签触发智能体干活"的 PR 工作流。

## 七、常见坑

1. **Windows 只有 WSL2 这条路**。原生 Windows 不在系统要求里，报"装上了但跑不起来"先确认自己是不是在原生 shell 里。
2. **`approval_policy` 和 `sandbox_mode` 不是一回事**。很多人把"不问我"设成 `never` 却发现命令仍被拒——那是沙箱在拦，不是审批在拦。反过来设 `danger-full-access` 配 `never` 等于"全自动且无护栏"，除非是一次性容器，否则不要这么组合。
3. **execpolicy 按片段匹配**。上面说过的管道/子 shell 切分，是白名单"看起来放行却仍然弹窗"的根因。
4. **别用 README 找配置项**。仓库 `docs/config.md` 现在只是一个索引，正文都在 `developers.openai.com/codex/config-*`；真要精确核对行为，读 `codex-rs/` 里的模板与 schema 比读二手总结可靠。
5. **版本很年轻**。0.x 版本号意味着破坏性变更常态化：`0.155.1` 的发布说明就写着"新本地 TUI 会话默认关闭推理摘要，因为有些 provider 不支持而直接拒请求"。**团队里要么钉版本（DotSlash 正是为此），要么接受每周一次的行为漂移。**

## 延伸阅读

- 《AI 编程工具全景对比（2026-09 版）》：Codex 在六家工具里的位置与套餐差异。
- 《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》：本篇第四节所依赖的跨工具规范格式。
- 《Claude Code 权限系统与安全机制》：另一种权限建模（规则 → 模式 → 沙箱），对照读最省力。
- 《Claude Code Hooks：用确定性脚本守住智能体循环》：两家的 hook 事件与处理器类型几乎同构。
- 《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》：`codex exec` 与 CI 接入的通用模式。

---

> **来源**：本文依据 [openai/codex](https://github.com/openai/codex) 仓库（Apache-2.0 许可，作者 OpenAI）2026-09-19 的当前内容整理与翻译，一手材料包括：`README.md`（四个形态、安装脚本、包管理器、登录）、`docs/install.md`（系统要求、DotSlash、源码构建）、`docs/config.md`（managed hooks 与 `requirements.toml`）、仓库根 `AGENTS.md` 与 `codex-rs/tui/src/bottom_pane/AGENTS.md`、`codex-rs/prompts/templates/permissions/approval_policy/*.md` 与 `.../sandbox_mode/*.md`（审批策略与沙箱模式的行为定义）、`codex-rs/app-server-protocol/schema/typescript/v2/`（`HookEventName`、`ConfiguredHookHandler`、`SubAgentSource`）、`.codex/skills/`（`code-review` 系列与 `babysit-pr` 的 `SKILL.md`、`agents/openai.yaml`）、`.codex/environments/environment.toml`，以及 GitHub Releases 中 `rust-v0.155.1`（2026-09-18）的发布说明。官方开发者文档 `developers.openai.com/codex` 在本环境不可直接访问，涉及其内容的表述均改为引用仓库内对应的一手文件，未凭记忆补写。三层权限表的归纳、组合建议、常见坑与延伸阅读为本站编者补充并已标明。抓取于 2026-09-19。
