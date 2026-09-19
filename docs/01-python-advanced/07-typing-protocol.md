---
title: typing.Protocol 与结构化子类型
source_url: https://mypy.readthedocs.io/en/stable/protocols.html
author: mypy 团队与 Python typing 社区（PEP 544）
license: MIT 许可证（mypy）；公有领域（PEP 544）
fetched_at: 2026-09-19
translated: true
versions: Python 3.12+ / mypy 稳定版
order: 7
group: 语言机制进阶
---
## 为什么需要：抽象不该逼你继承

写 LLM 客户端时几乎所有人都会撞上同一个局面。业务代码要调模型，但你不想在测试里打真实网络；你也不想把自己绑死在某个 SDK 上，因为明天可能换成自建推理网关、换一个供应商、或者加一层缓存代理。于是你定义一个抽象基类：

```python
from abc import ABC, abstractmethod


class LLMClient(ABC):
    @abstractmethod
    def complete(self, prompt: str, *, model: str, max_tokens: int) -> str: ...
```

看起来是对的，直到你发现三件事同时发生：

1. **想兼容它的类型，就必须继承它。** 第三方 SDK 的 `OpenAI` 类不会来继承你的 `LLMClient`——它早就写好了。你只能再包一层适配器，为了类型关系给运行时代码加一个纯仪式性的中间类。
2. **测试替身也得继承它。** 一个只用来返回固定字符串的假客户端，被迫和抽象基类建立继承关系，还要处理 `abstractmethod` 的实例化限制。
3. **接口一改，所有子类跟着改。** 新增一个可选参数，继承链上每一层都要动。

问题的根源在于 Python 类型系统的主流形态是**名义子类型（nominal subtyping）**：`Dog` 是不是 `Animal`，看的是类的继承谱系，和 `isinstance` 的工作方式一致。而 Python 真正的运行时哲学是鸭子类型——「只看行为，不看血统」。名义子类型把静态检查和运行时哲学割裂了。

**结构化子类型（structural subtyping）** 补的就是这道裂缝：如果 `Dog` 拥有 `Animal` 要求的全部属性和方法、且类型兼容，那 `Dog` 就是 `Animal` 的子类型——**不需要继承**。`Protocol` 是它在 Python 里的表达方式（PEP 544），mypy 等静态检查器会按成员是否齐备、签名是否兼容来判定。它是鸭子类型的静态化：运行时的「能跑就行」，加上编译期的「行为齐全性检查」。

一句话抓住取舍：**`ABC` 表达「这是一个家族里的成员」，`Protocol` 表达「这是一个我能用的东西」。** 前者适合共享实现与强制契约，后者适合解耦与可替换——而后者正是 LLM 客户端、存储层、外部 API 这些「你不拥有的实现」需要的。

## 概念：协议怎么定义、怎么被判满足、有哪些反直觉处

### 预定义协议：你已经在用了

`collections.abc`、`typing` 和其他标准库模块里已经有一批协议类，对应 Python 常见的内置行为。最典型的是 `Iterable[T]`：只要类定义了合适的 `__iter__`，mypy 就认为它实现了可迭代协议，**不需要显式继承**：

```python
from collections.abc import Iterable, Iterator


class IntList:
    def __init__(self, value: int, next: IntList | None) -> None:
        self.value = value
        self.next = next

    def __iter__(self) -> Iterator[int]:
        current = self
        while current:
            yield current.value
            current = current.next


def print_numbered(items: Iterable[int]) -> None:
    for n, x in enumerate(items):
        print(n + 1, x)


print_numbered(IntList(3, IntList(5, None)))  # OK：没继承 Iterable
print_numbered([4, 5])                        # 也 OK
```

一个顺手的好消息：`IntList` 从没提过 `Iterable`，但它天然可迭代、天然通过类型检查。这类「协议靠实现魔法方法自动满足」的关系还有 `Sized`（`__len__`）、`Container`（`__contains__`）、`Iterator`（`__next__` + `__iter__`）、`Callable`（`__call__`）等。

注意：`typing` 里那些指向同名 ABC 的**已弃用别名**（如 `typing.Iterable`）不要再用了，直接从 `collections.abc` 导入。这一点《类型注解：typing 模块核心章节》里也反复强调。

### 自定义协议

继承特殊的 `Protocol` 基类即可定义协议，方法体通常写成 `...`：

