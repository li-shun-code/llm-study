# 模块 2（计算机基础）来源报告

抓取日期：2026-09-13。目标 ≥23 篇，实际完成 23 篇，全部为英文一手资料翻译（未使用小林 coding）。

## 2026-09-18 修订：按子模块分组 + 质量提升（组一/组三复审）

### 分组

全部 27 篇 frontmatter 新增 `group` 字段（侧边栏按此聚合子分组）：

| 组 | 篇目 | order |
|---|---|---|
| Linux 与开发工具 | 01 Linux 常用命令、02 Shell 脚本、03 文件权限、04 SSH、05 Git 基础、06 Git 分支、07 Git 进阶、08 GitHub Actions CI | 1-8 |
| 操作系统 | 09-19（OSTEP/Beej/man-pages 系，本次组一/组三复审未动其正文，该组的排版提升见下一节） | 9-19 |
| 计算机网络 | 20 网络分层、21 DNS、22 TCP、23 UDP、24 HTTP、25 HTTPS、26 SSE 与 WebSocket、27 REST | 20-27 |

文件序号与目标分组顺序完全一致，无需重命名；index.md 知识点清单改为按三大组小标题列出；manifest 每条目同步补充 `group` 字段。

### 质量复审结论（组一 8 篇 + 组三 8 篇逐篇通读）

- **保留 14 篇**：01/02（MIT Missing Semester 完整翻译）、03（TLCL 第 9 课完整翻译）、04（MIT 远程机器一节完整翻译）、05/06（Pro Git 对应章节合译）、07/08（Pro Git 合译与 GitHub Docs 翻译，篇幅与结构良好）、20-24、26（Beej bgnet0 / MDN 完整翻译，含真实代码示例）。均为英文一手来源、排版规范。
- **重做/增补 2 篇**（见下）。
- **修正 3 篇的失效交叉引用**（历史重编号遗留）：22-tcp（"第 16 篇"→第 20 篇、"第 19 篇《UDP》"→第 23 篇）、23-udp（"第 17 篇《DNS》"→第 21 篇）、26-sse-websocket（"第 18 篇《TCP》"→第 22 篇）。

### 重做篇目与替换来源

| # | 文章 | 原来源 | 新来源（一手资料） | 许可 |
|---|---|---|---|---|
| 27 | REST：表述性状态转移（Fielding 论文第 5 章） | restfulapi.net（版权所有、二手博客，来源一般） | Roy T. Fielding 博士论文（UCI, 2000）第 5 章 "Representational State Transfer (REST)" 完整翻译：5.1 七条约束的推导（空风格→客户端-服务器→无状态→缓存→统一接口→分层系统→按需代码）、5.2 数据元素/连接器/组件（含表 5-1/5-2/5-3）、5.3 三种架构视图（稳态、增量渲染、"先响应后思考"等）、5.5 小结；5.3 轻度精简、5.4 精简译出（文中标注），原图 5-1~5-10 从略（文中标注） | 版权所有 © Roy Thomas Fielding, 2000（论文在其主页公开可获取；注明出处的署名学习翻译） |
| 25 | HTTPS 与 TLS | 仅 MDN《Transport Layer Security》（源页面本身很短，全文仅 7KB，内容单薄） | 协议主体改译 IETF **RFC 8446（TLS 1.3）**：第 1 节（安全信道三性质、握手/记录两大组件）、第 1.2 节（TLS 1.3 相对 1.2 的十项主要变化）、第 2 节（完整握手消息流：图 1、三阶段、ClientHello/ServerHello/EncryptedExtensions/CertificateRequest/Certificate/CertificateVerify/Finished）、第 2.2 节（会话恢复与 PSK，图 3）、第 2.3 节（0-RTT，图 4）完整译出；第 1.1/1.3/2.1 节为面向实现者的细节，从略并在文中注明。MDN 的 Web 实践部分（握手概览、配置 TLS、服务器认证、混合内容、HSTS）保留，双来源署名（同 13-signals-ipc 模式） | RFC 8446：IETF Trust Legal Provisions（BCP 78，允许注明出处翻译）；MDN 部分：CC BY-SA 2.5 |

### 过程说明

- Cloudflare 学习中心（25 篇原计划来源）实测仍 HTTP 403；本环境直连 web.archive.org 失败（连接被拒）、web_reader 代理亦报网络错误/限流，故 25 篇按"更好的一手来源"改用 RFC 8446（TLS 协议规范文本，比科普页更深一层），MDN 实践内容保留。
- restfulapi.net 旧译文整体废弃、不再引用，其文末"学习路线图"段落随来源一并移除。
- 25/27 两篇 frontmatter 的 source_url/author/license/fetched_at（2026-09-18）已同步，manifest 条目（URL/topic）已更新。
- 临时文件均位于 /tmp/cf-*（/tmp/cf-fetch/），未污染仓库。
- 未执行 vitepress build 与 git 提交（按任务约束）。

## 2026-09-18 质量提升：操作系统组 11 篇（09-19）

对操作系统组（09 操作系统概述至 19 epoll 与事件循环，frontmatter `group: 操作系统`）做了排版与内容质量提升，来源未更换（仍为 OSTEP / Beej / man-pages 一手资料，frontmatter 与文末署名块相应保持不变）：

- **排版规范**：核查并保留章节标题层级、代码/伪代码围栏、OSTEP 的 ASIDE（Crucial Questions / Tips / Asides）对应的 `> **问题的核心**` / `> **技巧**` / `> **附**` 引用块；18 篇的 Beej 原文小节编号（7.1/7.2/7.3）已按本站标题惯例去除，并在文中注明原章节出处。
- **图表注记**：10/11/15 三篇中以 ASCII 重绘的 OSTEP 原图处，补 `> **图**：原图见 OSTEP 第 X 章` 说明（含对应 Figure 编号）。
- **术语与译笔**：核查关键术语首现英文标注；清理残留英文直译（12 篇 unfortunately/recourse、13 篇 hence/exotic 等）与个别拗口语句。
- **编者补充**：09-18 每篇文末新增明确标注的"编者补充"一节，串联本组前后篇目并对接 LLM 应用场景（进程隔离与推理服务、GIL 与并发、PagedAttention 与分页、mmap 加载权重、HF 缓存的硬/符号链接、SSE 流式服务的多路复用等）；19 篇原有编者按一节更名为"编者补充：为什么 asyncio 需要它"并增补前后篇串联。
- frontmatter 补齐 `group: 操作系统` 字段；manifest 条目（来源 URL）无变化。仅涉及 09-19 十一篇及本报告，未触碰其他组文件。

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
