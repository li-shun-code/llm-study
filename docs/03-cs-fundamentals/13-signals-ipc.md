---
title: 信号与进程间通信 IPC
source_url: https://beej.us/guide/bgipc/html/split/signals.html
author: Brian “Beej Jorgensen” Hall（Beej's Guide to Unix IPC：Signals、Pipes、FIFOs、System V Shared Memory Segments 章；死锁一节译自 OSTEP 第 32 章）
license: CC BY-NC-ND 3.0（含官方翻译例外条款）
fetched_at: 2026-09-13
translated: true
order: 13
group: 操作系统：进程、线程与并发
---
上一节"并发与锁"讲的是**同一进程内**线程之间的同步；这一节把视角抬高一层：**不同进程之间**怎么交流。进程不共享内存（这正是进程与线程的本质区别），所以操作系统为它们准备了另一套交流手段——信号（signal）、管道（pipe）、FIFO（命名管道）、共享内存（shared memory）。本文翻译 Beej's Guide to Unix IPC 的核心章节，并从 OSTEP《Common Concurrency Problems》一章完整翻译"死锁"作为其中一节。

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

## 死锁：并发 bug 的经典形态（译自 OSTEP 第 32 章）

讲完信号这种"打断式"的进程交流，再看多把锁交织时的经典灾难：**死锁**（deadlock）。这是许多采用复杂锁协议的并发系统中出现的老大难问题。比如：线程 1 持有锁 L1 并等待另一个锁 L2；不幸的是，持有 L2 的线程 2 正在等 L1 被释放。演示潜在死锁的代码片段如下：

```
线程 1：                    线程 2：
pthread_mutex_lock(L1);     pthread_mutex_lock(L2);
pthread_mutex_lock(L2);     pthread_mutex_lock(L1);
```

注意：这段代码运行时死锁并不必然发生；它**可能**发生——比如线程 1 拿到 L1 之后发生上下文切换到线程 2，线程 2 拿到 L2、尝试拿 L1。于是死锁出现：每个线程都在等对方、谁也动不了。用依赖图描述的话，图中出现**环**（cycle）即指示死锁的存在。

> **问题的核心：如何对付死锁**
> 我们该如何构建系统来预防、避免、或至少检测并从死锁中恢复？这在今天的系统里是真问题吗？

### 死锁为何发生

你可能会想：上面那种简单死锁看起来很容易避免嘛——比如线程 1 和线程 2 都保证按相同顺序拿锁，死锁永远不会发生。那死锁为什么还会发生？

原因之一是：在大型代码库中，组件之间会产生复杂的依赖。拿操作系统举例：虚拟内存系统可能需要访问文件系统才能从磁盘调页（page in）一个块；文件系统随后可能又需要一页内存来存放读入的块，于是又去找虚拟内存系统。因此大型系统中锁策略的设计必须小心，以避免代码中自然出现的循环依赖引发死锁。

另一个原因关乎**封装**的本质。作为软件开发者，我们被教导要隐藏实现细节、从而以模块化方式更容易地构建软件。不幸的是，这种模块化与锁合不来。正如 Jula 等人指出的，有些看似无害的接口几乎是在"邀请"你死锁。比如 Java 的 Vector 类和 `AddAll()` 方法，调用方式如下：

```java
Vector v1, v2;
v1.AddAll(v2);
```

在内部，因为这个方法必须多线程安全，它需要同时拿住"被加入的 vector"（v1）和"参数"（v2）两把锁。该例程按某种任意顺序（比如先 v1 后 v2）获取这些锁，把 v2 的内容加入 v1。如果另一个线程几乎同时调用 `v2.AddAll(v1)`，死锁的隐患就埋下了——而且这一切对调用方应用来说相当隐蔽。

### 死锁发生的四个条件

死锁要发生，需要四个条件同时成立（Coffman 等）：

- **互斥**（mutual exclusion）：线程对所需资源（如拿到的锁）主张排他控制权。
- **持有并等待**（hold-and-wait）：线程在等待新资源（如想拿的锁）的同时，持有已分配给它们的资源（如已获得的锁）。
- **非抢占**（no preemption）：资源（如锁）不能从持有它的线程那里被强行夺走。
- **循环等待**（circular wait）：存在一条线程的循环链，链上每个线程都持有一条或多条资源（锁），而这些资源正是链上下一个线程所请求的。

这四个条件只要有一个不成立，死锁就不可能发生。因此我们首先探索**预防**死锁的技术——每种策略都试图阻止上述某个条件出现，从而都是处理死锁问题的一种进路。

### 预防（Prevention）

#### 循环等待

