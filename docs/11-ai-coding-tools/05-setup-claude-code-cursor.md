---
title: 环境搭建：Claude Code、Cursor、Codex CLI 与 Copilot 的安装与配置矩阵
source_url: https://code.claude.com/docs/en/setup
author: Anthropic（Claude Code 官方文档 Setup / Settings / Model configuration / Authentication / Enterprise network configuration / Troubleshoot installation and login）；Anysphere（Cursor 官方文档 Quickstart、Rules、CLI Installation / Authentication / Configuration、Network configuration、Models and Pricing）；OpenAI（openai/codex 仓库 README、docs/install.md、docs/config.md 与 codex-rs 源码中的配置加载与登录实现）；GitHub（GitHub Copilot 官方文档 Install / Authenticate / Configure Copilot CLI、Change settings、CLI configuration directory、Copilot plans）
license: 署名翻译（各官方文档版权归原厂所有；openai/codex 仓库为 Apache-2.0；本文为教学用途的编译与翻译，逐节署名）
fetched_at: 2026-09-19
translated: true
versions: Claude Code 2.1.240；Cursor 桌面版 + CLI（可执行名 `agent`）；Codex CLI rust-v0.155.1；GitHub Copilot CLI v1.0.86；npm 路线的 Node 门槛见第一节
order: 5
group: 环境搭建
---
这是本模块的**装修台**：四款主流 AI 编码工具（终端形态的 Claude Code 与 Codex CLI、编辑器形态的 Cursor、IDE 扩展 + 终端双形态的 GitHub Copilot）在同一张表里对齐——**怎么装、装完是什么版本、用什么身份登录、代理怎么走、模型从哪来、配置该写进哪个文件、怎么证明它真的装好了**。

本篇**不讲第一次会话怎么用**。装好之后想立刻跑通一个真实任务，看《第一次 AI 结对：从零做一个命令行小工具》；权限模型、沙箱与审批策略的取舍，看《Claude Code 权限系统与安全机制》与《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》；订阅价格与模型清单，看《AI 编程工具全景对比（2026-09 版）》；账单怎么省，看《成本管理：Token 消耗、订阅选择与用量优化》；规范文件写什么，看《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》。

> 时效注记：本篇的安装命令、配置路径与默认模型按 2026-09-19 各官方文档当前版本整理。版本参考值：Claude Code `2.1.240`（`claude --version` 输出形如 `2.1.240 (Claude Code)`）、Codex CLI 稳定发布 `rust-v0.155.1`、GitHub Copilot CLI `v1.0.86`、Cursor 为原生安装包 + `agent` 命令行工具。安装命令与模型名变化很快，动手前再对一眼官方文档。

## 〇、四件套速查矩阵

*各列取自本节之后各小节的官方原文，此表只做索引。*

| 维度 | Claude Code | Cursor | Codex CLI | GitHub Copilot |
| --- | --- | --- | --- | --- |
| 入口命令 | `claude` | 编辑器 + `agent`（CLI）、`cursor`（打开目录） | `codex` | `copilot`（CLI）+ IDE 扩展 |
| 首选安装 | `curl -fsSL https://claude.ai/install.sh \| bash` | 官网安装包 / apt / yum | `curl -fsSL https://chatgpt.com/codex/install.sh \| sh` | `curl -fsSL https://gh.io/copilot-install \| bash` |
| 包管理器 | brew cask、winget、apt/dnf/apk、npm | apt/yum 包自带 CLI | brew cask、npm | brew cask、winget、npm |
| 登录 | 浏览器 OAuth，或 API key | Cursor 账号 / `CURSOR_API_KEY` | ChatGPT 账号，或 API key | GitHub 账号（PAT/BYOK 可选） |
| 凭据位置 | macOS 钥匙串；Linux/Windows `~/.claude/.credentials.json` | 本地登录态（CLI `agent status` 可查） | `~/.codex/auth.json` | 系统钥匙串 `copilot-cli`；无钥匙串回落 `~/.copilot/config.json` |
| 个人配置 | `~/.claude/settings.json` | `~/.cursor/cli-config.json` | `~/.codex/config.toml` | `~/.copilot/settings.json` |
| 项目配置 | `.claude/settings.json`（+ `.local.json`） | `.cursor/rules/*.mdc`、`.cursor/cli.json` | `AGENTS.md`、`.codex/` | `.github/copilot-instructions.md`、`AGENTS.md` |
| 规范文件 | `CLAUDE.md`（兼读 `AGENTS.md`） | `AGENTS.md`（含子目录嵌套） | `AGENTS.md`（含子目录嵌套） | `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` / `*.instructions.md` |
| 配置目录开关 | `CLAUDE_CONFIG_DIR` | `CURSOR_CONFIG_DIR`、`XDG_CONFIG_HOME` | `CODEX_HOME` | `COPILOT_HOME`（cache 另用 `COPILOT_CACHE_HOME`） |
| 验证装好 | `claude --version`、`claude doctor` | `agent --version`、`agent status` | `codex --version`、`codex doctor` | `copilot version`、会话内 `/user` |
| 升级 | `claude update`（原生装法后台自动） | `agent update`（CLI 默认自更新） | `codex update` | `copilot update`（`autoUpdate` 可关） |
| 无人值守 | `claude -p` + `claude setup-token` | `agent --api-key` | `codex exec` | `copilot -p` + token 环境变量 |

## 一、系统与终端前置

