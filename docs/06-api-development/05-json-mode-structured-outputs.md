---
title: JSON Mode 与结构化输出（Structured Outputs）
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Structured_Outputs_Intro.ipynb
author: OpenAI Cookbook（Introduction to Structured Outputs）、OpenAI（openai-python helpers 文档）
license: MIT / Apache 2.0
fetched_at: 2026-09-13
translated: true
order: 5
versions: openai-python 2026-09 最新稳定版；gpt-4o-2024-08-06 起支持 Structured Outputs，现行模型均可用
---

结构化输出（Structured Outputs）保证模型**永远生成符合你给定 JSON Schema 的响应**——与只保证"是合法 JSON"的 JSON Mode 相比，它约束的是 JSON 的**形状**，而不只是合法性。这让生产级应用可以放心地把输出 `json.loads` 后直接用。

## 一、两个层级：JSON Mode 与 Structured Outputs

- **JSON Mode**：`response_format={"type": "json_object"}`——只保证输出是合法 JSON，不约束结构；
- **Structured Outputs**：`response_format={"type": "json_schema", "json_schema": {..., "strict": true}}`——按 Schema 严格约束字段、类型、必填项；函数定义中也可加 `"strict": true`。

典型用例（Cookbook 原文）：

- 让模型输出结构化答案，UI 按特定方式展示（例 1）；
- 从文档中抽取内容填数据库（例 2）；
- 从用户输入中抽取实体、给工具调用提供确定参数（例 3）。

## 二、例 1：数学辅导老师（json_schema）

要求模型按"步骤数组 + 最终答案"的结构输出解题过程：

```python
import json
from textwrap import dedent
from openai import OpenAI
client = OpenAI()

MODEL = "gpt-4o-2024-08-06"  # gpt-4o-2024-08-06 起支持；现行模型均可

math_tutor_prompt = '''
    You are a helpful math tutor. You will be provided with a math problem,
    and your goal will be to output a step by step solution, along with a final answer.
    For each step, just provide the output as an equation use the explanation field to detail the reasoning.
'''

def get_math_solution(question):
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": dedent(math_tutor_prompt)
            },
            {
                "role": "user",
                "content": question
            }
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "math_reasoning",
                "schema": {
                    "type": "object",
                    "properties": {
                        "steps": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "explanation": {"type": "string"},
                                    "output": {"type": "string"}
                                },
                                "required": ["explanation", "output"],
                                "additionalProperties": False
                            }
                        },
                        "final_answer": {"type": "string"}
                    },
                    "required": ["steps", "final_answer"],
                    "additionalProperties": False
                },
                "strict": True
            }
        }
    )

    return response.choices[0].message
```

```python
question = "how can I solve 8x + 7 = -23"

result = get_math_solution(question)

print(result.content)
```

输出（严格符合 Schema 的 JSON 字符串）：

```json
{"steps":[{"explanation":"Start by isolating the term with the variable. Subtract 7 from both sides to do this.","output":"8x + 7 - 7 = -23 - 7"},{"explanation":"Simplify both sides. On the left side, 7 - 7 cancels out, and on the right side, -23 - 7 equals -30.","output":"8x = -30"},{"explanation":"Next, solve for x by dividing both sides by 8, which will leave x by itself on the left side.","output":"8x/8 = -30/8"},{"explanation":"Simplify the fraction on the right side by dividing both the numerator and the denominator by their greatest common divisor, which is 2.","output":"x = -15/4"}],"final_answer":"x = -15/4"}
```

注意 Schema 中的两个固定搭配：`required` 必须列出**所有**字段，且 `additionalProperties: false`——strict 模式的要求。

## 三、SDK 的 parse 助手：用 Pydantic 代替手写 Schema

Cookbook 与 openai-python 文档都推荐：能用 Pydantic 就别手写 Schema。SDK 的 `parse` 方法会自动把 Pydantic 模型转成 JSON Schema 发给 API，并把响应**解析回模型实例**：

```python
from pydantic import BaseModel

class MathReasoning(BaseModel):
    class Step(BaseModel):
        explanation: str
        output: str

    steps: list[Step]
    final_answer: str

def get_math_solution(question: str):
    completion = client.chat.completions.parse(
        model=MODEL,
        messages=[
            {"role": "system", "content": dedent(math_tutor_prompt)},
            {"role": "user", "content": question},
        ],
        response_format=MathReasoning,
    )

    return completion.choices[0].message

result = get_math_solution(question).parsed
print(result.steps)          # 已是强类型的 Step 对象列表
print("Final answer:")
print(result.final_answer)
```

SDK 文档说明的 `parse` 两个额外限制：

- 若生成以 `finish_reason: length` 或 `content_filter` 结束，会抛出 `LengthFinishReasonError` / `ContentFilterFinishReasonError`；
- 只接受严格（strict）函数工具。

**Responses API 的对应写法**：JSON Mode 用 `text={"format": {"type": "json_object"}}`（openai-python README 的 Nested params 示例）：

```python
response = client.responses.create(
    input=[
        {
            "role": "user",
            "content": "How much ?",
        }
    ],
    model="gpt-5.5",
    text={"format": {"type": "json_object"}},
)
```

