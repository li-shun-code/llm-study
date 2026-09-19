---
title: MoE 与稀疏注意力：读现代模型卡的先修知识
source_url: https://huggingface.co/blog/moe
author: Hugging Face 官方博客（osanseviero、lewtun、philschmid、smangrul、ybelkada、pcuenca；ariG23498 等；burtenshaw）· 本站编译
license: Hugging Face Blog（署名转载；博客仓库未附独立许可证文件）
fetched_at: 2026-09-19
translated: true
versions: transformers（MoE 一等公民改造后的当前版）· Mixtral 8x7B / gpt-oss / Qwen3 / GLM-5 / DeepSeek-V4 模型卡
order: 11
group: 架构地基
---
## 一、为什么需要它：先看懂那串"235B-A22B"

打开任何一个主流开源模型的仓库页，你大概率会看到这样的名字：`Qwen3-235B-A22B`、`DeepSeek-V4-Pro`（1.6T 总参数 / 49B 激活）、`GLM-5`（744B 参数，激活 40B）。斜杠前后两个数字不一样，名字里还常带 `-A22B`、`-Flash`、`-Exp` 这类后缀——它们说的就是本篇的两件事：

- **MoE（混合专家，Mixture of Experts）**：**参数怎么放**——把每一层的前馈网络（FFN）拆成很多个"专家"，每个 token 只激活其中几个；
- **稀疏注意力**：**注意力怎么算**——不再让每个 token 与全部历史 token 做全量注意力，而是压缩、挑选或局部化 KV。

两者是**正交的两条轴**，但动机完全一致：**模型容量取决于总参数，而推理速度取决于激活参数与每 token 的注意力开销**。稠密堆参数的那条路在三件事上撞墙：训练越来越贵、推理时延随长度平方增长、部署要吞下整份权重。稀疏化就是绕开这三堵墙的通用手法。

对开发者来说，这不只是"架构八卦"：它直接决定你要租多大的显存、长上下文能不能真用起来、以及模型卡上那句"1M 上下文"值多少钱。本站的版本与选型信息统一在《主流模型生态对比（2026-09）》，本篇只讲**读它需要的架构先修**。

## 二、MoE：把 FFN 换成"专家 + 路由器"

### 2.1 基本结构

MoE 保留 Transformer 骨干，只把其中若干层的稠密 FFN 换成 N 个并行的 FFN（专家），前面加一个**路由器（gating network）**：对每个 token，路由器输出一组概率，选 top-k 个专家来处理它。

```
y = Σᵢ G(x)ᵢ · Eᵢ(x)            （n 个专家的加权和）
G(x) = Softmax(x · W_g)          （最传统的门控网络）
```

如果某个 `G(x)ᵢ = 0`，第 i 个专家根本不用算——这就是"条件计算"（conditional computation）：**参数变大，但每 token 的 FLOPs 基本不变**。

这里有个必须记住的误解：**专家不是"数学专家""代码专家"这种主题分工**，它只是一个可学习子网络。ST-MoE 的观测是：编码器侧的专家会偏向标点、专有名词这类浅层特征，解码器侧特化更弱；而且由于 token 路由 + 负载均衡，**没有任何一个专家专门负责某门语言**。看到"我们的模型有独立的中文专家"这类营销话术，可以直接打个问号。

### 2.2 一条简短的演进线

| 阶段 | 代表 | 关键贡献 |
| ---- | ---- | -------- |
| 早期探索 | Shazeer 2017（稀疏门控 MoE） | softmax 门控 + 噪声 top-k 路由 |
| 规模化 | GShard | 每隔一层替换为 top-2 MoE，多设备共享 MoE 层 |
| 稳定训练 | Switch Transformers | top-1 路由、4× 预训练加速，放出 2048 专家 / 1.6T 模型 |
| 开源引爆 | Mixtral 8x7B（2023-12） | 8 专家 top-2，47B 总参数、约 12B 激活 |
| 效率取向 | DeepSeekMoE → DeepSeek-V3/V4 系 | 细粒度专家 + 共享专家，把激活比例压到 5% 以下（V4-Pro 约 3%） |

### 2.3 路由的三件套：top-k、辅助损失、容量因子

**top-k 门控**。给 logits 加噪声、取 top-k、再 softmax。k 太低（1）时路由更难学，k 太高就失去了稀疏的意义；工业配置常见 top-1（Switch）、top-2（Mixtral/DeepSeek）、top-4 或 top-8（更大专家池）。

