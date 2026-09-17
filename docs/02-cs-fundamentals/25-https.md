---
title: HTTPS 与 TLS
source_url: https://www.rfc-editor.org/rfc/rfc8446
author: Eric Rescorla（IETF RFC 8446《TLS 1.3》）；Mozilla 贡献者（MDN Web Docs）
license: RFC 8446 部分：IETF Trust Legal Provisions（BCP 78，允许注明出处的翻译）；MDN 部分：CC BY-SA 2.5
fetched_at: 2026-09-18
translated: true
order: 25
group: 计算机网络
---

**传输层安全**（Transport Layer Security，TLS）是一种让客户端在不可信网络上与服务器**安全通信**的协议。它最著名的用途是为 HTTP 连接提供安全保障：这样得到的协议就叫 **HTTPS**。

TLS 以三种方式保护网络连接：

- **加密**（Encryption）：客户端与服务器之间交换的数据在传输途中被加密，攻击者无法读取。
- **完整性**（Integrity）：攻击者无法在数据于客户端与服务器之间传输时偷偷修改它（而不被发现）。
- **认证**（Authentication）：客户端与服务器都能向对方证明自己的确是它声称的那个实体。在 Web 上，通常是服务器向客户端证明自己，而客户端一般不向服务器证明自己。

特别地，HTTPS 是对抗**中间人操纵**（manipulator in the middle，MITM）攻击的防线——这类攻击中，攻击者把自己插进用户的浏览器与其连接的服务器之间，从而能阅读并修改双方交换的流量。

浏览器把经 HTTPS 交付的页面视为**安全上下文**（secure context）；许多强大的 Web API 只对运行在安全上下文中的代码开放。

**所有网站都应当用 HTTPS 提供其全部页面与子资源，并实现服务器认证。**

## TLS 握手（高层概览）

客户端使用 TLS 连接服务器时，一次初始的**握手**（handshake）为协议设定安全参数：

- 客户端与服务器就使用哪个 TLS 版本达成一致。当前版本是 TLS 1.3（RFC 8446），也是使用最广泛的版本；TLS 1.2 仍被一些网站使用；TLS 1.1 与 1.0 则不应再使用。
- 客户端与服务器就将要使用的**密码套件**（cipher suite）达成一致：它定义了双方用于密钥协商、认证、加密与消息认证的算法。
- 可选地，客户端与服务器互相认证。客户端认证（客户端向服务器证明身份）在 Web 上除少数专门应用外很少见；而**服务器认证**（服务器向客户端证明身份）是 Web 安全的基本组成部分。
- 客户端与服务器就一个用于加密与解密消息的**密钥**达成一致。

握手完成后，客户端与服务器使用该密钥加密与解密所有消息——包括 HTTP 头部与主体。

以上是高层画面。握手内部到底交换了哪些消息、密钥如何协商出来？下面的内容翻译自 TLS 1.3 的规范文本 RFC 8446（IETF，2018），它是 TLS 协议本身的一手来源。

## TLS 的目标与组成（RFC 8446 第 1 节）

TLS 的首要目标是在两个通信对等方（peer）之间提供一条**安全信道**；它对底层传输的唯一要求是一条可靠、按序的数据流。具体而言，该安全信道应提供以下性质：

- **认证**（Authentication）：信道的服务器端总是被认证；客户端侧则是可选认证。认证可以经由非对称密码学（如 RSA、椭圆曲线数字签名算法 ECDSA、Edwards 曲线数字签名算法 EdDSA）或对称的**预共享密钥**（pre-shared key，PSK）完成。
- **机密性**（Confidentiality）：信道建立之后发送的数据只有端点可见。TLS 并不隐藏它所传输数据的长度，不过端点可以对 TLS 记录做**填充**（padding），以模糊长度信息、增强对抗流量分析技术的防护。
- **完整性**（Integrity）：信道建立之后发送的数据无法被攻击者修改而不被察觉。

