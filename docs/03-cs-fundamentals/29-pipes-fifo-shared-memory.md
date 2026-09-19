---
title: 管道、FIFO 与共享内存：进程间传数据的三级台阶
source_url: https://beej.us/guide/bgipc/html/split/pipes.html
author: Brian “Beej Jorgensen” Hall（Beej's Guide to Unix IPC：Pipes、FIFOs、System V Shared Memory Segments 章）
license: CC BY-NC-ND 3.0（含官方翻译例外条款）
fetched_at: 2026-09-13
translated: true
order: 29
group: 操作系统：进程、线程与并发
---
上一篇《信号与进程通信》处理的是"通知"，本篇处理"数据"：进程之间怎么真正把字节传到对方手里。三条通道按能力递增、易用性递减排列：

| 通道 | 谁能用 | 语义 | 一次拷贝 | 典型坑 |
|---|---|---|---|---|
| 匿名管道 `pipe()` | 有亲缘关系的进程（`fork()` 之后） | 字节流、单工 | 是（内核缓冲） | 写满 4K/64K 即阻塞；忘记关读端导致永久等待 |
| FIFO（命名管道）`mkfifo()` | 任意进程（靠路径名会合） | 字节流、单工 | 是 | 打开即阻塞语义；`O_NDELAY` 与数据交错 |
| System V 共享内存 `shmget()`/`shmat()` | 任意进程（靠 key 会合） | 随机读写同一块内存 | **否**（零拷贝） | 不自动同步：正确性回到锁与《死锁与同步》 |

选择逻辑很朴素：**只传一句话就用管道，要打破亲缘关系就用 FIFO，要共享大对象才上共享内存**——而一旦上共享内存，你就同时继承了"并发"这个老大难。

值得注意的是这三条都是 Unix 的老式武器：现代替代方案（内存映射文件 `mmap()`、匿名共享内存 + `memfd_create()`、Unix 域套接字传文件描述符）在《mmap 与 Unix 域套接字》里单列，那篇同时也是本篇"共享内存"一节的当代写法。

## 管道（Pipes）

没有哪种 IPC 比管道更简单了。它在每一种 Unix 上都有实现，`pipe()` 和 `fork()` 共同构成了 "ls | more" 里那个 "|" 背后的功能。管道做酷事的作用有限，但它是学习 IPC 基本方法的绝佳素材。

既然它太太太简单，我不多花笔墨，直接上例子。

### "这些管道是干净的！"

等等！先别急，此刻我得先定义一下"文件描述符"（file descriptor）。这么说吧：你知道 stdio.h 里的 "FILE*" 吧？你知道 `fopen()`、`fclose()`、`fwrite()` 这些好用的函数吧？其实那些都是高层函数，底层用文件描述符实现，而文件描述符使用 `open()`、`creat()`、`close()`、`write()` 这类系统调用。文件描述符就是一些 int，是 stdio.h 里 FILE* 的类似物。

例如 stdin 是文件描述符 "0"，stdout 是 "1"，stderr 是 "2"。同样，你用 `fopen()` 打开的任何文件都有自己的文件描述符，只是这个细节对你隐藏了（可以用 stdio.h 的 `fileno()` 宏从 FILE* 取回这个描述符）。

管道的组织方式。基本上，调用 `pipe()` 函数会返回一对文件描述符：一个连着管道的**写端**，另一个连着**读端**。任何东西都可以写进管道，并从另一端按写入顺序读出。在很多系统上，如果你写了约 10K 而不读出，管道就会写满。

作为一个"没什么用"的例子，下面的程序创建一个管道，往里写、从里读：

```c
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <unistd.h>

int main(void)
{
    int pfds[2];
    char buf[30];

    if (pipe(pfds) == -1) {
        perror("pipe");
        exit(1);
    }

    printf("writing to file descriptor #%d\n", pfds[1]);
    write(pfds[1], "test", 5);
    printf("reading from file descriptor #%d\n", pfds[0]);
    read(pfds[0], buf, 5);
    printf("read \"%s\"\n", buf);

    return 0;
}
```

如你所见，`pipe()` 以两个 int 的数组为参数。没有错误的话，它连通两个文件描述符并把它们放回数组：数组第一个元素是管道的**读端**，第二个是**写端**。

