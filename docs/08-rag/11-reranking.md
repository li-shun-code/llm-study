---
title: 重排序：Cross-Encoder 精排与 LLM 打分成本对照
source_url: https://github.com/UKPLab/sentence-transformers
author: Sentence Transformers 团队（UKPLab，TU Darmstadt）；BAAI（bge-reranker 系列）；Qwen 团队（Qwen3-Reranker）；Cohere（Rerank API）；阿里云百炼（文本排序 API 规格）；Nir Diamant（RAG_Techniques，LLM 逐条打分路线的出处）
license: Apache-2.0（sentence-transformers）；MIT（FlagEmbedding 代码）；Apache-2.0（bge-reranker-v2-m3、Qwen3-Embedding 权重）；bge-reranker-base 权重 MIT；署名转载（Cohere/百炼文档段落、RAG_Techniques notebook）
fetched_at: 2026-09-19
translated: true
versions: sentence-transformers 6.1.0、torch 2.14.0(CPU)、transformers 5.17.0、Python 3.14、Apple M4 16GB；模型 BAAI/bge-reranker-base、BAAI/bge-reranker-v2-m3、BAAI/bge-small-zh-v1.5
order: 11
group: 检索层：相似度、过滤、混合与重排
---

## 先给结论

| 你的情况 | 建议 | 理由（本文实测/官方规格） |
| --- | --- | --- |
| 初检 recall@10 已经 ≥ 0.90，且下游只读 top-3 | **不要加重排** | 重排只在这 20 个候选里换顺序，召回没救上来就是没救上来，换来的是每条查询几倍延迟 |
| 初检 recall@10 在 0.6~0.85、延迟预算 >200ms | 加 **Cross-Encoder**（`bge-reranker-v2-m3` / `Qwen3-Reranker-0.6B`），初检 k 取 20-50，重排后留 3-5 | 精排是"顺序修正"，正是 recall 够但排序差时的对症药 |
| 块很长（>512 token）、或答案在长文档中后段 | 必须选**长上下文 reranker**（`bge-reranker-v2-m3` 8192 / `Qwen3-Reranker` 32K / 百炼 `qwen3.7-text-rerank` 单条 30,000 token） | 512 窗口的 reranker 会把长块截断，本文 q7 实验里同一篇块 joint 长度 645 token 直接被砍 |
| 只有 CPU、并发高、P95 要 <150ms | 不加重排，或改用**同族小模型 + 缓存** | 实测 278M 的 `bge-reranker-base` 在 CPU 上 20 对/查询要 1.37 秒 |
| 相关性定义很"主观"（合规、风险、跨表推理），且要批量离线跑 | 才考虑 LLM 逐条打分；在线路径请用**它蒸馏出的 CE** | 一次调用一个候选、分数不可跨查询比较、延迟与费用都是 CE 的数量级以上 |
| 想"看起来高级"地全链路都排一遍 | 先把评测集建起来再决定 | 本文实测：**换不同 reranker，nDCG@10 有涨有跌**，不是默认增益 |

## 一、为什么主路线是 Cross-Encoder

### 1.1 双编码器打不过交叉编码器的那件事

```
Bi-Encoder（嵌入检索，第一阶段）        Cross-Encoder（重排，第二阶段）

 query ──[encoder]──► q_vec            ┌───── query ─────┐
                                        │                 │  全部 token 之间
 doc   ──[encoder]──► d_vec             └───── doc ───────┘  做自注意力交互
        │                                     │
        ▼                                     ▼
   一次内积 ──► 分数                      [encoder × N] ──► 相关性标量
   （可对全库，毫秒级）                  （每对一次前向，只能用在几十条上）
```

| 维度 | Bi-Encoder（稠密检索） | Cross-Encoder（重排） |
| --- | --- | --- |
| 文档向量 | **可离线预计算**，索引常驻 | 无独立向量，`query` 与 `doc` 必须成对现算 |
| 打分复杂度 | 一次前向（查询）+ ANN | 候选数 × 一次前向 |
| 词-词交互 | 只有池化后的相似度 | 注意力层里逐 token 交互 |
| 典型用途 | 从百万块里捞 top-50 | 把 top-50 精排成 top-5 |
| 常见失败 | 词面不匹配、长块被平均成"糊"向量 | 截断（窗口小）、慢、分数不可跨查询比较 |

这就是"先粗召回、后精排"两阶段架构的物理原因：**Cross-Encoder 的效果优势建立在 O(候选数) 次前向之上**，所以它只能待在漏斗末端。

官方描述（Sentence Transformers v6 `CrossEncoder` 类文档字符串，本文按 `site-packages` 内源码核对）：

