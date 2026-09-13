---
title: 开源模型选型：Qwen、GLM、DeepSeek 全景（2026-09）
source_url: https://github.com/QwenLM/Qwen3.5
author: Qwen 团队、智谱 Z.ai、DeepSeek AI
license: Apache 2.0（Qwen/GLM 仓库文档）、MIT（DeepSeek 仓库文档）
fetched_at: 2026-09-13
translated: true
order: 15
versions: Qwen3.5 系列（至 Qwen3.8，2026-08）/ GLM-5 系列（至 GLM-5.3）/ DeepSeek-V3.2（2026-09 核实）
---

自部署/微调的第一步是选底座模型。本文按 2026 年 9 月的开源现状，整理三大国内主流开源模型家族的版本、规格与定位，供选型参考。

## Qwen（通义千问）：Qwen3.5 系列

Qwen3.5 开源系列仓库（QwenLM/Qwen3.5）收录 Qwen3.5、Qwen3.6 与最新的 Qwen3.8。要点（编译自官方 README）：

**Qwen3.8（2026-08 发布）**：首次把 Qwen-Max 级别的模型开放出来。基于 Qwen3.5 的架构基础，在编码、专业工作、研究与长时程 Agent 任务上大幅提升；自主规划与环境反馈处理更强，端到端任务完成更可靠；推理深度可通过 `reasoning_effort` 调节，历史消息中的推理上下文可用 `preserve_thinking` 保留。

**Qwen3.6（2026-04 发布）**：优先稳定性与实用价值，升级集中在 **Agentic Coding**（前端工作流与仓库级推理更流畅精准）与**思维保持**（Thinking Preservation，跨对话轮次保留思考上下文）。

**Qwen3.5（2026-02 发布，首个 397B-A17B MoE）**：

- **统一视觉-语言基座**：数万亿多模态 token 的早期融合（Early Fusion）训练，跨代际达到 Qwen3 水平并在推理/编码/Agent/视觉理解基准上超过 Qwen3-VL 系列；
- **高效混合架构**：门控 Delta 网络（Gated Delta Networks）+ 稀疏 MoE，高吞吐低延迟；
- **规模化 RL**：跨百万级 Agent 环境做强化学习；
- **语言覆盖**：201 种语言与方言。

**表：Qwen3.5 系主要开源尺寸（Hugging Face / ModelScope 均可下载）**

| 尺寸 | 类型 | 备注 |
| --- | --- | --- |
| 0.8B / 2B / 4B / 9B | 稠密 | 2026-03 发布，端侧与入门微调友好 |
| 27B | 稠密 | Qwen3.6/Qwen3.8 均有 27B 版 |
| 35B-A3B | MoE | 高性价比推理 |
| 122B-A10B | MoE | 2026-02 发布 |
| 397B-A17B | MoE | Qwen3.5 首发旗舰 |
| 2.4T-A95B | MoE | Qwen3.8 旗舰（2026-08） |

