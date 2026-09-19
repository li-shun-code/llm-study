---
title: Cursor 深入：Tab 补全、Agent 模式与调试/评审工作流
source_url: https://cursor.com/docs/agent/overview
author: Anysphere（Cursor 官方文档 Agent / Plan Mode / Debug Mode / Agent Review / Prompting / Tab）
license: 署名翻译（官方文档版权归 Anysphere 所有，教学用途编译翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 9
group: Cursor 与其他工具
---
上一篇讲 Cursor 的 Rules 时我们只碰了"怎么给 AI 立规矩"；本篇把 Cursor 的交互面本身讲完：Tab 补全怎么工作、Agent 模式的组件与工具、Plan/Debug 两个专用模式、Agent Review 评审，以及 @ 提及与上下文用量这些日常细节。有趣的是，你会看到前述的心智模型（智能体循环、上下文窗口）在这里一一对应地重现——两个工具在架构上已经收敛。

## 一、Tab 补全（译自 Cursor 帮助文档 Tab 页）

Tab 是 Cursor 的 AI 自动补全：它根据你最近的编辑、周围代码与 lint 错误，在你输入时给出建议。

- **接受整条建议**：按 Tab；**拒绝**：按 Esc 或继续输入；**逐词接受**：Cmd/Ctrl + →
- 建议以灰色文本出现在光标前方
- **可以跨行编辑**：Tab 能一次修改多行、补缺失的 import、在相关代码间给出协同编辑
- **jump-in-file**：接受建议后再按 Tab，Tab 会预测你的下一个编辑位置并跳转过去
- **跨文件编辑**：一个文件的改动需要更新另一个文件时，Tab 会给出跨文件建议，底部出现"传送门"窗口
- 开关：编辑器右下角 Tab 状态指示器——可定时暂停、全局关闭、或按文件类型关闭

## 二、Agent 模式：三个组件与九类工具（译自官方 Agent Overview）

Agent 是 Cursor 里能独立完成复杂编码任务、跑终端命令、改代码的助手，`Cmd+I` 从侧边栏唤起。它由三个组件构成：

1. **指令（Instructions）**：系统提示词与 Rules（上一篇的主角）
2. **工具（Tools）**：文件编辑、代码库搜索、终端执行等
3. **模型（Model）**：你为任务挑选的智能体模型

Cursor 为每个受支持的模型编排这三个组件、做模型特定的调优——新模型发布时你只管写软件。

### 工具清单

任务中的工具调用次数没有上限。主要工具：搜索文件与文件夹、Web 搜索、按类型与描述拉取 Rules、智能读取文件（含 .png/.jpg/.gif/.webp/.svg 图片并送入视觉上下文）、编辑文件、执行 shell 命令并监控输出、**控制浏览器**（截图、测试应用、验证视觉改动）、**图像生成**（UI 草图、架构图，默认存到项目 `assets/`）、以及**向人提问**（等待回答时它继续干活，答案一到就并入）。

### 检查点（Checkpoints）

Agent 在做出重大改动前自动创建代码库快照。走错路时，点聊天时间线上的任意检查点预览当时状态并一键还原全部文件。**检查点只回滚文件、不删除对话消息；它存储在本地、独立于 Git——撤销 Agent 改动用它，永久版本控制交给 Git**（与《心智模型：LLM 如何"看"你的代码》 Claude Code 的检查点是同一个设计）。

### 排队消息与转向

Agent 工作时你有两种说话方式：**排队**（Enter）——等当前任务做完再执行；**立即发送**（Cmd+Enter）——附加到最新消息立刻处理。还有第三种"转向"：连按两次 Enter，消息在下一次工具调用边界送达，不打断进行中的动作——保留在途工作、又不丢你的方向修正。

### /goal：长目标模式

Agent 把每条消息当作一个新任务来读。用 `/goal` 下达长期目标，它会朝目标持续推进直到彻底完成：

```text
/goal fix all flaky tests and make CI green
```

`/goal` 可与 Custom Mode 组合（见下），或与内置 `/loop` 技能组合做周期性检查点。

## 三、Plan Mode 与 Debug Mode：两个专用挡位（译自官方 Plan Mode / Debug Mode 页）

### Plan Mode

在写任何代码之前先生成详细实现计划：Agent 先提澄清问题理解需求 → 研究代码库收集上下文 → 产出完整实现计划 → 你在聊天或 Markdown 文件里审阅修改 → 点击开始构建。聊天输入框按 `Shift+Tab` 切入；Cursor 检测到复杂任务的关键词时也会主动建议。

