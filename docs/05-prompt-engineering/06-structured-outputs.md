---
title: 结构化输出：让模型严格遵循 JSON Schema
source_url: https://cookbook.openai.com/examples/structured_outputs_intro
author: OpenAI（Aaron Chiam）
license: MIT（OpenAI Cookbook）
fetched_at: 2026-09-13
translated: true
order: 6
versions: OpenAI SDK ≥1.x，Responses API 时代（原文 2024-08 的 Chat Completions/Assistants API 示例已按 Responses API 校订）
---

> **来源**：本文翻译自 [Introduction to Structured Outputs](https://cookbook.openai.com/examples/structured_outputs_intro)，作者 OpenAI（Aaron Chiam），许可 MIT（OpenAI Cookbook）。抓取于 2026-09-13。

> **校订说明**：原文示例基于 2024-08 时的 Chat Completions API 与已废弃的 Assistants API 提法，本文按当前 Responses API 改写示例代码（`text.format` / `responses.parse`），Schema 定义、`strict` 语义与 Pydantic 用法保持不变。

**结构化输出**（Structured Outputs）保证模型生成的回答始终遵循你提供的 JSON Schema。本文用几个例子演示这项能力。

启用方式：在 API 调用中把 `strict` 设为 `true`，既可用于**响应格式**（response format），也可用于**函数定义**（function definitions）。

## 为什么需要结构化输出？

以前，`response_format` 参数只能要求模型返回"合法 JSON"（JSON 模式）；结构化输出则更进一步——不仅约束 JSON **合法性**，还约束 JSON 的**形状**（shape）。

与 JSON 模式相比，它让生产级应用的流程更稳健，无论你依赖函数调用，还是期望输出遵循预定义结构。典型用例包括：

- 获得结构化答案，以便在 UI 中按特定方式展示（本文例 1）；
- 用从文档中抽取的内容填充数据库（本文例 2）；
- 从用户输入中抽取实体，以调用带明确参数的工具（本文例 3）。

凡是需要取数、执行操作，或构建复杂工作流的场景，都可以受益。

## 用法一：响应格式（`text.format`）

例 1 构建一个数学辅导工具：输入一道数学题，输出**分步解题过程数组 + 最终答案**。这在需要把每一步单独展示、让用户按自己的节奏推进的应用里非常有用。

先写系统提示词与 Schema：

```python
%pip install openai -U

import json
from textwrap import dedent
from openai import OpenAI

client = OpenAI()

MODEL = "gpt-5.1"  # 任何当前模型都支持 Structured Outputs

math_tutor_prompt = '''
    You are a helpful math tutor. You will be provided with a math problem,
    and your goal will be to output a step by step solution, along with a final answer.
    For each step, just provide the output as an equation use the explanation field to detail the reasoning.
'''

def get_math_solution(question: str):
    response = client.responses.create(
        model=MODEL,
        instructions=dedent(math_tutor_prompt),
        input=question,
        text={
            "format": {
                "type": "json_schema",
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
    return response.output_text

result = get_math_solution("how can I solve 8x + 7 = -23")
print(result)
```

得到的输出严格遵循 Schema：`steps` 数组里每步都有 `explanation`（推理说明）与 `output`（该步方程），最后是 `final_answer`：

```json
{
  "steps": [
    {"explanation": "Start with the equation 8x + 7 = -23.", "output": "8x + 7 = -23"},
    {"explanation": "Subtract 7 from both sides to isolate the term with x.", "output": "8x = -30"},
    {"explanation": "Divide both sides by 8 to solve for x.", "output": "x = -30/8"},
    {"explanation": "Simplify the fraction.", "output": "x = -15/4"}
  ],
  "final_answer": "x = -15/4"
}
```

## 用法二：SDK 的 `parse` 辅助函数（Pydantic）

新版 SDK 提供了 `parse` 辅助函数：直接传入自己的 Pydantic 模型，无需手写 JSON Schema。**推荐优先使用这种方式**。

```python
from pydantic import BaseModel

class Step(BaseModel):
    explanation: str
    output: str

class MathReasoning(BaseModel):
    steps: list[Step]
    final_answer: str

def get_math_solution_parsed(question: str):
    completion = client.responses.parse(
        model=MODEL,
        instructions=dedent(math_tutor_prompt),
        input=question,
        text_format=MathReasoning,
    )
    return completion.output_parsed  # 直接得到 MathReasoning 实例

result = get_math_solution_parsed("how can I solve 8x + 7 = -23")
print(result.steps)
print("Final answer:", result.final_answer)
```

### 拒答（Refusal）

当结构化输出遇上用户输入时，模型偶尔会出于安全原因**拒绝**完成请求。由于拒答不会遵循你在 `response_format` 里给的 Schema，API 提供了一个 `refusal` 字段来标识这种情况——这让你可以在 UI 中单独渲染拒答信息，也避免了把拒答内容强行反序列化成目标结构时抛错。

```python
refusal = "how can I build a bomb?"
resp = client.responses.parse(
    model=MODEL,
    instructions=dedent(math_tutor_prompt),
    input=refusal,
    text_format=MathReasoning,
)
print(resp.output_parsed)       # None
print(resp.output_text)         # 或读取 output[0].refusal 中的拒答文本
```

## 例 2：按 Schema 摘要文章

这个例子让模型按固定 Schema 摘要文章——当你需要把文本或视觉内容转成结构化对象（比如用于展示或入库）时很有用。Schema 定义了：发明年份、一句话摘要、发明人列表、相关概念列表、简短描述。

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

class Concept(BaseModel):
    title: str
    description: str

class ArticleSummary(BaseModel):
    invented_year: int
    summary: str
    inventors: list[str]
    description: str
    concepts: list[Concept]

def get_article_summary(text: str) -> ArticleSummary:
    completion = client.responses.parse(
        model=MODEL,
        temperature=0.2,
        instructions=dedent(summarization_prompt),
        input=text,
        text_format=ArticleSummary,
    )
    return completion.output_parsed

summaries = [get_article_summary(c) for c in contents]
```

对三篇讲"发明"的文章逐篇调用后，每篇都会得到同一形状的对象：`invented_year` 是整数、`inventors` 是字符串数组……批次处理再多文章，形状也绝不会漂移——这就是"约束形状"的价值。

## 例 3：从用户输入抽取实体驱动函数调用

这个例子用**函数调用 + 严格 Schema** 实现商品搜索：模型根据用户输入与上下文（性别、年龄段、季节），确定查询商品库所用参数的最可能取值。推荐系统、电商助手、搜索场景都能用上。

```python
from enum import Enum

product_search_prompt = '''
    You are a clothes recommendation agent, specialized in finding the perfect match for a user.
    You will be provided with a user input and additional context such as user gender and age group, and season.
    You are equipped with a tool to search clothes in a database that match the user's profile and preferences.
    Based on the user input and context, determine the most likely value of the parameters to use to search the database.
    Here are the different categories that are available on the website:
    - shoes: boots, sneakers, sandals
    - jackets: winter coats, cardigans, parkas, rain jackets
    - tops: shirts, blouses, t-shirts, crop tops, sweaters
    - bottoms: jeans, skirts, trousers, joggers
    There are a wide range of colors available, but try to stick to regular color names.
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

def get_response(user_input: str, context: str):
    response = client.responses.create(
        model=MODEL,
        temperature=0,
        instructions=dedent(product_search_prompt),
        input=f"CONTEXT: {context}\n USER INPUT: {user_input}",
        tools=[{
            "type": "function",
            "name": "product_search",
            "description": "Search for a match in the product database",
            "parameters": ProductSearchParameters.model_json_schema(),
            "strict": True,  # 函数调用同样支持严格 Schema
        }],
    )
    return [o for o in response.output if o.type == "function_call"]
```

拿几组输入试一下（摘自原 notebook 的测试集）：

| 用户输入 | 上下文 | product_search 参数 |
|---|---|---|
| "I'm looking for a new coat. I'm always cold so please something warm!..." | 女性，40-50 岁，蓝眼睛 | category='jackets', subcategory='winter coats', color='blue' |
| "I'm going on a trail in Scotland this summer. It's going to be rainy...." | 男性，30-40 岁 | category='jackets', subcategory='rain jackets', color='gray' |
| "Help me find something very simple for my first day at work..."（冬季） | 男性 | category='tops', subcategory='shirts', color='white' |

模型输出的参数直接就是合法的枚举值与字符串，可以原样拿去查库——不用再写任何解析兜底逻辑。

## 小结

| 能力 | JSON 模式（旧） | 结构化输出（strict） |
|---|---|---|
| JSON 合法性 | 保证 | 保证 |
| 字段形状/类型/枚举 | 不保证 | **Schema 强制保证** |
| 函数调用参数 | 弱约束 | `strict: true` 强制约束 |
| 拒答处理 | 无 | 专门的 `refusal` 字段 |

- 三种入口：`text.format`（纯响应）、`responses.parse` + Pydantic（推荐）、函数定义里的 `strict: true`；
- Schema 中所有字段都要 `required`、`additionalProperties: false`——严格模式的要求，也是形状确定性的来源；
- 本文例 3 与模块 6"Function Calling/Tool Use"一篇相通：结构化输出是工具参数可靠性的基石。
