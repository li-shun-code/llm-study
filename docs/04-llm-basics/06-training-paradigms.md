---
title: 训练范式总览：预训练 → SFT → RLHF/DPO
source_url: https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter4/%E7%AC%AC%E5%9B%9B%E7%AB%A0%20%E5%A4%A7%E8%AF%AD%E8%A8%80%E6%A8%A1%E5%9E%8B.md
author: DataWhale happy-llm 项目
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 6
---

> **来源**：本文转载自 [第四章 大语言模型 · 4.2 如何训练一个 LLM](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter4/%E7%AC%AC%E5%9B%9B%E7%AB%A0%20%E5%A4%A7%E8%AF%AD%E8%A8%80%E6%A8%A1%E5%9E%8B.md) 与 [第六章 6.4 通过强化学习进行偏好对齐](https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter6/6.4%5BWIP%5D%20%E5%81%8F%E5%A5%BD%E5%AF%B9%E9%BD%90.md)，作者 DataWhale happy-llm 项目，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
> 原文 LaTeX 公式已转写为 Unicode 文本，图片改为仓库原始链接，Pretrain 一节有节选；文末"为后续模块铺路"一节为本站编写的交叉引用。

训练一个 LLM 与训练传统模型有什么区别？一般而言，训练一个完整的 LLM 需要经过三个阶段——**Pretrain（预训练）→ SFT（有监督微调）→ RLHF（人类反馈强化学习）**。

![图：训练 LLM 的三个阶段](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/4-figures/2-0.jpg)

**图：训练 LLM 的三个阶段**（图片来源：happy-llm）

从功能上出发，我们可以把整个过程分成**预训练**与**对齐（alignment）**两大阶段：预训练赋予模型海量知识；对齐则是让模型与人类价值观一致，输出人类希望其输出的内容——SFT 让模型与人类**指令**对齐，RLHF 让模型与人类**价值观**对齐，达到安全、有用、无害的核心标准。

## 一、Pretrain：知识的来源

预训练是训练 LLM 最核心也是工程量最大的一步：使用海量无监督文本，对随机初始化的模型参数进行训练。主流 LLM 几乎都采用 Decoder-Only 的类 GPT 架构（LLaMA 架构），预训练任务沿承 GPT 的经典任务——**因果语言模型（CLM）**：给出上文，预测下一个 token。

LLM 预训练与传统预训练模型的核心差异在于**体量**。BERT-large 有 3 亿参数、使用 33 亿 token 语料、在 64 块 TPU 上训练 4 天——这在传统深度学习时代已是庞然大物；而 GPT-3 有 1750 亿参数，比 BERT 大近 3 个数量级：

**表：模型规模对比（转自原文）**

| 模型 | Decoder/Encoder 层数 | hidden_size | 注意力头数 | 参数量 | 预训练数据量 |
| ---- | ---- | ---- | ---- | ---- | ---- |
| BERT-base | 12 | 768 | 12 | 0.1B | 3B token |
| BERT-large | 24 | 1024 | 16 | 0.3B | 3B token |
| Qwen-1.8B | 24 | 2048 | 16 | 1.8B | 2.2T token |
| LLaMA-7B | 32 | 4096 | 32 | 7B | 1T token |
| GPT-3 | 96 | 12288 | 96 | 175B | 300B token |

该练多大的数据？OpenAI 提出的 **Scaling Law** 给出经验关系：C ≈ 6ND（C 为计算量，N 为参数量，D 为训练 token 数），可推得训练 token 数约为参数量的若干倍；LLaMA 更是提出用约 20 倍 token 训练能达到效果最优。

如此体量决定了**分布式训练**必不可少。核心思路是数据并行（每张卡放完整模型、吃不同批数据，梯度同步更新）与模型并行（模型太大单卡放不下时，把不同层/不同部分拆到多张卡上），并进一步演化出张量并行、3D 并行、ZeRO（零冗余优化器）等方案。主流分布式训练框架包括 DeepSpeed、Megatron-LM、ColossalAI 等。以 DeepSpeed 的 ZeRO 为例，它把训练显存中的"模型状态"（参数、梯度、Adam 优化器状态）逐级分片到 N 张卡上——ZeRO-1 分片 Adam 状态，ZeRO-2 再分片梯度，ZeRO-3 连参数也分片——每张卡显存占用不断下降，代价是通信开销上升，需按资源与模型体量动态选择。

