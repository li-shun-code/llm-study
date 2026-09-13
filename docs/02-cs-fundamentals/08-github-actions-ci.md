---
title: GitHub Actions 与 CI 基础
source_url: https://docs.github.com/en/actions/get-started/understanding-github-actions
author: GitHub Docs（Understanding GitHub Actions、Workflow syntax for GitHub Actions）
license: CC BY 4.0
fetched_at: 2026-09-13
translated: true
order: 8
---

前面的 Git 分支与协作流程解决的是"代码怎么合"，这一篇讲"合进去之前怎么自动验证、之后怎么自动部署"——也就是持续集成/持续交付（CI/CD）。本文翻译 GitHub Actions 官方文档的核心内容：先讲概念，再讲工作流 YAML 的必备语法。

## 认识 GitHub Actions（Understanding GitHub Actions）

### 概述

GitHub Actions 是一个持续集成与持续交付（CI/CD）平台，让你把构建、测试、部署流水线自动化。你可以创建工作流（workflow），对仓库里的每个 pull request 进行构建和测试，或者把已合并的 pull request 部署到生产环境。

GitHub Actions 的能力不止于 DevOps：仓库里发生其他事件时也能运行工作流。例如，每当有人在仓库里创建新 issue，就运行一个工作流自动打上合适的标签。

GitHub 提供 Linux、Windows 和 macOS 虚拟机来运行你的工作流；你也可以在自己的数据中心或云基础设施里托管自托管（self-hosted）runner。

### GitHub Actions 的组件

你可以把 GitHub Actions 工作流配置成"仓库里发生某个事件时触发"，例如有 pull request 被打开或 issue 被创建。工作流包含一个或多个作业（job），作业可以按顺序执行，也可以并行执行。每个作业运行在自己的虚拟机 runner 里，或运行在某个容器中，并包含一个或多个步骤（step）——步骤要么运行你定义的脚本，要么运行一个动作（action，即可复用的扩展，能简化你的工作流）。

#### 工作流（Workflow）

工作流是一个可配置的自动化过程，会运行一个或多个作业。工作流由提交到仓库的 YAML 文件定义，在仓库事件触发时运行，也可以手动触发或按定义好的时间计划触发。

工作流定义在仓库的 `.github/workflows` 目录下。一个仓库可以有多个工作流，各自执行不同的一组任务，比如：

- 构建并测试 pull request
- 每次创建 release 时部署你的应用
- 有新 issue 被打开时打标签

你可以在一个工作流中引用另一个工作流（复用工作流）。

#### 事件（Event）

事件是仓库中触发工作流运行的特定活动。例如，活动可以来自 GitHub——有人创建了 pull request、打开了 issue、或者向仓库推送了提交。你也可以按计划、通过向 REST API 发请求、或手动触发工作流运行。

#### 作业（Job）

作业是工作流中在同一 runner 上执行的一组步骤。每个步骤要么是将被执行的 shell 脚本，要么是将被运行的动作。步骤按顺序执行且相互依赖。由于每个步骤都在同一 runner 上执行，步骤之间可以共享数据——例如，先有一个构建应用的步骤，再有一个测试刚构建出的应用的步骤。

步骤默认按顺序运行；但当并行执行对你有利时，也可以让选定的步骤并发运行，比如在后续步骤继续的同时启动一个长期运行的服务（详见 Workflow syntax for GitHub Actions）。

你可以配置作业之间的依赖关系；默认情况下，作业之间没有依赖、并行运行。当一个作业依赖另一个作业时，它会等待被依赖的作业完成后才运行。

你还可以用矩阵（matrix）把同一个作业运行多次，每次使用不同的变量组合——比如不同的操作系统或语言版本。

例如，你可以为不同架构配置多个构建作业（彼此无依赖），再配一个依赖于这些构建的打包作业。构建作业并行运行，全部成功完成后，打包作业才运行。

#### 动作（Action）

动作是预定义的、可复用的作业集或代码，在工作流中执行特定任务，减少你在工作流文件里写的重复代码。动作可以执行诸如：

