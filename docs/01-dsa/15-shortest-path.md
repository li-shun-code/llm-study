---
title: 最短路径
source_url: https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/shortest-path.md
author: OI Wiki 项目
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 15
---

## 定义

（还记得这些定义吗？在阅读下列内容之前，请务必了解 [图论相关概念](https://oi-wiki.org/concept/) 中的基础部分．）

-   路径
-   最短路
-   有向图中的最短路、无向图中的最短路
-   单源最短路、每对结点之间的最短路

## 记号

为了方便叙述，这里先给出下文将会用到的一些记号的含义．

-   n 为图上点的数目，m 为图上边的数目；
-   s 为最短路的源点；
-   D(u) 为 s 点到 u 点的 **实际** 最短路长度；
-   dis(u) 为 s 点到 u 点的 **估计** 最短路长度．任何时候都有 dis(u) ≥ D(u)．特别地，当最短路算法终止时，应有 dis(u)=D(u)．
-   w(u,v) 为 (u,v) 这一条边的边权．

## 性质

对于边权为正的图，任意两个结点之间的最短路，不会经过重复的结点．

对于边权为正的图，任意两个结点之间的最短路，不会经过重复的边．

对于边权为正的图，任意两个结点之间的最短路，任意一条的结点数不会超过 n，边数不会超过 n-1．


## Dijkstra 算法

Dijkstra（/ˈdikstrɑ/或/ˈdɛikstrɑ/）算法由荷兰计算机科学家 E. W. Dijkstra 于 1956 年发现，1959 年公开发表．是一种求解 **非负权图** 上单源最短路径的算法．

### 过程

将结点分成两个集合：已确定最短路长度的点集（记为 S 集合）的和未确定最短路长度的点集（记为 T 集合）．一开始所有的点都属于 T 集合．

初始化 dis(s)=0，其他点的 dis 均为 +∞．

然后重复这些操作：

1.  从 T 集合中，选取一个最短路长度最小的结点，移到 S 集合中．
2.  对那些刚刚被加入 S 集合的结点的所有出边执行松弛操作．

直到 T 集合为空，算法结束．

### 时间复杂度

朴素的实现方法为每次 2 操作执行完毕后，直接在 T 集合中暴力寻找最短路长度最小的结点．2 操作总时间复杂度为 O(m)，1 操作总时间复杂度为 O(n²)，全过程的时间复杂度为 O(n² + m) = O(n²)．

可以用堆来优化这一过程：每成功松弛一条边 (u,v)，就将 v 插入堆中（如果 v 已经在堆中，直接执行 Decrease-key），1 操作直接取堆顶结点即可．共计 O(m) 次 Decrease-key，O(n) 次 pop，选择不同堆可以取到不同的复杂度，参考 [堆](./11-heap.md) 页面．堆优化能做到的最优复杂度为 O(nlog n+m)，能做到这一复杂度的有斐波那契堆等．

特别地，可以使用优先队列维护，此时无法执行 Decrease-key 操作，但可以通过每次松弛时重新插入该结点，且弹出时检查该结点是否已被松弛过，若是则跳过，复杂度 O(mlog n)，优点是实现较简单．

这里的堆也可以用线段树来实现，复杂度为 O(mlog n)，在一些特殊的非递归线段树实现下，该做法常数比堆更小．并且线段树支持的操作更多，在一些特殊图问题上只能用线段树来维护．

在稀疏图中，m = O(n)，堆优化的 Dijkstra 算法具有较大的效率优势；而在稠密图中，m = O(n²)，这时候使用朴素实现更优．

### 正确性证明

下面用数学归纳法证明，在 **所有边权值非负** 的前提下，Dijkstra 算法的正确性．

简单来说，我们要证明的，就是在执行 1 操作时，取出的结点 u 最短路均已经被确定，即满足 D(u) = dis(u)．

初始时 S = varnothing，假设成立．

接下来用反证法．

设 u 点为算法中第一个在加入 S 集合时不满足 D(u) = dis(u) 的点．因为 s 点一定满足 D(u)=dis(u)=0，且它一定是第一个加入 S 集合的点，因此将 u 加入 S 集合前，S ≠ varnothing，如果不存在 s 到 u 的路径，则 D(u) = dis(u) = +∞，与假设矛盾．

于是一定存在路径 s → x → y → u，其中 y 为 s → u 路径上第一个属于 T 集合的点，而 x 为 y 的前驱结点（显然 x ∈ S）．需要注意的是，可能存在 s = x 或 y = u 的情况，即 s → x 或 y → u 可能是空路径．

因为在 u 结点之前加入的结点都满足 D(u) = dis(u)，所以在 x 点加入到 S 集合时，有 D(x) = dis(x)，此时边 (x,y) 会被松弛，从而可以证明，将 u 加入到 S 时，一定有 D(y)=dis(y)．

下面证明 D(u) = dis(u) 成立．在路径 s → x → y → u 中，因为图上所有边边权非负，因此 D(y) ≤ D(u)．从而 dis(y) = D(y) ≤ D(u)≤ dis(u)．但是因为 u 结点在 1 过程中被取出 T 集合时，y 结点还没有被取出 T 集合，因此此时有 dis(u)≤ dis(y)，从而得到 dis(y) = D(y) = D(u) = dis(u)，这与 D(u)≠ dis(u) 的假设矛盾，故假设不成立．

因此我们证明了，1 操作每次取出的点，其最短路均已经被确定．命题得证．

注意到证明过程中的关键不等式 D(y) ≤ D(u) 是在图上所有边边权非负的情况下得出的．当图上存在负权边时，这一不等式不再成立，Dijkstra 算法的正确性将无法得到保证，算法可能会给出错误的结果．

### 实现

这里同时给出 O(n²) 的暴力做法实现和 O(m log m) 的优先队列做法实现．

**朴素实现**

> ```cpp
> struct edge {
>   int v, w;
> };
>
> vector<edge> e[MAXN];
> int dis[MAXN], vis[MAXN];
>
> void dijkstra(int n, int s) {
>   memset(dis, 0x3f, (n + 1) * sizeof(int));
>   dis[s] = 0;
>   for (int i = 1; i <= n; i++) {
>     int u = 0, mind = 0x3f3f3f3f;
>     for (int j = 1; j <= n; j++)
>       if (!vis[j] && dis[j] < mind) u = j, mind = dis[j];
>     vis[u] = true;
>     for (auto ed : e[u]) {
>       int v = ed.v, w = ed.w;
>       if (dis[v] > dis[u] + w) dis[v] = dis[u] + w;
>     }
>   }
> }
> ```
>

**优先队列实现**

> ```cpp
> struct edge {
>   int v, w;
> };
>
> struct node {
>   int dis, u;
>
>   bool operator>(const node& a) const { return dis > a.dis; }
> };
>
> vector<edge> e[MAXN];
> int dis[MAXN], vis[MAXN];
> priority_queue<node, vector<node>, greater<node>> q;
>
> void dijkstra(int n, int s) {
>   memset(dis, 0x3f, (n + 1) * sizeof(int));
>   memset(vis, 0, (n + 1) * sizeof(int));
>   dis[s] = 0;
>   q.push({0, s});
>   while (!q.empty()) {
>     int u = q.top().u;
>     q.pop();
>     if (vis[u]) continue;
>     vis[u] = 1;
>     for (auto ed : e[u]) {
>       int v = ed.v, w = ed.w;
>       if (dis[v] > dis[u] + w) {
>         dis[v] = dis[u] + w;
>         q.push({dis[v], v});
>       }
>     }
>   }
> }
> ```
>


## 不同方法的比较

| 最短路算法   | Floyd      | Bellman–Ford | Dijkstra     | Johnson       |
| ------- | ---------- | ------------ | ------------ | ------------- |
| 最短路类型   | 每对结点之间的最短路 | 单源最短路        | 单源最短路        | 每对结点之间的最短路    |
| 作用于     | 任意图        | 任意图          | 非负权图         | 任意图           |
| 能否检测负环？ | 能          | 能            | 不能           | 能             |
| 时间复杂度   | O(N³)   | O(NM)      | O(Mlog M) | O(NMlog M) |

注：表中的 Dijkstra 算法在计算复杂度时均用 `priority_queue` 实现．

---

> **来源**：本文转载自 [最短路径](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/shortest-path.md)，作者 OI Wiki 项目，许可 CC BY-SA 4.0。抓取于 2026-09-13。
> 原文面向算法竞赛、代码示例为 C++；本文选取基础定义与最常用的 Dijkstra 算法，Bellman–Ford / Floyd 等其余算法见原文与文末对比表。
