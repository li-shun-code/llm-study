---
title: OpenAI 兼容端点与 LiteLLM：一套代码调用所有模型
source_url: https://docs.litellm.ai/docs/
author: BerriAI（LiteLLM 官方文档）
license: MIT（enterprise 目录除外）
fetched_at: 2026-09-13
translated: true
versions: LiteLLM 2026-09 文档当前版（示例模型 gpt-5.6-terra / claude-sonnet-5 / gemini-3.1-pro-preview）
order: 19
group: 多模态与向量能力
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

**本站约定：任何 Key 都不写进代码。** 把端点与密钥放进 `.env`（并加进 `.gitignore`），运行时用 `os.environ` 读——「Python 基础」的《环境变量与 API Key 管理》与 openai-python README 推荐的是同一套做法。本站附录的 AI 学习助手（AiAssistant 组件）也按"自配 OpenAI 兼容端点"设计：

```text
# .env（不要提交进版本库）
OPENAI_API_KEY="sk-..."
OPENAI_BASE_URL="https://your-provider.example.com/v1"
```

```python
import os
from dotenv import load_dotenv   # pip install python-dotenv
from openai import OpenAI

load_dotenv()                     # 读取当前目录的 .env 并注入环境

client = OpenAI(
    base_url=os.environ["OPENAI_BASE_URL"],   # 换成厂商的兼容端点
    api_key=os.environ["OPENAI_API_KEY"],     # 厂商的 Key，来自环境变量
)
# 之后 chat.completions.create(...) / responses.create(...) 的写法完全一致
```