> "A CrossEncoder does not produce sentence embeddings. Instead, it processes both sentences jointly through the transformer and outputs a score (regression) or class probabilities (classification). This makes it more accurate for pairwise tasks like reranking or semantic textual similarity, but it cannot pre-compute embeddings for individual sentences."

### 1.2 2026 年的"现代 reranker"分三类

| 类别 | 代表（官方口径） | 关键参数 | 打分方式 |
| --- | --- | --- | --- |
| Encoder-only CE（BERT/XLM-R 骨干） | `cross-encoder/ms-marco-MiniLM-L6-v2`、`BAAI/bge-reranker-base`（278M，512 窗口）、`BAAI/bge-reranker-v2-m3`（568M，8192 窗口，多语言）、`gte-multilingual-reranker-base`(0.3B)、`Jina-multilingual-reranker-v2-base`(0.3B) | 快、便宜、CPU 可跑 | 回归头输出一个 logit（可 sigmoid 到 0-1） |
| LLM 骨干 reranker | `Qwen3-Reranker-0.6B/4B/8B`（32K）、`BAAI/bge-reranker-v2-gemma`、`bge-reranker-v2-minicpm-layerwise`（可选输出层数加速）、`bge-reranker-v2.5-gemma2-lightweight`（可选层 + 压缩比） | 更准、更贵、支持指令 | 因果 LM 对 `yes`/`no` 两个 token 取 logits，`log_softmax` 后取 `exp` 作为相关概率 |
| 托管 API | Cohere `rerank-v4.0-pro` / `rerank-v4.0-fast`（另有 `rerank-v3.5`、`rerank-english-v3.0`/`rerank-multilingual-v3.0`）；阿里云百炼 `qwen3-rerank`（单条 4,000 token、最多 500 文档）、`qwen3.7-text-rerank`（单条 30,000 token、500 文档）、`gte-rerank-v2` | 免运维，按 token 计费 | 服务端返回 `relevance_score`，一次请求排完所有候选 |

> 注意一个时间点：百炼文档明确 `gte-rerank` **将于 2026-05-30 下线**，推荐改用 `qwen3-rerank`。旧教程里成片出现的 `gte-rerank` 调用要迁。

Qwen3-Reranker 的打分机制值得看一眼，它是"LLM 骨干 reranker"与"通用 LLM 打分"的分界线（译自官方 README）：把 `Instruct/Query/Document` 拼好后，外面包一段固定系统提示——"判断 Document 是否满足 Query 与 Instruct 的要求，答案只能是 yes 或 no"——然后**只取最后一个 token 位置上的 `yes`/`no` 两个 logit** 做归一化：

```python
# 机制节选（完整代码见 QwenLM/Qwen3-Embedding README "Reranker Model" 一节）
batch_scores = model(**inputs).logits[:, -1, :]           # 只看最后一个位置
true_vector, false_vector = batch_scores[:, token_true_id], batch_scores[:, token_false_id]
batch_scores = torch.stack([false_vector, true_vector], dim=1)
batch_scores = torch.nn.functional.log_softmax(batch_scores, dim=1)
scores = batch_scores[:, 1].exp().tolist()                # P("yes") 即相关性分
```

区别在于：这是**为排序训练过的判别式头部**（哪怕挂在 LLM 上），输出的是可比较的实数；而"让 GPT 随口给 1-10 分"没有任何校准。第四节把后者降级为成本对照。

## 二、可跑的前后对比实验：初检 recall@k → 重排后 nDCG@k

评测集沿用《Embedding 模型选型：四轴决策与本地实测》第三节的 `corpus_zh.py`（45 块 / 10 查询 / 分级标注 qrels）。把那个文件放在同一目录即可运行本节的两个脚本。

### 2.1 环境

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "sentence-transformers>=6.1" numpy "rank-bm25==0.2.2" "jieba>=0.42.1"
# 国内网络拿不到 Hugging Face 时，用官方 ModelScope 镜像取同一批权重：
pip install modelscope
python -c "from modelscope import snapshot_download; print(snapshot_download('BAAI/bge-reranker-v2-m3'))"
```

### 2.2 指标与初检（复用选型篇的实现）

指标全部从选型篇 §3.3 的 `emb_bench.py` 里导入，避免同一模块内两份 nDCG 实现互相漂移：

```python
import numpy as np

import corpus_zh as C
from emb_bench import (bm25_search, embedding_search, mrr_at_k, ndcg_at_k,
                       precision_at_k, recall_at_k)     # 《Embedding 模型选型：四轴决策与本地实测》§3.3


