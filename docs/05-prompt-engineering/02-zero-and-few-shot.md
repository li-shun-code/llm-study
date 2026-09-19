---
title: 零样本与少样本提示
source_url: https://www.promptingguide.ai/techniques/fewshot
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: 概念通用；示例代码基于 openai Python SDK 2.x，模型名以《主流模型生态对比（2026-09）》为准
order: 2
group: 提示基础
---
要不要在提示词里给例子，是提示工程里第一个真正的成本决策。示例不是"更礼貌的问法"：它会改变模型的判定口径，也会按行数改变你的账单。本文给出零样本与少样本的适用边界、示例真正起作用的位置，以及一个能跑出格式合规率与 token 代价的脚本。

## 零样本提示

经过指令微调（instruction tuning）并在海量数据上训练的大语言模型，已经能以"零样本"方式完成不少任务：**提示词里不含任何示例或演示**，直接叫模型执行任务。前面章节用过这样的分类例子：

```
Classify the text into neutral, negative or positive.

Text: I think the vacation is okay.
Sentiment:
```

模型输出 `Neutral`。没人教过它 "sentiment" 指什么，它也知道这是在问情感极性——这就是零样本能力。Wei et al. (2022) 的分析是：指令微调本身提升了零样本学习效果（本质是"用指令描述的数据集"上做的微调），在此之上叠加人类反馈强化学习（RLHF）对齐人类偏好，才有了 ChatGPT 这一族对话模型。

零样本不够用时，下一步就是把演示放进提示词——少样本提示。

## 少样本提示

少样本提示（few-shot prompting）是启用**上下文学习**（in-context learning）的技术：在提示词里给出输入/输出演示，这些演示充当后续输入的条件，引导模型生成我们想要的回答。按 Brown et al. 2020 与 Kaplan et al. 2020 的观察，这种能力是模型规模扩到足够大之后才出现的。

Brown 等人论文里那个经典例子——用一个新造词造句：

```
A "whatpu" is a small, furry animal native to Tanzania. An example of a sentence that uses the word whatpu is:
We were traveling in Africa and we saw these very cute whatpus.

To do a "farduddle" means to jump up and down really fast. An example of a sentence that uses the word farduddle is:
```

输出：

```
When we won the game, we all started to farduddle in celebration.
```

只给**一条**示例（1-shot）就够模型学会这个任务。更难的任务可以试 3-shot、5-shot、10-shot。

Min et al. (2022) 进一步拆过演示里到底什么在起作用，结论有三条值得记住：

- **标签空间**与输入分布最重要——即使个别示例的标签是错的；
- 你用的**格式**是关键因素之一：只用随机标签，也远好于完全没有标签；
- 相比均匀分布，从**真实标签分布**里抽随机标签更有帮助。

原文据此做了两个实验。第一个把正负标签随机打乱：

```
This is awesome! // Negative
This is bad! // Positive
Wow that movie was rad! // Positive
What a horrible show! //
```

模型仍输出 `Negative`。第二个实验连格式都拆掉：

```
Positive This is awesome!
This is bad! Negative
Wow that movie was rad!
Positive
What a horrible show! --
```

还是输出 `Negative`。原文的提醒不过时：较新的模型对乱格式更鲁棒，但这在不同任务、不同提示变体上是否都成立，需要你自己测。

### 少样本的局限

标准少样本对很多任务有效，但面对需要多步推理的问题会失效。原文用这道题演示：

```
The odd numbers in this group add up to an even number: 15, 32, 5, 13, 82, 7, 1.
A:
```

2022 年的模型会答"Yes, … add up to 107, which is an even number"（错了：奇数 15、5、13、7、1 之和是 41，为奇数）。补上五条带答案的示例仍然不对——因为这类任务要**多步推理**，而示例只演示了"输入→结论"，没演示中间步骤。把中间步骤也演示出来，就是**思维链提示**（CoT），见《思维链与多路采样：CoT、Self-Consistency 与失效边界》。

> **编者实测（2026-09）**：这道题在当前一代推理模型上零样本就能答对——本站实测输出为
> `The odd numbers are: 15, 5, 13, 7, 1. / Sum: 15 + 5 + 13 + 7 + 1 = 41 / 41 is odd, not even. / **False**`
> 也就是说，"多步推理必然要靠示例"这一条已经不再普遍成立。它当年的结论来自小得多的模型；今天判断"要不要给示例"的正确做法是拿自己的任务先跑一轮基线，而不是照抄论文的失败案例。

