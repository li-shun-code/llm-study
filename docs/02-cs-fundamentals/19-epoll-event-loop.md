---
title: epoll 与事件循环
source_url: https://man7.org/linux/man-pages/man7/epoll.7.html
author: Davide Libenzi、Michael Kerrisk（Linux man-pages：epoll(7)、epoll_ctl(2)、epoll_wait(2)、epoll_create(2)；引言节译自 Beej's Guide to Network Concepts §29.1）
license: GPL-2.0-or-later（man-pages）
fetched_at: 2026-09-13
translated: true
order: 19
---

上一篇 I/O 多路复用讲了 `select()` 与 `poll()`：一条线程盯住一堆文件描述符，谁就绪就处理谁。但 select/poll 每次调用都要把整个描述符集合从用户空间拷进内核、内核再线性扫描一遍——连接数一多就吃不消。这一篇讲 Linux 对这个问题的正解：epoll。本文完整翻译 man-pages 的 epoll(7)、epoll_ctl(2)、epoll_wait(2)、epoll_create(2) 文档核心内容。

## 我们要解决的问题（译自 Beej's Guide to Network Concepts §29.1）

假设服务器连着三个客户端，它想从"下一个发来数据的客户端"那里 `recv()` 数据。

但服务器没法知道下一个发数据的会是哪个客户端。

而且，当服务器对一个没有数据可读的套接字调用 `recv()` 时，`recv()` 会阻塞，其他任何事都做不了。

所谓阻塞，指进程会停在这里睡过去，直到某个条件满足。对 `recv()` 而言，就是睡到有数据可收为止。

于是我们有了这样的问题：如果我们这样写：

```
data1 = s1.recv(4096)
data2 = s2.recv(4096)
data3 = s3.recv(4096)
```

而 s1 上没有数据就绪，进程就会卡在第一行，哪怕 s2、s3 上有数据也轮不到它们的 recv() 被调用。

我们需要一种办法同时监视 s1、s2、s3，判定哪些有数据可收，然后只对那些套接字调用 recv()。

select() 就是干这个的：对一组套接字调用 select() 会阻塞，直到其中一个或多个套接字变为可读；然后它告诉你哪些套接字就绪了，你只对那些套接字调用 recv() 即可。

epoll 解决的是同一个问题，但用的是完全不同的机制。

## epoll API（译自 epoll(7)）

epoll API 执行与 poll(2) 类似的任务：监视多个文件描述符，看其中哪个可以进行 I/O。epoll API 既可以作为边沿触发（edge-triggered），也可以作为电平触发（level-triggered）的接口使用，并且能良好扩展到大量被监视的文件描述符。

epoll API 的核心概念是 **epoll 实例**（epoll instance）——一个内核中的数据结构。从用户空间的角度看，它可以视为两个列表的容器：

- **兴趣列表**（interest list，有时也叫 epoll set）：进程注册了"感兴趣要监视"的文件描述符的集合。
- **就绪列表**（ready list）：已经"就绪"可进行 I/O 的文件描述符集合。就绪列表是兴趣列表的子集（更准确地说，是兴趣列表中那些文件描述符的一组引用）。就绪列表由内核根据这些文件描述符上的 I/O 活动动态填充。

创建与管理 epoll 实例提供以下系统调用：

- `epoll_create(2)` 创建一个新的 epoll 实例，返回一个指向该实例的文件描述符。（较新的 `epoll_create1(2)` 扩展了 epoll_create(2) 的功能。）
- 然后通过 `epoll_ctl(2)` 注册对特定文件描述符的兴趣，即向 epoll 实例的兴趣列表添加条目。
- `epoll_wait(2)` 等待 I/O 事件；当前没有事件可用时阻塞调用线程。（这个系统调用可以理解为从 epoll 实例的就绪列表中取条目。）

### 创建：epoll_create()（译自 epoll_create(2)）

`epoll_create()` 创建一个新的 epoll(7) 实例。自 Linux 2.6.8 起，size 参数被忽略，但必须大于零（见 HISTORY）。

