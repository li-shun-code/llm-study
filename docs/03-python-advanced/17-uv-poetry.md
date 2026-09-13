---
title: uv / poetry：Python 工程化项目管理
source_url: https://docs.astral.sh/uv/guides/projects/
author: Astral 及 uv 贡献者
license: MIT OR Apache-2.0（双重许可）
fetched_at: 2026-09-13
translated: true
order: 17
versions: uv 当前稳定版 / poetry 2.x
---
## uv 是什么

uv 是一个用 Rust 编写的极速 Python 包与项目管理器，一个工具覆盖了 pip、pip-tools、pipx、poetry、pyenv、virtualenv 等工具的大部分场景，速度通常快一个数量级以上。

按官方 Features 页的划分，uv 的接口分为几大块，可独立或组合使用：

**Python 版本**——安装和管理 Python 本身：

- `uv python install`：安装 Python 版本；
- `uv python list` / `uv python find`：查看可用/已安装版本；
- `uv python pin`：把当前项目固定到某个 Python 版本；
- `uv python uninstall`：卸载 Python 版本。

**脚本**——执行独立的 Python 脚本（`example.py`）：`uv run` 运行脚本；`uv add --script` / `uv remove --script` 管理脚本内联依赖。

**项目**——管理基于 `pyproject.toml` 的 Python 项目：`uv init`、`uv add`、`uv remove`、`uv sync`、`uv lock`、`uv run`、`uv tree`、`uv build`、`uv publish`。

**工具**——运行和安装发布到包索引的工具（如 `ruff`）：`uvx`（即 `uv tool run`）在临时环境中运行工具；`uv tool install` 用户级安装工具。

## 安装 uv

官方安装方法（独立安装器）：

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

也可以从 PyPI 安装：`pip install uv` 或 `uv pip install uv`（用 pipx/uvx 安装则 `uvx uv` 体验）。安装后运行 `uv` 应看到帮助菜单，列出全部可用命令。

## 创建新项目

使用 `uv init` 命令创建新的 Python 项目：

```console
$ uv init hello-world
$ cd hello-world
```

也可以在工作目录中初始化项目：`mkdir hello-world && cd hello-world && uv init`。

uv 将创建以下文件和目录：

```
├── .git/
├── .gitignore
├── .python-version
├── pyproject.toml
├── README.md
└── src
    └── hello_world
        └── __init__.py
```

`pyproject.toml` 定义了一个 `hello-world` 入口，指向 `__init__.py` 中一个简单的 "Hello world" 程序。用 `uv run` 试试：

```console
$ uv run hello-world
Hello from hello-world!
```

## 项目结构

项目由几个协同工作的重要部分组成。除了 `uv init` 创建的文件外，uv 会在你第一次运行项目命令（即 `uv run`、`uv sync` 或 `uv lock`）时，在项目根目录创建虚拟环境和 `uv.lock` 文件。完整结构如下：

```
.
├── .git/
├── .venv/
│   ├── bin
│   ├── lib
│   └── pyvenv.cfg
├── .gitignore
├── .python-version
├── README.md
├── src
│   └── hello_world
│       └── __init__.py
├── pyproject.toml
└── uv.lock
```

各部分说明：

- **`pyproject.toml`**：包含项目元数据。你将用它指定依赖以及项目的详细信息（描述、许可等）。可以手动编辑，也可以用 `uv add` 和 `uv remove` 从终端管理：

  ```toml
  [project]
  name = "hello-world"
  version = "0.1.0"
  description = "Add your description here"
  readme = "README.md"
  authors = [
    { name = "ferris", email = "ferris@rust.com" }
  ]
  requires-python = ">=3.14"
  dependencies = []

  [project.scripts]
  hello-world = "hello_world:main"

  [build-system]
  requires = ["uv_build>=0.12.13,<0.13"]
  build-backend = "uv_build"
  ```

- **`.python-version`**：包含项目的默认 Python 版本，告诉 uv 创建虚拟环境时使用哪个 Python。
- **`.venv`**：项目的虚拟环境，一个与系统其余部分隔离的 Python 环境，uv 会把项目依赖安装在这里。
- **`uv.lock`**：**跨平台锁文件**，包含项目依赖的精确信息。`pyproject.toml` 声明宽泛的依赖要求，而锁文件包含环境中实际安装的精确解析版本。这个文件**应当提交到版本控制**，以保证跨机器的一致、可重现安装。`uv.lock` 是人类可读的 TOML 文件，但由 uv 管理并**不应手动编辑**。

## 管理依赖

使用 `uv add` 命令向 `pyproject.toml` 添加依赖。这同时会更新锁文件和项目环境：

