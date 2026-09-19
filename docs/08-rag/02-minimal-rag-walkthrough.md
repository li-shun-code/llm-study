---
title: 最小 RAG 全流程实战：一份能端到端跑通的完整程序
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb
author: Nir Diamant（RAG_Techniques，流程框架参考）；LangChain 官方文档（递归分块思想）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE；仅参考流程）；MIT（LangChain 文档思想）
fetched_at: 2026-09-19
translated: true
versions: OpenAI SDK 2.x（text-embedding-3-small / gpt-5.5）；pypdf 5.x；numpy ≥1.26；Python 3.10+
order: 2
group: 入门与最小全链路
---

## 为什么需要这篇

《什么是 RAG：检索增强生成入门》讲了"为什么要检索增强"，但从概念到第一次跑通，中间隔着六件具体的事：**清洗、分块、嵌入、建索引、检索、生成**。多数入门材料在这一步会给你两种坏选择：要么是一个框架黑盒（十行 API 调完，出了错不知道找谁），要么是一份跑不通的 notebook——依赖克隆整个示例仓库、`!pip` 与 Colab 专有代码混在正文里、辅助函数看不到实现。

这篇把这些坏选择都绕开：**一份纯 Python 的完整程序**，只用 `numpy` 加标准库就能把六步全跑通并打印真实的检索/评测结果；调通之后，换成 OpenAI 嵌入与生成只需改两个函数的实现；文末再给 LangChain 的等价写法做对照。读完你应当能回答：块多大、重多少、k 取几、什么时候该找 LLM、怎么知道检索到底行不行——每一个环节都有代码和数字撑着，而不是"感觉还行"。

## 一、概念：最小 RAG 的六个零件

```
 ┌────────┐   ┌────────┐   ┌────────┐
 │ 文档    │ → │ 清洗    │ → │ 分块    │  原始 PDF/网页 → 干净文本 → chunk 列表
 └────────┘   └────────┘   └────┬───┘
                                ↓
 ┌────────┐   ┌────────┐   ┌────────┐
 │ 答案    │ ← │ LLM    │ ← │ 向量库  │  问题+命中块 → 生成 → 带依据的回答
 └────────┘   └───▲────┘   │(嵌入+   │
                   │        │ 检索)  │  查询嵌入 → 相似度排序 → top-k 块
              查询 ─────────┘        │
```

- **清洗**：PDF 抽取常带制表符、页眉页脚、异常断行；原文 helper 里最有代表性的 `replace_t_with_space` 就是把制表符压成空格。清洗只做与"该文档的脏法"相关的事，别发明新脏。
- **分块**：检索单位与送模单位是同一个东西，尺寸两头为难（详见《句子窗口与父子块检索：用小块召回、大块作答》）。`chunk_size` 按"一个块只讲一件事"定，`chunk_overlap` 保住跨块的那半句话。
- **嵌入**：把每个块编码成一个向量；向量归一化后，余弦相似度就是点积——所以下面检索只有 `matrix @ q` 一行乘法。模型怎么选见《Embedding 模型选型实战（中文优先）》。
- **索引**：几百个块时 numpy 暴力点积就是最快最准的"索引"；上万块再谈 ANN（《向量检索与相似度：欧氏距离、点积与余弦相似度》）。
- **检索**：查询嵌入 → 排序 → 取 top-k。k 不是越大越好，上下文里无关块占比高时会污染答案。
- **生成**：把命中的块编上 `[1][2]` 塞进提示词，并**明确要求"只依据资料回答，资料没有就说不知道"**——这一句是抑制幻觉最便宜的手段。

## 二、可运行代码

### 0. 依赖与环境

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "numpy>=1.26" "openai>=2.0" "pypdf>=5.0" "python-dotenv>=1.1"
```

```python
import os            # 密钥放环境变量：export OPENAI_API_KEY=...（兼容网关另设 OPENAI_BASE_URL）
```

主线代码**不要求任何 API Key**：嵌入先用一个确定性的"哈希词频替身"（`HashEmbedder`）跑通管线，检索与评测输出都是本机实跑结果；确认管线正确后，把 `embedder.embed` 换成 `embed_openai` 即成为真实 RAG。

### 1. 语料与清洗

```python
import re

