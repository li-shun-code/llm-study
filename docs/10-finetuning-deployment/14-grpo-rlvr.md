---
title: GRPO 与 RLVR：推理模型强化学习实战
source_url: https://huggingface.co/docs/trl/main/grpo_trainer
author: Hugging Face（TRL 官方文档）、DeepSeek-AI（DeepSeek-R1 官方仓库 README）
license: Apache 2.0（TRL）、MIT（DeepSeek-R1）
fetched_at: 2026-09-13
translated: true
versions: TRL 主分支文档（2026-09 当前版）；DeepSeek-R1 仓库当前版
order: 14
group: 对齐与强化学习
---
上一篇 DPO 解决了"没有奖励模型也要对齐偏好"。这一篇进入推理模型时代的主流后训练方法：**GRPO**（Group Relative Policy Optimization，组相对策略优化）——DeepSeekMath 提出、经 DeepSeek-R1 用可验证奖励（RLVR，Reinforcement Learning with Verifiable Rewards）路线发扬光大。本文第一部分译自 DeepSeek-R1 官方仓库 README（MIT），第二部分完整翻译 TRL 官方文档 GRPOTrainer 一页（Apache 2.0），文末逐节署名。

# 第一部分：DeepSeek-R1——纯强化学习驱动的推理模型（译自 DeepSeek-R1 官方 README）

## 引言（译自原文第 1 节）

我们介绍第一代推理模型 DeepSeek-R1-Zero 与 DeepSeek-R1。

DeepSeek-R1-Zero 是**跳过监督微调（SFT）、直接用大规模强化学习（RL）训练**的模型，在推理任务上展现了卓越性能。借助 RL，DeepSeek-R1-Zero 自然涌现出众多强大而有趣的推理行为。然而它也遇到无限重复、可读性差、语言混杂等挑战。为解决这些问题并进一步增强推理性能，我们推出 DeepSeek-R1——在 RL 之前加入冷启动数据。DeepSeek-R1 在数学、代码与推理任务上达到与 OpenAI-o1 相当的性能。为支持研究社区，我们开源了 DeepSeek-R1-Zero、DeepSeek-R1，以及基于 Llama 与 Qwen 从 DeepSeek-R1 蒸馏出的六个稠密模型。其中 DeepSeek-R1-Distill-Qwen-32B 在多项基准上超越 OpenAI-o1-mini，创造稠密模型的新纪录。

> 在本地运行 DeepSeek-R1 系列模型之前，建议先阅读"使用建议"一节。

## 模型概要（译自原文第 2 节）

**后训练：在基座模型上做大规模强化学习**

- 我们把强化学习**直接**施加于基座模型，不依赖 SFT 作前置步骤。这让模型自主探索解决复杂问题的思维链（CoT），最终产生了 DeepSeek-R1-Zero。DeepSeek-R1-Zero 展现出自我验证、反思、生成长 CoT 等能力，是研究社区的重要里程碑。值得注意的是，这是首个验证"LLM 推理能力可以纯粹靠 RL 激励、无需 SFT"的公开研究，为该方向的后续进展铺平了道路。
- 我们提出构建 DeepSeek-R1 的流水线：包含两个 RL 阶段（用于发现更优推理模式、对齐人类偏好）与两个 SFT 阶段（作为模型推理与非推理能力的种子）。我们相信该流水线将帮助业界造出更好的模型。

**蒸馏：小模型也可以很强大**

- 我们证明：大模型的推理模式可以蒸馏进小模型，效果优于在小模型上直接用 RL 发现的推理模式；
- 用 DeepSeek-R1 生成的推理数据，我们微调了社区广泛使用的多个稠密模型。评测表明蒸馏出的小型稠密模型在基准上表现异常出色。我们向社区开源了基于 Qwen2.5 与 Llama3 系列的 1.5B/7B/8B/14B/32B/70B 蒸馏权重。

DeepSeek-R1-Zero 与 DeepSeek-R1 基于 DeepSeek-V3-Base 训练，模型架构详见 DeepSeek-V3 仓库。R1-Zero 使用的奖励即"可验证奖励"（准确度奖励 + 格式奖励，均为规则计算而非神经网络奖励模型）——这正是 RLVR 路线；它也是 GRPO 论文的直接应用场景（GRPO 由同一团队的 DeepSeekMath 提出）。

## 使用建议（译自原文第 6 节 Usage Recommendations）

**为保证预期性能，使用（含基准测试）DeepSeek-R1 系列模型时建议遵循以下配置：**

1. 温度设在 0.5–0.7 之间（推荐 0.6），防止无限重复或语无伦次；
2. **避免添加系统提示；所有指令都应放进用户提示**；
3. 数学问题建议在提示中加一句指令："Please reason step by step, and put your final answer within \boxed{}."（请一步步推理，并把最终答案放进 \boxed{}）；
4. 评测时建议多次测试取平均。

此外我们观察到，DeepSeek-R1 系列在回答某些查询时会跳过思考模式（即直接输出空的 \<think\>\n\n\</think\>），这会损害性能。**为确保模型充分思考，建议强制模型每次输出都以 "\<think\>\n" 开头。**

蒸馏模型可用 vLLM 直接起服务：

