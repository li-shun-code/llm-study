---
title: 视觉理解与图像生成：把图片喂给多模态模型，也让它画图
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/multimodal/document_and_multimodal_understanding_tips.ipynb
author: OpenAI Cookbook（Getting the Most out of GPT-5.4 for Vision and Document Understanding、Tag and caption images with GPT-4o mini、Generate and edit images with GPT Image）、OpenAI（openai-python README · Vision）
license: MIT / Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: openai-python 2026-09 最新稳定版；示例模型 gpt-5.4 / gpt-5.5；input_image detail 取 auto|original，input_file detail 取 auto|low|high；图像生成模型 gpt-image-1
order: 11
group: 多模态与向量能力
---
多模态模型可以直接"看图"：给消息里加一个图片内容块，模型就能回答图里有什么、给商品打标签、读图表、把手写表单抽成 JSON。上一篇《Embedding API 与文本相似度》解决的是"文本怎么变成向量"，本篇解决"**图像与文档怎么变成模型能推理的输入**"，并顺带收下半篇图像生成（`gpt-image`）——读图与画图是同一套内容块协议的两端。

站内《多模态提示》一篇（提示工程方向）与本篇同源，讲的是提示词侧的写法；本篇承接它的调用与调参实操，把 `detail`、`verbosity`、`reasoning.effort`、工具使用四个杠杆落到可运行代码上。

## 一、三种把图像/文档送进模型的方式

**方式一：图片 URL**（Responses API 的 `input_image` 内容块）：

```python
from openai import OpenAI

client = OpenAI()  # Key 从环境变量读取：.env 里放 OPENAI_API_KEY，这是全站约定

prompt = "What is in this image?"
img_url = "https://api.nga.gov/iiif/a2e6da57-3cd1-4235-b20e-95dcaefed6c8/full/!800,800/0/default.jpg"

response = client.responses.create(
    model="gpt-5.5",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": img_url},
            ],
        }
    ],
)
print(response.output_text)
```

**方式二：base64 data URL**（图片在本地、或不想暴露公网 URL 时）——文档类任务几乎都用这条，因为它可复现：

```python
import base64
import mimetypes
from pathlib import Path


def image_to_data_url(image_path: str | Path) -> str:
    """把本地图片编码成 data URL；MIME 类型按扩展名猜，猜不到退回 png。"""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {path}")
    mime_type = mimetypes.guess_type(path.name)[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"
```

**方式三：先上传、再按 ID 引用**（PDF 与多图复用、或要给沙箱用）。上传走 Files API，`purpose` 用现行的 `user_data`（`assistants` 已废弃）；文档用 `input_file` 内容块：

```python
with open("invoice.pdf", "rb") as f:
    uploaded = client.files.create(file=f, purpose="user_data")

response = client.responses.create(
    model="gpt-5.5",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "把这张发票的金额、税额、开票日期抽成 JSON。"},
                {"type": "input_file", "file_id": uploaded.id},
            ],
        }
    ],
)
```

一条消息里放**多张图**就是多加几个 `input_image` 块；文字块与图片块顺序可自由组合。Chat Completions 一侧的对应写法是 `image_url` 内容块（`{"type": "image_url", "image_url": {"url": ...}}`），本站示例统一走 Responses API。

## 二、四个调参杠杆：detail / verbosity / reasoning / tools

原生视觉模型的效果差异，很大程度不来自提示词措辞，而来自这四个请求参数。下表是 cookbook 给出的决策口径，值得贴在手边：

**表：视觉与文档任务的四个杠杆**

