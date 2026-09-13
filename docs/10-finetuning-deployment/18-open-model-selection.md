---
title: 开源模型选型：Qwen、GLM、DeepSeek 官方模型卡对照（2026-09）
source_url: https://github.com/QwenLM/Qwen3.5
author: Qwen 团队、智谱 Z.ai（GLM 团队）、DeepSeek-AI（三家官方 README）
license: Apache 2.0（Qwen/GLM）、MIT（DeepSeek）
fetched_at: 2026-09-13
translated: true
versions: Qwen3.5 仓库（至 Qwen3.8，2026-08）/ GLM-5 仓库（至 GLM-5.3）/ DeepSeek-V3.2 仓库（2026-09 核实为最新）
order: 18
---

本篇为重做版：正文主体完整翻译 Qwen、GLM、DeepSeek 三个官方仓库的 README 模型卡（2026-09 各自最新版），按"统一多模态基座 → 长时程智能体 → 长上下文效率"的对照阅读，替换原先的编者综合编译，文末逐节署名。

# Qwen3.5 系列（译自 QwenLM/Qwen3.5 官方 README）

## 系列（Introduction）

欢迎来到 Qwen3.5 开源模型系列的 GitHub 仓库，包括 Qwen3.5、Qwen3.6 与最新的 Qwen3.8。你可以在这里找到 Qwen3.8 的官方信息、提问（Issues）与分享想法（Discussions）。

### Qwen3.8

Qwen3.8 首次把 Qwen-Max 级别的模型开放发布。它以 Qwen3.5 的架构为基础，在编码、专业工作、研究与长时程智能体任务上带来显著提升——不止于"答更难的题"，更为可靠地完成复杂的多步任务。增强点：

- **核心能力**：编码、专业工作、研究与长时程智能体任务全面增强；
- **智能体执行**：更强的自主规划与更好的环境反馈处理，端到端任务完成更可靠；
- **下游兼容性**：更广的主流通用测试框架（harness）与开发工具支持，更容易接入现有技术栈；
- **灵活思考控制**：推理深度可用 `reasoning_effort` 调节，历史消息中的推理上下文可经 `preserve_thinking` 保留。

### Qwen3.6

在 Qwen3.5 的基础性突破之上，Qwen3.6 优先考虑稳定性与实际效用：更直观、响应更快、真正有生产力的编码体验（源自社区直接反馈）。升级集中在：

- **智能体编码**：前端工作流与仓库级推理更流畅；
- **思考保留**：新特性在会话历史中保留思考上下文，简化迭代开发、降低开销。

### Qwen3.5

近几个月我们专注于提供卓越实用性的基座模型。Qwen3.5 是一次重大飞跃，融合了多模态学习、架构效率、强化学习规模与全球可及性的突破。增强点：

- **统一视觉-语言基座**：数万亿多模态 token 的早期融合训练，与 Qwen3 跨代际持平，并在推理、编码、智能体与视觉理解基准上超越 Qwen3-VL 系列模型；
- **可扩展 RL 泛化**：强化学习扩展到百万智能体环境，任务分布渐进复杂，保证真实世界的鲁棒适配；
- **全球语言覆盖**：支持 201 种语言与方言；
- **新一代训练基础设施**：多模态训练效率接近纯文本训练，异步 RL 框架支持大规模智能体脚手架与环境编排。

## 新闻（News，按时间倒序）

- 2026-08-14：Qwen3.8-27B 上线 Hugging Face Hub 与 ModelScope；
- 2026-08-12：Qwen3.8-2.4T-A95B 上线；
- 2026-04-22 / 04-16：Qwen3.6-27B、Qwen3.6-35B-A3B 发布；
- 2026-03-02：Qwen3.5-9B/4B/2B/0.8B 发布；
- 2026-02-24：Qwen3.5-122B-A10B、Qwen3.5-35B-A3B、Qwen3.5-27B 发布；
- 2026-02-16：Qwen3.5 首发（397B-A17B MoE）；
- 2025-09-11：Qwen3-Next-80B-A3B（超稀疏 MoE + 混合注意力，为极致效率设计）。

