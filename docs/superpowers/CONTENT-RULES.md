# 文章重写须知（内容整改批次共用）

本站为 VitePress 中文学习站，内容为抓取/翻译自网络公开资料。整改批次（重做低质文章、补缺口）请遵守：

## 边界
- 只改你被分配模块目录下的文件；不要动其他模块、不要跑 `vitepress build`、`gen-sidebar`、`git`（统一由主流程执行）。
- 不要改 `order`/`group` 之外的字段顺序；新增文章时 `order` 用「该模块现有最大 order + 1」，`group` 照抄目标分组里已有文章的 group 值，中央会统一重编号。
- 结束前必须让 `node scripts/check-frontmatter.mjs docs/<你的模块>` 输出 PASS。

## frontmatter 契约（缺一不可）
```
---
title: 中文标题
source_url: https://原文或仓库链接
author: 原作者/团队
license: 核实过的许可证（如 MIT / Apache 2.0 / CC BY-SA 4.0 / 署名转载）
fetched_at: 2026-09-19
translated: true
versions: 内容对应的库/模型版本（可选但推荐）
order: 12
group: 分组名（可选）
---
```
文末必须有署名块：`> **来源**：抓取于 2026-09-19。译自/引自 [原文标题](URL)（作者，许可）。未收录内容与编者注需说明。`

## 质量要求
- 结构：为什么需要它 → 概念 → 可运行代码 → 常见坑 → 延伸阅读。中文正文 ≥ 2500 字（参考/清单类可短，但要能独立学会）。
- 代码：必须可跑；注释译成中文；不保留 notebook 的 `%pip`、`display()`、`...` 占位与未定义变量；安装命令给全。
- 来源：优先官方文档、经典论文、一手名家原文、高星仓库 README；禁止二手搬运站、CSDN、营销号。许可要读 LICENSE 核实。
- 时效：示例模型与参数用 2026-09 现行（模型名参考 `docs/04-llm-basics/07-*.md` 与 `docs/10-finetuning-deployment/18-*.md`；OpenAI 侧用 `max_completion_tokens`、Responses API，不写 `max_tokens`/`purpose="assistants"`）。正文内不得硬编码 API Key。
- 交叉引用：写《文章标题》，不要写「第 N 篇」「模块 N」。
- 禁止内部工作流话术（「本篇为重做版」「替换原先编者总结」「curl HTTP 000」「任务规划中」等），自检：`node scripts/scan-leaks.mjs docs/<你的模块>`。

## 抓取渠道
- GitHub 文件用 `curl -sSL https://raw.githubusercontent.com/<org>/<repo>/<branch>/<path>`（沙箱里 node fetch 对 raw.githubusercontent 不稳定，用 curl）。
- 网页文档用 WebFetch；被反爬时用 `curl -sSL` 加 UA，仍失败就换同等权威来源并如实署名，不要伪造来源。
- 图片必须本地化到模块目录 `assets/` 下并用相对路径引用，不留外链热链。
