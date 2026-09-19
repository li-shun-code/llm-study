---
title: 函数：参数种类与返回值设计
source_url: https://docs.python.org/zh-cn/3/tutorial/controlflow.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 15
group: 函数
---
写函数不只是「把几行代码起个名字」。函数的**签名**（有哪些参数、谁能省略、谁必须写名字）和**返回契约**（返回什么、失败时返回什么）决定了这段代码三个月后还能不能用。这一篇按官方教程 4.8 与 4.9 的次序，把参数的四种形态、默认值的求值规则、以及最坑人的「可变默认参数」讲清楚。

## 定义与调用

```python
def fib(n):
    """打印小于 n 的斐波那契数列。"""
    a, b = 0, 1
    while a < n:
        print(a, end=" ")
        a, b = b, a + b
    print()

fib(2000)
# 0 1 1 2 3 5 8 13 21 34 55 89 144 233 377 610 987 1597
```

`def` 把函数名与函数对象关联到当前符号表。同一个对象可以有多个名字：

```python
def fib(n):
    """打印小于 n 的斐波那契数列。"""
    a, b = 0, 1
    while a < n:
        print(a, end=" ")
        a, b = b, a + b
    print()

f = fib            # 不是调用，只是给同一个函数对象再起一个名字
f(100)
# 0 1 1 2 3 5 8 13 21 34 55 89
```

函数体内部**赋值**都写进局部符号表，**读取**则按 局部 → 外层函数 → 全局 → 内置 的顺序查找。因此可以在函数里读全局变量，但不要随意给它赋值（要赋值就得显式用 `global` 或 `nonlocal`），参见《常见陷阱汇总》里的 `UnboundLocalError` 一节。

没有 `return` 的函数也**有返回值**，那是 `None`：

```python
def fib(n):
    """打印小于 n 的斐波那契数列。"""
    a, b = 0, 1
    while a < n:
        print(a, end=" ")
        a, b = b, a + b
    print()

print(fib(0))      # None
```

如果函数是「做某件事」而不是「给出某个结果」，就让它像 `fib` 这样只产生副作用；如果要给调用方数据，就明确 `return`。官方教程给出的对照版本是返回结果列表的 `fib2`：

```python
def fib2(n):
    """返回包含小于 n 的斐波那契数的列表。"""
    result = []
    a, b = 0, 1
    while a < n:
        result.append(a)
        a, b = b, a + b
    return result

print(fib2(100))   # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
```

## 文档字符串

函数内第一条语句若是字符串字面值，它就是文档字符串（docstring），可被 `help()`、IDE 提示和文档生成工具读取。官方约定：

- 第一行是一句摘要，大写开头、句号结尾，**不要**在这行重复对象名或类型。
- 多行时第二行留空，把摘要与后续段落分开；后面的段落交代调用约定、副作用等。

```python
def trim_context(text, limit=4000):
    """把文本裁剪到给定的字符上限。

    参数 text 会先去除首尾空白；超长时从尾部截断并追加省略号。
    本函数不修改传入的对象，总是返回一个新字符串。
    """
    cleaned = text.strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit] + "……"

print(trim_context.__doc__.splitlines()[0])   # 第一行摘要
help(trim_context)                             # 交互式查看完整文档
```

Python 解析器会去掉模块、类、函数文档字符串里的公共缩进，所以放心按缩进写。

## 参数的四种形态

### 1. 默认值参数

```python
def ask_ok(prompt, retries=4, reminder="请重新回答"):
    while True:
        reply = input(prompt).strip().lower()
        if reply in {"y", "ye", "yes"}:
            return True
        if reply in {"n", "no", "nop", "nope"}:
            return False
        retries -= 1
        if retries < 0:
            raise ValueError("无效的用户响应")
        print(reminder)

# 三种调用方式（运行时会等待用户输入，这里只展示写法）：
#   ask_ok("真的要退出吗？")                        只给必选参数
#   ask_ok("覆盖该文件吗？", 2)                     给一个可选参数
#   ask_ok("覆盖该文件吗？", 2, "只能回答是或否！")   全部给出
print(ask_ok.__defaults__)                         # (4, '请重新回答') —— 默认值存在这里
```

官方教程强调：**默认值在函数定义时求值，且只求值一次**。所以：

```python
i = 5
def f(arg=i):
    print(arg)

i = 6
f()          # 输出 5，不是 6
```

**重要警告**：默认值是列表、字典、类实例等可变对象时，这条规则会产生「函数记住了上次调用」的效果：

```python
def accumulate_bad(value, bucket=[]):        # 反面教材
    bucket.append(value)
    return bucket

print(accumulate_bad(1))     # [1]
print(accumulate_bad(2))     # [1, 2]  —— 第二次调用看到上次的残留
print(accumulate_bad(3))     # [1, 2, 3]
```

正确写法是用 `None` 做哨兵，在函数体内创建新对象：

