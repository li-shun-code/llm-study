---
title: 日志 logging：LLM 应用排障必备
source_url: https://docs.python.org/zh-cn/3/howto/logging.html
author: Vinay Sajip（Python 官方文档团队）
license: PSF 许可证第 2 版（GPL 兼容）
fetched_at: 2026-09-13
translated: false
order: 16
versions: Python 3.14 / logging
---

> **来源**：本文转载自 [日志指南 — Python 3.14.7 文档](https://docs.python.org/zh-cn/3/howto/logging.html)，作者 Vinay Sajip（Python 官方文档团队），许可 PSF 许可证第 2 版。抓取于 2026-09-13。

> 编者注：LLM 应用大量依赖外部服务（模型 API、向量库、数据库），一次请求要跨多个组件，没有日志几乎无法排障。本篇节选官方《日志指南》HOWTO 的基础与进阶教程；进阶实践（结构化日志、Trace ID 串联）见文末编者补充。

## 日志基础教程

日志是对软件执行时所发生事件的一种追踪方式。软件开发人员对他们的代码添加日志调用，借此来指示某事件的发生。一个事件通过一些包含变量数据的描述信息来描述（比如：每个事件发生时的数据都是不同的）。开发者还会区分事件的重要性，重要性也被称为**等级**或**严重性**。

### 什么时候使用日志

你可以通过执行 `logger = logging.getLogger(__name__)` 创建一个日志记录器，然后调用日志记录器的 `debug()`、`info()`、`warning()`、`error()` 和 `critical()` 方法来使用日志记录功能。要确定何时使用日志记录、以及确定要使用哪个方法，请参阅下表：

| 你想要执行的任务 | 此任务最好的工具 |
| --- | --- |
| 对于命令行或程序的应用，结果显示在控制台 | `print()` |
| 在对程序的普通操作发生时提交事件报告（如：状态监控和错误调查） | 日志记录器的 `info()`（或对于诊断目的需要非常详细的输出时则使用 `debug()`） |
| 提出一个警告信息基于一个特殊的运行时事件 | `warnings.warn()` 位于代码库中，该事件是可以避免的，需要修改客户端应用以消除告警 |
| 对于客户端应用无法干预，但事件仍然需要被关注的场合 | 日志记录器的 `warning()` 方法 |
| 对一个特殊的运行时事件报告错误 | 引发异常 |
| 报告错误而不引发异常（如在长时间运行中的服务端进程的错误处理） | 日志记录器的 `error()`、`exception()` 或 `critical()` 方法 |

日志记录器方法以它们所追踪的事件级别或严重程度来命名。标准的级别及其适用性如下所述（严重程度从低至高）：

| 级别 | 何时使用 |
| --- | --- |
| `DEBUG` | 细节信息，仅当诊断问题时适用 |
| `INFO` | 确认程序按预期运行 |
| `WARNING` | 表明有已经或即将发生的意外（例如：磁盘空间不足）。程序仍按预期进行 |
| `ERROR` | 由于严重的问题，程序的某些功能已经不能正常执行 |
| `CRITICAL` | 严重的错误，表明程序已不能继续执行 |

默认的级别是 `WARNING`，意味着只会追踪该严重程度及以上的事件，除非 logging 包另有其他配置。

### 一个简单的例子

```python
import logging
logging.warning('Watch out!')  # 将打印一条消息到控制台
logging.info('I told you so')  # 将不打印任何消息
```

运行后你将会看到：

```
WARNING:root:Watch out!
```

在控制台上打印出来。`INFO` 消息没有出现是因为默认级别为 `WARNING`。

请注意在这个例子中，我们是直接使用 `logging` 模块的函数（如 `logging.debug`），而不是创建一个日志记录器并调用其方法。这些函数作用于**根日志记录器**。然而在更大的程序中你通常会需要显式地控制日志记录的配置——所以最好还是创建日志记录器并调用其方法。

### 记录日志到文件

一种很常见的情况是将日志事件记录到文件中：

```python
import logging
logger = logging.getLogger(__name__)
logging.basicConfig(filename='example.log', encoding='utf-8', level=logging.DEBUG)
logger.debug('This message should go to the log file')
logger.info('So should this')
logger.warning('And this, too')
logger.error('And non-ASCII stuff, too, like Øresund and Malmö')
```

现在，如果我们打开日志文件，我们应当能看到日志信息：

```
DEBUG:__main__:This message should go to the log file
INFO:__main__:So should this
WARNING:__main__:And this, too
ERROR:__main__:And non-ASCII stuff, too, like Øresund and Malmö
```

该示例同样展示了如何设置日志追踪级别的阈值：设置的阈值是 `DEBUG`，所有信息都将被打印。3.9 起增加了 `encoding` 参数。

**重要**：对 `basicConfig()` 的调用应当在任何对日志记录器方法的调用**之前**执行，否则日志记录事件可能无法以预期的方式来处理。如果多次运行上述脚本，连续运行的消息将追加到文件 *example.log*；如果希望每次运行重新开始，则指定 `filemode='w'`。

### 记录变量数据

要记录变量数据，请使用格式字符串作为事件描述消息，并附加传入变量数据作为参数：

```python
import logging
logging.warning('%s before you %s', 'Look', 'leap!')
# WARNING:root:Look before you leap!
```

将可变数据合并到事件描述消息使用旧的 `%` 形式的字符串格式化——这是为了延迟格式化：只有该条日志真的会被输出时才做字符串拼接，比 f-string 预先拼好更省性能。

### 更改显示消息的格式

要更改用于显示消息的格式，你需要指定要使用的格式：

```python
import logging
logging.basicConfig(format='%(asctime)s %(levelname)s:%(message)s', level=logging.DEBUG)
logging.warning('is when this event was logged.')
# 2010-12-12 11:41:42,612 WARNING:is when this event was logged.
```

`%(asctime)s` 显示事件的日期/时间，默认格式类似 ISO8601 或 RFC 3339；需要更多控制时为 `basicConfig` 提供 `datefmt` 参数（格式与 `time.strftime()` 支持的格式相同）。文档《LogRecord 属性》列出了可在格式字符串中出现的所有内容。

## 进阶日志教程

日志库采用模块化方法，并提供几类组件：

- **记录器（Logger）**暴露了应用程序代码直接使用的接口；
- **处理器（Handler）**将日志记录（由记录器创建）发送到适当的目标；
- **过滤器（Filter）**提供了更细粒度的功能，用于确定要输出的日志记录；
- **格式器（Formatter）**指定最终输出中日志记录的样式。

日志事件信息在 `LogRecord` 实例中的记录器、处理器、过滤器和格式器之间传递。

### 记录器

在命名记录器时使用的一个好习惯是在每个使用日志记录的模块中使用**模块级记录器**：

```python
logger = logging.getLogger(__name__)
```

这意味着记录器名称跟踪包或模块的层次结构（以点分隔），并且直观地从记录器名称显示记录事件的位置。多次调用 `getLogger()` 具有相同的名称将返回对同一记录器对象的引用。

记录器具有**有效等级**的概念：如果未在记录器上显式设置级别，则使用其父记录器的级别，依此类推直到根记录器（默认 `WARNING`）。子记录器将消息**传播**到与其父级记录器关联的处理器，因此不必为所有记录器配置处理器——一般为顶级记录器配置处理器就足够了。

最常用的消息方法：

- `logger.debug/info/warning/error/critical(...)`：创建对应级别的日志记录；
- `logger.exception(...)`：与 `error()` 相似，但**同时记录当前的堆栈追踪**。仅在异常处理程序中调用此方法；
- `logger.log(level, ...)`：将日志级别作为显式参数（用于自定义级别）。

### 处理器

`Handler` 对象负责将适当的日志消息分派给指定的目标。例如：应用程序可能希望将所有日志消息发送到日志文件、将 ERROR 及以上的消息发送到标准输出、将所有 CRITICAL 消息发送至一个邮件地址——此方案需要三个单独的处理器。标准库包含很多处理器类型（`StreamHandler`、`FileHandler`、`RotatingFileHandler`、HTTP/SMTP/队列处理器等，见《有用的处理器》）。

处理器上的常用方法：`setLevel()`（决定该处理器将发送哪些消息——注意与记录器的 `setLevel()` 是两级过滤）、`setFormatter()`、`addFilter()`。应用程序代码不应直接实例化 `Handler` 基类，而是使用其子类。

### 格式器

格式化器对象配置日志消息的最终顺序、结构和内容，构造函数有三个可选参数——消息格式字符串、日期格式字符串和样式指示符（`'%'`、`'{'` 或 `'$'`）。以下消息格式字符串将以人类可读的格式记录时间、严重性和消息内容：

```
'%(asctime)s - %(levelname)s - %(message)s'
```

### 配置日志记录

开发者可以通过三种方式配置日志记录：

1. 使用 Python 代码显式创建记录器、处理器和格式器；
2. 创建日志配置文件并使用 `fileConfig()` 函数读取它；
3. 创建配置信息字典并将其传递给 `dictConfig()` 函数（3.2 起推荐，是配置文件方法的功能超集，可用 JSON/YAML 填充）。

以下是显式代码配置的完整示例：

```python
import logging

# 创建日志记录器 logger
logger = logging.getLogger('simple_example')
logger.setLevel(logging.DEBUG)

# 创建控制台处理器 ch 并将等级设为 debug
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)

# 创建格式化器 formatter
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# 将 formatter 添加到 ch，将 ch 添加到 logger
ch.setFormatter(formatter)
logger.addHandler(ch)

# '应用程序' 代码
logger.debug('debug message')
logger.info('info message')
logger.warning('warn message')
logger.error('error message')
logger.critical('critical message')
```

运行输出：

```
2005-03-19 15:10:26,618 - simple_example - DEBUG - debug message
2005-03-19 15:10:26,620 - simple_example - INFO - info message
2005-03-19 15:10:26,695 - simple_example - WARNING - warn message
2005-03-19 15:10:26,697 - simple_example - ERROR - error message
2005-03-19 15:10:26,773 - simple_example - CRITICAL - critical message
```

**警告**：`fileConfig()` 和 `dictConfig()` 都有一个默认为 `True` 的 `disable_existing_loggers` 参数——除非在配置中明确命名，调用之前已存在的非 root 记录器会被禁用。这与许多人的期望不同，必要时请显式传 `False`。

### 为库配置日志

如果你在开发**库**（而非应用）：

- 强烈建议**不要将日志记录到根记录器**，而为你的库的最高层级包或模块使用 `__name__` 这样的记录器；
- 强烈建议**不要将 `NullHandler` 以外的任何处理器添加到库的记录器中**——处理器的配置是使用你的库的应用程序开发者的权利：

```python
import logging
logging.getLogger('foo').addHandler(logging.NullHandler())
```

## LLM 应用日志实践（编者补充）

1. **为什么不用 print**：`print` 无法分级、无法关闭、无法重定向到文件/采集系统；logging 一个配置就能同时输出到控制台（开发）与文件（生产），模块 12 里 `docker logs` 看到的正是标准错误流上的日志。
2. **每次调用 LLM 都记 INFO**：请求参数摘要、模型名、耗时、token 用量——`logger.info('llm call model=%s latency=%.2fs tokens=%d', model, dt, tokens)`。出错时用 `logger.exception('llm call failed')` 把堆栈一起记下来（配合本模块第 4/9 篇的异常处理）。
3. **请求 ID 串联**：给每次用户请求生成一个 request id，放进日志格式或用 `logging.Filter` 注入，排障时一个 ID 就能检索整条链路；需要跨服务追踪时再上 OpenTelemetry（模块 9 的可观测性篇）。
4. **进阶阅读**：官方《日志专题手册》（Logging Cookbook，https://docs.python.org/zh-cn/3/howto/logging-cookbook.html ）覆盖多模块日志、按大小/时间轮转文件、结构化日志等生产场景。