| 任务特征 | 怎么调 | 为什么 |
| --- | --- | --- |
| 普通文档问答/抽取 | `detail="auto"` | 默认档，摩擦最小 |
| 密集扫描、截图、手写、极小字号 | `detail="original"` | 保住下采样时最先丢掉的细节 |
| 逐字转录 / 转 Markdown | `text={"verbosity": "high"}` | 抑制"压缩式改写"，保留版式 |
| 图表、表格、户型图这类**组合式**推理 | `reasoning={"effort": "high"}` 甚至 `"xhigh"` | 看得清之后缺的是"把多处信息串起来"的算力 |
| 需要反复放大、裁剪、旋转着看 | 挂 `code_interpreter` | 模拟人的多轮目视检查 |
| 要输出坐标框 | 约定 `[x_min,y_min,x_max,y_max]` + `0..999` 归一化 + 结构化输出 | 便于裁剪、画框、下游系统消费 |

注意 `detail` 的取值分两类：`input_image` 现行文档示例用 `auto`（默认）与 `original`（保留原始分辨率）；`input_file`（PDF 等）的 `detail` 是 `auto`/`low`/`high`，且 **GPT-5.6 及以后模型下 `auto` 会走高质量渲染，直接抬高输入 token**——这是"质量/成本"权衡最直观的一处。

## 三、四个可运行示例

### 1. 手写表单 → 结构化 JSON

原始示例故意包含字号很小的邮箱、电话栏——正是下采样时最先劣化的字段：

```python
import json

handwriting_prompt = """
Read the handwritten earthquake insurance application and return JSON with these keys:
- applicant_name / applicant_email / applicant_home_phone / applicant_cell_phone
- co_applicant_name / co_applicant_email / co_applicant_home_phone / co_applicant_work_phone
- effective_date / expiration_date / dwelling_coverage_limit_usd / square_footage / year_of_construction
"""

response = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": handwriting_prompt},
                {
                    "type": "input_image",
                    "image_url": image_to_data_url("3C_insurance_form.png"),
                    "detail": "original",
                },
            ],
        }
    ],
    text={"format": {"type": "json_object"}},  # Responses 侧的 JSON Mode 写法
)
result = json.loads(response.output_text)
```

### 2. 忠实转录：把 verbosity 拉高

多模态模型做转录时倾向压缩版式——保语义但简化空白、换行与表格结构。问答场景是优点，OCR 场景是缺陷：

```python
response = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": "Transcribe everything in the Ticket To The Arts section. "
                            "Do not summarize or paraphrase. Do not add any additional text.",
                },
                {"type": "input_image", "image_url": image_to_data_url("newspaper.png"), "detail": "original"},
            ],
        }
    ],
    text={"verbosity": "high"},
)
```

### 3. 图表与户型图：瓶颈在推理不在感知

图像已经看得清了，答案却要跨多个区域组合——这类任务提高 `reasoning.effort` 比提高 `detail` 更有效：

```python
floorplan_prompt = """
Inspect this apartment floorplan and return JSON with these keys:
- total_named_rooms_excluding_hallways_and_closets
- largest_room
- room_immediately_east_of_kitchen
- room_immediately_south_of_study
- bedroom_1_total_area_ft2 / bedroom_2_total_area_ft2
Rules:
- 只使用图上可见的房间标签与尺寸标注；数值字段返回整数；Return JSON only.
"""

response = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": floorplan_prompt},
                {"type": "input_image", "image_url": image_to_data_url("apartment_floorplan.png"), "detail": "original"},
            ],
        }
    ],
    reasoning={"effort": "high"},
    text={"format": {"type": "json_object"}},
)
```

同一模式适用于折线图（"哪个渠道环比增长最快"要比较多条曲线）、对阵表（要顺着密集连线追冠军）——原文的总结很实用：**读不清 → 调 `detail`；读得清但答不对 → 调 `reasoning.effort`**。

### 4. 目标定位：坐标契约 + 沙箱 + strict schema

要模型给出"车牌在图里的哪个位置"，三件事一起做：给 `code_interpreter` 让它能放大细看、给死坐标契约、用 strict JSON Schema 约束形状。

