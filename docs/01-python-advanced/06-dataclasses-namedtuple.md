---
title: dataclasses 与 NamedTuple：数据类
source_url: https://docs.python.org/zh-cn/3/library/dataclasses.html
author: Python 软件基金会（PSF）文档团队
license: PSF 许可证第 2 版
fetched_at: 2026-09-13
translated: false
versions: Python 3.14 官方文档
order: 6
group: 语言机制进阶
---
**源码：**[Lib/dataclasses.py](https://github.com/python/cpython/tree/3.14/Lib/dataclasses.py)

* * *

这个模块提供了一个装饰器和一些函数，用于自动为用户自定义的类添加生成的 特殊方法 例如 `__init__()` 和 `__repr__()`。 它的初始描述见 [**PEP 557**](https://peps.python.org/pep-0557/)。

在这些生成的方法中使用的成员变量是使用 [**PEP 526**](https://peps.python.org/pep-0526/) 类型标注来定义的。例如以下代码：

```python
from dataclasses import dataclass

@dataclass
class InventoryItem:
    """Class for keeping track of an item in inventory."""
    name: str
    unit_price: float
    quantity_on_hand: int = 0

    def total_cost(self) -> float:
        return self.unit_price * self.quantity_on_hand
```

将添加多项内容，包括如下所示的 `__init__()`:

```python
def __init__(self, name: str, unit_price: float, quantity_on_hand: int = 0):
    self.name = name
    self.unit_price = unit_price
    self.quantity_on_hand = quantity_on_hand
```

请注意此方法会自动添加到类中：它不是在如上所示的 `InventoryItem` 定义中直接指定的。

版本 3.7 中新增。

## 模块内容

**@dataclasses.dataclass(_\*_, _init\=True_, _repr\=True_, _eq\=True_, _order\=False_, _unsafe\_hash\=False_, _frozen\=False_, _match\_args\=True_, _kw\_only\=False_, _slots\=False_, _weakref\_slot\=False_)**

此函数是一个 decorator，它被用于将生成的 特殊方法 添加到类中，如下所述。

`@dataclass` 装饰器会检查类以找到其中的 `field`。 `field` 被定义为具有 类型标注 的类变量。 除了下面所述的两个例外，在 `@dataclass` 中没有任何东西会去检查变量标注中指定的类型。

这些字段在所有生成的方法中的顺序，都是它们在类定义中出现的顺序。

`@dataclass` 装饰器将把各种“双下线”方法添加到类，具体如下所述。 如果所添加的任何方法在类中已存在，其行为将取决于形参的值，具体如下所述。 该装饰器将返回执行其调用的类而不会创建新类。

如果 `@dataclass` 仅被用作不带形参的简单装饰器，其行为相当于使用在此签名中记录的默认值。 也就是说，这三种 `@dataclass` 的用法是等价的:

```python
@dataclass
class C:
    ...

@dataclass()
class C:
    ...

@dataclass(init=True, repr=True, eq=True, order=False, unsafe_hash=False, frozen=False,
           match_args=True, kw_only=False, slots=False, weakref_slot=False)
class C:
    ...
```

`@dataclass` 的形参有：

-   _init_: 如为真值（默认），将生成 `__init__()` 方法。

    如果类已经定义了 `__init__()`，此形参将被忽略。

-   _repr_: 如为真值（默认），将生成 `__repr__()` 方法。 生成的 repr 字符串将带有类名及每个字段的名称和 repr，并按它们在类中定义的顺序排列。 不包括被标记为从 repr 排除的字段。 例如: `InventoryItem(name='widget', unit_price=3.0, quantity_on_hand=10)`。

    如果类已经定义了 `__repr__()`，此形参将被忽略。

-   _eq_: 如为真值（默认），将生成 `__eq__()` 方法。

    此方法将通过按顺序比较每个字段实现类的比较。 比较中的两个实际必须为相同类型。

    如果类已经定义了 `__eq__()`，此形参将被忽略。

    在 3.13 版本发生变更: The generated `__eq__` method now compares each field individually (for example, `self.a == other.a and self.b == other.b`), rather than comparing tuples of fields as in previous versions.

    这一改动让比较更快，但在属性“按同一性相等、按值不相等”（如 `float('nan')`）的情况下可能改变比较结果。

    在 Python 3.12 及更早版本中，比较是通过把各字段组成元组再比较来完成的（例如 `(self.a, self.b) == (other.a, other.b)`）。

-   _order_: 如为真值 (默认为 `False`)，将生成 `__lt__()`, `__le__()`, `__gt__()` 和 `__ge__()` 方法。 这些方法将把类当作由其字段组成的元组那样按顺序进行比较。 要比较的两个实例必须是相同的类型。 如果 _order_ 为真值且 _eq_ 为假值，则会引发 `ValueError`。

    如果类已经定义了 `__lt__()`, `__le__()`, `__gt__()` 或者 `__ge__()` 中的任意一个，将引发 `TypeError`。

-   _unsafe\_hash_: 如为真值，则强制 `dataclasses` 创建 `__hash__()` 方法，即使这样做可能是不安全的。 在其他情况下，将根据 _eq_ 和 _frozen_ 的设置方式来生成 `__hash__()` 方法。 默认值为 `False`。

    `__hash__()` 会在对象被添加到哈希多项集如字典和集合时由内置的 `hash()` 使用。 具有 `__hash__()` 就意味着类的实例是不可变的。 可变性是一个依赖于程序员的实际意图、`__eq__()` 是否存在及其具体行为，以及 `@dataclass` 装饰器中 _eq_ 和 _frozen_ 旗标的值的复杂特征属性。

    在默认情况下，`@dataclass` 不会隐式地添加 `__hash__()` 方法，除非这样做是安全的。 它也不会添加或更改现有的显式定义的 `__hash__()` 方法。 设置类属性 `__hash__ = None` 对 Python 具有特定含义，如 `__hash__()` 文档中所述。

    如果 `__hash__()` 没有被显式定义，或者它被设为 `None`，则 `@dataclass` _可能_ 会添加一个隐式 `__hash__()` 方法。 虽然并不推荐，但你可以用 `unsafe_hash=True` 来强制让 `@dataclass` 创建一个 `__hash__()` 方法。 如果你的类在逻辑上不可变但却仍然可被修改那么可能就是这种情况。 这是一个特殊用例并且应当被小心地处理。

    以下是针对隐式创建 `__hash__()` 方法的规则。 请注意你的数据类中不能既有显式的 `__hash__()` 方法又设置 `unsafe_hash=True`；这将导致 `TypeError`。

    如果 _eq_ 和 _frozen_ 均为真值，则默认 `@dataclass` 将为你生成 `__hash__()` 方法。 如果 _eq_ 为真值而 _frozen_ 为假值，则 `__hash__()` 将被设为 `None`，即将其标记为不可哈希（因为它属于可变对象）。 如果 _eq_ 为假值，则 `__hash__()` 将保持不变，这意味着将使用超类的 `__hash__()` 方法（如果超类是 `object`，这意味着它将回退为基于 id 的哈希）。

    下表总结这些规则（`__hash__()` 隐式生成规则，对应官方文档 3.12/3.13 的表格）：

    | unsafe_hash | eq | frozen | 结果 |
    | --- | --- | --- | --- |
    | False | False | False | 使用父类的 `__hash__()`（通常是 `object` 基于 id 的实现）。 |
    | False | False | True | 使用父类的 `__hash__()`。 |
    | False | True | False | `__hash__ = None`，实例不可哈希（因为可变）。 |
    | False | True | True | 生成 `__hash__()`，由 `eq` 中使用的字段计算。 |
    | True | False | False | 生成 `__hash__()`，由 `eq` 中使用的字段计算（此时不生成 `__eq__`）。 |
    | True | False | True | 生成 `__hash__()`。 |
    | True | True | False | 生成 `__hash__()`，但类其实是可变的，需自行承担风险。 |
    | True | True | True | 生成 `__hash__()`。 |

    注意：既在类里显式定义 `__hash__()` 又设置 `unsafe_hash=True` 会抛出 `TypeError`。

-   _frozen_: 如为真值 (默认为 `False`)，则对字段赋值将引发异常。 这模拟了只读的冻结实例。 详见下方的 讨论。

    如果类中定义了 `__setattr__()` 或 `__delattr__()` 方法，并且 _frozen_ 参数为 True，则会引发 `TypeError` 异常。

-   _match\_args_: 如为真值 (默认为 `True`)，则将根据传给生成的 `__init__()` 方法的非关键字形参列表来创建 `__match_args__` 元组（即使没有生成 `__init__()`，见上文）。 如为假值，或者如果 `__match_args__` 已在类中定义，则不会生成 `__match_args__`。


> 版本 3.10 中新增。

-   _kw\_only_: 如为真值 (默认值为 `False`)，则所有字段都将被标记为仅限关键字的。 如果一个字段被标记为仅限关键字的，则唯一的影响是由仅限关键字的字段生成的 `__init__()` 形参在 `__init__()` 被调用时必须以关键字形式来指定。 详情参见 parameter 术语表条目。 另请参阅 `KW_ONLY` 一节。

    仅限关键字字段不会被包括在 `__match_args__` 中。


> 版本 3.10 中新增。

-   _slots_: 如为真值 (默认为 `False`)，则将生成 `__slots__` 属性并返回一个新类而非原本的类。 如果 `__slots__` 已在类中定义，则会引发 `TypeError`。


> 警告
>
> 在使用 `slots=True` 时向基类 `__init_subclass__()` 传入形参将导致 `TypeError`。 应使用不带参数的 `__init_subclass__` 或使用默认值的绕过方式。 请参阅 [gh-91126](https://github.com/python/cpython/issues/91126) 了解完整细节。
>
> 版本 3.10 中新增。
>
> 在 3.11 版本发生变更: 如果某个字段名称已经包括在基类的 `__slots__` 中，它将不会被包括在生成的 `__slots__` 中以防止 重写它们。 因此，请不要使用 `__slots__` 来获取数据类的字段名称。 而应改用 `fields()`。 为了能够确定所继承的槽位，基类 `__slots__` 可以是任意可迭代对象，但是 _不可以_ 是迭代器。

-   _weakref\_slot_: 如为真值 (默认为 `False`)，则添加一个名为 "\_\_weakref\_\_" 的槽位，这是使得一个实例 `可以弱引用` 所必需的。 指定 `weakref_slot=True` 而不同时指定 `slots=True` 将会导致错误。


> 版本 3.11 中新增。

可以用普通的 Python 语法为各个 `field` 指定默认值：

```python
@dataclass
class C:
    a: int       # 'a' 没有默认值
    b: int = 0   # 为 'b' 赋默认值
```

在这个例子中，`a` 和 `b` 都将被包括在所添加的 `__init__()` 方法中，该方法将被定义为:

```python
def __init__(self, a: int, b: int = 0):
```

如果在具有默认值的字段之后存在没有默认值的字段，将会引发 `TypeError`。无论此情况是发生在单个类中还是作为类继承的结果，都是如此。

**dataclasses.field(_\*_, _default\=MISSING_, _default\_factory\=MISSING_, _init\=True_, _repr\=True_, _hash\=None_, _compare\=True_, _metadata\=None_, _kw\_only\=MISSING_, _doc\=None_)**

对于常见和简单的用例，不需要其他的功能。 但是，有些数据类的特性需要额外的每字段信息。 为了满足这种对额外信息的需求，你可以通过调用所提供的 `field()` 函数来替换默认的字段值。 例如:

```python
@dataclass
class C:
    mylist: list[int] = field(default_factory=list)

c = C()
c.mylist += [1, 2, 3]
```

如上所示，`MISSING` 值是一个哨兵对象，用于检测一些形参是否由用户提供。使用它是因为 `None` 对于一些形参来说是有效的用户值。任何代码都不应该直接使用 `MISSING` 值。

传给 `field()` 的形参有：

-   _default_: 如果提供，这将为该字段的默认值。 设置此形参是因为 `field()` 调用本身会替换通常的默认值所在位置。

-   _default\_factory_: 如果提供，它必须是一个零参数的可调用对象，它将在该字段需要一个默认值时被调用。 在其他目的以外，它还可被用于指定具有可变默认值的字段，如下所述。 同时指定 _default_ 和 _default\_factory_ 将会导致错误。

-   _init_: 如为真值（默认），则该字段将作为一个形参被包括在生成的 `__init__()` 方法中。

-   _repr_: 如为真值（默认值），则该字段将被包括在生成的 `__repr__()` 方法所返回的字符串中。

-   _hash_: 这可以是一个布尔值或 `None`。 如为真值，则此字段将被包括在所生成的 `__hash__()` 方法中。 如为假值，则此字段将被排除在所生成的 `__hash__()` 之外。 如为 `None` (默认值)，则使用 _compare_ 的值：这通常是预期的行为，因为一个字段如果被用于比较那么就应当被包括在哈希运算中。 不建议将该值设为 `None` 以外的任何值。

    设置 `hash=False` 但 `compare=True` 的一个合理情况是，一个计算哈希值的代价很高的字段是检验等价性需要的，且还有其他字段可以用于计算类型的哈希值。可以从哈希值中排除该字段，但仍令它用于比较。

-   _compare_: 如为真值（默认），则该字段将被包括在生成的相等和比较方法中 (`__eq__()`, `__gt__()` 等等)。

-   _metadata_: 这可以是一个映射或为 `None`。 `None` 将被当作空字典来处理。 这个值将被包装在 `MappingProxyType()` 以便其为只读，并暴露在 `Field` 对象上。 它完全不被数据类所使用，并且是作为第三方扩展机制提供的。 多个第三方可以各自拥有其本身的键，以用作元数据的命名空间。

-   _kw\_only_: 如为真值，则该字段将被标记为仅限关键字的。 这将在计算所生成的 `__init__()` 方法的形参时被使用。

    仅限关键字字段也不会被包括在 `__match_args__` 中。


> 版本 3.10 中新增。

-   _doc_: 针对该字段的可选的文档字符串。


> 版本 3.14 中新增。

如果一个字段的默认值是通过调用 `field()` 来指定的，那么该字段对应的类属性将被替换为指定的 _default_ 值。 如果没有提供 _default_，那么该类属性将被删除。 其目的是在 `@dataclass` 装饰器运行之后，这些类属性全都将包含字段默认值，就像直接指定了默认值本身一样。例如，在执行以下代码之后:

```python
@dataclass
class C:
    x: int
    y: int = field(repr=False)
    z: int = field(repr=False, default=10)
    t: int = 20
```

类属性 `C.z` 将为 `10`，类属性 `C.t` 将为 `20`，类属性 `C.x` 和 `C.y` 将不被设置。

**dataclasses.Field**

`Field` 对象描述每个已定义的字段。 这些对象是在内部创建的，并会由 `fields()` 模块级方法返回（见下文）。 用户绝不应直接实例化 `Field` 对象。 已写入文档的属性如下：

-   `name`: 字段的名称。

-   `type`: 字段的类型。

-   `default`, `default_factory`, `init`, `repr`, `hash`, `compare`, `metadata` 和 `kw_only` 具有与 `field()` 函数中对应参数相同的含义和值。


可能存在其他属性，但它们是私有的。用户不应检查或依赖于这些属性。

**dataclasses.InitVar**

`InitVar[T]` 类型标注用于描述 仅限初始化 变量。 使用 `InitVar` 标注的字段将被视作伪字段，因此既不会被 `fields()` 函数返回也不会在除了作为传给 `__init__()` 的和可选的 `__post_init__()` 的形参添加之外以任何方式被使用。

**dataclasses.fields(_class\_or\_instance_)**

返回一个能描述此数据类所包含的字段的元组，元组的每一项都是 `Field` 对象。接受数据类或数据类的实例。如果没有传递一个数据类或实例将引发 `TypeError`。不返回 `ClassVar` 或 `InitVar` 等伪字段。

**dataclasses.asdict(_obj_, _\*_, _dict\_factory\=dict_)**

将数据类 _obj_ 转换为一个字典 (使用工厂函数 _dict\_factory_)。 每个数据类会被转换为以 `name: value` 键值对来存储其字段的字典。 数据类、字典、列表和元组会被递归地处理。 其他对象会通过 `copy.deepcopy()` 来拷贝。

在嵌套的数据类上使用 `asdict()` 的例子:

```python
@dataclass
class Point:
     x: int
     y: int

@dataclass
class C:
     mylist: list[Point]

p = Point(10, 20)
assert asdict(p) == {'x': 10, 'y': 20}

c = C([Point(0, 0), Point(10, 4)])
assert asdict(c) == {'mylist': [{'x': 0, 'y': 0}, {'x': 10, 'y': 4}]}
```

要创建一个浅拷贝，可以使用以下的变通方法：

```python
{field.name: getattr(obj, field.name) for field in fields(obj)}
```

如果 _obj_ 不是一个数据类实例则 `asdict()` 将引发 `TypeError` 。

**dataclasses.astuple(_obj_, _\*_, _tuple\_factory\=tuple_)**

将数据类 _obj_ 转换为元组 (使用工厂函数 _tuple\_factory_)。 每个数据类将被转换为由其字段值组成的元组。 数据类、字典、列表和元组会被递归地处理。 其他对象会通过 `copy.deepcopy()` 来拷贝。

继续前一个例子：

```python
assert astuple(p) == (10, 20)
assert astuple(c) == ([(0, 0), (10, 4)],)
```

要创建一个浅拷贝，可以使用以下的变通方法：

```python
tuple(getattr(obj, field.name) for field in dataclasses.fields(obj))
```

如果 _obj_ 不是一个数据类实例则 `astuple()` 将引发 `TypeError`。

**dataclasses.make\_dataclass(_cls\_name_, _fields_, _\*_, _bases\=()_, _namespace\=None_, _init\=True_, _repr\=True_, _eq\=True_, _order\=False_, _unsafe\_hash\=False_, _frozen\=False_, _match\_args\=True_, _kw\_only\=False_, _slots\=False_, _weakref\_slot\=False_, _module\=None_, _decorator\=dataclass_)**

新建一个名为 _cls\_name_ 的数据类，其字段在 _fields_ 中定义，其基类在 _bases_ 中给出，并使用在 _namespace_ 中给定的命名空间来初始化。 _fields_ 是一个可迭代对象，其中每个元素均为 `name`, `(name, type)` 或 `(name, type, Field)` 的形式。 如果只提供了 `name`，则使用 `typing.Any` 作为 `type`。 _init_, _repr_, _eq_, _order_, _unsafe\_hash_, _frozen_, _match\_args_, _kw\_only_, _slots_ 和 _weakref\_slot_ 等值与其在 `@dataclass` 中具有相同的含义。

如果定义了 _module_，则该数据类的 `__module__` 属性将被设为该值。 在默认情况下，它将被设为调用方的模块名。

 形参是将被用于创建数据类的可调用对象。 它应当接受该类对象作为第一个参数以及与 `@dataclass` 相同的关键字参数。 在默认情况下，将会使用 `@dataclass` 函数。

此函数不是严格必需的，因为任何用于创建带有 `__annotations__` 的新类的 Python 机制都可以在稍后应用 `@dataclass` 函数将类转换为数据类。 提供此函数是为了更方便。 例如:

```python
C = make_dataclass('C',
                   [('x', int),
                     'y',
                    ('z', int, field(default=5))],
                   namespace={'add_one': lambda self: self.x + 1})
```

等价于：

```python
@dataclass
class C:
    x: int
    y: 'typing.Any'
    z: int = 5

    def add_one(self):
        return self.x + 1
```

版本 3.14 中新增。: 增加了  形参。

**dataclasses.replace(_obj_, _/_, _\*\*changes_)**

创建一个与 _obj_ 类型相同的新对象，将字段替换为 _changes_ 的值。 如果 _obj_ 不是数据类，则会引发 `TypeError`。 如果 _changes_ 中的键不是给定数据类的字段名，则会引发 `TypeError`。

新返回的对象是通过调用数据类的 `__init__()` 方法来创建的。 这确保了如果存在 `__post_init__()`，则它也会被调用。

如果存在任何没有默认值的仅初始化变量，那么必须在调用 `replace()` 时指定它们的值，以便它们可以被传递给 `__init__()` 和 `__post_init__()`。

如果 _changes_ 包含任何定义为 `init=False` 的字段都会导致错误。 在此情况下将引发 `ValueError`。

需要预先注意 `init=False` 字段在对 `replace()` 的调用期间的行为。 如果它们会被初始化，它们就不会从源对象拷贝，而是在 `__post_init__()` 中初始化。 通常预期 `init=False` 字段将很少能被正确地使用。 如果要使用它们，那么更明智的做法是使用另外的类构造器，或者自定义的 `replace()` (或类似名称) 方法来处理实例的拷贝。

数据类实例也被泛型函数 `copy.replace()` 所支持。

**dataclasses.is\_dataclass(_obj_)**

如果其参数是数据类或数据类的实例（包括数据类的子类，但不包括泛型别名），则返回 `True`，否则返回 `False`。

如果你需要知道一个类是否是一个数据类的实例（而不是一个数据类本身），那么再添加一个 `not isinstance(obj, type)` 检查：

```python
def is_dataclass_instance(obj):
    return is_dataclass(obj) and not isinstance(obj, type)
```

**dataclasses.MISSING**

一个指明“没有提供 default 或 default\_factory”的哨兵值。

**dataclasses.KW\_ONLY**

一个用作类型标注的哨兵值。 任何在类型为 `KW_ONLY` 的伪字段之后的字段会被标记为仅限关键字的字段。 请注意在其他情况下 `KW_ONLY` 类型的伪字段会被完全忽略。 这包括此类字段的名称。 根据惯例，名称 `_` 会被用作 `KW_ONLY` 字段。 仅限关键字字段指明当类被实例化时 `__init__()` 形参必须以关键字形式来指定。

在这个例子中，字段 `y` 和 `z` 将被标记为仅限关键字字段:

```python
@dataclass
class Point:
    x: float
    _: KW_ONLY
    y: float
    z: float

p = Point(0, y=1.5, z=2.0)
```

在单个数据类中，指定一个以上 `KW_ONLY` 类型的字段将导致错误。

版本 3.10 中新增。

**dataclasses.FrozenInstanceError**

在定义时设置了 `frozen=True` 的类上调用隐式定义的 `__setattr__()` 或 `__delattr__()` 时引发。 这是 `AttributeError` 的一个子类。

## 初始化后处理

**dataclasses.\_\_post\_init\_\_()**

当在类上定义时，它将被所生成的 `__init__()` 调用，通常是以 `self.__post_init__()` 的形式。 但是，如果定义了任何 `InitVar` 字段，它们也将按照它们在类中定义的顺序被传递给 `__post_init__()`。 如果没有生成 `__init__()` 方法，那么 `__post_init__()` 将不会被自动调用。

在其他用途中，这允许初始化依赖于一个或多个其他字段的字段值。例如:

```python
@dataclass
class C:
    a: float
    b: float
    c: float = field(init=False)

    def __post_init__(self):
        self.c = self.a + self.b
```

由 `@dataclass` 生成的 `__init__()` 方法不会调用基类的 `__init__()` 方法。 如果基类有需要被调用的 `__init__()` 方法，通常是在 `__post_init__()` 方法中调用此方法:

```python
class Rectangle:
    def __init__(self, height, width):
        self.height = height
        self.width = width

@dataclass
class Square(Rectangle):
    side: float

    def __post_init__(self):
        super().__init__(self.side, self.side)
```

但是，请注意一般来说数据类生成的 `__init__()` 方法不需要被调用，因为派生的数据类将负责初始化任何本身为数据类的基类的所有字段。

请参阅下面有关仅初始化变量的小节来了解如何将形参传递给 `__post_init__()`。 另请参阅关于 `replace()` 如何处理 `init=False` 字段的警告。

## 类变量

`@dataclass` 会实际检查字段类型的少数几个地方是确定字段是否是在 [**PEP 526**](https://peps.python.org/pep-0526/) 中定义的类变量。 它通过检查字段的类型是否为 `typing.ClassVar` 来做到这一点。 如果一个字段是 `ClassVar`，它将被排除在字段范围之外并会被数据类机制所忽略。 这样的 `ClassVar` 伪字段将不会被模块层级的 `fields()` 函数返回。

## 仅初始化变量

另一个 `@dataclass` 会检查类型标注的地方是为了确定一个字段是否为仅限初始化的变量。 它通过检查字段的类型是否为 `InitVar` 类型来做到这一点。 如果一个字段是 `InitVar`，它会被当作是一个名为仅限初始化字段的伪字段。 因为它不是一个真正的字段，所以它不会被模块层级的 `fields()` 函数返回。 仅限初始化字段会作为形参被添加到所生成的 `__init__()` 方法中，并会被传递给可选的 `__post_init__()` 方法。 在其他情况下它们将不会被数据类所使用。

例如，假设在创建类时没有为某个字段提供值，初始化时将从数据库中取值:

```python
@dataclass
class C:
    i: int
    j: int | None = None
    database: InitVar[DatabaseType | None] = None

    def __post_init__(self, database):
        if self.j is None and database is not None:
            self.j = database.lookup('j')

c = C(10, database=my_database)
```

在这种情况下，`fields()` 将返回 `i` 和 `j` 的 `Field` 对象，但不包括 `database`。

## 冻结的实例

创建真正不可变的 Python 对象是不可能的。 不过，你可以通过将 `frozen=True` 传递给 `@dataclass` 装饰器来模拟出不可变性。 在这种情况下，数据类将向类添加 `__setattr__()` 和 `__delattr__()` 方法。 当被调用时这些方法将会引发 `FrozenInstanceError`。

在使用 `frozen=True` 时会有微小的性能损失: `__init__()` 不能使用简单赋值来初始化字段，而必须使用 `object.__setattr__()`。

## 继承

当数据类由 `@dataclass` 装饰器创建时，它会按 MRO 的反序（也就是说，从 `object` 开始）查看它的所有基类，然后，对于它找到的每个数据类，将基类中的字段添加到一个有序映射中。 在添加完所有基类字段后，它会将它自己的字段添加到这个有序映射中。 所有被生成的方法都将使用这个包含合并后的、计算好的字段的有序映射。 因为这些字段会保持插入顺序，所以派生的类会重写其基类。 一个例子:

```python
@dataclass
class Base:
    x: Any = 15.0
    y: int = 0

@dataclass
class C(Base):
    z: int = 10
    x: int = 15
```

最终的字段列表依次是 `x`, `y`, `z`。 最终的 `x` 类型是 `int`，正如类 `C` 中所指定的。

为 `C` 生成的 `__init__()` 方法看起来像是这样:

```python
def __init__(self, x: int = 15, y: int = 0, z: int = 10):
```

## `__init__()` 中仅限关键字形参的重新排序

在计算出 `__init__()` 所需要的形参之后，任何仅限关键字形参会被移至所有常规（非仅限关键字）形参的后面。 这是 Python 中实现仅限关键字形参所要求的：它们必须位于非仅限关键字形参之后。

在这个例子中，`Base.y`, `Base.w` 和 `D.t` 是仅限关键字字段，而 `Base.x` 和 `D.z` 是常规字段:

```python
@dataclass
class Base:
    x: Any = 15.0
    _: KW_ONLY
    y: int = 0
    w: int = 1

@dataclass
class D(Base):
    z: int = 10
    t: int = field(kw_only=True, default=0)
```

为 `D` 生成的 `__init__()` 方法看起来像是这样:

```python
def __init__(self, x: Any = 15.0, z: int = 10, *, y: int = 0, w: int = 1, t: int = 0):
```

请注意形参原来在字段列表中出现的位置已被重新排序：前面是来自常规字段的形参而后面是来自仅限关键字字段的形参。

仅限关键字形参的相对顺序会在重新排序的 `__init__()` 列表中保持不变。

## 默认工厂函数

如果一个 `field()` 指定了 _default\_factory_，它将在该字段需要默认值时不带参数地被调用。 例如，要创建一个列表的新实例，则使用:

```python
mylist: list = field(default_factory=list)
```

如果一个字段被排除在 `__init__()` 之外 (使用 `init=False`) 并且该字段还指定了 _default\_factory_，则默认的工厂函数将总是会从生成的 `__init__()` 函数中被调用。 发生这种情况是因为没有其他方式能为字段提供初始值。

## 可变的默认值

Python 在类属性中存储默认成员变量值。思考这个例子，不使用数据类:

```python
class C:
    x = []
    def add(self, element):
        self.x.append(element)

o1 = C()
o2 = C()
o1.add(1)
o2.add(2)
assert o1.x == [1, 2]
assert o1.x is o2.x
```

请注意类 `C` 的两个实例将共享同一个类变量 `x`，正如预期的那样。

使用数据类，_如果_ 此代码有效：

```python
@dataclass
class D:
    x: list = []      # 此代码将引发 ValueError
    def add(self, element):
        self.x.append(element)
```

它生成的代码类似于:

```python
class D:
    x = []
    def __init__(self, x=x):
        self.x = x
    def add(self, element):
        self.x.append(element)

assert D().x is D().x
```

这具有与使用 `C` 类的原始示例相同的问题。 也就是说，当创建类实例时如果 `D` 类的两个实例没有为 `x` 指定值则将共享同一个 `x` 的副本。 因为数据类只是使用普通的 Python 类创建机制所以它们也会共享此行为。 数据类没有任何通用方式来检测这种情况。 相反地，`@dataclass` 装饰器在检测到不可哈希的默认形参时将会引发 `ValueError`。 这一行为假定如果一个值是不可哈希的，那么它就是可变对象。 这是一个部分解决方案，但它确实能防止许多常见错误。

使用默认工厂函数是一种创建可变类型新实例的方法，并将其作为字段的默认值:

```python
@dataclass
class D:
    x: list = field(default_factory=list)

assert D().x is not D().x
```

在 3.11 版本发生变更: 现在不再是寻找并阻止使用类型为 `list`, `dict` 或 `set` 的对象，而是不允许将不可哈希的对象用作默认值。 不可哈希性被用作可变性的近似判断。

## 描述器类型的字段

当字段被 描述器对象 赋值为默认值时会遵循以下行为:

-   传递给数据类的 `__init__()` 方法的字段值会被传递给描述器的 `__set__()` 方法而不会覆盖描述器对象。

-   类似地，当获取或设置字段值时，将调用描述器的 `__get__()` 或 `__set__()` 方法而不是返回或重写描述器对象。

-   为了确定一个字段是否包含默认值 ，`@dataclass` 会使用类访问形式调用描述器的 `__get__()` 方法: `descriptor.__get__(obj=None, type=cls)`。 如果在此情况下描述器返回了一个值，它将被用作字段的默认值。 另一方面，如果在此情况下描述器引发了 `AttributeError`，则不会为字段提供默认值。


```python
class IntConversionDescriptor:
    def __init__(self, *, default):
        self._default = default

    def __set_name__(self, owner, name):
        self._name = "_" + name

    def __get__(self, obj, type):
        if obj is None:
            return self._default

        return getattr(obj, self._name, self._default)

    def __set__(self, obj, value):
        setattr(obj, self._name, int(value))

@dataclass
class InventoryItem:
    quantity_on_hand: IntConversionDescriptor = IntConversionDescriptor(default=100)

i = InventoryItem()
print(i.quantity_on_hand)   # 100
i.quantity_on_hand = 2.5    # 调用 __set__ 并传入 2.5
print(i.quantity_on_hand)   # 2
```

若一个字段的类型是描述器，但其默认值并不是描述器对象，那么该字段只会像普通的字段一样工作。

---

> **来源**：本文为 [dataclasses —— 数据类](https://docs.python.org/zh-cn/3/library/dataclasses.html) 一页的完整翻译，作者 Python 软件基金会（PSF），许可 PSF 许可证第 2 版。抓取于 2026-09-13（Python 3.14 官方文档）。

---

> 编者注：`NamedTuple` 的完整官方文档收录于《类型注解：typing 模块核心章节》一篇的"特殊类型原语"一节。两者的快速对比：`@dataclass` 生成的是普通类（可变、支持方法与继承、运行时无字段校验）；`typing.NamedTuple` 生成的是元组子类（不可变、可解包、按位置/名称访问）。需要运行时校验、序列化（`model_dump`）与嵌套模型时，用《Pydantic 模型（Models）：数据校验的核心》；纯内部数据结构优先标准库 dataclass，零依赖。
