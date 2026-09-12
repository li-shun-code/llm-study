---
title: 提示词的迭代与评估方法
source_url: https://cookbook.openai.com/examples/gpt-5/prompt-optimization-cookbook
author: OpenAI（OpenAI Cookbook 团队）
license: MIT（OpenAI Cookbook）
fetched_at: 2026-09-13
translated: true
order: 10
versions: OpenAI Responses API；示例基于 GPT-5 系（2026-09 抓取时 Cookbook 现行版本）
---

> **来源**：本文翻译自 [GPT-5 Prompt Migration and Improvement using the new prompt optimizer](https://cookbook.openai.com/examples/gpt-5/prompt-optimization-cookbook)（节选编译），作者 OpenAI（OpenAI Cookbook 团队），许可 MIT（OpenAI Cookbook）。抓取于 2026-09-13。

> **编译说明**：原文是演示官方 Prompt Optimizer 工具的完整 notebook（含两个案例：代码分析类任务与 FailSafeQA 问答基准）。本文节选其方法论主线与代码分析案例，省略中间的过程性输出。文中"提示不是一刀切的体验……"等观点句为原文直译。

写好提示词不是一锤子买卖，而是一个**可测量的迭代循环**：基线提示 → 批量生成 → 定量评估 → 优化提示 → 再评估 → 定性评审 → 汇总对比。这篇来自 OpenAI Cookbook 的指南完整演示了这一循环，并展示了提示优化带来的可量化改进。

## 优化器解决什么问题

有效的提示词是使用 LLM 的关键技能。官方 [Prompt Optimizer](https://platform.openai.com/chat/edit?optimize=true)（Playground 内置）的目标是给提示词套上对目标模型最有效的最佳实践与格式，并清除常见的提示失败模式：

- 指令之间**自相矛盾**（contradictions）；
- **缺失或含糊的格式规范**；
- 提示词与少样本示例之间**不一致**。

除了针对目标模型调优，优化器还会结合你要完成的具体任务，应用对 Agent 工作流、编码、多模态场景至关重要的实践。

> 记住：提示词不是一刀切的体验。我们建议做充分的实验并持续迭代，为你的问题找到最佳解法。

## 案例：一道"对坏提示高度敏感"的编码题

任务是让模型生成一个 Python 脚本：从大文本流中按指定的分词规范，**精确**计算 Top-K 高频词。这类任务对差提示极其敏感——模糊的指令会把模型推向错误的算法路线（近似 sketch vs 多遍/落盘的精确方案），急剧影响准确率与运行时间。

**评估指标**（每组 30 次生成）：

1. 编译/执行成功率；
2. 平均运行时间（成功运行的脚本）；
3. 平均峰值内存（成功运行的脚本）；
4. **精确性**：输出与标准答案的 Top-K 完全一致（平局规则：先按计数降序、再按词升序）。

### 基线提示：一堆"软约束"混合信号

基线提示的典型来源：让 ChatGPT 帮你写个提示词，或问一位懂代码但不关心你具体场景的朋友。它读起来友好，却埋满了混合信号：

```python
baseline_prompt = """
Write Python to solve the task on a MacBook Pro (M4 Max). Keep it fast and lightweight.

- Prefer the standard library; use external packages if they make things simpler.
- Stream input in one pass to keep memory low; reread or cache if that makes the solution clearer.
- Aim for exact results; approximate methods are fine when they don't change the outcome in practice.
- Avoid global state; expose a convenient global like top_k so it's easy to check.
- Keep comments minimal; add brief explanations where helpful.
- Sort results in a natural, human-friendly way; follow strict tie rules when applicable.

Output only a single self-contained Python script inside one Python code block, with all imports, ready to run.
"""
```

逐条拆解它的问题（原文的分析非常值得细读）：

- **"优先标准库" vs "外部包更简单就用"**：这句软许可可能把模型推向不可移植的依赖或更重的导入，跨环境地改变性能甚至能否执行；
- **"单遍流式、省内存" vs "必要时可以重读/缓存"**：为多遍设计或内存缓存开了口子，直接推翻流式约束，改变运行时间与内存特征；
- **"要求精确" vs "近似方法在实践中等价就行"**：这是模型无法可靠自证的判断题——它可能引入 sketch 或启发式，在 Top-K 边界附近悄悄改变计数，结果看起来对、严格评估却不过；
- **"避免全局状态" vs "暴露一个方便的 top_k 全局变量"**：接口契约混乱——函数到底该返回数据，还是让调用方读全局？模型可能两个都做，产生副作用，搞乱评估与复现；
- **"注释最少" vs "加简短说明"**：解释不足的代码，或者散文混进逻辑、甚至泄漏到要求的输出格式之外；
- **"自然、人类友好的排序" vs "严格平局规则"**：两者并不总是一致。模型可能选 `Counter.most_common` 这类便利排序，在平局上偏离评测方规定的 `(-count, token)` 排序——造成隐蔽的正确性失分。

**为什么这很重要**：被软化的约束让提示词"看起来容易满足"，却在每个岔路口埋了分叉。模型在不同次运行中可能选择不同分支——标准库还是三方依赖、单遍还是重读缓存、精确还是近似——正确性、延迟与内存全都随之波动。

而**评估器始终严格**：固定的分词规则（小写化后 `[a-z0-9]+`）与确定性的 `(-count, token)` 排序。任何偏离都会在精确性上受罚，哪怕解法其他部分看起来挺合理。

### 跑基线：30 次生成 + 基准评测

用 Responses API 以基线提示并发生成 30 个脚本，逐一存盘，然后用评测脚本对每个脚本计时、测内存、比对标准答案：

```python
from scripts.gen_baseline import generate_baseline_topk
from scripts.topk_eval import evaluate_folder

MODEL = "gpt-5"
N_RUNS = 30
CONCURRENCY = 10

generate_baseline_topk(
    model=MODEL,
    n_runs=N_RUNS,
    concurrency=CONCURRENCY,
    output_dir="results_topk_baseline",
    dev_prompt=baseline_prompt,
    user_prompt=USER_PROMPT,   # 任务与分词规范说明
)

evaluate_folder(
    folder_path="results_topk_baseline",
    k=500,
    scale_tokens=5_000_000,    # 用 500 万 token 的文本放大压力
    csv_path="run_results_topk_baseline.csv",
)
```

### 优化后的提示：结构化 + 零歧义

在 Playground 里对基线提示执行 Optimize，并追加一条人工要求（强制单遍流式），得到的优化提示呈现出清晰的分层结构——`# Objective`（目标）→ `# Hard requirements`（硬性要求）→ `# Performance & memory constraints`（性能与内存约束）→ `# Guidance`（实现指引）→ `# Output format`（输出格式）→ `# Examples`（示例）：

```python
optimized_prompt = """
# Objective
Generate a single, self-contained Python script that exactly solves the
specified task on a MacBook Pro (M4 Max).

# Hard requirements
- Use only Python stdlib. No approximate algorithms.
- Tokenization: ASCII [a-z0-9]+ on the original text; match case-insensitively
  and lowercase tokens individually. Do NOT call text.lower() on the full string.
- Exact Top-K semantics: sort by count desc, then token asc. No reliance on
  Counter.most_common tie behavior.
- Define `top_k` as a list of (token, count) tuples with length =
  min(k, number of unique tokens).
- When globals `text` (str) and `k` (int) exist, do not reassign them; set
  `top_k` from those globals. If you include a `__main__` demo, guard it to run
  only when globals are absent.
- No file I/O, stdin, or network access, except optionally printing `top_k`
  as the last line.

# Performance & memory constraints
- Do NOT materialize the entire token stream or any large intermediate list.
- Do NOT sort all unique (token, count) items unless k >= 0.3 * number_of_unique_tokens.
- When k < number_of_unique_tokens, compute Top-K using a bounded min-heap of
  size k over counts.items(), maintaining the correct tie-break (count desc,
  then token asc).
- Target peak additional memory beyond the counts dict to O(k). Avoid creating
  `items = sorted(counts.items(), ...)` for large unique sets.

# Guidance
- Build counts via a generator over re.finditer with re.ASCII | re.IGNORECASE;
  lowercase each matched token before counting.
- Prefer heapq.nsmallest(k, cnt.items(), key=lambda kv: (-kv[1], kv[0])) for
  exact selection without full sort; avoid heapq.nlargest.
- Do NOT wrap tokens in custom comparator classes (e.g., reverse-lex __lt__) or
  rely on tuple tricks for heap ordering.
- Keep comments minimal; include a brief complexity note (time and space).

# Output format
- Output only one Python code block; no text outside the block.

# Examples
（此处附一个完整、正确的参考实现作为少样本示例，见原文）
"""
```

对照基线，每一处"软约束分叉"都被钉死：只准标准库、只准精确算法、单遍流式被强制、接口契约（不许重分配全局变量、demo 必须守卫）被写明、排序实现指定到 `heapq.nsmallest` 并点名禁用易踩坑的写法。优化后的提示还可以存为 **Prompt Object**（可复用提示对象），在 API 调用中直接引用，便于后续迭代、版本管理与跨应用复用。

用同样的 30 次生成 + 评测流程重跑优化提示，对比两份 CSV，就能看到优化带来的可测量改进。

## 再加一层：LLM 作为评审（LLM-as-a-Judge）

定量指标之外，还可以给模型的表现打**定性分**：代码质量、任务遵循度等。方法是写一个"评审员"系统提示词（`llm_as_judge.txt`），让另一个模型按统一量表给每份产出打分：

```python
from scripts.llm_judge import judge_folder

# 对基线结果跑 LLM 评审
judge_folder(
    results_dir="results_topk_baseline",
    model="gpt-5",
    system_prompt_path="llm_as_judge.txt",
    concurrency=6,
)

# 对优化结果跑 LLM 评审
judge_folder(
    results_dir="results_topk_optimized",
    model="gpt-5",
    system_prompt_path="llm_as_judge.txt",
    concurrency=6,
)
```

原文的第二个案例（FailSafeQA 问答基准）把评估又推进了一步：真实生产中查询往往不完美、上下文常常有噪声。**FailSafeQA** 刻意对**查询**（拼写错误、不完整、偏离领域）与**上下文**（缺失、OCR 损坏、无关文档）同时施加扰动，报告三项指标——**鲁棒性**（Robustness，信号存在时能否答对）、**上下文锚定**（Context Grounding，是否只依据给定上下文）与**合规性**（Compliance，信号不存在时能否拒答）。在优化前后的对比中，优化提示在鲁棒性（0.320 → 0.540）与上下文锚定（0.800 → 0.950）上都显著占优。

## 方法论小结：提示词迭代评估闭环

把这篇 cookbook 的做法抽象出来，就是一套可以直接搬用的流程：

1. **定基线**：把当前提示词原样跑 N 次（并发批量），保存全部产出；
2. **定指标**：先想清楚"什么算成功"——可执行性、耗时、内存、精确匹配等定量指标；
3. **批量评测**：所有产出过同一把严格、确定性的尺子，落盘成 CSV；
4. **审计失败**：读失败样本，找提示词里的矛盾、歧义与"软许可"（本文基线提示的六类混合信号就是清单）；
5. **结构化改写**：目标 → 硬要求 → 约束 → 指引 → 输出格式 → 示例，逐层钉死歧义（可借力 Prompt Optimizer 类工具，但要人工复核）；
6. **复评 + 评审**：同尺重跑对比；再加 LLM-as-Judge 打定性分，或引入 FailSafeQA 这类抗噪基准检验鲁棒性；
7. **沉淀**：把提示词版本化（Prompt Object / git），记录每版的评估结果，形成可追溯的迭代历史。

这套闭环与本模块第 07 篇的"经验学科"论断互为印证：**提示词工程的每一次改动，都应该由评估结果说话，而不是由感觉说话。**
