---
title: LLaMA-Factory 与 Unsloth 实战对比：配置式 vs 代码式微调
source_url: https://github.com/hiyouga/LLaMA-Factory
author: hiyouga 等（LLaMA-Factory 官方 README）、Unsloth AI（Unsloth 官方 README 与文档）
license: Apache 2.0（LLaMA-Factory）、Apache 2.0 + AGPL-3.0 双许可（Unsloth：核心包 Apache 2.0，Unsloth Studio UI 为 AGPL-3.0）
fetched_at: 2026-09-19
translated: true
versions: LLaMA-Factory main（2026-09-19 核实，要求 python ≥3.11、torch ≥2.0.0/推荐 2.6.0、transformers ≥4.49.0、peft ≥0.14.0、trl ≥0.8.6）；unsloth 当前 main（2026-09-19 核实）
order: 21
group: 训练
---
微调框架这块，"能跑"早已不是问题，问题是**选哪一套工作方式**。LLaMA-Factory 与 Unsloth 代表两条完全不同的路线：前者把 Transformers + PEFT + TRL + DeepSpeed 封装成**YAML 配置 + CLI/WebUI**，你不写训练循环；后者把性能做到内核层，用**手写的自定义 `FastLanguageModel` + 标准 `SFTTrainer`**，换来显存与速度的直接收益。本篇按官方 README 与官方文档把两者摆在一起，给出可复现的最小示例、同型号同数据口径下的显存与耗时对照表，以及"什么时候该选谁"的结论。

## 先理解两者的设计差异

| 维度 | LLaMA-Factory | Unsloth |
| --- | --- | --- |
| 抽象层 | 训练流程的封装：写 YAML，`llamafactory-cli train xxx.yaml` | 内核与显存的优化：写 Python，用 `FastLanguageModel.from_pretrained` 替换 `AutoModelForCausalLM` |
| 是否要写训练代码 | 不用。也提供 `run_exp.py` 之类的脚本入口 | 要。数据、`SFTConfig`、`SFTTrainer` 都自己写 |
| 界面 | 自带 **LLaMA Board**（Gradio WebUI）与 CLI | **Unsloth Studio**（Web UI，AGPL-3.0）、Colab/Kaggle notebook |
| 训练阶段覆盖 | Pre-Training / SFT / Reward Modeling / PPO / DPO / KTO / ORPO / SimPO ×（Full / Freeze / LoRA / QLoRA / OFT / QOFT）矩阵 | 以 SFT/LoRA/QLoRA、GRPO 类 RL、embedding 与 TTS/扩散为主 |
| 数据集 | 内置一大批预训练/SFT/偏好数据集，自定义要注册进 `data/dataset_info.json` | 直接用 `datasets` 加载，配合 `train_on_responses_only` 做 label 遮蔽 |
| 模型下载源 | HF / ModelScope（`export USE_MODELSCOPE_HUB=1`）/ Modelers Hub，也支持本地盘与 s3/gcs 路径 | HF（走 `huggingface_hub` 缓存） |
| 部署出口 | `llamafactory-cli api ... infer_backend=vllm` 一键起 OpenAI 兼容服务 | 导出 GGUF / 合并权重后交给 [vLLM](./16-vllm-high-throughput-deployment) 或 [Ollama](./15-ollama-local-deployment) |
| 前沿模型跟进 | README 明确以 "Day-N Support" 列表跟进新模型 | README 同样主打 day-0 支持新开源模型 |
| 许可风险 | Apache 2.0，商用无额外约束 | 核心 Apache 2.0；**Studio UI 是 AGPL-3.0**，把它作为服务对外提供时要评估传染性条款 |

一句话：**LLaMA-Factory 的产物是"一份可复盘的配置"，Unsloth 的产物是"一段可改的代码 + 省下来的显存"。**

## 安装

### LLaMA-Factory

