---
title: 条件变量与信号量
source_url: https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf
author: Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau（OSTEP《操作系统导论》第 30 章 Condition Variables、第 31 章 Semaphores）
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-19
translated: true
versions: Linux NPTL（pthreads）；POSIX.1-2008 语义；Java 21 虚拟线程语境见文末编者补充
order: 30
group: 操作系统：进程、线程与并发
---

《并发与锁》回答了"谁能进临界区"，本篇回答另一个同样高频的问题：**怎么等待某个条件成立**。典型形状是"队列空了就睡，等生产者放入元素再被叫醒"。这类"等待—唤醒"的交互用自旋锁实现既烧 CPU 又危险，操作系统给出的两件标准武器是**条件变量**（condition variable）与**信号量**（semaphore）。

本篇译自 OSTEP 第 30 章（Condition Variables）与第 31 章（Semaphores）全文，保留原文的完整推导与全部示例（有界缓冲区、读者-写者锁、哲学家就餐、线程限流、信号量的内核实现），并在文末补一节"工程落地"：Java/Python 的对应 API、POSIX 与 Linux 实现细节、以及最容易踩的三类坑。

前置要求：读过《并发与锁》（锁、互斥量、自旋 vs 睡眠）。如果你更关心"多个线程互相等待时怎么不陷入僵局"，那是《死锁与同步》。

## 一、条件变量（OSTEP 第 30 章）

### 30.1 定义与例程（Definition and Routines）

条件变量是一种**新的同步变量**，线程可以在上面等待（wait）或通知（signal）。它本身**不提供互斥**——这正是与锁的根本区别。

POSIX 的 API 只有四个：

```c
int pthread_cond_init(pthread_cond_t *cv, pthread_condattr_t *attr);  /* 初始化 */
int pthread_cond_wait(pthread_cond_t *cv, pthread_mutex_t *m);        /* 解锁 m 并睡下 */
int pthread_cond_signal(pthread_cond_t *cv);                          /* 唤醒一个等待者 */
int pthread_cond_broadcast(pthread_cond_t *cv);                       /* 唤醒全部等待者 */
int pthread_cond_destroy(pthread_cond_t *cv);                         /* 销毁 */
```

`pthread_cond_wait()` 是关键，它原子地做完三件事：持有锁的线程**释放锁**、把自己加入条件变量的等待队列、睡下去；被唤醒后，它在返回之前**重新获取那把锁**。正因为这个原子性，"我检查条件"与"我开始等待"之间不会插进别人的状态修改。

OSTEP 用一句话点破了配套纪律：**每个条件变量都必须配一把互斥锁**，这个组合称为**谓程（monitor）**。用伪代码表达的标准形状是：

```c
pthread_mutex_lock(&m);
while (cond == false) {          /* 注意：必须是 while，不能是 if */
    pthread_cond_wait(&cv, &m);  /* 释放 m、睡眠；醒来后重新持有 m */
}
/* 在锁的保护下使用共享状态 */
pthread_mutex_unlock(&m);
```

**为什么是 `while` 而不是 `if`？** 两个原因：其一是**虚假唤醒**（spurious wakeup，POSIX 明确允许 `wait` 在没人 signal 时返回）；其二是更常见的**惊群后失手**（Mesa 语义）：`signal` 只把等待者从"睡眠"搬到"抢锁"，被唤醒的线程醒来时条件可能已被先到的一步线程消费掉。Linux/Java 用的都是这种"Mesa 式"语义，因此醒来必须**重新检查条件**。

### 30.2 生产者/消费者（有界缓冲区）问题

OSTEP 的完整例子：一个长度为 `bufsize` 的循环缓冲，生产者满时等待、消费者空时等待。可直接编译运行：

