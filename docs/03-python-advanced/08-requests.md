---
title: requests：HTTP for Humans
source_url: https://requests.readthedocs.io/en/latest/user/quickstart/
author: Kenneth Reitz 及 Requests 开发者
license: Apache License 2.0
fetched_at: 2026-09-13
translated: true
order: 8
versions: requests 2.34
---
## 发送请求

使用 requests 非常简单。首先导入 requests 模块：

```python
>>> import requests
```

然后，尝试获取一个网页。本例中，我们来获取 GitHub 的公共时间线：

```python
>>> r = requests.get('https://api.github.com/events')
```

现在，我们拥有了一个名为 `r` 的 Response 对象，我们可以从这个对象中获取所有需要的信息。

Requests 简易的 API 意味着所有形式的 HTTP 请求都是显而易见的。例如，可以通过如下方式发送一个 HTTP POST 请求：

```python
>>> r = requests.post('https://httpbin.org/post', data={'key': 'value'})
```

其他 HTTP 请求类型：PUT、DELETE、HEAD 以及 OPTIONS 也同样简单：

```python
>>> r = requests.put('https://httpbin.org/put', data={'key': 'value'})
>>> r = requests.delete('https://httpbin.org/delete')
>>> r = requests.head('https://httpbin.org/get')
>>> r = requests.options('https://httpbin.org/get')
```

## 在 URL 中传递参数

你也许经常想为 URL 的查询字符串（query string）传递某种数据。如果你是手工构建 URL，那么数据会以键/值对的形式置于 URL 中，跟在一个问号后面。Requests 允许你使用 `params` 关键字参数，以字符串字典来提供这些参数：

```python
>>> payload = {'key1': 'value1', 'key2': 'value2'}
>>> r = requests.get('https://httpbin.org/get', params=payload)
```

通过打印输出该 URL，你能看到 URL 已被正确编码：

```python
>>> print(r.url)
https://httpbin.org/get?key1=value1&key2=value2
```

注意字典里值为 `None` 的键不会被添加到 URL 的查询字符串里。

## 响应内容

我们能读取服务器响应的内容。再次以 GitHub 时间线为例：

```python
>>> import requests
>>> r = requests.get('https://api.github.com/events')
>>> r.text
'[{"repository":{"open_issues":0,"url":"https://github.com/...
```

Requests 会自动解码来自服务器的响应内容。大多数 unicode 字符集都能被无缝地解码。请求发出后，Requests 会基于 HTTP 头部对响应的编码做出有根据的推测。当你访问 `r.text` 时，Requests 会使用其推测的文本编码。你可以使用 `r.encoding` 属性来改变它，也可以用 `r.content` 获取字节形式的响应体：

```python
>>> r.content
b'[{"repository":{"open_issues":0,"url":"https://github.com/...
```

使用二进制内容的一个例子是加载图片：

```python
>>> from PIL import Image
>>> from io import BytesIO

>>> i = Image.open(BytesIO(r.content))
```

## JSON 响应内容

Requests 中也有一个内置的 JSON 解码器，帮助你处理 JSON 数据：

```python
>>> import requests

>>> r = requests.get('https://api.github.com/events')
>>> r.json()
[{'repository': {'open_issues': 0, 'url': 'https://github.com/...
```

如果 JSON 解码失败，`r.json()` 就会抛出一个异常。例如，响应内容是 204（No Content），或者包含无效的 JSON，尝试 `r.json()` 就会抛出 `requests.exceptions.JSONDecodeError`。

**需要注意**：调用 `r.json()` 成功**并不**表示响应的成功。有的服务器会在失败的响应中返回一个 JSON 对象（例如 HTTP 500 的错误详情）。这样的 JSON 会被解码返回。要检查请求是否成功，请使用 `r.raise_for_status()` 或者检查 `r.status_code` 是否和你的期望相同。

> 编者注：调用 LLM API 的返回就是 JSON——`r.json()` 拿到消息体后，通常会配合 Pydantic 模型做进一步校验（见本模块第 10 篇）。流式接口（SSE）则用下面的流式读取处理。

## 流式响应内容（编者节选自 Advanced Usage）

在少量请求的常规场景，直接读 `r.text` 即可。要下载大文件或消费流式接口时，请用 `stream=True` 与 `Response.iter_content`：

```python
with open(filename, 'wb') as fd:
    for chunk in r.iter_content(chunk_size=128):
        fd.write(chunk)
```

`Response.iter_content` 会自动处理 `gzip` 和 `deflate` 传输编码，这是官方推荐的数据流读取方式；而 `r.raw` 是未经处理的原始字节流。

## 定制请求头

如果你想为请求添加 HTTP 头部，只要简单地传递一个 `dict` 给 `headers` 参数就可以了：

```python
>>> url = 'https://api.github.com/some/endpoint'
>>> headers = {'user-agent': 'my-app/0.0.1'}

>>> r = requests.get(url, headers=headers)
```

注意：定制头的优先级低于某些特定的信息源。例如 `.netrc` 中设置的认证信息会覆盖 `headers=` 里设置的 Authorization 头，而 `auth=` 参数又会覆盖 `.netrc`；重定向到主机外时 Authorization 头会被删除。

> 编者注：这是给 LLM API 传 `Authorization: Bearer sk-...` 或自定义头（如 `api-key`）的标准入口。API Key 的存放方式请遵循模块 0《环境变量与 API Key 管理》的做法，不要硬编码。

## 更加复杂的 POST 请求

