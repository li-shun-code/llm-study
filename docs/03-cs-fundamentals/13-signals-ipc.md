---
title: 信号与进程通信：异步打断的机制
source_url: https://beej.us/guide/bgipc/html/split/signals.html
author: Brian “Beej Jorgensen” Hall（Beej's Guide to Unix IPC 第 3 章 Signals）
license: CC BY-NC-ND 3.0（含官方翻译例外条款）
fetched_at: 2026-09-13
translated: true
order: 13
group: 操作系统：进程、线程与并发
---
上一节《并发与锁》讲的是**同一进程内**线程之间的同步；从本节起把视角抬高一层：**不同进程之间**怎么交流。进程不共享内存（这正是进程与线程的本质区别），于是操作系统为它们准备了另一套交流手段。本站把这套手段按主题分成三篇：

- **本篇（信号）**：唯一的"打断式"通道——`sigaction()` 装处理器、`kill()`/`raise()` 投递、重入之龙与异步信号安全。
- 《管道、FIFO 与共享内存》：字节流（匿名管道、命名管道）与共享内存段，以及各自的边界与坑。
- 《死锁与同步》：进程与线程都会碰上的经典灾难，四条件、预防、避免与检测。

信号在这三兄弟里最特殊：它不携带数据，只是一次"内核强行把你的控制流挪到我的处理器里"的通知。也正因为这个性质，它的坑全集中在**可重入性**上——这也是本篇用一半篇幅讲的内容。读本篇前建议先看《进程：运行中的程序》，信号处理器的行为本质上是"进程状态机被内核插入的一段额外执行流"。

## 信号（Signals）

有一种时而有用的手段，能让一个进程"烦"另一个进程：信号。基本玩法是：一个进程可以"raise"（引发）一个信号并把它投递给另一个进程。目标进程的信号处理器（signal handler，其实就是一个函数）被调用，进程由此可以处理它。

这是一种与你熟悉的机制颇不相同的机制：你的程序本来欢快地跑着自己的活儿，然后一个信号来了，程序被打断。你的代码可能正在函数里把 π 算到 1.21 千兆位小数，突然它停下，控制权转去执行你写的另一个函数（信号处理器）来处理这个信号。

处理器返回之后，控制权跳回 π 计算，从断点继续。或者程序干脆终止了！这取决于信号本身，以及你决定如何处理它（处理与否）。

当然，细节是魔鬼：实际上你在信号处理器里被允许安全做的事情相当有限。尽管如此，信号提供了一个有用的服务。

比如，一个进程可能想临时停住另一个进程，这可以通过向它发送 `SIGSTOP` 信号实现；要继续，进程得收到 `SIGCONT` 信号。进程怎么知道收到某个信号时该做什么？很多信号是预定义的，进程有默认的信号处理器来对付它们。

默认处理器？对。拿 `SIGINT` 举例：这是用户按下 CTRL-C 时进程收到的中断信号，`SIGINT` 的默认信号处理器会让进程退出！听着耳熟吧？你可以想象，你可以覆盖（override）`SIGINT`，让它做任何你想做的事（或者什么都不做）。你可以让你的进程打印 "Interrupt?! No way, Jose!" 然后继续忙自己的。

所以现在你知道了：你的进程可以用你想要的几乎任何方式响应几乎任何信号。自然，例外是有的——不然这世界也太容易懂了。拿最受欢迎的 `SIGKILL`（9 号信号）来说：你敲过 "kill -9 nnnn" 来杀死失控进程 nnnn 吗？你发送的就是 `SIGKILL`。你大概也记得没有任何进程能从 "kill -9" 里逃脱——你是对的。`SIGKILL` 是你不能给它写自己的信号处理器的信号之一；前述的 `SIGSTOP` 也属于此类。

（题外话：你经常在用 Unix 的 kill 命令时不指定要发送的信号……那它发的是什么？答案：`SIGTERM`。你可以给 `SIGTERM` 写自己的处理器，这样进程就不理会普通的 "kill"，用户必须用 "kill -9" 才能结束它。）

