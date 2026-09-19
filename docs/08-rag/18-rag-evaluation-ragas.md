---
title: RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底
source_url: https://raw.githubusercontent.com/explodinggradients/ragas/main/docs/getstarted/rag_eval.md
author: RAGAS 项目（Exploding Gradients / Vibrant Labs）
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: ragas 0.4.x（PyPI 当前版）；langchain-openai 1.x；openai SDK 3.x；示例模型 gpt-5.5（裁判）/ gpt-5.4-mini（批量低成本）
order: 18
group: 评估与生产化
---

## 为什么要评估：不然你只是在改玄学

RAG 的每一次改动——换分块、换嵌入、加 rerank、调 prompt——都需要回答一个问题：**变好了还是变坏了**？"我感觉这次答得更全了"不是答案。RAG 系统的特殊性在于它是**两段式**的：检索质量与生成质量各自会失败，而端到端的"答案对不对"把两者混在一起。RAGAS 提供的就是把它们拆开的三组指标：

- **检索侧**：Context Recall（该找到的找到了吗）、Context Precision（找到的都是有用的吗）、Noise Sensitivity（混进噪声会不会被带跑）。
- **生成侧**：Faithfulness（回答是否只依据检索到的上下文，即幻觉度）、Answer Relevancy（回答是否切题）。
- **端到端**：Factual Correctness / Answer Correctness（与标准答案在事实层面是否一致）。

**评估驱动开发**的顺序是：先固定评测集与指标 → 再动检索层（分块、嵌入、混合、重排，见《检索层 IR 指标专篇》）→ 最后动生成层。原因很实际：检索层的指标能用几十毫秒、零成本算完；生成层指标每条都要调 LLM。

## 一、安装与版本现状

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "ragas>=0.4,<0.5" "langchain-openai>=1.0" openai python-dotenv
# 只想跑合成测试集的话额外装：pip install langchain-community
```

版本上的三个现实（0.4.x 与前代差异较大，网上大量教程是 0.1/0.2 时代的）：

| 事项 | ragas 0.1/0.2 旧写法 | ragas 0.4.x 现行写法 |
| --- | --- | --- |
| 单样本对象 | `SingleTurnSample(user_input=..., retrieved_contexts=[...], response=...)` | 仍然可用；官方入门文档改用字典 + `EvaluationDataset.from_list(...)` |
| 指标名 | `metrics={"context_recall": "generic"}` 或 `context_recall` 单例 | 类形式：`LLMContextRecall()`、`Faithfulness()`、`FactualCorrectness()`；另有非 LLM 版本 `NonLLMContextRecall()`、`IDBasedContextRecall()` |
| LLM 注入 | `llm=llm_with_credentials` | `LangchainLLMWrapper(llm)` 或 `RagasLLMProvider` / 直接传 `openai` 客户端 |
| 结果 | 只有 DataFrame | `result.items` / `result.to_pandas()`，并可按样本看指标理由 |

指标清单可在安装后直接查（**这是最可靠的版本核对方式**）：

```python
import ragas.metrics as m
print([n for n in dir(m) if n[0].isupper()])
# ['AnswerAccuracy', 'AnswerRelevancy', 'ContextPrecision', 'ContextRecall',
#  'FactualCorrectness', 'Faithfulness', 'LLMContextRecall', 'NoiseSensitivity', ...]
```

## 二、跑一次评估：完整可复制的脚本

下面这份脚本按官方入门流程重写：自建一个最小 RAG（检索 + 生成），收集评估所需的四元组，然后用 RAGAS 打分。运行前需要 `OPENAI_API_KEY` 环境变量（脚本里不写死密钥）。

```python
# eval_rag.py
import os

import numpy as np
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from ragas import EvaluationDataset, evaluate
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import FactualCorrectness, Faithfulness, LLMContextRecall

load_dotenv()
assert os.getenv("OPENAI_API_KEY"), "请先 export OPENAI_API_KEY"

# 1) 被测系统用的模型；2) 当裁判的模型（evaluator，建议与被测模型不同源）
llm = ChatOpenAI(model="gpt-5.5", temperature=0)
judge_llm = ChatOpenAI(model="gpt-5.4-mini", temperature=0)
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

DOCS = [
    "爱因斯坦提出了相对论，改变了人们对时间、空间与引力的理解。",
    "居里夫妇中的居里夫人是物理学家与化学家，因放射性研究两次获得诺贝尔奖。",
    "牛顿提出了运动定律与万有引力定律，奠定了经典力学的基础。",
    "达尔文在《物种起源》中提出了自然选择的进化论。",
    "阿达·洛芙莱斯因在巴贝奇分析机上的工作被认为是第一位程序员。",
]


