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
