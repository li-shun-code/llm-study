---
title: Agent Skills：用文件夹给智能体装上可复用的专业能力
source_url: https://github.com/agentskills/agentskills
author: agentskills 社区（规范由 Anthropic 首创并开放）、Anthropic（anthropics/skills 示例仓库）
license: Apache 2.0（agentskills/agentskills 仓库 LICENSE 为 Apache-2.0；anthropics/skills 中文档类 Skill 为 source-available，本篇未译其正文）
fetched_at: 2026-09-19
translated: true
versions: Agent Skills 规范（agentskills.io）；skills-ref 0.1.1（PyPI，CLI 命令名 agentskills）
order: 9
group: 工具与协议
---
## 为什么需要 Skill：智能体缺的往往不是能力，而是"你这里怎么做"

《LLM 驱动的自主智能体（Agent）全景：规划、记忆与工具使用》把 Agent 拆成"规划 + 记忆 + 工具"三件套；《Tool Use 实战：工具的定义、注入与调用》和《MCP 协议详解：架构、分层与核心原语（2026-07-28 版规范）》解决了"怎么把手和脚接到外部系统"。但把智能体放进真实工作里，最先崩掉的通常不是连接，而是**它不知道你的做法**：

- 你的报表要用公司模板的第 3 版口径，`users` 表是软删除、查询必须带 `WHERE deleted_at IS NULL`；
- 你们的应急预案规定"先降级消息队列再重启消费者"，顺序反了就是事故；
- 同一个字段在库里叫 `user_id`、在鉴权服务叫 `uid`、在计费 API 叫 `accountId`。

这些知识模型在预训练里学不到（它们是你的私有约定），写进系统提示词又太贵：每次对话、每个任务都要占用上下文，而其中绝大多数与当前任务无关。Agent Skills 给出的答案是**按需加载的文件夹**——把"某类任务该怎么做"打包成一份 `SKILL.md`（可选地附带脚本、参考文档、模板），智能体平时只在上下文里保留它的名字和一句话描述，任务匹配时才把正文读进来。

按官方定义：

> Agent Skills are a lightweight, open format for extending AI agent capabilities with specialized knowledge and workflows.（Agent Skills 是一种轻量的开放格式，用专门知识与工作流来扩展 AI 智能体的能力。）

这个格式由 Anthropic 首创、随后作为开放标准发布，现已被大量智能体产品采纳（VS Code + Copilot、Claude Code、各类 CLI 编码智能体等）。它与"给编码助手写的技能包"是同一套机制，本篇讲**通用机制本身**；编码场景下的现成 Skills 生态，见《Claude Skills：可复用技能包》与《开源编码 Skills（一）：Superpowers 编码流程族》，两不重复。

## 一、Skill 的结构：一个文件夹，一个必需的 SKILL.md

规范规定的目录形态（`scripts/`、`references/`、`assets/` 都是可选的）：

```text
skill-name/
├── SKILL.md          # 必需：YAML frontmatter（元数据）+ Markdown 正文（指令）
├── scripts/          # 可选：智能体可执行的代码
├── references/       # 可选：需要时才读的文档
├── assets/           # 可选：模板、图片、数据文件
└── ...               # 其他任意文件/目录
```

`SKILL.md` = YAML frontmatter + Markdown 正文。frontmatter 的字段与硬约束（规范原文整理）：

| 字段 | 必需 | 约束与语义 |
| --- | --- | --- |
| `name` | 是 | ≤64 字符；只允许小写字母、数字、连字符；不以 `-` 开头/结尾、不含 `--`；**必须与所在目录名一致** |
| `description` | 是 | 1–1024 字符，非空；同时说明"做什么"和"什么时候用"，要带上能帮助匹配的关键词 |
| `license` | 否 | 许可证名，或指向包内 license 文件 |
| `compatibility` | 否 | ≤500 字符；只在确有环境要求时写（目标产品、系统依赖、网络访问） |
| `metadata` | 否 | 字符串键值映射，存放规范未定义的额外属性（建议键名带命名空间以免冲突） |
| `allowed-tools` | 否 | 空格分隔的"预批准工具"列表，形如 `Bash(git:*) Read`。**实验字段，各实现支持度不一** |

正文没有格式限制。规范推荐包含：分步指令、输入输出示例、边界情况。并提醒：一旦激活，智能体读的是**整个文件**，所以"500 行以内、5000 token 以内"，细节挪到 `references/`。

