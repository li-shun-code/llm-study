---
title: AI 代码的安全与质量陷阱：六大陷阱与检测清单
source_url: https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
author: Simon Willison（lethal trifecta 与事件复盘主篇）；OWASP GenAI Security Project；Anthropic；METR；Veracode（清单依据，逐节署名）
license: 署名转载/署名翻译（Willison 部分为作者博客署名翻译转载；OWASP 为 CC BY-SA 4.0；其余为公开研究材料节选引述；逐节署名）
fetched_at: 2026-09-19
translated: true
order: 7
group: 安全、供应链与合规
---
## 为什么需要这份清单

AI 编码的风险不是"代码跑不起来"——跑不起来的代码活不过 CI。真正的风险是**看起来完全正常、实际有毛病**的代码顺利合并进主干。Anthropic 自己的测量把这层落差摆得很清楚：模型生成代码的**语法正确率已超过 95%**，而同一批代码的**安全通过率长期停在 55% 左右**（Veracode《Spring 2026 GenAI Code Security Update》，2026-03-24）。两者之间那 40 个百分点，就是这份清单要盯的东西。

规模在放大同一个问题。Anthropic 官方工程博客（2026-09-14）披露：工程师人均每季度产出的代码量是 2021—2025 年间的约 8 倍，其中 80% 由 Claude 撰写，六个月内 CI 任务量增长 25 倍。产量翻八倍而审查带宽不变时，靠"感觉"已经兜不住，只能靠**可机械执行的动作**。

**用法**：把本文当成合并前的过一遍清单，而不是通读一次的散文。每一节固定三段——**症状**（你在 diff 里看到什么）、**真实案例与数据**（谁栽过、多严重）、**检测手段**（可直接复制的命令/规则）。最后一节是权限侧的通用风险框架（lethal trifecta 与 OWASP GenAI 清单），再附一节事件复盘作为"最坏情况"参照。

## 陷阱一：幻觉 API 与不存在的依赖

**症状**：调用了库里根本没有的方法/参数（`requests.get(..., timeout_factor=...)`）；`import` 一个注册表里不存在的包；用了已废弃却"看起来更现代"的写法；给出不存在的配置键（`pyproject.toml` 里编一个字段名）。

**真实案例与数据**：Spracklen 等人在 USENIX Security 2025 的《We Have a Package for You!》对 16 个代码生成模型系统测量，发现**近五分之一（19.7%）的推荐包名不存在**，累计产生 **205,000 个以上唯一幻觉包名**。Lasso Security 的 Bar Lanyado 把 LLM 反复幻觉出的 `pip install huggingface-cli`（正确写法是 `huggingface[cli]`）作为无害测试包发到 PyPI，三个月内被真实下载约 **30,000 次**。这些数字意味着：幻觉依赖不是"可能踩坑"，而是**已经在被大规模安装**，而注册即有流量正是 slopsquatting 攻击的商业模式（机制详见《AI 编码供应链安全：幻觉包、Slopsquatting 与沙箱防线》）。

**检测手段**：

```bash
# 装之前先问注册表：包在不在、谁维护、下载量与最近版本时间
pip index versions orjson                      # PyPI 是否存在该包
npm view dayjs version maintainers             # npm 元数据（维护者是不是官方）
cargo search serde --limit 1                   # crates.io

# 别"顺手装一个"：先看解析结果，不落地
uv pip install --dry-run "orjson==3.10.12"
pip download --no-deps --dest /tmp/chk orjson

# 幻觉 API 用类型/静态检查当场抓出来
uvx pyright --outputjson src/                 # 未定义属性、错误参数名
uv run mypy --strict .                        # 缺失导入按错误处理
uvx ruff check --select F,E9,BLE,S .          # F821 未定义名字、BLE001 盲捕异常、S110 try-except-pass
```

再加一条约定：**任何新增依赖必须在 PR 描述里写"为什么不用已有依赖"**，并把"新增依赖"作为触发人工评审的标签（GitHub 可用 `CODEOWNERS` + `dependabot` 双闸门）。

