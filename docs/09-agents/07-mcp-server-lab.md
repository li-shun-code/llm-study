---
title: MCP Server 实战：从零构建一个天气查询服务器
source_url: https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server
author: Model Context Protocol 项目（Anthropic 等维护）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: MCP 规范 2026-07-28；Python MCP SDK ≥ 2.0.0
order: 7
---

> **来源**：本文翻译自 [Build an MCP server](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-server)，作者 Model Context Protocol 项目（Anthropic 等维护），许可 MIT。抓取于 2026-09-13。本文选取官方教程的 Python 路线全文翻译（原文另含 TypeScript 路线，结构相同）；代码按 Python MCP SDK 2.0+ 的 `MCPServer` 新写法，`uv` 工程化的环境搭建参见本站模块 3。

# 构建一个 MCP Server

本教程将构建一个简单的 MCP 天气服务器，并把它连接到一个 MCP 主机（Host）——Claude for Desktop。

## 我们要构建什么

我们将构建一个暴露两个工具（Tool）的服务器：`get_alerts` 与 `get_forecast`，然后把服务器接入 MCP 主机（本例为 Claude for Desktop），即可在聊天中直接问"Sacramento 现在天气如何？"、"Texas 当前有哪些气象预警？"。

> **注**：MCP 服务器可以接入任何 MCP 客户端。这里选 Claude for Desktop 只是为了简单；官方也有[构建自己的客户端](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-client)的教程。

## 核心 MCP 概念

MCP 服务器可以提供三类主要能力：

1. **资源（Resources）**：类似文件的数据，可被客户端读取（如 API 响应、文件内容）。
2. **工具（Tools）**：可被 LLM 调用的函数（需用户批准）。
3. **提示（Prompts）**：帮助用户完成特定任务的预写模板。

本教程主要聚焦**工具**。

## MCP 服务器中的日志

实现 MCP 服务器时要小心日志的处理方式：

**对基于 STDIO 的服务器**：绝不要往 stdout 写任何东西。写入 stdout 会污染 JSON-RPC 消息、搞坏你的服务器。Python 的 `print()` 默认写 stdout，所以在 STDIO 服务器里要完全避免使用。

**对基于 HTTP 的服务器**：标准输出日志没有问题，因为它不会干扰 HTTP 响应。

### 最佳实践

- 使用标准库 `logging` 模块，它默认写到 stderr。
- 每个模块用 `logging.getLogger(__name__)` 创建一个 logger，并在工具函数中调用。

### 快速示例

```python
import logging

logger = logging.getLogger(__name__)

# ❌ 错误（STDIO 服务器）
print("Processing request")

# ✅ 正确（STDIO 服务器）
logger.info("Processing request")  # 写到 stderr
```

## 系统要求

- 已安装 Python 3.10 或更高版本。
- 必须使用 Python MCP SDK 2.0.0 或更高版本。

## 搭建环境

先安装 `uv` 并初始化 Python 项目与环境：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

安装后记得重启终端，确保 `uv` 命令生效。接着创建并配置项目：

```bash
# 为项目新建目录
uv init weather
cd weather

# 创建虚拟环境并激活
uv venv
source .venv/bin/activate

# 安装依赖
uv add "mcp[cli]"

# 创建服务器文件
touch weather.py
```

## 编写服务器

### 导入包并创建实例

把以下内容加到 `weather.py` 顶部：

```python
from typing import Any

import httpx2
from mcp.server import MCPServer

# 初始化 MCPServer
mcp = MCPServer("weather")

# 常量
NWS_API_BASE = "https://api.weather.gov"
USER_AGENT = "weather-app/1.0"
```

`httpx2` 是 MCP SDK 自身依赖的 HTTP 客户端，所以安装 `mcp` 时已经一并装好了。

`MCPServer` 类利用 Python 类型注解与 docstring 自动生成工具定义，让 MCP 工具的创建和维护变得非常简单。

### 辅助函数

接下来添加用于查询和格式化美国国家气象局（NWS）API 数据的辅助函数：

```python
async def make_nws_request(url: str) -> dict[str, Any] | None:
    """Make a request to the NWS API with proper error handling."""
    headers = {"User-Agent": USER_AGENT, "Accept": "application/geo+json"}
    async with httpx2.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, timeout=30.0)
            response.raise_for_status()
            return response.json()
        except Exception:
            return None


def format_alert(feature: dict) -> str:
    """Format an alert feature into a readable string."""
    props = feature["properties"]
    return f"""
Event: {props.get("event", "Unknown")}
Area: {props.get("areaDesc", "Unknown")}
Severity: {props.get("severity", "Unknown")}
Description: {props.get("description", "No description available")}
Instructions: {props.get("instruction", "No specific instructions provided")}
"""
```

### 实现工具执行

工具执行处理器负责真正执行每个工具的逻辑：

```python
@mcp.tool()
async def get_alerts(state: str) -> str:
    """Get weather alerts for a US state.

    Args:
        state: Two-letter US state code (e.g. CA, NY)
    """
    url = f"{NWS_API_BASE}/alerts/active/area/{state}"
    data = await make_nws_request(url)

    if not data or "features" not in data:
        return "Unable to fetch alerts or no alerts found."

    if not data["features"]:
        return "No active alerts for this state."

    alerts = [format_alert(feature) for feature in data["features"]]
    return "\n---\n".join(alerts)


@mcp.tool()
async def get_forecast(latitude: float, longitude: float) -> str:
    """Get weather forecast for a location.

    Args:
        latitude: Latitude of the location
        longitude: Longitude of the location
    """
    # 先获取预报网格端点
    points_url = f"{NWS_API_BASE}/points/{latitude},{longitude}"
    points_data = await make_nws_request(points_url)

    if not points_data:
        return "Unable to fetch forecast data for this location."

    # 从 points 响应中取出预报 URL
    forecast_url = points_data["properties"]["forecast"]
    forecast_data = await make_nws_request(forecast_url)

    if not forecast_data:
        return "Unable to fetch detailed forecast."

    # 把预报时段格式化为可读文本
    periods = forecast_data["properties"]["periods"]
    forecasts = []
    for period in periods[:5]:  # 只展示接下来 5 个时段
        forecast = f"""
{period["name"]}:
Temperature: {period["temperature"]}°{period["temperatureUnit"]}
Wind: {period["windSpeed"]} {period["windDirection"]}
Forecast: {period["detailedForecast"]}
"""
        forecasts.append(forecast)

    return "\n---\n".join(forecasts)
```

