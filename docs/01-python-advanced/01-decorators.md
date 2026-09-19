---
title: 装饰器实战：functools —— 高阶函数与可调用对象上的操作
source_url: https://docs.python.org/zh-cn/3/library/functools.html
author: Python 软件基金会（PSF）文档团队
license: PSF 许可证第 2 版
fetched_at: 2026-09-13
translated: false
versions: Python 3.14 官方文档
order: 1
group: 语言机制进阶
---
**源代码:**[Lib/functools.py](https://github.com/python/cpython/tree/3.14/Lib/functools.py)

* * *

`functools` 模块针对高阶函数：即处理或返回其他函数的函数。 总的来说，任何可调用对象均可被作为此模块所处理的函数。

`functools` 模块定义了下列函数：module defines the following functions:

**@functools.cache(_user\_function_)**

简单轻量级未绑定函数缓存。有时称为 ["memoize"](https://en.wikipedia.org/wiki/Memoization).

效果等同于 `lru_cache(maxsize=None)`，即围绕“基于函数实参的字典查询”创建一层薄包装。因为从不需要淘汰旧值，所以它比带上限的 `@lru_cache` 更小、更快。

例如:

```python
@cache
def factorial(n):
    return n * factorial(n-1) if n else 1

>>> factorial(10)   # 不预先缓存结果，执行 11 次递归调用
3628800
>>> factorial(5)    # 不执行新的调用，只返回缓存的结果
120
>>> factorial(12)   # 执行两次新的递归调用，factorial(10) 已被缓存
479001600
```

该缓存是线程安全的，因此被包装的函数可在多线程中使用。这意味着下层的数据结构将在并发更新期间保持一致性。

如果另一个线程在初始调用完成并被缓存之前执行了额外的调用，则被包装的函数可能会被多次调用。

版本 3.9 中新增。

**@functools.cached\_property(_func_)**

把类中的一个方法转换为属性，其值只计算一次，然后像普通属性一样缓存到实例的生命周期内。效果类似 `@property`，额外增加了缓存能力。适用于实例基本不可变、而属性计算代价高昂的场景。

示例:

```python
class DataSet:

    def __init__(self, sequence_of_numbers):
        self._data = tuple(sequence_of_numbers)

    @cached_property
    def stdev(self):
        return statistics.stdev(self._data)
```

`@cached_property` 的实现机制与 `@property` 略有不同：普通 property 在未定义 setter 时会阻止属性写入；而缓存属性则允许写入（写入会覆盖缓存值）。

`cached_property` 装饰器仅在执行查找且不存在同名属性时才会运行。当运行时，`cached_property` 会写入同名的属性。 后续的属性读取和写入操作会优先于 `cached_property` 方法，其行为就像普通的属性一样。

缓存的值可通过删除该属性来清空。这允许 `cached_property` 方法再次运行。

`cached_property` 不能防止在多线程使用中可能出现的竞争条件。getter 函数可以在同一实例上多次运行，最后一次运行将设置缓存值。 如果缓存的特征属性是幂等的或者对于在同一实例上多次运行是无害的，那就没有问题。如果需要进行同步，请在被装饰的 getter 函数内部或在缓存的特征属性访问外部实现必要的锁定操作。

注意，这个装饰器会影响 [**PEP 412**](https://peps.python.org/pep-0412/) 键共享字典的操作。这意味着相应的字典实例可能占用比通常时更多的空间。

而且，这个装饰器要求每个实例上的 `__dict__` 是可变的映射。这意味着它将不适用于某些类型，例如元类（因为类型实例上的 `__dict__` 属性是类命名空间的只读代理），以及那些指定了 `__slots__` 但未包括 `__dict__` 作为所定义的空位之一的类（因为这样的类根本没有提供 `__dict__` 属性）。

If a mutable mapping is not available or if space-efficient key sharing is desired, an effect similar to `@cached_property` can also be achieved by stacking `@property` on top of `@lru_cache`. See 我该如何缓存方法调用？ for more details on how this differs from `@cached_property`.

版本 3.8 中新增。

在 3.12 版本发生变更: Prior to Python 3.12, `@cached_property` included an undocumented lock to ensure that in multi-threaded usage the getter function was guaranteed to run only once per instance. However, the lock was per-property, not per-instance, which could result in unacceptably high lock contention. In Python 3.12+ this locking is removed.

**functools.cmp\_to\_key(_func_)**

将旧式的比较函数转换为新式的 key function。在类似于 `sorted()`, `min()`, `max()`, `heapq.nlargest()`, `heapq.nsmallest()`, `itertools.groupby()` 等函数的 key 参数中使用。 此函数主要用作将 Python 2 程序转换至新版的转换工具，以保持对比较函数的兼容。

比较函数是任何接受两个参数，比较它们，并在结果为小于时返回负数，等于时返回零，大于时返回正数的可调用对象。键函数是接受一个参数并返回另一值的可调用对象，返回值在排序时被用作键。

示例:

```python
sorted(iterable, key=cmp_to_key(locale.strcoll))  # 感知语言区域的排序设置
```

有关排序示例和简要排序教程，请参阅 排序的技术。

版本 3.2 中新增。

**@functools.lru\_cache(_user\_function_)**

**@functools.lru\_cache(_maxsize\=128_, _typed\=False_)**

一个为函数提供缓存功能的装饰器，缓存 _maxsize_ 组传入参数，在下次以相同参数调用时直接返回上一次的结果。用以节约高开销或 I/O 函数的调用时间。

该缓存是线程安全的，因此被包装的函数可在多线程中使用。这意味着下层的数据结构将在并发更新期间保持一致性。

如果另一个线程在初始调用完成并被缓存之前执行了额外的调用，则被包装的函数可能会被多次调用。

由于使用字典来缓存结果，因此传给该函数的位置和关键字参数必须为 hashable。

不同的参数模式可能会被视为具有单独缓存项的不同调用。例如，`f(a=1, b=2)` 和 `f(b=2, a=1)` 因其关键字参数顺序不同而可能会具有两个单独的缓存项。

如果指定了 _user\_function_，它必须是一个可调用对象。这允许 _lru\_cache_ 装饰器被直接应用于一个用户自定义函数，让 _maxsize_ 保持其默认值 128:

```python
@lru_cache
def count_vowels(sentence):
    return sum(sentence.count(vowel) for vowel in 'AEIOUaeiou')
```

如果 _maxsize_ 设为 `None`，LRU 特性将被禁用且缓存可无限增长。

如果 _typed_ 被设置为 true，不同类型的函数参数将被分别缓存。如果 _typed_ 为 false ，实现通常会将它们视为等价的调用，只缓存一个结果。（有些类型，如 _str_ 和 _int_，即使 _typed_ 为 false，也可能被分开缓存。）

请注意，类型的特殊性只适用于函数的直接参数而不是它们的内容。 标量参数 `Decimal(42)` 和 `Fraction(42)` 会被视为具有不同结果的不同调用。 相比之下，元组参数 `('answer', Decimal(42))` 和 `('answer', Fraction(42))` 则会被视为是等同的。

被包装的函数配有一个 `cache_parameters()` 函数，它返回一个新的 `dict` 用来显示 _maxsize_ 和 _typed_ 的值。这只是出于显示信息的目的。改变这些值没有任何效果。

为了帮助衡量缓存的有效性以及调整 _maxsize_ 形参，被包装的函数会带有一个 `cache_info()` 函数，它返回一个 named tuple 以显示 _hits_、 _misses_、 _maxsize_ 和 _currsize_。

该装饰器也提供了一个用于清理/使缓存失效的函数 `cache_clear()`。

原始的未经装饰的函数可以通过 `__wrapped__` 属性访问。它可以用于检查、绕过缓存，或使用不同的缓存再次装饰原始函数。

缓存会保持对参数和返回值的引用，直到它们结束生命期退出缓存或者直到缓存被清空。

如果一个方法被缓存，则 `self` 实例参数会被包括在缓存中。请参阅 我该如何缓存方法调用？

[LRU (least recently used) 缓存](https://en.wikipedia.org/wiki/Cache_replacement_policies#Least_Recently_Used_\(LRU\)) 在最近的调用是即将到来的调用的最佳预测值时性能最好 (例如，新闻服务器上的最热门文章倾向于每天发生变化)。 缓存的大小限制可确保缓存不会在长期运行的进程如 web 服务器上无限制地增长。

一般来说，LRU 缓存只应在你需要重复使用先前计算的值时使用。 因此，缓存有附带影响的函数、每次调用都需要创建不同的可变对象的函数（如生成器和异步函数）或不纯的函数如 time() 或 random() 等是没有意义的。

静态 Web 内容的 LRU 缓存示例:

```python
@lru_cache(maxsize=32)
def get_pep(num):
    'Retrieve text of a Python Enhancement Proposal'
    resource = f'https://peps.python.org/pep-{num:04d}'
    try:
        with urllib.request.urlopen(resource) as s:
            return s.read()
    except urllib.error.HTTPError:
        return 'Not Found'

>>> for n in 8, 290, 308, 320, 8, 218, 320, 279, 289, 320, 9991:
...     pep = get_pep(n)
...     print(n, len(pep))

>>> get_pep.cache_info()
CacheInfo(hits=3, misses=8, maxsize=32, currsize=8)
```

以下是使用缓存通过 [动态规划](https://zh.wikipedia.org/wiki/动态规划) 计算 [斐波那契数列](https://zh.wikipedia.org/wiki/斐波那契数列) 的例子:

```python
@lru_cache(maxsize=None)
def fib(n):
    if n < 2:
        return n
    return fib(n-1) + fib(n-2)

>>> [fib(n) for n in range(16)]
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610]

>>> fib.cache_info()
CacheInfo(hits=28, misses=16, maxsize=None, currsize=16)
```

版本 3.2 中新增。

在 3.3 版本发生变更: 添加 _typed_ 选项。

在 3.8 版本发生变更: 添加了 _user\ 选项。

在 3.9 版本发生变更: 增加了 `cache_parameters()` 函数

**@functools.total\_ordering**

给定一个声明一个或多个全比较排序方法的类，这个类装饰器实现剩余的方法。这减轻了指定所有可能的全比较操作的工作。

该类必须定义以下比较方法之一：`__lt__()` (小于) 、`__le__()` (小于等于)、`__gt__()` (大于) 或 `__ge__()` (大于等于)。此外，该类还应提供 `__eq__()` (等于) 方法。

例如:

```python
@total_ordering
class Student:
    def _is_valid_operand(self, other):
        return (hasattr(other, "lastname") and
                hasattr(other, "firstname"))
    def __eq__(self, other):
        if not self._is_valid_operand(other):
            return NotImplemented
        return ((self.lastname.lower(), self.firstname.lower()) ==
                (other.lastname.lower(), other.firstname.lower()))
    def __lt__(self, other):
        if not self._is_valid_operand(other):
            return NotImplemented
        return ((self.lastname.lower(), self.firstname.lower()) <
                (other.lastname.lower(), other.firstname.lower()))
```

备注

虽然此装饰器使得创建具有良好行为的完全有序类型变得非常容易，但它 _确实_ 是以执行速度更缓慢和派生比较方法的堆栈回溯更复杂为代价的。 如果性能基准测试表明这是特定应用的瓶颈所在，则改为实现全部六个富比较方法应该会轻松提升速度。

备注

这个装饰器不会尝试重写类 _或其上级类_ 中已经被声明的方法。这意味着如果某个上级类定义了比较运算符，则 _total\_ordering_ 将不会再次实现它，即使原方法是抽象方法。

版本 3.2 中新增。

在 3.4 版本发生变更: 现在已支持从未识别类型的下层比较函数返回 `NotImplemented`。

**functools.Placeholder**

一个单例对象，在调用 `partial()` 和 `partialmethod()` 时被用作给位置参数保留位置的哨兵值。

版本 3.14 中新增。

**functools.partial(_func_, _/_, _\*args_, _\*\*keywords_)**

返回一个新的 部分对象，当被调用时其行为类似于 _func_ 附带位置参数 _args_ 和关键字参数 _keywords_ 被调用。如果为调用提供了更多的参数，它们会被附加到 _args_。如果提供了额外的关键字参数，它们会扩展并重写 _keywords_。大致等价于:

```python
def partial(func, /, *args, **keywords):
    def newfunc(*more_args, **more_keywords):
        return func(*args, *more_args, **(keywords | more_keywords))
    newfunc.func = func
    newfunc.args = args
    newfunc.keywords = keywords
    return newfunc
```

`partial()` 被用于部分函数应用，它“冻结”一部分函数的参数和/或关键字从而得到一个具有简化签名的新对象。 例如，`partial()` 可被用来创建一个行为类似于 `int()` 函数的可调用对象，其中 _base_ 参数默认值为 `2`:

```python
>>> basetwo = partial(int, base=2)
>>> basetwo.__doc__ = 'Convert base 2 string to an int.'
>>> basetwo('10010')
18
```

如果 `Placeholder` 哨兵出现在 _args_ 中，它们将在调用 `partial()` 时首先被填充。 这使得通过调用 `partial()` 来预先填充任何位置参数成为可能；如果没有 `Placeholder`，则只能预填充选定数量的前导位置参数。

如果有任何 `Placeholder` 哨兵存在，则必须在调用时填充所有哨兵：

```python
>>> say_to_world = partial(print, Placeholder, Placeholder, "world!")
>>> say_to_world('Hello', 'dear')
Hello dear world!
```

调用 `say_to_world('Hello')` 会引发 `TypeError`，因为只提供了一个位置参数，但有两个必须填充的占位符。

如果 `partial()` 被应用到现有的 partial 对象上，输入对象中的 `Placeholder` 哨兵值会被新的位置实参填充。要保留某个占位符，可以在原先 `Placeholder` 所在的位置再插入一个新的 `Placeholder` 哨兵：

```python
>>> from functools import partial, Placeholder as _
>>> remove = partial(str.replace, _, _, '')
>>> message = 'Hello, dear dear world!'
>>> remove(message, ' dear')
'Hello, world!'
>>> remove_dear = partial(remove, _, ' dear')
>>> remove_dear(message)
'Hello, world!'
>>> remove_first_dear = partial(remove_dear, _, 1)
>>> remove_first_dear(message)
'Hello, dear world!'
```

`Placeholder` 不能作为关键字参数传递给 `partial()`。

在 3.14 版本发生变更: 增加了对位置参数 `Placeholder` 的支持。

**functools.partialmethod(_func_, _/_, _\*args_, _\*\*keywords_)**

返回一个新的 `partialmethod` 描述器，其行为类似 `partial` 但它被设计用作方法定义而非直接用作可调用对象。

_func_ 必须是一个 descriptor 或可调用对象（同属两者的对象例如普通函数会被当作描述器来处理）。

当 _func_ 是一个描述器（例如普通 Python 函数，`classmethod()`、 `staticmethod()`、 `abstractmethod()` 或其他 `partialmethod` 的实例）时，对 `__get__` 的调用会被委托给底层的描述器，并会返回一个适当的 部分对象 作为结果。

当 _func_ 是一个非描述器类可调用对象时，则会动态创建一个适当的绑定方法。当用作方法时其行为类似普通 Python 函数：将会插入 _self_ 参数作为第一个位置参数，其位置甚至会处于提供给 `partialmethod` 构造器的 _args_ 和 _keywords_ 之前。

示例:

```python
>>> class Cell:
...     def __init__(self):
...         self._alive = False
...     @property
...     def alive(self):
...         return self._alive
...     def set_state(self, state):
...         self._alive = bool(state)
...     set_alive = partialmethod(set_state, True)
...     set_dead = partialmethod(set_state, False)
...
>>> c = Cell()
>>> c.alive
False
>>> c.set_alive()
>>> c.alive
True
```

版本 3.4 中新增。

**functools.reduce(_function_, _iterable_, _/_\[, _initial_\])**

将两个参数的  从左至右累积地应用到 _iterable_ 的条目，以便将该可迭代对象缩减为单个值。 例如，`reduce(lambda x, y: x+y, [1, 2, 3, 4, 5])` 就是计算 `((((1+2)+3)+4)+5)`。 左边的参数 _x_ 是累积的值而右边的参数 _y_ 则是来自 _iterable_ 的更新值。如果存在可选项 _initial_，它会被放在参与计算的可迭代对象的条目之前，并在可迭代对象为空时作为默认值。如果未给出 _initial_ 并且 _iterable_ 仅包含一个条目，则将返回第一项。

大致相当于:

```python
initial_missing = object()

def reduce(function, iterable, /, initial=initial_missing):
    it = iter(iterable)
    if initial is initial_missing:
        value = next(it)
    else:
        value = initial
    for element in it:
        value = function(value, element)
    return value
```

请参阅 `itertools.accumulate()` 了解有关可产生所有中间值的迭代器。

在 3.14 版本发生变更: 现在支持 _initial_ 作为关键字参数。

**@functools.singledispatch**

将一个函数转换为 单分派 generic function。

要定义一个泛型函数，用装饰器 `@singledispatch` 来装饰它。当使用 `@singledispatch` 定义一个函数时，请注意调度发生在第一个参数的类型上:

```python
>>> from functools import singledispatch
>>> @singledispatch
... def fun(arg, verbose=False):
...     if verbose:
...         print("Let me just say,", end=" ")
...     print(arg)
```

要将重载的实现添加到函数中，请使用泛型函数的 `register()` 属性，它可以被用作装饰器。 对于带有类型标注的函数，该装饰器将自动推断第一个参数的类型:

```python
>>> @fun.register
... def _(arg: int, verbose=False):
...     if verbose:
...         print("Strength in numbers, eh?", end=" ")
...     print(arg)
...
>>> @fun.register
... def _(arg: list, verbose=False):
...     if verbose:
...         print("Enumerate this:")
...     for i, elem in enumerate(arg):
...         print(i, elem)
```

还可以使用 `typing.Union`:

```python
>>> @fun.register
... def _(arg: int | float, verbose=False):
...     if verbose:
...         print("Strength in numbers, eh?", end=" ")
...     print(arg)
...
>>> from typing import Union
>>> @fun.register
... def _(arg: Union[list, set], verbose=False):
...     if verbose:
...         print("Enumerate this:")
...     for i, elem in enumerate(arg):
...         print(i, elem)
...
```

对于不使用类型标注的代码，可以将适当的类型参数显式地传给装饰器本身:

```python
>>> @fun.register(complex)
... def _(arg, verbose=False):
...     if verbose:
...         print("Better than complicated.", end=" ")
...     print(arg.real, arg.imag)
...
```

对于在多项集类型 (例如 `list`) 上分派，但希望对多项集中的项设置类型提示 (例如 `list[int]`) 的代码，分派类型应当被显式地传给装饰器本身并将类型提示放在函数定义中:

```python
>>> @fun.register(list)
... def _(arg: list[int], verbose=False):
...     if verbose:
...         print("Enumerate this:")
...     for i, elem in enumerate(arg):
...         print(i, elem)
```

备注

当运行时函数将在一个列表的实例上分派而不管列表中包含的类型是什么，也就是说 `[1,2,3]` 将以与 `["foo", "bar", ]` 相同的方式分派。在本例中提供的标注仅针对静态类型检查器而在运行时没有影响。

要启用注册 lambda 和现有的函数，也可以使用 `register()` 属性的函数形式:

```python
>>> def nothing(arg, verbose=False):
...     print("Nothing.")
...
>>> fun.register(type(None), nothing)
```

`register()` 属性会返回未被装饰的函数。 这将启用装饰器栈、`pickling`，并为每个变体单独创建单元测试:

```python
>>> @fun.register(float)
... @fun.register(Decimal)
... def fun_num(arg, verbose=False):
...     if verbose:
...         print("Half of your number:", end=" ")
...     print(arg / 2)
...
>>> fun_num is fun
False
```

在调用时，泛型函数会根据第一个参数的类型进行分派:

```python
>>> fun("Hello, world.")
Hello, world.
>>> fun("test.", verbose=True)
Let me just say, test.
>>> fun(42, verbose=True)
Strength in numbers, eh? 42
>>> fun(['spam', 'spam', 'eggs', 'spam'], verbose=True)
Enumerate this:
0 spam
1 spam
2 eggs
3 spam
>>> fun(None)
Nothing.
>>> fun(1.23)
0.615
```

在没有针对特定类型的已注册实现的情况下，会使用其方法解析顺序来查找更通用的实现。使用 `@singledispatch` 装饰的原始函数将为基本的 `object` 类型进行注册，这意味着它将在找不到更好的实现时被使用。

如果一个实现被注册到 abstract base class，则基类的虚拟子类将被分派到该实现:

```python
>>> from collections.abc import Mapping
>>> @fun.register
... def _(arg: Mapping, verbose=False):
...     if verbose:
...         print("Keys & Values")
...     for key, value in arg.items():
...         print(key, "=>", value)
...
>>> fun({"a": "b"})
a => b
```

要检查泛型函数将为给定的类型选择哪个实现，请使用 `dispatch()` 属性:

```python
>>> fun.dispatch(float)
<function fun_num at 0x1035a2840>
>>> fun.dispatch(dict)    # 注：默认实现
<function fun at 0x103fe0000>
```

要访问所有已注册实现，请使用只读的 `registry` 属性:

```python
>>> fun.registry.keys()
dict_keys([<class 'NoneType'>, <class 'int'>, <class 'object'>,
          <class 'decimal.Decimal'>, <class 'list'>,
          <class 'float'>])
>>> fun.registry[float]
<function fun_num at 0x1035a2840>
>>> fun.registry[object]
<function fun at 0x103fe0000>
```

版本 3.4 中新增。

在 3.7 版本发生变更: `register()` 属性现在支持使用类型注解。

在 3.11 版本发生变更: `register()` 属性现在支持 `typing.Union` 作为类型注解。

**functools.singledispatchmethod(_func_)**

将一个方法转换为 单分派 generic function。

要定义一个泛型方法，请用 `@singledispatchmethod` 装饰器来装饰它。当定义使用 `@singledispatchmethod` 的方法时，请注意操作将针对第一个非 _self_ 或非 _cls_ 参数的类型:

```python
class Negator:
    @singledispatchmethod
    def neg(self, arg):
        raise NotImplementedError("Cannot negate a")

    @neg.register
    def _(self, arg: int):
        return -arg

    @neg.register
    def _(self, arg: bool):
        return not arg
```

`@singledispatchmethod` 支持与其他装饰器如 `@classmethod` 相嵌套。请注意为了允许 `dispatcher.register`，`singledispatchmethod` 必须是 _最外层的_ 装饰器。下面的 `Negator` 类具有绑定到类的 `neg` 方法，而不是绑定到类的实例:

```python
class Negator:
    @singledispatchmethod
    @classmethod
    def neg(cls, arg):
        raise NotImplementedError("Cannot negate a")

    @neg.register
    @classmethod
    def _(cls, arg: int):
        return -arg

    @neg.register
    @classmethod
    def _(cls, arg: bool):
        return not arg
```

同样的模式也可被用于其他类似的装饰器：`@staticmethod`, `@abc.abstractmethod` 等等。

版本 3.8 中新增。

**functools.update\_wrapper(_wrapper_, _wrapped_, _assigned\=WRAPPER\_ASSIGNMENTS_, _updated\=WRAPPER\_UPDATES_)**

更新一个 _包装器_ 函数以使其与 _被包装的_ 函数相似。 可选参数为指明原函数的哪些属性要被直接赋值给包装器函数的相匹配属性的元组以及包装器的哪些属性要使用原函数的相应属性来更新。这些参数的默认值是模块级常量 `WRAPPER_ASSIGNMENTS` (它将被赋值给包装器函数的 `__module__`, `__name__`, `__qualname__`, `__annotations__`, `__type_params__` 和 `__doc__`，即文档字符串) 以及 `WRAPPER_UPDATES` (它将更新包装器函数的 `__dict__`，即实例字典)。

为了便于内省等用途访问原函数（例如绕过 `@lru_cache` 这类缓存装饰器），本函数会自动在包装函数上添加一个指向被包装函数的 `__wrapped__` 属性。

此函数的主要目的是在 decorator 函数中用来包装被装饰的函数并返回包装器。 如果包装器函数未被更新，则被返回函数的元数据将反映包装器定义而不是原始函数定义，这通常没有什么用处。

`update_wrapper()` 可以与函数之外的可调用对象一同使用。在 _assigned_ 或 _updated_ 中命名的任何属性如果不存在于被包装对象则会被忽略（即该函数将不会尝试在包装器函数上设置它们）。如果包装器函数自身缺少在 _updated_ 中命名的任何属性则仍将引发 `AttributeError`。

在 3.2 版本发生变更: 现在 `__wrapped__` 属性会被自动添加。现在 `__annotations__` 属性默认会被拷贝。 缺失的属性不会再触发 `AttributeError`。

在 3.4 版本发生变更: `__wrapped__` 属性现在总是指向被包装的函数，即使该函数定义了 `__wrapped__` 属性。 (参见 [bpo-17482](https://bugs.python.org/issue?@action=redirect&bpo=17482))

在 3.12 版本发生变更: 现在 `__type_params__` 属性默认会被拷贝。

**@functools.wraps(_wrapped_, _assigned\=WRAPPER\_ASSIGNMENTS_, _updated\=WRAPPER\_UPDATES_)**

这是一个便捷函数，用于在定义包装器函数时调用 `update_wrapper()` 作为函数装饰器。它等价于 `partial(update_wrapper, wrapped=wrapped, assigned=assigned, updated=updated)`。例如:

```python
>>> from functools import wraps
>>> def my_decorator(f):
...     @wraps(f)
...     def wrapper(*args, **kwds):
...         print('Calling decorated function')
...         return f(*args, **kwds)
...     return wrapper
...
>>> @my_decorator
... def example():
...     """Docstring"""
...     print('Called example function')
...
>>> example()
Calling decorated function
Called example function
>>> example.__name__
'example'
>>> example.__doc__
'Docstring'
```

如果不使用这个装饰器工厂函数，则 example 函数的名称将变为 `'wrapper'`，并且 `example()` 原本的文档字符串将会丢失。

## `partial` 对象

`partial` 对象是由 `partial()` 创建的可调用对象。它们具有三个只读属性：

**partial.func**

一个可调用对象或函数。对 `partial` 对象的调用将被转发给 `func` 并附带新的参数和关键字。

**partial.args**

最左边的位置参数将放置在提供给 `partial` 对象调用的位置参数之前。

**partial.keywords**

当调用 `partial` 对象时将要提供的关键字参数。

`partial` 对象与 函数对象 的类似之处在于它们都是可调用、可弱引用并可具有属性的。 但两者也存在一些重要的区别。 例如，`__name__` 和 `__doc__` 属性不会被自动创建。

---

> **来源**：本文为 [functools —— 高阶函数和可调用对象上的操作](https://docs.python.org/zh-cn/3/library/functools.html) 一页的完整翻译，作者 Python 软件基金会（PSF），许可 PSF 许可证第 2 版。抓取于 2026-09-13（Python 3.14 官方文档）。原计划的 Real Python《Primer on Python Decorators》因版权所有、未开放全文转载而未采用，原文链接保留供延伸阅读：[Primer on Python Decorators](https://realpython.com/primer-on-python-decorators/)（作者 Geir Arne Hjelle）。

---

> 编者注：Real Python 原文不可全文转载，且 Python 3.14 的《函数式编程指引》中已无独立的装饰器章节，故本篇以官方 `functools` 模块文档全文为主体——它是标准库中"现成装饰器"的权威清单（`wraps`/`lru_cache`/`cache`/`cached_property`/`singledispatch`/`total_ordering` 等）。装饰器机制本身的极简模型：`@dec` 等价于 `f = dec(f)`，即"接收一个函数、返回一个新函数"；带参数的装饰器再多包一层工厂；包装函数请默认加 `@functools.wraps(func)` 以保留元信息。实战范例可参见本模块 FastAPI 的 `@app.get()`、pytest 的 `@pytest.fixture`。
