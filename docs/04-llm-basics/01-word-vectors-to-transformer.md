---
title: 从词向量到 Transformer
source_url: https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter1/%E7%AC%AC%E4%B8%80%E7%AB%A0%20NLP%E5%9F%BA%E7%A1%80%E6%A6%82%E5%BF%B5.md
author: DataWhale happy-llm 项目
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 1
group: 架构地基
---
## 一、文本表示：让计算机读懂语言

文本表示的目的是将人类语言的自然形式转化为计算机可以处理的形式，也就是将文本数据数字化，使计算机能够对文本进行有效的分析和处理。文本表示是 NLP 领域中的一项基础性和必要性工作，它直接影响甚至决定着 NLP 系统的质量和性能。

在 NLP 中，文本表示涉及到将文本中的语言单位（如字、词、短语、句子等）以及它们之间的关系和结构信息转换为计算机能够理解和操作的形式，例如向量、矩阵或其他数据结构。这样的表示不仅需要保留足够的语义信息，以便于后续的 NLP 任务（如文本分类、情感分析、机器翻译等），还需要考虑计算效率和存储效率。

文本表示的发展历程经历了多个阶段：从早期的基于规则的方法，到统计学习方法，再到当前的深度学习技术。

## 二、向量空间模型与 One-Hot 表示

向量空间模型（Vector Space Model，VSM）是 NLP 领域中一个基础且强大的文本表示方法，最早由哈佛大学 Salton 提出。它通过将文本（单词、句子、段落或整个文档）转换为高维空间中的向量来实现文本的数学化表示：每个维度代表一个特征项（字、词、词组或短语），向量中的每个元素值代表该特征项在文本中的权重（通过词频 TF、逆文档频率 TF-IDF 等公式计算）。

最朴素的词向量就是 **One-Hot 编码**：词汇表有多大，向量就有多少维，词对应的位置为 1，其余全为 0：

```python
# "雍和宫的荷花很美"
# 词汇表大小：16384，句子包含词汇：["雍和宫", "的", "荷花", "很", "美"] = 5个词

vector = [0, 0, ..., 1, 0, ..., 1, 0, ..., 1, 0, ..., 1, 0, ..., 1, 0, ...]
#                    ↑          ↑          ↑          ↑          ↑
#      16384维中只有5个位置为1，其余16379个位置为0
# 实际有效维度：仅5维（非零维度）
# 稀疏率：(16384-5)/16384 ≈ 99.97%
```

> 词汇表是一个包含所有可能出现的词语的集合。在向量空间模型中，每个词对应词汇表中的一个位置。例如，如果词汇表大小为 16384，那么每个词都会被表示为一个 16384 维的向量，其中只有该词对应的位置为 1，其他位置都为 0。

VSM 的应用极其广泛（文本相似度计算、文本分类、信息检索等），但它存在明显缺陷：

- **数据稀疏与维数灾难**：特征项数量庞大导致维度极高，且多数元素为零；
- **丢失结构信息**：特征项相互独立的假设忽略了词序和上下文；
- **无法表达语义相似**：One-Hot 向量之间互相正交，"国王"和"皇帝"在向量空间中毫无关系。

## 三、N-gram 语言模型

N-gram 模型是一种基于统计的语言模型，核心思想是基于马尔可夫假设：一个词的出现概率仅依赖于它前面的 N-1 个词。N=1 称为 unigram，N=2 称为 bigram，N=3 称为 trigram，以此类推。

N-gram 模型通过条件概率链式规则来估计整个句子的概率。对于句子 "The quick brown fox"，作为 trigram 模型，我们会计算 P("brown" | "The", "quick")、P("fox" | "quick", "brown") 等概率，并将它们相乘。

N-gram 的优点是实现简单、容易理解；但当 N 较大时会出现数据稀疏问题——参数空间急剧增大，相同 N-gram 序列出现的概率变得极低，模型泛化能力下降，也无法捕捉长距离依赖。

## 四、Word2Vec：词的"稠密表示"

Word2Vec 是一种流行的词嵌入（Word Embedding）技术，由 Tomas Mikolov 等人在 2013 年提出。它旨在通过学习词与词之间的上下文关系来生成词的**密集向量表示**，使语义相似或相关的词在向量空间中距离较近。

Word2Vec 主要有两种架构：

- **CBOW（Continuous Bag of Words，连续词袋）**：根据目标词上下文中的词对应的词向量，计算并输出目标词的向量表示；
- **Skip-Gram**：与 CBOW 相反，利用目标词的向量表示计算上下文中的词向量。

