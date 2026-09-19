---
title: mmap 与 Unix 域套接字：现代进程间通信的两条主路
source_url: https://man7.org/linux/man-pages/man2/mmap.2.html
author: Michael Kerrisk 与 Linux man-pages 维护者（mmap(2)、memfd_create(2)、unix(7)、socket(7)）
license: GPL-2.0-or-later（Linux man-pages；手册页明文允许以二进制/源码形式再分发，需保留版权声明）
fetched_at: 2026-09-19
translated: true
versions: Linux 4.15+（`MAP_SHARED_VALIDATE`）／4.17+（`MAP_FIXED_NOREPLACE`）起的 mmap 特性；glibc 2.35+；CPython 3.9+（`socket.send_fds`／`recv_fds`）
order: 33
group: 操作系统：进程、线程与并发
---

《管道、FIFO 与共享内存》把 System V 那套 IPC（`shmget()`/`shmat()`、消息队列、`ftok()`）讲得很完整，那是理解 Unix 通信史的必经之路。但**今天新写的代码不该再用它**：System V IPC 的 key 是 32 位整数、权限模型粗糙、没有文件系统的可观察性（`ipcs` 才能看见）、清理靠人（段不会随进程消失），而且很多容器默认根本不开放。它的两个现代替身就是本篇：

- **`mmap()` + 文件描述符对象**（`memfd_create()`、`shm_open()`、普通文件）——零拷贝共享内存，生命周期挂在 fd 上；
- **Unix 域套接字（AF_UNIX）**——本机进程间的双向消息通道，并且能**传递文件描述符**，这是任何 System V 机制都做不到的事。

两者合起来覆盖了本地 IPC 的全部需求：**大对象走共享内存，控制消息走套接字**。这也是 PostgreSQL、systemd、Docker daemon、各类推理引擎（ZeroMQ 的 `ipc://` 传输）实际在用的组合。

## 一、mmap：把对象映射进地址空间

### 1.1 签名与语义

```c
#include <sys/mman.h>
void *mmap(void *addr, size_t length, int prot, int flags, int fd, off_t offset);
int   munmap(void addr[.length], size_t length);
```

| 参数 | 手册页的硬规定 |
|---|---|
| `addr` | 传 `NULL` 让内核选地址（推荐）；若带 `MAP_FIXED` 则必须按页对齐——`MAP_FIXED` 会**静默覆盖**已有映射，几乎总是你想要 `MAP_FIXED_NOREPLACE`（Linux 4.17+，冲突时返回 `EEXIST`） |
| `length` | 必须 > 0；**不必**是页大小的整数倍，内核会把整个区间补齐到页边界 |
| `prot` | `PROT_NONE`/`PROT_READ`/`PROT_WRITE`/`PROT_EXEC` 按位或 |
| `flags` | 必须含 `MAP_PRIVATE` 或 `MAP_SHARED`（或 `MAP_SHARED_VALIDATE`）之一，再加可选位 |
| `fd` | 文件、`memfd`、`/dev/shm` 对象或设备；`MAP_ANONYMOUS` 时通常传 -1 |
| `offset` | **必须是 `sysconf(_SC_PAGE_SIZE)` 的整数倍**（不是 length，是 offset） |

两个最容易忘的性质：**mmap 返回之后可以立刻 `close(fd)`**——映射不依赖 fd 存活（手册页原话：关闭文件描述符不会解除映射）；反过来，`munmap()` 之后访问该区间触发 `SIGSEGV`，而**映射区间超出文件尾部**时访问触发 `SIGBUS`（典型场景：另一进程 `ftruncate()` 把文件截短了）。

失败时返回 `MAP_FAILED`（即 `(void *)-1`）并置 `errno`：`ENOMEM`（地址空间/内存不足，最常见）、`EINVAL`（offset 未对齐、length 为 0、`MAP_HUGETLB` 但大小不是大页倍数）、`EACCES`（`prot` 与 fd 打开模式冲突）、`EBADF`（fd 无效）、`EEXIST`（`MAP_FIXED_NOREPLACE` 撞车）、`EOVERFLOW`（长度超上限）。**判错必须用 `MAP_FAILED`，不是 `NULL`。**

### 1.2 MAP_SHARED 与 MAP_PRIVATE：两条完全不同的路

