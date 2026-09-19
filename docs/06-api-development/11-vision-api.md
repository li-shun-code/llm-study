---
title: 视觉理解 API：把图片喂给多模态模型
source_url: https://raw.githubusercontent.com/openai/openai-python/main/README.md
author: OpenAI（openai-python README · Vision）、OpenAI Cookbook（Tag caption images with GPT-4V）
license: Apache 2.0 / MIT
fetched_at: 2026-09-13
translated: true
versions: openai-python 2026-09 最新稳定版（Responses API input_image）；GPT-4o / gpt-5.5 等多模态模型
order: 11
group: 多模态与向量能力
---
多模态模型（vision-capable models）可以直接"看图"。给消息里加一个图片内容块，模型就能回答图里有什么、给商品打标签、写描述、读图表。本篇讲清楚：图片怎么传（URL 与 base64 两种）、多图怎么传、以及一个完整的电商打标应用。

## 一、两种传图方式

**Responses API** 中，用户消息的 `content` 从字符串变成**内容块数组**，图片用 `input_image` 块（openai-python README · Vision 原文示例）：

**方式一：图片 URL**

```python
prompt = "What is in this image?"
img_url = "https://api.nga.gov/iiif/a2e6da57-3cd1-4235-b20e-95dcaefed6c8/full/!800,800/0/default.jpg"

response = client.responses.create(
    model="gpt-5.5",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"{img_url}"},
            ],
        }
    ],
)
```

**方式二：base64 编码**（图片在本地、或不想暴露公网 URL 时）

```python
import base64
from openai import OpenAI

client = OpenAI()

prompt = "What is in this image?"
with open("path/to/image.png", "rb") as image_file:
    b64_image = base64.b64encode(image_file.read()).decode("utf-8")

response = client.responses.create(
    model="gpt-5.5",
    input=[
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"data:image/png;base64,{b64_image}"},
            ],
        }
    ],
)
```

**Chat Completions 对照**：内容块名为 `image_url`（与 Responses 的 `input_image` 相对应），Cookbook 的商品图示例：

```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": img_url,
                    }
                },
            ],
        },
    ],
    max_tokens=300,
)
```

一条消息里放**多张图**就是多加几个图片块；文字块与图片块的顺序可自由组合（Cookbook 的批处理示例就是"文字标题 + 图片"成对输入）。

## 二、实战：给商品图打关键词标签

Cookbook 的完整案例用多模态模型为 Amazon 家具数据集打标签、写描述。核心思路：**图片 + 商品标题一起给模型，让它只关注标题所指的那件商品**（场景图里常常同时出现多件物品）。

```python
system_prompt = '''
    You are an agent specialized in tagging images of furniture items, decorative items,
    or furnishings with relevant keywords that could be used to search for these items
    on a marketplace.

    You will be provided with an image and the title of the item that is depicted in the
    image, and your goal is to extract keywords for only the item specified.

    Keywords should be concise and in lower case.

    Keywords can describe things like:
    - Item type e.g. 'sofa bed', 'chair', 'desk', 'plant'
    - Item material e.g. 'wood', 'metal', 'fabric'
    - Item style e.g. 'scandinavian', 'vintage', 'industrial'
    - Item color e.g. 'red', 'blue', 'white'

    Only deduce material, style or color keywords when it is obvious that they make
    the item depicted in the image stand out.

    Return keywords in the format of an array of strings, like this:
    ['desk', 'industrial', 'metal']
'''

def analyze_image(img_url, title):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": img_url,
                        }
                    },
                ],
            },
            {
                "role": "user",
                "content": title
            }
        ],
        max_tokens=300,
        top_p=0.1
    )

    return response.choices[0].message.content
```

Cookbook 的原始输出（对 5 张商品图）：

```text
['shoe rack', 'metal', 'white', 'multi-layer', 'hooks']
['dining chair', 'leather', 'black']
['repotting mat', 'waterproof', 'portable', 'foldable', 'green']
['doormat', 'absorbent', 'non-slip', 'coconut fiber', 'welcome', 'pickleball', 'outdoor']
['tv tray', 'foldable', 'metal', 'grey']
```

**与 Embedding 组合做标签去重**：新生成的关键词与既有关键词表逐一算余弦相似度，超过阈值就合并（如 `bed frame` → `bed`、`metallic` → `metal`）——上一篇第 4 节演示过的原语，正好在这里落地。

下一步是把标签升级成**描述句**（descriptions），再用少样本示例让另一个模型把描述润色成商品文案（caption）。原文提示：如果少样本仍达不到目标风格，可以考虑**微调**一个模型来匹配语气与格式（微调见「微调与部署」）。

## 三、视觉 + 工具：一条请求里看图并联网核实

第 01 篇出现过这个 Responses API 的组合玩法，此处补全语境——模型看完图、自己提取关键词、调用托管 `web_search` 工具检索相关新闻并给出引用：

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

Cookbook 强调：同一工作流若用 Chat Completions，需要应用自己执行工具、再追加请求——这正是 Responses API 在多模态 + 工具场景下的结构优势。

## 四、更多视觉应用方向

- **图像问答 / 文档理解**：发票、截图、图表数据的解读（Cookbook 多模态目录中的 document understanding 系列与 video understanding 示例可延伸）；
- **内容打标 + 搜索**：本篇实战即"图 → 标签 → 语义搜索"的完整链路；
- **视觉 + Function Calling**：让模型看图后决定调用哪个工具（「Agent」的 Computer Use/浏览器 Agent 是其极端形态）。

## 五、本篇小结

- 图片进消息的方式：Responses API 用 `input_image` 内容块，Chat Completions 用 `image_url`；URL 与 base64 双通道；
- 多图 = 多个图片块；图片块可与文字块任意混排；
- 商品打标实战的提示词要点：图 + 标题一起给、限定只描述目标商品、关键词格式写死；
- 视觉理解与 Embedding（去重）、托管工具（看图联网）组合威力更大。

---

> **来源**：本文翻译自 [openai-python README · Vision](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0）与 [Tag and caption images with GPT-4o mini](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Tag_caption_images_with_GPT4V.ipynb)（OpenAI Cookbook，MIT），作者 OpenAI，许可 Apache 2.0 / MIT。抓取于 2026-09-13。
