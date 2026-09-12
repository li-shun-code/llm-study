---
title: 最小 RAG 全流程实战：从 PDF 到带依据的回答
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 6
---

> **来源**：本文翻译自 [Simple RAG (Retrieval-Augmented Generation) System](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 编者注（时效性校订）：原 notebook 的 LangChain import 走的是旧包路径（`langchain.document_loaders` 等），并依赖仓库内 helper 模块。本文按当前稳定版包结构（`langchain-community` / `langchain-text-splitters` / `langchain-openai`）校订 import，并把 helper 内联为独立可运行的函数；原文只在检索步收尾，编者按同一风格补上"生成回答"一步，构成完整闭环。

## 概述

本篇实现一个基础的检索增强生成（RAG）系统：处理 PDF 文档并支持提问。系统把文档内容编码进向量库（Vector Store），随后可查询以检索相关信息——这是一切 RAG 变体的最小骨架。

## 核心组件

1. PDF 处理与文本抽取
2. 文本分块（Chunking），便于后续处理
3. 用 FAISS 与 OpenAI 嵌入创建向量库
4. 配置检索器（Retriever）查询已处理的文档
5. 生成带依据的回答（编者补充步）

## 方法细节

### 文档预处理

1. 用 `PyPDFLoader` 加载 PDF；
2. 用 `RecursiveCharacterTextSplitter` 按指定的块大小（chunk size）与重叠（overlap）分块。

### 文本清洗

对文本块应用清洗函数 `replace_t_with_space`，处理 PDF 抽取中常见的多余制表符问题。

### 向量库创建

1. 用 OpenAI 嵌入为文本块生成向量表示；
2. 用这些向量创建 FAISS 向量库，支持高效相似度搜索。

### 检索器配置

配置检索器为每个查询取回最相关的 2 个块。

## 关键特性

1. **模块化设计**：整个编码过程封装在一个函数里，便于复用；
2. **可配置分块**：可调整块大小与重叠；
3. **高效检索**：FAISS 做高维空间的快速相似度搜索；
4. **可扩展**：能通过分块处理大文档；块大小、取回数量等参数都易于调整。

## 实战代码

> 编者注：以下代码相对原 notebook 的改动——import 路径换为当前包结构；helper 函数内联；新增"生成回答"单元。逻辑与原 notebook 一致。

### 安装与环境

```bash
pip install -U pypdf langchain-community langchain-text-splitters langchain-openai faiss-cpu python-dotenv
```

准备示例 PDF（原 notebook 使用其仓库中的气候变化短文）：

```bash
wget -O data/Understanding_Climate_Change.pdf \
  https://raw.githubusercontent.com/NirDiamant/RAG_TECHNIQUES/main/data/Understanding_Climate_Change.pdf
```

```python
import os
from dotenv import load_dotenv

load_dotenv()
# 确保环境变量 OPENAI_API_KEY 已在 .env 中配置
assert os.getenv("OPENAI_API_KEY"), "请在 .env 中配置 OPENAI_API_KEY"
```

### 编码文档：加载 → 分块 → 清洗 → 向量化

```python
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import FAISS


def replace_t_with_space(doc):
    """清洗 PDF 抽取文本：把制表符替换为空格，避免干扰分块与嵌入。"""
    doc.page_content = doc.page_content.replace("\t", " ")
    return doc


def encode_pdf(path, chunk_size=1000, chunk_overlap=200):
    """
    把 PDF 编码进向量库（OpenAI 嵌入 + FAISS）。

    Args:
        path: PDF 文件路径
        chunk_size: 每个文本块的目标大小
        chunk_overlap: 相邻块之间的重叠量

    Returns:
        包含文档向量表示的 FAISS 向量库
    """
    loader = PyPDFLoader(path)
    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
    )
    texts = text_splitter.split_documents(documents)
    cleaned_texts = [replace_t_with_space(t) for t in texts]

    embeddings = OpenAIEmbeddings()
    vectorstore = FAISS.from_documents(cleaned_texts, embeddings)

    return vectorstore


chunks_vector_store = encode_pdf("data/Understanding_Climate_Change.pdf",
                                 chunk_size=1000, chunk_overlap=200)
```

### 创建并测试检索器

```python
chunks_query_retriever = chunks_vector_store.as_retriever(search_kwargs={"k": 2})

def show_context(context):
    """打印检索到的上下文，便于人工检查。"""
    for i, c in enumerate(context, 1):
        print(f"--- 上下文 {i} ---\n{c}\n")

test_query = "What is the main cause of climate change?"
context = [doc.page_content for doc in chunks_query_retriever.invoke(test_query)]
show_context(context)
```

检索器会返回与"气候变化的主要原因"语义最接近的 2 个块。人工打印出来看一眼，是排查检索质量最朴素也最有效的手段。

### 生成回答（编者补充步）

检索到上下文后，把问题与上下文一起交给 LLM，得到有依据的回答：

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

def answer_question(query: str, retriever, k: int = 2) -> str:
    """最小 RAG 闭环：检索 → 拼装提示词 → 生成。"""
    docs = retriever.invoke(query)
    context = "\n\n".join(d.page_content for d in docs[:k])

    prompt = (
        "Answer the question based only on the context provided. "
        "If the context doesn't contain the answer, say you don't know.\n\n"
        f"CONTEXT:\n{context}\n\nQUESTION:\n{query}"
    )
    return llm.invoke(prompt).content

print(answer_question(test_query, chunks_query_retriever))
```

> 编者注：原 notebook 在此步之后用其 `evaluation` 模块（基于 DeepEval）对检索质量做自动化评估，并提示"仅支持 OpenAI"。评估方法本身我们在第 07 篇《RAG 评估》中专门展开。

## 这种朴素做法的收益

1. **可扩展**：通过分块处理大文档；
2. **灵活**：块大小、取回数量等参数随场景调整；
3. **高效**：FAISS 在高维空间做快速相似度搜索；
4. **对接现代 NLP**：OpenAI 嵌入提供高质量的文本表示。

## 小结

这个最小 RAG 系统是构建更复杂信息检索与问答系统的地基：把文档内容编码进可搜索的向量库，就能针对查询高效取回相关信息。凡是需要在长文档或文档集合中快速定位信息的场景，都可以从这个骨架出发——后续篇章（混合检索、重排序、查询改写）都是在这个骨架的某一环上做增强。
