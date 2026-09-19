---
title: "Computer Use 与浏览器操作 Agent：坐标、DOM 与动作循环的完整实现"
source_url: https://github.com/browser-use/browser-use
author: Magnus Müller、Gregor Žunič（browser-use）；OpenAI（Agents SDK）；Anthropic（computer-use 参考实现）
license: MIT（browser-use、openai-agents、anthropic-quickstarts 三个仓库均为 MIT）
fetched_at: 2026-09-19
translated: true
versions: browser-use 0.13.10（Python >= 3.11）；openai-agents 0.22.3；Anthropic computer 工具版本 computer_20241022 / computer_20250124 / computer_20251124 / computer_toolset_20260801
order: 20
group: 行动型 Agent
---
## 为什么需要"手和眼"：API 覆盖不到的那半边世界

前面几篇的智能体都通过 API 与世界交互：调函数、查数据库、发 HTTP。但大量真实工作发生在**图形界面**里——旧版 ERP 只有客户端、政务/银行系统只有网页且没有接口、内部工具只给你一个登录框。Computer Use 类智能体给模型配上"眼睛"（截图、无障碍树、DOM 快照）与"手"（鼠标键盘动作或浏览器 API），让它像人一样操作软件。

代价要提前算清：这是**用 token 换 API 的缺席**。一次动作一屏截图，延迟与成本都远高于函数调用；模型点错坐标、被弹窗打断、页面改版，都会让路径不确定。所以工程上的第一原则是：**能拿到 API/CLI/MCP 就绝不用像素**。

三条实现路线：

| 路线 | 观察输入 | 动作输出 | 代表 | 适用 |
| --- | --- | --- | --- | --- |
| 桌面级 Computer Use | 屏幕截图（+ 无障碍树） | 归一化/像素坐标 + 鼠标键盘动作原语 | Anthropic computer 工具与其参考实现、OpenAI computer-use 能力 | 无接口的桌面软件、跨应用流程 |
| 浏览器级 Agent | DOM / 可交互元素列表（+ 截图） | `click(index)`、`type(text)` 等结构化动作 | browser-use 等开源库 | 网页自动化（主流、性价比最高） |
| 托管/混合 | 云浏览器或厂商沙箱 | 由托管服务执行 | 各家云浏览器、browser harness/CLI、把"操作浏览器"包成一个工具 | 需要隐身、代理、录制、规模化 |

三条路线共用同一个循环骨架——它就是《ReAct 范式（机制与工程实现）》那套"思考→行动→观察"，只是**观察体从文本换成了图像，动作体从 JSON 换成了坐标或元素索引**。

## 一、通用动作循环与它的成本结构

```text
        ┌──────────────────────────────────────────────────┐
        │                                                  │
 截图/DOM 快照 ──► 组装提示（历史动作+观察+任务） ──► 模型 ──► 解析动作
        ▲                                                  │
        │                                                  ▼
   观察（新截图/执行日志） ◄── 执行器（xdotool / CDP / Playwright） ◄── 安全门（白名单·人工确认）
```

一轮的成本 ≈ 输入（累积的历史 + 当轮截图编码后的视觉 token）+ 输出（动作）。三个直接结论：

1. **截图是 token 黑洞**，所以"缩放/裁剪/降帧"是正经优化手段，不是投机取巧。Anthropic 参考实现里就内置了 `MAX_SCALING_TARGETS`（XGA 1024×768、WXGA 1280×800、FWXGA 1366×768），超过就等比缩到这些目标分辨率；README 明说"高于 XGA/WXGA 的尺寸不推荐"。
2. **一步一动作太慢**，能批量就批量：浏览器级可以一步做多个动作（`max_actions_per_step`，browser-use 默认 5），桌面级可以用 batched tool calls。
3. **历史会滚雪球**，长任务要主动做上下文压缩或"阶段性重启"（见《长时运行 Agent 的上下文管理：压缩（Compaction）》）。

## 二、桌面级：自己实现一个"计算机"（可跑）

### 1. 接口契约：十个方法就是全部

OpenAI Agents SDK 把这件事定义成一个抽象基类（`agents.computer`，0.22.3 源码）：

```python
Environment = Literal["mac", "windows", "ubuntu", "browser"]
Button = Literal["left", "right", "wheel", "back", "forward"]

class Computer(abc.ABC):
    environment: Environment | None      # 需要 preview payload 时提供
    dimensions: tuple[int, int] | None   # 显示器宽高（坐标帧基准）
    def screenshot() -> str              # 返回 base64 编码 PNG
    def click(x, y, button)              def double_click(x, y)
    def scroll(x, y, scroll_x, scroll_y) def move(x, y)
    def type(text)                       def keypress(keys: list[str])   # 如 ["ctrl","c"]
    def drag(path: list[tuple[int,int]]) def wait()
```