# 示例语料（生产中换成 PDF/网页抽取结果，见文末 load_pdf）
DOC = """数据中心供配电运行手册

第 1 章 电力系统
本手册适用于 A/B 级机房。双路市电供电的 A/B 路必须来自不同变压器母线，否则市电闪断时两路会同时失电，造成整机房宕机。
UPS 电池每季度做一次核对性放电，放电深度不超过额定容量的 30%。电池组内阻偏差超过 10% 时应整组更换，不允许单只混配。
柴油发电机组每月空载试机一次，每季度带载试机一次，带载率不低于 30%；油箱储油量应满足满载运行 8 小时。

第 2 章 制冷与环境
机房温度告警的默认阈值是回风温度 27℃，连续 5 分钟超过即触发 P2 告警。湿度低于 20% 时静电风险上升，需要开启加湿设备。
当同列三个以上机柜同时越限，应判定为制冷回路异常而不是负载异常，此时要立刻检查冷机群控是否有一台处于本地模式。历史上该类误判导致过两次超温降频事故。
机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。传统房间级空调在高密度场景下制冷效率明显下降。

第 3 章 机柜与负载管理
负载率超过 90% 的机柜需要在下一个变更窗口内完成迁移，迁移工单一式两份，分别由机房值班长与网络组确认。
单机柜的 PDU 单相电流不应超过额定值的 80%。A、B 两路 PDU 必须分别接在机柜两侧电源上，禁止在机柜内并线。
"""


def replace_t_with_space(text: str) -> str:
    """原 notebook 里唯一可见的清洗步骤：制表符压成空格。"""
    return re.sub(r"\t+", " ", text)
```

### 2. 递归分块（`RecursiveCharacterTextSplitter` 的等价实现）

LangChain 的分块器按分隔符优先级从粗到细递归下切：先按段落，超长再按行、按句、按字。下面 30 行是它的最小等价物，行为一致、参数可解释。

```python
SEPARATORS = ["\n\n", "\n", "。", "；", "，", ""]


def _split_keep(text: str, sep: str) -> list[str]:
    """按 sep 切分并把分隔符留在前一段末尾，避免句子丢掉句号。"""
    if not sep:
        return list(text)
    parts = text.split(sep)
    out = [p + sep for p in parts[:-1] if p]
    if parts[-1]:
        out.append(parts[-1])
    return out


def split_text(text: str, chunk_size: int = 180, chunk_overlap: int = 30) -> list[str]:
    """递归分块：按分隔符优先级从粗到细切，再把碎片聚合到不超长，块间保留重叠。"""

    def _split(piece: str, seps: list[str]) -> list[str]:
        if len(piece) <= chunk_size:
            return [piece]
        sep, rest = (seps or [""])[0], (seps or [""])[1:]
        chunks, buf = [], ""
        for frag in _split_keep(piece, sep):
            if len(frag) > chunk_size and rest:      # 单片段仍超长 → 换更细的分隔符
                if buf:
                    chunks.append(buf)
                    buf = ""
                chunks.extend(_split(frag, rest))
                continue
            if len(buf) + len(frag) <= chunk_size:
                buf += frag
            else:
                chunks.append(buf)
                tail = buf[-chunk_overlap:]           # 上一块尾部进入下一块，保住跨块语义
                buf = tail + frag if len(tail) + len(frag) <= chunk_size else frag
        if buf:
            chunks.append(buf)
        return chunks

    return [c.strip() for c in _split(text, SEPARATORS) if c.strip()]
```

### 3. 嵌入：真实实现与离线替身

```python
import zlib

import numpy as np


