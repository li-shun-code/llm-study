---
title: JOIN 多表查询
source_url: https://www.postgresql.org/docs/current/tutorial-join.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
order: 5
versions: PostgreSQL 18 官方教程（第 2 章 2.6 节）
---

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

## 隐式写法与显式写法

上面这种连接查询还有另一种写法：

```sql
SELECT *
    FROM weather, cities
    WHERE city = name;
```

这种语法比 `JOIN`/`ON` 更早，`JOIN`/`ON` 是 SQL-92 标准引入的：表直接列在 `FROM` 子句中，比较表达式放进 `WHERE` 子句。两种写法结果完全相同，但显式语法对读者更友好——连接条件由专门的关键字引出，而不是混在 `WHERE` 的其他条件里。

## 外连接（OUTER JOIN）

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

## 自连接（Self Join）

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

> 站内提示：本「计算机基础」 篇设计的"会话-消息"表就是典型的 JOIN 场景——取出某个会话的全部消息用 `messages m JOIN conversations c ON m.conversation_id = c.id`；若要连未发送任何消息的空会话也列出来，就该用 `LEFT OUTER JOIN`（会话在左）。

---

> **来源**：本文翻译自 [2.6. Joins Between Tables](https://www.postgresql.org/docs/current/tutorial-join.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。
