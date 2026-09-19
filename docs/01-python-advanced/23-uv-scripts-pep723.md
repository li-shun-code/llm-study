---
title: uv 脚本与 PEP 723 内联依赖
source_url: https://docs.astral.sh/uv/guides/scripts/
author: Astral（uv 文档团队）与 Python 打包规范社区（PEP 723）
license: MIT OR Apache-2.0 双许可（uv 文档）；CC0 / 公有领域（PEP 723）
fetched_at: 2026-09-19
translated: true
versions: uv 当前稳定版；PEP 723（Final，2024-01 定稿）
order: 23
group: 工程化与交付
---

## 为什么需要：单文件脚本的依赖困境

做 LLM 相关工作的人，手边总有一堆「就一个文件」的脚本：把一批 PDF 里的字段抽出来、给某个数据集跑一遍打分、临时调一次模型接口做对比、把线上日志里的 prompt 抓下来统计长度。这类脚本有个共同特征——**它不值得成为一个项目**。它没有包结构、没有测试、没有发布需求，可能三天后就被删掉。

但只要有依赖，它就开始疼。经典路线大概有三条，每条都有代价：

第一条，装进全局环境。`pip install openai` 一敲，系统 Python 或者某个不相关的虚拟环境里就多了一堆包。全局环境是你机器上所有「临时装一下」的最终坟场，装多了没人敢升级，也没人敢删。第二条，为脚本建虚拟环境。`python -m venv .venv && source .venv/bin/activate && pip install ...`，四行开头注释写在脚本最上面，然后你三个月后回来，已经不清楚这个环境还在不在、装的是哪些包、什么版本。第三条，写进某个项目的 `requirements.txt`，于是这个一次性脚本 permanently 绑上了那个项目的依赖树，两者互相拖累。

问题的根源不是「麻烦」，而是**依赖信息放错了地方**。脚本需要 `httpx`，这件事是脚本自身的属性，却记录在了脚本之外的一张便签上——便签会丢。

PEP 723 解决的就是这个错位。它定义了一种标准格式，让脚本把「我要哪些包、我要哪个 Python 版本」写在**自己文件头的特殊注释块**里。既然是注释，Python 解释器完全无视它，`python script.py` 照常能跑；但工具（uv、Hatch、pip-run 等）会读它，并据此自动创建、缓存、隔离运行环境。uv 把这套机制做成了默认工作流，于是上面的三条路线全部塌缩成一条：

```console
$ uv run extract_fields.py
```

命令里没有 `pip`，没有 `venv`，没有 `activate`。环境是 uv 按脚本头部声明现场建、并缓存复用的。

还有一个更隐蔽的收益：**可分享性**。以前你把脚本发给同事，得附一句「记得先 `pip install openai>=1.40` 和 `tenacity`」，同事的机器上多半还少一个。现在脚本自身带着依赖声明，`uv run` 一条命令跑通；写清楚版本区间的，还能保证你们跑的是同一套依赖。

> 前置阅读：本站《环境与依赖管理》已经把「解释器在哪、包装到哪、怎么声明依赖」这套地基讲清了，里面也给了 `uvx` 与内联元数据的最小示例。本文不再重复虚拟环境概念，直接把 PEP 723 这条路线讲透，并补上《uv 项目管理：从 uv init 到构建发布（含工程化概念）》覆盖不到的脚本侧能力——锁文件、可复现性、以及 CI 里怎么用。

## 概念：一块 TOML 注释，和围绕它的三件工具

### 内联元数据块的形状

PEP 723 规定的格式是一段以 `# /// script` 开始、以 `# ///` 结束的注释，中间是 **TOML** 内容。uv 认这些键：

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "requests<3",
#   "rich",
# ]
# ///
```

关键点：

- **`dependencies` 是 PEP 508 依赖字符串列表**，和 `pyproject.toml` 里 `[project] dependencies` 的写法一模一样，可以带版本区间、extras、marker（例如 `numpy>=2.0; python_version >= "3.10"`）。
- **`requires-python` 决定用哪个解释器**。uv 找不到本机的匹配版本时会自己下载一个受管 Python，不需要你手动装。
- **`dependencies` 字段必须存在，即使为空**。这是 uv 文档明确写的要求——只声明 `requires-python` 而漏掉 `dependencies = []`，脚本会报错。
- **每一行都必须以 `#` 开头**。这是注释块的本意：Python 与 `python script.py` 都把它当普通注释。
- **`[tool.uv]` 段可以放在同一个块里**，用来写 uv 专属设置，比如下一节会讲到的 `exclude-newer`。这一段不是 PEP 723 的标准内容，而是 uv 的扩展，用别的工具跑时会被忽略。

