---
title: 现代调度器：MLFQ 与 Linux CFS/EEVDF
source_url: https://docs.kernel.org/scheduler/sched-eevdf.html
author: Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau（OSTEP 第 8 章）；Peter Zijlstra、Ingo Molnar（Linux 内核调度器文档）
license: OSTEP 部分 CC BY-NC-SA 4.0；Linux 内核文档 GPL-2.0（documentation）
fetched_at: 2026-09-19
translated: true
versions: Linux 内核文档 7.3.0-rc3；EEVDF 自 6.6 起取代 CFS 成为默认公平调度器；OSTEP 第 3 版
order: 31
group: 操作系统：进程、线程与并发
---

《CPU 调度》把两族策略推到尽头后留下了一个无解的假设：**调度器必须知道每个作业的长度**。本篇讲现代系统怎么绕过这个假设，分两条线：

- **MLFQ（多级反馈队列）**：用"最近的过去"预测"即将到来的未来"——OSTEP 第 8 章完整翻译，含三次失败与修正的推导。
- **Linux 主线的两条实现路线**：CFS（Completely Fair Scheduler，2.6.23 起）用**虚拟运行时间**逼近"理想多任务 CPU"；EEVDF（Earliest Eligible Virtual Deadline First）自 **6.6** 起接替它，用 **lag + 虚拟截止期**把"公平"与"延迟敏感"分开表达。

这两条线回答的是同一个问题，但取舍不同：MLFQ 用优先级猜意图，CFS/EEVDF 用算术保证份额。看懂后一条，你在容器里调 `cpu.max`、给批处理任务降优先级时就不再是"玄学调参"。

## 一、MLFQ：用最近的过去预测未来（OSTEP 第 8 章）

### 8.1 基本规则

不预知作业长度，又想近似 SJF/STCF（周转时间最优），同时保留 RR 的响应性，MLFQ 的做法是维护一组优先级队列：

1. **高优先级队列中的作业先运行**；
2. 同一优先级内**按 RR 轮转**，时间片长度固定（典型 10–20 ms）；
3. **用完整个时间片还没完成的作业，降一级**；
4. 若在时间片内主动放弃 CPU（例如发起 I/O 阻塞），**保持原优先级**。

直觉是：交互型任务（打字、渲染、逐 token 输出）总是很短就用完 CPU 去等 I/O，会稳定待在高优先级；批处理型任务总把时间片耗光，会不断下沉。

### 8.2-8.4 三次修正

原文用三个反例逐步逼出完整设计——这一段比结论更有价值：

| 问题 | 现象 | 修正 |
|---|---|---|
| **初始优先级** | 新作业该从哪级开始？给低了立刻饥饿，给高了长作业一开始就霸占 | 一律从**最高优先级**开始（乐观假设它交互型） |
| **优先级饥饿** | 一直待在低优先级的批处理作业永远轮不到 | **周期性 boost**：所有作业重置到最高级（约每 13 个 tick 一次），保证响应时间下界 |
| **I/O 密集度作弊** | 一个 CPU 密集任务故意"跑满时间片前 1 ms 就睡眠"，就能待在高优先级；纯 I/O 任务反而被抢走份额 | 改成**比例记账**：统计"最近 4 个（可调）时间片中实际用掉的 CPU 时间比例"，**超过阈值（如 25%）才降级** |
| **规则不精确** | boost 期间高优先级队列很长，交互任务响应变差 | boost 后按新队列重排；参数（队列数、时间片、比例阈值）全部可调 |

MLFQ 至此"能用且好用"，但它有两个**从未解决**的问题：参数是玄学（队列多少、时间片多长、阈值取多少，都靠调），以及**只能给"好"的承诺、给不了"精确比例"**——比如"进程 A 必须拿到 20%、B 拿 80%"这类需求，MLFQ 表达不了。OSTEP 随后在第 9 章用**比例份额调度**（彩票调度 lottery scheduling、步长调度 stride scheduling）解决它：随机抽彩票或按 `1/份额` 的步长推进票据，长期比例即可控。Linux 没有走这条路，它用了另一个思路。

