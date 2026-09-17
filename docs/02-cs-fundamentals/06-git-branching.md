---
title: Git 分支、合并与远程协作
source_url: https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell
author: Scott Chacon、Ben Straub（Pro Git 2nd Edition，Apress）
license: CC BY-NC-SA 3.0
fetched_at: 2026-09-13
translated: true
order: 6
group: Linux 与开发工具
---

几乎每种版本控制系统（VCS）都以某种形式支持分支。分支意味着你从主干开发线上分离开来，在不干扰主干的情况下继续工作。在许多 VCS 工具里，这是个代价高昂的过程——往往要复制一份源码目录，大项目可能耗时很久。

有人把 Git 的分支模型称为它的"必杀技"，它确实让 Git 在 VCS 界独树一帜。为什么这么特别？因为 Git 创建分支**极其轻量**：分支操作近乎瞬时完成，分支之间来回切换也同样快。与其他 VCS 不同，Git 鼓励"频繁分支、频繁合并"的工作流——哪怕一天分合多次。理解并掌握这一特性，会彻底改变你的开发方式；本模块其他文章里"AI 结对编码用分支隔离实验"等实践，也都建立在这之上。

## 分支速览

要真正理解 Git 的分支方式，得先回头看 Git 如何存储数据。

Git 不是以一系列变更集或差异存储数据，而是以一系列**快照**（snapshot）。当你提交时，Git 存储一个提交对象，其中包含指向你暂存内容的快照的指针。该对象还包含作者姓名与邮箱、你输入的信息，以及指向其直接前驱提交（父提交）的指针：初始提交没有父提交，普通提交有一个，由两个及以上分支合并产生的提交则有多个。

假设有一个目录含三个文件，全部暂存后提交：

```console
$ git add README test.rb LICENSE
$ git commit -m 'Initial commit'
```

暂存时 Git 为每个文件计算校验和（SHA-1 哈希），把该版本文件存入仓库（称为 **blob**），并把校验和记入暂存区。运行 `git commit` 时，Git 为每个子目录计算校验和、以**树对象**（tree）存入仓库，然后创建一个含元数据和根树指针的**提交对象**。此时仓库里有五个对象：三个 blob、一个 tree、一个 commit。

再修改、再提交，新的提交就会存储指向其前驱提交的指针。

**Git 的分支，本质上只是指向某个提交的可移动轻量指针。** Git 的默认分支名是 `master`。你开始提交后，就有了指向最后一次提交的 `master` 分支；每提交一次，`master` 指针自动前移。

> 注：`master` 分支毫无特殊性，与任何其他分支完全一样。几乎每个仓库都有它，仅仅因为 `git init` 默认创建它、而多数人懒得改名。（GitHub 等平台如今默认用 `main`。）

### 新建分支

创建新分支发生了什么？只是新建了一个可供你移动的指针。想创建 `testing` 分支：

```console
$ git branch testing
```

这会创建一个指向你当前所在提交的新指针。

Git 怎么知道你当前在哪个分支？它维护一个叫 `HEAD` 的特殊指针（与你可能熟悉的 Subversion/CVS 里的 HEAD 概念大不相同）。在 Git 里，`HEAD` 指向你当前所在的**本地分支**。上例中你仍在 `master`——`git branch` 只**创建**了分支，并未切换过去。

用 `git log --oneline --decorate` 可以直观看到分支指针的位置：

```console
$ git log --oneline --decorate
f30ab (HEAD -> master, testing) Add feature #32 - ability to add new formats to the central interface
34ac2 Fix bug #1328 - stack overflow under certain conditions
98ca9 Initial commit
```

### 切换分支

切换到已有分支用 `git checkout`：

```console
$ git checkout testing
```

这会把 `HEAD` 移向 `testing` 分支。此后再提交，`testing` 前进而 `master` 纹丝不动。切回 `master` 后再提交，项目历史就**分叉**（diverge）了——你在两个分支上各有独立的工作，可以来回切换、随时合并，而这一切只用了 `branch`、`checkout`、`commit` 三个简单命令。

