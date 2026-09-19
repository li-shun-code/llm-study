---
title: pathlib 常用路径操作
source_url: https://docs.python.org/zh-cn/3/library/pathlib.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 23
group: 文件与数据格式
---
`pathlib` 把「路径」从字符串变成了对象：不再手写 `os.path.join(os.path.dirname(x), ...)`，而是 `p.parent / "out" / p.with_suffix(".json")`。它跨平台（同一段代码在 Windows 与 Unix 上都能得到正确的分隔符），并且能直接 `open()`、`read_text()`、`glob()`——路径对象本身就是通向文件的句柄。

官方模块页有上千行参考内容，日常只会用到其中十几个操作。本篇按任务分组讲清最常用的十五个操作，完整的类与方法参考放在文末折叠段。前置：《文件 IO》。

## 拿到 Path 对象：一切的起点

```python
from pathlib import Path

p = Path("data/a.txt")             # 相对路径
q = Path("/var/log/app.log")       # 绝对路径
r = Path.home() / "notes"          # 用户主目录，等价 os.path.expanduser("~/notes")
c = Path.cwd()                     # 当前工作目录
```

模块级函数 `Path()` 会按当前系统返回 `PosixPath` 或 `WindowsPath`。**不确定用哪个类时，就用 `Path`**。只想处理路径字符串而不碰文件系统时用 `PurePath`（例如在 Linux 上解析 Windows 路径：`PureWindowsPath("C:/Users/x/doc.txt")`）。

## 拆解与拼装

```python
from pathlib import Path

p = Path("data/archive/a.txt")

print(p.name)          # a.txt         最终成分
print(p.stem)          # a             去掉后缀的名字
print(p.suffix)        # .txt          后缀（多个点只算最后一个：'a.tar.gz' 的 suffix 是 '.gz'）
print(Path("data/a.tar.gz").suffixes)   # ['.tar', '.gz'] 需要全部后缀时用它
print(p.parent)        # data/archive  上一级目录
print(p.parts)         # ('data', 'archive', 'a.txt')  逐段拆开，可迭代
print(p.is_absolute()) # False
```

拼装用 `/` 运算符（不是字符串相加）：

```python
from pathlib import Path

base = Path("data")
target = base / "archive" / "a.txt"        # data/archive/a.txt
print(base / Path("sub/x.log"))            # data/sub/x.log
print(target.with_name("b.log"))           # 换掉文件名：data/archive/b.log
print(target.with_suffix(".csv"))          # 换掉后缀：data/archive/a.csv
print(target.with_stem("report"))          # 换掉名字主体：data/archive/report.txt（3.9+）
```

若右侧是字符串形式的绝对路径，`/` 会**丢弃左侧**（与 `os.path.join()` 同规则）：`Path("data") / "/tmp/x" == Path("/tmp/x")`。这是拼接用户传入路径时的隐患，先 `is_absolute()` 判断。

其他常用变形：

```python
from pathlib import Path

print(Path("data/./a//b").as_posix())        # data/a/b      多余斜杠与 '.' 被消除
print(Path("../data/a.txt").resolve())        # 变成绝对路径并跟随符号链接
print(Path("data/archive/a.txt").relative_to("data"))   # archive/a.txt —— 求相对路径
```

`PurePath.normalize()`（3.11+）可以在不访问文件系统的前提下折叠 `..` 与 `.`；`resolve()` 则会真的去解析符号链接，两者别混用。

## 查询：存在、类型、大小、时间

```python
from pathlib import Path

Path("data").mkdir(exist_ok=True)
Path("data/a.txt").write_text("x\n", encoding="utf-8")
p = Path("data/a.txt")

print(p.exists())        # 是否存在（文件或目录都行）
print(p.is_file())       # 是常规文件
print(p.is_dir())        # 是目录
print(p.is_symlink())    # 是符号链接（即使已断链也为真）

st = p.stat()
print(st.st_size)                       # 字节数
print(st.st_mtime)                       # 修改时间（POSIX 时间戳）
print(oct(st.st_mode)[-3:])             # 权限位，例如 644
```

`exists()`/`is_file()`/`is_dir()` 都会跟随符号链接；传 `follow_symlinks=False` 可以只看链接本身。要「一次系统调用拿到多项信息」用 `p.stat()`；只想问不关心细节时用上面几个布尔方法更清楚。

比较新旧、判断是否需要重跑缓存，标准写法是：

```python
from pathlib import Path


def needs_rebuild(source: Path, output: Path) -> bool:
    if not output.exists():
        return True
    return source.stat().st_mtime > output.stat().st_mtime
```

## 读写文件

路径对象自己就能开关文件，不必再 `open(str(p))`：

```python
from pathlib import Path

Path("data").mkdir(exist_ok=True)
p = Path("data/a.txt")

p.write_text("第一行\n第二行\n", encoding="utf-8")     # 一次性覆盖写入
print(p.read_text(encoding="utf-8"), end="")           # 一次性读成字符串

with p.open("r", encoding="utf-8") as f:                # 逐行读，适合大文件
    for line in f:
        print(">", line, end="")

with p.open("a", encoding="utf-8") as f:                # 追加写入
    f.write("第三行\n")

raw = p.read_bytes()                                    # 二进制读（图片、pickle）
print(len(raw), "字节")
p.write_bytes(b"\x00\x01")                              # 二进制写
```

**永远显式写 `encoding="utf-8"`。** 不传时用的是平台默认编码，同一份脚本在 Windows（常为 cp936/gbk）和 Linux（常为 utf-8）上行为不同，是中文文本最常见的乱码来源，详见《文件 IO》。

需要 JSON、CSV 之类的格式，用 `with p.open(...)` 交给对应模块处理（见《JSON 与时间日期》）。

## 遍历与匹配

```python
from pathlib import Path

base = Path("data")                    # 上一步的目录里有 a.txt、b.md
for child in sorted(base.iterdir()):   # 只列一层
    print(child.name, child.is_dir())

for path in sorted(base.glob("*.txt")):        # 一层内按模式匹配
    print(path)

for path in sorted(base.rglob("*.md")):        # 递归匹配所有层级
    print(path)

for path in sorted(base.glob("**/*.json")):    # ** 表示任意层级，等价 rglob("*.json")
    print(path)
```

需要「同时知道目录、子目录、文件」时用 `walk()`（3.12 起，语义同 `os.walk()`，但产出的是 `Path`）：

```python
from pathlib import Path

for dirpath, dirnames, filenames in Path(".").walk():
    print(f"{dirpath} 有 {len(filenames)} 个文件")
    dirnames[:] = [d for d in dirnames if d != "__pycache__"]   # 原地改可跳过子树
```

判断单个路径是否匹配模式用 `match()`（从**右侧**开始比对，`p.match("*.txt")` 只看文件名），或更严格的 `full_match()`（3.13+，必须整条路径匹配）：

```python
from pathlib import Path

p = Path("data/report.txt")
print(p.match("*.txt"), p.match("data/*.txt"), p.full_match("data/*.txt"))
# True True True
```

`glob()` 与 `rglob()` 的区别只是后者等价于 `glob("**/" + pattern)`。它们都不跟随指向目录的符号链接（3.13 起可用 `recurse_symlinks=True` 打开）。

## 创建、复制、移动、删除

```python
from pathlib import Path

Path("data/reports").mkdir(parents=True, exist_ok=True)   # 递归建目录，已存在不报错
Path("data/reports/empty.md").touch(exist_ok=True)        # 建空文件（或只更新时间）

src = Path("data/reports/empty.md")
dst = Path("data/archive/empty.md")
dst.parent.mkdir(parents=True, exist_ok=True)

copied = src.copy(dst)          # 3.14 起提供 copy / copy_into / move / move_into
print(copied, copied.exists(), src.exists())      # data/archive/empty.md True True

src.move(Path("data/reports/moved.md"))           # 移动后原路径就不存在了
print(src.exists())                               # False

dst.unlink(missing_ok=True)                       # 删除文件，不存在也不报错
# dst.parent.rmdir()   只能删空目录；非空目录用 shutil.rmtree()
```

要点：

- 建目录一定写 `parents=True, exist_ok=True`，否则路径缺层或多跑一次都会抛异常。
- `unlink()` 删文件、`rmdir()` 删**空**目录；递归删除请用 `shutil.rmtree()`，pathlib 有意不提供「一键删树」，因为太危险。
- `copy()`/`move()`（3.14+）替代了以前手写 `shutil.copy2()` 的样板；更早的版本上仍应直接用 `shutil`。改名或原子替换用 `replace(dst)`，目标已存在时会被覆盖。
- 符号链接用 `symlink_to(target)`；Windows 上可能需要管理员权限或开发者模式。

## 常见坑

**1. 忘记编码。** `read_text()`/`write_text()` 不传 `encoding` 时依赖平台默认值，跨机器必然出问题。

**2. `mkdir()` 不带 `exist_ok`。** 第二次运行就抛 `FileNotFoundError`（缺父目录）或 `FileExistsError`（目录已在）。

**3. 把 Path 当字符串用。** 需要字符串时（`subprocess.run` 的某些参数、`requests` 的 URL、拼进 SQL）用 `str(p)` 或 `os.fspath(p)`。反过来，`open()`、`shutil.*` 等大多数接口都直接接受 `PathLike`，不必手动转。

