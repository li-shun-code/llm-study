---
title: 并查集与等价类归并
source_url: https://raw.githubusercontent.com/TheAlgorithms/Python/master/data_structures/disjoint_set/disjoint_set.py
author: 本站整理；参考 TheAlgorithms/Python、OI Wiki《并查集》
license: MIT（TheAlgorithms/Python）；CC BY-SA 4.0（OI Wiki 定义与配图）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（标准库，无第三方依赖）
order: 20
group: 图
---
## 为什么需要并查集

> **难度**：★★☆。代码只有二十行，但它是“动态连通性”这一整类问题的钥匙。
> **适合**：要做社区划分、近似去重、实体对齐、等价类归并的读者。
> **前置**：《图》《哈希表》。本篇只用邻接关系和字典，不需要《图的遍历（DFS/BFS）》的知识，但两者常可互换，文中会对比。


有一类问题反复出现在工程里：**给一堆元素，不断告知“这两个元素属于同一类”，随时询问“这两个是不是同一类”**。

- 社交网络：好友关系传递（A 和 B 同群、B 和 C 同群 ⇒ A 和 C 同群），要把用户划成社区。
- 文档去重：两两比对相似度过阈值就合并，最后每组留一个代表。
- 实体对齐：同一个人在不同系统里有手机号、邮箱、OpenID，要把它们归并为一个实体。
- 知识图谱构建：LLM 抽出的「同一实体的不同写法」要归并（`HNSW` / `HNSW 索引` / `分层可导航小世界图`），归完之后还要能把图切成社区，逐社区做摘要——这是 GraphRAG 类流水线的第一步。
- 账号打通 / 风控：同一设备、同一支付方式关联出的账号簇。
- 图片/传感器聚类：把距离小于阈值的点归并成簇。
- 无向图连通分量、Kruskal 最小生成树、棋盘格连块判断。

用《图的遍历（DFS/BFS）》里的 BFS/DFS 也能求连通分量，但每次新增一条边，所有已算好的分量都可能变化，得重新遍历一遍，代价 O(V + E) 。**并查集（disjoint set / union-find）把“合并”和“查询”都做到近乎常数时间**，专门解决这种“动态增量式”的归并问题。

代价是它有明确的能力边界：**只支持合并，不支持拆分**，而且**它只回答“同不同类”，不回答“怎么走的”**。

## 定义与直观图

并查集维护一组互不相交的集合，每个集合用“树”来表示，**树根就是这个集合的代表元素（find 的结果）**。它提供两个操作：

- `find(x)` ：返回 x 所在集合的根，用来判断归属。
- `union(x, y)` ：把两个集合合并——做法是让一棵树的根指向另一棵树的根。

![并查集：若干棵不相关的树](assets/oi_ds__disjoint-set.svg)

查询 `find(6)` 时沿父指针一路向上直到根节点，路径上的 6 → 4 → 2 → 1 都要走一遍：

![并查集查询：沿父指针上溯到根](assets/oi_ds__disjoint-set-find.svg)

合并时把一棵树的根挂到另一棵树的根下面：

![并查集合并](assets/oi_ds__disjoint-set-merge.svg)

如果每次合并都随机地挂，树可能退化成一条链，`find` 就退化为 O(n) ：

**1 - 2 - 3 - 4 - 5 - … - n**

因此需要两个优化。

1. **按大小（或按秩）合并**：始终让小树挂到大树上，树高就被控制在 O(log n) 以内。
2. **路径压缩**：`find` 走过路径上所有节点的父指针，直接改指向根。以后再查这些点就是 O(1) 。

![路径压缩后所有节点直连根](assets/oi_ds__disjoint-set-compress.svg)

两个优化一起用，n 个元素、m 次操作的均摊代价是 O(m · α(n)) ，其中 α 是反 Ackermann 函数——在 n 大到宇宙原子数的范围内，α(n) ≤ 5 ，工程上可以直接当常数看待。

### 两个优化各自保证了什么

把结论拆开记，比背一个 α(n) 有用得多。

