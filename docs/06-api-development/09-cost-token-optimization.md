---
title: 成本与 Token 优化：Prompt Caching 与 Batch API
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Prompt_Caching101.ipynb
author: OpenAI Cookbook（Prompt Caching 101、Batch processing with the Batch API）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: Prompt Caching（提示词 >1024 token 自动启用）；Batch API（completion_window=24h，约 5 折）
order: 9
group: 可靠性、安全与成本
---
控制 LLM 应用成本，先想清楚两个"被动省钱"机制——它们不需要你改模型行为，只需要改**请求的组织方式**：

- **Prompt Caching（提示词缓存）**：重复的提示词前缀命中缓存，降低延迟与费用——优化"实时请求"的成本；
- **Batch API（批处理 API）**：能等 24 小时的任务打五折、给更高限额——优化"离线任务"的成本。

## 一、Prompt Caching 101

Cookbook 原文要点：

- 提示词超过 **1024 个 token** 即自动启用缓存，**无需改动请求**；长提示词（>10,000 token）延迟最多可降 **80%**；要更可控就用 `prompt_cache_key` + 显式断点（见第二节）；
- 机制：请求到达时，系统检查提示词的**开头部分（前缀 prefix）**是否已缓存——命中（cache hit）则复用缓存前缀；未命中则全量处理，并顺带把前缀存入缓存；
- 缓存按**组织（organization）**隔离，只有同组织成员能共享缓存；过程不存数据，符合零数据保留（zero data retention）资格。

**最适合缓存的场景**（原文）：

- 使用工具与结构化输出的 Agent：缓存冗长的工具定义与 Schema；
- 编码/写作助手：把代码库或工作区的大段内容放进提示词；
- 聊天机器人：缓存多轮对话中不变的部分，长对话下维持上下文更省。

**如何验证缓存命中**：响应的 `usage.prompt_tokens_details` 里有 `cached_tokens` 字段（命中多少前缀 token 一目了然；提示词不足 1024 token 时恒为 0）。注意：图像 token 同样参与计费与限额。

### 例 1：缓存工具定义与多轮历史

工具定义及其**顺序**在多次请求间保持一致，才能被纳入提示词前缀；多轮对话要命中缓存，就把新消息**追加到 messages 数组末尾**（不动开头）。Cookbook 用一个客服助手（5 个订单工具 + 一大段系统提示词）做两次请求，第二次请求（延迟 7 秒后追加用户消息再发）的 `cached_tokens` 显著大于零——缓存生效。

关键代码骨架：

```python
# 工具定义（两次请求间保持内容与顺序完全一致）
tools = [
    {"type": "function", "function": {"name": "get_delivery_date", "description": "...", "parameters": {...}}},
    {"type": "function", "function": {"name": "cancel_order", "description": "...", "parameters": {...}}},
    {"type": "function", "function": {"name": "return_item", "description": "...", "parameters": {...}}},
    {"type": "function", "function": {"name": "update_shipping_address", "description": "...", "parameters": {...}}},
    {"type": "function", "function": {"name": "update_payment_method", "description": "...", "parameters": {...}}},
]

# 大段系统提示词（静态内容放最前）+ 首条用户消息
messages = [
    {"role": "developer", "content": ("You are a professional, empathetic, and efficient customer support assistant. ...")},
    {"role": "user", "content": ("Hi, I placed an order three days ago and haven't received any updates ...")},
]

def completion_run(messages, tools):
    completion = client.chat.completions.create(
        model="gpt-5.5",
        tools=tools,
        messages=messages,
        tool_choice="required"
    )
    usage_data = json.dumps(completion.to_dict(), indent=4)
    return usage_data

# 第二轮：只往末尾追加新用户消息，前缀不变 → 命中缓存
messages.append(user_query2)
run2 = completion_run(messages, tools)
```

### 例 2：缓存图像

