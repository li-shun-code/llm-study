---
title: 经典论文精读：RAG 与 Lost in the Middle
source_url: https://arxiv.org/abs/2005.11401
author: Patrick Lewis 等（Facebook AI Research / UCL / NYU，RAG 原论文）；Nelson F. Liu 等（Stanford 等，Lost in the Middle）
license: arXiv 预印本署名转载（两文均按 arXiv 页面所列许可引用，译文为教学用途节选与改写）
fetched_at: 2026-09-19
translated: true
versions: arXiv:2005.11401v4（2021-04-12）；arXiv:2307.03172v3（2023-11-20，TACL 2023 版）
order: 19
group: 进阶范式
---
工程文章给的是"怎么做"，论文给的是"这些做法原来是被什么实验逼出来的"。本篇精读两篇对 RAG 工程影响最直接的论文：**RAG 原论文**（解释了"检索 + 生成"为什么可以端到端训练、为什么换索引就能更新知识）与 **Lost in the Middle**（解释了"top-k 越大越好"这个直觉为什么会错，以及重排、上下文组装顺序为什么值得做）。

阅读方法：每篇先拆**问题设定 → 方法 → 关键实验数字 → 对本工程决策的启示**。数字全部取自论文原文（arXiv 全文版），引用处标了表号/图号，便于回查。

## 一、RAG：把非参数记忆接进生成模型

> 以下内容译自/引自 Patrick Lewis 等《Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks》（arXiv:2005.11401，Facebook AI Research、UCL、NYU）。

### 1.1 它要解决的不是"幻觉"这个词，而是三件具体的事

论文的出发点很克制（摘要原文）：大模型把事实存在参数里，但在知识密集型任务上**落后于专门架构**，而且有两个未解问题——**给出结论的来源（provenance）** 与 **更新世界知识**。作者把这三件事统一成一个可训练结构：

> "models which combine pre-trained parametric and non-parametric memory for language generation"（把预训练的**参数化记忆**与**非参数化记忆**结合起来做语言生成）

对照今天的说法：参数化记忆 = 模型权重，非参数化记忆 = 外部索引。当时（2020）大部分"加外部知识"的工作只在抽取式任务上试过（T5、REALM、ORQA 这一系），RAG 的贡献是给出一个**通用微调配方**，任意 seq2seq 任务都能套。

### 1.2 方法：DPR 检索器 + BART 生成器，检索文档当隐变量

组件（论文 §2）：

| 组件 | 论文里的选择 | 工程对应物 |
| --- | --- | --- |
| 非参数记忆 | 2018-12 的 Wikipedia dump，切成**互不重叠的 100 词块**，共 **2100 万** 篇；用文档编码器算向量，FAISS 建 MIPS 索引，近似用 HNSW | 语料切块 + 嵌入模型 + 向量库 |
| 检索器 z|x | DPR（双编码器），按内积取 top-K | 稠密检索 |
| 生成器 y|x,z | BART-large | 生成侧 LLM |

真正值得精读的是**训练设定**。论文把检索到的文档当**隐变量**，对整条生成序列的似然做边际化：

- **RAG-Sequence**：整段生成**共用同一篇**文档（先对文档求边际，再按序列生成）；
- **RAG-Token**：**每个 token 可以换一篇**文档（逐 token 边际化），因此能把多篇文档的内容拼进同一句答案。

两种都是 top-K 近似。这个区分today的对应物是"一次给一篇还是给多篇"——今天绝大多数 RAG 系统实际上在做 RAG-Token 的离散版：把 top-K 篇一次性塞进 prompt，让模型自由引用。

**联合训练但不碰索引**（§2.4）是这篇论文最有工程味的一段：

> "Updating the document encoder during training is costly as it requires the document index to be periodically updated... We do not find this step necessary for strong performance, and keep the document encoder (and index) fixed, only fine-tuning the query encoder and the BART generator."

即：训练时**只微调查询编码器与生成器**，文档编码器与索引**冻结**。这就是今天"微调 embedding 只训 query 侧 / 或者只训 projection"这条实践路线的来源。

成本参考（附录 C）：训练用 8×32GB V100；索引放 CPU 即可，2100 万篇 Wikipedia 向量约 **100GB CPU 内存**，MIPS 在 CPU 上就够快。

### 1.3 关键实验数字：结论比"排名第一"更有用

**开放域 QA（Table 1，测试集 Exact Match）**：

