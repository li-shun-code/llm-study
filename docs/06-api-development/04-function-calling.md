---
title: Function Calling / Tool Use：让模型调用你的函数
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_call_functions_with_chat_models.ipynb
author: OpenAI Cookbook（How to call functions with chat models、responses_api_tool_orchestration.ipynb）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: openai-python 2026-09 最新稳定版；示例模型统一为 gpt-5.4
order: 4
group: 工具与输出契约
---
Function Calling（函数调用，Anthropic 生态称 Tool Use，工具使用）让模型不只是"说话"，还能**决定何时调用你定义的函数、并生成符合规范的参数**。关键认知（Cookbook 原文）：**API 不会真的执行任何函数**——模型只输出"我想调用 X 函数，参数是 Y"，真正执行函数、把结果回传模型，都是开发者的责任。

## 一、基本概念：tools 参数

在请求里传入 `tools` 列表，每个工具是一个 JSON Schema 描述的函数规格。Cookbook 用"天气查询"定义了两个函数：

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "format": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "The temperature unit to use. Infer this unit from the forecast location.",
                    },
                },
                "required": ["location", "format"],
            },
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_n_day_weather_forecast",
            "description": "Get an N-day weather forecast",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "format": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "The temperature unit to use. Infer this unit from the forecast location.",
                    },
                    "num_days": {
                        "type": "integer",
                        "description": "The number of days to forecast",
                    }
                },
                "required": ["location", "format", "num_days"]
            },
        }
    },
]
```

`tool_choice` 参数控制调用策略：默认 `auto`（模型自行决定）、`"none"`（禁止调用）、或强制指定某个函数 `{"type": "function", "function": {"name": "my_function"}}`。如果模型决定调用函数，响应的 `finish_reason` 会是 `"tool_calls"`，并附带工具名与生成的参数。

## 二、模型会先追问，再生成参数

信息不足时，模型不会瞎编参数——它会向用户澄清（以下为 Cookbook 原始输出）：

```python
messages = []
messages.append({"role": "system", "content": "Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous."})
messages.append({"role": "user", "content": "What's the weather like today"})
chat_response = chat_completion_request(messages, tools=tools)
```

```text
user: What's the weather like today
assistant: Sure—what city and state (or country) should I check? Also, do you prefer Celsius or Fahrenheit?
```

补充缺失信息后，模型就生成合法的函数参数了：

```python
messages.append({"role": "user", "content": "I'm in Glasgow, Scotland."})
chat_response = chat_completion_request(messages, tools=tools)
```

```text
assistant: [{'id': 'call_k2QgGc9GT9WjxD76GvR0Ot8q', 'function': {'arguments': '{"location": "Glasgow, Scotland", "format": "celsius"}', 'name': 'get_current_weather'}, 'type': 'function'}, ...]
```

注意：参数是**字符串形式的 JSON**（`arguments` 字段），需要 `json.loads` 反序列化后再调用你的函数。

**强制调用与禁止调用**（原文示例）：

```python
# 强制模型调用 get_n_day_weather_forecast
chat_response = chat_completion_request(
    messages, tools=tools,
    tool_choice={"type": "function", "function": {"name": "get_n_day_weather_forecast"}}
)

# 强制模型不调用任何函数
chat_response = chat_completion_request(
    messages, tools=tools, tool_choice="none"
)
```

**并行函数调用（Parallel Function Calling）**：gpt-5.4 起的各系列（gpt-5.4 / gpt-5.6 系列 / gpt-6-astra）默认支持在一轮里同时调用多个函数。问"旧金山和格拉斯哥未来 4 天的天气"，一次返回两个工具调用：

```text
[ChatCompletionMessageFunctionToolCall(id='call_KlZ3Fqt3SviC6o66dVMYSa2Q', function=Function(arguments='{"location": "San Francisco, CA", "format": "fahrenheit", "num_days": 4}', name='get_n_day_weather_forecast'), type='function'),
 ChatCompletionMessageFunctionToolCall(id='call_YAnH0VRB3oqjqivcGj3Cd8YA', function=Function(arguments='{"location": "Glasgow, UK", "format": "celsius", "num_days": 4}', name='get_n_day_weather_forecast'), type='function')]
```

## 三、完整闭环：调用函数并把结果回传模型

Cookbook 的第二个例子用模型生成的 SQL 查询一个真实数据库（[Chinook 样例库](https://www.sqlitetutorial.net/sqlite-sample-database/)），演示完整的四步循环。原文特别提醒：**生产环境中生成 SQL 属于高风险操作**，因为模型生成的 SQL 并非完全可靠。

把数据库模式（schema）注入函数描述，模型才知道表结构：

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "ask_database",
            "description": "Use this function to answer user questions about music. Input should be a fully formed SQL query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": f"""
                                SQL query extracting info to answer the user's question.
                                SQL should be written using this database schema:
                                {database_schema_string}
                                The query should be returned in plain text, not in JSON.
                                """,
                    }
                },
                "required": ["query"],
            },
        }
    }
]

def ask_database(conn, query):
    """用给定 SQL 查询 SQLite 数据库。"""
    try:
        results = str(conn.execute(query).fetchall())
    except Exception as e:
        results = f"query failed with error: {e}"
    return results
```

**Chat Completions 工具调用四步法**（Cookbook 原文步骤）：

**Step 1**：向模型提问，问题涉及的函数信息（名称、签名）已通过 `tools` 列表传给模型；若模型选中某工具，响应中会包含函数名与参数。