所有信号都是预定义的吗？如果你想发给进程一个只有你自己懂其含义的信号怎么办？除了少数保留信号之外，还有两个信号专门留给用户：`SIGUSR1` 和 `SIGUSR2`。你可以随意使用并按你选择的方式处理它们。（例如，我的 CD 播放程序收到 `SIGUSR1` 就切到下一轨，这样我就能在命令行里敲 "kill -SIGUSR1 nnnn" 控制它。）

### 捕获信号

你猜得到，Unix 的 "kill" 命令是向进程发信号的一种方式。出于令人难以置信的巧合，恰好有个叫 `kill()` 的系统调用干同样的事：参数是信号编号（定义在 signal.h 里）和进程 ID。此外还有个库函数 `raise()`，可以在**同一进程内**引发信号。

火烧眉毛的问题是：怎么接住一记飞驰而来的 `SIGTERM`？你需要调用 `sigaction()`，把你想捕获哪个信号、想调用哪个函数来处理等细节告诉它。

`sigaction()` 的函数原型拆解如下：

```c
int sigaction(int sig, const struct sigaction *act,
              struct sigaction *oact);
```

第一个参数 `sig` 是要捕获的信号，可以（也许"应该"）用 signal.h 里的符号名，如 `SIGINT`。这没什么难的。

下一个参数 `act` 是指向 `struct sigaction` 的指针，这个结构有一堆字段可以填，用来控制信号处理器的行为（包括指向信号处理器函数本身的指针）。

最后的 `oact` 可以为 NULL；如果不为 NULL，它会返回设置之前旧的信号处理器信息——想在日后恢复先前处理器时有用。

我们关注 `struct sigaction` 的这三个字段：

| 字段 | 说明 |
|---|---|
| `sa_handler` | 信号处理器函数 |
| `sa_mask` | 处理本信号期间要屏蔽的其他信号集合 |
| `sa_flags` | 修改处理器行为的标志，或 0 |

`sa_handler` 是指向"返回 void、带单个 int 参数"的函数的指针（该参数是它正在处理的信号编号）。也可以指定 `SIG_IGN` 忽略该信号，或 `SIG_DFL` 恢复默认动作。

那 `sa_mask` 呢？处理一个信号时，你可能想阻止其他信号被投递，这可以通过把它们加进 `sa_mask` 来实现。它是个"集合"，可以用常规的集合操作来操纵：`sigemptyset()`、`sigfillset()`、`sigaddset()`、`sigdelset()` 和 `sigismember()`。本例中我们只清空集合、不屏蔽任何其他信号。

例子永远有帮助！下面这个处理 `SIGINT`（按下 ^C 时投递）的程序，叫 sigint.c：

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>

void sigint_handler(int sig)
{
    (void)sig;
    const char msg[] = "Ahhh! SIGINT!\n";
    write(1, msg, sizeof msg - 1);
}

int main(void)
{
    char s[200];
    struct sigaction sa = {
        .sa_handler = sigint_handler,
        .sa_flags = 0, // 或 SA_RESTART
    };
    sigemptyset(&sa.sa_mask);

    if (sigaction(SIGINT, &sa, NULL) == -1) {
        perror("sigaction");
        exit(1);
    }

    printf("Enter a string:\n");

    if (fgets(s, sizeof s, stdin) == NULL)
        perror("fgets");
    else
        printf("You entered: %s\n", s);

    return 0;
}
```

这个程序有两个函数：设置信号处理器（用 `sigaction()` 调用）的 `main()`，以及处理器本身 `sigint_handler()`。

运行它会怎样？如果你正在输入字符串时按下 ^C，对 `fgets()` 的调用失败并把全局变量 `errno` 设为 `EINTR`；同时 `sigint_handler()` 被调用、执行它的例程，于是你实际看到：

```
Enter a string:
the quick brown fox jum^CAhhh! SIGINT!
fgets: Interrupted system call
```

然后程序退出。嘿——这算什么处理器，最后还是退出了？

这里有几件事在起作用。第一，处理器确实被调用了——它打印了 "Ahhh! SIGINT!"。但随后 `fgets()` 返回错误 `EINTR`（"Interrupted system call"）。你瞧，有些系统调用可以被信号打断，打断时它们返回错误。你可能会见到这样的代码（有时被称为"goto 的可原谅用法"）：

```c
restart:
    if (some_system_call() == -1) {
        if (errno == EINTR) goto restart;
        perror("some_system_call");
        exit(1);
    }
