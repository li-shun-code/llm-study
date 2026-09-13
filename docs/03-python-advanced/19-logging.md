---
title: 日志 logging：HOWTO 与 logging.config
source_url: https://docs.python.org/zh-cn/3/howto/logging.html
author: Vinay Sajip（Python 官方文档团队）
license: PSF 许可证第 2 版
fetched_at: 2026-09-13
translated: false
order: 19
versions: Python 3.14 官方文档
---

**作者:**

Vinay Sajip （Vinay Sajip）

本页面包含教学信息。要获取参考信息和日志记录指导书的链接，请查看 其他资源。

## 日志基础教程

日志是对软件执行时所发生事件的一种追踪方式。软件开发人员对他们的代码添加日志调用，借此来指示某事件的发生。一个事件通过一些包含变量数据的描述信息来描述（比如：每个事件发生时的数据都是不同的）。开发者还会区分事件的重要性，重要性也被称为 _等级_ 或 _严重性_。

### 什么时候使用日志

你可以通过执行 `logger = logging.getLogger(__name__)` 创建一个日志记录器，然后调用日志记录器的 `debug()`, `info()`, `warning()`, `error()` 和 `critical()` 方法来使用日志记录功能。 要确定何时使用日志记录，以及确定要使用哪个日志记录器方法，请参阅下表。 它针对一组常见任务中的每一个都列出了最适合该任务的工具。

你想要执行的任务

此任务最好的工具

对于命令行或程序的应用，结果显示在控制台。

`print()`

在对程序的普通操作发生时提交事件报告 (比如：状态监控和错误调查)

日志记录器的 `info()` (或者对于诊断目的需要非常详细的输出时则使用 `debug()` 方法)

提出一个警告信息基于一个特殊的运行时事件

`warnings.warn()` 位于代码库中，该事件是可以避免的，需要修改客户端应用以消除告警

对于客户端应用无法干预，但事件仍然需要被关注的场合则使用日志记录器的 `warning()` 方法

对一个特殊的运行时事件报告错误

引发异常

报告错误而不引发异常 (如在长时间运行中的服务端进程的错误处理)

日志记录器的 `error()`, `exception()` 或 `critical()` 方法分别适用于特定的错误及应用领域

日志记录器方法以它们所追踪的事件级别或严重程度来命名。标准的级别及其适用性如下所述（严重程度从低至高）：

级别

何时使用

`DEBUG`

细节信息，仅当诊断问题时适用。

`INFO`

确认程序按预期运行。

`WARNING`

表明有已经或即将发生的意外（例如：磁盘空间不足）。程序仍按预期进行。

`ERROR`

由于严重的问题，程序的某些功能已经不能正常执行

`CRITICAL`

严重的错误，表明程序已不能继续执行

默认的级别是 `WARNING`，意味着只会追踪该严重程度及以上的事件，除非 logging 包另有其他配置。

所追踪事件可以以不同形式处理。最简单的方式是输出到控制台。另一种常用的方式是写入磁盘文件。

### 一个简单的例子

一个非常简单的例子:

```python
import logging
logging.warning('Watch out!')  # 将打印一条消息到控制台
logging.info('I told you so')  # 将不打印任何消息
```

如果你在命令行中输入这些代码并运行，你将会看到：

```
WARNING:root:Watch out!
```

在控制台上打印出来。`INFO` 消息没有出现是因为默认级别为 `WARNING`。 打印的消息包括在日志记录调用中提供的事件级别和描述信息，例如 'Watch out!'。 实际输出可以按你的需要相当灵活地格式化；格式化选项也将在后文中进行说明。

请注意在这个例子中，我们是直接使用 `logging` 模块的函数，比如 `logging.debug`，而不是创建一个日志记录器并调用其方法。 这些函数作用于根日志记录器，但它们在未被调用时将会调用 `basicConfig()` 来发挥作用，就像在这个例子中那样。 然而在更大的程序中你通常会需要显式地控制日志记录的配置 —— 所以出于这样那样的理由，最好还是创建日志记录器并调用其方法。

### 记录日志到文件

一种很常见的情况是将日志事件记录到文件中，下面让我们来看这个问题。请确认在一个新启动的 Python 解释器中尝试以下操作，而非在上面描述的会话中继续:

```python
import logging
logger = logging.getLogger(__name__)
logging.basicConfig(filename='example.log', encoding='utf-8', level=logging.DEBUG)
logger.debug('This message should go to the log file')
logger.info('So should this')
logger.warning('And this, too')
logger.error('And non-ASCII stuff, too, like Øresund and Malmö')
```

在 3.9 版本发生变更: 增加了 _encoding_ 参数。在更早的 Python 版本中或没有指定时，编码会用 `open()` 使用的默认值。尽管在上面的例子中没有展示，但也可以传入一个决定如何处理编码错误的 _errors_ 参数。可使用的值和默认值，请参照 `open()` 的文档。

现在，如果我们打开日志文件，我们应当能看到日志信息：

```
DEBUG:__main__:This message should go to the log file
INFO:__main__:So should this
WARNING:__main__:And this, too
ERROR:__main__:And non-ASCII stuff, too, like Øresund and Malmö
```

该示例同样展示了如何设置日志追踪级别的阈值。该示例中，由于我们设置的阈值是 `DEBUG`，所有信息都将被打印。

如果你想从命令行设置日志级别，例如：

```
--log=INFO
```

并且你将 `--log` 命令的参数存进了变量 _loglevel_，你可以用：

```python
getattr(logging, loglevel.upper())
```

获取要通过 _level_ 参数传给 `basicConfig()` 的值。可如下对用户输入值进行错误检查：

```python
# 假定 loglevel 绑定到从命令行参数获取的字符串值。
# 转换为大写形式以允许用户指定 --log=DEBUG 或 --log=debug
numeric_level = getattr(logging, loglevel.upper(), None)
if not isinstance(numeric_level, int):
    raise ValueError('Invalid log level: %s' % loglevel)
logging.basicConfig(level=numeric_level, ...)
```

对 `basicConfig()` 的调用应当在任何对日志记录器方法的调用如 `debug()`, `info()` 等 _之前_ 执行。否则，日志记录事件可能无法以预期的方式来处理。

如果多次运行上述脚本，则连续运行的消息将追加到文件 _example.log_ 。 如果你希望每次运行重新开始，而不是记住先前运行的消息，则可以通过将上例中的调用更改为来指定 _filemode_ 参数:

```python
logging.basicConfig(filename='example.log', filemode='w', level=logging.DEBUG)
```

输出将与之前相同，但不再追加进日志文件，因此早期运行的消息将丢失。

### 记录变量数据

要记录变量数据，请使用格式字符串作为事件描述消息，并附加传入变量数据作为参数。例如:

```python
import logging
logging.warning('%s before you %s', 'Look', 'leap!')
```

将显示：

```
WARNING:root:Look before you leap!
```

如你所见，将可变数据合并到事件描述消息中使用旧的 % 形式的字符串格式化。这是为了向后兼容：logging 包的出现时间早于较新的格式化选项例如 `str.format()` 和 `string.Template`。这些较新格式化选项 _是_ 受支持的，但探索它们超出了本教程的范围：有关详细信息，请参阅 生效于整个应用程序的格式化样式。

### 更改显示消息的格式

要更改用于显示消息的格式，你需要指定要使用的格式:

```python
import logging
logging.basicConfig(format='%(levelname)s:%(message)s', level=logging.DEBUG)
logging.debug('This message should appear on the console')
logging.info('So should this')
logging.warning('And this, too')
```

这将输出：

```
DEBUG:This message should appear on the console
INFO:So should this
WARNING:And this, too
```

注意在前面例子中出现的“root”已消失。文档 LogRecord 属性 列出了可在格式字符串中出现的所有内容，但在简单的使用场景中，你只需要 _levelname_ （严重性）、_message_ （事件描述，包含可变的数据）或许再加上事件发生的时间。这将在下一节中介绍。

### 在消息中显示日期/时间

要显示事件的日期和时间，你可以在格式字符串中放置 '%(asctime)s'

```python
import logging
logging.basicConfig(format='%(asctime)s %(message)s')
logging.warning('is when this event was logged.')
```

应该打印这样的东西：

```
2010-12-12 11:41:42,612 is when this event was logged.
```

