---
title: Responses API 托管工具总览与 web_search
source_url: https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/tool.py
author: OpenAI（openai-python SDK 类型定义、Cookbook responses_example.ipynb）
license: Apache 2.0 / MIT
fetched_at: 2026-09-19
translated: true
versions: openai-python 2026-09 最新稳定版；示例模型 gpt-5.4；web_search 工具类型 web_search / web_search_2025_08_26
order: 5
group: 工具与输出契约
---
上一篇《Function Calling / Tool Use：让模型调用你的函数》讲的是"自定义工具"：模型输出函数名与参数，**执行权在你手里**——你要跑那段逻辑、把结果回传、再等模型总结。Responses API 还提供另一类工具：**托管工具**（hosted tools，官方文档亦称内置工具）。你只需在请求的 `tools` 数组里声明，**服务端自己决定何时调用、自己执行、再把结果融进回答**，省掉"模型出调用 → 你执行 → 回传结果"的手工往返。

Cookbook《What is the Responses API?》对此的概括是：Responses API 的一个关键收益就是支持 `file_search`、`web_search` 这类托管工具——不必手工调用工具，只要传入工具列表，API 会决定用哪个工具并直接使用它。

本篇负责两件事：把**托管工具的全景与共性**讲清楚（有哪些、怎么声明、输出项长什么样、钱和延迟花在哪），然后把 `web_search` 这一条讲透。`file_search`（知识库检索）与 `code_interpreter`（沙箱执行）的实现细节较多，单独放在《文件检索与代码解释器：file_search 与 code_interpreter》一篇；图像生成能力（`gpt-image`）属于多模态产出，收在《视觉理解与图像生成：把图片喂给多模态模型，也让它画图》里。

## 一、托管工具清单：能声明什么

工具清单的权威来源是 SDK 里 `responses` 资源的工具联合类型定义（`src/openai/types/responses/tool.py`，由 OpenAPI 规范自动生成）。逐类对照：

**表：Responses API 可声明的工具类型**

| `type` 值 | 执行方 | 用途 | 关键参数 |
| --- | --- | --- | --- |
| `function` | 你的应用 | 接自己的业务逻辑与私有数据 | `name` / `parameters` / `strict` |
| `web_search` | 服务端 | 联网检索并带引用作答 | `filters.allowed_domains`、`search_context_size`、`user_location`、`external_web_access` |
| `file_search` | 服务端 | 对自己上传的文件做托管 RAG | `vector_store_ids`、`max_num_results`(1–50)、`filters`、`ranking_options` |
| `code_interpreter` | 服务端沙箱 | 写代码、跑代码、出图表 | `container`：`type="auto"`、`memory_limit`（`1g`/`4g`/`16g`/`64g`）、`file_ids` |
| `mcp` | 远程 MCP Server | 接入第三方工具生态 | `server_label` / `server_url` / `allowed_tools` / `require_approval` |
| `image_generation` | 服务端 | 在对话中生成/编辑图像 | `action`（generate/edit/auto）、`size`、`quality`、`output_format`、`background` |
| `computer_use_preview` | 服务端 | 图形界面操作（点击/输入） | 见《Computer Use 与浏览器操作 Agent》 |
| `local_shell` | 你的运行环境 | 本地命令行执行（Agent SDK 场景） | 由客户端提供沙箱 |
| `custom` / `namespace` / `programmatic_tool_calling` | 混合 | 自由文本工具、工具分组命名空间、程序化调用 | 见《Tool Use 实战：工具的定义、注入与调用》 |

三条共性：

1. **声明即可用**：所有托管工具都写进同一个 `tools` 数组，可与自定义 `function` 混用；`tool_choice` 默认 `auto`，也可 `"required"` 或指定某个工具。
2. **执行痕迹全在 `output` 里**：托管工具会往 `response.output` 里插入 `web_search_call`、`file_search_call`、`code_interpreter_call`、`mcp_call`、`image_generation_call` 等**输出项**，与最终的 `message` 交替出现。这些项既是调试线索，也是引用来源。
3. **成本与延迟换确定性**：省掉的往返以"服务端多做一轮工作"为代价——检索/执行的 token 会计入本次请求，延迟通常高于纯文本调用。计费口径以官方定价页为准，别照抄任何第三方文章里的数字。

## 二、web_search：一条请求完成联网检索

最简声明只有一行。不写 `filters`、`user_location` 时全部走默认值：

```python
from openai import OpenAI

client = OpenAI()  # API Key 从环境变量 OPENAI_API_KEY 读取（全站约定：Key 只放 .env / 环境变量）

response = client.responses.create(
    model="gpt-5.4",  # 或其他支持该工具的模型
    input="What's the latest news about AI?",
    tools=[{"type": "web_search"}],
)
```

