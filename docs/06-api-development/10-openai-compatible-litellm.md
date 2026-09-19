---
title: OpenAI 兼容端点与 LiteLLM：一套代码调用所有模型
source_url: https://docs.litellm.ai/docs/
author: BerriAI（LiteLLM 官方文档）
license: MIT（enterprise 目录除外）
fetched_at: 2026-09-13
translated: true
order: 10
versions: LiteLLM 2026-09 文档当前版（示例模型 gpt-5.6-terra / claude-sonnet-5 / gemini-3.1-pro-preview）
---

前面十篇都围绕 OpenAI 官方 SDK。现实中的 LLM 应用往往要**多家模型混用**：主力用 GPT、长文本用 Gemini、内网部署走 Ollama，切换与容灾是常态。好消息是：**OpenAI 的 Chat Completions 格式已经成为事实标准**——各家兼容端点与统一路由库都围绕它展开。

## 一、两条路线：兼容端点 vs 统一路由库

**路线 1：OpenAI 兼容端点。** 绝大多数厂商（DeepSeek、Qwen/DashScope、GLM、Ollama、vLLM 等）直接提供 OpenAI 格式的 `/v1/chat/completions`。用 openai-python 只改两处即可接入：

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-provider.example.com/v1",  # 换成厂商的兼容端点
    api_key="sk-...",                                  # 厂商的 Key
)
# 之后 chat.completions.create(...) 的写法完全一致
```

「Python 基础」的"环境变量与 API Key 管理"同样适用：`base_url` 与 `api_key` 都从 `.env` 读，一行环境变量切换厂商。本站附录的 AI 学习助手（AiAssistant 组件）就是按"自配 OpenAI 兼容端点"设计的。

**路线 2：统一路由库 LiteLLM。** [LiteLLM](https://docs.litellm.ai) 是开源库，用**同一个 `completion()` 接口**调用 100+ 家模型（OpenAI、Anthropic、Vertex AI、Bedrock 等），并内置重试/回退（fallback）、Router 负载均衡与可自托管的 LLM 网关（Proxy，含虚拟密钥、成本追踪与管理 UI）。当你要在**运行时动态切换厂商**、做多供应商容灾时，它比手改 `base_url` 更顺手。

## 二、LiteLLM 快速上手

安装：

```sh
uv add litellm
```

核心规则：**模型名 = `提供商前缀/模型名`**。各家的第一个调用：

```python
# OpenAI
from litellm import completion
import os

os.environ["OPENAI_API_KEY"] = "your-api-key"
response = completion(
    model="openai/gpt-5.6-terra",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)
print(response.choices[0].message.content)
```

```python
# Anthropic
from litellm import completion
import os

os.environ["ANTHROPIC_API_KEY"] = "your-api-key"
response = completion(
    model="anthropic/claude-sonnet-5",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)
```

```python
# Vertex AI（gemini）
from litellm import completion
import os

# 认证：先执行 gcloud auth application-default login
os.environ["VERTEXAI_PROJECT"] = "your-project-id"
os.environ["VERTEXAI_LOCATION"] = "us-central1"
response = completion(
    model="vertex_ai/gemini-3.1-pro-preview",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)
```

```python
# Bedrock
from litellm import completion
import os

os.environ["AWS_ACCESS_KEY_ID"] = "your-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "your-secret"
os.environ["AWS_REGION_NAME"] = "us-east-1"
response = completion(
    model="bedrock/us.anthropic.claude-sonnet-5",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)
```

```python
# Ollama（本地部署）
from litellm import completion

response = completion(
    model="ollama/llama3",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_base="http://localhost:11434"
)
```

```python
# Azure OpenAI
from litellm import completion
import os

