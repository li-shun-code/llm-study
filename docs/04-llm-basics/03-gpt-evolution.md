---
title: GPT 系列演进
source_url: https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter3/%E7%AC%AC%E4%B8%89%E7%AB%A0%20%E9%A2%84%E8%AE%AD%E7%BB%83%E8%AF%AD%E8%A8%80%E6%A8%A1%E5%9E%8B.md
author: DataWhale happy-llm 项目
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 3
group: 架构地基
---
## 一、Decoder-Only：大模型的基础架构

在前两节中，happy-llm 分别讲解了由 Transformer 发展而来的两种模型架构——以 BERT 为代表的 Encoder-Only 模型和以 T5 为代表的 Encoder-Decoder 模型。很自然可以想见，除了上述两种架构，还可以有一种模型架构——**Decoder-Only**，即只使用 Decoder 堆叠而成的模型。

事实上，Decoder-Only 就是目前 LLM 的基础架构，目前所有的 LLM 基本都是 Decoder-Only 模型（RWKV、Mamba 等非 Transformer 架构除外）。而引发 LLM 热潮的 ChatGPT，正是 Decoder-Only 系列的代表模型 GPT 系列的大成之作。而目前作为开源 LLM 基本架构的 LLaMA 模型，也正是在 GPT 的模型架构基础上优化发展而来。

### 3.1 GPT 的诞生

GPT，即 Generative Pre-Training Language Model，是由 OpenAI 团队于 2018 年发布的预训练语言模型。虽然学界普遍认可 BERT 作为预训练语言模型时代的代表，但**首先明确提出预训练-微调思想的模型其实是 GPT**。GPT 提出了通用预训练的概念：在海量无监督语料上预训练，进而在每个特定任务上进行微调，从而实现这些任务的巨大收益。虽然在发布之初，由于性能略输于不久后发布的 BERT，没能取得轰动性成果，但 OpenAI 团队坚定地选择不断扩大预训练数据、增加模型参数，最终在 2020 年发布的 GPT-3 成就了 LLM 时代的基础，并以 GPT-3 为基座模型的 ChatGPT 成功打开新时代的大门。

## 二、模型架构——Decoder Only

![图：GPT 模型结构](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/3-figures/3-0.png)

**图：GPT 模型结构**（图片来源：happy-llm）

GPT 的整体结构和 BERT 有一些类似，只是相较于 BERT 的 Encoder，选择使用 Decoder 来进行模型结构的堆叠。由于 Decoder-Only 结构天生适用于文本生成任务，相较于更贴合 NLU 任务设计的 BERT，GPT 的模型设计更契合 NLG 任务和 Seq2Seq 任务。对于一个自然语言文本的输入，先通过 tokenizer 进行分词并转化为对应词典序号的 input_ids。

输入的 input_ids 首先通过 Embedding 层，再经过 Positional Embedding 进行位置编码。不同于 BERT 选择可训练的全连接层作为位置编码，GPT 沿用了 Transformer 的经典 Sinusoidal 位置编码（三角函数绝对位置编码）。

编码成 hidden_states 之后进入解码器（Decoder）。第一代 GPT 与原始 Transformer 类似，选择了 12 层解码器层；但在解码器层内部，相较于 Transformer 原始 Decoder 层的双注意力层设计，GPT 的 Decoder 层反而更像 Encoder 层一点——由于不再有 Encoder 的编码输入，**Decoder 层仅保留了一个带掩码的自注意力层**，并且将 LayerNorm 层从注意力层之后提到了注意力层之前（Pre-Norm）。hidden_states 输入 Decoder 层后，先进行 LayerNorm，再进行掩码注意力计算，然后经过残差连接和再一次 LayerNorm 进入 MLP 并得到最后输出。

由于不存在 Encoder 的编码结果，Decoder 层中的掩码注意力也是自注意力计算：对一个输入的 hidden_states，通过三个参数矩阵生成 query、key 和 value，而不再像 Transformer 原始 Decoder 那样由 Encoder 输出作为 key 和 value。注意力计算得到权重之后，通过掩码矩阵遮蔽未来 token 的注意力权重，限制每一个 token 只能关注它之前的 token。

另外一个结构区别在于，GPT 的 MLP 层没有选择线性矩阵而是选择了两个一维卷积核来提取特征——不过从效果上说两者没有太大区别。通过 N 个 Decoder 层后的 hidden_states 最后经过线性矩阵映射到词表维度，转化成自然语言的 token，从而生成目标序列。

## 三、预训练任务——CLM

