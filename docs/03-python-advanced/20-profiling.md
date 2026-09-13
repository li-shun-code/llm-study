---
title: 性能分析：profile/cProfile 与 py-spy
source_url: https://docs.python.org/zh-cn/3/library/profile.html
author: Python 软件基金会（PSF）；Ben Frederickson（py-spy）
license: PSF 许可证第 2 版；MIT 许可证（py-spy）
fetched_at: 2026-09-13
translated: true
order: 20
versions: Python 3.14 官方文档；py-spy 当前版
---

*编者导读：本篇由两部分完整翻译而成：Python 官方《[The Python Profilers](https://docs.python.org/zh-cn/3/library/profile.html)》页（`profile`/`cProfile`/`pstats`，确定性性能分析）与 py-spy 项目 [README](https://github.com/benfred/py-spy)（采样式性能分析，适合生产环境）。官方中文页部分句子在 zh-cn 文档中仍为英文，本篇已一并译出。*

# Python 性能分析器（The Python Profilers）

**源代码：** [Lib/profile.py](https://github.com/python/cpython/tree/3.14/Lib/profile.py) 与 [Lib/pstats.py](https://github.com/python/cpython/tree/3.14/Lib/pstats.py)

## 性能分析器简介

`cProfile` 和 `profile` 提供 Python 程序的_确定性性能分析_。_profile（性能画像）_是一组统计信息，描述程序的各个部分执行的频率和时长。这些统计数据可以通过 `pstats` 模块格式化为报告。

Python 标准库提供同一性能分析接口的两种不同实现：

1. 推荐大多数用户使用 `cProfile`；它是一个 C 扩展，开销合理，适合分析长时间运行的程序。基于 Brett Rosen 和 Ted Czotter 贡献的 `lsprof`。

2. `profile` 是一个纯 Python 模块，其接口被 `cProfile` 模仿，但会给被分析程序增加显著开销。如果你想以某种方式扩展性能分析器，用这个模块可能更容易。最初由 Jim Roskind 设计和编写。

> **注**：性能分析器模块旨在为给定程序提供执行画像，而不是用于基准测试（基准测试应使用 `timeit` 以获得合理准确的结果）。这一点尤其适用于把 Python 代码与 C 代码做基准比较：性能分析器会给 Python 代码引入开销，但不会给 C 级函数引入，因此 C 代码会显得比任何 Python 代码都快。

## 快速用户手册

本节为"不想读手册"的用户提供。它给出非常简短的概览，让你能快速对现有应用进行性能分析。

要分析一个只接受单个参数的函数，可以：

```python
import cProfile
import re
cProfile.run('re.compile("foo|bar")')
```

（若系统上没有 `cProfile`，用 `profile` 代替。）

上述操作会运行 `re.compile()` 并打印类似如下的分析结果：

```text
      214 function calls (207 primitive calls) in 0.002 seconds

Ordered by: cumulative time

ncalls  tottime  percall  cumtime  percall filename:lineno(function)
     1    0.000    0.000    0.002    0.002 {built-in method builtins.exec}
     1    0.000    0.000    0.001    0.001 <string>:1(<module>)
     1    0.000    0.000    0.001    0.001 __init__.py:250(compile)
     1    0.000    0.000    0.001    0.001 __init__.py:289(_compile)
     1    0.000    0.000    0.000    0.000 _compiler.py:759(compile)
     1    0.000    0.000    0.000    0.000 _parser.py:937(parse)
     1    0.000    0.000    0.000    0.000 _compiler.py:598(_code)
     1    0.000    0.000    0.000    0.000 _parser.py:435(_parse_sub)
```

第一行说明监控到 214 次调用，其中 207 次是_原始_（primitive）的，即该调用不是由递归引发的。下一行 `Ordered by: cumulative time` 表示输出按 `cumtime` 值排序。列标题包括：

**ncalls**：调用次数。

**tottime**：在指定函数中花费的总时间（不包括调用子函数的时间）。

**percall**：`tottime` 除以 `ncalls` 的商。

**cumtime**：在这个函数及其所有子函数中花费的累积时间（从调用到退出）。这个数字对递归函数也_准确_。

**percall**：`cumtime` 除以原始调用数的商。

**filename:lineno(function)**：提供每个函数的相应数据。

当第一列有两个数字时（例如 `3/1`），表示该函数发生了递归。第二个值是原始调用数，前者是总调用数。注意：函数不递归时这两个值相同，只打印单个数字。

除了在分析运行结束时打印输出，还可以向 `run()` 函数指定文件名，把结果保存到文件：

```python
import cProfile
import re
cProfile.run('re.compile("foo|bar")', 'restats')
```

`pstats.Stats` 类从文件读取分析结果并以各种方式格式化它们。

`cProfile` 和 `profile` 文件也可以作为脚本调用，分析另一个脚本。例如：

```text
python -m cProfile [-o output_file] [-s sort_order] (-m module | myscript.py)
```

**`-o <output_file>`**：把分析结果写入文件而不是 stdout。

**`-s <sort_order>`**：指定 `sort_stats()` 的某个排序值来排序输出。仅在未提供 `-o` 时适用。

**`-m <module>`**：指定被分析的是模块而非脚本。（`cProfile` 的 `-m` 选项为 3.7 新增；`profile` 的为 3.8 新增。）

`pstats` 模块的 `Stats` 类有多种方法，可操纵并打印保存进分析结果文件的数据：

```python
import pstats
from pstats import SortKey
p = pstats.Stats('restats')
p.strip_dirs().sort_stats(-1).print_stats()
```

`strip_dirs()` 方法去掉了所有模块名中多余的路径；`sort_stats()` 方法按打印时使用的标准"模块/行/名称"字符串给所有条目排序；`print_stats()` 方法打印全部统计。你可以尝试以下排序调用：

```python
p.sort_stats(SortKey.NAME)
p.print_stats()
```

第一个调用实际按函数名排序，第二个调用打印统计。以下是一些值得试验的有趣调用：

```python
p.sort_stats(SortKey.CUMULATIVE).print_stats(10)
```

这会按函数内的累积时间排序，然后只打印最重要的十行。想弄清哪些算法在耗时，就用这一行。

想看哪些函数循环多、耗时长，则：

```python
p.sort_stats(SortKey.TIME).print_stats(10)
```

按每个函数内部花费的时间排序，打印前十名的统计。

还可以试：

```python
p.sort_stats(SortKey.FILENAME).print_stats('__init__')
```

按文件名排序全部统计，然后只打印类初始化方法的统计（因为它们的名字里含 `__init__`）。最后一个例子：

```python
p.sort_stats(SortKey.TIME, SortKey.CUMULATIVE).print_stats(.5, 'init')
```

这一行以时间为主键、累积时间为次键排序统计，然后打印部分统计。具体来说：列表先被裁剪到原大小的 50%（即 `.5`），再只保留包含 `init` 的行，然后打印这个子集。

如果你想知道是哪些函数调用了上述函数，可以（`p` 仍按上一个条件排序）执行：

```python
p.print_callers(.5, 'init')
```

就能得到所列函数各自的调用者列表。

想要更多功能，就得读手册了，或者猜猜下面的函数是干什么的：

```python
p.print_callees()
p.add('restats')
```

作为脚本调用时，`pstats` 模块是一个统计浏览器，用于读取和检视性能分析转储。它有简单的面向行的界面（用 `cmd` 实现）和交互式帮助。

## `profile` 与 `cProfile` 模块参考

`profile` 与 `cProfile` 模块都提供以下函数：

**profile.run(_command_, _filename=None_, _sort=-1_)**

此函数接受一个可传给 `exec()` 函数的单独参数，以及一个可选的文件名。在所有情况下这个例程都会执行：

```python
exec(command, __main__.__dict__, __main__.__dict__)
```

并收集执行过程中的性能分析统计数据。如果未提供文件名，则此函数会自动创建一个 `Stats` 实例并打印一个简单的性能分析报告。如果指定了 sort 值，则它会被传递给这个 `Stats` 实例以控制结果的排序方式。

**profile.runctx(_command_, _globals_, _locals_, _filename=None_, _sort=-1_)**

此函数类似于 `run()`，带有为 command 字符串提供 globals 和 locals 映射对象的附加参数。这个例程会执行：

```python
exec(command, globals, locals)
```

并像在上述的 `run()` 函数中一样收集性能分析数据。

**profile.Profile(_timer=None_, _timeunit=0.0_, _subcalls=True_, _builtins=True_)**

这个类通常只在需要比 `cProfile.run()` 函数提供的更精确的分析控制时使用。

可以通过 _timer_ 参数提供一个自定义计时器来测量代码运行花费了多长时间。它必须是一个返回代表当前时间的单个数字的函数。如果该数字为整数，则 _timeunit_ 指定一个表示每个时间单位持续时间的乘数。例如，如果定时器返回以千秒为计量单位的时间值，则时间单位将为 `.001`。

直接使用 `Profile` 类将允许格式化性能分析结果而无需将性能分析数据写入到文件：

```python
import cProfile, pstats, io
from pstats import SortKey
pr = cProfile.Profile()
pr.enable()
# ... do something ...
pr.disable()
s = io.StringIO()
sortby = SortKey.CUMULATIVE
ps = pstats.Stats(pr, stream=s).sort_stats(sortby)
ps.print_stats()
print(s.getvalue())
```

`Profile` 类还可以作为上下文管理器使用（仅在 `cProfile` 模块中受支持，见上下文管理器类型）：

```python
import cProfile

with cProfile.Profile() as pr:
    # ... do something ...

    pr.print_stats()
```

（在 3.8 版本发生变更：添加了上下文管理器支持。）

**enable()**：开始收集分析数据。仅 `cProfile` 支持。

**disable()**：停止收集分析数据。仅 `cProfile` 支持。

**create_stats()**：停止收集分析数据，并在内部将结果记录为当前 profile。

**print_stats(_sort=-1_)**：根据当前性能分析数据创建一个 `Stats` 对象并将结果打印到 stdout。_sort_ 参数指定显示统计的排序方式，接受单个键或键元组以实现多级排序（如 `Stats.sort_stats`）。（3.13 新增：`print_stats()` 现在可接受键元组。）

**dump_stats(_filename_)**：将当前 profile 的结果写入 _filename_。

**run(_cmd_)**：通过 `exec()` 对该命令进行性能分析。

**runctx(_cmd_, _globals_, _locals_)**：通过 `exec()` 并附带指定的全局和局部环境对该命令进行性能分析。

**runcall(_func_, _/_, _*args_, _**kwargs_)**：对 `func(*args, **kwargs)` 进行性能分析。

请注意性能分析只有在被调用的命令/函数确实能返回时才可用。如果解释器被终结（例如在被调用的命令/函数执行期间通过 `sys.exit()` 调用）则将不会打印性能分析结果。

## `Stats` 类

使用 `Stats` 类来分析性能分析器的数据。

**pstats.Stats(_*filenames or profile_, _stream=sys.stdout_)**

这个类构造器从 _filename_（或文件名列表）或 `Profile` 实例创建"统计对象"实例。输出将打印到 _stream_ 指定的流。

上述构造器选择的文件必须由对应版本的 `profile` 或 `cProfile` 创建。具体来说，_不_保证与该性能分析器未来版本的文件兼容性，也不与由其他性能分析器或同一性能分析器在不同操作系统上产生的文件兼容。如果提供多个文件，相同函数的所有统计会合并，从而能在单一报告中呈现多个进程的整体视图。如果需要把额外的文件合并进现有 `Stats` 对象的数据，可用 `add()` 方法。

也可以不读文件，而把 `cProfile.Profile` 或 `profile.Profile` 对象作为分析数据源。

`Stats` 对象有以下方法：

**strip_dirs()**：此方法从文件名中移除所有前导路径信息，对把打印输出压缩到 80 列以内非常有用。此方法会修改对象，被裁剪的信息会丢失。执行 strip 后，对象内的条目被视为处于"随机"顺序（与对象初始化加载后相同）。如果 `strip_dirs()` 使两个函数名不可区分（同一文件同一行且同名），这两个条目的统计会合并为一条。

**add(_*filenames_)**：此方法把额外的性能分析信息累积进当前对象。参数应是 `profile.run()` 或 `cProfile.run()` 对应版本创建的文件名。名称相同（文件、行、名称一致）的函数统计会自动累积成单条。

**dump_stats(_filename_)**：把载入 `Stats` 对象的数据保存到名为 _filename_ 的文件。文件不存在则创建，已存在则覆盖。等价于 `profile.Profile` 与 `cProfile.Profile` 类的同名方法。

**sort_stats(_*keys_)**：此方法按给定标准给 `Stats` 对象排序。参数可以是字符串或 SortKey 枚举，标识排序依据（如 `'time'`、`'name'`、`SortKey.TIME`、`SortKey.NAME`）。SortKey 枚举参数比字符串更稳健、更不易出错。

提供多个键时，后续键在前面所有键相等时作为次要标准。例如 `sort_stats(SortKey.NAME, SortKey.FILE)` 按函数名排序所有条目，对同名的再按文件名排序。

字符串参数可以用缩写，只要无歧义。合法的字符串与 SortKey 对应如下：

| 合法字符串参数 | 合法枚举参数 | 含义 |
| --- | --- | --- |
| `'calls'` | SortKey.CALLS | 调用次数 |
| `'cumulative'` | SortKey.CUMULATIVE | 累积时间 |
| `'cumtime'` | N/A | 累积时间 |
| `'file'` | N/A | 文件名 |
| `'filename'` | SortKey.FILENAME | 文件名 |
| `'module'` | N/A | 文件名 |
| `'ncalls'` | N/A | 调用次数 |
| `'pcalls'` | SortKey.PCALLS | 原始调用次数 |
| `'line'` | SortKey.LINE | 行号 |
| `'name'` | SortKey.NAME | 函数名 |
| `'nfl'` | SortKey.NFL | 名称/文件/行 |
| `'stdname'` | SortKey.STDNAME | 标准名 |
| `'time'` | SortKey.TIME | 内部时间 |
| `'tottime'` | N/A | 内部时间 |

注意所有统计排序都是降序（最耗时的在前），而名称、文件、行号搜索是升序（字母序）。`SortKey.NFL` 与 `SortKey.STDNAME` 的微妙差别在于：标准名是按打印出的名称排序，内嵌的行号会以奇怪的方式比较——例如行 3、20、40（文件名相同）会以 20、3、40 的字符串顺序出现；而 `SortKey.NFL` 对行号做数值比较。实际上 `sort_stats(SortKey.NFL)` 等价于 `sort_stats(SortKey.NAME, SortKey.FILENAME, SortKey.LINE)`。

出于向后兼容，也允许数字参数 `-1`、`0`、`1`、`2`，分别解释为 `'stdname'`、`'calls'`、`'time'`、`'cumulative'`。使用旧式数字格式时只使用一个排序键，其余参数被静默忽略。（3.7 新增 SortKey 枚举。）

**reverse_order()**：此方法反转对象内基本列表的顺序。注意默认会依据所选排序键正确选择升序/降序。

**print_stats(_*restrictions_)**：此方法按 `profile.run()` 定义所述打印报告。打印顺序基于对象上最后一次 `sort_stats()` 操作（受 `add()` 与 `strip_dirs()` 的注意事项约束）。参数（如有）用于把列表限制到重要条目：初始列表是全部被分析函数的完整集合；每个限制要么是整数（选择行数），要么是 0.0 到 1.0 之间的小数（选择行百分比），要么是被解释为正则表达式的字符串（匹配打印出的标准名称）。提供多个限制时依序应用。例如：

```python
print_stats(.1, 'foo:')
```

会先限制打印前 10%，再只打印文件名匹配 `.*foo:` 的函数。相反：

```python
print_stats('foo:', .1)
```

先限制到文件名匹配 `.*foo:` 的全部函数，再打印其中前 10%。

**print_callers(_*restrictions_)**：此方法打印调用过分析数据库中每个函数的所有函数列表。排序与 `print_stats()` 一致，限制参数的定义也相同。每个调用者单独一行。格式因产生统计的性能分析器而略有不同：

- 用 `profile` 时，每个调用者后面的括号里有一个数字，显示该特定调用的次数；为方便起见，右边还有第二个不带括号的数字，重复显示该函数的累积时间。

- 用 `cProfile` 时，每个调用者前面有三个数字：该特定调用的次数，以及在该调用者调用下当前函数的总时间和累积时间。

**print_callees(_*restrictions_)**：此方法打印被指定函数调用的所有函数列表。除调用方向相反（被调用 vs 调用了）之外，参数与排序与 `print_callers()` 相同。

**get_stats_profile()**：此方法返回一个 StatsProfile 实例，包含函数名到 FunctionProfile 实例的映射。每个 FunctionProfile 实例保存与函数画像相关的信息，如函数运行了多久、被调用了多少次等。（3.9 新增 StatsProfile、FunctionProfile 数据类与 get_stats_profile 函数。）

## 什么是确定性性能分析？

_确定性性能分析_意味着所有_函数调用_、_函数返回_等事件都会被监控，并且对这些事件之间的时间间隔（其间执行用户代码）做精确计时。相比之下，_统计式性能分析_（本模块不做）随机采样有效的指令指针，推断时间花在哪里。后者传统上开销更小（代码无需插桩），但只提供时间去向的相对指示。

在 Python 中，由于在执行过程中总有一个活动的解释器，因此执行确定性评测不需要插入指令的代码。Python 自动为每个事件提供一个 _钩子_（可选回调）。此外，Python 的解释特性往往会给执行增加太多开销，以至于在典型的应用程序中，确定性分析往往只会增加很小的处理开销。结果是，确定性分析并没有那么代价高昂，但是它提供了有关 Python 程序执行的大量运行时统计信息。

调用计数统计信息可用于识别代码中的错误（意外计数），并识别可能的内联扩展点（高频调用）。内部时间统计可用于识别应仔细优化的"热循环"。累积时间统计可用于识别算法选择上的高级别错误。请注意，该分析器中对累积时间的异常处理，允许直接比较算法的递归实现与迭代实现的统计信息。

## 局限性

一个限制是关于时间信息的准确性。确定性性能分析存在一个涉及精度的基本问题。最明显的限制是，底层的"时钟"周期大约为 0.001 秒（通常）。因此，没有什么测量会比底层时钟更精确。如果进行了足够的测量，那么"误差"将趋于平均。不幸的是，消除第一个误差会引入第二个误差来源。

第二个问题是，从调度事件到分析器调用获取时间函数实际_获取_时钟状态，这需要"一段时间"。类似地，从获取时钟值（然后保存）开始，直到再次执行用户代码为止，退出分析器事件句柄时也存在一定的延迟。因此，多次调用单个函数或调用多个函数通常会累积此错误。尽管这种方式的误差通常小于时钟的精度（小于一个时钟周期），但它_可以_累积并变得非常可观。

这个问题对 `profile` 比开销更低的 `cProfile` 更重要。为此，`profile` 提供了为给定平台自行校准的手段，使该误差可以按概率（平均地）消除。校准之后，分析器会更准确（最小二乘意义上），但有时会产生负数（当调用次数特别低、概率之神与你作对时）。_不要_对分析结果中的负数惊慌。它们_只_应在你已校准分析器时出现，且校准后的结果实际好于未校准。

## 校准

`profile` 模块的性能分析器会从每个事件处理时间中减去一个常数，以补偿调用时间函数并保存结果的开销。默认该常数为 0。以下过程可用于为给定平台获得更好的常数（见局限性）：

```python
import profile
pr = profile.Profile()
for i in range(5):
    print(pr.calibrate(10000))
```

此方法将执行由参数所给定次数的 Python 调用，在性能分析器之下直接和再次地执行，并对两次执行计时。它将随后计算每个性能分析器事件的隐藏开销，并将其以浮点数的形式返回。例如，在一台运行 macOS 的 1.8GHz Intel Core i5 上，使用 Python 的 time.process_time() 作为计时器，魔数大约为 4.04e-6。

此操作的目标是获得一个相当稳定的结果。如果你的计算机_非常_快速，或者你的计时器函数的分辨率很差，你可能必须传入 100000，甚至 1000000，才能得到稳定的结果。

当你有一个一致的答案时，有三种方法可以使用：

```python
import profile

# 1. 将计算出的偏差应用于此后创建的所有 Profile 实例。
profile.Profile.bias = your_computed_bias

# 2. 将计算出的偏差应用于特定的 Profile 实例。
pr = profile.Profile()
pr.bias = your_computed_bias

# 3. 在实例构造函数中指定计算出的偏差。
pr = profile.Profile(bias=your_computed_bias)
```

如果你可以选择，那么选择更小的常量会更好，这样你的结果将"更不容易"在性能分析统计中显示负值。

## 使用自定义计时器

如果你想要改变当前时间的确定方式（例如，强制使用时钟时间或进程持续时间），请向 `Profile` 类构造器传入你想要的计时函数：

```python
pr = profile.Profile(your_time_func)
```

得到的性能分析器将调用 `your_time_func`。根据你使用 `profile.Profile` 还是 `cProfile.Profile`，`your_time_func` 的返回值会被不同地解释：

**`profile.Profile`**：`your_time_func` 应当返回一个数字，或一个总和为当前时间的数字列表（如同 `os.times()` 所返回的内容）。如果该函数返回一个数字，或所返回的数字列表长度为 2，则你将得到一个特别快速的调度例程版本。

请注意你应当为你选择的计时器函数校准性能分析器类（参见校准）。对于大多数机器来说，一个返回长整数值的计时器在性能分析期间将提供在低开销方面的最佳结果（`os.times()` 是_相当_糟糕的，因为它返回一个浮点数值的元组）。如果你想以最干净的方式替换一个更好的计时器，请派生一个类并硬连线一个能最佳地处理计时器调用的替换调度方法，并使用适当的校准常量。

**`cProfile.Profile`**：`your_time_func` 应当返回一个数字。如果它返回整数，你还可以通过第二个参数指定一个单位时间的实际持续长度来唤起类构造器。举例来说，如果 `your_integer_time_func` 返回以千秒为单位的时间，则你应当以如下方式构造 `Profile` 实例：

```python
pr = cProfile.Profile(your_integer_time_func, 0.001)
```

由于 `cProfile.Profile` 类无法被校准，自定义计时函数应谨慎使用并尽可能快。要获得自定义计时器的最佳结果，可能有必要把它硬编码进内部 `_lsprof` 模块的 C 源码。

Python 3.3 在 `time` 中添加了几个可被用来精确测量进程或时钟时间的新函数。例如，参见 `time.perf_counter()`。

# py-spy：Python 程序的采样式性能分析器

py-spy 是一个针对 Python 程序的采样式性能分析器。它让你可视化 Python 程序把时间花在了哪里，而_无需_重启程序或以任何方式修改代码。py-spy 的开销极低：它用 Rust 编写以保证速度，且不在被分析的 Python 程序同一进程内运行。这意味着 py-spy 可以安全地用于生产环境的 Python 代码。

py-spy 可在 Linux、macOS、Windows 与 FreeBSD 上运行，支持分析所有近期版本的 CPython 解释器（2.3-2.7 与 3.3-3.14）。

## 安装

预构建的二进制 wheel 可从 PyPI 安装：

```text
pip install py-spy
```

也可以从 [GitHub Releases 页面](https://github.com/benfred/py-spy/releases)下载预构建二进制。

如果你是 Rust 用户，还可以用 `cargo install py-spy` 安装。注意这会从源码构建，在 Linux 和 Window 上需要 `libunwind`，例如 `apt install libunwind-dev`。

在 macOS 上，py-spy 已进入 Homebrew：`brew install py-spy`。在 Arch Linux 上位于 AUR：`yay -S py-spy`。在 Alpine Linux 上位于 testing 仓库：`apk add py-spy --update-cache --repository http://dl-3.alpinelinux.org/alpine/edge/testing/ --allow-untrusted`。

## 用法

py-spy 从命令行运行，接受要采样的程序 PID，或要运行的 Python 程序命令行。py-spy 有三个子命令：`record`、`top` 与 `dump`。

### record

py-spy 支持用 `record` 命令把分析结果录制到文件。例如，为你的 Python 进程生成[火焰图](http://www.brendangregg.com/flamegraphs.html)：

```bash
py-spy record -o profile.svg --pid 12345
# 或者
py-spy record -o profile.svg -- python myprogram.py
```

这会生成一个可交互的 SVG 文件（火焰图）。可以用 `--format` 参数改变文件格式，生成 [speedscope](https://github.com/jlfwong/speedscope) 剖析或原始数据。其他选项（如更改采样率、过滤只包含持有 GIL 的线程、分析原生 C 扩展、显示线程 id、分析子进程等）见 `py-spy record --help`。

### top

top 以实时视图显示 Python 程序中哪些函数最耗时，类似 Unix 的 [top](https://linux.die.net/man/1/top) 命令：

```bash
py-spy top --pid 12345
# 或者
py-spy top -- python myprogram.py
```

会打开一个实时更新的高层视图。

### dump

py-spy 还可以用 `dump` 命令显示每个 Python 线程当前的调用栈：

```bash
py-spy dump --pid 12345
```

这会把每个线程的调用栈以及一些其他基本进程信息转储到控制台。当你只需要一次调用栈来弄清 Python 程序卡在哪里时非常有用。该命令还能通过设置 `--locals` 标志打印与每个栈帧关联的局部变量。

## 常见问题

### 为什么还需要另一个 Python 性能分析器？

本项目旨在让你分析和调试任何正在运行的 Python 程序，即使该程序正在服务生产流量。

虽然 Python 性能分析项目很多，但它们几乎都要求以某种方式修改被分析的程序。通常分析代码运行在目标 Python 进程内部，会拖慢程序并改变其行为。这意味着把这些分析器用于调试生产服务中的问题通常不安全，因为它们往往有明显的性能影响。

### py-spy 是如何工作的？

py-spy 直接读取 Python 程序的内存：在 Linux 上用 [process_vm_readv](http://man7.org/linux/man-pages/man2/process_vm_readv.2.html) 系统调用，在 macOS 上用 [vm_read](https://developer.apple.com/documentation/kernel/1585350-vm_read?language=objc) 调用，在 Windows 上用 [ReadProcessMemory](https://msdn.microsoft.com/en-us/library/windows/desktop/ms680553(v=vs.85).aspx) 调用。

弄清 Python 程序的调用栈的方式是：查看全局 `PyInterpreterState` 变量获取解释器中运行的所有 Python 线程，然后遍历每个线程中的每个 `PyFrameObject` 获得调用栈。由于 Python ABI 在版本间变化，我们用 Rust 的 [bindgen](https://github.com/rust-lang-nursery/rust-bindgen) 为我们关心的每个 Python 解释器版本生成不同的 Rust 结构体，并用这些生成的结构体来解析 Python 程序中的内存布局。

由于[地址空间布局随机化](https://en.wikipedia.org/wiki/Address_space_layout_randomization)（ASLR），获取 Python 解释器的内存地址有点棘手。如果目标 Python 解释器带符号，通过解引用 `interp_head` 或 `_PyRuntime` 变量（取决于 Python 版本）就能轻松得到解释器的内存地址。然而，许多 Python 版本的二进制被 strip 过、或 Windows 上没有对应的 PDB 符号文件。这些情况下，我们会扫描 BSS 段，寻找看起来可能指向有效 PyInterpreterState 的地址，并检查该地址的布局是否符合预期。

### py-spy 能分析原生扩展吗？

可以！py-spy 支持在某些平台上分析用 C/C++ 或 Cython 等语言编写的原生 Python 扩展（见下表）。在命令行传入 `--native` 启用该模式。为获得最佳结果，编译 Python 扩展时应带符号。对 Cython 程序还值得注意的是：py-spy 需要生成的 C 或 C++ 文件，才能返回原始 .pyx 文件的行号。更多信息见[官方博客](https://www.benfrederickson.com/profiling-native-python-extensions-with-py-spy/)。

|         | Linux | Windows | macOS | FreeBSD |
|---------|-------|---------|-----|---------|
| i686    |       |         |     |         |
| x86-64  | yes   | yes     |     |         |
| ARM     | yes   |         |     |         |
| Aarch64 | yes   |         |     |         |

### 如何分析子进程？

向 record 或 top 视图传入 `--subprocesses` 标志，py-spy 还会包含目标程序的任何 Python 子进程的输出。这对分析使用 multiprocessing 或 gunicorn worker 池的应用很有用。py-spy 会监控新进程的创建，自动附着并把它们的样本包含进输出。record 视图会在调用栈中包含每个程序的 PID 与 cmdline，子进程显示为父进程的子节点。

### 什么时候需要 sudo 运行？

py-spy 通过读取另一个 Python 进程的内存工作，出于安全原因，视操作系统与系统设置这可能不被允许。许多情况下，以 root 运行（sudo 等）可绕过这些安全限制。macOS 总是要求 root；在 Linux 上则取决于启动 py-spy 的方式和系统安全设置。

Linux 的默认配置是：附着到非子进程时需要 root 权限。对 py-spy 来说，让 py-spy 自己创建进程（`py-spy record -- python myprogram.py`）即可无需 root 分析；而通过指定 PID 附着到既有进程通常需要 root（`sudo py-spy record --pid 123456`）。可以通过设置 [ptrace_scope sysctl 变量](https://wiki.ubuntu.com/SecurityTeam/Roadmap/KernelHardening#ptrace_Protection)在 Linux 上移除该限制。

### 如何判断线程是否空闲？

py-spy 尝试只包含正在活跃执行代码的线程的栈，排除睡眠或空闲的线程。可能时，py-spy 尝试从操作系统获取线程活动信息：Linux 上读 `/proc/PID/stat`，macOS 上用 mach [thread_basic_info](https://opensource.apple.com/source/xnu/xnu-792/osfmk/mach/thread_info.h.auto.html) 调用，Windows 上检查当前 SysCall 是否[已知为空闲](https://github.com/benfred/py-spy/blob/8326c6dbc6241d60125dfd4c01b70fed8b8b8138/remoteprocess/src/windows/mod.rs#L212-L229)。

该方法有一些局限，可能导致空闲线程仍被标记为活跃。首先，必须在暂停程序之前获取线程活动信息，因为从暂停的程序获取会总是返回空闲。这意味着存在潜在竞态：取线程活动后、取调用栈时线程可能已处于另一状态。对 FreeBSD 以及 Linux 上的 i686/ARM 处理器，查询操作系统线程活动尚未实现。在 Windows 上，阻塞在 IO 上的调用也还不会标记为空闲（如从 stdin 读取输入）。最后，在某些 Linux 调用上，我们使用的 ptrace 附着可能让空闲线程短暂唤醒，造成读取 procfs 时误报。因此我们还有一个启发式回退：把 Python 中某些已知调用标记为空闲。

设置 `--idle` 标志可禁用该功能，把 py-spy 认为空闲的帧也包含进来。

### GIL 检测是如何工作的？

Python 3.6 及更早版本，我们通过查看 `_PyThreadState_Current` 符号指向的 threadid 值获得 GIL 活动；Python 3.7 及以后，从 `_PyRuntime` 结构体中找出等价信息。这些符号可能不包含在你的 Python 发行版中，这会导致解析哪个线程持有 GIL 失败。当前 GIL 使用情况也在 `top` 视图中以 %GIL 显示。

传入 `--gil` 标志将只包含持有[全局解释器锁](https://wiki.python.org/moin/GlobalInterpreterLock)（GIL）的线程的栈。某些情况下这可能是程序时间去向的更准确视图，但要注意：它会漏掉那些释放了 GIL 但仍在活跃的扩展中的活动。

### 在 macOS 上分析 /usr/bin/python 为什么有问题？

macOS 有一个叫[系统完整性保护](https://en.wikipedia.org/wiki/System_Integrity_Protection)（SIP）的特性，它阻止哪怕 root 用户读取 /usr/bin 中任何二进制的内存。不幸的是，macOS 自带的 Python 解释器也在其中。

有几种应对方式：

- 安装另一个 Python 发行版。内置 Python 将在未来的 macOS 中[被移除](https://developer.apple.com/documentation/macos_release_notes/macos_catalina_10_15_release_notes)，而且你反正可能想从 Python 2 迁移出来。
- 用 [virtualenv](https://virtualenv.pypa.io/en/stable/) 在 SIP 不适用的环境中运行系统 Python。
- [关闭系统完整性保护](https://www.macworld.co.uk/how-to/mac/how-turn-off-mac-os-x-system-integrity-protection-rootless-3638975/)。

### 如何在 Docker 中运行 py-spy？

在 docker 容器里运行 py-spy 通常也会报权限拒绝错误，即使以 root 运行。

该错误由 docker 限制我们所用的 process_vm_readv 系统调用导致。可以在启动 docker 容器时设置 [`--cap-add SYS_PTRACE`](https://docs.docker.com/engine/security/seccomp/) 覆盖。

或者编辑 docker-compose yaml 文件：

```yaml
your_service:
   cap_add:
     - SYS_PTRACE
```

注意：需要重启 docker 容器该设置才生效。

你也可以在宿主操作系统上用 py-spy 分析 docker 容器内运行的进程。

### 如何在 Kubernetes 中运行 py-spy？

py-spy 需要 `SYS_PTRACE` 能力来读取进程内存。Kubernetes 默认丢弃该能力，导致错误：

```text
Permission Denied: Try running again with elevated permissions by going 'sudo env "PATH=$PATH" !!'
```

推荐的处理方式是编辑 spec 加入该能力。对 Deployment，把以下内容加到 `Deployment.spec.template.spec.containers`：

```yaml
securityContext:
  capabilities:
    add:
    - SYS_PTRACE
```

更多细节见 Kubernetes 文档。注意：修改 Deployment 资源会删除既有 Pod 并重建。

也可以创建**临时容器（ephemeral container）**附着到运行中的 Pod，目标是应用所在的特定**容器**。确保所用 profile 授予 `SYS_PTRACE` 权限，例如：

```sh
kubectl debug --profile=general \
    -n your-namespace \
    --target=app-container-name \
    pod-name \
    --image=python:3.12-slim \
    -it -- bash
```

### 如何在 Alpine Linux 上安装 py-spy？

Alpine 的 Python 不使用 `manylinux` wheel（见 pypa/pip#3969）。可以覆盖该行为在 Alpine 上用 pip 安装 py-spy：

```text
echo 'manylinux1_compatible = True' > /usr/local/lib/python3.7/site-packages/_manylinux.py
```

或者从 [GitHub releases 页面](https://github.com/benfred/py-spy/releases)下载 musl 二进制。

### 如何避免暂停 Python 程序？

设置 `--nonblocking` 选项，py-spy 就不会暂停你正在分析的 Python 进程。虽然用 py-spy 对进程采样的性能影响通常极低，设置该选项可以完全避免打断运行中的 Python 程序。

设置该选项后，py-spy 会在 Python 进程运行时直接读取解释器状态。由于我们读取内存所用的调用不是原子的、且获取一次调用栈要发起多次调用，采样时偶尔会出错——表现为采样错误率升高，或输出中出现不完整的栈帧。

### py-spy 支持 32 位 Windows 吗？与 PyPy 集成？支持 USC2 版的 Python2？

还不支持。

如果你希望 py-spy 增加某些特性，可以给[相应 issue](https://github.com/benfred/py-spy/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc) 点赞或新建一个描述缺失功能的 issue。

### 管道到 pager 时如何强制彩色输出？

py-spy 遵循 [CLICOLOR](https://bixense.com/clicolors/) 规范：在环境中设置 `CLICOLOR_FORCE=1`，即使输出被管道到 pager 也会打印彩色内容。

## 致谢与许可

py-spy 的灵感大量来自 [Julia Evans](https://github.com/jvns/) 在 [rbspy](http://github.com/rbspy/rbspy) 上的出色工作。特别是，生成 flamegraph 与 speedscope 文件的代码直接取自 rbspy，本项目还使用了从 rbspy 拆分出的 [read-process-memory](https://github.com/luser/read-process-memory) 与 [proc-maps](https://github.com/benfred/proc-maps) crate。

py-spy 以 MIT 许可证发布，全文见 [LICENSE](https://github.com/benfred/py-spy/blob/master/LICENSE)。

---

> **来源**：本文由两部分完整翻译而成：① Python 官方文档 [The Python Profilers](https://docs.python.org/zh-cn/3/library/profile.html)（`profile`/`cProfile`/`pstats`），作者 Python 软件基金会（PSF），许可 PSF 许可证第 2 版；② py-spy 项目 [README](https://github.com/benfred/py-spy/blob/master/README.md)，作者 Ben Frederickson，许可 MIT 许可证。抓取于 2026-09-13。py-spy README 中的火焰图/控制台截图未随文转载。

---

> 编者注：两类分析器的选型——`cProfile` 是"确定性"分析：插桩统计每个函数的调用数与耗时，适合本地定位热函数（本模块《日志》一篇的计时装饰器只能看单点，cProfile 能看全貌）；py-spy 是"采样式"分析：跨进程读取内存、零代码改动，适合排查线上服务的卡死与 CPU 尖刺（`py-spy dump --pid` 一条命令即可拿到全部线程栈）。LLM 应用建议：流式网关先用 cProfile 在本地压测找热点，生产环境用 py-spy 兜底。`timeit` 用于微基准，两者都不替代它。
