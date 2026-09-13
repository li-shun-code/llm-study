---
title: 用 FastAPI 封装 LLM 服务
source_url: https://fastapi.tiangolo.com/zh/tutorial/first-steps/
author: FastAPI 官方文档（中文版，tiangolo）
license: MIT
fetched_at: 2026-09-13
translated: false
order: 13
versions: FastAPI 当前稳定版（0.134.0+ 支持 stream-data；Python 3.10+）
---

学完前 12 篇，你已经能在脚本里调通 LLM API。真正的应用要把它**封装成 HTTP 服务**：前端、小程序、别的后端都能来调用，而 API Key 永远留在服务端。FastAPI 是做这件事的标配——Python 3.10+、原生 async、基于标准（OpenAPI + JSON Schema）、自带交互式文档。

## 一、最小的 FastAPI 应用

官方文档的第一个例子：

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}
```

保存为 `main.py`，起开发服务器：

```sh
$ uv run fastapi dev

 INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

概念速览（原文的分步讲解浓缩）：

- **路径**：URL 中 `/` 之后的部分（`/items/foo`），也叫端点（endpoint）或路由（route）；
- **操作**：HTTP 方法——`POST` 创建、`GET` 读取、`PUT` 更新、`DELETE` 删除；
- `@app.get("/")` 是**路径操作装饰器**，告诉 FastAPI 它下面的**路径操作函数**负责处理"路径 `/` + GET"；
- 函数可直接返回 `dict`、`list`、`str`、Pydantic 模型等，自动转 JSON。

打开 `http://127.0.0.1:8000/docs` 就有 Swagger UI 交互式文档——它由 FastAPI 从 **OpenAPI 模式**自动生成（OpenAPI 规范 + JSON Schema 描述数据结构）。浏览器访问 `http://127.0.0.1:8000` 会看到 JSON 响应：`{"message": "Hello World"}`。

## 二、封装一个 LLM 服务

**本站补充**：把第 01 篇的调用装进 FastAPI 的骨架里。

```text
# .env —— 模块 0 的方案：Key 只放环境文件，绝不写进代码
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1   # 换兼容端点时只改这里（见第 08 篇）
```

```python
# main.py
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI

load_dotenv()  # 读取 .env

app = FastAPI(title="LLM Service")
client = OpenAI()  # 自动读 OPENAI_API_KEY / OPENAI_BASE_URL


class ChatRequest(BaseModel):   # 请求体用 Pydantic 声明，FastAPI 自动校验
    message: str
    system: str = "你是一个乐于助人的助手。"


@app.post("/chat")
async def chat(req: ChatRequest) -> dict:
    """一次性返回完整回复（非流式）。"""
    response = client.responses.create(
        model="gpt-5.5",
        instructions=req.system,
        input=req.message,
    )
    return {"reply": response.output_text}
```

```sh
$ curl -X POST http://127.0.0.1:8000/chat \
    -H "Content-Type: application/json" \
    -d '{"message": "用一句话解释什么是 SSE"}'

# 示例响应（示意）
{"reply":"SSE（Server-Sent Events）是服务器通过 HTTP 向浏览器单向持续推送事件的机制，常用于 LLM 的流式输出。"}
```

到这里已经能体会到 FastAPI 与 LLM 的契合：**Pydantic 校验入参**（第 05 篇结构化输出的同款技术）、**async 天然匹配 SDK 的异步客户端**（`AsyncOpenAI`）、**OpenAPI 文档白送**。

## 三、流式接口：StreamingResponse + yield

FastAPI 官方"流式数据"页开篇点名的第一个用例正是我们的场景——**流式传输直接来自某个 AI LLM 服务的输出**（该特性自 FastAPI 0.134.0 起支持）。在路径操作函数里声明 `response_class=StreamingResponse`，用 `yield` 逐块发送：

```python
from collections.abc import AsyncIterable

from fastapi import FastAPI
from fastapi.responses import StreamingResponse

app = FastAPI()


@app.get("/story/stream", response_class=StreamingResponse)
async def stream_story() -> AsyncIterable[str]:
    for line in message.splitlines():
        yield line
```

要点（原文）：

