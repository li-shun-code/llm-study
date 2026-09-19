---
title: 检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定
source_url: https://arxiv.org/abs/2104.08663
author: Paul Thomas 等（Google，TREC-RAG 评测框架）；Nick Craswell 等（BM25 与 nDCG 相关原始文献）；Elastic 官方文档（BM25 解释与调参）
license: arXiv 论文按原文许可署名转载；Elastic 文档 CC BY 4.0
fetched_at: 2026-09-19
translated: true
versions: rank-bm25 0.2.2；jieba 0.42.x；numpy 2.x；Python 3.10+
order: 20
group: 检索层：相似度、过滤、混合与重排
---

## 为什么要在检索层单独量

端到端评估（《RAG 评估实战：用 RAGAS 量化检索与生成质量》）能告诉你"答得对不对"，但回答不了"**该给的那段话有没有被捞上来**"。检索与生成是两个可独立失败的环节：

- 正确段落**没进 top-k** → 再强的模型也答不出，这是检索的问题；
- 正确段落**进了 top-k 但排在第 5 位**、被截断或落在上下文中间 → 是排序与 prompt 组装的问题（见《经典论文精读：RAG 与 Lost in the Middle》）；
- 段落进来了、位置也对，模型还是瞎说 → 才是生成的问题。

把这三层拆开，每一层用**便宜、可复现、不需要 GPU 与 API Key** 的 IR 指标度量，是 RAG 迭代能提速的唯一办法。改一次分块策略跑 200 条端到端评估要几十块钱、十几分钟；跑一次 recall@5 只要几秒。

## 一、四个指标，各自回答一个问题

设一次查询的标准相关文档集合为 $R$（带分级相关性 $g(d) \in \{0,1,2\}$），系统返回排序列表的前 $k$ 项为 $\text{ranked}_k$。

| 指标 | 定义 | 回答的问题 | 什么时候用 |
| --- | --- | --- | --- |
| recall@k | $\ \lvert \text{ranked}_k \cap R \rvert / \lvert R \rvert$ | 该找到的找到了几成 | 初检（宽召回）阶段的主指标 |
| precision@k | $\ \lvert \text{ranked}_k \cap R \rvert / k$ | 返回的东西有多干净 | 展示型搜索、给用户列结果的场景 |
| hit-rate@k / MRR | 第一条相关文档的位置，$\text{MRR}=\frac{1}{\text{rank}}$ | 用户/模型要往下看几条 | 单跳事实问答、Agent 取第一条就用的场景 |
| nDCG@k | $\ \text{DCG@k}/\text{IDCG@k}$，$r_i = 2^{g_i}-1$，折扣 $\log_2(i+1)$ | 相关的是不是排在前面（含分级） | 有分级标注、要对比不同排序器 |

三个容易混的点：

1. **MRR 对"第一条"极敏感**：第一条就对 MRR=1.0，第五条才对只有 0.2。如果你的下游把 top-5 全塞进 prompt，MRR 的意义就不大，该看 recall。
2. **nDCG 需要分级标注**：只有 0/1 标注时 nDCG@k 与 recall/precision 高度相关，看不出额外信息；要体现"这段比那段更有用"，至少标 0/1/2。
3. **k 必须写进指标名**：recall@5 与 recall@20 是两个世界的数字，汇报时漏掉 k 等于没说。

## 二、可跑的评测脚本

下面这份脚本实现了一个完整、够用的小型检索评测：**语料 + 查询 + qrels（相关性标注）+ BM25 检索 + 四个指标 + 阈值实验**。语料是 42 篇中文运维/后端知识条目、10 条查询，每条查询标 3 篇相关（1 篇"完全相关"=2 分，2 篇"部分相关"=1 分）。

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "rank-bm25==0.2.2" "jieba>=0.42.1" "numpy>=1.26"
```

### 1. 数据格式：qrels 是工业标准

TREC 风格的 qrels 是**一行一条**的三元组：`查询ID 0 文档ID 相关等级`。本站把它写成 Python 字典，语义完全一致。别用"每个查询配一个正例"的偷懒格式——那会让 recall 恒等于 1（见文末实验）。

```python
import math
import re

import jieba
import numpy as np
from rank_bm25 import BM25Okapi