用 `git log --oneline --decorate --graph --all` 能把分叉历史看得一清二楚：

```console
$ git log --oneline --decorate --graph --all
* c2b9e (HEAD, master) Make other changes
| * 87ab2 (testing) Make a change
|/
* f30ab Add feature #32 - ability to add new formats to the central interface
* 34ac2 Fix bug #1328 - stack overflow under certain conditions
* 98ca9 Initial commit of my project
```

由于 Git 的分支只是一个含 40 字符 SHA-1 校验和的文件，分支的创建与销毁极其廉价——新建分支等于向文件写入 41 字节（40 字符加换行）。这与老式 VCS"把整个项目拷到第二个目录"的做法形成鲜明对比。另外，提交时记录了父提交，合并时寻找合适的合并基（merge base）就自动完成了。这些特性鼓励开发者频繁使用分支。

> 注：创建并立即切换到新分支，可用 `git checkout -b <newbranchname>` 一步完成。Git 2.23 起还可用 `git switch`：`git switch testing-branch` 切换已有分支；`git switch -c new-branch` 创建并切换；`git switch -` 回到上一个分支。

另一个要点：**切换分支会改变工作目录中的文件**。切到较旧的分支，工作目录会回到该分支最后一次提交时的样子；如果 Git 无法干净地完成切换（有冲突的未提交修改），它会直接拒绝切换。

## 基本分支与合并

看一个真实工作流的例子。你要开发网站，并为新用户故事建分支开发；此时来了个必须立即修复的线上问题（hotfix）。流程：

1. 建分支做 issue #53；
2. 切回生产分支，建 hotfix 分支修复；
3. 测试通过后合并 hotfix、部署上线；
4. 切回 story 分支继续干活。

```console
$ git checkout -b iss53
Switched to a new branch "iss53"
$ vim index.html
$ git commit -a -m 'Create new footer [issue 53]'
```

突然接到线上问题报告。有了 Git，你不必把修复和 `iss53` 的半成品一起部署，也不必费劲回滚——只需切回 `master`：

```console
$ git checkout master
Switched to branch 'master'
```

此时工作目录完全回到你开始做 #53 之前的样子。这里有个重要原则：**切换分支时，Git 会把工作目录重置成目标分支最后一次提交时的样子**，自动增删改文件。另外，若工作目录或暂存区里有与切换目标冲突的未提交修改，Git 会拒绝切换——保持干净的工作状态再切换（或用 stash，见 Pro Git 第 7 章）。

接着修 bug：

```console
$ git checkout -b hotfix
Switched to a new branch 'hotfix'
$ vim index.html
$ git commit -a -m 'Fix broken email address'
[hotfix 1fb7853] Fix broken email address
 1 file changed, 2 insertions(+)
```

测试通过后，把 `hotfix` 合回 `master` 部署上线：

```console
$ git checkout master
$ git merge hotfix
Updating f42c576..3a0874c
Fast-forward
 index.html | 2 ++
 1 file changed, 2 insertions(+)
```

注意输出里的 "**fast-forward**"（快进）。因为要合并的 `hotfix` 所指的提交 C4，正是你所在提交 C2 的直接后继，Git 只是简单地把指针前移——没有需要合并的分叉工作。现在修复已进入 `master` 的快照，可以部署了。

之后删掉不再需要的 `hotfix` 分支（`master` 已指向同一处），用 `-d` 选项：

```console
$ git branch -d hotfix
Deleted branch hotfix (3a0874c).
```

切回 `iss53` 继续干活。值得注意：`hotfix` 里的修复**并不**包含在 `iss53` 的文件里。需要的话可以 `git merge master` 把它拉进来，或者等之后 `iss53` 合回 `master` 时一并获得。

### 基本合并

#53 做完了，合回 `master`。切到目标分支，再执行 `git merge`：

