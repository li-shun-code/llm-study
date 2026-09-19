---
title: 训练范式回顾与全参微调流程（Transformers 实战）
source_url: https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter6/%E7%AC%AC%E5%85%AD%E7%AB%A0%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E6%B5%81%E7%A8%8B%E5%AE%9E%E8%B7%B5.md
author: DataWhale happy-llm 项目组
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
versions: transformers Trainer（`processing_class` / `eval_strategy` 现行 API）+ DeepSpeed ZeRO-2（2026-09 核实）
order: 3
group: 训练
---
## 6.1 模型预训练

在实际应用中，手写实现的 LLM 训练存在以下问题：

- 手写实现 LLM 结构工作量大，难以实时跟进最新模型的结构创新；
- 从零实现的 LLM 训练无法较好地实现多卡分布式训练，训练效率较低；
- 和现有预训练 LLM 不兼容，无法使用预训练好的模型参数。

因此，我们介绍目前 LLM 领域的主流训练框架 Transformers，并结合分布式框架 DeepSpeed、高效微调框架 peft 等主流框架，实践使用 Transformers 进行模型 Pretrain、SFT 全流程，更好地对接业界的主流 LLM 技术方案。

### 6.1.1 框架介绍

Transformers 是由 Hugging Face 开发的 NLP 框架，通过模块化设计实现了对 BERT、GPT、LLaMA、T5、ViT 等上百种主流模型架构的统一支持。通过使用 Transformers，开发者无需重复实现基础网络结构，通过 AutoModel 类即可一键加载任意预训练模型。

同时，框架内置的 Trainer 类封装了分布式训练的核心逻辑，支持 PyTorch 原生 DDP、DeepSpeed、Megatron-LM 等多种分布式训练策略。通过简单配置训练参数，即可实现数据并行（Data Parallelism）、模型并行、流水线并行的混合并行训练。其还支持与 DeepSpeed、peft、wandb、SwanLab 等框架进行集成，直接通过参数设置即可无缝对接，从而快速、高效实现 LLM 训练。

对 LLM 时代更为重要的是，HuggingFace 基于 Transformers 框架搭建了庞大的 AI 社区，开放了数亿个预训练模型参数、25 万+不同类型数据集，通过 Transformers、Datasets、Evaluate 等多个框架实现对预训练模型、数据集及评估函数的集成。在 LLM 时代，模型结构的调整和重新预训练越来越少，开发者更多的业务应用在于使用预训练好的 LLM 进行 Post-Training 和 SFT，来支持自己的下游业务应用。新发布的开源 LLM 如 DeepSeek、Qwen 也都会第一时间在 Transformers 社区开放其预训练权重与模型调用 Demo。

### 6.1.2 初始化 LLM

