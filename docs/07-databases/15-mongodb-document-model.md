---
title: MongoDB 文档模型
source_url: https://www.mongodb.com/docs/manual/core/document/
author: MongoDB Inc.（MongoDB 文档手册）
license: CC BY-NC-SA 3.0 US
fetched_at: 2026-09-13
translated: true
order: 15
versions: MongoDB 文档手册当前版（含 5.0/6.1 起的行为说明）
---
## MongoDB 是什么

MongoDB 是一个文档数据库（Document Database），帮助开发者更快构建现代应用：数据存放在灵活的、类 JSON 的文档中，让数据建模与应用代码使用数据的方式保持一致。灵活模式（Schema）意味着可以不停机演进数据模型、快速迭代、从容处理不均匀的数据。MongoDB 提供强大的查询引擎、横向扩展与内置高可用，从快速原型到大型关键负载都能支撑。

一条记录（Record）就是一个**文档（Document）**：由"字段-值对"（Field and Value Pair）构成的数据结构，与 JSON 对象十分相似；字段的值还可以是其他文档、数组、文档数组。使用文档的好处：

- 文档对应许多编程语言的内置数据类型；
- 内嵌文档与数组减少了对昂贵 JOIN 的需求；
- 动态模式支持流畅的多态。

MongoDB 把文档存放在**集合（Collection）**中——集合大致对应关系数据库中的表；此外还支持只读视图（View）与按需物化视图（On-Demand Materialized View）。其他关键特性包括：高性能（内嵌数据模型减少 I/O，索引可建在内嵌文档与数组的键上）；查询 API 除 CRUD 外支持聚合管道、文本搜索与地理空间查询；副本集（Replica Set，一组维护同一数据集的服务器）提供自动故障转移与数据冗余；分片（Sharding）把数据分布到集群；多存储引擎（默认 WiredTiger，含静态加密支持）。

## 文档：数据的基本单元

MongoDB 的面向对象数据模型让数据的组织方式直接映射代码库中的对象模型，从而省去关系数据库必需的对象-关系映射（ORM 一类的转换层）。

> **注意**：MongoDB 以 **BSON 文档**存储数据记录。BSON 是 JSON 文档的二进制表示，但比 JSON 包含更多数据类型（规格见 bsonspec.org，类型清单见官方 BSON Types 页）。

文档由字段-值对构成：

```javascript
{
   field1: value1,
   field2: value2,
   field3: value3,
   ...
   fieldN: valueN
}
```

字段的值可以是任何 BSON 数据类型，包括其他文档、数组、文档数组。例如：

```javascript
var mydoc = {
               _id: ObjectId("5099803df3f4948bd2f98391"),
               name: { first: "Alan", last: "Turing" },
               birth: new Date('Jun 23, 1912'),
               death: new Date('Jun 07, 1954'),
               contribs: [ "Turing machine", "Turing test", "Turingery" ],
               views : Long(1250000)
            }
```

各字段的数据类型：

- `_id` 持有一个 **ObjectId**；
- `name` 持有一个**内嵌文档**（含 `first` 与 `last` 字段）；
- `birth` 与 `death` 持有 **Date** 类型的值；
- `contribs` 持有**字符串数组**；
- `views` 持有 **NumberLong** 类型的值。

## 字段名的规则

字段名是字符串，但有如下限制：

- 字段名 `_id` 保留作主键：其值在集合内必须唯一、不可变，类型可以是除数组与正则外的任何类型；若 `_id` 含子字段，子字段名不能以 `$` 开头。
- 字段名**不能**包含 null 字符。
- 服务器允许存储含点（`.`）与美元符（`$`）的字段名；MongoDB 5.0 起对二者有更好的支持（仍有限制，详见官方 Field Name Considerations）。
- 每个字段名在文档内必须唯一。不要保存含重复字段的文档——MongoDB 的 CRUD 操作在文档有重复字段时可能行为异常。查询语言不支持重复字段名的文档：某些 BSON 构造器允许构造重复字段的文档，但插入不被支持（即使插入看似成功）——驱动可能静默丢弃重复值，或插入含重复字段的非法文档，查询结果将不一致；对这类文档的更新同样不受支持。MongoDB 6.1 起可用 `validate` 命令（`full: true`）检查文档是否有重复字段名；任何版本都可用聚合运算符 `$objectToArray` 检查。

## 点表示法（Dot Notation）

MongoDB 用点表示法访问数组元素与内嵌文档的字段。

**数组**：把数组名与点（`.`）、从零起的下标位置拼接并加引号，格式 `"<array>.<index>"`。对下面的字段：

```javascript
{
   ...
   contribs: [ "Turing machine", "Turing test", "Turingery" ],
   ...
}
```

要指定 `contribs` 数组的第三个元素，用 `"contribs.2"`。

**内嵌文档**：把内嵌文档名与点、字段名拼接并加引号，格式 `"<embedded document>.<field>"`。对：

```javascript
{
   ...
   name: { first: "Alan", last: "Turing" },
   contact: { phone: { type: "cell", number: "111-222-3333" } },
   ...
}
```

可用 `"name.last"` 指定 `last` 字段，用 `"contact.phone.number"` 指定 `number` 字段（原文以此为例展示多级内嵌的寻址）。

原文还列出与数组更新/读取相关的位置运算符：`$[]`（更新数组全部元素）、`$[<identifier>]`（按 arrayFilters 条件更新匹配元素）、更新中的 `$`（更新第一个匹配查询条件的元素）与投影中的 `$`（返回第一个匹配元素）。

## 与关系模型的取舍（站内补充）

- **何时选文档模型**：数据的读写天然以"聚合根"为单位（如一条 LLM 会话连同其全部消息、一次评测连同其全部样本得分），内嵌文档一次读取即可整体返回，免去多次 JOIN；字段在不同记录间天然不齐（多模态消息、不同厂商的 trace 字段）时，动态模式比"满是可空列的宽表"干净得多。
- **何时不选**：需要跨实体复杂 JOIN、强事务约束、多对多关系频繁变动的场景，关系模型（本模块 01-07 篇）仍是首选。MongoDB 自 4.0 起支持多文档 ACID 事务，但"文档模型 + 事务"通常应保留给真正需要原子更新多文档的场合，而不是替代规范化的关系设计。
- **快速上手**：Community 版可用 Docker（`docker run -d -p 27017:27017 mongo`）启动，配合 `mongosh` 或 PyMongo/ Motor 练习本篇的文档读写。

---

> **来源**：本文翻译自 [Documents](https://www.mongodb.com/docs/manual/core/document/)，作者 MongoDB Inc.（MongoDB 文档手册），许可 CC BY-NC-SA 3.0 US。抓取于 2026-09-13。

---

> **补充来源**：本文"MongoDB 是什么"一节编译自同一手册的 [Introduction to MongoDB](https://www.mongodb.com/docs/manual/introduction/)，许可同上；文末"与关系模型的取舍"小节为本站编者补充。
