---
title: 分页、页表与多级页表
source_url: https://pages.cs.wisc.edu/~remzi/OSTEP/vm-mechanism.pdf
author: Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau（OSTEP《操作系统导论》第 15、18、20 章）
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-19
translated: true
versions: OSTEP 第 3 版；x86-64 4 级/5 级页表（Intel SDM）；Linux 6.x/7.x 的 4K/2M/1G 页与 THP
order: 32
group: 操作系统：内存与文件系统
---

《内存管理：地址空间抽象》把问题立起来了：**每个进程都以为自己独占整块内存**；《虚拟内存：TLB 与地址翻译加速》讲了怎么把翻译查得更快。本篇填中间那块最硬的机制：地址翻译**到底怎么实现**——从基址/界限寄存器，到分页与页表，再到"页表本身也占内存"这个二阶难题的多级解法。

三块内容依次译自 OSTEP 第 15 章（Mechanism: Address Translation）、第 18 章（Paging: Introduction）与第 20 章（Paging: Smaller Tables，其 20.3 节即多级页表），并在末尾给出一组能在自己机器上跑起来的观测与实验代码。读完你会能回答三个具体问题：一次 `mov` 指令的 4 个字节地址怎么变成物理地址；为什么"32 位地址空间 + 4KB 页"的线性页表要 4 MB，以及为什么实际远小于此；多级页表为什么让 `malloc(4096)` 和 `mmap(1GB)` 的开销几乎一样。

## 一、机制从哪来：地址翻译（OSTEP 第 15 章）

### 15.1 假设与"最笨的做法"

OSTEP 的第一版设计几乎不值得存在：用户地址 **就是**物理地址，OS 在装载时校验进程能放得下、且不与内核重叠。两个致命缺陷——装载时就必须知道全部内存布局（进程一长大就要重定位，几乎不可行），以及地址空间一旦越界会**静默**踩坏别人。

### 15.3 硬件动态重定位（base/bounds）

于是引入两个特权寄存器：**基址寄存器（base/bias）**与**界限寄存器（bounds/limit）**。硬件对每次访存做：

```text
物理地址 = 虚拟地址 + base
if (虚拟地址 >= bounds) → 发送陷阱给 OS（地址保护错误，进程被判违规）
```

这就是"加法 + 比较"的**动态地址翻译（dynamic address translation）**，也是《进程》里模式切换的延续：寄存器只在内核态可写，用户态只能被它影响。15.4 把硬件需求收拢成一张表（基址、界限、模式位），15.5 讲 OS 侧问题：切换进程时换 base/bounds；空闲空间管理（碎片、`brk()` 系统调用扩展堆、地址空间重定位的代价）。

base/bounds 要求进程在物理内存里**连续**，这一条限制正是"分段"的雏形，也是它最终被分页取代的原因：连续分配造成外部碎片、需要紧凑，且进程实际访问的页面通常稀疏分布。

## 二、分页：把地址空间切成固定大小的页（OSTEP 第 18 章）

### 18.1 一个例子与全景

分页的核心交易是：**放弃连续性，换取可控的粒度**。物理内存被划成固定大小的**页框（page frame）**，虚拟地址空间划成同尺寸的**页（page）**，于是一次翻译变成"页号 → 页框号"的查表。

硬件把虚拟地址劈成两半：

```text
32 位地址空间、4KB 页时：
 31                    12 11                0
+--------------------------+------------------+
|     VPN（虚拟页号,20位）  |  offset（12位）   |
+--------------------------+------------------+
```

页大小取 2 的幂有两个工程好处：地址劈分退化成移位与掩码（一条指令），且**块内偏移（offset）不需要翻译**——原样照抄到物理地址低 12 位。于是"1 个虚拟页 ↔ 1 个物理页框"，翻译表规模被压到"每页一项"。

### 18.2 页表放哪里、里面放什么

**页表由 OS 每进程维护一份**（所以不同进程同一虚拟地址指向不同物理页），常驻物理内存，通过 **页表基址寄存器（PTBR）** 定位；切换进程只需换 PTBR（这正是 `fork()`/`exec()` 便宜得多的原因）。

