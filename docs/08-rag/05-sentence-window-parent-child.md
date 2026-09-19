---
title: 句子窗口与父子块检索：用小块召回、大块作答
source_url: https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/MetadataReplacementDemo/
author: LlamaIndex 团队（run-llama/llama_index 官方示例）；Jerry Liu（LlamaIndex）
license: MIT
fetched_at: 2026-09-19
translated: true
versions: llama-index 0.12.x / LlamaIndex 官方示例（SentenceWindowNodeParser、MetadataReplacementPostProcessor、AutoMergingRetriever）；实验代码为零依赖 Python 3.10+
order: 5
group: 摄取层：解析、分块与嵌入
---

## 为什么需要它：分块尺寸是一笔两头的债

《文档分块策略》里已经说明：块是检索的基本单位，也是送给 LLM 的上下文单位。这两个用途对尺寸的要求正好相反：

- **检索希望块小**：一个块只讲一件事，向量才是"纯"的。段落级大块的向量是好几个主题的加权平均，查询很难命中。
- **作答希望块大**：只把"回风温度超过 27℃ 触发 P2 告警"这一句给模型，它拿不到前一句的条件与后一句的处置动作，答出来就是半句话。

句子窗口（Sentence Window Retrieval）与父子块（Parent-Child / small-to-big）是同一思想的两种实现：**用"小单元"去匹配，用"大单元"去作答**。两者在 LlamaIndex、LangChain、LlamaIndex 的 AutoMerging 里都有现成组件，但把它们当黑盒用会踩坑（尤其是重复计费与窗口边界），所以本篇先用一份零依赖实现把它跑通，再对照框架组件。

## 一、两种结构的差别

| 维度 | 句子窗口 | 父子块（small-to-big） |
| --- | --- | --- |
| 索引单元 | 单句 | 子块（如 256 token 的段落片段） |
| 作答单元 | 命中句 ± n 句拼出的窗口 | 子块所属的父块（如整节 / 整页） |
| 元数据存哪 | 每个节点带 `window` 字段（窗口原文） | 子块只存 `parent_id`，父块正文放文档存储，不进向量索引 |
| 粒度自适应 | 无，窗口是固定句数 | 有，命中同父的多个子块可合并回更大父块（AutoMerging） |
| 典型副作用 | 相邻查询命中重叠窗口 → 上下文重复 | 父块过大 → 退化成大块检索的稀释问题 |
| 适合场景 | 手册、FAQ、条款类（句子即事实） | 长文档、论文、跨段推理（事实分散在数段） |

LlamaIndex 里的对应组件：

- 句子窗口：`SentenceWindowNodeParser(window_size=3)` + `MetadataReplacementPostProcessor(target_metadata_key="window")`。前者的每个节点保留 `original_content`（单句，参与嵌入）与 `window`（±3 句，参与作答）；后者在检索**之后、生成之前**把节点正文换成 `window`。
- 父子块：`MarkdownNodeParser` / `SemanticSplitterNodeParser` 生成叶子块，`storage_context.docstore` 存父块，检索命中叶子后用 `AutoMergingRetriever` 按"同父命中数 / 父块子块数"的比值决定是否上卷到父块。

## 二、一份能跑通的实现

下面的脚本只用标准库，把「句子窗口」与「父子块」两种检索都实现了，并用同一份中文运维手册、同一个查询把三种结果并排打出来：纯句子、句子窗口、父块。你可以把它当作最小可运行的对照实验，也可以直接改造成生产代码——**换成真实嵌入只需要替换 `score()` 这一个函数**。

```bash
python3 -m venv .venv && source .venv/bin/activate   # 无需任何第三方包
```

### 1. 语料与切分

