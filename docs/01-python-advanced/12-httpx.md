---
title: HTTPX：新一代 Python HTTP 客户端
source_url: https://www.python-httpx.org/quickstart/
author: Tom Christie（Encode 团队）
license: BSD 三条款许可证
fetched_at: 2026-09-13
translated: true
versions: HTTPX 当前稳定版
order: 12
group: HTTP 客户端
---
*编者导读：HTTPX 是继 requests 之后最受欢迎的 Python HTTP 客户端，API 与 requests 高度兼容，并额外支持异步、HTTP/2 与连接池细粒度控制。本篇由官方 quickstart、async 支持与 advanced（clients/authentication/timeouts/proxies/event-hooks/ssl/text-encodings/resource-limits/extensions）全部页面完整翻译而成。*

## 快速开始

首先，导入 HTTPX：

```pycon
>>> import httpx
```

现在，试着获取一个网页：

```pycon
>>> r = httpx.get('https://httpbin.org/get')
>>> r
<Response [200 OK]>
```

类似地，发起 HTTP POST 请求：

```pycon
>>> r = httpx.post('https://httpbin.org/post', data={'key': 'value'})
```

PUT、DELETE、HEAD 和 OPTIONS 请求都遵循同样的风格：

```pycon
>>> r = httpx.put('https://httpbin.org/put', data={'key': 'value'})
>>> r = httpx.delete('https://httpbin.org/delete')
>>> r = httpx.head('https://httpbin.org/get')
>>> r = httpx.options('https://httpbin.org/get')
```

### 在 URL 中传递参数

要在请求中附带 URL 查询参数，使用 `params` 关键字：

```pycon
>>> params = {'key1': 'value1', 'key2': 'value2'}
>>> r = httpx.get('https://httpbin.org/get', params=params)
```

想看这些值如何被编码进 URL 字符串，可以检查请求实际使用的 URL：

```pycon
>>> r.url
URL('https://httpbin.org/get?key2=value2&key1=value1')
```

也可以把列表作为值传入：

```pycon
>>> params = {'key1': 'value1', 'key2': ['value2', 'value3']}
>>> r = httpx.get('https://httpbin.org/get', params=params)
>>> r.url
URL('https://httpbin.org/get?key1=value1&key2=value2&key2=value3')
```

### 响应内容

HTTPX 会自动把响应内容解码为 Unicode 文本：

```pycon
>>> r = httpx.get('https://www.example.org/')
>>> r.text
'<!doctype html>\n<html>\n<head>\n<title>Example Domain</title>...'
```

可以查看将用于解码响应的编码：

```pycon
>>> r.encoding
'UTF-8'
```

某些情况下响应可能没有显式的编码信息，此时 HTTPX 会尝试自动确定编码。

```pycon
>>> r.encoding
None
>>> r.text
'<!doctype html>\n<html>\n<head>\n<title>Example Domain</title>...'
```

如果需要覆盖默认行为、显式设置解码编码，也可以做到：

```pycon
>>> r.encoding = 'ISO-8859-1'
```

### 二进制响应内容

对非文本响应，响应内容也可以按字节访问：

```pycon
>>> r.content
b'<!doctype html>\n<html>\n<head>\n<title>Example Domain</title>...'
```

`gzip` 和 `deflate` 这类 HTTP 响应压缩编码会自动解码。如果安装了 `brotlipy`，还支持 `brotli`；安装了 `zstandard` 则支持 `zstd`。

例如，用请求返回的二进制数据创建图片：

```pycon
>>> from PIL import Image
>>> from io import BytesIO
>>> i = Image.open(BytesIO(r.content))
```

### JSON 响应内容

Web API 的响应通常以 JSON 编码：

```pycon
>>> r = httpx.get('https://api.github.com/events')
>>> r.json()
[{u'repository': {u'open_issues': 0, u'url': 'https://github.com/...' ...  }}]
```

### 自定义请求头

要在请求中附加额外的头，使用 `headers` 关键字参数：

```pycon
>>> url = 'https://httpbin.org/headers'
>>> headers = {'user-agent': 'my-app/0.0.1'}
>>> r = httpx.get(url, headers=headers)
```

### 发送表单编码数据

某些 HTTP 请求（如 `POST` 和 `PUT`）可以在请求体中携带数据。常见方式之一是表单编码（form-encoded），即 HTML 表单使用的格式：

```pycon
>>> data = {'key1': 'value1', 'key2': 'value2'}
>>> r = httpx.post("https://httpbin.org/post", data=data)
>>> print(r.text)
{
  ...
  "form": {
    "key2": "value2",
    "key1": "value1"
  },
  ...
}
```

表单编码数据的一个键也可以对应多个值：

```pycon
>>> data = {'key1': ['value1', 'value2']}
>>> r = httpx.post("https://httpbin.org/post", data=data)
>>> print(r.text)
{
  ...
  "form": {
    "key1": [
      "value1",
      "value2"
    ]
  },
  ...
}
```

### 发送多部分（Multipart）文件上传

也可以用 HTTP multipart 编码上传文件：

```pycon
>>> with open('report.xls', 'rb') as report_file:
...     files = {'upload-file': report_file}
...     r = httpx.post("https://httpbin.org/post", files=files)
>>> print(r.text)
{
  ...
  "files": {
    "upload-file": "<... binary content ...>"
  },
  ...
}
```

可以用元组作为文件值，显式指定文件名与内容类型：

```pycon
>>> with open('report.xls', 'rb') as report_file:
...     files = {'upload-file': ('report.xls', report_file, 'application/vnd.ms-excel')}
...     r = httpx.post("https://httpbin.org/post", files=files)
>>> print(r.text)
{
  ...
  "files": {
    "upload-file": "<... binary content ...>"
  },
  ...
}
```

如果需要在 multipart 表单中附带非文件的数据字段，使用 `data=...` 参数：

```pycon
>>> data = {'message': 'Hello, world!'}
>>> with open('report.xls', 'rb') as report_file:
...     files = {'file': report_file}
...     r = httpx.post("https://httpbin.org/post", data=data, files=files)
>>> print(r.text)
{
  ...
  "files": {
    "file": "<... binary content ...>"
  },
  "form": {
    "message": "Hello, world!",
  },
  ...
}
```

### 发送 JSON 编码数据

如果只需要简单的键值结构，表单编码够用；对更复杂的数据结构，通常应改用 JSON 编码：

```pycon
>>> data = {'integer': 123, 'boolean': True, 'list': ['a', 'b', 'c']}
>>> r = httpx.post("https://httpbin.org/post", json=data)
>>> print(r.text)
{
  ...
  "json": {
    "boolean": true,
    "integer": 123,
    "list": [
      "a",
      "b",
      "c"
    ]
  },
  ...
}
```

### 发送二进制请求数据

对其他编码，应使用 `content=...` 参数，传入 `bytes` 类型或产出 `bytes` 的生成器：

```pycon
>>> content = b'Hello, world'
>>> r = httpx.post("https://httpbin.org/post", content=content)
```

上传二进制数据时，你可能还想设置自定义的 `Content-Type` 头。

### 响应状态码

可以查看响应的 HTTP 状态码：

