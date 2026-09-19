---
title: 注意力机制
source_url: https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter2/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20Transformer%E6%9E%B6%E6%9E%84.md
author: DataWhale happy-llm 项目
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 2
group: 架构地基
---
## 一、为什么需要注意力机制

随着 NLP 从统计机器学习向深度学习迈进，文本表示方法也从统计学习进入神经网络时代。从计算机视觉（Computer Vision，CV）起源发展起来的神经网络，其核心架构有三种：

- **前馈神经网络**（Feedforward Neural Network，FNN）：数据从输入层单向流动到输出层，无循环结构。多层感知机（Multi-Layer Perceptron，MLP）是最常见的形式，每一层的神经元都和上下两层的每一个神经元完全连接；
- **卷积神经网络**（Convolutional Neural Network，CNN）：用参数量远小于全连接网络的卷积层来进行特征提取和学习；
- **循环神经网络**（Recurrent Neural Network，RNN）：能够使用历史信息作为输入、包含环和自重复的网络。

![图：全连接神经网络](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/2-figures/1-0.png)

**图：全连接神经网络**（图片来源：happy-llm）

NLP 任务处理的文本往往是序列，因此专用于序列、时序数据的 RNN 长期在 NLP 任务上效果最优。在注意力机制横空出世之前，RNN 及其衍生架构 LSTM 是 NLP 领域的霸主——例如开创预训练思想的 ELMo 就使用双向 LSTM。但 RNN/LSTM 有两个难以弥补的缺陷：

1. **串行计算限制了并行能力**。序列需要依次输入、依序计算，GPU 的并行计算能力受到极大限制，导致以 RNN 为基础的模型虽然参数量不算大，但计算时间成本很高；
2. **难以捕捉长序列相关关系**。距离越远的输入之间的关系越难捕捉，虽然 LSTM 通过门机制有所优化，但对远距离依赖的捕捉依旧不尽如人意。

针对这些问题，Vaswani 等学者参考在 CV 领域被提出、常被融入 RNN 使用的注意力机制（Attention），创新性地搭建了完全由注意力机制构成的神经网络——Transformer，也就是大语言模型（Large Language Model，LLM）的核心架构。

注意力机制的核心思想：当我们关注一张图片，往往无需看清全部内容，仅将注意力集中在重点部分即可。在自然语言处理领域同理——将重点注意力集中在一个或几个 token 上，就能取得更高效高质的计算效果。

## 二、Query、Key、Value

注意力机制有三个核心变量：**Query**（查询值）、**Key**（键值）和 **Value**（真值）。例如，当我们有一篇新闻报道，想找到报道的时间，那么 Query 可以是类似"时间""日期"一类的向量（实际是稠密向量），Key 和 Value 会是整个文本。通过对 Query 和 Key 进行运算可以得到一个权重，这个权重反映了从 Query 出发，对文本每一个 token 应该分布的注意力相对大小；把权重和 Value 进行运算，得到的结果就是从 Query 出发计算整个文本注意力得到的结果。

具体而言，注意力机制的特点是：**通过计算 Query 与 Key 的相关性为真值加权求和**，从而拟合序列中每个词同其他词的相关关系。

## 三、从字典查找到注意力公式

以字典为例，逐步推导注意力机制的计算公式。给定字典：

```json
{
    "apple":10,
    "banana":5,
    "chair":2
}
```

字典的键就是 Key，值就是 Value。字典支持精确匹配：如果 Query 为 "apple"，直接匹配得到 Value = 10。

但如果 Query 是一个包含多个 Key 的概念呢？例如查询 "fruit"，我们应该把 apple 和 banana 都匹配到，但不能匹配 chair。于是给三个 Key 分别赋予如下权重：

```json
{
    "apple":0.6,
    "banana":0.4,
    "chair":0
}
```

最终查询到的值：

```
value = 0.6 * 10 + 0.4 * 5 + 0 * 2 = 8
```

给不同 Key 赋予的不同权重，就是**注意力分数**。那么如何计算注意力分数？直观上，Key 与 Query 相关性越高，注意力权重越大。而词向量恰好能度量相关性：语义相似的两个词对应的词向量点积应该大于 0，语义不相似的词向量点积小于 0。即用点积 v·w = Σᵢ vᵢwᵢ 来度量相似度。

