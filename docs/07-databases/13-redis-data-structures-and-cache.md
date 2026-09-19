---
title: Redis 核心数据结构与缓存
source_url: https://redis.io/docs/latest/develop/data-types/
author: Redis Ltd.（redis-doc 文档仓库）
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: true
versions: Redis 官方文档当前版（redis-doc 仓库，CC BY-SA 4.0）
order: 13
group: 缓存与文档型存储
---
## Redis 是数据结构服务器

Redis 的核心是一组原生数据类型（Data Types），帮助你解决从缓存（Caching）、队列（Queuing）到事件处理（Event Processing）的各类问题。理解这些数据结构，比把它当"纯 KV 缓存"更能发挥其价值。

除下文的核心类型外，Redis 还提供地理空间索引（Geospatial Indexes）、位图（Bitmaps）、位域（Bitfields）、HyperLogLog（基数概率估计）与 Streams（追加日志式事件流），并支持 Lua 服务端脚本与模块扩展。

## 键的规则

Redis 键是二进制安全的：从 `"foo"` 到一张 JPEG 的内容都可以作键，空串也是合法键。但官方给出几条经验：

- **很长的键不是好主意**：1024 字节的键不仅费内存，查找时的键比较也可能很昂贵；即使要匹配大值的存在性，也宁可先哈希（如 SHA1）。
- **过短的键同样不好**：与其写 `u1000flw`，不如写 `user:1000:followers`——可读性更重要，多出的空间相对键/值对象本身微不足道。
- **坚持统一的键命名模式**：如 `object-type:id`（`user:1000`）；多词字段常用点或连字符：`comment:4321:reply.to`。
- 键最大 512 MB。

操作键空间本身（与类型无关）的命令：`EXISTS` 返回键是否存在（1/0），`DEL` 删除键，`TYPE` 返回键存值的类型（`string`、`none` 等）。

## Strings（字符串）

字符串存字节序列：文本、序列化对象、二进制数组都可以，是Redis 键能关联的最简单值类型。常用于缓存（如缓存 HTML 片段或页面），也支持计数器与位运算。`SET` 是赋值——键已存在时会替换旧值（哪怕旧值不是字符串）：

```text
> SET bike:1 Deimos
OK
> GET bike:1
"Deimos"
```

`SET` 有实用选项：`NX`（键不存在才成功）与 `XX`（键已存在才成功）：

```text
> set bike:1 bike nx
(nil)
> set bike:1 bike xx
OK
```

`SETNX`（不存在才写入）是实现锁的常用原子原语。`MSET`/`MGET` 一条命令设置/取回多个键，降低往返延迟：

```text
> mset bike:1 "Deimos" bike:2 "Ares" bike:3 "Vanth"
OK
> mget bike:1 bike:2 bike:3
1) "Deimos"
2) "Ares"
3) "Vanth"
```

### 字符串当计数器

```text
> set total_crashes 0
OK
> incr total_crashes
(integer) 1
> incrby total_crashes 10
(integer) 11
```

`INCR` 把字符串值解析为整数、加一、再写回；同族命令有 `INCRBY`、`DECR`、`DECRBY`、浮点版 `INCRBYFLOAT`。

**INCR 的"原子"是什么意思？**即使多个客户端对同一键并发 INCR 也绝不会进入竞态：不会出现客户端 1 和 2 都读到 "10"、都加成 11、都写回 11 的情况——最终值总是 12。"读取-递增-写回"在整个操作期间，其他客户端无法同时执行命令。

性能上，大多数字符串操作是 O(1)；但 `SUBSTR`、`GETRANGE`、`SETRANGE` 可能 O(n)，大字符串上的随机访问命令要小心。若存的是序列化后的结构化数据，可考虑改用 Hash 或 JSON。

## Lists（列表）

Redis 列表是字符串值的链表，常用来实现栈和队列、为后台 worker 系统构建队列管理。

**基础命令**：`LPUSH` 头部插入 / `RPUSH` 尾部插入；`LPOP`/`RPOP` 从头/尾弹出；`LLEN` 取长度；`LMOVE` 在两个列表之间原子搬运元素；`LTRIM` 把列表裁剪到指定区间。还支持**阻塞命令**：`BLPOP` 在列表为空时阻塞等待元素到来（或超时）；`BLMOVE` 在源列表为空时阻塞等待。