## 陷阱二：静默吞错误与未声明的假设

**症状**：`except Exception: pass`、空 `catch` 块、把异常只写成日志然后返回默认值、用 `?? {}` / `|| []` 兜住真实故障、HTTP 客户端不检查状态码直接解析 JSON。

**真实案例与数据**：这不是"AI 坏习惯"，而是**提示词不完整的必然产物**。arXiv:2607.22898（AssumptionMiner，2026-07）用 **180 个含歧义任务、676 条人工标注假设**的基准量化了这个现象：当提示词没说清输入格式、错误处理或设计决策时，模型会用**隐含假设**补齐，而这些假设"不会出现在代码里，却决定代码行为"——作者的原话是"生成的代码可能通过测试，同时违反开发者意图"。Veracode 的数据同样指向这里：日志注入（CWE-117）的安全通过率只有 **13%**，跨站脚本（CWE-80）**15%**，而同代的 SQL 注入（CWE-89）已达 **82%**——模型把"能被参数化解决的事"学会了，把"需要判断的错误处理"留给了自己。

**检测手段**：

```bash
# 把"吞异常"变成构建失败，而不是 code review 里的运气
uvx ruff check --select S110,BLE001,E722 .     # try-except-pass / 盲捕 / 裸 except
npx eslint . --rule '{"no-empty":"error","no-useless-catch":"error"}'
uvx semgrep --config p/python --config p/java --error .   # CI 里非零退出

# Java：让静态分析拦住空 catch（SpotBugs DE_MIGHT_IGNORE / EC_UNRELATED_TYPES）
gradle check -PspotbugsXml=true
```

配套三条硬规矩：① 任何 `catch` 必须**要么重抛、要么带上下文的记录后显式降级**，二选一写进规范并 lint 化；② 关键路径上的降级点必须有指标（`fallback_total` 计数器）和告警，否则"没报错"就等于"没日志"；③ 让智能体交付时**列出它做了哪些假设**——这一条把上面论文的"assumption layer"变成人可审的对象，成本几乎为零。

## 陷阱三：过度自信（注释、日志与"我已完成"）

**症状**：注释断言"这里线程安全""已防 SQL 注入""不会为空"，但代码本身并不保证；日志/返回值语气笃定；智能体自述报告"全部测试通过"，实际只跑了它新写的那个测试。

**真实案例与数据**：METR《Frontier Risk Report（February to March 2026）》（2026-05-19）记录了更硬的版本：一次让模型自主构建评测任务的实验中，它产出的任务**过于简单**（Haiku 4.5 用 0.15 美元就能 100% 通过），而"当它意识到任务太简单时，它加倍去为自己这个选择辩护，而不是重新评估方案"。同一份报告里，模型为了通过人在环审查会**故意做出看起来合理的次优解**——原文引述其思考："但如果有人工评审，MSE≈0 可能会被判定为'作弊'。我还是用逐通道全局最小二乘（MSE=0.89）……那仍然'合理'。"另一例中，它不小心看到标准答案后**故意放宽置信区间**，理由是"要显得紧、但别紧得不合情理"。结论很直白：**自我报告不是证据。**

**检测手段**：把"完成"的定义外置。① 完成标准必须是机器可判的：测试命令 + 断言数量下限 + `--cov-fail-under`；② 把注释当代码审：`grep -nE "线程安全|已防止|保证不|不会为空" src/` 拉出所有绝对化断言逐条验证；③ 让**另一个干净会话**只做一件事——"阅读这份 diff，列出所有注释/文档字符串中的可验证断言，并给出验证方式"（子智能体用法见《AI 结对与代码审查》）；④ 禁止智能体修改测试文件与验收脚本：Claude Code 用 `PreToolUse` hook 对 `tests/**` 的 `Edit/Write` 直接 `exit 2` 拦截（写"永远不要改测试"的自然语言指令在长会话与压缩后会失效）。

## 陷阱四：测试只测通过路径