实践验证 CBOW 适用于小型数据集，而 Skip-Gram 在大型语料中表现更好。

相比于传统的高维稀疏表示（如 One-Hot 编码），Word2Vec 生成的是低维（通常几百维）的密集向量，有助于减少计算复杂度和存储需求。它能够捕捉词与词之间的语义关系——比如"国王"和"王后"在向量空间中的位置会比较接近；甚至存在著名的线性关系：vec(国王) − vec(男人) + vec(女人) ≈ vec(王后)。但由于 CBOW/Skip-Gram 基于局部上下文，无法捕捉长距离依赖，且**每个词只有一个固定向量**，无法处理"苹果"（水果 vs 公司）这类一词多义问题。

## 五、ELMo：从静态到动态词向量

ELMo（Embeddings from Language Models）实现了一词多义、静态词向量到动态词向量的跨越式转变。它首先在大型语料库上训练语言模型得到词向量模型，然后在特定任务上微调。ELMo 首次将**预训练**思想引入词向量的生成，使用双向 LSTM 结构捕捉词汇的上下文信息，生成更丰富准确的词向量表示。

ELMo 采用典型的两阶段过程：第 1 阶段利用语言模型进行预训练；第 2 阶段在做特定任务时，从预训练网络中提取对应单词的词向量作为新特征补充到下游任务中。不过基于 RNN 的 LSTM 模型训练时间长、难以并行，特征提取效率成为瓶颈。

**编者注**：至此，"预训练 + 下游微调"的范式已经雏形初现，但序列模型（RNN/LSTM）的串行计算和长程依赖问题仍未解决。打破这一僵局的，就是 2017 年的 Transformer。

## 六、Transformer 登场：注意力即一切

2017 年，Google 的论文《Attention Is All You Need》通过仅使用注意力机制、抛弃传统的 RNN/CNN 架构搭建出 Transformer 模型，带来了 NLP 领域的大变革。Transformer 中使用注意力机制的是其两个核心组件——Encoder（编码器）和 Decoder（解码器）。后续基于 Transformer 的预训练语言模型基本都是对 Encoder-Decoder 部分进行改进来构建新的模型架构，例如只使用 Encoder 的 BERT、只使用 Decoder 的 GPT。

### 6.1 Seq2Seq 任务

Seq2Seq（序列到序列）是一种经典 NLP 任务：模型输入一个自然语言序列 input = (x₁, x₂, …, xₙ)，输出一个可能不等长的自然语言序列 output = (y₁, y₂, …, yₘ)。几乎所有 NLP 任务都可以视为 Seq2Seq 任务——文本分类可视为输出长度为 1 的目标序列（m = 1）；词性标注可视为输出与输入等长的目标序列（m = n）。

机器翻译即是经典的 Seq2Seq 任务：输入"今天天气真好"，输出 "Today is a good day."。Transformer 一开始正是应用在机器翻译任务上的。

对 Seq2Seq 任务，一般思路是**编码再解码**：编码，就是将输入序列通过隐藏层编码成能表征语义的向量（可以简单理解为更复杂的词向量表示）；解码，就是将编码结果再解码成目标序列。Transformer 中的 Encoder 用于编码过程，Decoder 用于解码过程。

![图：编码器-解码器结构](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/2-figures/2-0.jpg)

**图：Transformer 编码器-解码器结构**（图片来源：happy-llm）

Transformer 由 Encoder 和 Decoder 组成，每一个 Encoder（Decoder）又由 6 个 Encoder（Decoder）Layer 组成。输入源序列进入 Encoder 编码，到 Encoder Layer 的最顶层再将编码结果输出给 Decoder Layer 的每一层，通过 Decoder 解码后得到输出目标序列。

### 6.2 Encoder Layer 的三大组件

每个 Encoder Layer 都包含一个注意力机制和一个前馈神经网络（FFN），并配合残差连接与层归一化。前馈神经网络的实现很简单——两个线性层中间加一个 ReLU 激活函数，外加一个 Dropout 层防止过拟合（Dropout 只在训练时开启，推理时关闭，所以许多结构示意图中不会画出）：