| 模型 | NQ | TriviaQA(Wiki) | WebQuestions | CuratedTrec |
| --- | --- | --- | --- | --- |
| T5-11B（闭卷） | 34.5 | 50.1 | 37.4 | — |
| T5-11B+SSM（闭卷+检索微调） | 36.6 | 60.5 | 44.7 | — |
| REALM | 40.4 | — | 40.7 | 46.8 |
| DPR（抽取式） | 41.5 | 57.9 | 41.1 | 50.6 |
| RAG-Token | 44.1 | 66.1 | 45.5 | 50.0 |
| RAG-Sequence | **44.5** | **68.0** | **45.2** | **52.2** |

三个可读出来的结论：

1. **生成式（ unconstrained generation）打赢了抽取式**：DPR+抽取头是 41.5，RAG 生成式 44.5。论文特意强调"尽管这些是抽取式任务，无约束生成仍然更好"——这是当年反直觉的一点。
2. **检索质量决定上限**：同一个 BART，喂 REALM/DPR/RAG 三种检索机制，分数逐级上抬。
3. **RAG-Sequence 与 RAG-Token 各有胜负**：QA 类任务 Seq 略好，需要跨文档拼信息的 Jeopardy 问答生成上 Token 更好（§4.3，因为一句答案可以合并多篇文档的内容）。

**检索消融（Table 6，dev 集 NQ 的 EM）**，这组数字对今天做 RAG 的人最有用：

| 检索器配置 | NQ | 说明 |
| --- | --- | --- |
| RAG-Token-BM25 | 29.7 | 把 DPR 换成 BM25，NQ 大幅掉分 |
| RAG-Token-Frozen | 37.8 | 冻结检索器（不做端到端训练） |
| RAG-Token | 43.5 | 端到端联合训练 |
| RAG-Sequence-Frozen | 41.2 | 冻结版 Seq |
| RAG-Sequence | 44.0 | 联合训练版 Seq |

- **联合检索器带来 5.7 分（37.8 → 43.5）**：说明"检索器与生成器各训各的"是有实打实损失的。今天没有 GPU 预算去端到端训练时，替代路径是把领域 query 对拿去做**嵌入微调**（见《Embedding 模型选型：四轴决策与本地实测》与《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》里的自有评测集），本质是在补同一笔损失。
- **但 FEVER 是反例**：论文原话——"For FEVER, BM25 performs best, perhaps since FEVER claims are heavily entity-centric and thus well-suited for word overlap-based retrieval." 事实核查类（claim 里全是实体与编号）词法检索更强。这正是《混合检索：真正的 BM25、RRF 融合与生产实现》要留 BM25 的论文级依据。

**人类评测（Table 4，452 组 BART vs RAG-Token 生成对比）**：标注员认为 **BART 更"有事实依据"的只占 7.1%**，RAG 更占 **42.7%**，两者都算事实正确的 17%；在"具体性（specificity）"上 RAG 大幅领先。多样性（§4.5，distinct n-gram 比）上 RAG-Sequence > RAG-Token > BART，且**不需要任何多样性解码技巧**。

**知识更新实验（§4.4，"Index hot-swapping"）**：用 2016-12 与 2018-12 两个 Wikipedia 快照建两份索引，拿"Who is {职位}?"去问各国领导人：

| 索引 / 提问时点 | 正确率 |
| --- | --- |
| 2016 索引 / 问 2016 年在职者 | 70% |
| 2018 索引 / 问 2018 年在职者 | 68% |
| 2018 索引 / 问 2016 年在职者（错配） | 12% |
| 2016 索引 / 问 2018 年在职者（错配） | 4% |

这组数字是双重启示：**换索引就等于换知识**（不用重训），同时也说明**模型本身并不真的"记得"这些事实**——索引一错配，正确率直接跌到 12%/4%。做生产 RAG 时，这提醒我们：答案的可信度取决于**索引的时效与一致性**，而不是模型的名气。

**取多少篇（§4.5 "Effect of Retrieving more documents"）**：训练时用 5 篇或 10 篇，性能无显著差异；测试时 RAG-Sequence 随 K 增大**单调**变好，RAG-Token 在 K=10 附近**见顶**（Figure 3）。也就是说 2020 年就已经观察到"多喂文档有边际收益，且与生成方式有关"。三年后 Lost in the Middle 把这条曲线的原因讲清楚了。

## 二、Lost in the Middle：长上下文的利用率是一根 U 形曲线

> 以下内容译自/引自 Nelson F. Liu 等《Lost in the Middle: How Language Models Use Long Contexts》（arXiv:2307.03172，TACL 2023）。

### 2.1 问题设定：不测"能不能塞进去"，测"位置变了会不会掉分"

论文的核心批评是：各家宣传的上下文窗口长度只说明**能塞**，不说明**会用**。于是设计两个可控任务：

