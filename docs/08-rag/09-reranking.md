---
title: 重排序（Rerank）：LLM 打分与 Cross-Encoder 精排
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reranking.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 9
---

> **来源**：本文翻译自 [Reranking Methods in RAG Systems](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reranking.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 编者注（时效性校订）：原 notebook 演示末段使用了 LangChain 旧版 `RetrievalQA` 链与旧 import 路径，本文按当前稳定版改写为直接函数调用（`prompt | llm` 组合），语义不变；涉及处均在文中标注。

## 概述

重排序（Reranking）是 RAG 系统中提升检索相关性与质量的关键步骤：对初检召回的文档重新评估、重新排序，确保最相关的信息被优先送入后续的生成或展示环节。

## 动机

初检方法通常依赖较简单的相似度度量，重排序允许用更精细的相关性评估弥补其不足——捕捉查询与文档之间可能被传统检索技术错过的微妙关系，让生成阶段用到最相关的信息。

## 核心组件

重排序系统一般包括：

1. **初检器（Initial Retriever）**：通常是基于嵌入相似度搜索的向量库；
2. **重排模型（Reranking Model）**：可以是给相关性打分的 LLM，或专为相关性评估训练的 Cross-Encoder（交叉编码器）模型；
3. **打分机制**：为文档分配相关性分数的方法；
4. **排序与选择逻辑**：按新分数重排并选出头部文档。

## 方法细节

重排过程通常如下：

1. **初检**：取回一批潜在相关文档；
2. **构造配对**：为每篇召回文档构造"查询-文档"对；
3. **打分**：LLM 方式用提示词让模型评估文档相关性；Cross-Encoder 方式把"查询-文档"对直接喂给模型；
4. **解析分数**：解析并归一化相关性分数；
5. **重排**：按新分数排序；
6. **选择**：取重排后最前的 K 篇。

## 这种做法的收益

1. **相关性更高**：更精细的模型能捕捉微妙的相关性因素；
2. **灵活**：可按需求与资源在不同重排方法间选择；
3. **上下文质量更高**：给 RAG 送入更相关的文档，回答质量随之提升；
4. **降噪**：过滤掉低相关信息，聚焦最相关内容。

无论用 LLM 打分还是 Cross-Encoder，重排都让文档相关性的评估更细腻、更准确，并直接转化为下游任务的表现提升。两种方法之间的取舍取决于所需精度、算力资源与应用需求。

## 实战代码

### 安装与环境

```bash
pip install -U langchain langchain-openai langchain-core python-dotenv sentence-transformers
```

准备向量库（复用第 06 篇的 `encode_pdf` 流程：加载 PDF → 分块 → OpenAI 嵌入 → FAISS）：

```python
import os
from dotenv import load_dotenv

load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")

path = "data/Understanding_Climate_Change.pdf"
vectorstore = encode_pdf(path)  # 见《最小 RAG 全流程实战》
```

### 方法一：LLM 打分重排

用结构化输出（Pydantic + `with_structured_output`）让 LLM 给每篇文档的相关性打 1-10 分：

```python
from typing import List
from pydantic import BaseModel, Field
from langchain_core.prompts import PromptTemplate
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI


class RatingScore(BaseModel):
    relevance_score: float = Field(..., description="The relevance score of a document to a query.")


def rerank_documents(query: str, docs: List[Document], top_n: int = 3) -> List[Document]:
    prompt_template = PromptTemplate(
        input_variables=["query", "doc"],
        template="""On a scale of 1-10, rate the relevance of the following document to the query. Consider the specific context and intent of the query, not just keyword matches.
        Query: {query}
        Document: {doc}
        Relevance Score:"""
    )

    llm = ChatOpenAI(temperature=0, model_name="gpt-4o", max_tokens=4000)
    llm_chain = prompt_template | llm.with_structured_output(RatingScore)

    scored_docs = []
    for doc in docs:
        input_data = {"query": query, "doc": doc.page_content}
        score = llm_chain.invoke(input_data).relevance_score
        try:
            score = float(score)
        except ValueError:
            score = 0  # 解析失败时的默认分
        scored_docs.append((doc, score))

    reranked_docs = sorted(scored_docs, key=lambda x: x[1], reverse=True)
    return [doc for doc, _ in reranked_docs[:top_n]]
```

对与文档相关的示例查询试用：

```python
query = "What are the impacts of climate change on biodiversity?"
initial_docs = vectorstore.similarity_search(query, k=15)
reranked_docs = rerank_documents(query, initial_docs)

# 打印初检前 3 篇
print("Top initial documents:")
for i, doc in enumerate(initial_docs[:3]):
    print(f"\nDocument {i+1}:")
    print(doc.page_content[:200] + "...")

print(f"Query: {query}\n")
print("Top reranked documents:")
for i, doc in enumerate(reranked_docs):
    print(f"\nDocument {i+1}:")
    print(doc.page_content[:200] + "...")
```

### 一个能说明"为什么要重排"的例子

下面这个例子里，初检的向量相似度会被字面重复误导，而重排能纠正：

```python
chunks = [
    "The capital of France is great.",
    "The capital of France is huge.",
    "The capital of France is beautiful.",
    """Have you ever visited Paris? It is a beautiful city where you can eat delicious food and see the Eiffel Tower. 
    I really enjoyed all the cities in france, but its capital with the Eiffel Tower is my favorite city.""", 
    "I really enjoyed my trip to Paris, France. The city is beautiful and the food is delicious. I would love to visit again. Such a great capital city."
]
docs = [Document(page_content=sentence) for sentence in chunks]


def compare_rag_techniques(query: str, docs: List[Document] = docs) -> None:
    from langchain_openai import OpenAIEmbeddings
    from langchain_community.vectorstores import FAISS

    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(docs, embeddings)

    print("Comparison of Retrieval Techniques")
    print("==================================")
    print(f"Query: {query}\n")

    print("Baseline Retrieval Result:")
    baseline_docs = vectorstore.similarity_search(query, k=2)
    for i, doc in enumerate(baseline_docs):
        print(f"\nDocument {i+1}:")
        print(doc.page_content)

    print("\nAdvanced Retrieval Result:")
    initial_docs = vectorstore.similarity_search(query, k=5)
    advanced_docs = rerank_documents(query, initial_docs, top_n=2)
    for i, doc in enumerate(advanced_docs):
        print(f"\nDocument {i+1}:")
        print(doc.page_content)


query = "what is the capital of france?"
compare_rag_techniques(query, docs)
```

前三个块字面上与查询高度重复（"the capital of France"），向量相似度把它们排到最前；但真正回答"法国首都是什么"的是后面提到 Paris 与埃菲尔铁塔的段落。重排模型读"懂"语义后会把它们顶上来——这正是重排的价值。

> 编者注（时效性校订）：原 notebook 此处把重排器包装成自定义 `BaseRetriever`，再接旧版 `RetrievalQA` 链生成答案。当前稳定版等价写法就是普通函数组合，如下所示。

```python
def answer_with_rerank(query: str, k_initial: int = 30, top_n: int = 2) -> str:
    """初检宽召回 → LLM 重排精取 → 生成回答。"""
    initial_docs = vectorstore.similarity_search(query, k=k_initial)
    reranked = rerank_documents(query, initial_docs, top_n=top_n)
    context = "\n\n".join(d.page_content for d in reranked)

    llm = ChatOpenAI(temperature=0, model_name="gpt-4o")
    prompt = f"Answer the question based on the context.\n\nCONTEXT:\n{context}\n\nQUESTION:\n{query}"
    return llm.invoke(prompt).content
```

### 方法二：Cross-Encoder 模型

Cross-Encoder 把"查询-文档"对一起送入模型内部做注意力交互，打分精度通常高于"双塔"式向量相似度，代价是每对都要跑一次模型：

```python
from sentence_transformers import CrossEncoder

cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L6-v2')


def cross_encoder_rerank(query: str, k: int = 10, rerank_top_k: int = 5):
    # 初检
    initial_docs = vectorstore.similarity_search(query, k=k)
    # 为 Cross-Encoder 构造（查询, 文档）配对
    pairs = [[query, doc.page_content] for doc in initial_docs]
    # Cross-Encoder 打分
    scores = cross_encoder.predict(pairs)
    # 按分数排序，返回精排头部
    scored_docs = sorted(zip(initial_docs, scores), key=lambda x: x[1], reverse=True)
    return [doc for doc, _ in scored_docs[:rerank_top_k]]
```

试用：

```python
query = "What are the impacts of climate change on biodiversity?"
top_docs = cross_encoder_rerank(query, k=10, rerank_top_k=5)

for i, doc in enumerate(top_docs):
    print(f"\nDocument {i+1}:")
    print(doc.page_content[:200] + "...")
```

## 小结

重排序是显著提升检索信息质量的强力技术：宽召回（初检 k 取大）保证不漏，精排序（LLM 或 Cross-Encoder 重排）保证不滥。配合第 04 篇 Anthropic 的数据——上下文检索再加重排可把检索失败率降低 67%——它是高级 RAG 实现的必备组件。
