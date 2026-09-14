---
title: AI 生成代码的 IP 与合规：版权承诺、责任边界与可版权性
source_url: https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/
author: Microsoft（Copilot Copyright Commitment 官方公告，Brad Smith 与 Hossein Nowbar）；GitHub（Copilot 行内建议负责任使用官方文档）；美国版权局（U.S. Copyright Office，2025 报告，公共领域）
license: 署名翻译（Microsoft/GitHub 版权归原厂、教学用途翻译；美国版权局报告为美国政府作品、公共领域；逐节署名）
fetched_at: 2026-09-13
translated: true
order: 27
---

**编者按**：上一篇讲"别人的代码怎么进你的仓库"（供应链）；本篇讨论反向的合规问题：**你用 AI 生成的代码，出了版权纠纷谁负责？它本身受版权保护吗？** 正文三段逐节署名：Microsoft 官方"Copilot Copyright Commitment"公告全文翻译（对商用 Copilot 客户的侵权兜底承诺）；GitHub 官方"Copilot 行内建议负责任使用"文档中与版权直接相关的章节翻译；美国版权局《Copyright and Artificial Intelligence, Part 2: Copyrightability》（2025-01）执行摘要全文翻译（美国版权局为联邦机构，该报告属美国政府作品、公共领域）。文末"编者注：五条合规要点"为本站补充，已标明。

## 一、Microsoft"Copilot 版权承诺"（官方公告全文翻译）

*译自 [Microsoft announces new Copilot Copyright Commitment for customers](https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/)（Microsoft On the Issues，2023-09-07，作者 Brad Smith（Microsoft 总裁）与 Hossein Nowbar（首席法务官），全文翻译）。*

顾客问我们：能否在不必担心版权索赔的情况下使用 Microsoft 的 Copilot 服务？我们给出一个直截了当的回答：**可以。而且如果你因此受到版权层面的质疑，我们将承担其中涉及的法律风险。**

这意味着，我们将把今年早些时候针对 Bing 搜索结果使用所做的版权承诺，扩展到我们所有的商用 Copilot 服务——**GitHub Copilot**、Microsoft 365 Copilot 与 Microsoft Copilot Studio。具体而言：如果第三方起诉你使用了 Microsoft 的这些 Copilot 服务，并主张其生成的内容侵犯了版权，且你按照我们产品中内置的内容过滤器与其他安全系统的要求使用了该服务，**我们将为你抗辩，并支付任何不利判决或和解的金额**。

客户们常向我们提出的一个问题是：随着 AI 的出现，他们担心使用这些新型工具会让其承担比使用现有软件更多的法律风险。我们相信，技术应当以有利于所有人的方式演进，而为客户分担这一法律风险，是鼓励更多组织与个人负责任地拥抱 AI 的最好方式之一。

这一承诺是我们围绕 AI 采取的广泛治理方法的一部分。我们深知，人们与社会只有在对技术有信心时，才会充分拥抱它。正如我们之前所写，AI 需要的不只是新规则，还需要一种**治理创新**的方法：一种既有护栏、又不停滞的方法。

我们认识到，仅凭公司无法独自构建这类信任。它需要各国政府继续推进有效的监管框架，也需要全行业共同努力，解决围绕 AI 的最棘手问题——包括训练数据、派生作品（derivative works）与赔偿（indemnification）等知识产权问题。

> 编者补注（已标明）：该承诺 2023-11 扩展更名为"Customer Copyright Commitment"，适用于全部商用 Copilot 产品；适用前提（使用产品内置内容过滤与安全系统等）以 Microsoft 官方页面的当前版本为准。

## 二、GitHub 官方口径：负责任使用文档中的 IP 相关章节（署名翻译）

