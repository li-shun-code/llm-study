---
title: 多向量检索与 ColBERT/ColPali
source_url: https://github.com/stanford-futuredata/ColBERT
author: Stanford Future Data Systems（ColBERT）；Illuin Technology（ColPali）；Benjamin Clavié（Answer.AI）
license: MIT（ColBERT）；Apache-2.0（colpali）；署名转载（Answer.AI 博客）
fetched_at: 2026-09-13
translated: true
order: 15
versions: ColBERT main（2026-09）；illuin-tech/colpali main（2026-09）；Answer.AI 2024-08-13 原文
---
## ColBERT（v2）

以下内容翻译自 [stanford-futuredata/ColBERT README](https://github.com/stanford-futuredata/ColBERT)（MIT 许可）。

ColBERT 是一个**快速**且**准确**的检索模型，能在几十毫秒内对大型文本集合完成可扩展的、基于 BERT 的搜索。

如官方图 1（ColBERT-Framework-MaxSim 示意图）所示，ColBERT 依赖细粒度的**上下文化后期交互（contextual late interaction）**：它把每个段落编码成一个 token 级嵌入的**矩阵**（图中蓝色）；搜索时，把每个查询嵌入成另一个矩阵（图中绿色），并用可扩展的向量相似度算子（`MaxSim`）高效找出与查询上下文匹配的段落。

这些丰富的交互让 ColBERT 超越**单向量**表示模型的质量，同时能高效扩展到大型语料。

### 论文（原文列举）

- [ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT](https://arxiv.org/abs/2004.12832)（SIGIR'20）
- [Relevance-guided Supervision for OpenQA with ColBERT](https://arxiv.org/abs/2007.00814)（TACL'21）
- [Baleen: Robust Multi-Hop Reasoning at Scale via Condensed Retrieval](https://arxiv.org/abs/2101.00436)（NeurIPS'21）
- [ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488)（NAACL'22）
- [PLAID: An Efficient Engine for Late Interaction Retrieval](https://arxiv.org/abs/2205.09707)（CIKM'22）
- [Moving Beyond Downstream Task Accuracy for Information Retrieval Benchmarking](https://arxiv.org/abs/2212.01340)（ACL'23 Findings）
- [UDAPDR: Unsupervised Domain Adaptation via LLM Prompting and Distillation of Rerankers](https://arxiv.org/abs/2303.00807)（EMNLP'23）

### 公告（节选）

- （2024-01-28）如今在应用中使用 ColBERT 最简单的方式之一，是半官方且增长迅速的 [RAGatouille](https://github.com/bclavie/ragatouille) 库。
- （2023-01-29）我们合并了新的索引更新器（index updater）特性，并支持更多 Hugging Face 模型！这些处于 beta 阶段，试用后请反馈。
- （2023-01-24）如果你在找把 ColBERTv2 这类检索器与 LLM 组合起来的 **DSPy** 框架，它在：https://github.com/stanfordnlp/dspy

### ColBERTv1

SIGIR'20 论文的 ColBERTv1 代码在 [`colbertv1` 分支](https://github.com/stanford-futuredata/ColBERT/tree/colbertv1)。其他分支信息见后文 Branches 一节。

### 安装

（更新：如今通常 `pip install colbert-ai[torch,faiss-gpu]` 即可跑起来；但若遇到问题，conda 对 `faiss` 与 `torch` 总是更可靠。）

ColBERT 需要 Python 3.7+ 与 PyTorch 1.9+，使用 [Hugging Face Transformers](https://github.com/huggingface/transformers) 库。

强烈建议用以下命令创建 conda 环境（没有 conda 的话，先按官方 conda 安装指南安装）。仓库还附带一个专用于纯 CPU 环境的环境文件（`conda_env_cpu.yml`）；注意在带 GPU 的机器上测试 CPU 执行时，可能需要在命令中指定 `CUDA_VISIBLE_DEVICES=""`。训练与索引必须有 GPU。

```bash
conda env create -f conda_env[_cpu].yml
conda activate colbert
```

遇到问题请到仓库开 issue，我们会尽快帮忙。

### 总览

在数据集上使用 ColBERT 通常包括以下步骤。

**第 0 步：预处理你的集合。** 最简单的形式下，ColBERT 处理制表符分隔（TSV）文件：一个文件（如 `collection.tsv`）包含全部段落，另一个（如 `queries.tsv`)包含用于搜索该集合的一组查询。

**第 1 步：下载[预训练的 ColBERTv2 checkpoint](https://downloads.cs.stanford.edu/nlp/data/colbert/colbertv2/colbertv2.0.tar.gz)。** 该 checkpoint 在 MS MARCO Passage Ranking 任务上训练。也可以**可选地**[训练自己的 ColBERT 模型](#基础训练colbertv1-风格)。

**第 2 步：为集合建索引。** 有了训练好的 ColBERT 模型后，需要[为集合建索引](#检索retrieval)以支持快速检索。这一步把所有段落编码成矩阵、存盘，并构建高效搜索所需的数据结构。

**第 3 步：用查询搜索集合。** 有了模型和索引，就可以[对集合发起查询](#检索retrieval)，为每个查询取回 top-k 段落。

下面以 MS MARCO Passage Ranking 任务的一次示例运行来说明这些步骤。

### API 使用 notebook

**新**：有一个实验性 [Google Colab notebook](https://colab.research.google.com/github/stanford-futuredata/ColBERT/blob/main/docs/intro2new.ipynb)，可用免费 GPU。在免费的 Colab T4 GPU 上索引 10,000 条只需六分钟。

Jupyter notebook **[docs/intro.ipynb](https://github.com/stanford-futuredata/ColBERT/blob/main/docs/intro.ipynb)** 用新 Python API 演示 ColBERT 的关键特性，包括如何下载 MS MARCO Passage Ranking 训练的 ColBERTv2 checkpoint，以及如何下载新的 LoTTE 基准。

### 数据

本仓库直接使用简单的**制表符分隔文件**格式存储查询、段落与 top-k 排名列表。

- 查询：每行 `qid \t query text`。
- 集合：每行 `pid \t passage text`。
- Top-k 排名：每行 `qid \t pid \t rank`。

这直接兼容 [MS MARCO Passage Ranking](https://github.com/microsoft/MSMARCO-Passage-Ranking) 数据集的数据格式。你需要训练三元组（`triples.train.small.tar.gz`）、dev 集查询的官方 top-1000 排名列表（`top1000.dev`）、dev 集相关段落（`qrels.dev.small.tsv`）；要为完整集合建索引，还需要段落列表（`collection.tar.gz`）。

### 索引（Indexing）

为了快速检索，索引阶段预计算段落的 ColBERT 表示。示例用法：

```python
from colbert.infra import Run, RunConfig, ColBERTConfig
from colbert import Indexer

if __name__=='__main__':
    with Run().context(RunConfig(nranks=1, experiment="msmarco")):

        config = ColBERTConfig(
            nbits=2,
            root="/path/to/experiments",
        )
        indexer = Indexer(checkpoint="/path/to/checkpoint", config=config)
        indexer.index(name="msmarco.nbits=2", collection="/path/to/MSMARCO/collection.tsv")
```

### 检索（Retrieval）

我们通常建议把 ColBERT 用于**端到端**检索——直接从完整集合中找出它的 top-k 段落：

```python
from colbert.data import Queries
from colbert.infra import Run, RunConfig, ColBERTConfig
from colbert import Searcher

if __name__=='__main__':
    with Run().context(RunConfig(nranks=1, experiment="msmarco")):

        config = ColBERTConfig(
            root="/path/to/experiments",
        )
        searcher = Searcher(index="msmarco.nbits=2", config=config)
        queries = Queries("/path/to/MSMARCO/queries.dev.small.tsv")
        ranking = searcher.search_all(queries, k=100)
        ranking.save("msmarco.nbits=2.ranking.tsv")
```

可以可选地指定 `ncells`、`centroid_score_threshold`、`ndocs` 三个搜索超参数，在速度与结果质量之间权衡。不同 `k` 的默认值见 colbert/searcher.py。

用以下命令评估 MS MARCO 排名：

```bash
python -m utility.evaluate.msmarco_passages --ranking "/path/to/msmarco.nbits=2.ranking.tsv" --qrels "/path/to/MSMARCO/qrels.dev.small.tsv"
```

### 基础训练（ColBERTv1 风格）

我们提供[预训练模型 checkpoint](https://downloads.cs.stanford.edu/nlp/data/colbert/colbertv2/colbertv2.0.tar.gz)，但这里也详述如何从头训练。注意：本例演示的是 ColBERTv1 风格的训练，而提供的 checkpoint 是用 ColBERTv2 训练的。

训练需要 JSONL 三元组文件，每行一个 `[qid, pid+, pid-]` 列表。查询 ID 与段落 ID 分别对应指定的 `queries.tsv` 与 `collection.tsv` 文件。示例用法（4 GPU 训练）：

```python
from colbert.infra import Run, RunConfig, ColBERTConfig
from colbert import Trainer

if __name__=='__main__':
    with Run().context(RunConfig(nranks=4, experiment="msmarco")):

        config = ColBERTConfig(
            bsize=32,
            root="/path/to/experiments",
        )
        trainer = Trainer(
            triples="/path/to/MSMARCO/triples.train.small.tsv",
            queries="/path/to/MSMARCO/queries.train.small.tsv",
            collection="/path/to/MSMARCO/collection.tsv",
            config=config,
        )

        checkpoint_path = trainer.train()

        print(f"Saved checkpoint to {checkpoint_path}...")
```

### 高级训练（ColBERTv2 风格）

```python
from colbert.infra.run import Run
from colbert.infra.config import ColBERTConfig, RunConfig
from colbert import Trainer


def train():
    # use 4 gpus (e.g. four A100s, but you can use fewer by changing nway,accumsteps,bsize).
    with Run().context(RunConfig(nranks=4)):
        triples = '/path/to/examples.64.json'  # `wget https://huggingface.co/colbert-ir/colbertv2.0_msmarco_64way/resolve/main/examples.json?download=true` (26GB)
        queries = '/path/to/MSMARCO/queries.train.tsv'
        collection = '/path/to/MSMARCO/collection.tsv'

        config = ColBERTConfig(bsize=32, lr=1e-05, warmup=20_000, doc_maxlen=180, dim=128, attend_to_mask_tokens=False, nway=64, accumsteps=1, similarity='cosine', use_ib_negatives=True)
        trainer = Trainer(triples=triples, queries=queries, collection=collection, config=config)

        trainer.train(checkpoint='colbert-ir/colbertv1.9')  # or start from scratch, like `bert-base-uncased`


if __name__ == '__main__':
    train()
```

### 运行轻量 ColBERTv2 服务器

我们提供一个脚本，运行一个轻量服务器：对给定搜索查询按排名次序以 JSON 格式返回 k（至多 100）条结果。该脚本可为 DSP 程序供能。

运行服务器：把 `.env` 文件中的环境变量 `INDEX_ROOT` 与 `INDEX_NAME` 更新为指向相应的 ColBERT 索引，然后执行：

```bash
python server.py
```

示例查询：

```text
http://localhost:8893/api/search?query=Who won the 2022 FIFA world cup&k=25
```

### 分支

受支持的分支：[`main`](https://github.com/stanford-futuredata/ColBERT/tree/main)（稳定分支，ColBERTv2 + PLAID）、[`colbertv1`](https://github.com/stanford-futuredata/ColBERT/tree/colbertv1)（ColBERTv1 遗留分支）。已弃用的分支：`new_api`（ColBERTv2 基础实现）、`cpu_inference`（带 CPU 搜索支持的 ColBERTv2 实现）、`fast_search`（带 PLAID 的 ColBERTv2 实现）、`binarization`（用基线二值化压缩策略的 ColBERT——相比我们发现的更稳健的 ColBERTv2 残差压缩）。

### 致谢

ColBERT logo 由 Chuyi Zhang 设计。

## ColPali：面向视觉文档检索

以下内容翻译自 [illuin-tech/colpali README](https://github.com/illuin-tech/colpali)（Apache-2.0 许可）。

本仓库包含《[ColPali: Efficient Document Retrieval with Vision Language Models](https://arxiv.org/abs/2407.01449)》论文提出的视觉文档检索器（visual document retriever）的训练与运行代码。包括基于 ColBERT 架构与 PaliGemma 模型的原始 ColPali 模型，以及后续的 ColVision 与双编码器（bi-encoder）检索器变体。

### 简介

借助 *ColPali*，我们提出用视觉语言模型（VLM）在视觉空间中构建高效的多向量嵌入以做文档检索：把 PaliGemma-3B 的 ViT 输出 patch 喂给一个线性投影，得到文档的多向量表示，并按 ColBERT 方法训练模型以最大化文档嵌入与查询嵌入的相似度。

使用 ColPali 后，无须再搭建可能复杂且脆弱的版面识别与 OCR 管线——单个模型即可同时顾及文档的文本与视觉内容（版式、图表等）。

### 重要：colpali-engine 已弃用

`colpali-engine` 现已弃用。仓库与包仍可用于研究、复现与既有项目，但我们建议新项目与生产使用改用 [Sentence Transformers](https://www.sbert.net/)。

[Sentence Transformers v6](https://github.com/huggingface/sentence-transformers/releases/tag/v6.0.0) 通过 `MultiVectorEncoder` 为 ColPali 风格的模型提供一等公民支持：为嵌入与检索模型——稠密双编码器与多向量后期交互模型——提供一个生态，按模型能力覆盖文本、图像、音频与视频。

该集成由 ColPali 与 ViDoRe 团队协助完成，把模型配置带上 Hugging Face Hub。参见 v6 发布说明、多向量文档，以及专门的"从 colpali-engine 迁移"指南。

安装带图像支持的 Sentence Transformers：

```bash
pip install -U "sentence-transformers[image]>=6.0.0"
```

ColPali 系列模型现在使用与其他后期交互模型同样简洁的 API：

```python
from sentence_transformers import MultiVectorEncoder

# You can also use models such as "vidore/colqwen2-v1.0" or "vidore/colpali-v1.3".
model = MultiVectorEncoder("vidore/colqwen2.5-v0.2")

queries = [
    "What is the variable represented on the y-axis of the graph?",
    "Which year has the highest total outlay?",
]
images = ["page_1.png", "page_2.png"]  # Paths, URLs, or PIL images

query_embeddings = model.encode_query(queries)
document_embeddings = model.encode_document(images)
scores = model.similarity(query_embeddings, document_embeddings)
```

#### 从 colpali-engine 迁移

Sentence Transformers 自动识别 Transformers 原生 `*ForRetrieval` checkpoint，包括 Vidore 模型的 `-hf` 变体。例如 `vidore/colqwen2-v1.0-hf` 把投影与归一化保留在模型内部，其 processor 负责格式化文本查询与图像文档。主要 API 对应关系：

| colpali-engine | Sentence Transformers v6 |
| --- | --- |
| `ColQwen2.from_pretrained(...)` 与 `ColQwen2Processor` | `MultiVectorEncoder("vidore/colqwen2-v1.0")` |
| `processor.process_queries(...)` 接 `model(**batch)` | `model.encode_query(queries)` |
| `processor.process_images(...)` 接 `model(**batch)` | `model.encode_document(images)` |
| `processor.score_multi_vector(query_embeddings, document_embeddings)` | `model.similarity(query_embeddings, document_embeddings)` |
| `mask_non_image_embeddings=True` | `MultiVectorMask(keep_only_token_ids=[processor.tokenizer.convert_tokens_to_ids(processor.image_token)])` |
| `HierarchicalTokenPooler` | `HierarchicalTokenPooling` |
| `colpali_engine.interpretability` | `sentence_transformers.multi_vector_encoder.interpretability` |

简言之，多数推理迁移可以写成：

```python
from sentence_transformers import MultiVectorEncoder

model = MultiVectorEncoder("vidore/colqwen2-v1.0")
query_embeddings = model.encode_query(queries)
document_embeddings = model.encode_document(images)
scores = model.similarity(query_embeddings, document_embeddings)
```

精确对齐说明、训练指南与高级配置见 Sentence Transformers 完整迁移指南。原始项目文档为研究复现目的在原 README 中保留。

### ColVision 模型清单（节选，分数字段为 ViDoRe 排行榜得分）

| 模型 | ViDoRe 得分 | 许可 | 说明 |
| --- | --- | --- | --- |
| vidore/colpali | 81.3 | Gemma | 基于 `google/paligemma-3b-mix-448`；ColPali 论文所用 checkpoint |
| vidore/colpali-v1.2 | 83.9 | Gemma | 类似 v1.1 |
| vidore/colpali-v1.3 | 84.8 | Gemma | 类似 v1.2；以 256 的有效 batch size 训练 3 个 epoch |
| vidore/colqwen2-v0.1 | 87.3 | Apache 2.0 | 基于 `Qwen/Qwen2-VL-2B-Instruct`；支持动态分辨率；每页 768 个图像 patch、有效 batch size 32 |
| vidore/colqwen2-v1.0 | 89.3 | Apache 2.0 | 类似 v0.1，但用更强 GPU 与更大的有效 batch size（256）训练 |
| vidore/colqwen2.5-v0.2 | 89.4 | Apache 2.0 | 基于 `Qwen/Qwen2.5-VL-3B-Instruct`，动态分辨率，超参略有不同 |
| TomoroAI/tomoro-colqwen3-embed-4b | 90.6 | Apache 2.0 | Qwen3-VL 骨干；320 维 ColBERT 风格嵌入、动态分辨率 |
| vidore/colSmol-256M | 80.1 | Apache 2.0 | 基于 `HuggingFaceTB/SmolVLM-256M-Instruct` |
| vidore/colSmol-500M | 82.3 | Apache 2.0 | 基于 `HuggingFaceTB/SmolVLM-500M-Instruct` |

（完整表格含 Cognitive-Lab/ColNetraEmbed 等更多条目，见原 README。）

### 安装

代码库兼容 Python >=3.10,<3.15 与较新的 PyTorch 版本：

```bash
pip install colpali-engine # from PyPI
pip install git+https://github.com/illuin-tech/colpali # from source
```

Mac 用户在 ColQwen 模型上使用 MPS 时报告过 torch 2.6.0 的错误，降级到 torch 2.5.1 可解决。

> **警告**：v1.0 以上的 ColPali 版本，务必从源码安装 `colpali-engine` 或安装 v0.2.0 以上版本。

#### 融合 MaxSim 内核（可选）

可选的 `[lik]` extra 安装 [`late-interaction-kernels`](https://github.com/hcompai/late-interaction-kernels)——一个融合的 Triton MaxSim 内核，在 CUDA Ampere+ / Apple Silicon 上自动用于打分与 ColBERT 损失。它避免显式生成 `[B, B, Lq, Ld]` 分数张量——该张量的内存开销随 batch size 二次增长，常常成为限制 batch size 的分配瓶颈：在 80 GB H100 上的 ColQwen2 + LoRA 基准中，它把最大可训练 batch size 从 64 提到 128，端到端吞吐不变（完整基准见 illuin-tech/colpali#412）：

```bash
pip install "colpali-engine[lik]"
```

环境变量 `COLPALI_SCORES_BACKEND` 选择后端：`auto`（默认，合格时用内核、静默回退 torch）、`torch`（强制纯 torch 参考实现）、`lik`（要求内核，无法运行时抛错）。

### 用法：快速开始

```python
import torch
from PIL import Image
from transformers.utils.import_utils import is_flash_attn_2_available

from colpali_engine.models import ColQwen2, ColQwen2Processor

model_name = "vidore/colqwen2-v1.0"

model = ColQwen2.from_pretrained(
    model_name,
    torch_dtype=torch.bfloat16,
    device_map="cuda:0",  # or "mps" if on Apple Silicon
    attn_implementation="flash_attention_2" if is_flash_attn_2_available() else None,
).eval()

processor = ColQwen2Processor.from_pretrained(model_name)

# Your inputs
images = [
    Image.new("RGB", (128, 128), color="white"),
    Image.new("RGB", (64, 32), color="black"),
]
queries = [
    "What is the organizational structure for our R&D department?",
    "Can you provide a breakdown of last year’s financial performance?",
]

# Process the inputs
batch_images = processor.process_images(images).to(model.device)
batch_queries = processor.process_queries(queries).to(model.device)

# Forward pass
with torch.no_grad():
    image_embeddings = model(**batch_images)
    query_embeddings = model(**batch_queries)

scores = processor.score_multi_vector(query_embeddings, image_embeddings)
```

支持 `fast-plaid` 以在更大语料规模下加速匹配，装上 `plaid` extra 即可用：按 batch 处理图像得到多向量嵌入后，`processor.create_plaid_index(ds)` 建索引、`processor.get_topk_plaid(query_embeddings, plaid_index, k=10)` 取 top-k（完整代码见原 README）。

### 相似度图可解释性

把后期交互相似度图叠加到原图上，可以可视化相对查询每个词最显著的图像 patch，从而对模型的关注区域给出可解释的洞见。使用 `interpretability` 模块需安装 `colpali-engine[interpretability]`，然后用 `get_similarity_maps_from_embeddings` 与 `plot_all_similarity_maps` 为每个查询 token 绘制相似度图（完整代码见原 README 折叠块）。

### 基准测试与复现

在 [ViDoRe 排行榜](https://huggingface.co/spaces/vidore/vidore-leaderboard)上对 ColPali 做基准测试用 [`vidore-benchmark`](https://github.com/illuin-tech/vidore-benchmark) 包；论文结果复现方法见原 README"Paper result reproduction"一节。

## 实战佐证：answerai-colbert-small-v1（Answer.AI）

以下内容翻译自 Answer.AI 博客 [Small but Mighty: Introducing answerai-colbert-small](https://www.answer.ai/posts/2024-08-13-small-but-mighty-colbert.html)（作者 Benjamin Clavié，2024-08-13），署名转载。

向 answerai-colbert-small-v1 问好：一个小到不可思议却以小博大的 ColBERT 模型。

几周前我们发布了 JaColBERTv2.5，用改进的 ColBERT 训练配方做出了最先进的日语检索模型。今天我们介绍 answerai-colbert-small-v1——更小、更快、现代化 ColBERT 模型的概念验证。它建立在 JaColBERTv2.5 配方之上，只有 **3300 万参数**，却能在 **CPU 上**以毫秒级搜索数十万文档。

尽管体量小，它特别能打：在所有基准上大幅超越原本 1.1 亿参数的 ColBERTv2，甚至连训练中完全未见的 LoTTe 也不例外。事实上，它是同尺寸模型在常见检索基准上迄今表现最好的，甚至超过一些大它 10 倍的常用模型（如 e5-large-v2）。

当然，基准测试远非完美，不如拿你自己的数据试试！凭借强大性能与极小体积，我们认为它非常适合延迟敏感的应用，或在较慢的重排步骤之前快速取回文档。更妙的是：在你自己的数据上微调它极其便宜，而训练数据从未如此容易生成——哪怕只有不到 10 条人工标注样本。

### 配方

未来我们会发布技术报告；训练配方大部分与 JaColBERTv2.5 相同（数据配比不同），本节只讲几个要点。

我们做的消融实验相对较少，但尽量以不奖励过拟合的方式进行：验证集用 NFCorpus 的开发集，外加 LitSearch 与 LoTTe Lifestyle 子集的下采样（后者曾用于评估 ColBERTv2）。

#### 为什么这么小？

目标是用实验快速产出强力的概念验证，所以我们聚焦 MiniLM 量级的小模型——嵌入圈一般叫 small：约 33M 参数。这个尺寸有多重优势：

- 训练很快，实验迭代更快。
- 查询延迟极低，适合绝大多数应用。
- 推理计算便宜，可以舒服地部署在 CPU 上。
- 微调很便宜，领域适配容易；近期研究表明 ColBERT 模型在全合成查询上微调效果很好。
- 同时性能仍远超仅仅一年前的 350M 参数最先进模型。

#### 起点要高

第一个候选基座是原始 MiniLM——BERT-base 的蒸馏版。然而，应用信息检索在很大程度上是一个完整的生态：已有许多强模型可以站在上面，避免每次造更快的车都从轮子造起。从 MiniLM 出发恰恰意味着：大量训练算力（以及数据）要花在把模型的向量空间从 MLM 预训练目标迁移到更适合语义检索的目标上。

于是我们试验了另外几个候选：选出在现有基准上表现不错但并未登顶的 33M 参数嵌入模型——阿里巴巴的 gte-small 与 BAAI 的 bge-small-en-v1.5。最后，与突出模型合并的 JaColBERTv2.5 思路一致，我们还试验了一个干脆叫 mini-base 的模型——上述三个候选的权重平均版。

这一步的结果基本符合预期：随着训练推进，无论基座是什么，ColBERT 模型都会学会"做 ColBERT"，各验证集上的表现趋于相近。但 MiniLM 要多花近三倍的消融训练步数才达到同等水平，因此被我们放弃。最终，不出所料，mini-base 比 bge-small-en-v1.5 或 gte-small 都更快到达峰值性能，遂被选为后续实验与最终模型训练的基座。

#### 移植 JaColBERTv2.5 的方法

其余训练与 JaColBERTv2.5 配方基本一致，几个关键差异：

- **优化器**：我们没有用 schedule-free 训练，而是用线性衰减加 5% 步数的 warmup。原因是承担多数实验的机器有硬件支持问题；等另一台机器可用后我们也跑了 schedule-free 的消融，结果与 JaColBERTv2.5 相近，说明它可能是同等甚至更强的选项。
- **数据**：训练数据显然不同。最终模型是三次训练运行权重的平均：
  1. 第一个 checkpoint：在 MSMARCO 的 640,000 条 32-way 三元组上训练，教师分数由 BGE-M3-reranker 生成。
  2. 第二个 checkpoint：在上述 checkpoint 上继续微调，用 250 万条 32-way 三元组，数据等量来自 MSMARCO、HotPotQA、TriviaQA、Fever 与 Natural Questions——这些是英语检索模型文献中最常用的数据集；教师分数同样由 BGE-M3-reranker 生成。
  3. 最终 checkpoint：还是在 MSMARCO 的 640,000 条 32-way 三元组上训练（与前面不同的一批），但教师分数来自 BGE 新的 Gemma2-lightweight 重排器——取 Gemma-2 模型的部分层训练成 cross-encoder，用其输出 logits 作分数。

  有意思的是：单独看，这三个 checkpoint 的平均下游性能相当接近，但各自擅长不同数据集；而把它们平均，使模型的平均验证分提高近 2 分——似乎只保留了各自最好的品质，尽管参数量极低。

- **数据花絮**（有限的数据消融中的有趣发现）：
  - 对第二步用到的每个数据集分别单独训练再平均最终 checkpoint，似乎有些收益，但提升不足以抵偿额外的训练时间。
  - 上一条对 HotPotQA 不成立：只在 HotPotQA 上训练会让每个验证数据集的每项指标都下降；但把它纳入第二个 checkpoint 的混合数据，则带来轻微而一致的提升。
  - Gemma-2 教师分数对整体结果的提升不如期望，但明显提高了 LitSearch 上的成绩——可能意味着它帮模型泛化得更好，尚需进一步实验证实。另一种解释：我们的负样本不够难，对分数做 min-max 归一化后学到的训练分数分布，无法让小模型真正学到大模型分数里的微妙差别。

### 评估

本节先给出一个大警告：这是一个概念验证模型的发布，我们在最常见基准上评估并与其他常用模型比较。这是标准做法，但不是全面评估。

信息检索基准有两个截然不同的用途：其最初的内核用途，是作为研究中"其他条件相同"下比较单项改动的相对参照，判断提议的改动是否算改进；第二个用途（如今更流行）是借公共测试床做模型间的**绝对**性能比较。但第二个角色难得多，某种程度上不可能完美胜任。BEIR（MTEB 的检索子集）是模型性能的良好指标，但不太可能与你的具体用例完全相关。这不是贬低 BEIR！只是有许多无法控制的因素：

- 模型的训练数据配比不同，可能包含 BEIR 任务的训练集或相邻任务，也可能不包含。
- 基准也常被当作验证集使用，这会鼓励"在基准上表现好"的训练方法。
- 即使是全新的、未过拟合的基准，通常也只评估模型在特定领域、任务与查询风格上的表现——正信号之外，无法保证模型在这个领域/查询风格上泛化好，换个领域/风格同样好。
- 极其重要的"氛围评测"（vibe evals）与基准分数并不总是相关。

综上：我们觉得模型很棒、标准评估也不错，但真正重要的是你自己的评估，我们非常期待听到它在实际中的表现！

#### BEIR

BEIR 又名 MTEB（Massive Text Embedding Benchmark）的检索部分：15 个数据集的集合，评估多种场景下的检索（论辩挖掘、问答、科学检索、支撑论断的事实查证、重复检测等）。各数据集速览：

- FiQA2018：金融数据问答
- HotPotQA：维基百科多跳（可能需要多份连续来源）问答
- MSMARCO：真实 BING 查询的多样网页搜索
- TREC-COVID：COVID-19 论断/问题的科学检索语料
- ArguAna：论辩挖掘，查询本身就是文档
- ClimateFEVER：对气候变化论断做维基百科事实核验
- CQADupstackRetrieval：StackExchange 重复问题检索
- DBPedia：维基百科实体检索（描述实体，如"Top Gun 里那家伙是谁"，结果须含 Tom Cruise）
- FEVER：对一般话题论断做维基百科事实核验
- NFCorpus：PubMed（医学出版物库）营养信息检索
- QuoraRetrieval：Quora 重复问题检索
- SciDocs：给 PubMed 文章标题找对应摘要
- SciFact：找支持/反驳查询论断的 PubMed 文章
- Touche2020-v2：论辩挖掘（近有研究指出其明显缺陷，仅为完整性列出，不必太在意）

为省篇幅，我们与最强（Snowflake/snowflake-arctic-embed-s）和最常用（BAAI/bge-small-en-v1.5）的 33M 参数模型，以及最常用的 110M 参数模型（BAAI/bge-base-en-v1.5）比较。BEIR 均分：answer-colbert-s **53.79**、snowflake-s 51.99、bge-small-en 51.68、bge-base-en（3.3 倍大小）53.25。逐数据集分数（nDCG@10）：

| 数据集 | answer-colbert-s | snowflake-s | bge-small-en | bge-base-en |
| --- | --- | --- | --- | --- |
| BEIR AVG | 53.79 | 51.99 | 51.68 | 53.25 |
| FiQA2018 | 41.15 | 40.65 | 40.34 | 40.65 |
| HotpotQA | 76.11 | 66.54 | 69.94 | 72.6 |
| MSMARCO | 43.5 | 40.23 | 40.83 | 41.35 |
| NQ | 59.1 | 50.9 | 50.18 | 54.15 |
| TRECCOVID | 84.59 | 80.12 | 75.9 | 78.07 |
| ArguAna | 50.09 | 57.59 | 59.55 | 63.61 |
| ClimateFEVER | 33.07 | 35.2 | 31.84 | 31.17 |
| CQADupstackRetrieval | 38.75 | 39.65 | 39.05 | 42.35 |
| DBPedia | 45.58 | 41.02 | 40.03 | 40.77 |
| FEVER | 90.96 | 87.13 | 86.64 | 86.29 |
| NFCorpus | 37.3 | 34.92 | 34.3 | 37.39 |
| QuoraRetrieval | 87.72 | 88.41 | 88.78 | 88.9 |
| SCIDOCS | 18.42 | 21.82 | 20.52 | 21.73 |
| SciFact | 74.77 | 72.22 | 71.28 | 74.04 |
| Touche2020 | 25.69 | 23.48 | 26.04 | 25.7 |

结果表明 answerai-colbert-small-v1 是一个非常强的选手，大幅以小博大，甚至击败了大它 3 倍多的最流行 bert-base 级模型！但结果也凸显相当不均衡的表现，与任务性质强相关：它在"经典"搜索任务（小查询的问答或文档搜索）上表现出色——MS Marco、TREC-COVID、FiQA、FEVER 等分数尤其亮眼。另一方面，与所有 ColBERT 模型一样，它在非经典任务上吃力，明显偏弱的有：

- ArguAna：以平均 300–500 token 的完整长论辩为输入找"相关论辩"，是明显的弱项。
- SCIDOCS：任务性质没给模型多少可打分的 token。
- CQADupstack 与 Quora：两个重复检测任务，要为给定问题找到平台上（StackExchange/Quora）的重复问题。

这印证了前述观点：就传统搜索与 QA 任务而言，它显然是目前最好的模型；但换一类任务，可能就没那么合适——按需微调，甚至换一种在你的数据上更好用的方法！

#### ColBERTv2.0 vs answerai-colbert-small-v1

最后是大家等着看的：与原版 ColBERTv2.0 的对比。ColBERTv2.0 一直是相当能干的的主力，域外泛化极强，采用率很高，在 HuggingFace 上保持月均约 500 万次下载。但在快节奏的 ML 世界里它已是"老模型"。下表可见：参数不足其三分之一的新模型在 BEIR 上全面领先：

| 数据集 | answerai-colbert-small-v1 | ColBERTv2.0 |
| --- | --- | --- |
| BEIR AVG | 53.79 | 50.02 |
| DBPedia | 45.58 | 44.6 |
| FiQA2018 | 41.15 | 35.6 |
| NQ | 59.1 | 56.2 |
| HotpotQA | 76.11 | 66.7 |
| NFCorpus | 37.3 | 33.8 |
| TRECCOVID | 84.59 | 73.3 |
| Touche2020 | 25.69 | 26.3 |
| ArguAna | 50.09 | 46.3 |
| ClimateFEVER | 33.07 | 17.6 |
| FEVER | 90.96 | 78.5 |
| QuoraRetrieval | 87.72 | 85.2 |
| SCIDOCS | 18.42 | 15.4 |
| SciFact | 74.77 | 69.3 |

这些结果令人兴奋：无需大量 LLM 生成数据工作，更新的技术就能让一个小得多的模型在广泛用途上有竞争力。更有趣的是，它也是泛化能力的有用检验——新模型在基准上好这么多，我们希望它在真实世界的大多数下游用途中同样出色。

### 结语（Final Word）

开发这个模型非常有趣，希望它在各方面都有用。它已经上了 Hugging Face Hub，现在就能上手！

我们把它视为概念验证——既是对 JaColBERTv2.5 配方，也是对检索技术整体！参数量如此之小，却证明了多向量模型这类创造性路径还有大量检索性能可挖；对许多用途而言，低参数量模型比巨大的 70 亿参数嵌入器更合适。

模型开箱即用：可以插入任何当前使用 ColBERT 的管线——无论走 RAGatouille 还是斯坦福 ColBERT 代码库。同样，你可以像微调任何 ColBERT 模型那样微调它；我们的早期内部实验显示，即使少量合成数据的域内微调，它的响应也非常好。

如果你还没用 ColBERT，也可以用当前版本的 RAGatouille 试一试！未来几周我们还将发布 RAGatouille 大改版，让免复杂索引用模型更简单，后续版本再简化微调流程。

如前所述，基准只讲了一小部分故事。我们期待看到模型在真实世界投入使用，看看 3300 万参数能走多远！

（原注：值得一提的是，近期 Snowflake 的 snowflake-arctic-embed-m——约 110M 参数的模型——已达到强于 bge-base-en-v1.5 的性能，对需要该量级模型的用例可能是很好的选择。）

---

> **来源**：本文由三个来源的完整翻译整合而成，逐节署名——"ColBERT（v2）"节翻译自 [stanford-futuredata/ColBERT README](https://github.com/stanford-futuredata/ColBERT)（MIT）；"ColPali"节翻译自 [illuin-tech/colpali README](https://github.com/illuin-tech/colpali)（Apache-2.0）；"实战佐证"节翻译自 Answer.AI 博客《Small but Mighty: Introducing answerai-colbert-small》（Benjamin Clavié，2024-08-13，署名转载）。抓取于 2026-09-13。
> 收录范围说明：ColBERT 节完整收录（徽章图片除外）；ColPali 节完整收录实质章节，模型清单表格保留代表性行并注明（Community Projects 为外链列表未逐条翻译）；Answer.AI 节完整收录（网页目录与排版元素除外，BEIR 数据集描述表转为列表）。
> 选型背景：任务候选来源 Weaviate 博客 late-interaction 篇与 Answer.AI ColPali 篇在抓取时均不可得（weaviate.io 对抓取工具持续返回空/超时；Answer.AI 站点无 ColPali 专文，检索确认），故 ColPali 部分改用官方 colpali 仓库 README，Answer.AI 部分改用其 late-interaction 主题的 answerai-colbert-small 发布文。