### fork() 和 pipe()——你行你上！

从上面的例子很难看出这有什么用。不过这是篇 IPC 文档，我们来加一个 `fork()` 看看会怎样。假装你是位联邦特工，任务指挥一个子进程把单词 "test" 发给父进程。不算光彩照人，但也没人说过计算机科学是《X档案》，Mulder。

第一步，父进程建一个管道。第二步，fork()。fork() 的 man 页告诉我们：子进程会收到父进程所有文件描述符的副本——包括那对管道描述符的副本。于是，子进程能往管道写端写，父进程能从读端取：

```c
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <sys/types.h>
#include <unistd.h>

int main(void)
{
    int pfds[2];
    char buf[30];

    pipe(pfds);

    if (!fork()) {
        printf(" CHILD: writing to the pipe\n");
        write(pfds[1], "test", 5);
        printf(" CHILD: exiting\n");
        exit(0);
    } else {
        printf("PARENT: reading from pipe\n");
        read(pfds[0], buf, 5);
        printf("PARENT: read \"%s\"\n", buf);
        wait(NULL);
    }

    return 0;
}
```

请注意：你自己的程序应该比我这些例子多做得多得多的错误检查；我偶尔省略它是为了保持清晰。

总之，这个例子和上一个差不多，只是现在我们 fork 出新进程让它写管道，父进程读管道。输出大致如下：

```
PARENT: reading from pipe
 CHILD: writing to the pipe
 CHILD: exiting
PARENT: read "test"
```

本例中，父进程在子进程写入之前就尝试读管道。这时我们说父进程**阻塞**（block）了，或者说睡了，直到有数据可读。看起来是：父进程尝试读取，睡着了；子进程写入并退出；父进程醒来，读到数据。

万岁！！你刚刚完成了一次进程间通信！简单得吓人，对吧？我打赌你还是觉得 pipe() 用处不多——你大概是对的。其他形式的 IPC 通常更有用、也更少见而别致（exotic）。

### 寻找我们所熟知的 Pipe

为了让你觉得管道这东西还算讲道理，我给你一个更熟悉的用法示例。挑战：用 C 实现 "ls | wc -l"。

这需要再用到两个你可能没听过的函数：exec() 和 dup()。exec() 家族函数用传入的那个程序**替换**当前正在运行的进程——我们将用它来运行 ls 和 wc -l。dup() 接收一个已打开的文件描述符并克隆（复制）一份。我们将用 dup 把 ls 的标准输出连到 wc 的标准输入上。看：ls 的 stdout 流入管道，wc 的 stdin 从管道流入，管道正好卡在中间：

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(void)
{
    int pfds[2];

    pipe(pfds);

    if (!fork()) {
        close(1);       /* 关闭正常 stdout */
        dup(pfds[1]);   /* 让 stdout 与 pfds[1] 相同 */
        close(pfds[0]); /* 我们不需要它 */
        execlp("ls", "ls", NULL);
    } else {
        close(0);       /* 关闭正常 stdin */
        dup(pfds[0]);   /* 让 stdin 与 pfds[0] 相同 */
        close(pfds[1]); /* 我们不需要它 */
        execlp("wc", "wc", "-l", NULL);
    }

    return 0;
}
```

我要再点评一下 close()/dup() 组合，因为它相当怪异：`close(1)` 释放了文件描述符 1（标准输出）；`dup(pfds[1])` 复制管道写端到**第一个可用的文件描述符**——也就是 "1"，因为我们刚把它关了。这样一来，ls 写往标准输出（文件描述符 1）的一切都改道去了 pfds[1]（管道写端）。wc 那段代码同理，方向相反。

### 小结

这么简单的话题没多少可总结的——几乎没有。管道最好的用法大概就是你最熟悉的那个：把一个命令的标准输出接到另一个命令的标准输入。其他用途相当受限，通常有更好的 IPC 技术可用。

## FIFO（命名管道）

FIFO（"First In, First Out"，读作 "Fy-Foh"）有时被称为**命名管道**（named pipe）。也就是说，它像管道，只不过有个名字！在这里，名字就是那个可以被多个进程 open() 并读写的**文件**。

FIFO 的这层设计正是为了绕开普通管道的一个短板：你没法抓到一个由**无关进程**创建的普通管道的一端。你看：如果我跑同一个程序的两份独立拷贝，它们各自爱怎么调 pipe() 就怎么调，仍然无法彼此通话。（这是因为你必须 pipe()、然后 fork()，才能得到能与父进程通过管道通信的子进程。）而有了 FIFO，每个无关进程只需 open() 这个管道，就能通过它传输数据。

### 新 FIFO 诞生

由于 FIFO 实际上是磁盘上的一个文件，你得搞点花活来创建它。不难：带上正确的参数调用 `mkfifo()` 即可。下面这句创建一个 FIFO：

```c
mkfifo("myfifo", 0644);
```

上例中 FIFO 文件名为 "myfifo"，第二个参数设置文件的访问权限（八进制 644，即 rw-r--r--），也可以用 sys/stat.h 里的宏按位或来设置。这权限跟 chmod 命令设的一模一样。

（题外话：FIFO 也可以在命令行用 Unix 的 mkfifo 命令创建。）

#### 历史注记：mknod

最初创建 FIFO 用的是 `mknod()`，但它已被弃用。目前这两个调用等价：

```c
mknod("myfifo", S_IFIFO | 0644, 0);   // 老办法
mkfifo("myfifo", 0644);               // 新办法
```

用 mknod() 时你过去得多做一点事：在第二个参数里指定创建模式（额外按位或上 S_IFIFO）、在最后一个参数里给设备号——创建 FIFO 时该参数被忽略，填什么都行。

但只要系统支持，你就该用 `mkfifo()` 来创建 FIFO。

### 生产者与消费者

FIFO 创建好之后，进程就可以用标准的 `open()` 系统调用以读或写的方式打开它。

肚子里进点代码更容易理解，所以这里给出两个通过 FIFO 收发数据的程序：speak.c 通过 FIFO 发数据，tick.c 从 FIFO 里抽数据。

speak.c：

```c
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <string.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>