注意上面的写法：函数签名中的类型注解（`state: str`、`latitude: float`）会变成工具的 JSON Schema，docstring 会成为工具描述，供 LLM 判断"何时该调用这个工具"。

### 运行服务器

最后初始化并启动服务器：

```python
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

服务器到此完成！运行 `uv run weather.py` 即可启动 MCP 服务器，它会监听来自 MCP 主机的消息。

下面把它接入现有的 MCP 主机 Claude for Desktop 进行测试。

## 用 Claude for Desktop 测试服务器

先确认安装了 Claude for Desktop（已安装的话请**更新到最新版本**）。

我们需要在 Claude for Desktop 的配置文件中注册要用的 MCP 服务器。用文本编辑器打开（不存在则新建）：

- macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows：`%AppData%\Claude\claude_desktop_config.json`
- Linux：`~/.config/Claude/claude_desktop_config.json`

在 `mcpServers` 键下添加服务器（MCP 相关 UI 只有在正确配置了至少一个服务器后才会显示）：

```json
{
  "mcpServers": {
    "weather": {
      "command": "uv",
      "args": [
        "--directory",
        "/ABSOLUTE/PATH/TO/PARENT/FOLDER/weather",
        "run",
        "weather.py"
      ]
    }
  }
}
```

> **注意**：`command` 字段可能需要写 `uv` 可执行文件的完整路径——macOS/Linux 用 `which uv`、Windows 用 `where uv` 查看。务必传入项目的**绝对路径**；Windows 的 JSON 路径记得用双反斜杠（`\\`）或正斜杠（`/`）。

这份配置告诉 Claude for Desktop 两件事：

1. 存在一个名为 "weather" 的 MCP 服务器；
2. 通过 `uv --directory /ABSOLUTE/PATH/TO/PARENT/FOLDER/weather run weather.py` 来启动它。

保存文件并**完全退出**后重启 Claude for Desktop。

## 验证工具已被识别

确认 Claude for Desktop 已经加载了 weather 服务器暴露的两个工具：点击输入框旁的"添加文件、连接器与更多"图标，悬停到 "Connectors"（连接器）菜单，应该能看到 `weather` 服务器。

如果服务器没有被识别，请跳到下面的"故障排查"。如果已出现在连接器菜单，就可以在 Claude for Desktop 里这样测试：

- "What's the weather in Sacramento?"（Sacramento 的天气怎么样？）
- "What are the active weather alerts in Texas?"（Texas 当前有哪些气象预警？）

> **注**：由于数据来自美国国家气象局（NWS），这些查询只对美国境内地点有效。

## 幕后发生了什么

当你提问时：

1. 客户端把你的问题发送给 Claude；
2. Claude 分析可用工具并决定使用哪一个（或哪几个）；
3. 客户端通过 MCP 服务器执行选定的工具；
4. 结果被送回 Claude；
5. Claude 组织出自然语言回答；
6. 回答展示给你！

这就是上一篇文章中"发现 → 列举 → 调用"链路在真实主机中的样子。

## 故障排查

**从 Claude for Desktop 拿日志**：macOS 的 MCP 相关日志在 `~/Library/Logs/Claude`（Linux 在 `~/.config/Claude/logs/`）：

- `mcp.log`：MCP 连接的一般性日志与连接失败信息。
- `mcp-server-服务器名.log`：对应服务器的 stderr 输出（STDIO 服务器的日志通常都走 stderr，所以里面不一定只有错误）。

```bash
# 查看 Claude 日志中的错误并持续跟踪
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

**服务器没出现在 Claude 里**：

1. 检查 `claude_desktop_config.json` 的语法；
2. 确保项目路径是绝对路径而非相对路径；
3. 彻底重启 Claude for Desktop（必须完全退出应用——macOS 用 Cmd+Q，只是关窗口不算退出，配置不会生效）。

**工具调用静默失败**：

1. 查看 Claude 的日志找错误；
2. 验证服务器能正常构建与运行；
3. 尝试重启 Claude for Desktop。

**天气 API 相关**：

- 报错"Failed to retrieve grid point data"通常是：坐标在美国之外、NWS API 出问题、或被限流。可用美国坐标、在请求间加小延迟、查看 NWS API 状态页。
- "No active alerts for [STATE]"不是错误——只是该州当前没有气象预警，换个州或等恶劣天气再试。

更多高级排障参见官方 [Debugging MCP](https://modelcontextprotocol.io/docs/2026-07-28/tools/debugging) 指南。

## 下一步

- **构建客户端**：学会写一个能连上你自己服务器的 MCP 客户端。
- **示例服务器**：浏览官方 MCP 服务器与参考实现画廊。
- **调试指南**：高效调试 MCP 服务器与集成。

到这里，你已经拥有了一个可以被任何 MCP 主机（Claude Desktop、VS Code、Cursor 等）复用的工具服务器——这正是 MCP "构建一次、处处集成"的价值所在。
