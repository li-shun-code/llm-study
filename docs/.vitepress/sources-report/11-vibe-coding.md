# 模块 11 · Vibe Coding（11-vibe-coding）来源报告

抓取日期：2026-09-13。目标 ≥14 篇，实际完成 **16 篇**，全部通过 `node scripts/check-frontmatter.mjs docs/11-vibe-coding`。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Simon Willison 博客](https://simonwillison.net/2025/Mar/19/vibe-coding/)《Not all AI-assisted programming is vibe coding》（2025-03-19，含 Karpathy 原始推文全文引用） | 01 主来源（全文翻译） | 作者博客允许署名引用转载 | 01 frontmatter + 署名块 |
| [Simon Willison 博客](https://simonwillison.net/2025/Oct/7/vibe-engineering/)《Vibe engineering》（2025-10-07，含 2026-02-23 "Agentic Engineering" 更新） | 01 延伸节（节译）、07 引言、13 相关观点 | 同上署名转载 | 01/07 署名块并列标注 |
| 各工具官方文档（编译对比）：[Claude Code Overview](https://code.claude.com/docs/en/overview)、[Cursor Docs](https://cursor.com/docs)、[GitHub Copilot Docs](https://docs.github.com/en/copilot/get-started/what-is-github-copilot)、[Cline Overview](https://docs.cline.bot/cline-overview)、[Cascade/Devin Desktop Docs](https://docs.windsurf.com/windsurf/cascade)、[openai/codex README](https://github.com/openai/codex)（Apache-2.0） | 02 全文（编译+局部翻译，工具现状经联网核实为 2026-09：Windsurf 已并入 Cognition Devin Desktop 等） | 各版权归原厂，编译署名 | 02 frontmatter + 署名块列全部 URL |
| [Claude Code Docs: Best practices](https://code.claude.com/docs/en/best-practices)（anthropic.com/engineering/claude-code-best-practices 现重定向至此，取 2026-09 文档版） | 03 全文翻译 | 官方文档 Copyright Anthropic PBC，署名翻译 | 03 frontmatter + 署名块 |
| [Cursor Docs: Rules](https://cursor.com/docs/context/rules) | 04 全文翻译（入门速览节按 docs 站结构编译） | 官方文档署名翻译 | 04 frontmatter + 署名块 |
| [agents.md 官方站](https://agents.md/)（与 [openai/agents.md](https://github.com/openai/agents.md) README 同源；现由 Linux 基金会 Agentic AI Foundation 托管） | 05 主来源（全文翻译） | 开放格式说明文档 | 05 frontmatter + 署名块 |
| [Claude Code Docs: Memory](https://code.claude.com/docs/en/memory)（CLAUDE.md 部分） | 05 延伸节（节译） | 官方文档署名翻译 | 05 署名块并列标注 |
| [Claude Code Docs: Skills](https://code.claude.com/docs/en/skills) | 06 主体翻译（claude.ai 同步技能等实现细节从略并注明） | 官方文档署名翻译 | 06 frontmatter + 署名块 |
| [Claude Code Docs: Worktrees](https://code.claude.com/docs/en/worktrees) | 07 主来源（节译，核心章节全译） | 官方文档署名翻译 | 07 frontmatter + 署名块 |
| [Geoffrey Huntley 博客](https://ghuntley.com/ralph/)《Ralph Wiggum as a "software engineer"》（2025-07-25，经 Web Reader 抓取全文） | 07 引言、08 延伸节（摘译） | 署名转载 | 07/08 署名块并列标注 |
| [github/spec-kit](https://github.com/github/spec-kit) README（raw 抓取，2026-08 发布 1.0.0） | 08 主来源（主体翻译） | MIT | 08 frontmatter + 署名块 |
| [Anthropic Engineering: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)（2025-09-29） | 09 全文翻译 | 官方博客署名翻译 | 09 frontmatter + 署名块 |
| [Claude Code Docs: MCP](https://code.claude.com/docs/en/mcp) | 10 主体翻译（长尾小节从略并注明；协议概念交叉引用模块 9） | 官方文档署名翻译 | 10 frontmatter + 署名块 |
| [Claude Code Docs: Code Review](https://code.claude.com/docs/en/code-review) | 11 主体翻译（引言为编者综述，引用第 3 篇已译内容） | 官方文档署名翻译 | 11 frontmatter + 署名块 |
| [Kent Beck, tidyfirst.substack.com](https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes)《Augmented Coding: Beyond the Vibes》（2025-06-25；curl 被阻，经 Web Reader 抓取） | 12 全文翻译（大段工作日志节选压缩并注明；plan.md 工作流按内容译述而非逐字引用） | 原文页未附许可，按作者公开博客署名翻译处理 | 12 frontmatter + 署名块 |
| [Claude Code Docs: Agent Teams](https://code.claude.com/docs/en/agent-teams) | 13 主来源（主体翻译） | 官方文档署名翻译 | 13 frontmatter + 署名块 |
| [Simon Willison《Embracing the parallel coding agent lifestyle》](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)（2025-10-05） | 13 引言（摘译） | 署名转载 | 13 署名块并列标注 |
| [Simon Willison《OpenAI's accidental cyberattack against Hugging Face…》](https://simonwillison.net/2026/Jul/22/openai-cyberattack/)（2026-07-22） | 14 主来源（全文翻译；文末"编者按"表为本站补充并已标明） | 署名转载 | 14 frontmatter + 署名块 |
| [Geoffrey Huntley《The future belongs to people who can just do things》](https://ghuntley.com/dothings/)（2025-02-06/2025-06-08；curl 被阻，经 Web Reader 抓取；原文后半部分付费） | 15 主来源（节译并在署名块注明；文末编者按清单为本站补充并已标明） | 署名转载 | 15 frontmatter + 署名块 |
| [Claude Code Docs: Headless](https://code.claude.com/docs/en/headless) | 16 主来源（主体翻译） | 官方文档署名翻译 | 16 frontmatter + 署名块 |
| [Cline Docs](https://docs.cline.bot/cline-overview)（含 llms.txt 索引中 CLI/GitHub Actions/Kanban 样例）与 [Windsurf/Devin Desktop Docs: Cascade](https://docs.windsurf.com/windsurf/cascade) | 16 生态两翼节 | 各官方文档署名翻译 | 16 署名块列明 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 处理/替代方案 |
| --- | --- | --- | --- |
| Claude Code 最佳实践 | www.anthropic.com/engineering/claude-code-best-practices | 计划书原始 URL 已 301 重定向至 code.claude.com/docs/en/best-practices（2025 版博客下线） | 直接抓取 docs 站当前版 .md，内容更新、时效合规 |
| AGENTS.md raw | raw.githubusercontent.com/openai/agents.md/main/README.md | 首次抓取失败（网络/限流），重试成功 | README 抓取成功（2KB）；另抓取 agents.md 官方站网页版互补 |
| ghuntley.com 全站（/specs、/loops、/wtf、/dothings、/ralph） | ghuntley.com/* | 全站对 curl 返回空响应（bot 防护） | /dothings 与 /ralph 改用 Web Reader 工具成功抓取；/specs 为付费预览仅取到公开节选，故 08 的 Spec 驱动主来源改用 github/spec-kit（MIT，raw 抓取成功），Huntley 内容降为摘译并署名 |
| Kent Beck《Augmented Coding: Beyond the Vibes》 | tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes | Substack 对 curl 返回空响应（默认 UA 与浏览器 UA 均被阻） | 改用 Web Reader 工具成功抓取全文，来源不变 |
| GitHub Copilot docs 概念页 | docs.github.com/en/copilot/about-copilot/what-is-github-copilot | 404（文档改版） | 改用 docs.github.com/en/copilot/get-started/what-is-github-copilot，成功抓取 |
| Windsurf 文档 | docs.windsurf.com/windsurf/getting-started | 重定向至 Devin Desktop 文档（产品并入 Cognition） | 改抓 docs.windsurf.com/windsurf/cascade，并在 02/16 中如实标注 2026 归属变迁 |
| docs.cline.bot 页面 | docs.cline.bot/getting-started/understanding-the-agent-loop | JS 渲染页，html2md 抽取为空 | 改用 docs.cline.bot 的 llms.txt 与各页 .md 端点（Mintlify 原生 markdown），成功抓取 |
| OpenAI Codex docs | developers.openai.com/codex | 未直接抓取（备选路径） | 改用 GitHub openai/codex 仓库 README raw（Apache-2.0），成功抓取 |

## 时效性核查说明

- 全部对比与引用以 2026-09 工具现状核实：Windsurf→Cognition/Devin Desktop（2025-07 收购、2026 完成整合）；Spec Kit 1.0.0（2026-08）；Claude Code 文档为 code.claude.com 当前版（含 auto mode、Agent Teams、/verify 等 2026 特性）；14 篇事件（OpenAI/Hugging Face）为 2026-07 真实事件报道。
- 旧资料中"Windsurf 独立产品""Spec Kit 0.x 命令"等表述均按当前版改写或在文中以"时效注记"标明。
