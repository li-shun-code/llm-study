---
title: 拓扑排序
source_url: https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/topo.md
author: OI Wiki 项目
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 14
---

## 定义

拓扑排序（Topological sorting）要解决的问题是如何给一个有向无环图的所有节点排序．

我们可以拿大学每学期排课的例子来描述这个过程，比如学习大学课程中有：「程序设计」，「算法语言」，「高等数学」，「离散数学」，「编译技术」，「普通物理」，「数据结构」，「数据库系统」等．按照例子中的排课，当我们想要学习「数据结构」的时候，就必须先学会「离散数学」，学习完这门课后就获得了学习「编译技术」的前置条件．当然，「编译技术」还有一个更加前的课程「算法语言」．这些课程就相当于几个顶点 u, 顶点之间的有向边 (u,v) 就相当于学习课程的顺序．教务处安排这些课程，使得在逻辑关系符合的情况下排出课表，就是拓扑排序的过程．

![topo](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/images/topo-example-1.svg)

但是如果某一天排课的老师打瞌睡了，说想要学习 数据结构，还得先学 操作系统，而 操作系统 的前置课程又是 数据结构，那么到底应该先学哪一个（不考虑同时学习的情况）？在这里，数据结构 和 操作系统 间就出现了一个环，显然同学们现在没办法弄清楚自己需要先学什么了，也就没办法进行拓扑排序了．因为如果有向图中存在环路，那么我们就没办法进行拓扑排序．

