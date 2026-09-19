---
title: AI 编码供应链安全：幻觉包、Slopsquatting 与沙箱防线
source_url: https://simonwillison.net/2024/Apr/1/diving-deeper-into-ai-package-hallucinations/
author: Simon Willison（两篇博客与一篇引文）；Lasso Security、Spracklen 等与 Trend Micro（公开研究，经 Willison 博客转述）；Anthropic（Claude Code Security/Sandboxing 官方文档）
license: 署名转载/署名翻译（Willison 部分为作者博客署名翻译转载；官方文档 Copyright Anthropic PBC 教学用途翻译；每节均署名）
fetched_at: 2026-09-13
translated: true
order: 8
group: 安全、供应链与合规
---
**编者按**：上一篇讲的是 AI 代码自身行为的安全陷阱；本篇讲**供应链**——当编码智能体建议你 `pip install` 一个不存在的包，攻击者抢先注册这个包名会发生什么。正文分三段，逐节署名：Simon Willison 关于幻觉包与 slopsquatting 的三篇短文（全文翻译）；相关公开研究的转述（经 Willison 与 Lasso Security 原文）；以及 Claude Code 官方 Security 与 Sandboxing 文档的防线章节（全文/核心章节翻译）。文末"编者注：五条防线清单"为本站补充，已标明。

## 一、Simon Willison 论幻觉包与 Slopsquatting（三篇全文翻译）

### 1. Slopsquatting 的命名（译自 Simon Willison 博客，2025-04-12）