**负载均衡辅助损失（aux loss）**。如果不管，路由器会收敛到"反复用同一小撮专家"，而且越用越强、自我强化。于是训练目标里加一项，惩罚负载不均，让每个专家都分到差不多多的 token。用负载占比 f（各专家分到的 token 比例）与 P（路由器给该专家的平均概率），Switch 形式写作：

```
L_aux = α · N · Σᵢ fᵢ · Pᵢ      （完美均匀时取到最小值，本节脚本按 α=1 归一后 = 1.0）
```

`transformers` 里它对应 `aux_loss` / `output_router_logits` 相关配置。

**路由器 Z-loss**。辅助损失本身会带来不稳定。ST-MoE 提出的 router z-loss 惩罚进入门控的大 logits，抑制舍入误差在 softmax 里被指数放大，"提升稳定性而不牺牲质量"，现在是稀疏模型训练标配。

**容量因子（capacity factor）**。为了让专家层的批大小在硬件上固定，每个专家每批次只收 `CF × 平均负载` 个 token，超出的 token 被**直接丢弃**。CF 越大质量越好但通信与激活显存越贵。经验起点：**top-2 路由 + CF=1.25 + 每核一个专家**；推理阶段可以调低 CF 换算力。

### 2.4 该用 MoE 还是稠密

Hugging Face 官方博客给的判据很干脆：**高吞吐、机器多 → MoE；低吞吐、显存小 → 稠密**。并且强调一句容易被忽略的话：**不能拿稀疏模型和稠密模型的参数量直接比较**，两者含义完全不同。Mixtral 是"47B 的显存、12B 的算力"，把它当"47B 模型"去比同参数稠密模型的部署成本，或者当"12B 模型"去比质量，都是错的。

## 三、稀疏注意力：长上下文的账本在 KV 上

如果说 MoE 省的是"每 token 的 FFN 计算"，稀疏注意力省的是"每 token 对多长的历史做注意力"。要读懂模型卡上那些注意力名词，只需要盯住两个量：**KV 缓存大小**和**每 token 的注意力 FLOPs**，两者都随序列长度增长。

### 3.1 从 MHA 到 GQA / MLA：先砍 KV 头

标准多头注意力（见《注意力机制》第七节）为每个头存一份 K/V。省法是一步步共享：

- **MQA（多查询注意力）**：所有查询头共用一组 K/V，KV 缓存直接除以头数；代价是质量。
- **GQA（分组查询注意力）**：把查询头分成几组、组内共享 K/V，是当前开源模型的主流折中。模型卡上的 `num_key_value_heads` 就是这个数（等于 `num_attention_heads` 就是纯 MHA，等于 1 就是 MQA）。
- **MLA（多头潜在注意力）**：DeepSeek 的路线——把 K/V 投影到低秩潜在空间再缓存，等效于把 KV 矩阵本身压缩。DeepSeek-V4 的注意力路径里，KV 项用 FP8 存储、只有 RoPE 维度保留 BF16，indexer 内部用 FP4。

### 3.2 稀疏挑选：从"少存"到"少看"

- **滑动窗口注意力（SWA）**：只看最近 W 个 token（外加少量全局层），逐 token 开销与总长度无关。缺点也很直白：远处的信息看不见。
- **可学习稀疏挑选**：DeepSeek Sparse Attention（DSA）用一个轻量的 **indexer** 先粗筛，再只对 top-k 个块做精细注意力。DeepSeek-V4 把它推进成**混合注意力**：

  - **CSA（压缩稀疏注意力）**：先沿序列维把 KV 每 4 个压成 1 个（softmax 门控池化 + 可学习位置偏置），lightning indexer 在**已压缩**的块上选 top-k，另有一条滑动窗口分支负责最近的未压缩 token；
  - **HCA（重压缩注意力）**：压缩比拉到 128×，序列被压得足够短，于是直接对压缩流做稠密注意力，不再需要挑选；
  - **层间交替**：V4-Pro 的 61 层里，0–1 层用 HCA，2–60 层 CSA/HCA 交替，最后的 MTP 块只跑滑动窗口。理由是"不同层该承载不同的注意力模式，硬套一种机制浪费容量"。

- **稀疏 + 线性混合**：智谱 GLM-5.3-Flash 在 GLM 系列里首次引入稀疏与线性注意力混合架构，主打"保住精确长上下文能力的同时大幅压低服务成本"；GLM-5.2 的 IndexShare 则是"每四层稀疏注意力复用同一个 indexer"，1M 上下文下每 token FLOPs 降 2.9 倍。

