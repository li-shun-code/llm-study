---
title: 环境搭建：Claude Code 与 Cursor 的安装与配置矩阵
source_url: https://code.claude.com/docs/en/setup
author: Anthropic（Claude Code 官方文档 Setup / Troubleshoot installation and login / Model configuration / Settings）；Anysphere（Cursor 官方文档 Quickstart、Cursor CLI Installation）
license: 署名翻译（两家官方文档版权归原厂所有，本文为教学用途的编译与翻译，逐节署名）
fetched_at: 2026-09-19
translated: true
order: 5
group: Claude Code
---
装完工具只是起点。真正让人卡住的往往不是"怎么装"，而是**装完之后到底装成了什么版本、配置读的是哪一份、报了错该查哪一条**。本篇把终端形态的 Claude Code 与编辑器形态的 Cursor 两套路线整理成**可查的安装矩阵 + 配置矩阵 + 排障矩阵**：安装方式、系统要求、版本核实与发布通道、登录与凭据来源、配置文件分层、默认模型解析，以及官方"看到什么错→去解哪一节"的完整错误对照表。

本篇**不讲第一次会话怎么用**。装好之后想立刻跑通一个真实任务，请看《第一次 AI 结对：从零做一个命令行小工具》；想理解权限体系，看《Claude Code 权限系统与安全机制》；想理解账单，看《成本管理：Token 消耗、订阅选择与用量优化》。

> 时效注记：本篇依据 2026-09-19 抓取的官方文档当前版本核实。Claude Code 以 2.1.2xx 系列验证（`claude --version` 输出形如 `2.1.211 (Claude Code)`）；Cursor 以原生安装包 + apt/yum 仓库 + `agent` 命令行工具为准。安装命令与模型名随版本演进变化很快，动手前请以官方文档为准。

## 一、系统要求

