---
title: Embedding 模型选型实战（中文优先）
source_url: https://github.com/FlagOpen/FlagEmbedding
author: BAAI（BGE / FlagEmbedding）；MTEB 团队（embeddings-benchmark）；Qwen 团队（Qwen3-Embedding）
license: MIT（FlagEmbedding）；Apache-2.0（mteb）；Apache-2.0（Qwen3-Embedding）
fetched_at: 2026-09-13
translated: true
order: 4
versions: FlagEmbedding master（2026-09）；mteb main（2026-09）；QwenLM/Qwen3-Embedding main（2026-09）
---
## BGE：面向搜索与 RAG 的一站式检索工具箱

以下内容翻译自 [FlagOpen/FlagEmbedding README](https://github.com/FlagOpen/FlagEmbedding)（MIT 许可）。

BGE（BAAI General Embedding，`bge` 即 `BAAI general embedding` 的缩写）聚焦检索增强的 LLM，当前由以下项目组成：

- **推理**：[Embedder（嵌入模型）](https://github.com/FlagOpen/FlagEmbedding/tree/master/examples/inference/embedder)、[Reranker（重排模型）](https://github.com/FlagOpen/FlagEmbedding/tree/master/examples/inference/reranker)
- **微调**：[Embedder](https://github.com/FlagOpen/FlagEmbedding/tree/master/examples/finetune/embedder)、[Reranker](https://github.com/FlagOpen/FlagEmbedding/tree/master/examples/finetune/reranker)
- **[评估](https://github.com/FlagOpen/FlagEmbedding/tree/master/examples/evaluation)**
- **[数据集](https://github.com/FlagOpen/FlagEmbedding/tree/master/dataset)**
- **[教程](https://github.com/FlagOpen/FlagEmbedding/tree/master/Tutorials)**
- **[研究项目](https://github.com/FlagOpen/FlagEmbedding/tree/master/research)**（BGE-M3、LLARA、Visualized-BGE 等）

### 里程碑（News 节选翻译）

- 2025-03-06：发布 **BGE-VL**（Hugging Face 仓库 MegaPairs 合集），支持任意视觉搜索应用（文生图检索、图文互检、图+提示词检索图等）的最先进多模态嵌入模型，MIT 许可，学术与商业完全免费。同时发布赋能 BGE-VL 的大规模合成数据集 **MegaPairs**（仓库与论文 arXiv:2412.14475）。
- 2024-12-05：建立 BGE 文档站（bge-model.com），集中收纳 BGE 信息与资料。
- 2024-10-22：发布统一图像生成模型 [OmniGen](https://github.com/VectorSpaceLab/OmniGen)，无需 ControlNet、IP-Adapter 或姿态/人脸检测等辅助模型即可完成复杂图像生成任务。
- 2024-09-10：发布 **MemoRAG**，基于记忆启发知识发现、迈向 RAG 2.0（仓库 qhjqhj00/MemoRAG，论文 arXiv:2409.05591）。
- 2024-07-26：发布 [bge-en-icl](https://huggingface.co/BAAI/bge-en-icl)——带上下文学习（ICL）能力的嵌入模型，通过提供任务相关的 query-response 少样本示例，编码语义更丰富的查询，进一步增强嵌入的语义表示能力。
- 2024-07-26：发布 [bge-multilingual-gemma2](https://huggingface.co/BAAI/bge-multilingual-gemma2)——基于 gemma-2-9b 的多语言嵌入模型，支持多语言与多样下游任务，在多语言基准（MIRACL、MTEB-fr、MTEB-pl）上取得新 SOTA。
- 2024-07-26：发布轻量重排器 [bge-reranker-v2.5-gemma2-lightweight](https://huggingface.co/BAAI/bge-reranker-v2.5-gemma2-lightweight)——基于 gemma-2-9b 的轻量重排器，支持 token 压缩与逐层轻量化操作，在节省大量资源的同时保持良好性能。
- 2024-05-21：与 Jina AI、Zilliz、HuggingFace 等伙伴发布基准 [AIR-Bench](https://github.com/AIR-Bench/AIR-Bench)，聚焦神经 IR 与 RAG 的公平分布外评估，按多领域多语言生成合成基准数据并定期更新。
- 2024-03-18：发布基于 M3 与 LLM（GEMMA、MiniCPM）骨干的新一代[重排器](https://github.com/FlagOpen/FlagEmbedding/tree/master/research/llm_reranker)，支持多语言与更长输入，在 BEIR、C-MTEB/Retrieval、MIRACL、LlamaIndex Evaluation 上排名大幅提升。
- 2024-01-30：发布 **BGE-M3**——BGE 系列新成员！M3 即 **M**ulti-linguality（100+ 语言）、**M**ulti-Granularity（输入最长 8192 token）、**M**ulti-Functionality（统一稠密检索、词法检索、多向量/ColBERT 检索）。它是第一个同时支持三种检索方式的嵌入模型，在多语言（MIRACL）与跨语言（MKQA）基准上取得新 SOTA（技术报告 arXiv:2402.03216）。
- 2023-09-12：新模型——发布比嵌入模型更强（但更贵）的 cross-encoder 重排器 `BAAI/bge-reranker-base` 与 `BAAI/bge-reranker-large`，推荐用它们（或微调后）对嵌入模型返回的 top-k 文档重排；发布缓解相似度分布问题、无指令时检索能力更强的 `bge-*-v1.5` 嵌入模型。
- 2023-08-02：发布 `bge-large-*`（BAAI General Embedding）模型，**在 MTEB 与 C-MTEB 榜单排名第一**。2023-08-01 发布中文海量文本嵌入基准 **C-MTEB**（31 个测试数据集）。

### 安装

不想微调模型时，可安装不带微调依赖的包：

```bash
pip install -U FlagEmbedding
```

要微调模型时，安装带微调依赖的包：

```bash
pip install -U FlagEmbedding[finetune]
```

从源码安装：

```bash
git clone https://github.com/FlagOpen/FlagEmbedding.git
cd FlagEmbedding
# 不需要微调用 pip install .
# 需要微调用 pip install .[finetune]
# 开发模式：pip install -e .（微调加 [finetune]）
```

### 快速上手

先加载一个 BGE 嵌入模型：

```python
from FlagEmbedding import FlagAutoModel

model = FlagAutoModel.from_finetuned('BAAI/bge-base-en-v1.5',
                                      query_instruction_for_retrieval="Represent this sentence for searching relevant passages:",
                                      use_fp16=True)
```

然后喂入一些句子，取回它们的嵌入：

```python
sentences_1 = ["I love NLP", "I love machine learning"]
sentences_2 = ["I love BGE", "I love text retrieval"]
embeddings_1 = model.encode(sentences_1)
embeddings_2 = model.encode(sentences_2)
```

拿到嵌入后，用内积计算相似度：

```python
similarity = embeddings_1 @ embeddings_2.T
print(similarity)
```

更多细节参见仓库的 embedder 推理、reranker 推理、embedder 微调、reranker 微调与评估示例；对相关概念不熟悉可查其 Tutorials 目录。

### 模型清单（Model List 节，中文相关行全部保留）

| 模型 | 语言 | 描述 | 检索用 query 指令 |
| --- | --- | --- | --- |
| [BAAI/bge-en-icl](https://huggingface.co/BAAI/bge-en-icl) | 英语 | 基于 LLM、带上下文学习能力的嵌入模型，可依少量示例充分发挥模型潜力 | 按任务自由提供指令与少样本示例 |
| [BAAI/bge-multilingual-gemma2](https://huggingface.co/BAAI/bge-multilingual-gemma2) | 多语言 | 基于 LLM 的多语言嵌入模型，训练覆盖多语言多任务 | 按任务提供指令 |
| [BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) | 多语言 | 多功能（稠密检索、稀疏检索、多向量 ColBERT）、多语言、多粒度（8192 token） | 无 |
| [BAAI/llm-embedder](https://huggingface.co/BAAI/llm-embedder) | 英语 | 统一嵌入模型，支持 LLM 多样化的检索增强需求 | 见其 README |
| [BAAI/bge-reranker-v2-m3](https://huggingface.co/BAAI/bge-reranker-v2-m3) | 多语言 | 轻量 cross-encoder，多语言能力强、易部署、推理快 | 无 |
| [BAAI/bge-reranker-v2-gemma](https://huggingface.co/BAAI/bge-reranker-v2-gemma) | 多语言 | 适合多语言场景的 cross-encoder，英语与多语言能力俱佳 | 无 |
| [BAAI/bge-reranker-v2-minicpm-layerwise](https://huggingface.co/BAAI/bge-reranker-v2-minicpm-layerwise) | 多语言 | 适合多语言场景的 cross-encoder，中英俱佳，可自由选择输出层以加速推理 | 无 |
| [BAAI/bge-reranker-v2.5-gemma2-lightweight](https://huggingface.co/BAAI/bge-reranker-v2.5-gemma2-lightweight) | 多语言 | 适合多语言场景的 cross-encoder，中英俱佳，可自由选择层、压缩比与压缩层，便于加速推理 | 无 |
| [BAAI/bge-reranker-large](https://huggingface.co/BAAI/bge-reranker-large) | 中英 | 更准确但效率较低的 cross-encoder | 无 |
| [BAAI/bge-reranker-base](https://huggingface.co/BAAI/bge-reranker-base) | 中英 | 更准确但效率较低的 cross-encoder | 无 |
| [BAAI/bge-large-en-v1.5](https://huggingface.co/BAAI/bge-large-en-v1.5) | 英语 | v1.5，相似度分布更合理 | `Represent this sentence for searching relevant passages: ` |
| [BAAI/bge-base-en-v1.5](https://huggingface.co/BAAI/bge-base-en-v1.5) | 英语 | v1.5，相似度分布更合理 | `Represent this sentence for searching relevant passages: ` |
| [BAAI/bge-small-en-v1.5](https://huggingface.co/BAAI/bge-small-en-v1.5) | 英语 | v1.5，相似度分布更合理 | `Represent this sentence for searching relevant passages: ` |
| [BAAI/bge-large-zh-v1.5](https://huggingface.co/BAAI/bge-large-zh-v1.5) | 中文 | v1.5，相似度分布更合理 | `为这个句子生成表示以用于检索相关文章：` |
| [BAAI/bge-base-zh-v1.5](https://huggingface.co/BAAI/bge-base-zh-v1.5) | 中文 | v1.5，相似度分布更合理 | `为这个句子生成表示以用于检索相关文章：` |
| [BAAI/bge-small-zh-v1.5](https://huggingface.co/BAAI/bge-small-zh-v1.5) | 中文 | v1.5，相似度分布更合理 | `为这个句子生成表示以用于检索相关文章：` |
| [BAAI/bge-large-zh](https://huggingface.co/BAAI/bge-large-zh) | 中文 | 把文本映射为向量的嵌入模型 | `为这个句子生成表示以用于检索相关文章：` |
| [BAAI/bge-base-zh](https://huggingface.co/BAAI/bge-base-zh) | 中文 | base 规模但能力接近 `bge-large-zh` | `为这个句子生成表示以用于检索相关文章：` |
| [BAAI/bge-small-zh](https://huggingface.co/BAAI/bge-small-zh) | 中文 | small 规模但有竞争力的性能 | `为这个句子生成表示以用于检索相关文章：` |

## MTEB：嵌入与检索系统的多模态评测工具箱

以下内容翻译自 [embeddings-benchmark/mteb README](https://github.com/embeddings-benchmark/mteb)（Apache-2.0 许可）。

MTEB（Massive Text Embedding Benchmark）是评测嵌入与检索系统的多模态工具箱，交互式[排行榜](https://huggingface.co/spaces/mteb/leaderboard)托管在 Hugging Face Spaces。

### 安装

用 pip 或 uv 安装即可：

```bash
pip install mteb
```

更快安装可用 [uv](https://docs.astral.sh/uv/)：

```bash
uv add mteb
```

### 用法示例

下面是一个简单的用例。更多信息见 MTEB 文档。

```python
import mteb
from sentence_transformers import SentenceTransformer

# Select model
model_name = "sentence-transformers/all-MiniLM-L6-v2"
model = mteb.get_model(
    model_name
)  # if the model is not implemented in MTEB it will be eq. to SentenceTransformer(model_name)

# Select tasks
tasks = mteb.get_tasks(tasks=["Banking77Classification.v2"])

# evaluate
results = mteb.evaluate(model, tasks=tasks)
```

也可以用 CLI 运行：

```bash
mteb run \
    -m sentence-transformers/all-MiniLM-L6-v2 \
    -t "Banking77Classification.v2" \
    --output-folder results
```

CLI 的更多用法见其文档"usage/cli"。

### 文档总览（Overview 节）

| 总览 | 内容 |
| --- | --- |
| 📈 Leaderboard | 基准的交互式排行榜 |
| 🏃 Get Started | mteb 使用总览 |
| 🤖 Defining Models | 如何使用现有模型及定义自定义模型 |
| 📋 Selecting tasks | 如何选择任务、基准、数据切分等 |
| 🏭 Running Evaluation | 如何运行评估，含缓存管理、加速评估等 |
| 📊 Loading Results | 如何加载与使用已有模型结果 |
| 📋 Tasks | 可用任务总览 |
| 📐 Benchmarks | 可用基准总览 |
| 🤖 Models | 可用模型总览 |
| 🤖 Adding a model | 如何把模型提交到 MTEB 与排行榜 |
| 👩‍💻 Adding a dataset | 如何向 MTEB 添加新任务/数据集 |
| 👩‍💻 Adding a benchmark | 如何添加新基准并上排行榜 |
| 🤝 Contributing | 如何为 MTEB 做贡献并搭建开发环境 |

### 引用

MTEB 由论文《MTEB: Massive Text Embedding Benchmark》（arXiv:2210.07316）提出，并在《MMTEB: Massive Multilingual Text Embedding Benchmark》（arXiv:2502.13595）中大幅扩展。使用 `mteb` 时建议同时引用两文（Bibtex 条目见原 README）。若使用具体基准，也建议引用该基准及其任务的作者：

```python
benchmark = mteb.get_benchmark("MTEB(eng, v2)")
benchmark.citation  # 获取特定基准的引用信息

# 还可以用下面这行为附录生成任务表格：
benchmark.tasks.to_latex()
```

## Qwen3-Embedding：文本嵌入与排序模型系列

以下内容翻译自 [QwenLM/Qwen3-Embedding README](https://github.com/QwenLM/Qwen3-Embedding)（Apache-2.0 许可）。

Qwen3 Embedding 系列是 Qwen 家族最新的专有模型，专为文本嵌入与排序任务设计。它基于 Qwen3 系列稠密基础模型构建，提供多种尺寸（0.6B、4B、8B）的文本嵌入与重排模型。该系列继承了基础模型卓越的多语言能力、长文本理解与推理能力，在文本检索、代码检索、文本分类、文本聚类、双语文本挖掘等多个嵌入与排序任务上取得显著进展。

- **卓越的通用性**：嵌入模型在广泛的下游应用评测中达到最先进水平。8B 嵌入模型在 MTEB 多语言排行榜**排名第一**（截至 2025-06-05，得分 70.58），重排模型在各种文本检索场景中表现出色。
- **全面的灵活性**：Qwen3 Embedding 系列为嵌入与重排模型提供全尺寸谱系（0.6B 到 8B），兼顾效率与效果诉求。开发者可以无缝组合这两个模块。嵌入模型还支持在所有维度上灵活定义向量，嵌入与重排模型都支持用户自定义指令，以增强特定任务、语言或场景的表现。
- **多语言能力**：得益于 Qwen3 模型的多语言能力，该系列支持 100+ 语言，含多种编程语言，提供强健的多语言、跨语言与代码检索能力。

### 模型清单

| 模型类型 | 模型 | 尺寸 | 层数 | 序列长度 | 嵌入维度 | MRL 支持 | 指令感知 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 文本嵌入 | [Qwen3-Embedding-0.6B](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B) | 0.6B | 28 | 32K | 1024 | 是 | 是 |
| 文本嵌入 | [Qwen3-Embedding-4B](https://huggingface.co/Qwen/Qwen3-Embedding-4B) | 4B | 36 | 32K | 2560 | 是 | 是 |
| 文本嵌入 | [Qwen3-Embedding-8B](https://huggingface.co/Qwen/Qwen3-Embedding-8B) | 8B | 36 | 32K | 4096 | 是 | 是 |
| 文本重排 | [Qwen3-Reranker-0.6B](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B) | 0.6B | 28 | 32K | - | - | 是 |
| 文本重排 | [Qwen3-Reranker-4B](https://huggingface.co/Qwen/Qwen3-Reranker-4B) | 4B | 36 | 32K | - | - | 是 |
| 文本重排 | [Qwen3-Reranker-8B](https://huggingface.co/Qwen/Qwen3-Reranker-8B) | 8B | 36 | 32K | - | - | 是 |

> **注意**：
> - `MRL（Matryoshka Representation Learning）支持`表示嵌入模型是否支持自定义最终嵌入的维度。
> - `指令感知`表示嵌入或重排模型是否支持按不同任务自定义输入指令。
> - 评估表明，多数下游任务使用指令（instruct）通常比不用提升 1%–5%。因此建议开发者针对自己的任务与场景撰写定制指令；多语言场景下建议用英文写指令，因为模型训练时使用的指令大多以英文撰写。

### 多语言支持

Qwen3-Embedding 系列与 Qwen3 基础模型共享多语言支持能力（覆盖印欧、汉藏、亚非、南岛、达罗毗荼、突厥、壮侗、乌拉尔、南亚语系及其他语系共 100+ 语言，完整语言清单见原 README 折叠表；中文含简体、繁体与粤语）。

### 用法：嵌入模型

Transformers 版本低于 4.51.0 时可能遇到 `KeyError: 'qwen3'` 错误。

Transformers 用法：

```python
# Requires transformers>=4.51.0

import torch
import torch.nn.functional as F

from torch import Tensor
from transformers import AutoTokenizer, AutoModel


def last_token_pool(last_hidden_states: Tensor,
                 attention_mask: Tensor) -> Tensor:
    left_padding = (attention_mask[:, -1].sum() == attention_mask.shape[0])
    if left_padding:
        return last_hidden_states[:, -1]
    else:
        sequence_lengths = attention_mask.sum(dim=1) - 1
        batch_size = last_hidden_states.shape[0]
        return last_hidden_states[torch.arange(batch_size, device=last_hidden_states.device), sequence_lengths]


def get_detailed_instruct(task_description: str, query: str) -> str:
    return f'Instruct: {task_description}\nQuery:{query}'

# Each query must come with a one-sentence instruction that describes the task
task = 'Given a web search query, retrieve relevant passages that answer the query'

queries = [
    get_detailed_instruct(task, 'What is the capital of China?'),
    get_detailed_instruct(task, 'Explain gravity')
]
# No need to add instruction for retrieval documents
documents = [
    "The capital of China is Beijing.",
    "Gravity is a force that attracts two bodies towards each other. It gives weight to physical objects and is responsible for the movement of planets around the sun."
]
input_texts = queries + documents

tokenizer = AutoTokenizer.from_pretrained('Qwen/Qwen3-Embedding-0.6B', padding_side='left')
model = AutoModel.from_pretrained('Qwen/Qwen3-Embedding-0.6B')

# We recommend enabling flash_attention_2 for better acceleration and memory saving.
# model = AutoModel.from_pretrained('Qwen/Qwen3-Embedding-0.6B', attn_implementation="flash_attention_2", torch_dtype=torch.float16).cuda()

max_length = 8192

# Tokenize the input texts
batch_dict = tokenizer(
    input_texts,
    padding=True,
    truncation=True,
    max_length=max_length,
    return_tensors="pt",
)
batch_dict.to(model.device)
with torch.no_grad():
    outputs = model(**batch_dict)
    embeddings = last_token_pool(outputs.last_hidden_state, batch_dict['attention_mask'])

    # normalize embeddings
    embeddings = F.normalize(embeddings, p=2, dim=1)
    scores = (embeddings[:2] @ embeddings[2:].T)

print(scores.tolist())
# [[0.7645568251609802, 0.14142508804798126], [0.13549736142158508, 0.5999549627304077]]
```

vLLM 用法：

```python
# Requires vllm>=0.8.5
import torch
import vllm
from vllm import LLM

def get_detailed_instruct(task_description: str, query: str) -> str:
    return f'Instruct: {task_description}\nQuery:{query}'

# Each query must come with a one-sentence instruction that describes the task
task = 'Given a web search query, retrieve relevant passages that answer the query'

queries = [
    get_detailed_instruct(task, 'What is the capital of China?'),
    get_detailed_instruct(task, 'Explain gravity')
]
# No need to add instruction for retrieval documents
documents = [
    "The capital of China is Beijing.",
    "Gravity is a force that attracts two bodies towards each other. It gives weight to physical objects and is responsible for the movement of planets around the sun."
]
input_texts = queries + documents

model = LLM(model="Qwen/Qwen3-Embedding-0.6B", task="embed")

outputs = model.embed(input_texts)
embeddings = torch.tensor([o.outputs.embedding for o in outputs])
scores = (embeddings[:2] @ embeddings[2:].T)
print(scores.tolist())
# [[0.7620252966880798, 0.14078938961029053], [0.1358368694782257, 0.6013815999031067]]
```

Sentence Transformers 用法：

```python
# Requires transformers>=4.51.0
# Requires sentence-transformers>=2.7.0

from sentence_transformers import SentenceTransformer

# Load the model
model = SentenceTransformer("Qwen/Qwen3-Embedding-0.6B")

# We recommend enabling flash_attention_2 for better acceleration and memory saving,
# together with setting `padding_side` to "left":
# model = SentenceTransformer(
#     "Qwen/Qwen3-Embedding-0.6B",
#     model_kwargs={"attn_implementation": "flash_attention_2", "device_map": "auto"},
#     tokenizer_kwargs={"padding_side": "left"},
# )

# The queries and documents to embed
queries = [
    "What is the capital of China?",
    "Explain gravity",
]
documents = [
    "The capital of China is Beijing.",
    "Gravity is a force that attracts two bodies towards each other. It gives weight to physical objects and is responsible for the movement of planets around the sun.",
]

with torch.no_grad():
    # Encode the queries and documents. Note that queries benefit from using a prompt
    # Here we use the prompt called "query" stored under `model.prompts`, but you can
    # also pass your own prompt via the `prompt` argument
    query_embeddings = model.encode(queries, prompt_name="query")
    document_embeddings = model.encode(documents)

    # Compute the (cosine) similarity between the query and document embeddings
    similarity = model.similarity(query_embeddings, document_embeddings)

print(similarity)
# tensor([[0.7646, 0.1414], [0.1355, 0.6000]])
```

### 用法：重排模型（节选）

Qwen3-Reranker 以因果 LM 的方式对"指令 + 查询 + 文档"打分，输出 yes/no 的对数几率作为相关性分数（完整 Transformers 与 vLLM 代码见原 README"Reranker Model"一节）。核心机制：

- 用 `format_instruction(instruction, query, doc)` 拼出 `<Instruct>: ...\n<Query>: ...\n<Document>: ...`；
- 在输入前后包上固定的系统提示与助手前缀（要求模型只回答 "yes" 或 "no"）；
- 对最后一个 token 的 logits 取 `yes`/`no` 两个 token 的分数做 log_softmax，`exp` 后即为相关性得分。

---

> **来源**：本文由三个 GitHub 仓库 README 的完整翻译整合而成，各节逐节署名——"BGE"节翻译自 [FlagOpen/FlagEmbedding README](https://github.com/FlagOpen/FlagEmbedding)（MIT），"MTEB"节翻译自 [embeddings-benchmark/mteb README](https://github.com/embeddings-benchmark/mteb)（Apache-2.0），"Qwen3-Embedding"节翻译自 [QwenLM/Qwen3-Embedding README](https://github.com/QwenLM/Qwen3-Embedding)（Apache-2.0）。抓取于 2026-09-13。
> 收录范围说明：BGE 节的 News 为节选翻译（中文/多语言检索相关条目全收）；MTEB 节省略 Bibtex 长作者列表（已注明出处）；Qwen3 节的 Reranker 代码为机制节选，完整代码见原 README。徽章、二维码等纯装饰元素未收录。