def retrieve(query, k=1):
    """最小检索：余弦相似度 top-k。真实项目换成向量库 + 重排。"""
    q = np.array(embeddings.embed_query(query))
    d = np.array(embeddings.embed_documents(DOCS))
    sims = d @ q / (np.linalg.norm(d, axis=1) * np.linalg.norm(q) + 1e-9)
    idx = np.argsort(-sims)[:k]
    return [DOCS[i] for i in idx]


def generate(query, contexts):
    prompt = f"仅依据下列上下文回答问题，无法回答就说无法回答。\n上下文：{contexts}\n问题：{query}"
    return llm.invoke([("system", "你是严谨的问答助手"), ("human", prompt)]).content


QUERIES = [
    "谁提出了相对论？",
    "第一位程序员是谁？",
    "牛顿对科学有什么贡献？",
    "谁因放射性研究获得两次诺贝尔奖？",
]
GOLDEN = [DOCS[0], DOCS[4], DOCS[2], DOCS[1]]     # 标准答案（reference）

rows = []
for q, ref in zip(QUERIES, GOLDEN):
    ctx = retrieve(q)
    rows.append({
        "user_input": q,                    # 问题
        "retrieved_contexts": ctx,          # 检索到的上下文（列表）
        "response": generate(q, ctx),       # 被测系统的答案
        "reference": ref,                   # 标准答案（可选，但 Context Recall 需要）
    })

dataset = EvaluationDataset.from_list(rows)
result = evaluate(
    dataset=dataset,
    metrics=[LLMContextRecall(), Faithfulness(), FactualCorrectness()],
    llm=LangchainLLMWrapper(judge_llm),
)
print(result)                    # 各指标均值
print(result.to_pandas().to_string())   # 逐样本明细，排查"哪条查询拖了后腿"
```

官方入门文档用同样流程跑出的典型输出（数值会随模型与语料变化，重点是**相对变化**）：

```text
{'context_recall': 1.0000, 'faithfulness': 0.8571, 'factual_correctness': 0.7280}
```

三个指标各自的读法：

- `context_recall=1.0` → 标准答案里的关键声明都被检索到了，**检索层不用再动**；
- `faithfulness=0.857` → 答案里约 14% 的声明在上下文里找不到依据，这是幻觉信号，优先查生成侧 prompt 与上下文质量；
- `factual_correctness=0.728` → 与标准答案的事实一致性；它低而 faithfulness 高，通常说明检索到的内容本身不完整（回到分块/召回）。

## 三、用你自己的系统跑：`SingleTurnSample` 更直观

把被测系统换成 LangChain/LlamaIndex 实现时，直接构造样本更省事：

```python
from ragas import SingleTurnSample, EvaluationDataset, evaluate
from ragas.metrics import AnswerRelevancy, ContextPrecision, NoiseSensitivity

samples = []
for q, ref in zip(QUERIES, GOLDEN):
    ctx = retrieve(q, k=4)                       # 宽召回
    samples.append(SingleTurnSample(
        user_input=q,
        retrieved_contexts=ctx,
        response=generate(q, ctx),
        reference=ref,
    ))

res = evaluate(
    dataset=EvaluationDataset(samples=samples),
    metrics=[ContextPrecision(), AnswerRelevancy(), NoiseSensitivity()],
    llm=LangchainLLMWrapper(judge_llm),
    embeddings=LangchainEmbeddingsWrapper(embeddings),   # AnswerRelevancy 需要嵌入
)
```

注意 `AnswerRelevancy` 与部分相似度类指标要 `embeddings`，而 `LLMContextRecall` 这类只要 `llm`。漏传时 ragas 会在运行中途抛错，别等到跑完 200 条才发现。

`NoiseSensitivity` 需要**故意往上下文里塞不相关文档**才有意义（用它做"抗噪"回归：检索 top-k 里混入 2 篇无关块，看 faithfulness 掉多少）。

## 四、没有 API Key 也要有底线：确定性评估器

LLM 裁判有成本、有随机性，还要防"同源偏袒"。所以**第一层指标必须是无模型的、可 CI 跑的**：

- `NonLLMContextRecall` / `IDBasedContextRecall`：只看标注的上下文 ID 是否被召回，不调用 LLM；
- 字符串/词覆盖式 recall：适合"标准答案与原文措辞接近"的领域（法规条款、运维手册）；
- 检索层 IR 指标（recall@k / MRR / nDCG）：见《检索层 IR 指标专篇》，那是零成本评估的主力。

下面的脚本零 API 依赖（`rank-bm25` + `jieba`），把"字符串覆盖式 context recall"实现了一遍，并顺手做了 BM25 参数扫描。**它同时暴露了这类指标的危险边界**，输出见后。

```python
# eval_offline.py
import math
import re