*译自 Claude Code 官方文档 [Setup](https://code.claude.com/docs/en/setup) 的 System requirements 一节，与 Cursor 官方 [Quickstart](https://cursor.com/docs/get-started/quickstart) 的平台要求并列。*

| 项目 | Claude Code | Cursor |
| --- | --- | --- |
| macOS | 13.0 及以上 | 12（Monterey）及以上，原生 `.dmg`，Apple Silicon 与 Intel 都支持 |
| Windows | 10 1809+ 或 Windows Server 2019+（不支持 32 位） | 10 及以上，原生 `.exe` |
| Linux | Ubuntu 20.04+、Debian 10+、Alpine 3.19+（musl 有专用二进制） | Debian/Ubuntu（apt 仓库，官方推荐）、RHEL/Fedora（yum 仓库）、通用 AppImage |
| 内存 / CPU | 4 GB 以上；x64 或 ARM64 | 未列硬性下限 |
| Shell | Bash、Zsh、PowerShell、CMD | 终端内跑 CLI 需要 Bash/Zsh/PowerShell |
| 附加依赖 | ripgrep 通常内置；示例脚本大量使用 `jq`；原生 Windows 建议装 Git for Windows（否则 Bash 工具退回 PowerShell） | apt/yum 包会一并带上桌面图标、自动更新与命令行工具；AppImage 不带这些 |

两条容易忽略的差别：**Windows 上 Claude Code 需要 shell**（Git for Windows 提供 bash，没有就用 PowerShell 兜底），**WSL 环境不需要**再装 Git for Windows；**Cursor 的 AppImage 是便携版**，官方明确建议优先用 apt/yum 包，因为只有包安装才有自动更新与 CLI。

## 二、安装矩阵

### Claude Code 的安装方式

*译自官方 [Setup](https://code.claude.com/docs/en/setup) 与 [Quickstart](https://code.claude.com/docs/en/quickstart) 的安装节。*

| 方式 | 命令 | 自动更新 | 通道 | 适用 |
| --- | --- | --- | --- | --- |
| 原生脚本（推荐） | `curl -fsSL https://claude.ai/install.sh \| bash` | 后台自动更新 | `latest`（可改） | macOS / Linux / WSL |
| 原生 PowerShell | `irm https://claude.ai/install.ps1 \| iex` | 同上 | 同上 | Windows PowerShell |
| 原生 CMD | `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd` | 同上 | 同上 | Windows CMD |
| Homebrew 稳定 cask | `brew install --cask claude-code` | **不自动**，需 `brew upgrade claude-code` | stable（约滞后一周，跳过有重大回退的版本） | macOS / Linux |
| Homebrew 最新 cask | `brew install --cask claude-code@latest` | **不自动**，需 `brew upgrade claude-code@latest` | latest | 想第一时间拿新功能 |
| WinGet | `winget install Anthropic.ClaudeCode` | **不自动**，需 `winget upgrade Anthropic.ClaudeCode` | — | Windows |
| Linux 包管理器 | apt / dnf / apk（Debian、Fedora、RHEL、Alpine） | 随包管理器 | — | 服务器与镜像内置 |
| npm | `npm install -g @anthropic-ai/claude-code` | 视安装方式 | — | 已有 Node 工具链的 CI 镜像；注意它装的是包装器，原生二进制缺失会报 `Error: claude native binary not installed` |

**包管理安装的代价是"没有后台自动更新"**。官方在三种渠道（原生脚本 / Homebrew / WinGet）上分别写了这句提醒，选包管理器就要自己承担 `upgrade` 的节奏。

### Cursor 的安装方式

*译自 Cursor 官方 [Quickstart](https://cursor.com/docs/get-started/quickstart)。*

- **图形界面**：从 [cursor.com/downloads](https://cursor.com/downloads) 下载 macOS `.dmg` 或 Windows `.exe`。
- **Linux Debian/Ubuntu（官方推荐）**：

```bash
# 添加 Cursor 的 GPG 密钥
curl -fsSL https://downloads.cursor.com/keys/anysphere.asc | gpg --dearmor | sudo tee /etc/apt/keyrings/cursor.gpg > /dev/null

# 添加 Cursor 的 apt 仓库
echo "deb [arch=amd64,arm64 signed-by=/etc/apt/keyrings/cursor.gpg] https://downloads.cursor.com/aptrepo stable main" | sudo tee /etc/apt/sources.list.d/cursor.list > /dev/null

# 更新索引并安装
sudo apt update
sudo apt install cursor
```

- **Linux RHEL/Fedora**：

```bash
sudo tee /etc/yum.repos.d/cursor.repo << 'EOF'
[cursor]
name=Cursor
baseurl=https://downloads.cursor.com/yumrepo
enabled=1
gpgcheck=1
gpgkey=https://downloads.cursor.com/keys/anysphere.asc
EOF

sudo dnf install cursor
```

- **AppImage（便携）**：`chmod +x Cursor-*.AppImage && ./Cursor-*.AppImage`。
- **Cursor 命令行智能体（Cursor CLI）**：这是独立于编辑器的终端形态，装完后的可执行文件叫 `agent`，不是 `cursor`。

```bash
# macOS / Linux / Windows WSL
curl https://cursor.com/install -fsS | bash

# Windows 原生 PowerShell
irm 'https://cursor.com/install?win32=true' | iex

# 验证
agent --version
```

CLI 会装到 `~/.local/bin`，若 `agent` 找不到，需要把它加进 PATH：

```bash
# bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
# zsh
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

> 编者注（已标明）：`cursor` 是编辑器自带的打开当前目录的 shell 命令，`agent` 才是 Cursor 的智能体 CLI。两者都装完再去做别的事，否则很容易把 `command not found` 当成安装失败。

## 三、版本核实与发布通道

装完第一件事不是聊代码，而是**确认版本**。Claude Code 的不少能力是**有版本门槛**的：官方文档明确写着 **Opus 5 需要 Claude Code v2.1.219 或更高、Sonnet 5 需要 v2.1.197 或更高、Opus 4.8 需要 v2.1.154 或更高**；`/model` 在非交互模式下改模型要 v2.1.205+；组织默认模型要 v2.1.196+；`opusplan[1m]` 用 `/model` 设置要 v2.1.265+。**你看到的"文档里有但界面上找不到"的功能，十有八九是版本不够。**

```bash
claude --version    # 打印版本号 + (Claude Code)
claude update       # 手动触发一次更新检查
claude doctor       # 安装体检（PATH、权限、网络、认证四类）
```

会话内还可以直接用 `/doctor` 与 `/help`。

**发布通道**由 `autoUpdatesChannel` 设置控制：`"latest"`（默认，新功能一到就给）或 `"stable"`（约一周前的版本，跳过有重大回退的发布）。可以走 `/config` → **Auto-update channel**，也可以直接写进 settings：

```json
{
  "autoUpdatesChannel": "stable",
  "minimumVersion": "2.1.100"
}
```

`minimumVersion` 是**版本下限**：后台自动更新与 `claude update` 都拒绝安装低于该值的版本，于是"从 latest 切到 stable"不会把你降级。企业侧还有托管设置的 `requiredMinimumVersion` / `requiredMaximumVersion`——那才是"版本不在区间内就拒绝启动"的硬约束，而 `minimumVersion` 只约束更新行为。Homebrew 用户注意：通道由 **cask 名**决定（`claude-code` = stable、`claude-code@latest` = latest），不看这个设置。

想关掉后台自动更新，在 settings.json 的 `env` 里设 `"DISABLE_AUTOUPDATER": "1"`。

## 四、登录与凭据来源矩阵

Claude Code 需要账号才能用。可登录的账号类型与它们的**实际差异**：

| 账号类型 | 计费方式 | 默认模型（`default` 别名解析结果） | 备注 |
| --- | --- | --- | --- |
| Claude Pro | 订阅（$17/月按年付、$20/月按月付） | **Sonnet 5** | 个人日常够用 |
| Claude Max | 订阅（$100/月起，可选 5× 或 20× Pro 用量） | **Opus 5** | 用量大、要长会话自主干活 |
| Team Standard 席位 | 订阅（$20/席位·月按年、$25 按月） | **Sonnet 5** | Team Premium/Enterprise 走 Opus 5 |
| Team Premium 席位 | 订阅（$100/席位·月按年、$125 按月） | **Opus 5** | 5× 标准席用量 |
| Claude Console（API） | 预付费额度 | **Opus 5** | 首次登录会自动建一个 "Claude Code" 工作区，便于集中核算成本 |
| Amazon Bedrock / Google Cloud Agent Platform / Microsoft Foundry / Claude Platform on AWS | 企业云 | 见下方按 provider 解析 | 需要各自的云凭据 |
| 自托管 Claude apps gateway | 企业 SSO | 由网关配置决定 | 管理员预配网关 URL 后 `/login` 直接打开云网关界面 |

**账号类型决定默认模型，provider 又决定别名解析**。官方给出的对照表：`opus` 别名在 Anthropic API、Claude Platform on AWS、Bedrock、Agent Platform 上解析到 Opus 5，在 Microsoft Foundry 上只到 Opus 4.6；`sonnet` 在 Anthropic API 上是 Sonnet 5，在 AWS 上是 Sonnet 4.6，在 Bedrock/Agent Platform/Foundry 上是 Sonnet 4.5。**同一个 `--model opus`，在不同 provider 背后是不同的模型**——这也是跨团队复现别人成绩时最常见的坑。要钉死，就写全名（`claude-opus-5`）或设 `ANTHROPIC_DEFAULT_OPUS_MODEL`。

凭据优先级只有一句需要记住：**如果你环境里存在 `ANTHROPIC_API_KEY`，Claude Code 会跳过浏览器登录、改为请求你确认使用该密钥**。会话内切换账号或重新认证用 `/login`；登录后凭据会被保存，不需要每次登录。

Cursor 侧没有"选 provider"的问题：登录 Cursor 账号后由服务端按套餐调度模型；个人套餐为 Free / Pro（$20/月）/ Pro Plus（$60/月）/ Ultra（$200/月），团队为 Teams 标准席（$40/人·月）与 Premium 席（$120/人·月，Agent 限额 5×），另外在 Teams/Enterprise 上直接选用第三方模型还要叠加 **Cursor Token Rate $0.25/百万 token**（Cursor 自家的 Grok、Composer 不收这笔）。

## 五、配置文件分层矩阵

**"我改了配置为什么没生效"**几乎总是"改错层"。Claude Code 的配置按优先级从高到低：

| 层 | 位置 | 谁能改 | 典型用途 |
| --- | --- | --- | --- |
| 托管/策略设置 | 系统级路径（macOS `/Library/Application Support/ClaudeCode/`、Linux `/etc/claude-code/`、Windows `C:\Program Files\ClaudeCode\`）与云端下发 | 组织管理员 | 权限白名单、`availableModels`、版本区间、`allow_managed_hooks_only` |
| 命令行参数 | `claude --settings '{"model": "claude-opus-5"}'` | 启动者 | 一次性覆盖，适合脚本 |
| 项目本地（不提交） | `<repo>/.claude/settings.local.json` | 个人 | 个人在某仓库内的偏好，覆盖已提交的项目配置 |
| 项目（提交进仓库） | `<repo>/.claude/settings.json` | 团队 | 团队共享的权限、模型、hooks |
| 用户全局 | `~/.claude/settings.json` | 个人 | 自己的默认值 |
| 环境变量 | shell 或 `settings.json` 的 `env` 键 | — | `ANTHROPIC_MODEL`、`MAX_THINKING_TOKENS`、`DISABLE_TELEMETRY` 等 |

关键的三条规则：

1. **`settings.local.json` 压在已提交的 `settings.json` 之上**——想"只改自己不改同事"就写在这里，别去动团队文件。
2. **`--settings` 传入的值是"flag 层"**，优先级等同于命令行旗标，高于用户/项目设置，只作用于当次启动。
3. **托管设置优先于一切**：组织管理员可以在 `availableModels` 里禁掉某个模型，此时你即使显式选了新版本号，Claude Code 也会替换成允许列表内最新的版本并给出提示——**排查"我的模型怎么偷偷变了"先看这一层**。

Cursor 的配置面在编辑器的 Settings 与 `.cursor/` 目录（规则系统另见《Cursor 入门与 Rules 规则系统》）；团队与企业版还多出集中治理层——组织级规则、团队市场（内部 rules/skills/plugins）、SSO、用量分析。个人的 Cursor CLI 配置在 `~/.cursor/`。

## 六、常见安装失败排查

*以下译自 Claude Code 官方文档 [Troubleshoot installation and login](https://code.claude.com/docs/en/troubleshoot-install) 的 "Find your error" 对照表，并补上官方各小节给出的具体解法。*

| 你看到的报错 | 根因与解法 |
| --- | --- |
| `zsh: command not found: claude` / `bash: claude: command not found` / CMD 下 `'claude' is not recognized...` / PowerShell 下 `The term 'claude' is not recognized...` | 安装目录没进 PATH。按平台把安装目录加进 PATH，**然后开一个新终端**——安装时所在的那个会话还拿着旧的 PATH。 |
| `bash: line 1: syntax error near unexpected token '<'`、`<!DOCTYPE html>`；PowerShell 下 `iex : ... Missing argument in parameter list`、`ParserError`；或 `curl: (22) The requested URL returned error: 403` | 安装 URL 返回的是网页或错误状态而不是脚本。页面若写着 "App unavailable in region"，说明所在国家/地区不支持；若只有裸 403，多半是企业代理/防火墙挡了下载。换备用安装法（macOS 用 Homebrew、Windows 用 WinGet），或等几分钟后重试——多数是暂时性故障。改用 `-OutFile install.ps1` 下载**没用**，存下来的还是那张网页。 |
| `curl: (23)` 或 `curl: (56) Failure writing output to destination` | `curl \| bash` 是管道，56 表示下载本身被切断，23 表示 curl 写不进管道（通常 Bash 提前退出）。先测能否访问 `downloads.claude.ai`，能通就是抖动，重试即可。 |
| Linux 上安装过程显示 `Killed`，或 `exit code 137` | 内存不足被 OOM killer 杀掉（低配云主机常见）。腾内存或加 swap 后重试。 |
| `Raw mode is not supported` | 终端不支持原始模式（多见于奇怪的两栖终端）。换一个常规终端重跑安装器。 |
| `TLS connect error` / `SSL/TLS secure channel` / `unable to get local issuer certificate` | 证书问题：更新 CA 证书；企业内网需要配好公司根证书。 |
| `Failed to fetch version from downloads.claude.ai` | 网络或代理设置问题，走"检查网络连通性"一节。 |
| `The token '&&' is not a valid statement separator` | 你在 PowerShell 里跑了 CMD 版命令。提示符 `PS C:\` 是 PowerShell、没有 `PS` 的 `C:\` 是 CMD。 |
| `'irm' is not recognized as an internal or external command` | 反过来：在 CMD 里跑了 PowerShell 命令。 |
| `A parameter cannot be found that matches parameter name 'fsSL'` / `'bash' is not recognized as the name of a cmdlet` | 在 PowerShell 里误用了 curl 版命令，改用 Windows 安装命令。 |
| `Error: Cask 'claude-code' is unavailable: No Cask with this name exists` | 本地 Homebrew cask 索引比该 cask 的发布更早：`brew update` 后重装。装到旧版本也是同一个原因；要最新的就装 `claude-code@latest`。 |
| `Claude Code on Windows requires either Git for Windows (for bash) or PowerShell` | 装一个可用 shell（Git for Windows 或 PowerShell）。 |
| `Claude Code does not support 32-bit Windows` | 打开的是 x86 版 PowerShell，换 64 位。 |
| `The process cannot access the file ... used by another process` | Windows 下载目录被占用，清理后重试。 |
| `Error loading shared library` | Linux musl / glibc 二进制装错档（Alpine 用 musl，多数发行版用 glibc）。 |
| `Illegal instruction` | CPU 指令集或架构不匹配。 |
| `dyld: Symbol not found` / `dyld: cannot load` / `Abort trap`（macOS） | 二进制与当前 macOS 不兼容。 |
| `Exec format error`（WSL1） | WSL1 跑原生二进制的已知回退，改用 WSL2。 |
| `Error: claude native binary not installed` | npm 安装没走完（原生二进制是 postinstall 下载的），重装并确认允许安装脚本。 |
| `npm error code ENOTEMPTY` | 更新/重装时留下了残余目录，删掉该目录再装。 |
| `running scripts is disabled on this system` / `PSSecurityException` | Windows 执行策略挡住了 npm 的 shim，放行本地脚本。 |
| `claude update` 卡在 `Checking for updates`、`claude doctor` 无输出挂死 | 某个 shell 配置文件的路径上存在同名目录挡住了；把它挪走。 |
| `OAuth error: Invalid code` / 登录后仍 `403 Forbidden` / "This organization has been disabled" | 属登录问题：`/logout` 后重置登录再走一遍；组织被停用是计费侧问题，要联系组织管理员。 |
| WSL2 / SSH / 容器里 OAuth 起不来 | 浏览器回调打不通本机端口，按官方"在远程环境登录"一节改用手贴回 code 的方式。 |
| `Could not load the default credentials` / `ChainedTokenCredential authentication failed` | Bedrock / Agent Platform / Foundry 的云凭据没配好。 |
| `App unavailable in region` | Claude Code 在该国家/地区不可用，见官方 supported countries 列表。 |

**排障的统一入口**是 `claude doctor`（会话内 `/doctor`）——PATH、权限、网络、认证四类问题它都会逐项体检，比人肉猜快。

## 七、装完之后去哪

四个动作把环境"钉牢"，再进入实操：

1. `claude --version` / `agent --version` 记录版本，把版本要求和你打算用的模型对上看时效注记。
2. 确认权限模式的起点：Pro/Max/Team 计划的交互式终端会话默认从 **auto 模式**启动（由分类器代你审动作），其他计划默认 **manual 模式**（改文件、跑命令前先问）；随时 `Shift+Tab` 切换。完整讲解见《Claude Code 权限系统与安全机制》。
3. 把 `~/.claude/settings.json` 与项目 `.claude/settings.json` 的分工写进团队约定——**哪些配置该提交进仓库**，是后面多人协作时最容易吵架的地方。
4. 开一个新终端验证 PATH 生效。

---

> **来源**：本文编译自三家官方文档（2026-09-19 当前版本）：[Setup](https://code.claude.com/docs/en/setup)、[Troubleshoot installation and login](https://code.claude.com/docs/en/troubleshoot-install)、[Model configuration](https://code.claude.com/docs/en/model-config)、[Settings](https://code.claude.com/docs/en/settings)（Anthropic Claude Code 官方文档，Copyright Anthropic PBC）；[Claude Pricing](https://claude.com/pricing)（Anthropic，订阅价格）；[Cursor Quickstart](https://cursor.com/docs/get-started/quickstart) 与 [Cursor CLI Installation](https://cursor.com/docs/cli/installation)、[Models & Pricing](https://cursor.com/docs/models-and-pricing)（Anysphere，Cursor 官方文档）。作者为各原厂官方文档，许可署名翻译（官方文档版权归原厂所有，仅作教学用途翻译并署名）。"配置文件分层"一节中的三条规则归纳、Cursor CLI 与编辑器命令的区分提示、以及"装完之后去哪"一节为本站编者补充并已标明。抓取于 2026-09-19。
