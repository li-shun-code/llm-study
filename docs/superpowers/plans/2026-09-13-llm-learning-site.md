# LLM 学习站（VitePress）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 VitePress 中文学习站，3 板块 12 模块约 175 篇文章，内容全部抓取自网络（中文转载/英文翻译），每篇署名出处。

**Architecture:** VitePress 默认主题站点；文章为 `docs/NN-module/` 下的 Markdown 文件，frontmatter 记录来源元数据；侧边栏由脚本扫描 frontmatter 生成；内容抓取采用"开源书 GitHub raw 批量 + 网页抓取 + AI 翻译"三通道，由清单 manifest 驱动、校验脚本把关。

**Tech Stack:** Node 25 + VitePress 1.x、node:test、GitHub raw、turndown（HTML→MD，网页抓取通道）。

**Spec:** `docs/superpowers/specs/2026-09-13-llm-learning-site-design.md`

## Global Constraints

- 站点根：`/Users/ls/.zcode/workspace/default/llm-learning-site/`，文档根 `docs/`。
- 文章 frontmatter 必填字段：`title`（中文标题）、`source_url`、`author`、`license`、`fetched_at`（ISO 日期）、`translated`（bool）、`order`（模块内序号，整数）。
- 每篇文章 frontmatter 之后第一段必须是署名块，精确格式：
  `> **来源**：本文${translated ? "翻译" : "转载"}自 [${原文标题}](${source_url})，作者 ${author}，许可 ${license}。抓取于 ${fetched_at}。`
- 目录名固定 12 个：`00-python-basics`、`01-dsa`、`02-cs-fundamentals`、`03-python-advanced`、`04-llm-basics`、`05-prompt-engineering`、`06-api-development`、`07-databases`、`08-rag`、`09-agents`、`10-finetuning-deployment`、`11-vibe-coding`。
- 文件命名：`NN-slug.md`（NN 为模块内两位序号，与 frontmatter `order` 一致）。
- 模块 2 来源禁止使用小林 coding；优先英文一手资料翻译。
- 抓取失败的 URL 记入 `docs/.vitepress/sources-report.md`（表格：主题/原 URL/失败原因/替代文章），禁止悄悄丢文章。
- 每个内容任务完成标准：该目录全部文章通过 `node scripts/check-frontmatter.mjs docs/<dir>` 且 `npx vitepress build docs` 成功，然后 commit。
- 翻译质量要求：全文翻译、保留代码块不译（注释可译）、术语首现标注英文（如"注意力机制（Attention）"）。
- 不做用户系统/评论/上线部署。

## Content Task Playbook（所有内容任务的共同步骤，不重复书写）

每个内容任务（Task 5-16）按以下固定流程执行，任务条目只写该模块独有的输入（来源清单、目录、目标篇数、知识点清单）：

1. **补充 manifest**：把本模块来源写入 `docs/.vitepress/manifest.json` 对应模块节点（字段：`topic, url, channel: "raw"|"web"`）；GitHub raw 通道可批量抓的开源书，用 `node scripts/fetch-raw.mjs <module>` 一次拉取；web 通道文章逐篇用 WebFetch 抓取、转为中文 Markdown（英文原文先翻译再入库）。
2. **写入文章**：每篇保存为 `docs/<dir>/NN-slug.md`，头部加 frontmatter 与署名块（格式见 Global Constraints）；正文保留原文结构，图片若外链可用原文链接，抓不到的图删去并在文中以文字说明。
3. **失败登记**：抓不到的 URL 写入 `docs/.vitepress/sources-report.md`，并从候选备选列表补一篇同主题文章，保证模块篇数达标。
4. **校验**：`node scripts/check-frontmatter.mjs docs/<dir>`，期望 `PASS (N articles)`。
5. **构建**：`npx vitepress build docs`，期望成功无死链报错。
6. **提交**：`git add -A && git commit -m "content: <模块名> 完成（N 篇）"`。

---

### Task 1: VitePress 脚手架

**Files:**
- Create: `package.json`、`docs/.vitepress/config.mts`、`docs/index.md`、`docs/.vitepress/theme/index.ts`（空自定义入口，备用）、`.gitignore`
- Create: `docs/00-python-basics/index.md`（12 个模块目录各一个占位导读页，标题+一句话说明+知识点列表）