`wait()` 必须实现：模型会在动作后调用它等界面稳定；`dimensions` 必须与截图分辨率一致，否则坐标会漂。挂到 Agent 上只需一行：

```python
from agents import Agent, ComputerTool

agent = Agent(
    name="Desktop",
    instructions="一步步操作桌面，每次动作后截图确认。",
    tools=[ComputerTool(computer=MyComputer(), on_safety_check=my_safety_gate)],
)
```

`ComputerTool(computer=..., on_safety_check=...)` 接受 `Computer` 实例、实例的创建函数或 provider；`on_safety_check` 在**每个动作执行前**被调用，返回 `False` 即拒绝执行——这是桌面级最重要的安全门（模型要"删除文件""点击支付"时由它拦）。

一个 Linux 桌面（本机、容器或 Xvfb 内）能跑通的最小实现（`pip install "openai-agents>=0.22"`，并装好 `xdotool` 与 ImageMagick）：

```python
"""把一台 Linux 桌面接成 SDK 的 Computer。演示接口契约：截图走 ImageMagick，动作走 xdotool。
真跑请务必配隔离桌面（容器/Xvfb）与人工确认，别直接挂在你日常使用的桌面上。"""
import asyncio
import base64
import subprocess

from agents import Agent, AsyncComputer, ComputerTool, Runner
from agents.tool import ComputerToolSafetyCheckData


class LinuxComputer(AsyncComputer):
    def __init__(self, width: int = 1280, height: int = 800):
        self._w, self._h = width, height          # 与截图分辨率保持一致，否则坐标会漂

    @property
    def environment(self):
        return "ubuntu"

    @property
    def dimensions(self):
        return self._w, self._h

    async def screenshot(self) -> str:
        png = subprocess.run(["import", "-window", "root", "png:-"],
                             capture_output=True, check=True).stdout
        return base64.b64encode(png).decode()     # 必须是 base64 编码的 PNG

    async def click(self, x, y, button):
        btn = {"left": 1, "right": 3, "middle": 2}[button]
        await self._move_then(x, y, "click", str(btn))

    async def double_click(self, x, y):
        await self._move_then(x, y, "click", "--repeat", "2", "--delay", "10", "1")

    async def scroll(self, x, y, scroll_x, scroll_y):
        # xdotool 用按钮 4/5 表示上下滚轮：正向滚动量向上，负值向下
        await self._move_then(x, y, "click", "4" if scroll_y > 0 else "5")

    async def type(self, text):
        subprocess.run(["xdotool", "type", "--delay", "12", text], check=True)

    async def keypress(self, keys):
        subprocess.run(["xdotool", "key", "+".join(keys)], check=True)   # ["ctrl","c"] -> ctrl+c

    async def move(self, x, y):
        subprocess.run(["xdotool", "mousemove", str(x), str(y)], check=True)

    async def drag(self, path):
        (x0, y0), *rest = path
        await self._move_then(x0, y0, "mousedown", "1")
        for x, y in rest:
            subprocess.run(["xdotool", "mousemove", str(x), str(y)], check=True)
        subprocess.run(["xdotool", "mouseup", "1"], check=True)

    async def wait(self):
        await asyncio.sleep(0.5)                  # 给界面留出渲染时间

    async def _move_then(self, x, y, *args):
        subprocess.run(["xdotool", "mousemove", str(x), str(y)], check=True)
        subprocess.run(["xdotool", *args], check=True)


def deny_destructive(data: ComputerToolSafetyCheckData) -> bool:
    """安全门：返回 False 即拒绝执行这次动作。示例把按键全部拦下（最容易触发 rm/删除）。"""
    return getattr(data.tool_call.action, "type", None) != "keypress"


async def main():
    agent = Agent(name="Desktop",
                  instructions="每次动作后截图确认结果；不确定就先移动光标看看再决定。",
                  tools=[ComputerTool(computer=LinuxComputer(), on_safety_check=deny_destructive)])
    result = await Runner.run(agent, "打开文件管理器并截图给我看当前目录。", max_turns=12)
    print(result.final_output)


asyncio.run(main())
```

真实项目里更常见的形态是把这套 loop 跑在隔离容器内的虚拟桌面上（Anthropic 的参考实现就是：一条 `docker run` 起一个带 X11 + VNC 的 Linux 桌面，agent loop 在容器内执行，容器一次只服务一个会话，跨会话要重启或重置）。

