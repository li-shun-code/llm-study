---
title: HTTPS 与 TLS
source_url: https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security
author: Mozilla 贡献者（MDN Web Docs）
license: CC BY-SA 2.5
fetched_at: 2026-09-13
translated: true
order: 25
---
**传输层安全**（Transport Layer Security，TLS）是一种让客户端在不可信网络上与服务器**安全通信**的协议。它最著名的用途是为 HTTP 连接提供安全保障：这样得到的协议就叫 **HTTPS**。

TLS 以三种方式保护网络连接：

- **加密**（Encryption）：客户端与服务器之间交换的数据在传输途中被加密，攻击者无法读取。
- **完整性**（Integrity）：攻击者无法在数据于客户端与服务器之间传输时偷偷修改它（而不被发现）。
- **认证**（Authentication）：客户端与服务器都能向对方证明自己的确是它声称的那个实体。在 Web 上，通常是服务器向客户端证明自己，而客户端一般不向服务器证明自己。

特别地，HTTPS 是对抗**中间人操纵**（manipulator in the middle，MITM）攻击的防线——这类攻击中，攻击者把自己插进用户的浏览器与其连接的服务器之间，从而能阅读并修改双方交换的流量。

浏览器把经 HTTPS 交付的页面视为**安全上下文**（secure context）；许多强大的 Web API 只对运行在安全上下文中的代码开放。

**所有网站都应当用 HTTPS 提供其全部页面与子资源，并实现服务器认证。**

## TLS 握手

客户端使用 TLS 连接服务器时，一次初始的**握手**（handshake）为协议设定安全参数：

- 客户端与服务器就使用哪个 TLS 版本达成一致。当前版本是 TLS 1.3（RFC 8446），也是使用最广泛的版本；TLS 1.2 仍被一些网站使用；TLS 1.1 与 1.0 则不应再使用。
- 客户端与服务器就将要使用的**密码套件**（cipher suite）达成一致：它定义了双方用于密钥协商、认证、加密与消息认证的算法。
- 可选地，客户端与服务器互相认证。客户端认证（客户端向服务器证明身份）在 Web 上除少数专门应用外很少见；而**服务器认证**（服务器向客户端证明身份）是 Web 安全的基本组成部分。
- 客户端与服务器就一个用于加密与解密消息的**密钥**达成一致。

握手完成后，客户端与服务器使用该密钥加密与解密所有消息——包括 HTTP 头部与主体。

## 配置 TLS

选择合适的 TLS 服务器配置对连接安全影响很大，尤其它决定了将使用的 TLS 版本与密码算法。如果你需要配置自己的服务器，请参考 Mozilla 的 [TLS 推荐配置](https://wiki.mozilla.org/Security/Server_Side_TLS#Recommended_configurations)。Mozilla 还提供一个 [TLS 配置生成器](https://ssl-config.mozilla.org/)，能为大量 Web 服务器生成配置文件。

## 服务器认证

要支持服务器认证，你的网站必须持有**数字证书**（digital certificate），其中包含网站公钥（与私钥成对）的**数字签名**副本。这把网站的密钥与其域名绑定在一起，于是浏览器知道它连接的确实是例如 `https://example.com`。

[Let's Encrypt](https://letsencrypt.org/) 是被广泛使用的非营利证书颁发机构（CA），免费签发 TLS 证书。

现代 Web 托管服务默认（或通过一个配置项）就支持 HTTPS；这种情况下，托管服务很可能代你管理证书并配置服务器。

## 混合内容

网站不仅应当用 HTTPS 提供主文档，还应提供它加载的**所有子资源**——脚本、样式表、图片、字体等。如果网站以 HTTPS 加载主文档、却又以 HTTP 加载任何子资源，这就叫**混合内容**（mixed content）。

例如，`https://example.org` 提供的文档里包含下面这行内容，就构成混合内容：

```html
<img src="http://example.org/my-image.png" />
```

混合内容不安全：子资源得不到 HTTPS 的保护，攻击者不仅能读取它们，还可能修改它们——这会破坏整个页面的完整性！比如攻击者可以修改一个脚本使其为害；其他资源虽不如脚本危险，但仍有风险：例如攻击者可以修改图片来迷惑或误导用户。

因此，浏览器不允许安全页面加载不安全的子资源；根据子资源类型，浏览器要么把加载请求**升级**为 HTTPS，要么**完全阻止**该请求。如果你无法更新代码改用 HTTPS URL（例如 HTML 已被存档），服务器可以设置包含 `upgrade-insecure-requests` 指令的内容安全策略（CSP），浏览器就会自动把这些请求升级为 HTTPS。

## 把 HTTP 连接升级到 HTTPS

即使站点只以 HTTPS 提供，用户仍可能以 HTTP 请求它——比如在地址栏输入 `http://example.org`。为应对这种情况，可以监听 HTTP 请求、并用 `301 Moved Permanently` 响应重定向到 HTTPS 版本。

但这给了攻击者可乘之机：拦截最初的交换、阻止向 HTTPS 的升级——这有时称为 **SSL 剥离**（SSL stripping）攻击（SSL 是 TLS 的前身）。

为降低该攻击的风险，服务器还应发送 `Strict-Transport-Security` HTTP 响应头（即 **HSTS**）：它告诉客户端本站希望使用 HTTPS，并让浏览器在此后的所有访问中直接用 HTTPS 连接——即使用户输入的是 HTTP URL。

有 HSTS，除了浏览器第一次尝试连接你的站点（或 HSTS 记录过期后的第一次），SSL 剥离都会被阻止。为了在首次连接或记录过期时也保护站点，Chrome 维护一份称为 **HSTS 预加载列表**（HSTS preload list）的域名列表：域名在列，Chrome 就总是把 HTTP 请求升级为 HTTPS——效果如同服务器已发送过 HSTS 头。Safari 与 Firefox 也有类似行为，使用一份由 Chrome 列表派生的列表。

## 延伸

- 测试 HTTPS/TLS 配置：[Mozilla HTTP Observatory](https://developer.mozilla.org/en-US/observatory)、[SSL Labs](https://www.ssllabs.com/ssltest/)
- 推荐 TLS 配置：[Mozilla 推荐配置](https://ssl-config.mozilla.org/)、[Cipherlist.eu](https://cipherlist.eu/)

> 译注：把本篇与《HTTP》《TCP》连起来看：HTTPS = HTTP over TLS over TCP——TLS 夹在 HTTP（应用层）与 TCP（传输层）之间加密并认证流量，正对应 OSI 分层模型中"表示层：加密"的职责。对 LLM 应用开发者，这是一条硬性实践：**所有 API 流量（包括 SSE 流式响应）都必须走 HTTPS**，否则你的 API Key 与对话内容在链路上是明文；调用第三方 API 时也请确认 base URL 是 `https://` 开头。

---

> **来源**：本文翻译自 [Transport Layer Security (TLS)](https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security)，作者 MDN Web Docs 的 Mozilla 贡献者，许可 CC BY-SA 2.5。抓取于 2026-09-13。

---

> 编者按：本篇原计划翻译 Cloudflare 学习中心的 "What is TLS/HTTPS?"，因该站拒绝抓取（HTTP 403）换用同主题英文一手资料（MDN），详见模块来源报告。