官方要求：python 最低 3.11（推荐 ≥3.11）、torch 最低 2.0.0（推荐 2.6.0）、transformers 最低 4.49.0（推荐 4.50.0）、datasets 2.16.0+、accelerate 0.34.0+、peft 0.14.0+（推荐 0.15.1）、trl 0.8.6+（推荐 0.9.6）；可选项 CUDA 最低 11.6（推荐 12.2）、deepspeed 0.10.0+、bitsandbytes 0.39.0+、vllm 0.4.3+、flash-attn 2.5.6+。

```bash
git clone --depth 1 https://github.com/hiyouga/LLaMA-Factory.git
cd LLaMA-Factory
pip install -e ".[torch,metrics]"
# 验证
llamafactory-cli version
```

Windows x86-64 上要自己先装 GPU 版 PyTorch；装 bitsandbytes 要注意它发布时绑定的 CUDA Toolkit 版本——官方 README 明确提示：**RTX 50 系（sm_120）需要 CUDA 12.8–12.9 的 bnb 构建**。

起 WebUI：

```bash
llamafactory-cli webui
```

### Unsloth

官方给的是 uv 路线（Linux / WSL）：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv venv unsloth_env --python 3.13
source unsloth_env/bin/activate
uv pip install unsloth --torch-backend=auto
```

## 最小可跑示例：同一个模型各跑一遍

### LLaMA-Factory：一份 YAML 搞定 SFT + 推理 + 合并

官方 Quickstart 的三条命令（LoRA 微调 / 对话测试 / 合并导出 Qwen3-4B-Instruct）：

```bash
llamafactory-cli train   examples/train_lora/qwen3_lora_sft.yaml
llamafactory-cli chat    examples/inference/qwen3_lora_sft.yaml
llamafactory-cli export  examples/merge_lora/qwen3_lora_sft.yaml
```

这份 `qwen3_lora_sft.yaml` 的完整内容值得逐行看，它就是"配置式微调"的全部知识面：

```yaml
### 模型
model_name_or_path: Qwen/Qwen3-4B-Instruct-2507
trust_remote_code: true

### 方法
stage: sft                    # 训练阶段：sft / pt / rm / ppo / dpo / kto / orpo
do_train: true
finetuning_type: lora         # 也可为 full / freeze / oft
lora_rank: 8
lora_target: all              # 关键：all 会自动匹配全部可行线性层

### 数据集
dataset: identity,alpaca_en_demo
template: qwen3_nothink       # 对话模板，必须与基座匹配
cutoff_len: 2048
max_samples: 1000
preprocessing_num_workers: 16
dataloader_num_workers: 4

### 输出
output_dir: saves/qwen3-4b/lora/sft
logging_steps: 10
save_steps: 500
plot_loss: true
overwrite_output_dir: true
save_only_model: false
report_to: none               # 可选 [none, wandb, tensorboard, swanlab, mlflow]

### 训练超参
per_device_train_batch_size: 1
gradient_accumulation_steps: 8
learning_rate: 1.0e-4
num_train_epochs: 3.0
lr_scheduler_type: cosine
warmup_ratio: 0.1
bf16: true
ddp_timeout: 180000000
resume_from_checkpoint: null
```

自定义数据要注册到 `data/dataset_info.json`（官方 NOTE 明确写了这一步），否则 `dataset:` 里填了也找不到。用 vLLM 起服务：

```bash
API_PORT=8000 llamafactory-cli api examples/inference/qwen3.yaml \
    infer_backend=vllm vllm_enforce_eager=true
```

### Unsloth：代码式 QLoRA

Unsloth 的用法是把模型加载换成 `FastLanguageModel`，其余仍是 TRL 的标准件：

```python
import torch
from datasets import load_dataset
from unsloth import FastLanguageModel
from trl import SFTTrainer, SFTConfig

max_seq_length = 2048   # 官方建议：先用 2048 测试，Unsloth 支持 4 倍以上长上下文

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name="meta-llama/Llama-3.1-8B",
    max_seq_length=max_seq_length,
    load_in_4bit=True,      # 4-bit QLoRA：显存降到约 1/4；关掉即 16-bit LoRA
    full_finetuning=False,  # 设 True 即全参微调
)

