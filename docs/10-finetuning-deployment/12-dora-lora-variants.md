---
title: LoRA 家族与 DoRA：把低秩更新拆成方向与幅值
source_url: https://arxiv.org/abs/2402.09353
author: Shih-Yang Liu、Chien-Yi Wang、Hongxu Yin、Pavlo Molchanov、Yu-Chiang Frank Wang 等（NVIDIA，DoRA 论文）；Hugging Face（PEFT 实现）
license: 论文按 arXiv 页面所列许可转述要点与公式；PEFT 源码为 Apache 2.0（本文代码与配置项说明译自其 `src/peft/tuners/lora/config.py` 主分支）
fetched_at: 2026-09-19
translated: true
versions: PEFT 主分支 `lora/config.py`（2026-09-19 抓取，含 `use_dora` 与 `init_lora_weights` 的 eva/olora/pissa/corda/loftq 等取值）；DoRA 论文 arXiv:2402.09353
order: 12
group: 训练
---
《LoRA 原理》把问题讲成一个假设：微调带来的权重变化 ΔW 是低秩的，所以用两个小矩阵 BA 去近似它就够。《QLoRA 与显存优化》解决了「装得下」，但没有解决「学得像」。当基座很强、数据很小、任务又偏「风格与行为」时，你常会遇到同一现象：秩已经调大、数据也干净，loss 却早早平了，而全参微调能继续降。DoRA 就是冲着这个缝隙来的——它不增加多少参数，而是改变**低秩更新该如何作用到权重上**。

本篇正文依据 DoRA 论文（arXiv:2402.09353）与 PEFT 主分支源码中的 `LoraConfig` 定义撰写；涉及显存与速度的地方一律给出**测法**而不给数字，具体数值取决于你的基座、秩与硬件。

## 一、LoRA 的一个结构性限制

LoRA 的更新形式是 `W' = W0 + BA`（含缩放系数时是 `W0 + (α/r)·BA`）。这里有一个容易被忽略的事实：`BA` 是一个**方向与大小混在一起**的加性项——它的每个输出通道要同时负责「往哪个方向挪」和「挪多远」。而预训练权重 `W0` 本身是在一个很大的幅度尺度上稳定的，一个幅度过大的加性扰动会把权重推离原流形，表现就是灾难性遗忘与泛化变差；幅度太小的扰动又学不动。

DoRA 的观察是：如果只让低秩矩阵负责**方向**，把**幅值**单独用一个向量来学，那么「低秩」这个强约束就不再需要同时承担两件事，表达能力会更接近全参更新，而参数量只增加很少。

## 二、DoRA 的做法：权重分解

DoRA 先按权重分解（WiSA）的思路把预训练权重写成方向与幅值的乘积：

```text
W0 = m · (V0 / ||V0||_c)
```

- `||·||_c` 是**按列**取范数（每一列对应一个输出通道）；
- `m ∈ R^{1×k_out}` 是幅值向量，一个输出通道一个标量；
- `V0 / ||V0||_c` 保留方向，即把每一列归一化。

微调时对方向做 LoRA 式的低秩更新，再乘上可学习的幅值：

```text
W' = m · (V0 + BA) / ||V0 + BA||_c
```

参数量对比（`W0` 形状 `d × k`，秩 `r`）：

| 方法 | 可训练参数 | 说明 |
|---|---|---|
| 全参微调 | `d × k` | 上限最高，代价也最高 |
| LoRA | `r × (d + k)` | 方向与幅值都由 BA 承担 |
| DoRA | `r × (d + k) + k` | 只多一个长度等于输出维度的向量 `m` |

多出来的这一项通常比 `BA` 小一个量级以上，所以「DoRA ≈ LoRA 的显存与存储预算」在实践中基本成立；但**计算图里多了一次列范数与逐列缩放**，前向与反向都会更慢一些——这正好是本文要你实测的部分。

论文里还有一个关键设计：幅值项的梯度与方向项的梯度是分开的，作者用这个视角解释为什么 DoRA 比 LoRA 更稳（更不容易把权重推出原流形），也是它比单纯把秩加大更可取的原因。

## 三、在 PEFT 里开启 DoRA

PEFT 把 DoRA 做成 `LoraConfig` 的一个开关，而不是独立的 tuner，因此它与 LoRA 共用全部配置项（目标模块、秩、dropout、`bias` 等）。以下片段可直接跑通（模型名以你环境里的现行小模型为例）：

```python
# 依赖：pip install -U peft transformers datasets accelerate bitsandbytes
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model

base_id = "<你的基座模型仓库名>"          # 选一个你有权访问的小模型即可
model = AutoModelForCausalLM.from_pretrained(
    base_id,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
tok = AutoTokenizer.from_pretrained(base_id)

cfg_lora = LoraConfig(
    r=16,
    lora_alpha=32,
    lora_dropout=0.05,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    use_dora=False,                      # 对照组：纯 LoRA
)
cfg_dora = LoraConfig(**{**cfg_lora.to_dict(), "use_dora": True})   # 实验组：DoRA

peft_model = get_peft_model(model, cfg_dora)
peft_model.print_trainable_parameters()   # 会显示多出 m 向量后的可训练参数量

# 组优化器时，把 lora_A / lora_B 与 dora 的 magnitude 参数一起纳入
trainable = [p for n, p in peft_model.named_parameters() if p.requires_grad]
print([n for n, p in peft_model.named_parameters() if p.requires_grad][:8])
```

训练入口与 LoRA 完全一致（`SFTTrainer` 或手写循环），差别只在配置项。**做对照实验时务必只改 `use_dora` 一项**，其余（数据、种子、秩、α、学习率、步数）保持相同，否则结论无意义。