**Interfaces:**
- Produces: `docs/.vitepress/config.mts` 中 `sidebar` 引用 `./sidebar.generated.mjs` 的默认导出（Task 2 生成该文件；本任务先用空数组占位文件 `docs/.vitepress/sidebar.generated.mjs`，内容 `export default []`）。

- [ ] **Step 1: 初始化项目**

```bash
cd /Users/ls/.zcode/workspace/default/llm-learning-site
cat > package.json <<'EOF'
{
  "name": "llm-learning-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vitepress dev docs",
    "build": "vitepress build docs",
    "preview": "vitepress preview docs"
  },
  "devDependencies": {
    "vitepress": "^1.6.3"
  }
}
EOF
printf 'node_modules/\ndocs/.vitepress/cache/\ndocs/.vitepress/dist/\n' > .gitignore
npm install
```

- [ ] **Step 2: 写配置与首页**

`docs/.vitepress/config.mts`：

```ts
import { defineConfig } from 'vitepress'
import sidebar from './sidebar.generated.mjs'

export default defineConfig({
  lang: 'zh-CN',
  title: 'LLM 应用开发完全学习路线',
  description: '从 Python 零基础到 LLM 应用开发：抓取全网优质教程的中文学习路线',
  themeConfig: {
    siteTitle: 'LLM 学习路线',
    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章' },
          modal: {
            noResultsText: '没有结果', resetButtonTitle: '清空',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },
    sidebar
  }
})
```

`docs/index.md`：

```md
---
layout: home
hero:
  name: LLM 应用开发完全学习路线
  text: 从 Python 零基础到 LLM 应用开发者
  tagline: 3 大板块 · 12 个模块 · 约 175 篇精选教程，全部抓取自网络优质资料并署名出处
  actions:
    - theme: brand
      text: 从 Python 基础开始
      link: /00-python-basics/
    - theme: alt
      text: 直接进入 LLM 部分
      link: /04-llm-basics/
features:
  - icon: 🧱
    title: 第一部分 · 开发者内功
    details: Python 基础 / 数据结构与算法 / 计算机基础 / Python 进阶与框架
    link: /00-python-basics/
  - icon: 🤖
    title: 第二部分 · LLM 应用开发
    details: LLM 基础 / Prompt 工程 / API 开发 / 数据库 / RAG / Agent / 微调与部署
    link: /04-llm-basics/
  - icon: ✨
    title: 第三部分 · AI 时代工作方式
    details: Vibe Coding 与 AI 辅助编程工作流
    link: /11-vibe-coding/
---
```

- [ ] **Step 3: 生成 12 个模块导读页**

对每个目录 `00-python-basics`…`11-vibe-coding` 创建 `docs/<dir>/index.md`，frontmatter 含 `title`（如"模块 0 · Python 基础"）、`order: 0`，正文为该模块一句话简介 + 知识点清单（照 spec 第 2 节知识点列）；`isRoot: true` 写进 frontmatter 供侧边栏脚本识别为分组首页。导读页免署名块（校验脚本对 `isRoot: true` 跳过署名检查）。

- [ ] **Step 4: 占位侧边栏并构建验证**

```bash
printf 'export default []\n' > docs/.vitepress/sidebar.generated.mjs
npx vitepress build docs
```
Expected: 构建成功。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: VitePress 脚手架与 12 模块导读页"
```

---

### Task 2: 侧边栏生成脚本（含测试）

**Files:**
- Create: `scripts/gen-sidebar.mjs`、`scripts/lib/frontmatter.mjs`、`tests/gen-sidebar.test.mjs`
- Modify: `docs/.vitepress/config.mts`（不变，仍引用 sidebar.generated.mjs）

**Interfaces:**
- Produces: `parseFrontmatter(mdText) -> { data: object, body: string }`（`scripts/lib/frontmatter.mjs`，无依赖 YAML 简易解析：仅支持 `key: value` 标量与 bool）；`node scripts/gen-sidebar.mjs` 重写 `docs/.vitepress/sidebar.generated.mjs`，导出数组 `[ { text: 板块名, collapsed: false, items: [ {text, link, collapsed, items} ] } ]`。
- 约定：frontmatter `isRoot: true` 的文件成为分组项；`order` 决定组内排序；板块归属映射硬编码在脚本内（00-03 → 开发者内功，04-10 → LLM 应用开发，11 → AI 时代工作方式）。

- [ ] **Step 1: 写失败测试**（`tests/gen-sidebar.test.mjs`，用 node:test + 临时目录夹具：两个模块目录，各含 index.md 与两篇文章）

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'

test('parseFrontmatter 解析标量与布尔', () => {
  const { data } = parseFrontmatter('---\ntitle: 你好\norder: 3\nisRoot: true\n---\n# 正文')
  assert.equal(data.title, '你好')
  assert.equal(data.order, 3)
  assert.equal(data.isRoot, true)
})
```

