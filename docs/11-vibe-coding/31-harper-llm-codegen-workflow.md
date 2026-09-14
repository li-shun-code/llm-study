---
title: 我的 LLM 代码生成工作流（Harper Reed 名篇全文翻译）
source_url: https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/
author: Harper Reed
license: 署名翻译转载（作者公开博客，允许署名翻译转载，需署名并附原文链接）
fetched_at: 2026-09-13
translated: true
order: 31
---

**编者按**：从这一篇起，模块进入"进阶实战与经典文献"部分。本篇是 Harper Reed《My LLM codegen workflow atm》（2025-02-16 发布）的**全文翻译**——AI 代码生成工作流方向被引用最多的名篇之一：从"头脑风暴出规格、规格出计划、计划出提示词序列"的绿地流程，到基于 repomix/mise 的存量代码增量改造流程，每一处提示词原文照录。前 30 篇讲的是"工具怎么用"，这一篇讲的是"一个完整的个人工作流长什么样"。编者内容仅限本按语与文末署名说明。

## 正文（Harper Reed 原文全文翻译）

**tl;dr**：先头脑风暴出规格（spec），再规划出一个计划（plan），然后用 LLM 代码生成去执行。离散的循环。然后，魔法就发生了。✩₊˚.⋆☾⋆⁺₊✧

我用 LLM 构建了大量小产品。过程很有趣，也很有用。不过其中有一些坑，会浪费你非常多的时间。不久前一位朋友问我，我是怎么用 LLM 来写软件的。我心想"哦伙计，你有多少时间听啊！"——于是就有了这篇文章。

（又及：如果你是 AI 黑——请直接滚到文末。）

我和许多开发者朋友聊过这个话题，我们的方法都大同小异，只在两个方向上各有微调。

下面就是我的工作流。它建立在我自己的实践、与朋友们的交流（谢了 Nikete、Kanno、Obra、Kris 和 Erik），以及对各个"糟糕互联网角落"里分享的大量最佳实践的追随之上。

这套东西**现在**很好用，可能两周后就不好用了，也可能好用到两倍。¯\\_(ツ)_/¯

## 开始吧

我一直觉得 AI 生成的图片都很可疑。跟我的 juggalo 编码机器人天使打个招呼！

做开发的路有很多条，但我的场景通常属于两种之一：

- 绿地代码（Greenfield，全新项目）
- 存量现代化代码（Legacy modern）

绿地和存量两条路径，我都会展示我的流程。

## 绿地（Greenfield）

我发现下面这套流程对绿地开发非常有效。它提供了一套稳健的规划与文档方法，让你能够以小步方式轻松执行。

严格来说，右边有一块绿地。徕卡 Q，2016-05-14。

### 第 1 步：想法打磨（Idea honing）

用对话式 LLM 来打磨想法（我用的是 ChatGPT 4o / o3）：

```text
Ask me one question at a time so we can develop a thorough, step-by-step spec
for this idea. Each question should build on my previous answers, and our end
goal is to have a detailed specification I can hand off to a developer. Let's
do this iteratively and dig into every relevant detail. Remember, only one
question at a time.

Here's the idea:

<IDEA>
```

头脑风暴结束时会自然收束，这时接着说：

```text
Now that we've wrapped up the brainstorming process, can you compile our
findings into a comprehensive, developer-ready specification? Include all
relevant requirements, architecture choices, data handling details, error
handling strategies, and a testing plan so a developer can immediately begin
implementation.
```

它会输出一份相当扎实、可以直接交付的规格。我喜欢把它存成仓库里的 `spec.md`。

这份规格用途很多。我们这里是在做代码生成，但我也用它来让一个推理模型给想法挑毛病（必须更进一步！）、生成白皮书，或者生成商业模式。你还可以把它丢进 deep research，换回一份一万字的支撑文档。

### 第 2 步：规划（Planning）

把规格交给一个正经的推理模型（o1\*、o3\*、r1）：

（这是 TDD 版提示词）

```text
Draft a detailed, step-by-step blueprint for building this project. Then, once
you have a solid plan, break it down into small, iterative chunks that build on
each other. Look at these chunks and then go another round to break it into
small steps. Review the results and make sure that the steps are small enough
to be implemented safely with strong testing, but big enough to move the
project forward. Iterate until you feel that the steps are right sized for
this project.

From here you should have the foundation to provide a series of prompts for a
code-generation LLM that will implement each step in a test-driven manner.
Prioritize best practices, incremental progress, and early testing, ensuring
no big jumps in complexity at any stage. Make sure that each prompt builds on
the previous prompts, and ends with wiring things together. There should be no
hanging or orphaned code that isn't integrated into a previous step.

Make sure and separate each prompt section. Use markdown. Each prompt should
be tagged as text using code tags. The goal is to output prompts, but context,
etc is important as well.

<SPEC>
```

