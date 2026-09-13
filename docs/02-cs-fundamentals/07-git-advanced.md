---
title: Git 进阶：rebase、cherry-pick 与冲突解决
source_url: https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection
author: Scott Chacon、Ben Straub（Pro Git 2nd Edition：7.1 Revision Selection、3.6 Rebasing、7.8 Advanced Merging、5.1 Distributed Workflows、5.3 Maintaining a Project 章节）
license: CC BY-NC-SA 3.0
fetched_at: 2026-09-13
translated: true
order: 7
---

到这里，你已经学会了管理或维护一个 Git 仓库所需的大部分日常命令与工作流：跟踪与提交文件、使用暂存区、轻量级主题分支与合并。接下来要探索的是 Git 一批非常强大的能力——你未必天天用，但某些时刻一定会需要。

## 修订选择（Revision Selection）

Git 允许你以多种方式指代单个提交、一组提交或一段提交区间。这些方式未必直观，但值得了解。

### 单个修订

你显然可以用完整的 40 字符 SHA-1 哈希指代任意一个提交，但也有对人类更友好的写法。

### 短 SHA-1

Git 足够聪明：只要你给出 SHA-1 哈希的前几个字符（至少 4 个字符且无歧义——即对象数据库中没有其他对象的哈希以同一前缀开头），它就能推断出你指的是哪个提交。

比如想检查你添加某个功能的那次提交，先跑 `git log` 找到它：

```bash
$ git log
commit 734713bc047d87bf7eac9674765ae793478c50d3
Author: Scott Chacon <schacon@gmail.com>
Date:   Fri Jan 2 18:32:33 2009 -0800

    Fix refs handling, add gc auto, update tests

commit d921970aadf03b3cf0e71becdaab3147ba71cdef
Merge: 1c002dd... 35cfb2b...
Author: Scott Chacon <schacon@gmail.com>
Date:   Thu Dec 11 15:08:43 2008 -0800

    Merge commit 'phedders/rdocs'

commit 1c002dd4b536e7479fe34593e72e6c6c1819e53b
Author: Scott Chacon <schacon@gmail.com>
Date:   Thu Dec 11 14:58:32 2008 -0800

    Add some blame and merge stuff
```

假设你关心哈希以 `1c002dd…` 开头的提交。只要较短版本无歧义，下面任意一种 `git show` 写法都可以：

```bash
$ git show 1c002dd4b536e7479fe34593e72e6c6c1819e53b
$ git show 1c002dd4b536e7479f
$ git show 1c002d
```

Git 还能为你的 SHA-1 自动算出简短唯一的缩写。给 `git log` 传 `--abbrev-commit`，输出就会使用保持唯一性的短值；默认 7 个字符，必要时自动加长以消除歧义：

```bash
$ git log --abbrev-commit --pretty=oneline
ca82a6d Change the version number
085bb3b Remove unnecessary test code
a11bef0 Initial commit
```

一般来说，8 到 10 个字符在项目内就足以唯一。例如 2019 年 2 月，Linux 内核（一个相当大的项目）有超过 87.5 万次提交、对象数据库里近 700 万个对象，前 12 个字符相同的对象一个都没有。

> **注：关于 SHA-1 的一段短话**
> 很多人会在某个时刻担心：仓库里会不会随机出现两个哈希到同一 SHA-1 值的不同对象？那怎么办？
> 如果你真提交了一个与库中已有对象哈希相同的对象，Git 会看到数据库里已有它，认为早就写过，直接复用；之后再检出该对象时，你拿到的永远是第一个对象的数据。
> 但你应当意识到这有多不可能：SHA-1 摘要长 20 字节（160 位），要让一次碰撞的概率达到 50%，需要约 2^80 个随机哈希的对象（碰撞概率公式 p = (n(n-1)/2) * (1/2^160)）。2^80 是 1.2×10^24——一百万亿亿，相当于地球全部沙粒数量的 1200 倍。
> 举个例子感受一下：让全球 65 亿人都来编程，每一秒每个人都产出相当于整个 Linux 内核历史（650 万个 Git 对象）的代码并推进同一个巨大仓库，也要大约 2 年，这个仓库才有 50% 的概率出现一次 SHA-1 对象碰撞。因此，自然发生的 SHA-1 碰撞，比你全组程序员在同一晚被狼群在互不相关的事故中袭击致死还不可能。
> 不过，花几千美元的算力确实可以人工合成两个同哈希的文件（2017 年 2 月的 https://shattered.io/ 已证明）。Git 正在转向以 SHA256 作为默认哈希算法——它对碰撞攻击的抵抗力强得多，并且已有代码帮助缓解此类攻击（虽然不能完全消除）。

### 分支引用

指代某个提交最直接的方式之一：它就是某分支末端的提交。这种情况下直接用分支名即可，任何需要提交引用的 Git 命令都接受。例如要查看某分支上的最后一个提交对象，假设 `topic1` 分支指向 `ca82a6d…`，下面两条命令等价：

```bash
$ git show ca82a6dff817ec66f44342007202690a93763949
$ git show topic1
```

想知道某个分支到底指向哪个 SHA-1，或者想看这些示例最终归结为哪个 SHA-1，可以用 Git 的底层（plumbing）工具 `rev-parse`。它为更底层的操作而生，并不面向日常使用，但有时想看清"背后到底发生了什么"时很有用：

```bash
$ git rev-parse topic1
ca82a6dff817ec66f44342007202690a93763949
```

### reflog 短名

你埋头干活时，Git 在后台做的一件事就是维护一份"reflog"——你的 HEAD 与分支引用最近几个月的移动日志。用 `git reflog` 查看：

```bash
$ git reflog
734713b HEAD@{0}: commit: Fix refs handling, add gc auto, update tests
d921970 HEAD@{1}: merge phedders/rdocs: Merge made by the 'recursive' strategy.
1c002dd HEAD@{2}: commit: Add some blame and merge stuff
1c36188 HEAD@{3}: rebase -i (squash): updating HEAD
95df984 HEAD@{4}: commit: # This is a combination of two commits.
1c36188 HEAD@{5}: rebase -i (squash): updating HEAD
7e05da5 HEAD@{6}: rebase -i (pick): updating HEAD
```

无论什么原因导致分支末端更新，Git 都会把这条信息存进这份临时历史。你也可以用 reflog 数据来指代更早的提交。比如想看仓库 HEAD 的第五个之前的值，用 reflog 输出里看到的 `@{5}` 引用：

```bash
$ git show HEAD@{5}
```

这个语法还能看某分支在指定时间前的位置。例如查看 master 分支昨天的位置：

```bash
$ git show master@{yesterday}
```

这会显示 master 末端昨天的位置。该技巧只对 reflog 里还有的数据有效，所以查不了几个月之前的提交。

想让 reflog 信息以 `git log` 的格式显示，可以跑 `git log -g`：

```bash
$ git log -g master
commit 734713bc047d87bf7eac9674765ae793478c50d3
Reflog: master@{0} (Scott Chacon <schacon@gmail.com>)
Reflog message: commit: Fix refs handling, add gc auto, update tests
Author: Scott Chacon <schacon@gmail.com>
Date:   Fri Jan 2 18:32:33 2009 -0800

    Fix refs handling, add gc auto, update tests

commit d921970aadf03b3cf0e71becdaab3147ba71cdef
Reflog: master@{1} (Scott Chacon <schacon@gmail.com>)
Reflog message: merge phedders/rdocs: Merge made by recursive.
Author: Scott Chacon <schacon@gmail.com>
Date:   Thu Dec 11 15:08:43 2008 -0800

    Merge commit 'phedders/rdocs'
```

