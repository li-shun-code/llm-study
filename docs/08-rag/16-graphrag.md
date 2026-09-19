---
title: GraphRAG：用知识图谱回答"全局性"问题
source_url: https://raw.githubusercontent.com/microsoft/graphrag/main/README.md
author: Microsoft Research（Jonathan Larson、Steven Truitt 等）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 16
group: 进阶范式
---
LLM 最大的挑战与机遇，是把强大能力延伸到训练数据之外，在从未见过的数据上取得相当的结果——比如在私有数据上做主题与语义概念的发现。传统 RAG（本文称 Baseline RAG）以向量相似度为检索手段，而微软研究院的 **GraphRAG** 用 LLM 生成的知识图谱来回答问题，在复杂信息分析上带来实质性提升。这里"私有数据"指 LLM 未在训练中见过的数据：企业专有研究、业务文档、通信记录等。

## 项目现状（2026，务必先读）

> 以下为官方 README 原文警告（翻译）：GraphRAG 是一个研究项目，探索用图来为问答构造有针对性的上下文。自 2024 年 7 月首发以来，前沿模型的能力已发生巨大变化，微软的研究组合也随之多元化。**该项目目前基本处于维护模式**：不再接受新 PR、不再实现新功能，仅酌情进行缺陷修复与依赖更新（尤其安全漏洞）。当前生产选型请把 LightRAG、nano-graphrag 等社区实现与更新的方案一并纳入对比。

- [Microsoft Research 博客](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)
- [官方文档](https://microsoft.github.io/graphrag)
- [GraphRAG 论文（ArXiv）](https://arxiv.org/pdf/2404.16130)

README 同时明确：本仓库展示的是"用知识图谱记忆结构增强 LLM 输出"的方法论，代码仅作演示，**不是微软官方支持的产品**；⚠️ GraphRAG 的索引过程可能非常昂贵，务必先读文档了解流程与成本、从小数据集起步。

## Baseline RAG 的两类失效

Baseline RAG 旨在解决"模型没见过私有数据"的问题，但在两种情况下表现很差：

- **连点成线失败**：回答问题需要沿着共同属性把分散的信息串联起来、综合出新洞见时，Baseline RAG 力不从心；
- **全局理解失败**：被要求对大规模数据集合、甚至单个大文档做整体性的语义概念总结时，表现糟糕。

## 实例一：连点成线

用 2023 年 6 月俄乌双方新闻文章组成的数据集（VIINA）演示——数据嘈杂、观点分歧、且晚于模型训练截止，只能靠检索。数据集远超上下文窗口，必须用 RAG。

查询："What is Novorossiya?"——两个系统都答得不错。换一个需要连点成线的查询："What has Novorossiya done?"

**Baseline RAG** 的回答："文本中没有提供关于新罗西斯克做过什么的具体信息。"——失败。检视其上下文窗口中的原文片段：没有任何一段直接提到 "Novorossiya" 这个词，向量检索自然取不回来。

**GraphRAG** 的回答则列出了该政治运动针对的具体目标（Rosen 糖果厂、敖德萨罐头厂、乌克兰国家电视广播中心、PrivatBank 银行 ATM 等），每个论断都带 [Data: Entities (…), Relationships (…)] 形式的出处编号。GraphRAG 在查询中识别出了实体 Novorossiya，LLM 以图为锚，得到更优且可溯源的回答——例如"Novorossiya 涉嫌策划炸毁 ATM"这一句，可以精确定位到它所依据的原始新闻片段（来源、日期、原文）。这种**证据溯源（Provenance）**让用户能把 LLM 输出与原始材料逐句核对。

## 实例二：全数据集推理（Whole-Dataset Reasoning）

"数据中的前五大主题是什么？"——这类需要跨数据集聚合信息的问题，Baseline RAG 表现极差：它依赖语义相似的向量搜索，而查询里没有任何内容能"导向"正确信息（向量化后"theme"只会召回字面谈论主题的段落）。

GraphRAG 能回答，因为 LLM 生成的知识图谱本身就揭示了数据集整体的结构（从而是主题）。私有数据被组织成有意义的语义簇并**预先摘要**，LLM 回答用户查询时用这些簇来总结主题。对比结果：Baseline RAG 列出的五个"主题"与两国战争几乎无关；GraphRAG 则给出"冲突与军事行动、政治与政府实体、基础设施与环境、社群分析与威胁评估、健康与人道主义"五大主题，且每个主题都附带报告出处。

## GraphRAG 的工作流程

基于微软此前的图机器学习研究（graspologic 等仓库），基本流程是：

1. LLM 处理整个私有数据集，抽取源数据中所有实体（Entity）与关系（Relationship）的引用，构建 LLM 生成的知识图谱；
2. 在图上做自底向上的聚类（Leiden 社区检测），把数据层级化地组织成语义簇；每个语义簇可以预先摘要，帮助对数据集的整体理解；
3. 查询时，这两种结构（图 + 层级摘要）共同为 LLM 的上下文窗口提供素材，并支持在不同抽象层级上回答问题。

可视化时，每个圆是一个实体（人物、地点或组织），圆的大小代表它的关系数量，颜色代表相似实体的分组（即聚类结果）。

## 效果评估

微软用 LLM 评审对 GraphRAG 与 Baseline RAG 做成对比较，采用定性指标：**全面性**（在问题隐含语境内的完整度）、**人类赋权**（提供支持性原始材料或上下文）、**多样性**（对问题提供不同视角）。初步结果显示 GraphRAG 在这些指标上**持续优于** Baseline RAG。同时用 [SelfCheckGPT](https://arxiv.org/pdf/2303.08896.pdf) 做忠实度的绝对测量，GraphRAG 与 Baseline RAG 忠实度相当——即在不多说胡话的前提下，答得更好、更全。

## 上手与工程提示

按 README 的建议：

- 从[命令行快速开始](https://microsoft.github.io/graphrag/get_started/)入门（`pip install graphrag` 后 `graphrag init --root ./ragtest` 初始化工作区，配置好 API Key 与输入目录，再执行 `graphrag index --root ./ragtest` 建图、`graphrag query --root ./ragtest --method global "数据中的主要主题是什么?"` 做全局查询）；
- 开箱即用的提示词未必适配你的数据，**强烈建议**按官方[提示词调优指南](https://microsoft.github.io/graphrag/prompt_tuning/overview/)微调；
- 次版本升级间运行 `graphrag init --root [path] --force` 以获得最新配置格式；大版本升级用官方迁移 notebook，避免重建旧数据集索引（该操作会覆盖配置与提示词，注意备份）；
- 责任 AI（RAI）相关说明见仓库 [RAI_TRANSPARENCY.md](https://github.com/microsoft/graphrag/blob/main/RAI_TRANSPARENCY.md)。

> 编者注：GraphRAG 的索引成本（对全语料反复调用 LLM 抽实体/关系/摘要）是落地时最大的现实约束；中文场景下还需注意实体抽取提示词的本地化调优。与《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》的 RAGAS 对照——知识图谱构建质量本身也可以用评估集量化，避免"为建图而建图"。

---

> **来源**：本文整合翻译自 [microsoft/graphrag 官方 README](https://raw.githubusercontent.com/microsoft/graphrag/main/README.md)（MIT 许可）与 Microsoft Research 博客 [GraphRAG: Unlocking LLM discovery on narrative private data](https://www.microsoft.com/en-us/research/blog/graphrag-unlocking-llm-discovery-on-narrative-private-data/)（作者 Jonathan Larson、Steven Truitt），作者 Microsoft Research。抓取于 2026-09-13。