#define FIFO_NAME "american_maid"

int main(void)
{
    char s[300];
    int num, fd;

    mkfifo(FIFO_NAME, 0644);

    printf("waiting for readers...\n");
    fd = open(FIFO_NAME, O_WRONLY);
    printf("got a reader--type some stuff\n");

    while (gets(s), !feof(stdin)) {
        if ((num = write(fd, s, strlen(s))) == -1)
            perror("write");
        else
            printf("speak: wrote %d bytes\n", num);
    }

    return 0;
}
```

speak 创建 FIFO，然后尝试 open() 它。此时会发生：`open()` 调用会**阻塞**，直到有其他进程打开管道的另一端来读。（有办法绕开——见下面的 O_NDELAY。）那个进程就是 tick.c：

```c
#include <stdio.h>
#include <stdlib.h>
#include <errno.h>
#include <string.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>

#define FIFO_NAME "american_maid"

int main(void)
{
    char s[300];
    int num, fd;

    mkfifo(FIFO_NAME, 0644);

    printf("waiting for writers...\n");
    fd = open(FIFO_NAME, O_RDONLY);
    printf("got a writer\n");

    do {
        if ((num = read(fd, s, 300)) == -1)
            perror("read");
        else {
            s[num] = '\0';
            printf("tick: read %d bytes: \"%s\"\n", num, s);
        }
    } while (num > 0);

    return 0;
}
```

和 speak.c 一样，没有写入者时 tick 也会阻塞在 open() 上；一旦有人以写方式打开 FIFO，tick 立刻活过来。

试试看：启动 speak，它会阻塞，直到你在另一个窗口启动 tick（反过来同理）。在 speak 窗口里敲字，tick 会把它们统统吸走。

现在，强退 speak。注意发生的事：tick 里的 `read()` 返回 0，表示 EOF。这样读端就能知道所有写端都已关闭与 FIFO 的连接。"什么？"你说，"可以有多个写端往同一个管道写？"当然！这可能非常有用。

不过现在，先看看在 speak 运行时强退 tick 会怎样——"Broken Pipe"！什么意思？事情是：当 FIFO 的所有读端都关闭、而写端还开着时，写端下一次尝试 `write()` 就会收到 `SIGPIPE` 信号。该信号的默认处理器打印 "Broken Pipe" 并退出。当然，你可以通过 signal() 捕获 SIGPIPE，处理得更体面。

最后，如果有多个读端会怎样？奇怪的事情会发生。有时其中一个读端拿到所有数据，有时数据在多个读端之间轮流分布。不过话说回来，你为什么要有多个读端呢？

### O_NDELAY！我势不可挡！

前面提过，没有对应的读端或写端时，你可以绕开阻塞的 open() 调用：在 mode 参数里带上 O_NDELAY 标志调用 open()：

```c
fd = open(FIFO_NAME, O_WRONLY | O_NDELAY);
```

这样，当没有进程以读方式打开该文件时，open() 返回 -1。

同样可以用 O_NDELAY 打开读端，但效果不同：只要管道里没数据，所有 `read()` 尝试都直接返回 0 字节（即 read() 不再阻塞等待数据）。注意：你从此无法分辨 read() 返回 0 是因为管道里没数据，还是因为写端退出了。这就是力量的代价。我的建议是：尽量坚持用阻塞模式。

### 数据交错

多个写端同时往管道里倒东西会怎样？数据会交错吗？

可能！取决于你单次 `write()` 倒进去多少。只要单次 write() 不超过 `PIPE_BUF` 字节，它就是**原子的**。这很好！

话虽如此，没有任何机制保证对应的 read() 调用恰好把一个个独立的数据块取出来。可能发生这样的事：

```
write "Foo"
write "bar"
```

然后一次 read 给了我们：

```
read "Foobar"
```

或者 read 可能取到短的：

```
read "Foob"
read "ar"
```

所以即使写入是原子的，读端仍需要一些额外的结构来保证从另一头取到正确的数据——常见做法是在数据前面加长度前缀，或用定长消息。

无论如何，你必须保证凑齐一条完整消息，凑不齐就再调 read()，直到凑齐为止。

### 结语

管道的名字就摆在磁盘上，确实方便多了——无关进程也能用管道通信了！（普通管道用久了，你就会渴望这种能力。）不过管道的功能未必是你的应用真正需要的。如果你的系统支持，消息队列（message queue）可能更对你的胃口。

## System V 共享内存段（Shared Memory Segments）

共享内存段的酷处在于它名副其实：一段**在进程之间共享**的内存。想想它的潜力！你可以为多人游戏分配一块玩家信息，让每个进程随意访问！好玩，好玩，好玩。（当然，内存映射文件也能做到同样的事，还附带持久化的额外好处——当然共享内存的那些注意事项它也同样适用。）

照例，坑不少，但长远看都很简单。你只要连接到共享内存段，拿到指向那块内存的指针，就能读写这个指针，你做的所有改动对连接到该段的所有人都可见。没有比这更简单的了。呃，其实有更简单的，但我刚才是想让你放松点。

### 创建段并连接

与其他 System V IPC 形式类似，共享内存段通过 `shmget()` 调用来创建和连接：

```c
int shmget(key_t key, size_t size, int shmflg);
```

成功完成时，shmget() 返回共享内存段的标识符。key 参数的创建方式与消息队列文档中展示的一样，用 `ftok()`。第二个参数 size 是共享内存段的字节数。最后，shmflg 应设为段的权限，若想创建段则再按位或上 IPC_CREAT；否则可以为 0。（每次都带上 IPC_CREAT 也没什么坏处——段已存在时它只会直接把你连上去。）

示例调用：创建一个 1K、权限 644（rw-r--r--）的段：

```c
key_t key;
int shmid;