## 可运行示例：示例到底买到了什么，值多少钱

下面脚本比较同一任务的两种写法：**人造的输出约定**（把中文收货地址解析成 `省|市|区县|详址`，缺失填 `-`，直辖市首段填 `-`）。这种约定模型在预训练里几乎没遇到过，正好用来观察示例的作用；脚本同时把每次调用的 token 记账，便于算成本。

```python
"""零样本 vs 少样本：同一个人造格式任务，比较约定命中率与 token 代价。

运行前置：
    pip install openai python-dotenv
"""
import os

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
client = OpenAI()
MODEL = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")

FORMAT_SPEC = "把下面的中文收货地址解析成一行：省|市|区县|详细地址。任一段缺失就填 -，不要输出多余文字。"

FEW_SHOT = """\
省|市|区县|详细地址 的解析约定如下：
例1 输入：上海市浦东新区世纪大道100号 2001室
输出：-|上海市|浦东新区|世纪大道100号2001室
例2 输入：浙江省杭州市余杭区文一西路969号
输出：浙江省|杭州市|余杭区|文一西路969号
例3 输入：合肥蜀山区望江西路  276号（邮编 230088）
输出：-|合肥市|蜀山区|望江西路276号
"""

CASES = [
    "江苏省南京市鼓楼区中山北路28号 5 号楼 1802",
    "成都市武侯区天府三街69号新南中心1栋1204",
    "北京市朝阳区建国路88号（收件人临时改到国贸三期B座）",
]


def ask(prompt: str):
    """发一次请求，返回（文本, 输入 token, 输出 token）。"""
    resp = client.responses.create(model=MODEL, input=prompt, max_output_tokens=800)
    u = resp.usage
    return resp.output_text.strip(), (u.input_tokens or u.prompt_tokens), (u.output_tokens or u.completion_tokens)


def compliant(line: str) -> bool:
    """下游解析器的判据：恰好 4 段、单行、无空段。"""
    parts = line.split("|")
    return len(parts) == 4 and "\n" not in line and all(p.strip() for p in parts)


if __name__ == "__main__":
    for mode in ("zero", "few"):
        pin_total = pout_total = ok = 0
        print(f"\n===== {mode} =====")
        for case in CASES:
            task = f"{FORMAT_SPEC}\n输入：{case}\n输出："
            prompt = task if mode == "zero" else f"{FORMAT_SPEC}\n{FEW_SHOT}\n输入：{case}\n输出："
            text, pin, pout = ask(prompt)
            ok += compliant(text)
            pin_total += pin
            pout_total += pout
            print(f"[{'合规' if compliant(text) else '不合规'}] {text!r}  in={pin} out={pout}")
        print(f"小计：结构合规 {ok}/{len(CASES)}，输入 token {pin_total}，输出 token {pout_total}")
```

本机实测（三次一组的典型一轮）：

```
===== zero =====
[合规] '江苏省|南京市|鼓楼区|中山北路28号 5 号楼 1802'                 in=96  out=111
[合规] '四川省|成都市|武侯区|天府三街69号新南中心1栋1204'               in=97  out=146
[合规] '北京|北京|朝阳区|建国路88号（收件人临时改到国贸三期B座）'        in=96  out=151
小计：结构合规 3/3，输入 token 合计 289

===== few =====
[合规] '江苏省|南京市|鼓楼区|中山北路28号5号楼1802'                    in=229 out=195
[合规] '四川省|成都市|武侯区|天府三街69号新南中心1栋1204'              in=230 out=369
[合规] '-|北京市|朝阳区|建国路88号（收件人临时改到国贸三期B座）'        in=229 out=188
小计：结构合规 3/3，输入 token 合计 688
```

这组数据比"少样本更好"这个笼统结论有用得多：

