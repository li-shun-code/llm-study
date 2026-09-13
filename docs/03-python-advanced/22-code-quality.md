---
title: 代码质量工具链：Ruff、mypy 与 pre-commit
source_url: https://docs.astral.sh/ruff/
author: Astral（Ruff）；Jukka Lehtosalo 与 mypy 贡献者（mypy）；Anthony Sottile 与 pre-commit 贡献者（pre-commit）
license: MIT 许可证（三者均为 MIT 许可）
fetched_at: 2026-09-13
translated: true
order: 22
versions: Ruff / mypy / pre-commit 当前稳定版
---

*编者导读：本篇整合翻译三个代码质量工具的官方文档，各部分来源逐节署名：Ruff（Lint + 格式化，第一部分，译自官方《Tutorial》）、mypy（静态类型检查，第二部分，译自官方 README 及 getting-started 要点）、pre-commit（Git 提交钩子框架，第三部分，译自官方文档 intro/install/usage 各节）。三者与《uv 项目管理》一篇的工程化流程、以及 Docker 指南中的 lint 一节互为配套。*

# 第一部分：Ruff —— 极快的 Python Linter 与格式化工具

（本部分译自 Ruff 官方文档 [Tutorial](https://docs.astral.sh/ruff/tutorial/)，Astral，MIT 许可。）

本教程将带你把 Ruff 的 linter 与 formatter 集成到你的项目中。更详细的概览见官方《配置 Ruff》（configuration）页。

## 快速开始

首先，用 [uv](https://docs.astral.sh/uv/) 初始化一个项目：

```console
$ uv init --lib numbers
```

该命令创建如下结构的 Python 项目：

```text
numbers
  ├── README.md
  ├── pyproject.toml
  └── src
      └── numbers
          ├── __init__.py
          └── py.typed
```

接着清空 `src/numbers/__init__.py` 中自动生成的内容，并创建如下代码的 `src/numbers/calculate.py`：

```python
from typing import Iterable

import os


def sum_even_numbers(numbers: Iterable[int]) -> int:
    """Given an iterable of integers, return the sum of all even numbers in the iterable."""
    return sum(
        num for num in numbers
        if num % 2 == 0
    )
```

然后把 Ruff 加入项目：

```console
$ uv add --dev ruff
```

之后就可以通过 `uv run ruff check` 对项目运行 Ruff linter：

```console
$ uv run ruff check
src/numbers/calculate.py:3:8: F401 [*] `os` imported but unused
Found 1 error.
[*] 1 fixable with the `--fix` option.
```

> **注**：除了 `uv run`，也可以激活项目虚拟环境（Linux/macOS 上 `source .venv/bin/activate`，Windows 上 `.venv\Scripts\activate`）后直接运行 `ruff check`。

Ruff 发现了一个未使用的导入——Python 代码中的常见错误。Ruff 认为这是"可修复"错误，因此可以运行 `ruff check --fix` 自动解决：

```console
$ uv run ruff check --fix
Found 1 error (1 fixed, 0 remaining).
```

运行 `git diff` 可见：

```diff
--- a/src/numbers/calculate.py
+++ b/src/numbers/calculate.py
@@ -1,7 +1,5 @@
 from typing import Iterable

-import os
-

 def sum_even_numbers(numbers: Iterable[int]) -> int:
     """Given an iterable of integers, return the sum of all even numbers in the iterable."""
     return sum(
         num for num in numbers
         if num % 2 == 0
     )
```

注意 Ruff 默认在当前目录运行，但也可以传入要检查的特定路径：

```console
$ uv run ruff check src/numbers/calculate.py
```

项目通过 `ruff check` 后，即可用 `ruff format` 运行 Ruff 格式化器：

```console
$ uv run ruff format
1 file reformatted
```

运行 `git diff` 可以看到 `sum` 调用被重排以符合默认的 88 字符行宽限制：

```diff
--- a/src/numbers/calculate.py
+++ b/src/numbers/calculate.py
@@ -3,7 +3,4 @@ from typing import Iterable

 def sum_even_numbers(numbers: Iterable[int]) -> int:
     """Given an iterable of integers, return the sum of all even numbers in the iterable."""
-    return sum(
-        num for num in numbers
-        if num % 2 == 0
-    )
+    return sum(num for num in numbers if num % 2 == 0)
```

至此我们一直在使用 Ruff 的默认配置。下面看看如何自定义 Ruff 的行为。

## 配置

为确定每个 Python 文件适用的设置，Ruff 会在该文件所在目录及各级父目录中查找第一个 `pyproject.toml`、`ruff.toml` 或 `.ruff.toml` 文件。

要配置 Ruff，向项目根目录的配置文件加入以下内容（`pyproject.toml` 形式；若用 `ruff.toml` 则去掉 `[tool.ruff]` 的 `tool.` 前缀）：

```toml
[tool.ruff]
# 把最大行宽设为 79。
line-length = 79

[tool.ruff.lint]
# 把 `line-too-long` 规则加入强制规则集。默认情况下 Ruff 会省略与格式化器
# （如 Black）重叠的规则，但可以通过显式添加规则覆盖该行为。
extend-select = ["E501"]
```

再次运行 Ruff，可以看到它现在强制 79 的最大行宽：

```console
$ uv run ruff check
src/numbers/calculate.py:5:80: E501 Line too long (90 > 79)
Found 1 error.
```

支持的全部设置见官方《Settings》页。对本项目，还要注意最低支持的 Python 版本：

```toml
[project]
# Support Python 3.10+.
requires-python = ">=3.10"

[tool.ruff]
# Set the maximum line length to 79.
line-length = 79

[tool.ruff.lint]
# Add the `line-too-long` rule to the enforced rule set.
extend-select = ["E501"]
```

### 规则选择

Ruff 支持[超过 900 条 lint 规则](https://docs.astral.sh/ruff/rules/)，分布在 50 多个内置插件中；如何确定合适的规则集取决于项目需求：有些规则可能太严格，有些是框架特定的，等等。

默认情况下，Ruff 启用 `F`、`E`、`B`、`UP`、`RUF` 等类别的规则，并省略任何与格式化器（如 `ruff format` 或 [Black](https://github.com/psf/black)）重叠的风格类规则。

如果你是首次引入 linter，**默认规则集是绝佳起点**：零配置即可捕获大量常见错误（如未使用的导入）。完整列表见官方《Default Rules》。

如果你正从其他 linter 迁移到 Ruff，可以启用与你先前配置等价的规则。例如要强制 pyupgrade 规则：

```toml
[project]
requires-python = ">=3.10"

[tool.ruff.lint]
extend-select = [
  "UP",  # pyupgrade
]
```

再次运行 Ruff，会看到它现在强制 pyupgrade 规则。特别是，Ruff 会标记弃用的 `typing.Iterable` 而非 `collections.abc.Iterable`：

```console
$ uv run ruff check
src/numbers/calculate.py:1:1: UP035 [*] Import from `collections.abc` instead: `Iterable`
Found 1 error.
[*] 1 fixable with the `--fix` option.
```

随着时间推移，你可以选择启用更多规则。例如，强制所有函数都有 docstring：

```toml
[project]
requires-python = ">=3.10"

[tool.ruff.lint]
extend-select = [
  "UP",  # pyupgrade
  "D",   # pydocstyle
]

[tool.ruff.lint.pydocstyle]
convention = "google"
```

再次运行：

```console
$ uv run ruff check
src/numbers/__init__.py:1:1: D104 Missing docstring in public package
src/numbers/calculate.py:1:1: UP035 [*] Import from `collections.abc` instead: `Iterable`
  |
1 | from typing import Iterable
  | ^^^^^^^^^^^^^^^^^^^^^^^^^^^ UP035
  |
  = help: Import from `collections.abc`

src/numbers/calculate.py:1:1: D100 Missing docstring in public module
Found 3 errors.
[*] 1 fixable with the `--fix` option.
```

### 忽略错误

任何 lint 规则都可以通过在相关行添加 `# noqa` 注释忽略。例如忽略 `Iterable` 导入的 `UP035` 规则：

```python
from typing import Iterable  # noqa: UP035


def sum_even_numbers(numbers: Iterable[int]) -> int:
    """Given an iterable of integers, return the sum of all even numbers in the iterable."""
    return sum(num for num in numbers if num % 2 == 0)
```

再运行 `ruff check`，`Iterable` 导入不再被标记。若想对整个文件忽略某规则，可在文件内任意位置（最好靠前）添加 `# ruff: noqa: {code}` 一行：

```python
# ruff: noqa: UP035
from typing import Iterable


def sum_even_numbers(numbers: Iterable[int]) -> int:
    """Given an iterable of integers, return the sum of all even numbers in the iterable."""
    return sum(num for num in numbers if num % 2 == 0)
```

更深入的忽略方式见官方《Error suppression》。

### 添加规则（存量治理）

在既有代码库上启用新规则时，你可能想忽略该规则_所有_既有违规，只从今往后强制执行。

Ruff 通过 `--add-noqa` 标志支持该工作流：它会根据既有违规为每一行添加 `# noqa` 指令。可以把 `--add-noqa` 与 `--select` 命令行标志结合，为所有既有 `UP035` 违规加 `# noqa`：

```console
$ uv run ruff check --select UP035 --add-noqa .
Added 1 noqa directive.
```

运行 `git diff` 可见：

```diff
diff --git a/numbers/src/numbers/calculate.py b/numbers/src/numbers/calculate.py
--- a/numbers/src/numbers/calculate.py
+++ b/numbers/src/numbers/calculate.py
@@ -1,4 +1,4 @@
-from typing import Iterable
+from typing import Iterable  # noqa: UP035
```

想改为添加 `# ruff: ignore[...]` 注释，用 `--add-ignore` 标志。预览模式下 `--add-ignore` 使用人类可读的规则名替代规则代码。

## 集成

本教程聚焦 Ruff 的命令行界面，但 Ruff 也可以通过 [`ruff-pre-commit`](https://github.com/astral-sh/ruff-pre-commit) 用作 [pre-commit](https://pre-commit.com) 钩子：

```yaml
- repo: https://github.com/astral-sh/ruff-pre-commit
  # Ruff version.
  rev: v0.16.7
  hooks:
    # Run the linter.
    - id: ruff-check
    # Run the formatter.
    - id: ruff-format
```

Ruff 还可以集成到你喜欢的编辑器，见官方《Editors》章节；其他集成见官方《Integrations》章节。

（配置速查见本模块《Docker 容器化》一篇的 lint 小节：`[tool.ruff] target-version`、`[tool.ruff.lint] select/ignore`、`ruff check --fix`、`ruff format`。）

# 第二部分：mypy —— Python 静态类型检查

（本部分译自 mypy 官方 [README](https://github.com/python/mypy/blob/master/README.md) 及 getting-started 文档要点，Jukka Lehtosalo 与 mypy 贡献者，MIT 许可。）

## mypy 是什么？

Mypy 是 Python 的静态类型检查器。

类型检查器帮助你确保代码中变量与函数的使用方式正确。使用 mypy 时，为 Python 程序添加类型提示（[PEP 484](https://www.python.org/dev/peps/pep-0484/)），当你错误地使用这些类型时 mypy 会发出警告。

Python 是动态语言，通常只有在你尝试运行代码时才能看到错误。mypy 是_静态_检查器，它无需运行程序就能发现其中的 bug！

一个开胃的小例子：

```python
number = input("What is your favourite number?")
print("It is", number + 1)  # error: Unsupported operand types for + ("str" and "int")
```

为 mypy 添加类型提示不会干扰程序原有的运行方式。把类型提示想成类似注释的东西！即使 mypy 报告错误，你仍然可以用 Python 解释器运行代码。

mypy 以渐变类型（gradual typing）理念设计：你可以慢慢地为代码库添加类型提示，并且在静态类型不方便时始终可以退回动态类型。

mypy 拥有强大且易用的类型系统，支持类型推断、泛型、可调用类型、元组类型、联合类型、结构化子类型等特性。使用 mypy 会让你的程序更易理解、调试与维护。

特别推荐阅读官方文档中的：[类型提示速查表](https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html)、[入门指南（getting started）](https://mypy.readthedocs.io/en/stable/getting_started.html)、[错误代码列表](https://mypy.readthedocs.io/en/stable/error_code_list.html)。

## 快速开始

用 pip 安装 mypy：

```bash
python3 -m pip install -U mypy
```

想运行最新代码，可以直接从仓库安装：

```bash
python3 -m pip install -U git+https://github.com/python/mypy.git
```

现在就可以像这样对程序的[静态类型部分]做类型检查：

```bash
mypy PROGRAM
```

即使 mypy 报告类型错误，你仍然可以用 Python 解释器运行静态类型的程序：

```bash
python3 PROGRAM
```

处理大型代码库时，可以用[守护进程模式]运行 mypy，获得更快（通常亚秒级）的增量更新：

```bash
dmypy run -- PROGRAM
```

也可以在[在线 playground](https://mypy-play.net/)（由 Yusuke Miyazaki 开发）试用 mypy。

**入门要点**（译自官方 getting-started）：mypy 可以逐文件、逐函数渐进采用——用 `mypy mymodule.py` 检查单个文件；对函数签名添加注解（如 `def greeting(name: str) -> str:`）后，mypy 会检查函数体内对这些值的用法；未加注解的函数默认不检查（可用 `--strict` 逐步收紧，或用 `disallow_untyped_defs` 等按项配置）；配置写在 `mypy.ini` / `pyproject.toml` 的 `[tool.mypy]` 段。

## IDE 集成

mypy 可以集成到流行的 IDE：

- VS Code：提供与 mypy 的[基础集成](https://code.visualstudio.com/docs/python/linting#_mypy)。
- Vim：用 [Syntastic](https://github.com/vim-syntastic/syntastic)（`~/.vimrc` 加 `let g:syntastic_python_checkers=['mypy']`）或 [ALE](https://github.com/dense-analysis/ale)（安装 mypy 后默认启用，或在 `~/vim/ftplugin/python.vim` 加 `let b:ale_linters = ['mypy']`）。
- Emacs：用 [Flycheck](https://github.com/flycheck/)。
- Sublime Text：[SublimeLinter-contrib-mypy](https://github.com/fredcallaway/SublimeLinter-contrib-mypy)。
- PyCharm：[mypy 插件](https://github.com/dropbox/mypy-PyCharm-plugin)。
- IDLE：[idlemypyextension](https://github.com/CoolCat467/idlemypyextension)。
- pre-commit：使用 [pre-commit mirrors-mypy](https://github.com/pre-commit/mirrors-mypy)，但注意默认会限制 mypy 分析第三方依赖的能力。

## 网站与文档

更多信息见官网 <https://www.mypy-lang.org/>；文档直达 <https://mypy.readthedocs.io/>；更新日志见 <https://mypy-lang.blogspot.com/>。

## mypyc 与编译版 mypy

[Mypyc](https://github.com/mypyc/mypyc) 使用 Python 类型提示把 Python 模块编译成更快的 C 扩展。mypy 本身就用 mypyc 编译：这使得 mypy 比解释执行快约 4 倍！

要安装解释版 mypy：

```bash
python3 -m pip install --no-binary mypy -U mypy
```

要使用开发版的编译版本，直接从 <https://github.com/mypyc/mypy_mypyc-wheels/releases/latest> 安装二进制。

（参与 mypyc 开发见 <https://github.com/mypyc/mypyc> 的 issue 跟踪器。）

# 第三部分：pre-commit —— 多语言 pre-commit 钩子框架

（本部分译自 pre-commit 官方文档 intro/install/quick start/usage 各节，Anthony Sottile 与 pre-commit 贡献者，MIT 许可，原文见 [pre-commit.com](https://pre-commit.com/)。）

## 为什么需要 pre-commit（intro）

Git 钩子脚本有助于在提交代码评审之前发现简单问题。我们在每次提交时运行钩子，自动指出代码中的问题，例如缺失分号、行尾空白和调试语句。在代码评审之前指出这些问题，让评审者专注于变更的架构，而不必浪费时间纠缠琐碎的风格问题。

随着创建的库和项目越来越多，我们意识到跨项目共享 pre-commit 钩子非常痛苦。我们从一个项目到另一个项目复制粘贴笨重的 bash 脚本，还得手动修改钩子以适配不同的项目结构。

我们认为你应当始终使用业界最好的 linter。而一些最好的 linter 是用你项目里不用的语言写的，或你的机器上没装的。例如 scss-lint 是一个用 Ruby 编写的 SCSS linter。如果你在用 node 写项目，你应该能够把 scss-lint 当作 pre-commit 钩子使用，而不必给项目添加 Gemfile、也不必搞懂怎么安装 scss-lint。

我们构建 pre-commit 来解决钩子问题。它是 pre-commit 钩子的多语言包管理器：你指定想要的钩子列表，pre-commit 会在每次提交前管理任何语言编写的钩子的安装与执行。pre-commit 专门设计为不需要 root 权限：如果你的某个开发者没装 node 但修改了一个 JavaScript 文件，pre-commit 会自动处理下载并构建 node 来运行 eslint，全程无需 root。

## 安装（install）

运行钩子之前，需要安装 pre-commit 包管理器。

用 pip：

```bash
pip install pre-commit
```

在 Python 项目中，把以下内容加入 requirements.txt（或 requirements-dev.txt）：

```text
pre-commit
```

作为零依赖的 [zipapp](https://docs.python.org/3/library/zipapp.html)：

- 从 [GitHub releases](https://github.com/pre-commit/pre-commit/releases) 找到并下载 `.pyz` 文件；
- 用 `python pre-commit-#.#.#.pyz ...` 代替 `pre-commit ...` 运行。

## 快速开始（quick start）

**1. 安装 pre-commit**：按上面的安装说明操作；`pre-commit --version` 应显示你使用的版本：

```cmd
pre-commit --version
```

**2. 添加 pre-commit 配置**：创建名为 `.pre-commit-config.yaml` 的文件；可以用 [`pre-commit sample-config`](https://pre-commit.com/#pre-commit-sample-config) 生成一个非常基础的配置；配置的完整选项列表见官方文档。本例使用 Python 代码格式化器，但 `pre-commit` 适用于任何编程语言；还有其他[受支持的钩子](https://pre-commit.com/hooks.html)可用：

```yaml
repos:
-   repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v2.3.0
    hooks:
    -   id: check-yaml
    -   id: end-of-file-fixer
    -   id: trailing-whitespace
-   repo: https://github.com/psf/black
    rev: 22.10.0
    hooks:
    -   id: black
```

**3. 安装 git 钩子脚本**：运行 `pre-commit install` 设置 git 钩子脚本：

```console
$ pre-commit install
pre-commit installed at .git/hooks/pre-commit
```

现在 `pre-commit` 会在 `git commit` 时自动运行！

**4.（可选）对所有文件运行**：添加新钩子时，通常建议先对所有文件运行一遍（通常 `pre-commit` 在 git 钩子中只对变更文件运行）：

```text
$ pre-commit run --all-files
[INFO] Initializing environment for https://github.com/pre-commit/pre-commit-hooks.
[INFO] Installing environment for https://github.com/pre-commit/pre-commit-hooks.
[INFO] This may take a few minutes...
Check Yaml...............................................................Passed
Fix End of Files.........................................................Passed
Trim Trailing Whitespace.................................................Failed
- hook id: trailing-whitespace
- exit code: 1

Files were modified by this hook. Additional output:

Fixing sample.py

black....................................................................Passed
```

- 哎呀！看来我有一些行尾空白；
- 也考虑在 [CI](https://pre-commit.com/#usage-in-continuous-integration) 里运行它。

## 日常使用（usage）

运行 `pre-commit install` 把 pre-commit 装进你的 git 钩子。此后它会在每次提交时运行。每次 clone 一个使用 pre-commit 的项目，要做的第一件事就应该是运行 `pre-commit install`。

想手动对仓库运行所有 pre-commit 钩子，运行 `pre-commit run --all-files`。要运行单个钩子，用 ``pre-commit run <hook_id>``。

pre-commit 第一次对某个文件运行时，会自动下载、安装并运行钩子。注意第一次运行钩子可能较慢。例如：机器没装 node 时，pre-commit 会下载并构建一份 node：

```text
$ pre-commit install
pre-commit installed at /home/asottile/workspace/pytest/.git/hooks/pre-commit
$ git commit -m "Add super awesome feature"
black....................................................................Passed
blacken-docs.........................................(no files to check)Skipped
Trim Trailing Whitespace.........................................................Passed
Fix End of Files.........................................................Passed
Check Yaml...........................................(no files to check)Skipped
Debug Statements (Python)................................................Passed
Flake8...................................................................Passed
Reorder python imports...................................................Passed
pyupgrade................................................................Passed
[main 146c6c2c] Add super awesome feature
 1 file changed, 1 insertion(+)
```

（常用钩子仓库：官方维护的 [pre-commit-hooks](https://github.com/pre-commit/pre-commit-hooks)（通用语言无关钩子）、[mirrors-*](https://github.com/orgs/pre-commit/repositories?language=&q=%22mirrors-%22+archived%3AFalse&sort=)（热门工具的 pre-commit 镜像，如 mirrors-mypy）；Python 项目常用 [psf/black](https://github.com/psf/black)、[astral-sh/ruff-pre-commit](https://github.com/astral-sh/ruff-pre-commit)、[PyCQA/flake8](https://github.com/PyCQA/flake8)、[PyCQA/isort](https://github.com/PyCQA/isort)、[asottile/pyupgrade](https://github.com/asottile/pyupgrade) 等。完整清单见官方 hooks 页。）

---

> **来源**：本文整合翻译三份官方文档，各部分来源逐节署名：① 第一部分 Ruff 译自官方 [Tutorial](https://docs.astral.sh/ruff/tutorial/)（Astral，MIT 许可）；② 第二部分 mypy 译自官方 [README](https://github.com/python/mypy/blob/master/README.md) 与 getting-started 文档要点（Jukka Lehtosalo 与 mypy 贡献者，MIT 许可）；③ 第三部分 pre-commit 译自 [pre-commit.com](https://pre-commit.com/) 文档 intro/install/usage 各节（Anthony Sottile 与 pre-commit 贡献者，MIT 许可）。抓取于 2026-09-13。

---

> 编者注：三者如何协作——mypy 管"类型对不对"，Ruff 管"风格与常见错误"，pre-commit 管"在 git commit 时自动跑前两者"。LLM 项目推荐起步配置：`uv add --dev ruff mypy pre-commit` + `.pre-commit-config.yaml` 挂 `ruff-check`、`ruff-format`、`mirrors-mypy` 三个钩子，CI 中再跑一遍 `pre-commit run --all-files` 与 `mypy src/`。mypy 渐进式采用建议：先 `mypy src/ --ignore-missing-imports` 看存量，再用 per-module overrides 逐模块收紧到 `strict = true`。
