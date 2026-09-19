---
title: 结构化模式匹配：match-case
source_url: https://docs.python.org/zh-cn/3/tutorial/controlflow.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.10 起可用；对照 3.14 文档
order: 27
group: 控制流
---
`match` 语句（Python 3.10 起）接受一个表达式，把它的值与若干 `case` 块给出的**模式**依次比较，只执行第一个匹配成功的分支，并且能**在匹配的同时把值的组成部分提取到变量里**。它表面像 C/Java/JavaScript 的 `switch`，实质上更像 Rust 或 Haskell 的模式匹配：`switch` 只能比「等于某个值」，`match` 可以问「这个值是不是这种结构，如果是，各部分分别是什么」。

处理嵌套的 JSON、解析消息、按事件类型分派——这些原本要靠一串 `if isinstance(...)` 加 `d["a"]["b"]` 才能写完的逻辑，用 `match` 会紧凑得多。

## 最简形式：字面值与通配符

```python
def http_error(status):
    match status:
        case 400:
            return "Bad request"
        case 404:
            return "Not found"
        case 418:
            return "I'm a teapot"
        case _:
            return "Something's wrong with the internet"

print(http_error(404))      # Not found
print(http_error(500))      # Something's wrong with the internet
```

最后一个块里的 `_` 是**通配符**，必定匹配成功，相当于 `else`。多个字面值可以用 `|`（「或」）合并进一个模式，完整写法是：

```python
def describe(status):
    match status:
        case 401 | 403 | 404:
            return "Not allowed"
        case _:
            return "其他状态"

print(describe(403))     # Not allowed
```

没有匹配的 `case` 时，整个 `match` 语句什么都不做——不像 `switch` 会提醒你漏了分支，所以收尾的 `case _` 往往是必要的。

## 序列模式与变量绑定

```python
# point 是一个 (x, y) 元组
point = (0, 5)

match point:
    case (0, 0):
        print("Origin")
    case (0, y):
        print(f"Y={y}")
    case (x, 0):
        print(f"X={x}")
    case (x, y):
        print(f"X={x}, Y={y}")
    case _:
        raise ValueError("Not a point")
# Y=5
```

第一个模式有两个字面值；接下来两个把字面值和**捕获变量**混在一起，变量会绑定来自主语的值；第四个模式捕获两个值，概念上等价于解包赋值 `(x, y) = point`。

模式可以任意嵌套，序列模式支持像解包赋值那样的星号：

```python
command = "drop golden sword"

match command.split():
    case ["quit"]:
        print("Goodbye!")
    case ["go", direction]:
        print("Going:", direction)
    case ["drop", *objects]:
        print("Dropping:", objects)
    case _:
        print("Sorry, I don't understand.")
# Dropping: ['golden', 'sword']
```

`[x, y, *rest]` 与 `(x, y, *rest)` 做的事和相应的解包赋值完全一样；不关心剩余项时写 `(x, y, *_)` 就能匹配「至少两项」的序列而不绑定它们。

## 类模式：把属性捕获到变量

如果数据用类组织，可以写成「类名 + 参数列表」这种很像构造器的形式：

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

def where_is(point):
    match point:
        case Point(x=0, y=0):
            print("Origin")
        case Point(x=0, y=y):
            print(f"Y={y}")
        case Point(x=x, y=0):
            print(f"X={x}")
        case Point():
            print("Somewhere else")
        case _:
            print("Not a point")