最实用的预防技术（无疑也是最常被采用的）是让你写锁代码时**永不引入循环等待**。最直接的做法：给锁的获取规定一个**全序**（total ordering）。比如系统里只有两把锁 L1 和 L2，那就规定总是先 L1 后 L2——严格顺序保证不会出现环状的等待，因此无死锁。

当然，更复杂的系统里锁不止两把，全序可能难以做到（或许也没必要），此时**偏序**（partial ordering）也是组织锁获取、避免死锁的有用方式。一个出色的真实例子是 Linux 的内存映射代码（v5.2）：源码顶部的注释列出了十组不同的锁获取顺序，从简单的 "i_mutex before i_mmap_rwsem" 到复杂的 "i_mmap_rwsem before private_lock before swap_lock before i_pages lock"。

可以想见，无论全序还是偏序，都需要仔细设计锁策略、小心翼翼地构建。而且顺序只是**约定**，粗心的程序员可以轻易无视锁协议、埋下死锁。此外，锁排序要求对代码库及各例程的调用方式有深入理解——一个疏忽就可能导致那个以 "D" 开头的词。

> **技巧：用锁的地址来强制加锁顺序**
> 有时一个函数必须抓两把（或更多）锁，于是我们知道必须小心，否则可能死锁。想象一个按 `do_something(mutex_t *m1, mutex_t *m2)` 形式调用的函数。如果代码总是先 m1 后 m2（或反之）来抓锁，它可能死锁——因为一个线程可能调 `do_something(L1, L2)`，另一个线程却调 `do_something(L2, L1)`。
> 为避免这个问题，聪明的程序员可以用每把锁的**地址**作为获取顺序的依据。按地址从高到低（或从低到高）获取锁，`do_something()` 就能保证无论调用者传参顺序如何，都按同一顺序拿锁。代码形如：
> ```c
> if (m1 > m2) { // 按地址从高到低获取
>     pthread_mutex_lock(m1);
>     pthread_mutex_lock(m2);
> } else {
>     pthread_mutex_lock(m2);
>     pthread_mutex_lock(m1);
> }
> // 代码假设 m1 != m2（不是同一把锁）
> ```
> 用这个简单技巧，程序员就能确保一个简单高效、无死锁的多锁获取实现。

#### 持有并等待

死锁的"持有并等待"条件可以这样规避：**原子地**一次性获取所有锁。实践中可以这样做：

```c
pthread_mutex_lock(prevention); // 开始获取
pthread_mutex_lock(L1);
pthread_mutex_lock(L2);
...
pthread_mutex_unlock(prevention); // 结束
```

先抓住 prevention 这把锁，代码就保证锁获取过程中不会发生不合时宜的线程切换，死锁再次得以避免。当然，它要求任何线程任何时候抓任何锁，都要先拿全局的 prevention 锁。比如另一个线程想以不同顺序拿 L1、L2 也没问题，因为它在此期间一直持有 prevention 锁。

注意这个方案有一堆问题。和前面一样，封装与我们作对：调用例程时，这一招要求我们确切知道必须持有哪些锁、并提前拿全。这个技术还很可能**降低并发**，因为所有锁都必须提前一次性获取，而不是在真正需要时才拿。

#### 非抢占

因为我们一般把锁看作"持有到 unlock 被调用为止"，多锁获取常让我们陷入麻烦：等一把锁时手里还攥着另一把。许多线程库提供了更灵活的接口来避开这种局面。具体地，`pthread_mutex_trylock()` 例程要么拿到锁（若可用）并返回成功，要么返回一个错误码表示锁已被持有；后者情况下，你可以稍后再试。

这样的接口可以用来构建无死锁、且对加锁顺序健壮的获取协议：

```c
top:
pthread_mutex_lock(L1);
if (pthread_mutex_trylock(L2) != 0) {
    pthread_mutex_unlock(L1);
    goto top;
}
```

注意另一个线程也可以遵循同一协议但按相反顺序拿锁（先 L2 后 L1），程序仍然无死锁。不过新问题出现了：**活锁**（livelock）。两个线程可能（虽然概率不大）都在反复尝试这套序列、又反复拿不齐两把锁。此时两个线程都在一遍遍跑这段代码（所以这不是死锁），却没有进展，故名活锁。活锁也有解法：比如在跳回重试之前加一个随机延迟，降低竞争线程之间反复互相干扰的概率。

关于这个方案还有一点：它绕开了 trylock 方法的困难部分。第一个麻烦仍然是封装：如果其中一把锁埋在被调用的某个例程深处，"跳回开头"就复杂了。如果代码在途中已经获得了某些资源（L1 之外的），它必须小心地把它们也一并释放——例如拿到 L1 后分配了内存，拿不到 L2 就得先释放内存，再跳回顶部重试整段序列。不过在受限场景下（如前文提到的 Java vector 方法），这类方法可以工作得很好。

