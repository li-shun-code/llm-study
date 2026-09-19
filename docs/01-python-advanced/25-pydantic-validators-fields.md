---
title: Pydantic 校验器与字段约束
source_url: https://docs.pydantic.dev/latest/concepts/validators/
author: Samuel Colvin 与 Pydantic 社区
license: MIT 许可证
fetched_at: 2026-09-19
translated: true
versions: Pydantic v2
order: 25
group: 文本与数据校验
---

## 为什么需要：模型输出的 JSON 是不可信输入

《Pydantic 模型（Models）：数据校验的核心》讲清了模型是什么：带类型注解的类，能把字典转成实例并做类型强制转换。但那一页解决的是**结构**问题——字段有没有、类型对不对。真实工程里更棘手的是**语义**问题：

```python
from pydantic import BaseModel


class Invoice(BaseModel):
    company: str
    amount: float
    currency: str
    confidence: float
```

这个模型能挡住 `amount="abc"`，却挡不住下面这些：模型给出的 `amount` 是 `-1200`（把退款方向搞反了）；`currency` 是 `"RMB"`（业务只接受 ISO 4217 的三字母码）；`confidence` 是 `0.97` 而 `company` 是 `"未知"`——一个胡说八道但格式完美的结果；`company` 被塞了 4000 个字符的整段原文（模型把理由写进了字段）。

LLM 的结构化输出有个反直觉的性质：**它越像合法 JSON，越容易被当成可信数据**。传统 API 的输入来自另一个确定性程序，异常形态稀少；模型输出的异常形态是无限的，而且它不会告诉你哪一条是编的。所以「用模型把非结构化文本变成结构化数据」这句话，工程上完整的形式是：**用模型生成候选，用校验器把候选变成可信数据**——中间那道关才是可依赖的部分。

Pydantic 提供了两个层次的工具，本文把它们一次讲清并给出 LLM 场景的完整用法：

- **字段约束（constraints）**：声明式的、能进 JSON Schema 的规则，如 `ge`/`le`、`min_length`/`max_length`、`pattern`。
- **校验器（validators）**：命令式的自定义函数，能看跨字段关系、能改写值、能在失败时给出可回喂给模型的错误信息。

## 概念：约束、四种校验时机、两种写法

### 字段约束：能用声明就别写函数

`Field()` 可以直接挂约束，也可以用 `Annotated` 挂：

```python
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field


class Model(BaseModel):
    positive: int = Field(gt=0)                        # 大于 0（ge 是大于等于）
    ratio: float = Field(ge=0, le=1)                   # 闭区间 [0, 1]
    short_str: str = Field(max_length=3)
    code: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]  # 正则
    precise: Decimal = Field(max_digits=5, decimal_places=2)
    items: list[Annotated[int, Field(gt=0)]]           # 约束加在「元素」上，不是列表上
```

三个容易写错的地方值得现在就点出来：

1. **约束加在 `Annotated` 的哪一层，就作用于哪一层。** `list[Annotated[int, Field(gt=0)]]` 校验每个元素；`Annotated[list[int], Field(...)]` 才作用于列表本身。
2. **给联合类型加约束时，若成员含 `None`，约束会自动下沉到非 `None` 那一支。** `positive: int | None = Field(gt=0)` 是合法且符合直觉的写法。
3. **约束会进 JSON Schema**（`model_json_schema()` 里变成 `minimum`/`maxLength`/`pattern`）。这条对 LLM 工作流极其重要，下一节展开。

`strict=True` 可以按字段关闭类型强制转换：`name: str = Field(strict=True)` 会拒绝 `123`，而默认的宽松模式会把 `"42"` 转成 `42`。对模型输出，**一般保留宽松转换**（模型常把数字写成字符串），只对「转换会掩盖错误」的字段开 strict（比如 `bool` 字段，宽松模式下 `"0"` 会被转成 `True`）。

### 四种字段校验时机

一个字段校验器就是「接收待校验值、返回校验后的值」的可调用对象。有四种模式：

