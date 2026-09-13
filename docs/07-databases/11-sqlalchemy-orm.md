---
title: SQLAlchemy ORM 入门（2.0 风格，含连接池）
source_url: https://docs.sqlalchemy.org/en/20/orm/quickstart.html
author: SQLAlchemy authors and contributors
license: MIT
fetched_at: 2026-09-13
translated: true
order: 11
versions: SQLAlchemy 2.0.52（当前稳定版；全文使用 2.0 风格 API，不涉及遗留 Query API）
---
SQLAlchemy 是 Python 生态最主流的 ORM（Object-Relational Mapper，对象关系映射器）。本篇以 SQLAlchemy 2.0 的现代写法（类型注解 + `mapped_column()` + `select()`）走通 ORM 的完整流程：声明模型 → 建 Engine → 建表 → 增 → 查（含 JOIN） → 改 → 删。

> 2.0 变更提示：ORM 快速上手已更新为支持 PEP 484 类型注解的新写法（`DeclarativeBase`、`Mapped`、`mapped_column()`）。网上大量教程仍用 1.x 的 `Query` 对象（`session.query(...)`）风格，学习时请认准 2.0 风格。

## 声明模型

先定义模块级结构，它们既是 Python 对象模型，也是描述真实 SQL 表的数据库元数据（Declarative Mapping，声明式映射）：

```python
>>> from typing import List
>>> from typing import Optional
>>> from sqlalchemy import ForeignKey
>>> from sqlalchemy import String
>>> from sqlalchemy.orm import DeclarativeBase
>>> from sqlalchemy.orm import Mapped
>>> from sqlalchemy.orm import mapped_column
>>> from sqlalchemy.orm import relationship

>>> class Base(DeclarativeBase):
...     pass

>>> class User(Base):
...     __tablename__ = "user_account"
...
...     id: Mapped[int] = mapped_column(primary_key=True)
...     name: Mapped[str] = mapped_column(String(30))
...     fullname: Mapped[Optional[str]]
...
...     addresses: Mapped[List["Address"]] = relationship(
...         back_populates="user", cascade="all, delete-orphan"
...     )
...
...     def __repr__(self) -> str:
...         return f"User(id={self.id!r}, name={self.name!r}, fullname={self.fullname!r})"

>>> class Address(Base):
...     __tablename__ = "address"
...
...     id: Mapped[int] = mapped_column(primary_key=True)
...     email_address: Mapped[str]
...     user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"))
...
...     user: Mapped["User"] = relationship(back_populates="addresses")
...
...     def __repr__(self) -> str:
...         return f"Address(id={self.id!r}, email_address={self.email_address!r})"
```

映射从基类开始：`Base` 通过继承 `DeclarativeBase` 创建。各个映射类是 `Base` 的子类，通常对应一张具体的表，表名用类级属性 `__tablename__` 指示。

表的列通过带 `Mapped` 类型注解的属性声明：属性名对应列名；列的 SQL 类型优先从注解的 Python 类型推导（`int` → `INTEGER`、`str` → `VARCHAR`），可空性取决于是否使用 `Optional[]`；需要更精确的类型时，在 `mapped_column()` 右侧写 SQLAlchemy 类型对象（如上面的 `String`）。`mapped_column()` 接受 `Column` 参数的超集，包括服务器默认值、约束信息（主键成员、外键等）。所有映射类都必须至少声明一个主键列。

"表名字符串 + 一组列声明"的组合在 SQLAlchemy 中称为表元数据（Table Metadata）。上例属于"注解式声明表"（Annotated Declarative Table）配置。

与列属性相对，`relationship()` 表示两个 ORM 类之间的关联：`User.addresses` 把 `User` 链到 `Address`，`Address.user` 反向链回。示例类还带了 `__repr__()` 方法——不是必需，但方便调试；用 dataclasses 映射可以自动生成。

## 创建 Engine

`Engine` 是为我们创建新数据库连接的**工厂**，同时把连接保存在**连接池（Connection Pool）**中以便快速复用。学习场景通常用内存 SQLite：

```python
>>> from sqlalchemy import create_engine
>>> engine = create_engine("sqlite://", echo=True)
```

`echo=True` 表示连接发出的 SQL 会记录到标准输出。

### Engine 与连接池（补充译文）

每个连接数据库的 SQLAlchemy 应用都要用到 `Engine`。它是通向特定数据库的连接的中央源头：既是工厂，又是名为连接池的"存放处"。Engine 通常是对特定数据库服务器**只创建一次的全局对象**，用 URL 字符串配置：