```

与其那样用 goto，你或许可以把 `sa_flags` 设为包含 `SA_RESTART`。例如把我们的 SIGINT 处理器代码改成：

```c
    sa.sa_flags = SA_RESTART;
```

再跑就像这样：

```
Enter a string:
Hello^CAhhh! SIGINT!
Er, hello!^CAhhh! SIGINT!
This time fer sure!
You entered: This time fer sure!
```

有些系统调用可被打断，有些可以自动重启。这取决于具体系统。

### 那么 signal() 呢

ANSI C 定义了一个叫 `signal()` 的函数，可用于捕获信号。它不如 `sigaction()` 可靠、也不如其功能齐全，所以一般不鼓励使用 `signal()`。

### 一些让你受欢迎的信号

下面是你（大概率）可用的信号清单：

| 信号 | 说明 |
|---|---|
| SIGABRT | 进程终止（abort）信号 |
| SIGALRM | 闹钟 |
| SIGFPE | 错误的算术运算 |
| SIGHUP | 挂断 |
| SIGILL | 非法指令 |
| SIGINT | 终端中断信号 |
| SIGKILL | 杀死（不能被捕获或忽略） |
| SIGPIPE | 向无人读取的管道写入 |
| SIGQUIT | 终端退出信号 |
| SIGSEGV | 无效内存引用 |
| SIGTERM | 终止信号 |
| SIGUSR1 | 用户自定义信号 1 |
| SIGUSR2 | 用户自定义信号 2 |
| SIGCHLD | 子进程终止或停止 |
| SIGCONT | 若已停止则继续执行 |
| SIGSTOP | 停止执行（不能被捕获或忽略） |
| SIGTSTP | 终端停止信号 |
| SIGTTIN | 后台进程尝试读取 |
| SIGTTOU | 后台进程尝试写入 |
| SIGBUS | 总线错误 |
| SIGPOLL | 可轮询事件 |
| SIGPROF | 性能分析计时器到期 |
| SIGSYS | 坏的系统调用 |
| SIGTRAP | 跟踪/断点陷阱 |
| SIGURG | 套接字上有高带宽数据到达 |
| SIGVTALRM | 虚拟计时器到期 |
| SIGXCPU | 超出 CPU 时间限制 |
| SIGXFSZ | 超出文件大小限制 |

每个信号都有自己的默认信号处理器，其行为定义在本地 man 手册里。

### 重入之龙（The Dragons of Reentrancy）

如果你正忙着用某个全局或静态数据（姑且叫变量 alvin），然后被打断了——如果处理器也去改 alvin 会怎样？处理器返回后，alvin 已经在你背后被动过了，而你的函数对此一无所知！更糟的是，大型数据结构可能在处理器被调用时只写了一半，造成撕裂（tearing）和可怕的状态搅乱。

这些称为**重入问题**（reentrancy problems）。

什么意思？请允许我偷懒引用维基百科关于重入的词条：

> 可重入（reentrant）代码被设计为在同时或快速连续调用同一函数的多个实例时依然安全、可预期。如果一个程序或子例程的多次调用可以安全地在多个处理器上并发运行，或者（在单处理器系统上）它的执行可以被打断、并安全地重新开始一次新的执行（可以被"重入"），就称其为可重入的。中断可以由内部动作（如跳转或调用）引起，也可以由外部动作（如中断或信号）引起。

这里有个刻意构造的例子（节选）。对异步信号而言，`increment()` 函数不是可重入的。

想象 `increment()` 函数慢悠悠地递增全局的 count。但是等等！如果信号处理器此刻触发，它会把 count 设成 `increment()` 没料到的值！然后事情就炸了。

（`volatile sig_atomic_t` 稍后讲；现在先当它是 int。）

```c
volatile sig_atomic_t count;

void handler(int sig)
{
    (void)sig;

    count = 123;
}