假设 Query "fruit" 对应的词向量为 q，所有 Key 的词向量堆叠成矩阵 K，则 Query 和每一个键的相似程度：

```
x = qKᵀ
```

再通过 Softmax 层将 x 转化为和为 1 的权重：

```
softmax(x)ᵢ = eˣⁱ / Σⱼ eˣʲ
```

最后将注意力分数和值向量做对应乘积，得到注意力机制的基本公式：

```
attention(Q,K,V) = softmax(QKᵀ)V
```

不过 Q 和 K 对应的维度 d_k 比较大时，softmax 放缩时容易受影响，使不同值之间差异过大，影响梯度稳定性。因此对 QKᵀ 的结果做放缩，得到注意力机制的核心计算公式：

```
attention(Q,K,V) = softmax(QKᵀ/√d_k)·V
```

## 四、代码实现

使用 PyTorch 只需几行代码即可实现核心的注意力计算：

```python
'''注意力计算函数'''
def attention(query, key, value, dropout=None):
    '''
    args:
    query: 查询值矩阵
    key: 键值矩阵
    value: 真值矩阵
    '''
    # 获取键向量的维度，键向量的维度和值向量的维度相同
    d_k = query.size(-1)
    # 计算Q与K的内积并除以根号dk
    # transpose——相当于转置
    scores = torch.matmul(query, key.transpose(-2, -1)) / math.sqrt(d_k)
    # Softmax
    p_attn = scores.softmax(dim=-1)
    if dropout is not None:
        p_attn = dropout(p_attn)
    # 根据计算结果对value进行加权求和
    return torch.matmul(p_attn, value), p_attn
```

注意，这里假设输入的 query、key、value 已经是转化后的词向量矩阵，即公式中的 Q、K、V。

## 五、自注意力（Self-Attention）

注意力机制的本质是对两段序列的元素依次进行相似度计算，找出一个序列的每个元素对另一个序列的每个元素的相关度，然后基于相关度分配注意力。经典注意力机制中，Q 往往来自一个序列，K 与 V 来自另一个序列，从而拟合两个序列之间的关系——例如 Transformer 的 Decoder 中，Q 来自 Decoder 的输入，K 与 V 来自 Encoder 的输出。

而 Transformer 的 Encoder 使用的是注意力机制的变种——**自注意力**（self-attention）：计算本身序列中每个元素对其他元素的注意力分布，即 Q、K、V 都由同一个输入通过不同的参数矩阵 W_q、W_k、W_v 计算得到，从而拟合输入语句中每一个 token 对其他所有 token 的关系。

代码实现上，self-attention 就是通过给 Q、K、V 传入同一个参数实现的：

```python
# attention 为上文定义的注意力计算函数
attention(x, x, x)
```

## 六、掩码自注意力（Mask Self-Attention）

掩码自注意力是指使用注意力掩码的自注意力机制。掩码的作用是遮蔽特定位置的 token，模型在学习过程中会忽略被遮蔽的 token。

**核心动机**：让模型只能使用历史信息预测，不能看到未来信息。Transformer 也是通过类似 n-gram 的语言模型任务学习的——对一个文本序列，不断根据之前的 token 预测下一个 token。例如待学习的文本序列是 【BOS】I like you【EOS】：

```
Step 1：输入 【BOS】，输出 I
Step 2：输入 【BOS】I，输出 like
Step 3：输入 【BOS】I like，输出 you
Step 4：输入 【BOS】I like you，输出 【EOS】
```

但上述过程是串行的——需要先完成 Step 1 才能做 Step 2，没有发挥 Transformer 并行计算的优势。解决方案是掩码自注意力：生成一串掩码遮蔽未来信息，让所有步骤并行输入：

```
<BOS> 【MASK】【MASK】【MASK】【MASK】
<BOS>    I   【MASK】 【MASK】【MASK】
<BOS>    I     like  【MASK】【MASK】
<BOS>    I     like    you  【MASK】
<BOS>    I     like    you   </EOS>
```

每一行输入中，模型只看到前面的 token、预测下一个 token，但所有行可以并行计算，从而实现并行的语言模型。

观察掩码可以发现，它其实是一个和文本序列等长的**上三角矩阵**。当输入维度为 (batch_size, seq_len, hidden_size) 时，Mask 矩阵维度一般为 (1, seq_len, seq_len)（通过广播实现同一 batch 中不同样本的计算）：

