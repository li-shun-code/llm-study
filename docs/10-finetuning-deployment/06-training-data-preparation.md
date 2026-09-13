---
title: 训练数据准备与清洗：TRL 数据集格式全解
source_url: https://huggingface.co/docs/trl/dataset_formats
author: Hugging Face（TRL 文档）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 6
versions: TRL（2026-09 主分支文档，含 Tool Calling / Harmony 格式）
---

微调效果的上限由数据决定。这份 TRL 官方指南是训练数据准备的"标准答案"：无论用哪个 Trainer，先把数据整理成它期望的**格式（format）**与**类型（type）**，再谈超参数。

## 格式与类型：两个正交的维度

- **格式（Format）** 指数据的结构，通常分为**标准（Standard）**与**对话（Conversational）**两类。
- **类型（Type）** 与数据集面向的任务相关，如**仅提示（prompt-only）**或**偏好（preference）**。每个类型由其包含的列定义。

**表：TRL 数据集"格式 × 类型"总览**

| 类型 \ 格式 | Standard（标准） | Conversational（对话） |
| --- | --- | --- |
| 语言建模（Language modeling） | `{"text": "The sky is blue."}` | `{"messages": [{"role": "user", "content": "What color is the sky?"}, {"role": "assistant", "content": "It is blue."}]}` |
| 仅提示（Prompt-only） | `{"prompt": "The sky is"}` | `{"prompt": [{"role": "user", "content": "What color is the sky?"}]}` |
| 提示-补全（Prompt-completion） | `{"prompt": "The sky is", "completion": " blue."}` | `{"prompt": [...], "completion": [...]}` |
| 偏好（Preference） | `{"prompt": ..., "chosen": ..., "rejected": ...}` | 同左，消息列表形式 |
| 非配对偏好（Unpaired preference） | `{"prompt": ..., "completion": ..., "label": true}` | 同左，消息列表形式 |

## 两种格式

### 标准格式

标准格式的数据集通常由纯文本字符串组成，列随任务变化。各任务示例：

```python
# 语言建模
language_modeling_example = {"text": "The sky is blue."}
# 偏好
preference_example = {"prompt": "The sky is", "chosen": " blue.", "rejected": " green."}
# 非配对偏好
unpaired_preference_example = {"prompt": "The sky is", "completion": " blue.", "label": True}
```

### 对话格式

对话数据集用于用户与助手之间的对话任务。与标准格式不同，它们包含消息序列，每条消息有 `role`（如 `"user"` 或 `"assistant"`）和 `content`（消息文本）：

```python
messages = [
    {"role": "user", "content": "Hello, how are you?"},
    {"role": "assistant", "content": "I'm doing great. How can I help you today?"},
    {"role": "user", "content": "I'd like to show off how chat templating works!"},
]
```

对话格式下各任务示例：

```python
# 提示-补全
prompt_completion_example = {"prompt": [{"role": "user", "content": "What color is the sky?"}],
                             "completion": [{"role": "assistant", "content": "It is blue."}]}
# 偏好
preference_example = {
    "prompt": [{"role": "user", "content": "What color is the sky?"}],
    "chosen": [{"role": "assistant", "content": "It is blue."}],
    "rejected": [{"role": "assistant", "content": "It is green."}],
}
```

### 工具调用（Tool Calling）格式

部分对话模板支持工具调用，允许模型在生成过程中与外部函数（**tools**）交互：模型可以输出 `"tool_calls"` 字段而不是标准的 `"content"` 消息。助手发起工具调用后，工具执行并返回输出，助手再处理输出并继续对话：

```python
messages = [
    {"role": "user", "content": "Turn on the living room lights."},
    {"role": "assistant", "tool_calls": [
        {"type": "function", "function": {
            "name": "control_light",
            "arguments": {"room": "living room", "state": "on"}
        }}]
    },
    {"role": "tool", "name": "control_light", "content": "The lights in the living room are now on."},
    {"role": "assistant", "content": "Done!"}
]
```

