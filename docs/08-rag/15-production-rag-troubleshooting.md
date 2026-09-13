---
title: 生产化 RAG：可靠管线与常见问题排查
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reliable_rag.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 15
---

## 概述：从"能跑"到"可靠"

Demo 级 RAG 与生产级 RAG 的差距，在于**对失败模式的防御**。RAG 的输出由"检索质量 × 生成质量"共同决定，任何一环失守都会产生错误回答。"可靠 RAG（Reliable RAG）"的核心思想是：在管线中插入多个**验证关卡（Grader）**——检索后逐块核验相关性，生成后核查是否有依据，并给出可追溯的引用片段。本篇把这套流程完整走一遍：

1. 建索引（加载网页 → 分块 → 嵌入 → 向量库）；
2. 检索文档；
3. **文档相关性分级**：过滤不相关文档；
4. 生成回答；
5. **幻觉检查**：核验回答是否被事实支撑；
6. **高亮引用**：指出回答所用的原文片段。

## 实战代码

### 安装与环境

```bash
pip install -U langchain langchain-community langchain-text-splitters langchain-core langchain-groq langchain-cohere chromadb python-dotenv
```

```python
import os
from dotenv import load_dotenv

load_dotenv()
os.environ['GROQ_API_KEY'] = os.getenv('GROQ_API_KEY')    # 用于 LLM
os.environ['COHERE_API_KEY'] = os.getenv('COHERE_API_KEY') # 用于嵌入
```

### 建索引

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import WebBaseLoader
from langchain_chroma import Chroma
from langchain_cohere import CohereEmbeddings

# 嵌入模型
embedding_model = CohereEmbeddings(model="embed-english-v3.0")

# 待索引文档
urls = [
    "https://www.deeplearning.ai/the-batch/how-agents-can-improve-llm-performance/?ref=dl-staging-website.ghost.io",
    "https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-2-reflection/?ref=dl-staging-website.ghost.io",
    "https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-3-tool-use/?ref=dl-staging-website.ghost.io",
    "https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-4-planning/?ref=dl-staging-website.ghost.io",
    "https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-5-multi-agent-collaboration/?ref=dl-staging-website.ghost.io"
]

# 加载
docs = [WebBaseLoader(url).load() for url in urls]
docs_list = [item for sublist in docs for item in sublist]

# 切分
text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    chunk_size=500, chunk_overlap=0
)
doc_splits = text_splitter.split_documents(docs_list)

# 写入向量库
vectorstore = Chroma.from_documents(
    documents=doc_splits,
    collection_name="rag",
    embedding=embedding_model,
)

retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={'k': 4},  # 取回数量
)
```

### 提问与检索

```python
question = "what are the differnt kind of agentic design patterns?"

docs = retriever.invoke(question)

# 看看取回的文档长什么样
print(f"Title: {docs[0].metadata['title']}\n\nSource: {docs[0].metadata['source']}\n\nContent: {docs[0].page_content}\n")
```

### 关卡一：文档相关性分级（过滤不相关检索）

```python
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_groq import ChatGroq

# 数据模型：相关性的二值判定
class GradeDocuments(BaseModel):
    """Binary score for relevance check on retrieved documents."""

    binary_score: str = Field(
        description="Documents are relevant to the question, 'yes' or 'no'"
    )


# 带结构化输出的 LLM
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
structured_llm_grader = llm.with_structured_output(GradeDocuments)

# 提示词
system = """You are a grader assessing relevance of a retrieved document to a user question. \n 
    If the document contains keyword(s) or semantic meaning related to the user question, grade it as relevant. \n
    It does not need to be a stringent test. The goal is to filter out erroneous retrievals. \n
    Give a binary score 'yes' or 'no' score to indicate whether the document is relevant to the question."""
grade_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "Retrieved document: \n\n {document} \n\n User question: {question}"),
    ]
)

retrieval_grader = grade_prompt | structured_llm_grader
```

过滤不相关文档：

```python
docs_to_use = []
for doc in docs:
    print(doc.page_content, '\n', '-' * 50)
    res = retrieval_grader.invoke({"question": question, "document": doc.page_content})
    print(res, '\n')
    if res.binary_score == 'yes':
        docs_to_use.append(doc)
```

> 编者注：分级提示词刻意宽松——"只要包含关键词或语义相关即算相关"，目标是**过滤错误召回**而非苛求精确。这正是生产排障的第一原则：先做便宜的粗筛，再做昂贵的精筛（对应第 09 篇的重排）。

### 生成回答

```python
from langchain_core.output_parsers import StrOutputParser

# 提示词
system = """You are an assistant for question-answering tasks. Answer the question based upon your knowledge. 
Use three-to-five sentences maximum and keep the answer concise."""
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "Retrieved documents: \n\n <docs>{documents}</docs> \n\n User question: <question>{question}</question>"),
    ]
)

# LLM
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)

# 后处理
def format_docs(docs):
    return "\n".join(f"<doc{i+1}>:\nTitle:{doc.metadata['title']}\nSource:{doc.metadata['source']}\nContent:{doc.page_content}\n</doc{i+1}>\n" for i, doc in enumerate(docs))

# LCEL 管线
rag_chain = prompt | llm | StrOutputParser()

# 运行
generation = rag_chain.invoke({"documents": format_docs(docs_to_use), "question": question})
print(generation)
```

### 关卡二：幻觉检查（回答是否有依据）

```python
# 数据模型
class GradeHallucinations(BaseModel):
    """Binary score for hallucination present in 'generation' answer."""

    binary_score: str = Field(
        ...,
        description="Answer is grounded in the facts, 'yes' or 'no'"
    )

