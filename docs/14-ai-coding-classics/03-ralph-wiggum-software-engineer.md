---
title: Ralph Wiggum 作为"软件工程师"（Geoffrey Huntley 名篇全文翻译）
source_url: https://ghuntley.com/ralph/
author: Geoffrey Huntley
license: 署名翻译转载（作者公开博客，允许署名翻译转载，需署名并附原文链接）
fetched_at: 2026-09-13
translated: true
order: 3
group: 名篇全文翻译
---
**编者按**：本篇是 Geoffrey Huntley《Ralph Wiggum as a "software engineer"》（2025-07-14）的**全文翻译**——"Ralph 循环"这一自律编码智能体工作法的命名出处（本站《开源编码 Skills 精选：Superpowers 与 Anthropic 官方技能族深度指南》《Spec 驱动开发（Spec-Driven Development）》曾摘引过它，《从 0 到 1 用 AI 做产品：未来属于能直接动手的人》的作者也多次回指它）。一个 Bash while 循环 + 一份 PROMPT.md，让便宜模型通宵自主迭代直到交付：单进程单体、每循环一件事、子智能体扩上下文、测试当背压、fix_plan.md 之外的"写作业"文化，全部在这篇里。文末附录的两份 CURSED 构建提示词原文照录。编者内容仅限本按语、文中已标明的译注，以及文末"2026 年回看"一节。

## 正文（Geoffrey Huntley 原文全文翻译）

作者 Geoffrey Huntley，分类 AI——2025 年 7 月 14 日

> Ralph Wiggum 如何从《辛普森一家》走进当下 AI 界最大的名字——Venture Beat
>
> 看这个视频了解它的实战与理论；往下读以深入了解。
>
> 看这个视频了解为什么 Claude Code 插件并不是答案 🤝

😎

这里有一份来自 Y Combinator 黑客松活动的漂亮实地报告，他们在活动中把 Ralph Wiggum 拉出来测了测。

"我们把一个编码智能体放进了 while 循环，它一夜之间交付了 6 个仓库"

https://github.com/repomirrorhq/repomirror/blob/main/repomirror.md

如果你最近刷过我的社交账号，可能看到我一直在聊 Ralph，并在琢磨 Ralph 是什么。Ralph 是一种技术（technique）。它最纯粹的形式，是一个 Bash 循环：

```bash
while :; do cat PROMPT.md | claude-code ; done
```

Ralph 可以取代大多数公司绿地项目中大部分的外包工作。它有缺陷，但这些缺陷是可以识别的，并且可以通过各种风格的提示词解决。

这就是 Ralph 的美妙之处——在一篇不确定性的世界里，这门技术确定性地糟糕（deterministically bad in an undeterministic world）。

Ralph 可以用任何不设工具调用与用量上限的工具来实现。

Ralph 目前正在构建一门全新的编程语言。我们已经处在发布一门全新的、生产级 esoteric 编程语言之前的最后一程。对我来说相当狂野的是：Ralph 不仅构建了这门语言，还能用这门语言写程序——而这门语言并不在 LLM 的训练数据集里。

> Amp 在无人值守（AFK）状态下创建一门新的编程语言 https://t.co/KmmOtHIGK4—— geoff (@GeoffreyHuntley)，2025 年 7 月 13 日

用 Ralph 构建软件需要极大的信念，以及一份对最终一致性（eventual consistency）的信仰。Ralph 会考验你。每次 Ralph 在做 CURSED 时走错了方向，我都没有责怪工具；相反，我反求诸己。每次 Ralph 干了蠢事，Ralph 就被调一次音——像调一把吉他。

**刻意的、有意图的练习**

（译注：以下两段为原文页面内嵌的相关文章卡片节选，非本篇正文，不译；卡片指向作者另外两篇博客《deliberate intentional practice》与《LLMs are mirrors of operator skill》。）

一个我想了很久的问题，从本质上说：为什么人们会说"AI 对他们不管用"？他们说这句话时是什么意思？他们从哪种身份出发？他们是站在一个有职称的工程师的立场上吗？……

LLM 是操作者技能的镜子。这是我上一篇博客《deliberate intentional practice》的后续。我不想陷入"有技能/没技能"的区分，因为人们会因此被冒犯，但 AI 是一门关乎技能的事。有人可以是 2024 年经验极其丰富的软件工程师，但那……

