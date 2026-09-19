---
title: "Pydantic Settings：把配置从 .env 收进类型"
source_url: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
author: Samuel Colvin 与 Pydantic 社区（pydantic-settings）
license: MIT 许可证
fetched_at: 2026-09-19
translated: true
versions: pydantic-settings 2.x（配合 Pydantic v2）
order: 24
group: 文本与数据校验
---

## 为什么需要：配置是「最容易被忘掉的那份输入」

一个 LLM 应用要读多少外部值？模型名、`base_url`、API Key、超时、并发上限、允许的跨域来源、要不要开思考模式、日志等级……这些值散落在环境变量和 `.env` 文件里，本来没什么好讲的——《环境变量与 API Key 管理（.env 与 python-dotenv）》已经把「`.env` 是什么、怎么加载、为什么不能提交进仓库」讲清楚了，本文不重复那部分。

问题出在**读取之后**。最常见的写法是一堆散装 `os.getenv`：

```python
model = os.getenv("MODEL")                        # 忘了设就是 None，一路飘到第一次调用才炸
timeout = os.getenv("HTTP_TIMEOUT")               # 类型是 str，传给 httpx 行为取决于它自己会不会转
max_conn = int(os.getenv("MAX_CONNECTIONS"))      # 没设就 TypeError: int(None)
cors = os.getenv("CORS_ORIGINS", "").split(",")   # 空字符串会切成 ['']，而不是空列表
debug = os.getenv("DEBUG", "false") == "true"     # 有人写 DEBUG=1，于是永远关不掉
```

这段代码的四个毛病，每一个都见过线上事故：**缺失要到最后才暴露**、**字符串没变成该有的类型**、**默认值和解析逻辑各写各的**、**没有一处能集中看到「这个服务到底需要哪些配置」**。配置本质上就是输入，而输入应该被校验——只不过它的校验发生在进程启动的那几十毫秒里，而不是每个请求。

`pydantic-settings` 做的事情就是把配置当成数据模型来定义。你继承 `BaseSettings`，把每个配置项写成带类型注解的字段和默认值；实例化时它按「显式传参 → 环境变量 → `.env` 文件 → secrets 目录」的顺序去取值，取到之后**交给 Pydantic 的校验管线**：类型强制转换、范围检查、约束报错，一整套都是《Pydantic 模型（Models）：数据校验的核心》里那套机制。

于是上面那五行变成一段声明，并且启动即失败：

```python
class Settings(BaseSettings):
    model: str
    http_timeout: float = 20.0
    max_connections: int = Field(default=100, ge=1, le=500)
    cors_origins: list[str] = []
    debug: bool = False
```

附带三个好处：IDE 里 `settings.` 能补全、拼错字段名是 `AttributeError` 而不是悄悄读到 `None`；测试里直接 `Settings(model="fake-model")` 覆盖任意一项，不用 monkeypatch 环境变量；`Settings().model_dump()` 天然就是一份可打印的配置快照（配合脱敏，见下文）。

## 概念：一个模型，四类来源，一条优先级链

安装是独立包，Pydantic v2 起 `BaseSettings` 不在主包里：

```bash
pip install pydantic-settings
# 或（用 uv 的项目）
uv add pydantic-settings
# 或（PEP 723 脚本）
# /// script
# dependencies = ["pydantic-settings>=2,<3"]
# ///
```

### 基本形态与 `SettingsConfigDict`

字段声明规则和 `BaseModel` 一致。所有行为开关集中在 `model_config = SettingsConfigDict(...)` 里，这个字典是 `ConfigDict` 的超集——Pydantic 的全部模型配置（`extra`、`validate_default`、`populate_by_name`……）都能用，再加上 settings 专属的那批（`env_prefix`、`env_file`、`secrets_dir`、`env_nested_delimiter`、`case_sensitive` 等）。

一个值得单独记住的差别：**`BaseSettings` 默认会校验字段的默认值**，`BaseModel` 不会。默认值写错类型，`BaseModel` 里能安静地躺着，`Settings` 会在实例化时直接报错。不想要这层就用 `SettingsConfigDict(validate_default=False)` 或 `Field(default, validate_default=False)`。

