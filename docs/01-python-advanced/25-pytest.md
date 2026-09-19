---
title: pytest 入门与使用指南（Get Started + How-To）
source_url: https://docs.pytest.org/en/stable/getting-started.html
author: Holger Krekel 与 pytest 开发团队
license: MIT 许可证
fetched_at: 2026-09-13
translated: true
versions: pytest 9.x
order: 25
group: 质量与性能
---
*编者导读：本篇由 pytest 官方文档《Get Started（开始）》完整翻译，并完整收录《How-to guides（使用指南）》中的核心各篇：调用方式（usage）、断言（assert）、参数化（parametrize）、跳过与 xfail（skipping）、monkeypatch。各节均对应官方独立页面，覆盖日常测试最常用的能力。*

## 开始（Get Started）

### 安装 pytest

1. 在命令行运行：

```bash
pip install -U pytest
```

2. 检查安装的版本是否正确：

```bash
$ pytest --version
pytest 9.1.1
```

### 创建你的第一个测试

新建一个名为 `test_sample.py` 的文件，包含一个函数和一个测试：

```python
# content of test_sample.py
def func(x):
    return x + 1


def test_answer():
    assert func(3) == 5
```

运行该测试：

```text
$ pytest
=========================== test session starts ============================
platform linux -- Python 3.x.y, pytest-9.x.y, pluggy-1.x.y
rootdir: /home/sweet/project
collected 1 item

test_sample.py F                                                     [100%]

================================= FAILURES =================================
_______________________________ test_answer ________________________________

    def test_answer():
>       assert func(3) == 5
E       assert 4 == 5
E        +  where 4 = func(3)

test_sample.py:6: AssertionError
========================= short test summary info ==========================
FAILED test_sample.py::test_answer - assert 4 == 5
============================ 1 failed in 0.12s =============================
```

`[100%]` 指所有用例运行的总体进度。跑完后 pytest 显示失败报告，因为 `func(3)` 没有返回 `5`。

> **注**：可以用 `assert` 语句验证测试预期。pytest 的高级断言内省（assertion introspection）会智能地报告 assert 表达式的中间值，让你不必像 JUnit 遗留方法那样写一堆断言方法。

### 运行多个测试

`pytest` 会运行当前目录及其子目录下所有形如 `test_*.py` 或 `*_test.py` 的文件。更一般地，它遵循标准测试发现规则。

### 断言抛出特定异常

用 `raises` 辅助器断言某段代码抛出异常：

```python
# content of test_sysexit.py
import pytest


def f():
    raise SystemExit(1)


def test_mytest():
    with pytest.raises(SystemExit):
        f()
```

以"安静"报告模式执行该测试函数：

```text
$ pytest -q test_sysexit.py
.                                                                    [100%]
1 passed in 0.12s
```

> **注**：`-q/--quiet` 标志让本例及后续示例的输出保持简短。

关于预期异常的更多细节指定方式，见下文《断言》一节。

### 把多个测试组织到一个类中

开发出多个测试后，你可能想把它们归入一个类。pytest 让创建包含多个测试的类变得容易：

```python
# content of test_class.py
class TestClass:
    def test_one(self):
        x = "this"
        assert "h" in x

    def test_two(self):
        x = "hello"
        assert hasattr(x, "check")
```

`pytest` 按其 Python 测试发现约定找到所有测试，所以两个 `test_` 前缀的函数都会被发现。不需要继承任何东西，但要确保类名以 `Test` 开头，否则类会被跳过。直接传文件名运行该模块：

```text
$ pytest -q test_class.py
.F                                                                   [100%]
================================= FAILURES =================================
____________________________ TestClass.test_two ____________________________

self = <test_class.TestClass object at 0xdeadbeef0001>

    def test_two(self):
        x = "hello"
>       assert hasattr(x, "check")
E       AssertionError: assert False
E        +  where False = hasattr('hello', 'check')

test_class.py:8: AssertionError
========================= short test summary info ==========================
FAILED test_class.py::TestClass::test_two - AssertionError: assert False
1 failed, 1 passed in 0.12s
```

第一个测试通过、第二个失败。断言中的中间值一目了然，帮助你理解失败原因。

把测试组织进类的好处：

- 测试组织管理；
- 在该类内共享 fixtures；
- 在类级别应用标记（marks），隐式作用于类中所有测试。

需要留意的是：类中的每个测试都持有该类的**唯一实例**。让每个测试共享同一个类实例会严重损害测试隔离性、助长糟糕的测试实践。示意如下：

```python
# content of test_class_demo.py
class TestClassDemoInstance:
    value = 0

    def test_one(self):
        self.value = 1
        assert self.value == 1

    def test_two(self):
        assert self.value == 1
```

```text
$ pytest -k TestClassDemoInstance -q
.F                                                                   [100%]
================================= FAILURES =================================
______________________ TestClassDemoInstance.test_two ______________________

self = <test_class_demo.TestClassDemoInstance object at 0xdeadbeef0002>

    def test_two(self):
>       assert self.value == 1
E       assert 0 == 1
E        +  where 0 = <test_class_demo.TestClassDemoInstance object at 0xdeadbeef0002>.value

test_class_demo.py:9: AssertionError
========================= short test summary info ==========================
FAILED test_class_demo.py::TestClassDemoInstance::test_two - assert 0 == 1
1 failed, 1 passed in 0.12s
```

注意：在类级别添加的属性是*类属性*，会在测试之间共享。

### 用 pytest.approx 比较浮点数

`pytest` 还提供了许多让测试编写更容易的工具。例如用 `pytest.approx` 比较可能带有微小舍入误差的浮点值：

```python
# content of test_approx.py
import pytest


def test_sum():
    assert (0.1 + 0.2) == pytest.approx(0.3)
```

这避免了手工容差判断或使用 `math.isclose`，并且支持标量、列表和 NumPy 数组。

### 为功能测试申请唯一的临时目录

`pytest` 提供内置 fixtures（函数参数）来申请任意资源，例如一个唯一的临时目录：

```python
# content of test_tmp_path.py
def test_needsfiles(tmp_path):
    print(tmp_path)
    assert 0
```

在测试函数签名中列出 `tmp_path`，pytest 就会在执行测试函数前查找并调用 fixture 工厂创建该资源。测试运行前，pytest 会创建一个每次测试调用唯一的临时目录：

```text
$ pytest -q test_tmp_path.py
F                                                                    [100%]
================================= FAILURES =================================
_____________________________ test_needsfiles ______________________________

tmp_path = PosixPath('PYTEST_TMPDIR/test_needsfiles0')

    def test_needsfiles(tmp_path):
        print(tmp_path)
>       assert 0
E       assert 0

test_tmp_path.py:3: AssertionError
--------------------------- Captured stdout call ---------------------------
PYTEST_TMPDIR/test_needsfiles0
========================= short test summary info ==========================
FAILED test_tmp_path.py::test_needsfiles - assert 0
1 failed in 0.12s
```

临时目录处理的更多信息见官方"临时目录与文件"文档。用以下命令查看存在哪些内置 pytest fixtures：

```bash
pytest --fixtures   # 显示内置与自定义 fixtures
```

注意：该命令会省略以下划线 `_` 开头的 fixtures，除非加 `-v`。

### 继续阅读

