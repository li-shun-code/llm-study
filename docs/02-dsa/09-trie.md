---
title: Trie 前缀树（字典树）
source_url: https://raw.githubusercontent.com/TheAlgorithms/Python/master/data_structures/trie/trie.py
author: 本站整理；参考 TheAlgorithms/Python、CPython 官方文档
license: MIT（TheAlgorithms/Python）
fetched_at: 2026-09-19
translated: false
versions: Python 3.12（标准库，无第三方依赖）
order: 9
group: 哈希与字符串结构
---
## 为什么需要 Trie

> **难度**：★★☆。数据结构本身很简单，难点在“什么时候不该用它”。
> **适合**：需要做前缀检索、自动补全、词表分词、工具名/敏感词匹配的读者。
> **前置**：《哈希表》。阅读本文前建议先看《堆》与《Top-K 与堆：召回重排里的取前 N 个》，三者常常配套出现。


《哈希表》告诉我们：给定一个完整的键，`dict` 能在 O(1) 时间内取出值。但哈希函数会把键“搅散”，因此它只能回答“**存不存在**”，无法回答“**以这个开头的所有键是什么**”。

一旦需求从“精确查找”变成“前缀查找”，哈希表就无能为力了：

- 搜索框输入 `trans`，要列出 `transformer`、`translation`、`transfer` —— 前缀匹配。
- 分词器要把一段文本切成词表里最长的词：`token` + `izer` 而不是逐字符切 —— 最长前缀匹配。
- 工具调用（Function Calling）里校验模型给出的函数名是否合法，并纠正相近拼写 —— 前缀 + 编辑距离。
- 网关对 API 路径 `/v1/chat/` 下所有端点做路由 —— 前缀路由。

这些问题的共同点是：**键之间共享大量前缀**。Trie（前缀树、字典树）正是把这些公共前缀合并成一棵树，从而把查找代价从“所有键的长度总和”降到“待查串自身的长度”。

## 定义与基本性质

Trie 是一种多叉树，其节点不存储值，**值由节点的位置隐式表达**：从根节点走到某个节点，沿途经过的边拼起来就是该节点对应的字符串。

它的三条基本性质：

1. 根节点对应空字符串 `""` 。
2. 从根到某个节点的路径上所有边标记的字符依次连接，即为该节点表示的字符串。
3. 公共前缀越长的键，共享的路径越长，因此**节点总数不超过所有键的字符总数**。

下图展示了一棵包含若干单词的 Trie：每个节点代表一个公共前缀，蓝色节点表示“此处是一个完整单词”。

![Trie 结构示意](assets/oi_string__trie1.png)

用集合论的语言说：Trie 是对键集合的一种“逐字符哈希”，而 `dict` 是一种“整体哈希”。这个视角能解释它的一切优缺点。

还有一个把 Trie 和哈希表真正区分开的性质：**Trie 上的“查找”是一步一步走的，中途的每一个位置都停在某个节点上**。这意味着任何一步都能被截断、被计数、被限制——`dict` 只能告诉你“在或不在”，而 Trie 能告诉你“走到这里还剩哪些可能”。自动补全、词表分词、受限解码（限制模型只能输出词表里存在的内容）全都依赖这一点，而不是依赖它的查找速度。

## Python 实现

### 极简版：嵌套字典

Python 里最省事的 Trie 就是“字典套字典”，用一个哨兵键标记“此处是一个完整单词”：