- `MAP_SHARED`：写操作对**所有映射同一对象的进程立即可见**，并且会（在某时刻）回写到底层文件——要确保落盘必须 `msync(addr, length, MS_SYNC)`；`MAP_SHARED_VALIDATE`（4.15+）行为相同，但会**校验**你传的其它标志，遇到不认识的就报 `EOPNOTSUPP` 而不是静默忽略（写库代码时更安全）。
- `MAP_PRIVATE`：写时复制（COW）。写下去的内容只有本进程看得见，永不回写文件。这是可执行文件装载、以及"只读数据集 + 少量本地覆盖"的标准做法。

### 1.3 周边系统调用（真正决定可用性的那几个）

| 调用 | 用途 | 一句话建议 |
|---|---|---|
| `memfd_create("name", MFD_CLOEXEC)` | 造一个匿名的、可用 fd 传递的内存对象 | 现代共享内存首选；配 `MFD_ALLOW_SEALING` 还能"封印"防篡改 |
| `shm_open("/name", O_CREAT, 0600)` | POSIX 共享内存（落在 `/dev/shm`） | 跨无关进程、要"名字"时用；注意 `/dev/shm` 有大小限制 |
| `madvise(addr, len, MADV_*)` | 给内核提示访问模式 | `MADV_SEQUENTIAL`/`RANDOM`/`DONTNEED`（立即丢页）/`FREE`（惰性丢页）/`HUGEPAGE` |
| `msync(addr, len, MS_SYNC)` | 强制回写并等待 | 数据必须落盘时才做；成本很高 |
| `mlock`/`mlock2` | 把页钉住，不换出 | 密钥材料、GPU pinned 传输常用 |
| `mincore` | 查哪些页在内存中 | 与 `/proc/self/pagemap` 配合定位驻留情况 |
| `mprotect` | 改已映射区间权限 | 实现 guard page、写保护快照 |
| `userfaultfd` | 把缺页交给用户态处理 | 活迁移、CRIU、某些 serverless 快照技术的底座 |

### 1.4 可直接编译运行的现代共享内存示例

```c
/* shmfd.c —— 编译：gcc -O2 -D_GNU_SOURCE -Wall -o shmfd shmfd.c */
#include <err.h>
#include <stdio.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <unistd.h>

struct shared {            /* 放进共享内存的东西要自己管对齐 */
    unsigned long counter;
    char note[60];
};

int main(void) {
    int fd = memfd_create("demo", MFD_CLOEXEC);   /* 匿名内存对象，只有一个 fd */
    if (fd == -1) err(1, "memfd_create");
    if (ftruncate(fd, sizeof(struct shared)) == -1) err(1, "ftruncate");

    struct shared *p = mmap(NULL, sizeof(*p), PROT_READ | PROT_WRITE,
                            MAP_SHARED, fd, 0);
    if (p == MAP_FAILED) err(1, "mmap");          /* 注意：判 MAP_FAILED，不是 NULL */

    p->counter = 0;
    snprintf(p->note, sizeof(p->note), "written before fork");

    pid_t pid = fork();
    if (pid == -1) err(1, "fork");
    if (pid == 0) {                                /* 子进程：同一个物理页，直接可见 */
        printf("[child] 看到 note=%s counter=%lu\n", p->note, p->counter);
        p->counter += 41;
        _exit(0);
    }
    int st; waitpid(pid, &st, 0);
    printf("[parent] counter=%lu（子进程的改动无需任何拷贝）\n", p->counter);

    /* 把 fd 通过 Unix 域套接字传给另一个无关进程，就是"跨进程共享内存"的全部机制 */
    munmap(p, sizeof(*p));
    close(fd);
    return 0;
}
```

对照《管道、FIFO 与共享内存》里的 System V 版本：不需要 `ftok()` 造 key、不需要 `shmctl(IPC_RMID)` 手动销毁（最后一个 fd 关掉、映射全部解除，对象自然消失）、`ipcs` 的孤儿段问题不存在、而且能塞进容器与 cgroup 的记账体系。**共享内存的老规矩一条没变**：`MAP_SHARED` 不提供任何同步，跨进程互斥要用 `pthread_mutex` 放共享内存里并开 `PTHREAD_PROCESS_SHARED` 属性，或用 `flock()`/`sem_open()`——正确性问题依然归《死锁与同步》管。

## 二、Unix 域套接字：本机的双向通道，还能传 fd

### 2.1 三种地址、三种类型

`AF_UNIX`（旧名 `AF_LOCAL`）的地址结构：

```c
struct sockaddr_un {
    sa_family_t sun_family;   /* 恒为 AF_UNIX */
    char        sun_path[108];/* Linux 上 108 字节，含结尾 '\0' */
};
```

