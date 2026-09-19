---
title: GitHub Actions 实战：一条能跑通的 CI 流水线
source_url: https://github.com/actions/starter-workflows
author: GitHub Docs 与 actions/starter-workflows 社区
license: 概念与语法译自 GitHub Docs（CC BY 4.0）；CI 模板改写自 actions/starter-workflows（MIT）
fetched_at: 2026-09-19
translated: true
versions: Actions 运行时 Node.js 24；actions/checkout v7、actions/setup-python v7、actions/setup-java v6、actions/cache v6、actions/upload-artifact v7、docker/setup-buildx-action v4、docker/build-push-action v7；runner 镜像 ubuntu-24.04
order: 8
group: Git 与持续集成
---

前面的《Git 分支、合并与远程协作》与《Git 进阶：rebase、cherry-pick 与冲突解决》解决的是"代码怎么合"，本篇解决的是"合进去之前谁来自动验证、合进去之后怎么自动交付"。

上一篇那种"把官方语法条目抄一遍"的写法学不会 CI：真正难的是**把这些关键字拼成一条能跑、跑得快、失败了看得懂**的流水线。所以本篇反过来——先给一个**可以整份复制进仓库就能用**的 CI（lint + test + docker build），跑通之后再逐层加缓存、矩阵、环境与 secrets、并发控制，最后给一张按报错文字索引的排查表。语法细节只需知道"去哪查、哪几条天天用"。

本篇示例是一个最小 Python Web 服务（Flask/FastAPI 的形状都一样），末尾附一份 Maven/Gradle 版本，供 Java 后端同学平移。

## 一、先建立四个概念，再看 YAML

Actions 的对象模型只有四层，记住这一张表，官方文档所有页面都是它的展开：

| 概念 | 是什么 | 关键约束 |
|---|---|---|
| Workflow（工作流） | `.github/workflows/*.yml` 一个文件 = 一个工作流 | 必须在仓库里被提交才会生效 |
| Event（事件） | 触发它运行的仓库活动：`push`、`pull_request`、`schedule`、`workflow_dispatch`…… | 一个事件可配 `types` 与分支/路径过滤器 |
| Job（作业） | 一组步骤，跑在**同一个 runner**（一台全新虚拟机或容器）上 | 默认所有作业并行；`needs` 建立依赖 |
| Step（步骤） | 一个 shell 命令或一个 action（可复用脚本） | 同作业内共享工作目录与文件系统；跨作业**什么都不共享** |

最容易踩的心智模型是最后一条：**每个作业都在一台干净的机器上重新开始**。上一条流水线留下的 `pip install` 结果、构建出的镜像、`/tmp` 里的文件，下一个作业一概看不见。理解了这一点，"缓存""artifact（构建产物）""为什么要在一个作业里做完所有事"这三个问题就同时有答案了。

再补两条日常最需要的名词：`GITHUB_TOKEN` 是每个作业自动注入的临时代牌（权限由 `permissions` 控制）；runner 分 GitHub 托管（公开仓库免费不限量）与自托管（自己的机器，打标签认领作业）。

## 二、一条能跑通的 CI：lint + test + docker build

### 2.1 配套的最小项目

流水线要能跑，项目本身得自洽。下面四个文件加上后面的 `ci.yml`，构成完整可复制的样例：

```text
myapp/
├── app/__init__.py
├── app/main.py
├── tests/test_main.py
├── pyproject.toml
├── Dockerfile
└── .github/workflows/ci.yml
```

```python
# app/__init__.py
__version__ = "0.1.0"
```

```python
# app/main.py
"""一个可被测试与容器化的最小服务入口。"""

from __future__ import annotations

import os


def greeting(name: str | None = None) -> str:
    """返回问候语；未提供名字时读环境变量 APP_NAME。"""
    who = name or os.getenv("APP_NAME", "world")
    return f"hello, {who}"


def main() -> None:
    print(greeting())


if __name__ == "__main__":  # pragma: no cover
    main()
```

```python
# tests/test_main.py
import os

from app.main import greeting


def test_greeting_uses_argument() -> None:
    assert greeting("ci") == "hello, ci"


def test_greeting_reads_env(monkeypatch) -> None:
    monkeypatch.setenv("APP_NAME", "k8s")
    assert greeting() == "hello, k8s"
    assert os.environ["APP_NAME"] == "k8s"
```

