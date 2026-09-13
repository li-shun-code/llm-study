---
title: 向量数据库原理
source_url: https://milvus.io/docs/overview.md
author: Milvus（Zilliz / LF AI & Data Foundation）
license: Apache-2.0
fetched_at: 2026-09-13
translated: true
order: 13
versions: Milvus 官方文档当前版（milvus-docs v3.0.x）
---
## 非结构化数据、Embedding 与向量数据库

文本、图像、音频等**非结构化数据（Unstructured Data）**格式多样、底层语义丰富，分析起来很有挑战。为了管理这种复杂性，人们用 **Embedding（嵌入）**把非结构化数据转换成能捕捉其本质特征的数值向量，再把向量存入**向量数据库（Vector Database）**，从而实现快速、可扩展的搜索与分析。

以 Milvus 为例——它是由 Zilliz 开发、随后捐赠给 Linux 基金会旗下 LF AI & Data 基金会的开源高性能、高可扩展向量数据库，可在从笔记本电脑到大规模分布式系统的广泛环境中高效运行，以开源软件与云服务两种形态提供（Apache 2.0 许可，核心贡献者来自 Zilliz、ARM、NVIDIA、AMD、Intel、Meta、IBM、Salesforce、阿里巴巴、微软等，多为高性能计算社区专家）。

向量数据库提供数据建模能力，把非结构化或多模态数据组织成结构化的**集合（Collection）**；支持丰富的数据类型用于不同属性建模——常见数值与字符类型、多种向量类型、数组、集合与 JSON——免去维护多套数据库系统的负担。

### 三种部署形态（以 Milvus 为例）

向量数据库通常要覆盖从本地原型到海量集群的数据规模。Milvus 提供三种部署模式：

- **Milvus Lite**：Python 库，可直接集成进应用，适合 Jupyter Notebook 快速原型或资源受限的边缘设备；
- **Milvus Standalone**：单机服务器部署，所有组件打包进单个 Docker 镜像；
- **Milvus Distributed**：部署于 Kubernetes 集群，云原生架构面向百亿级以上向量场景，关键组件有冗余设计。

## 检索类型：一个向量数据库要支持哪些查询

Milvus 支持多种检索功能以应对不同用例——这份清单本身就是"向量数据库能力面"的最好注解：

- **ANN 检索**（Approximate Nearest Neighbor，近似最近邻）：找出与查询向量最近的 top-K 个向量；
- **过滤检索**（Filtered Search）：在指定过滤条件下执行 ANN 检索（元数据过滤 + 向量相似度）；
- **范围检索**（Range Search）：找出距查询向量指定半径内的向量；
- **混合检索**（Hybrid Search）：基于多个向量字段执行 ANN 检索；
- **全文检索**（Full Text Search）：基于 BM25 的全文检索；
- **重排序**（Reranking）：依据附加条件或次级算法调整检索结果顺序，精修初始 ANN 结果；
- **Fetch**：按主键取回数据；
- **Query**：按表达式检索数据。

## 为什么能做到这么快

原文以 Milvus 的设计决策说明向量数据库的性能来源（多数场景下它比其他向量数据库快 2-5 倍，见 VectorDBBench 结果）：

- **硬件感知优化（Hardware-aware Optimization）**：针对 AVX512、SIMD、GPU、NVMe SSD 等多种硬件架构与平台做专项优化；
- **先进搜索算法**：支持 IVF、HNSW、DiskANN 等广泛的内存/磁盘索引与检索算法且深度优化，相比 FAISS、HNSWLib 等流行实现有 30%-70% 的性能优势；
- **C++ 搜索引擎**：向量数据库 80% 以上的性能由搜索引擎决定，Milvus 用 C++ 实现该关键部件，并集成从汇编级向量化到多线程并行调度的大量硬件感知优化；
- **列式存储（Column-Oriented）**：查询时只读取涉及的特定字段而非整行，大幅减少访问数据量；列式数据上的操作也容易向量化，一次施加于整列。

