---
title: 第一次 AI 结对：从零做一个命令行小工具
source_url: https://code.claude.com/docs/en/quickstart
author: Anthropic（Claude Code 官方文档 Quickstart / Common workflows）；本站编者（从零实操补充）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途翻译并署名；编者补充部分为本站原创并已标明）
fetched_at: 2026-09-13
translated: true
order: 4
---

上一篇我们装好了 Claude Code 与 Cursor。本篇走完你的第一次完整 AI 结对：先按官方 Quickstart 学会在已有项目里驱动 Claude Code，然后从零做一个真正的小工具——一个命令行词频统计工具——把"描述目标 → 审查方案 → 验证结果"的结对循环完整走一遍。实操部分依据官方文档的提示词模式组织，已标明为本站编者补充。

## 一、官方 Quickstart：第一次会话（Anthropic 官方文档节译）

*以下译自 Claude Code 官方文档 [Quickstart](https://code.claude.com/docs/en/quickstart) 第 3-8 步。*

### 第 3 步：启动第一个会话

在任意项目目录打开终端并启动：

```bash
cd /path/to/your/project
claude
```

你会看到 Claude Code 提示符，上方显示版本号、当前模型与工作目录。输入 `/help` 查看可用命令，`/resume` 可继续上一次对话。

### 第 4 步：问第一个问题

从理解代码库开始：

```text
what does this project do?
```

Claude 会分析文件并给出摘要。也可以问更具体的问题：

```text
what technologies does this project use?
where is the main entry point?
explain the folder structure?
```

注意：Claude Code 按需读取你的项目文件，你不需要手动添加上下文。

### 第 5 步：做第一处代码修改

现在让 Claude Code 真正写代码。给它一个简单任务：

```text
add a hello world function to the main file
```

Claude Code 会找到合适的文件并把改动展示给你；如果它在修改前询问，选择 **Yes** 批准即可。

关于权限：auto 模式是 Pro/Max/Team 计划交互式终端会话的内置起始模式——由分类器代你审查动作，Claude 直接编辑大多数文件、运行大多数命令；其他计划默认 manual 模式。随时按 `Shift+Tab` 切换（详见第 7 篇）。

### 第 6 步：配合 Git 使用

Git 操作可以完全对话化：

```text
what files have I changed?
commit my changes with a descriptive message
create a new branch called feature/quickstart
help me resolve merge conflicts
```

### 第 7 步：修 Bug 或加功能

用自然语言描述目标即可：

```text
add input validation to the user registration form
there's a bug where users can submit empty forms - fix it
```

Claude Code 会：定位相关代码 → 理解上下文 → 实现方案 →（若有测试）运行测试验证。

### 第 8 步：试用常见工作流

```text
refactor the authentication module to use async/await instead of callbacks
write unit tests for the calculator functions
update the README with installation instructions
review my changes and suggest improvements
```

官方给新手的提示是：像对一位乐于助人的同事那样跟 Claude 说话——描述你想达成什么，它会帮你到达那里。

### 常用命令速查（同页译文）

**Shell 命令**（在终端启动/恢复会话）：

| 命令 | 作用 |
| --- | --- |
| `claude` | 启动交互模式 |
| `claude "task"` | 带初始提示启动 |
| `claude -p "query"` | 单次查询后退出 |
| `claude -c` | 继续当前目录最近对话 |
| `claude -r` | 恢复某个历史对话 |

**会话命令**（在 Claude Code 内使用）：`/clear` 清空对话历史；`/help` 显示可用命令；`/exit` 或连按两次 Ctrl+D 退出。

### 官方新手四条建议（同页译文）

1. **请求要具体**：与其说"fix the bug"，不如说"fix the login bug where users see a blank screen after entering wrong credentials"。
2. **分步骤下指令**：复杂任务拆成编号步骤，一行一步。
3. **先让 Claude 探索**：改代码之前先让它理解代码（"analyze the database schema"）。
4. **善用快捷键**：输入 `/` 看命令与技能，Tab 补全，↑ 翻历史，`Shift+Tab` 循环切换权限模式。

## 二、从零实战：做一个命令行词频统计工具（本站编者补充）

*本节为本站编者补充（Quickstart 的流程针对"已有项目"，从零构建的场景由编者按官方提示词模式组织）。目标：一个 Python 命令行工具 `wcount`——统计文本文件的词频并输出 Top N。*

### 第 0 步：空目录起手

```bash
mkdir wcount && cd wcount && git init
claude
```

在空项目里启动 Claude Code，然后体会"结对"的第一原则：**你负责说什么，Claude 负责怎么做**。

### 第 1 轮：先描述目标，不描述实现

```text
我想做一个叫 wcount 的 Python 命令行工具：输入一个文本文件路径，
输出出现频率最高的前 N 个单词及次数，N 用 --top 参数指定（默认 10）。
先用 Python 标准库实现，做成一个可以直接 pip install -e . 的项目结构。
```

这是官方建议"be specific with your requests"的体现：目标（做什么）、边界（标准库、可安装）都给到，但不指定文件名、函数结构——让 AI 自己规划。Claude 会创建 `pyproject.toml`、`src/wcount/__init__.py`、入口函数，并在首次写入前展示计划或请求批准（manual 模式下）。

### 第 2 轮：验收先行

```text
给它配 pytest：构造一个小的样例文本文件，断言大小写不敏感、
按次数降序、次数相同时按字母序。先写测试，跑给我看它失败，再实现。
```

这一步借用了官方"work with tests"的工作流：**先让测试定义"完成"**。你会在终端看到红-绿的完整过程（TDD 的完整方法论见第 17 篇）。

### 第 3 轮：让它跑给你看

```text
用 python -m wcount 对样例文件跑一遍 --top 5，把输出贴给我。
```

官方模式"给 Claude 一种验证自身工作的手段"在这里落地：让它亲手运行工具并展示输出，而不是只报告"写好了"。你审查的是真实行为，不是描述。

### 第 4 轮：提交，形成一个存档点

```text
commit my changes with a descriptive message
```

每轮结束提交一次（Git 与 AI 工作流的关系详见第 12 篇）。这就是 AI 结对的最小循环：**目标 → 生成 → 验证 → 提交**，四拍打熟之后，本模块后面所有的进阶话题——权限、规范文件、Spec、上下文工程——都是在这个循环的某一段上做加固。

### 第一次结对最容易踩的三个坑（编者经验，与官方建议对照）

- **一口气要太多**："做一个带数据库和 Web 界面的爬虫"不如拆成三个编号步骤（官方：use step-by-step instructions）。
- **不看 diff 就 Accept**：第一次结对就要建立"读 diff 再批准"的肌肉记忆——auto 模式下尤其如此（第 7 篇讲权限时你会看到为什么）。
- **失败后重开会话而不是迭代**：第一次结果不对时，直接继续对话纠正（"That's not quite right. The issue is in..."）——会话本身就是迭代的地方，`/clear` 是重置手段而非失败标志。

---

> 下一篇预告：工具用起来了，但"AI 到底是怎么'看'你的代码的"——上下文窗口、分词与智能体循环的底层心智模型，值得在读工作流进阶之前先建立。

> **来源**：本文第一部分翻译自 [Quickstart](https://code.claude.com/docs/en/quickstart)（Claude Code 官方文档，2026-09 当前版），作者 Anthropic，许可署名翻译（Copyright Anthropic PBC，教学用途）；第二部分"从零实战"为本站编者补充（已在节首标明），其提示词模式与工作流均引自上述官方文档。抓取于 2026-09-13。
