# 模块 10 · 微调与部署（10-finetuning-deployment）来源报告

抓取日期：2026-09-13（本次补充与重做）。目标 20 篇（17 篇既有 + 3 篇新增 + 4 篇重做），全部通过 `node scripts/check-frontmatter.mjs docs/10-finetuning-deployment`（PASS, 20 articles）。

## 本次变更概览

- **新增 3 篇**：08 继续预训练 CPT 与领域自适应、12 GRPO 与 RLVR、17 推理服务生产化运维；
- **重做 4 篇**（编者总结正文替换为原文完整翻译）：13 模型量化基础、15 Ollama 本地部署、18 开源模型选型、19 LLM 评测方法与基准；
- **重排**：原 08–17 顺延（08→09、09→10、10→11、11→13、12→14、13→15、14→16、15→18、16→19、17→20，两段式重命名），frontmatter order 同步；
- 新增/重做正文主体均为官方仓库/官方文档的**完整翻译**，编者内容仅限导语、节间衔接与署名块说明，逐节署名见各篇文末。

## 来源与许可（含既有篇目）

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners) 第 18 课 | 01 选型 | MIT | frontmatter + 署名块 |
| [DataWhale happy-llm](https://github.com/datawhalechina/happy-llm) 第六章 | 02 训练范式、04 LoRA 原理 | CC BY-NC-SA 4.0 | frontmatter + 署名块 |
| [AutoDL 帮助文档](https://www.autodl.com/docs/) | 03 GPU 环境 | 未附开源许可，署名转载 | frontmatter + 署名块 |
| [Hugging Face PEFT 文档](https://huggingface.co/docs/peft) + bitsandbytes README | 05 QLoRA | Apache 2.0 | frontmatter + 署名块 |
| [Hugging Face TRL 文档](https://huggingface.co/docs/trl)（GitHub sparse clone，主分支） | 06 数据格式、09 超参、10 SFT、11 DPO（原 08/09/10）、**08 新增**之一（dataset_formats 语言建模 + sft_trainer 数据类型 + reducing_memory_usage packing）、**12 新增**之二（grpo_trainer 全页） | Apache 2.0 | 各篇 frontmatter + 署名块 |
| [huggingface/smol-course](https://github.com/huggingface/smol-course) | 07 合成数据 | Apache 2.0 | frontmatter + 署名块 |
| [hiyouga/LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) data/README.md（Pre-training Dataset） | **08 新增**之二：LLaMA-Factory 预训练数据集格式全译 | Apache 2.0 | 08 frontmatter + 文末逐节署名 |
| [QwenLM/Qwen3.5](https://github.com/QwenLM/Qwen3.5) 与 [QwenLM/Qwen3](https://github.com/QwenLM/Qwen3) README Finetuning 章节 | **08 新增**之三：Qwen 官方微调文档要点全译 | Apache 2.0 | 08 frontmatter + 文末逐节署名 |
| [deepseek-ai/DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1) README（Introduction / Model Summary / Usage Recommendations / vLLM 用法） | **12 新增**之一：纯 RL 推理模型与可验证奖励（RLVR）背景全译 | MIT（LICENSE 核实） | 12 frontmatter + 文末逐节署名 |
| [vLLM 官方博客](https://blog.vllm.ai/2023/06/20/vllm.html)与官方文档 | 14 推理原理（原 12）、16 vLLM 部署（原 14） | Apache 2.0 | 各篇 frontmatter + 署名块 |
| [Ollama 官方 README](https://raw.githubusercontent.com/ollama/ollama/main/README.md) + docs.ollama.com（quickstart/cli/import/gpu/faq/docker 六页，llms.txt 索引） | **15 重做**：README 全译 + 六份官方文档页全译 | MIT | 15 frontmatter + 文末逐节署名 |
| [vLLM 官方文档 deployment 章节](https://docs.vllm.ai/en/latest/deployment/k8s/)（k8s.md / production-stack.md / nginx.md，GitHub 仓库 docs/ 同源） | **17 新增**：Kubernetes 原生部署、production stack（Helm + 路由 + LMCache）、Nginx 负载均衡全译 | Apache 2.0 | 17 frontmatter + 文末逐节署名 |
| [Hugging Face Transformers 文档 Quantization Overview](https://huggingface.co/docs/transformers/quantization/overview)（GitHub 仓库 docs/source/en/quantization/overview.md）+ [bitsandbytes README](https://github.com/bitsandbytes-foundation/bitsandbytes) | **13 重做**：量化方法选型总览（完整选型表）+ bitsandbytes（三大特性 + 完整平台支持矩阵）全译 | Apache 2.0 / MIT | 13 frontmatter + 文末逐节署名 |
| [QwenLM/Qwen3.5](https://github.com/QwenLM/Qwen3.5)、[zai-org/GLM-5](https://github.com/zai-org/GLM-5)、[deepseek-ai/DeepSeek-V3.2](https://github.com/deepseek-ai/DeepSeek-V3.2) 官方 README | **18 重做**：三家模型卡完整翻译对照（Qwen3.8/3.6/3.5 全系、GLM-5.3/5.2/5.1/5、DeepSeek-V3.2-Exp 含基准表） | Apache 2.0 / MIT | 18 frontmatter + 文末逐节署名 |
| [EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) README | **19 重做**：README 全译（News/Plugins/概览/安装/HF 与 GGUF 后端/accelerate 多 GPU/原生 TP/nemo/Megatron-LM/vLLM/SGLang/ONNX 双后端/Windows ML/API 总表/高级用法/缓存/可视化/贡献/extras 三表） | MIT（LICENSE.md 核实） | 19 frontmatter + 文末逐节署名 |
| [OWASP GenAI Security Project](https://genai.owasp.org/llm-top-10/) + [NVIDIA NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails) | 20 安全护栏（原 17） | CC BY-SA 4.0 / Apache 2.0 | frontmatter + 署名块 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| TRL continued_pretraining.md | raw.githubusercontent.com/huggingface/trl/main/docs/source/continued_pretraining.md | 404（main 分支与 v0.19–v0.24 各 tag 均无此文件，已逐一探测） | 改用 TRL 现役官方文档中最贴近 CPT 的三页（dataset_formats 语言建模、sft_trainer 数据类型、reducing_memory_usage packing）完整翻译 |
| HF 博客 continuation-pretraining 篇 | huggingface.co/blog/continuation-pretraining | 该 slug 的博文不存在（huggingface/blog 官方仓库 2643 个文件 grep 无此篇；社区博文不在仓库内）；且 huggingface.co 全站对本环境不可达（curl HTTP 000，同上次会话） | 以 LLaMA-Factory 官方 data/README 预训练数据集节（Qwen 官方推荐框架）+ Qwen 官方 README 微调章节替代，已在 08 篇署名块完整披露 |
| huggingface.co（Transformers/TRL 文档站与博客） | huggingface.co/docs/... | 全站网络不可达（000） | 一律改走 GitHub 仓库源文件（transformers docs/source/en/quantization/overview.md、trl docs/source/*.md，与站点渲染内容一致、许可相同） |
| docs.vllm.ai 网页版 | docs.vllm.ai/en/latest/deployment/k8s/ | JS 渲染（curl 得空壳） | 官方仓库 vllm-project/vllm docs/ 目录 sparse clone（与文档站同源 mkdocs 源） |
| docs.ollama.com | docs.ollama.com/faq.md 等 | 可达 | 直接以 .md 端点抓取成功（llms.txt 索引） |
| QwenLM/Qwen3.5 仓库 clone | github.com/QwenLM/Qwen3.5 | sparse clone 超时 | README 经 raw.githubusercontent.com 直抓成功 |
| LoRA 备选/Colab/Anyscale/MCP docs 网页版等 | （同上次会话记录） | 维持上次结论 | 不变 |

## 时效性核实与改写记录

抓取时点 2026-09-13：

| 文章 | 处理方式 |
| --- | --- |
| 08 CPT | TRL 为主分支当前版（language modeling 数据集、BFD/bfd_split/wrapped 三种 packing 策略含 Qwen3-Coder-Next 技术报告对 wrapped 的批评）；LLaMA-Factory 为 main 当前版；Qwen 为 Qwen3.5/Qwen3 当前 README |
| 12 GRPO | TRL grpo_trainer 为主分支当前版：loss_type 含 dapo/dr_grpo/sapo（及 cispo/vespo 指标）、vLLM colocate/server 两模式（nccl 权重迁移 + processed_logprobs）、训练-推理失配与 TIS/MIS 重要性采样、transformers continuous batching、Agent Training（tools/environments/多环境/多模态工具响应/OpenEnv/OpenReward/Harbor）、自适应熵（Skywork-OR1）；DeepSeek-R1 README 为当前版（温度 0.5–0.7、禁 system prompt、\</think\> 强制开头等原始建议） |
| 13 量化 | Transformers overview 为主分支当前版（22 种量化方法选型表：含 GPTQModel 接替 AutoGPTQ 为 GPTQ 行、新增 AutoRound/Four Over Six/FP-Quant/HIGGS/Metal/NVFP4/SINQ/FBGEMM_FP8/SpQR/Quark 等）；bitsandbytes 为当前开发分支支持矩阵（Linux/Windows/macOS × x86-64/aarch64/arm64 × NVIDIA/AMD/Intel/Gaudi/Metal/CPU） |
| 15 Ollama | 2026-09 当前版：ollama launch 集成（Claude Code/Codex/OpenCode/VS Code/Droid）、gemma4 示例、cloud 模式与 `OLLAMA_NO_CLOUD`/`disable_ollama_cloud` 纯本地模式、`OLLAMA_CONTEXT_LENGTH` 默认 4096、ROCm v7、Vulkan 默认启用、GGUF/gguf 双评测路径在 lm-eval 侧的说明 |
| 17 生产化 | vLLM 文档 latest：k8s CPU/GPU(NVIDIA/AMD ROCm)/gRPC 健康探针、KeyboardInterrupt 排查；production stack（Helm chart、模型感知/前缀感知路由、LMCache KV 卸载 `--kv-offloading-backend lmcache`）；Nginx least_conn 负载均衡 |
| 18 选型 | 联网核实至 2026-09：Qwen3.8（2026-08-14 发布，27B 与 2.4T-A95B）、GLM-5.3/5.3-Flash（320B-A18B 混合注意力 + mHC）、DeepSeek-V3.2-Exp（DSA，含 2025-11-17 RoPE indexer 修复公告）；DeepSeek-V4 经 raw 探测不存在（404） |
| 19 评测 | lm-eval 主分支当前版：2026/09 Plugins 机制、2025/12 CLI 子命令重构与更轻安装（`lm_eval[hf/vllm/api]` extras）、gguf 后端（llama.cpp server、id_slot 槽位钉扎）、原生 tp_plan 张量并行、Megatron-LM 后端、Windows ML/ONNX 双后端 |
| 既有各篇 | 未改动正文；仅重命名与 order 同步 |