- **FastAPI 把每个数据块原样交给 `StreamingResponse`**，不会尝试转 JSON；
- 常规 `def`（不带 `async`）同样可以 `yield`；
- 返回类型注解（`AsyncIterable[str]`）非必需——不涉及 Pydantic 序列化，注解只是给编辑器看的；
- 也可以 `yield` 字节（`AsyncIterable[bytes]`）。

**本站补充**：接到 LLM 上，把第 03 篇的 SDK 流式循环"翻译"成 HTTP 流——SDK 每产出一个事件就 `yield` 一段：

```python
from collections.abc import AsyncIterable

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from openai import AsyncOpenAI

client = AsyncOpenAI()


class ChatRequest(BaseModel):
    message: str


@app.post("/chat/stream", response_class=StreamingResponse)
async def chat_stream(req: ChatRequest) -> AsyncIterable[str]:
    """把模型的流式输出转发给客户端（text/event-stream 或纯文本流均可）。"""
    stream = await client.responses.create(
        model="gpt-5.5",
        input=req.message,
        stream=True,
    )
    async for event in stream:
        delta = getattr(event, "delta", None)  # 文本增量事件
        if delta:
            yield delta
```

> 本站提示：流式接口对接时要与客户端约定分块格式（纯文本流、按行分隔、还是标准 SSE 的 `data:` 帧）；另外第 03 篇讲过**流不可自动重试**，服务端应处理好客户端中途断开的情况。

## 四、长大了就拆模块：APIRouter

官方"更大的应用"篇给出的结构方案：把一组路径操作收进 `APIRouter`（可视作"迷你 FastAPI"），主应用再挂载：

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/users/", tags=["users"])
async def read_users():
    return [{"username": "Rick"}, {"username": "Morty"}]


@router.get("/users/me", tags=["users"])
async def read_user_me():
    return {"username": "fakecurrentuser"}
```

还可以在 Router 上统一设置前缀、标签、共享依赖与响应码：

```python
from fastapi import APIRouter, Depends, HTTPException
from ..dependencies import get_token_header

router = APIRouter(
    prefix="/items",
    tags=["items"],
    dependencies=[Depends(get_token_header)],
    responses={404: {"description": "Not found"}},
)
```

**本站补充**：典型的 LLM 服务目录可拆成——`main.py`（app 实例）、`routers/chat.py`（对话接口）、`dependencies.py`（放 API Key 读取、用户鉴权等共享依赖）、`models.py`（Pydantic 入参/出参对象）。`Depends(get_token_header)` 这种依赖注入正是加"自有 API Key 校验"的地方：**服务自己也要鉴权**，否则你替所有用户付 LLM 账单。

## 五、下一步

- 参数校验、`HTTPException`、统一错误处理：见模块 3 的 FastAPI 篇与第 06 篇错误处理的组合；
- 把本篇的 `/chat` 接口做成第 14 篇命令行聊天机器人的后端；
- 生产部署（容器化）在模块 10 展开。

## 六、本篇小结

- `FastAPI()` 实例 + 路径操作装饰器 + 返回 dict = 最小服务，`/docs` 白送交互文档；
- 封装 LLM：`.env` 管 Key（模块 0 方案），Pydantic 管入参，`AsyncOpenAI` 管调用；
- 流式：`response_class=StreamingResponse` + `yield`，FastAPI 0.134.0+ 原生支持，LLM 输出是官方点名的用例；
- 服务变大用 `APIRouter` 拆模块，用 `Depends` 挂鉴权依赖。

---

> **来源**：本文转载自 [FastAPI 官方文档中文版 · 第一步](https://fastapi.tiangolo.com/zh/tutorial/first-steps/)、[更大的应用](https://fastapi.tiangolo.com/zh/tutorial/bigger-applications/) 与 [流式数据](https://fastapi.tiangolo.com/zh/advanced/stream-data/)，作者 FastAPI（tiangolo）及文档贡献者，许可 MIT。抓取于 2026-09-13。
> 本文为编排整理（编译）：原文分属多个页面，本站按"把 LLM API 封装成自己的服务"的主线重组；标注"本站补充"的内容为编辑所加。FastAPI 的完整教程（Pydantic 校验、依赖项、鉴权等）见模块 3。