*译自 [A quote from Andrew Nesbitt](https://simonwillison.net/2025/Apr/12/andrew-nesbitt/)（Willison 收录的引文，全文）。*

> **Slopsquatting**——当一个 LLM 幻觉出一个不存在的包名，而恶意行为者抢先把这个名字注册掉。**typosquatting（误植域名抢注）的 AI 兄弟。**
>
> 名字归功于 @sethmlarson（Seth Larson 创造了这个词）。
>
> —— Andrew Nesbitt
>
> （Simon Willison 2025 年 4 月 12 日发布于其博客引文集。）

### 2. 深入 AI 幻觉包研究：3 万次下载的实验（译自 Simon Willison 博客，2024-04-01）

*译自 [Diving Deeper into AI Package Hallucinations](https://simonwillison.net/2024/Apr/1/diving-deeper-into-ai-package-hallucinations/)（Willison 对 Lasso Security 研究的转述，全文）。*

《深入 AI 包幻觉》。Bar Lanyado 注意到：LLM 在回答编码问题时会频繁幻觉出**不存在的包名**，而这可以被利用为一种**供应链攻击**。

他汇集了横跨 Python、Node.js、Go、.NET 与 Ruby 的 2500 个问题，投喂给多个不同的 LLM，记录下任何幻觉出来的包名，以及这些幻觉是否重复出现。

一个反复出现的例子是 "pip install huggingface-cli"（正确的包名是 "huggingface[cli]"）。Bar 随后在 1 月以该名字发布了一个无害的测试包，并在之后三个月里观察到**约 30,000 次下载**——说明大量开发者真的在照着 LLM 幻觉出的命令安装"包"。

### 3. 代码中的幻觉是 LLM 错误里最不危险的一种（译自 Simon Willison 博客，2025-03-02）

*译自 [Hallucinations in code are the least dangerous form of LLM mistakes](https://simonwillison.net/2025/Mar/2/hallucinations-in-code/)（全文）。*

我从尝试用 LLM 写代码的开发者那里听到一种出人意料的常见抱怨：他们遇到了一次幻觉——通常是 LLM 发明了一个不存在的方法、甚至一整个不存在的软件库——于是他们对"LLM 作为写代码工具"的信心崩塌了。"如果这东西会发明不存在的方法，人怎么可能高效地用它？"

**代码中的幻觉，是你能从模型那里遇到的最无害的幻觉。**

（我在这里说的"幻觉"，指 LLM 编造出一个完全不符合事实的说法，或者在本例中输出根本不存在的代码引用。bug 与其他错误是另一个问题，是本文其余部分的主题。）

用 LLM 写代码的真正风险，在于它们会犯下**不会被编译器或解释器当场抓住**的错误。而这类错误随时都在发生！

你一运行 LLM 生成的代码，任何幻觉出来的方法都会立刻现形：你会得到一个报错。你可以自己修，也可以把报错喂回给 LLM，看它自我纠正。

对比散文里的幻觉：你需要挑剔的眼光、强直觉与成熟的核查技能，才能避免转发错误信息、直接伤害自己的信誉。

而代码免费送给你一种强大的核查形式：**运行它，看看能不能用。**

在某些环境里——ChatGPT Code Interpreter、Claude Code、以及越来越多"写了代码就执行"的循环式智能体（agentic）系统——LLM 系统自己就会发现错误并自动纠正。

如果你在用 LLM 写代码、却连运行都不运行，你到底在干什么？

幻觉方法这种小路障，小到当有人拿它抱怨时，我只能假设他们花在学习"如何有效使用这些系统"上的时间少得可怜——他们在第一道坎就放弃了。

我愤世嫉俗的一面怀疑，他们可能本来就在找理由否定这门技术，看到第一个就跳上去了。

我不那么愤世嫉俗的一面则假设：从来没有人提醒过他们，要下很大功夫学习才能从这些系统里得到好结果。我探索"用它们写代码"已经两年多，几乎每天仍在学到新技巧（以及新的强项与弱点）。

**手动测试代码是必需的**

代码看起来不错、跑起来不报错，不代表它真的在做对的事。再细致的代码评审——甚至再全面的自动化测试——也不能证明代码真的做了正确的事。**你必须自己运行它！**

向自己证明代码能用，是你的工作。这也是我不认为 LLM 会让软件专业人士失业的诸多理由之一。

LLM 写的代码通常看起来非常漂亮：好的变量名、有说服力的注释、清晰的类型标注、合理的结构。这会让你产生虚假的安全感——就像 ChatGPT 那句语法完美、语气自信的回答可能诱你跳过事实核查、收起怀疑眼光一样。

避开这些问题的方式，与你审查他人写的代码、或审查自己写的代码时一样：**你需要真正去行使那段代码**。你需要出色的手动 QA 技能。

编程的一条通用法则是：在你亲眼见过代码工作之前——或者更好，见过它失败然后被修好之前——永远不要相信任何一段代码。回顾我的整个职业生涯，几乎每一次我假设某段代码能用而没有主动执行它——某个很少被触发的分支条件，某个我不预期会出现的错误消息——我后来都为这个假设后悔。

**减少幻觉的几个技巧**

如果你真的发现 LLM 给你的代码里幻觉细节泛滥，有一堆事情可以做：

* **换不同的模型试试。** 可能另一个模型为你选的平台准备了更好的训练数据。作为 Python 与 JavaScript 程序员，我当时的最爱是打开 thinking 的 Claude 3.7 Sonnet、OpenAI 的 o3-mini-high，以及带 Code Interpreter 的 GPT-4o（写 Python 用）。
* **学会使用上下文。** 如果 LLM 不了解某个库，通常往上下文里塞几十行示例代码就能解决。LLM 模仿能力极强，能从极少的示例里快速抓取模式。现代模型的上下文窗口越来越大——我最近开始用 Claude 的新 GitHub 集成把整个仓库倒进上下文，效果非常好。
* **选择无聊的技术。** 我真心发现自己在挑那些已经存在一段时间的库——部分原因是这样 LLM 更可能好好使用它们。

用一条相关的观察结束这篇吐槽：我一直看到有人说"如果我必须逐行评审 LLM 写的每行代码，还不如自己写更快！"

这些人在大声宣告：他们在"阅读、理解、评审别人写的代码"这项关键技能上投资严重不足。我建议多练练。**评审 LLM 为你写的代码，正是练习这项技能的好方法。**

附言：我曾请 Claude 3.7 Sonnet"扩展思考模式"评审本文早期草稿——"Review my rant of a blog entry…"——相当有帮助，尤其是一些让初稿不那么对抗性的建议。2025-03-11 更新：我随后写了一篇更长的文章，讲我如何用 LLM 辅助写代码。

## 二、规模有多大：公开研究给出的数字（研究公开页转述翻译）

> 编者说明（已标明）：以下为对公开研究材料的转述翻译。原始研究：Lasso Security《AI Package Hallucinations》（2024，Bar Lanyado）；Spracklen et al.《We Have a Package for You! A Comprehensive Analysis of Package Hallucinations by Code Generating LLMs》（USENIX Security 2025，该团队提出了 slopsquatting 一词并给出系统测量）；Trend Micro 公开了 slopsquatting 数据集仓库（github.com/trendmicro/slopsquatting）。数字均引自上述公开材料经 Simon Willison、Lasso Security 公开发布的版本。

* **19.7% 的推荐包是幻觉**：Spracklen 等人对 16 个主流代码生成模型的系统测量发现，近五分之一的推荐包不存在，共产生 **205,000+ 个不存在的唯一包名**——其中商业闭源模型幻觉率高于开源模型。（USENIX Security 2025 论文摘要的转述。）
* **幻觉可以很稳定**：Lasso Security 的 2500 题实验显示，同一批错误包名会被不同提问反复触发——"huggingface-cli"只是其中一例。**重复性正是攻击者的机会**：他们批量收集幻觉包名，抢注其中热度可能最高的那些。
* **注册现成可用的恶意包**：Trend Micro 的研究在 PyPI 上实测发现，相当比例的幻觉包名要么已被注册、要么注册后很快被下载——幻觉包名不是理论风险，而是"注册即有流量"的攻击面。
* **不仅限于 Python**：npm、Go module、.NET、RubyGems 与 crates.io 都受影响——任何"从注册表按名解析"的生态都适用同一种攻击。

把前面「Slopsquatting 的命名」一节的 typosquatting 类比说完整：typosquatting 利用的是**人**的拼写错误，slopsquatting 利用的是**模型**的幻觉——后者更危险，因为幻觉包名在不同用户之间**复现**，等于攻击者可以提前知道"将有大量用户正确无误地输入这个错误名字"。

## 三、防线：Claude Code 官方安全与沙箱机制（官方文档翻译）

### Security：权限架构与注入防护（译自官方 Security 页核心章节）

*译自 [Claude Code Security](https://code.claude.com/docs/en/security)（2026-09 当前版，核心章节全译）。*

**安全基础**：你代码的安全至关重要。Claude Code 以安全为核心构建，依照 Anthropic 的全面安全计划开发（SOC 2 Type 2 报告、ISO 27001 认证等见 Anthropic Trust Center）。

**基于权限的架构**：Manual 模式下，Claude Code 以只读权限起步。需要编辑文件、跑测试、执行命令时，它先问你，你选择批准一次或永久放行。Manual 模式下，能改动系统的 Bash 命令也会先问；`ls`、`cat`、`git status` 等内置只读命令免问运行。[auto 模式](https://code.claude.com/docs/en/permission-modes#eliminate-prompts-with-auto-mode)下，由一个独立的分类器模型代你审查动作、拦截它判定不安全的动作；你的显式 allow/deny 规则仍然生效，组织也可以关闭 auto 模式。

**内置防护**：

* **沙箱化 Bash 工具**：[沙箱](https://code.claude.com/docs/en/sandboxing)为 Bash 命令提供文件系统与网络隔离，在保住安全的同时减少权限弹窗；用 `/sandbox` 配置 Claude Code 可自主工作的边界。
* **工作目录边界**：Manual 模式下只能写启动目录及其子目录；未经明确许可不能修改父目录文件。用 Read/Grep/Glob 读取边界外路径也会先问。
* **提示疲劳缓解**：支持按用户/代码库/组织把高频安全命令加白名单。
* **Accept Edits 模式**：自动批准文件编辑与一组固定文件系统命令（`mkdir`、`touch`、`rm`、`mv`、`cp`、`sed`），仅限工作目录内路径；其他命令与越界路径仍会弹窗。

**用户责任**：Claude Code 只拥有你授予的权限。**批准前审查建议的代码与命令是否安全，是你的责任。**

**防提示注入（prompt injection）**：提示注入是攻击者插入恶意文本、试图覆盖或操纵 AI 助手指令的技术。Claude Code 的核心防护：权限系统（Manual 模式敏感操作需明确批准）；上下文感知分析（分析完整请求检测潜在有害指令）；输入净化（处理用户输入防命令注入）；**网络命令批准**（`curl`、`wget` 这类抓取网页内容的命令默认不自动批准——Manual 模式照常弹窗；想彻底禁止就加 `permissions.deny` 规则；不依赖命令文本的网络强制见沙箱网络隔离）。

**处理不可信内容的最佳实践**（官方原文五条）：

1. 批准前审查建议的命令
2. 避免把不可信内容直接管道给 Claude
3. 核实对关键文件的拟议改动
4. 用虚拟机运行脚本与工具调用，尤其在与外部网络服务交互时
5. 用 `/feedback` 报告可疑行为

> 官方警告：这些防护显著降低风险，但没有任何系统对所有攻击免疫。与任何 AI 工具协作时请始终保持良好的安全实践。

**MCP 安全**（与本主题直接相关）：允许的 MCP 服务器列表配置在你签入版本控制的设置中。官方鼓励自己编写 MCP 服务器，或只用你信任的提供商的服务器；Anthropic 在收录连接器到官方目录前按收录标准评审，但**不对任何 MCP 服务器做安全审计或管理**。

### Sandboxing：操作系统级隔离（译自官方 Sandboxing 页核心章节）

*译自 [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)（2026-09 当前版，核心章节全译）。*

Bash 沙箱让 Claude 无需停下来逐条请求许可即可运行大多数 shell 命令。你不再逐条批准，而是**定义命令能碰哪些文件与网络域名，由操作系统对每条 Bash 命令及其子进程强制执行该边界**。

沙箱内置于 Claude Code，运行于 macOS、Linux 与 WSL2（原生 Windows 不支持；Windows 请在 WSL2 发行版内运行）。macOS 用内置 Seatbelt 框架、无需安装；Linux/WSL2 依赖 `bubblewrap`（执行文件系统隔离的无特权沙箱工具）与 `socat`（经沙箱代理路由网络流量的中继），用发行版包管理器安装即可。

**运行 `/sandbox`** 打开沙箱面板：**Mode** 标签页选择沙箱命令的批准方式（auto-allow 自动放行沙箱内命令，或 regular permissions 保持常规弹窗）；**Overrides** 标签页决定沙箱内失败的命令能否回退到沙箱外运行（`allowUnsandboxedCommands` 设置）；**Config** 查看生效的沙箱设置。

默认情况下，沙箱内命令可以写工作目录、会话临时目录与用 `--add-dir` 等添加的目录；命令首次需要新的网络域名时会请求批准（auto 模式则交给分类器）。跑不了沙箱的命令回退到常规权限流程，其弹窗标题为 "Bash command (unsandboxed)"，你可以分辨哪些命令跑在沙箱外。

> 官方警告：默认情况下，如果沙箱因缺依赖或平台不支持而无法启动，Claude Code 会显示警告并在**无沙箱**情况下运行命令。要把它变成硬失败（安全门禁场景），设 `sandbox.failIfUnavailable: true`。

**凭据保护**（官方文档专节）：沙箱提供 protect credentials 与 mask credentials 能力——对环境变量中的凭据做掩码、对 AWS 请求重签名、对凭据文件（如 `~/.aws`、`~/.ssh`）设置不可读，防止智能体执行过程中把宿主机长期凭据泄露给被安装的第三方代码。

**网络隔离**：沙箱用代理强制执行域名白名单——不在白名单内的域名一律拒绝，且这种强制**不依赖命令文本**（与 `permissions.deny` 按命令字面匹配互补）。对"包管理器去哪下载"这类供应链关键流量，可以只放行官方注册表域名。

## 编者注：五条防线清单（本站编者补充，非翻译）

> 依编者按惯例标明。把上面三段合成一张操作清单：

| # | 防线 | 具体做法 | 出处 |
| --- | --- | --- | --- |
| 1 | 不盲装 | AI 建议的每个 `install` 命令，先去官方注册表核对包名与项目本体（下载量、仓库、发布者） | Willison/Lasso 实验的直接教训 |
| 2 | 锁定依赖 | 用 lockfile 提交精确版本；新增依赖必须走代码评审，而非会话中顺手批准 | 常规供应链实践 |
| 3 | 沙箱 + 网络白名单 | 开 `/sandbox`，注册表域名白名单 + `failIfUnavailable`，把"误装"的爆炸半径压到沙箱内 | Claude Code Sandboxing 文档 |
| 4 | 网络命令不过自动批准 | `curl`/`wget` 保持弹窗或进 deny；不可信内容不直接管道给模型 | Claude Code Security 文档 |
| 5 | 留意 MCP 与 rules 的来源 | 只用你信任的 MCP 服务器与规则文件——投毒的 rules/MCP 是同一攻击在配置层的变体 | Claude Code Security 文档 MCP 节 |

一句话：**幻觉包攻击攻击的是"安装时的自动化"，防线就是"安装前的摩擦"**——任何让 `install` 变慢半拍、多一个人看一眼的机制，都是收益率极高的防线。

---

> 下一篇预告：装错包是"别人的代码进了你的仓库"；下一篇讨论反向问题——"你用 AI 生成的代码，版权属于谁？出了侵权纠纷谁负责？"——AI 生成代码的 IP 与合规。

> **来源**：本文第一、二部分的主体分别译自 Simon Willison 博客三篇文章：[A quote from Andrew Nesbitt](https://simonwillison.net/2025/Apr/12/andrew-nesbitt/)（2025-04-12）、[Diving Deeper into AI Package Hallucinations](https://simonwillison.net/2024/Apr/1/diving-deeper-into-ai-package-hallucinations/)（2024-04-01，转述 Lasso Security 研究）、[Hallucinations in code are the least dangerous form of LLM mistakes](https://simonwillison.net/2025/Mar/2/hallucinations-in-code/)（2025-03-02），许可署名转载（作者博客允许引用转载，需署名并附原文链接）；第二节研究数字转述自 Lasso Security、Spracklen et al.（USENIX Security 2025）与 Trend Micro 的公开研究材料。第三节译自 [Claude Code Security](https://code.claude.com/docs/en/security) 与 [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)（Claude Code 官方文档，Copyright Anthropic PBC，教学用途翻译并署名）。开头编者按、各节署名说明与文末"编者注"为本站编者补充并已标明。抓取于 2026-09-13。
