# LLM 应用开发完全学习路线

VitePress 中文学习站：3 大板块 · 12 个模块 · **199 篇**文章，内容全部抓取/翻译自网络优质资料并逐篇署名出处。

> **版权声明**：本站内容为学习用途，转载/翻译自网络公开资料，版权归原作者所有；每篇文章均标注原文出处与许可。如有侵权请联系删除。

## 本地运行

```bash
npm install
npm run dev      # 开发预览
npm run build    # 构建静态站点
```

## 模块与文章数

| 目录 | 模块 | 篇数 |
|---|---|---|
| 00-python-basics | Python 基础 | 22 |
| 01-dsa | 数据结构与算法 | 21 |
| 02-cs-fundamentals | 计算机基础（英文翻译） | 23 |
| 03-python-advanced | Python 进阶与框架 | 17 |
| 04-llm-basics | LLM 基础 | 10 |
| 05-prompt-engineering | Prompt 工程 | 10 |
| 06-api-development | API 与应用开发 | 14 |
| 07-databases | 数据库 | 16 |
| 08-rag | RAG | 15 |
| 09-agents | Agent | 18 |
| 10-finetuning-deployment | 微调与部署 | 17 |
| 11-vibe-coding | Vibe Coding | 16 |

合计 **199 篇**（另有每模块导读页）。

## 内容来源与许可

- 每篇文章 frontmatter 记录 source_url / author / license / fetched_at / translated，文首有署名块。
- 来源登记：docs/.vitepress/manifest/<模块>.json；抓取失败与替代记录：docs/.vitepress/sources-report/<模块>.md。
- 计划与设计文档：docs/superpowers/。

## AI 学习助手

全站右下角悬浮助手：使用你自己配置的 OpenAI 兼容端点（Base URL/模型/API Key），浏览器直连，API Key 以 AES-GCM 加密存于本机 localStorage（加密密钥存 IndexedDB，不可导出），不上传任何服务器。
