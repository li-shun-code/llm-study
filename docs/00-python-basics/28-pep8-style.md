---
title: PEP 8 命名与代码风格基线
source_url: https://peps.python.org/pep-0008/
author: Guido van Rossum、Barry Warsaw（PEP 8 作者与维护者）
license: 公共领域（Public Domain，PEP 授权条款）
fetched_at: 2026-09-19
translated: true
versions: PEP 8 现行版；对照 Python 3.13+
order: 28
group: 环境与工程起步
---
「代码写出来首先是给人看的，顺便才能被机器执行」——这是 PEP 8 开篇的立场，也是它被译成中文教程时最常丢的一句话。Python 官方教程在 4.10「小插曲：编码风格」里直接建议所有项目遵循 PEP 8。这一篇给出**能落地的最小基线**：命名怎么起、缩进换行怎么排、哪些写法会被同行当作外行，以及怎么用工具把这件事自动化到不用记。

需要区分两件事：PEP 8 讲的是**风格约定**（可以因上下文打破），**PEP 257** 讲文档字符串约定，**类型注解**是另一套规范（见进阶模块《类型注解》篇目）。

## 官方教程给的十条核心要点

译自官方教程 4.10，先把最没有争议的十条钉牢：

1. 缩进用 **4 个空格**，不要用制表符。制表符会引起混乱。
2. 每行**不超过 79 个字符**（注释与文档字符串建议 72），小屏阅读更好，也便于并排看文件。
3. 用**空行**分隔函数、类，以及函数内较大的逻辑块。
4. 注释尽量**单独成行**；行内注释与代码之间留两个空格。
5. 使用**文档字符串**（约定见 PEP 257）。
6. 运算符前后加空格、逗号后加空格，但**紧贴括号内侧不加空格**：`a = f(1, 2) + g(3, 4)`。
7. 类名用 `UpperCamelCase`（也叫 CapWords），函数与方法名用 `lowercase_with_underscores`。
8. 方法的第一个参数总是命名为 `self`，类方法的第一个参数命名为 `cls`。
9. 面向多语言环境的代码不要用生僻编码，**UTF-8 或纯 ASCII** 足以胜任。
10. 即使只有极少数人会读，也**不要在标识符里用非 ASCII 字符**。

## 命名风格速查表

PEP 8 把「有哪些命名风格」和「什么东西该用哪种风格」分成两节讲。先认识风格本身：

| 风格 | 例子 | 说明 |
| --- | --- | --- |
| 小写 | `lowercase` | 最基础 |
| 下划线小写 | `lower_case_with_underscores` | 函数、变量、方法 |
| 全大写 | `UPPERCASE` | 少见 |
| 下划线大写 | `UPPER_CASE_WITH_UNDERSCORES` | 模块级常量 |
| CapWords | `HTTPServerError` | 类；缩写全部大写，`HTTPServerError` 优于 `HttpServerError` |
| mixedCase | `mixedCase` | 只在既有风格已是这样时才用（向后兼容） |
| `Capitalized_Words_With_Underscores` | —— | 原文直接标注「丑陋」，别用 |

再加上下划线前缀/后缀的特殊含义：

| 形式 | 含义 |
| --- | --- |
| `_single_leading_underscore` | 弱「内部使用」标记；`from module import *` 不会导入它 |
| `single_trailing_underscore_` | 避开关键字冲突，如 `class_`、`tkinter.Toplevel(master, class_='X')` |
| `__double_leading_underscore` | 类属性触发名称改写：`FooBar.__boo` 变成 `FooBar__boo` |
| `__both_sides__` | 「魔术」对象/属性，只使用文档里出现的，**绝不自造** |

规范性的命名约定（PEP 8 的 prescriptive 部分，逐条译出）：