一个页表项（PTE）至少要有三样东西，OSTEP 逐项推导其位宽：

| 字段 | 作用 | 典型位宽（4KB 页、32 位地址） |
|---|---|---|
| valid | 这一页当前是否在物理内存中 | 1 bit |
| protection | R/W/X 权限 | 2–3 bits |
| PFN（页框号） | 物理页框编号 | 20 bits |
| 其他 | 脏位、引用位、大页标志、GLOBAL/PCID 等 | 若干 bits |

`20(PFN) + 1(valid) + 3(prot)` 约 24 位，向上取整 1 字节太挤，于是**常用 4 字节 PTE**——顺手带来一个漂亮性质：页表项数量恰好是"页数 × 4 字节"，一页内存正好装下 1024 个 PTE（`4096 / 4`）。这个"页 = 1024 项"的巧合是下一节多级页表能整齐成立的前提。

### 18.4 分页也太慢了

有了机制，性能立刻成为问题：一次取数据要**两次内存访问**（先查页表，再访真数据）。OSTEP 的算例很直白——内存访问 100 ns 时，缓存未命中的访存从 100 ns 变成 200 ns，**CPU 慢了一倍**。缓解手段依次是：给页表加"快速缓存"（就是 TLB，见《虚拟内存：TLB 与地址翻译加速》）、以及**让页表本身更便宜**（本篇第三节）。

18.5 的一段内存访问追踪（memory trace）值得自己动手跑：先顺序遍历大数组、再随机跳页，观察 TLB miss 率如何把同样一段 C 代码差出数倍。

## 三、页表太大了：多级页表（OSTEP 第 20 章）

### 20.0 问题的规模

32 位地址空间、4KB 页、4 字节 PTE：`2^32 / 2^12 = 2^20` 项，即**每进程 4 MB 纯页表**。一百个活跃进程就是几百 MB——而且绝大多数区域根本没用过（栈只占几 KB、堆刚 `malloc` 了几 KB）。这就是"稀疏地址空间"与"线性数组页表"的冲突。

### 20.1-20.2 两种前菜

- **更大的页**：16 KB 页 → PTE 数降到 1/4（4 MB → 1 MB）。代价是**内部碎片**（最后一装不满一页也占一整页）与 I/O 粒度变大。今天仍以 4 KB 为基线，但 2 MB / 1 GB 大页是性能关键手段（见第五节）。
- **分页 + 分段混合**（x86 老式 `segment:offset`）：让段基址把无用的大片区域"跳过去"。它把外部碎片问题换个形式请了回来，现代设计不采纳。

### 20.3 多级页表：把页表变成树

现代系统的选择（x86、ARM、RISC-V 皆同）是：

> **先把页表切成页大小的单元；如果某一整页页表项全都无效，就干脆不为它分配物理内存。** 再用一个新结构**页目录（page directory）**记录"某页页表在不在、在哪"。

32 位、4KB 页、4 字节 PTE 的经典两级切分是 `10 | 10 | 12`：

```text
 31        22 21        12 11                    0
+------------+------------+-----------------------+
| 目录索引(10) | 页表索引(10) |      offset(12)       |
+------------+------------+-----------------------+
```

顶层目录正好 2^10 项 × 4 字节 = 4 KB = 一页；每个第二级页表也正好一页。**翻译流程**：`CR3/PDBR` → 读目录项 → 若 valid=0 直接陷阱（这一整 4 MB 区域未映射，零内存开销）→ 否则取到二级页表页地址 → 读 PTE → 取 PFN 拼上 offset。

省在哪：只有**被真正使用**的地址区间才会分配二级页表页。一个只碰栈和堆的小进程，通常只需 1 页目录 + 2–3 页页表，即 ~12–16 KB，而不是 4 MB。

代价也说清（原文强调"没有免费的午餐"）：一次翻译最坏要 **N+1 次内存访问**（N 级），必须靠 TLB 兜住；硬件还要支持"页表遍历器（page walker）"，MMU 复杂度上升；实现必须保证遍历期间页表不被换出（有的架构为此把页表钉在内存或用更大 TLB 覆盖范围）。

### 20.4-20.5 反向页表与把页表换出

