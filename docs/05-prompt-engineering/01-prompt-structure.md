---
title: 提示词的基本要素与格式
source_url: https://www.promptingguide.ai/introduction/elements
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: 概念通用；示例代码基于 openai Python SDK 2.x（Responses API），模型名以《主流模型生态对比（2026-09）》为准
order: 1
group: 提示基础
---
写提示词最常犯的错误，是把它当成"一句问话"。真实工程里它是一段有结构的输入：**要做什么、在什么口径下做、对哪些数据做、以什么形式交回来**。这四项各管一段，缺一项，模型就只能替你猜——而它的猜测在不同次调用里并不一致。

本文给出提示词的四要素模型，以及现代对话 API 组织这些要素的方式（角色与消息列表），最后用一个可直接运行的脚本量一下"少写一项"的代价。

## 四要素：指令、上下文、输入数据、输出指示

随着提示词工程的例子和应用越来越多，你会发现一个提示词（prompt）通常由以下要素组合而成：

- **指令（Instruction）**——你希望模型执行的具体任务；
- **上下文（Context）**——外部信息或额外口径，用来把模型的行为约束到你的场景里；
- **输入数据（Input Data）**——需要处理的那条数据或那个问题；
- **输出指示（Output Indicator）**——输出的类型或格式。

一个经典的文本分类例子（原文照录，便于对照）：

```
Classify the text into neutral, negative, or positive

Text: I think the food was okay.

Sentiment:
```

这里指令是"分类到 neutral/negative/positive"，输入数据是那句 `I think the food was okay.`，输出指示是 `Sentiment:` 这个前缀；这个基础示例没有用到上下文。给同一任务补几条示例（即提供上下文），往往能同时改善判断质量与输出稳定性——这正是少样本提示的入口，见《零样本与少样本提示》。

并非每条提示词都要凑齐四项，取舍取决于任务：开放性问答可以只给指令；批量结构化抽取则四项都得写死，否则下游代码没法解析。

## 与模型交互：角色和消息列表

最简单的提示词也能跑，但结果质量取决于你给了多少信息。先看原文那组对照：

```
The sky is
```

模型只会顺着补一个"合理"的词（`blue.`），输出可能完全不是你要的。加一条指令：

```
Complete the sentence:

The sky is
```

输出变成 `blue during the day and dark at night.`——因为"补全句子"这个动作被明确了指出来。这种"通过设计提示词来指挥模型完成目标任务"的思路，就是提示词工程的核心。

在使用对话模型时，提示词按**角色（role）**组织成消息列表：

- `system`（新一些的接口里叫 `developer`）：不是必需项，用来设定助手整体的行为边界与口径；
- `user`：用户消息，下达本次任务；
- `assistant`：助手消息，即模型此前给出的回复；也可以由你手工填入，用来示范期望行为。

现代 API（OpenAI 的 Responses / Chat Completions、Anthropic 的 Messages）都建立在"消息列表 + 角色"这一结构上。但有一件事要提前记住：**角色是给模型看的约定，不是隔离机制**。到模型内部，这一切会被拼成一条扁平的 token 序列，"系统说的"和"网页内容里夹带的"在同一个通道里。把角色当安全边界的后果，见《分隔符、结构化标签与注入边界》。

## 提示词格式

标准提示词（standard prompt）的写法就一行：

```
<问题>?
```

或

```
<指令>
```

也可以组织成问答（QA）格式——很多问答数据集用的就是这种：

```
Q: <问题>?
A:
```

这种不给任何示例、直接要求作答的方式叫**零样本提示**（zero-shot prompting）。模型的零样本能力取决于任务难度、所需知识，以及训练数据里这类任务出现过多少。对较新的模型，`Q:` 前缀可以省略，它会自己把句子识别成问句。

与之相对的是**少样本提示**（few-shot prompting）：

```
<问题>?
<答案>

<问题>?
<答案>

<问题>?
```

并不强制使用 QA 格式。一个简单的分类任务，用注释风格示范同样有效：

```
This is awesome! // Positive
This is bad! // Negative
Wow that movie was rad! // Positive
What a horrible show! //
```

模型接着输出 `Negative`。少样本之所以管用，是因为它让模型做**上下文学习**（in-context learning）——仅凭少量演示就学会执行任务。

## 可运行示例：少写一项，代价有多大

下面这段脚本可以直接跑。任务是把客服工单归到四个标签里，其中**标签口径与常识不完全一致**（比如"税率能不能改"看起来像咨询，按口径必须判 `billing`）。脚本用两种写法各问三次：一种只给指令，一种四要素齐备。