Decoder-Only 的模型结构往往更适合文本生成任务，因此选择了最传统也最直接的预训练任务——**因果语言模型**（Causal Language Model，CLM）。

CLM 可以看作 N-gram 语言模型的直接扩展：N-gram 基于前 N 个 token 预测下一个 token，CLM 则基于序列的前面所有 token 预测下一个 token，不断重复该过程实现文本生成。也就是说，CLM 是一个经典的补全形式：

```
input: 今天天气
output: 今天天气很

input: 今天天气很
output: 今天天气很好
```

对于一个输入目标序列长度为 256、期待输出序列长度为 256 的任务，模型会不断根据前 256 个 token、257 个 token（输入 + 预测出来的第一个 token）……进行 256 次计算，最后生成一个序列长度为 512 的输出文本，前 256 个 token 为输入，后 256 个 token 就是期待的模型输出。

CLM 天生和人类书写自然语言文本的习惯相契合，也和下游任务直接匹配，可以在任何自然语言文本上直接应用——因此 CLM 可以使用海量的自然语言语料进行大规模预训练。

## 四、GPT-1 → GPT-2 → GPT-3

自 GPT-1 推出开始，OpenAI 一直坚信 Decoder-Only 的模型结构和"体量即正义"的优化思路，不断扩大预训练数据集、模型体量，并对模型做出小的优化和修正。下表总结了从 GPT-1 到 GPT-3 的模型结构、预训练语料大小的变化：

**表：GPT-1 至 GPT-3 规模对比**

| 模型 | Decoder Layer | Hidden_size | 注意力头数 | 注意力维度 | 总参数量 | 预训练语料 |
| ---- | ------------- | ----------- | ---------- | ---------- | -------- | ---------- |
| GPT-1 | 12 | 3072 | 12 | 768 | 0.12B | 5GB |
| GPT-2 | 48 | 6400 | 25 | 1600 | 1.5B | 40GB |
| GPT-3 | 96 | 49152 | 96 | 12288 | 175B | 570GB |

**GPT-1** 是 GPT 系列的开山之作，也是第一个使用 Decoder-Only 的预训练模型。它沿承传统 Transformer 结构，使用 12 层 Decoder Block 和 768 的隐藏层维度，参数量仅 1.17 亿（0.12B），在 5GB 的 BooksCorpus 数据集上预训练。GPT-1 的参数规模与预训练规模和 BERT-base 大致相当，但其表现却有所不如——这也是 GPT 没能成为预训练语言模型时代代表的原因。

**GPT-2** 进一步探究预训练语言模型的多任务学习能力。模型结构和 GPT-1 大致相当，但扩大了参数规模、将 Post-Norm 改为 Pre-Norm（先 LayerNorm 再进入注意力层）——因为层数增加、体量增大后，梯度消失和爆炸的风险不断增加。GPT-2 的 Decoder Block 层数达到 48，隐藏层维度 1600，参数量达 15 亿（1.5B），使用自己抓取的 40GB WebText 数据集预训练，比第一代大了一个数量级。

GPT-2 的另一重大突破是以 **zero-shot（零样本学习）** 为主要目标：不对模型微调，直接通过向模型描述问题来解决问题。但在 GPT-2 时代，模型能力还不足以支撑较好的 zero-shot 效果；到大模型时代，zero-shot 及其延伸出的 few-shot 才逐渐成为主流。

**GPT-3** 展示了 OpenAI"力大砖飞"的核心思路，也是 LLM 的开创之作：参数量达 175B。模型结构上基本没有大改进，只是因体量巨大使用了稀疏注意力机制；预训练数据从 CC、WebText、维基百科等大型语料集采样，共 45T 原始数据、清洗后 570GB。据推算，GPT-3 需要在 1024 张 A100（80GB 显存）的分布式集群上训练 1 个月。

GPT-3 提出了 **few-shot** 的重要思想：在 prompt 中增加 3~5 个示例来帮助模型理解任务，例如情感分类任务：

```
zero-shot：请你判断'这真是一个绝佳的机会'的情感是正向还是负向，如果是正向，输出1；否则输出0

few-shot：请你判断'这真是一个绝佳的机会'的情感是正向还是负向，如果是正向，输出1；否则输出0。
你可以参考以下示例来判断：'你的表现非常好'——1；'太糟糕了'——0；'真是一个好主意'——1。
```

