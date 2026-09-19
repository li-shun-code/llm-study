---
title: Responses API 会话与后台任务：conversation、store 与断流续传
source_url: https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/responses/responses.py
author: OpenAI（openai-python SDK 源码与文档字符串、Cookbook responses_example.ipynb）
license: Apache 2.0 / MIT
fetched_at: 2026-09-19
translated: true
versions: openai-python 2026-09 最新稳定版；示例模型 gpt-5.5；store 默认 true、保留至少 30 天；background/starting_after/conversations/compact 均为现行能力
order: 18
group: 调用基础
---
《消息角色与多轮会话管理》把"谁来记住历史"讲清楚了：应用自管 `messages`，或者用 Responses API 的托管状态。本篇是那条路线的工程版——**把 API 侧会话状态真正用到生产里**：会话容器怎么建、`store` 与保留期怎么配、上下文超长时 `truncation` 与 `compact` 谁上场、长任务怎么用 `background` 跑、断流之后怎么用 `starting_after` 续上。

先记住一条：这些能力全在 Responses API 一侧，Chat Completions 没有对应物（它只有 `messages` 数组）。所以是否值得为托管状态迁移，取决于你多需要下面这几件事。

## 一、两种挂历史的方式：previous_response_id 与 conversation

**链式（`previous_response_id`）**：每个响应都有 `id`，下一次请求把它传进去，服务端自动把之前的项拼到 `input_items` 前面。适合"一次对话一条链"：

```python
from openai import OpenAI

client = OpenAI()  # Key 从 .env / 环境变量读取（全站约定）

MODEL = "gpt-5.5"

r1 = client.responses.create(model=MODEL, input="我在做一个 VitePress 学习站，先记下。")
r2 = client.responses.create(model=MODEL, input="它需要侧边栏自动生成，还记得我说的是什么站吗？",
                             previous_response_id=r1.id)
print(r2.output_text)
```

**容器式（`conversation`）**：先建一个会话对象，之后每条响应都挂到它上面，输入与输出项自动追加进会话。适合"一个用户/工单一个长会话，多个入口往里写"：

```python
conv = client.conversations.create(
    # 会话对象没有"名字"字段，只有 metadata：最多 16 组键值，键 ≤64 字符、值 ≤512 字符
    metadata={"ticket": "4821", "user_id": "u_8842", "channel": "web"},
    items=[{"role": "developer", "content": "本会话处理发货延迟问题。"}],  # 初始条目一次最多 20 条
)

client.responses.create(model=MODEL, conversation=conv.id,
                        input={"role": "user", "content": "订单三天没发货"})
client.responses.create(model=MODEL, conversation=conv.id,
                        input={"role": "user", "content": "补充：收件人换了"})

# 直接读会话里的条目，不经过模型
items = client.conversations.items.list(conversation_id=conv.id, limit=20)
```

两个参数**互斥**：`previous_response_id` 不能与 `conversation` 同时给（SDK 的类型定义里写明 "Cannot be used in conjunction with `conversation`"），混用会 400。

`conversation` 与 `previous_response_id` 的区别不是"谁更好"，而是**归属权**：前者是独立容器，多个入口（Web、App、工单系统）都能往同一个 `conversation_id` 写；后者把状态挂在某一次响应上，天然只服务一条链。

CRUD 一览（都按资源方法名记，别背 URL）：`client.responses.create/retrieve/update/delete/list/cancel/compact/stream/parse`；`client.conversations.create/retrieve/update/delete` 与 `client.conversations.items.list`。

## 二、store：默认就存，别当没这回事

`store` 控制这次响应是否写入服务端存储以便后续取回。**现行默认值是 `true`**，并且文档写明：置为 true 时响应数据**至少保留 30 天**，受"你对自己数据的保留例外"约束。这条默认值很多人不知道，直接带来两个后果：

1. **合规**：对话原文（含可能的个人信息）存在 OpenAI 侧。要么显式 `store=False`，要么走零保留/企业协议路径，并把这一点写进你的数据处理附录。
2. **链式续接的前提**：`store=False` 的响应不能作为 `previous_response_id` 被取回；无状态多轮要靠 `conversation` 之外的一条路——把 `reasoning` 项自己带回来。