key = ftok("/home/beej/somefile3", 'R');
shmid = shmget(key, 1024, 0644 | IPC_CREAT);
```

（实际创建的可能不是 1K——操作系统允许把大小放大以满足内部约束。例如在 4K 虚拟页的系统上，大小很可能被加到 4K。当然你的程序既不知道也不在乎；这只是实现细节。）

可你拿着 shmid 这个句柄，怎么得到指向那些数据的指针呢？答案是下一节的 `shmat()` 调用。

### 附身（attach）：拿到段的指针

使用共享内存段之前，你得先用 `shmat()` 调用把自己"附"上去：

```c
void *shmat(int shmid, void *shmaddr, int shmflg);
```

这都是什么意思呢？shmid 是你从 shmget() 拿到的共享内存 ID。接着是 shmaddr——你可以用它告诉 shmat() 用哪个具体地址，但你应该直接设 0，让操作系统替你选地址。最后，shmflg 若只想读可设为 `SHM_RDONLY`，否则为 0。（man 页里还有其他有用的标志，值得一看。）

下面是拿到共享内存段指针的更完整例子：

```c
key_t key;
int shmid;
char *data;

key = ftok("/home/beej/somefile3", 'R');
shmid = shmget(key, 1024, 0644 | IPC_CREAT);
data = shmat(shmid, (void *)0, 0);
```

砰！你拿到了指向共享内存段的指针！注意 shmat() 返回 void 指针，本例中我们把它当 char 指针用。你完全可以把它当任何类型用，取决于里面放了什么数据。指向结构体数组的指针也毫无问题。

有意思的是，shmat() 失败时返回 -1（mmap() 也是）。可 void 指针怎么等于 -1？比较时做个强制转换来检查错误即可：

```c
data = shmat(shmid, (void *)0, 0);
if (data == MAP_FAILED)
    perror("shmat");