epoll_create() 返回一个指向新 epoll 实例的文件描述符。这个文件描述符用于后续所有对 epoll 接口的调用。不再需要时，应当用 close(2) 关闭 epoll_create() 返回的文件描述符。当指向某个 epoll 实例的所有文件描述符都被关闭后，内核销毁该实例并释放相关资源供复用。

`epoll_create1()`：若 flags 为 0，则除了废弃的 size 参数被去掉之外，epoll_create1() 与 epoll_create() 相同。flags 可以包含以下值以获得不同行为：

- `EPOLL_CLOEXEC`：在新文件描述符上设置 close-on-exec（FD_CLOEXEC）标志。（为何这可能有用，见 open(2) 中 O_CLOEXEC 标志的说明。）

成功时这两个系统调用返回一个文件描述符（非负整数）；出错返回 -1 并设置 errno 以指示错误。可能的错误：EINVAL（size 不为正；或 epoll_create1() 的 flags 值无效）、EMFILE（达到进程可打开文件描述符数上限）、ENFILE（达到系统级打开文件总数上限）、ENOMEM（内存不足，无法创建内核对象）。

### 注册：epoll_ctl()（译自 epoll_ctl(2)）

这个系统调用用于向 epfd 所指的 epoll(7) 实例的**兴趣列表**添加、修改或删除条目。它请求对目标文件描述符 fd 执行操作 op。op 的合法取值：

- `EPOLL_CTL_ADD`：向 epoll 文件描述符 epfd 的兴趣列表添加一个条目。条目包括文件描述符 fd、对相应打开文件描述（open file description，见 epoll(7) 与 open(2)）的引用，以及 event 中指定的设置。
- `EPOLL_CTL_MOD`：把兴趣列表中与 fd 关联的设置改为 event 中指定的新设置。
- `EPOLL_CTL_DEL`：把目标文件描述符 fd 从兴趣列表移除（注销）。event 参数被忽略、可以为 NULL（但见 BUGS 一节）。

`event` 参数描述链接到文件描述符 fd 的对象。`epoll_event` 结构的 `data` 成员指定内核应保存、并在该文件描述符就绪时经 epoll_wait(2) 返回的数据。

`events` 成员是一个位掩码，由零个或多个**事件类型**（epoll_wait(2) 会返回它们）与**输入标志**（影响行为但不返回）按位或组成。可用的事件类型：

- `EPOLLIN`：关联文件可进行 read(2) 操作。
- `EPOLLOUT`：关联文件可进行 write(2) 操作。
- `EPOLLRDHUP`（Linux 2.6.17 起）：流式套接字对端关闭连接、或关闭了写半边。（用边沿触发监视时，这个标志对编写检测对端关闭的简单代码尤其有用。）
- `EPOLLPRI`：文件描述符上有异常条件（见 poll(2) 中 POLLPRI 的讨论）。
- `EPOLLERR`：关联文件描述符上发生错误条件。管道读端被关闭时，写端也会报告此事件。epoll_wait(2) 总是会报告此事件——调用 epoll_ctl() 时无需在 events 里设置它。
- `EPOLLHUP`：关联文件描述符上发生挂断。epoll_wait(2) 总是会等待此事件——调用 epoll_ctl() 时也无需设置它。注意：从管道或流式套接字这类通道读取时，此事件只表示对端关闭了自己那一端；通道中已排队的数据全部消费完之后，后续的读才会返回 0（文件结束）。

可用的输入标志：

- `EPOLLET`：对关联文件描述符请求**边沿触发**通知。epoll 的默认行为是电平触发（详见 epoll(7) 关于两者的更多信息）。
- `EPOLLONESHOT`（Linux 2.6.2 起）：请求"一次性"通知——事件经 epoll_wait(2) 报告后，该文件描述符被自动禁用；需要用 epoll_ctl() 以 EPOLL_CTL_MOD 重新武装（rearm）。

### 等待：epoll_wait()（译自 epoll_wait(2)）

`epoll_wait()` 系统调用在 epfd 所指的 epoll(7) 实例上等待事件。events 指向的缓冲区用来从**就绪列表**返回兴趣列表中有事件可用的文件描述符的信息。最多返回 n 个——n 参数必须大于零。

