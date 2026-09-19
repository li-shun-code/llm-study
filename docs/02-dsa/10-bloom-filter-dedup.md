---
title: 布隆过滤器与集合去重
source_url: https://en.wikipedia.org/wiki/Bloom_filter
author: 本站整理；参考 Wikipedia（Bloom filter）、Burton Howard Bloom (1970)
license: CC BY-SA 4.0
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（标准库，无第三方依赖）
order: 10
group: 哈希与字符串结构
---
## 为什么需要布隆过滤器

> **难度**：★★☆。原理一页纸就能讲完，但用错一次就可能把合法数据判成“已存在”。
> **定位**：《哈希表》给出“精确成员判断”的 O(1) 方案；本篇给出**用 1% 内存换 1% 误判**的近似方案，以及它与去重、缓存、长上下文管理的关系。
> **前置**：《哈希表》。需要“基数估计”（有多少个不同元素）时请看文末的 HyperLogLog 对照。


很多系统的瓶颈不是“算得慢”，而是“**存不下**”：

- 一个爬虫要判断“这个 URL 是否抓过”，历史 URL 有 20 亿条。用 `set` 存字符串，每条按 40 字符加对象开销算，粗估就要数百 GB 。
- 语料清洗要在几亿条文档/句子片段里去重（RAG 建库、SFT 数据准备）。
- 缓存前置判断：“这个 key 肯定不在缓存/数据库里” → 直接拒绝，避免缓存穿透把 DB 打穿。
- 权限与合规：判断“这个标识是否出现在敏感名单里”，命中后再走精确查询，未命中直接放行。
- LLM 网关：判断“这段 prompt 的哈希是否已经算过缓存”，把大量不命中请求挡在昂贵的向量检索之前。

`set` 的问题在于它必须存下**元素本身**（或至少一个强哈希值，如 32 字节的 SHA-256 摘要）。布隆过滤器（Bloom filter）的洞察是：**成员判断并不需要保留元素，只需要保留“它影响了哪些比特位”** 。代价是会有误判。

## 定义与三个必须记住的性质

布隆过滤器是一个长度 m 的位数组，配 k 个哈希函数，每个函数把元素映射到 [0, m) 的一个位置。

- **插入**：把 k 个位置的比特都置 1 。
- **查询**：k 个位置全为 1 才返回“可能存在”；只要有一个是 0 ，返回“肯定不存在”。

由此得到三条性质，它们是理解一切的起点：

1. **没有假阴性**：说“不存在”就一定不存在。
2. **有假阳性**：说“存在”可能是别的元素把这些位凑齐了。假阳性率记为 p 。
3. **不支持删除**：清掉某个元素的 k 个比特，会连带破坏共享这些比特的其他元素。

**关键直觉**：布隆过滤器是“概率型成员查询”，不是集合本身。它只能当**筛选层**（prefilter / negative cache），不能当**权威判据**——除非业务能容忍漏放。

## 参数怎么算

给定预计元素数 n 与目标假阳性率 p ：

- **位数组长度** m = -n · ln p / (ln 2)²
- **哈希函数个数** k = (m / n) · ln 2
- **实际假阳性率** p ≈ (1 - e^(-k·n/m))^k

几个可直接背下的数值：**每个元素约 9.6 bit 可达成 p = 1% ，约 14.4 bit 可达成 p = 0.1%** ，对应的最优 k 分别是 7 和 10 。也就是说，20 亿条 URL 在 1% 误判率下约需 2.4 GB 位数组，而同样的数据存成 Python `set` 需要数百 GB 。

```python
import math


def bloom_params(n: int, p: float) -> tuple[int, int]:
    """由元素规模 n 与目标假阳性率 p 推出 (m, k)"""
    m = math.ceil(-n * math.log(p) / (math.log(2) ** 2))
    k = max(1, round((m / n) * math.log(2)))
    return m, k


def expected_fpr(m: int, k: int, n: int) -> float:
    """已插入 n 个元素时的理论假阳性率"""
    return (1 - math.exp(-k * n / m)) ** k


m, k = bloom_params(10_000, 0.01)
print(m, k, round(expected_fpr(m, k, 10_000), 5))   # 95851 7 0.01004
print(round(m / 10_000 / 8, 2), "字节/元素")          # 约 1.2 字节
```

