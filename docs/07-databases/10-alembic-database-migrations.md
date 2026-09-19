---
title: Alembic 数据库迁移
source_url: https://alembic.sqlalchemy.org/en/latest/tutorial.html
author: Mike Bayer / SQLAlchemy 作者与贡献者（Alembic 项目）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: Alembic 1.20.0 官方教程
order: 10
group: PostgreSQL 与工程化
---
## 教程

Alembic 用于为关系数据库创建、管理与调用**变更管理（change management）**脚本，底层引擎使用 SQLAlchemy。本教程将完整介绍这个工具的理论与用法。

开始前请确保已安装 Alembic；在本地虚拟环境中安装的常见方式见官方文档 Installation 一章。如该章所述，最好把 Alembic 安装在**与目标项目相同的模块 / Python 路径**中（通常用 Python 虚拟环境），这样运行 `alembic` 命令时，被它调用的 Python 脚本（即你项目的 `env.py`）才能访问到应用模型。这并非严格要求，但通常是更好的做法。

下面的教程假设 `alembic` 命令行工具已在本地路径中，调用时能访问与目标项目相同的 Python 模块环境。

## 迁移环境

Alembic 的使用从创建**迁移环境（Migration Environment）**开始。这是一个针对特定应用的脚本目录。迁移环境只创建一次，随后与应用源码一起维护。环境用 Alembic 的 `init` 命令创建，之后可按应用的具体需要自定义。

环境的结构（含一些生成的迁移脚本）如下：

```text
yourproject/
    alembic.ini
    pyproject.toml
    alembic/
        env.py
        README
        script.py.mako
        versions/
            3512b954651e_add_account.py
            2b1ae634e5cd_add_order_id.py
            3adcc9a56557_rename_username_field.py
```

目录包含这些目录 / 文件：

- `alembic.ini`——Alembic 的主配置文件，所有模板都会生成它。后文"编辑 .ini 文件"一节将详细走读该文件。
- `pyproject.toml`——多数现代 Python 项目都有 `pyproject.toml`。Alembic 也可以选择把项目相关配置放进这个文件；要用 `pyproject.toml` 配置，见"用 pyproject.toml 做配置"一节。
- `yourproject`——应用源码根目录，或其中的某个目录。
- `alembic`——该目录位于应用源码树内，是迁移环境的家。它可以叫任何名字，使用多数据库的项目甚至可以有多个。
- `env.py`——每次调用 alembic 迁移工具时都会运行的 Python 脚本。它至少包含：配置并生成 SQLAlchemy engine、从 engine 获取连接及事务、然后以该连接为数据库连接来源调用迁移引擎的指令。

  `env.py` 属于生成的环境，因此迁移如何运行是完全可定制的：如何连接的具体细节、迁移环境如何被调用的细节都在这里。可以修改该脚本以操作多个 engine、向迁移环境传入自定义参数、加载应用专属的库和模型等。

  Alembic 自带一组初始化模板，为不同用例提供不同风格的 `env.py`。

