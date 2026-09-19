---
title: 第一次 AI 结对：从零做一个命令行小工具
source_url: https://code.claude.com/docs/en/common-workflows
author: 本站编者（循环骨架依据 Anthropic Claude Code 官方文档 Best practices 与 Common workflows）
license: 原创整理（所引官方文档 Copyright Anthropic PBC，教学用途署名；文中代码、命令与输出为编者实测记录）
fetched_at: 2026-09-19
translated: false
versions: 实测环境 Python 3.14.6 / pytest 9.0.3 / ruff（uvx 临时安装）/ macOS；代码要求 Python 3.12+
order: 1
group: 日常开发流
---

## 为什么要完整走一遍

工具类文章回答"某个能力怎么用"，环境类文章回答"怎么把它装上"。但第一次真正坐下来和 AI 结对时，卡住人的通常不是这两件事，而是另外三件：

1. **第一句话不知道怎么说**——说太粗，它替你脑补需求；说太细，你其实在自己写代码。
2. **不知道它到底做完没有**——它说"已完成，测试通过"，你不确定该不该信。
3. **出错之后不知道怎么办**——重开会话丢掉上下文，继续对话又越描越黑。

这三件事没有一门"技术"要学，只有**一套可重复的节拍**。本篇就带你把这个节拍走一遍：从零做一个真的能用的命令行待办工具 `todo`，全程四拍——**需求 → 生成 → 验收 → 存档**，并且在"验收失败"和"补测试"两处各走一个来回。文中的提示词全部原文照录，可以直接粘进你的会话；命令与输出全部是编者在真实环境里跑出来的记录，不是设想出来的示意图。

先把节拍钉死，后面所有进阶玩法都是在这四拍上做加固：

```text
需求（写成能验证的条目）
   ↓
生成（一次只让它做一件事）
   ↓
验收（按判据逐条跑命令，不听汇报）  ← 失败就把真实输出贴回去，回到"生成"
   ↓
存档（commit 即存档点，可回滚）
```

## 第 0 步：准备——选题、目录，以及不在本篇里的事

**安装、登录、订阅与模型选择不在本篇重复**：见《环境搭建：Claude Code 与 Cursor 的安装与配置矩阵》；权限模式与沙箱的取舍见《Claude Code 权限系统与安全机制》。本篇假设你在任意目录已经能起一个会话。

选题的三条判据（第一次结对，这三条比工具选择更重要）：

| 判据 | 为什么 | 本次选题怎么满足 |
| --- | --- | --- |
| 一次会话内能做完 | 超过上下文容量，就得引入跨会话状态管理，那是后话 | 单文件 Python 脚本 + 一个 JSON 存储 |
| 输出可机器判定 | "看起来对"不是判据，`exit code` 与断言才是 | 每条命令都有确定的 stdout 与退出码 |
| 你自己真想用 | 有真实需求，你才会去验收而不是放行 | 待办清单是每天都用得上的小工具 |

**反面选题**：要注册外部账号、要装数据库、带 UI、或者"帮我做个小程序"——它们的共同点是**验证成本高于实现成本**，第一次结对做这个，你只会得到一堆没法判定的代码。

工作目录先建成 git 仓库，理由见《Git in AI 工作流：commit 即存档、worktree 隔离与审查流》：每个 commit 都是一个可回滚的存档点，AI 改坏了你能一步退回。

```bash
mkdir -p ~/tmp/todo-cli && cd ~/tmp/todo-cli
git init -b main
claude
```

## 第 1 步：需求拆解——首轮提示词只做一件事：不许它动手

第一次结对最常见的错误，是第一句话就说"帮我写个 TODO 工具"。它一定会动手，而且会替你把十条没说的需求全补上。所以前两条提示词的目的是**把脑补变成提问**：

```text
我想做一个命令行待办清单工具，名字叫 todo：能新增、列出、标记完成、删除。
先不要写任何代码。请你一次只问我一个问题，问 6~8 个问题后停下来，
把结论整理成一份"可验证的需求清单"。
要求：
- 每条需求都要能写成一条命令 + 一个期望输出来判定真假；
- 不要替我假设我没说的事情；如果某个问题我回答"随便"，你就把它写进"非目标"里；
- 顺便给我一份"明确不做"的清单（非目标），我会删掉不想要的条目。
```