## 为什么能扩展

Milvus 2022 年支持了十亿级向量，2023 年扩展到数百亿级并保持稳定，支撑了 Salesforce、PayPal、Shopee、Airbnb、eBay、NVIDIA、IBM、AT&T、LINE、ROBLOX 等企业的场景。

其可扩展性来自云原生、高度解耦的系统架构：Milvus 本身完全无状态（Stateless），可借助 Kubernetes 或公有云轻松扩展；三大关键任务——搜索、数据插入、索引/压实（Compaction）——被设计成易于并行的独立过程。查询节点、数据节点、索引节点因此可以独立地纵向与横向伸缩，兼顾性能与成本。

## 向量数据库的通用特性面

原文的"Why Milvus"清单同样适用于评估任何向量数据库：

- **规模化高性能与高可用**：计算与存储分离的分布式架构；读多场景扩查询节点、写多场景扩数据节点；K8s 上的无状态微服务快速故障恢复；多副本（Replica）提升容错与吞吐。
- **多种向量索引类型与硬件加速**：支持 HNSW、IVF、FLAT（暴力检索）、SCANN、DiskANN 等主流索引类型及其量化变体与 mmap；对元数据过滤、范围检索等高级特性做专项优化；支持 GPU 索引（如 NVIDIA CAGRA）。
- **灵活的多租户与冷热存储**：可在 database/collection/partition/partition key 层面做租户隔离，单集群服务成百上百万租户；热点数据放内存或 SSD，冷数据放慢速低价存储。
- **稀疏向量与全文/混合检索**：除稠密向量语义检索外，原生支持 BM25 全文检索与 SPLADE、BGE-M3 等学习型稀疏 Embedding；稀疏与稠密向量可存于同一集合，并可定义函数对多路检索结果重排。
- **数据安全与细粒度访问控制**：强制用户认证、TLS 加密、基于角色的访问控制（RBAC）。

## 站内补充：读懂上面内容所需的最小概念集

- **向量相似度度量（Distance Metric）**：常用余弦相似度（Cosine Similarity，看夹角）、欧氏距离（L2，看空间直线距离）与内积（IP/Dot Product）。选哪种取决于 Embedding 模型的训练目标——遵循模型卡的建议即可。
- **精确 vs 近似**：向量维度动辄数百上千，逐一向量比较的暴力检索（FLAT）结果精确但太慢；ANN 索引（IVF 聚类、HNSW 图、DiskANN 磁盘索引等）以牺牲少量召回换取数量级的加速。上文的 HNSW/IVF/DiskANN 都属此类。
- **在 LLM 应用中的位置**：模块 8 的 RAG 流程是"文档 → 切块 → Embedding → 存入向量库 → 查询时 ANN 检索 → 重排 → 喂给 LLM"。本篇是"库"的原理，下一篇动手实操。

原文另附 API/SDK（RESTful、PyMilvus、Go、Java、Node.js、C#、C++）、生态工具（Attu 图形界面、Birdwatcher 调试、Prometheus/Grafana 监控、Milvus Backup/CDC、Spark 连接器与 VTS 数据传输）与 AI 集成（PyMilvus 内置若干 Embedding/重排模型、LangChain 等框架的向量存储组件），此处从略，详见原文。

---

> **来源**：本文翻译自 [What is Milvus?（Milvus 官方文档 Overview）](https://milvus.io/docs/overview.md)，作者 Milvus（Zilliz / LF AI & Data Foundation），许可 Apache-2.0。抓取于 2026-09-13。

---

> **编者按**：原文以 Milvus 视角介绍向量数据库的原理与架构，本篇保留其通用原理部分（非结构化数据、Embedding、ANN 检索类型、性能与扩展性设计），并在文末以"站内补充"补充相似度度量与"精确检索 vs 近似检索"的最小概念集。文中 Milvus 特性的介绍同样译出，作为理解"一个向量数据库要解决哪些问题"的实例。