```c
/* producer.c —— 编译：gcc -O2 -o producer producer.c -pthread */
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#define BUFFER_SIZE 5
#define NUM_ITEMS   40

typedef struct prodcons {
    int buf[BUFFER_SIZE];
    int size;                 /* 已放元素数：这就是"状态谓词" */
    int lastput;              /* 生产者下次要写的位置 */
    int lastget;              /* 消费者下次要读的位置 */
    pthread_mutex_t lock;     /* 只保护字段读写，不实现"等待" */
    pthread_cond_t canput;
    pthread_cond_t canget;
} prodcons;

void init(prodcons *p) {
    p->size = p->lastput = p->lastget = 0;
    pthread_mutex_init(&p->lock, NULL);
    pthread_cond_init(&p->canput, NULL);
    pthread_cond_init(&p->canget, NULL);
}

void put(prodcons *p, int item) {
    pthread_mutex_lock(&p->lock);
    while (p->size == BUFFER_SIZE)      /* 缓冲区满：睡在 canput 上 */
        pthread_cond_wait(&p->canput, &p->lock);
    p->size++;
    p->buf[p->lastput] = item;
    p->lastput = (p->lastput + 1) % BUFFER_SIZE;
    pthread_cond_signal(&p->canget);    /* 通知一个消费者：有货了 */
    pthread_mutex_unlock(&p->lock);
}

int get(prodcons *p) {
    int item;
    pthread_mutex_lock(&p->lock);
    while (p->size == 0)                /* 缓冲区空：睡在 canget 上 */
        pthread_cond_wait(&p->canget, &p->lock);
    p->size--;
    item = p->buf[p->lastget];
    p->lastget = (p->lastget + 1) % BUFFER_SIZE;
    pthread_cond_signal(&p->canput);    /* 通知一个生产者：腾出位置了 */
    pthread_mutex_unlock(&p->lock);
    return item;
}

void *producer(void *arg) {
    prodcons *p = arg;
    for (int i = 0; i < NUM_ITEMS; i++) put(p, i);
    return NULL;
}

void *consumer(void *arg) {
    prodcons *p = arg;
    for (int i = 0; i < NUM_ITEMS; i++) {
        int v = get(p);
        if (v != i) { printf("mismatch at %d: got %d\n", i, v); exit(1); }
    }
    return NULL;
}

int main(void) {
    prodcons p; init(&p);
    pthread_t t1, t2;
    pthread_create(&t1, NULL, producer, &p);
    pthread_create(&t2, NULL, consumer, &p);
    pthread_join(t1, NULL); pthread_join(t2, NULL);
    printf("ok: %d items transferred\n", NUM_ITEMS);
    return 0;
}
```

请注意这段代码里的**职责分配**，它是条件变量最容易被误解的地方：

- **互斥锁只保证"同一时刻只有一个线程改字段"**；它不实现等待。
- **条件变量实现等待与唤醒**，但它不保证你在醒来后仍然持有那个条件成立的状态。
- 于是"谓词"（`size == 0`、`size == BUFFER_SIZE`）必须由你自己维护成一个**状态不变量**——`size` 一个字段胜过"两个布尔量 + 一个计数器"。多个谓词各自独立、又需要同时等待时，就得用**条件变量列表**，或改用更高层的**管程（monitor）**。

### 30.3 覆盖条件与 30.4 小结

OSTEP 指出：当"要等的条件"不止一个（比如既要等空位、又要等特定序号的数据到达），单一条件变量会造成**多余唤醒**（唤醒的消费者其实不该醒）。三种解法依次是：给每个条件配一个条件变量、用"广播 + 循环重查"、以及升级到管程（把共享数据、锁与全部等待队列封进一个模块，只暴露过程接口——Java 的 `synchronized` 方法正是管程的工程化身）。

## 二、信号量（OSTEP 第 31 章）

### 31.1 定义：一个带原子性的计数器

Dijkstra 在 1965 年提出的信号量是一个整型变量，外加两个**原子**操作（POSIX 名字）：

```c
int sem_init(sem_t *sem, int pshared, unsigned int value);  /* pshared=0：仅本进程线程间 */
int sem_wait(sem_t *sem);   /* 旧名 P()：值减一；若将为负则睡眠 */
int sem_post(sem_t *sem);   /* 旧名 V()：值加一；唤醒一个等待者 */
int sem_destroy(sem_t *sem);
```

语义用伪代码最好懂：

```c
SemWait(sem_t *s) { 原子 { s->value--; if (s->value < 0) { 把自己入队; Sleep(s); } } }
SemPost(sem_t *s) { 原子 { s->value++; if (有人等待) { 从队列取一个; MakeReady(t); } } }
```