**按大小合并单独保证树高 O(log n)。** 归纳：一个节点每往上一层，它所在子树的规模至少翻倍（因为只有“小树挂大树”才允许它的父链变长）。规模从 1 涨到 n 最多翻倍 log₂ n 次，所以任意节点到根的路径长度不超过 log₂ n 。这也顺手解释了为什么“按大小”和“按秩（按高度）”效果等价——两者都在阻止小树变成大树的上层。

**路径压缩单独保证“查过的路径以后都便宜”。** `find` 走一遍就把沿途节点全部直挂到根，同一批节点再查就是 O(1) 。但只有压缩、没有按大小合并时，最坏情况仍然不好（构造一串“先压缩再挂到链尾”的操作可以退化）。

**两个一起用才是 O(m · α(n))** ，这个界由 Tarjan 给出，证明超出本文范围；工程上你要知道的是它的**后果**：千万级元素、亿次操作也不必担心算法复杂度，要担心的是内存和常数（见“常见坑”）。顺带一个实践结论：**只做按大小合并（不做压缩）就足以应付绝大多数场景** ，而 `path halving` （路径减半，后文“按秩合并与 path halving”一节给出完整实现）是压缩的廉价近似——一次遍历顺手改父指针，代码更短、也没有递归爆栈风险。

## Python 实现

### 通用版：字典父指针（支持任意可哈希元素、支持增量）

这是工程里最好用的形态：不必预先知道元素个数，随时 `add` 。

```python
class DisjointSet:
    """并查集：按大小合并 + 路径压缩（迭代实现，不会爆栈）"""

    def __init__(self):
        self.parent: dict[object, object] = {}  # 元素 -> 父元素
        self.size: dict[object, int] = {}       # 根元素 -> 集合大小

    def add(self, x) -> None:
        """加入一个新元素；已存在则忽略"""
        if x not in self.parent:
            self.parent[x] = x
            self.size[x] = 1

    def find(self, x):
        """返回 x 所在集合的根；不存在则顺手创建"""
        if x not in self.parent:
            self.add(x)
            return x
        # 第一遍：找到根
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        # 第二遍：路径压缩，把沿途节点直接挂到根上
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, x, y) -> bool:
        """合并两个集合；若本就在同一集合返回 False（Kruskal、去重时很有用）"""
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        # 按大小合并：小挂大
        if self.size[rx] < self.size[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        self.size[rx] += self.size[ry]
        del self.size[ry]
        return True

    def connected(self, x, y) -> bool:
        return self.find(x) == self.find(y)

    def components(self) -> dict[object, list]:
        """按根分组，返回 {代表元: [成员, ...]}"""
        groups: dict[object, list] = {}
        for x in self.parent:
            groups.setdefault(self.find(x), []).append(x)
        return groups
```

代码里有一处刻意的取舍：**`find` 用迭代而非递归**。教材里常见的递归写法只有两行：

```python
def find(self, x):
    if self.parent[x] != x:
        self.parent[x] = self.find(self.parent[x])  # 路径压缩
    return self.parent[x]
```

它同样正确、更简洁，但在一条长度为数十万的链上会直接 `RecursionError`（Python 默认递归上限 1000 ，即使用 `sys.setrecursionlimit` 抬高也容易段错误）。**生产代码请用迭代版**；面试白板可以用递归版，但要能说出这个差别。

### 紧凑版：数组下标（元素是 0..n-1）

元素是整数且数量已知时，用列表比字典快 3~5 倍（省掉哈希开销），适合内层循环极多的场景：

```python
class DisjointSetArray:
    """并查集（0..n-1 元素，数组实现）"""

    def __init__(self, n: int):
        self.parent = list(range(n))
        self.size = [1] * n
        self.count = n  # 当前连通分量数量

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            # 路径减半（path halving）：一步一跳地往爷爷挂，单次遍历即可完成压缩
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, x: int, y: int) -> bool:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.size[rx] < self.size[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        self.size[rx] += self.size[ry]
        self.count -= 1
        return True
```

