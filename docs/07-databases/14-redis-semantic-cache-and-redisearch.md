---
title: Redis 语义缓存与 RediSearch（含向量检索）
source_url: https://redis.io/docs/latest/develop/interact/search-and-query/
author: Redis Ltd.（redis/docs 文档仓库）
license: CC BY-SA 4.0
fetched_at: 2026-09-13
translated: true
order: 14
versions: redis/docs 仓库当前版（Redis 8 / Redis Open Source，含 Redis Search 与语义缓存用例指南）
---
## Redis Search：搜索与查询

Redis Search 通过以下搜索与查询特性提供增强的 Redis 体验：

- 丰富的查询语言
- 对 JSON 与 Hash 文档的增量索引
- 向量检索
- 全文检索
- 地理空间查询
- 聚合

完整功能清单见官方参考文档。借助 Redis Search，可以把 Redis 当作：

- 文档数据库
- 向量数据库
- 二级索引
- 搜索引擎

上手步骤：跟随官方快速上手教程获得初步动手经验；学习如何创建索引；学习如何查询数据；安装 RedisInsight 并连接数据库，用 Redis Copilot 以自然语言提示学习对自身数据执行复杂查询；打开 AI agent builder 选 **Knowledge Assistant** 模板，即可生成一个基于 Redis 向量检索、开箱可用的 RAG agent。

> **提示**：想看真实工作流中的 Redis 向量检索，可以了解 GitHub Action "Redis Repo Memory"——它会在每个 PR 上展示相关的历史 PR、issue 与提交，几分钟即可加入任意仓库。

### 启用 Redis Search

Redis Search 在 Redis Open Source、Redis Software 与 Redis Cloud 中均可用。安装方式见官方"Install Redis Open Source"或"Install Redis Software"文档。

> **注意**：可以在 Redis 官方 playground 中交互式试用 Redis Search，无需安装。

### 许可与源码

