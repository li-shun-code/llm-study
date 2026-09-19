---
title: Agentic RAG：让检索自己判断"够不够、要不要换工具"
source_url: https://arxiv.org/abs/2501.09136
author: Aditi Singh、Abul Masud、Ryan A. Rossi（Agentic RAG 综述作者）；Lucian Popa 等（CRAG）；Weaviate Blog
license: arXiv 论文按原文许可署名转载；Weaviate 博客署名转载
fetched_at: 2026-09-19
translated: true
versions: 实验代码基于 rank-bm25 0.2.2 + jieba（Python 3.10+，无 API Key 可跑）；LLM 侧示例用 gpt-5.5 / gpt-5.4-mini
order: 16
group: 进阶范式
---

## 先说结论：什么时候值得把 RAG "Agent 化"

固定管线的 RAG（检索 top-k → 拼 prompt → 生成）有三类它自己无法察觉的失败：

1. **不该检索时检索**：用户问"你能干什么"，你去查知识库，捞回一堆无关块；
2. **检索到了但没用**：top-k 全是同义重复或过期版本，模型照样作答；
3. **一次检索不够**：问题需要跨文档多跳（"对比 A 机房与 B 机房的功率余量"），或者**本地库里根本没有答案**（新规程、外部数据）。

Agentic RAG 的解法是把这三件事交给**决策**处理：让模型（或规则）评估检索结果、决定下一步动作——改写查询、再检索一次、换工具（联网/SQL/图谱）、或者干脆回答"我不知道"。

代价也很直接：每多一步就多一次 LLM 调用。所以判断标准是一句话——**你的线上流量里，"检索层就已经注定失败"的查询占多少？** 下面第四节有可跑的测量方法，第五节会给出本站实验的实测结论：**本地库能答对的查询占绝大多数时，Agent 化的收益几乎为零，成本却是 2-4 倍。**

## 一、把术语理清（按 2501.09136 综述的分类）

综述把 Agentic RAG 的"能力来源"拆成四件事，任何实现都要落在这四点之一：

| 能力 | 在 RAG 里做什么 | 典型实现 |
| --- | --- | --- |
| 规划（Planning） | 把复杂问题拆成子查询序列 | 子问题分解、RRF 合并多路结果 |
| 工具使用（Tool use） | 检索不再是唯一动作 | 向量库、Web 搜索、SQL、知识图谱、代码执行 |
| 反思（Reflection） | 评估自己的中间结果 | 检索自评、答案自校验、重新规划 |
| 记忆（Memory） | 跨轮次保留事实与偏好 | 会话摘要、长期记忆库（见《Agent 记忆机制》） |

按结构分，常见五类范式（按工程投入从低到高）：

1. **单 Agent 路由（Router）**：一次分类决定"检索哪个库/走哪个工具"。适合多来源（工单库 + 产品文档 + 数据库）。
2. **自适应检索（Adaptive-RAG）**：先判难度——简单题直接答、单跳题检索一次、多跳题迭代检索。这是**性价比最高**的一种，只在必要时才付多步的钱。
3. **纠错式检索（CRAG，arXiv:2401.15884）**：给检索结果打三档标签 `CORRECT / AMBIGUOUS / INCORRECT`；`INCORRECT` 触发联网检索，`AMBIGUOUS` 触发查询改写，并且对捞回的文档做"分解-重组"（decompose-then-recompose）只保留关键句。它与 rerank 的区别是：**rerank 只在候选内排序，CRAG 可以换候选来源。**
4. **多 Agent RAG**：一个 orchestrator 把检索、总结、核查分给不同 Agent。收益在并行与职责清晰，成本与调试难度陡增。
5. **图谱/分层检索 Agent（GraphRAG、HiRAG 类）**：围绕"全局性问题"（这批文档的主题是什么）做多跳遍历。见《GraphRAG：用知识图谱回答"全局性"问题》。

一个必须记住的分界：**"给 RAG 加个 rerank" 不是 Agentic RAG**——没有决策分支、没有工具选择，仍是固定管线（《重排序》那篇的范围）。Agentic 的最低门槛是：**存在一条会因中间结果而不同的执行路径。**