因此我们可以说 在一个 [DAG（有向无环图）](https://oi-wiki.org/dag/) 中，我们将图中的顶点以线性方式进行排序，使得对于任何的顶点 u 到 v 的有向边 (u,v), 都可以有 u 在 v 的前面．

还有给定一个 DAG，如果从 i 到 j 有边，则认为 j 依赖于 i．如果 i 到 j 有路径（i 可达 j），则称 j 间接依赖于 i．

拓扑排序的目标是将所有节点排序，使得排在前面的节点不能依赖于排在后面的节点．

## AOV 网

日常生活中，一项大的工程可以看作是由若干个子工程组成的集合，这些子工程之间必定存在一定的先后顺序，即某些子工程必须在其他的一些子工程完成后才能开始．

我们用有向图来表现子工程之间的先后关系，子工程之间的先后关系为有向边，这种有向图称为顶点活动网络，即 **AOV 网  (Activity On Vertex Network)**．一个 AOV 网必定是一个有向无环图，即不带有回路．与 DAG 不同的是，AOV 的活动都表示在顶点上．（上面的例图即为一个 AOV 网）

在 AOV 网中，顶点表示活动，弧表示活动间的优先关系．AOV 网中不应该出现环，这样就能够找到一个顶点序列，使得每个顶点代表的活动的前驱活动都排在该顶点的前面，这样的序列称为拓扑序列（一个 AOV 网的拓扑序列不是唯一的），由 AOV 网构造拓扑序列的过程称为拓扑排序．因此，拓扑排序也可以解释为将 AOV 网中所有活动排成一个序列，使得每个活动的前驱活动都排在该活动的前面（一个 AOV 网中的拓扑排序也不是唯一的）．

-   前驱活动：有向边起点的活动称为终点的前驱活动（只有当一个活动的前驱全部都完成后，这个活动才能进行）．

-   后继活动：有向边终点的活动称为起点的后继活动．

检测 AOV 网中是否带环的方式是构造拓扑序列，看是否包含所有顶点．

### 构造拓扑序列步骤

1.  从图中选择一个入度为零的点．
2.  输出该顶点，从图中删除此顶点及其所有的出边．

重复上面两步，直到所有顶点都输出，拓扑排序完成，或者图中不存在入度为零的点，此时说明图是有环图，拓扑排序无法完成，陷入死锁．


## Kahn 算法

### 过程

初始状态下，集合 S 装着所有入度为 0 的点，L 是一个空列表．

每次从 S 中取出一个点 u（可以随便取）放入 L, 然后将 u 的所有边 (u, v₁), (u, v₂), (u, v₃) … 删除．对于边 (u, v)，若将该边删除后点 v 的入度变为 0，则将 v 放入 S 中．

不断重复以上过程，直到集合 S 为空．检查图中是否存在任何边，如果有，那么这个图一定有环路，否则返回 L，L 中顶点的顺序就是构造拓扑序列的结果．

首先看来自 [Wikipedia](https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm) 的伪代码

**实现**

> ```text
> L ← Empty list that will contain the sorted elements
> S ← Set of all nodes with no incoming edges
> while S is not empty do
>     remove a node n from S
>     insert n into L
>     for each node m with an edge e from n to m do
>         remove edge e from the graph
>         if m has no other incoming edges then
>             insert m into S
> if graph has edges then
>     return error (graph has at least one cycle)
> else
>     return L (a topologically sorted order)
> ```

代码的核心是维持一个入度为 0 的顶点的集合．

可以参考该图

![topo](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/images/topo-example.svg)

对其排序的结果就是：2 -> 8 -> 0 -> 3 -> 7 -> 1 -> 5 -> 6 -> 9 -> 4 -> 11 -> 10 -> 12

### 时间复杂度

假设这个图 G = (V, E) 在初始化入度为 0 的集合 S 的时候就需要遍历整个图，并检查每一条边，因而有 O(E+V) 的复杂度．然后对该集合进行操作，显然也是需要 O(E+V) 的时间复杂度．

因而总的时间复杂度就有 O(E+V)

### 实现

```cpp
int n, m;
vector<int> G[MAXN];
int in[MAXN];  // 存储每个结点的入度

bool toposort() {
  vector<int> L;
  queue<int> S;
  for (int i = 1; i <= n; i++)
    if (in[i] == 0) S.push(i);
  while (!S.empty()) {
    int u = S.front();
    S.pop();
    L.push_back(u);
    for (auto v : G[u]) {
      if (--in[v] == 0) {
        S.push(v);
      }
    }
  }
  if (L.size() == n) {
    for (auto i : L) cout << i << ' ';
    return true;
  }
  return false;
}
```

## DFS 算法

### 实现

```cpp
using Graph = vector<vector<int>>;  // 邻接表

struct TopoSort {
  enum class Status : uint8_t { to_visit, visiting, visited };

  const Graph& graph;
  const int n;
  vector<Status> status;
  vector<int> order;
  vector<int>::reverse_iterator it;

  TopoSort(const Graph& graph)
      : graph(graph),
        n(graph.size()),
        status(n, Status::to_visit),
        order(n),
        it(order.rbegin()) {}

  bool sort() {
    for (int i = 0; i < n; ++i) {
      if (status[i] == Status::to_visit && !dfs(i)) return false;
    }
    return true;
  }

  bool dfs(const int u) {
    status[u] = Status::visiting;
    for (const int v : graph[u]) {
      if (status[v] == Status::visiting) return false;
      if (status[v] == Status::to_visit && !dfs(v)) return false;
    }
    status[u] = Status::visited;
    *it++ = u;
    return true;
  }
};
```

时间复杂度：O(E+V) 空间复杂度：O(V)

### 合理性证明

考虑一个图，删掉某个入度为 0 的节点之后，如果新图可以拓扑排序，那么原图一定也可以．反过来，如果原图可以拓扑排序，那么删掉后也可以．

### 应用

拓扑排序可以判断图中是否有环，还可以用来判断图是否是一条链．拓扑排序可以用来求 AOE 网中的关键路径，估算工程完成的最短时间．

### 求字典序最大/最小的拓扑排序

将 Kahn 算法中的队列替换成最大堆/最小堆实现的优先队列即可，此时总的时间复杂度为 O(E+V logV)．

---

> **来源**：本文转载自 [拓扑排序](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/topo.md)，作者 OI Wiki 项目，许可 CC BY-SA 4.0。抓取于 2026-09-13。
> 原文面向算法竞赛、代码示例为 C++；本站以 Python 为主，可对照学习其思路。本篇呼应模块 9：LangGraph 的 DAG 执行依赖拓扑序。
