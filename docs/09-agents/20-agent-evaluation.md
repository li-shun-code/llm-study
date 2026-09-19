---
title: Agent 评测：数据集、评估器与 LLM-as-Judge 实战
source_url: https://docs.langchain.com/langsmith/evaluate-llm-application
author: LangChain 团队（LangSmith 官方文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: langsmith>=0.3.13（Python SDK 当前版）
order: 20
---

# 方法论：为什么 Agent 评测与普通测试不同

Agent 的执行路径是不确定的：同样的问题，这次走 3 步、下次走 10 步。传统单元测试"给定输入 X 必须走路径 Y"的思路失效了。本模块第 9 篇里 Anthropic 的经验值得复读一遍：

- **立刻用小样本开始**：早期改动效应量大，约 20 个代表真实用法的查询就能清晰看出改动影响，别等到"建大评估"；
- **LLM-as-Judge 可以规模化**：研究类输出是自由文本，让 LLM 按量规（Rubric）打分——事实准确性、引用准确性、完整性、来源质量、工具效率；
- **人工评估补盲区**：自动化漏掉的边缘情况（幻觉、来源偏差）要靠人测；
- **改状态的多轮智能体做"终态评估"**：不评判过程，评判最终状态是否正确。

落实到工程，一套 Agent 评测体系由三件事组成：**数据集（Dataset）**——一组带参考答案的样例；**目标函数（Target Function）**——被评测的应用入口；**评估器（Evaluator）**——给输出打分的函数（可以是精确匹配，也可以是 LLM-as-Judge）。下面按 LangSmith 官方指南走一遍完整流程。

# 如何评测一个智能体（LangSmith 官方指南）

本指南演示如何用 LangSmith SDK 对一个应用运行评估。

> **提示**：Python 中更大的评估任务建议用异步版 `aevaluate()`，接口与 `evaluate()` 完全一致。运行大任务时还应配置 `max_concurrency` 参数——它把数据集切分到多线程上并行评估。

## 第 1 步：定义被评测的应用

先创建一个简单的毒性分类器作为示例应用：

```python
from langsmith import traceable, wrappers
from openai import OpenAI

# 可选：包装 OpenAI 客户端以追踪所有模型调用。
oai_client = wrappers.wrap_openai(OpenAI())

# 可选：给函数加 'traceable' 装饰器，追踪其输入输出。
@traceable
def toxicity_classifier(inputs: dict) -> dict:
    instructions = (
      "Please review the user query below and determine if it contains any form of toxic behavior, "
      "such as insults, threats, or highly negative comments. Respond with 'Toxic' if it does "
      "and 'Not toxic' if it doesn't."
    )
    messages = [
        {"role": "system", "content": instructions},
        {"role": "user", "content": inputs["text"]},
    ]
    result = oai_client.chat.completions.create(
        messages=messages, model="gpt-5.4-mini", temperature=0
    )
    return {"class": result.choices[0].message.content}
```

我们顺带开启了追踪（Tracing），以捕获管线中每一步的输入输出——评测与可观测性（《OpenAI Agents SDK：轻量多智能体框架入门》）共享同一套插桩。

## 第 2 步：创建或选择数据集

需要一个数据集来评测应用。数据集包含带标注的"有毒/无毒"文本样例（需要 `langsmith>=0.3.13`）：

```python
from langsmith import Client

ls_client = Client()

examples = [
  {
    "inputs": {"text": "Shut up, idiot"},
    "outputs": {"label": "Toxic"},
  },
  {
    "inputs": {"text": "You're a wonderful person"},
    "outputs": {"label": "Not toxic"},
  },
  {
    "inputs": {"text": "This is the worst thing ever"},
    "outputs": {"label": "Toxic"},
  },
  {
    "inputs": {"text": "I had a great day today"},
    "outputs": {"label": "Not toxic"},
  },
  {
    "inputs": {"text": "Nobody likes you"},
    "outputs": {"label": "Toxic"},
  },
  {
    "inputs": {"text": "This is unacceptable. I want to speak to the manager."},
    "outputs": {"label": "Not toxic"},
  },
]

dataset = ls_client.create_dataset(dataset_name="Toxic Queries")
ls_client.create_examples(
  dataset_id=dataset.id,
  examples=examples,
)
```

每个样例由 `inputs`（喂给应用的输入）与 `outputs`（参考输出/标注）组成。生产中数据集往往直接从线上 trace 里筛选沉淀而来——这正是第 16 篇"把数据加入数据集可长期保留"的用意。

## 第 3 步：定义评估器

评估器是给应用输出打分的函数，接收样例输入、实际输出以及（若有的话）参考输出。本任务有标注，评估器可以直接比对实际输出与参考输出是否一致：

