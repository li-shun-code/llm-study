---
title: 多模态提示：视觉与文档理解
source_url: https://cookbook.openai.com/examples/multimodal/document_and_multimodal_understanding_tips
author: OpenAI（OpenAI Cookbook 团队）
license: MIT（OpenAI Cookbook）
fetched_at: 2026-09-13
translated: true
order: 10
versions: OpenAI Responses API；模型以 GPT-5.4 为例（2026-09 抓取时最新）
---
GPT-5.4 对真实世界的多模态工作负载是一大步跨越。过去让视觉系统捉襟见肘、或者不得不把 OCR、版面检测与自研解析器拼在一起的文档——高密度扫描件、手写表单、工程图纸、图表密集的报告——如今常常可以在**一次模型调用**中完成解读与推理。

然而，能否达到最佳效果，关键在**模型配置**。图像细节（detail）、输出详尽度（verbosity）、推理力度（reasoning effort）与工具使用上的一些小选择，会显著影响性能。

本文聚焦文档类工作负载中"杠杆率最高"的几项调整：什么时候该调哪个、它如何改变输出、以及如何选出既稳健又实用的配置。

## 请求的基本形状

本文所有示例均使用 **Responses API**（`client.responses.create(...)`），所谓"设置"就是传入该调用的请求参数。

**输入形状**：

- `input`：消息式对象列表（通常是一个 `{ "role": "user", "content": [...] }`）；
- `content`：带类型的块列表，典型为：
  - `{ "type": "input_text", "text": "..." }`
  - `{ "type": "input_image", "image_url": "...", "detail": "auto" | "original" }`

**本文用到的参数**：

- **图像细节**（`input_image.detail`）：控制视觉处理所用分辨率。大多数页面用 `"auto"`；文字很小、手写或扫描质量差时用 `"original"`。
- **详尽度**（`text={"verbosity": ...}`)：影响文本输出的压缩程度与忠实程度。忠实转写场景调高很有帮助。
- **推理力度**（`reasoning={"effort": ...}`）：图像本身可读、但答案需要多步视觉推理（图表、表格、图纸）时，为其分配更多算力。
- **工具使用**（`tools=[...]` + `instructions=...`）：可选地让模型先用 **Code Interpreter** 等工具缩放/裁剪/检查图片再作答；单次作答足够时省略工具。

一个最小请求长这样：

```python
response = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": "Extract the total amount due."},
                {
                    "type": "input_image",
                    "image_url": "data:image/png;base64,...",
                    "detail": "auto",
                },
            ],
        }
    ],
)
```

**输出形状**：模型返回包含一个或多个输出项的**响应对象**；本文主要用 `response.output_text` 便捷地取最终文本。若要**结构化输出**，依然是文本——用 `text={"format": ...}` 要求模型按 JSON 输出，然后 `json.loads(response.output_text)`（`text.format` 与 Pydantic 校验的完整用法见模块 6《JSON Mode 与结构化输出》一篇）。

## 快速决策表

把它当起点：**从最简配置开始，再按失败模式对号入座地调参**。

| 如果你的任务长这样 | 从这个配置开始 | 原因 |
|---|---|---|
| 普通文档问答或信息抽取 | `detail="auto"` | 页面可读时摩擦最低的默认值 |
| 高密度扫描件、截图、手写体、微小标签 | `detail="original"` | 保住那些最先丢失的微小视觉信号 |
| 逐字转写或 Markdown 转换 | `text={"verbosity": "high"}` | 促使模型保留更多版面、更少"转述" |
| 区域定位 | 要求输出固定 `0..999` 网格的 `[x_min, y_min, x_max, y_max]` | 便于裁剪、画框、调试与对接下游 |
| 跨多区域的图表/表格/表单/图纸问答 | 推理力度调到 `high` 或 `xhigh` | 改善多步视觉推理 |
| 多遍视觉检查 | 加上 Code Interpreter | 相当于"人先缩放、裁剪、旋转、检查若干子区域再回答" |

## 1. 密集页面与手写体：调高图像细节

`detail` 参数控制模型处理图像时使用的分辨率。多数应用应从 `detail="auto"` 起步，让模型自选合适分辨率；但当页面包含手写字、小标签、密集表格、低对比度扫描件或小字截图时，切到 `detail="original"` 能显著改善结果。**如果模型大体正确、但总是漏掉小字段或批注，调高图像细节通常是第一个该试的调整。**

