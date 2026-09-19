---
title: 成本管理：Token 消耗、订阅选择与用量优化
source_url: https://code.claude.com/docs/en/costs
author: Anthropic（Claude Code 官方文档 Manage costs effectively）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途翻译并署名）
fetched_at: 2026-09-19
translated: true
order: 12
group: 用量与成本
---
前面各篇讲的是"AI 代码的隐性风险"——安全陷阱、供应链投毒与合规责任；本篇讲另一种隐性成本——**字面意义的账单**。《心智模型：LLM 如何"看"你的代码》说过"上下文是稀缺资源"；稀缺的另一面就是"贵"。当无人值守的智能体（《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》）成批消耗 token 时，成本管理就从"个人习惯"升级为"工程问题"。本篇主体翻译 Claude Code 官方文档《Manage costs effectively》：如何看账、如何按组织设限、以及十几种降耗策略。

> 官方开篇即给出基准数字：Claude Code 按 API token 消耗计费（订阅计划按月付）。各企业部署的**平均成本约为每个开发者每个活跃日 13 美元、每月 150-250 美元**，90% 的用户保持在每日 30 美元以下。官方建议：先小规模试点，用下文的跟踪工具建立基线，再推广。

## 一、看账：/usage 与 /insights（译自 Track your costs）

### `/usage`：会话与计划的用量仪表盘

`/usage` 顶部的 Session 块展示当前会话的明细（API 计费用户适用；订阅用户在同一屏看到计划用量条与活动统计）：

```text
Total cost:            $0.55
Total duration (API):  6m 20s
Total duration (wall): 6h 33m 10s
Total code changes:    0 lines added, 0 lines removed
Usage by model:
   claude-sonnet-4-6:  1.2k input, 5.3k output, 940.0k cache read, 50.0k cache write ($0.55)
```

注意两个细节：金额由 Claude Code 在本地按牌价估算（权威账单以 Claude Console 的 Usage 页为准；企业可用 `modelPricing` 托管设置让显示按合同价计算）；`/clear` 会重置这些累计——**这也意味着"一个会话"就是成本核算的最小单元**。

订阅计划的 `/usage` 还提供**归因拆解**（attributions）：最近的用量按技能、子智能体、插件、单个 MCP 服务器以百分比归因——你能直接看到"哪个 MCP 服务器吃掉了 20% 的额度"；行为标记会把占用量 ≥10% 的行为（如长上下文、缓存未命中）单独标出并附降耗建议；还有最近定时任务（loops）按 token 排行的明细。按 `d`/`w` 切换 24 小时/7 天窗口。

### Prompt cache 统计：为什么"缓存命中"就是省钱

`/usage` 会显示 `Prompt cache (main)` 行——本次会话提示缓存的命中率、未命中次数与缓存冷热状态。缓存未命中（miss）意味着"重新处理了缓存里已有的内容"，常见诱因包括工具定义变化等（官方提示缓存页有完整清单）。这一行把《心智模型：LLM 如何"看"你的代码》讲的"上下文经济学"变成了可观测指标：**同样一个问题，在热缓存的会话里和在冷缓存的会话里，成本可能差一个数量级**。

### `/insights`：不止于 token 的工作方式报告

`/insights` 分析本机最近的会话（单次最多 200 个），产出一份 HTML 报告：你在做什么工作、摩擦点（被误解的请求、有 Bug 的代码）、以及更高效使用 Claude Code 的建议。报告写在 `~/.claude/usage-data/report.html` 并保留带时间戳的历史副本。

## 二、组织的成本控制（译自 Manage costs for your organization）

控制手段取决于接入方式：Teams/Enterprise 计划按成员席位额度（五小时滚动窗口 + 每周窗口重置）；Claude Console（API）按 token 计费到工作区（首次用 Console 登录会自动创建"Claude Code"工作区做集中核算，可为它单独设花费上限与速率上限以保护其他生产负载）；云厂商（Bedrock/Google Cloud/Foundry）走各云的预算控制。**OpenTelemetry 导出在所有方式下都可用**，是把每用户 token 与成本指标实时灌进自有可观测栈的唯一选项。

给管理者的两条官方提醒值得原样保留：其一，用 `modelPricing` 托管设置把显示价换成合同价（只改显示、不改计费）；其二，**给编码席位比聊天席位预留更多预算**——Claude Code 每一轮都携带文件内容、工具调用与多步推理，"一次调试会话可能消耗超过一整天的聊天"。

## 三、降耗清单（译自 Reduce token usage）

官方开宗明义：**token 成本随上下文规模线性放大**。Claude Code 已自动通过提示缓存与自动压缩优化，下面是人工可做的策略：

1. **主动管理上下文**
   - **任务之间 `/clear`**：切到不相关的工作就开新会话——陈旧上下文让每条后续消息都多付 token；清之前用 `/rename` 命名、之后 `/resume` 可随时回来
   - **自定义压缩指令**：`/compact Focus on code samples and API usage` 指定摘要保留什么；或在 CLAUDE.md 里写 "Compact instructions" 一节