MLFQ 的三个参数各有明确的取舍方向，值得单独记牢：**队列数量**越多，优先级分辨率越细，但高优先级队列越容易被交互任务占满、批处理等待越久；**时间片长度**越短，响应越快、上下文切换与 TLB/缓存失效的开销越大（原文给的典型区间是 10–20 ms，恰好与"人对交互的感知阈值"同级）；**boost 周期**越短，越不容易饿死批处理任务，但每次 boost 都会瞬时把系统变成一个长队列的轮转调度器，交互延迟反而抖动。这也是为什么现代内核不再用"猜优先级"这条路线，而改走"确定性地按权重记账"。

### 实操：观测 MLFQ 的残留（进程 nice 值与调度类）

Linux 的调度类分层是 `stop > deadline > rt > fair(CFS/EEVDF) > idle`，而 `nice`（−20…19）是公平类内部的**权重**，不是优先级队列号——这正是 MLFQ 与 CFS 的关键分歧：

```bash
ps -eo pid,ni,cls,pri,comm --sort=ni | head    # cls: 调度类（FF/RR/DE/B/0），pri: 内核视图
nice -n 10 python -c 'print("以 nice=10 启动")'
renice -n 5 -p 12345                           # 改正在运行的进程（降权不需要特权）
renice -n -5 -p 12345                          # 提权需要 CAP_SYS_NICE，否则报 "must be privileged"
chrt -p 12345                                  # 看它现在属于哪个调度类、什么优先级
chrt -f 50 ./mytask                            # 以 SCHED_FIFO prio=50 运行（危险，见第四节）
cat /proc/12345/schedstat                      # utime stime（ns）与 runqueue 等待次数
cat /proc/12345/status | grep -E 'Nic|Policy'  # 简易确认
```

## 二、CFS：理想多任务 CPU 的近似（内核文档《CFS Scheduler》）

Ingo Molnar 写的 CFS 在 2.6.23 合入，取代了旧 O(1) 调度器的 SCHED_OTHER 交互启发式。内核文档自己说"**CFS 80% 的设计可以用一句话说清**"：

> CFS 本质上是在真实硬件上建模一个"理想的、精确的多任务 CPU"。

理想 CPU 有 100% 算力、能同时以 `1/nr_running` 的速度并行跑 n 个任务。真实硬件一次只能跑一个，于是引入**虚拟运行时间（virtual runtime，`p->se.vruntime`，纳秒单位）**：任务实际跑了多久，按"当前可运行任务数"与**权重**折算。理想情况下所有任务的 vruntime 永远相等；因此 CFS 的选任务逻辑简单到极致：

- **红黑树按 vruntime 排序，永远取最左边那个**（跑得最少的那个）；
- 每次调度 tick 记账 `delta_exec`，折算后累加进 vruntime，再重新入树（`task_tick_fair()`）；
- 唤醒时比较新任务的 vruntime 与当前运行任务，差值超过一小段"粒度距离"才抢占（`wakeup_preempt_entity`）；
- **nice 等级 → 权重**：15 级 nice 映射到权重表（`nice 0 = 1024`，相邻级约 1.25 倍），`rq->cfs.load` 是队列内权重之和，vruntime 增量 = `delta_exec * 1024 / weight`。这就是"精确比例"的来源，也是 MLFQ 给不出的承诺；
- 无定时器、不依赖 jiffies，靠纳秒级记账 + tick 驱动，`SCHED_BATCH`（少抢占、不碰 wakeup granularity）与 `SCHED_IDLE`（比 nice 19 还弱）为批处理/后台任务开了专门的口子。

**组调度（group scheduling）**：`CONFIG_FAIR_GROUP_SCHED` 让 CPU 份额可以按 cgroup 分配，而不是按线程。文档里的例子是 cgroup v1：