```python
import math
import re
from collections import Counter

DOC = """# 机房环境告警处置手册

## 1 温湿度
机房温度告警的默认阈值是回风温度 27℃，连续 5 分钟超过即触发 P2 告警。湿度低于 20% 时静电风险上升，需要开启加湿设备。处置动作是先确认冷通道封闭是否完整，再检查该列机柜的空调送风温度设定值。
当同列三个以上机柜同时越限，应判定为制冷回路异常而不是负载异常，此时要立刻检查冷机群控是否有一台处于本地模式。历史上该类误判导致过两次超温降频。

## 2 功率与负载
机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭。双路供电的 A/B 路必须来自不同变压器母线，否则市电闪断时两路会同时失电。负载率超过 90% 的机柜需要在下一个变更窗口内完成迁移，迁移工单一式两份，分别由机房值班长与网络组确认。

## 3 网络与链路
交换机端口出现 CRC 错误计数增长时，优先排查光模块衰减与跳线弯折。若伴随端口 flush 日志，可能是链路抖动引发 STP 重算。BGP 邻居长期停在 Active 状态一般是 TCP 179 不通或 AS 号配置错误。
"""

SENT_SPLIT = re.compile(r"(?<=[。！？；])\s*")


def split_sentences(text):
    """按中文句末标点切句；顺手剥掉 Markdown 标题标记，标题转成段落名。"""
    out = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            out.append(("heading", re.sub(r"^#+\s*", "", line)))
            continue
        for s in SENT_SPLIT.split(line):
            if s.strip():
                out.append(("sentence", s.strip()))
    return out


items = split_sentences(DOC)
sentences = [t for kind, t in items if kind == "sentence"]
```

### 2. 父子块：子块进索引，父块进文档存储

父块取"章节（`## 标题` 到下一个 `##`）"，子块取单句。关键点是：**子块的正文不进最终上下文，只带一个 `parent_id`**。

```python
def build_parent_child(items):
    parents, children = {}, []
    section = "前言"
    for kind, text in items:
        if kind == "heading" and not text.startswith("#"):
            section = text
            parents.setdefault(section, {"title": section, "text": []})
        elif kind == "sentence":
            parents.setdefault(section, {"title": section, "text": []})
            parents[section]["text"].append(text)
            children.append({"child_id": f"{section}#{len(children)}",
                             "parent_id": section, "text": text})
    for p in parents.values():
        p["text"] = " ".join(p["text"])
    return parents, children


PARENTS, CHILDREN = build_parent_child(items)
```

### 3. 打分函数：可替换的最小接口

```python
def tokenize(s):
    """无分词器场景下的兜底切分：英文按词 + 中文单字/双字。"""
    s = s.lower()
    words = re.findall(r"[a-z0-9_.:/-]+", s)
    cjk = re.findall(r"[一-鿿]", s)
    bigrams = ["".join(pair) for pair in zip(cjk, cjk[1:])]
    return words + cjk + bigrams


class LexicalScorer:
    """BM25 风格的轻量打分器。生产中把这一层换成嵌入相似度即可，其余代码不动。"""

    def __init__(self, docs, k1=1.5, b=0.75):
        self.toks = [Counter(tokenize(d)) for d in docs]
        self.df = Counter(t for c in self.toks for t in c)
        self.n = len(docs)
        self.avg = sum(sum(c.values()) for c in self.toks) / self.n
        self.k1, self.b = k1, b

    def score(self, query):
        q = Counter(tokenize(query))
        out = []
        for c in self.toks:
            s, dl = 0.0, sum(c.values()) or 1
            for t in q:
                if t not in c:
                    continue
                idf = math.log(1 + (self.n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                s += idf * c[t] * (self.k1 + 1) / (
                    c[t] + self.k1 * (1 - self.b + self.b * dl / self.avg))
            out.append(s)
        return out


def top_hits(scorer, query, k):
    scores = scorer.score(query)
    idx = sorted(range(len(scores)), key=lambda i: -scores[i])
    return [(i, scores[i]) for i in idx[:k] if scores[i] > 0]
```

`LexicalScorer` 与 `top_hits` 就是这条管线的"可替换接口"：把 `score()` 换成嵌入余弦（或任何 reranker 的打分），句子窗口与父子块逻辑一行都不用改。

### 4. 三种检索结果并排比