## Python 实现

工程上有两个绕不开的细节。第一，**绝对不要用内置 `hash()`** ：CPython 对 `str` / `bytes` 的哈希带进程随机盐（`PYTHONHASHSEED` ），换进程就变，持久化的位数组会全部失效。要用 `hashlib` 或 `zlib.crc32` 这类跨进程稳定的哈希。第二，k 个独立哈希不必真找 k 个函数：算两个强哈希后线性组合（Kirsch–Mitzenmacher 构造）在实践中与独立哈希几乎等价，且便宜得多。

```python
import hashlib
import math


class BloomFilter:
    """布隆过滤器：稳定哈希 + 双哈希派生，位数组用 bytearray"""

    def __init__(self, capacity: int, fpr: float = 0.01):
        if capacity <= 0 or not 0 < fpr < 1:
            raise ValueError("capacity 必须为正整数，fpr 必须在 (0, 1) 内")
        self.m = math.ceil(-capacity * math.log(fpr) / (math.log(2) ** 2))
        self.k = max(1, round((self.m / capacity) * math.log(2)))
        self._bytes = bytearray((self.m + 7) // 8)
        self.inserted = 0

    @staticmethod
    def _digest(item: bytes) -> tuple[int, int]:
        """blake2b 输出 16 字节，切成两个 64 位整数当 h1、h2"""
        d = hashlib.blake2b(item, digest_size=16).digest()
        h1 = int.from_bytes(d[:8], "little")
        h2 = int.from_bytes(d[8:], "little") | 1   # 强制奇数，避免派生位置退化
        return h1, h2

    def _positions(self, item: bytes):
        h1, h2 = self._digest(item)
        # 双哈希派生：g_i = h1 + i * h2 ，i = 0..k-1 ，再对 m 取模
        for i in range(self.k):
            yield (h1 + i * h2) % self.m

    def add(self, item: str | bytes) -> None:
        b = item.encode("utf-8") if isinstance(item, str) else item
        for pos in self._positions(b):
            self._bytes[pos >> 3] |= 1 << (pos & 7)   # 第几个字节 / 字节内第几位
        self.inserted += 1

    def __contains__(self, item: str | bytes) -> bool:
        b = item.encode("utf-8") if isinstance(item, str) else item
        for pos in self._positions(b):
            if not (self._bytes[pos >> 3] >> (pos & 7)) & 1:
                return False        # 有一位是 0 -> 一定不存在
        return True                 # 全为 1 -> 可能存在

    @property
    def fill_ratio(self) -> float:
        """已置位的比例。超过约 50% 就该考虑扩容或重建"""
        return sum(bin(x).count("1") for x in self._bytes) / self.m

    def maybe_add(self, item: str | bytes) -> bool:
        """不存在则加入；返回 True 表示“本次新加入”。流式去重的主力接口"""
        if item in self:
            return False
        self.add(item)
        return True

    def export(self) -> bytes:
        """导出位数组（不含元信息），可写盘或塞进 Redis"""
        return bytes(self._bytes)

    def load(self, data: bytes) -> None:
        if len(data) != len(self._bytes):
            raise ValueError("位数组长度不匹配")
        self._bytes = bytearray(data)


bf = BloomFilter(capacity=100_000, fpr=0.01)
for doc_id in ["a1", "b2", "c3", "d4"]:
    bf.add(doc_id)
print("a1" in bf, "zzz" in bf)                     # True False
print(bf.maybe_add("a1"))                          # False：已存在（或误判）
print(bf.m, bf.k, len(bf.export()))                # 位数组长度、哈希个数、字节数
```

### 实测误判率

理论值必须自己验一遍，尤其是数据分布偏斜时：