```bash
# cgroup v1 老写法（内核文档原文）：multimedia 组拿 browser 组两倍的 CPU 份额
mkdir /sys/fs/cgroup/cpu/multimedia && mkdir /sys/fs/cgroup/cpu/browser
echo 2048 > /sys/fs/cgroup/cpu/multimedia/cpu.shares
echo 1024 > /sys/fs/cgroup/cpu/browser/cpu.shares
echo <pid> > /sys/fs/cgroup/cpu/browser/tasks
```

今天的主线发行版用 cgroup v2，对应文件换成 `cpu.weight`（1…10000，默认 100）与硬上限 `cpu.max`：

```bash
# cgroup v2：把某服务限成"最多 1.5 个核"，权重 200
sudo mkdir -p /sys/fs/cgroup/myjob
printf '150000 100000\n' | sudo tee /sys/fs/cgroup/myjob/cpu.max   # quota period（μs）
echo 200 | sudo tee /sys/fs/cgroup/myjob/cpu.weight
sudo sh -c 'echo $(pgrep -d " " -f myjob) > /sys/fs/cgroup/myjob/cgroup.procs'
cat /sys/fs/cgroup/myjob/cpu.stat        # nr_throttled / throttled_usec：被掐了多少
```

Docker/容器层的同义开关是 `--cpus=1.5`（写进 `cpu.max`）与 `--cpu-shares`（映射到 `cpu.weight`）。

## 三、EEVDF：把"公平"与"延迟"解耦（内核文档《EEVDF Scheduler》）

CFS 的短板在于**延迟不由公平保证**：一个刚醒来的任务能不能立刻抢到 CPU，取决于唤醒抢占粒度的启发式；而"我这次想跑多久"这种信息，CFS 从不表达。Linux 6.6 起改用 Peter Zijlstra 2023 年提出的 EEVDF 变体（论文本身早在 1995 年），当前内核文档（7.3-rc3）明确写着 CFS "正在为 EEVDF 让路"。

EEVDF 保留 CFS 的权重/vruntime 骨架，另加两个概念：

1. **lag（欠账）**：`请求的 CPU 时间 − 已服务的 CPU 时间`。**lag ≥ 0 的任务是"合格的"（eligible）**，有权要求 CPU；lag < 0 表示已经跑过了自己该得的那份。睡眠任务的 lag 用**随虚拟运行时间衰减（decaying）**的机制处理，并且采用"延迟出队（deferred dequeue）"——目的是防止"睡一小觉来清零负 lag"这种钻空子行为。
2. **虚拟截止期（virtual deadline）**：对每个合格任务算一个 VD（跑一个时间片越长，VD 越远），在合格集合里**取 VD 最早者**运行。

于是"短需求、低延迟敏感"的任务自然得到更早的截止期与更快的响应，而不需要 CFS 那套抢占启发式；同时"同一优先级之间按权重公平分配"仍然由 lag 兜住。EEVDF 的 tunable 依旧主要落在 cgroup（`cpu.max`/`cpu.weight`）与 `nice` 上，而不是全局 sysctl——早年 `/proc/sys/kernel/sched_min_granularity_ns`、`sched_latency_ns` 一类旋钮在多数现代内核里已不再提供，粒度改为按 CPU 数与 `sysctl_sched_base_slice` 自适应推导，**线上调优的正确入口是 cgroup，而不是全局内核参数**。

## 四、常见坑

