---
title: 开源编码 Skills（三）：工具集成族
source_url: https://github.com/anthropics/skills
author: Anthropic（anthropics/skills 的 mcp-builder、webapp-testing、web-artifacts-builder、claude-api、frontend-design）
license: Apache-2.0（anthropics/skills example-skills 各技能目录附 LICENSE.txt）
fetched_at: 2026-09-19
translated: true
order: 5
group: 项目规范与技能包
---
前一篇谈"怎么写技能"，这一篇谈**技能能替你把哪类工具活干完**。Anthropic 官方技能仓库里有一组技能，它们的共同点不是"流程更严"，而是**把某个工具链的完整工程方法打包成可加载的参考**：怎么建一个高质量 MCP 服务器、怎么用 Playwright 真跑一遍本地 Web 应用、怎么把多组件前端打成单个 HTML artifact、怎么在 2026 年的 API 形态下调用 Claude 而不被训练先验坑到。这四个技能是纯编码技能，也是本系列最"能马上用"的一篇。

本系列三篇可独立阅读：《开源编码 Skills（一）：Superpowers 编码流程族》《开源编码 Skills（二）：技能写作与文档协作族》《开源编码 Skills（三）：工具集成族》。

> 时效注记：以下均译自 [anthropics/skills](https://github.com/anthropics/skills) 仓库对应目录的 `SKILL.md`（2026-09-13 抓取、2026-09-19 复核目录），Apache-2.0 许可。仓库 README 的免责声明同样适用于本篇：**这些技能用于演示与教学**，你从 Claude 产品里拿到的实现可能与仓库展示的不同，关键任务前先在自己的环境测。官方文档站与模型清单会变，涉及模型 id、价格、参数名时以 `platform.claude.com` 当前文档为准。

## 一、mcp-builder：MCP 服务器的质量是怎么定义的

*以下译自 `skills/mcp-builder/SKILL.md`（正文约 240 行，四阶段流程节译）。*


> **description（全译）**：创建高质量 MCP（Model Context Protocol）服务器的指南——让 LLM 通过设计良好的工具与外部服务交互。构建 MCP 服务器以集成外部 API 或服务时使用，Python（FastMCP）或 Node/TypeScript（MCP SDK）均可。

核心内容（正文约 240 行，译四阶段流程并注明节选）：高质量 MCP 服务器的质量，以"让 LLM 完成真实任务的程度"衡量。**阶段一：深度研究与规划**——理解现代 MCP 设计：在"API 全覆盖"与"工作流工具"间平衡（拿不准就优先全覆盖）；工具命名用一致前缀+动作导向（如 `github_create_issue`）；上下文管理靠简洁的工具描述与过滤/分页；错误信息要可行动（给出具体建议与下一步）。研究 MCP 规范（从 sitemap 找页、加 `.md` 后缀抓取）与框架文档——**推荐栈：TypeScript**（SDK 质量高、MCPB 等执行环境兼容性好、模型生成 TS 代码质量高），传输用 Streamable HTTP（远端，无状态 JSON 更易扩展）或 stdio（本地）。研究目标服务 API、列出端点清单。**阶段二：实现**——按语言指南搭项目结构；实现核心基础设施（带鉴权的 API 客户端、错误处理助手、JSON/Markdown 响应格式化、分页）；逐个实现工具：输入 schema 用 Zod/Pydantic（带约束与清晰描述、字段描述里放示例），能定义 `outputSchema` 就定义并用 `structuredContent` 返回结构化数据；异步 I/O、可行动的错误处理、支持分页；注解（如 `readOnlyHint`）。**阶段三：评审与测试**——代码质量检查与构建测试。**阶段四：创建评估**——理解评估目的，创建 10 道评估题（带要求与输出格式），供 Claude 的评估工具验证服务器质量。文末为参考文档库（核心 MCP 文档、两语言 SDK 文档、语言实现指南、评估指南的加载顺序）。

> 编者注（已标明）：这个技能与站内《MCP 在编码中的应用》互补——那篇讲"怎么把 MCP 服务器接进编码智能体"，这一篇讲"怎么把服务器**建好**"。两者合起来才是完整闭环。

## 二、webapp-testing：让智能体真的去点一遍浏览器

*以下译自 `skills/webapp-testing/SKILL.md`（正文约 100 行，基本全译）。*


> **description（全译）**：用 Playwright 与本地 Web 应用交互并测试的工具箱。支持验证前端功能、调试 UI 行为、截取浏览器截图、查看浏览器日志。

核心内容（正文约 100 行，基本全译）：测试本地 Web 应用就写原生 Python Playwright 脚本。助手脚本 `scripts/with_server.py` 管服务器生命周期（支持多服务器）。**永远先跑 `--help`** 再用；在试跑并确认确有必要之前不要读源码——脚本很大，会污染上下文窗口，它们就是被当成黑盒直接调用的。**选方法决策树**：静态 HTML → 直接读 HTML 找选择器（失败就按动态处理）；动态应用 → 服务器没起就 `with_server.py --help` 然后助手+精简 Playwright 脚本；已起就"先侦察后行动"——导航并等 `networkidle` → 截图或查 DOM → 从渲染态识别选择器 → 执行动作。单服务器：`python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py`；多服务器（后端+前端）传多个 `--server`。自动化脚本只写 Playwright 逻辑（服务器由助手管）：chromium 一律 headless、`goto` 后**必须** `page.wait_for_load_state('networkidle')` 等 JS 执行完。**常见陷阱**：动态应用在等 `networkidle` 之前就查 DOM（✗）——先等再查（✓）。最佳实践：脚本当黑盒；同步脚本用 `sync_playwright()`；用完关浏览器；选择器可描述（`text=`、`role=`、CSS、ID）；加恰当等待。参考 `examples/`（元素发现、file:// 静态页自动化、控制台日志捕获）。

**这一节最值得抄的是那条纪律**：**先跑 `--help`、没验证过不要读脚本源码**。理由写得很直白——助手脚本很大，读了会**污染上下文窗口**，它们本来就是被当黑盒调用的。这正是《心智模型：LLM 如何"看"你的代码》里"上下文是稀缺资源"在技能设计上的落地。

## 三、web-artifacts-builder：把多组件前端打回一个 HTML

*以下译自 `skills/web-artifacts-builder/SKILL.md`（短文，基本全译）。*


> **description（全译）**：用现代前端 Web 技术（React、Tailwind CSS、shadcn/ui）创建复杂多组件 claude.ai HTML artifact 的工具套件。用于需要状态管理、路由或 shadcn/ui 组件的复杂 artifact——不要用于简单的单文件 HTML/JSX artifact。

核心内容（短文，基本全译）：五步——①`scripts/init-artifact.sh <project-name>` 初始化前端仓库（React 18 + TypeScript + Vite + Parcel 打包 + Tailwind CSS + shadcn/ui，预配 `@/` 路径别名、40+ shadcn/ui 组件、全部 Radix UI 依赖、Node 18+ 兼容自动钉 Vite 版本）；②改生成的代码开发 artifact；③`scripts/bundle-artifact.sh` 把全部代码打进单个 HTML 文件（Parcel 构建 + html-inline 内联资源，产出可分享的 `bundle.html`；要求根目录有 `index.html`）；④把 artifact 展示给用户；⑤（可选）测试——**完全不必须**：过早测试徒增等待，展示之后再按需测。设计指南（原文大写强调）：为避免"AI slop"，**避免过度居中布局、紫色渐变、清一色圆角和 Inter 字体**。

## 四、claude-api：一份"禁止凭记忆写 API"的参考技能

*以下译自 `skills/claude-api/SKILL.md`（正文约 570 行，主干节译）。这是本系列里最能说明"2026 年该怎么写 AI 应用"的一个技能——它的核心不是教你 API 用法，而是**强迫你查文档**。*


> **description（全译，原文含三段触发器）**：Claude API / Anthropic SDK 参考——模型 id、价格、参数、流式、工具使用、MCP、智能体、缓存、token 计数、模型迁移。**触发——打开目标文件之前先读本技能，别因为"看起来是一行代码"就跳过**：提示词以任何形式提到 Claude/Anthropic（Claude、Anthropic、Fable、Opus、Sonnet、Haiku、`anthropic`、`@anthropic-ai`、`claude-*`、`us.anthropic.*`、`[1m]`）时；用户问 LLM 问题（价格/选型/限额/缓存）时——绝不凭记忆回答；或任务是 LLM 形状但未指明提供商（agent/MCP/工具定义/多智能体/RAG/LLM 评审/computer-use；生成/摘要/提取/分类/改写/对话；调试拒绝/截断/流式/工具调用/token）。**仅当在处理其他提供商时跳过**（压倒一切触发器）：查询点名 OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama；或对项目 `grep -rE 'openai|langchain_openai|...'` 有命中（未指明提供商时先跑这个 grep——别急着读文件）。

核心内容（正文约 570 行，译主干并注明节选）：**开始之前**：扫目标文件找非 Anthropic 提供商标记（`import openai`、`gpt-4`、文件名 `agent-openai.py` 或任何"保持提供商中立"的指令）——找到就停下告诉用户本技能产出 Claude/Anthropic SDK 代码，问是否要切换；不要往非 Anthropic 文件里塞 Anthropic SDK 调用。**输出要求**：代码必须经官方 SDK（项目语言有受支持 SDK 时的默认）或裸 HTTP（仅当用户点名 cURL/REST、项目是 shell 项目或语言无官方 SDK）调用 Claude；两者绝不混用；绝不退回 OpenAI 兼容垫片。**绝不猜 SDK 用法**——函数名、类名、命名空间、方法签名、导入路径必须来自显式文档（本技能 `{lang}/` 文件或 `shared/live-sources.md` 列出的官方仓库/文档）；需要的绑定没写进技能文件就先 WebFetch 官方 SDK 仓库；WebFetch 失败就别重试——按 `{lang}/` 的模式与命名空间表写码、跑编译器、对着报错迭代。**默认值**：除非用户另有要求——模型用 Claude Opus 5（精确模型串 `claude-opus-5`）；稍有复杂度的任务默认自适应思考（`thinking: {type: "adaptive"}`）；任何长输入/长输出/高 `max_tokens` 的请求默认流式（防超时），不需要逐事件处理就用 `.get_final_message()` 助手。**警告：API 漂移——你的训练先验可能过时**：2025-2026 多个常用形态已变，凭记忆的模式先对照 `{lang}/` 文件验证。原文给出最高频漂移点表（节译）：扩展思考——`budget_tokens` 在 Opus 4.6/Sonnet 4.6 已弃用、在新一代模型上直接 400 拒绝，Claude 4.6+ 用 `thinking: {type: "adaptive"}`；web 搜索/抓取工具类型换新版本串；PHP 顶层命名参数是驼峰；Files API/Skills 已出 beta（`client.files.*`/`client.skills.*`，无 beta 头）。`{lang}/` 文件对记忆模式有最终权威。**子命令**：`/claude-api migrate`（迁移到新模型——先读 shared/model-migration.md 按 Step 0 确认范围、Step 1 逐文件分类、按目标模型的破坏性变更节执行，迁移还包括对提示词文本做 prompt-audit）、`prompt-audit`（审计既有提示词/技能/工具描述里为旧模型写的过时模式，产出审计报告+建议 diff，非交互不停顿）、`upgrade`（跨大版本升级 Anthropic SDK 依赖，如 Python 0.x→1.x）、`cost-optimize`（降本不降质——用 Admin API 或应用日志测 token 画像，按省出的钱排序给杠杆清单，免费先行的手段如缓存、输入/循环/输出 token 卫生、批处理，再权衡项；任何动模型的运行都花真钱，先获批准）。**语言检测**：按项目文件推断语言并读对应 `{lang}/` 文档（py/ts/tsx/js/java/kotlin/go/ruby/cs/php）；多语言并存看当前文件，仍模糊就问；推断不出用选项询问（默认 Python 并注明）；不支持的语言建议 cURL/raw HTTP。**选哪个面**：从最简单的面开始——单次调用与工作流覆盖多数场景，只有真正需要开放式模型驱动探索才上智能体。"最简单"=你拥有的代码最少。用例表：分类/摘要/抽取/问答→单次调用；批处理/嵌入→专用端点；代码控制逻辑的多步管道→API+工具使用；自定义工具的 agent→API+工具使用；服务端托管的有状态 agent（工作区/持久化版本化配置/长会话/定时运行）→**Managed Agents**。**构建智能体的四种方式**（原文核心表，节译）：两个独立问题分开它们——*谁提供 harness*（智能体循环+上下文管理）与*谁提供部署*：①手动循环（自己写 `while stop_reason == "tool_use"`；你要拥有整个循环时）；②API Tool Runner（只写工具函数，SDK 给循环——仅 harness；每轮钩子仍给审批门/拦截/重试/流式/压缩；多数情况）；③Managed Agents（Anthropic 给 harness **且**托管每会话沙箱——bash/文件/代码执行都在工作区跑，唯一"harness+部署"都管的选项）；④Claude Agent SDK（*独立产品*——Claude Code 打包成库，自带 Read/Write/Edit/Bash/Glob/Grep/WebSearch/WebFetch+MCP+子智能体；想要开箱即用的编码/文件系统 agent 跑在自己的基础设施上）。Tool Runner≠Agent SDK（前者是你定义的工具的薄循环助手，后者是带内置工具的完整 Claude Code harness）；**本技能覆盖①②③，不生成④的代码**——用户真要 Agent SDK 就指到它的文档，别拿 Tool Runner 顶替，反之亦然。文末还有：架构、当前模型清单（缓存日期标注）、认证、思考与投入等级、压缩、提示缓存、快速模式、任务预算、云提供商（Bedrock/Vertex/Foundry 可用性以 `shared/platform-availability.md` 为唯一事实源）、服务端工具、文档与文件输入、工具使用模式等速查节。

**为什么这一节对编码智能体特别有用**：它的 description 是一堂"触发工程"课——不是描述技能做什么，而是列举**所有可能出现的症状**（提到模型名、问价格、任务是"LLM 形状"但没指定厂商），再给一个**压倒一切的排除条件**（正在处理别家提供商就跳过），最后连"先 grep 项目再决定要不要读文件"都写进去了。想给自己团队写一个"内部 SDK 参考技能"，直接照这个结构抄。

## 五、frontend-design：唯一保留的"设计类"技能，因为它产出的是代码

*以下译自 `skills/frontend-design/SKILL.md`（正文约 70 行，要点全译）。*


> **description（全译）**：在构建新 UI 或重塑既有 UI 时，提供独特、有意图的视觉设计指导。帮助确定美学方向、字体排印，以及做出不会被读成模板化默认值的选择。

核心内容（正文约 70 行，全译要点）：把自己当作设计工作室的设计负责人——这位客户已经毙掉了感觉陈词滥调或模板化的提案，花钱买的是独特视角：对配色、字体、布局做出*专属于这个委托*的、有主张的选择，必要时敢冒美学风险。**立足题材**：委托书没说清产品/题材就先自己确认；题材的行业、材质、行话是独特视觉选择的来源——给 8-11 岁女孩的玩具和给金融分析师的仪表盘美学必然截然不同。**设计原则**：hero 是第一眼——用题材世界里最具特征的东西开场（大标题、图、动画、live demo、互动时刻），"大数字+小标签+渐变点缀"是默认俗套；字体承载页面个性，一两个家族足够，两个就要泾渭分明；刻意选字体（不要每个项目都伸手拿同一批默认），按《The Elements of Typographic Style》定字阶；行长默认 80 字符以内；避免三种最常见的"生成页"痕迹——标题里只强调单个词（斜体/变色）、标签全大写、内容上方加多余的小标签；结构装饰是信息——编号标记只在内容真的是序列时用；非用户触发的动效要节制且有意图，一次编排好的瞬间胜过满屏 fade-and-slide（那是 AI 生成的默认）；动效回应人的动作才受欢迎。**校准：当下 AI 生成设计的五大俗套**（原文全译要点）——①暖奶油底（近 `#F4F1EA`）+高对比衬线大字+陶土色点缀（近 `#D97757`——正是 Anthropic 自家交互色，出现在用户委托里反而露馅）；②近黑底+单一荧光酸绿或朱红；③报纸式细线分栏零圆角；④SaaS 卡片套装（等宽圆角卡片+同一款灰影+渐变装饰）；⑤模板镶边（全大写眉题、中点串联的元信息、带间隔长破折号的标签、近黑当黑、小号数据用等宽字、链接按钮后缀"→"）。委托书钉死的方向就严格照办（哪怕点名其中一种 look）；留白的轴别浪费在默认值上。**流程**：两遍走——先按委托书出一份简短设计方案（4-6 个命名十六进制色的核心色板、字体及分工、一句一句话的布局概念+ASCII 线框、原则）；再对照委托书自审——哪部分读起来像"给任何同类页面都会做的通用默认"就改掉并说明改了什么为什么；确认设计的相对独特性之后才写代码（写 CSS 时注意选择器特异性互相抵消的问题）。**克制与自评**：把大胆花在一处；一个元素当记忆点，其余安静守纪；建质量底线而不宣布它（响应到移动端、可见的键盘焦点、尊重 reduced motion、视觉无障碍）；边建边截图自评——一图值千 token；香奈儿建议：出门前照镜子，摘掉一件配饰；记下试过什么，下轮有据可依。**设计中的写作**：文字只有一个目的——让人更容易理解和使用；从最终用户视角命名（用户管理的是通知，不是 webhook 配置）；主动语态（"Save changes"不是"Submit"；点"Publish"的按钮产生的就该是"Published"的提示）；把失败与空状态当作指引的时机——错误不道歉、也绝不含糊；语气口语化：朴素的动词、sentence case、无填充词。

> 编者注（已标明）：把它留在"工具集成族"而不是和下面的艺术生成类一起收敛成一段，理由很实际——它的输出是**选型、字号阶、CSS 与文案**，会直接进你的仓库；其余设计类技能的产出是图片与装饰主题，不进代码评审。

## 六、被剔除的技能：艺术生成与企业沟通类

官方仓库还有八个技能与"写软件"关系不大：**algorithmic-art**（p5.js 生成艺术，先写"算法运动宣言"再实现）、**canvas-design**（.png/.pdf 静态视觉作品，同样是哲学先行）、**slack-gif-creator**（为 Slack 优化的动画 GIF，内置 `GIFBuilder`）、**brand-guidelines**（Anthropic 品牌色与字体）、**theme-factory**（10 套配色/字体主题套用到产物）、**internal-comms**（3P 更新、公司通讯、FAQ、事故报告等内部沟通模板）、**academy-guide**（回答"Claude 怎么用"类问题时去查 Claude Academy 目录并只做强匹配推荐）、**discernment-nudge**（在用户可能据以行动的实质回答末尾追加 2-3 个复查问题）。**它们的共同点是产出物不是代码，判据也不是"对不对"而是"像不像、到不到位"**——对做产品与设计有用，但不属于本站的 AI 编程主线，因此这里只留一段说明，需要时直接去仓库读对应目录（Apache-2.0）。值得一提的是其中两条纪律其实跨领域通用：`academy-guide` 的"沉默好过噪声——一次错误推荐烧掉的信任多于十次正确推荐建立的"，和 `discernment-nudge` 的"只在会真金白银影响决定时才提醒，其余保持安静"，放在任何智能体的推荐与追问策略上都成立。

## 七、四个能力技能怎么组合进日常开发（本站编者归纳）

*本节为编者补充，非原文翻译。*

| 你要做的事 | 装哪个 | 为什么不是自己写提示词 |
| --- | --- | --- |
| 给内部系统做一个 MCP 服务器 | `mcp-builder` | 它规定了"工具全覆盖 vs 工作流工具"的取舍、schema 带示例、错误要可行动，还要交 10 道评估题——自己写会全部省掉这些 |
| 改完前端想确认它真能点 | `webapp-testing` | 强制"先侦察后行动 + `networkidle` 再查 DOM"，避开智能体最常见的假通过 |
| 要一个能直接发给别人的交互原型 | `web-artifacts-builder` | 一条脚本生成 React+TS+Tailwind+shadcn 工程，另一条打成单文件 HTML |
| 写任何调用 Claude 的代码 | `claude-api` | 它的存在理由就是"API 漂移"：训练先验里的参数名已经错过一轮 |
| 做面向用户的页面而不是模板站 | `frontend-design` | 它把"当下 AI 生成设计的俗套清单"写成可自审的两遍流程 |

**组合纪律**：这些技能是**能力扩展**，可以按需单装；《开源编码 Skills（一）：Superpowers 编码流程族》是**流程约束**，装了就整套生效。两者不冲突——最常见的搭配是"Superpowers 管过程 + 按任务点一两个能力技能"。要注意的只有一条：一次会话里同时激活太多强制流程技能，会把上下文塞满，`writing-skills` 与 `skill-creator` 对体量的限制（高频技能 <200 词、`SKILL.md` <500 行）就是为此而设。

## 延伸阅读

- 《MCP 在编码中的应用》：把本篇第一个技能产出的服务器接回编码智能体。
- 《Claude Skills：可复用技能包》：这些技能为什么能被自动想起、按需加载。
- 《开源编码 Skills（二）：技能写作与文档协作族》：想给团队自建一个"内部 SDK 参考技能"时该走哪套测试。
- 《成本管理：Token 消耗、订阅选择与用量优化》：能力技能很省上下文，前提是别把它的参考文件全读进会话。

---

> **来源**：本文译自 [anthropics/skills](https://github.com/anthropics/skills) 仓库（作者 Anthropic）`skills/` 目录下 5 个技能的 `SKILL.md`：mcp-builder、webapp-testing、web-artifacts-builder、claude-api、frontend-design，均为 Apache-2.0 许可（各目录附 `LICENSE.txt`），2026-09-13 首次 raw 抓取、2026-09-19 经 GitHub API 复核目录。`mcp-builder`、`claude-api`（约 570 行）、`frontend-design`（约 70 行要点）为核心流程与要点节译，已在各小节注明；短文为基本全译。第六节对 algorithmic-art、canvas-design、slack-gif-creator、brand-guidelines、theme-factory、internal-comms、academy-guide、discernment-nudge 八个技能仅作概述指认、未成段转载，原始表述以仓库当前内容为准。第一至五节的小结引语、第七节组合建议为本站编者补充并已标明。