`timeout` 参数指定 epoll_wait() 阻塞的毫秒数，时间按 CLOCK_MONOTONIC 时钟度量。对 epoll_wait() 的调用会阻塞，直到：

- 某个文件描述符投递了事件；
- 调用被信号处理器打断；
- 超时到期。

注意超时区间会被向上取整到系统时钟粒度，且内核调度延迟意味着阻塞区间可能略微超时。timeout 为 -1 表示无限期阻塞；timeout 为 0 表示即使没有事件也立即返回。

每个返回的 epoll_event 结构的 `data` 字段，就是最近一次对该文件描述符调用 epoll_ctl(2)（EPOLL_CTL_ADD、EPOLL_CTL_MOD）时指定的那份数据。`events` 字段是位掩码，指示相应打开文件描述上已发生的事件（可能出现的位见 epoll_ctl(2) 的清单）。

`epoll_pwait()`：epoll_wait() 与 epoll_pwait() 的关系，类似 select(2) 与 pselect(2) 的关系：像 pselect(2) 一样，epoll_pwait() 让应用可以安全地等待"文件描述符就绪"或"捕获到信号"二者之一。调用 `epoll_pwait(epfd, &events, n, timeout, &sigmask)` 等价于原子地执行：用 pthread_sigmask 把信号掩码换成 sigmask → 调 epoll_wait → 再恢复原掩码。sigmask 为 NULL 时，epoll_pwait() 等价于 epoll_wait()。`epoll_pwait2()` 与 epoll_pwait() 等价，只是超时参数改用 timespec 类型、可指定纳秒级精度；timeout 为 NULL 时可无限期阻塞。

## 电平触发与边沿触发（译自 epoll(7)）

epoll 的事件分发接口既能表现为**边沿触发**（ET），也能表现为**电平触发**（LT）。两种机制的差别可以这样描述。假设发生如下场景：

1. 代表管道读端的文件描述符（rfd）注册到 epoll 实例上。
2. 管道写端写入了 2 kB 数据。
3. 调用 `epoll_wait(2)`，返回 rfd 作为就绪文件描述符。
4. 管道读者从 rfd 读了 1 kB 数据。
5. 再次调用 `epoll_wait(2)`。

如果 rfd 是带着 `EPOLLET`（边沿触发）标志加入 epoll 接口的，那么第 5 步的 epoll_wait(2) 调用**可能会挂起**，尽管文件输入缓冲区里明明还有数据；与此同时，对端可能正等着基于它已发出的数据得到响应。原因在于：边沿触发模式只在被监视文件描述符**发生变化**时投递事件——每收到一块数据就生成一个事件。于是在第 5 步，调用方可能在等一些其实已经在输入缓冲区里的数据。上面的例子中，rfd 上的事件由第 2 步的写入产生，并在第 3 步被消费；由于第 4 步的读取没有消费完缓冲区的全部数据，第 5 步的 epoll_wait(2) 可能无限期阻塞。

使用 EPOLLET 标志的应用应当使用**非阻塞文件描述符**，避免一次阻塞的 read 或 write 让处理多个文件描述符的任务饿死。把 epoll 用作边沿触发（EPOLLET）接口的建议方式：

1. 使用非阻塞文件描述符；并且
2. 只在 read(2) 或 write(2) 返回 EAGAIN 之后才去等待事件。

相比之下，把 epoll 用作电平触发接口（默认，即不指定 EPOLLET 时），epoll 就只是一个**更快的 poll(2)**——凡是用 poll(2) 的地方都可以用它，因为语义相同。

由于即使用边沿触发的 epoll，收到多块数据时也可能生成多个事件，调用方可以指定 `EPOLLONESHOT` 标志，告诉 epoll 在 epoll_wait(2) 收到一个事件后禁用相关文件描述符。指定 EPOLLONESHOT 后，调用方有责任用 epoll_ctl(2) 的 EPOLL_CTL_MOD 重新武装该文件描述符。

如果多个线程（或进程——若子进程经 fork(2) 继承了 epoll 文件描述符）都阻塞在同一个 epoll 文件描述符的 epoll_wait(2) 上，而兴趣列表中一个标记为边沿触发（EPOLLET）通知的文件描述符变为就绪，那么这些线程（进程）中**只有一个**会从 epoll_wait(2) 中醒来。这在某些场景下避免了"惊群"（thundering herd）式唤醒，是个有用的优化。

