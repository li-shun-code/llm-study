---
title: 调试入门：pdb 与断点
source_url: https://docs.python.org/zh-cn/3/library/pdb.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-13
translated: false
versions: Python 3.14 文档
order: 21
group: 模块、异常与调试
---
`pdb` 模块为 Python 程序定义了一个交互式源代码调试器。它支持在源代码行级别设置（条件）断点和单步执行、检查栈帧、列出源代码，以及在任意栈帧的上下文中求值任意 Python 代码。它还支持事后调试（post-mortem debugging），并且可以在程序控制下被调用。

调试器是可扩展的——调试器实际被定义为 `Pdb` 类。该类目前没有文档，但通过阅读源码很容易理解它。扩展接口使用了 [`bdb`](https://docs.python.org/zh-cn/3/library/bdb.html) 和 [`cmd`](https://docs.python.org/zh-cn/3/library/cmd.html) 模块。

参见

模块 [`faulthandler`](https://docs.python.org/zh-cn/3/library/faulthandler.html)

用于在发生错误、超时或用户信号时显式地转储 Python 回溯信息。

模块 [`traceback`](https://docs.python.org/zh-cn/3/library/traceback.html)

提取、格式化和打印 Python 程序的栈回溯信息的标准接口。

中断进入调试器的典型用法是插入:

```python
import pdb; pdb.set_trace()
```

或者:

```python
breakpoint()
```

到你想进入调试器的位置，再运行程序。 然后你可以单步执行这条语句之后的代码，并使用 `continue` 命令来关闭调试器继续运行。

```python
def double(x):
   breakpoint()
   return x * 2
val = 3
print(f"{val} * 2 is {double(val)}")
```

调试器的提示符为 `(Pdb)`，这指明你正处于调试模式下:

```plain
> ...(2)double()
-> breakpoint()
(Pdb) p x
3
(Pdb) continue
3 * 2 is 6
```

## 命令行接口

也可以从命令行调用 `pdb` 来调试其他脚本。例如:

```plain
python -m pdb [-c command] (-m module | -p pid | pyfile) [args ...]
```

当作为模块被唤起时，如果被调试的程序异常退出则 pdb 将自动进入事后调试。 在事后调试之后（或程序正常退出之后），pdb 将重启程序。 自动重启会保留 pdb 的状态（如断点）并且在大多数情况下这比在退出程序的同时退出调试器更实用。

`-c, --command <command>`

要以在 `.pdbrc` 文件中所给出形式来执行命令；请参阅 调试器命令。

`-m <module>`

要以类似于 `python -m` 的方式来执行模块。 就像一个脚本那样，调试器将在模块的第一行之前暂停执行。

`-p, --pid <pid>`

附加到具有指定 PID 的进程。

要附加到一个运行中的 Python 进程用于远程调试，请使用 `-p` 或 `--pid` 选项并传入目标进程的 PID:

```plain
python -m pdb -p 1234
```

备注

附加到一个在系统调用中被阻塞或等待I/O的进程上，只有当下一个字节码指令被执行或进程接收到一个信号时才会起作用。

在调试器控制下执行一条语句的典型用法如下:

```plain
>>> import pdb
>>> def f(x):
...     print(1 / x)
>>> pdb.run("f(2)")
> <string>(1)<module>()
(Pdb) continue
0.5
>>>
```

检查已崩溃程序的典型用法是:

```plain
>>> import pdb
>>> def f(x):
...     print(1 / x)
...
>>> f(0)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 2, in f
ZeroDivisionError: division by zero
>>> pdb.pm()
> <stdin>(2)f()
(Pdb) p x
0
(Pdb)
```

本模块定义了下列函数，每个函数进入调试器的方式略有不同：

`pdb.run(statement, globals=None, locals=None)`

在调试器控制范围内执行 _statement_ （以字符串或代码对象的形式提供）。调试器提示符会在执行代码前出现，你可以设置断点并键入 `continue`，也可以使用 `step` 或 `next` 逐步执行语句（上述所有命令在后文有说明）。可选参数 _globals_ 和 _locals_ 指定代码执行环境，默认时使用 [`__main__`](https://docs.python.org/zh-cn/3/library/__main__.html) 模块的字典。（请参阅内置函数 [`exec()`](https://docs.python.org/zh-cn/3/library/functions.html) 或 [`eval()`](https://docs.python.org/zh-cn/3/library/functions.html) 的说明。）

`pdb.runeval(expression, globals=None, locals=None)`

在调试器控制下对 _expression_ (以字符串或代码对象的形式给出) 求值。 当 `runeval()` 返回时，它将返回 _expression_ 的值。 在其他方面此函数与 `run()` 类似。

`pdb.runcall(function, *args, **kwds)`

使用给定的参数调用 _function_ （以函数或方法对象的形式提供，不能是字符串）。`runcall()` 返回的是所调用函数的返回值。调试器提示符将在进入函数后立即出现。

`pdb.set_trace(*, header=None, commands=None)`

在调用本函数的堆栈帧处进入调试器。用于硬编码一个断点到程序中的固定点处，即使该代码不在调试状态（如断言失败时）。如果传入 _header_，它将在调试开始前被打印到控制台。如果传入 _commands_ 参数，则是调试器启动时要执行的命令列表。

*awaitable* `pdb.set_trace_async(*, header=None, commands=None)`

`set_trace()` 的异步版本。 此函数应当在带有 [`await`](https://docs.python.org/zh-cn/3/reference/expressions.html) 的异步函数内部使用。

```python
async def f():
    await pdb.set_trace_async()
```

如果调试器由此函数调用，则支持 [`await`](https://docs.python.org/zh-cn/3/reference/expressions.html) 语句。

`pdb.post_mortem(t=None)`

进入指定异常或 [回溯对象](https://docs.python.org/zh-cn/3/reference/datamodel.html) 的事后调试。 如未指定值，它将使用当前正在处理的异常，或者在找不到时则会引发 `ValueError`。

`pdb.pm()`

进入在 [`sys.last_exc`](https://docs.python.org/zh-cn/3/library/sys.html) 中找到的异常的事后调试。

`pdb.set_default_backend(backend)`

pdb有两个支持的后端: `'settrace'` 和 `'monitoring'`。 详细信息请参见 [`bdb.Bdb`](https://docs.python.org/zh-cn/3/library/bdb.html)。 在实例化 `Pdb` 时，如果没有指定，用户可以设置默认后端使用。 如果未指定后端，则默认为 `'settrace'`。

备注

[`breakpoint()`](https://docs.python.org/zh-cn/3/library/functions.html) 和 `set_trace()` 不会受这个函数影响。 它们始终使用 `'monitoring'` 后端。

`pdb.get_default_backend()`

返回 pdb 的默认后端。

`run*` 函数和 `set_trace()` 都是别名，用于实例化 `Pdb` 类和调用同名方法。如果要使用其他功能，则必须自己执行以下操作：

*class* `pdb.Pdb(completekey='tab', stdin=None, stdout=None, skip=None, nosigint=False, readrc=True, mode=None, backend=None, colorize=False)`

`Pdb` 是调试器类。

_completekey_、_stdin_ 和 _stdout_ 参数都会传递给底层的 [`cmd.Cmd`](https://docs.python.org/zh-cn/3/library/cmd.html) 类，请参考相应的描述。

如果给出 _skip_ 参数，则它必须是一个迭代器，可以迭代出 glob-style 样式的模块名称。如果遇到匹配上述样式的模块，调试器将不会进入来自该模块的堆栈帧。 [1]

默认情况下，当发出 `continue` 命令时，Pdb 将为 SIGINT 信号（信号当用户在控制台按 Ctrl-C 时发出的）设置一个处理器。 这使用户可以通过按 Ctrl-C 再次进入调试器。 如果你希望 Pdb 不要改变 SIGINT 处理器，请将 _nosigint_ 设为真值。

_readrc_ 参数默认为 true，它控制 Pdb 是否从文件系统加载 .pdbrc 文件。

_mode_ 参数指定如何调用调试器。它会影响一些调试器命令的工作。有效值为 `'inline'` (由 breakpoint() 内置函数使用)、`'cli'` (由命令行调用使用) 或 `None` (用于向下兼容行为，如添加 _mode_ 参数之前)。

_backend_ 参数指定调试器使用的后端。如果传递 `None`，则使用默认后端。 参见 `set_default_backend()`。 否则，支持的后端是 `'settrace'` 和 `'monitoring'`。

_colorize_ 参数如果设为 `True`，将在调试器中启用彩色输出，如果支持彩色的话。 这将在 pdb 中高亮显示源代码。

启用跟踪且带有 _skip_ 参数的调用示范:

```python
import pdb; pdb.Pdb(skip=['django.*']).set_trace()
```

引发一个不带参数的 [审计事件](https://docs.python.org/zh-cn/3/library/sys.html) `pdb.Pdb`。

`run(statement, globals=None, locals=None)`

`runeval(expression, globals=None, locals=None)`

`runcall(function, *args, **kwds)`

`set_trace()`

请参阅上文解释同名函数的文档。

## 调试器命令

下方列出的是调试器可接受的命令。如下所示，大多数命令可以缩写为一个或两个字母。如 `h(elp)` 表示可以输入 `h` 或 `help` 来输入帮助命令 (但不能输入 `he` 或 `hel`，也不能是 `H` 或 `Help` 或 `HELP`)。 命令的参数必须用空格（空格符或制表符）分隔。在命令语法中，可选参数括在方括号 (`[]`) 中，使用时请勿输入方括号。命令语法中的选择项由竖线 (`|`) 分隔。

输入一个空白行将重复最后输入的命令。例外：如果最后一个命令是 `list` 命令，则会列出接下来的 11 行。

调试器无法识别的命令将被认为是 Python 语句，并在正在调试的程序的上下文中执行。Python 语句也可以用感叹号 (`!`) 作为前缀。这是检查正在调试的程序的强大方法，甚至可以修改变量或调用函数。当此类语句发生异常，将打印异常名称，但调试器的状态不会改变。

调试器支持 别名。别名可以有参数，使得调试器对被检查的上下文有一定程度的适应性。

在一行中可以输入多条命令，以 `;;` 分隔。 （不能使用单个 `;`，因为它已被用作传给 Python 解析器的一行中的多条命令的分隔符。） 命令切分所用的方式没有任何智能可言；输入总是会在第一个 `;;` 对上被切分，即使它位于带引号的字符串中。 对于带有双分号的字符串可以使用隐式字符串拼接 `';'';'` 或 `";"";"` 来变通处理。

要设置临时全局变量，请使用 _快捷变量_。 _快捷变量_ 是名称以 `$` 打头的变量。 例如，`$foo = 1` 将设置一个全局变量 `$foo` 供你在调试器会话中使用。 _快捷变量_ 会在程序恢复执行时被清空因此它不大可能像使用普通变量如 `foo = 1` 那样影响到你的程序。

有四个预设的 _快捷变量_：

-   `$_frame`: 你正在调试的当前帧
    
-   `$_retval`: 当帧返回时的返回值
    
-   `$_exception`: 当帧引发异常时的异常值
    
-   `$_asynctask`：如果 pdb 在异步函数中停止，则为当前的 asyncio 任务
    

如果文件 `.pdbrc` 存在于用户主目录或当前目录中，则它将以 `'utf-8'` 编码格式被读入并执行，就像是在调试器提示符下被键入一样，不同之处在于空行和以 `#` 开头的行会被忽略。 这对于别名特别有用。 如果两个文件都存在，则会先读取主目录中的文件并且在那里定义的别名可以被本地文件所覆盖。

`h(elp) [command]`

不带参数时，显示可用的命令列表。参数为 _command_ 时，打印有关该命令的帮助。`help pdb` 显示完整文档（即 `pdb` 模块的文档字符串）。由于 _command_ 参数必须是标识符，因此要获取 `!` 的帮助必须输入 `help exec`。

`w(here) [count]`

打印堆栈跟踪，在底部显示最近的帧。如果 _count_ 为0，则打印当前帧条目。 如果 _count_ 为负数，则打印最早的 - _count_ 帧。如果 _count_ 为正数，打印最近的 _count_ 帧。箭头 (`>`) 表示当前帧，它决定了大多数命令的上下文。

`d(own) [count]`

在堆栈回溯中，将当前帧向下移动 _count_ 级（默认为 1 级，移向更新的帧）。

`u(p) [count]`

在堆栈回溯中，将当前帧向上移动 _count_ 级（默认为 1 级，移向更老的帧）。

`b(reak) [([filename:]lineno | function) [, condition]]`

传入 _lineno_ 参数，在当前文件内的第 _lineno_ 行设置中断。 行号数值开头可以带有 _filename_ 加一个冒号，以在另一个文件内指定中断点（可能是尚未载入的文件）。 文件将根据 [`sys.path`](https://docs.python.org/zh-cn/3/library/sys.html) 来搜索。 可接受的 _filename_ 形式有 `/abspath/to/file.py`、 `relpath/file.py`、 `module` 和 `package.module`。

传入 _function_ 参数，在该函数内的第一条可执行语句上设置中断。 _function_ 可以是会在当前命名空间中被求值为一个函数的任意表达式。

如果第二个参数存在，它应该是一个表达式，且它的计算值为 true 时断点才起作用。

如果不带参数执行，将列出所有中断，包括每个断点、命中该断点的次数、当前的忽略次数以及关联的条件（如果有）。

每个中断点将被分配一个数值供所有其他中断点命令引用。

`tbreak [([filename:]lineno | function) [, condition]]`

临时断点，在第一次命中时会自动删除。它的参数与 `break` 相同。

`cl(ear) [filename:lineno | bpnumber ...]`

如果参数是 _filename:lineno_，则清除此行上的所有断点。如果参数是空格分隔的断点编号列表，则清除这些断点。如果不带参数，则清除所有断点（但会先提示确认）。

`disable bpnumber [bpnumber ...]`

禁用断点，断点以空格分隔的断点编号列表给出。禁用断点表示它不会导致程序停止执行，但是与清除断点不同，禁用的断点将保留在断点列表中并且可以（重新）启用。

`enable bpnumber [bpnumber ...]`

启用指定的断点。

`ignore bpnumber [count]`

为指定的断点编号设置忽略次数。 如果省略 _count_，则忽略次数将设置为 0。 当忽略次数为零时断点将变为活动状态。 如果为非零值，则在每次到达断点且断点未禁用且关联条件取真值时 _count_ 就会递减。

`condition bpnumber [condition]`

为断点设置一个新 _condition_，它是一个表达式，且它的计算值为 true 时断点才起作用。如果没有给出 _condition_，则删除现有条件，也就是将断点设为无条件。

`commands [bpnumber]`

为编号是 _bpnumber_ 的断点指定一系列命令。命令内容将显示在后续的几行中。输入仅包含 `end` 的行来结束命令列表。举个例子:

```plain
(Pdb) commands 1
(com) p some_variable
(com) end
(Pdb)
```

要删除断点上的所有命令，请输入 `commands` 并立即以 `end` 结尾，也就是不指定任何命令。

如果不带 _bpnumber_ 参数，`commands` 作用于最后一个被设置的断点。

可以为断点指定命令来重新启动程序。只需使用 `continue` 或 `step` 命令或其他可以继续运行程序的命令。

如果指定了某个继续运行程序的命令（目前包括 `continue`、 `step`、 `next`、 `return`、`until`、 `jump`、 `quit` 及它们的缩写）将终止命令列表（就像该命令后紧跟着 end）。因为在任何时候继续运行下去（即使是简单的 next 或 step），都可能会遇到另一个断点，该断点可能具有自己的命令列表，这导致要执行的列表含糊不清。

如果命令列表中包含 `silent` 命令或恢复执行的命令，则不显示包含帧信息的断点消息。

`s(tep)`

运行当前行，在第一个可以停止的位置（在被调用的函数内部或在当前函数的下一行）停下。

`n(ext)`

继续运行，直到运行到当前函数的下一行，或当前函数返回为止。（ `next` 和 `step` 之间的区别在于，`step` 进入被调用函数内部并停止，而 `next` （几乎）全速运行被调用函数，仅在当前函数的下一行停止。）

`unt(il) [lineno]`

如果不带参数，则继续运行，直到行号比当前行大时停止。

如果带有 _lineno_，则继续执行直至行号大于或等于 _lineno_。 在这两种情况下，在当前帧返回时也将停止。

`r(eturn)`

继续运行，直到当前函数返回。

`c(ont(inue))`

继续运行，仅在遇到断点时停止。

`j(ump) lineno`

设置即将运行的下一行。仅可用于堆栈最底部的帧。它可以往回跳来再次运行代码，也可以往前跳来跳过不想运行的代码。

需要注意的是，不是所有的跳转都是允许的 -- 例如，不能跳转到 [`for`](https://docs.python.org/zh-cn/3/reference/compound_stmts.html) 循环的中间或跳出 [`finally`](https://docs.python.org/zh-cn/3/reference/compound_stmts.html) 子句。

`l(ist) [first[, last]]`

列出当前文件的源代码。如果不带参数，则列出当前行周围的 11 行，或延续前一次列出。如果用 `.` 作为参数，则列出当前行周围的 11 行。如果带有一个参数，则列出那一行周围的 11 行。如果带有两个参数，则列出所给的范围中的代码；如果第二个参数小于第一个参数，则将其解释为列出行数的计数。

当前帧中的当前行用 `->` 标记。如果正在调试异常，且最早抛出或传递该异常的行不是当前行，则那一行用 `>>` 标记。

`ll | longlist`

列出当前函数或帧的所有源代码。相关行的标记与 `list` 相同。

`a(rgs)`

打印当前函数的参数及其当前的值。

`p expression`

在当前上下文中对 _expression_ 求值并打印该值。

备注

`print()` 也可以使用，但它不是一个调试器命令 --- 它执行 Python [`print()`](https://docs.python.org/zh-cn/3/library/functions.html) 函数。

`pp expression`

与 `p` 命令类似，但 _expression_ 的值将使用 [`pprint`](https://docs.python.org/zh-cn/3/library/pprint.html) 模块美观地打印。

`whatis expression`

打印 _expression_ 的类型。

`source expression`

尝试获取 _expression_ 的源代码并显示它。

`display [expression]`

每次在当前帧中停止执行时，如果 _expression_ 的值发生了变化则显示该值。

如果不带 _expression_，则列出当前帧的所有显示表达式。

备注

显示 _expression_ 的值并与 _expression_ 之前的求值结果进行比较，因此当结果可变时，显示可能无法体现变化。

示例:

```python
lst = []
breakpoint()
pass
lst.append(1)
print(lst)
```

显示将不会发现 `lst` 已被改变因为求值结果在执行比较之前已被 `lst.append(1)` 原地修改了:

```plain
> example.py(3)<module>()
-> pass
(Pdb) display lst
display lst: []
(Pdb) n
> example.py(4)<module>()
-> lst.append(1)
(Pdb) n
> example.py(5)<module>()
-> print(lst)
(Pdb)
```

你可以通过拷贝机制巧妙地实现此功能:

```plain
> example.py(3)<module>()
-> pass
(Pdb) display lst[:]
display lst[:]: []
(Pdb) n
> example.py(4)<module>()
-> lst.append(1)
(Pdb) n
> example.py(5)<module>()
-> print(lst)
display lst[:]: [1]  [old: []]
(Pdb)
```

`undisplay [expression]`

不再显示当前帧中的 _expression_。 如果不带 _expression_，则清除当前帧的所有显示表达式。

`interact`

在根据当前作用域的局部和全局命名空间初始化的新建全局命名空间中启动一个交互式解释器 (使用 [`code`](https://docs.python.org/zh-cn/3/library/code.html) 模块)。 使用 `exit()` 或 `quit()` 退出解释器并返回调试器。

备注

由于 `interact` 为代码执行创建了一个新的专用命名空间，对变量的赋值将不会影响原始命名空间。 不过，对任何被引用的可变对象的修改都将照常在原始命名空间中反映出来。

`alias [name [command]]`

创建一个名为 _name_ 的别名用来执行 _command_。 _command_ 的两边 _不可_ 用引号括起来。 可替换形参可以通过 `%1`, `%2` ... 和 `%9` 等来指明，而 `%*` 将被所有这些形参替换。 如果省略 _command_，则将显示 _name_ 的当前别名。 如未给出任何参数，则将列出所有别名。

别名允许嵌套并可包含能在 pdb 提示符下合法输入的任何内容。 请注意内部 pdb 命令 _可以_ 被别名所覆盖。 这样的命令将被隐藏直到别名被移除。 别名会递归地应用到命令行的第一个单词；行内的其他单词不会受影响。

作为示例，这里列出了两个有用的别名（特别适合放在 `.pdbrc` 文件中）:

```plain
# 打印实例变量 (用法 "pi classInst")
alias pi for k in %1.__dict__.keys(): print(f"%1.{k} = {%1.__dict__[k]}")
# 打印 self 中的实例变量
alias ps pi self
```

`unalias name`

删除指定的别名 _name_。

`! statement`

在当前栈帧的上下文中执行 (单行的) _statement_。 感叹号可以被省略，除非语句的第一个单词与某个调试器命令重名，例如:

```plain
(Pdb) ! n=42
(Pdb)
```

要设置全局变量，你可以在同一行上在赋值命令前添加 [`global`](https://docs.python.org/zh-cn/3/reference/simple_stmts.html) 语句，例如:

```plain
(Pdb) global list_options; list_options = ['-l']
(Pdb)
```

`run [args ...]`

`restart [args ...]`

重启被调试的 Python 程序。 如果提供了 _args_，它会用 [`shlex`](https://docs.python.org/zh-cn/3/library/shlex.html) 来拆分且拆分结果将被用作新的 [`sys.argv`](https://docs.python.org/zh-cn/3/library/sys.html)。 历史、中断点、动作和调试器选项将被保留。 `restart` 是 `run` 的一个别名。

`q(uit)`

退出调试器。 被执行的程序将被中止。输入文件结束符相当于 `quit`。

如果调试器以 `'inline'` 模式调用，将显示一个确认提示符。`y`、`Y`、`<Enter>` 或 `EOF` 都将确认退出。

`debug code`

进入一个对 _code_ 执行步进的递归调试器（该参数是在当前环境中执行的任意表达式或语句）。

`retval`

打印当前函数最后一次返回的返回值。

`exceptions [excnumber]`

列出串连的异常或在其间跳转。

当将 `pdb.pm()` 或 `Pdb.post_mortem(...)` 用于串连的异常而不是回溯数据时，它允许用户使用 `exceptions` 命令在串连的异常间移动以列出异常，并使用 `exceptions <number>` 来切换到该异常。

示例:

```python
def out():
    try:
        middle()
    except Exception as e:
        raise ValueError("reraise middle() error") from e

def middle():
    try:
        return inner(0)
    except Exception as e:
        raise ValueError("Middle fail")

def inner(x):
    1 / x

out()
```

调用 `pdb.pm()` 将允许在异常之间移动:

```plain
> example.py(5)out()
-> raise ValueError("reraise middle() error") from e

(Pdb) exceptions
  0 ZeroDivisionError('division by zero')
  1 ValueError('Middle fail')
> 2 ValueError('reraise middle() error')

(Pdb) exceptions 0
> example.py(16)inner()
-> 1 / x

(Pdb) up
> example.py(10)middle()
-> return inner(0)
```

备注

[1]

一个帧是否会被认为源自特定模块是由帧全局变量 `__name__` 来决定的。

## 补充：内置函数 `breakpoint()`

> **补充**：以下内容选自 [Python 官方文档 · 内置函数 `breakpoint()`](https://docs.python.org/zh-cn/3/library/functions.html#breakpoint)，作者与许可同上。

此函数会在调用位置进入调试器。具体来说，它将调用 [`sys.breakpointhook()`](https://docs.python.org/zh-cn/3/library/sys.html)，直接传递 `args` 和 `kws`。在默认情况下，`sys.breakpointhook()` 将不带参数地调用 [`pdb.set_trace()`](https://docs.python.org/zh-cn/3/library/pdb.html)。 在此情况下，它纯粹是一个便捷函数让你不必显式地导入 [`pdb`](https://docs.python.org/zh-cn/3/library/pdb.html) 或键入过多代码即可进入调试器。 不过，`sys.breakpointhook()` 也可被设置为某些其他函数并被 `breakpoint()` 自动调用，允许你进入选定的调试器。如果 `sys.breakpointhook()` 不可用，此函数将引发 [`RuntimeError`](https://docs.python.org/zh-cn/3/library/exceptions.html).

在默认情况下，`breakpoint()` 的行为可使用 [`PYTHONBREAKPOINT`](https://docs.python.org/zh-cn/3/using/cmdline.html) 环境变量来改变。请参阅 [`sys.breakpointhook()`](https://docs.python.org/zh-cn/3/library/sys.html) 了解详细用法。

请注意如果 [`sys.breakpointhook()`](https://docs.python.org/zh-cn/3/library/sys.html) 已被替换，则上述行为不一定有效。

引发一个 [审计事件](https://docs.python.org/zh-cn/3/library/sys.html) `builtins.breakpoint` 并附带参数 `breakpointhook`.



---

> **来源**：本文转载自 [pdb --- The Python Debugger - Python 3 官方文档（中文）](https://docs.python.org/zh-cn/3/library/pdb.html)，作者 Python Software Foundation，许可 PSF 许可证第 2 版（转载署名）。抓取于 2026-09-13。原文为官方中文译文，本站仅做格式转换。