1. **多文档问答**：NaturalQuestions-Open 中取"长答案是段落"的 **2655 条**查询；用 Contriever（在 MS-MARCO 上微调过）从 Wikipedia 取 top 文档当干扰项，**按相关度降序**放入上下文；再通过调整顺序把**真正含答案的那篇**放到开头/中间/结尾（§2，脚注 4：把干扰项改成随机顺序并在 prompt 里说明"顺序随机"，趋势不变——不是"搜索结果按相关度排列"的先验造成的）。
2. **合成 key-value 检索**：上下文是一串 JSON，key 与 value 都是随机 128-bit UUID，要求返回指定 key 的 value。这是"从输入里精确捞出匹配 token"的最小测试台。

变量只有两个：**上下文长度**（文档条数 / JSON 对数）与**相关信息的位置**。指标沿用 Kandpal 等与 Mallen 等的做法：答案是否出现在输出里（accuracy）。

### 2.2 结论一：U 形曲线，中间是最差的坑

摘要与 Figure 1 的表述：性能在相关信息位于**开头（primacy bias，首因偏好）**或**结尾（recency bias，近因偏好）**时最高，**位于中间时显著下降**——即使对显式的长上下文模型也一样。

最扎心的一组数（§1、§2.3）：

> 当相关信息被放到中间位置时，GPT-3.5-Turbo 在多文档 QA 上的表现**低于它完全不看文档的闭卷表现**（闭卷基线为 **56.1%**）。

也就是说：错误位置的上下文**是负收益**，它不如不给。这条对 prompt 组装是硬约束。

合成 key-value 任务（§3）给出同样的 U 形：一部分模型 100% 正确，另一部分连"捞出中间位置的 UUID"都做不稳。

### 2.3 结论二：更大的窗口不会自动修好这件事

- 在长度同时能塞进"基础版"与"加长版"窗口的设置下（例如 10 篇、20 篇都塞得下 GPT-3.5-Turbo 与 GPT-3.5-Turbo-16K），两条曲线**几乎重合**（Figure 5）。→ 加长窗口 ≠ 用得更长。
- 模型规模（附录 E，Llama-2 7B/13B/70B）：**7B 只有近因偏好**，13B 与 70B 才出现 U 形；SFT/RLHF 会轻微缓解小模型的位置偏好。→ 小模型不是"没这个问题"，是"另一种偏置"。
- 编码器-解码器模型（Figure 8，Flan-UL2 / Flan-T5-XXL）：在**不超过训练时窗口**（2048 / 512 token）时，最好与最差位置差距仅 **1.9 个百分点**；一旦超出训练窗口就开始出现 U 形塌陷。→ 位置稳健性与"训练时见过的长度"强相关，而不是宣传的窗口数字。

### 2.4 结论三：端到端上加文档，收益早就饱和了（§5）

用 Contriever 检索 Wikipedia 回答 NaturalQuestions-Open，同时画**检索器 recall** 与**阅读器 accuracy** 随取回文档数的曲线：

> "model performance saturates long before retriever recall saturates"——**阅读器性能在检索召回率饱和之前就已经饱和**。
> 用 50 篇替代 20 篇，GPT-3.5-Turbo 只提升 **1.5%**，Claude-1.3 只提升 **1%**。

论文的结论句也值得抄进设计文档：要宣称一个模型"能稳健利用长上下文"，必须展示**相关信息放在最好位置与最差位置时的性能差很小**——而不是只给一个"支持 128K"。

## 三、把两篇论文合起来读：对本模块工程决策的直接指向

| 你正在做的决策 | 论文给的依据 | 本站落地篇 |
| --- | --- | --- |
| 初检取多少篇、重排后送几篇 | LiTM：50 篇比 20 篇只涨 1-1.5%，但位置错放会掉到闭卷以下；RAG：RAG-Token 在 K=10 见顶 | 《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》《重排序：Cross-Encoder 精排与 LLM 打分成本对照》 |
| 送进 prompt 的文档要不要排序 | LiTM 的 U 形：把**最相关的放结尾、次相关的放开头**是可行策略（两端最好读）；中间是坑位 | 《重排序：Cross-Encoder 精排与 LLM 打分成本对照》 |
| 分块要多大、长文档怎么切 | RAG 用互不重叠 100 词块；LiTM：超过训练窗口的长度会让位置塌陷 | 《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《句子窗口与父子块检索：用小块召回、大块作答》 |
| 要不要留 BM25 | RAG 的 FEVER 消融：实体密集任务 BM25 最好；但 NQ 上 BM25 版比 DPR 版低 14 分 | 《混合检索：真正的 BM25、RRF 融合与生产实现》 |
| 知识变了怎么办 | RAG：换索引即换知识，错配索引正确率跌到 12%/4% | 《元数据过滤与多维过滤检索》《生产化 RAG：可靠管线与常见问题排查》 |
| 检索器要不要一起训 | RAG：端到端联合训练带来 37.8 → 43.5 的涨幅 | 《Embedding 模型选型：四轴决策与本地实测》（先选型，再谈微调） |
| 长文档问答为什么不如"小块 + 多跳" | LiTM：模型对中段信息利用率低，长文档中间段落等于藏起来 | 《多向量检索与 ColBERT/ColPali：后期交互的用法与选型》《Agentic RAG：让检索自己判断"够不够、要不要换工具"》 |