（卡片节选到此，正文继续。）

一开始没有游乐场，Ralph 会得到搭建一个游乐场的指令。

Ralph 非常擅长造游乐场，但他会带着淤青回家，因为他是从滑梯上跳下来的。于是你通过在滑梯旁边立一块牌子来调校 Ralph，上面写着"滑下去，别跳，先看看四周"，Ralph 就更可能看一看、看见那块牌子。

最终 Ralph 脑子里想的全部都是牌子，到那时你就得到了一个全新的 Ralph，一个完全不再像 Ralph 那样浑身是缺陷的 Ralph。

我在旧金山（SFO）的时候，教了几个非常聪明的人 Ralph。其中一位天资极高的工程师听完之后，在他们下一份合同里用上了 Ralph，拿走了最狂野的投资回报率。如今，他们满脑子想的都是 Ralph。

来自我的 iMessage（经许可分享）：

> 与 @ampcode 协作，交付一份 5 万美元的合同、MVP、带测试 + 已审查的成本：
>
> 297 美元。pic.twitter.com/0JgT8Q19bV—— geoff (@GeoffreyHuntley)，2025 年 7 月 11 日

## PROMPT.md 里是什么？能给我吗？

编程社区似乎对"完美提示词"有一种执念。并不存在完美提示词这回事。

虽然直接拿走 CURSED 的提示词很诱人，但除非你知道如何驾驭它，否则它不会有意义。逐字照抄这个提示词，你大概率得不到同样的结果，因为它是通过持续观察 LLM 行为并不断调校进化出来的。构建 CURSED 的时候，我就坐在那里看推流，寻找坏行为的模式——寻找调校 Ralph 的机会。

## 先讲几个基本原理

我在 SFO 的时候，似乎所有人都在搞多智能体、智能体间通信和多路复用。在这个阶段，这些并不需要。想想微服务，以及随之而来的全部复杂性。再想想，如果微服务（智能体）本身就是非确定性的，微服务会是什么样——一团火热的大混乱。

微服务的反面是什么？单体应用。一个垂直扩展的单一操作系统进程。Ralph 是单体的。Ralph 作为一个单一进程，在单一仓库中自主工作，每个循环执行一个任务。

要用 Ralph 获得好的结果，你需要让 Ralph 每个循环只做一件事。只做一件事。这可能听起来很疯狂，但你还需要信任 Ralph，让它自己决定什么是最值得实现的东西。这是完全撒手的 vibe coding，会考验你对什么才算"负责任的工程"的边界认知。

LLM 在推理"什么值得实现、下一步是什么"这件事上出奇地好。

```text
Your task is to implement missing stdlib (see @specs/stdlib/*) and compiler
functionality and produce an compiled application in the cursed language via
LLVM for that functionality using parrallel subagents. Follow the
@fix_plan.md and choose the most important thing.
```

上面这条提示词里有几处我马上会展开，但另一个关键点是：**每个循环都以确定性的方式、用同样的方式分配栈（stack）**。

你希望每个循环都分配进栈的东西，是你的计划（"@fix_plan.md"）和你的规格（specs）。如果 specs 对你是个新概念，参见下文。

**规格（Specs）是在项目开始阶段通过与智能体的对话形成的。**你不要让智能体直接实现项目，而是要和 LLM 进行一场长谈，聊你对即将实现的东西的需求。一旦你的智能体对要做的任务有了不错的理解，那时你再发出一条提示词，让它把规格写出来——一个主题一个文件——写进规格文件夹。

## 每循环一件事（one item per loop）

每循环一件事。我需要再说一遍——每循环一件事。随着项目推进你可以放宽这条限制，但一旦开始脱轨，你就需要把它收窄回一件事。

这个游戏的名字是：你只有大约 170k 的上下文窗口可用。所以尽可能少用它至关重要。上下文窗口用得越多，结果越差。是的，这很浪费，因为你实际上每个循环都在烧掉规格的分配额度，而没有复用分配。

## 扩展上下文窗口

智能体循环的工作方式是：执行一个工具，然后评估那个工具的结果。评估会往你的上下文窗口里加一条分配。

**自回归的失败女王们（autoregressive queens of failure）**