即使攻击者对网络拥有完全的控制权，上述性质也应当成立。相关安全性质的更完整陈述见 RFC 8446 附录 E。

TLS 由两个主要组件构成：

- **握手协议**（handshake protocol）：对通信双方进行认证，协商密码学模式与参数，并建立共享的密钥材料。握手协议的设计目标是抵抗篡改：主动攻击者不应能强迫双方协商出与"连接未受攻击时"不同的参数。
- **记录协议**（record protocol）：使用握手协议建立的参数来保护通信双方之间的流量。记录协议把流量切分为一系列**记录**（record），每条记录用流量密钥独立保护。

TLS 与应用协议无关：更高层的协议可以透明地叠加在 TLS 之上——HTTP 叠加其上就成了 HTTPS。不过 TLS 标准并不规定各协议"如何"借助 TLS 获得安全性；如何发起 TLS 握手、如何解读所交换的认证证书，由运行在 TLS 之上的协议的设计者与实现者自行判断。

本文定义的是 TLS 版本 1.3。TLS 1.3 虽然不与旧版本直接兼容，但所有版本的 TLS 都带有版本协商机制：只要双方都支持某个共同版本，客户端与服务器就能互操作地协商出它。

> 注：RFC 8446 第 1.1 节为术语与惯例（MUST/SHOULD 等约定语的解释），面向规范读者，本篇从略。

## TLS 1.3 相对 TLS 1.2 的主要变化（RFC 8446 第 1.2 节）

以下是 TLS 1.2 与 TLS 1.3 之间主要功能性差异的清单（并非穷尽，此外还有许多小差异）：

- 支持的对称加密算法列表删除了所有被视为**遗留**（legacy）的算法，保留的全是**带关联数据的认证加密**（AEAD）算法。密码套件的概念被重新定义：把"认证与密钥交换机制"同"记录保护算法（含密钥长度）"以及"用于密钥推导函数与握手消息认证码（MAC）的哈希"分离开来。
- 新增**零往返时间**（0-RTT）模式：为一部分应用数据在连接建立时节省一个往返，代价是牺牲某些安全性质。
- 移除了静态 RSA 与静态 Diffie-Hellman 密码套件；所有基于公钥的密钥交换机制现在都提供**前向安全**（forward secrecy）。
- ServerHello 之后的**所有握手消息现在都是加密的**。新引入的 `EncryptedExtensions` 消息，让过去在 ServerHello 中明文发送的各类扩展也获得了机密性保护。
- 密钥推导函数被重新设计。新设计凭借更好的密钥分离性质，更易于密码学家分析；底层原语采用基于 HMAC 的**提取-扩展密钥推导函数**（HKDF）。
- 握手状态机被大幅重构，更加一致，并删除了多余的消息（如 `ChangeCipherSpec`——仅在中间盒兼容时保留）。
- 椭圆曲线算法进入基础规范，并纳入了 EdDSA 等新签名算法；TLS 1.3 移除了点格式协商，每条曲线只用单一格式。
- 其他密码学改进包括：RSA 填充改用 RSA 概率签名方案（RSASSA-PSS），并移除了压缩、DSA 与自定义临时 Diffie-Hellman（DHE）群。
- TLS 1.2 的版本协商机制被弃用，改为在扩展中携带版本列表。这提升了与那些把版本协商实现错了的既有服务器的兼容性。
- 旧版本中"有/无服务器端状态的会话恢复"以及基于 PSK 的密码套件，被统一替换为一种新的 PSK 交换（见下文"会话恢复与 PSK"）。

## 完整握手的消息流（RFC 8446 第 2 节）

安全信道使用的密码学参数由 TLS 握手协议产生。客户端与服务器第一次通信时就使用这个子协议。握手协议让双方协商协议版本、选择密码学算法、可选地互相认证，并建立共享的秘密密钥材料。握手完成后，双方用建立好的密钥保护应用层流量。

握手失败或其他协议错误会触发连接终止，终止前可选地先发送一条告警（alert）消息。