*译自 GitHub 官方文档《Responsible use of GitHub Copilot inline suggestions》（[docs.github.com](https://docs.github.com/en/copilot/responsible-use/inline-suggestions)，2026-09 当前版）中与版权直接相关的章节。*

### 公共代码匹配（Public code matching）

> GitHub Copilot 使用一个**重复检测系统**，用于识别建议是否与公开可得的代码匹配。组织与个人可以配置该系统：**阻断**匹配的建议，或为匹配建议**附带引用**（代码来源仓库与许可信息）。

（产品说明节亦指出：根据你的 GitHub 设置，内容过滤系统会阻断或标注"包含与公开代码匹配"的建议。）

### 限制（Limitations 节，与 IP 相关条目）

* **与公共代码匹配**：行内建议能够生成新代码，但这是**概率性**的生成。虽然概率低，Copilot 生成的建议**有可能与训练集中的代码匹配**。
* **潜在的偏见**：Copilot 训练数据的来源可能包含会被工具延续的偏见与错误。
* **不准确代码**：Copilot 可能生成看似有效、但语义或语法并不正确、或未准确反映开发者意图的代码——应仔细评审与测试，尤其对关键或敏感应用。

### 部署与采用的最佳实践（Best practices 节选译）

* **谨慎行事并在重大决策或敏感领域评估结果**：在代码影响安全、法律、财务或医疗结果的场景，先评审建议、确认输出符合预期再采纳。
* **评估法律与监管考量**：客户有责任在其特定行业与法域下，评估 AI 生成代码的使用是否符合适用法律与监管要求——包括知识产权、隐私与合规义务。
* **把 Copilot 行内建议当工具，而不是替代品**：采纳前始终评审 Copilot 的建议，采纳后再行验证，确保满足要求、无错误与安全隐患。
* **适当行使人工监督**：AI 产出可能不准确、不完整、有偏、与目标错位或无关。用户应评审 Copilot 的响应并验证其符合预期与要求。

> 文档以 **IMPORTANT** 级别标注（官方原文）：
>
> **"用户承担与生成代码相关的全部风险，包括安全漏洞、Bug 与 IP 侵权。"**
>
> （Users assume all risks associated with generated code including security vulnerabilities, bugs, and IP infringement.）

> 译注（编者，已标明）：把本节与第一节合读，GitHub 官方口径的两层结构就清楚了——**承诺层**（Microsoft 对商用 Copilot 客户的侵权抗辩与赔付承诺，前提是使用内置过滤器）与**责任层**（个人计划用户、以及承诺覆盖范围之外的场景，风险明示由用户承担）。两层都是官方原文，不互相抵消。

## 三、美国版权局报告：AI 生成内容的可版权性（执行摘要全文翻译）

*译自 U.S. Copyright Office《Copyright and Artificial Intelligence, Part 2: Copyrightability》（2025 年 1 月，[copyright.gov/ai](https://www.copyright.gov/ai/)，执行摘要节；美国政府作品，公共领域）。*

**执行摘要**

本报告的第二部分讨论 AI 系统生成输出的可版权性（copyrightability），分析了何种类型与程度的人类贡献足以使这些输出纳入美国版权保护的范围。

在版权局就其调查通告（Notice of Inquiry）收到的逾万条意见中，约半数涉及可版权性。绝大多数意见者同意：现行法律在这一领域是充分的，**完全由 AI 生成的材料不具有可版权性**。

但对于"包含某种人类贡献"的生成式 AI 输出能否受保护，意见出现了分歧：何种类型、何种子量的贡献能构成现行法律下的"作者身份"，各方观点不一。许多人还强调该领域需要更高的清晰度，包括"把 AI 用作创作过程中的工具"的情形。

政策层面，有人主张把保护扩展到生成式 AI 创作的材料将鼓励更多作品产生，促进文化与知识进步、令公众受益；版权局也听到了相反的担忧：AI 生成产出的激增会削弱人类创作的动力。

在承认可版权性须逐案判定的同时，本部分阐述了支配这类分析的法律原则，并评估其如何适用于 AI 生成内容。

基于对版权法律与政策的分析，并借鉴公众意见，版权局得出以下**结论与建议**（全文翻译）：

* 可版权性与 AI 的问题**可以依现行法律解决**，无需立法变革。
* 使用 AI 工具**辅助**而非**代替**人类创造力，不影响输出获得版权保护。
* 版权保护人类作者在作品中创造的原创表达——即使作品同时包含 AI 生成的材料。
* 版权**不延及**纯 AI 生成的材料，或对表达元素缺乏足够人类控制的材料。
* 人类对 AI 生成输出的贡献是否足以构成作者身份，必须**逐案分析**。
* 基于当前普遍可得技术的运作方式，**提示词（prompt）本身不足以提供充分控制**。
* 人类作者对其在 AI 生成输出中**可感知的**作者性创作享有版权——包括对输出中材料的选择、协调或编排的创造性，以及对输出的创造性修改。
* 为 AI 生成内容设立额外版权或特殊（sui generis）保护的论证**尚未成立**。

版权局将继续监测技术与法律的发展，判断是否需要 revisit 上述结论，并持续为公众提供帮助（包括进一步的登记指引）。

> 编者补注（已标明）：报告对"提示词"的分析原文（Part 2, Chapter 3）给出的核心判断是：提示词反映的是"想让 AI 做什么"的意图，而非对表达元素的确定控制——同样的提示词可以产生截然不同的多种输出，用户在提示阶段无法预测或挑选具体表达。这正是"提示词本身不足以构成作者身份"的理由。

## 编者注：AI 生成代码的五条合规要点（本站编者补充，非翻译）

> 依编者按惯例标明。综合三份官方文本，给个人开发者与团队一张可执行的合规清单：

1. **先弄清你的服务与承诺覆盖**：商用 Copilot（Business/Enterprise）享有 Microsoft 的版权承诺（抗辩 + 赔付，前提：使用内置内容过滤器）；个人计划与自有工具链不在覆盖内——风险自担是 GitHub 文档的明示条款。
2. **开启并保持重复检测/公共代码匹配配置**：要么阻断与公开代码匹配的建议，要么让它附带来源与许可引用——这是官方给出的"防复制粘贴式侵权"机制。
3. **把"人贡献了什么"记录下来**：按 USCO 结论，版权落在"可感知的人类作者性创作"上——架构设计、手工修改、创造性编排可受保护；纯 prompt 直出的代码大概率没有你的版权。保留设计文档与 diff 历史，就是在为"你的部分"留存证据。
4. **AI 产出走同一套评审与许可扫描**：AI 生成的代码与人类贡献的代码适用完全相同的门禁（SCA/许可证扫描、评审）——第 25 篇的陷阱表同样适用于 IP 场景。
5. **敏感领域先做法务评估**：GitHub 官方最佳实践明说"评估法律与监管考量"是客户的责任——金融、医疗、强监管行业的团队，应在铺开前完成一次法务评审。

---

> 下一篇预告：合规之外，AI 编码还有一笔"账面成本"。下一篇译出 Claude Code 官方《Manage costs effectively》——如何看账、如何按组织设限、以及十几条降耗策略。

> **来源**：本文第一节完整翻译自 [Microsoft announces new Copilot Copyright Commitment for customers](https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/)（Microsoft On the Issues 官方博客，2023-09-07，作者 Brad Smith 与 Hossein Nowbar）；第二节译自 GitHub 官方文档 [Responsible use of GitHub Copilot inline suggestions](https://docs.github.com/en/copilot/responsible-use/inline-suggestions) 的 IP 相关章节（公共代码匹配、限制、最佳实践与风险提示，GitHub Inc. 官方文档）；第三节执行摘要完整翻译自 U.S. Copyright Office《Copyright and Artificial Intelligence, Part 2: Copyrightability》（2025-01，美国政府作品，公共领域）。各节均逐节署名，教学用途翻译。两处"编者补注"、一处译注与文末"编者注"为本站编者补充并已标明。抓取于 2026-09-13。