```python
# 创建一个上三角矩阵，用于遮蔽未来信息。
# 先通过 full 函数创建一个 1 * seq_len * seq_len 的矩阵
mask = torch.full((1, args.max_seq_len, args.max_seq_len), float("-inf"))
# triu 函数的功能是创建一个上三角矩阵
mask = torch.triu(mask, diagonal=1)
```

生成的 Mask 矩阵上三角位置均为 -inf，其他位置为 0。注意力计算时，将注意力分数与掩码相加后再做 Softmax：

```python
# 此处的 scores 为计算得到的注意力分数，mask 为上文生成的掩码矩阵
scores = scores + mask[:, :seqlen, :seqlen]
scores = F.softmax(scores.float(), dim=-1).type_as(xq)
```

相加后，上三角区域（应被遮蔽的 token 对应位置）的注意力分数都变成 `-inf`；经过 Softmax 之后 `-inf` 被置为 0，从而忽略了未来信息的注意力分数，实现注意力遮蔽。

## 七、多头注意力（Multi-Head Attention）

一次注意力计算只能拟合一种相关关系，单一的注意力机制很难全面拟合语句序列里的相关关系。因此 Transformer 使用了**多头注意力机制**：同时对一个语料进行多次注意力计算，每次计算拟合不同的关系，将多次结果拼接起来作为输出。

原论文实验证实，不同的注意力头能够拟合语句中的不同信息：

![图：多头注意力机制](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/2-figures/1-3.jpeg)

**图：两个注意力头对同一段语句的自注意力计算结果**（图片来源：happy-llm）

多头注意力的公式表示：

```
MultiHead(Q, K, V) = Concat(head_1, ..., head_h)·W^O
其中 head_i = Attention(QW_i^Q, KW_i^K, VW_i^V)
```

最直观的实现是 n 个头用 n 组（每组 3 个）参数矩阵分别计算再拼接；但时空复杂度均较高。可以通过矩阵运算巧妙地实现并行多头计算——核心逻辑是使用三个组合矩阵代替 n 个参数矩阵的组合（矩阵内积再拼接等同于拼接矩阵再内积）。完整实现：