```python
# 以下示例沿用「Python 实现」一节的 BloomFilter 类（此处省略类定义）

bf = BloomFilter(capacity=10_000, fpr=0.01)
for i in range(10_000):
    bf.add(f"doc-{i}")
false_positive = sum(1 for i in range(100_000) if f"neg-{i}" in bf)
print(false_positive / 100_000, round(bf.fill_ratio, 3))
# 假阳性率约 0.01、置位比例约 0.50；插入量超过 capacity 后误判率会急剧上升
```

## 变体与对照

| 结构 | 支持删除 | 内存 | 特点 |
| ---- | -------- | ---- | ---- |
| 布隆过滤器 | 否 | 9.6 bit/元素 @1% | 最简单，位数组定长 |
| 计数布隆过滤器 | 是（引用计数） | 每格 4 bit 起 | 计数会溢出；被假阳性污染后删除会失准 |
| Cuckoo Filter | 是 | 与 Bloom 同级 | 双表 + 指纹，小 p 时更省 |
| Xor / Ribbon Filter | 否 | 比 Bloom 更省 | 静态构造、只读，不支持增量写入 |
| HyperLogLog | — | 十几 KB 估到十亿基数 | 不判成员，只估**不同元素个数** |
| 精确 `set` / Redis Set | 是 | 数百 bit/元素起 | 判据唯一可信，成本高 |

“支持删除”在真实系统里几乎必然引出计数布隆或 Cuckoo Filter，但也要清楚：**引用计数一旦被假阳性污染，删除就会失准**，因此生产上常常“只增不减 + 定期重建”，反而更稳。

## 应用一：语料与检索结果去重

RAG 建库与评测集准备里，去重常要跑几十亿条，全量精确集合存不下。此时“**热层精确 + 冷层布隆**”的两级结构最实用：

```python
# 沿用「Python 实现」一节的 BloomFilter 类
class TieredDeduper:
    """两层去重：热层用精确 set 保证近期零误判，冷层用布隆过滤器压内存"""

    def __init__(self, hot_capacity: int = 100_000, cold_capacity: int = 10_000_000,
                 fpr: float = 0.01):
        self.hot: set[str] = set()
        self.hot_limit = hot_capacity
        self.cold = BloomFilter(cold_capacity, fpr)

    def add_if_new(self, key: str) -> bool:
        """True 表示“判定为新元素并已登记”"""
        if key in self.hot:          # 精确命中，一定重复
            return False
        if key in self.cold:         # 布隆命中：以 fpr 的概率误判
            return False
        self.hot.add(key)
        if len(self.hot) >= self.hot_limit:      # 热层写满 -> 整体下沉到冷层
            for k in self.hot:
                self.cold.add(k)
            self.hot.clear()
        return True


dd = TieredDeduper(hot_capacity=2, cold_capacity=1_000, fpr=0.02)
docs = ["doc-a", "doc-b", "doc-a", "doc-c", "doc-b", "doc-d"]
print([d for d in docs if dd.add_if_new(d)])
# ['doc-a', 'doc-b', 'doc-c', 'doc-d']
```

两层结构的好处是：**最可能重复的近期数据判断是精确的**，历史数据只按 1% 级别的误判率占内存。若业务要求“冷层命中也必须确认”，就在 `key in self.cold` 之后再查一次持久化存储（数据库唯一索引、或对象存储里的清单），布隆过滤器只负责把绝大多数“肯定不重复”挡在前面。

小规模数据不必这么绕，直接用布隆过滤器就是最短路径（下例沿用上一小节的完整实现）：

```python
# 以下示例沿用「Python 实现」一节的 BloomFilter 类（此处省略类定义）

bf = BloomFilter(capacity=1_000, fpr=0.001)
docs = ["自然语言处理", "自然语言处理", "向量检索", "自然语言处理"]
print([d for d in docs if bf.maybe_add(d)])      # ['自然语言处理', '向量检索']
```

同一套写法适合“检索结果跨轮次去重”：每轮召回前把已经给模型看过的片段摘要塞进布隆过滤器，只有 `maybe_add` 返回 True 的才作为新候选，能显著降低“重复段落挤占上下文”的概率。**传给它的应当是内容哈希而不是原文**——既省掉超长字符串的编码开销，也让“同一片段”的判定口径统一。

## 应用二：缓存穿透防护