```python
class MLP(nn.Module):
    '''前馈神经网络'''
    def __init__(self, dim: int, hidden_dim: int, dropout: float):
        super().__init__()
        # 定义第一层线性变换，从输入维度到隐藏维度
        self.w1 = nn.Linear(dim, hidden_dim, bias=False)
        # 定义第二层线性变换，从隐藏维度到输入维度
        self.w2 = nn.Linear(hidden_dim, dim, bias=False)
        # 定义dropout层，用于防止过拟合
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        # 输入x通过第一层线性变换和RELU激活函数
        # 最后，通过第二层线性变换和dropout层
        return self.dropout(self.w2(F.relu(self.w1(x))))
```

层归一化（Layer Norm）把每一层神经网络的输入稳定在标准分布，加速收敛；残差连接（Residual Connection）则把输入直接加到输出上，缓解深层网络的梯度消失问题。注意力计算与 FFN 之间以"Attention(x) → 残差+归一化 → FFN → 残差+归一化"的方式堆叠，构成一层 Encoder Layer。

### 6.3 Embedding 与位置编码

在 NLP 任务中，我们需要将自然语言输入转化为机器可处理的向量，承担这个任务的组件就是 Embedding 层——一个存储固定大小词典的嵌入向量**查找表**。输入神经网络之前，分词器（tokenizer）先把自然语言切分成 token 并转化为固定 index：例如词表大小为 4 时，"我喜欢你"可转化为 index `[0, 1, 2]`。Embedding 内部是一个可训练的 (vocab_size, embedding_dim) 权重矩阵，查表输出形状为 (batch_size, seq_len, embedding_dim) 的矩阵：

```python
self.tok_embeddings = nn.Embedding(args.vocab_size, args.dim)
```

但注意力机制的并行计算带来了新问题——**位置信息丢失**：对序列中的每一个 token，其他各个位置对它来说都是平等的，"我喜欢你"和"你喜欢我"在注意力机制看来完全相同。因此 Transformer 采用了位置编码机制：根据 token 在序列中的位置对其进行编码，再加到词向量上。原始 Transformer 使用正余弦绝对位置编码（Sinusoidal）：

```
PE(pos, 2i)   = sin(pos / 10000^(2i/d_model))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d_model))
```

其中 pos 为 token 在句子中的位置，2i 和 2i+1 指示位置编码向量的维度索引是奇数还是偶数——奇偶维度采用不同函数编码。例如长度为 4 的句子 "I like to code"，词向量矩阵每一行是一个词的词向量（x₀ = [0.1, 0.2, 0.3, 0.4] 对应 "I"，pos = 0），将按上述公式算出的位置编码矩阵逐元素加到词向量矩阵上，即得到携带位置信息的输入表示。

**编者注**：词向量解决了"文本变数字"，Transformer 解决了"如何高效建模任意两处上下文的关系"。它凭什么做到这一点？答案就是下一篇文章的主角——注意力机制（Attention）。后续基于 Transformer 的三条架构路线（Encoder-Only 的 BERT、Encoder-Decoder 的 T5、Decoder-Only 的 GPT），我们将在《GPT 系列演进》中展开。

## 延伸阅读

- 注意力机制的详细推导与代码实现：见本模块下一篇《注意力机制》
- Transformer 完整代码逐块搭建：[happy-llm 第二章 2.3 节](https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter2/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20Transformer%E6%9E%B6%E6%9E%84.md)

## 参考文献（转自原文）

1. Tomas Mikolov, Ilya Sutskever, Kai Chen, Greg Corrado, Jeffrey Dean. (2013). *Distributed Representations of Words and Phrases and their Compositionality.* arXiv:1310.4546.
2. Matthew E. Peters, et al. (2018). *Deep contextualized word representations.* arXiv:1802.05365.
3. Ashish Vaswani, et al. (2017). *Attention Is All You Need.* arXiv:1706.03762.
4. Salton, G., Wong, A., Yang, C. S. (1975). *A vector space model for automatic indexing.* Communications of the ACM, 18(11), 613–620.

---

> **来源**：本文转载自 [第一章 NLP 基础概念 · 文本表示的发展历程](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter1/%E7%AC%AC%E4%B8%80%E7%AB%A0%20NLP%E5%9F%BA%E7%A1%80%E6%A6%82%E5%BF%B5.md) 与 [第二章 Transformer 架构](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter2/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20Transformer%E6%9E%B6%E6%9E%84.md)，作者 DataWhale happy-llm 项目，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
> 本文整合两章内容：第一章 1.4 节讲清"文本如何变成向量"，第二章讲清"Transformer 如何接棒词向量成为大模型的地基"。原文 LaTeX 公式已转写为 Unicode 文本，图片改为仓库原始链接；衔接性小节（标注"编者注"）为本站补充。