### 环境变量名的推导规则

默认规则很朴素：**字段名就是环境变量名**（大小写不敏感）。改造它的手段有四层，越往下越细：

| 手段 | 作用范围 | 典型用途 |
| --- | --- | --- |
| `env_prefix='APP_'` | 整个模型（也作用于 dotenv 与 secrets 来源） | 同一进程里多个子系统共用环境变量空间 |
| `Field(validation_alias='MY_KEY')` | 单个字段，只影响校验侧 | 字段名要符合 PEP 8，环境变量名想另起 |
| `Field(alias='MY_KEY')` | 单个字段，校验和序列化都用它 | 想让 dump 出来也叫这个名字 |
| `Field(validation_alias=AliasChoices('A', 'B'))` | 单个字段，多个候选名 | 兼容历史命名：先读新名，读不到读旧名 |

`case_sensitive=True` 打开后，环境变量名必须和字段名逐字匹配（可带前缀）。这里有个平台陷阱值得写进注释：**Windows 上通过 `os.environ` 暴露的变量名本身是大小写不敏感并被规范成大写的**，所以 `case_sensitive=True` 对**环境变量来源无效**；但 `.env` 文件里的键会保留原样大小写，因此对 dotenv 来源仍然生效。想全平台行为一致，就别依赖大小写区分，改用显式 alias。

### 复杂类型：JSON、分隔符，以及两种逃生阀

`int`/`float`/`str`/`bool` 这类标量按常规方式从字符串转换。**复杂类型（`list`、`set`、`dict`、嵌套模型）默认把环境变量值当 JSON 解析**，所以：

```bash
export APP_CORS_ORIGINS='["https://a.com", "https://b.com"]'   # 正确
export APP_CORS_ORIGINS='https://a.com,https://b.com'            # SettingsError
```

第二行不是笔误，而是**最常见的报错来源**：`SettingsError: error parsing value for field "cors_origins" from source "EnvSettingsSource"`。三条解法，按推荐顺序：

1. **`NoDecode` + 自己的 before 校验器**。给字段挂 `Annotated[list[str], NoDecode]`，跳过 JSON 解码，再用 `field_validator(..., mode='before')` 按逗号切。可以复用一个 `BeforeValidator` 造出通用类型别名：

```python
from typing import Annotated, Any
from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, NoDecode

def split_comma(value: Any) -> Any:
    # 只对字符串做切分；已经是列表（比如测试里显式传入）就原样返回
    return [item.strip() for item in value.split(",")] if isinstance(value, str) else value

CommaSeparated = Annotated[list[str], NoDecode, BeforeValidator(split_comma)]

class Settings(BaseSettings):
    cors_origins: CommaSeparated = []
    trusted_hosts: CommaSeparated = []
```

2. **全局关掉解码**：`SettingsConfigDict(enable_decoding=False)`，此时要为每个复杂字段自备校验器；个别字段想恢复 JSON，用 `Annotated[list[int], ForceDecode]` 覆盖回来。
3. **改用嵌套分隔符**（下一段）。

嵌套模型有两种喂法。一是整段 JSON：`APP_LLM='{"model":"gpt-5.6-sol","temperature":0}'`。二是 `env_nested_delimiter='__'`，让 `APP_LLM__MODEL`、`APP_LLM__TEMPERATURE` 分别落到子字段上，多个变量会自动合并；**带分隔符的变量优先级高于同一字段的 JSON 变量**（`LLM__MODEL` 会盖住 `LLM` 里的 `model`）。两个坑必须点出来：**子模型必须继承 `pydantic.BaseModel`**（不是 settings 类、不是 dataclass），否则会出现「父模型能初始化、子字段取不到值」的诡异结果；**分隔符若是字段名的子串就会切错**——`env_nested_delimiter='_'` 配上 `llm_api_key` 这种字段，`GENERATION_LLM_API_KEY` 会被拆成 `llm.api.key`。官方的解法是 `env_nested_max_split=1`（限制只拆一层）。

