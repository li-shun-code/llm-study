---
title: 元数据过滤与多维过滤检索
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_faceted_filtering.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 7
versions: RAG_Techniques main 分支（2026-09-13 抓取）
---
## 多维过滤：提升 RAG 系统的检索质量

以下为 [multi_faceted_filtering.ipynb](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_faceted_filtering.ipynb) 的完整翻译（原 notebook 附一张流程图 `multi_faceted_filtering.svg`，见仓库 images 目录）。

多维过滤在结果到达 LLM 之前，用多个互补的过滤器精炼检索到的文档集合。每个过滤器针对检索结果的一个不同质量维度：

- **元数据过滤 🔖**：只保留元数据与查询约束匹配的文档（如国家、公司或日期）。
- **相似度阈值过滤 📏**：丢弃相关度分数低于阈值的文档。
- **内容过滤 🔑**：要求文档内容中出现必要的关键词。
- **多样性过滤 🌈**：移除近乎重复的文档，使最终上下文覆盖更多不同的信息。

把这些过滤器组合使用，可以得到更小、更高质量的上下文，从而降低生成答案中的噪声、token 成本与幻觉风险。

该 notebook 在一个带丰富元数据的客户数据集上演示这项技术，使用 LangChain 与 Chroma 向量库。

## 安装包与导入

下面的单元格安装本 notebook 所需的全部包。

```python
# Install required packages
!pip install langchain langchain-chroma langchain-huggingface langchain-openai python-dotenv sentence-transformers
```

```python
# Clone the repository to access helper functions and evaluation modules
!git clone https://github.com/NirDiamant/RAG_TECHNIQUES.git
```

```python
import csv
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI

sys.path.append(os.path.abspath('RAG_TECHNIQUES'))
from helper_functions import text_wrap

# Load environment variables from a .env file
load_dotenv()
```

## 下载数据集

本 notebook 使用仓库自带的 `customers-100.csv` 小型客户数据集。每一行变成一个 `Document`，其元数据保存客户的国家、公司、城市、订阅日期与网站——非常适合演示元数据感知的过滤。

```python
# Download required data files
os.makedirs('data', exist_ok=True)

# Download the customer dataset used in this notebook
!wget -O data/customers-100.csv https://raw.githubusercontent.com/NirDiamant/RAG_TECHNIQUES/main/data/customers-100.csv
```

```python
def load_customer_documents(csv_path: str) -> List[Document]:
    """Convert each row of the customer dataset into a Document with rich metadata."""
    docs = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            content = (
                f"{row['First Name']} {row['Last Name']} from {row['Company']} "
                f"in {row['City']}, {row['Country']}. "
                f"Subscribed on {row['Subscription Date']}. "
                f"Website: {row['Website']}"
            )
            docs.append(Document(
                page_content=content,
                metadata={
                    "country": row["Country"],
                    "company": row["Company"],
                    "city": row["City"],
                    "subscription_date": row["Subscription Date"],
                    "website": row["Website"],
                },
            ))
    return docs


customers = load_customer_documents("data/customers-100.csv")
print(f"Loaded {len(customers)} customer documents")
print(customers[0].page_content)
print(customers[0].metadata)
```

## 构建向量库

用本地 sentence-transformer 模型嵌入每个客户文档，并把嵌入索引进 Chroma 向量库。

```python
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

vectorstore = Chroma.from_documents(customers, embedding=embeddings)
```

## 基线检索

为一个查询取回 top-10 文档。注意原始结果集混杂了相关与不太相关的文档，而且若干结果可能带有互相重叠的信息。

```python
query = "Which customers work for companies in Chile?"

results = vectorstore.similarity_search_with_relevance_scores(query, k=10)
print(f"Retrieved {len(results)} documents\n")
for doc, score in results:
    print(f"{score:.3f} | {doc.metadata['country']:<10} | {doc.metadata['company']}")
```

## 过滤器 1：元数据过滤 🔖

元数据过滤只保留元数据与查询约束匹配的文档。本例只关心来自智利（Chile）的客户，所以在 `country` 字段上过滤。

```python
def apply_metadata_filter(
    doc_score_pairs: List[Tuple[Document, float]],
    filters: Optional[Dict[str, Any]] = None,
) -> List[Tuple[Document, float]]:
    """Keep only documents whose metadata matches the given key-value filters."""
    if not filters:
        return doc_score_pairs
    return [
        (doc, score) for doc, score in doc_score_pairs
        if all(doc.metadata.get(key) == value for key, value in filters.items())
    ]


metadata_filtered = apply_metadata_filter(results, {"country": "Chile"})
print(f"Kept {len(metadata_filtered)} of {len(results)} documents\n")
for doc, score in metadata_filtered:
    print(f"{score:.3f} | {doc.metadata['city']:<15} | {doc.metadata['company']}")
```

## 过滤器 2：相似度阈值过滤 📏

相似度阈值过滤丢弃相关度分数低于阈值的文档，只保留最相关的结果。阈值应当针对每个嵌入模型与语料单独调校。

```python
def apply_similarity_threshold(
    doc_score_pairs: List[Tuple[Document, float]],
    threshold: float = 0.35,
) -> List[Tuple[Document, float]]:
    """Keep only documents whose relevance score is above the threshold."""
    return [(doc, score) for doc, score in doc_score_pairs if score >= threshold]


threshold_filtered = apply_similarity_threshold(results, threshold=0.35)
print(f"Kept {len(threshold_filtered)} of {len(results)} documents\n")
for doc, score in threshold_filtered:
    print(f"{score:.3f} | {doc.metadata['country']:<10} | {doc.metadata['company']}")
```

## 过滤器 3：内容过滤 🔑

内容过滤只保留文本包含所需关键词的文档。当查询隐含"答案证据中必须出现的词"时，这很有用。

