---
title: Git 基础：获取仓库、暂存、提交与回退
source_url: https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository
author: Scott Chacon、Ben Straub（Pro Git 2nd Edition，Apress）
license: CC BY-NC-SA 3.0
fetched_at: 2026-09-13
translated: true
order: 5
group: Git 与持续集成
---
如果能只读一章就开始用 Git，那就是本章。它覆盖了你今后使用 Git 时绝大多数场景所需的基本命令。读完本章，你将能够：配置并初始化一个仓库、开始与停止跟踪文件、暂存（stage）并提交（commit）修改。我们还会介绍如何让 Git 忽略特定文件、如何快速撤销误操作、如何浏览项目历史并查看提交之间的差异。

## 获取 Git 仓库

通常有两种方式获得一个 Git 仓库：

1. 把一个尚未纳入版本控制的本地目录变成 Git 仓库；
2. 从别处**克隆**（clone）一个已有的 Git 仓库。

两种方式的结果一样：你的本地机器上多出一个可以开工的 Git 仓库。

### 在现有目录中初始化仓库

如果手头有一个未受版本控制的项目目录、想用 Git 管理它，先进入该目录（Linux：`cd /home/user/my_project`；macOS：`cd /Users/user/my_project`；Windows：`cd C:/Users/user/my_project`），然后输入：

```console
$ git init
```

该命令会创建一个名为 `.git` 的子目录，其中包含仓库必需的全部文件——一个 Git 仓库的骨架。此时，你的项目里还没有任何文件被跟踪。

如果要从现有文件开始（而不是空目录），应该先跟踪这些文件并做一次初始提交。用几条 `git add` 指定要跟踪的文件，再 `git commit`：

```console
$ git add *.c
$ git add LICENSE
$ git commit -m 'Initial project version'
```

这些命令的作用稍后详述。到此，你有了一个带跟踪文件和初始提交的 Git 仓库。

### 克隆现有仓库

想获得现有 Git 仓库的副本（比如想给某个项目贡献代码），需要的命令是 `git clone`。如果你用过 Subversion 等 VCS，会注意到命令是 "clone" 而不是 "checkout"——这是重要区别：Git 拿到的是**几乎全部数据的完整副本**，而不仅仅是工作副本。默认情况下，`git clone` 会把项目历史上每一个文件的每一个版本都拉下来。事实上，就算服务器磁盘损坏，你几乎可以用任意一个客户端上的克隆把服务器恢复到克隆时的状态（可能丢一些服务端钩子之类，但全部版本化数据都在）。

克隆仓库用 `git clone <url>`。例如克隆 `libgit2` 库：

```console
$ git clone https://github.com/libgit2/libgit2
```

这会创建名为 `libgit2` 的目录，在其中初始化 `.git`，拉取仓库全部数据，并检出最新版本的工作副本。想把仓库克隆到其他名字的目录，把目录名作为附加参数即可：

```console
$ git clone https://github.com/libgit2/libgit2 mylibgit
```

Git 支持多种传输协议。上例用的是 `https://`，你还可能见到 `git://`，或走 SSH 协议的 `user@server:path/to/repo.git`。

## 记录对仓库的修改

现在本地有了一个真正的 Git 仓库和所有文件的工作副本。通常你会开始修改文件，并在项目到达想记录的状态时提交这些修改的快照。

记住：工作目录里的每个文件只有两种状态——**已跟踪**（tracked）或**未跟踪**（untracked）。已跟踪文件是指上次快照中出现的文件、以及新暂存的文件；它们可以处于未修改、已修改或已暂存状态。简言之，已跟踪文件就是 Git"认识"的文件。

未跟踪文件是其余一切——工作目录中不在上次快照中、也不在暂存区里的文件。刚克隆完仓库时，所有文件都是已跟踪且未修改的，因为 Git 刚把它们检出而你还没改。你一编辑文件，Git 就把改动的文件视为"已修改"；工作中你选择性地把修改过的文件暂存，然后提交所有已暂存的修改，如此循环。

### 检查文件状态

判断文件处于哪种状态的主要工具是 `git status`。刚克隆完直接运行，会看到：

```console
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
nothing to commit, working tree clean
```

这表示工作目录很干净：所有已跟踪文件都没有被修改，也没有未跟踪文件。命令还告诉你当前所在分支，以及它与服务器上同名分支没有分叉。