```console
$ uv add requests

$ # 指定版本约束
$ uv add 'requests==2.31.0'

$ # 添加 git 依赖
$ uv add git+https://github.com/psf/requests
```

如果你正从 `requirements.txt` 迁移，可以用 `uv add -r` 把文件中的全部依赖添加进来：

```console
$ uv add -r requirements.txt -c constraints.txt
```

移除包用 `uv remove`：`uv remove requests`。升级包用 `uv lock` 加 `--upgrade-package` 标志——它会尝试把指定包更新到最新兼容版本，同时保持锁文件其余部分不变：

```console
$ uv lock --upgrade-package requests
```

## 运行命令

`uv run` 可用于在项目环境中运行任意脚本或命令。

**每次 `uv run` 调用之前，uv 都会验证锁文件是否与 `pyproject.toml` 同步、环境是否与锁文件同步**——无需人工干预即可保持项目同步。`uv run` 保证你的命令运行在具备所有必需依赖（且为锁定版本）的环境中：

```console
$ uv add flask
$ uv run -- flask run -p 3000
```

或者运行一个脚本：

```python
# example.py
# Require a project dependency
import flask

print("hello world")
```

```console
$ uv run example.py
```

也可以用 `uv sync` 手动更新环境，然后激活它再执行命令：

```console
$ uv sync
$ source .venv/bin/activate
$ flask run -p 3000
```

注意：不用 `uv run` 时，虚拟环境必须处于激活状态才能在项目中运行脚本和命令。虚拟环境的激活方式因 shell 和平台而异——这也正是 `uv run` 更省心的原因。

## 构建分发包

`uv build` 可用于为项目构建源码分发（sdist）和二进制分发（wheel）。默认构建当前目录的项目，并把构建产物放到 `dist/` 子目录：

```console
$ uv build
$ ls dist/
hello_world-0.1.0-py3-none-any.whl
hello_world-0.1.0.tar.gz
```

## poetry 对照（编者补充）

[poetry](https://python-poetry.org/) 是 uv 之前最流行的"项目 + 依赖 + 锁文件 + 构建"一体化工具，至今仍被大量项目使用，2024 年底发布的 2.x 支持了 PEP 621 标准的 `pyproject.toml` 格式。它的核心命令与 uv 高度对应：

| 任务 | uv | poetry |
| --- | --- | --- |
| 新建项目 | `uv init hello-world` | `poetry new hello-world` |
| 添加依赖 | `uv add requests` | `poetry add requests` |
| 安装全部依赖 | `uv sync` | `poetry install` |
| 在项目环境中运行 | `uv run python app.py` | `poetry run python app.py` |
| 升级锁文件 | `uv lock --upgrade` | `poetry update` |
| 构建分发包 | `uv build` | `poetry build` |

选型建议：

- **新项目用 uv**：速度极快、能管理 Python 版本本身、FastAPI 等主流项目文档已默认采用；锁文件 + `uv sync` 与 Docker 构建（本模块第 12 篇）组合是可重现部署的现代标准做法；
- **已有 poetry 项目**：`poetry install` / `poetry run` 工作流完全成熟，团队协作不必为了追新而迁移；
- 无论哪个工具，**核心思想一致**：`pyproject.toml` 声明意图、锁文件锁定现实、虚拟环境隔离执行——这套心智模型比工具本身更重要。

## 延伸阅读

- uv 官方概念文档：[Projects](https://docs.astral.sh/uv/concepts/projects/)、[Tools](https://docs.astral.sh/uv/concepts/tools/)、[Python versions](https://docs.astral.sh/uv/concepts/python-versions/)；
- uv Guides：[安装 Python](https://docs.astral.sh/uv/guides/install-python/)、[使用脚本](https://docs.astral.sh/uv/guides/scripts/)、[发布包](https://docs.astral.sh/uv/guides/package/)；
- poetry 官方文档：[python-poetry.org/docs](https://python-poetry.org/docs/)。

---

> **来源**：本文翻译自 [Working on projects — uv 文档](https://docs.astral.sh/uv/guides/projects/)，作者 Astral 及 uv 贡献者，许可 MIT OR Apache-2.0。抓取于 2026-09-13。

---

> 编者注：本篇主体为 uv 官方《Working on projects》指南的中文翻译，"uv 能做什么"一节节选自官方 [Features](https://docs.astral.sh/uv/getting-started/features/) 页；文末补充 poetry 对照。**2026 年的推荐顺序：新项目默认用 uv；维护已有 poetry 项目继续用 poetry，不必强行迁移。** FastAPI 官方文档的最新示例也已全面使用 `uv`（见本模块第 11 篇）。