TLS 支持三种基本的密钥交换模式：

- (EC)DHE（有限域或椭圆曲线上的 Diffie-Hellman）
- 仅 PSK
- PSK 与 (EC)DHE 组合

基本的完整 TLS 握手如图 1 所示：

```
   Client                                           Server

Key  ^ ClientHello
Exch | + key_share*
     | + signature_algorithms*
     | + psk_key_exchange_modes*
     v + pre_shared_key*       -------->
                                                  ServerHello  ^ Key
                                                 + key_share*  | Exch
                                            + pre_shared_key*  v
                                        {EncryptedExtensions}  ^  Server
                                        {CertificateRequest*}  v  Params
                                               {Certificate*}  ^
                                         {CertificateVerify*}  | Auth
                                                   {Finished}  v
                               <--------  [Application Data*]
     ^ {Certificate*}
Auth | {CertificateVerify*}
     v {Finished}              -------->
       [Application Data]      <------->  [Application Data]

              +  表示前面所述消息中发送的、值得注意的扩展
              *  表示可选或视情况而定、不总是发送的消息/扩展
              {} 表示用 [发送方]_handshake_traffic_secret 派生的密钥保护的消息
              [] 表示用 [sender]_application_traffic_secret_N 派生的密钥保护的消息

               图 1：完整 TLS 握手的消息流
```

握手可以看作有三个阶段（即上图中标注的三个部分）：

- **密钥交换**（Key Exchange）：建立共享密钥材料并选择密码学参数。此阶段之后的一切都是加密的。
- **服务器参数**（Server Parameters）：确立其他握手参数（是否认证客户端、支持哪些应用层协议等）。
- **认证**（Authentication）：认证服务器（以及可选地客户端），并提供密钥确认与握手完整性。

在**密钥交换阶段**，客户端发送 `ClientHello` 消息，其中包含：一个随机数（`ClientHello.random`）；它支持的协议版本；一列"对称密码/HKDF 哈希"组合；一组 Diffie-Hellman 密钥份额（放在 `key_share` 扩展中）、一组预共享密钥标签（放在 `pre_shared_key` 扩展中）或两者皆有；以及可能的其他扩展。为了兼容中间盒，还可能带有额外的字段或消息。

服务器处理 `ClientHello`、为连接确定合适的密码学参数，然后以自己的 `ServerHello` 回应，其中给出协商出的连接参数。`ClientHello` 与 `ServerHello` 的组合决定了共享密钥。若使用 (EC)DHE 密钥建立，`ServerHello` 会包含一个 `key_share` 扩展，携带服务器的临时 Diffie-Hellman 份额；该份额必须与客户端份额之一属同一群组。若使用 PSK 密钥建立，`ServerHello` 会包含一个 `pre_shared_key` 扩展，指明选用了客户端提供的哪个 PSK。注意：实现也可以把 (EC)DHE 与 PSK 一起使用，此时两个扩展都会提供。

随后服务器发送两条消息，确立**服务器参数**：

- `EncryptedExtensions`：对 `ClientHello` 扩展中"无需用于确定密码学参数"部分的回应（个别证书专属的扩展除外）。
- `CertificateRequest`：若希望基于证书的客户端认证，则给出所期望的证书参数；不希望客户端认证时省略此消息。

最后，客户端与服务器交换**认证消息**。凡需要基于证书的认证，TLS 每次都使用同一组消息（基于 PSK 的认证作为密钥交换的副产品完成）。具体为：

- `Certificate`：端点的证书及各证书专属扩展。服务器不用证书认证时省略；客户端在服务器未发送 `CertificateRequest`（即表明客户端无需证书认证）时省略。注意：若使用裸公钥或缓存信息扩展，此消息携带的不是证书，而是对应服务器长期密钥的其他值。
- `CertificateVerify`：对**整个握手**的签名，签名所用私钥与 `Certificate` 消息中公钥配对。端点不经证书认证时省略。
- `Finished`：对整个握手的**消息认证码**（MAC）。它提供密钥确认、把端点身份绑定到交换出的密钥上；在 PSK 模式下它还承担对握手的认证。