os.environ["AZURE_API_KEY"] = "your-key"
os.environ["AZURE_API_BASE"] = "https://your-resource.openai.azure.com"
os.environ["AZURE_API_VERSION"] = "2024-02-01"
response = completion(
    model="azure/your-deployment-name",
    messages=[{"role": "user", "content": "Hello, how are you?"}]
)
```

**关键承诺（官方原文）**：无论哪家供应商，响应都遵循 OpenAI Chat Completions 格式——非流式返回 `ModelResponse` 对象，取 `.choices[0].message.content` 的习惯代码零改动：

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "gpt-5.6-terra",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thanks for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 12,
    "total_tokens": 25
  }
}
```

## 三、参数：OpenAI 参数即通用参数

`completion()` 的输入参数就是你在第 01–06 篇学过的那套 OpenAI 参数（`messages`、`max_tokens`、`temperature` 等），LiteLLM 负责**翻译**到各家的原生参数；多模态内容块同样按 OpenAI 格式书写（官方 Input Params 文档示例）：

```python
# 文本
messages=[{"role": "user", "content": [{"type": "text", "text": "Hello!"}]}]
# 图片
messages=[{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}]}]
# 音频
messages=[{"role": "user", "content": [{"type": "input_audio", "input_audio": {"data": "<base64>", "format": "wav"}}]}]
# 组合多模态
messages=[{"role": "user", "content": [
    {"type": "text", "text": "Generate a product description based on this image"},
    {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}]}]
```

另有 litellm 专属参数（如 `fallbacks`、`mock_response` 等）与少量已弃用参数，完整清单见官方文档。

## 四、流式与异步

`stream=True` 用法与 OpenAI SDK 一致，逐块打印增量（官方文档示例）：

```python
from litellm import completion

messages = [{"role": "user", "content": "Hey, how's it going?"}]
response = completion(model="gpt-5.6-luna", messages=messages, stream=True)
for part in response:
    print(part.choices[0].delta.content or "")
```

LiteLLM 还提供把分块列表**重建成完整响应**的助手：

```python
from litellm import completion

messages = [{"role": "user", "content": "Hey, how's it going?"}]
response = completion(model="gpt-5.6-luna", messages=messages, stream=True)
chunks = []
for chunk in response:
    chunks.append(chunk)
print(litellm.stream_chunk_builder(chunks, messages=messages))
```

异步版本叫 `acompletion`（与 `AsyncOpenAI` 对应），支持异步迭代流：

```python
from litellm import acompletion
import asyncio, os, traceback

async def completion_call():
    try:
        print("test acompletion + streaming")
        response = await acompletion(
            model="gpt-5.6-luna",
            messages=[{"content": "Hello, how are you?", "role": "user"}],
            stream=True
        )
        print(f"response: {response}")
        async for chunk in response:
            print(chunk)
    except:
        print(f"error occurred: {traceback.format_exc()}")

asyncio.run(completion_call())
```

## 五、进阶方向

- **Router 与 fallback**：同一逻辑名挂多个部署，按限流/错误自动切换（第 07 篇的"降级模型"策略的库级实现）；
- **LLM Gateway（Proxy）**：以容器方式自托管网关，应用拿虚拟密钥（virtual keys）访问模型，网关统一记账、限流、观测——团队共享模型访问的常见架构；
- **成本核算**：配合 `completion_cost` 等辅助能力把前述的成本意识落到账单层面。

## 六、本篇小结

- OpenAI Chat Completions 格式是事实标准：换厂商 = 换 `base_url` + `api_key`；
- LiteLLM 用 `completion(model="provider/model")` 统一 100+ 模型，响应保持 OpenAI 格式，参数自动翻译；
- 流式（`stream=True`）、异步（`acompletion`）、多模态内容块都与 OpenAI SDK 习惯一致；
- 多供应商容灾、网关化管理是它相对裸 SDK 的核心增量。

第 15 篇换到编排层：LangChain 1.0 快速入门。

---

> **来源**：本文翻译自 [LiteLLM Getting Started](https://docs.litellm.ai/docs/)、[Completion Input Params](https://docs.litellm.ai/docs/completion/input) 与 [Streaming Responses](https://docs.litellm.ai/docs/completion/stream)（LiteLLM 官方文档），作者 BerriAI，许可 MIT（enterprise 目录除外）。抓取于 2026-09-13。