用 `uv init --script` 可以让 uv 帮你生成这个头，省掉手写格式的错误：

```console
$ uv init --script extract_fields.py --python 3.12
```

增删依赖也不必手改注释，`uv add --script` 会替你写进去、并顺手解析一遍：

```console
$ uv add --script extract_fields.py 'requests<3' 'rich'
```

如果要用私有索引（公司内网的 PyPI 镜像），加 `--index`，它会把索引信息一并落到元数据里：

```console
$ uv add --index "https://nexus.example.com/simple" --script extract_fields.py 'requests<3'
```

写入的内容长这样，仍是注释块的一部分：

```python
# [[tool.uv.index]]
# url = "https://nexus.example.com/simple"
```

### `uv run`：脚本的执行入口

`uv run` 的原始定位是「在项目里跑命令」，但它在脚本场景下的行为差异很值得单独记：

- 脚本**无依赖**（或只依赖标准库）时，`uv run script.py` 直接跑，不需要任何声明。
- 脚本**有依赖但不想写元数据**时，用 `--with` 在命令行临时挂：`uv run --with rich script.py`，可以重复多次；也能加约束 `uv run --with 'rich>12,<13' script.py`。
- 脚本**带 PEP 723 元数据**时，`uv run` 会按元数据建环境。文档特别强调：**这种情况下即使在项目目录里，项目的依赖也会被忽略**，不需要 `--no-project`。
- 反过来，脚本**没有元数据而你恰好在某个项目目录里**跑 `uv run`，uv 会先把当前项目装一遍再执行——这通常不是你想要的。这时才需要 `--no-project`，而且这个标志**必须写在脚本名之前**。
- 临时换解释器：`uv run --python 3.10 script.py`。
- 不想落盘，从 stdin 读代码就跑：`echo 'print("hello")' | uv run -`，或用 here-document。

参数传递很直白，脚本名之后的东西都归脚本自己：`uv run script.py hello world!`，`sys.argv[1:]` 就是 `['hello', 'world!']`。

`--with` 适合「试一下」，元数据适合「要复用」。判据很简单：**这个脚本会不会被第二个人、第二次运行**。会，就把依赖写进文件头。

### `uvx`：不装工具，直接跑

`uvx` 是 `uv tool run` 的别名，用来跑「以包形式发布的命令行工具」。它把工具装进一个临时的隔离环境里执行，装完不污染任何环境，也 import 不到它的模块——这正是工具该有的形态。

```console
$ uvx ruff check .                     # 跑 ruff
$ uvx --from httpie http GET example.com   # 命令名和包名不一致时用 --from
$ uvx ruff@0.3.0 check                 # 钉死某个精确版本
$ uvx ruff@latest check                # 强制最新
$ uvx --from 'mypy[faster-cache,reports]' mypy --xml-report m.xml .   # 带 extras
$ uvx --with mkdocs-material mkdocs serve  # 给工具追加插件依赖
$ uvx --from git+https://github.com/httpie/cli@3.2.4 httpie   # 直接从 Git 拉
```

用 `--from` 时可以写完整的 PEP 508 约束（`'ruff==0.3.0'`、`'ruff>0.2.0,<0.3.0'`），而 `命令@版本` 这种简写**只支持精确版本**，不能写区间。

工具用得很频繁时，就别每次 `uvx` 了，`uv tool install` 把它装进一个持久隔离环境并放进 `PATH`：

```console
$ uv tool install ruff
$ ruff --version                       # 之后直接敲 ruff，不经过 uv
$ uv tool upgrade ruff                 # 在你安装时给的约束范围内升级
$ uv tool upgrade --all
```

一个容易踩的认知差：`uv tool install` **不会**让包变成可 import 的模块，`python -c "import ruff"` 会失败。这是有意的隔离设计，避免工具依赖和项目依赖互相干涉。

还有一条边界值得记住：在**项目里**跑那些「需要你的项目已被安装」的工具（`pytest`、`mypy`），要用 `uv run pytest` 而不是 `uvx pytest`——后者会在一个与你项目隔离的环境里执行，import 不到你的代码。项目是扁平结构（没有 `src/`）时 `uvx` 勉强能用，但 `uv run` 才是把工具版本钉进项目依赖的正确位置。

