---
title: Claude Code 权限系统与安全机制
source_url: https://code.claude.com/docs/en/permissions
author: Anthropic（Claude Code 官方文档 Permissions / Permission modes / Sandboxing）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 7
group: Claude Code
---
《Claude Code 工作流与最佳实践》里反复出现一句话："给 Claude 可运行的验证手段，但守住闸门"。闸门就是本篇的主角。《心智模型：LLM 如何"看"你的代码》建立的那套认知告诉我们：Claude 能读你的终端、跑任意命令——那么"它被允许做什么"就必须是一个工程化系统而不是一句口头约定。本篇主体翻译官方《Configure permissions》，并译出《Choose a permission mode》与《Configure the sandboxed Bash tool》的核心章节：**规则 → 模式 → 沙箱**三层，从"问你什么"到"根本做不了"。

## 一、权限系统与三类规则（译自官方 Permissions 页）

Claude Code 用分层权限系统平衡能力与安全：你可以精确规定智能体被允许做什么、不允许做什么。权限设置可以提交进版本控制，与团队每个开发者共享；每个人也可以有自己的自定义。

### Allow / Ask / Deny

用 `/permissions` 查看与管理全部工具权限，弹窗会列出每条规则及其来源的 `settings.json` 文件（Claude 工作时也能打开：增删规则从同一轮的下一次工具调用起生效）。

- **Allow** 规则：无需人工批准即可使用指定工具
- **Ask** 规则：每次尝试使用指定工具都请求确认
- **Deny** 规则：禁止使用指定工具

规则按 **deny → ask → allow** 的顺序求值，第一个匹配决定结果——规则的"更具体"不改变这个顺序。一条宽泛的 deny（如 `Bash(aws *)`）会拦截所有匹配调用，即便同时命中更窄的 allow（如 `Bash(aws s3 ls)`）——**deny 规则不能被 allowlist 打洞**。

裸工具名的 deny（如 `Bash`）会把该工具从 Claude 的上下文中整个移除，Claude 从此"看不见"它；而带限定符的 deny（如 `Bash(rm *)`)保留工具、只拦特定调用。

> 官方特别强调：**权限规则由 Claude Code 强制执行，而不是由模型执行**。提示词或 CLAUDE.md 里的"请不要做 X"只是影响 Claude 尝试什么，不改变 Claude Code 允许什么。要真正授予或收回访问，用 `/permissions`、规则、权限模式或 PreToolUse hook。

### 规则语法

格式为 `Tool` 或 `Tool(specifier)`：

| 规则 | 效果 |
| --- | --- |
| `Bash` | 匹配所有 Bash 命令（deny 时整个移除该工具） |
| `Bash(npm run build)` | 匹配精确命令 |
| `Read(./.env)` | 匹配读取当前目录的 .env |
| `WebFetch(domain:example.com)` | 匹配对 example.com 的抓取 |

Bash 规则匹配整条命令文本、`*` 通配任意文本。几个值得知道的工程细节：

- **复合命令逐段审查**：Claude Code 认识 shell 操作符（`&&`、`||`、`;`、`|` 等），`Bash(safe-cmd *)` 不会放行 `safe-cmd && other-cmd`——每段子命令必须独立匹配。deny/ask 规则对子 shell、命令替换、循环体内的嵌套命令同样生效。
- **包装器剥离**：匹配前会剥掉 `timeout`、`time`、`nice`、`nohup` 等固定包装器，`Bash(npm test *)` 也能匹配 `timeout 30 npm test`；但 `npx`、`docker exec`、`devbox run` 这类"环境执行器"**不在**剥离列表——`Bash(devbox run *)` 等于放行 `devbox run rm -rf .`，必须写成含内层命令的具体规则。
- **"是，且不再问"的落库方式**：批准 `git status && npm test` 时，保存的是 `npm test` 的独立规则而非整串，单条复合命令最多沉淀 5 条规则。

### 工作目录

默认 Claude 只能访问启动目录。扩展方式：启动时 `--add-dir <path>`、会话中 `/add-dir`、或写进设置文件的 `additionalDirectories`。附加目录中的文件遵循与主目录相同的权限规则。另有 `permissions.blockReadsOutsideWorkingDirectories` 让文件工具在所有模式下都拒绝工作目录之外的读取。用 `/cd <path>` 可整体迁移会话（保留对话、加载新目录的 CLAUDE.md 并提示信任工作区）。

## 二、权限模式：六档油门（译自官方 Permission modes 页）

每种模式在"省事"与"可控"之间做不同取舍——表格展示各模式下不经询问即可执行的动作：

| 模式 | 不问就执行 | 适合 |
| --- | --- | --- |
| `default`（CLI 中叫 **Manual**） | 只读 | 敏感工作、亲自审查每个动作 |
| `acceptEdits` | 读、文件编辑、常见文件系统命令（mkdir/touch/mv/cp） | 迭代你正在审查的代码 |
| `plan` | 读（auto 可用时加上分类器批准的命令） | 动手前探索代码库 |
| `auto` | 一切，但带后台安全检查 | 长任务、减少批准疲劳 |
| `dontAsk` | 读 + 预批准的工具；其余一律拒绝 | 锁死的 CI 与脚本 |
| `bypassPermissions` | 一切 | 仅限隔离的容器/VM |

