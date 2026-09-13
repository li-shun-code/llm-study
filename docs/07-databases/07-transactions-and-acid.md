---
title: 事务与 ACID
source_url: https://www.postgresql.org/docs/current/tutorial-transactions.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
order: 7
versions: PostgreSQL 18 官方教程（第 3 章 3.4 节）
---
## 事务是什么

**事务（Transaction）**是所有数据库系统的基本概念。其核心在于：把多个步骤打包成一个"全做或全不做"的操作。步骤之间的中间状态对其他并发事务不可见；如果发生故障阻止事务完成，那么任何一步都不会影响数据库。

以银行数据库为例：表里存着各客户账户余额和各分支行的总存款余额。假设要记录一笔从 Alice 账户到 Bob 账户的 100 美元付款。极度简化后，SQL 命令大致是：

```sql
UPDATE accounts SET balance = balance - 100.00
    WHERE name = 'Alice';
UPDATE branches SET balance = balance - 100.00
    WHERE name = (SELECT branch_name FROM accounts WHERE name = 'Alice');
UPDATE accounts SET balance = balance + 100.00
    WHERE name = 'Bob';
UPDATE branches SET balance = balance + 100.00
    WHERE name = (SELECT branch_name FROM accounts WHERE name = 'Bob');
```

命令细节不重要，重要的是：这么简单的操作竟涉及多条相互独立的更新。银行的职员们希望得到保证——这些更新要么全部发生，要么全不发生。系统故障若导致 Bob 收到 100 美元而 Alice 的账户没被扣款，肯定不行；Alice 被扣了款而 Bob 没入账，她也当不成满意的客户。我们需要一个保证：操作中途出错时，已执行的步骤一概不生效。把这组更新打包进一个**事务**就给了我们这个保证——事务是**原子的（Atomic）**：从其他事务的视角看，它要么完整发生，要么根本没发生。

我们还需要一个保证：一旦事务完成并被数据库系统确认，它就已被永久记录，即使紧随其后发生崩溃也不会丢失。比如记录 Bob 的一笔现金取款，我们不希望他刚走出银行大门系统就崩溃、这笔扣款凭空消失。事务型数据库保证：在事务被报告完成**之前**，它所做的全部更新都已写入永久存储（即磁盘）日志。

事务型数据库另一个重要性质与原子更新的概念密切相关：多个事务并发运行时，任何一个都不应看到其他事务未完成的修改。例如一个事务正在汇总所有分支行余额，它不能只算进 Alice 分支的扣款而漏掉 Bob 分支的入账（反之亦然）。所以事务的"全有或全无"不仅体现在对数据库的最终效果上，也体现在其发生过程中的可见性上：一个进行中事务已做的更新对其他事务不可见，直到该事务完成时全部更新才同时可见。

## BEGIN 与 COMMIT

在 PostgreSQL 中，用 `BEGIN` 和 `COMMIT` 命令把事务的 SQL 命令包围起来。上面的银行业务实际写法是：

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100.00
    WHERE name = 'Alice';
-- 等等
COMMIT;
```

如果进行到一半决定不提交了（比如刚发现 Alice 的余额变成了负数），可以用 `ROLLBACK` 代替 `COMMIT`，迄今的全部更新都会被取消。

PostgreSQL 实际上把每条 SQL 语句都视为在事务中执行：不发出 `BEGIN` 时，每条语句都被隐式的 `BEGIN` 和（成功时的）`COMMIT` 包裹。被 `BEGIN` 与 `COMMIT` 包围的一组语句有时称为**事务块（Transaction Block）**。

> **注意**：一些客户端库会自动发出 `BEGIN` 和 `COMMIT`，让你在不知不觉中得到事务块的效果。请查阅你所用接口的文档。

## 保存点（SAVEPOINT）

可以借助**保存点（Savepoint）**以更细的粒度控制事务内的语句：有选择地丢弃事务的一部分，同时提交其余部分。用 `SAVEPOINT` 定义保存点后，需要时可用 `ROLLBACK TO` 回滚到该保存点——从定义保存点到回滚之间的所有数据库改动被丢弃，更早的改动则保留。

回滚到保存点后，保存点仍然有效，可以多次回滚到它；反之，若确定不再需要某个保存点，可以释放（`RELEASE`）它以腾出资源。注意：释放或回滚到某个保存点，会自动释放它之后定义的所有保存点。

这一切都发生在事务块内部，对其他数据库会话完全不可见；当你提交事务块时，被提交的动作作为一个整体对其他会话可见，被回滚的动作则永远不可见。

回到银行数据库：假设我们扣了 Alice 的 100 美元、又给 Bob 的账户入了账，之后才发现应该入到 Wally 的账上。用保存点可以这样补救：

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100.00
    WHERE name = 'Alice';
SAVEPOINT my_savepoint;
UPDATE accounts SET balance = balance + 100.00
    WHERE name = 'Bob';
-- 哎呀……撤销它，改用 Wally 的账户
ROLLBACK TO my_savepoint;
UPDATE accounts SET balance = balance + 100.00
    WHERE name = 'Wally';
COMMIT;
```

这个例子当然过度简化了，但它展示了保存点能给事务块带来多大的控制力。此外，当事务块因错误被系统置入中止（Aborted）状态时，`ROLLBACK TO` 是在"整体回滚重来"之外唯一能重获事务块控制权的手段。

## 与 ACID 四要素的对应（编者按）

**表：教程概念与 ACID 四要素对应**

| 要素 | 教程中的对应表述 |
| --- | --- |
| 原子性（Atomicity） | "它要么完整发生，要么根本没发生"；中途出错则已执行步骤一概不生效 |
| 一致性（Consistency） | 事务把数据库从一个一致状态带到另一个一致状态（如转账总额不变）；由约束与事务语义共同保证 |
| 隔离性（Isolation） | "多个事务并发运行时，任何一个都不应看到其他事务未完成的修改" |
| 持久性（Durability） | "事务被报告完成之前，其全部更新都已写入永久存储（磁盘）日志" |

> 站内提示：下一篇 SQLAlchemy 的连接层会讲到"事务与 DBAPI 的协作"——应用代码里 `with engine.begin() as conn:` 的每一行,背后都是本篇的 `BEGIN`/`COMMIT`。

---

> **来源**：本文翻译自 [3.4. Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。

---

> **编者按**：原文按官方教程行文，未直接使用 ACID 缩写；本文在文末补充了教程概念与 ACID（原子性、一致性、隔离性、持久性）四要素的对应关系，便于与教材术语互认。
