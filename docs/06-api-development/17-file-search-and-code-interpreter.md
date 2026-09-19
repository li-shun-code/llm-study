---
title: 文件检索与代码解释器：file_search 与 code_interpreter
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/File_Search_Responses.ipynb
author: OpenAI Cookbook（File_Search_Responses、introduction_to_deep_research_api）
license: MIT
fetched_at: 2026-09-19
translated: true
versions: OpenAI Responses API（2026-09）；示例模型 gpt-5.4 / gpt-5.4-mini；文件上传 purpose 用 user_data；file_search 参数按 SDK 类型定义核实
order: 17
group: 工具与输出契约
---
《Responses API 托管工具总览与 web_search》把托管工具的共性讲完了：声明在 `tools` 里、服务端执行、痕迹落在 `output` 里。那篇没展开的两个"重"工具本篇补齐——`file_search`（把文件交给 OpenAI 托管，得到一套开箱即用的 RAG）与 `code_interpreter`（把 Python 沙箱交给模型用）。它们的共同点是：**都要先准备数据，再决定"给模型多大的自主权"**，所以参数比 `web_search` 多得多。

## 一、file_search：开箱即用的 RAG

RAG 的传统路径相当繁琐：解析 PDF、设计分块策略、把文本块上传到存储、对文本块做嵌入、存进向量数据库——这只是**搭建**；在 LLM 工作流里检索内容又要好几步。

`file_search` 就是为此而来：你上传文件、建一个向量存储（vector store），剩下的解析、分块、嵌入、存储、混合检索、重排全部由服务端托管。（原文注：`file_search` 此前在 Assistants API 上提供，现已迁到 Responses API，并新增了元数据过滤等特性。）

### 1. 上传文件并建向量存储

一个容易踩的时效坑：`client.files.create()` 的 `purpose` 参数。**`purpose="assistants"` 已随 Assistants API 一并废弃**——Cookbook 的旧 notebook 里还能看到它。现行取值以 SDK 的 `FilePurpose` 类型定义为准：`batch` / `fine-tune` / `vision` / `user_data` / `evals`，其中 **`user_data` 是"给 file_search 等场景用的通用类型"**。注意 SDK 的字面量联合类型里为了向后兼容仍留着 `"assistants"` 这一项，能被类型检查通过，但**新代码不要传它**——它服务的那个 API 已经下线了。上传限额也记一下：单文件 512 MB，每项目总计 2.5 TB；`purpose="batch"` 的文件默认 30 天后过期，其余存到显式删除为止。

```python
from openai import OpenAI
import concurrent.futures
import os

client = OpenAI()  # Key 从环境变量读取，见《第一个 API 调用》
dir_pdfs = "openai_blog_pdfs"  # PDF 存放在本地该目录


def upload_single_pdf(file_path: str, vector_store_id: str):
    file_name = os.path.basename(file_path)
    try:
        # purpose 用 user_data（旧教程里的 assistants 已废弃）
        file_response = client.files.create(file=open(file_path, "rb"), purpose="user_data")
        client.vector_stores.files.create(
            vector_store_id=vector_store_id,
            file_id=file_response.id,
        )
        return {"file": file_name, "status": "success"}
    except Exception as e:
        print(f"Error with {file_name}: {e}")
        return {"file": file_name, "status": "failed", "error": str(e)}


def create_vector_store(store_name: str) -> dict:
    # 不传 expires_after 时，向量存储会一直保留；有生命周期的知识库建议显式设过期
    vs = client.vector_stores.create(name=store_name)
    print("Vector store created:", vs.id, vs.name, vs.file_counts.completed)
    return {"id": vs.id, "name": vs.name}


vector_store_details = create_vector_store("openai_blog_store")

pdf_files = [os.path.join(dir_pdfs, f) for f in os.listdir(dir_pdfs)]
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
    results = list(executor.map(upload_single_pdf, pdf_files, [vector_store_details["id"]] * len(pdf_files)))

ok = sum(r["status"] == "success" for r in results)
print(f"{len(pdf_files)} 个文件，成功 {ok} 个")
```

原文说明：OpenAI 会读取上传的 PDF，把内容切成文本块、对文本块做嵌入，并把嵌入与文本一起存进向量存储——之后即可查询这个向量存储、按查询返回相关内容。**解析、分块、嵌入、存储、检索全部由服务端托管。**

### 2. 独立检索（不经过模型）

向量存储就绪后，可以绕开 LLM 直接查询，先确认检索质量再谈生成：

