---
title: SSE 与 WebSocket：流式输出的网络基础
source_url: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
author: Mozilla 贡献者（MDN Web Docs）
license: CC BY-SA 2.5
fetched_at: 2026-09-13
translated: true
order: 26
group: 计算机网络
---

开发使用**服务器推送事件**（server-sent events，SSE）的 Web 应用非常直接。服务器端需要少量代码把事件流式推送到前端；而客户端处理到达事件的代码，与 WebSocket 几乎如出一辙。这是一条**单向**连接：客户端不能向服务器发送事件。

为什么 LLM 学习者要关心它？因为当今各大 LLM API（OpenAI、Anthropic 等）的**流式输出**（streaming）正是用 SSE 实现的：模型每生成一段文本，服务端就通过一条 HTTP 流推送一个事件，前端（或你的客户端）逐段渲染。

## 从服务器接收事件

SSE API 封装在 `EventSource` 接口中。

### 创建 EventSource 实例

要打开与服务器的连接、开始接收事件，用生成事件的脚本 URL 创建一个新的 `EventSource` 对象：

```js
const evtSource = new EventSource("sse-demo.php");
```

如果事件生成脚本位于不同源（origin），应同时传入 URL 与选项字典（假设客户端脚本在 `example.com` 上）：

```js
const evtSource = new EventSource("//api.example.com/sse-demo.php", {
  withCredentials: true,
});
```

### 监听 message 事件

服务器发来的、**没有** `event` 字段的消息，以 `message` 事件的形式接收。为 `message` 事件挂一个处理器：

```js
evtSource.onmessage = (event) => {
  const newElement = document.createElement("li");
  const eventList = document.getElementById("list");

  newElement.textContent = `message: ${event.data}`;
  eventList.appendChild(newElement);
};
```

这段代码监听到达的 message 事件，把消息文本追加到文档 HTML 的列表里。

### 监听自定义事件

服务器发来的、**带有** `event` 字段的消息，以该字段指定的名字作为事件名接收。例如：

```js
evtSource.addEventListener("ping", (event) => {
  const newElement = document.createElement("li");
  const eventList = document.getElementById("list");
  const time = JSON.parse(event.data).time;
  newElement.textContent = `ping at ${time}`;
  eventList.appendChild(newElement);
});
```

只要服务器发出 `event` 字段为 `ping` 的消息，这段代码就会被调用；它解析 `data` 字段中的 JSON 并输出信息。

> **警告**：在不使用 HTTP/2 的情况下，SSE 受到**最大打开连接数**的限制——开多个标签页时尤其痛苦，因为该限制是**每浏览器**的，而且数值很低（6）。Chrome 与 Firefox 都把这个问题标记为"不修"。此限制按"浏览器 + 域"计：你可以对所有标签页向 `www.example1.com` 开 6 条 SSE 连接，另 6 条给 `www.example2.com`。使用 HTTP/2 时，最大并发 HTTP 流数由服务器与客户端协商（默认 100）。

## 从服务器发送事件

发送事件的服务器端脚本必须以 MIME 类型 `text/event-stream` 响应。每条通知以一块文本发送、以一对换行符结尾。事件流格式的细节见下文。以本文示例所用的 PHP 代码为例：

```php
date_default_timezone_set("America/New_York");
header("X-Accel-Buffering: no");
header("Content-Type: text/event-stream");
header("Cache-Control: no-cache");

$counter = rand(1, 10);
while (true) {
  // 每秒发送一个 "ping" 事件。

  echo "event: ping\n";
  $curDate = date(DATE_ISO8601);
  echo 'data: {"time": "' . $curDate . '"}';
  echo "\n\n";

  // 以随机间隔发送一条简单消息。

  $counter--;

  if (!$counter) {
    echo 'data: This is a message at time ' . $curDate . "\n\n";
    $counter = rand(1, 10);
  }

  if (ob_get_contents()) {
      ob_end_flush();
  }
  flush();

  // 客户端中止连接（关闭页面）时跳出循环

  if (connection_aborted()) break;

  sleep(1);
}
```

