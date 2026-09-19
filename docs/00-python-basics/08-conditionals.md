---
title: 条件判断
source_url: https://liaoxuefeng.com/books/python/basic/if/index.html
author: 廖雪峰
license: © 廖雪峰（转载署名）
fetched_at: 2026-09-13
translated: false
order: 8
group: 控制流
---
计算机之所以能做很多自动化的任务，因为它可以自己做条件判断。

比如，输入用户年龄，根据年龄打印不同的内容，在Python程序中，用`if`语句实现：

```python
age = 20
if age >= 18:
    print('your age is', age)
    print('adult')
```

根据Python的缩进规则，如果`if`语句判断是`True`，就把缩进的两行print语句执行了，否则，什么也不做。

也可以给`if`添加一个`else`语句，意思是，如果`if`判断是`False`，不要执行`if`的内容，去把`else`执行了：

```python
age = 3
if age >= 18:
    print('your age is', age)
    print('adult')
else:
    print('your age is', age)
    print('teenager')
```

注意不要少写了冒号`:`。

当然上面的判断是很粗略的，完全可以用`elif`做更细致的判断：

```python
age = 3
if age >= 18:
    print('adult')
elif age >= 6:
    print('teenager')
else:
    print('kid')
```

`elif`是`else if`的缩写，完全可以有多个`elif`，所以`if`语句的完整形式就是：

```python
if <条件判断1>:
    <执行1>
elif <条件判断2>:
    <执行2>
elif <条件判断3>:
    <执行3>
else:
    <执行4>
```

`if`语句执行有个特点，它是从上往下判断，如果在某个判断上是`True`，把该判断对应的语句执行后，就忽略掉剩下的`elif`和`else`，所以，请测试并解释为什么下面的程序打印的是`teenager`：

```python
age = 20
if age >= 6:
    print('teenager')
elif age >= 18:
    print('adult')
else:
    print('kid')
```

`if`判断条件还可以简写，比如写：

```python
if x:
    print('True')
```

这里用到的是Python的**真值测试**：下面这些值都被视为假，其余一律为真：

| 视为假的值 | 说明 |
| --- | --- |
| `False`、`None` | 布尔假值与空值 |
| `0`、`0.0`、`0j` | 各种数值的零 |
| `''` | 空字符串 |
| `()`、`[]`、`{}`、`set()`、`range(0)` | 空元组、空列表、空字典、空集合、空区间 |

好处是 `if not rows:` 就能判断「没有数据」，不必写 `if len(rows) == 0:`。**坑也在这里**：真值测试会把 `None`、空串、空列表一并判为假，无法区分「没传值」与「传了个空值」。

```python
def search(keyword):
    # 约定：空字符串表示「搜索全部」，None 表示「没填」
    if keyword:                      # 错：空字符串与 None 落进同一分支
        pass
    if keyword is not None:          # 对：只排除「没传」这一种情况
        pass
```

规则很简单：**关心「有没有内容」用 `if x:`，关心「有没有传值」用 `if x is not None:`**。同一条约定写在 PEP 8 里（与 `None` 比较永远用 `is`），详见《PEP 8 命名与代码风格基线》。

## 再议input

最后看一个有问题的条件判断。很多同学会用`input()`读取用户的输入，这样可以自己输入，程序运行得更有意思：

```python
birth = input('birth: ')
if birth < 2000:
    print('00前')
else:
    print('00后')
```

输入`1982`，结果报错：

```plain
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: '<' not supported between instances of 'str' and 'int'
```

这是因为`input()`返回的数据类型是`str`，`str`不能直接和整数比较（Python 3 起，类型之间不允许隐式排序，直接抛 `TypeError`），必须先把`str`转换成整数。Python提供了`int()`函数来完成这件事情：

```python
s = input('birth: ')
birth = int(s)
if birth < 2000:
    print('00前')
else:
    print('00后')
```

再次运行，就可以得到正确地结果。但是，如果输入`abc`呢？又会得到一个错误信息：

```plain
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ValueError: invalid literal for int() with base 10: 'abc'
```

原来`int()`函数发现一个字符串并不是合法的数字时就会报错，程序就退出了。

如何检查并捕获程序运行期的错误呢？后面的错误和调试会讲到。

## 练习

小明身高1.75，体重80.5kg。请根据BMI公式（体重除以身高的平方）帮小明计算他的BMI指数，并根据BMI指数：

-   低于18.5：过轻
-   18.5-25：正常
-   25-28：过重
-   28-32：肥胖
-   高于32：严重肥胖

用`if-elif`判断并打印结果：

```python
height = 1.75
weight = 80.5

bmi = weight / (height ** 2)

if bmi < 18.5:
    print("过轻")
elif bmi < 25:
    print("正常")
elif bmi < 28:
    print("过重")
elif bmi < 32:
    print("肥胖")
else:
    print("严重肥胖")
# bmi 约为 26.29 -> 输出「过重」
```

区间只写**上界**即可：`if` 从上往下判断，命中就停，所以不必写成 `18.5 <= bmi < 25`（更啰嗦且容易漏边界）。写完先口算一个数，确认没有整体错位。

## 参考源码

[do_if.py](https://liaoxuefeng.com/books/python/basic/if/do_if.py)

## 什么时候改用 `match`

`if...elif...else` 擅长「比大小、判区间」。但当分支对象是**固定取值**（状态码、消息类型、命令词），或者需要**一边判断结构一边取出其中的值**时，一长串 `elif` 很快变成噪音。Python 3.10 起这类场景请用 `match`/`case`：

```python
status = 404
match status:
    case 400 | 404 | 500:
        print("常见错误")
    case _:
        print("其他")
# 常见错误
```

字面值模式、序列与类模式、守卫子句、映射模式怎么写，以及「模式里的裸名字会被当成捕获变量而不是常量」这条最坑的规则，见《结构化模式匹配：match-case》。

## 小结

条件判断可以让计算机自己做选择，Python的if...elif...else很灵活。真值测试要分清「没有内容」与「没有传值」；分支如果只是按固定取值分派，3.10+ 改用 `match` 更清楚。

---

> **来源**：本文转载自 [条件判断 - Python教程](https://liaoxuefeng.com/books/python/basic/if/index.html)，作者 廖雪峰，许可 © 廖雪峰（转载署名）。抓取于 2026-09-13。