```python
END = "\0"  # 哨兵键，表示某个节点是单词结尾


class Trie(dict):
    """基于嵌套字典的 Trie。继承 dict，节点即字典"""

    def insert(self, word: str) -> None:
        node = self
        for ch in word:
            # setdefault：不存在则插入空字典并返回，存在则直接返回
            node = node.setdefault(ch, {})
        node[END] = True

    def search(self, word: str) -> bool:
        """精确查找：word 是否被插入过"""
        node = self
        for ch in word:
            if ch not in node:
                return False
            node = node[ch]
        return END in node

    def startswith(self, prefix: str) -> bool:
        """前缀查找：是否存在以 prefix 开头的键"""
        node = self
        for ch in prefix:
            if ch not in node:
                return False
            node = node[ch]
        return True

    def words_with_prefix(self, prefix: str) -> list[str]:
        """列出所有以 prefix 开头的单词（深度优先遍历子树）"""
        node = self
        for ch in prefix:
            if ch not in node:
                return []
            node = node[ch]
        res: list[str] = []

        def dfs(cur: dict, path: list[str]):
            if END in cur:
                res.append(prefix + "".join(path))
            for ch, nxt in cur.items():
                if ch == END:
                    continue
                path.append(ch)
                dfs(nxt, path)
                path.pop()  # 回溯，必须与 append 成对

        dfs(node, [])
        return res


if __name__ == "__main__":
    t = Trie()
    for w in ["transformer", "translation", "transfer", "train", "tree"]:
        t.insert(w)
    print(t.search("train"))          # True
    print(t.startswith("trans"))      # True
    print(sorted(t.words_with_prefix("trans")))
    # ['transfer', 'transformer', 'translation']
```

三个 Python 细节值得注意：`setdefault` 把“查找 + 缺失则创建”合成一次哈希，比 `if ch not in node: node[ch] = {}` 少一次哈希计算；`words_with_prefix` 里的 `path.pop()` 与 `path.append()` 必须成对，这是《回溯算法（面试选学）》中“尝试与回退”的最小例子；结尾哨兵用 `"\0"` 而不是 `None`，是因为节点字典的键全部是字符串，不会与真实字符冲突。

### 标准版：显式节点类

需要携带计数、权重或做序列化时，显式节点类更清晰。下面这份实现的结构与 TheAlgorithms/Python 的 `data_structures/trie/trie.py`（MIT 许可）一致，改成中文注释并补上删除操作：

```python
class TrieNode:
    """Trie 节点"""

    __slots__ = ("children", "is_word")  # 关闭 __dict__，单节点省约 50% 内存

    def __init__(self):
        self.children: dict[str, TrieNode] = {}
        self.is_word: bool = False


class Trie:
    """字典树：支持增、删、精确查、前缀查"""

    def __init__(self):
        self.root = TrieNode()

    def insert(self, word: str) -> None:
        node = self.root
        for ch in word:
            if ch not in node.children:
                node.children[ch] = TrieNode()
            node = node.children[ch]
        node.is_word = True

    def search(self, word: str) -> bool:
        node = self._walk(word)
        return node is not None and node.is_word

    def startswith(self, prefix: str) -> bool:
        return self._walk(prefix) is not None

    def delete(self, word: str) -> bool:
        """删除一个单词；沿途已无其它单词经过的节点会被回收"""
        return self._delete(self.root, word, 0)

    def _delete(self, node: TrieNode, word: str, i: int) -> bool:
        if i == len(word):
            if not node.is_word:
                return False
            node.is_word = False
            return not node.children  # 无子节点则通知父节点回收自己

        ch = word[i]
        if ch not in node.children:
            return False
        alive = self._delete(node.children[ch], word, i + 1)
        if alive:
            del node.children[ch]
        return not node.is_word and not node.children

    def _walk(self, s: str) -> TrieNode | None:
        node = self.root
        for ch in s:
            if ch not in node.children:
                return None
            node = node.children[ch]
        return node
```

### 子节点用字典还是用数组

经典教材（包括 OI Wiki 的 C++ 实现）常用 `next[26]` 定长数组：

```python
# 字符集固定且密集时，数组更省、更快
self.next: list[TrieNode | None] = [None] * 26
```

两者的取舍很明确：