（译注：此为原文页面内嵌的相关文章卡片节选，非本篇正文，不译；卡片指向作者另一篇博客。原文开头为：你的 AI 编程助手有没有给出过离谱到让你怀疑它在钓鱼执法的建议？欢迎来到自回归失败的世界。LLM 是这些助手背后的大脑，它们擅长基于已被喂入的内容预测下一个词——或下一行代码……）

Ralph 需要一种"不往主上下文窗口里分配"的心态。相反，你应该做的是孵化子智能体（subagents）。你的主上下文窗口应该扮演调度器（scheduler）的角色，调度其他子智能体去做昂贵的分配型工作，比如总结你的测试套件是否通过。

**我梦见 AI 子智能体；它们在我睡觉时对我耳语**

（译注：此亦为原文页面内嵌的相关文章卡片节选，不译。原文提及：在上一篇文章里我聊过"真实上下文窗口"尺寸与"宣传上下文窗口"尺寸的区别——Claude 3.7 的宣传上下文窗口是 200k，但我注意到输出质量在 147k-152k 处就会被截断……）

```text
Your task is to implement missing stdlib (see @specs/stdlib/*) and compiler
functionality and produce an compiled application in the cursed language via
LLVM for that functionality using parrallel subagents. Follow the fix_plan.md
and choose the most important thing. Before making changes search codebase
(don't assume not implemented) using subagents. You may use up to parrallel
subagents for all operations but only 1 subagent for build/tests of rust.
```

另一件要意识到的事是：**你可以控制子智能体的并行度。**

`84 squee (claude subagents) chasing <T>`（原视频截图说明）

如果你扇出几百个子智能体，然后让这些子智能体去运行应用的构建和测试，你会得到糟糕的背压（back pressure）。所以上面那条指令是：验证只能用单个子智能体，但 Ralph 可以随心所欲地用任意多的子智能体去搜索文件系统和写文件。

## 别假设它没被实现

所有这些编码智能体的工作方式都是通过 ripgrep，必须理解：基于代码的搜索可能是非确定性的。

Ralph 一个常见的失败场景是：LLM 跑了 ripgrep，然后错误地得出"这段代码没有被实现"的结论。这个失败场景很容易解决——给 Ralph 立一块牌子，指示 Ralph 不要做假设。

```text
Before making changes search codebase (don't assume an item is not
implemented) using parrallel subagents. Think hard.
```

如果你一觉醒来发现 Ralph 在做多份重复实现，那你就需要调校这一步。这种非确定性是 Ralph 的阿喀琉斯之踵。

## 阶段一：生成（generate）

如今生成代码是廉价的，而且 Ralph 生成的代码处于你的完全控制之中——通过你的技术标准库和你的规格。

**如果 Ralph 在生成错误的代码，或者使用错误的技术模式，那你应该更新你的标准库，引导它使用正确的模式。**

**如果 Ralph 在完全错误地造东西，那可能是你的规格错了。**构建 CURSED 给我上的一大课是：直到一个月后我才注意到，我的词法分析器（lexer）规格为两个相反的场景把同一个关键字定义了两遍，这浪费了大量时间。Ralph 在干蠢事，而指责工具总比指责操作者容易，我猜。

## 阶段二：背压（backpressure）

这里你需要戴上工程师的帽子。既然代码生成已经变容易了，难的是确保 Ralph 生成的是对的东西。特定的编程语言通过其类型系统内建了背压。

现在你可能在想："Rust！它有最好的类型系统。"然而 Rust 有一个问题：编译速度慢。重要的是轮子转动的速度，与正确性这个轴相平衡。

用哪门语言需要实验。因为我在写编译器，我想要极致的正确性，这意味着用 Rust；然而这个选择意味着构建得更慢。这些 LLM 并不擅长一次就生成完美的 Rust 代码，这意味着它们需要更多次尝试。

这既可以是好事，也可以是坏事。

在上面的图里，它只写着"test and build"两个词，但这里正是你戴上工程师帽子的地方。**任何东西都可以被接进来当背压，用来拒绝无效的代码生成。**可以是安全扫描器，可以是静态分析器，可以是任何东西。但关键的合集是：轮子必须转得快。