**4. `p / user_input` 是注入面。** 用户传入 `/etc/passwd` 这样的绝对路径会让前面的基底全部失效；对外部输入要先校验（例如要求 `is_relative_to(base)`，3.9+）。

**5. `glob` 的顺序不保证。** 不同文件系统返回的目录顺序不同，跨机器结果会漂移。需要稳定输出就 `sorted(p.glob(...))`。

**6. `with_suffix()` 会覆盖已有后缀。** `Path("a.tar.gz").with_suffix(".zip")` 得到 `a.tar.zip`，不是 `a.zip`。多后缀文件名请自己拼：`p.with_name(p.name.rsplit(".", 1)[0] + ".zip")`。

**7. 混淆 `resolve()` 与 `absolute()`。** 前者跟随符号链接、要求路径可解析（3.6+ 可用 `strict=False` 容忍不存在），后者只做字符串级拼接。做「两个路径是否同一文件」的比较应当用 `resolve()`，或更可靠地比较 `stat()` 的 `st_dev`/`st_ino`。

**8. 忘记 pathlib 不做路径规范化。** `Path("a/../b")` 的 `parts` 仍是 `('a', '..', 'b')`，`..` 不会被提前折叠（因为 `a` 可能是符号链接）。需要纯字面折叠用 `normalize()`。

## 最小项目：给整个目录做扩展名统计并落地报告

```python
from datetime import datetime, timezone
from collections import Counter
from pathlib import Path

root = Path("data")
root.mkdir(exist_ok=True)
(root / "a.txt").write_text("1\n", encoding="utf-8")
(root / "b.md").write_text("2\n", encoding="utf-8")
(root / "c.txt").write_text("333\n", encoding="utf-8")

summary = Counter()
for path in sorted(root.rglob("*")):
    if path.is_file():
        key = path.suffix.lower() or "(无后缀)"
        summary[key] += 1

report_lines = [
    f"# 目录统计：{root.resolve()}",
    f"生成时间：{datetime.now(timezone.utc).isoformat(timespec='seconds')}",
    "",
    *[f"- {ext}: {n} 个文件" for ext, n in summary.most_common()],
]

out = root / "report.md"
out.write_text("\n".join(report_lines) + "\n", encoding="utf-8")
print(out.read_text(encoding="utf-8"))
```

这个脚本用到了本篇的全部三类操作：遍历（`rglob`）、查询（`is_file`、`suffix`）、读写（`write_text`/`read_text`）。把它改成统计行数、找最大文件、批量转换编码，都只是替换循环体里的一两行。

## 延伸阅读

- 模块页完整参考：<https://docs.python.org/zh-cn/3/library/pathlib.html>
- `os.path` 与 `shutil`：<https://docs.python.org/zh-cn/3/library/os.path.html>、<https://docs.python.org/zh-cn/3/library/shutil.html>
- 站内相邻文章：《文件 IO》《JSON 与时间日期》《collections 常用容器：Counter、defaultdict 与 deque》《环境与依赖管理》

## 参考：pathlib 完整文档（译自官方库文档）

下面是官方模块页的完整参考（纯路径 / 具体路径 / 模式语言 / 与 `os.path` 的对照表），保留全部方法签名与说明，需要查参数时展开。

<details>
<summary>展开：pathlib 类层次与全部方法参考</summary>

该模块提供表示文件系统路径的类，其语义适用于不同的操作系统。路径类被分为提供纯计算操作而没有 I/O 的 纯路径，以及从纯路径继承而来但提供 I/O 操作的 具体路径。


如果以前从未用过此模块，或不确定哪个类适合完成任务，那要用的可能就是 `Path`。它在运行代码的平台上实例化为 具体路径。

在一些用例中纯路径很有用，例如：

1.  如果你想要在 Unix 设备上操作 Windows 路径（或者相反）。你无法在 Unix 上实例化一个 `WindowsPath`，但是你可以实例化 `PureWindowsPath`。
    
2.  你只想操作路径但不想实际访问操作系统。在这种情况下，实例化一个纯路径是有用的，因为它们没有任何访问操作系统的操作。
    

参见