def embed_openai(texts: list[str], model: str = "text-embedding-3-small") -> np.ndarray:
    """真实嵌入：分批调用 OpenAI 兼容接口，返回 L2 归一化后的矩阵。"""
    from openai import OpenAI  # 密钥走环境变量，勿写进代码

    client = OpenAI()  # 自动读取 OPENAI_API_KEY / OPENAI_BASE_URL
    vectors = []
    for i in range(0, len(texts), 64):  # 单请求批量上限保护
        r = client.embeddings.create(model=model, input=texts[i : i + 64])
        vectors.extend(d.embedding for d in r.data)
    m = np.asarray(vectors, dtype=np.float32)
    return m / np.linalg.norm(m, axis=1, keepdims=True)


class HashEmbedder:
    """离线替身：字符二元组哈希成 512 维词频向量。只能跑通管线，不代表真实语义质量。"""

    def __init__(self, dim: int = 512):
        self.dim = dim

    def _vec(self, text: str) -> np.ndarray:
        chars = re.sub(r"\s+", "", text.lower())
        grams = ["".join(p) for p in zip(chars, chars[1:])] + list(chars)
        v = np.zeros(self.dim, dtype=np.float32)
        for g in grams:
            v[zlib.crc32(g.encode()) % self.dim] += 1.0
        n = np.linalg.norm(v)
        return v / n if n else v

    def embed(self, texts: list[str]) -> np.ndarray:
        return np.stack([self._vec(t) for t in texts])
```

`zlib.crc32` 而非内建 `hash()`：后者的字符串哈希每进程随机化，换一次进程结果就变了——演示与回归测试都需要确定性。

### 4. 检索：归一化之后，点积就是余弦

```python
def top_k(query: str, chunks: list[str], matrix: np.ndarray, embedder, k: int = 3):
    """返回 [(块编号, 分数, 块文本)]。生产中这一步换成向量库的 search()。"""
    q = embedder.embed([query])[0]
    sims = matrix @ q
    order = sorted(range(len(chunks)), key=lambda i: -sims[i])[:k]
    return [(i, float(sims[i]), chunks[i]) for i in order]
```

### 5. 生成：把命中的块编号塞进提示词

```python
PROMPT = """仅依据下面的资料回答问题；资料里没有的信息就回答"手册中未提及"。
【资料】
{context}
【问题】{question}
"""


def answer(question: str, hits) -> str:
    """真实调用：需要 OPENAI_API_KEY。离线演示时可注释掉函数体，只打印 prompt。"""
    context = "\n\n".join(f"[{i + 1}] {t}" for i, (_, _, t) in enumerate(hits))
    prompt = PROMPT.format(context=context, question=question)
    from openai import OpenAI

    client = OpenAI()
    r = client.chat.completions.create(
        model="gpt-5.5", temperature=0, max_completion_tokens=1024,
        messages=[{"role": "user", "content": prompt}])
    return r.choices[0].message.content
```

### 6. 迷你评测：没有标注集，就不知道"行不行"

五条查询、人工标出应命中的块号，跑一个 recall@2——这就是《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》里指标的迷你版；正式的端到端评估见《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》。

```python
LABELED = {  # 查询 -> 应命中的块序号（先打印切块结果，再人工标注）
    "市电闪断会不会导致两路同时失电": {1},
    "UPS 电池什么时候要整组更换": {2},
    "回风温度多少度会告警": {3},
    "机柜负载率超过九成的处置要求": {5},
    "柴发带载试机的要求": {2},
}


def recall_at_k(chunks, matrix, embedder, k=3):
    total, hit = 0, 0
    for q, gold in LABELED.items():
        got = {i for i, _, _ in top_k(q, chunks, matrix, embedder, k)}
        ok = bool(got & gold)
        total += 1
        hit += ok
        print(f"  {'✓' if ok else '✗'} {q} -> 命中 {sorted(got)} 应命中 {sorted(gold)}")
    return hit / total