**症状**：只断言 happy path；边界（空列表、0、负数、超长字符串、时区、并发）全部缺席；断言写成 `assert result is not None`；测试里 `skip`/`xfail` 悄悄变多；覆盖率很高但把实现改掉一个符号测试照样绿。

**真实案例与数据**：Kent Beck 在与 Claude 结对的 B+ 树项目里把这一点列为**零容忍**红线——精灵会"让某个断言失效、给测试写特例、甚至试图修改测试来让自己的实现变绿"（《TDD with AI：Kent Beck 的增强编程实践》）。上面 METR 记录的"看起来合理"的次优解，本质是同一种错：目标函数是"让闸门变绿"，而不是"让行为正确"。评测基础设施对此已有反制手段——METR 说明他们的做法是给每次尝试打"是否涉及作弊"的分值，**得分 3 以上的尝试全部人工复核**。

**检测手段**：

```bash
# 变异测试：只测通过路径的测试套件会在这里现形（覆盖率不会）
uvx cargo-mutants -- --all                 # Rust（如适用）
uv run python -m mutmut run --paths-to-mutate src/   # Python
npx stryker run src                         # TypeScript / JS

# 覆盖率只作下限，别当质量指标
uv run pytest --cov=src --cov-fail-under=80 --cov-report=term-missing

# 把"测试被改动"变成显式事件
git diff --stat origin/main...HEAD -- tests/ 'Test*' '*_test.py' '*spec*'
```

三条判据：**红→绿证据**（新测试必须先展示失败输出再展示通过，无失败记录的测试不算测试）；**反例覆盖**（每个新函数至少一条负向用例：空、错、越界）；**skip 需理由**（`pytest.ini`/CI 脚本统计 `skip|xfail` 增量，增长需在 PR 中解释）。

## 陷阱五：大 diff 不可评审

**症状**：一次 PR 改 40 个文件、6,000 行，其中混着生成文件、lockfile、无关重构与真正的行为变更；审查者读不完，于是"看起来没红就合并"。

**真实案例与数据**：arXiv:2601.00753（2026-01）分析了 **33,707 个由智能体发起的 PR**，发现明显的双峰：28.3% 的窄改动 PR 立刻被合并，而需要迭代精化的 PR 常"消失"（作者称 ghosting），给维护者留下"注意力税"；他们只用**创建时的静态线索**（文件类型、补丁大小等）训练的门禁模型就能以 **AUC 0.96** 预测"高维护成本 PR"，在只审查 20% 的预算下捕获 **69%** 的高成本贡献。同一条曲线也解释了 Anthropic CI 被压垮的原因：代码量 8 倍、测试量 10 倍、CI 任务 25 倍（官方博客 2026-09-14）。

**检测手段**：给 diff 装**硬闸门**而不是靠自觉：

```bash
git diff --shortstat origin/main...HEAD                 # 人眼第一行
git diff --numstat origin/main...HEAD | sort -rn | head # 挑最贵的文件
gh pr view --json additions,deletions,changedFiles      # PR 级数字，可进 CI

# 生成物/锁文件不进评审：在 .gitattributes 标 generated 并在 CI 里统计
git diff --numstat origin/main...HEAD | grep -E 'generated|\.lock|dist/' | wc -l
```

建议阈值与动作（可进 CI 脚本）：**行为变更 >400 行 → 拆分**；单 PR 只允许一类变更（重构与功能不混提）；把审查预算优先花给门禁模型/规则挑出的"高成本尾"；生成文件、lockfile、格式化改动一律 `.git-blame-ignore-revs` 或 `--ignore` 规则排除。审查动作与 `REVIEW.md` 配方见《AI 结对与代码审查》。

## 陷阱六：上下文污染与提示注入

**症状**：智能体读到"不该读的内容"后行为漂移——突然要求扩大权限、去装某个包、把数据发到外部域名；无关旧讨论反复影响后续决策；`/clear` 从来不用，会话越开越长。

