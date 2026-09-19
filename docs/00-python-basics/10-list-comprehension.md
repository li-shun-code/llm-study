---
title: 列表推导式
source_url: https://liaoxuefeng.com/books/python/advanced/list-comprehension/index.html
author: 廖雪峰
license: © 廖雪峰（转载署名）
fetched_at: 2026-09-13
translated: false
order: 10
group: 容器与推导式
---
列表生成式即List Comprehensions，是Python内置的非常简单却强大的可以用来创建list的生成式。

举个例子，要生成list `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`可以用`list(range(1, 11))`：

```plain
>>> list(range(1, 11))
[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
```

但如果要生成`[1x1, 2x2, 3x3, ..., 10x10]`怎么做？方法一是循环：

```plain
>>> L = []
>>> for x in range(1, 11):
...    L.append(x * x)
...
>>> L
[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
```

但是循环太繁琐，而列表生成式则可以用一行语句代替循环生成上面的list：

```plain
>>> [x * x for x in range(1, 11)]
[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
```

写列表生成式时，把要生成的元素`x * x`放到前面，后面跟`for`循环，就可以把list创建出来，十分有用，多写几次，很快就可以熟悉这种语法。

for循环后面还可以加上if判断，这样我们就可以筛选出仅偶数的平方：

```plain
>>> [x * x for x in range(1, 11) if x % 2 == 0]
[4, 16, 36, 64, 100]
```

还可以使用两层循环，可以生成全排列：

```plain
>>> [m + n for m in 'ABC' for n in 'XYZ']
['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ']
```

三层和三层以上的循环就很少用到了。

运用列表生成式，可以写出非常简洁的代码。例如，列出当前目录下的所有文件和目录名，可以通过一行代码实现：

```plain
>>> import os # 导入os模块，模块的概念后面讲到
>>> [d for d in os.listdir('.')] # os.listdir可以列出文件和目录
['.emacs.d', '.ssh', '.Trash', 'Adlm', 'Applications', 'Desktop', 'Documents', 'Downloads', 'Library', 'Movies', 'Music', 'Pictures', 'Public', 'VirtualBox VMs', 'Workspace', 'XCode']
```

`for`循环其实可以同时使用两个甚至多个变量，比如`dict`的`items()`可以同时迭代key和value：

```plain
>>> d = {'x': 'A', 'y': 'B', 'z': 'C' }
>>> for k, v in d.items():
...     print(k, '=', v)
...
y = B
x = A
z = C
```

因此，列表生成式也可以使用两个变量来生成list：

```plain
>>> d = {'x': 'A', 'y': 'B', 'z': 'C' }
>>> [k + '=' + v for k, v in d.items()]
['y=B', 'x=A', 'z=C']
```

最后把一个list中所有的字符串变成小写：

```plain
>>> L = ['Hello', 'World', 'IBM', 'Apple']
>>> [s.lower() for s in L]
['hello', 'world', 'ibm', 'apple']
```

### if ... else

使用列表生成式的时候，有些童鞋经常搞不清楚`if...else`的用法。

例如，以下代码正常输出偶数：

```plain
>>> [x for x in range(1, 11) if x % 2 == 0]
[2, 4, 6, 8, 10]
```

但是，我们不能在最后的`if`加上`else`：

```plain
>>> [x for x in range(1, 11) if x % 2 == 0 else 0]
  File "<stdin>", line 1
    [x for x in range(1, 11) if x % 2 == 0 else 0]
                                              ^
SyntaxError: invalid syntax
```

这是因为跟在`for`后面的`if`是一个筛选条件，不能带`else`，否则如何筛选？

另一些童鞋发现把`if`写在`for`前面必须加`else`，否则报错：

```plain
>>> [x if x % 2 == 0 for x in range(1, 11)]
  File "<stdin>", line 1
    [x if x % 2 == 0 for x in range(1, 11)]
                       ^
SyntaxError: invalid syntax
```