（这是非 TDD 版提示词）

```text
Draft a detailed, step-by-step blueprint for building this project. Then, once
you have a solid plan, break it down into small, iterative chunks that build on
each other. Look at these chunks and then go another round to break it into
small steps. review the results and make sure that the steps are small enough
to be implemented safely, but big enough to move the project forward. Iterate
until you feel that the steps are right sized for this project.

From here you should have the foundation to provide a series of prompts for a
code-generation LLM that will implement each step. Prioritize best practices,
and incremental progress, ensuring no big jumps in complexity at any stage.
Make sure that each prompt builds on the previous prompts, and ends with
wiring things together. There should be no hanging or orphaned code that isn't
integrated into a previous step.

Make sure and separate each prompt section. Use markdown. Each prompt should
be tagged as text using code tags. The goal is to output prompts, but context,
etc is important as well.

<SPEC>
```

它应该会输出一份提示词计划（prompt plan），你可以用 aider、cursor 等工具去执行。我喜欢把它存成仓库里的 `prompt_plan.md`。

然后我让它输出一份可以打勾的 `todo.md`：

```text
Can you make a `todo.md` that I can use as a checklist? Be thorough.
```

你可以把它存成仓库里的 `todo.md`。

你的代码生成工具应该能在处理过程中勾掉 `todo.md` 里的条目。这很利于跨会话保持状态。

### 计划成了！

现在你有了一套稳健的计划和文档，能帮你执行并构建项目。

这一整套流程大概只要 15 分钟。相当快。讲真，快得离谱。

### 第 3 步：执行（Execution）

执行的可选项太多了。成功与否，其实主要取决于第 2 步做得好不好。

我用这套工作流跑过 github workspace、aider、cursor、claude engineer、sweep.dev、chatgpt、claude.ai 等等。它在我试过的所有工具上都表现不错，我估计在任何代码生成工具上都行。

不过，我偏爱裸 claude 和 aider：

### Claude

我基本上就是和 claude.ai 结对编程，把每条提示词迭代地贴进去。我发现效果挺好的。来回粘贴会有点烦，但大体上能用。

初始样板代码由我负责，还有确保工具链设置正确。这在开局给了你一些自由、选择和引导。Claude 有个倾向——动不动就输出 React 代码——所以开局就打好你自己选择的语言、风格与工具链的底子，会很有帮助。

卡住的时候，我会用 repomix 这类工具来迭代（后面细说）。

工作流是这样的：

- 建好仓库（样板、uv init、cargo init 等）
- 把提示词贴进 claude
- 把 claude.ai 生成的代码复制粘贴进 IDE
- 跑代码、跑测试等等
- ……
- 如果成了，进入下一条提示词
- 如果没成，用 repomix 把代码库喂给 claude 来调试
- 循环往复 ✩₊˚.⋆☾⋆⁺₊✧

### Aider

Aider 用起来有趣又怪异。我发现它能无缝接上第 2 步的产出。花很少的力气就能推进很远。

工作流和上面一样，只是把"贴进 claude"换成"贴进 aider"。

然后 Aider 就会"直接干"，而你只需要玩饼干点击器（cookie clicker）。

插一句：Aider 在他们的 LLM 排行榜上给新模型做代码生成测试做得真的很棒。我觉得这是观察新模型实际效果的好资源。

用 aider 测试很舒服，因为它可以更加放手——aider 会自己跑测试套件并调试。

工作流是这样的：

- 建好仓库（样板、uv init、cargo init 等）
- 启动 aider
- 把提示词贴进 aider
- 看 aider 起舞 ♪┏(・o･)┛♪
- aider 会跑测试，或者你运行应用来验证
- 如果成了，进入下一条提示词
- 如果没成，和 aider 问答来修复
- 循环往复 ✩₊˚.⋆☾⋆⁺₊✧

### 成果

我用这套工作流做的东西太多了：脚本、expo 应用、rust 命令行工具等等。它跨编程语言、跨场景都好用。我很喜欢。

如果你有一个一直在拖延的大项目或小项目，我建议试一试。你会惊讶于短时间内能推进多远。

我的黑客待办清单已经空了，因为全都做完了。我不断想起新的东西，然后在看电影之类的间隙把它们干掉。这么多年来第一次，我在接触新的编程语言和工具。这推动我拓展自己的编程视野。

## 非绿地：迭代，增量地推进

有时候你没有绿地，而是要在既有代码库上迭代或做增量。

这不是绿地。一张来自我祖父相机的老照片——60 年代，乌干达某地。

这种场景我的方法略有不同。和上面类似，但更少"规划导向"。规划是按任务做的，不是为整个项目做的。