import jieba
import numpy as np
from rank_bm25 import BM25Okapi

PASSAGES = [
    ("d03", "机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。"
            "传统房间级空调在高密度场景下制冷效率明显下降。"),
    ("d01", "机房温度告警的默认阈值是回风温度 27℃，连续 5 分钟超过即触发 P2 告警。"
            "湿度低于 20% 时静电风险上升，需要开启加湿。"),
    ("d18", "主从复制延迟可用 Seconds_Behind_Master 观测，但该值在大事务或 DDL 场景下会失真。"
            "更可靠的判断是比对主从的 GTID 执行集合。"),
    ("d42", "向量库 HNSW 的 ef_search 越大召回越好但延迟上升，通常先从 64 起调。"
            "M 决定图连边数，调大能提升召回但索引体积线性增长。"),
]
GOLD = {   # 同一问题的两种标准答案写法
    "q1": ("机柜功率密度太高怎么解决",
           "改用行级空调或冷通道封闭；房间级空调在高密度场景下制冷效率下降。",
           "把整排空调换成机柜级送风，或者把冷通道封起来；也可以新增一路来自不同母线的市电。"),
    "q3": ("MySQL 主从同步延迟怎么看",
           "用 Seconds_Behind_Master 观测，但大事务或 DDL 场景下会失真；比对主从 GTID 执行集合。",
           "看复制延迟指标不可靠，遇到大事务会跳变；要拿主库和从库的事务编号集合做差集比较。"),
    "q9": ("向量索引召回调优参数",
           "增大 ef_search 提升召回但延迟上升；调大 M 提升召回但索引体积线性增长。",
           "先调搜索阶段的候选数，再调建图时的连边数，代价分别是延迟和磁盘。"),
}
STOP = set("的 了 是 在 和 与 会 要 可 以 及 对 中 上 下 时 为 个 这 那 也 都 就 ".split())


def tok(text):
    return [w for w in jieba.lcut(re.sub(r"\s+", "", text.lower()))
            if len(w) > 1 and w not in STOP]


IDS = [d for d, _ in PASSAGES]
bm25 = BM25Okapi([tok(t) for _, t in PASSAGES], k1=1.2, b=0.75)


def retrieve(query, k=4):
    scores = bm25.get_scores(tok(query))
    order = [i for i in np.argsort(-scores) if scores[i] > 0][:k]
    return [PASSAGES[i][1] for i in order]


def context_recall_str(gold, contexts, thresh=0.6):
    """把标准答案按分号/句号拆点，逐点判断词覆盖是否 >= thresh。"""
    points = [p for p in re.split(r"[；。]", gold) if p.strip()]
    ctx_tokens = set(tok(" ".join(contexts)))
    hit = 0
    for p in points:
        pt = set(tok(p))
        if pt and len(pt & ctx_tokens) / len(pt) >= thresh:
            hit += 1
    return hit / len(points), hit, len(points)


if __name__ == "__main__":
    for qid, (q, copy_ans, para_ans) in GOLD.items():
        ctx = retrieve(q)
        rc, h1, t1 = context_recall_str(copy_ans, ctx)
        rp, h2, t2 = context_recall_str(para_ans, ctx)
        print(f"{qid}: 摘录式标准答案 recall={rc:.2f}({h1}/{t1})  "
              f"转述式标准答案 recall={rp:.2f}({h2}/{t2})")
```

真实输出（4 篇语料、k=4）：

```text
q1: 摘录式标准答案 recall=1.00(2/2)  转述式标准答案 recall=0.00(0/2)
q3: 摘录式标准答案 recall=1.00(1/1)  转述式标准答案 recall=0.00(0/1)
q9: 摘录式标准答案 recall=1.00(2/2)  转述式标准答案 recall=0.00(0/1)
```

同一条查询、同一个检索结果，**只因为标准答案换成人话写法，字符串覆盖式指标就从 1.00 掉到 0.00**。结论：

1. 确定性指标只能评"**有没有把那段话捞回来**"（ID 级），不要拿它评"能不能支撑作答"；
2. 一旦你要评"语义上是否支撑答案"，就必须让 LLM 做声明拆解（RAGAS 的 ContextRecall/Faithfulness 内部就是这么做的：把 reference/answer 拆成 statements 再逐条判定）；
3. 反过来也别滥用 LLM 裁判——检索层的召回、排序质量永远优先用 IR 指标量。

## 五、合成评估集：`TestsetGenerator`

手写 50 条评测集能撑过第一版，撑不过第三版。RAGAS 可以用你自己的文档自动合成"问题 + 标准答案 + 支撑段落"：

```python
from langchain_community.document_loaders import DirectoryLoader
from ragas.llms import LangchainLLMWrapper
from ragas.testset import TestsetGenerator