**一句话总结这套名词**：MoE 决定"权重搬多少"，注意力方案决定"历史看多少、KV 存多少"。看到任何一个"1M 上下文"，先问：KV 缓存按什么方案存？

### 3.3 这些省法买来了什么

按 Hugging Face 的 DeepSeek-V4 介绍：在 1M token 处，V4-Pro 的单 token 推理 FLOPs 只有上一代 V3.2 的 27%、KV 缓存显存 10%；V4-Flash 更极端，分别是 10% 和 7%。跟"GQA-8 + BF16"这个常见参照系比，V4 的 KV 缓存只有它的**约 2%**。同一种省法，换个模型卡名字而已。

## 四、可运行：把上面的名词变成算术

### 4.1 读模型卡的参数/显存/带宽计算器

```python
#!/usr/bin/env python3
"""稀疏模型的"读模型卡"算术：总参数 / 激活参数 / 权重驻留 / 解码速度上限 / KV 缓存。

只依赖 Python 标准库，直接 `python3 moe_card_math.py` 即可运行。
"""
from unicodedata import east_asian_width

# 每参数字节数：bf16/fp16 = 2，fp8/int8 ≈ 1，mxfp4 ≈ 0.5
BYTES = {"bf16": 2.0, "fp8": 1.0, "mxfp4": 0.5}


def pad(text: str, width: int) -> str:
    """中文占两格宽度，自己算一遍才能让表格对齐。"""
    shown = sum(2 if east_asian_width(c) in "WF" else 1 for c in text)
    return text + " " * max(0, width - shown)


def resident_gib(total_params_b: float, quant: str) -> float:
    """权重必须全部常驻显存/统一内存——这是 MoE 与稠密模型最容易被忽略的差别。"""
    return total_params_b * 1e9 * BYTES[quant] / 1024**3


def decode_tok_s_upper_bound(active_params_b: float, quant: str, bandwidth_gbs: float) -> float:
    """带宽受限解码的经验上限：每秒带宽 ÷ 每 token 需要搬走的激活权重量。"""
    return bandwidth_gbs * 1e9 / (active_params_b * 1e9 * BYTES[quant])


def kv_cache_gib(tokens: int, layers: int, kv_heads: int, head_dim: int, quant: str) -> float:
    """KV 缓存 = 2(K 与 V) × 层数 × KV 头数 × 每头维度 × token 数 × 每参数字节。"""
    return 2 * layers * kv_heads * head_dim * tokens * BYTES[quant] / 1024**3


if __name__ == "__main__":
    # 总参数与激活参数取自各家公开模型卡/官方博客（链接见正文），这里只做换算演示
    models = [
        ("Mixtral-8x7B (8 专家 top-2)", 47, 12, "bf16"),
        ("gpt-oss-20b (32 专家 top-4)", 21, 3.6, "mxfp4"),
        ("Qwen3-235B-A22B", 235, 22, "fp8"),
        ("GLM-5 (744B/激活 40B)", 744, 40, "fp8"),
        ("DeepSeek-V4-Flash", 284, 13, "fp8"),
        ("DeepSeek-V4-Pro", 1600, 49, "fp8"),
    ]
    bandwidth = 800.0  # GB/s：Apple M3 Ultra 一类统一内存的带宽量级
    print(pad("模型", 32) + pad("权重驻留/GiB", 14) + pad("总÷激活", 10) + "解码上限 tok/s")
    for name, total, active, quant in models:
        print(pad(name, 32)
              + pad(f"{resident_gib(total, quant):.1f}", 14)
              + pad(f"{total / active:.1f}×", 10)
              + f"{decode_tok_s_upper_bound(active, quant, bandwidth):.0f}")

    # 注意力侧：同一个"7B / 8×7B 级"示例配置下，长上下文的 KV 缓存有多贵
    cfg = dict(layers=32, head_dim=128)
    print("\nKV 缓存（示例配置：32 层 × head_dim 128，bf16）")
    for label, kv_heads in [("MHA（32 个 KV 头）", 32), ("GQA-8（8 个 KV 头）", 8), ("MQA（1 个 KV 头）", 1)]:
        cells = [f"{kv_cache_gib(n, kv_heads=kv_heads, quant='bf16', **cfg):.1f} GiB"
                 for n in (8192, 131072, 1048576)]
        print(pad(label, 24) + "  8K: " + cells[0] + "   128K: " + cells[1] + "   1M: " + cells[2])
    print(pad("×0.02（V4 口径）", 24) + "  1M 上下文 → "
          f"{kv_cache_gib(1048576, kv_heads=8, quant='bf16', **cfg) * 0.02:.1f} GiB")

    print("\n相对算力（以 8K 为 1；平方项 = 全量自注意力，线性项 = 逐 token 开销）")
    for n in (8192, 131072, 1048576):
        print(pad(f"上下文 {n:,}", 20) + pad(f"平方项 ×{(n / 8192) ** 2:,.0f}", 20) + f"线性项 ×{n / 8192:,.0f}")
```