## 常见坑

1. **把 RAG 论文当"prompt 教程"读**。2020 年的 RAG 是**可微检索 + 端到端微调**的模型结构，和今天"检索拼 prompt"的 RAG 共享思想但不共享实现；照抄它的结构（例如指望检索器与生成器天然对齐）会得到错觉。真正可迁移的是三件事：文档当隐变量的边际化思想、索引冻结、索引可替换。
2. **只引用 LiTM 的"U 形"结论，不引用它的实验条件**。它的干扰项是**同一查询检索出的相邻相关度文档**，不是随机长文；把 50 篇无关文档塞满上下文，测到的多半是"噪声导致的退化"，与位置效应混在一起。要复现请照抄它的可控设定：固定内容，只改位置。
3. **用"闭卷 56.1%"去否定检索**。它否定的是"错误位置的上下文"，不是上下文本身。
4. **拿两篇 2020-2023 的结论去否定 2026 年的模型**。这两篇论文的模型（GPT-3.5-Turbo-16K、Claude-1.3、Llama-2、Flan-UL2）确实老。但结论里**最难被时间冲掉的是"位置有偏置"这一形状**：新模型可以把 U 形压平、把饱和点后移，但只要曲线还有单调段，"top-k 越大越好"就不成立。做法：把它当**待验证假设**，在你自己的评测集上重跑一次"同一篇文档放头/中/尾"的三点实验（代码可复用《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》那篇的评测脚本与《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》的端到端评估）。
5. **忽略"错配索引"这类静默失败**。RAG 的索引实验说明：知识与检索源脱钩时，模型不会拒绝回答，只会照旧生成。生产上等价故障是"上线了旧索引 / 灰度期间两份索引混查 / 元数据里 `updated_at` 没参与过滤"。
6. **只看论文第一名**。榜单与论文都偏端到端指标，工程上真正决定体验的是 §3 表格里那几行"你的决策"。

## 延伸阅读

- RAG 原论文配套开源实现（HuggingFace `facebook-retrieval` / `transformers` 中的 RAG 模型类），可看到"索引可替换"在代码里就是一个 `update_corpus` 调用。
- DPR（arXiv:2004.04906）：双编码器检索器与负例构造，RAG 的检索侧基础。
- REALM（arXiv:2002.08909）：把 wiki 检索当作 MLM 填空的"先检索再填空"路线，RAG 的对照系。
- Lost in the Middle 配套代码与数据（作者主页发布）：多文档 QA 与 key-value 检索的可复现实验。
- Contriever（arXiv:2112.09118）、Kandpal 等《Efficiently Retrieving Good Documents》、Mallen 等《When Not to Trust Language Models》：LiTM 的三条前置工作，讲"检索器质量决定上限"。
- 本站相关：《什么是 RAG：检索增强生成入门》《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《混合检索：真正的 BM25、RRF 融合与生产实现》《重排序：Cross-Encoder 精排与 LLM 打分成本对照》《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》。

---

> **来源**：抓取于 2026-09-19。本篇为 arXiv 预印本的**中文节选精读与改写**：[Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401)（Patrick Lewis, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela；Facebook AI Research / UCL / NYU；v4 2021-04-12）与 [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)（Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang；v3 2023-11-20，TACL 2023）。两文均以 arXiv 页面所列许可公开分发，本站仅作教学节选、公式与表格重排，未主张原作所有权。
> 编者注：所有表内数字（Table 1/2/4/6、Figure 3/5/8、索引热替换 70%/68%/12%/4%、闭卷 56.1%、50 篇对 20 篇的 1.5%/1%、Flan-UL2 的 1.9%）取自上述两篇论文的 arXiv 全文版，按原文表格与正文表述核对；"对本模块工程决策的启示"一节与"常见坑"一节为本站编者归纳，不属于原作内容。论文中的模型均为 2020—2023 年版本，用于指导 2026 年选型时应先在自有评测集上复测。