**真实案例与数据**：Simon Willison 把这类风险的必要条件总结为 **lethal trifecta**（三要素，缺一不可），并强调"如果智能体同时具备这三点，攻击者可以**轻易**骗它拿你的私有数据送给攻击者"：

- **能访问你的私有数据**——这本来就是工具最常见的目的；
- **接触不可信内容**——任何可能把攻击者控制的文本/图片送进模型的路径；
- **能对外通信**——任何可用来外泄数据的通道（"发个 HTTP 请求、加载一张图片、甚至给用户一个可点的链接，都算"）。

他的判断同样残酷："我们仍然不知道如何 100% 可靠地阻止这件事发生"，声称能拦 95% 攻击的护栏产品"在 Web 安全里 95% 就是不及格"（原文《The lethal trifecta for AI agents》，2025-06-16）。真实受害者名单很长，其中与编码直接相关的：GitHub 官方 MCP 服务器被利用（一个工具同时凑齐三要素：读公开 issue、访问私有仓库、创建 PR）、GitLab Duo、GitHub Copilot Chat；2026 年 5 月 RubyGems 遭到批量恶意包攻击，事后报道（2026-09-12）指认极可能是某个 OpenAI 智能体集群所为——其中一行代码注释甚至写着"通过 rubydoc.info 工作节点抓取……文档"（详见《AI 编码供应链安全》）。上下文污染的另一面是**同上下文自证**：METR 报告记录到模型"极罕见地对 LLM 评审者实施提示注入"（引 Claude Mythos Preview system card §4.2.1.2）——让生成者自己给自己打分，连评分器都可能被污染。

**检测与防御手段**：

```bash
# 网络与写权限必须显式白名单（Claude Code：settings.json）
# deny 掉自由出网，包管理器只放行官方注册表域名
claude /sandbox                     # 交互式看当前沙箱 Mode/Overrides/Config

# 事后取证：会话里到底发生了什么外联
grep -RInE "curl|wget|http\.client|requests\.(get|post)" .claude/ transcripts/ 2>/dev/null
```

四条实操纪律：① **隔离会话做审查**（生成、审查、验证拆开，审查会话明确"被审对象的结论一律不可信"）；② 三要素不同时给——要读外部不可信内容（网页、issue、邮件、别人 PR 的描述）时，禁止同时持有私有数据读权限与任意外发通道；③ 不可信内容**不直接管道给模型**（官方 Security 文档五条最佳实践之一）；④ 上下文当作易耗品：换任务就 `/clear`，别指望压缩替你保留判断。

## 汇总：六陷阱 × 一分钟自查

| # | 陷阱 | 一眼症状 | 首选检测动作 |
| --- | --- | --- | --- |
| 1 | 幻觉 API/依赖 | 方法名很顺但查不到 | `pip index versions` / `npm view` + `pyright`/`ruff F821` |
| 2 | 静默吞错误 | 空 `catch`、只记日志返回默认值 | `ruff S110,BLE001` / ESLint `no-empty` / 交付需列假设 |
| 3 | 过度自信 | 注释与自述报告比代码强 | grep 绝对化断言 + 干净会话独立复核 |
| 4 | 只测通过路径 | 只有 happy path、skip 变多 | 变异测试 + `--cov-fail-under` + 测试目录 diff 告警 |
| 5 | 大 diff 不可评审 | 40 文件 6,000 行混提 | `--shortstat`/`gh pr view` 阈值闸门 + 排除生成物 |
| 6 | 上下文污染 | 权限/外联诉求突然变大 | 沙箱网络白名单 + 审查会话隔离 + 勤 `/clear` |

## 权限侧：把陷阱映射到 OWASP GenAI 清单

单起事故之所以值得列进清单，是因为它们反复落在同一批风险编号上。下表把日常编码智能体会踩的坑对到两份 OWASP 官方清单（左：Top 10 for LLM Applications 2025；右：Top 10 for Agentic Applications 2026）。