重要：reflog 信息是**严格本地**的——它只是"你在自己仓库里做过什么"的日志。别人的仓库副本上这些引用不会一样；而且刚克隆完一个仓库时你的 reflog 是空的，因为你的仓库还没有任何活动。跑 `git show HEAD@{2.months.ago}` 只有在你至少两个月前就克隆了这个项目时才能看到对应提交——克隆得更晚的话，只能看到你的首个本地提交。

> **提示：把 reflog 当作 Git 版的 shell 历史**
> 如果你有 UNIX/Linux 背景，可以把 reflog 理解为 Git 版的 shell 历史——里面的东西显然只与你和你的"会话"有关，与可能在同一台机器上干活的任何其他人无关。

### 祖先引用

指明一个提交的另一大类方式是沿它的祖先回溯。在引用末尾放一个 `^`（脱字符），Git 会把它解析为该提交的父提交。先看项目历史：

```bash
$ git log --pretty=format:'%h %s' --graph
* 734713b Fix refs handling, add gc auto, update tests
*   d921970 Merge commit 'phedders/rdocs'
|\
| * 35cfb2b Some rdoc changes
* | 1c002dd Add some blame and merge stuff
|/
* 1c36188 Ignore *.gem
* 9b29157 Add open3_detach to gemspec file list
```

用 `HEAD^` 就能看到上一个提交，意思是"HEAD 的父提交"：

```bash
$ git show HEAD^
commit d921970aadf03b3cf0e71becdaab3147ba71cdef
Merge: 1c002dd... 35cfb2b...
Author: Scott Chacon <schacon@gmail.com>
Date:   Thu Dec 11 15:08:43 2008 -0800

    Merge commit 'phedders/rdocs'
```

还可以在 `^` 后面跟一个数字指明要第几个父提交。例如 `d921970^2` 意为"d921970 的第二个父提交"。这个语法只对有多个父提交的合并提交有意义：合并提交的第一个父提交来自你合并时所在的分支（通常是 master），第二个父提交来自被合并进来的分支（比如 topic）：

```bash
$ git show d921970^
commit 1c002dd4b536e7479fe34593e72e6c6c1819e53b
Author: Scott Chacon <schacon@gmail.com>
Date:   Thu Dec 11 14:58:32 2008 -0800

    Add some blame and merge stuff

$ git show d921970^2
commit 35cfb2b795a55793d7cc56a6cc2060b4bb732548
Author: Paul Hedderly <paul+git@mjr.org>
Date:   Wed Dec 10 22:22:03 2008 +0000

    Some rdoc changes
```

另一类主要的祖先引用是 `~`（波浪号）。它也指第一个父提交，所以 `HEAD~` 与 `HEAD^` 等价；区别在带上数字时才显现：`HEAD~2` 意为"第一个父提交的第一个父提交"，即"祖父"——它沿第一父链回溯指定的次数。例如在上面列出的历史里，`HEAD~3` 是：

```bash
$ git show HEAD~3
commit 1c3618887afb5fbcbea25b7c013f4e2114448b8d
Author: Tom Preston-Werner <tom@mojombo.com>
Date:   Fri Nov 7 13:47:59 2008 -0500

    Ignore *.gem
```

也可以写成 `HEAD~~~`，同样是第一父链连走三步：

```bash
$ git show HEAD~~~
commit 1c3618887afb5fbcbea25b7c013f4e2114448b8d
Author: Tom Preston-Werner <tom@mojombo.com>
Date:   Fri Nov 7 13:47:59 2008 -0500

    Ignore *.gem
```

这些语法还能组合——比如 `HEAD~3^2` 表示"沿第一父链回溯三步之后的提交的第二个父提交"（前提它是个合并提交），以此类推。

### 提交区间

会指代单个提交了，再来看如何指代提交区间。这对管理分支尤其有用——分支很多时，区间语法可以回答"这个分支上有哪些工作还没合并进主分支？"

#### 双点

最常见的区间写法是双点（double-dot）语法。它让 Git 解析出"从一个提交可达、但从另一个提交不可达"的那段提交。假设你有这样一条提交历史（experiment 分支从 master 分叉出 C2，此后 master 走到 E、F，experiment 走到 C、D）：

想看 experiment 分支里还没合并进 master 的内容，用 `master..experiment`——意为"从 experiment 可达但从 master 不可达的所有提交"。为简洁，用图中提交对象字母代替实际日志输出：

```bash
$ git log master..experiment
D
C
```

反过来，想看 master 中不在 experiment 里的所有提交，交换分支名即可。`experiment..master` 显示 master 上从 experiment 不可达的全部内容：

```bash
$ git log experiment..master
F
E
```

想让 experiment 保持最新、预览即将合并的内容时，这很有用。这个语法另一个高频用途是查看你即将推送到远端的内容：

```bash
$ git log origin/master..HEAD
```

它显示当前分支上不在 origin 远端 master 分支里的所有提交。如果你执行 `git push` 且当前分支跟踪 origin/master，`git log origin/master..HEAD` 列出的提交就是即将传到服务器的提交。双点语法还可以省掉一侧，让 Git 默认按 HEAD 处理：例如 `git log origin/master..` 与上一例等价——缺省的一侧由 Git 补上 HEAD。

#### 多点

双点是好用简写，但有时你想指定不止两个分支，比如"看看这几个分支里有哪些提交是我当前分支没有的"。Git 允许在任何"不想看到其可达提交"的引用前用 `^` 或 `--not`。因此下面三条命令等价：

```bash
$ git log refA..refB
$ git log ^refA refB
$ git log refB --not refA
```

好处是这种语法可以在一次查询里指定超过两个引用——双点做不到。例如想看所有从 refA 或 refB 可达、但从 refC 不可达的提交：

```bash
$ git log refA refB ^refC
$ git log refA refB --not refC
```

这构成了一个非常强大的修订查询系统，帮你弄清各分支里都有什么。

#### 三点

最后一种主要区间语法是三点（triple-dot），指"从两个引用中任意一个可达、但不同时从两者可达"的所有提交。还用刚才那幅历史图：想看 master 或 experiment 独有的内容（不含共同部分），运行：

```bash
$ git log master...experiment
F
E
D
C
```

输出仍是普通日志，只是只显示这四个提交，按传统的提交日期排序。

此时配合 `log` 的常用开关是 `--left-right`，它显示每个提交位于区间的哪一侧，让输出更有用：

```bash
$ git log --left-right master...experiment
< F
< E
> D
> C
```

有了这些工具，你就能轻松告诉 Git 你想检查哪个（些）提交。

## 变基（Rebasing）

在 Git 里，把一个分支的变更整合进另一分支主要有两种方式：merge 和 rebase。本节讲什么是变基、怎么做、为什么它是个相当棒的工具，以及哪些场合不该用它。

### 基本变基