"一次只问一个问题"这个约束非常值钱：一次问十个，模型会挑好答的答；一次问一个，你才有机会在第 3 个问题就改主意。同一招在《Claude Code 工作流与最佳实践》里叫"让 Claude 采访你"。

回答完它给的 7 个问题之后，再补一条把结论落成文件——**这一步决定了后面验收和测试有没有依据**：

```text
把上面确认过的需求写成 REQUIREMENTS.md，用表格：编号｜需求（只写做什么/不做什么）｜
当前行为｜验证方式（一条命令）。
不要写实现方案，不要引入任何第三方依赖，不要新增除这个文件以外的东西。
```

编者整理出的成品就是这样八条（会话里它写的措辞略有差异，判据一致）：

| # | 需求 | 验证方式 | 通过标准 |
| --- | --- | --- | --- |
| 1 | 新增一条待办并分配稳定 ID | `python3 todo.py add "写周报"` | `已添加 #N：写周报`，N 单调递增、删除后不复用 |
| 2 | 列出未完成项，按截止日升序，无截止日排最后 | `python3 todo.py list` | 顺序确定、不含已完成 |
| 3 | 含已完成项需显式开关 | `python3 todo.py list --all` | 已完成显示为 `[x]` |
| 4 | 未知 ID 必须报错 | `python3 todo.py done 999; echo $?` | stderr 有人话提示，退出码 `2` |
| 5 | 存储路径可切换 | `python3 todo.py --file /tmp/a.json list` | 读写指定文件，不碰 `~` |
| 6 | 截止日只接受 `YYYY-MM-DD` | `python3 todo.py add x --due 1/5` | 拒绝、退出码 `2`、不落盘 |
| 7 | 输出能被脚本消费 | `python3 todo.py list --json` 接 `python3 -m json.tool` | 可解析，字段固定 |
| 8 | 空清单不是错误 | 全新存储下 `python3 todo.py list` | 提示"没有待办"，退出码 `0` |

**非目标**同样要写下来，否则它会顺手加：不做多用户、不做云同步、不做并发锁、不做 TUI、不接日历 API。

## 第 2 步：首轮实现提示词（含四条纪律）

```text
按 REQUIREMENTS.md 实现 todo.py：Python 3.12+ 标准库、单文件、argparse 子命令 add/list/done/rm、
存储为 JSON（默认 ~/.todo/items.json，可用环境变量 TODO_FILE 覆盖）。
纪律：
1. 不要写测试——测试我们下一轮单独做，测试判据只来自 REQUIREMENTS.md。
2. 不要引入任何第三方依赖，不要新增文件；不要顺手做架构调整。
3. 写完自己跑 `python3 todo.py add "示例"` 和 `python3 todo.py list`，把真实输出贴给我。
4. 交付时明确列出两件事：你做了哪些假设；八条需求里哪几条你没实现或打了折扣。
```

第 1 条纪律"不许写测试"是故意的：**让实现者同时出题又自己判卷，是 AI 结对里最早出现的失效模式**（同一结论见《TDD with AI：Kent Beck 的增强编程实践》与《AI 结对与代码审查》）。第 4 条把"自报缺口"变成固定动作，成本几乎为零，但它报的仍然只是汇报——见下一步。

首轮产出是一个约 100 行的 `todo.py`，它按纪律 3 跑了那两条命令，输出确实是对的：

```text
已添加 #1：重写模块 13 的首页导读
#1  [ ] 重写模块 13 的首页导读
```

（会话里助手的自述文字每轮措辞都不同，本篇只记录可复现的部分：命令与它的实际输出。）

问题全在它没跑的那几条命令里。首轮产出中编者后来标出问题的关键三行：

```python
def cmd_add(args):
    data = load()
    item = {
        "id": len(data["items"]) + 1,   # 需求 1：删除末位之后 ID 会被复用
        "text": args.text,
        "done": False,
        "due": args.due,                # 需求 6：格式完全不校验，收什么存什么
    }

def cmd_list(args):
    ...
    items.sort(key=lambda i: (i["due"] is not None, i["due"]))  # 需求 2：日期按字符串比大小
```

