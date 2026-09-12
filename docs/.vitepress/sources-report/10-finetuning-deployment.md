# 模块 10 · 微调与部署（10-finetuning-deployment）来源报告

抓取日期：2026-09-13。目标 ≥16 篇，实际完成 **17 篇**（任务清单 17 个知识点全部落篇），全部通过 `node scripts/check-frontmatter.mjs docs/10-finetuning-deployment`。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [microsoft/generative-ai-for-beginners](https://github.com/microsoft/generative-ai-for-beginners) 第 18 课 Fine-Tuning Your LLM | 01 主来源（全文翻译；Azure Foundry 平台操作步骤节选并标注） | MIT | 01 frontmatter + 署名块 |
| [DataWhale happy-llm](https://github.com/datawhalechina/happy-llm) 第六章《大模型训练流程实践》 | 02 主来源（预训练 + SFT 全流程，中文转载；超长分布式脚本节选并标注）；04 主来源（6.3 高效微调与 LoRA 原理，中文转载） | CC BY-NC-SA 4.0（LICENSE.txt 核实） | 02/04 frontmatter + 署名块 |
| [AutoDL 帮助文档](https://www.autodl.com/docs/)（《快速开始》《GPU 选型》《CUDA/cuDNN》） | 03 主来源（中文转载） | 原文页面未附开源许可，按署名转载处理 | 03 frontmatter + 署名块 |
| [Hugging Face PEFT 文档](https://huggingface.co/docs/peft)（developer_guides/quantization；conceptual_guides/adapter@v0.19.0） | 05 主来源（全文翻译）；04 编者注（PEFT 现状与 all-linear 最佳实践） | Apache 2.0 | 05 frontmatter + 署名块；04 署名块注明含编者补充 |
| [bitsandbytes README](https://github.com/bitsandbytes-foundation/bitsandbytes) | 05 背景（三大特性翻译）；11 训练侧量化主来源之一 | Apache 2.0（仓库 LICENSE 徽章核实） | 05/11 frontmatter + 署名块 |
| [Hugging Face TRL 文档](https://huggingface.co/docs/trl)（dataset_formats / sft_trainer / dpo_trainer / lora_without_regret / distillation_trainer，主分支） | 06 主来源；09 主来源；10 主来源；08 主来源；07 蒸馏部分主来源 | Apache 2.0 | 各篇 frontmatter + 署名块 |
| [huggingface/smol-course](https://github.com/huggingface/smol-course)（v1/6_synthetic_datasets、v1/4_evaluation） | 07 合成数据部分主来源（全文翻译）；06 清洗清单、16 评测策略部分 | Apache 2.0（LICENSE 核实） | 07/16 署名块；06 署名块注明编译来源 |
| [vLLM 官方博客](https://blog.vllm.ai/2023/06/20/vllm.html)（PagedAttention 发布文）与[官方文档](https://docs.vllm.ai)（quickstart / deployment/docker / design/arch_overview / features/quantization） | 12 主来源（博客全文 + V1 架构概览翻译）；14 主来源（quickstart + docker 全文翻译）；11 部署侧量化主来源 | Apache 2.0（vLLM 项目） | 各篇 frontmatter + 署名块 |
| [Ollama 官方 README](https://github.com/ollama/ollama) 与[官方文档](https://docs.ollama.com)（quickstart / cli / openai compatibility / docker / modelfile） | 13 主来源（全文翻译） | MIT | 13 frontmatter + 署名块 |
| [QwenLM/Qwen3.5](https://github.com/QwenLM/Qwen3.5)、[zai-org/GLM-5](https://github.com/zai-org/GLM-5)、[deepseek-ai/DeepSeek-V3.2](https://github.com/deepseek-ai/DeepSeek-V3.2) 官方 README | 15 主来源（三仓库综合编译） | Apache 2.0（Qwen/GLM）、MIT（DeepSeek） | 15 frontmatter + 署名块并列标注 |
| [EleutherAI/lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness) README | 16 主来源（overview/安装/用法/vLLM 后端全文翻译） | MIT（LICENSE.md 核实） | 16 frontmatter + 署名块 |
| [OWASP GenAI Security Project](https://genai.owasp.org/llm-top-10/)（LLM Top 10 2025 主页 + LLM01–LLM10 十个风险条目页） | 17 主来源（十大风险全文翻译） | CC BY-SA 4.0（站点页脚核实；本篇译文以相同方式共享） | 17 frontmatter + 署名块 |
| [NVIDIA NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails) README | 17 护栏实现部分主来源（全文翻译） | Apache 2.0（LICENSE.md 核实） | 17 frontmatter + 署名块 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| LoRA 原理（备选） | huggingface.co/docs/peft/conceptual_guides/lora | huggingface.co 对本机网络完全不可达（curl HTTP=000，WebFetch 亦 ECONNREFUSED）；且该页在 PEFT v0.15 起已从文档移除 | LoRA 原理改用 DataWhale happy-llm 6.3（中文，CC BY-NC-SA）；PEFT 现状经 git sparse clone 仓库内文档（developer_guides/methods）核实后写入编者注 |
| QLoRA（备选） | huggingface.co/docs/peft/conceptual_guides/qlora | 同上（页面已移除） | 改用仓库内 developer_guides/quantization.md（git clone，PEFT 当前版，Apache 2.0） |
| TRL SFT/DPO/数据格式文档 | huggingface.co/docs/trl/* | 同上（网络不可达） | git sparse clone huggingface/trl 仓库 docs/source/ 取主分支文档源文件（与站点内容一致，Apache 2.0） |
| 推理原理（continuous batching 备选） | www.anyscale.com/blog/continuous-batching-LLM-inference | 页面 JS 渲染，html2md 仅得 34 字节空壳 | continuous batching 概念以编者注形式补充（对照表），并引用 vLLM 官方文档 V1 架构概览（engine core 忙循环连续调度）作为一手来源 |
| GPU 环境（Colab 部分） | research.google.com/colaboratory/faq.html | curl 超时（exit 28，网络不可达） | Colab 以编者注形式简述（免费 T4、用途定位），主来源改为 AutoDL 帮助文档三篇（任务候选清单内来源） |
| 模型选型（核实 Qwen 最新仓库） | github.com/QwenLM/Qwen3（README 停在 Qwen3-2507） | 内容过时（时效性约束） | git sparse raw 探测发现 QwenLM/Qwen3.5 仓库（Qwen3.8，2026-08 更新），改用之；GLM 用 zai-org/GLM-5（GLM-5.3，2026 年）；DeepSeek 用 deepseek-ai/DeepSeek-V3.2（DeepSeek-V4 经 raw 探测不存在，404） |

## 时效性核实与改写记录（硬约束执行）

抓取时点 2026-09-13。所有代码与 API 均按当前稳定版校订，改写处在各篇署名块/编者注中显式标注：

| 文章 | 原文中的过时/平台特定内容 | 处理方式 |
| --- | --- | --- |
| 01 选型 | generative-ai-for-beginners 第 18 课的 Azure Foundry 平台操作步骤 | SFT/DPO/RFT 技术对照与最佳实践全文翻译；Foundry 操作步骤节选为编者注并给出原文链接 |
| 02 训练范式 | happy-llm 使用 Qwen-2.5-1.5B 为示例 | 如实保留（原文即当前版）；篇末编者注指出 TRL `SFTTrainer` 为其现代等价物 |
| 04 LoRA | happy-llm 原理篇"只调注意力四矩阵、r=4/8/16"为 2021 年论文结论 | 如实转载，编者注补充 2025《LoRA Without Regret》结论（all-linear、SFT r=256）与本站交叉引用 |
| 05 QLoRA | — | PEFT 当前 API（BitsAndBytesConfig/prepare_model_for_kbit_training）；补充显存账单表 |
| 06–10 TRL 各篇 | — | 全部为主分支文档：`loss_type="chunked_nll"`、`assistant_only_loss`、`DistillationTrainer`（on-policy GKD）、`LoraConfig(target_modules="all-linear")`、DPO 多损失组合（MPO）等均为当前特性；删除了文档内嵌的 trackio iframe（VitePress 不适用）并在文内以文字说明 |
| 12 推理原理 | vLLM 博客为 2023 年发布文（数据如"24x HF"） | 如实翻译并保留历史语境；V1 架构部分译自 2026-09 官方 arch_overview（多进程/ZMQ/--api-server-count 等 V1 专有内容） |
| 13 Ollama | — | 2026-09 当前版：`ollama launch` 集成、gemma4 示例、docs.ollama.com 新文档站内容（OpenAI 兼容端点为 `/v1`） |
| 14 vLLM 部署 | — | V1 引擎当前文档：`uv pip install vllm --torch-backend=auto`、`vllm serve`、docker 非根用户（UID 2000）、编译缓存卷 |
| 15 模型选型 | — | 联网核实至 2026-09：Qwen3.8（2026-08-14 发布）、GLM-5.3、DeepSeek-V3.2；DeepSeek-V4 探测不存在 |
| 16 评测 | — | lm-eval 当前安装方式（可选 extras：`lm_eval[hf,vllm,api]`）与 `lm-eval run` 新 CLI |
| 17 安全 | — | OWASP LLM Top 10 为 2025 版（当前最新）；十项风险名称按 2025 版（含 LLM07 System Prompt Leakage 等新条目） |

## 其他说明

- 目标 ≥16 篇，实际 17 篇，任务清单 17 个知识点一一对应，无合并、无缺漏。
- huggingface.co 全站对本环境网络不可达（curl/WebFetch/web-reader 三通道均失败/限流），PEFT/TRL/HF 课程文档一律改走 **GitHub 仓库 git sparse clone**（文档源文件与站点渲染内容一致，且同为 Apache 2.0 许可），来源未降低权威性。
- GitHub REST API 触发匿名限流（rate limit），改用 raw.githubusercontent.com 与 git 协议获取，无影响。
- 各篇编者补充（显存估算、loss 曲线判读、选型建议、合规清单等）均以"编者注/编者补充"显式区隔，不与原文混写；术语首现均标注英文。
- 09 篇文档原警示中 Jinja 标签（`{% generation %}`）以行内代码形式保留。