```python
bbox_schema = {
    "type": "object",
    "properties": {
        "b": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "label": {"type": "string", "enum": ["vehicle_1_license_plate", "vehicle_2_license_plate"]},
                    "bbox": {"type": "array", "items": {"type": "integer", "minimum": 0, "maximum": 999},
                             "minItems": 4, "maxItems": 4},
                },
                "required": ["label", "bbox"],
                "additionalProperties": False,
            },
            "minItems": 2,
            "maxItems": 2,
        }
    },
    "required": ["b"],
    "additionalProperties": False,
}

with open("police_form.png", "rb") as f:
    uploaded = client.files.create(file=f, purpose="user_data")

response = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {
                    "type": "input_text",
                    "text": (
                        "Find the license plate number for Vehicle 1 and Vehicle 2 in this police report form. "
                        "It is written after License # and is a 7-digit number. Do not guess or infer.\n"
                        "Return JSON with this schema: {\"b\":[{\"label\":...,\"bbox\":[x_min,y_min,x_max,y_max]}, ...]}\n"
                        "Use discrete normalized coordinates between 0 and 999. Return JSON only."
                    ),
                },
                {"type": "input_image", "image_url": image_to_data_url("police_form.png"), "detail": "original"},
            ],
        }
    ],
    reasoning={"effort": "high"},
    text={"format": {"type": "json_schema", "name": "plate_bboxes", "schema": bbox_schema, "strict": True}},
    instructions=(
        "You are an expert document analyst. Use Code Interpreter before answering. "
        "Inspect the uploaded file, crop or zoom if needed, then answer in JSON."
    ),
    tools=[{
        "type": "code_interpreter",
        "container": {"type": "auto", "memory_limit": "4g", "file_ids": [uploaded.id]},
    }],
)

boxes = json.loads(response.output_text)["b"]
```

**关键细节**：坐标契约必须写死"归一化到 0–999、左上角为原点"。否则同一个模型会在"像素坐标 / 0–1 浮点 / 0–1000 整数"之间摇摆，下游裁剪全乱。把结果画回原图只要一行换算：

```python
from PIL import Image, ImageDraw

img = Image.open("police_form.png").convert("RGB")
w, h = img.size
draw = ImageDraw.Draw(img)
for item in boxes:
    x1, y1, x2, y2 = item["bbox"]
    draw.rectangle(
        [round(x1 * (w - 1) / 999), round(y1 * (h - 1) / 999),
         round(x2 * (w - 1) / 999), round(y2 * (h - 1) / 999)],
        outline="red", width=4,
    )
img.save("annotated.png")
```

### 5. 拿不到沙箱时：本地裁剪 + 二次调用

受限环境里不该为了效果随手放开代码沙箱。可行的替代是两段式：**先定位 → 本地裁剪 → 只把裁剪块喂给第二次调用**。原文的判断是：这样能找回多轮目视检查的大部分收益，同时把控制面压到最小。

```python
target = next(i for i in boxes if i["label"] == "vehicle_2_license_plate")
x1, y1, x2, y2 = target["bbox"]
pad = 0.18  # 留 18% 边距，避免把字符切边
crop = img.crop((
    max(0, int(x1 * (w - 1) / 999) - int((x2 - x1) * pad)),
    max(0, int(y1 * (h - 1) / 999) - int((y2 - y1) * pad)),
    min(w, int(x2 * (w - 1) / 999) + int((x2 - x1) * pad)),
    min(h, int(y2 * (h - 1) / 999) + int((y2 - y1) * pad)),
))
crop.save("crop.png")

second = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "Read the license number value in this cropped region. Return JSON only: {\"license_number\": ...}"},
                {"type": "input_image", "image_url": image_to_data_url("crop.png"), "detail": "original"},
            ],
        }
    ],
    text={"format": {"type": "json_schema", "name": "license_number_extraction",
                     "schema": {"type": "object", "properties": {"license_number": {"type": "string"}},
                              "required": ["license_number"], "additionalProperties": False},
                     "strict": True}},
)
```

## 四、经典实战：给商品图打关键词标签

