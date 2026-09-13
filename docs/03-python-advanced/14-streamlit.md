---
title: Streamlit：把 Python 脚本变成数据应用
source_url: https://docs.streamlit.io/get-started/fundamentals/main-concepts
author: Streamlit（Snowflake）及文档贡献者
license: Apache License 2.0
fetched_at: 2026-09-13
translated: true
order: 14
versions: Streamlit 当前稳定版
---
## 安装

在终端执行以下命令即可完成环境搭建并测试安装（推荐配合 `venv` 或本模块第 17 篇的 uv）：

```bash
pip install streamlit
streamlit hello
```

## 基本概念

使用 Streamlit 很简单。首先，在普通的 Python 脚本里"撒"上一些 Streamlit 命令，然后用 `streamlit run` 运行它：

```bash
streamlit run your_script.py [-- script args]
```

脚本一运行，本地 Streamlit 服务器就会启动，应用会在默认浏览器的新标签页中打开。应用就是你的画布，你可以在上面绘制图表、文本、组件（widget）、表格等。

画什么由你决定。例如 `st.text` 向应用写入原始文本，`st.line_chart` 画——你猜对了——折线图。完整的可用命令请查阅官方 API 文档。

**提示**：给脚本传自定义参数时，参数必须放在两个短横线之后，否则会被解释为 Streamlit 自身的参数。另一种运行方式是把 Streamlit 作为 Python 模块运行（配置 PyCharm 之类的 IDE 时有用）：

```bash
python -m streamlit run your_script.py
# 等价于：
streamlit run your_script.py
```

还可以给 `streamlit run` 传一个 URL！配合 GitHub Gists 非常好用：

```bash
streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/streamlit_app.py
```

### 开发流程

每次想更新应用，保存源文件即可。Streamlit 会检测到变化，并询问你是否要重新运行应用。选择屏幕右上角的"Always rerun"，之后每次改动源码都会自动更新应用。

这让你能工作在快速交互循环中：写点代码、保存、实时试用、再写点代码、再保存、再试用……这种编码与实时查看结果之间的紧密循环，正是 Streamlit 让你事半功倍的方式之一。开发时建议把编辑器和浏览器窗口并排摆放，代码和应用可以同时看到。

### 数据流

Streamlit 的架构让你像写普通 Python 脚本一样写应用。为此，Streamlit 应用有一种独特的数据流：**每当屏幕上有什么需要更新时，Streamlit 会从上到下重新运行你的整个 Python 脚本**。

这可能发生在两种情况下：

- 每当你修改应用的源代码；
- 每当用户与应用中的组件交互，例如拖动滑块、在输入框中输入文字或点击按钮。

当通过 `on_change`（或 `on_click`）参数向组件传递回调时，回调总会先于脚本其余部分运行。而为了让这一切快速无缝，Streamlit 在幕后替你做了大量工作，其中主角是 `@st.cache_data` 装饰器（还记得本模块第 1 篇吗？装饰器又来了）——它让应用重新运行时可以跳过某些昂贵的计算。

### 显示与美化数据

**魔法命令（magic）**：不用调用任何 Streamlit 方法也能向应用写入内容。Streamlit 看到"独占一行的变量或字面值"时，会自动用 `st.write()` 把它写到应用里：

```python
"""
# My first app
Here's our first attempt at using data to create a table:
"""

import streamlit as st
import pandas as pd
df = pd.DataFrame({
  'first column': [1, 2, 3, 4],
  'second column': [10, 20, 30, 40]
})

df
```

**st.write()**：Streamlit 的"瑞士军刀"。几乎可以给它传任何东西：文本、数据、Matplotlib 图形、Altair 图表等——Streamlit 会自己判断并以正确的方式渲染。

```python
import streamlit as st
import pandas as pd

st.write("Here's our first attempt at using data to create a table:")
st.write(pd.DataFrame({
    'first column': [1, 2, 3, 4],
    'second column': [10, 20, 30, 40]
}))
```

为什么不全用 `st.write()`？三个理由：1) `magic` 与 `st.write()` 通过检查数据类型决定渲染方式，有时你想换一种画法（例如用 `st.table(df)` 画静态表而不是交互表）；2) 其他方法返回可继续修改的对象；3) 更具体的方法可以传额外参数定制行为。例如：

```python
import streamlit as st
import numpy as np
import pandas as pd

dataframe = pd.DataFrame(
    np.random.randn(10, 20),
    columns=('col %d' % i for i in range(20)))

st.dataframe(dataframe.style.highlight_max(axis=0))  # 交互表 + 高亮最大值
st.table(dataframe)                                   # 静态表
```