输出（示例配置那一列只是常见取值，用于建立量感，不是任何官方规格）：

```
模型                            权重驻留/GiB  总÷激活   解码上限 tok/s
Mixtral-8x7B (8 专家 top-2)     87.5          3.9×      33
gpt-oss-20b (32 专家 top-4)     9.8           5.8×      444
Qwen3-235B-A22B                 218.9         10.7×     36
GLM-5 (744B/激活 40B)           692.9         18.6×     20
DeepSeek-V4-Flash               264.5         21.8×     62
DeepSeek-V4-Pro                 1490.1        32.7×     16

KV 缓存（示例配置：32 层 × head_dim 128，bf16）
MHA（32 个 KV 头）        8K: 4.0 GiB   128K: 64.0 GiB   1M: 512.0 GiB
GQA-8（8 个 KV 头）       8K: 1.0 GiB   128K: 16.0 GiB   1M: 128.0 GiB
MQA（1 个 KV 头）         8K: 0.1 GiB   128K: 2.0 GiB   1M: 16.0 GiB
×0.02（V4 口径）          1M 上下文 → 2.6 GiB

相对算力（以 8K 为 1；平方项 = 全量自注意力，线性项 = 逐 token 开销）
上下文 8,192        平方项 ×1           线性项 ×1
上下文 131,072      平方项 ×256         线性项 ×16
上下文 1,048,576    平方项 ×16,384      线性项 ×128
```

三个能直接拿去用的结论：

1. **先搞清楚你在算哪一档速度**。官方对 gpt-oss-20b 的估算是"3.6B 激活参数、每参数 2 字节（BF16 口径）、800 GB/s 带宽 → 约 111 token/s"，实测约 115 token/s；而本脚本按该模型真实的 mxfp4 权重（0.5 字节/参数）算出 444 token/s——这只是**理论上限**，要吃满得配原生 4-bit 内核（官方也注明"用原生 mxfp4 内核会更快"）。两笔账都对，关键是别拿 4-bit 上限去对比 BF16 口径的实测。反例是 DeepSeek-V4-Pro：49B 激活看着不多，但 1.6T 权重（FP8 下约 1.5 TiB）决定了它不可能靠单机带宽喂饱——**MoE 的"快"是有前提的**。
2. **示例配置下 1M 上下文的 KV 缓存要 128 GiB（GQA-8）**——对一个权重只有 9.8 GiB 的 21B 级 MoE 来说，历史比模型本身贵十几倍。这就是"稀疏 + 压缩 KV"存在的理由：同一个 1M 窗口，V4 那套 CSA/HCA + FP8 把它压到个位数 GiB。
3. 平方项那一行解释了为什么"窗口翻倍、时延翻倍"的说法是错的：**全量注意力下 128K→1M 是 64 倍的平方项增长**，任何声称百万级可用的模型都必须在这里做手脚。

### 4.2 路由器是怎么"饿死"一部分专家的

下面这段不训练任何网络，只做前向路由统计 + 一个均衡控制环，跑完能亲眼看到负载不均、aux loss 与容量丢弃之间的关系：

