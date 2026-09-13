---
title: Pydantic 模型（Models）：数据校验的核心
source_url: https://docs.pydantic.dev/latest/concepts/models/
author: Pydantic Services Inc. 与 Pydantic 社区
license: MIT 许可证
fetched_at: 2026-09-13
translated: true
order: 12
versions: Pydantic v2
---

*编者导读：Pydantic 定义模式（schema）的主要方式之一是模型（Model）。模型就是继承自 `BaseModel`、并以带注解的属性来定义字段的类。本篇为官方《Models》概念页的完整翻译（v2 语法）。*

你可以把模型类比为 C 等语言中的结构体（struct），或者 API 中单个端点的请求/响应约束。

模型与 Python 的 dataclasses 有很多相似之处，但在设计上存在一些细微却重要的差异，这些差异简化了校验、序列化和 JSON Schema 生成相关的工作流。更多讨论见官方文档的 [Dataclasses](https://docs.pydantic.dev/latest/concepts/dataclasses/) 章节。

未受信任的数据可以传给模型，经过解析和校验之后，Pydantic 保证结果模型实例的字段符合模型上定义的字段类型。

> **注：关于“校验（Validation）”——一个有意为之的“误称”**
> 我们用“校验”一词指代“按给定类型和约束实例化模型（或其他类型）”的过程。这项 Pydantic 最广为人知的能力，在通俗语境中最常被称为“校验”，尽管在其他上下文里这个词可能含义更严格。
>
> 更长的版本：围绕“validation”的潜在混淆来自一个事实——严格来说，Pydantic 的关注点并不完全符合字典定义：
> > **validation**（名词）：检查或证明某事物有效性或准确性的行为。
>
> 在 Pydantic 中，“校验”指的是实例化一个符合指定类型与约束的模型（或其他类型）的过程。Pydantic 保证的是**输出**的类型和约束，而不是输入数据。当你意识到 Pydantic 的 `ValidationError` 是在数据无法被成功解析为模型实例时引发的时候，这一区别就体现出来了。
>
> 这个区别初看微妙，实际上有实用意义。某些情况下，“校验”不止于模型创建，还包括数据的复制与强制转换（coercion）：为了把参数转换成新类型而不修改原始输入，Pydantic 可能会复制传给构造器的参数。想更深入理解对你的使用场景的影响，参见下文《数据转换》和《属性拷贝》两节。
>
> 本质上，Pydantic 的首要目标是保证处理后的结果结构（即所谓“校验”的产物）精确符合所施加的类型提示。鉴于“校验”已是这一过程的通俗叫法，官方文档会一直使用这个词。此外，“parse（解析）”与“validate（校验）”曾混用，现在官方希望只使用“validate”，而“parse”专指 JSON 解析的讨论。

## 基本模型用法

> **注**：Pydantic 大量依赖现有的 Python 类型注解体系来定义模型。如果你对此不熟悉，下列资源会有帮助：《[Type System Guides](https://typing.readthedocs.io/en/latest/guides/index.html)》与《[mypy 文档](https://mypy.readthedocs.io/en/latest/)》。

```python
from pydantic import BaseModel, ConfigDict


class User(BaseModel):
    id: int
    name: str = 'Jane Doe'

    model_config = ConfigDict(str_max_length=10)  # (1)!
```

1. Pydantic 模型支持多种[配置项](https://docs.pydantic.dev/latest/concepts/config/)（可用配置见 `ConfigDict` 文档）。

本例中 `User` 是一个包含两个字段的模型：

- `id`：整数（用 `int` 类型注解），必填；
- `name`：字符串（用 `str` 类型注解），非必填（有默认值）。

官方《[类型](https://docs.pydantic.dev/latest/concepts/types/)》文档展开介绍了所有支持的类型。字段可以用 [`Field()`](https://docs.pydantic.dev/latest/concepts/fields/) 函数以多种方式定制，详见字段文档。

模型可以这样实例化：

```python
user = User(id='123')
```

`user` 是 `User` 的实例。对象初始化时会执行全部解析与校验；只要没有引发 `ValidationError` 异常，就说明结果模型实例是有效的。

模型的字段可以作为 `user` 对象的普通属性访问：

```python
assert user.name == 'Jane Doe'  # (1)!
assert user.id == 123  # (2)!
assert isinstance(user.id, int)
```

1. 初始化 `user` 时没有设置 `name`，所以使用了默认值。可以检查 `model_fields_set` 属性来查看实例化时被显式设置的字段名。
2. 注意字符串 `'123'` 被强制转换成了整数 `123`。关于 Pydantic 转换逻辑的更多细节见《数据转换》一节。

模型实例可以用 `model_dump()` 方法序列化：

```python
assert user.model_dump() == {'id': 123, 'name': 'Jane Doe'}
```

对实例调用 `dict()` 也能得到字典，但嵌套字段不会被递归转换为字典；`model_dump()` 还提供许多参数来自定义序列化结果。

默认情况下模型是可变的，字段值可以通过属性赋值修改：

```python
user.id = 321
assert user.id == 321
```

> **警告**：定义模型时，当心字段名与其类型注解重名。例如下面这样不会按预期工作，并会产生校验错误：
>
> ```python
> from pydantic import BaseModel
>
>
> class Boo(BaseModel):
>     int: int | None = None
>
>
> m = Boo(int=123)  # 校验将失败。
> ```
>
> 因为 Python 对注解赋值语句的求值方式，该语句等价于 `int: None = None`，从而导致校验错误。

### 模型的方法与属性

上面的例子只是模型能力的冰山一角。模型类拥有以下方法与属性：

- `model_validate()`：用 Pydantic 模型校验给定对象。见《校验数据》。
- `model_validate_json()`：用 Pydantic 模型校验给定的 JSON 数据。见《校验数据》。
- `model_construct()`：不运行校验地创建模型。见《不做校验创建模型》。
- `model_dump()`：返回模型字段与取值的字典。见《序列化》。
- `model_dump_json()`：返回 `model_dump()` 结果的 JSON 字符串表示。见《序列化》。
- `model_copy()`：返回模型的拷贝（默认浅拷贝）。见《模型拷贝》。
- `model_json_schema()`：返回表示模型 JSON Schema 的可 JSON 化字典。见《JSON Schema》。
- `model_fields`：字段名到字段定义（`FieldInfo` 实例）的映射。
- `model_computed_fields`：计算属性名到其定义（`ComputedFieldInfo` 实例）的映射。
- `model_parametrized_name()`：为泛型类的参数化形式计算类名。
- `model_post_init()`：在模型实例化、所有字段校验器执行完毕后执行额外操作。
- `model_rebuild()`：重建模型 schema，也支持构建递归泛型模型。见《重建模型 schema》。

模型实例拥有以下属性：

- `model_extra`：校验期间设置的额外字段。
- `model_fields_set`：模型初始化时被显式提供的字段集合。

> **注**：完整的类定义（含方法与属性全表）见 `BaseModel` 的 API 文档。
>
> **提示**：Pydantic V1 到 V2 的变更详见《迁移指南》中“对 `pydantic.BaseModel` 的改动”一节。

## 数据转换

Pydantic 可能会把输入数据强制转换为模型字段类型，某些情况下这会造成信息损失。例如：

```python
from pydantic import BaseModel


class Model(BaseModel):
    a: int
    b: float
    c: str


print(Model(a=3.000, b='2.72', c=b'binary data').model_dump())
#> {'a': 3, 'b': 2.72, 'c': 'binary data'}
```

这是 Pydantic 的刻意设计，通常也是最有用的做法（更长的讨论见 pydantic issue #578）。

不过，Pydantic 也提供[严格模式](https://docs.pydantic.dev/latest/concepts/strict_mode/)：不做任何数据转换，值的类型必须与声明的字段类型一致。

集合类型同理。多数情况下，不要用抽象容器类，直接用具体类型（如 `list`）：

```python
from pydantic import BaseModel


class Model(BaseModel):
    items: list[int]  # (1)!


print(Model(items=(1, 2, 3)))
#> items=[1, 2, 3]
```

1. 这时你可能想用抽象的 `Sequence` 类型来同时接受列表和元组。但 Pydantic 会自动把元组输入转换成列表，所以多数情况并无必要。

另外，使用这些抽象类型还可能带来较差的校验性能；一般而言，使用具体容器类型可以避免不必要的检查。

## 额外数据（Extra data）

默认情况下，Pydantic 模型**在收到额外数据时不会报错**，这些值会被直接忽略：

```python
from pydantic import BaseModel


class Model(BaseModel):
    x: int


m = Model(x=1, y='a')
assert m.model_dump() == {'x': 1}
```

可以用 `extra` 配置项控制这一行为：

```python
from pydantic import BaseModel, ConfigDict


class Model(BaseModel):
    x: int

    model_config = ConfigDict(extra='allow')


m = Model(x=1, y='a')  # (1)!
assert m.model_dump() == {'x': 1, 'y': 'a'}
assert m.__pydantic_extra__ == {'y': 'a'}
```

1. 如果 `extra` 设为 `'forbid'`，这里就会失败。

该配置有三个取值：

- `'ignore'`：忽略额外数据（默认）。
- `'forbid'`：不允许提供额外数据。
- `'allow'`：允许额外数据，并保存在 `__pydantic_extra__` 字典属性中。可以显式标注 `__pydantic_extra__` 的类型，为额外字段提供校验。

校验方法（如 `model_validate()`）有一个可选的 `extra` 参数，可以在本次校验调用中覆盖模型的 `extra` 配置值。更多细节见 `extra` 的 API 文档。

Pydantic dataclasses 也支持额外数据（见 dataclass 配置一节）。

## 嵌套模型

更复杂的层级数据结构可以用模型本身作为类型注解来定义：

```python
from pydantic import BaseModel


class Foo(BaseModel):
    count: int
    size: float | None = None


class Bar(BaseModel):
    apple: str = 'x'
    banana: str = 'y'


class Spam(BaseModel):
    foo: Foo
    bars: list[Bar]


m = Spam(foo={'count': 4}, bars=[{'apple': 'x1'}, {'apple': 'x2'}])
print(m)
"""
foo=Foo(count=4, size=None) bars=[Bar(apple='x1', banana='y'), Bar(apple='x2', banana='y')]
"""
print(m.model_dump())
"""
{
    'foo': {'count': 4, 'size': None},
    'bars': [{'apple': 'x1', 'banana': 'y'}, {'apple': 'x2', 'banana': 'y'}],
}
"""
```

### 循环引用

处理自引用的递归模型时，校验输入中可能出现循环引用。例如校验带有反向引用属性的 ORM 实例时就会发生。

Pydantic 不会在尝试校验含循环引用的数据时引发 `RecursionError`，而是能够检测出循环引用并引发合适的 `ValidationError`：

Python 3.10 及以上：

```python
from pydantic import BaseModel, ValidationError


class ModelA(BaseModel):
    b: 'ModelB | None' = None  # (1)!


class ModelB(BaseModel):
    a: ModelA | None = None


cyclic_data = {}
cyclic_data['a'] = {'b': cyclic_data}
print(cyclic_data)
#> {'a': {'b': {...}}}

try:
    ModelB.model_validate(cyclic_data)
except ValidationError as exc:
    print(exc)
    """
    1 validation error for ModelB
    a.b
      Recursion error - cyclic reference detected [type=recursion_loop, input_value={'a': {'b': {...}}}, input_type=dict]
    """
```

1. 由于 `ModelB` 尚未定义，需要使用前向注解。

（Python 3.14+ 可直接写 `b: ModelB | None = None`，无需前向注解字符串。）

另见官方“循环引用示例”，以及“循环导入”一节——用于彼此独立模块中相互引用的模型。

## 重建模型 schema

在代码中定义模型类时，Pydantic 会分析类体，收集校验和序列化所需的各种信息，汇总为核心 schema（core schema）。其中，模型的类型注解会被求值，以确定每个字段的合法类型（详见官方《架构》文档）。但注解引用的符号在模型类创建时可能尚未定义。为解决这个问题，可以使用 `model_rebuild()` 方法：

```python
from pydantic import BaseModel, PydanticUserError


class Foo(BaseModel):
    x: 'Bar'  # (1)!


try:
    Foo.model_json_schema()
except PydanticUserError as e:
    print(e)
    """
    `Foo` is not fully defined; you should define `Bar`, then call `Foo.model_rebuild()`.

    For further information visit https://errors.pydantic.dev/2/u/class-not-fully-defined
    """


class Bar(BaseModel):
    pass


Foo.model_rebuild()
print(Foo.model_json_schema())
"""
{
    '$defs': {'Bar': {'properties': {}, 'title': 'Bar', 'type': 'object'}},
    'properties': {'x': {'$ref': '#/$defs/Bar'}},
    'required': ['x'],
    'title': 'Foo',
    'type': 'object',
}
"""
```

1. 创建 `Foo` 类时 `Bar` 还未定义，因此这里使用了前向注解。

Pydantic 会尽量自动判断何时需要重建、未重建时报错，但在处理递归模型或泛型时，你可能想主动调用 `model_rebuild()`。

在 V2 中，`model_rebuild()` 取代了 V1 的 `update_forward_refs()`，行为略有不同：最大的变化是对最外层模型调用 `model_rebuild()` 时，它会构建用于校验整个模型（包括嵌套模型）的核心 schema，因此在调用之前所有层级的类型都必须就绪。

## 校验数据

Pydantic 可以用三种模式校验数据：*Python*、*JSON* 和 *字符串*。

*Python* 模式在以下情况下使用：

- 模型构造器 `__init__()`：字段值必须以关键字参数提供。
- `model_validate()`：数据可以是字典或模型实例（默认假定实例有效，见 `revalidate_instances` 设置）。显式启用后也可以传入任意对象（见《任意类实例》）。

*JSON* 和 *字符串* 模式使用专门的方法：

- `model_validate_json()`：把数据作为 JSON 字符串或 `bytes` 校验。如果输入数据是 JSON 载荷，这通常比手动解析成字典再校验更快。详见官方 JSON 文档。
- `model_validate_strings()`：把数据作为（可嵌套的）字符串键值字典校验，使用 JSON 模式校验，从而能把字符串转换为正确类型。

与使用模型构造器相比，`model_validate_*()` 方法可以控制多个校验参数（严格度、额外数据、校验上下文等）。

> **注**：取决于类型与模型配置，*Python* 模式与 *JSON* 模式的校验行为可能不同（例如严格度）。如果你的数据来自非 JSON 来源，但希望获得与 *JSON* 模式一致的校验行为与错误，目前的建议是：要么先把数据 dump 成 JSON（如用 `json.dumps()`），要么在数据形如（可嵌套的）字符串键值字典时使用 `model_validate_strings()`。该特性的进展见 pydantic issue #11154。

```python
from datetime import datetime

from pydantic import BaseModel, ValidationError


class User(BaseModel):
    id: int
    name: str = 'John Doe'
    signup_ts: datetime | None = None


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

m = User.model_validate_strings({'id': '123', 'name': 'James'})
print(m)
#> id=123 name='James' signup_ts=None

m = User.model_validate_strings(
    {'id': '123', 'name': 'James', 'signup_ts': '2024-04-01T12:00:00'}
)
print(m)
#> id=123 name='James' signup_ts=datetime.datetime(2024, 4, 1, 12, 0)

try:
    m = User.model_validate_strings(
        {'id': '123', 'name': 'James', 'signup_ts': '2024-04-01'}, strict=True
    )
except ValidationError as e:
    print(e)
    """
    1 validation error for User
    signup_ts
      Input should be a valid datetime, invalid datetime separator, expected `T`, `t`, `_` or space [type=datetime_parsing, input_value='2024-04-01', input_type=str]
    """
```

### 不做校验创建模型

Pydantic 还提供 `model_construct()` 方法，允许**不做校验**地创建模型。至少在以下几种情况下有用：

- 处理已知有效（为性能考虑）的复杂数据；
- 某个校验器函数不是幂等的；
- 某个校验器函数有不希望被触发的副作用。

> **警告**：`model_construct()` 不做任何校验，意味着它可能创建无效模型。**只应对已通过校验、或你绝对信任的数据使用 `model_construct()`。**

> **注**：Pydantic V2 中，校验（无论直接实例化还是 `model_validate*` 方法）与 `model_construct()` 的性能差距已大幅缩小；对简单模型来说，走校验路径甚至可能更快。如果你出于性能原因使用 `model_construct()`，建议先对实际场景做性能分析再下结论。

注意：对于根模型（root models），根值可以按位置参数传给 `model_construct()`，而不必用关键字参数。

关于 `model_construct()` 行为的补充说明：

- 所谓“不做校验”也包括不把字典转换为模型实例。如果某个字段指向模型类型，你需要自己把内层字典转换成模型。
- 对有默认值的字段，不传关键字参数时仍会使用默认值。
- 对带私有属性的模型，`__pydantic_private__` 字典的填充行为与走校验创建时一致。
- 不会调用模型或其任何父类的 `__init__` 方法，即使定义了自定义 `__init__`。

> **注：`model_construct()` 与额外数据的行为**
>
> - 对 `extra='allow'` 的模型，不对应字段的数据会正确存入 `__pydantic_extra__` 字典，并保存到模型的 `__dict__` 属性。
> - 对 `extra='ignore'` 的模型，不对应字段的数据会被忽略——既不存入 `__pydantic_extra__`，也不存入实例的 `__dict__`。
> - 与走校验实例化不同，`extra='forbid'` 时调用 `model_construct()` 遇到不对应字段的数据不会报错，而是直接忽略该输入数据。

### 自定义 `__init__()`

Pydantic 为模型提供了默认的 `__init__()` 实现，它**只在**使用模型构造器时被调用（`model_validate_*()` 方法不会调用它）。该实现把校验委托给 `pydantic-core`。

你也可以在模型上定义自定义 `__init__()`。这种情况下，它会从所有校验方法中被无条件调用，并且不执行校验（因此你应在实现中调用 `super().__init__(**kwargs)`）。

不推荐自定义 `__init__()`，因为所有校验参数（严格度、额外数据行为、校验上下文）都会失效。如果需要在模型初始化后执行动作，可以使用 *after* 字段校验器或模型校验器，或定义 `model_post_init()` 实现：

```python
import logging
from typing import Any

from pydantic import BaseModel


class MyModel(BaseModel):
    id: int

    def model_post_init(self, context: Any) -> None:
        logging.info("Model initialized with id %d", self.id)
```

## 错误处理

只要在校验的数据中发现错误，Pydantic 就会引发 `ValidationError` 异常。

无论发现多少个错误，都只会引发一个异常，且该校验错误会包含所有错误的信息及其成因。

标准错误与自定义错误的详情见官方《错误处理》页。示例：

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

在这样的例子中，问题数据就在代码里。`ValidationError` 包含每个失败位置的违规值；但在运行中的应用里，你可能还需要把这些细节放进请求或任务的上下文里（官方 Logfire 产品会同时记录两者——本站不展开）。
## 任意类实例（Arbitrary class instances）

（旧称“ORM 模式”/`from_orm()`。）

使用 `model_validate()` 方法时，Pydantic 还能校验任意对象：读取对象上与字段同名的属性即可。这一能力的常见用途是与对象关系映射（ORM）集成。

该功能需要手动启用：设置 `from_attributes` 配置项，或在 `model_validate()` 上使用 `from_attributes` 参数。

本例使用 [SQLAlchemy](https://www.sqlalchemy.org/)，但同样的方法适用于任何 ORM。

```python
from typing import Annotated

from sqlalchemy import ARRAY, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from pydantic import BaseModel, ConfigDict, StringConstraints


class Base(DeclarativeBase):
    pass


class CompanyOrm(Base):
    __tablename__ = 'companies'

    id: Mapped[int] = mapped_column(primary_key=True, nullable=False)
    public_key: Mapped[str] = mapped_column(
        String(20), index=True, nullable=False, unique=True
    )
    domains: Mapped[list[str]] = mapped_column(ARRAY(String(255)))


class CompanyModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    public_key: Annotated[str, StringConstraints(max_length=20)]
    domains: list[Annotated[str, StringConstraints(max_length=255)]]


co_orm = CompanyOrm(
    id=123,
    public_key='foobar',
    domains=['example.com', 'foobar.com'],
)
print(co_orm)
#> <__main__.CompanyOrm object at 0x0123456789ab>
co_model = CompanyModel.model_validate(co_orm)
print(co_model)
#> id=123 public_key='foobar' domains=['example.com', 'foobar.com']
```

### 嵌套属性

用属性校验模型时，模型实例会同时从顶层属性和更深层嵌套的属性中按需创建。示例：

```python
from pydantic import BaseModel, ConfigDict


class PetCls:
    def __init__(self, *, name: str) -> None:
        self.name = name


class PersonCls:
    def __init__(self, *, name: str, pets: list[PetCls]) -> None:
        self.name = name
        self.pets = pets


class Pet(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str


class Person(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    pets: list[Pet]


bones = PetCls(name='Bones')
orion = PetCls(name='Orion')
anna = PersonCls(name='Anna', pets=[bones, orion])
anna_model = Person.model_validate(anna)
print(anna_model)
#> name='Anna' pets=[Pet(name='Bones'), Pet(name='Orion')]
```

## 模型拷贝（Model copy）

（官方 API 参考：`model_copy()`。）

`model_copy()` 方法允许复制模型（可选地同时更新字段），对冻结模型尤其有用。

```python
from pydantic import BaseModel


class BarModel(BaseModel):
    whatever: int


class FooBarModel(BaseModel):
    banana: float
    foo: str
    bar: BarModel


m = FooBarModel(banana=3.14, foo='hello', bar={'whatever': 123})

print(m.model_copy(update={'banana': 0}))
#> banana=0 foo='hello' bar=BarModel(whatever=123)

# 普通拷贝时 bar 是同一个对象引用：
print(id(m.bar) == id(m.model_copy().bar))
#> True
# 深拷贝时 bar 是新的对象引用：
print(id(m.bar) == id(m.model_copy(deep=True).bar))
#> False
```

## 泛型模型（Generic models）

Pydantic 支持创建泛型模型，便于复用通用模型结构。新的[类型参数语法](https://docs.python.org/3/reference/compound_stmts.html#type-params)（由 [PEP 695](https://peps.python.org/pep-0695/) 在 Python 3.12 引入）与旧语法都受支持。

下面的例子用泛型 Pydantic 模型创建一个可复用的 HTTP 响应载荷包装：

Python 3.10 及以上：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel, ValidationError

DataT = TypeVar('DataT')  # (1)!


class DataModel(BaseModel):
    number: int


class Response(BaseModel, Generic[DataT]):  # (2)!
    data: DataT  # (3)!


print(Response[int](data=1))
#> data=1
print(Response[str](data='value'))
#> data='value'
print(Response[str](data='value').model_dump())
#> {'data': 'value'}

data = DataModel(number=1)
print(Response[DataModel](data=data).model_dump())
#> {'data': {'number': 1}}
try:
    Response[int](data='value')
except ValidationError as e:
    print(e)
    """
    1 validation error for Response[int]
    data
      Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='value', input_type=str]
    """
```

1. 声明一个或多个用于参数化模型的类型变量（`TypeVar`）。
2. 声明一个继承自 `BaseModel` 与 `typing.Generic`（按此顺序）的 Pydantic 模型，并把先前声明的类型变量列表作为 `Generic` 父类的参数。
3. 在需要被替换为其他类型的位置，用类型变量作注解。

Python 3.12 及以上（新语法）：

```python
from pydantic import BaseModel, ValidationError


class DataModel(BaseModel):
    number: int


class Response[DataT](BaseModel):  # (1)!
    data: DataT  # (2)!


print(Response[int](data=1))
#> data=1
print(Response[str](data='value'))
#> data='value'
print(Response[str](data='value').model_dump())
#> {'data': 'value'}

data = DataModel(number=1)
print(Response[DataModel](data=data).model_dump())
#> {'data': {'number': 1}}
try:
    Response[int](data='value')
except ValidationError as e:
    print(e)
    """
    1 validation error for Response[int]
    data
      Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='value', input_type=str]
    """
```

1. 声明 Pydantic 模型，并把类型变量列表作为类型参数。
2. 在需要被替换为其他类型的位置，用类型变量作注解。

> **注**：v2.11 起完整支持类型参数语法与类型变量默认值。

> **警告**：用具体类型参数化模型时，如果该类型变量带有上界，Pydantic **不会**校验所提供的类型是否可赋值给该上界。

泛型模型上设置的[配置](https://docs.pydantic.dev/latest/concepts/config/)、[校验](https://docs.pydantic.dev/latest/concepts/validators/)或[序列化](https://docs.pydantic.dev/latest/concepts/serialization/)逻辑，同样会应用到参数化后的类，方式与继承模型类一致；自定义方法与属性也会被继承。

泛型模型还能与类型检查器良好配合：你能得到与"为每种参数化声明独立类型"时完全相同的类型检查效果。

> **注**：在内部，泛型模型类被参数化时，Pydantic 会在运行时创建其子类；这些类会被缓存，因此泛型模型的开销极小。

要继承泛型模型并保持其泛型性，子类也必须继承 `Generic`：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel

TypeX = TypeVar('TypeX')


class BaseClass(BaseModel, Generic[TypeX]):
    X: TypeX


class ChildClass(BaseClass[TypeX], Generic[TypeX]):
    pass


# 用 `int` 参数化 `TypeX`：
print(ChildClass[int](X=1))
#> X=1
```

也可以创建泛型模型的子类，部分或全部替换父类的类型变量：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel

TypeX = TypeVar('TypeX')
TypeY = TypeVar('TypeY')
TypeZ = TypeVar('TypeZ')


class BaseClass(BaseModel, Generic[TypeX, TypeY]):
    x: TypeX
    y: TypeY


class ChildClass(BaseClass[int, TypeY], Generic[TypeY, TypeZ]):
    z: TypeZ


# 用 `str` 参数化 `TypeY`：
print(ChildClass[str, int](x='1', y='y', z='3'))
#> x=1 y='y' z=3
```

如果具体子类的名字很重要，可以通过重写 `model_parametrized_name()` 方法自定义命名：

```python
from typing import Any, Generic, TypeVar

from pydantic import BaseModel

DataT = TypeVar('DataT')


class Response(BaseModel, Generic[DataT]):
    data: DataT

    @classmethod
    def model_parametrized_name(cls, params: tuple[type[Any], ...]) -> str:
        return f'{params[0].__name__.title()}Response'


print(repr(Response[int](data=1)))
#> IntResponse(data=1)
print(repr(Response[str](data='a')))
#> StrResponse(data='a')
```

可以把参数化的泛型模型当作类型用在其他模型中：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar('T')


class ResponseModel(BaseModel, Generic[T]):
    content: T


class Product(BaseModel):
    name: str
    price: float


class Order(BaseModel):
    id: int
    product: ResponseModel[Product]


product = Product(name='Apple', price=0.5)
response = ResponseModel[Product](content=product)
order = Order(id=1, product=response)
print(repr(order))
"""
Order(id=1, product=ResponseModel[Product](content=Product(name='Apple', price=0.5)))
"""
```

在嵌套模型中使用同一个类型变量，可以在模型的不同位置强制类型关系：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar('T')


class InnerT(BaseModel, Generic[T]):
    inner: T


class OuterT(BaseModel, Generic[T]):
    outer: T
    nested: InnerT[T]


nested = InnerT[int](inner=1)
print(OuterT[int](outer=1, nested=nested))
#> outer=1 nested=InnerT[int](inner=1)
try:
    print(OuterT[int](outer='a', nested=InnerT(inner='a')))  # (1)!
except ValidationError as e:
    print(e)
    """
    2 validation errors for OuterT[int]
    outer
      Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='a', input_type=str]
    nested.inner
      Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='a', input_type=str]
    """
```

1. `OuterT` 模型以 `int` 参数化，但校验时与 `T` 注解关联的数据是 `str`，导致校验错误。

> **警告**：虽然不一定会报错，我们强烈建议不要在 `isinstance()` 检查中使用参数化泛型。
>
> 例如，不要写 `isinstance(my_model, MyGenericModel[int])`；但可以写 `isinstance(my_model, MyGenericModel)`（注意：对标准泛型而言，用参数化泛型类做子类检查会直接报错）。
>
> 如果确实需要对参数化泛型做 `isinstance()` 检查，可以通过继承参数化泛型类实现：
>
> ```python
> class MyIntModel(MyGenericModel[int]): ...
>
> isinstance(my_model, MyIntModel)
> ```

> **注（实现细节）**：使用嵌套泛型模型时，Pydantic 有时会执行再校验（revalidation），以得到最直观的校验结果。具体来说，若字段类型为 `GenericModel[SomeType]`，而你用 `GenericModel[SomeCompatibleType]` 类型的数据对该字段校验，Pydantic 会检查数据、识别出输入大体上是 `GenericModel` 的“宽松”子类，并对其中的 `SomeCompatibleType` 数据重新校验。这会带来一些校验开销，但让下述场景更直观：
>
> ```python
> from typing import Any, Generic, TypeVar
>
> from pydantic import BaseModel
>
> T = TypeVar('T')
>
>
> class GenericModel(BaseModel, Generic[T]):
>     a: T
>
>
> class Model(BaseModel):
>     inner: GenericModel[Any]
>
>
> print(repr(Model.model_validate(Model(inner=GenericModel[int](a=1)))))
> #> Model(inner=GenericModel[Any](a=1))
> ```
>
> 注意，如果对 `GenericModel[int]` 校验却传入 `GenericModel[str](a='not an int')` 实例，校验依然会失败。
>
> 还值得注意：这一模式会再次触发自定义校验（如模型校验器）。第一遍校验直接针对 `GenericModel[Any]` 进行，会失败（因为 `GenericModel[int]` 不是 `GenericModel[Any]` 的子类——这与上文关于参数化泛型用于 `isinstance()`/`issubclass()` 的警告相关）；随后在更宽松的强制再校验阶段，校验器会被再次调用并成功。

### 未参数化类型变量的校验

类型变量未参数化时，Pydantic 对泛型模型的处理方式与 `list`、`dict` 等内置泛型类型类似：

- 若类型变量有上界（bound）或约束（constraints），则使用该类型。
- 若类型变量有默认类型（按 [PEP 696](https://peps.python.org/pep-0696/)），则使用默认类型。
- 对无上界、无约束的类型变量，Pydantic 回退为 `Any`。

```python
from typing import Generic

from typing_extensions import TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar('T')
U = TypeVar('U', bound=int)
V = TypeVar('V', default=str)


class Model(BaseModel, Generic[T, U, V]):
    t: T
    u: U
    v: V


print(Model(t='t', u=1, v='v'))
#> t='t' u=1 v='v'

try:
    Model(t='t', u='u', v=1)
except ValidationError as exc:
    print(exc)
    """
    2 validation errors for Model
    u
      Input should be a valid integer, unable to parse string as an integer [type=int_parsing, input_value='u', input_type=str]
    v
      Input should be a valid string [type=string_type, input_value=1, input_type=int]
    """
```

> **警告**：某些情况下，对未参数化的泛型模型校验可能导致数据丢失。具体来说：如果使用的是类型变量上界、约束或默认类型的子类型，而模型又未显式参数化，结果类型就**不会**是所提供的那个：
>
> ```python
> from typing import Generic, TypeVar
>
> from pydantic import BaseModel
>
> ItemT = TypeVar('ItemT', bound='ItemBase')
>
>
> class ItemBase(BaseModel): ...
>
>
> class IntItem(ItemBase):
>     value: int
>
>
> class ItemHolder(BaseModel, Generic[ItemT]):
>     item: ItemT
>
>
> `loaded_data = {'item': {'value': 1}}`
>
>
> print(ItemHolder(**loaded_data))  # (1)!
> #> item=ItemBase()
>
> print(ItemHolder[IntItem](**loaded_data))  # (2)!
> #> item=IntItem(value=1)
> ```
>
> 1. 泛型未参数化时，输入数据按 `ItemT` 的上界校验；`ItemBase` 没有字段，因此 `item` 字段的信息丢失了。
> 2. 这里类型变量被显式参数化，输入数据按 `IntItem` 类校验。

### 未参数化类型变量的序列化

当类型变量带有上界、约束或默认值时，序列化行为有所不同：

若类型变量的上界是某个 Pydantic 模型且该类型变量从未被参数化，Pydantic 会用上界做校验，但序列化时把值当作 `Any` 处理：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel


class ErrorDetails(BaseModel):
    foo: str


ErrorDataT = TypeVar('ErrorDataT', bound=ErrorDetails)


class Error(BaseModel, Generic[ErrorDataT]):
    message: str
    details: ErrorDataT


class MyErrorDetails(ErrorDetails):
    bar: str


# 按 Any 序列化
error = Error(
    message='We just had an error',
    details=MyErrorDetails(foo='var', bar='var2'),
)
assert error.model_dump() == {
    'message': 'We just had an error',
    'details': {
        'foo': 'var',
        'bar': 'var2',
    },
}

# 按具体参数化序列化
# 注意 `'bar': 'var2'` 缺失了
error = Error[ErrorDetails](
    message='We just had an error',
    details=ErrorDetails(foo='var'),
)
assert error.model_dump() == {
    'message': 'We just had an error',
    'details': {
        'foo': 'var',
    },
}
```

下面的例子穷举了"上界指定方式 × 泛型参数化方式"的全部组合：

```python
from typing import Generic, TypeVar

from pydantic import BaseModel

TBound = TypeVar('TBound', bound=BaseModel)
TNoBound = TypeVar('TNoBound')


class IntValue(BaseModel):
    value: int


class ItemBound(BaseModel, Generic[TBound]):
    item: TBound


class ItemNoBound(BaseModel, Generic[TNoBound]):
    item: TNoBound


item_bound_inferred = ItemBound(item=IntValue(value=3))
item_bound_explicit = ItemBound[IntValue](item=IntValue(value=3))
item_no_bound_inferred = ItemNoBound(item=IntValue(value=3))
item_no_bound_explicit = ItemNoBound[IntValue](item=IntValue(value=3))

# 对以上任意实例调用 `print(x.model_dump())` 的结果都是：
#> {'item': {'value': 3}}
```

但如果使用的是约束或默认值（按 [PEP 696](https://peps.python.org/pep-0696/)），且类型变量未参数化，那么默认类型或约束会同时用于校验与序列化。可以用 `SerializeAsAny` 注解覆盖该行为：

```python
from typing import Generic

from typing_extensions import TypeVar

from pydantic import BaseModel, SerializeAsAny


class ErrorDetails(BaseModel):
    foo: str


ErrorDataT = TypeVar('ErrorDataT', default=ErrorDetails)


class Error(BaseModel, Generic[ErrorDataT]):
    message: str
    details: ErrorDataT


class MyErrorDetails(ErrorDetails):
    bar: str


# 使用默认类型的序列化器
error = Error(
    message='We just had an error',
    details=MyErrorDetails(foo='var', bar='var2'),
)
assert error.model_dump() == {
    'message': 'We just had an error',
    'details': {
        'foo': 'var',
    },
}
# 如果 `ErrorDataT` 用的是上界，`bar` 会出现在 `details` 中。


class SerializeAsAnyError(BaseModel, Generic[ErrorDataT]):
    message: str
    details: SerializeAsAny[ErrorDataT]


# 按 Any 序列化
error = SerializeAsAnyError(
    message='We just had an error',
    details=MyErrorDetails(foo='var', bar='baz'),
)
assert error.model_dump() == {
    'message': 'We just had an error',
    'details': {
        'foo': 'var',
        'bar': 'baz',
    },
}
```
## 动态模型创建（Dynamic model creation）

（官方 API 参考：`create_model()`。）

某些场合需要用运行时信息来指定字段以创建模型。Pydantic 提供 `create_model()` 函数来动态创建模型：

```python
from pydantic import BaseModel, create_model

DynamicFoobarModel = create_model('DynamicFoobarModel', foo=str, bar=(int, 123))

# 等价于：


class StaticFoobarModel(BaseModel):
    foo: str
    bar: int = 123
```

字段定义以关键字参数指定，可以是：

- 单个元素：表示字段的类型注解；
- 二元组：第一个元素是类型，第二个元素是赋的值（默认值或 `Field()` 函数）。

> **注**：v2.11 起，字段定义为单元素时可以使用任意类型（此前只接受 `Annotated` 形式）。

更高级的例子：

```python
from typing import Annotated

from pydantic import BaseModel, Field, PrivateAttr, create_model

DynamicModel = create_model(
    'DynamicModel',
    foo=(str, Field(alias='FOO')),
    bar=Annotated[str, Field(description='Bar field')],
    _private=(int, PrivateAttr(default=1)),
)


class StaticModel(BaseModel):
    foo: str = Field(alias='FOO')
    bar: Annotated[str, Field(description='Bar field')]
    _private: int = PrivateAttr(default=1)
```

特殊关键字参数 `__config__` 和 `__base__` 可用于定制新模型，包括在基模型上扩展额外字段：

```python
from pydantic import BaseModel, create_model


class FooModel(BaseModel):
    foo: str
    bar: int = 123


BarModel = create_model(
    'BarModel',
    apple=(str, 'russet'),
    banana=(str, 'yellow'),
    __base__=FooModel,
)
print(BarModel)
#> <class '__main__.BarModel'>
print(BarModel.model_fields.keys())
#> dict_keys(['foo', 'bar', 'apple', 'banana'])
```

也可以通过给 `__validators__` 传字典来添加校验器：

```python
from pydantic import ValidationError, create_model, field_validator


def alphanum(cls, v):
    assert v.isalnum(), 'must be alphanumeric'
    return v


validators = {
    'username_validator': field_validator('username')(alphanum)  # (1)!
}

UserModel = create_model(
    'UserModel', username=(str, ...), __validators__=validators
)

user = UserModel(username='scolvin')
print(user)
#> username='scolvin'

try:
    UserModel(username='scolvi%n')
except ValidationError as e:
    print(e)
    """
    1 validation error for UserModel
    username
      Assertion failed, must be alphanumeric [type=assertion_error, input_value='scolvi%n', input_type=str]
    """
```

1. 注意校验器名称不要与任何字段名冲突：Pydantic 内部会把所有成员收集到一个命名空间中，并借助 [types 模块工具](https://docs.python.org/3/library/types.html#dynamic-type-creation)模拟正常的类创建过程。

> **注**：要对动态创建的模型做 pickle：模型必须定义在全局作用域，并且必须提供 `__module__` 参数。
>
> **警告**：如果需要求值字符串引用，本函数可能执行字段注解中包含的任意代码。详见 Python 官方文档“注解内省的安全影响”一节。

另见官方“动态模型示例”，其中给出了从另一个模型派生可选模型的指南。

## `RootModel` 与自定义根类型

（官方 API 参考：`pydantic.root_model.RootModel`。）

通过继承 `pydantic.RootModel`，可以把 Pydantic 模型定义为"自定义根类型"。

根类型可以是 Pydantic 支持的任何类型，由 `RootModel` 的泛型参数指定。根值通过第一个（也是唯一的）参数传给模型 `__init__` 或 `model_validate`。

工作方式示例：

```python
from pydantic import RootModel

Pets = RootModel[list[str]]
PetsByName = RootModel[dict[str, str]]


print(Pets(['dog', 'cat']))
#> root=['dog', 'cat']
print(Pets(['dog', 'cat']).model_dump_json())
#> ["dog","cat"]
print(Pets.model_validate(['dog', 'cat']))
#> root=['dog', 'cat']
print(Pets.model_json_schema())
"""
{'items': {'type': 'string'}, 'title': 'RootModel[list[str]]', 'type': 'array'}
"""

print(PetsByName({'Otis': 'dog', 'Milo': 'cat'}))
#> root={'Otis': 'dog', 'Milo': 'cat'}
print(PetsByName({'Otis': 'dog', 'Milo': 'cat'}).model_dump_json())
#> {"Otis":"dog","Milo":"cat"}
print(PetsByName.model_validate({'Otis': 'dog', 'Milo': 'cat'}))
#> root={'Otis': 'dog', 'Milo': 'cat'}
```

也可以直接创建参数化根模型的子类：

```python
from pydantic import RootModel


class Pets(RootModel[list[str]]):
    def describe(self) -> str:
        return f'Pets: {", ".join(self.root)}'


my_pets = Pets.model_validate(['dog', 'cat'])

print(my_pets.describe())
#> Pets: dog, cat
```

## 伪不可变（Faux immutability）

模型可以通过 `model_config['frozen'] = True` 配置为不可变。设置后，尝试修改实例属性会报错。详见 `ConfigDict.frozen` 的 API 参考。

> **注**：Pydantic V1 通过配置 `allow_mutation = False` 实现此行为；该配置在 V2 中已弃用，由 `frozen` 取代。
>
> **警告**：在 Python 中，不可变性并非强制。开发者始终有能力修改那些按惯例被视为"不可变"的对象。

```python
from pydantic import BaseModel, ConfigDict, ValidationError


class FooBarModel(BaseModel):
    model_config = ConfigDict(frozen=True)

    a: str
    b: dict


foobar = FooBarModel(a='hello', b={'apple': 'pear'})

try:
    foobar.a = 'different'
except ValidationError as e:
    print(e)
    """
    1 validation error for FooBarModel
    a
      Instance is frozen [type=frozen_instance, input_value='different', input_type=str]
    """

print(foobar.a)
#> hello
print(foobar.b)
#> {'apple': 'pear'}
foobar.b['apple'] = 'grape'
print(foobar.b)
#> {'apple': 'grape'}
```

尝试修改 `a` 引发错误，`a` 保持不变。但字典 `b` 本身是可变的，`foobar` 的不可变并不阻止 `b` 被修改。

## 抽象基类

Pydantic 模型可以与 Python 的[抽象基类](https://docs.python.org/3/library/abc.html)（ABC）配合使用：

```python
import abc

from pydantic import BaseModel


class FooBarModel(BaseModel, abc.ABC):
    a: str
    b: int

    @abc.abstractmethod
    def my_abstract_method(self):
        pass
```

## 字段次序

字段次序以下列方式影响模型：

- 字段次序在模型的 [JSON Schema](https://docs.pydantic.dev/latest/concepts/json_schema/) 中保留；
- 字段次序在[校验错误](#错误处理)中保留；
- 字段次序在[序列化数据](https://docs.pydantic.dev/latest/concepts/serialization/)时保留。

```python
from pydantic import BaseModel, ValidationError


class Model(BaseModel):
    a: int
    b: int = 2
    c: int = 1
    d: int = 0
    e: float


print(Model.model_fields.keys())
#> dict_keys(['a', 'b', 'c', 'd', 'e'])
m = Model(e=2, a=1)
print(m.model_dump())
#> {'a': 1, 'b': 2, 'c': 1, 'd': 0, 'e': 2.0}
try:
    Model(a='x', b='x', c='x', d='x', e='x')
except ValidationError as err:
    error_locations = [e['loc'] for e in err.errors()]

print(error_locations)
#> [('a',), ('b',), ('c',), ('d',), ('e',)]
```

## 自动排除的属性

### 类变量

用 `ClassVar` 注解的属性会被 Pydantic 正确地当作类变量处理，不会成为模型实例的字段：

```python
from typing import ClassVar

from pydantic import BaseModel


class Model(BaseModel):
    x: ClassVar[int] = 1

    y: int = 2


m = Model()
print(m)
#> y=2
print(Model.x)
#> 1
```

### 模型私有属性

（官方 API 参考：`pydantic.fields.PrivateAttr`。）

以下划线开头的属性名不会被 Pydantic 当作字段，也不会进入模型 schema。它们会被转换为"私有属性"：在调用 `__init__`、`model_validate` 等时既不校验、也不赋值。

用法示例：

```python
from datetime import datetime
from random import randint
from typing import Any

from pydantic import BaseModel, PrivateAttr


class TimeAwareModel(BaseModel):
    _processed_at: datetime = PrivateAttr(default_factory=datetime.now)
    _secret_value: str

    def model_post_init(self, context: Any) -> None:
        # 这也可以用 `default_factory` 实现：
        self._secret_value = randint(1, 5)


m = TimeAwareModel()
print(m._processed_at)
#> 2032-01-02 03:04:05.000006
print(m._secret_value)
#> 3
```

私有属性名必须以下划线开头，以免与模型字段冲突。但双下划线名（如 `__attr__`）不受支持，会在模型定义中被完全忽略。

> **注**：v2.13 起，default 工厂可以接收已校验的模型数据作为参数。

## 模型签名

所有 Pydantic 模型都会基于其字段生成签名：

```python
import inspect

from pydantic import BaseModel, Field


class FooModel(BaseModel):
    id: int
    name: str = None
    description: str = 'Foo'
    apple: int = Field(alias='pear')


print(inspect.signature(FooModel))
#> (*, id: int, name: str = None, description: str = 'Foo', pear: int) -> None
```

准确的签名对内省和 `FastAPI`、`hypothesis` 这类库很有用。

生成的签名也会尊重自定义的 `__init__` 函数：

```python
import inspect

from pydantic import BaseModel


class MyModel(BaseModel):
    id: int
    info: str = 'Foo'

    def __init__(self, id: int = 1, *, bar: str, **data) -> None:
        """My custom init!"""
        super().__init__(id=id, bar=bar, **data)


print(inspect.signature(MyModel))
#> (id: int = 1, *, bar: str, info: str = 'Foo') -> None
```

要进入签名，字段的别名或名称必须是合法的 Python 标识符。生成签名时 Pydantic 优先使用字段别名而非名称；但如果别名不是合法标识符，则可能改用字段名。

如果字段的别名和名称都_不是_合法标识符（通过对 `create_model` 的非常规用法可能出现），签名中会加入一个 `**data` 参数。此外，只要 `model_config['extra'] == 'allow'`，签名中就始终会有 `**data` 参数。

## 结构化模式匹配

Pydantic 支持模型的结构化模式匹配，由 [PEP 636](https://peps.python.org/pep-0636/) 在 Python 3.10 引入：

```python
from pydantic import BaseModel


class Pet(BaseModel):
    name: str
    species: str


a = Pet(name='Bones', species='dog')

match a:
    # 把 `species` 匹配到 'dog'，声明并初始化 `dog_name`
    case Pet(species='dog', name=dog_name):
        print(f'{dog_name} is a dog')
#> Bones is a dog
    # 默认分支
    case _:
        print('No dog matched')
```

> **注**：match-case 语句看似会创建新模型，但别被迷惑了；它只是"获取属性并比较，或声明并初始化属性"的语法糖。

## 属性拷贝（Attribute copies）

在许多情况下，传给构造器的参数会被复制，以执行校验以及必要时的强制转换。

在下面的例子里，注意类构造完成后列表的 id 变化了——它在校验期间被复制了：

```python
from pydantic import BaseModel


class C1:
    arr = []

    def __init__(self, in_arr):
        self.arr = in_arr


class C2(BaseModel):
    arr: list[int]


arr_orig = [1, 9, 10, 3]


c1 = C1(arr_orig)
c2 = C2(arr=arr_orig)
print(f'{id(c1.arr) == id(c2.arr)=}')
#> id(c1.arr) == id(c2.arr)=False
```

> **注**：某些情况下 Pydantic 不会复制属性，例如传入模型本身时——模型会按原样使用。可以通过设置 `model_config['revalidate_instances'] = 'always'` 覆盖该行为。

---

> **来源**：本文为 Pydantic 官方文档《[Models](https://docs.pydantic.dev/latest/concepts/models/)》（Concepts 章节）的完整翻译，Pydantic Services Inc. 与社区著作，许可 MIT 许可证。全文为 Pydantic v2 语法（`model_dump` / `model_validate` / `model_config = ConfigDict(...)` 等），未收录已弃用的 v1 写法（`.dict()`、`.parse_obj()` 等）。抓取于 2026-09-13。

---

> 编者注：原文中 5 处默认折叠的"API Documentation"折叠块（`BaseModel`、`model_copy`、`create_model`、`RootModel`、`PrivateAttr` 的 API 参考）已在正文相应位置以括注形式保留指向；完整 API 签名请点击原文链接查阅。与标准库 dataclass 的取舍：内部数据结构、零依赖场景用 dataclass（见本模块《dataclasses 与 NamedTuple》一篇）；需要运行时校验、类型强制转换、JSON 序列化（`model_dump`）与 JSON Schema 输出时用 Pydantic——FastAPI（见本模块第 13、14 篇）的请求/响应模型即基于此。