- 从 GitHub 拉取你的 Git 仓库
- 为构建环境装好正确的工具链
- 设置面向你的云提供商的身份验证

你可以自己编写动作，也可以在 GitHub Marketplace 里找到可用的动作。

#### Runner（执行器）

runner 是在工作流被触发时运行工作流的服务器。每个 runner 一次只能运行一个作业。GitHub 提供 Ubuntu Linux、Microsoft Windows 和 macOS runner；每次工作流运行都在一台全新的、刚供给（provisioned）的虚拟机中执行。GitHub 还提供更大配置的 larger runner。如果你需要不同的操作系统或特定的硬件配置，可以托管自己的 runner（自托管 runner）。

### 下一步

GitHub Actions 几乎可以自动化应用开发过程的每个环节。上手资源：

- 创建工作流：使用工作流模板（workflow templates）。
- 持续集成（CI）工作流：构建并测试你的代码。
- 构建并发布包：发布包（publishing packages）。
- 部署项目：部署到第三方平台。
- 自动化 GitHub 上的任务与流程：用 GitHub Actions 管理你的工作。
- 展示更复杂特性的示例：Choosing what your workflow does——如何测试代码、访问 GitHub CLI、使用并发与测试矩阵等高级特性。

> 注：需要结合仓库内容做上下文判断的自动化，还可以用自然语言编写 agentic workflow 来替代传统工作流。

## 工作流必备语法（Essential workflow syntax）

以下翻译自 GitHub 官方文档《Workflow syntax for GitHub Actions》的核心条目（完整参考页远比此处详尽，这里保留日常必需的骨架）。

### 工作流的 YAML 语法

工作流文件使用 YAML 语法，扩展名必须是 `.yml` 或 `.yaml`。工作流文件必须存放在仓库的 `.github/workflows` 目录中。

### `name`

工作流的名称。GitHub 在仓库的 "Actions" 标签页下显示工作流名称。省略 `name` 时，GitHub 显示工作流文件相对于仓库根目录的路径。

### `run-name`

由该工作流产生的各次工作流运行的名称。GitHub 在仓库 "Actions" 标签页的运行列表中显示运行名。省略 `run-name` 或只含空白时，运行名被设为该次运行的事件特定信息——例如由 `push` 或 `pull_request` 事件触发时，设为提交消息或 pull request 标题。该值可以包含表达式，可以引用 `github` 与 `inputs` 上下文：

```yaml
run-name: Deploy to ${{ inputs.deploy_target }} by @${{ github.actor }}
```

### `on`

要自动触发工作流，用 `on` 定义哪些事件能让工作流运行。

单个事件——比如任意分支有推送就运行：

```yaml
on: push
```

多个事件——指定多个事件时，其中任意一个发生即触发；若多个触发事件同时发生，会触发多次运行：

```yaml
on: [push, fork]
```

活动类型（activity types）——有些事件带有活动类型，让你更精细地控制何时运行。用 `on.<event_name>.types` 定义触发运行的活动类型。例如 `issue_comment` 事件有 created、edited、deleted 三种活动类型；如果只指定 created，那么创建标签时运行、编辑或删除时不运行：

```yaml
on:
  label:
    types:
      - created
```

指定多个活动类型时，任意一种发生即触发；多个类型同时发生会触发多次运行。例如下面这样配置 `issues: [opened, labeled]` 时，若某 issue 带两个标签被打开，会启动三次工作流运行：一次对应 issue opened，两次对应两个 issue labeled。

过滤器（filters）——某些事件有过滤器。例如 `push` 事件有 `branches` 过滤器，工作流只在推送到匹配分支时运行：

```yaml
on:
  push:
    branches:
      - main
      - 'releases/**'
```

为某个事件指定了活动类型或过滤器、而工作流又由多个事件触发时，必须分别配置每个事件——包括无配置的事件在内都要加冒号。例如下面的 `on` 值将在以下情况运行：创建标签；推送到 main 分支；推送到启用了 GitHub Pages 的分支：

```yaml
on:
  label:
    types:
      - created
  push:
    branches:
      - main
  page_build:
```

