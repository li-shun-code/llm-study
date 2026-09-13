# 模块 2（计算机基础）来源报告

抓取日期：2026-09-13。目标 ≥23 篇，实际完成 23 篇，全部为英文一手资料翻译（未使用小林 coding）。

## 2026-09-13 补充：新增 4 篇（总 27 篇）

Git 小组聚簇重排后新增 07/08/13/19 四篇，其余文章顺次重编号（07-10 → 09-12，11-14 → 14-17，15 → 18，16-23 → 20-27），frontmatter order 与 index.md 知识点清单已同步。

| # | 文章 | 来源（一手资料） | 许可 |
|---|---|---|---|
| 07 | Git 进阶：rebase、cherry-pick 与冲突解决 | Pro Git 2e（git-scm.com/book/en/v2）：7.1 Revision Selection、3.6 Rebasing、7.8 Advanced Merging、5.1 Distributed Workflows、5.3 Maintaining a Project（cherry-pick/rerere 小节），核心内容完整翻译 | CC BY-NC-SA 3.0 |
| 08 | GitHub Actions 与 CI 基础 | GitHub 官方文档：Understanding GitHub Actions（全文翻译）+ Workflow syntax for GitHub Actions（保留日常必需骨架的核心条目节译） | CC BY 4.0 |
| 13 | 信号与进程间通信 IPC | Beej's Guide to Unix IPC（beej.us/guide/bgipc）：第 3 章 Signals、第 5 章 Pipes、第 6 章 FIFOs、第 11 章 System V Shared Memory Segments 完整翻译；死锁一节完整翻译自 OSTEP 第 32 章 threads-deadlock.pdf（官方 PDF 用 pypdf 提取） | CC BY-NC-ND 3.0（含官方翻译例外条款）+ CC BY-NC-SA 4.0（OSTEP 节） |
| 19 | epoll 与事件循环 | Linux man-pages（man7.org）：epoll(7) 核心内容完整翻译 + epoll_ctl(2)/epoll_wait(2)/epoll_create(2) 的 DESCRIPTION 翻译；引言节译自 Beej bgnet0 §29.1；"为什么 asyncio 需要它"一节为编者补充桥接（文中已标注） | GPL-2.0-or-later（man-pages，SPDX 见源文件头）+ CC BY-NC-ND 3.0（Beej 引言节） |

补充说明：

- **bgnet0 无 epoll 章节**：任务建议的 beej.us/guide/bgnet0/html/split/epoll.html 为 404，且经全文检索确认现行 bgnet/bgnet0 版本均无 epoll 内容（bgnet 全文 0 次提及），故按任务备选改用 man7.org epoll 官方 man-pages 为主来源，Beej 侧取 bgnet0 第 29 章"问题"一节做概念衔接。
- **beej IPC 许可核实**：bgipc 版权页与 bgnet 同为 CC BY-NC-ND 3.0 并含同一翻译例外条款，署名块中已如实说明。
- **man-pages 许可核实**：epoll(7)/epoll_ctl(2)/epoll_wait(2)/epoll_create(2) 源文件头 SPDX 为 GPLv2+_SW_3_PARA（GPL-2.0-or-later）。
- **重排方式**：两段式重命名（先 tmp- 前缀再定名）防覆盖，仅限 docs/02-cs-fundamentals/ 目录内。
- 未执行 vitepress build 与 git 提交（按任务约束）。

## 初始 23 篇（2026-09-13）

抓取日期：2026-09-13。目标 ≥23 篇，实际完成 23 篇，全部为英文一手资料翻译（未使用小林 coding）。

## 抓取失败与替代

| 主题 | 原 URL | 失败原因 | 替代文章 |
|---|---|---|---|
| 网络分层模型（OSI） | https://www.cloudflare.com/learning/network-layer/osi-model/ | curl 与 WebFetch 均被 Cloudflare 自家 CDN 挑战页拦截（HTTP 403 "Just a moment..."），web_reader 服务限流 | 16 篇改译 Beej's Guide to Network Concepts（bgnet0）"The Layered Network Model"（beej.us，CC BY-NC-ND 3.0 含翻译例外条款） |
| TCP | https://www.cloudflare.com/learning/network-layer/what-is-tcp/ | 同上（403） | 17 篇改译 bgnet0 第 14 章 "Transmission Control Protocol (TCP)" |
| UDP | https://www.cloudflare.com/learning/ddos/glossary/user-datagram-protocol-udp/ | 同上（403） | 18 篇改译 bgnet0 第 15 章 "User Datagram Protocol (UDP)" |
| HTTPS/TLS | https://www.cloudflare.com/learning/ssl/transport-layer-security-tls/ | 同上（403） | 20 篇改译 MDN "Transport Layer Security (TLS)"（developer.mozilla.org，CC BY-SA 2.5） |
| DNS | https://www.cloudflare.com/learning/dns/what-is-dns/ | 同上（403） | 22 篇改译 bgnet0 第 31 章 "Domain Name System (DNS)" |
| 操作系统 8 篇（07-14） | https://www.ostep.org/ 各章节页面 | OSTEP 官方章节仅以 PDF 提供（HTML 页面 404/重定向到目录页） | 直接下载官方 PDF（pages.cs.wisc.edu/~remzi/OSTEP/<chapter>.pdf，即 OSTEP 官方分发地址），用 pypdf 提取全文后翻译；仍为 OSTEP 一手资料，许可 CC BY-NC-SA 4.0 |

## 备注

- **OSTEP（07-14 共 8 篇）**：计划中的"PDF 则换 Red Hat Developer"备用方案未启用——成功直接抓取 OSTEP 官方 PDF 全文（intro / cpu-intro / threads-intro / cpu-sched / vm-intro / vm-tlbs / file-intro / threads-locks），保住了最优先的英文一手来源。各篇为讲透知识点对章节做了完整但适度浓缩的翻译，文内已注明章节号。
- **Beej 指南（15-18、22 共 5 篇）**：Beej's Guides 许可为 CC BY-NC-ND 3.0，但作者在许可证文本中明确加入翻译例外条款（"本指南可自由翻译为任何语言，前提是翻译准确且全文转载"）。本模块采用署名节译（选取与知识点直接相关的章节），已在每篇文章的署名块中如实说明许可与例外条款，并向原文链接完整溯源。
- **TLCL（03 篇）**：linuxcommand.org 课程页版权所有 © William E. Shotts，原文允许"保留版权声明的逐字复制"；翻译属演绎使用，已在署名块如实标注"署名学习翻译"。
- **restfulapi.net（23 篇）**：站点内容无开放许可声明，按"转载署名"处理并在署名块标注。
- 临时抓取文件均位于 /tmp/cs2-*，未污染仓库。
- 未执行 vitepress build 与 git 提交（按任务约束）。
