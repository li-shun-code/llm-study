---
title: RAG 评估实战：用 RAGAS 量化检索与生成质量
source_url: https://raw.githubusercontent.com/explodinggradients/ragas/main/docs/getstarted/rag_eval.md
author: RAGAS 项目（Exploding Gradients）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 9
---

RAG 改了一版分块策略、换了一个嵌入模型，效果到底变好还是变坏？"感觉上更准了"不算数，你需要可复现的量化评估。RAGAS 是当前最流行的 RAG 评估框架之一，本篇翻译其官方入门文档，覆盖两条主线：**评估一个简单 RAG 系统**与**为评估自动生成测试集**。

## 一、评估一个简单的 RAG 系统

本指南演示用 `ragas` 测试与评估 RAG 系统的简单工作流，假定你已具备 RAG 构建与评估的基础知识。安装见[官方安装说明](https://docs.ragas.io/en/stable/getstarted/install/)。

### 基础设置

我们用 `langchain_openai` 配置 LLM 与嵌入模型（你也可以换成任何模型，见 RAGAS 的自定义模型文档）：

```python
from langchain_openai import ChatOpenAI
from ragas.embeddings import OpenAIEmbeddings
import openai

llm = ChatOpenAI(model="gpt-4o")
openai_client = openai.OpenAI()
embeddings = OpenAIEmbeddings(client=openai_client)
```

> 注意：`ragas.embeddings.OpenAIEmbeddings` 暴露的是 `embed_text`（单条）与 `embed_texts`（批量），而不是某些 LangChain 封装的 `embed_query`/`embed_documents`。下例对文档用 `embed_texts`、对查询用 `embed_text`。

### 搭建一个简单的 RAG 系统

需要定义三个组件：文档向量化、相关文档检索、回答生成。

```python
import numpy as np

class RAG:
    def __init__(self, model="gpt-4o"):
        import openai
        self.llm = ChatOpenAI(model=model)
        openai_client = openai.OpenAI()
        self.embeddings = OpenAIEmbeddings(client=openai_client)
        self.doc_embeddings = None
        self.docs = None

    def load_documents(self, documents):
        """加载文档并计算嵌入。"""
        self.docs = documents
        self.doc_embeddings = self.embeddings.embed_texts(documents)

    def get_most_relevant_docs(self, query):
        """为给定查询找出最相关的文档。"""
        if not self.docs or not self.doc_embeddings:
            raise ValueError("Documents and their embeddings are not loaded.")

        query_embedding = self.embeddings.embed_text(query)
        similarities = [
            np.dot(query_embedding, doc_emb)
            / (np.linalg.norm(query_embedding) * np.linalg.norm(doc_emb))
            for doc_emb in self.doc_embeddings
        ]
        most_relevant_doc_index = np.argmax(similarities)
        return [self.docs[most_relevant_doc_index]]

    def generate_answer(self, query, relevant_doc):
        """基于最相关文档为查询生成回答。"""
        prompt = f"question: {query}\n\nDocuments: {relevant_doc}"
        messages = [
            ("system", "You are a helpful assistant that answers questions based on given documents only."),
            ("human", prompt),
        ]
        ai_msg = self.llm.invoke(messages)
        return ai_msg.content
```

### 加载文档并试跑

```python
sample_docs = [
    "Albert Einstein proposed the theory of relativity, which transformed our understanding of time, space, and gravity.",
    "Marie Curie was a physicist and chemist who conducted pioneering research on radioactivity and won two Nobel Prizes.",
    "Isaac Newton formulated the laws of motion and universal gravitation, laying the foundation for classical mechanics.",
    "Charles Darwin introduced the theory of evolution by natural selection in his book 'On the Origin of Species'.",
    "Ada Lovelace is regarded as the first computer programmer for her work on Charles Babbage's early mechanical computer, the Analytical Engine."
]

rag = RAG()
rag.load_documents(sample_docs)

query = "Who introduced the theory of relativity?"
relevant_doc = rag.get_most_relevant_docs(query)
answer = rag.generate_answer(query, relevant_doc)

print(f"Query: {query}")
print(f"Relevant Document: {relevant_doc}")
print(f"Answer: {answer}")
```

输出：

```text
Query: Who introduced the theory of relativity?
Relevant Document: ['Albert Einstein proposed the theory of relativity, which transformed our understanding of time, space, and gravity.']
Answer: Albert Einstein introduced the theory of relativity.
```

### 收集评估数据

先准备一组查询，跑过 RAG 系统后为每条查询收集 `response`（系统回答）与 `retrieved_contexts`（检索上下文），并可选地准备一组标准答案（golden answers）：

```python
sample_queries = [
    "Who introduced the theory of relativity?",
    "Who was the first computer programmer?",
    "What did Isaac Newton contribute to science?",
    "Who won two Nobel Prizes for research on radioactivity?",
    "What is the theory of evolution by natural selection?"
]

expected_responses = [
    "Albert Einstein proposed the theory of relativity, which transformed our understanding of time, space, and gravity.",
    "Ada Lovelace is regarded as the first computer programmer for her work on Charles Babbage's early mechanical computer, the Analytical Engine.",
    "Isaac Newton formulated the laws of motion and universal gravitation, laying the foundation for classical mechanics.",
    "Marie Curie was a physicist and chemist who conducted pioneering research on radioactivity and won two Nobel Prizes.",
    "Charles Darwin introduced the theory of evolution by natural selection in his book 'On the Origin of Species'."
]
```

```python
dataset = []

for query, reference in zip(sample_queries, expected_responses):
    relevant_docs = rag.get_most_relevant_docs(query)
    response = rag.generate_answer(query, relevant_docs)
    dataset.append(
        {
            "user_input": query,
            "retrieved_contexts": relevant_docs,
            "response": response,
            "reference": reference
        }
    )
```

把数据装载进 `EvaluationDataset`：

```python
from ragas import EvaluationDataset

evaluation_dataset = EvaluationDataset.from_list(dataset)
```

### 评估

用常用的 RAG 评估指标跑评估。评估器 LLM（Evaluator LLM）可换任意模型：

```python
from ragas import evaluate
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import LLMContextRecall, Faithfulness, FactualCorrectness

evaluator_llm = LangchainLLMWrapper(llm)

result = evaluate(
    dataset=evaluation_dataset,
    metrics=[LLMContextRecall(), Faithfulness(), FactualCorrectness()],
    llm=evaluator_llm
)
result
```

输出：

```text
{'context_recall': 1.0000, 'faithfulness': 0.8571, 'factual_correctness': 0.7280}
```

> 编者注：三个指标分别回答三个问题——**Context Recall（上下文召回）**：检索到的上下文覆盖了标准答案中的多少关键声明（评估检索）；**Faithfulness（忠实度）**：回答是否严格有依据于检索上下文、有没有自由发挥（评估幻觉）；**Factual Correctness（事实正确性）**：回答与标准答案的事实一致程度（评估最终质量）。检索变差先看 recall，回答跑偏先看 faithfulness。

## 二、为 RAG 自动生成测试集

手写评估集又慢又容易偏。RAGAS 可以用你自己的文档**自动合成测试集**（合成查询 + 标准答案）。

### 快速开始

加载示例文档（可替换为你自己的）：

```bash
git clone https://huggingface.co/datasets/vibrantlabsai/Sample_Docs_Markdown
```

```python
from langchain_community.document_loaders import DirectoryLoader

path = "Sample_Docs_Markdown/"
loader = DirectoryLoader(path, glob="**/*.md")
docs = loader.load()
```

选定 LLM 与嵌入模型后，直接生成测试集：

```python
from ragas.testset import TestsetGenerator

generator = TestsetGenerator(llm=generator_llm, embedding_model=generator_embeddings)
dataset = generator.generate_with_langchain_docs(docs, testset_size=10)
```

导出为 pandas DataFrame 查看与筛选：

```python
dataset.to_pandas()
```

### 深入一点：测试集生成管线的两大组件

**1. 知识图谱（KnowledgeGraph）创建**：先把你提供的文档建成知识图谱，再用各种"转换（Transformations）"丰富图信息，供后续生成测试集使用：

```python
from ragas.testset.graph import KnowledgeGraph, Node, NodeType

kg = KnowledgeGraph()
for doc in docs:
    kg.nodes.append(
        Node(
            type=NodeType.DOCUMENT,
            properties={"page_content": doc.page_content, "document_metadata": doc.metadata}
        )
    )
```

用默认转换集丰富图谱（LLM 与嵌入模型自选，也可以混搭自定义转换）：

```python
from ragas.testset.transforms import default_transforms, apply_transforms

trans = default_transforms(
    documents=docs,
    llm=generator_llm,
    embedding_model=generator_embeddings
)
apply_transforms(kg, trans)

kg.save("knowledge_graph.json")
loaded_kg = KnowledgeGraph.load("knowledge_graph.json")
```

**2. 测试集生成**：用知识图谱生成一组"场景（Scenario）"，再由场景合成测试集。可以定义查询类型的分布——默认分布是：

```text
[
    (SingleHopSpecificQuerySynthesizer(llm=llm), 0.5),
    (MultiHopAbstractQuerySynthesizer(llm=llm), 0.25),
    (MultiHopSpecificQuerySynthesizer(llm=llm), 0.25),
]
```

即 50% 单跳具体问题、25% 多跳抽象问题、25% 多跳具体问题——多跳（Multi-hop）查询需要综合多个文档，恰好考验《Agentic RAG：从固定管线到会思考的检索》 Agentic RAG 强调的多步检索能力。

```python
from ragas.testset.synthesizers import default_query_distribution

generator = TestsetGenerator(llm=generator_llm, embedding_model=embedding_model, knowledge_graph=loaded_kg)
query_distribution = default_query_distribution(generator_llm)

testset = generator.generate(testset_size=10, query_distribution=query_distribution)
testset.to_pandas()
```

> 编者注：评估驱动开发（Eval-Driven Development）是 RAG 工程的核心方法论——先固定评估集与指标，再迭代分块、检索、重排等每一环（呼应第 05 篇末尾的建议）。后续的混合检索、重排序等优化，都应该以本篇的评估流程为准绳验证收益。

---

> **来源**：本文翻译自 RAGAS 官方文档 [Evaluate a simple RAG system](https://raw.githubusercontent.com/explodinggradients/ragas/main/docs/getstarted/rag_eval.md) 与 [Testset Generation for RAG](https://raw.githubusercontent.com/explodinggradients/ragas/main/docs/getstarted/rag_testset_generation.md)，作者 RAGAS 项目（Exploding Gradients），许可 Apache 2.0。抓取于 2026-09-13。