def report(ranked_by_q, label):
    """打印一行的前后对比：recall@3/5/10 + nDCG@10 + MRR@10 + P@5。"""
    m = lambda k, fn: np.mean([fn(ranked_by_q[q], C.QRELS[q], k) for q in C.QUERIES])
    print(f"{label} | R@3 {m(3, recall_at_k):.3f} | R@5 {m(5, recall_at_k):.3f} | "
          f"R@10 {m(10, recall_at_k):.3f} | nDCG@10 {m(10, ndcg_at_k):.3f} | "
          f"MRR@10 {m(10, mrr_at_k):.3f} | P@5 {m(5, precision_at_k):.3f}")
```

### 2.3 重排：一次前向一对候选

```python
import time

import torch
from sentence_transformers import CrossEncoder, SentenceTransformer

torch.set_num_threads(8)                      # 固定线程数，否则同机对比不可比

CANDIDATES = 20                               # 初检召回宽度
TOP_N = 5                                     # 重排后真正送进 prompt 的篇数
RERANKER = "BAAI/bge-reranker-v2-m3"          # 或 "BAAI/bge-reranker-base"

dense_model = SentenceTransformer("BAAI/bge-small-zh-v1.5", device="cpu")
stages = {
    "BM25": bm25_search(),
    "bge-small-zh-v1.5": embedding_search(
        dense_model, "为这个句子生成表示以用于检索相关文章：")[0],   # embedding_search 返回 (search, stats)
}
reranker = CrossEncoder(RERANKER, device="cpu", max_length=512)
# 国内网络取不到 Hugging Face 时：modelscope.snapshot_download(...) 后把返回的本地路径传进来

for name, search in stages.items():
    base, reranked = {}, {}
    pairs_per_query, tokens_per_query, wall = [], [], 0.0

    for qid, q in C.QUERIES.items():
        cand = search(q, CANDIDATES)                          # [(doc_id, 初检分), ...]
        base[qid] = cand
        pairs = [[q, C.TEXTS[d]] for d, _ in cand]
        pairs_per_query.append(len(pairs))                    # 空池也计 0，平均值才有意义
        tokens_per_query.append(sum(
            len(reranker.tokenizer(q, C.TEXTS[d], truncation=False)["input_ids"]) for d, _ in cand))
        if not cand:
            reranked[qid] = []                                # 初检为空 → 重排无事可做，这条要单独统计
            continue
        t0 = time.perf_counter()
        scores = reranker.predict(pairs, batch_size=8, convert_to_numpy=True)
        wall += time.perf_counter() - t0
        reranked[qid] = [cand[i] for i in np.argsort(-scores)]

    print(f"\n=== {name} → {RERANKER.split('/')[-1]}（候选 {CANDIDATES}）===")
    report(base, "重排前")
    report(reranked, "重排后")
    print(f"代价：{np.mean(pairs_per_query):.1f} 对/查询、{np.mean(tokens_per_query):.0f} token/查询、"
          f"CPU 精排 {wall / len(C.QUERIES) * 1000:.0f} ms/查询（含空池查询）")
```

```python
# 对照组（§2.5）：初检换成 bge-large-zh-v1.5、reranker 不截断
RERANKER = "BAAI/bge-reranker-v2-m3"
dense_model = SentenceTransformer("BAAI/bge-large-zh-v1.5", device="cpu")
reranker = CrossEncoder(RERANKER, device="cpu", max_length=2048)   # 让 645 token 的那一对完整进模型
```

官方还给了一个更省事的评测器——`CrossEncoderRerankingEvaluator`，样本里用 `documents`（已按初检顺序排好的候选列表）而不是 `negative`，它会**同时报告重排前后**的 MRR@k、nDCG@k 与 MAP（源码：`sentence_transformers/cross_encoder/evaluation/reranking.py`，`primary_metric = f"ndcg@{at_k}"`）：

```python
from sentence_transformers import CrossEncoder
from sentence_transformers.cross_encoder.evaluation import CrossEncoderRerankingEvaluator

samples = [{
    "query": q,
    "positive": [C.TEXTS[d] for d, g in C.QRELS[qid].items() if g == 2],   # 完全相关
    "documents": [C.TEXTS[d] for d, _ in base[qid]],                       # 初检已排序的候选池
} for qid, q in C.QUERIES.items()]

