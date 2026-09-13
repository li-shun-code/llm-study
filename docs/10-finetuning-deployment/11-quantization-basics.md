---
title: 模型量化基础：从 FP16 到 4-bit，部署侧量化怎么选
source_url: https://huggingface.co/docs/peft/developer_guides/quantization
author: Hugging Face（PEFT 文档）、bitsandbytes、vLLM 文档
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 11
versions: bitsandbytes（2026-09）/ vLLM（V1 引擎，2026-09 文档）
---

量化（Quantization）是用更少的比特表示模型参数的压缩技术：代价是精度，换来的是更小的显存占用与更高的推理吞吐。本篇讲清楚三件事：量化的基本原理与精度格式、训练侧量化（QLoRA 一族）如何工作、部署侧量化格式（GPTQ/AWQ/GGUF/FP8）怎么选。

## 量化为什么可行

神经网络权重大多集中在较窄的数值范围内，直接存储每个 32-bit 浮点数是"浪费"的。量化做的事是把高精度浮点映射到低位宽表示（8-bit 整数、4-bit 浮点/整数……），映射规则（scale/zero-point，分组粒度）决定了精度损失大小。对 LLM 的经验结论是：**8-bit 几乎无损；4-bit 有轻微损失但可接受；2-bit 以下开始明显掉点**。

::: tip 编者注：常见精度格式速查
- **FP32**：单精度浮点，训练主权重的基准格式，每参数 4 字节。
- **FP16 / BF16**：半精度浮点，每参数 2 字节。BF16 指数位与 FP32 相同、不易溢出，是现代 GPU 训练/推理的默认选择。
- **INT8**：8-bit 整数，每参数 1 字节，配合 per-channel/per-block 缩放可近似无损。
- **FP8**（E4M3/E5M2）：8-bit 浮点，Hopper 及之后 GPU 的原生格式，推理与训练都在快速普及。
- **INT4 / NF4 / 4-bit 浮点**：每参数约 0.5 字节，7B 模型 3–4 GB 即可装下。
:::

## 训练侧量化：bitsandbytes 与 QLoRA

[bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) 通过 k-bit 量化让大语言模型训练与推理触手可及，三大特性：

- **8-bit 优化器**：分块量化（Block-wise Quantization）保持 32-bit 优化器性能，显存代价极小。
- **LLM.int8()**：8-bit 推理，所需内存减半且无性能下降——基于向量级量化，把大多数特征量化到 8-bit，**离群值（Outliers）单独用 16-bit 矩阵乘法**处理。
- **QLoRA**：把模型量化到 4-bit，再插入少量可训练的 LoRA 权重进行训练，配合多种省显存技巧而不牺牲性能。

库内提供 `bitsandbytes.nn.Linear8bitLt`、`bitsandbytes.nn.Linear4bit` 算子与 `bitsandbytes.optim` 8-bit 优化器模块。要求 Python 3.10+、PyTorch 2.4+；支持 NVIDIA（SM60+，推荐 SM75+）、AMD、Intel GPU 与 CPU 后端。

为什么量化后的模型"不能直接训练"却可以 QLoRA？PEFT 文档的解释：模型量化后通常不会再继续针对下游任务训练——权重与激活的低精度会让训练不稳定。但 **PEFT 方法只添加"额外的"可训练参数**，于是可以在量化模型之上训练 LoRA 适配器：4-bit 量化的 NF4 数据类型（专为正态分布权重设计）+ 双重量化（对量化常数再量化）+ bf16 计算精度，训练只更新 LoRA 参数。完整配置流程见 [QLoRA 与显存优化](./05-qlora-memory-optimization)。

除 bitsandbytes 外，GPTQ（逐行量化）、AQLM（低至 2-bit）、HQQ（免校准、量化快）、EETQ、torchao、Intel INC（FP8）等方案也可与 LoRA 组合训练，详见 PEFT 量化指南。

## 部署侧量化：vLLM 支持的格式全景

推理部署侧的量化目标不同：不是"省训练显存"，而是**在精度可接受的前提下降低服务显存与带宽、提高吞吐**。vLLM 是部署侧量化的最佳观察窗口，其文档开宗明义：

> 量化以模型精度换取更小的内存占用，让大模型得以在更广泛的设备上运行。

vLLM（V1 引擎）当前支持的量化格式包括：