## 第 3 步：验收——逐条跑命令，不接受汇报

下面是编者按需求表逐条跑出来的真实输出（存储指向临时文件，方便复现）。

**需求 6（日期校验）——垃圾输入被静默收下，还排到了正确日期的前面：**

```console
$ python3 todo.py add "发版说明" --due 2026-12-31
已添加 #3：发版说明

$ python3 todo.py add "跨年值班表" --due 1/5
已添加 #4：跨年值班表          ← 它没有拒绝

$ python3 todo.py list
#1  [ ] 重写模块 13 的首页导读
#2  [ ] 给 CI 加 ruff 闸门
#4  [ ] 跨年值班表  截止 1/5   ← 1/5 排在 2026-12-31 之前：字符串比较 "1" < "2"
#3  [ ] 发版说明  截止 2026-12-31
```

**需求 1（ID 稳定性）——删一条之后，新条目和已存在的条目撞号：**

```console
$ python3 todo.py rm 2
已删除 #2

$ python3 todo.py add "退掉闲置的机械键盘"
已添加 #4：退掉闲置的机械键盘   ← len(items)+1 又数回 4

$ python3 todo.py list
#1  [ ] 重写模块 13 的首页导读
#4  [ ] 退掉闲置的机械键盘
#4  [ ] 跨年值班表  截止 1/5    ← 两个 #4
#3  [ ] 发版说明  截止 2026-12-31
```

**撞号的后果不是"难看"，而是数据被改错（需求 3、4 一起崩）：**

```console
$ python3 todo.py done 4
已完成 #4

$ python3 todo.py list --all
#1  [ ] 重写模块 13 的首页导读
#4  [ ] 退掉闲置的机械键盘      ← 你想勾的是这条
#4  [x] 跨年值班表  截止 1/5    ← 被勾的是那条
#3  [ ] 发版说明  截止 2026-12-31
```

**需求 4（未知 ID）这轮侥幸是对的**，值得单独确认一次，因为它后面会被改坏：

```console
$ python3 todo.py done 999
未找到待办 #999
$ echo $?
2
```

逐条对照的结果：**八条判据里首轮真正满足五条**。这五条大概率也是它自报的"已完成"范围，剩下三条（1、2、6）全是它没跑过的路径——这就是为什么验收要人来跑：`len()+1` 分配 ID 在没有任何删除时看起来完全正常，"看起来正常"正是这类代码能活过汇报的原因（机制层面见《AI 代码的安全与质量陷阱：六大陷阱与检测清单》）。

## 第 4 步：失败迭代——把真实输出原样贴回去

第二轮提示词的要点是：**贴事实，不贴情绪**（"你怎么又写错了"只会换来一段道歉和同样错误的补丁），并且**圈定改动范围**。

```text
第一轮实现有三处真实问题，输出是我跑出来的，原样贴在下面。
要求：只改 todo.py，只修这三处，不要顺手重构别的；改完把这三组命令重跑一遍，
输出贴给我；最后明确回答——还有哪些"ID 分配 / 输入格式"同类的边界你没处理？

1) --due 1/5 被静默接受，且 list 里它排在 2026-12-31 之前（期望：拒绝，退出码 2，不落盘）
2) rm 掉 #2 之后再 add，新条目 ID 与已存在的 #4 撞号（期望：ID 永不复用）
3) done 4 勾中了另一条 #4（期望：ID 唯一，勾错不可能发生）

<在这里粘贴上面三段真实输出>
```

复跑结果（第二轮，同一段命令）：

```console
$ python3 todo.py add "跨年值班表" --due 1/5
--due 需要 ISO 日期（YYYY-MM-DD），收到：'1/5'
$ echo $?
2

$ python3 todo.py add "发版说明" --due 2026-12-31
已添加 #3：发版说明  截止 2026-12-31
$ python3 todo.py rm 2
已删除 #2
$ python3 todo.py add "退掉闲置的机械键盘"
已添加 #5：退掉闲置的机械键盘    ← 计数器只增不回收

$ python3 todo.py list
#4  [ ] 跨年值班表  截止 2026-01-05
#3  [ ] 发版说明  截止 2026-12-31
#1  [ ] 重写模块 13 的首页导读
#5  [ ] 退掉闲置的机械键盘
```