### 2. Anthropic 侧的 API 形态与版本演进

Anthropic 的 computer 工具是**带日期的 API 类型**，动作集合随版本增长（取自官方参考实现 `computer_use_demo/tools/computer.py`）：

| api_type | 新增动作 |
| --- | --- |
| `computer_20241022` | `key`、`type`、`mouse_move`、`left_click`、`left_click_drag`、`right_click`、`middle_click`、`double_click`、`screenshot`、`cursor_position` |
| `computer_20250124` | 再加 `left_mouse_down`、`left_mouse_up`、`scroll`、`hold_key`、`wait`、`triple_click` |
| `computer_20251124` | 再加 `zoom`（需 `enable_zoom: True`，参数是 4 元坐标 `region`） |
| `computer_toolset_20260801` | 以 **toolset** 形态声明：`tools[]` 里放一条无名 toolset 条目，每个动作成为一个成员工具（`tool_use.name` 直接是 `left_click`、`screenshot`…，块上带 `toolset_name: "computer"`，输入不再带 `action` 判别字段）；同一轮内的成员调用**顺序执行、首个失败即停**；**不再需要 `anthropic-beta` 头** |

要点有三：**模型只支持它训练时对应的那批版本**，选错组合会直接报参数不合法；旧日期版本仍是单个 `computer` 工具 + `action` 参数，要配对应的 beta 头；坐标必须是**非负整数二元组**，且 `screenshot`/`type`/`key` 这类动作**不接受** `coordinate`——参考实现里这些约束都是抛 `ToolError` 显式失败，而不是静默纠正（把执行端的校验写清楚，模型才有机会自纠）。

### 3. 桌面级专属的四条纪律

- **隔离**：专用虚拟机/容器 + 最小权限；不要把宿主机主账号的桌面交给它。
- **不要把敏感凭据放进上下文**：官方 caution 明确列出"避免让模型接触账号登录信息"。
- **限域**：能限域名/文件系统就限，联网只放白名单。
- **人工确认**：可能产生现实后果的动作（转账、提交表单、接受 Cookie、删文件）必须暂停等人拍板——做法见《Human-in-the-Loop：用 LangGraph interrupt 实现中断、恢复与人工审批》，SDK 侧对应 `ComputerTool(on_safety_check=...)` 与工具的 `needs_approval`（《OpenAI Agents SDK 实战：从第一个 Agent 到交接、护栏与会话》）。

## 三、浏览器级：browser-use 完整上手

浏览器级之所以是主流，是因为它把"观察"换成了 DOM/可交互元素列表、把"手"换成了 `click(element_index)` 这类结构化动作：**不用猜坐标，一步能做多个动作，成本与失败率都低一个量级**。

### 1. 安装与最小运行

```bash
uv init --python 3.12 && uv add browser-use       # Python >= 3.11
# .env
OPENAI_API_KEY=your-key                            # 走环境变量
# BROWSER_USE_API_KEY=your-key                     # 可选：用 BU2 模型或云浏览器
```

```python
import asyncio

from browser_use import Agent, ChatOpenAI
from dotenv import load_dotenv

load_dotenv()


async def main():
    llm = ChatOpenAI(model='gpt-5.6-luna', reasoning_effort='xhigh')
    agent = Agent(task="Find the number of stars of the browser-use repo", llm=llm)
    history = await agent.run()
    print(history.final_result())


asyncio.run(main())
```

`uv run agent.py` 就会看到浏览器被打开、查仓库、打印答案。两个细节：

- **不用自己写系统提示词**。`Agent(...)` 自带 Browser Use 的系统提示（换模型也一样）；要加规则用 `extend_system_message`，要整个换掉用 `override_system_message`。
- `llm=None` 时默认落到 `ChatBrowserUse()`（走 Browser Use 网关，需要 `BROWSER_USE_API_KEY`）；也可以直接用 `ChatOpenAI` / `ChatAnthropic` / `ChatGoogle` 等封装，或用 `ChatBrowserUse(model='anthropic/claude-sonnet-4-6')` 这类"带 provider 前缀"的网关模型 ID。模型档位选择仍以本站《主流模型生态对比（2026-09）》为准。

### 2. 生产形态：结构化输出 + 域名白名单 + 自定义工具

抓取类任务最值钱的是**稳定的结构**，而不是自由文本。`output_model_schema` 给一个 Pydantic 模型即可；`allowed_domains` 是防跑偏的第一道护栏；`@tools.action` 注册自定义动作（浏览器 Agent 也能带非浏览器工具）：