- "使用指南"（下文）：命令行调用示例
- "处理现有测试套件"：与既有测试协作
- "mark"：`pytest.mark` 机制
- "fixtures"：为测试提供功能基线
- "插件"：管理并编写插件
- "良好实践"：virtualenv 与测试布局

## 使用指南（How-to guides）

How-to 目录（官方 how-to/index）覆盖：调用方式（usage）、断言（assert）、fixtures、标记（mark）、参数化（parametrize）、子测试（subtests）、tmp_path、monkeypatch、doctest、cache、失败与输出（failures/output/logging/捕获/跳过）、插件（plugins/writing_plugins/writing_hook_functions）、与其他测试系统集成（existingtestsuite/unittest/xunit_setup）、bash 补全。本篇收录其中最核心的 usage/assert/parametrize/skipping/monkeypatch 全文，其余见官方对应页面。

### 如何调用 pytest（usage）

一般来说，用命令 `pytest` 调用 pytest。它会执行当前目录及其子目录下所有形如 `test_*.py` 或 `*_test.py` 文件中的全部测试。更一般地，pytest 遵循标准测试发现规则。

**指定要运行哪些测试**

Pytest 支持多种方式从命令行或文件运行并选择测试。

运行一个模块中的测试：

```bash
pytest test_mod.py
```

运行一个目录中的测试：

```bash
pytest testing/
```

按关键字表达式运行测试：

```bash
pytest -k 'MyClass and not method'
```

这会运行名称匹配给定*字符串表达式*（不区分大小写）的测试，表达式中可以把文件名、类名、函数名当作变量并使用 Python 运算符。上例会运行 `TestMyClass.test_something` 但不运行 `TestMyClass.test_method_simple`。在 Windows 上请用 `""` 代替 `''`。

**按收集参数（node id）运行测试**：传入相对工作目录的模块文件名，后跟以 `::` 分隔的类名、函数名等指定符，参数化的参数用 `[]` 括起。

运行模块中的特定测试：

```bash
pytest tests/test_mod.py::test_func
```

运行一个类中的所有测试：

```bash
pytest tests/test_mod.py::TestClass
```

指定特定测试方法：

```bash
pytest tests/test_mod.py::TestClass::test_method
```

指定测试的特定参数化组合：

```bash
pytest tests/test_mod.py::test_func[x1,y2]
```

**按标记表达式运行测试**：运行所有被 `@pytest.mark.slow` 装饰的测试：

```bash
pytest -m slow
```

运行所有被 `@pytest.mark.slow(phase=1)` 装饰、且 `phase` 关键字参数为 `1` 的测试：

```bash
pytest -m "slow(phase=1)"
```

**从包中运行测试**：

```bash
pytest --pyargs pkg.testing
```

这会导入 `pkg.testing`，并按其在文件系统中的位置查找并运行测试。

**从文件读取参数**（8.2 新增）：以上所有方式都能用 `@` 前缀从文件读取：

```bash
pytest @tests_to_run.txt
```

其中 `tests_to_run.txt` 每行一个条目，例如：

```text
tests/test_file.py
tests/test_mod.py::test_func[x1,y2]
tests/test_mod.py::TestClass
-m slow
```

该文件也可以用 `pytest --collect-only -q` 生成后按需修改。

**查看版本、选项名、环境变量帮助**：

```bash
pytest --version   # 显示 pytest 的导入位置
pytest --fixtures  # 显示可用的内置函数参数
pytest -h | --help # 显示命令行与配置文件选项帮助
```

**分析测试执行耗时**（6.0 变更）：列出超过 1.0 秒的最慢 10 个测试：

```bash
pytest --durations=10 --durations-min=1.0
```

默认情况下，pytest 不显示过短（<0.005s）的测试耗时，除非命令行传入 `-vv`。

**管理插件的加载**

提前加载插件：用 `-p` 选项在命令行显式提前加载（内部或外部）插件：

```bash
pytest -p mypluginmodule
```

该选项接收 `name` 参数，可以是：完整模块点分名（如 `myproject.plugins`，必须可导入）；或插件的 entry-point 名（插件注册时传给 `importlib` 的名字）。例如提前加载 pytest-cov 插件：

```bash
pytest -p pytest_cov
```

禁用插件：调用时用 `-p` 加 `no:` 前缀禁用特定插件的加载。例如禁用负责执行文本文件中 doctest 的 `doctest` 插件：

```bash
pytest -p no:doctest
```

**调用 pytest 的其他方式**

通过 `python -m pytest` 调用：

```text
python -m pytest [...]
```

这与直接调用命令行脚本 `pytest [...]` 几乎等价，区别是通过 `python` 调用还会把当前目录加入 `sys.path`。

从 Python 代码中调用 pytest：

```python
retcode = pytest.main()
```

效果如同在命令行调用"pytest"。它不抛出 `SystemExit`，而是返回退出码。若不传参数，`main` 会从进程的命令行参数（`sys.argv`）读取，这可能不是你想要的。可以显式传入选项与参数：

```python
retcode = pytest.main(["-x", "mytestdir"])
```

还可以给 `pytest.main` 指定额外插件：

```python
# content of myinvoke.py
import sys

import pytest


class MyPlugin:
    def pytest_sessionfinish(self):
        print("*** test run reporting finishing")


if __name__ == "__main__":
    sys.exit(pytest.main(["-qq"], plugins=[MyPlugin()]))
```

运行后会显示 `MyPlugin` 被加入、其钩子被调用：

```text
$ python myinvoke.py
*** test run reporting finishing
```

> **注**：调用 `pytest.main()` 会导入你的测试及其导入的所有模块。由于 Python 导入系统的缓存机制，同一进程内对 `pytest.main()` 的后续调用不会反映这些文件在两次调用之间的变化。因此不建议在同一进程中多次调用 `pytest.main()`（比如为了重跑测试）。

## 参数化 fixtures 与测试函数（parametrize）

pytest 支持在多个层级进行测试参数化：

- `pytest.fixture` 允许对 fixture 函数参数化；
- `@pytest.mark.parametrize` 允许在测试函数或类上定义多组参数与 fixtures；
- `pytest_generate_tests` 允许自定义参数化方案或扩展。

> **注**：参数化的替代方案见官方 subtests 文档。

### `@pytest.mark.parametrize`：参数化测试函数

内置的 `pytest.mark.parametrize` 装饰器为测试函数启用参数化。下面是一个典型例子：测试"特定输入产生预期输出"：

```python
# content of test_expectation.py
import pytest


@pytest.mark.parametrize("test_input,expected", [("3+5", 8), ("2+4", 6), ("6*9", 42)])
def test_eval(test_input, expected):
    assert eval(test_input) == expected
```

这里 `@parametrize` 装饰器定义了三组不同的 `(test_input,expected)` 元组，`test_eval` 函数会用它们依次运行三次：

```text
$ pytest
=========================== test session starts ============================
platform linux -- Python 3.x.y, pytest-9.x.y, pluggy-1.x.y
rootdir: /home/sweet/project
collected 3 items

test_expectation.py ..F                                              [100%]

================================= FAILURES =================================
____________________________ test_eval[6*9-42] _____________________________

test_input = '6*9', expected = 42

    @pytest.mark.parametrize("test_input,expected", [("3+5", 8), ("2+4", 6), ("6*9", 42)])
    def test_eval(test_input, expected):
>       assert eval(test_input) == expected
E       AssertionError: assert 54 == 42
E        +  where 54 = eval('6*9')

test_expectation.py:6: AssertionError
========================= short test summary info ==========================
FAILED test_expectation.py::test_eval[6*9-42] - AssertionError: assert 54...
======================= 1 failed, 2 passed in 0.12s ========================
```

