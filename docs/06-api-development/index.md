---
title: 模块 6 · 模型 API 与应用开发
order: 6
isRoot: true
---

# 模块 6 · 模型 API 与应用开发

从第一次调用到能上线的服务：请求契约、流式、工具调用、结构化输出、可靠性、成本与多模态。

## 学习路径

**调用基础**

- 第一个 API 调用：Responses API 与 Chat Completions
- 消息角色与多轮会话管理
- 流式输出（SSE）
- Responses API 会话与后台任务：conversation、store 与断流续传

**工具与输出契约**

- Function Calling / Tool Use：让模型调用你的函数
- Responses API 托管工具总览与 web_search
- 文件检索与代码解释器：file_search 与 code_interpreter
- JSON Mode 与结构化输出（Structured Outputs）
- MCP 客户端接入：把外部工具生态接到你的模型调用里

**可靠性、安全与成本**

- 错误处理、重试与限流
- Moderation API 与内容过滤
- 成本与 Token 优化：Prompt Caching 与 Batch API
- 模型版本与弃用管理
- 生产可观测性：OpenTelemetry GenAI 语义约定与调用侧埋点
- 并发请求限流：信号量、令牌桶与超时预算

**多模态与向量能力**

- 视觉理解与图像生成：把图片喂给多模态模型，也让它画图
- Embedding API 与文本相似度
- 语音 API：转写、合成与实时会话（选学）
- OpenAI 兼容端点与 LiteLLM：一套代码调用所有模型

**服务化与实战**

- 用 FastAPI 封装 LLM 服务
- 实战：命令行聊天机器人

> 本模块文章全部抓取/翻译自网络公开资料，每篇文末均附署名块标注原文出处与许可。