```python
messages = [{
    "role": "user",
    "content": "What is the name of the album with the most tracks?"
}]

response = client.chat.completions.create(
    model="gpt-5",
    messages=messages,
    tools=tools,
    tool_choice="auto"
)

response_message = response.choices[0].message
messages.append(response_message.to_dict())
```

**Step 2**：程序化判断模型是否想调用函数。

```python
tool_calls = response_message.tool_calls
if tool_calls:
    tool_call_id = tool_calls[0].id
    tool_function_name = tool_calls[0].function.name
    tool_query_string = json.loads(tool_calls[0].function.arguments)['query']
```

**Step 3**：取出函数名与参数，真正执行函数，把结果以 `role: "tool"` 消息追加进历史。

```python
    if tool_function_name == 'ask_database':
        results = ask_database(conn, tool_query_string)

        messages.append({
            "role": "tool",
            "tool_call_id": tool_call_id,
            "name": tool_function_name,
            "content": results
        })
```

**Step 4**：带着工具结果再请求一次模型，得到面向用户的最终回答。

```python
        model_response_with_function_call = client.chat.completions.create(
            model="gpt-5",
            messages=messages,
        )
        print(f"Result found in database: {model_response_with_function_call.choices[0].message.content}")
    else:
        print(f"Error: function {tool_function_name} does not exist")
else:
    print(response_message.content)  # 模型没调用工具，直接返回回复
```

原始输出：`Result found in database: Greatest Hits`

> 注意：`role: "tool"` 消息必须紧跟在带 `tool_calls` 的 assistant 消息之后，一一对应。

## 四、Responses API 的工具调用：function_call / function_call_output

Responses API 把同样的循环换了一套"输出项"词汇——工具调用是 `output` 里的 `function_call` 项，回传结果用 `function_call_output` 项（Cookbook 的多工具编排示例）：

```python
tools = [
    {
        "type": "function",
        "name": "PineconeSearchDocuments",
        "description": "Search for relevant documents based on the medical question asked by the user that is stored within the vector database using a semantic query.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The natural language query to search the vector database."
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of top results to return.",
                    "default": 3
                }
            },
            "required": ["query"],
            "additionalProperties": False
        }
    }
]

# Responses API：允许并行工具调用
response = client.responses.create(
    model="gpt-5.4",
    input=[
        {"role": "system", "content": "When prompted with a question, select the right tool to use based on the question."},
        {"role": "user", "content": item["query"]}
    ],
    tools=tools,
    parallel_tool_calls=True
)
```

检查响应里的工具调用项、执行、回传：

```python
if response.output:
    tool_call = response.output[0]
    if tool_call.type == "function_call":
        tool_name = tool_call.name
        # ……执行你的函数，拿到 result ……

        # 把工具调用项与其输出追加回对话
        input_messages.append(tool_call)
        input_messages.append({
            "type": "function_call_output",
            "call_id": tool_call.call_id,
            "output": str(result)
        })

        # 再请求一次，生成融合工具结果的最终回答
        final_response = client.responses.create(
            model="gpt-5.4",
            input=input_messages,
            tools=tools,
            parallel_tool_calls=True
        )
        print(final_response.output_text)
```

模型生成的调用项形如（原始输出）：

```text
ResponseFunctionToolCall(arguments='{"query":"most common cause of death in the United States","top_k":3}', call_id='call_6YWhEw3QSI7wGZBlNs5Pz4zI', name='PineconeSearchDocuments', type='function_call', ...)
```

**表：Chat Completions 与 Responses API 工具调用对照**

| 维度 | Chat Completions | Responses API |
| --- | --- | --- |
| 工具规格 | `{"type":"function","function":{name,parameters}}` | `{"type":"function",name,parameters}`（扁平一层） |
| 模型侧输出 | `message.tool_calls[]`（`finish_reason:"tool_calls"`） | `output[]` 中的 `function_call` 项 |
| 结果回传 | `role:"tool"` 消息（`tool_call_id`） | `function_call_output` 项（`call_id`） |
| 并行调用 | 多个 tool_calls 一并返回 | `parallel_tool_calls=True` |
| 托管工具 | 无 | 内置 `web_search`、`file_search` 等，服务端代执行 |

另外，Responses API 的托管工具（`web_search` / `file_search` 等）**不需要你执行**——服务端自动调用，`output` 里出现 `web_search_call` 等输出项；自定义 `function` 工具才需要上面的手工循环。

## 五、本篇小结

- Function Calling 的本质：模型输出"函数名 + JSON 参数"，执行权在开发者手里；
- 函数描述就是 JSON Schema：name/description/parameters 写得越清楚，参数生成越可靠；参数是 JSON 字符串，记得 `json.loads`；
- 四步循环：请求 → 检查 tool_calls → 执行并回传（role:"tool" / function_call_output）→ 二次请求得到最终答案；
- 新模型支持一轮并行多个工具调用；`tool_choice` 可强制或禁止调用；
- Responses API 除自定义函数外还提供免执行的托管工具。

Agent 体系的工具使用（ReAct、MCP 与 Function Calling 的关系）将在「Agent」展开。

---

> **来源**：本文翻译自 [How to call functions with chat models](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/How_to_call_functions_with_chat_models.ipynb) 与 [Multi-Tool Orchestration using OpenAI's Responses API](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/responses_api/responses_api_tool_orchestration.ipynb)（OpenAI Cookbook，MIT），作者 OpenAI，许可 MIT。抓取于 2026-09-13。