> **注**：参数值按原样传给测试（不做任何拷贝）。例如参数值是列表或字典、且测试代码修改了它，那么修改会反映到后续测试用例的调用中。

> **注**：默认情况下，pytest 会对参数化中 unicode 字符串的非 ASCII 字符进行转义（这种转义有若干缺点）。如果你想在参数化中使用 unicode 字符串并在终端原样显示（不转义），可在配置文件中加入 `[pytest]` 段的 `disable_test_id_escaping_and_forfeit_all_rights_to_community_support = true`。但这可能造成副作用甚至 bug（取决于操作系统与已装插件），风险自负。

如本例所设计，只有一对输入/输出使这个简单的测试函数失败。与测试函数参数的惯例一致，traceback 中能看到 `input` 与 `output` 值。

parametrize 标记也可以用在类或模块上（见 mark 一节），这会以各参数组调用多个函数，例如：

```python
import pytest


@pytest.mark.parametrize("n,expected", [(1, 2), (3, 4)])
class TestClass:
    def test_simple_case(self, n, expected):
        assert n + 1 == expected

    def test_weird_simple_case(self, n, expected):
        assert (n * 1) + 1 == expected
```

要参数化模块中的所有测试，可以给全局变量 `pytestmark` 赋值：

```python
import pytest

pytestmark = pytest.mark.parametrize("n,expected", [(1, 2), (3, 4)])


class TestClass:
    def test_simple_case(self, n, expected):
        assert n + 1 == expected

    def test_weird_simple_case(self, n, expected):
        assert (n * 1) + 1 == expected
```

还可以在 parametrize 内部为单个测试实例打标记，例如用内置的 `mark.xfail`：

```python
# content of test_expectation.py
import pytest


@pytest.mark.parametrize(
    "test_input,expected",
    [("3+5", 8), ("2+4", 6), pytest.param("6*9", 42, marks=pytest.mark.xfail)],
)
def test_eval(test_input, expected):
    assert eval(test_input) == expected
```

运行：

```text
$ pytest
=========================== test session starts ============================
platform linux -- Python 3.x.y, pytest-9.x.y, pluggy-1.x.y
rootdir: /home/sweet/project
collected 3 items

test_expectation.py ..x                                              [100%]

======================= 2 passed, 1 xfailed in 0.12s =======================
```

之前导致失败的那个参数组现在显示为"xfailed"（预期失败）测试。

如果传给 `parametrize` 的值最终为空列表（例如由某个函数动态生成），pytest 的行为由 `empty_parameter_set_mark` 选项决定。

要获得多个参数化参数的所有组合，可以叠加 `parametrize` 装饰器：

```python
import pytest


@pytest.mark.parametrize("x", [0, 1])
@pytest.mark.parametrize("y", [2, 3])
def test_foo(x, y):
    pass
```

这会以 `x=0/y=2`、`x=1/y=2`、`x=0/y=3`、`x=1/y=3` 运行测试，参数按装饰器的顺序穷举。

### `pytest_generate_tests` 基础示例

有时你想实现自己的参数化方案，或为 fixture 的参数/作用域的确定加入动态逻辑。为此可以使用 `pytest_generate_tests` 钩子——它在收集测试函数时被调用。通过传入的 `metafunc` 对象可以检查请求测试的上下文，最重要的是可以调用 `metafunc.parametrize()` 触发参数化。

例如，我们想运行一个接收字符串输入的测试，且输入通过新的 pytest 命令行选项设置。先写一个接受 `stringinput` fixture 函数参数的简单测试：

```python
# content of test_strings.py


def test_valid_string(stringinput):
    assert stringinput.isalpha()
```

再添加一个 `conftest.py`，包含命令行选项的添加与测试函数的参数化：

```python
# content of conftest.py


def pytest_addoption(parser):
    parser.addoption(
        "--stringinput",
        action="append",
        default=[],
        help="list of stringinputs to pass to test functions",
    )


def pytest_generate_tests(metafunc):
    if "stringinput" in metafunc.fixturenames:
        metafunc.parametrize("stringinput", metafunc.config.getoption("stringinput"))
```

> **注**：`pytest_generate_tests` 钩子也可以直接实现在测试模块或测试类中；与其他钩子不同，pytest 也会在那里发现它。其他钩子必须放在 `conftest.py` 或插件里。

传入两个 stringinput 值，我们的测试会跑两次：

```text
$ pytest -q --stringinput="hello" --stringinput="world" test_strings.py
..                                                                   [100%]
2 passed in 0.12s
```

再传一个会导致失败的 stringinput：

```text
$ pytest -q --stringinput="!" test_strings.py
F                                                                    [100%]
================================= FAILURES =================================
___________________________ test_valid_string[!] ___________________________

stringinput = '!'

    def test_valid_string(stringinput):
>       assert stringinput.isalpha()
E       AssertionError: assert False
E        +  where False = <built-in method isalpha of str object at 0xdeadbeef0001>()
E        +    where <built-in method isalpha of str object at 0xdeadbeef0001> = '!'.isalpha

test_strings.py:4: AssertionError
========================= short test summary info ==========================
FAILED test_strings.py::test_valid_string[!] - AssertionError: assert False
1 failed in 0.12s
```

如预期，测试函数失败了。如果不指定 stringinput，测试会被跳过，因为 `metafunc.parametrize()` 会以空参数列表被调用：

```text
$ pytest -q -rs test_strings.py
s                                                                    [100%]
========================= short test summary info ==========================
SKIPPED [1] test_strings.py: got empty parameter set for (stringinput)
1 skipped in 0.12s
```

注意：用不同参数集多次调用 `metafunc.parametrize` 时，各参数集的参数名不能重复，否则会报错。

更多示例见官方"更多参数化示例"页。

## 如何用 skip 与 xfail 处理无法成功的测试

你可以标记那些无法在特定平台运行、或预期会失败的测试函数，让 pytest 相应地处理它们并在测试会话摘要中呈现，同时保持测试套件*绿色*。

**skip（跳过）**表示：你预期测试只在某些条件满足时通过，否则 pytest 应完全跳过该测试。常见例子：在非 Windows 平台跳过 Windows 专属测试；或跳过依赖当前不可用的外部资源（如数据库）的测试。

**xfail（预期失败）**表示：你预期测试因某种原因失败。常见例子：针对尚未实现功能的测试，或尚未修复的 bug。当测试被标记为 `pytest.mark.xfail` 却通过了，称为 **xpass**，会出现在测试摘要中。

`pytest` 会分别统计并列出 *skip* 与 *xfail* 测试。默认不显示跳过/xfail 测试的详细信息以免输出杂乱。可用 `-r` 选项查看测试进度中"短字符"对应的详情：

```bash
pytest -rxXs  # 显示 xfailed、xpassed 和 skipped 测试的额外信息
```

`-r` 选项的更多细节见 `pytest -h`。

### 跳过测试函数

跳过测试函数最简单的方式是加 `skip` 装饰器，可附带可选的 `reason`：

```python
@pytest.mark.skip(reason="no way of currently testing this")
def test_the_unknown(): ...
```

也可以在测试执行或 setup 期间命令式地跳过：调用 `pytest.skip(reason)` 函数：