响应的 `output` 里会出现两类输出项：先是 `web_search_call`（检索动作本身），随后是融合了检索结果的 `message`：

```text
[
  {
    "id": "ws_67bd64fe91f081919bec069ad65797f1",
    "status": "completed",
    "type": "web_search_call"
  },
  {
    "id": "msg_...",
    "content": [
      {
        "annotations": [
          {
            "title": "Huawei improves AI chip production in boost for China's tech goals",
            "type": "url_citation",
            "url": "https://www.ft.com/content/..."
          }
          // ……更多 url_citation 引用
        ],
        "text": "As of February 25, 2025, several significant developments ... ([ft.com](https://www.ft.com/content/...))",
        "type": "output_text"
      }
    ],
    "role": "assistant",
    "type": "message"
  }
]
```

（结构为 Cookbook 原始输出的节选。）注意 `annotations` 里每条 `url_citation` 都带标题与来源 URL——回答中的关键论断都有出处可查，这是托管检索相对"自己爬网页再塞进提示词"最实用的增值。

## 三、把参数用起来：域名白名单、检索深度、地理位置

`web_search` 工具对象支持四个参数（取自 SDK 生成的类型文档，比"只写 `{"type": "web_search"}`"多用例可控得多）：

```python
response = client.responses.create(
    model="gpt-5.4",
    input="近一个月关于固态电池量产的进展，只给我可核实的新闻",
    tools=[
        {
            "type": "web_search",
            # 1) 域名白名单：不填则全网可检索；填了之后其子域同样允许
            "filters": {"allowed_domains": ["reuters.com", "ft.com", "ieee.org"]},
            # 2) 检索深度：low / medium（默认）/ high，控制留给搜索结果占用的上下文空间
            "search_context_size": "high",
            # 3) 用户近似位置：本地化结果（天气、法规、营业时间）几乎必须要给
            "user_location": {
                "type": "approximate",   # 目前只有 approximate 一种
                "country": "CN",         # 两位 ISO 3166-1 国家码
                "region": "Shanghai",
                "city": "Shanghai",
                "timezone": "Asia/Shanghai",  # IANA 时区
            },
            # 4) 是否允许实时抓取外部网页：默认 true；设 false 时只用缓存，不取新内容
            "external_web_access": True,
        }
    ],
    # 可选：让响应额外带上检索到的来源列表
    include=["web_search_call.action.sources"],
)

print(response.output_text)
```

四个参数的取舍：

- `filters.allowed_domains`：**白名单而非安全边界**。它能显著降低"引用到内容农场"的概率，但不能防注入——检索到的网页正文仍可能包含诱导性指令，处理方式见《提示注入：最坏会发生什么？》。
- `search_context_size`：`low` 适合"只要个结论"的场景，省 token；`high` 适合综述与多源比对，代价是上下文被搜索结果占用、后续轮次更容易撞窗口上限。
- `user_location`：不给也能跑，但结果会偏离用户实际语境；注意这等于把用户城市/时区发给 API，合规上要按《Agent 安全与权限、生产化部署与成本管理》里的数据分级来评估。
- `include` 的取值是有限集合，写错会直接 400；除 `web_search_call.action.sources` 外常用的还有 `file_search_call.results`、`code_interpreter_call.outputs`。

## 四、多模态 + 托管工具：一条请求"看图 → 检索 → 引用"

这是本篇要完整展开的示例（其余篇章遇到时只引用此处，不再重复代码）。Cookbook 用它说明 Responses API 的复合价值：模型先看图、自己提炼关键词、再自动联网检索相关新闻、最后总结并给出来源——**一次 API 调用**，`input` 里同时给文本与图片，`tools` 里只声明 `web_search`：

```python
response_multimodal = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": (
                        "Come up with keywords related to the image, and search on the web "
                        "using the search tool for any news related to the keywords, "
                        "summarize the findings and cite the sources."
                    ),
                },
                {
                    "type": "input_image",
                    # 这里用公开图源演示；生产环境按《视觉理解与图像生成》一节改成本地 base64 或 file_id
                    "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Cat_August_2010-4.jpg/2880px-Cat_August_2010-4.jpg",
                },
            ],
        }
    ],
    tools=[{"type": "web_search"}],
)

# 检索项与回答项分别落在不同 output 项上，按类型取，不要按下标硬取
search_call = next(i for i in response_multimodal.output if i.type == "web_search_call")
message = next(i for i in response_multimodal.output if i.type == "message")
print("检索状态：", search_call.status)
print(message.content[0].text)
for ann in message.content[0].annotations:
    print("引用：", ann.title, ann.url)
```