客户端收到服务器的消息后，回应自己的认证消息——`Certificate` 与 `CertificateVerify`（若被请求），以及 `Finished`。

至此握手完成，客户端与服务器推导出记录层所需的密钥材料，开始交换经认证加密保护的应用层数据。应用数据绝不允许在发送 `Finished` 之前发送——2.3 节规定的 0-RTT 除外。注意：服务器虽然可以在收到客户端认证消息之前先发应用数据，但那一刻发出的数据，接收方显然还是未经认证的对端。

## 会话恢复与 PSK（RFC 8446 第 2.2 节）

TLS 的 PSK 既可以在带外建立，也可以由**之前的连接**建立、再用于建立新连接——这叫**会话恢复**（session resumption）。一次握手完成后，服务器可以给客户端发送一个 PSK 标识（identity），对应从初始握手推导出的唯一密钥。此后客户端在新的握手中出示这个 PSK 标识，协商使用相关的 PSK。若服务器接受该 PSK，新连接的安全上下文就在密码学上与原连接绑定，并由初始握手推导的密钥来引导密码学状态，而无须完整握手。在 TLS 1.2 及更早版本中，这一功能由 "session ID" 与 "session ticket" 机制提供；两者在 TLS 1.3 中都已被废弃。

PSK 可以与 (EC)DHE 密钥交换组合使用，在共享密钥之外再获得前向安全；也可以单独使用，代价是应用数据失去前向安全。

图 3 展示了一对握手：第一个握手建立 PSK，第二个握手使用它：

```
        Client                                               Server

   Initial Handshake:
          ClientHello
          + key_share               -------->
                                                          ServerHello
                                                          + key_share
                                                {EncryptedExtensions}
                                                {CertificateRequest*}
                                                       {Certificate*}
                                                 {CertificateVerify*}
                                                           {Finished}
                                    <--------     [Application Data*]
          {Certificate*}
          {CertificateVerify*}
          {Finished}                -------->
                                    <--------      [NewSessionTicket]
          [Application Data]        <------->      [Application Data]

   Subsequent Handshake:
          ClientHello
          + key_share*
          + pre_shared_key          -------->
                                                          ServerHello
                                                     + pre_shared_key
                                                         + key_share*
                                                {EncryptedExtensions}
                                                           {Finished}
                                    <--------     [Application Data*]
          {Finished}                -------->
          [Application Data]        <------->      [Application Data]

               图 3：会话恢复与 PSK 的消息流
```

由于服务器经由 PSK 完成认证，它不再发送 `Certificate` 或 `CertificateVerify` 消息。客户端经由 PSK 请求恢复会话时，也应当同时提供 `key_share` 扩展，让服务器在需要时可以拒绝恢复、退回完整握手。服务器以 `pre_shared_key` 扩展响应，协商使用 PSK 密钥建立；也可以（如图 3 所示）同时以 `key_share` 扩展响应，进行 (EC)DHE 密钥建立，从而提供前向安全。

PSK 带外提供时，PSK 标识与配合该 PSK 使用的 KDF 哈希算法也必须一并供给。

> 注：使用带外供给的预共享秘密时，一个关键考量是密钥生成要有足够的熵（见 RFC 4086）。从密码或其他低熵来源派生共享秘密是不安全的：低熵秘密/口令会遭受基于 PSK binder 的字典攻击。规范中的 PSK 认证并非强口令认证密钥交换——即便配合 Diffie-Hellman 也不阻止能观察握手的攻击者对口令/预共享密钥做暴力破解。

## 0-RTT 数据（RFC 8446 第 2.3 节）

当客户端与服务器共享一个 PSK（外部获得，或来自之前的握手）时，TLS 1.3 允许客户端在**第一个飞行区**（first flight）就发送数据（"早期数据"，early data）。客户端用 PSK 认证服务器并加密早期数据。