```python
def apply_content_filter(
    doc_score_pairs: List[Tuple[Document, float]],
    keywords: Optional[List[str]] = None,
    require_all: bool = True,
) -> List[Tuple[Document, float]]:
    """Keep only documents whose content contains the required keywords.

    With ``require_all=True`` every keyword must appear in the document;
    otherwise a single match is enough.
    """
    if not keywords:
        return doc_score_pairs
    keywords_lower = [k.lower() for k in keywords]
    filtered = []
    for doc, score in doc_score_pairs:
        content = doc.page_content.lower()
        matches = [k in content for k in keywords_lower]
        if (all(matches) if require_all else any(matches)):
            filtered.append((doc, score))
    return filtered


content_filtered = apply_content_filter(results, ["chile"])
print(f"Kept {len(content_filtered)} of {len(results)} documents\n")
for doc, score in content_filtered:
    print(f"{score:.3f} | {doc.metadata['country']:<10} | {doc.metadata['company']}")
```

## 过滤器 4：多样性过滤 🌈

多样性过滤移除近乎重复的文档，让最终上下文覆盖更多不同的信息。下面的实现是一次贪心的 MMR 风格遍历：只有当文档与每一个已保留文档的余弦相似度都低于阈值时才保留。

```python
def apply_diversity_filter(
    doc_score_pairs: List[Tuple[Document, float]],
    embeddings: HuggingFaceEmbeddings,
    similarity_threshold: float = 0.9,
) -> List[Tuple[Document, float]]:
    """Remove near-duplicate documents greedily using embedding cosine similarity."""
    if embeddings is None:
        raise ValueError(
            "embeddings are required when diversity filtering is enabled; "
            "pass a HuggingFaceEmbeddings instance to apply_diversity_filter"
        )
    kept: List[Tuple[Document, float]] = []
    kept_vectors: List[np.ndarray] = []
    for doc, score in doc_score_pairs:
        vector = np.asarray(embeddings.embed_query(doc.page_content))
        is_duplicate = any(
            float(np.dot(vector, other) / (np.linalg.norm(vector) * np.linalg.norm(other)))
            >= similarity_threshold
            for other in kept_vectors
        )
        if not is_duplicate:
            kept.append((doc, score))
            kept_vectors.append(vector)
    return kept


diversity_filtered = apply_diversity_filter(results, embeddings, similarity_threshold=0.9)
print(f"Kept {len(diversity_filtered)} of {len(results)} documents\n")
for doc, score in diversity_filtered:
    print(f"{score:.3f} | {doc.metadata['country']:<10} | {doc.metadata['company']}")
```

## 组合全部过滤器 🧩

四个过滤器可以组合成一条流水线。每个过滤器都是可选的，因此流水线可以适配具体的检索场景。

```python
def multi_faceted_filter(
    doc_score_pairs: List[Tuple[Document, float]],
    metadata_filters: Optional[Dict[str, Any]] = None,
    score_threshold: Optional[float] = None,
    required_keywords: Optional[List[str]] = None,
    diversity_threshold: Optional[float] = None,
    embeddings: Optional[HuggingFaceEmbeddings] = None,
) -> List[Tuple[Document, float]]:
    """Apply metadata, similarity, content and diversity filters in sequence."""
    filtered = doc_score_pairs
    if metadata_filters:
        filtered = apply_metadata_filter(filtered, metadata_filters)
    if score_threshold is not None:
        filtered = apply_similarity_threshold(filtered, score_threshold)
    if required_keywords:
        filtered = apply_content_filter(filtered, required_keywords)
    if diversity_threshold is not None:
        filtered = apply_diversity_filter(filtered, embeddings, diversity_threshold)
    return filtered


filtered = multi_faceted_filter(
    results,
    metadata_filters={"country": "Chile"},
    score_threshold=0.35,
    required_keywords=["chile"],
    diversity_threshold=0.9,
    embeddings=embeddings,
)

print(f"Before filtering: {len(results)} documents")
print(f"After filtering:  {len(filtered)} documents\n")
for doc, score in filtered:
    print(f"{score:.3f} | {doc.metadata['city']:<15} | {doc.metadata['company']}")
```

### 用例示例

端到端示例：取回候选文档，用完整流水线过滤，再从干净的上下文生成答案。

```python
query = "Which customer accounts in Chile should our sales team prioritize, and which company does each one belong to?"

# Retrieve candidates and apply the full filtering pipeline
results = vectorstore.similarity_search_with_relevance_scores(query, k=10)
filtered = multi_faceted_filter(
    results,
    metadata_filters={"country": "Chile"},
    score_threshold=0.35,
    required_keywords=["chile"],
    diversity_threshold=0.9,
    embeddings=embeddings,
)

context = "\n\n".join(text_wrap(doc.page_content) for doc, _ in filtered)

llm = ChatOpenAI(model="gpt-4o", temperature=0)
response = llm.invoke(
    "Based on the following customer records, answer the question.\n\n"
    f"Question: {query}\n\nRecords:\n{context}"
)
print(response.content)
```

> 编者注：原 notebook 末尾有一个访问统计用的跟踪图片单元格，无知识内容，未收录。

---

> **来源**：本文翻译自 [Multi-faceted Filtering for Improved Retrieval in RAG Systems](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_faceted_filtering.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 完整性说明：原 notebook 全部 26 个单元格（25 个知识单元格 + 1 个统计跟踪单元格）全部收录或注明；markdown 说明全文翻译，代码逐格保留、仅注释翻译为中文。
> 选型背景：本篇原定来源 Pinecone《Filtered Search》（pinecone.io/learn/filter-search/）已于 2026 年改版下线（该 URL 现返回 404），故按任务备选方案改用 NirDiamant 的对应 notebook。