这是因为`for`前面的部分是一个表达式，它必须根据`x`计算出一个结果。因此，考察表达式：`x if x % 2 == 0`，它无法根据`x`计算出结果，因为缺少`else`，必须加上`else`：

```plain
>>> [x if x % 2 == 0 else -x for x in range(1, 11)]
[-1, 2, -3, 4, -5, 6, -7, 8, -9, 10]
```

上述`for`前面的表达式`x if x % 2 == 0 else -x`才能根据`x`计算出确定的结果。

可见，在一个列表生成式中，`for`前面的`if ... else`是表达式，而`for`后面的`if`是过滤条件，不能带`else`。

### 练习

如果list中既包含字符串，又包含整数，由于非字符串类型没有`lower()`方法，所以列表生成式会报错：

```plain
>>> L = ['Hello', 'World', 18, 'Apple', None]
>>> [s.lower() for s in L]
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "<stdin>", line 1, in <listcomp>
AttributeError: 'int' object has no attribute 'lower'
```

使用内建的`isinstance`函数可以判断一个变量是不是字符串：

```plain
>>> x = 'abc'
>>> y = 123
>>> isinstance(x, str)
True
>>> isinstance(y, str)
False
```

请修改列表生成式，通过添加`if`语句保证列表生成式能正确地执行：

```python
L1 = ['Hello', 'World', 18, 'Apple', None]
L2 = ???

# 测试:
print(L2)
if L2 == ['hello', 'world', 'apple']:
    print('测试通过!')
else:
    print('测试失败!')
```

### 参考源码