如图 4 所示，0-RTT 数据只是附加在 1-RTT 握手的第一个飞行区中，其余握手与带 PSK 恢复的 1-RTT 握手使用相同的消息：

```
        Client                                               Server

        ClientHello
        + early_data
        + key_share*
        + psk_key_exchange_modes
        + pre_shared_key
        (Application Data*)     -------->
                                                        ServerHello
                                                   + pre_shared_key
                                                       + key_share*
                                              {EncryptedExtensions}
                                                      + early_data*
                                                         {Finished}
                                <--------       [Application Data*]
        (EndOfEarlyData)
        {Finished}              -------->
        [Application Data]      <------->        [Application Data]

               图 4：0-RTT 握手的消息流
```

（上图中 `()` 表示用 `client_early_traffic_secret` 派生密钥保护的消息。）0-RTT 以牺牲部分安全性质（如早期数据不具前向安全、可能被重放）换取更低延迟，规范对使用场景有严格限制；对调用 LLM API 的开发者而言，知道它的存在与取舍即可。

> 注：RFC 8446 第 2.1 节描述客户端密钥份额与服务器要求不匹配时的 `HelloRetryRequest` 修正流程，属于实现细节，本篇从略。

## 配置 TLS

选择合适的 TLS 服务器配置对连接安全影响很大，尤其它决定了将使用的 TLS 版本与密码算法。如果你需要配置自己的服务器，请参考 Mozilla 的 [TLS 推荐配置](https://wiki.mozilla.org/Security/Server_Side_TLS#Recommended_configurations)。Mozilla 还提供一个 [TLS 配置生成器](https://ssl-config.mozilla.org/)，能为大量 Web 服务器生成配置文件。

## 服务器认证

要支持服务器认证，你的网站必须持有**数字证书**（digital certificate），其中包含网站公钥（与私钥成对）的**数字签名**副本。这把网站的密钥与其域名绑定在一起，于是浏览器知道它连接的确实是例如 `https://example.com`——这正是 RFC 8446 握手中 `Certificate`/`CertificateVerify` 一对消息在 Web 世界里的现实形态。

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
- 协议全文：[RFC 8446（TLS 1.3）](https://www.rfc-editor.org/rfc/rfc8446)、[MDN：Transport Layer Security](https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security)

> 译注：把本篇与《HTTP》《TCP》连起来看：HTTPS = HTTP over TLS over TCP——TLS 夹在 HTTP（应用层）与 TCP（传输层）之间加密并认证流量（RFC 8446 也明言"TLS 对底层传输的唯一要求是可靠、按序的数据流"——正是第 22 篇《TCP》提供的东西）。对 LLM 应用开发者，这是一条硬性实践：**所有 API 流量（包括 SSE 流式响应）都必须走 HTTPS**，否则你的 API Key 与对话内容在链路上是明文；调用第三方 API 时也请确认 base URL 是 `https://` 开头。

---

> **来源**：本文由两部分合译而成——协议主体翻译自 IETF RFC 8446《The Transport Layer Security (TLS) Protocol Version 1.3》（[rfc-editor.org/rfc/rfc8446](https://www.rfc-editor.org/rfc/rfc8446)，作者 Eric Rescorla，依 IETF Trust Legal Provisions / BCP 78 的条款注明出处翻译；第 1 节、第 1.2 节、第 2 节、第 2.2 节、第 2.3 节完整译出，第 1.1、1.3、2.1 节为面向实现者的细节、从略并在文中注明）；Web 实践部分（TLS 握手概览、配置 TLS、服务器认证、混合内容、升级到 HTTPS）翻译自 MDN Web Docs《Transport Layer Security (TLS)》（[developer.mozilla.org](https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security)），作者 Mozilla 贡献者，许可 CC BY-SA 2.5。抓取于 2026-09-18。