- `README`——随各种环境模板附带，应当有些说明性内容。
- `script.py.mako`——这是一个 [Mako](http://www.makotemplates.org) 模板文件，用于生成新的迁移脚本。`versions/` 里生成的新文件都由它产出。它是可脚本化的，因此可以控制每个迁移文件的结构，包括每个文件内的标准 import，以及 `upgrade()` 和 `downgrade()` 函数结构的改动。例如 `multidb` 环境允许按 `upgrade_engine1()`、`upgrade_engine2()` 的命名方案生成多个函数。
- `versions/`——存放各个版本脚本的目录。用过其他迁移工具的人会注意到：这里的文件名不使用递增整数，而是部分 GUID 方案。Alembic 中版本脚本的顺序取决于脚本内部的指令，理论上可以在现有版本文件之间"插入（splice）"新版本文件，从而合并来自不同分支的迁移序列——不过需要小心地手工操作。

## 创建环境

理解了环境是什么，就可以用 `alembic init` 创建一个。这会使用"generic"模板创建环境：

```text
$ cd /path/to/yourproject
$ source /path/to/yourproject/.venv/bin/activate   # 假设使用本地虚拟环境
$ alembic init alembic
```

上面调用 `init` 命令生成了名为 `alembic` 的迁移目录：

```text
Creating directory /path/to/yourproject/alembic...done
Creating directory /path/to/yourproject/alembic/versions...done
Generating /path/to/yourproject/alembic.ini...done
Generating /path/to/yourproject/alembic/env.py...done
Generating /path/to/yourproject/alembic/README...done
Generating /path/to/yourproject/alembic/script.py.mako...done
Please edit configuration/connection/logging settings in
'/path/to/yourproject/alembic.ini' before proceeding.
```

以上布局由名为 `generic` 的布局模板产生。Alembic 还包含其他环境模板，用 `list_templates` 命令列出：

```text
$ alembic list_templates
Available templates:

generic - Generic single-database configuration.
pyproject - pep-621 compliant configuration that includes pyproject.toml
async - Generic single-database configuration with an async dbapi.
multidb - Rudimentary multi-database configuration.

Templates are used via the 'init' command, e.g.:

  alembic init --template generic ./scripts
```

1.16.0 版变更：新增 `pyproject` 模板，背景见"用 pyproject.toml 做配置"一节。

## 编辑 .ini 文件

Alembic 在当前目录放置了 `alembic.ini` 文件。运行其他任何命令时 Alembic 都会在当前目录找这个文件；要指定其他位置，可用 `--config` 选项或设置 `ALEMBIC_CONFIG` 环境变量。

> **提示**：`generic` 配置模板生成的文件同时包含源码配置与数据库配置的全部指令。使用 `pyproject` 模板时，源码配置元素会改放到单独的 `pyproject.toml` 文件中，见"用 pyproject.toml 做配置"一节。

`generic` 生成的一体化 .ini 文件如下：

```ini
# A generic, single database configuration.

[alembic]
# path to migration scripts.
# this is typically a path given in POSIX (e.g. forward slashes)
# format, relative to the token %(here)s which refers to the location of this
# ini file
script_location = %(here)s/alembic

# template used to generate migration file names; The default value is %%(rev)s_%(slug)s
# Uncomment the line below if you want the files to be prepended with date and time
# file_template = %%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s
# Or organize into date-based subdirectories (requires recursive_version_locations = true)
# file_template = %%(year)d/%(month).2d/%(day).2d_%(hour).2d%(minute).2d_%(second).2d_%(rev)s_%(slug)s

# sys.path path, will be prepended to sys.path if present.
# defaults to the current working directory.
prepend_sys_path = .

# timezone to use when rendering the date within the migration file
# as well as the filename.
# If specified, requires the python>=3.9 or backports.zoneinfo library and tzdata library.
# Any required deps can installed by adding `alembic[tz]` to the pip requirements
# string value is passed to ZoneInfo()
# leave blank for localtime
# timezone =

# max length of characters to apply to the
# "slug" field
# truncate_slug_length = 40

# set to 'true' to run the environment during
# the 'revision' command, regardless of autogenerate
# revision_environment = false

# set to 'true' to allow .pyc and .pyo files without
# a source .py file to be detected as revisions in the
# versions/ directory
# sourceless = false

# version location specification; This defaults
# to <script_location>/versions.  When using multiple version
# directories, initial revisions must be specified with --version-path.
# the special token `%(here)s` is available which indicates the absolute path
# to this configuration file.
#
# The path separator used here should be the separator specified by "version_path_separator" below.
# version_locations = %(here)s/bar:%(here)s/bat:%(here)s/alembic/versions

# path_separator (New in Alembic 1.16.0, supersedes version_path_separator);
# This indicates what character is used to
# split lists of file paths, including version_locations and prepend_sys_path
# within configparser files such as alembic.ini.
#
# The default rendered in new alembic.ini files is "os", which uses os.pathsep
# to provide os-dependent path splitting.
#
# Note that in order to support legacy alembic.ini files, this default does NOT
# take place if path_separator is not present in alembic.ini.  If this
# option is omitted entirely, fallback logic is as follows:
#
# 1. Parsing of the version_locations option falls back to using the legacy
#    "version_path_separator" key, which if absent then falls back to the legacy
#    behavior of splitting on spaces and/or commas.
# 2. Parsing of the prepend_sys_path option falls back to the legacy
#    behavior of splitting on spaces, commas, or colons.
#
# Valid values for path_separator are:
#
# path_separator = :
# path_separator = ;
# path_separator = space
# path_separator = newline
#
# Use os.pathsep. Default configuration used for new projects.
path_separator = os

# set to 'true' to search source files recursively
# in each "version_locations" directory
# new in Alembic version 1.10
# recursive_version_locations = false

# the output encoding used when revision files
# are written from script.py.mako
# output_encoding = utf-8

# database URL.  This is consumed by the user-maintained env.py script only.
# other means of configuring database URLs may be customized within the env.py
# file.
# See notes in "escaping characters in ini files" for guidelines on
# passwords
sqlalchemy.url = driver://user:pass@localhost/dbname

# [post_write_hooks]
# This section defines scripts or Python functions that are run
# on newly generated revision scripts.  See the documentation for further
# detail and examples

# format using "black" - use the console_scripts runner,
# against the "black" entrypoint
# hooks = black
# black.type = console_scripts
# black.entrypoint = black
# black.options = -l 79 REVISION_SCRIPT_FILENAME

# lint with attempts to fix using "ruff" - use the module runner, against the "ruff" module
# hooks = ruff
# ruff.type = module
# ruff.module = ruff
# ruff.options = check --fix REVISION_SCRIPT_FILENAME

# Alternatively, use the exec runner to execute a binary found on your PATH
# hooks = ruff
# ruff.type = exec
# ruff.executable = ruff
# ruff.options = check --fix REVISION_SCRIPT_FILENAME

# Logging configuration.  This is also consumed by the user-maintained
# env.py script only.
[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console
qualname =

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Alembic 用 Python 的 [configparser.ConfigParser](https://docs.python.org/3/library/configparser.html#configparser.ConfigParser) 库读取 `alembic.ini`。`%(here)s` 变量作为一种替换（substitution）提供，其值是 `alembic.ini` 文件本身的绝对路径，可用于生成相对配置文件位置的正确路径名。

> **提示**：`alembic.ini` 配置变量中不属于 `%(here)s` 之类插值 token 的百分号——包括 SQLAlchemy 数据库 URL 中出于 URL 转义需要而出现的百分号——必须转义。详见"ini 文件中的字符转义"一节。

该文件包含以下特性：

- `[alembic]`——Alembic 读取配置的 section。Alembic 核心实现不直接读文件的其他区域（可从用户可定制的 `env.py` 消费的额外指令除外，见下方注意）。"alembic" 这个名字（仅限 configparser 配置，`pyproject.toml` 不适用）可用 `--name` 命令行标志定制；基础示例见官方 cookbook 的"从一个 .ini 文件运行多个 Alembic 环境"。

  > **注意**：Alembic 环境模板自带的默认 `env.py` 也会读取 `[logging]`、`[handlers]` 等日志 section。若使用的配置文件不含日志指令，请删除生成的 `env.py` 里的 `fileConfig()` 指令，防止它尝试配置日志。

- `script_location`——Alembic 环境的位置。通常写成相对 `%(here)s` token 的文件系统位置（`%(here)s` 表示配置文件所在处）；也可以是普通相对路径（相对当前目录解释）或绝对路径。

  这是 Alembic 在所有情况下唯一必需的键。`alembic init alembic` 命令生成 .ini 时自动把目录名 `alembic` 放在这里。也可以用特殊变量 `%(here)s`，如 `%(here)s/alembic`。

  为支持把自己打包成 .egg 文件的应用，该值也可以指定为包资源（package resource），此时用 `resource_filename()` 查找文件（0.2.2 新增）。任何含冒号的非绝对 URI 在这里都会被解释为资源名而非文件名。

- `file_template`——生成新迁移文件的命名方案。想让迁移文件名带日期时间前缀（按时间顺序排列）就取消注释给出的值。默认值为 `%(rev)s_%(slug)s`。可用 token 包括：

  - `%(rev)s`——revision id
  - `%(slug)s`——由 revision message 截断得到的字符串
  - `%(epoch)s`——基于创建日期的 epoch 时间戳；用 Python 的 `datetime.timestamp()` 方法生成
  - `%(year)d`、`%(month).2d`、`%(day).2d`、`%(hour).2d`、`%(minute).2d`、`%(second).2d`——创建日期的各部分，默认取 `datetime.datetime.now()`，若同时使用 `timezone` 配置项则按其时区

  `file_template` 还可以包含目录分隔符，把迁移文件组织到子目录。在 `file_template` 中使用目录路径时必须把 `recursive_version_locations` 设为 `true`。例如：

  ```ini
  file_template = %%(year)d/%(month).2d/%(day).2d_%(hour).2d%(minute).2d_%(second).2d_%(rev)s_%(slug)s
  recursive_version_locations = true
  ```

  这会创建按日期组织的迁移文件，结构形如 `versions/2024/12/26_143022_abc123_add_user_table.py`。

  1.18.0 新增：`file_template` 支持目录路径。

- `timezone`——可选时区名（如 `UTC`、`EST5EDT` 等），应用于迁移文件注释与文件名中渲染的时间戳。该选项要求 Python >= 3.9 或安装 `backports.zoneinfo` 与 `tzdata` 库。指定 `timezone` 后，创建日期对象不再取自 `datetime.datetime.now()`，而是生成如下：

  ```python
  datetime.datetime.utcnow().replace(
    tzinfo=datetime.timezone.utc
  ).astimezone(ZoneInfo(<timezone>))
  ```

  1.13.0 版变更：迁移中的时区渲染改用 Python 标准库 `zoneinfo`；之前用的是 `python-dateutil`。

- `truncate_slug_length`——默认 40，"slug" 字段的最大字符数。
- `sqlalchemy.url`——经 SQLAlchemy 连接数据库的 URL。只有 `env.py` 调用它时才生效：在"generic"模板中，`run_migrations_offline()` 函数里的 `config.get_main_option("sqlalchemy.url")` 调用与 `run_migrations_online()` 函数里的 `engine_from_config(prefix="sqlalchemy.")` 调用是引用这个键的地方。如果 SQLAlchemy URL 应来自别处（如环境变量或全局注册表），或迁移环境使用多个数据库 URL，建议开发者修改 `env.py`，用合适的方法获取数据库 URL。
- `revision_environment`——设为 'true' 时表示：生成新 revision 文件时以及运行 `alembic history` 命令时，都无条件运行迁移环境脚本 `env.py`。
- `sourceless`——设为 'true' 时，versions 目录里只存在 .pyc/.pyo 的文件也会被当作版本，从而支持"无源码"版本目录；默认 'false' 时只有 .py 文件被当作版本文件。
- `version_locations`——可选的版本文件位置列表，允许版本同时存在于多个目录。示例见官方文档 Working with Multiple Bases。
- `path_separator`——`version_locations` 与 `prepend_sys_path` 路径列表的分隔符。只适用于 configparser 配置；用 `pyproject.toml` 配置时不需要。示例见同上。
- `recursive_version_locations`——设为 'true' 时，在每个 "version_locations" 目录中递归搜索版本文件（1.10 新增）。
- `output_encoding`——Alembic 把 `script.py.mako` 写成新迁移文件时使用的编码，默认 `'utf-8'`。
- `[loggers]`、`[handlers]`、`[formatters]`、`[logger_*]`、`[handler_*]`、`[formatter_*]`——这些 section 都属于 Python 标准日志配置，机制见 Python 官方文档 Configuration File Format。与数据库连接一样，这些指令由 `env.py` 脚本中的 `logging.config.fileConfig()` 调用直接使用，该脚本可随意修改。

只用单个数据库加 generic 配置起步时，设置好 SQLAlchemy URL 就够了：

```ini
sqlalchemy.url = postgresql://scott:tiger@localhost/test
```

### ini 文件中的字符转义

如前所述，Alembic 的 .ini 文件格式用 Python 的 [ConfigParser](https://docs.python.org/3/library/configparser.html#configparser.ConfigParser) 解析。此过程启用了 ConfigParser 的插值（interpolation）特性，以支持 `%(here)s` token，以及创建自定义 Config 对象时经 `Config.config_args` 参数用户可配置的其他 token。

这意味着任何包含不属于插值变量的百分号的字面字符串都必须双写百分号来转义。也就是说，Python 脚本里的配置值：

```python
my_configuration_value = "some % string"
```

要从 .ini 文件解析，必须写成：

```ini
[alembic]

my_configuration_value = some %% string
```

样例 `alembic.ini` 里就能看到这种转义，如 `file_template`：

```ini
# template used to generate migration file names; The default value is %%(rev)s_%(slug)s
file_template = %%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s
```

上例中实际传给 Alembic 文件生成系统的 `file_template` 是 `%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s`。

> **提示**：Alembic 从 `pyproject.toml` 读取值时同样做百分号插值（见"用 pyproject.toml 做配置"），所以同样的百分号双写步骤也适用于 `pyproject.toml` 中 Alembic 解析的值（如 `file_template`）。

对 SQLAlchemy URL，百分号用来转义语法上有意义的字符，如 `@` 符号和百分号本身。对于 `"P@ssw%rd"` 这样的密码：

```python
>>> my_actual_password = "P@ssw%rd"
```

如 SQLAlchemy 文档所述，放进 URL 的 `@` 与百分号应该用 `urllib.parse.quote_plus` 转义：

```python
>>> import urllib.parse
>>> sqlalchemy_quoted_password = urllib.parse.quote_plus(my_actual_password)
>>> sqlalchemy_quoted_password
'P%40ssw%25rd'
```

这种 URL 引用在 SQLAlchemy 自己的 URL 字符串化中也可见：

```python
>>> from sqlalchemy import URL
>>> URL.create(
...   "some_db", username="scott", password=my_actual_password, host="host"
... ).render_as_string(hide_password=False)
'some_db://scott:P%40ssw%25rd@host'
```

要把上面转义后的密码串 `'P%40ssw%25rd'` 放进做百分号插值的 ConfigParser 文件，`%` 字符需双写：

```python
>>> sqlalchemy_quoted_password.replace("%", "%%")
'P%%40ssw%%25rd'
```

下面这个完整程序可为一组数据库连接细节组装 URL，并展示 configparser 的正确形式，同时演示如何断言这些形式的正确性：

```python
from sqlalchemy import URL, make_url

database_driver = input("database driver? ")
username = input("username? ")
password = input("password? ")
host = input("host? ")
port = input("port? ")
database = input("database? ")

sqlalchemy_url = URL.create(
    drivername=database_driver,
    username=username,
    password=password,
    host=host,
    port=int(port),
    database=database,
)

stringified_sqlalchemy_url = sqlalchemy_url.render_as_string(
    hide_password=False
)

# assert make_url round trip
assert make_url(stringified_sqlalchemy_url) == sqlalchemy_url

print(
    f"The correctly escaped string that can be passed "
    f"to SQLAlchemy make_url() and create_engine() is:"
    f"\n\n     {stringified_sqlalchemy_url!r}\n"
)

percent_replaced_url = stringified_sqlalchemy_url.replace("%", "%%")

# assert percent-interpolated plus make_url round trip
assert make_url(percent_replaced_url % {}) == sqlalchemy_url

print(
    f"The SQLAlchemy URL that can be placed in a ConfigParser "
    f"file such as alembic.ini is:\n\n      "
    f"sqlalchemy.url = {percent_replaced_url}\n"
)
```

这个程序能消除把 SQLAlchemy URL 放进 configparser 文件时的任何歧义：

```text
$ python alembic_pw_script.py
database driver? postgresql+psycopg2
username? scott
password? P@ssw%rd
host? localhost
port? 5432
database? testdb
The correctly escaped string that can be passed to SQLAlchemy make_url() and create_engine() is:

    'postgresql+psycopg2://scott:P%40ssw%25rd@localhost:5432/testdb'

The SQLAlchemy URL that can be placed in a ConfigParser file such as alembic.ini is:

      sqlalchemy.url = postgresql+psycopg2://scott:P%%40ssw%%25rd@localhost:5432/testdb
```

## 用 pyproject.toml 做配置

1.16.0 新增。

由于 `alembic.ini` 包含的选项中有一部分只关乎本地环境中 Python 代码的组织与产出，这些选项也可以放进应用的 `pyproject.toml` 文件，实现符合 [PEP 621](https://peps.python.org/pep-0621/) 的配置。

使用 `pyproject.toml` 并不排斥同时保留 `alembic.ini`，因为**部署**细节（数据库 URL、连接选项、日志）的默认位置仍是 `alembic.ini`。不过连接与日志只被 `env.py` 中的用户代码消费，如果这些配置元素改从应用的其他地方获取，环境完全可以不需要 `alembic.ini`。只存在 `pyproject.toml` 而没有 `alembic.ini` 时，Alembic 照样能正常运行。

从 pyproject 配置起步，最直接的方法是用 `pyproject` 模板：

```text
alembic init --template pyproject alembic
```

输出说明现有的 pyproject 文件被追加了新指令：

```text
Creating directory /path/to/yourproject/alembic...done
Creating directory /path/to/yourproject/alembic/versions...done
Appending to /path/to/yourproject/pyproject.toml...done
Generating /path/to/yourproject/alembic.ini...done
Generating /path/to/yourproject/alembic/env.py...done
Generating /path/to/yourproject/alembic/README...done
Generating /path/to/yourproject/alembic/script.py.mako...done
Please edit configuration/connection/logging settings in
'/path/to/yourproject/pyproject.toml' and
'/path/to/yourproject/alembic.ini' before proceeding.
```

Alembic 的模板运行器会在 `pyproject.toml` 不存在时生成新文件；若存在且不含 alembic 指令则追加。

`pyproject.toml` 里生成的默认 section 与 `alembic.ini` 大体相同，一个可喜的差异是直接支持列表值——`prepend_sys_path` 与 `version_locations` 以列表指定。`%(here)s` token 依然可用，表示 `pyproject.toml` 文件的绝对路径：

```toml
[tool.alembic]
# path to migration scripts
script_location = "%(here)s/alembic"

# template used to generate migration file names; The default value is %%(rev)s_%(slug)s
# Uncomment the line below if you want the files to be prepended with date and time
# file_template = %%(year)d_%(month).2d_%(day).2d_%(hour).2d%(minute).2d-%(rev)s_%(slug)s
# Or organize into date-based subdirectories (requires recursive_version_locations = true)
# file_template = %%(year)d/%(month).2d/%(day).2d_%(hour).2d%(minute).2d_%(second).2d_%(rev)s_%(slug)s

# additional paths to be prepended to sys.path. defaults to the current working directory.
prepend_sys_path = [
    "."
]

# timezone to use when rendering the date within the migration file
# as well as the filename.
# If specified, requires the python>=3.9 or backports.zoneinfo library and tzdata library.
# Any required deps can installed by adding `alembic[tz]` to the pip requirements
# string value is passed to ZoneInfo()
# leave blank for localtime
# timezone =

# max length of characters to apply to the
# "slug" field
# truncate_slug_length = 40

# set to 'true' to run the environment during
# the 'revision' command, regardless of autogenerate
# revision_environment = false

# set to 'true' to allow .pyc and .pyo files without
# a source .py file to be detected as revisions in the
# versions/ directory
# sourceless = false

# version location specification; This defaults
# to <script_location>/versions.  When using multiple version
# directories, initial revisions must be specified with --version-path.
# version_locations = [
#    "%(here)s/alembic/versions",
#    "%(here)s/foo/bar"
# ]

# set to 'true' to search source files recursively
# in each "version_locations" directory
# new in Alembic version 1.10
# recursive_version_locations = false

# the output encoding used when revision files
# are written from script.py.mako
# output_encoding = "utf-8"

# This section defines scripts or Python functions that are run
# on newly generated revision scripts.  See the documentation for further
# detail and examples
# [[tool.alembic.post_write_hooks]]
# format using "black" - use the console_scripts runner,
# against the "black" entrypoint
# name = "black"
# type = "console_scripts"
# entrypoint = "black"
# options = "-l 79 REVISION_SCRIPT_FILENAME"
#
# [[tool.alembic.post_write_hooks]]
# lint with attempts to fix using "ruff" - use the exec runner,
# execute a binary
# name = "ruff"
# type = "exec"
# executable = "%(here)s/.venv/bin/ruff"
# options = "check --fix REVISION_SCRIPT_FILENAME"
```

> **提示**：由于 Alembic 在处理 `pyproject.toml` 值时同样支持 `%(here)s` 等插值 token，适用于 `alembic.ini` 配置变量的百分号转义步骤同样适用于 `pyproject.toml`（即使数据库 URL 不配置在这个文件里）。上面的 `file_template` 样例值中就能看到这种转义。背景见"ini 文件中的字符转义"一节。

该模板的 `alembic.ini` 被截短，只含数据库配置与日志配置：

```ini
[alembic]

# database URL.  This is consumed by the user-maintained env.py script only.
# other means of configuring database URLs may be customized within the env.py
# file.
sqlalchemy.url = driver://user:pass@localhost/dbname

# Logging configuration.  This is also consumed by the user-maintained
# env.py script only.
[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARNING
handlers = console
qualname =

[logger_sqlalchemy]
level = WARNING
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

当 `env.py` 被配置为从 `alembic.ini` 之外的地方获取数据库连接与日志配置时，这个文件可以完全省略。

## 创建迁移脚本

环境就绪后，用 `alembic revision` 创建新版本：

```text
$ alembic revision -m "create account table"
Generating /path/to/yourproject/alembic/versions/1975ea83b712_create_accoun
t_table.py...done
```

生成了新文件 `1975ea83b712_create_account_table.py`。看看文件内部：

```python
"""create account table

Revision ID: 1975ea83b712
Revises:
Create Date: 2011-11-08 11:40:27.089406

"""

# revision identifiers, used by Alembic.
revision = '1975ea83b712'
down_revision = None
branch_labels = None

from alembic import op
import sqlalchemy as sa

def upgrade():
    pass

def downgrade():
    pass
```

文件包含一些头部信息、当前版本与"降级"版本的标识符、基本 Alembic 指令的 import，以及空的 `upgrade()` 与 `downgrade()` 函数。我们的任务就是在 `upgrade()` 和 `downgrade()` 里填上对数据库应用一组变更的指令。通常 `upgrade()` 是必需的，`downgrade()` 只在需要降级能力时才需要——不过加上它多半是明智的。

另一件要注意的事是 `down_revision` 变量：Alembic 由此得知应用迁移的正确顺序。创建下一个版本时，新文件的 `down_revision` 标识符会指向这一个：

```python
# revision identifiers, used by Alembic.
revision = 'ae1027a6acf'
down_revision = '1975ea83b712'
```

Alembic 每次对 `versions/` 目录执行操作时，都会读入全部文件，并根据 `down_revision` 标识符的链接方式构造列表，`down_revision` 为 `None` 代表第一个文件。理论上，若迁移环境有几千个迁移，这会给启动带来一些延迟；但实践中项目本来就应该清理旧迁移（如何清理且保留完整重建当前数据库的能力，见官方 cookbook 的 Building an Up to Date Database from Scratch 一节）。

然后给脚本加一些指令。假设新增一张 `account` 表：

```python
def upgrade():
    op.create_table(
        'account',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('description', sa.Unicode(200)),
    )

def downgrade():
    op.drop_table('account')
```

`create_table()` 与 `drop_table()` 是 Alembic 指令（directive）。Alembic 通过这些指令提供所有基本的数据库迁移操作，它们被设计得尽量简单精简；多数指令不依赖既有的表元数据。它们依赖一个全局"上下文"来指明如何拿到数据库连接（也可能没有——迁移也可以把 SQL/DDL 指令转储到文件），以便执行命令。这个全局上下文同样是在 `env.py` 里搭建的。

所有 Alembic 指令的总览见官方 Operation Reference。

## 跑第一个迁移

现在运行迁移。假设数据库完全是干净的，还没有版本。`alembic upgrade` 命令从数据库当前版本（本例中是 `None`）开始，一路执行升级操作直到给定的目标版本。我们可以指定要升级到 `1975ea83b712`，但多数情况下直接说"最新的"更容易，即 `head`：

```text
$ alembic upgrade head
INFO  [alembic.context] Context class PostgresqlContext.
INFO  [alembic.context] Will assume transactional DDL.
INFO  [alembic.context] Running upgrade None -> 1975ea83b712
```

真痛快！注意屏幕上看到的信息是 `alembic.ini` 里日志配置的结果——把 `alembic` 流记录到控制台（确切地说是标准错误）。

这里发生的过程是：Alembic 先检查数据库里有没有 `alembic_version` 表，没有就创建；在这张表里查找当前版本（若有），然后计算从当前版本到目标版本（本例是 `head`，即已知的 `1975ea83b712`）的路径；接着调用路径上每个文件中的 `upgrade()` 方法到达目标版本。

## 跑第二个迁移

再来一个，好有些东西可玩。再次创建版本文件：

```text
$ alembic revision -m "Add a column"
Generating /path/to/yourapp/alembic/versions/ae1027a6acf_add_a_column.py...
done
```

编辑这个文件，给 `account` 表加一列：

```python
"""Add a column

Revision ID: ae1027a6acf
Revises: 1975ea83b712
Create Date: 2011-11-08 12:37:36.714947

"""

# revision identifiers, used by Alembic.
revision = 'ae1027a6acf'
down_revision = '1975ea83b712'

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('account', sa.Column('last_transaction_date', sa.DateTime))

def downgrade():
    op.drop_column('account', 'last_transaction_date')
```

再次运行到 `head`：

```text
$ alembic upgrade head
INFO  [alembic.context] Context class PostgresqlContext.
INFO  [alembic.context] Will assume transactional DDL.
INFO  [alembic.context] Running upgrade 1975ea83b712 -> ae1027a6acf
```

我们已把 `last_transaction_date` 列加进数据库。

## 部分版本标识符

任何需要显式引用版本号的地方，都可以用部分号码。只要它能唯一标识该版本，就可在任何命令中任何接受版本号的地方使用：

```text
$ alembic upgrade ae1
```

上面用 `ae1` 指代版本 `ae1027a6acf`。若有多个版本以该前缀开头，Alembic 会停下来告知。

## 相对迁移标识符

相对升降级也支持。从当前位置前进两个版本，可给十进制值 "+N"：

```text
$ alembic upgrade +2
```

降级接受负值：

```text
$ alembic downgrade -1
```

相对标识符也可以基于特定版本。例如升级到版本 `ae1027a6acf` 再加两步：

```text
$ alembic upgrade ae10+2
```

## 获取信息

有了几个版本，就能了解一些状态信息。

首先查看当前版本：

```text
$ alembic current
INFO  [alembic.context] Context class PostgresqlContext.
INFO  [alembic.context] Will assume transactional DDL.
Current revision for postgresql://scott:XXXXX@localhost/test: 1975ea83b712 -> ae1027a6acf (head), Add a column
```

只有数据库的版本标识与 head 版本一致时才显示 `head`。

也可以用 `alembic history` 查看历史；`--verbose` 选项（`history`、`current`、`heads`、`branches` 等多个命令都接受）会显示每个版本的完整信息：

```text
$ alembic history --verbose

Rev: ae1027a6acf (head)
Parent: 1975ea83b712
Path: /path/to/yourproject/alembic/versions/ae1027a6acf_add_a_column.py

    add a column

    Revision ID: ae1027a6acf
    Revises: 1975ea83b712
    Create Date: 2014-11-20 13:02:54.849677

Rev: 1975ea83b712
Parent: <base>
Path: /path/to/yourproject/alembic/versions/1975ea83b712_add_account_table.py

    create account table

    Revision ID: 1975ea83b712
    Revises:
    Create Date: 2014-11-20 13:02:46.257104
```

### 查看历史区间

用 `alembic history` 的 `-r` 选项还能查看历史的各种切片。`-r` 参数接受 `[start]:[end]`，两端可以是版本号、`head`/`heads`/`base` 等符号、`current`（指定当前版本），`[start]` 还可用负的相对区间、`[end]` 可用正的相对区间：

```text
$ alembic history -r1975ea:ae1027
```

从三个版本之前到当前迁移的相对区间——它会调用迁移环境查数据库取当前迁移：

```text
$ alembic history -r-3:current
```

> **注意**：如上所示，使用以负数（短横线）开头的区间时，由于 [argparse 的一个 bug](https://github.com/python/cpython/issues/53580)，要么用不带空格的 `-r-<base>:<head>` 语法：
>
> ```text
> $ alembic history -r-3:current
> ```
>
> 要么用 `--rev-range` 时加等号：
>
> ```text
> $ alembic history --rev-range=-3:current
> ```
>
> 参数名后有空格时，引号或转义符号都无效。

查看从 1975 到 head 的所有版本：

```text
$ alembic history -r1975ea:
```

## 降级

演示一下降级回起点：调用 `alembic downgrade` 退回 Alembic 所谓的 `base`：

```text
$ alembic downgrade base
INFO  [alembic.context] Context class PostgresqlContext.
INFO  [alembic.context] Will assume transactional DDL.
INFO  [alembic.context] Running downgrade ae1027a6acf -> 1975ea83b712
INFO  [alembic.context] Running downgrade 1975ea83b712 -> None
```

退回一无所有——再升回去：

```text
$ alembic upgrade head
INFO  [alembic.context] Context class PostgresqlContext.
INFO  [alembic.context] Will assume transactional DDL.
INFO  [alembic.context] Running upgrade None -> 1975ea83b712
INFO  [alembic.context] Running upgrade 1975ea83b712 -> ae1027a6acf
```

## 下一步

绝大多数 Alembic 环境都会重度使用"自动生成（autogenerate）"特性。请继续阅读官方教程的下一节 Auto Generating Migrations。

---

> **来源**：本文翻译自 Alembic 官方文档 [Tutorial](https://alembic.sqlalchemy.org/en/latest/tutorial.html)（Alembic 1.20.0），作者 Mike Bayer 及 Alembic/SQLAlchemy 项目贡献者，许可 MIT。抓取于 2026-09-13。
> 完整性说明：原文各节全部收录（迁移环境、创建环境、编辑 .ini、ini 字符转义、pyproject.toml 配置、创建迁移脚本、第一/第二个迁移、部分与相对版本标识符、获取信息与历史区间、降级、下一步）；文内指向 alembic 文档其他页面的链接保留为文字说明。