2. **选对模型**：Sonnet 能胜任大多数编码任务且便宜得多，Opus 留给复杂架构决策与多步推理；子智能体干简单活时在配置里指定 `model: haiku`。按 2026-09 的 API 牌价（每百万 token 输入/输出）：**Sonnet 5 $2/$10、Opus 5 $5/$25、Haiku 4.5 $1/$5、Fable 5.1 $10/$50**——**同一档位内部的价差是 5 倍，跨档位是 25 倍**；而 Claude Code 的默认模型按账号类型解析（Pro/Team 标准席默认 Sonnet 5，Max/Team Premium/Enterprise/API 默认 Opus 5），**你不需要为"默认值是什么"付钱，只需要为"你把它调成了什么"付钱**
3. **降低 MCP 开销**：MCP 工具定义默认延迟加载；**能用 CLI 就别用 MCP**——`gh`、`aws`、`gcloud` 这类命令行工具不增加任何工具清单开销，Claude 可以直接执行；`/mcp` 里禁用不活跃的服务器
4. **给类型化语言装代码智能插件**：精确的符号导航（"go to definition"一次顶 grep+读多个候选文件），编辑后自动报告类型错误——省掉不必要的文件读取与编译
5. **把处理卸载给 hooks 与技能**：与其让 Claude 读一万行日志找错误，不如用 PreToolUse hook 先 grep 出 `ERROR` 行——上下文从几万 token 降到几百；"codebase-overview"技能让架构、目录、命名规范即调即得，不必花 token 读一堆文件摸结构（官方附了过滤测试输出的 hook 完整脚本）
6. **把指令从 CLAUDE.md 挪进技能**：CLAUDE.md 每次会话都全文加载；专用流程（PR 评审、数据库迁移）挪进按需加载的技能，**CLAUDE.md 目标控制在 200 行以内**
7. **调整扩展思考与投入档位**：扩展思考默认开启（显著提升规划与推理），但 thinking token 按输出计费、默认预算可达每请求数万 token。**2026 年更要紧的杠杆是"投入档位（effort level）"**：Fable 5.1/5、Opus 5、Sonnet 5、Opus 4.8/4.7 支持 `low`/`medium`/`high`/`xhigh`/`max` 五档，Opus 4.6 与 Sonnet 4.6 没有 `xhigh`（设了会回落到 `high`），不支持 effort 的模型设了也不生效。这一档对账单的影响远超直觉——《AI 编码工具与模型评测基准：SWE-bench 与 Terminal-Bench》里那份 Terminal-Bench 4.0 榜单快照就是同一"脚手架 + 模型"只调档位，成绩从 34.9% 走到 53.9%、成本从 $1,557 走到 $5,969。**默认值不是最优值：机械任务降档、评审与规则撰写升档**，这与《开源编码 Skills（一）：Superpowers 编码流程族》的"每个角色用能胜任的最弱模型"是同一条建议
8. **把冗长操作委托给子智能体**：子智能体在自己的上下文里翻找，只把总结带回主上下文
9. **提示词写具体**：明确的目标减少来回轮次——每一轮都携带全部上下文

### 为什么长会话的用量会"自己涨"

官方专门列了长会话用量高于直觉的原因，每一条都值得贴在墙上：

- **长上下文**：每次请求都携带完整对话——开了整天才会话里的一行提问，仍按整段对话计费（缓存命中时按缓存价，但依旧计费）
- **缓存未命中**：超过缓存生命周期（订阅一小时；使用量积分后降为五分钟；API Key/云厂商默认五分钟）后的第一条消息会重处理全部上下文
- **定时任务与跨会话消息**：会话空闲时定时任务照常触发、别的会话发来消息也会开新一轮——每轮都带全量上下文
- **`/compact` 本身就是大请求**：它要读整段对话才能摘要——想要新开始时，`/clear` 才是零成本选项

> 译注：把本篇与《上下文工程：为 AI Agent 管理稀缺的注意力》对读，会发现"省 token 的手段"与"让 AI 更强的手段"高度重合——上下文越小越聚焦，模型表现越好、成本越低。**降耗的本质不是少用 AI，而是让每一个 token 都在干活。**

---

> 延伸阅读：个人的账单管好了，最后一公里是组织——AI 编码规范怎么在团队落地、用什么指标度量采纳与效果，见《团队落地：AI 编码规范的团队推广与度量》。

> **来源**：本文翻译自 [Manage costs effectively](https://code.claude.com/docs/en/costs)（Claude Code 官方文档，2026-09 当前版），作者 Anthropic，许可署名翻译（Copyright Anthropic PBC，教学用途）。"选对模型"里补入的 2026-09 牌价与账号默认模型、"投入档位"一节补入的 effort 档位支持表，核自 [Model configuration](https://code.claude.com/docs/en/model-config)（Anthropic，2026-09-19）与 [Claude Pricing](https://claude.com/pricing)；榜单成本数据取自《AI 编码工具与模型评测基准：SWE-bench 与 Terminal-Bench》一文的 Terminal-Bench 4.0 快照。"译注"与编者补充均已标明；长尾小节（usage-credits 管理、各计费路径的报表细节、行为变化说明等）从略，见原文。首次抓取 2026-09-13，2026-09-19 复核官方开篇基准数字（每开发者每活跃日均约 13 美元、每月 150-250 美元、90% 用户低于每日 30 美元）仍然成立。