修好了，但**逐条对照需求表时又暴露一条漏项**：需求 5 要求 `--file` 与环境变量都能覆盖存储路径，它只实现了环境变量。这次是命令直接报错，一点不含糊：

```console
$ python3 todo.py --file /tmp/todocli-work/aa.json list
usage: todo [-h] {add,list,done,rm} ...
todo: error: argument command: invalid choice: '/tmp/todocli-work/aa.json' (choose from 'add', 'list', 'done', 'rm')
```

这类"漏实现"是最容易被放行的缺陷：命令都在，功能都在，只是某条路径不存在。补一句短提示词就够：

```text
需求第 5 条要求 --file 与 TODO_FILE 都能覆盖存储路径，现在只有环境变量生效。
加一个全局 --file 选项，优先级高于环境变量，只改必要部分，别动其他逻辑。
```

```console
$ python3 todo.py --file /tmp/todocli-work/sbb.json add "第二条清单里的条目"
已添加 #1：第二条清单里的条目
$ python3 todo.py --file /tmp/todocli-work/sbb.json list
#1  [ ] 第二条清单里的条目
```

还有一处编者主动加的第三轮，因为它属于第一次结对最典型的"错误处理真空"：存储文件被写坏时，用户看到的应该是什么？（下面的路径是编者当时的临时目录，你跑出来会是自己的路径。）

```console
$ python3 todo.py list
Traceback (most recent call last):
  File "/private/tmp/todocli-work/todo.py", line 132, in <module>
    sys.exit(main())
  ...
json.decoder.JSONDecodeError: Expecting property name enclosed in double quotes: line 5 column 1 (char 60)
```

提示词里必须同时禁止"反向修法"，否则很可能换来一个 `except Exception: pass`：

```text
清单 JSON 解析失败时不要抛堆栈给用户，也不要吞掉异常。
要求：stderr 打印三行——哪份文件坏了、原始错误、下一步该做什么（修复它，或换路径），
然后按用法错误退出；文件内容保持原样，不要自动覆盖用户数据。
```

```console
$ python3 todo.py list
清单文件已损坏：/tmp/todocli-work/broken.json
  Expecting property name enclosed in double quotes: line 5 column 1 (char 60)
  修复它，或用 --file/TODO_FILE 指向新文件。
$ echo $?
2
```

## 第 5 步：补测试——目标是让它先红一次

```text
现在给 todo.py 补 pytest 测试，放在 test_todo.py。规则：
1. 判据只来自 REQUIREMENTS.md，不来自实现——先按需求写断言，即使实现不满足也不许改需求。
2. 每条测试对应一个真实出过问题的点：ID 不回收、--due 校验、未知 ID 的退出码、
   list 默认过滤、空清单、按截止日排序、--json 可解析、损坏文件的可读报错、--file 覆盖路径。
3. 用 tmp_path + monkeypatch 把 TODO_FILE 指到临时文件；禁止任何测试读写 ~/.todo/items.json。
4. 写完跑 `python3 -m pytest test_todo.py -v`，把完整输出贴给我。失败的那条不许通过改断言变绿。
```

第一次跑就红了，而且红得很有价值（真实输出）：

```console
$ python3 -m pytest test_todo.py -v
test_todo.py::test_add_分配的ID不被回收 PASSED
test_todo.py::test_无效的due必须被拒绝 PASSED
test_todo.py::test_done_不存在的ID返回退出码2 FAILED
...
    def test_done_不存在的ID返回退出码2(capsys):
>       assert todo.main(["done", "999"]) == 2
E       AssertionError: assert 3 == 2
----------------------------- Captured stderr call -----------------------------
未找到待办 #999
========================= 1 failed, 6 passed in 0.12s ==========================
```

需求第 4 条写的是退出码 `2`，实现返回 `3`。**这就是只有测试能抓到的那一类偏差**：命令行手工跑的时候你只看 stderr，永远注意不到数字。两种修法必须显式选一种：

- 实现不符合需求 → 改实现（本次选这条）；
- 需求本身就写错了 → 改 `REQUIREMENTS.md`，并在 commit 信息里写下为什么改判据。