**路径名套接字（pathname socket）**：`bind()` 会在文件系统上创建一个套接字文件（`srw-rw-rw-`），权限就是访问控制的一部分——`connect()` 需要对该文件有写权限，`bind()` 需要对目录有写+搜索权限。地址长度必须按 `offsetof(struct sockaddr_un, sun_path) + strlen(path) + 1` 计算，别直接 `sizeof(*addr)`。

**抽象命名空间（abstract namespace）**：`sun_path[0] == '\0'`，名字不进文件系统、`bind` 后无需清理、也没有权限位可依赖（Linux 特有，且**作用域是网络命名空间**——容器里同名不冲突，但也别把它当安全边界）。

**`socketpair()` 创建的匿名套接字**：无地址，`fork()` 前建好即可让父子双向通信，还能传 fd——这是"进程内子进程 RPC"的最省事写法。

类型三选：`SOCK_STREAM`（面向连接、可靠、**无消息边界**）、`SOCK_DGRAM`（无连接、有边界；因为是本机，实际不会乱序或丢包）、`SOCK_SEQPACKET`（面向连接、可靠、**保留消息边界**——写 RPC 时它比 STREAM 省心，因为不需要自己拆帧）。

### 2.2 服务端与客户端（可直接跑，Python 3）

```python
# server.py —— 终端 1 运行：python3 server.py
import os, socket, struct

SOCK = "/tmp/demo.sock"


def recv_exact(conn: socket.socket, n: int) -> bytes:
    """STREAM 套接字会短读：必须循环直到收满 n 字节，n==0 时返回 b''。"""
    buf = bytearray()
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:                 # 对端关闭
            break
        buf += chunk
    return bytes(buf)


def send_msg(conn: socket.socket, payload: bytes) -> None:
    """STREAM 没有消息边界：加 4 字节大端长度前缀（与管道篇"数据交错"同一个坑）。"""
    conn.sendall(struct.pack("!I", len(payload)) + payload)


def main() -> None:
    if os.path.exists(SOCK):
        os.unlink(SOCK)            # 上次异常退出会留下"陈旧套接字文件" → bind 报 EADDRINUSE
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    srv.bind(SOCK)
    os.chmod(SOCK, 0o660)          # 权限就是本机 IPC 的鉴权层
    srv.listen(8)
    print(f"listening on {SOCK}")

    conn, _ = srv.accept()
    with conn:
        while True:
            head = recv_exact(conn, 4)
            if len(head) < 4:
                break
            (n,) = struct.unpack("!I", head)
            data = recv_exact(conn, n)
            if data == b"whoami":
                # accept 后立刻可以拿到对端凭据：本机 IPC 最实用的鉴权手段
                cred = conn.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED,
                                       struct.calcsize("Iii"))
                pid, uid, gid = struct.unpack("Iii", cred)
                send_msg(conn, f"peer pid={pid} uid={uid} gid={gid}".encode())
            else:
                send_msg(conn, b"echo:" + data)


if __name__ == "__main__":
    main()
```

```python
# client.py —— 终端 2 运行：python3 client.py
import socket, struct


def recv_msg(conn: socket.socket) -> bytes:
    head = conn.recv(4)
    while len(head) < 4:
        head += conn.recv(4 - len(head))
    (n,) = struct.unpack("!I", head)
    buf = b""
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            raise EOFError("对端在消息中途关闭")
        buf += chunk
    return buf


with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as s:
    s.connect("/tmp/demo.sock")
    payload = b"whoami"
    s.sendall(struct.pack("!I", len(payload)) + payload)
    print(recv_msg(s))     # → b'peer pid=1234 uid=1000 gid=1000'
```

`SO_PEERCRED` 给的是**对端的 pid/uid/gid**（内核视角，无法伪造），这就是为什么本机 daemon 常只校验"对端是不是 root / 是不是同一个服务账号"，而不额外发明令牌。想逐条消息带凭据（例如经过 `fork` 后 pid 已变），用 `SO_PASSCRED` + `sendmsg` 的 `SCM_CREDENTIALS`。

### 2.3 传文件描述符：AF_UNIX 的独门能力

```python
# fdpass.py —— Python 3.9+ ；直接 python3 fdpass.py 即可看到结果
import os, socket

r, w = socket.socketpair(socket.AF_UNIX, socket.SOCK_STREAM)   # 匿名套接字对，无需路径
log_fd = os.open("/tmp/demo.log", os.O_WRONLY | os.O_CREAT, 0o640)

w.send_fds(b"your log fd", [log_fd])            # 把已打开的 fd 交给对方
msg, fds, flags, addr = r.recv_fds(4096, 1)     # 第二个参数＝本次最多接收几个 fd
print(msg)                                      # → b'your log fd'
for fd in fds:
    os.write(fd, b"written through a passed fd\n")   # 写进同一个打开文件描述
    os.close(fd)
```

