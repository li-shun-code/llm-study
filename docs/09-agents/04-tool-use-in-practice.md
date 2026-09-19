---
title: Tool Use 实战：工具的定义、注入与调用
source_url: https://huggingface.co/learn/agents-course/en/unit1/tools
author: Hugging Face Agents Course 团队
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 4
group: 工具与协议
---
# 什么是工具（Tool）？

AI 智能体（Agent）的一个关键能力是执行**动作（Action）**——而这是通过**工具（Tool）**实现的。本节将学习什么是工具、如何有效设计工具，以及如何通过系统消息把它们集成到你的智能体中。

给你的智能体合适的工具——并清楚地描述这些工具如何工作——能极大提升 AI 的能力上限。

## 什么是 AI 工具？

**工具是提供给 LLM 的一个函数**，这个函数应服务于一个**明确的目标**。

以下是 AI 智能体中常用的工具：

| 工具 | 描述 |
| --- | --- |
| 网络搜索（Web Search） | 让智能体从互联网获取最新信息 |
| 图像生成（Image Generation） | 根据文字描述创建图像 |
| 检索（Retrieval） | 从外部数据源检索信息 |
| API 接口（API Interface） | 与外部 API 交互（GitHub、YouTube、Spotify 等） |

这些只是例子——实际上你可以为任何用例创建工具！

一个好工具应该是能**补足 LLM 能力短板**的东西。比如要做算术，给 LLM 一个**计算器工具**，效果会好于依赖模型的原生能力。

此外，**LLM 基于训练数据预测提示的补全**，这意味着其内部知识只包含训练日期之前的事件。因此，如果智能体需要最新数据，你必须通过工具提供。直接问 LLM（不配搜索工具）今天的天气，它很可能凭空幻觉一个天气。

一个工具应包含：

- 对函数功能的**文字描述**；
- 一个*可调用对象*（Callable，真正执行动作的东西）；
- 带类型标注的*参数*；
- （可选）带类型标注的输出。

## 工具是如何工作的？

如前所述，LLM 只能接收文本输入、生成文本输出，它自己没有办法"调用"工具。当我们说"给智能体提供工具"，实际含义是：让 LLM 知道这些工具的存在，并指示它在需要时生成**文本形式的工具调用**。

例如，我们提供一个"查询某地天气"的工具，然后问 LLM 巴黎的天气。LLM 会识别出这是使用"天气工具"的机会：它不会自己去取天气数据，而是生成一段代表工具调用的文本，如 `call weather_tool('Paris')`。

随后**智能体（Agent 框架）**读取这条响应，识别出需要执行工具调用，代表 LLM 执行该工具，拿到真实的天气数据。工具调用步骤通常对用户不可见：框架把它们作为新消息追加到对话中，再把更新后的对话传回 LLM。LLM 处理这些额外上下文，为用户生成自然的回答。从用户视角看，仿佛 LLM 直接调用了工具；实际上，是智能体框架在后台完成了全部执行过程。

## 如何把工具交给 LLM？

完整答案可能有点出人意料：我们基本上就是用**系统提示词**向模型提供可用工具的文字描述。

为此，我们必须非常精确：

1. **工具做什么**；
2. **它期望的准确输入是什么**。

这就是为什么工具描述通常用富有表现力又精确的结构来书写——比如计算机语言或 JSON。这并非*必须*，任何精确、连贯的格式都可以。

我们来实现一个简化的**计算器**工具：只做两个整数的乘法。Python 实现如下：

```python
def calculator(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b
```

工具名为 `calculator`，它**把两个整数相乘**，需要输入：

- **`a`**（*int*）：一个整数。
- **`b`**（*int*）：一个整数。

输出是另一个整数：*（int）*：`a` 与 `b` 的乘积。

把这些细节汇总成一段描述工具的文本：

```text
Tool Name: calculator, Description: Multiply two integers., Arguments: a: int, b: int, Outputs: int
```

> **要点**：这段文字描述就是*我们希望 LLM 了解的关于工具的一切*。

把它作为输入的一部分传给 LLM 后，模型会把它识别为一个工具，并知道该传什么输入、能期待什么输出。如果要提供更多工具，必须保持格式一致。手动维护这一过程很脆弱，容易遗漏细节。

有没有更好的办法？

### 自动格式化工具描述

我们的工具是 Python 写的，而实现本身已经提供了所需的一切：

- 描述性的函数名：`calculator`；
- 更长的说明：函数 docstring——`Multiply two integers.`；
- 输入及其类型：函数明确要求两个 `int`；
- 输出的类型。

