---
title: Responses API 托管工具：web_search、file_search、code_interpreter 与图像生成
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb
author: OpenAI Cookbook（responses_example、File_Search_Responses、introduction_to_deep_research_api、Generate_Images_With_GPT_Image）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: OpenAI Responses API（2026-09）；各 notebook 原文基于 gpt-4o 系 / o3-deep-research / gpt-image-1，概念与参数在当前版本仍然适用
order: 5
group: 工具与输出契约
---
上一篇 Function Calling 讲的是"自定义工具"：模型输出函数名与参数，**执行权在你手里**。Responses API 还提供另一类工具——**托管工具**（hosted tools，又称内置工具）：`web_search`（网页搜索）、`file_search`（文件/向量检索）、`code_interpreter`（代码执行）、图像生成等。对托管工具，你只需在请求的 `tools` 里声明，**API 会自己决定何时调用并代为执行**，再把结果融入回答——省去了"模型出调用、你执行、回传结果"的手工循环。

Cookbook《What is the Responses API》原文对此的概括是：Responses API 的一个关键收益就是支持 `file_search`、`web_search` 这类托管工具——不必手工调用工具，只要传入工具列表，API 会决定用哪个工具并直接使用它。

## web_search：一条请求完成联网检索

在请求里声明 `{"type": "web_search"}`，模型即可自主搜索网页作答（以下为 Cookbook 原示例）：

```python
response = client.responses.create(
    model="gpt-4o",  # 或其他支持的模型
    input="What's the latest news about AI?",
    tools=[
        {
            "type": "web_search"
        }
    ]
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
            "url": "https://www.ft.com/content/...",
          },
          ...  # 更多 url_citation 引用
        ],
        "text": "As of February 25, 2025, several significant developments ... ([ft.com](https://www.ft.com/content/...))\n...",
        "type": "output_text",
      }
    ],
    "role": "assistant",
    "type": "message"
  }
]
```

（输出为节选，保留结构与引用格式。）注意 `annotations` 里的每条 `url_citation` 都带标题与来源 URL——模型回答中的关键论断都有网页出处可查。

托管工具与多模态输入可以组合在**一条请求**里：模型先看图提取关键词，再自动联网检索相关新闻并总结、给出来源（Cookbook 的"猫图找新闻"示例，输入含 `input_image` 与文字指令，`tools` 仍只声明 `web_search`）：

```python
response_multimodal = client.responses.create(
    model="gpt-4o",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text":
                 "Come up with keywords related to the image, and search on the web using the search tool for any news related to the keywords"
                 ", summarize the findings and cite the sources."},
                {"type": "input_image", "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Cat_August_2010-4.jpg/2880px-Cat_August_2010-4.jpg"}
            ]
        }
    ],
    tools=[
        {"type": "web_search"}
    ]
)
```

原文的点评是：一条请求里完成了"看图 → 联网搜索 → 汇总引用"；同样的工作流若用 Chat Completions，需要应用自己执行工具调用、再把结果随新请求提交回来，来回多轮。

## file_search：开箱即用的 RAG

RAG 的传统路径相当繁琐：解析 PDF、设计分块策略、把文本块上传到存储、对文本块做嵌入、存进向量数据库——这只是**搭建**；在 LLM 工作流里检索内容又要好几步。

`file_search` 就是为此而来的 Responses API 托管工具：它让你直接检索自己的知识库，并基于检索内容生成回答。（原文注：file_search 此前在 Assistants API 上提供，现在迁移到了 Responses API——一个既可以有状态也可以无状态的 API，并新增了元数据过滤等特性。）

### 创建向量存储并上传 PDF