```python
>>> engine = create_engine("sqlite+pysqlite:///:memory:", echo=True)
```

URL 说明了三件事：

1. **连的是什么数据库**——`sqlite` 部分，对应 SQLAlchemy 的方言（Dialect）；
2. **用什么 DBAPI 驱动**——Python DBAPI 是 SQLAlchemy 用来与具体数据库交互的第三方驱动，这里 `pysqlite` 对应标准库的 `sqlite3` 模块（省略时用该数据库的默认驱动）；
3. **如何定位数据库**——`/:memory:` 表示只用内存库，无需服务器也不建文件。

注意 Engine 是**懒连接**（Lazy Connecting）的：`create_engine()` 返回时并未真正连库，第一次被要求执行任务时才会连接。

### 连接池怎么配（站内补充）

> 以下为编者按官方 Pooling 文档整理的最小配置说明，生产接 PostgreSQL/MySQL 时常用：

```python
engine = create_engine(
    "postgresql+psycopg://user:pass@localhost/db",
    pool_size=5,          # 常驻连接数
    max_overflow=10,      # 高峰允许临时多开的连接数
    pool_timeout=30,      # 等待连接的秒数
    pool_pre_ping=True,   # 取连接前探活，避免拿到已被服务器断开的连接
)
```

Web 服务（如 FastAPI）中，Engine 应随应用进程只建一次，请求处理器内用 `Session`/连接短借短还——这正是连接池存在的意义：建立 TCP 与认证的开销摊销到多次请求。详见官方文档 Connection Pooling 页。

## 生成建表 DDL

用表元数据与 Engine，一次性在目标库生成 schema：

```python
>>> Base.metadata.create_all(engine)
```

```sql
BEGIN (implicit)
CREATE TABLE user_account (
    id INTEGER NOT NULL,
    name VARCHAR(30) NOT NULL,
    fullname VARCHAR,
    PRIMARY KEY (id)
)
CREATE TABLE address (
    id INTEGER NOT NULL,
    email_address VARCHAR NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY(user_id) REFERENCES user_account (id)
)
COMMIT
```

## 创建对象并持久化

创建 `User` 与 `Address` 的实例（声明式映射已自动生成 `__init__()`），通过 `Session` 交给数据库：`Session.add_all()` 一次加多个对象，`Session.commit()` 把挂起的修改 flush（刷写）到数据库并提交当前事务——只要在用 `Session`，事务就一直处于进行中：

```python
>>> from sqlalchemy.orm import Session

>>> with Session(engine) as session:
...     spongebob = User(
...         name="spongebob",
...         fullname="Spongebob Squarepants",
...         addresses=[Address(email_address="spongebob@sqlalchemy.org")],
...     )
...     sandy = User(
...         name="sandy",
...         fullname="Sandy Cheeks",
...         addresses=[
...             Address(email_address="sandy@sqlalchemy.org"),
...             Address(email_address="sandy@squirrelpower.org"),
...         ],
...     )
...     patrick = User(name="patrick", fullname="Patrick Star")
...
...     session.add_all([spongebob, sandy, patrick])
...
...     session.commit()
```

```sql
BEGIN (implicit)
INSERT INTO user_account (name, fullname) VALUES (?, ?) RETURNING id
[...] ('spongebob', 'Spongebob Squarepants')
INSERT INTO user_account (name, fullname) VALUES (?, ?) RETURNING id
[...] ('sandy', 'Sandy Cheeks')
INSERT INTO user_account (name, fullname) VALUES (?, ?) RETURNING id
[...] ('patrick', 'Patrick Star')
INSERT INTO address (email_address, user_id) VALUES (?, ?) RETURNING id
[...] ('spongebob@sqlalchemy.org', 1)
INSERT INTO address (email_address, user_id) VALUES (?, ?) RETURNING id
[...] ('sandy@sqlalchemy.org', 2)
INSERT INTO address (email_address, user_id) VALUES (?, ?) RETURNING id
[...] ('sandy@squirrelpower.org', 2)
COMMIT
```

官方建议像上面这样用上下文管理器（`with:`）使用 `Session`——它代表活跃的数据库资源，一组操作完成后确保关闭总是好的。

## 简单 SELECT

用 `select()` 函数构造 `Select` 对象，再通过 `Session` 执行。查询 ORM 对象时常用 `Session.scalars()`，它返回可迭代出 ORM 对象的 `ScalarResult`：

```python
>>> from sqlalchemy import select

>>> session = Session(engine)

>>> stmt = select(User).where(User.name.in_(["spongebob", "sandy"]))

>>> for user in session.scalars(stmt):
...     print(user)
```