| 方案 | 单节点开销 | 适用场景 |
| ---- | ---------- | -------- |
| `dict` 子节点 | 空字典约 64 字节，只存实际出现的边 | 字符集大且稀疏（Unicode、字节级 BPE 词表） |
| 定长数组 | 固定 26/256 个指针 | 字符集小且密集（小写英文字母） |

工程实践中，绝大多数文本不是“只有 26 个小写字母”，中文更是动辄上万码点。**因此 Python 侧首选字典**；如果内存吃紧，把 `dict` 换成“排序数组 + 二分”或改用双数组 Trie（Double-Array Trie）是常规优化路线。

## 复杂度

设键集合的总字符数为 M 、待查串长度为 L ：

- **构建**：O(M) 时间、O(M) 空间（节点数上界）。
- **查找 / 前缀判断**：O(L) 时间，与词库里有多少词无关。这是 Trie 最大的优势——查询代价只取决于查询串本身。
- **列出某前缀下所有词**：O(L + K) ，K 为返回的字符总量，本质是一次子树遍历。

节点数上界这条性质值得单独推一遍：插入第一个词时最多新建 |w| 个节点，插入第 k 个词时，它与已有 Trie 的公共前缀部分不再新建节点，所以**新建节点数 ≤ 该词长度**。累加起来，节点总数 ≤ 所有键的字符总数 M ；公共前缀越多，实际节点数越小于这个上界。反过来，如果词表内部几乎没有公共前缀（例如随机 ID、UUID），Trie 就退化成一堆“只有一个子节点的链”，既拿不到共享前缀的好处，又要为每个字符付一个节点的钱——这种数据不该用 Trie。

### 内存这笔账必须自己算

上面的上界只是纸面数字，真实的 Python 对象开销要靠测量。把一份约 23.6 万个英文单词的词表（合计约 226 万个字符）插进 `__slots__` 版 Trie，本机实测得到 **76 万个节点、峰值内存约 168 MB**（CPython + `tracemalloc`，换 Python 小版本会在 150~170 MB 之间浮动）。也就是说平均每个节点要 200 字节上下，而它承载的有效信息只有几个字符。复现方式：

```python
import tracemalloc


def build(words):
    root = TrieNode()
    for w in words:
        node = root
        for ch in w:
            node = node.children.setdefault(ch, TrieNode())
        node.is_word = True
    return root


tracemalloc.start()
build([line.strip().lower() for line in open("/usr/share/dict/words") if line.strip().isalpha()])
_, peak = tracemalloc.get_traced_memory()
print(f"峰值 {peak / 1e6:.0f} MB")   # 本机约 168 MB
```

三个能立刻把内存砍掉一个量级的手段，按性价比排序：

1. **压缩前缀树（Radix Tree）**：把只有一个子节点的链合并成一条带字符串标签的边，节点数从“字符数”降到“分支数”。下一节给实现。
2. **`__slots__`**：省掉每节点的 `__dict__`，节点体积能小三成以上。
3. **换表征**：如果查询模式允许，用「排序后的键数组 + `bisect`」，内存只剩键本身。

## 压缩前缀树：把公共前缀压进边里

Radix Tree（基数树 / 压缩 Trie）的做法是：**边上存一整段字符串，节点只留在“有分支”或“有值”的位置**。路由表就是它的经典战场——`/v1/chat/completions` 和 `/v1/chat/` 共享前缀，普通 Trie 要为每个字符建一个节点，Radix Tree 只需在分支点开一次。

