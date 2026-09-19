---
title: 事务与 ACID
source_url: https://www.postgresql.org/docs/current/tutorial-transactions.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
versions: PostgreSQL 18 官方教程（第 3 章 3.4 节）+ 官方文档第 13 章 MVCC/并发控制（13.1–13.2 节）
order: 4
group: SQL 与数据建模
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

## 隔离级别与 MVCC（PostgreSQL 并发控制章）

以下内容翻译自 PostgreSQL 官方文档第 13 章 Concurrency Control（MVCC）的章引言、13.1 Introduction 与 13.2 Transaction Isolation。

当两个或多个会话试图同时访问同一数据时，PostgreSQL 数据库系统的行为由本章描述。此时的目标是：在保持严格数据完整性的同时，让所有会话都能高效访问。每个数据库应用开发者都应熟悉本章的主题。

PostgreSQL 为开发者管理并发数据访问提供了一整套丰富的工具。在内部，数据一致性靠**多版本模型（Multiversion Concurrency Control，MVCC）**维护：每条 SQL 语句看到的是数据在过去某个时刻的**快照**（数据库的一个"版本"），而不管底层数据当前的状态如何。这防止语句看到并发事务对同一数据行执行更新时产生的不一致数据，为每个数据库会话提供**事务隔离**。MVCC 摒弃传统数据库系统的加锁方法学，把锁争用降到最低，从而在多用户环境下取得合理性能。

使用 MVCC 并发控制模型而非加锁的主要优势在于：MVCC 中为查询（读）数据获取的锁与为写数据获取的锁互不冲突，因此**读永不阻塞写，写也永不阻塞读**。即使通过创新性的**可串行化快照隔离（Serializable Snapshot Isolation，SSI）**级别提供最严格的事务隔离，PostgreSQL 也维持这一保证。

对一般不需要完整事务隔离、倾向于显式管理特定冲突点的应用，PostgreSQL 也提供表级与行级锁设施。不过，正确使用 MVCC 的性能通常好于用锁。此外，应用定义的咨询锁（advisory lock）提供了一种获取不与单个事务绑定的锁的机制。

### SQL 标准的四个隔离级别

SQL 标准定义了四个事务隔离级别。最严格的是 Serializable（可串行化）：标准用一段话定义它——一组可串行化事务的任何并发执行，都保证产生与"按某种顺序逐个串行执行"相同的效果。其余三个级别则用**现象（phenomena）**定义：并发事务交互导致的、在该级别不允许出现的结果。标准指出，由于 Serializable 的定义，这些现象在该级别都不可能出现（这毫不奇怪——事务的效果必须与逐个执行一致，怎么可能看到交互导致的现象？）。

各级别禁止的现象：

- **脏读（dirty read）**：事务读到并发未提交事务写入的数据。
- **不可重复读（nonrepeatable read）**：事务重读先前读过的数据，发现数据已被另一个事务修改（该事务在初次读取之后提交）。
- **幻读（phantom read）**：事务重新执行一个返回满足搜索条件的行集的查询，发现满足条件的行集因另一个新近提交的事务而改变。
- **序列化异常（serialization anomaly）**：成功提交一组事务的结果，与这些事务按任何顺序逐个执行的所有可能结果都不一致。

SQL 标准与 PostgreSQL 实现的事务隔离级别见下表（原文表 13.1）：

**表：事务隔离级别**

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 序列化异常 |
| --- | --- | --- | --- | --- |
| Read uncommitted | 允许，但 PG 中不存在 | 可能 | 可能 | 可能 |
| Read committed | 不可能 | 可能 | 可能 | 可能 |
| Repeatable read | 不可能 | 不可能 | 允许，但 PG 中不存在 | 可能 |
| Serializable | 不可能 | 不可能 | 不可能 | 不可能 |

在 PostgreSQL 中，你可以请求四个标准隔离级别中的任何一个，但内部只实现了三个不同的隔离级别——PostgreSQL 的 Read Uncommitted 模式行为如同 Read Committed。因为这是把标准隔离级别映射到 PostgreSQL 多版本并发控制架构的唯一合理方式。

上表还显示，PostgreSQL 的 Repeatable Read 实现不允许幻读。这符合 SQL 标准，因为标准只规定各隔离级别**不得**出现哪些异常；提供更强的保证是允许的。各隔离级别的行为细节见以下小节。