三条必须记住的性质：**值为负表示"有多少个线程正在等待"**；`sem_post` **不阻塞**（所以可以在信号处理器里调它——呼应《信号与进程通信》的异步信号安全清单，`sem_post()` 就在其中）；POSIX 只保证"至少唤醒那些等待的线程"，**不保证 FIFO 公平**（Linux 的实现实际按 FIFO 排队，但别依赖）。跨进程用 `sem_open()` 创建命名信号量（`/dev/shm` 上的文件，注意它不会被自动清理）。

### 31.2 用法一：当锁用（二叉信号量）

`sem_init(&s, 0, 1)` 即互斥量。这是**唯一一件信号量与锁完全等价**的事；OSTEP 随即提醒：别把 `sem_wait` 当"带超时的锁"或"可重入锁"用——它没有属主概念，同一线程 `wait` 两次就是自锁。Java 里 `Semaphore(1)` 同理，需要可重入与属主语义时应上 `ReentrantLock`。

### 31.3 用法二：排序（ordering）

信号量最漂亮的用法是表达"谁必须先做完"：线程 A 做完某事才允许 B 继续。

```c
sem_t m;                       /* 初值 0：B 一上来就会睡 */
ThreadB(void *a) { sem_wait(&m); /* A 已完成，可以安全读取 */ }
ThreadA(void *a) { /* ...生产数据... */ sem_post(&m); }
```

`fork()` 与 `wait()` 其实就是内核替我们实现的一对排序信号量（见《信号与进程通信》与《进程》）。

### 31.4-31.7 三个经典结构

- **有界缓冲区**：与条件变量版功能相同，但代码更短——两个计数信号量（`emptySlots = N`、`fullSlots = 0`）加一把互斥锁。**顺序绝不能颠倒**：先 `sem_wait(mutex)` 再 `sem_wait(empty)` 会在缓冲区满时让生产者抱着锁睡死，消费者进不来 → 教科书级死锁（《死锁与同步》四条件的现场演示）。
- **读者-写者锁**（`rwlock.c`，可直接编译）：用 `lock`（保护计数）、`writelock`（读者/写者互斥）、`nextorder`（FIFO 排队避免写者饿死）三个信号量组合。
- **哲学家就餐**：OSTEP 给出三种可运行解法——奇数哲学家先拿左筷（打破循环等待）、最多允许 N-1 人同时上桌（限制并发度）、以及**取筷子的原子化**（一次 `sem_getvalues()` 式的快照比较，无竞态）。
- **线程限流（throttling）**：`sem_init(&s, 0, 3)` + `sem_wait` 前 / `sem_post` 后，即"最多 3 个线程在途"。这就是应用层信号量限流的原理版，和令牌桶只差一个补币逻辑。

编译运行原文示例（Linux）：

```bash
gcc -O2 -Wall -o rwlock rwlock.c -pthread && ./rwlock 1000 8 1
gcc -O2 -Wall -o dining dining.c -pthread && ./dining 1000000 5
```

### 31.8 内核如何实现信号量（以及它的代价）

Linux 的 `futex` 路线（详见《并发与锁》）：无争用时只在用户态做一次原子加减，**有争用才陷入内核**睡眠。OSTEP 同时指出这类"共享变量 + 自旋保护等待队列"的做法在**多核上不可扩展**（所有核争同一把锁），现代实现因此走向 per-CPU 队列或无锁结构；而"重映射/迁移等待者"这类问题（进程换出时等待队列怎么办）至今没有完美答案。

### 31.9 小结：条件变量 vs 信号量

| 维度 | 条件变量 | 信号量 |
|---|---|---|
| 是否自带互斥 | 否（必须配锁） | 否（用作计数时也要另配锁） |
| 表达能力 | 等"某个谓词成立"，状态由你维护 | 一个整数计数器，天然表达 N 个资源/排序 |
| 唤醒粒度 | `signal`（一个）/`broadcast`（全部） | `post` 唤醒一个 |
| 典型坑 | 用 `if` 而非 `while`；忘记持锁就 `signal` | 加锁顺序颠倒导致死锁；忘记 `post` 导致永久睡眠 |
| 推荐场景 | 复杂谓词、多条件、管程式封装 | 限流、排序、简单资源计数 |

## 三、常见坑（按现场报错整理）