图片（URL 或 base64）同样可被缓存，但要求 `detail` 参数等分词相关设置保持一致。Cookbook 的实验：三张食品图 + 同一提问跑三次——第二次命中缓存；第三次**故意把第一张图换掉**（eggs_url 替换 veggie_url），即使提问相同也**未命中**——因为前缀变了。这个反例直观证明：**缓存按前缀匹配，开头内容必须严格一致（包括图片顺序）**。

### 缓存最佳实践（原文总结）

- **静态/高频复用的内容放开头**，动态内容（用户特定信息）放结尾；
- **保持稳定的使用节奏**：不常使用的提示词会被自动逐出缓存，防止 cache 失效要持续使用；
- **监控关键指标**：缓存命中率、延迟、缓存 token 占比——用数据调优缓存策略。

## 二、显式缓存键与提示词版本化：2026 年的写法

上一节的自动缓存（前缀 ≥1024 token 即生效，无需改请求）是**零配置**的那一半；生产上还需要可控的那一半。现行 Responses API 提供三个字段（参数说明取自 openai-python 的类型定义）：

```python
response = client.responses.create(
    model="gpt-5.5",
    instructions=SYSTEM_PROMPT,          # 静态：所有用户共用
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": KB_ARTICLE,   # 大段知识库：放在动态内容之前
                    # 显式断点：标记"可复用前缀到此结束"（每个请求最多写 4 个断点）
                    "prompt_cache_breakpoint": {"mode": "explicit"},
                },
                {"type": "input_text", "text": user_question},   # 动态内容留在最后
            ],
        }
    ],
    prompt_cache_key=f"tenant_{tenant_id}",   # 缓存分片键（取代旧的 user 字段）
    prompt_cache_options={"ttl": "30m"},      # gpt-5.6 起支持；ttl 是当前唯一取值（30 分钟）
)
```

- **`prompt_cache_key`**：给同一批请求打同一个键，OpenAI 用它来优化命中。**它是"路由提示"，不是权限边界**——不同租户的私有内容不要指望它隔离，该拆项目/前缀就拆。SDK 文档明确它取代了旧的 `user` 字段。
- **`prompt_cache_options` + `prompt_cache_breakpoint`**：默认由 OpenAI 自动选一个**隐式断点**；置 `mode="explicit"` 后隐式断点关闭，完全由你标。匹配时会考虑会话里最近 80 个断点、没有内容块回看上限。适合"多段可复用前缀"的场景（系统提示词 + 工具定义 + 检索到的长文档）。
- **`prompt_cache_retention`** 已标注 **Deprecated**（改用 `prompt_cache_options.ttl`）。旧值 `in_memory` / `24h` 表达的是**最长**保留、与 `ttl`（最短存活）互不影响；`gpt-5.5`/`gpt-5.5-pro` 及之后的模型只支持 `24h`；开了 ZDR（零数据保留）的组织在未指定时默认 `in_memory`。读到旧教程里 `prompt_cache_retention="24h"` 的写法，先确认你的组织策略再照抄。
- **提示词版本化到调用侧**：`prompt=` 参数可以引用平台上保存的**提示模板**及其变量（"版本 prompts in code"），配合观测字段 `gen_ai.prompt.name` / `gen_ai.prompt.version`，就能把"这版提示词命中率/单价/质量"直接聚合出来——提示词管理从"文件里改字符串"变成"有版本、可回滚的对象"。写法与埋点见《生产可观测性：OpenTelemetry GenAI 语义约定与调用侧埋点》。

## 三、分层路由与输出裁剪：另外两个省钱开关

缓存和 Batch 解决"同样的话别重复算"，还有两件事管"这次该花多少"。

### 1. 按任务分层选模型（模型阶梯）

本站示例统一用的模型档位，正好构成一条阶梯：**分类/抽取/改写走轻量档，生成与工具编排走通用档，多步推理才上旗舰**。gpt-6-astra 一类旗舰模型还额外要求工具调用走 Responses API、不支持自定义 `temperature`，把它用在"判断这条工单是不是投诉"上是纯浪费。