> 注：GitHub 已于 2020 年年中把默认分支名从 `master` 改为 `main`，其他 Git 托管平台纷纷跟进。因此你在新建仓库里看到的默认分支可能是 `main`；默认分支名也是可以修改的。Git 本身（截至成书）仍默认 `master`，本书沿用了这一写法。

向项目添加一个新文件试试：

```console
$ echo 'My Project' > README
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
Untracked files:
  (use "git add <file>..." to include in what will be committed)

    README

nothing added to commit but untracked files present (use "git add" to track)
```

新文件 `README` 出现在 "Untracked files" 标题下。未跟踪意味着：Git 在上一次快照（提交）中没有见过它，它也尚未被暂存；在你明确告诉 Git 之前，它不会被纳入提交快照。这样设计的目的是防止你误把构建产物、二进制文件之类不想入库的东西提交进去。

### 跟踪新文件

用 `git add` 开始跟踪新文件：

```console
$ git add README
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)

    new file:   README
```

`README` 出现在 "Changes to be committed" 之下，说明它已被暂存。此时提交的话，进入历史快照的是你运行 `git add` 那一刻的文件版本。`git add` 接受文件或目录路径；若是目录，则递归添加其中的所有文件。

### 暂存已修改的文件

改一个已跟踪的文件（如 `CONTRIBUTING.md`）再看状态：

```console
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
Changes to be committed:
  (use "git reset HEAD <file>..." to unstage)

    new file:   README

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

    modified:   CONTRIBUTING.md
```

`CONTRIBUTING.md` 出现在 "Changes not staged for commit" 下——已跟踪文件被修改了但尚未暂存。运行 `git add` 把它暂存。`git add` 是个多面手：开始跟踪新文件、暂存文件、把合并冲突标记为已解决，都靠它。不妨把它理解为"**把当前内容的这个版本精确地加入下一次提交**"，而不是"把这个文件加进项目"。

```console
$ git add CONTRIBUTING.md
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
Changes to be committed:
  (use "git reset HEAD <file>..." to unstage)

    new file:   README
    modified:   CONTRIBUTING.md
```

两个文件都已暂存，将进入下一次提交。此刻假设你又想起 `CONTRIBUTING.md` 里还有个小改动，改完再 `git status`：

```console
$ vim CONTRIBUTING.md
$ git status
On branch master
Your branch is up-to-date with 'origin/master'.
Changes to be committed:
  (use "git reset HEAD <file>..." to unstage)

    new file:   README
    modified:   CONTRIBUTING.md

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

    modified:   CONTRIBUTING.md
```

怎么回事？`CONTRIBUTING.md` 同时出现在已暂存和未暂存两处。原因在于：Git 暂存的是你运行 `git add` **那一刻**的文件。现在提交的话，进入提交的是你最后一次 `git add` 时的版本，而不是 `git commit` 运行时工作目录里的版本。`git add` 之后又改了文件，就必须再跑一次 `git add` 暂存最新版本。

### 简短状态输出

`git status` 很全面但啰嗦。用 `git status -s`（或 `--short`）得到紧凑输出：

```console
$ git status -s
 M README
MM Rakefile
A  lib/git.rb
M  lib/simplegit.rb
?? LICENSE.txt
```

新未跟踪文件标 `??`；新加入暂存区的标 `A`；修改过的标 `M`，等等。输出有两列：左列是暂存区状态，右列是工作区状态。例如 `README` 在工作区被改过但未暂存；`lib/simplegit.rb` 已改且已暂存；`Rakefile` 改过、暂存后又改了，所以两列都有标记。

### 忽略文件

总有一类文件你不想让 Git 自动添加、甚至不想让它们以未跟踪状态出现在状态输出里——通常是日志、构建产物这类自动生成的文件。创建一个名为 `.gitignore` 的文件、列出匹配模式即可：

```console
$ cat .gitignore
*.[oa]
*~
```

第一行让 Git 忽略所有 `.o` 或 `.a` 结尾的文件（构建产物）；第二行忽略所有以波浪号 `~` 结尾的文件（Emacs 等编辑器的临时文件）。你通常还想忽略 log、tmp、pid 目录、自动生成的文档等。新仓库开工前先配好 `.gitignore` 是个好习惯，免得误提交。

`.gitignore` 的模式规则如下：

- 空行及 `#` 开头的行被忽略；
- 使用标准 glob 模式，并对整个工作树递归生效；
- 以 `/` 开头的模式不递归；
- 以 `/` 结尾的模式只匹配目录；
- 以 `!` 开头的模式表示取反（不忽略）。