适合：有多种可行方案的复杂特性、涉及多文件/多系统的任务、需求不清需要先探索、想先评审技术路线的架构决策。**官方特别建议"从计划重来"**：Agent 建出来的东西不对时，与其连环追问修补，不如回滚改动、把计划改得更具体、重跑一遍——通常更快、结果也更干净。更大的改动多花时间做一个精确、边界清晰的计划：难的往往是"改什么"，方向对了，实现可以放心委托。

### Debug Mode

专为"难以复现或难以理解"的 Bug 设计：Agent 不是上来就写代码，而是先产生假设、埋点日志、用运行时信息锁定问题再做针对性修复。流程六步：

1. **探索与假设**：探索相关文件、建立上下文、生成多个根因假设
2. **加插桩**：把日志语句发到 Cursor 扩展里的本地调试服务器
3. **复现 Bug**：Agent 给出具体步骤请你亲手复现——人在回路里，保证抓到真实运行时行为
4. **分析日志**：基于运行时证据定位真正的根因
5. **定向修复**：只修根因，往往只有几行代码
6. **验证并清理**：重跑复现步骤确认，然后移除全部插桩

适用：能复现但读代码看不出来的 Bug、竞态与时序问题、性能问题与内存泄漏、"以前好好的"回归。官方提示：把 Bug 描述得越具体（错误信息、堆栈、复现步骤、期望与实际行为），插桩越准；竞态类问题多复现几次会显著帮助定位。

> 译注：Debug Mode 与《调试 with AI：让 AI 定位 Bug 的工作流》 Filippo Valsorda 的人肉调试工作流（让智能体找根因、人来写修复）是同一个思想的两极——Cursor 把"假设→插桩→复现→证据"做成了产品化挡位；Claude Code 的用户则用提示词与技能编排同样的循环。

## 四、Agent Review：内置评审（译自官方 Agent Review 页）

Agent Review 在 Cursor 内对本地改动跑一次专门的代码评审。三种触发方式：**自动**（设置开启后每次 commit 后自动跑）、**斜杠命令**（输入 `/agent-review`）、**Source Control 面板**（把全部本地改动与 main 分支对比——覆盖完整变更集而不只是最后一次编辑）。它还会读取仓库里的 `BUGBOT.md` 规则文件（详见 BugBot 文档）。评审深度两档：**Quick**（快、省，适合小 diff 与格式改动）与 **Deep**（慢、贵，适合复杂逻辑、安全敏感代码与大型重构）。

## 五、提示词工程细节：@ 提及、Custom Mode 与上下文用量（译自官方 Prompting Agents 页）

- **@ 提及**：`@auth.ts` 挂文件、`@src/components/` 挂目录、`@Terminals` 挂终端输出、`@Chats` 引用历史对话、`@Commit (Diff of Working State)` / `@Branch (Diff with Main)` 挂 diff、`@Browser` 挂浏览器上下文。**知道相关文件时用 @；不确定时就不用**——Agent 会自己搜索。
- **Custom Mode**：`/` 调出技能，Enter 只attach一次；按 Option/Alt+Enter 则把技能升格为"模式"——整个工作期间持续在上下文里，适合"描述怎么工作"而非"一次性任务"的技能（比如整段功能开发期间挂着 `/tdd`）。
- **图片与语音**：拖拽或 Cmd+V 粘贴截图（UI 与视觉调试利器）；麦克风口述提示词。
- **上下文用量环**：输入框旁的圆环显示上下文窗口的填充度，点开按类别拆分——系统提示词、工具定义、Rules、技能描述、MCP 说明、子智能体文档、被摘要的对话、当前对话。窗口将满时 Cursor 把较早对话压缩成摘要（与第 6 篇的 compaction 同构——两家的上下文经济学已经完全趋同）。

---

> 下一篇预告：Cursor 的规则与模式都讲完了。接下来把镜头拉远——第 11 篇讲跨工具的"项目规范文件"标准 AGENTS.md 与 Claude Code 的 CLAUDE.md：无论你用哪家工具，这一层都是通用的。

> **来源**：本文各节分别译自 [Agent Overview](https://cursor.com/docs/agent/overview)、[Plan Mode](https://cursor.com/docs/agent/plan-mode)、[Debug Mode](https://cursor.com/docs/agent/debug-mode)、[Agent Review](https://cursor.com/docs/agent/agent-review)、[Prompting agents](https://cursor.com/docs/agent/prompting)（Cursor Docs，Anysphere）与 [Tab completion](https://cursor.com/help/ai-features/tab)（Cursor 帮助文档），2026-09 当前版。作者 Anysphere（Cursor 官方文档），许可署名翻译（官方文档版权归 Anysphere 所有，教学用途编译翻译并署名）。两处"译注"为本站编者补充并已标明。抓取于 2026-09-13。