会话内 `Shift+Tab` 循环切换；设置文件里 `defaultMode` 决定起始档位。几个硬边界值得记住：

- **保护路径（protected paths）**：`.git`、`.claude` 等路径的写入在任何模式下都不会自动批准（`bypassPermissions` 除外）。
- **任何模式都不自动批准的动作**：显式 ask 规则命中的工具、需要用户交互的工具（如 `AskUserQuestion`）、针对关键路径的 `rm`/`rmdir`、以及跨会话消息防护等。
- **deny 规则在一切模式下生效**，包括 `bypassPermissions`——这是把"最后一道闸"写进规则而不是靠模式的理由。

### Auto 模式：分类器替你审查

auto 模式（2026 年起为 Pro/Max/Team 计划交互会话的默认起始模式）用一个后台分类器审查动作是否符合你的请求。分类器**默认拦截**的类别包括：

- 下载并执行代码（`curl | bash`）、向外部端点发送敏感数据
- 生产部署与迁移、云存储批量删除、授予 IAM 或仓库权限、修改共享基础设施
- 不可逆地销毁会话开始前就存在的文件、force push
- 提交/推送会把密钥或敏感数据带出仓库的改动（任何分支、公开仓库同样生效）
- `git reset --hard`、`git clean -fd`、`git stash drop` 等可能丢弃未提交改动的命令
- `terraform destroy` / `pulumi destroy` 等基础设施销毁
- 合并没有人类批准的 PR、批准 Claude 自己的 PR、禁用 CI 检查

分类器信任的边界是"会话启动时配置的远程仓库"——会话中途 `git remote add` 添加的 remote 不受信任。企业还可以通过 auto-mode 配置声明受信的基础设施。

## 三、沙箱：OS 级的物理边界（译自官方 Sandboxing 页）

权限规则回答"允许不允许"，沙箱回答"就算允许了、进程也做不了"。两者是互补的两层：

- **权限规则**管所有工具（Bash/Read/Edit/WebFetch/MCP……），在工具运行**之前**求值
- **沙箱**是操作系统层面的强制隔离，只作用于 Bash 命令及其子进程——它不依赖模型的"选择"，即使被放行的命令干了名字之外的事，边界依然成立

### 文件系统隔离

- **默认可写**：当前工作目录及子目录、`--add-dir`/`additionalDirectories` 添加的目录、会话临时目录
- **默认可读**：整台计算机（注意：这仍包括 `~/.aws/credentials`、`~/.ssh/` 等凭据文件——需用 `sandbox.credentials` 或 `denyRead` 显式堵上）
- **禁止改动**：工作目录之外的一切，包括 `~/.bashrc` 与 `/bin/` 下的系统二进制

沙箱还有一份自己的**保护路径**清单（比权限系统的更细）：`.claude` 设置文件、`.mcp.json`、shell 启动文件、`.gitconfig`、`~/.claude` 大部分内容……逻辑很直白——**一个能改 Claude Code 配置的命令可以给自己授予权限**，所以这些路径在任何沙箱配置下都不可豁免（唯一的关法是整体关闭文件系统隔离）。

### 网络隔离

沙箱内的网络访问经一个跑在沙箱外的代理控制：默认**不预放行任何域名**——命令第一次访问新域名会请求批准（auto 模式则交给分类器），选"Yes"本会话内放行该主机，选"Yes, and don't ask again"则落成一条 `WebFetch(domain:...)` allow 规则持久生效。CI 类场景可用 `strictAllowlist` 设为严格白名单：名单外一律拒绝、不再提示。限制覆盖命令派生的一切脚本、程序与子进程。

## 四、把三层装进脑子（本站编者小结）

用一句话串起本篇：**规则管"问不问"，模式管"默认怎么问"，沙箱管"问了也做不到"**。对照《Claude Code 工作流与最佳实践》里的用法：

- 交互开发：`acceptEdits`（或 auto）+ 少量 allow 规则（`npm test`、`git status`）+ deny 掉 `.env` 读取
- 无人值守脚本：`dontAsk` + 显式 allowlist + 沙箱 + 严格域名白名单——《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》 Headless/CI 会原样复用这个配方
- 永远保留：对保护路径与关键路径的 deny——它们是唯一连 `bypassPermissions` 都拦得住（前者）或最难误开（后者）的闸门

---

> 延伸阅读：Claude Code 的纵深到此完成，把镜头转向另一极——《Cursor 入门与 Rules 规则系统》回到编辑器形态，讲另一条"让 AI 守规矩"的路径；想把规矩变成绕不过的闸门，见《Claude Code Hooks：用确定性脚本守住智能体循环》。

> **来源**：本文主体翻译自 [Configure permissions](https://code.claude.com/docs/en/permissions)，"权限模式"与"沙箱"两节分别译自 [Choose a permission mode](https://code.claude.com/docs/en/permission-modes) 与 [Configure the sandboxed Bash tool](https://code.claude.com/docs/en/sandboxing)（均为 Claude Code 官方文档，2026-09 当前版），作者 Anthropic，许可署名翻译（Copyright Anthropic PBC，教学用途）。文末"把三层装进脑子"为本站编者小结并已标明；长尾小节（各工具细项规则、企业托管配置、故障排查等）从略，见原文。抓取于 2026-09-13。