| 项目 | Claude Code | Cursor | Codex CLI | Copilot CLI |
| --- | --- | --- | --- | --- |
| macOS | 13.0 及以上 | 12（Monterey）及以上，原生 `.dmg`，Apple Silicon 与 Intel 都支持 | 12 及以上 | 官方未列系统下限；脚本默认装到 `$HOME/.local` |
| Windows | 10 1809+ 或 Server 2019+，不支持 32 位 | 10 及以上，原生 `.exe` | 11，**且必须经 WSL2** | 原生可装，前置是 PowerShell **v6 或更高** |
| Linux | Ubuntu 20.04+、Debian 10+、Alpine 3.19+（musl 有专用二进制） | Debian/Ubuntu（apt 仓库，官方推荐）、RHEL/Fedora（yum 仓库）、通用 AppImage | Ubuntu 20.04+、Debian 10+ | 全平台（brew / npm / 脚本） |
| 内存 | 4 GB 以上，x64 或 ARM64 | 未列硬性下限 | 4 GB 最低、8 GB 推荐 | 未列硬性下限 |
| Shell | Bash、Zsh、PowerShell、CMD | CLI 需要 Bash/Zsh（Windows 走 PowerShell） | 终端 TUI 需要可用 shell | Bash/Zsh/PowerShell |
| Node | 非必需（原生二进制）。npm 装法若要读操作系统证书库，需 **Node 22.15+** | 不需要（CLI 是独立二进制） | 不需要（Rust 二进制）；仅 npm 装法需要 Node | **npm 装法要求 Node.js 22+** |
| Git | 原生 Windows 建议装 Git for Windows（提供 Bash 工具，否则退回 PowerShell 工具）；WSL 不需要 | 编辑器自动更新与 CLI 依赖包安装（AppImage 不带） | 2.23+ 可选推荐（内置 PR 辅助命令要用） | 需要仓库上下文时按常规装 Git |
| 额外依赖 | Alpine/musl 需先 `apk add bash curl libgcc libstdc++ ripgrep`，并设 `USE_BUILTIN_RIPGREP=0` | apt/yum 包会带上桌面图标、自动更新与命令行工具；AppImage 都不带 | GitHub Release 里混着多个可执行文件，解压后需自己 `mv` 成 `codex` | 组织/企业需管理员未禁用 Copilot CLI |

三条容易被忽略的前置差别：**Codex CLI 在 Windows 上只有 WSL2 这一条路**；**Copilot CLI 的 npm 装法卡在 Node 22**，且如果你的 `~/.npmrc` 里有 `ignore-scripts=true`，得改用 `npm_config_ignore_scripts=false npm install -g @github/copilot`；**Claude Code 在原生 Windows 上是否有 Bash 工具，取决于你有没有装 Git for Windows**——这会影响智能体执行命令的方式，而不只是"能不能跑起来"。

## 二、安装矩阵

### Claude Code