### 与 autosleep 的交互

若系统经 /sys/power/autosleep 处于 autosleep 模式，某个把设备从睡眠中唤醒的事件发生时，设备驱动只在事件入队前保持设备清醒。要让设备保持清醒直到事件被处理完，需要用 epoll_ctl(2) 的 `EPOLLWAKEUP` 标志。在 struct epoll_event 的 events 字段设置 EPOLLWAKEUP 后，系统从事件入队那一刻起保持清醒，贯穿返回该事件的 epoll_wait(2) 调用，直到下一次 epoll_wait(2) 调用。若事件需要在此之后仍保持系统清醒，则应在第二次 epoll_wait(2) 调用前另行获取 wake_lock。

### /proc 接口

以下接口可用于限制 epoll 消耗的内核内存量：`/proc/sys/fs/epoll/max_user_watches`（Linux 2.6.28 起）——限定一个用户在系统上所有 epoll 实例中能注册的文件描述符总数。该限制按真实用户 ID 计。每个已注册文件描述符在 32 位内核上约耗 90 字节，64 位内核上约 160 字节。当前 max_user_watches 的默认值为可用低端内存的 1/25（4%）除以注册字节成本。

## 建议用法的示例（译自 epoll(7)）

把 epoll 用作电平触发接口时，语义与 poll(2) 相同；而边沿触发的用法需要更多澄清，以免应用的事件循环停摆。本例中，listener 是一个已对其调用过 listen(2) 的非阻塞套接字。函数 `do_use_fd()` 使用新的就绪文件描述符，直到 read(2) 或 write(2) 返回 EAGAIN。事件驱动的状态机应用在收到 EAGAIN 后，应记录自己的当前状态，以便下一次调用 do_use_fd() 时从上次停下的地方继续 read(2) 或 write(2)。

```c
#define MAX_EVENTS 10
struct epoll_event ev, events[MAX_EVENTS];
int listen_sock, conn_sock, nfds, epollfd;

/* 建立监听套接字 listen_sock 的代码
   (socket(), bind(), listen()) 在此省略。 */

epollfd = epoll_create1(0);
if (epollfd == -1) {
    perror("epoll_create1");
    exit(EXIT_FAILURE);
}

ev.events = EPOLLIN;
ev.data.fd = listen_sock;
if (epoll_ctl(epollfd, EPOLL_CTL_ADD, listen_sock, &ev) == -1) {
    perror("epoll_ctl: listen_sock");
    exit(EXIT_FAILURE);
}

for (;;) {
    nfds = epoll_wait(epollfd, events, MAX_EVENTS, -1);
    if (nfds == -1) {
        perror("epoll_wait");
        exit(EXIT_FAILURE);
    }

    for (n = 0; n < nfds; ++n) {
        if (events[n].data.fd == listen_sock) {
            conn_sock = accept(listen_sock,
                               (struct sockaddr *) &addr, &addrlen);
            if (conn_sock == -1) {
                perror("accept");
                exit(EXIT_FAILURE);
            }
            setnonblocking(conn_sock);
            ev.events = EPOLLIN | EPOLLET;
            ev.data.fd = conn_sock;
            if (epoll_ctl(epollfd, EPOLL_CTL_ADD, conn_sock,
                        &ev) == -1) {
                perror("epoll_ctl: conn_sock");
                exit(EXIT_FAILURE);
            }
        } else {
            do_use_fd(events[n].data.fd);
        }
    }
}
```

用作边沿触发接口时，出于性能考虑，可以在把文件描述符加入 epoll 接口（EPOLL_CTL_ADD）时一次性指定 `(EPOLLIN|EPOLLOUT)`。这样就能避免反复在 EPOLLIN 与 EPOLLOUT 之间切换、不断以 EPOLL_CTL_MOD 调用 epoll_ctl(2)。

## 问答（译自 epoll(7) Questions and answers）

