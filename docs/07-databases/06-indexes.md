---
title: 索引原理与使用
source_url: https://www.postgresql.org/docs/current/indexes-intro.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
versions: PostgreSQL 18 官方文档（第 11 章 11.1、11.2、11.12 节）
order: 6
group: SQL 与数据建模
---
## 索引为什么快

假设有这样一张表：

```sql
CREATE TABLE test1 (
    id integer,
    content varchar
);
```

应用频繁发出这类查询：

```sql
SELECT content FROM test1 WHERE id = constant;
```

没有任何准备时，系统只能**顺序扫描（Sequential Scan）**整张 test1 表、逐行寻找匹配项。如果表有很多行而查询只返回寥寥几行（甚至零或一行），这显然是低效的方法。但如果系统被指示在 `id` 列上维护一个**索引（Index）**，它就可以用更高效的方法定位匹配行——例如，只需沿着搜索树走几层。

这与大多数非虚构类图书的做法类似：读者常查的术语和概念被收进书末按字母排序的索引，读者可以快速翻查索引、直接跳到相应页码，而不必通读全书。正如作者要预判读者可能查什么，数据库程序员的任务就是预判哪些索引会有用。

在 `id` 列上创建索引：

```sql
CREATE INDEX test1_id_index ON test1 (id);
```

索引名 `test1_id_index` 可以随意起，但最好选一个日后能记起其用途的名字。删除索引用 `DROP INDEX` 命令；索引随时可以添加或移除。

## 索引的生命周期与代价

索引一旦创建，无需进一步干预：表被修改时系统会自动更新索引；当它认为用索引比顺序扫描更高效时，查询就会用上索引。但你需要定期运行 `ANALYZE` 命令更新统计信息，让查询规划器（Query Planner）做出明智决策。

索引不只是为 `SELECT` 服务：带搜索条件的 `UPDATE` 和 `DELETE` 同样受益；定义在连接条件所涉列上的索引还能显著加速 JOIN 查询。

一般而言，PostgreSQL 索引可用于优化包含如下形式 `WHERE` 或 `JOIN` 子句的查询：

```text
indexed-column indexable-operator comparison-value
```

其中被索引列是定义索引的列或表达式，可索引运算符是该索引针对该列的运算符类（Operator Class）中的成员，比较值则可以是任何非易变（Non-volatile）且不引用索引所在表的表达式。某些情况下规划器还能把别的写法转换成这种可索引形式——例如把 `comparison-value operator indexed-column` 翻转过来。

代价方面有两点要记住：

1. **在大表上建索引可能耗时很长。**默认情况下，建索引期间允许并行读（`SELECT`），但写操作（`INSERT`、`UPDATE`、`DELETE`）会被阻塞直到索引建完——生产环境往往不能接受。可以让写操作与建索引并行（`CREATE INDEX CONCURRENTLY`），但有几个注意事项。
2. **索引不是免费的。**创建后系统必须让索引与表保持同步，这给数据修改操作增加了开销；索引还可能阻碍 HOT（Heap-Only Tuples）优化。因此查询中很少用到或从未用到的索引应当删除。

## 索引类型

PostgreSQL 提供多种索引类型：B-tree、Hash、GiST、SP-GiST、GIN、BRIN，以及 bloom 扩展。每种类型使用不同算法，适合不同类型的可索引子句。默认的 `CREATE INDEX` 创建 B-tree 索引，它适配最常见的情况；其他类型用 `USING` 关键字指定，例如创建 Hash 索引：

```sql
CREATE INDEX name ON table USING HASH (column);
```

**B-tree**：可处理能排序数据上的等值与范围查询。被索引列参与 `<`、`<=`、`=`、`>=`、`>` 比较时，规划器都会考虑用 B-tree；等价的 `BETWEEN`、`IN` 也可以；索引列上的 `IS NULL` / `IS NOT NULL` 同样适用。若模式是锚定在字符串开头的常量，`LIKE` 与 `~` 也能用 B-tree（如 `col LIKE 'foo%'`、`col ~ '^foo'`，但 `col LIKE '%bar'` 不行）；非 C locale 下需用特殊运算符类才能支持模式匹配索引。`ILIKE`/`~*` 仅当模式以非字母字符开头时可用。B-tree 还能按排序顺序取回数据——不一定总比"扫描后排序"快，但常有帮助。