```python
query = "What's Deep Research?"
search_results = client.vector_stores.search(
    vector_store_id=vector_store_details["id"],
    query=query,
)

for result in search_results.data:
    print(len(result.content[0].text), "字符，来自", result.filename, "score =", result.score)
```

原文解释：相关性分数由使用**混合检索**（hybrid search，词法 + 向量）的排序器计算；这与本站《混合检索：BM25 词法检索 + 向量语义检索》讲的是同一件事，只是托管实现替你装配好了。

### 3. 一次调用把检索接进模型

比起"先查向量存储、再把数据塞进请求"，更省事的做法是把 `file_search` 直接挂进 Responses API：

```python
response = client.responses.create(
    model="gpt-5.4",
    input=query,
    tools=[
        {
            "type": "file_search",
            "vector_store_ids": [vector_store_details["id"]],
            "max_num_results": 5,           # 1–50
            "filters": {                    # 元数据过滤：建库时给文件打标签，这里按标签筛
                "type": "and",              # 组合器只有 and / or 两种
                "filters": [
                    {"type": "ne", "key": "/metadata/status", "value": "archived"},
                    {"type": "in", "key": "/metadata/team", "value": ["platform", "research"]},
                ],
            },
            "ranking_options": {
                "score_threshold": 0.5,     # 0–1，越高越严；配合 hybrid_search 可调嵌入/词法权重
                "hybrid_search": {"embedding_weight": 0.6, "text_weight": 0.4},
            },
        }
    ],
)

message = next(i for i in response.output if i.type == "message")
print("引用文件：", {a.filename for a in message.content[0].annotations})
print(message.content[0].text)
```

想进一步分析"搜索引擎实际返回了哪些文本块"，在请求里加 `include=["file_search_call.results"]`（本文示例用 `include=["output[*].file_search_call.search_results"]` 亦可，两种写法都在原文出现过，以后者为准）。

**表：file_search 工具参数（按 SDK 类型定义整理）**

| 参数 | 取值 | 作用 |
| --- | --- | --- |
| `vector_store_ids` | 必填，可多个 | 检索哪些向量存储 |
| `max_num_results` | 1–50，默认由服务端定 | 返回文本块数上限，直接影响 token 与延迟 |
| `filters` | 比较过滤器（`eq`/`ne`/`gt`/`gte`/`lt`/`lte`/`in`/`nin`）与 `and`/`or` 组合 | 按文件元数据收窄检索范围 |
| `ranking_options.score_threshold` | 0–1 | 相关性下限，宁缺毋滥 |
| `ranking_options.ranker` | `auto` / `default-2024-11-15` | 排序器版本，锁定行为用后者 |
| `ranking_options.hybrid_search` | `embedding_weight` / `text_weight` | 混合检索里语义与词法的权重 |

### 4. 评估检索质量（ Cookbook 的方法论）

对这类信息检索系统，关键度量是"答案所引用文件的相关性与质量"。原文给了个可复制的做法：先从文档自动生成评估集，再算检索指标。**原文自己先声明了局限：这并不完美——始终建议为你的真实用例准备人工核验的评估集。**

**第一步：生成评估问题。** 逐个读取本地 PDF（这里用 `pypdf`，`pip install pypdf tqdm`），让模型针对每个文档生成"只能由该文档回答"的问题：

```python
from pypdf import PdfReader


def extract_text_from_pdf(pdf_path):
    return "".join((page.extract_text() or "") for page in PdfReader(pdf_path).pages)


def generate_question(pdf_path):
    resp = client.responses.create(
        model="gpt-5.4",
        input=f"Can you generate a question that can only be answered from this document?:\n{extract_text_from_pdf(pdf_path)}\n\n",
    )
    return resp.output_text


questions = {f: generate_question(os.path.join(dir_pdfs, f)) for f in os.listdir(dir_pdfs)}
```

**第二步：批量查询并算指标。** 把"问题 → 期望文件"转成数据行，逐条查询（不提供文档本身），看期望文件是否被检索回、排在第几：