model = CrossEncoder("BAAI/bge-reranker-v2-m3", device="cpu")
print(model.evaluate(CrossEncoderRerankingEvaluator(samples, at_k=10, name="ops-zh-eval")))
```

### 2.4 实测结果（macOS / Apple M4 / CPU，2026-09-19）

初检候选 20 条（BM25 用选型篇 §3.3 的参数 `k1=1.2, b=0.4`，10 条查询平均命中 5 个候选），重排在同一池内换序，指标只在 top-k 上算：

| 管线 | recall@3 | recall@5 | recall@10 | nDCG@10 | MRR@10 | P@5 | 对/查询 | token/查询 | CPU 精排延迟 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BM25（无重排） | 0.533 | 0.583 | 0.583 | 0.709 | 0.850 | 0.280 | — | — | — |
| BM25 → `bge-reranker-base`（278M / 512） | 0.483 ↓ | 0.583 | 0.583 | 0.687 ↓ | 0.775 ↓ | 0.280 | 5 | 422 | 339 ms |
| BM25 → `bge-reranker-v2-m3`（568M / 8192） | 0.533 | 0.583 | 0.583 | **0.770 ↑** | **0.900 ↑** | 0.280 | 5 | 422 | 973 ms |
| `bge-small-zh-v1.5`（无重排） | 0.717 | 0.750 | 0.850 | 0.882 | 1.000 | 0.360 | — | — | — |
| `bge-small-zh-v1.5` → `bge-reranker-base` | 0.650 ↓ | 0.783 ↑ | 0.867 ↑ | 0.834 ↓ | 0.900 ↓ | 0.380 ↑ | 20 | 1,469 | 890 ms |
| `bge-small-zh-v1.5` → `bge-reranker-v2-m3` | 0.683 ↓ | **0.783 ↑** | 0.833 ↓ | **0.914 ↑** | 1.000 | **0.380 ↑** | 20 | 1,469 | 2,688 ms |

**这张表最重要的信息是"它没有全线上涨，而且换一档 reranker 结论方向就会翻"。** 逐条读：

1. **召回侧确实受益**：稠密初检 recall@5 0.750 → 0.783、P@5 0.360 → 0.380（两个 reranker 都一样）。Cross-Encoder 把双编码器排偏的"部分相关"顶上来了。
2. **排序侧分档**：`bge-reranker-base` 把 nDCG@10 从 0.882 拖到 0.834、MRR@10 从 1.000 拖到 0.900，而 `bge-reranker-v2-m3` 把 nDCG@10 抬到 0.914、MRR@10 守住 1.000。base 的问题不是代码，而是**它与这份中文短块语料的分布不合**：这条稠密初检的 MRR 已经打满（每条查询第一名都命中完全相关文档），base 在重打分时把 grade=1 的块（往往更长、更像"答案句"）抬到 grade=2 之前，而 nDCG/MRR 恰好惩罚这种区分错误——278M、512 窗口、中英混训的上一代模型在这种小语料上很容易踩到。**换更强的多语言 reranker，同一份数据的结论就正过来了**（BM25 池上同理：nDCG@10 0.709 → 0.770、MRR 0.85 → 0.90）。
3. **recall@10 从 0.850 掉到 0.833 是同一件事的另一面**：重排把某条查询的一个 grade=1 文档挤出了 top-10。**重排以"次序"换"边界"，所以必须 recall 与 nDCG 一起看**，只看一个指标会得出完全相反的结论。
4. **BM25 池的天花板在别处**：BM25 平均只凑到 5 个候选（`q10 内网域名解析时好时坏` 返回 0 条——文档里没有共享词），重排能把顺序修对（nDCG +6 个点），但**变不出没召回的文档**。这类失败该交给《混合检索：真正的 BM25、RRF 融合与生产实现》。
5. **代价必须记账**：278M 的 base 排 20 个候选要 0.89 秒、568M 的 v2-m3 要 2.69 秒，而第一阶段稠密检索只要 **2 毫秒**（选型篇实测）。**加不加 rerank，本质是把检索阶段延迟放大 400~1300 倍，去换 3 个点的 recall@5 与 3 个点的 nDCG@10。** 延迟预算 150ms 的在线场景这条直接不成立（除非上 GPU 或走 API）；离线批量重建索引、或"只给 top-1 做精排"则是另一笔账。
6. **截断在重排阶段同样静默**：`q7` 与 `d08` 拼成的一对，在 reranker 分词器下 645 token，超过 `max_length=512` → 被砍 133 token，而答案所在的"第 4 步 核对点表版本"正在被砍区间内（本机日志里那句 `Token indices sequence length is longer than the specified maximum sequence length (645 > 512)` 就是它）。`bge-reranker-v2-m3` 的 `config.json` 里 `max_position_embeddings` 是 8194，把 `max_length` 显式设到 2048 就能整篇读到；512 窗口的模型（`bge-reranker-base`、`ms-marco-MiniLM` 系列）遇到长块必然丢信息。

> 结论性建议：**先看瓶颈在哪一层。** 如果 recall@10 低（该给的没进池子），加重排是浪费时间——去修分块、加词法检索、换嵌入模型；如果 recall@10 高但 nDCG/MRR 低（进来了但顺序不对、或送给 LLM 的 5 篇里有噪声），重排才有肉。用《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》的四指标拆开看，5 分钟就能定这个案。

### 2.5 对照组：初检更强 + 重排不截断，收益形态会变

把第一阶段换成 `bge-large-zh-v1.5`（选型篇实测 recall@5 0.833、nDCG@10 0.915），并把 reranker 的 `max_length` 从 512 提到 2048（`d08` 那一对 645 token 不再被砍），其余配置不变：

| 管线 | recall@3 | recall@5 | recall@10 | nDCG@10 | MRR@10 | P@5 | token/查询 | CPU 延迟 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bge-large-zh-v1.5`（无重排） | 0.800 | 0.833 | 0.900 | 0.915 | 0.950 | 0.400 | — | 44 ms（初检延迟，选型篇实测） |
| `bge-large-zh-v1.5` → `bge-reranker-v2-m3`（`max_length=2048`） | 0.683 ↓ | 0.767 ↓ | 0.867 ↓ | **0.924 ↑** | **1.000 ↑** | 0.380 ↓ | 1,579 | 4,208 ms |

