---
title: SQL 查询实战：聚合、JOIN 与索引
source_url: https://www.postgresql.org/docs/current/tutorial-agg.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-19
translated: true
versions: PostgreSQL 18 官方教程（第 2 章 2.6、2.7 节）与官方文档第 11 章（11.1、11.2、11.12 节）
order: 5
group: SQL 与数据建模
---
聚合、JOIN、索引是三篇独立的文章，但真实的一条 SQL 走的是同一条路：**先靠 JOIN 把行凑齐，再用聚合把行数压成几个数字，而它到底跑 3 毫秒还是 3 秒，取决于有没有合适的索引**。本站把三者合成一篇，就是为了让它们在同一个查询上一起出现——前面《SELECT 与增删改查（CRUD）》打了语法基础，这一篇开始"查得动、查得准"。

本篇统一使用「E-R 建模与范式：以"会话-消息"表设计为例」里的 LLM 应用表，并补一张调用日志表：

```sql
CREATE TABLE llm_calls (
    id            bigserial PRIMARY KEY,
    conversation_id bigint REFERENCES conversations(id),
    model         text        NOT NULL,
    input_tokens  int         NOT NULL,
    output_tokens int         NOT NULL,
    latency_ms    int         NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX llm_calls_created_at_idx ON llm_calls (created_at);
CREATE INDEX llm_calls_model_idx      ON llm_calls (model);
```

## 一、聚合与分组：GROUP BY、HAVING 与聚合函数

与其他关系数据库产品一样，PostgreSQL 支持**聚合函数（Aggregate Function）**：它从多个输入行计算出一个结果。常见的聚合函数有 `count`（计数）、`sum`（求和）、`avg`（平均值）、`max`（最大值）、`min`（最小值）。

例如，查询所有地点的最低气温读数中的最大值：

```sql
SELECT max(temp_lo) FROM weather;
```

```text
 max
-----
  46
(1 row)
```

如果想知道这个读数发生在哪个城市，可能会写出：

```sql
SELECT city FROM weather
    WHERE temp_lo = max(temp_lo);     -- 错误
```

但这行不通：聚合函数 `max` 不能用在 `WHERE` 子句里。限制的原因是——`WHERE` 决定哪些行参与聚合计算，所以它必然要在聚合函数计算**之前**求值。不过（就像 SQL 里常发生的那样）换一种写法即可达到目的，这里用**子查询（Subquery）**：

```sql
SELECT city FROM weather
    WHERE temp_lo = (SELECT max(temp_lo) FROM weather);
```

```text
     city
---------------
 San Francisco
(1 row)
```

这是可行的，因为子查询是独立的计算，它的聚合与外层查询各自分开进行。

### GROUP BY 分组聚合

聚合函数与 `GROUP BY` 子句结合时尤其有用。例如，取每个城市的读数条数与最低气温最大值：

```sql
SELECT city, count(*), max(temp_lo)
    FROM weather
    GROUP BY city;
```

```text
     city      | count | max
---------------+-------+-----
 Hayward       |     1 |  37
 San Francisco |     2 |  46
(2 rows)
```

每个城市输出一行，每个聚合结果都只对该城市匹配的表行计算。

### HAVING 过滤分组结果

可以再用 `HAVING` 过滤这些分组后的行：

```sql
SELECT city, count(*), max(temp_lo)
    FROM weather
    GROUP BY city
    HAVING max(temp_lo) < 40;
```

```text
  city   | count | max
---------+-------+-----
 Hayward |     1 |  37
(1 row)
```

只保留了所有 `temp_lo` 值低于 40 的城市。最后，若只关心名字以 `S` 开头的城市：

```sql
SELECT city, count(*), max(temp_lo)
    FROM weather
    WHERE city LIKE 'S%'            -- (1)
    GROUP BY city;
```

```text
     city      | count | max
---------------+-------+-----
 San Francisco |     2 |  46
(1 row)
```

（注 1：`LIKE` 运算符做模式匹配，详见 PostgreSQL 文档 9.7 节 Pattern Matching。）

### WHERE 与 HAVING 的本质区别

理解聚合与 `WHERE`/`HAVING` 的交互非常重要。根本区别在于：

- `WHERE` 在分组和聚合计算**之前**选取输入行——它控制哪些行进入聚合计算；
- `HAVING` 在分组和聚合计算**之后**选取组行。

因此 `WHERE` 子句不能包含聚合函数——用聚合去决定"哪些行作为聚合的输入"是没有意义的；而 `HAVING` 子句总是包含聚合函数。（严格来说，`HAVING` 里也可以不写聚合，但很少有用武之地——同样的条件放在 `WHERE` 阶段更高效。）