[do_list_compr.py](https://liaoxuefeng.com/books/python/advanced/list-comprehension/do_list_compr.py)

### 小结

运用列表生成式，可以快速生成list，可以通过一个list推导出另一个list，而代码却十分简洁。

## 字典与集合推导式

> **补充**：以下两节完整选自 [Python 官方教程 · 数据结构 5.4 集合与 5.5 字典](https://docs.python.org/zh-cn/3/tutorial/datastructures.html)，作者 Python Software Foundation，许可 PSF 许可证第 2 版。

### 集合

Python 还包括一个表示 [集合](https://docs.python.org/zh-cn/3/library/stdtypes.html#types-set) 的数据类型。 集合是由不重复元素组成的无序多项集。 基本用法包括成员检测和消除重复元素。 集合对象还支持合集、交集、差集和对称差集等数学运算。

创建集合用花括号或 [`set()`](https://docs.python.org/zh-cn/3/library/stdtypes.html#set) 函数。注意，创建空集合只能用 `set()`，不能用 `{}`，`{}` 创建的是空字典，下一小节介绍数据结构：字典。

由于集合是无序的，在迭代或打印它们时可能会以不符合你预期的顺序输出元素。

以下是一些简单的示例

```plain
>>> basket = {'apple', 'orange', 'apple', 'pear', 'orange', 'banana'}
>>> print(basket)                      # 显示重复项已被移除
{'orange', 'banana', 'pear', 'apple'}
>>> 'orange' in basket                 # 快速成员检测
True
>>> 'crabgrass' in basket
False

>>> # 演示针对两个单词中独有的字母进行集合运算
>>>
>>> a = set('abracadabra')
>>> b = set('alacazam')
>>> a                                  # a 中独有的字母
{'a', 'r', 'b', 'c', 'd'}
>>> a - b                              # 存在于 a 中但不存在于 b 中的字母
{'r', 'd', 'b'}
>>> a | b                              # 存在于 a 或 b 中或两者中皆有的字母
{'a', 'c', 'r', 'd', 'b', 'm', 'z', 'l'}
>>> a & b                              # 同时存在于 a 和 b 中的字母
{'a', 'c'}
>>> a ^ b                              # 存在于 a 或 b 中但非两者中皆有的字母
{'r', 'd', 'b', 'm', 'z', 'l'}
```

与列表推导式类似，集合也支持推导式：

```plain
>>> a = {x for x in 'abracadabra' if x not in 'abc'}
>>> a
{'r', 'd'}
```

### 字典

另一个常用的 Python 内置数据类型是字典 (参见 [映射类型 --- dict](https://docs.python.org/zh-cn/3/library/stdtypes.html#typesmapping))。 字典在其他编程语言中可能称为“联合内存”或“联合数组”。 与以连续整数为索引的序列不同，字典是以键来索引的，键可以是任何不可变类型；字符串和数字总是可以作为键。 元组在其仅包含字符串、数字或元组时也可以作为键；如果一个元组直接或间接地包含了任何可变对象，则不可以用作键。 你不能使用列表作为键，因为列表可使用索引赋值、切片赋值或 [`append()`](https://docs.python.org/zh-cn/3/library/stdtypes.html#list.append) 和 [`extend()`](https://docs.python.org/zh-cn/3/library/stdtypes.html#list.extend) 等方法进行原地修改。

可以把字典理解为键值对的集合，但字典的键必须是唯一的。花括号 `{}` 用于创建空字典。另一种初始化字典的方式是，在花括号里输入逗号分隔的键值对，这也是字典的输出方式。

字典的主要操作是通过键来存储值并根据给定的键来提取值。 通过 `del` 也可以删除键值对。 如果你使用已存在的键进行存储，则与该键相关联的旧值将丢失。

通过下标操作 (`d[key]`) 提取不存在的键的值会引发 [`KeyError`](https://docs.python.org/zh-cn/3/library/exceptions.html#KeyError)。 要避免在试图访问可能不存在的键时遇到这种错误，可改用 [`get()`](https://docs.python.org/zh-cn/3/library/stdtypes.html#dict.get) 方法，它会在字典不存在某个键时返回 `None` (或指定的默认值)。

对字典执行 `list(d)` 操作，返回该字典中所有键的列表，按插入次序排列 (如需排序，请使用 `sorted(d)`)。 检查字典里是否存在某个键，使用关键字 [`in`](https://docs.python.org/zh-cn/3/reference/expressions.html#in)。

以下是一些字典的简单示例：

```plain
>>> tel = {'jack': 4098, 'sape': 4139}
>>> tel['guido'] = 4127
>>> tel
{'jack': 4098, 'sape': 4139, 'guido': 4127}
>>> tel['jack']
4098
>>> tel['irv']
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
KeyError: 'irv'
>>> print(tel.get('irv'))
None
>>> del tel['sape']
>>> tel['irv'] = 4127
>>> tel
{'jack': 4098, 'guido': 4127, 'irv': 4127}
>>> list(tel)
['jack', 'guido', 'irv']
>>> sorted(tel)
['guido', 'irv', 'jack']
>>> 'guido' in tel
True
>>> 'jack' not in tel
False
```

[`dict()`](https://docs.python.org/zh-cn/3/library/stdtypes.html#dict) 构造函数可以直接用键值对序列创建字典：

```plain
>>> dict([('sape', 4139), ('guido', 4127), ('jack', 4098)])
{'sape': 4139, 'guido': 4127, 'jack': 4098}
```

字典推导式可以用任意键值表达式创建字典：

```plain
>>> {x: x**2 for x in (2, 4, 6)}
{2: 4, 4: 16, 6: 36}
```

关键字是比较简单的字符串时，直接用关键字参数指定键值对更便捷：

```plain
>>> dict(sape=4139, guido=4127, jack=4098)
{'sape': 4139, 'guido': 4127, 'jack': 4098}
```

---

> **来源**：本文转载自 [列表生成式 - Python教程](https://liaoxuefeng.com/books/python/advanced/list-comprehension/index.html)，作者 廖雪峰，许可 © 廖雪峰（转载署名）。抓取于 2026-09-13。文中「字典与集合推导式」一节另节选自 [Python 官方教程 · 数据结构（5.4 集合 / 5.5 字典）](https://docs.python.org/zh-cn/3/tutorial/datastructures.html)，作者 Python Software Foundation，许可 PSF 许可证第 2 版。
