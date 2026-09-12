---
title: 聚合与分组：GROUP BY、HAVING 与聚合函数
source_url: https://www.postgresql.org/docs/current/tutorial-agg.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
order: 4
versions: PostgreSQL 18 官方教程（第 2 章 2.7 节）
---

> **来源**：本文翻译自 [2.7. Aggregate Functions](https://www.postgresql.org/docs/current/tutorial-agg.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。

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

## GROUP BY 分组聚合

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

## HAVING 过滤分组结果

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

## WHERE 与 HAVING 的本质区别

理解聚合与 `WHERE`/`HAVING` 的交互非常重要。根本区别在于：

- `WHERE` 在分组和聚合计算**之前**选取输入行——它控制哪些行进入聚合计算；
- `HAVING` 在分组和聚合计算**之后**选取组行。

因此 `WHERE` 子句不能包含聚合函数——用聚合去决定"哪些行作为聚合的输入"是没有意义的；而 `HAVING` 子句总是包含聚合函数。（严格来说，`HAVING` 里也可以不写聚合，但很少有用武之地——同样的条件放在 `WHERE` 阶段更高效。）

在上面的例子中，城市名限制放进了 `WHERE`，因为它不需要聚合。这比放进 `HAVING` 更高效：不满足 `WHERE` 检查的行根本不会参与分组与聚合计算。

## FILTER：按聚合分别过滤输入

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
