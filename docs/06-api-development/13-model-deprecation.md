---
title: 模型版本与弃用管理
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/data/oai_docs/deprecations.txt
author: OpenAI（Deprecations 文档、Prompt Migration Guide）、openai-python（README）、Microsoft（Azure OpenAI v1 API 文档）
license: MIT（OpenAI Cookbook 收录部分）与 Apache 2.0（openai-python 部分）；Azure 部分为 © Microsoft 学习翻译
fetched_at: 2026-09-13
translated: true
versions: 2026-09 口径；Responses API 时代主线，历史弃用记录保留结构示例
order: 13
group: 可靠性、安全与成本
---
模型会退役、端点会关停、SDK 会大版本升级——LLM 应用要活得久，必须把"版本与弃用管理"当作工程的一部分。本文整合三份一手资料：OpenAI 官方弃用文档（经 OpenAI Cookbook 仓库收录）、openai-python 的版本管理章节，以及模型升级时的提示词迁移工作流；另附 Azure OpenAI 的 API 版本演进说明。

## 一、弃用（Deprecation）与遗留（Legacy）

以下翻译自 OpenAI 官方 Deprecations 文档（Cookbook 仓库收录版）。

**概述**：随着更安全、更强的模型发布，OpenAI 会定期退役较旧的模型。依赖 OpenAI 模型的软件可能需要偶尔更新才能继续工作。受影响的客户总会通过邮件与文档获知，重大变化还会辅以[博客文章](https://openai.com/blog)。

**弃用 vs 遗留**——两个术语要分清：

- **弃用（deprecation）**指退役模型或端点的过程。一旦宣布某模型或端点被弃用，它**立即**成为弃用状态；所有被弃用的模型和端点都会有一个**关停日期**（shutdown date）。到了关停时间，该模型或端点将不再可访问。
- **遗留（legacy）**指不再接收更新的模型和端点。把端点和模型标记为 legacy，是 platform 在向开发者示意"我们正往哪里走"，建议迁移到更新的模型或端点。可以预期：遗留模型或端点**将来某个时点会被弃用**。

**增量式模型更新**：正如 OpenAI 在 2023 年 3 月[宣布](https://openai.com/blog/introducing-chatgpt-and-whisper-apis#:~:text=Chat%20guide.-,ChatGPT%20upgrades,-We%20are%20constantly)的那样，`gpt-4`、`gpt-3.5-turbo` 等模型会定期发布新版本。每个模型版本以 `-MMDD` 或 `YYYY-MM-DD` 后缀标注日期（如 `gpt-4-0613`、`gpt-4o-2024-05-13`）；不带日期的模型名（如 `gpt-4o`）通常指向最新的带日期版本。**使用不带日期模型名的用户，通常会在变化生效前约 2 周收到邮件通知。**

**迁移到替代模型**：模型被弃用后，务必在关停日期前把所有用量迁移到合适的替代模型——对已过关停日期模型的请求会直接失败。为帮助衡量替代模型在你任务上的表现，OpenAI 开源了 [Evals](https://github.com/openai/evals) 评估框架；若新模型在你的任务上表现变差，可向 Evals 仓库提交带任务样例的 pull request。

**弃用历史**：官方页面按时间倒序列出全部弃用公告。以最近一条（2024-06-06：GPT-4-32K 与 Vision 预览模型）为例，其表格结构为：

| 关停日期 | 被弃用模型 | 建议替代 |
| --- | --- | --- |
| 2025-06-06 | `gpt-4-32k`（含 `-0613`、`-0314` 变体） | `gpt-4o` |
| 2024-12-06 | `gpt-4-vision-preview`（含 `gpt-4-1106-vision-preview`） | `gpt-4o` |

（官方表格还含"被弃用模型价格"一列，此处省略。）更早的历史条目（2023 年的 `gpt-3.5-turbo-0613` 更新、`/v1/fine-tunes` 旧微调端点关停、InstructGPT 与第一代嵌入模型退役等）沿用同一结构，完整清单见原文链接。这些模型如今均已关停——它们的存在本身就是"关停日期说到做到"的证明。

> 上表的"建议替代"是**公告当时的口径**，属于历史事实的一部分，因此保留 `gpt-4o` 这样的旧名字而不作更新：那条公告发出时 `gpt-4o` 确实是在售替代品。按 2026-09 的货架，`gpt-4o` 本身也已退居历史脉络（现役分层见《主流模型生态对比（2026-09）》）。读这类表格的正确用法是学**结构与流程**——关停日期、替代建议、迁移期限的通知节奏——不要把某一行的替代项当成今天的选型结论。

## 二、SDK 层的版本管理（openai-python）

以下翻译自 openai-python README 的 Versioning 及相关章节（Apache 2.0）。

该包大体遵循 [SemVer](https://semver.org/spec/v2.0.0.html) 约定，但某些向后不兼容的变更可能作为**次版本**发布：

1. 只影响静态类型、不破坏运行时行为的变更；
2. 库内部的变更——技术上公开但不打算或未文档化为外部使用（如果你依赖这类内部结构，请开 GitHub issue 告知）；
3. 预计不会实际影响绝大多数用户的变更。

**最低支持的 Python 版本提升**会作为次版本（而非补丁版本）发布，前提是包元数据能让用户留在最后一个兼容的 SDK 版本上。详见该仓库的《Python version support policy》——其中给出支持窗口、发布处理方式与兼容历史。

官方态度是："我们非常重视向后兼容性，努力确保你能获得平滑的升级体验。"

**确认运行时安装的版本**：如果升级到最新版后仍看不到预期的新功能，很可能是 Python 环境仍在使用旧版本。运行时可以这样确认：

```python
import openai
print(openai.__version__)
```

**大版本迁移的先例**：README 中的 HTTPX2 迁移一节值得参考——HTTPX2 是 SDK 的默认 HTTP 客户端；如果你自定义了 HTTP 客户端、transport、超时、鉴权处理器、事件钩子或请求 mock，升级时应对照官方的 HTTPX2 迁移指南。这展示了 SDK 大版本变更时官方给出的迁移路径模式。

**遗留客户端的处理范例**：Amazon Bedrock 接入中，旧的 `BedrockOpenAI` 与 `AsyncBedrockOpenAI` 客户端"对既有应用继续可用"，但**新应用应改用 `OpenAI(provider=bedrock(...))`**；旧的模块级配置（`openai.api_type = "amazon-bedrock"`）也仅为兼容保留。这正是"legacy 标记 → 引导迁移 → 不删除"的典型处理方式。

## 三、模型升级时的提示词迁移（Cookbook：Prompt Migration Guide）

换模型不只是改个模型名。以下翻译自 OpenAI Cookbook《Prompt Migration Guide》的核心内容（MIT）。

**背景**：GPT-4.1 等较新的模型在性能与指令遵循上是同类最佳。模型越聪明，就越需要调整那些"为旧模型的局限量身定制"的提示词，让它们对新世代依然有效、清晰。GPT-4.1 一类模型对指令**贴身遵循**，但这意味着它会**字面地**解释含糊或表述不佳的指令，导致意外结果。要发挥新模型潜力，每条指令都必须显式、无歧义、与你的意图对齐。

原文给出"含糊指令"的对照示例：

- 含糊："Do not include irrelevant information."（不要包含无关信息。）——问题：若不显式定义"无关"，模型可能因过度谨慎而漏掉关键细节，或反而塞进太多内容。
- 改进："Only include facts directly related to the main topic (X). Exclude personal anecdotes, unrelated historical context, or side discussions."（只包含与主题 X 直接相关的事实；排除个人轶事、无关历史背景与跑题讨论。）

**工作流总览**——该 notebook 的六步法：

1. 输入原始提示词；
2. 识别提示词中的全部指令；
3. 让新模型（GPT-4.1）*批判*该提示词；
4. 自动生成修订后的系统提示词；
5. 评估并迭代；
6. （可选）自动套用 GPT-4.1 最佳实践。

**Step 1**：把现有提示词完整放入三引号。原文示例采用某论文中的 LLM-as-a-Judge 系统提示词（评估两个 AI 助手回答优劣、输出 `[[A]]`/`[[B]]`/`[[C]]` 的裁决格式），并用 tiktoken 计数得 243 tokens 作为基线。

**Step 2：抽取出所有指令**。用结构化输出（Pydantic + `responses.parse`）把提示词中的**强制指令**逐条提取成清单，便于人工复核"哪些句子其实是指令、哪些含糊"：

```python
class Instruction(BaseModel):
    instruction_title: str = Field(description="A 2-8 word title of the instruction that the LLM has to follow.")
    extracted_instruction: str = Field(description="The exact text that was extracted from the system prompt that the instruction is derived from.")

class InstructionList(BaseModel):
    instructions: list[Instruction] = Field(description="A list of instructions and their corresponding extracted text that the LLM has to follow.")

EXTRACT_INSTRUCTIONS_SYSTEM_PROMPT = """
## Role & Objective
You are an **Instruction-Extraction Assistant**.
Your job is to read a System Prompt provided by the user and distill the **mandatory instructions** the target LLM must obey.

## Instructions
1. **Identify Mandatory Instructions**
   • Locate every instruction in the System Prompt that the LLM is explicitly required to follow.
   • Ignore suggestions, best-practice tips, or optional guidance.

2. **Generate Rules**
   • Re-express each mandatory instruction as a clear, concise rule.
   • Provide the extracted text that the instruction is derived from.
   • Each rule must be standalone and imperative.

## Output Format
Return a json object with a list of instructions which contains an instruction_title and their corresponding extracted text that the LLM has to follow. Do not include any other text or comments.

## Constraints
- Include **only** rules that the System Prompt explicitly enforces.
- Omit any guidance that is merely encouraged, implied, or optional.
"""

response = client.responses.parse(
    model=MODEL,
    input="SYSTEM_PROMPT TO ANALYZE: " + original_prompt,
    instructions=EXTRACT_INSTRUCTIONS_SYSTEM_PROMPT,
    temperature=0.0,
    text_format=InstructionList,
)
```

原文点题：指令就是我们用自然语言"编程"模型的方式，确认每条指令清晰、精确、正确至关重要。

**Step 3：让模型自我批判**。模型非常擅长**找出提示词里让自己困惑的部分**。让 GPT-4.1 按四类问题检查原文——歧义（Ambiguity）、缺失定义（Lacking Definitions）、冲突/缺失/含糊的指令、未言明的假设——并要求不杜撰问题、只列有把握的问题，输出为带 `issue/snippet/explanation/suggestion` 字段的 JSON 数组。对示例提示词，模型列出了三条：评估维度（helpfulness、relevance 等）**未定义、未说明权重**；`[[C]]` 平局裁决**未说明何时适用**；"尽可能客观"中的**客观性未定义**。复核后可人工删改问题清单再进入下一步。

**Step 4：自动生成修订版系统提示词**。把原始提示词与问题清单一起交回模型，要求"以最小改动修复列出的问题、保持原有措辞与结构、不引入新内容"。修订版给六个评估维度逐一定义、声明默认等权、并明确"仅当两个回答在所有维度同样强时才选 `[[C]]`"。可用 diff 视图对照新旧版本。

**Step 5：评估并迭代**。用有代表性的评估样例测试修订后的提示词、分析响应是否达成预期、必要时回到前面的步骤。原文的量化验证：以论文原提示词（GPT-4）为基线，与人类标注的一致率为 turn 1 74% / turn 2 71%；换 GPT-4.1 用同一提示词提升到 77% / 72%；**迁移并调优提示词后**达到 80% / 72%——已逼近人类标注员之间的一致率（turn 1 81% / turn 2 76%，以人-人一致率为参考上界）。

**Step 6（可选）：自动套用 GPT-4.1 最佳实践**。用一个强推理模型按最佳实践清单对提示词做"外科手术式"增强（Agent 提醒、`# Role & Objective` 式分节、思维链触发、失败模式缓解、标签定义等），并强烈建议人工复核每一处改动。清单全文见原文与 [4.1 Prompting Guide](https://cookbook.openai.com/examples/gpt4-1_prompting_guide)。

## 四、Azure OpenAI 的 API 版本演进

以下翻译自 Microsoft Learn《Azure OpenAI in Microsoft Foundry Models v1 API》（api-version-lifecycle）。

**API 演进**：此前，Azure OpenAI 以**月度节奏**发布新 API 版本——想用新特性就得跟着每次发布更新代码与环境变量里的 `api-version`；Azure OpenAI 还要求使用 Azure 专属客户端，在 OpenAI 与 Azure OpenAI 之间迁移代码时产生额外开销。

从 2025 年 8 月起，可选择接入下一代 **v1 Azure OpenAI API**，它带来：

- 无需每月指定新 `api-version` 即可持续获得最新特性；
- 更快的 API 发布节奏，新特性更频繁上线；
- 基于密钥认证时，只需极小改动即可在 OpenAI 客户端与 Azure OpenAI 之间切换；
- OpenAI 客户端支持基于令牌的认证与自动令牌刷新，无须依赖独立的 Azure OpenAI 客户端；
- 可调用支持 v1 chat completions 语法的其他提供商模型（如 DeepSeek、Grok）。

预览中的新 API 调用通过**特性专属的 preview 请求头**控制访问——可以按特性选择加入，而不必切换 API 版本；有些特性则通过 API 路径本身标示预览状态（如 `alpha` 路径无需额外请求头）。

**代码变化（Python）**：

```python
import os
from openai import OpenAI

client = OpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    base_url="https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/"
)

response = client.responses.create(
  model="gpt-5.4-mini",  # 换成你的部署名（原文示例为 gpt-4.1-nano）
  input="This is a test.",
)

print(response.model_dump_json(indent=2))
```

与旧 API 的关键差异（原文）：

- 使用 `OpenAI()` 客户端，而非 `AzureOpenAI()`；
- 把 Azure OpenAI 端点传入 `base_url`，并在端点地址后追加 `/openai/v1`；
- v1 GA API **不再要求 `api-version` 参数**。

用 Microsoft Entra ID 认证时，把 `api_key` 参数设为 token provider 即可自动获取并刷新令牌。微软同时提示：新的 API 响应对象可能随时增加，建议只解析你需要的响应字段。

**API 版本更新日志**：该页保留了" Changes between v1 preview release and 2025-04-01-preview"式的逐版本变更清单（如 v1 预览新增视频生成、Responses API 的 MCP 工具集成、异步后台任务、加密推理项、图像生成；2025-03-01-preview 起新增 Responses API 与 computer use 等）。对维护多版本部署的团队，这份 changelog 就是排查"升版本后什么变了"的第一手材料。

## 五、小结

- **分清三个时间点与两个状态**：宣布弃用（立即生效）→ 关停日期（彻底不可用）；legacy 只是"不再更新"，但终将弃用；
- **带日期的模型名**（如 `gpt-4o-2024-05-13`）锁定行为、适合生产；不带日期的名字跟随最新版，变化前约 2 周有邮件通知——按需选择并在配置层集中管理；
- **SDK 版本**遵循"SemVer 为主、例外须公示"的约定；用 `openai.__version__` 确认环境；大版本升级（如 HTTPX2）跟着官方迁移指南走；
- **换模型先迁提示词**：抽取指令 → 模型自批 → 最小修订 → 定量评估 → 可选最佳实践增强，用"与人类标注一致率"这类指标验证迁移效果；
- **Azure 侧**：v1 API 用 `OpenAI()` 客户端 + `/openai/v1` base_url，摆脱月度 `api-version` 追逐；逐版本 changelog 是升级排查的第一站。

---

> **来源**：本文整合翻译自四份一手资料：OpenAI Deprecations 文档（[Cookbook 仓库收录版](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/data/oai_docs/deprecations.txt)，MIT）；openai-python [README](https://raw.githubusercontent.com/openai/openai-python/main/README.md) 的 Versioning / HTTPX2 migration / Legacy BedrockOpenAI 章节（Apache 2.0）；OpenAI Cookbook《[Prompt Migration Guide](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Prompt_migration_guide.ipynb)》（MIT）；Microsoft Learn《[Azure OpenAI in Microsoft Foundry Models v1 API](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle)》（© Microsoft，署名学习翻译）。抓取于 2026-09-13。

---

> **编译说明**：四份资料各成体系，本篇按"平台弃用政策 → SDK 版本管理 → 提示词迁移 → 云厂商 API 版本"的顺序整合；除章节引言与小结外均为原文内容。弃用历史仅全译最近一条并保留表格结构，其余历史条目结构相同、未再罗列；Prompt Migration Guide 的界面辅助代码（卡片渲染、diff 着色）非知识内容，未收录。