model = FastLanguageModel.get_peft_model(
    model,
    r=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                    "gate_proj", "up_proj", "down_proj"],
    lora_alpha=32,
    lora_dropout=0,
    bias="none",
    use_gradient_checkpointing="unsloth",  # 官方：约 30% 更省显存
    random_state=3407,
)

ds = load_dataset("yahma/alpaca-cleaned", split="train[:5000]")

trainer = SFTTrainer(
    model=model,
    tokenizer=tokenizer,
    train_dataset=ds,
    dataset_text_field="text",
    max_seq_length=max_seq_length,
    args=SFTConfig(
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=1,
        learning_rate=2e-4,
        logging_steps=10,
        optim="adamw_8bit",        # bnb 的 8-bit 优化器
        weight_decay=0.01,
        warmup_steps=10,
        seed=3407,
    ),
)

# 只对被回复的部分算 loss（等价于手写 IGNORE_TOKEN_ID 遮蔽）
from unsloth.chat_templates import train_on_responses_only
trainer = train_on_responses_only(
    trainer,
    instruction_part="<|start_header_id|>user<|end_header_id|>\n\n",
    response_part="<|start_header_id|>assistant<|end_header_id|>\n\n",
)

trainer.train()
```

::: important 别忘了两行收尾
1. 推理前调用 `FastLanguageModel.for_inference(model)`。官方提醒 Unsloth 本身还提供约 **2 倍推理加速**，不调这行拿不到。
2. 保存 adapter 用 `model.save_pretrained("lora_model")`；要给 vLLM/Ollama 用则 `model.save_pretrained_merged(...)` 或导出 GGUF。导 GGUF 时**不要先合并**，否则精度会变。
:::

## 显存与耗时对照（同型号、同数据集口径）

**必须先说清楚方法学差异**，否则这张表会被误读成独立实测：

- Unsloth 的数字来自其官方 Benchmarks 页：测试条件明确给出——**H100 与 Blackwell GPU，Alpaca 数据集，batch size 2、gradient accumulation 4、rank 32、QLoRA 应用到全部线性层（q/k/v/o/gate/up/down）**，对照组是 "Hugging Face + FlashAttention-2"。
- LLaMA-Factory 的数字来自其官方 README 的 **Hardware Requirement** 表，官方自己标了 `* estimated`（估算），维度是"模型规模 × 方法 × 位宽"，与数据集和卡型无关。
- 另外还有一组第三方视角的数据：**LLaMA-Factory 自己集成 Unsloth 后测出的数字**（见下表最后一行），这可以当作对 Unsloth 宣传值的收敛校验。

| 对照项 | 基线 | 对比值 | 数据出处 |
| --- | --- | --- | --- |
| Llama 3.1 **8B** QLoRA（上述条件，H100） | HF + FA2 速度记为 1x | **Unsloth 2x 速度、>70% 显存下降、12x 更长上下文** | Unsloth 官方 Benchmarks |
| Llama 3.3 **70B** QLoRA（同条件，80GB） | HF + FA2 1x | **Unsloth 2x 速度、>75% 显存下降、13x 更长上下文** | Unsloth 官方 Benchmarks |
| Llama 3.1 8B **最大可训上下文** @ 24 GB | HF + FA2 = 5,789 token | Unsloth = **78,475 token** | Unsloth 官方上下文长度实测表 |
| 同上 @ 8 GB | HF + FA2 = **OOM** | Unsloth = 2,972 token | 同上 |
| 同上 @ 80 GB | HF + FA2 = 28,454 | Unsloth = 342,733 | 同上 |
| Llama 3.3 70B @ 48 GB | HF + FA2 = **OOM** | Unsloth = 12,106 | 同上 |
| Llama-2-**7B** 长序列（56k） | — | LLaMA-Factory 官方 changelog 记载：可在 **24 GB** 内跑；相比 FlashAttention-2 达 **117% 速度、50% 显存** | LLaMA-Factory README（其集成了 unsloth 后端） |

**框架自身的显存估算**（LLaMA-Factory 官方表，*estimated*，单位 GB；这一列描述的是"训练"而不是"推理"）：

| 方法 | 位宽 | 7B | 14B | 30B | 70B |
| --- | --- | --- | --- | --- | --- |
| Full（`bf16` 或 `fp16`） | 32 | 120 | 240 | 600 | 1200 |
| Full（`pure_bf16`） | 16 | 60 | 120 | 300 | 600 |
| Freeze / LoRA / GaLore / APOLLO / BAdam / OFT | 16 | 16 | 32 | 64 | 160 |
| QLoRA / QOFT | 8 | 10 | 20 | 40 | 80 |
| QLoRA / QOFT | 4 | **6** | 12 | 24 | 48 |
| QLoRA / QOFT | 2 | 4 | 8 | 16 | 24 |

**怎么把两张表合起来读（编者结论）**：

1. 同一台机器、同一个模型，Unsloth 相对 "Transformers + FA2" 的**显存降幅 70%+**，与 LLaMA-Factory 那张表从 "LoRA 16-bit = 16 GB" 到 "QLoRA 4-bit = 6 GB" 的跨度是**两个不同变量**（前者是内核与激活优化，后者是权重位宽），可以叠加。也就是说 **Unsloth 上做 4-bit QLoRA 才是它最占优的场景**；把它当纯训练入口跑 16-bit LoRA，收益会明显小于宣传值。
2. 上下文长度才是差距最夸张的一维：8B 在 24 GB 卡上从 ~5.8k 拉到 ~78k，**十几倍**。如果你的数据是长文档/长 CoT，这一项的权重要放到最高。
3. **速度收益有前提**。Unsloth 官方自己标注了：`torch.compile` 通常要 **~5 分钟甚至更久**预热，如果在前几步就测吞吐会得出"变慢了"的错误结论。要在完全加载后再计时。
4. LLaMA-Factory 侧给出的 "117% 速度、50% 显存" 显著低于 Unsloth 自己的 "2x、>70%"。两者不矛盾：前者是在 LF 的集成路径下对比 FA2，训练循环、数据管线、序列长度都不同。**把它当作下限、把 Unsloth 的宣传当作上限来规划容量**，是比较稳的做法。

## 什么时候选谁

| 你的情况 | 选 | 理由 |
| --- | --- | --- |
| 要给非工程同事一个能自己点的界面；要跑 DPO/KTO/ORPO/RM/PPO 全套阶段矩阵 | **LLaMA-Factory** | 阶段覆盖是全的，Unsloth 的 RL 主线主要是 GRPO 一族 |
| 需要复现别人的配置、把超参进 Git 做审计 | **LLaMA-Factory** | 一整份 YAML 就是实验记录 |
| 多卡 DeepSpeed / FSDP+QLoRA（官方称 2×24 GB 可训 70B） | **LLaMA-Factory** | 原生 `--deepspeed` 与 examples 齐备 |
| 消费级单卡（24 GB 甚至 16 GB）训 8B，或要长上下文 | **Unsloth** | 显存与上下文长度的实测差距最大 |
| 要在训练逻辑里动手脚（自定义 loss 遮蔽、逐层策略、embedding/TTS） | **Unsloth** | 它给你的是代码 |
| 国内网络拿模型 | **LLaMA-Factory** | `USE_MODELSCOPE_HUB=1` 一行切魔搭 |
| 想把微调完的模型直接对外提供服务 | 两者都要出去到 vLLM/Ollama | LF 有 `llamafactory-cli api ... infer_backend=vllm`；Unsloth 走合并导出 |
| 对外提供服务、要评估许可 | **LLaMA-Factory 更省事** | Unsloth Studio UI 是 AGPL-3.0 |

## 常见坑

1. **LLaMA-Factory 的 `template` 填错**。它必须与基座的对话模板一致（例中 `qwen3_nothink`）；填成别的模型的模板，训出来的模型指令遵循会废。对照本模块《训练范式回顾与全参微调流程》里 Chat Template 与 label 遮蔽的关系来理解为什么这件事不是"格式问题"。
2. **自定义数据集没注册**。只放文件不改 `data/dataset_info.json`，`dataset:` 里就是找不到——这是 LF 最高频的问题。
3. **Unsloth 忘了 `for_inference`**，然后到评测环节怀疑"是不是训坏了"。
4. **Unsloth 在 warmup 期就计时**，得到负收益结论（见上文第 3 点）。
5. **把两边的显存表混着用**。LF 的表是**训练**占用（含优化器状态与激活），Unsloth 的对照也是训练；不要拿它们去估推理显存，推理要按位宽换算 + KV cache 估，见[模型量化基础](./13-quantization-basics)与[推理原理](./14-inference-principles)。
6. **以为 Unsloth 会改变精度口径**。官方对"2x 更快 / 70% 更省"的补充说明是 **无精度损失**（no accuracy loss）；但它的收益依赖自定义内核与梯度检查点实现，跨版本行为可能变——换大版本要重跑一遍业务评测，见 [LLM 评测方法与基准](./19-evaluation-benchmarks)。
7. **QLoRA 初始化没配套**。不管走哪个框架，4-bit 基座上训 LoRA 都建议配 LoftQ/EVA 类初始化，见 [QLoRA 与显存优化](./05-qlora-memory-optimization)。

## 延伸阅读

- 微调范式与 Chat Template 原理：[训练范式回顾与全参微调流程](./03-training-paradigms-full-finetuning)
- LoRA/QLoRA 参数怎么定：[LoRA 原理](./04-lora-principles)、[QLoRA 与显存优化](./05-qlora-memory-optimization)、[训练超参与过拟合诊断](./09-hyperparams-overfitting)
- 不用封装库、直接写 TRL：[PEFT/TRL 实战：SFTTrainer 做有监督微调](./10-trl-sft-practice)
- LoRA 的变体（DoRA / rsLoRA / 各种初始化）：[DoRA 与 LoRA 变体全景](./23-dora-lora-variants)
- 微调产物上线：[vLLM 高吞吐部署](./16-vllm-high-throughput-deployment)
- 领域继续预训练：[继续预训练（CPT）与领域自适应](./08-cpt-domain-adaptation)

---

> **来源**：抓取于 2026-09-19。① LLaMA-Factory 部分引自 [hiyouga/LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory) 官方 README（main 分支，作者 hiyouga 与贡献者，Apache 2.0，经仓库 LICENSE 核实）：Requirement 两张表、Hardware Requirement 估表、Supported Training Approaches 矩阵、Installation / Data Preparation / Quickstart / Fine-Tuning with LLaMA Board / Deploy with OpenAI-style API and vLLM / Download from ModelScope Hub 各节，以及 changelog 中 2024-04-16 关于 unsloth 集成（Llama-2-7B-56k within 24GB、117% speed、50% memory vs FlashAttention-2）与 2024-03-20 关于 FSDP+QLoRA（70B on 2×24GB）的记载；`examples/train_lora/qwen3_lora_sft.yaml` 为仓库原文件逐行转载（注释译为中文，未改字段与取值）。② Unsloth 部分引自 [unslothai/unsloth](https://github.com/unslothai/unsloth) 官方 README（Apache 2.0 核心 + AGPL-3.0 Studio UI 双许可，README License 节已核实）、[Unsloth Benchmarks](https://unsloth.ai/docs/basics/unsloth-benchmarks) 与 [Fine-tuning LLMs Guide](https://unsloth.ai/docs/get-started/fine-tuning-llms-guide)：安装命令、notebook 性能/显存对照表、H100+Blackwell 的 QLoRA 基准表、Llama 3.1 8B 与 Llama 3.3 70B 的最大上下文长度表、`torch.compile` 预热提示、`max_seq_length`/`load_in_4bit`/`full_finetuning` 参数说明与 `FastLanguageModel.for_inference` 提示。③ Unsloth 代码示例、选型结论、常见坑与"上限/下限"读法为编者整理与判断，非任一官方原文；表中所有百分比与倍数均为**各框架官方自报口径**，测试条件互不相同，不构成独立复现实测。未收录内容：LLaMA-Factory 的完整数据集清单、Docker/NPU 部署细节、WebUI 截图，Unsloth 的 Studio 与云服务条款，请查阅原文。