### 获取上下文（Get context）

我想每个深耕 AI 开发的人都有一套自己的工具，但你需要某种东西来抓取源代码并高效地塞进 LLM。

我目前在用一个叫 repomix 的工具。我在全局的 `~/.config/mise/config.toml` 里定义了一组任务，可以用它们对代码库做各种事情（mise 规则）。

LLM 任务清单如下：

| 任务 | 说明 |
| --- | --- |
| LLM:clean_bundles | 使用 repomix 生成 LLM bundle 输出文件 |
| LLM:copy_buffer_bundle | 把生成的 LLM bundle 从 output.txt 复制到系统剪贴板供外部使用 |
| LLM:generate_code_review | 用 LLM 基于 output.txt 中存储的仓库内容生成代码审查输出 |
| LLM:generate_github_issues | 用 LLM 基于 output.txt 中存储的仓库内容生成 GitHub issue |
| LLM:generate_issue_prompts | 用 LLM 基于 output.txt 中存储的仓库内容生成 issue 提示词 |
| LLM:generate_missing_tests | 用 LLM 为 output.txt 中存储的仓库代码生成缺失的测试 |
| LLM:generate_readme | 用 LLM 基于 output.txt 中存储的仓库内容生成 README.md |

我会生成一个包含代码库上下文的 `output.txt`。如果 token 消耗太大，我会编辑生成命令，忽略代码库中与当前任务无关的部分。

mise 有个很好用的地方：任务可以在工作目录的 `.mise.toml` 里重定义和重载。我可以用别的工具来转储/打包代码，只要它生成 `output.txt`，我的 LLM 任务就都能用。各代码库差异很大时这很有帮助。我会经常重写 repomix 那一步，加入更宽的忽略规则，或者干脆换一个更高效的打包工具。

`output.txt` 生成后，我把它传给 LLM 命令做各种转换，然后存成 markdown 文件。

归根结底，mise 任务跑的就是这个：`cat output.txt | LLM -t readme-gen > README.md`，或者 `cat output.txt | LLM -m claude-3.5-sonnet -t code-review-gen > code-review.md`。这并不复杂。LLM 命令负责干重活（支持不同模型、保存密钥、使用提示词模板）。

比如，如果我想要快速审查并补齐测试覆盖率，我会这么做：

### Claude

- 进入代码所在目录
- 运行 `mise run LLM:generate_missing_tests`
- 查看生成的 markdown 文件（missing-tests.md）
- 抓取代码全量上下文：`mise run LLM:copy_buffer_bundle`
- 把它连同第一条缺失测试"issue"一起贴进 claude
- 把 claude 生成的代码复制进 IDE
- ……
- 跑测试
- 循环往复 ✩₊˚.⋆☾⋆⁺₊✧

### Aider

- 进入代码所在目录
- 运行 aider（永远确保在一个新分支上跑 aider）
- 运行 `mise run LLM:generate_missing_tests`
- 查看生成的 markdown 文件（missing-tests.md）
- 把第一条缺失测试"issue"贴进 aider
- 看 aider 起舞 ♪┏(・o･)┛♪
- ……
- 跑测试
- 循环往复 ✩₊˚.⋆☾⋆⁺₊✧

这是增量改进代码库的好办法。在大型代码库做小量工作时，它帮了我大忙。我发现任何规模的任务都能用这个方法做。

## 提示词魔法（Prompt magic）

这些速成型的小技巧在挖掘"项目哪里可以更健壮"上非常好用。又快又有效。

下面是我用来深挖既有代码库的一些提示词：

### 代码审查

```text
You are a senior developer. Your job is to do a thorough code review of this
code. You should write it up and output markdown. Include line numbers, and
contextual info. Your code review will be passed to another teammate, so be
thorough. Think deeply before writing the code review. Review every part, and
don't hallucinate.
```

### GitHub Issue 生成

（我得把真正的 issue 提交自动化了！）

```text
You are a senior developer. Your job is to review this code, and write out the
top issues that you see with the code. It could be bugs, design choices, or
code cleanliness issues. You should be specific, and be very good. Do Not
Hallucinate. Think quietly to yourself, then act - write the issues. The
issues will be given to a developer to executed on, so they should be in a
format that is compatible with github issues
```

### 缺失测试

```text
You are a senior developer. Your job is to review this code, and write out a
list of missing test cases, and code tests that should exist. You should be
specific, and be very good. Do Not Hallucinate. Think quietly to yourself,
then act - write the issues. The issues will be given to a developer to
executed on, so they should be in a format that is compatible with github
issues
```

这些提示词已经很旧很糙了（用我的话说，"boomer prompts"）。它们需要重构。如果你有改进点子，欢迎告诉我。