`on.<event_name>.types`——大多数 GitHub 事件由不止一种活动触发（例如 label 在标签被创建、编辑、删除时都会触发），`types` 关键字让你收窄触发工作流的活动。只有一种活动类型的事件无需此关键字：

```yaml
on:
  label:
    types: [created, edited]
```

### `on.schedule`

用 `on.schedule` 为工作流定义时间计划，使用 POSIX cron 语法。默认按 UTC 运行，也可以用 IANA 时区字符串指定时区。计划工作流运行于默认分支的最新提交，最短间隔为每 5 分钟一次。cron 有五个以空格分隔的字段：

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of the month (1 - 31)
│ │ │ ┌───────────── month (1 - 12 or JAN-DEC)
│ │ │ │ ┌───────────── day of the week (0 - 6 or SUN-SAT)
│ │ │ │ │
* * * * *
```

五个字段可用的操作符：

| 操作符 | 含义 | 示例 |
|---|---|---|
| `*` | 任意值 | `15 * * * *` 每天的每小时的第 15 分钟运行 |
| `,` | 值列表分隔符 | `2,10 4,5 * * *` 每天第 4、5 小时的第 2 和 10 分钟运行 |
| `-` | 值范围 | `30 4-6 * * *` 第 4、5、6 小时的第 30 分钟运行 |
| `/` | 步进值 | `20/15 * * * *` 从第 20 分钟到第 59 分钟每 15 分钟运行（20、35、50 分） |

例：每周一到周五在 America/New_York 时区早上 5:30 触发：

```yaml
on:
  schedule:
    - cron: '30 5 * * 1-5'
      timezone: "America/New_York"
```

一个工作流可以由多个 schedule 事件触发；通过 `github.event.schedule` 上下文访问触发本次运行的那条计划。

### `on.workflow_dispatch`

使用 `workflow_dispatch` 事件可以手动触发工作流，并可选地传入 inputs。触发的工作流在 `inputs` 上下文中接收输入（也会出现在 `github.event.inputs` 中——区别是 `inputs` 上下文保留布尔值的布尔类型，而 `github.event.inputs` 把它转成字符串；choice 类型解析为单一可选的字符串）。inputs 顶层属性最多 25 个，最大载荷 65,535 字符。输入类型可为 `boolean`、`choice`、`number`、`environment` 或 `string`。注意：此触发只在默认分支上的工作流文件上才接收事件。

### `permissions`

用 `permissions` 修改授予 `GITHUB_TOKEN` 的默认权限，按需增删访问权，只保留最小必需访问。`permissions` 可以作为顶层键（作用于工作流的所有作业），也可以放在特定作业内——此时该作业内所有使用 GITHUB_TOKEN 的动作和 run 命令获得你指定的访问权。组织所有者可以在仓库层面限制 GITHUB_TOKEN 的写访问。当工作流由 `pull_request_target` 事件触发时，即使是来自公开 fork 的触发，GITHUB_TOKEN 也会被授予读/写仓库权限。

### `env`

`env` 是一个变量映射，对工作流中所有作业的所有步骤可用。也可以只为单个作业的步骤或单个步骤设置变量。env 映射中的变量不能用同一映射中的其他变量来定义。同名变量定义多个时，GitHub 采用最具体的那个：步骤级定义在步骤执行期间覆盖作业级与工作流级，作业级定义在作业执行期间覆盖工作流级。

```yaml
env:
  SERVER: production
```

### `defaults` 与 `defaults.run`

`defaults` 创建一份默认设置映射，作用于工作流的所有作业（也可只作用于单个作业）。`defaults.run` 为工作流中所有 `run` 步骤提供默认的 `shell` 与 `working-directory` 选项。此关键字不能用上下文或表达式。同名默认设置取最具体者（作业级覆盖工作流级）：

```yaml
defaults:
  run:
    shell: bash
    working-directory: ./scripts