### 与量化基座组合

`use_dora` 是 LoRA 的叠加开关，因此逻辑上可与 QLoRA 的四比特基座同时使用；但 PEFT 对具体组合有硬性限制，例如源码里显式抛错：

> `DoRA does not support megatron_core, please set use_dora=False.`

所以启用前一定在你自己的 PEFT 版本上跑一遍最小样例（几十字节的假数据 + 2 个 step），确认没有断言/异常，再看训练曲线。不要凭「文档写过」就把它接进长任务。

### 初始化策略（`init_lora_weights`）

DoRA 之外，PEFT 在同一条 LoRA 路线上还给了不少**初始化**方案，主分支 `config.py` 的文档串里列出的取值为：`True`/`"gaussian"`/`"eva"`/`"olora"`/`"pissa"`/`"pissa_niter_[n]"`/`"corda"`/`"loftq"`/`"orthogonal"`/`"mica"`。它们与 DoRA 是**正交**的两件事：前者决定 BA 从什么起点开始（例如用 SVD 分解基座权重得到 PiSSA/oLoRA 起点），后者决定更新如何作用到权重上。想搭「最好的组合」，正确顺序是：先把秩与目标模块定下来 → 再挑初始化策略 → 最后才试 `use_dora`，一次只动一个变量。

## 四、怎么判断 DoRA 值不值得开

不要问「DoRA 是不是更强」，要问「在我这个任务上，DoRA 相对 LoRA 是否用可接受的代价换来可复现的收益」。最小对照协议：

1. 固定数据与评测集，固定随机种子，跑 `use_dora=False/True` 两组；
2. 记录四项：可训练参数量、峰值显存、训练吞吐（tokens/s）、任务指标；
3. 显存用 `torch.cuda.max_memory_allocated()` 在每个实验前 `reset_peak_memory_stats()` 后测量；吞吐用训练日志里的 step 时间换算，不要用 wall clock 目测；
4. 指标至少看两个：主任务分数、以及一个「没被训练到的能力」的退化检查（比如通用指令遵循），DoRA 的一个卖点是更不容易遗忘。

```python
import torch

def peak_mem_gb(reset: bool = True) -> float:
    if torch.cuda.is_available():
        if reset:
            torch.cuda.reset_peak_memory_stats()
        return torch.cuda.max_memory_allocated() / 1024**3
    return 0.0

def count_trainable(model) -> tuple[int, int]:
    tr = sum(p.numel() for p in model.parameters() if p.requires_grad)
    tot = sum(p.numel() for p in model.parameters())
    return tr, tot
```

判读经验（属于工程判断，不是论文结论）：

- 任务是**风格、格式、行为约束**类（要求模型改变输出习惯而非注入大量新知识），DoRA 更容易看到差异；
- 任务是**知识注入**类且秩本来就给得小，瓶颈往往在秩与数据，不在分解方式——先加秩或改数据；
- 推理侧多出的列范数计算在合并权重后通常不再存在（`merge_and_unload` 之后是普通权重），但**能否与你的量化/推理栈一起合并**要实测：合并失败或精度异常时，退回不合并、以 adapter 方式加载。

## 五、常见坑

1. **只改 DoRA 不改种子**：两组实验若数据顺序不同，差异全被噪声吃掉。
2. **`target_modules` 抄自别的模型**：不同架构投影层命名不同（`out_proj`、`up_proj`、FFN 是否纳入），命名写错时 PEFT 会静默不加适配器——用 `print_trainable_parameters()` 确认参数确实被挂上。
3. **把幅值当「学习率放大器」**：`m` 与主干共享同一学习率时不稳，出现早期剧烈漂移就降低学习率再看，而不是先加 dropout。
4. **以为 DoRA 能替代秩的调整**：它改变的是更新的作用方式，不改变低秩子空间的维度上限。
5. **忽略与 megatron 等后端的不兼容**（源码显式抛错），也忽略训练后合并路径的差异。
6. **拿别人的收益数字当预期**：DoRA 的收益高度依赖任务与基座，任何未在你的评测上复现的增幅都不算数。

## 六、延伸阅读

- DoRA 论文与官方实现索引：[arXiv:2402.09353](https://arxiv.org/abs/2402.09353)
- PEFT LoRA 配置源码（含 `use_dora` 与全部初始化取值）：[src/peft/tuners/lora/config.py](https://github.com/huggingface/peft/blob/main/src/peft/tuners/lora/config.py)
- 同模块相关篇：《LoRA 原理：低秩适应为什么有效》《QLoRA 与显存优化：单卡微调大模型》《LLaMA-Factory 与 Unsloth 实战对比》《训练超参与过拟合诊断：学习率、秩与 loss 曲线判读》

---

> **来源**：抓取于 2026-09-19。原理与公式部分依据 [DoRA: Weight-Decomposed Low-Rank Adaptation](https://arxiv.org/abs/2402.09353)（Shih-Yang Liu、Chien-Yi Wang、Hongxu Yin、Pavlo Molchanov、Yu-Chiang Frank Wang 等，NVIDIA；按 arXiv 页面所列许可转述要点，未复制原文正文段落）；配置项、`init_lora_weights` 取值清单与 megatron 不兼容提示译自 [huggingface/peft](https://github.com/huggingface/peft) 主分支 `src/peft/tuners/lora/config.py`（Apache 2.0，2026-09-19 抓取）。「判读经验」「常见坑」与对照实验协议为本站编者注，不属原文内容；文中显存与速度部分刻意不给数值，需按正文协议自行实测。