# LLM
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
structured_llm_grader = llm.with_structured_output(GradeHallucinations)

# 提示词
system = """You are a grader assessing whether an LLM generation is grounded in / supported by a set of retrieved facts. \n 
    Give a binary score 'yes' or 'no'. 'Yes' means that the answer is grounded in / supported by the set of facts."""
hallucination_prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system),
        ("human", "Set of facts: \n\n <facts>{documents}</facts> \n\n LLM generation: <generation>{generation}</generation>"),
    ]
)

hallucination_grader = hallucination_prompt | structured_llm_grader

response = hallucination_grader.invoke({"documents": format_docs(docs_to_use), "generation": generation})
print(response)
```

若判定为"no"（回答缺乏依据），生产系统应触发重试：重新检索、改写查询（第 10 篇）或降级为"无法回答"——宁可说不知道，也不输出幻觉。

### 关卡三：高亮引用（回答用了哪些原文片段）

```python
from typing import List
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate

# 数据模型
class HighlightDocuments(BaseModel):
    """Return the specific part of a document used for answering the question."""

    id: List[str] = Field(
        ...,
        description="List of id of docs used to answers the question"
    )
    title: List[str] = Field(
        ...,
        description="List of titles used to answers the question"
    )
    source: List[str] = Field(
        ...,
        description="List of sources used to answers the question"
    )
    segment: List[str] = Field(
        ...,
        description="List of direct segements from used documents that answers the question"
    )

# LLM
llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)

# 解析器
parser = PydanticOutputParser(pydantic_object=HighlightDocuments)

# 提示词
system = """You are an advanced assistant for document search and retrieval. You are provided with the following:
1. A question.
2. A generated answer based on the question.
3. A set of documents that were referenced in generating the answer.

Your task is to identify and extract the exact inline segments from the provided documents that directly correspond to the content used to 
generate the given answer. The extracted segments must be verbatim snippets from the documents, ensuring a word-for-word match with the text 
in the provided documents.

Ensure that:
- (Important) Each segment is an exact match to a part of the document and is fully contained within the document text.
- The relevance of each segment to the generated answer is clear and directly supports the answer provided.
- (Important) If you didn't used the specific document don't mention it.

Used documents: <docs>{documents}</docs> \n\n User question: <question>{question}</question> \n\n Generated answer: <answer>{generation}</answer>

<format_instruction>
{format_instructions}
</format_instruction>
"""

prompt = PromptTemplate(
    template=system,
    input_variables=["documents", "question", "generation"],
    partial_variables={"format_instructions": parser.get_format_instructions()},
)

# 管线
doc_lookup = prompt | llm | parser

# 运行
lookup_response = doc_lookup.invoke({"documents": format_docs(docs_to_use), "question": question, "generation": generation})

for id, title, source, segment in zip(lookup_response.id, lookup_response.title, lookup_response.source, lookup_response.segment):
    print(f"ID: {id}\nTitle: {title}\nSource: {source}\nText Segment: {segment}\n")
```

输出即为"回答 ← 原文片段"的逐条对照：用户可以点击来源直接核对原文，这正是第 01 篇所说"来源引用建立信任"的落地形态，也呼应第 12 篇 GraphRAG 的证据溯源思想。

## 生产架构检查清单（编者补充）

把本篇的验证关卡与全模块内容收拢成一张上线前清单：

**表：生产 RAG 检查清单**

| 环节 | 关键实践 | 对应篇章 |
| --- | --- | --- |
| 解析 | 真实文档小样本评测；表格/公式/扫描件专项检查 | 02 |
| 分块 | 固定分块起步；复杂文档用上下文检索补上下文 | 04 |
| 检索 | 混合检索（语义 + 词法）；度量与嵌入模型一致 | 05 / 08 |
| 精排 | 宽召回 + 重排；上下文数量实测（top-K） | 09 |
| 查询侧 | 改写 / 退后 / 分解；多轮会话要带历史改写 | 10 |
| 生成 | 提示词约束"只依据上下文"；temperature 取低 | 06 |
| 验证 | 相关性分级 → 幻觉检查 → 引用高亮，层层设卡 | 本篇 |
| 评估 | 固定评估集 + 指标，任何改动先过评估 | 07 |
| 架构 | 结构化问题路由到 Text2SQL；复杂问题交给 Agent 编排 | 13 / 14 |

**常见问题速查**：

- **检索不到明显存在的内容** → 先查解析（PDF 表格丢了？），再查分块（上下文被切断？），最后查嵌入（术语/缩写领域外？换混合检索）；
- **回答张冠李戴** → 检索相关性分级缺失，或 top-K 塞太多噪声块；
- **回答编造数字** → 缺幻觉检查关；表格类内容优先考虑多模态打字幕或 Text2SQL；
- **延迟/成本高** → 初检减量、缓存查询嵌入、对热问题做语义缓存，重排只在必要时启用；
- **改了分块策略不知道好坏** → 没有评估集就上线，等于盲飞（回到第 07 篇）。

---

> **来源**：本文主体翻译自 [Reliable RAG](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/reliable_rag.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 编者注（时效性校订）：原 notebook 使用 Groq 上的 `mixtral-8x7b-32768`（该模型已退役）与旧 import 路径 `langchain.text_splitter`；本文分别改为当前可用模型（`llama-3.3-70b-versatile`）与当前包路径，逻辑不变。文末"生产架构检查清单"为本站补充。
