---
title: 迭代器与生成器
source_url: https://docs.python.org/zh-cn/3/howto/functional.html
author: A. M. Kuchling（Python 官方文档团队）
license: PSF 许可证第 2 版（GPL 兼容）
fetched_at: 2026-09-13
translated: false
order: 2
versions: Python 3.14
---

> **来源**：本文转载自 [函数式编程指引 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/howto/functional.html)，作者 A. M. Kuchling（Python 官方文档团队），许可 PSF 许可证第 2 版。抓取于 2026-09-13。

> 编者注：本文节选自 Python 官方《函数式编程指引》中的"迭代器""生成器表达式和列表推导式""生成器""向生成器传递值"四节，标题与结构略有调整。生成器是理解 LLM 流式输出（逐 token 返回）的必备基础，在本模块后面 async 一篇中还会以协程的形式再次出现。

## 迭代器

迭代器是一个表示数据流的对象；这个对象每次只返回一个元素。Python 迭代器必须支持 `__next__()` 方法；这个方法不接受参数，并总是返回数据流中的下一个元素。如果数据流中没有元素，`__next__()` 会抛出 `StopIteration` 异常。迭代器未必是有限的；完全有理由构造一个输出无限数据流的迭代器。

内置的 `iter()` 函数接受任意对象并试图返回一个迭代器来输出对象的内容或元素，并会在对象不支持迭代的时候抛出 `TypeError` 异常。Python 有几种内置数据类型支持迭代，最常见的就是列表和字典。如果一个对象能生成迭代器，那么它就会被称作可迭代对象（iterable）。

你可以手动试验迭代器的接口。

```python
>>> L = [1, 2, 3]
>>> it = iter(L)
>>> it
<...iterator object at ...>
>>> it.__next__()  # same as next(it)
1
>>> next(it)
2
>>> next(it)
3
>>> next(it)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
StopIteration
```

Python 有不少要求使用可迭代的对象的地方，其中最重要的就是 `for` 语句。在语句 `for X in Y` 中，Y 要么自身是一个迭代器，要么能够由 `iter()` 创建一个迭代器。以下两种写法是等价的:

```python
for i in iter(obj):
    print(i)

for i in obj:
    print(i)
```

可以用 `list()` 或 `tuple()` 这样的构造函数把迭代器具体化成列表或元组：

```python
>>> L = [1, 2, 3]
>>> iterator = iter(L)
>>> t = tuple(iterator)
>>> t
(1, 2, 3)
```

序列的解压操作也支持迭代器：如果你知道一个迭代器能够返回 N 个元素，你可以把他们解压到有 N 个元素的元组：

```python
>>> L = [1, 2, 3]
>>> iterator = iter(L)
>>> a, b, c = iterator
>>> a, b, c
(1, 2, 3)
```

像 `max()` 和 `min()` 这样的内置函数可以接受单个迭代器参数，然后返回其中最大或者最小的元素。`in` 和 `not in` 操作也支持迭代器：如果能够在迭代器返回的数据流中找到 X 的话，则 `X in iterator` 为真。很显然，如果迭代器是无限的，这么做你就会遇到问题；`max()` 和 `min()` 永远也不会返回；如果元素 X 也不出现在数据流中，`in` 和 `not in` 操作同样也永远不会返回。

注意你只能在迭代器中顺序前进；没有获取前一个元素的方法，除非重置迭代器，或者重新复制一份。迭代器对象可以提供这些额外的功能，但迭代器协议只明确了 `__next__()` 方法。函数可能因此而耗尽迭代器的输出，如果你要对同样的数据流做不同的操作，你必须重新创建一个迭代器。

### 支持迭代器的数据类型

我们已经知道列表和元组支持迭代器。实际上，Python 中的任何序列类型，比如字符串，都自动支持创建迭代器。

对字典调用 `iter()` 会返回一个遍历字典的键的迭代器:

```python
>>> m = {'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
...      'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12}
>>> for key in m:
...     print(key, m[key])
Jan 1
Feb 2
...
Dec 12
```

注意从 Python 3.7 开始，字典的遍历顺序一定和输入顺序一样。先前的版本并没有明确这一点，所以不同的实现可能不一致。

对字典使用 `iter()` 总是会遍历键，但字典也有返回其他迭代器的方法。如果你只遍历值或者键/值对，你可以明确地调用 `values()` 或 `items()` 方法得到合适的迭代器。

`dict()` 构造函数可以接受一个返回有限的 `(key, value)` 元组流的迭代器：

