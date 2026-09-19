---
title: I/O 多路复用：阻塞、poll() 与 select()
source_url: https://beej.us/guide/bgnet/html/split/slightly-advanced-techniques.html
author: Brian “Beej Jorgensen” Hall（Beej's Guide to Network Programming）
license: CC BY-NC-ND 3.0（含官方翻译例外条款）
fetched_at: 2026-09-13
translated: true
order: 18
group: I/O 多路复用与事件循环
---
这些技巧并不真的"高级"，但已经超出了此前的基础内容。事实上，读到这里的你已经可以认为自己对 Unix 网络编程的基础相当有造诣了！恭喜！

（以下三节译自 Beej's Guide to Network Programming 第 7 章的 7.1、7.2、7.3 三节，小节编号已按本站惯例省去。）

## 阻塞（Blocking）

阻塞。你听说过它——但它到底是什么？简而言之，"block"（阻塞）是"睡觉"（sleep）的技术行话。你可能注意过，运行 `listener` 程序时它就那么杵着，直到有数据包到来。发生了什么？它调用了 `recvfrom()`，当时没有数据，于是 `recvfrom()` 就"阻塞"（也就是睡在那里），直到有数据到来。

很多函数都会阻塞。`accept()` 阻塞；所有 `recv()` 系函数都阻塞。它们能这么做是因为被允许这么做：当你最初用 `socket()` 创建套接字描述符时，内核把它设为阻塞模式。如果不想要阻塞套接字，就得调用 `fcntl()`：

```c
#include <unistd.h>
#include <fcntl.h>
.
.
.
sockfd = socket(PF_INET, SOCK_STREAM, 0);
fcntl(sockfd, F_SETFL, O_NONBLOCK);
.
.
.
```

把套接字设为非阻塞后，你就可以有效地"轮询"（poll）套接字上的信息：读一个非阻塞套接字且无数据时，它不被允许阻塞——而是返回 `-1`，并把 `errno` 设为 `EAGAIN` 或 `EWOULDBLOCK`。

（等等，返回 `EAGAIN` **或** `EWOULDBLOCK`？到底该检查哪个？规范并没有规定你的系统会返回哪个，所以为了可移植性，两个都查。）

不过一般来说，这种轮询是**坏主意**。如果你的程序进入忙碌等待（busy-wait）、盯着套接字找数据，CPU 时间会被你挥霍得一干二净。检查"是否有数据可读"的更优雅方案，就是下一节的 `poll()`。

## poll()——同步 I/O 多路复用

你真正想要的能力是：**同时监视一堆套接字**，然后处理其中就绪的那些。这样就不用没完没了地轮询所有套接字看谁能读了。

