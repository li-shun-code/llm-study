---
title: Vibe Coding 是什么：概念源起与工程争议
source_url: https://simonwillison.net/2025/Mar/19/vibe-coding/
author: Simon Willison（主篇：Not all AI-assisted programming is vibe coding；延伸篇：Vibe engineering）
license: 署名转载（作者博客允许引用转载，需署名并附原文链接；标注 CC BY-SA 4.0 的内容同此处理）
fetched_at: 2026-09-13
translated: true
order: 1
---

> **来源**：本文主篇翻译自 [Not all AI-assisted programming is vibe coding (but vibe coding rocks)](https://simonwillison.net/2025/Mar/19/vibe-coding/)，作者 Simon Willison，许可署名转载（作者博客允许引用转载，需署名并附原文链接）。文末延伸阅读一节译自同作者 [Vibe engineering](https://simonwillison.net/2025/Oct/7/vibe-engineering/)（2025-10-07，含 2026-02-23 更新）。抓取于 2026-09-13。

**Vibe coding**（氛围编程，一译"凭感觉编程"）正当红。这个词由 Andrej Karpathy 几周前（2025 年 2 月 6 日）在一条推文中创造，随后登上《纽约时报》、Ars Technica、《卫报》和无数网络讨论。

我担心的是，这个定义已经悄悄偏离了它的本意。我看到有人把"vibe coding"套在所有借助 AI 写代码的行为上。我认为这既稀释了这个词，也给人造成错误印象——让人误以为负责任的 AI 辅助编程（AI-assisted programming）就只有这么点能耐。

**Vibe coding 不等于"在 LLM 帮助下写代码"！**

完整引用 Andrej 的原推如下（粗体强调为我所加）：

> There's a new kind of coding I call "vibe coding", where you fully give in to the vibes, embrace exponentials, and **forget that the code even exists**. It's possible because the LLMs (e.g. Cursor Composer w Sonnet) are getting too good. Also I just talk to Composer with SuperWhisper so I barely even touch the keyboard.
>
> I ask for the dumbest things like "decrease the padding on the sidebar by half" because I'm too lazy to find it. I "Accept All" always, I don't read the diffs anymore. When I get error messages I just copy paste them in with no comment, usually that fixes it. The code grows beyond my usual comprehension, I'd have to really read through it for a while. Sometimes the LLMs can't fix a bug so I just work around it or ask for random changes until it goes away.
>
> **It's not too bad for throwaway weekend projects, but still quite amusing**. I'm building a project or webapp, but it's not really coding—I just see stuff, say stuff, run stuff, and copy paste stuff, and it mostly works.

（译注：Karpathy 的推文原文是英文，此处保留原文，下附全文翻译。）

> 有一种新的编程方式，我称之为"vibe coding"——你完全交给感觉（vibes），拥抱指数增长，并且**忘掉代码本身的存在**。之所以可能，是因为 LLM（比如搭配 Sonnet 的 Cursor Composer）已经强得离谱。而且我是用 SuperWhisper 语音跟 Composer 说话的，几乎不用碰键盘。
>
> 我会让它干最琐碎的事，比如"把侧边栏内边距减半"，因为我自己找都懒得找。我永远点"全部接受"，再也不看 diff 了。报错就原样复制粘贴进去，一句注释不加，通常也就修好了。代码规模超出我的理解范围，真要读懂得花一阵子。有时 LLM 修不好某个 bug，我就绕过去，或者乱改一通直到它消失。
>
> **对一次性周末项目来说还挺不赖，而且相当好玩**。我在做一个项目或 Web 应用，但这算不上真正的编程——我只是看看东西、说说东西、跑跑东西、复制粘贴东西，它大体能跑。

我非常喜欢这个定义。Andrej 是极具天赋、经验极其丰富的程序员——他完全不需要 AI 帮忙。他这么用 LLM，是因为尝试狂野的新想法本身就很有趣，而 LLM 产出代码的速度比最顶尖的人类程序员还要快一个数量级。对低风险项目和原型来说，为什么不干脆放开手干呢？

当我说 vibe coding 时，我指的是：**用 LLM 构建软件，但不审查它写的代码**。

## 负责任地用 LLM 写代码，不是 vibe coding

我们把这种"忘掉代码存在"的方式，与专业软件开发者使用 LLM 的方式对照一下。

软件开发者的工作不是（仅仅是）批量产出代码和功能。我们需要造出可证明可用的代码——能被其他人（和机器）理解，并能支撑未来的持续开发。

我们要考虑性能、可访问性、安全、可维护性、成本效率。软件工程就是权衡取舍——我们的职责是在几十种候选方案里，平衡显式与隐式的各种需求后做出选择。

而且我们**必须读代码**。我对"生产级 AI 辅助编程"的黄金法则是：如果我没办法向别人准确解释某段代码在做什么，我就不会把它提交进我的仓库。

如果一段代码是 LLM 替你写的，而你随后审查了它、充分测试了它、并确信自己能向别人讲清它的工作原理——那就不是 vibe coding，那就是软件开发。用不用 LLM 支持这个活动无关紧要。

我在《Here's how I use LLMs to help me write code》里详细写过我自己的流程。Vibe coding 只是我整个方法中的一小部分。

## 别丢掉 vibe coding 的独特价值

我也不希望"vibe coding"沦为一个贬义词，与"不负责任的 AI 辅助编程"画等号。这种形态奇特的编程方式，能给这个世界带来太多东西！

我相信**每个人都应当拥有用计算机自动化生活中琐碎任务的能力**。为了让计算机替你完成一件非常具体的事，你本不该需要计算机科学学位或编程训练营。

如果 vibe coding 能让数百万新人具备构建自己定制工具的能力，我再高兴不过了。

其中一些人会 bitten by the programming bug（被编程"咬"上瘾），进而成为熟练的软件开发者。这个职业最大的门槛之一是陡峭到离谱的入门学习曲线——vibe coding 把这道初始门槛几乎削平了。

Vibe coding 对有经验的开发者同样价值巨大。我之前谈过"用 LLM 写代码其实很难"——搞清楚什么行得通、什么行不通，靠的是长期积累的直觉，一路上暗坑和陷阱可不少。

我认为 vibe coding 是帮助有经验的开发者建立"LLM 能为我做什么、不能做什么"之直觉的最佳工具。我用 vibe coding 发布了 80 多个小实验（tools.simonwillison.net），一路学到了极多。我鼓励任何开发者，无论水平高低，都去试试。

## 什么时候可以放心 vibe code？

如果你是经验丰富的工程师，这部分对你多半是常识——所以我写给刚起步的人：

- 项目应当是**低风险（low stakes）**的。想想你要写的代码如果带 bug 或安全漏洞，可能造成多大伤害：会不会有人因此受损——名誉、金钱，或更糟？如果你打算做给别人用的软件，这一点尤其重要！
- 考虑**安全**。这很难——安全是个巨大的话题。几条高层提示：
  - 小心**机密信息（secrets）**——一切形状上像密码的东西，比如访问某个在线服务的 API Key。代码涉及机密信息时，你必须小心不把它们意外暴露，这意味着你得理解代码是怎么工作的！
  - 想想**数据隐私**。如果你构建的工具能接触私密数据——任何你不愿意在共享屏幕时展示给全世界的东西——请谨慎行事。你可以 vibe code 一个粘贴私人信息的个人工具，但你必须非常确定自己理解数据有没有可能离开你的机器。
- 做**良好的网络公民**。任何向其他平台发请求的东西，都可能增加那些服务的负载（进而增加成本）。这也是我喜欢 Claude Artifacts 的原因——它的沙箱能防止意外波及别处。
- **你的钱在冒险吗**？我见过恐怖故事：有人 vibe code 了一个调用某 API 的功能，没设账单上限，结果账单滚到几千美元。对任何按用量计费的服务使用 vibe coding 时，务必万分小心。

如果你要 vibe code 任何可能被他人使用的软件，我建议在发布之前，请一位更有经验的人帮你做个"氛围检查"（vibe check，哈哈）。

## 我们如何让 vibe coding 变得更好？

我认为这里有一批引人入胜的软件设计难题。

让完全的新手安全地 vibe coding，要从**沙箱（sandbox）**说起。Claude Artifacts 是最早大规模可用的 vibe coding 平台之一，它的沙箱方案堪称典范：代码只能在锁死的 `<iframe>` 里运行，只能加载经批准的库，不能向其他站点发起任何网络请求。

这让人很难把项目搞砸并伤害到别处。但它也极大限制了项目能做的事——比如不能用 Claude Artifact 访问外部 API 的数据，甚至不能构建"把你自己的提示词发给某个 LLM"的软件。

其他流行的 vibe coding 工具，比如 Cursor（最初面向专业开发者），安全护栏就少得多。

这个领域有巨大的创新空间。我期待看到一场工具的寒武纪大爆发，帮助人们尽可能高效且安全地构建自己的定制工具。

## 放手去 vibe code 吧

我真的不想打消新人对 vibe coding 的热情。学习任何东西最好的方式就是动手做一个项目！

对有经验的程序员，这是培养"LLM 能与不能"直觉的绝佳途径；对新手，没有任何方式比它更能让你亲眼看到代码能实现什么。

但请不要把 vibe coding 与 LLM 辅助编程的其他所有用法混为一谈。

## 延伸阅读：从 Vibe Coding 到 Vibe Engineering（2025-2026 争论演进）

> 以下译自 Simon Willison《Vibe engineering》（2025-10-07，含 2026-02-23 更新），展示概念提出一年半以来工程社区的定义之争。

我觉得 vibe coding 如今已经稳固地指代那种用 AI 快速、随意、不负责的软件开发方式——完全由提示词驱动，完全不关心代码实际如何运作。这就留下一个术语空档：光谱的另一端该怎么称呼——资深专业人士用 LLM 加速工作，同时对产出的软件保持骄傲而自信的担责？

我提议称之为 **vibe engineering**（氛围工程），半开玩笑地。

*2026 年 2 月 23 日更新*：如今看来 "Agentic Engineering"（智能体工程）这个说法占了上风。我为此新建了一个标签，并在写一本"不算书的书"《Agentic Engineering Patterns》。

与非玩具项目上高效使用 LLM 的一个少有人言的真相是：它*很难*。理解如何使用这些工具需要很深的功夫，有很多陷阱要避开，而且它们 churn out 可用代码的速度，抬高了"人类参与者"应当贡献什么的标准。

**编码智能体（coding agents）**——2025 年 2 月发布的 Claude Code、4 月的 OpenAI Codex CLI、6 月的 Gemini CLI 这类能迭代修改代码、主动测试直到达成指定目标的工具——极大提升了 LLM 在真实编码问题上的可用性。我越来越多地听到经验丰富、可信的工程师同时运行多个智能体，并行处理多个问题。我最初是怀疑的，但后来自己也开始了，效果出奇地好——就是精神上很累！

这与经典 vibe coding 完全不同。后者是我把一个简单、低风险的任务外包给 LLM，看起来能用就收货。而与编码智能体迭代出"我确信未来能维护"的生产级代码，是完全不同的过程。

同样清晰的是：**LLM 会积极奖励那些顶级的软件工程实践**：

- **自动化测试**。项目若有一套稳健、全面、稳定的测试套件，智能体编码工具如虎添翼。没有测试？智能体可能"声称"能用却压根没测过，而且任何新改动都可能在你不察觉的情况下弄坏不相干的功能。测试先行（test-first）对能循环迭代的智能体尤其有效。
- **提前规划**。先迭代出高层计划，再交给智能体写码。
- **全面的文档**。和人类一样，LLM 一次只能把代码库的一个子集装进上下文。喂给相关文档，它就能不读代码直接正确使用其他模块的 API。
- **良好的版本控制习惯**。当改动可能出自一个编码智能体时，"撤销错误、理解何时何地为何改动"更加重要。LLM 的 Git 功力极强——它们能自己翻历史追查 bug 起源，用起 git bisect 比大多数开发者都溜。
- **有效的自动化**。持续集成、自动格式化与 lint、到预览环境的持续部署——智能体编码工具同样受益。LLM 还能顺手帮你写自动化脚本，让任务下次被精确一致地重复。
- **代码审查文化**。不言自明。
- **一种非常奇怪的"管理"**。从编码智能体身上获得好结果，与从人类协作者身上获得好结果惊人地相似：清晰指令、必要上下文、可执行的反馈。比带真人容易得多——你不用担心冒犯或打击它们——但你已有的管理经验会出奇地有用。
- 非常好的**手工 QA（质量保障）**。自动化测试之外，你还要擅长手工测试，包括预判并深挖边界情况。
- 强大的**研究能力**。任何一个编码问题都有几十种解法。搞清楚最优选项、证明某条路线可行，一直都是重要工作，也是在"放飞智能体去写代码"之前必须扫清的障碍。
- **发布到预览环境**的能力。智能体做出功能后，有一种安全预览的方式（而不是直接上生产），审查效率会高得多，上线坏东西的风险大幅降低。
- 对"**什么能外包给 AI、什么必须亲自处理**"的直觉。这随着模型与工具变强而不断演化。
- 更新后的**估算能力**。估算项目工期一直是资深工程师最难也最重要的工作之一。AI 辅助编程让这件事*更难*了——过去很慢的事现在快得多，但估算又依赖一批大家还在摸索的新变量。

如果你想真正榨干这些新工具的能力，你必须处于*巅峰状态*。你不只负责写代码——你要研究方案、决定高层架构、写规格说明、定义成功标准、设计智能体循环、规划 QA、管理一支越来越多"如果你给它机会就绝对会作弊的怪异数字实习生"大军，并花*巨量时间做代码审查*。

以上几乎都是资深软件工程师已经具备的特质！**AI 工具放大既有的专业能力**。你作为软件工程师的技能与经验越多，与 LLM 和编码智能体协作得到的成果就越快越好。

> 译注：本文所在模块后续篇章——工具对比（第 2 篇）、Claude Code 最佳实践（第 3 篇）、Git in AI 工作流（第 7 篇）、代码审查（第 11 篇）、安全陷阱（第 14 篇）——正是"vibe engineering / agentic engineering"一侧的各项具体功夫；而第 15 篇《从 0 到 1 用 AI 做产品》会回到"低风险、快迭代"的 vibe coding 一侧，两者结合方为完整图景。
