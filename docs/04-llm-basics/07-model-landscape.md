---
title: 主流模型生态对比（2026-09）
source_url: https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models
author: 本站编译（主引用 Microsoft Learn，各家信息出自其官方文档/官网）
license: CC BY 4.0（主引用），其余来源许可见文内链接
fetched_at: 2026-09-13
translated: false
order: 7
---

> **来源**：本文编译自多方官方公开资料，主引用 [Azure OpenAI models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)（Microsoft Learn，CC BY 4.0），编者为本站，许可 CC BY 4.0（主引用），其余来源（Anthropic、Google DeepMind、DeepSeek、阿里云、智谱 Z.ai 官方页面）见文内链接。抓取于 2026-09-13，全部版本信息为该时点核实结果——模型迭代很快，阅读时请以官方页面为准。

LLM 生态呈"少数闭源旗舰 + 多家开源权重"的双轨格局。本文按 2026 年 9 月 13 日核实的官方信息，梳理六大主流系列的当前版本、定位与差异，帮你建立选型坐标系。

## 一、全景速览

**表：六大模型家族当前旗舰（2026-09-13 核实）**

| 家族 | 当前旗舰 | 旗舰模型 ID / 入口 | 公开的开源系 | 特点标签 |
| ---- | -------- | ------------------ | ------------ | -------- |
| OpenAI | GPT-6 Astra（2026-09-03） | `gpt-6-astra` | 无（gpt-oss 为小规模开放权重） | 推理旗舰、百万级上下文 |
| Anthropic | Claude Opus 5 | `claude-opus-5` 系 | 无 | 长程 Agent 任务、代码 |
| Google | Gemini 3.1 Pro / 3.8 Flash | `gemini-3.1-pro`、`gemini-3.8-flash` | Gemma 系列 | 原生多模态、Deep Think |
| DeepSeek | DeepSeek V4（V4.1） | `deepseek-flash`（V4 Pro 另行接入） | 全系开源权重 | 开源高性价比、混合推理 |
| 阿里 Qwen | Qwen3.8-Max（商业） | `qwen3.8-max` | Qwen3 全系开源 | 开源矩阵最全、多尺寸 |
| 智谱 GLM | GLM-5.3 | GLM-5.3 / GLM-5.3-Flash（Z.ai） | GLM-5 系开源权重 | Agentic 工程、开源 SOTA |

下面分家族展开。

## 二、OpenAI：GPT-6 时代

依据 [Microsoft Learn: Azure OpenAI models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)（2026-09 核实），OpenAI 当前在售模型分层：

- **GPT-6 Astra**（`gpt-6-astra`，2026-09-03 发布）：当前旗舰推理模型。上下文 1,050,000（输入 922K + 输出 128K），知识截止 2026 年 4 月。支持 Responses API、多智能体编排（预览）、Computer Use、函数/并行工具调用（**工具调用要求 Responses API**）、结构化输出、文本+图像输入。不支持自定义 `temperature`/`top_p` 与 logprobs——生成行为由 `reasoning_effort` 与 verbosity 控制。
- **GPT-5.6 系列**（2026-07-09 发布）：`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`，同为 1.05M 上下文的推理系列，知识截止 2026 年 2 月。
- **GPT-5.4 系列**：`gpt-5.4` / `mini` / `nano` / `pro`，通用+轻量分层，其中 mini/nano 是性价比与低时延档，支持自定义采样参数。
- **代码系列**：GPT-5.3-Codex 及更早的 GPT-5.2/5.1-Codex，面向编码 Agent。
- **历史脉络**：GPT-4o（2024）→ o1（2024，推理模型开端）→ GPT-5（2025-08）→ GPT-5.1/5.2（2025-11/12）→ GPT-5.6（2026-07）→ GPT-6（2026-09）；o3 等 ChatGPT 旧推理模型已陆续退役。更早的 GPT-4.1/4o 在 API 上仍可用但已非推荐项。

## 三、Anthropic：Claude 5 代际