| 现象 | 根因 | 处理 |
|---|---|---|
| Java/Node 服务在 K8s 里线程数暴涨、GC 停顿变长 | 运行时读 `nproc`/宿主核数，看不到 `cpu.max` 配额（CFS 的配额靠周期掐，线程池本身不知道） | JDK 10+ 开 `UseContainerSupport`（默认）或用 `-XX:ActiveProcessorCount=2`；Node 用 `--max-old-space-size` 配合显式并发数 |
| 一个 RT 任务把机器卡死，SSH 都进不去 | `SCHED_FIFO` 只被更高优先级或主动让出打断 | 保留 `/proc/sys/kernel/sched_rt_runtime_us`（RT throttling，默认 950000/1000000）为开启；用 `chrt` 时**务必**配 `timeout 30s`；生产环境优先 `nice` 而非 RT |
| 容器 CPU 用不满（比如 limit=4 却只跑到 2 核） | 被 `cpu.max` 掐住后进入 throttling 等待；或线程在等锁（CPU 并非瓶颈） | `cat /sys/fs/cgroup/.../cpu.stat` 看 `nr_throttled`/`throttled_usec`；再看 `offcpu` 分析（`perf sched`、`offcputime-bpfcc`） |
| `perf stat` 显示 CPU 空闲但请求延迟高 | 中断/RSS 亲和性、或大量 `sched_wakeup` 跨核迁移 | `mpstat -P ALL 1` 看单核热点；`perf sched record 10s && perf sched latency` 找等待最久的任务 |
| 后台批量任务（数据清洗）拖慢在线服务 | 与在线任务同属公平类且 nice 相同 | 用 `systemd-run --scope -p Nice=15 -p CPUWeight=10` 或 `SCHED_IDLE`（比 nice 19 更弱，且不会引起优先级反转） |
| 调 `chrt` 报 `Operation not permitted` | 需要 `CAP_SYS_NICE`；容器默认没有 | 给容器加 `--cap-add SYS_NICE`（慎重），或改在 cgroup 层限制 |
| 交互式任务偶发长停顿 | boost/唤醒粒度的历史遗留启发式，或 `CFS_BANDWIDTH` 的 burst 未开 | 内核 ≥5.14 有 `cpu.max.burst`；EEVDF 下主要看 `cpu.stat` 的 throttling 计数 |

## 五、延伸阅读与练习

- OSTEP 第 8、9 章（MLFQ、比例份额调度）——本篇第一节即其中译，第 9 章的彩票/步长调度在读完 CFS 权重后回看，会理解"为什么 Linux 选确定性权重而不是随机化"。
- 内核文档 [CFS Scheduler](https://docs.kernel.org/scheduler/sched-design-CFS.html) 与 [EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html)，以及 `sched(7)` 手册页（调度类与策略的权威清单）。
- 动手：把第一节的 `nice`/`chrt`/`cpu.max` 三组命令在你机器上跑一遍，用 `perf sched latency` 观测"降权后等待时间如何变化"。比读十篇调度论文有用。

**编者补充（与本站其他篇目的连接）**：

- **GPU 上的同一套思想**：CPU 调度器的"按突发历史升降优先级"在推理引擎里叫 continuous batching / chunked prefill——短解码请求优先、长预填充切块，避免"护航效应"（《CPU 调度》）；`cpu.max` 与 `nice` 则决定 CPU 侧的 tokenizer、采样与调度线程能否及时抢核。
- **和《条件变量与信号量》的接口**：调度器不知道"锁"，因此高优先级任务等低优先级任务持有的锁时会出现优先级反转——RT 调度类的优先级继承与此正对应；给在线服务设 RT 优先级之前，先确认它不会去抢一把普通锁。

---

> **来源**：抓取于 2026-09-19。第一节译自《Operating Systems: Three Easy Pieces》第 8 章 [Multi-level Feedback Queue](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-mlfq.pdf)（作者 Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau，许可 CC BY-NC-SA 4.0，官网免费章节），比例份额部分的对照引自同书第 9 章 [Lottery Scheduling](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-sched-lottery.pdf)。第二、三节译自/引自 Linux 内核官方文档 [CFS Scheduler](https://docs.kernel.org/scheduler/sched-design-CFS.html)（Ingo Molnar、Peter Zijlstra 等撰写，内核文档以 GPL-2.0 授权并允许注明出处转载）与 [EEVDF Scheduler](https://docs.kernel.org/scheduler/sched-eevdf.html)（内核文档版本 7.3.0-rc3 页面核实）；`chrt(1)`、`sched(7)` 语义另据 [Linux man-pages](https://man7.org/linux/man-pages/man7/sched.7.html)（GPL-2.0-or-later）核对。命令示例、cgroup v2 写法与排查表为本站据上述文档整理撰写，参数默认值以本机内核为准。