```toml
# pyproject.toml
[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = []

[project.optional-dependencies]
dev = ["pytest>=8", "pytest-cov>=5", "ruff>=0.6", "black>=24"]

[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "B", "I", "UP"]

[tool.black]
line-length = 100

[tool.pytest.ini_options]
addopts = "-ra --strict-markers"
testpaths = ["tests"]
```

```dockerfile
# Dockerfile：多阶段？这个体量不需要，保持一层
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv/app

# 先拷依赖清单再拷源码，让 Docker 层缓存真正生效
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

COPY app/ ./app/
CMD ["python", "-m", "app.main"]
```

### 2.2 整份复制即可用的 ci.yml

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch: {}   # 允许在 Actions 页面点按钮手动跑一次

# 默认只给读代码的权限；哪个作业需要写，就在哪个作业里单独放开
permissions:
  contents: read

# 同一分支/同一 PR 上又来一次提交，就把还在跑的旧流水线取消掉
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

env:
  PYTHONUNBUFFERED: "1"

jobs:
  lint:
    name: 静态检查
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.13"
          cache: pip                       # setup-python 自带 pip 缓存
          cache-dependency-path: pyproject.toml
      - name: 安装工具链
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[dev]"          # 与 test 作业装同一套依赖，行为可复现
      - name: 格式检查（只报告，不改文件）
        run: black --check --diff .
      - name: Lint（输出成 PR 行内注解）
        run: ruff check --output-format=github .

  test:
    name: 单元测试
    needs: lint                            # 想更快可以删掉这行，让两者并行
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        python-version: ["3.12", "3.13", "3.14"]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: ${{ matrix.python-version }}
          cache: pip
          cache-dependency-path: pyproject.toml
      - name: 安装被测包与开发依赖
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[dev]"
      - name: 跑测试并产出覆盖率与 JUnit 报告
        run: pytest -q --cov=app --cov-report=term-missing --junitxml=report.xml
      - name: 失败时也上传报告（artifact 是跨作业保存文件的正规手段）
        if: ${{ ! cancelled() }}
        uses: actions/upload-artifact@v7
        with:
          name: pytest-report-${{ matrix.python-version }}
          path: |
            report.xml
            coverage.xml
          retention-days: 7

  docker:
    name: 构建镜像（不推送）
    needs: [lint, test]
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
      - name: 构建并加载到本机 Docker，验证镜像真的能起
        uses: docker/build-push-action@v7
        with:
          context: .
          push: false
          load: true
          tags: myapp:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: 冒烟测试
        run: |
          docker run --rm -e APP_NAME=smoke myapp:ci python -c "from app.main import greeting; assert greeting()=='hello, smoke'"
```

### 2.3 逐块解释这份 YAML 为什么这么写

- **`on` 里同时写 `push` 和 `pull_request`**：PR 上的检查用于卡合并，push 到 `main` 的检查用于验证真实合并结果。两者的 `GITHUB_TOKEN` 权限不同——`pull_request` 来自 fork 时是**只读**且拿不到 secrets（见第四节）。
- **`permissions: contents: read`**：官方 starter 模板（`ci/python-app.yml`）第一行就是这个。默认值往往是"能写"，收紧到只读是零成本的安全提升，需要写时在单个作业里再放开。
- **`needs` 决定形状，不决定速度**：`lint → test → docker` 串行便于"错在最早最便宜的地方"；但真正拖时长的是它，多数团队会把 lint 与 test 并行、只让 docker 依赖 test。
- **`if: ${{ ! cancelled() }}`**：默认情况下作业被前面的步骤失败打断时，后续步骤不执行。加上这个条件，测试挂了也能拿到报告。
- **`--output-format=github`**：让 ruff 的问题以"文件+行号"的红线出现在 diff 里，而不是埋进日志。这类"把结果回灌到 PR 界面"的习惯，比多写十个步骤更提升体验。

## 三、缓存与矩阵：把时长从 6 分钟压到 90 秒

CI 的第一性能杀手是重复安装依赖。Actions 提供三条互补的路：

### 3.1 语言级缓存：优先用 setup-* 内置

`actions/setup-python@v7`、`actions/setup-java@v6`、`actions/setup-node@v5` 都内置 `cache` 参数。它们已经处理好"缓存目录在哪、key 怎么算、跨 OS 怎么办"，能用就别手写：

```yaml
- uses: actions/setup-python@v7
  with:
    python-version: "3.13"
    cache: pip                       # 可选 pip / pipenv / poetry
    cache-dependency-path: pyproject.toml   # 默认只 hash **/requirements*.txt