| 模式 | 何时运行 | 典型用途 | 会不会跳过 Pydantic 内置校验 |
| --- | --- | --- | --- |
| `before` | 内置校验**之前**，拿到原始输入 | 归一化：`"1,200"` → `1200`；把标量包成列表 | 不会，之后照常按类型校验 |
| `after` | 内置校验**之后**，拿到已转换的值 | 语义检查：范围、枚举、跨字段 | 不会 |
| `plain` | 完全接管 | 少见 | **会**，返回什么就是什么，类型注解形同虚设 |
| `wrap` | 包住内置校验，手里有 `handler` | 「失败就降级重试」：截断超长文本、吞掉某类错误 | 由你决定 |

`before` 的类型注解应当写 `Any`，因为它可能拿到任何东西：

```python
from typing import Any

from pydantic import BaseModel, field_validator


class Model(BaseModel):
    numbers: list[int]

    @field_validator("numbers", mode="before")
    @classmethod
    def ensure_list(cls, value: Any) -> Any:
        # 模型有时把数组写成单个标量；统一包成列表再交给内置校验
        return value if isinstance(value, list) else [value]
```

注意文档里那句提醒：**`before` 校验器给了你灵活性，就得自己把每一种输入形态考虑全**——上面只判了 `list`，元组会被误包成 `[("a","b")]`。

`wrap` 需要一个强制的 `handler` 参数，把值交给 Pydantic 继续校验。官方那个截断示例正好是 LLM 场景常用的降级手法：

```python
from typing import Annotated, Any

from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    ValidatorFunctionWrapHandler,
    WrapValidator,
)


def truncate(value: Any, handler: ValidatorFunctionWrapHandler) -> str:
    try:
        return handler(value)                 # 交回给 Pydantic 正常校验
    except ValidationError as err:
        if err.errors()[0]["type"] == "string_too_long":
            return handler(value[:5])         # 只有超长才截断后重新校验
        raise


class Model(BaseModel):
    my_string: Annotated[str, Field(max_length=5), WrapValidator(truncate)]
```

`plain` 的坑最大，也最常被误用：它**立即终止校验**，Pydantic 不再按字段类型检查。官方例子 `number: int` 配 `plain` 校验器后，`Model(number='invalid')` 会安静地接受字符串。除非你确实要完全接管某个字段，否则不要用 `plain`。

### 模型级校验器：跨字段规则

`@model_validator` 也有三种模式。最常用的是 `after`，写成**实例方法**、返回 `self`，等价于 post-init 钩子，在这里看跨字段关系最舒服：

```python
from typing_extensions import Self

from pydantic import BaseModel, model_validator


class SearchRequest(BaseModel):
    offset: int = 0
    limit: int = 20
    query: str | None = None

    @model_validator(mode="after")
    def check_window(self) -> Self:
        if self.offset + self.limit > 1000:
            raise ValueError("分页窗口超过 1000 条上限")
        if not self.query or not self.query.strip():
            raise ValueError("query 不能为空")
        return self
```

`mode="before"` 是 `classmethod`，参数是原始输入（通常是 `dict`，但开了 `from_attributes` 时可能是任意对象，所以必须先 `isinstance(data, dict)` 再动它）。文档提醒：**在 `before` 里不要就地改数据后再抛校验错误**——改过的值可能被传给联合类型的其他分支。

`mode="wrap"` 用于「失败时记录原始输入再抛」这类诊断逻辑。继承规则也值得记：基类里定义的模型校验器会在子类实例校验时被调用；子类里重写同名校验器则覆盖父类版本。

### 两种写法怎么选：装饰器 vs `Annotated`

同一个校验器有两种挂法，选择标准很清楚：

- **要复用 → `Annotated`**。把「类型 + 规则」打包成类型别名，在任何模型里直接当类型用，还能作用到列表元素上：

