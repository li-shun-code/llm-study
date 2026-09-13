---
title: 环境变量与 API Key 管理（.env 与 python-dotenv）
source_url: https://github.com/theskumar/python-dotenv
author: Saurabh Kumar 及 python-dotenv 贡献者
license: MIT License（转载署名）
fetched_at: 2026-09-13
translated: true
order: 21
versions: python-dotenv 1.x
---
python-dotenv 从 `.env` 文件中读取键值对，并将它们设置为环境变量。它有助于遵循 [12-factor](https://12factor.net/) 原则开发应用。

## 快速开始

```shell
pip install python-dotenv
```

如果你的应用从环境变量读取配置（典型的 12-factor 应用），在本地开发时启动它并不太方便，因为你必须自己手动设置那些环境变量。

为了解决这个问题，你可以在应用中加入 python-dotenv，让它在 `.env` 文件存在时（例如在开发环境中）自动从中加载配置，同时应用仍然可以通过环境变量来配置：

```python
from dotenv import load_dotenv

load_dotenv()  # 读取 .env 文件中的变量并写入 os.environ

# 你的应用代码，照常从环境变量读取配置（例如 `os.environ` 或
# `os.getenv`），就像这些值来自真实环境一样。
```

默认情况下，`load_dotenv()` 会：

- 在 Python 脚本所在目录（或其上层目录）中查找 `.env` 文件。
- 读取每一组键值对并添加到 `os.environ`。
- **不覆盖**已存在的环境变量（`override=False`）。传入 `override=True` 可以覆盖已有变量。

要配置开发环境，请把 `.env` 文件放在项目根目录：

```
.
├── .env
└── foo.py
```

python-dotenv 支持的 `.env` 文件语法与 Bash 类似：

```bash
# 开发配置
DOMAIN=example.org
ADMIN_EMAIL=admin@${DOMAIN}
ROOT_URL=${DOMAIN}/app
```

如果在值中使用变量，请确保用 `{` 和 `}` 包裹，例如 `${DOMAIN}`；不带花括号的裸变量（如 `$DOMAIN`）不会被展开。

你很可能需要把 `.env` 加入 `.gitignore`，尤其是当它包含密码等机密信息时。

## 其他用法

### 读取配置但不修改环境

`dotenv_values` 函数的工作方式与 `load_dotenv` 大致相同，区别在于它不会改动环境，只是返回一个 `dict`，其中是从 `.env` 文件解析出的值。

```python
from dotenv import dotenv_values

config = dotenv_values(".env")  # config = {"USER": "foo", "EMAIL": "foo@example.org"}
```

这可以用来实现更高级的配置管理：

```python
import os
from dotenv import dotenv_values

config = {
    **dotenv_values(".env.shared"),  # 加载共享的开发变量
    **dotenv_values(".env.secret"),  # 加载敏感变量
    **os.environ,  # 用环境变量覆盖已加载的值
}
```

### 以流的形式解析配置

`load_dotenv` 和 `dotenv_values` 通过 `stream` 参数接受[流][python_streams]，因此可以从文件系统以外的来源（例如网络）加载变量。

```python
from io import StringIO

from dotenv import load_dotenv

config = StringIO("USER=foo\nEMAIL=foo@example.org")
load_dotenv(stream=config)
```

### 在 IPython 中加载 .env 文件

你可以在 IPython 中使用 dotenv。默认情况下，它会用 `find_dotenv` 搜索 `.env` 文件：

```python
%load_ext dotenv
%dotenv
```

也可以指定路径：

```python
%dotenv relative/or/absolute/path/to/.env
```

可选参数：

- `-o` 覆盖已有变量。
- `-v` 输出更详细的日志。

### 禁用 load_dotenv

设置环境变量 `PYTHON_DOTENV_DISABLED=1` 可以让 `load_dotenv()` 不再加载 `.env` 文件或流。当你无法修改第三方包的调用时，或在生产环境中很有用。

## 命令行界面

python-dotenv 还附带了一个 CLI 工具 `dotenv`，帮助你无需手动打开文件即可操作 `.env` 文件。

```shell
$ pip install "python-dotenv[cli]"
$ dotenv set USER foo
$ dotenv set EMAIL foo@example.org
$ dotenv list
USER=foo
EMAIL=foo@example.org
$ dotenv list --format=json
{
  "USER": "foo",
  "EMAIL": "foo@example.org"
}
$ dotenv run -- python foo.py
```

运行 `dotenv --help` 查看更多选项与子命令。

## 文件格式

该格式没有正式的规范，仍在不断改进。不过，`.env` 文件大体上应与 Bash 文件类似。在 Unix 系统上还支持从 FIFO（命名管道）读取。

键可以不加引号或使用单引号。值可以不加引号，也可以使用单引号或双引号。键、等号和值前后的空格会被忽略。值后面可以跟注释。行首可以出现 `export` 指令，不影响解析结果。

允许的转义序列：

- 单引号值中：`\\`、`\'`
- 双引号值中：`\\`、`\'`、`\"`、`\a`、`\b`、`\f`、`\n`、`\r`、`\t`、`\v`

### 多行值

单引号或双引号包裹的值可以跨多行。下面两个例子等价：

```bash
FOO="first line
second line"
```

```bash
FOO="first line\nsecond line"
```

### 没有值的变量

变量可以没有值：

```bash
FOO
```

这会让 `dotenv_values` 把该变量名关联到值 `None`（例如 `{"FOO": None}`）。而 `load_dotenv` 则会直接忽略这类变量。

注意不要与 `FOO=` 混淆，后者会把变量关联到空字符串。

### 变量展开

python-dotenv 可以使用 POSIX 变量展开对变量做插值。

使用 `load_dotenv(override=True)` 或 `dotenv_values()` 时，变量的取值按以下优先级选取：

- `.env` 文件中该变量的值。
- 环境中该变量的值。
- 默认值（如果提供）。
- 空字符串。

使用 `load_dotenv(override=False)` 时，变量的取值按以下优先级选取：

- 环境中该变量的值。
- `.env` 文件中该变量的值。
- 默认值（如果提供）。
- 空字符串。

## 相关项目

- [environs](https://github.com/sloria/environs)
- [Honcho](https://github.com/nickstenning/honcho)
- [dump-env](https://github.com/sobolevn/dump-env)
- [dynaconf](https://github.com/dynaconf/dynaconf)
- [parse_it](https://github.com/naorlivne/parse_it)
- [django-dotenv](https://github.com/jpadilla/django-dotenv)
- [django-environ](https://github.com/joke2k/django-environ)
- [python-decouple](https://github.com/HBNetwork/python-decouple)
- [django-configuration](https://github.com/jezdez/django-configurations)

## 致谢

本项目目前由 [Saurabh Kumar](https://saurabh-kumar.com) 和 [Bertrand Bonnefoy-Claudet](https://github.com/bbc2) 维护，离不开众多[贡献者](https://github.com/theskumar/python-dotenv/graphs/contributors)的支持。

---

> **来源**：本文翻译自 [python-dotenv - GitHub](https://github.com/theskumar/python-dotenv)，作者 Saurabh Kumar 及 python-dotenv 贡献者，许可 MIT License。抓取于 2026-09-13。

---

> 编者注：调用 LLM API 时，API Key 属于敏感凭据，绝不应硬编码在代码或提交到 Git 仓库。业界通行做法是遵循 [12-factor](https://12factor.net/) 原则：把配置放在环境变量中，本地开发时用 `.env` 文件配合 python-dotenv 加载。本文是该工具官方 README 的中文翻译，正是这一方案的权威说明。
