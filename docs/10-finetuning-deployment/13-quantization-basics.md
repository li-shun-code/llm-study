---
title: 模型量化基础：Transformers 量化总览与 bitsandbytes
source_url: https://huggingface.co/docs/transformers/quantization/overview
author: Hugging Face（Transformers 官方文档）、bitsandbytes-foundation（bitsandbytes 官方 README）
license: Apache 2.0（Transformers 文档）、MIT（bitsandbytes）
fetched_at: 2026-09-13
translated: true
versions: Transformers 主分支文档（2026-09）；bitsandbytes 当前开发分支 README
order: 13
group: 量化与推理原理
---
本篇正文完整译自两份一手文档——Hugging Face Transformers 官方文档的量化总览页（含量化方法选型表）与 bitsandbytes 官方 README（含平台支持矩阵），文末逐节署名。

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

> **来源**：抓取于 2026-09-13。正文为原文完整翻译。① 第一节译自 Hugging Face Transformers 官方文档 [Quantization Overview](https://huggingface.co/docs/transformers/quantization/overview)（GitHub 主分支 docs/source/en/quantization/overview.md，作者 Hugging Face，Apache 2.0；选型大表为完整翻译——原表的 Markdown 行内链接改为文字链接，列顺序与标记含义保持一致；Resources 与 User-Friendly Quantization Tools 两节完整翻译）。② 第二节译自 [bitsandbytes-foundation/bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) 官方 README（作者 Titius Dettmers 与 bitsandbytes 贡献者，MIT 许可；三大特性、系统要求、加速器支持矩阵为完整翻译——原 HTML 表格改写为等效 Markdown 表格、合并图例；文档链接、赞助、许可与引用各节为完整翻译，三条 BibTeX 原文保留于官方仓库，此处转述条目信息）。两节之间的过渡句与表内括号说明为本篇编者注，不属原文。
