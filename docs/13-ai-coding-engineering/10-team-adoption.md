---
title: 团队落地：AI 编码规范的团队推广与度量
source_url: https://code.claude.com/docs/en/admin-setup
author: Anthropic（Claude Code 官方文档 Set up Claude Code for your organization / Track team usage with analytics）
license: 署名翻译（官方文档 Copyright Anthropic PBC，教学用途编译翻译并署名）
fetched_at: 2026-09-13
translated: true
order: 10
group: 团队与产品落地
---
上一篇把成本从个人账单升到了组织账单；本篇走完组织的最后两步：**推广**（怎么把工具和规范安全地铺给全体开发者）与**度量**（怎么用数据回答"值不值"）。本篇编译两份官方文档：《Set up Claude Code for your organization》（管理员的部署决策地图）与《Track team usage with analytics》（采纳与贡献度量）。你会发现前面各篇的"个人手艺"——权限规则、CLAUDE.md、技能、hooks——在组织层全部有一个"管理版"。

## 一、推广：管理员的部署决策地图（译自 admin-setup 官方文档）

Claude Code 通过**托管设置（managed settings）**执行组织策略——其优先级高于开发者的本地配置，通过 Claude 管理后台、MDM（移动设备管理）系统或磁盘文件下发，控制 Claude 能触及哪些工具、命令、服务器与网络目的地。部署决策按顺序过五道：

1. **选 API 提供方**：Claude 订阅、Claude Console（API）、或 Amazon Bedrock / Google Cloud / Microsoft Foundry 等云
2. **决定设置如何到达设备**：服务端托管设置、MDM 策略或 `managed-settings.json`
3. **决定强制什么**（下表）
4. **建立用量可见性**（本篇第二节）
5. **审查数据处理与完成上线验证**

### "决定强制什么"的控制面清单

| 控制 | 作用 |
| --- | --- |
| 权限规则 | Allow/Ask/Deny 特定工具与命令（前述的规则在组织层统一配置） |
| 权限锁定 | 让托管设置成为权限规则的唯一来源；禁用 `--dangerously-skip-permissions` |
| 起始权限模式 | 统一指定开发者会话的起始模式，或移除 auto 模式 |
| 沙箱 | OS 级文件系统与网络隔离 + 域名白名单 |
| 托管策略 CLAUDE.md | **全组织统一的项目指令，每次会话加载且不可排除**——AI 编码规范的官方载体 |
| MCP 服务器管控 | 限制用户能添加/连接哪些 MCP 服务器，或统一下发一组 |
| 插件市场管控 | 限制插件来源、阻断侧载、白名单市场 |
| 定制锁定 | 阻断来自用户/项目源的技能、智能体、hooks 与 MCP——只允许插件与托管设置 |
| 登录强制 | 限定登录方式与组织 |
| 模型限制与努力上限 | `availableModels` 过滤可选模型；按模型封顶 effort 档位 |

> 译注：这张表就是"团队 AI 编码规范"的技术形态——规范不是发一篇 wiki 文档，而是**由配置强制执行的行为边界**：哪些命令永远 deny、CLAUDE.md 统一写什么、MCP 与插件从哪装。第 4-11 篇讲的所有"项目级约定"，在企业层都可以升级为"不可绕过的层"。

## 二、度量：采纳与贡献指标（译自 analytics 官方文档）

Claude Code 的分析面板（Teams/Enterprise 在 claude.ai/analytics/claude-code，API 客户在 Console）提供四类能力：

- **用量指标**：接受的代码行数、建议接受率（suggestion accept rate）、日活用户与会话数
- **贡献指标**（公开测试版，需连接 GitHub 组织）：经 Claude Code 协助交付的 PR 数与代码行数
- **排行榜**：按使用量排名的贡献者
- **数据导出**：CSV 下载做自定义报表

### 贡献指标怎么算（官方口径）

官方特别声明：这些指标**刻意保守、是实际影响的低估**——只统计"高置信度确有 Claude Code 参与"的行与 PR。四个核心指标：

- **PRs with CC**：包含至少一行 Claude Code 代码的已合并 PR 总数
- **Lines of code with CC**：合并 PR 中由 Claude Code 协助编写的"有效行"（规范化后超过 3 字符，排除空行与纯括号行）
- **PRs with Claude Code (%)**：全部已合并 PR 中含 CC 代码的比例
- **建议接受率 / 接受行数**：用户接受 Edit/Write 等代码编辑建议的比例与行数（不含被拒绝的建议，也不追踪后续删除）

启用需要 Owner 角色 + GitHub 管理员安装 Claude GitHub App，数据通常 24 小时内出现、每日更新（启用零数据保留的组织不支持贡献指标）。

### 官方给出的两种用法

**监控采纳（Monitor adoption）**：盯采纳曲线与用户数，找出——能分享最佳实践的活跃用户；组织层面的采纳趋势；**可能暗示摩擦或问题的用量凹陷**。

**度量 ROI（Measure ROI）**：用你自己代码库的数据回答"这工具值不值"：随采纳增长追踪人均 PR 变化；对比"有/无 Claude Code 协助"的 PR 与交付行数；并与 **DORA 指标、sprint velocity 或其他工程 KPI 并排**解读。

> 译注：官方建议里最有分量的是最后半句——AI 编码的度量必须挂在既有工程度量体系上，而不是发明一套"AI KPI"。这与前述的结论互为表里：AI 放大的是你已有的工程实践——好的更好，坏的更坏。度量同理：它放大的是你已有的度量纪律。

## 三、一份可执行的团队落地清单（本站编者补充）

综合两份官方文档与本模块各篇，把"推广 AI 编码"收敛为一个五步循环：

1. **试点建立基线**（《成本管理：Token 消耗、订阅选择与用量优化》）：5-10 人小团队跑一个月，用 `/usage`、`/insights` 与 OpenTelemetry 记下人均成本与用法定型
2. **把经验固化成配置**：试点中发现的高频错误写成托管 CLAUDE.md 条目；重复流程做成技能（《Claude Skills：可复用技能包》）；高危命令进 deny 规则（《Claude Code 权限系统与安全机制》）——**规范从实践中来，而不是从管理层脑子里来**
3. **分层强制**：个人喜好留在用户级，安全与合规进托管设置（表中的锁定项），项目差异进各仓库的 AGENTS.md（《AGENTS.md 与 CLAUDE.md：给智能体的项目规范文件》）
4. **双轨度量**：采纳指标（日活、接受率、用量凹陷）周报；效果指标（PRs with CC、人均 PR、DORA）月报——**先看"有没有用起来"，再看"用出效果没有"**
5. **复盘循环**：每季度回到第 2 步——工具与最佳实践都在快速演进（本模块每篇的时效注记就是证据），落地配置必须跟着版本走

---

> 下一篇预告：方法论与组织都讲完了，最后一篇回到个人视角收束全模块——《从 0 到 1 用 AI 做产品》：Geoffrey Huntley 为什么要说"未来属于能直接动手的人"。

> **来源**：本文第一、二节分别译自 [Set up Claude Code for your organization](https://code.claude.com/docs/en/admin-setup) 与 [Track team usage with analytics](https://code.claude.com/docs/en/analytics)（Claude Code 官方文档，2026-09 当前版），作者 Anthropic，许可署名翻译（Copyright Anthropic PBC，教学用途）。第三节为本站编者补充并已标明。抓取于 2026-09-13。