回顾"基础合并"一节：你让工作分叉，在两个不同分支上各自提交。整合分支最简单的方式（前面已讲过）是 merge——它对两个分支的最新快照（C3 与 C4）及二者的最近公共祖先（C2）做一次三方合并，生成一个新快照（和提交）。

但还有另一条路：取出 C4 引入的补丁，把它重新应用到 C3 之上。在 Git 里这叫变基（rebasing）。用 `rebase` 命令，你可以把在一个分支上提交的所有改动，在另一条分支上重放一遍。

本例中：切到 experiment 分支，再把它变基到 master 上：

```bash
$ git checkout experiment
$ git rebase master
First, rewinding head to replay your work on top of it...
Applying: added staged command
```

这条操作的原理：先找到两个分支（你所在的分支与变基目标分支）的公共祖先，取出你所在分支每个提交引入的差异，把这些 diff 存进临时文件，把当前分支重置到与目标分支相同的提交，最后依次应用每个改动。

此时回到 master 分支做一次快进（fast-forward）合并即可：

```bash
$ git checkout master
$ git merge experiment
```

现在 C4' 指向的快照与合并示例中 C5 指向的快照完全相同。两种整合方式的最终产物没有差别，但变基换来更干净的历史：查看变基后分支的日志，它呈一条线性历史——看起来所有工作都是串行发生的，哪怕实际上是并行发生的。

你这样做常常是为了保证自己的提交能干净地应用到远端分支上——比如你要给一个不归你维护的项目贡献代码。这时你在自己的分支上干活，准备好把补丁交给主项目时，先把工作变基到 origin/master 上。这样维护者无需做任何整合工作——一次快进或一次干净的应用就完事。

注意：无论走变基（最终落在变基后提交链的末端）还是合并（最终落在合并提交上），你最后得到的快照都是同一个快照——不同的只是历史。变基是按引入顺序把一条工作线上的改动重放到另一条上；合并则是取两条线的终点合并到一起。

### 更有趣的变基场景

变基还可以重放到目标分支以外的东西上。设想这样的历史：你从 master 开出主题分支 server 加服务端功能并提交；又从 server 开出 client 做客户端改动并提交几次；最后回到 server 又提交了几次。

假设你决定把客户端的改动并入主线发布，但服务端改动要再测试一阵才并入。你可以取出 client 上 server 没有的提交（C8 与 C9），用 `git rebase` 的 `--onto` 选项把它们在 master 上重放：

```bash
$ git rebase --onto master server client
```

这等于说："取出 client 分支，找出它自 server 分叉后的补丁，把这些补丁在 client 分支上重放，让它看起来像直接基于 master。"稍显复杂，但结果很妙。

然后就能快进 master：

```bash
$ git checkout master
$ git merge client
```

再假设你决定把 server 分支也收进来。用 `git rebase <basebranch> <topicbranch>` 可以不先检出就变基——它会替你检出主题分支（这里是 server）并把它重放到基分支（master）上：

```bash
$ git rebase master server
```

这把 server 的工作重放到 master 之上。接着快进基分支：

```bash
$ git checkout master
$ git merge server
```

所有工作都整合完了，client 和 server 分支可以删掉。整个过程结束后历史干净利落：

```bash
$ git branch -d client
$ git branch -d server
```

### 变基的风险

啊，变基虽爽，也并非没有代价。全部代价可以浓缩成一句话：

**不要变基那些已经存在于你的仓库之外、别人可能已在其上开展工作的提交。**

遵守这条准则就万事大吉；不遵守，别人会恨你，亲友会唾弃你。

变基时，你抛弃既有提交、创造一批相似但不同的新提交。如果你把提交推到了某处，别人拉下来并在其上开展工作时，你又用 `git rebase` 重写这些提交再推上去，协作者就得重新合并他们的工作，等你再拉他们的工作回来时一团乱麻。

看一个"变基公开的工作会惹什么麻烦"的例子。假设你从中央服务器克隆，然后干活，历史如下（C1、C2）。这时另一个人干了更多活，包含一次合并，推到了中央服务器。你 fetch 下来并把新的远端分支合并进自己的工作（C3、C4、M 合并提交）。

接下来，推送合并工作的人反悔了，决定回头改成变基：他们 `git push --force` 强推覆盖服务器上的历史。你再从服务器 fetch，拉到了新提交。

现在你们俩都进了泥潭。如果你跑 `git pull`，会生成一个同时包含两条历史线的合并提交。此时 `git log` 会看到两个作者、日期、消息完全相同的提交——令人困惑。更糟的是，如果你把这份历史推回服务器，会把所有那些被变基的提交重新带回中央服务器，进一步把人绕晕。基本可以断定对方并不想要 C4 和 C6 出现在历史里——不然他当初何必变基。

### 被人变基之后：你也变基（Rebase When You Rebase）

真遇上这种局面，Git 还有些魔法可能救你。如果队友强推、覆盖了你据以工作的提交，你的难题是分清哪些提交是你的、哪些被他们重写了。

事实是：除了提交的 SHA-1 校验和之外，Git 还基于该提交引入的补丁本身计算一个校验和，称为"patch-id"。

如果你拉下了被重写的工作，并把它变基到队友的新提交之上，Git 通常能成功分辨出哪些提交是你独有的，并把它们重新应用到新分支顶端。

比如在上面那个场景里，如果在"对方强推变基之后"你不做合并，而是跑 `git rebase teamone/master`，Git 会：

- 找出我们分支上独有的工作（C2、C3、C4、C6、C7）；
- 排除其中的合并提交（剩 C2、C3、C4）；
- 排除已被重写进目标分支的（只剩 C2 和 C3，因为 C4 与 C4' 是同一个补丁）；
- 把剩下的提交应用到 teamone/master 顶端。

于是你不会得到"同一份工作合并两次"的混乱历史，而是干净得多的一条线。

这招只有在对方造出的 C4 与 C4' 几乎是完全相同的补丁时才有效；否则变基认不出重复，会再添一个 C4 类的补丁（大概率还应用不干净，因为改动多少已经在那里了）。

你也可以用 `git pull --rebase` 代替普通的 `git pull` 来简化这一切。或者手动来做：`git fetch` 然后 `git rebase teamone/master`。如果你想让 `--rebase` 成为 `git pull` 的默认行为，可以设置 pull.rebase 配置：`git config --global pull.rebase true`。

只变基从未离开过你自己电脑的提交，永远安全。变基已推送但没人基于它开展工作的提交，也安全。变基已公开推送、且别人可能已在其上开展工作的提交，那你就等着摊上烦人的麻烦、遭受队友的白眼吧。

如果你或队友确实不得已要这么做，务必让所有人知道跑 `git pull --rebase`，好让事发之后的善后简单一点。

### 变基 vs. 合并

见过变基与合并各自实战后，你也许在想：到底哪个更好？回答之前，先退一步聊聊"历史意味着什么"。

一种观点认为：仓库的提交历史是**实际发生了什么的记录**。它是一份历史文献，本身就有价值，不该被篡改。从这个角度看，修改提交历史近乎渎职——你在歪曲事实。那又怎样，合并提交就是乱七八糟的一串？事情就是那么发生的，仓库应当为后世保存原貌。