同一份语料、同一个 reranker，换了初检模型，**涨跌方向就变了**：排序类指标继续涨（nDCG +0.9 个点、MRR 打满），召回与精度类指标反而跌（初检本来 recall@5 0.833，重排把 grade=1 的块换出 top-5）。工程含义很直接：

- **初检已经很强时，重排的收益集中在"前几名谁排第一"**，如果你的下游只把 top-1 或 top-3 塞进 prompt，这笔买卖还划算；如果下游吃 top-10 全集，重排可能反而让你丢掉那 3 个点召回。
- **`max_length` 不是越短越划算**：同样是 20 个候选，512 → 2048 让精排从 2.69 秒涨到 4.21 秒（**+57%**），换来的是长块不被截断。要不要付这 57%，取决于你的块长分布（用选型篇那段数 token 的代码统计一次就知道）。
- 因此正确做法是**把 `k`、`top_n`、`max_length`、reranker 档位四项一起进网格**，在自有评测集上按"目标指标 + 延迟预算"选点，而不是照抄任何一篇教程（包括本篇）的结论。

## 三、各家 API 的正确写法（按官方文档/源码核对）

### 3.1 sentence-transformers（推荐，一个库覆盖 CE 与评估）

```python
from sentence_transformers import CrossEncoder

model = CrossEncoder("BAAI/bge-reranker-base", device="cpu",
                     max_length=512,          # 不写就会用模型自带窗口；显式设小能加速但会截断
                     num_labels=1)            # 1 = 回归头，输出连续相关性分

# 用法 A：给成对文本打分（默认对 logit 做 sigmoid，得到 0~1 分数）
scores = model.predict([["机柜功率密度太高怎么降温", "机柜功率密度超过 8kW 时建议改用行级空调……"],
                        ["机柜功率密度太高怎么降温", "UPS 电池组巡检重点看单节浮充电压离散度……"]],
                       batch_size=32, convert_to_numpy=True)

# 用法 B：直接排序（返回按分数降序的 corpus_id / score / 可选原文）
ranked = model.rank(query="Redis 集群报 CROSSSLOT",
                    documents=["Redis 集群模式下跨 slot 的多 key 命令会报 CROSSSLOT……",
                               "Redis 大 key 会造成命令阻塞与迁移失败……"],
                    top_k=3, return_documents=True)

# 想要原始 logit（不套 sigmoid）：activation_fn=None
logits = model.predict(pairs, activation_fn=None, convert_to_numpy=True)
```

三个容易写错的点（均按 v6.1.0 源码核对）：`predict` 默认 `activation_fn` 在 `num_labels=1` 时是 **sigmoid**，所以"分数被压缩到 0-1、不同模型间不可比"是正常现象；`rank()` 的返回是**已排序**的字典列表，`corpus_id` 指向传入 `documents` 的下标；`device=["cuda:0","cuda:1"]` 传列表会自动起多进程池（或先 `start_multi_process_pool()` 拿 `pool` 传入）。

### 3.2 FlagEmbedding（BGE 官方包）