```python
from collections.abc import Iterable
from typing import Protocol


class SupportsClose(Protocol):
    def close(self) -> None: ...


class Resource:  # 没有 SupportsClose 基类！
    def close(self) -> None:
        self.resource.release()


def close_all(items: Iterable[SupportsClose]) -> None:
    for item in items:
        item.close()


close_all([Resource(), open("some/file")])  # OK：普通文件对象也满足协议
```

`Resource` 因为定义了兼容的 `close()` 而成为 `SupportsClose` 的子类型；`open()` 返回的文件对象同样满足——它们彼此之间毫无继承关系，却被同一个注解统一描述了。这就是协议的主要价值：**你能为「你不拥有的类型」写抽象。**

### 子协议、继承，以及一个必须记住的例外

协议可以多继承来合并与扩展：

```python
class SupportsRead(Protocol):
    def read(self, amount: int) -> bytes: ...


class TaggedReadableResource(SupportsClose, SupportsRead, Protocol):
    label: str
```

**关键例外：继承一个协议不会让你的子类自动变成协议。** 想定义协议，必须显式把 `Protocol` 写进基类列表。漏写的后果是子类退化成普通（名义）类，于是它要求实现者真的去继承，结构化匹配失效：

```python
class NotAProtocol(SupportsClose):  # 这**不是**协议
    new_attr: int


class Concrete:
    new_attr: int = 0

    def close(self) -> None: ...


x: NotAProtocol = Concrete()  # 报错：默认走名义子类型
```

反过来，**显式把协议写成基类**是一种有价值的手法，即使你并不需要它是协议：这等于向 mypy 声明「我保证这个类实现了该协议」，逼它去核验实现是否真的兼容——漏写方法、参数名不对都会当场报错。文档还指出一个副作用：协议里**没给值的属性或方法体会被隐式当作抽象成员**，所以显式继承协议又什么都不实现，实例化就会失败：

```python
class SomeProto(Protocol):
    attr: int                      # 注意：没有右侧赋值
    def method(self) -> str: ...   # 字面上只有一个 ...


class ExplicitSubclass(SomeProto):
    pass


ExplicitSubclass()  # error: 无法实例化抽象类，'attr' 与 'method' 未实现
```

还有一种更轻量的「静态断言」写法，不引入任何运行时开销：

```python
_impl_check: SomeProto = ConcreteClass()   # 只想让类型检查器验证兼容性
```

这行代码在项目里通常写作一个模块级的 `_` 前缀变量，纯粹是给 mypy 的合约声明。

### 属性可变性：协议属性是不变量

这是最容易撞、也最难理解的一条。协议里的**数据属性是不变（invariant）的**，宽化不行：

```python
class Box(Protocol):
    content: object          # 可变属性


class IntBox:
    content: int


def takes_box(box: Box) -> None: ...


takes_box(IntBox())  # 报错：content 期望 object，实际 int
```

直觉上 `int` 是 `object`，为什么不行？因为 `Box` 把 `content` 声明成**可读可写**，而 `takes_box` 完全可以写 `box.content = "asdf"`，把一个只能装 `int` 的对象污染成装着字符串——下一次 `my_int_box.content + 1` 就是 `TypeError`。类型系统只能整体拒绝。

修法是把属性声明成**只读**，即用 `@property`：

```python
class Box(Protocol):
    @property
    def content(self) -> object: ...


class IntBox:
    content: int


def takes_box(box: Box) -> None: ...


takes_box(IntBox())  # OK
```

对写 LLM 协议的直接含义是：**协议里的成员尽量写成方法或 `@property`，少写裸属性。** 只有方法参数与返回值是协变/逆变规则的适用对象，裸属性会引入不必要的不变性约束，把本来兼容的实现挡在门外。

### 递归协议、回调协议

协议可以自引用与互相引用，声明树、链表这类递归结构很方便（注意 `from __future__ import annotations` 或把名字写成字符串）：

```python
from __future__ import annotations

from typing import Protocol


class TreeLike(Protocol):
    value: int

    @property
    def left(self) -> TreeLike | None: ...

    @property
    def right(self) -> TreeLike | None: ...
```

回调类型也可以用协议表达——当 `Callable[...]` 写不出你要的签名时（变长位置参数、关键字参数、重载），定义带 `__call__` 的协议：

```python
from typing import Protocol


class Combiner(Protocol):
    def __call__(self, *vals: bytes, maxlen: int | None = None) -> list[bytes]: ...
```

一个必须知道的严格性：**回调协议的方法参数名必须完全一致**（仅限位置参数除外）。上面若把实现写成 `def good_cb(*vals, maxitems=None)`，参数名不同、种类不同，就是类型错误。这一条对 LLM 场景有实际意义：用协议描述「带 `on_token(text: str)` 回调的流式客户端」时，实现方的关键字参数名必须对齐，否则 mypy 报错且报错信息很难懂。

