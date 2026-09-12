---
title: Token 与上下文窗口
source_url: https://huggingface.co/learn/llm-course/chapter6/5
author: Hugging Face / DataWhale happy-llm / OpenAI
license: Apache 2.0（HF 课程）· CC BY-NC-SA 4.0（happy-llm）· MIT（OpenAI Cookbook）
fetched_at: 2026-09-13
translated: true
order: 4
---

> **来源**：本文翻译自 [Hugging Face LLM Course · Chapter 6: Byte-Pair Encoding tokenization](https://huggingface.co/learn/llm-course/chapter6/5) 与 [Chapter 2: Tokenizers](https://huggingface.co/learn/llm-course/chapter2/2)（Hugging Face，Apache 2.0），并转载 [happy-llm 第一章 1.3.2 子词切分](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter1/%E7%AC%AC%E4%B8%80%E7%AB%A0%20NLP%E5%9F%BA%E7%A1%80%E6%A6%82%E5%BF%B5.md)（DataWhale，CC BY-NC-SA 4.0）、改编 [OpenAI Cookbook: How to count tokens with tiktoken](https://github.com/openai/openai-cookbook/blob/main/examples/How_to_count_tokens_with_tiktoken.ipynb)（OpenAI，MIT）。抓取/翻译于 2026-09-13。
> 文中"中文 token 成本"一节为本站用 tiktoken 实测补充；"上下文窗口"一节的模型窗口数据核实自各官方文档（2026-09-13），引用链接见文内。

## 一、为什么需要"子词"：从词到字符到子词

在 NLP 任务中，我们往往需要将自然语言的输入转化为机器可以处理的向量。在输入神经网络之前，我们往往会先让自然语言输入通过分词器（tokenizer），分词器的作用是把自然语言输入切分成 token 并转化为一个固定的 index。例如，如果我们将词表大小设为 4，输入"我喜欢你"，分词器可以将输入转化成：

```
input: 我   → output: 0
input: 喜欢 → output: 1
input: 你   → output: 2
```

分词有多种不同的方式：可以切分成词、切分成子词、切分成字符等，而词表大小往往高达数万至数十万。下面比较三种粒度（译自 HF 课程）：

**按词切分（Word-based）**。最直观的方案是按空格分词：

```python
tokenized_text = "Jim Henson was a puppeteer".split()
print(tokenized_text)
# ['Jim', 'Henson', 'was', 'a', 'puppeteer']
```

问题在于：要完整覆盖一种语言，需要为每种词形都准备一个 ID——英语有超过 50 万个词；"dog" 和 "dogs" 会被表示成两个毫不相干的 token；词表外的词只能归入未知 token `[UNK]`——如果分词器产出大量 `[UNK]`，就意味着信息在输入端就丢失了。

**按字符切分（Character-based）**。词表很小、几乎没有 `[UNK]`（任何词都能由字符拼出），但单个字符承载的语义很少，且同样一句话会变成大量 token（一个英文单词可能变成 10 个以上 token）。对中文而言，每个字符（汉字）的信息量比拉丁字母高得多，所以字符级方案在中文场景没有英文那么差——但序列过长的问题依然存在。

**子词切分（Subword）**。这是两者之间的折中，也是现代大模型的标准做法。happy-llm 原文写道：

> 子词切分（Subword Segmentation）是 NLP 领域中的一种常见的文本预处理技术，旨在将词汇进一步分解为更小的单位，即子词。子词切分特别适用于处理词汇稀疏问题，即当遇到罕见词或未见过的新词时，能够通过已知的子词单位来理解或生成这些词汇。

```
输入：unhappiness

不使用子词切分：整个单词作为一个单位，输出："unhappiness"
使用子词切分（假设BPE算法）：单词被分割为："un"、"happi"、"ness"
```

"un" 表示否定、"ness" 是名词后缀——即使模型从未见过 "unhappiness" 这个完整单词，也可以通过已知子词理解其大致意思。常见算法有 Byte Pair Encoding（BPE）、WordPiece、Unigram、SentencePiece 等，基本思想都是**将高频片段合并为子词单元，低频词再进一步拆分**。高频词（如 "the"）保持完整，罕见词被拆成有意义的片段——词表规模可控，又几乎不产生 `[UNK]`。

## 二、BPE 算法原理（译自 HF 课程）

Byte-Pair Encoding（BPE，字节对编码）最初是一种文本压缩算法，后被 OpenAI 用于 GPT 的预训练分词，被 GPT、GPT-2、RoBERTa、BART、DeBERTa 等大量模型采用。

### 2.1 训练算法

BPE 训练首先统计语料中出现过的词（在归一化与预切分之后），用书写这些词的全部符号构建**初始词表**。假设语料中有 5 个词：

```
"hug", "pug", "pun", "bun", "hugs"
```

初始词表就是 `["b", "g", "h", "n", "p", "s", "u"]`。真实场景中初始词表至少包含全部 ASCII 字符。然后通过学习**合并规则（merge）**不断扩充词表：每一步找出语料中出现频率最高的相邻 token 对，将其合并为新 token，直到达到目标词表大小。

假设各词频率如下：

```
("hug", 10), ("pug", 5), ("pun", 12), ("bun", 4), ("hugs", 5)
```

先把每个词拆成字符：

```
("h" "u" "g", 10), ("p" "u" "g", 5), ("p" "u" "n", 12), ("b" "u" "n", 4), ("h" "u" "g" "s", 5)
```

统计各相邻对频率：`("u", "g")` 出现在 "hug"、"pug"、"hugs" 中，共 20 次，是最高频对。于是学到第一条合并规则 `("u", "g") -> "ug"`：

```
词表:   ["b", "g", "h", "n", "p", "s", "u", "ug"]
语料:   ("h" "ug", 10), ("p" "ug", 5), ("p" "u" "n", 12), ("b" "u" "n", 4), ("h" "ug" "s", 5)
```

接着最高频对是 `("u", "n")`（16 次）→ 学到 `("u", "n") -> "un"`；再接着是 `("h", "ug")`（15 次）→ 学到 `("h", "ug") -> "hug"`，得到第一个三字符 token：

```
词表:   ["b", "g", "h", "n", "p", "s", "u", "ug", "un", "hug"]
语料:   ("hug", 10), ("p" "ug", 5), ("p" "un", 12), ("b" "un", 4), ("hug" "s", 5)
```

如此往复，直到达到目标词表大小。

### 2.2 分词算法

对新输入文本分词时，按顺序执行：

1. 归一化（Normalization）
2. 预切分（Pre-tokenization）
3. 把词拆成单个字符
4. **按学习顺序**依次应用所有合并规则

沿用上面的三条合并规则：`"bug"` → `["b", "ug"]`；`"mug"` → `["[UNK]", "ug"]`（"m" 不在初始词表）；`"thug"` → `["[UNK]", "hug"]`。

> **字节级 BPE（byte-level BPE）**：GPT-2 和 RoBERTa 的分词器有个聪明的处理——不以 Unicode 字符而以**字节**为单位构建初始词表。初始词表固定为 256 个字节，任何字符（包括 emoji 和汉字）都能表示，永不产生 `[UNK]`。这就是"byte-level BPE"。对中文来说，一个汉字通常占 3 个 UTF-8 字节，因此中文分词质量取决于训练语料中中文合并规则的丰富程度。

## 三、中文 token 成本（本站实测）

中文没有空格分词，BPE 对中文的切分完全取决于训练语料中的中文频率。下面用 OpenAI 的 tiktoken 库实测同一句话（本站实测，2026-09，tiktoken 最新编码表）：

```python
import tiktoken

zh = "大语言模型正在改变软件开发的方式"   # 16 个汉字
en = "Large language models are changing the way we build software"  # 10 个词

for name in ["o200k_base", "cl100k_base"]:
    e = tiktoken.get_encoding(name)
    print(name, "中文:", len(e.encode(zh)), "tokens")
    print(name, "英文:", len(e.encode(en)), "tokens")

# o200k_base 中文: 9 tokens   ['大','语言','模型','正在','改变','软件','开发','的','方式']
# o200k_base 英文: 10 tokens
# cl100k_base 中文: 14 tokens ['大','语','言','模','型','正在','改','变','软','件','开','发','的','方式']
# cl100k_base 英文: 10 tokens
```

几点结论：

- **编码表越新，中文越省**：`o200k_base`（GPT-4o 起，o 系列与 GPT-5/6 系列沿用）学到了"语言""模型""正在"等多字词合并，16 个汉字只要 9 个 token；旧编码 `cl100k_base`（GPT-3.5/GPT-4 时代）只能逐字切分，需要 14 个 token。
- **同为中文，成本可能差 1.5 倍**：换模型前先用对应编码器估算成本，不要凭旧经验拍脑袋。
- **实践中粗略估算**：对现代编码表，中文约 1 个 token 对应 1~1.5 个汉字；对旧编码表，常见估算是 1 个汉字 ≈ 1.5~2 个 token。精确计数请始终用代码（见下节），不要用字符数乘系数。

## 四、用 tiktoken 精确计数（改编自 OpenAI Cookbook，MIT）

### 4.1 字符串计数

```python
import tiktoken

# 按模型名自动加载对应编码（GPT-4o 之后均使用 o200k_base）
encoding = tiktoken.encoding_for_model("gpt-4o-mini")

def num_tokens_from_string(string: str, encoding_name: str) -> int:
    """返回字符串的 token 数"""
    encoding = tiktoken.get_encoding(encoding_name)
    return len(encoding.encode(string))

num_tokens_from_string("tiktoken is great!", "o200k_base")
```

`encoding.encode()` 把文本变成 token 整数列表；`encoding.decode()` 把 token 列表还原为字符串；`encoding.decode_single_token_bytes()` 可以查看单个 token 对应的原始字节（对中文尤其直观，见上节实测输出）。

### 4.2 消息列表计数（Chat Completions）

计费和上下文限制都是按"整条请求"计算的，消息本身有额外开销（每条消息固定 +3 token，回复开头固定 +3 token）：

```python
def num_tokens_from_messages(messages, model="gpt-4o-mini-2024-07-18"):
    """返回一列消息消耗的 token 数。"""
    try:
        encoding = tiktoken.encoding_for_model(model)
    except KeyError:
        print("Warning: model not found. Using o200k_base encoding.")
        encoding = tiktoken.get_encoding("o200k_base")
    # 不同模型的每条消息固定开销不同，以官方文档为准
    tokens_per_message = 3
    tokens_per_name = 1
    num_tokens = 0
    for message in messages:
        num_tokens += tokens_per_message
        for key, value in message.items():
            num_tokens += len(encoding.encode(value))
            if key == "name":
                num_tokens += tokens_per_name
    num_tokens += 3  # 每条回复都以 <|start|>assistant<|message|> 开头
    return num_tokens
```

> 注：对 GPT-5/6 系列等新模型，官方推荐直接读取 API 响应中的 `usage` 字段获得精确计数（Responses API 返回 `usage.input_tokens` / `usage.output_tokens`），上述估算函数主要用于请求发送前的预算控制。详见模块 6《成本与 Token 优化》。

## 五、上下文窗口（Context Window）

**上下文窗口**是一次推理中模型能"看到"的最大 token 数，包含系统提示、全部历史消息、检索到的资料和模型自己的输出。窗口决定了三类事情：

1. **单次能处理多长的文档**（能否整本塞进去）；
2. **多轮对话能记忆多久**（超出窗口的早期消息必须截断或摘要化）；
3. **RAG/Agent 能携带多少工具结果**（模块 8/9 的关键约束）。

**表：部分当前模型的上下文窗口（2026-09-13 核实）**

| 模型 | 上下文窗口 | 来源 |
| ---- | ---------- | ---- |
| OpenAI GPT-6 Astra（`gpt-6-astra`） | 1,050,000（输入 922K + 输出 128K） | [Microsoft Learn: Azure OpenAI models](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models) |
| 智谱 GLM-5.2 | 1M（"solid 1M-token context"） | [zai-org/GLM-5](https://github.com/zai-org/GLM-5) |
| Qwen3-235B-A22B-Instruct-2507 | 1M（256K 原生，可扩展至 1M） | [QwenLM/Qwen3](https://github.com/QwenLM/Qwen3) |

关于长窗口的三个实用提醒：

- **窗口 ≠ 有效记忆**。长上下文中段的召回精度会下降（"lost in the middle"现象），关键信息尽量放在开头或结尾，或用 RAG 精准投喂而不是无脑塞满；
- **长窗口 = 高成本**。计费按 token 数走，100 万 token 的输入即便按长上下文折扣价也是实打实的费用，且推理时延显著上升；部分厂商（如 OpenAI GPT-6 系列）对"短上下文/长上下文"分档计价；
- **输出也占窗口**。输出上限（如 GPT-6 Astra 的 128K）通常远小于输入上限，规划长文生成任务时要分别核对两个数字。

## 参考文献

1. Hugging Face LLM Course, Chapter 2 "Tokenizers" / Chapter 6 "Byte-Pair Encoding tokenization". Apache 2.0.
2. DataWhale happy-llm, 第一章 1.3.2 子词切分. CC BY-NC-SA 4.0.
3. OpenAI Cookbook, *How to count tokens with tiktoken*. MIT.
4. Microsoft Learn, *Azure OpenAI models*. CC BY 4.0.