- [ ] **Step 2: 运行测试确认失败**：`node --test tests/` → FAIL（模块不存在）
- [ ] **Step 3: 实现** `frontmatter.mjs` 与 `gen-sidebar.mjs`（扫描 `docs/` 下 12 个固定目录，按上述约定输出，写入 `docs/.vitepress/sidebar.generated.mjs`，内容为 `export default <JSON>`）
- [ ] **Step 4: 测试通过 + 生成**：`node --test tests/` PASS；`node scripts/gen-sidebar.mjs && npx vitepress build docs` 成功
- [ ] **Step 5: Commit** `feat: 侧边栏自动生成脚本`

---

### Task 3: frontmatter 校验脚本（含测试）

**Files:**
- Create: `scripts/check-frontmatter.mjs`、`tests/check-frontmatter.test.mjs`
- Consumes: `parseFrontmatter`（Task 2）

**Interfaces:**
- Produces: `node scripts/check-frontmatter.mjs <docsDir>...`；对每篇非 root 文章检查：必填字段齐全、`order` 为整数、署名块匹配 `^> \*\*来源\*\*：`、文件名序号与 `order` 一致；root 页只要求 `title/order/isRoot`。输出 `PASS (N articles)` 或逐条 `FAIL` 并以非零码退出。

- [ ] **Step 1: 写失败测试**（夹具：缺字段文章、合规文章、root 页各一，断言合规通过/缺失报错退出码 1）
- [ ] **Step 2: 确认失败**：`node --test tests/` → FAIL
- [ ] **Step 3: 实现校验脚本**
- [ ] **Step 4: 通过**：`node --test tests/` PASS
- [ ] **Step 5: Commit** `feat: 文章 frontmatter 与署名校验脚本`

---

### Task 4: GitHub raw 批量抓取脚本 + manifest

**Files:**
- Create: `scripts/fetch-raw.mjs`、`docs/.vitepress/manifest.json`（初始含 12 个模块节点，`articles: []`）
- Consumes: `parseFrontmatter`

**Interfaces:**
- Produces: manifest 结构 `{ modules: { "<dir>": { articles: [ { topic, url, channel, file } ] } } }`；`node scripts/fetch-raw.mjs <moduleDir>` 读取 manifest 中该模块 `channel:"raw"` 条目（GitHub raw URL），下载并写入条目指定的 `file` 路径，单条失败打印警告继续，结束输出成功/失败计数。抓取的原始开源书文章允许保留原文（中文书直接入库；此时由执行者补 frontmatter+署名块）。

- [ ] **Step 1: 写失败测试**：`tests/fetch-raw.test.mjs` 用本地 `file://` 不行则用 node:http 起临时服务器伪造 raw 响应，断言文件写入与失败计数
- [ ] **Step 2: 确认失败** `node --test tests/` → FAIL
- [ ] **Step 3: 实现 fetch-raw.mjs**
- [ ] **Step 4: 通过 + 真实冒烟**：manifest 加一条 hello-algo 真实 raw URL，运行脚本成功落盘后删除测试文件
- [ ] **Step 5: Commit** `feat: raw 批量抓取脚本与 manifest`

---

### Task 5: 内容 · 模块 0 Python 基础（~18 篇）

**目录** `docs/00-python-basics/`。**候选来源（执行时验证可抓性，失败按 Playbook 替换）**：廖雪峰 Python 教程 liaoxuefeng.com（web）、菜鸟教程 runoob.com/python3（web）、Python 官方教程中文（docs.python.org/zh-cn/3/tutorial，web）、GitHub 上开源中文 Python 书（raw）。
**知识点 → 文章**（每点一篇，可合并相邻小点但总数 ≥18）：环境搭建与第一个程序；变量与基本类型；数字与字符串；列表；元组；字典；集合；条件判断；循环；函数定义与参数；lambda 与高阶函数；类与对象；继承/多态/魔法方法；模块与包；异常处理；文件 IO；JSON 与时间日期；pip 与虚拟环境。
**执行**：Playbook 全步骤（manifest → 抓/译 → 写入 → 登记 → 校验 → 构建 → `content: 模块 0 Python 基础 完成`）。