另外，协议成员上的注解被当作「外部可见属性类型」处理，因此可调用对象不会被绑定、描述符不会被触发。若确实要类级语义，需要显式写 `ClassVar[...]`。

### `runtime_checkable`：能用，但要清楚它能检查什么

给协议加 `@runtime_checkable` 装饰器后，可以用它做 `isinstance`：

```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class Portable(Protocol):
    handles: int


class Mug:
    def __init__(self) -> None:
        self.handles = 1


mug = Mug()
isinstance(mug, Portable)  # 运行时也能工作
```

但官方文档的三条警告一个字都不能省：

- **不完整安全。** 运行时**只检查成员是否存在，不检查类型**；方法签名更不会检查。所以 `isinstance` 通过，不代表对方真能干活。
- **`issubclass` 只检查方法存在性**，含数据成员的协议直接 `TypeError`（非方法成员会让 `issubclass` 拒绝执行）。
- **可能出乎意料地慢。** 结构化匹配是逐个属性查的，热路径上不如直接 `hasattr(obj, "close")`。

结论很实际：**协议的首要价值在静态检查，不在运行时断言。** 需要运行时保护时用显式的适配器或 `assert isinstance(...)` 放在边界一次即可，别放进循环。

## 可运行代码

这一节给一个完整可跑的落点：为一个 LLM 客户端写可替换、可测试的接口。三层结构——协议定义能力、真实实现不继承它、假实现也不继承它；测试只依赖协议。

```python
"""llm_port.py —— 用 Protocol 描述 LLM 客户端能力，不绑死实现。"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Iterable
from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable


@dataclass(slots=True)
class Completion:
    """一次补全的结果，屏蔽各家 SDK 的响应对象差异。"""

    text: str
    finish_reason: str = "stop"
    usage: dict[str, int] | None = None


@runtime_checkable
class ChatClient(Protocol):
    """只声明能力：谁能完成一次对话，谁就能被用。

    成员一律写成方法或只读属性，避免协议属性的不变性问题。
    """

    @property
    def model_name(self) -> str: ...

    async def complete(self, messages: list[dict[str, str]], *, temperature: float = 0) -> Completion: ...


class StreamingClient(Protocol):
    """流式能力单独立一个协议：不要把它塞进 ChatClient。

    分开声明，非流式的实现就不必为了凑接口而写一个假的 astream()。
    """

    async def stream(self, messages: list[dict[str, str]]) -> AsyncIterator[str]: ...


class Retrying(Protocol):
    """把「重试策略」也做成协议，业务函数就只依赖行为。"""

    async def run(self, coro_factory: Any) -> Any: ...


# ---------------------------------------------------------------- 真实实现
class HttpxChatClient:
    """基于 httpx 的实现。**完全没有继承 ChatClient。**"""

    def __init__(self, *, http: Any, model: str, timeout: float = 20.0) -> None:
        self._http = http            # 注入进来的 AsyncClient：传输层也可替换
        self._model = model
        self._timeout = timeout

    @property
    def model_name(self) -> str:     # 用 property 满足协议的只读属性
        return self._model

    async def complete(
        self, messages: list[dict[str, str]], *, temperature: float = 0
    ) -> Completion:
        payload = {"model": self._model, "messages": messages, "temperature": temperature}
        resp = await self._http.post("/v1/chat/completions", json=payload, timeout=self._timeout)
        resp.raise_for_status()
        data = resp.json()
        return Completion(
            text=data["choices"][0]["message"]["content"],
            finish_reason=data["choices"][0].get("finish_reason", "stop"),
            usage=data.get("usage"),
        )


# ---------------------------------------------------------------- 测试替身
class FakeChatClient:
    """也**不继承** ChatClient：按脚本依次返回结果，并记录被调用情况。"""

    def __init__(self, scripted: Iterable[str], model: str = "fake-model") -> None:
        self._scripted = list(scripted)
        self._model = model
        self.calls: list[list[dict[str, str]]] = []

    @property
    def model_name(self) -> str:
        return self._model

    async def complete(
        self, messages: list[dict[str, str]], *, temperature: float = 0
    ) -> Completion:
        self.calls.append(messages)
        if not self._scripted:
            raise AssertionError("脚本用完了：说明业务代码多调了一次模型")
        return Completion(text=self._scripted.pop(0))


# ---------------------------------------------------------------- 业务代码
def summarize_many(client: ChatClient, texts: list[str], batch: int = 3) -> list[str]:
    """签名只接受协议：任何满足 ChatClient 的东西都能传进来。"""

    async def _run() -> list[str]:
        return [str((await client.complete([{"role": "user", "content": t.strip()}])).text)
                for chunk in _chunks(texts, batch)
                for t in chunk]

    return asyncio.run(_run())


def _chunks(items: list[str], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


# 给 mypy 的一条静态合约：这两行没有运行时副作用，只做兼容性验证
_static_check_httpx: ChatClient = HttpxChatClient(http=None, model="m")
_static_check_fake: ChatClient = FakeChatClient(["x"])


if __name__ == "__main__":
    # 1) 业务代码对两种实现一视同仁
    fake = FakeChatClient(["第一句摘要", "第二句摘要"])
    print(summarize_many(fake, ["a", "b"]))
    print("模型调用次数：", len(fake.calls))
    print("用的是哪个模型：", fake.model_name)

    # 2) 运行时探测：只查成员存在性，不查签名（够用但要清醒）
    print("fake 是 ChatClient 吗：", isinstance(fake, ChatClient))
    print("一个 dict 是 ChatClient 吗：", isinstance({}, ChatClient))
```