1. **结构合规都是 3/3**——四段竖线这种表层格式，零样本就够了，示例是白花钱；
2. **真正差别在隐含约定**：直辖市要不要在"省"这一栏填 `-`、详址里的空格要不要吃掉。零样本版把"北京"重复填进省市两栏、保留了原空格；少样本版从例 1、例 3 学到了这两条口径，输出与下游期望完全一致；
3. **代价是清楚的**：输入 token 从 289 涨到 688（约 2.4 倍），而且示例会连带把输出也变长（reasoning 模型会去"读"你的示例）。批量任务里这条曲线是线性的，一百万条就是实打实的价格差。

所以顺序应该是：**先用指令把格式说清 → 跑一轮基线 → 只对基线里稳定出错的那个约定补最少的示例**。三条示例能解决的问题，不要放十三条；能塞进指令的一句话，不要塞成三条示例。

### 示例从哪来：三条取材规则

1. **从失败样本里挑**。跑一轮零样本基线，把输出错的、格式跑偏的留下，这些就是示例的最佳候选——它们在演示"你真正关心的边界"，而不是随机样例。
2. **覆盖不同形态，而不是同一形态堆量**。Min et al. 的结论（标签空间与格式比标签正确性更重要）在实践里翻译成：三条分别代表"常规/缺失值/多口径冲突"的示例，胜过十条常规示例。
3. **顺序要按常识排**。模型对示例顺序仍有轻微偏好（先看到的会更多地被当作"典型"），把最常见形态放前面，把最棘手的放最后紧邻问题，是低成本的正向调整。

原文最后给出的判断也成立：当零样本与少样本都不奏效时，往往说明模型缺的是**这个领域的知识**而不是提示技巧——此时该考虑把资料检索进来（见《上下文工程：为 AI Agent 管理稀缺的注意力》里的运行时检索一节）或做微调，而不是继续往提示词里堆话。

## 常见坑

- **把示例当"礼貌"**：多给几条相似的例子不会更安全，只会稀释注意力。示例的价值在于承载**说不清的约定**（标签口径、缺失值处理、边界情形），不是填充。
- **示例与指令打架**：指令说"只输出标签"，示例里却带解释——模型倾向跟着示例走。规则与示例必须同口径，这条在《系统提示词设计》里被列为主要失败模式之一。
- **忽略缓存与成本**：示例每次都算输入 token。放得越靠前、越稳定，越容易吃到前缀缓存；把动态内容插在示例中间，等于每月多付一遍示例钱。
- **在推理模型上照搬 2022 年的失败案例**：本文上面那道奇数题就是例子——今天的模型零样本已能做对，示例反而只增加成本。
- **示例数量不做消融**：3-shot 与 8-shot 的差别可能是噪声。要比较就在同一批输入上跑，看逐题差异而不是总分。

## 小结

| 方式 | 提示词构成 | 适用 |
|---|---|---|
| 零样本 | 只有指令/问题 | 格式可用语言说清、任务常见 |
| 少样本 | 指令 + 若干演示 | 约定说不清、需要校准标签空间与边界情形 |

- 演示起作用的三要素：标签空间 > 格式 > 标签正确性（Min et al. 2022）；
- 多步推理的任务，示例要带**中间步骤**才有用——这是 CoT 的入口；
- 示例按条计价：能一句话说清的别写三条，能三条解决的别写十三条。

## 延伸阅读

- 《思维链与多路采样：CoT、Self-Consistency 与失效边界》：把"过程"放进演示。
- 《推理模型时代的提示原则》：什么情况下示例反而有害。
- 《提示词的迭代与评估方法》：如何量化"加了 5 条示例"到底值不值。

---

> **来源**：本文翻译自 [Few-Shot Prompting](https://www.promptingguide.ai/techniques/fewshot) 与 [Zero-Shot Prompting](https://www.promptingguide.ai/techniques/zeroshot)，作者 DAIR.AI（Elvis Saravia），许可 MIT（仓库 dair-ai/Prompt-Engineering-Guide）。抓取于 2026-09-13。
>
> **编者注**："可运行示例"一节、奇数题的实测复核与成本口径均为本站新增内容，脚本与输出在本机跑通（OpenAI 兼容端点，密钥读自 `.env`）；原文未讨论前缀缓存与示例的计价方式，该部分依据模型服务的一般计费口径整理。Brown et al. 2020、Kaplan et al. 2020、Min et al. 2022、Wei et al. 2022 的结论均引自原文所列论文。
