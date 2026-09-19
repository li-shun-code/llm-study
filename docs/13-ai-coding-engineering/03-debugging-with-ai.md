---
title: 调试 with AI：让 AI 定位 Bug 的工作流
source_url: https://words.filippo.io/claude-debugging/
author: Filippo Valsorda（主篇）；Anthropic（Claude Code 官方文档 Common workflows，延伸）
license: 署名翻译（原文页未附开源许可，按作者公开博客教学署名翻译处理；官方文档部分 Copyright Anthropic PBC）
fetched_at: 2026-09-13
translated: true
order: 3
group: 日常开发流
---
调试是上下文与验证两者的交汇点：**上下文是稀缺资源，验证是回路的燃料**（机制见《心智模型：LLM 如何"看"你的代码》）。一个可复现的失败就是天然的"可验证完成标准"，而排查需要的巨大探索量最适合外包给智能体。本篇主篇翻译 Go 密码学专家 Filippo Valsorda 的著名实战记录：他用 Claude Code 定位了自己都束手无策的底层密码学 Bug——三战三捷。文末补译官方调试工作流、可复制的调试提示词模板与验收清单。

## 主篇：Claude Code 能调试底层密码学（全文翻译）

*以下译自 [Claude Code Can Debug Low-level Cryptography](https://words.filippo.io/claude-debugging/)（2025-11-01）。*

过去几天我在写 ML-DSA（NIST 去年夏天发布的一个后量子签名算法）的新 Go 实现。我全程直播写完了它，周四晚上收工。除了……**Verify 一直在拒绝合法签名**：

```text
$ bin/go test crypto/internal/fips140/mldsa
--- FAIL: TestVector (0.00s)
    mldsa_test.go:47: Verify: mldsa: invalid signature
    mldsa_test.go:84: Verify: mldsa: invalid signature
    mldsa_test.go:121: Verify: mldsa: invalid signature
FAIL
FAIL     crypto/internal/fips140/mldsa   2.142s
FAIL
```

我已经精疲力尽，试着调了半小时就放弃了，打算第二天头脑清醒再来。心血来潮，我决定让 Claude Code 趁我读邮件的间隙试一试——本来只指望它胡乱扑腾几下、或者排除掉一些可能性。

**结果它很快找出了我那个相对新颖密码学算法实现里一个相当复杂的底层 Bug。**我分享这个案例，一是因为它让我意识到自己对"什么时候该召唤 AI"仍然没有好的直觉，二是因为对仍然怀疑这类工具的人，这是绝佳的研究样本。

> 利益披露：Anthropic 送了我几个月的 Claude Max。他们某天找上来，说把订阅送给一些开源维护者。也许这是让我上瘾好将来付费的套路，也许他们就是希望我写点这类东西，也许只是出于好意。总之他们没有提出或暗示要我公开写 Claude Code 的任何内容。

### 找到 Bug

我用 Claude Code v2.0.28 + Opus 4.1、无系统提示词启动，给了它下面这个提示词（错别字也照录）：

> I implemented ML-DSA in the Go standard library, and it all works except that verification always rejects the signatures. I know the signatures are right because they match the test vector.
>
> YOu can run the tests with "bin/go test crypto/internal/fips140/mldsa"
>
> You can find the code in src/crypto/internal/fips140/mldsa
>
> Look for potential reasons the signatures don't verify. ultrathink
>
> I spot-checked and w1 is different from the signing one.

几分钟后它给我发回了一个[完整的修复](https://go-review.googlesource.com/c/go/+/716540/1..2)。

也许我不该惊讶！也许对更熟悉 AI 工具的人来说这显然是个好的 AI 任务：**一个边界清晰、带着失败测试的问题**。但话说回来，这是一个复杂、相对新颖算法的全新实现里的底层问题。

它发现我把 `HighBits` 和 `w1Encode` 合并成了一个函数（供 Sign 使用），然后 Verify 又复用了它——而 Verify 那里 `UseHint` 已经产出过高位了，等于**对 w1 取了两次高位**。

看了[日志](https://gist.github.com/FiloSottile/d019f68db7143493c6a7e9c5fd08e872)我发现：它把实现载入上下文后**几乎立刻就定位了问题，没有任何探索性的工具调用**！之后它给自己写了个小巧的测试、把一半验证逻辑重实现了一遍来确认假设，写了个平庸的修复，然后跑测试确认通过。

**我把它的修复扔掉了**，转而重构 `w1Encode` 让它接受高位作为输入，并改了高位的类型——这样更清晰还省掉一次 Montgomery 表示的往返。尽管如此，这 100% 为我省下了一大笔调试时间。

### 第二个合成实验

周一我还完成了签名的实现、测试失败。有两个 Bug，我在接下来几个晚上修掉了。

第一个出在[几个硬编码常量（Montgomery 域里的 1 和 -1）算错了](https://go-review.googlesource.com/c/go/+/716240/1..2)。非常难找，需要大量深层 printf 和猜测，我自己大概花了一两个小时。

第二个简单些：[一个最终编进签名的值长度太短（32 位而不是 32 字节）](https://go-review.googlesource.com/c/go/+/716240/2..3)。相对容易判断，因为签名只有前四个字节一致、长度也变了。

我觉得这两个 Bug 是检验 Claude 能否帮我在底层密码学代码里找 Bug 的好样本，于是 checkout 回带 Bug 的旧版本（Jujutsu 真好用！），开了一个全新的 Claude Code 会话，提示词如下：

> I am implementing ML-DSA in the Go standard library, and I just finished implementing signing, but running the tests against a known good test vector it looks like it goes into an infinite loop, probably because it always rejects in the Fiat-Shamir with Aborts loop.
>
> You can run the tests with "bin/go test crypto/internal/fips140/mldsa"
>
> You can find the code in src/crypto/internal/fips140/mldsa
>
> Figure out why it loops forever, and get the tests to pass. ultrathink

它花了[一些时间做 printf 调试、追错误值，方式与我的做法几乎一样，然后定位并修掉了那个错误的常量](https://gist.github.com/FiloSottile/d16c37b2fada56875a894cdd2670a860)。用时肯定比我短。令人印象深刻。

修完那个 Bug 后它就放弃了，尽管测试仍然失败。于是我又开了一个全新会话——假定"错误常量"那部分上下文对排查这个独立 Bug 弊大于利——给了它这个提示词：

> I am implementing ML-DSA in the Go standard library, and I just finished implementing signing, but running the tests against a known good test vector they don't match.
>
> You can run the tests with "bin/go test crypto/internal/fips140/mldsa"
>
> You can find the code in src/crypto/internal/fips140/mldsa
>
> Figure out what is going on. ultrathink

它[走了几段弯路、思考了相当久，然后把这个 Bug 也找了出来](https://gist.github.com/FiloSottile/b184888663c5d57078dc90b1a019981b)。说实话我一开始预计它会失败。

有意思的是 Claude 反而觉得"更简单"的那个 Bug 更难。我猜是失败测试输出的大量随机感数据干扰了它的注意力。

它提出的修复只更新了分配的长度而没更新容量，不过无所谓——**重点是找到 Bug**，反正我通常都会把它的修复扔掉、自己重写。

三战三捷的一次性调试命中，零人工辅助，这**极其**令人印象深刻。更重要的是：当智能体的任务只是"告诉我 Bug 在哪"、为我省下一两个小时让我自己推理和修复时，**你根本不需要信任 LLM、也不需要审查它的输出**。

一如既往，我希望我们有不像聊天、不像补全、也不像"给我开个 PR"的 LLM 工具形态。比如：每次测试失败时自动唤起一个 LLM 智能体去查原因、只有在我们自己修好之前查出来了才通知我们——那该多好？

## 延伸一：官方的调试工作流（译自 Common workflows）

*以下译自 Claude Code 官方文档 [Common workflows](https://code.claude.com/docs/en/common-workflows) 的 "Fix bugs efficiently" 一节——Filippo 的直觉在官方文档里的标准形态：*

1. **把错误分享给 Claude**："I'm seeing an error when I run npm test"
2. **要修复建议**："suggest a few ways to fix the @ts-ignore in user.ts"
3. **应用修复**："update user.ts to add the null check you suggested"

官方的提示要点：告诉 Claude 复现问题的命令以拿到堆栈跟踪；说明复现步骤；说明错误是偶发还是稳定。

## 延伸二：把 Filippo 的经验提炼成工作流（本站编者小结）

从主篇与官方文档中可以沉淀出五条"AI 调试"纪律：

1. **边界清晰 + 失败测试 = 好的 AI 任务**。Filippo 事后复盘：这"显然"是个好任务。定义清楚"什么算修好了"（测试转绿），其余交给智能体——这正是《Claude Code 工作流与最佳实践》"给 Claude 一种验证自身工作的手段"在调试场景的应用。
2. **给复现命令，给已知事实，不给结论**。三个提示词的共同结构：问题描述 + 测试命令 + 代码位置 + 一个观察（"w1 与签名时不同"）。没有一句"你试试改 X"。
3. **独立 Bug 用干净会话**。Filippo 明确说"错误常量的上下文对排查独立 Bug 弊大于利"——上下文污染是真实的（见《AI 代码的安全与质量陷阱：六大陷阱与检测清单》"上下文污染"一节），`/clear` 不是失败而是策略。
4. **定位与修复分离**。最反直觉也最重要的一条：让智能体找根因（它快、它便宜、错了也只是浪费时间），修复自己做或认真审查（它慢、它贵、错了就是事故）。Simon Willison 转述此事时把这条称为"扔掉修复、自己写"。
5. **找根因，不做表面缝合**。官方 Debug 类工具（如《Cursor 深入：Tab 补全、Agent 模式与调试/评审工作流》 Cursor 的 Debug Mode）与 Filippo 的案例共享同一步骤：假设 → 证据 → 根因 → 定向修复。如果 AI 的修复看起来"碰巧好了"，几乎可以肯定根因还在。

## 延伸三：可直接复制的调试提示词与验收清单（本站编者整理）

> 以下模板把上面五条纪律固化成填空件，命令与格式按 2026-09 的 Claude Code 可用能力写。

**模板 A：定位根因（只要求诊断，不要求动手）**

```text
现象：<可观察的失败，例如"跑 X 时 Verify 总是拒绝合法签名">
复现命令：<原样可执行的命令，例如 bin/go test ./internal/foo -run TestVector>
代码位置：<目录或文件路径>
已知事实：<你已经排除或确认的 1-3 条，例如"测试向量来自官方实现，签名本身正确">
请只做三件事：
1) 运行复现命令并贴出真实输出；
2) 给出按可能性排序的根因假设，每条标注支持它的证据（文件:行号）；
3) 说明你建议的最小验证方式（一条命令或一个临时测试）。
禁止：修改任何文件、修改测试、引入新依赖。
```

**模板 B：确认根因后再修**

```text
根因：<来自模板 A 的那一条>
请实现修复，要求：
- 只改与根因直接相关的代码；不要顺手重构、不要加未要求的功能
- 新增一条能在修复前失败、修复后通过的回归测试（红→绿），并贴出两次运行输出
- 说明这次改动会影响哪些调用方，以及你如何验证它们
```

**模板 C：偶发/难复现问题**

```text
这个失败大约每 N 次出现 1 次。请：
1) 先提出 3 个能把偶发变成必然的实验（固定随机种子、放大并发、注入延迟、串行化）；
2) 逐个执行并报告结果，不要因为某次没复现就下结论说"无法复现"；
3) 如果确认与并发/时序相关，指出共享状态在哪里、由谁负责写。
```

**验收清单（调试任务收尾前逐项打勾）**

- [ ] 复现命令与失败输出被完整保留在会话或 issue 里（不是"我本地能复现"）。
- [ ] 有一条**先红后绿**的回归测试，两次输出都贴出来了。
- [ ] 根因是"为什么错"，不是"哪里错"——能一句话说清机制。
- [ ] diff 里没有任何未被要求的改动（新依赖、重命名、格式化噪音、多余的兜底逻辑）。
- [ ] 修复由人**读过并能解释**；解释不了的部分要么删掉，要么追问到能解释。
- [ ] 同类问题的排查经验已沉淀（写进项目规范文件或调试手册，避免下次重复付费）。

---

> 相关阅读：修复完成后如需改变代码结构，见《重构 with AI：从日常重构到百万行迁移的上下文策略》；想让"改一步验一步"成为默认，见《TDD with AI：Kent Beck 的增强编程实践》。

> **来源**：本文主篇翻译自 [Claude Code Can Debug Low-level Cryptography](https://words.filippo.io/claude-debugging/)（2025-11-01），作者 Filippo Valsorda（Go 密码学栈前负责人、Geomys 联合创始人），许可署名翻译（原文页未附开源许可，按作者公开博客教学署名翻译处理）；延伸一译自 [Common workflows](https://code.claude.com/docs/en/common-workflows) 的 "Fix bugs efficiently" 一节（Claude Code 官方文档，Copyright Anthropic PBC）；延伸二、延伸三与文末相关阅读为本站编者内容并已标明。原文中的赞助商致谢与图片未搬运。抓取于 2026-09-13。
