---
title: 常见陷阱汇总
source_url: https://docs.python.org/zh-cn/3/faq/programming.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-13
translated: false
order: 22
versions: Python 3.14 文档
---

## 变量明明有值，为什么还会出现 UnboundLocalError？

当在函数内部某处添加了一条赋值语句，因而导致之前正常工作的代码报出 `UnboundLocalError` 错误，这确实有点令人惊讶。

以下代码：

```plain
>>> x = 10
>>> def bar():
...     print(x)
...
>>> bar()
10
```

正常工作，但是以下代码

```plain
>>> x = 10
>>> def foo():
...     print(x)
...     x += 1
```

会导致 `UnboundLocalError`：

```plain
>>> foo()
Traceback (most recent call last):
  ...
UnboundLocalError: cannot access local variable 'x' where it is not associated with a value
```

原因就是，当对某作用域内的变量进行赋值时，该变量将成为该作用域内的局部变量，并覆盖外部作用域中的同名变量。由于 foo 的最后一条语句为 `x` 分配了一个新值，编译器会将其识别为局部变量。因此，前面的 `print(x)` 试图输出未初始化的局部变量，就会引发错误。

在上面的示例中，可以将外部作用域的变量声明为全局变量以便访问：

```plain
>>> x = 10
>>> def foobar():
...     global x
...     print(x)
...     x += 1
...
>>> foobar()
10
```

你可以使用 `nonlocal` 关键字在嵌套作用域中执行类似的操作：

```plain
>>> def foo():
...    x = 10
...    def bar():
...        nonlocal x
...        print(x)
...        x += 1
...    bar()
...    print(x)
...
>>> foo()
10
11
```

## Python 的局部变量和全局变量有哪些规则？

函数内部只作引用的 Python 变量隐式视为全局变量。如果在函数内部任何位置为变量赋值，则除非明确声明为全局变量，否则均将其视为局部变量。

起初尽管有点令人惊讶，不过考虑片刻即可释然。一方面，已分配的变量要求加上 `global` 可以防止意外的副作用发生。另一方面，如果所有全局引用都要加上 `global`，那处处都得用上 `global` 了。那么每次对内置函数或导入模块中的组件进行引用时，都得声明为全局变量。这种杂乱会破坏 `global` 声明用于警示副作用的有效性。

## 为什么在循环中定义的参数各异的 lambda 都返回相同的结果？

假定你使用一个 for 循环来定义几个不同的 lambda (甚至普通的函数)，例如：

```plain
>>> squares = []
>>> for x in range(5):
...     squares.append(lambda: x**2)
```

以上会得到一个包含 5 个 lambda 函数的列表，这些函数将计算 `x**2`。大家或许期望，调用这些函数会分别返回 `0`、`1`、`4`、`9` 和 `16`。然而，真的试过就会发现，他们都会返回 `16`：

```plain
>>> squares[2]()
16
>>> squares[4]()
16
```

这是因为 `x` 不是 lambda 表达式的局部变量，而是定义于外部作用域中，并且它会在调用 lambda 表达式时被访问——而不是在定义时。在循环结束时，`x` 的值为 `4`，所以此时所有函数都将返回 `4**2`，即 `16`。你也可以通过改变 `x` 的值并查看 lambda 表达式结果的变化来验证这一点：

```plain
>>> x = 8
>>> squares[2]()
64
```

为了避免发生上述情况，需要将值保存在 lambda 局部变量，以使其不依赖于全局 `x` 的值：

```plain
>>> squares = []
>>> for x in range(5):
...     squares.append(lambda n=x: n**2)
```

以上 `n=x` 创建了一个新的 lambda 本地变量 `n`，并在定义 lambda 时计算其值，使其与循环当前时点的 `x` 值相同。这意味着 `n` 的值在第 1 个 lambda 中为 `0`，在第 2 个 lambda 中为 `1`，在第 3 个中为 `2`，依此类推。因此现在每个 lambda 都会返回正确结果：

```plain
>>> squares[2]()
4
>>> squares[4]()
16
```

请注意，上述表现并不是 lambda 所特有的，常规的函数也同样适用。

## 为什么对象之间会共享默认值？

新手程序员常常中招这类 Bug。请看以下函数：

```python
def foo(mydict={}):  # 危险：所有调用共享对一个字典的引用
    ... 执行一些计算 ...
    mydict[key] = value
    return mydict
```

第一次调用此函数时，`mydict` 中只有一个数据项。第二次调用 `mydict` 则会包含两个数据项，因为 `foo()` 开始执行时，`mydict` 中已经带有一个数据项了。

