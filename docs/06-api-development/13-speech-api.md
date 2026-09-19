---
title: 语音 API：转写、合成与实时会话（选学）
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Speech_transcription_methods.ipynb
author: OpenAI Cookbook（Comparing Speech-to-Text Methods、Steering Text-to-Speech）、OpenAI（openai-python README · Realtime）
license: MIT / Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: gpt-4o-transcribe / gpt-4o-mini-transcribe（转写）、tts-1 与 tts-1-hd（传统合成）、gpt-4o-mini-tts 与 gpt-4o-audio-preview（可用提示词指挥）、gpt-realtime-2（Realtime）
order: 13
group: 多模态与向量能力
---
## 一、语音转写（ASR）：四种方式怎么选

Cookbook 的对比表先给出全景（原文翻译）：

**表：语音转文本（STT）方式对比**

| 方式 | 首个 token 延迟 | 适用场景（实例） | 优点 | 关键限制 |
| --- | --- | --- | --- | --- |
| 文件上传 + 非流式（阻塞） | 秒级 | 语音留言、会议录音 | 接入简单 | 无部分结果；单请求上限 25 MB（长音频需切段） |
| 文件上传 + 流式 | 亚秒级 | 移动端语音备忘录 | 简单且"边转边出" | 仍需完整文件；进度条/分块自己实现 |
| Realtime WebSocket | 亚秒级 | 直播实时字幕 | 真实时、接受连续音频流 | 音频仅限 pcm16/g711；会话 ≤30 分钟需重连拼接 |
| Agents SDK VoicePipeline | 亚秒级 | 内部客服助手 | 实时流式 + 便捷的 Agent 工作流 | 仅 Python beta；API 可能变动 |

### 1. 完整音频文件转写（最简单）

支持 mp3、mp4、mpeg、mpga、m4a、wav、webm，单文件 ≤25 MB（约 30 分钟 16kHz 单声道 WAV）：

```python
AUDIO_PATH = Path('./data/sample_audio_files/lotsoftimes-78085.mp3')  # 换成你的文件
MODEL_NAME = "gpt-4o-transcribe"

if AUDIO_PATH.exists():
    with AUDIO_PATH.open('rb') as f:
        transcript = client.audio.transcriptions.create(
            file=f,
            model=MODEL_NAME,
            response_format='text',
        )
    print('\n--- TRANSCRIPT ---\n')
    print(transcript)
```

原始输出：

```text
--- TRANSCRIPT ---

And lots of times you need to give people more than one link at a time. A band could
give their fans a couple new videos from a live concert, a behind-the-scenes photo
gallery, an album to purchase, like these next few links.
```

### 2. 文件转写 + 流式输出

同一个端点加 `stream=True`，增量事件用 `event.delta` 取增量、`event.text` 取终稿：

```python
with AUDIO_PATH.open('rb') as f:
    stream = client.audio.transcriptions.create(
        file=f,
        model=MODEL_NAME,
        response_format='text',
        stream=True
    )

for event in stream:
    if getattr(event, "delta", None):
        print(event.delta, end="", flush=True)
    elif getattr(event, "text", None):
        print()
        print("\n" + event.text)  # 转写完成时的最终全文
```

### 3. Realtime 转写 API（WebSocket）

真正的流式：延迟约 300–800 ms，内置语音活动检测（VAD）、降噪，适合会议实时字幕。限制：单会话 30 分钟；仅接受原始 PCM（pcm16 需 24kHz、16bit、单声道、小端序）。Cookbook 用 WebSockets 直连（也可用 WebRTC，详见官方 Realtime 指南）。

### 4. Agents SDK VoicePipeline（beta）

把"音频入 → 转写 → Agent → TTS 出"整条链封装成一个 `VoicePipeline`，自动处理重采样、VAD、缓冲与重连（`pip install openai-agents`）：

```python
from agents import Agent
from agents.voice import (
    SingleAgentVoiceWorkflow,
    StreamedAudioInput,
    VoicePipeline,
    VoicePipelineConfig,
)
```

属 beta，API 面可能变化，适合概念验证。

## 二、语音合成（TTS）：传统方式与可"指挥"的方式

### 1. 传统 TTS：指定音色

```python
from openai import OpenAI
client = OpenAI()

tts_text = """
Once upon a time, Leo the lion cub woke up to the smell of pancakes and scrambled eggs.
His tummy rumbled with excitement as he raced to the kitchen. Mama Lion had made a breakfast feast!
"""

speech_file_path = "./sounds/default_tts.mp3"
response = client.audio.speech.create(
    model="tts-1-hd",            # 传统档：tts-1 / tts-1-hd，只选音色不选语气
    voice="alloy",   # alloy 等预置音色
    input=tts_text,
)

response.write_to_file(speech_file_path)
```

