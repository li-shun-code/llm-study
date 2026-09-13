---
title: collections 容器数据类型（Counter/deque/defaultdict/OrderedDict）
source_url: https://docs.python.org/zh-cn/3/library/collections.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-13
translated: false
order: 9
versions: Python 3.14 文档
---

这个模块实现了一些专门化的容器，提供了对 Python 的通用内建容器 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html)、[`list`](https://docs.python.org/zh-cn/3/library/stdtypes.html)、[`set`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 和 [`tuple`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的补充。

`namedtuple()`

一个工厂函数，用来创建元组的子类，子类的字段是有名称的。

`deque`

类似列表的容器，但 append 和 pop 在其两端的速度都很快。

`ChainMap`

类似字典的类，用于创建包含多个映射的单个视图。

`Counter`

用于计数 [hashable](https://docs.python.org/zh-cn/3/glossary.html) 对象的字典子类

`OrderedDict`

字典的子类，能记住条目被添加进去的顺序。

`defaultdict`

字典的子类，通过调用用户指定的工厂函数，为键提供默认值。

`UserDict`

封装了字典对象，简化了字典子类化

`UserList`

封装了列表对象，简化了列表子类化

`UserString`

封装了字符串对象，简化了字符串子类化

## `ChainMap` 对象

`ChainMap` 类将多个映射迅速地链到一起，这样它们就可以作为一个单元处理。这通常比创建一个新字典再重复地使用 [`update()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 要快得多。

这个类可以用于模拟嵌套作用域，并且在模板化时很有用。

*class* `collections.ChainMap(*maps)`

一个 `ChainMap` 将多个字典或者其他映射组合在一起，创建一个单独的可更新的视图。 如果没有指定任何 _maps_，一个空字典会被作为 _maps_。这样，每个新链至少包含一个映射。

底层映射被存储在一个列表中。这个列表是公开的，可以通过 _maps_ 属性存取和更新。没有其他的状态。

搜索查询底层映射，直到一个键被找到。不同的是，写，更新和删除只操作第一个映射。

一个 `ChainMap` 通过引用合并底层映射。 所以，如果一个底层映射更新了，这些更改会反映到 `ChainMap` 。

支持所有常用字典方法。另外还有一个 _maps_ 属性(attribute)，一个创建子上下文的方法(method)， 一个存取它们首个映射的属性(property):

maps

一个可以更新的映射列表。这个列表是按照第一次搜索到最后一次搜索的顺序组织的。它是仅有的存储状态，可以被修改。列表最少包含一个映射。

`new_child(m=None, **kwargs)`

返回一个新的 `ChainMap`，其中包含一个新的映射，后面跟随当前实例中的所有映射。 如果指定了 `m`，它会成为新的映射加在映射列表的前面；如果未指定，则会使用一个空字典，因此调用 `d.new_child()` 就等价于 `ChainMap({}, *d.maps)`。 如果指定了任何关键字参数，它们会更新所传入的映射或新的空字典。 此方法被用于创建子上下文，它可在不改变任何上级映射的情况下被更新。

parents

属性返回一个新的 `ChainMap` 包含所有的当前实例的映射，除了第一个。这样可以在搜索的时候跳过第一个映射。 使用的场景类似在 [nested scopes](https://docs.python.org/zh-cn/3/glossary.html) 嵌套作用域中使用 [`nonlocal`](https://docs.python.org/zh-cn/3/reference/simple_stmts.html) 关键词。用例也可以类比内建函数 [`super()`](https://docs.python.org/zh-cn/3/library/functions.html) 。一个 `d.parents` 的引用等价于 `ChainMap(*d.maps[1:])` 。

注意，`ChainMap` 的迭代顺序是通过从后往前扫描所有映射来确定的:

```plain
>>> baseline = {'music': 'bach', 'art': 'rembrandt'}
>>> adjustments = {'art': 'van gogh', 'opera': 'carmen'}
>>> list(ChainMap(adjustments, baseline))
['music', 'art', 'opera']
```

使得顺序与从最后一个映射开始调用一系列 [`dict.update()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 得到的字典的迭代顺序相同:

```plain
>>> combined = baseline.copy()
>>> combined.update(adjustments)
>>> list(combined)
['music', 'art', 'opera']
```

参见

-   [MultiContext class](https://github.com/enthought/codetools/blob/4.0.0/codetools/contexts/multi_context.py) 在 Enthought [CodeTools package](https://github.com/enthought/codetools) 有支持写映射的选项。
    
-   Django 中用于模板的 [Context class](https://github.com/django/django/blob/main/django/template/context.py) 是只读的映射链。 它还具有上下文推送和弹出特性，类似于 `new_child()` 方法和 `parents` 特征属性。
    
-   [Nested Contexts recipe](https://code.activestate.com/recipes/577434-nested-contexts-a-chain-of-mapping-objects/) 提供了对于写入和其他修改是只应用于链路中第一个映射还是所有映射的选项。
    
-   一个 [极简的只读版 Chainmap](https://code.activestate.com/recipes/305268/).
    

### `ChainMap` 例子和方法

这一节提供了多个使用链映射的案例。

模拟 Python 内部 lookup 链的例子:

```python
import builtins
pylookup = ChainMap(locals(), globals(), vars(builtins))
```

让用户指定的命令行参数优先于环境变量，优先于默认值的例子

```python
import os, argparse

defaults = {'color': 'red', 'user': 'guest'}

parser = argparse.ArgumentParser()
parser.add_argument('-u', '--user')
parser.add_argument('-c', '--color')
namespace = parser.parse_args()
command_line_args = {k: v for k, v in vars(namespace).items() if v is not None}

combined = ChainMap(command_line_args, os.environ, defaults)
print(combined['color'])
print(combined['user'])
```

用 `ChainMap` 类模拟嵌套上下文的例子

```python
c = ChainMap()        # 创建根上下文
d = c.new_child()     # 创建嵌套的子上下文
e = c.new_child()     # c 的子上下文，独立于 d
e.maps[0]             # 当前上下文字典 -- 类似 Python 的 locals()
e.maps[-1]            # 根上下文 -- 类似 Python 的 globals()
e.parents             # 闭包的上下文链 -- 类似 Python 的 nonlocals

d['x'] = 1            # 在当前上下文中设置值
d['x']                # 在上下文链中获取第一个键
del d['x']            # 在当前上下文中删除
list(d)               # 所有嵌套的值
k in d                # 检查所有嵌套的值
len(d)                # 嵌套的值的数量
d.items()             # 所有嵌套的条目
dict(d)               # 展平为一个常规字典
```

`ChainMap` 类只更新链中的第一个映射，但lookup会搜索整个链。 然而，如果需要深度写和删除，也可以很容易的通过定义一个子类来实现它

```plain
class DeepChainMap(ChainMap):
    'Variant of ChainMap that allows direct updates to inner scopes'

    def __setitem__(self, key, value):
        for mapping in self.maps:
            if key in mapping:
                mapping[key] = value
                return
        self.maps[0][key] = value

    def __delitem__(self, key):
        for mapping in self.maps:
            if key in mapping:
                del mapping[key]
                return
        raise KeyError(key)

>>> d = DeepChainMap({'zebra': 'black'}, {'elephant': 'blue'}, {'lion': 'yellow'})
>>> d['lion'] = 'orange'         # 更新向下两级的现有键
>>> d['snake'] = 'red'           # 添加新键到最高层级的字典
>>> del d['elephant']            # 移除向下一级的现有键
>>> d                            # 显示结果
DeepChainMap({'zebra': 'black', 'snake': 'red'}, {}, {'lion': 'orange'})
```

## `Counter` 对象

一个计数器工具，为的是可以方便快速地计数。例如:

```plain
>>> # 统计一个列表中各单词的出现次数
>>> cnt = Counter()
>>> for word in ['red', 'blue', 'red', 'green', 'blue', 'blue']:
...     cnt[word] += 1
...
>>> cnt
Counter({'blue': 3, 'red': 2, 'green': 1})

>>> # 找出《哈姆雷特》中出现次数排前十的单词
>>> import re
>>> words = re.findall(r'\\w+', open('hamlet.txt').read().lower())
>>> Counter(words).most_common(10)
[('the', 1143), ('and', 966), ('to', 762), ('of', 669), ('i', 631),
 ('you', 554),  ('a', 546), ('my', 514), ('hamlet', 471), ('in', 451)]
```

*class* `collections.Counter(**kwargs)`

*class* `collections.Counter(iterable, /, **kwargs)`

*class* `collections.Counter(mapping, /, **kwargs)`

`Counter` 是 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的子类，用于计数 [hashable](https://docs.python.org/zh-cn/3/glossary.html) 对象。它是一个多项集，元素存储为字典的键而它们的计数存储为字典的值。计数可以是任何整数，包括零或负的计数值。`Counter` 类与其他语言中的 bag 或 multiset 很相似。

它可以通过计数一个 _iterable_ 中的元素来初始化，或用其它 _mapping_ (包括 counter) 初始化：

```plain
>>> c = Counter()                           # a new, empty counter
>>> c = Counter('gallahad')                 # a new counter from an iterable
>>> c = Counter({'red': 4, 'blue': 2})      # a new counter from a mapping
>>> c = Counter(cats=4, dogs=8)             # a new counter from keyword args
```

Counter 对象的接口类似于字典，不同的是，如果查询的键不在 Counter 中，它会返回一个 0 而不是引发一个 [`KeyError`](https://docs.python.org/zh-cn/3/library/exceptions.html)：

```plain
>>> c = Counter(['eggs', 'ham'])
>>> c['bacon']                              # count of a missing element is zero
0
```

设置一个计数为0不会从计数器中移去一个元素。使用 `del` 来删除它:

```plain
>>> c['sausage'] = 0                        # counter entry with a zero count
>>> del c['sausage']                        # del actually removes the entry
```

Counter 对象在对所有字典可用的方法以外还支持一些附加方法:

`elements()`

返回一个迭代器，其中每个元素将重复出现计数值所指定次。 元素会按首次出现的顺序返回。 如果一个元素的计数值小于一，`elements()` 将会忽略它。

```plain
>>> c = Counter(a=4, b=2, c=0, d=-2)
>>> sorted(c.elements())
['a', 'a', 'a', 'a', 'b', 'b']
```

`most_common(n=None)`

返回一个列表，其中包含 _n_ 个最常见的元素及出现次数，按常见程度由高到低排序。 如果 _n_ 被省略或为 `None`，`most_common()` 将返回计数器中的 _所有_ 元素。 计数值相等的元素按首次出现的顺序排序：

```plain
>>> Counter('abracadabra').most_common(3)
[('a', 5), ('b', 2), ('r', 2)]
```

`subtract(**kwargs)`

`subtract(iterable, /, **kwargs)`

`subtract(mapping, /, **kwargs)`

减去一个 _可迭代对象_ 或 _映射对象_ (或 counter) 中的元素。类似于 [`dict.update()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 但是是减去而非替换。输入和输出都可以是 0 或负数。

```plain
>>> c = Counter(a=4, b=2, c=0, d=-2)
>>> d = Counter(a=1, b=2, c=3, d=4)
>>> c.subtract(d)
>>> c
Counter({'a': 3, 'b': 0, 'c': -3, 'd': -6})
```

`total()`

计算总计数值。

```plain
>>> c = Counter(a=10, b=5, c=0)
>>> c.total()
15
```

通常字典方法都可用于 `Counter` 对象，除了有两个方法工作方式与字典并不相同。

`fromkeys(iterable)`

这个类方法没有在 `Counter` 中实现。

`update(**kwargs)`

`update(iterable, /, **kwargs)`

`update(mapping, /, **kwargs)`

加上一个 _可迭代对象_ 或 _映射对象_ (或 counter) 中的元素。类似于 [`dict.update()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 但是是加上而非替换。另外，_可迭代对象_ 应当是一个元素序列，而不是一个 `(key, value)` 对的序列。

计数对象支持相等性、子集和超集关系等富比较运算符: `==`, `!=`, `<`, `<=`, `>`, `>=`。 所有这些检测会将不存在的元素当作计数值为零，因此 `Counter(a=1) == Counter(a=1, b=0)` 将返回真值。

`Counter` 对象的常用操作:

```plain
c.total()                       # 所有计数的总和
c.clear()                       # 重置所有计数
list(c)                         # 列出不同的元素
set(c)                          # 转换为集合
dict(c)                         # 转换为常规字典
c.items()                       # 访问 (元素, 计数) 对
Counter(dict(list_of_pairs))    # 转换自 (元素, 计数) 对的列表
c.most_common()[:-n-1:-1]       # n 个最不常见的元素
+c                              # 移除为零和负的计数
```

提供了几种数学运算用来合并 `Counter` 对象，产生多集（所有计数值均大于零的 counter）。加减运算通过增加或减少两者间对应元素的计数来合并 counter。交并运算返回对应计数的最小值和最大值。相等和包含运算比较对应的计数。每个运算的参数都可以含有有符号的计数，但输出将排除计数小于等于零的元素。

```plain
>>> c = Counter(a=3, b=1)
>>> d = Counter(a=1, b=2)
>>> c + d                       # 将两个计数器相加:  c[x] + d[x]
Counter({'a': 4, 'b': 3})
>>> c - d                       # 相减（只保留为正的计数）
Counter({'a': 2})
>>> c & d                       # 交集:  min(c[x], d[x])
Counter({'a': 1, 'b': 1})
>>> c | d                       # 并集:  max(c[x], d[x])
Counter({'a': 3, 'b': 2})
>>> c == d                      # 相等:  c[x] == d[x]
False
>>> c <= d                      # 包含:  c[x] <= d[x]
False
```

单目加和减（一元操作符）意思是从空计数器加或者减去。

```plain
>>> c = Counter(a=2, b=-4)
>>> +c
Counter({'a': 2})
>>> -c
Counter({'b': 4})
```

备注

计数器主要是为了表达运行的正的计数而设计；但是，小心不要预先排除负数或者其他类型。为了帮助这些用例，这一节记录了最小范围和类型限制。

-   `Counter` 类是一个字典的子类，不限制键和值。值用于表示计数，但你实际上 _可以_ 存储任何其他值。
    
-   `most_common()` 方法只要求值是可排序的。
    
-   参与原地操作如 `c[key] += 1` 的值的类型只需要支持加和减，所以分数、小数和 decimals 都可以用，也支持负数。`update()` 和 `subtract()` 当然也一样，输入和输出都支持 0 和 负数。
    
-   多集方法是专为只会遇到正值的使用情况设计的。输入可以是 0 或负数，但只输出计数为正的值。没有类型限制，但值的类型需支持加、减和比较操作。
    
-   `elements()` 方法要求整数计数。忽略零和负数计数。
    

参见

-   Smalltalk 中的 [Bag class](https://www.gnu.org/software/smalltalk/manual-base/html_node/Bag.html)。
    
-   Wikipedia 链接 [Multisets](https://en.wikipedia.org/wiki/Multiset).
    
-   [C++ multisets](http://www.java2s.com/Tutorial/Cpp/0380__set-multiset/Catalog0380__set-multiset.htm) 教程和例子。
    
-   关于多重集合的数学运算及其用例，参考 _Knuth, Donald. The Art of Computer Programming Volume II, Section 4.6.3, Exercise 19_ 。
    
-   要在给定元素集合上枚举给定大小的所有不同多重集合，参考 [`itertools.combinations_with_replacement()`](https://docs.python.org/zh-cn/3/library/itertools.html)
    
    ```python
    map(Counter, combinations_with_replacement('ABC', 2)) # --> AA AB AC BB BC CC
    ```
    

## `deque` 对象

*class* `collections.deque([iterable[, maxlen]])`

返回一个新的双向队列对象，从左到右初始化(用方法 `append()`) ，从 _iterable_ （迭代对象) 数据创建。如果 _iterable_ 没有指定，新队列为空。

Deque 队列是对栈或 queue 队列的泛化（该名称的发音为 "deck"，是 "double-ended queue" 的简写形式)。 Deque 支持线程安全，高度节省内存地从 deque 的任一端添加和弹出条目，在两个方向上的大致性能均为 _O_(1)。

虽然 [`list`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 对象也支持类似的操作，但它们是针对快速的固定长度的操作进行优化而 `pop(0)` 和 `insert(0, v)` 操作对下层数据表示的大小和位置改变都将产生 _O_(_n_) 的内存移动开销。

如果 _maxlen_ 没有指定或者是 `None` ，deques 可以增长到任意长度。否则，deque就限定到指定最大长度。一旦限定长度的deque满了，当新项加入时，同样数量的项就从另一端弹出。限定长度deque提供类似Unix filter `tail` 的功能。它们同样可以用于追踪最近的事务和其他数据池活动。

双端队列是对应其内容类型的 [泛型](https://docs.python.org/zh-cn/3/library/typing.html) 对象。

双向队列(deque)对象支持以下方法：

`append(item, /)`

添加 _item_ 到双端队列的右端。

`appendleft(item, /)`

添加 _item_ 到双端队列的左端。

`clear()`

移除所有元素，使其长度为0.

`copy()`

创建一份浅拷贝。

`count(value, /)`

统计双端队列元素等于 _value_ 的个数。

`extend(iterable, /)`

扩展deque的右侧，通过添加iterable参数中的元素。

`extendleft(iterable, /)`

扩展deque的左侧，通过添加iterable参数中的元素。注意，左添加时，在结果中iterable参数中的顺序将被反过来添加。

`index(value[, start[, stop]])`

Return the position of _value_ in the deque (at or after index _start_ and before index _stop_). Returns the first match or raises [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html) if not found.

`insert(index, value, /)`

Insert _value_ into the deque at position _index_.

如果插入会导致一个限长 deque 超出长度 _maxlen_ 的话，就引发一个 [`IndexError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

`pop()`

移去并且返回一个元素，deque 最右侧的那一个。 如果没有元素的话，就引发一个 [`IndexError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

`popleft()`

移去并且返回一个元素，deque 最左侧的那一个。 如果没有元素的话，就引发 [`IndexError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

`remove(value, /)`

移除找到的第一个 _value_。 如果没有的话就引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

`reverse()`

将deque逆序排列。返回 `None` 。

`rotate(n=1, /)`

向右循环移动 _n_ 步。 如果 _n_ 是负数，就向左循环。

如果deque不是空的，向右循环移动一步就等价于 `d.appendleft(d.pop())` ， 向左循环一步就等价于 `d.append(d.popleft())` 。

Deque对象同样提供了一个只读属性:

maxlen

Deque的最大尺寸，如果没有限定的话就是 `None` 。

在上述操作以外，deque 还支持迭代, 封存, `len(d)`, `reversed(d)`, `copy.copy(d)`, `copy.deepcopy(d)`, 使用 [`in`](https://docs.python.org/zh-cn/3/reference/expressions.html) 运算符的成员检测以及下标引用例如通过 `d[0]` 访问首个元素等。 索引访问在两端的时间复杂度均为 _O_(1) 但在中间则会低至 _O_(_n_)。 对于快速随机访问，请改用列表。

Deque从版本3.5开始支持 `__add__()`, `__mul__()`, 和 `__imul__()` 。

示例:

```plain
>>> from collections import deque
>>> d = deque('ghi')                 # 新建一个包含三项的双端队列
>>> for elem in d:                   # 迭代双端队列的元素
...     print(elem.upper())
G
H
I

>>> d.append('j')                    # 添加一个新条目到右端
>>> d.appendleft('f')                # 添加一个新条目到左端
>>> d                                # 显示双端队列的表示形式
deque(['f', 'g', 'h', 'i', 'j'])

>>> d.pop()                          # 返回并移除最右端的项
'j'
>>> d.popleft()                      # 返回并移除最左端的项
'f'
>>> list(d)                          # 列出双端队列的内容
['g', 'h', 'i']
>>> d[0]                             # 查看最左端的项
'g'
>>> d[-1]                            # 查看最右端的项
'i'

>>> list(reversed(d))                # 反向列出双端队列的内容
['i', 'h', 'g']
>>> 'h' in d                         # 搜索双端队列
True
>>> d.extend('jkl')                  # 一次添加多个元素
>>> d
deque(['g', 'h', 'i', 'j', 'k', 'l'])
>>> d.rotate(1)                      # 向右轮转
>>> d
deque(['l', 'g', 'h', 'i', 'j', 'k'])
>>> d.rotate(-1)                     # 向左轮转
>>> d
deque(['g', 'h', 'i', 'j', 'k', 'l'])

>>> deque(reversed(d))               # 新建一个反向的双端队列
deque(['l', 'k', 'j', 'i', 'h', 'g'])
>>> d.clear()                        # 清空双端队列
>>> d.pop()                          # 无法从空的双端队列弹出元素
Traceback (most recent call last):
    File "<pyshell#6>", line 1, in -toplevel-
        d.pop()
IndexError: pop from an empty deque

>>> d.extendleft('abc')              # extendleft() 将反转输入顺序
>>> d
deque(['c', 'b', 'a'])
```

### `deque` 用法

这一节展示了deque的多种用法。

限长deque提供了类似Unix `tail` 过滤功能

```python
def tail(filename, n=10):
    '返回文件的最后 n 行'
    with open(filename) as f:
        return deque(f, n)
```

另一个用法是维护一个近期添加元素的序列，通过从右边添加和从左边弹出

```plain
def moving_average(iterable, n=3):
    # moving_average([40, 30, 50, 46, 39, 44]) --> 40.0 42.0 45.0 43.0
    # https://en.wikipedia.org/wiki/Moving_average
    it = iter(iterable)
    d = deque(itertools.islice(it, n-1))
    d.appendleft(0)
    s = sum(d)
    for elem in it:
        s += elem - d.popleft()
        d.append(elem)
        yield s / n
```

A [round-robin scheduler](https://en.wikipedia.org/wiki/Round-robin_scheduling) can be implemented with input iterators stored in a `deque`. Values are yielded from the active iterator in position zero. If that iterator is [exhausted](https://docs.python.org/zh-cn/3/glossary.html), it can be removed with `popleft()`; otherwise, it can be cycled back to the end with the `rotate()` method:

```plain
def roundrobin(*iterables):
    "roundrobin('ABC', 'D', 'EF') --> A D E B F C"
    iterators = deque(map(iter, iterables))
    while iterators:
        try:
            while True:
                yield next(iterators[0])
                iterators.rotate(-1)
        except StopIteration:
            # 移除已耗尽的迭代器。
            iterators.popleft()
```

`rotate()` 方法提供了一种方式来实现 `deque` 切片和删除。 例如，一个纯的 Python `del d[n]` 实现依赖于 `rotate()` 来定位要弹出的元素

```python
def delete_nth(d, n):
    d.rotate(-n)
    d.popleft()
    d.rotate(n)
```

要实现 `deque` 切片， 使用一个类似的方法，应用 `rotate()` 将目标元素放到左边。通过 `popleft()` 移去老的条目（entries），通过 `extend()` 添加新的条目， 然后反向 rotate。基于这种方法的微小变化，很容易实现 Forth 风格的栈操作，诸如 `dup`, `drop`, `swap`, `over`, `pick`, `rot`, 和 `roll` 。

## `defaultdict` 对象

*class* `collections.defaultdict(_default_factory=None_, /, **kwargs)`

*class* `collections.defaultdict(_default_factory_, mapping, /, **kwargs)`

*class* `collections.defaultdict(_default_factory_, iterable, /, **kwargs)`

返回一个新的类似字典的对象。 `defaultdict` 是内置 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 类的子类。 它重写了一个方法并添加了一个可写的实例变量。 其余的功能与 `dict` 类相同因而不在此文档中写明。

本对象包含一个名为 `default_factory` 的属性，构造时，第一个参数用于为该属性提供初始值，默认为 `None`。所有其他参数（包括关键字参数）都相当于传递给 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的构造函数。

`defaultdict`s are [generic](https://docs.python.org/zh-cn/3/library/typing.html) over two types, signifying (respectively) the types of the dictionary's keys and values.

`defaultdict` 对象除了支持标准 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的操作，还支持以下方法作为扩展：

`__missing__(key, /)`

如果 `default_factory` 属性为 `None`，则调用本方法会抛出 [`KeyError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 异常，附带参数 _key_。

如果 `default_factory` 不为 `None`，则它会被（不带参数地）调用来为 _key_ 提供一个默认值，这个值和 _key_ 作为一对键值对被插入到字典中，并作为本方法的返回值返回。

如果调用 `default_factory` 时抛出了异常，这个异常会原封不动地向外层传递。

当请求的键未找到时本方法会被 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 类的 [`__getitem__()`](https://docs.python.org/zh-cn/3/reference/datamodel.html) 方法调用；它返回或引发的任何对象都会被 `__getitem__()` 返回或引发。

请注意除了 [`__getitem__()`](https://docs.python.org/zh-cn/3/reference/datamodel.html) 以外 `__missing__()` 将 _不会_ 被调用以执行任何操作。 这意味着 [`get()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 会像普通字典一样返回 `None` 作为默认值而不是使用 `default_factory`。

`defaultdict` 对象支持以下实例变量：

default_factory

本属性由 `__missing__()` 方法来调用。如果构造对象时提供了第一个参数，则本属性会被初始化成那个参数，如果未提供第一个参数，则本属性为 `None`。

### `defaultdict` 例子

使用 [`list`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 作为 `default_factory`，很轻松地将（键-值对组成的）序列转换为（键-列表组成的）字典：

```plain
>>> s = [('yellow', 1), ('blue', 2), ('yellow', 3), ('blue', 4), ('red', 1)]
>>> d = defaultdict(list)
>>> for k, v in s:
...     d[k].append(v)
...
>>> sorted(d.items())
[('blue', [2, 4]), ('red', [1]), ('yellow', [1, 3])]
```

当每个键首次被遇到时，它还不在映射之中；所以会使用 `default_factory` 函数自动创建一个条目，该函数返回一个空的 [`list`](https://docs.python.org/zh-cn/3/library/stdtypes.html)。 随后将使用 [`list.append()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 操作将值添加到这个新列表中。 当再次遇到该键时，将正常地执行查找并且 `list.append()` 操作会将另一个值添加到列表中。 这个做法相比使用 [`dict.setdefault()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的等价做法更简单更快速：

```plain
>>> d = {}
>>> for k, v in s:
...     d.setdefault(k, []).append(v)
...
>>> sorted(d.items())
[('blue', [2, 4]), ('red', [1]), ('yellow', [1, 3])]
```

设置 `default_factory` 为 [`int`](https://docs.python.org/zh-cn/3/library/functions.html)，使 `defaultdict` 用于计数（类似其他语言中的 bag 或 multiset）：

```plain
>>> s = 'mississippi'
>>> d = defaultdict(int)
>>> for k in s:
...     d[k] += 1
...
>>> sorted(d.items())
[('i', 4), ('m', 1), ('p', 2), ('s', 4)]
```

当一个字母首次遇到时，它会查询失败，则 `default_factory` 会调用 [`int()`](https://docs.python.org/zh-cn/3/library/functions.html) 来提供一个整数 0 作为默认值。后续的自增操作建立起对每个字母的计数。

函数 [`int()`](https://docs.python.org/zh-cn/3/library/functions.html) 总是返回 0，这是常数函数的特殊情况。一个更快和灵活的方法是使用 lambda 函数，可以提供任何常量值（不只是0）：

```plain
>>> def constant_factory(value):
...     return lambda: value
...
>>> d = defaultdict(constant_factory('<missing>'))
>>> d.update(name='John', action='ran')
>>> '%(name)s %(action)s to %(object)s' % d
'John ran to <missing>'
```

设置 `default_factory` 为 [`set`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 使 `defaultdict` 用于构建 set 集合：

```plain
>>> s = [('red', 1), ('blue', 2), ('red', 3), ('blue', 4), ('red', 1), ('blue', 4)]
>>> d = defaultdict(set)
>>> for k, v in s:
...     d[k].add(v)
...
>>> sorted(d.items())
[('blue', {2, 4}), ('red', {1, 3})]
```

## `namedtuple()` 命名元组的工厂函数

命名元组赋予每个位置一个含义，提供可读性和自文档性。它们可以用于任何普通元组，并添加了通过名字获取值的能力，通过索引值也是可以的。

`collections.namedtuple(typename, _field_names_, *, rename=False, defaults=None, module=None)`

返回一个新的名为 _typename_ 的元组子类。 这个新子类将被用于创建具有即可通过索引和迭代又可通过属性查找来访问的字段的元组型对象。 这样的子类实例还将具有文档字符串 (包含 _typename_ 和 _field_names_) 和以 `name=value` 格式列出元组内容的 [`__repr__()`](https://docs.python.org/zh-cn/3/reference/datamodel.html) 方法以方便使用。

_field_names_ 是一个像 `[‘x’, ‘y’]` 一样的字符串序列。另外 _field_names_ 可以是一个纯字符串，用空白或逗号分隔开元素名，比如 `'x y'` 或者 `'x, y'` 。

任何有效的 Python 标识符都可以作为字段名，除了下划线开头的那些。有效标识符由字母，数字，下划线组成，但首字母不能是数字或下划线，另外不能是关键词 [`keyword`](https://docs.python.org/zh-cn/3/library/keyword.html) 比如 _class_, _for_, _return_, _global_, _pass_, 或 _raise_ 。

如果 _rename_ 为真， 无效字段名会自动转换成位置名。比如 `['abc', 'def', 'ghi', 'abc']` 转换成 `['abc', '_1', 'ghi', '_3']` ， 消除关键词 `def` 和重复字段名 `abc` 。

_defaults_ 可以为 `None` 或者是一个默认值的 [iterable](https://docs.python.org/zh-cn/3/glossary.html) 。由于带有默认值的字段必须在没有默认值的字段之后，_defaults_ 会应用到最右边的参数。比如如果字段名为 `['x', 'y', 'z']` 而默认值为 `(1, 2)` ，那么 `x` 就必须指定一个参数值 ，`y` 默认值为 `1` ， `z` 默认值为 `2` 。

如果定义了 _module_，则命名元组的 [`__module__`](https://docs.python.org/zh-cn/3/reference/datamodel.html) 属性将被设为该值。

具名元组实例毋需字典来保存每个实例的不同属性，所以它们轻量，占用的内存和普通元组一样。

要支持封存操作，应当将命名元组类赋值给一个匹配 _typename_ 的变量。

```plain
>>> # 基本示例
>>> Point = namedtuple('Point', ['x', 'y'])
>>> p = Point(11, y=22)     # 使用位置或关键字参数进行实例化
>>> p[0] + p[1]             # 像普通元组 (11, 22) 一样可索引
33
>>> x, y = p                # 像普通元组一样解包
>>> x, y
(11, 22)
>>> p.x + p.y               # 字段也可按名称访问
33
>>> p                       # 名称=值 风格的易读的 __repr__
Point(x=11, y=22)
```

命名元组尤其有用于为 [`csv`](https://docs.python.org/zh-cn/3/library/csv.html) 或 [`sqlite3`](https://docs.python.org/zh-cn/3/library/sqlite3.html) 模块返回的结果元组赋予字段名:

```python
EmployeeRecord = namedtuple('EmployeeRecord', 'name, age, title, department, paygrade')

import csv
for emp in map(EmployeeRecord._make, csv.reader(open("employees.csv", "rb"))):
    print(emp.name, emp.title)

import sqlite3
conn = sqlite3.connect('/companydata')
cursor = conn.cursor()
cursor.execute('SELECT name, age, title, department, paygrade FROM employees')
for emp in map(EmployeeRecord._make, cursor.fetchall()):
    print(emp.name, emp.title)
```

除了继承元组的方法，命名元组还支持三个额外的方法和两个属性。为了防止字段名冲突，方法和属性以下划线开始。

_classmethod_ somenamedtuple._make(_iterable_, _/_)

类方法，从已有的序列或可迭代对象创建一个新实例。

```plain
>>> t = [11, 22]
>>> Point._make(t)
Point(x=11, y=22)
```

`somenamedtuple._asdict()`

返回一个新的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) ，它将字段名称映射到它们对应的值：

```plain
>>> p = Point(x=11, y=22)
>>> p._asdict()
{'x': 11, 'y': 22}
```

`somenamedtuple.replace(**kwargs_)`

返回一个新的命名元组实例，并将指定域替换为新的值

```plain
>>> p = Point(x=11, y=22)
>>> p._replace(x=33)
Point(x=33, y=22)

>>> for partnum, record in inventory.items():
...     inventory[partnum] = record._replace(price=newprices[partnum], timestamp=time.now())
```

泛型函数 [`copy.replace()`](https://docs.python.org/zh-cn/3/library/copy.html) 也支持具名元组。

somenamedtuple._fields

字符串元组列出了字段名。用于内省以及从现有命名元组创建一个新的命名元组类型。

```plain
>>> p._fields            # 查看字段名
('x', 'y')

>>> Color = namedtuple('Color', 'red green blue')
>>> Pixel = namedtuple('Pixel', Point._fields + Color._fields)
>>> Pixel(11, 22, 128, 255, 0)
Pixel(x=11, y=22, red=128, green=255, blue=0)
```

somenamedtuple._field_defaults

字典将字段名称映射到默认值。

```plain
>>> Account = namedtuple('Account', ['type', 'balance'], defaults=[0])
>>> Account._field_defaults
{'balance': 0}
>>> Account('premium')
Account(type='premium', balance=0)
```

要获取一个名称存储在字符串中的字段，使用 [`getattr()`](https://docs.python.org/zh-cn/3/library/functions.html) 函数:

```plain
>>> getattr(p, 'x')
11
```

转换一个字典到命名元组，使用 ** 双星操作符（如 [解包实参列表](https://docs.python.org/zh-cn/3/tutorial/controlflow.html) 所述）:

```plain
>>> d = {'x': 11, 'y': 22}
>>> Point(**d)
Point(x=11, y=22)
```

因为一个命名元组是一个正常的 Python 类，它可以很容易的通过子类更改功能。这里是如何添加一个计算域和定宽输出打印格式:

```plain
>>> class Point(namedtuple('Point', ['x', 'y'])):
...     __slots__ = ()
...     @property
...     def hypot(self):
...         return (self.x ** 2 + self.y ** 2) ** 0.5
...     def __str__(self):
...         return 'Point: x=%6.3f  y=%6.3f  hypot=%6.3f' % (self.x, self.y, self.hypot)

>>> for p in Point(3, 4), Point(14, 5/7):
...     print(p)
Point: x= 3.000  y= 4.000  hypot= 5.000
Point: x=14.000  y= 0.714  hypot=14.018
```

上面的子类设置 `__slots__` 为一个空元组。通过阻止创建实例字典保持了较低的内存开销。

子类化对于添加新的可存储字段是没有用的。应当通过 `_fields` 属性创建一个新的命名元组类型来实现:

```plain
>>> Point3D = namedtuple('Point3D', Point._fields + ('z',))
```

文档字符串可以自定义，通过直接赋值给 `__doc__` 属性:

```plain
>>> Book = namedtuple('Book', ['id', 'title', 'authors'])
>>> Book.__doc__ += ': Hardcover book in active collection'
>>> Book.id.__doc__ = '13-digit ISBN'
>>> Book.title.__doc__ = 'Title of first printing'
>>> Book.authors.__doc__ = 'List of authors sorted by last name'
```

参见

-   请参阅 [`typing.NamedTuple`](https://docs.python.org/zh-cn/3/library/typing.html) ，以获取为命名元组添加类型提示的方法。 它还使用 [`class`](https://docs.python.org/zh-cn/3/reference/compound_stmts.html) 关键字提供了一种优雅的符号:
    
    ```python
    class Component(NamedTuple):
        part_number: int
        weight: float
        description: Optional[str] = None
    ```
    

-   对于以字典为底层的可变命名空间，参考 [`types.SimpleNamespace()`](https://docs.python.org/zh-cn/3/library/types.html) 。
    
-   [`dataclasses`](https://docs.python.org/zh-cn/3/library/dataclasses.html) 模块提供了一个装饰器和一些函数，用于自动将生成的特殊方法添加到用户定义的类中。
    

## `OrderedDict` 对象

有序词典就像常规词典一样，但有一些与排序操作相关的额外功能。由于内置的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 类获得了记住插入顺序的能力（在 Python 3.7 中保证了这种新行为），它们变得不那么重要了。

一些与 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的不同仍然存在：

-   常规的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 被设计为非常擅长映射操作。 跟踪插入顺序是次要的。
    
-   `OrderedDict` 旨在擅长重新排序操作。 空间效率、迭代速度和更新操作的性能是次要的。
    
-   `OrderedDict` 算法能比 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 更好地处理频繁的重排序操作。 如下面的例程所示，这使得它更适用于实现各种 LRU 缓存。
    
-   对于 `OrderedDict` ，相等操作检查匹配顺序。
    
    常规的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 可以使用 `p == q and all(k1 == k2 for k1, k2 in zip(p, q))` 进行模拟顺序相等性测试。
    
-   `OrderedDict` 的 `popitem()` 方法具有不同的签名。 它接受一个可选参数来指定要弹出哪一项。
    
    常规的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 可以使用 `d.popitem()` 模拟 OrderedDict 的 `od.popitem(last=True)`，其保证会返回最右边（最后）的项。
    
    常规的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 可以通过 `(k := next(iter(d)), d.pop(k))` 来模拟 OrderedDict 的 `od.popitem(last=False)`，它将返回并移除最左边（开头）的条目，如果条目存在的话。
    
-   `OrderedDict` 具有一个 `move_to_end()` 方法以高效地将元素移到任一端点。
    
    常规的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 可以通过 `d[k] = d.pop(k)` 来模拟 OrderedDict 的 `od.move_to_end(k, last=True)`，它将把键及其所关联的值移到最右边（末尾）的位置。
    
    常规的 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 没有 OrderedDict 的 `od.move_to_end(k, last=False)` 的高效等价物，它会把键及其所关联的值移到最左边（开头）的位置。
    
-   在 Python 3.8 之前，[`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 都缺少 [`__reversed__()`](https://docs.python.org/zh-cn/3/reference/datamodel.html) 方法。
    

*class* `collections.OrderedDict(**kwargs)`

*class* `collections.OrderedDict(mapping, /, **kwargs)`

*class* `collections.OrderedDict(iterable, /, **kwargs)`

返回一个 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 子类的实例，它具有专门用于重新排列字典顺序的方法。

`popitem(last=True)`

有序字典的 `popitem()` 方法移除并返回一个 (key, value) 键值对。 如果 _last_ 值为真，则按 LIFO 后进先出的顺序返回键值对，否则就按 FIFO 先进先出的顺序返回键值对。

`move_to_end(key, last=True)`

将一个现有的 _key_ 移到有序字典的任一端。 如果 _last_ 为真值（默认）则将条目移到右端，或者如果 _last_ 为假值则将条目移到开头。 如果 _key_ 不存在则会引发 [`KeyError`](https://docs.python.org/zh-cn/3/library/exceptions.html):

```plain
>>> d = OrderedDict.fromkeys('abcde')
>>> d.move_to_end('b')
>>> ''.join(d)
'acdeb'
>>> d.move_to_end('b', last=False)
>>> ''.join(d)
'bacde'
```

相对于通常的映射方法，有序字典还另外提供了逆序迭代的支持，通过 [`reversed()`](https://docs.python.org/zh-cn/3/library/functions.html) 。

`OrderedDict` 对象之间的相等性检测对顺序敏感并且大致等价于 `list(od1.items())==list(od2.items())`。

`OrderedDict` 对象和其他 [`Mapping`](https://docs.python.org/zh-cn/3/library/collections.abc.html) 对象之间的相等性检测像常规字典那样对顺序不敏感。 这允许 `OrderedDict` 对象在任何可使用字典的地方被替代。

### `OrderedDict` 例子和用法

创建记住键值 _最后_ 插入顺序的有序字典变体很简单。 如果新条目覆盖现有条目，则原始插入位置将更改并移至末尾:

```python
class LastUpdatedOrderedDict(OrderedDict):
    'Store items in the order the keys were last added'

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self.move_to_end(key)
```

An `OrderedDict` would also be useful for implementing variants of [`@functools.lru_cache`](https://docs.python.org/zh-cn/3/library/functools.html):

```python
from collections import OrderedDict
from time import monotonic

class TimeBoundedLRU:
    "LRU Cache that invalidates and refreshes old entries."

    def __init__(self, func, maxsize=128, maxage=30):
        self.cache = OrderedDict()      # { args : (timestamp, result)}
        self.func = func
        self.maxsize = maxsize
        self.maxage = maxage

    def __call__(self, *args):
        if args in self.cache:
            self.cache.move_to_end(args)
            timestamp, result = self.cache[args]
            if monotonic() - timestamp <= self.maxage:
                return result
        result = self.func(*args)
        self.cache[args] = monotonic(), result
        if len(self.cache) > self.maxsize:
            self.cache.popitem(last=False)
        return result
```

```python
class MultiHitLRUCache:
    """ LRU cache that defers caching a result until
        it has been requested multiple times.

        To avoid flushing the LRU cache with one-time requests,
        we don't cache until a request has been made more than once.

    """

    def __init__(self, func, maxsize=128, maxrequests=4096, cache_after=1):
        self.requests = OrderedDict()   # { uncached_key : request_count }
        self.cache = OrderedDict()      # { cached_key : function_result }
        self.func = func
        self.maxrequests = maxrequests  # 未缓存请求的最大数量
        self.maxsize = maxsize          # 已存储返回值的最大数量
        self.cache_after = cache_after

    def __call__(self, *args):
        if args in self.cache:
            self.cache.move_to_end(args)
            return self.cache[args]
        result = self.func(*args)
        self.requests[args] = self.requests.get(args, 0) + 1
        if self.requests[args] <= self.cache_after:
            self.requests.move_to_end(args)
            if len(self.requests) > self.maxrequests:
                self.requests.popitem(last=False)
        else:
            self.requests.pop(args, None)
            self.cache[args] = result
            if len(self.cache) > self.maxsize:
                self.cache.popitem(last=False)
        return result
```

## `UserDict` 对象

`UserDict` 类是用作字典对象的外包装。对这个类的需求已部分由直接创建 [`dict`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的子类的功能所替代；不过，这个类处理起来更容易，因为底层的字典可以作为属性来访问。

*class* `collections.UserDict(**kwargs)`

*class* `collections.UserDict(mapping, /, **kwargs)`

*class* `collections.UserDict(iterable, /, **kwargs)`

Class that simulates a dictionary. The instance's contents are kept in a regular dictionary, which is accessible via the `data` attribute of `UserDict` instances. If arguments are provided, they are used to initialize `data`, like a regular dictionary.

In addition to supporting the methods and operations of mappings, `UserDict` instances provide the following attribute:

data

一个真实的字典，用于保存 `UserDict` 类的内容。

## `UserList` 对象

这个类封装了列表对象。它是一个有用的基础类，对于你想自定义的类似列表的类，可以继承和覆盖现有的方法，也可以添加新的方法。这样我们可以对列表添加新的行为。

对这个类的需求已部分由直接创建 [`list`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的子类的功能所替代；不过，这个类处理起来更容易，因为底层的列表可以作为属性来访问。

*class* `collections.UserList([list])`

模拟一个列表。这个实例的内容被保存为一个正常列表，通过 `UserList` 的 `data` 属性存取。实例内容被初始化为一个 _list_ 的copy，默认为 `[]` 空列表。 _list_ 可以是迭代对象，比如一个 Python 列表，或者一个 `UserList` 对象。

`UserList` 提供了以下属性作为可变序列的方法和操作的扩展:

data

一个 [`list`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 对象用于存储 `UserList` 的内容。

**子类化的要求:** `UserList` 的子类需要提供一个构造器，可以无参数调用，或者一个参数调用。返回一个新序列的列表操作需要创建一个实现类的实例。它假定了构造器可以以一个参数进行调用，这个参数是一个序列对象，作为数据源。

如果一个派生类不希望遵从这个要求，所有的特殊方法就必须重写；请参照源代码了解哪些方法需要提供。

## `UserString` 对象

`UserString` 类是用作字符串对象的外包装。对这个类的需求已部分由直接创建 [`str`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 的子类的功能所替代；不过，这个类处理起来更容易，因为底层的字符串可以作为属性来访问。

*class* `collections.UserString(seq)`

模拟一个字符串对象。这个实例对象的内容保存为一个正常字符串，通过 `UserString` 的 `data` 属性存取。实例内容初始化设置为 _seq_ 的copy。_seq_ 参数可以是任何可通过内建 [`str()`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 函数转换为字符串的对象。

`UserString` 提供了以下属性作为字符串方法和操作的额外支持：

data

一个真正的 [`str`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 对象用来存放 `UserString` 类的内容。

---

> **来源**：本文转载自 [collections --- 容器数据类型 - Python 3 官方文档（中文）](https://docs.python.org/zh-cn/3/library/collections.html)，作者 Python Software Foundation，许可 PSF 许可证第 2 版（转载署名）。抓取于 2026-09-13。原文为官方中文译文，本站仅做格式转换。