一个合规的最小 Skill（复制即用，`name` 与目录名一致）：

````markdown
---
name: pdf-processing
description: Extracts text and tables from PDF files, fills PDF forms, and
  merges multiple PDFs. Use when working with PDF documents or when the user
  mentions PDFs, forms, or document extraction.
license: Apache-2.0
compatibility: Requires Python 3.11+ and pdfplumber
metadata:
  author: example-org
  version: "1.0"
---

# PDF Processing

## Extract PDF text
Use pdfplumber for text extraction:

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.

## Gotchas
- `page.extract_text()` returns None for image-only pages — fall back to OCR.
- Form fields must be read via `pdf.form_fields` before filling; index by name, not order.
````

注意 `description` 的写法：规范直接给出好坏对照——`"Helps with PDFs."` 是坏例子，因为它没告诉智能体**何时**该激活。激活全靠模型对这句话的匹配判断，描述即路由。

## 二、加载机制：三级渐进披露

Skills 的一切设计都围绕一个词：**progressive disclosure（渐进披露）**。规范把加载分三级：

| 级别 | 载入内容 | 时机 | 成本 |
| --- | --- | --- | --- |
| 1 Catalog（目录） | 每个 Skill 的 `name` + `description` | 会话启动 | 约 50–100 token / 个 |
| 2 Instructions（指令） | `SKILL.md` 全文正文 | 判定相关、激活时 | 建议 5000 token 以内 |
| 3 Resources（资源） | `scripts/`、`references/`、`assets/` 里的文件 | 正文引用到时 | 视文件而定 |

```text
        会话启动                任务匹配                需要细节
扫描目录 ─────────► 目录卡片 ─────────► 读入 SKILL.md 正文 ─────────► 按需读脚本/参考文件
（只留 name/description）   （~50-100 token/个）  （整篇进上下文）        （tier 3，逐个加载）
```

装了 20 个 Skill，启动时付出的只是 20 张卡片，而不是 20 份完整指令。这与《长时运行 Agent 的上下文管理：压缩（Compaction）》讨论的是同一个约束——上下文窗口是稀缺资源，区别在于压缩处理"已经装进去的东西"，渐进披露处理"要不要装进来"。

把这套机制串起来的是五个环节（这是实现方的视角，读懂它你才知道 Skill 为什么会"不生效"）：

**1. 发现（Discover）。** 在两个作用域里扫描技能目录：项目级（相对工作目录）与用户级（相对家目录）。规范本身不规定技能放哪，但生态收敛出了一个跨客户端的公共约定 `.agents/skills/`：

```text
<project>/.<client>/skills/     # 某客户端自己的原生位置
<project>/.agents/skills/       # 跨客户端互操作位置（推荐）
~/.<client>/skills/             # 用户级：该用户所有项目可用
~/.agents/skills/               # 用户级跨客户端约定
```

扫描目标是"包含名为 `SKILL.md` 文件的子目录"，实践中要跳过 `.git/`、`node_modules/`，并设深度与目录数上限（文档给的量级是深度 4–6、最多约 2000 个目录），否则会在大仓里失控。

**2. 解析与校验。** 提取 frontmatter，**宽松校验**：不合规就跳过并记日志，绝不该因为某个 Skill 写坏了就让整个会话失败。两个细节值得背下来：YAML 里含冒号的描述必须加引号；同名 Skill 的优先级是通用的**项目级覆盖用户级**，同作用域内 then 保持一致即可，但要打日志告知被遮蔽了。

**3. 披露（Disclose）。** 把卡片喂给模型。常见两种做法：作为 system prompt 的一个带标签小节，或嵌进一个"激活工具"的描述里。产物形态就是 `skills-ref` 生成器输出的那段 XML：

```xml
<available_skills>
  <skill>
    <name>pdf-processing</name>
    <description>Extract PDF text, fill forms, merge files. Use when handling PDFs.</description>
    <location>/home/user/.agents/skills/pdf-processing/SKILL.md</location>
  </skill>
</available_skills>
```

`location` 有两个用途：让模型能"读文件激活"，以及让正文里的相对路径（`scripts/extract.py`）有解析基准。没有技能时，**整段目录和行为指令都不要输出**——给模型一个空的 `<available_skills/>` 或一个没有合法选项的工具，只会诱导它空转。被用户禁用、权限拒绝、显式声明不接受模型主动激活的技能，应当从目录里**整条隐藏**，而不是列出来再在激活时拒绝。