```pycon
>>> r = httpx.get('https://httpbin.org/get')
>>> r.status_code
200
```

HTTPX 还提供了按文本短语访问状态码的便捷方式：

```pycon
>>> r.status_code == httpx.codes.OK
True
```

可以对任何非 2xx 成功码的响应引发异常：

```pycon
>>> not_found = httpx.get('https://httpbin.org/status/404')
>>> not_found.status_code
404
>>> not_found.raise_for_status()
Traceback (most recent call last):
  File "/Users/tomchristie/GitHub/encode/httpcore/httpx/models.py", line 837, in raise_for_status
    raise HTTPStatusError(message, response=self)
httpx._exceptions.HTTPStatusError: 404 Client Error: Not Found for url: https://httpbin.org/status/404
For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404
```

对成功状态码，该方法返回 `Response` 实例而不抛异常：

```pycon
>>> r.raise_for_status()
```

该方法返回响应实例，允许内联使用。例如：

```pycon
>>> r = httpx.get('...').raise_for_status()
>>> data = httpx.get('...').raise_for_status().json()
```

### 响应头

响应头以类字典接口提供：

```pycon
>>> r.headers
Headers({
    'content-encoding': 'gzip',
    'transfer-encoding': 'chunked',
    'connection': 'close',
    'server': 'nginx/1.0.4',
    'x-runtime': '148ms',
    'etag': '"e1ca502697e5c9317743dc078f67693f"',
    'content-type': 'application/json'
})
```

`Headers` 数据类型不区分大小写，可以任意大小写访问：

```pycon
>>> r.headers['Content-Type']
'application/json'

>>> r.headers.get('content-type')
'application/json'
```

