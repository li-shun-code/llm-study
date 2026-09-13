---
title: FastAPI 入门与 API Key 鉴权
source_url: https://fastapi.tiangolo.com/zh/tutorial/first-steps/
author: Sebastián Ramírez 及 FastAPI 贡献者
license: MIT License
fetched_at: 2026-09-13
translated: false
order: 13
versions: FastAPI 最新稳定版（Python 3.10+）
---
## 最简单的 FastAPI 文件

```python
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}
```

将其复制到 `main.py` 文件中，然后运行开发服务器：

```
$ uv run fastapi dev

 INFO:    Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
 INFO:    Started reloader process [383138] using WatchFiles
 INFO:    Started server process [383153]
 INFO:    Waiting for application startup.
 INFO:    Application startup complete.
```

打开浏览器访问 [http://127.0.0.1:8000](http://127.0.0.1:8000)，你将看到如下的 JSON 响应：

```
{"message": "Hello World"}
```

注意（官方文档当前版本）：启动命令是 `uv run fastapi dev`（开发模式，带自动重载）；**生产环境**官方提示使用 `fastapi run`。安装方式为 `uv add "fastapi[standard]"`（自带 `uvicorn` 等标准依赖）。

### 交互式 API 文档

跳转到 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)，你将会看到自动生成的交互式 API 文档（由 Swagger UI 提供）；访问 `/redoc` 还有 ReDoc 版本。