[**PEP 428**](https://peps.python.org/pep-0428/): pathlib 模块 -- 面向对象的文件系统路径。

参见

对于底层的路径字符串操作，你也可以使用 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 模块。

### 基础使用

导入主类:

```plain
>>> from pathlib import Path
```

列出子目录:

```plain
>>> p = Path('.')
>>> [x for x in p.iterdir() if x.is_dir()]
[PosixPath('.hg'), PosixPath('docs'), PosixPath('dist'),
 PosixPath('__pycache__'), PosixPath('build')]
```

列出当前目录树下的所有 Python 源代码文件:

```plain
>>> list(p.glob('**/*.py'))
[PosixPath('test_pathlib.py'), PosixPath('setup.py'),
 PosixPath('pathlib.py'), PosixPath('docs/conf.py'),
 PosixPath('build/lib/pathlib.py')]
```

在目录树中移动:

```plain
>>> p = Path('/etc')
>>> q = p / 'init.d' / 'reboot'
>>> q
PosixPath('/etc/init.d/reboot')
>>> q.resolve()
PosixPath('/etc/rc.d/init.d/halt')
```

查询路径的属性:

```plain
>>> q.exists()
True
>>> q.is_dir()
False
```

打开一个文件:

```plain
>>> with q.open() as f: f.readline()
...
'#!/bin/bash\\n'
```

### 异常

_exception_ pathlib.UnsupportedOperation

一个继承自 [`NotImplementedError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 的异常，当在路径对象上调用不受支持的操作时它将被引发。

### 纯路径

纯路径对象提供了不实际访问文件系统的路径处理操作。有三种方式来访问这些类，也是不同的风格：

*class* `pathlib.PurePath(*pathsegments)`

一个通用的类，代表当前系统的路径风格 (实例化为 `PurePosixPath` 或者 `PureWindowsPath`):

```plain
>>> PurePath('setup.py')      # 在 Unix 机器上运行
PurePosixPath('setup.py')
```

_pathsegments_ 的每个元素既可以是代表一个路径段的字符串，也可以是实现了 [`os.PathLike`](https://docs.python.org/zh-cn/3/library/os.html) 接口的对象，其中 [`__fspath__()`](https://docs.python.org/zh-cn/3/library/os.html) 方法返回一个字符串，例如另一个路径对象:

```plain
>>> PurePath('foo', 'some/path', 'bar')
PurePosixPath('foo/some/path/bar')
>>> PurePath(Path('foo'), Path('bar'))
PurePosixPath('foo/bar')
```

当 _pathsegments_ 为空的时候，假定为当前目录:

```plain
>>> PurePath()
PurePosixPath('.')
```

如果某个段为绝对路径，则其前面的所有段都会被忽略 (类似 [`os.path.join()`](https://docs.python.org/zh-cn/3/library/os.path.html)):

```plain
>>> PurePath('/etc', '/usr', 'lib64')
PurePosixPath('/usr/lib64')
>>> PureWindowsPath('c:/Windows', 'd:bar')
PureWindowsPath('d:bar')
```

在 Windows 上，当遇到带根符号的路径段 (如 `r'\foo'`) 时驱动器将不会被重置:

```plain
>>> PureWindowsPath('c:/Windows', '/Program Files')
PureWindowsPath('c:/Program Files')
```

假斜杠和单个点号会被消除，但双点号 (`'..'`) 和打头的双斜杠 (`'//'`) 不会，因为这会出于各种原因改变路径的实际含义 (例如符号链接、UNC 路径等):

```plain
>>> PurePath('foo//bar')
PurePosixPath('foo/bar')
>>> PurePath('//foo/bar')
PurePosixPath('//foo/bar')
>>> PurePath('foo/./bar')
PurePosixPath('foo/bar')
>>> PurePath('foo/../bar')
PurePosixPath('foo/../bar')
```

（一个简单天真的做法是让 `PurePosixPath('foo/../bar')` 等同于 `PurePosixPath('bar')`，如果 `foo` 是一个指向其他目录的符号链接那么这个做法就将出错）

纯路径对象实现了 [`os.PathLike`](https://docs.python.org/zh-cn/3/library/os.html) 接口，允许它们在任何接受此接口的地方使用。

*class* `pathlib.PurePosixPath(*pathsegments)`

一个 `PurePath` 的子类，路径风格不同于 Windows 文件系统:

```plain
>>> PurePosixPath('/etc/hosts')
PurePosixPath('/etc/hosts')
```

_pathsegments_ 参数的指定和 `PurePath` 相同。

*class* `pathlib.PureWindowsPath(*pathsegments)`

`PurePath` 的一个子类，此路径风格代表 Windows 文件系统路径，包括 [UNC paths](https://en.wikipedia.org/wiki/Path_(computing)#UNC):

```plain
>>> PureWindowsPath('c:/', 'Users', 'Ximénez')
PureWindowsPath('c:/Users/Ximénez')
>>> PureWindowsPath('//server/share/file')
PureWindowsPath('//server/share/file')
```

_pathsegments_ 参数的指定和 `PurePath` 相同。

无论你正运行什么系统，你都可以实例化这些类，因为它们提供的操作不做任何系统调用。

#### 通用性质

路径是不可变并且 [可哈希的](https://docs.python.org/zh-cn/3/glossary.html)。 相同风格的路径可以排序和比较。 这些特性会尊重对应风格的大小写转换语义:

```plain
>>> PurePosixPath('foo') == PurePosixPath('FOO')
False
>>> PureWindowsPath('foo') == PureWindowsPath('FOO')
True
>>> PureWindowsPath('FOO') in { PureWindowsPath('foo') }
True
>>> PureWindowsPath('C:') < PureWindowsPath('d:')
True
```

不同风格的路径比较得到不等的结果并且无法被排序:

```plain
>>> PureWindowsPath('foo') == PurePosixPath('foo')
False
>>> PureWindowsPath('foo') < PurePosixPath('foo')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: '<' not supported between instances of 'PureWindowsPath' and 'PurePosixPath'
```

#### 运算符

斜杠操作符可以帮助创建子路径，如 [`os.path.join()`](https://docs.python.org/zh-cn/3/library/os.path.html)。 如果参数为一个绝对路径，则之前的路径会被忽略。 在 Windows 上，当参数为一个带根符号的相对路径 (如 `r'\foo'`) 时驱动器将不会被重置:

```plain
>>> p = PurePath('/etc')
>>> p
PurePosixPath('/etc')
>>> p / 'init.d' / 'apache2'
PurePosixPath('/etc/init.d/apache2')
>>> q = PurePath('bin')
>>> '/usr' / q
PurePosixPath('/usr/bin')
>>> p / '/an_absolute_path'
PurePosixPath('/an_absolute_path')
>>> PureWindowsPath('c:/Windows', '/Program Files')
PureWindowsPath('c:/Program Files')
```

路径对象可用于任何接受 [`os.PathLike`](https://docs.python.org/zh-cn/3/library/os.html) 接口实现的地方:

```plain
>>> import os
>>> p = PurePath('/etc')
>>> os.fspath(p)
'/etc'
```

路径的字符串表示法为它自己原始的文件系统路径（以原生形式，例如在 Windows 下使用反斜杠）。你可以传递给任何需要字符串形式路径的函数:

```plain
>>> p = PurePath('/etc')
>>> str(p)
'/etc'
>>> p = PureWindowsPath('c:/Program Files')
>>> str(p)
'c:\\\\Program Files'
```

类似地，在路径上调用 [`bytes`](https://docs.python.org/zh-cn/3/library/stdtypes.html) 将原始文件系统路径作为字节对象给出，就像被 [`os.fsencode()`](https://docs.python.org/zh-cn/3/library/os.html) 编码一样:

```plain
>>> bytes(p)
b'/etc'
```

备注

只推荐在 Unix 下调用 [`bytes`](https://docs.python.org/zh-cn/3/library/stdtypes.html)。在 Windows， unicode 形式是文件系统路径的规范表示法。

#### 访问个别部分

为了访问路径独立的部分 （组件），使用以下特征属性：

PurePath.parts

一个元组，可以访问路径的多个组件:

```plain
>>> p = PurePath('/usr/bin/python3')
>>> p.parts
('/', 'usr', 'bin', 'python3')

>>> p = PureWindowsPath('c:/Program Files/PSF')
>>> p.parts
('c:\\\\', 'Program Files', 'PSF')
```

（注意盘符和本地根目录是如何重组的）

#### 方法和特征属性

纯路径提供以下方法和特征属性：

PurePath.parser

用于底层路径解析与合并的 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 模块的实现: `posixpath` 或 `ntpath`。

PurePath.drive

一个表示驱动器盘符或命名的字符串，如果存在:

```plain
>>> PureWindowsPath('c:/Program Files/').drive
'c:'
>>> PureWindowsPath('/Program Files/').drive
''
>>> PurePosixPath('/etc').drive
''
```

UNC 分享也被认作驱动器:

```plain
>>> PureWindowsPath('//host/share/foo.txt').drive
'\\\\\\\\host\\\\share'
```

PurePath.root

一个表示（本地或全局）根的字符串，如果存在:

```plain
>>> PureWindowsPath('c:/Program Files/').root
'\\\\'
>>> PureWindowsPath('c:Program Files/').root
''
>>> PurePosixPath('/etc').root
'/'
```

UNC 分享一样拥有根:

```plain
>>> PureWindowsPath('//host/share').root
'\\\\'
```

如果路径以超过两个连续斜杠打头，`PurePosixPath` 会合并它们:

```plain
>>> PurePosixPath('//etc').root
'//'
>>> PurePosixPath('///etc').root
'/'
>>> PurePosixPath('////etc').root
'/'
```

备注

此行为符合 _The Open Group Base Specifications Issue 6_, paragraph [4.11 Pathname Resolution](https://pubs.opengroup.org/onlinepubs/009695399/basedefs/xbd_chap04.html#tag_04_11):

_"以连续两个斜杠打头的路径名可能会以具体实现所定义的方式被解读，但是两个以上的前缀斜杠则应当被当作一个斜杠来处理。"_

PurePath.anchor

驱动器和根的联合:

```plain
>>> PureWindowsPath('c:/Program Files/').anchor
'c:\\\\'
>>> PureWindowsPath('c:Program Files/').anchor
'c:'
>>> PurePosixPath('/etc').anchor
'/'
>>> PureWindowsPath('//host/share').anchor
'\\\\\\\\host\\\\share\\\\'
```

PurePath.parents

提供访问此路径的逻辑祖先的不可变序列:

```plain
>>> p = PureWindowsPath('c:/foo/bar/setup.py')
>>> p.parents[0]
PureWindowsPath('c:/foo/bar')
>>> p.parents[1]
PureWindowsPath('c:/foo')
>>> p.parents[2]
PureWindowsPath('c:/')
```

PurePath.parent

此路径的逻辑父路径:

```plain
>>> p = PurePosixPath('/a/b/c/d')
>>> p.parent
PurePosixPath('/a/b/c')
```

你不能超过一个 anchor 或空路径:

```plain
>>> p = PurePosixPath('/')
>>> p.parent
PurePosixPath('/')
>>> p = PurePosixPath('.')
>>> p.parent
PurePosixPath('.')
```

备注

这是一个单纯的词法操作，因此有以下行为:

```plain
>>> p = PurePosixPath('foo/..')
>>> p.parent
PurePosixPath('foo')
```

如果你想要向上遍历任意文件系统路径，建议首先调用 `Path.resolve()` 以便解析符号链接并消除 `".."` 部分。

PurePath.name

一个表示最后路径组件的字符串，排除了驱动器与根目录，如果存在的话:

```plain
>>> PurePosixPath('my/library/setup.py').name
'setup.py'
```

UNC 驱动器名不被考虑:

```plain
>>> PureWindowsPath('//some/share/setup.py').name
'setup.py'
>>> PureWindowsPath('//some/share').name
''
```

PurePath.suffix

最后一个路径组件中以点分割的后一部分（如果有）

```plain
>>> PurePosixPath('my/library/setup.py').suffix
'.py'
>>> PurePosixPath('my/library.tar.gz').suffix
'.gz'
>>> PurePosixPath('my/library').suffix
''
```

这通常被称作文件扩展名。

PurePath.suffixes

由路径后缀组成的列表，经常被称作文件扩展名:

```plain
>>> PurePosixPath('my/library.tar.gar').suffixes
['.tar', '.gar']
>>> PurePosixPath('my/library.tar.gz').suffixes
['.tar', '.gz']
>>> PurePosixPath('my/library').suffixes
[]
```

PurePath.stem

最后一个路径组件，除去后缀:

```plain
>>> PurePosixPath('my/library.tar.gz').stem
'library.tar'
>>> PurePosixPath('my/library.tar').stem
'library'
>>> PurePosixPath('my/library').stem
'library'
```

`PurePath.as_posix()`

返回使用正斜杠 (`/`) 的路径字符串:

```plain
>>> p = PureWindowsPath('c:\\\\windows')
>>> str(p)
'c:\\\\windows'
>>> p.as_posix()
'c:/windows'
```

`PurePath.is_absolute()`

返回此路径是否为绝对路径。如果路径同时拥有驱动器符与根路径（如果风格允许）则将被认作绝对路径:

```plain
>>> PurePosixPath('/a/b').is_absolute()
True
>>> PurePosixPath('a/b').is_absolute()
False

>>> PureWindowsPath('c:/a/b').is_absolute()
True
>>> PureWindowsPath('/a/b').is_absolute()
False
>>> PureWindowsPath('c:').is_absolute()
False
>>> PureWindowsPath('//some/share').is_absolute()
True
```

`PurePath.is_relative_to(other)`

返回此路径是否相对于 _other_ 的路径。

```plain
>>> p = PurePath('/etc/passwd')
>>> p.is_relative_to('/etc')
True
>>> p.is_relative_to('/usr')
False
```

此方法是基于字符串的；它不会访问文件系统也不会对 "`..`" 部分进行特殊处理。 以下代码是等价的：

```plain
>>> u = PurePath('/usr')
>>> u == p or u in p.parents
False
```

从 3.12 版起已弃用，已在 3.14 版中移除: 传入附加参数的做法已被弃用；如果提供了附加参数，它们将与 _other_ 合并。

`PurePath.is_reserved()`

在 `PureWindowsPath` 上：路径在 Windows 下被视为保留名称时返回 `True`，否则返回 `False`。在 `PurePosixPath` 上：永远返回 `False`。

从 3.13 版起已弃用，将在 3.15 版中移除：本方法已弃用；请改用 [`os.path.isreserved()`](https://docs.python.org/zh-cn/3/library/os.path.html) 检测 Windows 下的保留路径。

`PurePath.joinpath(*pathsegments)`

调用此方法等同于依次将路径与给定的每个 _pathsegments_ 组合到一起:

```plain
>>> PurePosixPath('/etc').joinpath('passwd')
PurePosixPath('/etc/passwd')
>>> PurePosixPath('/etc').joinpath(PurePosixPath('passwd'))
PurePosixPath('/etc/passwd')
>>> PurePosixPath('/etc').joinpath('init.d', 'apache2')
PurePosixPath('/etc/init.d/apache2')
>>> PureWindowsPath('c:').joinpath('/Program Files')
PureWindowsPath('c:/Program Files')
```

`PurePath.full_match(pattern, *, _case_sensitive=None_)`

将此路径与所提供的 glob 样式匹配。如果匹配成功，则返回 `True`，否则返回 `False`。 例如:

```plain
>>> PurePath('a/b.py').full_match('a/*.py')
True
>>> PurePath('a/b.py').full_match('*.py')
False
>>> PurePath('/a/b/c.py').full_match('/a/**')
True
>>> PurePath('/a/b/c.py').full_match('**/*.py')
True
```

参见

模式语言 文档。

与其他方法一样，是否大小写敏感遵循平台的默认规则:

```plain
>>> PurePosixPath('b.py').full_match('*.PY')
False
>>> PureWindowsPath('b.py').full_match('*.PY')
True
```

将 _case_sensitive_ 设为 `True` 或 `False` 来覆盖此行为。

`PurePath.match(pattern, *, _case_sensitive=None_)`

将此路径与所提供的非递归 glob 样式匹配。 如果匹配成功，则返回 `True`，否则返回 `False`。

此方法与 `full_match()` 类似，但不允许空模式 (将引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html))，也不支持递归通配符 "`**`" (将视为非递归的 "`*`")，并且如果提供了一个相对格式，则将从右开始匹配:

```plain
>>> PurePath('a/b.py').match('*.py')
True
>>> PurePath('/a/b/c.py').match('b/*.py')
True
>>> PurePath('/a/b/c.py').match('a/*.py')
False
```

`PurePath.relative_to(other, _walk_up=False_)`

计算此路径相对于 _other_ 所表示路径的版本。 如果不可计算，则引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html):

```plain
>>> p = PurePosixPath('/etc/passwd')
>>> p.relative_to('/')
PurePosixPath('etc/passwd')
>>> p.relative_to('/etc')
PurePosixPath('passwd')
>>> p.relative_to('/usr')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "pathlib.py", line 941, in relative_to
    raise ValueError(error_message.format(str(self), str(formatted)))
ValueError: '/etc/passwd' is not in the subpath of '/usr' OR one path is relative and the other is absolute.
```

当 _walk_up_ 为（默认的）假值时，路径必须以 _other_ 开始。 当参数为真值时，可能会添加 `..` 条目以形成相对路径。 在所有其他情况下，例如路径引用了不同的驱动器，则会引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。:

```plain
>>> p.relative_to('/usr', walk_up=True)
PurePosixPath('../etc/passwd')
>>> p.relative_to('foo', walk_up=True)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "pathlib.py", line 941, in relative_to
    raise ValueError(error_message.format(str(self), str(formatted)))
ValueError: '/etc/passwd' is not on the same drive as 'foo' OR one path is relative and the other is absolute.
```

警告

该函数是 `PurePath` 的一部分并适用于字符串。 它不会检查或访问下层的文件结构。 这可能会影响 _walk_up_ 选项因为它假定路径中不存在符号链接；如果需要处理符号链接请先调用 `resolve()`。

从 3.12 版起已弃用，已在 3.14 版中移除: 传入附加位置参数的做法已被弃用；如果提供的话，它们将与 _other_ 合并。

`PurePath.with_name(name)`

返回一个新的路径并修改 `name`。如果原本路径没有 name，ValueError 被抛出:

```plain
>>> p = PureWindowsPath('c:/Downloads/pathlib.tar.gz')
>>> p.with_name('setup.py')
PureWindowsPath('c:/Downloads/setup.py')
>>> p = PureWindowsPath('c:/')
>>> p.with_name('setup.py')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "/home/antoine/cpython/default/Lib/pathlib.py", line 751, in with_name
    raise ValueError("%r has an empty name" % (self,))
ValueError: PureWindowsPath('c:/') has an empty name
```

`PurePath.with_stem(stem)`

返回一个带有修改后 `stem` 的新路径。 如果原路径没有名称，则会引发 ValueError:

```plain
>>> p = PureWindowsPath('c:/Downloads/draft.txt')
>>> p.with_stem('final')
PureWindowsPath('c:/Downloads/final.txt')
>>> p = PureWindowsPath('c:/Downloads/pathlib.tar.gz')
>>> p.with_stem('lib')
PureWindowsPath('c:/Downloads/lib.gz')
>>> p = PureWindowsPath('c:/')
>>> p.with_stem('')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "/home/antoine/cpython/default/Lib/pathlib.py", line 861, in with_stem
    return self.with_name(stem + self.suffix)
  File "/home/antoine/cpython/default/Lib/pathlib.py", line 851, in with_name
    raise ValueError("%r has an empty name" % (self,))
ValueError: PureWindowsPath('c:/') has an empty name
```

`PurePath.with_suffix(suffix)`

返回一个新的路径并修改 `suffix`。如果原本的路径没有后缀，新的 _suffix_ 则被追加以代替。如果 _suffix_ 是空字符串，则原本的后缀被移除:

```plain
>>> p = PureWindowsPath('c:/Downloads/pathlib.tar.gz')
>>> p.with_suffix('.bz2')
PureWindowsPath('c:/Downloads/pathlib.tar.bz2')
>>> p = PureWindowsPath('README')
>>> p.with_suffix('.txt')
PureWindowsPath('README.txt')
>>> p = PureWindowsPath('README.txt')
>>> p.with_suffix('')
PureWindowsPath('README')
```

`PurePath.with_segments(*pathsegments)`

通过组合给定的 _pathsegments_ 创建一个相同类型的新路径对象。 每当创建派生路径，如从 `parent` 和 `relative_to()` 创建时都会调用此方法。 子类可以覆盖此方法以便向派生路径传递信息，例如:

```python
from pathlib import PurePosixPath

class MyPath(PurePosixPath):
    def __init__(self, *pathsegments, session_id):
        super().__init__(*pathsegments)
        self.session_id = session_id

    def with_segments(self, *pathsegments):
        return type(self)(*pathsegments, session_id=self.session_id)

etc = MyPath('/etc', session_id=42)
hosts = etc / 'hosts'
print(hosts.session_id)  # 42
```

### 具体路径

具体路径是纯路径的子类。除了后者提供的操作之外，它们还提供了对路径对象进行系统调用的方法。有三种方法可以实例化具体路径:

*class* `pathlib.Path(*pathsegments)`

一个 `PurePath` 的子类，此类以当前系统的路径风格表示路径 (实例化为 `PosixPath` 或 `WindowsPath`):

```plain
>>> Path('setup.py')
PosixPath('setup.py')
```

_pathsegments_ 参数的指定和 `PurePath` 相同。

*class* `pathlib.PosixPath(*pathsegments)`

一个 `Path` 和 `PurePosixPath` 的子类，此类表示一个非 Windows 文件系统的具体路径:

```plain
>>> PosixPath('/etc/hosts')
PosixPath('/etc/hosts')
```

_pathsegments_ 参数的指定和 `PurePath` 相同。

*class* `pathlib.WindowsPath(*pathsegments)`

`Path` 和 `PureWindowsPath` 的子类，此类表示一个 Windows 文件系统的具体路径:

```plain
>>> WindowsPath('c:/', 'Users', 'Ximénez')
WindowsPath('c:/Users/Ximénez')
```

_pathsegments_ 参数的指定和 `PurePath` 相同。

你只能实例化与当前系统风格相同的类（允许系统调用作用于不兼容的路径风格可能在应用程序中导致缺陷或失败）:

```plain
>>> import os
>>> os.name
'posix'
>>> Path('setup.py')
PosixPath('setup.py')
>>> PosixPath('setup.py')
PosixPath('setup.py')
>>> WindowsPath('setup.py')
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
  File "pathlib.py", line 798, in __new__
    % (cls.__name__,))
UnsupportedOperation: cannot instantiate 'WindowsPath' on your system
```

某些具体路径方法在一个系统调用失败时（例如由于路径不存在）可能引发 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

#### 解析和生成 URI

具体路径对象可基于符合 [**RFC 8089**](https://datatracker.ietf.org/doc/html/rfc8089.html) 的 '文件' URI 来创建，并可用它来表示。

备注

文件 URI 不能在具有不同 [文件系统编码格式](https://docs.python.org/zh-cn/3/library/os.html) 的机器之间进行移植。

_classmethod_ Path.from_uri(_uri_)

通过解析一个 '文件' URI 来返回新的路径对象。 例如:

```plain
>>> p = Path.from_uri('file:///etc/hosts')
PosixPath('/etc/hosts')
```

在 Windows 上，可以基于 URI 来解析 DOS 设备和 UNC 路径:

```plain
>>> p = Path.from_uri('file:///c:/windows')
WindowsPath('c:/windows')
>>> p = Path.from_uri('file://server/share')
WindowsPath('//server/share')
```

某些变化形式也是受支持的:

```plain
>>> p = Path.from_uri('file:////server/share')
WindowsPath('//server/share')
>>> p = Path.from_uri('file://///server/share')
WindowsPath('//server/share')
>>> p = Path.from_uri('file:c:/windows')
WindowsPath('c:/windows')
>>> p = Path.from_uri('file:/c|/windows')
WindowsPath('c:/windows')
```

如果 URI 不是以 `file:` 开头，或者被解析的不是绝对路径则会引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

`Path.as_uri()`

将路径表示为 'file' URI。 如果路径不是绝对路径则会引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

```plain
>>> p = PosixPath('/etc/passwd')
>>> p.as_uri()
'file:///etc/passwd'
>>> p = WindowsPath('c:/Windows')
>>> p.as_uri()
'file:///c:/Windows'
```

从 3.14 版起已弃用，将在 3.19 版中移除: 可以从 `PurePath` 而不是 `Path` 调用此方法，但已弃用。该方法使用 [`os.fsencode()`](https://docs.python.org/zh-cn/3/library/os.html) 使其严格不纯。

#### 扩展和计算路径

_classmethod_ Path.home()

返回一个表示用户家目录的新路径对象（与带 `~` 构造的 [`os.path.expanduser()`](https://docs.python.org/zh-cn/3/library/os.path.html) 所返回的相同）。 如果无法解析家目录，则会引发 [`RuntimeError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

```plain
>>> Path.home()
PosixPath('/home/antoine')
```

`Path.expanduser()`

返回带有扩展 `~` 和 `~user` 构造的新路径，与 [`os.path.expanduser()`](https://docs.python.org/zh-cn/3/library/os.path.html) 所返回的相同。 如果无法解析家目录，则会引发 [`RuntimeError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

```plain
>>> p = PosixPath('~/films/Monty Python')
>>> p.expanduser()
PosixPath('/home/eric/films/Monty Python')
```

_classmethod_ Path.cwd()

返回一个新的表示当前目录的路径对象（和 [`os.getcwd()`](https://docs.python.org/zh-cn/3/library/os.html) 返回的相同）:

```plain
>>> Path.cwd()
PosixPath('/home/antoine/pathlib')
```

`Path.absolute()`

改为绝对路径，不会执行正规化或解析符号链接。 返回一个新的路径对象:

```plain
>>> p = Path('tests')
>>> p
PosixPath('tests')
>>> p.absolute()
PosixPath('/home/antoine/pathlib/tests')
```

`Path.resolve(strict=False)`

将路径绝对化，解析任何符号链接。返回新的路径对象:

```plain
>>> p = Path()
>>> p
PosixPath('.')
>>> p.resolve()
PosixPath('/home/antoine/pathlib')
```

"`..`" 组件也将被消除（只有这一种方法这么做）:

```plain
>>> p = Path('docs/../setup.py')
>>> p.resolve()
PosixPath('/home/antoine/pathlib/setup.py')
```

如果一个路径不存在或是遇到了符号链接循环，并且 _strict_ 为 `True`，则会引发 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。 如果 _strict_ 为 `False`，则会尽可能地解析路径并添加任何剩余部分而不会检查其是否存在。

`Path.readlink()`

返回符号链接所指向的路径（即 [`os.readlink()`](https://docs.python.org/zh-cn/3/library/os.html) 的返回值）:

```plain
>>> p = Path('mylink')
>>> p.symlink_to('setup.py')
>>> p.readlink()
PosixPath('setup.py')
```

#### 查询文件类型和状态

`Path.stat(*, _follow_symlinks=True_)`

返回一个 [`os.stat_result`](https://docs.python.org/zh-cn/3/library/os.html) 对象，其中包含有关此路径的信息，就像 [`os.stat()`](https://docs.python.org/zh-cn/3/library/os.html)。 结果会在每次调用此方法时被查找。

此方法通常会跟随符号链接；要对 symlink 使用 stat 请添加参数 `follow_symlinks=False`，或者使用 `lstat()`。

```plain
>>> p = Path('setup.py')
>>> p.stat().st_size
956
>>> p.stat().st_mtime
1327883547.852554
```

`Path.lstat()`

就和 `Path.stat()` 一样，但是如果路径指向符号链接，则是返回符号链接而不是目标的信息。

`Path.exists(*, _follow_symlinks=True_)`

如果路径指向已存在的文件或目录，则返回 `True`。 如果路径无效、不可访问或缺失，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

此方法通常会跟随符号链接；要检查符号链接是否存在，请添加参数 `follow_symlinks=False`。

```plain
>>> Path('.').exists()
True
>>> Path('setup.py').exists()
True
>>> Path('/etc').exists()
True
>>> Path('nonexistentfile').exists()
False
```

`Path.is_file(*, _follow_symlinks=True_)`

如果路径指向一个常规文件，则返回 `True`。 如果路径无效、不可访问或缺失，或如果它指向的不是一个常规文件，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

此方法通常会跟随符号链接；要排除符号链接，请添加参数 `follow_symlinks=False`。

`Path.is_dir(*, _follow_symlinks=True_)`

如果路径指向一个目录，则返回 `True`。 如果路径无效、不可访问或缺失，或如果它指向的不是一个目录，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

此方法通常会跟随符号链接；要排除指向目录的符号链接，请添加参数 `follow_symlinks=False`。

`Path.is_symlink()`

如果路径指向一个符号链接，则返回 `True`，即使该符号链接已损坏。 如果路径无效、不可访问或缺失，或如果它指向的不是一个符号链接，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

`Path.is_junction()`

如果路径是指向一个接合点则返回 `True`，如果是其他文件类型则返回 `False`。 目前只有 Windows 支持接合点。

`Path.is_mount()`

如果路径是一个 _挂载点_: 在文件系统中被其他不同文件系统挂载的位置则返回 `True`。 在 POSIX 上，此函数将检查 _path_ 的上一级 `path/..` 是否位于和 _path_ 不同的设备中，或者 `path/..` 和 _path_ 是否指向位于相同设备的相同 i-node --- 这应当能检测所有 Unix 和 POSIX 变种上的挂载点。 在 Windows 上，挂载点是被视为驱动器盘符的根目录 (例如 `c:`)、UNC 共享目录 (例如 `\\server\share`) 或已挂载的文件系统目录。

`Path.is_socket()`

如果路径指向一个 Unix 套接字，则返回 `True`。 如果路径无效、不可访问或缺失，或如果它指向的不是一个 Unix 套接字，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

`Path.is_fifo()`

如果路径指向一个 FIFO（先进先出），则返回 `True`。 如果路径无效、不可访问或缺失，或如果它指向的不是一个 FIFO，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

`Path.is_block_device()`

如果路径指向一个块设备，则返回 `True`。 如果路径无效、不可访问或缺失，或如果它指向的不是一个块设备，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

`Path.is_char_device()`

如果路径指向一个字符设备，则返回 `True`。 如果路径无效、不可访问或缺失，或如果它指向的不是一个字符设备，将返回 `False`。 使用 `Path.stat()` 来区分这些情况。

`Path.samefile(_other_path_)`

返回此路径是否指向与 _other_path_ 相同的文件，_other_path_ 可以是一个字符串或者另一个路径对象。语义类似于 [`os.path.samefile()`](https://docs.python.org/zh-cn/3/library/os.path.html) 与 [`os.path.samestat()`](https://docs.python.org/zh-cn/3/library/os.path.html)。

如果任一文件因某种原因无法访问，则会引发 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

```plain
>>> p = Path('spam')
>>> q = Path('eggs')
>>> p.samefile(q)
False
>>> p.samefile('spam')
True
```

Path.info

支持查询文件类型信息的 `PathInfo` 对象。 该对象公开了缓存其结果的方法，这有助于在切换文件类型时减少所需的系统调用数量。 例如:

```plain
>>> p = Path('src')
>>> if p.info.is_symlink():
...     print('symlink')
... elif p.info.is_dir():
...     print('directory')
... elif p.info.exists():
...     print('something else')
... else:
...     print('not found')
...
directory
```

如果路径是由 `Path.iterdir()` 生成的，那么这个属性会初始化一些通过扫描父目录收集到的关于文件类型的信息。 仅仅访问 `Path.info` 不会执行任何文件系统查询。

要获取最新的信息，最好调用 `Path.is_dir()`、`is_file()` 和 `is_symlink()`，而不是调用该属性的方法。 没有办法重置缓存；相反，您可以通过 `p = Path(p)` 创建一个空信息缓存的新路径对象。

#### 读写文件

`Path.open(mode='r', buffering=-1, encoding=None, errors=None, newline=None)`

打开路径指向的文件，就像内置的 [`open()`](https://docs.python.org/zh-cn/3/library/functions.html) 函数所做的一样:

```plain
>>> p = Path('setup.py')
>>> with p.open() as f:
...     f.readline()
...
'#!/usr/bin/env python3\\n'
```

`Path.read_text(encoding=None, errors=None, newline=None)`

以字符串形式返回路径指向的文件的解码后文本内容:

```plain
>>> p = Path('my_text_file')
>>> p.write_text('Text file contents')
18
>>> p.read_text()
'Text file contents'
```

文件先被打开然后关闭。有和 [`open()`](https://docs.python.org/zh-cn/3/library/functions.html) 一样的可选形参。

`Path.read_bytes()`

以字节对象的形式返回路径指向的文件的二进制内容:

```plain
>>> p = Path('my_binary_file')
>>> p.write_bytes(b'Binary file contents')
20
>>> p.read_bytes()
b'Binary file contents'
```

`Path.write_text(data, encoding=None, errors=None, newline=None)`

将文件以文本模式打开，写入 _data_ 并关闭:

```plain
>>> p = Path('my_text_file')
>>> p.write_text('Text file contents')
18
>>> p.read_text()
'Text file contents'
```

同名的现有文件会被覆盖。 可选形参的含义与 [`open()`](https://docs.python.org/zh-cn/3/library/functions.html) 的相同。

`Path.write_bytes(data)`

将文件以二进制模式打开，写入 _data_ 并关闭:

```plain
>>> p = Path('my_binary_file')
>>> p.write_bytes(b'Binary file contents')
20
>>> p.read_bytes()
b'Binary file contents'
```

一个同名的现存文件将被覆盖。

#### 读取目录

`Path.iterdir()`

当路径指向一个目录时，产生该路径下的对象的路径:

```plain
>>> p = Path('docs')
>>> for child in p.iterdir(): child
...
PosixPath('docs/conf.py')
PosixPath('docs/_templates')
PosixPath('docs/make.bat')
PosixPath('docs/index.rst')
PosixPath('docs/_build')
PosixPath('docs/_static')
PosixPath('docs/Makefile')
```

子条目会以任意顺序产生，并且不包括特殊条目 `'.'` 和 `'..'`。 如果迭代器创建之后有文件在目录中被移除或添加，是否要包括该文件所对应的路径对象并没有明确规定。

如果该路径不是一个目录或是无法访问，则会引发 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

`Path.glob(pattern, *, _case_sensitive=None_, _recurse_symlinks=False_)`

解析相对于此路径的通配符 _pattern_，产生所有匹配的文件:

```plain
>>> sorted(Path('.').glob('*.py'))
[PosixPath('pathlib.py'), PosixPath('setup.py'), PosixPath('test_pathlib.py')]
>>> sorted(Path('.').glob('*/*.py'))
[PosixPath('docs/conf.py')]
>>> sorted(Path('.').glob('**/*.py'))
[PosixPath('build/lib/pathlib.py'),
 PosixPath('docs/conf.py'),
 PosixPath('pathlib.py'),
 PosixPath('setup.py'),
 PosixPath('test_pathlib.py')]
```

备注

路径不会以特定的顺序返回。 如果你需要特定的顺序，请对结果进行排序。

参见

模式语言 文档。

在默认情况下，或当 _case_sensitive_ 关键字参数被设为 `None` 时，该方法将使用特定平台的大小写规则匹配路径：通常，在 POSIX 上区分大小写，而在 Windows 上不区分大小写。将 _case_sensitive_ 设为 `True` 或 `False` 可覆盖此行为。

在默认情况下，或是当 _recurse_symlinks_ 关键字参数被设为 `False` 时，此方法将跟随符号链接但在扩展 "`**`" 通配符时除外。 将 _recurse_symlinks_ 设为 `True` 将总是跟随符号链接。

备注

任何因扫描文件系统而引发的 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 异常都会被抑制。 这包括访问没有读取权限的目录时的 [`PermissionError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

引发一个 [审计事件](https://docs.python.org/zh-cn/3/library/sys.html) `pathlib.Path.glob` 并附带参数 `self`, `pattern`。

`Path.rglob(pattern, *, _case_sensitive=None_, _recurse_symlinks=False_)`

递归地对给定的相对 _pattern_ 执行 glob 通配。 这类似于调用 `Path.glob()` 时在 _pattern_ 之前加上 "`**/`"。

备注

路径不会以特定的顺序返回。 如果你需要特定的顺序，请对结果进行排序。

备注

任何因扫描文件系统而引发的 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 异常都会被抑制。 这包括访问没有读取权限的目录时的 [`PermissionError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

参见

模式语言 和 `Path.glob()` 文档。

引发一个 [审计事件](https://docs.python.org/zh-cn/3/library/sys.html) `pathlib.Path.rglob` 并附带参数 `self`, `pattern`。

`Path.walk(_top_down=True_, _on_error=None_, _follow_symlinks=False_)`

通过对目录树自上而下或自下而上的遍历来生成其中的文件名。

对于根位置为 _self_ 的目录树中的每个目录（包括 _self_ 但不包括 '.' 和 '..'），该方法会产生一个 3 元组 `(dirpath, dirnames, filenames)`。

_dirpath_ 是指向当前正被遍历到的目录的 `Path`，_dirnames_ 是由表示 _dirpath_ 中子目录名称的字符串组成的列表 (不包括 `'.'` 和 `'..'`)，_filenames_ 是由表示 _dirpath_ 中非目录文件名称的字符串组成的列表。 要获取 _dirpath_ 中文件或目录的完整路径 (以 _self_ 开头)，可使用 `dirpath / name`。 这些列表是否排序取决于具体的文件系统。

如果可选参数 _top_down_ 为（默认的）真值，则会在所有子目录的三元组生成之前生成父目录的三元组（目录是自上而下遍历的）。 如果 _top_down_ 为假值，则会在所有子目录的三元组生成之后再生成父目录的三元组（目录是自下而上遍历的）。无论 _top_down_ 的值是什么，都会在遍历目录及其子目录的三元组之前提取子目录列表。

当 _top_down_ 为真值时，调用方可以原地修改 _dirnames_ 列表（例如，使用 [`del`](https://docs.python.org/zh-cn/3/reference/simple_stmts.html) 或切片赋值），而 `Path.walk()` 只会向名称保留在 _dirnames_ 中的子目录递归。 这可被用于搜索剪枝，或强制应用特定的访问顺序，或者甚至是在重新恢复执行 `Path.walk()` 之前告知 `Path.walk()` 调用方所创建或重命名的目录。 当 _top_down_ 为假值时修改 _dirnames_ 不会对 `Path.walk()` 的行为造成影响，因为在 _dirnames_ 被提供给调用方时 _dirnames_ 中的目录已经被生成了。

在默认情况下，来自 [`os.scandir()`](https://docs.python.org/zh-cn/3/library/os.html) 的错误将被忽略。 如果指定了可选参数 _on_error_，则它应为一个可调用对象；调用它需要传入一个参数，即 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 的实例。 该可调用对象能处理错误以继续执行遍历或是重新引发错误以停止遍历。 请注意可以通过异常对象的 `filename` 属性来获取文件名。

在默认情况下，`Path.walk()` 不会跟踪符号链接，而是将其添加到 _filenames_ 列表中。 将 _follow_symlinks_ 设为真值可解析符号链接并根据它们的目标将其放入 _dirnames_ 和 _filenames_ 中，从而（在受支持的系统上）访问符号链接所指向的目录。

备注

请注意将 _follow_symlinks_ 设为真值会在链接指向自身的父目录时导致无限递归。 `Path.walk()` 不会跟踪它已访问过的目录。

备注

`Path.walk()` 会假定在执行过程中它所遍历的目录没有被修改。 例如，如果 _dirnames_ 中的某个目录已被替换为符号链接并且 _follow_symlinks_ 为假值，则 `Path.walk()` 仍会尝试进入该目录。 为防止出现这种行为，请相应地移除 _dirnames_ 中的目录。

备注

与 [`os.walk()`](https://docs.python.org/zh-cn/3/library/os.html) 不同，当 _follow_symlinks_ 为假值时 `Path.walk()` 会在 _filenames_ 中列出指向目录的符号链接。

这个例子显示每个目录中所有文件使用的总字节数，忽略其中的 `__pycache__` 目录:

```python
from pathlib import Path
for root, dirs, files in Path("cpython/Lib/concurrent").walk(on_error=print):
  print(
      root,
      "consumes",
      sum((root / file).stat().st_size for file in files),
      "bytes in",
      len(files),
      "non-directory files"
  )
  if '__pycache__' in dirs:
        dirs.remove('__pycache__')
```

下一个例子是 [`shutil.rmtree()`](https://docs.python.org/zh-cn/3/library/shutil.html) 的一个简单实现。 由于 `rmdir()` 不允许在目录为空之前删除该目录因此自下而上地遍历目录树是至关重要的:

```plain
# 删除可从目录 "top" 进入的所有东西。
# 小心：这很危险！举例来说，如果 top == Path('/')，
# 它可能会删除你的全部文件。
for root, dirs, files in top.walk(top_down=False):
    for name in files:
        (root / name).unlink()
    for name in dirs:
        (root / name).rmdir()
```

#### 创建文件和目录

`Path.touch(mode=0o666, _exist_ok=True_)`

使用给定的路径创建文件。 如果给出了 _mode_，它将与进程的 `umask` 值合并以确定文件模式和访问旗标。 如果文件已存在，则当 _exist_ok_ 为真值时函数将成功执行（并且其修改时间将更新为当前时间），在其他情况下则会引发 [`FileExistsError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

参见

`open()`, `write_text()` 和 `write_bytes()` 方法经常被用来创建文件。

`Path.mkdir(mode=0o777, parents=False, _exist_ok=False_)`

使用给定的路径新建目录。 如果给出了 _mode_，它将与进程的 `umask` 值合并来决定文件模式和访问旗标。 如果路径已存在，则会引发 [`FileExistsError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

如果 _parents_ 为真值，任何找不到的父目录都会伴随着此路径被创建；它们会以默认权限被创建，而不考虑 _mode_ 设置（模仿 POSIX 的 `mkdir -p` 命令）。

如果 _parents_ 为假值（默认），则找不到的父级目录会引发 [`FileNotFoundError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

如果 _exist_ok_ 为 false（默认），则在目标已存在的情况下抛出 [`FileExistsError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

如果 _exist_ok_ 为真值，则 [`FileExistsError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 将不会被引发除非给定的路径在文件系统中已存在并且不是目录（与 POSIX `mkdir -p` 命令的行为相同）。

`Path.symlink_to(target, _target_is_directory=False_)`

使该路径成为一个指向 _target_ 的符号链接。

在 Windows，符号链接可以代表文件或者目录，并且不会动态适应目标。 如果目标存在，则将创建相匹配的符号链接类型。 在其他情况下，如果 _target_is_directory_ 为真值则符号链接将创建为目录类型否则将创建为文件符号链接。 在非 Windows 平台上，_target_is_directory_ 将被忽略。

```plain
>>> p = Path('mylink')
>>> p.symlink_to('setup.py')
>>> p.resolve()
PosixPath('/home/antoine/pathlib/setup.py')
>>> p.stat().st_size
956
>>> p.lstat().st_size
8
```

备注

参数的顺序（link, target) 和 [`os.symlink()`](https://docs.python.org/zh-cn/3/library/os.html) 是相反的。

`Path.hardlink_to(target)`

将此路径设为一个指向与 _target_ 相同文件的硬链接。

备注

参数顺序 (link, target) 和 [`os.link()`](https://docs.python.org/zh-cn/3/library/os.html) 是相反的。

#### 拷贝、移动和删除

`Path.copy(target, *, _follow_symlinks=True_, _preserve_metadata=False_)`

将此文件或目录树拷贝到给定的 _target_，并返回一个指向 _target_ 的新的 `Path` 实例。

如果源是一个文件，则当目标是一个已存在的文件时目标将被替换。如果源是一个符号链接，并且 _follow_symlinks_ 为真值（默认），则复制该符号链接的目标。否则，将在目的地重新创建符号链接。

如果 _preserve_metadata_ 为假值（默认），则只保证复制目录结构和文件数据。将 _preserve_metadata_ 设为真值，以确保在支持的平台上复制文件和目录权限、标志、最后访问和修改时间以及扩展属性。此参数在 Windows 上复制文件时不起作用（会始终保留元数据）。

备注

在操作系统和文件系统支持的情况下，此方法执行轻量级复制，数据块仅在被修改时才会被复制。这就是所谓的写时复制。

`Path.copy_into(_target_dir_, *, _follow_symlinks=True_, _preserve_metadata=False_)`

将这个文件或目录树复制到给定的 _target_dir_ 中，它应该是一个现有的目录。 其他参数的处理方式与 `Path.copy()` 相同。 返回一个新的指向副本的 `Path` 实例。

`Path.rename(target)`

将此文件或目录重命名为给定的 _target_，并返回一个新的指向 _target_ 的 `Path` 实例。 在 Unix 上，如果 _target_ 存在且为一个文件，那么如果用户具有相应权限则它将静默地替换。 在 Windows 上，如果 _target_ 存在，则会引发 [`FileExistsError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。 _target_ 可以是一个字符串或者另一个路径对象:

```plain
>>> p = Path('foo')
>>> p.open('w').write('some text')
9
>>> target = Path('bar')
>>> p.rename(target)
PosixPath('bar')
>>> target.open().read()
'some text'
```

目标路径可能为绝对或相对路径。 相对路径将被解读为相对于当前工作目录，而 _不是_ 相对于 `Path` 对象的目录。

它根据 [`os.rename()`](https://docs.python.org/zh-cn/3/library/os.html) 实现并给出了同样的保证。

`Path.replace(target)`

将此文件或目录重命名为给定的 _target_，并返回一个新的指向 _target_ 的 `Path` 实例。 如果 _target_ 指向一个现有文件或空目录，则它将被无条件地替换。

目标路径可能为绝对或相对路径。 相对路径将被解读为相对于当前工作目录，而 _不是_ 相对于 `Path` 对象的目录。

`Path.move(target)`

将此文件或目录树移动到给定的 _target_，并返回一个指向 _target_ 的新的 `Path` 实例。

如果 _target_ 不存在，它将被创建。 如果该路径和 _target_ 都是现有文件，则覆盖目标。 如果两个路径都指向相同的文件或目录，或者 _target_ 是非空目录，则引发 [`OSError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

如果两个路径都在同一个文件系统上，则使用 [`os.replace()`](https://docs.python.org/zh-cn/3/library/os.html) 执行移动。 否则，该路径将被复制（保留元数据和符号链接），再被删除。

`Path.move_into(_target_dir_)`

将这个文件或目录树移动到给定的 _target_dir_ 中，它应该是一个现有的目录。 返回一个新的指向移动后路径的 `Path` 实例。

`Path.unlink(_missing_ok=False_)`

移除此文件或符号链接。如果路径指向目录，则用 `Path.rmdir()` 代替。

如果 _missing_ok_ 为假值（默认），则如果路径不存在将会引发 [`FileNotFoundError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

如果 _missing_ok_ 为真值，则 [`FileNotFoundError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 异常将被忽略（和 POSIX `rm -f` 命令的行为相同）。

`Path.rmdir()`

移除此目录。此目录必须为空的。

#### 访问权限与所有权

`Path.owner(*, _follow_symlinks=True_)`

返回拥有此文件的用户名。 如果文件的用户标识 (UID) 无法在系统数据库中找到则会引发 [`KeyError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

此方法通常会跟随符号链接；要获取符号链接的所有者，请添加参数 `follow_symlinks=False`。

`Path.group(*, _follow_symlinks=True_)`

返回拥有此文件的用户组名。 如果文件的用户组标识 (GID) 无法在系统数据库中找到则会引发 [`KeyError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

此方法通常会跟随符号链接；要获取符号链接的用户组，请添加参数 `follow_symlinks=False`。

`Path.chmod(mode, *, _follow_symlinks=True_)`

改变文件模式和权限，和 [`os.chmod()`](https://docs.python.org/zh-cn/3/library/os.html) 一样。

此方法通常会跟随符号链接。 某些 Unix 变种支持改变 symlink 本身的权限；在这些平台上你可以添加参数 `follow_symlinks=False`，或者使用 `lchmod()`。

```plain
>>> p = Path('setup.py')
>>> p.stat().st_mode
33277
>>> p.chmod(0o444)
>>> p.stat().st_mode
33060
```

`Path.lchmod(mode)`

就像 `Path.chmod()` 但是如果路径指向符号链接则是修改符号链接的模式，而不是修改符号链接的目标。

### 模式语言

以下通配符在用于 `full_match()`, `glob()` 和 `rglob()` 的模式中是受支持的：

`**` (整个分段)

匹配任意数量的文件或目录分段，包括零个。

`*` (整个分段)

匹配一个文件或目录分段。

`*` (分段的一部分)

匹配任意数量的非分隔符型字符，包括零个。

`?`

匹配一个不是分隔符的字符。

`[seq]`

匹配 _seq_ 中的一个字符，_seq_ 是一个字符序列。 支持区间表达式；例如，`[a-z]` 匹配任意小写 ASCII 字母。 多个区间可以合并：如 `[a-zA-Z0-9_]` 匹配任意 ASCII 字母、数字或下划线。

`[!seq]`

匹配不在 _seq_ 中的一个字符，_seq_ 遵循与上一通配符相同的规则。

对于字面值匹配，请将元字符用方括号括起来。 例如，`"[?]"` 将匹配字符 `"?"`。

"`**`" 通配符将启用递归 glob。 下面是几个例子：

模式

含意

"`**/*`"

任何具有至少一个分段的路径。

"`**/*.py`"

最后部分以 "`.py`" 结尾的任意路径。

"`assets/**`"

以 "`assets/`" 开头的任意路径。

"`assets/**/*`"

以 "`assets/`" 开头，但不包括 "`assets/`" 本身的任意路径。

备注

使用 "`**`" 通配符执行 glob 操作将访问目录树中的每个目录。 非常大的目录树可能要花费非常长的时间来搜索。

在 `Path.glob()` 和 `rglob()` 中，可以向模式添加一个末尾斜杠以只匹配目录。

### 与 [`glob`](https://docs.python.org/zh-cn/3/library/glob.html) 模块的比较

`Path.glob()` 和 `Path.rglob()` 所接受的模式和所生成的结果相比 [`glob`](https://docs.python.org/zh-cn/3/library/glob.html) 模式的略有不同：

1.  以点号打头的文件在 pathlib 中没有特殊含义。 这类似于向 [`glob.glob()`](https://docs.python.org/zh-cn/3/library/glob.html) 传入 `include_hidden=True`。
    
2.  "`**`" 模式组件在 pathlib 总是递归的。 这类似于向 [`glob.glob()`](https://docs.python.org/zh-cn/3/library/glob.html) 传入 `recursive=True`。
    
3.  "`**`" 模式组件在 pathlib 中默认不会跟随符号链接。 此行为在 [`glob.glob()`](https://docs.python.org/zh-cn/3/library/glob.html) 中没有对应物，但你可以向 `Path.glob()` 传入 `recurse_symlinks=True` 以获得兼容的行为。
    
4.  与所有 `PurePath` 和 `Path` 对象类似，从 `Path.glob()` 和 `Path.rglob()` 返回的值都不包括末尾斜杠。
    
5.  从 pathlib 的 `path.glob()` 和 `path.rglob()` 返回的值包括作为前缀的 _path_，这不同于 `glob.glob(root_dir=path)` 的结果。
    
6.  从 pathlib 的 `path.glob()` 和 `path.rglob()` 返回的值可能包括 _path_ 本身，例如当对 "`**`" 执行 glob 操作的时候，而 `glob.glob(root_dir=path)` 的结果绝不会包括与 _path_ 对应的空字符串。
    

### 与 [`os`](https://docs.python.org/zh-cn/3/library/os.html) 和 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 模块的比较

pathlib 使用 `PurePath` 和 `Path` 对象来实现路径操作，因此它被认为是 _面向对象的_。 而在另一方面，[`os`](https://docs.python.org/zh-cn/3/library/os.html) 和 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 模块提供与低层级 `str` 和 `bytes` 对象配合使用的函数，它更接近于 _面向过程的_ 方式。 某些用户认为面向对象的风格可读性更好。

[`os`](https://docs.python.org/zh-cn/3/library/os.html) 和 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 中的许多函数都支持 `bytes` 路径和 [相对于目录描述符的路径](https://docs.python.org/zh-cn/3/library/os.html)。 这些特性在 pathlib 中均不可用。

Python 的 `str` 和 `bytes` 类型，以及 [`os`](https://docs.python.org/zh-cn/3/library/os.html) 和 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 模块的各个部分都是用 C 编写的因而非常快速。 pathlib 是用纯 Python 编写的因而往往较慢，但很少会慢到引人注意。

pathlib 的路径规范化比 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 更有主见也更一致。 例如，[`os.path.abspath()`](https://docs.python.org/zh-cn/3/library/os.path.html) 会删除路径中的 "`..`" 段，因为当涉及符号链接时这可能会改变其含义；而 `Path.absolute()` 则会保留这些段以提高安全性。

pathlib 的路径规范化可能使其不适合某些应用程序：

1.  pathlib 会将 `Path("my_folder/")` 规范化为 `Path("my_folder")`，这改变了路径在提供给各种操作系统 API 和命令行工具时的含义。 具体来说，缺少末尾分隔符可能会使路径被解析为文件或目录，而非只是目录。
    
2.  pathlib 会将 `Path("./my_program")` 规范化为 `Path("my_program")`，这改变了路径在被用作可执行文件搜索路径，例如在 shell 中或者在产生子进程时的含义。 具体来说，缺少路径中的分隔符可能会迫使其在 `PATH` 而不是在当前目录中查找。
    

由于这些差异的影响，pathlib 并不是 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html) 的直接替代品。

#### 相关工具

以下是一个映射了 [`os`](https://docs.python.org/zh-cn/3/library/os.html) 与 `PurePath`/`Path` 对应相同的函数的表。

[`os`](https://docs.python.org/zh-cn/3/library/os.html) 和 [`os.path`](https://docs.python.org/zh-cn/3/library/os.path.html)

`pathlib`

[`os.path.dirname()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`PurePath.parent`

[`os.path.basename()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`PurePath.name`

[`os.path.splitext()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`PurePath.stem`, `PurePath.suffix`

[`os.path.join()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`PurePath.joinpath()`

[`os.path.isabs()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`PurePath.is_absolute()`

[`os.path.relpath()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`PurePath.relative_to()` [[1]](#id7)

[`os.path.expanduser()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.expanduser()` [[2]](#id8)

[`os.path.realpath()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.resolve()`

[`os.path.abspath()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.absolute()` [[3]](#id9)

[`os.path.exists()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.exists()`

[`os.path.isfile()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.is_file()`

[`os.path.isdir()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.is_dir()`

[`os.path.islink()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.is_symlink()`

[`os.path.isjunction()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.is_junction()`

[`os.path.ismount()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.is_mount()`

[`os.path.samefile()`](https://docs.python.org/zh-cn/3/library/os.path.html)

`Path.samefile()`

[`os.getcwd()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.cwd()`

[`os.stat()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.stat()`

[`os.lstat()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.lstat()`

[`os.listdir()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.iterdir()`

[`os.walk()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.walk()` [[4]](#id10)

[`os.mkdir()`](https://docs.python.org/zh-cn/3/library/os.html), [`os.makedirs()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.mkdir()`

[`os.link()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.hardlink_to()`

[`os.symlink()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.symlink_to()`

[`os.readlink()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.readlink()`

[`os.rename()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.rename()`

[`os.replace()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.replace()`

[`os.remove()`](https://docs.python.org/zh-cn/3/library/os.html), [`os.unlink()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.unlink()`

[`os.rmdir()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.rmdir()`

[`os.chmod()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.chmod()`

[`os.lchmod()`](https://docs.python.org/zh-cn/3/library/os.html)

`Path.lchmod()`

备注

[1]

[`os.path.relpath()`](https://docs.python.org/zh-cn/3/library/os.path.html) 会调用 [`abspath()`](https://docs.python.org/zh-cn/3/library/os.path.html) 以使路径变为绝对路径并移除 "`..`" 部分，而 `PurePath.relative_to()` 是一个词法操作，当其输入的锚点不同时（例如当一个路径为绝对路径而另一个为相对路径时）将引发 [`ValueError`](https://docs.python.org/zh-cn/3/library/exceptions.html)。

[2]

若无法解析家目录， [`os.path.expanduser()`](https://docs.python.org/zh-cn/3/library/os.path.html) 会原封不动地返回输入的路径，但 `Path.expanduser()` 会抛出 [`RuntimeError`](https://docs.python.org/zh-cn/3/library/exceptions.html) 异常。

[3]

[`os.path.abspath()`](https://docs.python.org/zh-cn/3/library/os.path.html) 会移除 "`..`" 组件而不解析符号链接，这可能改变路径的含义，而 `Path.absolute()` 则会让路径中的任何 "`..`" 组件保持原样。

[4]

[`os.walk()`](https://docs.python.org/zh-cn/3/library/os.html) 在将路径分类为 _dirnames_ 和 _filenames_ 时总是会跟随符号链接，而 `Path.walk()` 当 _follow_symlinks_ 为（默认的）假值时会将符号链接分类为 _filenames_。

### 协议

`pathlib.types` 块提供了用于静态类型检查的类型。

_class_ pathlib.types.PathInfo

描述 `Path.info` 属性的 [`typing.Protocol`](https://docs.python.org/zh-cn/3/library/typing.html)。 各种实现可以从它们的方法返回缓存的结果。

`exists(*, _follow_symlinks=True_)`

如果路径是一个已存在的文件或目录，或任何其他类型的文件，则返回 `True`；如果路径不存在，返回 `False`。

如果 _follow_symlinks_ 为 `False` ，则对符号链接返回 `True`，而不检查符号链接的目标是否存在。

`is_dir(*, _follow_symlinks=True_)`

如果路径是一个目录，或是一个指向目录的符号链接，则返回 `True`。如果路径是（或指向）任何其他类型的文件，或者路径不存在，则返回 `False`。

如果 _follow_symlinks_ 是 `False`，那么仅当该路径为目录时返回 `True` （不跟踪符号链接）；如果该路径是任何类型的文件，或该路径不存在，则返回 `False`。

`is_file(*, _follow_symlinks=True_)`

如果该路径是文件，或是指向一个文件的符号链接，则返回 `True`。如果该路径是（或指向）一个目录或其他非文件，或该路径不存在，则返回 `False`。

如果 _follow_symlinks_ 是 `False`，仅当该路径是一个文件时返回 `True` （不跟踪符号链接）；如果该路径是一个目录或其他非文件，或该路径不存在，则返回 `False`。

`is_symlink()`

如果该路径是符号链接（即使已断开）则返回 `True`；如果该路径是目录或任何种类的文件，或者已不存在则返回 `False`。


</details>

---

> **来源**：抓取于 2026-09-19。折叠段「参考」译自 [pathlib — 面向对象的文件系统路径 — Python 标准库（中文）](https://docs.python.org/zh-cn/3/library/pathlib.html)（Python Software Foundation，PSF 许可证第 2 版；文中示例与代码片段另按零条款 BSD 许可证授权），原为官方中文译文的整页收录，本篇将其调整为附录并补译了其中未译的英文段落（如 `is_reserved()` 与相关弃用说明），原防盗链的类图外链已移除；十五个常用操作的主线编排、常见坑与目录统计示例为本站编者注。