Cookbook 的完整案例用多模态模型为家具数据集打标签。核心提示词技巧：**图片 + 商品标题一起给，并限定只描述标题所指的那件商品**（场景图里常常同时出现多件物品）：

```python
system_prompt = """
You are an agent specialized in tagging images of furniture items, decorative items,
or furnishings with relevant keywords that could be used to search for these items
on a marketplace.
You will be provided with an image and the title of the item that is depicted in the
image, and your goal is to extract keywords for only the item specified.
Keywords should be concise and in lower case, and can describe:
- Item type e.g. 'sofa bed', 'chair', 'desk', 'plant'
- Item material e.g. 'wood', 'metal', 'fabric'
- Item style e.g. 'scandinavian', 'vintage', 'industrial'
- Item color e.g. 'red', 'blue', 'white'
Only deduce material, style or color keywords when it is obvious that they make
the item depicted in the image stand out.
Return keywords in the format of an array of strings, like this: ['desk', 'industrial', 'metal']
"""


def analyze_image(img_url: str, title: str) -> str:
    response = client.responses.create(
        model="gpt-5.4-mini",  # 打标是批量任务，选轻量档；输出上限用 max_output_tokens
        instructions=system_prompt,
        input=[
            {"type": "input_image", "image_url": img_url},
            {"type": "input_text", "text": title},
        ],
        max_output_tokens=300,
        temperature=0.2,  # 只有支持自定义采样的模型可用；推理旗舰模型改由 reasoning.effort 控制
    )
    return response.output_text
```

对 5 张商品图的原始输出：

```text
['shoe rack', 'metal', 'white', 'multi-layer', 'hooks']
['dining chair', 'leather', 'black']
['repotting mat', 'waterproof', 'portable', 'foldable', 'green']
['doormat', 'absorbent', 'non-slip', 'coconut fiber', 'welcome', 'pickleball', 'outdoor']
['tv tray', 'foldable', 'metal', 'grey']
```

**与 Embedding 组合做标签去重**：新生成的关键词与既有关键词表逐一算余弦相似度，超过阈值就合并（`bed frame` → `bed`、`metallic` → `metal`）——《Embedding API 与文本相似度》里的原语正好在这里落地。下一步是把标签升级成描述句、再用少样本示例润色成商品文案；风格仍不稳定时考虑微调（《微调与部署》方向）。

## 五、图像生成与编辑：gpt-image

`gpt-image` 系模型具备图像生成能力，能借对世界的广泛理解作图；相比上一代 DALL·E 2/3，**指令遵循**与**照片级真实感**都明显更强。它有两条调用路径：

**路径 1：Images API**（一次性出图，参数最直白）

```python
import base64
from io import BytesIO
from PIL import Image

result = client.images.generate(
    model="gpt-image-1",
    prompt="半透明果冻状外星生物 Glorptak，站在霓虹灯下的小巷里",
    size="1024x1024",
)
image = Image.open(BytesIO(base64.b64decode(result.data[0].b64_json)))
image.save("glorptak.jpg", format="JPEG", quality=80, optimize=True)
```

可定制项：`quality`（`low`/`medium`/`high`/`auto`）、`size`（`1024x1024`、`1536x1024`、`1024x1536`、`auto`）、`output_format`（png/webp/jpeg，JPEG/WEBP 可调 0–100% 压缩）、`background`（请求透明背景，仅 PNG/WEBP；提示词里写明"透明背景"时默认即为 `transparent`）。

**路径 2：Responses API 的 `image_generation` 托管工具**——在多轮对话里按需生成/编辑，与 `web_search` 一样由服务端执行，参数为 `action`（`generate`/`edit`/`auto`）、`input_fidelity`、`moderation`、`output_compression` 等（详见《Responses API 托管工具总览与 web_search》）：

```python
response = client.responses.create(
    model="gpt-5.5",
    input="给我画一张 16:9 的封面图：一只穿西装的柴犬在会议室白板前讲解",
    tools=[{"type": "image_generation", "size": "1536x1024", "quality": "medium"}],
)
```