```python
from FlagEmbedding import FlagReranker

reranker = FlagReranker("BAAI/bge-reranker-v2-m3",
                        query_max_length=256, passage_max_length=512,
                        use_fp16=True, devices=["cuda:0"])

print(reranker.compute_score([["what is panda?", "hi"],
                              ["what is panda?", "The giant panda is a bear species endemic to China."]]))
# [-8.1875, 5.26171875]        ← 原始 logit
print(reranker.compute_score([["what is panda?", "The giant panda …"]], normalize=True))
# [0.9948403768236574]         ← normalize=True 即套 sigmoid 到 0-1
```

LLM 骨干的两个变体在同一个包里，只是类不同，并**多出可调的推理预算旋钮**：

```python
from FlagEmbedding import FlagLLMReranker, LayerWiseFlagLLMReranker, LightWeightFlagLLMReranker

FlagLLMReranker("BAAI/bge-reranker-v2-gemma", use_fp16=True).compute_score(pairs)
# 选层输出：cutoff_layers=[28] 越早出结果越快
LayerWiseFlagLLMReranker("BAAI/bge-reranker-v2-minicpm-layerwise").compute_score(pairs, cutoff_layers=[28])
# 层 + token 压缩双旋钮
LightWeightFlagLLMReranker("BAAI/bge-reranker-v2.5-gemma2-lightweight").compute_score(
    pairs, cutoff_layers=[28], compress_ratio=2, compress_layers=[24, 40])
```

`cutoff_layers` / `compress_ratio` 是官方给"rerank 太贵"准备的正解：用**牺牲一点排序质量换延迟**，而不是回到"让通用 LLM 逐条打分"。

### 3.3 托管 API

百炼的文本排序接口是**一次请求排完所有候选**，规格限制要提前算进设计（官方文档所列）：

| 模型 | 最大文档数 | 单条最大输入 token | 请求最大输入 token |
| --- | --- | --- | --- |
| `qwen3-rerank` | 500 | 4,000 | 4,000 量级（按公式核算） |
| `qwen3.7-text-rerank` | 500 | 30,000 | 120,000（建议） |
| `qwen3-vl-rerank` | 文本 100 / 图片 40 / 视频 4 | 8,000 | 120,000 |

官方给的限制公式值得抄下来：**`Query Tokens × Document 数量 + Document Tokens 总和 ≤ 请求最大输入 Token`**，超了返回 400 且**不截断**。

```python
# pip install dashscope
import dashscope

resp = dashscope.TextReRank.call(
    model="qwen3-rerank",
    query="Redis 集群报 CROSSSLOT",
    documents=["Redis 集群模式下跨 slot 的多 key 命令会报 CROSSSLOT……",
               "Redis 大 key 会造成命令阻塞与迁移失败……"],
    top_n=3,
    return_documents=False,
)
for r in resp["results"]:
    print(r["index"], round(r["relevance_score"], 4))   # index 指向传入 documents 的下标
```

Cohere 侧当前主推 `rerank-v4.0-pro` / `rerank-v4.0-fast`（官方文档：一个模型即可覆盖多语言，替代了旧的 english/multilingual 分档）。用法同构：

```python
# pip install cohere
import cohere

co = cohere.ClientV2(api_key=COHERE_API_KEY)          # Key 从环境变量读取，勿写进代码
res = co.rerank(model="rerank-v4.0-pro",
                query="Redis 集群报 CROSSSLOT",
                documents=[{"text": t} for t in docs],
                top_n=3, return_documents=False)
print([(r.index, round(r.relevance_score, 4)) for r in res.results])
```

官方对 Rerank 的定位一句话：给定 query 与文档列表，**从最相关到最不相关重排索引**——它只解决顺序，不解决"该给的没进来"。

## 四、LLM 逐条打分：把它放成本对照那一栏

这条路线出自 `RAG_Techniques` 的 reranking notebook（作者 Nir Diamant，仓库自定义许可），原文用 `ChatOpenAI(temperature=0, model_name="gpt-4o")` + Pydantic 结构化输出，对每篇文档要一个 1-10 分。按当前稳定接口，代码是这样（注意 `max_completion_tokens` 已取代 `max_tokens`）：

```python
# pip install openai
import json
import os

from openai import OpenAI

client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])      # 不要硬编码 Key

PROMPT = """按 1-10 给下面的文档与查询的相关性打分，只输出 JSON：{"score": <数字>, "reason": "<一句话>"}。
查询：{query}
文档：{doc}"""


def llm_score(query: str, doc: str) -> float:
    resp = client.chat.completions.create(
        model="gpt-4o",
        temperature=0,
        max_completion_tokens=128,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": PROMPT.format(query=query, doc=doc[:2000])}],
    )
    return float(json.loads(resp.choices[0].message.content)["score"])


def llm_rerank(query: str, docs: list[str], top_n: int = 3) -> list[str]:
    return [d for d, _ in sorted(((d, llm_score(query, d)) for d in docs),
                                key=lambda x: x[1], reverse=True)[:top_n]]
```