```text
> RPUSH bikes:repairs bike:1
(integer) 1
> RPUSH bikes:repairs bike:2
(integer) 2
> LPUSH bikes:repairs bike:important_bike
(integer) 3
> LRANGE bikes:repairs 0 -1
1) "bike:important_bike"
2) "bike:1"
3) "bike:2"
```

`LRANGE` 的两个下标可为负：-1 是最后一个元素，-2 是倒数第二个。`RPUSH`/`LPUSH` 都是**变长命令**，一次可推入多个元素。弹出（Pop）则同时完成"取回并删除"：

```text
> RPUSH bikes:repairs bike:1 bike:2 bike:3
(integer) 3
> RPOP bikes:repairs
"bike:3"
> LPOP bikes:repairs
"bike:1"
> RPOP bikes:repairs
"bike:2"
> RPOP bikes:repairs
(nil)
```

队列（先进先出）用 `LPUSH` + `RPOP`；栈（先进后出）用 `LPUSH` + `LPOP`。`LMOVE` 可原子地"从源列表弹出、压入目标列表"，是构建可靠任务队列的关键件。

原文解释了为什么用链表实现：即便列表里有上千万元素，头部/尾部插入也是常数时间；代价是按下标访问需要与下标成正比的工作量。若需要快速访问大集合中部，请用有序集合。两个典型用例：社交网络"最新更新"（发照片时 `LPUSH` 照片 ID，首页用 `LRANGE 0 9` 取最新 10 条）；生产者-消费者模式（Ruby 的 resque 与 sidekiq 底层都用 Redis 列表实现后台任务）。只存"最新 N 条"的场景用 `LTRIM` 做封顶列表（Capped List）。

## Sets（集合）

Redis 集合是无序的唯一字符串（成员）集合，可高效地：跟踪唯一元素（如访问某博客的唯一 IP）、表示关系（某角色的全部用户）、执行交/并/差等集合运算。添加、删除、存在性判断都是 O(1)。

```text
> SADD bikes:racing:france bike:1
(integer) 1
> SADD bikes:racing:france bike:1
(integer) 0
> SADD bikes:racing:usa bike:1 bike:4
(integer) 2
> SISMEMBER bikes:racing:usa bike:1
(integer) 1
> SISMEMBER bikes:racing:usa bike:2
(integer) 0
> SINTER bikes:racing:france bikes:racing:usa
1) "bike:1"
> SCARD bikes:racing:france
(integer) 3
```

注意重复添加已存在成员会被忽略（返回 0）。`SMEMBERS` 返回全部成员但**没有顺序保证**；`SMISMEMBER` 可批量判断成员关系；`SDIFF` 求差集（参数顺序有意义，差运算不可交换）；`SUNION` 求并集。删除用 `SREM`；`SPOP` 随机弹出；`SRANDMEMBER` 只随机返回不删除。

## Hashes（哈希）

哈希是由字段-值对（Field-Value Pair）构成的记录类型，类似 Python 字典 / Java HashMap，可表示基本对象、存放计数器组：

```text
> HSET bike:1 model Deimos brand Ergonom type 'Enduro bikes' price 4972
(integer) 4
> HGET bike:1 model
"Deimos"
> HGETALL bike:1
1) "model"
2) "Deimos"
3) "brand"
4) "Ergonom"
5) "type"
6) "Enduro bikes"
7) "price"
8) "4972"
```

`HSET` 设置一个或多个字段；`HGET` 取单字段；`HMGET` 返回值数组（不存在的字段为 nil）；`HINCRBY` 对字段做整数增量：

```text
> HMGET bike:1 model price no-such-field
1) "Deimos"
2) "4972"
3) (nil)
> HINCRBY bike:1 price 100
(integer) 5072
```

哈希表示对象很方便，字段数除内存外没有实际上限。小组哈希在内存中以特殊方式编码，非常省内存。大多数字段操作 O(1)；`HKEYS`、`HVALS`、`HGETALL` 是 O(n)（n 为字段-值对数）。每个哈希最多 2^32 − 1 个字段-值对。

## Sorted Sets（有序集合）

有序集合是由唯一字符串（成员）按关联分数（Score）排序的集合；同分时按字典序。可以把它理解为集合与哈希的混合体——成员唯一，但每个成员都映射到一个浮点分数，且元素**按序存放**（顺序是数据结构本身的属性，不是查询时才排）。典型用例：排行榜（维护海量在线游戏的最高分榜）、限流器（如滑动窗口限流）。