我们可以利用 Python 的**内省（Introspection）**特性，从源码自动构建工具描述。只需要工具实现使用类型注解、docstring 和合理的函数名。最终只需一个 Python 装饰器声明"这个函数是工具"：

```python
@tool
def calculator(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b

print(calculator.to_string())
```

通过装饰器提供的 `to_string()` 函数，我们能从源码自动得到：

```text
Tool Name: calculator, Description: Multiply two integers., Arguments: a: int, b: int, Outputs: int
```

和我们手写的一模一样！

### 通用 Tool 类实现

我们创建一个可复用的通用 `Tool` 类。

> **免责声明**：这是教学用的简化实现，但它与大多数框架中的真实实现非常接近。

```python
from typing import Callable


class Tool:
    """
    A class representing a reusable piece of code (Tool).

    Attributes:
        name (str): Name of the tool.
        description (str): A textual description of what the tool does.
        func (callable): The function this tool wraps.
        arguments (list): A list of arguments.
        outputs (str or list): The return type(s) of the wrapped function.
    """
    def __init__(self,
                 name: str,
                 description: str,
                 func: Callable,
                 arguments: list,
                 outputs: str):
        self.name = name
        self.description = description
        self.func = func
        self.arguments = arguments
        self.outputs = outputs

    def to_string(self) -> str:
        """
        Return a string representation of the tool,
        including its name, description, arguments, and outputs.
        """
        args_str = ", ".join([
            f"{arg_name}: {arg_type}" for arg_name, arg_type in self.arguments
        ])

        return (
            f"Tool Name: {self.name},"
            f" Description: {self.description},"
            f" Arguments: {args_str},"
            f" Outputs: {self.outputs}"
        )

    def __call__(self, *args, **kwargs):
        """
        Invoke the underlying function (callable) with provided arguments.
        """
        return self.func(*args, **kwargs)
```

这个 `Tool` 类包括：

- **`name`**（str）：工具名称；
- **`description`**（str）：工具功能的简要描述；
- **`func`**（callable）：工具执行的函数；
- **`arguments`**（list）：期望的输入参数；
- **`outputs`**（str 或 list）：期望的输出类型；
- **`__call__()`**：工具实例被调用时执行底层函数；
- **`to_string()`**：把工具属性转换为文本表示。

可以这样创建工具：

```python
calculator_tool = Tool(
    "calculator",                   # 名称
    "Multiply two integers.",       # 描述
    calculator,                     # 要调用的函数
    [("a", "int"), ("b", "int")],   # 输入（名称与类型）
    "int",                          # 输出
)
```

不过我们还可以用 Python 的 `inspect` 模块自动获取所有信息——`@tool` 装饰器干的就是这件事。装饰器实现如下：

```python
import inspect

def tool(func):
    """
    A decorator that creates a Tool instance from the given function.
    """
    # 获取函数签名
    signature = inspect.signature(func)

    # 抽取 (参数名, 类型注解) 对作为输入
    arguments = []
    for param in signature.parameters.values():
        annotation_name = (
            param.annotation.__name__
            if hasattr(param.annotation, '__name__')
            else str(param.annotation)
        )
        arguments.append((param.name, annotation_name))

    # 确定返回值注解
    return_annotation = signature.return_annotation
    if return_annotation is inspect._empty:
        outputs = "No return annotation"
    else:
        outputs = (
            return_annotation.__name__
            if hasattr(return_annotation, '__name__')
            else str(return_annotation)
        )

    # 用函数 docstring 作为描述（无则用默认值）
    description = func.__doc__ or "No description provided."

    # 函数名即工具名
    name = func.__name__

    # 返回一个新的 Tool 实例
    return Tool(
        name=name,
        description=description,
        func=func,
        arguments=arguments,
        outputs=outputs
    )
```

有了这个装饰器，`Tool` 实例的 `to_string` 方法就能自动产出适合放进 LLM 系统提示的工具描述。这段描述随后被**注入**系统提示中，供模型使用。

### 模型上下文协议（MCP）：统一的工具接口

模型上下文协议（Model Context Protocol，MCP）是一个**开放协议**，标准化了应用**向 LLM 提供工具**的方式。MCP 提供：

- 不断增长的预构建集成列表，LLM 可直接接入；
- 在不同 LLM 提供商与供应商之间灵活切换的能力；
- 在你自己的基础设施内保护数据的最佳实践。

这意味着**任何实现了 MCP 的框架都可以使用协议内定义的工具**，无需为每个框架重复实现同一套工具接口。MCP 的深入讲解见本模块第 6-7 篇。

# 动作（Action）：让智能体与环境交互