**4. 激活（Activate）。** 主流实现靠模型自己判断（而不是 harness 端做关键词匹配），两种落地方式：**文件读激活**（模型用自己的通用 read 工具去读 catalog 里的路径，零额外基建）与**专用工具激活**（注册 `activate_skill(name)`，返回正文）。后者能多做几件事：过滤 frontmatter、把内容包进可识别的标签、顺带列出随包资源、做权限确认与激活埋点。用了专用工具就把 `name` 参数约束成合法枚举，避免模型编造不存在的技能名。用户侧还应保留显式入口（`/skill-name` 这类斜杠命令由 harness 直接注入，不依赖模型决策）。

**5. 随时间的上下文管理。** 这一点最容易被忽略：技能正文是**长期行为约束**，如果实现会在窗口吃紧时裁剪/摘要早期消息，请把 Skill 内容标记为受保护。否则会出现"模型继续正常干活，但那个技能已经不在它的上下文里了"这种无声退化。另外，同一会话里已激活过的技能要去重，不必重复注入。

## 三、动手：写一个、校验一个、喂给模型一个

### 1. 建目录与文件

```bash
mkdir -p .agents/skills/pdf-processing/scripts .agents/skills/pdf-processing/references
# 把上一节的 SKILL.md 内容存到 .agents/skills/pdf-processing/SKILL.md
```

### 2. 用官方参考实现校验（PyPI 包名 `skills-ref`）

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install skills-ref
```

CLI 提供三个子命令（**注意：0.1.1 装出来的可执行文件叫 `agentskills`，仓库 README 里写的 `skills-ref` 是旧名**）：

```bash
agentskills validate .agents/skills/pdf-processing
agentskills read-properties .agents/skills/pdf-processing
agentskills to-prompt .agents/skills/pdf-processing
```

`validate` 通过时的输出与失败时的报错都是机器可读的：

```text
Valid skill: .agents/skills/pdf-processing
```

把 `name` 改成 `bad--name` 并放在 `Bad_Name/` 目录下，会得到：

```text
Validation failed for .agents/skills/Bad_Name:
  - Skill name cannot contain consecutive hyphens
  - Directory name 'Bad_Name' must match skill name 'bad--name'
```

漏写 `description` 时，前两条换成 `- Missing required field in frontmatter: description`。把这三条报错当成 lint 规则跑在 CI 里，比事后在对话里发现"技能怎么没加载"便宜得多。

### 3. 一个 60 行的最小加载器：自己实现一遍机制

想真正理解"目录 → 激活 → 注入"，最好的办法是自己写一遍。下面这段用官方参考库做解析，不依赖任何厂商 SDK；把它存成 `mini_skill_host.py`，`python mini_skill_host.py "把这份 PDF 的表单字段列出来"` 就能看到决策过程（`--dry-run` 不需要 API Key）：

```python
"""最小 Skill 宿主：发现 → 披露 → 让模型选 → 注入正文 → 执行。"""
import argparse, json, os, sys
from pathlib import Path

from openai import OpenAI
from skills_ref import read_properties, validate   # pip install skills-ref openai


def discover(root: Path) -> list[Path]:
    """在项目级 .agents/skills/ 与用户级 ~/.agents/skills/ 里找含 SKILL.md 的目录。"""
    found: dict[str, Path] = {}
    for base in (root / ".agents/skills", Path.home() / ".agents/skills"):
        if not base.is_dir():
            continue
        for skill_md in sorted(base.glob("*/SKILL.md")):          # 只看一层子目录
            skill_dir = skill_md.parent
            if validate(skill_dir):                                 # 有错误就跳过，宽松失败
                continue
            props = read_properties(skill_dir)
            found.setdefault(props.name, skill_dir)                 # 项目级覆盖用户级
    return list(found.values())


def catalog_block(skills: list[Path]) -> str:
    rows = []
    for d in skills:
        p = read_properties(d)
        rows.append(f"<skill>\n  <name>{p.name}</name>\n"
                    f"  <description>{p.description}</description>\n"
                    f"  <location>{d / 'SKILL.md'}</location>\n</skill>")
    return ("<available_skills>\n" + "\n".join(rows) + "\n</available_skills>\n\n"
            "若某个技能与任务匹配，读取其 location 指向的 SKILL.md 正文并按其执行；"
            "正文中的相对路径以该文件所在目录为基准。"
            "现在请从上述技能中选一个最贴合任务的，只输出一个 JSON 对象："
            '{"skill": "<技能名或 null>"}')