原文示例是一张手写的地震保险申请表，特意包含小号的车牌邮箱、电话等字段（而不只是较大的手写姓名）——这类细节正是图像被降采样时最先劣化的部分：

```python
handwriting_prompt = """
Read the handwritten earthquake insurance application and return JSON with these keys:
- applicant_name
- applicant_email
- applicant_home_phone
- applicant_cell_phone
- co_applicant_name
- co_applicant_email
- co_applicant_home_phone
- co_applicant_work_phone
- effective_date
- expiration_date
- dwelling_coverage_limit_usd
- square_footage
- year_of_construction
"""

handwritten_form_path = "3C_insurance_form.png"
handwriting_response = client.responses.create(
    model="gpt-5.4",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": handwriting_prompt},
                {
                    "type": "input_image",
                    "image_url": image_to_data_url(handwritten_form_path),
                    "detail": "original",
                },
            ],
        }
    ],
    text={"format": {"type": "json_object"}},
)

handwriting_result = json.loads(handwriting_response.output_text)
```

## 2. 忠实转写：调高详尽度

让多模态模型转写文档时，它倾向于**压缩版面**：意思保住了，但空白、换行、表格式的排版可能被简化。这对问答常常是好事，对 OCR 式任务却是坏事。

调高详尽度——`text={"verbosity": "high"}`——能促使模型更"逐字"地渲染、精确转写。凡是完整性与格式保真度要紧的 OCR 类工作负载和定向抽取，都应该用它。原文示例要求对报纸的 "Ticket To The Arts" 版块**全部逐字转写**：

```python
section_prompt = ("Transcribe everything in the Ticket To The Arts section. "
                  "Do not summarize or paraphrase. Do not add any additional text.")

section_response = client.responses.create(
    model="gpt-5.4",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_text", "text": section_prompt},
            {
                "type": "input_image",
                "image_url": image_to_data_url("newspaper.png"),
                "detail": "original",
            },
        ],
    }],
    text={"verbosity": "high"},
)
```

## 3. 图像可读但答案要"拼"：调高推理力度

图像一旦可读，下一个瓶颈往往就轮到**推理**而不是感知了。典型情形：答案取决于把图像多个部分的信息组合起来，而不是读出单个字段——图表、表格、技术图纸、密集视觉排版大多如此。

此时调高推理力度 `reasoning={"effort": "high"}`，往往比调图像细节更有用：模型已经"看得见"内容，缺的是把标签连起来、跨区域比较、遵循结构、算出最终答案的算力。

原文给了三类例子：

- **户型图推理**：读房间标签、理解空间关系、用图上标注的尺寸算面积——返回命名房间数、最大房间、厨房正东的房间、卧室总面积等；
- **折线图理解**：简单读标题或单个数值用默认设置即可；但要在多条序列间比较、跨相邻区间追踪变化、估计趋势时，推理就成了限制因素——示例要求返回最大环比增幅/降幅（频道、季度区间、约数百万增量）与增长最快频道；
- **密集赛事对阵图的长程推理**：在拥挤版面里沿路径追踪、区分左右半区、锁定最终比分框，才能找出男女组冠军与亚军。

以户型图为例：

```python
floorplan_prompt = """
Inspect this apartment floorplan and return JSON with these keys:
- total_named_rooms_excluding_hallways_and_closets
- largest_room
- room_immediately_east_of_kitchen
- room_immediately_south_of_study
- bedroom_1_total_area_ft2
- bedroom_2_total_area_ft2

Rules:
- Use the room labels and dimension annotations that are visible on the drawing.
- Return integers for numeric fields.
- Return JSON only.
"""

floorplan_response = client.responses.create(
    model="gpt-5.4",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_text", "text": floorplan_prompt},
            {
                "type": "input_image",
                "image_url": image_to_data_url("apartment_floorplan.png"),
                "detail": "original",
            },
        ],
    }],
    reasoning={"effort": "high"},
    text={"format": {"type": "json_object"}},
)
```

## 4. 用 Code Interpreter 做多遍检查与边界框定位

有些文档任务，用"人的做法"更容易：先看整页，缩放或裁剪一个区域，再看另一处，最后把证据合成答案。当满足以下条件时，Code Interpreter 对视觉任务格外有用：

- 页面密集、证据散布在多个区域；
- 模型需要缩放、裁剪、旋转或做中间检查；
- 质量精度比最低延迟更重要。

