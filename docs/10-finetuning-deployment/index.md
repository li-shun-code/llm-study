---
title: 模块 10 · 微调与部署
order: 10
isRoot: true
---

# 模块 10 · 微调与部署

当提示与检索不够时：训练与对齐、量化与推理原理、模型服务化，以及评测与合规。

## 学习路径

**选型与训练环境**

- 微调、RAG 还是提示工程：如何为你的场景选型
- GPU 环境基础：CUDA、显存估算与 AutoDL 上手

**训练**

- 训练范式回顾与全参微调流程（Transformers 实战）
- LoRA 原理：低秩适应为什么有效
- QLoRA 与显存优化：单卡微调大模型
- 训练数据准备与清洗：TRL 数据集格式全解
- 数据蒸馏与合成：用大模型造小模型的训练数据
- 继续预训练（CPT）与领域自适应
- 训练超参与过拟合诊断：学习率、秩与 loss 曲线判读
- PEFT/TRL 实战：SFTTrainer 做有监督微调

**对齐与强化学习**

- DPO 与偏好优化：TRL DPOTrainer 实践
- GRPO 与 RLVR：推理模型强化学习实战

**量化与推理原理**

- 模型量化基础：Transformers 量化总览与 bitsandbytes
- 推理原理：KV Cache、PagedAttention 与 continuous batching——vLLM 为什么快

**部署与服务化**

- Ollama 本地部署：官方 README 与文档完整指南
- vLLM 高吞吐部署：从 vllm serve 到 Docker 容器化
- 推理服务生产化运维：Kubernetes、production stack 与负载均衡

**评测、选型与安全合规**

- 开源模型选型：Qwen、GLM、DeepSeek 官方模型卡对照（2026-09）
- LLM 评测方法与基准：lm-evaluation-harness README 完整指南
- 安全、合规与内容护栏：OWASP LLM Top 10 与 NeMo Guardrails

> 本模块文章全部抓取/翻译自网络公开资料，每篇文末均附署名块标注原文出处与许可。