### Task 6: 内容 · 模块 1 数据结构与算法（~19 篇）

**目录** `docs/01-dsa/`。**主来源（raw 批量，star 最多中文开源算法书）**：`https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_<chap>/<file>.md`（章节：preface/complexity_analysis、array_and_linkedlist、stack_and_queue、hash_table、tree、heap、graph、searching、sorting、divide_and_conquer、backtracking、dynamic_programming、greedy；具体文件名执行时用 GitHub API 列目录核实）。
**知识点 → 文章**：复杂度分析；数组；链表；栈；队列；哈希表；树；二叉树遍历；BST；堆；图；DFS/BFS；冒泡/插入/选择排序；快排/归并；二分查找；双指针与滑动窗口；递归与回溯；动态规划；贪心。
**执行**：Playbook 全步骤，`content: 模块 1 数据结构与算法 完成`。

### Task 7: 内容 · 模块 2 计算机基础（~19 篇，英文翻译）

**目录** `docs/02-cs-fundamentals/`。**候选来源（全部英文翻译，禁小林 coding）**：OSTEP 免费章节 ostep.org（web，注意其许可要求署名非商业）；Beej's Guide to Network Concepts beej.us/guide/bgnet（web）；Cloudflare Learning Center cloudflare.com/learning（web）；MDN HTTP docs（developer.mozilla.org/en-US/docs/Web/HTTP，web）；MIT Missing Semester missing.csail.mit.edu（web，CC BY-SA）；The Linux Command Line 免费章节 linuxcommand.org（web）。
**知识点 → 文章**：OS 概述；进程；线程；CPU 调度；内存管理；虚拟内存；文件系统；并发与锁；网络分层模型；TCP；UDP；HTTP；HTTPS；DNS；REST 风格；Linux 常用命令；Shell 脚本入门；文件权限；SSH。
**执行**：Playbook 全步骤，`content: 模块 2 计算机基础 完成（英文翻译）`。

### Task 8: 内容 · 模块 3 Python 进阶与框架（~14 篇）

**目录** `docs/03-python-advanced/`。**候选来源**：realpython.com（web，部分允许引用——不可转载的改为翻译摘要+原文链接并在 sources-report 标注）；FastAPI 官方文档中文版 fastapi.tiangolo.com/zh（web，MIT）；Flask 文档 flask.palletsprojects.com（web）；Gradio/Streamlit 官方文档（web）；requests/httpx/Pydantic 官方文档（web）；pytest 文档（web）；astral.sh/uv 文档（web）。
**知识点 → 文章**：装饰器；迭代器与生成器；上下文管理器；asyncio 异步；类型注解；requests；httpx；Pydantic；FastAPI 入门；FastAPI 请求/响应模型进阶；Flask 入门；Gradio；Streamlit；uv/poetry 工程化与 pytest。
**执行**：Playbook 全步骤，`content: 模块 3 Python 进阶与框架 完成`。

### Task 9: 内容 · 模块 4 LLM 基础（~10 篇）

**目录** `docs/04-llm-basics/`。**候选来源**：DataWhale happy-llm（raw：`raw.githubusercontent.com/datawhalechina/happy-llm/main/docs/chapter2/...` 等，执行时 API 核实）；DataWhale so-large-lm（raw）；Hugging Face LLM Course huggingface.co/learn/llm-course（web，Apache）；Lilian Weng "What is a Language Model"?（lilianweng.github.io，web）；OpenAI 官方文档 What is a token / models 页（web）；Anthropic docs（web）。
**知识点 → 文章**：从词向量到 Transformer；注意力机制；GPT 系列演进；Token 与上下文窗口；采样参数（temperature/top_p）；主流模型生态对比；幻觉成因与缓解；推理模型（o1/R1 类）；Scaling Laws；多模态模型概览。
**执行**：Playbook 全步骤，`content: 模块 4 LLM 基础 完成`。

### Task 10: 内容 · 模块 5 Prompt 工程（~10 篇）