```python
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor
from tqdm import tqdm
import concurrent
import PyPDF2
import os

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
dir_pdfs = 'openai_blog_pdfs' # PDF 存放在本地该目录

def upload_single_pdf(file_path: str, vector_store_id: str):
    file_name = os.path.basename(file_path)
    try:
        file_response = client.files.create(file=open(file_path, 'rb'), purpose="assistants")
        attach_response = client.vector_stores.files.create(
            vector_store_id=vector_store_id,
            file_id=file_response.id
        )
        return {"file": file_name, "status": "success"}
    except Exception as e:
        print(f"Error with {file_name}: {str(e)}")
        return {"file": file_name, "status": "failed", "error": str(e)}

def upload_pdf_files_to_vector_store(vector_store_id: str):
    pdf_files = [os.path.join(dir_pdfs, f) for f in os.listdir(dir_pdfs)]
    stats = {"total_files": len(pdf_files), "successful_uploads": 0, "failed_uploads": 0, "errors": []}

    print(f"{len(pdf_files)} PDF files to process. Uploading in parallel...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(upload_single_pdf, file_path, vector_store_id): file_path for file_path in pdf_files}
        for future in tqdm(concurrent.futures.as_completed(futures), total=len(pdf_files)):
            result = future.result()
            if result["status"] == "success":
                stats["successful_uploads"] += 1
            else:
                stats["failed_uploads"] += 1
                stats["errors"].append(result)

    return stats

def create_vector_store(store_name: str) -> dict:
    try:
        vector_store = client.vector_stores.create(name=store_name)
        details = {
            "id": vector_store.id,
            "name": vector_store.name,
            "created_at": vector_store.created_at,
            "file_count": vector_store.file_counts.completed
        }
        print("Vector store created:", details)
        return details
    except Exception as e:
        print(f"Error creating vector store: {e}")
        return {}

store_name = "openai_blog_store"
vector_store_details = create_vector_store(store_name)
upload_pdf_files_to_vector_store(vector_store_details["id"])
```

原始输出：向量存储创建成功（`id: vs_67d0...`），21 个 PDF 并行上传，`{'total_files': 21, 'successful_uploads': 21, 'failed_uploads': 0, 'errors': []}`。

原文说明：OpenAI 会读取上传的 PDF，把内容切成文本块、对文本块做嵌入，并把嵌入与文本一起存进向量存储——之后即可查询这个向量存储、按查询返回相关内容。**解析、分块、嵌入、存储、检索全部由服务端托管。**

### 独立向量检索（不经过模型）

向量存储就绪后，可以绕开 LLM 直接查询，为某个 query 取回相关内容：

```python
query = "What's Deep Research?"
search_results = client.vector_stores.search(
    vector_store_id=vector_store_details['id'],
    query=query
)

for result in search_results.data:
    print(str(len(result.content[0].text)) + ' of character of content from ' + result.filename + ' with a relevant score of ' + str(result.score))
```

原始输出（节选）：返回若干大小不一的文本块，如 `3502 of character of content from Introducing deep research _ OpenAI.pdf with a relevant score of 0.9813588865322393`。原文解释：各文本块的相关性分数由使用**混合检索**（hybrid search）的排序器计算。

### 一次 API 调用把检索接进 LLM

比起"先查向量存储、再把数据塞进请求"，更省事的做法是把 `file_search` 工具直接挂进 Responses API：

```python
query = "What's Deep Research?"
response = client.responses.create(
    input= query,
    model="gpt-4o-mini",
    tools=[{
        "type": "file_search",
        "vector_store_ids": [vector_store_details['id']],
    }]
)

# 从响应中提取 annotations
annotations = response.output[1].content[0].annotations

# 取回被引用的文件名
retrieved_files = set([result.filename for result in annotations])

print(f'Files used: {retrieved_files}')
print('Response:')
print(response.output[1].content[0].text) # 下标 0 是 file_search 调用项
```

原始输出：`Files used: {'Introducing deep research _ OpenAI.pdf'}`，随后是基于该 PDF 内容对 Deep Research 的完整介绍（自主研究、多步推理、适用领域、带引用可核实、仍有局限五点）。`gpt-4o-mini` 就这样答对了一个需要较新专业知识的问题。

如果想进一步分析被检索的文本块，可在请求中加 `include=["output[*].file_search_call.search_results"]`，取回搜索引擎实际返回的内容。

### 评估检索质量