*译自官方 [Setup](https://code.claude.com/docs/en/setup) 的 Install 与 Update 两节。*

| 方式 | 命令 | 自动更新 | 通道 | 适用 |
| --- | --- | --- | --- | --- |
| 原生脚本（推荐） | `curl -fsSL https://claude.ai/install.sh \| bash` | 后台自动 | `latest`（可改） | macOS / Linux / WSL |
| 原生 PowerShell | `irm https://claude.ai/install.ps1 \| iex` | 后台自动 | 同上 | Windows 原生 |
| 原生 CMD | `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd` | 后台自动 | 同上 | Windows CMD |
| Homebrew | `brew install --cask claude-code` | **不自动** | stable（约滞后一周，跳过有重大回退的版本） | macOS / Linux |
| Homebrew 最新 | `brew install --cask claude-code@latest` | **不自动** | latest | 想第一时间拿新功能 |
| WinGet | `winget install Anthropic.ClaudeCode` | **不自动** | — | Windows |
| Linux 包管理器 | apt / dnf / apk | **不自动**（需提权） | — | 服务器与镜像内置 |
| npm | `npm install -g @anthropic-ai/claude-code` | 视目录可写性 | — | 已有 Node 工具链的 CI 镜像 |

包管理器装法默认没有后台自更新，但可以从工具内部代跑：把 `CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE` 设为 `1`，Claude Code 会在检测到新版本时自行执行升级命令并提示重启（WinGet 在自身运行期间可能因文件占用失败，apt/dnf/apk 因需要提权仍须手动）。Homebrew 升级后会保留旧版本，记得定期 `brew cleanup`。

手动命令：`claude update`（触发一次更新检查）、`claude doctor`（含最近一次更新的成败）。**发布通道**写在设置里：

```json
{
  "autoUpdatesChannel": "stable",
  "minimumVersion": "2.1.100"
}
```

`minimumVersion` 只约束"更新行为"（后台更新与 `claude update` 都拒绝低于该值的版本，于是从 latest 切 stable 不会被降级）；企业侧的 `requiredMinimumVersion` / `requiredMaximumVersion` 才是"版本不在区间就拒绝启动"的硬约束。**Homebrew 的通道由 cask 名决定**（`claude-code` = stable、`claude-code@latest` = latest），不看这个键。想彻底关掉后台更新，在 `env` 里设 `"DISABLE_AUTOUPDATER": "1"`。

原生安装器在 macOS/Linux 上把启动器放在 `~/.local/bin/claude`，它是指向 `~/.local/share/claude/versions/` 的符号链接。**如果你自己替换了这个启动器**（v2.1.207 之后启动器不再被覆盖），版本目录会一直累积，`claude doctor` 会报告"启动器不是安装器创建的"。

### Cursor（编辑器 + CLI 两条安装线）

*译自 Cursor 官方 [Quickstart](https://cursor.com/docs/get-started/quickstart) 与 [CLI Installation](https://cursor.com/docs/cli/installation)。*

编辑器：macOS `.dmg`、Windows `.exe`、[cursor.com/downloads](https://cursor.com/downloads)；Linux 官方推荐走仓库安装：

```bash
# Debian/Ubuntu：加 GPG 密钥与 apt 仓库，再安装
curl -fsSL https://downloads.cursor.com/keys/anysphere.asc | gpg --dearmor | sudo tee /etc/apt/keyrings/cursor.gpg > /dev/null
echo "deb [arch=amd64,arm64 signed-by=/etc/apt/keyrings/cursor.gpg] https://downloads.cursor.com/aptrepo stable main" | sudo tee /etc/apt/sources.list.d/cursor.list > /dev/null
sudo apt update && sudo apt install cursor
```

```bash
# RHEL/Fedora：写 yum 仓库再安装
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

AppImage 是便携版：`chmod +x Cursor-*.AppImage && ./Cursor-*.AppImage`。**官方明确建议优先用 apt/yum 包**——只有包安装才有桌面图标、自动更新和命令行工具。

CLI（独立于编辑器的终端形态，可执行文件名是 `agent`）：

```bash
# macOS / Linux / Windows WSL
curl https://cursor.com/install -fsS | bash

# Windows 原生 PowerShell
irm 'https://cursor.com/install?win32=true' | iex

# 验证 / 升级
agent --version
agent update
```

CLI 装到 `~/.local/bin`，找不到 `agent` 时把它加进 PATH（然后**开一个新终端**）：

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc   # bash 用户改 ~/.bashrc
```

> 编者注（本站补充）：`cursor` 是编辑器提供的"打开当前目录"命令，`agent` 才是 Cursor 的智能体 CLI。把 `command not found: agent` 当成安装失败，是这条路线上最常见的误判。

### Codex CLI

*取自 [openai/codex](https://github.com/openai/codex) 仓库 README 与 `docs/install.md`（Apache-2.0）。*

```bash
# macOS / Linux：官方安装脚本
curl -fsSL https://chatgpt.com/codex/install.sh | sh

# Windows（PowerShell）
powershell -ExecutionPolicy ByPass -c "irm https://chatgpt.com/codex/install.ps1 | iex"

# 包管理器
npm install -g @openai/codex
brew install --cask codex

# 验证 / 升级 / 体检
codex --version
codex update
codex doctor
```

独立安装器默认从 `https://releases.openai.com/codex` 下载，元数据或资源拉不到时才回落 GitHub Releases；要强制走 GitHub Releases，把 `CODEX_INSTALLER_USE_RELEASES_OPENAI_COM` 设为 `false`（`0`、`no` 同样有效）。想**钉死版本**，仓库提供了 DotSlash 文件 `codex`：把"哪个平台用哪个二进制版本"提交进仓库，协作者就跑同一个可执行文件——这是四件套里唯一的原生版本钉死思路。系统要求与源码构建步骤见 `docs/install.md`（Rust 路线用 `cargo build` + `just` 系列命令）。

### GitHub Copilot（CLI 与 IDE 两条线）

*译自 GitHub 官方 [Install Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli) 与 [CLI command reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-command-reference)。*

```bash
# macOS / Linux 安装脚本（默认装到 $HOME/.local，root 下装到 /usr/local/bin）
curl -fsSL https://gh.io/copilot-install | bash
# 指定版本与目录
curl -fsSL https://gh.io/copilot-install | VERSION="v1.0.86" PREFIX="$HOME/custom" bash

# Homebrew / WinGet / npm（npm 需 Node.js 22+）
brew install --cask copilot-cli
winget install GitHub.Copilot
npm install -g @github/copilot

# 验证 / 升级
copilot version      # 打印版本并检查是否有更新
copilot update
```

三条路线都有 prerelease 通道：`brew install --cask copilot-cli@prerelease`、`winget install GitHub.Copilot.Prerelease`、`npm install -g @github/copilot@prerelease`。想直接用 GitHub 上的可执行文件，去 `copilot-cli` 仓库的 Releases 下载对应平台产物解压即可。

IDE 侧不需要命令行：VS Code / Visual Studio / JetBrains 系 / Vim 与 Neovim 都在各自市场装 Copilot 扩展或插件（Vim 路线要求 Vim 9.0.0185 / Neovim 0.6+、Node.js 18+），装完在 IDE 里登录 GitHub 账号即可。**IDE 扩展与 CLI 是两套登录态**：CLI 认自己的钥匙串条目与环境变量，扩展走 IDE 的账号流程。

## 三、登录与鉴权矩阵

| 工具 | 交互登录 | 无人值守 / CI | 凭据落在哪 | 一句最容易踩的规则 |
| --- | --- | --- | --- | --- |
| Claude Code | 首次运行 `claude` 走浏览器；会话内 `/login`、`/logout` | `claude setup-token` 产出 `CLAUDE_CODE_OAUTH_TOKEN`；或 `ANTHROPIC_API_KEY`、`ANTHROPIC_AUTH_TOKEN`、`apiKeyHelper` 脚本 | macOS：系统钥匙串；钥匙串拒写（如 SSH 会话里被锁）时回落 `~/.claude/.credentials.json`（权限 `0600`）。Linux 同路径，Windows 在 `%USERPROFILE%\.claude\.credentials.json` | 环境里存在 `ANTHROPIC_API_KEY` 时，Claude Code **跳过浏览器登录**、改为请你确认使用该密钥；`/config` 里的"Use custom API key"开关只在它存在时出现 |
| Cursor | 编辑器里登录；CLI 用 `agent login`（`agent status` 查状态，`agent logout` 清掉） | `export CURSOR_API_KEY=...`（Dashboard → API Keys 生成），或 `agent --api-key ...` | 本地登录态；`agent status` 会同时显示账号与当前 endpoint | 浏览器不弹时 `NO_OPEN_BROWSER=1 agent login`，它会打印 URL 让你手动打开 |
| Codex CLI | 运行 `codex` 选 **Sign in with ChatGPT**（Plus/Pro/Business/Edu/Enterprise 套餐内含 Codex 额度）；`codex login` 起本地登录服务 | `codex login --device-auth`（远程/无头）；`printenv OPENAI_API_KEY \| codex login --with-api-key`（密钥走 stdin，不接受命令行明文参数） | `~/.codex/auth.json`（`CODEX_HOME` 换目录） | 官方推荐用 ChatGPT 登录；**进 CI 就别用个人登录态**，改用 API key 或服务账号 |
| Copilot CLI | `copilot login` 或会话内 `/login`；本机默认浏览器回环流，SSH/Codespaces/dev container/CI 自动改用设备码流；可用 `--web-flow` / `--device-code` 强制 | `COPILOT_GITHUB_TOKEN` > `GH_TOKEN` > `GITHUB_TOKEN`（任一均可，**静默覆盖钥匙串里的登录**）；或 `copilot login --with-token < mytoken.txt`；`gh` 已登录时作为最低优先级兜底 | 系统凭据库（macOS 钥匙串 / Windows 凭据管理器 / Linux libsecret），服务名 `copilot-cli`；无凭据库时提示你写入明文 `~/.copilot/config.json` | fine-grained PAT 必须是**个人账号所有**且勾选 **Copilot Requests** 账户权限；classic PAT（`ghp_`）不支持。GHE 用 `copilot login --host HOSTNAME` |

多账号场景：Copilot CLI 支持 `/user list` 与 `/user switch`，并会记住最后使用的账号；Claude Code 的凭据选择是一条固定优先链——云 provider 变量（`CLAUDE_CODE_USE_BEDROCK` / `CLAUDE_CODE_USE_VERTEX` / `CLAUDE_CODE_USE_FOUNDRY`）→ `ANTHROPIC_AUTH_TOKEN` → `ANTHROPIC_API_KEY` → `apiKeyHelper` → `CLAUDE_CODE_OAUTH_TOKEN` → profile/联邦凭据 → `/login` 的订阅 OAuth，自建 Claude apps gateway 登录态凌驾于整条链之上。`apiKeyHelper` 默认每 5 分钟重跑一次，用 `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` 调周期。

BYOK（自带模型供应商）在四家里只有两家有独立通道：Copilot CLI 用 `~/.copilot/providers.json`（或 `COPILOT_PROVIDER_BASE_URL` / `COPILOT_PROVIDER_API_KEY`）配好之后**可以不登录 GitHub**（代价是 `/delegate`、GitHub MCP、代码搜索不可用），把 `COPILOT_OFFLINE` 设为 `true` 可完全不碰 GitHub 服务器；Codex 走 `[model_providers.<id>]` 指向自建网关。

## 四、代理与网络矩阵

| 工具 | 代理 | 自建 CA / TLS 检查 | 企业特有开关 |
| --- | --- | --- | --- |
| Claude Code | `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`（小写也认，取值优先序 `https_proxy`、`HTTPS_PROXY`、`http_proxy`、`HTTP_PROXY`；`NO_PROXY` 空格或逗号分隔均可；到 `127.0.0.1` 的 WebSocket 永不分流）。代理 URL 解析不了（比如漏了 `http://`）会**在启动时直接报错并点名变量** | 默认同时信任内置 Mozilla CA 与系统证书库（读系统库要求原生装法或 **Node 22.15+**）；否则显式 `NODE_EXTRA_CA_CERTS=/path/corp-ca.pem` | mTLS：`CLAUDE_CODE_CLIENT_CERT` / `CLAUDE_CODE_CLIENT_KEY`（连接出错时会重读轮换后的文件）。在 Claude Desktop 托管的连接里，这些变量与代理变量**只从托管设置和 `~/.claude/settings.json` 读**，忽略仓库自带的 settings（v2.1.217 起） |
| Cursor | 编辑器用 VS Code 血统的 `http.proxy`（把 `http://USER:PASS@host:port/` 写进设置即可用基本认证）；CLI 用 `HTTP_PROXY` / `HTTPS_PROXY` **并额外需要 `NODE_USE_ENV_PROXY=1`** | `NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.pem` | 代理不支持 HTTP/2 双向流时（Zscaler 是典型），在 `~/.cursor/cli-config.json` 里设 `"network": { "useHttp1ForAgent": true }`，改走 HTTP/1.1 + SSE。**官方建议对企业域名关闭 SSL 检查**（Cursor 自身已端到端加密） |
| Codex CLI | 网络能力属于沙箱策略：`sandbox_mode` 与其中的 `network_access` 决定沙箱内能不能联网，被禁用时子进程看到 `CODEX_SANDBOX_NETWORK_DISABLED=1`；细节见《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》 | 未提供独立 CA 变量；走企业网关时用 `[model_providers.<id>]` 指定 `base_url` 与凭据 | `codex doctor` 的网络检查项会逐条报（另有 sandbox、git、磁盘、更新等检查模块）。日志用 `RUST_LOG`，或 `codex -c log_dir=./.codex-log` 落地明文日志 |
| Copilot CLI | `~/.copilot/settings.json` 里的 `proxyUrl`（如 `http://proxy.corp.example:3128`），**被 `HTTP_PROXY` / `HTTPS_PROXY` 环境变量覆盖**；`proxyKerberosServicePrincipal` 走 Kerberos/Negotiate；代理类设置改动需要重启会话 | 沙箱联网另有策略：`sandbox.userPolicy.network.proxy`（macOS 协作式、Linux 严格 netns 且代理必须是 IPv4 明文地址、Windows 不支持），密码存钥匙串而非 `settings.json` | IDE 侧：VS Code `http.proxy` + `http.proxyStrictSSL`；JetBrains 在 System Settings → HTTP Proxy；Visual Studio 读 Windows 系统代理但不取凭据，需要 `setx COPILOT_USE_DEFAULTPROXY true` |

**网络类故障的三个诊断动作**。前两条译自 Cursor 官方 [Network Configuration](https://cursor.com/docs/enterprise/network-configuration) 的 "Testing proxy connectivity" 一节，它们的思路（看签发者、看流是否被缓冲）对任何走 TLS 检查代理的工具都适用：

```bash
# 1. 看证书是不是被企业代理换掉了：正常应看到 Amazon RSA；看到 Zscaler 之类＝SSL 检查已介入
curl -v https://api2.cursor.sh |& grep -C1 issuer:

# 2. 测 HTTP/1.1 流式：正常应 5 秒内逐行出现；攒够一次性吐出＝代理在缓冲
echo -ne "\x0\x0\x0\x0\x11{\"payload\":\"foo\"}" | \
  curl --http1.1 -No - -XPOST \
  -H "Content-Type: application/connect+json" \
  --data-binary @- \
  https://api2.cursor.sh/aiserver.v1.HealthService/StreamSSE

# 3. 装好但连不上，先确认工具自己的下载/更新域名可达（Claude Code 是 downloads.claude.ai）
curl -sI https://downloads.claude.ai >/dev/null && echo reachable
```

官方还给了 HTTP/2 双向流的等价探针（`StreamBidi`，每秒一次输出为正常），以及一条企业侧建议：**防火墙按域名模式放行，别维护 IP 列表**（IP 会变），并单独记住 `api3.cursor.sh`、`repo42.cursor.sh` 这类**只支持 HTTP/2** 的子域名（Tab 补全与代码库搜索走它们）。

## 五、模型与订阅档位：谁决定你默认跑在哪个模型上

| 工具 | 决定默认模型的因子 | 换模型 / 钉版本 |
| --- | --- | --- |
| Claude Code | **账号类型 + provider**。Default 别名解析：Max、Team Premium、Enterprise、Anthropic API → Opus 5；Pro、Team Standard → Sonnet 5；Microsoft Foundry → Sonnet 4.5。`fable` 别名在 v2.1.257+ 解析到 Fable 5.1（Claude apps gateway 会话里 `fable`、`best` 仍是 Fable 5） | `/model`、`--model`、`ANTHROPIC_MODEL`、`model` 设置；`ANTHROPIC_DEFAULT_MODEL`（v2.1.236+）；要钉死具体版本写全名（`claude-opus-5`）或设 `ANTHROPIC_DEFAULT_OPUS_MODEL` 等四个别名变量。**版本门槛**：Opus 5 要 v2.1.219+、Sonnet 5 要 v2.1.197+、Opus 4.8 要 v2.1.154+、Fable 5.1 要 v2.1.257+ |
| Codex CLI | **登录身份**（ChatGPT 套餐额度 vs API key 计费），模型集合由服务端下发 | `~/.codex/config.toml` 的 `model`、`model_reasoning_effort`、`model_context_window`；一次性覆盖用 `-c model=...`；`--profile` 叠加 `$CODEX_HOME/<name>.config.toml`。仓库 `codex-rs/models-manager/models.json` 当前列的是 GPT-6 Astra、GPT-5.6 Sol/Terra/Luna、GPT-5.5、GPT-5.4 与 `codex-auto-review` |
| Cursor | **服务端按套餐调度**，个人档位分两个用量池（Cursor 自家 Grok / Composer 与第三方模型分开计） | CLI 里 `/model auto`（还有 `maxMode` 偏好），`~/.cursor/cli-config.json` 的 `model`；编辑器里模型选择器 |
| Copilot | **Copilot 档位**。Free 与学生档只有 Auto model selection；Pro 给"一批模型"；Pro+ 与 Business 开 premium 模型；Max 与 Enterprise 是 premium 模型的优先访问 | CLI：`--model=MODEL`、`COPILOT_MODEL`、会话内 `/model`；`auto` 交给自动选模型。用量以 GitHub AI Credits 计（补全与下一步编辑不计、付费档不限次） |

**同一个别名在四家背后是不同模型**，这是跨工具复现结果时最贵的坑。Claude Code 的官方对照表：`opus` 在 Anthropic API、Claude Platform on AWS、Amazon Bedrock、Google Cloud Agent Platform 上都是 Opus 5，在 Microsoft Foundry 上只到 Opus 4.6；`sonnet` 在 Anthropic API 上是 Sonnet 5，在 Claude Platform on AWS 上是 Sonnet 4.6，在 Bedrock/Agent Platform/Foundry 上是 Sonnet 4.5。要可复现，**写全名，别写别名**。各档价格、模型清单与 API 单价集中在《AI 编程工具全景对比（2026-09 版）》，本篇不再重复；预算怎么花在《成本管理：Token 消耗、订阅选择与用量优化》。

## 六、配置项放哪里

### 分层与优先级

| 工具 | 从高到低的作用层 |
| --- | --- |
| Claude Code | 托管/策略设置（`managed-settings.json`、MDM 或云端下发：macOS `/Library/Application Support/ClaudeCode/`、Linux `/etc/claude-code/`、Windows `C:\Program Files\ClaudeCode\`）→ 命令行（`--settings` 传 JSON、`--model` 等旗标）→ 项目本地 `.claude/settings.local.json` → 项目共享 `.claude/settings.json` → 用户 `~/.claude/settings.json` → 环境变量与 `env` 键 |
| Cursor | 规则系统：**Team Rules → Project Rules（`.cursor/rules/*.mdc`）→ User Rules**，合并生效、冲突时靠前者优先。CLI：项目 `.cursor/cli.json` **只能配权限**，其余一律走全局 `~/.cursor/cli-config.json` |
| Codex CLI | 托管 `requirements.toml`（例如 `allow_managed_hooks_only = true`——**这个键只在 `requirements.toml` 里被承认**，写进 `config.toml` 不生效）→ 命令行 `-c` 覆盖 → `--profile` 叠加层 → `~/.codex/config.toml` → 环境变量（`CODEX_HOME`、`RUST_LOG`） |
| Copilot CLI | 仓库/组织托管的设置（展示但不被个人值覆盖）→ `--config-dir`（已废弃，改用 `COPILOT_HOME`）→ `~/.copilot/settings.json`（JSONC，支持注释；旧版本写在 `config.json` 里的用户设置会在启动时自动迁移过来）→ 环境变量（`HTTP_PROXY` 等） |

三条"改了没生效"的定位规则值得单独记：

1. **`.claude/settings.local.json` 压在已提交的 `.claude/settings.json` 之上**——想只改自己不改动同事，就写在这里。Claude Code 自己创建该文件时会加进全局 git excludes；你手建的话要自己补 `.gitignore`。
2. **托管设置优先于一切**：管理员的 `availableModels` 一旦禁掉某个模型，你显式选的版本会被替换成允许列表里最新的同族模型并给出提示——"我的模型怎么偷偷变了"先看这层。
3. **Copilot CLI 的 `/settings` 有个 Problems 页**：`settings.json` 解析失败、写了未识别的顶层键（打错字），都记在那里而不是刷屏；`$schema` 被容忍、不上报。

### 各家的文件地图

**Claude Code**：`~/.claude/settings.json`（theme、默认模型、你自己的权限规则）、`.claude/settings.json`（团队权限、hooks、插件、`env`）、`.claude/settings.local.json`（个人覆盖）、`managed-settings.json`（组织策略）；`CLAUDE.md` 是记忆文件而不是设置文件。改完用 `/config` 看是否落到期望层、`/doctor` 校验设置、`/permissions` 列出每条规则来自哪个文件；`--settings` 传的值只作用于当次启动。

**Cursor**：规则写 `.cursor/rules/` 下的 `.mdc`（frontmatter 三件套 `description` / `globs` / `alwaysApply` 决定何时注入；**纯 `.md` 文件会被规则系统忽略**，想要朴素 markdown 就用 `AGENTS.md`）；用户规则在设置界面里；CLI 配置 `~/.cursor/cli-config.json`（Windows `%USERPROFILE%\.cursor\cli-config.json`，`CURSOR_CONFIG_DIR` 与 `XDG_CONFIG_HOME` 可改位置），里面有 `permissions.allow/deny`、`approvalMode`（`allowlist` / `auto-review` / `unrestricted`）、`sandbox.*`、`channel`、`model`、`network.useHttp1ForAgent` 等；**配置损坏时先把它挪走**：

```bash
mv ~/.cursor/cli-config.json ~/.cursor/cli-config.json.bad
```

CLI 会自修复缺失字段、把损坏文件备份为 `.bad` 再重建。项目级 `.cursor/cli.json` 只接受权限项。

**Codex CLI**：`~/.codex/config.toml` 是主文件（`model`、`model_provider`、`model_providers`、`approval_policy`、`sandbox_mode`、`profiles`、`project_root_markers`、`project_doc_fallback_filenames` 等），`CODEX_HOME` 换目录。规范指令走 `AGENTS.md`：从项目根（默认用 `.git` 作为根标记）往下到当前目录**逐级拼接**，用户级 `~/.codex/AGENTS.md` 与项目级之间用固定分隔符拼进上下文，`AGENTS.override.md` 是本地优先的替代文件名，**不会越过项目根往上翻**。仓库规范与技能放在 `.codex/`（`.codex/skills/` 等）。

**Copilot CLI**：`~/.copilot/` 的分工很细，别混着用——

| 文件 | 用途 | 能手改吗 |
| --- | --- | --- |
| `settings.json` | 个人设置主文件（JSONC），含保存的 URL 规则、`proxyUrl`、`autoUpdate`、`includeCoAuthoredBy`、`sandbox.*` | 可以；`/settings` 或 `/config` 是首选，`Ctrl+E` 直接在编辑器里打开它 |
| `config.json` | 应用状态（登录用户列表、已装插件、`trustedFolders`） | 不建议，CLI 自动管理 |
| `permissions-config.json` | 按目录键存的工具/目录批准 | 可以（想重置某项目的批准就删掉对应条目），**但不支持 deny/ask/URL 规则**——那些走命令行旗标 |
| `mcp-config.json` / `lsp-config.json` | 用户级 MCP、LSP 定义 | 可以；项目级 `.mcp.json`、`.github/mcp.json` 同名时覆盖它 |
| `providers.json` | BYOK 供应商与模型注册表（一旦有内容就凌驾于 `COPILOT_PROVIDER_*` 变量之上；`COPILOT_PROVIDERS_CONFIG` 换位置） | 可以 |
| `copilot-instructions.md`、`instructions/*.instructions.md` | 跨仓库的个人指令 | 可以 |
| `skills/`、`hooks/`、`extensions/` | 个人技能、钩子脚本、扩展代码 | 可以；同名时项目级压过个人级 |

项目侧指令的发现位置（四家最全的一家）：`.github/copilot-instructions.md`、`.github/instructions/**/*.instructions.md`（`applyTo` 决定路径作用域）、`AGENTS.md`、`CLAUDE.md`（含 `.claude/CLAUDE.md`）、`GEMINI.md`，外加 `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` 指定的额外目录；`@相对路径` 可以在指令文件里引入其他文件（绝对路径与 `~/` 开头的不会被加载）。用 `/instructions` 看本次会话到底装了哪些文件；**改指令文件对进行中的会话无效**，要 `copilot --continue` 或 `/new` 重开；`copilot init` / `/init` 能为仓库生成初始指令。

### 同一件事，四家的键名

| 你想做的事 | Claude Code | Cursor CLI | Codex CLI | Copilot CLI |
| --- | --- | --- | --- | --- |
| 免批准放行某条命令 | `permissions.allow` 规则（`Bash(npm test *)`） | `permissions.allow`（`Shell(ls)`） | `approval_policy` + execpolicy 规则 | `--allow-tool='shell(npm test)'`，批准结果存 `permissions-config.json` |
| 关掉危险能力 | `permissions.deny` 规则 | `permissions.deny` | `sandbox_mode = "read-only"` | `--deny-tool`、`--available-tools` |
| 联网白名单 | 沙箱代理 + `WebFetch(domain:...)` 规则、`strictAllowList` | `sandbox.networkAccess` | 沙箱的 `network_access` | `--allow-url=DOMAIN` / `--deny-url=DOMAIN` |
| 全放（仅限隔离环境） | `bypassPermissions` 模式 | `approvalMode: "unrestricted"` | `danger-full-access` + `never` | `--allow-all`（别名 `--yolo`）、`/permissions allow-all` |
| 管理员锁死全放 | 托管设置里的权限策略 | 团队设置与治理层 | `requirements.toml` | `permissions.disableBypassPermissionsMode`（`"disable"` 或 `"allow-auto-only"`） |
| 换模型 | `model` / `--model` / `ANTHROPIC_MODEL` | `model` / `/model` | `model` / `-c model=` | `--model` / `COPILOT_MODEL` / `/model` |
| 加 MCP | `claude mcp add`、`.mcp.json` | 编辑器与 CLI 的 MCP 设置 | `[mcp_servers.<id>]` | `mcp-config.json`、`.mcp.json`、`/mcp` |

这些能力的完整语义不在本篇，按上表的键名去对应文章里查：《Claude Code 权限系统与安全机制》《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》《Cursor 深入：Tab 补全、Agent 模式与调试/评审工作流》《MCP 在编码中的应用》。

## 七、如何验证装好了

装完先跑这三层，别急着聊代码。

```bash
# 第 1 层：版本与安装体检
claude --version && claude doctor        # 期望形如 2.1.240 (Claude Code)
agent --version  && agent status          # status 同时告诉你登录账号与 endpoint
codex --version  && codex doctor          # 0.x 版本，行为漂移是常态
copilot version                           # 打印版本并检查是否有更新

# 第 2 层：确认配置读的是哪一份（各家的"自报家门"命令）
# Claude Code：会话内 /status（登录与组织）、/doctor（设置校验）、/permissions（规则来源文件）
# Codex：看 ~/.codex/auth.json 是否生成、config.toml 是否被读到
# Copilot：会话内 /user（当前账号）、/instructions（装进了哪些指令文件）、/settings 的 Problems 页
# Cursor：agent status；规则侧看编辑器 Customize → Rules 的状态

# 第 3 层：一次只读的冒烟测试（不改文件、不联网）
claude -p "List the top-level directories here and stop." --output-format json
agent -p --output-format json "列出当前目录的一级子目录后停止"
codex exec "列出当前目录的一级子目录后停止"
copilot -p "列出当前目录的一级子目录后停止"
```

判据：**版本字符串与第五节的版本门槛对得上、体检命令零报错、只读任务不需要你批准任何写操作**。第三条尤其有用——它把"装好了但每次都要我点确认"和"权限没配好"这两种状态区分开。四款 CLI 都支持非交互模式，CI 里怎么配见《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》。

## 八、报错排查（单列）

### PATH 与"命令找不到"

| 现象 | 处置 |
| --- | --- |
| `command not found: claude` / `'claude' is not recognized...` | 安装目录没进 PATH。加进 PATH 后**开一个新终端**验证——安装时那个会话还拿着旧 PATH。macOS/Linux 原生装法的启动器在 `~/.local/bin/claude` |
| `command not found: agent` | Cursor CLI 装在 `~/.local/bin`，把该目录加进 PATH。若 `cursor` 能用而 `agent` 不能，是两回事（前者来自编辑器） |
| `command not found: codex` / `copilot` | 二进制不在 PATH。Codex 从 GitHub Release 手装时，解压出的文件名带平台后缀，**必须 `mv` 成 `codex`**；Copilot 脚本装法默认装到 `$HOME/.local`（root 时装到 `/usr/local/bin`），可用 `PREFIX=` 换目录 |
| `claude update` 卡在 `Checking for updates`、`claude doctor` 无输出挂死 | 某个 shell 配置文件路径上存在同名目录挡住了；把它挪走 |

### Node 与 npm

| 现象 | 处置 |
| --- | --- |
| `Error: claude native binary not installed` | npm 装法的 postinstall 没跑完（原生二进制是安装脚本下载的）。重装并允许安装脚本执行 |
| `npm error code ENOTEMPTY` | 更新/重装留下残余目录，删掉再装 |
| `running scripts is disabled on this system` / `PSSecurityException` | Windows 执行策略挡住了 npm 的 shim，放行本地脚本 |
| Copilot npm 装完不能用、无报错 | `~/.npmrc` 里有 `ignore-scripts=true`：改用 `npm_config_ignore_scripts=false npm install -g @github/copilot`；并确认 Node.js ≥ 22 |
| 装好但 `TLS connect error` / `unable to get local issuer certificate`，且你用 npm 路线 | npm 装法要读系统证书库需要 **Node 22.15+**；不升级就显式设 `NODE_EXTRA_CA_CERTS` |

### 企业代理与证书

| 现象 | 处置 |
| --- | --- |
| 安装命令吐出 `<!DOCTYPE html>`、`syntax error near unexpected token '<'`，或 `curl: (22) ... 403` | 拿回来的不是脚本而是网页/错误页。多为代理拦截或区域不可用（页面写着 "App unavailable in region" 就是后者）。改用包管理器路线（brew / winget），**下载成文件再执行没用**，存下来的还是那张网页 |
| `curl: (23)` / `curl: (56) Failure writing output to destination` | 管道被切断或写不进管道。先测目标域名可达性，能通就是网络抖动，重试即可 |
| Claude Code 启动即报错、点名某个变量 | 代理 URL 解析失败（常见漏写 `http://`）。补上 scheme |
| Cursor 会话能连、Agent 却超时/极慢 | 典型 SSL 检查/代理缓冲：先用第四节的签发者探针（`issuer:` 那一条）确认是不是代理换了证书，再设 `network.useHttp1ForAgent`、把企业根证书装进系统库（或 `NODE_EXTRA_CA_CERTS`），并对 Cursor 域名关闭 SSL 检查 |
| Copilot CLI 走不通代理 | 在 `~/.copilot/settings.json` 设 `proxyUrl`，或直接导出 `HTTPS_PROXY`（环境变量优先）；Kerberos 代理另设 `proxyKerberosServicePrincipal`；**改完要重启会话** |
| `TLS connect error` / `SSL/TLS secure channel` / 证书链报错 | 更新 CA 证书；企业内网需要装好公司根证书 |
| Linux 上安装显示 `Killed` / `exit code 137` | 内存不足被 OOM killer 杀掉（低配云主机常见）。腾内存或加 swap |

### 钥匙串与凭据

| 现象 | 处置 |
| --- | --- |
| Claude Code 每次都要重新登录 | macOS 钥匙串在 SSH 会话里常被锁：它会回落到 `~/.claude/.credentials.json`（`0600`）。解锁钥匙串后按官方恢复步骤把登录挪回去；`/status` 的 Login 行写着 `Expired — log in again` 就是凭据到期 |
| Copilot CLI 明明 `/login` 过却还是走别的账号 | 环境变量静默压过钥匙串。`unset GH_TOKEN GITHUB_TOKEN` 再试；Codespaces 里自动注入的 `GITHUB_TOKEN` 是唯一例外（不压过 `/login` 的账号） |
| headless Linux 上 Copilot 提示要写明文文件 | 没有 `libsecret`，凭据库不可用 → 落到 `~/.copilot/config.json`。要么装 `libsecret`，要么改用 token 环境变量 |
| Codex 登录卡住（远程机/容器） | `codex login` 的本地回环端口收不到回调：`codex login --device-auth`。Claude Code 同理，按官方"在远程环境登录"手贴 code |
| `OAuth error: Invalid code`、登录后仍 403、"This organization has been disabled" | 前者 `/logout` 后重登；组织被停用是计费侧问题，找管理员 |
| `Could not load the default credentials` / `ChainedTokenCredential authentication failed` | Bedrock / Agent Platform / Foundry 的云凭据没配好（Claude Code 的 provider 路线） |
| Windows 上 `The process cannot access the file ... used by another process` | 下载目录被占用，清理后重试 |
| `Error loading shared library` / `Illegal instruction` / `Exec format error`(WSL1) / `dyld: Symbol not found` | 分别是 musl 与 glibc 二进制装错档、CPU 指令集不匹配、WSL1 跑原生二进制（改用 WSL2）、二进制与当前 macOS 不兼容 |

**统一入口**：Claude Code 的 `claude doctor`（会话内 `/doctor`）会就 PATH、权限、网络、认证四类逐项体检，并附带 settings 文件的校验错误；Codex 的 `codex doctor` 分项覆盖网络、沙箱、Git、磁盘与更新。遇到"文档里有、界面上找不到"的功能，**先查版本门槛再查配置**——绝大多数是版本不够或 `availableModels` 之类的组织限制。

## 九、装完之后：三条团队约定

1. **明确哪些配置提交进仓库**：`.claude/settings.json`、`.cursor/rules/`、`AGENTS.md`、`.github/copilot-instructions.md` 属于团队；`settings.local.json`、`~/.claude/settings.json`、`~/.cursor/cli-config.json`、`~/.codex/config.toml`、`~/.copilot/settings.json` 属于个人。**任何情况下不要把 key 写进提交的文件**——需要轮换凭据就用 `apiKeyHelper` / 环境变量 / `codex login --with-api-key` 的 stdin 路线。
2. **定版本策略**：包管理器装法没有后台自更新（`CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE=1` 可让工具代跑）；Codex 是 0.x、Copilot CLI 一周发几十版，团队要么用 DotSlash / `minimumVersion` 钉死，要么接受周期性行为漂移。
3. **然后去开工**：《第一次 AI 结对：从零做一个命令行小工具》从"起一个会话"讲到"提交一个改动"，与本篇正好衔接。

---

## 十、取源清单

| 归属 | 具体出处（2026-09-19 版） |
| --- | --- |
| Anthropic（Claude Code 官方文档，Copyright Anthropic PBC） | [Setup](https://code.claude.com/docs/en/setup)、[Settings files and precedence](https://code.claude.com/docs/en/settings)、[Model configuration](https://code.claude.com/docs/en/model-config)、[Authentication](https://code.claude.com/docs/en/authentication)、[Enterprise network configuration](https://code.claude.com/docs/en/network-config)、[Troubleshoot installation and login](https://code.claude.com/docs/en/troubleshoot-install) |
| Anysphere（Cursor 官方文档） | [Quickstart](https://cursor.com/docs/get-started/quickstart)、[CLI Installation](https://cursor.com/docs/cli/installation)、[CLI Authentication](https://cursor.com/docs/cli/reference/authentication)、[CLI Configuration](https://cursor.com/docs/cli/reference/configuration)、[Rules](https://cursor.com/docs/rules)、[Network Configuration](https://cursor.com/docs/enterprise/network-configuration)、[Models & Pricing](https://cursor.com/docs/models-and-pricing) |
| OpenAI（openai/codex，Apache-2.0） | 仓库 `README.md`、`docs/install.md`、`docs/config.md`，以及源码 `codex-rs/utils/home-dir/src/lib.rs`（`CODEX_HOME`）、`config/src/lib.rs` 与 `config/src/loader/local.rs`（`config.toml`、层级）、`login/src/auth/storage.rs`（`auth.json`）、`cli/src/login.rs`（`--device-auth`、`--with-api-key`）、`core/src/agents_md.rs`（AGENTS.md 发现规则）、`cli/src/main.rs`（`update`、`doctor`、`--profile`）、`models-manager/models.json`（模型清单）。取源为仓库一手材料，官方开发者文档站的内容未使用 |
| GitHub（GitHub Copilot 官方文档） | [Install Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)、[Authenticate](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)、[Configure](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/configure-copilot-cli)、[Change settings](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/change-settings)、[CLI configuration directory](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference)、[Custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions)、[Plans](https://docs.github.com/en/copilot/get-started/plans)、[Network settings](https://docs.github.com/en/copilot/how-tos/configure-personal-settings/configure-network-settings) |

> 延伸阅读：工具选型与各家能力版图见《AI 编程工具全景对比（2026-09 版）》；装完先跑通第一轮见《第一次 AI 结对：从零做一个命令行小工具》；权限与沙箱的完整语义见《Claude Code 权限系统与安全机制》与《Codex CLI 深度使用：OpenAI 终端智能体的三层权限、AGENTS.md 与自动化》；规则与规范文件的写法见《Cursor 入门与 Rules 规则系统》与《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》。

> **来源**：抓取于 2026-09-19。本文逐节编译并翻译自上面「取源清单」列出的四家官方一手材料——Claude Code 与 Cursor、GitHub Copilot 的官方文档，以及 Apache-2.0 许可的 [openai/codex](https://github.com/openai/codex) 仓库（README、docs 与 `codex-rs` 源码）。作者为各原厂官方文档，许可为署名翻译：官方文档版权归原厂所有，本站仅作教学用途翻译并逐节标注出处；未收录内容（各家文档中的长尾小节、CI 与团队治理细节）见原文。「四件套速查矩阵」「同一件事，四家的键名」「配置目录开关」三张对照表、第九节三条团队约定与各处「编者注」为本站编者归纳，已标明。订阅价格与模型清单未在此重复，统一收录于《AI 编程工具全景对比（2026-09 版）》。