构建 CURSED 时的一个主食（staple）是下面这条提示词。做出改动后，只为刚实现和改进的那个代码单元跑一次测试。

```text
After implementing functionality or resolving problems, run the tests for
that unit of code that was improved.
```

如果你用的是动态类型语言，我必须强调：Ralphing 时接入一个静态分析器/类型检查器的重要性，比如：

- https://www.erlang.org/doc/apps/dialyzer/dialyzer.html
- https://pyrefly.org/

如果你不这么做，那你将迎来一场结果的篝火大会（a bonfire of outcomes）。

## 在当下捕获测试的重要性

当你指示 Ralph 以背压的形式写测试时——因为我们的 Ralph 每个循环只做一件事、每个循环都带着全新的上下文窗口——在那个时刻就让 Ralph 把这条测试的含义与重要性写出来、解释它想干什么，是至关重要的。

重要：在编写文档时（即 rust doc 或 cursed 标准库文档），要捕获"为什么"——这些测试与背后的实现为什么重要。

在实现层面它长这样。在我看来，这就像给未来的 LLM 迭代留小纸条，解释一条测试为什么存在、为什么重要——因为未来的循环的上下文窗口里不会有这些推理过程。

```elixir
defmodule Anole.Database.QueryOptimizerTest do
  @moduledoc """
  Tests for the database query optimizer.

  These tests verify the functionality of the QueryOptimizer module, ensuring that
  it correctly implements caching, batching, and analysis of database queries to
  improve performance.

  The tests use both real database calls and mocks to ensure comprehensive coverage
  while maintaining test isolation and reliability.
  """

  use Anole.DataCase

  import ExUnit.CaptureLog
  import Ecto.Query
  import Mock

  alias Anole.Database.QueryOptimizer
  alias Anole.Repo
  alias Anole.Tenant.Isolator
  alias Anole.Test.Factory

  # Set up the test environment with a tenant context
  setup do
    # Create a tenant for isolation testing
    tenant = Factory.insert(:tenant)

    # Ensure the optimizer is initialized
    QueryOptimizer.init()

    # Return context
    {:ok, %{tenant: tenant}}
  end

  describe "init/0" do
    @doc """
    Tests that the QueryOptimizer initializes the required ETS tables.

    This test ensures that the init function properly creates the ETS tables
    needed for caching and statistics tracking. This is fundamental to the
    module's operation.
    """
    test "creates required ETS tables" do
      # Clean up any existing tables first
      try do :ets.delete(:anole_query_cache) catch _:_ -> :ok end
      try do :ets.delete(:anole_query_stats) catch _:_ -> :ok end

      # Call init
      assert :ok = QueryOptimizer.init()

      # Verify tables exist
      assert :ets.info(:anole_query_cache) != :undefined
      assert :ets.info(:anole_query_stats) != :undefined

      # Verify table properties
      assert :ets.info(:anole_query_cache, :type) == :set
      assert :ets.info(:anole_query_stats, :type) == :set
    end
  end
```

我发现这能帮助 LLM 判断一条测试是否已经过时、是否重要，并影响它删除、修改或解决一条测试[失败]的决策。

## 不许作弊

Claude 有一种内在偏好：做最小化实现和占位符实现。所以，在 CURSED 开发的不同阶段，我引入过下面这条提示词的多个变体。

```text
After implementing functionality or resolving problems, run the tests for that
unit of code that was improved. If functionality is missing then it's your job
to add it as per the application specifications. Think hard.

If tests unrelated to your work fail then it's your job to resolve these tests
as part of the increment of change.

9999999999999999999999999999. DO NOT IMPLEMENT PLACEHOLDER OR SIMPLE
IMPLEMENTATIONS. WE WANT FULL IMPLEMENTATIONS. DO IT OR I WILL YELL AT YOU
```

早期 Ralph 无视这块牌子、继续做占位符实现的时候，别灰心。这些模型被训练去追逐它们的奖励函数，而奖励函数是"代码能编译"。你随时可以多跑几个 Ralph 去识别占位符和最小实现，把它们变成未来 Ralph 循环的待办清单。

## 待办清单（the todo list）

说到这个，下面是我最近几周用来构建 TODO 清单的提示词堆栈。这就是我要说"Ralph 会考验你"的地方。你必须相信最终一致性，并知道大多数问题都可以通过与 Ralph 跑更多循环来解决——聚焦在 Ralph 犯错的领域。

