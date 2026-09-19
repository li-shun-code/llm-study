---
title: 前缀缓存与 KV 复用在多轮对话与 RAG 中的实战
source_url: https://github.com/vllm-project/vllm/blob/main/docs/design/prefix_caching.md
author: vLLM 项目（官方设计文档与特性文档）
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: vLLM 0.29.x（V1 引擎；参数名与默认值按 2026-09-19 的 vllm-project/vllm main 分支 docs/ 与 vllm/config/*.py 核对，官方最新 release tag 为 v0.29.0）
order: 20
group: 部署与服务化
---
## 为什么要在意 KV 复用

多轮对话和 RAG 有一个共同的开销黑洞：**每次请求都要把已经"读过"的上下文重新读一遍**。

- 一段 20 轮的历史，第 20 轮请求里前 19 轮模型早就算过了，但 HTTP 是无状态的，客户端只能把全量 `messages` 重发；服务端如果不做复用，这段历史的 prefill 就要一遍遍重算。
- 一份 5 万 token 的手册被 1000 个用户各问三个问题，朴素实现下这份手册被 prefill 了 3000 次。

prefill 是算力瓶颈、decode 是显存带宽瓶颈（见[推理原理](./16-inference-principles)），所以"少算一遍长前缀"直接换算成 TTFT、GPU 占用秒数和钱。官方设计文档对这个优化的定位是一句话：**prefix caching 几乎是免费的午餐（almost a free lunch），而且不会改变模型输出**——这也是它能被 OpenAI、Anthropic 等公共端点和 SGLang 等主流推理框架普遍采用的原因。

本篇不重复《vLLM 高吞吐部署》里 APC 的参数面，而是把镜头拉近到**业务侧**：从 vLLM 的实现机制倒推出"请求怎么写才命中"，给多轮对话与 RAG 两套具体写法、一套可运行的冷热对照实验，以及命中不了时的排查路径与跨实例扩展手段。

## 一、机制决定写法：块、哈希链与"只缓存整块"

vLLM 选的是**基于哈希**的前缀缓存。设计文档给的键构造规则是：每个 KV block 的哈希由三部分元组组成——

```text
                    Block 1                  Block 2                  Block 3
         [A gentle breeze stirred] [the leaves as children] [laughed in the distance]
Block 1: |<--- block tokens ---->|
Block 2: |<------- prefix ------>| |<--- block tokens --->|
Block 3: |<------------------ prefix -------------------->| |<--- block tokens ---->|
```

- **Parent hash value**：前一个（父）块的哈希值；
- **Block tokens**：本块的 token 元组（显式带上完整 token 是为了降低哈希碰撞概率）；
- **Extra hashes**：让块唯一化的其他信息——LoRA ID、多模态输入的图像哈希、多租户隔离用的 cache salt。

由此可以推出三条**业务侧硬约束**，后面所有写法都是从这三条推出来的：

1. **哈希是链式的**：只要第 k 个块里任何一个 token 变了，第 k 块及其后所有块的键全部失效。所以"历史只能追加，不能改写"。
2. **官方明确 Note 1：只缓存完整块**（We only cache full blocks）。默认块大小 `CacheConfig.DEFAULT_BLOCK_SIZE = 16`（`vllm/config/cache.py`，2026-09-19 核对于 v0.29.x）。共享前缀 12 个 token、块 16 token，命中 0 块；35 个 token 才命中 2 块。**收益是按块向下取整的**。
3. **Extra hashes 意味着"同一段文字，不同租户/不同 adapter 不共享缓存"**。这是安全设计，也是命中率统计时容易忽略的分母来源。

V1 里 APC 默认开启（`enable_prefix_caching: bool = True`），键哈希算法默认 `sha256`（自 v0.11 起把碰撞风险解决了；`--prefix-caching-hash-algo` 另有 `sha256_cbor`/`xxhash`/`xxhash_cbor`，跨环境可复现的确定性缓存推荐 `sha256_cbor`）。也就是说：**你要做的不是"打开它"，而是"别把前缀写坏"。**

## 二、多轮对话：让历史只长不改

### 反例与正例

多轮对话最常见的三种"自我驱逐"写法：

| 写法 | 后果 | 改法 |
| --- | --- | --- |
| system prompt 里塞当前时间戳 / request id / A/B 分桶标记 | 首块即失效，整条历史全灭，命中率归零 | 把易变内容挪到**消息序列末尾**，或放进不参与拼 prompt 的 header/metadata |
| 每轮把整段历史重新排版（换角色标签、缩进、加轮次编号 `[Round 3]`） | token 序列变了，哈希链断 | 模板只渲染一次；追加式拼接，历史部分的字符串一字不动 |
| 历史超预算时做摘要压缩 / 截断早期轮次 | 被改写处之后全部 miss | 只在尾部截断（保留最长的公共前缀），并把压缩做成"低频批量"而非"每轮都做" |

第三种要特别说明：**截断比改写便宜**。从头部丢掉整块（保留的后半段仍能命中，只要它与另一条已缓存链的哈希对得上——实践中一般对不上，但不会像中间改写那样污染整段），而"就地摘要替换某轮"会让该轮之后 100% miss。真要控历史长度，工程上更划算的是按整块对齐地向尾部保留。

### 可运行的多轮客户端

下面这段是"对缓存友好"的最小完整实现：`history` 只 append，system prompt 固定，易变的请求级信息只进最后一条 user 消息。

```python
"""
前缀缓存友好的多轮对话客户端。
依赖：pip install openai
前提：已启动服务
  vllm serve Qwen/Qwen2.5-7B-Instruct --served-model-name qwen
"""
import time

from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")

# 固定不变的 system prompt：它是所有轮次共享的那段前缀
SYSTEM_PROMPT = (
    "你是一位严谨的技术文档助手。要求：\n"
    "1) 只依据对话中给出的资料回答，不要编造；\n"
    "2) 引用资料中的具体段落；\n"
    "3) 不确定时明确说不确定。"
)

history: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]


def ask(question: str) -> None:
    """一次提问 = 在稳定前缀后面追加一条 user 消息。"""
    # 注意：易变信息（时间、trace id）不要进 messages，放 header 或本地日志
    history.append({"role": "user", "content": question})

    t0 = time.perf_counter()
    first_token_at = None
    pieces: list[str] = []
    prompt_tokens = 0

    stream = client.chat.completions.create(
        model="qwen",
        messages=history,            # 全量重发，但前缀与前面各轮逐 token 相同
        max_completion_tokens=256,   # Chat Completions 用 max_completion_tokens
        temperature=0,
        stream=True,
        stream_options={"include_usage": True},  # 让流式最后一个 chunk 带 usage
    )
    for chunk in stream:
        if first_token_at is None and chunk.choices and chunk.choices[0].delta.content:
            first_token_at = time.perf_counter()
        if chunk.choices and chunk.choices[0].delta.content:
            pieces.append(chunk.choices[0].delta.content)
        if chunk.usage is not None:
            prompt_tokens = chunk.usage.prompt_tokens

    answer = "".join(pieces)
    history.append({"role": "assistant", "content": answer})  # 追加，不改写

    ttft = (first_token_at or time.perf_counter()) - t0
    print(f"[{time.strftime('%H:%M:%S')}] prompt_tokens={prompt_tokens} "
          f"TTFT={ttft * 1000:.1f}ms 回答长度={len(answer)} 字")


if __name__ == "__main__":
    for q in ["这份资料的适用范围是什么？", "把上一条回答里的结论展开讲讲", "有哪些反例？"]:
        ask(q)
```

随着轮次增加，`prompt_tokens` 会线性上涨，而 TTFT 不应该同比例上涨——如果它跟着线性涨，说明根本没命中，按第五节排查。

### 会话粘性：多副本下别把同一会话打散

多轮对话真正难的是**跨副本**。同一个会话的第 5 轮打到另一台实例，那边缓存里没有你的历史，等于白聊。三种解法，按侵入性从低到高：

- **会话级一致性哈希**：网关按 `conversation_id` 而非轮询选后端。这也是官方 K8s 文档提醒"Service 的 label selector 要与 Deployment 标签匹配——这对前缀缓存 feature 也很有用"的落点：K8s 原生 `sessionAffinity` 只按客户端 IP 粘，且不能感知负载，实践中通常要在网关层自己做。
- **前缀感知路由**：vLLM production stack 的路由器提供 model-aware / prefix-aware routing（见[推理服务生产化运维](./19-inference-serving-production)）；要让路由器知道每台实例缓存了什么，vLLM 支持通过 `--kv-events-config` 发布 KV cache 事件（`enable_kv_cache_events`），外部路由器据此维护"哪个块哈希在哪台机器"的索引。
- **KV 外置**：不指望实例内存，把块卸到更大更慢的层，下一节讲。

## 三、RAG：把检索片段变成可共享的前缀

RAG 的前缀结构天生比对话更微妙：一次请求 = `固定指令 + 检索到的 K 个片段 + 用户问题`。指令段是全局共享前缀，片段段只在"同一篇文档/同一组片段"内共享。于是命中率取决于两件你完全可控的事。

### 1）prompt 布局：稳定度递减的顺序

```text
[ system: 角色 + 输出格式约定 ]   ← 永不变，全局共享
[ 长文档 / 高频被问的资料 ]        ← 少数请求之间共享，命中即省整段 prefill
[ 本次检索到的片段 ]              ← 组内共享：同问题、同用户追问时命中
[ 用户本次问题 ]                  ← 每次都变，放最后
```

把每次都要变的东西放最后，是 RAG 提示词布局的第一原则。反例很常见：为了"提醒模型注意时间"把时间戳写在 system 里——整段检索片段的缓存立刻全废。

### 2）检索结果排序必须是确定性的

Top-5 片段按相似度得分排序，而得分会因为向量库并发、浮点次序、新写入的 chunk 而变化；**只要片段顺序变了，token 序列就变了，前缀链就断了**。同一篇文档的多个提问、同一问题的追问，本该命中却因为 rerank 抖动而 miss，是 RAG 场景最隐蔽的漏点。

做法：向量召回后，先按 `(doc_id, chunk_id)` 做一次稳定排序再送进模型（展示顺序仍可保留相关性序），让"同一组片段"总能渲染成同一串 token。追问时如果检索结果不变（可复用此前已命中的片段集合），前缀就能整段接上。

```python
"""把检索片段渲染成"确定性顺序 + 稳定分隔"的 prompt 片段。"""


def render_context(chunks: list[dict]) -> str:
    """chunks 元素形如 {"doc_id": str, "chunk_id": int, "text": str}。

    关键点：
    1) 按 (doc_id, chunk_id) 排序，与相关性得分无关 —— 同样的片段集合必得同样的字符串；
    2) 分隔符固定，不掺入时间、请求 id、模型版本号等易变内容。
    """
    stable = sorted(chunks, key=lambda c: (c["doc_id"], c["chunk_id"]))
    lines = []
    for i, c in enumerate(stable, start=1):
        lines.append(f"[资料 {i}] {c['text']}")
    return "\n\n".join(lines)


def build_messages(question: str, chunks: list[dict]) -> list[dict]:
    system = (
        "你是企业知识库助手。只依据【资料】回答，回答中用 [资料 N] 标注依据；"
        "资料不足时回答“资料不足”。"
    )
    # 注意顺序：稳定 → 半稳定 → 易变
    user_content = f"{render_context(chunks)}\n\n问题：{question}"
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user_content},
    ]
```

### 3）"同一文档多问题"是收益最大的形态

官方特性文档点名的两个高收益负载就是 **long document query**（反复用不同问题查同一份长文档，APC 让这份文档只被处理一次）和 **multi-round conversation**（多轮会话复用历史）。落到 RAG 上，这两种形态分别是：

- **文档级会话**：用户点开一篇文档连续提问。第一问 miss，之后每问都命中"文档 + 之前若干轮"，TTFT 从整段 prefill 降到只剩增量。
- **热点知识预热**：把高频文档（FAQ、发布说明、SLA 条款）在服务启动后用一个 `max_completion_tokens=1` 的哑请求预热一遍，等于给这批前缀付了首次 prefill 成本。预热要写在容量脚本里，而不是靠运气。

### 4）多模态 RAG 的块也能复用

设计文档专门给了图像输入的哈希示例：`[IMG]` 会被展开成一串占位 token，各块的 extra hash 里带上**前端图像处理器算出的图像哈希**，因此同一张图 + 同一段文字能命中；图像换了，占位 token 虽然一样，块键不同。也就是说：多模态场景下想命中，得保证**图像预处理输入一致**（同一 URL/同一张字节流，别每轮重新压缩缩放到不同尺寸）。

## 四、量化它：命中率、冷热对照实验

### 看聚合指标

`/metrics` 端点上的两个 counter 是判据（Grafana 里自己算 ratio）：

```promql
rate(vllm:prefix_cache_hits[5m]) / rate(vllm:prefix_cache_queries[5m])
```

官方设计文档解释过为什么不做成 gauge：命中率是"任意时间区间上的比值"，交给 counter + Prometheus 的时间序列能力去表达更准确。逐块观察加 `--kv-cache-metrics`（配 `--kv-cache-metrics-sample` 控制采样率）后有 `vllm:kv_block_lifetime_seconds`、`vllm:kv_block_idle_before_evict_seconds`、`vllm:kv_block_reuse_gap_seconds` 三个指标——把 lifetime 和 idle time 画在一起，"没人复用却占着显存的前缀"一眼可见。

不接 Prometheus 也能粗判：默认 `LoggingStatLogger` 每 5 秒一条 INFO 日志，里面包含最近 1k 次 KV block 查询的前缀缓存命中率。

### 冷热对照：一个能直接跑的脚本

指标要等服务跑起来才有，上线前你更想知道"我这套 prompt 写法到底省了多少 TTFT"。思路是**用随机 nonce 制造必然 miss 的冷基线**，再测真实共享前缀的热路径：

```python
"""
前缀缓存收益的冷热对照（无需重启服务）。
依赖：pip install openai
前提：vllm serve Qwen/Qwen2.5-7B-Instruct --served-model-name qwen

冷：每次在文档前加一个随机 nonce —— 前缀必然未缓存。
热：同一份文档 + 不同问题 —— 第二次起前缀命中。
"""
import statistics
import time
import uuid

from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")

DOC = """（这里替换成你自己的长文本，建议 2k token 以上；
每轮问答都复用同一段，越接近真实业务语料，结论越有参考价值。）
""" * 40
QUESTIONS = ["概述要点", "列出三条风险", "给出适用场景", "有哪些反例", "总结成一句话"]


def ttft_once(doc: str, question: str) -> tuple[float, int]:
    """返回 (TTFT 秒, prompt_tokens)。"""
    t0 = time.perf_counter()
    first: float | None = None
    prompt_tokens = 0
    stream = client.chat.completions.create(
        model="qwen",
        messages=[
            {"role": "system", "content": f"只依据资料回答。\n\n{doc}"},
            {"role": "user", "content": question},
        ],
        max_completion_tokens=64,
        temperature=0,
        stream=True,
        stream_options={"include_usage": True},
    )
    for chunk in stream:
        if first is None and chunk.choices and chunk.choices[0].delta.content:
            first = time.perf_counter()
        if chunk.usage is not None:
            prompt_tokens = chunk.usage.prompt_tokens
    return (first or time.perf_counter()) - t0, prompt_tokens


cold: list[float] = []
for q in QUESTIONS:
    # nonce 让 system 段首块就 miss，测到的是完整 prefill
    cold.append(ttft_once(f"nonce={uuid.uuid4()}\n{DOC}", q)[0])

# 预热一次，之后才是"热"路径
ttft_once(DOC, QUESTIONS[0])
warm: list[float] = []
for q in QUESTIONS:
    warm.append(ttft_once(DOC, q)[0])

print(f"冷 TTFT p50 = {statistics.median(cold) * 1000:.1f} ms  n={len(cold)}")
print(f"热 TTFT p50 = {statistics.median(warm) * 1000:.1f} ms  n={len(warm)}")
print(f"相对下降   = {(1 - statistics.median(warm) / statistics.median(cold)):.1%}")
```

读数注意两件事：并发要压到 1（否则排队时间会盖住 prefill 差异），以及同一份文本别在冷/热两组间漂移。想做正式基准，用 `vllm bench serve` 并在每轮之间重置缓存：设 `VLLM_SERVER_DEV_MODE=1` 启动服务后有 `/reset_prefix_cache` 调试端点可用；官方基准工具链里 `vllm bench sweep serve` 也会在每轮之间重置服务端缓存，random 数据集还可以换 `--seed`（默认为 `0`）。

### 换算成钱

一次命中省下的是一段 prefill。粗算：

```text
每秒省下的 GPU 时间 ≈ 命中次数/秒 × 平均命中 token 数 / prefill_tokens_per_s
每月省下的钱 ≈ 上式 × 3600 × 24 × 30 × GPU 小时单价
```

`prefill_tokens_per_s` 从你自己实例的 `rate(vllm:prompt_tokens_total[1m])` 取，别抄别人的数。这个式子是《推理服务生产化运维》成本核算一节里"命中率的价值"那条的具体化——它是决定"要不要为 RAG 做片段稳定排序、要不要为多轮做会话粘性"的投入依据。

## 五、命中不了：排查顺序

| 现象 | 先查 | 典型原因 |
| --- | --- | --- |
| 命中率恒为 0 | 客户端有没有每轮改写历史；system 里有没有随机量 | 时间戳/trace id 进了 prompt；摘要每轮重跑 |
| 命中率忽高忽低 | 多副本是否轮询 | 同一会话/同一文档被打散到不同实例，按第二节"会话粘性"处理 |
| 只有短前缀的业务没收益 | 共享前缀 token 数 vs 块大小 | 只缓存整块：共享 12 token、块 16 → 0 命中。必要时调小 `--block-size`（更小的块 → 更多元数据与调度开销，需压测） |
| 命中率正常但 TTFT 没降 | `vllm:request_prefill_time_seconds`、`vllm:time_to_first_token_seconds` | APC **只加速 prefill，不加速 decode**；输出很长时收益被 decode 吃掉，这是官方写明的 Limits |
| 某些请求整段 miss | 是否同时用了 prompt logprobs | V1 不再缓存 logprobs：需要 prompt logprobs 的请求会忽略前缀缓存、重算整段 prefill |
| 多 LoRA 实例命中率莫名偏低 | extra hash 含 LoRA ID | 不同 adapter 之间天然不共享块；同一业务线请收敛到同一 adapter 名 |
| 缓存被"钉住"，新前缀挤不进来 | `kv_block_idle_before_evict_seconds` | 长 decode 请求占着 prompt 块不放；降并发或扩显存 |
| 多租户下担心跨用户复用 | 是否设置了 `cache_salt` | 默认所有请求可互相复用块；在请求体里带 `cache_salt`，只有同 salt 的请求能复用（防通过时延差异猜内容） |

```json
{
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "这里放租户 A 的私有文档"},
    {"role": "user", "content": "这个季度营收多少？"}
  ],
  "cache_salt": "tenant-a"
}
```

## 六、当单实例内存装不下：把 KV 外置

V1 的前缀缓存只在 GPU 块池里，LRU 驱逐：空闲队列头部是最近最少用的块，块被"touch"（引用计数 +1、移出空闲队列）才不会被抢走；请求释放时，块按**逆序**回到空闲队列尾部——因为最后一个块哈希了更多 token、更不可能被复用，应该最先被驱逐。这套机制决定了 GPU 内缓存"容量有限、按块 LRU"。要跨时间、跨重启复用，就得往外走。

### CPU/多级 KV 卸载

`OffloadingConnector` 把已完成的 KV 块搬到更大更慢的层（主机内存，以及可选的二级层如本地盘），命中时按需提升回 GPU；GPU↔CPU 走 DMA（`cudaMemcpyAsync`）异步传输，官方口径是"增加的开销很小"。当前仅支持 CUDA、ROCm、XPU。

```bash
# 单级：只用 CPU 主存
vllm serve Qwen/Qwen2.5-14B-Instruct --served-model-name qwen \
  --kv-transfer-config '{
    "kv_connector": "OffloadingConnector",
    "kv_role": "kv_both",
    "kv_connector_extra_config": {
      "block_size": 64,
      "cpu_bytes_to_use": 10000000000
    }
  }'
```

配置要点（逐项对 v0.29.x 的官方使用指南核对）：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `cpu_bytes_to_use` | 必填 | 所有 worker 合计预留的主存字节数（不是每 worker） |
| `spec_name` | `CPUOffloadingSpec` | 多级场景设 `TieringOffloadingSpec` + `secondary_tiers` |
| `block_size` | 跟随 GPU 块 | 卸载块大小，必须是 GPU 块大小的整数倍；与 `blocks_per_chunk` 互斥 |
| `eviction_policy` | `lru` | 主存层策略，内置 `lru`/`arc` |
| `offload_prompt_only` | `true` | 只卸 prompt 块，不卸 decode 块——对话/RAG 场景正是想要的那部分 |
| `store_threshold` | `0` | 被查找多少次之后才卸载（`TieringOffloadingSpec` 拒绝 ≥2） |

只有 `CPUOffloadingSpec`/`TieringOffloadingSpec` 的 CPU 主层能直连 GPU，二级层的所有传输都要经 CPU 主层中转。单请求侧还能用 `kv_transfer_params` 里的 `max_load_tokens` 限制从外置层加载多少 token（设 `0` 表示只用 GPU 内前缀缓存、其余重算），官方标注该字段为实验特性。

对多轮对话/RAG 的意义很直接：**用户离开十分钟后回来继续聊**，GPU 块池早已把这轮的块驱逐干净，但 CPU 层还在——TTFT 从"整段 prefill 重算"降到"块搬运 + 尾部小段 prefill"。这也让 `--gpu-memory-utilization`、`--max-model-len` 与主存预算之间出现了新的权衡点。

### 跨实例与更激进的路线

- **LMCache**：vLLM 生态里的 KV 卸载/复用方案，production stack 直接把它作为特性列出（vLLM 侧经 `--kv-offloading-backend lmcache` 接入）。
- **PD 分离（disaggregated prefill）**：prefill 与 decode 拆到不同实例池，中间用 KV connector（NIXL、Mooncake 等）传 KV。它解决的是"长 prefill 卡住 decode"的调度干扰，不是"缓存复用"本身，但两者共用同一套 connector 机制——真要上，请把容量与故障域一起重估。
- **混合 Mamba / 线性注意力类模型**：状态不在 token 块网格里，细粒度命中靠 `--mamba-cache-mode align` + `--prefix-match-unit` + `--enable-mamba-fine-grained-prefix-cache` 三个开关（默认关闭，且要求 Mamba 组上开了 EAGLE/MTP 投机解码、`--prefix-match-unit` 小于 Mamba 块大小、模型不使用 multi-module MTP）。这类模型每块能装上千 token，"只缓存整块"的向下取整损失被放大，细粒度匹配才划算；`--prefix-match-unit` 是必填项，取值要能整除每个可缓存 KV cache group 的 `block_size`，官方建议从 64 起步。

## 小结

- 前缀缓存的键是**父块哈希 + 本块 token + extra hashes（LoRA ID、图像哈希、cache salt）**，只缓存完整块（默认块大小 16），所以业务侧唯一要管的事是"**让前缀逐 token 不变**"。
- 多轮对话：历史 append-only，易变内容不进 prompt；截断比就地改写便宜；多副本要会话粘性或前缀感知路由。
- RAG：prompt 按"稳定 → 半稳定 → 易变"排序；检索片段用 `(doc_id, chunk_id)` 做确定性排序；热点文档值得显式预热。
- 度量：`rate(vllm:prefix_cache_hits[5m])/rate(vllm:prefix_cache_queries[5m])`；上线前用 nonce 造冷基线做 A/B，正式基准用 `vllm bench serve` + 每轮重置缓存。
- 收益边界：APC 只加速 prefill，不加速 decode；与 prompt logprobs 互斥；不同 LoRA/不同 salt 之间不共享块。
- 装不下再往外走：`OffloadingConnector`（CPU 主层 + 可选二级层，`offload_prompt_only` 默认 true）、LMCache、PD 分离；混合 Mamba 靠 `--prefix-match-unit` 做块内细粒度命中。

## 延伸阅读

- APC 与四大吞吐能力的参数面：[vLLM 高吞吐部署](./18-vllm-high-throughput-deployment)
- 指标采集、SLO、成本与扩缩容：[推理服务生产化运维](./19-inference-serving-production)
- 为什么 prefill 与 decode 瓶颈不同：[推理原理：KV Cache、PagedAttention 与 continuous batching](./16-inference-principles)
- 显存预算与块池大小：[GPU 环境基础](./02-gpu-environment-basics)
- RAG 侧的检索与排序：《最小 RAG（Simple RAG）系统》《生产化 RAG：可靠管线与常见问题排查》
- 多轮对话数据怎么变成训练数据：《训练数据准备与清洗：TRL 数据集格式全解》

---

> **来源**：抓取于 2026-09-19。① "机制决定写法"一节译自 vLLM 官方设计文档 [Automatic Prefix Caching（design）](https://github.com/vllm-project/vllm/blob/main/docs/design/prefix_caching.md)——块哈希三元组、"只缓存完整块"、`sha256` 自 v0.11 起为默认、多模态图像哈希、`cache_salt` 隔离、数据结构与 allocate/free/LRU 驱逐流程（含"释放时逆序入队"的理由）均为原文内容；② 收益场景与限制（long document query、multi-round conversation、"只加速 prefill 不加速 decode"）译自特性文档 [Automatic Prefix Caching](https://github.com/vllm-project/vllm/blob/main/docs/features/automatic_prefix_caching.md)；③ 混合 Mamba 的 `--mamba-cache-mode align`/`--prefix-match-unit`/`--enable-mamba-fine-grained-prefix-cache` 及其四个生效条件同出自该特性文档；④ KV 卸载一节译自 [KV Offloading Usage Guide](https://github.com/vllm-project/vllm/blob/main/docs/features/kv_offloading_usage.md)（`OffloadingConnector`、`spec_name`、`cpu_bytes_to_use`、`block_size`、`eviction_policy`、`store_threshold`、`offload_prompt_only`、`max_load_tokens`、DMA 异步传输与支持硬件范围）；⑤ 指标名与"命中率用两个 counter 而非 gauge"的取舍依据译自 [Metrics 设计文档](https://github.com/vllm-project/vllm/blob/main/docs/design/metrics.md)；⑥ 冷热对照实验的官方建议（`vllm bench serve` 的 random 数据集 `--seed` 默认 0、`vllm bench sweep serve` 每轮重置服务端缓存）译自 [Benchmark CLI](https://docs.vllm.ai/en/latest/benchmarking/cli.html)，`/reset_prefix_cache` 端点与 `VLLM_SERVER_DEV_MODE` 的关系核对自仓库 `vllm/envs.py` 注释。作者 vLLM 项目，许可 Apache 2.0。参数与默认值另经 v0.29.0 对应 main 分支源码 `vllm/config/cache.py`（`DEFAULT_BLOCK_SIZE = 16`、`enable_prefix_caching = True`、`prefix_caching_hash_algo = "sha256"`）、`vllm/config/lora.py`、`vllm/engine/arg_utils.py`、`vllm/config/observability.py` 逐条核对。多轮对话与 RAG 的 prompt 布局建议、片段确定性排序、预热做法、排查表、成本换算式与三段示例代码为编者整理，非原文内容；命中率与显存权衡的实际数值请以你自己的业务评测与压测为准。