对立观点认为：提交历史是**项目如何被做出来的故事**。你不会出版一本书的第一稿，为什么要展示你凌乱的过程？做项目时，你或许需要记录所有失误与死胡同；但到了向世界展示成果的时候，你可能想讲一个更连贯的故事——如何从 A 走到 B。这一派的人用 rebase、filter-branch 之类的工具，在合并进主线之前重写提交，把故事讲得对未来的读者最友好。

那么变基与合并孰优孰劣？希望你已看出，这没那么简单。Git 是强大的工具，允许你对历史做很多事，但每个团队、每个项目都不同。既然你已经弄懂了两者，哪种最适合你眼下的处境，由你决定。

可以两头的好处都拿到：**推送之前**变基本地改动、清理工作；**推出去之后**的东西，永远不再变基。

## 高级合并（Advanced Merging）

Git 里合并通常相当轻松。由于 Git 让你轻松地多次合并另一分支，你完全可以养一条长寿分支，边走边同步、频繁解决小冲突，而不是在一系列工作结束时被一个巨大的冲突打个措手不及。

不过，棘手的冲突确实时有发生。不像某些其他版本控制系统，Git 不会在合并冲突解决上自作聪明。Git 的哲学是：聪明地判断合并结果何时无歧义；一旦有冲突，就不试图自动"机智"地替你解决。因此，如果两个快速分叉的分支拖太久才合并，你可能碰上麻烦。

本节过一遍这些问题，以及 Git 提供了哪些工具帮你处理棘手局面；还会介绍几种非标准的合并方式，以及如何从做过的合并中全身而退。

### 合并冲突

"基础合并冲突"一节讲过基本解法；面对更复杂的冲突，Git 提供了几个工具，帮你弄清发生了什么、更好地处理冲突。

首先，只要可能，做一次可能有冲突的合并之前，确保工作目录是干净的。手头有未完成的工作，要么提交到一个临时分支，要么 stash 起来。这样你才能撤销这里的任何尝试。如果合并时工作目录里有未提交的改动，下面某些技巧或许能帮你保住它们。

我们走一个极简例子。仓库里有个超简单的 Ruby 文件，打印 'hello world'：

```ruby
#! /usr/bin/env ruby

def hello
  puts 'hello world'
end

hello()
```

我们在仓库里新建一个名为 whitespace 的分支，把所有 Unix 换行符改成 DOS 换行符——等于改了文件每一行，但只改了空白。然后我们把 "hello world" 那行改成 "hello mundo"：

```bash
$ git checkout -b whitespace
Switched to a new branch 'whitespace'

$ unix2dos hello.rb
unix2dos: converting file hello.rb to DOS format ...
$ git commit -am 'Convert hello.rb to DOS'
[whitespace 3270f76] Convert hello.rb to DOS
 1 file changed, 7 insertions(+), 7 deletions(-)

$ vim hello.rb
$ git diff -b
diff --git a/hello.rb b/hello.rb
index ac51efd..e85207e 100755
--- a/hello.rb
+++ b/hello.rb
@@ -1,7 +1,7 @@
 #! /usr/bin/env ruby

 def hello
-  puts 'hello world'
+  puts 'hello mundo'^M
 end

 hello()

$ git commit -am 'Use Spanish instead of English'
[whitespace 6d338d2] Use Spanish instead of English
 1 file changed, 1 insertion(+), 1 deletion(-)
```

现在切回 master 分支，给函数补一段文档注释：

```bash
$ git checkout master
Switched to branch 'master'

$ vim hello.rb
$ git diff
diff --git a/hello.rb b/hello.rb
index ac51efd..36c06c8 100755
--- a/hello.rb
+++ b/hello.rb
@@ -1,5 +1,6 @@
 #! /usr/bin/env ruby

+# prints out a greeting
 def hello
   puts 'hello world'
 end

$ git commit -am 'Add comment documenting the function'
[master bec6336] Add comment documenting the function
 1 file changed, 1 insertion(+)
```

现在尝试合并 whitespace 分支，空白改动导致冲突：

```bash
$ git merge whitespace
Auto-merging hello.rb
CONFLICT (content): Merge conflict in hello.rb
Automatic merge failed; fix conflicts and then commit the result.
```

#### 中止合并

现在有几个选项。先说怎么脱身。如果你没料到会有冲突、暂不想处理，可以用 `git merge --abort` 直接退出合并：

```bash
$ git status -sb
## master
UU hello.rb

$ git merge --abort

$ git status -sb
## master
```

`git merge --abort` 尽量把一切还原到合并之前的状态。唯一可能还原不完美的情况是合并时工作目录里就有未暂存、未提交的改动；除此之外应当安然无恙。

如果出于某种原因你就是想推倒重来，也可以跑 `git reset --hard HEAD`，仓库回到最后一次提交的状态。记住：任何未提交的工作都会丢失——确认你真不想要那些改动。

#### 忽略空白

这个例子里冲突是空白导致的。案子简单我们当然知道；真实案例里也很容易看出来——一侧的每一行都被删除又在另一侧重新添加。默认情况下，Git 认为这些行全被改过，没法合并文件。

默认合并策略可以接受参数，其中有几个正是用来妥善忽略空白改动的。看到合并里一堆空白问题，可以直接中止重来，这次带上 `-Xignore-all-space` 或 `-Xignore-space-change`：前者比较行时完全忽略空白，后者把一个及以上连续空白字符的序列视为等价：

```bash
$ git merge -Xignore-space-change whitespace
Auto-merging hello.rb
Merge made by the 'recursive' strategy.
 hello.rb | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

这个案例里文件的实际改动并不冲突，所以忽略空白之后一切合并顺利。

如果团队里有人时不时把空格全改制表符（或反之），这个选项就是救命稻草。

#### 手动重新合并单个文件

Git 对空白的预处理已经很好，但另一些改动 Git 无法自动处理，却可以用脚本修。假设 Git 处理不了那个空白改动，需要我们手动来。

我们真正要做的是：在真正合并文件之前，先把要合并的文件过一遍 dos2unix。怎么做？

先进入合并冲突状态。然后取出三个版本的文件副本：我们的版本、对方的版本（来自要合入的分支）、公共版本（双方分叉的地方）。修好其中一侧的空白问题，然后只对这一个文件重试合并。

拿到三个版本相当容易。Git 把这些版本连同编号一起存在索引（index）的"stage"里：stage 1 是公共祖先，stage 2 是你的版本，stage 3 是 MERGE_HEAD——你要合入的那个版本（"对方的"）。用 `git show` 加特殊语法即可提取每个版本：

```bash
$ git show :1:hello.rb > hello.common.rb
$ git show :2:hello.rb > hello.ours.rb
$ git show :3:hello.rb > hello.theirs.rb
```

想更硬核一点，可以用底层命令 `ls-files -u` 拿到各版本对应的 Git blob 的 SHA-1：

```bash
$ git ls-files -u
100755 ac51efdc3df4f4fd328d1a02ad05331d8e2c9111 1	hello.rb
100755 36c06c8752c78d2aff89571132f3bf7841a7b5c3 2	hello.rb
100755 e85207e04dfdd5eb0a1e9febbc67fd837c44a1cd 3	hello.rb
```

`:1:hello.rb` 不过是查那个 blob SHA-1 的简写。

三个 stage 的内容都在工作目录里了，先把对方那份的空白修好，再用鲜为人知的 `git merge-file` 命令重新合并这个文件——它干的就是这个：

```bash
$ dos2unix hello.theirs.rb
dos2unix: converting file hello.theirs.rb to Unix format ...