| 目标 | 约定 |
| --- | --- |
| 模块 / 包 | 短小全小写；模块名必要时可用下划线提升可读性（`my_module.py`），包名尽量避免下划线 |
| 类 | `CapWords`；若该对象主要作为可调用接口使用，可改用函数命名法 |
| 异常 | 类命名法，且确实是错误时加 `Error` 后缀（`ValidationError`）；用于非局部流程控制的异常不需要后缀 |
| 类型变量 | `CapWords` 且偏好短名（`T`、`AnyStr`、`Num`）；协变/逆变分别加 `_co`、`_contra` 后缀 |
| 函数与方法 | 小写 + 下划线（`calculate_total`） |
| 变量 | 与函数同一套规则 |
| 全局变量 | 与函数同一套规则；应尽量只在单个模块内使用 |
| 常量 | 模块级、全大写下划线（`MAX_OVERFLOW`、`TOTAL`） |
| 实例方法首参 | 永远写 `self`；类方法首参永远写 `cls` |
| 形参与关键字冲突 | 加一个尾随下划线（`class_` 优于 `clss`），更好的做法是换个同义词 |
| 简单变量名 | 单个字母 `l`（小写 L）、`O`、`I` 一律不用作变量名——某些字体里它们与 `1`、`0` 无法区分；想用 `l` 时改用 `L` |
| 面向继承的设计 | 拿不准就设为非公开（单下划线前缀）；把「公开」「子类 API」「仅基类自用」显式区分开 |

还有一条容易被忽略的总原则（PEP 8「Overriding Principle」）：**对用户可见的公共 API 名称，应当反映「怎么用」而不是「怎么实现」**。

## 换行、导入与空行

导入按官方分组顺序排列：标准库、第三方库、本地模块，组间空一行，每组内按字母序：

```python
import os
import sys

import httpx
from collections import OrderedDict

from myapp.config import settings
```

- 每行只放一个 `import`；`from x import a, b` 这种多项 `from` 可以，但要能对齐读清。
- 通配符导入 `from module import *` 不要写，它会污染命名空间、让静态工具失效。
- 标准库建议用绝对导入：`import mypkg.myfile`。

PEP 8 对换行的推荐是**在二元运算符之后换行**（与旧的 `pycodestyle` 习惯相反，符合现代 `black`/`ruff format` 的输出）：

```python
total = (first_value
         + second_value
         - third_value)

income = (gross_wages
          + taxable_interest
          + (dividends - qualified_dividends)
          - ira_deduction
          - student_loan_interest)
```

需要「在运算符之前」换行的场景是数学公式排版，此时全项目保持一致即可——PEP 8 的原话是：**与上下文保持一致比遵循任何指南都重要**（引用了「愚蠢的一致性是小器量之心魔」这句爱默生名言作为整节标题）。

空行：顶层函数与类定义之间两个空行；类内方法之间一个空行；函数内相关语句组之间可用一个空行（但要克制）。

## 字符串引号与空格

- 单引号与双引号在 Python 里等价。**同一个项目内保持一致**；如果字符串内部含 `'` 或 `"`，用另一种引号包住以避免转义，`this_is_a_backslash = r'\x'` 这类原始字符串用于正则。
- 不要在紧贴括号的位置加空格：

```python
# 正确
spam(ham[1], {eggs: 2})
foo = (0,)
if x == 4: print(x, y); x, y = y, x

# 错误
spam( ham[1], { eggs: 2 } )
foo = (0, )
if x == 4 : print(x, y)
```

- 逗号后加空格，逗号前不加；索引冒号两侧不加空格（当切片表达式复杂时才加，如 `ham[lower + offset : upper + offset]`）。
- 用于指示类型的注释要加空格：`def f(ham: str, eggs: str = 'eggs') -> str:`。
- 行尾不要留空格，尤其是续行反斜杠之后（肉眼看不见，还会被格式化工具悄悄改掉）。

## 何时用尾随逗号

单元素元组必须有逗号（`INSTANCES = ('localhost',)`），这是语法要求而不是风格。除此之外，PEP 8 建议在**可能跨多行、且未来会追加元素**的容器字面值末尾加逗号，因为这样新增一项时 Git diff 只有一行：

```python
INSTANCES = [
    "postgres-primary",
    "postgres-standby",
    "postgres-canary",     # 尾随逗号让下一次新增只动一行
]
```

不要给紧跟闭括号、或跟在 `*`/`**` 解包之后的元素加尾随逗号（前者无意义，后者在旧版本会报 `SyntaxError`）。

## 注释与文档字符串

- **说明「为什么」，而不是重复「是什么」。** `i = i + 1  # 自增一` 是噪音。
- 块注释与所注释的代码同缩进，每行以 `# ` 开头，句子首字母大写；段落间用只含 `#` 的行分隔。
- 过时的注释比没有注释更糟——改代码时同步改注释。
- 文档字符串用三重双引号 `"""`，摘要行大写开头、句号结尾且不重复对象名，多行时第二行留空（约定见 PEP 257 与《函数：参数种类与返回值设计》）。