**路线 2：统一路由库 LiteLLM。** [LiteLLM](https://docs.litellm.ai) 是开源库，用**同一个 `completion()` 接口**调用 100+ 家模型（OpenAI、Anthropic、Vertex AI、Bedrock 等），并内置重试/回退（fallback）、Router 负载均衡与可自托管的 LLM 网关（Proxy，含虚拟密钥、成本追踪与管理 UI）。当你要在**运行时动态切换厂商**、做多供应商容灾时，它比手改 `base_url` 更顺手。

## 二、LiteLLM 快速上手

安装：

```sh
uv add litellm
```

核心规则：**模型名 = `提供商前缀/模型名`**。LiteLLM 默认**从环境变量读密钥**——这正好与本站约定一致：把下面这些键写进 `.env`，用 `load_dotenv()` 注入，代码里不出现任何密钥字面量。

```text
# .env
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION_NAME="us-east-1"
VERTEXAI_PROJECT="your-project-id"      # 或先执行 gcloud auth application-default login
VERTEXAI_LOCATION="us-central1"
```

```python
from dotenv import load_dotenv
from litellm import completion

load_dotenv()   # 一次性把 .env 注入环境；之后各 provider 自己去读

for model in [
    "openai/gpt-5.6-terra",                        # 走 OPENAI_API_KEY
    "anthropic/claude-sonnet-5",                   # 走 ANTHROPIC_API_KEY
    "bedrock/us.anthropic.claude-sonnet-5",        # 走 AWS_* 三项
    "vertex_ai/gemini-3.1-pro-preview",            # 走 VERTEXAI_* 或 ADC
]:
    response = completion(
        model=model,
        messages=[{"role": "user", "content": "Hello, how are you?"}],
    )
    print(model, "->", response.choices[0].message.content[:60])
```

本地部署（Ollama）不需要密钥，只要指对 `api_base`：

```python
response = completion(
    model="ollama/llama3",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_base="http://localhost:11434",
)
```

Azure 一条要注意时效：微软自 2025-08 起推 **v1 端点**（`https://<资源名>.openai.azure.com/openai/v1/`），此前按**月度节奏**发布带日期的 `api-version`、还得用 Azure 专属客户端。官方 API 生命周期文档现在的口径是：**数据面（inference/authoring）最新的 GA 与 preview 版本就是 `v1` 与 `v1 preview`**，不再要求传带日期的 `api-version`；`AZURE_API_VERSION="2024-02-01"` 这类写法属于旧的日期化路线，新代码不要照抄（详见《模型版本与弃用管理》的 Azure 一节）。要分清两条平面：**控制面**（建资源、部署模型）仍用带日期的版本，当前 GA `2025-06-01`、最新 preview `2025-07-01-preview`；**图像与音频**那批操作在 v1 之后仍有一份日期化的数据面规范（GA `2024-10-21`）承接，读旧示例时看到 `api-version=2024-10-21` 不一定是过时写法。两种写法：

```text
# .env —— 推荐：v1 端点，不填 api-version
AZURE_API_KEY="..."
AZURE_API_BASE="https://your-resource.openai.azure.com/openai/v1/"

# 只有仍需走旧的日期化数据面 API（或走控制面）时才配这一行
# 推理侧日期化 GA 为 2024-10-21，控制侧 GA 为 2025-06-01
# AZURE_API_VERSION="2024-10-21"
```

```python
response = completion(
    model="azure/your-deployment-name",   # Azure 上是"部署名"，不一定是模型名
    messages=[{"role": "user", "content": "Hello, how are you?"}],
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

（LiteLLM Input Params 文档中 `max_tokens` 已标注 deprecated，推荐 `max_completion_tokens`。）`completion()` 的输入参数就是你在《第一个 API 调用》到《JSON Mode 与结构化输出》那几篇学过的那套 OpenAI 参数（`messages`、`max_completion_tokens`、`temperature` 等），LiteLLM 负责**翻译**到各家的原生参数；多模态内容块同样按 OpenAI 格式书写（官方 Input Params 文档示例）：

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
import litellm

messages = [{"role": "user", "content": "Hey, how's it going?"}]
response = litellm.completion(model="gpt-5.6-luna", messages=messages, stream=True)
chunks = list(response)                      # 把分块收全
print(litellm.stream_chunk_builder(chunks, messages=messages))   # 重建成一个完整响应对象
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

## 五、Router 与 fallback：多部署路由的最小可跑版

上面所有例子都只挂一个部署。真到生产，你要的是"同一个逻辑模型名，后面挂多个供应商 + 自动切换"。LiteLLM 的 `Router` 就是干这个的（官方 routing 文档）：

```python
from dotenv import load_dotenv
from litellm import Router

load_dotenv()

router = Router(
    model_list=[
        {
            "model_name": "chat-default",          # 对外的逻辑名，业务代码只认它
            "litellm_params": {"model": "openai/gpt-5.4", "api_key": None},  # None → 读环境变量
            "model_info": {"rpm": 400, "tpm": 160_000},                       # 该部署的限额
        },
        {
            "model_name": "chat-default",
            "litellm_params": {"model": "anthropic/claude-sonnet-5", "api_key": None},
            "model_info": {"rpm": 300},
        },
    ],
    routing_strategy="latency-based-routing",      # 还有 usage-based / simple-shuffle 等
    num_retries=2,
    context_window_fallbacks=[{"chat-default": ["openai/gpt-5.4-mini"]}],   # 超窗时降级
    allowed_fails=3,                               # 冷却阈值：连续失败几次就把该部署摘掉
    cooldown_time=30,
)

response = router.completion(
    model="chat-default",
    messages=[{"role": "user", "content": "用两句话解释令牌桶"}],
    max_completion_tokens=128,
)
print(response.choices[0].message.content)
print("实际用的模型：", response.model)   # 与请求名不同 = 发生了切换/降级
```

三点注意：

1. **`api_key=None` 不是笔误**：显式让 SDK 去读环境变量，避免把密钥写进 `model_list`（本站约定）；
2. **降级要评估质量**。`response.model` 与请求的 `model_name` 不一致时，输出质量、延迟、单价都变了，上线前用评估集验证（《RAG 评估实战：用 RAGAS 量化检索与生成质量》的方法同样适用）；
3. **Router 管的是"选哪个部署"，不是"发多快"**。并发节流仍要自己做，见《并发请求限流：信号量、令牌桶与超时预算》。

## 六、进阶方向

- **Router 与 fallback**：同一逻辑名挂多个部署，按限流/错误自动切换（《错误处理、重试与限流》里"降级模型"策略的库级实现）；
- **LLM Gateway（Proxy）**：以容器方式自托管网关，应用拿虚拟密钥（virtual keys）访问模型，网关统一记账、限流、观测——团队共享模型访问的常见架构；
- **成本核算**：配合 `completion_cost` 等辅助能力把前述的成本意识落到账单层面。

## 七、本篇小结

- OpenAI Chat Completions 格式是事实标准：换厂商 = 换 `base_url` + `api_key`；
- LiteLLM 用 `completion(model="provider/model")` 统一 100+ 模型，响应保持 OpenAI 格式，参数自动翻译；
- 流式（`stream=True`）、异步（`acompletion`）、多模态内容块都与 OpenAI SDK 习惯一致；
- 多供应商容灾、网关化管理是它相对裸 SDK 的核心增量；`Router` 用 `model_name` + fallback 列表实现"一个名字、多个部署"；
- 密钥一律走 `.env` + `os.environ`，LiteLLM 与 openai-python 都默认读环境变量，没有例外。

下一篇《用 FastAPI 封装 LLM 服务》把"调模型"变成"提供接口"；LangChain / Agents SDK 级别的编排已收在「AI 智能体」模块的《LangChain 快速入门（1.0 · create_agent）》与《OpenAI Agents SDK：轻量多智能体框架入门》。

---

> **来源**：本文翻译自 [LiteLLM Getting Started](https://docs.litellm.ai/docs/)、[Completion Input Params](https://docs.litellm.ai/docs/completion/input) 与 [Streaming Responses](https://docs.litellm.ai/docs/completion/stream)（LiteLLM 官方文档），作者 BerriAI，许可 MIT（enterprise 目录除外）。抓取于 2026-09-13。Azure 端点与 API 版本一段另行核对自 Microsoft Learn 的 [Azure OpenAI REST API reference](https://learn.microsoft.com/en-us/azure/foundry/openai/reference) 与 [API 生命周期指南](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle)（© Microsoft，署名学习翻译），核实于 2026-09-19，为本站编者补充。