$ git merge-file -p \
    hello.ours.rb hello.common.rb hello.theirs.rb > hello.rb

$ git diff -b
diff --cc hello.rb
index 36c06c8,e85207e..0000000
--- a/hello.rb
+++ b/hello.rb
@@@ -1,8 -1,7 +1,8 @@@
  #! /usr/bin/env ruby

 +# prints out a greeting
  def hello
-   puts 'hello world'
+   puts 'hello mundo'
  end

  hello()
```

至此文件合并得很漂亮。事实上这比 ignore-space-change 效果更好：它在合并**之前**就把空白修掉了，而不是简单忽略。ignore-space-change 方案最终会有几行残留 DOS 换行符，文件成了混搭。

提交之前，如果你想了解两侧到底各改了什么，可以让 `git diff` 把工作目录里即将提交的合并结果与任意一个 stage 比较。挨个来。

把结果与合并前自己分支上的内容比较（即看这次合并引入了什么），跑 `git diff --ours`：

```bash
$ git diff --ours
* Unmerged path hello.rb
diff --git a/hello.rb b/hello.rb
index 36c06c8..44d0a25 100755
--- a/hello.rb
+++ b/hello.rb
@@ -2,7 +2,7 @@

 # prints out a greeting
 def hello
-  puts 'hello world'
+  puts 'hello mundo'
 end

 hello()
```

一目了然：我们的分支原本的样子，与这次合并实际给文件带来的改动，就是那一行。

想看合并结果与对方一侧的差异，跑 `git diff --theirs`。这个及下面的例子里都要加 `-b` 去掉空白干扰，因为我们比较的是 Git 里的内容，而不是我们清理过的 hello.theirs.rb：

```bash
$ git diff --theirs -b
* Unmerged path hello.rb
diff --git a/hello.rb b/hello.rb
index e85207e..44d0a25 100755
--- a/hello.rb
+++ b/hello.rb
@@ -1,5 +1,6 @@
 #! /usr/bin/env ruby

+# prints out a greeting
 def hello
   puts 'hello mundo'
 end
```

最后，`git diff --base` 显示文件相对两侧基线的全部变化：

```bash
$ git diff --base -b
* Unmerged path hello.rb
diff --git a/hello.rb b/hello.rb
index ac51efd..44d0a25 100755
--- a/hello.rb
+++ b/hello.rb
@@ -1,7 +1,8 @@
 #! /usr/bin/env ruby

+# prints out a greeting
 def hello
-  puts 'hello world'
+  puts 'hello mundo'
 end

 hello()
```

到这里可以用 `git clean` 清掉为手动合并临时创建、不再需要的文件：

```bash
$ git clean -f
Removing hello.common.rb
Removing hello.ours.rb
Removing hello.theirs.rb
```

#### 检出冲突（Checkout Conflicts）

也许你对眼下的解决结果不满意，或者手动编辑两侧后仍不理想、需要更多上下文。

换一个例子。这次有两条长寿分支，各含几个提交，合并时产生了货真价实的内容冲突：

```bash
$ git log --graph --oneline --decorate --all
* f1270f7 (HEAD, master) Update README
* 9af9d3b Create README
* 694971d Update phrase to 'hola world'
| * e3eb223 (mundo) Add more tests
| * 7cff591 Create initial testing script
| * c3ffff1 Change text to 'hello mundo'
|/
* b7dcc89 Initial hello world code
```

master 上有三个独有提交，mundo 上也有三个。尝试合并 mundo，冲突来了：

```bash
$ git merge mundo
Auto-merging hello.rb
CONFLICT (content): Merge conflict in hello.rb
Automatic merge failed; fix conflicts and then commit the result.
```

打开文件，看到大致这样：

```
#! /usr/bin/env ruby

def hello
<<<<<<< HEAD
  puts 'hola world'
=======
  puts 'hello mundo'
>>>>>>> mundo
end

hello()
```

合并的两侧都往这个文件加了内容，但一些提交修改了文件的同一处，于是冲突。

下面探索几个帮你弄清"冲突因何而起"的工具。这个冲突到底该怎么修也许并不显然——你需要更多上下文。

一个顺手的工具是带 `--conflict` 选项的 `git checkout`。它会重新检出文件、替换合并冲突标记。想重置标记、重新解决一遍时很有用。

`--conflict` 可以传 `diff3` 或 `merge`（默认）。传 `diff3` 时，Git 用稍微不同的冲突标记：除了"ours"与"theirs"两个版本，还内联给出"base"版本，提供更多上下文：

```bash
$ git checkout --conflict=diff3 hello.rb
```

跑完之后文件变成：

```
#! /usr/bin/env ruby

def hello
<<<<<<< ours
  puts 'hola world'
||||||| base
  puts 'hello world'
=======
  puts 'hello mundo'
>>>>>>> theirs
end

hello()
```

喜欢这种格式的话，把 merge.conflictstyle 设为 diff3，以后所有合并冲突都用它：

```bash
$ git config --global merge.conflictstyle diff3
```

`git checkout` 还有 `--ours` 与 `--theirs` 选项，可以极快地直接选定一侧、完全不做合并。

这对二进制文件的冲突尤其好用——只能二选一；或者你只想从另一分支合并进来某些文件——可以先做合并，再从某一侧检出特定文件，然后提交。

#### 合并日志（Merge Log）

解决合并冲突时另一个有用的工具是 `git log`。它能帮你获得"是什么导致了冲突"的上下文。回顾一小段历史、想起两条开发线为什么会碰同一片代码，常常极有帮助。

要拿到参与本次合并的两个分支上所有独有提交的完整列表，用"三点"语法：

```bash
$ git log --oneline --left-right HEAD...MERGE_HEAD
< f1270f7 Update README
< 9af9d3b Create README
< 694971d Update phrase to 'hola world'
> e3eb223 Add more tests
> 7cff591 Create initial testing script
> c3ffff1 Change text to 'hello mundo'
```

漂亮的列表：总共六个提交，以及各自属于哪条开发线。

还能进一步缩小范围。给 `git log` 加 `--merge` 选项，它只显示两侧中触及当前冲突文件的提交：

```bash
$ git log --oneline --left-right --merge
< 694971d Update phrase to 'hola world'
> c3ffff1 Change text to 'hello mundo'
```

再配上 `-p` 选项，就只显示那个最终冲突文件的差异。这能飞快地给你理解冲突成因、更聪明地解决它所需的上下文。

#### 组合式差异格式（Combined Diff Format）

Git 会暂存所有合并成功的结果，所以在冲突状态下跑 `git diff`，看到的只是仍在冲突中的部分。这对查看"还有哪些要解决"很有用。

合并冲突后直接跑 `git diff`，会得到一种相当独特的差异输出：

```bash
$ git diff
diff --cc hello.rb
index 0399cd5,59727f0..0000000
--- a/hello.rb
+++ b/hello.rb
@@@ -1,7 -1,7 +1,11 @@@
  #! /usr/bin/env ruby

  def hello
++<<<<<<< HEAD
 +  puts 'hola world'
