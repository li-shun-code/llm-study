---
title: 模型量化基础：Transformers 量化总览与 bitsandbytes
source_url: https://huggingface.co/docs/transformers/quantization/overview
author: Hugging Face（Transformers 官方文档）、bitsandbytes-foundation（bitsandbytes 官方 README）
license: Apache 2.0（Transformers 文档）、MIT（bitsandbytes）
fetched_at: 2026-09-13
translated: true
versions: Transformers 主分支文档（2026-09）；bitsandbytes 当前开发分支 README
order: 15
group: 量化与推理原理
---
本篇正文完整译自两份一手文档——Hugging Face Transformers 官方文档的量化总览页（含量化方法选型表）与 bitsandbytes 官方 README（含平台支持矩阵）。两节之后另有一节**编者补充的"量化方案怎么选"决策表**（场景 → 方案 → 显存/精度代价），其判据来自上述官方矩阵与 vLLM 现行量化参数表，已显式标注。文末逐节署名。

# 量化总览（译自 Transformers 官方文档 Quantization Overview）

量化（Quantization）通过以更低精度存储权重来降低加载与使用模型的内存需求，同时尽可能保持准确率。权重通常以全精度（fp32）浮点表示存储，但鉴于当今模型的庞大体积，半精度（fp16 或 bf16）日益流行。部分量化方法还能进一步降到整数表示，如 int8 或 int4。

Transformers 支持多种量化方法，各有优劣，你可以为具体用例选择最合适的一种。有些方法需要校准（calibration）来获得更高精度与极限压缩（1–2 bit），另一些方法开箱即用、支持即时（on-the-fly）量化。

根据你的硬件与目标位宽，参考下表选择量化方法：