## 编程建议（PEP 8 原文译出）

这些条目常被误当成「风格」，其实是正确性问题：

- **不要依赖 CPython 对 `a += b` 字符串拼接的原地优化。** 它在其他实现（PyPy、Jython 等）上不存在，在 CPython 上也很脆弱。性能敏感的库代码用 `''.join(parts)`，各种实现下都是线性时间。
- **与 `None` 比较永远用 `is` / `is not`**，不要用 `==`。更要小心把 `if x` 写成 `if x is not None` 的反面：当变量默认值是 `None`、而实际值可能是空容器时，`if x` 会把 `[]` 判成假。
- 写 `if foo is not None:`，不要写 `if not foo is None:`。
- **实现富比较时把六个方法都实现**（`__eq__`、`__ne__`、`__lt__`、`__le__`、`__gt__`、`__ge__`），或用 `functools.total_ordering()` 生成缺失的部分。
- **用 `def` 而不是把 lambda 直接赋给标识符**：`def f(x): return 2*x` 而不是 `f = lambda x: 2*x`，否则回溯里的函数名会变成 `<lambda>`。
- **自定义异常从 `Exception` 继承，不要从 `BaseException`**。异常层次要按「捕获方需要什么区分」来设计，回答「哪里出了什么问题」，而不是「哪里抛的」。
- **异常链**：`raise X from Y` 表示显式替换且不丢原始回溯；`raise X from None` 时要把关键信息搬进新异常。
- **不要写裸 `except:`**。它会连 `SystemExit`、`KeyboardInterrupt` 一起吞掉，让 Ctrl-C 失效。确实要捕获所有程序错误时写 `except Exception:`（裸 `except` 等价于 `except BaseException:`）。
- **`try` 块只包住可能出错的那一行**，多包会掩盖 bug；配套用 `else`（没异常时执行）和 `finally`（总是执行）。
- 局部资源用 `with` 语句保证及时释放；`with` 上下文管理器若做了「获取/释放资源」以外的事，就通过独立的函数或方法暴露（`with conn.begin_transaction():` 优于 `with conn:`）。
- 检查前缀后缀用 `str.startswith()` / `str.endswith()`，不要用切片比较：`if foo.startswith('bar'):` 优于 `if foo[:3] == 'bar':`。
- 类型判断用 `isinstance(obj, int)`，不要 `type(obj) is type(1)`。
- 判空序列用真值：`if not seq:` / `if seq:`，不要 `if len(seq):`。
- 布尔值不要与 `True`/`False` 做 `==` 比较：写 `if greeting:`，`if greeting is True:` 更差。
- `try...finally` 的 `finally` 里不要放 `return`/`break`/`continue`——它会隐式取消正在传播的异常。

## 让工具替你做这件事

风格靠人工遵守一定会漂移，交给工具最省心。在已装 uv 的机器上（见《环境与依赖管理》）可以直接跑，不必安装到项目里：

```bash
uvx ruff format .          # 格式化（与 black 兼容的风格）
uvx ruff check --fix .     #  lint + 自动修可安全修复项
uvx mypy .                 # 类型注解检查（需要写注解）
```

或者装进项目的开发依赖，让配置随仓库走：

```bash
uv add --dev ruff mypy
```

`pyproject.toml` 里一份常见配置：

```toml
[tool.ruff]
line-length = 88
target-version = "py313"

[tool.ruff.lint]
select = ["E", "F", "W", "I", "UP", "B"]   # 错误、未定义名、空白、导入排序、现代写法、bugbear
ignore = ["E501"]                          # 行宽交给 formatter
```

`black`/`ruff format` 默认行宽 88 而不是 PEP 8 的 79——这是社区公开的、被 PEP 8 自己允许的偏离（「与项目内部保持一致优先」）。选定一种就全站统一，不要在混用中反复产生格式 diff。

## 中文项目的额外注意

- 标识符用英文，**不要用拼音缩写**。`yonghu_ming` 不如 `username`；确实没有好译名时，写注释解释而不是硬造缩写。
- 中文注释与代码之间，中英文混排时建议加一个半角空格（`使用 HTTP 客户端`），这不是 PEP 8 要求而是中文技术写作惯例，但极影响可读性。
- 字符串内容用中文完全没问题，源文件保持 UTF-8（Python 3 默认）；**不要在标识符里用中文**，PEP 3131 允许但标准库要求 ASCII 兼容，团队协作和检索都会受影响。
- 别在字符串字面值里依赖尾部空格（会被编辑器或格式化工具裁掉），需要分隔就显式写出来或用 `join`。

