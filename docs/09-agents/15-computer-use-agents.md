---
title: Computer Use 与浏览器操作 Agent：让模型亲手操作图形界面
source_url: https://github.com/browser-use/browser-use
author: Magnus Müller、Gregor Žunič（browser-use）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: browser-use 当前版（Python >= 3.11）
order: 15
---

> **来源**：本文主体翻译自 [browser-use/browser-use](https://github.com/browser-use/browser-use) 官方 README，作者 Magnus Müller、Gregor Žunič（browser-use），许可 MIT。抓取于 2026-09-13。译文补充概念导语，对比"Computer Use"与"浏览器 Agent"两条路线。

# 概念：让模型"长出手和眼"

前面几篇的智能体都通过 API 与世界交互：调函数、查数据库。但大量人类工作发生在**图形界面**里——填表单、点按钮、切换标签页。Computer Use 类智能体给模型配上"眼睛"（截图/无障碍树/DOM 快照）与"手"（鼠标键盘动作或浏览器 API），让它像人一样操作软件。当前有三条实现路线：

1. **操作系统/桌面级 Computer Use**：模型看屏幕截图、输出鼠标点击坐标与键盘输入（代表：Anthropic 的 computer use 能力与参考实现、OpenAI 的 computer-use 模型）。通用性最强，但一步一截图，慢且贵。
2. **浏览器级 Agent**：模型读取浏览器的 DOM/可交互元素列表，直接发出"点击第 N 个元素""输入文本"等结构化动作（代表：browser-use、smolagents 的 web 浏览器示例）。比截图方式更快更稳，是网页自动化的主流。
3. **托管工具形态**：把"操作浏览器/电脑"包装成一个工具或云服务，智能体按需调用（如各家的云浏览器服务）。

browser-use 是路线 2 的代表开源项目（GitHub 上最流行的浏览器 Agent 库之一），下文译其官方 README。

# browser-use：像人一样浏览网页

> 让 AI 找到可预约的时段、选择日期时间、处理验证码、完成驾照考试预约——这是 browser-use 演示里最经典的例子。更多演示与提示词见官方 [showcase](https://browser-use.com/showcase)。

## 我需要哪种 Browser Use？

- **路线 1：全托管云（Fully Hosted Cloud）**：用托管智能体与云浏览器规模化运行，含隐身浏览器、配置档案、录制与数据策略等基础设施；
- **路线 2：CLI**：自动化你自己的浏览器任务；
- **路线 3：Python 库**：在本地用你自己的代码运行开源 Browser Use 智能体，可自由选择模型与本地/云浏览器。

# 快速上手

## 路线 3：Python 库（开源路线）

用 Python 在本地运行 Browser Use 智能体，模型自选、浏览器可用本地或云端。

**1. 安装（需要 Python >= 3.11）**

已安装 [uv](https://docs.astral.sh/uv/getting-started/installation/) 的话，新项目先执行 `uv init --python 3.12`，然后：

```bash
uv add browser-use
```

**2. 把 [OpenAI API key](https://platform.openai.com/api-keys) 加进 `.env`**

```bash
# .env
OPENAI_API_KEY=your-key
# BROWSER_USE_API_KEY=your-key  # 可选：使用 BU2 模型或云浏览器时需要
```

**3. 把以下内容保存为 `agent.py`**

```python
import asyncio

from browser_use import Agent, Browser, ChatBrowserUse, ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

async def main():
    llm = ChatOpenAI(model='gpt-5.6-luna', reasoning_effort='xhigh')
    # llm = ChatBrowserUse(model='bu-2-0')  # 改用 BU2；需要 BROWSER_USE_API_KEY
    agent = Agent(
        task="Find the number of stars of the browser-use repo",
        llm=llm,
        # browser=Browser(use_cloud=True),  # 使用云浏览器；需要 BROWSER_USE_API_KEY
    )
    history = await agent.run()
    print(history.final_result())

if __name__ == "__main__":
    asyncio.run(main())
```

要使用 BU2，把 `ChatOpenAI` 那行换成注释中的 `ChatBrowserUse` 行即可；云浏览器选项对两种模型都可用。

**4. 运行**

```bash
uv run agent.py
```

智能体会打开一个浏览器、查找仓库并打印答案。

## 路线 2：CLI

把下面这段提示词粘贴进 Claude Code、Codex 或你喜爱的编程智能体：

```text
Install or upgrade browser-use to the latest stable version with uv using Python 3.12, run `browser-use skill install` to register the skill, and connect it to my browser. If setup or connection fails, follow https://github.com/browser-use/browser-harness/blob/main/install.md.
```

## 路线 1：全托管云

用官方托管智能体、隐身浏览器，以及配置档案、录制、数据策略等基础设施来扩展浏览器自动化的规模。新注册用户有 15 美元云额度。入门见[云 API 快速开始](https://docs.browser-use.com/cloud/agent/quickstart)。

# 常见问题（官方 FAQ 译介）

**支持哪些模型？** `ChatBrowserUse` 可通过 Browser Use 网关使用带提供商前缀的模型 ID（用 `BROWSER_USE_API_KEY`）：

```python
from browser_use import Agent, ChatBrowserUse

llm = ChatBrowserUse(model='anthropic/claude-sonnet-4-6')  # 或 'google/gemini-3-pro'
agent = Agent(task='...', llm=llm)
```

也可以直接用 `ChatOpenAI`、`ChatAnthropic`、`ChatGoogle` 等封装配合各自的 API Key。参见[支持的模型列表](https://docs.browser-use.com/open-source/supported-models)。

**需要提供系统提示词吗？** 不需要。`Agent(...)` 会自动附带 Browser Use 的系统提示词（换模型也一样）。任务写在 `task=` 里；需要自定义行为时用 `extend_system_message` 追加指令或 `override_system_message` 覆盖默认提示。

**能给智能体加自定义工具吗？** 可以。用 `Tools` 注册函数再传给智能体：

```python
import asyncio
from datetime import datetime, timezone

from browser_use import ActionResult, Agent, ChatBrowserUse, Tools
from dotenv import load_dotenv

load_dotenv()
tools = Tools()

@tools.action(description='Get the current date and time in UTC.')
def get_current_time() -> ActionResult:
    return ActionResult(extracted_content=datetime.now(timezone.utc).isoformat())

async def main():
    agent = Agent(
        task="What is the current UTC time?",
        llm=ChatBrowserUse(model='bu-2-0'),
        tools=tools,
    )
    history = await agent.run()
    print(history.final_result())

if __name__ == "__main__":
    asyncio.run(main())
```

**免费能用吗？** Python 库免费且 MIT 授权。模型推理与托管浏览器另行计费：各 API 提供商（含 `ChatBrowserUse`）与 Browser Use Cloud 按用量收费；也可以用本地浏览器加 [Ollama](https://docs.browser-use.com/open-source/supported-models#ollama) 本地模型实现完全免费，受硬件与模型能力限制。

**如何处理登录认证？**

- 本地浏览器：用 `Browser.from_system_chrome()` 复用已有 Chrome 配置档案（真实浏览器指南与示例见官方文档）；
- 云浏览器：先做配置档案同步，再 `Browser(use_cloud=True, cloud_profile_id='your-profile-id')`。档案同步迁移的是 cookie，不含 localStorage、IndexedDB 或扩展，部分网站可能需要重新登录。

**如何应对验证码（CAPTCHA）？** Browser Use Cloud 提供为减少机器人检测与验证码而设计的隐身浏览器与代理；Python 库可通过 `Browser(use_cloud=True)` 启用云浏览器。效果取决于网站与挑战类型——没有任何浏览器配置能保证绕过或解决所有验证码。

**如何走向生产？** 按你想管理的程度选择：

- 保留你的智能体代码：把 CLI 或 Python 库连到[云浏览器](https://docs.browser-use.com/cloud/browser/quickstart)，获得托管浏览器基础设施、隐身、配置档案与录制；
- 连智能体也交给官方：用[全托管云 API](https://docs.browser-use.com/cloud/agent/quickstart) 提交任务、取回结果。

也可以把 Python 库和浏览器托管在你自己的基础设施上。

# 基准测试

官方维护了一个面向最难浏览器任务的 [BU Bench V2](https://github.com/browser-use/benchmark)（简单任务上即使是小模型也能达到很高成功率），衡量各模型的平均评分与单任务成本。浏览器 Agent 的评测方法论与第 17 篇的 Agent 评测一脉相承。

## 相关仓库

| 仓库 | 用途 |
| --- | --- |
| Browser Harness | 给 AI 智能体控制你浏览器的 CLI |
| Browser Harness JS | 让 JavaScript 智能体控制真实浏览器 |
| Cloud SDK | 在你的应用中集成 Browser Use Cloud |
| macOS Harness | 让智能体控制 Mac 应用、浏览器与文件 |
| Benchmark | 浏览器任务与智能体性能对比 |

**表：browser-use 生态相关仓库（节选）。**

# 与桌面级 Computer Use 的取舍

- **网页任务优先选浏览器 Agent**：DOM 级操作比截图快一个量级、元素定位更稳、成本更低；
- **跨应用/桌面软件/需要看像素的场景**才上桌面级 Computer Use（Anthropic/OpenAI 的 CUA 能力）；
- 两者共用同一套安全纪律：最小权限、高危动作（下单、发邮件、支付）必须有人工确认（参考第 11 篇的审批模式）、全程录制与审计（参考第 16 篇 Tracing）。

引用格式（若用于研究）：

```bibtex
@software{browser_use2024,
  author = {Müller, Magnus and Žunič, Gregor},
  title = {Browser Use: Enable AI to control your browser},
  year = {2024},
  publisher = {GitHub},
  url = {https://github.com/browser-use/browser-use}
}
```