| 量化方法 | 即时量化 | CPU | CUDA GPU | ROCm GPU | Metal (Apple Silicon) | Intel GPU | torch.compile() | 位宽 | PEFT 微调 | 可被 🤗Transformers 序列化 | 🤗Transformers 支持 | 库链接 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [AQLM](https://huggingface.co/docs/transformers/quantization/aqlm) | 🔴 | 🟢 | 🟢 | 🔴 | 🔴 | 🟢 | 🟢 | 1/2 | 🟢 | 🟢 | 🟢 | [Vahe1994/AQLM](https://github.com/Vahe1994/AQLM) |
| [AutoRound](https://huggingface.co/docs/transformers/quantization/auto_round) | 🔴 | 🟢 | 🟢 | 🔴 | 🔴 | 🟢 | 🔴 | 2/3/4/8 | 🔴 | 🟢 | 🟢 | [intel/auto-round](https://github.com/intel/auto-round) |
| [AWQ](https://huggingface.co/docs/transformers/quantization/awq) | 🔴 | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | ? | 4 | 🟢 | 🟢 | 🟢 | [casper-hansen/AutoAWQ](https://github.com/casper-hansen/AutoAWQ) |
| [bitsandbytes](https://huggingface.co/docs/transformers/quantization/bitsandbytes) | 🟢 | 🟢 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 | 4/8 | 🟢 | 🟢 | 🟢 | [bitsandbytes-foundation/bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) |
| [compressed-tensors](https://huggingface.co/docs/transformers/quantization/compressed_tensors) | 🔴 | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🔴 | 1/8 | 🟢 | 🟢 | 🟢 | [neuralmagic/compressed-tensors](https://github.com/neuralmagic/compressed-tensors) |
| [EETQ](https://huggingface.co/docs/transformers/quantization/eetq) | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 | ? | 8 | 🟢 | 🟢 | 🟢 | [NetEase-FuXi/EETQ](https://github.com/NetEase-FuXi/EETQ) |
| [Four Over Six](https://huggingface.co/docs/transformers/quantization/fouroversix) | 🟢 | 🟢 | 🟢 | 🔴 | 🔴 | 🔴 | 🟢 | 4 | 🔴 | 🟢 | 🟢 | [mit-han-lab/fouroversix](https://github.com/mit-han-lab/fouroversix) |
| [FP-Quant](https://huggingface.co/docs/transformers/quantization/fp_quant) | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 | 🟢 | 4 | 🔴 | 🟢 | 🟢 | [IST-DASLab/FP-Quant](https://github.com/IST-DASLab/FP-Quant) |
| [GGUF / GGML (llama.cpp)](https://huggingface.co/docs/transformers/quantization/gguf) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 1/8 | 🔴 | 🔴 | 见文档 Notes | [ggerganov/llama.cpp](https://github.com/ggerganov/llama.cpp) |
| [GPT-QModel](https://huggingface.co/docs/transformers/quantization/gptq) | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 | 2/3/4/8 | 🟢 | 🟢 | 🟢 | [ModelCloud/GPTQModel](https://github.com/ModelCloud/GPTQModel) |
| [HIGGS](https://huggingface.co/docs/transformers/quantization/higgs) | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 | 🟢 | 2/4 | 🔴 | 🟢 | 🟢 | [HanGuo97/flute](https://github.com/HanGuo97/flute) |
| [HQQ](https://huggingface.co/docs/transformers/quantization/hqq) | 🟢 | 🟢 | 🟢 | 🔴 | 🔴 | 🟢 | 🟢 | 1/8 | 🟢 | 🔴 | 🟢 | [mobiusml/hqq](https://github.com/mobiusml/hqq/) |
| [Metal](https://huggingface.co/docs/transformers/quantization/metal) | 🟢 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 2/4/8 | 🔴 | 🟢 | 🟢 | [Hub Kernels（mlx 量化内核）](https://huggingface.co/kernels-community/mlx-quantization-metal-kernels) |
| [NVFP4](https://huggingface.co/docs/transformers/quantization/nvfp4) | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 | 🟢 | 4 | 🔴 | 🔴 | 🟢 | [Hub Kernels（nvfp4-gemm）](https://huggingface.co/kernels-community/nvfp4-gemm) |
| [optimum-quanto](https://huggingface.co/docs/transformers/quantization/quanto) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 2/4/8 | 🔴 | 🔴 | 🟢 | [huggingface/optimum-quanto](https://github.com/huggingface/optimum-quanto) |
| [SINQ](https://huggingface.co/docs/transformers/quantization/sinq) | 🟢 | 🟢 | 🟢 | 🟡 | 🟡 | 🟡 | 🟡 | 2/3/4/6/8 | 🔴 | 🟢 | 🟢 | [huawei-csl/SINQ](https://github.com/huawei-csl/SINQ) |
| [FBGEMM_FP8](https://huggingface.co/docs/transformers/quantization/fbgemm_fp8) | 🟢 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 8 | 🔴 | 🟢 | 🟢 | [pytorch/FBGEMM](https://github.com/pytorch/FBGEMM) |
| [torchao](https://huggingface.co/docs/transformers/quantization/torchao) | 🟢 | 🟢 | 🟢 | 🔴 | 🟡 | 🟢 | — | 4/8 | — | 🟢🔴 | 🟢 | [pytorch/ao](https://github.com/pytorch/ao) |
| [VPTQ](https://huggingface.co/docs/transformers/quantization/vptq) | 🔴 | 🔴 | 🟢 | 🟡 | 🔴 | 🔴 | 🟢 | 1/8 | 🔴 | 🟢 | 🟢 | [microsoft/VPTQ](https://github.com/microsoft/VPTQ) |
| [SpQR](https://huggingface.co/docs/transformers/quantization/spqr) | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 | 🟢 | 3 | 🔴 | 🟢 | 🟢 | [Vahe1994/SpQR](https://github.com/Vahe1994/SpQR/) |
| [Quark](https://huggingface.co/docs/transformers/quantization/quark) | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | ? | 2/4/6/8/9/16 | 🔴 | 🔴 | 🟢 | [AMD Quark 文档](https://quark.docs.amd.com/latest/) |

（表中标记：🟢 支持 / 🔴 不支持 / 🟡 部分支持 / ? 待确认。每行"位宽"列即该方法的量化比特数选项；"PEFT 微调"列指示能否在量化模型上继续做 LoRA 类微调——QLoRA 工作流的选型依据。）

## 量化方案怎么选：场景 → 方案 → 显存/精度代价（编者补充）

上面那张官方大表回答的是"这个库能不能用在我的卡上"，回答不了"我这个活儿该选哪个"。下面这张表按**场景**给结论。三条通用换算规则先立住，比背表格有用：

- **权重显存 ≈ 参数量 × 位宽 / 8（字节）**。7B 模型 bf16 约 14 GB、int8 约 7 GB、int4 约 3.5 GB；再叠加 KV cache（见[推理原理](./16-inference-principles)），才是总占用。
- **精度代价的经验排序**：同等位宽下 `FP8 > INT8` 通常更稳（浮点格式保动态范围）；weight-only INT4 是"性价比拐点"，多数任务困惑度上升在个位数百分点内；**1–2 bit 必须配校准**（AQLM/VPTQ/compressed-tensors 1-bit），且任务越接近数学/代码/长上下文，掉点越明显。这张表的定性判断来自位宽与"是否需要校准"两列，不给具体分数——分数依赖模型和数据分布。
- **能预量化就别即时量化**：需要校准的方案（AWQ/GPTQ/AutoRound/compressed-tensors）离线做一次，推理时零额外开销；即时方案（bitsandbytes/EETQ/HQQ/optimum-quanto）胜在"一行代码、任何模型"，但会常驻反量化开销。

| # | 场景 | 选什么 | 显存代价（以 7B / 14B 为例） | 精度代价与代价点 |
| --- | --- | --- | --- | --- |
| 1 | 单卡 24 GB 只想**推理** 7B–14B，可接受离线做一次 | AWQ 或 GPTQ 4-bit 预量化 checkpoint；vLLM 侧 `--quantization awq` / `--quantization gptq`（Marlin 内核用 `awq_marlin`/`gptq_marlin`） | 权重约 3.5 GB / 7 GB，KV 池剩下的显存充裕 | 需校准集；MoE 与长上下文任务掉点比稠密模型明显 |
| 2 | 单卡 24 GB 要**微调** 7B（QLoRA） | bitsandbytes 4-bit NF4 + PEFT LoRA（Transformers 侧即时量化）；见 [QLoRA 与显存优化](./05-qlora-memory-optimization) | 训练占用约 6 GB 量级（LLaMA-Factory 官方估表：QLoRA 4-bit 7B = 6 GB、14B = 12 GB） | 比 AWQ 略钝；`LLM.int8()` 官方口径是"无性能下降"，4-bit QLoRA 也是"不牺牲性能"的一组技术 |
| 3 | Apple Silicon / 无独立 GPU / 端侧 | GGUF（llama.cpp，q4_k_m 一类），或直接 [Ollama](./17-ollama-local-deployment) | 与 int4 同量级；CPU/NPU 侧还要看 KV 是否量化 | GGUF **不被 🤗Transformers 序列化**、PEFT 不支持——它是交付格式不是训练格式 |
| 4 | Hopper / Ada / Blackwell 上追求吞吐，不想自己量化 | 在线 FP8：`--quantization fp8_per_tensor`（逐张量 scale）或 `fp8_per_block`（128×128 块 scale + 1×128 激活 scale） | 权重约 7 GB（7B），比 bf16 省一半 | FP8 是"半位宽损失"，通常比 INT4 温和。注意 `mxfp8` 做 w8a8 要 SM 100+（Blackwell 及以后），更老的卡会退到 w8a16 |
| 5 | 显存主要被 **KV cache** 吃掉（长上下文、高并发） | KV 也量化：vLLM `--kv-cache-dtype fp8`；Transformers 侧 `QuantizedCache`（`hqq` 支持 int2/4/8，`quanto` 支持 int2/4） | KV 直接减半，长上下文下比量化权重收益更大 | 官方明确警告：**上下文短、显存本来就够时反而拉高时延**；短样本别开 |
| 6 | MoE 大模型（30B-A3B 一类、DeepSeek 系） | 分方案：LLaMA-Factory 侧 QLoRA 4-bit 30B ≈ 24 GB；在线服务用 `--quantization mxfp4` 或细粒度 `fp8_per_block`，也可用 `--quantization-config '{"moe": {...}}'` 给 dense 层与 MoE 层不同方案 | 位宽减半线性生效，但激活显存与 expert 路由不动 | MoE 对 expert 精度更敏感；`moe_wna16`、`experts_int8` 就是为此存在。校准集要覆盖到你的真实分布 |
| 7 | 极限压缩到 1–2 bit（端侧小模型、批量离线任务） | AQLM（1/2 bit）、VPTQ（1/8）、compressed-tensors（1/8）、SpQR（3） | 7B 可压到约 1.7–2 GB | **必须校准**；AQLM 在 ROCm/Metal 上为 🔴、AutoRound 不支持 `torch.compile`；掉点最大，务必先在业务评测上过一遍 |
| 8 | AutoRound 路线（Intel 主导，位宽可选 2/3/4/8） | 离线训练产 round 权重后按预量化 checkpoint 部署 | 位宽可选，4/8 常见 | 官方矩阵里 **CPU/CUDA/Intel GPU 为 🟢，ROCm 与 Metal 为 🔴，`torch.compile()` 为 🔴，PEFT 微调为 🔴**——它是"推理交付"方案，不是"量化后继续微调"方案 |
| 9 | 量化后还要继续挂 LoRA/DoRA 训练 | 只有"PEFT 微调"列为 🟢 的行可选：**AQLM、AWQ、bitsandbytes、compressed-tensors、EETQ、GPT-QModel、HQQ**（Quark、Four Over Six、VPTQ、SpQR、AutoRound 均为 🔴） | 与场景 2 同量级 | HQQ **不被 Transformers 序列化**：训得动但存不回 HF 格式，交付要换方案 |
| 10 | 已经有一个别人给的量化 checkpoint，只想验证是不是量化把它搞坏了 | 用同一份评测集对比 `bf16` 与量化版；见 [LLM 评测方法与基准](./22-evaluation-benchmarks) | — | 只看困惑度不够，要加下游任务：量化对生成型任务的影响常大于判别型 |

::: warning 三件容易被忽略的事
1. **vLLM 的 `--quantization` 可选值已经变了代**。现行 `QuantizationMethods` 里包含 `awq`/`auto_awq`/`fp8`/`fp8_per_tensor`/`fp8_per_block`/`fp8_per_channel`/`int8_per_channel_weight_only`/`mxfp4`/`mxfp8`/`nvfp4_per_token`/`gptq`/`gptq_marlin`/`awq_marlin`/`modelopt_fp4`/`quark`/`torchao`/`compressed-tensors`/`online` 等；`fbgemm_fp8` 与 `fp_quant` 已被标为 **deprecated**。
2. **vLLM 服务不走 bitsandbytes 这条路线**。bnb 是 Transformers/PEFT 的训练与本地推理路径；上线服务请用预量化 checkpoint 或在线 FP8，见 [vLLM 高吞吐部署](./18-vllm-high-throughput-deployment)。
3. **量化模型 + 前缀缓存/结构化输出等特性有交互**（如部分方案不支持 `torch.compile`、FP8 KV 与某些注意力内核不兼容），上生产前用 `vllm serve --help` 与官方 quantized KV cache 页确认你这一版的组合是否受支持。
:::

## 资源

如果你刚接触量化，推荐与 DeepLearning.AI 合作的两门入门课程：

- [Quantization Fundamentals with Hugging Face](https://www.deeplearning.ai/short-courses/quantization-fundamentals-with-hugging-face/)
- [Quantization in Depth](https://www.deeplearning.ai/short-courses/quantization-in-depth)

## 易用量化工具

想要开箱即用的量化体验，可以使用以下社区 Space 与 Notebook：

- [Bitsandbytes Space](https://huggingface.co/spaces/bnb-community/bnb-my-repo)
- [GGUF Space](https://huggingface.co/spaces/ggml-org/gguf-my-repo)
- [MLX Space](https://huggingface.co/spaces/mlx-community/mlx-my-repo)
- [AutoQuant Notebook](https://colab.research.google.com/drive/1b6nqC7UZVt8bx4MksX7s656GXPM-eWw4)

# bitsandbytes（译自官方 README）

`bitsandbytes` 通过 k-bit 量化让 PyTorch 上的大语言模型触手可及。为大幅降低推理与训练的内存消耗，它提供三大特性：

- **8-bit 优化器**：使用分块量化（block-wise quantization），以极小的内存代价维持 32-bit 优化器的性能；
- **LLM.int8()（8-bit 量化）**：让大语言模型推理只需一半内存且**没有任何性能下降**。该方法基于逐向量量化（vector-wise quantization），把大多数特征量化到 8-bit，而对离群值（outliers）单独用 16-bit 矩阵乘法处理；
- **QLoRA（4-bit 量化）**：用多种不牺牲性能的省内存技术实现大语言模型训练。该方法把模型量化到 4-bit，再插入少量可训练的低秩适配（LoRA）权重以支持训练。

库内包含 8-bit 与 4-bit 运算的量化原语（`bitsandbytes.nn.Linear8bitLt` 与 `bitsandbytes.nn.Linear4bit`），以及 `bitsandbytes.optim` 模块中的 8-bit 优化器。

## 系统要求

所有平台的最低要求：

- Python 3.10+；
- [PyTorch](https://pytorch.org/get-started/locally/) 2.4+（官方注释：虽致力于广泛向后兼容，仍建议使用最新版 PyTorch 获得最佳体验）。

## 加速器支持

> 注：下表反映当前开发分支状态。最新稳定版的支持情况见 0.50.0 tag 的 README。
>
> 图例：🚧 计划中 | 〰️ 部分支持 | ✅ 支持 | ❌ 不支持

**🐧 Linux（glibc >= 2.24）**

| 平台 | 加速器 | 硬件要求 | LLM.int8() | QLoRA 4-bit | 8-bit 优化器 |
|---|---|---|---|---|---|
| x86-64 | CPU | 最低 AVX2；优化需 AVX512F、AVX512BF16 | ✅ | ✅ | ✅ |
| | NVIDIA GPU（cuda） | SM60+ 最低，建议 SM75+ | ✅ | ✅ | ✅ |
| | AMD GPU（cuda） | CDNA：gfx908/gfx90a/gfx942/gfx950/gfx1250；RDNA：gfx101X/gfx103X/gfx110X/gfx115X/gfx120X | ✅ | ✅ | ✅ |
| | Intel GPU（xpu） | Data Center GPU Max 系列、Arc A 系列（Alchemist）、Arc B 系列（Battlemage） | ✅ | ✅ | ✅ |
| | Intel Gaudi（hpu） | Gaudi2、Gaudi3 | ✅ | 〰️ | ❌ |
| aarch64 | CPU | — | ✅ * | ✅ | ✅ |
| | NVIDIA GPU（cuda） | SM75+ | ✅ | ✅ | ✅ |

**🪟 Windows 11 / Windows Server 2022+**

| 平台 | 加速器 | 硬件要求 | LLM.int8() | QLoRA 4-bit | 8-bit 优化器 |
|---|---|---|---|---|---|
| x86-64 | CPU | AVX2 | ✅ | ✅ | ✅ |
| | NVIDIA GPU（cuda） | SM60+ 最低，建议 SM75+ | ✅ | ✅ | ✅ |
| | AMD GPU（cuda） | CDNA：gfx908、gfx90a；RDNA：gfx101X/gfx103X/gfx110X/gfx115X/gfx120X | ✅ | ✅ | ✅ |
| | Intel GPU（xpu） | Arc A 系列、Arc B 系列 | ✅ | ✅ | ✅ |
| arm64 | CPU | — | ✅ | ✅ | ✅ |
| | NVIDIA GPU（cuda） | SM121 | ✅ | ✅ | ✅ |

**🍎 macOS 14+**

| 平台 | 加速器 | 硬件要求 | LLM.int8() | QLoRA 4-bit | 8-bit 优化器 |
|---|---|---|---|---|---|
| arm64 | CPU | Apple M1+ | ✅ * | ✅ | ✅ |
| | Metal（mps） | Apple M1+ | ✅ * | ✅ | 🚧 |

\* 标星功能虽受支持，但可能缺少性能优化。

## 文档与引用

- 官方文档：[huggingface.co/docs/bitsandbytes/main](https://huggingface.co/docs/bitsandbytes/main)，以及 Transformers / Diffusers / PEFT 三套集成文档；
- bitsandbytes 为 **MIT 许可**；
- 官方引用条目：QLoRA（arXiv:2305.14314）、LLM.int8()（arXiv:2208.07339）、8-bit Optimizers via Block-wise Quantization（ICLR 2022），BibTeX 见原文。

---

> **来源**：抓取于 2026-09-13。正文为原文完整翻译。① 第一节译自 Hugging Face Transformers 官方文档 [Quantization Overview](https://huggingface.co/docs/transformers/quantization/overview)（GitHub 主分支 docs/source/en/quantization/overview.md，作者 Hugging Face，Apache 2.0；选型大表为完整翻译——原表的 Markdown 行内链接改为文字链接，列顺序与标记含义保持一致；Resources 与 User-Friendly Quantization Tools 两节完整翻译）。② 第二节译自 [bitsandbytes-foundation/bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) 官方 README（作者 Titius Dettmers 与 bitsandbytes 贡献者，MIT 许可；三大特性、系统要求、加速器支持矩阵为完整翻译——原 HTML 表格改写为等效 Markdown 表格、合并图例；文档链接、赞助、许可与引用各节为完整翻译，三条 BibTeX 原文保留于官方仓库，此处转述条目信息）。③ **"量化方案怎么选"决策表为编者补充**：定性判据逐项取自第一节官方矩阵的"位宽/即时量化/PEFT 微调/序列化/torch.compile"各列，训练显存数字引自 [hiyouga/LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) 官方 README 的 Hardware Requirement 估表（Apache 2.0，标注为 *estimated*），vLLM 侧参数名与 deprecated 名单经仓库 `vllm/model_executor/layers/quantization/__init__.py` 与 [Online Quantization](https://docs.vllm.ai/en/latest/features/quantization/online.html) 核对（Apache 2.0）；显存换算式与"精度代价经验排序"为编者经验总结，非原文断言，实际掉点请以你自己的业务评测为准。两节之间的过渡句与表内括号说明为本篇编者注，不属原文。