```python
def accumulate(value, bucket=None):
    if bucket is None:
        bucket = []
    bucket.append(value)
    return bucket

print(accumulate(1))         # [1]
print(accumulate(2))         # [2]  —— 每次调用互不影响
```

### 2. 关键字参数

`kwarg=value` 形式的调用让参数顺序不再重要，也提升可读性。官方示例：

```python
def parrot(voltage, state="一只僵死的鹦鹉", action=".voilà", type="挪威蓝"):
    print(f"如果给 {voltage} 伏电压，这只鹦鹉一定会 {action}。")
    print(f"羽毛：{type}；状态：{state}！")

parrot(1000)                                        # 1 个位置参数
parrot(voltage=1000)                                # 1 个关键字参数
parrot(action="飞起来", voltage=1000000)             # 关键字顺序随意
parrot("一百万伏", "快不行了", "跳起来")               # 3 个位置参数
```

无效的调用形式，报的错值得记住：

```python
parrot()                      # TypeError: missing 1 required positional argument: 'voltage'
parrot(voltage=5.0, "dead")   # SyntaxError: positional argument follows keyword argument
parrot(110, voltage=220)      # TypeError: got multiple values for argument 'voltage'
parrot(actor="John Cleese")   # TypeError: got an unexpected keyword argument 'actor'
```

关键字参数必须跟在位置参数后面；同一参数不能既按位置又按关键字传。

当最后一个形参写成 `**name` 时，它收集所有多余的关键字参数到一个字典里；`*name` 收集多余的位置参数到元组，且 `*name` 必须在 `**name` 之前：

```python
def cheeseshop(kind, *arguments, **keywords):
    print(f"-- 有 {kind} 吗？")
    for arg in arguments:
        print(arg)
    print("-" * 40)
    for kw in keywords:
        print(kw, ":", keywords[kw])

cheeseshop("Limburger", "它太软了，先生。", "真的很软，先生。",
           shopkeeper="Michael Palin", client="John Cleese", sketch="奶酪店小品")
```

注意输出中关键字参数的顺序与调用时一致。

### 3. 仅位置与仅关键字（`/` 与 `*`）

```python
def f(pos1, pos2, /, pos_or_kwd, *, kwd1, kwd2):
    ...
#     -------- 仅位置   -- 二者皆可 -- 仅关键字
```

- 写在 `/` **之前**的形参只能用位置传，调用方看不到参数名也无所谓。
- 写在 `*` **之后**的形参必须写成 `kwd1=...` 的形式。
- 两者之间的形参怎么传都行。

```python
def combined_example(pos_only, /, standard, *, kwd_only):
    print(pos_only, standard, kwd_only)

combined_example(1, 2, kwd_only=3)      # 1 2 3
combined_example(1, standard=2, kwd_only=3)   # 1 2 3
combined_example(pos_only=1, standard=2, kwd_only=3)
# TypeError: got some positional-only arguments passed as keyword arguments: 'pos_only'
```

什么时候用？官方教程给了三条判断：想让调用方**不依赖参数名**（未来可改名而不破坏 API）、或**强制指定顺序**时用仅位置；参数名本身就是文档（比如 `encoding=`、`top_k=`）时用仅关键字，逼调用方写出来，避免一串位置参数读不懂。

另一个细节：`def foo(name, **kwds)` 里，关键字 `'name'` 永远会和形参 `name` 绑定，`foo(1, **{"name": 2})` 会抛 `TypeError: got multiple values for argument 'name'`；把 `name` 改成仅位置（`def foo(name, /, **kwds)`）就能返回 `True`——仅位置形参的名字可以安全地出现在 `**kwds` 里。

### 4. 任意实参列表与解包调用

```python
def write_multiple_items(file, separator, *args):
    file.write(separator.join(args))
```

`*args` 用于收集剩余位置参数，通常放在形参表末尾；它之后的形参只能是仅关键字：

```python
def concat(*args, sep="/"):
    return sep.join(args)

print(concat("earth", "mars", "venus"))               # earth/mars/venus
print(concat("earth", "mars", "venus", sep="."))      # earth.mars.venus
```

调用方向相反：数据已经在列表或元组里，用 `*` 拆开成独立位置参数；字典用 `**` 拆成关键字参数。

```python
args = [3, 6]
print(list(range(*args)))          # [3, 4, 5]

options = {"voltage": 4000000, "state": "彻底不行"}
parrot(**options)
# -- 如果给 4000000 伏电压，这只鹦鹉一定会 .voilà。羽毛：挪威蓝；状态：彻底不行！
```

这条规则在封装第三方 API 时尤其常见：`def call(**kwargs)` 收集参数，再 `client.create(**kwargs)` 转发。

## 返回值的设计

