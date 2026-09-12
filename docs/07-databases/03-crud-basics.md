---
title: SELECT 与增删改查（CRUD）
source_url: https://www.postgresql.org/docs/current/tutorial-select.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
order: 3
versions: PostgreSQL 18 官方教程（第 2 章 2.3-2.5、2.8-2.9 节）
---

> **来源**：本文翻译自 [2.5. Querying a Table](https://www.postgresql.org/docs/current/tutorial-select.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。

> **补充来源**：本文"建表""插入行""更新""删除"三节分别编译自同一教程的 [2.3. Creating a New Table](https://www.postgresql.org/docs/current/tutorial-table.html)、[2.4. Populating a Table With Rows](https://www.postgresql.org/docs/current/tutorial-populate.html)、[2.8. Updates](https://www.postgresql.org/docs/current/tutorial-update.html) 与 [2.9. Deletions](https://www.postgresql.org/docs/current/tutorial-delete.html)，许可同上。

这一篇覆盖对单张表的完整增删改查（CRUD，Create / Read / Update / Delete）。示例沿用 PostgreSQL 官方教程的城市与天气两张表。

## 建表（CREATE TABLE）

通过指定表名与所有列名及其类型来创建新表：

```sql
CREATE TABLE weather (
    city            varchar(80),
    temp_lo         int,           -- 最低气温
    temp_hi         int,           -- 最高气温
    prcp            real,          -- 降水量
    date            date
);
```

在 `psql` 中可以带着换行输入这条命令——`psql` 会识别出命令直到分号才结束。SQL 命令中空白字符（空格、制表符、换行）可以自由使用，甚至整条命令写在一行也没问题。两个连字符（`--`）引出注释，其后直到行尾的内容都会被忽略。SQL 的关键字与标识符不区分大小写，除非把标识符用双引号括起来以保留大小写。

`varchar(80)` 表示最长 80 字符的任意字符串；`int` 是普通整数；`real` 存单精度浮点数；`date` 顾名思义。（原文提醒：类型为 `date` 的列也可以叫 `date` 这个名字，是方便还是混乱，由你决定。）

PostgreSQL 支持标准 SQL 类型 `int`、`smallint`、`real`、`double precision`、`char(N)`、`varchar(N)`、`date`、`time`、`timestamp`、`interval`，还有其他通用类型和一组丰富的几何类型，并允许用户自定义任意多种数据类型——因此类型名不是语法关键字。再建一张存城市地理位置的表，其中 `point` 是 PostgreSQL 特有类型：

```sql
CREATE TABLE cities (
    name            varchar(80),
    location        point
);
```

不需要某张表、或想换一种方式重建时，可以删除它：

```sql
DROP TABLE tablename;
```

## 插入行（INSERT）

用 `INSERT` 语句向表里填入行：

```sql
INSERT INTO weather VALUES ('San Francisco', 46, 50, 0.25, '1994-11-27');
```

所有数据类型都有相当直观的输入格式；不是简单数值的常量通常要用单引号括起来。`date` 类型对输入格式其实很宽容，但教程统一使用上面这种无歧义写法。`point` 类型则要求输入一个坐标对：

```sql
INSERT INTO cities VALUES ('San Francisco', '(-194.0, 53.0)');
```

上面这种写法要求你记住列的顺序。更推荐的语法是显式列出列名：

```sql
INSERT INTO weather (city, temp_lo, temp_hi, prcp, date)
    VALUES ('San Francisco', 43, 57, 0.0, '1994-11-29');
```

列可以按任意顺序列出，甚至省略某些列，比如降水量未知时：

```sql
INSERT INTO weather (date, city, temp_hi, temp_lo)
    VALUES ('1994-11-29', 'Hayward', 54, 37);
```

许多开发者认为显式列出列名比隐式依赖顺序风格更好。要批量加载文本文件中的大量数据时，可以用 `COPY`，它为此做了优化、通常更快，但灵活性不如 `INSERT`：

```sql
COPY weather FROM '/home/user/weather.txt';
```

注意源文件必须位于后端进程所在机器上（由后端直接读取），而不是客户端。

## 查询（SELECT）

要从表中取回数据，就需要对表进行**查询（Query）**，使用的正是 SQL 的 `SELECT` 语句。一条 `SELECT` 语句分为三部分：选择列表（要返回哪些列）、表列表（从哪些表取数据）、可选的限定条件（哪些行满足要求）。

取回 weather 表的所有行：

```sql
SELECT * FROM weather;
```

其中 `*` 是"所有列"的简写。下面的写法结果相同：

```sql
SELECT city, temp_lo, temp_hi, prcp, date FROM weather;
```

输出为：

```text
     city      | temp_lo | temp_hi | prcp |    date
---------------+---------+---------+------+------------
 San Francisco |      46 |      50 | 0.25 | 1994-11-27
 San Francisco |      43 |      57 |    0 | 1994-11-29
 Hayward       |      37 |      54 |      | 1994-11-29
(3 rows)
```

（原文脚注提醒：`SELECT *` 适合随手查询，但生产代码中被普遍视为坏风格——表增加一列就会改变查询结果。）

选择列表中可以写表达式，不只是简单的列引用：

```sql
SELECT city, (temp_hi+temp_lo)/2 AS temp_avg, date FROM weather;
```

`AS` 子句用于给输出列重新命名（可省略）。

加 `WHERE` 子句即可对查询进行"限定"：`WHERE` 里是一个布尔表达式，只有使其为真的行才会返回。常规布尔运算符 `AND`、`OR`、`NOT` 都可用。比如查询旧金山下雨天的天气：

```sql
SELECT * FROM weather
    WHERE city = 'San Francisco' AND prcp > 0.0;
```

还可以要求结果按序返回：

```sql
SELECT * FROM weather
    ORDER BY city;
```

上例的排序规则没有完全指定，旧金山的两行顺序可能互换；写成下面这样则结果总是确定的：

```sql
SELECT * FROM weather
    ORDER BY city, temp_lo;
```

要求去掉结果中的重复行：

```sql
SELECT DISTINCT city
    FROM weather;
```

同样地，`DISTINCT` 之后行的顺序仍可能变化。把 `DISTINCT` 与 `ORDER BY` 一起使用即可得到一致的结果（原文脚注：某些数据库系统——包括旧版 PostgreSQL——的 `DISTINCT` 实现会自动排序，但 SQL 标准并不要求这一点，现行 PostgreSQL 也不保证 `DISTINCT` 会让结果有序）。

## 更新（UPDATE）

用 `UPDATE` 命令修改已有的行。假设你发现 11 月 28 日之后的气温读数全部偏高 2 度，可以这样修正：

```sql
UPDATE weather
    SET temp_hi = temp_hi - 2,  temp_lo = temp_lo - 2
    WHERE date > '1994-11-28';
```

修改后的数据：

```text
     city      | temp_lo | temp_hi | prcp |    date
---------------+---------+---------+------+------------
 San Francisco |      46 |      50 | 0.25 | 1994-11-27
 San Francisco |      41 |      55 |    0 | 1994-11-29
 Hayward       |      35 |      52 |      | 1994-11-29
(3 rows)
```

## 删除（DELETE）

用 `DELETE` 命令删除行。假设你不再关心 Hayward 的天气：

```sql
DELETE FROM weather WHERE city = 'Hayward';
```

Hayward 的所有天气记录都被移除，再查询只剩旧金山的两行。要警惕这种形式的语句：

```sql
DELETE FROM tablename;
```

不带限定条件时，`DELETE` 会删除表中**所有**行，把表清空——系统不会先请求确认！

> 站内提示：`WHERE` 条件写错或漏写是删库最常见的原因之一；生产环境可先用同条件的 `SELECT COUNT(*)` 确认影响范围，再执行 `UPDATE`/`DELETE`，并配合下一篇要讲的事务（TRANSACTION）留好回退余地。