- **区分兴趣列表中各文件描述符的键是什么？**
  键是文件描述符编号与打开文件描述（open file description，又称 "open file handle"，内核对打开文件的内部表示）的组合。

- **把同一个文件描述符在同一个 epoll 实例上注册两次会怎样？**
  你很可能会得到 EEXIST。不过，把一个**复制**出来的（dup(2)、dup2(2)、fcntl(2) F_DUPFD）文件描述符加进同一个 epoll 实例是可能的。若复制的描述符注册了不同的事件掩码，这可以作为过滤事件的有用技巧。

- **两个 epoll 实例能等待同一个文件描述符吗？若能，事件会报告给两个 epoll 文件描述符吗？**
  能，事件会报告给两者。但要正确做到这一点，需要小心的编程。

- **epoll 文件描述符本身可以被 poll/epoll/select 吗？**
  可以。若某个 epoll 文件描述符上有事件在等待，它会表现为可读。

- **把一个 epoll 文件描述符放进它自己的描述符集合会怎样？**
  epoll_ctl(2) 调用失败（EINVAL）。不过你可以把一个 epoll 文件描述符加进**另一个** epoll 文件描述符的集合。

- **能把 epoll 文件描述符经 UNIX 域套接字发给另一个进程吗？**
  可以，但这么做没有意义：接收进程并没有兴趣列表里那些文件描述符的副本。

- **关闭一个文件描述符会导致它从所有 epoll 兴趣列表中移除吗？**
  会，但注意以下要点。文件描述符是对打开文件描述的引用（见 open(2)）。每当一个文件描述符经 dup(2)、dup2(2)、fcntl(2) F_DUPFD 或 fork(2) 被复制，都会创建一个指向同一打开文件描述的新文件描述符。打开文件描述会一直存在，直到指向它的所有文件描述符都被关闭。
  只有当指向底层打开文件描述的所有文件描述符都已关闭，该文件描述符才会从兴趣列表移除。这意味着：即使兴趣列表中的某个文件描述符已被关闭，只要还有指向同一底层文件描述的其他文件描述符开着，事件仍可能为它报告。要避免这种情况，必须在复制之前就用 epoll_ctl(2) 的 EPOLL_CTL_DEL 把文件描述符显式从兴趣列表移除；或者，应用必须保证所有文件描述符都被关闭（如果描述符被使用 dup(2) 或 fork(2) 的库函数在幕后复制了，这可能很难）。

- **两次 epoll_wait(2) 调用之间发生了多个事件，它们会被合并还是分别报告？**
  会被合并。

- **对一个文件描述符的操作会影响已收集但尚未报告的事件吗？**
  你可以对既有文件描述符做两种操作。删除在此情形下没有意义；修改则会重新读取可用 I/O。

- **使用 EPOLLET 标志（边沿触发行为）时，需要持续读写文件描述符直到 EAGAIN 吗？**
  从 epoll_wait(2) 收到事件，应当提示你该文件描述符对所请求的 I/O 操作是就绪的。你必须把它视为就绪，直到下一次（非阻塞的）读/写返回 EAGAIN。何时用、怎么用这个文件描述符完全由你决定。
  对面向包/记号的文件（如数据报套接字、规范模式的终端），检测读/写 I/O 空间用尽的唯一办法就是持续读写直到 EAGAIN。
  对面向流的文件（如管道、FIFO、流式套接字），也可以通过检查从/向目标文件描述符读出/写入的数据量来判定读/写 I/O 空间已耗尽。例如你调 read(2) 请求读一定量数据而它返回了更少的字节数，你就可以确定已读尽该描述符的读 I/O 空间；write(2) 同理。（若不能保证被监视的文件描述符始终指向面向流的文件，请避免后一种技巧。）

## 可能的陷阱与规避（译自 epoll(7)）

- **饿死（边沿触发）**：如果某个文件的 I/O 空间非常大，一直清空它可能导致其他文件得不到处理、造成饿死。（这个问题并非 epoll 特有。）解法是维护一个就绪列表、在该文件描述符关联的数据结构里把它标记为就绪，让应用记住哪些文件还需要处理、同时在所有就绪文件之间轮转（round robin）。这也顺便支持忽略已就绪文件描述符后续收到的事件。