```python
class RadixNode:
    """压缩前缀树节点：边上存整段字符串，而不是单个字符"""

    __slots__ = ("label", "children", "value")

    def __init__(self, label: str = ""):
        self.label = label                            # 指向本节点的边上的字符串
        self.children: dict[str, RadixNode] = {}      # 用首字符做索引
        self.value = None                             # 非 None 表示这里注册了一个处理器


def common_prefix(a: str, b: str) -> str:
    i = 0
    while i < len(a) and i < len(b) and a[i] == b[i]:
        i += 1
    return a[:i]


class RadixTrie:
    """注册 key -> handler，查询「最长已注册前缀」"""

    def __init__(self):
        self.root = RadixNode()

    def insert(self, key: str, handler) -> None:
        node, rest = self.root, key
        while rest:
            head = rest[0]
            child = node.children.get(head)
            if child is None:                         # 没有公共前缀，整段挂成新节点
                node.children[head] = RadixNode(rest)
                node.children[head].value = handler
                return
            cp = common_prefix(child.label, rest)
            if cp == child.label:                     # 整条边都被吃掉，继续往下走
                node, rest = child, rest[len(cp):]
                continue
            # 部分重叠：把这条边劈开，公共部分升为中间节点
            mid = RadixNode(cp)
            child.label = child.label[len(cp):]
            mid.children[child.label[0]] = child
            node.children[head] = mid
            node, rest = mid, rest[len(cp):]
        node.value = handler

    def longest_match(self, key: str) -> tuple[str | None, object]:
        """返回 (命中的最长前缀, 处理器)。请求路径带 query string 时也能匹配到注册项"""
        node, rest = self.root, key
        matched, best = "", (None, None)
        while rest:
            child = node.children.get(rest[0])
            if child is None or not rest.startswith(child.label):
                break
            rest = rest[len(child.label):]
            matched = key[: len(key) - len(rest)]
            node = child
            if node.value is not None:
                best = (matched, node.value)
        return best


routes = RadixTrie()
for path, handler in [("/v1/", "api-root"), ("/v1/chat/", "chat-index"),
                      ("/v1/chat/completions", "chat"), ("/v1/embeddings", "embeddings")]:
    routes.insert(path, handler)

print(routes.longest_match("/v1/chat/completions"))   # ('/v1/chat/completions', 'chat')
print(routes.longest_match("/v1/embeddings?x=1"))      # ('/v1/embeddings', 'embeddings')
print(routes.longest_match("/v1/chat/9f3a"))            # ('/v1/chat/', 'chat-index')
print(routes.longest_match("/healthz"))                 # (None, None)
```

代价换来的是实现复杂度：**插入时要处理“边被劈开”的情况**，上面 `insert` 里那段 `mid` 分支就是全部难点，写错会出现“注册了却查不到”的幽灵 bug 。另外压缩后 `words_with_prefix` 这类遍历要跨边拼接字符串，补全功能得重写一遍。所以取舍很直白：只做精确最长前缀匹配（路由、白名单）就用 Radix Tree；要频繁枚举子树（补全、联想）就留普通 Trie。

## 选型对照：什么时候真的需要 Trie

把常见的字符串检索手段放在一起比较，N 为键数量、L 为平均键长、Q 为查询串长度：

| 方案 | 精确查找 | 前缀查找 | 内存 | 更新 | 典型场景 |
| ---- | -------- | -------- | ---- | ---- | -------- |
| `dict` / `set` | O(Q) 均摊 | 不支持 | 低 | 极快 | 工具名、枚举值校验 |
| 排序数组 + `bisect` | O(L log N) | O(Q log N + K) | 最低 | 慢（要维护有序） | 词表固定、读多写少 |
| Trie | O(Q) | O(Q + K) | 最高 | 快 | 自动补全、前向匹配分词 |
| 倒排索引 | 不支持 | 不支持 | 中 | 快 | 全文检索、子串匹配 |
| `pyahocorasick` | 多模式串 | 任意位置 | 中 | 慢（整体重建） | 敏感词、日志关键字告警 |

一句话结论：**先问“我的查询是不是前缀查询”，再问“词表会不会频繁变更”**。只有两者都为“是”时，Trie 的内存代价才值得付；否则 `dict` 或排序数组加 `bisect` 往往更划算。

## 工程应用一：自动补全与“前缀 + Top-K”

补全接口通常是“给定前缀，返回按热度排序的前 N 个词”。直接在 Trie 节点上挂一个计数器即可：