**不允许的是绕过判据改断言**——那是《AI 代码的安全与质量陷阱：六大陷阱与检测清单》里"只测通过路径"那条陷阱的生成器。

接着又红了一次，这次是测试自己的写法错了（也是真实输出）：

```console
>       assert todo.main(["list"]) == 2
E       SystemExit: 2
========================= 1 failed, 7 passed in 0.67s ==========================
```

实现走 `raise SystemExit(2)`，`main()` 根本不返回值。判据（退出码 2）是对的，**错的是捕获方式**——于是把断言包进 `pytest.raises`，值一个字不改：

```python
def test_清单文件损坏时给出可读错误(db, capsys):
    db.write_text('{"next_id": 3, "items": [', "utf-8")
    with pytest.raises(SystemExit) as exc:      # 退出走 SystemExit，不是 return
        todo.main(["list"])
    assert exc.value.code == 2
    err = capsys.readouterr().err
    assert "已损坏" in err and "Traceback" not in err
```

最后九条全绿，静态检查也过（都是实跑）：

```console
$ python3 -m pytest test_todo.py -q
.........                                     [100%]
9 passed in 0.47s

$ uvx ruff check --select F,E9,BLE,S110 todo.py test_todo.py
All checks passed!
```

`F`（未定义名字）、`E9`（语法错误）、`BLE`（盲捕异常）、`S110`（`try/except/pass`）这四类正是 AI 首轮代码的高发区，把这条命令放进 pre-commit 或 CI，比在评审里口头叮嘱"注意错误处理"有效得多（见《AI 编码供应链安全：幻觉包、Slopsquatting 与沙箱防线》）。

## 第 6 步：git 存档——每个阶段一个存档点

```bash
# 存档点 1：首轮骨架 + 需求文件
git add REQUIREMENTS.md todo.py
git commit -m "feat(todo): 命令行待办清单骨架（add/list/done/rm + JSON 存储）"

# 存档点 2：第二轮修复
git commit -am "fix(todo): 稳定 ID 计数器、校验 --due 格式、损坏文件给出可读错误"

# 存档点 3：测试与文档
git add test_todo.py README.md .gitignore
git commit -m "test(todo): 按 REQUIREMENTS.md 落 9 条回归测试；docs: 用法与非目标"
```

`.gitignore` 至少三行：`__pycache__/`、`.pytest_cache/`、`*.tmp`（原子写会留下 `.json.tmp`）。README 里写清用法、存储位置、退出码约定和"非目标"——这四段是三个月后的你（以及那时接手的智能体）最需要的上下文（见《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》）。

每次提交前先看一眼 diff 的大小，这是本篇唯一要求你养成的习惯：

```bash
git diff --stat            #  staged 之外，改了什么、改了多少
git status --short
```

一轮改动超过十几个文件或几百行，就要求它拆开、分轮提交（阈值与理由见《AI 代码的安全与质量陷阱：六大陷阱与检测清单》陷阱五）。后悔时优先 `git revert <hash>`——它新增一个反向提交，历史还在；`git reset --hard` 会抹掉工作里唯一能证明"当时到底改了什么"的东西。

## 最终代码（可直接跑）

`todo.py`（141 行，只用标准库）：