日期/时间显示的默认格式（如上所示）类似于 ISO8601 或 [**RFC 3339**](https://datatracker.ietf.org/doc/html/rfc3339.html)。如果你需要更多地控制日期/时间的格式，请为 `basicConfig` 提供 _datefmt_ 参数，如下例所示:

```python
import logging
logging.basicConfig(format='%(asctime)s %(message)s', datefmt='%m/%d/%Y %I:%M:%S %p')
logging.warning('is when this event was logged.')
```

这会显示如下内容：

```
12/12/2010 11:46:36 AM is when this event was logged.
```

_datefmt_ 参数的格式与 `time.strftime()` 支持的格式相同。

### 后续步骤

基本教程到此结束。它应该足以让你启动并运行日志记录。logging 包提供了更多功能，但为了充分利用它，你需要花更多的时间来阅读以下部分。 如果你准备好了，可以拿一些你最喜欢的饮料然后继续。

如果你的日志记录需求较为简单，那么可以使用上述示例将日志功能集成到你自己的脚本中。如果在操作过程中遇到问题或对某些内容不理解，你可以在 [Python 讨论论坛](https://discuss.python.org/c/help/7) 的“帮助”分类下发布问题，通常很快就会得到帮助。

还不够？你可以继续阅读接下来的几个部分，这些部分提供了比上面基本部分更高级或深入的教程。之后，你可以看一下 日志专题手册 .

## 进阶日志教程

日志库采用模块化方法，并提供几类组件：记录器、处理器、过滤器和格式器。

-   记录器暴露了应用程序代码直接使用的接口。

-   处理器将日志记录（由记录器创建）发送到适当的目标。

-   过滤器提供了更细粒度的功能，用于确定要输出的日志记录。

-   格式器指定最终输出中日志记录的样式。


日志事件信息在 `LogRecord` 实例中的记录器、处理器、过滤器和格式器之间传递。

通过调用 `Logger` 类（以下称为 _loggers_，记录器）的实例来执行日志记录。 每个实例都有一个名称，它们在概念上以点（句点）作为分隔符排列在命名空间的层次结构中。例如，名为 'scan' 的记录器是记录器 'scan.text' ，'scan.html' 和 'scan.pdf' 的父级。记录器名称可以是你想要的任何名称，并指示记录消息源自的应用程序区域。

在命名记录器时使用的一个好习惯是在每个使用日志记录的模块中使用模块级记录器，命名如下:

```python
logger = logging.getLogger(__name__)
```

这意味着记录器名称跟踪包或模块的层次结构，并且直观地从记录器名称显示记录事件的位置。

记录器层次结构的根称为根记录器。这是函数 `debug()`、 `info()`、 `warning()`、 `error()` 和 `critical()` 使用的记录器，它们就是调用了根记录器的同名方法。函数和方法具有相同的签名。 根记录器的名称在输出中打印为 'root' 。

当然，可以将消息记录到不同的地方。软件包中的支持包含，用于将日志消息写入文件、HTTP GET/POST 位置、通过 SMTP 发送电子邮件、通用套接字、队列或特定于操作系统的日志记录机制（如 syslog 或 Windows NT 事件日志）。目标由 _handler_ 类提供。如果你有任何内置处理器类未满足的特殊要求，则可以创建自己的日志目标类。

默认情况下，没有为任何日志消息设置目标。你可以使用 `basicConfig()` 指定目标（例如控制台或文件），如教程示例中所示。 如果你调用函数 `debug()`、 `info()`、 `warning()`、 `error()` 和 `critical()`，它们将检查是否有设置目标；如果没有设置，将在委托给根记录器进行实际的消息输出之前设置目标为控制台 (`sys.stderr`) 并设置显示消息的默认格式。

由 `basicConfig()` 设置的消息默认格式为：

```
严重等级：日志记录器名称：消息
```

你可以通过使用 _format_ 参数将格式字符串传递给 `basicConfig()` 来更改此设置。有关如何构造格式字符串的所有选项，请参阅 格式器对象 。

### 记录流程

记录器和处理器中的日志事件信息流程如下图所示。

流程图（文字版）：用户代码发起日志调用（如 `logger.info(...)`）→ 判断记录器是否已启用本次调用的级别，未启用则停止 → 创建 `LogRecord` → 判断记录器上的过滤器是否拒绝该记录，被拒绝则停止 → 把记录传给当前记录器的各个处理器：对每个处理器依次判断处理器是否已启用记录的级别、处理器上的过滤器是否拒绝该记录，通过则输出（包括格式化）；→ 判断当前记录器的 `propagate` 是否为真、是否存在父记录器，为真则把当前记录器上移到父记录器并重复处理器流程；→ 若整个层级中一个处理器都没有，则使用 `lastResort` 处理器输出。

### 记录器

`Logger` 对象有三重任务。首先，它们向应用程序代码公开了几种方法，以便应用程序可以在运行时记录消息。其次，记录器对象根据严重性（默认过滤工具）或过滤器对象确定要处理的日志消息。第三，记录器对象将相关的日志消息传递给所有感兴趣的日志处理器。

记录器对象上使用最广泛的方法分为两类：配置和消息发送。

这些是最常见的配置方法：

-   `Logger.setLevel()` 指定记录器将处理的最低严重性日志消息，其中 debug 是最低内置严重性级别，critical 是最高内置严重性级别。例如，如果严重性级别为 INFO，则记录器将仅处理 INFO、WARNING、ERROR 和 CRITICAL 消息，并将忽略 DEBUG 消息。

-   `Logger.addHandler()` 和 `Logger.removeHandler()` 从记录器对象中添加和删除处理器对象。处理器在以下内容中有更详细的介绍 处理器。

-   `Logger.addFilter()` 和 `Logger.removeFilter()` 可以添加或移除记录器对象中的过滤器。 过滤器对象 包含更多的过滤器细节。


你不需要总是在你创建的每个记录器上都调用这些方法。请参阅本节的最后两段。

配置记录器对象后，以下方法将创建日志消息：

-   `Logger.debug()` , `Logger.info()` , `Logger.warning()` , `Logger.error()` 和 `Logger.critical()` 都创建日志记录，包含消息和与其各自方法名称对应的级别。该消息实际上是一个格式化字符串，它可能包含标准字符串替换语法 `%s`、`%d`、 `%f` 等等。其余参数是与消息中的替换字段对应的对象列表。关于 `**kwargs`，日志记录方法只关注 `exc_info` 的关键字，并用它来确定是否记录异常信息。

-   `Logger.exception()` 创建与 `Logger.error()` 相似的日志信息。不同之处是， `Logger.exception()` 同时还记录当前的堆栈追踪。仅从异常处理程序调用此方法。

-   `Logger.log()` 将日志级别作为显式参数。对于记录消息而言，这比使用上面列出的日志级别便利方法更加冗长，但这是使用自定义日志级别的方法。


`getLogger()` 返回对具有指定名称的记录器实例的引用（如果已提供），或者如果没有则返回 `root` 。名称是以句点分隔的层次结构。多次调用 `getLogger()` 具有相同的名称将返回对同一记录器对象的引用。在分层列表中较低的记录器是列表中较高的记录器的子项。例如，给定一个名为 `foo` 的记录器，名称为 `foo.bar`、`foo.bar.baz` 和 `foo.bam` 的记录器都是 `foo` 子项。

记录器具有 _有效等级_ 的概念。如果未在记录器上显式设置级别，则使用其父记录器的级别作为其有效级别。如果父记录器没有明确的级别设置，则检查 _其_ 父级。依此类推，搜索所有上级元素，直到找到明确设置的级别。根记录器始终具有明确的级别配置（默认情况下为 `WARNING` ）。在决定是否处理事件时，记录器的有效级别用于确定事件是否传递给记录器相关的处理器。

子记录器将消息传播到与其父级记录器关联的处理器。因此，不必为应用程序使用的所有记录器定义和配置处理器。一般为顶级记录器配置处理器，再根据需要创建子记录器就足够了。（但是，你可以通过将记录器的 _propagate_ 属性设置为 `False` 来关闭传播。）

### 处理器

`Handler` 对象负责将适当的日志消息（基于日志消息的严重性）分派给处理器的指定目标。 `Logger` 对象可以使用 `addHandler()` 方法向自己添加零个或多个处理器对象。作为示例场景，应用程序可能希望将所有日志消息发送到日志文件，将错误或更高的所有日志消息发送到标准输出，以及将所有关键消息发送至一个邮件地址。 此方案需要三个单独的处理器，其中每个处理器负责将特定严重性的消息发送到特定位置。

标准库包含很多处理器类型 (参见 有用的处理器)；教程主要使用 `StreamHandler` 和 `FileHandler`。

处理器中很少有方法可供应用程序开发人员使用。使用内置处理器对象（即不创建自定义处理器）的应用程序开发人员能用到的仅有以下配置方法：

-   `setLevel()` 方法，就像在日志记录器对象中一样，指定将被分派到适当目标的最低严重性。为什么有两个 `setLevel()` 方法？在日志记录器中设置的级别确定要传递给其处理器的消息的严重性。 每个处理器中设置的级别则确定该处理器将发送哪些消息。

-   `setFormatter()` 选择一个该处理器使用的 Formatter 对象。

-   `addFilter()` 和 `removeFilter()` 分别在处理器上配置和取消配置过滤器对象。


应用程序代码不应直接实例化并使用 `Handler` 的实例。相反， `Handler` 类是一个基类，它定义了所有处理器应该具有的接口，并建立了子类可以使用（或覆盖）的一些默认行为。

### 格式器

格式化器对象配置日志消息的最终顺序、结构和内容。与 `logging.Handler` 类不同，应用程序代码可以实例化格式器类，但如果应用程序需要特殊行为，则可能会对格式化器进行子类化定制。构造函数有三个可选参数 —— 消息格式字符串、日期格式字符串和样式指示符。

**logging.Formatter.\_\_init\_\_(_fmt\=None_, _datefmt\=None_, _style\='%'_)**

如果没有消息格式字符串，则默认使用原始消息。如果没有日期格式字符串，则默认日期格式为：

```
%Y-%m-%d %H:%M:%S
```

在末尾加上毫秒数。`style` 是 `'%'`, `'{'` 或 `'$'` 之一。如果未指定其中之一，则将使用 `'%'`。

如果 `style` 为 `'%'`，则消息格式字符串将使用 `%(<dictionary key>)s` 样式的字符串替换；可用的键值记录在 LogRecord 属性 中。如果样式为 `'{'`，则将假定消息格式字符串与 `str.format()` 兼容（使用关键字参数），而如果样式为 `'$'` 则消息格式字符串应当符合 `string.Template.substitute()` 的预期。

在 3.2 版本发生变更: 添加 `style` 形参。

以下消息格式字符串将以人类可读的格式记录时间、消息的严重性以及消息的内容，按此顺序:

```python
'%(asctime)s - %(levelname)s - %(message)s'
```

格式器通过用户可配置的函数将记录的创建时间转换为元组。默认情况下，使用 `time.localtime()` ；要为特定格式器实例更改此项，请将实例的 `converter` 属性设置为与 `time.localtime()` 或 `time.gmtime()` 具有相同签名的函数。 要为所有格式器更改它，例如，如果你希望所有记录时间都以 GMT 显示，请在格式器类中设置 `converter` 属性 (对于 GMT 显示，设置为 `time.gmtime`)。

### 配置日志记录

开发者可以通过三种方式配置日志记录：

1.  使用调用上面列出的配置方法的 Python 代码显式创建记录器、处理器和格式器。

2.  创建日志配置文件并使用 `fileConfig()` 函数读取它。

3.  创建配置信息字典并将其传递给 `dictConfig()` 函数。


有关最后两个选项的参考文档，请参阅 配置函数。以下示例使用 Python 代码配置一个非常简单的记录器、一个控制台处理器和一个简单的格式器:

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

# 将 formatter 添加到 ch
ch.setFormatter(formatter)

# 将 ch 添加到 logger
logger.addHandler(ch)

# '应用程序' 代码
logger.debug('debug message')
logger.info('info message')
logger.warning('warn message')
logger.error('error message')
logger.critical('critical message')
```

从命令行运行此模块将生成以下输出：

```bash
$ python simple_logging_module.py
2005-03-19 15:10:26,618 - simple_example - DEBUG - debug message
2005-03-19 15:10:26,620 - simple_example - INFO - info message
2005-03-19 15:10:26,695 - simple_example - WARNING - warn message
2005-03-19 15:10:26,697 - simple_example - ERROR - error message
2005-03-19 15:10:26,773 - simple_example - CRITICAL - critical message
```

以下 Python 模块创建的记录器、处理器和格式器几乎与上面列出的示例中的相同，唯一的区别是对象的名称:

```python
import logging
import logging.config

logging.config.fileConfig('logging.conf')

# 创建日志记录器 logger
logger = logging.getLogger('simpleExample')

# '应用程序' 代码
logger.debug('debug message')
logger.info('info message')
logger.warning('warn message')
logger.error('error message')
logger.critical('critical message')
```

这是 logging.conf 文件：

```ini
[loggers]
keys=root,simpleExample

[handlers]
keys=consoleHandler

[formatters]
keys=simpleFormatter

[logger_root]
level=DEBUG
handlers=consoleHandler

[logger_simpleExample]
level=DEBUG
handlers=consoleHandler
qualname=simpleExample
propagate=0

[handler_consoleHandler]
class=StreamHandler
level=DEBUG
formatter=simpleFormatter
args=(sys.stdout,)

[formatter_simpleFormatter]
format=%(asctime)s - %(name)s - %(levelname)s - %(message)s
```

其输出与不基于配置文件的示例几乎相同：

```bash
$ python simple_logging_config.py
2005-03-19 15:38:55,977 - simpleExample - DEBUG - debug message
2005-03-19 15:38:55,979 - simpleExample - INFO - info message
2005-03-19 15:38:56,054 - simpleExample - WARNING - warn message
2005-03-19 15:38:56,055 - simpleExample - ERROR - error message
2005-03-19 15:38:56,130 - simpleExample - CRITICAL - critical message
```

你可以看到配置文件方法相较于 Python 代码方法有一些优势，主要是配置和代码的分离以及非开发者轻松修改日志记录属性的能力。

警告

`fileConfig()` 函数接受一个默认参数 `disable_existing_loggers`，出于向后兼容的原因，默认为 `True`。这可能与您的期望不同，因为除非在配置中明确命名它们（或其父级），否则它将导致在 `fileConfig()` 调用之前存在的任何非 root 记录器被禁用。有关更多信息，请参阅参考文档，如果需要，请将此参数指定为 `False`。

传递给 `dictConfig()` 的字典也可以用键 `disable_existing_loggers` 指定一个布尔值，如果没有在字典中明确指定，也默认被解释为 `True` 。这会导致上面描述的记录器禁用行为，这可能与你的期望不同——在这种情况下，请明确地为其提供 `False` 值。

请注意，配置文件中引用的类名称需要相对于日志记录模块，或者可以使用常规导入机制解析的绝对值。 因此，你可以使用 `WatchedFileHandler` (相对于日志记录模块) 或 `mypackage.mymodule.MyHandler` (对于在 `mypackage` 包中定义的类和模块 `mymodule` ，其中 `mypackage` 在 Python 导入路径上可用)。

在 Python 3.2 中，引入了一种新的配置日志记录的方法，使用字典来保存配置信息。 这提供了上述基于配置文件方法的功能的超集，并且是新应用程序和部署的推荐配置方法。因为 Python 字典用于保存配置信息，并且由于你可以使用不同的方式填充该字典，因此你有更多的配置选项。例如，你可以使用 JSON 格式的配置文件，或者如果你有权访问 YAML 处理功能，则可以使用 YAML 格式的文件来填充配置字典。当然，你可以在 Python 代码中构造字典，通过套接字以 pickle 形式接收它，或者使用对你的应用程序合理的任何方法。

以下是与上述相同配置的示例，采用 YAML 格式，用于新的基于字典的方法：

```yaml
version: 1
formatters:
  simple:
    format: '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
handlers:
  console:
    class: logging.StreamHandler
    level: DEBUG
    formatter: simple
    stream: ext://sys.stdout
loggers:
  simpleExample:
    level: DEBUG
    handlers: [console]
    propagate: no
root:
  level: DEBUG
  handlers: [console]
```

有关使用字典进行日志记录的更多信息，请参阅 配置函数。

### 如果没有提供配置会发生什么

如果未提供日志记录配置，则可能出现需要输出日志记录事件，但无法找到输出事件的处理器的情况。

事件将使用‘最后的处理器’来输出，它存储在 `lastResort` 中。这个内部处理器与任何日志记录器都没有关联，它的作用类似于 `StreamHandler`，它将事件描述消息写入到 `sys.stderr` 的当前值（因此会遵循任何已生效的重定向）。没有对消息进行任何格式化 —— 只打印简单的事件描述消息。该处理器的级别被设为 `WARNING`，因此将输出严重性在此级别以上的所有事件。

在 3.2 版本发生变更: 对于 3.2 之前的 Python 版本，行为如下：

-   如果 `raiseExceptions` 为 `False` (生产模式)，则该事件会被静默地丢弃。

-   如果 `raiseExceptions` 为 `True` (开发模式)，则会打印一条消息 'No handlers could be found for logger X.Y.Z'。


要获得 3.2 之前的行为，可以将 `lastResort` 设为 `None`。

### 为库配置日志

在开发带日志的库时，你应该在文档中详细说明，你的库会如何使用日志——例如，使用的记录器的名称。还需要考虑其日志配置。如果使用库的应用程序不使用日志，且库代码调用日志进行记录，那么（如上一节所述）严重性为 `WARNING` 和更高级别的事件将被打印到 `sys.stderr`。这被认为是最好的默认行为。

如果由于某种原因，你 _不_ 希望在没有任何日志记录配置的情况下打印这些消息，则可以将无操作处理器附加到库的顶级记录器。这样可以避免打印消息，因为将始终为库的事件找到处理器：它不会产生任何输出。如果库用户配置应用程序使用的日志记录，可能是配置将添加一些处理器，如果级别已适当配置，则在库代码中进行的日志记录调用将正常地将输出发送给这些处理器。

日志包中包含一个不做任何事情的处理器: `NullHandler` (自 Python 3.1 起)。 可以将此处理器的实例添加到库使用的日志记录命名空间的顶级记录器中 (_如果_ 你希望在没有日志记录配置的情况下阻止库的记录事件输出到 `sys.stderr`)。 如果库 _foo_ 的所有日志记录都是使用名称匹配 'foo.x' ， 'foo.x.y' 等的记录器完成的，那么代码:

```python
import logging
logging.getLogger('foo').addHandler(logging.NullHandler())
```

应该有预计的效果。如果一个组织生成了许多库，则指定的记录器名称可以是“orgname.foo”而不仅仅是“foo” 。

备注

强烈建议在你的库中 _不要将日志记录到根记录器_，而为你的库的最高层级包或模块使用一个具有唯一的易识别的名称——例如，`__name__`——的记录器。将日志记录到根记录器，会使应用程序开发人员按照他们的意愿配置你的库的日志的详细程度或处理器变得困难，或者完全不可能。

备注

强烈建议你 _不要将_ `NullHandler` _以外的任何处理器添加到库的记录器中_ 。这是因为处理器的配置是使用你的库的应用程序开发人员的权利。应用程序开发人员了解他们的目标受众以及哪些处理器最适合他们的应用程序：如果你在“底层”添加处理器，则可能会干扰他们执行单元测试和提供符合其要求的日志的能力。

## 日志级别

日志记录级别的数值在下表中给出。如果你想要定义自己的级别，并且需要它们具有相对于预定义级别的特定值，那么这你可能对以下内容感兴趣。如果你定义具有相同数值的级别，它将覆盖预定义的值；预定义的名称将失效。

级别

数值

`CRITICAL`

50

`ERROR`

40

`WARNING`

30

`INFO`

20

`DEBUG`

10

`NOTSET`

0

级别也可以与记录器关联，可以由开发人员设置，也可以通过加载保存的日志配置来设置。在记录器上调用记录方法时，记录器会将自己的级别与调用的方法的级别进行比较。如果记录器的级别高于调用的方法的级别，则实际上不会生成任何记录消息。这是控制日志记录输出详细程度的基本机制。

日志消息被编码为 `LogRecord` 类的实例。当记录器决定实际记录一个事件时，将从记录消息创建一个 `LogRecord` 实例。

使用 `Handler` 类的子例的实例 _handlers_，可以为日志消息建立分派机制。处理器负责确保记录的消息（以 `LogRecord` 的形式）最终到达对该消息的目标受众（如最终用户、技术支持员工、系统管理员或开发人员）有用的一个或多个位置上。想要去到特定目标的 `LogRecord` 实例会被传给相应的处理器。每个记录器可以有零、一或多个与之相关联的处理器（通过 `Logger` 的 `addHandler()` 方法）。除了与记录器直接关联的所有处理器之外，还会将消息分派给 _记录器的所有祖先关联的各个处理器\*（除非某个记录器的 \*propagate_ 旗标被设为假值，这将使向祖先的传递在其处终止）。

就像记录器一样，处理器可以具有与它们相关联的级别。处理器的级别作为过滤器，其方式与记录器级别相同。如果处理器决定分派一个事件，则使用 `emit()` 方法将消息发送到其目标。大多数用户定义的 `Handler` 子类都需要重写 `emit()`.

### 自定义级别

定义你自己的级别是可能的，但不一定是必要的，因为现有级别是根据实践经验选择的。但是，如果你确信需要自定义级别，那么在执行此操作时应特别小心，如果你正在开发库，则 _定义自定义级别可能是一个非常糟糕的主意_ 。 这是因为如果多个库作者都定义了他们自己的自定义级别，那么使用开发人员很难控制和解释这些多个库的日志记录输出，因为给定的数值对于不同的库可能意味着不同的东西。

## 有用的处理器

作为 `Handler` 基类的补充，提供了很多有用的子类：

1.  `StreamHandler` 实例发送消息到流（类似文件对象）。

2.  `FileHandler` 实例将消息发送到硬盘文件。

3.  `BaseRotatingHandler` 是轮换日志文件的处理器的基类。它并不应该直接实例化。而应该使用 `RotatingFileHandler` 或 `TimedRotatingFileHandler` 代替它。

4.  `RotatingFileHandler` 实例将消息发送到硬盘文件，支持最大日志文件大小和日志文件轮换。

5.  `TimedRotatingFileHandler` 实例将消息发送到硬盘文件，以特定的时间间隔轮换日志文件。

6.  `SocketHandler` 实例将消息发送到 TCP/IP 套接字。从 3.4 开始，也支持 Unix 域套接字。

7.  `DatagramHandler` 实例将消息发送到 UDP 套接字。从 3.4 开始，也支持 Unix 域套接字。

8.  `SMTPHandler` 实例将消息发送到指定的电子邮件地址。

9.  `SysLogHandler` 实例将消息发送到 Unix syslog 守护程序，可能在远程计算机上。

10.  `NTEventLogHandler` 实例将消息发送到 Windows NT/2000/XP 事件日志。

11.  `MemoryHandler` 实例将消息发送到内存中的缓冲区，只要满足特定条件，缓冲区就会刷新。

12.  `HTTPHandler` 实例使用 `GET` 或 `POST` 方法将消息发送到 HTTP 服务器。

13.  `WatchedFileHandler` 实例会监视他们要写入日志的文件。如果文件发生更改，则会关闭该文件并使用文件名重新打开。此处理器仅在类 Unix 系统上有用；Windows 不支持依赖的基础机制。

14.  `QueueHandler` 实例将消息发送到队列，例如在 `queue` 或 `multiprocessing` 模块中实现的队列。

15.  `NullHandler` 实例不对错误消息执行任何操作。如果库开发者希望使用日志记录，但又希望避免出现“找不到日志记录器 _XXX_ 的处理器”消息则可以使用它们。更多信息请参阅 为库配置日志。


版本 3.1 中新增。: `NullHandler` 类。

版本 3.2 中新增。: `QueueHandler` 类。

`NullHandler`、 `StreamHandler` 和 `FileHandler` 类在核心日志包中定义。其他处理器定义在 `logging.handlers` 中。（还有另一个子模块 `logging.config`，用于配置功能）

记录的消息通过 `Formatter` 类的实例进行格式化后呈现。它们使用能与 ％ 运算符一起使用的格式字符串和字典进行初始化。

要批量格式化多条消息，可以使用 `BufferingFormatter` 的实例。 除了格式字符串（它将应用于批次中的每条消息）以外，还提供了标头和尾部格式字符串。

当基于记录器级别和处理器级别的过滤不够时，可以将 `Filter` 的实例添加到 `Logger` 和 `Handler` 实例（通过它们的 `addFilter()` 方法）。在决定进一步处理消息之前，记录器和处理器都会查询其所有过滤器以获得许可。如果任何过滤器返回 false 值，则不会进一步处理该消息。

基本 `Filter` 的功能允许按特定的记录器名称进行过滤。如果使用此功能，则允许通过过滤器发送到指定记录器及其子项的消息，并丢弃其他所有消息。

## 记录日志时引发的异常

logging 包被设计为，当在生产环境下使用时，忽略记录日志时发生的异常。这样，处理与日志相关的事件时发生的错误（例如日志配置错误、网络或其它类似错误）不会导致使用日志的应用程序终止。

`SystemExit` 和 `KeyboardInterrupt` 异常永远不会被忽略。在 `Handler` 的子类的 `emit()` 方法中发生的其它异常将被传递给其 `handleError()` 方法。

`Handler` 中的 `handleError()` 的默认实现是检查是否设置了模块级变量 `raiseExceptions`。如有设置，则会将回溯打印到 `sys.stderr`。如果未设置，则忽略异常。

备注

`raiseExceptions` 的默认值是 `True`。这是因为在开发期间，你通常想要在发生异常时收到通知。建议你将 `raiseExceptions` 设为 `False` 供生产环境下使用。

## 使用任意对象作为消息

在前面的部分和示例中，都假设记录事件时传递的消息是字符串。 但是，这不是唯一的可能性。你可以将任意对象作为消息传递，并且当日志记录系统需要将其转换为字符串表示时，将调用其 `__str__()` 方法。实际上，如果你愿意，你可以完全避免计算字符串表示。例如， `SocketHandler` 用 pickle 处理事件后，通过网络发送。

## 优化

消息参数的格式化将被推迟，直到无法避免。但是，计算传递给日志记录方法的参数也可能很消耗资源，如果记录器只是丢弃你的事件，你可能希望避免这样做。要决定做什么，可以调用 `isEnabledFor()` 方法，该方法接受一个 level 参数，如果记录器为该级别的调用创建了该事件，则返回 true。你可以写这样的代码:

```python
if logger.isEnabledFor(logging.DEBUG):
    logger.debug('Message with %s, %s', expensive_func1(),
                                        expensive_func2())
```

因此如果日志记录器的阈值设置高于 `DEBUG`，则永远不会调用 `expensive_func1` 和 `expensive_func2`。

备注

在某些情况下， `isEnabledFor()` 本身可能比你想要的更消耗资源（例如，对于深度嵌套的记录器，其中仅在记录器层次结构中设置了显式级别）。在这种情况下（或者如果你想避免在紧密循环中调用方法），你可以在本地或实例变量中将调用的结果缓存到 `isEnabledFor()` ，并使用它而不是每次调用方法。在日志记录配置在应用程序运行时动态更改（这不常见）时，只需要重新计算这样的缓存值即可。

对于需要对收集的日志信息进行更精确控制的特定应用程序，还可以进行其他优化。以下列出了在日志记录过程中您可以避免的非必须处理操作：

你不想收集的内容

如何避免收集它

有关调用来源的信息

将 `logging._srcfile` 设置为 `None`。这避免了调用 `sys._getframe()`，这可能有助于加速 PyPy 等环境（无法加速使用 `sys._getframe()` 的代码）中的代码。

线程信息

将 `logging.logThreads` 设为 `False`。

当前进程 ID (`os.getpid()`)

将 `logging.logProcesses` 设为 `False`。

当使用 `multiprocessing` 来管理多个进程时的当前进程名称。

将 `logging.logMultiprocessing` 设为 `False`。

在使用 `asyncio` 时的当前 `asyncio.Task` 名称。

将 `logging.logAsyncioTasks` 设为 `False`。

另请注意，核心日志记录模块仅包含基本处理器。如果你不导入 `logging.handlers` 和 `logging.config` ，它们将不会占用任何内存。

## 其他资源

参见

**模块 `logging`**

日志记录模块的 API 参考。

**`logging.config` 模块**

日志记录模块的配置 API。

**`logging.handlers` 模块**

日志记录模块附带的有用处理器。

日志操作手册


## logging.config —— 日志配置

**源代码：**[Lib/logging/config.py](https://github.com/python/cpython/tree/3.14/Lib/logging/config.py)

Important

此页面仅包含参考信息。有关教程，请参阅

-   基础教程

-   进阶教程

-   日志记录操作手册


* * *

这一节描述了用于配置 logging 模块的 API。

## 配置函数

下列函数可配置 logging 模块。 它们位于 `logging.config` 模块中。 它们的使用是可选的 --- 要配置 logging 模块你可以使用这些函数，也可以通过调用主 API (在 `logging` 本身定义) 并定义在 `logging` 或 `logging.handlers` 中声明的处理器。

**logging.config.dictConfig(_config_)**

从一个字典获取日志记录配置。 字典的内容描述见下文的 配置字典架构。

如果在配置期间遇到错误，此函数将引发 `ValueError`, `TypeError`, `AttributeError` 或 `ImportError` 并附带适当的描述性消息。 下面是将会引发错误的（可能不完整的）条件列表:

-   `level` 不是字符串或者不是对应于实际日志记录级别的字符串。

-   `propagate` 值不是布尔类型。

-   id 没有对应的目标。

-   在增量调用期间发现不存在的处理器 id。

-   无效的日志记录器名称。

-   无法解析为内部或外部对象。


解析由 `DictConfigurator` 类执行，该类的构造器可传入用于配置的字典，并且具有 `configure()` 方法。 `logging.config` 模块具有可调用属性 `dictConfigClass`，其初始值设为 `DictConfigurator`。 你可以使用你自己的适当实现来替换 `dictConfigClass` 的值。

`dictConfig()` 会调用 `dictConfigClass` 并传入指定的字典，然后在所返回的对象上调用 `configure()` 方法以使配置生效:

```python
def dictConfig(config):
    dictConfigClass(config).configure()
```

例如，`DictConfigurator` 的子类可以在它自己的 `__init__()` 中调用 `DictConfigurator.__init__()`，然后设置可以在后续 `configure()` 调用中使用的自定义前缀。 `dictConfigClass` 将被绑定到这个新的子类，然后就能以与在默认的未定制状态下完全相同的方式调用 `dictConfig()`。

版本 3.2 中新增。

**logging.config.fileConfig(_fname_, _defaults\=None_, _disable\_existing\_loggers\=True_, _encoding\=None_)**

从一个 `configparser` 格式文件中读取日志记录配置。 文件格式应当与 配置文件格式 中的描述一致。 此函数可在应用程序中被多次调用，以允许最终用户在多个预设配置中进行选择（如果开发者提供了展示选项并加载选定配置的机制）。

如果文件不存在将引发 `FileNotFoundError` 而如果文件无效或为空则将引发 `RuntimeError`。

**参数:**

-   **fname**-- 一个文件名，或一个文件型对象，或是一个派生自 `RawConfigParser` 的实例。 如果传入了一个派生自 `RawConfigParser` 的实例，它会被原样使用。 否则，将会实例化一个 `ConfigParser`，并且它会从作为 `fname` 传入的对象中读取配置。 如果存在 `readline()` 方法，则它会被当作一个文件型对象并使用 `read_file()` 来读取；在其他情况下，它会被当作一个文件名并传递给 `read()`。

-   **defaults**-- 要传给 `ConfigParser` 的默认值可在此参数中指定。

-   **disable\_existing\_loggers**-- 如果指定为 `False`，则当执行此调用时已存在的日志记录器会保持启用。 默认值为 `True` 因为这将以向下兼容方式启用旧行为。 此行为是禁用任何现有的非根日志记录器除非它们或它们的上级在日志记录配置中被显式地命名。

-   **encoding**-- 当 _fname_ 为文件名时被用于打开文件的编码格式。


在 3.4 版本发生变更: 现在接受 `RawConfigParser` 子类的实例作为 `fname` 的值。 这有助于:

> -   使用一个配置文件，其中日志记录配置只是全部应用程序配置的一部分。
>
> -   使用从一个文件读取的配置，它随后会在被传给 `fileConfig` 之前由使用配置的应用程序来修改（例如基于命令行参数或运行时环境的其他部分）。
>

在 3.10 版本发生变更: 增加了 _encoding_ 形参。

在 3.12 版本发生变更: 如果所提供的文件不存在或无效或为空则将抛出一个异常。

**logging.config.listen(_port\=DEFAULT\_LOGGING\_CONFIG\_PORT_, _verify\=None_)**

在指定的端口上启动套接字服务器，并监听新的配置。 如果未指定端口，则会使用模块默认的 `DEFAULT_LOGGING_CONFIG_PORT`。 日志记录配置将作为适合由 `dictConfig()` 或 `fileConfig()` 进行处理的文件来发送。 返回一个 `Thread` 实例，你可以在该实例上调用 `start()` 来启动服务器，对该服务器你可以在适当的时候执行 `join()`。 要停止该服务器，请调用 `stopListening()`。

如果指定 `verify` 参数，则它应当是一个可调用对象，该对象应当验证通过套接字接收的字节数据是否有效且应被处理。 这可以通过对通过套接字发送的内容进行加密和/或签名来完成，这样 `verify` 可调用对象就能执行签名验证和/或解密。 `verify` 可调用对象的调用会附带一个参数 —— 通过套接字接收的字节数据 —— 并应当返回要处理的字节数据，或者返回 `None` 来指明这些字节数据应当被丢弃。 返回的字节数据可以与传入的字节数据相同（例如在只执行验证的时候），或者也可以完全不同（例如在可能执行了解密的时候）。

要将配置发送到套接字，请读取配置文件并将其作为字节序列发送到套接字，字节序列要以使用 `struct.pack('>L', n)` 打包为二进制格式的四字节长度的字符串打头。

备注

因为配置的各部分是通过 `eval()` 传递的，使用此函数可能让用户面临安全风险。虽然此函数仅绑定到 `localhost` 上的套接字，因此并不接受来自远端机器的连接，但在某些场景中不受信任的代码可以在调用 `listen()` 的进程的账户下运行。具体来说，如果调用 `listen()` 的进程在用户无法彼此信任的多用户机器上运行，则恶意用户就能简单地通过连接到受害者的 `listen()` 套接字并发送运行攻击者想在受害者的进程上执行的任何代码的配置的方式，安排运行几乎任意的代码。如果是使用默认端口这会特别容易做到，即便使用了不同端口也不难做到。要避免发生这种情况的风险，请在 `listen()` 中使用 `verify` 参数来防止未经认可的配置被应用。

在 3.4 版本发生变更: 添加了 `verify` 参数。

备注

如果你希望将配置发送给未禁用现有日志记录器的监听器，你将需要使用 JSON 格式的配置，该格式将使用 `dictConfig()` 进行配置。 此方法允许你在你发送的配置中将 `disable_existing_loggers` 指定为 `False`。

**logging.config.stopListening()**

停止通过对 `listen()` 的调用所创建的监听服务器。 此函数的调用通常会先于在 `listen()` 的返回值上调用 `join()`。

## 安全考量

日志配置功能试图提供便利，从某种角度来说，这是通过将配置文件中的文本转换为日志配置中使用的 Python 对象来完成的 —— 如 用户定义对象 中所述。但是，这些相同的机制（从用户定义的模块中导入可调用对象并使用配置中的参数调用它们）可用于调用你指定的任何代码，因此你应该\*非常谨慎\*地处理来自非信任源的配置文件。并且在实际加载前，你应该确信加载不会导致坏事情。

## 配置字典架构

描述日志记录配置需要列出要创建的不同对象及它们之间的连接；例如，你可以创建一个名为 'console' 的处理器，然后名为 'startup' 的日志记录器将可以把它的消息发送给 'console' 处理器。 这些对象并不仅限于 `logging` 模块所提供的对象，因为你还可以编写你自己的格式化或处理器类。 这些类的形参可能还需要包括 `sys.stderr` 这样的外部对象。 描述这些对象和连接的语法会在下面的 对象连接 中定义。

### 字典架构细节

传给 `dictConfig()` 的字典必须包含以下的键:

-   _version_ - 应设为代表架构版本的整数值。 目前唯一有效的值是 1，使用此键可允许架构在继续演化的同时保持向下兼容性。


所有其他键都是可选项，但如存在它们将根据下面的描述来解读。 在下面提到 'configuring dict' 的所有情况下，都将检查它的特殊键 `'()'` 以确定是否需要自定义实例化。 如果需要，则会使用下面 用户定义对象 所描述的机制来创建一个实例；否则，会使用上下文来确定要实例化的对象。

-   _formatters_ - 对应的值将是一个字典，其中每个键是一个格式器 ID 而每个值则是一个描述如何配置相应 `Formatter` 实例的字典。

    在配置字典中搜索以下可选键，这些键对应于创建 `Formatter` 对象时传入的参数：

    -   `format`

    -   `datefmt`

    -   `style`

    -   `validate` (从版本 >=3.8 起)

    -   `defaults` (从版本 >=3.12 起)


    可选的 `class` 键指定格式化器类的名称（形式为带点号的模块名和类名）。 实例化的参数与 `Formatter` 的相同，因此这个键对于实例化自定义的 `Formatter` 子类最为有用。 例如，替代类可能会以扩展或精简格式呈现异常回溯信息。 如果你的格式化器需要不同的或额外的配置键，你应当使用 用户定义对象。

-   _filters_ - 对应的值将是一个字典，其中每个键是一个过滤器 ID 而每个值则是一个描述如何配置相应 Filter 实例的字典。

    将在配置字典中搜索键 `name` (默认值为空字符串) 并且该键会被用于构造 `logging.Filter` 实例。

-   _handlers_ - 对应的值将是一个字典，其中每个键是一个处理器 ID 而每个值则是一个描述如何配置相应 Handler 实例的字典。

    将在配置字典中搜索下列键:

    -   `class` (强制)。 这是处理器类的完整限定名称。

    -   `level` (可选)。 处理器的级别。

    -   `formatter` (可选)。 处理器所对应格式化器的 ID。

    -   `filters` (可选)。 由处理器所对应过滤器的 ID 组成的列表。

        在 3.11 版本发生变更: `filters` 除了 id 以外还能接受 filter 实例。


    所有 _其他_ 键会被作为关键字参数传递给处理器类的构造器。 例如，给定如下配置:

    ```yaml
    handlers:
      console:
        class : logging.StreamHandler
        formatter: brief
        level   : INFO
        filters: [allow_foo]
        stream  : ext://sys.stdout
      file:
        class : logging.handlers.RotatingFileHandler
        formatter: precise
        filename: logconfig.log
        maxBytes: 1024
        backupCount: 3
    ```

    ID 为 `console` 的处理器会被实例化为 `logging.StreamHandler`，并使用 `sys.stdout` 作为下层流。 ID 为 `file` 的处理器会被实例化为 `logging.handlers.RotatingFileHandler`，并附带关键字参数 `filename='logconfig.log', maxBytes=1024, backupCount=3`。

-   _loggers_ - 对应的值将是一个字典，其中每个键是一个日志记录器名称而每个值则是一个描述如何配置相应 Logger 实例的字典。

    将在配置字典中搜索下列键:

    -   `level` (可选)。 日志记录器的级别。

    -   `propagate` (可选)。 日志记录器的传播设置。

    -   `filters` (可选)。 由日志记录器对应过滤器的 ID 组成的列表。

        在 3.11 版本发生变更: `filters` 除了 id 以外还能接受 filter 实例。

    -   `handlers` (可选)。 由日志记录器对应处理器的 ID 组成的列表。


    指定的记录器将根据指定的级别、传播、过滤器和处理器来配置。

-   _root_ - 这将成为根日志记录器对应的配置。 配置的处理方式将与所有日志记录器一致，除了 `propagate` 设置将不可用之外。

-   _incremental_ - 配置是否要被解读为在现有配置上新增。 该值默认为 `False`，这意味着指定的配置将以与当前 `fileConfig()` API 所使用的相同语义来替代现有的配置。

    如果指定的值为 `True`，配置会按照 增量配置 部分所描述的方式来处理。

-   _disable\_existing\_loggers_ - 是否要禁用任何现有的非根日志记录器。 该设置对应于 `fileConfig()` 中的同名形参。 如果省略，则此形参默认为 `True`。 如果 _incremental_ 为 `True` 则该值会被忽略。


### 增量配置

为增量配置提供完全的灵活性是很困难的。 例如，由于过滤器和格式化器这样的对象是匿名的，一旦完成配置，在增加配置时就不可能引用这些匿名对象。

此外，一旦完成了配置，在运行时任意改变日志记录器、处理器、过滤器、格式化器的对象图就不是很有必要；日志记录器和处理器的详细程度只需通过设置级别即可实现控制（对于日志记录器则可设置传播旗标）。 在多线程环境中以安全的方式任意改变对象图也许会导致问题；虽然并非不可能，但这样做的好处不足以抵销其所增加的实现复杂度。

这样，当配置字典的 `incremental` 键存在且为 `True` 时，系统将完全忽略任何 `formatters` 和 `filters` 条目，并仅会处理 `handlers` 条目中的 `level` 设置，以及 `loggers` 和 `root` 条目中的 `level` 和 `propagate` 设置。

使用配置字典中的值可让配置以封存字典对象的形式通过线路传送给套接字监听器。 这样，长时间运行的应用程序的日志记录的详细程度可随时间改变而无须停止并重新启动应用程序。

### 对象连接

该架构描述了一组日志记录对象 —— 日志记录器、处理器、格式化器、过滤器 —— 它们在对象图中彼此连接。 因此，该架构需要能表示对象之间的连接。 例如，在配置完成后，一个特定的日志记录器关联到了一个特定的处理器。 出于讨论的目的，我们可以说该日志记录器代表两者间连接的源头，而处理器则代表对应的目标。 当然在已配置对象中这是由包含对处理器的引用的日志记录器来代表的。 在配置字典中，这是通过给每个目标对象一个 ID 来无歧义地标识它，然后在源头对象中使用该 ID 来实现的。

因此，举例来说，考虑以下 YAML 代码段:

```yaml
formatters:
  brief:
    # 以下为针对格式化器 id 'brief' 的配置
  precise:
    # 以下为针对格式化器 'precise' 的配置
handlers:
  h1: # 这是一个 id
   # 以下是针对处理器 id 'h1' 的配置
   formatter: brief
  h2: # 这是另一个 id
   # 以下是针对处理器 id 'h2' 的配置
   formatter: precise
loggers:
  foo.bar.baz:
    # 针对日志记录器 'foo.bar.baz' 的其它配置
    handlers: [h1, h2]
```

（注：这里使用 YAML 是因为它的可读性比表示字典的等价 Python 源码形式更好。）

日志记录器 ID 就是日志记录器的名称，它会在程序中被用来获取对日志记录器的引用，例如 `foo.bar.baz`。 格式化器和过滤器的 ID 可以是任意字符串值 (例如上面的 `brief`, `precise`) 并且它们是瞬态的，因为它们仅对处理配置字典有意义并会被用来确定对象之间的连接，而当配置调用完成时不会在任何地方保留。

上面的代码片段指明名为 `foo.bar.baz` 的日志记录器应当关联到两个处理器，它们的 ID 是 `h1` 和 `h2`。 `h1` 的格式化器的 ID 是 `brief`，而 `h2` 的格式化器的 ID 是 `precise`。

### 用户定义对象

此架构支持用户定义对象作为处理器、过滤器和格式化器。 （日志记录器的不同实例不需要具有不同类型，因此这个配置架构并不支持用户定义日志记录器类。）

要配置的对象是由字典描述的，其中包含它们的配置详情。 在某些地方，日志记录系统将能够从上下文中推断出如何实例化一个对象，但是当要实例化一个用户自定义对象时，系统将不知道要如何做。 为了提供用户自定义对象实例化的完全灵活性，用户需要提供一个‘工厂’函数 —— 即在调用时传入配置字典并返回实例化对象的可调用对象。 这是用一个通过特殊键 `'()'` 来访问的工厂函数的绝对导入路径来标示的。 下面是一个实际的例子:

```yaml
formatters:
  brief:
    format: '%(message)s'
  default:
    format: '%(asctime)s %(levelname)-8s %(name)-15s %(message)s'
    datefmt: '%Y-%m-%d %H:%M:%S'
  custom:
      (): my.package.customFormatterFactory
      bar: baz
      spam: 99.9
      answer: 42
```

上面的 YAML 代码片段定义了三个格式化器。 第一个的 ID 为 `brief`，是带有指定格式字符串的标准 `logging.Formatter` 实例。 第二个的 ID 为 `default`，具有更长的格式同时还显式地定义了时间格式，并将最终实例化一个带有这两个格式字符串的 `logging.Formatter`。 以 Python 源代码形式显示的 `brief` 和 `default` 格式化器分别具有下列配置子字典:

```python
{
  'format' : '%(message)s'
}
```

和:

```python
{
  'format' : '%(asctime)s %(levelname)-8s %(name)-15s %(message)s',
  'datefmt' : '%Y-%m-%d %H:%M:%S'
}
```

并且由于这些字典不包含特殊键 `'()'`，实例化方式是从上下文中推断出来的：结果会创建标准的 `logging.Formatter` 实例。 第三个格式器的 ID 为 `custom`，对应配置子字典为:

```python
{
  '()' : 'my.package.customFormatterFactory',
  'bar' : 'baz',
  'spam' : 99.9,
  'answer' : 42
}
```

并且它包含特殊键 `'()'`，这意味着需要用户自定义实例化方式。 在此情况下，将使用指定的工厂可调用对象。 如果它本身就是一个可调用对象则将被直接使用 —— 否则如果你指定了一个字符串（如这个例子所示）则将使用正常的导入机制来定位实例的可调用对象。 调用该可调用对象将传入配置子字典中 **剩余的**条目作为关键字参数。 在上面的例子中，调用将预期返回 ID 为 `custom` 的格式化器:

```python
my.package.customFormatterFactory(bar='baz', spam=99.9, answer=42)
```

警告

上面示例中 `bar`, `spam` 和 `answer` 等键的值不应是配置字典或引用如 `cfg://foo` 或 `ext://bar`，因为它们将不会被配置机制所处理，而是被原样传给可调用对象。

将 `'()'` 用作特殊键是因为它不是一个有效的关键字形参名称，这样就不会与调用中使用的关键字参数发生冲突。 `'()'` 还被用作表明对应值为可调用对象的助记符。

在 3.11 版本发生变更: `handlers` 和 `loggers` 的 `filters` 成员除了 id 以外还能接受 filter 实例。

你还可以指定一个特殊的键 `'.'`，它的值是属性名到值的映射。 如果找到，在返回用户定义对象之前，将在该对象上设置指定的属性。 因此，使用以下配置:

```python
{
  '()' : 'my.package.customFormatterFactory',
  'bar' : 'baz',
  'spam' : 99.9,
  'answer' : 42,
  '.' : {
    'foo': 'bar',
    'baz': 'bozz'
  }
}
```

被返回的格式化器的 `foo` 属性将设为 `'bar'` 而 `baz` 属性将设为 `'bozz'`。

警告

上面示例中 `foo` 和 `baz` 等属性的值不应是配置字典或引用如 `cfg://foo` 或 `ext://bar`，因为它们将不会被配置机制所处理，而是被原样设置为属性。

### 处理器配置顺序

处理器按其键的字母顺序进行配置，而已配置的处理器将替换配置方案内部 `handlers` 字典（的一个工作副本）中的配置字典。 如果你使用 `cfg://handlers.foo` 这样的构造，那么在初始状态下 `handlers['foo']` 会指向具名为 `foo` 的处理器的配置字典，随后（一旦配置了该处理器）它将指向已配置的处理器实例。 因此，`cfg://handlers.foo` 可以解析为一个字典或处理器实例。 通常来说，对于带依赖的处理器采用在它们所依赖的任何处理器完成配置 _之后_ 再进行配置的方式来命名处理器是一种明智的做法；这将允许使用 `cfg://handlers.foo` 这样的构造来配置依赖于处理器 `foo` 的处理器。 如果这个带依赖的处理器被具名为 `bar`，则会导致问题，因为 `bar` 的配置将在 `foo` 的配置之前被尝试使用，而 `foo` 将尚未配置完成。 但是，如果带依赖的处理器被具名为 `foobar`，则它将在 `foo` 之后被配置，结果就是 `cfg://handlers.foo` 将被解析为已配置的处理器 `foo`，而不是其配置字典。

### 访问外部对象

有时一个配置需要引用配置以外的对象，例如 `sys.stderr`。 如果配置字典是使用 Python 代码构造的，这会很直观，但是当配置是通过文本文件（例如 JSON, YAML）提供的时候就会引发问题。 在一个文本文件中，没有将 `sys.stderr` 与字符串字面值 `'sys.stderr'` 区分开来的标准方式。 为了实现这种区分，配置系统会在字符串值中查找规定的特殊前缀并对其做特殊处理。 例如，如果在配置中将字符串字面值 `'ext://sys.stderr'` 作为一个值来提供，则 `ext://` 将被去除而该值的剩余部分将使用正常导入机制来处理。

此类前缀的处理方式类似于协议处理：存在一种通用机制来查找与正则表达式 `^(?P<prefix>[a-z]+)://(?P<suffix>.*)$` 相匹配的前缀，如果识别出了 `prefix`，则 `suffix` 会以与前缀相对应的方式来处理并且处理的结果将替代原字符串值。 如果未识别出前缀，则原字符串将保持不变。

### 访问内部对象

除了外部对象，有时还需要引用配置中的对象。 这将由配置系统针对它所了解的内容隐式地完成。 例如，在日志记录器或处理器中表示 `level` 的字符串值 `'DEBUG'` 将被自动转换为值 `logging.DEBUG`，而 `handlers`, `filters` 和 `formatter` 条目将接受一个对象 ID 并解析为适当的目标对象。

但是，对于 `logging` 模块所不了解的用户自定义对象则需要一种更通用的机制。 例如，考虑 `logging.handlers.MemoryHandler`，它接受一个 `target` 参数即其所委托的另一个处理器。 由于系统已经知道存在该类，因而在配置中，给定的 `target` 只需为相应目标处理器的对象 ID 即可，而系统将根据该 ID 解析出处理器。 但是，如果用户定义了一个具有 `alternate` 处理器的 `my.package.MyHandler`，则配置程序将不知道 `alternate` 指向的是一个处理器。 为了应对这种情况，通用解析系统允许用户指定:

```yaml
handlers:
  file:
    # 以下是文件处理器的配置

  custom:
    (): my.package.MyHandler
    alternate: cfg://handlers.file
```

字符串字面值 `'cfg://handlers.file'` 将按照与带有 `ext://` 前缀的字符串类似的方式被解析，但查找操作是在配置自身而不是在导入命名空间中进行。 该机制允许按点号或按索引来访问，与 `str.format` 所提供的方式类似。 这样，给定以下代码段:

```yaml
handlers:
  email:
    class: logging.handlers.SMTPHandler
    mailhost: localhost
    fromaddr: my_app@domain.tld
    toaddrs:
      - support_team@domain.tld
      - dev_team@domain.tld
    subject: Houston, we have a problem.
```

在该配置中，字符串 `'cfg://handlers'` 将解析为包含 `handlers` 键的字典，字符串 `'cfg://handlers.email` 将解析为 `handlers` 字典中包含 `email` 键的字典，依此类推。 字符串 `'cfg://handlers.email.toaddrs[1]` 将解析为 `'dev_team@domain.tld'` 而字符串 `'cfg://handlers.email.toaddrs[0]'` 将解析为值 `'support_team@domain.tld'`。 `subject` 值可以使用 `'cfg://handlers.email.subject'` 或者等价的 `'cfg://handlers.email[subject]'` 来访问。 后一种形式仅在键包含空格或非字母数字类字符的情况下才需要使用。 请注意字符 `[` 和 `]` 不允许在键中使用。 如果一个索引仅由十进制数码构成，则将尝试使用相应的整数值来访问，如有必要则将回退为字符串值。

给定字符串 `cfg://handlers.myhandler.mykey.123`，这将解析为 `config_dict['handlers']['myhandler']['mykey']['123']`。 如果字符串被指定为 `cfg://handlers.myhandler.mykey[123]`，系统将尝试从 `config_dict['handlers']['myhandler']['mykey'][123]` 中提取值，并在尝试失败时回退为 `config_dict['handlers']['myhandler']['mykey']['123']`。

### 导入解析与定制导入器

导入解析默认使用内置的 `__import__()` 函数来执行导入。 你可能想要将其替换为你自己的导入机制：如果是这样的话，你可以替换 `DictConfigurator` 或其超类 `BaseConfigurator` 类的 `importer` 属性。 但是你必须小心谨慎，因为函数是从类中通过描述器方式来访问的。 如果你使用 Python 可调用对象来执行导入，并且你希望在类层级而不是在实例层级上定义它，则你需要用 `staticmethod()` 来装饰它。 例如:

```python
from importlib import import_module
from logging.config import BaseConfigurator

BaseConfigurator.importer = staticmethod(import_module)
```

如果你是在一个配置器的 _实例_ 上设置导入可调用对象则你不需要用 `staticmethod()` 来装饰。

### 配置 QueueHandler 和 QueueListener

如果你想要配置一个 `QueueHandler`，请注意它通常是与 `QueueListener` 一起使用的，你可以同时配置这两者。 配置完成之后，`QueueListener` 实例将可作为所创建的处理器的 `listener` 属性来访问，而你也将可以使用 `getHandlerByName()` 来访问它并将你所使用的名称作为配置中的 `QueueHandler` 传入。 用于配置这两者的字典规格显示在下面的 YAML 实例代码段中。

```yaml
handlers:
  qhand:
    class: logging.handlers.QueueHandler
    queue: my.module.queue_factory
    listener: my.package.CustomListener
    handlers:
      - hand_name_1
      - hand_name_2
      ...
```

`queue` 和 `listener` 键是可选的。

如果存在 `queue` 键，相应的值可以是下列几项之一:

-   一个实现 `Queue.put_nowait` 和 `Queue.get` 公有 API 的对象。 例如，这可以是一个 `queue.Queue` 或其子类的具体实例，或者是一个由 `multiprocessing.managers.SyncManager.Queue()` 获取的代理对象。

    这当然仅在你通过代码中构造或修改配置字典时才是可能的。

-   一个将被求值为可调用对象的字符串，当不带任何参数被调用时，它将返回要使用的队列实例。 该可调用对象可以是一个 `queue.Queue` 子类或是一个返回适当的队列实例的函数，如 `my.module.queue_factory()`。

-   一个带有 `'()'` 键的字典，它使用 用户定义对象 中所介绍的通常方式构造。 这样构造的结果应当是一个 `queue.Queue` 实例。


如果没有 `queue` 键，则会创建并使用一个标准的未绑定 `queue.Queue` 实例。

如果存在 `listener` 键，则相应的值可以是下列几项中的一个:

-   一个 `logging.handlers.QueueListener` 的子类。 这当然仅在你通过代码构造或修改配置字典时才是可能的。

-   一个将被求值为属于 `QueueListener` 的子类的类的字符串，例如 `'my.package.CustomListener'`。

-   一个带有 `'()'` 键的字典，它使用 用户定义对象 中所介绍的通常方式构造。 这样构造的结果应当是一个与 `QueueListener` 初始化器具有相同签名的可调用对象。


如果不存在 `listener` 键，则会使用 `logging.handlers.QueueListener`。

在 `handlers` 键之下的值是配置中其他处理器的名称（未显示在上面的代码片段中），它们将被传给队列监听器。

任何自定义的队列处理器和监听器类都需要定义为具有与 `QueueHandler` 和 `QueueListener` 相同的初始化签名。

版本 3.12 中新增。

## 配置文件格式

`fileConfig()` 所能理解的配置文件格式是基于 `configparser` 功能的。 该文件必须包含 `[loggers]`, `[handlers]` 和 `[formatters]` 等小节，它们通过名称来标识文件中定义的每种类型的实体。 对于每个这样的实体，都有单独的小节来标识实体的配置方式。 因此，对于 `[loggers]` 小节中名为 `log01` 的日志记录器，相应的配置详情保存在 `[logger_log01]` 小节中。 类似地，对于 `[handlers]` 小节中名为 `hand01` 的处理器，其配置将保存在名为 `[handler_hand01]` 的小节中，而对于 `[formatters]` 小节中名为 `form01` 的格式化器，其配置将在名为 `[formatter_form01]` 的小节中指定。 根日志记录器的配置必须在名为 `[logger_root]` 的小节中指定。

备注

`fileConfig()` API 比 `dictConfig()` API 更旧因而没有提供涵盖日志记录特定方面的功能。 例如，你无法配置 `Filter` 对象，该对象使用 `fileConfig()` 提供超出简单整数级别的消息过滤功能。 如果你想要在你的日志记录配置中包含 `Filter` 的实例，你将必须使用 `dictConfig()`。 请注意未来还将向 `dictConfig()` 添加对配置功能的强化，因此值得考虑在方便的时候转换到这个新 API。

在文件中这些小节的例子如下所示。

```ini
[loggers]
keys=root,log02,log03,log04,log05,log06,log07

[handlers]
keys=hand01,hand02,hand03,hand04,hand05,hand06,hand07,hand08,hand09

[formatters]
keys=form01,form02,form03,form04,form05,form06,form07,form08,form09
```

根日志记录器必须指定一个级别和一个处理器列表。 根日志小节的例子如下所示。

```ini
[logger_root]
level=NOTSET
handlers=hand01
```

`level` 条目可以为 `DEBUG, INFO, WARNING, ERROR, CRITICAL` 或 `NOTSET` 之一。 作为仅适用于根日志记录器的设置，`NOTSET` 表示将会记录所有消息。 级别值会在 `logging` 包命名空间的上下文中 进行求值。

`handlers` 条目是以逗号分隔的处理器名称列表，它必须出现于 `[handlers]` 小节并且在配置文件中有相应的小节。

对于根日志记录器以外的日志记录器，还需要某些附加信息。 下面的例子演示了这些信息。

```ini
[logger_parser]
level=DEBUG
handlers=hand01
propagate=1
qualname=compiler.parser
```

`level` 和 `handlers` 条目的解释方式与根日志记录器的一致，不同之处在于如果一个非根日志记录器的级别被指定为 `NOTSET`，则系统会咨询更高层级的日志记录器来确定该日志记录器的有效级别。 `propagate` 条目设为 1 表示消息必须从此日志记录器传播到更高层级的处理器，设为 0 表示消息 **不会**传播到更高层级的处理器。 `qualname` 条目是日志记录器的层级通道名称，也就是应用程序获取日志记录器所用的名称。

指定处理器配置的小节说明如下。

```ini
[handler_hand01]
class=StreamHandler
level=NOTSET
formatter=form01
args=(sys.stdout,)
```

`class` 条目指明处理器的类（由 `logging` 包命名空间中的 `eval()` 来确定）。 `level` 会以与日志记录器相同的方式来解读，`NOTSET` 会被视为表示‘记录一切消息’。

`formatter` 条目指明此处理器的格式化器的键名称。 如为空白，则会使用默认的格式化器 (`logging._defaultFormatter`)。 如果指定了名称，则它必须出现于 `[formatters]` 小节并且在配置文件中有相应的小节。

`args` 条目，当在 `logging` 包命名空间的上下文中被 求值 时，将是传给处理器类构造器的参数列表。 请参阅相应处理器的构造器说明，或是下面的示例，以了解典型的条目是如何构造的。 如果未提供，则其默认值为 `()`。

可选的 `kwargs` 条目，当在 `logging` 包命名空间的上下文中被 求值 时，将是传给处理器的构造器的关键字参数字典。 如果未提供，则其默认值为 `{}`。

```ini
[handler_hand02]
class=FileHandler
level=DEBUG
formatter=form02
args=('python.log', 'w')

[handler_hand03]
class=handlers.SocketHandler
level=INFO
formatter=form03
args=('localhost', handlers.DEFAULT_TCP_LOGGING_PORT)

[handler_hand04]
class=handlers.DatagramHandler
level=WARN
formatter=form04
args=('localhost', handlers.DEFAULT_UDP_LOGGING_PORT)

[handler_hand05]
class=handlers.SysLogHandler
level=ERROR
formatter=form05
args=(('localhost', handlers.SYSLOG_UDP_PORT), handlers.SysLogHandler.LOG_USER)

[handler_hand06]
class=handlers.NTEventLogHandler
level=CRITICAL
formatter=form06
args=('Python Application', '', 'Application')

[handler_hand07]
class=handlers.SMTPHandler
level=WARN
formatter=form07
args=('localhost', 'from@abc', ['user1@abc', 'user2@xyz'], 'Logger Subject')
kwargs={'timeout': 10.0}

[handler_hand08]
class=handlers.MemoryHandler
level=NOTSET
formatter=form08
target=
args=(10, ERROR)

[handler_hand09]
class=handlers.HTTPHandler
level=NOTSET
formatter=form09
args=('localhost:9022', '/log', 'GET')
kwargs={'secure': True}
```

指定格式化器配置的小节说明如下。

```ini
[formatter_form01]
format=F1 %(asctime)s %(levelname)s %(message)s %(customfield)s
datefmt=
style=%
validate=True
defaults={'customfield': 'defaultvalue'}
class=logging.Formatter
```

用于格式化器配置的参数与字典规范 格式化器部分 中的键相同。

`defaults` 条目，当在 `logging` 包的命名空间的上下文中 求值 时，将是一个由自定义格式化字段的默认值组成的字典。 如果未提供，则默认为 `None`。

备注

由于如上所述使用了 `eval()`，因此使用 `listen()` 通过套接字来发送和接收配置会导致潜在的安全风险。 此风险仅限于相互间没有信任的多个用户在同一台机器上运行代码的情况；请参阅 `listen()` 了解更多信息。

参见

**模块 `logging`**

日志记录模块的 API 参考。

**`logging.handlers` 模块**

日志记录模块附带的有用处理器。

---

> **来源**：本文由 Python 官方文档两部分组成并完整翻译：① 《[日志操作指南（Logging HOWTO）](https://docs.python.org/zh-cn/3/howto/logging.html)》（作者 Vinay Sajip）；② [logging.config —— 日志配置](https://docs.python.org/zh-cn/3/library/logging.config.html)。Python 软件基金会（PSF），许可 PSF 许可证第 2 版。抓取于 2026-09-13（Python 3.14 官方文档）。