```python
from typing import Annotated

from pydantic import AfterValidator, BaseModel


def is_even(value: int) -> int:
    if value % 2 == 1:
        raise ValueError(f"{value} is not an even number")
    return value


EvenNumber = Annotated[int, AfterValidator(is_even)]


class Model1(BaseModel):
    my_number: EvenNumber


class Model2(BaseModel):
    other: Annotated[EvenNumber, AfterValidator(lambda v: v + 2)]  # 在别名上再加一层


class Model3(BaseModel):
    evens: list[EvenNumber]          # 只作用于元素，不作用于整个列表
```

- **一个函数管多个字段 → 装饰器**。`@field_validator("f1", "f2", mode="before")` 一次贴两个字段；传 `'*'` 则对所有字段（含子类新增的）生效。装饰器版本会被转成 `Annotated` 形式并**追加在已有元数据之后**。

还有两个规则性事实：`default`、`default_factory`、`alias` 这类参数会被静态检查器用来合成 `__init__`，`Annotated` 写法它们不认，所以这几个必须用普通赋值形式。**字段的默认值不校验**（除非 `validate_default=True`），这意味着默认值可以绕过你的所有校验器——写死一个非法默认值是常见的静默 bug 源。

顺序：`before` 与 `wrap` 从右往左执行，`after` 从左往右执行。

### 报错的三种方式，和 `ValidationInfo`

校验器里抛这三种异常会被 Pydantic 接住并转成 `ValidationError`：`ValueError`（最常用）、`AssertionError`（**注意 `python -O` 会跳过 assert**，别把它当生产校验）、`PydanticCustomError`（能自定义错误类型码与模板消息，便于程序化判断）：

```python
from pydantic import BaseModel, ValidationError, field_validator
from pydantic_core import PydanticCustomError


class Model(BaseModel):
    x: int

    @field_validator("x", mode="after")
    @classmethod
    def validate_x(cls, v: int) -> int:
        if v % 42 == 0:
            raise PydanticCustomError("the_answer_error", "{number} is the answer!", {"number": v})
        return v
```

字段与模型校验器都可以多收一个 `ValidationInfo` 参数，里面有：`data`（已校验好的其他字段——**但只含定义顺序在前的字段**）、`context`（`model_validate(obj, context=...)` 传进来的任意对象）、`mode`（`'python'`/`'json'`/`'strings'`）、`field_name`。

`context` 在 LLM 工作流里比看起来有用得多：同一套模型可以按「调用方是谁」「严格度多大」跑出不同校验行为，而不用为每种严格度复制一个类。

### 约束与校验器如何喂给模型：JSON Schema 这一环

因为 `Field` 约束会体现在 `model_json_schema()` 里，把 `{"type": "number", "minimum": 0, "maximum": 1}` 这类信息随 schema 一起发给支持结构化输出的接口，服务端就可能在解码阶段直接约束 token 采样——**这比事后校验便宜得多**。但两件事要分清：

- 约束能进 schema 的，只是声明式那一半。自定义校验器（`AfterValidator`、`@field_validator`）**不会**改变 schema，模型完全看不到。
- 所以正确做法是**双层**：能用 `Field(ge=..., le=..., pattern=..., max_length=...)` 表达的规则全用声明式写，让 schema 携带它；真正需要程序逻辑的判断（跨字段、查词表、比对上下文）再由校验器兜住。把本该声明的规则写成函数，等于白白放弃了一层保护。

## 可运行代码

下面这个例子是本文所有概念的落点：把模型抽出来的发票信息校验成可信数据，失败时把 `ValidationError` 回喂给模型重来一次。它区分了「可自动修复」和「必须回问模型」两类错误。