```

（重要：被转换成指针的是那个整数，而不是把指针返回值转换成整数。区别微妙，但后者并非在所有体系结构间都可移植。另外注意转换目标是 void* 而非你可能以为的 char*——C 语言保证 void* 到任何其他指针类型的隐式转换都安全可靠，所以用 void* 让编译器干活更好。）

现在你只需要像普通指针一样改动它指向的数据。下节有些例子。

### 读写

假设你有了上面例子里的 data 指针。它是 char 指针，所以我们读写的是字符。为简单起见，再假设这 1K 共享内存段里放着一个以空字符结尾的字符串。

再简单不过了。既然里面就是个字符串，可以这样打印：

```c
printf("shared contents: %s\n", data);
```

也可以同样轻松地往里存点什么：

```c
printf("Enter a string: ");
fgets(data, 1024, stdin);
```

当然，正如前面所说，里面除了字符还可以放别的数据——我只是拿字符举例。我假设你对 C 的指针足够熟悉，放什么数据你都能对付。

### 分离与删除段

用完共享内存段，你的程序应当用 `shmdt()` 调用把自己分离出去（不分离的话，进程终止时也会自动分离）：

```c
int shmdt(void *shmaddr);
```

唯一的参数 shmaddr 是你从 shmat() 拿到的地址。出错返回 -1，成功返回 0。

从段分离并不会销毁它；所有人都分离了它也不会被移除。你必须显式调用 `shmctl()` 来销毁它，与 System V IPC 其他函数的控制调用类似：

```c
shmctl(shmid, IPC_RMID, NULL);
```

上面这个调用会删除共享内存段（前提是没有别人附着在上面）。shmctl() 能做的事远不止于此，值得深挖。（当然得靠你自己挖——本文只是概览！）

照例，你也可以在命令行用 Unix 的 ipcrm 命令销毁共享内存段。另外，别把没用的共享内存段丢在系统里白白浪费资源。你拥有的所有 System V IPC 对象可以用 ipcs 命令查看。

### 并发

并发问题指什么？多个进程同时修改共享内存段，更新同时发生时可能冒出某些错误。共享对象有多个写者时，这种并发访问几乎总是问题。

绕开的办法是用**信号量**（semaphore）在进程写共享内存段时给它上锁。（有时锁要同时罩住读和写，取决于你在干什么。）

对并发的深入讨论超出了本文范围（维基百科条目值得一看）。只留一句：当你把两个或更多进程连上共享数据后开始看到诡异的不一致，你八成摊上并发问题了。

### 示例代码

我刚给你灌了一堆"不用信号量的并发访问有多危险"，现在给你看一个恰恰不用的演示。由于这不是关键业务应用，你也不太会与其他进程同时访问共享数据，为了简单，示例干脆省掉了信号量。

这个程序做两件事之一：不带命令行参数运行时，打印共享内存段的内容；给它一个参数，就把该参数存进共享内存段。

shmdemo.c 的代码：

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/ipc.h>
#include <sys/shm.h>

#define SHM_SIZE 1024  /* 1K 共享内存段 */

int main(int argc, char *argv[])
{
    key_t key;
    int shmid;
    char *data;
    int mode;

    if (argc > 2) {
            fprintf(stderr, "usage: shmdemo [data_to_write]\n");
            exit(1);
    }

    /* 生成 key: */
    if ((key = ftok("shmdemo.c", 'R')) == -1) {
            perror("ftok");
            exit(1);
    }

    /* 连接（并可能创建）段: */
    if ((shmid = shmget(key, SHM_SIZE, 0644 | IPC_CREAT)) == -1) {
            perror("shmget");
            exit(1);
    }

    /* 附着到段以获得指针: */
    data = shmat(shmid, (void *)0, 0);

    /* 我们*可以*用 MAP_FAILED，但严格说那不是 */
    /* 规范定义的返回值。System V 这一点上输了! */
    if (data == (void *)(-1)) {
            perror("shmat");
            exit(1);
    }

    /* 根据命令行读或改段: */
    if (argc == 2) {
            printf("writing to segment: \"%s\"\n", argv[1]);
            strncpy(data, argv[1], SHM_SIZE);
            data[SHM_SIZE-1] = '\0';
    } else
            printf("segment contains: \"%s\"\n", data);

    /* 从段分离: */
    if (shmdt(data) == -1) {
            perror("shmdt");
            exit(1);
    }

    return 0;
}
```