```python
def sentence_only(query, k=2):
    sc = LexicalScorer(sentences)
    return [sentences[i] for i, _ in top_hits(sc, query, k)]


def sentence_window(query, k=2, window=1):
    """命中句 ± window 句；相邻窗口合并，避免同一句被塞两遍。"""
    sc = LexicalScorer(sentences)
    keep = set()
    for i, _ in top_hits(sc, query, k):
        keep.update(range(max(0, i - window), min(len(sentences), i + window + 1)))
    return [sentences[i] for i in sorted(keep)]


def parent_child(query, k=2):
    """子块（句）召回 → 回父块（章节）作答，父块去重。"""
    sc = LexicalScorer([c["text"] for c in CHILDREN])
    parents, seen = [], set()
    for i, _ in top_hits(sc, query, k):
        pid = CHILDREN[i]["parent_id"]
        if pid not in seen:
            seen.add(pid)
            parents.append(PARENTS[pid]["text"])
    return parents


def render(title, blocks):
    print(f"\n【{title}】字符数 {sum(len(b) for b in blocks)}")
    for b in blocks:
        print("  -", b)


if __name__ == "__main__":
    q = "机柜负载率超过九成要怎么办"
    print(f"查询：{q}")
    render("① 纯句子（小块，上下文不足）", sentence_only(q))
    render("② 句子窗口 window=1", sentence_window(q))
    render("③ 父子块（父块=章节）", parent_child(q))
    render("④ 句子窗口 window=3（窗口过大，混入无关内容）", sentence_window(q, window=3))
```

### 5. 真实运行输出

```text
查询：机柜负载率超过九成要怎么办

【① 纯句子（小块，上下文不足）】字符数 82
  - 负载率超过 90% 的机柜需要在下一个变更窗口内完成迁移，迁移工单一式两份，分别由机房值班长与网络组确认。
  - 机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭。

【② 句子窗口 window=1】字符数 172
  - 历史上该类误判导致过两次超温降频。
  - 机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭。
  - 双路供电的 A/B 路必须来自不同变压器母线，否则市电闪断时两路会同时失电。
  - 负载率超过 90% 的机柜需要在下一个变更窗口内完成迁移，迁移工单一式两份，分别由机房值班长与网络组确认。
  - 交换机端口出现 CRC 错误计数增长时，优先排查光模块衰减与跳线弯折。

【③ 父子块（父块=章节）】字符数 122
  - 机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭。 双路供电的 A/B 路必须来自不同变压器母线，否则市电闪断时两路会同时失电。 负载率超过 90% 的机柜需要在下一个变更窗口内完成迁移，迁移工单一式两份，分别由机房值班长与网络组确认。

【④ 句子窗口 window=3（窗口过大，混入无关内容）】字符数 340
  - 处置动作是先确认冷通道封闭是否完整，再检查该列机柜的空调送风温度设定值。
  - 当同列三个以上机柜同时越限，应判定为制冷回路异常而不是负载异常，……
  - ……（命中 2 句各带 ±3 句，共 9 句，几乎覆盖全文）
```

（④ 的输出为节省篇幅做了省略，其余为原样输出。）

结果把取舍摆得很清楚：

- ① 只给了动作，没给"8kW/双路"这些前提，模型答不全；
- ② `window=1` 从"温湿度"章节尾巴多带进一句"历史上该类误判导致过两次超温降频"，又从"网络与链路"带进一句 CRC——因为**句子是线性排列的，窗口只看位置不看语义归属**；
- ③ 父块按章节边界扩展，拿到的是同一个语义单元内的全部内容，长度只有 122 字且句句相关。

结论不是"父子块更好"，而是：**句序相邻 ≠ 语义相邻时，优先用带结构边界的父块**（Markdown 标题、页、条款号）；只有文档本身没有结构（聊天记录、工单流水）时，句子窗口才更自然。

## 三、对照 LlamaIndex 的等价实现

```python
# pip install "llama-index>=0.12" llama-index-embeddings-huggingface llama-index-llms-openai
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.core.node_parser import SentenceWindowNodeParser
from llama_index.core.postprocessor import MetadataReplacementPostProcessor

parser = SentenceWindowNodeParser.from_defaults(window_size=3)
nodes = parser.get_nodes_from_documents(docs)          # 每个节点：original_content + window
index = VectorStoreIndex(nodes, storage_context=StorageContext.from_defaults())

retriever = index.as_retriever(similarity_top_k=2)      # 用单句去匹配
postprocessor = MetadataReplacementPostProcessor(target_metadata_key="window")

nodes = retriever.retrieve("机柜负载率超过九成要怎么办")
nodes = postprocessor.postprocess_nodes(nodes, query_str="机柜负载率超过九成要怎么办")
# 此刻 node.get_content() 已是 ±3 句窗口；嵌入检索用的是单句
```