```python
"""todo —— 一个不依赖第三方库的命令行待办清单。

存储：默认 ~/.todo/items.json，可用环境变量 TODO_FILE 或 --file 覆盖（便于测试与多清单）。
退出码：0 成功 / 1 未预期异常 / 2 用法错误与未找到。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date
from pathlib import Path

# 退出码约定（与需求第 4 条一致）：0 成功 / 2 用法错误与未找到
EXIT_OK, EXIT_USAGE, EXIT_NOT_FOUND = 0, 2, 2


def store() -> Path:
    return Path(os.environ.get("TODO_FILE", Path.home() / ".todo" / "items.json"))


def load() -> dict:
    p = store()
    if not p.exists():
        return {"next_id": 1, "items": []}
    try:
        data = json.loads(p.read_text("utf-8"))
    except json.JSONDecodeError as exc:
        # 第三轮：损坏文件要给出"下一步做什么"，而不是抛堆栈
        print(f"清单文件已损坏：{p}\n  {exc}\n  修复它，或用 --file/TODO_FILE 指向新文件。",
              file=sys.stderr)
        raise SystemExit(EXIT_USAGE)
    data.setdefault("next_id", 1)
    data.setdefault("items", [])
    return data


def save(data: dict) -> None:
    p = store()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf-8")
    tmp.replace(p)          # 原子写：中途崩溃不会留下半截 JSON


def parse_due(raw: str) -> str:
    try:
        return date.fromisoformat(raw).isoformat()
    except ValueError:
        print(f"--due 需要 ISO 日期（YYYY-MM-DD），收到：{raw!r}", file=sys.stderr)
        raise SystemExit(EXIT_USAGE)


def find(items: list[dict], target: int) -> list[dict]:
    return [i for i in items if i["id"] == target]


def cmd_add(args) -> int:
    data = load()
    item = {"id": data["next_id"], "text": args.text, "done": False,
            "due": parse_due(args.due) if args.due else None}
    data["next_id"] += 1            # 计数器只增不回收
    data["items"].append(item)
    save(data)
    due = f"  截止 {item['due']}" if item["due"] else ""
    print(f"已添加 #{item['id']}：{item['text']}{due}")
    return EXIT_OK


def cmd_list(args) -> int:
    data = load()
    items = data["items"] if args.all else [i for i in data["items"] if not i["done"]]
    items = sorted(items, key=lambda i: (i["due"] is None, i["due"] or "", i["id"]))
    if args.json:
        print(json.dumps(items, ensure_ascii=False))
        return EXIT_OK
    if not items:
        print("（没有待办）")
        return EXIT_OK
    for i in items:
        mark = "x" if i["done"] else " "
        due = f"  截止 {i['due']}" if i["due"] else ""
        print(f"#{i['id']:<3}[{mark}] {i['text']}{due}")
    return EXIT_OK


def cmd_done(args) -> int:
    data = load()
    hits = find(data["items"], args.id)
    if not hits:
        print(f"未找到待办 #{args.id}", file=sys.stderr)
        return EXIT_NOT_FOUND
    for i in hits:
        i["done"] = True
    save(data)
    print(f"已完成 #{args.id}")
    return EXIT_OK


def cmd_rm(args) -> int:
    data = load()
    if not find(data["items"], args.id):
        print(f"未找到待办 #{args.id}", file=sys.stderr)
        return EXIT_NOT_FOUND
    data["items"] = [i for i in data["items"] if i["id"] != args.id]
    save(data)
    print(f"已删除 #{args.id}")
    return EXIT_OK


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="todo", description="命令行待办清单")
    ap.add_argument("--file", help="清单文件路径（覆盖 TODO_FILE 环境变量）")
    sub = ap.add_subparsers(dest="command", required=True)
    p_add = sub.add_parser("add", help="新增一条")
    p_add.add_argument("text")
    p_add.add_argument("--due", help="ISO 日期 YYYY-MM-DD")
    p_add.set_defaults(func=cmd_add)
    p_list = sub.add_parser("list", help="列出未完成（默认）")
    p_list.add_argument("--all", action="store_true", help="含已完成")
    p_list.add_argument("--json", action="store_true", help="输出 JSON 供脚本消费")
    p_list.set_defaults(func=cmd_list)
    p_done = sub.add_parser("done", help="标记完成")
    p_done.add_argument("id", type=int)
    p_done.set_defaults(func=cmd_done)
    p_rm = sub.add_parser("rm", help="删除")
    p_rm.add_argument("id", type=int)
    p_rm.set_defaults(func=cmd_rm)
    return ap


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.file:                      # --file 优先于环境变量
        os.environ["TODO_FILE"] = args.file
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
```

`test_todo.py`（97 行，9 条）：