### `.env` 与 secrets 目录：位置与优先级

`.env` 的语法与语义在《环境变量与 API Key 管理（.env 与 python-dotenv）》里讲过了，这里只讲 pydantic-settings 侧的接线：

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")
```

要点五条：

- **优先级恒为「真实环境变量 > `.env` 文件 > secrets 目录」**。文件不会覆盖已经在环境里的值，这个方向反过来会让本地调试很反直觉，所以值得背下来。
- `env_file` 可以传**元组/列表**，按顺序加载、后面的覆盖前面的：`env_file=(".env", ".env.prod")`。实例化时用 `Settings(_env_file="prod.env")` 会整体覆盖 `model_config` 的设置（不是追加）；传 `Settings(_env_file=None)` 则彻底不读文件，测试里很好用。
- 只给文件名时 **Pydantic 只看当前工作目录，不会往上找父目录**。从子目录启动脚本就静默失效。`env_file_depth=2` 允许向上两级找（仅对相对路径、且当前目录没找到时生效）。
- **`extra` 默认是 `forbid`，这对 dotenv 同样生效**：`.env` 里多出一个模型没声明的键，会直接 `ValidationError`。这是好事（配置漂移当场暴露），但迁移期通常先松一档：`SettingsConfigDict(env_file=".env", extra="ignore")`。想按前缀把一份共享 dotenv 分给多个模型，用 `dotenv_filtering="match_prefix"`；只想接收已声明字段，用 `"only_existing"`。
- 另外有个不对称要知道：设了 `env_prefix` 时，`.env` 里一条**不带前缀但恰好等于某字段名**的行会被**静默跳过**（既不赋值也不报错），而不带前缀又对不上任何字段的行则会因 `extra='forbid'` 报错。别指望「去掉前缀就能凑巧生效」。

另一条 Secret 通道是 `secrets_dir`：目录里每个**文件名即键名、文件内容即值**，典型场景是 Docker/K8s 挂载的 secret。

```python
class Settings(BaseSettings):
    model_config = SettingsConfigDict(secrets_dir="/run/secrets")
    database_password: str
    openai_api_key: str
```

目录不存在只给 warning、不报错；传入的是文件则报错；可以传多个路径 `secrets_dir=("/var/run", "/run/secrets")`，后面的覆盖前面。默认的 `SecretsSettingsSource` **不支持嵌套模型的 secret 字段**——需要时用 `settings_customise_sources` 钩子换成 `NestedSecretsSettingsSource`。

### 自定义来源与 CLI

`settings_customise_sources()` 是个 classmethod 钩子：把四个内置来源（`init_settings`、`env_settings`、`dotenv_settings`、`file_secret_settings`）重新排序、替换或追加，就能插入「从远端配置中心读」「把 YAML 当第三层」这类逻辑。这是 `pydantic-settings` 最被低估的能力——它意味着**你不需要为了接入公司配置系统而放弃类型化配置**。

包还自带一层 CLI（`CliApp`、`CliAlias`、`CliSubCommand`、`CliPositionalArg`），字段直接变成 `--model=...` 这类参数，支持子命令、变长参数、互斥组、`--help` 生成。这是独立一整套用法，本文不展开；需要时查官方文档的 Command Line Support 一节。

## 可运行代码

下面这份是一个真正能落地的 LLM 服务配置。它同时演示：嵌套模型 + 分隔符 + 上限约束、`AliasChoices` 兼容旧变量名、逗号分隔的 CORS、secrets 目录、脱敏 dump、以及测试里覆盖配置的标准做法。

```python
"""config.py —— 用类型收住一个 LLM 服务的全部外部输入。"""

from __future__ import annotations

import os
from typing import Annotated, Any, Literal