- **要么所有分支都有值，要么都没有。** 官方教程要求 `return` 语句保持一致：有的分支返回值、有的隐式返回 `None`，会让调用方写出 `if result:` 这种含糊的判断。显式写 `return None` 比空 `return` 更清楚。
- **不要把「失败」和「空结果」混成一个值。** 返回 `[]`、`""`、`0` 时，调用方无法区分「正常但为空」和「出错」。可选做法：返回 `(值, 错误)` 元组（见《元组与序列解包》）、抛异常（见《异常处理》）、或返回 `None` 并在文档字符串里写清。
- **原地修改的方法一律返回 `None`。** 这是 Python 对可变对象的统一约定，`sort`、`reverse`、`update`、`add` 都不返回自身，因此 `data = data.sort()` 会把数据变成 `None`。

## lambda：只配当参数

`lambda a, b: a + b` 创建只有单个表达式的匿名函数，语义上就是 `def` 的语法糖：

```python
pairs = [(1, "one"), (2, "two"), (3, "three")]
pairs.sort(key=lambda p: p[1])
print(pairs)      # [(1, 'one'), (3, 'three'), (2, 'two')]
```

PEP 8 明确要求：**不要**用 `f = lambda x: 2*x` 给 lambda 起名字，那样写得到的函数名是 `<lambda>`，出错时回溯信息更难读，且抹掉了 lambda 唯一的优势。要具名函数就用 `def`。更多用法见《lambda 与高阶函数》。

## 函数注解

```python
def f(ham: str, eggs: str = "eggs") -> str:
    return ham + " and " + eggs

print(f.__annotations__)
# {'ham': <class 'str'>, 'eggs': <class 'str'>, 'return': <class 'str'>}
print(f("spam"))          # spam and eggs
```

注解以字典形式存在 `__annotations__` 里，对函数运行**没有任何影响**——Python 不据此做类型检查。它的价值在于给 `mypy`、编辑器和阅读者提供信息，写法与限制见进阶模块的《类型注解》篇目。

## 常见坑

**1. 可变默认参数。** 本文第一号坑，见 4.9.1；`bucket=[]` 改成 `bucket=None` + 函数内判断。

**2. `*args` 后还能不能加参数。** `def f(*args, x)` 是合法的，但 `x` 变成仅关键字参数；而 `def f(x, *args, **kwargs)` 里 `*args` 之后写 `**kwargs` 是唯一允许的星号组合顺序。

**3. 函数里改不改得动外部变量。** 读取全局变量可以，赋值不行（会变成局部变量或抛 `UnboundLocalError`）。需要修改时用参数传入、结果返回，或者明确 `global`。

**4. 忘了 return。** 递归函数最容易：`def sum_all(nums): if not nums: return 0; return nums[0] + sum_all(nums[1:])`，漏写最后的 `return` 会让整条递归返回 `None`，报 `TypeError: unsupported operand type(s) for +: 'int' and 'NoneType'`。

**5. 参数过多。** 形参列表长到需要记顺序时，就该把相关参数收进数据类或字典，或者把多数参数设为仅关键字，强制调用方写名字。

## 最小项目：一个可复用的提示词拼装函数

把「默认值 + 仅关键字 + 文档字符串 + 明确返回类型」四件事落在同一段代码里：

```python
def build_prompt(task: str, *, context: list[str] | None = None,
                 tone: str = "简洁", language: str = "中文") -> str:
    """拼装发给模型的提示词。

    task 是必选的任务描述；其余参数只能按关键字传，避免多个字符串位置写反。
    始终返回一个新字符串，不修改传入的 context 列表。
    """
    parts = [f"请用{language}回答，风格：{tone}。"]
    if context:
        joined = "\n".join(f"[{i}] {doc}" for i, doc in enumerate(context, start=1))
        parts.append(f"参考资料：\n{joined}")
    parts.append(f"问题：{task}")
    return "\n\n".join(parts)


prompt = build_prompt("RAG 的评估指标有哪些？",
                      context=["召回率与准确率", "nDCG 与 MRR"],
                      tone="详尽")
print(prompt)
print(build_prompt("元组能不能当字典的键？"))     # 用默认值，短得多
```

这个签名的好处一眼可见：`context=`、`tone=`、`language=` 在调用处自带说明，新增可选参数不会破坏已有调用，`None` 默认值避免了共享可变对象的陷阱。

## 延伸阅读

- 官方教程 4.8 定义函数 / 4.9 函数定义详解：<https://docs.python.org/zh-cn/3/tutorial/controlflow.html#defining-functions>
- 官方教程 4.10 小插曲：编码风格：<https://docs.python.org/zh-cn/3/tutorial/controlflow.html#intermezzo-coding-style>
- 站内相邻文章：《lambda 与高阶函数》《迭代与解包技巧》《PEP 8 命名与代码风格基线》《异常处理》《可变/不可变与深浅拷贝》

---

> **来源**：抓取于 2026-09-19。译自 [4.8 定义函数、4.9 函数定义详解 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/controlflow.html#defining-functions)（Python Software Foundation，PSF 许可证第 2 版），并引 [4.10 小插曲：编码风格](https://docs.python.org/zh-cn/3/tutorial/controlflow.html#intermezzo-coding-style) 与 [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/)（作者与许可同上，PEP 为公共领域）。返回值设计与最小项目小节为本站补充。