设置事务的隔离级别用 [SET TRANSACTION](https://www.postgresql.org/docs/current/sql-set-transaction.html) 命令。

> **重要**：一些 PostgreSQL 数据类型和函数对事务行为有特殊规则。特别是，对序列（sequence）的更改（进而包括用 `serial` 声明的列的计数器）对所有其他事务立即可见，且做出更改的事务中止时也不会回滚。见官方文档 9.17 节与 8.1.4 节。

### Read Committed 隔离级别

Read Committed（读已提交）是 PostgreSQL 的默认隔离级别。事务使用该级别时，`SELECT` 查询（不带 `FOR UPDATE/SHARE` 子句）只能看到查询开始之前已提交的数据；它绝不会看到未提交数据，也绝不会看到查询执行期间并发事务提交的更改。实际上，`SELECT` 查询看到的是查询开始运行那一刻的数据库快照。不过，`SELECT` 能看到自己事务内先前执行的更新的效果，即使它们尚未提交。还要注意：同一个事务里两条先后执行的 `SELECT` 命令可能看到不同的数据——只要其他事务在第一条 `SELECT` 开始之后、第二条 `SELECT` 开始之前提交了更改。

`UPDATE`、`DELETE`、`SELECT FOR UPDATE` 与 `SELECT FOR SHARE` 命令在搜索目标行时的行为与 `SELECT` 相同：只找命令开始时刻已提交的目标行。但找到时该目标行可能已被另一个并发事务更新（或删除、加锁）。此时，后到的更新者会等待第一个更新事务提交或回滚（若仍在进行）。若第一个更新者回滚，其效果被抵消，第二个更新者可以继续更新原来找到的行；若第一个更新者提交，第二个更新者将在该行已被删除时忽略该行，否则对更新后的行版本尝试自己的操作。命令的搜索条件（`WHERE` 子句）会被重新求值，看更新后的行版本是否仍满足；满足则第二个更新者基于更新后的行版本继续操作。对 `SELECT FOR UPDATE` 与 `SELECT FOR SHARE`，这意味着加锁并返回客户端的正是更新后的行版本。

带 `ON CONFLICT DO UPDATE` 子句的 `INSERT` 行为类似。Read Committed 模式下，每个拟插入的行要么插入、要么更新；除非发生无关错误，二者必有其一。若冲突源自另一个事务、其效果对这条 `INSERT` 尚不可见，`UPDATE` 子句仍会作用于该行——即使按常规该行没有任何版本对这条命令可见。

带 `ON CONFLICT DO NOTHING` 子句的 `INSERT`，可能因另一个事务的结果（对 `INSERT` 快照不可见）而导致某行不执行插入。同样，这只发生在 Read Committed 模式。

`MERGE` 允许用户指定 `INSERT`、`UPDATE`、`DELETE` 子命令的各种组合。同时带 `INSERT` 与 `UPDATE` 子命令的 `MERGE` 看起来像带 `ON CONFLICT DO UPDATE` 的 `INSERT`，但不保证 `INSERT` 或 `UPDATE` 一定发生。若 `MERGE` 尝试 `UPDATE` 或 `DELETE` 而目标行被并发更新、但连接条件对当前目标与源元组仍成立，`MERGE` 的行为与 `UPDATE`/`DELETE` 命令相同——对更新后的行版本执行动作。但由于 `MERGE` 可以指定多个动作且动作可带条件，每个动作的条件都会在更新后的行版本上重新求值、从第一个动作开始——即使原先匹配的动作在动作列表中靠后。反之，若行被并发更新得连接条件不再成立，`MERGE` 会接着求值 `NOT MATCHED BY SOURCE` 与 `NOT MATCHED [BY TARGET]` 动作，执行其中各自第一个成功的；若行被并发删除，`MERGE` 求值 `NOT MATCHED [BY TARGET]` 动作并执行第一个成功的。若 `MERGE` 尝试 `INSERT`、存在唯一索引、且并发插入了重复行，会抛唯一性冲突错误；`MERGE` 不会尝试通过重启 `MATCHED` 条件求值来避免此类错误。

由于上述规则，更新命令可能看到不一致的快照：它能看到并发更新命令对它正要更新的那些行的效果，却看不到这些命令对数据库其他行的效果。这使 Read Committed 模式不适合涉及复杂搜索条件的命令；但对简单情形正合适。例如从一个账户转账 100 美元到另一个账户：

```sql
BEGIN;
UPDATE accounts SET balance = balance + 100.00 WHERE acctnum = 12345;
UPDATE accounts SET balance = balance - 100.00 WHERE acctnum = 7534;
COMMIT;
```

若另一个事务并发地尝试修改账户 7534 的余额，我们显然希望第二条语句从该账户行的更新后版本出发。因为每条命令只影响一个预先确定的行，让它看到行的更新版本不会造成任何麻烦的不一致。

更复杂的使用在 Read Committed 模式下可能产生不理想的结果。例如一条 `DELETE` 命令操作的数据正被另一个命令加进又移出它的限制条件：假设 `website` 是两行的表，`website.hits` 分别为 9 和 10：

```sql
BEGIN;
UPDATE website SET hits = hits + 1;
-- 另一会话运行：DELETE FROM website WHERE hits = 10;
COMMIT;
```

这条 `DELETE` 将毫无效果——尽管 `UPDATE` 前后都存在 `website.hits = 10` 的行。原因：更新前的行值 9 被跳过；等 `UPDATE` 完成、`DELETE` 拿到锁时，新的行值已是 11 而非 10，不再满足条件。

由于 Read Committed 模式为每条命令都取一个包含截至该时刻所有已提交事务的新快照，同一事务中后续命令无论如何都会看到并发事务提交的效果。上面争论的焦点是：**单条**命令能否看到数据库绝对一致的视图。

Read Committed 模式提供的事务部分隔离对许多应用已经足够，而且该模式快速、易用；但它并非对所有情形都够用。执行复杂查询与更新的应用可能需要比 Read Committed 更严格一致的数据库视图。

### Repeatable Read 隔离级别

Repeatable Read（可重复读）隔离级别只看到事务开始之前已提交的数据；绝不会看到未提交数据，也绝不会看到事务执行期间并发事务提交的更改。（不过每条查询都能看到自己事务内先前执行的更新的效果，即使尚未提交。）这是比 SQL 标准对该级别要求更强的保证——除序列化异常外，它防止了表中列出的全部现象。如前所述，标准明确允许这一点：标准只描述各隔离级别必须提供的**最低**保护。

该级别与 Read Committed 的差别在于：可重复读事务里的查询看到的是**事务**中第一条非事务控制语句开始时刻的快照，而不是事务内当前语句开始时刻的快照。因此，**单个**事务内先后执行的 `SELECT` 看到同样的数据——看不到自己事务开始之后其他事务提交的更改。

使用该级别的应用必须准备好因序列化失败而重试事务。

`UPDATE`、`DELETE`、`MERGE`、`SELECT FOR UPDATE` 与 `SELECT FOR SHARE` 命令在搜索目标行时的行为与 `SELECT` 相同：只找事务开始时刻已提交的目标行。但找到时该目标行可能已被另一个并发事务更新（或删除、加锁）。此时，可重复读事务会等待第一个更新事务提交或回滚（若仍在进行）。若第一个更新者回滚，其效果被抵消，可重复读事务可以继续更新原来找到的行；但若第一个更新者提交（且确实更新或删除了该行，不只是加锁），可重复读事务将被回滚，报错：

```text
ERROR:  could not serialize access due to concurrent update
```

因为可重复读事务不能修改或加锁"本事务开始之后被其他事务更改"的行。

应用收到该错误时应中止当前事务，并从头重试整个事务。第二轮时，先前提交的更改会成为该事务对数据库初始视图的一部分，以新版本行作为新事务更新的起点不存在逻辑冲突。

注意：只有更新型事务才可能需要重试；只读事务永远不会遇到序列化冲突。

Repeatable Read 模式提供严格保证：每个事务看到完全稳定的数据库视图。然而这个视图未必与同级别并发事务的某种串行（逐个）执行一致。例如，即使是该级别的只读事务，也可能看到一个控制记录已被更新为"批次完成"，却看不到逻辑上属于该批次的某条明细记录——因为它读到的是控制记录的较早版本。不配合显式锁去阻塞冲突事务、就想在这个隔离级别上靠事务实施业务规则，多半行不通。

Repeatable Read 隔离级别用学术数据库文献及某些其他数据库产品中称为**快照隔离（Snapshot Isolation）**的技术实现。与使用传统加锁技术（降低并发）的系统相比，行为与性能可能有差异。有些系统甚至把 Repeatable Read 与 Snapshot Isolation 作为行为不同的两个隔离级别提供。区分这两种技术的允许现象，直到 SQL 标准制定之后才被数据库研究者形式化，超出本手册范围；完整论述见官方文献 [berenson95]。

> **注意**：PostgreSQL 9.1 之前，请求 Serializable 事务隔离级别提供的行为与此处描述的完全相同。要保留遗留的 Serializable 行为，现在应请求 Repeatable Read。

### Serializable 隔离级别

Serializable（可串行化）隔离级别提供最严格的事务隔离。该级别为所有已提交事务模拟串行事务执行——好像事务一个接一个地串行执行，而非并发执行。不过与 Repeatable Read 一样，使用该级别的应用必须准备好因序列化失败而重试事务。实际上，该级别的工作方式与 Repeatable Read 完全相同，只是额外监视一些条件——这些条件可能使一组并发可串行化事务的执行行为，与这些事务所有可能的串行（逐个）执行都不一致。这种监视不引入 Repeatable Read 之外的任何阻塞，但有少量监视开销；检测到可能造成**序列化异常**的条件会触发**序列化失败**。

举个例子。表 `mytab` 初始内容：

```text
 class | value
-------+-------
     1 |    10
     1 |    20
     2 |   100
     2 |   200
```

假设可串行化事务 A 计算：

```sql
SELECT SUM(value) FROM mytab WHERE class = 1;
```

然后把结果（30）作为 `value` 插入一个 `class = 2` 的新行。并发地，可串行化事务 B 计算：

```sql
SELECT SUM(value) FROM mytab WHERE class = 2;
```

得到 300，插入一个 `class = 1` 的新行。然后两个事务都尝试提交。若二者运行在 Repeatable Read 级别，都允许提交；但结果与任何串行执行顺序都不一致，因此用 Serializable 时只允许一个事务提交，另一个被回滚并报错：

```text
ERROR:  could not serialize access due to read/write dependencies among transactions
```

原因：若 A 先于 B 执行，B 会算出 330 而非 300；反之另一顺序也会使 A 算出不同的和。

依赖 Serializable 事务防止异常时，重要的一点是：从永久用户表读到的数据，在读它的事务成功提交之前不能视为有效。这对只读事务同样成立——例外是 **deferrable** 只读事务中读到的数据一经读出即知有效，因为这种事务会等到能拿到保证无此类问题的快照才开始读数据。其他所有情况下，应用不得依赖后来中止的事务期间读到的结果；应当重试事务直至成功。

为保证真正的可串行化，PostgreSQL 使用**谓词锁（predicate locking）**：它保存一些锁，使其能判断"某次写入若先执行，是否会影响并发事务先前一次读取的结果"。在 PostgreSQL 里这些锁不造成任何阻塞，因此**不可能**参与造成死锁。它们用于识别并标记并发 Serializable 事务之间的依赖——某些依赖组合会导致序列化异常。相比之下，想确保数据一致性的 Read Committed 或 Repeatable Read 事务可能不得不对整张表加锁（可能阻塞其他想用这张表的用户），或使用 `SELECT FOR UPDATE` / `SELECT FOR SHARE`（不仅可能阻塞其他事务，还会造成磁盘访问）。

PostgreSQL 的谓词锁与多数其他数据库系统一样，基于事务实际访问的数据。它们会以 `SIReadLock` 模式出现在 [`pg_locks`](https://www.postgresql.org/docs/current/view-pg-locks.html) 系统视图中。查询执行期间获取的具体锁取决于查询计划；多个细粒度锁（如元组锁）可能在事务过程中合并为更少的粗粒度锁（如页锁），以防跟踪锁的内存耗尽。`READ ONLY` 事务若检测到不可能再发生会导致序列化异常的冲突，可以在完成前释放 SIRead 锁。实际上 `READ ONLY` 事务常常在启动时就能确立这一点，从而完全避免取谓词锁。若显式请求 `SERIALIZABLE READ ONLY DEFERRABLE` 事务，它会阻塞到能确立这一点为止（这是 Serializable 事务阻塞而 Repeatable Read 事务不阻塞的**唯一**情形）。另一方面，SIRead 锁常需要保留到事务提交之后，直到重叠的读写事务完成。

坚持使用 Serializable 事务能简化开发。"成功提交的任何一组并发 Serializable 事务，其效果都与逐个串行执行相同"——这个保证意味着：只要能证明单个事务按所写逻辑单独运行时是对的，就可以确信它在 Serializable 事务的任意混合中也是对的——哪怕对其他事务可能做什么一无所知；否则它不会成功提交。使用这种技术的环境必须有处理序列化失败的通用办法（其 SQLSTATE 恒为 '40001'），因为要精确预测哪些事务会参与读/写依赖、需要回滚以防止序列化异常，非常困难。监视读/写依赖有成本，以序列化失败终止的事务重启也有成本；但与显式锁和 `SELECT FOR UPDATE`/`SELECT FOR SHARE` 的成本及阻塞相比，对某些环境而言 Serializable 事务是性能最优选择。

虽然 PostgreSQL 的 Serializable 隔离级别只允许"能证明存在产生相同效果的串行执行顺序"的并发事务提交，但它并不总能避免真正串行执行中不会出现的错误。特别是：即使插入前显式检查过键不存在，仍可能看到与重叠 Serializable 事务冲突导致的唯一约束冲突。避免方法是确保**所有**插入潜在冲突键的 Serializable 事务都显式先检查能否插入。例如应用让用户提供新键并先 select 检查不存在，或先 select 现有最大键再加一。若有 Serializable 事务不遵守这一协议直接插入新键，即使串行执行并发事务不会出现唯一约束冲突，也可能被报出。

依赖 Serializable 事务做并发控制时，为获得最优性能应考虑：

- 尽可能把事务声明为 `READ ONLY`。
- 控制活跃连接数，必要时用连接池。这永远是很重要的性能考量，在使用 Serializable 事务的繁忙系统中尤其如此。
- 单个事务里不要放超出完整性所需的内容。
- 不要让连接长时间悬在"事务内空闲"状态。可用配置参数 [idle_in_transaction_session_timeout](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-IDLE-IN-TRANSACTION-SESSION-TIMEOUT) 自动断开滞留会话。
- 由于 Serializable 事务自动提供的保护而不再需要显式锁、`SELECT FOR UPDATE`、`SELECT FOR SHARE` 时，消除它们。
- 当系统因谓词锁表内存不足，被迫把多个页级谓词锁合并为单个关系级谓词锁时，序列化失败率可能上升。可以通过增大 [max_pred_locks_per_transaction](https://www.postgresql.org/docs/current/runtime-config-locks.html#GUC-MAX-PRED-LOCKS-PER-TRANSACTION)、[max_pred_locks_per_relation](https://www.postgresql.org/docs/current/runtime-config-locks.html#GUC-MAX-PRED-LOCKS-PER-RELATION) 和/或 [max_pred_locks_per_page](https://www.postgresql.org/docs/current/runtime-config-locks.html#GUC-MAX-PRED-LOCKS-PER-PAGE) 避免。
- 顺序扫描总是需要关系级谓词锁，可能导致序列化失败率上升。降低 [random_page_cost](https://www.postgresql.org/docs/current/runtime-config-query.html#GUC-RANDOM-PAGE-COST) 和/或提高 [cpu_tuple_cost](https://www.postgresql.org/docs/current/runtime-config-query.html#GUC-CPU-TUPLE-COST) 以鼓励使用索引扫描可能有帮助。请把事务回滚与重启的减少，与查询执行时间的总体变化放在一起权衡。

Serializable 隔离级别用学术文献中称为 Serializable Snapshot Isolation（可串行化快照隔离）的技术实现——在快照隔离之上增加序列化异常检查。与使用传统加锁技术的其他系统相比，行为与性能可能有差异。详见官方文献 [ports12]。

## 与 ACID 四要素的对应（编者按）

**表：教程概念与 ACID 四要素对应**

| 要素 | 教程中的对应表述 |
| --- | --- |
| 原子性（Atomicity） | "它要么完整发生，要么根本没发生"；中途出错则已执行步骤一概不生效 |
| 一致性（Consistency） | 事务把数据库从一个一致状态带到另一个一致状态（如转账总额不变）；由约束与事务语义共同保证 |
| 隔离性（Isolation） | "多个事务并发运行时，任何一个都不应看到其他事务未完成的修改" |
| 持久性（Durability） | "事务被报告完成之前，其全部更新都已写入永久存储（磁盘）日志" |

> 站内提示：《SQLAlchemy ORM 入门（2.0 风格，含连接池）》的连接层会讲到"事务与 DBAPI 的协作"——应用代码里 `with engine.begin() as conn:` 的每一行,背后都是本篇的 `BEGIN`/`COMMIT`。

---

> **来源**：本文翻译自 [3.4. Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。
> "隔离级别与 MVCC"一节翻译自同一作者同一许可的官方文档第 13 章 Concurrency Control：[章引言](https://www.postgresql.org/docs/current/mvcc.html)、[13.1. Introduction](https://www.postgresql.org/docs/current/mvcc-intro.html)、[13.2. Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)（含 13.2.1–13.2.3 三个小节全文）。

---

> **编者按**：原文按官方教程行文，未直接使用 ACID 缩写；本文在文末补充了教程概念与 ACID（原子性、一致性、隔离性、持久性）四要素的对应关系，便于与教材术语互认。