```python
#!/usr/bin/env python3
"""MoE 路由器的三个死结：负载不均、负载均衡损失、容量因子丢 token。

纯标准库模拟（不训练网络，只做前向路由 + 一个均衡控制环），`python3 moe_router_sim.py` 直接跑。
"""
import math
import random


def softmax(values):
    m = max(values)
    exps = [math.exp(v - m) for v in values]
    s = sum(exps)
    return [e / s for e in exps]


def route_all(token_logits, n_experts, top_k, bias=None):
    """对所有 token 做 top-k 门控，返回负载计数与平均路由概率。"""
    load = [0] * n_experts
    prob_sum = [0.0] * n_experts
    for logits in token_logits:
        probs = softmax([logits[i] + (bias[i] if bias else 0.0) for i in range(n_experts)])
        for i in range(n_experts):
            prob_sum[i] += probs[i]
        for i in sorted(range(n_experts), key=lambda j: probs[j], reverse=True)[:top_k]:
            load[i] += 1
    n_tokens = len(token_logits)
    f = [x / (n_tokens * top_k) for x in load]                      # 负载占比，合计 1
    p = [x / n_tokens for x in prob_sum]                            # 平均路由概率
    aux_loss = n_experts * sum(f[i] * p[i] for i in range(n_experts))  # 完美均匀时 = 1.0
    return load, f, aux_loss


def report(name, load, f, aux_loss, capacity_factor, n_tokens, top_k, n_experts):
    """把一次路由结果压成一行可读结论：负载不均程度 + 超出容量被丢弃的 token 比例。"""
    capacity = capacity_factor * n_tokens * top_k / n_experts
    dropped = sum(max(0.0, x - capacity) for x in load) / (n_tokens * top_k)
    print(f"{name}\n  负载% {[round(x * 100, 1) for x in f]}"
          f"  最热/最冷 {max(load) / max(1, min(load)):.1f}×  aux_loss {aux_loss:.3f}"
          f"  CF={capacity_factor:.2f} 时丢弃 {dropped * 100:.1f}%")


if __name__ == "__main__":
    n_experts, top_k, n_tokens = 8, 2, 4096
    rng = random.Random(7)

    # 真实预训练里总会有"热门专家"：这里用一组固定的专家偏置来代表
    bias = [rng.uniform(0, 2.5) for _ in range(n_experts)]
    tokens = [[rng.gauss(bias[i], 1.0) for i in range(n_experts)] for _ in range(n_tokens)]

    load, f, aux = route_all(tokens, n_experts, top_k)
    report("A 不做任何均衡", load, f, aux, 1.25, n_tokens, top_k, n_experts)

    # 控制环：每步把"超载专家"的路由偏置往下压、欠载的往上抬。
    # 这是对负载均衡辅助损失 / 专家偏置校正效果的近似演示，不是它的梯度推导。
    correction = [0.0] * n_experts
    for step in range(1, 201):
        load, f, aux = route_all(tokens, n_experts, top_k, bias=correction)
        lr = 0.05 if step > 100 else 0.2            # 前 100 步快走，之后降温防振荡
        correction = [correction[i] - lr * (f[i] * n_experts - 1.0) for i in range(n_experts)]
    load, f, aux = route_all(tokens, n_experts, top_k, bias=correction)
    report("B 均衡控制环迭代 200 步后", load, f, aux, 1.00, n_tokens, top_k, n_experts)
```

```
A 不做任何均衡
  负载% [9.7, 5.3, 26.0, 4.0, 19.7, 12.4, 4.1, 18.7]  最热/最冷 6.4×  aux_loss 1.272  CF=1.25 时丢弃 17.6%
B 均衡控制环迭代 200 步后
  负载% [12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5]  最热/最冷 1.0×  aux_loss 1.000  CF=1.00 时丢弃 0.0%
```

看两件事：**aux_loss 从 1.272 掉到 1.000 的同时，被容量因子挡在门外的 token 从 17.6% 掉到 0**。也就是说，负载均衡不只是"训练是否优雅"的问题——不均衡会**真的把 token 丢掉**，模型在这些 token 上根本没计算。这正是 DeepSeek-V3 一类"专家偏置校正"路线想解决的问题：让路由决策尽量不因容量而丢信息。

### 4.3 生态侧：`transformers` 里的 MoE

现代 `transformers` 把 MoE 当一等公民处理，读源码/读配置时会遇到这几个概念：

- **Experts Backend（可插拔执行后端）**：`eager`（逐专家循环，调试与对齐正确性用）、`batched_mm`（复制选中的专家权重做一次 `torch.bmm`，适合小批、显存充裕）、`grouped_mm`（按专家 ID 排序分组后一次 grouped GEMM，适合大批或显存紧张）；
- **专家并行（Expert Parallelism）**：`DistributedConfig(enable_expert_parallel=True)` + `torchrun --nproc-per-node N`，**N 要能整除专家总数**；权重按专家维切分，每卡只装 `num_experts / N` 个；
- **量化落点**：MoE  instruct 版常把**专家权重压到 FP4、其余保 FP8**——所以"同一个模型的量化版"在 MoE 上质量损失分布很不均匀，务必按官方 recipe 而不是自己随便压。