```

`shell` 定义步骤使用的 shell。各平台支持：Linux/macOS 上不指定时用默认 shell（等价于找不到 bash 时的 `sh -e {0}`；显式 `bash` 则是 `bash --noprofile --norc -eo pipefail {0}`，注意二者行为不同）；全平台可用 `bash`、`pwsh`（PowerShell Core）、`python`；Linux/macOS 可用 `sh`；Windows 可用 `cmd`、`pwsh`（Windows 默认，没有 PowerShell Core 时退回 PowerShell Desktop）、`powershell`（PowerShell Desktop）。`working-directory` 定义步骤 shell 的工作目录——先确保该目录在 runner 上存在再在其中运行 shell。

### `concurrency`

`concurrency` 确保使用同一并发组（concurrency group）的作业或工作流同一时间只有一个在运行。并发组可以是任意字符串或表达式（表达式只能用 `github`、`inputs`、`vars` 上下文）。并发组也可以在作业级指定。

同一并发组中任意时刻至多有一个正在运行的作业或工作流。并发作业或工作流入队时，若仓库中同组已有在跑的，入队者进入 pending；默认情况下，同组任何已 pending 的会被取消、由新入队者顶替。要连正在运行的也取消，指定 `cancel-in-progress: true`；也可以把 `cancel-in-progress` 写成表达式做条件取消。

要允许同组多个 pending 排队等待，用可选的 `queue` 属性：`single`（默认）——至多一个 pending，新排队者顶替旧 pending；`max`——最多 100 个 pending，队满后新来者被取消。`queue: max` 与 `cancel-in-progress: true` 不允许组合，否则工作流校验报错。

注意：并发组名不区分大小写（`prod` 与 `Prod` 同组）；同组的作业/运行按"开始等待并发组的时间"以先进先出（FIFO）顺序处理——不是按工作流被派发的时间，而实际开始时间可能波动，因此顺序并无保证。

例：用并发限制某分支的整条工作流运行：

```yaml
on:
  push:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### `jobs`

一次工作流运行由一个或多个作业组成，作业默认并行运行。要让作业按顺序运行，用 `jobs.<job_id>.needs` 定义对其他作业的依赖。每个作业运行在 `runs-on` 指定的 runner 环境中。只要不超出工作流用量限制，作业数量不限。

### `jobs.<job_id>`

用 `jobs.<job_id>` 给作业一个唯一标识。`job_id` 是字符串，其值是该作业配置数据的映射。`job_id` 必须以字母或 `_` 开头，只能含字母数字、`-` 或 `_`：

```yaml
jobs:
  my_first_job:
    name: My first job
  my_second_job:
    name: My second job
```

`jobs.<job_id>.name` 设置作业在 GitHub 界面上显示的名称。`jobs.<job_id>.permissions` 针对单个作业修改 GITHUB_TOKEN 的默认权限（最小必需访问）。

### `jobs.<job_id>.needs`

`needs` 标识必须成功完成、本作业才会运行的作业。可以是字符串或字符串数组。如果一个作业失败或被跳过，依赖它的所有作业都会被跳过——除非这些作业使用了让它继续的条件表达式。如果一次运行包含一串相互依赖的作业，失败或跳过会沿依赖链向后传播。想让作业在依赖未成功时也运行，在 `jobs.<job_id>.if` 里用 `always()` 条件表达式：

```yaml
jobs:
  job1:
  job2:
    needs: job1
  job3:
    needs: [job1, job2]
```

上例中 job1 成功完成后 job2 才开始，job3 等 job1、job2 都完成，运行顺序为 job1 → job2 → job3。若给 job3 的 if 写上 `always()` 条件表达式，则无论 job1、job2 成败，它们完成后 job3 总会运行。

### `jobs.<job_id>.if`

`if` 条件用于"条件不满足就不运行该作业"。可以用任何受支持的上下文和表达式。注意：`if` 条件在 `strategy.matrix` 应用**之前**求值。在 `if` 中使用表达式时可以省略两对花括号的表达式定界符（GitHub Actions 自动把 if 条件当表达式求值），但表达式以 `!` 开头时必须用定界符包裹、或用 `''`、`""`、`()` 转义——`!` 是 YAML 的保留记号：

