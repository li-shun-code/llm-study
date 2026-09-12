---
title: 混合检索：BM25 词法检索 + 向量语义检索
source_url: https://www.pinecone.io/learn/hybrid-search-intro/
author: James Briggs（Pinecone Learn Center）
license: 署名转载（原文页面未附开源许可，仅作教学署名转载）
fetched_at: 2026-09-13
translated: true
order: 8
---

> **来源**：本文翻译自 [Getting Started with Hybrid Search](https://www.pinecone.io/learn/hybrid-search-intro/)，作者 James Briggs（Pinecone Learn Center），许可署名转载（原文页面未附开源许可，仅作教学署名转载）。抓取于 2026-09-13。
> 编者注（时效性说明）：原文写于 2023 年，其中 Pinecone 客户端代码（`pinecone.init` / pod 索引）属旧版 API，已被当前 serverless 客户端取代。概念与稀疏/稠密向量构造代码与客户端无关、照原文翻译；涉及旧客户端的段落按"演进"语境转写并给出当前等价思路。

向量检索（Vector Search）为信息检索的相关性与效率打开了新大门，用例在近年爆发式增长。但它并非完美技术：在没有大规模领域数据集做微调时，传统检索仍有优势。

我们反复观察到：向量检索能解锁"聪明"的检索，却难以适配新领域；传统检索能应对新领域，但性能上限固定。两者各有利弊——如果能把它们合体呢？做一个**混合（Hybrid）检索**：既要有向量检索的性能上限，又要有传统检索的零样本适应性。

## 领域外数据集的困境

向量检索（或称**稠密检索，dense retrieval**）在嵌入模型针对目标领域微调后，显著优于传统方法。但换成"领域外（out-of-domain）"任务时，情况就变了。

有大量"医疗问答"领域数据时，可以微调一个嵌入模型，做出色的向量检索。问题是**没有数据**时：预训练嵌入模型可能优于 BM25，但多半不会。此时最好表现也就到 BM25 的水平——一个无法微调、也无法提供类人的智能检索的算法。

想要更好，只剩两条路：(1) 标注大数据集微调嵌入模型；(2) 用混合检索。

## 混合检索

稠密 + 稀疏检索的融合并不轻松。过去，工程团队要分别为稠密与稀疏检索跑不同的引擎，再用另一套系统有意义地合并结果——通常是一个稠密向量索引、一个稀疏倒排索引加一个重排步骤。

Pinecone 的混合检索用**单个**"稀疏-稠密"（sparse-dense）索引解决：支持文本、音频、图像等任何模态的检索，并用 `alpha` 参数调节稠密与稀疏的权重。

混合检索管线长什么样？虚线框内的部分由混合索引处理，但在此之前，我们仍需为输入数据构造稠密与稀疏两种向量表示。

## 实现混合检索

第一步准备数据集。用 Hugging Face Datasets 的 [`pubmed_qa`](https://huggingface.co/datasets/pubmed_qa)（医学问答，领域性强、术语密集，开箱即用的嵌入模型很难应付——正是混合检索的理想用例）：

```python
from datasets import load_dataset  # !pip install datasets

pubmed = load_dataset('pubmed_qa', 'pqa_labeled', split='train')
pubmed
# Dataset({ features: ['pubid', 'question', 'context', 'long_answer', 'final_decision'], num_rows: 1000 })
```

`context` 字段是我们要存的内容。每条记录的 context 是列表，很多片段单独看没有意义，先合并成较大的上下文：

```python
contexts = []
# 遍历并合并每条记录的上下文片段
for record in pubmed['context']:
    contexts.append('\n'.join(record['contexts']))
```

### 稀疏向量（Sparse Vectors）

构造稀疏向量有多种方法，从 SPLADE 这类最新的稀疏嵌入 Transformer，到基于规则的分词逻辑。为简单起见，本文用最朴素的分词方案——Hugging Face Transformers 的 BERT 分词器：

```python
from transformers import BertTokenizerFast  # !pip install transformers

tokenizer = BertTokenizerFast.from_pretrained('bert-base-uncased')

# 对单个上下文分词
inputs = tokenizer(contexts[0], padding=True, truncation=True, max_length=512)
inputs.keys()
# dict_keys(['input_ids', 'token_type_ids', 'attention_mask'])
```

只做分词的话，取 `input_ids` 即可——每个词/子词 token 对应一个整数 ID：

```python
input_ids = inputs['input_ids']
# [101, 16984, 3526, 2331, 1006, 7473, 2094, ...]
```

混合索引期望稀疏向量是"字典格式"：token ID 为键、出现频率为值。例如向量 `[0, 2, 9, 2, 5, 5]` 变为：

```text
{ "0": 1, "2": 2, "5": 2, "9": 1 }
```

把同样的变换应用到 `input_ids`：

```python
from collections import Counter

sparse_vec = dict(Counter(input_ids))
# {101: 1, 16984: 1, 3526: 2, 2331: 2, 1006: 10, ... }
```

把逻辑整理成两个函数：`build_dict` 把 input_ids 转字典，`generate_sparse_vectors` 负责分词 + 建字典：

```python
def build_dict(input_batch):
    # 存一批稀疏嵌入
    sparse_emb = []
    for token_ids in input_batch:
        indices = []
        values = []
        # input_ids → {token_id: 频次}
        d = dict(Counter(token_ids))
        for idx in d:
            indices.append(idx)
            values.append(d[idx])
        sparse_emb.append({'indices': indices, 'values': values})
    return sparse_emb


def generate_sparse_vectors(context_batch):
    # 生成 input_ids 批次（排除 BERT 特殊 token）
    inputs = tokenizer(
        context_batch, padding=True, truncation=True,
        max_length=512, special_tokens=False
    )['input_ids']
    # 生成稀疏字典
    sparse_embeds = build_dict(inputs)
    return sparse_embeds
```

> 🚨 原文提醒：`generate_sparse_vectors` 这种造稀疏向量的方式并非最优。生产上推荐用 [BM25](https://github.com/pinecone-io/examples/blob/master/learn/search/hybrid-search/fast-intro/pubmed-bm25.ipynb) 或 [SPLADE](https://github.com/pinecone-io/examples/blob/master/learn/search/hybrid-search/medical-qa/pubmed-splade.ipynb) 生成稀疏向量。

### 稠密向量（Dense Vectors）

稠密向量相对简单：初始化一个句向量模型，编码同样的上下文：

```python
# !pip install sentence-transformers
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('multi-qa-MiniLM-L6-cos-v1')

emb = model.encode(contexts[0])
emb.shape  # (1, 384)
```

得到 384 维稠密向量。接下来把全量数据（稀疏 + 稠密）写入混合索引。

### 创建稀疏-稠密索引并写入

> 编者注：原文此节的 `pinecone.init(...)` 与 `pod_type="s1"` 写法属旧版 pod 架构 API，当前 Pinecone 已迁移到 serverless 索引与新客户端。保留的要点是：**索引度量必须用 `dotproduct`**（混合打分依赖点积），写入时每条向量在稠密 `values` 之外附带 `sparse_values`。具体参数以 Pinecone 当前[混合检索文档](https://docs.pinecone.io/guides/search/hybrid-search)为准。

写入是分批完成的：每批 32 条，构造唯一 ID、把原文放进 metadata，同时生成稠密与稀疏向量，拼成向量字典后 upsert：

```python
from tqdm.auto import tqdm

batch_size = 32
for i in tqdm(range(0, len(contexts), batch_size)):
    i_end = min(i + batch_size, len(contexts))
    context_batch = contexts[i:i_end]
    ids = [str(x) for x in range(i, i_end)]
    meta = [{'context': context} for context in context_batch]
    dense_embeds = model.encode(context_batch).tolist()
    sparse_embeds = generate_sparse_vectors(context_batch)

    vectors = []
    for _id, sparse, dense, metadata in zip(ids, sparse_embeds, dense_embeds, meta):
        vectors.append({
            'id': _id,
            'sparse_values': sparse,   # 稀疏分量
            'values': dense,           # 稠密分量
            'metadata': metadata
        })
    # 批量写入混合索引（当前客户端：index.upsert(vectors, namespace=...)）
    ...
```

### 发起混合查询

查询与纯稠密查询几乎一致，区别是要**同时**提供查询的稀疏向量与稠密向量。`alpha` 参数控制两者权重：`alpha=1` 是纯稠密检索，`alpha=0` 是纯稀疏（词法）检索，默认 `0.5` 为纯混合。缩放通过 `hybrid_scale` 完成——把稀疏值乘 `(1 - alpha)`、稠密值乘 `alpha`：

```python
def hybrid_scale(dense, sparse, alpha: float):
    # 校验 alpha 取值范围
    if alpha < 0 or alpha > 1:
        raise ValueError("Alpha must be between 0 and 1")
    # 缩放稀疏与稠密分量，得到混合检索向量
    hsparse = {
        'indices': sparse['indices'],
        'values': [v * (1 - alpha) for v in sparse['values']]
    }
    hdense = [v * alpha for v in dense]
    return hdense, hsparse


def hybrid_query(question, top_k, alpha):
    # 问题 → 稀疏向量
    sparse_vec = generate_sparse_vectors([question])[0]
    # 问题 → 稠密向量
    dense_vec = model.encode([question]).tolist()
    # 按 alpha 缩放
    dense_vec, sparse_vec = hybrid_scale(dense_vec, sparse_vec, alpha)
    # 混合查询（当前客户端：index.query(vector=..., sparse_vector=..., top_k=...)）
    ...
```

用医学问题试一下纯稠密检索（`alpha=1`）：

```python
question = "Can clinicians use the PHQ-9 to assess depression in people with vision loss?"

hybrid_query(question, top_k=3, alpha=1)
```

```text
{'matches': [{'id': '305', 'score': 0.732677519, ...},
             {'id': '711', 'score': 0.696874201, ...},
             {'id': '735', 'score': 0.505706906, ...}],
 'namespace': ''}
```

把 `alpha` 调成 0.5、0 再各跑一遍，对比 top-K 结果与分数，就能直观评估混合检索相对纯向量检索的收益——当然，严谨的结论仍要回到第 07 篇的评估集上量化。

## 小结

混合检索 = 稠密（语义）+ 稀疏（词法）。它同时拿下两类查询：用户用日常语言描述需求时靠语义检索，用户引用精确的缩写、产品名、错误码时靠词法检索。Anthropic 的上下文检索实验（第 04 篇）也证实：嵌入 + BM25 优于纯嵌入，且两者收益可叠加。下一篇《重排序 Rerank》将展示在混合检索之后如何进一步精排。