glob 模式类似 Shell 用的简化正则：`*` 匹配零个或多个字符；`[abc]` 匹配方括号内任一字符；`?` 匹配单个字符；`[0-9]` 匹配范围内的字符；`**` 可匹配嵌套目录，如 `a/**/z` 匹配 `a/z`、`a/b/z`、`a/b/c/z` 等。

再看一个例子：

```
# 忽略所有 .a 文件
*.a

# 但要跟踪 lib.a，尽管上面忽略了 .a
!lib.a

# 只忽略当前目录下的 TODO，不管子目录里的
/TODO

# 忽略任何名为 build 的目录下的所有文件
build/

# 忽略 doc/notes.txt，但不忽略 doc/server/arch.txt
doc/*.txt

# 忽略 doc/ 目录及其子目录下的所有 .pdf 文件
doc/**/*.pdf
```

> 提示：GitHub 维护了一份相当全面的 [.gitignore 示例库](https://github.com/github/gitignore)，覆盖几十种项目与语言，可以作为起点。

> 注：简单情形下一个仓库只有根目录一个 `.gitignore`，对全仓库递归生效；但子目录里也可以有额外的 `.gitignore`，其规则只作用于所在目录之下（Linux 内核仓库里有 206 个 `.gitignore` 文件）。细节见 `man gitignore`。

### 查看已暂存与未暂存的修改

如果嫌 `git status` 太笼统——想知道**具体改了什么**而不只是**哪些文件改了**——用 `git diff`。它最常用来回答两个问题：改了但还没暂存的是什么？已暂存、即将提交的是什么？`git status` 只列文件名，`git diff` 则显示具体增删了哪些行——也就是补丁（patch）本身。

查看未暂存的修改，直接 `git diff`——它比较工作目录与暂存区：

```console
$ git diff
diff --git a/CONTRIBUTING.md b/CONTRIBUTING.md
index 8ebb991..643e24f 100644
--- a/CONTRIBUTING.md
+++ b/CONTRIBUTING.md
@@ -65,7 +65,8 @@ branch directly, things can get messy.
 Please include a nice description of your changes when you submit your PR;
 if we have to read the whole diff to figure out why you're contributing
 in the first place, you're less likely to get feedback and have your change
-merged in.
+merged in. Also, split your changes into comprehensive chunks if your patch is
+longer than a dozen lines.
```

查看已暂存、将进入下次提交的内容，用 `git diff --staged`——它比较暂存区与上一次提交（`--cached` 是同义词）：

```console
$ git diff --staged
diff --git a/README b/README
new file mode 100644
index 0000000..03902a1
--- /dev/null
+++ b/README
@@ -0,0 +1 @@
+My Project
```

重要的一点：`git diff` 本身**不会**显示自上次提交以来的所有修改，只显示尚未暂存的那些。如果你把所有修改都暂存了，`git diff` 不会有任何输出。

偏好图形界面的话，可以用 `git difftool`（如 vimdiff 等）查看同样的差异；`git difftool --tool-help` 能列出系统上可用的工具。

### 提交修改

暂存区准备就绪后就可以提交了。记住：**任何还没暂存的东西都不会进入这次提交**——新建或修改过却没 `git add` 的文件仍以已修改状态留在磁盘上。最简单的提交方式：

```console
$ git commit
```

这会启动你配置的编辑器（由 `EDITOR` 环境变量或 `git config --global core.editor` 决定）。编辑器里会显示类似下面的内容（以 Vim 为例）：

```
# Please enter the commit message for your changes. Lines starting
# with '#' will be ignored, and an empty message aborts the commit.
# On branch master
# Your branch is up-to-date with 'origin/master'.
#
# Changes to be committed:
#	new file:   README
#	modified:   CONTRIBUTING.md
#
```

默认提交信息中包含注释掉的最新 `git status` 输出；你可以删掉注释、写自己的提交信息，也可以留着它们帮自己回忆提交内容。退出编辑器后，Git 就用这条信息创建提交（注释会被剔除）。加上 `-v` 选项还会把 diff 放进编辑器，让你确切看到要提交的修改。

也可以用 `-m` 直接内联提交信息：

```console
$ git commit -m "Story 182: fix benchmarks for speed"
[master 463dc4f] Story 182: fix benchmarks for speed
 2 files changed, 2 insertions(+)
 create mode 100644 README
```

第一个提交诞生了！输出显示：提交到了哪个分支（`master`）、本次提交的 SHA-1 校验和（`463dc4f`）、改动文件数以及增删行数统计。

再次强调：提交记录的是**暂存区里**的快照。没暂存的内容依然以已修改状态待着，可以再做一次提交。每次提交都是给项目拍一张"快照"，将来可以随时回退或对比。

### 跳过暂存区

尽管暂存区可以精心雕琢提交内容，但有时它显得繁琐。给 `git commit` 加 `-a`，Git 会自动把所有**已跟踪**的修改文件先暂存再提交，省掉 `git add`：

```console
$ git status
On branch master
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

    modified:   CONTRIBUTING.md

no changes added to commit (use "git add" and/or "git commit -a")
$ git commit -a -m 'Add new benchmarks'
[master 83e38c7] Add new benchmarks
 1 file changed, 5 insertions(+), 0 deletions(-)
```

注意这很方便，但要小心：`-a` 会把所有改动一锅端进去，有时会带上你不想要的内容。

### 删除文件

要从 Git 中删除文件，必须把它从已跟踪文件（准确说是暂存区）中移除并提交。`git rm` 会做到这一点，并同时从工作目录删掉该文件，免得它下次又以未跟踪状态出现。只在工作目录里 `rm` 的话，它只会出现在 "Changes not staged for commit" 区域：

```console
$ rm PROJECTS.md
$ git status
...
    deleted:    PROJECTS.md
...

$ git rm PROJECTS.md
rm 'PROJECTS.md'
$ git status
On branch master
Changes to be committed:
  (use "git reset HEAD <file>..." to unstage)

    deleted:    PROJECTS.md
```

下次提交后文件就彻底从跟踪中移除了。如果文件修改过或已进暂存区，必须用 `-f` 强制删除——这是安全设计，防止误删尚未记录进快照、从而无法从 Git 恢复的数据。

另一个常见需求：把文件从暂存区移除但**留在工作目录**——也就是让硬盘上还留着它、但 Git 不再跟踪。当你忘了往 `.gitignore` 加某文件却已经把它暂存（比如一个大日志文件或一堆 `.a` 编译产物）时特别有用：

```console
$ git rm --cached README
```

`git rm` 也接受文件名、目录和 glob 模式：

```console
$ git rm log/\*.log
```

注意 `*` 前的反斜杠：Git 会自己做文件名展开，必须转义以防被 Shell 先展开。这条命令删除 `log/` 目录下所有 `.log` 文件。类似地 `git rm \*~` 删除所有以 `~` 结尾的文件。

### 移动文件

与其他 VCS 不同，Git 不显式跟踪文件的"移动/重命名"——重命名不会存进任何元数据；不过 Git 事后推断重命名相当聪明。尽管如此 Git 还是提供了 `mv` 命令：

```console
$ git mv file_from file_to
$ git mv README.md README
$ git status
On branch master
Changes to be committed:
  (use "git reset HEAD <file>..." to unstage)

    renamed:    README.md -> README
```

它其实等价于下面三条命令：

```console
$ mv README.md README
$ git rm README.md
$ git add README
```

Git 会隐式推断出这是重命名，所以你怎么改名都行；`git mv` 只是把三步并成一步的便利命令。你完全可以用任何工具改名，提交前补上 add/rm 即可。

## 查看提交历史

创建了几个提交、或克隆了一个带历史的仓库之后，你多半想回头看看发生了什么。最基本也最强大的工具是 `git log`（示例项目：`git clone https://github.com/schacon/simplegit-progit`）：

```console
$ git log
commit ca82a6dff817ec66f44342007202690a93763949
Author: Scott Chacon <schacon@gee-mail.com>
Date:   Mon Mar 17 21:52:11 2008 -0700

    Change version number

commit 085bb3bcb608e1e8451d4b2432f8ecbe6306e7e7
Author: Scott Chacon <schacon@gee-mail.com>
Date:   Sat Mar 15 16:40:33 2008 -0700

    Remove unnecessary test

commit a11bef06a3f659402fe7563abf99ad00de2209e6
Author: Scott Chacon <schacon@gee-mail.com>
Date:   Sat Mar 15 10:31:28 2008 -0700

    Initial commit
```

不带参数时，`git log` 按时间**逆序**列出提交（最新在前），每条包含 SHA-1 校验和、作者姓名与邮箱、日期和提交信息。

`git log` 有大量选项，常用的有：

- `-p` / `--patch`：显示每次提交引入的差异（patch），还可配合 `-2` 只看最近两条。代码审查或浏览合作者的一串提交时极有用。
- `--stat`：每次提交下方列出被修改的文件、每个文件的增删行数及汇总统计。
- `--pretty=oneline`：每个提交一行；还有 `short`、`full`、`fuller` 等预设。
- `--pretty=format:"..."`：自定义输出格式，特别适合机器解析——格式是你显式指定的，不会随 Git 升级而变。常用占位符如 `%h`（短哈希）、`%an`（作者名）、`%ar`（相对日期）、`%s`（主题）。

```console
$ git log --pretty=format:"%h - %an, %ar : %s"
ca82a6d - Scott Chacon, 6 years ago : Change version number
085bb3b - Scott Chacon, 6 years ago : Remove unnecessary test
a11bef0 - Scott Chacon, 6 years ago : Initial commit
```

`oneline` 与 `format` 常配合 `--graph` 使用，后者会画出一个 ASCII 小图展示分支与合并历史。顺带一提：**作者**（author）是最初写代码的人，**提交者**（committer）是最后把改动应用进仓库的人——给项目提交补丁、由核心成员代为提交时，两个人都会被记录。

## 撤销操作

任何阶段你都可能想撤销点什么。本节介绍几个基本的撤销工具。**请小心**：有些撤销操作本身撤不回来，这是 Git 中少数可能因操作不当而丢失工作的领域之一。

### 用 --amend 补救最后一次提交

最常见的撤销场景：提交得太早、忘了加某些文件，或者提交信息写砸了。想重做这次提交，把遗漏的修改补上、暂存，然后用 `--amend` 再提交一次：

```console
$ git commit -m 'Initial commit'
$ git add forgotten_file
$ git commit --amend
```

最终你只会有一个提交——第二次提交取代了第一次的结果。

要理解的是：amend 并不是"修补"上一次提交，而是**用一个全新的提交完全取代它**——效果上就像上一次提交从未发生过，它不会出现在仓库历史里。amend 的价值在于对最后一次提交做小改进，而不用让历史里堆满 "哎呀忘了加个文件" 这种提交。

> 注：只对**仍在本地的、尚未推送**的提交使用 amend。修改已推送的提交再强推分支，会给协作者带来麻烦。

### 取消暂存（unstage）

改了两个文件、想分两次提交，却手滑 `git add *` 全暂存了，怎么取消其中一个？`git status` 自己就会提示你：

```console
$ git add *
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)

    renamed:    README.md -> README
    modified:   CONTRIBUTING.md
```

按提示操作（Git 2.23.0 起推荐 `git restore --staged`，老写法是 `git reset HEAD <file>`）：

```console
$ git restore --staged CONTRIBUTING.md
```

`CONTRIBUTING.md` 依然是修改状态，但回到了未暂存区。

> 注：`git reset` 确实可能很危险（尤其带 `--hard` 时），但上面这种用法不碰工作目录里的文件，相对安全。

### 撤销对文件的修改

如果不想要对 `CONTRIBUTING.md` 的改动了，想让它回到上次提交时的样子怎么办？`git status` 同样给出了提示：

```console
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)

    modified:   CONTRIBUTING.md
```

照做（老写法是 `git checkout -- <file>`）：

```console
$ git restore CONTRIBUTING.md
$ git status
On branch master
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)

    renamed:    README.md -> README
```

改动被还原了。

> **重要**：`git restore <file>`（及 `git checkout -- <file>`）是危险命令——你对文件做过的本地修改会**全部丢失**，Git 直接用最近暂存或提交的版本覆盖它。除非百分之百确定不要那些未保存的本地修改，否则不要用。想暂存改动又不想提交？用 Git 提供的 stash 与分支（见下一篇）通常是更好的选择。

最后记住一条规律：**凡是提交（commit）过的东西几乎总能恢复**——被删除分支上的提交、被 `--amend` 覆盖的提交都救得回来；但从未提交过的东西一旦丢了，多半就永远消失了。

---

> **来源**：本文翻译自 Pro Git（第 2 版）第 2 章 "Git Basics"（2.1 Getting a Git Repository、2.2 Recording Changes to the Repository、2.3 Viewing the Commit History、2.4 Undoing Things 四节合译），作者 Scott Chacon、Ben Straub，许可 CC BY-NC-SA 3.0。抓取于 2026-09-13。