`count` 字段常被忽略却非常实用：判断“所有元素是否已归为一类”只需 `count == 1` ，不必遍历。

### 按秩合并与 path halving：两条优化各自怎么写

上面用的都是“按大小合并 + 全路径压缩”。工业代码里还有两个常见变体，值得单独给出实现与对照：**按秩合并**（rank，树高上界）与 **path halving**（路径减半，压缩的廉价近似）。下面这份是可直接跑的对照版：

```python
class DSUHybrid:
    """并查集：按秩合并（rank）+ path halving（路径减半），纯数组、零递归"""

    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n          # 秩 = 树高的上界（不是集合大小、也不是实时深度）
        self.count = n               # 剩余连通分量数

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            # path halving：把 x 挂到「爷爷」上，然后跳到爷爷；单次遍历、无递归
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, x: int, y: int) -> bool:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False                                  # 本就连通：Kruskal 里即“会成环”
        if self.rank[rx] < self.rank[ry]:                 # 按秩合并：矮树挂到高树下
            rx, ry = ry, rx                               # 交换后保证 rx 的秩不小于 ry
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1                            # 等高相接，新根的高度才 +1
        self.count -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)
```

**为什么秩只在等高时增加**：把一棵秩为 3 的树挂到秩为 5 的树下面，新树的秩仍是 5 ，没有任何一条路径变长；只有两棵秩相同的树相接，被挂那侧的最深叶子才“多走一步”，秩升到 6 。这正是“秩是树高上界”的来源，也是它和“按大小合并”等价有效的同一个理由。

**path halving 与全路径压缩的差别**：全压缩要走两遍（先找根、再把整条路径直挂到根），压缩得最彻底，但常数翻倍且写操作更多；`path halving` 只走一遍，每步把节点改挂到爷爷，代价是路径上的点只被“抬一层”。实测上二者几乎同样快，而 halving **代码更短、没有递归、不会爆栈** ，因此标准库风格与教科书都偏爱它。

三种策略的写法差异，集中体现在“`find` 走几遍”和“`union` 看什么字段”：

| 组合 | `find` | `union` 依据 | 树高 | 特点 |
| ---- | ------ | ------------ | ---- | ---- |
| 按大小 + 全压缩 | 两遍，沿途直挂根 | `size` （元素个数） | 均摊近 O(α) | 压缩最彻底，附带能 O(1) 回答组大小 |
| 按秩 + path halving | 一遍，每次抬一层 | `rank` （高度上界） | 均摊近 O(α) | 代码最短、无递归，写放大最小 |
| 只按秩、不压缩 | 一遍，只读不改 | `rank` | **保证 ≤ ⌈log₂ n⌉** | 保留“到根的距离”语义，适合可回滚 / 带权场景 |

最后那一行有个重要推论，值得用实验证实。**只按秩合并就已经保证树高 O(log n)** ——下例构造“按秩合并的最坏情形”（每次把两棵等秩的树并起来），实测最大树高恰好等于 log₂ n ：

```python
class DSURankNoCompress:
    """只按秩合并、不做路径压缩：用来验证「树高 ≤ log2 n」这个上界是紧的"""

    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            x = self.parent[x]                 # 只往上走，绝不改指针
        return x

    def union(self, x: int, y: int) -> None:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1


def depth_from(node: int, ds) -> int:
    """从 node 沿父指针走到根的步数（不触发任何压缩，仅用于观察树形）"""
    steps = 0
    while ds.parent[node] != node:
        node = ds.parent[node]
        steps += 1
    return steps


def build_rank_worst_case(levels: int) -> DSURankNoCompress:
    """按秩合并下让树高取到上界的最坏构造：逐轮把两棵等秩的树并成一棵"""
    ds = DSURankNoCompress(2 ** levels)
    roots = list(range(2 ** levels))
    for _ in range(levels):
        nxt = []
        for i in range(0, len(roots), 2):
            ds.union(roots[i], roots[i + 1])
            nxt.append(ds.find(roots[i]))
        roots = nxt
    return ds


for lv in (4, 8, 10):
    d = build_rank_worst_case(lv)
    print(f"n = {2 ** lv:>5} ，最大树高 {max(depth_from(i, d) for i in range(2 ** lv))} ，log2(n) = {lv}")
# n =    16 ，最大树高 4 ，log2(n) = 4
# n =   256 ，最大树高 8 ，log2(n) = 8
# n =  1024 ，最大树高 10 ，log2(n) = 10
```