在上面的例子中，城市名限制放进了 `WHERE`，因为它不需要聚合。这比放进 `HAVING` 更高效：不满足 `WHERE` 检查的行根本不会参与分组与聚合计算。

### FILTER：按聚合分别过滤输入

另一种控制进入聚合计算的行的方式是 `FILTER`，它是每个聚合函数自己的选项：

```sql
SELECT city, count(*) FILTER (WHERE temp_lo < 45), max(temp_lo)
    FROM weather
    GROUP BY city;
```

```text
     city      | count | max
---------------+-------+-----
 Hayward       |     1 |  37
 San Francisco |     1 |  46
(2 rows)
```

`FILTER` 与 `WHERE` 很像，但它只从**它所修饰的那个聚合函数**的输入中剔除行。上例中 `count` 只统计 `temp_lo` 低于 45 的行，而 `max` 仍作用于所有行，所以依然找到了 46 这个读数。

> 站内提示：在 LLM 应用里，聚合最典型的场景是运营统计——比如按天统计 token 消耗（`sum(total_tokens)`）、按模型统计调用量与平均延迟（`count(*)`、`avg(latency_ms)` 配合 `GROUP BY model`），再配合 `HAVING` 筛出异常高耗的会话。

## 二、JOIN 多表查询

到目前为止，我们的查询一次只访问一张表。查询也可以同时访问多张表，或者以同时处理同一张表多行的方式访问它。这类同时访问多张表（或同一张表的多个实例）的查询称为**连接（Join）查询**：它把一张表的行与另一张表的行组合起来，用一个表达式指定哪些行相互配对。

例如，要返回所有天气记录及其所属城市的地理位置，数据库需要把 weather 表每行的 `city` 列与 cities 表所有行的 `name` 列做比较，选出取值配对的行（原文脚注：这只是概念模型——数据库实际执行连接的方式通常比逐对比较高效得多，只是对用户不可见）：

```sql
SELECT * FROM weather JOIN cities ON city = name;
```

```text
     city      | temp_lo | temp_hi | prcp |    date    |     name      | location
---------------+---------+---------+------+------------+---------------+-----------
 San Francisco |      46 |      50 | 0.25 | 1994-11-27 | San Francisco | (-194,53)
 San Francisco |      43 |      57 |    0 | 1994-11-29 | San Francisco | (-194,53)
(2 rows)
```

对结果集注意两点：

- Hayward 没有出现在结果里：cities 表中没有它的匹配项，连接会忽略 weather 表中未匹配的行。下文会讲怎么把它们找回来。
- 城市名出现了两列：这是正确的，因为两张表的列被拼接在一起。实践中这不受欢迎，所以最好显式列出输出列而不是用 `*`：

```sql
SELECT city, temp_lo, temp_hi, prcp, date, location
    FROM weather JOIN cities ON city = name;
```

由于各列名字互不相同，解析器自动找到了它们属于哪张表。如果两张表存在重名列，就必须**限定（Qualify）**列名来说明你指的是哪一个：

```sql
SELECT weather.city, weather.temp_lo, weather.temp_hi,
       weather.prcp, weather.date, cities.location
    FROM weather JOIN cities ON weather.city = cities.name;
```

连接查询中给所有列名加限定被普遍认为是好风格——日后某张表新增重名列时查询也不会失效。

### 隐式写法与显式写法

上面这种连接查询还有另一种写法：

```sql
SELECT *
    FROM weather, cities
    WHERE city = name;
```

这种语法比 `JOIN`/`ON` 更早，`JOIN`/`ON` 是 SQL-92 标准引入的：表直接列在 `FROM` 子句中，比较表达式放进 `WHERE` 子句。两种写法结果完全相同，但显式语法对读者更友好——连接条件由专门的关键字引出，而不是混在 `WHERE` 的其他条件里。

### 外连接（OUTER JOIN）

现在把 Hayward 的记录找回来。我们想要的语义是：扫描 weather 表，为每行找出匹配的 cities 行；找不到匹配时，用"空值"代替 cities 表的列。这种查询称为**外连接（Outer Join）**（此前见到的都是**内连接（Inner Join）**）：

```sql
SELECT *
    FROM weather LEFT OUTER JOIN cities ON weather.city = cities.name;
```

```text
     city      | temp_lo | temp_hi | prcp |    date    |     name      | location
---------------+---------+---------+------+------------+---------------+-----------
 Hayward       |      37 |      54 |      | 1994-11-29 |               |
 San Francisco |      46 |      50 | 0.25 | 1994-11-27 | San Francisco | (-194,53)
 San Francisco |      43 |      57 |    0 | 1994-11-29 | San Francisco | (-194,53)
(3 rows)
```