**图表与地图**：Streamlit 支持多种流行的数据可视化库（Matplotlib、Altair、deck.gl 等）。折线图与地图各只需一行：

```python
chart_data = pd.DataFrame(
     np.random.randn(20, 3),
     columns=['a', 'b', 'c'])

st.line_chart(chart_data)

map_data = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
    columns=['lat', 'lon'])

st.map(map_data)
```

## 组件（Widgets）

当数据或模型进入你想探索的状态后，可以添加 `st.slider()`、`st.button()` 或 `st.selectbox()` 之类的组件。非常直接——**把组件当变量用**：

```python
import streamlit as st
x = st.slider('x')  # 👈 这是一个组件
st.write(x, 'squared is', x * x)
```

首次运行时，上面的应用应输出"0 squared is 0"。之后用户每次与组件交互，Streamlit 就从上到下重新运行你的脚本，并把组件的当前状态赋给你的变量——用户把滑块移到 10，应用就显示"10 squared is 100"。

组件也可以通过唯一的 key 访问，每个带 key 的组件会自动加入 Session State：

```python
import streamlit as st
st.text_input("Your name", key="name")

# 之后任何时候都可以这样访问它的值：
st.session_state.name
```

> 编者注：`st.session_state` 是 Streamlit 存"对话历史"这类跨重跑状态的标准位置——脚本每次交互都会整个重跑，普通局部变量留不住数据。写 LLM 聊天应用时，消息列表就放在 `st.session_state.messages` 里。

**复选框显示/隐藏数据**：

```python
if st.checkbox('Show dataframe'):
    chart_data = pd.DataFrame(
       np.random.randn(20, 3),
       columns=['a', 'b', 'c'])

    chart_data
```

**下拉选择框**：

```python
option = st.selectbox(
    'Which number do you like best?',
     df['first column'])
```

## 布局

`st.sidebar` 让你轻松把组件组织到左侧边栏——用户可以专注于应用内容，同时仍能访问 UI 控件：

```python
import streamlit as st

# 向侧边栏添加选择框：
add_selectbox = st.sidebar.selectbox(
    'How would you like to be contacted?',
    ('Email', 'Home phone', 'Mobile phone')
)

# 向侧边栏添加滑块：
add_slider = st.sidebar.slider(
    'Select a range of values',
    0.0, 100.0, (25.0, 75.0)
)
```

侧边栏之外，`st.columns` 可以把组件并排放置，`st.expander` 可以把大块内容折叠起来节省空间：

```python
import streamlit as st

left_column, right_column = st.columns(2)
# 可以像 st.sidebar 一样使用列：
left_column.button('Press me!')

# 或者更好的方式，在 "with" 代码块中调用 Streamlit 函数：
with right_column:
    chosen = st.radio(
        'Sorting hat',
        ("Gryffindor", "Ravenclaw", "Hufflepuff", "Slytherin"))
    st.write(f"You are in {chosen} house!")
```

## 显示进度

向应用添加长时间运行的计算时，可以用 `st.progress()` 实时显示状态：

```python
import streamlit as st
import time

'Starting a long computation...'

# 添加占位符
latest_iteration = st.empty()
bar = st.progress(0)

for i in range(100):
  # 每次迭代更新进度条。
  latest_iteration.text(f'Iteration {i+1}')
  bar.progress(i + 1)
  time.sleep(0.1)

'...and now we\'re done!'
```

## Gradio vs Streamlit 怎么选（编者小结）

- **Gradio**：模型 Demo、聊天界面（`gr.ChatInterface` 开箱即用）、Hugging Face Spaces 托管——"给一个函数套 UI"；
- **Streamlit**：多步骤数据应用、看板、带状态的交互流程——"整个应用就是一份脚本，交互即重跑"；
- 两者都是纯 Python、无需前端知识，先按手头任务试最小示例，选顺手的那个深入即可。

---

> **来源**：本文翻译自 [Basic concepts of Streamlit — Streamlit Docs](https://docs.streamlit.io/get-started/fundamentals/main-concepts)，作者 Streamlit（Snowflake）及文档贡献者，许可 Apache License 2.0。抓取于 2026-09-13。

---

> 编者注：本篇主体为官方《Basic concepts》指南的中文翻译，开头安装部分节选自官方 [Install Streamlit](https://docs.streamlit.io/get-started/installation)。Streamlit 与上一篇的 Gradio 定位互补：Gradio 面向"给模型包一个演示界面"，Streamlit 面向"把数据处理/LLM 交互流程写成脚本式应用"（如批量对话评测看板、RAG 检索调试器）。另：如果你用 AI 编程代理，Streamlit 官方还提供 `streamlit skills` 命令安装官方技能包，让代理遵循当前 API（见模块 11）。