```

**这是最常见的"缓存明明配了却不命中"**：依赖声明在 `pyproject.toml`（或 `uv.lock`、多包 monorepo），而默认哈希路径只匹配 `requirements*.txt`，找不到文件时整个缓存步骤被跳过，日志里只有一行不起眼的 `Dependencies lock file is not found`。显式写 `cache-dependency-path` 即可。

### 3.2 通用缓存：actions/cache 的 key 设计

需要缓存模型权重、数据集、HuggingFace 目录、Gradle 构建目录时，用 `actions/cache@v6`：

```yaml
- uses: actions/cache@v6
  with:
    path: |
      ~/.cache/pip
      ~/.cache/huggingface/hub
    key: ${{ runner.os }}-deps-${{ hashFiles('pyproject.toml', 'uv.lock') }}
    restore-keys: |
      ${{ runner.os }}-deps-
      ${{ runner.os }}-
```

三条规则决定成败：

1. **`key` 必须完全相等才写回**。它通常由"OS + 语义前缀 + 锁文件哈希"拼成。
2. **`restore-keys` 是前缀回退**。它让锁文件变化时仍能拿到上一次的缓存再增量补装——没有它，一次依赖微调就是全量重装。
3. **只能从当前分支、默认分支或 PR 的目标分支恢复**；配额是每仓库 10 GB，超出按最近最少使用淘汰。所以"从 feature 分支 A 建的缓存，分支 B 看不见"是设计如此，不是 bug。

### 3.3 Docker 层缓存：交给 buildx 的 gha 后端

容器构建的缓存不要走 `actions/cache`（镜像层存在 docker daemon 里，不是文件目录），而是上面例子里的 `cache-from/cache-to: type=gha`：把 BuildKit 的层缓存存进 Actions 缓存服务。`mode=max` 会把中间层也导出，代价是占配额，收益是"改一行代码不必重装依赖"。

### 3.4 矩阵：用一份 YAML 覆盖多版本

矩阵是"同一个作业展开成 N 份"。官方 starter 的老模板里能看到 `version: [10, 12, 14]` 这类 Node 版本——那些运行时如今已全部 EOL，矩阵里的每个值都应当是**当前受支持版本**：

```yaml
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false        # 默认 true：任一组合失败就取消其它组合
      max-parallel: 4         # 只想快速反馈时限制并发
      matrix:
        os: [ubuntu-24.04, macos-15]
        python-version: ["3.12", "3.13", "3.14"]
        exclude:
          - os: macos-15          # macOS 上只测最新版
            python-version: "3.12"
        include:
          - os: ubuntu-24.04
            python-version: "3.14"
            extra-pytest-args: "-W error"   # 给单个组合额外注入变量
    env:
      PYTEST_ARGS: ${{ matrix.extra-pytest-args }}
```

- `exclude` 是**部分匹配**即可生效，`include` 在 `exclude` 之后处理，因此可以"先排除再加回"。
- 一次运行最多展开 256 个作业；矩阵越大，排队越久、失败面越广。
- `fail-fast: false` 配合矩阵才是有用的：否则 3.12 的偶发失败会顺手取消 3.14 的作业，你就永远看不到 3.14 的结果。

Java 侧几乎同构，`setup-java` 的 `cache` 直接支持 maven/gradle：

```yaml
name: Java CI
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-24.04
    strategy:
      fail-fast: false
      matrix:
        java: ["21", "25"]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-java@v6
        with:
          distribution: temurin
          java-version: ${{ matrix.java }}
          cache: maven
      - name: 构建与测试
        run: mv -B -ntp verify
      - name: 上传失败时的 surefire 报告
        if: ${{ failure() }}
        uses: actions/upload-artifact@v7
        with:
          name: surefire-java${{ matrix.java }}
          path: "**/target/surefire-reports/"