++=======
+   puts 'hello mundo'
++>>>>>>> mundo
  end

  hello()
```

这个格式叫"组合式差异"（Combined Diff），每行旁边给两列数据：第一列显示该行在"ours"分支与工作目录文件之间是否不同（增或删），第二列对"theirs"分支与工作目录副本做同样的事。

所以例子里能看到 `<<<<<<<` 与 `>>>>>>>` 行存在于工作副本但两侧都没有——合理，合并工具为了上下文塞进来的，等着你删掉。

解决冲突后再跑 `git diff`，还是同样的格式，但信息更有用了：

```bash
$ vim hello.rb
$ git diff
diff --cc hello.rb
index 0399cd5,59727f0..0000000
--- a/hello.rb
+++ b/hello.rb
@@@ -1,7 -1,7 +1,7 @@@
  #! /usr/bin/env ruby

  def hello
-   puts 'hola world'
 -  puts 'hello mundo'
++  puts 'hola mundo'
  end

  hello()
```

这说明："hola world" 在我们这一侧、不在工作副本里；"hello mundo" 在对方那一侧、不在工作副本里；而 "hola mundo" 两侧都没有、现在在工作副本里。提交解决结果之前，用这个做检查很有价值。

事后回看某次合并如何解决，也能拿到这种格式：对合并提交跑 `git show`，或者给 `git log -p`（默认只显示非合并提交的补丁）加 `--cc` 选项：

```bash
$ git log --cc -p -1
commit 14f41939956d80b9e17bb8721354c33f8d5b5a79
Merge: f1270f7 e3eb223
Author: Scott Chacon <schacon@gmail.com>
Date:   Fri Sep 19 18:14:49 2014 +0200

    Merge branch 'mundo'

    Conflicts:
        hello.rb

diff --cc hello.rb
index 0399cd5,59727f0..e1d0799
--- a/hello.rb
+++ b/hello.rb
@@@ -1,7 -1,7 +1,7 @@@
  #! /usr/bin/env ruby

  def hello
-   puts 'hola world'
 -  puts 'hello mundo'
++  puts 'hola mundo'
  end

  hello()
```

### 撤销合并

你已经会创建合并提交了，那迟早会误创建几个。用 Git 的好处之一就是：犯错误没关系，修复是可能的（而且多数情况下很容易）。

合并提交也不例外。假设你在主题分支上开工，手滑把它合并进了 master，历史变成了这样（C6 是误合并提交）。

两种处理办法，取决于你想要的结果。

#### 修引用（Fix the references）

如果这个多余的合并提交只存在于你的本地仓库，最简单最好的方案是挪动分支指针，指向你想要的地方。多数情况下，误合并后紧跟 `git reset --hard HEAD~`，分支指针就会回退：

`reset` 在"Reset Demystified"一节讲过，这里快速复习：`reset --hard` 通常走三步：

1. 移动 HEAD 所指的分支。本例中，把 master 挪回合并提交（C6）之前的位置。
2. 让索引与 HEAD 一致。
3. 让工作目录与索引一致。

这招的缺点是它在**重写历史**，共享仓库上可能出问题——细节见"变基的风险"；简短版：如果别人已经有你正在重写的提交，就该避免 reset。另外，合并之后如果又产生了其他提交，这招就失效了——挪引用会把那些改动一并弄丢。

#### 还原提交（Reverse the commit）

如果挪分支指针行不通，Git 允许你做一个新提交，把既有提交的所有改动撤销掉。Git 称之为"revert"（还原）。此场景这样调用：

```bash
$ git revert -m 1 HEAD
[master b1d8379] Revert "Merge branch 'topic'"
```

`-m 1` 标志指明哪个父提交是"主线"、应当保留。向 HEAD 执行合并（`git merge topic`）时，新提交有两个父提交：第一个是 HEAD（C6），第二个是被合并分支的末端（C4）。这里我们想撤销"合入第 2 个父提交（C4）"引入的所有改动，保留第 1 个父提交（C6）的全部内容。

还原提交（记作 ^M）的内容与 C6 完全相同，所以从这里开始就像合并从未发生过——只是那些本已合并的提交仍在 HEAD 的历史里。这时再想把 topic 合并进 master，Git 会糊涂：

```bash
$ git merge topic
Already up-to-date.
```

topic 里没有任何 master 不可达的东西了。更糟的是，如果你往 topic 添加工作再合并，Git 只会带入自那次被还原的合并以来的改动（C3、C4 的工作就这么丢了）。

最好的解法是先**还原那个还原**（因为你现在要把当初撤掉的变化请回来），然后再做一次新的合并提交：

```bash
$ git revert ^M
[master 09f0126] Revert "Revert "Merge branch 'topic'""
$ git merge topic
```

本例中 M 与 ^M 相互抵消；^^M 实际合并进了 C3 与 C4 的改动，C8 合并进了 C7 的改动——现在 topic 才算真正合并完成。

### 其他类型的合并

到目前为止讲的都是两个分支的常规合并，由所谓的"recursive"合并策略处理。合并分支还有别的方式，快速过几个。

#### 偏向一方（Our 或 Theirs）

首先，常规 "recursive" 合并模式还有个有用的玩法。前面见过带 `-X` 传递的 ignore-all-space 与 ignore-space-change；还可以告诉 Git：遇到冲突时偏向某一侧。

默认情况下，Git 在两个分支的合并中看到冲突，会往代码里塞冲突标记、把文件标记为冲突，交由你解决。如果你更希望 Git 直接选边、无视另一侧而不是让你手动解决，给 merge 命令传 `-Xours` 或 `-Xtheirs`。

Git 见到该参数就不会加冲突标记：可合并的差异照常合并；冲突的差异整体选你指定的那一侧——包括二进制文件。

回到之前的 "hello world" 例子：直接合并会冲突：

```bash
$ git merge mundo
Auto-merging hello.rb
CONFLICT (content): Merge conflict in hello.rb
Resolved 'hello.rb' using previous resolution.
Automatic merge failed; fix conflicts and then commit the result.
```

带 `-Xours` 或 `-Xtheirs` 则不会：

```bash
$ git merge -Xours mundo
Auto-merging hello.rb
Merge made by the 'recursive' strategy.
 hello.rb | 2 +-
 test.sh  | 2 ++
 2 files changed, 3 insertions(+), 1 deletion(-)
 create mode 100644 test.sh