```python
>>> L = [('Italy', 'Rome'), ('France', 'Paris'), ('US', 'Washington DC')]
>>> dict(iter(L))
{'Italy': 'Rome', 'France': 'Paris', 'US': 'Washington DC'}
```

文件也可以通过调用 `readline()` 来遍历，直到穷尽文件中所有的行。这意味着你可以像这样读取文件中的每一行:

```python
for line in file:
    # 对每一行执行某些操作
    ...
```

集合可以从可遍历的对象获取内容，也可以让你遍历集合的元素:

```python
>>> S = {2, 3, 5, 7, 11, 13}
>>> for i in S:
...     print(i)
2
3
5
...
```

## 生成器表达式和列表推导式

迭代器的输出有两个很常见的使用方式，1) 对每一个元素执行操作，2) 选择一个符合条件的元素子集。比如，给定一个字符串列表，你可能想去掉每个字符串尾部的空白字符，或是选出所有包含给定子串的字符串。

列表推导式和生成器表达式（简写："listcomp" 和 "genexp"）让这些操作更加简明。你可以用以下代码去掉一个字符串流中的所有空白符：

```python
>>> line_list = ['  line 1\n', 'line 2  \n', ' \n', '']

>>> # 生成器表达式 -- 返回迭代器
>>> stripped_iter = (line.strip() for line in line_list)

>>> # 列表推导式 -- 返回列表
>>> stripped_list = [line.strip() for line in line_list]
```

你可以加上条件语句 `if` 来选取特定的元素:

```python
>>> stripped_list = [line.strip() for line in line_list
...                  if line != ""]
```

通过列表推导式，你会获得一个 Python 列表；`stripped_list` 就是一个包含所有结果行的列表，并不是迭代器。生成器表达式会返回一个迭代器，它在必要的时候计算结果，避免一次性生成所有的值。这意味着，如果迭代器返回一个无限数据流或者大量的数据，列表推导式就不太好用了。这种情况下生成器表达式会更受青睐。

生成器表达式两边使用圆括号（"()"），而列表推导式则使用方括号（"[]"）。生成器表达式的形式为:

```
( expression for expr in sequence1
             if condition1
             for expr2 in sequence2
             if condition2
             for expr3 in sequence3
             ...
             if condition3
             for exprN in sequenceN
             if conditionN )
```

生成的输出的各个元素将是 `expression` 的连续取值。其中 `if` 语句是可选的；如果给定的话 `expression` 只会在符合条件时计算并加入到结果中。

生成器表达式总是写在圆括号里面，不过也可以算上调用函数时用的括号。如果你想即时创建一个传递给函数的迭代器，可以这么写:

```python
obj_total = sum(obj.count for obj in list_all_objects())
```

其中 `for...in` 语句包含了将要遍历的序列。这些序列并不必须同样长，因为它们会从左往右开始遍历，而**不是**同时执行。换句话说，列表推导式或生成器表达式是和嵌套的 `for` + `continue` 代码等价的。如果有多个 `for...in` 语句而没有 `if` 语句，输出结果的长度就是所有序列长度的乘积：

```python
>>> seq1 = 'abc'
>>> seq2 = (1, 2, 3)
>>> [(x, y) for x in seq1 for y in seq2]
[('a', 1), ('a', 2), ('a', 3),
 ('b', 1), ('b', 2), ('b', 3),
 ('c', 1), ('c', 2), ('c', 3)]
```

为了不让 Python 语法变得含糊，如果 `expression` 会生成元组，那这个元组必须要用括号括起来。下面第一个列表推导式语法错误，第二个则是正确的:

```python
# 语法错误
[x, y for x in seq1 for y in seq2]
# 正确
[(x, y) for x in seq1 for y in seq2]
```

## 生成器

生成器是一类用来简化编写迭代器工作的特殊函数。普通的函数计算并返回一个值，而生成器返回一个能返回数据流的迭代器。

普通函数到达 `return` 表达式时，局部变量会被销毁然后把返回给调用者。之后调用同样的函数时会创建一个新的私有命名空间和一组全新的局部变量。但是，如果在退出一个函数时不扔掉局部变量会如何呢？如果稍后你能够从退出函数的地方重新恢复又如何呢？这就是生成器所提供的；他们可以被看成**可恢复的函数**。

这里有简单的生成器函数示例：

```python
>>> def generate_ints(N):
...    for i in range(N):
...        yield i
```

任何包含了 `yield` 关键字的函数都是生成器函数；Python 的字节码编译器会在编译的时候检测到并因此而特殊处理。