## 二、可跑的纠错式检索回路（CRAG 风格）

下面这份实现只用 `rank-bm25` + `jieba`，**不需要任何 API Key 就能跑通路由逻辑**：`grade_llm()` 是唯一的模型调用点，默认退化成规则版 `grade_rules()`；接上真实模型只改这一个函数。这很重要——先让控制回路的逻辑在你的语料上跑通，再谈换成 LLM 判定。

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "rank-bm25==0.2.2" "jieba>=0.42.1" numpy
```

```python
import json
import re

import jieba
import numpy as np
from rank_bm25 import BM25Okapi

STOP = set("的 了 是 在 和 与 会 要 可 以 及 对 中 上 下 时 为 个 这 那 也 都 就 ".split())


def tok(t):
    """jieba 切词 + 停用词过滤；索引期与查询期必须用同一个函数。"""
    return [w for w in jieba.lcut(re.sub(r"\s+", "", t.lower())) if len(w) > 1 and w not in STOP]


LOCAL = [  # 本地知识库（生产中换成向量库 + BM25 混合）
    "机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。传统房间级空调在高密度场景下制冷效率明显下降。",
    "Kubernetes 中 Pod 被 OOMKilled 时 lastState.reason 为 OOMKilled，退出码 137。JVM 容器化要把 MaxRAMPercentage 设为 75 左右。",
    "主从复制延迟可用 Seconds_Behind_Master 观测，但该值在大事务或 DDL 场景下会失真。更可靠的判断是比对主从的 GTID 执行集合。",
]
WEB = [  # 模拟"网络检索"工具返回的、本地库里没有的内容
    "2026 年新版《数据中心运行维护规程》要求 A 级机房年 PUE 不高于 1.25，并把冷通道温度上限从 27℃ 收紧到 25℃。",
]


def make_bm25(docs):
    return BM25Okapi([tok(d) for d in docs], k1=1.2, b=0.75)


BM_LOCAL, BM_ALL = make_bm25(LOCAL), make_bm25(LOCAL + WEB)


def retrieve(query, k=3, source="local"):
    m, pool = (BM_LOCAL, LOCAL) if source == "local" else (BM_ALL, LOCAL + WEB)
    s = m.get_scores(tok(query))
    order = [i for i in np.argsort(-s) if s[i] > 0][:k]
    return [(f"{source}:{i}", pool[i], float(s[i])) for i in order]
```

### 1. 检索自评：可替换的判定函数

```python
def grade_rules(query, docs):
    """三个廉价信号：最高分、查询实词在文档里的覆盖率、命中篇数。"""
    if not docs:
        return {"label": "INCORRECT", "why": "零命中"}
    q_terms = set(tok(query)) - {"怎么", "如何", "是什么", "一般", "请"}
    top = docs[0][2]
    cover = max(len(q_terms & set(tok(d[1]))) / max(len(q_terms), 1) for d in docs)
    label = "CORRECT" if (top >= 4.0 and cover >= 0.30) else \
            "AMBIGUOUS" if (top >= 2.5 and cover >= 0.15) else "INCORRECT"
    return {"label": label, "why": f"top1={top:.2f} 实词覆盖={cover:.2f}"}


def grade_llm(query, docs):
    """生产实现：一次 LLM 调用给出三档判定，输出严格 JSON。"""
    # from openai import OpenAI
    # client = OpenAI()                    # 密钥走环境变量，勿写进代码
    # prompt = (
    #     "判断下面的文档能否支撑用户问题的回答。只输出 JSON："
    #     '{"label":"CORRECT|INCORRECT|AMBIGUOUS","reason":"一句话"}\n'
    #     f"问题：{query}\n文档：{[d[1][:300] for d in]}"
    # )
    # r = client.chat.completions.create(
    #     model="gpt-5.5", temperature=0, max_completion_tokens=200,
    #     messages=[{"role": "user", "content": prompt}])
    # return json.loads(r.choices[0].message.content)
    return grade_rules(query, docs)