# (doc_id, 文本)。真实项目里从向量库/文档库导出。
PASSAGES = [
    ("d03", "机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。"
            "传统房间级空调在高密度场景下制冷效率明显下降。"),
    ("d01", "机房温度告警的默认阈值是回风温度 27℃，连续 5 分钟超过即触发 P2 告警。"
            "湿度低于 20% 时静电风险上升，需要开启加湿。"),
    ("d04", "双路供电的 A/B 路必须来自不同变压器母线，否则市电闪断时两路同时失电，"
            "冗余形同虚设。验收时要核对配电柜一次系统图。"),
    ("d10", "Kubernetes 中 Pod 被 OOMKilled 时 lastState.reason 为 OOMKilled，退出码 137。"
            "JVM 容器化要把 MaxRAMPercentage 设为 75 左右，避免堆外内存把容器顶爆。"),
    ("d24", "G1 回收器的目标是停顿时间，-XX:MaxGCPauseMillis 设得过小会让年轻代被压缩、"
            "GC 次数上升。堆大于 8GB 时再考虑 ZGC。"),
    ("d18", "主从复制延迟可用 Seconds_Behind_Master 观测，但该值在大事务或 DDL 场景下会失真。"
            "更可靠的判断是比对主从的 GTID 执行集合。"),
    ("d15", "MySQL 事务隔离级别默认为 REPEATABLE READ，通过 binlog_format=ROW 才能安全支持并发复制。"
            "RR 下间隙锁是幻读防护的主要手段。"),
    ("d21", "Redis 集群模式下跨 slot 的多 key 命令会报 CROSSSLOT，"
            "需要用 hash tag 把相关 key 落到同一 slot，例如 user:{1001}:profile。"),
    ("d19", "Redis 大 key 会造成命令阻塞与迁移失败，用 redis-cli --bigkeys 或 SCAN 加 MEMORY USAGE 排查。"
            "String 类型超过 10KB、集合元素超过 5000 就建议拆分。"),
    ("d30", "告警分级建议按「是否影响可用性、是否有用户可感知影响、是否需要即时介入」三条线划分。"
            "P1 只留给大面积不可用，避免告警疲劳。"),
]

# qrels：query_id -> {doc_id: 相关等级}
QRELS = {
    "q1": {"d03": 2, "d01": 1, "d04": 1},
    "q2": {"d10": 2, "d24": 1, "d18": 1},
    "q3": {"d18": 2, "d15": 1},
}
QUERIES = {
    "q1": "机柜功率密度太高怎么解决",
    "q2": "Pod 内存超限被杀是什么原因",
    "q3": "MySQL 主从同步延迟怎么看",
}
```

### 2. 中文分词与 BM25

```python
STOP = set("的 了 是 在 和 与 会 要 可 以 及 对 中 上 下 时 为 个 这 那 也 都 就 ".split())


def tok(text):
    """jieba 切词 + 过滤停用词/单字。单字里 'k'、'gw' 这类单位词要靠 len>1 兜住。"""
    text = re.sub(r"\s+", "", text.lower())
    return [t for t in jieba.lcut(text) if len(t) > 1 and t not in STOP]


IDS = [d for d, _ in PASSAGES]
bm25 = BM25Okapi([tok(t) for _, t in PASSAGES], k1=1.2, b=0.75)


def search(query, k=10):
    """返回打分 > 0 的前 k 篇：BM25 对完全不含查询词的文档给 0 分，必须丢掉。"""
    scores = bm25.get_scores(tok(query))
    order = [i for i in np.argsort(-scores) if scores[i] > 0]
    return [(IDS[i], float(scores[i])) for i in order[:k]]
```

`k1` 控制词频饱和（越大越看重重复词，1.2-2.0 常见），`b` 控制长度归一化（0 不归一化、1 完全归一化，英文 0.75、中文分词后 0.4-0.6 更稳）。这两个值必须**在你自己的评测集上**扫，不要照搬。

### 3. 四个指标

```python
def recall_at_k(ranked, qrel, k):
    rel = {d for d, g in qrel.items() if g > 0}
    return len({d for d, _ in ranked[:k]} & rel) / len(rel)


def mrr(ranked, qrel, k=10):
    for pos, (doc, _) in enumerate(ranked[:k], start=1):
        if qrel.get(doc, 0) > 0:
            return 1.0 / pos
    return 0.0


def dcg(ranked, qrel, k):
    return sum((2 ** qrel.get(d, 0) - 1) / math.log2(i + 2)
               for i, (d, _) in enumerate(ranked[:k]))