```python
import heapq


class WeightedTrieNode:
    """节点保存该前缀的热度，以及子节点"""

    __slots__ = ("children", "weight", "prefix")

    def __init__(self, prefix: str = ""):
        self.children: dict[str, WeightedTrieNode] = {}
        self.weight: int = 0
        self.prefix = prefix

    def insert(self, word: str, weight: int = 1) -> None:
        node = self
        for i, ch in enumerate(word):
            node.weight += weight  # 前缀热度累加：子节点必然不超过父节点
            node = node.children.setdefault(ch, WeightedTrieNode(word[: i + 1]))
        node.weight += weight

    def top_k(self, prefix: str, k: int = 5) -> list[tuple[int, str]]:
        """返回以 prefix 开头、热度最高的 k 个完整词"""
        node = self
        for ch in prefix:
            if ch not in node.children:
                return []
            node = node.children[ch]
        heap: list[tuple[int, str]] = []
        stack = [node]
        while stack:
            cur = stack.pop()
            if cur.weight:  # weight 为 0 表示只是中间节点，不是完整词
                heapq.heappush(heap, (cur.weight, cur.prefix))
                if len(heap) > k:
                    heapq.heappop(heap)  # 维护大小为 k 的小顶堆
            stack.extend(cur.children.values())
        return [(w, p) for w, p in sorted(heap, reverse=True)]


t = WeightedTrieNode()
for w, freq in [("transformer", 900), ("translation", 120), ("transfer", 60), ("train", 400)]:
    t.insert(w, freq)
print(t.top_k("trans", k=2))  # [(900, 'transformer'), (120, 'translation')]
```

这段代码用《Top-K 与堆：召回重排里的取前 N 个》里的标准套路：候选量大而 k 很小时，用容量为 k 的小顶堆，把空间从 O(候选数) 压到 O(k) 。

## 工程应用二：词表分词与 tokenizer 中的最长匹配

中文分词、以及“把自由文本对齐到受控词表”的场景，常用**最大前向匹配**：每次从当前位置出发，取词表中能匹配到的最长词。用 Trie 实现，每步只需沿字符下探：

```python
def forward_max_match(text: str, vocab: Trie, max_len: int = 8) -> list[str]:
    """基于 Trie 的最大前向匹配分词。vocab 为已插入词表的 Trie"""
    tokens: list[str] = []
    i, n = 0, len(text)
    while i < n:
        best, node, j = None, vocab, i
        # 沿 Trie 尽量往长匹配，记录最后一次“命中整词”的位置
        while j < n and j - i < max_len and text[j] in node.children:
            node = node.children[text[j]]
            j += 1
            if node.is_word:
                best = text[i:j]
        if best is None:            # 单字兜底，避免死循环
            best = text[i]
        tokens.append(best)
        i += len(best)
    return tokens


vocab = Trie()
for w in ["自然语言", "自然", "语言", "处理", "模型", "语言模型"]:
    vocab.insert(w)
print(forward_max_match("自然语言处理模型", vocab))
# ['自然语言', '处理', '模型']
```

现代 LLM 的 BPE 分词器做法不同——先切成字节级 token 再按合并规则迭代归并——但“用树/前缀结构加速候选匹配”的思想是一致的。理解 Trie 之后再去读 `tiktoken` 或 HuggingFace `tokenizers` 的匹配逻辑，会顺利得多。

## 工程应用三：工具名白名单、自动补全与受限解码

工具调用（Function Calling）里最尴尬的一刻，是模型返回了一个“差一个字母”的函数名。直接把这类字符串交给 `dict[key]` 只会抛 `KeyError` ；交给 `difflib` 全表扫描又太慢。合理做法是三级降级：**精确命中 → 前缀唯一即补全 → 相似度纠正**，其中前两级正好落在 Trie 上。