- **反向页表（inverted page table）**：只维护**一张**表，每项存 `<虚拟页号, 进程 ID, PTE 信息>`，用哈希表按 `<pid, vpn>` 查。内存占用与"实际使用的页总数"成正比而非与"地址空间大小"成正比，但**TLB 命中变难**（要哈希 + 可能多次访问），现代主流架构因此不采用。
- **把页表本身换出到磁盘**（VAX/VMS 的做法）：给页表项再加一层 valid 位。省内存但会触发"翻译时页表项不在内存"的递归麻烦，甚至出现不可表示的边界情况。

### 20.6 小结（原文要点）

线性页表太占内存、反向页表伤 TLB、多级页表是"稀疏性 × 分页粒度"的实用折中；所有这些机制都建立在"块大小 + 索引切分"这一套算术上，理解它比记配置更有用。

### x86-64 的实际形状

现代 64 位机器不会为 64 位地址开 8 级表。x86-64 的做法：只用低 48 位做虚拟地址（高位符号扩展，称**规范地址 canonical address**，因此用户态可用 `0x00007fffffffffff` 以下、内核态占 `0xffff888000000000` 以上的一段），4 级页表 **PML4 → PDPT → PD → PT**，每级索引 9 位（512 项 × 8 B = 4 KB 一页），加 12 位页内偏移：`9|9|9|9|12`。支持 **LA57** 的 CPU 可加第五级（PML5），虚拟地址扩到 57 位。Linux 还允许在 PDPT/PD 层直接放 1 GB / 2 MB 的"大页映射"（跳过下一级）。RISC-V 的 `Sv39/Sv48/Sv57` 是同一思路的 3/4/5 级版本。

```text
1 GB 页： PML4 → PDPT(直接给 PFN) + 30 位偏移
2 MB 页： PML4 → PDPT → PD(直接给 PFN) + 21 位偏移
4 KB 页： PML4 → PDPT → PD → PT + 12 位偏移
```

## 四、动手：一个能跑的两级页表模拟器

下面 40 行 Python 把 20.3 的机制与"省了多少"直接算出来，可改参数做实验（`python3 pagetable.py`）：

```python
"""极简两级页表：验证'按需分配二级页表页'能省多少内存。"""
from __future__ import annotations

PAGE_SHIFT = 12                      # 4KB 页
PAGE_SIZE = 1 << PAGE_SHIFT
PTE_SIZE = 8                         # x86-64 一个页表项 8 字节
ENTRIES_PER_PAGE = PAGE_SIZE // PTE_SIZE      # = 512，注意与 PAGE_SIZE 抵消
LEVEL_BITS = ENTRIES_PER_PAGE.bit_length() - 1  # 每级索引位数 = 9


class TwoLevelPageTable:
    def __init__(self) -> None:
        self.dir: dict[int, dict[int, int]] = {}   # 目录索引 -> {页表索引: PFN}
        self.next_pfn = 1

    def translate(self, va: int) -> int | None:
        """返回物理地址；未映射返回 None（等价于硬件发陷阱）。"""
        didx = va >> (PAGE_SHIFT + LEVEL_BITS)
        tidx = (va >> PAGE_SHIFT) % ENTRIES_PER_PAGE
        page = self.dir.get(didx)
        if page is None or tidx not in page:       # 整页页表未分配 / 该项无效
            return None
        pfn = page[tidx]
        return (pfn << PAGE_SHIFT) | (va % PAGE_SIZE)

    def map(self, va: int, prot: str = "rw") -> None:
        didx = va >> (PAGE_SHIFT + LEVEL_BITS)
        tidx = (va >> PAGE_SHIFT) % ENTRIES_PER_PAGE
        self.dir.setdefault(didx, {})[tidx] = self.next_pfn
        self.next_pfn += 1

    def resident_pages(self) -> int:
        """页表自身占用的物理页数（目录 + 已分配的二级页表）。"""
        return 1 + len(self.dir)


if __name__ == "__main__":
    pt = TwoLevelPageTable()
    pt.map(0x400000)                                # 代码段某页
    pt.map(0x7FFF_E000)                             # 栈顶某页
    print("翻译 0x400000 ->", hex(pt.translate(0x400000) or -1))
    print("翻译 0x41000（未映射）->", pt.translate(0x41000))
    linear_pages = ((1 << 48) // PAGE_SIZE) * PTE_SIZE // PAGE_SIZE  # 理论线性表页数
    print(f"两级页表实际占用 {pt.resident_pages()} 页；"
          f"48 位地址空间的线性页表需要 {linear_pages:,} 页（天文数字）")
```

