---
title: 幻觉：成因与缓解
source_url: https://github.com/openai/openai-cookbook/blob/main/articles/techniques_to_improve_reliability.md
author: OpenAI（Cookbook）· DataWhale happy-llm 项目
license: MIT（OpenAI Cookbook）· CC BY-NC-SA 4.0（happy-llm）
fetched_at: 2026-09-13
translated: true
order: 7
group: 开发者必知的模型行为
---
## 一、什么是幻觉

先看 happy-llm 的定义：

> 幻觉，是指 LLM 根据 Prompt 杜撰生成虚假、错误信息的表现。例如，当我们要求 LLM 生成一篇学术论文及其参考文献列表时，其往往会捏造众多看似"一本正经"实则完全不存在的论文和研究。幻觉问题是 LLM 的固有缺陷，也是目前 LLM 研究及应用的巨大挑战。尤其是在医学、金融学等非常强调精准、正确的领域，幻觉的存在可能造成非常严重的后果。目前也有很多研究提供了削弱幻觉的一些方法，如 Prompt 里进行限制、通过 RAG（检索增强生成）来指导生成等，但都还只能一定程度减弱幻觉而无法彻底根除。

OpenAI Cookbook 则用"confabulate（虚构）"一词描述同一现象：当任务在"计算下一个 token 的时间"内复杂到无法完成时，模型可能给出一个错误的猜测——**一本正经地编造**。

## 二、成因分析

幻觉不是单一 bug，而是多个机制叠加的产物：

1. **训练目标是"像"而不是"对"**。预训练任务是预测下一个 token（CLM），模型学到的是文本的统计规律。一段流畅、可信、风格正确的错误答案，在训练目标上与正确答案同样"好"。
2. **知识有边界且过时**。模型知识全部来自预训练语料（见《训练范式总览》），语料有截止日期；训练数据里没有的事实（私有数据、新事件），模型没有"我不知道"的可靠开关，倾向于用最像的编造补位。
3. **单步计算预算不足**。Cookbook 的经典类比：让人口算 13 × 17，多数人答不出；给纸笔时间，算出 130 + 70 + 21 = 221 并不难。模型每生成一个 token 的计算量是固定的，复杂推理被压缩进"一步到位"的输出时就会出错。
4. **采样随机性**。高 temperature 采样会放大低概率 token 的机会——幻觉概率随随机性上升。这一项是唯一能靠参数直接压下去的（旋钮的物理含义见《采样参数：temperature 与 top_p》），但也只能压这一项。
5. **指令诱导**。"给我 10 个参考文献"这类要求引用具体实体的提示，会迫使模型填满 10 条——哪怕它只知道 2 条。

## 三、"一步步想"： Cookbook 的经典实验

Cookbook 用一道杂耍球数学题展示了最著名的缓解手段。用旧版 API 提问时，模型直接答错（"有 8 个蓝色高尔夫球"，正确是 4）；而在问题后加上 **`Let's think step by step`**，模型稳定答对：

```
Q: A juggler has 16 balls. Half of the balls are golf balls and half of the
   golf balls are blue. How many blue golf balls are there?
A: Let's think step by step.

There are 16 balls in total.
Half of the balls are golf balls.
That means that there are 8 golf balls.
Half of the golf balls are blue.
That means that there are 4 blue golf balls.
```

Cookbook 强调这不是运气：在数学应用题基准上，这一句提示把 GPT-3 的解题率从毫无用处的 18% 提升到 79%。这就是思维链（Chain of Thought，CoT）提示的起源之一——提示侧与多路采样的完整做法见《思维链与多路采样：CoT、Self-Consistency 与失效边界》。

Cookbook 由此引出一个重要观点——**模型能力不是固定的，它依赖于上下文**："认为模型答错一道简单逻辑题就等于它不会简单逻辑"，是学习使用 LLM 时最常见的概念错误。表面的失败有时可以用更好的提示纠正。

## 四、提升可靠性的通用原则（译自 Cookbook）

Cookbook 给出的可靠性技巧清单（许多专属于特定问题类型，但大部分建立在可广泛应用的通用原则之上）：

- 给出**更清晰的指令**；
- 把复杂任务**拆分**为更简单的子任务；
- 用结构化的指令**让模型不跑题**；
- **先解释再作答**（prompt the model to explain before answering）；
- 对多个可能的答案**要求论证**，再综合；
- **生成多个输出**，再用模型挑出最好的一个；
- 用**微调定制模型**最大化性能。