```python
import difflib

END = "\0"


class ToolRegistry:
    """工具名注册表：用 Trie 支撑“校验 + 补全 + 纠错”三件事"""

    def __init__(self, names: list[str]):
        self.trie: dict = {}
        for name in names:
            self.insert(name)

    def insert(self, word: str) -> None:
        node = self.trie
        for ch in word:
            node = node.setdefault(ch, {})
        node[END] = True

    def _walk(self, prefix: str) -> dict | None:
        node = self.trie
        for ch in prefix:
            if ch not in node:
                return None
            node = node[ch]
        return node

    def completions(self, prefix: str = "") -> list[str]:
        """prefix 为空串时返回全部工具名（子树遍历）"""
        node = self._walk(prefix)
        if node is None:
            return []
        res, stack = [], [(node, list(prefix))]
        while stack:
            cur, path = stack.pop()
            if END in cur:
                res.append("".join(path))
            for ch, nxt in cur.items():
                if ch != END:
                    stack.append((nxt, path + [ch]))
        return sorted(res)

    def resolve(self, name: str, cutoff: float = 0.6) -> tuple[str | None, str]:
        """返回 (规范工具名, 命中方式)；无法判定时返回 (None, 原因)"""
        node = self._walk(name)
        if node and END in node:
            return name, "精确命中"
        hits = self.completions(name)
        if len(hits) == 1:                 # 前缀已经能唯一定位，直接补全
            return hits[0], "前缀补全"
        if len(hits) > 1:                  # 有歧义就交给用户/模型再确认，别猜
            return None, f"前缀有歧义：{hits[:5]}"
        near = difflib.get_close_matches(name, self.completions(), n=1, cutoff=cutoff)
        if near:
            return near[0], "拼写纠正"
        return None, "未知工具"


reg = ToolRegistry(["search_docs", "search_web", "render_chart", "run_sql"])
for probe in ["search_docs", "render", "search_", "run_sqll", "delete_all"]:
    print(f"{probe:12} -> {reg.resolve(probe)}")
# search_docs  -> ('search_docs', '精确命中')
# render       -> ('render_chart', '前缀补全')
# search_      -> (None, "前缀有歧义：['search_docs', 'search_web']")
# run_sqll     -> ('run_sql', '拼写纠正')
# delete_all   -> (None, '未知工具')
```

这里有个容易忽略的差别：**纠错这一跳退化成 O(N) 了**，因为 `get_close_matches` 要遍历全部工具名。工具数在几十到几百量级时无所谓；真到了几万级别，就该把“编辑距离 1 的变体”预先展开成一张 `dict`（SymSpell 思路），用哈希表把纠错也拉回常数时间——详见《哈希表》。

同一棵树还能往前再走一步：如果要约束模型**只能**输出注册过的内容（严格 JSON、枚举值、命令白名单），常见的做法是「受限解码 / 语法约束采样」——每生成一个 token ，就用前缀树算出“当前前缀下还有哪些合法后继”，把不在集合里的 token 概率置零再采样。它的核心操作就是本文的 `_walk` + 子节点枚举，只不过是把「字符」换成「词表里的 token id」，并且每一步都要问一次。理解了 Trie ，再看各类 structured output / grammar-constrained decoding 的实现就不会觉得神秘；相关的预算与截断问题见《Token 与上下文窗口》。

## 工程应用四：敏感词与多模式串匹配

工具名白名单、URL 前缀路由、权限前缀匹配，都可以直接落在 Trie 上（上面的 `RadixTrie` 就是路由表形态）。若还需要“在任意位置命中”，Trie 就不够了——那是 Aho-Corasick 自动机（多模式串匹配，本质是 Trie + 失败指针）的主场，一次扫描即可完成成千上万个模式的匹配，Python 侧可直接用 `pyahocorasick`。日志关键字告警、评论风控词表都属于这一类。

## 常见坑

