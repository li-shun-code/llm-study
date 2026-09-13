---
title: 环境搭建与第一个程序
source_url: https://liaoxuefeng.com/books/python/install/index.html
author: 廖雪峰
license: © 廖雪峰（转载署名）
fetched_at: 2026-09-13
translated: false
order: 1
versions: Python 3.13+
---

因为Python是跨平台的，它可以运行在Windows、Mac和各种Linux/Unix系统上。在Windows上写Python程序，放到Linux上也是能够运行的。

要开始学习Python编程，首先就得把Python安装到你的电脑里。安装后，你会得到Python解释器（就是负责运行Python程序的），一个命令行交互环境，还有一个简单的集成开发环境。

### 安装 Python 3

Python 曾经存在 2.x 与 3.x 两个互不兼容的版本系列，Python 2 已于 2020 年正式停止维护。本教程以最新的 Python 3.x 为基础。请确保你的电脑上安装的是最新的 Python 3.x（截至 2026 年为 3.13+），这样，你才能无痛学习这个教程。

### 在Windows上安装Python

在Windows上安装Python，有两种方法。

方法一，可以直接从Python的官方网站下载Python 3对应的[Windows安装程序](https://www.python.org/downloads/windows/)，推荐下载`Windows installer (64-bit)`，然后，运行下载的`python-3.x-amd64.exe`安装包：

![install-py3](https://liaoxuefeng.com/books/python/install/win-version.png)

特别要注意勾上`Add Python 3.x to PATH`，然后点"Install Now"即可完成安装。

方法二，先安装一个包管理器，推荐[Scoop](https://scoop.sh/)，然后在PowerShell中通过以下命令安装Python：

```plain
C:\> scoop install python
```

### 在macOS上安装Python

如果你正在使用Mac，那么系统自带的Python版本是2.x。要安装最新的Python 3.x，有两个方法：

方法一：从Python官网下载Python 3 macOS版的[安装程序](https://www.python.org/downloads/macos/)，下载后双击运行并安装；

方法二：如果安装了包管理器[Homebrew](https://brew.sh/)，直接通过命令`brew install python3`安装即可。

### 在Linux上安装Python

如果你正在使用Linux，那我可以假定你有Linux系统管理经验，自行安装Python 3应该没有问题，否则，请换回Windows系统。

对于大量的目前仍在使用Windows的同学，如果短期内没有打算换Mac，就可以继续阅读以下内容。

### 运行Python

> 注意：Python在Linux/macOS的命令是`python3`，在Windows下的命令是`python`，后续请自行根据操作系统选择合适的命令。

安装成功后，打开命令行窗口（Windows下打开PowerShell），敲入`python`后，会出现两种情况：

情况一：

```plain
PS C:\Users\liaoxuefeng> python
Python 3.13 ...
Type "help", "copyright", "credits" or "license" for ...
>>> _
```

看到类似`Python 3.x`的输出，就说明Python安装成功！

看到提示符变为`>>>`就表示我们已经在Python交互式环境中了，可以输入任何Python代码，回车后会立刻得到执行结果。现在，输入`exit()`并回车，就可以退出Python交互式环境（直接关掉命令行窗口也可以）。

情况二：得到一个错误："无法将"python"项识别为 cmdlet、函数、脚本文件或可运行程序的名称。"：

```plain
PS C:\Users\liaoxuefeng> python
python : The term 'python' is not recognized as ...
    + FullyQualifiedErrorId : CommandNotFoundException
```

这是因为Windows会根据一个`Path`的环境变量设定的路径去查找`python.exe`，如果没找到，就会报错。如果在安装时漏掉了勾选`Add Python 3.x to PATH`，那就要手动把`python.exe`所在的路径添加到Path中。

如果你不知道怎么修改环境变量，建议把Python安装程序重新运行一遍，务必记得勾上`Add Python 3.x to PATH`。

### 小结

学会如何把Python安装到计算机中，并且熟练打开和退出Python交互式环境；

在Windows上运行Python时，请先启动PowerShell命令行，然后运行`python`；

在macOS和Linux上运行Python时，请打开终端，然后运行`python3`；

退出Python交互式环境，需要在提示符`>>>`下输入`exit()`并回车确认。

---

> **补充**：以下内容节选自同书 [第一个Python程序 - Python教程](https://liaoxuefeng.com/books/python/first-program/index.html)，作者与许可同上。

在交互模式的提示符`>>>`下，直接输入代码，按回车，就可以立刻得到代码执行结果。现在，试试输入`100+200`，看看计算结果是不是300：

```plain
>>> 100+200
300
```

很简单吧，任何有效的数学计算都可以算出来。

如果要让Python打印出指定的文字，可以用`print()`函数，然后把希望打印的文字用单引号或者双引号括起来，但不能混用单引号和双引号：

```plain
>>> print('hello, world')
hello, world
```

这种用单引号或者双引号括起来的文本在程序中叫字符串，今后我们还会经常遇到。

最后，用`exit()`退出Python，我们的第一个Python程序完成！唯一的缺憾是没有保存下来，下次运行时还要再输入一遍代码。

请注意区分命令行模式和Python交互模式。

在命令行模式下，可以执行`python`进入Python交互式环境，也可以执行`python hello.py`运行一个`.py`文件。

执行一个`.py`文件只能在命令行模式执行。如果敲一个命令`python hello.py`，看到如下错误：

```plain
PS C:\Users\liaoxuefeng> python hello.py
python: can't open file 'hello.py': [Errno 2] No such
file or directory
```

错误提示`No such file or directory`说明这个`hello.py`在当前目录下找不到，必须先把当前目录切换到`hello.py`所在的目录下，才能正常执行：

```plain
PS C:\Users\liaoxuefeng> cd work
PS C:\Users\liaoxuefeng\work> python hello.py
Hello, world!
```

---

> **来源**：本文转载自 [安装Python - Python教程](https://liaoxuefeng.com/books/python/install/index.html)，作者 廖雪峰，许可 © 廖雪峰（转载署名）。抓取于 2026-09-13。
