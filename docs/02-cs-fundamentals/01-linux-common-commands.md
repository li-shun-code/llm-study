---
title: Linux 常用命令：从 Shell 开始
source_url: https://missing.csail.mit.edu/2020/course-shell/
author: Anish Athalye、Jon Gjengset、Jose J. Cambronero（MIT）
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: true
order: 1
---

计算机科学的学生都知道，计算机最擅长帮助人类完成重复性工作。但我们常常忘记：这一点不仅适用于程序要执行的计算，也同样适用于我们**使用计算机**的方式。我们的指尖上有大量现成的工具，可以让任何与计算机相关的工作更高效、能解决更复杂的问题；可大多数人只用到了其中很小的一部分——只会死记硬背几条"咒语"，遇到问题就从网上盲目复制粘贴命令。本讲正是为了解决这个问题。

对后端与 LLM 应用开发者来说，命令行是绕不开的基本功：连接服务器、看日志、管进程、跑脚本，全都要在 Shell 里完成。本篇覆盖 Shell 的基本概念与最常用的一批命令。

## 什么是 Shell？

如今的计算机有各种各样向你下达命令的界面：图形界面（GUI）、语音界面，甚至 AR/VR。它们覆盖了大约 80% 的使用场景，但在能力上有着根本性限制——你不按下不存在的按钮，也无法发出没有被编程实现的语音指令。要充分调用计算机提供的全部工具，就得回到"老派"的文本界面：**Shell**。

几乎所有平台都有某种形式的 Shell，很多平台还提供多种 Shell 供你选择。它们细节上各有差异，核心却大同小异：让你运行程序、给程序输入、并以半结构化的方式查看输出。

本讲聚焦 **Bourne Again SHell**，简称 `bash`。它是使用最广泛的 Shell 之一，语法也与许多其他 Shell 相通。要打开一个 Shell **提示符**（prompt，即你可以输入命令的地方），首先需要一个**终端**（terminal）。你的设备大概率已经预装了终端，没有的话也很容易安装一个。

## 使用 Shell

启动终端后，你会看到类似这样的**提示符**：

```
missing:~$
```

这是 Shell 的主要文本界面。它告诉你：你在 `missing` 这台机器上，当前所在的"**当前工作目录**"（current working directory）是 `~`（home 目录的缩写）。`$` 则说明你不是 root 用户（后面会讲）。在提示符处可以输入**命令**（command），由 Shell 来解释执行。最基本的命令就是执行一个程序：

```
missing:~$ date
Fri 10 Jan 2020 11:49:31 AM EST
missing:~$
```

这里我们执行了 `date` 程序，它（毫不意外地）打印当前日期和时间。随后 Shell 再次等待我们输入下一条命令。命令还可以带**参数**（arguments）：

```
missing:~$ echo hello
hello
```

这里我们让 Shell 执行 `echo` 程序，参数是 `hello`。`echo` 程序会把它的参数原样打印出来。Shell 解析命令时按空白字符切分，然后运行第一个词对应的程序，并把后面的词作为参数传给它。如果参数里含有空格或其他特殊字符（比如名为 "My Photos" 的目录），可以用 `'` 或 `"` 把参数引起来（`"My Photos"`），也可以用 `\` 只转义相关字符（`My\ Photos`）。

那 Shell 是如何找到 `date`、`echo` 这些程序的呢？Shell 本身就是一个编程环境，和 Python、Ruby 一样，有变量、条件、循环和函数（下一讲展开！）。你在 Shell 里运行命令，本质上是在写一小段由 Shell 解释执行的代码。当要执行的命令不是 Shell 的编程关键字时，Shell 会查询一个叫 `$PATH` 的**环境变量**（environment variable），它列出了 Shell 在收到命令时应当搜索哪些目录：

```
missing:~$ echo $PATH
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
missing:~$ which echo
/bin/echo
missing:~$ /bin/echo $PATH
/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

当我们运行 `echo` 时，Shell 依 `$PATH` 中以 `:` 分隔的目录列表逐个查找同名的可执行文件，找到后就运行它（前提是该文件具有**可执行权限**，后文详述）。可以用 `which` 程序查询某个程序名实际对应的文件路径；也可以完全绕开 `$PATH`，直接给出要执行文件的**路径**。

## 在 Shell 中导航