### 锁文件与可复现性

`uv.lock` 不只是项目的专利，脚本也可以锁：

```console
$ uv lock --script extract_fields.py
```

注意两点差异：**脚本必须显式加 `--script`，不会像项目那样自动锁**；产出的文件名是紧邻脚本的 `extract_fields.py.lock`（而不是 `uv.lock`）。

锁好之后，`uv run --script`、`uv add --script`、`uv export --script`、`uv tree --script` 都会复用锁文件里的解析结果，只在需要时更新锁。若锁文件不存在，这些命令照样能工作，只是不会顺手帮你生成锁。

uv 还在标准之上加了一个可复现性开关：`exclude-newer`，限制 uv 只考虑某个时间点之前发布的发行版。这样一年后重跑脚本，不会因为某个依赖偷偷发了新版而行为漂移。值要用 RFC 3339 时间戳：

```python
# /// script
# dependencies = [
#   "requests",
# ]
# [tool.uv]
# exclude-newer = "2023-10-16T00:00:00Z"
# ///

import requests

print(requests.__version__)
```

对做实验、复现别人的结果、或者要给报告附代码的场景，这一行比锁文件更省事——你不需要提交额外文件，时间戳就写在脚本里。

## 可运行代码

### 示例一：一个自包含的 LLM 批量抽取脚本

下面这个脚本可以直接存成 `batch_extract.py` 跑通（前提：环境变量里配好 `OPENAI_API_KEY` 与可选的 `OPENAI_BASE_URL`，Key 的放法见《环境变量与 API Key 管理（.env 与 python-dotenv）》，这里绝不硬编码）。它演示了元数据块、`requires-python`、命令行参数，以及与《HTTPX 实战：异步客户端、流式响应与重试》里那套超时纪律的配合。

```python
# /// script
# requires-python = ">=3.12"
# dependencies = [
#   "openai>=1.40,<3",
#   "tenacity>=9,<10",
#   "rich>=13,<15",
# ]
# ///
"""从若干段文本里抽取「公司名 + 金额」，输出成 JSONL。

运行方式：uv run batch_extract.py input.txt
依赖由文件头的 PEP 723 元数据声明，不需要事先 pip install 任何东西。
"""

import json
import os
import sys
from pathlib import Path

import openai
from openai import OpenAI
from rich.progress import track
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_random_exponential,
)

# 用 type 语句（3.12+ 语法），呼应上面 requires-python 的下界
type Record = dict[str, str | int | float | None]

SYSTEM_PROMPT = (
    "你是财务信息抽取器。只输出 JSON 对象，字段固定为 "
    "company(string)、amount(number|None)、currency(string) 。"
)


def build_client() -> OpenAI:
    """客户端不写 Key：一律从环境变量读，缺失时给出明确错误。"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("缺少 OPENAI_API_KEY，请先在环境里配置（不要写进代码）")
    return OpenAI(api_key=api_key, base_url=os.getenv("OPENAI_BASE_URL"))


@retry(
    # 只重试「再试可能成功」的错误：限流、超时、连接失败
    retry=retry_if_exception_type(
        (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError)
    ),
    stop=stop_after_attempt(4),
    wait=wait_random_exponential(multiplier=1, max=20),  # 指数退避 + 抖动
    reraise=True,  # 用尽后抛原始异常，而不是 RetryError
)
def extract_one(client: OpenAI, text: str) -> Record:
    resp = client.chat.completions.create(
        model="gpt-5.6-sol",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        temperature=0,  # 抽取类任务要确定性
    )
    raw = resp.choices[0].message.content or "{}"
    return json.loads(raw)


def main() -> int:
    if len(sys.argv) < 2:
        print("用法: uv run batch_extract.py <输入文件>", file=sys.stderr)
        return 2

    # 输入按空行切成独立片段
    chunks = [c.strip() for c in Path(sys.argv[1]).read_text("utf-8").split("\n\n") if c.strip()]
    client = build_client()
    out = Path("result.jsonl")

    with out.open("w", encoding="utf-8") as fh:
        for chunk in track(chunks, description="抽取中"):
            try:
                rec = extract_one(client, chunk)
            except json.JSONDecodeError:
                # 模型没给合法 JSON：记录原始文本，不整批失败
                rec = {"company": None, "amount": None, "currency": None, "raw": chunk[:200]}
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"完成，结果写入 {out}（共 {len(chunks)} 条）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

跑起来：

```console
$ uv run batch_extract.py input.txt        # 首次运行会解析依赖并建环境，之后走缓存
$ uv lock --script batch_extract.py        # 需要可复现时，把解析结果钉住
$ uv tree --script batch_extract.py        # 看这个脚本的依赖树
```

上面重试白名单里刻意没放 `openai.BadRequestError` 这类 4xx：请求本身有问题时，重试一万次也不会成功。这套「只重试有救的错误」的判断标准和《HTTPX 实战：异步客户端、流式响应与重试》里对 httpx 异常体系的筛选逻辑是同一回事。

### 示例二：可执行脚本（shebang）

脚本头加上 shebang，就能像 shell 脚本那样直接执行，不再写 `uv run`。uv 官方给的写法要注意 `-S`（让 `env` 把后面的参数拆开传给 uv）：

```python
#!/usr/bin/env -S uv run --script
#
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx"]
# ///