def activate(skill_dir: Path) -> str:
    """激活：返回正文（去掉 frontmatter），并列出随包资源供按需加载。"""
    text = (skill_dir / "SKILL.md").read_text(encoding="utf-8")
    body = text.split("---", 2)[2].lstrip()
    resources = [str(p.relative_to(skill_dir)) for p in skill_dir.rglob("*")
                 if p.is_file() and p.name != "SKILL.md"]
    wrapped = [f'<skill_content name="{skill_dir.name}">', body]
    if resources:
        wrapped.append("随包资源（需要时再用 read 工具加载）：\n" + "\n".join(resources))
    wrapped.append("</skill_content>")
    return "\n".join(wrapped)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("task")
    ap.add_argument("--dry-run", action="store_true", help="只看目录与选择结果，不调模型")
    args = ap.parse_args()

    skills = discover(Path.cwd())
    if not skills:
        sys.exit("未发现任何技能（检查 .agents/skills/<name>/SKILL.md）")
    print(f"[发现] {len(skills)} 个技能：" + ", ".join(s.name for s in skills))
    by_name = {read_properties(s).name: s for s in skills}

    if args.dry_run:
        print(catalog_block(skills))
        return

    client = OpenAI()                       # OPENAI_API_KEY 走环境变量
    choice = client.chat.completions.create(
        model="gpt-5.6-luna",
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": catalog_block(skills)},
                  {"role": "user", "content": args.task}],
    )
    picked = json.loads(choice.choices[0].message.content).get("skill")
    print(f"[选择] {picked or '不使用技能'}")
    messages = [{"role": "user", "content": args.task}]
    if picked in by_name:
        messages.insert(0, {"role": "system", "content": activate(by_name[picked])})
    answer = client.chat.completions.create(model="gpt-5.6-luna", messages=messages)
    print("[回答]", answer.choices[0].message.content)


if __name__ == "__main__":
    main()