你也许注意到：这一招其实并没有真正引入"抢占"（把锁从持有者手里强行夺走的强制行为），而是用 trylock 让开发者能**优雅地退出**自己对锁的持有（即"抢占自己"）。但它是实用的，所以尽管在这方面不完美，我们仍把它收在这里。

#### 互斥

最后一种预防技术是干脆避免互斥的需求。一般来说这很难，因为我们想跑的代码确实有临界区。那能做什么？

Herlihy 的想法是：可以设计各种**完全不用锁**的数据结构。这些无锁（lock-free，以及相关的无等待 wait-free）方法的思路很简单：借助强大的硬件指令，可以以不需要显式加锁的方式构建数据结构。

举个简单例子。假设我们有一条 compare-and-swap 指令——如你所记，这是硬件提供的原子指令，行为如下：

```c
int CompareAndSwap(int *address, int expected, int new) {
    if (*address == expected) {
        *address = new;
        return 1; // 成功
    }
    return 0;     // 失败
}
```

假如我们想用 compare-and-swap 把某个值原子地加上一定量，可以这样写：

```c
void AtomicIncrement(int *value, int amount) {
    do {
        int old = *value;
    } while (CompareAndSwap(value, old, old + amount) == 0);
}
```

我们没有"拿锁—更新—放锁"，而是构造了一种反复尝试把值更新为新数量、并用 compare-and-swap 来完成的方式：没有获取任何锁，也就不可能死锁（活锁仍有可能，所以健壮的实现会比上面这段简单代码复杂）。

再看一个稍复杂的例子：链表插入。下面是头插代码：

```c
void insert(int value) {
    node_t *n = malloc(sizeof(node_t));
    assert(n != NULL);
    n->value = value;
    n->next = head;
    head = n;
}
```

代码做的是简单插入，但若多线程"同时"调用它，就有竞态条件——画一张图想想并发插入会把链表搞成什么样（当然，假设恶意调度交错）。我们当然可以用传统的拿锁/放锁包住这段代码：

```c
void insert(int value) {
    node_t *n = malloc(sizeof(node_t));
    assert(n != NULL);
    n->value = value;
    pthread_mutex_lock(listlock); // 临界区开始
    n->next = head;
    head = n;
    pthread_mutex_unlock(listlock); // 临界区结束
}
```

或者试试只用 compare-and-swap 做无锁插入：

```c
void insert(int value) {
    node_t *n = malloc(sizeof(node_t));
    assert(n != NULL);
    n->value = value;
    do {
        n->next = head;
    } while (CompareAndSwap(&head, n->next, n) == 0);
}
```

这段代码把 next 指针指向当前 head，然后尝试把新建节点换入成为新的表头；如果期间别的线程成功换入了新表头，CompareAndSwap 失败，本线程用新表头重试。

当然，构建有用的链表不止插入一项；能以无锁方式完成插入、删除、查找的链表绝非易事——无锁与无等待同步的文献相当丰富，值得深读。

### 通过调度避免死锁（Deadlock Avoidance via Scheduling）

某些场景下，比起预防，**避免**（avoidance）更可取。避免需要对"各线程在执行中可能会抓哪些锁"有全局了解，然后据此调度线程，保证死锁不可能发生。

例如，两个处理器、四个线程待调度。再假设我们知道：T1 会抓 L1 和 L2，T2 也抓 L1 和 L2，T3 只抓 L2，T4 一把锁都不抓。把这些锁需求列表：

|   | T1 | T2 | T3 | T4 |
|---|---|---|---|---|
| L1 | 是 | 是 | 否 | 否 |
| L2 | 是 | 是 | 是 | 否 |

聪明的调度器由此可以算出：只要 T1、T2 不同时运行，死锁就永远不会发生。比如把 T1 和 T2 安排在不同 CPU 上串行，T3、T4 随意搭配。注意 (T3 和 T1) 或 (T3 和 T2) 重叠是没问题的：T3 虽然抓 L2，但它只抓一把锁，与其他线程并发跑也绝不会导致死锁。

再看一个例子——同样的资源（L1、L2）竞争更激烈：T1、T2、T3 都要在某个时点同时抓 L1 和 L2。一个保证无死锁的调度是：T1、T2、T3 全部塞进同一个处理器串行执行，T4 放另一处理器。可以看到，静态调度导向保守方案：总完成时长被大大拉长。尽管并发运行这些任务本是可能的，对死锁的恐惧阻止了我们，代价就是性能。

