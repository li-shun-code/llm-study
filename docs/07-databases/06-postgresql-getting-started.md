---
title: PostgreSQL 入门
source_url: https://www.postgresql.org/docs/current/tutorial-createdb.html
author: PostgreSQL Global Development Group
license: PostgreSQL Licence
fetched_at: 2026-09-13
translated: true
versions: PostgreSQL 18 官方教程（第 1 章 1.2、1.3 节）
order: 6
group: PostgreSQL 与工程化
---
## 系统架构基础

继续之前，你应当了解 PostgreSQL 的基本系统架构——理解各部分如何交互，后面的内容会清晰许多。

用数据库行话说，PostgreSQL 采用客户端/服务器（Client/Server）模型。一次 PostgreSQL 会话由以下协作进程（程序）组成：

- **服务器进程（Server Process）**：管理数据库文件、接受客户端应用的连接、代表客户端执行数据库操作。数据库服务器程序名为 `postgres`。
- **用户的客户端（前端）应用**：想执行数据库操作的程序。客户端的性质可以非常多样——文本工具、图形应用、为显示网页而访问数据库的 Web 服务器、专门的数据库维护工具等。PostgreSQL 发行版自带一些客户端，多数则由用户开发。

典型的客户端/服务器架构：客户端与服务器可以位于不同主机，此时它们通过 TCP/IP 网络连接通信。请记住这一点——客户端机器上能访问的文件，在数据库服务器上未必可访问（或只能以不同文件名访问）。

PostgreSQL 服务器可以处理来自客户端的多个并发连接：它为**每个连接**"分叉（fork）"一个新进程，此后客户端与新服务器进程直接通信，不再经过原始 `postgres` 进程。于是，监督进程 `postgres` 始终运行、等待客户端连接，而客户端与相应的服务器进程则来了又走。（这一切对用户不可见，仅为完整性而提及。）

## 创建数据库

检验能否访问数据库服务器的第一个测试，就是创建一个数据库。运行中的 PostgreSQL 服务器可以管理多个数据库；通常每个项目或每个用户使用单独的数据库。

站点管理员可能已经为你建好了库，那就可以跳过这一步。

从命令行创建新数据库（本例命名 `mydb`）：

```text
$ createdb mydb
```

没有任何输出即代表成功，可以跳过本节余下内容。

**若提示 `createdb: command not found`**：PostgreSQL 没装好——要么没安装，要么 shell 的搜索路径没包含它。可以试用绝对路径调用：

```text
$ /usr/local/pgsql/bin/createdb mydb
```

你站点的路径可能不同，请对照安装说明修正。

**若提示连接失败**（大意：连接套接字 `/tmp/.s.PGSQL.5432` 失败：No such file or directory，服务器是否在本地运行并接受该套接字上的连接？）：说明服务器未启动，或没有监听在 `createdb` 预期的位置。请查安装说明或咨询管理员。

**若提示 `role "joe" does not exist`**（含你自己的登录名）：管理员还没有为你创建 PostgreSQL 用户账户——注意 PostgreSQL 用户账户与操作系统用户账户是彼此独立的（原文脚注：连接数据库时可以指定以哪个 PostgreSQL 用户名连接，缺省用当前操作系统账户同名账户；以启动服务器的操作系统用户同名命名的 PostgreSQL 账户总是存在，且总有建库权限；也可随处用 `-U` 选项指定 PostgreSQL 用户名）。创建首个用户账户需要切换到安装 PostgreSQL 的操作系统用户（通常是 `postgres`）；如果你被分配了与操作系统用户名不同的 PostgreSQL 用户名，需要用 `-U` 开关或 `PGUSER` 环境变量指定。

**若提示 `permission denied to create database`**：并非每个用户都有建库授权，需要管理员授予。自己安装的 PostgreSQL，建议用启动服务器的那个用户账户登录来做本教程（同上脚注）。

数据库可以用任何名字创建：首字符必须是字母，长度上限 63 字节。一个方便的选择是用与当前用户名相同的名字建库——许多工具默认采用它，能省点输入：

```text
$ createdb
```

不再需要某个数据库时可以删除它。例如你是 `mydb` 的所有者（创建者）：

```text
$ dropdb mydb
```

（这条命令的数据库名**不会**默认取用户账户名，必须显式给出。）删除会物理移除与数据库关联的所有文件、不可撤销，务必三思。更多细节见官方文档 `createdb` 与 `dropdb` 页。

## 本地快速跑起来（站内补充）

> 以下为本站编者补充的最小实践路径，便于在本地跟上本模块后续文章。

最省事的方式是 Docker（详见「Python 进阶与框架」的容器化章节）：

```bash
docker run --name pg-learn -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:18
```

然后用官方客户端 `psql`（或容器内的同名程序）连接：

```bash
psql -h localhost -U postgres
```

`psql` 是随发行版发布的交互式终端客户端：提示符下输入 SQL（分号结尾）回车即执行，`\l` 列出数据库、`\dt` 列出表、`\q` 退出。配合本「Python 进阶与框架」-07 篇的 SQL 示例，即可完整练手。

---

> **来源**：本文翻译自 [1.3. Creating a Database](https://www.postgresql.org/docs/current/tutorial-createdb.html)，作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。

---

> **补充来源**：本文"系统架构基础"一节翻译自同一教程的 [1.2. Architectural Fundamentals](https://www.postgresql.org/docs/current/tutorial-arch.html)，许可同上；"本地快速跑起来"小节为本站编者补充。