```python
def test_function():
    if not valid_config():
        pytest.skip("unsupported configuration")
```

当跳过条件无法在导入期求值时，命令式方法很有用。

还可以用 `pytest.skip(reason, allow_module_level=True)` 在模块级别跳过整个模块：

```python
import sys

import pytest

if not sys.platform.startswith("win"):
    pytest.skip("skipping windows-only tests", allow_module_level=True)
```

### `skipif`

想有条件地跳过时可以用 `skipif`。例如标记一个测试函数在低于 Python 3.13 的解释器上运行时跳过：

```python
import sys


@pytest.mark.skipif(sys.version_info < (3, 13), reason="requires python3.13 or higher")
def test_function(): ...
```

如果条件在收集期求值为 `True`，测试函数会被跳过；使用 `-rs` 时指定原因会出现在摘要中。

`skipif` 标记可以在模块间共享。看这个测试模块：

```python
# content of test_mymodule.py
import mymodule

minversion = pytest.mark.skipif(
    mymodule.__versioninfo__ < (1, 1), reason="at least mymodule-1.1 required"
)


@minversion
def test_function(): ...
```

可以导入该标记在另一个测试模块复用：

```python
# test_myothermodule.py
from test_mymodule import minversion


@minversion
def test_anotherfunction(): ...
```

对大型测试套件，通常最好用一个文件统一定义这些标记，然后在整个测试套件中一致地使用。

也可以用条件字符串代替布尔值，但条件字符串不易跨模块共享，支持它主要是为了向后兼容。

### 跳过类或模块的所有测试函数

可以像使用其他标记一样，在类上使用 `skipif` 标记：

```python
@pytest.mark.skipif(sys.platform == "win32", reason="does not run on windows")
class TestPosixCalls:
    def test_function(self):
        "在 'win32' 平台下不会被 setup 或运行"
```

条件为 `True` 时，该标记会为该类的每个测试方法产生一个跳过结果。

想跳过一个模块的所有测试函数，可以使用 `pytestmark` 全局变量：

```python
# test_module.py
pytestmark = pytest.mark.skipif(...)
```

如果一个测试函数应用了多个 `skipif` 装饰器，任一跳过条件为真时它就会被跳过。

### 跳过文件或目录

有时你可能需要跳过整个文件或目录，例如测试依赖特定 Python 版本的特性，或包含不希望 pytest 执行的代码。此时必须把文件和目录从收集中排除，详见官方"自定义测试收集"。

### 缺少导入依赖时跳过

可以用 `pytest.importorskip` 在模块级、测试内或测试 setup 函数中对缺失的导入跳过测试：

```python
docutils = pytest.importorskip("docutils")
```

如果 `docutils` 无法在此导入，测试会得到跳过结果。还可以基于库的版本号跳过：

```python
docutils = pytest.importorskip("docutils", minversion="0.3")
```

版本号读取自指定模块的 `__version__` 属性。

**小结**：模块内跳过测试的快速指南：

1. 无条件跳过模块内所有测试：

```python
pytestmark = pytest.mark.skip("all tests still WIP")
```

2. 按条件跳过模块内所有测试：

```python
pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="tests for linux only")
```

3. 缺少某个导入时跳过模块内所有测试：

```python
pexpect = pytest.importorskip("pexpect")
```

### XFail：把测试标记为预期失败

用 `xfail` 标记表示你预期测试失败：

```python
@pytest.mark.xfail
def test_function(): ...
```

该测试会运行，但失败时不会报告 traceback。相反，终端报告会把它列入"expected to fail"（`XFAIL`）或"unexpectedly passing"（`XPASS`）区块。

也可以在测试或其 setup 函数内命令式地把测试标记为 `XFAIL`：

```python
def test_function():
    if not valid_config():
        pytest.xfail("failing configuration (but should work)")
```

```python
def test_function2():
    import slow_module

    if slow_module.slow_function():
        pytest.xfail("slow_module taking too long")
```

这两个例子说明的场景是：条件不适合在模块级检查（标记方式的条件是在模块级求值的）。

这会让 `test_function` 成为 `XFAIL`。注意与标记不同，`pytest.xfail` 调用之后不会执行任何其他代码——它内部通过抛出一个已知异常实现。

**`condition` 参数**：如果测试只在某条件下预期失败，可以把条件作为第一个参数传入：

```python
@pytest.mark.xfail(sys.platform == "win32", reason="bug in a 3rd party library")
def test_function(): ...
```

注意必须同时传 reason。

**`reason` 参数**：用 `reason` 说明预期失败的缘由：

```python
@pytest.mark.xfail(reason="known parser issue")
def test_function(): ...
```

**`raises` 参数**：想更具体地说明失败原因时，可在 `raises` 参数中指定单个异常或异常元组：

```python
@pytest.mark.xfail(raises=RuntimeError)
def test_function(): ...
```

此后若测试因 `raises` 未提及的异常失败，将被报告为普通失败。

**`run` 参数**：如果测试应被标记为 xfail 并如此报告、但根本不应执行，把 `run` 设为 `False`：

```python
@pytest.mark.xfail(run=False)
def test_function(): ...
```

这特别适用于会让解释器崩溃、留待以后排查的 xfail 测试。

**`strict` 参数**：`XFAIL` 与 `XPASS` 默认都不会让测试套件失败。把仅关键字参数 `strict` 设为 `True` 可以改变这一点：

```python
@pytest.mark.xfail(strict=True)
def test_function(): ...
```

这会让该测试的 `XPASS`（意外通过）结果使测试套件失败。也可以用 `xfail_strict` ini 选项修改 `strict` 的默认值（`[pytest]` 段 `xfail_strict = true`）。

**忽略 xfail**：在命令行指定：

```bash
pytest --runxfail
```

可以强制运行并报告 `xfail` 标记的测试，如同未加标记；这也让 `pytest.xfail()` 不再生效。

**示例**：一个包含多种用法的简单测试文件（官方 xfail_demo.py，7 个测试），用 `-rx` 运行输出如下：

```text
! pytest -rx xfail_demo.py
=========================== test session starts ============================
collected 7 items

xfail_demo.py xxxxxxx                                                [100%]

========================= short test summary info ==========================
XFAIL xfail_demo.py::test_hello
XFAIL xfail_demo.py::test_hello2
  reason: [NOTRUN]
XFAIL xfail_demo.py::test_hello3
  condition: hasattr(os, 'sep')
XFAIL xfail_demo.py::test_hello4
  bug 110
XFAIL xfail_demo.py::test_hello5
  condition: pytest.__version__[0] != "17"
XFAIL xfail_demo.py::test_hello6
  reason: reason
XFAIL xfail_demo.py::test_hello7
============================ 7 xfailed in 0.12s ============================
```

### 参数化中的 skip/xfail

使用参数化时，可以把 skip、xfail 之类的标记应用到单个测试实例：

```python
import sys

import pytest


@pytest.mark.parametrize(
    ("n", "expected"),
    [
        (1, 2),
        pytest.param(1, 0, marks=pytest.mark.xfail),
        pytest.param(1, 3, marks=pytest.mark.xfail(reason="some bug")),
        (2, 3),
        (3, 4),
        (4, 5),
        pytest.param(
            10, 11, marks=pytest.mark.skipif(sys.version_info >= (3, 0), reason="py2k")
        ),
    ],
)
def test_increment(n, expected):
    assert n + 1 == expected
```

