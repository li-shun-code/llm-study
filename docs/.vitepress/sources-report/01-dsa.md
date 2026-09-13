# 模块 1 · 数据结构与算法（01-dsa）来源报告

抓取日期：2026-09-13。目标 ≥21 篇，实际完成 **21 篇**，全部通过 `node scripts/check-frontmatter.mjs docs/01-dsa`（PASS (21 articles)）。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [hello-algo](https://github.com/krahets/hello-algo)（krahets） | 18 篇主来源（复杂度/数组/链表/栈/队列/哈希/递归/树/遍历/BST/堆/图/遍历/排序/二分/回溯/DP/贪心） | CC BY-NC-SA 4.0 | 每篇 frontmatter `author: krahets` + 文首署名块，`source_url` 指向 raw 原文 |
| [OI Wiki](https://github.com/OI-wiki/OI-wiki) | 3 篇补源（拓扑排序、最短路径、双指针与滑动窗口） | CC BY-SA 4.0 | 每篇 frontmatter `author: OI Wiki 项目` + 文首署名块 |

## 抓取与改写说明

- hello-algo 原文为 mkdocs-material 语法，入库时做了等价转换：多语言代码页仅保留 Python 块；`!!!` 提示块转引用块；`??? pythontutor` 转可点击链接；`$...$` LaTeX 公式转 Unicode 可读文本（如 `O(n^2)` → `O(n²)`）；```src 仓库代码引用块删除（文首署名块已注明完整代码位置）；图片相对路径改写为 `raw.githubusercontent.com` 绝对 URL（共 117 处，已逐一验证 HTTP 200）。
- OI Wiki 原文代码为 C++（算法竞赛风格），已在相关文章文首注明；文中 mkdocs 代码片段引用（`--8<--`）以内联真实代码替换。

## hello-algo 内容缺口与替代（无失败 URL）

| 主题 | 原计划来源 | 缺口原因 | 替代方案 |
| --- | --- | --- | --- |
| 14 拓扑排序 | chapter_graph | hello-algo 图章节（graph / graph_operations / graph_traversal）无拓扑排序小节 | [OI Wiki graph/topo.md](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/topo.md)（Kahn + DFS，节选） |
| 15 最短路径 | chapter_graph | hello-algo 图章节无最短路径 / Dijkstra 小节 | [OI Wiki graph/shortest-path.md](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/graph/shortest-path.md)（定义 + Dijkstra 节选 + 方法对比） |
| 18 双指针与滑动窗口 | chapter_array_and_linkedlist / chapter_hash_table | hello-algo 无独立双指针 / 滑动窗口小节（仅散落提及） | [OI Wiki misc/two-pointer.md](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/misc/two-pointer.md)（含"维护区间信息"即滑动窗口） |

## 抓取过程记录

- GitHub contents API 枚举章节目录时两次因限流失败，已重试成功；实际目录名与计划略有差异：`chapter_complexity_analysis` → `chapter_computational_complexity`，`chapter_hash_table` → `chapter_hashing`。
- raw 下载共 41 个 hello-algo 文件 + 3 个 OI Wiki 文件 + 1 个 OI 代码片段；首轮 3 个文件网络瞬断失败，重试全部成功，无永久失败项。

## 2026-09-13 补缺追加（21 → 25 篇）

| 序号 | 主题 | 来源 | 许可 | 说明 |
| --- | --- | --- | --- | --- |
| 12（新增） | Trie 前缀树 | [OI Wiki docs/string/trie.md](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/string/trie.md) | CC BY-SA 4.0 | 完整转载（定义/引入/实现/应用全部小节，含 01-trie 维护异或和、全局加一、01-trie 合并及 P2580/BZOJ1954/P6018/P6623 四道例题与全部参考代码） |
| 13（新增） | LRU 缓存 | [doocs/leetcode 0146.LRU Cache README](https://raw.githubusercontent.com/doocs/leetcode/main/solution/0100-0199/0146.LRU%20Cache/README.md) + [Python 官方文档 functools.lru_cache](https://docs.python.org/zh-cn/3/library/functools.html#functools.lru_cache) | CC BY-SA 4.0（doocs）+ PSF 第 2 版（官方文档） | doocs 题解页完整转载（题目描述/示例/提示/方法一思考与讲解/Python3 实现），按本站惯例仅收录 Python3 代码页（其余 7 种语言实现见原仓库，已在文内注明）；另补充官方 `functools.lru_cache` 全节（含 get_pep、fib 两个官方示例），文内分别署名。doocs/leetcode 仓库许可证经 GitHub API 核实为 CC-BY-SA-4.0 |
| 18（新增） | 并查集 | [OI Wiki docs/ds/dsu.md](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/ds/dsu.md) | CC BY-SA 4.0 | 完整转载（引入/初始化/查询/路径压缩/合并/启发式合并/复杂度/带删除/带权/全部例题与习题/参考资料，含脚注；本篇原作者 HeRaNO、JuicyMio、Xeonacid、sailordiary、ouuan、Pig-Eat-Earth 已在文内署名） |
| 22（新增） | 前缀和与差分 | [OI Wiki docs/basic/prefix-sum.md](https://raw.githubusercontent.com/OI-wiki/OI-wiki/master/docs/basic/prefix-sum.md) | CC BY-SA 4.0 | 完整转载（一维/二维/多维前缀和、逐维前缀和、子集和 DP、树上前缀和、一维/二维差分、树上差分点差分/边差分、P3128 例题与全部习题列表） |

## 新增 4 篇的格式转换说明

- OI Wiki 原文为 mkdocs 语法：`=== "C++"` / `=== "Python"` 多语言代码页改为 **C++ / Python** 加粗标注（两种语言实现均完整保留）；`???+ note/example/warning/tip` 引用块改为正文加粗标注或引用块；`--8<--` 代码片段引用以内联真实代码替换（本次共内联 23 个片段文件：trie_1/2/3.cpp，dsu_0~6 的 .cpp/.py 共 14 个，prefix-sum_1~7 的 .cpp/.py 片段，锚点 `:core`/`:full-text` 按原文标记截取）；图片相对路径改写为 `raw.githubusercontent.com` 绝对 URL；站内相对链接（如 ./ac-automaton.md、../graph/lca.md）改写为 oi-wiki.org 绝对地址。
- LaTeX 公式按本站既有惯例转为 Unicode 可读文本（如 `$\oplus$` → ⊕、`$O(m\alpha(m,n))$` → O(mα(m,n))、多维前缀和公式转 S(i,j) 括号记法并已在文首注明）。
- doocs/leetcode 原文题目描述为 HTML 片段，已转为等价 Markdown；LaTeX 公式转 Unicode 文本。
- 重编号：原 12~21 号文章顺延为 14~25（Trie/LRU 插入 11 堆之后，并查集插入最短路径之后，前缀和插入双指针之后），均采用「先移出至临时目录再移回」的两段式重命名防止覆盖；frontmatter order、index.md 知识点清单、manifest 已全部同步。