它叫**左外连接（Left Outer Join）**：连接运算符左表的每一行都至少在输出中出现一次，而右表只有能匹配左表某些行的行才会输出；输出没有匹配的左表行时，右表各列用空（null）值代替。

原文留了一道练习：还有右外连接（Right Outer Join）与全外连接（Full Outer Join），请自行弄清它们的行为。

### 自连接（Self Join）

表也可以与自身连接，称为**自连接（Self Join）**。例如，找出气温区间覆盖了其他天气记录的所有天气记录——需要把每行 weather 的 `temp_lo`/`temp_hi` 与所有其他行的同名列比较：

```sql
SELECT w1.city, w1.temp_lo AS low, w1.temp_hi AS high,
       w2.city, w2.temp_lo AS low, w2.temp_hi AS high
    FROM weather w1 JOIN weather w2
        ON w1.temp_lo < w2.temp_lo AND w1.temp_hi > w2.temp_hi;
```

```text
     city      | low | high |     city      | low | high
---------------+-----+------+---------------+-----+------
 San Francisco |  43 |   57 | San Francisco |  46 |   50
 Hayward       |  37 |   54 | San Francisco |  46 |   50
(2 rows)
```

这里把 weather 表分别重新标记为 `w1` 和 `w2`，以便区分连接的左右两侧。这种别名在其他查询里也能用来省点输入：

```sql
SELECT *
    FROM weather w JOIN cities c ON w.city = c.name;
```

这种缩写风格你会非常频繁地遇到。

> 站内提示：本篇用的"会话-消息"表就是典型的 JOIN 场景——取出某个会话的全部消息用 `messages m JOIN conversations c ON m.conversation_id = c.id`；若要连未发送任何消息的空会话也列出来，就该用 `LEFT OUTER JOIN`（会话在左）。

## 三、索引原理与使用

### 索引为什么快

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

### 索引的生命周期与代价

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

### 索引类型

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

> 站内提示：向量检索会再遇到 GiST 家族的近亲——pgvector 为向量列提供 ivfflat 与 hnsw 索引，原理与"搜索树 / 最近邻搜索"一脉相承，见《向量数据库原理：从 HNSW 论文说起》与《Milvus 与 pgvector 实战》。

### 检查索引使用

PostgreSQL 的索引不需要维护或调优，但检查真实查询负载到底用没用上索引仍然重要：对单条查询用 `EXPLAIN` 命令检查；也可以收集运行中服务器的整体索引使用统计。

很难给出"该建哪些索引"的通用流程，通常需要大量实验。原文给出几条经验：

- **先跑 `ANALYZE`。**它收集表中取值分布的统计信息，规划器据此估计查询返回的行数、为每个可能的查询计划赋予现实成本。没有统计信息时只能假设默认值，几乎必然不准——没跑过 `ANALYZE` 就去研究索引使用是徒劳的。
- **用真实数据做实验。**用测试数据得到的结论只对测试数据成立。极小的测试数据集尤其致命：从 100000 行选 1000 行可能值得建索引，从 100 行选 1 行几乎不值得——100 行多半塞进一个磁盘页，没有哪个计划能快过顺序读一个磁盘页。编造测试数据时要小心：取值非常相似、完全随机或按序插入的数据都会让统计偏离真实分布。
- **索引没被用时，测试阶段可以强制使用。**有一些运行时参数可关闭各类计划：比如关掉顺序扫描（`enable_seqscan`）和嵌套循环连接（`enable_nestloop`）这两个最基础的计划，会逼系统换用其他计划。如果这样它仍选顺序扫描，多半有更根本的原因——例如查询条件与索引不匹配。
- **强制后索引被用上了**，则有两种可能：要么系统本来是对的（用索引确实不合适），要么计划成本估计失真。应当对查询分别计时比较，`EXPLAIN ANALYZE` 在这里很有用。
- **如果确认成本估计有误**：总成本 = 各计划节点每行成本 × 选择性估计。成本常数可用运行时参数调整；选择性估计不准则是统计不足，可通过调整统计收集参数（`ALTER TABLE`）改善。都调不合适时，才考虑显式强制使用索引。

## 四、把三者串起来：一条运营查询的完整生命周期

需求："最近 30 天，每个模型的日均调用量、平均输入/输出 token、p95 延迟，只看调用量超过 200 的模型。"