权重发布在 [Hugging Face Hub](https://huggingface.co/Qwen) 与 [ModelScope](https://modelscope.cn/organization/qwen)，开源权重按 Apache 2.0 许可（部分大尺寸适用附加条款，使用前查看各模型卡）。

## GLM（智谱）：GLM-5 系列

GLM-5 系列仓库（zai-org/GLM-5）收录 GLM-5、GLM-5.1、GLM-5.2 与 GLM-5.3。要点（编译自官方 README）：

**GLM-5.3 / GLM-5.3-Flash（最新）**：GLM-5.3 与 GLM-5.2 共用同一基座，提升全部来自后训练——复杂编码能力显著增强（自建 Z.ai Code Bench 相对 GLM-5.2 提升 50%，Terminal Bench 3.0、Agents' Last Exam 等公开基准开源最优）。GLM-5.3-Flash 则来自全新训练的基座：**首次在 GLM 系列引入稀疏注意力与线性注意力的混合架构**，大幅降低长上下文服务成本，并采用流形约束超连接（mHC）提升扩展效率，配合 30T token 多模态预训练语料。

**GLM-5.2**：面向长时程任务的旗舰。首次提供**扎实的 1M token 上下文**；提出 IndexShare（每四个稀疏注意力层复用同一索引器，1M 上下文下每 token FLOPs 降低 2.9 倍）；改进 MTP 层用于投机解码（接受长度提升最多 20%）。标准编码基准上为当时最强开源模型（Terminal-Bench 2.1 得分 81.0，逼近 Claude Opus 4.8 的 85.0）。

**GLM-5.1**：面向 Agentic 工程的新一代旗舰，SWE-Bench Pro 开源最优；特长是**长时程稳定性**——数百轮、数千次工具调用的持续优化能力。

**GLM-5**：从 GLM-4.5 的 355B（激活 32B）扩展到 **744B（激活 40B）**，预训练数据从 23T 增至 28.5T token，并集成 DeepSeek 稀疏注意力（DSA）以降低部署成本。配套发布了异步强化学习基础设施 [slime](https://github.com/THUDM/slime)。

**表：GLM-5 系下载规格（官方 README）**

| 模型 | 参数量 | 精度 |
| --- | --- | --- |
| GLM-5.3 / GLM-5.2 / GLM-5.1 / GLM-5 | 744B-A40B | FP8 / BF16 |
| GLM-5.3-Flash | 320B-A18B | FP8 / BF16 |

权重发布在 Hugging Face（zai-org）与 ModelScope（ZhipuAI），仓库代码 Apache 2.0，模型使用遵循各自模型卡许可。

## DeepSeek：DeepSeek-V3.2

DeepSeek-V3.2 仓库（deepseek-ai/DeepSeek-V3.2，README 以 DeepSeek-V3.2-Exp 起始）要点（编译自官方 README）：

- **DeepSeek 稀疏注意力（DSA）**：在 V3.1-Terminus 基础上引入的细粒度稀疏注意力机制，首次实现细粒度稀疏注意力，**大幅提升长上下文训练与推理效率，同时模型输出质量几乎不变**。为严格评估稀疏注意力的影响，训练配置刻意与 V3.1-Terminus 对齐——公开基准表现持平（如 MMLU-Pro 85.0/85.0、AIME 2025 88.4/89.3、SWE Verified 68.4/67.8）。
- **开源内核**：TileLang 高可读内核、DeepGEMM 高性能 CUDA 内核（含 indexer logit 内核的分页版本）、FlashMLA 稀疏注意力内核。
- **本地运行**：官方提供 HuggingFace 权重的推理 Demo（torchrun 多卡），并提供 SGLang/vLLM 等部署路径与 Docker 镜像。
- 仓库与权重按 **MIT** 许可——主流大模型中最宽松的许可之一。

## 2026-09 选型建议（编者补充）

结合三家官方信息与社区实测共识：

**表：按场景选型**

| 场景 | 推荐 | 理由 |
| --- | --- | --- |
| 入门微调实验（单卡 24G 内） | Qwen3.5-0.8B/2B/4B、Qwen2.5-0.5B/1.5B（TRL 示例同款） | 小尺寸齐全，生态文档最全，TRL/LLaMA-Factory 示例即拿即用 |
| 企业内中文 SFT/领域适配 | Qwen3.5-27B / Qwen3.5-122B-A10B | 中文综合能力与工具生态成熟，尺寸档位覆盖广 |
| Agentic Coding / 长时程任务 | GLM-5.2 / GLM-5.3、Qwen3.6-27B | 编码与长时程 Agent 基准开源领先 |
| 长上下文（1M 级） | GLM-5.2（扎实 1M）、Qwen3.5（256K 起，可扩 1M） | 官方明示的长上下文能力 |
| 低成本推理 / 本地部署 | DeepSeek-V3.2（DSA 降本）、GLM-5.3-Flash（混合注意力） | 架构级推理成本优化，MIT/宽松许可 |
| 极致许可自由度 | DeepSeek（MIT） | 商用二次开发限制最少 |

**通用建议**：

1. **能小则小**：先在 4B–9B 上验证任务可行性，再上更大尺寸；微调 27B 的成本约是 4B 的近线性倍数。
2. **看 ModelScope**：三家权重在 ModelScope 与 HF 同步发布，国内下载走魔搭更稳（Ollama/vLLM 均可指定 ModelScope 或本地路径）。
3. **许可证逐模型确认**：仓库代码许可（Apache/MIT）≠ 权重许可；部分旗舰权重带附加使用条款，商用前读模型卡。
4. **与部署栈对齐**：确认目标推理引擎（vLLM/SGLang/Ollama）已支持所选模型的架构特性（如 DSA、混合线性注意力、MTP 投机解码）——新架构发布初期支持会滞后。

## 落地清单（编者补充）

- 查看各家族官方 README 获取最新尺寸与下载链接：[Qwen3.5](https://github.com/QwenLM/Qwen3.5) / [GLM-5](https://github.com/zai-org/GLM-5) / [DeepSeek-V3.2](https://github.com/deepseek-ai/DeepSeek-V3.2)
- 下载：`huggingface-cli download Qwen/Qwen3.5-27B --local-dir ...`（配 HF_ENDPOINT 镜像）或 ModelScope CLI
- 验证：先 `vllm serve` 起服务跑通冒烟（见 [vLLM 高吞吐部署](./14-vllm-high-throughput-deployment)），再进 [TRL 实战](./09-trl-sft-practice)微调
- 评测：选型对比用 [LLM 评测方法与基准](./16-evaluation-benchmarks) 的 lm-eval 跑公开基准，加上自建领域评测集

## 小结

- 2026-09 开源第一梯队由 Qwen3.5/3.8、GLM-5 系列、DeepSeek-V3.2 构成，全部可在国内渠道获取。
- 选型四要素：任务场景 > 硬件预算 > 许可条款 > 部署栈兼容性。
- 模型迭代极快——本文快照于 2026-09-13，选型前务必复核各仓库 README 的最新版本。

---

> **来源**：本文综合编译自三个官方仓库 README：[QwenLM/Qwen3.5](https://github.com/QwenLM/Qwen3.5)（Qwen 团队，Apache 2.0）、[zai-org/GLM-5](https://github.com/zai-org/GLM-5)（智谱 Z.ai，Apache 2.0）、[deepseek-ai/DeepSeek-V3.2](https://github.com/deepseek-ai/DeepSeek-V3.2)（DeepSeek AI，MIT）。抓取于 2026-09-13，模型现状以当日各仓库为准。"选型建议"与"落地清单"两节为编者补充，已标注。
