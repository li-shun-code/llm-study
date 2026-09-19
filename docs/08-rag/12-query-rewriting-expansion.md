---
title: Query 改写与扩展：改写、退后提示与子查询分解
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/query_transformations.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 12
group: 检索层：相似度、过滤、混合与重排
---
## 概述

本篇实现三种查询变换（Query Transformation）技术来增强 RAG 系统的检索：

1. 查询改写（Query Rewriting）
2. 退后提示（Step-back Prompting）
3. 子查询分解（Sub-query Decomposition）

每种技术的目标都是通过修改或扩展原始查询，提升召回信息的相关性与全面性。

## 动机

RAG 系统在处理复杂或含糊查询时，经常检索不到最相关的信息。查询变换通过"重塑查询"来解决这个问题：让查询更好地匹配相关文档，或取回更全面的信息。直觉是：**问题出在查询与文档的措辞错位上，那就修查询，而不是修索引**。

## 核心组件

1. **查询改写**：把查询改得更具体、更详细；
2. **退后提示**：生成更宽泛的查询以取回背景信息；
3. **子查询分解**：把复杂查询拆成更简单的子查询。

## 方法细节

### 1. 查询改写（Query Rewriting）

- **目的**：让查询更具体、更详细，提高召回相关信息的概率；
- **实现**：用 LLM 加自定义提示词模板，把原始查询改写得更具体。

### 2. 退后提示（Step-back Prompting）

- **目的**：生成更宽泛、更一般化的查询，帮助取回背景信息；
- **实现**：用 LLM 加自定义提示词模板，从原始查询生成一个更一般的"退后"查询。

### 3. 子查询分解（Sub-query Decomposition）

- **目的**：把复杂查询拆成更简单的子查询，实现更全面的信息检索；
- **实现**：用 LLM 加自定义提示词模板，把原始查询分解为 2-4 个更简单的子查询。

## 实战代码

### 安装与环境

```bash
pip install -U langchain-core langchain-openai python-dotenv
```

```python
import os
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate

load_dotenv()
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
```

### 1 - 查询改写：重塑查询以提升检索

```python
re_write_llm = ChatOpenAI(temperature=0, model="gpt-4o", max_completion_tokens=4000)

# 查询改写提示词模板
query_rewrite_template = """You are an AI assistant tasked with reformulating user queries to improve retrieval in a RAG system. 
Given the original query, rewrite it to be more specific, detailed, and likely to retrieve relevant information.

Original query: {original_query}

Rewritten query:"""

query_rewrite_prompt = PromptTemplate(
    input_variables=["original_query"],
    template=query_rewrite_template
)

query_rewriter = query_rewrite_prompt | re_write_llm


def rewrite_query(original_query):
    """
    改写原始查询以提升检索效果。

    Args:
    original_query (str): 用户的原始查询

    Returns:
    str: 改写后的查询
    """
    response = query_rewriter.invoke(original_query)
    return response.content
```

在用例上演示：

```python
# 以气候变化数据集上的示例查询演示
original_query = "What are the impacts of climate change on the environment?"
rewritten_query = rewrite_query(original_query)
print("Original query:", original_query)
print("\nRewritten query:", rewritten_query)
```

改写会把查询扩展出温度变化、生物多样性等具体侧面，更贴近语料中的实际表述。

### 2 - 退后提示：生成更宽泛的查询以取回背景

```python
step_back_llm = ChatOpenAI(temperature=0, model="gpt-4o", max_completion_tokens=4000)

step_back_template = """You are an AI assistant tasked with generating broader, more general queries to improve context retrieval in a RAG system.
Given the original query, generate a step-back query that is more general and can help retrieve relevant background information.

Original query: {original_query}

Step-back query:"""

step_back_prompt = PromptTemplate(
    input_variables=["original_query"],
    template=step_back_template
)

step_back_chain = step_back_prompt | step_back_llm


def generate_step_back_query(original_query):
    """
    生成退后查询以取回更宽泛的上下文。

    Args:
    original_query (str): 用户的原始查询

    Returns:
    str: 退后后的查询
    """
    response = step_back_chain.invoke(original_query)
    return response.content
```

```python
original_query = "What are the impacts of climate change on the environment?"
step_back_query = generate_step_back_query(original_query)
print("Original query:", original_query)
print("\nStep-back query:", step_back_query)
# 例：退后为 "What are the general effects of climate change?"
```

### 3 - 子查询分解：把复杂问题拆成简单子问题

```python
sub_query_llm = ChatOpenAI(temperature=0, model="gpt-4o", max_completion_tokens=4000)

subquery_decomposition_template = """You are an AI assistant tasked with breaking down complex queries into simpler sub-queries for a RAG system.
Given the original query, decompose it into 2-4 simpler sub-queries that, when answered together, would provide a comprehensive response to the original query.

Original query: {original_query}

example: What are the impacts of climate change on the environment?

Sub-queries:
1. What are the impacts of climate change on biodiversity?
2. How does climate change affect the oceans?
3. What are the effects of climate change on agriculture?
4. What are the impacts of climate change on human health?"""

subquery_decomposition_prompt = PromptTemplate(
    input_variables=["original_query"],
    template=subquery_decomposition_template
)

subquery_decomposer_chain = subquery_decomposition_prompt | sub_query_llm


def decompose_query(original_query: str):
    """
    把原始查询分解为更简单的子查询。

    Args:
    original_query (str): 原始复杂查询

    Returns:
    List[str]: 子查询列表
    """
    response = subquery_decomposer_chain.invoke(original_query).content
    sub_queries = [q.strip() for q in response.split('\n') if q.strip() and not q.strip().startswith('Sub-queries:')]
    return sub_queries
```

```python
original_query = "What are the impacts of climate change on the environment?"
sub_queries = decompose_query(original_query)
print("\nSub-queries:")
for i, sub_query in enumerate(sub_queries, 1):
    print(sub_query)
# 分解为生物多样性、海洋、天气模式、陆地环境等子问题
```

## 这些方法的收益

1. **相关性更高**：查询改写帮助召回更具体、更相关的信息；
2. **上下文更好**：退后提示能取回更宽泛的背景信息；
3. **结果更全面**：子查询分解让复杂查询的各个侧面都被覆盖；
4. **灵活**：三种技术可独立使用，也可按场景组合。

## 实现要点

- 所有技术都用 LLM 完成查询变换，自定义提示词模板引导模型生成恰当的变换；
- 每种技术都是独立函数，易于接入现有 RAG 系统。

## 小结

查询变换为提升 RAG 检索能力提供了有力工具：改写、退后、分解，各有侧重，可以显著改善召回信息的相关性、上下文与全面性。在查询复杂或多面的领域——科学研究、法律分析、综合性事实调查——价值尤其突出。与《Agentic RAG：让检索自己判断"够不够、要不要换工具"》呼应：查询改写正是 Agent"自主决定如何检索"的基本动作之一。

---

> **来源**：本文翻译自 [Query Transformations for Improved Retrieval in RAG Systems](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/query_transformations.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 编者注（时效性校订）：原 notebook 的 `from langchain.prompts import PromptTemplate` 属旧 import 路径，已按当前稳定版改为 `langchain_core.prompts`；原文代码本身已是 LCEL 管道（`prompt | llm`），逻辑未改。
