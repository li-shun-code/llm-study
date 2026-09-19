# LLM 应用开发完全学习路线

VitePress 中文学习站：**5 大板块 · 17 个模块 · 296 篇**文章，内容全部抓取/翻译自网络优质资料并逐篇署名出处。

> **版权声明**：本站内容为学习用途，转载/翻译自网络公开资料，版权归原作者所有；每篇文章均标注原文出处与许可。如有侵权请联系删除。

## 本地运行

```bash
npm install
npm run dev      # 开发预览
npm run build    # 重编号 → 侧边栏 → 来源登记表 → 校验 → 构建静态站点
npm run check    # 只跑质量闸门（frontmatter 契约 / 内部话术 / 单元测试）
```

## 板块与模块

| 板块 | 模块目录 | 名称 | 篇数 |
|---|---|---|---|
| ① 开发内功 | `00-python-basics` | Python 基础 | 28 |
| ① 开发内功 | `01-python-advanced` | Python 进阶与工程化 | 27 |
| ① 开发内功 | `02-dsa` | 数据结构与算法 | 30 |
| ① 开发内功 | `03-cs-fundamentals` | 计算机基础 | 33 |
| ② 原理与提示 | `04-llm-basics` | LLM 原理与模型生态 | 13 |
| ② 原理与提示 | `05-prompt-engineering` | 提示工程与上下文工程 | 12 |
| ③ LLM 应用开发 | `06-api-development` | 模型 API 与应用开发 | 21 |
| ③ LLM 应用开发 | `07-databases` | 数据库与向量存储 | 17 |
| ③ LLM 应用开发 | `08-rag` | RAG 检索增强生成 | 21 |
| ③ LLM 应用开发 | `09-agents` | Agent 智能体 | 23 |
| ③ LLM 应用开发 | `10-finetuning-deployment` | 微调与部署 | 22 |
| ④ AI 编程实战 | `11-ai-coding-tools` | AI 编程工具与环境 | 12 |
| ④ AI 编程实战 | `12-ai-coding-context` | 规范、上下文与技能 | 12 |
| ④ AI 编程实战 | `13-ai-coding-engineering` | AI 工程实践与质量安全 | 11 |
| ④ AI 编程实战 | `14-ai-coding-classics` | 名篇与视野 | 5 |
| ⑤ 源码与延伸 | `15-project-analysis` | 优质项目源码分析 | 4 |
| ⑤ 源码与延伸 | `16-design-patterns-java` | Java 设计模式教学专栏 | 5 |

合计 **296 篇**（另有每模块导读页）。每个模块在侧边栏内再按子分组（frontmatter `group`）分阶段展示，分组顺序即推荐学习顺序。

## 内容来源与许可

- 每篇文章 frontmatter 记录 source_url / author / license / fetched_at / translated，文末有署名块。
- 逐篇来源登记：`docs/.vitepress/manifest/<模块>.json`（由 `node scripts/gen-manifest.mjs` 从 frontmatter 再生，勿手改）；抓取失败与替代记录：`docs/.vitepress/sources-report/<模块>.md`。
- 结构与重排决策：`docs/superpowers/specs/`；文章写作契约：`docs/superpowers/CONTENT-RULES.md`。

## 结构维护脚本

| 脚本 | 用途 |
|---|---|
| `scripts/reorg.mjs <spec.json>` | 按规格重排全站（换目录、分组、重编号、重生成导读页）；未列入规格的文章会报错，不会静默丢失 |
| `scripts/renumber.mjs` | 新增/拆分文章后把序号压成连续 |
| `scripts/normalize-refs.mjs` | 把「第 N 篇」「模块 N」引用改成《文章标题》（重排前跑） |
| `scripts/fix-links.mjs` | 重排后按 slug 修复站内相对链接 |
| `scripts/gen-sidebar.mjs` / `gen-manifest.mjs` | 侧边栏与来源登记表再生 |
| `scripts/check-frontmatter.mjs docs` | 契约闸门（必填字段、序号与文件名一致、文末署名块） |
| `scripts/scan-leaks.mjs docs` | 扫描正文里残留的内部工作流话术 |

约定：正文交叉引用一律写《文章标题》，**不要**写「第 N 篇」「模块 N」——重排编号会让这类引用失效。

## 语音朗读（edge-tts 实时合成）

文章标题上方的朗读条：点击 ▶ 即通过 edge-tts WebSocket（微软 Edge 朗读服务）实时合成并流式播放，无需预生成缓存。

- 句子级高亮跟随朗读位置，页面自动滚动；
- 声音切换（晓晓/云希/云扬/东北话晓北）与 0.75-1.5x 语速；
- WebSocket 直连微软服务需要 Edge 浏览器 UA（微软侧校验）；其他浏览器自动回退浏览器语音（Web Speech API，效果同样带高亮跟读）。

## AI 学习助手

全站右下角悬浮助手：使用你自己配置的 OpenAI 兼容端点（Base URL/模型/API Key），浏览器直连，API Key 以 AES-GCM 加密存于本机 localStorage（加密密钥存 IndexedDB，不可导出），不上传任何服务器。