1. **`if (cond) pthread_cond_wait(...)`**：Mesa 语义 + 虚假唤醒，表现为偶发"数据不一致"或直接段错误。改成 `while`。
2. **不持锁就 `signal`**：多数情况看似没事，但可能在"检查条件"与"入队睡眠"之间被错过唤醒（lost wakeup），表现为随机卡死。规范写法是始终在锁内改状态并 `signal`。
3. **信号量忘记 `post`**（异常路径里 `return`/`throw` 提前退出）：等待者永久睡眠。用 `try/finally`（Java）、`with`（Python）或 Go 的 `defer` 保证成对释放。
4. **先等 mutex 再等 empty**：见 31.4，顺序错误 = 死锁。
5. **命名信号量残留**：`sem_open()` 创建的对象在 `/dev/shm/sem.*`，进程退出不会消失；`sem_unlink()` 才删。测试机器上偶发"值不对"，往往是上一次运行留下的计数。
6. **`pthread_join` 替代条件变量**：等一个线程结束用 `join`，等**事件**才用条件变量/信号量；用 `join` 做限流会退化成串行。
7. **Java 侧的等价与差异**：`Object.wait/notify`（必须在 `synchronized` 内，否则 `IllegalMonitorStateException`）、`ReentrantLock.newCondition()`（支持多等待队列，就是"覆盖条件"的正解）、`AbstractQueuedSynchronizer` 家族的 `Semaphore`（可公平/非公平、`tryAcquire(timeout)`）、`CountDownLatch`/`CyclicBarrier`（一次性/可重用的排序栅栏）。
8. **Python 侧**：`threading.Condition` 的 `wait_for(pred)` 已帮你写好 `while` 循环；`queue.Queue(maxsize=N)` 是本文有界缓冲区的成品（`put` 阻塞即"等空位"），配合 GIL 与 I/O 多路复用（见《epoll 与事件循环》）选择线程池还是 `asyncio.Semaphore`。

## 四、延伸阅读

- OSTEP 第 29 章（Monitors）与第 27-28 章（锁）——把本篇的"谓程"补齐成完整实现路径。
- 《The Little Books of Semaphores》（Downey）——只用信号量从零搭出锁、条件变量与管程，反向印证本篇的对照表。
- Linux `futex(2)`、POSIX `pthread_cond_*`/`sem_overview(7)` 手册页——真实语义与错误码的最终依据。

**编者补充（工程语境）**：

- **推理服务的背压就是 31.7**：vLLM 之类引擎里"等待队列 / 运行队列 + 最大并发数"是标准的计数信号量结构；请求侧的 `max_concurrency`、`semaphore=50` 语义与之一致。区别只在实现语言：Python 用 `asyncio.Semaphore`，Java 用 `Semaphore` 或 `ThreadPoolExecutor` 的队列长度 + 拒绝策略。
- **Java 21 虚拟线程改变了成本、没改变原理**：虚拟线程上的 `synchronized`/`Lock`/`Semaphore` 阻塞不再占住载体线程（`Semaphore` 的阻塞路径本就是 park/unpark），因此 31.7 的限流写法在虚拟线程下依然是正确的并发闸门；但**不要**在虚拟线程里用"忙等 + sleep 轮询"替代条件变量，那是最贵的写法。
- **`Condition` 与"状态谓词"**：本篇反复强调"等待的是状态，不是事件"。落到服务代码里，就是把 `queue.isEmpty()` / `inflight < limit` 这类谓词写进 `await()`，而不是给每个事件配一个 latch——后者在重试/超时叠加时必然出现漏唤醒。

---

> **来源**：抓取于 2026-09-19。译自/引自《Operating Systems: Three Easy Pieces》第 30 章 [Condition Variables](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf) 与第 31 章 [Semaphores](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-sema.pdf)（作者 Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau，许可 CC BY-NC-SA 4.0；OSTEP 官网免费章节，读者版源码见 [ostep-code](https://github.com/remzi-arpacidusseau/ostep-code)）。POSIX API 签名与语义另据 [pthread_cond_wait(3)](https://man7.org/linux/man-pages/man3/pthread_cond_wait.3.html)、[sem_overview(7)](https://man7.org/linux/man-pages/man7/sem_overview.7.html)（Linux man-pages，GPL-2.0-or-later）核对；producer/consumer 示例为按原文结构重排的可编译版本，Dijkstra 1965 与 Mesa 语义的表述沿用原文。有界缓冲区、读者-写者锁、哲学家就餐与线程限流四例均出自上述章节；Java/Python 对应物与编者补充为本站撰写。
