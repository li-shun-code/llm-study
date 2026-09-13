---
title: 最小 RAG（Simple RAG）系统
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 8
versions: RAG_Techniques main 分支（2026-09-13 抓取）
---
**编者注**：本篇为 simple_rag.ipynb 的**完整**翻译——全部 markdown 说明与全部代码单元格逐格收录，代码保持原样（含原文的旧版包路径与对仓库 helper 模块的依赖），未做改写；因时效性需要的校订与本地运行说明，全部集中在文末明确标注的"编者注"小节。原 notebook 开头与结尾各有一个作者视频推广单元格与一个访问统计图片单元格，视频推广按原文收录（其跟踪跳转链接换为视频直链），统计图片无知识内容、未收录并在此注明。

## 🎬 看 notebook 讲解视频

原 notebook 此处嵌入作者视频 **RAG Explained: Why AI Gets Your Own Documents Wrong**（YouTube：[rRCfl4aRYJs](https://www.youtube.com/watch?v=rRCfl4aRYJs)），并附说明：以下每个单元格背后的直觉，7 分钟讲清——为什么文档要切成**带重叠**的块、"语义空间"到底是什么、按语义搜索如何找到与你的问题几乎不共享词汇的段落，以及朴素 RAG 从哪里开始失效。原视频链接在 notebook 中经作者的跳转统计服务包装。

## Simple RAG（Retrieval-Augmented Generation）System

### 概述

这段代码实现一个基础的检索增强生成（RAG）系统，用于处理 PDF 文档并支持对其提问。系统把文档内容编码进向量库（vector store），之后即可查询该向量库以检索相关信息。

### 关键组件

1. PDF 处理与文本抽取
2. 文本分块（chunking），便于后续处理
3. 用 [FAISS](https://engineering.fb.com/2017/03/29/data-infrastructure/faiss-a-library-for-efficient-similarity-search/) 与 OpenAI 嵌入创建向量库
4. 配置检索器（retriever）以查询处理过的文档
5. RAG 系统的评估

### 方法细节

**文档预处理**

1. 用 PyPDFLoader 加载 PDF；
2. 用 RecursiveCharacterTextSplitter 按指定的块大小与重叠把文本分块。

**文本清洗**

对文本块应用自定义函数 `replace_t_with_space` 进行清洗。这一步处理的应是该 PDF 特有的格式问题。

**向量库创建**

1. 用 OpenAI 嵌入为文本块创建向量表示；
2. 由这些嵌入创建 FAISS 向量库，实现高效相似度搜索。

**检索器配置**

1. 配置检索器为给定查询取回最相关的 2 个块。

**编码函数**

`encode_pdf` 函数把加载、分块、清洗、把 PDF 编码进向量库的整个过程封装起来。

### 关键特性

1. 模块化设计：编码过程封装在单个函数中，便于复用。
2. 可配置分块：允许调整块大小与重叠。
3. 高效检索：用 FAISS 做快速相似度搜索。
4. 评估：包含评估 RAG 系统性能的函数。

### 使用示例

代码包含一个测试查询："What is the main cause of climate change?"。它演示如何用检索器从处理过的文档中取回相关上下文。

### 评估

系统包含 `evaluate_rag` 函数来评估检索器的性能，但所给代码未详述具体指标。

### 这种方法的收益

1. 可扩展：通过分块处理大文档。
2. 灵活：易于调整块大小、取回数量等参数。
3. 高效：利用 FAISS 在高维空间做快速相似度搜索。
4. 对接先进 NLP：使用 OpenAI 嵌入获得最先进的文本表示。

### 结论

这个简单的 RAG 系统为构建更复杂的信息检索与问答系统打下坚实基础：把文档内容编码进可搜索的向量库，就能针对查询高效检索相关信息。这种方法对需要在大型文档或文档集合中快速定位特定信息的应用尤其有用。

## 安装包与导入

下面的单元格安装本 notebook 所需的全部包。

```python
# Install required packages
!pip install pypdf==5.6.0
!pip install PyMuPDF==1.26.1
!pip install python-dotenv==1.1.0
!pip install langchain-community==0.3.25
!pip install langchain_openai==0.3.23
!pip install rank_bm25==0.2.2
!pip install faiss-cpu==1.11.0
!pip install deepeval==3.1.0
```

```python
# Clone the repository to access helper functions and evaluation modules
!git clone https://github.com/NirDiamant/RAG_TECHNIQUES.git
import sys
sys.path.append('RAG_TECHNIQUES')

# If you need to run with the latest data
# !cp -r RAG_TECHNIQUES/data .
```

```python
import os
import sys
from dotenv import load_dotenv
from google.colab import userdata



# Load environment variables from a .env file
load_dotenv()

# Set the OpenAI API key environment variable (comment out if not using OpenAI)
if not userdata.get('OPENAI_API_KEY'):
    os.environ["OPENAI_API_KEY"] = input("Please enter your OpenAI API key: ")
else:
    os.environ["OPENAI_API_KEY"] = userdata.get('OPENAI_API_KEY')

# Original path append replaced for Colab compatibility

from langchain.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from helper_functions import (EmbeddingProvider,
                              retrieve_context_per_question,
                              replace_t_with_space,
                              get_langchain_embedding_provider,
                              show_context)

from evaluation.evalute_rag import evaluate_rag

from langchain.vectorstores import FAISS
```

### 读取文档

```python
# Download required data files
import os
os.makedirs('data', exist_ok=True)

# Download the PDF document used in this notebook
!wget -O data/Understanding_Climate_Change.pdf https://raw.githubusercontent.com/NirDiamant/RAG_TECHNIQUES/main/data/Understanding_Climate_Change.pdf
!wget -O data/Understanding_Climate_Change.pdf https://raw.githubusercontent.com/NirDiamant/RAG_TECHNIQUES/main/data/Understanding_Climate_Change.pdf
```

（编者注：上面连续两次 `wget` 在原 notebook 中即如此重复，按原样保留。）

```python
path = "data/Understanding_Climate_Change.pdf"
```

### 编码文档

```python
def encode_pdf(path, chunk_size=1000, chunk_overlap=200):
    """
    Encodes a PDF book into a vector store using OpenAI embeddings.

    Args:
        path: The path to the PDF file.
        chunk_size: The desired size of each text chunk.
        chunk_overlap: The amount of overlap between consecutive chunks.

    Returns:
        A FAISS vector store containing the encoded book content.
    """

    # Load PDF documents
    loader = PyPDFLoader(path)
    documents = loader.load()

    # Split documents into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size, chunk_overlap=chunk_overlap, length_function=len
    )
    texts = text_splitter.split_documents(documents)
    cleaned_texts = replace_t_with_space(texts)

    # Create embeddings (Tested with OpenAI and Amazon Bedrock)
    embeddings = get_langchain_embedding_provider(EmbeddingProvider.OPENAI)
    #embeddings = get_langchain_embedding_provider(EmbeddingProvider.AMAZON_BEDROCK)

    # Create vector store
    vectorstore = FAISS.from_documents(cleaned_texts, embeddings)

    return vectorstore
```

```python
chunks_vector_store = encode_pdf(path, chunk_size=1000, chunk_overlap=200)
```

### 创建检索器

```python
chunks_query_retriever = chunks_vector_store.as_retriever(search_kwargs={"k": 2})
```

### 测试检索器

```python
test_query = "What is the main cause of climate change?"
context = retrieve_context_per_question(test_query, chunks_query_retriever)
show_context(context)
```

### 评估结果

```python
#Note - this currently works with OPENAI only
evaluate_rag(chunks_query_retriever)
```

（原 notebook 此处另有一个空白代码单元格。）

---

### 🎬 代码没有展示的部分

原 notebook 此处有一段收尾推广：你刚刚运行了一个"从自己的文档里找答案"的检索器。7 分钟的讲解视频涵盖了它**为什么**有效：为什么块要**重叠**、"语义空间"究竟是什么，以及那种"从外部看完全健康、实则悄悄失效"的块边界问题。视频同一支：[RAG Explained: Why AI Gets Your Own Documents Wrong](https://www.youtube.com/watch?v=rRCfl4aRYJs)（原 notebook 中的链接经作者跳转统计服务包装）。

> 编者注（时效性校订与本地运行）：
>
> 1. **旧包路径**：原 notebook 的 import 使用 LangChain 旧版路径（`from langchain.document_loaders import PyPDFLoader`、`from langchain.text_splitter import RecursiveCharacterTextSplitter`、`from langchain.vectorstores import FAISS`）。按当前稳定版应分别改为 `from langchain_community.document_loaders import PyPDFLoader`、`from langchain_text_splitters import RecursiveCharacterTextSplitter`、`from langchain_community.vectorstores import FAISS`。
> 2. **helper 模块**：`helper_functions` 与 `evaluation.evalute_rag` 来自克隆的 RAG_TECHNIQUES 仓库（cell 4 已 clone 并加 path）。其中 `replace_t_with_space` 把文本中的制表符替换为空格；`show_context` 逐条打印检索到的上下文；`retrieve_context_per_question` 即调用检索器并取出各文档的 `page_content`；`get_langchain_embedding_provider(EmbeddingProvider.OPENAI)` 等价于 `from langchain_openai import OpenAIEmbeddings; OpenAIEmbeddings()`。若不想克隆仓库，可把这几个函数内联，效果一致。
> 3. **Colab 专用代码**：`from google.colab import userdata` 仅在 Colab 中可用；本地运行请直接依赖 `.env` 中的 `OPENAI_API_KEY`（`load_dotenv()` 已加载）。
> 4. **评估一步**：`evaluate_rag` 基于 DeepEval 且按原文注释仅支持 OpenAI；检索评估的系统方法见本模块《RAG 评估（RAGAS）》篇。

---

> **来源**：本文翻译自 [Simple RAG (Retrieval-Augmented Generation) System](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/simple_rag.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 完整性说明：原 notebook 全部 22 个单元格中，20 个知识单元格（9 个 markdown + 11 个代码，含 1 个空白代码单元格）全部收录；1 个视频推广 markdown 单元格按原文收录（跟踪跳转链接换为视频直链并注明）；1 个访问统计图片单元格无知识内容未收录，已在编者注中注明。代码单元格逐格原样保留，仅编者注小节给出当前版本的等价写法。