**Hash**：存储由被索引列的值导出的 32 位哈希码，因此只能处理简单等值比较（`=`）。

**GiST**：不是单一索引，而是可实现多种索引策略的基础设施，可用运算符取决于具体策略（运算符类）。标准发行版为若干二维几何类型提供 GiST 运算符类；GiST 还能优化"最近邻（Nearest-Neighbor）"搜索：

```sql
SELECT * FROM places ORDER BY location <-> point '(101,456)' LIMIT 10;
```

找出离目标点最近的十个地点（能否这样用同样取决于具体运算符类）。

**SP-GiST**：与 GiST 类似的基础设施，支持实现各种非平衡的磁盘数据结构，如四叉树、k-d 树、基数树（trie）；同样支持最近邻搜索。

**GIN**：倒排索引（Inverted Index），适合包含多个组成值的数据（如数组）：索引中每个组成值都有单独条目，能高效处理"是否包含某组成值"的查询。标准发行版为数组提供了 GIN 运算符类，支持 `<@`、`@>`、`=`、`&&` 运算。

**BRIN**：Block Range Index 的缩写，存储表中连续物理块区间内取值的摘要，因此对"取值与表行的物理顺序高度相关"的列最有效（典型如时间序列）；对有线性排序的数据类型，它记录每个块区间的最小/最大值，支持 `<`、`<=`、`=`、`>=`、`>` 查询。

> 站内提示：「RAG」的 RAG/向量检索会再遇到 GiST 家族的近亲——pgvector 为向量列提供 ivfflat 与 hnsw 索引，原理与"搜索树/近邻搜索"一脉相承。

## 检查索引使用

PostgreSQL 的索引不需要维护或调优，但检查真实查询负载到底用没用上索引仍然重要：对单条查询用 `EXPLAIN` 命令检查；也可以收集运行中服务器的整体索引使用统计。

很难给出"该建哪些索引"的通用流程，通常需要大量实验。原文给出几条经验：

- **先跑 `ANALYZE`。**它收集表中取值分布的统计信息，规划器据此估计查询返回的行数、为每个可能的查询计划赋予现实成本。没有统计信息时只能假设默认值，几乎必然不准——没跑过 `ANALYZE` 就去研究索引使用是徒劳的。
- **用真实数据做实验。**用测试数据得到的结论只对测试数据成立。极小的测试数据集尤其致命：从 100000 行选 1000 行可能值得建索引，从 100 行选 1 行几乎不值得——100 行多半塞进一个磁盘页，没有哪个计划能快过顺序读一个磁盘页。编造测试数据时要小心：取值非常相似、完全随机或按序插入的数据都会让统计偏离真实分布。
- **索引没被用时，测试阶段可以强制使用。**有一些运行时参数可关闭各类计划：比如关掉顺序扫描（`enable_seqscan`）和嵌套循环连接（`enable_nestloop`）这两个最基础的计划，会逼系统换用其他计划。如果这样它仍选顺序扫描，多半有更根本的原因——例如查询条件与索引不匹配。
- **强制后索引被用上了**，则有两种可能：要么系统本来是对的（用索引确实不合适），要么计划成本估计失真。应当对查询分别计时比较，`EXPLAIN ANALYZE` 在这里很有用。
- **如果确认成本估计有误**：总成本 = 各计划节点每行成本 × 选择性估计。成本常数可用运行时参数调整；选择性估计不准则是统计不足，可通过调整统计收集参数（`ALTER TABLE`）改善。都调不合适时，才考虑显式强制使用索引。

---

> **来源**：本文翻译自 [11.1. Introduction](https://www.postgresql.org/docs/current/indexes-intro.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。

---

> **补充来源**：本文"索引类型"与"检查索引使用"两节分别编译自同一文档的 [11.2. Index Types](https://www.postgresql.org/docs/current/indexes-types.html) 与 [11.12. Examining Index Usage](https://www.postgresql.org/docs/current/indexes-examine.html)，许可同上。