通常，你想发送一些编码为表单的数据——非常像一个 HTML 表单。要实现这个，只需简单地传递一个字典给 `data` 参数。你的数据字典在发出请求时会自动编码为表单形式：

```python
>>> payload = {'key1': 'value1', 'key2': 'value2'}

>>> r = requests.post('https://httpbin.org/post', data=payload)
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

有时你需要发送非表单编码的数据。如果你传递一个 `string` 而不是一个 `dict`，数据会被直接发布出去。例如 GitHub API v3 接受 JSON 编码的 POST/PATCH 数据：

```python
>>> import json

>>> url = 'https://api.github.com/some/endpoint'
>>> payload = {'some': 'data'}

>>> r = requests.post(url, data=json.dumps(payload))
```

请注意，上面的代码**不会**添加 `Content-Type` 头（因此尤其不会把它设为 `application/json`）。

> 编者注：现在应优先使用 `json=` 参数：`requests.post(url, json=payload)` 会自动序列化并设置 `Content-Type: application/json`——调用 LLM API 的 chat/completions 接口就是这么写的。

## POST 多部分编码（Multipart）的文件

Requests 使得上传多部分编码文件变得很简单：

```python
>>> url = 'https://httpbin.org/post'
>>> files = {'file': open('report.xls', 'rb')}

>>> r = requests.post(url, files=files)
```

你可以显式地设置文件名、content_type 和请求头，也可以发送字符串作为文件。**强烈建议**你用二进制模式（binary mode）打开文件——Requests 可能会尝试为你提供 `Content-Length` 头，如果用文本模式打开，这个值可能会算错。

## 响应状态码

我们可以检测响应状态码：

```python
>>> r = requests.get('https://httpbin.org/get')
>>> r.status_code
200
```

Requests 还附带了一个内置的状态码查询对象供方便参考：

```python
>>> r.status_code == requests.codes.ok
True
```

如果我们发送了一个失败请求（4XX 客户端错误或 5XX 服务器错误响应），我们可以通过 `Response.raise_for_status()` 来抛出异常：

```python
>>> bad_r = requests.get('https://httpbin.org/status/404')
>>> bad_r.status_code
404

>>> bad_r.raise_for_status()
Traceback (most recent call last):
  File "requests/models.py", line 832, in raise_for_status
    raise http_error
requests.exceptions.HTTPError: 404 Client Error
```

## 响应头与 Cookie

我们可以用字典形式查看服务器响应头：

```python
>>> r.headers
{'content-encoding': 'gzip', 'transfer-encoding': 'chunked', ...}
```

该字典很特殊：它是仅为 HTTP 头部而生。根据 RFC 7230，HTTP 头部是大小写不敏感的，所以我们可以使用任意大小写访问这些头部。若有多个值，`requests` 会将它们合并为逗号分隔的形式。

如果某个响应包含一些 Cookie，你可以快速访问它们：

```python
>>> r.cookies['example_cookie_name']
'example_cookie_value'
```

要发送你自己的 Cookie 到服务器，可以使用 `cookies` 参数。

## 重定向与请求历史

默认情况下，除了 HEAD，Requests 会自动处理所有重定向。可以使用响应对象的 `history` 属性来追踪重定向。`Response.history` 是一个 `Response` 对象的列表，为了完成请求而创建了这些对象。这个对象列表按照从最老到最近的请求进行排序。可以通过设置 `allow_redirects=False` 禁用重定向处理。

## 超时

你可以告诉 requests 在经过以 `timeout` 参数设定的秒数时间后停止等待响应。**几乎所有的生产代码都应该在几乎所有请求中使用这一参数。**不这样做会导致程序无限期地挂起：

```python
>>> requests.get('https://github.com/', timeout=0.001)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
requests.exceptions.Timeout: HTTPConnectionPool(host='github.com', port=80): Request timed out. (timeout=0.001)
```

注意：`timeout` 并不是整个响应下载的时间限制；确切地说，它是"服务器在 *timeout* 秒内没有发出响应（底层套接字在 *timeout* 秒内没有收到任何字节）"时抛出异常。如果不显式指定 timeout，请求是**不会超时**的。

> 编者注：调 LLM API 时推荐用元组 `(连接超时, 读取超时)`，如 `timeout=(5, 120)`——首 token 可能慢，但连接应当快。

## 错误与异常

遇到网络问题（如 DNS 查询失败、拒绝连接等），Requests 会抛出一个 `ConnectionError` 异常。如果 HTTP 请求返回了失败的状态码，`Response.raise_for_status()` 会抛出一个 `HTTPError`。若请求超时，则抛出一个 `Timeout` 异常。若请求超过了配置的最大重定向次数，则会抛出一个 `TooManyRedirects` 异常。

所有 Requests 显式抛出的异常都继承自 `requests.exceptions.RequestException`。配合模块 6 的"错误处理/重试/限流"实践，可以给 LLM API 调用加上指数退避重试。

---

> **来源**：本文翻译自 [Quickstart — Requests 2.34.2 documentation](https://requests.readthedocs.io/en/latest/user/quickstart/)，作者 Kenneth Reitz 及 Requests 开发者，许可 Apache License 2.0。抓取于 2026-09-13。

---

> 编者注：requests 是 Python 最流行的同步 HTTP 库，调用各类 LLM API（OpenAI 兼容端点等）的第一选择。本篇为官方 Quickstart 的中文翻译，略有删节；需要异步版本时请阅读下一篇 httpx。
