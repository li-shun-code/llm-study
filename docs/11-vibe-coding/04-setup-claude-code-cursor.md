---
title: 环境搭建：Claude Code 与 Cursor 的安装及首次配置
source_url: https://code.claude.com/docs/en/quickstart
author: Anthropic（Claude Code 官方文档 Quickstart / Advanced setup）；Anysphere（Cursor 官方文档 Quickstart）
license: 署名翻译（两家官方文档版权归原厂所有，本文为教学用途的编译与翻译，逐节署名）
fetched_at: 2026-09-13
translated: true
order: 4
---

前两篇的工具全景与评测基准看完，你心里大概已经有了想先上手的那一个。本篇就把环境真正搭起来：以目前最主流的两个代表——终端形态的 Claude Code 与编辑器形态的 Cursor——为例，走完"安装 → 登录 → 验证 → 第一次启动"的完整流程。两家官方文档的相应章节均全文译出，装好即查。

> 时效注记：本文依据 2026-09 的官方文档当前版本（Claude Code 以 2.1.x 版本验证安装，Cursor 以原生安装包 + apt/yum 仓库为准）。安装命令随版本演进可能变化，动手前请以官方文档为准。

## 一、安装并启动 Claude Code（Anthropic 官方 Quickstart 节译）

*以下译自 Claude Code 官方文档 [Quickstart](https://code.claude.com/docs/en/quickstart) 的安装与登录部分。*

### 开始之前

确保你已有：

- 一个打开的终端或命令行提示符（如果你从未用过终端，官方另有一份[终端入门指南](https://code.claude.com/docs/en/terminal-guide)）
- 一个可用的代码项目
- 一个 Claude 订阅（Pro、Max、Team 或 Enterprise）、Claude Console（platform.claude.com）账号，或经受支持云服务商的访问授权

本指南覆盖终端 CLI。Claude Code 也可在 Web（claude.ai/code）、桌面应用、VS Code 与 JetBrains IDE、Slack 以及 CI/CD（GitHub Actions / GitLab）中使用。

### 第 1 步：安装 Claude Code

**原生安装（推荐）**——macOS、Linux、WSL：

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Windows PowerShell：

```powershell
irm https://claude.ai/install.ps1 | iex
```

Windows CMD：

```batch
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

如果安装命令报 `syntax error near unexpected token '<'`、`403` 或其他 curl 错误，请对照官方"安装排障"页找对应解法。Windows 原生环境建议安装 Git for Windows，以便 Claude Code 使用 Bash 工具（未装则退回 PowerShell）；WSL 环境不需要。

**Homebrew（macOS/Linux）**：

```bash
brew install --cask claude-code
```

Homebrew 提供两个 cask：`claude-code` 跟踪稳定通道（通常滞后约一周，跳过有严重回退的版本）；`claude-code@latest` 跟踪最新通道。Homebrew 安装不会自动更新，需手动 `brew upgrade`。

**WinGet（Windows）**：

```powershell
winget install Anthropic.ClaudeCode
```

此外在 Debian、Fedora、RHEL、Alpine 上还可用 apt、dnf、apk 包管理器安装。原生安装会在后台自动更新，保持你处于最新版本。

### 系统要求（译自官方 Advanced setup 页）

- **操作系统**：macOS 13.0+；Windows 10 1809+ 或 Windows Server 2019+；Ubuntu 20.04+；Debian 10+；Alpine 3.19+
- **硬件**：4 GB+ 内存，x64 或 ARM64 处理器
- **网络**：需要互联网连接
- **Shell**：Bash、Zsh、PowerShell 或 CMD
- **附加依赖**：ripgrep 通常随 Claude Code 内置；若搜索失败再单独排查

### 第 2 步：登录账号

用 `claude` 命令启动交互会话，首次使用会提示登录：

```bash
claude
```

对 Claude 订阅或 Console 账号，按提示在浏览器完成认证即可。如果设置过 `ANTHROPIC_API_KEY` 环境变量，Claude Code 会跳过登录提示、改为请求你确认使用该密钥。之后切换账号或重新认证，在会话内输入 `/login`。

可登录的账号类型：Claude Pro/Max/Team/Enterprise 订阅（推荐）；Claude Console（API 预付费额度，首次登录会自动创建"Claude Code"工作区便于集中核算成本）；Amazon Bedrock、Google Cloud 或 Microsoft Foundry 等企业云；以及企业自托管的 Claude apps gateway（SSO 直登）。

### 验证安装

```bash
claude --version
```

正常输出形如 `2.1.211 (Claude Code)` 的版本号。若报 `command not found` 等错误，见官方"安装与登录排障"页（PATH、权限、网络、认证四类问题都有对应解法）。

## 二、安装并启动 Cursor（Anysphere 官方 Quickstart 节译）

*以下译自 Cursor 官方文档 [Quickstart](https://cursor.com/docs/get-started/quickstart) 的安装部分。*

### 下载安装并登录

从 [cursor.com/downloads](https://cursor.com/downloads) 下载 Cursor，打开应用并登录，然后选一个文件夹、从一个小时任务开始。

系统要求与安装方式：

- **macOS**：macOS 12（Monterey）及更高，原生 .dmg 安装包，同时支持 Apple Silicon 与 Intel
- **Windows**：Windows 10 及更高，原生 .exe 安装包
- **Linux（Debian/Ubuntu，推荐）**：

```bash
# 添加 Cursor 的 GPG 密钥
curl -fsSL https://downloads.cursor.com/keys/anysphere.asc | gpg --dearmor | sudo tee /etc/apt/keyrings/cursor.gpg > /dev/null

# 添加 Cursor 仓库
echo "deb [arch=amd64,arm64 signed-by=/etc/apt/keyrings/cursor.gpg] https://downloads.cursor.com/aptrepo stable main" | sudo tee /etc/apt/sources.list.d/cursor.list > /dev/null

# 更新并安装
sudo apt update
sudo apt install cursor
```

- **Linux（RHEL/Fedora）**：

```bash
# 添加 Cursor 仓库
sudo tee /etc/yum.repos.d/cursor.repo << 'EOF'
[cursor]
name=Cursor
baseurl=https://downloads.cursor.com/yumrepo
enabled=1
gpgcheck=1
gpgkey=https://downloads.cursor.com/keys/anysphere.asc
EOF

# 安装
sudo dnf install cursor
```

- **AppImage（便携）**：下载后 `chmod +x Cursor-*.AppImage && ./Cursor-*.AppImage`。官方建议优先用 apt/yum 包——它们提供桌面图标、自动更新与 CLI 工具。

### 装完后的第一个动作

官方 Quickstart 建议的三步热身，与本模块下一篇高度相关，这里一并译出：

1. **让 Cursor 解释代码库**：选好文件夹后按 `Cmd I` 打开 Agent，问"Explain this codebase. Point me to the main entry points, key modules, and anything I should read before making changes."（解释这个代码库，指出主入口、关键模块，以及改代码前我应该先读什么。）Cursor 会搜索仓库、阅读相关文件并总结项目结构——这是熟悉陌生代码库最快的方式之一。
2. **做一个小改动**：让 Cursor 提出"三个小而安全的改进建议，解释取舍并等我选择"，选一个让它实现。好的首批任务是低风险的：改进文案、修小的 UI 问题。
3. **审查 diff 并验证**：Agent 完成后审查 diff 视图，并让 Cursor 运行项目现有的检查——测试、类型检查、lint 或本地构建。

更大的改动先按 `Shift+Tab` 切到 Plan Mode：Cursor 会先研究代码库、澄清需求、产出实现计划，等你批准后再动手（详见第 10 篇）。

## 三、首次配置检查单（本站编者补充）

两家工具装好后，建议按这个顺序做四件事，为下一篇的第一次实战铺路：

1. **验证 shell 集成**：Claude Code 直接在项目目录运行 `claude`；Cursor 安装时会附带 `cursor` 命令行工具（从终端 `cursor .` 打开当前目录）。
2. **认识 `/doctor` 与 `/help`**：Claude Code 会话内输入 `/doctor` 可对安装与配置做一次"体检"，`/help` 列出全部命令；这是排障的第一入口。
3. **确认权限模式起点**：首次会话 Claude Code 会以默认权限模式启动（Pro/Max/Team 计划交互式终端会话为 auto 模式——由分类器代你审查动作；其他计划为 manual 模式——改文件、跑命令前先问你），随时可按 `Shift+Tab` 切换。权限体系的完整讲解见第 8 篇。
4. **先不改代码，只问问题**：在现有项目里问"这个项目是做什么的？""主入口在哪？"——让第一次会话停留在只读操作，体会"AI 读代码"的感觉，再进入写代码。

---

> 下一篇预告：环境就绪，我们正式开始第一次 AI 结对——从零做一个命令行小工具，把"描述目标 → 审查 → 验证"的循环走一遍。

> **来源**：本文编译自两家官方文档（2026-09 当前版本）：[Quickstart](https://code.claude.com/docs/en/quickstart) 与 [Advanced setup](https://code.claude.com/docs/en/setup)（Anthropic，Claude Code 官方文档，Copyright Anthropic PBC）及 [Cursor Quickstart](https://cursor.com/docs/get-started/quickstart)（Anysphere，Cursor 官方文档）。作者为 Anthropic 与 Anysphere 官方文档，许可署名翻译（官方文档版权归原厂所有，仅作教学用途翻译并署名）。"首次配置检查单"一节为本站编者补充并已标明。抓取于 2026-09-13。
