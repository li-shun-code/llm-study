---
title: 检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定
source_url: https://arxiv.org/abs/2104.08663
author: Paul Thomas 等（Google，TREC-RAG 评测框架）；scikit-learn 文档团队（排序指标定义）；Elastic 官方文档（BM25 参数与解释）
license: arXiv 预印本署名转载；scikit-learn 文档 BSD-3-Clause；Elastic 博客 CC BY 4.0
fetched_at: 2026-09-19
translated: true
versions: rank-bm25 0.2.2；jieba 0.42.x；numpy 2.x；scikit-learn 1.9.1（交叉校验用）；Python 3.10+
order: 13
group: 检索层：相似度、过滤、混合与重排
---
## 为什么要在检索层单独量

端到端评估（《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》）能告诉你"答得对不对"，但回答不了"**该给的那段话有没有被捞上来**"。检索与生成是两个可独立失败的环节：

- 正确段落**没进 top-k** → 再强的模型也答不出，这是检索的问题；
- 正确段落**进了 top-k 但排在第 5 位**、被截断或落在上下文中间 → 是排序与 prompt 组装的问题（见《经典论文精读：RAG 与 Lost in the Middle》）；
- 段落进来了、位置也对，模型还是瞎说 → 才是生成的问题。

把这三层拆开、每一层用**便宜、可复现、不需要 GPU 与 API Key** 的 IR 指标度量，是 RAG 能提速迭代的唯一办法：改一次分块策略跑 200 条端到端评估要几十块钱、十几分钟；跑一次 recall@5 只要几秒。本篇不需要任何嵌入模型，纯 Python 就能跑完。

## 一、四个指标各自回答一个问题

设一次查询的相关文档集合为 $R$（带分级相关性 $g(d) \in \{0,1,2\}$），系统返回的排序列表前 $k$ 项记作 $\text{ranked}_k$。

| 指标 | 定义 | 回答的问题 | 什么时候用 |
| --- | --- | --- | --- |
| recall@k | $\lvert \text{ranked}_k \cap R\rvert / \lvert R\rvert$ | 该找到的找到了几成 | 初检（宽召回）阶段的主指标 |
| precision@k | $\lvert \text{ranked}_k \cap R\rvert / k$ | 返回的东西有多干净 | 展示型搜索、给用户列结果的场景 |
| MRR@k | 第一条相关文档的名次 $r$ 的倒数 $1/r$，全查询取均值 | 用户/模型要往下看几条 | 单跳事实问答、Agent 取第一条就用 |
| nDCG@k | $\text{DCG@k}/\text{IDCG@k}$，增益 $2^{g}-1$，折扣 $1/\log_2(\text{rank}+1)$ | 相关的是不是排在前面（含分级） | 有分级标注、要比较不同排序器 |

三个最容易混的点：**MRR 只看第一条**（第五条才对只有 0.2，若下游把 top-5 全塞进 prompt，MRR 的意义就不大）；**nDCG 需要分级标注**（只有 0/1 时它与 recall/precision 高度相关，看不出额外信息）；**k 必须写进指标名**（recall@5 与 recall@20 是两个世界的数字）。

### 1.1 手算一遍：同一条查询，两种顺序，四个指标怎么变

标注 `qrels = {A:2, B:1, C:1}`（A 完全相关，B、C 部分相关），候选池 5 条。

**排序一：A, X, B, Y, C**（X、Y 不相关）

| 名次 | 文档 | 等级 g | 增益 $2^g-1$ | 折扣 $1/\log_2(i+2)$ | 乘积 |
| --- | --- | --- | --- | --- | --- |
| 1 | A | 2 | 3 | 1.0000 | 3.0000 |
| 2 | X | 0 | 0 | 0.6309 | 0 |
| 3 | B | 1 | 1 | 0.5000 | 0.5000 |
| 4 | Y | 0 | 0 | 0.4307 | 0 |
| 5 | C | 1 | 1 | 0.3869 | 0.3869 |

- `DCG@5 = 3 + 0.5 + 0.3869 = 3.8869`
- 理想排序（把标注里的 2、1、1 放在最前）：`IDCG@5 = 3/1 + 1/1.585 + 1/2 = 4.1309`
- **nDCG@5 = 3.8869 / 4.1309 = 0.9409**
- recall@5 = 3/3 = **1.000**；precision@5 = 3/5 = **0.600**；MRR = 1/1 = **1.000**

