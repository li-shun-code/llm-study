---
title: 采样参数：temperature 与 top_p
source_url: https://huggingface.co/docs/transformers/generation_strategies
author: Hugging Face
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 5
group: 开发者必知的模型行为
---
## 一、解码策略：模型如何选出下一个 token

解码策略（decoding strategy）决定模型如何选择下一个生成的 token。解码策略有很多种，选择合适的策略对生成文本的质量有显著影响。基础解码方法有三种（译自 Transformers 官方文档）：

### 1.1 贪心搜索（Greedy Search）

贪心搜索是**默认**解码策略：每一步都选择概率最高的下一个 token。它适合输出较短、不需要创造性的任务；但生成长序列时会出问题——模型开始不断重复自己：

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-2-7b-hf")
inputs = tokenizer("Hugging Face is an open-source company", return_tensors="pt")
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-2-7b-hf", dtype=torch.float16)

# 显式限制长度（Llama2 最大生成长度为 4096）
outputs = model.generate(**inputs, max_new_tokens=20)
tokenizer.batch_decode(outputs, skip_special_tokens=True)
# 'Hugging Face is an open-source company that provides a suite of tools
#  and services for building, deploying, and maintaining natural language processing'
```

### 1.2 采样（Sampling / 多项式采样）

采样不再选"最高概率"的那个 token，而是**按整个词表上的概率分布随机抽取**——每个概率非零的 token 都有机会被选中。采样能减少重复、生成更有创造性和多样性的输出。在 Transformers 中用 `do_sample=True` 开启：

```python
outputs = model.generate(**inputs, max_new_tokens=50, do_sample=True, num_beams=1)
tokenizer.batch_decode(outputs, skip_special_tokens=True)
# 'Hugging Face is an open-source company 🤗
#  We are open-source and believe that open-source is the best way to build technology...'
```

调用 API 时你设置的 `temperature` 和 `top_p`，本质都是在**改变这个抽签的概率分布**——这正是本文的主角。

### 1.3 束搜索（Beam Search）

束搜索在每一步保留若干条候选序列（束），走完若干步之后选出**整体概率最高**的序列。与贪心搜索不同，它可以"向前看"——即使开头几个 token 概率较低，也可能选中整体概率更高的序列。它最适合"有输入依据"的任务，如图像描述、语音识别。用 `num_beams` 参数开启（须大于 1，否则等价于贪心搜索）：

```python
outputs = model.generate(**inputs, max_new_tokens=50, num_beams=2)
```

> 会话型对话任务几乎不用束搜索——谁也不希望每次聊天都得到一模一样的"最优解"。束搜索多用于机器翻译、评测打分等需要确定性输出的场景。

## 二、temperature：分布的"锐化/钝化"旋钮

语言模型每一步输出的是整个词表上的概率分布（logits 经 softmax 得到）。temperature 在 softmax 之前**缩放 logits**：

```
p_i = exp(z_i / T) / Σ_j exp(z_j / T)
```

- **T → 0**：分布无限"锐化"，几乎总是选最高概率 token——等价于贪心搜索，输出确定、可复现，但容易重复、呆板；
- **T = 1**：原始分布，模型"本色"输出；
- **T > 1**：分布被"钝化"，低概率 token 被更多激活，输出更多样、更有创意，但也更不可控、更容易出错。

OpenAI 对 `temperature` 的官方语义描述（[API 参考](https://platform.openai.com/docs/api-reference/chat/create)）："使用较低的值使输出更集中、更确定；较高的值使输出更随机"，取值范围 0–2。Anthropic 的建议类似（[参数文档](https://docs.claude.com/en/docs/build-with-claude/control-output-variability)）：0 = 确定性，1 = 多样性。

**经验取值**：代码生成/数据抽取/分类 0–0.3；通用问答 0.3–0.7；创意写作 0.7–1.2。

## 三、top_p：只从"概率质量前 p"里抽

top_p（又称核采样，nucleus sampling）不直接改变分布形状，而是**截断**分布：只在累计概率达到 p 的最小 token 集合内重新归一化后采样。例如 p = 0.9 时，若最可能的 3 个 token 已累计 0.9 的概率，则只在这 3 个 token 里抽，其余几千个词表项全部出局。

它与 temperature 的区别：

- top_p 是**动态截断**：分布尖锐时（模型很确定）候选集自动变小；分布平坦时（模型拿不准）候选集自动变大；
- temperature 是**全局缩放**：无论模型确不确认，都按同一温度拉平或锐化。

OpenAI 官方建议**每次只调 temperature 和 top_p 之一，不要同时调**，两者交互的效果难以预测。

（补充一个 top_k：固定"只从概率前 k 个 token 中抽"，是 top_p 的静态版本。HF 本地 `generate()` 与部分 API 支持，但 OpenAI/Anthropic 主流 API 已不再暴露 top_k。）

## 四、API 中的采样参数（Responses API 时代写法）

以 OpenAI Python SDK 为例，`temperature` / `top_p` 在 Responses API 与 Chat Completions 中的语义一致：

```python
from openai import OpenAI