## 模型下载与基准

官方权重发布在 [Hugging Face Hub](https://huggingface.co/Qwen)（指定模型 ID 即可自动下载，如 `Qwen/Qwen3.8-27B`、`Qwen/Qwen3.6-35B-A3B`、`Qwen/Qwen3.5-397B-A17B`；也可 `huggingface download` 或 `git clone` 手动下载）与 [ModelScope](https://www.modelscope.cn/organization/Qwen)（无法访问 HF 的用户推荐；支持的框架设 `SGLANG_USE_MODELSCOPE=true` 或 `VLLM_USE_MODELSCOPE=true` 即可从 ModelScope 下载）。

基准成绩：Qwen3.8 详见两张模型卡；Qwen3.6/Qwen3.5 各尺寸的成绩图与博客链接见原文（图片不转载）。

## 快速开始（Quickstart）

**官方渠道**：Qwen Studio（chat.qwen.ai，人人可用的免费 AI 助手）、Qoder（智能体编码平台）、QwenWork（一站式 AI 工作平台）、QwenCloud API（兼容 OpenAI 与 Anthropic 规范）、Qwen Code（终端开源编码智能体，专为 Qwen 模型优化）。

**本地使用**：

- **Transformers**：当前开源权重生态的模型定义框架，现带服务能力，`transformers serve Qwen/Qwen3.8-27B --port 8000 --continuous-batching` 即起 OpenAI 兼容 API（`http://localhost:8000/v1`）；
- **llama.cpp**：最小安装、广泛硬件上的先进性能，支持 Qwen3.5 全系列（文本与视觉），找 GGUF 结尾的模型；
- **MLX（Apple Silicon）**：`mlx-lm`（纯文本）与 `mlx-vlm`（视觉+文本）均支持，找 MLX 结尾的模型；
- **Unsloth**：本地 UI 运行与训练 LLM（含 Qwen3.8 量化版）。

**部署**（以 Qwen3.8-27B 为例，OpenAI 兼容 API 均在 `http://localhost:8000/v1`）：

```shell
# SGLang
sglang serve --model-path Qwen/Qwen3.8-27B --port 8000 --tp-size 4 --context-length 262144 --reasoning-parser qwen3 --tool-call-parser qwen3_coder

# vLLM
vllm serve Qwen/Qwen3.8-27B --port 8000 --tensor-parallel-size 4 --max-model-len 262144 --reasoning-parser qwen3 --enable-auto-tool-choice --tool-call-parser qwen3_coder

# TokenSpeed
tokenspeed serve Qwen/Qwen3.8-27B --port 8000 --tensor-parallel-size 4 --max-model-len 262144 --reasoning-parser qwen3 --enable-auto-tool-choice --tool-call-parser qwen3_coder
```

**微调（Finetuning）**：官方建议使用 [Unsloth](https://github.com/unslothai/unsloth)、[Swift（ms-swift）](https://github.com/modelscope/swift)、[Llama-Factory](https://github.com/hiyouga/LLaMA-Factory) 等训练框架做 SFT、DPO、GRPO 等微调。

**许可**：Qwen 开源权重随模型附带的许可文件为准（Qwen3 系列官方 README 明确为 Apache 2.0）。

# GLM-5 系列（译自 zai-org/GLM-5 官方 README）

## GLM-5.3 与 GLM-5.3-Flash

GLM-5.3 与 GLM-5.2 使用同一基座模型——所有提升都来自后训练。相比 GLM-5.2，它在复杂编码与长时程任务上强得多：

+ **更强的编码**：GLM-5.3 是编码最强的开放权重模型，在 Z.ai 内部 Code Bench 上比 GLM-5.2 提升 50%，并在 Terminal Bench 3.0、Agents' Last Exam 等公开基准上取得开源 SOTA；
+ **涌现的网络攻防能力**：随着后训练规模扩大，网络攻防能力的发展超出预期。GLM-5.3 在漏洞发现基准 CyberGym 上达到 SOTA，且越往漏洞利用链上游增益越大——在利用（exploitation）基准上超过 GLM-5.2 的一倍。

GLM-5.3-Flash 则从一个新训练的基座出发，架构与训练配方围绕能力与效率重新设计。GLM 系列首次引入**稀疏注意力与线性注意力混合架构**，在保持精确长上下文能力的同时大幅降低长上下文服务成本；并采用流形约束超连接（Manifold-Constrained Hyper-Connections, mHC）进一步提升扩展效率。配合最新的 30T token 多模态预训练语料，GLM-5.3-Flash 以更少算力交付更多智能。

## GLM-5.2

面向长时程任务的旗舰模型：长时程任务能力较上一代 GLM-5.1 大幅跃升，并首次在**扎实的 1M token 上下文**上交付该能力。新能力包括：

- **扎实 1M 上下文**：稳定支撑长时程工作的 1M-token 上下文；
- **灵活思考力度的先进编码**：更强编码能力 + 多档思考力度（effort levels）平衡性能与延迟；
- **改进架构**：提出 [IndexShare](https://arxiv.org/abs/2603.12201)，每四层稀疏注意力复用同一 indexer，1M 上下文长度下每 token FLOPs 降低 2.9 倍；改进 MTP 层用于投机解码，接受长度最多提升 20%。

标准编码基准上 GLM-5.2 是最强开源模型，大幅领先 GLM-5.1：Terminal-Bench 2.1 为 81.0 对 62.0，SWE-bench Pro 为 62.1 对 58.4；与闭源前沿的差距也大幅收窄——Terminal-Bench 2.1（81.0）距 Claude Opus 4.8（85.0）只差几分，同时领先 Gemini 3.1 Pro。

## GLM-5.1

面向智能体工程的下一代旗舰，编码能力显著强于前代：SWE-Bench Pro 上 SOTA，NL2Repo（仓库生成）与 Terminal-Bench 2.0（真实终端任务）大幅领先 GLM-5。

最有意义的跨越不止于一次通过率。此前的模型（包括 GLM-5）容易"过早耗尽招数"：先用熟悉的技术快速得分，随后平台化，给更多时间也无济于事。GLM-5.1 则专为在长得多的时间跨度上保持智能体任务效率而构建：对模糊问题判断更准、长会话中保持生产力；能把复杂问题拆解、做实验、读结果、精确定位阻塞点；通过反复迭代审视推理、修订策略，GLM-5.1 可在数百轮、数千次工具调用中持续优化——跑得越久，结果越好。

## GLM-5

面向复杂系统工程与长时程智能体任务。扩展仍是提升通用智能效率的最重要手段之一：相比 GLM-4.5，GLM-5 从 355B 参数（激活 32B）扩展到 **744B 参数（激活 40B）**，预训练数据从 23T 增至 **28.5T token**，并集成 DeepSeek 稀疏注意力（DSA），在保持长上下文能力的同时大幅降低部署成本。

强化学习旨在弥合预训练模型"胜任"与"卓越"之间的鸿沟，但 RL 训练效率低使其难以大规模部署。为此 GLM 团队开发了 [slime](https://github.com/THUDM/slime)——新型**异步 RL 基础设施**，显著提升训练吞吐与效率，支持更细粒度的后训练迭代。凭借预训练与后训练的双重进展，GLM-5 在广泛学术基准上较 GLM-4.7 显著提升，在推理、编码与智能体任务上达到全球开源模型中的最佳水平，缩小与前沿模型的差距。

在内部评测套件 CC-Bench-V2 上，GLM-5 在前端、后端与长时程任务上显著超越 GLM-4.7，逼近 Claude Opus 4.5。在度量长期运营能力的 [Vending Bench 2](https://andonlabs.com/evals/vending-bench-2)（运行一年期的模拟自动售货机生意）上，GLM-5 以最终账户余额 $4,432 位居开源模型第一，逼近 Claude Opus 4.5，展现出强大的长期规划与资源管理能力。

## 下载与本地服务

| 模型 | 规模 | 精度 |
|--------------------|------------|-----------|
| GLM-5.3 / GLM-5.3-BF16 | 744B-A40B | FP8 / BF16 |
| GLM-5.3-Flash / GLM-5.3-Flash-BF16 | 320B-A18B | FP8 / BF16 |
| GLM-5.2 / GLM-5.2-FP8 | 744B-A40B | BF16 / FP8 |
| GLM-5.1 / GLM-5.1-FP8 | 744B-A40B | BF16 / FP8 |
| GLM-5 / GLM-5-FP8 | 744B-A40B | BF16 / FP8 |

（各型号均有 Hugging Face 与 ModelScope 双下载链接，见原文表格。）

**本地服务**：GLM-5.3-Flash 支持 SGLang（cookbook）、vLLM（recipes）、TokenSpeed、Transformers、KTransformers、Unsloth；GLM-5.3 及更早的 GLM-5 模型支持 SGLang、vLLM、Transformers（glm_moe_dsa 模型文档）、KTransformers、Unsloth，另有 Ascend NPU 平台部署（vLLM-Ascend、xLLM、SGLang）。

**使用注意（Note）**：

- **GLM-5.2** 的 `reasoning_effort` 只接受 `high` 与 `max`，默认与回退行为同为 `max`；
- **GLM-5.3 与 GLM-5.3-Flash** 支持 `reasoning_effort` 控制思考预算，接受 `low`、`high`、`max` 三档；不传（或传其他值）默认 `max`，要用 `low`/`high` 需显式传入；复现基准与榜单请保持默认 `max`；
- GLM-5.3 与 GLM-5.3-Flash 的聊天模板中 `clear_thinking` 不传默认 `false`；聊天场景请显式传 `clear_thinking=true`。

**微调**：GLM-5 系列支持以下框架：[Slime](https://github.com/THUDM/slime)（v0.3.0+，GLM 团队自用的强化学习框架）、[ms-swift](https://github.com/modelscope/ms-swift)（v4.4.0+，支持 SFT、PPO、GRPO）。

**引用**：GLM-5 技术报告《GLM-5: from Vibe Coding to Agentic Engineering》（arXiv:2602.15763, 2026）。

# DeepSeek-V3.2-Exp（译自 deepseek-ai/DeepSeek-V3.2 官方 README）

## 引言

我们很高兴宣布 DeepSeek-V3.2-Exp 正式发布——一个实验版本。作为迈向下一代架构的中间步骤，V3.2-Exp 在 V3.1-Terminus 基础上引入 **DeepSeek 稀疏注意力（DeepSeek Sparse Attention, DSA）**——一种为在长上下文场景中探索并验证训练与推理效率优化而设计的稀疏注意力机制。

这一实验版本代表我们对更高效 Transformer 架构的持续研究，尤其聚焦于处理超长文本序列时的计算效率提升。

- **DSA 首次实现细粒度稀疏注意力**：在保持模型输出质量几乎完全一致的前提下，大幅提升长上下文训练与推理效率；
- 为严格评估引入稀疏注意力的影响，我们刻意将 DeepSeek-V3.2-Exp 的训练配置与 V3.1-Terminus 对齐。在各领域的公开基准上，DeepSeek-V3.2-Exp 与 V3.1-Terminus 表现相当：

| 基准 | DeepSeek-V3.1-Terminus | DeepSeek-V3.2-Exp |
| :--- | :---: | :---: |
| **推理模式（无工具）** | | |
| MMLU-Pro | 85.0 | 85.0 |
| GPQA-Diamond | 80.7 | 79.9 |
| Humanity's Last Exam | 21.7 | 19.8 |
| LiveCodeBench | 74.9 | 74.1 |
| AIME 2025 | 88.4 | 89.3 |
| HMMT 2025 | 86.1 | 83.6 |
| Codeforces | 2046 | 2121 |
| Aider-Polyglot | 76.1 | 74.5 |
| **智能体工具使用** | | |
| BrowseComp | 38.5 | 40.1 |
| BrowseComp-zh | 45.0 | 47.9 |
| SimpleQA | 96.8 | 97.1 |
| SWE Verified | 68.4 | 67.8 |
| SWE-bench Multilingual | 57.8 | 57.9 |
| Terminal-bench | 36.7 | 37.7 |

## 更新

- 2025.11.17：我们查明此前版本的推理演示代码中 indexer 模块的旋转位置编码（RoPE）存在实现不一致，可能导致模型性能退化——indexer 模块中 RoPE 的输入张量要求非交错（non-interleaved）布局，而 MLA 模块中的 RoPE 期望交错（interleaved）布局。该问题已修复，请使用更新后的推理演示代码并注意此实现细节。

## 开源内核

- 追求**可读性与研究导向设计**的 TileLang 内核：见 TileLang 仓库 examples/deepseek_v32；
- **高性能 CUDA 内核**：indexer logit 内核（含 paged 版本）在 DeepGEMM，稀疏注意力内核在 FlashMLA。

## 本地运行

**HuggingFace 演示代码**：仓库 inference 目录提供更新的推理演示。先把 HF 权重转换为演示所需格式（`MP` 按可用 GPU 数设置）：

```bash
cd inference
export EXPERTS=256
python convert.py --hf-ckpt-path ${HF_CKPT_PATH} --save-path ${SAVE_PATH} --n-experts ${EXPERTS} --model-parallel ${MP}
```

启动交互聊天：

```bash
export CONFIG=config_671B_v3.2.json
torchrun --nproc-per-node ${MP} generate.py --ckpt-path ${SAVE_PATH} --config ${CONFIG} --interactive
```

**SGLang**：Docker 镜像 `lmsysorg/sglang:dsv32`（H200）、`dsv32-rocm`（MI350）、`dsv32-a2`/`dsv32-a3`（NPU）；启动：

```bash
python -m sglang.launch_server --model deepseek-ai/DeepSeek-V3.2-Exp --tp 8 --dp 8 --enable-dp-attention
```

**vLLM**：提供 day-0 支持，最新细节见 vLLM recipes。

## 许可与引用

本仓库与模型权重采用 **MIT 许可**。引用条目：*DeepSeek-V3.2-Exp: Boosting Long-Context Efficiency with DeepSeek Sparse Attention*（DeepSeek-AI, 2025）。问题反馈：仓库 issue 或 service@deepseek.com。

---

> **来源**：抓取于 2026-09-13。本篇为编者综合版的重做：正文主体替换为三家官方 README 的完整翻译对照。① 第一节译自 [QwenLM/Qwen3.5](https://github.com/QwenLM/Qwen3.5) 官方 README（作者 Qwen 团队，Apache 2.0；Introduction/News/Models/Benchmarks/Quickstart/Finetuning/License 各节完整翻译；基准成绩图与官方渠道重复的链接列表原文保留为文字说明；时间线说明为编者注）；② 第二节译自 [zai-org/GLM-5](https://github.com/zai-org/GLM-5) 官方 README（作者 GLM 团队/智谱 Z.ai，Apache 2.0；Introduction 四个型号、下载表、本地服务、Note、Fine-tuning、Citation 各节完整翻译；头部社区链接与基准图不转载；下载表省略逐行下载链接列、保留规模与精度并列，已注明）；③ 第三节译自 [deepseek-ai/DeepSeek-V3.2](https://github.com/deepseek-ai/DeepSeek-V3.2) 官方 README（作者 DeepSeek-AI，MIT；Introduction/Update/开源内核/本地运行/许可/引用/联系各节完整翻译，基准表为完整翻译）。三家仓库的徽章、logo 与社交链接未译。时效性说明：DeepSeek-V4 经 raw 探测不存在（404），V3.2 为该组织 README 可用的最新主模型仓库；R1 推理模型的强化学习训练路线见本模块 GRPO 篇。