```shell
vllm serve deepseek-ai/DeepSeek-R1-Distill-Qwen-32B --tensor-parallel-size 2 --max-model-len 32768 --enforce-eager
```

# 第二部分：TRL GRPO Trainer 完整翻译（译自 TRL 官方文档）

## 概述（Overview）

TRL 提供 GRPO Trainer 用于训练语言模型，方法出自论文 [DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models](https://huggingface.co/papers/2402.03300)（Shao、Wang、Zhu、Xu、Song、Zhang、Li、Wu、Guo）。

论文摘要如下：

> 数学推理因其复杂与结构化的本质，对语言模型构成重大挑战。本文介绍 DeepSeekMath 7B：以 120B 数学相关 token（源自 Common Crawl）连同自然语言与代码数据，对 DeepSeek-Coder-Base-v1.5 7B 做继续预训练。DeepSeekMath 7B 在竞赛级 MATH 基准上取得 51.7%，不依赖外部工具包与投票技术，逼近 Gemini-Ultra 与 GPT-4 的水平；64 样本自一致性达 60.9%。DeepSeekMath 的数学推理能力归因于两个关键因素：其一，通过精心设计的数据选择流水线，释放了公开网络数据的巨大潜力；其二，提出了组相对策略优化（GRPO）——近端策略优化（PPO）的变体，在提升数学推理能力的同时优化了 PPO 的内存占用。

该后训练方法由 Quentin Gallouédec 贡献至 TRL。

## 快速开始（Quick start）

以下示例演示如何用 GRPO 方法训练模型：以 [DeepMath-103K 数据集](https://huggingface.co/datasets/trl-lib/DeepMath-103K)的提示训练 [Qwen2.5 0.5B Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)。

```python
# train_grpo.py
from datasets import load_dataset
from trl import GRPOTrainer
from trl.rewards import accuracy_reward

dataset = load_dataset("trl-lib/DeepMath-103K", split="train")

trainer = GRPOTrainer(
    model="Qwen/Qwen2.5-0.5B-Instruct",
    reward_funcs=accuracy_reward,
    train_dataset=dataset,
)
trainer.train()
```

执行脚本：

```bash
accelerate launch train_grpo.py
```

在 8 张 GPU 上分布式训练大约需要 1 天。官方文档中给出的奖励曲线（reward curves）由 `Qwen/Qwen2-0.5B-Instruct` 生成；`Qwen2.5-0.5B-Instruct` 的结果在定性上类似。

## 深入 GRPO 方法（Looking deeper into the GRPO method）

GRPO 是**在线学习（online learning）**算法：训练中利用被训练模型自己生成的数据迭代改进。GRPO 目标的直觉是最大化生成补全（completions）的优势（advantage），同时保证模型不偏离参考策略太远。理解 GRPO 可拆成四个主要步骤：**生成补全**、**计算优势**、**估计 KL 散度**、**计算损失**。

### 生成补全（Generating completions）

每个训练步，采样一批提示词，为每个提示生成一组 \\( G \\) 个补全（记作 \\( o_i \\)）。

### 计算优势（Computing the advantage）

对每个补全，用奖励模型或奖励函数计算奖励。为契合奖励模型的比较性本质（通常在"同一问题的多个输出对比"数据上训练），优势按相对比较来归一化：

$$\hat{A}_{i,t} = \frac{r_i - \text{mean}(\mathbf{r})}{\text{std}(\mathbf{r})}$$

这正是方法名字的由来：**组相对策略优化（GRPO）**。

> **TIP**：论文《Understanding R1-Zero-Like Training: A Critical Perspective》指出，除以 \\( \text{std}(\mathbf{r}) \\) 可能引入题目级难度偏差。可在 `GRPOConfig` 中设 `scale_rewards=False` 关闭该缩放。注意关掉 std 缩放同时也会去掉方差归一化，更新幅度将直接取决于原始奖励量级与批次构成。

> **TIP**：如《Part I: Tricks or Traps? A Deep Dive into RL for LLM Reasoning (Lite PPO)》所示，在局部（组）层面算均值、在全局（批）层面算标准差，可以得到更稳健的奖励整形。在 `GRPOConfig` 中设 `scale_rewards="batch"` 即可使用该策略。

### 估计 KL 散度（Estimating the KL divergence）

KL 散度用 Schulman 等（2020）提出的估计量近似：

$$\mathbb{D}_{\text{KL}}\left[\pi_\theta \|\pi_{\text{ref}}\right] = \frac{\pi_{\text{ref}}(o_{i,t} \mid q, o_{i,<t})}{\pi_\theta(o_{i,t} \mid q, o_{i,<t})} - \log \frac{\pi_{\text{ref}}(o_{i,t} \mid q, o_{i,<t})}{\pi_\theta(o_{i,t} \mid q, o_{i,<t})} - 1$$

### 计算损失（Computing the loss）

目标是在最大化优势的同时让模型贴近参考策略，因此损失定义为：

$$
\mathcal{L}_{\text{GRPO}}(\theta) = -\frac{1}{\sum_{i=1}^G |o_i|} \sum_{i=1}^G \sum_{t=1}^{|o_i|} \left[ \frac{\pi_\theta(o_{i,t} \mid q, o_{i,< t})}{\left[\pi_\theta(o_{i,t} \mid q, o_{i,< t})\right]_{\text{no grad}}} \hat{A}_{i,t} - \beta \mathbb{D}_{\text{KL}}\left[\pi_\theta \| \pi_{\text{ref}}\right] \right]
$$

第一项是缩放后的优势，第二项通过 KL 散度惩罚对参考策略的偏离。

> **TIP**：与 DeepSeekMath 原始公式不同，TRL 不再按 \\( \frac{1}{|o_i|} \\) 缩放——《Understanding R1-Zero-Like Training: A Critical Perspective》证明这会引入响应级长度偏差。详见下文 loss types。

> **TIP**：同样与原始公式不同，TRL 默认 \\( \beta = 0.0 \\)，即不使用 KL 散度项。多项近期研究（如 Open-Reasoner-Zero）表明 KL 项对 GRPO 训练并非必需，排除它已成常见实践（如 Understanding R1-Zero-Like Training、DAPO）。若想保留 KL 项，把 `GRPOConfig` 中的 `beta` 设为非零即可。

原论文还把该公式推广到"每次生成后做多次更新"（次数记为 \\( \mu \\)，TRL 中对应 `num_iterations`），利用**裁剪代理目标（clipped surrogate objective）**：

$$
\mathcal{L}_{\text{GRPO}}(\theta) = - \frac{1}{\sum_{i=1}^G |o_i|} \sum_{i=1}^G \sum_{t=1}^{|o_i|} \left[ \min \left( \frac{\pi_\theta(o_{i,t} \mid q, o_{i,< t})}{\pi_{\theta_{\text{old}}}(o_{i,t} \mid q, o_{i,< t})} \hat{A}_{i,t}, \, \text{clip}\left( \frac{\pi_\theta(o_{i,t} \mid q, o_{i,< t})}{\pi_{\theta_{\text{old}}}(o_{i,t} \mid q, o_{i,< t})}, 1 - \epsilon, 1 + \epsilon \right) \hat{A}_{i,t} \right) - \beta \mathbb{D}_{\text{KL}}\left[\pi_\theta \| \pi_{\text{ref}}\right] \right]
$$

其中 \\(\text{clip}(\cdot, 1 - \epsilon, 1 + \epsilon) \\) 把策略比率约束在 \\( 1 - \epsilon \\) 与 \\( 1 + \epsilon \\) 之间，防止更新过度偏离参考策略。当 \\( \mu = 1 \\)（TRL 默认）时，裁剪代理目标退化为上面的原始目标。

### 损失类型（Loss Types）

文献中有多种目标形式。GRPO 最初的形式为：

$$
\mathcal{L}_{\text{GRPO}}(\theta) = - \frac{1}{G} \sum_{i=1}^G \frac{1}{|o_i|} \sum_{t=1}^{|o_i|} l_{i,t}
$$

其中 \\( l_{i,t} = \frac{\pi_\theta(o_{i,t} \mid q, o_{i,< t})}{\left[\pi_\theta(o_{i,t} \mid q, o_{i,< t})\right]_{\text{no grad}}} \hat{A}_{i,t} - \beta \mathbb{D}_{\text{KL}}\left[\pi_\theta \| \pi_{\text{ref}}\right] \\)。

[DAPO 论文](https://huggingface.co/papers/2503.14476)指出 GRPO 样本级损失在长 CoT 场景的局限：较长的响应被欠惩罚，导致输出质量下降。解决方案是 token 级归一化，对每个 token 分配更均衡的奖励、不受响应长度影响：

$$
\mathcal{L}_{\text{DAPO}}(\theta) = - \frac{1}{\sum_{i=1}^G |o_i|} \sum_{i=1}^G \sum_{t=1}^{|o_i|} l_{i,t}
$$

使用该形式：`loss_type="dapo"`。

《Understanding R1-Zero-Like Training: A Critical Perspective》进一步证明最初的 GRPO 公式存在响应长度偏差；DAPO 形式能减轻但无法完全消除。要彻底消除，可除以常数而非序列长度：

$$
\mathcal{L}_{\text{Dr. GRPO}}(\theta) = - \frac{1}{LG} \sum_{i=1}^G \sum_{t=1}^{|o_i|} l_{i,t}
$$

该常数建议取最大补全长度。使用该形式：`loss_type="dr_grpo"`。

此外，[SAPO 论文](https://huggingface.co/papers/2511.20347)（Qwen 团队）提出用平滑的、温度控制的软门控（soft gating）替代 GRPO 的"硬"裁剪。GRPO 在策略偏离参考过远时把梯度清零，SAPO 则用软信任域平滑衰减梯度权重，让模型保留"近在策"（near-on-policy）token 的有用学习信号，同时抑制极端偏离的噪声。软门控函数 \\( f_{i,t} \\) 用 sigmoid 函数 \\( \sigma \\) 定义：\\( f_{i,t}(x) = \sigma \left( \tau_{i,t} (x - 1) \right) \cdot \frac{4}{\tau_{i,t}} \\)；温度 \\( \tau_{i,t} \\) 按优势符号选取（正优势用 \\( \tau_{\text{pos}} \\)，否则 \\( \tau_{\text{neg}} \\)）。作者建议使用非对称温度 \\( \tau_{\text{neg}} > \tau_{\text{pos}} \\)（默认 \\( \tau_{\text{pos}}=1.0, \tau_{\text{neg}}=1.05 \\)）：对"坏"动作惩罚更严以防不稳定，对"好"动作更宽容。使用该形式：`loss_type="sapo"`。

## 记录的指标（Logged metrics）

训练与评测时记录以下指标（全部为原文清单的完整翻译；与 vLLM 重要性采样、MoE 辅助损失、特定 loss_type 相关的指标仅在对应配置开启时记录）：

- `num_tokens`：迄今处理的 token 总数（含提示与补全；使用工具时只计非工具 token）；
- `step_time`：每训练步（含生成）平均耗时（秒）；
- `completions/mean_length` / `min_length` / `max_length`：生成补全长度的均值/最小/最大值；
- `completions/mean_terminated_length` / `min_terminated_length` / `max_terminated_length`：以 EOS 结尾的补全长度统计；
- `completions/clipped_ratio`：被截断（clipped）补全的比例；
- `tools/call_frequency`：生成批次中每个补全的平均工具调用次数（提供 `tools` 时记录）；
- `tools/failure_frequency`：失败工具调用的比例（工具不存在、抛异常或调用类型不支持）；无调用时为 0.0；
- `rewards/{reward_func_name}/mean` 与 `/std`：各奖励函数奖励的均值与标准差（奖励由环境的 `get_reward` 持有时，函数名为环境类名）；
- `reward`：各函数奖励（按 `reward_weights` 加权）求和后的总体均值；
- `reward_std`：加权求和奖励在整批上的标准差；
- `frac_reward_zero_std`：生成批次中"奖励标准差为 0"的样本占比（提示缺乏多样性：全对或全错）；
- `sampling/sampling_logp_difference/mean` 与 `/max`：采样器（vLLM）返回的对数概率与训练模型重算值的平均/最大绝对差——数值增大说明训练-推理失配扩大（`use_vllm=True` 且 `vllm_importance_sampling_correction=True` 时记录）；
- `sampling/importance_sampling_ratio/min` / `mean` / `max`：约束后重要性采样比率的统计量；
- `policy_loss`：策略梯度损失值（熵加成之前）；
- `entropy`：生成补全上 token 预测的平均熵（若 `mask_truncated_completions=True`，排除被掩码序列的 token）；
- `entropy_coef`：当前熵正则系数（自适应熵时每优化步更新）；
- `aux_loss`：MoE 模型的负载均衡辅助损失（未乘 `router_aux_loss_coef` 之前）；
- `kl`：模型与参考模型在生成补全上的平均 KL 散度（`beta` 非零时记录）；
- `clip_ratio/region_mean`、`clip_ratio/low_mean`、`clip_ratio/low_min`、`clip_ratio/high_mean`、`clip_ratio/high_max`：GRPO 目标在信任域内被裁剪的 token（或序列）概率比率的各项统计——数值越高，被裁剪的 token 越多，策略变化受到的约束越强；
- `cispo_clip_ratio`、`vespo/phi_seq_mean`：分别仅在 `loss_type="cispo"` 与 `loss_type="vespo"` 时记录；
- `clip_ratio`：融合 Liger GRPO 损失报告的裁剪率（`use_liger_kernel=True` 时替代上述 `clip_ratio/*` 指标）。

## 定制（Customization）

### 用 vLLM 加速生成

在线方法的训练瓶颈往往在生成。可用高吞吐低延迟推理引擎 vLLM 加速。先安装：

```shell
pip install trl[vllm]
```

支持两种模式：**server 模式**与 **colocate 模式**。

> **TIP**：默认对 vLLM 生成启用截断重要性采样（Truncated Importance Sampling），以处理不同框架间生成-训练的失配；`vllm_importance_sampling_correction=False` 可关闭。

**选项 1：colocate 模式**——vLLM 跑在训练进程内、与训练模型共享 GPU 显存。无需另起服务、GPU 利用率更高，但训练 GPU 上可能争抢显存。这是默认模式：

```python
from trl import GRPOConfig

training_args = GRPOConfig(
    ...,
    use_vllm=True,  # vllm_mode="colocate" 默认
)
```

**选项 2：server 模式**——vLLM 跑在独立进程（独立 GPU），经 HTTP 与训练器通信。有专属推理 GPU 时最理想。

启动 vLLM 服务器：

```bash
VLLM_SERVER_DEV_MODE=1 vllm serve <model_name> \
    --weight-transfer-config '{"backend": "nccl"}' \
    --logprobs-mode processed_logprobs \
    --max-logprobs -1
```

训练脚本中启用：

```python
training_args = GRPOConfig(
    ...,
    use_vllm=True,
    vllm_mode="server",
)
```

> **WARNING**：服务器与训练器务必使用不同 GPU，否则可能遇到 NCCL 错误；用 `CUDA_VISIBLE_DEVICES` 指定 GPU。
>
> **TIP**：视模型大小与整体显存需求，可能需要调整 `vllm_gpu_memory_utilization`，官方提供 [HF Space](https://huggingface.co/spaces/trl-lib/recommend-vllm-memory) 估算推荐值；建议再加少量缓冲（如 +0.05 或 +0.1）。若仍显存不足，设 `vllm_enable_sleep_mode=True`，优化步期间 vLLM 参数与缓存会被卸载。
>
> **TIP**：默认 `MASTER_ADDR=localhost`、`MASTER_PORT=12345`，可用环境变量覆盖。

#### 处理训练-推理失配（Dealing with the Training-Inference Mismatch）

vLLM 大幅加速推理的同时，也把推理引擎与训练引擎解耦。理论上两者数学等价，实际上会因精度效应与硬件特定优化产生不同输出。这种分歧反映了两套系统优化目标的不同：推理引擎追求采样吞吐（token/秒）并保持可接受的采样保真度；训练框架则聚焦数值稳定性与梯度计算精度（主权重与优化器状态常用 FP32 等高精度格式）。两者必然存在细微失配。

该失配导致有偏的梯度更新，已被观察到会使训练不稳定（多篇研究，详见原文引用）。以 REINFORCE 策略梯度为例（公式见原文）：当 vLLM 参与生成时，有效策略梯度从 \\( \pi^\text{train} \\) 的期望变成 \\( \pi^\text{inference} \\) 的期望——原本在策（on-policy）的 RL 问题变成了离策（off-policy）问题。

修正分布偏移的标准方法是**重要性采样（IS）**。TRL 提供两个变体：截断重要性采样（TIS）与掩码重要性采样（MIS），都可在 token 级或序列级应用。记重要性权重为 \\( \rho \\)：TIS 把落在 `[vllm_importance_sampling_clip_min, vllm_importance_sampling_clip_max]` 之外的比率裁剪（\\( \rho \leftarrow \text{clip}(\rho, C_{\min}, C_{\max}) \\)——在 IcePop 方法启发下的双边形式）；MIS 把范围外的比率置零，这些样本不贡献梯度。一句话：**离群样本在 TIS 下被降权，在 MIS 下被丢弃**。配置项 `vllm_importance_sampling_mode` 同时选择变体（掩码/截断）与粒度（token/序列）。

重要性采样是对失配的原则性算法回应；也有更直接的工程手段减少两引擎本身的失配：如 MiniMax M1 在推理引擎中使用 FP32 语言模型头；Thinking Machines 探索确定性推理内核（效率代价显著）；vLLM 基于其批量不变确定性内核展示了逐位一致（bitwise-consistent）的策略，但截至 2025 年 11 月相对标准 vLLM 推理仍有明显吞吐损失。

### 用 transformers continuous batching 加速训练

作为 vLLM 的替代，可用 transformers 内建的 continuous batching 引擎加速生成：立即把已完成的序列移出批次，而不必等最慢的序列结束。对补全长度差异大的任务（如数学推理），在大批量（N≥32）下比默认 `generate()` 更快、更省显存：

```python
training_args = GRPOConfig(
    ...,
    use_transformers_continuous_batching=True,
    transformers_continuous_batching_config={
        "use_cuda_graph": False,
        "max_memory_percent": 0.4,  # 更低的值给训练反向传播留更多显存
    },
)
```

> **TIP**：continuous batching 是即插即用升级，无需服务器或权重同步，适合单卡或显存受限环境；追求极致生成吞吐仍用 vLLM。TRL 把 `max_memory_percent` 默认为 `0.5`（transformers 默认 0.9）以给反向传播留显存；大批次或 OOM 时可降到 0.3–0.4。

### 规模化 GRPO：多节点训练 70B+ 模型

训练 Qwen2.5-72B 这类大模型需要几项关键优化：

- **DeepSpeed ZeRO Stage 3**：用数据并行把模型状态（权重、梯度、优化器状态）分布到多 GPU/CPU，单卡装不下的大模型训练必备；
- **Accelerate**：简化跨 GPU/节点分布式训练的库，处理数据并行、梯度累积与分布式数据加载等复杂性；
- **vLLM**：见上节。

官方给出 5 节点 SLURM 示例脚本：4 节点训练 + 第 5 节点跑 vLLM 生成（完整脚本见原文，核心是 `srun ... accelerate launch --config_file examples/accelerate_configs/deepspeed_zero3.yaml --num_processes 32 --num_machines 4` 启动训练组、`srun ... vllm serve Qwen/Qwen2.5-72B --tensor-parallel-size 8 --weight-transfer-config '{"backend": "nccl"}' --logprobs-mode processed_logprobs --max-logprobs -1` 启动 vLLM 组），训练脚本中通过 `--vllm_server_host` 传入 vLLM 节点地址、`GRPOConfig(use_vllm=True, vllm_mode="server", per_device_train_batch_size=4)` 完成配置。

### 使用自定义奖励函数（Using a custom reward function）

`GRPOTrainer` 支持用自定义奖励函数替代稠密奖励模型。奖励函数可以是同步 Python 可调用对象，也可以是异步 `async def` 协程；传入多个异步奖励函数时它们并发执行（`asyncio.gather`），延迟相互重叠。

**入参要求**——函数必须以关键字参数接受：`prompts`（提示）、`completions`（生成的补全）、`completion_ids`（分词后的补全）、`trainer_state`（训练器状态，可用于课程学习等动态奖励）、`log_extra`（向补全表格追加列）、`log_metric`（记录标量指标绘图）、`environments`（每个补全一个环境实例，仅在提供 `environment_factory` 时出现），以及数据集中除 `prompt` 外的所有列名（如数据集有 `ground_truth` 列，函数会以 `ground_truth` 关键字参数被调用）。最简单的兼容写法是签名里用 `**kwargs`。数据集为标准格式时 `prompts`/`completions` 是字符串列表；会话格式时是消息字典列表。

**返回值**——返回浮点数列表，每个浮点数对应一个补全的奖励。

**示例 1：奖励更长的补全**（按 token 数）：

```python
def reward_func(completion_ids, **kwargs):
    """按 token 数给更长的补更高分。"""
    return [float(len(ids)) for ids in completion_ids]
```

**示例 2：奖励特定格式**（灵感来自 DeepSeek-R1 论文的 format reward，会话格式）：

```python
import re

def format_reward_func(completions, **kwargs):
    """检查补全是否符合特定格式。"""
    pattern = r"^<think>.*?</think><answer>.*?</answer>$"
    completion_contents = [completion[0]["content"] for completion in completions]
    matches = [re.match(pattern, content) for content in completion_contents]
    return [1.0 if match else 0.0 for match in matches]
```

**示例 3：对照参考答案奖励正确性**（灵感来自 DeepSeek-R1 论文的 accuracy reward，标准格式 + `ground_truth` 列）：

```python
import re

def reward_func(completions, ground_truth, **kwargs):
    # 正则抽取 \boxed{} 中的内容
    matches = [re.search(r"\\boxed\{(.*?)\}", completion) for completion in completions]
    contents = [match.group(1) if match else "" for match in matches]
    # 与真值相同得 1，否则 0
    return [1.0 if c == gt else 0.0 for c, gt in zip(contents, ground_truth)]
```

**示例 4：多任务奖励函数**——混合数学与编程数据集，含 `task` 列；`math_reward_func` 与 `coding_reward_func` 对不适用的样本返回 `None`，`GRPOTrainer` 会忽略 `None` 只采纳相关函数的奖励，从而支持多个适用范围不同的奖励函数并存。

**示例 5：异步奖励函数**——奖励依赖慢 I/O（如远程服务）时用 `async def`；多个异步奖励函数并发执行。

**示例 6：记录额外列与指标**——奖励函数可通过 `log_extra("golden_answer", list(ground_truth))` 向补全表加列、`log_metric("accuracy", ...)` 记录标量绘图；分布式训练中所有进程须记录相同的键集合。

**传给训练器**：`GRPOTrainer(reward_funcs=reward_func, ...)`；也可传列表（可混合同步与异步函数），总奖励为各函数之和（或配置 `reward_weights` 后的加权和）。

### 熵正则（Entropy regularization）

为鼓励探索、防止策略坍缩为近确定性输出，可给训练目标加熵奖励：\\( \mathcal{L}(\theta) = \mathcal{L}_{\text{GRPO}}(\theta) - \alpha \cdot \mathcal{H}(\pi_\theta) \\)，其中 \\( \mathcal{H} \\) 是策略的平均每 token 熵、\\( \alpha \\) 是熵系数。奖励始终用平均每 token 熵，不随 loss_type 重标定，因此 `entropy_coef` 对所有损失类型含义一致。

**静态熵**——全程固定系数：`GRPOConfig(entropy_coef=0.05, ...)`。

**自适应熵**——每优化步按目标熵更新系数（出自 Skywork-OR1）：当前熵 ≤ `entropy_target` 时系数加 `entropy_coef_delta`，否则递减；仅当熵不高于目标时系数才非零生效：

```python
training_args = GRPOConfig(
    entropy_coef=0.01,          # 初始系数
    use_adaptive_entropy=True,
    entropy_target=5.0,         # 目标平均每 token 熵（nats）；按模型调参
    entropy_coef_delta=0.005,   # 每优化步的步长
    entropy_coef_min=0.0,
    entropy_coef_max=1.0,
    ...
)
```

> **TIP**：典型语言模型的每 token 熵为 2–10 nats，因此默认 `entropy_target=0.2` 几乎从不触发正则——只有熵降到接近完全坍缩时才介入。请设成对你模型有意义的值，比如接近训练早期观察到的熵（即 `entropy` 指标）。使用 `top_entropy_quantile < 1.0` 时，`entropy_target` 作用于高熵 token 子集，该子集熵高于全 token 的 `entropy`，需相应校准。

`use_adaptive_entropy=True` 时，当前系数随检查点保存并在恢复训练时还原，训练完全可续跑。

### GRPO 快速实验（Rapid Experimentation for GRPO）

RapidFire AI 是架在 TRL 之上的开源实验引擎，可同时启动多个 GRPO 配置——哪怕单卡。它让你更早看到所有配置的学习曲线、及时停掉表现差的运行、并在不重启的情况下用新设置克隆有潜力的运行（详见 TRL 的 RapidFire 集成文档）。

## 智能体训练（Agent Training）

GRPO 支持**智能体训练**：模型在生成过程中调用工具，并从结果中学习。

- **工具（tool）**是暴露给模型的普通 Python 函数（同步或异步）。`tools` 适合无状态调用（计算器、网页搜索）；
- **环境（environment）**是更一般的形式：每次 rollout 新建的有状态对象，其公共方法暴露为工具，外加 `reset` 生命周期钩子与可选的 `get_reward`（让环境自己持有奖励）。需要每 rollout 状态、reset 钩子或环境持有奖励时用 `environment_factory`。

两者可组合使用。

### 工具（Tools）

`tools` 参数接受 Python 函数列表。每个工具必须是**参数与返回值有类型注解**、**带 Google 风格 docstring**（描述用途、参数与返回值）的标准函数。

> **TIP**：GRPO 工具调用循环要求聊天模板是"前缀保持"的（追加工具消息不能改变更早消息的渲染）。对已知模型家族（如 Qwen3、DeepSeek-V3），启用工具时 TRL 会自动换用修补过的训练模板。

用 `max_tool_calling_iterations` 限制工具调用轮数；默认无限制，当模型生成不含工具调用的响应轮时生成停止。

```python
def multiply(a: int, b: int) -> int:
    """
    Multiplies two integers.

    Args:
        a: The first integer.
        b: The second integer.

    Returns:
        The product of the two integers.
    """
    return a * b

async def async_add(a: int, b: int) -> int:
    """
    Asynchronously adds two integers.

    Args:
        a: The first integer.
        b: The second integer.

    Returns:
        The sum of the two integers.
    """
    return a + b

trainer = GRPOTrainer(
    tools=[multiply, async_add],
    ...,
)
```

### 环境（Environments）

也可以通过 `environment_factory` 提供工具。此模式下 `GRPOTrainer` 为每个 rollout 创建一个环境实例，把环境的公共方法暴露为工具（需要 `transformers>=5.2.0`）。

使用 `environment_factory` 时数据由环境持有：没有外部 `train_dataset`。每次 rollout 由 `reset()` 产出任务（从环境自持语料采样或程序化生成状态）并返回提示；`max_steps` 决定训练长度。以下是一个自采样目标并暴露 `increment` 方法的最小环境示例：

```python
import random

from trl import GRPOConfig, GRPOTrainer

class IncrementEnv:
    # 保留方法
    def reset(self, **kwargs) -> str | None:  # 必需；每次 rollout 开始时调用
        self.counter = 0
        self.target = random.randint(1, 6)  # 自采样任务
        return f"Increment the counter by {self.target}."  # 返回的字符串成为提示

    def get_reward(self) -> float:  # 可选：环境从自身状态打分
        return float(self.counter == self.target)

    # 公共方法（暴露为工具）
    def increment(self, step: int) -> int:
        """
        Increment the internal counter.

        Args:
            step: Value to add to the counter.

        Returns:
            The updated counter value.
        """
        self.counter += step
        return self.counter

trainer = GRPOTrainer(
    model="Qwen/Qwen3-0.6B",
    args=GRPOConfig(max_steps=1000, chat_template_kwargs={"enable_thinking": False}),
    environment_factory=IncrementEnv,
)
trainer.train()
```

环境类有两个保留方法 `reset` 与 `get_reward`，它们不会暴露为工具。`reset`（必需）在 rollout 开始时调用，可返回 `None` 或字符串（GRPO 中返回的字符串即用户提示）。`get_reward`（可选，同步或异步）无参数返回 `float`：环境从内部状态为本轮 episode 打分（游戏赢了吗？猜对词了吗？），每个完成的 rollout 调用一次，充当奖励来源。

> **NOTE**：由于环境在每次 `reset()` 时自采样，GRPO 组内 \\( G \\) 个成员的初始状态可能不同，组基线会略噪。要组内状态一致，让 `reset()` 从共享键确定性地派生状态即可。

**可选提供外部数据集**：不让环境自采样时，可传 `train_dataset`（任务已在数据集中、或在多个环境间路由时）。每个 rollout 采样一行，`"prompt"` 列作提示，其余列以关键字参数传入 `reset()`（环境从数据集读任务）。

### 奖励（Rewards）

环境持有与训练器持有的奖励并不互斥：把自然的文本层奖励（如格式检查）交给 `reward_funcs`，同时让环境经 `get_reward` 返回依赖状态的奖励，两者求和；`reward_weights` 只作用于 `reward_funcs`（环境自己掌握尺度）。设 `environment_factory` 后，奖励函数还能经 `environments` 关键字参数直接读环境状态（偶有用处，但状态依赖的奖励建议用 `get_reward`）。这对 `AsyncGRPOTrainer` 同样适用。

### 多环境（Multiple environments）

单次训练混合多种任务（如编程任务与游戏）时，传一个"环境名 → 工厂"的字典。每个 rollout 通过数据集的 `environment` 字段选择环境，**且只暴露该环境的工具**（避免把游戏的 `move` 工具泄漏给编程样例，反之亦然）。数据集只需 `environment` 列做路由；环境实例跨步复用（episode 之间 reset），昂贵的 `__init__` 只付一次。官方给出 `CodingEnv`（`run_code` 工具）与 `GameEnv`（`move` 工具）双环境完整示例，见原文。

### 多模态工具响应（Multimodal Tool Responses）

工具可返回"文本 + 图像"的内容块列表，用于需要视觉反馈的 VLM 智能体训练（截图、图表、相机画面）。返回的图像会自动注入对话，供 VLM 后续生成轮使用：

```python
from PIL import Image

def take_screenshot() -> list:
    """
    Takes a screenshot of the current screen.

    Returns:
        The screenshot image with a description.
    """
    img = Image.open("screenshot.png")
    return [{"type": "image", "image": img}, {"type": "text", "text": "Here is the screenshot."}]
```

### 支持的模型（Supported Models）

智能体训练已测试：Gemma4（如 `google/gemma-4-E2B-it`）、GLM-4-MoE（4.5/4.6/4.7，如 `zai-org/GLM-4.7`）、GPT-OSS（如 `openai/gpt-oss-20b`）、Llama 3.1/3.2、Qwen2.5、Qwen3、Qwen3-VL、Qwen3.5（如 `Qwen/Qwen3.5-2B`）、Qwen3.6（如 `Qwen/Qwen3.6-35B-A3B`）等。

> **TIP**：不保证兼容所有 LLM。若你认为某模型应被支持，欢迎在 GitHub 提 issue 或提交 PR。

### 环境集成（Environment Integrations）

所有环境都插入同一个 `environment_factory` 槽位，在 TRL 层面可互换——选生态匹配你任务的即可：

| 集成 | 是什么 | 何时用 |
|---|---|---|
| OpenEnv | 开放环境标准（Gymnasium 风格 API，经 WebSocket 或容器化执行提供服务），由 Hugging Face 与社区支持 | 使用 Hub 上现成的 OpenEnv 环境，或按开放标准定义自己的环境（如 Wordle、Sudoku、Catch） |
| OpenReward | 与 ORS 协议环境的集成（openreward.ai 目录或自建 ORS 服务器）；任务**和**奖励都经 HTTP 提供 | 想针对 ORS 环境训练：目录中的环境、自托管环境或开发中的本地服务器 |
| Harbor | 与 Harbor 任务套件的集成：每个任务是一条指令 + 一个真实沙箱镜像（`docker`、`e2b`…）+ 一个沙箱内验证器 | 想针对 Harbor 任务套件训练：任务树中每个任务都是自包含的沙箱加验证器（如在沙箱里翻文件写答案、由评分器检查的数据分析智能体） |

## 训练视觉语言模型（Training Vision Language Models）

GRPO 支持在含文本与图像的多模态数据集上训练视觉语言模型（VLM）。

**已测试模型**：Gemma3、LLaVA-NeXT、Qwen2-VL、Qwen2.5-VL、SmolVLM2。

**快速开始**：用官方 `grpo_vlm.py` 示例脚本微调 VLM（在 `lmms-lab/multimodal-open-r1-8k-verified` 上训练）：

```bash
accelerate launch \
  --config_file=examples/accelerate_configs/deepspeed_zero3.yaml \
  examples/grpo_visual_math/grpo_visual_math.py \
  --model_name_or_path Qwen/Qwen2.5-VL-3B-Instruct \
  --output_dir grpo-Qwen2.5-VL-3B-Instruct \
  --learning_rate 1e-5 \
  --dtype bfloat16 \
  --max_completion_length 1024 \
  --use_vllm \
  --vllm_mode colocate \
  --use_peft \
  --lora_target_modules "q_proj", "v_proj" \
  --log_completions
```

**配置建议**：在视觉-语言投影层上用 LoRA；开 4-bit 量化省显存；VLM 吃显存，先从小批次起步；多数模型兼容 vLLM（server 与 colocate 模式）。

**数据集格式**：每个样本包含 `prompt`（经处理器聊天模板格式化的文本）与 `image`/`images`（PIL Image 或其列表）。训练器经模型的图像处理器自动完成图像到张量的转换。

## API 参考

`GRPOTrainer` 与 `GRPOConfig` 的完整参数文档见原文（[[autodoc]] API 页）。

---

> **来源**：抓取于 2026-09-13。① 第一部分译自 [deepseek-ai/DeepSeek-R1](https://github.com/deepseek-ai/DeepSeek-R1) 官方仓库 README（第 1 节 Introduction、第 2 节 Model Summary、第 6 节 Usage Recommendations 及 Distill 模型 vLLM 用法），作者 DeepSeek-AI，许可 MIT；完整评测表、官方搜索/文件模板提示词、本地部署（DeepSeek-V3 仓库指引）与联系方式等未收录，请查阅原文；"RLVR 即可验证奖励"的对应关系说明为编者注。② 第二部分完整翻译自 TRL 官方文档 [GRPO Trainer](https://huggingface.co/docs/trl/main/grpo_trainer)（主分支 docs/source/grpo_trainer.md，Apache 2.0）：Overview / Quick start / 方法四步 / Loss Types / Logged metrics / Customization（vLLM 两种模式、训练-推理失配与重要性采样、continuous batching、70B+ 多节点、自定义奖励函数全部六个示例、熵正则、RapidFire）/ Agent Training（tools、environments、rewards、多环境、多模态工具响应、支持模型、环境集成）/ VLM 训练各节均完整翻译；仅省略了原文的内嵌 iframe 数据集浏览器、HF Space 嵌入窗口、图片、70B 节中与正文重复的完整 SLURM/训练脚本清单（已改为要点转述并注明出处）以及公式排版中的空格修正；指标清单为逐条完整翻译。`GRPOTrainer`/`GRPOConfig` 的 autodoc API 参数表未译，请查阅原文。
