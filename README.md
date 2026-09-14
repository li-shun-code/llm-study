# LLM 应用开发完全学习路线

VitePress 中文学习站：3 大板块 · 12 个模块 · **245 篇**文章，内容全部抓取/翻译自网络优质资料并逐篇署名出处。

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
| 00-python-basics | Python 基础 | 25 |
| 01-dsa | 数据结构与算法 | 25 |
| 02-cs-fundamentals | 计算机基础（英文翻译） | 27 |
| 03-python-advanced | Python 进阶与框架 | 22 |
| 04-llm-basics | LLM 基础 | 10 |
| 05-prompt-engineering | Prompt 工程 | 11 |
| 06-api-development | API 与应用开发 | 17 |
| 07-databases | 数据库 | 19 |
| 08-rag | RAG | 19 |
| 09-agents | Agent | 21 |
| 10-finetuning-deployment | 微调与部署 | 20 |
| 11-vibe-coding | Vibe Coding | 29 |

合计 **245 篇**（另有每模块导读页）。

## 内容来源与许可

- 每篇文章 frontmatter 记录 source_url / author / license / fetched_at / translated，文首有署名块。
- 来源登记：docs/.vitepress/manifest/<模块>.json；抓取失败与替代记录：docs/.vitepress/sources-report/<模块>.md。
- 计划与设计文档：docs/superpowers/。

## 语音朗读（edge-tts）

文章页右下角 🔊 按钮：播放全文朗读，支持切换声音与语速。

- 标注"已缓存"的声音为预生成音频（edge-tts，微软神经网络音色），存于 `docs/public/audio/`，打开即听；
- 其余声音使用浏览器实时语音（Web Speech API）兜底；
- 预生成命令：`node scripts/generate-tts.mjs --module 01-dsa --voice zh-CN-YunxiNeural`（支持 `--file` / `--module` / `--all` / `--force`，`--list-voices` 查看音色）。已生成的音频提交进仓库即为缓存，下次直接听。注意全量生成体积较大（GitHub Pages 上限 1GB），建议按需生成。

## AI 学习助手

全站右下角悬浮助手：使用你自己配置的 OpenAI 兼容端点（Base URL/模型/API Key），浏览器直连，API Key 以 AES-GCM 加密存于本机 localStorage（加密密钥存 IndexedDB，不可导出），不上传任何服务器。
