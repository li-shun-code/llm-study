---
title: Shell 脚本入门
source_url: https://missing.csail.mit.edu/2020/shell-tools/
author: Anish Athalye、Jon Gjengset、Jose J. Cambronero（MIT）
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: true
order: 2
group: Linux 与 Shell
---
本讲介绍把 bash 当作脚本语言使用的基础知识，以及一批覆盖命令行日常高频任务的 Shell 工具。

## Shell 脚本

前面我们已经会执行命令并把它们用管道串起来。但很多场景下，你想执行**一串**命令，并使用条件、循环这类控制流。

Shell 脚本是复杂度的下一级。大多数 Shell 都有自己的脚本语言：有变量、控制流和自己的语法。Shell 脚本与其他脚本语言的不同在于：它为"与 Shell 相关的任务"做了优化——创建命令管道、把结果存进文件、从标准输入读取，这些都是 Shell 脚本的一等公民，这让它在这些场景下比通用脚本语言更顺手。本节以最常用的 bash 为例。

在 bash 中给变量赋值用 `foo=bar`，用 `$foo` 访问变量的值。注意 `foo = bar` 是错的——它会被解释为调用 `foo` 程序、参数为 `=` 和 `bar`。Shell 脚本里空格字符会进行参数切分，这一点容易踩坑，写的时候要留心。

bash 中字符串可以用 `'` 和 `"` 两种定界符定义，但二者**不等价**：`'` 定界的是字面字符串，不会替换变量值；`"` 定界的字符串会替换。

```
foo=bar
echo "$foo"
# 打印 bar
echo '$foo'
# 打印 $foo
```

与多数编程语言一样，bash 支持 `if`、`case`、`while`、`for` 等控制流。bash 也有能接收参数、并对参数做处理的函数。下面这个函数会创建目录并 `cd` 进去：

```
mcd () {
    mkdir -p "$1"
    cd "$1"
}
```

