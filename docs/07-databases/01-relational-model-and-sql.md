---
title: 关系模型与 SQL 入门
source_url: https://eng.libretexts.org/Bookshelves/Computer_Science/Databases_and_Data_Structures/Database_Design_2e_(Watt)/01%3A_Chapters/1.07%3A_The_Relational_Data_Model
author: Adrienne Watt / Nelson Eng（Database Design - 2nd Edition）
license: CC BY 4.0
fetched_at: 2026-09-13
translated: true
versions: 概念适用于所有关系数据库；示例对照 PostgreSQL 18 官方教程
order: 1
group: SQL 与数据建模
---
在学习具体数据库产品之前，先建立"关系模型（Relational Model）"的概念框架：后面遇到的 SQLite、PostgreSQL、MySQL，乃至 SQLAlchemy ORM，本质上都是这一模型的不同实现。

## 关系数据模型

关系数据模型由 E. F. Codd 于 1970 年提出，是目前使用最广泛的数据模型。它为以下方面奠定了基础：

- 关于数据/关系/约束的理论研究；
- 大量数据库设计方法论；
- 标准数据库访问语言——结构化查询语言（SQL，Structured Query Language）；
- 几乎所有现代商业数据库管理系统。

关系数据模型把世界描述为"一组相互关联的关系（即表）的集合"。

### 基本概念

**关系（Relation）**，又称表（Table）或文件（File），是"一个带名字的、由若干域（Domain）构成的笛卡尔积的子集"。通俗地说：一张表内的每一行代表一组相关的数据值。

- **行（Row）**，也叫记录（Record），术语上是**元组（Tuple）**；
- **列（Column）**，也叫字段（Field），术语上是**属性（Attribute）**。

可以这么理解：属性用来定义记录，而记录是属性值的一个集合。关系与其域之间的逻辑关系是：给定 n 个域 D1, D2, …, Dn，定义在这些域上的关系 r 满足 r ⊆ D1×D2×…×Dn。

**域（Domain）**是建模数据时所用的原子值（Atomic Value）的原始集合。所谓"原子"，指在关系模型看来该值不可再分。例如：

- 婚姻状况的域：{已婚, 单身, 离异}；
- 班次的域：{Mon, Tue, Wed, …}（一周中所有可能的日子）；
- 工资的域：所有大于 0 且小于 200000 的浮点数；
- 名字的域：所有能表示人名的字符串。

总结：域是一列允许存放的可接受值的集合，由该列的属性与数据类型决定。

**记录（Record）**把相互关联的字段组织在一起，比如一个客户或一名员工的全部信息；记录与字段的配合是所有数据库存储的基础。原文以一张简单表举例：表中含记录 ID（整数）、发布日期（日期型）、作者（文本）、标题（自由文本）四个字段——正因为日期字段被声明为 Date 类型，数据库才能按日历系统对它排序，而不是当作"用斜杠分隔的数字"。

**元/度（Degree）**是表中属性的数量。上述示例表的度为 4。

### 表的性质

- 每张表的名字在数据库内唯一；
- 不存在重复的行，每行都可区分；
- 列中的条目是原子的：表内不允许出现重复组或多值属性；
- 同一列的条目来自同一个域（由数据类型决定），如数值（numeric/integer/float 等）、字符串、日期、布尔值；不允许把不同数据类型混在一起运算；
- 每个属性的名字唯一；
- 列的顺序无关紧要；
- 行的顺序无关紧要。

### 术语对照

原文特别提示：下列术语互为同义词，其中"Alternative 1"列最常用。

**表：关系模型术语对照**

| 正式术语 | Alternative 1 | Alternative 2 |
| --- | --- | --- |
| 关系（Relation） | 表（Table） | 文件（File） |
| 元组（Tuple） | 行（Row） | 记录（Record） |
| 属性（Attribute） | 列（Column） | 字段（Field） |

（原文该表为配图，此处按其内容转写为文字表格。）

## SQL 语言是什么

以下内容编译自 PostgreSQL 官方教程第 2 章开篇。

PostgreSQL 是一个关系数据库管理系统（RDBMS，Relational Database Management System），即管理"存储在关系中"的数据的系统。"关系"本质上是"表"的数学称呼。用表来存数据如今看似天经地义，但组织数据库还有其他方式：类 Unix 操作系统的文件与目录构成层次数据库，面向对象数据库则是更晚近的发展。

每张表都是命名的行的集合。同一张表的每一行拥有相同的命名列集合，每个列都属于特定数据类型。列在行内的顺序是固定的，但 SQL 不以任何方式保证行在表中的存储顺序（尽管可以在展示时显式排序）。

表被组织进数据库；由单个 PostgreSQL 服务器实例管理的一组数据库，构成一个数据库集群（Database Cluster）。

SQL 语言通过 `SELECT` 等语句对这些表做查询与修改，具体语法从《SELECT 与增删改查（CRUD）》开始逐篇展开。

## 站内示例：用关系模型看"LLM 会话"

> 以下小节为本站编者补充，便于把上述概念对应到本站项目实战（会话-消息表设计），不属于译文内容。

把一个"LLM 对话应用"按关系模型拆解：`conversations` 表的一行是一次会话（元组），`id`、`title`、`created_at` 等是它的属性，每个属性都有各自的域（如 `created_at` 的域是时间戳类型）；`messages` 表的一行是一条消息，通过 `conversation_id` 属性引用所属会话——这就是下一篇 E-R 建模要正式展开的"关系"。

---

> **来源**：本文翻译自 [1.7: The Relational Data Model](https://eng.libretexts.org/Bookshelves/Computer_Science/Databases_and_Data_Structures/Database_Design_2e_(Watt)/01%3A_Chapters/1.07%3A_The_Relational_Data_Model)，作者 Adrienne Watt / Nelson Eng（Database Design - 2nd Edition），许可 CC BY 4.0。抓取于 2026-09-13。

---

> **补充来源**：本文"SQL 语言是什么"一节编译自 PostgreSQL 18 官方教程 [2.1. Introduction](https://www.postgresql.org/docs/current/tutorial-sql-intro.html) 与 [2.2. Concepts](https://www.postgresql.org/docs/current/tutorial-concepts.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。原文配图已删去，图中信息以文字说明。