当你调用一个生成器函数，它并不会返回单独的值，而是返回一个支持生成器协议的生成器对象。当执行 `yield` 表达式时，生成器会输出 `i` 的值，就像 `return` 表达式一样。`yield` 和 `return` 最大的区别在于，到达 `yield` 的时候生成器的执行状态会挂起并保留局部变量。在下一次调用生成器 `__next__()` 方法的时候，函数会恢复执行。

```python
>>> gen = generate_ints(3)
>>> gen
<generator object generate_ints at ...>
>>> next(gen)
0
>>> next(gen)
1
>>> next(gen)
2
>>> next(gen)
Traceback (most recent call last):
  File "stdin", line 1, in <module>
  File "stdin", line 2, in generate_ints
StopIteration
```

同样，你可以写出 `for i in generate_ints(5)`，或者 `a, b, c = generate_ints(3)`。

在生成器函数里面，`return value` 会触发从 `__next__()` 方法抛出 `StopIteration(value)` 异常。一旦抛出这个异常，或者函数结束，处理数据的过程就会停止，生成器也不会再生成新的值。

你可以手动编写自己的类来达到生成器的效果，把生成器的所有局部变量作为实例的成员变量存储起来。然而，对于一个中等复杂程度的生成器，写出一个相应的类可能会相当繁杂——这正是生成器的价值所在。

官方测试套件里有一个用生成器实现树的递归中序遍历的经典示例：

```python
# 一个按中序生成 Tree 叶子节点的递归生成器。
def inorder(t):
    if t:
        for x in inorder(t.left):
            yield x

        yield t.label

        for x in inorder(t.right):
            yield x
```

> 编者注：LLM API 的"流式输出"就是这一机制的直接应用——服务端逐段返回 token，客户端 SDK 返回一个可逐段消费的迭代器/生成器，`for chunk in stream:` 每次拿到一小段文本就立即渲染，用户无需等整个回复生成完。

## 向生成器传递值

`yield` 变成了一个表达式，返回一个可以赋给变量或执行操作的值:

```python
val = (yield i)
```

我们建议你在处理 `yield` 表达式返回值的时候，**总是**两边写上括号，就像上面的例子一样。（PEP 342 解释了具体的规则：`yield` 表达式必须括起来，除非是出现在最顶级的赋值表达式的右边。这意味着你可以写 `val = yield i`，但是必须在操作的时候加上括号，就像 `val = (yield i) + 12`。）

向生成器发送值是通过调用其 `send(value)` 方法。此方法会恢复执行生成器的代码并以 `yield` 表达式返回指定的值。如果调用了常规的 `__next__()` 方法，`yield` 会返回 `None`。

这里有一个简单的每次加 1 的计数器，并允许改变内部计数器的值。

```python
def counter(maximum):
    i = 0
    while i < maximum:
        val = (yield i)
        # 如果提供了值，则改变计数器
        if val is not None:
            i = val
        else:
            i += 1
```

这是改变计数器的一个示例:

```python
>>> it = counter(10)
>>> next(it)
0
>>> next(it)
1
>>> it.send(8)
8
>>> next(it)
9
>>> next(it)
Traceback (most recent call last):
  File "t.py", line 15, in <module>
StopIteration
```

因为 `yield` 很多时候会返回 `None`，所以你应该总是检查这个情况。不要在表达式中使用 `yield` 的值，除非你确定 `send()` 是唯一的用来恢复你的生成器函数的方法。

除了 `send()` 之外，生成器还有两个其他的方法：

-   `throw(value)` 用于在生成器内部抛出异常；这个异常会在生成器暂停执行的时候由 `yield` 表达式抛出。

-   `close()` 会向生成器发送一个 `GeneratorExit` 异常来终结迭代。当接收到此异常时，生成器的代码必须引发 `GeneratorExit` 或者 `StopIteration`；捕获此异常并作任何其他操作都是非法的并会触发 `RuntimeError`。`close()` 还会在生成器被作为垃圾回收时由 Python 的垃圾回收器调用。

    如果你要在 `GeneratorExit` 发生的时候清理代码，建议使用 `try: ... finally:` 组合来代替处理 `GeneratorExit`。

这些改变的累积效应是，让生成器从单向的信息生产者变成了既是生产者，又是消费者。生成器也可以成为**协程**，一种更广义的子过程形式。子过程可以从一个地方进入，然后从另一个地方退出（从函数的顶端进入，从 `return` 语句退出），而协程可以进入，退出，然后在很多不同的地方恢复（`yield` 语句）——这正是本模块后面 asyncio 一篇的出发点。