部署侧的 KV Cache、PagedAttention 与 continuous batching 的完整机制，本站在《推理原理：KV Cache、PagedAttention 与 continuous batching——vLLM 为什么快》里已经展开；各家开源模型卡逐条对照见《开源模型选型：Qwen、GLM、DeepSeek 官方模型卡对照（2026-09）》。

## 五、常见坑

1. **把"总参数"当"能力档位"横着比**：47B MoE 与 70B 稠密不是一回事，激活比例、专家粒度、共享专家数量都在起作用。要比就比**同一批基准 + 同一推理配置**（见《模型评测与基准素养：MMLU-Pro、SWE-bench 与 Agent 基准怎么读》）。
2. **只按激活参数估显存**：所有专家权重都要驻留。13B 激活的 284B 模型，装不下就是装不下。
3. **激活参数不是常数**：路由器会随负载变化，长文本/代码域的激活专家数与概率分布都可能漂移；模型卡给的"约 xB 激活"是均值口径。
4. **忽略容量因子丢 token**：CF 调小省显存省通信，代价是直接丢信息。做吞吐压测时要看丢弃率，不能只看延迟。
5. **MoE 微调当稠密微调做**：全参微调要同时喂饱所有专家（数据量不够时部分专家退化）；常见做法是保注意力稠密、只在足够大的数据上动专家，或干脆用 LoRA 但把目标模块扩到专家层——显存节省远没有稠密模型明显。
6. **训练不稳先怀疑学习率**：稀疏模型的 loss spike 常见根因是路由 logits 过大，加 router z-loss 往往比调 lr 更对症。
7. **注意力名词混用**：`num_key_value_heads` 是 GQA 的组数，稀疏注意力是"看哪些块"，两者不是一回事；线性注意力又不一样。读模型卡时分别定位。
8. **以为稀疏解决了长上下文**：稀疏注意力解决的是**成本与算量**，不自动解决**中段信息的召回精度**——那是另一篇《长上下文的有效利用：Lost in the Middle 与位置偏置》的主题。

## 六、延伸阅读

- 训练侧：《训练范式总览：预训练 → SFT → RLHF/DPO》——MoE 的辅助损失出现在预训练目标里；
- 推理侧：《推理原理：KV Cache、PagedAttention 与 continuous batching——vLLM 为什么快》；
- 选型与模型卡：《开源模型选型：Qwen、GLM、DeepSeek 官方模型卡对照（2026-09）》《主流模型生态对比（2026-09）》；
- 效果侧：《长上下文的有效利用：Lost in the Middle 与位置偏置》《Token 与上下文窗口》。

## 参考来源

1. Hugging Face Blog, *Mixture of Experts Explained*（moe.md）——MoE 构件、稀疏性、负载损失、容量因子、专家并行。
2. Hugging Face Blog, *Mixture of Experts (MoEs) in Transformers*（moe-transformers.md, 2026-02）——激活参数换算、Experts Backend、专家并行、Unsloth 训练加速。
3. Hugging Face Blog, *DeepSeek-V4: a million-token context that agents can actually use*——CSA/HCA 混合注意力、FLOPs 与 KV 缓存比例、MRCR 检索曲线。
4. Fedus et al., *Switch Transformers*（arXiv:2101.03961）；Zoph et al., *ST-MoE*（arXiv:2202.08906，router z-loss）；Lepikhin et al., *GShard*（arXiv:2006.16668）。
5. DeepSeek-AI, *DeepSeek-V3.2-Exp / DeepSeek-V4* 模型卡与 README（MIT）。

---

> **来源**：本文编译自 Hugging Face 官方博客三篇——[Mixture of Experts Explained](https://huggingface.co/blog/moe)（osanseviero、lewtun、philschmid、smangrul、ybelkada、pcuenca）、[Mixture of Experts (MoEs) in Transformers](https://huggingface.co/blog/moe-transformers)（ariG23498、pcuenq、merve、IlyasMoutawwakil、ArthurZ、sergiopaniego、Molbap，2026-02）、[DeepSeek-V4: a million-token context that agents can actually use](https://huggingface.co/blog/deepseekv4)（burtenshaw）。Hugging Face 博客仓库未附独立许可证文件，按署名转载处理；文中引用的各家模型信息以 DeepSeek、Qwen、智谱官方 README/模型卡（MIT）为准。抓取于 2026-09-19。
> 第四节两段代码为本站用 Python 标准库编写并实测运行（输出原样粘贴），其中模型参数取自上述官方来源，KV 缓存一段明确标注为"示例配置"，不对应任何官方规格。