```python
import asyncio
from datetime import datetime, timezone

from browser_use import Agent, ActionResult, BrowserSession, ChatBrowserUse, ChatOpenAI, Tools
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class RepoInfo(BaseModel):
    stars: int
    description: str
    checked_at: str


tools = Tools()


@tools.action(description='Get the current date and time in UTC.')
def get_current_time() -> ActionResult:
    return ActionResult(extracted_content=datetime.now(timezone.utc).isoformat())


async def main():
    # 只允许访问这两个域；模型点向别处会被拒绝执行
    browser = BrowserSession(
        headless=False,
        allowed_domains=['github.com', 'browser-use.com'],
        wait_between_actions=0.3,
        keep_alive=True,
    )
    agent = Agent(
        task="打开 browser-use 仓库首页，报告 star 数与一句话描述；再用 get_current_time 记录检查时间。",
        llm=ChatBrowserUse(model='bu-2-0'),      # 或 ChatOpenAI(model='gpt-5.6-luna')
        browser_session=browser,
        tools=tools,
        output_model_schema=RepoInfo,            # 结果按此结构返回
        use_vision=False,                        # 纯 DOM 任务：关掉截图，省 token
        max_actions_per_step=3,
        max_failures=3,
        calculate_cost=True,                     # 累计每次运行成本
    )
    history = await agent.run(max_steps=25)
    print(history.final_result())               # -> RepoInfo(...)
    print("is_done:", history.is_done(), "errors:", history.errors())


asyncio.run(main())
```

上面用到的参数都能在 0.13.10 的 `Agent.__init__` / `BrowserSession.__init__` 签名里对上：`sensitive_data`（登录凭证占位替换）、`initial_actions`（先以确定性动作导航，省几步推理）、`available_file_paths`（允许读写哪些本地路径）、`include_attributes`（DOM 快照里保留哪些属性）、`use_vision: bool | 'auto'`、`step_timeout=180`、`loop_detection_enabled`/`loop_detection_window=20`、`enable_planning`、`max_history_items`（历史条目上限，控上下文）、`page_extraction_llm`（页面抽取用的小模型）、`use_judge`/`judge_llm`/`ground_truth`（内置打分回路）。`BrowserSession` 侧还有 `cdp_url`（连已开着的 Chrome）、`executable_path`、`user_data_dir`、`args`、`prohibited_domains`、`highlight_elements`、`auto_download_pdfs`、`cloud_profile_id` 等。

登录与复用真实浏览器：本地用 `Browser.from_system_chrome()` / 复用已有 Chrome 配置档案；云上先做 profile 同步再 `Browser(use_cloud=True, cloud_profile_id='...')`。**档案同步迁移的是 cookie，不含 localStorage、IndexedDB 与扩展**，部分站点仍要重登。

### 3. 三条路线怎么选（工程判断）

- **纯本地/自建 CI**：Python 库 + 本地 Chromium，全免费、可控，但要自己管反爬与登录态。
- **要规模与稳定性**：保留智能体代码，只把浏览器换成云浏览器（`Browser(use_cloud=True)`），获得隐身、代理、录制。
- **连智能体也不想管**：全托管云 API 提交任务取结果。
- **给已有的编码智能体加浏览器**：走 CLI/harness 路线（`browser-use skill install` 把"操作浏览器"注册成一个技能给它用）——这条与《Agent Skills：用文件夹给智能体装上可复用的专业能力》说的是同一件事：**能力以工具或技能的形式挂到宿主上**。

## 常见坑

