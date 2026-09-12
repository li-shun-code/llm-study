# 模块 4 · LLM 基础（04-llm-basics）来源报告

抓取日期：2026-09-13。目标 ≥10 篇，实际完成 **10 篇**，全部通过 `node scripts/check-frontmatter.mjs docs/04-llm-basics`（PASS (10 articles)）。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [DataWhale happy-llm](https://github.com/datawhalechina/happy-llm)（LICENSE.txt：CC BY-NC-SA 4.0） | 5 篇主来源（01 词向量到 Transformer、02 注意力机制、03 GPT 演进、06 训练范式；04 的 1.3.2 子词切分、08 的 4.1.3 幻觉定义为部分转载） | CC BY-NC-SA 4.0 | 每篇 frontmatter `author: DataWhale happy-llm 项目` + 文首署名块，`source_url` 指向 raw 原文 |
| [Hugging Face LLM Course](https://huggingface.co/learn/llm-course)（[course 仓库](https://github.com/huggingface/course) Apache License 2.0） | 04 的 BPE 算法与分词粒度章节（raw 抓取 `huggingface/course/chapters/en/chapter6/5.mdx`、`chapter2/4.mdx`，翻译） | Apache 2.0 | 04 文首署名块并列标注 |
| [Hugging Face Transformers 官方文档 Generation strategies](https://huggingface.co/docs/transformers/generation_strategies)（[transformers 仓库](https://github.com/huggingface/transformers) Apache 2.0） | 05 主来源（raw 抓取 `docs/source/en/generation_strategies.md`，翻译） | Apache 2.0 | 05 frontmatter + 署名块 |
| [OpenAI Cookbook](https://github.com/openai/openai-cookbook)（MIT） | 08 主来源（raw 抓取 `articles/techniques_to_improve_reliability.md`，翻译改编）；04 的 tiktoken 章节（`examples/How_to_count_tokens_with_tiktoken.ipynb`，改编） | MIT | 08/04 署名块标注 |
| [Microsoft Learn: Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)（[azure-docs 仓库](https://github.com/MicrosoftDocs/azure-docs) CC BY 4.0） | 09 主来源（`ai-foundry/openai/how-to/reasoning` 页面，翻译）；03/07 的 OpenAI 模型版本数据 | CC BY 4.0 | 09 frontmatter + 署名块；03/07 署名块标注 |
| [Hugging Face Blog](https://huggingface.co/blog/vlms-2025)（[blog 仓库](https://github.com/huggingface/blog) raw 抓取 `vlms-2025.md`） | 10 主来源（节选翻译） | 博客仓库无独立许可证文件，按署名转载处理 | 10 frontmatter + 署名块，license 字段如实标注 |
| 各家官方页面（anthropic.com/news、deepmind.google、api-docs.deepseek.com、help.aliyun.com、github.com/zai-org 等） | 07 主流模型生态对比（编译）；06 的 GRPO 补注 | 官方公开资料，仅事实性引用并附链接 | 07 署名块声明编译性质，文末列全部参考链接 |

## 时效性核实记录（硬约束执行）

模型对比篇（07）及涉及版本信息的文章（03/04/09/10）均以 **2026-09-13 执行时联网核实**为准：

| 家族 | 核实结论（2026-09-13） | 核实渠道 |
| --- | --- | --- |
| OpenAI | 旗舰 **GPT-6 Astra**（`gpt-6-astra`，2026-09-03 发布，1.05M 上下文，知识截止 2026-04，不支持自定义 temperature/top_p，工具调用要求 Responses API）；上代旗舰 GPT-5.6 系列（sol/terra/luna，2026-07-09） | [Microsoft Learn: Azure OpenAI models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)（官方页面直抓并与搜索结果交叉验证；早期搜索摘要中的"GPT-5.2 仍为旗舰"等说法已被此权威源纠正） |
| Anthropic | **Claude Opus 5**（2026-07）、Sonnet 5、Haiku 4.5 公开在售；Claude Fable 5.1 / Mythos 5.1（2026-09-01，限定访问）为内部最强 | [anthropic.com/news](https://www.anthropic.com/news) 官方发布记录直抓 |
| Google | **Gemini 3.8 Flash**（主力，$0.75/$3.75 每百万 token 限时价）、Gemini 3.1 Pro、3.1 Deep Think、3.5 Flash-Lite；3.5 Pro 预告中 | [deepmind.google/models/gemini](https://deepmind.google/models/gemini/) |
| DeepSeek | 当前模型名 **`deepseek-flash`**（由 DeepSeek-V4.1-Flash 服务）；V4 Pro 服务延续至 2026-09-14 后；支持 `thinking` + `reasoning_effort` | [api-docs.deepseek.com](https://api-docs.deepseek.com/) |
| 阿里 Qwen | 商业 API `qwen3.8-max` / `qwen3.7-plus` / `qwen3.8-flash`、全模态 `qwen3.5-omni-plus`；开源 Qwen3 系列（2507 版 235B-A22B 等，1M 上下文）、Qwen3-VL/Coder/Embedding | [阿里云百炼模型列表](https://help.aliyun.com/zh/model-studio/models) + [QwenLM GitHub](https://github.com/QwenLM) |
| 智谱 GLM | **GLM-5.3 / GLM-5.3-Flash**（最新，稀疏+线性注意力混合架构）、GLM-5.2（1M 上下文旗舰） | [zai-org/GLM-5](https://github.com/zai-org/GLM-5) + z.ai 官方博客 |

其余时效性处理：05 采样参数按 Responses API 时代写法并明确标注推理模型不支持 temperature/top_p；08 幻觉的旧版 GPT-3 示例保留为"历史实验"语境并补充 Responses API 写法；09 推理模型通篇为 GPT-5.6/GPT-6 + DeepSeek V4 现行 API。

## 抓取失败与替代

| 主题 | 原计划来源 | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| 08 幻觉成因与缓解 | Anthropic 官方文档 "Reduce hallucinations"（docs.claude.com / platform.claude.com） | docs.claude.com 为 JS 渲染 SPA（curl 只能取到 SPA 壳）；platform.claude.com 在本环境 307 重定向至 "app-unavailable-in-region"（WebFetch 同样不可达） | 改用 [OpenAI Cookbook · Techniques to improve reliability](https://github.com/openai/openai-cookbook/blob/main/articles/techniques_to_improve_reliability.md)（MIT，翻译改编）+ happy-llm 幻觉定义（CC BY-NC-SA），已在 08 署名块注明 |
| 04 Token/BPE 备选 | so-large-lm（DataWhale）ch03 BPE 章节 | 已抓取可用，但仓库 GitHub API `license: null`、README 无许可声明，按默认版权放弃作为转载源 | BPE 内容改用许可明确的 HF LLM Course（Apache 2.0） |
| 05 采样备选 | HF Blog《How to generate text》（how-to-generate.md） | 已抓取可用，但博客仓库无许可证文件，谨慎起见不作主来源 | 主来源改用 transformers 官方文档 Generation strategies（Apache 2.0），博客仅作参考链接 |

## 其他抓取过程记录

- happy-llm 章节文件名含中文与方括号（如 `6.4[WIP] 偏好对齐.md`），raw URL 需 percent-encode；`chapter3/chapter6/chapter6.4` 首轮并行下载有 3 个文件静默失败（网络瞬断），重试全部成功，无永久失败项。
- huggingface.co 主站在本环境 curl/WebFetch 不可达，但 huggingface/course、huggingface/transformers、huggingface/blog 的 **GitHub raw 镜像均可直接抓取**，全部内容改走 raw 通道。
- 04 "中文 token 成本"数据为本站用 tiktoken（Python venv 安装，o200k_base / cl100k_base 最新编码表）**实测**所得，非转抄。
- 原文含 `<div align="center">` 图片块与 LaTeX 公式，入库时统一转换为 Markdown 图片 + `**图：xxx**` 题注 + Unicode 数学文本（与模块 1 处理约定一致）；所有图片 URL 逐一验证 HTTP 200（共 7 张）。
- manifest 记录于 `docs/.vitepress/manifest/04-llm-basics.json`（10 条）。