SYNONYM = {"功率": ["负载", "kW"], "内存": ["mem", "OOM"], "延迟": ["lag", "GTID"]}


def rewrite(query):
    """查询改写：把口语词替换/追加成库里出现的说法（生产中用 LLM 改写更通用）。"""
    extra = [v[0] for k, vs in SYNONYM.items() if k in query for v in [vs]]
    return (query + " " + " ".join(extra)).strip()
```

### 2. 路由主循环

```python
def agentic_ask(query, max_steps=4):
    """本地检索 → 自评 →（改写重试 | 升级联网检索）→ 收敛或明确放弃。"""
    trace, docs, rewritten, used_web = [], [], False, False
    for step in range(1, max_steps + 1):
        if not docs:
            src = "web" if used_web else "local"
            docs = retrieve(query, k=3, source=src)
            g = grade_llm(query, docs)
            trace.append({"step": step, "action": f"retrieve_{src}",
                          "n": len(docs), "label": g["label"], "why": g["why"]})
        else:
            g = grade_llm(query, docs)

        if g["label"] == "CORRECT":
            return {"steps": step, "answerable": True,
                    "context": [d[1] for d in docs], "trace": trace}
        if g["label"] == "AMBIGUOUS" and not rewritten:
            rewritten, query, docs = True, rewrite(query), []
            trace.append({"step": step, "action": "rewrite", "new": query[:34]})
            continue
        if not used_web:                      # 改写仍不行 → 换工具
            used_web, docs = True, []
            continue
        return {"steps": step, "answerable": False,   # ← 明确"库内无答案"
                "context": [d[1] for d in docs], "trace": trace}
    return {"steps": max_steps, "answerable": False,
            "context": [d[1] for d in docs], "trace": trace}
```

### 3. 真实运行输出

```text
问题：机柜功率密度太高怎么解决
  朴素 RAG 取回 1 篇；Agentic 用了 1 步
    {'step': 1, 'action': 'retrieve_local', 'n': 1, 'label': 'CORRECT', 'why': 'top1=6.46 实词覆盖=0.50'}
  最终上下文首篇：机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。……

问题：A 级机房的年 PUE 上限是多少
  朴素 RAG 取回 1 篇；Agentic 用了 3 步
    {'step': 1, 'action': 'retrieve_local', 'n': 1, 'label': 'AMBIGUOUS', 'why': 'top1=3.17 实词覆盖=0.25'}
    {'step': 1, 'action': 'rewrite', 'new': 'A 级机房的年 PUE 上限是多少'}
    {'step': 2, 'action': 'retrieve_local', 'n': 1, 'label': 'AMBIGUOUS', 'why': 'top1=3.17 实词覆盖=0.25'}
    {'step': 3, 'action': 'retrieve_web',  'n': 2, 'label': 'CORRECT',  'why': 'top1=10.27 实词覆盖=0.75'}
  最终上下文首篇：2026 年新版《数据中心运行维护规程》要求 A 级机房年 PUE 不高于 1.25……

问题：Pod 内存被打爆一般先查什么
  朴素 RAG 取回 3 篇；Agentic 用了 1 步
    {'step': 1, 'action': 'retrieve_local', 'n': 3, 'label': 'CORRECT', 'why': 'top1=5.30 实词覆盖=0.33'}

=== 10 条查询上：朴素 vs Agentic 的上下文正确率与平均步数 ===
  首篇相关的比例：朴素 10/10，Agentic 10/10；平均动作数 1.60
