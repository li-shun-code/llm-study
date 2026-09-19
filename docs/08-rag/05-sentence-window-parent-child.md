---
title: 句子窗口与父子块检索（small-to-big）
source_url: https://github.com/run-llama/llama_index/blob/main/docs/examples/node_postprocessor/MetadataReplacementDemo.ipynb
author: LlamaIndex 团队（run-llama/llama_index 官方示例）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: run-llama/llama_index main 分支（2026-09-13 抓取）
order: 5
group: 摄取层：解析、分块与嵌入
---
两个同属"small-to-big"思想的官方示例 notebook 完整翻译：句子窗口检索（用小粒度做检索、把周边窗口送给 LLM）与自动合并检索（父子层级块，命中多个子块时上卷合并到父块）。

## 其一：元数据替换 + 节点句子窗口

以下为官方示例 [MetadataReplacementDemo.ipynb](https://github.com/run-llama/llama_index/blob/main/docs/examples/node_postprocessor/MetadataReplacementDemo.ipynb) 的完整翻译。

本 notebook 用 `SentenceWindowNodeParser` 把文档解析成"每节点一个句子"。每个节点还带一个"窗口"，包含该节点句子两侧的句子。

随后，在检索之后、把检索到的句子传给 LLM 之前，用 `MetadataReplacementNodePostProcessor` 把单句替换为包含周边句子的窗口。

这对大型文档/索引最有用，因为它有助于检索更细粒度的细节。

默认情况下，句子窗口是原句子两侧各 5 个句子。

本例不使用 chunk size 设置，而是遵循窗口设置。

```python
%pip install llama-index-embeddings-openai
%pip install llama-index-embeddings-huggingface
%pip install llama-index-llms-openai
```

```python
%load_ext autoreload
%autoreload 2
```

### 设置

如果你在 Colab 上打开本 notebook，可能需要安装 LlamaIndex 🦙。

```python
!pip install llama-index
```

```python
import os
import openai
```

```python
os.environ["OPENAI_API_KEY"] = "sk-..."
```

```python
from llama_index.llms.openai import OpenAI
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.core.node_parser import SentenceWindowNodeParser
from llama_index.core.node_parser import SentenceSplitter

# create the sentence window node parser w/ default settings
node_parser = SentenceWindowNodeParser.from_defaults(
    window_size=3,
    window_metadata_key="window",
    original_text_metadata_key="original_text",
)

# base node parser is a sentence splitter
text_splitter = SentenceSplitter()

llm = OpenAI(model="gpt-3.5-turbo", temperature=0.1)
embed_model = HuggingFaceEmbedding(
    model_name="sentence-transformers/all-mpnet-base-v2", max_length=512
)

from llama_index.core import Settings

Settings.llm = llm
Settings.embed_model = embed_model
Settings.text_splitter = text_splitter
```

## 加载数据，构建索引

本节加载数据并构建向量索引。

### 加载数据

这里我们用最新 IPCC 气候报告的第 3 章构建索引。

```python
!curl https://www.ipcc.ch/report/ar6/wg2/downloads/report/IPCC_AR6_WGII_Chapter03.pdf --output IPCC_AR6_WGII_Chapter03.pdf
```

```python
from llama_index.core import SimpleDirectoryReader

documents = SimpleDirectoryReader(
    input_files=["./IPCC_AR6_WGII_Chapter03.pdf"]
).load_data()
```

### 抽取节点

我们抽出将要存入 VectorIndex 的节点集合。这既包括用句子窗口解析器得到的节点，也包括用标准解析器抽取的"基础"节点。

```python
nodes = node_parser.get_nodes_from_documents(documents)
```

```python
base_nodes = text_splitter.get_nodes_from_documents(documents)
```

### 构建索引

我们同时构建句子索引与"基础"索引（默认 chunk size）。

```python
from llama_index.core import VectorStoreIndex

sentence_index = VectorStoreIndex(nodes)
```

```python
base_index = VectorStoreIndex(base_nodes)
```

## 查询

### 使用 MetadataReplacementPostProcessor

现在用 `MetadataReplacementPostProcessor` 把每个节点中的句子替换为其周边上下文。

```python
from llama_index.core.postprocessor import MetadataReplacementPostProcessor

query_engine = sentence_index.as_query_engine(
    similarity_top_k=2,
    # the target key defaults to `window` to match the node_parser's default
    node_postprocessors=[
        MetadataReplacementPostProcessor(target_metadata_key="window")
    ],
)
window_response = query_engine.query(
    "What are the concerns surrounding the AMOC?"
)
print(window_response)
```

我们还可以查看每个节点被检索到的原始句子，以及实际送给 LLM 的句子窗口。

```python
window = window_response.source_nodes[0].node.metadata["window"]
sentence = window_response.source_nodes[0].node.metadata["original_text"]

print(f"Window: {window}")
print("------------------")
print(f"Original Sentence: {sentence}")
```

### 与普通 VectorStoreIndex 对比

```python
query_engine = base_index.as_query_engine(similarity_top_k=2)
vector_response = query_engine.query(
    "What are the concerns surrounding the AMOC?"
)
print(vector_response)
```

好吧，效果不行。把 top k 调大试试！与句子窗口索引相比，这会更慢、消耗更多 token。

```python
query_engine = base_index.as_query_engine(similarity_top_k=5)
vector_response = query_engine.query(
    "What are the concerns surrounding the AMOC?"
)
print(vector_response)
```

## 分析

`SentenceWindowNodeParser` + `MetadataReplacementNodePostProcessor` 的组合显然是赢家。为什么？

句子级别的嵌入似乎能捕捉更细粒度的细节，比如 `AMOC` 这个词。

我们还可以比较每个索引检索到的块！

```python
for source_node in window_response.source_nodes:
    print(source_node.node.metadata["original_text"])
    print("--------")
```

可以看到，句子窗口索引轻松检索到了两个讨论 AMOC 的节点。注意：嵌入完全基于原始句子，但 LLM 最终读到的还包括周边上下文！

现在来剖析朴素向量索引为什么失败。

```python
for node in vector_response.source_nodes:
    print("AMOC mentioned?", "AMOC" in node.node.text)
    print("--------")
```

索引 [2] 的源节点提到了 AMOC，那这段文本到底长什么样？

```python
print(vector_response.source_nodes[2].node.text)
```

AMOC 确实被讨论了，但遗憾地位于中间块。对 LLM 而言，检索上下文中间的文本经常被忽略或作用有限。最近的论文["Lost in the Middle"](https://arxiv.org/abs/2307.03172)讨论了这一现象。

## [可选] 评估

我们更严格地评估句子窗口检索器与基础检索器相比的效果。

我们定义/加载一个评估基准数据集，然后在其上运行不同的评估。

**警告**：这可能很**昂贵**，用 GPT-4 时尤其如此。请谨慎行事，并把样本量调到符合你的预算。

```python
from llama_index.core.evaluation import DatasetGenerator, QueryResponseDataset

from llama_index.llms.openai import OpenAI
import nest_asyncio
import random

nest_asyncio.apply()
```

```python
len(base_nodes)
```

```python
num_nodes_eval = 30
# there are 428 nodes total. Take the first 200 to generate questions (the back half of the doc is all references)
sample_eval_nodes = random.sample(base_nodes[:200], num_nodes_eval)
# NOTE: run this if the dataset isn't already saved
# generate questions from the largest chunks (1024)
dataset_generator = DatasetGenerator(
    sample_eval_nodes,
    llm=OpenAI(model="gpt-4"),
    show_progress=True,
    num_questions_per_chunk=2,
)
```

```python
eval_dataset = await dataset_generator.agenerate_dataset_from_nodes()
```

```python
eval_dataset.save_json("data/ipcc_eval_qr_dataset.json")
```

```python
# optional
eval_dataset = QueryResponseDataset.from_json("data/ipcc_eval_qr_dataset.json")
```

### 比较结果

```python
import asyncio
import nest_asyncio

nest_asyncio.apply()
```

```python
from llama_index.core.evaluation import (
    CorrectnessEvaluator,
    SemanticSimilarityEvaluator,
    RelevancyEvaluator,
    FaithfulnessEvaluator,
    PairwiseComparisonEvaluator,
)


from collections import defaultdict
import pandas as pd

# NOTE: can uncomment other evaluators
evaluator_c = CorrectnessEvaluator(llm=OpenAI(model="gpt-4"))
evaluator_s = SemanticSimilarityEvaluator()
evaluator_r = RelevancyEvaluator(llm=OpenAI(model="gpt-4"))
evaluator_f = FaithfulnessEvaluator(llm=OpenAI(model="gpt-4"))
# pairwise_evaluator = PairwiseComparisonEvaluator(llm=OpenAI(model="gpt-4"))
```

```python
from llama_index.core.evaluation.eval_utils import (
    get_responses,
    get_results_df,
)
from llama_index.core.evaluation import BatchEvalRunner

max_samples = 30

eval_qs = eval_dataset.questions
ref_response_strs = [r for (_, r) in eval_dataset.qr_pairs]

# resetup base query engine and sentence window query engine
# base query engine
base_query_engine = base_index.as_query_engine(similarity_top_k=2)
# sentence window query engine
query_engine = sentence_index.as_query_engine(
    similarity_top_k=2,
    # the target key defaults to `window` to match the node_parser's default
    node_postprocessors=[
        MetadataReplacementPostProcessor(target_metadata_key="window")
    ],
)
```

```python
import numpy as np

base_pred_responses = get_responses(
    eval_qs[:max_samples], base_query_engine, show_progress=True
)
pred_responses = get_responses(
    eval_qs[:max_samples], query_engine, show_progress=True
)

pred_response_strs = [str(p) for p in pred_responses]
base_pred_response_strs = [str(p) for p in base_pred_responses]
```

```python
evaluator_dict = {
    "correctness": evaluator_c,
    "faithfulness": evaluator_f,
    "relevancy": evaluator_r,
    "semantic_similarity": evaluator_s,
}
batch_runner = BatchEvalRunner(evaluator_dict, workers=2, show_progress=True)
```

对忠实度/语义相似度运行评估。

```python
eval_results = await batch_runner.aevaluate_responses(
    queries=eval_qs[:max_samples],
    responses=pred_responses[:max_samples],
    reference=ref_response_strs[:max_samples],
)
```

```python
base_eval_results = await batch_runner.aevaluate_responses(
    queries=eval_qs[:max_samples],
    responses=base_pred_responses[:max_samples],
    reference=ref_response_strs[:max_samples],
)
```

```python
results_df = get_results_df(
    [eval_results, base_eval_results],
    ["Sentence Window Retriever", "Base Retriever"],
    ["correctness", "relevancy", "faithfulness", "semantic_similarity"],
)
display(results_df)
```

## 其二：AutoMergingRetriever（自动合并检索器）

以下为官方示例 [auto_merging_retriever.ipynb](https://github.com/run-llama/llama_index/blob/main/docs/examples/retrievers/auto_merging_retriever.ipynb) 的完整翻译。

本 notebook 展示 `AutoMergingRetriever`：它查看一组叶子节点，并递归地把"引用同一父节点且超过给定阈值的叶子节点子集"合并起来。这让我们得以把可能零散的较小上下文整合成一个更大的、可能有助于综合（synthesis）的上下文。

你可以在一组文档上自行定义这个层级，也可以使用我们全新的文本解析器：`HierarchicalNodeParser`，它接受一组候选文档，输出自粗到细的完整节点层级。

```python
%pip install llama-index-llms-openai
%pip install llama-index-readers-file pymupdf
```

```python
%load_ext autoreload
%autoreload 2
```

如果你在 Colab 上打开本 notebook，可能需要安装 LlamaIndex 🦙。

```python
!pip install llama-index
```

## 加载数据

先加载 Llama 2 论文：https://arxiv.org/pdf/2307.09288.pdf 。这是我们的测试数据。

```python
!mkdir -p 'data/'
!wget --user-agent "Mozilla" "https://arxiv.org/pdf/2307.09288.pdf" -O "data/llama2.pdf"
```

```python
from pathlib import Path

from llama_index.readers.file import PDFReader
from llama_index.readers.file import PyMuPDFReader
```

```python
loader = PyMuPDFReader()
# docs0 = loader.load_data(file=Path("./data/llama2.pdf"))
docs0 = loader.load(file_path=Path("./data/llama2.pdf"))
```

默认情况下，PDF 阅读器为每一页创建一个单独的 doc。为了本 notebook 的演示，我们把各 doc 拼接成一个 doc。这有助于更好地展示稍后把块"缝合"在一起的自动合并能力。

```python
from llama_index.core import Document

doc_text = "\n\n".join([d.get_content() for d in docs0])
docs = [Document(text=doc_text)]
```

## 从文本解析块层级，载入存储

本节使用 `HierarchicalNodeParser`。它输出一个节点层级：从更大 chunk size 的顶层节点，到更小 chunk size 的子节点，每个子节点都有一个更大 chunk size 的父节点。

默认层级是：

- 第 1 级：chunk size 2048
- 第 2 级：chunk size 512
- 第 3 级：chunk size 128

然后把这些节点载入存储。叶子节点被索引进向量库并通过它检索——它们是首先被相似度搜索直接检索到的节点。其余节点从 docstore 取回。

```python
from llama_index.core.node_parser import (
    HierarchicalNodeParser,
    SentenceSplitter,
)
```

```python
node_parser = HierarchicalNodeParser.from_defaults()
```

```python
nodes = node_parser.get_nodes_from_documents(docs)
```

```python
len(nodes)
```

这里导入一个简单的辅助函数，用于从节点列表中取出"叶子"节点——它们没有自己的子节点。

```python
from llama_index.core.node_parser import get_leaf_nodes, get_root_nodes
```

```python
leaf_nodes = get_leaf_nodes(nodes)
```

```python
len(leaf_nodes)
```

```python
root_nodes = get_root_nodes(nodes)
```

### 载入存储

我们定义一个 docstore，把所有节点装载进去。然后定义一个只含叶子层节点的 `VectorStoreIndex`。

```python
# define storage context
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core import StorageContext
from llama_index.llms.openai import OpenAI

docstore = SimpleDocumentStore()

# insert nodes into docstore
docstore.add_documents(nodes)

# define storage context (will include vector store by default too)
storage_context = StorageContext.from_defaults(docstore=docstore)

llm = OpenAI(model="gpt-3.5-turbo")
```

```python
## Load index into vector index
from llama_index.core import VectorStoreIndex

base_index = VectorStoreIndex(
    leaf_nodes,
    storage_context=storage_context,
)
```

## 定义检索器

```python
from llama_index.core.retrievers import AutoMergingRetriever
```

```python
base_retriever = base_index.as_retriever(similarity_top_k=6)
retriever = AutoMergingRetriever(base_retriever, storage_context, verbose=True)
```

```python
# query_str = "What were some lessons learned from red-teaming?"
# query_str = "Can you tell me about the key concepts for safety finetuning"
query_str = (
    "What could be the potential outcomes of adjusting the amount of safety"
    " data used in the RLHF stage?"
)

nodes = retriever.retrieve(query_str)
base_nodes = base_retriever.retrieve(query_str)
```

```python
len(nodes)
```

```python
len(base_nodes)
```

```python
from llama_index.core.response.notebook_utils import display_source_node

for node in nodes:
    display_source_node(node, source_length=10000)
```

```python
for node in base_nodes:
    display_source_node(node, source_length=10000)
```

## 接入查询引擎

```python
from llama_index.core.query_engine import RetrieverQueryEngine
```

```python
query_engine = RetrieverQueryEngine.from_args(retriever)
base_query_engine = RetrieverQueryEngine.from_args(base_retriever)
```

```python
response = query_engine.query(query_str)
```

```python
print(str(response))
```

```python
base_response = base_query_engine.query(query_str)
```

```python
print(str(base_response))
```

## 评估

我们以更量化的方式评估层级检索器与基线检索器相比的效果。

**警告**：这可能很**昂贵**，用 GPT-4 时尤其如此。请谨慎行事，并把样本量调到符合你的预算。

```python
from llama_index.core.evaluation import DatasetGenerator, QueryResponseDataset
from llama_index.llms.openai import OpenAI
import nest_asyncio

nest_asyncio.apply()
```

```python
# NOTE: run this if the dataset isn't already saved
# Note: we only generate from the first 20 nodes, since the rest are references
eval_llm = OpenAI(model="gpt-4")
dataset_generator = DatasetGenerator(
    root_nodes[:20],
    llm=eval_llm,
    show_progress=True,
    num_questions_per_chunk=3,
)
```

```python
eval_dataset = await dataset_generator.agenerate_dataset_from_nodes(num=60)
```

```python
eval_dataset.save_json("data/llama2_eval_qr_dataset.json")
```

```python
# optional
eval_dataset = QueryResponseDataset.from_json(
    "data/llama2_eval_qr_dataset.json"
)
```

### 比较结果

我们在每个检索器上运行评估：correctness（正确性）、semantic similarity（语义相似度）、relevance（相关性）、faithfulness（忠实度）。

```python
import asyncio
import nest_asyncio

nest_asyncio.apply()
```

```python
from llama_index.core.evaluation import (
    CorrectnessEvaluator,
    SemanticSimilarityEvaluator,
    RelevancyEvaluator,
    FaithfulnessEvaluator,
    PairwiseComparisonEvaluator,
)


from collections import defaultdict
import pandas as pd

# NOTE: can uncomment other evaluators
evaluator_c = CorrectnessEvaluator(llm=eval_llm)
evaluator_s = SemanticSimilarityEvaluator(llm=eval_llm)
evaluator_r = RelevancyEvaluator(llm=eval_llm)
evaluator_f = FaithfulnessEvaluator(llm=eval_llm)
# pairwise_evaluator = PairwiseComparisonEvaluator(llm=eval_llm)
```

```python
from llama_index.core.evaluation.eval_utils import (
    get_responses,
    get_results_df,
)
from llama_index.core.evaluation import BatchEvalRunner
```

```python
eval_qs = eval_dataset.questions
qr_pairs = eval_dataset.qr_pairs
ref_response_strs = [r for (_, r) in qr_pairs]
```

```python
pred_responses = get_responses(eval_qs, query_engine, show_progress=True)
```

```python
base_pred_responses = get_responses(
    eval_qs, base_query_engine, show_progress=True
)
```

```python
import numpy as np

pred_response_strs = [str(p) for p in pred_responses]
base_pred_response_strs = [str(p) for p in base_pred_responses]
```

```python
evaluator_dict = {
    "correctness": evaluator_c,
    "faithfulness": evaluator_f,
    "relevancy": evaluator_r,
    "semantic_similarity": evaluator_s,
}
batch_runner = BatchEvalRunner(evaluator_dict, workers=2, show_progress=True)
```

```python
eval_results = await batch_runner.aevaluate_responses(
    eval_qs, responses=pred_responses, reference=ref_response_strs
)
```

```python
base_eval_results = await batch_runner.aevaluate_responses(
    eval_qs, responses=base_pred_responses, reference=ref_response_strs
)
```

```python
results_df = get_results_df(
    [eval_results, base_eval_results],
    ["Auto Merging Retriever", "Base Retriever"],
    ["correctness", "relevancy", "faithfulness", "semantic_similarity"],
)
display(results_df)
```

**分析**：结果大致相同。

我们再用成对评估（pairwise evals）看看 GPT-4 更偏好哪个答案。

```python
batch_runner = BatchEvalRunner(
    {"pairwise": pairwise_evaluator}, workers=10, show_progress=True
)
```

```python
pairwise_eval_results = await batch_runner.aevaluate_response_strs(
    eval_qs,
    response_strs=pred_response_strs,
    reference=base_pred_response_strs,
)
pairwise_score = np.array(
    [r.score for r in pairwise_eval_results["pairwise"]]
).mean()
```

```python
pairwise_score
```

**分析**：成对比较得分衡量的是"候选答案（使用自动合并检索器）相比基线答案（使用基础检索器）被偏好的时间百分比"。这里我们看到两者大致持平。

---

> **来源**：本文翻译自 run-llama/llama_index 官方仓库（MIT）两个示例 notebook：[Metadata Replacement + Node Sentence Window](https://github.com/run-llama/llama_index/blob/main/docs/examples/node_postprocessor/MetadataReplacementDemo.ipynb) 与 [Auto Merging Retriever](https://github.com/run-llama/llama_index/blob/main/docs/examples/retrievers/auto_merging_retriever.ipynb)，作者 LlamaIndex 团队。抓取于 2026-09-13。
> 完整性说明：两个 notebook 的全部 markdown 与代码单元格均已收录；代码逐格保留，仅说明文字与代码内注释翻译为中文，代码逻辑未做任何改写（`display`/魔法命令按原样保留）。
> 选型背景：任务候选来源 NirDiamant/RAG_Techniques 的 sentence-window / auto-merging notebook 经核实在该仓库中并不存在（全仓库文件树已核对），故按"LlamaIndex 文档对应页"路径改用官方示例 notebook（同为 raw GitHub 来源、MIT 许可）。
