---
title: 类型注解（Type Hints）
source_url: https://docs.python.org/zh-cn/3/library/typing.html
author: Python 软件基金会
license: PSF 许可证第 2 版（GPL 兼容）
fetched_at: 2026-09-13
translated: false
order: 6
versions: Python 3.13+ / typing
---
## 第一个类型提示

本模块提供了对类型提示的运行时支持。考虑下面的函数:

```python
def surface_area_of_cube(edge_length: float) -> str:
    return f"The surface area of the cube is {6 * edge_length ** 2}."
```

函数 `surface_area_of_cube` 接受一个预期为 `float` 实例的参数，如类型提示 `edge_length: float` 所指明的。该函数预期返回一个 `str` 实例，如 `-> str` 提示所指明的。

类型提示可以是简单的类比如 `float` 或 `str`，它们也可以更为复杂。`typing` 模块提供了一套用于更高级类型提示的词汇。

新特性被频繁添加到 `typing` 模块中。[typing_extensions](https://pypi.org/project/typing_extensions/) 包提供了这些新特性针对较旧版本 Python 的向下移植。

> 编者注：内置容器从 Python 3.9 起直接支持下标（`list[int]`、`dict[str, int]`），无需再从 `typing` 导入 `List/Dict`——网上教程里的 `List[int]` 属于旧写法。`X | None`（3.10+）也取代了 `Optional[X]`。

## 泛型（Generic）

由于无法以通用方式静态地推断容器中保存的对象的类型信息，标准库中的许多容器类都支持下标操作来表示容器元素的预期类型。

```python
from collections.abc import Mapping, Sequence

class Employee: ...

# Sequence[Employee] 表明该序列中的所有元素
# 都是 "Employee" 的实例。
# Mapping[str, str] 表明该映射中的所有键和所有值
# 都必须是字符串。
def notify_by_email(employees: Sequence[Employee],
                    overrides: Mapping[str, str]) -> None: ...
```

泛型函数和类可以通过使用**类型形参语法**（3.12+）来实现参数化:

```python
from collections.abc import Sequence

def first[T](l: Sequence[T]) -> T:  # 函数是 TypeVar "T" 泛型
    return l[0]
```

或直接使用 `TypeVar` 工厂：

```python
from collections.abc import Sequence
from typing import TypeVar

U = TypeVar('U')                  # 声明类型变量 "U"

def second(l: Sequence[U]) -> U:  # 函数是 TypeVar "U" 泛型
    return l[1]
```

## 类型别名

类型别名是使用 `type` 语句（3.12+）来定义的，它将创建一个 `TypeAliasType` 的实例。在这个示例中，`Vector` 和 `list[float]` 将被静态类型检查器等同处理:

```python
type Vector = list[float]

def scale(scalar: float, vector: Vector) -> Vector:
    return [scalar * num for num in vector]

# 通过类型检查；浮点数列表是合格的 Vector。
new_vector = scale(2.0, [1.0, -4.2, 5.4])
```

类型别名适用于简化复杂的类型签名。例如:

```python
from collections.abc import Sequence

type ConnectionOptions = dict[str, str]
type Address = tuple[str, int]
type Server = tuple[Address, ConnectionOptions]

def broadcast_message(message: str, servers: Sequence[Server]) -> None:
    ...
```

## 标注元组

对于 Python 中的大多数容器，类型系统会假定容器中的所有元素都是相同类型的：

```python
from collections.abc import Mapping

# 类型检查器将推断 x 中的所有元素均为整数
x: list[int] = []

# 类型检查器错误: list 只接受单个类型参数：
y: list[int, str] = [1, 'foo']

# 类型检查器将推断 z 中的所有键均为字符串，
# 并且 z 中的所有值均为字符串或整数
z: Mapping[str, str | int] = {}
```

与大多数其它 Python 容器不同的是，元组中元素的类型通常并不相同，因此 `tuple` 可以接受**任意数量**的类型参数：

```python
# 可以: y 被赋值为长度为 2 的元组；
# 第 1 个元素是个整数，第 2 个元素是个字符串
y: tuple[int, str] = (5, "foo")

# 错误: 类型标注表明是长度为 1 的元组，
# 但 z 却被赋值为长度为 3 的元组
z: tuple[int] = (1, 2, 3)
```

要表示一个可以是**任意**长度、所有元素都是类型 `T` 的元组，请使用字面值省略号：`tuple[T, ...]`：

```python
x: tuple[int, ...] = (1, 2)
# 这些赋值是可以的: tuple[int, ...] 表明 x 可以为任意长度
x = (1, 2, 3)
x = ()
# 这个赋值是错误的: x 中的所有元素都必须为整数
x = ("foo", "bar")
```

## NewType

用 `NewType` 助手创建与原类型不同的类型，静态类型检查器把新类型当作原始类型的子类，这种方式适用于捕捉逻辑错误：

```python
from typing import NewType

UserId = NewType('UserId', int)
some_id = UserId(524313)

def get_user_name(user_id: UserId) -> str:
    ...

# 通过类型检查
user_a = get_user_name(UserId(42351))

# 未通过类型检查；整数不能作为 UserId
user_b = get_user_name(-1)
```

`UserId` 类型的变量可执行所有 `int` 操作，但返回结果都是 `int` 类型。注意这些检查只由静态类型检查器强制执行——在运行时，`Derived(some_value)` 只是原样返回传入的参数，几乎零开销。

## 标注可调用对象与生成器

函数类型的标注用 `Callable[[参数类型...], 返回类型]`（从 `collections.abc` 导入）：

```python
from collections.abc import Callable, Iterator

def feeder(get_next_item: Callable[[], str]) -> None: ...

async def query(sql: str, db: Callable[..., object]) -> None: ...
```

生成器可以使用泛型类型 `Generator[YieldType, SendType, ReturnType]` 来标注；仅产生值的简单生成器可以标注为 `Iterator[YieldType]`：

```python
def infinite_stream(start: int) -> Iterator[int]:
    while True:
        yield start
        start += 1
```

异步版本对应 `AsyncGenerator[YieldType, SendType]` 与 `AsyncIterator[YieldType]`；协程用 `Coroutine[YieldType, SendType, ReturnType]` 标注。

## 类对象的类型：type[C]

带有 `C` 标注的变量可接受 `C` 类型的值；反之，带有 `type[C]` 标注的变量则可接受**本身是类**的值——准确地说，它将接受 `C` 的类对象：

```python
a = 3         # 为 int 类型
b = int       # 为 type[int] 类型

class User: ...
class ProUser(User): ...

def make_new_user(user_class: type[User]) -> User:
    return user_class()

make_new_user(User)      # 可以
make_new_user(ProUser)   # 同样可以: type[ProUser] 是 type[User] 的子类型
make_new_user(User())    # 错误: 预期为 type[User] 但得到 User
```

这个注解在"工厂函数 / 插件注册表"里非常常见。

## 名义子类型 vs 结构子类型

`typing` 模块采用**名义子类型**（nominal subtyping）：类 `B` 只要显式继承自类 `A`，就允许在所有预期 `A` 的地方使用 `B`。

与之相对的是**结构子类型**（structural subtyping，即"静态鸭子类型"）：一个类只要拥有预期的成员，就视为兼容。Python 的运行时鸭子类型本质上是结构的；静态侧的对应物是 `Protocol` 类（`typing.Protocol`），它让你在不想改继承树的情况下声明"只要有 `.read()` 方法就行"。

## 运行时用类型做什么：Pydantic 与 FastAPI（编者补充）

类型注解本身只是"提示"，但两个库把注解变成了运行时机制：

- **Pydantic**（本模块第 10 篇）：用 `BaseModel` 的字段注解在运行时校验与解析数据——LLM 返回的 JSON、API 请求体都靠它兜底；
- **FastAPI**（第 11 篇）：读取路径函数的参数注解，自动完成查询参数解析、请求体校验、OpenAPI 文档生成。

还有一个工具值得放进工具箱：`mypy` 或 `pyright`（静态类型检查器），可在 CI 里对整个项目执行 `mypy .`，把"None 上调方法"这类错误挡在运行之前。官方推荐进一步阅读 [mypy 速查卡](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html) 与 [Python 类型系统规范](https://typing.python.org/en/latest/spec/index.html)。

---

> **来源**：本文转载自 [typing — 对类型提示的支持 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/library/typing.html)，作者 Python 软件基金会，许可 PSF 许可证第 2 版。抓取于 2026-09-13。

---

> 编者注：Python 运行时**不强制**要求函数与变量类型标注，类型提示（type hint）主要供类型检查器（mypy/pyright）、IDE 与库在静态或运行时使用。但现代 Python 生态已把类型注解当作"第一公民"：**Pydantic 用它在运行时校验数据，FastAPI 用它自动生成参数解析与 API 文档**（见本模块第 10、11 篇）。写 LLM 应用几乎绕不开它们。