Redis 的 Redis Search 特性以 Source Available License 2.0（RSALv2）、Server Side Public License v1（SSPLv1）或 GNU Affero General Public License v3（AGPLv3）提供，详见 [RediSearch 仓库的 LICENSE 文件](https://raw.githubusercontent.com/RediSearch/RediSearch/master/LICENSE.txt)。源码与详细发布说明见 [GitHub 上的 RediSearch 仓库](https://github.com/RediSearch/RediSearch)。

## 向量检索

本文概述如何用 Redis Search（Redis Open Source 的一部分）执行向量检索查询。想进一步了解 Redis 作为向量数据库，见官方"Redis as a vector database"快速上手；所有参数的详细信息见向量参考文档。

对向量字段的向量检索查询，可以在向量空间中找到与给定向量接近的所有向量：既可查 k 近邻（KNN），也可查给定半径内的向量。

> **提示**：要生成使用本文所述向量检索查询的完整 RAG agent，可打开 AI agent builder 选 **Knowledge Assistant** 模板。

本文示例使用如下 schema：

| JSON 字段 | 字段别名 | 字段类型 | 说明 |
| --- | --- | --- | --- |
| `$.description` | `description` | `TEXT` | 自行车描述（非结构化文本） |
| `$.description_embeddings` | `vector` | `VECTOR` | 机器学习模型从描述文本得到的向量 |

### K 近邻（KNN）

Redis 命令 [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) 接受索引名、查询字符串与附加查询参数。需要按如下方式传入近邻数、向量字段名与向量的二进制表示：

```text
FT.SEARCH index "(*)=>[KNN num_neighbours @field $vector]" PARAMS 2 vector "binary_data" DIALECT 2
```

对该查询的更详细解释：

1. **预过滤（Pre-filter）**：圆括号内的第一个表达式是过滤器，决定在执行向量检索前把哪些向量纳入考虑。表达式 `(*)` 表示考虑全部向量。
2. **下一步**：`=>` 箭头表示预过滤发生在向量检索之前。
3. **KNN 查询**：表达式 `[KNN num_neighbours @field $vector]` 是参数化的查询表达式。查询串里 `$` 前缀表示参数名。
4. **向量二进制数据**：需要用 `PARAMS` 参数把 `$vector` 替换为向量的二进制表示。值 `2` 表示 `PARAMS` 后跟两个参数：参数名 `vector` 与参数值。
5. **方言（Dialect）**：向量检索特性从查询方言第 2 版起可用。

`PARAMS` 参数的更多信息见 FT.SEARCH 命令参考。

下面的例子按描述嵌入查询三辆自行车，使用字段别名 `vector`。结果按距离升序返回。可以看到查询只返回 `__vector_score` 与 `description` 字段。`__vector_score` 字段默认存在；由于 schema 可以有多个向量字段，向量得分的字段名取决于向量字段名——把字段名 `@vector` 改成 `@foo`，得分字段名就变成 `__foo_score`。

```text
FT.SEARCH idx:bikes_vss "(*)=>[KNN 3 @vector $query_vector]" PARAMS 2 "query_vector" "Z\xf8\x15:\xf23\xa1\xbfZ\x1dI>\r\xca9..." SORTBY "__vector_score" ASC RETURN 2 "__vector_score" "description" DIALECT 2
```

对应的 Python 查询写法（原文注释给出）：

```python
query = (
    Query('(*)=>[KNN 3 @vector $query_vector]')
     .sort_by('__vector_score')
     .return_fields('__vector_score', 'description')
     .dialect(2)
)
```

> **注意**：上面 CLI 示例中查询向量的二进制值被大幅截短。

### 半径（Radius）

不用近邻数，而是传入半径，连同索引名、向量字段名与向量二进制值：

```text
FT.SEARCH index "@field:[VECTOR_RANGE radius $vector]" PARAMS 2 vector "binary_data" DIALECT 2
```

若想按距离排序，必须通过 range 查询参数 `$YIELD_DISTANCE_AS` 把距离取出来：

```text
FT.SEARCH index "@field:[VECTOR_RANGE radius $vector]=>{$YIELD_DISTANCE_AS: dist_field}" PARAMS 2 vector "binary_data" SORTBY dist_field DIALECT 2
```

对该查询的更详细解释：

1. **范围查询**：半径查询的语法与普通范围查询非常相似，只是多了关键字 `VECTOR_RANGE`。向量半径查询同样可以与其他查询组合，组合方式与普通范围查询一致，详见官方"combined queries"文章。
2. **附加步骤**：`=>` 箭头表示范围查询之后还会求值附加参数。
3. **范围查询参数**：`$YIELD_DISTANCE_AS` 等参数见向量参考文档。
4. **向量二进制数据**：需要用 `PARAMS` 传入向量的二进制表示。
5. **方言**：向量检索从查询方言第 2 版起可用。

> **注意**：默认情况下 [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) 只返回前 10 条结果。如何滚动浏览结果集见官方范围查询文章。

下例是半径 0.5 内、返回描述与距离并按距离排序的查询：

```text
FT.SEARCH idx:bikes_vss "@vector:[VECTOR_RANGE 0.5 $query_vector]=>{$YIELD_DISTANCE_AS: vector_dist}" PARAMS 2 "query_vector" "Z\xf8\x15:\xf23\xa1\xbfZ\x1dI>\r\xca9..." SORTBY vector_dist ASC RETURN 2 vector_dist description DIALECT 2
```

对应的 Python 查询写法：

```python
query = (
    Query('@vector:[VECTOR_RANGE 0.5 $query_vector]=>{$YIELD_DISTANCE_AS: vector_dist}')
     .sort_by('vector_dist')
     .return_fields('vector_dist', 'description')
     .dialect(2)
)
```

### 集群优化

在 Redis 集群环境中，可用 `$SHARD_K_RATIO` 查询属性优化向量检索性能。该参数控制每个分片相对请求的 `top_k` 取回多少结果，在精度与性能之间形成可调的折中。

基本集群优化——取 100 个近邻，每个分片提供请求量的 60%：

```text
FT.SEARCH idx:bikes_vss "(*)=>[KNN 100 @vector $query_vector]=>{$SHARD_K_RATIO: 0.6; $YIELD_DISTANCE_AS: vector_distance}" PARAMS 2 "query_vector" "Z\xf8\x15:\xf23\xa1\xbfZ\x1dI>\r\xca9..." SORTBY vector_distance ASC RETURN 2 "vector_distance" "description" DIALECT 2
```

与过滤结合——把 `$SHARD_K_RATIO` 与预过滤组合，在特定数据子集上做优化检索：

```text
FT.SEARCH idx:bikes_vss "(@brand:trek)=>[KNN 50 @vector $query_vector]=>{$SHARD_K_RATIO: 0.4; $YIELD_DISTANCE_AS: similarity}" PARAMS 2 "query_vector" "Z\xf8\x15:\xf23\xa1\xbfZ\x1dI>\r\xca9..." SORTBY similarity ASC RETURN 2 "similarity" "description" DIALECT 2
```

> **注意**：`$SHARD_K_RATIO` 参数只适用于 Redis 集群环境，对单机 Redis 实例无效。

## 语义缓存：何时用 Redis

当你需要为**语义相似**——而不只是逐字节相同——的查询复用 LLM 响应时，就把 Redis 用作语义缓存：改写过的、近重复的问题可以跳过完整的"嵌入—检索—生成"管线，在几十毫秒内返回一个先前已验证过的答案。

## 为什么这个问题很难

每个到达 LLM 的重复或改写问题都会触发完整管线——嵌入、检索、生成——使单次查询成本比缓存命中高出 10–100 倍，并把 P95 延迟（第 95 百分位延迟）推入数秒区间。一些显而易见的变通办法都有实质缺点：

- **传统精确匹配缓存**（字符串键对应响应）只在查询逐字节相同时命中，会漏掉近重复查询，比如 "What's your return policy?" 与 "How do I return an item?"——而这恰恰是 FAQ 型负载的主力查询。
- **独立向量数据库**能找到相似的历史查询，但对一个本质上属于缓存的问题增加了运维负担；而且多数缺乏一流的 TTL 管理、淘汰与元数据过滤——缓存要在数据变动下保持正确，正需要这些特性。
- **不用缓存、依赖模型供应商的 prompt 缓存**只对重复的**前缀**打折，每次调用仍要端到端跑模型，既不解决延迟，也不能跨用户复用完整响应。

核心难点是阈值调校：太松会返回错误答案，太紧命中率就崩了。有效的语义缓存把软性相似匹配与硬性元数据边界（租户、语言区域、模型版本、安全标志）结合，使复用始终处于明确界限之内。

这个模式与"用 Redis 做 RAG 向量检索"不同：语义缓存存的是**完整的 LLM 响应**而非文档块，目标是在命中时**完全跳过 LLM**，而不是把检索到的上下文喂给 LLM。

## Redis 方案能带来什么

你可以：

- 让改写与近重复查询在几十毫秒内拿到缓存答案，而不是数秒的 LLM 往返。
- 在有重复查询模式的负载上（FAQ 机器人、帮助台、内部知识助手）把 LLM token 开销降低 30% 以上，且无可测的质量回退。
- 按租户、语言区域或模型版本圈定缓存答案的适用范围，使复用保持在明确边界内——过滤在相似度查询内部完成，而不是在应用代码里。
- 让过期答案自动失效、在内存压力下自动甩掉冷条目，无需手工清理。
- 在用户、会话与渠道之间共享已验证的高质量答案，同时保持缓存非权威、随时可重建。
- 在既有 Redis 部署上增加语义缓存，无须另配向量数据库或缓存服务——同一实例上加一个索引和键模式即可。

## Redis 如何支撑该方案

实践中，每个缓存条目是单个 [Hash](https://redis.io/docs/latest/develop/data-types/hashes/) 或 [JSON](https://redis.io/docs/latest/develop/data-types/json/) 文档，保存提示词、其嵌入向量、LLM 响应以及元数据字段——租户、语言区域、模型版本、安全标志。[Redis Search](https://redis.io/docs/latest/develop/ai/search-and-query/) 索引覆盖嵌入字段与全部元数据字段，于是一次 [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) 调用就能在对缓存提示词做 KNN 的同时，在同一步里应用 TAG 或 NUMERIC 预过滤。命中且距离低于配置阈值时，应用直接返回缓存的响应；未命中时调用 LLM，并把新的提示词、响应与元数据按同样的键模式带 TTL 写回。

Redis 提供以下特性，使它很适合做语义缓存：

- [Hash](https://redis.io/docs/latest/develop/data-types/hashes/) 与 [JSON](https://redis.io/docs/latest/develop/data-types/json/) 把提示词、嵌入、响应和元数据存在同一个键下，缓存命中一次往返就能拿全应用所需的一切。
- 配 [HNSW 向量索引](https://redis.io/docs/latest/develop/ai/search-and-query/vectors/)的 [Redis Search](https://redis.io/docs/latest/develop/ai/search-and-query/) 能在亚毫秒级找到高于可配置相似度阈值的最近缓存提示词；同一次 [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) 调用还能应用 TAG 与 NUMERIC 过滤，让租户隔离与命名空间圈定发生在查询内部而非应用逻辑里。
- [`EXPIRE`](https://redis.io/docs/latest/commands/expire/) 给每个缓存条目设 TTL，过期答案自动老化，无需手工清理，缓存与底层知识库保持一致。
- 数据库级[淘汰策略](https://redis.io/docs/latest/develop/reference/eviction/)（LRU / LFU）在压力下约束内存、自动甩掉冷条目，提示词分布变化时缓存仍在预算之内。
- 亚毫秒级内存读写让语义缓存搭在已在处理会话、限流或 RAG 检索的同一 Redis 实例上，边际成本为零。

## 生态

以下库、框架与托管服务基于 Redis 做语义缓存：

- **Python**：[RedisVL](https://github.com/redis/redis-vl-python) 提供 `SemanticCache` API，内置嵌入、距离阈值、TTL 与元数据过滤器（见 RedisVL 的 LLM 缓存用户指南与 LangCache 集成指南）。
- **框架**：[LangChain](https://python.langchain.com/docs/integrations/llm_caching/)（Redis 作 LLM 缓存与向量库）、[LlamaIndex](https://developers.llamaindex.ai/python/examples/vector_stores/redisindexdemo/)、[LangGraph](https://langchain-ai.github.io/langgraph/)（agent 记忆与响应缓存）。
- **托管**：[Redis LangCache](https://redis.io/docs/latest/develop/ai/context-engine/langcache/) 是全托管语义缓存，提供 REST API、可配置距离阈值、自动淘汰与内置指标——无需管理索引或接线嵌入。

## 构建自己的 Redis 语义缓存：redis-py（Python）示例

以下内容翻译自官方语义缓存用例的 redis-py 指南。它演示如何用 [`redis-py`](https://redis.io/docs/latest/develop/clients/redis-py/) 与 [`sentence-transformers`](https://www.sbert.net/) 库构建一个小的 Redis 语义缓存。指南自带一个用 Python 标准库写的本地 web 服务器：向一个模拟 LLM 发送改写过的提示词，观察缓存的命中/未命中判定，扫掠余弦距离阈值，看累计延迟与 token 节省不断累积。

### 概览

每个缓存条目存为单个 Redis [Hash](https://redis.io/docs/latest/develop/data-types/hashes/)，键为 `cache:<id>`。哈希里保存原始提示词、LLM 响应、提示词 384 维嵌入的原始 `float32` 字节，以及元数据字段——租户、语言区域、模型版本、安全标志——外加 `created_ts` 与 `hit_count`。一个 [Redis Search](https://redis.io/docs/latest/develop/ai/search-and-query/) 索引覆盖嵌入字段与所有元数据字段，因此带 `KNN` 子句的一次 [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) 调用即可在同一往返内完成向量查找**和** TAG 预过滤——无需跨库 join。

查找是带阈值的：[FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/) 总会返回满足过滤条件的最近条目，但只有报告的余弦距离不超过 `distance_threshold` 时应用才把它当作命中。更远的都视为未命中；调用方去跑 LLM，并把新的提示词、响应与嵌入按同样的键模式带 TTL 写回。

由此得到：

- 单次往返完成查找——向量 KNN 与元数据预过滤在同一次 FT.SEARCH 里。
- 命中时几十毫秒，未命中时数秒的 LLM 调用；无论命中与否，嵌入一步都是瓶颈，而那是模型侧成本，不是 Redis 的。
- 租户、语言区域与模型版本的隔离在查询内部强制执行，而不是应用代码里——一个租户写入的条目不可能被服务给另一个租户。
- 有界内存：每个条目都有 [`EXPIRE`](https://redis.io/docs/latest/commands/expire/) TTL，数据库级[淘汰策略](https://redis.io/docs/latest/develop/reference/eviction/)（LRU / LFU）在压力下为缓存封顶。

### 工作原理

一次查询经历三个阶段：**嵌入（embed）**、**查找（lookup）**，未命中时**调用 LLM 并写回**。

命中路径（理想情况）：

1. 应用调用 `embedder.encode_one(prompt)` 把输入文本变成 384 维 `float32` 向量。
2. `cache.lookup(query_vec, tenant=..., locale=..., model_version=...)` 运行带 TAG 预过滤与 `KNN 1` 子句的 [FT.SEARCH](https://redis.io/docs/latest/commands/ft.search/)。Redis 返回满足过滤条件的最近缓存提示词及其余弦距离。
3. 距离不超过阈值时，缓存返回含缓存响应的 `CacheHit`。辅助类还会流水线化一条 [`HINCRBY`](https://redis.io/docs/latest/commands/hincrby/)（更新 `hit_count`）和一次 [`EXPIRE`](https://redis.io/docs/latest/commands/expire/) 刷新——常用答案保持 TTL，演示界面也能看出哪些条目在"扛流量"。
4. LLM 完全没被调用。应用把缓存响应返回给用户。

未命中路径：距离超过阈值——或范围内根本没有候选——时，辅助类返回 `CacheMiss`，并携带最近候选的距离（若有）供日志使用。随后应用：

1. 用提示词调用 LLM。
2. 调用 `cache.put(prompt, response, embedding, tenant=..., locale=..., model_version=...)`。查找用的同一个嵌入被复用——不必重新编码。辅助类以流水线写入 Hash（[`HSET`](https://redis.io/docs/latest/commands/hset/)）并带 [`EXPIRE`](https://redis.io/docs/latest/commands/expire/) TTL。
3. 把 LLM 响应返回给用户。同一元数据范围下的下一个语义相似提示将成为命中。

### 缓存辅助类

`RedisSemanticCache` 类封装了 Redis Search 索引与查找/写回流程（[源码](https://github.com/redis/docs/blob/main/content/develop/use-cases/semantic-cache/redis-py/cache.py)）：

```python
import redis
from cache import RedisSemanticCache, CacheHit, CacheMiss
from embeddings import LocalEmbedder

# Use decode_responses=False because the embedding field is raw bytes;
# the helper decodes text fields explicitly where it needs them.
r = redis.Redis(host="localhost", port=6379, decode_responses=False)
cache = RedisSemanticCache(
    redis_client=r,
    index_name="semcache:idx",
    distance_threshold=0.5,    # cosine distance, lower = stricter
    default_ttl_seconds=3600,  # one hour
)
embedder = LocalEmbedder()  # sentence-transformers/all-MiniLM-L6-v2

# One-time index setup (idempotent).
cache.create_index()

# 1) Embed the prompt.
prompt = "How do I return an item?"
query_vec = embedder.encode_one(prompt)

# 2) Look up under a metadata scope. The TAG filter and the KNN
#    travel together in one FT.SEARCH.
result = cache.lookup(
    query_vec,
    tenant="acme",
    locale="en",
    model_version="gpt-4.5-2026",
)

if isinstance(result, CacheHit):
    response = result.response
    print(f"hit ({result.distance:.3f}): {response}")
else:
    # 3a) Miss — call the LLM. (Use your real client here.)
    response = call_llm(prompt)

    # 3b) Cache the new entry. Reuses the same embedding bytes the
    #     lookup used, so we don't pay the encoder twice.
    cache.put(
        prompt=prompt,
        response=response,
        embedding=query_vec,
        tenant="acme",
        locale="en",
        model_version="gpt-4.5-2026",
    )
```

### 数据模型

每个缓存条目是一个 Redis Hash。向量字段是原始小端 `float32` 字节——不用 JSON 包装——因为 Redis Search 的向量编码要求的正是这个格式。

```text
cache:7c3f8a1b9e02
  prompt=How do I return an item?
  response=You can return any unworn item within 30 days...
  tenant=acme
  locale=en
  model_version=gpt-4.5-2026
  safety=ok
  created_ts=1715990400.123
  hit_count=4
  embedding=<384 × float32 little-endian bytes>
```

Redis Search 索引 schema 让每个字段都能按其自然类型查询：

```text
FT.CREATE semcache:idx
  ON HASH PREFIX 1 cache:
  SCHEMA
    prompt         TEXT
    response       TEXT
    tenant         TAG
    locale         TAG
    model_version  TAG
    safety         TAG
    created_ts     NUMERIC SORTABLE
    hit_count      NUMERIC SORTABLE
    embedding      VECTOR HNSW 6 TYPE FLOAT32 DIM 384 DISTANCE_METRIC COSINE
```

`prompt` 与 `response` 两个 TEXT 字段不被缓存查找本身使用（查找只走向量），但它们让你能用 `redis-cli` 按内容排查缓存，方便调试或运维工具。

### 查询

查找是一个混合查询：括号里的 TAG 预过滤表达式，接 `=>[KNN 1 @embedding $vec]`。在 `DIALECT 2` 下，Redis 先应用过滤，再只对匹配文档做 KNN 排序。

```text
FT.SEARCH semcache:idx
  "(@tenant:{acme} @locale:{en} @model_version:{gpt\-4\.5\-2026} @safety:{ok})
     =>[KNN 1 @embedding $vec AS distance]"
  PARAMS 2 vec <384-float32-bytes>
  SORTBY distance
  RETURN 7 prompt response tenant locale model_version hit_count distance
  DIALECT 2
```

`distance` 是余弦**距离**（0 表示相同，2 表示相反）。结果升序排序，第一行就是最近的候选。应用把 `distance` 与阈值比较、在用户代码里判定命中或未命中——无论判定如何 Redis 都会返回该行；把它当命中还是未命中是缓存辅助类拥有的策略决策，不是服务端过滤器。

### 模拟 LLM

为了不需要 API key 也能看清延迟与 token 节省，`mock_llm.py` 提供一个确定性替身（[源码](https://github.com/redis/docs/blob/main/content/develop/use-cases/semantic-cache/redis-py/mock_llm.py)）：

```python
from mock_llm import MockLLM

llm = MockLLM(latency_ms=1500.0)  # one and a half seconds per call
response = llm.complete("What is your return policy?")
# response.response       — the templated answer text
# response.latency_ms     — wall-clock time the call took
# response.total_tokens   — estimated prompt + completion tokens
```

模拟器按配置的时延 sleep，然后对一个小的 FAQ 表做关键词匹配生成答案。刻意的缓慢让命中明显比未命中便宜。生产代码里，把 `MockLLM` 换成你真实选择的客户端——OpenAI、Anthropic、Bedrock、vLLM、Ollama 都行——缓存辅助类无需改动。

### 预填充缓存

真实部署中缓存自然累积：新问题未命中，LLM 回答，响应写回。为演示方便，`seed_cache.py` 预载一小组规范 FAQ 提示词，让第一次查询就命中（[源码](https://github.com/redis/docs/blob/main/content/develop/use-cases/semantic-cache/redis-py/seed_cache.py)）：

```python
from seed_cache import seed
from cache import RedisSemanticCache
from embeddings import LocalEmbedder

cache = RedisSemanticCache()
embedder = LocalEmbedder()
cache.create_index()
seed(cache, embedder, tenant="acme", locale="en")
```

种子列表存每个问题的规范表述（"What is your return policy?"）。这些提示词的任何改写（"How do I return an item?"、"Can I get a refund?"）嵌入后都靠近规范条目，缓存查找直接返回存储的响应，模型一次都不用调。

### 交互式演示

`demo_server.py` 运行一个 ThreadingHTTPServer。HTML 页面可以：

- 输入提示词并切换元数据：租户、语言区域、模型版本。每种组合都是同一索引内的独立缓存命名空间。
- 拖动余弦距离阈值滑块，看同一提示词的命中变未命中（以及变回来），每次查询都报告实际距离。
- 用 **Ask** 提交走完整的命中/未命中路径（未命中时调用 LLM 并写回答案）。用 **Lookup only (no LLM)** 提交，在不污染缓存的情况下对固定提示词扫掠阈值。
- 观察累计面板：总查询数、缓存命中、缓存未命中、命中率、省下的 token、省下的 LLM 秒数。
- 检查每个缓存条目（含剩余 TTL 与总命中数），并可单独删除条目模拟淘汰。

服务器在进程生命周期内持有一个 `LocalEmbedder`、一个 `RedisSemanticCache` 和一个 `MockLLM`。端点：

| 端点 | 作用 |
| --- | --- |
| `GET /state` | 索引信息与全部缓存条目列表。 |
| `POST /query` | 嵌入提示词，运行 `FT.SEARCH`；未命中则调用 LLM 并写回。 |
| `POST /reset` | 清空全部缓存条目并按 FAQ 列表重新播种。 |
| `POST /drop` | 按 id 删除单个缓存条目。 |

### 本地运行演示

1. 克隆 [`redis/docs`](https://github.com/redis/docs) 仓库并进入示例目录：

   ```bash
   git clone https://github.com/redis/docs.git
   cd docs/content/develop/use-cases/semantic-cache/redis-py
   ```

2. 安装依赖：

   ```bash
   pip install redis sentence-transformers numpy
   ```

3. 确保本地 6379 端口上有一个带 Redis Search 模块的 Redis 实例。[Redis Stack](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/) 或带 Search 的 [Redis 8](https://redis.io/docs/latest/develop/ai/search-and-query/) 都可以。

4. 启动演示服务器。首次运行会把 `all-MiniLM-L6-v2` 模型（约 80 MB）下载到本地 Hugging Face 缓存：

   ```bash
   python demo_server.py
   ```

5. 打开 http://localhost:8085 试试这些查询：

   - **"What is your return policy?"**——与种子完全匹配，距离约等于 0，任何阈值下都命中。
   - **"How fast is delivery?"**——配送种子的改写；距离约 0.30，默认阈值 0.5 下命中。
   - **"How do I return an item?"**——退货种子稍松的改写；距离约 0.49，默认阈值下仍是命中。把阈值滑到 0.4 可以看到它翻成未命中。
   - **"What payment methods do you accept?"**——与任何种子都无关；距离大于 0.8，于是未命中，模拟 LLM 花 ~1.5 秒应答，新答案入缓存，同一问题的再次提问立即命中。
   - 把 **Tenant** 下拉框切到 `globex` 或 `initech` 再问任何已播种问题——结果翻成未命中，因为缓存条目都在 `acme` 之下。这就是 FT.SEARCH 内部的元数据预过滤在工作。

   `all-MiniLM-L6-v2` 把 FAQ 型改写放进 0.3–0.5 的余弦距离区间，无关查询在 0.8 以上——这正是默认值取 0.5 的依据。换更严格（或领域微调过）的嵌入模型可以进一步下调阈值；更噪的模型则要上调。正确的阈值永远是模型、语料与应用对复用保守程度三者的函数。

服务器对你的本地 Redis 是可读写的。默认索引名 `semcache:idx`，条目键在 `cache:` 之下。传 `--no-reset` 可在重启间保留既有缓存，`--threshold` 改默认余弦距离截断值，`--llm-latency-ms` 调快或调慢模拟 LLM。

---

> **来源**：本文翻译自 redis/docs 官方文档仓库（CC BY-SA 4.0）四页：[Redis Search 总览](https://redis.io/docs/latest/develop/ai/search-and-query/)、[Vector search](https://redis.io/docs/latest/develop/ai/search-and-query/query/vector-search/)、[Redis semantic cache](https://redis.io/docs/latest/develop/use-cases/semantic-cache/)、[Redis semantic cache with redis-py](https://redis.io/docs/latest/develop/use-cases/semantic-cache/redis-py/)，作者 Redis Ltd.。抓取于 2026-09-13。
> 原文中的 Hugo 模板标记（clients-example 短代码、relref 链接）按其渲染结果转写为普通代码块与 Markdown 链接；CLI 示例中的向量二进制串按原文截短保留。