docs = DirectoryLoader("./kb", glob="**/*.md").load()

generator = TestsetGenerator(
    llm=LangchainLLMWrapper(llm),
    embedding_model=LangchainEmbeddingsWrapper(embeddings),
)
testset = generator.generate_with_langchain_docs(docs, testset_size=20)
df = testset.to_pandas()          # 列：user_input / reference_contexts / reference / synthesizer_name
print(df[["user_input", "synthesizer_name"]].head())
```

它内部先对文档建知识图谱（实体、主题、关系），再按查询类型分布采样。默认分布是：

```text
SingleHopSpecific   0.50   # 单跳、具体：测基本检索
MultiHopAbstract    0.25   # 多跳、抽象：测跨文档综合
MultiHopSpecific    0.25   # 多跳、具体：测多段召回与合并
```

想控制难度就自己传分布：

```python
from ragas.testset.synthesizers import default_query_distribution

query_distribution = default_query_distribution(generator_llm)   # 可改权重，或换成自定义 synthesizer
testset = generator.generate(testset_size=20, query_distribution=query_distribution)
```

**必须人工过一遍再生成指标**：合成问题的通病是"能靠措辞猜出来"（问题里带着原文实体），会让所有方法虚高。经验做法：合成 200 条 → 人工删掉"照抄句子"的 → 再补 30 条真实用户问题（工单、聊天记录里捞）。

## 常见坑

1. **裁判与被测同源**：同一个模型给自己打分普遍偏高。至少要换型号（被测 gpt-5.5 → 裁判 gpt-5.4-mini 或另一家族），关键结论用人工抽检 20 条校准。
2. **裁判温度没设 0**：ragas 的默认 LLM 配置未必温度 0，跑三次三个数。显式 `temperature=0`，并对每条指标固定随机种子/采样次数（`RunConfig(num_threads=..., retries=...)`）。
3. **并发把 API 打爆**：`evaluate(..., run_config=RunConfig(max_wait=60, timeouts=...))`；默认并发下长上下文评估常触发限流，报出的错会被 ragas 静默重试成"很低分"。
4. **字段名写错**：`retrieved_contexts` 必须是**字符串列表**，不是 Document 对象；`reference` 与 `response` 别反。这类错误通常表现为指标恒为 0。
5. **一次改三个变量**：同时换分块和嵌入，指标涨了也不知道为什么。评估的价值在于**单变量对比**，固定其他层。
6. **评测集被喂进语料/示例**：如果评测问题或其答案已存在于知识库或 few-shot 示例里，分数没有意义（数据泄漏）。留出**从未参与构建**的评测子集。
7. **只看均值**：整体 0.85 可能掩盖"事实型 0.98 / 综合性 0.45"。用 `result.to_pandas()` 分桶看。
8. **每次跑都重新生成合成集**：数据集换了，分数就不可比。生成一次，落到文件（`testset.to_pandas().to_csv("eval_set.csv")`），之后只追加不重排。
9. **忘记成本核算**：三指标 × 50 条 × 长上下文 = 一条评估管线可能比线上还贵。给评估集大小定预算（常见 50-200 条），只在版本发布前跑全量。

## 延伸阅读

- RAGAS 官方入门：*Evaluate a simple RAG system*、*Testset generation*（ragas 仓库 `docs/getstarted/`，Apache 2.0）。
- LLM 裁判的偏差与校准（位置偏置、冗长偏置、同源偏袒）见 MT-Bench / LLM-as-a-judge 论文（arXiv:2306.05685）与本站《提示词的迭代与评估方法》。
- 检索层零成本指标：《检索层 IR 指标专篇：recall@k、MRR、nDCG 与截断阈值怎么定》。
- 生产侧的排查路径：《生产化 RAG：可靠管线与常见问题排查》。

---

> **来源**：抓取于 2026-09-19。译自/引自 [RAGAS 官方文档 *Evaluate a simple RAG system*](https://github.com/explodinggradients/ragas/blob/main/docs/getstarted/rag_eval.md) 与 [*Testset Generation for RAG*](https://github.com/explodinggradients/ragas/blob/main/docs/getstarted/rag_testset_generation.md)（RAGAS / Exploding Gradients，Apache 2.0）。
> **编者注**：原文档中的推广段落与营销链接未收录；示例模型名按本站 2026-09 现行统一为 `gpt-5.5` / `gpt-5.4-mini` / `text-embedding-3-small`。第四节 `eval_offline.py` 的代码与输出为本站自撰并在本机（macOS，Python 3.14 + `rank-bm25 0.2.2` + `jieba`）实跑所得，语料为本站编写的中文运维手册样例。RAGAS 指标名已对照 ragas 0.4.x 的 `ragas/metrics/__init__.py` 导出清单核实。