void increment(void)
{
    int next_count = count + 1;

    printf("Count is %d, next should be %d\n", count, next_count);

    // 睡眠以放慢时间、演示问题
    sleep(2);
    count++;

    if (count == next_count)
        puts("Everything is swell!");
    else
        printf("%d != %d! Aaa! ERROR DOES NOT COMPUTE!\n", count,
            next_count);
}
```

要点：任何时候你依赖某种共享状态，而信号处理器也会动那份共享状态，信号就可能给你惹麻烦。

另一个例子用 `strtok()`——一个出了名的不可重入函数：

```c
void handler(int sig)
{
    (void)sig;

    char x[] = "Hello, world!";
    char *token;

    if ((token = strtok(x, " ")) != NULL) do {
        write(1, "In handler: ", 12);
        write(1, token, strlen(token));
        write(1, "\n", 1);
    } while ((token = strtok(NULL, " ")) != NULL);
}

void tokenizer(void)
{
    char s[] = "The quick brown fox jumped over the lazy dogs";
    char *token;

    if ((token = strtok(s, " ")) != NULL) do {
        printf("In main: %s\n", token);
        // 睡眠以放慢时间、演示问题
        sleep(1);
    } while ((token = strtok(NULL, " ")) != NULL);

    puts("Done tokenizing");
}
```

假设 `tokenizer()` 运行两秒后信号处理器被调用。`handler()` 对自己的字符串做自己的分词并打印这些词。

如果一切顺利且合理，我们会看到这样的输出（但我们并没有）：

```
In main: The
In main: quick
In handler: Hello,
In handler: world!
In main: brown
In main: fox
In main: jumped
In main: over
In main: the
In main: lazy
In main: dogs
Done tokenizing
```

看到信号如何发生、被处理、然后 `tokenizer()` 从断点继续吗？那样就完美了，对吧？

实际上我们（大概）看到的是：

```
In main: The
In main: quick
In handler: Hello,
In handler: world!
Done tokenizing
```

剩下的呢？

原来 `strtok()` 在一个静态变量里维护内部状态。我们的 `tokenizer()` 期望状态是某种样子，信号处理器把它覆盖了，导致 `tokenizer()` 行为错乱。

这就使 `strtok()` 不可重入（连带我们的 `tokenizer()` 也不可重入）。

修法很简单：用一个没有内部共享状态的、可重入版的 strtok——我们有现成的：`strtok_r()`。用它时，状态由我们自己持有并传给它用。每段想要 strtok 循环的代码都有自己的状态，谁也不会踩到谁的脚。

`tokenizer()` 用 `strtok_r()` 的代码如下（`handler()` 类似）：

```c
    char *lasts;

    if ((token = strtok_r(s, " ", &lasts)) != NULL) do {
        printf("In main: %s\n", token);
        // 睡眠以放慢时间、演示问题
        sleep(1);
    } while ((token = strtok_r(NULL, " ", &lasts)) != NULL);
```

看到我们怎么用 `lasts` 跟踪自己的状态了吗？把演示程序里所有的 strtok 都换成 strtok_r，程序就能正确工作，因为 handler() 和 tokenizer() 用到的所有功能都可重入了。

### 共享全局数据

你不能安全地改动任何共享（如全局）数据，只有一个显著例外：声明为 `volatile sig_atomic_t` 存储类别和类型的变量。这是一个整数类型，能容纳一定范围的值；C 规范保证至少能存 0 到 127（含端点）。实际范围取决于系统以及该类型是否有符号（可以看 `SIG_ATOMIC_MIN` 和 `SIG_ATOMIC_MAX` 了解你的极限）。

规范非常保守——基本上说：除了给 `volatile sig_atomic_t` 类型的变量赋值，你对全局数据做的任何事都是"很坏"的。但这也不完全那么绝对。读这个变量多半也安全；但请注意，一旦你对同一个变量**既读又写**，取决于还有谁在读、改这些值，你无疑是在给自己挖竞态条件的坑。

另一个例外是**从不改变**的全局共享数据。如果你在安装信号处理器之前就设置好一些全局变量、并且从不改变它们，信号处理器可以放心读它们。它们可以是任意类型。

下面这个例子处理 `SIGUSR1`：设置一个全局标志，主循环里检查它以判断处理器是否被调用过。程序叫 sigusr.c：

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>

volatile sig_atomic_t got_usr1;

void sigusr1_handler(int sig)
{
    got_usr1 = 1;
}

int main(void)
{
    struct sigaction sa = {
        .sa_handler = sigusr1_handler,
        .sa_flags = 0, // 或 SA_RESTART
    };
    sigemptyset(&sa.sa_mask);

    got_usr1 = 0;

    if (sigaction(SIGUSR1, &sa, NULL) == -1) {
        perror("sigaction");
        exit(1);
    }

    while (!got_usr1) {
        printf("PID %d: working hard...\n", getpid());
        sleep(1);
    }

    printf("Done in by SIGUSR1!\n");

    return 0;
}
```