对这类信息检索系统，关键是要度量"答案所引用文件的相关性与质量"。Cookbook 演示了一套方法论：先自动生成评估集，再计算检索指标。原文提醒：这个做法并不完美——**始终建议为你的真实用例准备人工核验的评估集**——但它展示了方法。

**第一步：生成评估问题。** 逐个读取本地 PDF，让模型针对每个文档生成"只能由该文档回答"的问题：

```python
def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return text

def generate_questions(pdf_path):
    text = extract_text_from_pdf(pdf_path)

    prompt = (
        "Can you generate a question that can only be answered from this document?:\n"
        f"{text}\n\n"
    )

    response = client.responses.create(
        input=prompt,
        model="gpt-4o",
    )

    question = response.output[0].content[0].text

    return question
```

示例输出：`'What new capabilities will ChatGPT have as a result of the partnership between OpenAI and Schibsted Media Group?'`。对 21 个 PDF 循环后得到 `文件名: 问题` 字典。

**第二步：评估。** 把字典转成数据行，用 `gpt-4o-mini` 逐条查询（不提供文档本身），看期望文件是否被 `file_search` 检索回、排在第几：

```python
rows = []
for filename, query in questions_dict.items():
    rows.append({"query": query, "_id": filename.replace(".pdf", "")})

# 指标评估参数
k = 5
total_queries = len(rows)
correct_retrievals_at_k = 0
reciprocal_ranks = []
average_precisions = []

def process_query(row):
    query = row['query']
    expected_filename = row['_id'] + '.pdf'
    # 通过 Responses API 调用 file_search
    response = client.responses.create(
        input=query,
        model="gpt-4o-mini",
        tools=[{
            "type": "file_search",
            "vector_store_ids": [vector_store_details['id']],
            "max_num_results": k,
        }],
        tool_choice="required" # 强制触发 file_search；非必需，但既然测的就是检索，强制更合适
    )
    # 提取 annotations
    annotations = None
    if hasattr(response.output[1], 'content') and response.output[1].content:
        annotations = response.output[1].content[0].annotations
    elif hasattr(response.output[1], 'annotations'):
        annotations = response.output[1].annotations

    if annotations is None:
        print(f"No annotations for query: {query}")
        return False, 0, 0

    # top-k 命中的文件名
    retrieved_files = [result.filename for result in annotations[:k]]
    if expected_filename in retrieved_files:
        rank = retrieved_files.index(expected_filename) + 1
        rr = 1 / rank
        correct = True
    else:
        rr = 0
        correct = False

    # 计算 Average Precision
    precisions = []
    num_relevant = 0
    for i, fname in enumerate(retrieved_files):
        if fname == expected_filename:
            num_relevant += 1
            precisions.append(num_relevant / (i + 1))
    avg_precision = sum(precisions) / len(precisions) if precisions else 0

    if expected_filename not in retrieved_files:
        print("Expected file NOT found in the retrieved files!")

    return correct, rr, avg_precision
```

单例测试返回 `(True, 1.0, 1.0)`——命中且排第一，Recall/Precision 均为 1，MRR 与 MAP 也为 1。并发跑完全部问题后汇总：

```python
with ThreadPoolExecutor() as executor:
    results = list(tqdm(executor.map(process_query, rows), total=total_queries))

correct_retrievals_at_k = 0
reciprocal_ranks = []
average_precisions = []

for correct, rr, avg_precision in results:
    if correct:
        correct_retrievals_at_k += 1
    reciprocal_ranks.append(rr)
    average_precisions.append(avg_precision)

recall_at_k = correct_retrievals_at_k / total_queries
precision_at_k = recall_at_k  # 在此语境下与 recall 相同
mrr = sum(reciprocal_ranks) / total_queries
map_score = sum(average_precisions) / total_queries

print(f"Metrics at k={k}:")
print(f"Recall@{k}: {recall_at_k:.4f}")
print(f"Precision@{k}: {precision_at_k:.4f}")
print(f"Mean Reciprocal Rank (MRR): {mrr:.4f}")
print(f"Mean Average Precision (MAP): {map_score:.4f}")
```

