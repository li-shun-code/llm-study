---
title: uv 项目管理：从 uv init 到构建发布（含工程化概念）
source_url: https://docs.astral.sh/uv/guides/projects/
author: Astral
license: MIT OR Apache-2.0 双许可
fetched_at: 2026-09-13
translated: true
order: 21
versions: uv 当前稳定版
---

*编者导读：本篇由 uv 官方文档《[Working on projects 指南](https://docs.astral.sh/uv/guides/projects/)》与《[Concepts → Projects](https://docs.astral.sh/uv/concepts/projects/)》各页（项目结构与文件、创建项目、管理依赖、锁定与同步、构建发行版）完整翻译合并而成。poetry 的对应工作流（`poetry add`/`poetry lock`/`poetry build`）与 uv 高度同构，迁移成本低。*

# 项目指南（Working on projects）

uv 支持管理 Python 项目——项目把依赖定义在 `pyproject.toml` 文件里。

## 创建新项目

用 `uv init` 命令创建新的 Python 项目：

```
$ uv init hello-world
$ cd hello-world
```
也可以在工作目录中初始化项目：

```
$ mkdir hello-world
$ cd hello-world
$ uv init
```
uv 会创建以下文件和目录：

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
`pyproject.toml` 定义了一个 `hello-world` 入口，指向 `__init__.py` 中的简单 "Hello world" 程序。用 `uv run` 试试：

```
$ uv run hello-world
Hello from hello-world!
```
## 项目结构

项目由几个相互配合的重要部分组成，让 uv 能够管理你的项目。除了 `uv init` 创建的文件外，第一次运行项目命令（`uv run`、`uv sync` 或 `uv lock`）时，uv 还会在项目根目录创建虚拟环境和 `uv.lock` 文件。

完整列表形如：

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
### `pyproject.toml`

`pyproject.toml` 包含项目的元数据：

```
[project]
name = "hello-world"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
authors = [
  { name = "ferris", email = "ferris@example.org" }
]
requires-python = ">=3.14"
dependencies = []

[project.scripts]
hello-world = "hello_world:main"

[build-system]
requires = ["uv_build>=0.12.13,<0.13"]
build-backend = "uv_build"
```
你将用这个文件声明依赖，以及项目的描述、许可等信息。可以手工编辑它，也可以用 `uv add`、`uv remove` 等命令从终端管理项目。

> **提示**：`pyproject.toml` 格式的入门细节见官方 [pyproject.toml 指南](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)。

还可以在该文件的 `[tool.uv]` 小节配置 uv 的配置项。

### `.python-version`

`.python-version` 文件包含项目的默认 Python 版本。它告诉 uv 创建项目虚拟环境时使用哪个 Python 版本。

### `.venv`

`.venv` 目录包含项目的虚拟环境——一个与系统其余部分隔离的 Python 环境。uv 会把项目依赖安装在这里。详见官方"项目环境"文档。

### `uv.lock`

`uv.lock` 是跨平台锁文件，包含项目依赖的精确信息。与声明项目宽泛需求的 `pyproject.toml` 不同，锁文件包含项目环境中实际安装的精确解析版本。该文件应纳入版本控制，使各机器上的安装一致且可复现。

`uv.lock` 是人类可读的 TOML 文件，但由 uv 管理，不应手工编辑。

## 管理依赖

用 `uv add` 向 `pyproject.toml` 添加依赖。这会同时更新锁文件和项目环境：

```
$ uv add requests
```
还可以指定版本约束或替代来源：

```
$ # 指定版本约束
$ uv add 'requests==2.31.0'

$ # 添加 git 依赖
$ uv add git+https://github.com/psf/requests
```
如果从 `requirements.txt` 迁移，可用 `uv add` 的 `-r` 标志导入文件中的全部依赖：

```
$ # 从 requirements.txt 添加全部依赖。
$ uv add -r requirements.txt -c constraints.txt
```
移除包用 `uv remove`：

```
$ uv remove requests
```
升级包用 `uv lock` 加 `--upgrade-package` 标志：

```
$ uv lock --upgrade-package requests
```
`--upgrade-package` 会尝试把指定包更新到最新兼容版本，同时保持锁文件的其余部分不变。详见下文"管理依赖"一节。

## 查看版本

`uv version` 命令可读取包版本：

```
$ uv version
hello-world 0.7.0
```
不带包名，用 `--short`：

```
$ uv version --short
0.7.0
```
JSON 格式，用 `--output-format json`：

```
$ uv version --output-format json
{
    "package_name": "hello-world",
    "version": "0.7.0",
    "commit_info": null
}
```
## 运行命令

`uv run` 可在项目环境中运行任意脚本或命令。

每次调用 `uv run` 之前，uv 会校验锁文件与 `pyproject.toml` 是否同步、环境与锁文件是否同步，无需人工干预即可保持项目同步。`uv run` 保证你的命令运行在"所有必需依赖都处于锁定版本"的环境中。

> **注**：`uv run` 默认不会从环境中移除多余包（锁文件中没有的包），详见下文"多余包的处理"。

例如使用 `flask`：

```
$ uv add flask
$ uv run -- flask run -p 3000
```
或运行脚本：

```
# Require a project dependency
import flask

print("hello world")
```
```
$ uv run example.py
```
也可以用 `uv sync` 手动更新环境，然后激活环境再执行命令（macOS/Linux）：

```
$ uv sync
$ source .venv/bin/activate
$ flask run -p 3000
$ python example.py
```
> **注**：不用 `uv run` 时，虚拟环境必须处于激活状态才能运行项目中的脚本和命令。激活方式因 shell 与平台而异。

## 构建发行版

`uv build` 可为项目构建源码发行版（sdist）与二进制发行版（wheel）。默认构建当前目录的项目，产物放在 `dist/` 子目录：

```
$ uv build
$ ls dist/
hello_world-0.1.0-py3-none-any.whl
hello_world-0.1.0.tar.gz
```
# 工程化概念（Concepts → Projects）

## 项目（Projects）

项目帮助你管理跨越多个文件的 Python 代码。想了解用 uv 创建项目的入门介绍，先读上文的项目指南。深入了解各主题：

- 理解项目结构与文件（下文"项目结构与文件"）
- 创建新项目（下文"创建项目"）
- 管理项目依赖（下文"管理依赖"）
- 在项目中运行命令与脚本（`uv run`）
- 使用锁文件并同步环境（下文"锁定与同步"）
- 构建发行版以发布项目（下文"构建发行版"）
- 导出锁文件到不同格式
- 使用工作区（workspaces）同时处理多个项目

## 项目结构与文件（Project structure and files）

### `pyproject.toml`

Python 项目元数据定义在 `pyproject.toml` 文件中。uv 需要该文件来识别项目的根目录。最小项目定义包含名称与版本：

```
[project]
name = "example"
version = "0.1.0"
```
其他元数据与配置包括：Python 版本要求、依赖、构建系统、入口点（命令）等。

### 项目环境

用 uv 处理项目时，uv 会按需创建虚拟环境。某些 uv 命令会创建临时环境（如 `uv run --isolated`），uv 同时也在 `pyproject.toml` 旁的 `.venv` 目录中管理一个持久环境，内含项目及其依赖。默认存放在项目内以便编辑器找到它——编辑器需要该环境来提供代码补全与类型提示。不建议把 `.venv` 纳入版本控制；uv 通过内置 `.gitignore` 自动把它从 `git` 排除。

要在项目环境中运行命令，用 `uv run`；也可以像普通虚拟环境那样激活项目环境。

调用 `uv run` 时，若项目环境不存在则创建，存在则确保其最新。也可以用 `uv sync` 显式创建。

_不_建议手工修改项目环境（如用 `uv pip install`）。项目依赖请用 `uv add`；一次性需求用 `uvx` 或 `uv run --with`。

> **提示**：如果不想让 uv 管理项目环境，设置 `managed = false` 关闭项目的自动锁定与同步：
>
> ```
> [tool.uv]
> managed = false
> ```
**集中式项目环境**（预览特性）：启用 `centralized-project-envs` 后，uv 把默认项目环境存入其缓存，并尝试维护指向缓存环境的 `.venv` 目录链接，使现有的激活与编辑器工作流继续走常规路径。切换解释器会选择各自独立的缓存环境并可在以后复用。显式指定路径（`UV_PROJECT_ENVIRONMENT`、`--active`）的环境不会被集中化；启用 `--no-cache` 时该特性无效。

### 锁文件（The lockfile）

uv 会在 `pyproject.toml` 旁创建 `uv.lock` 文件。

`uv.lock` 是_通用_（universal）或_跨平台_（cross-platform）锁文件，记录在所有可能的 Python 标记（操作系统、架构、Python 版本）下会安装的包。

与声明项目宽泛需求的 `pyproject.toml` 不同，锁文件包含项目环境中安装的精确解析版本。该文件应纳入版本控制，让各机器安装一致、可复现。

锁文件确保开发者使用一致的包版本集合；也确保把项目作为应用部署时，所用包版本的精确集合是已知的。

锁文件在使用项目环境的 uv 调用（`uv sync`、`uv run`）期间自动创建与更新；也可以用 `uv lock` 显式更新。

`uv.lock` 是人类可读的 TOML 文件，但由 uv 管理、不应手工编辑；其格式为 uv 专属，其他工具不可用。

**与 `pylock.toml` 的关系**：[PEP 751](https://peps.python.org/pep-0751/) 为 Python 标准化了新的解析文件格式 `pylock.toml`。它是一种解析输出格式，意在取代 `requirements.txt`（如 `uv pip compile` 场景）。`pylock.toml` 标准化且工具无关——将来 uv 生成的 `pylock.toml` 可被其他工具安装，反之亦然。uv 的部分功能无法用 `pylock.toml` 表达，因此 uv 在项目接口内继续使用 `uv.lock`。不过 uv 支持把 `pylock.toml` 作为导出目标并在 `uv pip` CLI 中使用：

- 把 `uv.lock` 导出为 `pylock.toml`：`uv export -o pylock.toml`
- 从一组需求生成 `pylock.toml`：`uv pip compile requirements.in -o pylock.toml`
- 从 `pylock.toml` 安装：`uv pip sync pylock.toml` 或 `uv pip install -r pylock.toml`

## 创建项目（Creating projects）

uv 支持 `uv init` 创建项目。创建项目时支持两种基本模板：**应用**与**库**。默认创建应用项目；用 `--lib` 标志创建库项目。

两种情况下，uv 都倾向于定义构建系统并把源码放在专门的 `src/<project_name>/` 目录。定义构建系统可使用各类 Python 打包特性（如命令行入口点），并避免 Python 导入系统的常见困惑。可用 `--no-package` 或 `--bare` 禁用构建系统。

> **注**：v0.12 之前，uv 默认不帮应用定义构建系统。

**目标目录**：uv 在工作目录创建项目，或提供名称在目标目录创建（如 `uv init foo`）。可用 `--directory` 修改工作目录。目标目录已有项目（存在 `pyproject.toml`）时，uv 会报错退出。

### 应用（Applications）

应用项目适合 Web 服务器、脚本和命令行界面。应用是 `uv init` 的默认目标，也可用 `--app` 标志显式指定：

```
$ uv init example-app
```
源码位于 `src` 目录，内含模块目录与 `__init__.py`：

```
example-app/
├── .python-version
├── README.md
├── pyproject.toml
└── src
    └── example_app
        └── __init__.py
```
定义了构建系统，项目会被安装进环境：

```
[project]
name = "example-app"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.11"
dependencies = []

[project.scripts]
example-app = "example_app:main"

[build-system]
requires = ["uv_build>=0.12.13,<0.13"]
build-backend = "uv_build"
```
> **提示**：`--build-backend` 选项可要求替代构建系统。

还包含一个命令定义（`[project.scripts]` 的 `example-app = "example_app:main"`）。可用 `uv run` 执行该命令：

```
$ cd example-app
$ uv run example-app
Hello from example-app!
```
### 库（Libraries）

库为其他项目提供函数与对象，用于构建和分发（如上传到 PyPI）。用 `--lib` 标志创建：

```
$ uv init --lib example-lib
```
> **注**：库始终要求项目被打包（packaged）。

会包含 `py.typed` 标记，向使用者表明库提供类型信息：

```
example-lib/
├── .python-version
├── README.md
├── pyproject.toml
└── src
    └── example_lib
        ├── py.typed
        └── __init__.py
```
> **注**：开发库时 `src` 布局特别有价值：它确保库与项目根目录中的任何 `python` 调用隔离，且分发的库代码与项目其余源码良好分离。

同样定义了构建系统（`uv_build`）。可用 `--build-backend` 选择其他构建后端模板：`hatchling`、`uv_build`、`flit-core`、`pdm-backend`、`setuptools`、`maturin`、`scikit-build-core`。要创建带扩展模块的库需要替代后端。

创建的模块定义一个简单 API 函数：

```
def hello() -> str:
    return "Hello from example-lib!"
```
可以用 `uv run` 导入并执行：

```
$ cd example-lib
$ uv run python -c "import example_lib; print(example_lib.hello())"
Hello from example-lib!
```
### 带扩展模块的项目

多数 Python 项目是"纯 Python"，即不定义 C、C++、FORTRAN 或 Rust 等语言编写的模块；但性能敏感代码常用扩展模块。创建带扩展模块的项目需要选择替代构建系统，uv 支持以下支持构建扩展模块的构建系统：

- [`maturin`](https://www.maturin.rs)：用于 Rust 项目
- [`scikit-build-core`](https://github.com/scikit-build/scikit-build-core)：用于 C、C++、FORTRAN、Cython 项目

用 `--build-backend` 指定：

```
$ uv init --build-backend maturin example-ext
```
> **注**：使用 `--build-backend` 隐含 `--package`。

项目在常规 Python 文件之外还包含 `Cargo.toml` 与 `lib.rs`（scikit-build-core 则是 CMake 配置与 `main.cpp`）：

```
example-ext/
├── .python-version
├── Cargo.toml
├── README.md
├── pyproject.toml
└── src
    ├── lib.rs
    └── example_ext
        ├── __init__.py
        └── _core.pyi
```
Rust 库定义简单函数：

```
use pyo3::prelude::*;

#[pymodule]
mod _core {
    use pyo3::prelude::*;

    #[pyfunction]
    fn hello_from_bin() -> String {
        "Hello from example-ext!".to_string()
    }
}
```
Python 模块导入它：

```
from example_ext._core import hello_from_bin


def main() -> None:
    print(hello_from_bin())
```
用 `uv run` 执行命令：

```
$ cd example-ext
$ uv run example-ext
Hello from example-ext!
```
> **重要**：用 maturin 或 scikit-build-core 创建项目时，uv 会配置 `tool.uv.cache-keys` 包含常见源码类型。要强制重建（例如改动了 `cache-keys` 之外的文件、或未使用 `cache-keys`），用 `--reinstall`。

### 创建不带构建系统的项目

虽然定义构建系统通常体验更好，但有些情况下省略它、把 Python 模块直接放在顶层目录更简单。用 `--no-package` 禁用构建系统：

```
$ uv init --no-package example-app
```
项目包含 `pyproject.toml`、示例文件（`main.py`）、readme 和 Python 版本固定文件（`.python-version`）。`pyproject.toml` 只含基本元数据：没有构建系统、不是包、不会被安装进环境：

```
[project]
name = "example-app"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.11"
dependencies = []
```
示例文件定义了带标准样板的 `main` 函数：

```
def main():
    print("Hello from example-app!")


if __name__ == "__main__":
    main()
```
用 `uv run` 执行 Python 文件：

```
$ cd example-app
$ uv run main.py
Hello from example-app!
```
### 创建最小项目

只想创建一个 `pyproject.toml` 时，用 `--bare`：

```
$ uv init example-bare --bare
```
uv 会跳过创建 Python 版本固定文件、README、任何源码目录或文件，也不会初始化版本控制系统（即 `git`）：

```
example-bare
└── pyproject.toml
```
uv 也不会向 `pyproject.toml` 添加额外元数据（如 `description` 或 `authors`）：

```
[project]
name = "example-bare"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = []
```
`--bare` 可与其他选项（如 `--lib`、`--build-backend`）组合——此时 uv 仍会配置构建系统，但不创建预期的文件结构。使用 `--bare` 时，附加功能仍可按需启用：

```
$ uv init example-bare --bare --description "Hello world" --author-from git --vcs git --pin-python
```
## 管理依赖（Managing dependencies）

### 依赖字段

项目依赖定义在几个字段中：

- `project.dependencies`：发布用依赖。
- `project.optional-dependencies`：发布的可选依赖，即"extras"。
- `dependency-groups`：本地开发依赖。
- `tool.uv.sources`：开发期间的替代依赖来源。

> **注**：即使项目不打算发布，也可以使用 `project.dependencies` 与 `project.optional-dependencies` 字段。`dependency-groups` 是较新标准化的特性，可能尚未被所有工具支持。

uv 支持用 `uv add` 和 `uv remove` 修改项目依赖，也可以直接编辑 `pyproject.toml` 更新依赖元数据。

### 添加依赖

```
$ uv add httpx
```
`project.dependencies` 字段会加入条目：

```
[project]
name = "example"
version = "0.1.0"
dependencies = ["httpx>=0.27.2"]
```
`--dev`、`--group` 或 `--optional` 标志可把依赖添加到其他字段。依赖会带上约束（如 `>=0.27.2`，对应该包最新的兼容版本）。约束种类可用 `--bounds` 调整，或直接提供约束：

```
$ uv add "httpx>=0.20"
```
从包索引之外的来源添加依赖时，uv 会在 sources 字段加入条目。例如从 GitHub 添加 `httpx`：

```
$ uv add "httpx @ git+https://github.com/encode/httpx"
```
`pyproject.toml` 将包含一个 Git 来源条目：

```
[project]
name = "example"
version = "0.1.0"
dependencies = [
    "httpx",
]

[tool.uv.sources]
httpx = { git = "https://github.com/encode/httpx" }
```
如果依赖无法使用，uv 会显示错误：

```
$ uv add "httpx>9999"
  × No solution found when resolving dependencies:
  ╰─▶ Because only httpx<=1.0.0b0 is available and your project depends on httpx>9999,
      we can conclude that your project's requirements are unsatisfiable.
```
**从 requirements 文件导入依赖**：用 `-r` 选项把 `requirements.txt` 中声明的依赖加入项目：

```
uv add -r requirements.txt
```
### 移除依赖

```
$ uv remove httpx
```
`--dev`、`--group` 或 `--optional` 标志可从特定表中移除依赖。如果被移除的依赖定义了[来源](#依赖来源)且没有其他引用，来源条目也会被移除。

### 更改依赖

更改现有依赖（例如为 `httpx` 使用不同约束）：

```
$ uv add "httpx>0.1.0"
```
> **注**：本例修改的是 `pyproject.toml` 中依赖的约束。锁定版本只有在需要满足新约束时才会变化。要强制把包更新到约束内最新版本，用 `--upgrade-package <name>`：
>
> ```
> $ uv add "httpx>0.1.0" --upgrade-package httpx
> ```
请求不同的依赖来源会更新 `tool.uv.sources` 表，例如开发期间从本地路径使用 `httpx`：

```
$ uv add "httpx @ ../httpx"
```
### 平台特定依赖

要确保依赖只在特定平台或特定 Python 版本上安装，使用环境标记（environment markers）。例如只在 Linux 上安装 `jax`：

```
$ uv add "jax; sys_platform == 'linux'"
```
生成的 `pyproject.toml` 会在依赖定义中包含环境标记：

```
[project]
name = "project"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["jax; sys_platform == 'linux'"]
```
类似地，在 Python 3.11 及以上包含 `numpy`：

```
$ uv add "numpy; python_version >= '3.11'"
```
### 项目依赖（project.dependencies）

`project.dependencies` 表表示上传到 PyPI 或构建 wheel 时使用的依赖。各依赖以依赖说明符（dependency specifiers）语法指定，该表遵循 [PEP 621](https://packaging.python.org/en/latest/specifications/pyproject-toml/) 标准。

`project.dependencies` 定义项目所需的包列表及安装时的版本约束。每项包含依赖名与版本；条目可以带 extras 或平台特定的环境标记。例如：

```
[project]
name = "albatross"
version = "0.1.0"
dependencies = [
  # Any version in this range
  "tqdm >=4.66.2,<5",
  # Exactly this version of torch
  "torch ==2.2.2",
  # Install transformers with the torch extra
  "transformers[torch] >=4.39.3,<5",
  # Only install this package on older python versions
  # See "Environment Markers" for more information
  "importlib_metadata >=7.1.0,<8; python_version < '3.10'",
  "mollymawk ==0.1.0"
]
```
### 依赖来源（Dependency sources）

`tool.uv.sources` 表用替代依赖来源扩展标准依赖表，开发期间生效。

依赖来源为 `project.dependencies` 标准不支持的一些常见模式提供支持，例如可编辑安装与相对路径。例如从项目根目录的相对路径安装 `foo`：

```
[project]
name = "example"
version = "0.1.0"
dependencies = ["foo"]

[tool.uv.sources]
foo = { path = "./packages/foo" }
```
uv 支持以下依赖来源：

- [索引（Index）](#索引)：从特定包索引解析的包。
- [Git](#git)：Git 仓库。
- [URL](#url)：远程 wheel 或源码发行版。
- [路径（Path）](#路径)：本地 wheel、源码发行版或项目目录。
- [工作区成员（Workspace）](#工作区成员)：当前工作区的成员。

> **重要**：来源只有 uv 会尊重。使用其他工具时只会采用标准项目表中的定义；若开发时使用其他工具，需要把来源表中的元数据以该工具的格式重新声明。

**索引（Index）**：从特定索引添加包，用 `--index` 选项：

```
$ uv add torch --index pytorch=https://download.pytorch.org/whl/cpu
```
uv 会把索引存入 `[[tool.uv.index]]` 并添加 `[tool.uv.sources]` 条目：

```
[project]
dependencies = ["torch"]

[tool.uv.sources]
torch = { index = "pytorch" }

[[tool.uv.index]]
name = "pytorch"
url = "https://download.pytorch.org/whl/cpu"
```
索引已配置时可按名称选择（预览特性）：

```
$ uv add --preview-features index-by-name torch --index pytorch
```
> **提示**：受 PyTorch 索引的细节限制，上例只能在 x86-64 Linux 上工作。PyTorch 的配置见官方 PyTorch 集成指南。

使用 `index` 来源会把包_固定_（pin）到给定索引——不会从其他索引下载。定义索引时可加 `explicit` 标志，表示该索引_只_用于在 `tool.uv.sources` 中显式指定它的包；未设置 `explicit` 时，其他包若在别处找不到也可能从该索引解析：

```
[[tool.uv.index]]
name = "pytorch"
url = "https://download.pytorch.org/whl/cpu"
explicit = true
```
**Git**：添加 Git 依赖来源，在 Git 兼容 URL 前加 `git+` 前缀：

```
$ # 通过 HTTP(S) 安装。
$ uv add git+https://github.com/encode/httpx

$ # 通过 SSH 安装。
$ uv add git+ssh://git@github.com/encode/httpx
```
```
[project]
dependencies = ["httpx"]

[tool.uv.sources]
httpx = { git = "https://github.com/encode/httpx" }
```
可以请求特定的 Git 引用，例如标签：

```
$ uv add git+https://github.com/encode/httpx --tag 0.27.0
```
```
[project]
dependencies = ["httpx"]

[tool.uv.sources]
httpx = { git = "https://github.com/encode/httpx", tag = "0.27.0" }
```
或分支：

```
$ uv add git+https://github.com/encode/httpx --branch main
```
或修订（commit）：

```
$ uv add git+https://github.com/encode/httpx --rev 326b9431c761e1ef1e00b9f760d1f654c8db48c6
```
如果包不在仓库根目录，可以指定 `subdirectory`：

```
$ uv add git+https://github.com/langchain-ai/langchain#subdirectory=libs/langchain
```
```
[project]
dependencies = ["langchain"]

[tool.uv.sources]
langchain = { git = "https://github.com/langchain-ai/langchain", subdirectory = "libs/langchain" }
```
[Git LFS](https://git-lfs.com) 支持也可按来源配置，默认不获取 LFS 对象：

```
$ uv add --lfs git+https://github.com/astral-sh/lfs-cowsay
```
```
[project]
dependencies = ["lfs-cowsay"]

[tool.uv.sources]
lfs-cowsay = { git = "https://github.com/astral-sh/lfs-cowsay", lfs = true }
```
- `lfs = true`：uv 总是为该 Git 来源获取 LFS 对象。
- `lfs = false`：uv 从不为该 Git 来源获取 LFS 对象。
- 省略时：由 `UV_GIT_LFS` 环境变量决定所有未显式配置 `lfs` 的 Git 来源。

> **重要**：尝试安装使用 Git LFS 的来源前，确保系统已安装并配置 Git LFS，否则可能导致构建失败。

**URL**：添加 URL 来源时，提供指向 wheel（`.whl` 结尾）或源码发行版（通常 `.tar.gz` 或 `.zip`）的 `https://` URL：

```
$ uv add "https://files.pythonhosted.org/packages/5c/2d/3da5bdf4408b8b2800061c339f240c1802f2e82d55e50bd39c5a881f47f0/httpx-0.27.0.tar.gz"
```
得到的 `pyproject.toml`：

```
[project]
dependencies = ["httpx"]

[tool.uv.sources]
httpx = { url = "https://files.pythonhosted.org/packages/5c/2d/3da5bdf4408b8b2800061c339f240c1802f2e82d55e50bd39c5a881f47f0/httpx-0.27.0.tar.gz" }
```
URL 依赖也可以在 `pyproject.toml` 中用 `{ url = <url> }` 语法手工添加或编辑。源码发行版不在压缩包根目录时可以指定 `subdirectory`。

**路径（Path）**：添加路径来源时，提供 wheel（`.whl` 结尾）、源码发行版（通常 `.tar.gz` 或 `.zip`）或包含 `pyproject.toml` 的目录的路径：

```
$ uv add /example/foo-0.1.0-py3-none-any.whl
```
得到的 `pyproject.toml`：

```
[project]
dependencies = ["foo"]

[tool.uv.sources]
foo = { path = "/example/foo-0.1.0-py3-none-any.whl" }
```
路径也可以是相对路径：

```
$ uv add ./foo-0.1.0-py3-none-any.whl
```
或项目目录的路径：

```
$ uv add ~/projects/bar/
```
> **重要**：目录作为路径依赖时，uv 默认会尝试把目标作为包构建并安装，详见"虚拟依赖"。

路径依赖默认不使用[可编辑安装](#可编辑依赖)。项目目录可以请求可编辑安装：

```
$ uv add --editable ../projects/bar/
```
得到的 `pyproject.toml`：

```
[project]
dependencies = ["bar"]

[tool.uv.sources]
bar = { path = "../projects/bar", editable = true }
```
> **提示**：同一仓库中有多个包时，[_工作区_](https://docs.astral.sh/uv/concepts/projects/workspaces/)可能更合适。

**工作区成员（Workspace member）**：声明对工作区成员的依赖，添加成员名并设 `{ workspace = true }`。所有工作区成员必须显式声明。工作区成员始终是可编辑的。`workspace` 还可以是路径字符串，从另一个工作区取依赖：

```
[tool.uv.sources]
foo = { workspace = "../other-workspace" }
```
```
[project]
dependencies = ["foo==0.1.0"]

[tool.uv.sources]
foo = { workspace = true }

[tool.uv.workspace]
members = [
  "packages/foo"
]
```
**平台特定来源**：通过为来源提供与依赖说明符兼容的环境标记，可以把来源限制到给定平台或 Python 版本。例如只在 macOS 上从 GitHub 拉取 `httpx`：

```
[project]
dependencies = ["httpx"]

[tool.uv.sources]
httpx = { git = "https://github.com/encode/httpx", tag = "0.27.2", marker = "sys_platform == 'darwin'" }
```
在来源上指定标记后，uv 仍会在所有平台包含 `httpx`，但在 macOS 从 GitHub 下载来源，其余平台回退到 PyPI。

**多来源**：通过提供来源列表（用与 [PEP 508](https://peps.python.org/pep-0508/#environment-markers) 兼容的环境标记消歧），可以为单个依赖指定多个来源。例如 macOS 与 Linux 拉取不同的 `httpx` 标签：

```
[project]
dependencies = ["httpx"]

[tool.uv.sources]
httpx = [
  { git = "https://github.com/encode/httpx", tag = "0.27.2", marker = "sys_platform == 'darwin'" },
  { git = "https://github.com/encode/httpx", tag = "0.24.1", marker = "sys_platform == 'linux'" },
]
```
该策略也适用于按环境标记使用不同索引，例如按平台从不同 PyTorch 索引安装 `torch`：

```
[project]
dependencies = ["torch"]

[tool.uv.sources]
torch = [
  { index = "torch-cpu", marker = "platform_system == 'Darwin'"},
  { index = "torch-gpu", marker = "platform_system == 'Linux'"},
]

[[tool.uv.index]]
name = "torch-cpu"
url = "https://download.pytorch.org/whl/cpu"
explicit = true

[[tool.uv.index]]
name = "torch-gpu"
url = "https://download.pytorch.org/whl/cu130"
explicit = true
```
**禁用来源**：要让 uv 忽略 `tool.uv.sources` 表（例如模拟按包的发布元数据解析），用 `--no-sources` 标志：

```
$ uv lock --no-sources
```
使用 `--no-sources` 还会阻止 uv 发现可能满足给定依赖的工作区成员。

### 可选依赖（Optional dependencies）

以库形式发布的项目常把一些功能设为可选，以缩小默认依赖树。例如 Pandas 提供 `excel` extra 与 `plot` extra，避免在无人需要时安装 Excel 解析器与 `matplotlib`。extras 用 `package[<extra>]` 语法请求，如 `pandas[plot, excel]`。

可选依赖在 `[project.optional-dependencies]` 中指定——一个把 extra 名映射到其依赖的 TOML 表，遵循依赖说明符语法。可选依赖与普通依赖一样可以在 `tool.uv.sources` 中有条目：

```
[project]
name = "pandas"
version = "1.0.0"

[project.optional-dependencies]
plot = [
  "matplotlib>=3.6.3"
]
excel = [
  "odfpy>=1.4.1",
  "openpyxl>=3.1.0",
  "python-calamine>=0.1.7",
  "pyxlsb>=1.0.10",
  "xlrd>=2.0.1",
  "xlsxwriter>=3.0.5"
]
```
添加可选依赖用 `--optional <extra>` 选项：

```
$ uv add httpx --optional network
```
> **注**：如果可选依赖彼此冲突，除非显式[声明为冲突](https://docs.astral.sh/uv/concepts/projects/config/#conflicting-dependencies)，否则解析会失败。

来源也可以声明为只应用于某个可选依赖。例如根据可选 `cpu` 或 `gpu` extra 从不同 PyTorch 索引拉取 `torch`：

```
[project]
dependencies = []

[project.optional-dependencies]
cpu = [
  "torch",
]
gpu = [
  "torch",
]

[tool.uv.sources]
torch = [
  { index = "torch-cpu", extra = "cpu" },
  { index = "torch-gpu", extra = "gpu" },
]

[[tool.uv.index]]
name = "torch-cpu"
url = "https://download.pytorch.org/whl/cpu"

[[tool.uv.index]]
name = "torch-gpu"
url = "https://download.pytorch.org/whl/cu130"
```
### 开发依赖（Development dependencies）

与可选依赖不同，开发依赖只在本地使用，_不会_包含进发布到 PyPI 或其他索引的项目需求。因此开发依赖不出现在 `[project]` 表中；它们与普通依赖一样可以在 `tool.uv.sources` 中有条目。

添加开发依赖用 `--dev` 标志：

```
$ uv add --dev pytest
```
uv 使用 `[dependency-groups]` 表（[PEP 735](https://peps.python.org/pep-0735/) 定义）声明开发依赖。上面的命令会创建 `dev` 组：

```
[dependency-groups]
dev = [
  "pytest >=8.1.1,<9"
]
```
`dev` 组被特殊对待：有 `--dev`、`--only-dev`、`--no-dev` 标志切换其依赖的包含与排除；用 `--no-default-groups` 可禁用所有默认组。此外，`dev` 组默认被同步。

**依赖组**：开发依赖可用 `--group` 标志划分为多个组。例如在 `lint` 组添加开发依赖：

```
$ uv add --group lint ruff
```
得到如下 `[dependency-groups]` 定义：

```
[dependency-groups]
dev = [
  "pytest"
]
lint = [
  "ruff"
]
```
定义组之后，可用 `--all-groups`、`--no-default-groups`、`--group`、`--only-group`、`--no-group` 选项包含或排除其依赖。

> **提示**：`--dev`、`--only-dev`、`--no-dev` 分别等价于 `--group dev`、`--only-group dev`、`--no-group dev`。

uv 要求所有依赖组彼此兼容，并在创建锁文件时把所有组一起解析。如果一组声明的依赖与另一组不兼容，uv 会以错误告终，无法解析项目需求。

> **注**：如果依赖组彼此冲突，除非显式声明为冲突，否则解析会失败。

**嵌套组**：依赖组可以包含其他依赖组：

```
[dependency-groups]
dev = [
  {include-group = "lint"},
  {include-group = "test"}
]
lint = [
  "ruff"
]
test = [
  "pytest"
]
```
被包含组的依赖不能与组内声明的其他依赖冲突。

**默认组**：默认情况下，uv 会把 `dev` 依赖组包含进环境（如 `uv run` 或 `uv sync` 期间）。可用 `tool.uv.default-groups` 设置更改要包含的默认组：

```
[tool.uv]
default-groups = ["dev", "foo"]
```
要默认启用所有依赖组，用 `"all"` 代替组名列表：

```
[tool.uv]
default-groups = "all"
```
> **提示**：`uv run` 或 `uv sync` 期间想禁用该行为，用 `--no-default-groups`；要排除某个默认组，用 `--no-group <name>`。

**组的 `requires-python`**：默认要求依赖组与项目的 `requires-python` 范围兼容。如果某个依赖组需要与项目不同的 Python 版本范围，可以在 `[tool.uv.dependency-groups]` 中为该组指定 `requires-python`：

```
[project]
name = "example"
version = "0.0.0"
requires-python = ">=3.10"

[dependency-groups]
dev = ["pytest"]

[tool.uv.dependency-groups]
dev = {requires-python = ">=3.12"}
```
**遗留的 `dev-dependencies`**：在 `[dependency-groups]` 标准化之前，uv 用 `tool.uv.dev-dependencies` 字段指定开发依赖：

```
[tool.uv]
dev-dependencies = [
  "pytest"
]
```
该节声明的依赖会与 `dependency-groups.dev` 的内容合并。最终 `dev-dependencies` 字段会被弃用并移除。

> **注**：若存在 `tool.uv.dev-dependencies` 字段，`uv add --dev` 会使用既有小节而不是新增 `dependency-groups.dev`。

### 构建依赖（Build dependencies）

如果项目按 Python 包结构组织，它可以声明构建项目所需（而非运行所需）的依赖。这些依赖按 [PEP 518](https://peps.python.org/pep-0518/) 在 `[build-system]` 表的 `build-system.requires` 中指定。例如项目用 `setuptools` 作为构建后端，就应把 `setuptools` 声明为构建依赖：

```
[project]
name = "pandas"
version = "0.1.0"

[build-system]
requires = ["setuptools>=42"]
build-backend = "setuptools.build_meta"
```
默认情况下，uv 解析构建依赖时会尊重 `tool.uv.sources`。例如构建时用本地版 `setuptools`，把来源加到 `tool.uv.sources`：

```
[project]
name = "pandas"
version = "0.1.0"

[build-system]
requires = ["setuptools>=42"]
build-backend = "setuptools.build_meta"

[tool.uv.sources]
setuptools = { path = "./packages/setuptools" }
```
发布包时建议运行 `uv build --no-sources`，确保在 `tool.uv.sources` 被禁用时（如使用 [`pypa/build`](https://github.com/pypa/build) 等其他构建工具的情形）包也能正确构建。

### 可编辑依赖（Editable dependencies）

常规安装一个包含 Python 包的目录，会先构建 wheel 再把 wheel 安装进虚拟环境，拷贝全部源文件。编辑包源文件后，虚拟环境里的版本就是过时的。

可编辑安装通过在虚拟环境中添加指向项目的链接（`.pth` 文件）解决该问题，让解释器直接包含源文件。可编辑安装有一些限制（主要是：构建后端需要支持；原生模块导入前不会重新编译），但对开发很有用——虚拟环境总是使用包的最新改动。

uv 对工作区包默认使用可编辑安装。添加可编辑依赖用 `--editable` 标志：

```
$ uv add --editable ./path/foo
```
或在工作区中不使用可编辑依赖：

```
$ uv add --no-editable ./path/foo
```
### 虚拟依赖（Virtual dependencies）

uv 允许依赖是"虚拟的"：依赖本身不作为包安装，但其依赖会被安装。默认依赖永不虚拟。

带[路径来源](#路径)的依赖若显式设置 `tool.uv.package = false`，可以是虚拟的。没有该设置时，uv 把路径依赖当作普通包并尝试构建它——即使项目没有声明构建系统。

把依赖视为虚拟：在来源上设 `package = false`：

```
[project]
dependencies = ["bar"]

[tool.uv.sources]
bar = { path = "../projects/bar", package = false }
```
若依赖设置了 `tool.uv.package = false`，可以在来源上声明 `package = true` 覆盖：

```
[project]
dependencies = ["bar"]

[tool.uv.sources]
bar = { path = "../projects/bar", package = true }
```
类似地，带[工作区来源](#工作区成员)的依赖若显式设置 `tool.uv.package = false`，也可以是虚拟的；没有该设置时，即使未声明构建系统，工作区成员也会被构建。

_不是_依赖的工作区成员默认可以是虚拟的。例如父 `pyproject.toml`：

```
[project]
name = "parent"
version = "1.0.0"
dependencies = []

[tool.uv.workspace]
members = ["child"]
```
子 `pyproject.toml` 不含构建系统：

```
[project]
name = "child"
version = "1.0.0"
dependencies = ["anyio"]
```
那么 `child` 工作区成员不会被安装，但传递依赖 `anyio` 会。相反，如果父项目声明了对 `child` 的依赖：

```
[project]
name = "parent"
version = "1.0.0"
dependencies = ["child"]

[tool.uv.sources]
child = { workspace = true }

[tool.uv.workspace]
members = ["child"]
```
那么 `child` 会被构建并安装。

### 依赖说明符（Dependency specifiers）

uv 使用标准依赖说明符，最初定义于 [PEP 508](https://peps.python.org/pep-0508/)。依赖说明符按顺序由以下部分组成：

- 依赖名
- 所需的 extras（可选）
- 版本说明符
- 环境标记（可选）

版本说明符以逗号分隔后叠加，例如 `foo >=1.2.3,<2,!=1.4.0` 解释为"`foo` 至少 1.2.3、小于 2 且不等于 1.4.0 的版本"。

说明符会按需补尾零，因此 `foo ==2` 也匹配 foo 2.0.0。等号最后一位可用星号，如 `foo ==2.1.*` 接受 2.1 系列的任何发行版。类似地，`~=` 匹配最后一位相等或更高：`foo ~=1.2` 等价 `foo >=1.2,<2`，`foo ~=1.2.3` 等价 `foo >=1.2.3,<1.3`。

extras 以逗号分隔写在名称与版本之间的方括号内，如 `pandas[excel,plot] ==2.2`；extra 名之间的空白会被忽略。

某些依赖只在特定环境中需要，如特定 Python 版本或操作系统。例如为 `importlib.metadata` 模块安装 `importlib-metadata` 后端口：`importlib-metadata >=7.1.0,<8; python_version < '3.10'`。在 Windows 上安装 `colorama`（其他平台省略）：`colorama >=0.4.6,<5; platform_system == "Windows"`。

标记可用 `and`、`or` 与括号组合，如 `aiohttp >=3.7.4,<4; (sys_platform != 'win32' or implementation_name != 'pypy') and python_version >= '3.10'`。注意标记内的版本必须加引号，而标记_外_的版本_不能_加引号。

## 锁定与同步（Locking and syncing）

锁定（locking）是把项目依赖[解析](https://docs.astral.sh/uv/concepts/resolution/)为[锁文件](#锁文件the-lockfile)的过程；同步（syncing）是从锁文件把包的子集安装进[项目环境](#项目环境)的过程。

### 自动锁定与同步

在 uv 中锁定与同步是_自动_的。例如使用 `uv run` 时，项目会在调用所请求命令前被锁定并同步，保证项目环境始终最新。类似地，读取锁文件的命令（如 `uv tree`）会在运行前自动更新它。

禁用自动锁定用 `--locked` 选项：

```
$ uv run --locked ...
```
锁文件不是最新时，uv 会报错而不是更新锁文件。不检查锁文件是否最新直接使用，用 `--frozen`：

```
$ uv run --frozen ...
```
类似地，运行命令不检查环境是否最新，用 `--no-sync`：

```
$ uv run --no-sync ...
```
### 检查锁文件

判断锁文件是否最新时，uv 会检查它与项目元数据是否匹配。例如向 `pyproject.toml` 添加依赖，锁文件即视为过时；把某依赖的版本约束改得排除了锁定版本，锁文件也视为过时；但若改了约束而既有锁定版本仍被包含，锁文件仍视为最新。

把 `--check` 标志传给 `uv lock` 可检查锁文件是否最新：

```
$ uv lock --check
```
等价于其他命令的 `--locked` 标志。

> **重要**：新版本包发布时，uv 不会因此认为锁文件过时——想升级依赖必须显式更新锁文件。见下文"升级锁定的包版本"。

### 创建锁文件

虽然锁文件是自动创建的，也可以用 `uv lock` 显式创建或更新：

```
$ uv lock
```
### 同步环境

环境虽是自动同步的，也可用 `uv sync` 显式同步：

```
$ uv sync
```
手动同步环境对确保编辑器持有正确版本的依赖尤其有用。

**可编辑安装**：同步环境时，uv 会把项目（及其他工作区成员）安装为_可编辑_包，改动无需重新同步即可反映到环境中。退出该行为用 `--no-editable`。

> **注**：项目没有定义构建系统时，不会被安装。详见构建系统文档。

**多余包的处理**：`uv sync` 默认执行"精确"同步——移除所有不在锁文件中的包。保留多余包用 `--inexact`：

```
$ uv sync --inexact
```
相反，`uv run` 默认"非精确"同步：保证所有必需包装好但不移除多余包。让 `uv run` 启用精确同步，用 `--exact`：

```
$ uv run --exact ...
```
**同步可选依赖**：uv 从 `[project.optional-dependencies]` 表读取可选依赖，常称"extras"。默认不同步 extras。用 `--extra` 选项包含某个 extra：

```
$ uv sync --extra foo
```
快速启用所有 extras 用 `--all-extras`。

**同步开发依赖**：uv 从 `[dependency-groups]` 表（[PEP 735](https://peps.python.org/pep-0735/)）读取开发依赖。`dev` 组被特殊对待并默认同步。`--no-dev` 可排除 `dev` 组；`--only-dev` 可只安装 `dev` 组而_不含_项目及其依赖。其他组可用 `--all-groups`、`--no-default-groups`、`--group <name>`、`--only-group <name>`、`--no-group <name>` 包含或排除。`--only-group` 语义同 `--only-dev`（不包含项目），但还会排除默认组。

组的排除总是优先于包含，因此执行：

```
$ uv sync --no-group foo --group foo
```
`foo` 组不会被安装。

### 升级锁定的包版本

存在 `uv.lock` 时，`uv sync` 与 `uv lock` 会优先使用先前锁定的版本。只有项目依赖约束排除了先前锁定版本时，包版本才会变化。

升级所有包：

```
$ uv lock --upgrade
```
把单个包升级到最新版而保留其他包的锁定版本：

```
$ `uv lock --upgrade-package <package>`
```
把单个包升级到指定版本：

```
$ `uv lock --upgrade-package <package>==<version>`
```
所有升级都受项目依赖约束限制：项目为包定义了上界时，升级不会越过该版本。

> **注**：uv 对 Git 依赖应用类似逻辑。例如 Git 依赖引用 `main` 分支时，uv 会优先使用既有 `uv.lock` 中的锁定 commit SHA 而不是 `main` 上的最新提交，除非使用 `--upgrade` 或 `--upgrade-package` 标志。

这些标志也可以传给 `uv sync` 或 `uv run`，同时更新锁文件_和_环境。

### 导出锁文件

需要把 uv 与其他工具或工作流集成时，可把 `uv.lock` 导出为不同格式：`requirements.txt`、`pylock.toml`（PEP 751）与 CycloneDX SBOM：

```
$ uv export --format requirements.txt
$ uv export --format pylock.toml
$ uv export --format cyclonedx1.5
```
### 部分安装（Partial installations)

有时分多步安装有帮助，例如构建 Docker 镜像时获得最优的层缓存。`uv sync` 提供若干标志：

- `--no-install-project`：不安装当前项目
- `--no-install-workspace`：不安装任何工作区成员（含根项目）
- `--no-install-package <NO_INSTALL_PACKAGE>`：不安装给定包

使用这些选项时，目标的所有依赖仍会安装。例如 `--no-install-project` 会省略_项目本身_但不省略其依赖。使用不当会导致环境损坏，因为包可能缺失其依赖。

### 恶意软件检查

> **重要**：同步时的恶意软件检查为预览特性，稳定前可能变化。

同步期间，uv 可以对锁文件做轻量扫描，通过对照 [OSV](https://osv.dev) 检查已知恶意软件。OSV 引用 OpenSSF 恶意包数据库的 MAL 通告。若锁定的依赖命中恶意软件通告，同步会终止。

启用恶意软件检查：在 uv 设置中设 `audit.malware-check = true`，或设置环境变量 `UV_MALWARE_CHECK=1`。使用替代漏洞服务：在 uv 设置中设 `audit.malware-check-url`，或设 `UV_MALWARE_CHECK_URL`。

## 构建发行版（Building distributions）

要把项目分发给他人（如上传到 PyPI 等索引），需要把它构建成可分发的格式。

Python 项目通常同时以源码发行版（sdist）与二进制发行版（wheel）分发：前者通常是 `.tar.gz` 或 `.zip` 文件，包含项目源码与一些额外元数据；后者是 `.whl` 文件，包含可直接安装的预构建产物。

> **重要**：使用 `uv build` 时，uv 充当[构建前端](https://peps.python.org/pep-0517/#terminology-and-goals)：只决定使用哪个 Python 版本并调用构建后端。构建的细节（包含哪些文件、发行版文件名等）由 `[build-system]` 定义的构建后端决定；构建配置信息见相应工具的文档。

### 使用 `uv build`

`uv build` 可构建项目的源码发行版与二进制发行版。默认构建当前目录的项目，产物放入 `dist/` 子目录：

```
$ uv build
$ ls dist/
example-0.1.0-py3-none-any.whl
example-0.1.0.tar.gz
```
给 `uv build` 提供路径可构建不同目录的项目，如 `uv build path/to/project`。

`uv build` 会先构建源码发行版，再从它构建二进制发行版（wheel）。可以用 `uv build --sdist` 限制只构建源码发行版、用 `uv build --wheel` 只构建二进制发行版，或用 `uv build --sdist --wheel` 从源码构建两者。

### 构建约束

`uv build` 接受 `--build-constraint`，用于在构建过程中约束构建需求的版本。配合 `--require-hashes`，uv 会强制构建所用需求匹配特定已知哈希以保证可复现性。

例如给定如下 `constraints.txt`：

```
setuptools==68.2.2 --hash=sha256:b454a35605876da60632df1a60f736524eb73cc47bbc9f3f1ef1b644de74fd2a
```
运行以下命令会以指定版本的 `setuptools` 构建项目，并校验下载的 `setuptools` 发行版匹配指定哈希：

```
$ uv build --build-constraint constraints.txt --require-hashes
```
### 阻止发布到 PyPI

有不想发布的内部包时，可标记为私有：

```
[project]
classifiers = ["Private :: Do Not Upload"]
```
该设置会让 PyPI 拒绝你上传的包；不影响替代镜像仓库的安全或隐私设置。我们还建议只生成按项目的 PyPI API token：没有匹配项目的 PyPI token，就不可能误发布。

---

> **来源**：本文由 uv 官方文档以下页面完整翻译并合并而成：[Working on projects（项目指南）](https://docs.astral.sh/uv/guides/projects/)、[Concepts → Projects 索引](https://docs.astral.sh/uv/concepts/projects/)、[Project structure and files（项目结构与文件）](https://docs.astral.sh/uv/concepts/projects/layout/)、[Creating projects（创建项目）](https://docs.astral.sh/uv/concepts/projects/init/)、[Managing dependencies（管理依赖）](https://docs.astral.sh/uv/concepts/projects/dependencies/)、[Locking and syncing（锁定与同步）](https://docs.astral.sh/uv/concepts/projects/sync/)、[Building distributions（构建发行版）](https://docs.astral.sh/uv/concepts/projects/build/)。作者 Astral，许可 MIT OR Apache-2.0 双许可。抓取于 2026-09-13。原文 Concepts → Projects 下的 run/export/workspaces/config 各页未收录，见官方链接。

---

> 编者注：poetry 用户迁移对照——`poetry init` ≈ `uv init`、`poetry add` ≈ `uv add`、`poetry remove` ≈ `uv remove`、`poetry lock && poetry install` ≈ `uv lock && uv sync`、`poetry build` ≈ `uv build`、`poetry run` ≈ `uv run`。uv 的核心优势：Rust 实现的极速解析与安装、跨平台通用锁文件（`uv.lock`）、以及 `uv run` 的"自动锁定+同步"语义。纯脚本场景可不建项目，直接 `uv run script.py` 或 `uvx <tool>`。