在一个窗口跑起来，然后在另一个窗口用 kill -USR1 "杀"它。sigusr 程序贴心地打印出自己的进程 ID，方便你传给 kill：

```
$ sigusr
PID 5023: working hard...
PID 5023: working hard...
PID 5023: working hard...
```

然后在另一个窗口给它发 SIGUSR1：

```
$ kill -USR1 5023
```

程序应当响应：

```
PID 5023: working hard...
PID 5023: working hard...
Done in by SIGUSR1!
```

（而且响应应当是即时的，哪怕 `sleep()` 刚被调用——sleep() 会被信号打断。）

这样组织代码有点反直觉。处理器不该包办全部处理逻辑吗？信号在其他无法处理它的代码运行时被引发怎么办？

这确实是缺点，但这样组织代码有一个大收获：拜拜了，重入问题！这可不是坏事。

#### 异步信号安全（Asynchronous Signal Safety）

鉴于你可能踩到的重入陷阱，在信号处理器里调用函数时必须小心——处理器修改任何其他函数可能在用的全局状态时同样如此。

那些函数必须是**异步信号安全**（async-signal-safe）的——大体意思是函数不做任何可能引发重入问题的事。

一般来说，如果你做了下面任何一件事，你多半就不异步信号安全：

- 在函数里修改非原子的全局变量；
- 读取非原子的非常量全局变量；
- 在函数或处理器里使用静态数据；
- 调用任何非异步信号安全的函数。

限制相当大。

你可能好奇，为什么前面的示例信号处理器用 `write()` 输出消息而不是 `printf()`。答案是：POSIX 规定 `write()` 是异步信号安全的（因此可以在处理器内安全调用），而 `printf()` 不是。

异步信号安全、可以在信号处理器内调用的库函数和系统调用有（深吸一口气）：`_Exit()`、`_exit()`、`abort()`、`accept()`、`access()`、`aio_error()`、`aio_return()`、`aio_suspend()`、`alarm()`、`bind()`、`cfgetispeed()`、`cfgetospeed()`、`cfsetispeed()`、`cfsetospeed()`、`chdir()`、`chmod()`、`chown()`、`clock_gettime()`、`close()`、`connect()`、`creat()`、`dup()`、`dup2()`、`execle()`、`execve()`、`fchmod()`、`fchown()`、`fcntl()`、`fdatasync()`、`fork()`、`fpathconf()`、`fstat()`、`fsync()`、`ftruncate()`、`getegid()`、`geteuid()`、`getgid()`、`getgroups()`、`getpeername()`、`getpgrp()`、`getpid()`、`getppid()`、`getsockname()`、`getsockopt()`、`getuid()`、`kill()`、`link()`、`listen()`、`lseek()`、`lstat()`、`mkdir()`、`mkfifo()`、`open()`、`pathconf()`、`pause()`、`pipe()`、`poll()`、`posix_trace_event()`、`pselect()`、`raise()`、`read()`、`readlink()`、`recv()`、`recvfrom()`、`recvmsg()`、`rename()`、`rmdir()`、`select()`、`sem_post()`、`send()`、`sendmsg()`、`sendto()`、`setgid()`、`setpgid()`、`setsid()`、`setsockopt()`、`setuid()`、`shutdown()`、`sigaction()`、`sigaddset()`、`sigdelset()`、`sigemptyset()`、`sigfillset()`、`sigismember()`、`sleep()`、`signal()`、`sigpause()`、`sigpending()`、`sigprocmask()`、`sigqueue()`、`sigset()`、`sigsuspend()`、`sockatmark()`、`socket()`、`socketpair()`、`stat()`、`symlink()`、`sysconf()`、`tcdrain()`、`tcflow()`、`tcflush()`、`tcgetattr()`、`tcgetpgrp()`、`tcsendbreak()`、`tcsetattr()`、`tcsetpgrp()`、`time()`、`timer_getoverrun()`、`timer_gettime()`、`timer_settime()`、`times()`、`umask()`、`uname()`、`unlink()`、`utime()`、`wait()`、`waitpid()`、`write()`。