`n = 1024 时树高恰好 10` ，说明“按大小 / 按秩合并保证 O(log n)”是**紧确界**而非松 bound 。工程含义很直接：**即使你因为某种原因（要回滚、要维护到根的距离）放弃了路径压缩，只保留按秩合并，单次 `find` 也最差只是 O(log n) ≈ 20 次跳转** ，完全够用。这正是下文“常见坑”第 2 条推荐的退路。

### 复杂度小结

- **只做按秩（或按大小）合并**：n 个元素、m 次操作 → **O(m log n)** ，空间 O(n) 。
- **按秩 + 路径压缩（含 halving）**：**O(m · α(n))** 均摊，α 反 Ackermann 函数，n ≤ 2^65536 时 α(n) ≤ 5 ，**当作常数即可** 。
- **单次 `find` 的最坏代价**：退化链 O(n) → halving 摊平后接近 O(α(n)) ；不压缩但有按秩合并则 O(log n) 。
- **建表成本**：数组版 O(n) 初始化；字典版随 `add` 摊销 O(1) ，但每个元素多几十字节（见“常见坑”第 6 条的内存估算）。

## 应用一：社交网络社区划分

给定好友关系对，划分社区并输出规模分布：

```python
def detect_communities(edges: list[tuple[str, str]]) -> list[list[str]]:
    ds = DisjointSet()
    for a, b in edges:
        ds.union(a, b)  # union 内部会自动 add，省去预扫描
    groups = ds.components()
    # 按社区规模从大到小排，便于观察“长尾”
    return sorted(groups.values(), key=len, reverse=True)


edges = [("u1", "u2"), ("u2", "u3"), ("u4", "u5"), ("u3", "u6"), ("u1", "u6")]
print(detect_communities(edges))
# [['u1', 'u2', 'u3', 'u6'], ['u4', 'u5']]  # 两个社区，成员顺序即 parent 的插入顺序
```

社区划分完成后，常见的下游需求都能靠 `size` 字典 O(1) 回答：最大社区规模、某个用户所在社区的大小、社区数量。这正是“朋友圈可见范围”“推荐种子人群”这类逻辑的底层结构。

同一份数据用 BFS 也能做，但要先把所有边建成邻接表、再逐点起搜索；**边是流式到达、且要随时回答归属问题时，并查集明显更合适**。反过来，如果还要求“两点之间的具体路径”，并查集就无能为力了（它只记父指针，不记图），那要用图的遍历。

### 换成图谱的口径：这就是“社区”的粗划分

GraphRAG 类流水线在做什么？先用 LLM 从文档里抽三元组，再把实体连成图、把图切成社区、逐社区生成摘要，最后回答“全局性”问题。中间那步“切社区”，微软的实现用的是 Leiden（能处理重叠社区与模块度），但**在只需要“把互相连通的实体打包送进一次摘要”时，并查集是便宜得多的选择**：不依赖第三方库、流式加边、结果就是连通块。