原文的点评是：一条请求里完成了"看图 → 联网搜索 → 汇总引用"；同样的工作流若用 Chat Completions，需要应用自己执行工具调用、再把结果随新请求提交回来，来回多轮。**这段"按下标取 `output[1]`"的写法在跨模型场景很脆**：不同模型插入的输出项数量不同（推理项 `reasoning`、多工具时多个调用项），本站示例一律改成按 `item.type` 过滤。

## 五、该不该用托管工具：三条判断

1. **数据在谁手里**。数据本来就在 OpenAI 的文件/向量存储里（或你愿意上传）→ 托管；数据在你的业务库、需要 join 用户权限、需要 SQL 条件 → 自定义 `function`，把检索写成你自己的函数，权限模型留在应用侧。这条判断在《Tool Use 实战：工具的定义、注入与调用》里展开得更细。
2. **要不要控制检索过程**。托管工具把"检索什么、检索几次、返回几块"交给模型，好处是省代码，代价是**可观测性与可复现性下降**：同一问题两次调用可能检索到不同来源。要做检索质量评估、A/B 对比分块策略、换嵌入模型时，自建 RAG 管线更合适（《最小 RAG（Simple RAG）系统》《文档分块策略》）。
3. **能不能接受服务端的副作用**。联网检索会把查询词发给搜索引擎、代码解释器会在沙箱里执行模型写的代码、图像生成会产生产物并计费。这些副作用都在你之外发生，务必在读《Agent 安全与权限、生产化部署与成本管理》后再上线。

一句话：**托管工具是"用可控性换开发速度"**。原型期与知识问答类场景用它最划算；越靠近生产、越需要审计与调优，越要把每一步搬到自己能观测的地方。

## 六、常见坑

1. **把托管工具当"事实保证"**。`url_citation` 只证明模型看过那一页，不证明它转述正确；对高精度场景，把引用 URL 抓回来与回答做一致性校验（见《RAG 评估实战：用 RAGAS 量化检索与生成质量》）。
2. **以为"不声明工具就不会上网"**。模型会按提示词自行判断是否调用；需要强触发时给 `tool_choice="required"`（评估检索质量时特别有用，见《文件检索与代码解释器》）。
3. **只按下标读 `output`**。`output[0]` 可能是 `web_search_call` 也可能是 `reasoning`，多轮/多工具时顺序会变。
4. **忘记上下文预算**。检索结果会占满窗口，`truncation` 默认是 `disabled`——超长直接 400，而不是悄悄丢掉开头；显式设 `truncation="auto"` 才允许服务端丢最早的项。
5. **模型与端点支持面**。`web_search`（正式版）与 `web_search_preview` 是两种工具名，旧教程里混用；`web_search_2025_08_26` 是可锁定的版本化类型名，行为变更不追溯。Azure 一侧走 v1 端点时同样支持 Responses API 工具（见《模型版本与弃用管理》）。
6. **流式下的解析**。流式事件中检索过程以 `response.output_item.added` / `response.web_search_call.*` 等事件到达，文本增量走 `response.output_text.delta`，写法见《流式输出（SSE）》。

## 七、小结

- 托管工具 = 在 `tools` 里声明、服务端代为执行；输出项与最终 `message` 一起躺在 `response.output` 里；
- `web_search` 的最简写法是 `{"type": "web_search"}`，可调 `filters.allowed_domains`、`search_context_size`、`user_location`、`external_web_access`；
- `include=["web_search_call.action.sources"]` 能把检索到的来源一并取回；
- 图片输入 + 托管检索可以在一条请求里完成，这是 Responses API 相对 Chat Completions 的结构性差异；
- 花费由"模型 token"与"工具调用"两部分构成：`response.usage` 给出 token 侧，工具侧要按 `output` 里的调用项数量统计，完整做法见《生产可观测性：OpenTelemetry GenAI 语义约定与调用侧埋点》；
- 引用不等于正确，白名单不等于安全。

下一篇《文件检索与代码解释器：file_search 与 code_interpreter》继续讲两个"重"托管工具的完整落地。

---

> **来源**：抓取于 2026-09-19。本文整合翻译自 OpenAI Cookbook（MIT）[What is the Responses API?（responses_example.ipynb）](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb) 与 openai-python SDK（Apache 2.0）中由 OpenAPI 规范生成的类型定义与文档字符串：[responses/tool.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/tool.py)、[responses/web_search_tool.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/web_search_tool.py)、[responses/response_create_params.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_create_params.py)。作者 OpenAI，许可 MIT / Apache 2.0。原文示例模型为 gpt-4o / gpt-4o-mini，本站代码统一改用现行模型 `gpt-5.4`；`output` 下标取值改为按类型过滤，为本站编者改动。