为 SFT 准备工具调用数据集时，必须额外提供一列 `tools`，包含可用工具列表（通常由 chat template 用于构造系统提示词）。工具必须以规范化的 JSON Schema 表示，可以用 `get_json_schema` 工具从 Python 函数签名自动生成：

```python
from transformers.utils import get_json_schema

def control_light(room: str, state: str) -> str:
    """
    Controls the lights in a room.

    Args:
        room: The name of the room.
        state: The desired state of the light ("on" or "off").

    Returns:
        str: A message indicating the new state of the lights.
    """
    return f"The lights in {room} are now {state}."

# 生成 JSON schema
json_schema = get_json_schema(control_light)
```

一条完整的 SFT 数据形如：

```python
{"messages": messages, "tools": [json_schema]}
```

由于工具参数是任意 JSON 对象，构造 `Dataset` 时需要使用 `Json()` 类型：

```python
from datasets import Dataset

data = [
    {"messages": messages1, "tools": [json_schema1]},
    {"messages": messages2, "tools": [json_schema2]},
]
# 自动应用 Json() 类型
dataset = Dataset.from_list(data, on_mixed_types="use_json")
```

### Harmony 格式

[Harmony 响应格式](https://cookbook.openai.com/articles/openai-harmony)随 OpenAI GPT OSS 开源模型引入，是对话格式的扩展，为推理、函数调用和模型行为元数据增加了更丰富的结构：`developer` 角色（类似系统提示词）、`analysis`/`final`/`commentary` 三类输出通道、可调的推理深度（`reasoning_effort`）等。使用支持 Harmony 的模型（如 `openai/gpt-oss-20b`）时，`apply_chat_template` 会自动渲染这一结构。

## 五种数据类型

### 语言建模（Language modeling）

包含一个 `"text"` 列（对话格式下为 `"messages"`），存放完整文本序列：

```python
# 标准格式
language_modeling_example = {"text": "The sky is blue."}
```

### 仅提示（Prompt-only）

只提供初始提示（问题或半句话），训练时通常由模型生成补全，学习如何继续输入：

```python
prompt_only_example = {"prompt": "The sky is"}
```

::: tip 语言建模 vs 仅提示
两者相似但处理方式不同：prompt-only 的输入被视为"待续写的半句话"，模板渲染后以 `<|assistant|>` 结尾、期待模型补全；language modeling 的输入被视为完整序列，渲染后直接以 `<|endoftext|>` 终止。
:::

### 提示-补全（Prompt-completion）

包含 `"prompt"` 与 `"completion"` 两列。SFT 时默认只对 completion 部分计算 loss：

```python
prompt_completion_example = {"prompt": "The sky is", "completion": " blue."}
```

### 偏好（Preference）

用于训练模型在同一个提示的多个候选补全之间做选择：包含 `"prompt"`、`"chosen"`（偏好）与 `"rejected"`（被拒）三个补全。部分数据集不带 `"prompt"` 列（提示隐含在 chosen/rejected 中），推荐尽可能使用显式提示：

```python
## 显式提示（推荐）
preference_example = {"prompt": "The sky is", "chosen": " blue.", "rejected": " green."}
## 隐式提示
preference_example = {"chosen": "The sky is blue.", "rejected": "The sky is green."}
```

### 非配对偏好与逐步监督

非配对偏好（Unpaired preference）把 chosen/rejected 换成单条 `"completion"` 加一个表示是否偏好的 `"label"`；逐步监督（Stepwise supervision）则为多步补全各配一个标签，适合推理类任务的细粒度反馈：

```python
stepwise_example = {
    "prompt": "Which number is larger, 9.8 or 9.11?",
    "completions": ["The fractional part of 9.8 is 0.8, ...", "Since 0.11 is greater than 0.8, ..."],
    "labels": [True, False]
}
```

## 该用哪种类型？Trainer 对照表

**表：TRL 各 Trainer 期望的数据类型**

| Trainer | 期望数据类型 |
| --- | --- |
| `SFTTrainer` | 语言建模 或 提示-补全 |
| `DPOTrainer` | 偏好（推荐显式提示） |
| `GRPOTrainer` / `RLOOTrainer` | 仅提示 |
| `KTOTrainer` | 非配对偏好 或 偏好 |
| `RewardTrainer` | 偏好（推荐隐式提示） |
| `PRMTrainer` | 逐步监督 |

## 数据转换：任何数据集都能"洗"成 TRL 格式

很多数据集的原始格式与目标格式不一致，需要预处理与转换。TRL 提供了一批[转换示例脚本](https://github.com/huggingface/trl/tree/main/examples/datasets)。基本手法举例——把提示-补全转成语言建模（拼接两列）：

```python
from datasets import Dataset

dataset = Dataset.from_dict({
    "prompt": ["The sky is", "The sun is"],
    "completion": [" blue.", " in the sky."],
})

def concat_prompt_completion(example):
    return {"text": example["prompt"] + example["completion"]}

dataset = dataset.map(concat_prompt_completion, remove_columns=["prompt", "completion"])
# dataset[0] -> {'text': 'The sky is blue.'}
```

把偏好数据集转成提示-补全（用 `extract_prompt` 抽出提示、丢弃 rejected）：

```python
from trl import extract_prompt

dataset = dataset.map(extract_prompt).remove_columns("rejected").rename_column("chosen", "completion")
```

::: tip 建议在应用 chat template 之前完成转换
标准格式与对话格式的转换都可以做，但官方建议在套模板之前先转好类型，保证行为一致。
:::

## 数据清洗最佳实践（编者补充）

格式之外，**质量决定上限**。以下清单综合自 smol-course 与 generative-ai-for-beginners：

- **质量胜过数量**：先以 50–100 条高质量样本验证任务方向，再扩到 500+ 条；果断删除低质量、重复、自相矛盾的样本。
- **切分验证集**：始终保留一个 held-out 验证集，训练时观察验证 loss——这是判断过拟合的第一工具（见 [训练超参与过拟合诊断](./09-hyperparams-overfitting)）。
- **去重与去污染**：训练集与评测集重叠会让评测虚高；多轮对话类数据注意同一会话被同时切进训练/验证的问题。
- **对齐 Chat Template**：沿用与目标基座模型一致的对话模板；换模板等于换"输入分布"，可能损伤已学的指令遵循能力。
- **检查长度分布**：统计 token 长度、剔除超长异常样本；截断可能把答案截掉，让模型学到"说半截话"。
- **工具调用数据成对校验**：`tools` schema、`tool_calls` 参数与 `tool` 角色返回值必须能对上，schema 非法会直接报错。
- **合成数据需过滤**（详见 [数据蒸馏与合成](./07-synthetic-data-distillation)）：大模型生成后仍要过一遍质量与多样性过滤，再进训练集。

## 小结

- 记住两个正交维度：**格式**（标准/对话）× **类型**（语言建模/仅提示/提示-补全/偏好/非配对偏好）。
- SFT 用语言建模或提示-补全；DPO 用偏好；RL 类（GRPO）用仅提示。
- 数据准备的标准动作：统一格式 → 清洗去重 → 切分验证集 → 校验模板与长度分布。

---

> **来源**：本文翻译自 [Dataset formats and types（TRL 官方文档）](https://huggingface.co/docs/trl/dataset_formats)，作者 Hugging Face（TRL 文档），许可 Apache 2.0。抓取于 2026-09-13。"数据清洗最佳实践"一节编译自 [smol-course](https://github.com/huggingface/smol-course)（Apache 2.0）与 generative-ai-for-beginners 课程（MIT），已标注。
