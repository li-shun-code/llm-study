---
title: requests 快速开始与进阶用法
source_url: https://requests.readthedocs.io/en/latest/user/quickstart/
author: Kenneth Reitz 与 PSF Requests 团队
license: Apache 许可证 2.0
fetched_at: 2026-09-13
translated: true
order: 9
versions: requests 2.x（当前稳定版）
---

*编者导读：本篇由 requests 官方文档《Quickstart（快速开始）》与《Advanced Usage（进阶用法）》两页完整翻译合并而成。*

## 快速开始（Quickstart）

迫不及待想上手了？本页是 Requests 的良好入门。

首先确保：

- Requests 已安装；
- Requests 已是最新版本。

从一个简单的例子开始。

### 发起请求

用 Requests 发起请求非常简单。先导入模块：

```pycon
>>> import requests
```

现在试着获取一个网页，以 GitHub 的公共时间线为例：

```pycon
>>> r = requests.get('https://api.github.com/events')
```

现在我们有了一个名为 `r` 的 `Response` 对象，可以从它获取所需的全部信息。

Requests 简洁的 API 意味着所有形式的 HTTP 请求都一目了然。例如发起 HTTP POST：

```pycon
>>> r = requests.post('https://httpbin.org/post', data={'key': 'value'})
```

不错吧？其他 HTTP 请求类型 PUT、DELETE、HEAD、OPTIONS 呢？同样简单：

```pycon
>>> r = requests.put('https://httpbin.org/put', data={'key': 'value'})
>>> r = requests.delete('https://httpbin.org/delete')
>>> r = requests.head('https://httpbin.org/get')
>>> r = requests.options('https://httpbin.org/get')
```

这些都很好，但这只是 Requests 能力的开始。

### 在 URL 中传递参数

你经常想在 URL 的查询字符串（query string）里发送数据。如果手工构造 URL，这些数据会以键值对的形式出现在问号后面，如 `httpbin.org/get?key=val`。Requests 允许用字典（配合 `params` 关键字参数）提供这些参数。例如要把 `key1=value1` 和 `key2=value2` 传给 `httpbin.org/get`：

```pycon
>>> payload = {'key1': 'value1', 'key2': 'value2'}
>>> r = requests.get('https://httpbin.org/get', params=payload)
```

打印 URL 可以看到它已被正确编码：

```pycon
>>> print(r.url)
https://httpbin.org/get?key2=value2&key1=value1
```

注意：值为 `None` 的字典键不会被加入查询字符串。

也可以把列表作为值传入：

```pycon
>>> payload = {'key1': 'value1', 'key2': ['value2', 'value3']}

>>> r = requests.get('https://httpbin.org/get', params=payload)
>>> print(r.url)
https://httpbin.org/get?key1=value1&key2=value2&key2=value3
```

### 响应内容

可以读取服务器响应的内容。再看 GitHub 时间线的例子：

```pycon
>>> import requests

>>> r = requests.get('https://api.github.com/events')
>>> r.text
'[{"repository":{"open_issues":0,"url":"https://github.com/...
```

Requests 会自动解码来自服务器的内容，大多数 unicode 字符集都能无缝解码。

发起请求时，Requests 会基于 HTTP 头推测响应的编码。访问 `r.text` 时用的就是 Requests 推测出的文本编码。可以用 `r.encoding` 属性查看并修改：

```pycon
>>> r.encoding
'utf-8'
>>> r.encoding = 'ISO-8859-1'
```

修改编码后，之后每次访问 `r.text` 都会用新的 `r.encoding` 值。任何能用专门逻辑确定内容编码的场景都可以这样做。例如 HTML 和 XML 能在正文里声明自己的编码，这时应该用 `r.content` 找出编码，然后设置 `r.encoding`，让 `r.text` 用正确的编码。

Requests 也支持自定义编码：如果你创建了自定义编码并在 `codecs` 模块注册过，把编解码器名字赋给 `r.encoding` 即可，Requests 会替你解码。

### 二进制响应内容

非文本响应也可以按字节访问响应体：

```pycon
>>> r.content
b'[{"repository":{"open_issues":0,"url":"https://github.com/...
```

`gzip` 和 `deflate` 传输编码会自动解码。若安装了 `brotli` 或 `brotlicffi` 之类的 Brotli 库，`br` 传输编码也会自动解码。

例如用请求返回的二进制数据创建图片：

```pycon
>>> from PIL import Image
>>> from io import BytesIO

>>> i = Image.open(BytesIO(r.content))
```

### JSON 响应内容

内置了 JSON 解码器，处理 JSON 数据时可直接使用：

```pycon
>>> import requests

>>> r = requests.get('https://api.github.com/events')
>>> r.json()
[{'repository': {'open_issues': 0, 'url': 'https://github.com/...
```

JSON 解码失败时 `r.json()` 会抛异常。例如响应为 204（No Content）或包含非法 JSON 时，`r.json()` 会抛出 `requests.exceptions.JSONDecodeError`。该包装异常为不同 Python 版本、不同 JSON 库可能抛出的多种异常提供了互操作性。

需要注意：`r.json()` 调用成功**并不**代表响应成功。有些服务器会在失败的响应里也返回 JSON（如 HTTP 500 附带错误详情），这些 JSON 也会被解码返回。要确认请求是否成功，请用 `r.raise_for_status()`，或检查 `r.status_code` 是否符合预期。

### 原始响应内容

极少数情况下你想拿到来自服务器的原始套接字响应，可以访问 `r.raw`。若要如此，请确保在最初的请求里设置 `stream=True`：

```pycon
>>> r = requests.get('https://api.github.com/events', stream=True)

>>> r.raw
<urllib3.response.HTTPResponse object at 0x101194810>

>>> r.raw.read(10)
b'\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\x03'
```

但一般而言，把流式内容保存到文件应该用这样的模式：

```python
with open(filename, 'wb') as fd:
    for chunk in r.iter_content(chunk_size=128):
        fd.write(chunk)
```

`Response.iter_content` 会替你处理掉许多直接用 `Response.raw` 时不得不自行处理的事情。流式下载时，上面是首选且推荐的内容获取方式。`chunk_size` 可以自由调整，以更好地适配你的场景。

