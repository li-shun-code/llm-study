---
title: Gradio 快速开始：为机器学习模型构建演示应用
source_url: https://www.gradio.app/guides/quickstart
author: Gradio 开发团队（Hugging Face）
license: Apache 许可证 2.0
fetched_at: 2026-09-13
translated: true
versions: Gradio 6
order: 19
group: Web 服务与应用界面
---
## 快速开始（Quickstart）

Gradio 是一个开源 Python 包，让你可以快速为机器学习模型、API 或任意 Python 函数**构建**演示或 Web 应用。随后你可以借助 Gradio 内置的分享功能，在几秒钟内**分享**指向该演示或 Web 应用的链接。*无需任何 JavaScript、CSS 或网站托管经验！*

只需几行 Python 代码即可创建自己的演示，让我们开始吧。

## 安装

**前置条件**：Gradio 要求 [Python 3.10 或更高版本](https://www.python.org/downloads/)。

我们推荐使用 `pip` 安装 Gradio（Python 默认自带 pip）。在终端或命令行中运行：

```bash
pip install --upgrade gradio
```

提示：最好在虚拟环境中安装 Gradio。所有常见操作系统的详细安装说明[见此](https://www.gradio.app/main/guides/installing-gradio-in-a-virtual-environment)。

## 构建你的第一个演示

你可以在常用的代码编辑器、Jupyter notebook、Google Colab 或任何编写 Python 的地方运行 Gradio。我们来写第一个 Gradio 应用：

```python
import gradio as gr

def greet(name, intensity):
    return "Hello, " + name + "!" * int(intensity)

demo = gr.Interface(
    fn=greet,
    inputs=["text", "slider"],
    outputs=["text"],
)

if __name__ == "__main__":
    demo.launch()
```

提示：我们习惯把导入的 `gradio` 名称简写为 `gr`。这是社区广泛采用的约定，可读性更好。

现在运行你的代码。如果 Python 代码保存在名为 `app.py` 的文件中，就在终端执行 `python app.py`。若以文件方式运行，浏览器中会打开 [http://localhost:7860](http://localhost:7860) 上的演示页面；如果是在 notebook 中运行，演示会直接内嵌在 notebook 中显示。

在左侧文本框中输入你的名字，拖动滑块，然后点击 Submit 按钮，右侧就会出现友好的问候语。

提示：本地开发时，可以用**热重载模式**运行 Gradio 应用，文件一有改动就自动重载。做法很简单：把文件名前面的 `python` 换成 `gradio`。在上例中，就是在终端输入 `gradio app.py`。还可以通过 `--vibe` 标志启用 **vibe mode**（例如 `gradio --vibe app.py`），它会提供一个浏览器内聊天界面，可以用自然语言编写或修改你的 Gradio 应用。详见《[热重载指南](https://www.gradio.app/guides/developing-faster-with-reload-mode)》。

**理解 `Interface` 类**

你会注意到，为了创建第一个演示，我们创建了 `gr.Interface` 类的一个实例。`Interface` 类用于为机器学习模型创建演示：模型接收一个或多个输入，返回一个或多个输出。

`Interface` 类有三个核心参数：

- `fn`：要为其包装用户界面（UI）的函数
- `inputs`：用作输入的 Gradio 组件。组件数量应与函数的参数个数一致。
- `outputs`：用作输出的 Gradio 组件。组件数量应与函数返回值的个数一致。

`fn` 参数非常灵活——可以传入*任何*你希望包装上 UI 的 Python 函数。上例中的函数比较简单，但它可以是任何东西：音乐生成器、税费计算器、预训练机器学习模型的预测函数，等等。

`inputs` 和 `outputs` 参数接收一个或多个 Gradio 组件。如前所述，Gradio 内置了 30 多个为机器学习应用设计的组件（例如 `gr.Textbox()`、`gr.Image()`、`gr.HTML()` 等），完整列表见[官方组件文档](https://www.gradio.app/docs/gradio/introduction)。

提示：对于 `inputs` 和 `outputs`，既可以传组件名的字符串（`"textbox"`），也可以传组件类的实例（`gr.Textbox()`）。

如果函数接收多个参数（如上例），就给 `inputs` 传一个输入组件列表，组件与函数参数按顺序一一对应；函数返回多个值时同理，给 `outputs` 传组件列表即可。这种灵活性让 `Interface` 类成为创建演示的利器。

关于 `gr.Interface` 的更深入讲解，见官方系列指南《[构建 Interface](https://www.gradio.app/main/guides/the-interface-class)》。

## 分享你的演示

漂亮的演示不能分享还有什么意义？Gradio 让你轻松分享机器学习演示，而不必操心 Web 服务器托管。只需在 `launch()` 中设置 `share=True`，就会为你的演示生成一个可公开访问的 URL。我们修改示例的最后一行：

```python
import gradio as gr

def greet(name):
    return "Hello " + name + "!"

demo = gr.Interface(fn=greet, inputs="textbox", outputs="textbox")

demo.launch(share=True)  # 只需多传 1 个参数即可分享你的演示
```

运行这段代码后，几秒钟内就会生成一个公开 URL，形如：

`https://a23dsf231adb.gradio.live`

现在，世界各地的任何人都可以在浏览器里试用你的 Gradio 演示，而机器学习模型和所有计算仍在你本机上运行。

关于分享的更多内容，见专门指南《[分享你的应用](https://www.gradio.app/guides/sharing-your-app)》。

## Gradio 全景

到目前为止我们讨论的都是 `Interface` 类——它是一个高等级类，让你用 Gradio 快速构建演示。但 Gradio 还包含什么？

### 用 `gr.Blocks` 构建自定义演示

Gradio 提供了低等级的 `gr.Blocks` 类，用于设计布局和数据流更可定制的 Web 应用。Blocks 支持控制组件在页面上的位置、处理多条数据流和更复杂的交互（例如把某个输出作为其他函数的输入）、根据用户交互更新组件属性/可见性等——这一切依然只用 Python 完成。

你可以用 `gr.Blocks()` 构建非常定制化的复杂应用。例如流行的图像生成应用 [Automatic1111 Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) 就是基于 Gradio Blocks 构建的。深入讲解见系列指南《[使用 Blocks 构建](https://www.gradio.app/guides/blocks-and-event-listeners)》。

### 用 `gr.ChatInterface` 构建聊天机器人

Gradio 还包括另一个高等级类 `gr.ChatInterface`，专门用于创建聊天机器人 UI。与 `Interface` 类似，你只需提供一个函数，Gradio 就会生成一个完整可用的聊天机器人界面。如果你想创建聊天机器人，可直接阅读专门指南《[快速创建聊天机器人](https://www.gradio.app/guides/creating-a-chatbot-fast)》。

### Gradio 的 Python 与 JavaScript 生态

以上是 `gradio` Python 核心库的要点，但 Gradio 远不止于此！它是一整套 Python 与 JavaScript 库组成的生态系统，让你构建机器学习应用，或用 Python/JavaScript 以编程方式查询它们。生态中的其他部分包括：

- [Gradio Python 客户端](https://www.gradio.app/guides/getting-started-with-the-python-client)（`gradio_client`）：用 Python 以编程方式查询任何 Gradio 应用。
- [Gradio JavaScript 客户端](https://www.gradio.app/guides/getting-started-with-the-js-client)（`@gradio/client`）：用 JavaScript 以编程方式查询任何 Gradio 应用。
- [Hugging Face Spaces](https://huggingface.co/spaces)：最受欢迎的 Gradio 应用托管平台——免费！
- [Server mode](https://www.gradio.app/guides/server-mode)（`gradio.Server`）：只用 Gradio 后端（队列、流式传输、MCP、ZeroGPU、Spaces 托管）构建完全自定义的前端。

## 下一步？

跟着 Gradio 指南循序渐进地学习，其中包含讲解、示例代码和可交互的内嵌演示。下一站：[深入了解 Interface 类](https://www.gradio.app/guides/the-interface-class)。

如果你已经掌握基础、想查具体内容，可以搜索更偏技术的 [API 文档](https://www.gradio.app/docs/)。

---

> **来源**：本文为 Gradio 官方指南《[Quickstart](https://www.gradio.app/guides/quickstart)》的完整翻译，作者 Gradio 开发团队（Hugging Face），许可 Apache 许可证 2.0。示例代码取自官方仓库 `demo/hello_world_4/`。抓取于 2026-09-13。

---

> 编者注：gradio 官方仓库的 `guides/cn/` 目录下有社区维护的本指南中文版，可对照阅读。面向 LLM 应用：聊天界面优先用 `gr.ChatInterface`（自动维护对话历史 UI），流式输出（逐 token 打字机效果）在函数中用 `yield` 逐步返回即可，Gradio 会自动处理流式渲染。