关键的一行算术在 `ENTRIES_PER_PAGE`：**每级索引位数 = log2(页大小 / 项大小)**。4 KB 页、8 B 项 ⇒ 每级 512 项、9 位；这也解释了为什么页大小翻倍只让树浅一级，而换 4 B 项（32 位时代）会多一级。

## 五、观测与实操

```bash
getconf PAGESIZE                                   # 本机基线页大小，多数为 4096
pmap -x 12345 | sort -k3 -n | tail                # 每段映射的 RSS/PSS/Swap
cat /proc/12345/smaps_rollup | grep -E 'Rss|Pss|Anonymous|Swap|THP'
grep -E '^(HugePages_|Hugepagesize|CommitLimit|Committed_AS)' /proc/meminfo
cat /proc/sys/vm/overcommit_memory                 # 0 启发式 / 1 总是允许 / 2 严格
cat /sys/kernel/mm/transparent_hugepage/enabled    # always [madvise] never
perf stat -e dTLB-load-misses,dtlb_walk -C 0 -- sleep 5   # TLB 与页表遍历开销
perf record -e page-faults -a -- sleep 3; perf report      # 谁在疯狂缺页
sudo cat /proc/kpageflags | wc -l                  # 每物理页的属性（需 root）
```

Python 侧验证"按需置页"（`malloc`/`bytearray` 只是要了虚拟地址，第一次写入才拿到物理页框）：

```python
import os, resource

PAGE = os.sysconf("SC_PAGESIZE")

def peak_rss_mb() -> float:
    """本进程至今的峰值常驻集；Linux 上 ru_maxrss 的单位是 KB。"""
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024

size = 512 * PAGE                       # 2 MB 虚拟空间
before = peak_rss_mb()
buf = bytearray(size)                   # 只要虚拟地址：内核还没有给页框
mid = peak_rss_mb()
for i in range(0, size, PAGE):          # 每页写 1 字节 → 逐页缺页、真正分配页框
    buf[i] = 1
after = peak_rss_mb()
print(f"页大小 {PAGE} B｜分配后峰值 RSS {before:.1f}→{mid:.1f} MB｜逐页写入后 {after:.1f} MB")
```

要看**每一页**的驻留情况，读 `/proc/self/pagemap`：每项 8 字节，`bit63` 是 present（页在内存中）、`bit62` 表示已被换出；自 4.0 内核起，PFN 位对无 `CAP_SYS_ADMIN` 的进程清零（能判断"在不在"，看不到"在哪"）。按虚拟地址定位偏移：`offset = (vaddr // PAGE_SIZE) * 8`，用 `os.pread(fd, 8, offset)` 读出。

大页（把 512 个 4 KB 项折成 1 个 2 MB 项，TLB 压力降 512 倍）：

```c
/* 需要 CAP_IPC_LOCK 与预留大页：echo 64 > /proc/sys/vm/nr_hugepages */
#include <sys/mman.h>
void *p = mmap(NULL, 2UL << 20, PROT_READ | PROT_WRITE,
               MAP_PRIVATE | MAP_ANONYMOUS | MAP_HUGETLB | MAP_HUGE_2MB, -1, 0);
/* 或保持普通 mmap，只对热点区间 madvise：madvise(p, len, MADV_HUGEPAGE); */
```

## 六、常见坑