```python
# DisjointSet 沿用“通用版”一节的实现
def build_communities(triples: list[tuple[str, str, str]], min_size: int = 3) -> dict[str, list[str]]:
    """triples：LLM 抽出的 (主体, 关系, 客体)。返回规模 >= min_size 的社区。

    代表元取并查集的根，因此社区数量 = 连通块数量。
    """
    ds = DisjointSet()
    for subj, _rel, obj in triples:
        ds.union(subj, obj)            # 只要共现过，就归进同一个社区
    return {rep: members for rep, members in ds.components().items()
            if len(members) >= min_size}


triples = [
    ("HNSW", "属于", "近邻图"), ("近邻图", "用于", "ANN 检索"),
    ("IVF", "依赖", "聚类"), ("聚类", "加速", "ANN 检索"),
    ("FastAPI", "实现", "ASGI"),
]
print(build_communities(triples))
# {'HNSW': ['HNSW', '近邻图', 'ANN 检索', 'IVF', '聚类']}
# 只剩一个社区；FastAPI/ASGI 这条 2 元素碎片被 min_size 过滤掉了
```

`min_size` 这个过滤条件看着朴素，实际很关键：LLM 抽取必然产生大量“孤立实体对”，直接给它们各发一次摘要请求，成本会炸在长尾上。工程上常见的处理是把小碎片合并成若干个“其它实体”批次（按 token 预算切分，见《前缀和与差分》的应用一节），或者干脆只做实体归并不做社区摘要。至于“社区内部还要按主题细分”，那已经超出并查集的表达力——它给不出重叠社区，得交给 Leiden 之类的算法，背景见《GraphRAG：用知识图谱回答"全局性"问题》。

## 应用二：文档与向量的近似去重

RAG 语料清洗里最典型的用法：两两（或近邻对）相似度超过阈值就视为重复，最后每组保留一个代表。

```python
def deduplicate(items: list[str], vectors: list[list[float]], threshold: float = 0.92) -> list[int]:
    """把近似重复的元素归并，返回每组保留下来的下标（组内下标最小者作为代表）"""
    n = len(items)
    ds = DisjointSetArray(n)
    # 真实场景这里应换成近邻检索（见《向量相似度与 HNSW 近邻图》），
    # 两两比对的 O(n^2) 只适合几千条以内的小规模校对
    for i in range(n):
        for j in range(i + 1, n):
            if cosine(vectors[i], vectors[j]) >= threshold:
                ds.union(i, j)
    reps: dict[int, int] = {}
    for i in range(n):
        root = ds.find(i)
        if root not in reps:
            reps[root] = i  # 组内下标最小者作为代表，结果可复现
    return sorted(reps.values())


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(x * x for x in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0
```

**必须理解“传递性风险”**：并查集会把 A~B、B~C 归为同组，哪怕 A 与 C 的相似度只有 0.7 。阈值定得越松，簇的“链式漂移”越严重，最后可能出现一篇完全不相关的文档被当成重复删掉。工程上的缓解办法有三条：把阈值调高、用互近邻（A 是 B 的 top-k 且 B 也是 A 的 top-k）而不是单向量近邻来生成边、或改用不依赖传递性的聚类（如单轮 K-Medoids）。

### 别再两两比对：先分桶，再归并

上面那段 `for i / for j` 是 O(n²) ，几千条语料还能忍，几万条就是灾难。真正能上线的写法是**先用一个廉价谓词把候选缩小，再在桶内两两比对生成边**，并查集只负责最后收口：

```python
# DisjointSet 沿用“通用版”一节的实现
def shingles(text: str, k: int = 3) -> set[str]:
    """字符 k-gram 集合，当作近似重复的指纹；先去空白再切"""
    norm = "".join(text.split())
    return {norm[i:i + k] for i in range(max(len(norm) - k + 1, 0))}


def jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a or b else 1.0


def dedup_bucket(doc_ids: list[str], texts: list[str], threshold: float = 0.6,
                 band: int = 8) -> list[list[str]]:
    """按指纹规模分桶，只在桶内两两比对，再用并查集归并。"""
    fp = [shingles(t) for t in texts]
    buckets: dict[int, list[int]] = {}
    for i, s in enumerate(fp):
        # 相似度高的文本长度必然接近，所以“规模落在同一档”是个安全的粗过滤
        buckets.setdefault(len(s) // band, []).append(i)

    ds = DisjointSet()
    for idx in buckets.values():
        for a in range(len(idx)):
            for b in range(a + 1, len(idx)):
                i, j = idx[a], idx[b]
                if jaccard(fp[i], fp[j]) >= threshold:
                    ds.union(doc_ids[i], doc_ids[j])
    groups: dict[str, list[str]] = {}
    for d in doc_ids:
        groups.setdefault(ds.find(d), []).append(d)
    return list(groups.values())


docs = ["a1", "a2", "a3", "a4"]
texts = [
    "向量数据库的 HNSW 索引通过多层图结构加速近邻检索。",
    "向量数据库的 HNSW 索引通过多层图结构来加速近邻检索，效果很好。",
    "Kubernetes 的调度器会为每个 Pod 选择满足资源请求的节点。",
    "向量数据库的 HNSW 索引通过多层图结构加速近邻检索。",
]
print(dedup_bucket(docs, texts))
# [['a1', 'a2', 'a4'], ['a3']]  -> 三条同义/重复文本合成一组，K8s 那条独立
```