```

这种情况下，文件里不会出现"hello mundo"与"hola world"各占一侧的冲突标记，而是直接选 "hola world"；该分支上所有其他不冲突的改动都正常合入。

前面见过的 `git merge-file` 命令也能传这个选项——单个文件的合并用 `git merge-file --ours` 之类。

如果想要类似效果、但连尝试合并对方改动都不想要，有个更霸道的选项："ours" 合并**策略**。注意它与 "ours" 递归合并**选项**不同。

它基本是个假合并：记录一个新的合并提交、把两个分支都记为父提交，但甚至不看你要合入的那个分支——合并结果就是当前分支的代码原样：

```bash
$ git merge -s ours mundo
Merge made by the 'ours' strategy.
$ git diff HEAD HEAD~
$
```

可见当前分支与合并结果之间毫无差异。

这常用来"骗" Git 认为某分支已经合并过，从而影响以后的合并。比如你开了一条发布分支并做了些工作，日后要并回 master；期间 master 上有个 bugfix 需要反向移植（backport）进发布分支。你可以把 bugfix 分支合并进发布分支，同时用 `-s ours` 把同一分支"合并"进 master（虽然修复已经在那里）——这样以后再合并发布分支时，不会因这个 bugfix 产生冲突。

#### 子树合并（Subtree Merging）

子树合并的思路是：你有两个项目，其中一个映射到另一个的某个子目录。指定子树合并时，Git 往往聪明到能看出一个是另一个的子树并妥善合并。

我们演示把一个独立项目塞进现有项目、再把第二个项目的代码合并进第一个项目的某个子目录。

先把 Rack 应用加进来：把 Rack 项目加为远端引用，再检出成自己的分支：

```bash
$ git remote add rack_remote https://github.com/rack/rack
$ git fetch rack_remote --no-tags
warning: no common commits
remote: Counting objects: 3184, done.
remote: Compressing objects: 100% (1465/1465), done.
remote: Total 3184 (delta 1952), reused 2770 (delta 1675)
Receiving objects: 100% (3184/3184), 677.42 KiB | 4 KiB/s, done.
Resolving deltas: 100% (1952/1952), done.
From https://github.com/rack/rack
 * [new branch]      build      -> rack_remote/build
 * [new branch]      master     -> rack_remote/master
 * [new branch]      rack-0.4   -> rack_remote/rack-0.4
 * [new branch]      rack-0.9   -> rack_remote/rack-0.9
$ git checkout -b rack_branch rack_remote/master
Branch rack_branch set up to track remote branch refs/remotes/rack_remote/master.
Switched to a new branch "rack_branch"
```

现在 rack_branch 的项目根是 Rack 项目，master 的项目根是我们自己的项目。轮流检出看看，会发现两个根完全不同：

```bash
$ ls
AUTHORS         KNOWN-ISSUES   Rakefile      contrib         lib
COPYING         README         bin           example         test
$ git checkout master
Switched to branch "master"
$ ls
README
```

这个概念有点怪：仓库里的分支并不非得是同一个项目的分支。这不多见（因为很少有帮），但让不同分支装着完全不同的历史确实容易做到。

现在把 Rack 项目作为子目录拉进 master。用 `git read-tree` 可以做到——它把一个分支的根树读进当前暂存区与工作目录（read-tree 及其伙伴在"Git Internals"里细讲）。我们已切回 master，把 rack_branch 拉进主项目 master 的 rack 子目录：

```bash
$ git read-tree --prefix=rack/ -u rack_branch
```

提交之后，看起来 rack 子目录下就是全部 Rack 文件——像从 tar 包复制进来的一样。有趣的是，可以相当轻松地在两个分支之间合并改动：Rack 项目更新了，就切到那个分支 pull：

```bash
$ git checkout rack_branch
$ git pull
```

然后把改动合并回 master。用 `--squash` 选项带入改动并预填提交消息，再加递归合并策略的 `-Xsubtree` 选项。递归策略在这里本来就是默认，写出只为清晰：

```bash
$ git checkout master
$ git merge --squash -s recursive -Xsubtree=rack rack_branch
Squash commit -- not updating HEAD
Automatic merge went well; stopped before committing as requested
```

Rack 项目的所有改动都合并进来了，就等本地提交。反方向也行：在 master 的 rack 子目录里改，之后再合并回 rack_branch，交给维护者或推回上游。

这给了一种类似 submodule 的工作流而不用 submodule 的办法：把相关项目的分支留在自己仓库里，偶尔子树合并进项目。某些方面很好，比如所有代码提交在同一个地方；但缺点也有：更复杂一些，重新整合改动时更容易出错，也可能手滑把分支推进不相干的仓库。

还有个略微诡异的地方：想比较 rack 子目录里的内容与 rack_branch 分支的代码（看看要不要合并），不能用普通 diff 命令，要用 `git diff-tree` 加上要比较的分支：

```bash
$ git diff-tree -p rack_branch
```

或者比较 rack 子目录与服务器上 master 上次 fetch 时的内容：

```bash
$ git diff-tree -p rack_remote/master
```

## 分布式工作流（Distributed Workflows）

现在你已经有了一个作为所有开发者共享代码焦点的远端 Git 仓库，也熟悉了本地工作流的基本命令。来看看 Git 的分布式工作流能怎么用。

本章分别以贡献者与整合者的视角，讲如何在分布式环境中使用 Git：既讲如何顺利地为项目贡献代码、让自己和项目维护者都省心，也讲如何在多人贡献的情况下维护好一个项目。

与集中式版本控制系统（CVCS）不同，Git 的分布式本质让开发者协作方式灵活得多。集中式系统里，每个开发者都是一个与中央枢纽大致对等协作的节点；而在 Git 里，每个开发者**既可能是节点、也可能是枢纽**——既能向其他仓库贡献代码，也能维护一个公开仓库，让别人基于它开展工作并向它贡献。这给项目/团队带来了极其多样的工作流可能。下面介绍几种借力于这种灵活性的常见范式，逐一说明各设计的优点与可能的短板；你可以只选一种，也可以混搭各家的特性。

### 集中式工作流

集中式系统通常只有一种协作模型——集中式工作流：一个中央枢纽（仓库）接受代码，所有人与之同步。若干开发者是节点——该枢纽的消费者——与这个集中位置同步。

这意味着：两个开发者都从枢纽克隆并各自改动时，先推送的人没有问题；后推的人必须先合并第一个人的工作再推，以免覆盖对方的改动。这个道理在 Git 里与在 Subversion（或任何 CVCS）里完全一样，这套模型在 Git 里也运转良好。

如果你在公司或团队里已经习惯了集中式工作流，用 Git 也可以轻松延续：建一个仓库，给团队所有人推送权限即可；Git 不允许用户互相覆盖。

假设 John 和 Jessica 同时开工。John 先完成并推送；Jessica 随后推送被服务器拒绝——服务器告诉她这是非快进（non-fast-forward）推送，必须先 fetch 并合并才能推。很多人喜欢这种工作流，因为它就是大家熟悉又安心的那套范式。

它也不限于小团队。凭借 Git 的分支模型，数百个开发者通过几十条分支同时在一个项目上协作完全可行。

### 集成管理者工作流（Integration-Manager Workflow）

Git 允许你拥有多个远端仓库，于是可以这样协作：每个开发者对自己的公开仓库有写权限、对其他所有人的仓库有读权限。这种场景通常包含一个代表"官方"项目的规范（canonical）仓库。要贡献，你就建一个自己的公开克隆，把改动推进去，然后请主项目维护者拉取你的改动。维护者把你的仓库加为远端，在本地测试你的改动，合并进自己的分支，再推回自己的仓库。流程如下：

1. 项目维护者推送到自己的公开仓库。
2. 贡献者克隆该仓库并做改动。
3. 贡献者推送到自己的公开副本。
4. 贡献者给维护者发邮件，请求拉取改动。
5. 维护者把贡献者的仓库加为远端，本地合并。
6. 维护者把合并后的改动推送到主仓库。

这是 GitHub、GitLab 这类枢纽型工具上非常普遍的工作流——fork 一个项目、把改动推进自己的 fork 让所有人可见，都很轻松。这种方式的主要优点之一是你可以持续干活，主仓库的维护者随时可以来拉你的改动；贡献者不必干等项目吸收自己的改动——各方按各自的节奏工作。

### 仁慈的独裁者与副官工作流（Dictator and Lieutenants Workflow）

这是多仓库工作流的一个变体，一般为数百协作者的超大项目所用——最著名的例子是 Linux 内核。多个整合管理者（integration manager）各负责仓库的一部分，称为"副官"（lieutenant）；所有副官共有一位整合管理者，即"仁慈的独裁者"（benevolent dictator）。独裁者从自己的目录推送到一个参照（reference）仓库，所有协作者都从它拉取。流程如下：

1. 普通开发者在自己的主题分支上工作，并把工作变基到 master 之上。这里的 master 指独裁者所推送的参照仓库的 master。
2. 副官把开发者们的主题分支合并进自己的 master 分支。
3. 独裁者把副官们的 master 分支合并进独裁者的 master 分支。
4. 最后，独裁者把这条 master 推到参照仓库，供其他开发者变基。

这种工作流不算常见，但在超大项目或高度分层的环境里可能有用。它让项目负责人（独裁者）得以大量授权（delegate），并在多个节点汇集大块的代码后再行整合。

> **注**：Martin Fowler 写过一份指南 "Patterns for Managing Source Code Branches"，涵盖了所有常见 Git 工作流并解释如何以及何时使用它们，还有一节比较高、低整合频率：https://martinfowler.com/articles/branching-patterns.html

### 工作流小结

以上是 Git 这类分布式系统下一些常用的工作流；你也能看到，为了贴合现实还可以有很多变体。现在你（但愿）能判断哪种组合适合自己，接下来看一些更具体的例子——组成这些流程的各主要角色如何干活。

## 整合贡献的工作：rebase 与 cherry-pick

主题分支上的工作全部就绪、准备并入更主线分支时，问题来了：怎么并？更进一步，你想用什么样的整体工作流维护项目？选择不少，这里讲几个。

### 合并工作流（Merging Workflows）

最基本的工作流：直接把工作合并进 master。这个场景里 master 基本上是稳定代码；当主题分支上的工作你自认完成、或别人贡献并经你验证后，就合并进 master，删掉刚合并的主题分支，如此往复。

这大概是最简单的工作流，但对付更大或更稳定、需要严格把控引入内容的项目可能有问题。

更重要的项目可以采用**两阶段合并循环**：两条长寿分支 master 与 develop——master 只在裁出非常稳定的发布时才更新，所有新代码先整合进 develop。两条分支都定期推到公开仓库。每有新的主题分支要合并，先并进 develop；等打发布标签时，把 master 快进到当时稳定的 develop 所在处。这样别人克隆项目后，检出 master 即可构建最新稳定版并轻松跟进，检出 develop 则是更前沿的内容。这个概念还能扩展：加一条 integrate 分支，所有工作先合并到那里，代码稳定通过测试后再并入 develop；develop 稳定一段时间后，master 再快进过去。

### 大型合并工作流（Large-Merging Workflows）

Git 项目本身有四条长寿分支：master、next、seen（曾名 'pu'——proposed updates，建议更新）用于新工作，maint 用于维护性回移（backport）。贡献者的新工作先在维护者的仓库里收集成主题分支。此时评估各主题是否安全可用、还是需要继续打磨。安全的合并进 next 并推送，让所有人尝试这些主题整合在一起的效果；仍需打磨的合并进 seen。被判定完全稳定后，主题重合并进 master，next 与 seen 随之从 master 重建。这意味着 master 几乎永远前进，next 偶尔变基，seen 变基得更频繁。

主题分支最终合并进 master 后即从仓库删除。Git 项目还有一条从上个发布分叉出的 maint 分支，以便需要维护性发布时提供回移补丁。于是克隆 Git 仓库后，你可以检出四个分支，按自己想多前沿、想怎么贡献来评估项目不同开发阶段的样子；维护者也有一条结构化的工作流来审校新贡献。Git 项目的工作流是特化的，想透彻理解可以读 Git Maintainer's guide。

### 变基与 cherry-pick 工作流（Rebasing and Cherry-Picking Workflows）

另一些维护者更喜欢把贡献的工作 rebase 或 cherry-pick 到自己的 master 之上，而不是合并进来，以保持基本线性的历史。主题分支上的工作确定要整合时，切到那个分支跑 rebase 命令，把改动在当前 master（或 develop 等）之上重建；顺利的话，把 master 快进过去，得到线性的项目历史。

把工作从一个分支挪到另一个分支的另一招是 cherry-pick。Git 里的 cherry-pick 相当于**针对单个提交的 rebase**：取某个提交引入的补丁，尝试在你当前所在的分支上重新应用。当你在一个主题分支上有很多提交、只想整合其中一个，或者主题分支上只有一个提交、不想跑整个 rebase 而更想 cherry-pick 时，它非常有用。

例如有这样一个项目历史（假设 e43a6 是主题分支上的一个提交）。想把提交 e43a6 拉进 master，运行：

```bash
$ git cherry-pick e43a6
Finished one cherry-pick.
[master]: created a0a41a9: "More friendly message when locking the index fails."
 3 files changed, 17 insertions(+), 3 deletions(-)
