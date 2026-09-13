---
title: Gradio：几分钟给模型做个 Web 演示
source_url: https://www.gradio.app/guides/quickstart
author: Gradio 团队（Hugging Face）
license: Apache License 2.0
fetched_at: 2026-09-13
translated: true
order: 13
versions: Gradio 6（要求 Python 3.10+）
---
## 安装

**前提**：Gradio 要求 [Python 3.10 或更高版本](https://www.python.org/downloads/)。

推荐使用 `pip` 安装 Gradio（最好在虚拟环境中，参见模块 0 的 pip 与虚拟环境一篇）：

```
pip install --upgrade gradio
```

## 构建你的第一个 Demo

你可以在喜欢的代码编辑器、Jupyter notebook、Google Colab 或任何能写 Python 的地方运行 Gradio。来写你的第一个 Gradio 应用：

```python
import gradio as gr

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

demo = gr.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
    api_name="predict"
)

demo.launch()
```

我们把导入的 `gradio` 简写为 `gr`，这是广泛采用的约定，能让代码更易读。

现在运行你的代码。如果 Python 代码写在名为 `app.py` 的文件中，在终端运行 `python app.py` 即可。演示将出现在浏览器 [http://localhost:7860](http://localhost:7860) 上；如果你在 notebook 中运行，演示会直接嵌入在 notebook 里。

在左侧文本框输入名字、拖动滑块、按下 Submit 按钮，你就能在右侧看到一句友好的问候。

本地开发时，可以用**热重载模式**运行 Gradio 应用：每当你修改文件，应用会自动重载。只需在文件名前输入 `gradio` 而不是 `python`——上面的例子就是在终端输入 `gradio app.py`。还可以用 `--vibe` 标志启用 **vibe mode**（如 `gradio --vibe app.py`），它会提供一个浏览器内聊天界面，用自然语言编写或修改你的 Gradio 应用。

### 理解 Interface 类

在上面的例子中，你创建了 `gr.Interface` 类的一个实例。`Interface` 类专为机器学习模型设计：接收一个或多个输入，返回一个或多个输出。它有三个核心参数：

- `fn`：要包裹用户界面（UI）的函数；
- `inputs`：用于输入的 Gradio 组件，组件数量应与函数参数数量一致；
- `outputs`：用于输出的 Gradio 组件，组件数量应与函数返回值数量一致。

`fn` 参数非常灵活——你可以传入**任何**想包上 UI 的 Python 函数：音乐生成器、税费计算器、或预训练机器学习模型的预测函数。

`inputs` 和 `outputs` 接收一个或多个 Gradio 组件。Gradio 内置了 30 多个为机器学习应用设计的组件（如 `gr.Textbox()`、`gr.Image()` 和 `gr.HTML()`）。这两个参数既可以传组件名的字符串（`"textbox"`），也可以传类的实例（`gr.Textbox()`）。

如果函数接收多个参数，给 `inputs` 传一个组件列表，每个组件按顺序对应函数的一个参数；返回多个值同理。

## 分享你的 Demo

再漂亮的 Demo 不能分享也没用。Gradio 让你轻松分享机器学习演示，而不必操心 Web 服务器托管的麻烦事。只需在 `launch()` 中设置 `share=True`，就会为你的 Demo 创建一个公开可访问的 URL：

```python
import gradio as gr

def greet(name):
    return "Hello " + name + "!"

demo = gr.Interface(fn=greet, inputs="textbox", outputs="textbox")

demo.launch(share=True)  # 只加一个参数就能分享 🚀
```

运行这段代码后，几秒钟内就会生成一个公开 URL，例如：

`https://a23dsf231adb.gradio.live`

现在，世界上任何人都可以通过浏览器试用你的 Gradio Demo，而机器学习模型和所有计算仍然在**你自己的电脑**上运行。

## Gradio 总览

到目前为止我们讨论的都是 `Interface` 类——一个帮你快速构建 Demo 的高层抽象。但 Gradio 还包括：

### 用 gr.Blocks 自定义 Demo

`gr.Blocks` 类提供了低层级的 Web 应用设计方式，支持更自定义的布局和数据流：控制组件在页面上的位置、处理多个数据流和更复杂的交互（例如输出可以作为其他函数的输入）、根据用户交互更新组件的属性/可见性——依然全部用 Python 完成。

你可以用 `gr.Blocks()` 构建非常定制化、复杂的应用。例如流行的图像生成 [Automatic1111 Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) 就是使用 Gradio Blocks 构建的。

### 用 gr.ChatInterface 构建聊天机器人

Gradio 还包括另一个高层级类 `gr.ChatInterface`，专为创建聊天机器人 UI 设计。与 `Interface` 类似，你只需提供一个函数，Gradio 就会创建一个功能完整的聊天机器人 UI：

```python
import gradio as gr

def respond(message, history):
    return f"你说的是：{message}"

demo = gr.ChatInterface(fn=respond)
demo.launch()
```

> 编者注：把 `respond` 换成调用 LLM API 的函数（模块 6），再把 SDK 的流式输出用 `yield` 逐段返回（本模块第 2 篇的生成器），就是一个可以逐 token 打字机式显示的聊天应用——这正是官方《Creating A Chatbot Fast》指南的结构。

## Gradio Python 与 JavaScript 生态

以上就是 `gradio` Python 库的核心要点，但 Gradio 远不止如此——它是一个 Python 与 JavaScript 库的完整生态，让你构建机器学习应用或以编程方式查询它们：

- [Gradio Python Client](https://www.gradio.app/guides/getting-started-with-the-python-client)（`gradio_client`）：在 Python 中以编程方式查询任何 Gradio 应用；
- [Gradio JavaScript Client](https://www.gradio.app/guides/getting-started-with-the-js-client)（`@gradio/client`）：在 JavaScript 中以编程方式查询任何 Gradio 应用；
- [Hugging Face Spaces](https://huggingface.co/spaces)：托管 Gradio 应用最流行的地方——免费；
- [Server mode](https://www.gradio.app/guides/server-mode)（`gradio.Server`）：只用 Gradio 的后端（队列、流式、MCP、ZeroGPU 与 Spaces 托管）构建完全自定义的前端。

> 编者注：Gradio 6 还加入了 **MCP** 支持——你的 Gradio 应用可以一键变成 MCP 服务器被 Agent 调用（见官方 MCP 章节与模块 9），这让它从"演示工具"进一步升级为"Agent 工具前端"。

## 接下来？

按 Gradio Guides 顺序学习即可，每篇都有解释、示例代码和内嵌的交互式 Demo。下一站：[深入了解 Interface 类](https://www.gradio.app/guides/the-interface-class)。如果已经掌握基础、想查具体内容，可以搜索更技术性的 [API 文档](https://www.gradio.app/docs/)。

---

> **来源**：本文翻译自 [Quickstart — Gradio Guides](https://www.gradio.app/guides/quickstart)，作者 Gradio 团队（Hugging Face），许可 Apache License 2.0。抓取于 2026-09-13。

---

> 编者注：Gradio 是给机器学习模型 / API / 任意 Python 函数快速搭演示界面的标准工具，Hugging Face Spaces 免费托管的大多数 Demo 都基于它。做模型 Demo、给同事演示 prompt 效果、给 Agent 项目搭一个可视化前端，Gradio 都是首选。本篇为官方 Quickstart 的中文翻译，略有删节。
