---
title: 成本与 Token 优化：Prompt Caching 与 Batch API
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Prompt_Caching101.ipynb
author: OpenAI Cookbook（Prompt Caching 101、Batch processing with the Batch API）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 7
versions: Prompt Caching（提示词 >1024 token 自动启用）；Batch API（completion_window=24h，约 5 折）
---

控制 LLM 应用成本，先想清楚两个"被动省钱"机制——它们不需要你改模型行为，只需要改**请求的组织方式**：

- **Prompt Caching（提示词缓存）**：重复的提示词前缀命中缓存，降低延迟与费用——优化"实时请求"的成本；
- **Batch API（批处理 API）**：能等 24 小时的任务打五折、给更高限额——优化"离线任务"的成本。

## 一、Prompt Caching 101

Cookbook 原文要点：

- 提示词超过 **1024 个 token** 即自动启用缓存，**无需改动请求**；长提示词（>10,000 token）延迟最多可降 **80%**；
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
    {"role": "system", "content": ("You are a professional, empathetic, and efficient customer support assistant. ...")},
    {"role": "user", "content": ("Hi, I placed an order three days ago and haven't received any updates ...")},
]

def completion_run(messages, tools):
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
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

## 二、Batch API：异步任务五折处理

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
            "model": "gpt-4o-mini",
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

## 三、一张决策图

**表：两种成本优化机制选型**

| 维度 | Prompt Caching | Batch API |
| --- | --- | --- |
| 省的是什么 | 重复**前缀**的延迟与费用 | 整个任务约 50% 价格 + 更高限额 |
| 生效条件 | 提示词 >1024 token、前缀完全一致、同组织 | 任务可容忍最长 24 小时延迟 |
| 对请求的改造 | 组织提示词：静态放开头、动态放结尾 | 打包成 JSONL 文件 + 异步作业 |
| 典型场景 | 多轮聊天、Agent 工具定义、带代码库上下文的助手 | 数据集打标、摘要翻译、反馈分析 |
| 两者可叠加 | 同一批处理请求内部当然也可以有重复前缀（如相同系统提示词） | ✓ |

## 四、本篇小结

- Prompt Caching 自动生效（>1024 token），按前缀匹配——**把不变的放开头**，用 `usage.prompt_tokens_details.cached_tokens` 验证命中率；
- 换前缀（哪怕只换第一张图）就前功尽弃；工具定义与顺序也要保持一致；
- Batch API：JSONL + `custom_id` + 24 小时窗口，约五折、限额更高，结果乱序返回靠 `custom_id` 对账；
- 实时流量用 Caching，离线负载转 Batch，两者不冲突。

下一篇开始进入"生态"：OpenAI 兼容端点与 LiteLLM 统一路由。

---

> **来源**：本文翻译自 [Prompt Caching 101](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Prompt_Caching101.ipynb) 与 [Batch processing with the Batch API](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/batch_processing.ipynb)（OpenAI Cookbook，MIT），作者 OpenAI，许可 MIT。抓取于 2026-09-13。