client = OpenAI()  # 从环境变量读取 OPENAI_API_KEY

response = client.responses.create(
    model="gpt-5.4-mini",        # 通用文本模型；推理模型见下方注意点
    input="用一句话向初学者解释什么是词向量。",
    temperature=0.7,             # 0–2，越高越随机
    top_p=1.0,                   # 核采样阈值，1.0 = 不截断
)
print(response.output_text)
```

对应的 Chat Completions 写法（参数名相同）：

```python
response = client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[{"role": "user", "content": "用一句话向初学者解释什么是词向量。"}],
    temperature=0.7,
    top_p=1.0,
)
```

**重要注意点（2026-09 核实）**：**推理模型不支持自定义 `temperature` / `top_p`**。从 o 系列到 GPT-5/5.6/6 Astra，OpenAI 将生成行为交由 `reasoning_effort`（思考深度：`minimal`/`low`/`medium`/`high`）和 `verbosity`（回答详尽度）控制——[Microsoft Learn 的模型文档](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)对 GPT-6 Astra 明确标注 "doesn't support custom temperature or top_p values"。如果你调用推理模型时传了这两个参数，新 SDK 会直接报错。规则很简单：

- **通用模型**（GPT-5.4-mini 等）：`temperature` / `top_p` 可调；
- **推理模型**（GPT-5.6、GPT-6 Astra 等）：用 `reasoning_effort` 控制行为，见本模块《推理模型》。

第三方 OpenAI 兼容端点（DeepSeek、GLM、Qwen 等）同样暴露这两个参数，语义一致。例如 DeepSeek 的 `deepseek-flash`：

```python
response = client.chat.completions.create(
    model="deepseek-flash",
    messages=[{"role": "user", "content": "给这个产品起个名字：一款朗读 PDF 的 App"}],
    temperature=1.3,   # 创意任务拉高
    top_p=0.95,
)
```

## 五、实践建议

**表：任务 → 推荐采样配置**

| 任务特征 | temperature | top_p | 说明 |
| -------- | ----------- | ----- | ---- |
| 结构化抽取 / 分类 / SQL 生成 | 0 – 0.3 | 1.0 | 要确定性，宁可重试 |
| 代码生成 / 改 bug | 0 – 0.3 | 1.0 | 同上 |
| 通用问答、客服话术 | 0.3 – 0.7 | 1.0 | 稳定与自然兼顾 |
| 创意写作、起名、头脑风暴 | 0.8 – 1.3 | 0.95 | 需要多样性 |
| 评测/复现实验 | 0 | 1.0 | 完全确定（注意：T=0 也不能 100% 保证逐位复现） |

最后三个提醒：

1. **采样参数不是"质量旋钮"**——它们控制分布形状，不提升模型能力。答案错误时先改 prompt 和上下文，再考虑参数；
2. **流式 + 高 temperature** 的组合会放大"边想边说"的漂移，长文生成建议中等温度并在 prompt 中锚定结构；
3. 调参时固定其他变量、一次只动一个参数，并保存每组参数的输出样本做对比——这正是《提示迭代评估方法》的前置技能。

## 参考文献

1. Hugging Face Transformers, *Generation strategies*. Apache 2.0.
2. OpenAI API Reference, *Chat Completions / Responses: temperature, top_p*.（概念性引用）
3. Anthropic Docs, *Control output variability*.（概念性引用）
4. Microsoft Learn, *Azure OpenAI models*. CC BY 4.0.

---

> **来源**：本文翻译自 [Hugging Face Transformers 官方文档 · Generation strategies](https://huggingface.co/docs/transformers/generation_strategies)（Hugging Face，Apache 2.0），并参考 OpenAI 与 Anthropic 官方 API 文档对 `temperature` / `top_p` 参数语义的说明（文内已注明链接，仅为概念性引用）。抓取/翻译于 2026-09-13。
> "API 中的采样参数"一节按 Responses API 时代写法改编，为本站补充；示例核实于 2026-09。