**目录** `docs/05-prompt-engineering/`。**候选来源**：promptingguide.ai（有官方中文 raw 仓库 `raw.githubusercontent.com/NirDiamant/...`不对——正确是 `promptingguide.ai` 官网 web + GitHub `raw.githubusercontent.com/promptingguide/promptingguide/main/...` 执行时核实）；Anthropic Prompt Engineering 文档（web）；OpenAI GPT Best Practices（web）；Google Gemini prompting guide（web）；Lilian Weng Prompt Engineering（web）。
**知识点 → 文章**：提示词基本结构；零样本与少样本；思维链 CoT；自洽性与多路采样；ReAct 提示模式；结构化输出（JSON/Schema）；系统提示词设计；提示注入攻击与防护；多模态提示；提示迭代评估方法。
**执行**：Playbook 全步骤，`content: 模块 5 Prompt 工程 完成`。

### Task 11: 内容 · 模块 6 API 与应用开发（~13 篇）

**目录** `docs/06-api-development/`。**候选来源**：OpenAI Cookbook `raw.githubusercontent.com/openai/openai-cookbook/main/...`（raw，MIT）；platform.openai.com/docs guides（web）；Anthropic docs tool use / streaming（web）；DataWhale llm-cookbook / llm-universe 相应章节（raw）；LiteLLM docs（web，MIT）；LangChain 官方教程（web）。
**知识点 → 文章**：第一个 Chat API 调用；消息角色与多轮会话管理；流式输出；Function Calling/Tool Use；JSON Mode 与结构化输出；Embedding API 与文本相似度；视觉理解 API；错误处理/重试/限流；成本与 Token 优化；OpenAI 兼容端点与 LiteLLM；LangChain 快速入门；用 FastAPI 封装 LLM 服务；实战：命令行聊天机器人。
**执行**：Playbook 全步骤，`content: 模块 6 API 与应用开发 完成`。

### Task 12: 内容 · 模块 7 数据库（~15 篇）

**目录** `docs/07-databases/`。**候选来源**：sqlbolt.com（web，教学交互式——转文字教程）；PostgreSQL 官方教程（web）；SQLite 文档（web，公有领域）；Redis 官方文档介绍页（web，RSAL/RRedis 许可注意——只转载介绍性文档，替换为博客 if 不可）；MongoDB University 免费课讲义/官方 docs（web）；Milvus/Chroma/Qdrant/pgvector 官方文档（web，多为 Apache/MIT）；SQLAlchemy 官方教程（web）；相关高质量英文博客翻译。
**知识点 → 文章**：关系模型与 SQL 入门；SELECT 增删改查；JOIN 多表；索引原理与使用；事务与 ACID；SQLite 上手；PostgreSQL 入门；SQLAlchemy ORM；Redis 核心数据结构与缓存；MongoDB 文档模型；向量数据库原理；Milvus/Chroma/Qdrant/pgvector 各一篇上手（合并为 2 篇对比+2 篇实战）；向量库选型对比。
**执行**：Playbook 全步骤，`content: 模块 7 数据库 完成`。

### Task 13: 内容 · 模块 8 RAG（~14 篇）

**目录** `docs/08-rag/`。**候选来源**：NirDiamant/GenAI_Agents 与 RAG 技术仓库 notebooks（raw，Apache/MIT：`raw.githubusercontent.com/NirDiamant/RAG_Techniques/main/...` 执行时核实）；Anthropic/OpenAI RAG 指南（web）；LlamaIndex 文档 Understanding RAG（web）；LangChain RAG tutorial（web）；Weaviate/Pinecone/LangChain 博客 RAG 系列（web，部分允许署名转载）；Pinecone learning center（web）。
**知识点 → 文章**：什么是 RAG；Embedding 深入；文档分块策略；向量检索与相似度；最小 RAG 全流程实战（Python）；RAG 评估（RAGAS 等）；混合检索（BM25+向量）；重排序 rerank；Query 改写与扩展；多模态 RAG；GraphRAG；Agentic RAG；生产化架构与常见问题排查；RAG 案例集。
**执行**：Playbook 全步骤，`content: 模块 8 RAG 完成`。

### Task 14: 内容 · 模块 9 Agent（~17 篇）