**排序二：X, B, Y, A, C**（同样的三条相关文档，只是顺序变了）

- `DCG@5 = 1/1.585 + 3/2.322 + 1/2.585 = 0.6309 + 1.2921 + 0.3869 = 2.3098` → **nDCG@5 = 0.5592**
- recall@5 仍然是 **1.000**（三条都在 top-5 里）、precision@5 仍然是 **0.600**、MRR 掉到 **0.500**、recall@3 只有 **0.333**

一句话总结这张对照表：**recall@5 对"顺序"完全失明**（1.000 vs 1.000），**nDCG 把它量化了**（0.9409 vs 0.5592），**MRR 只关心第一条相关文档出现的位置**。所以初检看 recall、精排看 nDCG、取单条的场景看 MRR——三者不是重复劳动。

### 1.2 一个必须知道的实现差异：scikit-learn 的 nDCG 用的是线性增益

TREC 与各家检索库默认 **指数增益** $2^g-1$；scikit-learn 的 `ndcg_score` 默认用**线性增益** $g$（其源码 `sklearn/metrics/_ranking.py` 里 `discount = 1 / (np.log(np.arange(...) + 2) / np.log(log_base))` 之后直接 `discount.dot(ranked.T)`，没有 `2**g - 1`）。同一份数据两种口径的差值会随等级增大而放大：

```python
from sklearn.metrics import ndcg_score

order = [2, 0, 1, 0, 1]                      # 排序一：各名次的相关等级
print(ndcg_score([order], [[5, 4, 3, 2, 1]], k=5))   # 0.9220 ← scikit-learn 口径（线性增益）
# 手写指数增益口径：0.9409（见 §1.1）
```

结论：**跨论文/跨库比对 nDCG 之前，先确认增益口径**。本篇与模块内其他文章统一用指数增益（TREC 惯例）。MTEB 检索任务报告的是 `nDCG@10`，比对前先确认对方口径。

## 二、可跑实现：BM25 + 四个指标 + 阈值实验

评测集沿用《Embedding 模型选型：四轴决策与本地实测》第三节的 `corpus_zh.py`（本模块共用：45 块中文运维/后端知识、10 条查询、每条 2-3 篇分级标注）。指标函数复用同一份 `emb_bench.py`，本节只补 BM25 与报告部分：

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "rank-bm25==0.2.2" "jieba>=0.42.1" numpy "scikit-learn>=1.4"   # sklearn 仅用于 §1.2 交叉校验
```

```python
import re

import jieba
import numpy as np
from rank_bm25 import BM25Okapi

import corpus_zh as C
from emb_bench import mrr_at_k, ndcg_at_k, precision_at_k, recall_at_k

jieba.setLogLevel(60)
STOP = set("的 了 是 在 和 与 会 要 可 以 及 对 中 上 下 时 为 个 这 那 也 都 就 不 吗 呢 ".split())


def tok(text):
    """jieba 切词 + 过滤停用词与单字。'8kW'、'504' 这类单位/状态码靠 len>1 兜住。"""
    text = re.sub(r"\s+", "", text.lower())
    return [t for t in jieba.lcut(text) if len(t) > 1 and t not in STOP]


bm25 = BM25Okapi([tok(t) for _, t in C.PASSAGES], k1=1.2, b=0.75)


def search(query, k=10):
    """返回打分 > 0 的前 k 篇：BM25 对不含任何查询词的文档给 0 分，必须剔除。"""
    scores = bm25.get_scores(tok(query))
    order = [i for i in np.argsort(-scores) if scores[i] > 0]
    return [(C.IDS[i], float(scores[i])) for i in order[:k]]


ranked = {qid: search(q, 10) for qid, q in C.QUERIES.items()}

print(f"语料 {len(C.PASSAGES)} 块 / 查询 {len(C.QUERIES)} 条 / k1=1.2 b=0.75")
print(f"{'k':<4}{'recall@k':>10}{'precision@k':>12}{'nDCG@k':>9}{'MRR@k':>8}")
for k in (1, 2, 3, 5, 8, 10):
    mean = lambda kk, fn: np.mean([fn(ranked[q], C.QRELS[q], kk) for q in C.QUERIES])
    print(f"{k:<4}{mean(k, recall_at_k):>10.3f}{mean(k, precision_at_k):>12.3f}"
          f"{mean(k, ndcg_at_k):>9.3f}{mean(k, mrr_at_k):>8.3f}")