```python
"""todo 的回归测试：每条都对应首轮验收里真实出过问题的地方"""
from __future__ import annotations

import json

import pytest

import todo


@pytest.fixture(autouse=True)
def db(tmp_path, monkeypatch):
    """把存储指到临时文件，避免测试污染 ~/.todo/items.json"""
    path = tmp_path / "items.json"
    monkeypatch.setenv("TODO_FILE", str(path))
    return path


def stored(db):
    return json.loads(db.read_text("utf-8"))


def test_add_分配的ID不被回收(db):
    todo.main(["add", "a"])
    todo.main(["add", "b"])
    todo.main(["rm", "2"])
    todo.main(["add", "c"])
    assert [i["id"] for i in stored(db)["items"]] == [1, 3]
    assert stored(db)["next_id"] == 4


def test_无效的due必须被拒绝(db):
    with pytest.raises(SystemExit) as exc:
        todo.main(["add", "x", "--due", "1/5"])
    assert exc.value.code == 2
    assert not db.exists()


def test_done_不存在的ID返回退出码2(capsys):
    assert todo.main(["done", "999"]) == 2
    assert "未找到" in capsys.readouterr().err


def test_list_默认只显示未完成(db, capsys):
    todo.main(["add", "a"])
    todo.main(["add", "b"])
    capsys.readouterr()
    todo.main(["done", "1"])
    capsys.readouterr()
    todo.main(["list"])
    out = capsys.readouterr().out
    assert "#2" in out and "#1" not in out
    todo.main(["list", "--all"])
    assert "#1" in capsys.readouterr().out


def test_空清单不是错误(capsys):
    capsys.readouterr()
    assert todo.main(["list"]) == 0
    assert "没有待办" in capsys.readouterr().out


def test_按截止日升序且无截止日排在最后(capsys):
    todo.main(["add", "晚", "--due", "2026-12-31"])
    todo.main(["add", "无截止"])
    todo.main(["add", "早", "--due", "2026-01-05"])
    capsys.readouterr()
    todo.main(["list"])
    lines = capsys.readouterr().out.splitlines()
    assert ["早", "晚", "无截止"] == [line.split("]")[1].strip().split("  ")[0] for line in lines]


def test_json输出可被下游脚本解析(db, capsys):
    todo.main(["add", "a", "--due", "2026-01-05"])
    capsys.readouterr()
    todo.main(["list", "--json"])
    rows = json.loads(capsys.readouterr().out)
    assert rows == [{"id": 1, "text": "a", "done": False, "due": "2026-01-05"}]


def test_清单文件损坏时给出可读错误(db, capsys):
    db.write_text('{"next_id": 3, "items": [', "utf-8")
    with pytest.raises(SystemExit) as exc:      # 退出走 SystemExit，不是 return
        todo.main(["list"])
    assert exc.value.code == 2
    err = capsys.readouterr().err
    assert "已损坏" in err and "Traceback" not in err


def test_file选项切换清单文件(tmp_path, capsys):
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    todo.main(["--file", str(a), "add", "只在 A"])
    todo.main(["--file", str(b), "add", "只在 B"])
    capsys.readouterr()
    todo.main(["--file", str(a), "list"])
    out = capsys.readouterr().out
    assert "只在 A" in out and "只在 B" not in out
```

跑法与最终一次完整验收（真实输出）：

```bash
python3 -m pip install pytest        # 本机已装则跳过（macOS Homebrew Python 需 --user 或虚拟环境）
export TODO_FILE=~/tmp/todo-cli/demo.json
python3 todo.py add "重写模块 13 的首页导读"
python3 todo.py add "给 CI 加 ruff 闸门" --due 2026-09-26
python3 todo.py add "写周报" --due 2026-09-21
python3 todo.py list
python3 todo.py done 3
python3 todo.py list --all --json | python3 -m json.tool
python3 -m pytest test_todo.py -q
```

```console
已添加 #1：重写模块 13 的首页导读
已添加 #2：给 CI 加 ruff 闸门  截止 2026-09-26
已添加 #3：写周报  截止 2026-09-21
#3  [ ] 写周报  截止 2026-09-21
#2  [ ] 给 CI 加 ruff 闸门  截止 2026-09-26
#1  [ ] 重写模块 13 的首页导读
已完成 #3
#2  [ ] 给 CI 加 ruff 闸门  截止 2026-09-26
#1  [ ] 重写模块 13 的首页导读
```

## 常见坑：本次实操真实踩到的八条