```python
"""invoice_schema.py —— 用校验器把 LLM 的结构化输出变成可信数据。"""

from __future__ import annotations

import json
import logging
from datetime import date
from decimal import Decimal
from typing import Annotated, Any

from pydantic import (
    BeforeValidator,
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

logger = logging.getLogger(__name__)

# 业务允许的币种白名单（RMB 是常见误写，在校验器里归一成 CNY）
KNOWN = {"CNY", "USD", "EUR", "JPY", "HKD", "GBP"}

# --- 可复用的类型别名：声明式约束 + 必要的自定义校验 -------------------

ISO_CODE = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]  # ISO 4217 三字母码（子集校验见下）
Ratio = Annotated[float, Field(ge=0.0, le=1.0)]          # 置信度必须落在 [0,1]


def _normalize_money(value: Any) -> Any:
    """before 校验器：把 '1,234.50 元'、'￥12' 这类形态洗成 Decimal 能吃的字符串。"""
    if isinstance(value, (int, float, Decimal)):
        return value
    if isinstance(value, str):
        cleaned = (
            value.replace(",", "")
            .replace("￥", "")
            .replace("¥", "")
            .replace("元", "")
            .replace(" ", "")
        )
        return cleaned or None        # 空串交给内置校验去报 missing
    return value                      # 其他类型原样交给 Pydantic


Money = Annotated[
    Decimal,
    Field(max_digits=14, decimal_places=2, gt=0),   # 金额必为正，最多 2 位小数
]

# 把清洗逻辑接到 Money 上：before 在前，Pydantic 内置转换在后
MoneyClean = Annotated[Money, BeforeValidator(_normalize_money)]


class InvoiceExtraction(BaseModel):
    """LLM 输出的落点。注意 model_config 里开了 validate_default。"""

    model_config = ConfigDict(validate_default=True, extra="ignore", str_strip_whitespace=True)

    company: str = Field(min_length=1, max_length=120)
    amount: MoneyClean
    currency: ISO_CODE = "CNY"
    invoice_date: date | None = None
    confidence: Ratio = 0.5

    # 只有模型自报「不确定」时才会用到的说明字段
    reason: str | None = Field(default=None, max_length=300)

    @field_validator("company", mode="after")
    @classmethod
    def reject_placeholder_company(cls, v: str) -> str:
        # 格式完美但内容胡说：这类必须由校验器拦，schema 表达不了
        if v in {"未知", "无", "N/A", "null", "None", "-"}:
            raise ValueError("company 不能是占位词，请给出实际名称")
        return v

    @field_validator("currency", mode="after")
    @classmethod
    def check_known_currency(cls, v: str) -> str:
        # RMB/CNY 的常见混淆在这里归一，其余未知码直接拒绝
        if v == "RMB":
            return "CNY"
        if v not in {"CNY", "USD", "EUR", "JPY", "HKD", "GBP"}:
            raise ValueError(f"不支持的货币码 {v}，仅接受 {sorted(KNOWN)}")
        return v

    @model_validator(mode="after")
    def low_confidence_needs_reason(self) -> InvoiceExtraction:
        # 跨字段规则：置信度低就必须给理由，否则视为不可信结果
        if self.confidence < 0.6 and not (self.reason and self.reason.strip()):
            raise ValueError("confidence < 0.6 时必须填写 reason")
        return self


def validate_llm_output(raw: str) -> InvoiceExtraction:
    """把模型返回的文本变成模型实例；失败抛 ValidationError 交给上层决定重试。"""
    data = json.loads(raw)                  # 先过 JSON 解析这道关
    return InvoiceExtraction.model_validate(data)


def errors_as_feedback(exc: ValidationError) -> str:
    """把校验错误压成一段可回喂给模型的提示词。

    这是结构化输出工程里性价比最高的一小段代码：
    与其笼统地说「格式不对，请重试」，不如把每条具体原因原样贴回去。
    """
    lines = [
        f"- 字段 {'.'.join(map(str, e['loc'])) or '(根对象)'}：{e['msg']}"
        f"（收到的值：{e['input']!r}）"
        for e in exc.errors()
    ]
    return "你上一次的输出未通过校验，请修正后只重新输出 JSON：\n" + "\n".join(lines)


# --- 一次完整的「校验失败 -> 回喂 -> 重试」循环 -------------------------

def extract_with_self_fix(call_llm, first_prompt: str, max_rounds: int = 2):
    """call_llm(prompt: str) -> str 由调用方注入，便于用假客户端做测试。"""
    prompt = first_prompt
    for round_no in range(1, max_rounds + 2):
        try:
            return validate_llm_output(call_llm(prompt))
        except json.JSONDecodeError as exc:
            logger.warning("第 %d 轮：返回的不是合法 JSON（%s）", round_no, exc)
            prompt = first_prompt + "\n\n注意：只输出一个 JSON 对象，不要有任何其他文本。"
        except ValidationError as exc:
            logger.warning("第 %d 轮：校验失败，共 %d 条错误", round_no, exc.error_count())
            if round_no > max_rounds:
                raise                      # 回喂次数用完，把最后一次异常抛给上层
            prompt = first_prompt + "\n\n" + errors_as_feedback(exc)
    raise AssertionError("unreachable")    # 循环内必然 return 或 raise


if __name__ == "__main__":
    # 用假客户端演示：前两次故意给出坏数据，第三次给对的
    script = [
        '{"company": "上海某某科技有限公司", "amount": "12,300.50", "currency": "RMB",'
        ' "confidence": 0.98}',
        '{"company": "未知", "amount": "120", "confidence": 0.3}',
        '{"company": "某某贸易", "amount": "120", "confidence": 0.3, "reason": "抬头被水印遮挡"}',
    ]
    calls = iter(script)

    result = extract_with_self_fix(lambda p: next(calls), "请从下面的文本抽取发票信息：……")
    print(result.model_dump(mode="json"))
    print("金额类型：", type(result.amount).__name__, "币种：", result.currency)

    # 三条坏输入分别演示各自的报错来源
    for bad in [
        '{"company": "某某公司", "amount": "-5"}',                 # gt=0 拦下
        '{"company": "某某公司", "amount": "100", "confidence": 2}',  # Ratio 拦下
        '{"company": "某某公司", "amount": "100", "confidence": 0.4}',  # 跨字段规则拦下
    ]:
        try:
            validate_llm_output(bad)
        except ValidationError as exc:
            print("---", errors_as_feedback(exc).splitlines()[1])
```

