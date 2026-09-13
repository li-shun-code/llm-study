# 模块 11 · Vibe Coding（11-vibe-coding）来源报告

抓取日期：2026-09-13（初版 16 篇；同日扩充至 26 篇；同日第二轮重做 3 篇、去重改写 1 篇、新增 3 篇至 29 篇）。全部通过 `node scripts/check-frontmatter.mjs docs/11-vibe-coding`（PASS, 29 articles）。

## 编号调整说明（2026-09-13 第二轮）

在 26 篇基础上：03 位插入「评测基准」新篇，24 位（原 23 安全陷阱）之后插入「供应链安全」与「IP 与合规」两篇新篇，全模块重排为 01-29；两段式重命名，frontmatter `order` 与全模块"第 N 篇"交叉引用已同步改号。本表所有"现编号"均为重排后的编号。

| 变更 | 现编号 | 说明 |
| --- | --- | --- |
| 重做 | 05《第一次 AI 结对》 | 原文为编者设计的实操；重做为 Claude Code 官方 Quickstart 与 Common workflows **两页完整翻译**为主体，编者过渡最少化并在文末保留已标明的"从零实战对照"小节 |
| 重做 | 23《Headless 与 CI》 | 重做为官方 Headless 页 + Agent SDK overview + GitHub Actions 核心章节 + GitHub Copilot cloud agent（现 docs 页）**完整/核心章节翻译**为主体，编者内容仅按语与文末已标明编者注 |
| 重做 | 29《从 0 到 1 用 AI 做产品》 | 原为 ghuntley 文章节译+编者清单；重做为 ghuntley.com/dothings/ **全文完整翻译**（经 Web Reader 抓取全文，原"付费后半部分"实际全文可得），编者清单移至文末编者注 |
| 去重改写 | 22《开源工具生态：Cline 与 Windsurf》 | 原第 21 篇"工具链生态"与 Headless/CI 重复；Headless 节整体并入现 23，本篇收敛为纯生态对比（Cline 官方文档、Devin Desktop/Cascade 官方文档、microsoft/vscode README fork 背景，完整翻译），对比表与收束为编者内容已标明 |
| 新增 | 03《AI 编码工具与模型评测基准》 | SWE-bench README（MIT，raw）+ Terminal-Bench README（Apache-2.0，raw）+ Anthropic Sonnet 4.5 官方公告与 OpenAI GPT-5 for developers 官方公告的 benchmark 章节（逐节署名翻译），插到工具全景之后 |
| 新增 | 25《AI 编码供应链安全》 | Simon Willison 幻觉包/slopsquatting 三篇（署名翻译）+ Lasso Security、Spracklen et al.（USENIX Security 2025）、Trend Micro 公开研究转述 + Claude Code 官方 Security/Sandboxing 防线章节，插到安全陷阱之后 |
| 新增 | 26《AI 生成代码的 IP 与合规》 | Microsoft"Copilot Copyright Commitment"官方公告全文（署名翻译）+ GitHub 官方 Copilot 负责任使用文档 IP 章节 + 美国版权局 Part 2 报告执行摘要（美国政府作品公共领域），插到供应链安全之后 |

## 来源与许可

### 初版 16 篇（现编号 01/02/07/09/11/12/13/14/15/18/19/20/22/24/29 等）