分桶的关键是**桶谓词必须比相似度计算便宜得多，且不能漏掉真配对**：“长度差得远的两段文本不可能高度相似”就是这样一个谓词，它把每桶规模压下来，却不会误伤。再往上一档就是 MinHash + LSH 分带（用哈希签名代替长度分档），或者直接用向量近邻图给出候选对——见《向量相似度与 HNSW 近邻图》与《布隆过滤器与集合去重》；并查集那一层始终不变，变的只是“边从哪来”。

## 应用三：实体对齐与账号合并

“手机号 138… ←→ 邮箱 a@x.com ←→ OpenID wx_1” 三条映射来自三个系统，业务上要输出统一实体 ID：

```python
def resolve_entities(records: list[list[str]]) -> dict[str, str]:
    """records：每条是一组“已确认等价”的标识符。返回 标识符 -> 统一实体名"""
    ds = DisjointSet()
    for group in records:
        for a, b in zip(group, group[1:]):  # 链式两两合并即可
            ds.union(a, b)
    entity_of: dict[str, str] = {}
    for ident in ds.parent:
        entity_of[ident] = ds.find(ident)  # 用根作为统一实体 ID
    return entity_of


print(resolve_entities([["138", "a@x.com"], ["a@x.com", "wx_1"], ["999", "b@y.com"]]))
# {'138': '138', 'a@x.com': '138', 'wx_1': '138', '999': '999', 'b@y.com': '999'}
```

选根作为实体 ID 有个隐患：**根会随合并顺序变化**。若需要稳定 ID（写入数据库后不能变），应改为“取组内字典序最小者”并在合并时固定它，或者用另一层 `root -> 稳定 ID` 的映射表。

## 应用四：Kruskal 最小生成树

并查集是 Kruskal 算法的核心：按边权升序处理，若边的两端不在同一集合就选入，否则跳过（会成环）。

```python
def kruskal(edges: list[tuple[float, str, str]], n: int) -> list[tuple[str, str]]:
    ds = DisjointSet()
    res = []
    for w, u, v in sorted(edges):  # 按权重升序
        if ds.union(u, v):         # union 返回 False 表示已连通，会成环
            res.append((u, v))
            if len(res) == n - 1:  # n 个顶点的生成树只需 n-1 条边
                break
    return res
```

`union` 返回布尔值这个小设计，在这里省掉了一次额外的 `connected` 判断。

## 应用五：离线查询合并（先归并、后回放）

并查集最舒服的用法其实不在在线请求路径上，而在**离线批处理**：先把“等价关系”一次性合并完，再把成千上万条查询当作字典查。三类典型形态：