传统 TTS 能指定音色，但**指定不了语气、口音、语速**这类情境参数。

### 2. 音频版 Chat Completions：用提示词"指挥"声音

Cookbook 的"可指挥 TTS"（steerable TTS）：用 `gpt-4o-audio-preview`，`modalities` 同时声明文本与音频，`audio` 参数指定音色与格式，然后用系统提示词控制口音语速：

```python
import base64

speech_file_path = "./sounds/chat_completions_tts.mp3"
completion = client.chat.completions.create(
    model="gpt-4o-audio-preview",
    modalities=["text", "audio"],
    audio={"voice": "alloy", "format": "mp3"},
    messages=[
        {
            "role": "developer",  # 现行角色名（旧文档写 system，语义等价）
            "content": "You are a helpful assistant that can generate audio from text. Speak in a British accent and enunciate like you're talking to a child.",
        },
        {
            "role": "user",
            "content": tts_text,
        }
    ],
)

mp3_bytes = base64.b64decode(completion.choices[0].message.audio.data)
with open(speech_file_path, "wb") as f:
    f.write(mp3_bytes)
```

换个系统提示词就是另一种声音（"Speak in a British accent and speak really fast"），甚至可以先让模型把文本翻译成西语、再用乌拉圭口音念出来（原文的多语言示例）。应用价值（原文总结）：更有表现力的语气/情绪控制、语言教学中的口音与发音示范、虚拟助手的情境化语音。

## 三、Realtime API：低延迟多模态会话

openai-python README 的 Realtime 一节给出最小文本示例——通过 WebSocket 会话收发事件（`gpt-realtime-2`）：

```python
import asyncio
from openai import AsyncOpenAI

async def main():
    client = AsyncOpenAI()

    async with client.realtime.connect(model="gpt-realtime-2") as connection:
        await connection.session.update(
            session={"type": "realtime", "output_modalities": ["text"]}
        )

        await connection.conversation.item.create(
            item={
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": "Say hello!"}],
            }
        )
        await connection.response.create()

        async for event in connection:
            if event.type == "response.output_text.delta":
                print(event.delta, flush=True, end="")

            elif event.type == "response.output_text.done":
                print()

            elif event.type == "response.done":
                break

asyncio.run(main())
```

README 特别强调 Realtime 的错误处理：发生错误时服务端会发一个 `error` **事件**，连接保持可用，**SDK 不会抛异常**——必须自己在事件循环里处理：

```python
async for event in connection:
    if event.type == 'error':
        print(event.error.type)
        print(event.error.code)
        print(event.error.event_id)
        print(event.error.message)
```

音频输入/输出（真正的语音对话）可参考 README 指向的官方 push-to-talk TUI 示例脚本。

## 四、本篇小结

- ASR 三档：文件阻塞式（最简单）→ 文件流式 → Realtime WebSocket（300–800ms，仅原始 PCM、会话 30 分钟上限）；
- 模型分档别混：转写 `gpt-4o-transcribe`（快档 `gpt-4o-mini-transcribe`）；合成传统档 `tts-1`/`tts-1-hd`、可指挥档 `gpt-4o-mini-tts`；要音频输入 + 音频输出用 `gpt-4o-audio-preview`；实时对话走 `gpt-realtime-2`；
- TTS 输出是 base64 编码的音频字节，解码后写文件即可；
- Realtime 的错误是事件不是异常，必须手动处理；
- 一句话选型：录好的音频用文件转写；实时字幕/语音对话上 Realtime。

至此，文本、图像、语音三类模态的 API 都过了一遍。工程主线请回看《错误处理、重试与限流》。

---

> **来源**：本文翻译自 [Comparing Speech-to-Text Methods with the OpenAI API](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Speech_transcription_methods.ipynb)、[Steering Text-to-Speech for more dynamic audio generation](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/voice_solutions/steering_tts.ipynb)（OpenAI Cookbook，MIT）与 [openai-python README · Realtime API](https://raw.githubusercontent.com/openai/openai-python/main/README.md)（Apache 2.0），作者 OpenAI，许可 MIT / Apache 2.0。抓取于 2026-09-13。

---

> 本篇标注为**选学**：语音链路（ASR/TTS/Realtime）在 LLM 应用岗位中属加分项，不阻塞后续模块。ASR 即自动语音识别（Automatic Speech Recognition），TTS 即语音合成（Text-to-Speech）。
