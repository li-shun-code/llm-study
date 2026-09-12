---
title: httpx：requests 的现代继任者（含异步）
source_url: https://www.python-httpx.org/quickstart/
author: Tom Christie 及 HTTPX 贡献者
license: BSD 三条款许可证
fetched_at: 2026-09-13
translated: true
order: 9
versions: httpx 0.28+
---

> **来源**：本文翻译自 [QuickStart - HTTPX](https://www.python-httpx.org/quickstart/)，作者 Tom Christie 及 HTTPX 贡献者，许可 BSD 三条款许可证。抓取于 2026-09-13。

> 编者注：httpx 的 API 与 requests 高度相似（`httpx.get(...)` 几乎无缝替换 `requests.get(...)`），同时原生支持 **HTTP/2** 与 **async/await 异步请求**——这是它在 LLM 应用中最大的价值：配合 asyncio 并发调用多个 API，或用流式接口逐 token 读取模型输出。

## 快速开始

首先，导入 HTTPX：

```python
>>> import httpx
```

现在，让我们尝试获取一个网页：

```python
>>> r = httpx.get('https://httpbin.org/get')
>>> r
<Response [200 OK]>
```

类似地，发送一个 HTTP POST 请求：

```python
>>> r = httpx.post('https://httpbin.org/post', data={'key': 'value'})
```

PUT、DELETE、HEAD 和 OPTIONS 请求都遵循相同的风格：

```python
>>> r = httpx.put('https://httpbin.org/put', data={'key': 'value'})
>>> r = httpx.delete('https://httpbin.org/delete')
>>> r = httpx.head('https://httpbin.org/get')
>>> r = httpx.options('https://httpbin.org/get')
```

## 在 URL 中传递参数

要在请求中包含 URL 查询参数，使用 `params` 关键字：

```python
>>> params = {'key1': 'value1', 'key2': 'value2'}
>>> r = httpx.get('https://httpbin.org/get', params=params)
```

要查看这些值是如何编码进 URL 字符串的，可以检查请求所使用的最终 URL：

```python
>>> r.url
URL('https://httpbin.org/get?key2=value2&key1=value1')
```

也可以把列表作为值传入：

```python
>>> params = {'key1': 'value1', 'key2': ['value2', 'value3']}
>>> r = httpx.get('https://httpbin.org/get', params=params)
>>> r.url
URL('https://httpbin.org/get?key1=value1&key2=value2&key2=value3')
```

## 响应内容

HTTPX 会自动把响应内容解码为 Unicode 文本：

```python
>>> r = httpx.get('https://www.example.org/')
>>> r.text
'<!doctype html>\n<html>\n<head>\n<title>Example Domain</title>...'
```

可以查看将用于解码响应的编码：

```python
>>> r.encoding
'UTF-8'
```

某些情况下响应可能不包含显式编码，此时 HTTPX 会尝试自动确定编码。如果需要覆盖标准行为、显式设置编码，也可以：`r.encoding = 'ISO-8859-1'`。

非文本响应可以以字节访问 `r.content`。任何 `gzip` 和 `deflate` HTTP 响应编码都会被自动解码；若安装了 `zstandard`，`zstd` 响应编码同样受支持。

## JSON 响应内容

Web API 的响应通常以 JSON 编码：

```python
>>> r = httpx.get('https://api.github.com/events')
>>> r.json()
[{'repository': {'open_issues': 0, 'url': 'https://github.com/...' ...}}]
```

> 编者注：`r.json()` 之后接 Pydantic 模型校验，是对抗 LLM 返回内容不确定性的标准组合拳。

## 定制请求头

要在发出的请求中包含额外的请求头，使用 `headers` 关键字参数：

```python
>>> url = 'https://httpbin.org/headers'
>>> headers = {'user-agent': 'my-app/0.0.1'}
>>> r = httpx.get(url, headers=headers)
```

## 发送表单编码数据

一些类型的 HTTP 请求（如 POST 和 PUT）可以在请求体中携带数据，常见的形式之一是 HTML 表单所用的表单编码数据：

```python
>>> data = {'key1': 'value1', 'key2': 'value2'}
>>> r = httpx.post("https://httpbin.org/post", data=data)
```

表单编码数据也可以包含同一个键的多个值：`data = {'key1': ['value1', 'value2']}`。

## 发送多部分文件上传

可以使用 HTTP multipart 编码上传文件：

```python
>>> with open('report.xls', 'rb') as report_file:
...     files = {'upload-file': report_file}
...     r = httpx.post("https://httpbin.org/post", files=files)
```

也可以通过元组显式设置文件名和内容类型。如果需要在 multipart 表单中包含非文件的表单字段，使用 `data=...` 参数。

## 发送 JSON 编码数据

如果只需要简单的键值结构，表单编码数据就够用了。对于更复杂的数据结构，你通常希望改用 JSON 编码：

```python
>>> data = {'integer': 123, 'boolean': True, 'list': ['a', 'b', 'c']}
>>> r = httpx.post("https://httpbin.org/post", json=data)
```

`json=` 参数会自动完成序列化并设置 `Content-Type: application/json`——调用 LLM API 的请求体就是这样发送的。其他编码则应使用 `content=...` 参数，传入 `bytes` 或产出 `bytes` 的生成器。

## 响应状态码

我们可以查看 HTTP 状态码：

```python
>>> r = httpx.get('https://httpbin.org/get')
>>> r.status_code
200
```

HTTPX 还提供了通过文本短语访问状态码的便捷方式：

```python
>>> r.status_code == httpx.codes.OK
True
```

我们可以对任何非 2xx 成功码的响应抛出异常：

```python
>>> not_found = httpx.get('https://httpbin.org/status/404')
>>> not_found.status_code
404
>>> not_found.raise_for_status()
Traceback (most recent call last):
httpx._exceptions.HTTPStatusError: 404 Client Error: Not Found for url: https://httpbin.org/status/404
```

该方法返回响应实例本身，允许内联使用：

```python
>>> data = httpx.get('...').raise_for_status().json()
```

## 响应头

响应头以类字典的接口提供。`Headers` 数据类型是大小写不敏感的，因此可以使用任意大小写。单个响应头的多个值会按 RFC 7230 合并为一个逗号分隔的值。

## 流式响应

对于大文件下载，你可能希望使用**流式**响应，而不是一次性把整个响应体加载进内存。可以流式读取二进制内容、文本，或逐行读取：

```python
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     for line in r.iter_lines():
...         print(line)
```

HTTPX 会使用统一的行结束符，把所有情况规范化为 `\n`。使用流式响应时，`response.content` 和 `response.text` 属性将不可用，访问会报错。不过也可以用流式读取做条件加载：

```python
>>> with httpx.stream("GET", "https://www.example.com") as r:
...     if int(r.headers['Content-Length']) < TOO_LONG:
...         r.read()
...         print(r.text)
```

> 编者注：OpenAI 兼容接口的 `stream: true` 返回 **SSE** 格式——`Content-Type: text/event-stream`。用 `httpx.stream("POST", url, ...)` 配合 `iter_lines()` 解析 `data:` 行，就是手写流式对话客户端的全部原理（SDK 内部做的正是这件事，模块 6 会用到）。

## Cookie

响应中设置的 Cookie 可以轻松访问：`r.cookies['chocolate']`。要在发出的请求中包含 Cookie，使用 `cookies` 参数。Cookie 返回为 `Cookies` 实例，它是一个类字典数据结构，还提供按域名或路径访问 Cookie 的额外 API。

## 重定向与历史

默认情况下，HTTPX 对所有 HTTP 方法都**不会**跟随重定向，不过可以显式启用：

```python
>>> r = httpx.get('http://github.com/')
>>> r.status_code
301
>>> r.history
[]
>>> r.next_request
<Request('GET', 'https://github.com/')>

>>> r = httpx.get('http://github.com/', follow_redirects=True)
>>> r.status_code
200
```

响应的 `history` 属性可以查看所有已跟随的重定向，其中包含按发生顺序排列的重定向响应列表。

## 超时

HTTPX 默认为所有网络操作设置了合理的超时，这意味着如果连接未能正常建立，它总是抛出错误而不是无限期挂起。网络无活动的默认超时为 5 秒。你可以把值调得更严格或更宽松：

```python
>>> httpx.get('https://github.com/', timeout=0.001)
```

也可以完全禁用超时行为：`timeout=None`。高级超时管理（连接/读/写/池分离设置）请参阅官方 Timeout fine-tuning 文档。与 requests 的"默认永不超时"相比，这是 httpx 更适合生产环境的一个细节。

## 认证

HTTPX 支持 Basic 与 Digest HTTP 认证。要提供 Basic 认证凭据，把明文 `str` 或 `bytes` 对象组成的二元组作为 `auth` 参数传给请求函数：

```python
>>> httpx.get("https://example.com", auth=("my_user", "password123"))
```

## 异常

HTTPX 最重要的异常类是 `RequestError` 与 `HTTPStatusError`。

`RequestError` 是发出 HTTP 请求过程中发生的任何异常的父类，这些异常带有 `.request` 属性：

```python
try:
    response = httpx.get("https://www.example.com/")
except httpx.RequestError as exc:
    print(f"An error occurred while requesting {exc.request.url!r}.")
```

`HTTPStatusError` 由 `response.raise_for_status()` 在非 2xx 响应上抛出，同时带有 `.request` 与 `.response` 属性：

```python
try:
    response.raise_for_status()
except httpx.HTTPStatusError as exc:
    print(f"Error response {exc.response.status_code} while requesting {exc.request.url!r}.")
```

还有一个涵盖这两类的基类 `HTTPError`，可用于同时捕获"请求失败"与"4xx/5xx 响应"两种情况。

## 客户端与异步（编者补充）

真实项目不要每次调用都 `httpx.get(...)`，而应使用 `httpx.Client` 复用连接池；异步代码对应 `httpx.AsyncClient`：

```python
import asyncio
import httpx

async def ask(client: httpx.AsyncClient, prompt: str) -> dict:
    r = await client.post(
        "https://api.example.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json={"model": "agnes-2.5-flash", "messages": [{"role": "user", "content": prompt}]},
    )
    return r.raise_for_status().json()

async def main():
    async with httpx.AsyncClient(timeout=60) as client:
        results = await asyncio.gather(
            ask(client, "问题一"),
            ask(client, "问题二"),
            ask(client, "问题三"),
        )

asyncio.run(main())
```

三个请求并发执行，只占用一个事件循环线程——这正是本模块第 4、5 篇并发知识的落地场景。