## 常见坑

**1. 遮蔽内置名。** `list`、`dict`、`set`、`sum`、`max`、`input`、`id`、`type`、`str`、`format` 一律不要当变量名。这是新手代码里最难查的一类 bug：报错点离污染点很远。

**2. 混用制表符和空格。** 同一个文件里两种缩进混用会报 `TabError: inconsistent use of tabs and spaces in indentation`，或者更糟——只在某些行出错。让 formatter 统一。

**3. 可变默认参数。** `def f(x, L=[])` 会跨调用累积，见《函数：参数种类与返回值设计》；这也是 `ruff` 的 `B006` 规则专门盯的问题。

**4. 把 `is` 当 `==` 用。** `a is b` 比较的是对象身份（同一个对象），CPython 对小整数和短字符串有驻留，会让 `256 is 256` 为真而 `257 is 257` 不确定。除 `None`/`True`/`False` 单例以外用 `==`。

**5. 只有 H3 没有 H2 的文档。** 这条是写给本站读者的：写技术文档时标题层级要连续，正文从 `##` 起、不要跳级，否则目录会错乱。

**6. 用风格争论代替工具。** 团队里关于空行、括号、引号的讨论应当一次性写进 formatter 配置，而不是在 code review 里逐条指出。

## 最小项目：一次同风格的改写

下面把一段「能跑但难读」的代码整理到 PEP 8 基线，改动点逐条对应上文：

改写前：

```python
def calc_bmi( w,h ):
    bmi=w/(h*h)
    if bmi<18.5:
        return "过轻"
    elif bmi<25:
        return "正常"
    elif bmi<30:
        return "肥胖"
    else:
        return "超重"
list=[55,70,85]
for i in list:
    print(i, calc_bmi(i, 1.75) if i else '')
```

改写后：

```python
BMI_CUTOFFS = ((18.5, "过轻"), (25.0, "正常"), (30.0, "肥胖"))


def classify_bmi(weight: float, height_m: float) -> str:
    """按 BMI 给出体重分类。

    参数 height_m 以米为单位；分类阈值集中在模块级常量里，便于调整。
    """
    bmi = weight / (height_m ** 2)
    for cutoff, label in BMI_CUTOFFS:
        if bmi < cutoff:
            return label
    return "超重"


def report(samples, height_m):
    """逐条打印体重样本的 BMI 分类。"""
    for weight in samples:
        print(weight, classify_bmi(weight, height_m))


report([55, 70, 85], height_m=1.75)
# 55 过轻
# 70 正常
# 85 肥胖
```

改动清单：函数名从 `calc_bmi` 变成语义更完整的 `classify_bmi`；`list` 这个内置名不再被占用；魔法数字提为模块级常量 `BMI_CUTOFFS`；`elif` 链换成数据驱动的循环；参数名 `w`、`h` 变成有单位提示的 `weight`、`height_m`；补齐文档字符串、类型注解与空行；调用侧用 `height_m=` 关键字避免多个位置参数写反。

## 延伸阅读

- PEP 8 原文：<https://peps.python.org/pep-0008/>
- PEP 257 文档字符串约定：<https://peps.python.org/pep-0257/>
- 官方教程 4.10 小插曲：编码风格：<https://docs.python.org/zh-cn/3/tutorial/controlflow.html#intermezzo-coding-style>
- ruff 规则清单：<https://docs.astral.sh/ruff/rules/>
- 站内相邻文章：《环境与依赖管理》《函数：参数种类与返回值设计》《常见陷阱汇总》《迭代与解包技巧》

---

> **来源**：抓取于 2026-09-19。译自 [PEP 8 — Style Guide for Python Code](https://peps.python.org/pep-0008/)（Guido van Rossum、Barry Warsaw 等，公共领域），并引 [4.10 小插曲：编码风格 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/controlflow.html#intermezzo-coding-style)（Python Software Foundation，PSF 许可证第 2 版）。工具链建议、中文项目注意事项与改写示例为本站编者注；`line-length = 88` 等取舍以读者所在项目的既有规范为准。