```console
$ git checkout master
Switched to branch 'master'
$ git merge iss53
Merge made by the 'recursive' strategy.
index.html |    1 +
1 file changed, 1 insertion(+)
```

这次的输出与刚才不同：你的开发历史已经从某个更早的点分叉了——当前分支的提交不是被合并分支的直接祖先，Git 需要做真正的工作：以两个分支末端的快照和它们的**共同祖先**做一次简单的**三方合并**（three-way merge）。Git 不再是移动指针，而是基于三方合并创建一个新快照、并自动生成指向它的新提交——这叫**合并提交**（merge commit），特殊之处在于它有不止一个父提交。工作合并完成后，`iss53` 分支就没有存在必要了，可以在任务系统里关闭 issue 并 `git branch -d iss53`。

### 基本合并冲突

这个过程偶尔不会一帆风顺。如果两个分支以不同方式修改了同一文件的同一部分，Git 就无法干净合并：

```console
$ git merge iss53
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Git 没有自动创建合并提交，而是暂停等你解决冲突。合并冲突后随时可用 `git status` 查看哪些文件未合并：

```console
$ git status
On branch master
You have unmerged paths.
  (fix conflicts and run "git commit")

Unmerged paths:
  (use "git add <file>..." to mark resolution)

    both modified:      index.html
```

Git 会在冲突文件中插入标准冲突标记，你可以手动打开解决：

```html
<<<<<<< HEAD:index.html
<div id="footer">contact : email.support@github.com</div>
=======
<div id="footer">
 please contact us at support@github.com