我们可以使用 transformers 的 AutoModel 类来直接初始化已经实现好的模型。对于任意预训练模型，其参数中都包含有模型的配置信息。如果想从头训练一个 LLM，可以使用一个已有的模型架构来直接初始化。这里以 [Qwen-2.5-1.5B](https://huggingface.co/Qwen/Qwen2.5-1.5B) 的模型架构为例：模型仓库中的 `config.json` 文件即是模型的配置信息，包括模型的架构、隐藏层大小、模型层数等。

我们可以沿用该模型的配置信息，初始化一个 Qwen2.5-1.5B 模型来进行训练，也可以在该配置信息的基础上进行更改，如修改隐藏层大小、注意力头数等，来定制一个模型结构。HuggingFace 提供了 Python 工具来便捷下载想使用的模型参数：

```python
import os
# 设置环境变量，此处使用 HuggingFace 镜像网站
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
# 下载模型到本地目录 qwen-1.5b
os.system('hf download Qwen/Qwen2.5-1.5B --local-dir qwen-1.5b')
```

::: note 命令名以现行版本为准
下载命令现在是 `hf download`（`huggingface_hub` 内置的统一 CLI，见官方 CLI 指南）。原书使用的 `huggingface-cli download --resume-download ...` 是旧写法：`huggingface-cli` 这一入口已被 `hf` 取代，且 `--resume-download` 不再需要——`hf download` 默认走缓存系统、支持断点续传，配合 `--local-dir` 时会在目标目录下建 `.cache/huggingface/` 元数据，跳过已下载且未变动的文件。旧命令在较新版本的 `huggingface_hub` 上仍可能可用，但会打弃用提示。
:::

下载完成后，可以使用 AutoConfig 类直接加载下载好的配置文件。**下文统一用 `model_path` 这一个变量表示本地模型目录**（原书此处定义的是 `model_path`、调用时却写成了未定义的 `model_name_or_path`，属笔误，已修正）：

```python
# 加载定义好的模型参数-此处以 Qwen2.5-1.5B 为例
# 使用 transformers 的 Config 类进行加载
from transformers import AutoConfig

# 下载参数的本地路径
model_path = "qwen-1.5b"
config = AutoConfig.from_pretrained(model_path)
```

也可以对配置文件进行自定义，然后以同样的方式加载即可。可以使用 AutoModel 类基于加载好的配置对象生成对应的模型：

```python
# 使用该配置生成一个定义好的模型
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_config(config, trust_remote_code=True)
```

由于 LLM 一般都是 CausalLM（因果语言模型）架构，此处使用了 AutoModelForCausalLM 类进行加载。如果是用于分类任务训练，可使用 AutoModelForSequenceClassification 类来加载。

该 model 就是一个从零初始化的 Qwen2.5-1.5B 模型了。一般情况下，我们很少从零初始化 LLM 进行预训练，较多的做法是加载一个预训练好的 LLM 权重，在自己的语料上进行后训练（Post-Training）：

```python
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True)
```

我们还需要初始化一个 tokenizer（分词器）：

```python
# 加载一个预训练好的 tokenizer
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained(model_path)
```

### 6.1.3 预训练数据处理

HuggingFace 的 datasets 库是和 transformers 框架配套的、用于数据下载和处理的第三方库。我们可以直接使用 datasets 的 `load_dataset` 函数来加载预训练数据（示例使用出门问问序列猴子开源数据集）：

```python
# 加载预训练数据
from datasets import load_dataset

ds = load_dataset('json', data_files='/mobvoi_seq_monkey_general_open_corpus.jsonl')
```

注意，由于数据集较大，加载可能会出现时间较长或内存不够的情况，建议前期测试时将预训练数据集拆分一部分出来进行测试。可以通过 feature 属性查看数据集的特征（也就是列），这里需要保存一下数据集的列名，因为后续数据处理时，再将文本 tokenize 之后，需要移除原先的文本：

```python
# 查看特征
column_names = list(ds["train"].features)
# column_names: ["text"]
```

接着使用加载好的 tokenizer 对数据集进行处理，此处使用 map 函数来进行批量处理：

```python
# 对数据集进行 tokenize
def tokenize_function(examples):
    # 使用预先加载的 tokenizer 进行分词
    output = tokenizer([item for item in examples["text"]])
    return output

# 批量处理
tokenized_datasets = ds.map(
    tokenize_function,
    batched=True,
    num_proc=10,
    remove_columns=column_names,
    load_from_cache_file=True,
    desc="Running tokenizer on dataset",
)
```

处理完成后的数据集会包括 `input_ids`、`attention_mask` 两列，分别是文本 tokenize 之后的数值序列和注意力掩码（标识是否 padding）。

由于预训练一般为 CLM 任务，一次性学习多个样本的序列语义不影响模型性能，且训练数据量大、训练时间长，对训练效率要求比较高。在预训练过程中，一般会把多个文本段拼接在一起，处理成统一长度的文本块，再对每个文本块进行训练：

```python
# 预训练一般将文本拼接成固定长度的文本段
from itertools import chain

# 这里我们取块长为 2048
block_size = 2048

def group_texts(examples):
    # 将文本段拼接起来
    concatenated_examples = {k: list(chain(*examples[k])) for k in examples.keys()}
    # 计算拼起来的整体长度
    total_length = len(concatenated_examples[list(examples.keys())[0]])
    # 如果长度太长，进行分块
    if total_length >= block_size:
        total_length = (total_length // block_size) * block_size
    # 按 block_size 进行切分
    result = {
        k: [t[i : i + block_size] for i in range(0, total_length, block_size)]
        for k, t in concatenated_examples.items()
    }
    # CLM 任务，labels 和 input 是相同的
    result["labels"] = result["input_ids"].copy()
    return result

# 批量处理
lm_datasets = tokenized_datasets.map(
    group_texts,
    batched=True,
    num_proc=10,
    load_from_cache_file=True,
    desc=f"Grouping texts in chunks of {block_size}",
    batch_size = 40000,
)
train_dataset = lm_datasets["train"]
```

处理得到的 train_dataset 就是一个可直接用于 CLM Pretrain 的预训练数据集了，其每个样本长度为 2048 个 token。

### 6.1.4 使用 Trainer 进行训练

接下来，我们使用 transformers 提供的 Trainer 类进行训练。Trainer 封装了模型的训练逻辑，且做了较好的效率优化、可视化等工作，可以高效、便捷地完成 LLM 的训练。

首先我们需要配置训练的超参数，使用 TrainingArguments 类来实例化一个参数对象：

```python
from transformers import TrainingArguments
# 配置训练参数

training_args = TrainingArguments(
    output_dir="output",          # 训练参数输出路径
    per_device_train_batch_size=4,# 训练的 batch_size
    gradient_accumulation_steps=4,# 梯度累计步数，实际 bs = 设置的 bs * 累计步数
    logging_steps=10,             # 打印 loss 的步数间隔
    num_train_epochs=1,           # 训练的 epoch 数
    save_steps=100,               # 保存模型参数的步数间隔
    learning_rate=1e-4,           # 学习率
    gradient_checkpointing=True   # 开启梯度检查点
)
```

然后基于初始化的 model、tokenizer 和 training_args，并传入处理好的训练数据集，实例化一个 trainer 对象：

```python
from transformers import Trainer, default_data_collator

# 训练器
trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=None,
    processing_class=tokenizer,
    # 不传 data_collator 时：给了 processing_class 且它是 tokenizer/feature extractor
    # 则默认用 DataCollatorWithPadding，否则才用 default_data_collator
    data_collator=default_data_collator,
)
```

::: warning 两处 API 名称已变更
1. **`Trainer` 不再接受 `tokenizer=` 参数**。transformers 已用 `processing_class` 取代它（可传 tokenizer、image processor 或 processor），现行 `Trainer.__init__` 的签名里已经没有 `tokenizer` 这一形参，照抄旧写法会直接 `TypeError`。
2. 原书把数据集包成了 `torchdata` 的 `IterableWrapper(train_dataset)`。没必要，而且带毒：`datasets.Dataset` 本身就能配 `default_data_collator`；一旦真的传进可迭代数据集，Trainer 无法从数据集长度推出总步数，`TrainingArguments` 里必须给 `max_steps`（否则 `num_train_epochs` 不生效）。用普通 map-style 数据集最省事。
:::

再使用 train 方法，即会按照配置好的训练超参进行训练和保存：

```python
trainer.train()
```

### 6.1.5 使用 DeepSpeed 实现分布式训练

由于预训练规模大、时间长，一般不推荐使用 Jupyter Notebook 来运行，容易发生中断。且由于预训练规模大，一般需要使用多卡进行分布式训练，否则训练时间太长。在这里，我们介绍如何基于上述代码，使用 DeepSpeed 框架实现分布式训练，从而完成业界可用的 LLM Pretrain。

长时间训练一般使用 bash 脚本设定超参，再启动写好的 python 脚本实现训练。脚本的关键步骤包括：

1. 通过 transformers 提供的 HfArgumentParser 工具加载 sh 脚本中设定的超参（模型相关超参 ModelArguments + 数据相关超参 DataTrainingArguments + TrainingArguments）；
2. 用 Python 自带 logging 库记录训练日志（大规模训练中不建议直接 print）；
3. 检测旧 checkpoint 并支持从 checkpoint 恢复训练；
4. 初始化模型（从零初始化或加载预训练权重二选一）；
5. 使用 SwanLab 等工具监测训练进度与 loss 下降趋势。

::: tip 编者注（节选说明）
原文在此给出了完整的 `pretrain.py` 脚本（约 300 行）与日志、checkpoint 恢复的实现细节，篇幅所限本处节选核心思路，完整代码见原书仓库 [happy-llm/chapter6/code](https://github.com/datawhalechina/happy-llm/tree/main/docs/chapter6/code)。
:::

完成上述代码后，我们使用一个 sh 脚本定义超参数的值，并通过 DeepSpeed 启动训练，从而实现高效的多卡分布式训练：

```bash
# 设置可见显卡
CUDA_VISIBLE_DEVICES=0,1

deepspeed pretrain.py \
    --config_name autodl-tmp/qwen-1.5b \
    --tokenizer_name autodl-tmp/qwen-1.5b \
    --train_files autodl-tmp/dataset/pretrain_data/mobvoi_seq_monkey_general_open_corpus_small.jsonl \
    --per_device_train_batch_size 16 \
    --gradient_accumulation_steps 4 \
    --do_train \
    --output_dir autodl-tmp/output/pretrain \
    --eval_strategy no \
    --learning_rate 1e-4 \
    --num_train_epochs 1 \
    --warmup_steps 200 \
    --logging_dir autodl-tmp/output/pretrain/logs \
    --logging_strategy steps \
    --logging_steps 5 \
    --save_strategy steps \
    --save_steps 100 \
    --preprocessing_num_workers 10 \
    --save_total_limit 1 \
    --seed 12 \
    --block_size 2048 \
    --bf16 \
    --gradient_checkpointing \
    --deepspeed ./ds_config_zero2.json \
    --report_to swanlab
```

在安装了 DeepSpeed 第三方库后，可以直接通过 DeepSpeed 命令来启动多卡训练。上述脚本命令主要是定义了各种超参数的值。

::: note 原书脚本里的 `--evaluation_strategy` 已改名为 `--eval_strategy`
`TrainingArguments` 现在只有 `eval_strategy` 这一个字段（`evaluation_strategy` 已从参数表里移除），传旧名会报未知参数。同理，`logging_strategy`/`save_strategy` 仍是现行名字，无需改动。
:::

此处加载了 `ds_config_zero2.json` 作为 DeepSpeed 的配置参数（ZeRO-2 阶段）：

```json
{
    "fp16": {
        "enabled": "auto",
        "loss_scale": 0,
        "loss_scale_window": 1000,
        "initial_scale_power": 16,
        "hysteresis": 2,
        "min_loss_scale": 1
    },
    "bf16": {
        "enabled": "auto"
    },
    "optimizer": {
        "type": "AdamW",
        "params": {
            "lr": "auto",
            "betas": "auto",
            "eps": "auto",
            "weight_decay": "auto"
        }
    },
    "scheduler": {
        "type": "WarmupLR",
        "params": {
            "warmup_min_lr": "auto",
            "warmup_max_lr": "auto",
            "warmup_num_steps": "auto"
        }
    },
    "zero_optimization": {
        "stage": 2,
        "offload_optimizer": {
            "device": "none",
            "pin_memory": true
        },
        "allgather_partitions": true,
        "allgather_bucket_size": 2e8,
        "overlap_comm": true,
        "reduce_scatter": true,
        "reduce_bucket_size": 2e8,
        "contiguous_gradients": true
    },
    "gradient_accumulation_steps": "auto",
    "gradient_clipping": "auto",
    "steps_per_print": 100,
    "train_batch_size": "auto",
    "train_micro_batch_size_per_gpu": "auto",
    "wall_clock_breakdown": false
}
```

最后，在终端 bash 运行该 `pretrain.sh` 脚本即可开始训练。

## 6.2 模型有监督微调

在上一节，我们介绍了如何使用 Transformers 框架快速、高效地进行模型预训练。在本部分，我们将基于上部分内容，介绍如何使用 Transformers 框架对预训练好的模型进行有监督微调。

### 6.2.1 Pretrain VS SFT

首先需要回顾一下，对 LLM 进行预训练和进行有监督微调的核心差异在于什么。目前成型的 LLM 一般通过 Pretrain-SFT-RLHF 三个阶段来训练：在 Pretrain 阶段，会对海量无监督文本进行自监督建模，来学习文本语义规则和文本中的世界知识；在 SFT 阶段，一般通过对 Pretrain 好的模型进行指令微调，即训练模型根据用户指令完成对应任务，从而使模型能够遵循用户指令，根据用户指令进行规划、行动和输出。

因此，Pretrain 和 SFT 均使用 CLM 建模，其核心差异在于：Pretrain 使用海量无监督文本进行训练，模型直接对文本执行"预测下一个 token"的任务；而 SFT 使用构建成对的指令对数据，模型根据输入的指令，建模后续的输出。反映到具体的训练实现上，**Pretrain 会对全部 text 进行 loss 计算，要求模型对整个文本实现建模预测；而 SFT 仅对输出进行 loss 计算，不计算指令部分的 loss**。

因此，相较于上一节完成的 Pretrain 代码，SFT 部分仅需要修改数据处理环节，实现对指令对数据转化为训练样本的构建，其余部分和 Pretrain 是完全一致的实现逻辑。

### 6.2.2 微调数据处理

在 SFT 过程中，我们会定义一个 Chat Template（对话模板），这个 Template 即表示了如何将对话数据转化为一个模型可以建模拟合的文本序列。当我们使用做过 SFT 的模型进行下游任务微调时，一般需要查看该模型的 Chat Template 并进行适配，即是为了不损伤其在 SFT 中学到的指令遵循能力。由于我们此处使用 Pretrain 模型进行 SFT，可以自定义一个 Chat Template。这里我们沿承使用 Qwen-2.5 的 Chat Template。

我们首先定义几个特殊 token，特殊 token 在模型进行拟合中有特殊的作用，包括文本序列开始（BOS）、文本序列结束（EOS）、换行符等。定义特殊 token，有助于避免模型在拟合过程中的语义混淆：

```python
# 不同的 tokenizer 需要特别定义
# BOS
im_start = tokenizer("<|im_start|>").input_ids
# EOS
im_end = tokenizer("<|im_end|>").input_ids
# PAD
IGNORE_TOKEN_ID = tokenizer.pad_token_id
# 换行符
nl_tokens = tokenizer('\n').input_ids
# 角色标识符
_system = tokenizer('system').input_ids + nl_tokens
_user = tokenizer('human').input_ids + nl_tokens
_assistant = tokenizer('assistant').input_ids + nl_tokens
```

Qwen 系列的 Chat Template 一般有三个对话角色：System、User 和 Assistant。System 是系统提示词，负责激活模型的能力，默认为 "You are a helpful assistant."，一般不会在 SFT 过程中更改使用。User 即为用户给出的提示词。Assistant 即为 LLM 给出的回复，也就是模型在 SFT 过程中需要拟合的文本。

接着，由于该数据集是一个多轮对话数据集，我们需要对多轮对话进行拼接处理，将多轮对话拼接到一个文本序列中：

```python
# 拼接多轮对话
input_ids, targets = [], []
# 多个样本
for i in tqdm(range(len(sources))):
    # source 为一个多轮对话样本
    source = sources[i]
    # 从 user 开始
    if source[0]["from"] != "human":
        source = source[1:]
    # 分别是输入和输出
    input_id, target = [], []
    # system: 【BOS】system\nYou are a helpful assistant.【EOS】\n
    system = im_start + _system + tokenizer(system_message).input_ids + im_end + nl_tokens
    input_id += system
    # system 不需要拟合
    target += im_start + [IGNORE_TOKEN_ID] * (len(system)-3) + im_end + nl_tokens
    assert len(input_id) == len(target)
    # 依次拼接
    for j, sentence in enumerate(source):
        # sentence 为一轮对话
        role = roles[sentence["from"]]
        # user：<|im_start|>human\ninstruction【EOS】\n
        # assistant：<|im_start|>assistant\nresponse【EOS】\n
        _input_id = tokenizer(role).input_ids + nl_tokens + \
            tokenizer(sentence["value"]).input_ids + im_end + nl_tokens
        input_id += _input_id
        if role == '<|im_start|>human':
            # user 不需要拟合
            _target = im_start + [IGNORE_TOKEN_ID] * (len(_input_id)-3) + im_end + nl_tokens
        elif role == '<|im_start|>assistant':
            # assistant 需要拟合
            _target = im_start + [IGNORE_TOKEN_ID] * len(tokenizer(role).input_ids) + \
                _input_id[len(tokenizer(role).input_ids)+1:-2] + im_end + nl_tokens
        else:
            print(role)
            raise NotImplementedError
        target += _target
    assert len(input_id) == len(target)
    # 最后进行 PAD
    input_id += [tokenizer.pad_token_id] * (max_len - len(input_id))
    target += [IGNORE_TOKEN_ID] * (max_len - len(target))
    input_ids.append(input_id[:max_len])
    targets.append(target[:max_len])
```

上述代码沿承了 Qwen 的 Chat Template 逻辑，其核心点在于 **User 的文本不需要拟合**，因此 targets 中 User 对应的文本内容是使用的 IGNORE_TOKEN_ID 进行遮蔽，而 Assistant 对应的文本内容则是文本原文，是需要计算 loss 的。目前主流 LLM 的 IGNORE_TOKEN_ID 一般设置为 -100。

完成拼接后，将 tokenize 后的数值序列转化为 `torch.Tensor`，再拼接成 Dataset 所需的字典返回：

```python
input_ids = torch.tensor(input_ids)
targets = torch.tensor(targets)

return dict(
    input_ids=input_ids,
    labels=targets,
    attention_mask=input_ids.ne(tokenizer.pad_token_id),
)
```

完成上述处理逻辑后，需要自定义一个 Dataset 类，在该类中调用该逻辑进行数据的处理：

```python
class SupervisedDataset(Dataset):

    def __init__(self, raw_data, tokenizer, max_len: int):
        super(SupervisedDataset, self).__init__()
        # 加载并预处理数据
        sources = [example["conversations"] for example in raw_data]
        # preprocess 即上文定义的数据预处理逻辑
        data_dict = preprocess(sources, tokenizer, max_len)

        self.input_ids = data_dict["input_ids"]
        self.labels = data_dict["labels"]
        self.attention_mask = data_dict["attention_mask"]

    def __len__(self):
        return len(self.input_ids)

    def __getitem__(self, i) -> Dict[str, torch.Tensor]:
        return dict(
            input_ids=self.input_ids[i],
            labels=self.labels[i],
            attention_mask=self.attention_mask[i],
        )
```

该类继承自 Torch 的 Dataset 类，可以直接在 Trainer 中使用。完成数据处理后，基于上一节脚本修改数据处理逻辑即可，后续模型训练等几乎完全一致（加载 BelleGroup 等开源指令数据集 → 构造 SupervisedDataset → 初始化 Trainer → `trainer.train()`）。

::: tip 编者注：三行代码的现代替代
上文的 Chat Template 拼接与"仅对 assistant 回复计算 loss"正是 TRL `SFTTrainer` 内置能力（`assistant_only_loss=True`、自动应用 chat template）要解决的问题。工程实践中，先用本文理解原理，再用《PEFT/TRL 实战：SFTTrainer 做有监督微调》提升效率，两者对照学习效果最佳。
:::

## 小结

- Pretrain 与 SFT 都做"预测下一个 token"，区别在数据与 loss 范围：前者全文本、后者仅 assistant 输出。
- Transformers Trainer + DeepSpeed ZeRO 是全参微调/预训练的主流工程组合：训练脚本要处理好日志、checkpoint 恢复与训练监控三件事。
- SFT 数据处理的核心是 Chat Template 与 label 遮蔽（IGNORE_TOKEN_ID = -100）。

## 延伸阅读

- 下一节内容（高效微调 LoRA）见本模块 [LoRA 原理](./04-lora-principles)
- 偏好对齐概览见本模块 [DPO 与偏好优化](./11-dpo-preference-optimization)

---

> **来源**：本文转载自 [第六章 大模型训练流程实践（happy-llm）](https://github.com/datawhalechina/happy-llm/blob/main/docs/chapter6/%E7%AC%AC%E5%85%AD%E7%AB%A0%20%E5%A4%A7%E6%A8%A1%E5%9E%8B%E8%AE%AD%E7%BB%83%E6%B5%81%E7%A8%8B%E5%AE%9E%E8%B7%B5.md)，作者 DataWhale happy-llm 项目组，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13，2026-09-19 对照现行 transformers / huggingface_hub API 复核并修正示例：① 原书 `AutoConfig.from_pretrained(model_name_or_path)` 用了未定义的变量名（前文定义的是 `model_path`），已统一为 `model_path`；② `Trainer(tokenizer=...)` 改为 `processing_class=...`；③ `--evaluation_strategy` 改为 `--eval_strategy`；④ `huggingface-cli download --resume-download` 改为 `hf download`；⑤ 去掉 `torchdata` 的 `IterableWrapper` 包装；⑥ `# columnes_name` 拼写更正。各处以"编者注/warning"标明，不属原文。

---

> **编者按**：「LLM 基础」的《训练范式总览》从概念上介绍了预训练（Pre-training）→ 有监督微调（SFT）→ 偏好对齐（RLHF/DPO）三个阶段。本文承接该篇，以 Hugging Face Transformers 为主框架，完整走一遍"从初始化模型 → 预训练数据处理 → Trainer 训练 → DeepSpeed 分布式 → SFT 全参微调"的工程流程。原文以 Qwen-2.5-1.5B 为例；文中对过长的分布式脚本细节做了节选，均以"编者注"标明。