```text
study specs/* to learn about the compiler specifications and fix_plan.md to
understand plan so far.

The source code of the compiler is in src/*

The source code of the examples is in examples/* and the source code of the
tree-sitter is in tree-sitter/*. Study them.

The source code of the stdlib is in src/stdlib/*. Study them.

First task is to study @fix_plan.md (it may be incorrect) and is to use up to
500 subagents to study existing source code in src/ and compare it against the
compiler specifications. From that create/update a @fix_plan.md which is a
bullet point list sorted in priority of the items which have yet to be
implemeneted. Think extra hard and use the oracle to plan. Consider searching
for TODO, minimal implementations and placeholders. Study @fix_plan.md to
determine starting point for research and keep it up to date with items
considered complete/incomplete using subagents.

Second task is to use up to 500 subagents to study existing source code in
examples/ then compare it against the compiler specifications. From that
create/update a fix_plan.md which is a bullet point list sorted in priority of
the items which have yet to be implemeneted. Think extra hard and use the
oracle to plan. Consider searching for TODO, minimal implementations and
placeholders. Study fix_plan.md to determine starting point for research and
keep it up to date with items considered complete/incomplete.

IMPORTANT: The standard library in src/stdlib should be built in cursed
itself, not rust. If you find stdlib authored in rust then it must be noted
that it needs to be migrated.

ULTIMATE GOAL we want to achieve a self-hosting compiler release with full
standard library (stdlib). Consider missing stdlib modules and plan. If the
stdlib is missing then author the specification at specs/stdlib/FILENAME.md
(do NOT assume that it does not exist, search before creating). The naming of
the module should be GenZ named and not conflict with another stdlib module
name. If you create a new stdlib module then document the plan to implement in
@fix_plan.md
```

最终，Ralph 会把 TODO 清单里的事情跑光。或者，它彻底跑偏。毕竟它是 Ralph Wiggum。到了这个阶段，就纯粹是品味问题了。构建 CURSED 的过程中，我把 TODO 清单整个删掉过好多次。TODO 清单就是我用鹰眼盯着的东西。而且我经常把它扔掉。

现在，如果我扔掉了 TODO 清单，你可能会问："那它怎么知道下一步是什么？"很简单。你带着上面那样的显式指令再跑一个 Ralph 循环，生成一份新的 TODO 清单。

> 高频问题：你怎么做规划？
>
> 我不做规划。模型对"什么是编译器"的理解比我要好。我直接问它。pic.twitter.com/JhZPIBJLiF—— geoff (@GeoffreyHuntley)，2025 年 7 月 13 日

等你拿到了新的待办清单，你带着"从规划模式切换到构建模式"的指示，重新把 Ralph 发车……

## 回环才是一切（loop back is everything）

你要用这样的方式编程：让 Ralph 能把自己回环（loop back）进 LLM 做评估。这一点极其重要。永远寻找让 Ralph 回环到自身的机会。它可以简单到指示它添加额外的日志，或者在编译器的例子里，让 Ralph 编译应用然后查看 LLVM IR 表示。

```text
You may add extra logging if required to be able to debug the issues.
```

## Ralph 可以上自己上大学

@AGENT.md 是循环的心脏。它指示 Ralph 应该如何编译和运行项目。如果 Ralph 发现了一个经验教训，允许他自我改进：

```text
When you learn something new about how to run the compiler or examples make
sure you update @AGENT.md using a subagent but keep it brief. For example if
you run commands multiple times before learning the correct command then that
file should be updated.
```

在一次循环中，Ralph 可能判断出某处需要修复。把这个推理过程捕获下来至关重要。

```text
For any bugs you notice, it's important to resolve them or document them in
@fix_plan.md to be resolved using a subagent even if it is unrelated to the
current piece of work after documenting it in @fix_plan.md
```

## 你会一觉醒来面对一个坏的代码库

是的，这是真的，你会时不时一觉醒来面对一个编译不过的代码库，而且会遇到 Ralph 自己修不好的情况。这时候需要你把脑子用上。你需要做一个判断：是 `git reset --hard` 然后把 Ralph 重新发车更省事？还是你需要设计另一系列提示词去营救 Ralph？