父子块（自动合并）版本：

```python
from llama_index.core.retrievers import AutoMergingRetriever
from llama_index.core.node_parser import MarkdownNodeParser
from llama_index.core.storage.docstore import SimpleDocumentStore

# 叶子块 = 句子/小段，父块 = 章节；transformations 会建立 ref 关系
docstore = SimpleDocumentStore()
retriever = AutoMergingRetriever(
    vector_retriever=index.as_retriever(similarity_top_k=6),
    docstore=docstore,
    simple_ratio_thres=0.4,      # 同父命中比例超过 40% 就上卷到父块
)
```

`simple_ratio_thres` 是这个组件唯一的旋钮，也是它最容易配错的地方：设太低（0.1）几乎总是上卷，等价于放弃小块检索；设太高（0.8）则永远只给叶子块，与本文 ① 的"上下文不足"问题一样。**用《检索层 IR 指标专篇：recall@k、MRR 与 nDCG》的脚本量一次**再定值。

## 常见坑

1. **重复计费**：k=4 个命中句各带 ±3 句窗口，重叠部分会被拼 4 遍。必须做窗口合并（本文 `sentence_window` 用 `set`）或按 `window` 文本去重；LlamaIndex 的 `MetadataReplacementPostProcessor` **不去重**，需要自己加一步。
2. **句子切分把表格/代码切断**：中文按 `。！？；` 切，遇到 Markdown 表格行、代码块、编号列表（`1.`）会切出无语义碎片。正确做法是先按块级元素保护（代码围栏、表格、公式），只在正文段落里切句。
3. **父块太大退化成大块检索**：父块取"整页/整篇"就白做了。经验起点：父块 500-1500 token，子块 1-3 句。
4. **窗口越宽越不对**：`window_size` 从 2-3 起步做网格搜索，超过 5 句后 nDCG 往往不升反降，因为无关句挤掉了相关句在重排里的位置。
5. **父块正文进了向量索引**：这样父子块都参与召回，同一个内容出现两次且分数互抢。索引里只放子块，父块只在 docstore/关系库里。
6. **引用与溯源丢失**：换成窗口/父块后，送给模型的文本不再是命中的那个节点，引用编号会指错。要在节点里同时保留 `child_id` 与 `source/page` 元数据，展示引用时用 `child_id`。
7. **嵌入模型截断窗口**：窗口只用于**作答**；如果哪天你把窗口也送去嵌入，注意模型的有效长度与"长文本衰减"（见《Embedding 模型选型》）。
8. **忘了把窗口拼进 prompt 的预算**：多查询/子查询分解时每个子查询都带窗口，上下文很容易爆。给"送入 LLM 的总字符数"设硬上限，超了先砍窗口再砍命中文档数。

## 延伸阅读

- LlamaIndex 官方示例：[Metadata Replacement + Node Sentence Window](https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/MetadataReplacementDemo/)、[AutoMergingRetriever](https://docs.llamaindex.ai/en/stable/examples/retrievers/automerging_retriever/)。
- LangChain 侧的等价组件是 `ParentDocumentRetriever`（`ids` 存元数据、`get_relevant_documents` 后按 id 回查父文档）与 `DocumentContextWindow` 风格的手工实现。
- 窗口/父块尺寸的量化调法见本站《检索层 IR 指标专篇》《RAG 评估实战：用 RAGAS 量化检索与生成质量》；分块本身的方法见《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》。

---

> **来源**：抓取于 2026-09-19。概念与组件对照引自 [LlamaIndex 官方文档示例](https://docs.llamaindex.ai/en/stable/examples/node_postprocessor/MetadataReplacementDemo/)（run-llama/llama_index，MIT 许可），原示例为 Jupyter Notebook（含 `%pip`、`display()` 与 Colab 专有代码），本文按其 API 重写为可本地运行的等价实现。
> **编者注**：第二节的切分、句子窗口、父子块代码与全部输出均为本机（macOS，Python 3.14，仅标准库）实跑结果；语料为本站编写的中文运维手册样例，不含真实生产数据。LlamaIndex 代码段按其 0.12.x 公开 API 书写，需 `pip install llama-index` 后运行。