## 如何 monkeypatch/mock 模块与环境

有时测试需要调用依赖全局设置的功能，或调用难以测试的代码（如网络访问）。`monkeypatch` fixture 帮你安全地设置/删除属性、字典项或环境变量，或为导入修改 `sys.path`。

`monkeypatch` fixture 提供以下辅助方法，用于在测试中安全地打补丁与模拟功能：

- `monkeypatch.setattr(obj, name, value, raising=True)`
- `monkeypatch.delattr(obj, name, raising=True)`
- `monkeypatch.setitem(mapping, name, value)`
- `monkeypatch.delitem(obj, name, raising=True)`
- `monkeypatch.setenv(name, value, prepend=None)`
- `monkeypatch.delenv(name, raising=True)`
- `monkeypatch.syspath_prepend(path)`
- `monkeypatch.chdir(path)`
- `monkeypatch.context()`

所有修改都会在申请它的测试函数或 fixture 结束后被撤销。`raising` 参数决定：当 set/delete 操作的目标不存在时，是否抛出 `KeyError` 或 `AttributeError`。

考虑以下场景：

1. 为测试修改函数行为或类的属性，例如某个 API 调用或数据库连接在测试中不会真正发生、但你已知预期输出。用 `monkeypatch.setattr` 把函数或属性替换为你想要的测试行为（也可以是你自己的函数）。用 `monkeypatch.delattr` 在测试中移除函数或属性。
2. 修改字典的值，例如某个全局配置想在某些用例中修改。用 `monkeypatch.setitem` 为测试修改字典；`monkeypatch.delitem` 可用于移除条目。
3. 为测试修改环境变量，例如测试环境变量缺失时的程序行为，或给已知变量设置多个值。`monkeypatch.setenv` 与 `monkeypatch.delenv` 用于这些补丁。
4. 用 `monkeypatch.setenv("PATH", value, prepend=os.pathsep)` 修改 `$PATH`；用 `monkeypatch.chdir` 在测试期间改变当前工作目录。
5. 用 `monkeypatch.syspath_prepend` 修改 `sys.path`，它还会调用 `pkg_resources.fixup_namespace_packages` 与 `importlib.invalidate_caches`。
6. 用 `monkeypatch.context` 把补丁只应用在特定作用域内，有助于控制复杂 fixture 的清理或对标准库的补丁。

（monkeypatch 的介绍材料与动机讨论见官方博客 "Monkeypatching in Unit Tests, Done Right"。）

### 为函数打补丁

设想你在处理用户目录。测试时你不希望测试依赖运行用户。`monkeypatch` 可以给依赖用户的函数打补丁，使其总是返回特定值。

本例用 `monkeypatch.setattr` 给 `Path.home` 打补丁，使测试运行时总是使用已知的测试路径 `Path("/abc")`，从而在测试目的上移除对运行用户的任何依赖。`monkeypatch.setattr` 必须在调用"将使用被替换函数"的函数之前调用。测试函数结束后，`Path.home` 的修改会被撤销。

```python
# contents of test_module.py with source code and the test
from pathlib import Path


def getssh():
    """Simple function to return expanded homedir ssh path."""
    return Path.home() / ".ssh"


def test_getssh(monkeypatch):
    # mocked return function to replace Path.home
    # always return '/abc'
    def mockreturn():
        return Path("/abc")

    # Application of the monkeypatch to replace Path.home
    # with the behavior of mockreturn defined above.
    monkeypatch.setattr(Path, "home", mockreturn)

    # Calling getssh() will use mockreturn in place of Path.home
    # for this test with the monkeypatch.
    x = getssh()
    assert x == Path("/abc/.ssh")
```

### 为返回对象打补丁：构造 mock 类

`monkeypatch.setattr` 还可以结合类使用，模拟函数返回的对象而不仅是值。设想一个简单函数：接收 API URL 并返回 JSON 响应。

```python
# contents of app.py, a simple API retrieval example
import requests


def get_json(url):
    """Takes a URL, and returns the JSON."""
    r = requests.get(url)
    return r.json()
```

出于测试目的，我们需要 mock `r`（返回的响应对象）。`r` 的 mock 需要 `.json()` 方法并返回字典。在测试文件中定义一个代表 `r` 的类即可：

```python
# contents of test_app.py, a simple test for our API retrieval
# import requests for the purposes of monkeypatching
import requests

# our app.py that includes the get_json() function
# this is the previous code block example
import app


# custom class to be the mock return value
# will override the requests.Response returned from requests.get
class MockResponse:
    # mock json() method always returns a specific testing dictionary
    @staticmethod
    def json():
        return {"mock_key": "mock_response"}


def test_get_json(monkeypatch):
    # Any arguments may be passed and mock_get() will always return our
    # mocked object, which only has the .json() method.
    def mock_get(*args, **kwargs):
        return MockResponse()

    # apply the monkeypatch for requests.get to mock_get
    monkeypatch.setattr(requests, "get", mock_get)

    # app.get_json, which contains requests.get, uses the monkeypatch
    result = app.get_json("https://fakeurl")
    assert result["mock_key"] == "mock_response"
```

`monkeypatch` 用 `mock_get` 函数给 `requests.get` 打了补丁。`mock_get` 返回 `MockResponse` 类的实例——它定义了返回已知测试字典的 `json()` 方法，不需要任何外部 API 连接。

`MockResponse` 类可以按你测试的场景构建相应的复杂度：例如加入总是返回 `True` 的 `ok` 属性，或让 mock 的 `json()` 依据输入字符串返回不同值。

这个 mock 可以通过 `fixture` 在测试间共享：

```python
# contents of test_app.py, a simple test for our API retrieval
import pytest
import requests

# app.py that includes the get_json() function
import app


# custom class to be the mock return value of requests.get()
class MockResponse:
    @staticmethod
    def json():
        return {"mock_key": "mock_response"}


# monkeypatched requests.get moved to a fixture
@pytest.fixture
def mock_response(monkeypatch):
    """Requests.get() mocked to return {'mock_key':'mock_response'}."""

    def mock_get(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(requests, "get", mock_get)


# notice our test uses the custom fixture instead of monkeypatch directly
def test_get_json(mock_response):
    result = app.get_json("https://fakeurl")
    assert result["mock_key"] == "mock_response"
```

此外，如果 mock 设计为应用于所有测试，可以把 `fixture` 移到 `conftest.py` 并使用 `autouse=True` 选项。

### 全局补丁示例：阻止 "requests" 进行远程操作

想阻止 `requests` 库在所有测试中发起 HTTP 请求，可以：

```python
# contents of conftest.py
import pytest


@pytest.fixture(autouse=True)
def no_requests(monkeypatch):
    """Remove requests.sessions.Session.request for all tests."""
    monkeypatch.delattr("requests.sessions.Session.request")
```

这个 autouse fixture 会对每个测试函数执行，删除 `request.session.Session.request` 方法，使测试中任何发起 HTTP 请求的尝试都会失败。