上面的代码每秒生成一个类型为 "ping" 的事件，每个事件的数据是含 ISO 8601 时间戳的 JSON 对象；并以随机间隔发送不带事件类型的简单消息。循环与连接状态无关地持续运行，因此加入了在连接关闭时跳出循环的检查（如客户端关闭页面）。完整示例见 GitHub 上的 [Simple SSE demo using PHP](https://github.com/mdn/dom-examples/tree/main/server-sent-events)。

## 错误处理

服务器以 `error` 键响应（如 `JSON.parse(event.data.error)`），或发生其他问题（如网络超时、访问控制 CORS 问题）时，会产生一个错误事件。可以在 `EventSource` 对象上实现 `onerror` 回调来处理：

```js
evtSource.onerror = (err) => {
  console.error("EventSource failed:", err);
};
```

## 关闭事件流

默认情况下，客户端与服务器的连接断开后会**自动重连**。用 `.close()` 方法可终止连接：

```js
evtSource.close();
```

## 事件流格式

事件流是必须用 UTF-8 编码的简单文本流。流中的消息由一对换行符分隔。行首为冒号的行本质上是**注释**，会被忽略。

> **注**：注释行可用于防止连接超时——服务器可以周期性发送注释来保活连接。

每条消息由一行或多行文本组成，列出该消息的字段；字段表示法为"字段名 + 冒号 + 该字段值的文本"。每条消息可由下列字段的某种组合构成，每行一个：

- **`event`**：标识所描述事件类型的字符串。指定后，浏览器会向该事件名的监听器派发事件；网站代码应用 `addEventListener()` 监听具名事件。消息未指定事件名时调用 `onmessage` 处理器。
- **`data`**：消息的数据字段。`EventSource` 收到多个连续的 `data:` 开头行时，会把它们**拼接**起来、行间插入换行符；结尾的换行符被移除。
- **`id`**：事件 ID，用于设置 `EventSource` 对象的"最后事件 ID"值（重连时可通过 `Last-Event-ID` 头续传，实现断点续流）。
- **`retry`**：重连时间。与服务器的连接丢失时，浏览器将等待指定毫秒数再尝试重连。必须是整数（毫秒）；非整数值被忽略。

其他字段名一律忽略。（不含冒号的行，整行被视为值为空字符串的字段名。）

### 示例

**纯数据消息**——三条消息：第一条是注释（以冒号开头），如前所述可作为消息不定期发送时的保活机制；第二条的 data 字段为 "some text"；第三条的 data 字段为 "another message\nwith two lines"（注意值中的换行）：

```
: this is a test stream

data: some text

data: another message
data: with two lines
```

**具名事件**——每条有 `event` 字段指定事件名，`data` 字段是客户端处理事件所需的 JSON 字符串（当然也可以是任何字符串，不必是 JSON）：

```
event: userconnect
data: {"username": "bobby", "time": "02:33:48"}

event: usermessage
data: {"username": "bobby", "time": "02:34:11", "text": "Hi everyone."}

event: userdisconnect
data: {"username": "bobby", "time": "02:34:23"}

event: usermessage
data: {"username": "sean", "time": "02:34:36", "text": "Bye, bobby."}
```

**混合使用**——无名消息与具名事件可以混在同一条事件流里：

```
event: userconnect
data: {"username": "bobby", "time": "02:33:48"}

data: Here's a system message of some kind that will get used
data: to accomplish some task.

event: usermessage
data: {"username": "bobby", "time": "02:34:11", "text": "Hi everyone."}
```

## WebSocket API

**WebSocket API** 让用户的浏览器与服务器之间可以打开**双向交互通信**会话。有了它，你可以向服务器发消息并接收响应，而无需轮询服务器等回复。

WebSocket API 提供两种创建与使用 WebSocket 连接的机制：`WebSocket` 接口与 `WebSocketStream` 接口。

- `WebSocket` 接口稳定、浏览器与服务器支持良好；但它不支持**背压**（backpressure）。结果就是：消息到达速度快于应用处理速度时，它会要么靠缓冲消息塞满设备内存、要么因 CPU 100% 而失去响应，或两者兼有。
- `WebSocketStream` 接口是基于 **Promise** 的 `WebSocket` 替代品，用 Streams API 处理消息收发——套接字连接能自动利用流背压，调节读写速度避免应用瓶颈。不过 `WebSocketStream` 尚非标准，目前只有一种渲染引擎支持。

此外，**WebTransport API** 有望在许多应用中取代 WebSocket API：它是一个多能的低层 API，提供背压以及 `WebSocket`/`WebSocketStream` 均不支持的其他特性——单向流、乱序投递、经数据报的不可靠传输。WebTransport 比 WebSocket 更复杂、跨浏览器支持面更窄，但能实现更精巧的方案。如果标准 WebSocket 连接适合你的用例、又需要广泛的浏览器兼容性，用 WebSocket API 可以快速起步；若应用需要非标准的定制方案，则应使用 WebTransport API。

> **注**：页面保持打开的 WebSocket 连接时，浏览器可能不把该页面放入 bfcache（往返缓存）；用户用完页面后关闭连接是好习惯。

### WebSocket 握手相关的 HTTP 头部

WebSocket 连接始于一次 **HTTP 升级握手**（这就把它与本模块的 HTTP 篇串起来了）：

- **`Sec-WebSocket-Key`**：请求头，含客户端提供的 nonce。用于 WebSocket 打开握手中验证客户端确实想打开 WebSocket；由浏览器自动添加。
- **`Sec-WebSocket-Accept`**：响应头，用于打开握手，表明服务器愿意升级为 WebSocket 连接；其值由对应请求中 `Sec-WebSocket-Key` 的值计算而来。
- **`Sec-WebSocket-Version`**：请求中指示客户端理解的 WebSocket 协议版本；仅当服务器不支持所请求版本时才出现在响应中，并列出服务器支持的版本。
- **`Sec-WebSocket-Protocol`**：请求中按优先序列出客户端支持的子协议；响应中指示服务器从客户端偏好中选定的子协议。
- **`Sec-WebSocket-Extensions`**：请求中按优先序列出客户端支持的 WebSocket 扩展；响应中指示服务器选定的扩展。

### 核心接口

- **`WebSocket`**：连接 WebSocket 服务器、并在连接上收发数据的主接口（`send()` 发送，`message`/`close` 等事件接收）。
- **`WebSocketStream`**：基于 Promise 的连接接口，用流收发数据。
- **`CloseEvent`**：连接关闭时由 WebSocket 对象发出的事件。
- **`MessageEvent`**：从服务器收到消息时由 WebSocket 对象发出的事件。

协议规范见 RFC 6455（The WebSocket Protocol）；生态工具（Node.js 的 ws、Socket.IO、Django Channels、Flask-SocketIO 等）见 MDN [Websockets API](https://developer.mozilla.org/en-US/docs/Web/API/Websockets_API) 页面的工具清单。

## SSE 与 WebSocket 怎么选？

| 维度 | SSE | WebSocket |
|---|---|---|
| 方向 | 单向（服务器 → 客户端） | 双向 |
| 底层 | 普通 HTTP（`text/event-stream`） | 独立协议（HTTP 升级握手） |
| 断线重连 | 浏览器内建（`retry`、`Last-Event-ID`） | 需自行实现 |
| 数据格式 | UTF-8 文本 | 文本或二进制 |
| 基础设施友好度 | 高（过 HTTP 代理/网关/CDN 无碍） | 需基础设施支持升级 |

LLM 应用几乎总是"用户发一次请求、模型流式回一大段"的单向场景，SSE（或同形的分块 HTTP 流）是事实标准——各大 LLM API 的 `stream: true` 都基于它；需要双向低延迟（协同编辑、多人游戏、语音实时对话）时再考虑 WebSocket。而这两者的可靠性，都建立在第 22 篇《TCP》的序列号、确认与重传之上。

---

> **来源**：本文主要翻译自 [Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)（WebSocket 部分译自 [Websockets API](https://developer.mozilla.org/en-US/docs/Web/API/Websockets_API)），作者 MDN Web Docs 的 Mozilla 贡献者，许可 CC BY-SA 2.5。抓取于 2026-09-13。
