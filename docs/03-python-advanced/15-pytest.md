---
title: pytest 测试入门
source_url: https://docs.pytest.org/en/stable/getting-started.html
author: pytest-dev 团队及贡献者
license: MIT License
fetched_at: 2026-09-13
translated: true
order: 15
versions: pytest 9.x
---

> **来源**：本文翻译自 [Get Started — pytest documentation](https://docs.pytest.org/en/stable/getting-started.html)，作者 pytest-dev 团队及贡献者，许可 MIT License。抓取于 2026-09-13。

> 编者注：pytest 是 Python 生态事实上的测试标准。LLM 应用的不确定性更高（模型输出、网络、解析都可能出错），"核心逻辑单测 + 关键路径集成测试"不是可选项而是生产化底线——模块 11 的"TDD with AI"也以本篇为前置。本篇为官方 Get Started 的中文翻译，略有删节。

## 安装 pytest

1. 在命令行运行以下命令：

   ```
   pip install -U pytest
   ```

2. 检查你安装了正确的版本：

   ```
   $ pytest --version
   pytest 9.1.1
   ```

## 创建你的第一个测试

创建一个名为 `test_sample.py` 的新文件，包含一个函数和一个测试：

```python
# content of test_sample.py
def func(x):
    return x + 1

def test_answer():
    assert func(3) == 5
```

运行测试：

```
$ pytest
=========================== test session starts ============================
platform linux -- Python 3.x.y, pytest-9.x.y, pluggy-1.x.y
rootdir: /home/sweet/project
collected 1 item

test_sample.py F                                                     [100%]

================================= FAILURES =================================
________________________________ test_answer ________________________________

    def test_answer():
>       assert func(3) == 5
E       assert 4 == 5
E        +  where 4 = func(3)

test_sample.py:6: AssertionError
========================= short test summary info ==========================
FAILED test_sample.py::test_answer - assert 4 == 5
============================ 1 failed in 0.12s =============================
```

`[100%]` 指的是运行所有测试用例的整体进度。结束后，pytest 显示了一份失败报告，因为 `func(3)` 没有返回 `5`。

**注意**：你可以使用 `assert` 语句来验证测试预期。pytest 的高级断言内省（assertion introspection）会智能地报告断言表达式的中间值，让你不必使用 `unittest` 风格的 `self.assertEqual` 等大量记忆负担重的断言方法——**直接写原生 `assert` 就好**。

## 运行多个测试

`pytest` 会运行当前目录及其子目录下所有形如 `test_*.py` 或 `*_test.py` 的文件，并执行其中所有 `test_` 前缀的函数。这就是它的标准测试发现规则。

## 断言抛出特定异常

使用 `raises` 辅助函数来断言某些代码会抛出异常：

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

```
$ pytest -q test_sysexit.py
.                                                                    [100%]
1 passed in 0.12s
```

**注意**：`-q/--quiet` 标志让输出保持简短。还可以在 `raises` 里指定更详细的预期异常信息（如匹配异常消息：`pytest.raises(ValueError, match="invalid")`）。

## 在类中分组多个测试

开发了多个测试后，你可能想把它们分组到类里。pytest 让这件事变得简单：

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

pytest 按照其 Python 测试发现约定找到两个 `test_` 前缀的函数。**无需继承任何东西**，但要确保类名以 `Test` 开头，否则该类会被跳过：

```
$ pytest -q test_class.py
.F                                                                   [100%]
...
FAILED test_class.py::TestClass::test_two - AssertionError: assert False
1 failed, 1 passed in 0.12s
```

第一个测试通过，第二个失败。你可以轻松看到断言中的中间值，帮助你理解失败的原因。

在类中分组测试有这些好处：

- 测试组织；
- 仅为该类中的测试共享 fixtures；
- 在类级别应用标记（marks）并让它们隐式应用于所有测试。

需要注意：**每个测试都会获得该类的一个唯一实例**。让每个测试共享同一个类实例会严重损害测试隔离性：

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

运行 `pytest -k TestClassDemoInstance -q` 的结果是 `1 failed, 1 passed`——`test_two` 里的 `self.value` 是 `0`，因为两个测试运行在**不同实例**上。（注意：类级别添加的属性是**类属性**，会在测试之间共享——那才是真正跨测试保留值的方式，但通常不是你想要的。）

## 用 pytest.approx 比较浮点数

pytest 还提供了许多让编写测试更轻松的实用工具。例如，可以用 `pytest.approx()` 来比较可能存在微小舍入误差的浮点值：

```python
# content of test_approx.py
import pytest

def test_sum():
    assert (0.1 + 0.2) == pytest.approx(0.3)
```

这避免了手动容差判断或使用 `math.isclose`，并且适用于标量、列表和 NumPy 数组。

## 为功能测试请求一个唯一的临时目录

pytest 提供**内置 fixtures/函数参数**来请求任意资源，比如一个唯一的临时目录：

```python
# content of test_tmp_path.py
def test_needsfiles(tmp_path):
    print(tmp_path)
    assert 0
```

在测试函数签名中列出 `tmp_path` 这个名字，pytest 就会查找并调用一个 fixture 工厂，在执行测试函数调用之前创建该资源——每次测试调用都会得到一个独立的临时目录：

```
$ pytest -q test_tmp_path.py
...
tmp_path = PosixPath('PYTEST_TMPDIR/test_needsfiles0')
```

使用以下命令查看存在哪些内置（及自定义）fixtures：

```
pytest --fixtures   # shows builtin and custom fixtures
```

## 下一步读什么

官方文档接下来推荐：

- 《How to invoke pytest》：命令行调用示例；
- 《How to use pytest with an existing test suite》；
- 《How to mark test functions with attributes》：`pytest.mark` 机制（skip、xfail、自定义标记）；
- 《Fixtures reference》：为测试提供功能基线（fixture 是 pytest 最强大的机制——把"准备数据/客户端/环境"从测试中抽出来复用）；
- 《Writing plugins》；《Good Integration Practices》：虚拟环境与测试目录布局。

## 在 LLM 项目里怎么用（编者补充）

- **能单测的先单测**：prompt 模板的变量填充、模型输出的 JSON 解析（配 Pydantic 校验）、重试与限流逻辑——这些都是确定性的，用 pytest 穷举边界；
- **mock 外部依赖**：调 LLM API 的函数用假响应/录制的响应测试，不要在 CI 里烧真钱（可配合 `pytest.mark` 把真实 API 测试标记为需要手动触发）；
- **测试目录约定**：测试文件与被测代码分开放（如 `tests/`），配合 `uv`/`pytest` 的配置把 `pyproject.toml` 里的 `[tool.pytest.ini_options]` 设好（见下一篇工程化）；
- AI 编码工具写完代码，让它在提交前跑 `pytest` 全绿——这是模块 11"Vibe Coding"里最基本的质量闸门。