where_is(Point(0, 3))     # Y=3
where_is((0, 0))          # Not a point —— 元组不匹配类模式
```

**位置参数默认不允许**：类模式必须写成 `Point(x=..., y=...)` 的形式。要支持位置模式，类需要提供特殊属性 `__match_args__` 指定属性的顺序；`dataclass` 会自动生成它，这也是处理结构化数据时首选 `@dataclass` 的一个理由。设 `__match_args__ = ("x", "y")` 后，下列四个模式彼此等价（都把属性 `y` 绑定到变量 `var`）：

```text
Point(1, var)
Point(1, y=var)
Point(x=1, y=var)
Point(y=var, x=1)
```

推荐阅读模式的方式是：**把它当成赋值语句等号左边的扩展形式**，据此理解每个变量被设成了什么值。`match` 只会给单一名称（如 `var`）赋值，不会给带点号的名称（`foo.bar`）、属性名（模式里的 `x=`、`y=`）以及类名（靠后面的 `(...)` 识别，如 `Point`）赋值。

配合嵌套的列表与类模式：

```python
class Point:
    __match_args__ = ("x", "y")
    def __init__(self, x, y):
        self.x = x
        self.y = y

points = [Point(0, 1), Point(0, 3)]

match points:
    case []:
        print("No points")
    case [Point(0, 0)]:
        print("The origin")
    case [Point(x, y)]:
        print(f"Single point {x}, {y}")
    case [Point(0, y1), Point(0, y2)]:
        print(f"Two on the Y axis at {y1}, {y2}")
    case _:
        print("Something else")
# Two on the Y axis at 1, 3
```

## 守卫子句、as 捕获与映射模式

模式后可以跟 `if` 作为守卫；守卫为假时继续尝试下一个 `case`。注意值的捕获发生在守卫求值**之前**：

```python
class Point:
    __match_args__ = ("x", "y")
    def __init__(self, x, y):
        self.x = x
        self.y = y

point = Point(2, 2)

match point:
    case Point(x, y) if x == y:
        print(f"Y=X at {x}")
    case Point(x, y):
        print("Not on the diagonal")
# Y=X at 2
```

`as` 关键字捕获子模式：写成 `case (Point(x1, y1), Point(x2, y2) as p2):` 时，只要输入是含两个点的序列，第二个点整体就被绑定到 `p2`，同时 `x2`、`y2` 也各自可用。

映射模式从字典里按键取值，**多余的键会被忽略**（这一点与序列模式不同，序列模式要求长度严格匹配）：

```python
config = {"model": "gpt-5-mini", "temperature": 0.2, "extra": 1}

match config:
    case {"model": str() as model, "temperature": 0}:
        print(f"{model} 温度为 0，走单样本路径")
    case {"model": str() as model, **rest}:
        print(f"{model}，其他参数：", rest)
    case _:
        print("缺少 model")
# gpt-5-mini，其他参数： {'temperature': 0.2, 'extra': 1}
```

`**rest` 形式的解包受支持，但 `**_` 是冗余的，因此不允许写。

大多数字面值按相等性比较，但单例 `True`、`False`、`None` 按 `id` 比较。

## 具名常量：必须带点号

模式里的裸名字**一律被当成捕获变量**，不会被拿来比较——这是 `match` 最反直觉的地方。要用常量做匹配，必须写成带点号的名称（模块名、类名或枚举成员）：

```python
from enum import Enum

class Color(Enum):
    RED = "red"
    GREEN = "green"
    BLUE = "blue"

color = Color("green")

match color:
    case Color.RED:
        print("I see red!")
    case Color.GREEN:
        print("Grass is green")
    case Color.BLUE:
        print("I'm feeling the blues :(")
# Grass is green
```

## 常见坑

**1. 裸名字是捕获，不是比较。** 最容易踩的坑：

```python
color = "green"
RED = "red"

match color:
    case RED:            # 永远匹配，并把 color 的值绑定到局部变量 RED
        print("matched", RED)