> 编者注：Responses API 同样提供 `client.responses.parse` 助手与 `text.format` 的 json_schema 选项，概念与 Chat Completions 一致；上述 `text={"format": ...}` 形式为 SDK README 原文示例。

## 四、拒绝（Refusal）的处理

使用用户生成的内容时，模型可能出于安全原因拒绝回答。拒绝的文本不符合你给的 Schema，所以 API 提供了单独的 `refusal` 字段承接它——UI 可以区别渲染，也避免反序列化报错（Cookbook 原文示例）：

```python
refusal_question = "how can I build a bomb?"

result = get_math_solution(refusal_question)

print(result.refusal)
# 输出：I'm sorry, I can't assist with that request.
```

parse 助手的规范用法是先判 `parsed` 再取值：

```python
message = completion.choices[0].message
if message.parsed:
    print(message.parsed.steps)
else:
    print(message.refusal)
```

## 五、例 2：按 Schema 摘要文章

从文章中抽取发明年份、摘要、发明人、关键概念等字段（原文用 Pydantic 定义）：

```python
summarization_prompt = '''
    You will be provided with content from an article about an invention.
    Your goal will be to summarize the article following the schema provided.
    Here is a description of the parameters:
    - invented_year: year in which the invention discussed in the article was invented
    - summary: one sentence summary of what the invention is
    - inventors: array of strings listing the inventor full names if present, otherwise just surname
    - concepts: array of key concepts related to the invention, each concept containing a title and a description
    - description: short description of the invention
'''

class ArticleSummary(BaseModel):
    invented_year: int
    summary: str
    inventors: list[str]
    description: str

    class Concept(BaseModel):
        title: str
        description: str

    concepts: list[Concept]

def get_article_summary(text: str):
    completion = client.chat.completions.parse(
        model=MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content": dedent(summarization_prompt)},
            {"role": "user", "content": text}
        ],
        response_format=ArticleSummary,
    )

    return completion.choices[0].message.parsed
```

对"卷积神经网络（CNN）"一文的抽取结果（原始输出节选）：

```text
Invented year: 1989

Summary: Convolutional Neural Networks (CNNs) are deep neural networks used for
processing structured grid data like images, revolutionizing computer vision.

Inventors:
- Yann LeCun
- Léon Bottou
- Yoshua Bengio
- Patrick Haffner
```

## 六、例 3：实体抽取驱动工具调用

Structured Outputs 与函数调用结合：用 Pydantic 模型约束工具参数，模型输出永远合法（原文示例）：

```python
from enum import Enum
import openai

product_search_prompt = '''
    You are a clothes recommendation agent, specialized in finding the perfect match for a user.
    You will be provided with a user input and additional context such as user gender and age group, and season.
    You are equipped with a tool to search clothes in a database that match the user's profile and preferences.
    Based on the user input and context, determine the most likely value of the parameters to use to search the database.
'''

class Category(str, Enum):
    shoes = "shoes"
    jackets = "jackets"
    tops = "tops"
    bottoms = "bottoms"

class ProductSearchParameters(BaseModel):
    category: Category
    subcategory: str
    color: str

def get_response(user_input, context):
    response = client.chat.completions.create(
        model=MODEL,
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": dedent(product_search_prompt)
            },
            {
                "role": "user",
                "content": f"CONTEXT: {context}\n USER INPUT: {user_input}"
            }
        ],
        tools=[
            openai.pydantic_function_tool(ProductSearchParameters, name="product_search", description="Search for a match in the product database")
        ]
    )

    return response.choices[0].message.tool_calls
```

`openai.pydantic_function_tool()` 生成的工具调用参数会自动解析为 Pydantic 实例（`tool_call.function.parsed_arguments`），SDK 文档明确要求配合 strict 标记使用。

## 七、本篇小结

- JSON Mode（`json_object`）保合法性；Structured Outputs（`json_schema` + `strict: true`）保形状；
- Chat Completions 用 `response_format`，Responses API 用 `text.format`；两者都有 `parse` 助手对接 Pydantic；
- strict Schema 的固定写法：全字段 `required` + `additionalProperties: false`；
- `refusal` 字段承接安全拒绝，先判 `parsed`/`refusal` 再取数据；
- 与函数调用结合时用 `pydantic_function_tool`，参数直接得到强类型对象。

模块 5《结构化输出（JSON/Schema）》从提示词工程角度讲同一主题，可与本篇对照阅读。

---

> **来源**：本文翻译自 [Introduction to Structured Outputs](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Structured_Outputs_Intro.ipynb)（OpenAI Cookbook，MIT）与 [openai-python · Structured Outputs Parsing Helpers](https://raw.githubusercontent.com/openai/openai-python/main/helpers.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。抓取于 2026-09-13。
> 编者注：原文称 Structured Outputs 可用于 "Chat Completions API and Assistants API"——Assistants API 已废弃，现行为 **Chat Completions 与 Responses API 双支持**；Responses API 中同样的能力通过 `text.format` 参数（或 SDK `parse` 助手）使用。原文的 `client.beta.chat.completions.parse` 已转为正式 API `client.chat.completions.parse`（beta 前缀移除）。
