---
title: Pydantic v2 数据校验：从类型注解到结构化输出
source_url: https://docs.pydantic.dev/latest/concepts/models/
author: Pydantic Services Inc. 及 Pydantic 贡献者
license: MIT License
fetched_at: 2026-09-13
translated: true
order: 10
versions: Pydantic 2.x
---

> **来源**：本文翻译自 [Models — Pydantic 文档](https://docs.pydantic.dev/latest/concepts/models/)，作者 Pydantic Services Inc. 及 Pydantic 贡献者，许可 MIT License。抓取于 2026-09-13。

> 编者注：本篇**全部为 Pydantic v2 语法**（`model_dump()` / `model_validate()` / `model_config = ConfigDict(...)`）。网上旧教程里的 v1 写法（`.dict()`、`.parse_obj()`、`class Config:`）已过时，请勿照抄。Pydantic 是 LLM 应用的基础设施：解析模型返回的 JSON、声明结构化输出 Schema、FastAPI 请求体校验，用的都是它。

## 模型是什么

在 Pydantic 中定义 Schema 的主要方式是通过模型。模型简单地继承 `BaseModel` 并把字段定义为**带类型注解的属性**：

```python
from pydantic import BaseModel, ConfigDict


class User(BaseModel):
    id: int
    name: str = 'Jane Doe'

    model_config = ConfigDict(str_max_length=10)  # (1)
```

Pydantic 模型支持多种配置值（见官方 Configuration 文档）。在这个示例中，`User` 是一个具有两个字段的模型：

- `id`：整数（`int` 类型），**必填**；
- `name`：字符串（`str` 类型），非必填（有默认值）。

你可以把模型想象成类似 C 等语言中的结构体，或者 API 中单个端点的请求要求。模型与 Python 的 dataclasses 有许多相似之处，但在验证、序列化与 JSON Schema 生成等流程上有一些微妙但重要的设计差异。

**不可信的数据**可以传给模型，经过解析与验证后，Pydantic 保证最终模型实例的字段将符合模型上定义的字段类型。

### 验证——一个"故意的"误称

Pydantic 用"验证（validation）"一词指代实例化一个符合指定类型和约束的模型（或其他类型）的过程。这个任务 Pydantic 最广为人知，口语中也普遍被称为"验证"，尽管严格来说该词在别的语境中含义更受限。

关键区别：**Pydantic 保证的是输出（模型实例）的类型与约束，而不是输入数据**。当数据无法成功解析为模型实例时，Pydantic 会抛出 `ValidationError`——这也解释了为什么叫"解析即验证"。

## 基本模型用法

然后可以实例化模型：

```python
user = User(id='123')
```

`user` 是 `User` 的一个实例。对象初始化时会执行全部解析与验证。如果没有抛出 `ValidationError` 异常，你就知道得到的模型实例是有效的。

模型的字段可以作为 `user` 对象的普通属性访问：

```python
assert user.name == 'Jane Doe'  # (1)
assert user.id == 123  # (2)
assert isinstance(user.id, int)
```

1. `name` 在初始化时没有被设置，所以使用了默认值；
2. 注意字符串 `'123'` 被强制转换为整数，值为 `123`。

模型实例可以使用 `model_dump()` 方法序列化：

```python
assert user.model_dump() == {'id': 123, 'name': 'Jane Doe'}
```

对实例调用内置 `dict()` 也会得到字典，但**嵌套字段不会被递归转换**为字典；`model_dump()` 还提供了许多参数来自定义序列化结果。

默认情况下，模型是可变的，字段值可以通过属性赋值改变：

```python
user.id = 321
assert user.id == 321
```

### 警告：字段名与类型注解重名

定义模型时，注意字段名和它的类型注解不要重名。下面的代码不会按预期工作，会产生验证错误：

```python
from typing import Optional

from pydantic import BaseModel


class Boo(BaseModel):
    int: Optional[int] = None


m = Boo(int=123)  # 将无法通过验证。
```

由于 Python 对带注解赋值语句的求值方式，这一行等价于 `int: None = None`，从而导致验证错误。

### 模型的方法与属性

上面的示例只展示了模型能力的冰山一角。模型类拥有以下方法和属性：

- `model_validate()`：用给定的对象验证并生成模型实例；
- `model_validate_json()`：用给定的 **JSON 数据**验证并生成模型实例；
- `model_construct()`：**不运行验证**地创建模型；
- `model_dump()`：返回模型字段和值的字典；
- `model_dump_json()`：返回 `model_dump()` 的 JSON 字符串表示；
- `model_copy()`：返回模型的副本（默认浅拷贝）；
- `model_json_schema()`：返回表示模型 JSON Schema 的可 JSON 化字典；
- `model_fields`：字段名到字段定义（`FieldInfo` 实例）的映射；
- `model_post_init()`：在模型实例化并应用所有字段验证器之后执行额外操作；
- `model_rebuild()`：重建模型 Schema，也支持构建递归泛型模型。

模型实例具有以下属性：`model_extra`（验证期间设置的额外字段）与 `model_fields_set`（模型初始化时显式提供的字段集合）。

## 数据转换

Pydantic 可能会**强制转换**输入数据以使其符合模型字段类型，某些情况下这可能导致信息丢失：

```python
from pydantic import BaseModel


class Model(BaseModel):
    a: int
    b: float
    c: str


print(Model(a=3.000, b='2.72', c=b'binary data').model_dump())
#> {'a': 3, 'b': 2.72, 'c': 'binary data'}
```

这是 Pydantic 的刻意设计，且通常是最有用的方式。不过，Pydantic 也提供**严格模式**（strict mode），其中不执行任何数据转换，值必须与声明的字段类型相同。

集合类型同理。大多数情况下，你不应该使用抽象容器类，而是直接使用具体类型，例如 `list`。Pydantic 会自动把元组输入转换为列表，用抽象类型（如 `Sequence`）反而可能带来校验性能损失。

## 额外数据

默认情况下，Pydantic 模型**在你提供额外数据时不会报错**，这些值会被直接忽略：

```python
from pydantic import BaseModel


class Model(BaseModel):
    x: int


m = Model(x=1, y='a')
assert m.model_dump() == {'x': 1}
```

`extra` 配置值可以控制这一行为：

```python
from pydantic import BaseModel, ConfigDict


class Model(BaseModel):
    x: int

    model_config = ConfigDict(extra='allow')


m = Model(x=1, y='a')
assert m.model_dump() == {'x': 1, 'y': 'a'}
assert m.__pydantic_extra__ == {'y': 'a'}
```

配置可以取三个值：

- `'ignore'`：忽略额外数据（默认）；
- `'forbid'`：不允许提供额外数据；
- `'allow'`：允许并提供额外数据，存储在 `__pydantic_extra__` 字典属性中。

> 编者注：解析 LLM 返回的 JSON 时，把 `extra` 设为 `'forbid'` 可以顺带检测模型是否输出了 Schema 之外的字段。

## 嵌套模型

可以使用模型本身作为注解中的类型来定义更复杂的层次化数据结构：

```python
from typing import Optional

from pydantic import BaseModel


class Foo(BaseModel):
    count: int
    size: Optional[float] = None


class Bar(BaseModel):
    apple: str = 'x'
    banana: str = 'y'


class Spam(BaseModel):
    foo: Foo
    bars: list[Bar]


m = Spam(foo={'count': 4}, bars=[{'apple': 'x1'}, {'apple': 'x2'}])
print(m.model_dump())
"""
{
    'foo': {'count': 4, 'size': None},
    'bars': [{'apple': 'x1', 'banana': 'y'}, {'apple': 'x2', 'banana': 'y'}],
}
"""
```

支持自引用模型（递归模型）。若类创建时注解引用的符号尚未定义（前向引用），可在定义之后调用 `model_rebuild()` 重建模型 Schema——它取代了 v1 的 `update_forward_refs()`。

## 验证数据

Pydantic 可以用三种不同的模式验证数据：**Python**、**JSON** 和**字符串**。

- Python 模式：模型构造器 `__init__()`（字段值必须用关键字参数提供）以及 `model_validate()`（数据可以是字典或模型实例）。
- JSON 与字符串模式：`model_validate_json()` 把数据作为 JSON 字符串或 `bytes` 验证——如果你的输入数据是 JSON 载荷，这通常比先手动解析成字典更快；`model_validate_strings()` 把数据作为字符串键值（可嵌套）字典验证，按 JSON 模式将这些字符串强制转换为正确类型。

```python
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ValidationError


class User(BaseModel):
    id: int
    name: str = 'John Doe'
    signup_ts: Optional[datetime] = None


m = User.model_validate({'id': 123, 'name': 'James'})
print(m)
#> id=123 name='James' signup_ts=None

try:
    m = User.model_validate_json('{"id": 123, "name": 123}')
except ValidationError as e:
    print(e)
    """
    1 validation error for User
    name
      Input should be a valid string [type=string_type, input_value=123, input_type=int]
    """

m = User.model_validate_strings(
    {'id': '123', 'name': 'James', 'signup_ts': '2024-04-01T12:00:00'}
)
print(m)
#> id=123 name='James' signup_ts=datetime.datetime(2024, 4, 1, 12, 0)
```

> 编者注：`model_validate_json()` 是解析 LLM API 响应的利器——拿到 `r.json()` 的字典后 `ChatResponse.model_validate(data)`，或者直接对响应文本走 `model_validate_json`。结构化输出（JSON Schema 约束模型行为）依赖的正是 `model_json_schema()` 生成的 Schema（详见模块 5、6 相关篇目）。

### 不经验证创建模型

`model_construct()` 允许**不经验证**创建模型。适用场景包括：数据已知有效（出于性能原因）、验证器非幂等、验证器有副作用。但它可能创建出无效的模型——**只应对已经验证过的、或绝对可信的数据使用**。在 Pydantic V2 中，验证与 `model_construct()` 的性能差距已大幅缩小，对简单模型来说验证甚至可能更快，出于性能理由使用前请先实测。

## 错误处理

每当 Pydantic 在验证的数据中发现错误时，它就会抛出一个 `ValidationError` 异常。无论发现多少个错误，都只会抛出一个异常，并且该验证错误将包含有关所有错误及其发生原因的信息：

```python
from pydantic import BaseModel, ValidationError


class Model(BaseModel):
    list_of_ints: list[int]
    a_float: float


data = {
    'list_of_ints': ['1', 2, 'bad'],
    'a_float': 'not a float',
}

try:
    Model(**data)
except ValidationError as e:
    print(e)
    """
    2 validation errors for Model
    list_of_ints.2
      Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='bad', input_type=str]
    a_float
      Input should be a valid number, unable to parse string as a number [type=float_parsing, input_value='not a float', input_type=str]
    """
```

`ValidationError` 包含每个失败位置被拒绝的值。在运行的应用中，捕获它并记录上下文（结合本模块第 16 篇的 logging）是排查 LLM 输出格式问题的第一步。

## 延伸

官方文档 Concepts 部分还有这些与模型相关的重要主题，值得按需深入：**Fields**（`Field()` 自定义默认值、约束、别名）、**Validators**（自定义字段/模型验证器）、**Serialization**（`model_dump` 的 include/exclude/by_alias 等参数）、**JSON Schema**、**Strict mode**、**Settings**（环境变量配置管理）、**泛型模型** 与 **动态模型创建**。FastAPI 的请求体/响应模型正是构建在 Pydantic 模型之上——请继续阅读本模块下一篇。
