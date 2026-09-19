# 来源报告与新模块对应

本目录按**抓取批次所属的旧模块**归档（记录当时用了哪些来源、哪些抓取失败与替代），2026-09-19 全站重排后模块编号有变，对应关系如下：

| 报告文件 | 对应现在的模块 |
|---|---|
| 00-python-basics.md | 00-python-basics |
| 01-python-advanced.md | 01-python-advanced（原 03） |
| 02-dsa.md | 02-dsa（原 01） |
| 03-cs-fundamentals.md | 03-cs-fundamentals（原 02） |
| 04…10-*.md | 编号未变 |
| 11-14-ai-coding.md | 原 11-vibe-coding 的 35 篇，现拆为 11-ai-coding-tools / 12-ai-coding-context / 13-ai-coding-engineering / 14-ai-coding-classics |
| 15-project-analysis.md | 15-project-analysis（原 12） |
| 16-design-patterns-java.md | 16-design-patterns-java（原 13） |

逐篇的现行来源与许可以 `docs/.vitepress/manifest/<模块>.json` 为准（由 `node scripts/gen-manifest.mjs` 从文章 frontmatter 再生）。