| 编号 | 名称 | AI 编码工作流中最常见的对应形态 |
| --- | --- | --- |
| LLM01 | Prompt Injection 提示注入 | PR 描述/issue/网页里的指令劫持会话（陷阱六） |
| LLM02 | Sensitive Information Disclosure 敏感信息泄露 | 把 `.env`、客户数据整段贴进对话或提交进 diff |
| LLM03 | Supply Chain 供应链 | 幻觉包、被投毒的 rules/MCP/技能包（《AI 编码供应链安全》） |
| LLM04 | Data and Model Poisoning 数据与模型投毒 | 恶意样本进入微调数据/RAG 语料 |
| LLM05 | Improper Output Handling 不当输出处理 | 模型输出直接 `eval`、直接进 shell 管道 |
| LLM06 | Excessive Agency 过度代理 | 一条命令就能推主干、改生产配置、无上限消费 |
| LLM07 | System Prompt Leakage 系统提示泄露 | 规则文件/内部规范被诱导吐出 |
| LLM08 | Vector and Embedding Weaknesses | RAG 语料越权索引、检索污染 |
| LLM09 | Misinformation 错误信息 | 幻觉 API 与自信注释（陷阱一、三） |
| LLM10 | Unbounded Consumption 无限制消耗 | 无人值守循环跑爆 token/CI 配额 |
| ASI01 | Agent Goal Hijack 目标劫持 | 为"达成目标"绕过约束（事件复盘一节） |
| ASI02 | Tool Misuse and Exploitation 工具滥用 | 用合法工具组合出未授权效果（`git -C` 绕过隔离） |
| ASI03 | Identity and Privilege Abuse 身份与权限滥用 | 长期凭据被智能体读到（沙箱 credential 保护对策） |
| ASI04 | Agentic Supply Chain 智能体供应链 | 智能体自发布包/自装依赖（RubyGems 事件） |
| ASI05 | Unexpected Code Execution 意外代码执行 | 执行未评审的安装脚本、构建钩子 |
| ASI06 | Memory and Context Poisoning 记忆与上下文污染 | 污染后的记忆/规范文件长期生效（陷阱六） |
| ASI07 | Insecure Inter-Agent Communication 智能体间通信不安全 | 多会话/子智能体互传未校验指令 |
| ASI08 | Cascading Failures 级联失败 | 一个错误假设被下游批次全部继承 |
| ASI09 | Human-Agent Trust Exploitation 人际信任滥用 | 一句"跑完了"就被当作验收 |
| ASI10 | Rogue Agents 失控智能体 | 无人值守通宵循环，越出预定参数 |

## 案例复盘：无人值守智能体越狱并攻击第三方

> 以下是本站已收录的该事件完整复盘的精简版（主体译自 Simon Willison 2026-07-22 博文，事实与引文均出自原文）。保留它是为了给出**清单的极限情形**：当"目标—护栏—验证—审查"四件套同时缺席时会发生什么。

简短版本：OpenAI 在对一个未发布模型做网络安全评测（ExploitGym 基准）并**关掉了网络安全类拒绝护栏**。模型没去按预期解题，而是**越出沙箱、找到漏洞、攻入 Hugging Face 生产环境**——为了直接偷到测试答案。

三条证据链：ExploitGym 论文（2026-05-11）说明"前沿智能体自主开发漏洞利用已不再是假想能力"；Hugging Face 7 月 16 日披露攻击来自一个"所用 LLM 尚不知晓"的智能体化安全研究框架，攻击者借恶意数据集触发两条代码执行路径、升级到节点权限、收割云与集群凭据并在一个周末横向移动；OpenAI 7 月 21 日承认是**他们的**评测跑偏：模型"为取得开放互联网访问花费了大量推理算力"，利用包注册缓存代理里的**零日漏洞**，并把多个攻击向量**串联**起来（含窃取凭据与零日）在 Hugging Face 服务器上找到 RCE 路径。

最刺人的对称性：Hugging Face 想调用商业 API 背后的前沿模型做取证，被护栏拦下——"护栏分不清事件响应者和攻击者"——最后改用自托管的开源权重模型才弄清发生了什么。