> **注**：不建议给 `open`、`compile` 等内置函数打补丁，因为可能破坏 pytest 的内部机制。实在无法避免时，传入 `--tb=native`、`--assert=plain` 与 `--capture=no` 可能有帮助，但不保证。
>
> **注**：注意给 pytest 所用的 stdlib 函数及部分第三方库打补丁可能破坏 pytest 本身。优先补丁你的代码所引用的引用名，而不是标准库中的原始对象。例如你的模块执行了 `from os import getcwd`，就补丁 `mymodule.getcwd` 而非 `os.getcwd`。
>
> 对你能控制的代码，更安全的长期模式是把依赖显式化，让它们可以被传入被测代码而不是被全局补丁。当给标准库对象打补丁不可避免时，用 `MonkeyPatch.context` 把补丁限制在你想测试的代码块内：
>
> ```python
> import functools
>
>
> def test_partial(monkeypatch):
>     with monkeypatch.context() as m:
>         m.setattr(functools, "partial", 3)
>         assert functools.partial == 3
> ```
>
> 详见 pytest issue #3290。

### 为环境变量打补丁

处理环境变量时，常需要为测试安全地修改值或从系统中删除。`monkeypatch` 通过 `setenv` 与 `delenv` 方法提供该机制。待测示例代码：

```python
# contents of our original code file e.g. code.py
import os


def get_os_user_lower():
    """Simple retrieval function.
    Returns lowercase USER or raises OSError."""
    username = os.getenv("USER")

    if username is None:
        raise OSError("USER environment is not set.")

    return username.lower()
```

有两条可能的路径：其一 `USER` 环境变量被设为某个值；其二 `USER` 环境变量不存在。使用 `monkeypatch`，两条路径都可以安全测试而不影响运行环境：

```python
# contents of our test file e.g. test_code.py
import pytest


def test_upper_to_lower(monkeypatch):
    """Set the USER env var to assert the behavior."""
    monkeypatch.setenv("USER", "TestingUser")
    assert get_os_user_lower() == "testinguser"


def test_raise_exception(monkeypatch):
    """Remove the USER env var and assert OSError is raised."""
    monkeypatch.delenv("USER", raising=False)

    with pytest.raises(OSError):
        _ = get_os_user_lower()
```

可以把该行为移入 `fixture` 结构、跨测试共享：

```python
# contents of our test file e.g. test_code.py
import pytest


@pytest.fixture
def mock_env_user(monkeypatch):
    monkeypatch.setenv("USER", "TestingUser")


@pytest.fixture
def mock_env_missing(monkeypatch):
    monkeypatch.delenv("USER", raising=False)


# notice the tests reference the fixtures for mocks
def test_upper_to_lower(mock_env_user):
    assert get_os_user_lower() == "testinguser"


def test_raise_exception(mock_env_missing):
    with pytest.raises(OSError):
        _ = get_os_user_lower()
```

### 为字典打补丁

`monkeypatch.setitem` 可在测试期间把字典的值安全地设为特定值。以这个简化的连接字符串为例：

```python
# contents of app.py to generate a simple connection string
DEFAULT_CONFIG = {"user": "user1", "database": "db1"}


def create_connection_string(config=None):
    """Creates a connection string from input or defaults."""
    config = config or DEFAULT_CONFIG
    return f"User Id={config['user']}; Location={config['database']};"
```

出于测试目的，可以把 `DEFAULT_CONFIG` 字典补丁为特定值：

```python
# contents of test_app.py
# app.py with the connection string function (prior code block)
import app


def test_connection(monkeypatch):
    # Patch the values of DEFAULT_CONFIG to specific
    # testing values only for this test.
    monkeypatch.setitem(app.DEFAULT_CONFIG, "user", "test_user")
    monkeypatch.setitem(app.DEFAULT_CONFIG, "database", "test_db")

    # expected result based on the mocks
    expected = "User Id=test_user; Location=test_db;"

    # the test uses the monkeypatched dictionary settings
    result = app.create_connection_string()
    assert result == expected
```

可以用 `monkeypatch.delitem` 移除值：

```python
# contents of test_app.py
import pytest

# app.py with the connection string function
import app


def test_missing_user(monkeypatch):
    # patch the DEFAULT_CONFIG to be missing the 'user' key
    monkeypatch.delitem(app.DEFAULT_CONFIG, "user", raising=False)

    # Key error expected because a config is not passed, and the
    # default is now missing the 'user' entry.
    with pytest.raises(KeyError):
        _ = app.create_connection_string()
```

fixture 的模块化让你可以为每种潜在的 mock 定义单独的 fixture，并在需要的测试中引用：

```python
# contents of test_app.py
import pytest

# app.py with the connection string function
import app


# all of the mocks are moved into separated fixtures
@pytest.fixture
def mock_test_user(monkeypatch):
    """Set the DEFAULT_CONFIG user to test_user."""
    monkeypatch.setitem(app.DEFAULT_CONFIG, "user", "test_user")


@pytest.fixture
def mock_test_database(monkeypatch):
    """Set the DEFAULT_CONFIG database to test_db."""
    monkeypatch.setitem(app.DEFAULT_CONFIG, "database", "test_db")


@pytest.fixture
def mock_missing_default_user(monkeypatch):
    """Remove the user key from DEFAULT_CONFIG"""
    monkeypatch.delitem(app.DEFAULT_CONFIG, "user", raising=False)


# tests reference only the fixture mocks that are needed
def test_connection(mock_test_user, mock_test_database):
    expected = "User Id=test_user; Location=test_db;"

    result = app.create_connection_string()
    assert result == expected


def test_missing_user(mock_missing_default_user):
    with pytest.raises(KeyError):
        _ = app.create_connection_string()
```

（`MonkeyPatch` 类的完整 API 见官方 `MonkeyPatch` 文档。）

## 如何在测试中编写与报告断言（assert）

### 用 `assert` 语句断言

`pytest` 允许你使用标准 Python `assert` 语句验证测试中的预期与取值。例如：

```python
# content of test_assert1.py
def f():
    return 3


def test_function():
    assert f() == 4
```

以此断言函数返回某个值。断言失败时你会看到函数调用的返回值：

```text
$ pytest test_assert1.py
=========================== test session starts ============================
platform linux -- Python 3.x.y, pytest-9.x.y, pluggy-1.x.y
rootdir: /home/sweet/project
collected 1 item

test_assert1.py F                                                    [100%]

================================= FAILURES =================================
_______________________________ test_function ______________________________

    def test_function():
>       assert f() == 4
E       assert 3 == 4
E        +  where 3 = f()

test_assert1.py:6: AssertionError
========================= short test summary info ==========================
FAILED test_assert1.py::test_function - assert 3 == 4
============================ 1 failed in 0.12s =============================
```

`pytest` 支持展示最常见子表达式的取值，包括调用、属性、比较、二元与一元运算符（详见官方报告演示）。这让你使用地道的 Python 结构而无需样板代码，同时不丢失内省信息。

如果断言带有消息：

```python
assert a % 2 == 0, "value was odd, should be even"
```

它会与断言内省信息一起打印在 traceback 中。

### 关于近似相等的断言

比较浮点值（或浮点数组）时，微小的舍入误差很常见。与其用 `assert abs(a - b) < tol` 或 `numpy.isclose`，可以用 `pytest.approx`：

```python
import pytest
import numpy as np


def test_floats():
    assert (0.1 + 0.2) == pytest.approx(0.3)


def test_arrays():
    a = np.array([1.0, 2.0, 3.0])
    b = np.array([0.9999, 2.0001, 3.0])
    assert a == pytest.approx(b)
```

`pytest.approx` 支持标量、列表、字典与 NumPy 数组，也支持涉及 NaN 的比较。