1. **让 AI"自己验证"不等于你验收。** 首轮它跑通的是 `add`/`list` 两条最顺的路径，三个缺陷全在没跑过的路径上。判据是命令 + 期望输出，不是它的自述。
2. **`len(items)+1` 分配 ID**：没有删除操作时永远正确，删一条就撞号。让 ID 来自一个只增的计数器。
3. **格式不校验**：`--due 1/5` 被静默收下，比报错危险得多，因为它会长期留在数据里。
4. **日期按字符串排序**：`1/5` 排在 `2026-12-31` 前面。要么规范化成 ISO，要么显式 `date` 对象。
5. **退出码与异常混用**：需求写 2、实现给 3；`raise SystemExit` 和 `return` 两种风格混在一起会让测试写法也要跟着变。约定写进文件头注释，并让测试断言它。
6. **错误处理两个方向都会错**：抛堆栈给用户是错，`except Exception: pass` 把故障咽下去也是错（后者更隐蔽）。
7. **漏实现最难发现**：`--file` 整条需求没做，代码看起来仍然完整。逐条对照需求表是唯一对策。
8. **参数不加引号**：`todo.py add 买 牛奶 鸡蛋` 会被 argparse 拒掉——`todo: error: unrecognized arguments: 牛奶 鸡蛋`。写 README 时记得给带空格的例子加引号。

## 循环跑通之后，四拍分别往哪里加固

- **需求**：`REQUIREMENTS.md` 升级成规格与计划文件，走 `spec → plan → tasks → implement`（《Spec 驱动开发（Spec-Driven Development）》；完整工作流原文见《我的 LLM 代码生成工作流（Harper Reed 名篇全文翻译）》）。
- **生成**：落盘前先审查改动，用计划模式；重复出现的流程沉淀成技能（《Claude Code 工作流与最佳实践》《Claude Skills：可复用技能包》《驾驭 Claude Code：CLAUDE.md、rules、skills、hooks 与子智能体的使用时机（Anthropic 官方博客全文翻译）》）。
- **验收**：把本篇手工跑的判据变成钩子与自动评审（《AI 结对与代码审查》《TDD with AI：Kent Beck 的增强编程实践》《调试 with AI：让 AI 定位 Bug 的工作流》《重构 with AI：从日常重构到百万行迁移的上下文策略》）。
- **存档**：多任务并行时用 worktree 隔离，提交纪律与回滚策略（《Git in AI 工作流：commit 即存档、worktree 隔离与审查流》）；进一步无人值守见《Headless 与 CI 中的 AI 编码：Headless、Agent SDK 与 Copilot 云端智能体》。

## 延伸阅读

- 《环境搭建：Claude Code 与 Cursor 的安装与配置矩阵》——安装、登录、凭据与配置文件分层
- 《Claude Code 权限系统与安全机制》——本篇没展开的权限模式、沙箱与钩子拦截
- 《AI 代码的安全与质量陷阱：六大陷阱与检测清单》——本篇八条坑的系统化版本与检测命令
- 《Git in AI 工作流：commit 即存档、worktree 隔离与审查流》——存档点、并行会话与回滚
- 《TDD with AI：Kent Beck 的增强编程实践》——测试先行时如何防止智能体改测试
- 《从 0 到 1 用 AI 做产品：未来属于能直接动手的人》——把这条四拍循环用在一个真产品上

---

> **来源**：抓取于 2026-09-19。本篇为本站编者依据一手实操记录整理的教程，非译文：循环骨架与若干提示词模式参考 Claude Code 官方文档 [Common workflows](https://code.claude.com/docs/en/common-workflows) 与 [Best practices](https://code.claude.com/docs/en/best-practices)（作者 Anthropic，Copyright Anthropic PBC，教学用途署名引用，本文未整段翻译官方页面）。文中 `todo.py`、`test_todo.py` 全部代码，以及所有 `console` 块中的命令与输出，均由编者在 macOS（Python 3.14.6、pytest 9.0.3、ruff 经 uvx 临时安装）实测记录，未虚构；会话中助手的自然语言回复每轮措辞不同，故本文只收录可复现的命令与输出。需求表中的判据与"非目标"为编者设定。文中阈值与纪律为本站编者建议，使用前请在自有仓库验证。