</div>
>>>>>>> iss53:index.html
```

`HEAD`（你执行 merge 时所在的 `master` 分支）的版本在 `=======` 上方，`iss53` 分支的版本在下方。解决冲突的方式：二选一，或自己融合两者，例如：

```html
<div id="footer">
please contact us at email.support@github.com
</div>
```

这个解法融合了双方内容，且 `<<<<<<<`、`=======`、`>>>>>>>` 标记行已全部移除。每个冲突文件的每个冲突区都解决后，对每个文件运行 `git add` 把它标记为已解决（暂存即标记）。

想用图形工具的话，运行 `git mergetool`，它会启动合适的可视化合并工具引导你逐个解决冲突。退出合并工具后，再次 `git status` 确认所有冲突已解决，最后 `git commit` 完成合并提交。默认提交信息会列出冲突文件；如果对未来翻阅这段历史的人有帮助，可以在提交信息里补充你如何解决冲突、为什么这么改。

## 分支工作流

掌握了分支与合并的基本功，接下来是"能拿它们做什么"。本节介绍轻量分支让哪些常见工作流成为可能。

### 长期分支（Long-Running Branches）

因为 Git 使用简单的三方合并，长周期内把一个分支多次合入另一分支通常很容易。于是你可以让若干分支**长期开放**，对应开发周期的不同阶段，并定期互相合并。

很多 Git 开发者的做法：`master` 分支只保留完全稳定的代码（也许只放已发布或将要发布的代码）；另有一个并行分支（如 `develop` 或 `next`），在上面工作或测试稳定性——它不必永远稳定，一旦达到稳定状态就可合入 `master`；短期的主题分支完成后先进入它，确保通过全部测试、不引入 bug。

实际上这就是指针沿着提交线向前移动：稳定分支在提交历史的下游，最前沿的分支在上游。你也可以把它想象成一组"工作筒仓"（silo），一组组提交经过完整测试后"晋级"到更稳定的筒仓。稳定性分级可以有多层：有些大型项目还有 `proposed`（或 `pu`，proposed updates）分支，收纳尚未成熟到可进 `next`/`master` 的集成工作。多级长期分支并非必需，但对大型复杂项目往往很有帮助。

### 主题分支（Topic Branches）

主题分支在任何规模的项目里都有用：它是为**单个特定功能或相关工作**创建的短期分支。这在其他 VCS 里你可能从未做过——因为建分支、合并分支代价太高。但在 Git 里，一天之内多次"建分支、开发、合并、删除"是家常便饭。

上一节的 `iss53` 与 `hotfix` 就是主题分支：在上面提交，合并进主分支后立即删除。这项技术让你**快速而完整地切换上下文**——分支里的所有改动都围绕一个主题，代码审查时更容易看清发生了什么。改动可以放几分钟、几天甚至几个月，准备好了再合并，与创建顺序无关。别忘了：这些分支完全本地——分支与合并的一切都只发生在你自己的 Git 仓库里，**与服务器没有任何通信**。

> 编者按（衔接 PR 协作）：主题分支 + 远程分支，正是 Pull Request 工作流的地基。所谓 PR，通常就是"把我的主题分支推到远程，请求项目维护者把它合并进主干分支"——围绕它展开代码评审、CI 检查与讨论。掌握了下文的远程分支操作，你就掌握了 PR 流程中本地的全部动作。

## 远程分支

远程引用（remote references）是你远程仓库中的引用（指针），包括分支、标签等。`git ls-remote <remote>` 可列出全部远程引用；`git remote show <remote>` 则给出远程分支等更多信息。更常用的方式是**远程跟踪分支**（remote-tracking branches）。

远程跟踪分支是**远程分支状态的本地引用**，你不能手动移动它们；每当你进行网络通信（fetch/push 等），Git 自动移动它们，确保它们如实反映远程仓库的状态。把它们当成"书签"：记录着你上次连接远程仓库时，那些分支在哪里。

远程跟踪分支命名为 `<remote>/<branch>`。例如想看 `origin` 远程上 `master` 上次同步时的样子，就看 `origin/master`。与伙伴协作时对方推了 `iss53` 分支，你自己的本地分支叫 `iss53`，而服务器上那条分支在你的仓库里表现为 `origin/iss53`。

举例：你从 `git.ourcompany.com` 克隆。`clone` 自动把该远程命名为 `origin`，拉取全部数据，创建指向其 `master` 位置的 `origin/master`；同时给你一个从同一起点出发的本地 `master`。

> 注："origin" 也毫无特殊性——它只是 `git clone` 时远程的默认名（正如 `master` 只是 `git init` 的默认分支名）。`git clone -o booyah` 的话，你的默认远程分支就叫 `booyah/master`。

如果 你在本地 `master` 上干活，同时别人向服务器推送并更新了它的 `master`，双方历史就各自前进；只要你不联网，`origin/master` 指针保持不动。要同步，运行 `git fetch <remote>`（如 `git fetch origin`）：它找出 "origin" 对应的服务器、取回你还没有的数据、更新本地数据库，并把 `origin/master` 指针移到新的位置。

`git remote add` 可以把更多服务器加为远程。比如把 `git.team1.ourcompany.com` 加为 `teamone`，然后 `git fetch teamone` 取回它有而你没有的数据。

### 推送

想与世界分享一个分支，必须把它**显式推送**到有写权限的远程——本地分支不会自动同步。这样你就可以把不想分享的工作留在私有分支，只推送要协作的主题分支：

```console
$ git push origin serverfix
Counting objects: 24, done.
...
To https://github.com/schacon/simplegit
 * [new branch]      serverfix -> serverfix