单价数字不要在文章里抄——它一年改好几次。**做法是把你自己的价格表落成数据**：控制台定价页取数 → 存进一张 `model_pricing(model, currency, input_per_mtok, output_per_mtok, cached_input_per_mtok)` 表 → 代码里按 `usage` 乘算。落库与窗口统计见《PostgreSQL 窗口函数与 CTE：按天按模型算 token 与延迟》。

```python
PRICING = {  # 示例结构，数值请从官方定价页取你自己的快照
    "gpt-5.5":     {"in": 0.0, "out": 0.0, "cached_in": 0.0},
    "gpt-5.4-mini": {"in": 0.0, "out": 0.0, "cached_in": 0.0},
}

def estimate_cost(model: str, usage) -> float:
    price = PRICING[model]
    cached = getattr(usage.input_tokens_details, "cached_tokens", 0) or 0
    billable_in = usage.input_tokens - cached
    return (billable_in * price["in"] + cached * price["cached_in"] + usage.output_tokens * price["out"]) / 1_000_000
```

### 2. 裁剪输出：上限、 verbosity、推理力度三管齐下

- **`max_output_tokens`（Responses）/ `max_completion_tokens`（Chat Completions）给实数**：别留默认。注意限流侧也是按"输入 token 与输出上限的较大者"预扣的（《错误处理、重试与限流》），上限虚高同时抬成本与撞限概率。
- **`text={"verbosity": "low"}`**：现行模型支持"回答啰嗦程度"这一维；对列表式、抽取式任务降到 `low` 常能省掉 30% 以上输出 token。
- **`reasoning={"effort": "low"}`**：推理模型的思考 token 也计费（观测上体现为 `gen_ai.usage.reasoning.output_tokens`）。任务不复杂就别给 `high`；需要更细的控制请看 `reasoning.summary` 与模型侧档位（《推理模型时代的提示原则》方向）。
- **结构化输出限定字段**：让模型只返回你要的字段（strict schema），比"请简短回答"可靠得多（《JSON Mode 与结构化输出（Structured Outputs）》）。

## 四、Batch API：异步任务五折处理

Batch API 的定位（Cookbook 原文）：**为异步批处理作业提供更低价格与更高限额**；作业 24 小时内完成（通常更快）。

理想用例：市场/博客内容的打标与配文、客服工单的分类与建议回复、海量客户反馈的情感分析、文档/文章集的摘要与翻译。

### 工作流四步：写 JSONL → 上传 → 创建作业 → 取结果

**第 0 步**：先用普通 Chat Completions 端点把提示词调通（参数完全一致），再转批处理。示例任务：从电影简介抽取分类 + 一句话摘要（JSON Mode）。

**第 1 步：构造 JSONL 批处理文件**，每行一个请求对象：

```json
{
    "custom_id": "<REQUEST_ID>",
    "method": "POST",
    "url": "/v1/chat/completions",
    "body": {
        "model": "<MODEL>",
        "messages": "<MESSAGES>",
        "response_format": { "type": "json_object" }
    }
}
```

```python
# 构造 JSON 任务数组
tasks = []

for index, row in df.iterrows():
    description = row['Overview']
    task = {
        "custom_id": f"task-{index}",
        "method": "POST",
        "url": "/v1/chat/completions",
        "body": {
            # 与普通 Chat Completions 调用中的内容一致
            "model": "gpt-5.4-mini",
            "temperature": 0.1,
            "response_format": {
                "type": "json_object"
            },
            "messages": [
                {
                    "role": "system",
                    "content": categorize_system_prompt
                },
                {
                    "role": "user",
                    "content": description
                }
            ],
        }
    }
    tasks.append(task)

# 写入文件
file_name = "data/batch_tasks_movies.jsonl"
with open(file_name, 'w') as file:
    for obj in tasks:
        file.write(json.dumps(obj) + '\n')
```