跑出来（第一条数据里的 `"12,300.50"` 被 `before` 校验器洗干净、`"RMB"` 被归一成 `CNY`，所以第一轮就通过；后面三条分别被三种不同机制拦下）：

```console
$ python invoice_schema.py
{'company': '上海某某科技有限公司', 'amount': '12300.50', 'currency': 'CNY', 'invoice_date': None, 'confidence': 0.98, 'reason': None}
金额类型： Decimal 币种： CNY
--- - 字段 amount：Input should be greater than 0（收到的值：'-5'）
--- - 字段 confidence：Input should be less than or equal to 1（收到的值：2）
--- - 字段 (根对象)：Value error, confidence < 0.6 时必须填写 reason（收到的值：{'company': '某某公司', 'amount': '100', 'confidence': 0.4}）
```

把 `script` 换成只留后两条，就能看到 `extract_with_self_fix` 的完整回喂路径：第 1 轮抛 `ValidationError`，`errors_as_feedback` 把三条原因拼成提示词追加到原 prompt 后面，第 2 轮模型给出带 `reason` 的结果才收敛。

顺带一句成本视角：每次回喂都是一次完整计费调用。把 schema 里的声明式约束写全，能显著降低回喂率；而回喂时**只贴错误清单、不重复原 prompt 全文**（示例里就是这么做的），能压住重试的 token 开销。

## 常见坑

**1. 校验器忘了 `return`。** 四种模式的字段校验器都必须返回值（`model_validator(mode="after")` 必须返回 `self`）。漏 return 就得到 `None`，随后在更远的地方炸成一个和校验毫无关系的错误。

**2. 用装饰器却漏 `@classmethod`。** 顺序是 `@field_validator(...)` 在上、`@classmethod` 在下、签名收 `cls`。写成实例方法，Pydantic 会在类创建期就报错。

**3. 把 `ValidationInfo.data` 当成完整字典用。** 校验按**字段定义顺序**进行，`info.data` 里只有排在前面的已校验字段。要跨字段校验，就把被依赖的字段定义在前，或者改用 `model_validator(mode="after")`——后者才是跨字段规则的正确位置。`info.data` 在模型校验器里是 `None`。

