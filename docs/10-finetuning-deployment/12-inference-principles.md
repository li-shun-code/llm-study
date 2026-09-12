---
title: 推理原理：KV Cache、PagedAttention 与 continuous batching——vLLM 为什么快
source_url: https://blog.vllm.ai/2023/06/20/vllm.html
author: Woosuk Kwon、Zhuohan Li（UC Berkeley，vLLM 团队）
license: Apache 2.0（vLLM 项目）
fetched_at: 2026-09-13
translated: true
order: 12
versions: vLLM V1 引擎（架构部分译自 2026-09 官方文档）
---

> **来源**：本文主体翻译自 [vLLM: Easy, Fast, and Cheap LLM Serving with PagedAttention](https://blog.vllm.ai/2023/06/20/vllm.html)，作者 Woosuk Kwon、Zhuohan Li（UC Berkeley，vLLM 团队），许可 Apache 2.0（vLLM 项目）；"V1 架构"一节翻译自 [vLLM 官方文档 Architecture Overview](https://docs.vllm.ai/en/latest/design/arch_overview.html)（Apache 2.0）。抓取于 2026-09-13。"continuous batching"一节为编者补充，已标注。

"为什么 vLLM 这么快？"——答案不在算子，而在**显存管理**。本文从自回归解码的内存瓶颈讲起，解释 PagedAttention 的设计，再补充 V1 引擎架构与连续批处理，让你能完整回答"vLLM 为什么快"。

## 超越当时的最优性能

vLLM 是一个用于快速 LLM 推理与服务的开源库，核心是 **PagedAttention**——一种有效管理注意力 key/value 的新注意力算法。搭载 PagedAttention 的 vLLM 重新定义了 LLM 服务的水位：相比 HuggingFace Transformers **吞吐最高提升 24 倍**，相比当时的 TGI（Text Generation Inference）最高提升 3.5 倍，且无需对模型架构做任何改动。实验设置：在 NVIDIA A10G 上测 LLaMA-7B、在 A100-40GB 上测 LLaMA-13B，请求的输入/输出长度取自 ShareGPT 数据集。

## 秘密武器：PagedAttention

### 问题：KV Cache 又大又动态

vLLM 团队发现，LLM 服务的性能瓶颈在**内存**。在自回归解码过程中，输入给 LLM 的所有 token 都会产生各自的注意力 key/value 张量，这些张量被保留在 GPU 显存中用于生成后续 token——这就是 **KV cache**。它有两个特点：

- **大**：LLaMA-13B 上单条序列的 KV cache 可达 1.7GB。
- **动态**：其大小取决于序列长度，而序列长度高度可变、不可预测。

因此高效管理 KV cache 是重大挑战：**现有系统因内存碎片与过度预留而浪费 60%–80% 的显存**。

### 方案：操作系统式的分页

**PagedAttention** 的灵感来自操作系统的经典思想——虚拟内存与分页（Paging）。与传统注意力算法不同，PagedAttention 允许把连续的 key/value 存储在**非连续**的内存空间中：它把每条序列的 KV cache 划分成多个块（Block），每块包含固定数量 token 的 key/value；注意力计算时，PagedAttention 内核高效地定位并取用这些块。

因为块不必连续，KV cache 可以像操作系统管理虚拟内存那样灵活管理：**块相当于页（page），token 相当于字节，序列相当于进程**。一条序列的连续*逻辑块*通过一张块表（Block Table）映射到非连续的*物理块*；物理块在新 token 生成时按需分配。

在 PagedAttention 中，显存浪费只发生在每条序列的**最后一个块**。实践里这带来接近最优的显存利用：浪费不足 4%。显存效率的提升极其有价值——系统可以**把更多序列放进同一个 batch**，提高 GPU 利用率，从而大幅提升吞吐。

### 附带红利：内存共享

PagedAttention 还有另一个关键优势：高效的**内存共享**。例如在并行采样（Parallel Sampling）中，同一条提示要生成多条输出序列——此时提示部分的计算与内存在这些输出序列之间是可共享的。

PagedAttention 通过块表天然支持内存共享：不同序列可以把各自的逻辑块映射到同一个物理块，正如进程共享物理页。为保证安全共享，PagedAttention 维护物理块的引用计数，并实现**写时复制（Copy-on-Write）**机制。

这种共享大幅降低了复杂采样算法（并行采样、beam search）的内存开销——最高降低 55%，并可转化为最高 2.2 倍的吞吐提升，让这类采样方法在 LLM 服务中真正可用。

## LMSYS 背后的无名英雄

2023 年 4 月，LMSYS 发布了 Vicuna 并在 Chatbot Arena 上服务数百万用户。最初 FastChat 用 HuggingFace Transformers 做服务后端，流量暴涨后 HF 后端成为瓶颈。LMSYS 与 vLLM 团队合作完成 FastChat-vLLM 集成以支撑增长的需求（最高多支撑 5 倍流量）。在 LMSYS 的早期内部基准中，vLLM 服务后端**比最初的 HF 后端吞吐最高提升 30 倍**。自 4 月中旬起，Vicuna、Koala、LLaMA 等热门模型全部经由 FastChat-vLLM 集成服务；vLLM 让 LMSYS 把服务上述流量的 GPU 数量砍掉一半，日均处理约 3 万请求、峰值 6 万。

## continuous batching：批处理的进化（编者补充）

PagedAttention 解决"每条序列占多少显存"，**连续批处理（Continuous Batching / In-flight Batching）**解决"请求什么时候进 batch"。两者共同构成现代推理引擎的吞吐基石：

**表：静态批处理 vs 连续批处理**

| 维度 | 静态批处理（Static Batching） | 连续批处理（Continuous Batching） |
| --- | --- | --- |
| 批组成 | 攒一批请求，整批一起跑，全部完成才解散 | 每个解码步动态进出：先完成的立即退出，新请求随到随插 |
| GPU 利用率 | 低——短请求必须陪长请求空转到批结束 | 高——每步都做满有效计算 |
| 出词延迟 | 首词延迟高（等攒批 + 等最慢者） | 首 token 延迟低 |
| 适用 | 离线批量任务 | 在线服务（聊天、Agent） |

直觉：LLM 解码是逐 token 的循环，batch 内每条序列长度参差。静态批处理像一个"长途团"——最短的旅程也得等最长的团友；连续批处理则是公交系统——到站就下、随到随上。vLLM 的调度器正是以步（step）为单位连续调度请求，配合 PagedAttention 的按需显存分配，才能把 GPU 一直喂饱。

## V1 引擎架构（vLLM 官方文档）

现在的 vLLM 已迭代到 V1 引擎，理解其多进程架构对正确规划部署的 CPU 资源很重要。

**入口**：`LLM` 类（离线推理的 Python 主接口）与 `vllm serve` 在线服务（实现 OpenAI 兼容 API）。

**关键进程**：

- **API Server 进程**：处理 HTTP 请求（OpenAI 兼容 API）、输入处理（分词、多模态数据加载）、把结果流式回传客户端。默认 1 个；使用数据并行时自动随 DP 规模扩展（也可用 `--api-server-count` 手动配置）。每个 API server 通过 ZMQ 与**所有** engine core 多对多互联，任何 API server 可把请求路由到任何 engine core。
- **Engine Core 进程**：运行**调度器（Scheduler）**、管理 **KV cache**、协调跨 GPU worker 的模型执行。它以忙循环（busy loop）**连续调度请求**并把工作派发给 GPU worker——这正是连续批处理在 V1 中的实现位置。每个数据并行 rank 一个 engine core。
- **GPU Worker 进程**：每个 GPU 由一个专职 worker 进程管理，加载权重、执行前向、管理显存。worker 数 = `TP × PP`（每个 engine core）。
- **DP 协调进程**（条件存在）：数据并行 >1 时负责 DP rank 间负载均衡与 MoE 模型的同步前向协调。

**表：进程数量小结（N 卡、TP、DP、A 个 API server）**

| 进程类型 | 数量 | 职责 |
| --- | --- | --- |
| API Server | A（默认 = DP） | HTTP 请求与输入处理 |
| Engine Core | DP（默认 1） | 调度器与 KV cache 管理 |
| GPU Worker | N（= DP × PP × TP） | 每 GPU 一个，执行前向 |
| DP Coordinator | DP>1 时 1 个，否则 0 | DP rank 间负载均衡 |

例如单机 4 卡 `vllm serve -tp=4`：1 API server + 1 engine core + 4 GPU workers = 6 个进程。

引擎内部：`LLMEngine`/`AsyncLLMEngine` 负责输入处理（tokenize）、**调度**（决定每步处理哪些请求）、模型执行（可跨多卡分布式）、输出处理（token id 解码回文本）。Worker 之下是 ModelRunner（准备输入张量、捕获 CUDA Graph）与 Model 本体（`torch.nn.Module`）。V1 在初始化阶段完成权重切分与量化（而不是初始化后再改权重），避免大模型部署时全量权重反复装载带来的显存峰值。

## 把三个概念串起来（编者注）

一条请求进入 vLLM 后的生命周期：API server 收到 HTTP 请求 → 分词 → 进入 engine core 的等待队列 → 调度器每步决定"哪些请求进入本步计算"（continuous batching）→ 对被调度的请求，从块表找到它们的 KV cache 物理块（PagedAttention），新 token 的 K/V 按需分配新块 → 前向只算一个新 token → 生成的 token 流式回传，直到 EOS → 序列退出，其物理块归还块池（前缀缓存场景下可能保留）。

所以"vLLM 为什么快"的完整答案：**PagedAttention 让单位显存塞下更多并发序列，continuous batching 让 GPU 每一步都满负荷，V1 的多进程架构让调度、分词与前向计算互不阻塞**。这三件事的协同，而不是某个魔法算子。

## 小结

- LLM 服务的瓶颈在显存：KV cache 又大（LLaMA-13B 单序列可达 1.7GB）又动态，传统管理浪费 60%–80%。
- PagedAttention = 操作系统分页思想：KV cache 切块、块表映射、按需分配，浪费降到 4% 以内；还附带并行采样/beam search 的内存共享（写时复制）。
- continuous batching = 请求级动态进出批，消除"短请求陪跑"，是在线低延迟高吞吐的关键。
- V1 引擎以多进程架构把 API 处理、调度/KV 管理与前向执行解耦。