1. **`malloc` 不等于占内存**：C 库拿到的是虚拟地址，第一次写入才缺页。用 `malloc(1<<34)` 压不出真实内存（除非 `overcommit_memory=1`）——压测请用 `memset` 或 `volatile` 写。
2. **随机访问 = TLB miss 风暴**：同一份数据，按 `stride=4KB` 跳着读会比顺序读慢好几倍；`perf stat -e dTLB-load-misses` 一测就现形。这是"链表/指针追逐比数组慢"的第二个原因（第一个是 cache）。
3. **透明大页（THP）的毛刺**：`always` 模式下 `fork()` 后大页 COW 复制会造成几十毫秒停顿与 RSS 虚高；延迟敏感服务常用 `madvise` 模式 + 显式 `madvise(MADV_HUGEPAGE)`，或对共享内存段显式 `MAP_HUGETLB`。
4. **页表不计入进程 RSS 的直觉**：内核页表属于 kernel memory，在 cgroup v2 里计入 `memory.stat` 的 `slab`/`pagetables` 行——大量小映射（每个 4 KB 段的 `mmap`）会把它撑起来。用 `cat /proc/123/smaps_rollup | grep PageTables` 看。
5. **`MAP_FIXED` 会静默覆盖已有映射**（详见《mmap 与 Unix 域套接字》）；测试环境请用 `MAP_FIXED_NOREPLACE`，冲突时返回 `EEXIST` 而不是把你的代码段掀掉。
6. **swap 关掉 + overcommit 开着 = OOM killer 随机杀进程**：`dmesg | grep -i oom` 找受害者，`Committed_AS` 与 `CommitLimit` 的差是前瞻指标。
7. **32 位进程只有 3 GB 用户空间**：大模型/大表加载时代，页表不是瓶颈，地址位宽才是——这也是"多级页表在 64 位上仍然只走 4 级"的原因。

## 七、延伸阅读

OSTEP 第 17 章（Segmentation，理解"为什么分页赢了"）、第 19 章（TLB 的完整机制与上下文标记 PCID）、第 21-22 章（完整翻译机制与 CR3 的实战例子，含 `cr3-trick` 汇编）与第 23-24 章（页表如何与交换/回收协作）。x86-64 的位级定义以 Intel SDM 第 3 卷第 4 章与 Linux `Documentation/mm/` 为准；本站另一篇《mmap 与 Unix 域套接字》讲这套机制在用户态最日常的入口。

**编者补充（与本站其他篇目的连接）**：

- **推理服务的内存账单**：模型权重常驻 + KV Cache 动态增长 = 大量长生命周期页；给 vLLM/SGLang 这类进程开 2 MB 大页能显著降低 TLB 压力（页表项数量降 512 倍），这也是很多 GPU 服务器把 `nr_hugepages` 预留当成部署步骤的原因。
- **容器与"内存 limit"的错觉**：`memory.max` 掐的是物理页（含页表与 slab），不是 `malloc` 的请求量；出现"没到 limit 却被 OOM"时先查 `memory.stat` 与 `smaps_rollup` 的 Swap/Pss 行。
- **和《条件变量与信号量》《死锁与同步》的接口**：缺页处理会让线程在内核里睡眠并持有页表锁/PGD 引用，这就是为什么"在缺页路径里做 I/O"需要极小心——也是 OSTEP 在回收一章强调 reverse mapping 与 pin 的动机。

---

> **来源**：抓取于 2026-09-19。译自/引自《Operating Systems: Three Easy Pieces》第 15 章 [Mechanism: Address Translation](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-mechanism.pdf)、第 18 章 [Paging: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf)、第 20 章 [Paging: Smaller Tables](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-smalltables.pdf)（作者 Remzi H. Arpaci-Dusseau、Andrea C. Arpaci-Dusseau，许可 CC BY-NC-SA 4.0，OSTEP 官网免费章节；章节编号取自各 PDF 页首标注）。x86-64 多级页表、规范地址与 LA57 部分依据 Intel 64 and IA-32 Architectures Software Developer's Manual Vol.3 §4.5 与 Linux 内核文档 [mm/](https://docs.kernel.org/mm/)；`mmap`/`MAP_HUGETLB`/`MAP_FIXED_NOREPLACE` 语义据 [mmap(2)](https://man7.org/linux/man-pages/man2/mmap.2.html)（Linux man-pages，GPL-2.0-or-later）核对。两级页表模拟器、`/proc/self/pagemap` 取样脚本与观测命令、排查表及编者补充为本站撰写；原文中线性页表 4 MB、16 KB 页降至 1 MB 等算术与结论沿用 OSTEP。
