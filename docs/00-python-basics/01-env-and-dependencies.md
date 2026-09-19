---
title: 环境与依赖管理
source_url: https://docs.astral.sh/uv/getting-started/installation/
author: Astral（uv 文档）与 Python Software Foundation（官方教程）
license: MIT OR Apache-2.0（uv 文档）；PSF 许可证第 2 版（官方教程）
fetched_at: 2026-09-19
translated: true
versions: uv 当前稳定版；Python 3.13+
order: 1
group: 环境与工程起步
---
学 Python 的第一道坎不是语法，而是「我到底在跑哪一个解释器、包装到哪里去了」。这台机器上可能同时有系统自带的 Python、Homebrew 装的 Python、某个项目 `.venv` 里的 Python；`pip install` 装的东西如果在错误的解释器里，代码就永远 `ModuleNotFoundError`。本文一次讲清三件事：**装解释器**、**建隔离环境**、**声明与锁定依赖**，并给出目前社区与本站示例默认使用的工具链 [uv](https://docs.astral.sh/uv/)。

本站后续所有模块的示例（FastAPI、RAG、微调脚本）都假设你有一个项目级的隔离环境，所以这一篇值得先做完再往下读。

## 先理解一个概念：为什么必须有虚拟环境

Python 应用很少只用标准库。应用 A 需要某个库的 1.0 版本，应用 B 需要 2.0 版本——这是官方教程开篇就给出的冲突场景：一个全局的 Python 安装不可能同时满足两者，装哪个都会让另一个跑不起来。

解决办法是**虚拟环境**（virtual environment）：一个目录树，里面装着某个特定 Python 版本解释器的副本，以及这个项目专用的第三方包。A 用自己的 1.0 环境，B 用自己的 2.0 环境，互不干扰。这就是全部原理，剩下的只是「谁来创建和维护这个目录」。

三条常见路线：

| 路线 | 命令入口 | 适用场景 |
| --- | --- | --- |
| 内置 `venv` + `pip` | `python -m venv .venv` | 不能装新工具、需要与老教程/CI 完全一致 |
| **uv**（推荐） | `uv init` / `uv add` / `uv run` | 新项目、要同时管 Python 版本与依赖、追求速度 |
| poetry / pixi 等 | 各自命令 | 已有团队规范，本文不展开 |

uv 是用 Rust 写的包与项目管理器，一条命令同时解决「装哪个 Python」「建环境」「装依赖」「锁版本」四件事，且 `uv pip` 子命令与 pip 的用法高度兼容，读老教程不会失效。工程化深入部分（发布构建、workspace、锁文件导出）见《uv 项目管理：从 uv init 到构建发布（含工程化概念）》。

## 安装 uv

uv 官方提供独立安装脚本，也发布在 PyPI 与各家包管理器里。**先读脚本再执行**是好习惯，安装脚本可以直接 `less` 打开查看。

macOS / Linux：

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
# 或指定版本
curl -LsSf https://astral.sh/uv/0.12.17/install.sh | sh
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

其他渠道，任选其一：

```bash
brew install uv                 # macOS（Homebrew 官方核心包）
winget install --id=astral-sh.uv -e   # Windows（WinGet）
scoop install uv                # Windows（Scoop）
pipx install uv                 # 已通过 pip 工作的人：uv 建议装进隔离环境
sudo port install uv            # MacPorts
```

验证安装：

```bash
uv --version
```

看到版本号即成功。若提示命令找不到，说明安装脚本写入的路径（通常是 `~/.local/bin`）不在 `PATH` 里，重开一个终端或把它加进 shell 配置即可。

**不想装 uv？** 也可以直接从官网下载解释器安装包：<https://www.python.org/downloads/>。Windows 安装时务必勾选 `Add python.exe to PATH`，漏勾后的典型症状是 PowerShell 报「无法将 python 项识别为 cmdlet」，补救办法是把 `python.exe` 所在目录手动加进 `Path` 环境变量，或重装并勾选。macOS 与 Linux 上命令通常是 `python3`。

## 用 uv 管 Python 版本

uv 可以自行下载并管理多个 Python 版本，不再需要系统包管理器代劳：

```bash
uv python list                      # 查看可用与已安装版本
uv python install 3.13              # 安装某个版本
uv python pin 3.13                  # 在项目里固定版本，写入 .python-version
```

`uv python pin` 生成的 `.python-version` 文件应该提交进版本库，这样队友和 CI 拿到的解释器版本与你一致。

## 第一个项目：uv init / uv add / uv run

```bash
uv init hello-python        # 创建项目骨架
cd hello-python
uv add httpx                # 添加依赖（自动建环境、写 pyproject.toml、更新锁文件）
uv run main.py              # 在项目环境里运行脚本，无需手动激活
```

`uv init` 会生成这些文件，理解它们的分工是关键：

```text
hello-python/
├── pyproject.toml      # 项目元数据与依赖声明（人写）
├── .python-version     # 固定解释器版本（人写）
├── uv.lock             # 精确锁定解析后的全部依赖版本（工具生成，必须提交）
├── .venv/              # 虚拟环境目录（工具生成，绝不提交）
└── main.py             # 入口脚本
```

`pyproject.toml` 里声明的是**范围**（`httpx>=0.27`），`uv.lock` 记录的是**确定的版本与哈希**。日常只需三个动作：`uv add` 加依赖、`uv remove` 删依赖、`uv sync` 按锁文件还原环境（换机器、拉代码后第一件事）。

```bash
uv remove httpx
uv sync                       # 让 .venv 与 uv.lock 完全一致
uv tree                       # 查看依赖树
uv pip list                   # 借用 pip 视角查看当前环境
```

uv 的惯例是**不需要手动激活**环境：`uv run` 会自己找到 `.venv`。如果你习惯在终端里连续敲 `python`，可以显式激活：

```bash
source .venv/bin/activate     # Unix / macOS
.venv\Scripts\activate        # Windows PowerShell / CMD
deactivate                    # 撤销激活
```

## 一次性脚本与工具：uvx 与 PEP 723

跑一个孤零零的脚本、或者临时用一下某个命令行工具，不值得建项目：

```bash
uvx ruff check .              # 一次性运行 ruff，不装进任何项目环境
uv run --with httpx fetch.py  # 临时把 httpx 挂进这次运行
```

脚本自己也能声明依赖，把元数据写成文件开头的特殊注释块（PEP 723 内联脚本元数据），uv 会为它单独建缓存环境：

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx"]
# ///

import httpx

resp = httpx.get("https://example.org", timeout=10)
print(resp.status_code, len(resp.text))
```

保存为 `fetch.py` 后直接 `uv run fetch.py` 就能跑，不必先 `pip install httpx`。这个写法在分享单文件工具脚本时特别好用。

## 传统路线：venv + pip（读老教程必备）

不能装 uv 时（某些公司环境、教学机），标准做法是内置的 `venv` 模块。以下内容译自官方教程「虚拟环境和包」一节。

创建虚拟环境（`venv` 会安装**运行该命令时所用的那个 Python 版本**）：

```bash
python -m venv tutorial-env
```

激活后终端提示符会带上环境名前缀，此时 `python` 与 `pip` 都指向这个环境：

```bash
source tutorial-env/bin/activate        # Unix / MacOS
tutorial-env\Scripts\activate           # Windows
(tutorial-env) $ python -V
```

`pip` 常用子命令：

```bash
python -m pip install novas             # 装最新版
python -m pip install requests==2.6.0   # 装指定版本
python -m pip install --upgrade requests   # 升级到最新
python -m pip uninstall requests        # 卸载一个或多个包
python -m pip show requests             # 查看某个包的元数据
python -m pip list                      # 列出当前环境全部包
python -m pip freeze > requirements.txt # 按 pip install 可读的格式导出
python -m pip install -r requirements.txt   # 按清单安装
deactivate                              # 退出虚拟环境
```

用 `python -m pip` 而不是裸 `pip` 的原因很实际：`python -m pip` 保证「装进当前这个 `python` 对应的位置」，避免 `pip` 与 `python` 指向不同解释器时空幻般的 `ModuleNotFoundError`。

虚拟环境的常用目录名是 `.venv`：它在终端里默认隐藏、不必额外解释目录含义，也能避免与某些工具使用的 `venv` 名称冲突。注意别和存放环境变量的 `.env` 文件混淆（后者见《环境变量与 API Key 管理（.env 与 python-dotenv）》）。

## 接到 VS Code 里

1. 安装微软官方 Python 扩展（提供语言服务、调试与测试集成）。
2. `Cmd/Ctrl + Shift + P` → `Python: Select Interpreter` → 选择项目下的 `.venv`（uv 创建的环境会被自动列出）。
3. 状态栏右下角会显示当前解释器；此后编辑器里 `F5` 调试、`Shift+Enter` 交互执行都走同一个环境。
4. 图形化断点调试需要 `debugpy`，在 uv 项目里的推荐做法与启动配置见《调试入门：pdb、breakpoint() 与 debugpy》。

选错解释器是「命令行能跑、编辑器报错」的唯一常见原因，遇到这种情况先看状态栏。

## 常见坑

**1. 装到了系统 Python。** macOS 尤其危险：系统自带解释器被 `pip install` 污染后，某些系统工具会坏掉，新系统的 Homebrew Python 还会直接拒绝安装（`error: externally-managed-environment`）。对策永远是「先建虚拟环境，再装包」，或者用 `pipx` 装命令行工具。

**2. 忘记激活 / 激活了错的环境。** 表现为刚 `pip install` 完立刻 `ModuleNotFoundError`。用 `which python`（Windows 用 `Get-Command python`）确认；改用 uv 的 `uv run` 可以整类问题消失。

**3. 只提交 `requirements.txt` 而不锁版本。** `pip freeze` 导出的是当时的完整快照，但它是**平铺**的：不含依赖之间的父子关系，重装时解析结果可能不同。uv 的 `uv.lock`、pip-tools 的 `requirements.lock` 才是可复现的锁定文件；`pyproject.toml` 或 `requirements.in` 是人写的声明层。

**4. 把 `.venv` 提交进 Git。** 体积大、跨平台不可用（里面是解释器路径和二进制）。`.gitignore` 里至少包含 `.venv/`、`__pycache__/`、`.env`。

**5. `.env` 与 `.venv` 混为一谈。** 前者是键值对配置文件，后者是环境目录；两者都默认不入库。

**6. 多个项目共用一个全局环境。** 迟早遇到版本冲突。原则：一个项目一个 `.venv`，一个 `pyproject.toml`。

**7. 在 uv 项目里手工 `pip install`。** `uv pip install` 或 `uv add` 之外直接 `pip install` 会让环境与锁文件脱节，下次 `uv sync` 会把你手工装的包清掉。

## 最小项目：从零跑通一次真实调用

```bash
uv init llm-probe && cd llm-probe
uv add httpx
uv run main.py
```

```python
# main.py —— 验证「环境 + 依赖 + 网络请求」三件事都通了
import httpx

def fetch_status(url: str) -> int:
    resp = httpx.get(url, timeout=10, follow_redirects=True)
    return resp.status_code

if __name__ == "__main__":
    print("HTTP 状态：", fetch_status("https://example.org"))
```

看到这行输出，说明解释器、依赖解析、虚拟环境、运行链路全部打通。接下来把 API Key 放进 `.env` 而不是代码里，见《环境变量与 API Key 管理（.env 与 python-dotenv）》；再往后写第一个程序逻辑，从《变量与基本类型》开始。

## 延伸阅读

- uv 安装：<https://docs.astral.sh/uv/getting-started/installation/>
- uv 项目指南：<https://docs.astral.sh/uv/guides/projects/>
- uv 的 pip 兼容接口：<https://docs.astral.sh/uv/pip/>
- 官方教程 12 虚拟环境和包：<https://docs.python.org/zh-cn/3/tutorial/venv.html>
- Python 官方下载页（Windows / macOS 安装包）：<https://www.python.org/downloads/>
- 站内相邻文章：《环境变量与 API Key 管理（.env 与 python-dotenv）》《模块与包》《调试入门：pdb、breakpoint() 与 debugpy》《uv 项目管理：从 uv init 到构建发布（含工程化概念）》

---

> **来源**：抓取于 2026-09-19。引自 [Installing uv — uv 官方文档](https://docs.astral.sh/uv/getting-started/installation/)、[The pip interface — uv 官方文档](https://docs.astral.sh/uv/pip/)（Astral，MIT OR Apache-2.0 双许可）并译自 [12. 虚拟环境和包 — Python 官方教程（中文）](https://docs.python.org/zh-cn/3/tutorial/venv.html)（Python Software Foundation，PSF 许可证第 2 版）；解释器安装步骤另参考 [廖雪峰 Python 教程 · 安装 Python](https://liaoxuefeng.com/books/python/install/index.html)（廖雪峰，署名转载）。本篇合并自原「环境搭建与第一个程序」与「pip 与虚拟环境」两篇，路线取舍、常见坑与最小项目为本站编者注。