当然，你可以在信号处理器内调用自己的函数（只要它们异步信号安全、且不调用任何非异步信号安全的函数）。

### 我一笔带过了什么

几乎全部。还有海量的标志、实时信号、信号与线程的混用、信号屏蔽、longjmp() 与信号等等。本章够写一整本指南的！

当然这只是"入门"指南，最后再塞给你一些更多信息：man 手册里可以深挖——处理信号：`sigaction()`、`sigwait()`、`sigwaitinfo()`、`sigtimedwait()`、`sigsuspend()`、`sigpending()`；投递信号：`kill()`、`raise()`、`sigqueue()`；集合操作：`sigemptyset()`、`sigfillset()`、`sigaddset()`、`sigdelset()`、`sigismember()`；其他：`sigprocmask()`、`sigaltstack()`、`siginterrupt()`、`sigsetjmp()`、`siglongjmp()`、`signal()`。

## 小结

信号是三条 IPC 通道里唯一"不带数据"的那条：它的价值不在传输，而在**打断**——让内核在一个明确的点上，把一个事件塞进你的进程。用好它的全部纪律可以压成三句：用 `sigaction()` 而不是 `signal()`；处理器里只置标志位，把实际工作留主循环；凡是可能重入的东西（`printf()`、`malloc()`、全局状态）一律不进处理器。

进程之间除了通知，还得真正传数据——那是《管道、FIFO 与共享内存》的内容；而当多个执行流开始争抢同一份资源、并且互相等待时，就会撞上《死锁与同步》。

## 编者补充

> 本节为站点编者补充，串联前后篇目与工程场景，非原文翻译。

- **SIGTERM/SIGKILL 就是容器编排的日常**：Kubernetes 删 Pod 时先发 `SIGTERM`、宽限期（`terminationGracePeriodSeconds`）过后补 `SIGKILL`——正好对应本文"可捕获"与"不可捕获"两类信号的分界。推理服务必须在 SIGTERM 处理器里"停止接新请求、排空在途请求、再退出"（uvicorn 的 graceful shutdown 就是这么实现的）；被 SIGKILL 时什么都来不及做，所以长任务要配合 checkpoint。
- **不可捕获的 SIGKILL 与显存泄漏**：`kill -9` 一个卡死的推理进程后显存能被释放，靠的是内核回收该进程全部资源（进程退出是内核行为，不依赖被杀进程配合）——这是"进程 = 内核管理的资源容器"这一抽象（《进程：运行中的程序》）的直接体现。
- **Python/Java 里的信号在哪**：`signal.signal()`（Python，只能在主线程注册）、JVM 的 `Runtime.addShutdownHook()`（对应 SIGTERM 的"优雅退出窗口"，但 SIGKILL 不会触发任何 hook）——本文的"处理器里只做最小动作"纪律，落到应用层就是"shutdown hook 里别启动新任务、只排空与上报"。

---

> **来源**：本篇翻译自 [Beej's Guide to Interprocess Communication](https://beej.us/guide/bgipc/html/split/signals.html) 第 3 章 Signals（[beej.us/guide/bgipc](https://beej.us/guide/bgipc/)），作者 Brian "Beej Jorgensen" Hall，许可 CC BY-NC-ND 3.0（作者在许可中明确允许对本指南进行忠实翻译，但要求转载指南全文；本译文为署名学习用途的节译，特此说明并致谢）。异步信号安全函数清单与 `sigaction()`/`SA_RESTART` 细节可对照 [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html) 与 [sigaction(2)](https://man7.org/linux/man-pages/man2/sigaction.2.html)（Linux man-pages，GPL-2.0-or-later）复核。抓取于 2026-09-13。原《信号与进程间通信 IPC》一篇按主题分为三篇，本篇收录其中的信号部分，译文内容未作删减。