原始结果：`Recall@5: 0.9048`、`Precision@5: 0.9048`、`MRR: 0.9048`、`MAP: 0.8954`。原文对失例的分析是：个别"泛化问题"（如"文档的使命是什么"）本就指向多份相近文档，自动评估集分不清该命中哪份——这正说明人工核验评估集的价值。

Cookbook 的收尾总结：本篇演示了如何用 `file_search` 工具把文件存储、嵌入、检索整合进一次 API 调用，简化 RAG 架构，并度量 Recall/Precision/MRR/MAP。

## code_interpreter 与 Deep Research 里的托管工具组合

`code_interpreter` 让模型在服务端沙箱里写代码、跑代码（解析数据、生成图表等）。Cookbook 的 Deep Research API 指南展示了托管工具的组合声明——`web_search_preview` 为必选工具，`code_interpreter` 可选，容器自动创建：

```python
response = client.responses.create(
  model="o3-deep-research",
  input=[...],  # developer 角色系统消息 + user 查询
  reasoning={
    "summary": "auto"
  },
  tools=[
    {
      "type": "web_search_preview"
    },
    {
      "type": "code_interpreter",
      "container": {
        "type": "auto",
        "file_ids": []
      }
    }
  ]
)
```

响应的 `output` 会暴露 Agent 的**全部中间步骤**，`type` 字段区分类型，可用于调试、分析与可视化最终答案是如何构造出来的：

```python
# 推理步骤：模型解决子问题时的内部摘要或计划
reasoning = next(item for item in response.output if item.type == "reasoning")
for s in reasoning.summary:
    print(s.text)

# 网页检索调用：能看到执行了哪些搜索查询，便于追溯信息来源
search = next(item for item in response.output if item.type == "web_search_call")
print("Query:", search.action["query"])
print("Status:", search.status)

# 代码执行：模型用了 code_interpreter（如解析数据或画图）时出现
code_step = next((item for item in response.output if item.type == "code_interpreter_call"), None)
if code_step:
    print(code_step.input)
    print(code_step.output)
else:
    print("No code execution steps found.")
```

原文说明：若模型使用了代码解释器，这些步骤会以 `code_interpreter_call` 或类似类型出现。Deep Research 的最终报告文本与行内引用仍从 `response.output[-1].content[0]` 中读取（引用注记含 `start_index`/`end_index`、标题与 URL）。

## 图像生成：gpt-image-1

Cookbook《Generate and edit images with GPT Image》介绍了 GPT Image——具备图像生成能力的大语言模型。它拥有世界知识、能借助对世界的广泛理解生成图像；相比上一代 DallE 2 和 3，**指令遵循**与**照片级真实感**都明显更强。

### 生成图像

```python
import base64
import os
from openai import OpenAI
from PIL import Image
from io import BytesIO
from IPython.display import Image as IPImage, display

client = OpenAI()

result1 = client.images.generate(
    model="gpt-image-1",
    prompt=prompt1,  # 详细的图像规格描述，如"半透明果冻状外星生物 Glorptak"的完整设定
    size="1024x1024"
)

image_base64 = result1.data[0].b64_json
image_bytes = base64.b64decode(image_base64)
image = Image.open(BytesIO(image_bytes))
image.save(img_path1, format="JPEG", quality=80, optimize=True)
```

### 自定义输出

原文列出的可定制项：

- **质量** `quality`：`low`、`medium`、`high` 或 `auto`（默认）；
- **尺寸** `size`：`1024x1024`（方形）、`1536x1024`（竖版）、`1024x1536`（横版）或 `auto`（默认）；
- JPEG 与 WEBP 格式可调压缩级别（0–100%）；
- 可用 `background` 属性请求**透明背景**（仅 PNG 或 WEBP）；另外，如果提示词里写明要透明背景，`background` 会默认设为 `transparent`。

```python
result2 = client.images.generate(
    model="gpt-image-1",
    prompt="generate a portrait, pixel-art style, of a grey tabby cat dressed as a blond woman on a dark background.",
    quality="low",
    output_compression=50,
    output_format="jpeg",
    size="1024x1536"
)
```