```text
> ZADD racer_scores 10 "Norem"
(integer) 1
> ZADD racer_scores 12 "Castilla"
(integer) 1
> ZADD racer_scores 8 "Sam-Bodden" 10 "Royce" 6 "Ford" 14 "Prickett"
(integer) 4
> ZRANGE racer_scores 0 -1
1) "Ford"
2) "Sam-Bodden"
3) "Norem"
4) "Royce"
5) "Castilla"
6) "Prickett"
> ZREVRANGE racer_scores 0 -1
1) "Prickett"
2) "Castilla"
...
```

`ZADD` 类似 `SADD` 但多一个分数参数（也支持变长）；`ZRANGE` 按分数从低到高返回，`ZREVRANGE` 反向；`WITHSCORES` 可一并返回分数。实现说明：有序集合由跳表（Skip List）与哈希表共同承载——每次添加是 O(log(N))，但读取已排序元素几乎无需再算。

## 键过期与 TTL：缓存的地基

键过期（Expiration）是与值类型无关的重要特性：为键设置超时，即"存活时间"（TTL，Time To Live），时间一到键自动销毁。要点：

- 可以用秒或毫秒精度设置（`EXPIRE`/`PEXPIRE`）；过期时间分辨率恒为 1 毫秒。
- 过期信息会被复制并持久化到磁盘——Redis 存的是"到期的绝对时刻"，服务器停机期间时间照样流逝。

```text
> set key some-value
OK
> expire key 5
(integer) 1
> get key      （立即执行）
"some-value"
> get key      （稍后执行）
(nil)
```

`EXPIRE` 也可给已有过期的键改时间；`PERSIST` 移除过期让键永存。许多命令自带过期选项——`SET` 的 `EX` 选项直接建带 TTL 的键，`TTL` 查询剩余秒数（毫秒版 `PTTL`）：

```text
> set key 100 ex 10
OK
> ttl key
(integer) 9
```

遍历键空间时用 `SCAN` 增量迭代（每次只返回少量元素），避免 `KEYS`/`SMEMBERS` 这类可能长时间阻塞服务器的命令。**原文严厉警告：把 `KEYS` 视作只能在生产环境极端谨慎使用的命令——大库上执行会毁掉性能；它面向调试与特殊操作，不要写进常规应用代码。**

## 缓存模式（站内补充）

> 以下为编者结合上述官方能力整理的最常用缓存套路，便于落地。

- **Cache-Aside（旁路缓存）**：读请求先查 Redis；未命中则查数据库、回写 Redis 并设置 TTL；写请求更新数据库后删除（而非更新）缓存。这是 LLM 应用缓存"系统提示词渲染结果、用户会话元数据、高频 API 响应"的默认方案。
- **TTL 的选择**：短 TTL 换取新鲜度，长 TTL 换取命中率；结合 `SET ... EX` 一次写入，避免"先 SET 再 EXPIRE"的竞态。
- **计数与限流**：`INCR` + `EXPIRE` 实现固定窗口限流；有序集合成员存时间戳可实现滑动窗口限流。
- **阻塞队列**：`LPUSH` + `BLPOP`（或 `LMOVE` 双列表）把异步任务（如批量 embedding、长文摘要）从 API 进程转交 worker。

---

> **来源**：本文翻译自 [Redis data types（数据类型总览）](https://redis.io/docs/latest/develop/data-types/)，作者 Redis Ltd.（redis-doc 文档仓库），许可 CC BY-SA 4.0。抓取于 2026-09-13。

---

> **补充来源**：本文各数据结构小节与"键与过期"一节分别编译自同一官方文档仓库的 [Strings](https://redis.io/docs/latest/develop/data-types/strings/)、[Lists](https://redis.io/docs/latest/develop/data-types/lists/)、[Sets](https://redis.io/docs/latest/develop/data-types/sets/)、[Hashes](https://redis.io/docs/latest/develop/data-types/hashes/)、[Sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) 与 [Keyspace](https://redis.io/docs/latest/develop/use/keyspace/) 页（示例中的 clients-example 模板标记为原文档的客户端选择器（大括号模板语法已省略），此处统一采用 redis-cli 形式），许可同上；文末"缓存模式"小节为本站编者补充。
