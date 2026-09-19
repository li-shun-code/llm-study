---
title: UDP：用户数据报协议
source_url: https://beej.us/guide/bgnet0/html/split/user-datagram-protocol-udp.html
author: Brian “Beej Jorgensen” Hall（Beej's Guide to Network Concepts）
license: CC BY-NC-ND 3.0（含官方翻译例外条款）
fetched_at: 2026-09-13
translated: true
order: 23
group: 计算机网络
---

如果你喜欢一切从简，又是个乐观主义者，UDP 就是为你准备的。它是互联网上近乎终极的轻量级数据传输。

你把 UDP 包发出去，然后**盼望**它们到达。也许到了，也许有人用挖掘机挖断了光缆、也许撞上了宇宙射线、也许某台路由器太拥挤（或太生气）就把它随手一丢。毫不客气。

这就是生活在互联网数据的最边缘！TCP 那些令人愉悦的可靠保证——统统没有！

## 15.1 UDP 的目标

- 提供一种从一台计算机向另一台计算机发送**无差错**数据的方式。

基本就这些。

以下**不是** UDP 的目标：

- 保证数据按序
- 保证数据不丢
- 保证数据不重复

需要这些的话，TCP 是更好的选择。UDP 对丢失或乱序的数据毫无保护。唯一的保证是：**如果**数据到达，它就是正确的。

但它给你的，是真正低的**开销**与快速的**响应**。它没有 TCP 那些包重组、流量控制、ACK 包等等杂七杂八的东西。因此它的头部小得多。

## 15.2 在网络协议栈中的位置

回忆网络分层的互联网模型：

| 层 | 职责 | 示例协议 |
|---|---|---|
| 应用 | 结构化的应用数据 | HTTP, FTP, TFTP, Telnet, SSH, SMTP, POP, IMAP |
| 传输 | 数据完整性、分包与重组 | TCP, UDP |
| 互联网 | 路由 | IP, IPv6, ICMP |
| 链路 | 物理层、线缆上的信号 | Ethernet, PPP, token ring |

UDP 位于**传输层**。它下面的 IP 负责路由，它上面的应用层尽情享用 UDP 提供的一切特性——并不多。

## 15.3 UDP 端口

UDP 与 TCP 一样使用端口。事实上，一个 TCP 程序与另一个 UDP 程序可以用**相同的端口号**。

IP 用 IP 地址标识主机。

但数据到了主机之后，是端口号让 OS 把数据交付给正确的进程。

打个比方：IP 地址像街道地址，端口号像这个街道地址里的门牌/房间号。

## 15.4 UDP 概览

UDP 是**无连接的**（connectionless）。你知道 TCP 是怎么把分组交换网络包装成"两台计算机间的可靠连接"的吗？UDP 不搞这套。

你把一个 UDP **数据报**（datagram）发往一个 IP 地址和端口；IP 把它路由过去，接收计算机把它交给绑定在该端口上的程序。

没有连接。一切以**单个包**为单位。

包到达时，接收方可以看出它来自哪个 IP 和端口——这样接收方就能回信。

## 15.5 数据完整性

可能出岔子的地方太多了：数据可能乱序到达、可能损坏、可能重复、也可能根本没到。

UDP 几乎没有任何应对这一切的机制。

确切地说，它只做一件事：**错误检测**。

### 15.5.1 错误检测

发送方发出包之前，为该包计算一个**校验和**（checksum）。

校验和的工作方式与 TCP 完全相同，只是用的是 UDP 头部。与 TCP 头部相比，UDP 头部简单得要命：

```
 0      7 8     15 16    23 24    31
+--------+--------+--------+--------+
|     Source      |   Destination   |
|      Port       |      Port       |
+--------+--------+--------+--------+
|                 |                 |
|     Length      |    Checksum     |
+--------+--------+--------+--------+
|
|          data octets ...
+---------------- ...
```

（源端口、目的端口、长度、校验和——四件事，共 8 字节。）

接收方收到包后，自己也算一遍校验和。

两个校验和一致，则认为数据无错；不一致，数据被丢弃。

就这样。接收方甚至**永远不知道**曾有数据奔它而来。它就这么消失在以太之中。

校验和是一个 16 位数：把全部 UDP 头部与载荷数据、以及相关的 IP 地址一起灌入一个摘要函数得到。这与 TCP 校验和的算法相同。（Jon Postel 写了 TCP 与 UDP 最早的 RFC，两者用同一算法毫不奇怪。）

## 15.6 不分片时的最大载荷

稍微超前一点，但值得知道：下层可能会把一个 UDP 包拆成更小的包——也许 UDP 包必须经过的某段网络只能传输特定大小的数据。

当 UDP 包被拆散到多个 IP 包里时，我们称之为"**分片**"（fragmentation）。

某条线路上能发送的最大包尺寸称为它的 **MTU**（最大传输单元，maximum transmission unit）。互联网（IPv4）上可能的最小 MTU 是 576 字节；最大的 IP 头部是 60 字节；UDP 头部是 8 字节。所以 576−60−8 = **508 字节**的载荷可以保证不被分片（走 VPN 的话可能更小，为简单起见我们忽略）。由于 IP 头部有时小于 60 字节，许多资料干脆说上限是 512 字节。