if __name__ == "__main__":
    embedder = HashEmbedder()  # 离线替身；真实环境换成 embed_openai 的返回值
    chunks = split_text(replace_t_with_space(DOC), chunk_size=180, chunk_overlap=30)
    print(f"共 {len(chunks)} 块：")
    for i, c in enumerate(chunks):
        print(f"  [{i}] ({len(c)} 字) {c[:38]}…")
    matrix = embedder.embed(chunks)
    k = 2
    print(f"\nrecall@{k}（离线替身） =", round(recall_at_k(chunks, matrix, embedder, k=k), 3))
    q = "机柜功率密度太高怎么办"
    print(f"\n示例查询：{q}")
    for i, s, t in top_k(q, chunks, matrix, embedder, k=2):
        print(f"  #{i} 余弦 {s:.3f} | {t[:50]}…")
```

### 7. 真实运行输出（本机实跑，Python 3.14 + numpy，无任何 API 调用）

```text
共 6 块：
  [0] (11 字) 数据中心供配电运行手册…
  [1] (139 字) 第 1 章 电力系统
本手册适用于 A/B 级机房。双路市电供电的 A/B …
  [2] (84 字) 电池组内阻偏差超过 10% 时应整组更换，不允许单只混配。
柴油发电机组每月…
  [3] (153 字) 第 2 章 制冷与环境
机房温度告警的默认阈值是回风温度 27℃，连续 5 …
  [4] (89 字) 有一台处于本地模式。历史上该类误判导致过两次超温降频事故。
机柜功率密度超过…
  [5] (128 字) 第 3 章 机柜与负载管理
负载率超过 90% 的机柜需要在下一个变更窗口内…
  ✓ 市电闪断会不会导致两路同时失电 -> 命中 [1, 5] 应命中 [1]
  ✗ UPS 电池什么时候要整组更换 -> 命中 [1, 3] 应命中 [2]
  ✓ 回风温度多少度会告警 -> 命中 [1, 3] 应命中 [3]
  ✓ 机柜负载率超过九成的处置要求 -> 命中 [2, 5] 应命中 [5]
  ✓ 柴发带载试机的要求 -> 命中 [2, 5] 应命中 [2]

recall@2（离线替身） = 0.8

示例查询：机柜功率密度太高怎么办
  #4 余弦 0.327 | 有一台处于本地模式。历史上该类误判导致过两次超温降频事故。
机柜功率密度超过 8kW 时建议改用行级…
  #5 余弦 0.231 | 第 3 章 机柜与负载管理
负载率超过 90% 的机柜需要在下一个变更窗口内完成迁移，迁移工单一式两…
```

三个读法：块 `[0]` 是只有标题的 11 字碎片——切分器不认识"标题应随正文走"，这是所有按长度切的分块器的通病；`✗` 那条是替身的锅——词频向量里查询"UPS 电池…整组更换"与块 `[2]` 只共享"电池"一个字面词，真实嵌入模型能把"核对性放电/内阻偏差"与"更换"拉进同一语义邻域，这正是词法替身与语义嵌入的差距（补法见《混合检索：真正的 BM25、RRF 融合与生产实现》）。

### 8. 换成 PDF 输入与 LangChain 对照

```python
def load_pdf(path: str) -> str:
    """pypdf 逐页抽取文本层；扫描件没有文本层，见《文档解析与摄取》。"""
    from pypdf import PdfReader

    return "\n".join((page.extract_text() or "") for page in PdfReader(path).pages)
```

同一件事在 LangChain 里的写法（`pip install -U langchain langchain-community langchain-openai faiss-cpu`）：

```python
from langchain_community.document_loaders import PyPDFLoader
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

docs = PyPDFLoader("手册.pdf").load()
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200,
                                          length_function=len)  # 英文按字符即可；中文建议换 token 计数