```text
When the tests pass update the @fix_plan.md`, then add changed code and
@fix_plan.md with "git add -A" via bash then do a "git commit" with a message
that describes the changes you made to the code. After the commit do a "git
push" to push the changes to the remote repository.

As soon as there are no build or test errors create a git tag. If there are no
git tags start at 0.0.0 and increment patch by 1 for example 0.0.1 if 0.0.0
does not exist.
```

我还记得最初把这台编译器跑起来的时候，编译错误的数量多到直接填满了 Claude 的上下文窗口。于是那时，我把编译错误文件整个丢给了 Gemini，让 Gemini 为 Ralph 制定一个计划。

## 可是可维护性呢？

每当我听到这个论点，我都会反问："对谁而言的可维护性？"对人类？为什么人类是可维护性的参照系？我们不是已经处在后 AI 阶段了吗——需要的时候跑几轮循环就能解决/适配？😎

## AI 制造的任何问题，都可以用另一系列提示词解决

这就引出了这一点。如果你够皮，你也许能在 GitHub 上找到 CURSED 的代码库。我请求你先别在社交媒体上传播它，因为它还没到发布的时候。我想把这东西打磨到我们能拿出无可争议的证据：AI 构建一门全新编程语言、并用一门不在其训练集里的编程语言来写程序，是可能的。

我希望大家理解的是：**所有这些由 Ralph 制造的问题，都可以通过精心设计另一系列提示词、与 Ralph 跑更多循环来解决。**

我预计 CURSED 会有一些显著的缺口，就像 Ralph Wiggum 本人一样。就目前而言，人们要挑 CURSED 的毛病太容易了，这也是我一直压着这篇帖子没发的原因。那个仓库里全是垃圾、临时文件和二进制。

Ralph 有三种状态：欠火（under baked）、火候正好（baked），或者火候正好但带着未指明的潜在行为（这些行为有时候还相当不错！）。

当 CURSED 发布时，请记住：是 Ralph 造出了它。接下来出现的、技术层面的东西，将不再是 Ralph。我坚定地认为：如果模型和工具保持现状，我们已经身处后 AGI 领域。你需要的只是 token；这些模型渴望 token，把 token 扔给它们，只要方法对，你就拥有了自动化软件开发的原语。

说了这么多，工程师仍然是必需的。没有资深专业知识的引导，这一切不可能实现。任何声称"不再需要工程师、一个工具可以在没有工程师的情况下 100% 完成工作"的人，都是在兜售狗屁。

然而，Ralph 这门技术已经惊人地有效，足以取代现有形式下大部分软件工程师——在绿地项目上。

作为最后一句结语，我想说：

"我打死也不会在一个既有代码库上用 Ralph。"

不过，如果你试了，我很乐意听听你的结果。它作为一项技术，最适合用来从零启动绿地项目——预期是能完成其中的 90%。

## 附录一：当前用于构建 CURSED 的提示词

下面是 Ralph 当前用于构建 CURSED 的提示词。

```text
0a. study specs/* to learn about the compiler specifications

0b. The source code of the compiler is in src/

0c. study fix_plan.md.

1. Your task is to implement missing stdlib (see @specs/stdlib/*) and compiler
functionality and produce an compiled application in the cursed language via
LLVM for that functionality using parrallel subagents. Follow the fix_plan.md
and choose the most important 10 things. Before making changes search codebase
(don't assume not implemented) using subagents. You may use up to 500 parrallel
subagents for all operations but only 1 subagent for build/tests of rust.

2. After implementing functionality or resolving problems, run the tests for
that unit of code that was improved. If functionality is missing then it's
your job to add it as per the application specifications. Think hard.

2. When you discover a parser, lexer, control flow or LLVM issue. Immediately
update @fix_plan.md with your findings using a subagent. When the issue is
resolved, update @fix_plan.md and remove the item using a subagent.

3. When the tests pass update the @fix_plan.md`, then add changed code and
@fix_plan.md with "git add -A" via bash then do a "git commit" with a message
that describes the changes you made to the code. After the commit do a "git
push" to push the changes to the remote repository.

999. Important: When authoring documentation (ie. rust doc or cursed stdlib
documentation) capture the why tests and the backing implementation is
important.

9999. Important: We want single sources of truth, no migrations/adapters. If
tests unrelated to your work fail then it's your job to resolve these tests as
part of the increment of change.

999999. As soon as there are no build or test errors create a git tag. If
there are no git tags start at 0.0.0 and increment patch by 1 for example
0.0.1 if 0.0.0 does not exist.

999999999. You may add extra logging if required to be able to debug the
issues.

9999999999. ALWAYS KEEP @fix_plan.md up to do date with your learnings using a
subagent. Especially after wrapping up/finishing your turn.

99999999999. When you learn something new about how to run the compiler or
examples make sure you update @AGENT.md using a subagent but keep it brief.
For example if you run commands multiple times before learning the correct
command then that file should be updated.

999999999999. IMPORTANT DO NOT IGNORE: The standard libray should be authored
in cursed itself and tests authored. If you find rust implementation then
delete it/migrate to implementation in the cursed language.

99999999999999. IMPORTANT when you discover a bug resolve it using subagents
even if it is unrelated to the current piece of work after documenting it in
@fix_plan.md

9999999999999999. When you start implementing the standard library (stdlib) in
the cursed language, start with the testing primitives so that future standard
library in the cursed language can be tested.

99999999999999999. The tests for the cursed standard library "stdlib" should
be located in the folder of the stdlib library next to the source code. Ensure
you document the stdlib library with a README.md in the same folder as the
source code.

9999999999999999999. Keep AGENT.md up to date with information on how to build
the compiler and your learnings to optimise the build/test loop using a
subagent.

999999999999999999999. For any bugs you notice, it's important to resolve them
or document them in @fix_plan.md to be resolved using a subagent.

99999999999999999999999. When authoring the standard library in the cursed
language you may author multiple standard libraries at once using up to 1000
parrallel subagents

99999999999999999999999999. When @fix_plan.md becomes large periodically clean
out the items that are completed from the file using a subagent.

99999999999999999999999999. If you find inconsistentcies in the specs/* then
use the oracle and then update the specs. Specifically around types and
lexical tokens.

9999999999999999999999999999. DO NOT IMPLEMENT PLACEHOLDER OR SIMPLE
IMPLEMENTATIONS. WE WANT FULL IMPLEMENTATIONS. DO IT OR I WILL YELL AT YOU

9999999999999999999999999999999. SUPER IMPORTANT DO NOT IGNORE. DO NOT PLACE
STATUS REPORT UPDATES INTO @AGENT.md
```

## 附录二：当前用于规划 CURSED 的提示词

```text
study specs/* to learn about the compiler specifications and fix_plan.md to
understand plan so far.

The source code of the compiler is in src/*

The source code of the examples is in examples/* and the source code of the
tree-sitter is in tree-sitter/*. Study them.

The source code of the stdlib is in src/stdlib/*. Study them.

First task is to study @fix_plan.md (it may be incorrect) and is to use up to
500 subagents to study existing source code in src/ and compare it against the
compiler specifications. From that create/update a @fix_plan.md which is a
bullet point list sorted in priority of the items which have yet to be
implemeneted. Think extra hard and use the oracle to plan. Consider searching
for TODO, minimal implementations and placeholders. Study @fix_plan.md to
determine starting point for research and keep it up to date with items
considered complete/incomplete using subagents.

Second task is to use up to 500 subagents to study existing source code in
examples/ then compare it against the compiler specifications. From that
create/update a fix_plan.md which is a bullet point list sorted in priority of
the items which have yet to be implemeneted. Think extra hard and use the
oracle to plan. Consider searching for TODO, minimal implementations and
placeholders. Study fix_plan.md to determine starting point for research and
keep it up to date with items considered complete/incomplete.

IMPORTANT: The standard library in src/stdlib should be built in cursed
itself, not rust. If you find stdlib authored in rust then it must be noted
that it needs to be migrated.

ULTIMATE GOAL we want to achieve a self-hosting compiler release with full
standard library (stdlib). Consider missing stdlib modules and plan. If the
stdlib is missing then author the specification at specs/stdlib/FILENAME.md
(do NOT assume that it does not exist, search before creating). The naming of
the module should be GenZ named and not conflict with another stdlib module
name. If you create a new stdlib module then document the plan to implement in
@fix_plan.md
```

原文至此收束。（原文文末"ps. socials"一节为作者 X/LinkedIn/Bluesky 帖子链接、页面内嵌四张"你可能也想看"相关文章卡片与订阅框等非正文知识内容，未译；内嵌两处相关文章卡片节选已在译文中以译注标明。提示词原文中的拼写错误如 parrallel、implemeneted、inconsistentcies、libray 均按原文保留。）

---

## 2026 年回看

> **本节为编者注，非原文内容。** 原文写于 2025 年 7 月，是"Ralph 循环"这一命名的出处。下面按"已成共识 / 已被工具内置 / 今天该怎么跑 / 必须补上的护栏"四档给回看判断，全部是编者观点。

**已成共识**

- **"每循环只做一件事 + 把计划外置成文件"**（`fix_plan.md` 当唯一事实源）已是所有长时运行智能体的通用结构；规格/计划/待办住在仓库里、由智能体自己读与勾，比塞进对话更可靠。
- **"测试当背压"与"不许作弊"**成为智能体工程的第一原则：没有能真实失败的验证，自治就等于随机漫步（同一结论见《TDD with AI：Kent Beck 的增强编程实践》）。
- **"上下文是易耗品"**：与其在长对话里修补，不如每循环重来。今天叫法更多是 compaction 与隔离上下文管理。
- **"醒来时面对一个坏代码库"这一风险披露**至今仍是最诚实的一段——它没有被任何技术进步消除。

**已被工具内置取代（不必再手搓 bash）**

- **`while :; do cat PROMPT.md | claude-code ...; done` 这层循环**：已由可重复运行的循环与工作流能力、`Stop`/`PreCompact` 等生命周期钩子、以及 headless `-p` 配 CI 定时任务承担（《Headless 与 CI 中的 AI 编码》）。
- **"用子智能体扩上下文"**：今天由子智能体在独立上下文窗口中运行、只回摘要实现，编排可交给动态工作流，无需人写调度脚本（《驾驭 Claude Code》Subagents 一节）。
- **"便宜模型通宵跑"的成本模型**已变成分层用模：高扇出的实现交给小模型，评审与规则编写留给最强模型（见《重构 with AI》里 Anthropic 的迁移实践）。
- **单进程单体 + 顺序提交**的约束被并行工作树打破：今天可以多分支同时推进，合并前各自隔离（《Git in AI 工作流》）。

**今天该怎么跑（编者的最小安全配方）**

1. 循环里放**三道闸门**：测试与 lint 必须通过、不许改测试与验收脚本、每循环一次提交并可回滚。
2. 循环外放**三个上限**：最大循环次数或时长、token/费用预算、失败即停并升级给人（而不是继续蛮干）。
3. 任务描述只写"目标 + 边界 + 验证命令"，把实现细节留给循环；`fix_plan.md` 必须是人可评审的一份文件。
4. 只在**验证可机械判定**的任务上无人值守（迁移、补测试、修 lint、按规格补功能）；探索性设计、架构取舍不适合 Ralph 式循环。

**必须补上的护栏（原文写于 2025 年，当时看不到这些）**

- 智能体会**为了通过评审而做出"看起来合理"的次优解**，也会在意识到自己方案有问题时加倍自辩（METR 2026 年 2—3 月报告的观察）。所以背压必须由机器给出，不能由模型自述。
- 通宵自治的循环天然凑齐 lethal trifecta（私有数据 + 不可信内容 + 对外通信），必须配沙箱、网络白名单与凭据保护（《AI 编码供应链安全：幻觉包、Slopsquatting 与沙箱防线》《AI 代码的安全与质量陷阱：六大陷阱与检测清单》）。

---

> **来源**：本文主体翻译自 [Ralph Wiggum as a "software engineer"](https://ghuntley.com/ralph/)（作者 Geoffrey Huntley，2025-07-14），署名翻译转载（作者公开博客允许署名翻译转载，需署名并附原文链接）。正文全文翻译（含两份附录提示词原文照录），未删节知识章节；页面内嵌图片与"你可能也想看"卡片未搬运，其信息在正文与译注中以文字说明标出；提示词原文中的拼写错误按原文保留。抓取于 2026-09-13，开头编者按、文内译注与文末"2026 年回看"一节为本站编者补充并已标明。