```

## 四、环境与 secrets：把权限和凭据分开管

### 4.1 三类 secrets 的作用域

| 类型 | 可见范围 | 典型用途 |
|---|---|---|
| Repository secrets | 单个仓库全部作业 | 测试用凭据、包源 token |
| Environment secrets | 只有声明了该 `environment` 的作业能读到 | 生产数据库口令、部署 key |
| Organization secrets | 组织内多个仓库（受 policy 控制） | 共享镜像仓库账号 |

同名时按"环境 secrets / 组织 secrets"的可见性策略取用；把生产凭据放进 environment 而不是仓库级，是**让"谁能拿到生产 key"变成可审计的界面配置**的关键一步。

三条硬规则：secrets 不会传给 fork 发出的 `pull_request` 运行（这正是 CI 敢接社区 PR 的原因）；`if:` 条件里**不能直接引用** `secrets.*`，必须先赋给作业级 `env` 再判断是否为空；未定义的 secret 求值为空字符串，所以 `docker login -p ""` 会报一个和"密钥"毫无关系的 401。

### 4.2 environment 的保护规则

在仓库 Settings → Environments 建一个 `production`，加 Required reviewers（部署需人工点确认）与 deployment branch 限制，然后：

```yaml
  deploy:
    if: ${{ github.ref == 'refs/heads/main' && github.event_name == 'push' }}
    needs: [test, docker]
    runs-on: ubuntu-24.04
    environment:
      name: production
      url: https://example.internal   # 运行列表里会出现可点链接
    concurrency:
      group: production-deploy       # 同一时间只允许一个部署
      cancel-in-progress: false      # 部署绝不能被后来者掐断
    permissions:
      contents: read
      packages: write
    steps:
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # GHCR 用内置 token 即可，无需 PAT
      - uses: docker/build-push-action@v7
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:sha-${{ github.sha }}
          cache-from: type=gha
```

这段直接来自官方 `ci/docker-publish.yml` 的骨架（那里还用 `docker/metadata-action` 生成 `latest`/semver 标签，并用 cosign 对 digest 做签名）。注意它的设计意图：**PR 只构建、不登录、不推送**（`if: github.event_name != 'pull_request'`），既省配额又避免把凭据暴露给不受信代码。

### 4.3 云凭据优先用 OIDC

如果你的部署目标是 AWS/GCP/Azure/阿里云，不要存长期 AccessKey。用 `id-token: write` 权限 + 各家 OIDC provider action，让 Actions 用一次性的身份换临时凭据：

```yaml
    permissions:
      id-token: write        # 关键：允许作业向云平台证明"我是这个仓库的这次运行"
    steps:
      - uses: aws-actions/configure-aws-credentials@v5
        with:
          role-to-assume: arn:aws:iam::123456789012:role/ci-deploy
          aws-region: ap-northeast-1
```

信任策略里把 `sub` 限定成 `repo:你的org/你的repo:environment:production`，即使仓库被攻破也拿不到角色。

## 五、触发与并发控制

### 5.1 触发器的正确形状

```yaml
on:
  push:
    branches: [main, "release/**"]
    tags: ["v*.*.*"]
    paths-ignore: ["docs/**", "**.md"]      # 改文档不跑全量 CI
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, ready_for_review]
  workflow_dispatch:
    inputs:
      target:
        description: 部署目标
        type: choice
        options: [staging, production]
        default: staging
  schedule:
    - cron: "30 5 * * 1-5"     # UTC；工作日 05:30 跑夜间全量测试
      timezone: "Asia/Shanghai"
  workflow_call:               # 让别的仓库把它当可复用工作流调用
    inputs:
      python-version:
        type: string
        default: "3.13"