- **如果使用事件缓存……**：如果你用事件缓存、或保存 epoll_wait(2) 返回的所有文件描述符，那么务必提供一种办法动态标记其关闭（即由先前某个事件的处理引发的关闭）。假设你从 epoll_wait(2) 收到 100 个事件，处理事件 #47 时的某个条件导致事件 #13 的文件描述符被关闭。如果你移除该结构并 close(2) 了事件 #13 的文件描述符，你的事件缓存可能仍然认为该描述符上有事件在等待，从而引发混乱。
  一个解法是：在处理事件 47 的过程中，调用 epoll_ctl(EPOLL_CTL_DEL) 删除文件描述符 13 并 close(2)，然后把它关联的数据结构标记为已移除、挂到一个清理列表上。这样批量处理中再遇到文件描述符 13 的事件时，你会发现它早已被移除，不会再混乱。

## 版本与其他系统（译自 epoll(7) VERSIONS / STANDARDS / HISTORY / NOTES）

其他系统提供类似机制：例如 FreeBSD 有 kqueue，Solaris 有 /dev/poll。epoll 是 Linux 专属（STANDARDS：Linux），出现于 Linux 2.5.44、glibc 2.3.2。经 epoll 文件描述符监视的文件描述符集合，可以在进程的 /proc/pid/fdinfo 目录中该 epoll 文件描述符的条目里查看（详见 proc(5)）。kcmp(2) 的 KCMP_EPOLL_TFD 操作可用于测试某个文件描述符是否存在于某个 epoll 实例中。

## 为什么 asyncio 需要它（编者按，桥接下一模块）

> 本节为站点编者补充说明，用于衔接下一模块（Python 异步编程），非 man-pages 原文翻译。

现在把上面这张拼图对到 Python 上。asyncio 的核心承诺是"单线程并发处理成千上万个连接"，它依赖三个前提，每一项都能在前文找到出处：

1. **非阻塞 I/O**：epoll 的边沿触发用法（以及 Beej 讲的问题本身）要求套接字是非阻塞的——read/write 不等待、立即返回 EAGAIN。Python 里对应 `socket.setblocking(False)`。
2. **事件通知**：epoll 就绪列表就是事件源。asyncio 的事件循环（`SelectorEventLoop` 默认基于 `selectors` 模块，Linux 上正是 epoll；Windows 上则是 IOCP）在 `epoll_wait()` 阻塞等待，事件到来后逐个回调。
3. **回调 → 协程**：上例的 `do_use_fd()` 在收到 EAGAIN 时"记录当前状态、下次从停下的地方继续"——man 页写的这句话就是状态机。asyncio 用协程把这种手工状态机变成语言特性：`await` 挂起时保存栈帧，等 I/O 就绪由事件循环恢复执行。EAGAIN 处的手动 goto，变成了 `await`。

所以说：理解了 epoll 的兴趣列表/就绪列表、电平/边沿触发、以及"只在 EAGAIN 之后才等事件"的纪律，asyncio 事件循环就不再是黑魔法，而是一段你已读懂其系统调用底座的调度器代码。

---

> **来源**：本文翻译自 Linux man-pages 项目（[man7.org](https://man7.org/linux/man-pages/man7/epoll.7.html)）的 [epoll(7)](https://man7.org/linux/man-pages/man7/epoll.7.html)、[epoll_ctl(2)](https://man7.org/linux/man-pages/man2/epoll_ctl.2.html)、[epoll_wait(2)](https://man7.org/linux/man-pages/man2/epoll_wait.2.html) 与 [epoll_create(2)](https://man7.org/linux/man-pages/man2/epoll_create.2.html) 手册页，原作者 Davide Libenzi、Michael Kerrisk（man-pages 维护者），许可 GPL-2.0-or-later；引言一节翻译自 [Beej's Guide to Network Concepts](https://beej.us/guide/bgnet0/html/split/select.html) §29.1（作者 Brian "Beej Jorgensen" Hall，CC BY-NC-ND 3.0，含官方翻译例外条款）。"为什么 asyncio 需要它"一节为编者补充。抓取于 2026-09-13。