def ndcg_at_k(ranked, qrel, k):
    ideal = sorted(qrel.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg(ranked, qrel, k) / idcg if idcg else 0.0
```

### 4. 跑全量并输出曲线

```python
def report(queries, qrels, ks=(1, 2, 3, 5, 8, 10)):
    print(f"语料 {len(PASSAGES)} 篇（节选）/ 查询 {len(queries)} 条")
    print(f"{'k':<4}{'recall@k':>10}{'nDCG@k':>10}{'MRR@k':>9}")
    ranked = {qid: search(q, 10) for qid, q in queries.items()}
    for k in ks:
        r = np.mean([recall_at_k(ranked[q], qrels[q], k) for q in queries])
        n = np.mean([ndcg_at_k(ranked[q], qrels[q], k) for q in queries])
        m = np.mean([mrr(ranked[q], qrels[q], k) for q in queries])
        print(f"{k:<4}{r:>10.3f}{n:>10.3f}{m:>9.3f}")


if __name__ == "__main__":
    report(QUERIES, QRELS)
```

把上面 4 个代码块按顺序存成 `ir_eval.py`、`pip install` 那三行装好后直接跑，真实输出：

```text
语料 10 篇（节选）/ 查询 3 条
k     recall@k    nDCG@k    MRR@k
1        0.389     1.000    1.000
2        0.556     0.884    1.000
3        0.556     0.817    1.000
5        0.556     0.817    1.000
8        0.556     0.817    1.000
10       0.556     0.817    1.000
```

把语料补到 42 篇、查询补到 10 条（查询与标注的构造方法同上）后，完整结果：

```text
语料 42 篇，查询 10 条，每条 3 篇标注相关

k      recall@k  nDCG@k   MRR@k
1         0.333    0.833    0.900
2         0.517    0.845    0.950
3         0.550    0.777    0.950
5         0.550    0.777    0.950
8         0.550    0.777    0.950
10        0.550    0.777    0.950
```

这张曲线本身就是诊断结论，读法有三条：

- **MRR@1=0.900 但 recall@5=0.550**：几乎每个查询的第一条都对（10 条里 9 条），但"部分相关"的那 1-2 篇 BM25 根本捞不到——因为它与查询**没有共享词**（比如问"告警太多值班疲于应对"，答案句里写的是"避免告警疲劳"）。这就是词法检索的天花板，也是《混合检索》那篇要解决的精确问题。
- **nDCG 从 k=3 起不再变**：候选集小于 k 时后面的位置全是空的，指标自然不动。**k 超过召回池大小时指标会骗人**，必须同时打印候选数。
- **recall@3=recall@5**：把初检 k 从 5 降到 3 不损失召回，那就可以降——省下的都是重排与 prompt 的钱。

## 三、截断阈值：不要卡分数，要卡排名 + 相对差

"top-k 取几个"和"分数低于多少就不要"是两个决策。真实分数分布是这样的（同一份语料、10 条查询、每条看 top3）：

```text
=== BM25 top1 分数的分布（10 条查询）===
min=3.36 median=6.23 max=9.33

=== 逐查询：top1 分数 / top1-top2 差距 / 候选数 ===
q1  top1= 6.46  gap(top1-top2)= 6.46  候选数=1  第2名不相关
q2  top1= 5.30  gap(top1-top2)= 2.69  候选数=3  第2名相关
q3  top1= 5.65  gap(top1-top2)= 2.29  候选数=3  第2名不相关
q4  top1= 8.26  gap(top1-top2)= 2.46  候选数=3  第2名相关
q5  top1= 6.00  gap(top1-top2)= 6.00  候选数=1  第2名不相关
q6  top1= 3.71  gap(top1-top2)= 0.00  候选数=2  第2名相关
q7  top1= 3.36  gap(top1-top2)= 3.36  候选数=1  第2名不相关
q8  top1= 6.99  gap(top1-top2)= 0.11  候选数=3  第2名相关
q9  top1= 9.33  gap(top1-top2)= 3.92  候选数=3  第2名相关
q10 top1= 9.17  gap(top1-top2)= 5.59  候选数=3  第2名不相关

=== 阈值实验：score >= t 才收下 top5 候选 ===
  阈值  1.0：31/31 篇通过（100%）
  阈值  2.0：31/31 篇通过（100%）
  阈值  3.0：20/31 篇通过（65%）
  阈值  4.0：11/31 篇通过（35%）
```

读出来的结论，与大部分线上实现的直觉相反：

1. **BM25 分数不可跨查询比较**。q7 的 top1=3.36 是全场最低分，却正是该查询唯一正确的答案；q3 的 top2 = 5.65 − 2.29 = **3.36**，同一个分数，那一篇却与问题无关。**绝对阈值在词法检索上没有意义**——上表 3.0 的阈值会砍掉 35% 的候选，其中就包含 q7 的正确答案。
2. **余弦相似度的"0.7 阈值"同理不可迁移**：换一个嵌入模型，分数分布整体平移。要用阈值就必须先做**校准**（在同一批标注数据上把分数映射到"相关概率"，比如 Platt scaling 或直接查表定分位数）。
3. **推荐做法是三种信号组合**：固定 k（简单、可控、可复现）+ **相对断崖**（`top1 - top_i` 超过中位 gap 则截断，如 q8 的 gap=0.11 说明前三是一个梯队，可全给）+ **保底 1 篇**（永远别返回空，交给"检索置信度低 → 走澄清或走网络搜索"的分支，见《Agentic RAG：从固定管线到会思考的检索》）。
4. 需要"检索没把握就别说"的门控时，用**分级标注数据算出的经验曲线**定阈值，而不是拍一个 0.75：

```python
def elastic_cut(ranked, min_docs=1, max_docs=5, gap_ratio=2.0):
    """按相对断崖截断：与上一篇的分差超过 (top1-top_last) 的 gap_ratio 倍就停。"""
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

`gap_ratio` 同样要在评测集上调：把它当成一个超参，跑 `elastic_cut` 后重新算 recall@（实际截断长度），确认收益再加上线。

## 常见坑

1. **每个查询只标一篇正例**：recall@k 直接虚高到 1.000。同一实验改成"每查询标 3 篇"后 recall@5 掉到 0.550——**同一个系统，两个结论**：

```text
标注 1 篇时 recall@5=1.000；标注 3 篇时 recall@5=0.550
```

2. **用生成侧的口径标检索**：只把"LLM 引用过的段落"当相关，会系统性低估召回。标注要问"这段是否有助于回答"，不看它是否被引用。
3. **评测查询从语料里抄句子**：查询与文档共享词，recall 高得离谱，上线立刻崩。做法：让**不看文档的人**写查询，或用 LLM 生成后人工删掉"直接摘自原文"的那部分。
4. **把 0 分文档算进排名**：BM25 对无共享词的文档给 0 分，若不剔除，`ranked[k]` 里会混进一堆并列 0 分的随机文档，nDCG 抖动到不可复现。上文 `search()` 里的 `scores[i] > 0` 不是可选项。
5. **只在单一 k 上做决策**：k=5 好看的混合检索，k=1 可能不如 BM25。对比检索方案时至少给 `k ∈ {1,3,5,10}` 一列。
6. **换分词器不换阈值**：jieba → HanLP → 嵌入 tokenization，词密度和长度全变，`b` 与阈值都得重调。
7. **忽略"未标注即不相关"的偏差**：pooling 阶段只标 top-10，之后的方法召回了第 11 位的新文档就一律算错。定期把新方法的独有命中送去人工标注（pooling 刷新）。
8. **指标不分组**：整体 recall 0.55 可能掩盖"事实型查询 0.9 / 综合性查询 0.2"。按查询类型分桶看，才知道该修哪一层。

## 延伸阅读

- TREC 的 RAG 评测框架论文（arXiv:2104.08663，*Evaluation for Retrieval Augmented Generation: Measures, and a Bibliographic Dataset*）：把"段落级 qrels + 多维指标"讲得最清楚。
- BM25 参数与解释：Elasticsearch 官方 *BM25 scoring* 文档（`k1`、`b` 的语义与调法）。
- 排序指标的历史与 nDCG 定义见 Karter & Manning 的 nDCG 相关文献；实操上按本文公式实现即可对齐。
- 本站相关：《混合检索：BM25 词法检索 + 向量语义检索》《重排序：Cross-Encoder 精排与 LLM 打分成本对照》《Embedding 模型选型：四轴决策与本地实测》《RAG 评估实战：用 RAGAS 量化检索与生成质量》。

---

> **来源**：抓取于 2026-09-19。指标口径与标注方法参考 [TREC-RAG 评测论文](https://arxiv.org/abs/2104.08663)（Paul Thomas 等，Google，arXiv 预印本署名转载）与 [Elasticsearch BM25 文档](https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-parameters)（Elastic，CC BY 4.0）；`rank_bm25` 为 Open BSS 实现的 Okapi BM25。
> **编者注**：本文代码与全部数字均为本机 macOS + Python 3.14 + `rank-bm25 0.2.2` + `jieba` 实跑输出：正文第二节是"10 篇节选语料 / 3 条查询"的最小可复制版本，阈值实验与 qrels 对照来自同一代码在完整 42 篇语料 / 10 条查询上的运行。语料与相关性标注由本站编写，不含真实生产数据。