底层是 `sendmsg()`/`recvmsg()` 的辅助数据（control message），类型 `SCM_RIGHTS`；内核会在**接收方**的 fd 表里新建一项，指向同一个打开文件描述（因此文件偏移、锁状态共享）。它绕过了"路径 + 权限"的整套逻辑——**接收方不需要有权打开那个文件**。这就是 systemd 套接字激活（`LISTEN_FDS`）、Chrome/浏览器进程沙箱、以及渲染服务传 GPU buffer 句柄的实现基础。注意：每次传 fd 都会占用接收方的 fd 配额（`ulimit -n`），大量小消息传 fd 会耗尽 fd；`MSG_CMSG_CLOEXEC` 可以让收到的 fd 自动带 `O_CLOEXEC`，避免泄漏给子进程。

### 2.4 观测与调试

```bash
ss -x -p | head -40                 # 全部 AF_UNIX 套接字，含进程与"关联的对端"
ss -xl sport = : /tmp/demo.sock     # 只看在监听的
lsof -U                             # 谁持有这些套接字/管道
lsof /tmp/demo.sock                 # 精确到一个套接字文件
socat - UNIX-CONNECT:/tmp/demo.sock # 手工当客户端发字节（调试协议神器）
nc -U /tmp/demo.sock                # OpenBSD netcat 支持 -U
strace -e trace=socket,bind,connect,sendmsg,recvmsg -f ./server   # 看 SCM_RIGHTS 的真实系统调用
sudo cat /proc/1234/fd              # 传过来的 fd 会以 socket:[inode] 出现在这里
```

## 三、常见坑

1. **`bind: Address already in use`**：套接字文件不会被自动删除（进程崩溃后成为"陈旧文件"）。启动时 `unlink()` 再 `bind()`，或用抽象命名空间，或让 systemd/supervisor 管理生命周期。
2. **`connect: No such file or directory`**：服务端还没起来，或路径超过 107 个字符（`sun_path` 只有 108 字节含 `\0`）。K8s 里 socket 放 `emptyDir` 或 `hostPath` 卷，不要用 ConfigMap（不支持套接字文件）。
3. **STREAM 上出现"半条消息"或"两条粘一起"**：`AF_UNIX` 的 `SOCK_STREAM` 不提供消息边界。要么用 `SOCK_SEQPACKET`，要么老老实实加长度前缀（见 2.2）——这与《管道、FIFO 与共享内存》"数据交错"一节是同一个问题。
4. **`recv` 返回 0 不等于"对方在忙"**：那是 EOF（对端关闭）。区分"暂无数据"要靠非阻塞 + `EAGAIN` 或事件循环（见《I/O 多路复用》《epoll 与事件循环》）。
5. **mmap 后 `SIGBUS`**：文件被 `ftruncate` 截短、或 `length` 超出了对象尾部。先 `ftruncate()` 到位再 `mmap()`；或捕获 `SIGBUS` 后 `munmap`。
6. **`mmap` 返回 `ENOMEM`，但机器内存充足**：cgroup 的 `memory.max`/地址空间 `RLIMIT_AS`、或 `vm.overcommit_memory=2` 导致的提交限制。看 `/proc/self/limits` 与 `memory.events`。
7. **`/dev/shm` 太小**：Docker 默认 `/dev/shm` 只有 **64 MB**，PyTorch DataLoader 多进程、`shm_open` 大对象会报 `No space left on device` 或 `SIGBUS`。用 `--shm-size=8g` 或挂 tmpfs，或改用 `memfd_create`（不受 `/dev/shm` 尺寸约束，但受 cgroup 内存计账约束）。
8. **把抽象命名空间当安全边界**：它没有权限位，同一网络命名空间内的任何进程都能连。需要鉴权就用路径套接字 + `chmod 0600` + `SO_PEERCRED` 校验 uid。
9. **`MAP_SHARED` 写了一半进程崩了**：内核可能已经把部分页写回文件——共享内存**没有原子性**。跨进程更新结构要配 seqlock/双缓冲/显式 `msync` 点，别假设"要么全看到要么看不到"。
10. **忘记 `madvise(MADV_DONTFORK)`**：某些高性能/DPDK/RDMA 场景下 `fork()` 会让子进程继承映射并触发 COW/页表复制，造成延迟尖刺。
11. **`mmap` 与 `fork` + 线程**：子进程只保留调用线程，若父进程在 `mmap` 区域里持有 `pthread_mutex`，子进程会带着锁死的共享内存醒来——这正是《死锁与同步》里"fork 与锁"的老问题，改用 `pthread_atfork` 或让子进程立刻 `exec`。