**它贵在哪**（用第二节实测的 token 数直接换算，不含猜测）：

| 方案 | 一次请求能排几篇 | 每查询输入 token | 调用次数 | 备注 |
| --- | --- | --- | --- | --- |
| Cross-Encoder 自托管（278M，CPU） | 20（一次批量前向） | 1,469（实测） | 0 次网络调用 | 实测 1.37s/查询，CPU |
| Cohere / 百炼 rerank API | 500（官方上限内） | 同上量级，服务端计费 | 1 次 | 返回校准过的 `relevance_score` |
| LLM 逐条打分（k=20） | **1** | 1,469 + 20 × 指令模板开销 | **20 次** | 每次都要重新发一遍查询与指令 |

也就是说 LLM 打分的**请求次数是候选数倍**、**输入 token 至少两倍以上**（查询与指令被重复发 20 遍），还额外吃满 LLM 的排队与网络长尾。更要紧的三个非成本问题：

1. **分数没有可比性**：同一个 reranker 对同一篇给 5.9、另一篇给 6.1 是有意义的相对序；LLM 今天给"6 分"的含义和明天不一样，跨查询、跨批次都不能拿来卡阈值（同《检索层 IR 指标》里"绝对阈值在词法检索上没有意义"是同一个坑，但 LLM 这里更严重）。
2. **位置偏置**：长 prompt 里模型对中段注意力更弱（见《经典论文精读：RAG 与 Lost in the Middle》），而"逐条打分"恰好把文档放在 prompt 的正中——偏置最大化。
3. **它排的是"看起来像答案"而不是"相关"**：LLM 会替文档补全常识，把没写的条件也当成写了。这类失败在端到端评估里表现为幻觉率上升，而不是排序指标下降，很难在检索层抓到。

**它真正的用途**是这两个：

- **标注生产机**：拿 LLM 给几千对 `(query, doc)` 打分级标签 → 蒸馏出一个小的 Cross-Encoder（`CrossEncoder.fit()`，或 FlagEmbedding 的 reranker 微调示例），线上跑 CE、离线用 LLM。这才是"LLM + 重排"的经济学正确姿势。
- **无法用排序表达的判断**：例如"这段是否包含某条合规条款的例外情形"，需要的是理由而不是名次——这时它做的是**过滤/判定**，交给它，但别把它当 reranker 的性能基线。

## 五、上线决策清单

1. **先测再加**：把 `重排前/重排后` 的 recall@k、nDCG@k、MRR@k 三行打进你的评测报告，任一指标下降就回退（本文实测就有下降项）。
2. **初检 k 与重排后 top_n 分开调**：`k` 决定 rerank 成本与召回上限（k 越大越贵、收益边际递减）；`top_n` 决定进 prompt 的上下文量（越小越省钱，但受 Lost-in-the-Middle 影响更小）。从 `k=20 / top_n=5` 起步。
3. **`max_length` 显式写死并核对块长 P95**：joint(query+doc) 超窗就是静默丢信息，长块场景直接选 8192/32K 窗口的 reranker。
4. **分数别跨模型/跨查询复用**：sigmoid 后的 0-1 不代表概率；要门控就在自己的标注集上把分数映射到"相关概率"（分位数表或 Platt scaling），或改用名次门控。
5. **查询级缓存**：高频短查询的 rerank 结果值得缓存（key = 归一化 query + 候选集合 hash），命中即省掉整条 1.4 秒。
6. **降级路径**：CE 超时/异常时退回初检顺序，而不是退回"让 LLM 打分"——后者更慢、更贵、同样会超时。
7. **别在混合检索与重排之间省一步**：先用 RRF 融合出候选池，再精排，两步的失败模式不同（见《混合检索：真正的 BM25、RRF 融合与生产实现》）。

## 常见坑

1. 把 `predict` 的 sigmoid 分当概率，用它卡 0.5 阈值——分数量纲与训练目标绑定，换模型即失效。
2. **给 reranker 传"文档 + 元数据 + 分块序号"拼成的长文本**：额外 token 挤占窗口、还可能被当成内容相关性，正确做法是只喂正文，元数据交给过滤层（见《元数据过滤与多维过滤检索》）。
3. `top_k` 与 `top_n` 混用：`rank(top_k=n)` 已经截断，再自己切片会看不出是哪一步丢的文档。
4. 忘记 reranker 也参与**长尾延迟**：批量打分时 batch 内最长的一条决定该批耗时，候选池里混进 8000 token 的块会让 P99 爆炸；先按长度分桶再排。
5. 用英文 CE（`ms-marco-MiniLM` 系列）排中文：窗口小（512）之外，训练分布也偏英文短答案段，中文短块上经常不如嵌入模型自己排。
6. 以为"重排能补召回"：候选池里没有的文档，任何 reranker 都变不出来。
7. 多卡部署时把 `device="cuda"` 写死：CE 的 batch 前向才是瓶颈，同进程 `device=["cuda:0","cuda:1"]`（v6 自动起进程池）比换更大的模型划算。