> `custom_id` 在批内必须唯一——**结果不按提交顺序返回**，全靠它对回原始输入。

**第 2 步：上传文件**（`purpose="batch"`）：

```python
batch_file = client.files.create(
  file=open(file_name, "rb"),
  purpose="batch"
)
```

**第 3 步：创建批处理作业**并轮询状态：

```python
batch_job = client.batches.create(
  input_file_id=batch_file.id,
  endpoint="/v1/chat/completions",
  completion_window="24h"
)

# 检查状态：可能需要等待（通常快于 24h），直到 completed
batch_job = client.batches.retrieve(batch_job.id)
print(batch_job)
```

**第 4 步：下载结果文件并逐行解析**：

```python
result_file_id = batch_job.output_file_id
result = client.files.content(result_file_id).content

result_file_name = "data/batch_job_results_movies.jsonl"
with open(result_file_name, 'wb') as file:
    file.write(result)

results = []
with open(result_file_name, 'r') as file:
    for line in file:
        json_object = json.loads(line.strip())
        results.append(json_object)

# 再次强调：结果与输入顺序不同，用 custom_id 对回
for res in results[:5]:
    task_id = res['custom_id']
    index = task_id.split('-')[-1]
    result = res['response']['body']['choices'][0]['message']['content']
    movie = df.iloc[int(index)]
    print(f"TITLE: {movie['Series_Title']}\n\nRESULT: {result}")
```

原始输出节选：

```text
TITLE: The Shawshank Redemption
RESULT: {
    "categories": ["drama"],
    "summary": "Two imprisoned men develop a deep bond over the years, ultimately finding redemption through their shared acts of kindness."
}
```

**视觉模型也能进批处理**：Cookbook 的第二个例子给家具图批量生成商品文案——`body` 里的 `messages` 与普通多模态调用写法一致（文字块 + `image_url` 块），`custom_id` 照旧对账。

Cookbook 的收尾建议：批处理 API 与 Chat Completions 端点参数一致、支持绝大多数模型；**凡是不要求实时完成的负载，都值得转成批处理作业**，可显著降低成本。

## 五、一张决策图

**表：两种成本优化机制选型**

| 维度 | Prompt Caching | Batch API |
| --- | --- | --- |
| 省的是什么 | 重复**前缀**的延迟与费用 | 整个任务约 50% 价格 + 更高限额 |
| 生效条件 | 提示词 >1024 token、前缀完全一致、同组织 | 任务可容忍最长 24 小时延迟 |
| 对请求的改造 | 组织提示词：静态放开头、动态放结尾 | 打包成 JSONL 文件 + 异步作业 |
| 典型场景 | 多轮聊天、Agent 工具定义、带代码库上下文的助手 | 数据集打标、摘要翻译、反馈分析 |
| 两者可叠加 | 同一批处理请求内部当然也可以有重复前缀（如相同系统提示词） | ✓ |

## 六、本篇小结

- Prompt Caching 自动生效（>1024 token），按前缀匹配——**把不变的放开头**，用 `usage.prompt_tokens_details.cached_tokens` 验证命中率；
- 换前缀（哪怕只换第一张图）就前功尽弃；工具定义与顺序也要保持一致；
- Batch API：JSONL + `custom_id` + 24 小时窗口，约五折、限额更高，结果乱序返回靠 `custom_id` 对账；
- 实时流量用 Caching，离线负载转 Batch，两者不冲突。

下一篇开始进入"生态"：OpenAI 兼容端点与 LiteLLM 统一路由。

---

> **来源**：本文翻译自 [Prompt Caching 101](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Prompt_Caching101.ipynb) 与 [Batch processing with the Batch API](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/batch_processing.ipynb)（OpenAI Cookbook，MIT），作者 OpenAI，许可 MIT。抓取于 2026-09-13。
