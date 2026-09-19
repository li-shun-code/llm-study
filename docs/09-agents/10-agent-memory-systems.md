---
title: 长期记忆系统进阶：Mem0、Letta 与 Zep
source_url: https://github.com/mem0ai/mem0
author: mem0ai/mem0、letta-ai/letta、getzep/zep（三家官方仓库 README 整合）
license: Apache 2.0
fetched_at: 2026-09-13
translated: true
versions: Mem0 2026-04 新记忆算法版；Letta（f.k.a. MemGPT）当前版；Zep Cloud 仓库当前版
order: 10
group: 记忆与上下文管理
---
上一篇的 LangGraph 记忆机制给出了"检查点器 + Store"的基础设施视角。这一篇看三个专门的 Agent 记忆系统：**Mem0**（开箱即用的记忆层）、**Letta**（源自 MemGPT 的有状态智能体框架）与 **Zep**（托管的时间感知记忆服务）。三节均译自各自官方仓库 README，文末逐节署名。

# Mem0：为个性化 AI 而生的记忆层（译自 mem0ai/mem0 README）

## 引言

[Mem0](https://mem0.ai)（"mem-zero"）以智能记忆层增强 AI 助手与智能体，实现个性化的 AI 交互。它记住用户偏好、适应个体需求并随时间持续学习——非常适合客服聊天机器人、AI 助手与自治系统。

## 新记忆算法（2026 年 4 月）

| 基准 | 旧算法 | 新算法 | Tokens | 延迟 p50 |
| --- | --- | --- | --- | --- |
| **LoCoMo** | 71.4 | **92.5** | 7.0K | 0.88s |
| **LongMemEval** | 67.8 | **94.4** | 6.8K | 1.09s |
| **BEAM (1M)** | — | **64.1** | 6.7K | 1.00s |
| **BEAM (10M)** | — | **48.6** | 6.9K | 1.05s |

所有基准都在同一套贴近生产环境的模型栈上运行。检索单趟完成（一次调用、无 agentic 循环），检索预算为 top_200。分数反映 Mem0 的托管平台，其中包含开源 SDK 未包含的专有优化；开源用户可期待方向一致的收益，但数字不会完全相同。

**变化点：**

- **单趟 ADD-only 抽取**——一次 LLM 调用，没有 UPDATE/DELETE。记忆只增不覆盖；
- **智能体生成的事实是一等公民**——当智能体确认某个动作后，该信息现在以同等权重存储；
- **实体链接（Entity Linking）**——实体被抽取、嵌入并跨记忆链接，用于提升检索；
- **多信号检索**——语义、BM25 关键词与实体匹配并行打分并融合；
- **时间推理（Temporal Reasoning）**——时间感知检索，为"当前状态、过去事件、未来计划"类查询排序出正确的时间实例。

升级指引见官方迁移指南（oss-v2-to-v3）；评测框架（memory-benchmarks 仓库）已开源，任何人可复现这些数字。

## 研究亮点

- **LoCoMo 92.5**——比旧算法提升 21 分；
- **LongMemEval 94.4**——提升 27 分，其中助手记忆回忆（assistant memory recall）达 98.2；
- **BEAM (1M) 64.1**——百万 token 规模的生产级记忆评测；
- 完整论文见 mem0.ai/research。

## 核心能力与应用场景

**核心能力：**

- **多层级记忆（Multi-Level Memory）**：无缝保留用户（User）、会话（Session）与智能体（Agent）三个层级的状态，支持自适应个性化；
- **开发者友好**：直观的 API、跨平台 SDK 与全托管服务选项。

**应用场景：**

- **AI 助手**：连贯、上下文丰富的对话；
- **客户支持**：回忆历史工单与用户历史，提供量身定制的帮助；
- **医疗健康**：跟踪患者偏好与病史，实现个性化护理；
- **效率工具与游戏**：基于用户行为的自适应工作流与环境。

## 快速开始

### 以智能体身份注册

AI 智能体可以在五秒内铸得一个可用的 Mem0 API Key——无需邮箱、无需控制台、无需 OTP，端到端只需四条命令：

```bash
# 1. 安装
npm install -g @mem0/cli      # 或: pip install mem0-cli

# 2. 以智能体身份注册（把 claude-code 换成你的名字）
mem0 init --agent --agent-caller claude-code

# 3. 添加一条记忆
mem0 add "I am using mem0"

# 4. 搜索
mem0 search "am I using mem0"
```

人类所有者之后可用 `mem0 init --email <their-email>` 认领账号——同一把 Key，记忆保留。

三种部署形态对比：

| | Library（库） | Self-Hosted Server（自托管服务） | Cloud Platform（云平台） |
|---|---------|-------------------|----------------|
| **最适合** | 测试、原型 | 用自己基础设施的团队 | 零运维的生产使用 |
| **安装** | `pip install mem0ai` | `docker compose up` | 在 app.mem0.ai 注册 |
| **控制台** | — | 有 | 有 |
| **认证与 API Key** | — | 有 | 有 |
| **高级功能** | — | 部分（Teasers） | 全部包含 |

只是测试？用库。团队构建？自托管。想要零运维？上云。

### Library（pip / npm）

```bash
pip install mem0ai
```

需要带 BM25 关键词匹配与实体抽取的增强混合检索时，加装 NLP 支持：

```bash
pip install mem0ai[nlp]
python -m spacy download en_core_web_sm
```

npm 安装：

```bash
npm install mem0ai
```

### 自托管服务

> **注意**：自托管的认证默认开启。从旧的无认证版本升级？设置 `ADMIN_API_KEY`、通过向导注册管理员，或仅在本地开发时设 `AUTH_DISABLED=true`。

```bash
# 推荐：一条命令——启动栈、创建管理员、签发第一个 API Key。
cd server && make bootstrap

# 手动：启动栈，然后在浏览器向导中完成设置。
cd server && docker compose up -d    # http://localhost:3000
```

配置详见自托管文档。

### CLI

在终端里管理记忆：

```bash
npm install -g @mem0/cli   # 或: pip install mem0-cli

mem0 init
mem0 add "Prefers dark mode and vim keybindings" --user-id alice
mem0 search "What does Alice prefer?" --user-id alice
```

### 基本用法

Mem0 需要一个 LLM 才能工作，默认使用 OpenAI 的 `gpt-5-mini`，也支持多种 LLM（详见其 Supported LLMs 文档）。嵌入模型默认为 OpenAI 的 `text-embedding-3-small`；要获得混合检索（语义 + 关键词 + 实体加权）的最佳效果，官方建议至少使用 [Qwen 600M](https://huggingface.co/Alibaba-NLP/gte-Qwen2-1.5B-instruct) 量级或相当的嵌入模型。

第一步是实例化记忆：

```python
from openai import OpenAI
from mem0 import Memory

openai_client = OpenAI()
memory = Memory()

def chat_with_memories(message: str, user_id: str = "default_user") -> str:
    # 检索相关记忆
    relevant_memories = memory.search(query=message, filters={"user_id": user_id}, top_k=3)
    memories_str = "\n".join(f"- {entry['memory']}" for entry in relevant_memories["results"])

    # 生成助手回复
    system_prompt = f"You are a helpful AI. Answer the question based on query and memories.\nUser Memories:\n{memories_str}"
    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": message}]
    response = openai_client.chat.completions.create(model="gpt-5-mini", messages=messages)
    assistant_response = response.choices[0].message.content

    # 从对话中创建新记忆
    messages.append({"role": "assistant", "content": assistant_response})
    memory.add(messages, user_id=user_id)

    return assistant_response

def main():
    print("Chat with AI (type 'exit' to quit)")
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == 'exit':
            print("Goodbye!")
            break
        print(f"AI: {chat_with_memories(user_input)}")

if __name__ == "__main__":
    main()
```

这就是"检索记忆注入系统提示 + 对话后回写记忆"的最小闭环——与上一篇 LangGraph Store 的"读 + 写"两步完全同构，差别在于 Mem0 用 LLM 自动完成记忆的抽取、冲突消解与组织。

## 集成与生态

- **带记忆的 ChatGPT**、浏览器扩展（跨 ChatGPT/Perplexity/Claude 存记忆）、LangGraph 与 CrewAI 集成指南等，见原文 Integrations 一节；
- **Agent Skills**：官方为 Claude Code、Codex、Cursor 等支持 skills 标准的编码助手提供了参考技能（SDK 知识常驻）与流水线技能（按需执行端到端工作流，如 `npx skills add https://github.com/mem0ai/mem0 --skill mem0-integrate`）；
- Mem0 已有可引用论文：*Mem0: Building Production-Ready AI Agents with Scalable Long-Term Memory*（arXiv:2504.19413, 2025）。

# Letta：会学习、会进步的有状态智能体（译自 letta-ai/letta README）

构建拥有记忆、能随时间学习与进步的有状态智能体（stateful agents）。

Letta（旧名 MemGPT）仍在活跃开发。当前源码位于 [`letta-ai/letta-code`](https://github.com/letta-ai/letta-code) 仓库，包含智能体运行框架（agent harness）、交互式终端 UI、App Server、通道（channels），以及桌面与网页应用共用的运行时。

## 开始使用

从 npm 安装 Letta：

```bash
npm install -g @letta-ai/letta-code
```

启动交互式终端 UI：

```bash
letta
```

为本地或自托管智能体运行 App Server：

```bash
letta server
```

你还可以通过以下方式使用 Letta：

- [桌面应用](https://docs.letta.com/letta-code/desktop-app)：支持 macOS、Windows 与 Linux；
- 浏览器访问 [chat.letta.com](https://chat.letta.com)，包括移动端；
- [Slack、Telegram、Discord 与自定义通道](https://docs.letta.com/letta-code/channels)；
- [Letta Agent SDK](https://docs.letta.com/letta-agent-sdk/overview)：把智能体内嵌到 TypeScript 应用中；
- [Letta Cloud](https://github.com/letta-ai/letta-code#letta-cloud)：让智能体记忆、身份与会话跨设备可用。

当前安装、开发与部署说明请查阅 [Letta 文档](https://docs.letta.com)。

## 历史源码

[`archive`](https://github.com/letta-ai/letta/tree/archive) 分支保留已退役的 Letta V1 API 服务器。现有 tag 与 release 仍可用于复现，但新项目应使用[当前源码](https://github.com/letta-ai/letta-code)。

> Letta 的核心思想（MemGPT 论文提出）是把 LLM 当作操作系统的"处理器"、把上下文窗口当作"内存"，由智能体自行分页管理记忆——这正是本模块记忆三篇中"由模型自己管理分层记忆"路线的代表。

# Zep：Zep Cloud 示例与集成（译自 getzep/zep README）

## 关于本仓库

本仓库**不是** Zep 的产品或服务本身。它包含用 [Zep Cloud](https://www.getzep.com/)（Zep 托管式智能体记忆平台）构建智能体记忆的**示例代码、框架集成与工具**。

使用 Zep Cloud：在 [www.getzep.com](https://www.getzep.com/) 注册，文档见 [help.getzep.com](https://help.getzep.com)。官方 SDK：

- **Python**：`pip install zep-cloud`
- **TypeScript/JavaScript**：`npm install @getzep/zep-cloud`
- **Go**：`go get github.com/getzep/zep-go/v3`

> 在找驱动 Zep 的开源时序知识图谱框架？见 [Graphiti](https://github.com/getzep/graphiti)。

## 仓库内容

| 项目 / 目录 | 描述 |
|---------------------|-------------|
| `examples/` | Python、TypeScript、Go 的示例应用与代码片段 |
| `integrations/` | 智能体框架集成包 |
| `ingestion/` | `zep-ingest`——批量数据摄取管道（Slack、文档、邮件、JSON/CSV、事实三元组） |
| `ontology/` | 默认本体（ontology）定义 |
| Build with Zep | Claude Code、Codex、Cursor 的智能体插件（独立仓库） |
| Zep Memory | Claude Desktop/Cowork 与 ChatGPT Work 的智能体插件（独立仓库） |
| `benchmarks/` | 记忆基准（LoCoMo、LongMemEval） |
| `zep-eval-harness/` | 摄取与检索的评测框架 |
| `legacy/` | 已废弃的 Zep Community Edition（不受支持） |

## 框架集成

框架集成包位于 `integrations/` 目录，先按框架再按语言组织：`integrations/<framework>/<language>/`。每个包独立构建、测试与发布：

- **Python**：Google ADK、Microsoft Agent Framework、Microsoft AutoGen、AG2、CrewAI、LangGraph、LiveKit、Pydantic AI、Strands Agents；
- **TypeScript**：Google ADK、Mastra、Vercel AI SDK；
- **Go**：Google ADK。

## 社区版（已废弃）

Zep Community Edition 不再受支持，代码已移入 `legacy/` 目录（详见官方博客《Announcing a New Direction for Zep's Open Source Strategy》）。生产使用转向 Zep Cloud；开源图谱能力则由 Graphiti 承载。

---

> **来源**：抓取于 2026-09-13。① 第一节译自 [mem0ai/mem0](https://github.com/mem0ai/mem0) 官方仓库 README，作者 Mem0 团队，许可 Apache 2.0（徽章、Trendshift 图与外部链接列表等排版元素未译；基准数字为原文 2026 年 4 月数据，平台与开源版差异的原文免责说明已如实保留）；② 第二节译自 [letta-ai/letta](https://github.com/letta-ai/letta) 官方仓库 README，作者 Letta 团队，许可 Apache 2.0（全文翻译；文末关于 MemGPT 分页记忆思想的段落为本篇编者注，非原文内容）；③ 第三节译自 [getzep/zep](https://github.com/getzep/zep) 官方仓库 README，作者 Zep 团队，许可 Apache 2.0（全文翻译；徽章与图片未译）。三节之间的小结性导语与 Mem0 节末的编者对比段为本篇编者注，不属原文。