```yaml
if: ${{ ! startsWith(github.ref, 'refs/tags/') }}
```

例：production-deploy 作业只在仓库名为 octo-repo-prod 且属于 octo-org 组织时运行，否则标记为 skipped。

### `jobs.<job_id>.runs-on`

定义作业运行在什么机器上。目标机器可以是 GitHub 托管 runner、larger runner 或自托管 runner；可以按标签、按组或二者组合来选。`runs-on` 可以是单个字符串、含字符串的变量、字符串/变量数组、或用 `group`/`labels` 键的键值对。指定数组时，作业运行在匹配**所有**指定值的 runner 上：

```yaml
runs-on: [self-hosted, linux, x64, gpu]
```

数组里可以混用字符串与变量：

```yaml
jobs:
  test:
    runs-on: [self-hosted, "${{ inputs.chosen-os }}"]
    steps:
    - run: echo Hello world!
```

简单字符串（如 self-hosted）不必加引号；表达式值（如以表达式引用 `inputs.chosen-os` 时）必须加引号。想在多台机器上运行工作流，用 `jobs.<job_id>.strategy`。使用 GitHub 托管 runner 时，每个作业都在 `runs-on` 指定的 runner 镜像的全新实例中运行；标准 GitHub 托管 runner 的标签例如 `ubuntu-latest`（Linux，4 核 CPU / 16 GB 内存 / 14 GB SSD，x64）、`windows-latest` 等；公开仓库使用标准 GitHub 托管 runner 免费且不限量。

### `jobs.<job_id>.outputs`

为作业创建输出映射。作业输出对所有依赖该作业的下游作业可用（配合 `needs` 上下文使用）。每个作业的输出上限 1 MB，一次工作流运行所有输出总计上限 50 MB（按 UTF-16 编码估算）。含表达式的输出在该作业结束时于 runner 上求值；含密钥（secrets）的输出会在 runner 上被遮蔽（redact）、不发送给 GitHub Actions——若某个输出因可能含密钥而被跳过，你会看到警告 "Skip output {output.Key} since it may contain secret."。

### `jobs.<job_id>.env` 与 `jobs.<job_id>.defaults`

`env` 设置对作业内所有步骤可用的变量映射（工作流级、作业级、步骤级均可设，同名取最具体者）。`defaults.run` 为该作业的 run 步骤设置默认 shell 与工作目录，可被步骤级覆盖。

### `jobs.<job_id>.steps`

作业包含一串称为步骤（step）的任务。步骤可以运行命令、运行安装任务，或运行动作——动作可以在本仓库、公开仓库或已发布的 Docker 镜像中定义。不是所有步骤都运行动作，但所有动作都作为步骤运行。每个步骤在 runner 环境中以自己的进程运行，可以访问工作区（workspace）与文件系统；正因为各步骤是独立进程，环境变量的修改不会在步骤之间保留。GitHub 只显示前 1000 条检查，但只要不超用量限制，步骤数量不限。

```yaml
name: Greeting from Mona

on: push

jobs:
  my-job:
    name: My Job
    runs-on: ubuntu-latest
    steps:
      - name: Print a greeting
        env:
          MY_VAR: Hi there! My name is
          FIRST_NAME: Mona
          MIDDLE_NAME: The
          LAST_NAME: Octocat
        run: |
          echo $MY_VAR $FIRST_NAME $MIDDLE_NAME $LAST_NAME.
```

#### `jobs.<job_id>.steps[*].id`

步骤的唯一标识。可以用 id 在上下文中引用该步骤。

#### `jobs.<job_id>.steps[*].if`

条件不满足就不运行该步骤，可用任何受支持的上下文与表达式（表达式定界符可省略、`!` 开头需转义，同上）。例：仅当事件类型为 pull_request 且事件动作为 unassigned 时运行：

```yaml
steps:
  - name: My first step
    if: ${{ github.event_name == 'pull_request' && github.event.action == 'unassigned' }}
    run: echo This event is a pull request that had an assignee removed.
```

状态检查函数示例：`my backup step` 只在作业的前一个步骤失败时运行：