```

这个练习暴露了三件在文档里容易被滑过去的事：**(1)** 披露阶段真的只有 50–100 token/个；**(2)** "激活"就是一段字符串拼接，任何框架都能做，不需要厂商 SDK；**(3)** 决定命中率的是 `description`，不是正文写得多好——把 `--dry-run` 的输出打出来，你就明白模型看到的只是一张卡片。

### 4. 在现成客户端里用

- **Claude Code**：把官方示例仓库注册成插件市场 `/plugin marketplace add anthropics/skills`，再 `Browse and install plugins` → `document-skills` / `example-skills`；或者直接 `/plugin install example-skills@anthropic-agent-skills`。装完只要在对话里提到它（"用 PDF skill 从 `x.pdf` 里抽取表单字段"）即可。
- **VS Code + Copilot**：技能放 `<project>/.agents/skills/`，在 Agent 模式里输 `/skills` 确认它出现在列表中（不在就是路径/文件名的字母大小写或 frontmatter 出错了），然后问"Roll a d20"这类命中描述的问题。
- **API**：Anthropic 提供 Skills API，可上传自定义 Skill 包、引用官方预置 Skill；适合把技能作为服务端能力发布而不是散落本地目录。
- **其他生态**：Microsoft Agent Framework 把 "Agent Skills" 列为特性（多来源构建领域知识库供智能体发现，见《AutoGen 与 CrewAI：多智能体框架现状（AutoGen 已并入 Microsoft Agent Framework）》）；开源浏览器 Agent browser-use 在其 `Agent` 上直接暴露 `skill_ids=[...]`/`skills=[...]` 参数、内部由 `SkillService(skill_ids=..., api_key=...)` 加载远端技能——**"文件夹 + 按需加载"这套机制正在跨框架外溢，而不只属于某个编码助手**。

## 四、和 MCP、工具调用的分工

三者不是竞争关系，而是**互补的三层**。这张表建议贴在工位上：

| 维度 | 工具调用（Function Calling） | MCP | Agent Skills |
| --- | --- | --- | --- |
| 解决的问题 | 模型怎么把意图变成一次结构化调用 | 客户端怎么发现并连接外部系统/工具/数据 | 这类任务**在你们这儿该怎么做** |
| 交付物 | 函数 schema + 代码 | 服务器（tools/resources/prompts） | 文件夹（指令 + 脚本 + 资源） |
| 进入上下文的方式 | 工具 schema 常驻 | 工具列表常驻（列举开销） | 只有 name/description 常驻，正文按需 |
| 变更成本 | 改代码、发版 | 部署/升级服务器 | 改一个 Markdown 文件，git diff 即审计 |
| 谁执行 | 你的应用 | MCP 服务器 | 智能体自己（照指令做，或跑随包脚本） |
| 典型内容 | `query_db(sql)`、`send_email(...)` | 数据库、Sentry、文件系统、浏览器 | 报表口径、迁移 SOP、审查清单、品牌模板 |

一个真实任务往往三层齐活：**Skill 提供"做法与坑"，MCP 提供"连接"，工具调用提供"动作"**。比如"给这位客户出一张季度用量报告"：`reporting-skill/SKILL.md` 规定口径、图表规范和必须核对的三个例外；MCP 的数据库服务器提供 `query_db`；最终执行仍是一次函数调用。

该用哪个的判据也很朴素：

- 需要**触达外部系统**、要鉴权、要跨进程复用 → MCP（细节见《MCP 协议详解：架构、分层与核心原语（2026-07-28 版规范）》与《Function Calling vs MCP：两代工具接入方式如何取舍》）。
- 需要**约束过程与判断**（口径、顺序、命名、验收标准） → Skill。
- 只是想少写点提示词、而且模型本来就具备该知识 → 都不用，直接问（Skill 指南原话：每一步都问自己"没有这句它会不会做错"，不会就删）。

反过来，把"确定性计算"塞进 Skill 的正文让模型每次手算是常见误用：`references/` 里放一份口径说明、`scripts/` 里放一个 `compute.py`，让模型跑脚本——规范明确鼓励"把复杂又容易写错的一次性命令沉淀成测试过的脚本"。

## 五、什么时候该写一个 Skill

值得写的信号（任意两条成立就动手）：

1. 你已经在**不同会话里第三次**向智能体解释同一件事（同一套字段映射、同一条发布顺序、同一份报告结构）；
2. 这件事**跨产品**：希望编码助手、研究 Agent、客服 Agent 都能用同一份口径；
3. 它是**流程 + 判断**，而不是一次动作——纯一次动作应该做成工具或接 MCP；
4. 它有**版本与责任**：写进仓库、能被 review、能回滚，出错能追溯到某次 diff；
5. 它能从真实材料里长出来：runbook、事故复盘、代码评审意见、git 历史里的修补记录。

不该写的情况同样明确：模型不给提示也能做对（无收益，纯占目录与 token）；只有你个人一次性的偏好（那是提示词/偏好记忆的事）；内容其实是"访问某个系统"（那是 MCP）；范围大到一个 Skill 要覆盖"数据工程的一切"（粒度过宽会导致描述写不准、激活率下降）。

规范对粒度的建议可以照抄进设计评审：**"技能覆盖什么范围，跟设计函数一样——它应当封装一个自洽的工作单元，并能与其他技能良好组合。"** 只做一半（要三个技能凑一次任务）会带来指令冲突；什么都管（查库 + 建库 + 运维）则激活不精准。

写法上的四条硬要求（官方最佳实践整理，每一条都对应一种失败模式）：

- **从真实经验来，别让 LLM 凭空生成**。凭空生成的结果是"妥善处理错误""遵循鉴权最佳实践"这类正确的废话。要么先和智能体真跑一遍任务、把你给的纠偏和偏好抽出来；要么喂真实材料（runbook、schema、评审意见）去合成。
- **给默认值，不要给菜单**。"用 pdfplumber；扫描件 OCR 才换 pdf2image"远好于罗列四个库让它挑。
- **匹配脆弱度决定规定强度**。顺序不能变的操作给**逐字命令**（"运行 `python scripts/migrate.py --verify --backup`，不要增删参数"）；开放判断的任务写"看什么"并解释**为什么**，模型在理解目的时做得更好。
- **最高价值的一段往往是 Gotchas**。环境里那些"违反常理的事实"（软删除、三个名字同一个 ID、`/health` 只探测进程不探测数据库）——每次你不得不纠正模型，就把纠正写进这一节，这是迭代 Skill 最直接的路径。另外三种可复用结构：输出给**模板**而不是散文描述、多步流程给**检查清单**、破坏性操作给**计划-校验-执行**（先产出 `field_values.json`，跑校验脚本，通过了才落地）。

## 常见坑

1. **`name` 与目录名不一致 / 含大写或连续连字符**：轻则客户端扫不到，重则直接被校验拒绝。用 `agentskills validate` 当 lint。
2. **`description` 只写"做什么"没写"什么时候用"**：激活率骤降。描述里要带用户真会说出口的关键词（文件类型、系统名、动词短语）。
3. **正文里用绝对路径或深层嵌套引用**：规范明确要求**相对路径从技能根解析**，且引用层级**只往下指一层**；正文里最好同时给出技能目录位置，宿主实现通常会在激活结果里补这句。
4. **把 `SKILL.md` 写成百科全书**：超过 500 行 / 5000 token，模型抓不住重点，还会被用不到的分支带偏。细节挪去 `references/`，并写清**何时**读（"API 返回非 200 时才读 `references/errors.md`"），只写"见 references/"等于没写。
5. **`allowed-tools` 当安全边界用**：它是实验字段，跨实现支持度不一致；真正的授权必须由宿主的权限系统兜（另见《Agent 安全与权限、生产化部署与成本管理》）。
6. **技能被上下文压缩裁掉了**：宿主做截断/摘要时要把已激活的技能正文标记为受保护，否则表现为"模型照常干活但已不遵守你们的口径"，且没有任何报错。
7. **项目级技能来自不可信仓库**：一个刚 clone 的开源项目可以往 `.agents/skills/` 里塞任意指令。宿主应当在用户信任该目录之前不加载项目级技能；你手工装技能时也要像审依赖一样审它的正文和脚本。
8. **沙箱/云端 Agent 看不到你的本地技能**：容器里没有你的家目录。项目级技能随仓库走最容易；用户级与组织级要靠 provisioning（配置仓、技能 URL、上传），内置技能则打进发布物。
9. **以为"装了技能就等于做对了"**：技能只在模型真的读取并遵循时起效。同一模型对指令的服从度差别很大——把 10–20 条真实任务跑一遍、读执行轨迹而不只看最终答案（浪费步骤通常来自指令太泛、不适用却被照做、选项过多无默认），这比再补三百行正文有效。评测做法见《Agent 评测：数据集、评估器与 LLM-as-Judge 实战》。

## 延伸阅读

- 规范与文档：[Agent Skills Specification](https://agentskills.io/specification)、[Best practices for skill creators](https://github.com/agentskills/agentskills/blob/main/docs/skill-creation/best-practices.mdx)、[Adding skills support](https://github.com/agentskills/agentskills/blob/main/docs/client-implementation/adding-skills-support.mdx)（宿主实现指南）。
- 参考实现与示例：[agentskills/agentskills](https://github.com/agentskills/agentskills)（含 `skills-ref` 校验器）、[anthropics/skills](https://github.com/anthropics/skills)（含官方文档类 Skill 源码）。
- 站内：编码向的技能包生态见《Claude Skills：可复用技能包》；项目级指令文件与技能的边界见《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》；连接层见《MCP 协议详解：架构、分层与核心原语（2026-07-28 版规范）》；上下文预算见《长时运行 Agent 的上下文管理：压缩（Compaction）》。

---

> **来源**：抓取于 2026-09-19。译自/整理自 [agentskills/agentskills](https://github.com/agentskills/agentskills) 仓库中的规范页与《Best practices for skill creators》《Using scripts in skills》《Adding skills support to your agent》《Quickstart》四篇文档（agentskills 社区，Apache 2.0），并参考 [anthropics/skills](https://github.com/anthropics/skills) README 与模板（Anthropic；示例技能多为 Apache 2.0，文档类技能为 source-available，本篇未使用其正文）。
> **编者注**：第三节 CLI 与校验器的三组输出（`Valid skill: …`、两条 `Validation failed …`、`<available_skills>` 目录片段）与最小加载器的字段用法，均来自本机安装 `skills-ref` 0.1.1 后真实执行的结果；该版本入口命令为 `agentskills`，仓库 README 中的 `skills-ref` 为旧称。browser-use 的 `skill_ids` 接口取自其 0.13.10 版包源码，非二手转述。规范正文未涵盖的选型建议与"该写/不该写"判据为编者整理，观点出处已在对应小节标注。