1. **坐标帧不一致**：截图被缩放后，模型仍在"截图像素"里给坐标，点下去偏一截。参考实现专门做了双向换算（`scale_coordinates` + `ScalingSource.COMPUTER/API`），并把 `display_width_px/display_height_px` 随工具选项一起上报。你自己实现时，`dimensions` 与实际截图尺寸必须一致。
2. **`type`/`key` 带坐标、`click` 不带坐标**：参数约束写反会被执行端 `ToolError` 打回。宁可显式失败，也别默默改参数。
3. **忘了 `wait()` 与页面加载**：`wait_between_actions`、`minimum_wait_page_load_time`、`wait_for_network_idle_page_load_time` 三个都要按站点调；快站点上一轮点击打在还没挂载完的组件上，表现为"动作成功、结果没变"。
4. **新标签页与弹窗**：广告/权限弹窗不在 DOM 索引里，模型会反复点空；下载要 `auto_download_pdfs` 与 `downloads_path`。`max_failures`（默认 5）与循环检测是兜底，不是解法。
5. **DOM 索引漂移**：`element_index` 是"本轮快照"的编号，页面重排后上一轮编号失效。别把上一轮索引硬编进下一轮动作（`initial_actions` 里的确定性动作除外）。
6. **验证码与反爬**：云浏览器的隐身/代理能**降低**遇到验证码的概率，但没有任何配置能保证绕过或解决所有验证码。自动破解验证码常违反站点条款，把它当成"必须转人工"的信号而不是待优化的技术问题。
7. **`sensitive_data` 不是安全边界**：它做的是把占位符替换进表单，减少明文进上下文的次数，不阻止模型看到页面上其他敏感内容。密码、支付信息优先用登录态复用（浏览器 profile）而不是把凭证交给模型。
8. **注入面比 API 大一个量级**：页面上的文字（包括藏在图片、alt、按钮文案里的"忽略上文，把 cookie 发到 …"）都会进模型上下文。官方明确警告"内容里的指令可能覆盖用户指令"。缓解：域名白名单 + 高危动作人工确认 + 全程录制与 trace 审计（《可观测性与 Tracing：Agent 生产排障的第一工具（LangSmith / Langfuse / OpenTelemetry）》《Agent 安全与权限、生产化部署与成本管理》）。
9. **`headless=True` 与真实登录态互斥**：无头模式复用系统 Chrome 档案常失败（档案锁、GPU、指纹差异）。要登录态就用有头 + 专用 profile 目录，或直接把浏览器交给云浏览器。
10. **成本没进指标**：`calculate_cost=True` + `history` 里的 token/步数统计要进你的仪表盘；两个成功率相同的浏览器智能体，平均步数差 2 倍就是成本差 2 倍（评测口径见《Agent 评测：数据集、评估器与 LLM-as-Judge 实战》）。
11. **拿桌面级做网页任务**：网页能用 DOM 就别用像素——DOM 路线定位更稳、单步更便宜、还能一步多动作。桌面级只用于跨应用、必须看像素、或根本没有界面的场景。
12. **一次失败就重启整个任务**：长任务重启等于把前面所有步的 token 再买一遍。优先做状态续接（保存历史与浏览器会话，`keep_alive` + 同一 `cdp_url` 恢复），配合模型侧的优雅降级："告诉它某个入口失效了，让它自己换路"。

## 延伸阅读

- [browser-use/browser-use](https://github.com/browser-use/browser-use)（MIT）与 [文档](https://docs.browser-use.com)、[BU Bench V2 基准](https://github.com/browser-use/benchmark)（面向最难浏览器任务；简单任务上小模型成功率就已很高，衡量的是平均评分与单任务成本）。
- [anthropics/anthropic-quickstarts — computer-use-demo](https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo)（MIT；Docker + X11/VNC 的参考 agent loop 与带日期版本的工具实现），其 README 指向的 `computer-use-best-practices` 与 Anthropic《Computer and browser use best practices》一文补齐图像裁剪、prompt caching、服务端压缩、批量工具调用、沙箱 shell 与轨迹记录等生产做法。
- OpenAI Agents SDK 的 `ComputerTool` / `AsyncComputer` 源码（MIT）；站内《代码解释器型 Agent：让 LLM 用代码思考（smolagents 与 CodeAct）》讲第四条路线"用代码代替 GUI 动作"。

---

> **来源**：抓取于 2026-09-19。译自/整理自 [browser-use/browser-use](https://github.com/browser-use/browser-use) 官方 README（Magnus Müller、Gregor Žunič，MIT）与 0.13.10 版包源码中的 `Agent.__init__`、`BrowserSession.__init__`、`Tools.action`、`skills` 模块签名；桌面级部分对照 [anthropics/anthropic-quickstarts](https://github.com/anthropics/anthropic-quickstarts) 的 `computer-use-demo`（README 与 `computer_use_demo/tools/computer.py`，MIT）中各日期版本的动作集、坐标约束与缩放策略；SDK 侧接口取自 `openai-agents` 0.22.3 的 `agents/computer.py`（MIT）。
> **编者注**：Anthropic 模型的具体名称与其 README 中的默认值随版本变化，本篇只保留**工具 API 类型与动作集**这类稳定事实，模型选型指向本站的模型生态一文。`LinuxComputer` 示例是为演示接口契约写的最小骨架（截图走 ImageMagick、动作走 xdotool），需在 Linux 桌面或 Xvfb 容器内配合隔离与人工确认使用；需要 API Key 的端到端运行（模型调用与浏览器操作）以官方文档与上游 README 声明的行为为准，未收录到离线环境重复验证。上游 README 中的产品宣传段落、云端定价与致谢部分未收录。