同一响应头的多个值会合并为单个逗号分隔的值，遵循 [RFC 7230](https://tools.ietf.org/html/rfc7230#section-3.2)：

> 接收方可以将多个同名字段头合并为一个 "field-name: field-value" 对，而不改变消息语义，做法是把后续字段值按顺序追加到合并后的字段值后面，以逗号分隔。

### 流式响应

对大文件下载，你可能希望使用流式响应，避免把整个响应体一次性载入内存。

可以流式读取响应的二进制内容……

```pycon
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     for data in r.iter_bytes():
...         print(data)
```

或文本……

```pycon
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     for text in r.iter_text():
...         print(text)
```

或逐行流式读取文本……

```pycon
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     for line in r.iter_lines():
...         print(line)
```

HTTPX 使用通用换行符，把所有情况统一为 `\n`。

某些情况下你可能想访问未经内容解码的原始字节。此时服务器施加的 `gzip`、`deflate`、`brotli` 或 `zstd` 等内容编码不会被自动解码：

```pycon
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     for chunk in r.iter_raw():
...         print(chunk)
```

以这些方式使用流式响应时，`response.content` 与 `response.text` 属性不可用，访问会报错。不过你也可以利用流式功能有条件地加载响应体：

```pycon
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     if int(r.headers['Content-Length']) < TOO_LONG:
...         r.read()
...         print(r.text)
```

### Cookies

响应中设置的 cookie 可以轻松访问：

```pycon
>>> r = httpx.get('https://httpbin.org/cookies/set?chocolate=chip')
>>> r.cookies['chocolate']
'chip'
```

要在发出的请求中携带 cookie，使用 `cookies` 参数：

```pycon
>>> cookies = {"peanut": "butter"}
>>> r = httpx.get('https://httpbin.org/cookies', cookies=cookies)
>>> r.json()
{'cookies': {'peanut': 'butter'}}
```

Cookie 以 `Cookies` 实例返回，它是一个类字典数据结构，还提供按域或路径访问 cookie 的额外 API：

```pycon
>>> cookies = httpx.Cookies()
>>> cookies.set('cookie_on_domain', 'hello, there!', domain='httpbin.org')
>>> cookies.set('cookie_off_domain', 'nope.', domain='example.org')
>>> r = httpx.get('http://httpbin.org/cookies', cookies=cookies)
>>> r.json()
{'cookies': {'cookie_on_domain': 'hello, there!'}}
```

### 重定向与历史

默认情况下，HTTPX 对所有 HTTP 方法都**不会**跟随重定向，但可以显式启用。

例如，GitHub 会把所有 HTTP 请求重定向到 HTTPS：

```pycon
>>> r = httpx.get('http://github.com/')
>>> r.status_code
301
>>> r.history
[]
>>> r.next_request
<Request('GET', 'https://github.com/')>
```

可以用 `follow_redirects` 参数修改默认的重定向处理：

```pycon
>>> r = httpx.get('http://github.com/', follow_redirects=True)
>>> r.url
URL('https://github.com/')
>>> r.status_code
200
>>> r.history
[<Response [301 Moved Permanently]>]
```

响应的 `history` 属性可用于查看被跟随的重定向：它按发生顺序包含所有被跟随的重定向响应。

### 超时

HTTPX 默认为所有网络操作加入合理的超时，意味着连接若不能正常建立，总会抛出错误而不是无限挂起。

网络无活动的默认超时为五秒。可以把值调得更严或更松：

```pycon
>>> httpx.get('https://github.com/', timeout=0.001)
```

也可以完全禁用超时……

```pycon
>>> httpx.get('https://github.com/', timeout=None)
```

更高级的超时管理见下文《超时》一节。

### 认证

HTTPX 支持 Basic 与 Digest HTTP 认证。

提供 Basic 认证凭据时，把明文 `str` 或 `bytes` 组成的二元组作为 `auth` 参数传给请求函数：

```pycon
>>> httpx.get("https://example.com", auth=("my_user", "password123"))
```

提供 Digest 认证凭据时，需要用明文用户名和密码实例化 `DigestAuth` 对象，然后像上面一样作为 `auth` 参数传入：

```pycon
>>> auth = httpx.DigestAuth("my_user", "password123")
>>> httpx.get("https://example.com", auth=auth)
<Response [200 OK]>
```

### 异常

发生错误时 HTTPX 会抛出异常。其中最重要的异常类是 `RequestError` 与 `HTTPStatusError`。

`RequestError` 是一个父类，涵盖发起 HTTP 请求期间发生的任何异常。这些异常都带有 `.request` 属性：

```python
try:
    response = httpx.get("https://www.example.com/")
except httpx.RequestError as exc:
    print(f"An error occurred while requesting {exc.request.url!r}.")
```

`HTTPStatusError` 由 `response.raise_for_status()` 在响应非 2xx 成功码时抛出。这类异常同时带有 `.request` 和 `.response` 属性：

```python
response = httpx.get("https://www.example.com/")
try:
    response.raise_for_status()
except httpx.HTTPStatusError as exc:
    print(f"Error response {exc.response.status_code} while requesting {exc.request.url!r}.")
```

还有一个基类 `HTTPError` 同时涵盖这两类，可用于统一捕获"请求失败"或"4xx/5xx 响应"：

```python
try:
    response = httpx.get("https://www.example.com/")
    response.raise_for_status()
except httpx.HTTPError as exc:
    print(f"Error while requesting {exc.request.url!r}.")
```

或者分别处理：

```python
try:
    response = httpx.get("https://www.example.com/")
    response.raise_for_status()
except httpx.RequestError as exc:
    print(f"An error occurred while requesting {exc.request.url!r}.")
except httpx.HTTPStatusError as exc:
    print(f"Error response {exc.response.status_code} while requesting {exc.request.url!r}.")
```

完整的异常列表见官方《Exceptions（API 参考）》。

## 异步支持

HTTPX 默认提供标准同步 API，但也提供异步客户端选项。

异步是远比多线程高效的并发模型，能带来显著的性能收益，并支持 WebSocket 等长连接。如果你在使用异步 Web 框架，那么发出的 HTTP 请求也应使用异步客户端。

### 发起异步请求

异步请求需要 `AsyncClient`：

```pycon
>>> async with httpx.AsyncClient() as client:
...     r = await client.get('https://www.example.com/')
...
>>> r
<Response [200 OK]>
```

> **提示**：用 [IPython](https://ipython.readthedocs.io/en/stable/) 或 Python 3.9+ 的 `python -m asyncio` 可以在控制台交互式执行 `async`/`await` 表达式，方便试验。

### API 差异

使用异步客户端时，部分 API 变为异步方法。

**发起请求**：请求方法全部为异步，以下都应使用 `response = await client.get(...)` 风格：

- `AsyncClient.get(url, ...)`
- `AsyncClient.options(url, ...)`
- `AsyncClient.head(url, ...)`
- `AsyncClient.post(url, ...)`
- `AsyncClient.put(url, ...)`
- `AsyncClient.patch(url, ...)`
- `AsyncClient.delete(url, ...)`
- `AsyncClient.request(method, url, ...)`
- `AsyncClient.send(request, ...)`

**打开与关闭客户端**：需要上下文管理的客户端时用 `async with httpx.AsyncClient()`：

```python
async with httpx.AsyncClient() as client:
    ...
```

> **警告**：为了充分发挥连接池的收益，不要实例化多个客户端实例——例如不要在"热循环"里使用 `async with`。可以只创建一个作用域客户端并传递到各处使用，或使用单一的全局客户端实例。

也可以显式关闭客户端：`await client.aclose()`：

```python
client = httpx.AsyncClient()
...
await client.aclose()
```

**流式响应**：`AsyncClient.stream(method, url, ...)` 是异步上下文块：

```pycon
>>> client = httpx.AsyncClient()
>>> async with client.stream('GET', 'https://www.example.com/') as response:
...     async for chunk in response.aiter_bytes():
...         ...
```

异步响应流式方法包括：

- `Response.aread()` - 在流块内有条件地读取响应。
- `Response.aiter_bytes()` - 按字节流式读取响应内容。
- `Response.aiter_text()` - 按文本流式读取响应内容。
- `Response.aiter_lines()` - 按行流式读取响应内容。
- `Response.aiter_raw()` - 流式读取原始响应字节，不做内容解码。
- `Response.aclose()` - 关闭响应。通常不需要手动调用，`.stream` 块退出时会自动关闭。

当上下文块不适用时，可以用 `client.send(..., stream=True)` 发送 `Request` 实例进入"手动模式"。例如在 [Starlette](https://www.starlette.io) 中把响应转发给流式 Web 端点：

```python
import httpx
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse

client = httpx.AsyncClient()

async def home(request):
    req = client.build_request("GET", "https://www.example.com/")
    r = await client.send(req, stream=True)
    return StreamingResponse(r.aiter_text(), background=BackgroundTask(r.aclose))
```

> **警告**：使用这种"手动流式模式"时，确保 `Response.aclose()` 最终被调用是开发者的责任，否则连接会保持打开，很可能导致资源泄漏。

**流式请求体**：用 `AsyncClient` 发送流式请求体时，应使用异步字节生成器：

```python
async def upload_bytes():
    ...  # yield 字节内容

await client.post(url, content=upload_bytes())
```

**显式 transport 实例**：直接实例化 transport 时需要用 `httpx.AsyncHTTPTransport`：

```pycon
>>> import httpx
>>> transport = httpx.AsyncHTTPTransport(retries=1)
>>> async with httpx.AsyncClient(transport=transport) as client:
>>>     ...
```

### 支持的异步环境

HTTPX 支持 `asyncio` 或 `trio` 作为异步环境，并会自动检测用哪一个作为套接字操作与并发原语的后端。

**[AsyncIO](https://docs.python.org/3/library/asyncio.html)** 是 Python 内置的用 async/await 语法编写并发代码的库：

```python
import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        response = await client.get('https://www.example.com/')
        print(response)

asyncio.run(main())
```

**[Trio](https://github.com/python-trio/trio)** 是围绕[结构化并发原则](https://en.wikipedia.org/wiki/Structured_concurrency)设计的替代异步库：

```python
import httpx
import trio

async def main():
    async with httpx.AsyncClient() as client:
        response = await client.get('https://www.example.com/')
        print(response)

trio.run(main)
```

> **重要**：使用 Trio 后端必须安装 `trio` 包。

**[AnyIO](https://github.com/agronholm/anyio)** 是构建在 `asyncio` 或 `trio` 之上的异步网络与并发库，与你选择的后端的原生库无缝融合（默认 `asyncio`）：

```python
import httpx
import anyio

async def main():
    async with httpx.AsyncClient() as client:
        response = await client.get('https://www.example.com/')
        print(response)

anyio.run(main, backend='trio')
```
## 客户端实例（Client Instances）

> **提示**：如果你来自 requests，那么 `httpx.Client()` 就是 `requests.Session()` 的替代品。

### 为什么要用 Client？

> **一句话**：只要不是做实验、一次性脚本或原型，就应该使用 `Client` 实例。

**更高效地利用网络资源**

使用快速开始中的顶层 API 发请求时，HTTPX 要_为每个请求单独_建立新连接（连接不复用）。对同一主机的请求数量一多，这种方式的低效会迅速显现。

而 `Client` 实例使用 [HTTP 连接池](https://en.wikipedia.org/wiki/HTTP_persistent_connection)：对同一主机发起多个请求时，`Client` 会复用底层 TCP 连接，而不是每个请求都重建连接。

与顶层 API 相比，这能带来**显著的性能提升**，包括：

- 降低请求间延迟（无需握手）。
- 降低 CPU 占用与往返次数。
- 降低网络拥塞。

**额外功能**

`Client` 实例还支持顶层 API 不具备的功能：

- 跨请求的 cookie 持久化。
- 对所有发出的请求统一应用配置。
- 通过 HTTP 代理发送请求。
- 使用 [HTTP/2](https://www.python-httpx.org/http2/)。

### 用法

推荐把 `Client` 用作上下文管理器，确保离开 `with` 块时连接被正确清理：

```python
with httpx.Client() as client:
    ...
```

也可以不使用块语法，显式调用 `.close()` 关闭连接池：

```python
client = httpx.Client()
try:
    ...
finally:
    client.close()
```

### 发起请求

有了 `Client`，就可以用 `.get()`、`.post()` 等发送请求：

```pycon
>>> with httpx.Client() as client:
...     r = client.get('https://example.com')
...
>>> r
<Response [200 OK]>
```

这些方法接受的参数与 `httpx.get()`、`httpx.post()` 等相同——快速开始里的所有特性在客户端层级同样可用。例如发送带自定义头的请求：

```pycon
>>> with httpx.Client() as client:
...     headers = {'X-Custom': 'value'}
...     r = client.get('https://example.com', headers=headers)
...
>>> r.request.headers['X-Custom']
'value'
```

### 跨请求共享配置

通过给 `Client` 构造器传参，可以把配置应用到所有发出的请求上。例如_在每个请求_上附加自定义头：

```pycon
>>> url = 'http://httpbin.org/headers'
>>> headers = {'user-agent': 'my-app/0.0.1'}
>>> with httpx.Client(headers=headers) as client:
...     r = client.get(url)
...
>>> r.json()['headers']['User-Agent']
'my-app/0.0.1'
```

### 配置合并

当客户端层级与请求层级同时提供某个配置时：

- 对头、查询参数和 cookie，值会合并。例如：

```pycon
>>> headers = {'X-Auth': 'from-client'}
>>> params = {'client_id': 'client1'}
>>> with httpx.Client(headers=headers, params=params) as client:
...     headers = {'X-Custom': 'from-request'}
...     params = {'request_id': 'request1'}
...     r = client.get('https://example.com', headers=headers, params=params)
...
>>> r.request.url
URL('https://example.com?client_id=client1&request_id=request1')
>>> r.request.headers['X-Auth']
'from-client'
>>> r.request.headers['X-Custom']
'from-request'
```

- 对其他所有参数，请求层级的值优先。例如：

```pycon
>>> with httpx.Client(auth=('tom', 'mot123')) as client:
...     r = client.get('https://example.com', auth=('alice', 'ecila123'))
...
>>> _, _, auth = r.request.headers['Authorization'].partition(' ')
>>> import base64
>>> base64.b64decode(auth)
b'alice:ecila123'
```

需要对客户端层级与请求层级参数的合并做更细粒度控制时，见下文《Request 实例》。

### 仅客户端可用的配置项

`Client` 还接受一些请求层级不可用的配置。例如 `base_url` 可以为所有发出的请求添加 URL 前缀：

```pycon
>>> with httpx.Client(base_url='http://httpbin.org') as client:
...     r = client.get('/headers')
...
>>> r.request.url
URL('http://httpbin.org/headers')
```

全部客户端参数见官方 `Client` API 参考。

### Request 实例

要对"线上实际发送的内容"做最大程度的控制，HTTPX 支持显式构建 `Request` 实例：

```python
request = httpx.Request("GET", "https://example.com")
```

要把 `Request` 实例分发到网络，创建 `Client` 实例并用 `.send()`：

```python
with httpx.Client() as client:
    response = client.send(request)
    ...
```

如果需要以默认参数合并不支持的方式混用客户端层级与请求层级选项，可以用 `.build_request()` 然后对 `Request` 实例做任意修改：

```python
headers = {"X-Api-Key": "...", "X-Client-ID": "ABC123"}

with httpx.Client(headers=headers) as client:
    request = client.build_request("GET", "https://api.example.com")

    print(request.headers["X-Client-ID"])  # "ABC123"

    # 这个特定请求不发送 API key。
    del request.headers["X-Api-Key"]

    response = client.send(request)
    ...
```

### 监控下载进度

需要监控大响应的下载进度时，可使用响应流并检查 `response.num_bytes_downloaded` 属性。正确判断进度必须用这个接口，因为启用 HTTP 压缩时，`response.content` 或 `response.iter_content()` 返回的字节数并不总与响应的原始内容长度对应。

例如用 `tqdm` 在下载时显示进度条：

```python
import tempfile

import httpx
from tqdm import tqdm

with tempfile.NamedTemporaryFile() as download_file:
    url = "https://speed.hetzner.de/100MB.bin"
    with httpx.stream("GET", url) as response:
        total = int(response.headers["Content-Length"])

        with tqdm(total=total, unit_scale=True, unit_divisor=1024, unit="B") as progress:
            num_bytes_downloaded = response.num_bytes_downloaded
            for chunk in response.iter_bytes():
                download_file.write(chunk)
                progress.update(response.num_bytes_downloaded - num_bytes_downloaded)
                num_bytes_downloaded = response.num_bytes_downloaded
```

也可以改用 `rich` 库：

```python
import tempfile
import httpx
import rich.progress

with tempfile.NamedTemporaryFile() as download_file:
    url = "https://speed.hetzner.de/100MB.bin"
    with httpx.stream("GET", url) as response:
        total = int(response.headers["Content-Length"])

        with rich.progress.Progress(
            "[progress.percentage]{task.percentage:>3.0f}%",
            rich.progress.BarColumn(bar_width=None),
            rich.progress.DownloadColumn(),
            rich.progress.TransferSpeedColumn(),
        ) as progress:
            download_task = progress.add_task("Download", total=total)
            for chunk in response.iter_bytes():
                download_file.write(chunk)
                progress.update(download_task, completed=response.num_bytes_downloaded)
```

### 监控上传进度

上传大文件时可用请求内容生成器流式实现进度展示，例如配合 `tqdm`：

```python
import io
import random

import httpx
from tqdm import tqdm


def gen():
    """
    这是一个用随机字节生成的完整示例。
    可以把 `io.BytesIO` 换成真实文件对象。
    """
    total = 32 * 1024 * 1024  # 32m
    with tqdm(ascii=True, unit_scale=True, unit='B', unit_divisor=1024, total=total) as bar:
        with io.BytesIO(random.randbytes(total)) as f:
            while data := f.read(1024):
                yield data
                bar.update(len(data))


httpx.post("https://httpbin.org/post", content=gen())
```

### Multipart 文件编码

如快速开始所述，把"载荷名称为键、文件对象/字符串/元组为值"的字典传给 `files=` 即可使用 multipart 文件编码。当值为元组时，必须有 2 到 3 个元素：

- 第一个元素是可选的文件名，可为 `None`。
- 第二个元素可以是文件对象或字符串（字符串会自动按 UTF-8 编码）。
- 可选的第三个元素指定上传文件的 [MIME 类型](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_Types)。未指定时 HTTPX 会根据文件名猜测，未知扩展名默认为 "application/octet-stream"。若文件名显式为 `None`，则不会附带 content-type 头。

```pycon
>>> files = {'upload-file': (None, 'text content', 'text/plain')}
>>> r = httpx.post("https://httpbin.org/post", files=files)
>>> print(r.text)
{
  ...
  "files": {},
  "form": {
    "upload-file": "text-content"
  },
  ...
}
```

> **提示**：用这种方式上传大文件是安全的。文件上传默认就是流式的，同一时间内存中只有一块数据。

非文件数据字段可通过 `data=...` 加入 multipart 表单。还可以用多文件字段一次发送多个文件：传入 `(field, <file>)` 项组成的列表而非字典，即可在同一个 field 下传多个项。例如下面的请求在 `images` 表单字段上一次发送 `foo.png` 与 `bar.png` 两个文件：

```pycon
>>> with open('foo.png', 'rb') as foo_file, open('bar.png', 'rb') as bar_file:
...     files = [
...         ('images', ('foo.png', foo_file, 'image/png')),
...         ('images', ('bar.png', bar_file, 'image/png')),
...     ]
...     r = httpx.post("https://httpbin.org/post", files=files)
```

## 认证（Authentication）

认证既可以按请求单独配置：

```pycon
>>> auth = httpx.BasicAuth(username="username", password="secret")
>>> client = httpx.Client()
>>> response = client.get("https://www.example.com/", auth=auth)
```

也可以配置在客户端实例上，确保所有发出的请求都携带认证凭据：

```pycon
>>> auth = httpx.BasicAuth(username="username", password="secret")
>>> client = httpx.Client(auth=auth)
>>> response = client.get("https://www.example.com/")
```

### Basic 认证

HTTP basic 认证是一种不加密的认证方案，只是把用户名密码简单编码后放入请求的 `Authorization` 头。因为它不加密，通常只应在 `https` 上使用（尽管并未严格强制）：

```pycon
>>> auth = httpx.BasicAuth(username="finley", password="secret")
>>> client = httpx.Client(auth=auth)
>>> response = client.get("https://httpbin.org/basic-auth/finley/secret")
>>> response
<Response [200 OK]>
```

### Digest 认证

HTTP digest 认证是挑战-应答式认证方案。与 basic 认证不同，它提供加密，可用于未加密的 `http` 连接。它需要额外的往返来协商认证：

```pycon
>>> auth = httpx.DigestAuth(username="olivia", password="secret")
>>> client = httpx.Client(auth=auth)
>>> response = client.get("https://httpbin.org/digest-auth/auth/olivia/secret")
>>> response
<Response [200 OK]>
>>> response.history
[<Response [401 UNAUTHORIZED]>]
```

### NetRC 认证

HTTPX 可以配置为使用 [`.netrc` 配置文件](https://everything.curl.dev/usingcurl/netrc)认证。`.netrc` 文件把认证凭据与特定主机关联；请求 netrc 文件中的主机时，会以 HTTP basic 认证附带用户名密码。

`.netrc` 文件示例：

```
machine example.org
login example-username
password example-password

machine python-httpx.org
login other-username
password other-password
```

使用用户主目录的默认 `.netrc` 文件：

```pycon
>>> auth = httpx.NetRCAuth()
>>> client = httpx.Client(auth=auth)
```

显式指定 `.netrc` 文件路径：

```pycon
>>> auth = httpx.NetRCAuth(file="/path/to/.netrc")
>>> client = httpx.Client(auth=auth)
```

用 `NETRC` 环境变量配置路径，缺失时回退默认：

```pycon
>>> auth = httpx.NetRCAuth(file=os.environ.get("NETRC"))
>>> client = httpx.Client(auth=auth)
```

`NetRCAuth()` 类底层使用标准库的 `netrc.netrc()` 函数；文件找不到或无法解析时可能抛出的异常详见标准库文档。

### 自定义认证方案

发起请求或实例化客户端时，可用 `auth` 参数传入认证方案。`auth` 可以是：

- `username`/`password` 二元组（basic 认证）。
- `httpx.BasicAuth()`、`httpx.DigestAuth()` 或 `httpx.NetRCAuth()` 的实例。
- 一个可调用对象：接收请求并返回带认证信息的请求实例。
- `httpx.Auth` 子类的实例。

最强大的是最后一种：它能实现涉及一次或多次请求的认证流程。`httpx.Auth` 的子类应实现 `def auth_flow(request)`，并 yield 出需要发送的请求……

```python
class MyCustomAuth(httpx.Auth):
    def __init__(self, token):
        self.token = token

    def auth_flow(self, request):
        # 发送带自定义 `X-Authentication` 头的请求。
        request.headers['X-Authentication'] = self.token
        yield request
```

如果认证流程需要多次请求，可以多次 yield，并在每次拿到响应后处理：

```python
class MyCustomAuth(httpx.Auth):
    def __init__(self, token):
        self.token = token

    def auth_flow(self, request):
      response = yield request
      if response.status_code == 401:
          # 若服务器返回 401，则附加自定义 `X-Authentication` 头重发请求。
          request.headers['X-Authentication'] = self.token
          yield request
```

自定义认证类设计为不执行任何 I/O，因此可同时用于同步与异步客户端。如果你的认证方案需要请求体，需在类上用 `requires_request_body` 属性声明，然后就能在 `.auth_flow()` 方法内访问 `request.content`：

```python
class MyCustomAuth(httpx.Auth):
    requires_request_body = True

    def __init__(self, token):
        self.token = token

    def auth_flow(self, request):
      response = yield request
      if response.status_code == 401:
          request.headers['X-Authentication'] = self.sign_request(...)
          yield request

    def sign_request(self, request):
        # 基于 `request.method`、`request.url`、`request.headers`
        # 与 `request.content` 创建请求签名。
        ...
```

同理，若方案需要响应体，使用 `requires_response_body` 属性，之后即可访问 `response.content`、`response.text`、`response.json()` 等：

```python
class MyCustomAuth(httpx.Auth):
    requires_response_body = True

    def __init__(self, access_token, refresh_token, refresh_url):
        self.access_token = access_token
        self.refresh_token = refresh_token
        self.refresh_url = refresh_url

    def auth_flow(self, request):
        request.headers["X-Authentication"] = self.access_token
        response = yield request

        if response.status_code == 401:
            # 若服务器返回 401，则发起刷新令牌请求并重发原请求。
            refresh_response = yield self.build_refresh_request()
            self.update_tokens(refresh_response)

            request.headers["X-Authentication"] = self.access_token
            yield request

    def build_refresh_request(self):
        # 返回用于刷新令牌的 `httpx.Request`。
        ...

    def update_tokens(self, response):
        # 根据刷新响应更新 `.access_token` 与 `.refresh_token`。
        data = response.json()
        ...
```

如果_确实_需要执行 HTTP 请求之外的 I/O（如访问磁盘缓存），或需要使用锁等并发原语，则应重写 `.sync_auth_flow()` 与 `.async_auth_flow()`（而非 `.auth_flow()`）。前者被 `httpx.Client` 使用，后者被 `httpx.AsyncClient` 使用：

```python
import asyncio
import threading
import httpx


class MyCustomAuth(httpx.Auth):
    def __init__(self):
        self._sync_lock = threading.RLock()
        self._async_lock = asyncio.Lock()

    def sync_get_token(self):
        with self._sync_lock:
            ...

    def sync_auth_flow(self, request):
        token = self.sync_get_token()
        request.headers["Authorization"] = f"Token {token}"
        yield request

    async def async_get_token(self):
        async with self._async_lock:
            ...

    async def async_auth_flow(self, request):
        token = await self.async_get_token()
        request.headers["Authorization"] = f"Token {token}"
        yield request
```

若只想支持其中一种，也应重写并显式抛出 `RuntimeError`：

```python
import httpx
import sync_only_library


class MyCustomAuth(httpx.Auth):
    def sync_auth_flow(self, request):
        token = sync_only_library.get_token(...)
        request.headers["Authorization"] = f"Token {token}"
        yield request

    async def async_auth_flow(self, request):
        raise RuntimeError("Cannot use a sync authentication class with httpx.AsyncClient")
```

## 超时（Timeouts）

HTTPX 默认处处严格执行超时：网络无活动 5 秒后引发 `TimeoutException`。

可以为单个请求设置或禁用超时：

```python
# 顶层 API：
httpx.get('http://example.com/api/v1/example', timeout=10.0)

# 客户端实例：
with httpx.Client() as client:
    client.get("http://example.com/api/v1/example", timeout=10.0)
```

```python
# 顶层 API：
httpx.get('http://example.com/api/v1/example', timeout=None)

# 客户端实例：
with httpx.Client() as client:
    client.get("http://example.com/api/v1/example", timeout=None)
```

也可以在客户端实例上设置默认超时，对该客户端发出的请求生效：

```python
client = httpx.Client()              # 处处使用默认 5 秒超时。
client = httpx.Client(timeout=10.0)  # 处处使用默认 10 秒超时。
client = httpx.Client(timeout=None)  # 默认禁用所有超时。
```

### 细粒度配置

有四种可能发生的超时：**connect**、**read**、**write** 和 **pool**。

- **connect** 超时指定与目标主机建立套接字连接的最大等待时间。超时会引发 `ConnectTimeout`。
- **read** 超时指定等待收到一块数据（如响应体的一块）的最大时长。超时会引发 `ReadTimeout`。
- **write** 超时指定等待发出一块数据（如请求体的一块）的最大时长。超时会引发 `WriteTimeout`。
- **pool** 超时指定从连接池获取连接的最大等待时长。超时会引发 `PoolTimeout`。相关配置是连接池允许的最大连接数，由 `limits` 参数配置。

可以为以上任意一项配置超时行为：

```python
# 一个连接超时 60 秒、其他超时 10 秒的客户端。
timeout = httpx.Timeout(10.0, connect=60.0)
client = httpx.Client(timeout=timeout)

response = client.get('http://example.com/')
```

## 连接池限制（Resource Limits）

可以用客户端的 `limits` 关键字参数控制连接池大小。它接受 `httpx.Limits` 实例，用于定义：

- `max_keepalive_connections`：允许的 keep-alive 连接数，`None` 表示不限制。（默认 20）
- `max_connections`：允许的最大连接数，`None` 表示不限制。（默认 100）
- `keepalive_expiry`：空闲 keep-alive 连接的时限（秒），`None` 表示不限制。（默认 5）

```python
limits = httpx.Limits(max_keepalive_connections=5, max_connections=10)
client = httpx.Client(limits=limits)
```

## 代理（Proxies）

HTTPX 支持通过 `proxy` 参数设置 [HTTP 代理](https://en.wikipedia.org/wiki/Proxy_server#Web_proxy_servers)，可用于客户端初始化或 `httpx.get(..., proxy=...)` 等顶层 API 函数。

要把所有流量（HTTP 与 HTTPS）路由到位于 `http://localhost:8030` 的代理，把代理 URL 传给客户端：

```python
with httpx.Client(proxy="http://localhost:8030") as client:
    ...
```

更高级的用法是传入 mounts 字典。例如把 HTTP 与 HTTPS 请求分别路由到 `http://localhost:8030` 与 `http://localhost:8031` 两个代理：

```python
proxy_mounts = {
    "http://": httpx.HTTPTransport(proxy="http://localhost:8030"),
    "https://": httpx.HTTPTransport(proxy="http://localhost:8031"),
}

with httpx.Client(mounts=proxy_mounts) as client:
    ...
```

> **提示（常见坑）**：多数情况下，`https://` 键对应的代理 URL _应当_使用 `http://` 协议（这不是笔误！）。因为 HTTP 代理需要先与代理服务器建立连接——虽然你的代理可能支持 HTTPS 连接，但大多数代理只支持 HTTP。更多背景见官方文档 FORWARD vs TUNNEL 一节。

### 代理认证

代理凭据可作为代理 URL 的 `userinfo` 部分传入：

```python
with httpx.Client(proxy="http://username:password@localhost:8030") as client:
    ...
```

### 代理机制（进阶）

经由代理发起 HTTP 请求的流程一般是：

1. 客户端连接到代理（初始连接请求）。
2. 代理代表你向服务器传输数据。

第 2 步的具体方式取决于两种代理机制之一：

- **转发（Forwarding）**：代理替你发起请求，并把从服务器获得的响应发回。
- **隧道（Tunnelling）**：代理代表你建立与服务器的 TCP 连接，客户端复用这条连接发送请求、接收响应。这称为 [HTTP 隧道](https://en.wikipedia.org/wiki/HTTP_tunnel)。通过这种机制，可以经由 HTTP 代理访问 HTTPS 网站（客户端在代理提供的 TCP 连接上与服务器执行 TLS 握手，把连接"升级"为 HTTPS）。

### SOCKS

除 HTTP 代理外，`httpcore` 还支持 SOCKS 协议代理。这是可选功能，需额外安装第三方库：

```shell
$ pip install httpx[socks]
```

然后即可配置客户端通过 SOCKS 代理发起请求：

```python
httpx.Client(proxy='socks5://user:pass@host:port')
```

## 事件钩子（Event Hooks）

HTTPX 允许向客户端注册"事件钩子"（event hooks），在特定事件发生时被调用。目前有两种事件钩子：

- `request` - 请求完全就绪之后、发送到网络之前调用。传入 `request` 实例。
- `response` - 从网络取得响应之后、返回给调用方之前调用。传入 `response` 实例。

它们可用于安装客户端级别的日志、监控或追踪功能：

```python
def log_request(request):
    print(f"Request event hook: {request.method} {request.url} - Waiting for response")

def log_response(response):
    request = response.request
    print(f"Response event hook: {request.method} {request.url} - Status {response.status_code}")

client = httpx.Client(event_hooks={'request': [log_request], 'response': [log_response]})
```

也可以用钩子安装响应处理逻辑。例如下面的客户端在 4xx 与 5xx 响应时总是抛出 `httpx.HTTPStatusError`：

```python
def raise_on_4xx_5xx(response):
    response.raise_for_status()

client = httpx.Client(event_hooks={'response': [raise_on_4xx_5xx]})
```

> **注**：响应事件钩子在"是否读取响应体"判断之前被调用。如果需要在钩子内访问响应体，需调用 `response.read()`（异步客户端用 `response.aread()`）。

钩子也可以修改 `request` 与 `response` 对象：

```python
def add_timestamp(request):
    request.headers['x-request-timestamp'] = datetime.now(tz=datetime.utc).isoformat()

client = httpx.Client(event_hooks={'request': [add_timestamp]})
```

事件钩子必须始终以**可调用对象列表**设置，每类事件可注册多个钩子。除实例化时设置外，还有 `.event_hooks` 属性可查看与修改已安装的钩子：

```python
client = httpx.Client()
client.event_hooks['request'] = [log_request]
client.event_hooks['response'] = [log_response, raise_on_4xx_5xx]
```

> **注**：使用 HTTPX 异步支持时要注意：注册到 `httpx.AsyncClient` 的钩子必须是异步函数，而非普通函数。

## SSL 校验

发起 HTTPS 请求时，HTTPX 需要验证目标主机的身份。为此它使用由受信证书颁发机构（CA）签发的 SSL 证书包（CA bundle）。

### 启用与禁用校验

默认情况下 httpx 会校验 HTTPS 连接，对无效 SSL 报错：

```pycon
>>> httpx.get("https://expired.badssl.com/")
httpx.ConnectError: [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: certificate has expired (_ssl.c:997)
```

可以完全关闭 SSL 校验，允许不安全请求：

```pycon
>>> httpx.get("https://expired.badssl.com/", verify=False)
<Response [200 OK]>
```

### 配置客户端实例

使用 `Client()` 实例时，应在实例化客户端时传入 `verify=<...>` 配置。默认使用 [certifi CA 包](https://certifiio.readthedocs.io/en/latest/) 做 SSL 校验。

更复杂的配置可以传入 [SSL Context](https://docs.python.org/3/library/ssl.html) 实例：

```python
import certifi
import httpx
import ssl

# 该 SSL 上下文等价于默认的 `verify=True`。
ctx = ssl.create_default_context(cafile=certifi.where())
client = httpx.Client(verify=ctx)
```

用 [truststore 包](https://truststore.readthedocs.io/)支持系统证书库：

```python
import ssl
import truststore
import httpx

# 使用系统证书库。
ctx = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
client = httpx.Client(verify=ctx)
```

用标准 SSL 上下文 API 加载替代的证书校验库：

```python
import httpx
import ssl

# 使用显式配置的证书库。
ctx = ssl.create_default_context(cafile="path/to/certs.pem")  # cafile 或 capath。
client = httpx.Client(verify=ctx)
```

### 客户端证书

客户端证书让远端服务器校验客户端身份，常用于私有组织内部对远端服务器的请求认证。可用 [`.load_cert_chain()`](https://docs.python.org/3/library/ssl.html#ssl.SSLContext.load_cert_chain) API 指定：

```python
ctx = ssl.create_default_context()
ctx.load_cert_chain(certfile="path/to/client.pem")  # 可选 keyfile 或 password。
client = httpx.Client(verify=ctx)
```

### `SSL_CERT_FILE` 与 `SSL_CERT_DIR`

`httpx` 默认尊重 `SSL_CERT_FILE` 与 `SSL_CERT_DIR` 环境变量，详见官方环境变量页。

### 向本地服务器发起 HTTPS 请求

请求本地服务器（如跑在 `localhost` 的开发服务器）时通常用未加密的 HTTP。如果确实需要 HTTPS（例如测试仅支持 HTTPS 的服务），需要自建证书。一种做法：

1. 用 [trustme](https://github.com/python-trio/trustme) 生成一对服务器密钥/证书文件，以及一个客户端证书文件。
2. 启动本地服务器时传入服务器密钥/证书（取决于所用 Web 服务器，如 [Uvicorn](https://www.uvicorn.org) 的 `--ssl-keyfile` 与 `--ssl-certfile` 选项）。
3. 配置 httpx 使用 `client.pem` 中的证书：

```python
ctx = ssl.create_default_context(cafile="client.pem")
client = httpx.Client(verify=ctx)
```

## 文本编码（Text Encodings）

访问 `response.text` 时，需要把响应字节解码为 Unicode 文本。默认情况下 `httpx` 使用响应 `Content-Type` 头中的 `"charset"` 信息决定解码方式；响应未包含字符集信息时，默认假定 "utf-8" 编码——它是互联网上使用最广泛的文本编码。

### 使用默认编码

```python
import httpx
# 以默认配置实例化客户端。
client = httpx.Client()
# 使用客户端……
response = client.get(...)
print(response.encoding)  # 打印 Content-Type 中的 charset，或 "utf-8"。
print(response.text)      # 文本按 Content-Type 的 charset 或 "utf-8" 解码。
```

通常这完全够用：多数服务器会返回格式正确的 Content-Type 头（含 charset），而未包含 charset 时大概率也是 UTF-8。

### 使用显式编码

有些站点不显式设置字符集，但我们知道编码是什么。此时最好在客户端上显式设置默认编码：

```python
import httpx
# 以日语字符集作为默认编码实例化客户端。
client = httpx.Client(default_encoding="shift-jis")
response = client.get(...)
print(response.encoding)  # 打印 Content-Type 中的 charset，或 "shift-jis"。
print(response.text)      # 文本按 Content-Type 的 charset 或 "shift-jis" 解码。
```

### 使用自动检测

当服务器包含的字符集信息不可靠、且我们不知道编码时，可以启用自动检测，在字节到文本解码时做最佳猜测。

自动检测需要把 `default_encoding` 参数设为可调用对象而非字符串：该函数以输入字节为参数，返回用于解码的字符集。两个常用的 Python 包：

- [`chardet`](https://chardet.readthedocs.io/) - 老牌包，移植自 Mozilla 的自动检测代码。
- [`charset-normalizer`](https://charset-normalizer.readthedocs.io/) - 受 `chardet` 启发的新包，方法不同。

安装：

```shell
$ pip install httpx
$ pip install chardet
```

安装 `chardet` 后即可配置客户端启用字符集自动检测：

```python
import httpx
import chardet

def autodetect(content):
    return chardet.detect(content).get("encoding")

# 使用启用了字符集自动检测的客户端。
client = httpx.Client(default_encoding=autodetect)
response = client.get(...)
print(response.encoding)  # 打印 Content-Type 中的 charset，或自动检测到的字符集。
print(response.text)
```

## 扩展（Extensions）

请求与响应扩展提供了一个非类型化的空间，可容纳额外信息。扩展应用于那些并非所有 transport 都支持、且不适配底层 `httpcore` 包简化请求/响应模型的特性。

请求上支持若干扩展：

```python
# 请求超时实际上作为请求上的扩展实现，
# 确保它们贯穿整个调用栈。
client = httpx.Client()
response = client.get(
    "https://www.example.com",
    extensions={"timeout": {"connect": 5.0}}
)
response.request.extensions["timeout"]
{"connect": 5.0}
```

响应上也有扩展：

```python
client = httpx.Client()
response = client.get("https://www.example.com")
print(response.extensions["http_version"])  # b"HTTP/1.1"
# 其他服务器响应可能是
# b"HTTP/0.9"、b"HTTP/1.0" 或 b"HTTP/1.1"
```

### 请求扩展

**`"trace"`**：trace 扩展允许安装回调处理器，监控底层 `httpcore` transport 内部的事件流：

```python
import httpx

def log(event_name, info):
    print(event_name, info)

client = httpx.Client()
response = client.get("https://www.example.com/", extensions={"trace": log})
# connection.connect_tcp.started {'host': 'www.example.com', 'port': 443, ...}
# connection.connect_tcp.complete {'return_value': <httpcore.backends.sync.SyncStream object at ...>}
# connection.start_tls.started {'ssl_context': <ssl.SSLContext object at ...>, ...}
# http11.send_request_headers.started {'request': <Request [b'GET']>}
# http11.receive_response_headers.complete {'return_value': (b'HTTP/1.1', 200, b'OK', [...])}
# http11.response_closed.complete {'return_value': None}
```

`event_name` 与 `info` 参数会是以下形式之一：

- `{event_type}.{event_name}.started`，`<关键字参数字典>`
- `{event_type}.{event_name}.complete`，`{"return_value": <...>}`
- `{event_type}.{event_name}.failed`，`{"exception": <...>}`

注意：异步代码中传给 `"trace"` 的处理函数必须是 `async def ...` 函数。

当前暴露的事件类型包括：建立连接（`"connection.connect_tcp"`、`"connection.connect_unix_socket"`、`"connection.start_tls"`）；HTTP/1.1 事件（`"http11.send_request_headers"`、`"http11.send_request_body"`、`"http11.receive_response"`、`"http11.receive_response_body"`、`"http11.response_closed"`）；HTTP/2 事件（`"http2.send_connection_init"`、`"http2.send_request_headers"`、`"http2.send_request_body"`、`"http2.receive_response_headers"`、`"http2.receive_response_body"`、`"http2.response_closed"`）。

确切的 trace 事件集合可能随 `httpcore` 版本变化。若需要依赖特定事件集合，建议把包版本固定。

**`"sni_hostname"`**：服务器主机名，用于核对 SSL 证书提供的主机名。想连接显式 IP 而不用标准 DNS 主机名解析时需要此扩展：

```python
# 连接 '185.199.108.153'，但 Host 头用 'www.encode.io'，
# 且 SSL 校验服务器主机名时也用 'www.encode.io'。
client = httpx.Client()
headers = {"Host": "www.encode.io"}
extensions = {"sni_hostname": "www.encode.io"}
response = client.get(
    "https://185.199.108.153/path",
    headers=headers,
    extensions=extensions
)
```

**`"timeout"`**：`str: Optional[float]` 形式的超时字典，可包含 `'connect'`、`'read'`、`'write'`、`'pool'`：

```python
# 连接超过 5 秒、或在连接池上等待超过 10 秒即超时。
client = httpx.Client()
response = client.get(
    "https://www.example.com",
    extensions={"timeout": {"connect": 5.0, "pool": 10.0}}
)
```

httpx 的超时就是以该扩展实现的（保证超时值与请求实例关联并贯穿调用栈）。通常不需要直接操作这个扩展，用更高层的 `timeout` API 即可。

**`"target"`**：用作 [HTTP target 而非 URL 路径](https://datatracker.ietf.org/doc/html/rfc2616#section-5.1.2)的目标，用于构造原本不受支持的请求：带非标准转义的 URL 路径、使用绝对 URI 的正向代理请求、以主机名为 target 的 `CONNECT` 隧道代理请求、服务器级 `OPTIONS *` 请求：

```python
# 通常请求 "https://www.example.com/test^path" 会连接 "www.example.com"
# 并发送形如 GET /test%5Epath HTTP/1.1 的请求。
# 使用 target 扩展可以保留字面 '^'，即 GET /test^path HTTP/1.1。
# 注意请求仍必须是合法的 HTTP 请求：例如 target 中包含空白会引发 `LocalProtocolError`。
extensions = {"target": b"/test^path"}
response = httpx.get("https://www.example.com", extensions=extensions)
```

```python
# 这将发送 CONNECT * HTTP/1.1
extensions = {"target": b"*"}
response = httpx.request("CONNECT", "https://www.example.com", extensions=extensions)
```

### 响应扩展

**`"http_version"`**：HTTP 版本（字节串），如 `b"HTTP/1.1"`。HTTP/1.1 的响应行带显式版本，取值可能为 `b"HTTP/0.9"`、`b"HTTP/1.0"` 或 `b"HTTP/1.1"`；HTTP/2 协议中不再有响应版本，该值恒为 `b"HTTP/2"`。

**`"reason_phrase"`**：HTTP 响应的 reason-phrase（字节串），如 `b"OK"`。有些服务器会带自定义短语（不推荐）。HTTP/2 起不再在线路上传输 reason phrase；未包含该键时可用基于状态码的默认值。

**`"stream_id"`**：使用 HTTP/2 时，可通过该扩展确定响应所在数据流的 ID。

**`"network_stream"`**：该扩展提供了跳出标准请求/响应模型的 API，可直接读写网络，从而支持处理 HTTP `CONNECT` 与 `Upgrade` 请求。网络流接口包括：

- `read(max_bytes, timeout = None) -> bytes`
- `write(buffer, timeout = None)`
- `close()`
- `start_tls(ssl_context, server_hostname = None, timeout = None) -> NetworkStream`
- `get_extra_info(info) -> Any`

该 API 可作为处理 HTTP 代理、WebSocket 升级等高级用例的基础。网络流抽象还能访问底层套接字暴露的各种低层信息：

```python
response = httpx.get("https://www.example.com")
network_stream = response.extensions["network_stream"]

client_addr = network_stream.get_extra_info("client_addr")
server_addr = network_stream.get_extra_info("server_addr")
print("Client address", client_addr)
print("Server address", server_addr)
```

套接字的 SSL 信息也可以通过该接口获得，但需确保底层连接仍然打开：

```python
with httpx.stream("GET", "https://www.example.com") as response:
    network_stream = response.extensions["network_stream"]

    ssl_object = network_stream.get_extra_info("ssl_object")
    print("TLS version", ssl_object.version())
```

---

> **来源**：本文由 HTTPX 官方文档以下页面完整翻译并合并而成：[QuickStart（快速开始）](https://www.python-httpx.org/quickstart/)、[Async Support（异步支持）](https://www.python-httpx.org/async/)、[Advanced → Clients（客户端实例）](https://www.python-httpx.org/advanced/clients/)、[Authentication（认证）](https://www.python-httpx.org/advanced/authentication/)、[Timeouts（超时）](https://www.python-httpx.org/advanced/timeouts/)、[Proxies（代理）](https://www.python-httpx.org/advanced/proxies/)、[Event Hooks（事件钩子）](https://www.python-httpx.org/advanced/event-hooks/)、[SSL Verification（SSL 校验）](https://www.python-httpx.org/advanced/ssl/)、[Text Encodings（文本编码）](https://www.python-httpx.org/advanced/text-encodings/)、[Resource Limits（连接池限制）](https://www.python-httpx.org/advanced/resource-limits/)、[Extensions（扩展）](https://www.python-httpx.org/advanced/extensions/)。作者 Tom Christie（Encode），许可 BSD 三条款许可证。抓取于 2026-09-13。原文 Advanced 下的 Transports 页（自定义 transport 开发）未收录，见官方链接。

---

> 编者注：与 requests 的关键差异——① requests 默认无超时，而 HTTPX 默认 5 秒网络无活动即超时（LLM API 调用强烈建议保留超时，不要设 `None`）；② HTTPX 默认不跟随重定向（requests 默认跟随）；③ 流式转发 LLM 响应时用 `client.stream(...)` + `aiter_lines()`/`aiter_text()`，配合本模块《FastAPI 进阶》一篇的 `StreamingResponse`。异步调用示例需要能执行 `await` 的环境（脚本中用 `asyncio.run(...)` 包一层）。