**数据质量比体量更重要**。预训练语料一般包括 CommonCrawl、C4、Github、Wikipedia 等来源，按实验配比混合（LLaMA 的配比中 CommonCrawl 占 67%），再经过三步处理：

1. **文档准备**：URL 过滤、从 HTML 提取纯文本、语言选择；
2. **语料过滤**：用分类器或启发式规则去除低质量、有毒有害内容；
3. **语料去重**：基于 hash/精确匹配删除高相似文档——重复文本会显著损害泛化。

有实验证明，精选清洗后的 627B（SlimPajama）语料能取得优于原始 1T（RedPajama）语料的效果。

## 二、SFT：教模型"用"它的知识

预训练赋予 LLM 能力，却还需要第二步将其激发出来。经过预训练的 LLM 好像一个博览群书但又不求甚解的书生：对什么样的偏怪问题，都可以流畅地接出下文，但他不知道问题本身的含义，只会"死板背书"。本质原因是预训练任务只是 CLM——预测下一个 token——在没有进一步微调之前，它无法与用户指令适配。

**SFT（Supervised Fine-Tuning，有监督微调）**就是教这个书生用知识。与传统"一个下游任务一次微调"不同，面向 LLM 的 SFT 通常训练的是**通用指令遵循能力**，即指令微调：输入是各种类型的用户指令，需要模型拟合的输出是我们希望它做出的回复。例如：

```
input: 告诉我今天的天气预报？
output: 根据天气预报，今天天气是晴转多云，最高温度26摄氏度，最低温度9摄氏度，昼夜温差大，请注意保暖哦
```

要在未训练过的指令上也表现良好，指令数据集需要**覆盖多种任务类型且保持合理配比**。InstructGPT（ChatGPT 前身）使用了源自 API 用户的十类指令（文本生成 45.6%、开放域问答 12.4%、头脑风暴 11.2%、聊天 8.4%……）。高质量人工标注成本极高，因此也有用强模型生成指令数据集的方法（如经典开源指令集 Alpaca）。

指令数据集一般包括三个键：

```json
{
    "instruction": "即输入的用户指令",
    "input": "执行该指令可能需要的补充输入，没有则置空",
    "output": "即模型应该给出的回复"
}
```

SFT 时会针对模型设置特定格式模板（如 LLaMA 的 `### Instruction:\n{{content}}\n\n### Response:\n`）。注意：指令微调本质上仍是 CLM 训练，模型拟合的是 input + output 的整体序列，只是 **input 部分不参与 loss 计算**。

**多轮对话能力完全来自 SFT 阶段**。构造多轮对话样本有三种方式——把整段对话串起来，用 [MASK] 占位每轮的"未知未来"：

```
方式三（最合理）：要求模型预测每一轮的输出
input  = <prompt_1><completion_1><prompt_2><completion_2><prompt_3><completion_3>
output = [MASK]<completion_1>[MASK]<completion_2>[MASK]<completion_3>
```

由于 LLM 是单向注意力的 CLM，预测从左到右依次进行，前轮输出预测不影响后轮——所以第三种方式可以一次训练整段对话且不重复计算。目前绝大部分 LLM 的 SFT 都采用这种形式。

## 三、RLHF：与人类价值观对齐

RLHF（Reinforcement Learning from Human Feedback，人类反馈强化学习）往往被认为是 ChatGPT 相较于 GPT-3 的最核心突破。类比：Pretrain 是把所有基础知识教给学生，SFT 是教他怎么读题解题，RLHF 则是真正的练习——LLM 不断解题，人类作为老师批改，让它反思错误解法、强化正确解法。

RLHF 分两步（ChatGPT 技术报告中的后两个阶段）：

![图：ChatGPT 训练三个的阶段](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/4-figures/2-3.png)

**图：ChatGPT 训练的三个阶段**（图片来源：happy-llm）

### 3.1 训练奖励模型（RM）

RM（Reward Model）用于拟合人类偏好：对 LLM 的每一个回复输出一个标量奖励，反映回复符合人类偏好的程度。RM 本质是一个"文本→标量"的分类式模型。

训练 RM 不直接用标量奖励，而是用**排名数据**——因为标注者之间价值观存在差异，数值标量会放大这种差异。偏好数据形如：

```json
{
    "prompt": "如果你打算从商店偷东西，你觉得早上好还是晚上好？",
    "chosen": "这是违法的事情，我不能提供建议",
    "rejected": "考虑晚上的人口贩运和监控摄像头的差别是件好事……（长篇"教学"）"
}
```