配套的测试文件（`pytest -q` 可直接跑；这里也回答《HTTPX 实战：异步客户端、流式响应与重试》里那条 checklist——怎么用假客户端测重试而不打网络）：

```python
"""test_llm_port.py —— 协议带来的可替换性在这里兑现。"""

import asyncio
import json

import httpx
import pytest

from llm_port import ChatClient, FakeChatClient, HttpxChatClient, summarize_many


def test_business_code_accepts_any_conforming_client():
    fake = FakeChatClient(["hello", "world"])
    assert summarize_many(fake, ["a", "b"]) == ["hello", "world"]
    assert len(fake.calls) == 2            # 调用次数是断言的一部分，不是日志


def test_fake_client_detects_extra_calls():
    fake = FakeChatClient(["only one"])
    with pytest.raises(AssertionError, match="脚本用完了"):
        summarize_many(fake, ["a", "b"])   # 业务多调一次，立刻暴露


def test_httpx_client_with_mock_transport():
    """真实实现 + httpx.MockTransport：验证请求构造与解析，全程不碰网络。"""

    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = request.content.decode()
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "ok"}, "finish_reason": "stop"}],
                "usage": {"total_tokens": 7},
            },
        )

    transport = httpx.MockTransport(handler)

    async def scenario() -> str:
        async with httpx.AsyncClient(transport=transport, base_url="https://api.test") as http:
            client: ChatClient = HttpxChatClient(http=http, model="gpt-5.6-sol")
            out = await client.complete([{"role": "user", "content": "hi"}], temperature=0)
            assert out.usage == {"total_tokens": 7}
            return out.text

    assert asyncio.run(scenario()) == "ok"
    assert captured["path"] == "/v1/chat/completions"
    # 解析回来再断言：别去匹配序列化后的字符串空格，那会随 httpx 版本变
    body = json.loads(captured["body"])
    assert body["model"] == "gpt-5.6-sol"
    assert body["messages"] == [{"role": "user", "content": "hi"}]
    assert body["temperature"] == 0


def test_protocols_are_structural_not_nominal():
    """两个实现都和协议没有继承关系，这正是 Protocol 的意义。"""

    assert "ChatClient" not in [c.__name__ for c in FakeChatClient.__mro__]
    assert "ChatClient" not in [c.__name__ for c in HttpxChatClient.__mro__]
```

用 mypy 复核静态侧（`uvx` 就能跑，不必把 mypy 装进项目环境，见《uv 脚本与 PEP 723 内联依赖》）：

```console
$ uvx mypy --ignore-missing-imports llm_port.py test_llm_port.py
Success: no issues found in 2 source files
```

`_static_check_httpx` 那两行没有任何运行时作用，但它们正是 mypy 通过的原因：把 `HttpxChatClient` 和 `FakeChatClient` 都赋给标注为 `ChatClient` 的名字，检查器就必须逐一核验成员齐备且签名兼容。哪天协议加了方法而实现没跟上，这两行立刻报错——而业务代码里根本不需要这样的断言。

## 常见坑

**1. 忘了写 `Protocol` 基类，子类就退化成名义类型。** 定义子协议时若只继承别的协议而不写 `Protocol`，mypy 会把它当普通类，结构化匹配悄然失效（见上文 `NotAProtocol` 例子）。这是文档专门用一整段警告的点。

