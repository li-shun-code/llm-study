---
title: 多模态模型概览
source_url: https://huggingface.co/blog/vlms-2025
author: Merve Nouribakhsh, Sergio Paniego, Aritra Roy Gosthipaty, Pedro Cuenca, Andrés Marafioti 等（Hugging Face）
license: Hugging Face Blog（署名转载；博客仓库未附独立许可证文件）
fetched_at: 2026-09-13
translated: true
order: 10
---

> **来源**：本文翻译自 [Hugging Face Blog · Vision Language Models (Better, faster, stronger)](https://huggingface.co/blog/vlms-2025)（2025 年 4 月），作者 Merve Nouribakhsh、Sergio Paniego、Aritra Roy Gosthipaty、Pedro Cuenca、Andrés Marafioti（Hugging Face）。抓取/翻译于 2026-09-13，为节选翻译（架构基础与"专精能力"部分有删节，全文见原文）。
> 开头"什么是 VLM"与结尾"2026 现状速览"两节为本站补充，后者数据核实自各官方仓库（Qwen3-VL、GLM 等，2026-09-13）。

## 一、什么是视觉语言模型（VLM）（编者注）

视觉语言模型（Vision Language Model，VLM）= 语言模型 + 视觉编码器。主流做法（LLaVA 一系）分三件套：

1. **视觉编码器**（如 SigLIP、CLViT）：把图像切成 patch 编码成向量序列；
2. **连接器**（connector，常为投影层或轻量交叉注意力）：把视觉向量"翻译"到语言模型的向量空间；
3. **语言模型**（LLM 解码器）：把图像 token 与文本 token 拼在一起统一处理。

对 LLM 应用开发者而言，VLM 意味着：同一个 API/模型里，输入可以混排图片与文字——截图问答、票据提取、UI 理解、图表解读都由一个模型完成（API 用法见模块 6《视觉理解 API》）。

## 二、过去一年发生了什么（译自原文）

自 2024 年 4 月上一篇 VLM 综述发布以来，变化巨大：模型变得**更小却更强**；出现了新的架构与能力（推理、Agent 化、长视频理解等）；同时全新的范式——多模态检索增强生成（RAG）与多模态 Agent——已经成形。

### 2.1 Any-to-any 模型

Any-to-any 模型，顾名思义，可以**输入任意模态、输出任意模态**（图像、文本、音频）。做法是对齐各模态：一种模态的输入可以翻译到另一种模态（"狗"这个词会关联到狗的图像或"狗"的发音）。这类模型有多个编码器（每种模态一个），把嵌入融合成共享表示空间；解码器（单个或多个）以共享潜空间为输入，解码到目标模态。

最早的尝试是 Meta 的 Chameleon（图文输入、图文输出，未开放图像生成）；Alpha-VLLM 的 Lumina-mGPT 在其上补齐了图像生成。当时最强的一体化模型是 **Qwen2.5-Omni**：采用新颖的 "Thinker-Talker" 架构——"Thinker"负责文本生成，"Talker"以流式方式产生自然的语音回复。同类还有 8B 的 MiniCPM-o 2.6（视觉/语音/语言的理解与生成）与 DeepSeek 的 Janus-Pro-7B（解耦视觉编码，理解与生成两条路径）。

### 2.2 多模态推理模型

推理模型先在 LLM 上出现，如今轮到了 VLM。2025 年前唯一的开源多模态推理模型是 Qwen 的 QVQ-72B-preview（实验性）。后来 Moonshot AI 的 **Kimi-VL-A3B-Thinking** 加入：以 MoonViT（SigLIP-so-400M）为图像编码器、MoE 解码器总参 16B / 激活仅 2.8B，在 Kimi-VL 基座上做长思维链微调加强化学习对齐。它能处理长视频、PDF、截图等输入，并具备 Agent 能力。

### 2.3 小而强（Smol yet Capable）

社区曾经靠参数量堆智能，后来靠高质量合成数据；基准饱和后，继续扩张收益递减，于是转向用蒸馏等方法**把大模型缩小**——省算力、简化部署、解锁本地运行与数据隐私。小 VLM 通常指小于 2B、可在消费级 GPU 上运行的模型：

- **SmolVLM** 系列：不做"缩小版大模型"，而是直接把模型做到 256M / 500M / 2.2B；SmolVLM2 在这些尺寸上解决视频理解，发现 500M 是好的权衡点——Hugging Face 用它做了 iPhone 应用 HuggingSnap，证明这些尺寸在消费设备上可做视频理解；
- **gemma-3-4b-it**（Google DeepMind）：最小的 128k 上下文多模态模型之一，支持 140+ 语言；
- **Qwen2.5-VL-3B-Instruct**：从目标定位（检测/指认）到文档理解再到 Agent 任务的杂家，上下文 32k。

小模型可经 MLX 与 llama.cpp 集成使用：

```bash
# MLX 一行跑 SmolVLM-500M-Instruct
python3 -m mlx_vlm.generate --model HuggingfaceTB/SmolVLM-500M-Instruct \
  --max-tokens 400 --temp 0.0 \
  --image https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/vlm_example.jpg \
  --prompt "What is in this image?"

# llama.cpp 以 GGUF 格式运行 gemma-3-4b-it
llama-mtmd-cli -hf ggml-org/gemma-3-4b-it-GGUF
llama-server -hf ggml-org/gemma-3-4b-it-GGUF
```

（最早的微型 VLM 先驱 moondream2 与 Florence-2 也值得一探。）

### 2.4 MoE 解码器

混合专家（Mixture-of-Experts，MoE）用**动态选择激活**最相关的"专家"子模型替代稠密网络的全量计算：路由器（router）只为每段输入挑选一小片网络。MoE 推理比同等参数量的稠密模型更快、训练收敛更快，代价是整个模型都要驻留显存。在 Transformer 里，MoE 层最常见于替换每个块的 FFN 层。带 MoE 解码器的 VLM 表现突出——Kimi-VL 是当时最先进的 MoE 解码器开源推理模型，MoE-LLaVA 强调效率与减少幻觉，DeepSeek-VL2 能力全面，Meta 的 Llama 4 也是带视觉能力的 MoE。

### 2.5 视觉-语言-动作模型（VLA）

VLM 甚至在机器人领域留下印记，在那儿它们叫视觉-语言-动作模型（Vision-Language-Action，VLA）——本质上仍是 VLM，只是"加了小胡子":VLA 接收图像和文本指令，直接输出指示机器人动作的文本。VLA 在视觉语言输入之外追加了**动作 token 与状态 token**（系统对环境的感知、基于指令的行为、任务步骤的时序），用来生成动作或策略。代表作品：Physical Intelligence 的 **π0 / π0-FAST**（首批机器人基础模型，跨 7 个机器人平台、68 个任务训练，叠衣服、收拾餐桌、装纸箱等真实任务上表现强悍，已移植到 Hugging Face LeRobot）；NVIDIA 的 **GR00T N1**（通用人形机器人开源 VLA 基础模型，基于 LeRobot 数据格式）。

## 三、专精能力与新范式（节译）

- **检测/分割/计数**：VLM 已不止"看图说话"——可以输出边界框做零样本目标检测与指认（pointing），Florence-2、PaliGemma 一系是该方向代表；
- **多模态安全模型**：专门审查图像-文本输入输出的护栏模型（如 Llama Guard 3 Vision）；
- **多模态 RAG**：检索器与重排器全面多模态化（ColPali/ColQwen 等用"视觉 embedding"直接检索文档页面图像），详见模块 8《多模态 RAG》；
- **多模态 Agent**：会看屏幕、操作 UI 的 Agent（UI 导航、计算机操作），Qwen2.5-VL 一系展现了强 Agent 倾向——模块 9《Computer Use》正是这一方向的落地；
- **视频语言模型**：长视频理解成为独立赛道；
- **新基准**：MMT-Bench、MMMU-Pro 等更难的多模态评测，把"选项泄漏"等旧基准问题一并修掉。

## 四、2026 现状速览（编者注，2026-09-13 核实）

- 多模态已是**旗舰标配**而非附加能力：OpenAI GPT-6 Astra 官方参数即"文本+图像输入"；Google Gemini 3 系以原生多模态为招牌（文本/图像/视频/音频）；阿里百炼提供全模态 `qwen3.5-omni-plus`（含实时语音版）；
- 开源侧以 **Qwen3-VL**（[QwenLM/Qwen3-VL](https://github.com/QwenLM/Qwen3-VL)）与 GLM 系多模态（GLM-5.3-Flash 预训练语料即含 30T token 多模态数据）为代表，尺寸阶梯齐全；
- "Any-to-any / 全模态"继续收敛：一个模型同时理解并生成文本、图像、音频、视频（Gemini Omni、Qwen-Omni 系）正在成为旗舰形态；
- 开发者入门路径：先用 API 体验（模块 6《视觉理解 API》），再选一个 2B 级开源 VLM 在本地/Colab 复现"图像问答 → 文档提取 → UI Agent"三连（模块 10 的部署文章可直接复用）。

## 延伸阅读

- VLM 入门第一篇（LLaVA 详解、如何发现/评估/微调开源 VLM）：[Vision Language Models Explained](https://huggingface.co/blog/vlms)（2024-04）
- MoE 机制详解：[Mixture of Experts Explained](https://huggingface.co/blog/moe)
- 站内延伸：模块 8《多模态 RAG》、模块 9《Computer Use/浏览器操作 Agent》、模块 6《视觉理解 API》