> **注**：关于 `Response.iter_content` 与 `Response.raw` 的重要区别：`iter_content` 会自动解码 `gzip` 与 `deflate` 传输编码；`Response.raw` 是原始字节流，不会对响应内容做任何转换。如果确实需要按服务器返回的原样访问字节，用 `Response.raw`。

### 自定义请求头

想给请求添加 HTTP 头，把字典传给 `headers` 参数即可。例如，前面的例子没有指定 user-agent：

```pycon
>>> url = 'https://api.github.com/some/endpoint'
>>> headers = {'user-agent': 'my-app/0.0.1'}

>>> r = requests.get(url, headers=headers)
```

注意：自定义头的优先级低于更具体的信息来源。例如：

- 若 `.netrc` 中指定了凭据，`headers=` 设置的 Authorization 头会被覆盖；而 `auth=` 参数又会覆盖 `.netrc`。Requests 会在 `~/.netrc`、`~/_netrc` 或 `NETRC` 环境变量指定的路径搜索 netrc 文件。
- 请求被重定向到别的主机时，Authorization 头会被移除。
- URL 中提供了代理凭据时，Proxy-Authorization 头会被覆盖。
- 当能确定内容长度时，Content-Length 头会被覆盖。

此外，Requests 的行为完全不因自定义头的不同而改变，这些头只是被原样传入最终请求。

注意：所有头的值必须是 `string`、字节串或 unicode。虽然允许，但建议避免传 unicode 头值。

### 更复杂的 POST 请求

通常你想发送表单编码的数据——就像 HTML 表单那样。把字典传给 `data` 参数即可，发出请求时字典会自动表单编码：

```pycon
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

`data` 参数的每个键也可以有多个值：把 `data` 设为元组列表，或值为列表的字典。表单里同一键有多个元素时特别有用：

```pycon
>>> payload_tuples = [('key1', 'value1'), ('key1', 'value2')]
>>> r1 = requests.post('https://httpbin.org/post', data=payload_tuples)
>>> payload_dict = {'key1': ['value1', 'value2']}
>>> r2 = requests.post('https://httpbin.org/post', data=payload_dict)
>>> print(r1.text)
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
>>> # httpbin 可能嵌入不确定的元数据，
>>> # 所以这里只比较提交的数据。
>>> r1.json()['form'] == r2.json()['form']
True
```

有时你要发送的数据不是表单编码的：把 `string`（而非 `dict`）传给 `data`，数据就会被直接发送。

例如 GitHub API v3 接受 JSON 编码的 POST/PATCH 数据：

```pycon
>>> import json

>>> url = 'https://api.github.com/some/endpoint'
>>> payload = {'some': 'data'}

>>> r = requests.post(url, data=json.dumps(payload))
```

请注意：上面的代码**不会**添加 `Content-Type` 头（尤其不会设为 `application/json`）。

如果需要这个头、又不想手工编码 `dict`，可以直接用 `json` 参数（2.4.2 版新增），它会自动编码：

```pycon
>>> url = 'https://api.github.com/some/endpoint'
>>> payload = {'some': 'data'}

>>> r = requests.post(url, json=payload)
```

注意：如果同时传了 `data` 或 `files`，`json` 参数会被忽略。

### POST 多部分编码文件

Requests 让 Multipart 编码文件的上传变得简单：

```pycon
>>> url = 'https://httpbin.org/post'
>>> files = {'file': open('report.xls', 'rb')}

>>> r = requests.post(url, files=files)
>>> r.text
{
  ...
  "files": {
    "file": "<censored...binary...data>"
  },
  ...
}
```

可以显式设置文件名、content_type 和头：

```pycon
>>> url = 'https://httpbin.org/post'
>>> files = {'file': ('report.xls', open('report.xls', 'rb'), 'application/vnd.ms-excel', {'Expires': '0'})}

>>> r = requests.post(url, files=files)
>>> r.text
{
  ...
  "files": {
    "file": "<censored...binary...data>"
  },
  ...
}
```

愿意的话，还可以把字符串作为文件发送：

```pycon
>>> url = 'https://httpbin.org/post'
>>> files = {'file': ('report.csv', 'some,data,to,send\nanother,row,to,send\n')}

>>> r = requests.post(url, files=files)
>>> r.text
{
  ...
  "files": {
    "file": "some,data,to,send\\nanother,row,to,send\\n"
  },
  ...
}
```

如果要 POST 特别大的文件（`multipart/form-data` 请求），可能希望流式上传请求体。默认 requests 不支持，但有专门的包支持——`requests-toolbelt`，用法见其文档。一次发送多个文件见下文进阶部分。

> **警告**：强烈建议以二进制模式打开文件。因为 Requests 可能尝试替你提供 `Content-Length` 头，该值是文件的*字节*数；以*文本模式*打开文件可能出错。

### 响应状态码

可以检查响应状态码：

```pycon
>>> r = requests.get('https://httpbin.org/get')
>>> r.status_code
200
```

Requests 还内置了状态码查询对象便于引用：

```pycon
>>> r.status_code == requests.codes.ok
True
```

如果发出了坏请求（4XX 客户端错误或 5XX 服务器错误），可以用 `Response.raise_for_status()` 抛出异常：

```pycon
>>> bad_r = requests.get('https://httpbin.org/status/404')
>>> bad_r.status_code
404

>>> bad_r.raise_for_status()
Traceback (most recent call last):
  File "requests/models.py", line 832, in raise_for_status
    raise http_error
requests.exceptions.HTTPError: 404 Client Error
```

而 `r` 的 `status_code` 是 `200`，调用 `raise_for_status()` 的结果是：

```pycon
>>> r.raise_for_status()
None
```

一切正常。

### 响应头

用 Python 字典查看服务器响应头：

```pycon
>>> r.headers
{
    'content-encoding': 'gzip',
    'transfer-encoding': 'chunked',
    'connection': 'close',
    'server': 'nginx/1.0.4',
    'x-runtime': '148ms',
    'etag': '"e1ca502697e5c9317743dc078f67693f"',
    'content-type': 'application/json'
}
```

这个字典很特别：它是专为 HTTP 头打造的。按照 [RFC 7230](https://tools.ietf.org/html/rfc7230#section-3.2)，HTTP 头名不区分大小写，所以可以用任意大小写访问：

```pycon
>>> r.headers['Content-Type']
'application/json'