```python
import torch.nn as nn
import torch

'''多头自注意力计算模块'''
class MultiHeadAttention(nn.Module):

    def __init__(self, args: ModelArgs, is_causal=False):
        # 构造函数
        # args: 配置对象
        super().__init__()
        # 隐藏层维度必须是头数的整数倍，因为后面我们会将输入拆成头数个矩阵
        assert args.dim % args.n_heads == 0
        # 每个头的维度，等于模型维度除以头的总数。
        self.head_dim = args.dim // args.n_heads
        self.n_heads = args.n_heads

        # Wq, Wk, Wv 参数矩阵，每个参数矩阵为 n_embd x dim
        # 这里通过三个组合矩阵来代替了n个参数矩阵的组合，其逻辑在于矩阵内积再拼接其实等同于拼接矩阵再内积，
        # 不理解的读者可以自行模拟一下，每一个线性层其实相当于n个参数矩阵的拼接
        self.wq = nn.Linear(args.n_embd, self.n_heads * self.head_dim, bias=False)
        self.wk = nn.Linear(args.n_embd, self.n_heads * self.head_dim, bias=False)
        self.wv = nn.Linear(args.n_embd, self.n_heads * self.head_dim, bias=False)
        # 输出权重矩阵，维度为 dim x dim（head_dim = dim / n_heads）
        self.wo = nn.Linear(self.n_heads * self.head_dim, args.dim, bias=False)
        # 注意力的 dropout
        self.attn_dropout = nn.Dropout(args.dropout)
        # 残差连接的 dropout
        self.resid_dropout = nn.Dropout(args.dropout)
        self.is_causal = is_causal

        # 创建一个上三角矩阵，用于遮蔽未来信息
        # 注意，因为是多头注意力，Mask 矩阵比之前我们定义的多一个维度
        if is_causal:
            mask = torch.full((1, 1, args.max_seq_len, args.max_seq_len), float("-inf"))
            mask = torch.triu(mask, diagonal=1)
            # 注册为模型的缓冲区
            self.register_buffer("mask", mask)

    def forward(self, q: torch.Tensor, k: torch.Tensor, v: torch.Tensor):

        # 获取批次大小和序列长度，[batch_size, seq_len, dim]
        bsz, seqlen, _ = q.shape

        # 计算查询（Q）、键（K）、值（V）,输入通过参数矩阵层，维度为 (B, T, n_embed) x (n_embed, dim) -> (B, T, dim)
        xq, xk, xv = self.wq(q), self.wk(k), self.wv(v)

        # 将 Q、K、V 拆分成多头，维度为 (B, T, n_head, dim // n_head)，然后交换维度，变成 (B, n_head, T, dim // n_head)
        # 因为在注意力计算中我们是取了后两个维度参与计算
        # 为什么要先按B*T*n_head*C//n_head展开再互换1、2维度而不是直接按注意力输入展开，是因为view的展开方式是直接把输入全部排开，
        # 然后按要求构造，可以发现只有上述操作能够实现我们将每个头对应部分取出来的目标
        xq = xq.view(bsz, seqlen, self.n_heads, self.head_dim)
        xk = xk.view(bsz, seqlen, self.n_heads, self.head_dim)
        xv = xv.view(bsz, seqlen, self.n_heads, self.head_dim)
        xq = xq.transpose(1, 2)
        xk = xk.transpose(1, 2)
        xv = xv.transpose(1, 2)

        # 注意力计算
        # 计算 QK^T / sqrt(d_k)，维度为 (B, nh, T, hs) x (B, nh, hs, T) -> (B, nh, T, T)
        scores = torch.matmul(xq, xk.transpose(2, 3)) / math.sqrt(self.head_dim)
        # 掩码自注意力必须有注意力掩码
        if self.is_causal:
            assert hasattr(self, 'mask')
            # 这里截取到序列长度，因为有些序列可能比 max_seq_len 短
            scores = scores + self.mask[:, :, :seqlen, :seqlen]
        # 计算 softmax，维度为 (B, nh, T, T)
        scores = F.softmax(scores.float(), dim=-1).type_as(xq)
        # 做 Dropout
        scores = self.attn_dropout(scores)
        # V * Score，维度为(B, nh, T, T) x (B, nh, T, hs) -> (B, nh, T, hs)
        output = torch.matmul(scores, xv)

        # 恢复时间维度并合并头。
        # 将多头的结果拼接起来, 先交换维度为 (B, T, n_head, dim // n_head)，再拼接成 (B, T, n_head * dim // n_head)
        # contiguous 函数用于重新开辟一块新内存存储，因为Pytorch设置先transpose再view会报错，
        # 因为view直接基于底层存储得到，然而transpose并不会改变底层存储，因此需要额外存储
        output = output.transpose(1, 2).contiguous().view(bsz, seqlen, -1)

        # 最终投影回残差流。
        output = self.wo(output)
        output = self.resid_dropout(output)
        return output
```

## 小结

- 注意力机制用 **softmax(QKᵀ/√d_k)·V** 一条公式，实现了"按相关性加权整合信息"；
- **自注意力**让 Q、K、V 同源，建模序列内部依赖；**掩码自注意力**用上三角 Mask 实现"只看历史、不看未来"的并行语言模型训练；
- **多头注意力**用多组投影并行捕捉多种相关关系，是大模型性能的关键来源。

延伸阅读：Encoder/Decoder 的完整结构（前馈网络、层归一化、残差连接、交叉注意力）与可运行的完整 Transformer 实现，见 [happy-llm 第二章 2.2–2.3 节](https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter2/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20Transformer%E6%9E%B6%E6%9E%84.md)；三种架构分流（BERT/GPT/T5）见本模块下一篇《GPT 系列演进》。

---

> **来源**：本文转载自 [第二章 Transformer 架构 · 2.1 注意力机制](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter2/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20Transformer%E6%9E%B6%E6%9E%84.md)，作者 DataWhale happy-llm 项目，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
> 原文 LaTeX 公式已转写为 Unicode 文本；图片改为仓库原始链接。多头注意力的完整 `MultiHeadAttention` 代码保留，依赖的 `ModelArgs` 配置类见[原文](https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter2/%E7%AC%AC%E4%BA%8C%E7%AB%A0%20Transformer%E6%9E%B6%E6%9E%84.md)。