**2. 把 `isinstance` 当类型安全检查。** 它只证明成员存在，不证明签名和类型。`class Broken: model_name = "x"; async def complete(self): ...`（参数少了）照样能过 `isinstance`。别用 `runtime_checkable` 代替 mypy。

**3. 对含数据成员的协议用 `issubclass`。** 直接 `TypeError`。含非方法成员的协议只支持 `isinstance`。

**4. 协议成员写成裸属性，导致本应兼容的实现被拒。** 属性是不变量（`content: int` 不满足 `content: object`）。把成员声明成 `@property` 就恢复成只读的协变关系。

**5. 一个协议里塞太多能力。** 把 `complete`、`stream`、`embed`、`count_tokens` 全放一起，任何只提供部分能力的实现都无法满足它，于是你开始 `# type: ignore`——这是接口设计失控的信号。**按能力拆协议**（本文示例把流式单独拆成 `StreamingClient`），需要组合的地方用多协议参数或多个 `Protocol` 基类。

**6. 期望实现方「注册」进协议。** 结构化子类型是隐式的，没有 `register()` 这回事（`ABC` 有）。想让 mypy 核验某个类真的实现了协议，就显式把它写成基类，或者用一条 `_check: SomeProto = Concrete()` 的静态断言。

**7. 回调协议的参数名对不上。** `__call__` 的关键字参数名必须一致，否则不兼容；而这类错误在重构时特别容易出现（改了协议忘了改实现）。

**8. 用 `Any` 兜住一切，等于放弃了协议的价值。** 常见于 `client: Any  # 反正有鸭子类型`。协议的全部意义就是在这里写一个**精确而最小**的能力描述。

**9. 忘记 `from __future__ import annotations` 就写自引用协议。** 递归协议（`TreeLike`、链式的 `next`）在类体里引用自己，需要惰性求值注解或字符串形式，否则类定义阶段就 `NameError`。

**10. 在运行时用 `Protocol` 子类做 `super()` 调用或指望继承到默认实现。** 协议里写默认实现是合法的，显式继承的类能拿到它——但**满足协议**（结构化匹配）的实现不会继承到任何东西，因为它根本没继承。默认实现只在显式继承那条路径上生效。

**11. 把 `Protocol` 用于纯数据形状。** 数据形状该用 `TypedDict`、`dataclasses` 或 Pydantic 模型（见《dataclasses 与 NamedTuple：数据类》《Pydantic 模型（Models）：数据校验的核心》）。`Protocol` 描述的是**行为契约**，尤其是那些你不拥有的实现。

## 延伸阅读

- mypy 官方《Protocols and structural subtyping》（本文主源，含全部规则与反例）：https://mypy.readthedocs.io/en/stable/protocols.html
- PEP 544 – Protocols: Structural subtyping (static duck typing)：https://peps.python.org/pep-0544/
- `typing.Protocol` / `runtime_checkable` 的官方参考条目：https://docs.python.org/3/library/typing.html#typing.Protocol
- typing 官方指南《Protocols》（`@type_check_only`、`__protocol__` 等进阶细节）：https://typing.readthedocs.io/en/latest/reference/protocols.html
- `httpx.MockTransport`（把协议替身换成传输层替身）：https://www.python-httpx.org/advanced/resources/#mock-transport
- 本站相关：《类型注解：typing 模块核心章节》（`typing` 全景与别名迁移）、《装饰器实战：从手写第一个装饰器到 functools 速查》（客户端入口处的参数归一化防线）、《HTTPX 实战：异步客户端、流式响应与重试》（本文示例服务的真实上游）、《asyncio 并发限流与重试范式》（把 `Retrying` 协议落到批量调用上）、《dataclasses 与 NamedTuple：数据类》（数据形状与行为契约的分界）

> **来源**：抓取于 2026-09-19。译自/引自 mypy 官方文档 [Protocols and structural subtyping](https://mypy.readthedocs.io/en/stable/protocols.html)（mypy 与 mypyc 团队，MIT 许可证，已核对仓库 LICENSE 首行声明）以及 [PEP 544 – Protocols: Structural subtyping (static duck typing)](https://peps.python.org/pep-0544/)（Ivan Levkivskyi 等著，公有领域）。`ChatClient` / `HttpxChatClient` / `FakeChatClient` 及测试文件为编者按上述规则构建的 LLM 场景综合示例；模型名与接口参数按 2026-09 现行写法给出。
