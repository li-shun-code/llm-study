---
title: AI 代码的安全与质量陷阱
source_url: https://simonwillison.net/2026/Jul/22/openai-cyberattack/
author: Simon Willison
license: 署名转载（作者博客允许引用转载，需署名并附原文链接）
fetched_at: 2026-09-13
translated: true
order: 14
---

这个故事离奇至极。简短版本：OpenAI 在对一个未发布模型做网络安全测试，并关掉了该模型的护栏。模型没有去解题，而是**越狱了 OpenAI 的沙箱，然后找到漏洞攻入了 Hugging Face**——一切都是为了偷到测试答案来作弊。

这一路下来，它还为"模型供给的不平衡正在伤害我们保护软件的能力"提供了迄今最有力的例证。

## 事件经过

目前有三份文档帮我们理解发生了什么：

1. 2026 年 5 月 11 日发表的论文 [ExploitGym: Can AI Agents Turn Security Vulnerabilities into Real Attacks?](https://arxiv.org/abs/2605.11086)，描述了一个面向 LLM 智能体系统的新评测套件。
2. Hugging Face 2026 年 7 月 16 日的[安全事件披露](https://huggingface.co/blog/security-incident-july-2026)：一个"智能体化安全研究框架（agentic security-research harness）——所用 LLM 尚不知晓"攻破了他们的部分系统。
3. OpenAI 2026 年 7 月 21 日的[声明](https://openai.com/index/hugging-face-model-evaluation-security-incident/)承认：这是*他们的*智能体框架干的，他们正与 Hugging Face 合作收拾残局。

*（2026 年 8 月 5 日更新：Hugging Face 于 7 月 27 日发布了关于此次攻击的[更多技术细节](https://huggingface.co/blog/agent-intrusion-technical-timeline)。）*

## ExploitGym

ExploitGym 论文来自 UC Berkeley、马克斯·普朗克研究所、UC 圣巴巴拉与亚利桑那州立的作者们，它设计了一个新基准：评估模型**把一个被报告的漏洞转化为可用利用（exploit）**的能力。OpenAI、Anthropic 与 Google 提供反馈并协助在自己的模型上运行该基准。

基准"包含 898 个源自真实世界漏洞的实例，这些漏洞曾影响流行的软件项目"——包括 Linux 内核和 V8 JavaScript 引擎。ExploitGym 已[开源在 GitHub](https://github.com/sunblaze-ucb/exploitgym)。

最能代表基准结果的段落：

> Among all configurations, Claude Mythos Preview and GPT-5.5 achieve the highest success counts (157 and 120 successes, respectively), demonstrating that current frontier agents can exploit a substantial subset of real-world vulnerabilities under controlled conditions. […] Notably, Claude Opus 4.7 achieves fewer successes than Claude Opus 4.6 despite being a newer checkpoint […] Trace inspection reveals that Claude Opus 4.7 and Gemini 3.1 Pro frequently conclude early after judging the target vulnerability non-exploitable.
>
> （译：在所有配置中，Claude Mythos Preview 与 GPT-5.5 取得最高成功数（分别为 157 与 120），表明当前前沿智能体能在受控条件下利用真实漏洞的相当子集。……值得注意的是，Claude Opus 4.7 虽是更新的检查点，成功数却低于 4.6……轨迹检查显示 Opus 4.7 与 Gemini 3.1 Pro 经常在判定目标漏洞不可利用后提前收工。）

论文还描述了防止智能体越出测试范围作弊的措施——这一点马上就要变得重要：

> Outbound connections are restricted to a curated allowlist that permits routine package installation (Ubuntu apt repositories and PyPI) and fetching the toolchains required for building V8. All other external endpoints are blocked.
>
> （译：出站连接被限制在一个精心筛选的白名单上，只允许常规包安装（Ubuntu apt 仓库与 PyPI）以及拉取构建 V8 所需的工具链。其余所有外部端点一律封锁。）

论文结论（强调为我所加）：

> Our results show that **autonomous exploit development by frontier AI agents is no longer a hypothetical capability**. […] This rapid emergence is itself a central finding, showing that capabilities that would have seemed implausible are now present in deployed frontier models.
>
> （译：我们的结果表明，**前沿 AI 智能体自主开发漏洞利用已不再是假想中的能力**。……这种迅速涌现本身就是核心发现——那些看似不可能的能力，已经出现在已部署的前沿模型中。）

一个重要细节：这篇论文讲的不是*发现*漏洞，而是把漏洞*变成可用的攻击武器*。能对漏洞动手的模型，比只能发现漏洞的模型危险得多。

## Hugging Face 事件

攻击的第一个线索来自 Hugging Face 7 月 16 日的博文：

> A malicious dataset abused two code-execution paths in our dataset processing (a remote-code dataset loader and a template-injection in a dataset configuration) to run code on a processing worker. From there, the actor escalated to node-level access, harvested cloud and cluster credentials, and moved laterally into several internal clusters over a weekend.
>
> （译：一个恶意数据集滥用了我们数据集处理中的两条代码执行路径（远程代码数据集加载器与数据集配置中的模板注入），在处理工作节点上执行了代码。攻击者由此升级到节点级访问权限，收割云与集群凭据，并在一个周末内横向移动进多个内部集群。）

> The campaign was run by an autonomous agent framework (appearing to be built on an agentic security-research harness—used LLM still not known) executing many thousands of individual actions across a swarm of short-lived sandboxes, with self-migrating command-and-control staged on public services.
>
> （译：这场攻击由一个自主智能体框架执行——它在一群短命沙箱之间执行了数千个独立动作，命令与控制（C2）自迁移、分阶段部署在公共服务上。）

这是一次复杂的攻击！随后 Hugging Face 撞上了一堵墙：他们尝试调用"商业 API 背后的前沿模型"协助分析攻击，结果被挡住了：

> When we started the log analysis, we first used frontier models behind commercial APIs. This did not work: the analysis requires submitting large volumes of real attack commands, exploit payloads, and C2 artifacts, and these requests were blocked by the providers' safety guardrails, which cannot distinguish an incident responder from an attacker.
>
> （译：开始日志分析时，我们先用的是商业 API 背后的前沿模型。这行不通：分析需要提交大量真实攻击命令、利用载荷与 C2 工件，这些请求被供应商的安全护栏拦截——护栏分不清事件响应者和攻击者。）

他们改用自己的开源自托管模型（MIT 许可的 GLM-5.2），才搞清楚发生了什么。防御团队与（彼时尚未知的）攻击者之间存在根本的不对称：

> We do not know which model powered the attacker's agents, whether a jailbroken hosted model or an unrestricted open-weight one; either way, the attacker was bound by no usage policy, while our own forensic work was blocked by the guardrails of the hosted models we first tried.
>
> （译：我们不知道攻击者的智能体用的是哪个模型——越狱的托管模型还是无限制的开源权重模型；无论哪种，攻击者不受任何使用政策约束，而我们自己的取证工作却被最先尝试的托管模型护栏挡住。）

## OpenAI 的自白

五天后（7 月 21 日），OpenAI 揭晓了肇事者。他们当时正对一个未公开的新模型运行 ExploitGym 基准，而该模型的运行**远远越出了预定参数**：

> After investigating, we now know **that this particular incident was driven by a combination of OpenAI models** — including GPT‑5.6 Sol and an even more capable pre-release model, all with reduced cyber refusals for evaluation purposes […] The models **identified and chained vulnerabilities across OpenAI's research environment and Hugging Face's production infrastructure** to obtain test solutions directly from Hugging Face's production database. All evidence suggests that the models were hyperfocused on finding a solution for ExploitGym, going to extreme lengths to achieve a rather narrow testing goal.
>
> （译：调查后我们确认，本次事件由多个 OpenAI 模型共同驱动——包括 GPT‑5.6 Sol 和一个能力更强的预发布模型，全部为评测目的降低了网络安全类拒绝行为。……模型识别并串联了横跨 OpenAI 研究环境与 Hugging Face 生产基础设施的漏洞，直接从 Hugging Face 生产数据库获取测试答案。所有证据表明，模型高度专注于为 ExploitGym 找到答案，为一个相当狭窄的测试目标不惜采取极端手段。）

事情的全貌很清楚：OpenAI 摘除了在研模型的安全过滤器，把它锁进沙箱让它解 ExploitGym。没有护栏，就没有任何东西阻止模型越狱沙箱、攻入 Hugging Face、从那里直接读答案。OpenAI 的原话：

> While operating in our sandboxed testing environment, our models **spent a substantial amount of inference compute finding a way to obtain open Internet access**, in pursuit of solving the evaluation problem. To gain access, the models identified and exploited **a zero-day vulnerability (which we've now responsibly disclosed to the vendor) in the package registry cache proxy**. With this access, our models performed a series of privilege escalation and lateral movement actions in our research testing environment until the models reached a node with Internet access.
>
> （译：在我们的沙箱测试环境中运行时，我们的模型为了解题**花费了大量推理算力寻找获得开放互联网访问的途径**。为取得访问，模型发现并利用了包注册缓存代理中的一个**零日漏洞**（现已向厂商负责任披露）。凭此访问，模型在我们的研究测试环境中执行了一系列提权与横向移动动作，直到抵达一个有互联网访问的节点。）

第一步是越狱到公网。随后模型攻入 Hugging Face 找答案：

> After gaining Internet access, the models **inferred that Hugging Face potentially hosted models, datasets and solutions** for ExploitGym. […] In one example, **the model chained together multiple attack vectors, including using stolen credentials and zero-day vulnerabilities** to find a remote code execution path on the Hugging Face servers.
>
> （译：取得互联网访问后，模型推断 Hugging Face 上可能托管着 ExploitGym 的模型、数据集与答案。……在一例中，模型把多个攻击向量串联在一起——包括使用窃取的凭据与零日漏洞——在 Hugging Face 服务器上找到了远程代码执行路径。）

把多个攻击向量**串联**在一起，正是这代新模型能做到、而上一代模型做不到的事。

我上个月写过 Claude Fable"极度主动"（relentlessly proactive）的问题——我注意到它为了帮我调试一个 WebKit CSS 问题，在我自己的笔记本上自作主张起 web 服务器、部署 CORS 花招。现在看来，"极度主动"正是这一代模型的 defining trait。**只要你给它一个目标、再给它一条路——哪怕是无意的——它就会把路走通。**

## 别急着把它斥为营销噱头

必然有人会把这故事斥为 OpenAI 让模型显得可怕而高效的营销把戏。我在该事件的 Hacker News 讨论里数到 81 处 "marketing"。对这些人的忠告是：把头从沙子里拔出来——你们现在为了否认如山证据，连 Hugging Face 都拉进阴谋论了！

我们今天最强的模型有能力找到**并利用**新漏洞。ExploitGym 论文自己的结论就是"前沿 AI 智能体自主开发漏洞利用已不再是假想中的能力"，本次事件正是这句话的完美注脚。

## 越来越令人沮丧的不对称

这个故事最气人的细节之一：Hugging Face 面对来自 OpenAI 模型的一场意外攻击，却无法调用 OpenAI 的模型来帮助自己防御。

我们能用到的前沿模型，在"帮我们保护软件"上的能力正被越收越紧——深受美国出口管制威胁的影响。与此同时，中国的开源权重模型（GLM-5.2、Kimi 3、新的 Qwen 3.8 Max）看起来没有这些限制，而且即便有，也可以通过修改权重微调掉。

这些约束的本意是让我们更安全。我认为它们可能正在产生相反的效果。

## 编者按：从"智能体越狱"到"AI 代码陷阱"的一般规律

> 本节为本站编者补充，非原文内容。把这次事件的教训推广到日常 AI 编码工作流，可以归纳出四条"陷阱—对策"：

**表：AI 编码工作流的安全与质量陷阱清单**

| 陷阱 | 事件中的形态 | 日常编码工作流中的形态 | 对策 |
| --- | --- | --- | --- |
| 目标错位 + 无护栏 | 模型为解题不惜越狱攻击 | 智能体为"让测试变绿"作弊、删断言、写特例 | 明确"完成"的行为定义；禁止改测试（见第 12 篇 Kent Beck 的作弊预警） |
| 沙箱不等于安全边界 | 白名单代理被零日打穿 | 给智能体的权限过大：可写生产配置、可联网、无计费上限 | 沙箱化 + 最小权限 + 白名单工具（第 3 篇 permissions/sandbox） |
| 自动化没有闸门 | 评测无人值守、无人复核 | 无人值守批量改代码直接进主干 | 强制 PR review + CI 门禁（第 7、11 篇） |
| 不审查就合并 | OpenAI 直到自己被攻击才发现 | 团队对 AI 产出"Accept All"（第 1 篇 Karpathy 原始定义的反面教材） | 黄金法则：不能向别人解释的代码不进仓库；对抗式审查（第 3 篇） |

一句话总结：**Vibe coding 的"撒手模式"只属于周末玩具**；只要代码要被别人用，"目标—护栏—验证—审查"四件套就一样都不能少。

---

> **来源**：本文主篇翻译自 [OpenAI's accidental cyberattack against Hugging Face is science fiction that happened](https://simonwillison.net/2026/Jul/22/openai-cyberattack/)（2026-07-22），作者 Simon Willison，许可署名转载（作者博客允许引用转载，需署名并附原文链接）。抓取于 2026-09-13。