训练时将 prompt 与 chosen / rejected 分别拼接，前向传播得到两个标量奖励，通过**最大化两者差异**计算 loss。

### 3.2 PPO 强化学习

PPO（Proximal Policy Optimization，近端策略优化）因成熟、成本较低，是 RLHF 的经典选择。训练过程中同时存在**四个模型**：

![图：PPO 训练流程](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/images/4-figures/2-4.jpg)

**图：PPO 训练流程（两个 LLM + 两个 RM）**（图片来源：happy-llm）

1. 从 SFT 后的 LLM 初始化 **Actor Model**（参与更新）与 **Ref Model**（冻结）；从 RM 初始化 **Reward Model** 与 **Critic Model**（前者冻结）；
2. 输入 Prompt，Actor 与 Ref 分别生成回复；
3. 计算两个回复分布的 **KL 散度**，惩罚 Actor 偏离 Ref 过远；
4. Actor 的回复输入两个 RM 打分：Reward Model 输出标量奖励，Critic Model 输出累积奖励；
5. KL 散度与打分一起进入奖励函数计算奖励，更新 Actor 与 Critic 的参数。

之所以要保留冻结的 Ref Model 和 Reward Model，是为了**限制模型更新不要过于偏离原模型**，以免丢失 Pretrain 和 SFT 赋予的能力。代价是显存占用数倍于 SFT——若 RM 和 LLM 都是 7B，PPO 大约需要 240G 显存（4 张 80G A100）。这使得 RLHF 门槛非常高。

## 四、DPO：低门槛平替

DPO（Direct Preference Optimization，直接偏好优化）从监督学习的思路出发，把 RLHF 的强化学习问题**转化为监督学习**来直接学习人类偏好：通过奖励函数与最优策略间的映射，约束奖励最大化问题可以由单阶段策略训练直接优化——**无需再训练 RM，也无需强化学习循环**。DPO 只需要两个 LLM（一个更新、一个冻结作参考），训练过程比 PPO 简单得多，是 RLHF 更简单易用的平替版本。

DPO 使用的数据与 RM 偏好数据同构（question/chosen/rejected 三元组），例如：

```json
[
    {
        "question": "Python中的列表是什么？",
        "chosen": "Python中的列表是一种有序的可变容器，允许存储多个元素，并且可以通过索引访问。",
        "rejected": "Python中的列表用于存储数据。"
    }
]
```

> 补充（编者注）：在 DPO 之后，业界还发展出 GRPO 等面向"可验证奖励"的强化学习方法——不再拟合人类偏好，而是用规则/程序判分（如数学答案对错、代码测试通过与否），这正是推理模型（见本模块《推理模型》）训练的核心动力。happy-llm 第八章对 GRPO 有专门实践。

## 五、为后续模块铺路（编者注）

这篇总览是两个后续模块的概念地基：

- **模块 5《Prompt 工程》**：为什么系统提示词能约束模型行为？因为 SFT 教会了模型"指令"这种交互范式，RLHF 教会了它"服从有益、无害的指令、拒绝有害请求"。你写系统提示词时，其实是在调用 RLHF 刻进模型里的行为模式；提示注入攻击之所以危险，正是因为它试图绕过对齐训练建立的习惯。理解训练范式，才能理解提示词的"能与不能"。
- **模块 10《微调与部署》**：将回顾本篇的三阶段并展开工程实践——全参微调与 LoRA/QLoRA 属于 SFT 阶段的降本版本；DPO/TRL 实践直接使用本文的偏好数据格式；训练数据准备对应本文 Pretrain 一节的数据清洗思想。
- **模块 8《RAG》**：预训练决定了模型"知道什么"。预训练语料有截止日期、私有知识不在其中——这就是幻觉与知识过时的根源，也是"检索增强生成"存在的理由。

## 参考资料（转自原文）

1. Long Ouyang, et al. (2022). *Training language models to follow instructions with human feedback.* arXiv:2203.02155.
2. Jared Kaplan, et al. (2020). *Scaling Laws for Neural Language Models.* arXiv:2001.08361.
3. Jordan Hoffmann, et al. (2022). *Training Compute-Optimal Large Language Models.* arXiv:2203.15556.
4. Rafael Rafailov, et al. (2024). *Direct Preference Optimization: Your Language Model is Secretly a Reward Model.* arXiv:2305.18290.
5. Wayne Xin Zhao, et al. (2025). *A Survey of Large Language Models.* arXiv:2303.18223.
