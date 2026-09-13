---
title: 多模态 RAG：图文混合文档的"图片打字幕"方案
source_url: https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_model_rag_with_captioning.ipynb
author: Nir Diamant（RAG_Techniques）
license: 自定义许可（非商业使用，需署名，详见仓库 LICENSE）
fetched_at: 2026-09-13
translated: true
order: 14
---

## 概述

本篇实现多模态 RAG 的一种代表性做法：从 PDF 中抽取文本与图片，用多模态模型为图片/表格生成文字摘要（打字幕），把"文本 + 图片摘要"统一嵌入后做检索与问答。

## 核心组件

- **PyMuPDF**：从 PDF 抽取文本与图片；
- **Gemini 模型**：为图片与表格生成摘要；
- **Cohere Embeddings**：为文档切分生成嵌入；
- **Chroma 向量库**：存储与检索文档向量；
- **LangChain**：编排检索与生成管线。

## 动机

高效地总结复杂文档，让多模态数据也能被轻松检索、并得到简洁的回答。很多关键信息恰恰藏在图表里——只索引文本的 RAG 天生"看不见"它们。

## 方法细节

- 用 PyMuPDF 从 PDF 抽取文本与图片；
- 用多模态模型对抽取出的图片与表格做摘要；
- 用 Cohere 生成嵌入，存入 Chroma；
- 检索器基于相似度取回与查询最相关的片段。

### 收益

- 简化复杂多模态文档的检索；
- 文本与图片都能进入统一的问答流程；
- 架构灵活，可扩展到更多文档类型。

## 实战代码

### 安装与环境

```bash
pip install -U langchain-core langchain-community langchain-text-splitters langchain-chroma langchain-cohere pillow pymupdf google-genai python-dotenv
```

```python
import fitz  # PyMuPDF
from PIL import Image
import io
import os
from dotenv import load_dotenv

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_cohere import ChatCohere, CohereEmbeddings

load_dotenv()
```

### 准备示例文档

下载《Attention Is All You Need》论文（含大量图表，是多模态 RAG 的经典试金石）：

```bash
wget https://arxiv.org/pdf/1706.03762
mv 1706.03762 attention_is_all_you_need.pdf
```

### 数据抽取

```python
text_data = []
img_data = []
```

```python
with fitz.open('attention_is_all_you_need.pdf') as pdf_file:
    # 创建图片保存目录
    if not os.path.exists("extracted_images"):
        os.makedirs("extracted_images")

    # 逐页处理
    for page_number in range(len(pdf_file)):
        page = pdf_file[page_number]

        # 取页面文本
        text = page.get_text().strip()
        text_data.append({"response": text, "name": page_number + 1})

        # 取页面图片
        images = page.get_images(full=True)
        for image_index, img in enumerate(images, start=0):
            xref = img[0]                      # 图片的 XREF
            base_image = pdf_file.extract_image(xref)
            image_bytes = base_image["image"]  # 图片字节
            image_ext = base_image["ext"]      # 扩展名

            image = Image.open(io.BytesIO(image_bytes))
            image.save(f"extracted_images/image_{page_number+1}_{image_index+1}.{image_ext}")
```

### 图片打字幕（Image Captioning）

> 编者注（时效性改写）：原 notebook 用旧版 `google.generativeai` SDK，以下按当前稳定版 `google-genai` SDK 改写：

```python
from google import genai

client = genai.Client()  # 从环境变量 GOOGLE_API_KEY / GEMINI_API_KEY 读取密钥

for img in os.listdir("extracted_images"):
    image = Image.open(f"extracted_images/{img}")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            image,
            "You are an assistant tasked with summarizing tables, images and text for retrieval. \
            These summaries will be embedded and used to retrieve the raw text or table elements \
            Give a concise summary of the table or text that is well optimized for retrieval. Table or text or image:"
        ],
    )
    img_data.append({"response": response.text, "name": img})
```

提示词的意图：生成的摘要将被嵌入并用于召回原始元素，因此摘要要"为检索而优化"。

### 向量库：文本与图片摘要一起嵌入

```python
# 嵌入模型
embedding_model = CohereEmbeddings(model="embed-english-v3.0")

# 组织成 Document
docs_list = [Document(page_content=t['response'], metadata={"name": t['name']}) for t in text_data]
img_list = [Document(page_content=m['response'], metadata={"name": m['name']}) for m in img_data]

# 切分
text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    chunk_size=400, chunk_overlap=50
)
doc_splits = text_splitter.split_documents(docs_list)
img_splits = text_splitter.split_documents(img_list)
```

```python
# 文本块与图片摘要块一起入库
vectorstore = Chroma.from_documents(
    documents=doc_splits + img_splits,
    collection_name="multi_model_rag",
    embedding=embedding_model,
)

retriever = vectorstore.as_retriever(
    search_type="similarity",
    search_kwargs={'k': 1},  # 取回数量
)
```

### 查询与生成

```python
query = "What is the BLEU score of the Transformer (base model)?"
docs = retriever.invoke(query)
```

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
llm = ChatCohere(model="command-r-plus", temperature=0)

# LCEL 管线
rag_chain = prompt | llm | StrOutputParser()

# 运行
generation = rag_chain.invoke({"documents": docs[0].page_content, "question": query})
print(generation)
```

BLEU 分数只出现在论文的表格（图片）里。正因为图片被 VLM 打了字幕、与文本一起进了向量库，"Transformer (base) 的 BLEU 分数"这类问题才能被检索到并正确回答——这就是本方案的价值所在。

## 小结

"图片打字幕"是多模态 RAG 中最容易落地的路线：把非文本元素转成文字描述，复用整条文本 RAG 管线。它的局限也来自这里——字幕丢失了图片的原始细节（图表的精确数值、布局），若要更精细的答案，可延伸学习同仓库的 [multi_model_rag_with_colpali](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_model_rag_with_colpali.ipynb)（用 ColPali 直接对页面图像做视觉检索）。

---

> **来源**：本文翻译自 [Multi-Model RAG with Captioning](https://github.com/NirDiamant/RAG_Techniques/blob/main/all_rag_techniques/multi_model_rag_with_captioning.ipynb)，作者 Nir Diamant（[RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)），许可自定义许可（非商业使用，需署名，详见仓库 LICENSE）。抓取于 2026-09-13。
> 编者注（时效性校订）：原 notebook 使用已弃用的 `google.generativeai` SDK 调用 Gemini，本文按当前稳定版 `google-genai` SDK 改写该段（其余 LangChain 部分：旧 import 路径 `langchain.text_splitter` 已改为 `langchain_text_splitters`）。