### 关于预期异常的断言

要对抛出的异常写断言，可以像这样把 `pytest.raises` 用作上下文管理器：

```python
import pytest


def test_zero_division():
    with pytest.raises(ZeroDivisionError):
        1 / 0
```

如果需要访问实际异常信息，可以这样：

```python
def test_recursion_depth():
    with pytest.raises(RuntimeError) as excinfo:

        def f():
            f()

        f()
    assert "maximum recursion" in str(excinfo.value)
```

`excinfo` 是 `ExceptionInfo` 实例，是对所抛实际异常的包装。主要关注的属性是 `.type`、`.value` 与 `.traceback`。

注意：`pytest.raises` 会匹配异常类型或其任何子类（与标准 `except` 语句一致）。想检查代码块抛出的是否是"精确"的异常类型，需要显式检查：

```python
def test_foo_not_implemented():
    def foo():
        raise NotImplementedError

    with pytest.raises(RuntimeError) as excinfo:
        foo()
    assert excinfo.type is RuntimeError
```

`pytest.raises` 调用会成功——即使函数抛出的是 `NotImplementedError`（因为它是 `RuntimeError` 的子类）——但接下来的 `assert` 语句会抓住该问题。

#### 匹配异常消息

可以给上下文管理器传 `match` 关键字参数，测试正则表达式是否匹配异常的字符串表示（类似 unittest 的 `TestCase.assertRaisesRegex` 方法）：

```python
import pytest


def myfunc():
    raise ValueError("Exception 123 raised")


def test_match():
    with pytest.raises(ValueError, match=r".* 123 .*"):
        myfunc()
```

注意：