>>> r.headers.get('content-type')
'application/json'
```

它的另一个特别之处：服务器可能用不同值多次发送同一头，requests 会把它们合并，以便在字典里以单一映射表示，同样遵循 RFC 7230：

> 接收方可以将多个同名字段头合并为一个 "field-name: field-value" 对，而不改变消息语义，做法是把后续字段值按顺序追加到合并后的字段值后面，以逗号分隔。

### Cookies

如果响应包含 Cookies，可以快速访问：

```pycon
>>> url = 'http://example.com/some/cookie/setting/url'
>>> r = requests.get(url)

>>> r.cookies['example_cookie_name']
'example_cookie_value'
```

要把自己的 cookie 发给服务器，用 `cookies` 参数：

```pycon
>>> url = 'https://httpbin.org/cookies'
>>> cookies = dict(cookies_are='working')

>>> r = requests.get(url, cookies=cookies)
>>> r.text
'{"cookies": {"cookies_are": "working"}}'
```

Cookie 以 `RequestsCookieJar` 返回，它表现得像 `dict`，但提供更完整的接口，适合跨多个域或路径使用。cookie jar 也能传给请求：

```pycon
>>> jar = requests.cookies.RequestsCookieJar()
>>> jar.set('tasty_cookie', 'yum', domain='httpbin.org', path='/cookies')
>>> jar.set('gross_cookie', 'blech', domain='httpbin.org', path='/elsewhere')
>>> url = 'https://httpbin.org/cookies'
>>> r = requests.get(url, cookies=jar)
>>> r.text
'{"cookies": {"tasty_cookie": "yum"}}'
```

### 重定向与历史

默认情况下，Requests 对除 HEAD 之外的所有动词执行位置重定向。

可以用 Response 对象的 `history` 属性追踪重定向。`Response.history` 列表包含为完成请求而创建的各个 `Response` 对象，按从最旧到最新的顺序排序。

例如，GitHub 会把所有 HTTP 请求重定向到 HTTPS：

```pycon
>>> r = requests.get('http://github.com/')

>>> r.url
'https://github.com/'

>>> r.status_code
200

>>> r.history
[<Response [301]>]
```

使用 GET、OPTIONS、POST、PUT、PATCH 或 DELETE 时，可以用 `allow_redirects` 参数禁用重定向处理：

```pycon
>>> r = requests.get('http://github.com/', allow_redirects=False)

>>> r.status_code
301

>>> r.history
[]
```

使用 HEAD 时也可以启用重定向：

```pycon
>>> r = requests.head('http://github.com/', allow_redirects=True)

>>> r.url
'https://github.com/'

>>> r.history
[<Response [301]>]
```

### 超时

可以用 `timeout` 参数告诉 Requests 在若干秒后停止等待响应。几乎所有的生产代码都应该在几乎所有请求上使用该参数，否则程序可能无限挂起：

```pycon
>>> requests.get('https://github.com/', timeout=0.001)
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
requests.exceptions.Timeout: HTTPConnectionPool(host='github.com', port=80): Request timed out. (timeout=0.001)
```

> **注**：`timeout` 不是整个响应下载的时间限制；而是当服务器在 `timeout` 秒内没有发出响应（更准确地说，底层套接字在 `timeout` 秒内没有收到任何字节）时抛出异常。如果不显式指定超时，请求不会超时。

### 错误与异常

遇到网络问题（如 DNS 失败、拒绝连接等）时，Requests 会抛出 `ConnectionError` 异常。

`Response.raise_for_status()` 在 HTTP 请求返回不成功状态码时抛出 `HTTPError`。

请求超时会抛出 `Timeout` 异常。

请求超过配置的最大重定向次数会抛出 `TooManyRedirects` 异常。

Requests 显式抛出的所有异常都继承自 `requests.exceptions.RequestException`。

## 进阶用法（Advanced Usage）

本文介绍 Requests 的部分进阶特性。

### 会话对象（Session Objects）

Session 对象让你跨请求持久化某些参数。它还会在 Session 实例发出的所有请求间持久化 cookies，并使用 `urllib3` 的连接池。因此对同一主机的多个请求会复用底层 TCP 连接，带来显著的性能提升（参见"HTTP 持久连接"）。

Session 对象拥有 Requests 主 API 的全部方法。

先跨请求持久化一些 cookies：

```python
s = requests.Session()

s.get('https://httpbin.org/cookies/set/sessioncookie/123456789')
r = s.get('https://httpbin.org/cookies')

print(r.text)
# '{"cookies": {"sessioncookie": "123456789"}}'
```

Session 还能为请求方法提供默认数据，做法是给 Session 对象的属性赋值：

```python
s = requests.Session()
s.auth = ('user', 'pass')
s.headers.update({'x-test': 'true'})

# 'x-test' 和 'x-test2' 都会被发送
s.get('https://httpbin.org/headers', headers={'x-test2': 'true'})
```

传给请求方法的任何字典都会与 session 级别的值合并，方法级参数覆盖 session 参数。

但请注意：方法级参数*不会*跨请求持久化，即使使用了 session。下面的例子只有第一个请求携带 cookies，第二个请求不带：

```python
s = requests.Session()

r = s.get('https://httpbin.org/cookies', cookies={'from-my': 'browser'})
print(r.text)
# '{"cookies": {"from-my": "browser"}}'

r = s.get('https://httpbin.org/cookies')
print(r.text)
# '{"cookies": {}}'
```

想手动向 session 添加 cookie，请用 cookie 工具函数操作 `Session.cookies`。

Session 也可以作为上下文管理器使用：

```python
with requests.Session() as s:
    s.get('https://httpbin.org/cookies/set/sessioncookie/123456789')