**目录** `docs/09-agents/`。**候选来源**：Lilian Weng "LLM Powered Autonomous Agents"（web）；Anthropic "Building effective agents"（web，允许翻译需署名——执行时核对）；Hugging Face Agents Course（web，Apache）；LangGraph 官方教程（web）；AutoGen/CrewAI/OpenAI Agents SDK 文档（web）；modelcontextprotocol.io 官方文档（web）；NirDiamant/GenAI_Agents（raw）；Microsoft "AI Agents for Beginners" `raw.githubusercontent.com/microsoft/ai-agents-for-beginners/main/...`（raw，MIT，含中文翻译可对照）。
**知识点 → 文章**：什么是 Agent；ReAct 范式；Tool Use 实战；规划与任务分解；记忆机制（短期/长期）；MCP 协议详解；MCP server 实战；Function Calling vs MCP；多智能体模式；LangGraph 入门；AutoGen 与 CrewAI；OpenAI Agents SDK；代码解释器型 Agent；Computer Use/浏览器操作 Agent；Agent 评测；Agent 安全与权限；生产化部署与成本。
**执行**：Playbook 全步骤，`content: 模块 9 Agent 完成`。

### Task 15: 内容 · 模块 10 微调与部署（~12 篇）

**目录** `docs/10-finetuning-deployment/`。**候选来源**：DataWhale happy-llm 微调章节 / self-llm（raw）；Hugging Face PEFT/TRL 文档与 smol-course（web/raw，Apache）；Ollama 官方文档（web，MIT）；vLLM 文档（web，Apache）；llama.cpp 文档（web，MIT）；HF Blog 微调指南（web）；OpenSSF/相关评测文档 lm-eval（web）。
**知识点 → 文章**：微调 vs RAG vs 提示工程选型；全参微调流程；LoRA 原理；QLoRA 与显存优化；训练数据准备与清洗；PEFT/TRL 实战；模型量化基础；Ollama 本地部署；vLLM 高吞吐部署；开源模型选型；LLM 评测方法与基准；安全、合规与内容护栏。
**执行**：Playbook 全步骤，`content: 模块 10 微调与部署 完成`。

### Task 16: 内容 · 模块 11 Vibe Coding（~14 篇）

**目录** `docs/11-vibe-coding/`。**候选来源**：Anthropic "Claude Code Best Practices"（web，翻译署名）；Cursor docs cursor.com/docs（web，含 rules/contexts）；GitHub Copilot docs（web）；OpenAI Codex docs（web）；Geoffrey Huntley 博客 ragdo/spec-driven 系列（web）；"AGENTS.md" 官方站 agents.md（web）；Cline/Windsurf 文档（web）；ctxii/相关英文博客（执行时搜索补充）。
**知识点 → 文章**：Vibe Coding 是什么与工程争议；AI 编程工具全景对比；Claude Code 工作流与最佳实践（翻译）；Cursor 入门与 Rules；AGENTS.md/CLAUDE.md 项目规范文件；Spec 驱动开发；上下文工程（Context Engineering）；MCP 在编码中的应用；AI 结对与代码审查；TDD with AI；多智能体协作编码；AI 代码的安全与质量陷阱；从 0 到 1 用 AI 做产品的实战流程；Vibe Coding 工具链生态（Cline/Windsurf 等）。
**执行**：Playbook 全步骤，`content: 模块 11 Vibe Coding 完成`。

---

### Task 17: 汇总收尾与验收

**Files:**
- Create/Modify: `docs/.vitepress/sources-report.md`（汇总）、`README.md`（站点说明：结构、如何本地跑、内容来源声明）

- [ ] **Step 1: 全站校验与统计**：`node scripts/gen-sidebar.mjs && node --test tests/ && npx vitepress build docs` 全部通过；统计各模块文章数写入 README（`for d in docs/*/; do ls $d*.md | wc -l; done` 风格统计，root 页除外）。
- [ ] **Step 2: sources-report 汇总**：确认失败清单完整、替代方案有落点；文章总数 ≥150 即达标（目标 ~175，允许因来源不可抓达 150+）。
- [ ] **Step 3: 视觉验收**：`npx vitepress preview docs` 或 dist 渲染为 PNG，dispatch judge 子代理对首页 + 每板块代表页（≥6 页）验收；不通过项修复后复验。
- [ ] **Step 4: 最终 Commit**：`feat: 站点完成——12 模块学习路线`。
- [ ] **Step 5: 交付说明**：向用户报告预览命令、站点结构、文章与来源清单位置。