```python
# 无状态但要多轮：不存服务端，用 include 把加密后的推理项带在自己手里
r = client.responses.create(
    model=MODEL,
    input="把上面这句话反过来写",
    store=False,
    include=["reasoning.encrypted_content"],  # 得到可回传的加密推理内容
)
```

`include` 是白名单，取值有限（`web_search_call.action.sources`、`file_search_call.results`、`code_interpreter_call.outputs`、`computer_call_output.output.image_url`、`message.output_text.logprobs`、`reasoning.encrypted_content` 等），写错直接 400。

## 三、上下文超长：truncation 与 compact

**`truncation`** 决定输入超过窗口时怎么办，只有两个值：

- `disabled`（默认）：请求直接 400 失败；
- `auto`：服务端从会话**开头**丢项，塞进窗口再跑。

也就是说，默认配置下你不会"悄悄丢历史"，而是**当场报错**；想要自动裁剪必须显式说。生产上常见组合是：链式/容器式会话 + `truncation="auto"` + 自己保留一份原始记录（丢了还能查）。

**`client.responses.compact()`** 是更新的做法：不是丢掉最早的项，而是把长会话**压缩**成可续接的形式，保留语义、降低 token。窗口紧张又不想丢早期约束时优先考虑它，参数同样是 `model` + 会话定位信息：

```python
compacted = client.responses.compact(
    model=MODEL,
    input=items.data,          # 把会话条目交给压缩接口
    instructions="保留用户目标与已确认事实，压缩过程性对话。",
)
```

选型经验：`truncation="auto"` 解决"跑不过去"，`compact` 解决"越跑越贵"，摘要式压缩（自己写提示词做 summary）解决"要留结论不要过程"。三者可以叠用，但**每次都要留下原始记录**，否则无法复盘。

## 四、后台任务：background + 轮询 + cancel

深度研究、长报告这类请求动辄几十分钟。同步等会撞超时、也占连接。`background=True` 让请求异步化：立刻返回一个 `status` 为 `queued` / `in_progress` 的响应对象，之后再按 `id` 取结果。

```python
import time

task = client.responses.create(
    model=MODEL,
    input="调研 2026 年主流向量数据库的部署形态，输出带引用的报告",
    background=True,
    tools=[{"type": "web_search"}],
)

# 轮询：间隔指数放宽，设置总预算，别写没有出口的 while True
deadline = time.monotonic() + 15 * 60
while task.status in ("queued", "in_progress"):
    if time.monotonic() > deadline:
        client.responses.cancel(task.id)   # 只有 background=True 的响应能被取消
        raise TimeoutError(f"response {task.id} 超时，已取消")
    time.sleep(5)
    task = client.responses.retrieve(response_id=task.id)

print(task.output_text)
```

要点：

- `cancel` 的适用面很窄：**只有用 `background=True` 创建的响应可以取消**（SDK 文档原文），普通请求断了就是断了。
- 轮询取回的是**完整响应对象**，所以 `output` 里的工具调用项、引用注记都在，与同步调用一致。
- 后台任务不省 token 费用，只省连接与超时风险；要省钱走 Batch API（《成本与 Token 优化：Prompt Caching 与 Batch API》）。
- 别忘了把 `response.id` 落到你自己的库里（Postgres 一张 `llm_calls` 表即可），否则任务与业务对象脱钩，事后无法对账。落库写法见《psycopg3 驱动与参数化查询》。

## 五、断流续传：starting_after

流式连接断开后从头重放既不必要也浪费。Responses 的流式接口带 `starting_after`——**事件序列号**，含义是"从这个事件之后开始推"。稳妥的写法是把两步分开：**先非流式创建后台任务拿到 `id`，再用 `stream(response_id=..., starting_after=...)` 订阅事件**。