```

这其实是个快捷写法：Git 自动把 `serverfix` 展开为 `refs/heads/serverfix:refs/heads/serverfix`，意为"取我的 `serverfix` 本地分支，推送更新远程的 `serverfix` 分支"。`git push origin serverfix:awesomebranch` 则把本地 `serverfix` 推到远程名为 `awesomebranch` 的分支。

> 注：走 HTTPS 推送时服务器会要求用户名密码。不想每次输入，可配置凭据缓存：`git config --global credential.helper cache`（先在内存里缓存几分钟）。

协作者下次 fetch 时会得到 `origin/serverfix` 这个远程跟踪分支。重要的一点：**fetch 带下的新远程跟踪分支，并不会自动给你可编辑的本地副本**——你只有不可修改的 `origin/serverfix` 指针。要合并进当前分支：`git merge origin/serverfix`；想要自己的可工作分支：

```console
$ git checkout -b serverfix origin/serverfix
Branch serverfix set up to track remote branch serverfix from origin.
Switched to a new branch 'serverfix'
```

### 跟踪分支（Tracking Branches）

从远程跟踪分支检出的本地分支会自动成为"跟踪分支"（它跟踪的远程分支叫"上游分支"，upstream）。跟踪分支与远程分支有直接关联：在跟踪分支上运行 `git pull`，Git 自动知道从哪个服务器取、合并哪个分支。

克隆仓库时，一般自动创建跟踪 `origin/master` 的 `master`。常见操作的简写：

```console
$ git checkout --track origin/serverfix
# 更简：本地不存在且恰好与唯一远程同名时，git checkout serverfix 即可
# 本地分支想换个名字：
$ git checkout -b sf origin/serverfix
Branch sf set up to track remote branch serverfix from origin.
```

已有本地分支想改设上游，用 `-u` / `--set-upstream-to`：

```console
$ git branch -u origin/serverfix
```

设置好跟踪分支后，可用 `@{upstream}`（简写 `@{u}`）引用上游：如在 `master` 上可写 `git merge @{u}` 代替 `git merge origin/master`。

用 `git branch -vv` 查看全部跟踪关系与领先/落后情况：

```console
$ git branch -vv
  iss53     7e424c3 [origin/iss53: ahead 2] Add forgotten brackets
  master    1ae2a45 [origin/master] Deploy index fix
* serverfix f8674d9 [teamone/server-fix-good: ahead 3, behind 1] This should do it
  testing   5ea463a Try something new
```

`iss53` 跟踪 `origin/iss53` 且领先 2（本地有 2 个未推送提交）；`master` 与远程同步；`serverfix` 跟踪 `teamone` 上的 `server-fix-good`，领先 3 落后 1（服务器有 1 个未合并提交、本地有 3 个未推送提交）；`testing` 不跟踪任何远程分支。注意：这些数字只反映**上次 fetch** 时的缓存状态；要最新数据，先 `git fetch --all` 再执行。

### 拉取

`git fetch` 取回服务器上所有你没有的改动，但**不修改你的工作目录**——它只拿数据，由你自己合并。而 `git pull` 在多数情况下相当于 `git fetch` 紧跟 `git merge`：如果当前分支设有跟踪分支，`git pull` 会查到它跟踪的服务器与分支、取回并尝试合并该远程分支。`fetch` + `merge` 的显式组合更可控，`pull` 更省事，按团队习惯选择即可。

### 删除远程分支

假设一个功能已完成并合入远程的 `master`，对应的远程分支可以删除。用 `git push` 的 `--delete` 选项：

```console
$ git push origin --delete serverfix
To https://github.com/schacon/simplegit
 - [deleted]         serverfix
```

这基本上只是从服务器移除指针。Git 服务器一般会把数据保留一段时间直到垃圾回收运行，所以误删的远程分支通常很容易恢复。

## 小结

到这里你已经掌握了从本地到远程的完整分支协作链路：本地轻量开分支 → 快速切换上下文 → 三方合并（必要时解决冲突）→ 推送到远程 → 通过跟踪分支同步协作者进度 → 删除用完的分支。在 GitHub/GitLab 上发起与评审 Pull Request 时，背后发生的正是这些动作。

---

> **来源**：本文翻译自 Pro Git（第 2 版）第 3 章 "Git Branching"（3.1 Branches in a Nutshell、3.2 Basic Branching and Merging、3.4 Branching Workflows、3.5 Remote Branches 四节合译），作者 Scott Chacon、Ben Straub，许可 CC BY-NC-SA 3.0。抓取于 2026-09-13。