其中 `$1` 是脚本/函数的第一个参数。与其他脚本语言不同，bash 用一批特殊变量来指代参数、错误码等，常用的如下（更全的清单见 [TLDP 特殊字符页](https://tldp.org/LDP/abs/html/special-chars.html)）：

- `$0` —— 脚本名
- `$1` 到 `$9` —— 脚本的参数，`$1` 是第一个参数，以此类推
- `$@` —— 全部参数
- `$#` —— 参数个数
- `$?` —— 上一条命令的返回码
- `$$` —— 当前脚本的进程号（PID）
- `!!` —— 完整的上一条命令（含参数）。常见场景：执行命令因缺权限失败，此时 `sudo !!` 即可用 sudo 快速重跑上一条命令
- `$_` —— 上一条命令的最后一个参数。交互式 Shell 里也可以按 `Esc` 再按 `.`（或 `Alt+.`）快速取到

命令通常用 `STDOUT` 输出结果、用 `STDERR` 输出错误，并用**返回码**（return code）以"对脚本友好"的方式报告执行状况。返回码（也叫退出状态，exit status）就是命令之间沟通执行结果的方式：0 通常表示一切正常，非 0 表示出错了。

返回码可以配合 `&&`（与）和 `||`（或）实现条件执行，二者都是[短路](https://en.wikipedia.org/wiki/Short-circuit_evaluation)求值运算符。同一行内也可以用分号 `;` 顺序分隔命令。`true` 程序的返回码恒为 0，`false` 恒为 1。看例子：

```
false || echo "Oops, fail"
# Oops, fail

true || echo "Will not be printed"
#

true && echo "Things went well"
# Things went well

false && echo "Will not be printed"
#

true ; echo "This will always run"
# This will always run

false ; echo "This will always run"
# This will always run
```

另一个常见需求是"把命令的输出取到变量里"，这叫**命令替换**（command substitution）：写下 `$( CMD )` 时，Shell 会执行 `CMD`，并用它的输出替换该处。例如 `for file in $(ls)` 会先执行 `ls` 再逐个遍历结果。一个相对冷门的兄弟特性是**进程替换**（process substitution）：`<( CMD )` 会执行 `CMD`、把输出放进临时文件，并把 `<( )` 替换为该临时文件名。当某命令要求"从文件读"而不是"从 STDIN 读"时非常有用。例如 `diff <(ls foo) <(ls bar)` 会显示 `foo` 与 `bar` 两个目录内容的差异。

信息量有点大，来看一个综合示例。它遍历传入的参数，`grep` 字符串 `foobar`，没找到就把该字符串作为注释追加到文件里：

```
#!/bin/bash

echo "Starting program at $(date)" # 日期会被替换进去

echo "Running program $0 with $# arguments with pid $$"

for file in "$@"; do
    grep foobar "$file" > /dev/null 2> /dev/null
    # 模式未命中时 grep 的退出状态为 1
    # 我们把 STDOUT 和 STDERR 重定向到空设备，因为并不关心它们
    if [[ $? -ne 0 ]]; then
        echo "File $file does not have any foobar, adding one"
        echo "# foobar" >> "$file"
    fi
done
```

上面的比较测试了 `$?` 是否不等于 0。bash 支持很多这类比较，详见 [`test`](https://www.man7.org/linux/man-pages/man1/test.1.html) 手册页。做比较时建议优先用双方括号 `[[ ]]` 而不是单方括号 `[ ]`：出错概率更低，只是不可移植到 `sh`。详细解释见[这里](https://mywiki.wooledge.org/BashFAQ/031)。

启动脚本时常常要传一堆相似参数。bash 对此有便利机制——按模式展开文件名，俗称 Shell 的 **globbing**：

- **通配符（wildcards）**：`?` 匹配一个字符，`*` 匹配任意多个字符。比如有文件 `foo`、`foo1`、`foo2`、`foo10` 和 `bar`，那么 `rm foo?` 会删除 `foo1` 和 `foo2`，而 `rm foo*` 会删除除 `bar` 之外的所有文件。
- **花括号（curly braces）`{}`**：当一批命令共享公共子串时，可以用花括号让 bash 自动展开。移动、转换文件时特别好用。

```
convert image.{png,jpg}
# 会展开为
convert image.png image.jpg

cp /path/to/project/{foo,bar,baz}.sh /newpath
# 会展开为
cp /path/to/project/foo.sh /path/to/project/bar.sh /path/to/project/baz.sh /newpath

# glob 技巧还能组合
mv *{.py,.sh} folder
# 会移动所有 *.py 和 *.sh 文件


mkdir foo bar
# 下面创建 foo/a, foo/b, ... foo/h, bar/a, bar/b, ... bar/h
touch {foo,bar}/{a..h}
touch foo/x bar/y
# 比较 foo 与 bar 两个目录的内容差异
diff <(ls foo) <(ls bar)
# 输出
# < x
# ---
# > y
```

写 bash 脚本有时反直觉，容易出错。[shellcheck](https://github.com/koalaman/shellcheck) 这类工具能帮你找出 sh/bash 脚本里的错误。

另外，脚本并不非得用 bash 写才能从终端调用。例如下面这个 Python 脚本会倒序输出它的参数：

```
#!/usr/local/bin/python
import sys
for arg in reversed(sys.argv[1:]):
    print(arg)
```

内核之所以知道要用 Python 解释器（而不是 Shell）来执行它，是因为脚本开头有一行 [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix))。最佳实践是 shebang 用 [`env`](https://www.man7.org/linux/man-pages/man1/env.1.html) 命令来写：`env` 会解析出该程序在系统中的实际位置，提升脚本的可移植性——它会用到上一讲介绍的 `PATH` 环境变量。本例的 shebang 应写成 `#!/usr/bin/env python`。

Shell 函数与脚本有几点差异要牢记：

- 函数必须与 Shell 同语言，而脚本可以用任何语言写——这正是脚本需要 shebang 的原因。
- 函数在其定义被读取时加载一次；脚本每次执行都要加载。因此函数加载略快，但每次修改后要重新加载定义。
- 函数在当前 Shell 环境中执行，脚本则运行在独立进程中。因此函数可以修改环境变量（比如改变当前目录），脚本不行。用 [`export`](https://www.man7.org/linux/man-pages/man1/export.1p.html) 导出的环境变量会按值传给脚本。
- 与任何语言一样，函数是实现模块化、复用与清晰性的利器；很多 Shell 脚本内部也会定义自己的函数。

## Shell 工具

### 查命令怎么用

你可能好奇 `ls -l`、`mv -i`、`mkdir -p` 这类选项是怎么发现的。拿到一个命令，怎么弄清它是干什么的、有哪些选项？去搜索引擎当然可以，但 UNIX 的诞生远早于 Stack Overflow，系统自带了查询途径。

第一顺位是用 `-h` 或 `--help` 跑一遍命令。更详细的办法是 `man` 命令：它为指定命令提供手册页（manpage）。例如 `man rm` 会输出 `rm` 的行为及全部选项（包括前面提到的 `-i`）。你安装的第三方命令，只要开发者编写并随安装包含了手册页，同样可以用 `man` 查。对基于 ncurses 的交互式工具，帮助通常在程序内用 `:help` 命令或输入 `?` 查看。

有时手册页写得过于详尽，反而难快速找到常用语法。[TLDR pages](https://tldr.sh/) 是极好的补充：它聚焦于给出命令的示例用法，让你迅速确定该用哪些选项。比如 `tar` 和 `ffmpeg`，我查 tldr 页的频率远高于查 manpage。

### 找文件

每个程序员都逃不掉的重复劳动之一就是找文件/目录。所有类 UNIX 系统都自带 [`find`](https://www.man7.org/linux/man-pages/man1/find.1.html)，它可以按条件递归搜索文件。举些例子：

```
# 找所有名为 src 的目录
find . -name src -type d
# 找路径中含 test 文件夹的所有 python 文件
find . -path '*/test/*.py' -type f
# 找最近一天内修改过的所有文件
find . -mtime -1
# 找大小在 500k 到 10M 之间的所有 zip 文件
find . -size +500k -size -10M -name '*.tar.gz'
```

除了列出文件，`find` 还能对匹配的文件执行动作，这对简化重复任务帮助极大：

```
# 删除所有 .tmp 后缀的文件
find . -name '*.tmp' -exec rm {} \;

# 找出所有 PNG 并转换成 JPG
find . -name '*.png' -exec magick {} {}.jpg \;
```

`find` 虽然无处不在，语法却不那么好记。比如想按模式 `PATTERN` 找文件，你得写 `find -name '*PATTERN*'`（忽略大小写则用 `-iname`）。你可以为此建别名，但 Shell 的哲学之一就是多看看替代品——毕竟 Shell 只是"调用程序"而已，任何程序都可以被替换（甚至你自己写一个）。[`fd`](https://github.com/sharkdp/fd) 就是 `find` 的一个简单、快速、友好的替代品：彩色输出、默认正则匹配、Unicode 支持等不错的默认行为，语法也更直观——找 `PATTERN` 只需 `fd PATTERN`。

多数人认可 `find`/`fd` 好用，但也有人担心"每次都现场搜"不如"建索引/数据库快查"。[`locate`](https://www.man7.org/linux/man-pages/man1/locate.1.html) 就是为此而生：它查询一个由 [`updatedb`](https://www.man7.org/linux/man-pages/man1/updatedb.1.html) 维护的数据库，多数系统上 `updatedb` 通过 [`cron`](https://www.man7.org/linux/man-pages/man8/cron.8.html) 每日更新。所以二者的取舍是速度 vs 新鲜度；另外 `find` 还能按大小、修改时间、权限等属性找文件，而 `locate` 只认文件名。更深入的对比见[这里](https://unix.stackexchange.com/questions/60205/locate-vs-find-usage-pros-and-cons-of-each-other)。

### 找代码

按名字找文件很有用，但更常见的诉求是按**内容**找。典型场景：找出所有包含某模式的文件，以及模式在文件中出现的位置。这时用 [`grep`](https://www.man7.org/linux/man-pages/man1/grep.1.html)——一个对输入文本做模式匹配的通用工具。它是极有价值的 Shell 工具，数据整理场景还会细讲。

眼下先记住几个常用选项：`-C` 获取匹配行的上下**C**ontext，`-v` 反**v**转匹配（打印所有**不**匹配的行）。例如 `grep -C 5` 会打印匹配行前后各 5 行。在大量文件里快速搜索时用 `-R`，它会**R**ecursively 进入目录递归查找。

`grep -R` 还有很多可改进之处：忽略 `.git` 目录、多核并行等等。于是出现了不少 grep 替代品：[ack](https://github.com/beyondgrep/ack3)、[ag](https://github.com/ggreer/the_silver_searcher) 和 [rg](https://github.com/BurntSushi/ripgrep)。它们都很出色、功能相仿。我个人固定用 ripgrep（`rg`），又快又直观。一些例子：

```
# 找出所有用到 requests 库的 python 文件
rg -t py 'import requests'
# 找出所有没有 shebang 行的文件（含隐藏文件）
rg -u --files-without-match "^#\!"
# 找出所有 foo 匹配并打印其后 5 行
rg foo -A 5
# 打印匹配统计（匹配的行数与文件数）
rg --stats PATTERN
```

和 `find`/`fd` 一样：重要的是知道这类问题可以用这些工具快速解决，具体用哪个工具反倒不重要。

### 找历史命令

到现在我们都在"找东西"，而你在 Shell 里泡得久了，还会想找回自己某次敲过的命令。首先，按上箭头可以调出上一条命令，持续按则逐步翻阅历史。

`history` 命令能以编程方式访问 Shell 历史，它把历史打印到标准输出。想搜索就接个管道：`history | grep find` 会列出包含子串 "find" 的历史命令。

多数 Shell 里可以用 `Ctrl+R` 对历史做反向搜索：按下后输入想匹配的子串，继续按则在该前缀的历史命中间循环。[zsh](https://github.com/zsh-users/zsh-history-substring-search) 里还能用上下箭头做到这一点。在 `Ctrl+R` 之上再进一步的增强是 [fzf](https://github.com/junegunn/fzf/wiki/Configuring-shell-key-bindings#ctrl-r) 绑定：`fzf` 是通用的模糊查找器，可配合很多命令使用；这里它用来模糊匹配历史并以清晰美观的界面呈现结果。

另一个我特别喜欢的历史相关技巧是**基于历史的自动建议**（history-based autosuggestions）。它最早由 [fish](https://fishshell.com/) Shell 引入：根据你输入的前缀，动态地把最近一条匹配的历史命令以灰色"补全"显示出来。[zsh](https://github.com/zsh-users/zsh-autosuggestions) 中也可开启，是个显著提升幸福感的小功能。

你还可以调整 Shell 历史的行为，比如让"以空格开头"的命令不进历史——适合包含密码或其他敏感信息的命令。做法：`.bashrc` 里加 `HISTCONTROL=ignorespace`，或 `.zshrc` 里加 `setopt HIST_IGNORE_SPACE`。万一忘了加前导空格，也可以手动编辑 `.bash_history`/`.zsh_history` 删掉对应条目。

### 目录导航

前面默认你已经"人在现场"，那怎么快速在目录之间穿梭？简单办法有写 Shell 别名、用 [ln -s](https://www.man7.org/linux/man-pages/man1/ln.1.html) 建软链接等，但开发者们已经造出了更聪明的轮子。

延续本课程"优化常见情形"的思路：想快速跳到"常去/最近去过"的目录，可以用 [`fasd`](https://github.com/clvv/fasd)、[`autojump`](https://github.com/wting/autojump)。Fasd 按 _frecency_（frequency + recency，频率与新鲜度的合成词）对文件与目录排序。默认它提供 `z` 命令，可用某个"常去"目录的子串快速 `cd`：比如你常去 `/home/user/files/cool_project`，那么 `z cool` 即可跳转；用 autojump 的话则是 `j cool`。

想更快了解目录结构全景，有 [`tree`](https://linux.die.net/man/1/tree)、[`broot`](https://github.com/Canop/broot)，甚至完整的终端文件管理器 [`nnn`](https://github.com/jarun/nnn)、[`ranger`](https://github.com/ranger/ranger)。

## 练习

1. 阅读 [`man ls`](https://www.man7.org/linux/man-pages/man1/ls.1.html)，写一条 `ls` 命令，使其按如下方式列出文件：
   - 包含所有文件（含隐藏文件）
   - 大小以人类可读格式显示（如 454M 而不是 454279954）
   - 按修改时间新近度排序
   - 输出带颜色

   参考输出：

   ```
    -rw-r--r--   1 user group 1.1M Jan 14 09:53 baz
    drwxr-xr-x   5 user group  160 Jan 14 09:53 .
    -rw-r--r--   1 user group  514 Jan 14 06:42 bar
    -rw-r--r--   1 user group 106M Jan 13 12:12 foo
    drwx------+ 47 user group 1.5K Jan 12 18:08 ..
   ```

2. 编写 bash 函数 `marco` 和 `polo`：执行 `marco` 时用某种方式保存当前工作目录；此后无论你在哪个目录，执行 `polo` 都应 `cd` 回执行 `marco` 时的目录。为了便于调试，可以先把代码写在 `marco.sh`，再用 `source marco.sh`（重新）加载到 Shell。
3. 假设有一条很少失败的命令，你要调试它就得捕获输出，但等一次失败太费时间。写一个 bash 脚本：反复运行下面的脚本直到它失败为止，把它的标准输出与错误流捕获到文件，最后全部打印出来。能顺便报告第几次运行才失败的话，加分。

   ```
    #!/usr/bin/env bash

    n=$(( RANDOM % 100 ))

    if [[ n -eq 42 ]]; then
       echo "Something went wrong"
       >&2 echo "The error was using magic numbers"
       exit 1
    fi

    echo "Everything went according to plan"
   ```

4. 如本讲所述，`find` 的 `-exec` 对匹配文件执行操作非常强大。但若想对**全部**文件做一件事（比如打一个 zip 包）呢？你已看到，命令既从参数也从 STDIN 拿输入；管道把 STDOUT 接到 STDIN，但 `tar` 这类命令从参数拿输入。弥合这一鸿沟的是 [`xargs`](https://www.man7.org/linux/man-pages/man1/xargs.1.html)：它用 STDIN 的内容当参数来执行命令。例如 `ls | xargs rm` 会删除当前目录下的文件。
   你的任务：写一条命令，递归找出目录下所有 HTML 文件并打成 zip。注意命令要在文件名含空格时也能工作（提示：看 `xargs` 的 `-d`）。

   如果你在 macOS 上，请注意系统默认的 BSD `find` 与 [GNU coreutils](https://en.wikipedia.org/wiki/List_of_GNU_Core_Utilities_commands) 的不同；可在 `find` 上用 `-print0`、在 `xargs` 上用 `-0`。macOS 用户还应知道：系统自带的命令行工具可能与 GNU 版本有差异，想要 GNU 版可通过 [brew 安装 coreutils](https://formulae.brew.sh/formula/coreutils)。
5. （进阶）写一条命令或脚本，递归找出目录中最近修改的文件。更一般地，能按新近度列出全部文件吗？

---

> **来源**：本文翻译自 [Shell Tools and Scripting](https://missing.csail.mit.edu/2020/shell-tools/)，作者 Anish Athalye、Jon Gjengset、Jose J. Cambronero（MIT），许可 CC BY-SA 4.0。抓取于 2026-09-13。