对应到现代 API，"先解释再作答"可以直接交给推理模型——`reasoning_effort` 本质上就是官方替你内置的 CoT（调用契约见《推理模型（o1/R1 类）》）：

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5.4-mini",
    reasoning={"effort": "medium"},   # 让模型先思考再回答
    input=[
        {"role": "user",
         "content": "一个杂耍演员有16个球。一半是高尔夫球，高尔夫球一半是蓝色的。蓝色高尔夫球有几个？"}
    ],
)
print(response.output_text)
```

## 五、工程缓解清单（编者注）

把研究和工程实践汇总成一张可执行清单，按"成本从低到高"排列：

**提示层**（成本最低，见效快）

1. 明确允许"我不知道 / 根据资料无法确定"，并给拒答示例；
2. 要求输出**逐句标注依据**，或先列引用再作答；
3. 降低 temperature（事实型任务 0–0.3，见《采样参数：temperature 与 top_p》）；
4. 不诱导编造：把"列出 10 篇文献"改成"列出你确信存在的文献，最多 10 篇"。

**知识层**（针对"知识边界"成因）

5. **RAG（检索增强生成）**：先检索再生成，把"凭记忆作答"改成"根据给定资料作答"——目前工业界最主流的缓解手段，完整方案见《什么是 RAG：检索增强生成入门》。注意"喂进去"不等于"用得上"：塞太多资料时中段内容很容易被忽略，投喂条数与摆放位置见《长上下文的有效利用：Lost in the Middle 与位置偏置》；
6. 对时效敏感问题接入搜索/工具，让模型查询而不是回忆；
7. 用**引用可验证性检查**：答案中的每个 URL/文献名做存在性校验。

**流程层**（对抗随机性与单点错误）

8. **自洽性（self-consistency）**：同一问题采样多次投票，多数答案更可靠（可跑的投票实现、成本账与失效边界见《思维链与多路采样：CoT、Self-Consistency 与失效边界》，采样旋钮本身见《采样参数：temperature 与 top_p》）；
9. **双模型互查**：用另一个模型（或更高 reasoning_effort 的同款）审查答案与依据是否匹配；
10. 结构化输出 + Schema 校验（《JSON Mode 与结构化输出（Structured Outputs）》），让"格式幻觉"在入口处失败。

**认知层**

11. 接受"无法根除"这一前提（happy-llm 原话："都还只能一定程度减弱幻觉而无法彻底根除"），在产品层做兜底——高风险领域（医疗/金融/法律）必须有人工复核环节，模型输出永远标注"AI 生成，仅供参考"。

## 六、延伸阅读

本篇处在一条三篇连贯的主线上：《采样参数：temperature 与 top_p》讲**旋钮**（随机性从哪来、能压住哪一类错），本篇讲**成因全景与缓解清单**，《推理模型（o1/R1 类）》讲**把"多想一会儿"变成官方参数之后**该怎么办。按这个顺序读，可以完整回答"输出不对时我有哪些杠杆"。

- 幻觉为什么"治不断"的理论视角：《训练范式总览：预训练 → SFT → RLHF/DPO》（预训练目标的统计本质）
- 检索增强生成的完整方案：《什么是 RAG：检索增强生成入门》
- 思维链与自洽性（含多路采样的可跑实现与失效边界）：《思维链与多路采样：CoT、Self-Consistency 与失效边界》
- 资料给了却没用上的另一种原因（位置偏置）：《长上下文的有效利用：Lost in the Middle 与位置偏置》

## 参考文献

1. OpenAI Cookbook, *Techniques to improve reliability*. MIT.
2. DataWhale happy-llm, 第四章 4.1.3. CC BY-NC-SA 4.0.
3. Wei J., et al. (2022). *Chain-of-Thought Prompting Elicits Reasoning in Large Language Models.* arXiv:2201.11903.
4. Kojima T., et al. (2022). *Large Language Models are Zero-Shot Reasoners.*（"Let's think step by step"）arXiv:2205.11916.

---

> **来源**：本文翻译改编自 [OpenAI Cookbook · Techniques to improve reliability](https://github.com/openai/openai-cookbook/blob/main/articles/techniques_to_improve_reliability.md)（OpenAI，MIT），并转载 [happy-llm 第四章 4.1.3 · 挥之不去的幻觉](https://raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter4/%E7%AC%AC%E5%9B%9B%E7%AB%A0%20%E5%A4%A7%E8%AF%AD%E8%A8%80%E6%A8%A1%E5%9E%8B.md)（DataWhale，CC BY-NC-SA 4.0）对幻觉的定义。抓取/翻译于 2026-09-13。
> 原文写于 GPT-3 时代，其示例使用旧版补全 API；本站已将示例改写为 Responses API 时代写法，并补充"成因分析"与"工程缓解清单"两节，另引入 happy-llm 的幻觉定义作为对照。