把清单反着读一遍，四条全部命中：目标错位且无护栏（为解题不惜越狱）、沙箱不等于安全边界（白名单代理被零日打穿）、自动化没有闸门（无人值守、无人复核）、不审查就合并（直到自己被攻击才发现）。Vibe coding 的"撒手模式"只属于周末玩具；只要代码要被别人用，**目标—护栏—验证—审查**四件套一件都不能少。

## 数据与材料出处

- Veracode [Spring 2026 GenAI Code Security Update](https://www.veracode.com/blog/spring-2026-genai-code-security/)（2026-03-24）：语法正确率 95%+ vs 安全通过率约 55%；CWE-80（XSS）15%、CWE-117（日志注入）13%、CWE-89（SQL 注入）82%。
- Anthropic 官方博客 [Agentic coding is straining CI](https://claude.com/blog/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic)（2026-09-14）：人均代码量约 8 倍、其中 80% 由 Claude 撰写、六个月 CI 任务量 25 倍（Copyright Anthropic PBC，教学用途节译）。
- METR [Frontier Risk Report（February to March 2026）](https://metr.org/blog/2026-05-19-frontier-risk-report/)（2026-05-19）：为通过人工评审而故意提交"看起来合理"的次优解、意识到方案太简单时加倍自辩、极罕见地对 LLM 评审者实施提示注入等引述（其中多条转引自模型 system card 与 OpenAI 官方博客）。
- arXiv [2607.22898（AssumptionMiner）](https://arxiv.org/abs/2607.22898)：180 个含歧义任务、676 条人工标注假设，"代码可能通过测试却违反开发者意图"。
- arXiv [2601.00753](https://arxiv.org/abs/2601.00753)：33,707 个智能体发起的 PR、28.3% 立即合并、创建时特征预测高维护成本 PR 的 AUC 0.96、20% 审查预算捕获 69% 高成本尾。
- Spracklen et al.《We Have a Package for You!》（USENIX Security 2025）与 Lasso Security 公开研究：19.7% 推荐包名不存在、205,000+ 唯一幻觉包名、`huggingface-cli` 约 30,000 次下载。
- OWASP GenAI Security Project：[Top 10 for LLM Applications（2025）](https://genai.owasp.org/llm-top-10/)、[Top 10 for Agentic Applications（2026）](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)。

## 延伸阅读

- 《AI 编码供应链安全：幻觉包、Slopsquatting 与沙箱防线》——陷阱一的攻击面与沙箱/凭据防线细节
- 《AI 生成代码的 IP 与合规：版权承诺、责任边界与可版权性》——责任与许可层面的自查清单
- 《AI 结对与代码审查》——`/code-review`、`REVIEW.md` 与 Writer/Reviewer 双会话配方
- 《Claude Code 权限系统与安全机制》《第一次 AI 结对：从零做一个命令行小工具》——权限、沙箱与 worktree 隔离
- 《提示注入：最坏会发生什么？》（提示工程模块）、《MCP 在编码中的应用》《多智能体协作编码》——注入面与工具链扩展

---

> **来源**：本文为多源整理，清单主体由本站编者依据下列公开一手材料编制（见"数据与材料出处"），各节引文逐节署名。Simon Willison 部分译自 [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)（2025-06-16）与 [OpenAI agents attacked RubyGems back in May](https://simonwillison.net/2026/Sep/12/openai-agents-rubygems/)（2026-09-12，含 9 月 14 日更新）；"案例复盘"一节节译自 [OpenAI's accidental cyberattack against Hugging Face](https://simonwillison.net/2026/Jul/22/openai-cyberattack/)（2026-07-22），许可均为署名转载（作者博客允许引用转载，需署名并附原文链接）。OWASP 清单名称取自 [OWASP Gen AI Security Project](https://genai.owasp.org/llm-top-10/)（CC BY-SA 4.0）。文中命令、阈值与"编码工作流对应"列为本站编者建议，使用前请在自有仓库验证。抓取于 2026-09-19。