依据 [anthropic.com/news](https://www.anthropic.com/news) 发布记录（2026-09 核实）：

- **Claude Opus 5**（2026 年 7 月发布）：Opus 系列最新旗舰，官方定位"性能接近其最强模型 Fable"，知识截止 2026 年 5 月；擅长长程 Agent 任务与复杂编码。
- **Claude Sonnet 5**：Sonnet 系列当前主力（前代 Sonnet 4.5/4.6），智能/速度/成本均衡的默认工作马。
- **Claude Haiku 4.5**：轻量快速档。
- **前沿梯队**：Claude **Fable 5.1 与 Mythos 5.1**（2026-09-01 发布，限定访问）——Anthropic 最强模型不在公开货架上的又一例。
- 前代脉络：Opus 4.5 → 4.6 → 4.7 → 4.8 → Opus 5；Opus 4.8 在 Terminal-Bench 2.1 上为 85.0 分（智谱 GLM-5.2 技术博客引用），仍是开源模型对标的重要基准线。

## 四、Google：Gemini 3 家族

依据 [DeepMind 官网 Gemini 页面](https://deepmind.google/models/gemini/)（2026-09 核实）：

- **Gemini 3.8 Flash**：当前主力与门面模型，定位"最适合大规模复杂 Agent 任务"，官网列出限时价 $0.75/$3.75 每百万 token（至 2026-12-31）；另有安全特化版 **3.8 Flash Cyber**。
- **Gemini 3.1 Pro**："最适合复杂任务与创意落地"；**3.5 Pro 已在预告中**。
- **Gemini 3.1 Deep Think**：为科学与工程难题准备的深度思考档。
- **Gemini 3.5 Flash-Lite**：高吞吐低成本档。
- 生态位：Gemini 系以**原生多模态**（文本/图像/视频/音频）为招牌，配套 Omni、Image（Nano Banana）、Audio、Robotics、Embedding 2 等周边模型。

## 五、DeepSeek：开源高性价比路线

依据 [DeepSeek API 文档](https://api-docs.deepseek.com/)（2026-09 核实）：

- 当前 API 模型名为 **`deepseek-flash`**，实际由 **DeepSeek-V4.1-Flash** 服务（旧名 `deepseek-v4-flash`/`-vision-exp` 已退役）；**V4 Pro** 官方宣布服务延续至 2026-09-14 之后。
- 调用方式为 OpenAI 兼容的 `chat/completions`（base_url = `https://api.deepseek.com`），支持 `thinking: {"type": "enabled"}` 与 `reasoning_effort` 参数——同一模型内切换"快答/深思"两种模式。
- DeepSeek 延续"开源权重 + 极低 API 价格"路线，另推出了面向 Agent 开发者的 DeepSeek Harness（开发者预览）。

## 六、阿里 Qwen：最全的开源矩阵

依据[阿里云百炼模型列表](https://help.aliyun.com/zh/model-studio/models)与 [QwenLM GitHub](https://github.com/QwenLM)（2026-09 核实）：

- **商业 API**：`qwen3.8-max`（旗舰）、`qwen3.7-plus`（均衡）、`qwen3.8-flash`（快速）；全模态 `qwen3.5-omni-plus`（含 realtime 版）；检索配套 `qwen3.7-text-embedding` / `-rerank`。
- **开源权重**：Qwen3 系列（[Qwen3](https://github.com/QwenLM/Qwen3) 仓库：235B-A22B（MoE）/30B-A3B/4B 的 Instruct 与 Thinking 双版本，2507 版支持 100 万 token 上下文）；[Qwen3-VL](https://github.com/QwenLM/Qwen3-VL)（视觉）、[Qwen3-Coder](https://github.com/QwenLM/Qwen3-Coder)（代码）、Qwen3-Embedding（检索）、Qwen3-TTS（语音）。
- Qwen 的差异化在于**尺寸阶梯完整**（从 0.6B 到 235B+），本地部署、微调实验（模块 10）几乎总有一档合适。

## 七、智谱 GLM：开源 Agent 旗舰

依据 [zai-org/GLM-5](https://github.com/zai-org/GLM-5) 仓库与 Z.ai 官方博客（2026-09 核实）：

- **GLM-5.3 / GLM-5.3-Flash**：最新版本。GLM-5.3 与 GLM-5.2 共用基座、增益全部来自后训练——编码能力较 5.2 提升 50%（Z.ai Code Bench），并在 CyberGym 漏洞发现上达到 SOTA；GLM-5.3-Flash 则换了新基座，首次在 GLM 系列引入**稀疏+线性注意力混合架构**，显著降低长上下文推理成本。
- **GLM-5.2**：上一代长程任务旗舰，"solid 1M-token context"；Terminal-Bench 2.1 得分 81.0、SWE-bench Pro 62.1（自报，开源模型中最强，距 Claude Opus 4.8 的 85.0 仅数分）。
- GLM-5 系列全部开放权重，可通过 Z.ai API 或私有化部署使用；从 ChatGLM-6B 一路演进而来，是国内开源路线的代表。

## 八、选型坐标系

**表：常见场景 → 建议考察的维度**

| 场景 | 首要维度 | 举例考量 |
| ---- | -------- | -------- |
| 学习/原型开发 | 价格 + 免费/兼容端点 | DeepSeek、GLM-Flash、GPT-5.4-mini 一档 |
| 长文档/大仓库分析 | 有效上下文长度 | GPT-6 Astra（1.05M）、GLM-5.2/Qwen3（1M） |
| 编码 Agent | 基准 + 工具调用稳定性 | Claude Opus 5、GPT-6/5.6、GLM-5.3 |
| 多模态输入 | 原生模态支持 | Gemini 3 系列、Qwen3-VL、GPT-6 |
| 私有化部署/微调 | 开源权重 + 尺寸阶梯 | Qwen3、GLM-5、DeepSeek V4 系 |
| 高并发生产 | 单价 + 吞吐 | 各家 Flash/mini/Lite 档 |

三条贯穿性的观察：

1. **闭源旗舰与开源第一梯队的差距已收敛到个位数基准分**（如 Terminal-Bench 2.1：Claude Opus 4.8 = 85.0 vs GLM-5.2 = 81.0），选型时"够用 + 便宜 + 可控"往往胜过"最强 + 昂贵"；
2. **"混合推理"成为标配**：几乎每个家族都提供"快答/深思"两种模式（DeepSeek 的 `thinking`、Gemini Deep Think、OpenAI 的 `reasoning_effort`、Qwen3 的 Thinking 版本）——本质是把推理时计算量变成可调参数（见《推理模型》与《采样参数》）；
3. **上下文军备竞赛进入百万级**，但"窗口大小 ≠ 有效利用"，请配合模块 8 的 RAG 与模块 5 的上下文工程技术使用。

## 参考链接（全部于 2026-09-13 访问核实）

- Microsoft Learn: [Azure OpenAI models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)（CC BY 4.0）
- Anthropic: [News 发布记录](https://www.anthropic.com/news)
- Google DeepMind: [Gemini 模型页](https://deepmind.google/models/gemini/)
- DeepSeek: [API 文档首页](https://api-docs.deepseek.com/)
- 阿里云: [百炼模型列表](https://help.aliyun.com/zh/model-studio/models)；GitHub: [QwenLM/Qwen3](https://github.com/QwenLM/Qwen3)
- 智谱: GitHub [zai-org/GLM-5](https://github.com/zai-org/GLM-5)；[GLM-5.3 发布博客](https://z.ai/blog/glm-5.3)