## 四、选型速查

| 需求 | 选择 | 理由 |
|---|---|---|
| 父子进程传少量控制消息 | `socketpair()`（STREAM 或 SEQPACKET） | 无需地址与鉴权设计，天然成对 |
| 本机任意进程 → daemon | pathname AF_UNIX + `SO_PEERCRED` | 文件系统权限即鉴权，`ss -x` 可观测 |
| 大数据/张量/共享缓存 | `memfd_create()` + `mmap(MAP_SHARED)`，fd 经 `SCM_RIGHTS` 传 | 零拷贝、生命周期随 fd |
| 需要落盘且多进程读 | 文件 + `mmap(MAP_PRIVATE)` 或 `MAP_SHARED` + `msync` | 崩溃后数据仍在 |
| 只读快照 + 少量本地覆盖 | `MAP_PRIVATE`（COW） | 不污染原始对象 |
| 跨机通信 | TCP/TLS（本篇不适用） | AF_UNIX 只在同一内核内有效 |

延伸阅读：`mmap(2)`、`memfd_create(2)`、`msync(2)`、`madvise(2)`、`unix(7)`、`socket(7)`（SCM_RIGHTS/SCM_CREDENTIALS 小节）、`systemd.socket(5)`（套接字激活）；本站《管道、FIFO 与共享内存》给 System V 的历史形态，《epoll 与事件循环》讲把这些套接字接入事件循环，《分页、页表与多级页表》讲 `mmap` 之下发生了什么。

**编者补充（LLM/推理项目里的实证）**：

- **ZeroMQ 的 `ipc://` 就是 AF_UNIX**：vLLM 的前端 API server 与 engine core、多进程 pipeline 的 stage 之间常见 `zmq.PULL/PUSH("ipc:///tmp/x")`。它的价值是省掉 TCP 协议栈与端口冲突；出现"消息粘包/丢消息"时，先确认用的是 `ZMQ_REQ/REP` 还是自己组帧。
- **GPU 侧的对应物**：CUDA 的 `cudaIpcGetMemHandle()` 传的是显存句柄，语义上就是"用带外通道（通常是 AF_UNIX 或共享内存控制队列）交换一个可映射的对象引用"——理解了 `SCM_RIGHTS`，就看懂了 IPC 句柄设计的全部动机。
- **容器部署必查两项**：`/dev/shm` 尺寸（默认 64 MB）与 socket 文件所在卷是否 `hostPath`/`emptyDir`；K8s 的 `readOnly` 根文件系统会让 `bind()` 失败，这时正确解法是挂一个可写 emptyDir 而不是退回 System V IPC。

---

> **来源**：抓取于 2026-09-19。主要译自/引自 Linux 手册页 [mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html)、[unix(7)](https://man7.org/linux/man-pages/man7/unix.7.html)（Michael Kerrisk 与 Linux man-pages 维护者，许可 GPL-2.0-or-later，手册页另附"允许以二进制或文本形式再分发，需保留版权声明"条款），并参照 [memfd_create(2)](https://man7.org/linux/man-pages/man2/memfd_create.2.html)、[msync(2)](https://man7.org/linux/man-pages/man2/msync.2.html)、[madvise(2)](https://man7.org/linux/man-pages/man2/madvise.2.html)、[socket(7)](https://man7.org/linux/man-pages/man7/socket.7.html) 中的 `SCM_RIGHTS`/`SCM_CREDENTIALS`/`SO_PEERCRED` 小节。`sun_path` 108 字节、抽象命名空间、`offset` 页对齐、`MAP_SHARED_VALIDATE`（4.15+）与 `MAP_FIXED_NOREPLACE`（4.17+）返回 `EEXIST`、`SIGBUS` 与"关闭 fd 不影响映射"等表述均据手册页原文。C 与 Python 示例、观测命令、排查表、选型速查与编者补充为本站撰写；`/dev/shm` 默认 64 MB 为 Docker 引擎默认值（`--shm-size` 覆盖）。System V IPC 的对照内容见本站《管道、FIFO 与共享内存》。