```

实跑输出（macOS + Python 3.14 + `rank-bm25 0.2.2` + `jieba`，2026-09-19）：

```text
语料 45 块 / 查询 10 条 / k1=1.2 b=0.75
k     recall@k precision@k   nDCG@k   MRR@k
1        0.317       0.800    0.733   0.800
2        0.467       0.550    0.693   0.850
3        0.533       0.433    0.698   0.850
5        0.583       0.280    0.709   0.850
8        0.583       0.175    0.709   0.850
10       0.583       0.140    0.709   0.850
```

这张曲线本身就是诊断结论，读法四条：

1. **recall@1 只有 0.317，recall@5 0.583**：BM25 经常"捞到了但排不到第一"，也有一批查询**根本捞不到**——口语化提问与文档措辞不共享词（`q4 告警太多值班疲于应对` 对文档里的"告警疲劳"）。这正是词法检索的天花板，也是《混合检索：真正的 BM25、RRF 融合与生产实现》要解决的精确问题。
2. **recall@5 = recall@8 = recall@10 = 0.583**：候选池太小，k 增大时后面全是空位。**k 超过候选池大小时指标会骗人**——务必同时打印每查询候选数（本例 BM25 平均只有 3.3 条候选）。
3. **precision@k 从 0.800 单调掉到 0.140**：这是定义使然（分母是 k），别把它当"质量下降"读；要判断质量得看 recall 与 nDCG。
4. **nDCG@1 = 0.733、nDCG@5 = 0.709：k 越小反而分越高**。小 k 下未召回的相关文档根本不在窗口里，理想排序也只有 1 条可排，分母一起缩小，分数被抬高；本例 MRR@1 已经 0.800（10 条里 8 条第一名就是相关文档）。**同一份结果，不同 k 讲的是不同故事，报数必须带 k。**

`k1` 控制词频饱和（越大越看重重复词，1.2~2.0 常见），`b` 控制长度归一化（0 不归一化、1 完全归一化）。上面刻意用 `b=0.75`（英文经验值）跑一遍：中文分词后块长差异被放大，`b` 在 0.4~0.6 通常更稳——把 `b` 当超参在**你自己的评测集**上扫，别照搬。

## 三、阈值与 top-k 怎么定：不要卡分数，要卡名次 + 相对差

"取几条"和"分数低于多少就不要"是两个独立决策。先看这份语料的真实分数分布（同一份代码，把 top-1 分数与相邻差打出来）：

```python
print("=== BM25 top1 分数分布（10 条查询）===")
tops = [ranked[q][0][1] for q in C.QUERIES if ranked[q]]
print(f"min={min(tops):.2f} median={np.median(tops):.2f} max={max(tops):.2f}")

print("=== 逐查询：top1 分数 / top1-top2 差距 / 候选数 / 第 2 名是否相关 ===")
for qid, q in C.QUERIES.items():
    r = ranked[qid]
    if not r:
        print(f"{qid} 候选数=0（与全部文档零共享词）")
        continue
    gap = (r[0][1] - r[1][1]) if len(r) > 1 else r[0][1]
    tag = "相关" if len(r) > 1 and C.QRELS[qid].get(r[1][0], 0) > 0 else "不相关"
    print(f"{qid} top1={r[0][1]:5.2f} gap={gap:5.2f} 候选数={len(r)} 第2名{tag}")

print("=== 阈值实验：score >= t 才收下各查询的 top5 候选 ===")
pool = [x for q in C.QUERIES for x in ranked[q][:5]]
for t in (1.0, 2.0, 3.0, 4.0, 6.0):
    kept = [x for x in pool if x[1] >= t]
    print(f"  阈值 {t:>4.1f}：{len(kept)}/{len(pool)} 篇通过（{100*len(kept)/len(pool):.0f}%）")