import httpx

resp = httpx.get("https://example.com", timeout=10)
print(resp.status_code, len(resp.text))
```

```console
$ chmod +x greet
$ ./greet
```

`--script` 这个标志的作用就是告诉 `uv run`：按 PEP 723 元数据建环境，别去管当前目录有没有项目。放进 `PATH` 的目录里的这类脚本，就成了「带依赖的自制命令」。Windows 上以 `.pyw` 结尾的脚本，uv 会自动改用 `pythonw` 执行，GUI 库（tkinter、PyQt）场景下不会闪出一个控制台窗口。

### 示例三：锁死依赖版本给同事复现

「你跑一下这个脚本，结果应该和我一样」——要让这句话成立，光有元数据不够，因为 `dependencies = ["httpx"]` 在下个月会解析出不同版本。三种强度递增的做法：

```console
$ # 做法 A：元数据里写死版本区间（最轻，够用就好）
$ uv add --script report.py 'httpx==0.27.2'

$ # 做法 B：生成锁文件，把 example.py.lock 和脚本一起提交
$ uv lock --script report.py
$ uv run --script report.py            # 复用锁；--locked 可校验锁是否最新

$ # 做法 C：排除某个日期之后的发行版（不需要额外文件，适合贴进邮件/报告）
```

做法 C 的元数据：

```python
# /// script
# dependencies = ["pandas", "matplotlib"]
# [tool.uv]
# exclude-newer = "2026-01-01T00:00:00Z"
# ///
```

### 示例四：CI 里跑脚本

脚本进了 CI，诉求从「方便」变成「不要每次都重新解析依赖，并且要能复现」。GitHub Actions 用官方的 `astral-sh/setup-uv`：

```yaml
name: nightly-eval
on:
  schedule:
    - cron: "30 2 * * *"

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # uv 与受管 Python 的安装，顺带缓存 uv 的下载目录
      - name: 装 uv
        uses: astral-sh/setup-uv@v10
        with:
          enable-cache: "auto"

      # 解释器版本由脚本里的 requires-python 决定，这里不用再指定
      - name: 跑评测脚本
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}   # Key 从仓库密钥来，不进代码
        run: |
          # --locked：锁文件和脚本不一致就直接失败，
          # 避免 CI 悄悄解析出一套本地没验证过的依赖
          uv run --locked --script evals/quality.py evals/samples.jsonl
```

要点三条：**用 `--locked` 而不是 `--frozen`**（前者校验锁文件与元数据一致、不一致就报错，后者是「不检查，直接用现成环境」，语义相反）；**Key 通过 `secrets` 注入环境变量**，脚本仍然只从 `os.environ` 读；**别在 CI 里用 `uvx` 跑那些需要读你代码的工具**，原因见上面 `uvx` 一节的边界。

如果 CI 只跑一次性小脚本、不想维护锁文件，把元数据里的区间收紧（`==`）并用 `exclude-newer` 兜住时间面，也是可行的轻量方案。

## 常见坑

**1. `# /// script` 少写一个 `#`，或结尾写成 `# ///` 之外的形式。** 元数据块整体是注释，Python 不会报错，uv 只会认为「这个脚本没声明依赖」，然后在 import 处抛 `ModuleNotFoundError`——错误信息离真正原因很远。写完用 `uv tree --script 名字.py` 确认 uv 真的读到依赖了。

