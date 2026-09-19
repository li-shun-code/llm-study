---
title: 模型评测与基准素养：MMLU-Pro、SWE-bench 与 Agent 基准怎么读
source_url: https://github.com/TIGER-AI-Lab/MMLU-Pro
author: TIGER Lab（Yubo Wang、Xueguang Ma、Wenhu Chen 等）· SWE-bench 团队（Carlos E. Jimenez、John Yang 等）· 本站编译
license: Apache 2.0（MMLU-Pro 仓库）· MIT（SWE-bench、τ-bench 仓库）· arXiv 论文节选署名编译
fetched_at: 2026-09-19
translated: true
versions: MMLU-Pro（NeurIPS 2024）· SWE-bench / Verified / Multimodal v2（2026-09）· SWE-bench Pro · τ-bench · GAIA · Terminal-Bench 2.x
order: 13
group: 生态与选型
---
## 一、为什么需要它：同一个"终端基准"，三组数字都不矛盾

发布方给出的 benchmark 表格永远长得像这样："在 X 上取得开源 SOTA"。而你自己抓三份材料，会看到三个互相打架的 X 分数：

- 本站《主流模型生态对比（2026-09）》里：Terminal-Bench 2.1，Claude Opus 4.8 = 85.0，GLM-5.2 = 81.0（并明确标注"自报"）；
- Hugging Face 介绍 DeepSeek-V4 的博客里：Terminal Bench **2.0**，V4-Pro-Max 67.9、GPT-5.4-xHigh 75.1、GLM-5.1 63.5；
- 各家 README 里的 Terminal-Bench 数字，还会随着脚手架和"是否允许长时间重试"继续漂。

这三个都是"真话"。它们同时成立的原因，就是本篇要讲的东西：**一个基准分数不是模型的属性，而是一次实验的结果**。它的完整写法应该是

```
分数 = f(模型, 脚手架/harness, 提示与工具格式, 解码设置与预算, 题目子集, 判分器, 运行日期)
```

只看第一个括号的人，会把营销口径当结论；把后面几项一起看的人，才拿得到能做选型的信号。本篇不重复各家的分数排名（模型分层与版本信息统一在《主流模型生态对比（2026-09）》），只给一套读法。

## 二、解剖一个基准：三类，三种读法

### 2.1 知识/推理类选择题：MMLU-Pro