```

这能确保 `with` 块一退出就关闭 session，即使发生了未处理异常。

> **提示：从字典参数中移除某个值**
> 有时你想在字典参数里省略 session 级别的键。做法是把方法级参数中该键的值设为 `None`，它就会被自动省略。

session 中包含的所有值都可直接访问。详见 Session API 文档。

### Request 与 Response 对象

每当调用 `requests.get()` 及其同类方法，你其实做了两件大事：第一，构造了一个 `Request` 对象，它将被发送到服务器去请求或查询某个资源；第二，一旦 Requests 从服务器拿到响应，就会生成一个 `Response` 对象。`Response` 对象包含服务器返回的全部信息，也包含你最初创建的 `Request` 对象。下面从维基百科服务器获取一些重要信息：

```pycon
>>> r = requests.get('https://en.wikipedia.org/wiki/Monty_Python')
```

想访问服务器返回的头：

```pycon
>>> r.headers
{'content-length': '56170', 'x-content-type-options': 'nosniff', 'x-cache':
'HIT from cp1006.eqiad.wmnet, MISS from cp1010.eqiad.wmnet', 'content-encoding':
'gzip', 'age': '3080', 'content-language': 'en', 'vary': 'Accept-Encoding,Cookie',
'server': 'Apache', 'last-modified': 'Wed, 13 Jun 2012 01:33:50 GMT',
'connection': 'close', 'cache-control': 'private, s-maxage=0, max-age=0,
must-revalidate', 'date': 'Thu, 14 Jun 2012 12:59:39 GMT', 'content-type':
'text/html; charset=UTF-8', 'x-cache-lookup': 'HIT from cp1006.eqiad.wmnet:3128,
MISS from cp1010.eqiad.wmnet:80'}
```

想查看我们发给服务器的头，访问 request 再取它的 headers：

```pycon
>>> r.request.headers
{'Accept-Encoding': 'identity, deflate, compress, gzip',
'Accept': '*/*', 'User-Agent': 'python-requests/1.2.0'}
```

### Prepared Requests

每当从 API 调用或 Session 调用得到 `Response` 对象，其 `request` 属性实际是当时使用的 `PreparedRequest`。某些情况下，你可能想在发送请求前对 body 或头（或其他任何东西）做些额外处理。简单的配方如下：

```python
from requests import Request, Session

s = Session()

req = Request('POST', url, data=data, headers=headers)
prepped = req.prepare()

# 对 prepped.body 做些处理
prepped.body = 'No, I want exactly this as the body.'

# 对 prepped.headers 做些处理
del prepped.headers['Content-Type']

resp = s.send(prepped,
    stream=stream,
    verify=verify,
    proxies=proxies,
    cert=cert,
    timeout=timeout
)

print(resp.status_code)
```

由于你对 `Request` 对象没做特殊处理，可以立即 prepare 并修改 `PreparedRequest` 对象，然后用本来会传给 `requests.*` 或 `Session.*` 的其他参数发送它。

但上面的代码会丧失 Session 的一些优势：尤其是 cookies 这类 Session 级状态不会被应用。要让 `PreparedRequest` 带上这些状态，把 `Request.prepare()` 换成 `Session.prepare_request()`：

```python
from requests import Request, Session

s = Session()
req = Request('GET',  url, data=data, headers=headers)

prepped = s.prepare_request(req)

# 对 prepped.body 做些处理
prepped.body = 'Seriously, send exactly these bytes.'

# 对 prepped.headers 做些处理
prepped.headers['Keep-Dead'] = 'parrot'

resp = s.send(prepped,
    stream=stream,
    verify=verify,
    proxies=proxies,
    cert=cert,
    timeout=timeout
)

print(resp.status_code)
```

使用 prepared request 流程时请记住：它不会考虑环境设置。如果你用环境变量改变 requests 的行为，可能出问题。例如 `REQUESTS_CA_BUNDLE` 中指定的自签名 SSL 证书不会被考虑，结果抛出 `SSL: CERTIFICATE_VERIFY_FAILED`。绕过这一行为的方法是把环境设置显式合并进 session：

```python
from requests import Request, Session

s = Session()
req = Request('GET', url)

prepped = s.prepare_request(req)

# 把环境设置合并进 session
settings = s.merge_environment_settings(prepped.url, {}, None, None, None)
resp = s.send(prepped, **settings)

print(resp.status_code)
```

### SSL 证书校验

Requests 像 Web 浏览器一样为 HTTPS 请求校验 SSL 证书。默认开启 SSL 校验，无法验证证书时抛出 SSLError：

```pycon
>>> requests.get('https://requestb.in')
requests.exceptions.SSLError: hostname 'requestb.in' doesn't match either of '*.herokuapp.com', 'herokuapp.com'
```

这个域没有配置 SSL，所以抛出异常，很好。GitHub 就有：

```pycon
>>> requests.get('https://github.com')
<Response [200]>
```

可以把受信 CA 证书的 CA_BUNDLE 文件或目录路径传给 `verify`：

```pycon
>>> requests.get('https://github.com', verify='/path/to/certfile')
```

或持久化设置：

```python
s = requests.Session()
s.verify = '/path/to/certfile'
```

> **注**：`verify` 设为目录路径时，该目录必须已用 OpenSSL 附带的 `c_rehash` 工具处理过。

受信 CA 列表也可以通过 `REQUESTS_CA_BUNDLE` 环境变量指定；未设置时回退使用 `CURL_CA_BUNDLE`。

把 `verify` 设为 False 可以忽略 SSL 证书校验：

```pycon
>>> requests.get('https://kennethreitz.org', verify=False)
<Response [200]>
```

注意：`verify=False` 时，requests 会接受服务器出示的任何 TLS 证书，忽略主机名不匹配和/或过期证书，这会让应用暴露在中间人（MitM）攻击之下。`verify=False` 在本地开发或测试时可能有用。

默认 `verify=True`。`verify` 选项只作用于主机证书。

### 客户端证书

也可以指定本地证书作为客户端证书：单个文件（含私钥与证书）或两个文件路径组成的元组：

```pycon
>>> requests.get('https://kennethreitz.org', cert=('/path/client.cert', '/path/client.key'))
<Response [200]>
```

或持久化：

```python
s = requests.Session()
s.cert = '/path/client.cert'
```

路径错误或证书无效会得到 SSLError：

```pycon
>>> requests.get('https://kennethreitz.org', cert='/wrong_path/client.pem')
SSLError: [Errno 336265225] _ssl.c:347: error:140B0009:SSL routines:SSL_CTX_use_PrivateKey_file:PEM lib
```

> **警告**：本地证书的私钥*必须*是未加密的。目前 Requests 不支持加密私钥。

### CA 证书

Requests 使用 `certifi` 包中的证书。这让用户无需更换 Requests 版本即可更新受信证书。2.16 版之前，Requests 自带一组来自 Mozilla 信任库的根 CA，只在每个 Requests 版本发布时更新一次；未安装 `certifi` 时，老旧版本 Requests 会带着极度过期的证书包。出于安全考虑，建议经常升级 certifi！

### 响应体内容工作流

默认情况下发起请求会立即下载响应体。可以用 `stream` 参数覆盖该行为，把响应体下载推迟到访问 `Response.content` 属性时：

```python
tarball_url = 'https://github.com/psf/requests/tarball/main'
r = requests.get(tarball_url, stream=True)
```

此时只有响应头被下载，连接保持打开，因此可以让内容获取变成有条件的：

```python
if int(r.headers['content-length']) < TOO_LONG:
  content = r.content
  ...
```

还可以用 `Response.iter_content()` 和 `Response.iter_lines()` 方法进一步控制工作流；或者从 `Response.raw` 读取底层 urllib3 `HTTPResponse` 的未解码响应体。

如果发起请求时把 `stream` 设为 `True`，除非消费完所有数据或调用 `Response.close`，Requests 无法把连接归还连接池。这可能导致连接低效。如果你在 `stream=True` 时只读取了部分响应体（或根本没读），应在 `with` 语句内发起请求以保证连接总是被关闭：

```python
with requests.get('https://httpbin.org/get', stream=True) as r:
    # 在这里对响应做处理。
```

### Keep-Alive

好消息——多亏 urllib3，keep-alive 在 session 内是 100% 自动的！session 内的任何请求都会自动复用合适的连接。

注意：只有响应体数据全部读取完毕，连接才会归还连接池供复用。请确保要么把 `stream` 设为 `False`，要么读取 `Response` 对象的 `content` 属性。

### 流式上传

Requests 支持流式上传，让你发送大的数据流或文件而无需读入内存。只需给请求体提供文件类对象：

```python
with open('massive-body', 'rb') as f:
    requests.post('http://some.url/streamed', data=f)
```

> **警告**：强烈建议以二进制模式打开文件。因为 Requests 可能尝试替你提供 `Content-Length` 头，该值是文件的*字节*数；以*文本模式*打开文件可能出错。

### 分块编码请求（Chunk-Encoded Requests）

Requests 也支持对出入请求使用 Chunked 传输编码。发送分块编码请求时，给请求体提供一个生成器（或任何没有长度的迭代器）即可：

```python
def gen():
    yield 'hi'
    yield 'there'

requests.post('http://some.url/chunked', data=gen())
```

对分块编码的响应，最好用 `Response.iter_content()` 迭代数据。理想情况下请求时已设 `stream=True`，此时以 `chunk_size=None` 调用 `iter_content` 即可逐块迭代；想把块限定最大尺寸，把 `chunk_size` 设为任意整数即可。

### POST 多个 Multipart 编码文件

一个请求里可以发送多个文件。例如，向带多文件字段 `images` 的 HTML 表单上传图片：

```html
<input type="file" name="images" multiple="true" required="true"/>
```

把 `files` 设为 `(表单字段名, 文件信息)` 元组的列表即可：

```pycon
>>> url = 'https://httpbin.org/post'
>>> multiple_files = [
...     ('images', ('foo.png', open('foo.png', 'rb'), 'image/png')),
...     ('images', ('bar.png', open('bar.png', 'rb'), 'image/png'))]
>>> r = requests.post(url, files=multiple_files)
>>> r.text
{
  ...
  'files': {'images': 'data:image/png;base64,iVBORw ....'}
  'Content-Type': 'multipart/form-data; boundary=3131623adb2043caaeb5538cc7aa0b3a',
  ...
}
```

> **警告**：强烈建议以二进制模式打开文件。因为 Requests 可能尝试替你提供 `Content-Length` 头，该值是文件的*字节*数；以*文本模式*打开文件可能出错。

### 事件钩子（Event Hooks）

Requests 有钩子系统，可用于操纵请求过程的各个环节或发出事件处理信号。

可用钩子：`response`——由请求产生的响应。

通过给请求参数 `hooks` 传 `{钩子名: 回调函数}` 字典，可以按请求为单位指定钩子函数：

```python
hooks={'response': print_url}
```

回调函数的第一个参数是一块数据：

```python
def print_url(r, *args, **kwargs):
    print(r.url)
```

回调函数必须自行处理异常：任何未处理的异常不会被静默吞掉，应由调用 Requests 的代码处理。

如果回调函数有返回值，将视为替换传入的数据；不返回任何内容则不影响任何东西：

```python
def record_hook(r, *args, **kwargs):
    r.hook_called = True
    return r
```

运行时打印一些请求方法参数：

```pycon
>>> requests.get('https://httpbin.org/', hooks={'response': print_url})
https://httpbin.org/
<Response [200]>
```

单个请求可加多个钩子，一次调用两个：

```pycon
>>> r = requests.get('https://httpbin.org/', hooks={'response': [print_url, record_hook]})
https://httpbin.org/
>>> r.hook_called
True
```

也可以给 `Session` 实例添加钩子：session 上的钩子会对它的每个请求调用：

```pycon
>>> s = requests.Session()
>>> s.hooks['response'].append(print_url)
>>> s.get('https://httpbin.org/')
https://httpbin.org/
<Response [200]>
```

Session 可以有多个钩子，按添加顺序调用。

### 自定义认证

Requests 允许指定你自己的认证机制。作为 `auth` 参数传给请求方法的任何可调用对象，都有机会在请求分发前修改请求。

认证实现是 `AuthBase` 的子类，很容易定义。Requests 在 `requests.auth` 中提供了两种常见认证方案的实现：`HTTPBasicAuth` 与 `HTTPDigestAuth`。

假设有个 Web 服务只在 `X-Pizza` 头被设为密码值时才响应（不太可能，但请配合一下）：

```python
from requests.auth import AuthBase

class PizzaAuth(AuthBase):
    """给给定的 Request 对象附加 HTTP Pizza 认证。"""
    def __init__(self, username):
        # 在这里设置任何认证相关数据
        self.username = username

    def __call__(self, r):
        # 修改并返回请求
        r.headers['X-Pizza'] = self.username
        return r
```

然后用 Pizza 认证发起请求：

```pycon
>>> requests.get('http://pizzabin.org/admin', auth=PizzaAuth('kenneth'))
<Response [200]>
```

### 流式请求

用 `Response.iter_lines()` 可以轻松迭代流式 API（如 Twitter Streaming API）。把 `stream` 设为 `True`，然后用 `iter_lines()` 迭代响应：

```python
import json
import requests

r = requests.get('https://httpbin.org/stream/20', stream=True)

for line in r.iter_lines():

    # 过滤掉 keep-alive 新行
    if line:
        decoded_line = line.decode('utf-8')
        print(json.loads(decoded_line))
```

对 `iter_lines()` 或 `iter_content()` 使用 `decode_unicode=True` 时，应提供回退编码以防服务器未提供：

```python
r = requests.get('https://httpbin.org/stream/20', stream=True)

if r.encoding is None:
    r.encoding = 'utf-8'

for line in r.iter_lines(decode_unicode=True):
    if line:
        print(json.loads(line))
```

> **警告**：`iter_lines()` 不是可重入安全的。多次调用该方法会导致部分已接收数据丢失。如果需要在多处调用，请改用返回的迭代器对象：
>
> ```python
> lines = r.iter_lines()
> # 把第一行留待稍后使用，或者直接跳过
>
> first_line = next(lines)
>
> for line in lines:
>     print(line)
> ```

### 代理（Proxies）

需要代理时，可以对单个请求用 `proxies` 参数配置：

```python
import requests

proxies = {
  'http': 'http://10.10.1.10:3128',
  'https': 'http://10.10.1.10:1080',
}

requests.get('http://example.org', proxies=proxies)
```

也可以对整个 `Session` 配置一次：

```python
import requests

proxies = {
  'http': 'http://10.10.1.10:3128',
  'https': 'http://10.10.1.10:1080',
}
session = requests.Session()
session.proxies.update(proxies)

session.get('http://example.org')
```

> **警告**：设置 `session.proxies` 的行为可能与预期不同：所提供的值会被环境代理（`urllib.request.getproxies` 返回的那些）覆盖。要在存在环境代理的情况下确保使用你的代理，请在所有单个请求上显式指定 `proxies` 参数（如最开始所示）。详见 requests issue #2018。

当代理配置未按上述方式被逐请求覆盖时，Requests 依赖标准环境变量 `http_proxy`、`https_proxy`、`no_proxy` 与 `all_proxy` 定义的代理配置（也支持大写变体）。按需设置即可：

```shell
$ export HTTP_PROXY="http://10.10.1.10:3128"
$ export HTTPS_PROXY="http://10.10.1.10:1080"
$ export ALL_PROXY="socks5://10.10.1.10:3434"

$ python
>>> import requests
>>> requests.get('http://example.org')
```

要给代理配置 HTTP Basic 认证，在上述任意配置项中使用 `http://user:password@host/` 语法：

```shell
$ export HTTPS_PROXY="http://user:pass@10.10.1.10:1080"

$ python
>>> proxies = {'http': 'http://user:pass@10.10.1.10:3128/'}
```

> **警告**：把敏感的用户名密码存进环境变量或纳入版本控制的文件有安全风险，强烈不建议。

要为特定的协议与主机指定代理，用 `scheme://hostname` 形式作为键。它会匹配对该协议与精确主机名的所有请求：

```python
proxies = {'http://10.20.1.128': 'http://10.10.1.10:5323'}
```

注意代理 URL 必须包含协议。最后请注意：https 连接使用代理通常要求本机信任代理的根证书。默认情况下 Requests 信任的证书列表可以这样找到：

```python
from requests.utils import DEFAULT_CA_BUNDLE_PATH
print(DEFAULT_CA_BUNDLE_PATH)
```

通过把 `REQUESTS_CA_BUNDLE`（或 `CURL_CA_BUNDLE`）环境变量设为其他文件路径，可覆盖默认证书包：

```shell
$ export REQUESTS_CA_BUNDLE="/usr/local/myproxy_info/cacert.pem"
$ export https_proxy="http://10.10.1.10:1080"

$ python
>>> import requests
>>> requests.get('https://example.org')
```

#### SOCKS

（2.10.0 新增）除基本 HTTP 代理外，Requests 还支持 SOCKS 协议代理。这是可选功能，使用前需安装额外的第三方库：

```shell
$ python -m pip install 'requests[socks]'
```

安装依赖后，使用 SOCKS 代理与 HTTP 代理一样简单：

```python
proxies = {
    'http': 'socks5://user:pass@host:port',
    'https': 'socks5://user:pass@host:port'
}
```

使用 `socks5` 协议时 DNS 解析发生在客户端而非代理服务器上，这与 curl 一致（curl 也是靠协议名决定在客户端还是代理上做 DNS 解析）。若想在代理服务器上解析域名，用 `socks5h` 协议。

### 规范符合性（Compliance）

Requests 的目标是符合所有相关规范与 RFC——前提是这种符合不会给用户带来困难。对规范的讲究可能带来一些让不熟悉相关规范的人觉得古怪的行为。

**编码**：收到响应时，访问 `Response.text` 属性的话，Requests 会推测用于解码的编码。它先检查 HTTP 头中的编码，若没有，则用 `charset_normalizer` 或 `chardet` 尝试猜测编码。

安装了 `chardet` 时 requests 会使用它；但对 Python 3，`chardet` 不再是强制依赖（它是 LGPL 许可，部分 requests 用户无法依赖强制 LGPL 依赖）。未指定 `[use_chardet_on_py3]` extra 安装 requests、且未安装 `chardet` 时，requests 用 `charset-normalizer`（MIT 许可）来猜测编码。

唯一的例外：HTTP 头中没有显式 charset **且** `Content-Type` 头包含 `text` 时，Requests 不会去猜——此时 [RFC 2616](https://www.w3.org/Protocols/rfc2616/rfc2616-sec3.html#sec3.7.1) 规定默认字符集必须是 `ISO-8859-1`，Requests 遵循规范。若需要别的编码，可手动设置 `Response.encoding` 属性，或直接使用 `Response.content`。

### HTTP 动词

Requests 提供几乎所有 HTTP 动词：GET、OPTIONS、HEAD、POST、PUT、PATCH 和 DELETE。下面以 GitHub API 为例给出各动词的详细用法。

从最常用的 GET 开始。HTTP GET 是幂等方法，返回给定 URL 上的资源，是从网络位置检索数据时应使用的动词。例如获取 GitHub 上 Requests 的某个提交（commit `a050faf`）：

```pycon
>>> import requests
>>> r = requests.get('https://api.github.com/repos/psf/requests/git/commits/a050faf084662f3a352dd1a941f2c7c9f886d4ad')
```

先确认 GitHub 响应正确，再看看内容类型：

```pycon
>>> if r.status_code == requests.codes.ok:
...     print(r.headers['content-type'])
...
application/json; charset=utf-8
```

GitHub 返回 JSON，太好了，可以用 `r.json()` 方法把它解析为 Python 对象：

```pycon
>>> commit_data = r.json()

>>> print(commit_data.keys())
['committer', 'author', 'url', 'tree', 'sha', 'parents', 'message']

>>> print(commit_data['committer'])
{'date': '2012-05-10T11:10:50-07:00', 'email': 'me@kennethreitz.com', 'name': 'Kenneth Reitz'}

>>> print(commit_data['message'])
makin' history
```

目前为止很简单。接下来研究一下 GitHub API——我们可以查文档，但用 Requests 会更有趣。利用 OPTIONS 动词可以查看刚才的 URL 支持哪些 HTTP 方法：

```pycon
>>> verbs = requests.options(r.url)
>>> verbs.status_code
500
```

啊？毫无用处！原来 GitHub（像许多 API 提供商一样）并没有实现 OPTIONS 方法。这是个恼人的疏忽，但没关系，我们只好退回无聊的文档。如果 GitHub 正确实现了 OPTIONS，它应该在头里返回允许的方法，例如：

```pycon
>>> verbs = requests.options('http://a-good-website.com/api/cats')
>>> print(verbs.headers['allow'])
GET,HEAD,POST,OPTIONS
```

文档显示，对提交（commit）唯一允许的其他方法是 POST（创建新提交）。既然用的是 Requests 仓库，我们最好别乱 POST。改玩 GitHub 的 Issues 功能。

本文档的添加源于 issue #482——既然这个 issue 已存在，就拿它举例。先获取它：

```pycon
>>> r = requests.get('https://api.github.com/repos/psf/requests/issues/482')
>>> r.status_code
200

>>> issue = json.loads(r.text)

>>> print(issue['title'])
Feature any http verb in docs

>>> print(issue['comments'])
3
```

不错，有三条评论。看看最后一条：

```pycon
>>> r = requests.get(r.url + '/comments')
>>> r.status_code
200

>>> comments = r.json()

>>> print(comments[0].keys())
['body', 'url', 'created_at', 'updated_at', 'user', 'id']

>>> print(comments[2]['body'])
Probably in the "advanced" section
```

嗯，好像放错了地方。发条评论告诉发帖人他犯傻了。发帖人是谁？

```pycon
>>> print(comments[2]['user']['login'])
kennethreitz
```

好，告诉这位 Kenneth 我们认为这个例子应该放进快速开始指南。按 GitHub API 文档，要 POST 到该讨论串：

```pycon
>>> body = json.dumps({u"body": u"Sounds great! I'll get right on it!"})
>>> url = u"https://api.github.com/repos/psf/requests/issues/482/comments"

>>> r = requests.post(url=url, data=body)
>>> r.status_code
404
```

咦，怪了。大概需要认证吧？那会很麻烦？错了。Requests 让多种认证方式都很容易，包括最常见的 Basic Auth：

```pycon
>>> from requests.auth import HTTPBasicAuth
>>> auth = HTTPBasicAuth('fake@example.com', 'not_a_real_password')

>>> r = requests.post(url=url, data=body, auth=auth)
>>> r.status_code
201

>>> content = r.json()
>>> print(content['body'])
Sounds great! I'll get right on it.
```

太好了。哦等等，不对！我还想补充"我得先去喂猫，所以会晚点弄"。要是能编辑这条评论就好了！幸运的是，GitHub 允许用另一个 HTTP 动词 PATCH 编辑评论：

```pycon
>>> print(content[u"id"])
5804413

>>> body = json.dumps({u"body": u"Sounds great! I'll get right on it once I feed my cat."})
>>> url = u"https://api.github.com/repos/psf/requests/issues/comments/5804413"

>>> r = requests.patch(url=url, data=body, auth=auth)
>>> r.status_code
200
```

很好。现在，为了捉弄这位 Kenneth，我决定先不告诉他我在弄这个，也就是说我要删除这条评论。GitHub 允许用名如其分的 DELETE 方法删除评论：

```pycon
>>> r = requests.delete(url=url, auth=auth)
>>> r.status_code
204
>>> r.headers['status']
'204 No Content'
```

很好，删干净了。最后我还想知道自己用了多少 API 限额。GitHub 把这一信息放在头里，所以与其下载整个页面，不如发个 HEAD 请求拿头：

```pycon
>>> r = requests.head(url=url, auth=auth)
>>> print(r.headers)
...
'x-ratelimit-remaining': '4995'
'x-ratelimit-limit': '5000'
...
```

很好。可以写个 Python 程序用各种刺激的方式再滥用 GitHub API 4995 次了。

### 自定义动词

偶尔你会遇到因故允许甚至要求使用上文未涵盖的 HTTP 动词的服务器，例如某些 WEBDAV 服务器使用的 MKCOL 方法。别担心，Requests 依然可用：借助内置的 `.request` 方法：

```pycon
>>> r = requests.request('MKCOL', url, data=data)
>>> r.status_code
200 # 假设你的调用是正确的
```

利用这一点，服务器允许的任何方法动词都能使用。

### Link 头

许多 HTTP API 具有 Link 头，让 API 更具自描述性与可发现性。GitHub 用它实现 API 分页：

```pycon
>>> url = 'https://api.github.com/users/kennethreitz/repos?page=1&per_page=10'
>>> r = requests.head(url=url)
>>> r.headers['link']
'<https://api.github.com/users/kennethreitz/repos?page=2&per_page=10>; rel="next", <https://api.github.com/users/kennethreitz/repos?page=6&per_page=10>; rel="last"'
```

Requests 会自动解析这些 Link 头，使其易于使用：

```pycon
>>> r.links["next"]
{'url': 'https://api.github.com/users/kennethreitz/repos?page=2&per_page=10', 'rel': 'next'}

>>> r.links["last"]
{'url': 'https://api.github.com/users/kennethreitz/repos?page=7&per_page=10', 'rel': 'last'}
```

### 传输适配器（Transport Adapters）

从 v1.0.0 起，Requests 转向使用 Transport Adapter 的模块化内部设计。这些对象提供为 HTTP 服务定义交互方式的机制，尤其支持按服务应用配置。

Requests 自带一个 Transport Adapter：`HTTPAdapter`。它基于强大的 `urllib3` 库提供默认的 HTTP/HTTPS 交互。每当 Requests `Session` 初始化时，都会有一个这样的适配器挂到 Session 对象上（HTTP 一个、HTTPS 一个）。

用户可以创建并使用自己的 Transport Adapter 提供特定功能。创建后，可以把 Transport Adapter 挂载到 Session 对象，并指明它适用于哪些 Web 服务：

```pycon
>>> s = requests.Session()
>>> s.mount('https://github.com/', MyAdapter())
```

mount 调用把 Transport Adapter 的特定实例注册到一个前缀。挂载后，任何用该 session 发出、URL 以该前缀开头的 HTTP 请求都会使用给定的 Transport Adapter。

> **注**：适配器按最长前缀匹配选择。注意 `http://localhost` 这样的前缀也会匹配 `http://localhost.other.com` 或 `http://localhost@other.com`，建议完整主机名以 `/` 结尾。

实现 Transport Adapter 的许多细节超出本文范围，但下一个例子展示了一个简单的 SSL 用例；更多请看 `BaseAdapter` 的子类化。

**例：指定 SSL 版本**。Requests 团队刻意选择使用底层库（urllib3）的默认 SSL 版本。通常没问题，但偶尔你需要连接使用不兼容默认版本的服务端点。可以用 Transport Adapter 实现：沿用 HTTPAdapter 的现有实现，增加一个透传给 urllib3 的 *ssl_version* 参数。下面创建一个指示使用 SSLv3 的适配器：

```python
import ssl
from urllib3.poolmanager import PoolManager

from requests.adapters import HTTPAdapter


class Ssl3HttpAdapter(HTTPAdapter):
    """"Transport adapter"，允许我们使用 SSLv3。"""

    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(
            num_pools=connections, maxsize=maxsize,
            block=block, ssl_version=ssl.PROTOCOL_SSLv3)
```

**例：自动重试**。默认情况下 Requests 不重试失败的连接。不过，可以用 `urllib3.util.Retry` 类在 Requests `Session` 内实现带退避等强大功能的自动重试：

```python
from urllib3.util import Retry
from requests import Session
from requests.adapters import HTTPAdapter

s = Session()
retries = Retry(
    total=3,
    backoff_factor=0.1,
    status_forcelist=[502, 503, 504],
    allowed_methods={'POST'},
)
s.mount('https://', HTTPAdapter(max_retries=retries))
```

### 阻塞还是非阻塞？

使用默认 Transport Adapter 时，Requests 不提供任何非阻塞 IO。`Response.content` 属性会阻塞到整个响应下载完毕。若需要更细的粒度，本库的流式特性（见"流式请求"）允许每次获取较小的响应量，但这些调用仍然阻塞。

如果你在意阻塞 IO，有许多项目把 Requests 与 Python 的异步框架结合：优秀例子有 `requests-threads`、`grequests`、`requests-futures`，以及 `httpx`。

### 头顺序

在少见的情况下，你可能希望按顺序提供头。把 `OrderedDict` 传给 `headers` 关键字参数即可为头指定顺序。*但是*，Requests 默认头的顺序会被优先保留——这意味着如果你在 `headers` 关键字参数中覆盖了默认头，它们相对于该参数中其他头可能显得乱序。

如果有问题，建议改为在 `Session` 对象上设置默认头：把 `Session.headers` 设为自定义 `OrderedDict`，该顺序将始终被优先采用。

### 超时（Timeouts）

对外部服务器的多数请求都应附带超时，以防服务器未及时响应。默认情况下，除非显式设置超时值，请求不会超时；没有超时，你的代码可能挂起数分钟或更久。

**connect** 超时是 Requests 等待客户端建立与远端机器连接的秒数（对应套接字上的 `connect()` 调用）。把 connect 超时设为略大于 3 的倍数是好习惯——3 秒是默认的 TCP 包重传窗口。

客户端连上服务器并发送 HTTP 请求后，**read** 超时是客户端等待服务器发送响应的秒数。（准确地说，是客户端在服务器发来的字节*之间*等待的秒数；99.9% 的情况下就是等待服务器第一个字节的时间。）

像这样为超时指定单个值：

```python
r = requests.get('https://github.com', timeout=5)
```

该值会同时应用于 `connect` 与 `read` 超时。想分别设置，传元组：

```python
r = requests.get('https://github.com', timeout=(3.05, 27))
```

如果远端服务器很慢，可以让 Requests 永远等待：把 `None` 作为超时值，然后去喝杯咖啡：

```python
r = requests.get('https://github.com', timeout=None)
```

> **注**：connect 超时适用于对每个 IP 地址的连接尝试。若一个域名有多个地址，底层 `urllib3` 会逐个尝试每个地址直到连上。这可能导致实际总连接超时为指定时间的*数倍*：例如一个同时有 IPv4 与 IPv6 地址的无响应服务器，感知超时会*翻倍*，设置连接超时时要考虑。
>
> **注**：connect 与 read 超时都不是"墙上时钟"时间。也就是说，如果发起请求时看一眼时间，请求结束或超时时再看一眼，真实经过的时间可能大于你指定的时间。

---

> **来源**：本文由 requests 官方文档两页完整翻译合并而成：[Quickstart（快速开始）](https://requests.readthedocs.io/en/latest/user/quickstart/) 与 [Advanced Usage（进阶用法）](https://requests.readthedocs.io/en/latest/user/advanced/)，作者 Kenneth Reitz 与 PSF Requests 团队，许可 Apache 许可证 2.0。抓取于 2026-09-13。

---

> 编者注：requests 的"默认不超时"特性在 LLM 应用里是常见事故源——外网 API 调用请务必传 `timeout=(连接超时, 读取超时)` 元组；流式拉取大模型 token 建议改用 httpx 异步客户端（见下一篇与《FastAPI 进阶》一篇）。