对定位类任务（含边界框），除了接入 Code Interpreter，还要给模型一个**严格的坐标契约**：`[x_min, y_min, x_max, y_max]`、固定 `0..999` 坐标空间、原点在左上角。实践中，"代码解释器 + 显式框格式"的组合，往往比单次视觉调用更可靠、更可复现。原文的警方报告示例要求找出两辆车的车牌号区域，并用 JSON Schema 严格约束输出，再用本地 PIL 把框画回原图验证：

```python
bbox_prompt = """
Find the license plate number for Vehicle 1 and Vehicle 2 in this police report form.
It is written after License # and is a 7-digit number.
Do not guess or infer the license plate number.

Return JSON with this schema:
{
  "b": [
    {"label": "vehicle_1_license_plate", "bbox": [x_min, y_min, x_max, y_max]},
    {"label": "vehicle_2_license_plate", "bbox": [x_min, y_min, x_max, y_max]}
  ]
}

Use discrete normalized coordinates between 0 and 999.
Return JSON only.
"""

bbox_response = client.responses.create(
    model="gpt-5.4",
    input=[{
        "role": "user",
        "content": [
            {"type": "input_text", "text": bbox_prompt},
            {
                "type": "input_image",
                "image_url": image_to_data_url("police_form.png"),
                "detail": "original",
            },
        ],
    }],
    reasoning={"effort": "high"},
    text={
        "format": {
            "type": "json_schema",
            "name": "plate_bboxes",
            "schema": bbox_schema,   # 见原文 notebook：enum 约束 label、0..999 整数约束 bbox
            "strict": True,
        }
    },
    instructions=(
        "You are an expert document analyst. Use Code Interpreter before answering. "
        "Inspect the uploaded file, crop or zoom if needed, then answer in JSON."
    ),
    tools=[
        {
            "type": "code_interpreter",
            "container": {
                "type": "auto",
                "memory_limit": "4g",
                "file_ids": [uploaded_file.id],
            },
        }
    ],
)

bbox_results = json.loads(bbox_response.output_text)["b"]
```

## 5. 用不了 Code Interpreter？自建"裁剪重跑"流水线

受限环境中你可能不想开放一个通用 Python 沙箱。务实的替代是两阶段工作流：

1. 定位你关心的字段或区域；
2. 在本地裁剪该区域；
3. 对裁剪图重跑一个更小、更聚焦的提示词。

这通常能收回多遍检查的大部分价值，同时把暴露面控制得很小。原文示例先从第 4 步的边界框结果里取出目标区域，本地裁剪（带 18% padding），再用一个只要求 `license_number` 一个键的严格 Schema 调用完成抽取。

## 结论：一张配置速查卡

- **从简开始**：任务简单、页面清晰时，原生视觉 + `detail="auto"`、不带工具；
- **字太小/手写/低对比/扫描质量差** → 调高图像细节 `detail="original"`；
- **要忠实转写而非压缩摘要** → 调高 `verbosity`；
- **图像可读但答案需要跨区域组合** → 调高 `reasoning effort`；
- **密集页面上的多遍检查（缩放/裁剪/旋转）** → 上 Code Interpreter；
- **边界框** → 严格契约：固定 `0..999` 坐标（左上原点）的 `[x_min, y_min, x_max, y_max]` + 强制结构化 JSON 输出；
- **没有代码解释器** → 裁剪重跑：先定位、本地裁剪、再跑聚焦抽取提示词；
- **受限环境** → 只暴露轻量视觉工具（crop/zoom/rotate/区域 OCR 兜底），控制面更紧。

这套"按失败模式调参"的思路同样适用于其他多模态模型（Gemini、Claude 视觉等）：参数名会不同，但"分辨率 ↔ 转写详尽度 ↔ 推理预算 ↔ 工具增强"四个旋钮的分工是相通的。

---

> **来源**：本文翻译自 [Getting the Most out of GPT-5.4 for Vision and Document Understanding](https://cookbook.openai.com/examples/multimodal/document_and_multimodal_understanding_tips)，作者 OpenAI（OpenAI Cookbook 团队），许可 MIT（OpenAI Cookbook）。抓取于 2026-09-13。

---

> **说明**：原文为 notebook，其中的图片（手写保险表单、报纸剪影、户型图、折线图、赛事对阵图、警方报告表单）随仓库分发，本文以文字描述替代，图样见原文链接。
