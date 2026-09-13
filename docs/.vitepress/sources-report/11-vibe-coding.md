# 模块 11 · Vibe Coding（11-vibe-coding）来源报告

抓取日期：2026-09-13（初版 16 篇；同日扩充至 26 篇）。全部通过 `node scripts/check-frontmatter.mjs docs/11-vibe-coding`（PASS, 26 articles）。

## 来源与许可

### 初版 16 篇（现编号 01/02/06/08/10/11/12/13/14/17/18/19/20/21/23/26）

| 来源 | 用途（现编号） | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Simon Willison 博客](https://simonwillison.net/2025/Mar/19/vibe-coding/)《Not all AI-assisted programming is vibe coding》（2025-03-19，含 Karpathy 原始推文全文引用） | 01 主来源（全文翻译） | 作者博客允许署名引用转载 | 01 frontmatter + 署名块 |
| [Simon Willison 博客](https://simonwillison.net/2025/Oct/7/vibe-engineering/)《Vibe engineering》（2025-10-07，含 2026-02-23 "Agentic Engineering" 更新） | 01 延伸节（节译）、12 引言、20 相关观点 | 同上署名转载 | 01/12 署名块并列标注 |
| 各工具官方文档（编译对比）：[Claude Code Overview](https://code.claude.com/docs/en/overview)、[Cursor Docs](https://cursor.com/docs)、[GitHub Copilot Docs](https://docs.github.com/en/copilot/get-started/what-is-github-copilot)、[Cline Overview](https://docs.cline.bot/cline-overview)、[Cascade/Devin Desktop Docs](https://docs.windsurf.com/windsurf/cascade)、[openai/codex README](https://github.com/openai/codex)（Apache-2.0） | 02 全文（编译+局部翻译，工具现状经联网核实为 2026-09：Windsurf 已并入 Cognition Devin Desktop 等） | 各版权归原厂，编译署名 | 02 frontmatter + 署名块列全部 URL |
| [Claude Code Docs: Best practices](https://code.claude.com/docs/en/best-practices)（anthropic.com/engineering/claude-code-best-practices 现重定向至此，取 2026-09 文档版） | 06 全文翻译 | 官方文档 Copyright Anthropic PBC，署名翻译 | 06 frontmatter + 署名块 |
| [Cursor Docs: Rules](https://cursor.com/docs/context/rules) | 08 全文翻译（入门速览节按 docs 站结构编译） | 官方文档署名翻译 | 08 frontmatter + 署名块 |
| [agents.md 官方站](https://agents.md/)（与 [openai/agents.md](https://github.com/openai/agents.md) README 同源；现由 Linux 基金会 Agentic AI Foundation 托管） | 10 主来源（全文翻译） | 开放格式说明文档 | 10 frontmatter + 署名块 |
| [Claude Code Docs: Memory](https://code.claude.com/docs/en/memory)（CLAUDE.md 部分） | 10 延伸节（节译） | 官方文档署名翻译 | 10 署名块并列标注 |
| [Claude Code Docs: Skills](https://code.claude.com/docs/en/skills) | 11 主体翻译（claude.ai 同步技能等实现细节从略并注明） | 官方文档署名翻译 | 11 frontmatter + 署名块 |
| [Claude Code Docs: Worktrees](https://code.claude.com/docs/en/worktrees) | 12 主来源（节译，核心章节全译） | 官方文档署名翻译 | 12 frontmatter + 署名块 |
| [Geoffrey Huntley 博客](https://ghuntley.com/ralph/)《Ralph Wiggum as a "software engineer"》（2025-07-25，经 Web Reader 抓取全文） | 12 引言、13 延伸节（摘译） | 署名转载 | 12/13 署名块并列标注 |
| [github/spec-kit](https://github.com/github/spec-kit) README（raw 抓取，2026-08 发布 1.0.0） | 13 主来源（主体翻译） | MIT | 13 frontmatter + 署名块 |
| [Anthropic Engineering: Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)（2025-09-29） | 14 全文翻译 | 官方博客署名翻译 | 14 frontmatter + 署名块 |
| [Claude Code Docs: MCP](https://code.claude.com/docs/en/mcp) | 18 主体翻译（长尾小节从略并注明；协议概念交叉引用模块 9） | 官方文档署名翻译 | 18 frontmatter + 署名块 |
| [Claude Code Docs: Code Review](https://code.claude.com/docs/en/code-review) | 19 主体翻译（引言为编者综述，引用第 6 篇已译内容） | 官方文档署名翻译 | 19 frontmatter + 署名块 |
| [Kent Beck, tidyfirst.substack.com](https://tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes)《Augmented Coding: Beyond the Vibes》（2025-06-25；curl 被阻，经 Web Reader 抓取） | 17 全文翻译（大段工作日志节选压缩并注明；plan.md 工作流按内容译述而非逐字引用） | 原文页未附许可，按作者公开博客署名翻译处理 | 17 frontmatter + 署名块 |
| [Claude Code Docs: Agent Teams](https://code.claude.com/docs/en/agent-teams) | 20 主来源（主体翻译） | 官方文档署名翻译 | 20 frontmatter + 署名块 |
| [Simon Willison《Embracing the parallel coding agent lifestyle》](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)（2025-10-05） | 20 引言（摘译） | 署名转载 | 20 署名块并列标注 |
| [Simon Willison《OpenAI's accidental cyberattack against Hugging Face…》](https://simonwillison.net/2026/Jul/22/openai-cyberattack/)（2026-07-22） | 23 主来源（全文翻译；文末"编者按"表为本站补充并已标明） | 署名转载 | 23 frontmatter + 署名块 |
| [Geoffrey Huntley《The future belongs to people who can just do things》](https://ghuntley.com/dothings/)（2025-02-06/2025-06-08；curl 被阻，经 Web Reader 抓取；原文后半部分付费） | 26 主来源（节译并在署名块注明；文末编者按清单为本站补充并已标明） | 署名转载 | 26 frontmatter + 署名块 |
| [Claude Code Docs: Headless](https://code.claude.com/docs/en/headless) | 21 主来源（主体翻译） | 官方文档署名翻译 | 21 frontmatter + 署名块 |
| [Cline Docs](https://docs.cline.bot/cline-overview)（含 llms.txt 索引中 CLI/GitHub Actions/Kanban 样例）与 [Windsurf/Devin Desktop Docs: Cascade](https://docs.windsurf.com/windsurf/cascade) | 21 生态两翼节 | 各官方文档署名翻译 | 21 署名块列明 |

### 扩充新增 10 篇（2026-09-13 同日抓取）

| 来源 | 用途（新编号） | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Claude Code Docs: Quickstart](https://code.claude.com/docs/en/quickstart) + [Advanced setup](https://code.claude.com/docs/en/setup) | 03 主来源（安装/登录/系统要求节全文翻译） | 官方文档署名翻译 | 03 frontmatter + 署名块 |
| [Cursor Docs: Quickstart](https://cursor.com/docs/get-started/quickstart) | 03 次来源（Cursor 安装/首跑节全文翻译） | 官方文档署名翻译 | 03 署名块列明 |
| [Claude Code Docs: Quickstart](https://code.claude.com/docs/en/quickstart)（第 3-8 步）与新手建议 | 04 主来源（第一次会话全流程翻译） | 官方文档署名翻译 | 04 frontmatter + 署名块 |
| 本站编者（依据官方提示词模式组织） | 04 "从零实战：wcount 词频工具"一节（节首已标明编者补充） | 本站原创节 | 04 署名块标明 |
| [Claude Code Docs: How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works) | 05 主来源（智能体循环/工具/访问边界/上下文窗口核心章节全文翻译） | 官方文档署名翻译 | 05 frontmatter + 署名块 |
| [Claude Code Docs: Explore the context window](https://code.claude.com/docs/en/context-window) | 05 次来源（会话启动时上下文构成清单） | 官方文档署名翻译 | 05 署名块列明 |
| 本站编者（交叉引用模块 4 分词器篇章） | 05 第五节"分词对编码的影响"（已标明编者补充） | 本站原创节 | 05 署名块标明 |
| [Claude Code Docs: Permissions](https://code.claude.com/docs/en/permissions) | 07 主来源（权限系统/规则语法/工作目录核心章节全文翻译） | 官方文档署名翻译 | 07 frontmatter + 署名块 |
| [Claude Code Docs: Permission modes](https://code.claude.com/docs/en/permission-modes)、[Sandboxing](https://code.claude.com/docs/en/sandboxing) | 07 次来源（模式表、auto 分类器拦截清单、沙箱文件/网络隔离节译） | 官方文档署名翻译 | 07 署名块列明 |
| [Cursor Docs: Agent Overview](https://cursor.com/docs/agent/overview)、[Plan Mode](https://cursor.com/docs/agent/plan-mode)、[Debug Mode](https://cursor.com/docs/agent/debug-mode)、[Agent Review](https://cursor.com/docs/agent/agent-review)、[Prompting agents](https://cursor.com/docs/agent/prompting) | 09 主来源（五页编译翻译） | 官方文档署名翻译 | 09 frontmatter + 署名块 |
| [Cursor 帮助文档: Tab completion](https://cursor.com/help/ai-features/tab) | 09 第一节（Tab 全文翻译） | 官方文档署名翻译 | 09 署名块列明 |
| [Filippo Valsorda《Claude Code Can Debug Low-level Cryptography》](https://words.filippo.io/claude-debugging/)（2025-11-01） | 15 主来源（全文翻译，赞助商致谢与图片说明未译并注明） | 原文页未附许可，按作者公开博客署名翻译处理 | 15 frontmatter + 署名块 |
| [Claude Code Docs: Common workflows](https://code.claude.com/docs/en/common-workflows)（Fix bugs efficiently 节） | 15 延伸一（翻译） | 官方文档署名翻译 | 15 署名块列明 |
| 本站编者 | 15 延伸二"调试纪律五条"（已标明编者小结） | 本站原创节 | 15 署名块标明 |
| [Anthropic 官方博客《How Anthropic runs large-scale code migrations with Claude Code》](https://claude.com/blog/ai-code-migration)（2026-07-16，含 Bun Zig→Rust 与 Mike Krieger Python→TypeScript 案例） | 16 主来源（主体翻译，含六步流程与最佳实践） | 官方博客署名翻译 | 16 frontmatter + 署名块 |
| [Aman Agrawal《Some Observations on AI/Agentic Refactoring》](https://amanagrawal.blog/2025/05/06/some-observations-on-ai-agentic-refactoring/)（2025-05-06） | 16 次来源（场景一与启发式节摘译） | 作者公开博客署名翻译（原文页未附许可） | 16 署名块列明 |
| [Anthropic 客户案例 Rakuten](https://www.anthropic.com/customers/rakuten) | 16 收束节（关键数据摘译） | 官方案例署名翻译 | 16 署名块列明 |
| [Claude Code Docs: Common workflows](https://code.claude.com/docs/en/common-workflows)（Refactor code 节） | 16 官方配方（翻译） | 官方文档署名翻译 | 16 署名块列明 |
| [Claude Code Docs: Agent SDK overview](https://code.claude.com/docs/en/agent-sdk) | 22 主来源（选型对照/能力表/许可注意节全文翻译） | 官方文档署名翻译 | 22 frontmatter + 署名块 |
| [Claude Code Docs: GitHub Actions](https://code.claude.com/docs/en/github-actions) | 22 次来源（交互/自动化模式、触发闸门、最佳实践节译） | 官方文档署名翻译 | 22 署名块列明 |
| [GitHub Docs: About Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent) | 22 次来源（概览/与 IDE 助手对比/计费节译） | GitHub 官方文档署名翻译 | 22 署名块列明 |
| 本站编者 | 22 第四节"无人值守工程配方"与两处译注（已标明） | 本站原创节 | 22 署名块标明 |
| [Claude Code Docs: Manage costs effectively](https://code.claude.com/docs/en/costs) | 24 主来源（看账/组织控制/降耗清单/长会话用量原因核心章节翻译） | 官方文档署名翻译 | 24 frontmatter + 署名块 |
| [Claude Code Docs: Set up Claude Code for your organization](https://code.claude.com/docs/en/admin-setup) | 25 主来源一（部署决策地图与控制面清单翻译） | 官方文档署名翻译 | 25 frontmatter + 署名块 |
| [Claude Code Docs: Track team usage with analytics](https://code.claude.com/docs/en/analytics) | 25 主来源二（贡献指标口径与官方用法翻译） | 官方文档署名翻译 | 25 署名块列明 |
| 本站编者 | 25 第三节"团队落地五步清单"与译注（已标明） | 本站原创节 | 25 署名块标明 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 处理/替代方案 |
| --- | --- | --- | --- |
| Claude Code 最佳实践 | www.anthropic.com/engineering/claude-code-best-practices | 计划书原始 URL 已 301 重定向至 code.claude.com/docs/en/best-practices（2025 版博客下线） | 直接抓取 docs 站当前版 .md，内容更新、时效合规 |
| AGENTS.md raw | raw.githubusercontent.com/openai/agents.md/main/README.md | 首次抓取失败（网络/限流），重试成功 | README 抓取成功（2KB）；另抓取 agents.md 官方站网页版互补 |
| ghuntley.com 全站（/specs、/loops、/wtf、/dothings、/ralph） | ghuntley.com/* | 全站对 curl 返回空响应（bot 防护） | /dothings 与 /ralph 改用 Web Reader 工具成功抓取；/specs 为付费预览仅取到公开节选，故 13 的 Spec 驱动主来源改用 github/spec-kit（MIT，raw 抓取成功），Huntley 内容降为摘译并署名 |
| Kent Beck《Augmented Coding: Beyond the Vibes》 | tidyfirst.substack.com/p/augmented-coding-beyond-the-vibes | Substack 对 curl 返回空响应（默认 UA 与浏览器 UA 均被阻） | 改用 Web Reader 工具成功抓取全文，来源不变 |
| GitHub Copilot docs 概念页 | docs.github.com/en/copilot/about-copilot/what-is-github-copilot | 404（文档改版） | 改用 docs.github.com/en/copilot/get-started/what-is-github-copilot，成功抓取 |
| Windsurf 文档 | docs.windsurf.com/windsurf/getting-started | 重定向至 Devin Desktop 文档（产品并入 Cognition） | 改抓 docs.windsurf.com/windsurf/cascade，并在 02/21 中如实标注 2026 归属变迁 |
| docs.cline.bot 页面 | docs.cline.bot/getting-started/understanding-the-agent-loop | JS 渲染页，html2md 抽取为空 | 改用 docs.cline.bot 的 llms.txt 与各页 .md 端点（Mintlify 原生 markdown），成功抓取 |
| OpenAI Codex docs | developers.openai.com/codex | 未直接抓取（备选路径） | 改用 GitHub openai/codex 仓库 README raw（Apache-2.0），成功抓取 |
| Cursor docs .md 端点（扩充时） | cursor.com/docs/get-started/installation.md 等 | 大部分 .md 端点 404（仅 agent/overview.md 可用） | 改抓 HTML 页 + html2md 转 Markdown（get-started/quickstart、tab/overview），Tab 页另从 cursor.com/help/ai-features/tab.md（帮助站原生 .md）抓取 |
| Cursor agent chat-modes（扩充时） | cursor.com/docs/agent/chat-modes | 404（2026-09 文档结构已改为 Agent Overview + Plan/Debug 专用模式页） | 改用 agent/overview、agent/plan-mode、agent/debug-mode、agent/agent-review、agent/prompting 五页编译 |
| words.filippo.io 调试文章（扩充时） | words.filippo.io/claude-debugging/（直连路径） | 直连路径需先从首页发现 | 从 words.filippo.io 首页 grep 出 /claude-debugging/ 路径后抓取成功 |
| anthropic.com 客户案例（扩充时） | www.anthropic.com/customers/rakuten | 页面含大量轮播/导航噪声 | html2md 转换后人工提取正文关键数据，仅作 16 的收束节摘译 |
| Claude Code 大规模迁移博客（扩充时） | claude.com/blog/ai-code-migration | 页面含产品卡片段落 | 转换后按章节提取正文翻译，产品卡与 FAQ 略去 |

## 时效性核查说明

- 全部对比与引用以 2026-09 工具现状核实：Windsurf→Cognition/Devin Desktop（2025-07 收购、2026 完成整合）；Spec Kit 1.0.0（2026-08）；Claude Code 文档为 code.claude.com 当前版（含 auto mode、Agent Teams、Agent SDK、analytics、/usage 归因等 2026 特性）；Cursor 文档为 2026-09 结构（Agent Overview/Plan/Debug/Agent Review，Tab 帮助页）；Anthropic 迁移博客为 2026-07-16 版（含 Bun in Rust 已上线、动态工作流、迁移启动套件）；Copilot cloud agent 文档为 docs.github.com 当前版；23 篇事件（OpenAI/Hugging Face）为 2026-07 真实事件报道；15 篇案例（ML-DSA 调试）为 2025-11 事件记录。
- 旧资料中"Windsurf 独立产品""Spec Kit 0.x 命令""Cursor Chat 独立模式"等表述均按当前版改写或在文中以"时效注记"标明。
- 扩充新增文章的知识面与相邻篇互补性见各篇文首"承接"与文末"下一篇预告"。