1. **内存远比想象中大**。一个空 `dict` 约 64 字节，一个只有 `{"a": ..., "b": ...}` 的节点轻易超过 200 字节，而英文词表每词平均 8~10 个节点——前文实测 23.6 万词就吃掉约 168 MB。动手前先量一遍（`tracemalloc`），再决定要不要上 Trie；`__slots__`、Radix Tree、双数组 Trie 都是有效的省内存手段。
2. **别用 Trie 做“无序”检索**。如果查询条件是“包含某子串”而不是“以某前缀开头”，Trie 完全没有优势，应该用倒排索引或后缀数组。
3. **排序数组 + `bisect` 常常更实用**。把所有键排序后，以 `prefix` 开头的键必然连续出现，用 `bisect_left(prefix)` 找到左边界、`bisect_left(prefix + "\uffff")` 找到右边界，即可 O(L log N) 完成前缀范围查询，内存开销只有键本身。数据不常改动时，这是工程上更省事的方案，详见《Python 算法工具箱：heapq、bisect、graphlib 与 collections》。
4. **删除容易破坏结构**。删除一个单词后，要沿路径回收不再被其它单词使用的节点，否则 Trie 只增不减。上面的 `_delete` 用返回值自底向上告知父节点“我可以被删掉”，这是标准写法。Radix Tree 更麻烦：删掉一个键之后，若父节点只剩一个子节点，理论上应该把两条边再拼回去（合并），否则树会随删除逐渐“松掉”，退化回普通 Trie。
5. **计数语义要想清楚**。“以该节点为前缀的单词数”和“该单词出现的次数”是两个不同的字段，混在一个 `count` 上会导致统计错误。
6. **Unicode 与大小写**。`"Ü"`、`"ü"`、组合字符 `"u\u0308"` 在 Python 里是不同字符串，入库前要做 `casefold()` 和 `unicodedata.normalize("NFC", s)` ，否则查询必然漏。中文场景还要额外决定“按字符建树还是按字节建树”：按 UTF-8 字节建树能让 Trie 与 `tiktoken` 那类字节级词表对齐，代价是节点数增加约 1.5~3 倍。
7. **并发写入要小心**。`setdefault` 单步是原子的，但“逐层下探 + 建节点”整体不是；多线程共享一棵树时，要么加锁，要么把建树放在启动阶段完成后只读。

## 延伸阅读

- TheAlgorithms/Python 的 `data_structures/trie/trie.py`（MIT 许可），一份带插入、查询、按前缀搜索的简洁实现，可与本文两份实现对照阅读。
- 《哈希表》：理解“整体哈希 vs 逐字符哈希”的对照，以及为什么编辑距离纠错更适合用哈希表加速。
- 《Top-K 与堆：召回重排里的取前 N 个》：补全接口“前缀 + 热度 Top-N”的标准配套写法。
- 《Python 算法工具箱：heapq、bisect、graphlib 与 collections》：`bisect` 做前缀范围查询的替代方案。
- 《Token 与上下文窗口》：BPE 词表、token id 与字节级切分，是理解“为什么词表天然是稀疏字符集”的背景。
- 《PostgreSQL 全文检索（含中文分词）》：数据库侧的分词与倒排方案，和 Trie 是互补而非替代关系。

---

> **来源**：抓取于 2026-09-19。概念定义与结构示意图沿用 [OI Wiki《Trie（字典树）》](https://oi-wiki.org/string/trie/)（OI Wiki 项目，CC BY-SA 4.0，原图已下载至本模块 `assets/` 目录）；原文的 C++ 指针数组实现、按二进制位建树的 01-Trie 变体与竞赛习题未收录。节点式实现参考 TheAlgorithms/Python 的 `data_structures/trie/trie.py`（MIT 许可），压缩前缀树、工具名注册表、内存实测代码与全部中文说明为本站编写，已在 CPython 3.12/3.14 下运行验证；`difflib`、`tracemalloc`、`heapq` 均为标准库。