```python
def correct(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    return outputs["class"] == reference_outputs["label"]
```

两种定义评估器的方式：

- **在代码中本地定义**（如上）；也可以使用 LangChain 开源的预置评估器包 [openevals](https://github.com/langchain-ai/openevals)（含事实性、RAG、工具调用等常用评估器）；
- **在 LangSmith UI 中定义**：在 Evaluators 标签页创建（含 LLM-as-Judge 评估器），绑定的评估器会在每次新实验时自动触发。

对没有唯一正确答案的开放性输出（如研究报告），评估器就可以换成 LLM-as-Judge：让一个 LLM 按量规逐项打分（0.0-1.0 + 通过/不通过）。《Agent 记忆机制：LangGraph 的短期记忆与长期记忆》 Anthropic 的实践是：单次 LLM 调用、单一提示、输出分数与等级，最稳定且最贴近人类判断。

## 第 4 步：运行评估

用 `evaluate()` / `aevaluate()` 运行评估。关键参数：

- **目标函数**：接收输入字典、返回输出字典。每个样例的 `example.inputs` 会传给目标函数——本例的 `toxicity_classifier` 已按此签名写好，可直接使用；
- `data`：要评测的 LangSmith 数据集名称或 UUID，或样例迭代器；
- `evaluators`：给函数输出打分的评估器列表；UI 中绑定的数据集评估器也会自动触发；
- `metadata`：附加到实验的可选对象。传 `models`、`prompts`、`tools` 键可以在实验表格中填充对应列。

```python
# 可选元数据：用于填充 UI 中的模型/提示/工具列
EXPERIMENT_METADATA = {
    "models": [
        "openai:gpt-5.4-mini",
    ],
    "prompts": ["my-org/my-eval-prompt:abc12345"],
    "tools": [
        {
            "name": "web_search",
            "description": "Search the web for information",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    ],
}

results = ls_client.evaluate(
    toxicity_classifier,
    data=dataset.name,
    evaluators=[correct],
    experiment_prefix="gpt-5.4-mini, baseline",  # 可选：实验名前缀
    description="Testing the baseline system.",  # 可选：实验描述
    max_concurrency=4,  # 可选：并发数
    metadata=EXPERIMENT_METADATA,  # 可选：填充 UI 的模型/提示/工具列
)
```

## 第 5 步：查看结果

每次 `evaluate()` 调用都会创建一个**实验（Experiment）**，可在 LangSmith UI 中查看或经 SDK 查询。对着同一数据集跑的实验会列在实验表格中；从 Playground 或 SDK 发起的实验有实时的 Progress 列跟踪完成度。

点击某行实验可以看到每个样例的得分；按分数过滤与排序，找出应用表现好/差模式。点击某个样例打开详情面板：输入、输出、参考输出以及关联 trace（如果你做了追踪插桩）——这把"评测分数"和"执行现场"直接连了起来。

实验元数据还支持 **Group by**：按任意元数据字段聚类实验，表格上方的汇总图表会按组更新平均分、延迟与 token 用量，方便对比不同提示版本/模型/配置在同一数据集上的表现。

# 超越"输入-输出"：Agent 专属评估维度

上面的分类器是"单步应用"。真正的多步 Agent 还应评估这些维度（LangSmith 的 intermediate-steps 评估与 openevals 的 Agent evaluators 都支持）：

- **工具选择质量**：该用的工具用了没有？不该用的用了没有？调用次数是否合理？
- **轨迹（Trajectory）评估**：对比智能体实际走过的节点/工具序列与预期轨迹；
- **单步评估**：对中间步骤（每次工具调用的输出）单独打分，定位链条中最早出错的一环；
- **终态评估**（《Agent 记忆机制：LangGraph 的短期记忆与长期记忆》）：多轮改状态的智能体，只验最终状态是否正确；
- **成本与延迟**：token 用量与耗时也是实验表格的一等公民——两个准确率相同的智能体，成本差 10 倍即是胜负。

把评测挂进 CI：每次改提示、换模型、动工具描述后自动跑一遍数据集，分数回归即报警——这是把 Agent 从"玄学调参"带入工程的正道。

---

> **来源**：本文主体翻译自 LangSmith 官方文档 [How to evaluate agents](https://docs.langchain.com/langsmith/evaluate-llm-application)，作者 LangChain 团队，许可 MIT。抓取于 2026-09-13。选取 Python 路线全文翻译（原文另含 JS/TS 代码）；开头方法论一节综合了本文与 Anthropic《多智能体研究系统》（《Agent 记忆机制：LangGraph 的短期记忆与长期记忆》）中的评估经验。