MMLU-Pro（NeurIPS 2024，[TIGER-AI-Lab/MMLU-Pro](https://github.com/TIGER-AI-Lab/MMLU-Pro)，Apache 2.0）是对 MMLU 的"抗刷分化"改版，官方摘要给出的设计就三条：

| 设计 | MMLU | MMLU-Pro | 读它时意味着什么 |
| ---- | ---- | -------- | ---------------- |
| 覆盖面 | 57 个子任务 | 12,000+ 题、14 个领域 | 分域看才有意义，**总均分会掩盖单域塌陷** |
| 选项数 | 4 | 10 | 随机基线从 25% 掉到 10%，同一个分数量纲不同 |
| 题目性质 | 偏知识记忆 | 剔除"琐碎与含噪"题、偏推理 | 分数差不是难度包装，是真换考卷 |

论文给出两个关键数字：难度上，相对 MMLU 准确率**下降 16%–33%**；稳定性上，24 种提示风格下的分数敏感度从 MMLU 的 4–5% 降到 **2%**——也就是它不再被"你怎么问"轻易左右。另一个信号更有意思：**MMLU-Pro 上用 CoT 明显好于直接作答**，而原 MMLU 上并非如此，说明它考的确实是要想的能力（提示技巧本身的机制见《思维链与多路采样：CoT、Self-Consistency 与失效边界》）。

三条使用注意：

1. **MMLU 的题面本身有错**。重标研究 *Are We Done with MMLU?*（引入 MMLU-Redux）人工重标了 5,700 题，估计 MMLU 有 **6.49%** 的题目答案有误，个别子集更糟（Virology 被分析的题里 **57%** 有问题）。所以"某模型 MMLU 医学子集低 2 分"很可能低在考卷上。
2. **仓库里的 mini-leaderboard 是历史快照**：README 至今挂着 Claude-3.5-Sonnet 76.12、GPT-4o 72.55 这一批 2024 年的数字，它只说明"当年头部水平"，别拿它给今天的模型定位次——榜单在 Hugging Face 上的 Space 里滚动更新，看日期。
3. **配置会改分数**：官方仓库专门提供了多种"答案抽取"实现并注明抽取方式的影响较小（这正是它比 MMLU 稳的原因），但温度、few-shot 数量、CoT 与否仍然会显著改变结果。看到 MMLU-Pro 分数，先找它的提示模板。

### 2.2 真实工程任务：SWE-bench 家族

SWE-bench（ICLR 2024，[SWE-bench/SWE-bench](https://github.com/SWE-bench/SWE-bench)，MIT）：**2,294** 个来自 12 个 Python 仓库的真实 GitHub issue，给定代码库 + issue，让模型产出 patch，判分方式是"跑测试"——让原本失败的测试变通过，且不破坏原本通过的测试。论文时代的最好成绩（Claude 2）只有 **1.96%**，这也是它成为编码 Agent 事实标准的原因：一个从"几乎没人及格"起飞的榜单，区分度耐用。

读 SWE-bench 系数字，第一件事是问**哪一个 split**：

- **Full**（2,294）：原始全集，容器化评测（Docker）从 2024-06 起统一；
- **Lite**：抽出来的更小子集，跑起来更便宜；
- **Verified**：2024-08 与 OpenAI Preparedness 合作，人工确认可解的 **500** 题子集——"真实软件工程师确认这些题可解"；
- **Multilingual / Multimodal**：跨语言与带截图的前端仓库（Multimodal 617 题起步；2026-09 起 v2 有 480 题完全开源可本地评）。

同一模型在这几个 split 上差 10–20 个点是常态，**跨 split 比大小没有意义**。第二件事是问**脚手架**：SWE-bench 的分数是"模型 + 智能体框架"的乘积，官方仓库自己就挂着 SWE-agent 与 Mini-SWE-Agent 两套，换成自研 harness 分数会整体平移（编码工具与这两个基准的完整 README 翻译见《AI 编码工具与模型评测基准：SWE-bench 与 Terminal-Bench》）。

第三件事最反直觉：**考卷质量本身是被审计过的，而且审计结论很难看**。SWE-Bench+（arXiv:2410.06992）人工筛查当期榜首 SWE-Agent + GPT-4 的成功案例，发现 **32.67% 的成功 patch 存在"答案就写在 issue 或评论里"的信息泄漏**，**31.08% 的"通过"只是因为测试太弱**（弱测试没验出错误补丁）；把这些坏题过滤掉后，同一系统的解决率**从 12.47% 掉到 3.97%**。而且 Lite 与 Verified 同样存在这些问题，另有 **超过 94% 的 issue 创建于模型知识截止之前**（污染嫌疑）。

SWE-bench Pro（Scale AI，长时程版，公开榜 + 私有榜双轨）的 README 更新日志则是另一类诚实：**"我们发现 leaderboard 存在问题，正在修"**、"移除了一些过时（例如要求年份为 2025）或本不该纳入的单元测试"、"更新为不设置上限后的结果"。一个活跃的榜单是一个**会变的工程物**，所以任何引用都要带日期。

### 2.3 Agent 类基准：可靠性比能力更先露馅

Agent 基准把"判分"从看答案改成**看世界状态**：τ-bench（论文 arXiv:2406.12045，官方仓库现为 [sierra-research/tau2-bench](https://github.com/sierra-research/tau2-bench)，MIT）用 LLM 模拟用户、给智能体领域 API 与政策规则，**用对话结束时的数据库状态比对标注的目标状态**来判分。它的实验结论直接改变了行业指标：

- 当时最强的函数调用智能体（gpt-4o 一类）**任务成功率不到 50%**；
- 更糟的是**不一致**：零售域 pass^8 < 25%。

pass^k 的定义是"同一题独立跑 k 次、次次都对的概率"，它衡量的是可靠性而不是峰值能力——这条区分在生产里是决定性的：单次成功率 60% 的系统，pass^8 只有 1.7%（第三节脚本会把整张表算给你看）。

GAIA（arXiv:2311.12983）是另一路设计哲学：**只出人类觉得简单的题**。466 道需要推理、多模态、上网与工具使用的真实问题，人类答对 92%，当时配了插件的 GPT-4 只有 15%；作者故意**保留 300 题的答案不发**，用它撑一个防作弊的公开榜单。这个"留一半答案"的做法，是判一份榜单是否用心的最快标志。Terminal-Bench 则把环境换成真实终端容器（其官方仓库现在挂在 harbor-framework 下，Apache-2.0），站内已有完整 README 翻译，本篇不重复。

## 三、可运行：把"这分数能不能信"变成一次计算

```python
#!/usr/bin/env python3
"""榜单数字的三层校验：随机基线、抽样误差、Agent 可靠性（pass^k）。

只依赖标准库：`python3 benchmark_math.py`。把里面的分数换成你自己看到的数字即可。
"""
import math


def chance(options: int) -> float:
    """多选题的随机基线：选项越多，蒙对越难，同分含义完全不同。"""
    return 1 / options


def above_chance(score: float, options: int) -> float:
    """扣掉随机基线后的"有效分数"（归一到 0~1）。"""
    return (score - chance(options)) / (1 - chance(options))


def wilson(correct: int, total: int, z: float = 1.96):
    """Wilson 区间：比"±1.96·sqrt(p(1-p)/n)"在小样本和极端值下更靠谱。"""
    if total == 0:
        return (0.0, 0.0)
    p = correct / total
    d = 1 + z**2 / total
    c = (p + z**2 / (2 * total)) / d
    h = z * math.sqrt(p * (1 - p) / total + z**2 / (4 * total**2)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def two_prop_z(c1, n1, c2, n2):
    """两个准确率是否显著不同（合并方差的两比例 z 检验，双侧 p 值）。"""
    p1, p2 = c1 / n1, c2 / n2
    pool = (c1 + c2) / (n1 + n2)
    se = math.sqrt(pool * (1 - pool) * (1 / n1 + 1 / n2))
    if se == 0:
        return 0.0, 1.0
    z = (p1 - p2) / se
    return z, 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))


def pass_hat_k(p: float, k: int) -> float:
    """τ-bench 的 pass^k：同一条题独立跑 k 次次次都对的概率 = p^k。"""
    return p ** k


def n_for_margin(target_margin: float, p: float = 0.5):
    """要让 95% 置信区间的半宽小于 target_margin，需要多少道题。"""
    return math.ceil((1.96 ** 2) * p * (1 - p) / target_margin ** 2)


if __name__ == "__main__":
    print("① 随机基线：同样一个 0.60")
    for opts in (4, 10):
        print(f"  {opts} 选 1，蒙对率 {chance(opts):.0%} → 0.60 的有效分数 "
              f"{above_chance(0.60, opts):.1%}（MMLU 是 4 选 1，MMLU-Pro 是 10 选 1）")

    print("\n② 抽样误差：题量决定你能分辨多小的差距")
    for n in (100, 500, 1400, 12000):
        lo, hi = wilson(int(0.80 * n), n)
        print(f"  {n:>6} 道题、得分 80.0% → 95% 置信区间 [{lo:.1%}, {hi:.1%}]"
              f"（半宽 ±{(hi - lo) / 2:.1%}）")
    print(f"  要把半宽压到 ±1 个百分点，需要约 {n_for_margin(0.01):,} 道题")

    print("\n③ 差距是否显著：A 榜 82.0%(500 题) vs B 榜 80.6%(500 题)")
    z, pv = two_prop_z(410, 500, 403, 500)
    print(f"  z={z:.2f}，双侧 p={pv:.3f} → "
          f"{'可以认为有差距' if pv < 0.05 else '差距在噪声内，别写进结论'}")

    print("\n④ Agent 可靠性：单次成功率 p 与 pass^k（k 次全对才算过）")
    print("  p      pass^1  pass^4  pass^8")
    for p in (0.95, 0.9, 0.8, 0.6, 0.5):
        print(f"  {p:<6.2f}{pass_hat_k(p, 1):>7.1%}{pass_hat_k(p, 4):>8.1%}{pass_hat_k(p, 8):>8.1%}")
    print("  → 单次 50% 的 Agent，8 次连续跑对的概率只有 0.4%；这就是 pass^k 指标存在的理由。")
```

实测输出：

```
① 随机基线：同样一个 0.60
  4 选 1，蒙对率 25% → 0.60 的有效分数 46.7%（MMLU 是 4 选 1，MMLU-Pro 是 10 选 1）
  10 选 1，蒙对率 10% → 0.60 的有效分数 55.6%（MMLU 是 4 选 1，MMLU-Pro 是 10 选 1）

② 抽样误差：题量决定你能分辨多小的差距
     100 道题、得分 80.0% → 95% 置信区间 [71.1%, 86.7%]（半宽 ±7.8%）
     500 道题、得分 80.0% → 95% 置信区间 [76.3%, 83.3%]（半宽 ±3.5%）
    1400 道题、得分 80.0% → 95% 置信区间 [77.8%, 82.0%]（半宽 ±2.1%）
   12000 道题、得分 80.0% → 95% 置信区间 [79.3%, 80.7%]（半宽 ±0.7%）
  要把半宽压到 ±1 个百分点，需要约 9,604 道题

③ 差距是否显著：A 榜 82.0%(500 题) vs B 榜 80.6%(500 题)
  z=0.57，双侧 p=0.570 → 差距在噪声内，别写进结论

④ Agent 可靠性：单次成功率 p 与 pass^k（k 次全对才算过）
  p      pass^1  pass^4  pass^8
  0.95    95.0%   81.5%   66.3%
  0.90    90.0%   65.6%   43.0%
  0.80    80.0%   41.0%   16.8%
  0.60    60.0%   13.0%    1.7%
  0.50    50.0%    6.2%    0.4%
```

三点用途：**500 题的 Verified 榜，±3.5% 是它的天然噪声**，据此可以立刻过滤掉大量"领先 0.6 分"的新闻；pass^k 那张表可以直接拿去回答"这个 Agent 能不能上线"；第三段则在提醒一件事——你手里那份 12,000 题的 MMLU-Pro 与那份 500 题的编码榜，可信精度根本不在一个量级。

## 四、分数会失真的六种机制

1. **污染**：题目进了训练语料。SWE-Bench+ 统计的"94% 的 issue 早于知识截止"就是嫌疑清单；GAIA 用"藏 300 题答案"对抗它。判据：题目创建日期 vs 模型知识截止、是否公开解法。
2. **换考卷**：split 更新（Full→Lite→Verified→Multimodal v2）、基准版本更新（Terminal-Bench 1.x→2.x→3.0）会让同名分数完全不可比。判据：报告里的 split/版本号 + 日期。
3. **脚手架与工具格式**：同一模型换 harness 能差出十几个点；工具调用格式变更（例如新模型引入专用 XML 式工具 schema）会让沿用旧脚手架的分数**先降后升**，看起来像"模型退步"。判据：官方是否给出适配后的新脚手架与复现步骤。
4. **解码设置与预算**：`max_tokens` 截断、是否允许重试、思考预算开到哪一档，都在改分数。DeepSeek-V4 的模型卡式建议很典型——推荐 `temperature=1.0, top_p=1.0`，且"最高思考档需要至少 384K 的窗口"；而 SWE-bench Pro 明确列出"去掉上限后重跑"的结果。判据：温度/预算/是否允许重跑，三项齐全才叫可复现（旋钮本身见《采样参数：temperature 与 top_p》）。
5. **判分器与格式解析**：选择题的答案抽取用正则还是模型、抽取失败记 0 分还是重跑，都会改分。推理模型还会因触顶返回 `incomplete`，若按 0 分统计就会把"预算不够"记成"能力不行"（见《推理模型（o1/R1 类）》第四节）。
6. **饱和与均值掩盖**：榜单接近天花板后区分度消失，于是各家去更新版/去更难的榜；同时总分是各域均值，一个"87 分"可能是 Law/Health 塌方被 Math 拉平——MMLU-Pro 的官方榜单正是按域展开的，别看一眼总分就下结论。

## 五、读到分数时的 10 问核对表

1. 哪个基准的哪个版本、哪个 split？题量多少？
2. 日期：模型知识截止 vs 题目创建时间；榜单更新日期。
3. 自报还是第三方复现？有没有可复现的配置（harness + 提示模板 + commit）？
4. 模型档位与解码：思考/推理档位、温度、`max_tokens`、重试与预算上限。
5. 判分方式：测试通过、字符串匹配、LLM 判分，还是终态比对？抽取失败怎么算？
6. 单次还是多次：报 pass@1 还是 pass^k？k 次之间的方差多大？
7. 成本：这个数字花了多少 token/多少钱/多久？同价对比才公平。
8. 与你的任务同分布吗？（编码榜第一 ≠ 你的私有栈上第一；选型逻辑见《微调、RAG 还是提示工程：如何为你的场景选型》）
9. 噪声多大？用第三节脚本把置信区间算出来再排序。
10. 有没有留出题目的榜单版本（防污染），作者是否公开失败样例？

## 六、常见坑

- **跨 split 比大小**、**跨版本比大小**：最常见，也最难被发现，因为图上只写"Terminal-Bench"；
- **把 pass@1 当可靠性**：Agent 场景一次跑对没意义，看 pass^k；
- **只看总分不看域**：选择题榜的均值最容易藏缺陷；
- **拿仓库里的历史 mini-leaderboard 定位今天**：那是快照，不是榜；
- **忽略"自报"两个字**：本站在《主流模型生态对比（2026-09）》里刻意保留"自报"标注，就是这个原因；
- **用公开题自训练再自评**：过拟合到榜单，尤其是全量公开的题集。

## 七、延伸阅读

- 评测工具本身（怎么跑、任务怎么配、结果怎么存）：《LLM 评测方法与基准：lm-evaluation-harness README 完整指南》
- 编码 Agent 基准原文翻译（SWE-bench / Terminal-Bench）：《AI 编码工具与模型评测基准：SWE-bench 与 Terminal-Bench》
- 当前各家模型与自报分数的权威清单：《主流模型生态对比（2026-09）》《开源模型选型：Qwen、GLM、DeepSeek 官方模型卡对照（2026-09）》
- 长上下文分数的读法（窗口 vs 有效利用）：《长上下文的有效利用：Lost in the Middle 与位置偏置》

## 参考来源

1. Wang, Y., Ma, X., Zhang, G. et al. (2024). *MMLU-Pro: A More Robust and Challenging Multi-Task Language Understanding Benchmark.* NeurIPS 2024 / arXiv:2406.01574；仓库 [TIGER-AI-Lab/MMLU-Pro](https://github.com/TIGER-AI-Lab/MMLU-Pro)（Apache 2.0）。
2. Hendrycks, D. et al. (2021). *Measuring Massive Multitask Language Understanding.* arXiv:2009.03300。
3. Gema, A. P. et al. (2024). *Are We Done with MMLU?*（MMLU-Redux）arXiv:2406.04127。
4. Jimenez, C. E., Yang, J. et al. (2024). *SWE-bench: Can Language Models Resolve Real-World GitHub Issues?* ICLR 2024 / arXiv:2310.06770；仓库 [SWE-bench/SWE-bench](https://github.com/SWE-bench/SWE-bench)（MIT）；SWE-bench Verified 由 OpenAI Preparedness 与 SWE-bench 团队联合发布。
5. Yang, J., Jimenez, C. E. et al. (2024). *SWE-bench Multimodal.* arXiv:2410.03859；*SWE-Bench+: Enhanced Coding Benchmark for LLMs.* arXiv:2410.06992。
6. *SWE-bench Pro: Can AI Agents Solve Long-Horizon Software Engineering Tasks?*（Scale AI）仓库 [scaleapi/SWE-bench_Pro-os](https://github.com/scaleapi/SWE-bench_Pro-os)（MIT）与公开/私有双榜。
7. Yao, S. et al. (2024). *τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains.* arXiv:2406.12045。
8. Mialon, G. et al. (2023). *GAIA: a benchmark for General AI Assistants.* arXiv:2311.12983。
9. Hugging Face Blog, *DeepSeek-V4: a million-token context that agents can actually use*（Agent 基准章节与采样/窗口建议）。

---

> **来源**：本文依据以下一手材料编译与撰写：MMLU-Pro 论文与官方仓库（Apache 2.0）、MMLU 论文（arXiv:2009.03300）、MMLU-Redux（arXiv:2406.04127）、SWE-bench 论文与官方仓库 README（MIT，含 Verified / Multimodal 条目与更新日志）、SWE-Bench+（arXiv:2410.06992）、SWE-bench Pro 官方仓库（MIT）、τ-bench（arXiv:2406.12045）、GAIA（arXiv:2311.12983）以及 Hugging Face 官方博客的 DeepSeek-V4 一文。未使用二手媒体转述。抓取于 2026-09-19。
> 第三节脚本为本站用 Python 标准库编写并实测运行，输出为真实运行结果；第一、二、四节的所有分数均可在上述仓库 README、论文摘要或正文中逐条对号。榜单本身随时间变动，引用时以官方页面当日数据为准。