```python
rows = [{"query": q, "_id": name.replace(".pdf", "")} for name, q in questions.items()]
k = 5


def process_query(row):
    response = client.responses.create(
        model="gpt-5.4-mini",
        input=row["query"],
        tools=[{
            "type": "file_search",
            "vector_store_ids": [vector_store_details["id"]],
            "max_num_results": k,
        }],
        tool_choice="required",  # 测的就是检索，强制触发更合适
    )
    message = next((i for i in response.output if i.type == "message"), None)
    annotations = message.content[0].annotations if message else []
    retrieved = [a.filename for a in annotations][:k]
    expected = row["_id"] + ".pdf"
    hit = expected in retrieved
    rr = 1 / (retrieved.index(expected) + 1) if hit else 0

    # Average Precision：逐个命中位置算 precision，再取平均
    hits, precisions = 0, []
    for i, fname in enumerate(retrieved):
        if fname == expected:
            hits += 1
            precisions.append(hits / (i + 1))
    ap = sum(precisions) / len(precisions) if precisions else 0
    return hit, rr, ap


with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
    results = list(executor.map(process_query, rows))

total = len(rows)
print(f"Recall@{k}: {sum(r[0] for r in results) / total:.4f}")
print(f"MRR: {sum(r[1] for r in results) / total:.4f}")
print(f"MAP: {sum(r[2] for r in results) / total:.4f}")
```

原文 21 份 PDF 的结果是 `Recall@5: 0.9048`、`Precision@5: 0.9048`、`MRR: 0.9048`、`MAP: 0.8954`；对失例的分析是：个别"泛化问题"（如"这份文档的使命是什么"）本就指向多份相近文档，自动评估集分不清该命中哪份——这正说明人工核验评估集的价值。指标定义、分层归因与 RAGAS 的一整套做法见《RAG 评估实战：用 RAGAS 量化检索与生成质量》，本篇只演示托管工具下的最小闭环。

`file_search` 与自建 RAG 的分工，可以用一句话收束：**它替你做完的那五步（解析、分块、嵌入、存储、混合检索），恰好是自建方案里最难做好、又最难做出差异化的部分**；而它做不了的那三件事（跨库 join、自定义分块与嵌入、原文不出内网），恰好是自建方案存在的理由。把这条线画清楚，选型就不再是"哪个更强"的问题，而是"我的瓶颈在哪一层"的问题。

## 二、code_interpreter：把沙箱交给模型

`code_interpreter` 让模型在服务端沙箱里写代码、跑代码（解析数据、做统计、生成图表）。声明时通常配 `container`：`type="auto"` 由服务端创建临时容器，`memory_limit` 可选 `1g`/`4g`/`16g`/`64g`，`file_ids` 把已上传文件预置进容器。

```python
with open("sales_2026_q1.csv", "rb") as f:
    uploaded = client.files.create(file=f, purpose="user_data")

response = client.responses.create(
    model="gpt-5.4",
    input="这份销售 CSV 里哪个区域环比增长最快？给出计算过程与一张折线图。",
    tools=[
        {
            "type": "code_interpreter",
            "container": {"type": "auto", "memory_limit": "4g", "file_ids": [uploaded.id]},
        }
    ],
    include=["code_interpreter_call.outputs"],  # 把沙箱的 stdout 一并取回，便于复盘
)

for item in response.output:
    if item.type == "code_interpreter_call":
        print("执行代码：\n", item.code)
        print("输出：", getattr(item, "outputs", None))
print(response.output_text)
```

与 `web_search` 一样，`code_interpreter` 可与托管检索、自定义 function **组合声明**。Cookbook 的 Deep Research API 指南就是一个三工具组合：`web_search_preview` 为必选、`code_interpreter` 可选，`reasoning={"summary": "auto"}` 让模型给出推理摘要：

```python
response = client.responses.create(
    model="gpt-5.4",  # 原文用 o3-deep-research，属专用研究模型
    input=[
        {"role": "developer", "content": "你是严谨的研究助理。"},
        {"role": "user", "content": "调研 2026 年主流向量数据库的部署形态与成本结构，输出带引用的报告"},
    ],
    reasoning={"summary": "auto"},
    tools=[
        {"type": "web_search_preview"},
        {"type": "code_interpreter", "container": {"type": "auto", "file_ids": []}},
    ],
)
```

响应的 `output` 会暴露 Agent 的**全部中间步骤**，`type` 字段区分类型——这正是调试"答案是怎么拼出来的"的第一手材料：

```python
reasoning = next(i for i in response.output if i.type == "reasoning")
for s in reasoning.summary:
    print(s.text)

search = next(i for i in response.output if i.type == "web_search_call")
print("检索词：", search.action["query"], "| 状态：", search.status)

code_step = next((i for i in response.output if i.type == "code_interpreter_call"), None)
print(code_step.code if code_step else "本次没有代码执行步骤")
```

最终报告文本与行内引用仍从最后一条 `message` 读取（引用注记含 `start_index`/`end_index`、标题与 URL）。

## 三、file_search 的边界：什么时候不该用它

托管 RAG 很省心，但有三类场景它接不住，越早识别越好：