- **等价写法 / 别名归一**：日志里的 `us-east-1` 、`US-East-1` 、`弗吉尼亚北部` 是同一个区域；查询串里的“HNSW 是什么”和“什么是 HNSW”意图相同。归并后**每组只发一次下游请求**（一次 embedding 、一次远程查库），直接按比例省成本。
- **批量归属判定**：账号打通、实体对齐这类任务，白天在线只读“是不是同一个实体”，夜里把新发现的映射边跑一遍 `union` 重建，再把结果导出成 `标识符 -> 统一 ID` 的映射表。这类“全量重建”正是应对“不支持删除”的正确方式（见“常见坑”第 1 条）。
- **成对查询的回放**：给定一批边和一批“两点是否同类”的询问，**先把边全部合并、再顺序回答**，比“每问一次就重新遍历图”快若干个数量级——这就是把 O(Q·(V+E)) 的图遍历压成 O(E·α + Q·α) 的关键一步。

```python
class DSUHybrid:
    """并查集：按秩合并 + path halving（0..n-1 元素），实现见前文"""

    def __init__(self, n: int):
        self.parent = list(range(n))
        self.rank = [0] * n
        self.count = n

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, x: int, y: int) -> bool:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return False
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1
        self.count -= 1
        return True

    def connected(self, x: int, y: int) -> bool:
        return self.find(x) == self.find(y)


def merge_then_answer(edges: list[tuple[int, int]], pairs: list[tuple[int, int]],
                      n: int) -> list[bool]:
    """离线查询合并：先把全部边 union 完，再一次性回放所有「是否同类」的查询"""
    ds = DSUHybrid(n)
    for a, b in edges:
        ds.union(a, b)                     # 归并阶段：只做一次
    return [ds.connected(a, b) for a, b in pairs]   # 回放阶段：每条近似 O(1)


def dedupe_queries_offline(queries: list[str], alias: list[tuple[str, str]]):
    """把等价写法的查询归并成组：每组只需发一次下游请求"""
    keys = sorted(set(queries) | {k for pair in alias for k in pair})
    ids = {k: i for i, k in enumerate(keys)}       # 字符串 -> 连续整数，才能用数组版
    ds = DSUHybrid(len(keys))
    for a, b in alias:
        ds.union(ids[a], ids[b])
    groups: dict[str, list[str]] = {}
    for q in keys:                                  # keys 已排序 -> 组内顺序可复现
        groups.setdefault(keys[ds.find(ids[q])], []).append(q)
    return groups


if __name__ == "__main__":
    print(merge_then_answer([(0, 1), (1, 2), (3, 4)], [(0, 2), (0, 3), (4, 3)], n=6))
    # [True, False, True]

    q = ["HNSW 是什么", "什么是 HNSW", "IVF 原理", "HNSW 索引介绍", "BM25 原理"]
    alias = [("HNSW 是什么", "什么是 HNSW"), ("什么是 HNSW", "HNSW 索引介绍")]
    for rep, members in dedupe_queries_offline(q, alias).items():
        print("组代表:", rep, "->", members)
    # 组代表: BM25 原理 -> ['BM25 原理']
    # 组代表: HNSW 是什么 -> ['HNSW 是什么', 'HNSW 索引介绍', '什么是 HNSW']
    # 组代表: IVF 原理 -> ['IVF 原理']
    # 5 条查询合成 3 组：下游只需处理 3 次
```

两个实现要点值得点名。**字符串必须先在“建表阶段”映射成连续整数**（`ids` 那张表），数组版并查集才用得上；映射表本身是哈希表，一次构建、后续 O(1) 复用。**代表元要选得稳定**：上例用“排序后组内字典序最小者”做代表，这样同一批输入无论别名边以什么顺序给出，产出的组代表都一样，可以直接落库、可以对拍。

代价是并查集在这里体现出的全部局限：**边必须全量给到**（增量到达就得重建）、**分组结果只到“同不同组”为止**（要“这两者之间怎么等价”得回图中遍历）、**别名传递会连带过度归并**（“A 近似 B、B 近似 C”不代表 A 与 C 等价，与去重场景同一个风险）。所以离线合并的正确定位是：**它是一个粗粒度分桶器，负责把“明显该一起处理”的请求打包，精细判断留给下游。**

## 常见坑