动作是**AI 智能体与环境交互所采取的具体步骤**。无论是上网查资料还是控制物理设备，每个动作都是智能体执行的深思熟虑的操作。例如，客服智能体可能检索客户数据、推荐支持文章，或把问题转给人工客服。

## 智能体动作的类型

不同类型的智能体以不同方式执行动作：

| 智能体类型 | 描述 |
| --- | --- |
| JSON Agent | 以 JSON 格式指定要执行的动作 |
| Code Agent | 智能体写出一个代码块，由外部解释执行 |
| Function-calling Agent | JSON Agent 的子类，经过微调、为每个动作生成一条新消息 |

动作本身可以服务于多种目的：

| 动作类型 | 描述 |
| --- | --- |
| 信息收集 | 网络搜索、查询数据库、检索文档 |
| 工具使用 | 调用 API、运行计算、执行代码 |
| 环境交互 | 操作数字界面、控制物理设备 |
| 通信 | 通过聊天与用户交流、与其他智能体协作 |

LLM 只处理文本，它用文本来描述"想执行什么动作、给工具传什么参数"。要让智能体正常工作，LLM 必须在输出完定义一个完整动作的全部 token 之后**停止生成（STOP）**。这把控制权从 LLM 交还给智能体框架，并保证结果可解析——无论目标格式是 JSON、代码还是函数调用。

## 停止并解析（Stop and Parse）方法

实现动作的关键方法是**停止并解析**，它保证智能体的输出结构化、可预测：

1. **以结构化格式生成**：智能体以清晰的预定格式（JSON 或代码）输出它想执行的动作；
2. **终止继续生成**：定义动作的文本一旦输出完毕，**LLM 立即停止生成更多 token**，防止多余或错误的输出；
3. **解析输出**：外部解析器读取格式化的动作，确定调用哪个工具、抽取所需参数。

例如，需要查天气的智能体可能输出：

```json
Thought: I need to check the current weather for New York.
Action :
{
  "action": "get_weather",
  "action_input": {"location": "New York"}
}
```

框架随后可以轻松解析出要调用的函数名与参数。这种清晰、机器可读的格式把错误降到最低，让外部工具能准确处理智能体的指令。

> 注：函数调用型智能体（Function-calling Agent）的运作方式类似——把每个动作结构化，使指定函数以正确参数被调用。详见本站「API 与应用开发」的 Function Calling 一文。

## 代码智能体（Code Agent）

另一种思路是**代码智能体**：**不输出简单的 JSON 对象**，而是生成**可执行的代码块——通常是 Python 这样的高级语言**。

这一方式有几个优点：

- **表达力**：代码能自然表达复杂逻辑——循环、条件、嵌套函数——比 JSON 灵活得多；
- **模块化与可复用**：生成的代码可以包含函数与模块，在不同动作/任务间复用；
- **更强的可调试性**：有明确定义的编程语法，代码错误往往更容易发现和修复；
- **直接集成**：Code Agent 可以直接使用外部库和 API，支持数据处理、实时决策等更复杂的操作。

必须记住：执行 LLM 生成的代码可能有安全风险——从提示注入到恶意代码执行。因此推荐使用内置了默认防护措施的智能体框架（如 `smolagents`）。

例如，一个查天气的 Code Agent 可能生成如下 Python 片段：

```python
# Code Agent Example: Retrieve Weather Information
def get_weather(city):
    import requests
    api_url = f"https://api.weather.com/v1/location/{city}?apiKey=YOUR_API_KEY"
    response = requests.get(api_url)
    if response.status_code == 200:
        data = response.json()
        return data.get("weather", "No weather information available")
    else:
        return "Error: Unable to fetch weather data."

# Execute the function and prepare the final answer
result = get_weather("New York")
final_answer = f"The current weather in New York is: {result}"
print(final_answer)
```

这个 Code Agent 通过 API 调用获取天气数据、处理响应、并用 `print()` 输出最终答案。它同样遵循"停止并解析"：清晰划定代码块边界，并以打印 `final_answer` 标志执行完成。

---

动作通过执行清晰、结构化的任务，把智能体的内部推理与真实世界的交互连接起来——无论是 JSON、代码还是函数调用。代码智能体的完整展开见《Human-in-the-Loop：用 LangGraph interrupt 实现中断、恢复与人工审批》。

---

> **来源**：本文翻译自 Hugging Face Agents Course 第一单元 [What are Tools?](https://huggingface.co/learn/agents-course/en/unit1/tools) 与 [Actions: Enabling the Agent to Engage with Its Environment](https://huggingface.co/learn/agents-course/en/unit1/actions) 两节，作者 Hugging Face Agents Course 团队，许可 Apache 2.0。抓取于 2026-09-13。