Shell 中的**路径**（path）是一串以分隔符连接的目录：Linux 与 macOS 用 `/`，Windows 用 `\`。在 Linux 和 macOS 上，`/` 是整个文件系统的"**根**"（root），所有目录和文件都在它之下；而 Windows 的每个磁盘分区各有各的根（如 `C:\`）。本文默认你使用的是 Linux 风格的文件系统。

以 `/` 开头的路径叫**绝对路径**（absolute path）；其余都是**相对路径**（relative path），相对于当前工作目录。用 `pwd` 可以查看当前工作目录，用 `cd` 可以切换它。在路径中，`.` 表示当前目录，`..` 表示父目录：

```
missing:~$ pwd
/home/missing
missing:~$ cd /home
missing:/home$ pwd
/home
missing:/home$ cd ..
missing:/$ pwd
/
missing:/$ cd ./home
missing:/home$ pwd
/home
missing:/home$ cd missing
missing:~$ pwd
/home/missing
missing:~$ ../../bin/echo hello
hello
```

注意 Shell 提示符一直在提醒我们当前工作目录是什么。你也可以配置提示符显示各种有用信息，后续再展开。

一般来说，程序运行时的操作对象默认就在当前目录：查找文件在当前目录找，需要新建文件也在当前目录建。

想查看某个目录里有什么，用 `ls` 命令：

```
missing:~$ ls
missing:~$ cd ..
missing:/home$ ls
missing
missing:/home$ cd ..
missing:/$ ls
bin
boot
dev
etc
home
...
```

如果不把目录作为第一个参数给出，`ls` 会打印当前目录的内容。大多数命令都接受以 `-` 开头的**选项**（flags/options，带值的 flag）来改变行为。通常，用 `-h` 或 `--help` 运行程序会打印帮助文本，告诉你有哪些可用选项。例如 `ls --help` 会告诉我们：

```
  -l                         use a long listing format