更常见的情形是：一个进程附着到段上运行一段时间，同时其他程序在改、在读共享段。看着一个进程更新段、改动出现在其他进程里，相当有趣。为简单起见，示例没演示这个，但你能看出数据是如何在独立进程间共享的。

另外，这里没有删除段的代码——用完记得删。

## 小结

把三篇放在一起，进程通信的坐标系就完整了：信号《信号与进程通信》负责"打断"，本篇负责"数据"——管道与 FIFO 以字节流传递（`fork()` 建立亲缘、`mkfifo()` 打破亲缘），共享内存让无关进程直接读写同一块物理内存；而共享内存的正确性，又回到《死锁与同步》与《并发与锁》讲的锁纪律上。

## 编者补充

> 本节为站点编者补充，串联前后篇目与工程场景，非原文翻译。

- **管道即 Agent 工具**：Agent 执行 `ps aux | grep python` 这类 shell 工具时，shell 用 `pipe()` + `fork()` + `exec()` + `dup()` 把两个命令接起来——本文"ls | wc -l"一例就是这个机制的完整拆解。理解了管道缓冲与 EOF 语义，也就理解了为什么"上游不退，下游永远卡住"。
- **共享内存是 GPU 时代 IPC 的主角**：`torch.multiprocessing`、vLLM 的前后端进程间传张量，走的都是共享内存（或其上的 ZeroMQ 等封装）——拷贝几十 GB 权重走管道不可接受，让两个进程映射同一块物理内存才能零拷贝。别忘了本文的提醒：多进程共享可写内存时，正确性又回到锁与死锁纪律上。
- **别用共享内存传控制消息**：本文"并发"一节的忠告在今天仍然成立。工程上常用的分工是——**数据面**走共享内存（张量、特征表），**控制面**走 Unix 域套接字或消息队列（可背压、可传递 fd、有序列化边界）。用 `mmap()` + 一个无锁环形队列实现数据面、用 `socketpair()` 做控制面，是本地推理服务最常见的组合。

---

> **来源**：本篇翻译自 [Beej's Guide to Interprocess Communication](https://beej.us/guide/bgipc/html/split/)（第 5 章 Pipes、第 6 章 FIFOs、第 11 章 System V Shared Memory Segments，[beej.us/guide/bgipc](https://beej.us/guide/bgipc/)），作者 Brian "Beej Jorgensen" Hall，许可 CC BY-NC-ND 3.0（作者在许可中明确允许对本指南进行忠实翻译，但要求转载指南全文；本译文为署名学习用途的节译，特此说明并致谢）。System V IPC 的现代替代见 [mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html) 与 [unix(7)](https://man7.org/linux/man-pages/man7/unix.7.html)（Linux man-pages，GPL-2.0-or-later）。抓取于 2026-09-13。原《信号与进程间通信 IPC》一篇按主题分为三篇，本篇收录其中的管道、FIFO 与 System V 共享内存部分，译文内容未作删减。