1. **需要 join 业务数据**。"只检索这位客户有权看的那 3 份合同"这类需求，靠元数据过滤能做一部分（`filters` 支持按 `/metadata/*` 比较），但一旦权限要查你自己的用户表、角色表，正确做法是在应用侧算出可见文件 ID 再检索，或者干脆自建管线用 `WHERE` 收敛（《PostgreSQL 单库混合检索：全文 + pgvector 融合重排》）。
2. **对分块与嵌入有主张**。托管实现替你决定了解析器、分块策略与嵌入模型，收益是零配置，损失是你**无法**替换成中文更强的嵌入模型或按段落语义切分。要精调这些，请回到自建路线：《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《Embedding 模型选型实战（中文优先）》。
3. **合规不允许把原文交给外部存储**。向量存储里存的是你文件的解析文本与向量，删除即不可用；若数据分级要求原文不出内网，只能自建，或用兼容端点把同一套工具协议指向自己的服务（《OpenAI 兼容端点与 LiteLLM》）。

反过来，**文档问答、内部知识库、客服资料检索这类"低频更新、中等规模、要引用出处"的场景**，`file_search` 往往比自建 RAG 上线快一个数量级——先用它把产品跑起来，再决定要不要下沉。

> 迁移提示：Chat Completions 一侧没有 `file_search`。旧代码若依赖 Assistants API 的 `file_search`，迁移路径是"上传文件（`purpose="user_data"`）→ 建 vector store → 改用 Responses API 挂 `file_search`"，会话状态则从 thread 换成 `previous_response_id`（《消息角色与多轮会话管理》）。

## 四、常见坑

1. **`purpose="assistants"` 已废弃**：上传给 `file_search` 的文件用 `user_data`；批量推理用 `batch`，微调用 `fine-tune`，视觉微调图片用 `vision`。
2. **忘了删除文件与向量存储**：`client.files.delete(file_id)`、`client.vector_stores.delete(vector_store_id)`；不清理会一直占额度并计入成本。托管向量存储适合起步与中小知识库，数据敏感或需要自定义分块/嵌入时改自建方案（《Chroma 与 Qdrant 单库实战》《Milvus 与 pgvector 实战》）。
3. **`score_threshold` 设太高导致"查无结果"**：宁可用 `max_num_results` 多召回、由模型自己判断相关性。
4. **沙箱不是安全边界**。`code_interpreter` 在服务端隔离环境执行，但"能跑代码"意味着模型可以把不可信网页/文档里的内容当输入；不要用它执行用户提交的代码，也不要把沙箱输出直接当权限凭证。
5. **容器生命周期**。`container` 用 `type="auto"` 时容器与本次响应对应，跨轮次复用需要显式管理容器 ID；大文件、大内存任务要提前估 `memory_limit`。
6. **强制工具调用与体验冲突**：`tool_choice="required"` 适合离线评估，线上会让"随便聊聊"也付出检索延迟。

## 五、小结

- `file_search` 把"上传 → 解析 → 分块 → 嵌入 → 混合检索 → 引用"整条链路收进两次 API 调用；`purpose` 用 `user_data`，参数看 `max_num_results` / `filters` / `ranking_options`；
- 检索质量用"自动出题 + Recall@k / MRR / MAP"能起量，但最终必须回到人工核验的评估集；
- `code_interpreter` 交出沙箱：`container.file_ids` 预置数据、`include` 取回输出、`output` 里的 `code_interpreter_call` 是最诚实的调试线索；
- 两者都能与 `web_search`、自定义 function 混在同一个 `tools` 数组里，这正是 Responses API 编排能力的来源。

---

> **来源**：抓取于 2026-09-19。本文整合翻译自 OpenAI Cookbook（MIT）两篇 notebook：[File_Search_Responses.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/File_Search_Responses.ipynb)（file_search 上传、独立检索、挂进 Responses、检索指标评估）与 [introduction_to_deep_research_api.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/deep_research_api/introduction_to_deep_research_api.ipynb)（托管工具组合与中间步骤解析），作者 OpenAI，许可 MIT。工具参数、`purpose` 取值与文件限额按 openai-python SDK（Apache 2.0）生成的类型定义与文档字符串校订：[responses/file_search_tool.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/file_search_tool.py)、[types/file_purpose.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/file_purpose.py)、[resources/files.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/resources/files.py)。原文示例模型 gpt-4o / gpt-4o-mini 已改为 `gpt-5.4` / `gpt-5.4-mini`，原文的 `purpose="assistants"` 已改为现行的 `user_data`，PDF 读取由 `PyPDF2` 改为仍维护中的 `pypdf`；`output` 下标取值改为按 `item.type` 过滤，为本站编者改动。
