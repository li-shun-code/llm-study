---
title: AI 编程工具全景对比（2026-09 版）
source_url: https://code.claude.com/docs/en/overview
author: 各工具官方文档（本站编译）：Anthropic Claude Code Docs、Cursor Docs、GitHub Copilot Docs、Cline Docs、Cognition/Devin（Windsurf）Docs、OpenAI Codex
license: 署名编译（各官方文档版权归原厂所有，本文为教学用途的编译与翻译，逐节署名）
fetched_at: 2026-09-13
translated: true
order: 2
group: 概念、工具全景与评测
---
2025 年是"编码智能体（coding agent）"的爆发之年：2 月 Anthropic 发布 Claude Code，4 月 OpenAI 开源 Codex CLI，6 月 Google 发布 Gemini CLI（此时间线引自 Simon Willison）。到 2026 年 9 月，市场已从"编辑器内补全"演进为"多形态智能体"——终端 CLI、IDE 插件、独立 IDE、云端 PR 智能体并存。本文全部依据各家当前官方文档，对比六大主流工具的形态、能力与选型建议。

## 一、Claude Code（Anthropic）

> 译自 [Claude Code 官方文档](https://code.claude.com/docs/en/overview)。

Claude Code 是一个**智能体化编码工具**：读取你的代码库、编辑文件、运行命令、并与你的开发工具集成。可用形态覆盖终端、IDE（VS Code/JetBrains 插件）、桌面应用、浏览器与网页端（云端托管会话）。

2026 年的核心能力版图：

- **扩展机制全家桶**：CLAUDE.md 项目记忆、Skills（可复用技能包）、子智能体（subagents）、hooks、MCP、插件市场（plugins）。
- **多智能体协作**：Agent view（`claude agents` 单屏监督多会话）、Agent Teams（共享任务与消息的会话编队，实验性）、动态工作流（脚本编排大量子智能体）、git worktree 隔离并行。
- **自动化入口**：非交互模式 `claude -p` 可嵌入 CI 与脚本；Headless/Agent SDK 支持 TypeScript 与 Python 编程调用；GitHub Actions 集成可在云端响应 issue/PR。
- **权限与安全**：auto mode（分类器模型代审操作）、沙箱化 Bash、权限白名单、企业级网关与托管配置。

工作流与最佳实践详见《Claude Code 工作流与最佳实践》；Skills 详见《Claude Skills：可复用技能包》；多智能体详见《多智能体协作编码》。

## 二、Cursor（Anysphere）

> 译自 [Cursor 官方文档](https://cursor.com/docs)。

Cursor 是 AI 原生的代码编辑器（基于 VS Code 分支），核心形态是"编辑器内的智能体"。2026 年的能力版图：

- **Agent 体系**：编辑器内 Agent（含 Plan Mode 计划模式、Debug Mode）、Agents Window 多智能体窗口、Agent Review 审查流。
- **Rules 规则系统**：项目规则（`.cursor/rules` 下的 `.mdc` 文件，支持 frontmatter 按 glob/描述/手动四种挂载方式）、用户规则、团队规则，并原生支持 AGENTS.md（详见《Cursor 入门与 Rules 规则系统》）。
- **自定义机制**：Plugins、Skills、Subagents、Hooks、MCP——与 Claude Code 的扩展词汇表已高度趋同。
- **云端智能体**：Cloud Agents（云端跑任务、Builds）、Bugbot（PR 找 bug）、Security Agents、PR Routing & Approval、移动端。
- **其他**：Grok Bot 集成、CLI、Origin、Teams/Enterprise 治理。

## 三、GitHub Copilot（GitHub / Microsoft）

> 译自 [GitHub Copilot 官方文档：What is GitHub Copilot?](https://docs.github.com/en/copilot/get-started/what-is-github-copilot)。

GitHub Copilot 是 AI 编码助手，帮助你更快、更省力地写代码，把精力集中在问题解决与协作上。你可以：

- 在 IDE 中获得打字时的**代码补全建议**。
- 与 Copilot **对话**获得代码帮助。
- 通过**命令行**（GitHub CLI 的 Copilot 扩展）请求帮助。
- 用 **Copilot Spaces** 组织并共享上下文，获得更相关的回答。
- 自动生成**拉取请求描述**。
- 让它**研究、规划、改代码并创建 PR** 供你审查（即 Copilot coding agent，在 GitHub 上以 `@copilot` 认领 issue 产 PR 的形态运行）。

使用场景覆盖 IDE、GitHub Mobile 聊天、Windows Terminal Canary、命令行，以及 **GitHub Copilot App**（面向智能体驱动开发的桌面应用）和 GitHub 网站。访问方式上，个人有 Free/Pro/Pro+/Max 档位，学生、教师与开源维护者可免费获得高级功能；组织与企业用 Copilot Business / Enterprise。Copilot 与 GitHub 仓库、issue、PR 流程的深度耦合是其最大差异化。

## 四、Cline（开源社区）

> 译自 [Cline 官方文档：Cline Overview](https://docs.cline.bot/cline-overview)。

Cline 是一个**开源** AI 编码智能体，活在你的编辑器和终端里：读写文件、运行终端命令、使用浏览器，通过自然对话帮你构建功能。**每个动作都需要你的明确批准**——控制权始终在你手里。

- **模型接入**：主打 BYOK（Bring Your Own Key）——Anthropic、OpenAI（含 Codex OAuth）、DeepSeek、Google Gemini、OpenRouter、阿里 Qwen、智谱 GLM 等 30+ 供应商皆可接入，也提供 Cline 计费、ClinePass 订阅与本地模型（Ollama/LM Studio）路径。对"用国产开源模型跑智能体"的开发者是重要选项。
- **多形态**：IDE 扩展、CLI（交互 TUI 与 headless 自动化）、SDK，以及 **Cline Kanban**（用隔离 git worktree 并行跑多个编码智能体的看板）。
- **CI 生态**：官方提供 GitHub Actions 集成样例——`@cline` 评论响应 issue、自动 PR 审查（详见《开源工具生态：Cline 与 Windsurf》）。

## 五、Windsurf / Devin Desktop（Cognition）

> 译自 [Windsurf（现 Devin Desktop）官方文档：Cascade](https://docs.windsurf.com/windsurf/cascade)。

Windsurf 的 Cascade 是最早把"智能体（Agent）+ 编辑器"做成主打体验的产品之一。2025 年 7 月，Cognition（Devin 的开发商）收购 Windsurf；到 2026 年，Windsurf 编辑器已并入 **Devin Desktop**——官方文档站 docs.windsurf.com 现在直接服务于 Devin Desktop。当前文档中：

- **Cascade** 是 Devin Desktop 内的两个本地智能体之一（另一个是 Devin Local）：`Cmd/Ctrl+L` 唤起，分 **Code 模式**（可直接修改代码库）与 **Chat 模式**（围绕代码库提问，也可建议代码供你采纳插入）。
- **内置规划能力**：后台有专职规划智能体持续打磨长期计划，所选模型专注短期动作；复杂任务会在对话中生成 Todo 列表跟踪进度，并随新信息（如 Memories 记忆）自动更新。
- 支持网页搜索、MCP 服务器扩展、模型下拉切换。

> 时效注记：对比 2024 年的旧资料，"Windsurf 独立存在"的叙述已过时——当前语境应为"Cognition 旗下的 Devin Desktop（原 Windsurf）"。工具换代之快，正说明跟官方文档而非旧评测的重要性。

## 六、OpenAI Codex

> 译自 [openai/codex 官方仓库 README](https://github.com/openai/codex)（Apache-2.0 许可）。

Codex 是 OpenAI 的编码智能体家族，当前包含：

- **Codex CLI**：本地运行的命令行编码智能体，一键安装脚本或 `npm install -g @openai/codex`、Homebrew 均可安装；开源（Apache-2.0）。
- **IDE 扩展**：进入 VS Code、Cursor、Windsurf 等编辑器。
- **Codex App / `codex app`**：桌面应用形态；**Codex Web**（chatgpt.com/codex）：云端智能体。
- **账号体系**：推荐用 ChatGPT 账号登录（Plus/Pro/Business/Edu/Enterprise 套餐内含用量），也可改用 API Key。
- **模型**：仓库内提示词模板与模型指令文件当前覆盖 `gpt-5-codex`、`gpt-5.1-codex-max`、`gpt-5.2-codex` 这一条 Codex 专用线；各家通用列表见下一节。
- **权限建模**：把"能不能"（`sandbox_mode`：`read-only` / `workspace-write` / `danger-full-access`）与"问不问"（`approval_policy`：`never` / `on-request` / `unless-trusted`）拆成两个正交维度，再加一个按 shell 控制符切分匹配的 execpolicy 规则引擎。

Codex CLI 是三巨头 CLI（Claude Code、Codex CLI、Gemini CLI）中唯一完全开源核心的，且与 agents.md 规范（《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》）同源 OpenAI 系。深度用法见《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》。

## 模型清单与订阅价格（2026-09 核实）

选型时最先要问的两句是"**能跑哪些模型**"和"**我要付多少**"。下表按各家**当前官方文档 / 定价页**核对，价格不含税、随版本变动最快，请把它当成"去核对的索引"而不是"记住的数字"。

**Claude Code（Anthropic）**。终端会话可用模型由 **provider + 账号类型**共同决定：别名 `opus` / `sonnet` / `haiku` / `fable` 在不同 provider 上解析到不同版本——`opus` 在 Anthropic API、Claude Platform on AWS、Amazon Bedrock、Google Cloud 的 Agent Platform 上是 **Opus 5**，在 Microsoft Foundry 上只到 **Opus 4.6**；`sonnet` 在 Anthropic API 上是 **Sonnet 5**，在 AWS 上是 Sonnet 4.6，其余云上是 Sonnet 4.5。当前在售的模型线是 **Fable 5.1 / Fable 5（面向长时自主任务的最强档）、Opus 5、Opus 4.8、Sonnet 5、Haiku 4.5**。会话默认模型按账号解析：Max、Team Premium、Enterprise 与 API 默认 **Opus 5**，Pro 与 Team Standard 默认 **Sonnet 5**，Foundry 默认 Sonnet 4.5。**版本有门槛**：Opus 5 要 Claude Code v2.1.219+、Sonnet 5 要 v2.1.197+、Opus 4.8 要 v2.1.154+。

| 订阅/API | 价格 | 备注 |
| --- | --- | --- |
| Free | $0 | 不含 Claude Code |
| Pro | $17/月（年付，$200 一次付清）或 $20/月（月付） | 默认 Sonnet 5 |
| Max | $100/月起 | 可选 5× 或 20× Pro 用量；默认 Opus 5 |
| Team 标准席 | $20/席位·月（年付）或 $25（月付） | |
| Team Premium 席 | $100/席位·月（年付）或 $125（月付） | 5× 标准席用量 |
| API 按 token | Opus 5 $5 / $25、Sonnet 5 $2 / $10、Haiku 4.5 $1 / $5（每百万 token 输入/输出）；Fable 5.1 $10 / $50 | 提示缓存读 $0.20–$0.50、写为标准输入价的 1.25× |

**Cursor（Anysphere）**。支持 OpenAI、Anthropic、Google 等前沿模型，同时主推**自家模型池**：**Cursor Grok 4.6 / Grok 4.5**（与 SpaceXAI 联合训练）与 **Composer 2.5**。个人套餐 **Pro $20/月、Pro Plus $60/月、Ultra $200/月**，另有面向印度开发者的 Start（₹649/月）；**两个独立用量池**——"Cursor Models"池给得很宽松，"Other Models"池按所选模型的 API 价扣。团队 **Teams 标准席 $40/人·月、Premium 席 $120/人·月**（Agent 限额 5×）。**Auto 路由有三档：Cost / Balance / Intelligence**。企业注意：Teams/Enterprise 上用第三方模型要额外付 **Cursor Token Rate $0.25/百万 token**（自家 Grok、Composer 免收）。Anthropic 系模型在 Cursor 侧的价格与官方 API 一致（如 Claude Opus 5 $5/$25、Claude Sonnet 5 $2/$10、Claude Fable 5.1 $10/$50）。

**GitHub Copilot（GitHub）**：个人 Free / Pro / Pro+ / Max 档位，学生、教师与开源维护者可免费获得高级功能；组织与企业用 Copilot Business / Enterprise。

**Cline / Devin Desktop / Codex**：Cline 走 BYOK，付的是模型供应商的 API 价（或本地模型零边际成本），另有 Cline 计费与 ClinePass 订阅；Devin Desktop 绑定 Cognition 自家模型（SWE-1.5 等）；Codex CLI 用 ChatGPT 套餐额度或 API Key。

> 编者注（已标明）：**"订阅包含用量"不等于"无限"**。三家（Claude、Cursor、Copilot）都在 2025–2026 年从"按请求数"转向"按 token 用量池 + 超额按需付费"，同一档位里选 Opus/Fable 还是 Haiku/Composer，能跑的时长可以差一个数量级——把预算花在哪一层，见《成本管理：Token 消耗、订阅选择与用量优化》。

## 横向对比

**表：六大 AI 编程工具横向对比（2026-09）**

| 维度 | Claude Code | Cursor | GitHub Copilot | Cline | Windsurf/Devin Desktop | Codex |
| --- | --- | --- | --- | --- | --- | --- |
| 形态 | 终端/IDE/桌面/Web | 独立 IDE（VS Code 分支） | IDE 插件+GitHub 内置+桌面 App | VS Code 扩展+CLI+Kanban | 独立 IDE（并入 Devin Desktop） | CLI/IDE 扩展/Web/桌面 |
| 主导交互 | 自然语言智能体循环 | 编辑器内 Agent+补全 | 补全+Chat+云端认领 issue | 批准制智能体循环 | Cascade 规划式智能体 | 智能体循环（本地+云端） |
| 项目规范文件 | CLAUDE.md（兼读 AGENTS.md） | `.cursor/rules`（.mdc）+AGENTS.md | `.github/copilot-instructions.md` | `.clinerules` | Memories/规则 | AGENTS.md |
| 开源程度 | 闭源（SDK/CLI 分发） | 闭源 | 闭源 | **核心开源（Apache-2.0）** | 闭源 | **CLI 开源（Apache-2.0）** |
| BYOK/自带模型 | 企业网关/Bedrock 等 | 有限 | 否（订阅为主） | **30+ 供应商/本地模型** | 有限 | API Key 或 ChatGPT 套餐 |
| 云端 PR 智能体 | GitHub Actions/Web 会话 | Cloud Agents/Bugbot | coding agent（`@copilot`） | GitHub Actions 样例 | Devin 云端 | Codex Web |
| 多智能体 | Agent Teams/Workflows/Worktrees | Agents Window | 多请求并行（Spaces 管理上下文） | Kanban+worktrees | 单会话为主 | 并行任务 |
| 深度绑定 | Anthropic 模型 | 多模型可选 | GitHub 全家桶 | 任意模型 | Cognition 模型（SWE-1.5 等） | OpenAI 模型 |

> 表中"项目规范文件"一列会在《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》里展开；各工具的 Rules/Skills/MCP 扩展词汇正在快速趋同——学透一个，迁移成本很低。

## 选型建议

结合官方文档与社区共识，给出几条务实的选型线索：

1. **深度终端工作流 / 大型代码库重构**：Claude Code 或 Codex CLI 这类 CLI 智能体最顺手，headless 模式还能进 CI。
2. **想要编辑器一体体验、强规则工程**：Cursor 的 Rules 体系（《Cursor 入门与 Rules 规则系统》）目前最细；Devin Desktop（原 Windsurf）的规划智能体体验也自成一路。
3. **代码已在 GitHub、以 issue/PR 为中心协作**：Copilot coding agent 的"认领 issue → 开 PR"与 GitHub 流程零摩擦。
4. **预算敏感 / 想用国产开源模型 / 要求数据自持**：Cline 的 BYOK + 本地模型路径独一无二，且核心开源可审计。
5. **团队规范统一**：优先采用 AGENTS.md 这类跨工具标准（《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》），避免规范文件被单一工具锁定。

> 无论选哪把锤子，跨工具通用的方法论都在站内其它文章里：可验证的完成标准（《Claude Code 工作流与最佳实践》）、Git 存档与隔离（《Git in AI 工作流：commit 即存档、worktree 隔离与审查流》）、Spec 驱动（《Spec 驱动开发（Spec-Driven Development）》）、上下文管理（《上下文工程：为 AI Agent 管理稀缺的注意力》）。

---

> **来源**：本文为编译稿，主体译自六家工具的官方文档：[Claude Code Overview](https://code.claude.com/docs/en/overview) 与 [Model configuration](https://code.claude.com/docs/en/model-config)（Anthropic）、[Cursor Docs：Models & Pricing](https://cursor.com/docs/models-and-pricing) 与 [Agent](https://cursor.com/docs/agent/overview)（Anysphere）、[What is GitHub Copilot?](https://docs.github.com/en/copilot/get-started/what-is-github-copilot)（GitHub）、[Cline Overview](https://docs.cline.bot/cline-overview)（Cline）、[Cascade / Devin Desktop](https://docs.windsurf.com/windsurf/cascade)（Cognition）、[Codex CLI](https://github.com/openai/codex)（OpenAI，Apache-2.0）；订阅与 API 价格另核自 [Claude Pricing](https://claude.com/pricing)（Anthropic）与 [Cursor Models & Pricing](https://cursor.com/docs/models-and-pricing)（Anysphere）。作者为各工具官方文档，许可署名编译（各官方文档版权归原厂所有，本文为教学用途的编译与翻译，逐节署名）。工具能力部分抓取于 2026-09-13，模型清单与价格部分核对于 2026-09-19。