**2. 在项目目录里跑无元数据脚本，结果被项目依赖污染。** 没写元数据、又恰好在有 `pyproject.toml` 的目录里，`uv run` 会先安装当前项目再执行。想要纯净环境就加 `--no-project`，而且这个标志**必须放在脚本名之前**（放在后面会被当成传给脚本的参数）。

**3. 只写 `requires-python` 忘了 `dependencies = []`。** uv 要求字段存在，空列表也要写，否则解析元数据失败。

**4. 用 `uv run script.py` 却没加 `--script`，期望锁文件生效。** 脚本的锁需要显式 `uv lock --script` 生成，且后续命令建议统一带 `--script`（`uv run --script`、`uv export --script`、`uv tree --script`），语义才明确。脚本锁的文件名是 `<脚本名>.lock`，不是 `uv.lock`，别把它和项目锁搞混。

**5. 把 `uvx` 当 `pipx` 用完后指望能 `import`。** 工具环境是隔离的，装完只能敲命令，不能当库用。要 import 就用 `uv add` 装进项目，或在脚本里 `uv run --with` / 写进元数据。

**6. shebang 写成 `#!/usr/bin/env uv`。** 少了 `-S`，`env` 会把 `run --script` 整串当成一个程序名去找。正确形式是 `#!/usr/bin/env -S uv run --script`。

**7. 在 Windows 上把工具脚本放 `PATH` 却只看到 `.exe`。** `uv tool` 也支持老的 setuptools 风格脚本（`.ps1`/`.cmd`/`.bat`），位于 `$(uv tool dir)\<tool-name>\Scripts`；`uvx` 会按这个顺序自动找后缀，不必手敲扩展名。

**8. 元数据里写 `dependencies = ["openai"]` 不加任何上界。** 上游一次大版本升级就能让脚本在明天挂掉。至少给主版本上界（`"openai>=1.40,<3"`）。要更稳就锁文件。

**9. `exclude-newer` 用了 `2026-01-01` 这种纯日期。** 规范要求 RFC 3339 时间戳（`2026-01-01T00:00:00Z`），写错形式容易被解析成意料之外的值。

**10. 用 `.env` 文件给脚本喂配置，然后困惑「为什么 CI 里读不到」。** PEP 723 管的是**依赖**，不管配置。配置要么读环境变量，要么用 `pydantic-settings` 那套收进类型——见《Pydantic Settings：把配置从 .env 收进类型》。

## 延伸阅读

- uv 官方《Running scripts》指南：https://docs.astral.sh/uv/guides/scripts/
- uv 官方《Using tools》指南：https://docs.astral.sh/uv/guides/tools/
- PEP 723 – Inline script metadata（规范原文，含解析规则的准确定义）：https://peps.python.org/pep-0723/
- PyPA《Inline script metadata》打包规范页：https://packaging.python.org/en/latest/specifications/inline-script-metadata/
- `astral-sh/setup-uv`（GitHub Action，含全部输入项与默认值）：https://github.com/astral-sh/setup-uv
- 本站相关：《环境与依赖管理》（解释器与虚拟环境地基）、《uv 项目管理：从 uv init 到构建发布（含工程化概念）》（`pyproject.toml` 路线）、《代码质量工具链：Ruff、mypy 与 pre-commit》（用 `uvx` 跑工具的实际场景）、《Docker 容器化：Python 语言指南》（容器里怎么装 uv）

> **来源**：抓取于 2026-09-19。译自/引自 [Running scripts](https://docs.astral.sh/uv/guides/scripts/)（Astral，uv 文档团队，MIT OR Apache-2.0 双许可）、[Using tools](https://docs.astral.sh/uv/guides/tools/)（Astral，同许可）、[PEP 723: Inline script metadata](https://peps.python.org/pep-0723/)（Ofek Lev 等著，公有领域 / CC0-1.0）与 [setup-uv README](https://github.com/astral-sh/setup-uv)（Astral，Apache-2.0）。uv 的许可已核对仓库根目录 `LICENSE-APACHE` 与 `LICENSE-MIT`，PEP 的许可已核对正文 Copyright 一节。CI 片段与「常见坑」为编者依据上述文档整理，`--locked`/`--frozen` 的语义差别引自 uv 文档《Synchronizing environments》一节；示例中的模型名与 API 参数按 2026-09 现行写法给出。