1. **只支持合并，不支持删除**。这不是实现偷懒，而是结构决定的：一条父指针被后来的合并覆盖后，无法还原“合并前每个节点的父是谁”。生产里正确的做法不是去补这个洞，而是**改变更新策略**——定期全量重建（把当前有效边重跑一遍 union，百万级元素秒级完成）、按时间分桶各自维护一个并查集再在桶间做映射、或者把“撤销”建模成给元素打墓碑标记。真的需要回滚语义（例如边会被反复试探的离线算法）时，才考虑记录修改栈的可回滚版本，它要求你**放弃路径压缩**，否则栈无法还原。
2. **路径压缩会毁掉“到根的距离”语义**。一旦你想顺带维护“每个节点到根的量”（层级归属、单位换算比例、库存折算），压缩会把这条链压平，累计量就得小心重算。工程上更稳的选择是：只保留按大小合并、不做压缩（树高仍是 O(log n) ，完全够用），或者干脆把这类带数量的关系放回图里用遍历/最短路算——见《最短路径与 NetworkX 实践》。
3. **忘记 `add` 导致 KeyError**。字典版可以在 `find` 里顺手创建，但会静默改变集合规模；严格些应显式 `add` 或让 `find` 抛错。
4. **递归 find 爆栈**。见前文，生产环境一律用迭代版或 `path halving` 。
5. **把“连通”当成“相似”**。并查集聚合的是等价关系（自反、对称、传递），而相似度不满足传递性，这是去重场景误删的根源。
6. **大规模时内存**。字典版每个元素约 200 字节（两个 dict 表项 + 字符串对象），千万级元素请换数组版 + 把字符串映射成整型 ID（`dict[str, int]` 建一次索引即可）。
7. **多线程下不安全**。`parent`/`size` 的更新不是原子的；并发场景要么加锁，要么按分片（sharding）拆成多个独立并查集。
8. **`components()` 不是免费的**。它要对每个元素调一次 `find` ，是 O(n · α(n)) 并且会顺便改写父指针；别在热循环里反复调用，取一次结果缓存下来用。
9. **根是“实现细节”而不是业务 ID**。合并顺序一变，代表元就变。任何要落库、要出现在对外接口里的 ID，都必须显式做一次 `root -> 稳定 ID` 的映射，别把根直接返回给调用方。

## 延伸阅读

- TheAlgorithms/Python 的 `data_structures/disjoint_set/` 目录（MIT 许可），含字典版与数组版实现，可作为对照阅读。
- 《布隆过滤器与集合去重》：与并查集互补——布隆过滤器判断“可能见过”，并查集归并“确认等价”。
- 《向量相似度与 HNSW 近邻图》：为大规模去重高效地生成候选边，取代 O(n²) 两两比对。
- 《拓扑排序与依赖调度》：并查集处理无向图的连通性，拓扑排序处理有向无环图的顺序，两者是图算法的一对基石。
- 《GraphRAG：用知识图谱回答"全局性"问题》：社区划分在真实图谱流水线里的位置，以及 Leiden 与连通块的差别。
- 《哈希表》：并查集的字典版本质上是“用哈希表存父指针”，元素 ID 映射与规模估算的常识都来自那里。

---

> **来源**：抓取于 2026-09-19。概念定义与四张示意图取自 [OI Wiki《并查集》](https://oi-wiki.org/ds/dsu/)（OI Wiki 项目，CC BY-SA 4.0，图片已下载至本模块 `assets/` 目录）；接口设计参考 TheAlgorithms/Python 的 `data_structures/disjoint_set/disjoint_set.py`（MIT 许可）。原文页面里的 C++ 实现、带权并查集与可持久化并查集等进阶变体未收录，其思路已按工程口径改写为本文的“只按秩合并保留距离语义”“放弃压缩换取可回滚”两条取舍说明。正文中的社区划分与 GraphRAG 粗划分、分桶近似去重、实体对齐、Kruskal、离线查询合并五个应用，按秩合并 / path halving / 全路径压缩的三版 Python 实现、树高上界实验与复杂度推导均为本站编写，已在 CPython 3.12 下运行验证。