大家往往希望，函数调用会为默认值创建新的对象。但事实并非如此。默认值只会在函数定义时创建一次。如果对象发生改变，就如上例中的字典那样，则后续调用该函数时将会引用这个改动的对象。

按照定义，不可变对象改动起来是安全的，诸如数字、字符串、元组和 `None` 之类。而可变对象的改动则可能引起困惑，例如字典、列表和类实例等。

因此，不把可变对象用作默认值是一种良好的编程做法。而应采用 `None` 作为默认值，然后在函数中检查参数是否为 `None` 并新建列表、字典或其他对象。例如，代码不应如下所示：

```python
def foo(mydict={}):
    ...
```

而应这么写：

```python
def foo(mydict=None):
    if mydict is None:
        mydict = {}  # 为局部命名空间新建一个字典
```

参数默认值的特性有时会很有用处。如果有个函数的计算过程会比较耗时，有一种常见技巧是将每次函数调用的参数和结果缓存起来，并在同样的值被再次请求时返回缓存的值。这种技巧被称为"memoize"，实现代码可如下所示：

```python
# 调用方只能提供两个形参并可选择以关键字形式传入 _cache
def expensive(arg1, arg2, *, _cache={}):
    if (arg1, arg2) in _cache:
        return _cache[(arg1, arg2)]

    # 计算结果值
    result = ... 高耗费的计算 ...
    _cache[(arg1, arg2)] = result           # 将结果保存在缓存中
    return result
```

## 为什么 -22 // 10 会返回 -3？

这主要是为了让 `i % j` 的正负与 `j` 一致，如果期望如此，且期望如下等式成立：

```plain
i == (i // j) * j + (i % j)
```

那么整除就必须返回向下取整的结果。C 语言同样要求保持这种一致性，于是编译器在截断 `i // j` 的结果时需要让 `i % j` 的正负与 `i` 一致。

对于 `i % j` 来说 `j` 为负值的应用场景实际上是非常少的。而 `j` 为正值的情况则非常多，并且实际上在所有情况下让 `i % j` 的结果为 `>= 0` 会更有用处。如果现在时间为 10 时，那么 200 小时前应是几时？`-190 % 12 == 2` 是有用处的；`-190 % 12 == -10` 则是一个潜伏的 bug。

## 函数形参列表中的斜杠（/）是什么意思？

函数参数列表中的斜杠表示在它之前的形参都是仅限位置形参。仅限位置形参没有可供外部使用的名称。在调用接受仅限位置形参的函数时，参数将只根据其位置被映射到形参上。例如，`divmod()` 就是一个接受仅限位置形参的函数。它的文档说明是这样的：

```plain
>>> help(divmod)
Help on built-in function divmod in module builtins:

divmod(x, y, /)
    Return the tuple (x//y, x%y).  Invariant: div*y + mod == x.
```

形参列表尾部的斜杠说明，两个形参都是仅限位置形参。因此，用关键字参数调用 `divmod()` 将会引发错误：

```plain
>>> divmod(x=3, y=4)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: divmod() takes no keyword arguments
```

## 跨模块共享全局变量与导入的最佳实践

在单个程序中跨模块共享信息的规范方法是创建一个特殊模块（通常称为 config 或 cfg）。只需在应用程序的所有模块中导入该 config 模块；然后该模块就可当作全局名称使用了。因为每个模块只有一个实例，所以对该模块对象所做的任何更改将会在所有地方得以体现。例如：

config.py：

```python
x = 0   # 'x' 配置设置的默认值
```

mod.py：

```python
import config
config.x = 1
```

main.py：

```python
import config
import mod
print(config.x)
```

关于导入的最佳实践：通常请勿使用 `from modulename import *`。因为这会扰乱 importer 的命名空间，且会造成未定义名称更难以被 Linter 检查出来。

请在代码文件的首部就导入模块。这样代码所需的模块就一目了然了，也不用考虑模块名是否在作用域内的问题。按如下顺序导入模块就是一种好做法：

1.  标准库模块——如 `sys`、`os`、`argparse`、`re`。

2.  第三方库模块（任何安装在 Python 的目录下的内容）——如 [dateutil](https://pypi.org/project/dateutil/)、[requests](https://pypi.org/project/requests/)、[tzdata](https://pypi.org/project/tzdata/)。

3.  本地开发的模块。

---

> **来源**：本文转载自 [Python 常见问题解答 · 编程 FAQ](https://docs.python.org/zh-cn/3/faq/programming.html)，作者 Python Software Foundation，许可 PSF 许可证第 2 版（转载署名）。抓取于 2026-09-13。本文为该页中与初学者常见陷阱相关问答的节选汇编。