```

```text
=== BM25 top1 分数分布（10 条查询）===
min=3.62 median=7.17 max=10.97
=== 逐查询：top1 分数 / top1-top2 差距 / 候选数 / 第2名是否相关 ===
q1 top1= 6.55 gap= 5.95 候选数=2 第2名不相关
q2 top1= 6.03 gap= 0.70 候选数=6 第2名相关
q3 top1= 9.10 gap= 2.93 候选数=5 第2名不相关
q4 top1=10.97 gap= 7.47 候选数=3 第2名不相关
q5 top1= 9.67 gap= 6.16 候选数=4 第2名相关
q6 top1= 9.30 gap= 5.56 候选数=4 第2名不相关
q7 top1= 5.64 gap= 2.69 候选数=2 第2名相关
q8 top1= 3.62 gap= 0.06 候选数=2 第2名不相关
q9 top1= 7.17 gap= 0.22 候选数=5 第2名不相关
q10 候选数=0（与全部文档零共享词）
=== 阈值实验：score >= t 才收下各查询的 top5 候选 ===
  阈值  1.0：31/32 篇通过（97%）
  阈值  2.0：30/32 篇通过（94%）
  阈值  3.0：20/32 篇通过（62%）
  阈值  4.0：12/32 篇通过（38%）
  阈值  6.0： 9/32 篇通过（28%）
```

读出来的结论与多数线上实现的直觉相反：

1. **BM25 分数不可跨查询比较。** `q8 内网域名解析时好时坏` 的 top1 = **3.62** 是全场最低分，而它正是该查询唯一正确的答案（`d62`）；`q4` 的 top2 = 10.97 − 7.47 = **3.50**，几乎同一个分数，那一篇却与问题无关。取阈值 4.0 时，`q8` 的正确答案会被直接砍掉（该阈值只放行 38% 的候选）。**绝对阈值在词法检索上没有意义。**
2. **余弦相似度的"0.7 阈值"同理不可迁移**：换嵌入模型（甚至换分块粒度）分数分布就整体平移——《Embedding 模型选型：四轴决策与本地实测》实测里 `bge-small` 与 `bge-m3` 的最高相似度并不在同一区间。要用分数门控就得先**校准**（在同一批标注数据上把分数映射到"相关概率"：分位数查表或 Platt scaling）。
3. **推荐组合是三种信号**：固定 k（简单、可控、可复现）+ **相对断崖**（与上一篇的分差超过本次查询分数跨度的一定比例就截断，如 `q2` 的 gap=0.70 说明前几名是一个梯队、可以多给；`q4` 的 gap=7.47 说明第二名是噪声）+ **保底 1 篇**（但 `q10` 这种 BM25 返回 0 候选的情况，要显式走"检索置信度低 → 澄清 / 换检索器"分支，而不是硬凑一条，见《Agentic RAG：让检索自己判断"够不够、要不要换工具"》）。

```python
def elastic_cut(ranked, min_docs=1, max_docs=5, gap_ratio=2.0):
    """按相对断崖截断：与上一篇的分差超过本池跨度的 gap_ratio/len 倍就停。"""
    if len(ranked) <= min_docs:
        return ranked
    spread = ranked[0][1] - ranked[-1][1] or 1e-9
    limit = spread * gap_ratio / len(ranked)
    kept = ranked[:min_docs]
    for prev, cur in zip(ranked[min_docs - 1:-1], ranked[min_docs:]):
        if prev[1] - cur[1] > limit:
            break
        kept.append(cur)
    return kept[:max_docs]