```python
task = client.responses.create(
    model=MODEL,
    input="写一段 800 字的技术说明",
    background=True,          # 后台任务：先拿到 id，再慢慢追事件
)

seen_seq = 0                  # 已成功处理到的事件序号
for attempt in range(3):      # 最多重连 3 次
    try:
        with client.responses.stream(response_id=task.id, starting_after=seen_seq) as stream:
            for event in stream:
                if event.sequence_number is not None:
                    seen_seq = event.sequence_number
                if event.type == "response.output_text.delta":
                    print(event.delta, end="", flush=True)
        break                 # 正常结束
    except Exception as exc:  # 网络中断 / 服务端断流
        print(f"\n第 {attempt + 1} 次中断：{exc}；从 seq={seen_seq} 之后续传")
else:
    raise RuntimeError("重连 3 次仍失败，改用 retrieve 收尾")

final = client.responses.retrieve(task.id)   # 结果必须完整时：兜底取全量
print("\n完成：", final.status, len(final.output_text), "字符")
```

两种收尾策略按需选：

1. **流式 + 重连**（上面的写法）：首字延迟低，事件序号保证不重放、不丢中间文本；
2. **只用 `retrieve` 收尾**：流断了无所谓，最后 `client.responses.retrieve(task.id)` 取完整响应，`output_text` 一次拿全。适合"给用户看进度、但结果必须完整"的场景。

`client.responses.stream()` 上下文管理器还提供 `get_final_response()`，流正常结束时拿累积完成的响应对象（写法见《实战：命令行聊天机器人》）。


## 六、清理与保留：三步别漏

```python
# 1) 删除某次响应（链式续接会随之断掉，注意只删链尾）
client.responses.delete(response_id=r2.id)

# 2) 删除整个会话
client.conversations.delete(conversation_id=conv.id)

# 3) 上传的文件与向量存储要单独删（保留期与配额都算在这上面）
client.files.delete(file_id="file-abc123")
client.vector_stores.delete(vector_store_id="vs_67d0...")
```

配套三件事：给会话打 `metadata`（谁、哪个渠道、数据分级）；在应用库里存 `response_id ↔ 业务主键` 映射；写一个每日清理任务按 `created_at` 删过期会话。**"API 会替你保管 30 天"不等于"你可以不管理"**。

## 七、常见坑

1. **把托管状态当免费午餐**：链式续接每次都会重放整段历史，token 成本是累加的；窗口内成本靠 Prompt Caching 摊薄（自动前缀缓存），超出窗口就变成 `truncation`/`compact` 的判断题。
2. **`store=True` 却没配保留协议**：默认存 30 天，个人信息类对话请先问合规。
3. **删链中间节点**：`previous_response_id` 指到被删响应就断链；先删叶子。
4. **轮询没有出口**：`while resp.status == "in_progress"` 不加 deadline，网络抖动时进程挂死。
5. **`cancel` 用在非后台响应上**：直接报错，且此时任务其实已经在你手上超时了。
6. **忘记 `conversation` 与 `previous_response_id` 互斥**：混用是 400，不是静默覆盖。

## 八、小结

- 会话状态两条写法：`previous_response_id`（链）与 `conversation`（容器），互斥，各有 CRUD；
- `store` 默认 true、至少存 30 天；要无状态多轮就用 `include=["reasoning.encrypted_content"]` 自己带推理项；
- 超长输入：默认 `truncation="disabled"` 会 400，`auto` 丢最早项，`compact` 做压缩；
- `background=True` + `retrieve` 轮询 + `cancel` 构成任务化调用；断流续传靠 `starting_after` 的事件序号；
- 响应、会话、文件、向量存储各有各的删除接口，保留期要自己管。

---

> **来源**：抓取于 2026-09-19。本文依据 openai-python SDK（Apache 2.0）由 OpenAPI 规范生成的源码与文档字符串整理：[resources/responses/responses.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/responses/responses.py)（`create`/`retrieve`/`update`/`delete`/`list`/`cancel`/`compact`/`stream`、`starting_after`、`include` 取值）、[types/responses/response_create_params.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_create_params.py)（`store` 默认值与 30 天保留、`background`、`truncation`、`conversation` 与 `previous_response_id` 互斥）、[resources/conversations/conversations.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/conversations/conversations.py)；会话状态的基础示例译自 OpenAI Cookbook（MIT）[responses_example.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb)。作者 OpenAI，许可 Apache 2.0 / MIT。轮询预算、两步续传写法与清理清单为本站编者整理。