- **LLM Compressor**（vLLM 官方优化工具链）：FP8 W8A8、INT4 W4A16、INT8 W4A8、INT8 W8A8 等格式
- **AutoAWQ**（AWQ：激活感知权重量化）
- **GPTQModel**（GPTQ 及后续变体）
- **bitsandbytes**（与训练侧同一套 8/4-bit 方案）
- **NVIDIA Model Optimizer（ModelOpt）**、**AMD Quark**、**Intel Neural Compressor**、**TorchAO**
- **在线量化（Online Quantization）** 与 **量化 KV Cache**（对注意力的 K/V 缓存单独量化，成倍扩大可服务上下文）
- **GGUF**（llama.cpp 生态格式）

**表：vLLM 量化实现 × 硬件兼容性（官方文档）**

| 实现 | Volta | Turing | Ampere | Ada | Hopper | AMD GPU | Intel GPU | x86 CPU | Arm CPU |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AWQ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| GPTQ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Marlin (GPTQ/AWQ/FP8/FP4) | ❌ | ✅* | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| llm-compressor INT8 (W8A8) | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| llm-compressor FP8 (W8A8) | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| bitsandbytes | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| GGUF | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

注：Volta=SM7.0、Turing=SM7.5、Ampere=SM8.0/8.6、Ada=SM8.9、Hopper=SM9.0；\* Turing 不支持 Marlin MXFP4；该表随 vLLM 演进持续更新，以官方文档为准。

### 部署格式怎么选（编者注）

- **有 Hopper（H100/H20）及更新显卡**：优先 **FP8（W8A8）**——硬件原生支持、精度损失最小、KV Cache 也可 FP8，是当前大模型服务的主力格式。
- **Ampere/Ada（A100/3090/4090）**：优先 **GPTQ / AWQ 4-bit**（生态最成熟、社区预量化模型最多）或 **INT8 W8A8**（精度更稳、显存减半）。
- **CPU / 边缘 / Mac 本地**：**GGUF**（llama.cpp/Ollama 生态，Q4_K_M 等混合精度格式在质量与体积间平衡最好）。
- **手头只有 HF 权重、懒得找预量化版**：用 **LLM Compressor** 离线量化成 FP8/INT8/INT4 再部署，vLLM 官方推荐。

命名约定 `WxAy`：W=权重位宽、A=激活位宽。W8A8 即权重与激活都 8-bit（需要硬件支持 8-bit 矩阵乘），W4A16 即只量化权重、激活保持 16-bit（兼容性最好）。

## 训练侧 vs 部署侧（编者注）

| 维度 | 训练侧量化（QLoRA） | 部署侧量化（GPTQ/AWQ/FP8/GGUF） |
| --- | --- | --- |
| 量化对象 | 底座权重（冻结） | 全部权重（可含激活/KV Cache） |
| 是否更新量化权重 | 否，只更新 LoRA 旁路 | 否，量化后即推理 |
| 主要工具 | bitsandbytes + PEFT/TRL | LLM Compressor、AutoAWQ、GPTQModel、llama.cpp |
| 精度敏感点 | NF4 + 双重量化 + LoftQ 初始化 | 校准数据集质量、分组大小（group_size） |
| 典型收益 | 7B 单卡 16GB 可训 | 7B 单卡 8GB 可跑，吞吐翻倍 |

两条流水线可以在一个项目里串联：QLoRA 训出适配器 → 合并/或分别部署 → 用 LLM Compressor 量化成 FP8/INT4 → vLLM 服务化（见 [vLLM 高吞吐部署](./14-vllm-high-throughput-deployment)）。

## 小结

- 量化 = 低比特表示 + 缩放策略；LLM 场景 8-bit 近无损、4-bit 轻微损失、2-bit 以下慎用。
- 训练侧 QLoRA 的本质是"量化底座只当特征提取器，LoRA 旁路负责学习"。
- 部署侧按硬件选格式：Hopper+ 用 FP8，Ampere 用 GPTQ/AWQ/INT8，CPU/边缘用 GGUF。
- WxAy 命名与硬件兼容表是选型的第一道过滤。

---

> **来源**：本文第一、二部分翻译自 [bitsandbytes README](https://github.com/bitsandbytes-foundation/bitsandbytes) 与 [PEFT 文档 Quantization 指南](https://huggingface.co/docs/peft/developer_guides/quantization)（作者 Hugging Face / bitsandbytes 团队，许可 Apache 2.0）；第三部分翻译自 [vLLM 文档 Quantization](https://docs.vllm.ai/en/latest/features/quantization/)（vLLM 项目，许可 Apache 2.0）。抓取于 2026-09-13。编者补充内容均已标注。
