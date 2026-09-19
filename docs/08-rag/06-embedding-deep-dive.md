---
title: Embedding 深入：从语义向量到语义搜索
source_url: https://huggingface.co/blog/getting-started-with-embeddings
author: Omar Espejel（Hugging Face Blog）
license: 署名转载（博客仓库未附独立开源许可，仅作教学署名转载）
fetched_at: 2026-09-13
translated: true
order: 6
group: 摄取层：解析、分块与嵌入
---
## 理解嵌入（Embedding）

嵌入是一段信息的数值表示——例如文本、文档、图片、音频等。这种表示捕捉了被嵌入对象的语义（Semantic Meaning），因此能在大量工业场景中稳定发挥作用。

给定文本"What is the main benefit of voting?"，这句话的嵌入可以表示为向量空间中的一个点，比如一列 384 个数（例如 [0.84, 0.42, ..., 0.02]）。由于这列数捕捉了语义，我们可以做很多有意思的事：计算不同嵌入之间的距离，就能判断两句话的含义有多匹配。

嵌入不限于文本！你也可以给图片生成嵌入（同样是一列 384 个数），再把它与文本嵌入比较，判断某句话是否描述了这张图。图像搜索、图像分类、图像描述等强大系统正是建立在这个概念之上。

嵌入是如何生成的？开源库 [Sentence Transformers](https://www.sbert.net/index.html)（现名 `sentence-transformers`）可以免费地从文本和图像创建最先进的嵌入。本文就用这个库演示。

## 嵌入有什么用？

> "[…] 一旦掌握了这个机器学习'多功能工具'（嵌入），你就能构建从搜索引擎、推荐系统到聊天机器人的各种东西，以及更多。你不必是拥有机器学习专长的数据科学家，也不需要海量标注数据集。" —— [Dale Markowitz, Google Cloud](https://cloud.google.com/blog/topics/developers-practitioners/meet-ais-multitool-vector-embeddings)

一旦信息（一句话、一篇文档、一张图）被嵌入，创造就开始了：大量有趣的工业应用以嵌入为基础。例如，Google 搜索用嵌入来做[文本对文本、文本对图像的匹配](https://cloud.google.com/blog/topics/developers-practitioners/meet-ais-multitool-vector-embeddings)；Snapchat 用它"[在正确的时间把正确的广告投放给正确的用户](https://eng.snap.com/machine-learning-snap-ad-ranking)"；Meta（Facebook）将其用于[社交搜索](https://research.facebook.com/publications/embedding-based-retrieval-in-facebook-search/)。

在这些公司从嵌入中挖掘智能之前，他们得先把自己的信息嵌入化。嵌入化的数据集能让算法快速地搜索、排序、分组……但自己做可能成本高、技术上复杂。本文用简单的开源工具展示：嵌入并分析一个数据集，可以很容易。

## 上手：一个 FAQ 语义搜索引擎

我们将构建一个小的常见问题（FAQ）引擎：接收用户查询，找出最相似的 FAQ。数据集使用 [US Social Security Medicare FAQs](https://faq.ssa.gov/en-US/topic/?id=CAT-01092)。

第一步是把数据集嵌入化（有些文章把 encode 和 embed 混用）。既然嵌入捕捉了问题的语义，我们就能比较不同嵌入、衡量它们的相似度，从而拿到与查询最相似的嵌入——等价于找到最相似的 FAQ。

流程概括：

1. 用嵌入模型把 Medicare 的 FAQ 全部向量化；
2. 把嵌入存起来（原文存到 Hugging Face Hub；本地实践存进向量数据库）；
3. 把用户查询向量化，与数据集逐一比较，找出最相似的 FAQ。

### 1. 选择并加载嵌入模型

从 [Sentence Transformers 模型库](https://huggingface.co/sentence-transformers)中选择一个预训练模型。这里用 ["sentence-transformers/all-MiniLM-L6-v2"](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)——小而强。每个模型都是权衡（速度 vs 精度 vs 维度）的结果，后续文章会展开选型。

> 编者注（时效性改写）：原文调用的是旧版 Inference API 端点（首次请求需等模型在服务端下载、约 20 秒）。当前稳定做法是本地加载模型，一次加载后批量编码又快又省，且不依赖网络：

```python
from sentence_transformers import SentenceTransformers

model_id = "sentence-transformers/all-MiniLM-L6-v2"
model = SentenceTransformers(model_id)

texts = ["How do I get a replacement Medicare card?",
        "What is the monthly premium for Medicare Part B?",
        "How do I terminate my Medicare Part B (medical insurance)?",
        "How do I sign up for Medicare?",
        "Can I sign up for Medicare Part B if I am working and have health insurance through an employer?",
        "How do I sign up for Medicare Part B if I already have Part A?",
        "What are Medicare late enrollment penalties?",
        "What is Medicare and who can get it?",
        "How can I get help with my Medicare Part A and Part B premiums?",
        "What are the different parts of Medicare?",
        "Will my Medicare premiums be higher because of my higher income?",
        "What is TRICARE ?",
        "Should I sign up for Medicare Part B if I have Veterans' Benefits?"]

output = model.encode(texts)
```

返回结果是"列表的列表"：每条 FAQ 对应一个嵌入。`all-MiniLM-L6-v2` 会把 13 个问题编码成 13 个 384 维向量。转成形状为 (13, 384) 的矩阵看看：

```python
import numpy as np

embeddings = np.asarray(output)
print(embeddings.shape)  # (13, 384)
print(embeddings[:3])
```

```text
[[-0.02388945  0.05525852 -0.01165488 ...  0.00577787  0.03409787 -0.0068891 ]
 [-0.0126876   0.04687412 -0.01050217 ... -0.02310316 -0.00278466  0.01047371]
 [ 0.00049438  0.11941205  0.00522949 ...  0.01687654 -0.02386115  0.00526433]
 ...]
```

### 2. 嵌入存哪里？

原文把嵌入导出 CSV 上传 Hugging Face Hub 免费托管，任何人一行代码即可加载：

```python
import pandas as pd

pd.DataFrame(embeddings).to_csv("embeddings.csv", index=False)
```

> 编者注：这是演示级的存法。生产 RAG 中，嵌入会连同原文一起存入向量数据库（FAISS、Chroma、Milvus、pgvector 等，见「数据库」与本模块第 05/06 篇），由其负责索引与近邻搜索。

### 3. 找出与查询最相似的 FAQ

假设 Medicare 客户问："How can Medicare help me?"。我们要**找出**哪条 FAQ 最能回答这个问题：先把查询嵌入化，再与数据集中每个嵌入比较，找到向量空间里最近的那个。

```python
question = ["How can Medicare help me?"]
query_embeddings = model.encode(question)
```

用 Sentence Transformers 的 `util.semantic_search` 找出与用户查询最接近（最相似）的 FAQ。该函数默认用余弦相似度（Cosine Similarity）衡量嵌入之间的接近程度；也可以换成点积（Dot Product）等其它向量空间距离函数。

```python
from sentence_transformers.util import semantic_search

hits = semantic_search(query_embeddings, embeddings, top_k=5)
```

`util.semantic_search` 逐一计算 13 条 FAQ 与查询的接近程度，返回 top `top_k` 的结果列表：

```python
[{'corpus_id': 8, 'score': 0.75653076171875},
 {'corpus_id': 7, 'score': 0.7418993711471558},
 {'corpus_id': 3, 'score': 0.7252674102783203},
 {'corpus_id': 9, 'score': 0.6735571622848511},
 {'corpus_id': 10, 'score': 0.6505177617073059}]
```

用 `corpus_id` 回查第一步定义的 `texts`，拿到最相似的 5 条 FAQ：

```python
print([texts[hits[0][i]['corpus_id']] for i in range(len(hits[0]))])
```

```text
['How can I get help with my Medicare Part A and Part B premiums?',
 'What is Medicare and who can get it?',
 'How do I sign up for Medicare?',
 'What are the different parts of Medicare?',
 'Will my Medicare premiums be higher because of my higher income?']
```

这就是与客户查询最接近的 5 条 FAQ。很棒！这里我们用 PyTorch 和 Sentence Transformers 作为主要数值工具，其实余弦相似度与排序函数也完全可以用 NumPy、SciPy 自己实现（下一章《向量检索与相似度》会手工实现这些度量）。

## 继续深入的资源（编者按当前版整理）

想进一步了解 Sentence Transformers：

- [Hub 组织页](https://huggingface.co/sentence-transformers)：所有新模型与下载说明；
- [Sentence Transformers 文档](https://www.sbert.net/)。

掌握使用之后，可以进入训练与进阶技巧（以下均为 Hugging Face 博客当前专题）：

- [Training and Finetuning Embedding Models with Sentence Transformers](https://huggingface.co/blog/train-sentence-transformers)：用当前训练 API 训练/微调嵌入模型；
- [Training and Finetuning Reranker Models with Sentence Transformers](https://huggingface.co/blog/train-reranker)：为"检索 + 重排"管线的第二阶段训练 Cross-Encoder（重排）模型；
- [Training and Finetuning Sparse Embedding Models with Sentence Transformers](https://huggingface.co/blog/train-sparse-encoder)：训练 SPLADE 等稀疏嵌入模型；
- [Multimodal Embedding & Reranker Models with Sentence Transformers](https://huggingface.co/blog/multimodal-sentence-transformers)：同一套 API 使用文本、图像、音频、视频模型；
- [🪆 Introduction to Matryoshka Embedding Models](https://huggingface.co/blog/matryoshka)：可截断到更低维度而几乎不损失质量的"套娃"嵌入；
- [Train 400x faster Static Embedding Models with Sentence Transformers](https://huggingface.co/blog/static-embeddings)：无注意力机制的 CPU 友好嵌入模型；
- [Binary and Scalar Embedding Quantization](https://huggingface.co/blog/embedding-quantization)：训练后压缩嵌入，显著加快检索、降低存储成本。

---

> **来源**：本文翻译自 [Getting Started With Embeddings](https://huggingface.co/blog/getting-started-with-embeddings)，作者 Omar Espejel（Hugging Face Blog），许可署名转载（博客仓库未附独立开源许可，仅作教学署名转载）。抓取于 2026-09-13。
> 原文通过彼时的 Hugging Face Inference API 发请求生成嵌入，该端点已被 Inference Providers 取代；编者按当前稳定做法将示例改写为本地 `SentenceTransformers` 调用（语义不变），并在文中标注。