from pydantic import (
    BeforeValidator,
    BaseModel,
    Field,
    SecretStr,
    ValidationError,
    field_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def _split_comma(value: Any) -> Any:
    """把 'a, b' 这类字符串切成列表；已经是列表则原样返回。"""
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


# 逗号分隔的字符串列表：NoDecode 跳过 JSON 解码，BeforeValidator 负责切分
CommaList = Annotated[list[str], NoDecode, BeforeValidator(_split_comma)]


class LLMConfig(BaseModel):
    """上游模型侧配置。注意：必须是 BaseModel，不能是 BaseSettings。"""

    provider: Literal["openai", "deepseek", "local"] = "openai"
    model: str = "gpt-5.6-sol"
    # SecretStr：repr 与 model_dump 默认不会泄露明文，只能 .get_secret_value() 显式取
    api_key: SecretStr = Field(repr=False)
    base_url: str | None = None
    temperature: float = Field(default=0.0, ge=0, le=2)
    # 思考预算：不给就不传（用 None 而非 0 表达「未设置」）
    reasoning_effort: Literal["low", "medium", "high"] | None = None

    @field_validator("base_url")
    @classmethod
    def _strip_slash(cls, v: str | None) -> str | None:
        # 统一去掉末尾斜杠，避免拼出 //chat/completions 这种 404
        return v.rstrip("/") if v else v


class ServerConfig(BaseSettings):
    """服务自身配置：把 LLMConfig 作为嵌套子模型收进来。"""

    model_config = SettingsConfigDict(
        env_prefix="APP_",
        env_nested_delimiter="__",
        env_nested_max_split=1,          # 只拆一层：APP_LLM__MODEL 落到 llm.model
        env_file=(".env", ".env.local"),  # 后者优先
        env_file_encoding="utf-8",
        secrets_dir="/run/secrets",       # Docker secret；本地没有该目录只给 warning
        extra="ignore",                   # 迁移期容忍 .env 里的多余键
        dotenv_filtering="match_prefix",  # 只吃 APP_ 前缀的 dotenv 行
    )

    environment: Literal["dev", "staging", "prod"] = "dev"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # 网络与调度
    http_timeout: float = Field(default=20.0, gt=0, le=600)
    max_connections: int = Field(default=100, ge=1, le=500)
    max_concurrency: int = Field(default=8, ge=1, le=64)
    request_budget_s: float = Field(default=90.0, gt=0)

    # 跨域：环境变量里写 APP_CORS_ORIGINS=https://a.com,https://b.com 即可
    cors_origins: CommaList = []

    llm: LLMConfig

    # 兼容历史变量名：先读 OPENAI_API_KEY，再读 LLM_TOKEN
    legacy_token: Annotated[str | None, Field(validation_alias="OPENAI_API_KEY")] = None

    @property
    def is_prod(self) -> bool:
        return self.environment == "prod"


def load_settings() -> ServerConfig:
    """集中入口：把校验错误翻译成人能看懂的一行，再退出。

    启动期失败必须「说人话」：列出缺哪个字段、为什么。
    """
    try:
        return ServerConfig()
    except ValidationError as exc:
        # 把 pydantic 的错误列表压成一行：字段路径 + 原因
        problems = "; ".join(
            f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()
        )
        raise SystemExit(f"配置校验失败 -> {problems}") from exc


if __name__ == "__main__":
    settings = load_settings()

    # 打印配置快照：mode="json" 下 SecretStr 会被遮蔽成 **********
    print(settings.model_dump(mode="json"))
    print("上游模型：", settings.llm.provider, settings.llm.model)
    print("跨域白名单条数：", len(settings.cors_origins))

    # 也可以完全绕开环境变量，直接构造（测试与本地脚本的常规做法）
    override = ServerConfig(
        environment="prod",
        max_concurrency=32,
        llm=LLMConfig(api_key="sk-from-test-fixture", model="deepseek-flash"),
        _env_file=None,  # 显式不读 .env，保证测试可重复
    )
    print(override.model_dump()["environment"], override.llm.model)

    # 演示「启动即失败」：把 temperature 设成非法值，构造当场报错，
    # 而不是带着 temperature=9 上线、在第一次请求时才炸
    os.environ["APP_LLM__temperature"] = "9"
    try:
        ServerConfig(_env_file=None)
    except ValidationError as exc:
        err = exc.errors()[0]
        print(f"捕获到 {exc.error_count()} 个配置错误：{'.'.join(map(str, err['loc']))} -> {err['msg']}")
    finally:
        del os.environ["APP_LLM__temperature"]
```

配套的 `.env`（放在与 `config.py` 同级目录，且**不要提交进仓库**）：

```bash
# .env —— 值不要写真实 Key，这里只演示格式
APP_ENVIRONMENT=dev
APP_LOG_LEVEL=DEBUG
APP_MAX_CONCURRENCY=8
APP_CORS_ORIGINS=https://admin.example.com,https://localhost:5173
# 嵌套：一个变量一个叶子字段，比塞一大段 JSON 更好维护
APP_LLM__provider=deepseek
APP_LLM__model=deepseek-flash
APP_LLM__base_url=https://api.deepseek.com
APP_LLM__temperature=0
# Key 走 secrets 文件或真实环境变量，不要写进 .env 提交
```

```console
$ export APP_LLM__api_key=sk-xxxxxxxx        # Key 走环境变量或 secrets 目录，不进 .env
$ python config.py
directory "/run/secrets" does not exist     # 本地没有该目录：只是 warning，不中断
{'environment': 'dev', 'log_level': 'DEBUG', ..., 'llm': {'provider': 'deepseek', 'api_key': '**********', ...}}
上游模型： deepseek deepseek-flash
跨域白名单条数： 2
prod deepseek-flash
捕获到 1 个配置错误：llm.temperature -> Input should be less than or equal to 2
```

对应的 `pytest` 用法。覆盖配置不需要 `monkeypatch.setenv`——**直接构造实例最干净，也不会污染进程环境**：

```python
"""test_config.py —— 与 config.py 同目录，pytest -q 可直接跑。"""

import pytest
from pydantic import SecretStr, ValidationError

from config import LLMConfig, ServerConfig


def make_settings(**overrides) -> ServerConfig:
    """测试专用配置工厂：_env_file=None 保证不受本机 .env 与环境变量残留影响。"""
    args = {
        "llm": LLMConfig(api_key=SecretStr("sk-fake"), model="fake-model"),
        "_env_file": None,
    }
    args.update(overrides)
    return ServerConfig(**args)


def test_uses_configured_model():
    assert make_settings().llm.model == "fake-model"


def test_prod_flag_and_concurrency():
    settings = make_settings(environment="prod", max_concurrency=16)
    assert settings.is_prod
    assert 1 <= settings.max_concurrency <= 64


def test_missing_api_key_fails_fast():
    # 不给必填的 api_key：构造子模型当场报错，而不是等到第一次调用模型
    with pytest.raises(ValidationError):
        LLMConfig(model="fake-model")


def test_env_overrides_dotenv(monkeypatch):
    # 真实环境变量的优先级高于 .env：这条测试同时锁住这个不变式
    monkeypatch.setenv("APP_LLM__model", "from-real-env")
    assert ServerConfig().llm.model == "from-real-env"
```

`_env_file=None` 会真正关掉 dotenv 来源，但 **`_secrets_dir=None` 只是「没传这个参数」，会退回 `model_config` 里的配置**——本地没有 `/run/secrets` 时你会看到一行 `directory "/run/secrets" does not exist` 的 warning。这正是官方文档说的「目录不存在只警告、不报错」。嫌吵就把 `secrets_dir` 从 `model_config` 挪到部署环境里给，或在 CI 中真正挂载该目录。

## 常见坑

**1. 复杂字段收到 `SettingsError` 而不是 `ValidationError`。** 报错来自「解码失败」这一层，字段根本没进校验。看到 `error parsing value for field ... from source "EnvSettingsSource"` 就先去查值是不是合法 JSON，别在 validator 里找原因。

**2. 子模型写成了 `BaseSettings` 或 dataclass。** 嵌套分隔符要求子模型继承 `pydantic.BaseModel`。写成别的，会出现「父 settings 能构造、子字段全是默认值」这种最难查的症状。

**3. `env_nested_delimiter='_'` 撞上字段名里的下划线。** `LLM_API_KEY` 被拆成 `llm.api.key`。要么把分隔符换成不常出现在字段名里的 `__`，要么设 `env_nested_max_split=1`。

**4. 从子目录启动，`.env` 静默失效。** 相对文件名只在当前工作目录找。用 `Path(__file__).resolve().parent / ".env"` 生成绝对路径，或用 `env_file_depth`。

**5. 以为 `.env` 能覆盖真实环境变量。** 方向恰好相反：环境变量永远赢。CI 里 `env:` 段设的值会盖过仓库里那份 `.env`，本地却看不到，非常容易被误判成「配置没生效」。

**6. `extra` 保持默认 `forbid`，于是 `.env` 里一行注释掉的旧键让服务起不来。** 严格性是把双刃剑：新服务建议 `extra="ignore"` + `dotenv_filtering="match_prefix"`，把「严格」留给字段声明而不是键名匹配。

**7. 用 `str` 存 Key 并打印了 `Settings()`。** 明文 Key 会进日志。改用 `SecretStr` 并对不需要 repr 的字段加 `Field(repr=False)`；写日志前统一走一个脱敏函数。这一条与《日志 logging：HOWTO 与 logging.config》里的过滤器可以配合使用。

**8. 在模块顶层 `settings = Settings()`。** 好处是启动即失败，坏处是导入这个模块（包括跑测试、生成 OpenAPI schema）时就会读环境、就可能抛异常。折中做法：模块级只定义类，入口处调用一个带 `lru_cache()` 的 `get_settings()`，测试里再直接构造实例。

**9. 依赖注入时用 `Settings` 而不是它的字段。** FastAPI 里 `Depends(get_settings)` 会让每个请求都重新读一次文件；把 `@lru_cache` 加在工厂函数上是必须的，不是可选优化。

**10. 以为 `case_sensitive=True` 在 Windows 上也对环境变量生效。** 不会（原因见前文）。跨平台项目请显式用 alias 命名，不要靠大小写区分两个配置项。

**11. 把 `env_prefix` 同时当成 dotenv 的前缀过滤器。** 前缀只影响**查找键名**，不影响**读哪些行**：不带前缀的 dotenv 行照样会被送进模型，进而因 `extra='forbid'` 报错。真要按前缀裁剪，用 `dotenv_filtering`。

## 延伸阅读

- 官方概念页《Pydantic Settings》：https://docs.pydantic.dev/latest/concepts/pydantic_settings/
- 仓库与 README（含 `SettingsConfigDict` 全部字段与变更历史）：https://github.com/pydantic/pydantic-settings
- API 参考 `pydantic_settings.SettingsConfigDict` / `SettingsError`：https://docs.pydantic.dev/latest/api/pydantic_settings/
- python-dotenv（`.env` 语法与解析规则的实现者）：https://github.com/theskumar/python-dotenv
- 本站相关：《环境与依赖管理》（环境与依赖的地基）、《环境变量与 API Key 管理（.env 与 python-dotenv）》（`.env` 基础与 Key 摆放）、《Pydantic 模型（Models）：数据校验的核心》（校验与转换规则本体）、《Pydantic 校验器与字段约束》（本文里 `NoDecode` + `BeforeValidator`、`field_validator` 的完整机制）、《uv 脚本与 PEP 723 内联依赖》（把配置脚本变成可复现的单文件工具）

> **来源**：抓取于 2026-09-19。译自/引自 [pydantic-settings 官方文档](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)（Samuel Colvin 与 Pydantic 社区，MIT 许可证）以及仓库 [README](https://github.com/pydantic/pydantic-settings/blob/main/LICENSE)（LICENSE 已核对为 MIT，Copyright (c) 2022 Samuel Colvin and other contributors）。文中 `CommaList`、`ServerConfig`、`load_settings` 与 `.env` 示例为编者按上述文档组织的综合示例；Windows 环境变量大小写、`dotenv_filtering`、`env_file_depth`、`env_nested_max_split` 等行为均取自该文档对应小节。