> 一句警告：面对海量连接时 `poll()` 慢得可怕。那种场景下，用 [libevent](https://libevent.org/) 这类事件库能获得更好性能——它们会尝试使用系统上可用的最快方法。

怎么才能不轮询？略带讽刺地，答案恰是用 `poll()` 系统调用来避免轮询。简言之：我们让操作系统替我们干所有脏活，只在"哪个套接字上有数据可读了"的时候告诉我们。与此同时，我们的进程可以去睡觉，节省系统资源。

总体方案：维护一个 `struct pollfd` 数组，记录我们要监视哪些套接字描述符、监视哪类事件。OS 会阻塞在 `poll()` 调用上，直到其中某个事件发生（比如"套接字可读了！"）或用户指定的超时到期。

很有用的一点：处于 `listen()` 状态的套接字，会在有新连接等待 `accept()` 时返回"可读"。

废话说够，怎么用？

```c
#include <poll.h>

int poll(struct pollfd fds[], nfds_t nfds, int timeout);
```

`fds` 是信息数组（监视哪些套接字的哪些事件），`nfds` 是数组元素个数，`timeout` 是以毫秒计的超时。返回值为**发生了事件的数组元素个数**。看看这个结构：

```c
struct pollfd {
    int fd;         // 套接字描述符
    short events;   // 我们关心的事件位图
    short revents;  // 返回时：已发生事件的位图
};
```

我们准备一个这样的数组，把每个元素的 `fd` 设为要监视的套接字描述符，把 `events` 设为关心的事件类型。`events` 字段是下面这些宏的按位或：

| 宏 | 描述 |
|---|---|
| `POLLIN` | 此套接字上有数据可 `recv()` 时提醒我。 |
| `POLLOUT` | 我可以向此套接字 `send()` 数据而不阻塞时提醒我。 |
| `POLLHUP` | 远端关闭连接时提醒我。 |

把 `struct pollfd` 数组整理好后传给 `poll()`，同时传数组大小与毫秒超时值（超时给负数表示永远等待）。`poll()` 返回后，检查 `revents` 字段，看 `POLLIN` 或 `POLLOUT` 是否置位，即对应事件是否发生。（`poll()` 能做的还有更多，详见其 man 手册页。）

一个示例：等 2.5 秒，看标准输入上是否有数据可读（也就是你按了 RETURN）：

```c
#include <stdio.h>
#include <poll.h>

int main(void)
{
    struct pollfd pfds[1]; // 想监视更多就多放几个

    pfds[0].fd = 0;          // 标准输入
    pfds[0].events = POLLIN; // 可读时告诉我

    // 如果还要监视别的，比如：
    //pfds[1].fd = some_socket; // 某个套接字描述符
    //pfds[1].events = POLLIN;  // 可读时告诉我

    printf("Hit RETURN or wait 2.5 seconds for timeout\n");

    int num_events = poll(pfds, 1, 2500); // 2.5 秒超时

    if (num_events == 0) {
        printf("Poll timed out!\n");
    } else {
        int pollin_happened = pfds[0].revents & POLLIN;

        if (pollin_happened) {
            printf("File descriptor %d is ready to read\n",
                    pfds[0].fd);
        } else {
            printf("Unexpected event occurred: %d\n",
                    pfds[0].revents);
        }
    }

    return 0;
}
```

再次注意：`poll()` 返回的是 `pfds` 数组中**发生了事件的元素个数**。它不告诉你是**哪些**元素（还得自己扫），但告诉你有多少条目的 `revents` 非零（找到这么多就可以停止扫描了）。

几个常见问题。如何向传给 `poll()` 的集合里**添加**新的文件描述符？确保数组留足空间，或按需 `realloc()` 即可。如何**删除**？把数组最后一个元素复制到被删位置、然后把传给 `poll()` 的个数减一；另一个办法是把任意 `fd` 字段设为负数，`poll()` 会忽略它。

### 综合示例：聊天服务器

如何把这些组合成一个可以 `telnet` 上去的聊天服务器？方案：启动一个监听套接字、加入 `poll()` 的描述符集合（有新连接进来时它会显示"可读"）；新连接加入 `struct pollfd` 数组，空间不足就动态扩容；连接关闭时从数组移除；某个连接可读时读出数据、转发给所有其他连接——让大家看到彼此的输入。

这就是 [pollserver.c](https://beej.us/guide/bgnet/source/examples/pollserver.c)（"一个廉价的多人聊天服务器"，完整源码见链接）。在一个窗口运行它，再从若干终端窗口 `telnet localhost 9034`，你在某个窗口输入的内容（按 RETURN 后）会出现在其他窗口里；用 `CTRL-]` 加 `quit` 退出 telnet 时，服务器会检测到断开并把你从描述符数组中移除。其主循环结构如下：

```c
int main(void)
{
    int listener;     // 监听套接字描述符

    // 先给 5 个连接留位置（必要时 realloc 扩容）
    int fd_size = 5;
    int fd_count = 0;
    struct pollfd *pfds = malloc(sizeof *pfds * fd_size);

    // 建立并取得监听套接字
    listener = get_listener_socket();

    // 把监听套接字加入集合；有新连接时报告可读
    pfds[0].fd = listener;
    pfds[0].events = POLLIN;

    fd_count = 1; // 监听者占一个

    puts("pollserver: waiting for connections...");

    // 主循环
    for(;;) {
        int poll_count = poll(pfds, fd_count, -1);

        if (poll_count == -1) {
            perror("poll");
            exit(1);
        }

        // 遍历连接，找可读数据
        process_connections(listener, &fd_count, &fd_size, &pfds);
    }

    free(pfds);
}
```

其中 `process_connections()` 遍历数组、检查 `revents & (POLLIN | POLLHUP)`：是监听套接字就 `accept()` 新连接并加入集合；是普通客户端就 `recv()`，收到 0 字节视为挂断（关闭并从数组移除），否则把数据 `send()` 给除监听者与发送者之外的所有连接。

下一节介绍一个类似的、更老派的函数 `select()`。`select()` 与 `poll()` 的功能与性能相仿，真正的区别在使用方式：`select()` 可移植性稍强，但用起来略显笨拙。挑你喜欢的用——只要你的系统支持。

## select()——老派的同步 I/O 多路复用

这个函数有点怪，但非常有用。设想如下场景：你是服务器，既要监听新连接，又要继续从已有连接读数据。你说：没问题，一个 `accept()` 加几个 `recv()` 而已。别急，伙计！如果你正阻塞在 `accept()` 调用上，怎么同时 `recv()` 数据？"用非阻塞套接字！"——不行！你不想成为 CPU 霸王龙。那怎么办？

`select()` 赋予你**同时监视多个套接字**的能力。它会告诉你哪些可读、哪些可写、哪些产生了异常——如果你真想知道的话。

> 一句警告：`select()` 虽然可移植性极好，面对海量连接时慢得可怕。那种场景下，[libevent](https://libevent.org/) 之类事件库会有更好的性能——它们会尝试用系统上可用的最快方法。

废话不多，上函数原型：

```c
#include <sys/time.h>
#include <sys/types.h>
#include <unistd.h>

int select(int numfds, fd_set *readfds, fd_set *writefds,
           fd_set *exceptfds, struct timeval *timeout);
```

该函数监视文件描述符的"集合"：`readfds`、`writefds`、`exceptfds` 三组。想看能否从标准输入和某个套接字描述符 `sockfd` 读数据？把描述符 `0` 和 `sockfd` 加进 `readfds` 即可。参数 `numfds` 应设为**最高**文件描述符值加一——本例即 `sockfd+1`（它肯定比标准输入的 0 高）。

`select()` 返回时，`readfds` 已被修改，反映哪些被选择的描述符可读了；用 `FD_ISSET()` 宏测试它们。

操作集合的类型是 `fd_set`，以下宏作用于它：

| 函数 | 描述 |
|---|---|
| `FD_SET(int fd, fd_set *set);` | 把 `fd` 加入 `set`。 |
| `FD_CLR(int fd, fd_set *set);` | 把 `fd` 从 `set` 移除。 |
| `FD_ISSET(int fd, fd_set *set);` | `fd` 在 `set` 中则返回真。 |
| `FD_ZERO(fd_set *set);` | 清空 `set`。 |

最后说说这个怪怪的 `struct timeval`：有时你不想永远等别人发数据——也许每 96 秒想往终端打一行 "Still Going…"，哪怕啥也没发生。这个时间结构允许你指定超时；时间用尽而 `select()` 仍未发现就绪描述符时，它就返回让你继续处理。

```c
struct timeval {
    int tv_sec;     // 秒
    int tv_usec;    // 微秒
};
```

把 `tv_sec` 设为要等的秒数、`tv_usec` 设为微秒数。对，是**微**秒不是毫秒：1 毫秒 1000 微秒、1 秒 1000 毫秒，即 1 秒 1,000,000 微秒。为什么叫 "usec"？那个 "u" 长得像希腊字母 μ（Mu，micro 的缩写符号）。另外，函数返回时 `timeout` **可能**被更新为剩余时间——取决于你跑的是哪种 Unix 变体。

耶！我们有微秒分辨率的定时器了！——别指望。无论把 `struct timeval` 设得多小，你可能都得等上标准 Unix 时间片的一部分。

还有几件事：把 `struct timeval` 的字段全设为 `0`，`select()` 会立即超时返回——等于对所有集合里的描述符做一次轮询。把 `timeout` 参数设为 `NULL`，它永不超时，一直等到第一个描述符就绪。若不关心某一组，把对应集合参数设为 `NULL` 即可。

一个等待标准输入出现数据的代码片段（等 2.5 秒）：

```c
/*
** select.c -- select() 演示
*/

#include <stdio.h>
#include <sys/time.h>
#include <sys/types.h>
#include <unistd.h>

#define STDIN 0  // 标准输入的文件描述符

int main(void)
{
    struct timeval tv;
    fd_set readfds;

    tv.tv_sec = 2;
    tv.tv_usec = 500000;

    FD_ZERO(&readfds);
    FD_SET(STDIN, &readfds);

    // 不关心 writefds 和 exceptfds：
    select(STDIN+1, &readfds, NULL, NULL, &tv);

    if (FD_ISSET(STDIN, &readfds))
        printf("A key was pressed!\n");
    else
        printf("Timed out.\n");

    return 0;
}
```

在行缓冲终端上，你按的得是 RETURN，否则照样超时。

有人可能觉得这是等待数据报套接字上数据的好办法——**可能**是。有些 Unix 能这么用，有些不能；想这么干的话查查本地手册页怎么说。有些 Unix 会把 `struct timeval` 里剩余的时间写回去，有些不会；想要可移植就别依赖它（需要计时用 `gettimeofday()`——很遗憾，但就是这么回事）。

如果读集合里的某个套接字**关闭了连接**会怎样？此时 `select()` 返回、该描述符标为"可读"；你实际对它 `recv()` 时会返回 `0`——由此得知客户端已关闭连接。

关于 `select()` 最后一条：如果有一个处于 `listen()` 状态的套接字，把它的描述符放进 `readfds` 集合，就能检查是否有新连接到来。

这便是对全能的 `select()` 函数的快速概览。应广大读者要求，原指南随后还给出了一个深入示例——[selectserver.c](https://beej.us/guide/bgnet/source/examples/selectserver.c)，一个简单的多人聊天服务器，运行后从多个窗口 telnet 到它（`telnet hostname 9034`），在任意会话里输入的内容会出现在所有其他会话中；其结构与上面的 pollserver 相同：监听套接字与已连接套接字都加入 `readfds`，`select()` 返回后用 `FD_ISSET()` 分流处理新连接与数据转发。

> **译注：epoll 与现代方案**
> 原指南写于 `poll()`/`select()` 时代，两者都要"每次调用把整个描述符集合从用户态拷进内核、返回后又逐个扫描"，连接数巨大时代价随之线性增长（文中两处"海量连接时慢得可怕"的警告正源于此）。Linux 上的 **epoll**（`epoll_create`/`epoll_ctl`/`epoll_wait`）把描述符登记在内核中、只返回就绪者，使监视成本与活跃连接数而非总连接数相关，是 Nginx、Redis 等高并发服务器的基石；macOS/BSD 对应 kqueue，Windows 对应 IOCP。工程实践中通常直接使用 libevent、libuv 这类事件库（文中亦两次推荐），由它们在底层选择系统支持的最快机制——而理解 `poll()`/`select()`，是理解这一切的起点。

## 编者补充

> 本节为站点编者补充，串联前后篇目与 LLM 应用场景，非原文翻译。

- **LLM 流式服务把"多路复用"变成了刚需**：一次对话回答就是一条 SSE 长连接、逐 token 推送，动辄持续数十秒。一个百并发推理网关意味着上百个同时打开的文件描述符——用"一线程一连接"的阻塞模型要么耗尽线程，要么靠本文的 `poll()`/`select()`（或下一篇的 epoll）把所有连接交给一个事件循环。FastAPI/uvicorn 异步模式、Node.js 的高并发能力，底座都是这套机制。
- **文件描述符视角串起本组**：上一篇《文件系统》说"打开文件得到描述符"，本文说"套接字也是描述符、监听套接字可读 = 有新连接"——在 Unix 里一切 I/O 资源都被抽象成描述符，`select()`/`poll()`/`epoll` 因而能一视同仁地监视文件、管道、套接字（还可跨进程传递，见《信号与 IPC》）。
- **阻塞 vs 非阻塞的选择题**：正文 `EAGAIN` 一节是 asyncio 的种子——非阻塞 I/O 把"等数据"变成"稍后再来"，事件循环因此能在等待间隙处理其他任务；下一篇《epoll 与事件循环》给出 Linux 上的最终答案。

---

> **来源**：本文翻译自 [Beej's Guide to Network Programming](https://beej.us/guide/bgnet/html/split/slightly-advanced-techniques.html) 第 7 章（7.1 Blocking、7.2 poll()、7.3 select() 三节），作者 Brian "Beej Jorgensen" Hall，许可 CC BY-NC-ND 3.0（作者在许可中明确允许对本指南进行忠实翻译，但要求转载指南全文；本译文为署名学习用途的节译，特此说明并致谢）。抓取于 2026-09-13。