**编辑与遮罩**：`client.images.edit` 接受多张输入图（**最多 10 张**）与提示词；提供 `mask` 时只改未被遮罩覆盖的区域，且 **mask 必须带 alpha 通道**。原文给的技巧是——直接让模型自己生成 mask（"白色为角色、黑色为背景、尺寸与输入一致"），不够精确但多数用途够用；要精确就用图像分割模型。注意模型仍可能改动 mask 内区域，只是会尽量避免。

## 六、常见坑

1. **图片 token 不线性**。输入图像按分辨率换算成 token，`detail`/渲染质量拉高后成本明显上台阶；批量任务先算清单张成本（《成本与 Token 优化：Prompt Caching 与 Batch API》）。
2. **把视觉模型当 OCR 兜底**。手写与低质扫描件上它比传统 OCR 更强，但会"顺手补全"缺失字段；对发票、病历这类零容错场景，加校验（字段格式、值域、必填）而不是相信单次输出。
3. **坐标契约不统一**。上一节已述：0–999 归一化 + 左上原点 + strict schema，三件套一起给。
4. **推理模型不吃 `temperature`**。gpt-6-astra 一类旗舰模型不支持自定义 `temperature`/`top_p`，生成行为由 `reasoning.effort` 与 `text.verbosity` 控制；要确定性输出请走 `gpt-5.4-mini` 这类支持采样的档位。
5. **URL 传图依赖对方站点**。防盗链、鉴权、失效都会变成"模型没看到图"；生产链路用 base64 或先上传取 `file_id`。
6. **多模态 + 工具时按下标取输出**。`output` 里可能插着 `reasoning`、多个调用项，按 `item.type` 过滤（见《Responses API 托管工具总览与 web_search》）。

## 七、小结

- 输入三通道：URL、base64 data URL、上传后按 `file_id` 引用；图片用 `input_image`、PDF 用 `input_file`；
- 效果四杠杆：`detail`（看得清）、`text.verbosity`（转写得忠实）、`reasoning.effort`（组合推理）、`tools`（多轮目视检查）；
- 抽取类任务务必配 JSON Mode / strict schema，坐标类任务务必写死归一化契约；
- 读图与画图共用一套内容块协议：`gpt-image` 既能走 Images API，也能作 `image_generation` 托管工具进对话。

---

> **来源**：抓取于 2026-09-19。本文整合翻译自 OpenAI Cookbook（MIT）四篇：[Getting the Most out of GPT-5.4 for Vision and Document Understanding](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/multimodal/document_and_multimodal_understanding_tips.ipynb)（调参四杠杆、手写表单抽取、转录 verbosity、图表/户型图推理、bbox 定位与 crop-and-rerun）、[Tag and caption images with GPT-4o mini](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Tag_caption_images_with_GPT4V.ipynb)（商品图打标）、[Generate and edit images with GPT Image](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Generate_Images_With_GPT_Image.ipynb)（图像生成、输出定制、多图与 mask 编辑）、[responses_example.ipynb](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_example.ipynb)（图片 + 托管检索组合），作者 OpenAI，许可 MIT；传图基础写法取自 [openai-python README · Vision](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），`input_file` 的 `detail` 取值与语义按 SDK 类型定义 [responses/response_input_file_param.py](https://raw.githubusercontent.com/openai/openai-python/main/src/openai/types/responses/response_input_file_param.py) 校订。原文示例模型 gpt-4o-mini 已统一为 `gpt-5.5` / `gpt-5.4-mini`（批量档），`max_tokens` 改为 `max_completion_tokens`（Chat Completions）或 `max_output_tokens`（Responses），打标示例改写为 Responses API 形式，均为本站编者改动。站内《多模态提示》一篇与本篇同源互补：那篇讲提示词写法，本篇讲调用与调参。