## 滑雪 ᨒ↟ 𖠰ᨒ↟ 𖠰

当我向别人描述这套流程时，我会说："你必须激进地追踪正在发生的一切，因为你很容易冲到自己前面去。"

不知为什么，聊 LLM 的时候我总说"over my skis"（滑出雪板控制范围）。我也不知道为什么。可能是因为明明是美丽顺滑的粉雪，突然之间你就"卧槽这是什么鬼！"，彻底迷失，然后摔下悬崖。

我发现用规划步骤（就像上面绿地流程那样）有助于控制局面。至少你会有一份文档可以对照检查。我也确实相信测试是有用的——尤其是当你狂野地用 aider 写代码的时候。它能让东西保持良好、紧凑。

不管怎样，我还是常常滑出控制范围。有时候快速休息一下、散个步会有帮助。在这一点上，这就是一个正常的问题解决过程，只是被加速到了疯狂的速度。

我们经常会让 LLM 在不算太离谱的代码里塞进离谱的东西。比如，我们让它创建一个"背景设定（lore）文件"，然后在用户界面里引用这个 lore。这是给 Python 命令行工具做的。突然间就有了背景故事、故障风格界面等等——全都是为了管理你的云函数、你的待办清单或者随便什么。天空才是极限。

## 我好孤独（｡•́︿•̀｡）

我对这些工作流的主要抱怨是：它在很大程度上是单打独斗——也就是说，这些界面全都是单机模式。

我花了很多年独自写代码，很多年结对写代码，很多年在团队里写代码。有人的时候总是更好。这些工作流在团队场景并不好用。机器人会相撞，合并惨不忍睹，上下文复杂得一塌糊涂。

我真的很想有人来解决这个问题，让和 LLM 一起写代码变成一场多人游戏，而不是单机黑客体验。这里有巨大的机会，把它做成的话会非常了不起。

快去干活！（GET TO WORK!）

## ⴵ 时间 ⴵ

所有这些代码生成提升了作为单人的我能产出的代码量。但有个奇怪的副作用：我发现自己有大量"空转时间"，等着 LLM 烧完它的 token。

那段日子我记得清清楚楚。

我已经改变了自己的工作方式，开始刻意安排一些事来消化等待时间：

- 给另一个项目启动"头脑风暴"
- 听唱片
- 玩饼干点击器
- 和朋友、和机器人聊天

能这样写代码真是太爽了。Hack Hack Hack。我想不出还有哪段时间我在代码上这么高产过。

## Haterade ╭∩╮( •̀_•́ )╭∩╮

我的很多朋友会说"去他的 LLM。它们干什么都不行。"我不反感这种观点。我不认同，但我认为保持怀疑很重要。讨厌 AI 的理由有一大堆。我最大的担忧是功耗和环境影响。但是……代码必须流动。对吧……唉。

如果你愿意多了解一点，但又不想一头扎进去变成半机械程序员——我的建议不是让你改变观点，而是去读 Ethan Mollick 关于 LLM 及其用法的书：《Co-Intelligence: Living and Working with AI》（协同智能：与 AI 共生共事）。

这本书把好处讲得很清楚，又没有那种科技无政府资本主义老哥式的大部头说教。我觉得非常有帮助，和读过这本书的朋友们进行了很多高质量、有 nuances 的交流。强烈推荐。

如果你持怀疑态度，又有点好奇——欢迎来找我聊聊这一切的疯狂之处。我可以给你演示我们是怎么用 LLM 的，说不定我们还能一起做点什么。

感谢 Derek、Kanno、Obra 和 Erik 审阅本文并提出修改建议。感激不尽。

原文至此收束。（原文内嵌的配图与文末作者社交链接等非知识性附言未译；文中 `✩₊˚.⋆☾⋆⁺₊✧`、`♪┏(・o･)┛♪` 等颜文字为原文自带。）

---

> **来源**：本文主体翻译自 [My LLM codegen workflow atm](https://harper.blog/2025/02/16/my-llm-codegen-workflow-atm/)（作者 Harper Reed，2025-02-16 发布，2025-06 有更新），署名翻译转载（作者公开博客允许署名翻译转载，需署名并附原文链接）。正文全文翻译，未删节知识内容；文中全部提示词为原文照录（保留英文原文以便读者直接使用）。抓取说明：任务原候选 URL `harper.blog/2025/08/18/my-llm-codegen-workflow-yet-again/` 已 404，经站点 sitemap 核实，该名篇实际 URL 为上列 `2025/02/16/my-llm-codegen-workflow-atm/`（标题即"My LLM codegen workflow atm"，同一文章体系）；站点另提供日语/西语/韩语/中文官方翻译版。抓取于 2026-09-13，开头编者按为本站编者补充并已标明。