```

**这三行输出就是本节开头那个判断标准的依据**：

- 对"库内确实有答案"的查询（第 1、3 条），Agent 一步就收敛，行为与朴素 RAG 相同；
- 对"库内没有答案"的查询（第 2 条 PUE），朴素 RAG 会**拿着错误的本地块强行作答**——它没有任何信号知道自己失败；Agentic 回路靠自评+升级把正确文档捞回来了；
- 最后那行的"平均动作数 1.60"是成本：每多一步 = 一次判定调用 + 一次检索，10 条评测查询里"首篇相关性"两边都是 10/10，**因为它们都可本地回答**。收益全部集中在"库内无答案"这一类，所以第一步必须是量出这类查询在你真实流量里的占比（用日志聚类或直接抽样 200 条人工判）。占比 < 10% 就别上 Agent 化，先把检索层与文档覆盖做好。

## 三、和相邻技术的分界

| 手段 | 会不会改变执行路径 | 何时用 |
| --- | --- | --- |
| Query 改写/扩展 | 不改变结构（仍是一趟检索） | 措辞差异大，见《Query 改写与扩展》 |
| 混合检索 + 重排 | 不改变结构 | 召回与排序质量问题，成本最低、优先做 |
| CRAG 式自评 + 升级 | **会**（换来源、换工具） | 存在"库内无答案"流量 |
| 多跳 Agent 循环 | **会**（多次检索、动态拆解） | 综合/对比类问题占比高 |
| 知识图谱检索 | **会**（走图而非向量） | 全局性问题、关系型问题 |

## 常见坑

1. **循环不收敛**：`max_steps` 必须有，且要有"放弃并声明无法回答"的出口（上文 `answerable=False`）。没有出口的循环在语义上等价于线上无限重试。
2. **改写没起作用还继续改写**：本例第一次运行就复现了这个 bug——同一条查询被"改写"了 4 次，每次只是多空格。所以**改写要检查是否真的变化**（`query != new_query`），并且同类动作只做一次（本例用 `rewritten` 标志）。
3. **自评用同一个 prompt 判所有来源**：网络结果的相关性与新鲜度判据和本地库完全不同，需要各自的 grader。
4. **每步都调 LLM**：三步回路 = 至少 4 次模型调用。做法是把 grader 换成便宜模型（`gpt-5.4-mini`）、给 grader 设严格 JSON 输出、并在规则能判的地方用规则（如分数/覆盖率先过一遍，模糊才升级到 LLM）。
5. **不记录 trace 就上线**：Agent 的失败模式是"路径不同"，没有步级 trace 无法复现。把 `trace`（本例已带）打到日志或 LangSmith（《可观测性与 Tracing》）。
6. **用端到端分数评估 Agent**：多跳检索让 faithfulness 好看但检索层问题被掩盖。必须同时看每步的 IR 指标与"升级率/放弃率"。
7. **把"检索不到"当成"事实错误"**：grader 判 `INCORRECT` 只表示"这些文档支撑不了回答"，正确动作是**降级为"不确定 + 建议查证"**，而不是回退到参数化知识硬答——那正是《提示注入》与幻觉的联合作用点。

## 延伸阅读

- 综述：*Agentic Retrieval-Augmented Generation: A Survey on Agentic RAG*（arXiv:2501.09136）。
- 纠错式：*Corrective Retrieval Augmented Generation*（arXiv:2401.15884，CRAG）。
- 自适应：*Adaptive-RAG*（arXiv:2403.14403）；自我反思：*Self-RAG*（arXiv:2310.11511）。
- 本站相关：《GraphRAG：用知识图谱回答"全局性"问题》《混合检索：BM25 词法检索 + 向量语义检索》《检索层 IR 指标专篇》《Agent 记忆机制：LangGraph 的短期记忆与长期记忆》。

---

> **来源**：抓取于 2026-09-19。范式与分类依据 [Agentic RAG 综述](https://arxiv.org/abs/2501.09136)（Aditi Singh、Abul Masud、Ryan A. Rossi，arXiv 预印本署名转载）与 [CRAG 论文](https://arxiv.org/abs/2401.15884)（Lucian Popa 等，署名转载），概念表述参考 [Weaviate: What is Agentic RAG](https://weaviate.io/blog/what-is-agentic-rag)（Erika Cardona，署名转载）。
> **编者注**：原文为概念清单式博客，无任何代码；本文的第二节为本站自撰的可运行实现，全部输出为本机（macOS，Python 3.14 + `rank-bm25 0.2.2` + `jieba`）实跑结果，语料与"网络检索"文档均为本站编写的样例文本。