## 延伸阅读

- [Sentence Transformers：Cross-Encoder 与预训练重排模型](https://www.sbert.net/)（Apache-2.0）：`CrossEncoder`、`CrossEncoderRerankingEvaluator`、`model.rank()`、训练重排器的博客专题。
- [FlagOpen/FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding)（MIT）：`FlagReranker` / `FlagLLMReranker` / Layerwise / Lightweight 四类接口与 `normalize`、`cutoff_layers` 语义。
- [QwenLM/Qwen3-Embedding](https://github.com/QwenLM/Qwen3-Embedding)（Apache-2.0）：Qwen3-Reranker 的 yes/no 打分实现与官方 reranker 对照分（MTEB-R / CMTEB-R / MMTEB-R / MTEB-Code / FollowIR，均由 `Qwen3-Embedding-0.6B` 召回 top-100 后统一评测）。
- [Cohere Rerank 文档](https://docs.cohere.com/docs/rerank-overview)：模型档位（`rerank-v4.0-pro` / `-fast`、`rerank-v3.5`）与多语言支持说明。
- [阿里云百炼 文本排序 API](https://help.aliyun.com/zh/model-studio/text-rerank-api)：各模型的最大文档数、单条 token 上限与请求 token 计算公式；`gte-rerank` 下线公告。
- 官方 reranker 对照分数（Qwen3-Embedding README 表，同一 top-100 候选池下的公平比较）：`BGE-reranker-v2-m3` MTEB-R 57.03 / CMTEB-R 72.16、`gte-multilingual-reranker-base` 59.51 / 74.08、`Jina-multilingual-reranker-v2-base` 58.22 / 63.37、`Qwen3-Reranker-0.6B` 65.80 / 71.31、`4B` 69.76 / 75.94、`8B` 69.02 / **77.45**；作为对照，纯稠密检索 `Qwen3-Embedding-0.6B` 同池分数是 61.82 / 71.02。
- 站内相关：《Embedding 模型选型：四轴决策与本地实测》《混合检索：真正的 BM25、RRF 融合与生产实现》《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》《经典论文精读：RAG 与 Lost in the Middle》《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》《多向量检索与 ColBERT/ColPali：后期交互的用法与选型》。

---

> **来源**：抓取于 2026-09-19。Cross-Encoder 机制、`predict/rank/evaluate` 接口与 `CrossEncoderRerankingEvaluator` 的重排前后指标口径，核对自 [UKPLab/sentence-transformers](https://github.com/UKPLab/sentence-transformers)（Apache-2.0）v6.1.0 源码与其文档；`FlagReranker` 系列用法与示例输出译自 [FlagOpen/FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding) 的 `examples/inference/reranker/README.md`（MIT）；Qwen3-Reranker 打分机制与官方对照分数译自 [QwenLM/Qwen3-Embedding README](https://github.com/QwenLM/Qwen3-Embedding)（Apache-2.0）；Rerank 定位与模型档位译自 [Cohere Rerank 文档](https://docs.cohere.com/docs/rerank-overview)；托管接口规格引自 [阿里云百炼文本排序 API 文档](https://help.aliyun.com/zh/model-studio/text-rerank-api) 与 [通用文本向量 API 文档](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)；"LLM 逐条打分"路线的原始实现与叙述来自 [Reranking Methods in RAG Systems](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reranking.ipynb)（Nir Diamant，自定义许可：非商业使用、需署名）。
> 编者注：本文的路线组织（Cross-Encoder 为主、LLM 打分降级为成本对照）、全部实测数字与"重排未必涨点"的结论为本站编写与本机实跑（macOS + Apple M4 + 16GB + CPU 推理，`sentence-transformers 6.1.0` / `torch 2.14.0`，`bge-small-zh-v1.5`、`bge-base-zh-v1.5`、`bge-m3`、`Qwen3-Embedding-0.6B`、`bge-reranker-base`、`bge-reranker-v2-m3`）；原 notebook 中的旧版 LangChain `RetrievalQA` 链与 `max_tokens` 参数已按当前稳定接口改写，改写处均在文中标注。评测语料与相关性标注由本站编写，不含真实生产数据。