```

```
missing:~$ ls -l /home
drwxr-xr-x 1 missing  users  4096 Jun 15  2019 missing
```

`-l`（long listing，长格式）给出了每个文件/目录更多的信息。行首的 `d` 表示 `missing` 是一个目录（directory）；随后是三组各三个字符（`rwx`），分别表示**所有者**（`missing`）、**所属组**（`users`）以及**其他人**对该条目拥有的权限，`-` 表示对应主体没有对应权限。上例中，只有所有者可以修改（`w`，write）`missing` 目录（即在其中增删文件）。要进入一个目录，用户必须对该目录（及其各级父目录）拥有"搜索"权限（由"执行"位 `x` 表示）；要列出其内容，则需要读权限（`r`）。对文件而言，这些权限的含义正如字面所示。你会注意到 `/bin` 下几乎所有文件的最后一组权限都带 `x`，所以任何人都能执行这些程序。

此时还值得认识几个趁手的程序：`mv`（重命名/移动文件）、`cp`（复制文件）、`mkdir`（新建目录）。

如果想知道某个程序的参数、输入输出或工作原理的**更多信息**，试试 `man` 程序。它接受程序名作为参数，显示对应的**手册页**（manual page）。按 `q` 退出。

```
missing:~$ man ls
```

## 串联程序

在 Shell 里，每个程序都有两个主要的"**流**"（stream）：输入流和输出流。程序读输入时从输入流读，打印内容时写到输出流。通常，程序的输入输出都是你的终端——键盘作为输入，屏幕作为输出。但这两条流是可以被"重新接线"的！

最简单的重定向是 `< file` 和 `> file`，分别把程序的输入流和输出流接到一个文件上：

```
missing:~$ echo hello > hello.txt
missing:~$ cat hello.txt
hello
missing:~$ cat < hello.txt
hello
missing:~$ cat < hello.txt > hello2.txt
missing:~$ cat hello2.txt
hello
```

上面示例中的 `cat` 是一个"连接"（con**cat**enate）文件的程序：给它文件名作参数时，它按顺序把每个文件的内容打印到输出流；不给参数时，它把输入流的内容打印到输出流（如第三条命令所示）。

还可以用 `>>` 向文件**追加**内容。而输入/输出重定向真正大放异彩的场景是**管道**（pipe）。`|` 操作符可以把多个程序"串"起来，让前一个的输出成为后一个的输入：

```
missing:~$ ls -l / | tail -n1
drwxr-xr-x 1 root  root  4096 Jun 20  2019 var
missing:~$ curl --head --silent google.com | grep --ignore-case content-length | cut --delimiter=' ' -f2
219
```

关于如何充分利用管道，本模块后面的文章还会展开。

## 一个通用而强大的工具

在大多数类 Unix 系统上，有一个特殊的用户：**root 用户**。你在上面的文件列表里已经见过它了。root 用户凌驾于（几乎）一切访问限制之上，可以创建、读取、更新、删除系统中的任何文件。不过你通常不应以 root 身份登录系统——那样太容易误伤。日常请使用 `sudo` 命令：顾名思义，它让你"以 su（super user，超级用户/root）的身份做事"。当你遇到权限不足（permission denied）的错误时，通常就意味着需要以 root 身份执行某个操作——但请先确认你真的想那么做！

一件必须以 root 身份做的事，是向挂载在 `/sys` 下的 `sysfs` 文件系统写入。`sysfs` 把许多内核参数以文件的形式暴露出来，让你无需专门工具就能即时调整内核行为。**注意：Windows 和 macOS 上不存在 sysfs。**

例如，笔记本屏幕的亮度就暴露在 `/sys/class/backlight` 下的一个叫 `brightness` 的文件里。向该文件写入数值即可改变屏幕亮度。你的第一反应可能是：

```
$ sudo find -L /sys/class/backlight -maxdepth 2 -name '*brightness*'
/sys/class/backlight/thinkpad_screen/brightness
$ cd /sys/class/backlight/thinkpad_screen
$ sudo echo 3 > brightness
An error occurred while redirecting file 'brightness'
open: Permission denied
```

这个报错可能让人意外：明明用了 `sudo`！这里有一个关于 Shell 的重要知识点：`|`、`>`、`<` 这类操作是**由 Shell 执行的**，而不是由各个程序执行的。`echo` 之类的程序并不"知道" `|` 的存在，它们只是从自己的输入读、往自己的输出写。在上例中，**Shell**（以你当前用户的身份运行）先尝试打开 brightness 文件准备写入，再把它设为 `sudo echo` 的标准输出——但 Shell 自身不是 root，于是被拒绝了。理解这一点后就能绕过去：

```
$ echo 3 | sudo tee brightness
```

这次是 `tee` 程序以 root 身份去打开 `/sys` 下的文件并写入，权限检查自然就通过了。通过 `/sys` 你还能控制各种有趣且有用的东西，比如系统指示灯的状态（具体路径可能不同）：

```
$ echo 1 | sudo tee /sys/class/leds/input6::scrolllock/brightness
```

## 下一步

到这里，你已经能在 Shell 里完成基本任务：浏览目录、找到关心的文件、使用大多数程序的基本功能。下一篇将介绍如何用 Shell 脚本把更复杂的任务自动化。

## 练习

强烈建议动手尝试：

1. 本课程需要 Bash 或 ZSH 这类 Unix Shell。Linux/macOS 无需额外操作；Windows 用户请不要用 cmd.exe 或 PowerShell，可改用 [Windows Subsystem for Linux](https://learn.microsoft.com/windows/wsl/) 或 Linux 虚拟机。用 `echo $SHELL` 验证，输出形如 `/bin/bash` 或 `/usr/bin/zsh` 即可。
2. 在 `/tmp` 下新建一个名为 `missing` 的目录。
3. 查一查 `touch` 程序的用法。`man` 是你的朋友。
4. 用 `touch` 在 `missing` 目录下新建一个名为 `semester` 的文件。
5. 向该文件逐行写入：

   ```
   #!/bin/sh
   curl --head --silent https://missing.csail.mit.edu
   ```

   第一行可能有点难写对。提示：`#` 在 Bash 中开启注释，而 `!` 即使在双引号字符串中也有特殊含义；单引号字符串（`'`）则按字面处理，用它即可。详见 Bash 的 [quoting 手册](https://www.gnu.org/software/bash/manual/html_node/Quoting.html)。
6. 尝试直接执行该文件：在 Shell 中输入 `./semester` 并回车。结合 `ls` 的输出想想它为什么不行（提示：看权限位）。
7. 显式调用 `sh` 解释器来运行：`sh semester`。为什么这样可以而 `./semester` 不行？
8. 查一查 `chmod` 程序（例如 `man chmod`）。
9. 用 `chmod` 让 `./semester` 可以直接运行，而不必输入 `sh semester`。Shell 是如何知道这个文件要用 `sh` 解释的？参考 [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix)) 一节。
10. 用 `|` 和 `>` 把 `semester` 输出的"最后修改时间"写入家目录下名为 `last-modified.txt` 的文件。
11. 写一条命令，从 `/sys` 读出笔记本电池电量或台式机 CPU 温度。注意：macOS 没有 sysfs，可跳过本练习。

> 译注：本模块下一篇《Shell 脚本入门》对应原课程的第二讲；文中提到的"数据整理"等主题，可按需在 Missing Semester 站点查阅原讲义。

---

> **来源**：本文翻译自 [Course Overview + The Shell](https://missing.csail.mit.edu/2020/course-shell/)，作者 Anish Athalye、Jon Gjengset、Jose J. Cambronero（MIT），许可 CC BY-SA 4.0。抓取于 2026-09-13。