分片不好吗？有些路由器会丢弃被分片的 UDP 包。所以在 UDP 上保持低于最小 MTU 往往是好主意。

## 15.7 那有什么用？

既然 UDP 随处丢包，为什么还有人用它？

嗯，性能收益相当可观，这就是吸引力。

以下情形你会用 UDP：

1. **丢几个包无所谓**。传输语音、视频甚至游戏帧数据时，丢几包也许可以接受：画面卡一下、下一波包到了就继续。
   这是最常见的用法。多人高帧率游戏逐帧更新用它，而聊天消息、玩家物品变更等低带宽需求仍走 TCP。
2. **不能丢包，但可以在 UDP 之上自己实现协议**。TFTP（简单文件传输协议）就这么干：每个包里放一个序列号，等对端回一个 TFTP ACK 包再发下一个。它不快（发送方必须等 ACK 才能发下一包），但实现起来非常简单。
   这种用法较少见。TFTP 被无盘计算机使用：没装 OS 的机器启动时要从网络把操作系统拉下来，这就需要一个内建的微型网络栈——实现以太网/IP/UDP 栈比实现以太网/IP/TCP 栈容易太多了。
3. **想复用不同的数据"流"，又不想开多条 TCP 连接**。可以给每个 UDP 包打上标识符，到达后各回各的桶。
4. **可以提前处理**。也许第 3 个包还没到，你就可以开始处理第 4 个包了。
5. 等等。

## 15.8 UDP（数据报）套接字

UDP 套接字与 TCP 有一些差别：

- 不再调用 `listen()`、`connect()`、`accept()`、`send()`、`recv()`——因为根本没有"连接"。
- 发送 UDP 数据用 `sendto()`。
- 接收 UDP 数据用 `recvfrom()`。

### 15.8.1 服务器流程

服务器的一般流程：创建一个 `SOCK_DGRAM` 类型的新套接字（数据报/UDP 套接字；此前我们用的默认值 `SOCK_STREAM` 是 TCP 套接字）。然后调用 `bind()` 绑定到一个端口——客户端将向这个端口发包。之后服务器就可以循环收数据、发响应了。

收到数据时，`recvfrom()` 会返回数据的来源主机与端口，可用于把数据发回去：

```python
# UDP Server

import sys
import socket

# Parse command line
try:
    port = int(sys.argv[1])
except:
    print("usage: udpserver.py port", file=sys.stderr)
    sys.exit(1)

# Make new UDP (datagram) socket
s = socket.socket(type=socket.SOCK_DGRAM)

# Bind to a port
s.bind(("", port))

# Loop receiving data
while True:
    # Get data
    data, sender = s.recvfrom(4096)
    print(f"Got data from {sender[0]}:{sender[1]}: \"{data.decode()}\"")

    # Send a reply back to the original sender
    s.sendto(f"Got your {len(data)} byte(s) of data!".encode(), sender)
```

### 15.8.2 客户端流程

与服务器流程基本相同，只是不需要 `bind()` 到特定端口——第一次调用 `sendto()` 时让 OS 替它选一个绑定端口。

记住：UDP 不可靠，数据有可能不到达！没到就再试一次。（不过在 localhost 上几乎必然能到。）

与上面服务器通信的示例客户端：

```python
# UDP Client

import socket
import sys

# Parse command line
try:
    server = sys.argv[1]
    port = int(sys.argv[2])
    message = sys.argv[3]
except:
    print("usage: udpclient.py server port message", file=sys.stderr)
    sys.exit(1)

# Make new UDP (datagram) socket
s = socket.socket(type=socket.SOCK_DGRAM)

# Send data to the server
print("Sending message...")
s.sendto(message.encode(), (server, port))

# Wait for a reply
data, sender = s.recvfrom(4096)
print(f"Got reply: \"{data.decode()}\"")

s.close()
```

## 15.9 思考题

- 在投递保证方面，TCP 提供了哪些 UDP 没有的东西？
- 为什么人们建议保持 UDP 包的小尺寸？
- 为什么 UDP 头部比 TCP 头部小那么多？
- `sendto()` 要求你指定目的 IP 和端口；为什么面向 TCP 的 `send()` 不需要这些参数？
- UDP 相对不可靠，为什么人们还是用它而不是 TCP？

> 译注：与 DNS（《DNS：域名系统》）对照阅读效果最佳——一次 DNS 查询就是一个小 UDP 包的事，丢了就重问；而 QUIC（HTTP/3 的底层）则是"在 UDP 上重建可靠性与拥塞控制"的当代典范，恰好呼应本文 15.7 的第 2 条。

---

> **来源**：本文翻译自 [Beej's Guide to Network Concepts](https://beej.us/guide/bgnet0/html/split/user-datagram-protocol-udp.html) 第 15 章 "User Datagram Protocol (UDP)"，作者 Brian "Beej Jorgensen" Hall，许可 CC BY-NC-ND 3.0（作者在许可中明确允许对本指南进行忠实翻译，但要求转载指南全文；本译文为署名学习用途的翻译，特此说明并致谢）。抓取于 2026-09-13。