驱动这两个文档系统的正是 **OpenAPI** 模式：FastAPI 使用定义 API 的 OpenAPI 标准将你的所有 API 转换成"模式"，其中包含 API 路径、参数，以及数据的 JSON Schema 定义。你也可以直接在 [http://127.0.0.1:8000/openapi.json](http://127.0.0.1:8000/openapi.json) 查看它。你还可以用它自动生成与 API 通信的客户端代码。

### 分步概括

1. **导入 `FastAPI`**：`FastAPI` 是一个为你的 API 提供了所有功能的 Python 类（直接继承自 `Starlette`，因此你可以通过 FastAPI 使用所有 Starlette 的功能）。
2. **创建一个 `FastAPI`「实例」**：变量 `app` 是你创建所有 API 的主要交互对象。
3. **创建一个路径操作**：
   - 「路径」指 URL 中从第一个 `/` 起的后半部分，也常被称为「端点」或「路由」；
   - 「操作」指一种 HTTP「方法」：通常 `POST` 创建数据、`GET` 读取数据、`PUT` 更新数据、`DELETE` 删除数据；
   - `@app.get("/")` 是一个**路径操作装饰器**——它告诉 FastAPI 这个函数负责处理对路径 `/` 的 `GET` 请求（这就是上一篇讲过的装饰器的实际应用）。
4. **定义路径操作函数**：`async def root()` 中的函数体由 FastAPI 负责"什么时候调用"——你可以用 `def` 或 `async def` 定义（详见官方《并发与 async/await》文档：函数内需要 await 异步库时用 `async def`，否则用普通 `def` 让 FastAPI 把它放到线程池里跑，避免阻塞事件循环）。
5. **返回内容**：返回一个 `dict`，FastAPI 会自动将其转换为 JSON 并发送。

## 安全第一步：OAuth2 与 Bearer Token

现在给 API 加上身份验证。假设前端需要通过 **username** 和 **password** 与后端进行身份验证，我们可以用 **OAuth2** 在 FastAPI 中实现：

```python
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.security import OAuth2PasswordBearer

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


@app.get("/items/")
async def read_items(token: Annotated[str, Depends(oauth2_scheme)]):
    return {"token": token}
```

运行后打开 `/docs`，页面右上角会出现一个"Authorize"按钮，路径操作旁还有一个可点击的小锁图标——这就是 `OAuth2PasswordBearer` 声明自动接入交互式文档的效果。

要点解析：

- `password` "流"（flow）是 OAuth2 定义的处理安全与身份验证的一种方式：前端把 `username` 和 `password` 发送到 API 的特定 URL（即 `tokenUrl="token"` 声明的位置），API 校验后返回一个"令牌"；前端随后在每次请求中发送 `Authorization` 请求头，值为 `Bearer` 加上令牌（如 `Bearer foobar`）。令牌通常一段时间后过期，被盗风险也小于永久钥匙。
- `oauth2_scheme` 变量是 `OAuth2PasswordBearer` 类的一个实例，它接收 `tokenUrl` 参数（客户端用来发送用户名密码换取令牌的 URL，此参数不创建该端点，只是把信息写入 OpenAPI 供文档使用）。
- `token: Annotated[str, Depends(oauth2_scheme)]` 用到了**依赖注入**：FastAPI 先执行 `oauth2_scheme`（从请求的 `Authorization` 头中提取令牌），再把返回值作为 `token` 参数传给函数。若请求没有 Authorization 头，会自动返回 401 错误。官方建议优先使用 `Annotated` 版本写法。

## 实战：API Key 鉴权（编者补充）

给 LLM 服务加防护时，最常见的不是用户名密码登录，而是 **API Key**：调用方在请求头中带上 `X-API-Key: xxx`，服务端校验通过才放行。`fastapi.security` 内置了 `APIKeyHeader` 工具，配合依赖注入几行代码即可完成：

```python
import os
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Security
from fastapi.security import APIKeyHeader

app = FastAPI()

# 声明：API Key 从请求头 X-API-Key 中读取
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# 服务端自己的密钥列表（演示用；生产环境从环境变量/数据库读取，见模块 0 的 .env 方案）
VALID_KEYS = set(filter(None, os.getenv("APP_API_KEYS", "").split(",")))


async def verify_api_key(
    api_key: Annotated[str | None, Security(api_key_header)],
) -> str:
    if api_key is None:
        raise HTTPException(status_code=401, detail="缺少 API Key（请求头 X-API-Key）")
    if api_key not in VALID_KEYS:
        raise HTTPException(status_code=403, detail="API Key 无效")
    return api_key


@app.get("/v1/chat")
async def chat(prompt: str, api_key: Annotated[str, Depends(verify_api_key)]):
    return {"key": api_key, "reply": f"收到：{prompt}"}
```

测试：

```
$ curl http://127.0.0.1:8000/v1/chat?prompt=hi
{"detail":"缺少 API Key（请求头 X-API-Key）"}

$ curl -H "X-API-Key: sk-demo" "http://127.0.0.1:8000/v1/chat?prompt=hi"
{"key":"sk-demo","reply":"收到：hi"}
```

理解要点：

- `APIKeyHeader(name="X-API-Key")` 与上面的 `OAuth2PasswordBearer` 一样是**安全依赖**：FastAPI 负责提取请求头，并自动把"需要 API Key"写入 OpenAPI 文档，在 `/docs` 中出现 Authorize 按钮；
- `Security(...)` 是 `Depends(...)` 在安全场景的别名，还可以叠加 `scopes` 参数；
- 路径操作函数的参数声明 `Depends(verify_api_key)` 后，这个鉴权函数会在你的业务代码**之前**执行，抛出 `HTTPException` 即中断请求；
- 多个接口共享同一鉴权逻辑时，可把依赖声明到路由组或全局（`dependencies=[Depends(verify_api_key)]`），这正是"依赖注入"的价值：**横切逻辑与业务逻辑解耦**。

请求体校验则直接使用上一篇的 Pydantic 模型：在函数参数中声明 `body: ChatRequest`，FastAPI 自动完成 JSON 解析、校验与文档生成——两个库组合得天衣无缝。

## 延伸阅读

- 官方教程《安全》系列后续章节（`get-current-user`、OAuth2 with JWT）与《高级安全》；
- FastAPI 的 `lifespan` 机制：用 `@asynccontextmanager` 函数（见本模块第 3 篇）管理启动/关闭资源；
- 官方文档《Bigger Applications》：用 `APIRouter` 把多个文件组织成项目结构。

---

> **来源**：本文转载自 [第一步 - FastAPI 中文文档](https://fastapi.tiangolo.com/zh/tutorial/first-steps/)，作者 Sebastián Ramírez 及 FastAPI 贡献者，许可 MIT License。抓取于 2026-09-13。

---

> 编者注：本篇主体节选自 FastAPI 官方中文文档的《第一步》与《安全 - 第一步》（ https://fastapi.tiangolo.com/zh/tutorial/security/first-steps/ ，同许可）两页，"用 `APIKeyHeader` 做 API Key 鉴权"一节为编者基于官方 `fastapi.security` 工具的补充实战。FastAPI 是 LLM 应用服务端（封装模型 API、提供 SSE 流式接口）的事实标准框架。
