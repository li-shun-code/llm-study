# 模块 5（Prompt 工程）来源报告

抓取日期：2026-09-13。目标 ≥10 篇，实际完成 11 篇，全部为英文一手资料翻译并署名。
2026-09-13 二次补充：新增 2 篇（提示链、上下文工程），删除与模块 6 重复的 1 篇（结构化输出），全文按插入位置重编号。

## 抓取失败与替代

| 主题 | 原 URL | 失败原因 | 替代文章 |
|---|---|---|---|
| 提示词基本结构 / 系统提示词 / 多模态提示（候选） | https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/*（现重定向 platform.claude.com） | Anthropic 文档整域对本机所在区域拦截：docs.claude.com 302 → platform.claude.com → 307 `app-unavailable-in-region`（WebFetch 同样被拦，web_reader 服务限流） | 计划内候选 promptingguide.ai（MIT）与 OpenAI Cookbook raw 通道可用，改用两者组合；Anthropic 官方文档未能收录，已用其他一手资料补足同等知识点 |
| 结构化输出 / 提示工程指南（候选） | https://platform.openai.com/docs/guides/prompt-engineering、/docs/guides/structured-outputs | curl 被 Cloudflare 拦截（HTTP 403 "Sorry, you have been blocked"）；WebFetch 亦 403 | 改用 OpenAI Cookbook 的 GitHub raw 通道（raw.githubusercontent.com，MIT）：Structured_Outputs_Intro.ipynb、gpt-5/prompt-optimization-cookbook.ipynb 等，内容同源且更新 |
| 多模态提示（首选） | https://ai.google.dev/gemini-api/docs/prompting-strategies、/docs/vision、/docs/system-instructions | ai.google.dev 连接超时/返回 0 字节（curl 与 WebFetch 均失败） | 改译 OpenAI Cookbook《Getting the Most out of GPT-5.4 for Vision and Document Understanding》（2026-09 现行版，MIT） |
| 提示迭代评估方法（初选） | https://www.promptingguide.ai/guides/optimizing-prompts | 可抓取，但正文仅为一篇简短的方法综述，撑不起"迭代评估"知识点 | 改译 OpenAI Cookbook prompt-optimization-cookbook（基线→生成→定量评估→优化→LLM-as-Judge→FailSafeQA 的完整闭环） |

> 备注（2026-09-13 补充抓取）：Anthropic 工程博客（www.anthropic.com/engineering/*）**不在** docs.claude.com 的区域封锁范围内，curl 直取 200 全文——08 上下文工程一篇即以此通道抓取；Anthropic 学习文档域（platform.claude.com）仍然被拦。

## 时效性校订说明（2026-09 口径）

- **06 提示链**：promptingguide 原文示例基于 gpt-4-1106-preview（长上下文），概念不变，保留原文代码与输出；另译 OpenAI Cookbook《Using chained calls for reasoning structured outputs》作 API 层补充，译注说明现行推理模型已原生支持结构化输出。
- **08 上下文工程**：Anthropic 工程博客原文发布于 2025-09-29，为 Agent 时代通用工程原则；文中 Claude Code、记忆工具等产品名为 Anthropic 生态术语，文末编译说明注明概念同构性。
- **07 系统提示词**：GPT-4.1 提示指南（2025-04，Cookbook 现行收录）示例本身使用 `responses.create`，无需降级改写；文首注明节选编译与"GPT-4.1"表述的适用范围。
- **05 ReAct**：原页实战小节使用旧版 LangChain（`text-davinci-003`、`initialize_agent`），属已废弃写法，按计划要求不收。保留原文执行轨迹演示，另以"译注"提供 Responses API + 函数调用的现代 ReAct 循环骨架（已注明为校订补充）。
- **02 零样本/少样本、03 CoT、04 自洽性**：promptingguide 概念篇按"经典教材、概念仍准确"的定位收录；文中模型名与结论已在译注处按当前推理模型口径补充说明。
- **09 提示注入**：Simon Willison 2023-04 经典文；文末"译注"指向其系列后续（Dual LLM pattern 等，均来自抓取页面内的系列列表），未杜撰观点。

## 去重与重编号记录（2026-09-13）

- **删除 06「结构化输出：让模型严格遵循 JSON Schema」**（原译自 Structured_Outputs_Intro.ipynb）：与模块 6 第 06 篇《JSON Mode 与结构化输出》同源重复；按计划保留模块 6 的 API 实现版。index.md 已加文字指引"结构化输出的 API 实现见模块 6 第 06 篇"（计划行文写作"第 05 篇"，因本模块 6 插入托管工具后结构化输出顺延为第 06 篇，按实际位置标注）。
- **新增 06「提示链与任务分解」**插到 05 ReAct 之后；**新增 08「上下文工程」**插到 07 系统提示词之后；08-10 原文（提示注入/多模态/迭代评估）顺延为 09-11，frontmatter order 同步。
- 交叉引用同步：07 篇内"本模块第 10 篇"改为第 11 篇；10（原 09）多模态篇内"详见本模块'结构化输出'一篇"改为指向模块 6。

## 备注

- promptingguide.ai 对应仓库 dair-ai/Prompt-Engineering-Guide 为 MIT 许可；OpenAI Cookbook 为 MIT；Simon Willison 博客与 Anthropic 工程博客无开放许可声明，按"署名学习翻译"处理并在署名块如实标注（同模块 2 对 restfulapi.net 的处理先例）。
- 11 篇均无失效图片依赖：promptingguide 的图改用站内绝对外链，Cookbook notebook 的本地图片以文字说明替代并附原文链接；上下文工程一篇的两张 Anthropic 插图保留官网 CDN 绝对外链。
- 临时抓取文件均位于 /tmp/wd-fetch、/tmp/pmt5-*，未污染仓库。
- 未执行 vitepress build 与 git 提交（按任务约束）。