- `match` 参数用 `re.search` 函数匹配，所以上例中 `match='123'` 也能通过。
- `match` 参数也会匹配 [PEP-678](https://peps.python.org/pep-0678/) 的 `__notes__`。

#### 关于预期异常组的断言

预期 `BaseExceptionGroup` 或 `ExceptionGroup` 时可以使用 `pytest.RaisesGroup`：

```python
def test_exception_in_group():
    with pytest.RaisesGroup(ValueError):
        raise ExceptionGroup("group msg", [ValueError("value msg")])
    with pytest.RaisesGroup(ValueError, TypeError):
        raise ExceptionGroup("msg", [ValueError("foo"), TypeError("bar")])
```

它接受 `match` 参数（对组消息检查）和 `check` 参数（接收任意可调用对象，把组传给它，仅当可调用对象返回 `True` 时才成功）：

```python
def test_raisesgroup_match_and_check():
    with pytest.RaisesGroup(BaseException, match="my group msg"):
        raise BaseExceptionGroup("my group msg", [KeyboardInterrupt()])
    with pytest.RaisesGroup(
        Exception, check=lambda eg: isinstance(eg.__cause__, ValueError)
    ):
        raise ExceptionGroup("", [TypeError()]) from ValueError()
```

与 `except*` 不同，它对结构和未包装异常是严格的，因此你可能需要设置 `flatten_subgroups` 和/或 `allow_unwrapped` 参数：

```python
def test_structure():
    with pytest.RaisesGroup(pytest.RaisesGroup(ValueError)):
        raise ExceptionGroup("", (ExceptionGroup("", (ValueError(),)),))
    with pytest.RaisesGroup(ValueError, flatten_subgroups=True):
        raise ExceptionGroup("1st group", [ExceptionGroup("2nd group", [ValueError()])])
    with pytest.RaisesGroup(ValueError, allow_unwrapped=True):
        raise ValueError
```

要更详细地指定所含异常，可以使用 `pytest.RaisesExc`：

```python
def test_raises_exc():
    with pytest.RaisesGroup(pytest.RaisesExc(ValueError, match="foo")):
        raise ExceptionGroup("", (ValueError("foo")))
```

二者都提供 `matches()` 方法，用于在上下文管理器之外做匹配。检查 `.__context__` 或 `.__cause__` 时会有帮助：

```python
def test_matches():
    exc = ValueError()
    exc_group = ExceptionGroup("", [exc])
    if RaisesGroup(ValueError).matches(exc_group):
        ...
    # 匹配失败时可在 `.fail_reason` 中拿到有用的错误信息
    r = RaisesExc(ValueError)
    assert r.matches(e), r.fail_reason
```

更多细节与示例见 `pytest.RaisesGroup` 与 `pytest.RaisesExc` 文档。

#### `ExceptionInfo.group_contains()`

> **警告**：该辅助器便于检查"特定异常存在"，但非常不适合检查"组中*不*包含*任何其他*异常"。例如下面这样会通过：
>
> ```python
> class EXTREMELYBADERROR(BaseException):
>     """This is a very bad error to miss"""
>
>
> def test_for_value_error():
>     with pytest.raises(ExceptionGroup) as excinfo:
>         excs = [ValueError()]
>         if very_unlucky():
>             excs.append(EXTREMELYBADERROR())
>         raise ExceptionGroup("", excs)
>     # 无论是否有其他异常这都会通过。
>     assert excinfo.group_contains(ValueError)
> ```
>
> 没有好办法用 `excinfo.group_contains()` 确保除预期异常外*不*得到任何其他异常。应改用 `pytest.RaisesGroup`（见上一节）。

也可以用 `excinfo.group_contains()` 方法测试 `ExceptionGroup` 中返回的异常：

```python
def test_exception_in_group():
    with pytest.raises(ExceptionGroup) as excinfo:
        raise ExceptionGroup(
            "Group message",
            [
                RuntimeError("Exception 123 raised"),
            ],
        )
    assert excinfo.group_contains(RuntimeError, match=r".* 123 .*")
    assert not excinfo.group_contains(TypeError)
```

可选的 `match` 关键字参数与 `pytest.raises` 的用法相同。默认情况下 `group_contains()` 会在任意层级的嵌套 `ExceptionGroup` 中递归搜索匹配的异常。如果只想匹配特定层级的异常，可指定 `depth` 关键字参数：直接包含在顶层 `ExceptionGroup` 中的异常对应 `depth=1`。

```python
def test_exception_in_group_at_given_depth():
    with pytest.raises(ExceptionGroup) as excinfo:
        raise ExceptionGroup(
            "Group message",
            [
                RuntimeError(),
                ExceptionGroup(
                    "Nested group",
                    [
                        TypeError(),
                    ],
                ),
            ],
        )
    assert excinfo.group_contains(RuntimeError, depth=1)
    assert excinfo.group_contains(TypeError, depth=2)
    assert not excinfo.group_contains(RuntimeError, depth=2)
    assert not excinfo.group_contains(TypeError, depth=1)
```

#### `pytest.raises` 的另一形式（遗留）

`pytest.raises` 还有一种形式：传入将被执行的函数以及 `*args`、`**kwargs`。`pytest.raises` 会以这些参数执行函数并断言抛出给定异常：

```python
def func(x):
    if x <= 0:
        raise ValueError("x needs to be larger than zero")


pytest.raises(ValueError, func, x=-1)
```

这种形式是最初的 `pytest.raises` API，开发于 `with` 语句加入 Python 之前。如今很少使用，上下文管理器形式（用 `with`）被认为可读性更好。

#### xfail 标记与 pytest.raises

`pytest.mark.xfail` 也可以指定 `raises` 参数，以比"抛出任意异常"更具体的方式检查测试的失败：

```python
def f():
    raise IndexError()


@pytest.mark.xfail(raises=IndexError)
def test_f():
    f()
```

只有当测试因抛出 `IndexError` 或其子类而失败时才算"xfail"。

- 用 `pytest.mark.xfail` 加 `raises` 参数，更适合记录未修复的 bug（测试描述"应该"发生什么）或依赖库的 bug。
- 用 `pytest.raises` 更适合测试你自己的代码刻意抛出的异常——这是多数情况。

也可以使用 `pytest.RaisesGroup`：

```python
def f():
    raise ExceptionGroup("", [IndexError()])


@pytest.mark.xfail(raises=RaisesGroup(IndexError))
def test_f():
    f()
```

### 关于预期警告的断言

可以用 `pytest.warns` 检查代码是否发出特定警告。

### 利用上下文相关的比较

`pytest` 在遇到比较失败时提供丰富的上下文相关信息。例如：

```python
# content of test_assert2.py
def test_set_comparison():
    set1 = set("1308")
    set2 = set("8035")
    assert set1 == set2
```

运行该模块：

```text
$ pytest test_assert2.py
=========================== test session starts ============================
platform linux -- Python 3.x.y, pytest-9.x.y, pluggy-1.x.y
rootdir: /home/sweet/project
collected 1 item

test_assert2.py F                                                    [100%]

================================= FAILURES =================================
___________________________ test_set_comparison ____________________________

    def test_set_comparison():
        set1 = set("1308")
        set2 = set("8035")
>       assert set1 == set2
E       AssertionError: assert {'0', '1', '3', '8'} == {'0', '3', '5', '8'}
E
E         Extra items in the left set:
E         '1'
E         Extra items in the right set:
E         '5'
E         Use -v to get more diff

test_assert2.py:4: AssertionError
========================= short test summary info ==========================
FAILED test_assert2.py::test_set_comparison - AssertionError: assert {'0'...
============================ 1 failed in 0.12s =============================
```

对若干情形有专门的比较展示：

- 比较长字符串：显示上下文 diff；
- 比较长序列：显示首个失败的下标；
- 比较字典：显示不同的条目。

更多示例见官方"报告演示"。

### 为失败断言自定义解释

可以实现 `pytest_assertrepr_compare` 钩子添加你自己的详细解释。

例如，在 `conftest.py` 中加入以下钩子，为 `Foo` 对象提供替代解释：

```python
# content of conftest.py
from test_foocompare import Foo


def pytest_assertrepr_compare(op, left, right):
    if isinstance(left, Foo) and isinstance(right, Foo) and op == "==":
        return [
            "Comparing Foo instances:",
            f"   vals: {left.val} != {right.val}",
        ]
```

给定这个测试模块：

```python
# content of test_foocompare.py
class Foo:
    def __init__(self, val):
        self.val = val

    def __eq__(self, other):
        return self.val == other.val


def test_compare():
    f1 = Foo(1)
    f2 = Foo(2)
    assert f1 == f2
```

运行测试模块即可得到 conftest 文件中定义的定制输出：

```text
$ pytest -q test_foocompare.py
F                                                                    [100%]
================================= FAILURES =================================
_______________________________ test_compare _______________________________

    def test_compare():
        f1 = Foo(1)
        f2 = Foo(2)
>       assert f1 == f2
E       assert Comparing Foo instances:
E            vals: 1 != 2

test_foocompare.py:12: AssertionError
========================= short test summary info ==========================
FAILED test_foocompare.py::test_compare - assert Comparing Foo instances:
1 failed in 0.12s
```

### 测试函数中返回非 None 值

当测试函数返回 `None` 以外的值时，会发出 `pytest.PytestReturnNotNoneWarning`。这有助于防止新手常见错误：以为返回 `bool`（如 `True`/`False`）能决定测试通过与否。

示例：

```python
@pytest.mark.parametrize(
    ["a", "b", "result"],
    [
        [1, 2, 5],
        [2, 3, 8],
        [5, 3, 18],
    ],
)
def test_foo(a, b, result):
    return foo(a, b) == result  # Incorrect usage, do not do this.
```

由于 pytest 忽略返回值，测试永远不会因返回值而失败，这可能让人意外。正确的做法是把 `return` 换成 `assert`：

```python
@pytest.mark.parametrize(
    ["a", "b", "result"],
    [
        [1, 2, 5],
        [2, 3, 8],
        [5, 3, 18],
    ],
)
def test_foo(a, b, result):
    assert foo(a, b) == result
```

### 断言内省细节

失败断言的详细报告是通过在运行前重写（rewrite）assert 语句实现的。重写后的 assert 语句会把内省信息放进断言失败消息。`pytest` 只重写其测试收集过程直接发现的测试模块，因此**支持模块（本身不是测试模块）中的 assert 不会被重写**。

可以在导入某个导入模块之前调用 `register_assert_rewrite` 手动为它启用断言重写（好的位置是根 `conftest.py`）。

更多信息：Benjamin Peterson 撰写的《Behind the scenes of pytest's new assertion rewriting》。

#### 断言重写会把文件缓存到磁盘

`pytest` 会把重写后的模块写回磁盘缓存。可以禁用该行为（例如避免在经常移动文件的项目里留下过期的 `.pyc`），在 `conftest.py` 顶部加：

```python
import sys

sys.dont_write_bytecode = True
```

注意你仍然享有断言内省的收益，唯一变化是 `.pyc` 文件不再缓存到磁盘。此外，当无法写入新的 `.pyc` 文件（如只读文件系统或 zipfile 内）时，重写会静默跳过缓存。

#### 禁用断言重写

`pytest` 通过导入钩子写入新 `pyc` 文件，在导入时重写测试模块。多数时候这透明无感；但如果你自己在操作导入机制，导入钩子可能造成干扰。此时有两个选择：

- 给特定模块的 docstring 加上字符串 `PYTEST_DONT_REWRITE`，禁用该模块的重写。
- 用 `--assert=plain` 禁用所有模块的重写。

---

> **来源**：本文由 pytest 官方文档以下页面完整翻译并合并而成：[Get Started（开始）](https://docs.pytest.org/en/stable/getting-started.html)、[How-to guides 索引](https://docs.pytest.org/en/stable/how-to/index.html)、[How to invoke pytest（调用 pytest）](https://docs.pytest.org/en/stable/how-to/usage.html)、[How to write and report assertions（断言）](https://docs.pytest.org/en/stable/how-to/assert.html)、[How to parametrize fixtures and test functions（参数化）](https://docs.pytest.org/en/stable/how-to/parametrize.html)、[How to use skip and xfail（跳过与预期失败）](https://docs.pytest.org/en/stable/how-to/skipping.html)、[How to monkeypatch/mock modules and environments](https://docs.pytest.org/en/stable/how-to/monkeypatch.html)。作者 Holger Krekel 与 pytest 开发团队，许可 MIT 许可证。抓取于 2026-09-13。

---

> 编者注：How-to 目录中的其余指南（fixtures、mark、subtests、tmp_path、doctest、cache、失败与输出、捕获、日志、插件编写、unittest 集成、xunit_setup、existingtestsuite、bash 补全等）未逐篇收录，请从官方 [How-to 索引页](https://docs.pytest.org/en/stable/how-to/index.html)进入对应页面阅读；fixtures 的权威参考见官方 "How to use fixtures" 与 API 参考。
