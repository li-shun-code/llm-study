---
title: OpenAI Agents SDK：轻量多智能体框架入门
source_url: https://github.com/openai/openai-agents-python
author: OpenAI
license: MIT
fetched_at: 2026-09-13
translated: true
versions: openai-agents（PyPI 当前版，Python 3.10+）
order: 13
---

# OpenAI Agents SDK

OpenAI Agents SDK 是一个轻量而强大的多智能体工作流框架。它是**提供商无关**（provider-agnostic）的：支持 OpenAI Responses 与 Chat Completions API，也支持 100 多个其他 LLM。

![Agents 追踪界面](https://cdn.openai.com/API/docs/images/orchestration.png)

*图：Agents SDK 的编排与追踪界面。*

> **注**：找 JavaScript/TypeScript 版本？参见 [Agents SDK JS/TS](https://github.com/openai/openai-agents-js)。

## 核心概念

1. **[Agents（智能体）](https://openai.github.io/openai-agents-python/agents)**：配置了指令（instructions）、工具、护栏（guardrails）与交接（handoffs）的 LLM。
2. **[Sandbox agents（沙箱智能体）](https://openai.github.io/openai-agents-python/sandbox_agents)**：预配置为在容器中工作、能在长时间跨度内执行任务的智能体。
3. **[Realtime agents（实时智能体）](https://openai.github.io/openai-agents-python/realtime/quickstart/)**：用 `gpt-realtime-2.1` 与完整智能体特性构建强大的语音智能体。
4. **[Voice agents（语音智能体）](https://openai.github.io/openai-agents-python/voice/quickstart/)**：把语音转文字（STT）、智能体工作流与文字转语音（TTS）串成语音管线。
5. **[Agents as tools](https://openai.github.io/openai-agents-python/tools/#agents-as-tools) / [Handoffs（交接）](https://openai.github.io/openai-agents-python/handoffs/)**：把任务委托给其他智能体。
6. **[Tools（工具）](https://openai.github.io/openai-agents-python/tools/)**：多种工具让智能体执行动作——函数（function tools）、MCP、托管工具（hosted tools）。
7. **[Guardrails（护栏）](https://openai.github.io/openai-agents-python/guardrails/)**：可配置的安全检查，用于输入与输出校验。
8. **[Human in the loop（人在回路）](https://openai.github.io/openai-agents-python/human_in_the_loop/)**：在智能体运行中引入人工介入的内置机制。
9. **[Sessions（会话）](https://openai.github.io/openai-agents-python/sessions/)**：跨智能体运行自动管理对话历史。
10. **[Tracing（追踪）](https://openai.github.io/openai-agents-python/tracing/)**：内置的运行追踪，可视化、调试与优化你的工作流（见本模块第 16 篇）。

浏览 [examples](https://github.com/openai/openai-agents-python/tree/main/examples) 目录查看 SDK 的实际用法；更多细节阅读官方[文档](https://openai.github.io/openai-agents-python/)。

## 开始使用

先配置 Python 环境（需要 Python 3.10 或更新版本），再安装 SDK 包：

### venv

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install openai-agents
```

需要语音支持时安装可选的 `voice` 组：`pip install 'openai-agents[voice]'`；需要 Redis 会话支持时：`pip install 'openai-agents[redis]'`。

### uv

如果你熟悉 [uv](https://docs.astral.sh/uv/)（本站模块 3 有专文介绍），安装更简单：

```bash
uv init
uv add openai-agents
```

## 运行你的第一批智能体

SDK 支持四种主要运行方式。运行前先设置 `OPENAI_API_KEY` 环境变量。

### 运行一个文本智能体

不需要持久实时连接或沙箱工作区的场景，用普通文本 `Agent`：

```python
from agents import Agent, Runner

agent = Agent(name="Assistant", instructions="You are a helpful assistant")

result = Runner.run_sync(agent, "Write a haiku about recursion in programming.")
print(result.final_output)

# Code within the code,
# Functions calling themselves,
# Infinite loop's dance.
```

*（Jupyter notebook 用户参见 [hello_world_jupyter.ipynb](https://github.com/openai/openai-agents-python/blob/main/examples/basic/hello_world_jupyter.ipynb)）*

### 运行一个沙箱智能体

当智能体需要检查文件、运行命令、应用补丁、或在较长任务中保持工作区状态时，使用 `SandboxAgent`。

下例使用 `UnixLocalSandboxClient`（支持 macOS 与 Linux）。Windows 上请使用 `DockerSandboxClient`（安装 `openai-agents[docker]` 扩展）或托管沙箱客户端；设置细节见[沙箱客户端文档](https://openai.github.io/openai-agents-python/sandbox/clients/)。

```python
from agents import Runner
from agents.run import RunConfig
from agents.sandbox import Manifest, SandboxAgent, SandboxRunConfig
from agents.sandbox.entries import GitRepo
from agents.sandbox.sandboxes import UnixLocalSandboxClient

agent = SandboxAgent(
    name="Workspace Assistant",
    instructions="Inspect the sandbox workspace before answering.",
    default_manifest=Manifest(entries={"repo": GitRepo(repo="openai/openai-agents-python", ref="main")}),
)

result = Runner.run_sync(
    agent,
    "Inspect the repo README and summarize what this project does.",
    run_config=RunConfig(sandbox=SandboxRunConfig(client=UnixLocalSandboxClient())),
)
print(result.final_output)
```

沙箱智能体是"代码解释器型 Agent"的工程化形态——模型在受控容器里读写文件、执行命令，而不是在你的宿主机上裸奔（安全考量见第 18 篇）。

### 运行一个实时智能体

低延迟的服务端语音/多模态体验（基于 WebSocket），用 `RealtimeAgent`：

```python
import asyncio
from agents.realtime import RealtimeAgent, RealtimeRunner

async def main() -> None:
    agent = RealtimeAgent(name="Assistant", instructions="You are a helpful voice assistant. Keep responses short.")
    runner = RealtimeRunner(starting_agent=agent)
    session = await runner.run()

    async with session:
        await session.send_message("Say hello in one short sentence.")
        async for event in session:
            if event.type == "audio":
                # 转发或播放 event.audio.data。
                pass
            elif event.type == "history_added":
                print(event.item)
            elif event.type == "agent_end":
                break

if __name__ == "__main__":
    asyncio.run(main())
```

### 运行一个语音智能体

用 `VoicePipeline` 把音频转成文字、运行智能体工作流、再把生成的语音流式输出：

```python
import asyncio

import numpy as np

from agents import Agent
from agents.voice import AudioInput, SingleAgentVoiceWorkflow, VoicePipeline


async def main() -> None:
    agent = Agent(name="Assistant", instructions="You are a helpful voice assistant.")
    pipeline = VoicePipeline(workflow=SingleAgentVoiceWorkflow(agent))
    audio_input = AudioInput(buffer=np.zeros(24000 * 3, dtype=np.int16))

    result = await pipeline.run(audio_input)
    async for event in result.stream():
        if event.type == "voice_stream_event_audio":
            # 转发或播放 event.data。
            pass


if __name__ == "__main__":
    asyncio.run(main())
```

## 致谢

OpenAI 感谢开源社区的出色工作，尤其是 Pydantic、Requests、MCP Python SDK、Griffe。该库还有以下可选依赖：websockets、SQLAlchemy、any-llm 与 LiteLLM；项目工程管理依赖 uv、ruff、mypy、Pyright、pytest、Coverage.py 与 MkDocs。

OpenAI 承诺继续把 Agents SDK 作为开源框架来构建，让社区能在他们的方法之上继续扩展。

# 与本模块其他文章的关系

- 它的 **Tools** 机制就是模块 6 讲过的 Function Calling 的 SDK 封装；**MCP** 一节则展示如何把任意 MCP 服务器的能力挂到 Agent 上（见第 4 篇对比）；
- **Handoffs** 与 **Agents as tools** 是第 9 篇多智能体模式在 SDK 里的两种实现；
- **Guardrails** 与 **Human in the loop** 分别对应第 11、18 篇的安全与审批主题；
- **Tracing** 默认把运行轨迹上传到 OpenAI 控制台，也可导出为 OpenTelemetry 接入 Langfuse 等（第 16 篇）。

一个"最小可用"的心智模型：`Agent` = 指令 + 工具 + 交接；`Runner` = 驱动循环；`result.final_output` = 产出。其余概念都是在这条主干上做加法。

---

> **来源**：本文翻译自 [OpenAI Agents SDK (Python)](https://github.com/openai/openai-agents-python) 官方 README，作者 OpenAI，许可 MIT。抓取于 2026-09-13。该 SDK 即 2025 年 3 月发布的"Agents SDK"（Swarm 的生产化继任者）的当前形态；下文按抓取时的最新版翻译，包含沙箱智能体（Sandbox Agent）与实时语音智能体（Realtime Agent）等新能力。