通过给模型提供少量示例，模型可以取得远好于 zero-shot 的表现。few-shot 也被称为**上下文学习**（In-context Learning，ICL）——让模型从上下文中的示例里学习问题的解决方法。GPT-3 在 few-shot 上展现的强大能力，正是 LLM 区别于传统 PLM 的核心优势。

在 GPT 系列模型的基础上，通过引入**预训练 → 指令微调 → 人类反馈强化学习**的三阶段训练（详见本模块《训练范式总览》），OpenAI 发布了跨时代的 ChatGPT，引发了大模型热潮。

## 五、GPT-3 之后：从 ChatGPT 到今天（编者注，2026-09 核实）

以上是 happy-llm 原文内容。从 ChatGPT 到今天，GPT 系列又经历了数代演进——**具体的版本号、发布时间、上下文规格等版本信息，全站统一维护在《主流模型生态对比（2026-09）》一篇（本模块「生态与选型」分组），此处不再重复列表，以免一处更新、两处过时。**

一句话结论：**GPT 系列的主线是"把规模换成的能力，逐步改写成可调节的 API 参数"**——从 GPT-3.5 的对话对齐，到 GPT-4 的多模态与更强推理，再到推理范式独立成线、并最终与常规档位合并进同一个旗舰模型家族，参战维度从"更大"变成"同一模型内可调的思考深度与输出详尽度"。当前在售的分层与模型 ID 请以《主流模型生态对比（2026-09）》为准。

值得学习者注意的几个趋势（细节数字见《主流模型生态对比（2026-09）》）：

- **上下文长度从 2K 走向百万级**：GPT-1 时代上下文仅 512 token，今天的旗舰已达约 100 万 token 量级；但"窗口大小 ≠ 有效利用"，详见本模块《Token 与上下文窗口》与《长上下文的有效利用：Lost in the Middle 与位置偏置》；
- **推理成为独立范式并与主产品线合流**：从"思考后再回答"的专门模型，到如今同一旗舰内部用参数控制思考深度（详见本模块《推理模型（o1/R1 类）》）；
- **API 形态迁移**：工具调用、结构化输出等能力如今只在 Responses API 上提供完整支持，最新旗舰也不再支持自定义 `temperature` / `top_p`（采样控制转向 `reasoning_effort` 与 `verbosity`，详见本模块《采样参数：temperature 与 top_p》）；
- **家族分层而非单点最强**：厂商普遍按"能力 / 时延 / 价格"给出多层模型，选型时应先看任务落在哪一层（分层清单见《主流模型生态对比（2026-09）》）。

对学习者而言，GPT 系列的演进史最重要的启示是：**Decoder-Only + CLM 这一个朴素起点，在"数据、算力、对齐"三个维度持续放大之后，涌现出了通用能力**。这也是理解后续所有开源模型（LLaMA、Qwen、GLM、DeepSeek 等）的坐标系——它们绝大多数都沿承了这一架构路线。而当"放大"撞上不增长的算力预算，这条路线长出的下一分支就是稀疏化：见本模块《MoE 与稀疏注意力：读现代模型卡的先修知识》。

## 参考文献（转自原文及编者补充）

1. Alec Radford, et al. (2018). *Improving Language Understanding by Generative Pre-Training.*（GPT-1）
2. Alec Radford, et al. (2019). *Language Models are Unsupervised Multitask Learners.*（GPT-2）
3. Tom Brown, et al. (2020). *Language Models are Few-Shot Learners.* arXiv:2005.14165.（GPT-3）
4. Long Ouyang, et al. (2022). *Training language models to follow instructions with human feedback.* arXiv:2203.02155.（InstructGPT/ChatGPT）
5. OpenAI Help Center. *Model release notes.* https://help.openai.com/en/articles/9624314-model-release-notes
6. Microsoft Learn. *Azure OpenAI models.* https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models

---

> **来源**：本文转载自 [第三章 预训练语言模型 · 3.3 Decoder-Only PLM（GPT 一节）](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter3/%E7%AC%AC%E4%B8%89%E7%AB%A0%20%E9%A2%84%E8%AE%AD%E7%BB%83%E8%AF%AD%E8%A8%80%E6%A8%A1%E5%9E%8B.md)，作者 DataWhale happy-llm 项目，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
> 第五节"GPT-3 之后：从 ChatGPT 到今天"为本站基于 OpenAI 官方发布信息及 [Microsoft Learn：Azure OpenAI 模型文档](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)（CC BY 4.0）编写的时效性补充；其中的**具体版本号与时间线已统一交由本模块《主流模型生态对比（2026-09）》维护**，本节只保留不随版本更迭而失效的架构与产品形态结论。