```sql
SELECT date_trunc('day', c.created_at)          AS day,      -- 聚合前先切粒度
       c.model,
       count(*)                                 AS calls,
       round(avg(c.input_tokens))               AS avg_in,
       round(avg(c.output_tokens))              AS avg_out,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY c.latency_ms) AS p95_ms
FROM llm_calls c
JOIN conversations v ON v.id = c.conversation_id        -- ① JOIN：把调用挂到会话上
WHERE c.created_at >= now() - interval '30 days'        -- ② WHERE：先筛行（早于聚合）
GROUP BY day, c.model                                    -- ③ 分组
HAVING count(*) > 200                                    -- ④ HAVING：再筛组（晚于聚合）
ORDER BY day DESC, calls DESC;
```

三个部分在这条查询里各自的位置：

- **聚合侧**：`date_trunc` + `GROUP BY` 决定"按什么粒度算"；`HAVING count(*) > 200` 只能在分组之后生效——把它写进 `WHERE` 是新手最常见的报错之一；`percentile_cont(...) WITHIN GROUP (ORDER BY ...)` 是有序集合聚合，算 p95 比"取平均"有用得多。
- **JOIN 侧**：这里 `conversations` 只为演示"要带出会话属性时才 JOIN"。**如果连接列不产生行数放大**（一对多的多侧在前、一对一在后），聚合结果才是可信的；否则 `count(*)` 会被重复计数——这是统计口径出错的第一来源，先用 `EXPLAIN` 看估算行数是否合理。
- **索引侧**：`WHERE c.created_at >= ...` 命中 `llm_calls_created_at_idx`（范围扫描）；按 `model` 分组时，`llm_calls_model_idx` 是否被用取决于选择性——如果只有 3 个模型，规划器更愿意顺序扫描再排序，**这不是索引失效，而是它算过更划算**。真正会救场的是复合索引：

```sql
-- 时间范围 + 分组列：让索引顺序直接服务 GROUP BY
CREATE INDEX ON llm_calls (created_at, model);
-- 只统计日志里少数列时，覆盖索引可免回表
CREATE INDEX ON llm_calls (model, created_at) INCLUDE (input_tokens, output_tokens, latency_ms);
```

`INCLUDE` 是 B-tree 的覆盖索引写法（索引里附带非键列），聚合类查询常能因此省掉对堆表的随机访问。

**下一步读哪篇**：为什么规划器这么选、`Seq Scan`/`Index Scan`/`Bitmap Heap Scan` 分别意味着什么，见《EXPLAIN 与 pg_stat_statements：查询计划与慢查询定位》；把这类统计写成"按天/按模型"的报表与窗口函数写法，见《PostgreSQL 窗口函数与 CTE：按天按模型算 token 与延迟》。

## 五、常见坑

1. **`SELECT` 里出现未分组列**：`SELECT city, temp_lo, max(temp_hi) FROM weather GROUP BY city` 在 PostgreSQL 里直接报错（`column "weather.temp_lo" must appear in the GROUP BY clause ...`），在个别数据库里却悄悄返回任意值。SQLite 允许后者，别把那种习惯带过来。
2. **`count(*)` 与 `count(col)` 不是一回事**：后者不计 `NULL`。统计"有回复的调用数"时这差别很要命。
3. **`JOIN` 忘写 `ON`**：`FROM a, b WHERE ...` 少写条件就是笛卡尔积；用显式 `JOIN ... ON` 能从语法上少踩一半。
4. **外连接 + `WHERE` 相互抵消**：`LEFT JOIN cities ON ... WHERE cities.name IS NOT NULL` 会把补出来的 NULL 行全部过滤掉，等价于内连接。要过滤右表条件写在 `ON` 里。
5. **索引加得越多越慢**：写入要同步维护每个索引，`UPDATE` 还会阻碍 HOT 优化。上线三个月后查一次 `pg_stat_user_indexes`，把 `idx_scan = 0` 的索引删掉（详见《备份与 PITR》旁边的运维习惯）。
6. **不跑 `ANALYZE` 就评价索引**：统计信息缺失时规划器只能瞎猜，结论必然失真。

---

> **来源**：本文合并自三篇原站内文章（各自独立翻译自 PostgreSQL 官方文档，许可 PostgreSQL Licence，作者 PostgreSQL Global Development Group）：[2.7. Aggregate Functions](https://www.postgresql.org/docs/current/tutorial-agg.html)（聚合、GROUP BY、HAVING、FILTER）、[2.6. Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html)（内连接、外连接、自连接、隐式与显式写法）、[11.1 Introduction / 11.2 Index Types / 11.12 Examining Index Usage](https://www.postgresql.org/docs/current/indexes-intro.html)（索引原理、六种索引类型、检查索引使用的经验法则）。三篇正文内容完整收录，仅小节层级为合并后统一调整；抓取于 2026-09-13，2026-09-19 合并重排并新增"场景表、串联查询、常见坑"三节（本站编者整理）。