**4. `plain` 校验器以为自己还在受类型注解保护。** 它返回什么字段就是什么，`number: int` 也能装进字符串。要用「接管」语义就得清楚后果，多数场景应该用 `before` + 内置校验。

**5. `assert` 用于生产校验。** `python -O` 下 assert 语句被剥离，校验静默消失。用显式 `raise ValueError(...)`。

**6. 默认值绕过校验。** 默认值不校验，除非 `validate_default=True`（`model_config` 或 `Field(validate_default=True)`）。`confidence: Ratio = 1.5` 这种笔误不会报错，会一路带到线上。注意：`BaseSettings` 反过来——它的默认值默认就校验，见《Pydantic Settings：把配置从 .env 收进类型》。

**7. 在 `model_validator(mode="before")` 里就地改 `data`。** 输入不一定是 `dict`；而且改完再抛错，被改坏的值可能流向联合类型的其他分支。先 `isinstance` 判断、复制后再改。

**8. 联合类型里靠「顺序」试错。** `Cat | Dog` 与 `Dog | Cat` 行为可能不同，Pydantic 会尝试 smart union 但也可能选中你不想要的分支。跨模型判别请用 `Field(discriminator=...)`，见《Pydantic 模型（Models）：数据校验的核心》的 Discriminator 一节。

**9. `extra` 保持默认 `ignore`，模型幻觉出的多余字段被静默丢弃。** 排查「模型明明返回了 X，代码里却没有」时，先确认 `extra`。想要严格就用 `forbid`，但要注意模型很爱多加 `note`、`explanation` 这类字段——通常 `ignore` + 日志记录被丢掉的键更实用。

**10. 以为 `str_strip_whitespace=True` 会处理嵌套字符串以外的东西。** 它只影响 `str` 类型字段的收边空白；`Literal` 匹配、正则 `pattern` 都在**去空白之前还是之后**生效，取决于校验阶段，写完务必用带空格与换行的样本实测一遍。

**11. 把自定义校验器写进 schema 发给模型，指望它生效。** `min_length`、`pattern` 会进 JSON Schema；自定义函数不会。凡是能用声明式表达的规则都先用声明式，这是一条纪律而不只是风格偏好。

## 延伸阅读

- 官方概念页《Validators》：https://docs.pydantic.dev/latest/concepts/validators/
- 官方概念页《Fields》（`Field()` 全参数、`Annotated` 模式、别名、约束）：https://docs.pydantic.dev/latest/concepts/fields/
- `pydantic.functional_validators` API 参考（`BeforeValidator`/`AfterValidator`/`WrapValidator`/`PlainValidator`/`InstanceOf`/`SkipValidation`）：https://docs.pydantic.dev/latest/api/pydantic_fields/
- 错误类型清单与排错索引（`type` 字段的完整取值）：https://docs.pydantic.dev/latest/errors/errors/
- OpenAI《Structured Outputs》（JSON Schema 约束在服务端的作用范围）：https://platform.openai.com/docs/guides/structured-outputs
- 本站相关：《Pydantic 模型（Models）：数据校验的核心》（模型本体）、《Pydantic Settings：把配置从 .env 收进类型》（配置侧的同套机制）、《正则表达式指南（re 模块）》（`pattern` 约束的正则写法）、《HTTPX 实战：异步客户端、流式响应与重试》（重试与退避的传输层视角）、《asyncio 并发限流与重试范式》（批量抽取时怎么并发跑这套校验+回喂循环）

> **来源**：抓取于 2026-09-19。译自/引自 [Validators](https://docs.pydantic.dev/latest/concepts/validators/) 与 [Fields](https://docs.pydantic.dev/latest/concepts/fields/)（Samuel Colvin 与 Pydantic 社区，MIT 许可证，已核对仓库 LICENSE 为 MIT），内容对应 Pydantic v2。`InvoiceExtraction`、`extract_with_self_fix`、`errors_as_feedback` 及「为什么需要」一节为编者按上述文档组织的 LLM 场景综合示例；模型名与接口参数按 2026-09 现行写法给出。