### 编辑图像与遮罩（mask）

GPT Image 也接受图像输入、据此生成新图。如果不希望模型改动输入图的某个部分，可以提供 mask。原文说明：**最多可用 10 张输入图**；若使用 mask，它会作用于 `image` 数组中的第一张图。

```python
prompt_edit = """
Combine the images of the cat and the hat to show the cat wearing the hat while being perched in a tree, still in pixel-art style.
"""

img1 = open(img_path2, "rb")
img2 = open(img_path3, "rb")

result_edit = client.images.edit(
    model="gpt-image-1",
    image=[img1,img2],
    prompt=prompt_edit,
    size="1024x1536"
)
```

使用 mask 时只编辑输入图未被遮罩覆盖的部分。两个注意事项（原文）：mask 需要包含 **alpha 通道**——手工制作（如用图像编辑软件）时务必确认；模型仍可能改动 mask 内的部分区域，只是会尽量避免。原文还演示了一个技巧：直接让模型自己生成 mask（"白色为角色、黑色为背景、尺寸与输入一致"），不够精确但对多数用途够用；需要精确 mask 时可用图像分割模型。

> **译注（按 2026-09 现状校订）**：上面图像生成一节使用的是 Images API（`client.images.generate` / `client.images.edit`）。同一 `gpt-image` 能力在 Responses API 中以托管工具 `image_generation` 的形式暴露：在 `tools` 中声明 `{"type": "image_generation"}` 后，模型可在多轮对话中按需生成/编辑图像并与文本推理交织——与 `web_search` 一样由服务端代为执行。工具参数以现行 [API 参考](https://platform.openai.com/docs/api-reference/responses)为准。

## 表：自定义 function 工具 vs 托管工具

| 维度 | 自定义 function（《Function Calling / Tool Use：让模型调用你的函数》） | 托管工具（本篇） |
| --- | --- | --- |
| 声明方式 | `{"type":"function","name":...,"parameters":...}` | `{"type":"web_search"}` 等，按工具名声明 |
| 执行者 | 你（执行函数、回传结果） | 服务端自动执行 |
| 输出项 | `function_call` / `function_call_output` 往返 | `web_search_call`、`file_search` 注记、`code_interpreter_call` 等 |
| 典型用途 | 接你自己的业务逻辑与私有数据 | 联网检索、知识库 RAG、沙箱计算、生图 |

## 小结

- 托管工具把"检索、执行、生成"下沉到服务端：`tools` 里声明即可，无须手工调用循环；
- `web_search` 一条请求完成联网检索并返回 `url_citation` 引用；可与图像输入组合；
- `file_search` = 开箱即用 RAG：上传文件建向量存储，可独立检索（`vector_stores.search`，混合检索排序），也可挂进 Responses API 一次调用；用"自动生成问题 + Recall@k/MRR/MAP"评估检索质量，但最终要靠人工核验的评估集；
- `code_interpreter` 提供服务端代码执行，输出流中的 `code_interpreter_call` 等中间步骤可追溯；
- 图像生成（gpt-image）支持详细指令、质量/尺寸/压缩/透明背景定制与多图 + mask 编辑，在 Responses API 中以 `image_generation` 工具暴露。

---

> **来源**：本文整合翻译自 OpenAI Cookbook（MIT）的四篇 notebook：[responses_example.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb)（Responses API 与托管工具、web_search）、[File_Search_Responses.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/File_Search_Responses.ipynb)（file_search 全流程与评估）、[introduction_to_deep_research_api.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/deep_research_api/introduction_to_deep_research_api.ipynb)（code_interpreter 与中间步骤解析）、[Generate_Images_With_GPT_Image.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Generate_Images_With_GPT_Image.ipynb)（gpt-image 生成与编辑）。作者 OpenAI，许可 MIT。抓取于 2026-09-13。

---

> **编译说明**：四篇 notebook 原文各成一体，本篇按"托管工具"主线整合，除"译注"标明的校订外均为原文内容；超长模型输出以节选呈现并标注，代码与结论未删减。自定义工具与托管工具的分工对照表为本站整理。