```yaml
steps:
  - name: My first step
    uses: octo-org/action-name@main
  - name: My backup step
    if: ${{ failure() }}
    uses: actions/heroku@1.0.0
```

关于 secrets 的示例：`if:` 条件里不能直接引用 secrets。应当把 secret 设为作业级环境变量，再引用环境变量做条件判断。未设置的 secret 引用表达式返回空字符串：

```yaml
name: Run a step if a secret has been set
on: push
jobs:
  my-jobname:
    runs-on: ubuntu-latest
    env:
      super_secret: ${{ secrets.SuperSecret }}
    steps:
      - if: ${{ env.super_secret != '' }}
        run: echo 'This step will only run if the secret has a value set.'
      - if: ${{ env.super_secret == '' }}
        run: echo 'This step will only run if the secret does not have a value set.'
```

#### `jobs.<job_id>.steps[*].name`

步骤在 GitHub 上显示的名称。

#### `jobs.<job_id>.steps[*].uses`

选择一个动作作为步骤运行。动作是可复用的代码单元，可以来自工作流所在仓库、公开仓库或已发布的 Docker 容器镜像。

强烈建议用 Git ref、SHA 或 Docker 标签指定所用动作的版本。不指定版本的话，动作作者发布更新时可能弄坏你的工作流或引发意外行为：

- 使用已发布动作版本的提交 SHA，对稳定性与安全性而言最保险。
- 若动作发布主版本标签（major version tags），你应能收到关键修复与安全补丁、同时保持兼容——此行为取决于动作作者。
- 使用动作的默认分支方便，但若有人发布了带破坏性变更的新主版本，你的工作流可能坏掉。

有些动作需要输入参数，必须用 `with` 关键字设置（先读该动作的 README）。动作要么是 JavaScript 文件，要么是 Docker 容器；Docker 容器动作必须在 Linux 环境中运行该作业。

#### `jobs.<job_id>.steps[*].run`

用操作系统的 shell 运行不超过 21,000 字符的命令行程序。不提供 name 时，步骤名默认为 run 命令的文本。命令默认用非登录 shell 运行，可选其他 shell（见 `shell`）。每个 `run` 关键字代表 runner 环境中的一个新进程和新 shell；多行命令在同一 shell 里逐行执行：

```yaml
- name: Install Dependencies
  run: npm install
```

`working-directory` 指定运行命令的工作目录。`shell` 覆盖默认 shell（可用值见 defaults.run.shell 表：bash、pwsh、python、sh、cmd、powershell 等）。

#### `jobs.<job_id>.steps[*].with`

动作定义的输入参数映射，每个输入是键/值对。输入参数会被设为环境变量：加前缀 `INPUT_` 并转为大写。Docker 容器动作的输入必须用 `args`：

```yaml
jobs:
  my_first_job:
    steps:
      - name: My first step
        uses: actions/hello_world@main
        with:
          first_name: Mona
          middle_name: The
          last_name: Octocat
```

上例定义了 hello_world 动作的三个输入，该动作以 `INPUT_FIRST_NAME`、`INPUT_MIDDLE_NAME`、`INPUT_LAST_NAME` 环境变量访问它们。`with.args` 是定义 Docker 容器输入的字符串——GitHub 在容器启动时把 args 传给容器的 ENTRYPOINT；不支持字符串数组；含空格的单个参数应当用双引号包围。

#### `jobs.<job_id>.steps[*].env` / `.continue-on-error` / `.timeout-minutes`

`env` 为该步骤设置环境变量。`continue-on-error` 为 true 时，该步骤失败也不让作业失败。`timeout-minutes` 是该步骤运行的最大分钟数，超时自动取消。

### `jobs.<job_id>.timeout-minutes`

作业在 GitHub 自动取消之前可以运行的最大分钟数。默认：360。若超时超过 runner 的作业执行时长上限，作业会在执行时长上限处被取消。注意：GITHUB_TOKEN 在作业结束时、或最长 24 小时后过期——自托管 runner 上如果作业超时大于 24 小时，限制因素可能是这个 token。