```

`gap_ratio` 同样当超参调：套用截断后**重新计算 recall@（实际截断长度）**，确认没有把 gold 截掉再上线。经验起点：`k` 取"覆盖 95% 查询所需的最小值"（本例 recall@5 已经 = recall@10，那 `k=5` 足够），下游 prompt 预算紧时往下压。

## 常见坑

1. **每个查询只标一篇正例**：recall@k 直接虚高。同一份 BM25 结果，标注口径一换，两个结论：

   ```text
   只标完全相关（每查询 1 篇）：recall@5 = 0.900，nDCG@10 = 0.813
   标全部分级（每查询 2-3 篇）：recall@5 = 0.583，nDCG@10 = 0.709
   ```

   **同一个系统，指标差 31 个点。** 标前先想清楚："这段运维知识是否有助于回答"，而不是"这段是不是唯一答案"。
2. **用生成侧的口径标检索**：只把"LLM 引用过的段落"当相关，会系统性低估召回（模型可能引用了次要段落而漏掉关键段落）。
3. **评测查询从语料里抄句子**：查询与文档共享词，recall 高得离谱，上线立刻崩。做法：让**不看文档的人**写查询，或用 LLM 生成后人工删掉"直接摘自原文"的那部分。
4. **把 0 分文档算进排名**：BM25 对无共享词的文档给 0 分，不剔除就会让 `ranked[k]` 混进一堆并列 0 分的随机项，nDCG 抖动到不可复现。上节 `search()` 里的 `scores[i] > 0` 不是可选项。
5. **只在单一 k 上做决策**：k=5 好看的混合检索，k=1 可能不如 BM25（本模块《重排序》一篇的实测就出现了"recall 涨、nDCG 跌"的组合）。对比方案至少给 `k ∈ {1,3,5,10}` 一列。
6. **换分词器不换参数与阈值**：jieba → HanLP → 模型自带分词器，词密度与块长全变，`b` 与阈值都得重调。
7. **忽略"未标注即不相关"的偏差**：pooling 只标 top-10，之后的方法召回了第 11 位的新文档就一律算错。定期把新方法的独有命中送去人工标注（刷新 pooling）。
8. **指标不分组**：整体 recall@5 0.583 掩盖了分桶差异——本例按查询类型分桶：

   ```text
   事实/符号型（q2 q3 q5 q10）：recall@5=0.625  nDCG@10=0.614  平均候选数=3.8
   综合/口语型（其余 6 条）    ：recall@5=0.556  nDCG@10=0.772  平均候选数=3.0
   ```

   两类查询的瓶颈完全不同（前者是 BM25 完全捞空、后者是排序不好），分桶才知道该修哪一层。
9. **忘了 nDCG 的增益口径**：与 scikit-learn 等库比对前先确认线性/指数（见 §1.2），否则"我实现错了"的排查能耗掉一下午。

## 延伸阅读

- [Evaluation for Retrieval Augmented Generation: Measures, and a Bibliographic Dataset](https://arxiv.org/abs/2104.08663)（Paul Thomas 等，Google，arXiv 预印本）：TREC RAG 评测框架，把"段落级 qrels + 多维指标"讲得最清楚的一篇；nDCG 截断与 pooling 偏差的讨论也在此文。
- [scikit-learn：3.4.5.4 Normalized Discounted Cumulative Gain](https://scikit-learn.org/stable/modules/model_evaluation.html)（BSD-3-Clause）：`dcg_score` / `ndcg_score` 的定义、`k` 参数与 tie 处理（`ignore_ties`）。
- [Elasticsearch 官方 BM25 文档与 Practical BM25 系列](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-parameters)（CC BY 4.0）：`k1`、`b` 的语义与调法。
- [Pinecone Learn：Evaluation Measures in Information Retrieval](https://www.pinecone.io/learn/offline-evaluation/)（署名转载）：recall@k / precision@k 的入门推导与"K 取多大"的取舍。
- MTEB 检索任务的评测口径（`nDCG@10`、固定候选池）见 [embeddings-benchmark/mteb](https://github.com/embeddings-benchmark/mteb)（Apache-2.0）。
- 站内相关：《Embedding 模型选型：四轴决策与本地实测》《混合检索：真正的 BM25、RRF 融合与生产实现》《重排序：Cross-Encoder 精排与 LLM 打分成本对照》《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》《向量检索与相似度：欧氏距离、点积与余弦相似度》。

---

> **来源**：抓取于 2026-09-19。指标定义与标注方法参考 [TREC-RAG 评测论文](https://arxiv.org/abs/2104.08663)（Paul Thomas 等，Google，arXiv 预印本，署名转载）、[scikit-learn 官方文档](https://scikit-learn.org/stable/modules/model_evaluation.html)（BSD-3-Clause，§1.2 的线性/指数增益差异据其 1.9.1 版源码与文档核对）与 [Elastic Practical BM25](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-parameters)（CC BY 4.0）；`rank_bm25` 为 Damir Čermák 的 Open BSS 实现（MIT）。
> 编者注：本文全部数字为 macOS + Python 3.14 + `rank-bm25 0.2.2` + `jieba` 本机实跑输出（§1.2 的 scikit-learn 对照值为 `scikit-learn 1.9.1` 实跑），使用的评测集是《Embedding 模型选型：四轴决策与本地实测》第三节内联给出的 `corpus_zh.py`（45 块 / 10 查询 / 分级标注），由本站编写，不含真实生产数据；分桶统计（事实型 vs 综合型）中的查询分组与相关性标注同为本站设定，读者复现时请按自己业务的查询类型重新分组。
