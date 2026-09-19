---
title: Streamlit 入门：基础概念与进阶概念
source_url: https://docs.streamlit.io/get-started/fundamentals/main-concepts
author: Streamlit（Snowflake）文档团队
license: Apache 许可证 2.0
fetched_at: 2026-09-13
translated: true
versions: Streamlit 当前稳定版
order: 16
group: Web 服务与应用界面
---
*编者导读：本篇由 Streamlit 官方《Get started → Fundamentals》下的《Basic concepts（基本概念）》与《Advanced concepts（进阶概念）》两页完整翻译合并而成，覆盖数据流、控件、布局、开发流程、缓存、会话状态与数据库连接。*

# Streamlit 的基本概念

使用 Streamlit 很简单。先在一个普通 Python 脚本里撒上几条 Streamlit 命令，然后用 `streamlit run` 运行它：

```bash
streamlit run your_script.py [-- script args]
```

如上运行脚本后，一个本地 Streamlit 服务器随即启动，你的应用会在默认浏览器的新标签页中打开。这个应用就是你的画布，你可以在上面绘制图表、文本、控件、表格等等。

画什么由你决定。例如 `st.text` 会在应用中写入原始文本，`st.line_chart` 会画——你猜对了——折线图。全部可用命令见 [API 文档](https://docs.streamlit.io/develop/api-reference)。

> **注**：给脚本传自定义参数时，参数必须放在两个短横线之后，否则会被当作 Streamlit 本身的参数。

另一种运行方式是把 Streamlit 当作 Python 模块运行。在配置 PyCharm 之类的 IDE 时很有用：

```bash
# 运行
python -m streamlit run your_script.py

# 等价于：
streamlit run your_script.py
```

> **提示**：`streamlit run` 还可以接受一个 URL！与 GitHub Gist 配合非常好。例如：
>
> ```bash
> streamlit run https://raw.githubusercontent.com/streamlit/demo-uber-nyc-pickups/master/streamlit_app.py
> ```

## 开发流程

每次想更新应用，保存源文件即可。此时 Streamlit 会检测是否有变化并询问是否重新运行应用。点击屏幕右上角的"Always rerun"，源码每次变化都会自动更新应用。

这让你工作在一个快速的交互循环里：写点代码，保存，实时试一试，再多写点代码，保存，再试……直到满意为止。这种"编码与实时查看结果"之间的紧密循环，正是 Streamlit 让你轻松省事的方式之一。

> **提示**：开发 Streamlit 应用时，建议把编辑器和浏览器窗口并排摆放，代码与应用可以同时看到。试试看！

从 Streamlit 1.10.0 起，Streamlit 应用不能从 Linux 发行版的根目录运行；若尝试从根目录运行，会抛出 `FileNotFoundError: [Errno 2] No such file or directory`（详见 GitHub issue #5239）。因此主脚本应放在根目录以外的目录中。使用 Docker 时，可以用 `WORKDIR` 命令指定主脚本所在目录。

## 数据流

Streamlit 的架构让你像写普通 Python 脚本一样写应用。为实现这一点，Streamlit 应用有一种独特的数据流：任何时候屏幕上需要更新，Streamlit 都会把你的整个 Python 脚本从上到下重新运行一遍。

这在两种情况下发生：

- 每当你修改应用的源代码。
- 每当用户与应用中的控件交互。例如拖动滑块、在输入框输入文本或点击按钮。

当通过 `on_change`（或 `on_click`）参数给控件传入回调时，回调总是在脚本其余部分之前运行。Callbacks API 的细节见 Session State API 参考指南。

为了让这一切快速又无缝，Streamlit 在幕后替你做了大量工作。其中重要的是 `@st.cache_data` 装饰器，它让开发者可以在应用重跑时跳过某些代价高昂的计算。缓存稍后详述。

## 展示与美化数据

在 Streamlit 应用里有几种展示数据（表格、数组、数据框）的方式。下面你会认识 _magic（魔法命令）_ 与 `st.write()`——它们能写入从文本到表格的任何东西。之后我们再看专为数据可视化设计的方法。

### 使用魔法命令

不调用任何 Streamlit 方法也能向应用输出内容。Streamlit 支持"魔法命令"（magic commands），意味着你完全不必使用 `st.write()`！试试这段代码：

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

只要 Streamlit 看到某行只有变量或字面量，就会自动用 `st.write()` 把它写入应用。更多信息见魔法命令文档。

### 写出数据框

除了魔法命令，`st.write()` 是 Streamlit 的"瑞士军刀"。几乎任何东西都能传给它：文本、数据、Matplotlib 图、Altair 图等等。别担心，Streamlit 会自行判断并用正确的方式渲染。

```python
import streamlit as st
import pandas as pd

st.write("Here's our first attempt at using data to create a table:")
st.write(pd.DataFrame({
    'first column': [1, 2, 3, 4],
    'second column': [10, 20, 30, 40]
}))
```

还有其他专用于数据的函数如 `st.dataframe()` 和 `st.table()` 也可用于展示数据。来看看什么时候该用它们、以及如何给数据框添加颜色和样式。

你可能会问："为什么不全用 `st.write()`？"有几个原因：

1. _魔法_与 `st.write()` 会检查传入数据的类型，然后决定如何在应用中最佳渲染。有时你想换一种画法。例如，不想把数据框画成交互式表格，而是想用 `st.table(df)` 画成静态表格。
2. 第二个原因是，其他方法会返回一个可供使用和修改的对象：既能往里加数据，也能替换数据。
3. 最后，使用更具体的 Streamlit 方法时可以传额外参数定制其行为。

例如，创建一个数据框并用 Pandas 的 `Styler` 对象修改其格式。本例用 Numpy 生成随机样本，用 `st.dataframe()` 画交互式表格。

> **注**：本例用 Numpy 生成随机样本，你也可以用 Pandas DataFrame、Numpy 数组或普通 Python 数组。

```python
import streamlit as st
import numpy as np

dataframe = np.random.randn(10, 20)
st.dataframe(dataframe)
```

再用 Pandas 的 `Styler` 对象扩展第一个例子，高亮交互式表格中的部分元素：

```python
import streamlit as st
import numpy as np
import pandas as pd

dataframe = pd.DataFrame(
    np.random.randn(10, 20),
    columns=('col %d' % i for i in range(20)))

st.dataframe(dataframe.style.highlight_max(axis=0))
```

Streamlit 还有生成静态表格的方法：`st.table()`。

```python
import streamlit as st
import numpy as np
import pandas as pd

dataframe = pd.DataFrame(
    np.random.randn(10, 20),
    columns=('col %d' % i for i in range(20)))
st.table(dataframe)
```

### 绘制图表与地图

Streamlit 支持 [Matplotlib、Altair、deck.gl 等多种流行数据图表库](https://docs.streamlit.io/develop/api-reference#chart-elements)。本节往应用里加一个柱状图、一个折线图和一张地图。

**画折线图**：用 `st.line_chart()` 可以轻松添加折线图。我们用 Numpy 生成随机样本再画图：

```python
import streamlit as st
import numpy as np
import pandas as pd

chart_data = pd.DataFrame(
     np.random.randn(20, 3),
     columns=['a', 'b', 'c'])

st.line_chart(chart_data)
```

**绘制地图**：用 `st.map()` 可以在地图上展示数据点。用 Numpy 生成样本数据，画到旧金山的地图上：

```python
import streamlit as st
import numpy as np
import pandas as pd

map_data = pd.DataFrame(
    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
    columns=['lat', 'lon'])

st.map(map_data)
```

## 控件（Widgets）

当数据或模型进入你想探索的状态后，可以添加 `st.slider()`、`st.button()` 或 `st.selectbox()` 之类的控件。非常直接——把控件当变量用：

```python
import streamlit as st
x = st.slider('x')  # 👈 这是一个控件
st.write(x, 'squared is', x * x)
```

首次运行时，上面的应用会输出"0 squared is 0"。此后用户每次与控件交互，Streamlit 就把脚本从上到下重跑一遍，并把控件的当前状态赋给你的变量。

例如，用户把滑块拖到 `10`，Streamlit 会重跑上面的代码并把 `x` 设为 `10`，于是你看到"10 squared is 100"。

如果给控件指定了字符串作为唯一键（key），还可以按键访问控件：

```python
import streamlit as st
st.text_input("Your name", key="name")

# 你可以在任意位置访问该值：
st.session_state.name
```

每个带键的控件都会自动加入 Session State。关于 Session State、它与控件状态的关系及限制，见 Session State API 参考指南。

### 用复选框显示/隐藏数据

复选框的一个用例是隐藏或显示应用中的特定图表或区块。`st.checkbox()` 只有一个参数：控件标签。本例中复选框用来切换一个条件语句：

```python
import streamlit as st
import numpy as np
import pandas as pd

if st.checkbox('Show dataframe'):
    chart_data = pd.DataFrame(
       np.random.randn(20, 3),
       columns=['a', 'b', 'c'])

    chart_data
```

### 用下拉框选择选项

用 `st.selectbox` 从一个序列中选择。可以直接写选项，也可以传入数组或数据框列。使用之前创建的 `df` 数据框：

```python
import streamlit as st
import pandas as pd

df = pd.DataFrame({
    'first column': [1, 2, 3, 4],
    'second column': [10, 20, 30, 40]
    })

option = st.selectbox(
    'Which number do you like best?',
     df['first column'])

'You selected: ', option
```

## 布局

Streamlit 让用 `st.sidebar` 把控件组织进左侧面板变得简单。传给 `st.sidebar` 的每个元素都会固定在左边，让用户专注应用内容的同时仍能访问 UI 控件。

例如，想把 selectbox 和 slider 放进侧边栏，用 `st.sidebar.slider` 和 `st.sidebar.selectbox` 代替 `st.slider` 和 `st.selectbox`：

```python
import streamlit as st

# 在侧边栏加一个 selectbox：
add_selectbox = st.sidebar.selectbox(
    'How would you like to be contacted?',
    ('Email', 'Home phone', 'Mobile phone')
)

# 在侧边栏加一个 slider：
add_slider = st.sidebar.slider(
    'Select a range of values',
    0.0, 100.0, (25.0, 75.0)
)
```

除侧边栏外，Streamlit 还提供其他控制布局的方式：`st.columns` 让控件并排放置；`st.expander` 把大块内容折叠起来节省空间：

```python
import streamlit as st

left_column, right_column = st.columns(2)
# 可以像 st.sidebar 一样使用一列：
left_column.button('Press me!')

# 更好的做法是在 "with" 块内调用 Streamlit 函数：
with right_column:
    chosen = st.radio(
        'Sorting hat',
        ("Gryffindor", "Ravenclaw", "Hufflepuff", "Slytherin"))
    st.write(f"You are in {chosen} house!")
```

> **注**：`st.echo` 与 `st.spinner` 目前不支持在侧边栏或布局选项内使用，官方正在增加支持。

### 显示进度

应用中有长时间运行的计算时，可用 `st.progress()` 实时显示状态。

先导入 time，用 `time.sleep()` 模拟长时间运行的计算：

```python
import time
```

再创建一个进度条：

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

# Streamlit 的进阶概念

了解了 Streamlit 应用如何运行和处理数据之后，来聊聊"高效"。**缓存**让你保存函数的输出，重跑时直接跳过它；**Session State** 让你为每个用户保存跨重跑保留的信息。这不仅避免不必要的重复计算，还能实现动态页面与渐进式流程。

## 缓存（Caching）

即使应用要从网络加载数据、操纵大数据集或执行昂贵的计算，缓存也能让它保持高性能。

缓存的基本思想：保存昂贵函数调用的结果，当相同输入再次出现时返回缓存结果，避免以相同输入重复执行函数。

在 Streamlit 中缓存函数需要给它加缓存装饰器。有两个选择：

- `st.cache_data` 是缓存"返回数据的计算"的推荐方式。当函数返回可序列化的数据对象（如 str、int、float、DataFrame、dict、list）时使用它。**它在每次函数调用时都会创建数据的新副本**，因此对[突变与竞态问题](https://docs.streamlit.io/develop/concepts/architecture/caching)是安全的。多数情况下你想要的都是 `st.cache_data` 的行为——不确定时就先用它试试！
- `st.cache_resource` 是缓存全局资源（如 ML 模型或数据库连接）的推荐方式。当函数返回不可序列化、又不希望被多次加载的对象时使用。**它返回缓存对象本身**，在所有重跑与会话之间共享，不做复制。如果你修改了用 `st.cache_resource` 缓存的对象，该修改会出现在所有重跑与会话中。

示例：

```python
@st.cache_data
def long_running_function(param1, param2):
    return …
```

上面的例子中 `long_running_function` 被 `@st.cache_data` 装饰。据此，Streamlit 会记录：

- 函数名（`"long_running_function"`）。
- 输入值（`param1`、`param2`）。
- 函数内的代码。

在运行 `long_running_function` 的代码之前，Streamlit 先检查缓存中是否有先前保存的结果。如果找到该函数与输入值对应的缓存结果，就返回缓存结果而不重跑函数代码；否则执行函数、把结果存入缓存并继续跑脚本。开发期间，函数代码变化时缓存会自动更新，确保最新改动反映到缓存中。

（Streamlit 的两个缓存装饰器及其适用场景：能存进数据库的东西用 `st.cache_data`；存不进数据库的东西——如数据库连接或机器学习模型——用 `st.cache_resource`。）

关于 Streamlit 缓存装饰器、配置参数与限制的更多信息，见官方《Caching》。

## Session State（会话状态）

Session State 提供类字典接口，可以保存在脚本重跑之间保留的信息。用 `st.session_state` 以键或属性写法存取值，例如 `st.session_state["my_key"]` 或 `st.session_state.my_key`。记住：控件自己就会处理状态，你并不总是需要 Session State！

### 什么是一个会话（session）？

一个会话就是查看应用的一个实例。从浏览器的两个不同标签页查看同一个应用，每个标签页都有自己的会话。因此应用的每个查看者都有一个绑定到其特定视图的 Session State。用户与应用交互期间 Streamlit 会维护这个会话；用户刷新浏览器页面或重新加载应用 URL 时，其 Session State 会重置，并从新会话开始。

### 使用 Session State 的例子

下面这个简单的应用统计页面运行的次数。每次点击按钮，脚本就会重跑：

```python
import streamlit as st

if "counter" not in st.session_state:
    st.session_state.counter = 0

st.session_state.counter += 1

st.header(f"This page has run {st.session_state.counter} times.")
st.button("Run it again")
```

- **第一次运行**：应用首次为每个用户运行时，Session State 为空，因此创建键值对（`"counter":0`）。脚本继续，计数器立即递增（`"counter":1`）并显示结果："This page has run 1 times."。页面完全渲染后脚本结束，Streamlit 服务器等待用户操作。用户点击按钮，开始重跑。
- **第二次运行**："counter" 已是 Session State 的键，不会被重新初始化。脚本继续，计数器递增（`"counter":2`），显示"This page has run 2 times."。

Session State 在几种常见场景很有用。如上所示，当你有一个希望从一次重跑延续到下一次的渐进过程时使用它。Session State 也可用来防止重复计算，与缓存类似，但区别很重要：

- 缓存把存储的值关联到特定函数与输入。缓存值对所有用户、所有会话可见。
- Session State 把存储的值关联到键（字符串）。会话状态中的值只在保存它的那一个会话中可用。

如果应用里有随机数生成，多半会用到 Session State。下面这个例子在每个会话开始时随机生成数据：把随机数据保存在 Session State 里，每个用户打开应用时看到不同的随机数据，但随着交互数据不会一直变。（在新标签页打开应用开始新会话时，你会看到不同的数据！）

```python
import streamlit as st
import pandas as pd
import numpy as np

if "df" not in st.session_state:
    st.session_state.df = pd.DataFrame(np.random.randn(20, 2), columns=["x", "y"])

st.header("Choose a datapoint color")
color = st.color_picker("Color", "#FF0000")
st.divider()
st.scatter_chart(st.session_state.df, x="x", y="y", color=color)
```

如果所有用户拉取的是相同数据，多半应缓存获取数据的函数；反之，如果拉取的是用户专属数据（如查询其个人信息），则可能要保存进 Session State——这样查询到的数据只在那一个会话中可用。

如"基本概念"中提到的，Session State 还与控件相关。控件很神奇，会自己悄悄处理状态；作为进阶特性，你可以给控件指定键，在代码中操纵它们的值：控件的键会成为 Session State 中与控件值绑定的键，从而可以操纵控件。掌握 Streamlit 基础后，感兴趣可阅读官方《Widget behavior》指南深入了解。

## 连接（Connections）

如前所述，可以用 `@st.cache_resource` 缓存连接——这是最通用的方案，几乎可以使用任何 Python 库的连接。不过，Streamlit 还为一些最常见的连接（如 SQL）提供了便捷方式！`st.connection` 替你处理缓存，让代码更少。从数据库取数据可以简单到：

```python
import streamlit as st

conn = st.connection("my_database")
df = conn.query("select * from my_table")
st.dataframe(df)
```

你当然会问：用户名密码放哪？Streamlit 有便捷的[密钥管理（Secrets management）](https://docs.streamlit.io/develop/concepts/connections/secrets-management)机制。看看 `st.connection` 与密钥如何优雅配合：在本地项目目录保存一个 `.streamlit/secrets.toml` 文件，把密钥写进这个 toml 文件，`st.connection` 直接使用它们！例如应用文件为 `streamlit_app.py`，项目目录形如：

```text
your-LOCAL-repository/
├── .streamlit/
│   └── secrets.toml # 务必加入 gitignore！
└── streamlit_app.py
```

对上面的 SQL 例子，`secrets.toml` 大概长这样：

```toml
[connections.my_database]
    type="sql"
    dialect="mysql"
    username="xxx"
    password="xxx"
    host="example.com" # IP 或 URL
    port=3306 # 端口号
    database="mydb" # 数据库名
```

既然不想把 `secrets.toml` 提交到仓库，发布应用时就需要了解托管方如何处理密钥：每个平台传递密钥的方式可能不同。例如使用 Streamlit Community Cloud 时，每个已部署应用都有一个设置菜单用于加载密钥。应用写好准备部署后，可以阅读官方《Deploy your app》了解在 Community Cloud 上的部署方式。

---

> **来源**：本文由 Streamlit 官方文档两页完整翻译合并而成：[Basic concepts of Streamlit](https://docs.streamlit.io/get-started/fundamentals/main-concepts) 与 [Advanced concepts of Streamlit](https://docs.streamlit.io/get-started/fundamentals/advanced-concepts)（Get started → Fundamentals 章节），作者 Streamlit（Snowflake）文档团队，许可 Apache 许可证 2.0。抓取于 2026-09-13。原文中的界面截图未随文转载，以文字描述替代。

---

> 编者注：Streamlit 与 Gradio 的取舍——Gradio（见上一篇）面向"模型演示"场景，`Interface`/`ChatInterface` 开箱即用；Streamlit 面向"数据应用"场景，脚本式开发、控件与布局更自由，配合 `st.cache_resource` 缓存 LLM 客户端、`st.cache_data` 缓存检索结果，是快速搭建 RAG/对话数据面板的利器。安装：`pip install streamlit`，运行：`streamlit run app.py`。
