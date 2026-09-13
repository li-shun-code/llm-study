# 模块 8 · RAG（08-rag）来源报告

抓取日期：2026-09-13（本轮增补/重做同日完成）。目标 ≥14 篇，当前 **19 篇**（原 15 篇 + 新增 4 篇；其中原 06 篇按"完整翻译"标准重做并移至 08）。全部通过 `node scripts/check-frontmatter.mjs docs/08-rag`（PASS, 19 articles）。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Pinecone Learn Center](https://www.pinecone.io/learn/) | 01 什么是 RAG（Jenna Pederson, 2025-06）、05 分块策略（Roie Schwaber-Cohen & Arjun Patel, 2025-06）、06 向量相似度（Roie Schwaber-Cohen）、10 混合检索（James Briggs, 2023-06），均全文翻译 | 原文页面未附开源许可，按署名转载处理 | 每篇 frontmatter + 文末署名块 |
| [Anthropic Engineering: Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)（Daniel Ford 等, 2024-09-19） | 05 后半部分（上下文检索 + 重排叠加），全文翻译 | 原文页面未附开源许可，按署名转载处理 | 05 署名块并列标注 |
| [Docling](https://github.com/docling-project/docling) 官方 README（IBM Research） | 02 主来源之一 | MIT | 02 frontmatter + 署名块 |
| [MinerU](https://github.com/opendatalab/MinerU) 官方 README（OpenDataLab） | 02 主来源之一 | MinerU 开源许可（基于 Apache 2.0 + 附加条款；2026-03 起 AGPLv3 迁移而来） | 02 frontmatter + 署名块 |
| [Unstructured](https://github.com/Unstructured-IO/unstructured) 官方 README | 02 主来源之一 | Apache 2.0 | 02 frontmatter + 署名块 |
| [Hugging Face Blog](https://huggingface.co/blog/getting-started-with-embeddings)（Omar Espejel） | 03 主来源（全文翻译；旧 Inference API 端点按当前 sentence-transformers 本地用法改写并标注） | 博客仓库无独立许可证文件，按署名转载处理 | 03 frontmatter + 署名块 |
| [NirDiamant/RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)（Nir Diamant） | 07 multi_faceted_filtering、08 simple_rag（重做）、11 reranking、13 query_transformations、14 multi_model_rag_with_captioning、19 reliable_rag 六个 notebook（ipynb 提取 markdown/code cell 后翻译） | 自定义许可：允许非商业使用、复制、修改与分发，需署名（详见仓库 LICENSE） | 每篇 frontmatter + 文末署名块，`license` 如实标注 |
| [RAGAS docs](https://github.com/explodinggradients/ragas/tree/main/docs)（官方文档仓库 raw） | 09 主来源（rag_eval.md + rag_testset_generation.md） | Apache 2.0 | 09 frontmatter + 署名块 |
| [microsoft/graphrag](https://github.com/microsoft/graphrag) README + [Microsoft Research Blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)（Jonathan Larson、Steven Truitt） | 16 主来源（README 全文 + 博客概念/示例/指标部分） | README 为 MIT；博客按署名转载处理 | 16 frontmatter + 署名块分别标注 |
| [Weaviate Blog: What Is Agentic RAG?](https://weaviate.io/blog/what-is-agentic-rag)（Erika Cardona, 2024-11-05） | 17 主来源（全文翻译） | 原文页面未附开源许可，按署名转载处理 | 17 frontmatter + 署名块 |
| [vanna-ai/vanna](https://github.com/vanna-ai/vanna) README（Vanna 2.0） | 18 主来源 | MIT | 18 frontmatter + 署名块 |
| [FlagOpen/FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding) README（BAAI） | 04 主来源之一（BGE 节，完整翻译） | MIT | 04 frontmatter + 署名块逐节标注 |
| [embeddings-benchmark/mteb](https://github.com/embeddings-benchmark/mteb) README | 04 主来源之一（MTEB 节，完整翻译） | Apache-2.0 | 04 frontmatter + 署名块逐节标注 |
| [QwenLM/Qwen3-Embedding](https://github.com/QwenLM/Qwen3-Embedding) README（Qwen 团队） | 04 主来源之一（Qwen3 节，完整翻译；Reranker 代码节选并注明） | Apache-2.0 | 04 frontmatter + 署名块逐节标注 |
| [run-llama/llama_index](https://github.com/run-llama/llama_index) 官方示例 notebook ×2 | 12 主来源（MetadataReplacementDemo.ipynb + auto_merging_retriever.ipynb，全部单元格翻译收录） | MIT | 12 frontmatter + 署名块 |
| [stanford-futuredata/ColBERT](https://github.com/stanford-futuredata/ColBERT) README（Stanford Future Data Systems） | 15 主来源之一（ColBERT 节，完整翻译） | MIT | 15 frontmatter + 署名块逐节标注 |
| [illuin-tech/colpali](https://github.com/illuin-tech/colpali) README（Illuin Technology） | 15 主来源之一（ColPali 节，完整翻译；模型清单表节选保留代表行并注明） | Apache-2.0 | 15 frontmatter + 署名块逐节标注 |
| [Answer.AI Blog: Small but Mighty](https://www.answer.ai/posts/2024-08-13-small-but-mighty-colbert.html)（Benjamin Clavié, 2024-08-13） | 15 主来源之一（answerai-colbert-small-v1 节，完整翻译） | 原文页面未附开源许可，按署名转载处理 | 15 frontmatter + 署名块逐节标注 |

## 抓取失败与替代记录

| 主题 | 原 URL | 失败原因 | 替代方案 |
| --- | --- | --- | --- |
| 文档分块策略 | weaviate.io/blog/chunking-strategies-for-rag | weaviate.io 全站对 curl 返回空响应（反爬） | 改用 Pinecone《Chunking Strategies for LLM Applications》（同主题一手教程），成功抓取 |
| Agentic RAG | weaviate.io/blog/what-is-agentic-rag | 同上（直连失败） | 改用 Web Reader 工具成功抓取全文，来源不变 |
| Embedding 深入 | weaviate.io/blog/vector-embeddings | 同上（直连失败） | 改用 Hugging Face Blog《Getting Started With Embeddings》，成功抓取 |
| 重排序 | weaviate.io/blog/rerankers | 同上（直连失败） | 改用 NirDiamant/RAG_Techniques《reranking.ipynb》，成功抓取 |
| 03 号备选 | weaviate.io/blog/what-is-retrieval-augmented-generation | 同上（直连失败） | 01 改用 Pinecone《Retrieval-Augmented Generation (RAG)》（Jenna Pederson, 2025-06），成功抓取 |
| 生产化/常见问题 | blog.llamaindex.ai《12 RAG Pain Points and Solutions》 | 站点迁移后 404（www.llamaindex.ai/blog 下不存在） | 改用 NirDiamant/RAG_Techniques《reliable_rag.ipynb》（验证关卡 + 排障框架契合知识点），成功抓取 |
| RAG 评估（备选页） | docs.ragas.io/en/stable/concepts/metrics/available_metrics/ | 页面 JS 渲染抓不到正文 | 改用 GitHub raw（ragas 仓库 docs/），成功抓取 |
| LangChain RAG tutorial | python.langchain.com/docs/tutorials/rag/ | 可抓取，但当前版已改写为 Deep Agents 模式教程，与"最小 RAG 全流程"知识点不匹配 | 06（现 08）改用 NirDiamant《simple_rag.ipynb》；LangChain 深度教程留给模块 9 Agent |
| 元数据过滤 | www.pinecone.io/learn/filter-search/ | **2026-09-13 复核：该文已随 Pinecone Learn 改版下线**（直返 404/首页壳；hybrid-search-intro 等旧文仍在） | 按任务备选方案改用 NirDiamant《multi_faceted_filtering.ipynb》（raw 抓取成功），完整翻译 |
| 句子窗口/自动合并 | NirDiamant/RAG_Techniques 的 sentence-window、auto-merging notebook | **经全仓库文件树核对（git trees API，truncated: false），该仓库从未包含这两个 notebook**（2026-09 现状与历史提交均无） | 改用官方 LlamaIndex 示例 notebook（run-llama/llama_index，MIT，raw 抓取成功）：MetadataReplacementDemo.ipynb + auto_merging_retriever.ipynb |
| ColBERT/ColPali 配文（Weaviate late-interaction） | weaviate.io/blog/late-interaction-and-colbert | weaviate.io 对本环境所有抓取工具持续超时/空响应 | 改用 illuin-tech/colpali 官方 README（Apache-2.0）+ Answer.AI《Small but Mighty》（answerai-colbert-small 发布文，署名转载） |
| Answer.AI ColPali 篇 | answer.ai ColPali 专文 | 检索确认 Answer.AI 站点无 ColPali 专文（站点文章索引全量核对）；ColPali 作者的配套博文在 huggingface.co/blog/manu/colpali，但抓取时 huggingface.co 网络不可达 | 同上：ColPali 部分以官方 colpali 仓库 README 完整翻译替代 |

## 重做记录（06 → 08 最小 RAG）

原 06 篇正文为编者整理版（按要求废弃）。新版 08 篇为 NirDiamant《simple_rag.ipynb》的**完整**翻译：全部 22 个单元格中 20 个知识单元格（9 markdown + 11 code，含 1 个空白代码单元格）逐格收录；代码保持原样（含旧版 `from langchain.document_loaders import ...` 路径、`google.colab` 专用代码、重复的 wget 行），不做改写；时效性校订（当前包路径、helper 函数内联说明、评估一步的 DeepEval 依赖）全部集中在文末明确标注的编者注小节；文末署名块标注完整性与单元格处置。视频推广单元格按原文收录（跟踪跳转链接换为视频直链并注明），访问统计图片单元格未收录并注明。

## 时效性核实与改写记录（硬约束执行）

抓取时点 2026-09-13。所有涉及 SDK 的代码均按当前稳定版校订，改写处在各篇署名块/编者注中显式标注：

| 文章 | 原文中的过时内容 | 处理方式 |
| --- | --- | --- |
| 03 Embedding | Hugging Face 旧版 Inference API 端点（已由 Inference Providers 取代） | 改写为本地 `SentenceTransformers` 调用，署名块标注 |
| 08 最小 RAG（重做） | 旧包路径 + Colab 专用代码 + helper 依赖 | 代码按原文原样收录；等价新写法集中置于文末编者注小节 |
| 10 混合检索 | `pinecone.init` + pod 索引（旧版客户端/pod 架构） | 概念与稀疏/稠密构造代码照译；旧客户端段落按"演进"语境转写并给出当前 serverless 等价思路 |
| 11 重排序 | `RetrievalQA`（LangChain legacy Chain，禁收）+ `from langchain.docstore.document` 旧路径 | `RetrievalQA` 段改写为直接函数组合（初检→重排→生成），import 换 `langchain_core.documents`，署名块标注 |
| 13 查询改写 | `from langchain.prompts import PromptTemplate` 旧路径 | 换 `langchain_core.prompts`（LCEL 管道本身已是当前风格，未改逻辑） |
| 14 多模态 | `google.generativeai` SDK（已弃用）+ `langchain.text_splitter` 旧路径 | 改写为当前 `google-genai` SDK；import 换 `langchain_text_splitters` |
| 16 GraphRAG | — | 保留官方"维护模式"警告（2026 现状如实呈现），`graphrag init/index/query` 命令为当前 CLI |
| 19 生产化 | Groq `mixtral-8x7b-32768`（已退役）+ 旧 import 路径 | 换当前 `llama-3.3-70b-versatile`；import 换当前路径 |
| 12 句子窗口/父子块 | notebook 中 `gpt-3.5-turbo`/`gpt-4` 为原文演示所用模型 | 按原文翻译收录，未擅自替换模型名（官方示例原样） |
| 15 ColBERT/ColPali | colpali-engine 已官方宣布弃用（迁移至 Sentence Transformers v6 `MultiVectorEncoder`） | 弃用公告与迁移表一并完整翻译，体现 2026-09 现状 |

## 其他说明

- Weaviate 官方博客直连不可抓（返回空响应），其相关主题均已按上表替换为等价一手来源，无悄悄丢文。
- NirDiamant/RAG_Techniques 的 LICENSE 为自定义许可（非商业使用、需署名），已按仓库实际 LICENSE 如实登记并在每篇 frontmatter 标注。
- 站内编号引用已随重排全部校正（原 04→05、05→06、06→08、07→09、08→10、09→11、10→13、11→14、12→16、13→17、14→18、15→19；index.md 与 manifest 同步）。
- 全模块文章均为全文翻译（含代码块保留），术语首现标注英文；编者补充内容均以"编者注"显式区隔，不与原文混写。
- 复核工具残留物清理：本轮未在任何文章中保留抓取工具的 HTML/短代码残留；Redis 篇的 Hugo 短代码、Answer.AI 页面标签均已转写为标准 Markdown（已用脚本复核两目录无围栏外 `{{ }}` 与裸 HTML）。