# matched green  —— 常量 RED 被当成捕获变量，比较根本没有发生
```

正确写法是 `case "red":`（字面值）或 `case Color.RED:`（带点号名称）。

**2. 字符串和迭代器不能匹配序列模式。** `[a, b]` 这样的序列模式匹配任意序列，但**明确不匹配字符串与字节串**，也不匹配迭代器。想按内容拆字符串，先 `split()` 再匹配列表，或用守卫子句 `case s if s.startswith("go"):`，复杂的就交给 `re` 模块。

**3. 忘记兜底分支。** 没有 `case _` 时，不匹配就静默什么都不做。分派逻辑务必显式写出兜底，或者在末尾 `raise ValueError(f"unhandled: {value!r}")`。

**4. 或模式两侧绑定的变量必须完全一致。** `case Point(1, x) | Point(x, 0)` 合法（两侧都只绑定 `x`），而 `case Point(1, x) | Point(y, 0)` 在编译期就报 `SyntaxError: alternative patterns bind different names`。需要不同变量名时，拆成两个 `case` 或用守卫子句。

**5. 用 `match` 替代字典分派。** 如果只是「按字符串键选函数」，`handlers = {"a": func_a, ...}` 加 `handlers.get(key)` 更直接、更可测。`match` 的优势在**结构**与**嵌套**，纯等值多分支用不上它。

**6. 深度嵌套的模式难以调试。** 模式套三层以上时，匹配失败的原因很难定位；此时拆成带守卫的两个 `case`，或直接退回 `if`/`isinstance` 更划算。

**7. 版本要求。** `match` 是 3.10 起的语法，3.9 及以下解释器直接 `SyntaxError`。写库或跑在受限运行时上之前先确认最低版本（站内环境配置见《环境与依赖管理》）。

## 最小项目：给模型返回的工具调用消息分派

工具调用的响应是一组结构不同的字典，正是 `match` 的主场：

```python
def handle_event(event):
    match event:
        case {"type": "message", "content": str() as text}:
            return f"文本回复：{text[:20]}"
        case {"type": "tool_call", "name": str() as name, "arguments": dict() as args}:
            return f"调用工具 {name}，参数 {args}"
        case {"type": "error", "message": str() as msg, "retryable": True}:
            return f"可重试的错误：{msg}"
        case {"type": "error", "message": str() as msg}:
            return f"致命错误：{msg}"
        case {"type": "ping"}:
            return None
        case unknown:
            raise ValueError(f"未处理的事件结构：{unknown!r}")


events = [
    {"type": "message", "content": "检索增强生成是一种把检索与生成结合的范式。"},
    {"type": "tool_call", "name": "search", "arguments": {"query": "RAG 评估"}},
    {"type": "error", "message": "超时", "retryable": True},
    {"type": "ping"},
]

for ev in events:
    print(handle_event(ev))
# 文本回复：检索增强生成是一种把检索与生成结合的范式   ← 原文被截断到 20 字
# 调用工具 search，参数 {'query': 'RAG 评估'}
# 可重试的错误：超时
# None
```

每个分支只关心自己那份结构，参数校验和取值一步到位；新增事件类型时编译器不会提醒你，但末尾的 `case unknown:` 会在运行时立刻抛出——这就是「显式兜底」的价值。

## 延伸阅读

- 官方教程 4.7 match 语句：<https://docs.python.org/zh-cn/3/tutorial/controlflow.html#match-statements>
- 语言参考 复合语句 · match：<https://docs.python.org/zh-cn/3/reference/compound_stmts.html#match>
- **PEP 634**（技术规范）、**PEP 636**（教程风格的详细说明与更多示例）：<https://peps.python.org/pep-0636/>
- 值捕获模式：**PEP 750** 与 3.12 变更日志中的 `str` 模式增强：<https://docs.python.org/zh-cn/3/whatsnew/3.12.html>
- 站内相邻文章：《条件判断》《迭代与解包技巧》《字典：键值映射与 JSON》《类与对象》

---

> **来源**：抓取于 2026-09-19。译自 [4.7 match 语句 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/controlflow.html#match-statements)（Python Software Foundation，PSF 许可证第 2 版），并引 [PEP 636 — Tutorial-style specification for patterns](https://peps.python.org/pep-0636/)（Python Software Foundation，公共领域）与 [语言参考 · match 语句](https://docs.python.org/zh-cn/3/reference/compound_stmts.html#match)（作者与许可同上）；工具调用分派示例、常见坑与版本提示为本站编者注。