```

它拉进了与 e43a6 相同的改动，但你会得到一个新的提交 SHA-1 值——因为应用日期不同。现在你可以删掉主题分支、丢弃那些不想拉进来的提交。

### rerere：复用已记录的解决

如果你大量合并、变基，或维护一条长寿主题分支，Git 有个叫 "rerere" 的功能可以帮忙。

Rerere 的意思是 "reuse recorded resolution"（复用已记录的解决方案）——一条手动冲突解决的捷径。启用 rerere 后，Git 会保存成功合并的前像与后像；一旦发现某个冲突与你已经修过的完全一样，就直接用上次的修法，不再烦你。

这个功能分两部分：一个配置项和一个命令。配置项是 rerere.enabled，值得放进全局配置：

```bash
$ git config --global rerere.enabled true
```

从此每次合并解决冲突，解决结果都会记进缓存，以备将来之需。

必要时可以用 `git rerere` 命令与缓存交互：单独调用时，Git 检查它的解决方案数据库，尝试匹配当前合并冲突并解决（rerere.enabled 为 true 时这是自动的）；另有子命令可以查看将要记录什么、从缓存清除特定解决方案、清空整个缓存。

---

> **来源**：本文翻译自《Pro Git》第 2 版（[git-scm.com/book/en/v2](https://git-scm.com/book/en/v2)）多个章节的合并译文：[7.1 Git Tools - Revision Selection](https://git-scm.com/book/en/v2/Git-Tools-Revision-Selection)、[3.6 Git Branching - Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)、[7.8 Git Tools - Advanced Merging](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)、[5.1 Distributed Git - Distributed Workflows](https://git-scm.com/book/en/v2/Distributed-Git-Distributed-Workflows) 与 [5.3 Distributed Git - Maintaining a Project](https://git-scm.com/book/en/v2/Distributed-Git-Maintaining-a-Project)（cherry-pick、rerere 小节），作者 Scott Chacon、Ben Straub，许可 CC BY-NC-SA 3.0。抓取于 2026-09-13。