| 来源 | 用途（现编号） | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Simon Willison 博客](https://simonwillison.net/2025/Mar/19/vibe-coding/)《Not all AI-assisted programming is vibe coding》（2025-03-19，含 Karpathy 原始推文全文引用） | 01 主来源（全文翻译） | 作者博客允许署名引用转载 | 01 frontmatter + 署名块 |
| [Simon Willison 博客](https://simonwillison.net/2025/Oct/7/vibe-engineering/)《Vibe engineering》（2025-10-07，含 2026-02-23 "Agentic Engineering" 更新） | 01 延伸节（节译）、13 引言、21 相关观点 | 同上署名转载 | 01/13 署名块并列标注 |
| 各工具官方文档（编译对比）：[Claude Code Overview](https://code.claude.com/docs/en/overview)、[Cursor Docs](https://cursor.com/docs)、[GitHub Copilot Docs](https://docs.github.com/en/copilot/get-started/what-is-github-copilot)、[Cline Overview](https://docs.cline.bot/cline-overview)、[Cascade/Devin Desktop Docs](https://docs.windsurf.com/windsurf/cascade)、[openai/codex README](https://github.com/openai/codex)（Apache-2.0） | 02 全文（编译+局部翻译，工具现状经联网核实为 2026-09：Windsurf 已并入 Cognition Devin Desktop 等） | 各版权归原厂，编译署名 | 02 frontmatter + 署名块列全部 URL |
| [Claude Code Docs: Best practices](https://code.claude.com/docs/en/best-practices) | 07 全文翻译 | 官方文档 Copyright Anthropic PBC，署名翻译 | 07 frontmatter + 署名块 |
| [Cursor Docs: Rules](https://cursor.com/docs/context/rules) | 09 全文翻译 | 官方文档署名翻译 | 09 frontmatter + 署名块 |
| [agents.md 官方站](https://agents.md/)（现由 Linux 基金会 Agentic AI Foundation 托管） | 11 主来源（全文翻译） | 开放格式说明文档 | 11 frontmatter + 署名块 |
| [Claude Code Docs: Memory](https://code.claude.com/docs/en/memory)（CLAUDE.md 部分） | 11 延伸节（节译） | 官方文档署名翻译 | 11 署名块并列标注 |
| [Claude Code Docs: Skills](https://code.claude.com/docs/en/skills) | 12 主体翻译 | 官方文档署名翻译 | 12 frontmatter + 署名块 |
| [Claude Code Docs: Worktrees](https://code.claude.com/docs/en/worktrees) | 13 主来源（节译，核心章节全译） | 官方文档署名翻译 | 13 frontmatter + 署名块 |
| [Geoffrey Huntley 博客](https://ghuntley.com/ralph/)《Ralph Wiggum as a "software engineer"》 | 13 引言、14 延伸节（摘译） | 署名转载 | 13/14 署名块并列标注 |
| [github/spec-kit](https://github.com/github/spec-kit) README（raw 抓取，2026-08 发布 1.0.0） | 14 主来源（主体翻译） | MIT | 14 frontmatter + 署名块 |
| [Anthropic Engineering: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | 15 全文翻译 | 官方博客署名翻译 | 15 frontmatter + 署名块 |
| [Claude Code Docs: MCP](https://code.claude.com/docs/en/mcp) | 19 主体翻译 | 官方文档署名翻译 | 19 frontmatter + 署名块 |
| [Claude Code Docs: Code Review](https://code.claude.com/docs/en/code-review) | 20 主体翻译 | 官方文档署名翻译 | 20 frontmatter + 署名块 |
| [Kent Beck, tidyfirst.substack.com](https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes)《Augmented Coding: Beyond the Vibes》（2025-06-25，经 Web Reader 抓取） | 18 全文翻译 | 作者公开博客署名翻译 | 18 frontmatter + 署名块 |
| [Claude Code Docs: Agent Teams](https://code.claude.com/docs/en/agent-teams) | 21 主来源（主体翻译） | 官方文档署名翻译 | 21 frontmatter + 署名块 |
| [Simon Willison《Embracing the parallel coding agent lifestyle》](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/) | 21 引言（摘译） | 署名转载 | 21 署名块并列标注 |
| [Simon Willison《OpenAI's accidental cyberattack against Hugging Face…》](https://simonwillison.net/2026/Jul/22/openai-cyberattack/)（2026-07-22） | 24 主来源（全文翻译；文末"编者按"表为本站补充并已标明） | 署名转载 | 24 frontmatter + 署名块 |
| [Geoffrey Huntley《The future belongs to people who can just do things》](https://ghuntley.com/dothings/)（2025-02-06/2025-06-08；经 Web Reader 抓取**全文**） | 29 主来源（**全文完整翻译**，2026-09-13 第二轮由节译升级） | 署名转载 | 29 frontmatter + 署名块 |
| [Cline Docs](https://docs.cline.bot/cline-overview) 与 [Windsurf/Devin Desktop Docs: Cascade](https://docs.windsurf.com/windsurf/cascade) | 22 生态主体（2026-09-13 第二轮改写为纯生态篇） | 各官方文档署名翻译 | 22 署名块列明 |

### 扩充新增 10 篇（2026-09-13 第一轮）

| 来源 | 用途（现编号） | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Claude Code Docs: Quickstart](https://code.claude.com/docs/en/quickstart) + [Advanced setup](https://code.claude.com/docs/en/setup) | 04 主来源（安装/登录/系统要求节全文翻译） | 官方文档署名翻译 | 04 frontmatter + 署名块 |
| [Cursor Docs: Quickstart](https://cursor.com/docs/get-started/quickstart) | 04 次来源（Cursor 安装/首跑节全文翻译） | 官方文档署名翻译 | 04 署名块列明 |
| [Claude Code Docs: How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works) | 06 主来源（智能体循环/工具/访问边界/上下文窗口核心章节全文翻译） | 官方文档署名翻译 | 06 frontmatter + 署名块 |
| [Claude Code Docs: Explore the context window](https://code.claude.com/docs/en/context-window) | 06 次来源 | 官方文档署名翻译 | 06 署名块列明 |
| [Claude Code Docs: Permissions](https://code.claude.com/docs/en/permissions) | 08 主来源（权限系统/规则语法/工作目录核心章节全文翻译） | 官方文档署名翻译 | 08 frontmatter + 署名块 |
| [Claude Code Docs: Permission modes](https://code.claude.com/docs/en/permission-modes)、[Sandboxing](https://code.claude.com/docs/en/sandboxing) | 08 次来源 | 官方文档署名翻译 | 08 署名块列明 |
| [Cursor Docs: Agent Overview](https://cursor.com/docs/agent/overview)、[Plan Mode](https://cursor.com/docs/agent/plan-mode)、[Debug Mode](https://cursor.com/docs/agent/debug-mode)、[Agent Review](https://cursor.com/docs/agent/agent-review)、[Prompting agents](https://cursor.com/docs/agent/prompting) | 10 主来源（五页编译翻译） | 官方文档署名翻译 | 10 frontmatter + 署名块 |
| [Cursor 帮助文档: Tab completion](https://cursor.com/help/ai-features/tab) | 10 第一节 | 官方文档署名翻译 | 10 署名块列明 |
| [Filippo Valsorda《Claude Code Can Debug Low-level Cryptography》](https://words.filippo.io/claude-debugging/)（2025-11-01） | 16 主来源（全文翻译） | 作者公开博客署名翻译 | 16 frontmatter + 署名块 |
| [Claude Code Docs: Common workflows](https://code.claude.com/docs/en/common-workflows)（Fix bugs 节） | 16 延伸一（2026-09-13 第二轮起该页全文随 05 提供） | 官方文档署名翻译 | 16 署名块列明 |
| [Anthropic 官方博客《How Anthropic runs large-scale code migrations with Claude Code》](https://claude.com/blog/ai-code-migration)（2026-07-16） | 17 主来源（主体翻译） | 官方博客署名翻译 | 17 frontmatter + 署名块 |
| [Aman Agrawal《Some Observations on AI/Agentic Refactoring》](https://amanagrawal.blog/2025/05/06/some-observations-on-ai-agentic-refactoring/) | 17 次来源（摘译） | 作者公开博客署名翻译 | 17 署名块列明 |
| [Anthropic 客户案例 Rakuten](https://www.anthropic.com/customers/rakuten) | 17 收束节（关键数据摘译） | 官方案例署名翻译 | 17 署名块列明 |
| [Claude Code Docs: Manage costs effectively](https://code.claude.com/docs/en/costs) | 27 主来源 | 官方文档署名翻译 | 27 frontmatter + 署名块 |
| [Claude Code Docs: Set up Claude Code for your organization](https://code.claude.com/docs/en/admin-setup) | 28 主来源一 | 官方文档署名翻译 | 28 frontmatter + 署名块 |
| [Claude Code Docs: Track team usage with analytics](https://code.claude.com/docs/en/analytics) | 28 主来源二 | 官方文档署名翻译 | 28 署名块列明 |
| 本站编者 | 06 分词节、16 调试纪律、27/28 编者清单节（各处均已在节首标明） | 本站原创节 | 各篇署名块标明 |

### 第二轮重做/新增 7 篇（2026-09-13 第二轮）

| 来源 | 用途（现编号） | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Claude Code Docs: Quickstart](https://code.claude.com/docs/en/quickstart)（.md 端点全文抓取） | 05 第一部分（**全文翻译**） | 官方文档署名翻译 | 05 frontmatter + 署名块 |
| [Claude Code Docs: Common workflows](https://code.claude.com/docs/en/common-workflows)（.md 端点全文抓取） | 05 第二部分（**全文翻译**） | 官方文档署名翻译 | 05 署名块列明 |
| 本站编者 | 05 第三部分"从零实战对照"（节首标明）与两处编者过渡 | 本站原创节 | 05 署名块标明 |
| [Claude Code Docs: Run Claude Code programmatically](https://code.claude.com/docs/en/headless)（.md 端点全文抓取） | 23 第一节（**全文翻译**，含 bare/后台任务/SIGTERM/结构化输出/事件表） | 官方文档署名翻译 | 23 frontmatter + 署名块 |
| [Claude Code Docs: Agent SDK overview](https://code.claude.com/docs/en/agent-sdk)（.md 端点全文抓取） | 23 第二节（**全文翻译**，含选型表/能力表/品牌指南/许可条款） | 官方文档署名翻译 | 23 署名块列明 |
| [Claude Code Docs: GitHub Actions](https://code.claude.com/docs/en/github-actions)（.md 端点抓取） | 23 第三节（交互/自动化模式、触发闸门、示例 workflow、最佳实践、云提供商核心章节全译） | 官方文档署名翻译 | 23 署名块列明 |
| [GitHub Docs: About Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)（经 github/docs 仓库 raw 抓取，2026-09 当前版；原 about-coding-agent 页已重定向至 cloud-agent） | 23 第四节（**全文翻译**：概览/对比 agent mode/PR 度量/成本/自定义/限制等全部小节） | GitHub 官方文档署名翻译 | 23 署名块列明 |
| [Simon Willison《A quote from Andrew Nesbitt》](https://simonwillison.net/2025/Apr/12/andrew-nesbitt/)（2025-04-12，slopsquatting 命名引文） | 25 第一节之一（全文翻译） | 署名转载 | 25 署名块逐篇列明 |
| [Simon Willison《Diving Deeper into AI Package Hallucinations》](https://simonwillison.net/2024/Apr/1/diving-deeper-into-ai-package-hallucinations/)（2024-04-01，转述 Lasso Security 研究） | 25 第一节之二（全文翻译） | 署名转载 | 25 署名块逐篇列明 |
| [Simon Willison《Hallucinations in code are the least dangerous form of LLM mistakes》](https://simonwillison.net/2025/Mar/2/hallucinations-in-code/)（2025-03-02） | 25 第一节之三（全文翻译，文末附言与更新说明一并译出） | 署名转载 | 25 署名块逐篇列明 |
| 公开研究：Lasso Security《AI Package Hallucinations》（Bar Lanyado）；Spracklen et al.《We Have a Package for You!》（USENIX Security 2025）；[trendmicro/slopsquatting](https://github.com/trendmicro/slopsquatting) 数据集仓库 | 25 第二节（研究数字转述翻译，逐项注明出处） | 公开研究材料转述署名 | 25 编者说明 + 署名块标明 |
| [Claude Code Docs: Security](https://code.claude.com/docs/en/security)（.md 端点抓取） | 25 第三节之一（权限架构/内置防护/防提示注入/不可信内容实践/MCP 安全核心章节全译） | 官方文档署名翻译 | 25 署名块列明 |
| [Claude Code Docs: Sandboxing](https://code.claude.com/docs/en/sandboxing)（.md 端点抓取） | 25 第三节之二（沙箱入门/模式/凭据保护/网络隔离核心章节全译） | 官方文档署名翻译 | 25 署名块列明 |
| [Microsoft On the Issues《Microsoft announces new Copilot Copyright Commitment for customers》](https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/)（2023-09-07，Brad Smith & Hossein Nowbar；curl 403，经 Web Reader 抓取全文） | 26 第一节（**全文翻译**） | Microsoft 官方公告署名翻译 | 26 frontmatter + 署名块 |
| GitHub 官方文档《Responsible use of GitHub Copilot inline suggestions》（github/docs 仓库 raw 抓取：content/copilot/responsible-use/inline-suggestions.md） | 26 第二节（公共代码匹配/限制/最佳实践/用户风险声明等 IP 相关章节翻译） | GitHub 官方文档署名翻译 | 26 署名块列明 |
| [U.S. Copyright Office《Copyright and Artificial Intelligence, Part 2: Copyrightability》](https://www.copyright.gov/ai/Copyright-and-Artificial-Intelligence-Part-2-Copyrightability-Report.pdf)（2025-01，PDF 抓取后提取执行摘要） | 26 第三节（执行摘要**全文翻译**，含八条结论与建议） | 美国政府作品，公共领域 | 26 署名块标明 |
| [SWE-bench/SWE-bench README](https://raw.githubusercontent.com/SWE-bench/SWE-bench/main/README.md)（raw 抓取） | 03 第一节（**全文翻译**：概览/新闻/安装/用法/下载/引用） | MIT | 03 frontmatter + 署名块 |
| [laude-institute/terminal-bench README](https://raw.githubusercontent.com/laude-institute/terminal-bench/main/README.md)（raw 抓取） | 03 第二节（**全文翻译**：任务集/执行 harness/排行榜/贡献/引用） | Apache-2.0 | 03 署名块列明 |
| [Anthropic《Introducing Claude Sonnet 4.5》](https://www.anthropic.com/news/claude-sonnet-4-5)（anthropic.com 直连受限，经 Web Reader 抓取） | 03 第三节之一（benchmark 表述与 SWE-bench Verified 口径注记翻译） | 官方公告署名翻译 | 03 署名块逐项列明 |
| [OpenAI《Introducing GPT-5 for developers》](https://openai.com/index/introducing-gpt-5-for-developers/)（openai.com 对 curl 403，经 Web Reader 抓取） | 03 第三节之二（真实编码基准与"剔除 23 题"方法脚注翻译） | 官方公告署名翻译 | 03 署名块逐项列明 |
| [microsoft/vscode README](https://raw.githubusercontent.com/microsoft/vscode/main/README.md)（raw 抓取） | 22 第一节（Code-OSS 与 Visual Studio Code 发行版关系两段翻译，作编辑器分叉背景） | MIT | 22 署名块列明 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 处理/替代方案 |
| --- | --- | --- | --- |
| Claude Code 最佳实践 | www.anthropic.com/engineering/claude-code-best-practices | 计划书原始 URL 已 301 重定向至 code.claude.com/docs/en/best-practices | 直接抓取 docs 站当前版 .md |
| AGENTS.md raw | raw.githubusercontent.com/openai/agents.md/main/README.md | 首次抓取失败（网络/限流），重试成功 | 另以 agents.md 官方站网页版互补 |
| ghuntley.com 全站（/specs、/loops、/wtf、/dothings、/ralph） | ghuntley.com/* | 全站对 curl 返回空响应（bot 防护） | /dothings 与 /ralph 改用 Web Reader 抓取；第二轮经 Web Reader 取得 /dothings **全文**（更新版未对正文设付费墙），29 已升级为全文翻译；/specs 付费预览仅公开节选，14 主来源维持 github/spec-kit（MIT） |
| Kent Beck《Augmented Coding》 | tidyfirst.substack.com | Substack 对 curl 返回空响应 | Web Reader 抓取全文 |
| GitHub Copilot docs 概念页（第一轮） | docs.github.com/en/copilot/about-copilot/what-is-github-copilot | 404（文档改版） | 改用 get-started/what-is-github-copilot |
| GitHub Copilot coding agent docs（第二轮） | docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent | 页面重定向（2026-09 结构改为 cloud-agent） | 经 github/docs 仓库 raw 抓取 content/copilot/concepts/agents/cloud-agent/about-cloud-agent.md（含 redirect_from 声明），23 已按当前版翻译 |
| resources.github.com / copilot.github.trust.page | Copilot Trust Center | 本网络连接失败（HTTP 000/ECONNRESET） | Trust Center 不可达；26 的 GitHub IP 口径改用 github/docs 仓库 raw 的 responsible-use/inline-suggestions.md（同一官方内容体系，含风险声明原文） |
| Windsurf 文档 | docs.windsurf.com/windsurf/getting-started | 重定向至 Devin Desktop 文档 | 改抓 /windsurf/cascade，并在 02/22 标注归属变迁 |
| docs.cline.bot HTML 页 | docs.cline.bot/getting-started/... | JS 渲染页抽取为空 | 改用 Mintlify 原生 .md 端点与 llms.txt 索引（第二轮：cline-overview/installing-cline/cli-overview/kanban/acp 五页 .md 抓取成功） |
| OpenAI 官网（第二轮） | openai.com/index/introducing-gpt-5-for-developers/ | curl 403 | 改用 Web Reader 抓取全文成功 |
| Anthropic 官网（第二轮） | anthropic.com/news/claude-sonnet-4-5、platform.claude.com models overview | 直连受限/地域不可用（404/geo 页） | 改用 Web Reader 抓取公告全文成功；models overview 放弃（region 限制），benchmark 口径以公告文本为准 |
| US Copyright Office 报告（第二轮） | copyright.gov/ai/...Part-2-Copyrightability-Report.pdf | 首次 URL 少文件名后缀 404 | 改用完整文件名 URL，PDF 抓取成功（1.4MB/52 页），pypdf 提取执行摘要 |
| trendmicro/slopsquatting README（第二轮） | raw main 分支 | 404（仓库默认分支/路径未知） | 放弃 README 抓取；25 第二节该处仅转述经公开检索确认的研究事实并注明出处 |
| microsoft/vscode LICENSE 的 fork 限制条款（第二轮） | raw main LICENSE.txt | 现行 LICENSE 已是纯 MIT（无旧版 marketplace 限制段落） | 22 的分叉背景改用 README 中"Code-OSS 与 Visual Studio Code 发行版"官方说明两段翻译 |
| words.filippo.io、anthropic.com 客户案例、claude.com/blog（第一轮） | —— | 页面噪声/改版 | 见第一轮记录：路径发现后抓取、按章节提取正文 |

## 时效性核查说明

- 全部对比与引用以 2026-09 工具现状核实：Windsurf→Cognition/Devin Desktop（2025-07 收购、2026 完成整合）；Spec Kit 1.0.0（2026-08）；Claude Code 文档为 code.claude.com 当前版（含 auto mode、bare mode、permission-prompts none、Agent Teams、Agent SDK、analytics、Routines 等 2026 特性）；SWE-bench Multimodal v2 开源（2026-09-01 新闻条目）；Terminal-Bench 引用 ICLR 2026 论文条目与 harbor 框架公告；Copilot cloud agent 文档为 docs.github.com 2026-09 当前版（coding-agent→cloud-agent 改版）；25 篇事件（OpenAI/Hugging Face）为 2026-07 真实事件报道；26 篇三份来源分别为 2023-09（Microsoft 承诺，正文注明 2023-11 扩展更名）、GitHub 负责任使用文档当前版、2025-01（USCO Part 2 报告）。
- 旧资料中"Windsurf 独立产品""Spec Kit 0.x 命令""Cursor Chat 独立模式"等表述均按当前版改写或以"时效注记"标明。
- 第二轮重做的三篇（05/23/29）均已从"节译/编者总结为主"升级为"官方原文/原文全文翻译为主体"，编者内容仅存于各篇明确标明的编者小节与过渡句。
- 21→22 收敛后，全模块对 Headless/CI 的叙述统一指向 23；"第 N 篇"交叉引用已按新编号全局替换。