这类方法的著名例子是 Dijkstra 的银行家算法（Banker's Algorithm），文献里还有许多类似方案。不幸的是，它们只在非常受限的环境中有用——例如嵌入式系统，其中你完全知道要运行的整个任务集合及各自需要的锁。而且，如第二个例子所示，这类方法会限制并发。因此，通过调度来避免死锁并不是广泛使用的通用方案。

### 检测并恢复（Detect and Recover）

最后一种通用策略：允许死锁偶尔发生，检测到之后再采取行动。比如操作系统一年死机一次，你重启它，然后（高高兴兴或骂骂咧咧地）继续干活。如果死锁罕见，这种"非解之解"确实相当务实。

许多数据库系统采用死锁检测与恢复技术：死锁检测器周期性运行，构建资源图并检查环。发现环（死锁）时重启系统；若需要先对数据结构做更精细的修复，可能还要人介入以简化流程。

> **技巧：不必事事追求完美（Tom West 定律）**
> Tom West 因经典计算机行业著作《Soul of a New Machine》的主人公而闻名，他有句名言："不是所有值得做的事都值得做好。"这是极好的工程格言。如果一件坏事很少发生，当然不该花大力气去预防它——尤其当它发生的代价很小。反过来，如果你在造航天飞机、出错的代价是机毁人亡，那你或许该无视这条建议。
> 有读者会抗议："你这是在把平庸当方案！"或许吧，这类建议确实要小心对待。但经验告诉我们：在工程的世界里，面对紧迫的截止日期与其他现实约束，你总得决定系统的哪些方面要做好、哪些先放一放。难就难在知道什么情况下做什么——这一点点洞见，只能靠经验与对任务的投入来获得。

OSTEP 对本章的总结同样适用于 IPC 场景：实践中最好的方案是**保持小心、建立锁获取顺序**，从一开始就杜绝死锁；无等待方法前景可期，但缺乏通用性；也许最好的出路是新的并发编程模型（如 MapReduce）——锁天生就是麻烦，除非真的必须，否则我们应当设法不用它。

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

把本篇放进模块的脉络里：线程要的是锁与条件变量，进程要的是另一套武器——信号把异步事件打断式地送进你的程序；管道与 FIFO 以字节流传递数据（fork 建立亲缘、mkfifo 打破亲缘）；共享内存让无关进程直接读写同一块物理内存，而它的正确性又要回到锁与那一节讲的死锁预防上。

## 编者补充

> 本节为站点编者补充，串联前后篇目与 LLM 应用场景，非原文翻译。

- **SIGTERM/SIGKILL 就是容器编排的日常**：Kubernetes 删 Pod 时先发 `SIGTERM`、宽限期（`terminationGracePeriodSeconds`）过后补 `SIGKILL`——正好对应本文"可捕获"与"不可捕获"两类信号的分界。推理服务必须在 SIGTERM 处理器里"停止接新请求、排空在途请求、再退出"（uvicorn 的 graceful shutdown 就是这么实现的）；被 SIGKILL 时什么都来不及做，所以长任务要配合 checkpoint。
- **不可捕获的 SIGKILL 与显存泄漏**：`kill -9` 一个卡死的推理进程后显存能被释放，靠的是内核回收该进程全部资源（进程退出是内核行为，不依赖被杀进程配合）——这是"进程 = 内核管理的资源容器"这一抽象（上一篇《进程》）的直接体现。
- **管道即 Agent 工具**：Agent 执行 `ps aux | grep python` 这类 shell 工具时，shell 用 `pipe()` + `fork()` + `exec()` + `dup()` 把两个命令接起来——本文"ls | wc -l"一例就是这个机制的完整拆解。
- **共享内存是 GPU 时代 IPC 的主角**：`torch.multiprocessing`、vLLM 的前后端进程间传张量，走的都是共享内存（或其上的 ZeroMQ 等封装）——拷贝几十 GB 权重走管道不可接受，让两个进程映射同一块物理内存才能零拷贝。别忘了本文的提醒：多进程共享可写内存时，正确性又回到上一篇的锁与死锁纪律上。

---

> **来源**：本文翻译自 [Beej's Guide to Interprocess Communication](https://beej.us/guide/bgipc/html/split/signals.html)（第 3 章 Signals、第 5 章 Pipes、第 6 章 FIFOs、第 11 章 System V Shared Memory Segments，[beej.us/guide/bgipc](https://beej.us/guide/bgipc/)），作者 Brian "Beej Jorgensen" Hall，许可 CC BY-NC-ND 3.0（作者在许可中明确允许对本指南进行忠实翻译，但要求转载指南全文；本译文为署名学习用途的节译，特此说明并致谢）。死锁一节翻译自《Operating Systems: Three Easy Pieces》第 32 章 [Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-deadlock.pdf)（OSTEP 官网免费章节），作者 Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