```

几条真会咬人的规则：`branches` 与 `paths` 只作用于 `push`/`pull_request`，`tags` 只作用于 `push`；一旦某个事件配了 `types` 或过滤器，`on` 下**所有**事件都必须写成带冒号的映射形式；`schedule` 在 fork 上默认禁用，且总是跑默认分支的最新提交；`workflow_dispatch` 只在默认分支上的工作流文件里可见（你在新分支改的 inputs 不会出现在按钮上）。

### 5.2 concurrency：取消、排队、还是串行

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- **PR 反馈**：`cancel-in-progress: true`，最新提交才值得测。
- **部署/发布**：必须 `false`，同组串行排队，否则两个部署同时改线上必然互相踩。
- `queue: max` 允许同组最多 100 个 pending 排队（默认 `single` 只留最新一个），且与 `cancel-in-progress: true` **不能同时使用**（校验直接报错）。
- 组名**不区分大小写**；同组按"开始等待组的时间"FIFO 处理，实际顺序无保证。
- 想让 `main` 不被取消而 PR 被取消，用条件表达式：`cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`。

### 5.3 让 CI 真正"卡住"合并

流水线绿了不等于它挡得住合并。在分支保护的 Required checks 里勾上对应**作业名**（多个矩阵作业时是 `test (3.12, ubuntu-24.04)` 这种全名）；要合并前必过，还得开 "Require branches to be up to date before merging"，否则你的检查测的是过时的特性分支。这一步不做，前面所有配置都只是一条给作者自己看的通知。

## 六、常见失败排查

| 现象 / 日志原文 | 根因 | 处理 |
|---|---|---|
| `Process completed with exit code 1.` 结尾，看不出问题 | Actions 只报最后一步的退出码 | 往上翻到**第一条**非零退出；`set -x` 或 `--verbose` 重跑；命令行看日志更快（见下） |
| `Resource not accessible by integration` / `gh: … 403` | `GITHUB_TOKEN` 权限被 `permissions` 收紧，或组织策略禁写 | 在需要写的作业里单独加 `pull-requests: write` 等；不要全局放开 |
| `head file '…' is not found`、`Unable to locate executable file: …` | `actions/checkout@v7` 后工作目录变了，或 `defaults.run.working-directory` 指错 | 显式写 `working-directory`，或用 `path:` 参数控制 checkout 位置 |
| 缓存永不命中，日志 `Dependencies lock file is not found` | `hashFiles()` 没匹配到任何文件 | 修正 `cache-dependency-path` / `path`；本地 `python -c "import glob;print(glob.glob('**/uv.lock',recursive=True))"` 验证模式 |
| 只在一个 Python/Node 版本上失败 | 矩阵里混进了已 EOL 的运行时，或依赖不再支持它 | 矩阵只放受支持版本（EOL 版本连安装器都会开始报错） |
| `head … cannot be merged`、PR 上检查不出现 | fork PR 拿不到 secrets，导致步骤直接失败或被跳过 | 依赖 secrets 的作业加 `if: github.event_name != 'pull_request'`；需要的凭据改为"仅对内部分支可见" |
| `no space left on device` | runner 磁盘被镜像层与缓存占满 | `docker builder prune -f`、`runner clean`；`rm -rf` 无用的预装 SDK（`df -h` 先看） |
| 偶发失败，重跑就过 | flaky test（依赖时间、网络、顺序） | 矩阵加 `fail-fast: false`；用 `pytest-repeat`/随机顺序定位，别习惯 `Re-run failed jobs` |
| `The job was cancelled because it exceeded the maximum time` | 默认 360 分钟，或步骤 `timeout-minutes` 太小 | 给单步设 `timeout-minutes`，长任务拆分并行；自托管注意 `GITHUB_TOKEN` 24 小时过期 |
| 定时任务不跑 | fork 上 schedule 禁用；或 cron 写法/时区理解错 | 在主仓库配置；用 `gh cronparser` 校验表达式 |

**命令行比网页好用**（`gh` 是官方 CLI）：

```bash
gh run list --branch main --limit 20            # 看最近运行
gh run watch 1234567890                          # 实时跟随
gh run view 1234567890 --log-failed              # 只下载失败步骤的日志
gh run view 1234567890 --job 42 --log --debug    # 加 ACTIONS_STEP_DEBUG 级别的日志
gh run rerun 1234567890 --failed                 # 只重跑失败作业
gh workflow run ci.yml -f target=staging         # 手动触发 workflow_dispatch
gh api -X DELETE /repos/{owner}/{repo}/actions/caches   # 清缓存前先看看：GET 同名
```

改 YAML 之前，**先在本地过一遍校验**，能省掉一半"push 上去才发现缩进错"的循环：

```bash
# actionlint：静态检查表达式、上下文、动作输入拼写错误
brew install actionlint && actionlint            # 或 go run github.com/rhysd/actionlint/cmd/actionlint@latest
# act：把作业跑在本机 Docker 里（不追求 100% 等价，但能快速验证测试本身）
brew install act && act -j test -P ubuntu-24.04=catthehacker/ubuntu:act-24.04
# 只验证流水线里的命令是否可跑，通常比 act 更快也更接近真相：
python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && pytest -q
```

`act` 的边界要知道：它模拟不了 GitHub 托管 runner 的全部预装软件与 `GITHUB_TOKEN` 语义，遇到"本地绿、CI 红"先怀疑环境与预装工具版本，而不是怀疑 Actions 坏了。

## 七、小结与延伸

一条合格的 CI 只需满足三件事：**复制即用**（同仓库任何人 `git push` 就能看到它跑）、**反馈够快**（缓存 + 并行 + 及时取消，把 PR 检查压进 2 分钟）、**失败可解释**（错误回灌到 diff 行、报告进 artifact、日志能一条命令拉下来）。语法是达成这三件事的手段，官方《Workflow syntax for GitHub Actions》永远比任何转述更权威，日常只需要查它三节：`on`、`jobs.<job_id>.strategy`、`concurrency`。

延伸：想读懂真实项目的 CI，读 `actions/starter-workflows` 的 `ci/` 与 `deploy/` 目录（GitHub 官方维护的模板集，MIT），它是"业界默认写法"的最大公约数；进阶可复用工作流（`workflow_call`）与 composite action，把重复的六步抽成一次 `uses: ./.github/workflows/python-ci.yml`。

**编者补充（与本站其他篇目的连接）**：

- **把 LLM 评测接进 CI**：不要在有随机性的输出上写死断言。可行形态是"离线评测集 + 阈值"——把回归集当 fixture，`pytest` 里断言通过率与 P95 延迟，密钥放 environment secrets，产物（评测报告）用 artifact 保存 7 天，失败时 `--log-failed` 直接看。评测跑满 20 分钟以上时，把它从 PR 门禁里摘出去，改成 `schedule` 触发的夜间作业。
- **镜像与推理服务**：`docker/build-push-action` 的 `type=gha` 层缓存对"基础镜像里已经装好 torch/vllm"的场景收益最大；把权重打进镜像通常是个坏主意（改权重=重建全层），应当走卷或对象存储。
- **自托管 runner 与 GPU**：跑微调/评测的机器接成 `runs-on: [self-hosted, gpu]`，注意自托管 runner 上作业之间会残留状态（`GITHUB_WORKSPACE` 不会被彻底清理），缓存与清理纪律要自己补上；`GITHUB_TOKEN` 在作业结束或最长 24 小时后过期。

---

> **来源**：概念与语法条目译自 GitHub 官方文档 [Understanding GitHub Actions](https://docs.github.com/en/actions/get-started/understanding-github-actions)、[Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)、[Caching dependencies to speed up workflows](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)、[Encrypted secrets](https://docs.github.com/en/actions/reference/encrypted-secrets)（GitHub Docs，CC BY 4.0）。CI/CD 作业结构改写自官方模板仓库 [actions/starter-workflows](https://github.com/actions/starter-workflows) 的 `ci/python-app.yml` 与 `ci/docker-publish.yml`（MIT License, Copyright (c) 2020 GitHub），并按 2026-09 现行动作版本（`actions/checkout@v7`、`actions/setup-python@v7`、`actions/cache@v6`、`actions/upload-artifact@v7`、`docker/setup-buildx-action@v4`、`docker/build-push-action@v7`、`actions/setup-java@v6`）与受支持的运行时版本更新——原模板示例中的 Node 10/12/14 与 `flake8` 用法均已过时。示例项目代码、排查表与编者为 LLM/推理场景补充的建议为本站据上述文档整理撰写。动作版本号与各限制值核实于 2026-09-19。