texts = splitter.split_documents(docs)
vs = FAISS.from_documents(texts, OpenAIEmbeddings(model="text-embedding-3-small"))
retriever = vs.as_retriever(search_kwargs={"k": 2})
print(retriever.invoke("机柜功率密度太高怎么办"))
```

框架版替你做的是同一套六步。知道黑盒里装的是什么，出问题时才知道打开哪一层。

## 常见坑

1. **密钥写进代码**：一律走环境变量（`load_dotenv()` 可读 `.env`），示例代码里不要出现真实 Key。
2. **嵌入输入超长**：`text-embedding-3-small` 单条上限 8191 token；块大小没超、但拼上元数据前缀后超了，会被截断或报错。批量调用再设单请求条数上限。
3. **长度单位错位**：`chunk_size=1000` 在英文是约 250 个词，在中文按 `len()` 只是 1000 个字符≈600-700 token。中文语料先统一"字符数"口径，再对照嵌入模型的 token 上限复核。
4. **overlap 制造重复计费**：k 个命中块各自带着与邻块重叠的文字，同一句话可能进两遍 prompt。要么按重叠率去重，要么接受并计入预算（详见《句子窗口与父子块检索：用小块召回、大块作答》）。
5. **k 贪大**：top-2 不够就换 top-10，无关块会稀释注意力反而答错。先测 recall@k 曲线，找到"够用的最小 k"，再配《重排序（Rerank）：LLM 打分与 Cross-Encoder 精排》。
6. **不约束"只依据资料"**：提示词没写"资料没有就说不知道"，模型会用参数化知识把错误检索结果"圆"回来——看起来流畅，实际全错。
7. **评测零标注**：拿三个问题试一下"感觉不错"就上生产。五条人工标注的查询也比五十条凭感觉强，见《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》。
8. **换嵌入模型不重建索引**：不同模型的向量空间不通用，查询嵌入与库嵌入必须同源；换模型=全量重建。
9. **PDF 文本层假象**：扫描页 `extract_text()` 返回空串或乱序文本，分块器照切不误，检索却永远落空。摄取后抽样肉眼检查前几块。
10. **把替身当基线**：`HashEmbedder` 的输出只能证明"管线通"，不能证明"检索好"。任何质量结论必须来自真实嵌入。

## 延伸阅读

- 原流程参考：[RAG_Techniques — simple_rag.ipynb](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb)（Nir Diamant）。
- [FAISS 官方仓库](https://github.com/facebookresearch/faiss)（Meta，MIT）：向量索引库，`FAISS.from_documents` 背后的引擎。
- LangChain 文档：[Recursive Text Splitter](https://python.langchain.com/docs/how_to/recursive_text_splitter/)、[OpenAI Embeddings 集成](https://python.langchain.com/docs/integrations/text_embedding/openai/)。
- 本站相关：《什么是 RAG：检索增强生成入门》《文档解析与摄取：把 PDF、扫描件和表格变成干净的 Markdown》《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《Embedding 深入：从语义向量到语义搜索》《向量检索与相似度：欧氏距离、点积与余弦相似度》《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》《生产化 RAG：可靠管线与常见问题排查》。

---

> **来源**：抓取于 2026-09-19。流程框架译自/引自 [Simple RAG notebook](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb)（Nir Diamant，RAG_Techniques，自定义许可：非商业使用、需署名）；递归分块的思想参照 [LangChain 官方文档](https://python.langchain.com/docs/how_to/recursive_text_splitter/)（MIT）。
> **编者注**：原 notebook 的克隆仓库依赖、`!pip`、`google.colab` 专有代码与看不见的 helper 已全部替换为本文的自包含实现，`replace_t_with_space` 按原文语义内联；原文的视频推广单元格与访问统计图片单元格无知识内容，未收录。第二节全部代码与第七节输出为本站自撰实现的本机实跑结果（macOS，Python 3.14，仅 numpy + 标准库，无 API 调用）；语料为本站编写的中文运维手册样例，不含真实生产数据。`embed_openai`/`answer` 的 API 用法按 OpenAI SDK 2.x 现行参数书写，因验证环境无可用密钥，未做真实计费调用。
