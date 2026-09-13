---
title: Ollama 本地部署：一行命令把开源模型跑起来
source_url: https://github.com/ollama/ollama
author: Ollama 团队
license: MIT
fetched_at: 2026-09-13
translated: true
order: 13
versions: Ollama（2026-09 当前版，含 REST API 与 OpenAI 兼容接口）
---

微调好的模型要跑起来，最省事的本地部署工具就是 Ollama：macOS/Windows/Linux 一行命令安装，自动管理模型下载与量化版本，内置 REST API 与 OpenAI 兼容接口。

## 安装

**macOS**：

```shell
curl -fsSL https://ollama.com/install.sh | sh
```

或从 [ollama.com/download](https://ollama.com/download) 手动下载（Ollama.dmg）。

**Windows**：

```shell
irm https://ollama.com/install.ps1 | iex
```

**Linux**：

```shell
curl -fsSL https://ollama.com/install.sh | sh
```

**Docker**：官方镜像 `ollama/ollama` 发布在 Docker Hub（用法见下文）。

官方 Python / JavaScript 库：[ollama-python](https://github.com/ollama/ollama-python)、[ollama-js](https://github.com/ollama/ollama-js)。

## 快速开始

安装后运行：

```
ollama
```

你会被引导运行一个模型，或把 Ollama 接入你已有的 Agent 与编程工具（Claude Code、Codex、Copilot 等）。直接和模型聊天，运行 Gemma 4：

```
ollama run gemma4
```

完整模型列表见 [ollama.com/library](https://ollama.com/library)。Qwen、DeepSeek、GLM 等国内开源模型也都有官方或社区发布的镜像（编者注：如 `ollama run qwen3.5`、`ollama run deepseek-v3.2`，以 library 页面实际提供为准）。

Ollama 的推理后端是 [llama.cpp](https://github.com/ggml-org/llama.cpp) 项目（Georgi Gerganov 创立），模型以 GGUF 格式分发、按显存自动选择量化级别。

## CLI 速查

**表：Ollama 常用命令**

| 命令 | 作用 |
| --- | --- |
| `ollama run <model>` | 下载（如无）并进入交互对话 |
| `ollama pull <model>` | 只拉取模型 |
| `ollama list` / `ollama ps` | 列出本地模型 / 正在运行的模型 |
| `ollama stop <model>` | 停止一个正在运行的模型 |
| `ollama rm <model>` | 删除本地模型 |
| `ollama create <name>` | 从 Modelfile 创建自定义模型 |
| `ollama show <model>` | 查看模型信息 |
| `ollama serve` | 启动 Ollama 服务（安装后默认已在后台） |
| `ollama launch <app>` | 配置并启动集成（Claude Code、Codex、OpenCode 等） |

`ollama launch` 支持的集成包括 Claude Code、Codex、Copilot CLI、DeepSeek Harness、Droid、OpenCode 等；也可以用 OpenClaw 把 Ollama 变成跨 WhatsApp、Telegram、Slack、Discord 的个人 AI 助手。

## REST API

Ollama 提供用于运行和管理模型的 REST API，默认监听 `http://localhost:11434`：

```
curl http://localhost:11434/api/chat -d '{
  "model": "gemma4",
  "messages": [{
    "role": "user",
    "content": "Why is the sky blue?"
  }],
  "stream": false
}'
```

全部端点见[官方 API 文档](https://docs.ollama.com/api)。

### Python

```
pip install ollama
```

```python
from ollama import chat

response = chat(model='gemma4', messages=[
  {
    'role': 'user',
    'content': 'Why is the sky blue?',
  },
])
print(response.message.content)
```

### JavaScript

```
npm i ollama
```

```javascript
import ollama from "ollama";

const response = await ollama.chat({
  model: "gemma4",
  messages: [{ role: "user", content: "Why is the sky blue?" }],
});
console.log(response.message.content);
```

## OpenAI 兼容接口

Ollama 提供 OpenAI 兼容 API，目的是让你把现有的使用 OpenAI SDK 的应用**直接指向 Ollama**。要点（编者注：摘译自官方 OpenAI Compatibility 文档）：

- 端点：`/v1/chat/completions`、`/v1/completions`、`/v1/embeddings`、`/v1/models` 等；
- 把 SDK 的 `base_url` 改为 `http://localhost:11434/v1`，`api_key` 填任意非空字符串（如 `"ollama"`）即可。

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # 必填但可为任意值
)

response = client.chat.completions.create(
    model="gemma4",
    messages=[{"role": "user", "content": "Why is the sky blue?"}],
)
print(response.choices[0].message.content)
```

::: tip 编者注：微调模型的两种进法
1. **Modelfile 方式**：模型已是 GGUF 格式时最简单——写一个 Modelfile（`FROM ./your-model.gguf`，可加 SYSTEM 提示词与对话模板 TEMPLATE），然后 `ollama create mymodel -f Modelfile && ollama run mymodel`。
2. **导入 safetensors**：HuggingFace 格式的 PyTorch/safetensors 模型（如自己 LoRA 合并后的产物）可用 `ollama create` 直接从目录导入，Ollama 会尝试自动转换并匹配对话模板；转换层不支持时可先用 llama.cpp 的 `convert_hf_to_gguf.py` 转 GGUF。细节见[导入模型文档](https://docs.ollama.com/import)与 [Modelfile 参考](https://docs.ollama.com/modelfile)。
:::

## Docker 部署

官方文档给出的最简用法：

```bash
# 仅 CPU
docker run -d -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama

# 有 NVIDIA GPU 时，先装好 NVIDIA Container Toolkit
docker run -d --gpus=all -p 11434:11434 -v ollama:/root/.ollama --name ollama ollama/ollama
```

容器跑起来后即可照常调用 API：

```bash
docker exec -it ollama ollama run gemma4
```

## 生态一瞥

Ollama 的 README 收录了庞大的社区集成清单，常用的几类：

- **聊天界面**：Open WebUI（自托管 Web UI）、AnythingLLM、Cherry Studio、Dify.AI 等；
- **编码工具**：Cline、Continue、Void 等编辑器扩展，以及 Claude Code / Codex / Copilot CLI 等 Agent 集成；
- **框架库**：LiteLLM、LangChain、LlamaIndex、Haystack、Spring AI 等均有 Ollama 连接器；
- **RAG 与知识库**：RAGFlow、MaxKB、AnythingLLM 等；
- **可观测**：Langfuse、MLflow Tracing、OpenLIT 等。

::: tip 编者注：什么时候用 Ollama，什么时候用 vLLM
Ollama 面向**个人/小团队本地使用**：零配置、自动量化、消费级硬件友好（Mac 统一内存尤其舒服），但并发吞吐与调度能力有限。要服务**生产流量**（高并发、大批处理、OpenAI 生态完整兼容、量化 KV cache、连续批处理），应选择 vLLM（见下一篇 [vLLM 高吞吐部署](./14-vllm-high-throughput-deployment)）。
:::

## 小结

- Ollama = llama.cpp 引擎 + 模型仓库 + 标准 API，一行命令完成本地部署。
- 两套 API：原生 REST（`/api/chat`）与 OpenAI 兼容（`/v1/...`），后者让存量代码零改动切换到本地模型。
- 自己微调的模型经 Modelfile/导入流程接入；服务化生产流量则升级到 vLLM。

---

> **来源**：本文翻译自 [Ollama 官方 README](https://github.com/ollama/ollama) 与 [Ollama 官方文档](https://docs.ollama.com)（Quickstart / CLI Reference / OpenAI Compatibility / Docker / Modelfile 各页），作者 Ollama 团队，许可 MIT。抓取于 2026-09-13。