```python
"""最小演示：同一条提示词的"裸指令版"与"四要素齐备版"差别有多大。

运行前置：
    pip install openai python-dotenv
    # 项目根目录放一个 .env，内容形如：
    #   OPENAI_API_KEY=sk-xxxx
    #   OPENAI_BASE_URL=            # 可选：走兼容端点/代理时填
    #   OPENAI_MODEL=gpt-5.4-mini   # 可选：不填则用代码里的默认值
"""
import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()                 # 读取 .env 并写入 os.environ
client = OpenAI()             # SDK 自动取 OPENAI_API_KEY / OPENAI_BASE_URL
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")

LABELS = ["bug", "billing", "feature_request", "other"]
TICKETS = [
    "导出 CSV 时点了没反应，Chrome 最新版，是不是你们接口挂了？",
    "发票上的税率能不能改成我们公司的结算主体？顺便问下 API 额度怎么算的。",
    "希望支持命令行批量导入，现在只能一条条点。",
]

# 裸指令版：只有指令
BARE = "Categorize this support ticket.\n\nTicket: {t}"

# 四要素齐备版：指令 + 上下文 + 输入数据 + 输出指示
FULL = """\
把每条客服工单归入下方标签体系中的恰好一个类别。（指令）

标签口径如下，按此判定而不是按你的常识：（上下文）
- bug：产品行为异常，包括报错、点了没反应、结果不对；
- billing：涉及发票、税率、主体、合同、计费口径的问题；
- feature_request：用户希望新增或改进某种能力；
- other：以上都不是。
判定规则：一条工单只允许一个标签；若同时命中多个，取用户"实际被卡住"的那一项。

Ticket: {t}

只输出标签本身，从 {labels} 中选一个，不要输出任何解释、标点或代码块。（输出指示）"""


def ask(prompt: str) -> str:
    """发一条提示词，返回模型的纯文本输出。"""
    resp = client.responses.create(model=MODEL, input=prompt, max_output_tokens=512)
    return resp.output_text.strip()


if __name__ == "__main__":
    for name, template in (("裸指令", BARE), ("四要素", FULL)):
        print(f"\n===== {name} =====")
        for t in TICKETS:
            raw = ask(template.format(t=t, labels=LABELS))
            hit = raw in LABELS           # 下游代码能否直接按标签走分支
            print(f"[{'可解析' if hit else '需清洗'}] {raw[:60]!r}   <- {t[:16]}…")
```

本机实测输出（模型输出带随机性，措辞会变，形态不会）：

```
===== 裸指令 =====
[需清洗] '**简要描述：** 用户在 Chrome 最新版浏览器中点击 CSV 导出按钮后无任何反应，'   <- 导出 CSV 时点了没反应…
[需清洗] ''                                                        <- 发票上的税率能不能改成我…
[需清洗] '**Category:** Feature Request / 功能需求\n\n**Subcategory:** CLI'   <- 希望支持命令行批量导入…

===== 四要素 =====
[可解析] 'bug'               <- 导出 CSV 时点了没反应…
[可解析] 'billing'           <- 发票上的税率能不能改成我…
[可解析] 'feature_request'   <- 希望支持命令行批量导入…
```

三行都值得注意：

1. 裸指令版把分类做成了**写报告**——内容没错，但下游要的是标签，得再花一次调用去清洗；
2. 第二行输出是**空字符串**。这不是巧合：推理模型把 token 预算花在内部思考上，`max_output_tokens` 卡得太紧时，思考吃满了额度，正文一个字都没剩下；
3. 四要素版三次都精确命中，包括那条按常识容易判成"咨询"的工单——上下文小节里的口径起了作用。

## 可直接抄的最小骨架

把上面的道理压成一个模板，新任务起手就能用：

```
<任务一句话：动词开头，说明要产出什么>

# 口径
<标签集/字段定义/判定规则；与常识不一致的地方必须写出来>
<边界：信息不足时怎么办，宁缺毋滥还是尽力猜测>

# 输入
<data>
{{待处理数据}}
</data>

# 输出格式
<逐字段列出，或给一个具体样例；写明"只输出该结构，不要解释">
```

四行分别对应指令、上下文、输入数据、输出指示。两条经验：**口径小节是唯一的不可省项**——它承载了模型猜不到的那部分知识；输入数据用标签包起来（`<data></data>`）既便于人读，也为后续的安全边界留出锚点（为什么"包起来"仍不等于"隔离"，见《分隔符、结构化标签与注入边界》）。

## 常见坑

- **把上下文和指令混成一段话**。模型分不出哪句是"要做的动作"、哪句是"判定口径"。分成小节（Markdown 标题或 XML 标签）成本极低，收益很直接。
- **输出指示写成形容词**。"简洁一点""友好一点"没有可判定性；写成"只输出标签本身，不要解释"或给出目标 JSON 结构，才接得住下游解析。
- **拿 `max_output_tokens` 卡推理模型**。思考型模型的推理 token 也算在这个额度里，卡太小会得到空输出或半句话。要么放宽，要么改用该模型提供的推理力度参数（见《推理模型时代的提示原则》）。
- **把角色当隔离边界**。`system` 与 `user` 只是训练出来的行为约定，注入内容照样能改写行为——提示词结构影响的是"默认行为"，不是"能力上限"。
- **一上来就堆长提示**。四要素齐备不等于写得越多越好：先用最强模型试一条最小提示，看清失败模式再补指令，是更省事的路线。

## 延伸阅读

- 《零样本与少样本提示》：示例从哪来、给几条、格式为什么比标签更重要。
- 《系统提示词设计》：把"角色 + 规则 + 步骤 + 输出格式"写成可维护的分层提示词。
- 《分隔符、结构化标签与注入边界》：定界符能解决歧义，但解决不了信任问题。
- 《提示词的迭代与评估方法》：四要素写完后，用批量评测决定改哪一项。

---

> **来源**：本文翻译自 [Elements of a Prompt](https://www.promptingguide.ai/introduction/elements) 与 [Basics of Prompting](https://www.promptingguide.ai/introduction/basics)，作者 DAIR.AI（Elvis Saravia），许可 MIT（仓库 dair-ai/Prompt-Engineering-Guide）。抓取于 2026-09-13。
>
> **编者注**：原文示例里的 `gpt-3.5-turbo`/`gpt-4` 等旧模型名已按当前主流对话模型口径校订；"可运行示例"一节与"常见坑"为本站新增，示例代码与实测输出均在本站本机跑通（走 OpenAI 兼容端点，密钥从 `.env` 读取，代码中不含密钥）。原文未收录"角色即隔离"这一层讨论，相关内容引自《分隔符、结构化标签与注入边界》一节所列来源。