请求覆盖 100 万个可能的 key ，其中只有 5 万真实存在。直接落库会让绝大多数查询打在数据库上。做法是把全部真实 key 建成一个布隆过滤器，放在缓存之前：

```python
# 沿用「Python 实现」一节的 BloomFilter 类
def guarded_get(bf, cache: dict, db: dict, key: str):
    if key in cache:
        return cache[key]
    if key not in bf:            # 一定不存在，直接拒绝，不打 DB
        return None
    row = db.get(key)            # 可能存在 -> 只有这部分才落到 DB
    if row is not None:
        cache[key] = row
    return row


db = {f"k{i}": i for i in range(50)}
bf = BloomFilter(capacity=100, fpr=0.01)
for k in db:
    bf.add(k)
cache: dict = {}
hits = [guarded_get(bf, cache, db, f"k{i}") for i in range(200)]
print(sum(1 for h in hits if h is not None))   # 50，只有真实存在的 key 返回非空
print(len(cache))                              # 50，DB 只被打了 50 次
```

效果取决于真实数据分布：**未登记进过滤器的 key 全部被 O(1) 挡掉** ，数据库只承担“假阳性 + 真存在”这两部分流量。

## 常见坑

1. **容量必须预先估准**。位数组一旦建好就不能扩容（要重建并重放所有元素）。按 `n` 上限的 1.5~2 倍来建，或监控 `fill_ratio`（置位比例超过 50% 时假阳性会明显偏离理论值）。
2. **假阳性是特性，但后果由业务承担**：权限/合规场景必须“可能存在 → 再精确查”；纯缓存场景可以直接丢弃。
3. **不能用 `hash()` / `id()`** ：跨进程不稳定，持久化后全部失效。同理，`PYTHONHASHSEED=0` 只是关掉随机化，也别依赖它做一致性。
4. **删除要用计数变体，并警惕计数溢出**（4 bit 计数到 15 就不能再加）。
5. **哈希派生过于相关会让误判率飙升**：别用 `h1`、`h1+1`、`h1+2` 这种几乎相同的偏移；至少写成 `h1 + i*h2` 且让 h2 为奇数。
6. **低熵键要实测**：自增 ID、时间戳这类键，其位分布与真实流量并不一致，**用真实样本测一次误判率**，别只看公式。
7. **分布式下的选择**：RedisBloom 模块，或每个分片一份本地过滤器。置位本身幂等（OR 语义），所以共享位数组的并发写相对安全，但 `maybe_add` 这种“读后写”不是原子的，可能重复收录。
8. **别拿它做计数**：布隆过滤器无法回答“出现过几次”，那属于 Count-Min Sketch 的领域；也无法回答“有多少不同元素”，那是 HyperLogLog 。

## 延伸阅读

- Wikipedia《Bloom filter》（CC BY-SA 4.0）：定义、参数推导与变体谱系。
- Burton Howard Bloom,《Space/Time Trade-offs in Hash Coding with Allowable Errors》(1970)：一手论文，推导部分很短。
- 《哈希表》：精确成员判断的对照组，先理解 `dict` 的开销结构，才明白“拿误判换内存”值不值。
- 《Trie 前缀树（字典树）》：键集合高度共享前缀时，Trie 常常比布隆过滤器更省。
- 《并查集与等价类归并》：布隆过滤器回答“是否见过”，并查集回答“哪些属于同一类”，大规模语料清洗里两者常前后衔接。
- 《Python 算法工具箱：heapq、bisect、graphlib 与 collections》：`Counter` 与小规模去重惯用法。

---

> **来源**：抓取于 2026-09-19。定义、参数公式（m、k 与假阳性率推导）以及计数布隆 / Cuckoo / Xor-Ribbon / HyperLogLog 的变体对照参考自 [Wikipedia: Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter)（Wikimedia 社区，CC BY-SA 4.0），结论与 Burton Howard Bloom 1970 年原始论文一致；双哈希派生采用 Kirsch–Mitzenmacher 构造。本文全部 Python 代码为本站编写，仅使用标准库，已在 Python 3.12 下运行验证。
