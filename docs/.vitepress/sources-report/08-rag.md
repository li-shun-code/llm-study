# 模块 8 · RAG（08-rag）来源报告

抓取日期：2026-09-13。目标 ≥14 篇，实际完成 **15 篇**，全部通过 `node scripts/check-frontmatter.mjs docs/08-rag`。

## 来源与许可

| 来源 | 用途 | 许可 | 署名方式 |
| --- | --- | --- | --- |
| [Pinecone Learn Center](https://www.pinecone.io/learn/) | 01 什么是 RAG（Jenna Pederson, 2025-06）、04 分块策略（Roie Schwaber-Cohen & Arjun Patel, 2025-06）、05 向量相似度（Roie Schwaber-Cohen）、08 混合检索（James Briggs, 2023-06），均全文翻译 | 原文页面未附开源许可，按署名转载处理 | 每篇 frontmatter + 文首署名块 |
| [Anthropic Engineering: Introducing Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval)（Daniel Ford 等, 2024-09-19） | 04 后半部分（上下文检索 + 重排叠加），全文翻译 | 原文页面未附开源许可，按署名转载处理 | 04 署名块并列标注 |
| [Docling](https://github.com/docling-project/docling) 官方 README（IBM Research） | 02 主来源之一 | MIT | 02 frontmatter + 署名块 |
| [MinerU](https://github.com/opendatalab/MinerU) 官方 README（OpenDataLab） | 02 主来源之一 | MinerU 开源许可（基于 Apache 2.0 + 附加条款；2026-03 起 AGPLv3 迁移而来） | 02 frontmatter + 署名块 |
| [Unstructured](https://github.com/Unstructured-IO/unstructured) 官方 README | 02 主来源之一 | Apache 2.0 | 02 frontmatter + 署名块 |
| [Hugging Face Blog](https://huggingface.co/blog/getting-started-with-embeddings)（Omar Espejel） | 03 主来源（全文翻译；旧 Inference API 端点按当前 sentence-transformers 本地用法改写并标注） | 博客仓库无独立许可证文件，按署名转载处理 | 03 frontmatter + 署名块 |
| [NirDiamant/RAG_Techniques](https://github.com/NirDiamant/RAG_Techniques)（Nir Diamant） | 06 simple_rag、09 reranking、10 query_transformations、11 multi_model_rag_with_captioning、15 reliable_rag 五个 notebook（ipynb 提取 markdown/code cell 后翻译） | 自定义许可：允许非商业使用、复制、修改与分发，需署名（详见仓库 LICENSE） | 每篇 frontmatter + 署名块，`license` 如实标注 |
| [RAGAS docs](https://github.com/explodinggradients/ragas/tree/main/docs)（官方文档仓库 raw） | 07 主来源（rag_eval.md + rag_testset_generation.md） | Apache 2.0 | 07 frontmatter + 署名块 |
| [microsoft/graphrag](https://github.com/microsoft/graphrag) README + [Microsoft Research Blog](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)（Jonathan Larson、Steven Truitt） | 12 主来源（README 全文 + 博客概念/示例/指标部分） | README 为 MIT；博客按署名转载处理 | 12 frontmatter + 署名块分别标注 |
| [Weaviate Blog: What Is Agentic RAG?](https://weaviate.io/blog/what-is-agentic-rag)（Erika Cardona, 2024-11-05） | 13 主来源（全文翻译） | 原文页面未附开源许可，按署名转载处理 | 13 frontmatter + 署名块 |
| [vanna-ai/vanna](https://github.com/vanna-ai/vanna) README（Vanna 2.0） | 14 主来源 | MIT | 14 frontmatter + 署名块 |

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
| LangChain RAG tutorial | python.langchain.com/docs/tutorials/rag/ | 可抓取，但当前版已改写为 Deep Agents 模式教程，与"最小 RAG 全流程"知识点不匹配 | 06 改用 NirDiamant《simple_rag.ipynb》（按当前版 SDK 校订 import 与生成步）；LangChain 深度教程留给模块 9 Agent |

## 时效性核实与改写记录（硬约束执行）

抓取时点 2026-09-13。所有涉及 SDK 的代码均按当前稳定版校订，改写处在各篇署名块/编者注中显式标注：

| 文章 | 原文中的过时内容 | 处理方式 |
| --- | --- | --- |
| 03 Embedding | Hugging Face 旧版 Inference API 端点（已由 Inference Providers 取代） | 改写为本地 `SentenceTransformers` 调用，署名块标注 |
| 06 最小 RAG | `from langchain.document_loaders import ...` 旧包路径；依赖仓库 helper 模块 | 改为 `langchain_community` / `langchain_text_splitters` 当前路径，helper 内联；补生成步（`ChatOpenAI` + `gpt-4o-mini`） |
| 08 混合检索 | `pinecone.init` + pod 索引（旧版客户端/pod 架构） | 概念与稀疏/稠密构造代码照译；旧客户端段落按"演进"语境转写并给出当前 serverless 等价思路 |
| 09 重排序 | `RetrievalQA`（LangChain legacy Chain，禁收）+ `from langchain.docstore.document` 旧路径 | `RetrievalQA` 段改写为直接函数组合（初检→重排→生成），import 换 `langchain_core.documents`，署名块标注 |
| 10 查询改写 | `from langchain.prompts import PromptTemplate` 旧路径 | 换 `langchain_core.prompts`（LCEL 管道本身已是当前风格，未改逻辑） |
| 11 多模态 | `google.generativeai` SDK（已弃用）+ `langchain.text_splitter` 旧路径 | 改写为当前 `google-genai` SDK；import 换 `langchain_text_splitters` |
| 12 GraphRAG | — | 保留官方"维护模式"警告（2026 现状如实呈现），`graphrag init/index/query` 命令为当前 CLI |
| 15 生产化 | Groq `mixtral-8x7b-32768`（已退役）+ 旧 import 路径 | 换当前 `llama-3.3-70b-versatile`；import 换当前路径 |

## 其他说明

- Weaviate 官方博客直连不可抓（返回空响应），其 3 个相关主题均已按上表替换为等价一手来源，无悄悄丢文。
- NirDiamant/RAG_Techniques 的 LICENSE 为自定义许可（非商业使用、需署名），与任务候选清单所标"Apache/MIT 以仓库为准"不符，已按仓库实际 LICENSE 如实登记并在每篇 frontmatter 标注。
- 全模块文章均为全文翻译（含代码块保留），术语首现标注英文；编者补充内容均以"编者注"显式区隔，不与原文混写。