```sql
SELECT user_account.id, user_account.name, user_account.fullname
FROM user_account
WHERE user_account.name IN (?, ?)
[...] ('spongebob', 'sandy')
```

```text
User(id=1, name='spongebob', fullname='Spongebob Squarepants')
User(id=2, name='sandy', fullname='Sandy Cheeks')
```

`Select.where()` 追加 WHERE 条件；`ColumnOperators.in_()` 使用 SQL 的 IN 运算符。

## 带 JOIN 的 SELECT

跨表查询用 `Select.join()`：

```python
>>> stmt = (
...     select(Address)
...     .join(Address.user)
...     .where(User.name == "sandy")
...     .where(Address.email_address == "sandy@sqlalchemy.org")
... )
>>> sandy_address = session.scalars(stmt).one()
```

```sql
SELECT address.id, address.email_address, address.user_id
FROM address JOIN user_account ON user_account.id = address.user_id
WHERE user_account.name = ? AND address.email_address = ?
[...] ('sandy', 'sandy@sqlalchemy.org')
```

```text
Address(id=2, email_address='sandy@sqlalchemy.org')
```

多个 WHERE 条件自动用 AND 串联；`User.name == "sandy"` 利用重载的 `__eq__()` 生成 SQL 条件对象。

## 修改

`Session` 配合映射类自动追踪对象的变化，并在下次 flush 时生成相应 SQL。取出 patrick 的行，给他加一个新邮箱，并修改 sandy 的一个邮箱：

```python
>>> stmt = select(User).where(User.name == "patrick")
>>> patrick = session.scalars(stmt).one()

>>> patrick.addresses.append(Address(email_address="patrickstar@sqlalchemy.org"))

>>> sandy_address.email_address = "sandy_cheeks@sqlalchemy.org"

>>> session.commit()
```

```sql
UPDATE address SET email_address=? WHERE address.id = ?
[...] ('sandy_cheeks@sqlalchemy.org', 2)
INSERT INTO address (email_address, user_id) VALUES (?, ?)
[...] ('patrickstar@sqlalchemy.org', 3)
COMMIT
```

注意访问 `patrick.addresses` 时发出了一条 SELECT——这叫**懒加载（Lazy Load）**。

## 删除

两种删除形式，分别适配不同场景。

其一，把某个 `Address` 对象从 sandy 的集合里移除——下次 flush 时该行会被删除（这是我们映射时配置的**级联删除** delete-cascade 行为）。用 `Session.get()` 按主键取出 sandy，再操作对象：

```python
>>> sandy = session.get(User, 2)

>>> sandy.addresses.remove(sandy_address)
```

上面的 SELECT 是懒加载，为的是装载 `sandy.addresses` 集合以便移除成员。可以再用 `Session.flush()` 只发 DELETE 语句而不提交事务：

```python
>>> session.flush()
```

```sql
DELETE FROM address WHERE address.id = ?
[...] (2,)
```

其二，整体删除 patrick 这个用户。顶层删除用 `Session.delete()`：它并不真正执行删除，而是安排对象在下次 flush 时删除，并按配置的级联选项波及关联对象（这里是关联的 `Address`）：

```python
>>> session.delete(patrick)

>>> session.commit()
```

```sql
DELETE FROM address WHERE address.id = ?
[...] (4,)
DELETE FROM user_account WHERE user_account.id = ?
[...] (3,)
COMMIT
```

（原文提示：`session.delete(patrick)` 时会先发出 SELECT——因为上次 `commit()` 后对象已过期（Expired），需要在新事务里重新加载；这种过期机制是可选的，不适用时通常会把它关掉。）

> 站内提示：本站模块 6/8 的实战项目（FastAPI 服务、RAG 落库）都默认用 SQLAlchemy 2.0 风格访问 SQLite/PostgreSQL；把本篇的 `Session(engine)` 与 07 篇的事务概念对照着看，`commit()` 之前的每一步 flush 都是可回滚的。

---

> **来源**：本文翻译自 [ORM Quick Start](https://docs.sqlalchemy.org/en/20/orm/quickstart.html)，作者 SQLAlchemy authors and contributors，许可 MIT。抓取于 2026-09-13。

---

> **补充来源**：本文"Engine 与连接池"一节编译自统一教程首篇 [Establishing Connectivity - the Engine](https://docs.sqlalchemy.org/en/20/tutorial/engine.html)，许可同上；其中"连接池怎么配"小节为本站编者补充。示例代码与文档输出保持原样（`>>>` 为 REPL 提示符）。