### `jobs.<job_id>.strategy`

用矩阵策略（matrix strategy）让一个作业定义自动生成多个运行，基于变量的组合。例如在多个语言版本或多个操作系统上测试代码。

`jobs.<job_id>.strategy.matrix` 定义不同作业配置的矩阵。一次工作流运行最多生成 256 个作业（GitHub 托管与自托管 runner 同限）。矩阵中定义的变量成为 matrix 上下文的属性，可在工作流文件其他位置引用（如 `matrix.version`、`matrix.os`）。默认情况下 GitHub 视 runner 可用性尽量并行运行作业；矩阵中变量的顺序决定作业创建的顺序——你定义的第一个变量最先创建作业。

单维矩阵——version 取 `[10, 12, 14]`，将运行三个作业，各自通过 `matrix.version` 访问取值并传给 actions/setup-node：

```yaml
jobs:
  example_matrix:
    strategy:
      matrix:
        version: [10, 12, 14]
    steps:
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.version }}
```

多维矩阵——指定多个变量，每个可能组合运行一个作业。例如两个操作系统 × 三个 Node.js 版本，共六个作业：

```yaml
jobs:
  example_matrix:
    strategy:
      matrix:
        os: [ubuntu-22.04, ubuntu-24.04]
        version: [10, 12, 14]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ matrix.version }}
```

矩阵的变量配置也可以是对象数组，例如 `node: [{version: 14}, {version: 20, env: NODE_OPTIONS=--openssl-legacy-provider}]` 会与 os 组合出各自独立的作业。

`strategy.matrix.include`——include 列表中的每个对象：若其键值对不覆盖任何原矩阵值，就加进每个矩阵组合；若无法加进任何组合，则创建一个新的矩阵组合。原矩阵值不会被覆盖，但后加的值可以再被覆盖。例如 include 可以在 windows-latest + node 16 的那个作业里额外注入 `npm: 6`；只写 include、不写其他矩阵变量时，则只按 include 的组合生成作业：

```yaml
jobs:
  includes_only:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - site: "production"
            datacenter: "site-a"
          - site: "staging"
            datacenter: "site-b"
```

`strategy.matrix.exclude`——被排除的配置只需部分匹配即被排除。所有 include 组合在 exclude **之后**处理，因此可以先用 exclude 排除、再用 include 加回某些组合。

`strategy.fail-fast` 与 `continue-on-error`——`fail-fast` 作用于整个矩阵：设为 true（默认）时，矩阵中任一作业失败，GitHub 会取消矩阵中所有正在运行和排队的作业。`jobs.<job_id>.continue-on-error` 作用于单个作业：为 true 时该作业失败不影响其他作业继续，也不让工作流运行失败。二者可以配合——下面的工作流启动四个作业，每个作业的 continue-on-error 取决于 matrix.experimental 的值；带 continue-on-error: false 的作业有失败时全部取消，带 true 的作业失败则其他作业不受影响：

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    continue-on-error: ${{ matrix.experimental }}
    strategy:
      fail-fast: true
      matrix:
        version: [6, 7, 8]
        experimental: [false]
        include:
          - version: 9
            experimental: true
```

`strategy.max-parallel`——默认情况下 GitHub 视 runner 可用性最大化并行作业数。

### `jobs.<job_id>.container`

注意：如果工作流使用 Docker 容器动作、作业容器或服务容器，必须使用 Linux runner——GitHub 托管 runner 需用 Ubuntu；自托管 runner 需是 Linux 机器且装有 Docker。用 `jobs.<job_id>.container` 创建容器来运行作业中未指定容器的所有步骤。脚本步骤与容器动作混用时，容器动作会作为兄弟容器运行在同一网络、挂同样的卷。（container 下可配 image、credentials、env、ports、volumes、options。）

---

> **来源**：本文翻译自 GitHub 官方文档 [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understanding-github-actions) 与 [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)（后者为保留日常必需骨架的核心条目节译），GitHub Docs，许可 CC BY 4.0。抓取于 2026-09-13。
