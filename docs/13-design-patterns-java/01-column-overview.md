---
title: 专栏导读：iluwatar/java-design-patterns 与设计模式总览
source_url: https://github.com/iluwatar/java-design-patterns
author: iluwatar/java-design-patterns 社区
license: MIT（仓库 LICENSE.md 原文核实；代码与说明文档教学性翻译转载，逐篇署名）
fetched_at: 2026-09-13
translated: true
order: 1
---

# 专栏导读：iluwatar/java-design-patterns 与设计模式总览

本专栏是 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns) 仓库的中文教学导读。这个仓库是 GitHub 上 Star 数最高的 Java 设计模式开源项目（截至 2026 年 9 月约 9.47 万 Star、418 位贡献者），由 Ilkka Seppälä（iluwatar）发起并维护。本篇导读的内容（项目定位、设计理念、学习方法）译自仓库 README 原文，篇末的完整模式索引则基于仓库各模式目录 README 中标注的官方分类逐项核实整理（对应 master 分支 HEAD 提交 `4cabb20`，2026-09-13）。后续四篇将分别精讲创建型、结构型、行为型与企业级架构模式，每个模式均附仓库真实 Java 实现代码。

## 一、仓库 README 全译：项目定位与设计理念

以下为仓库主 README（master 分支）正文各节的完整翻译，小节标题对应原文。

### Introduction（引言）

> 设计模式是程序员在设计应用或系统时，用来解决常见问题的最好的、已形式化的实践。
>
> 设计模式能够提供经过测试、被验证有效的开发范式，从而加快开发进程。
>
> 复用设计模式有助于避免那些会演变成重大问题的细微缺陷，也能提升代码对熟悉这些模式的程序员和架构师的可读性。

### Getting Started（入门）

> 本站展示 Java 设计模式。这些解决方案由开源社区中经验丰富的程序员和架构师开发。你既可以通过模式的高层描述来浏览它们，也可以直接阅读它们的源代码。源代码示例注释完善，可以当作讲解"如何实现某个具体模式"的编程教程。项目使用了最流行、经过实战检验的开源 Java 技术。
>
> 在深入这些材料之前，你应当先熟悉各种软件设计原则。
>
> 所有设计都应当尽可能简单。你应当从 KISS、YAGNI 和"做最简单可行之事"（Do The Simplest Thing That Could Possibly Work）原则出发。只有当实际的可扩展性确有需要时，才引入复杂度和模式。
>
> 熟悉这些概念之后，你可以通过以下任意方式深入研究可用设计模式：
>
> - 按名称搜索特定模式。找不到想要的？可以在仓库 issue 中提出新增模式的请求。
> - 使用标签（tag）浏览，例如 Performance（性能）、Gang of Four（四人帮）或 Data access（数据访问）。
> - 使用模式分类浏览：创建型（Creational）、行为型（Behavioral）等。

### How to Contribute（如何贡献）

> 如果你愿意为项目做贡献，可以在项目的 developer wiki 中找到相关信息。维护者会在 Gitter 聊天室中帮助你并回答问题。

### The Book（配套书籍）

> 这些设计模式现已出版为电子书《Open Source Java Design Patterns》。项目贡献者可以免费获得这本书。

### License（许可证）

> 本项目基于 MIT 许可证授权。（仓库 LICENSE.md 原文：The MIT License, Copyright 2014-2024 Ilkka Seppälä；另注：model-view-viewmodel 模块使用了 ZK 框架，该框架以 LGPL 授权，见仓库 lgpl-3.0.txt。）

需要说明的是：本专栏此前策划时曾按 Apache-2.0 口径拟稿，经对仓库 LICENSE.md、README 徽章及每个 Java 文件的许可头逐项核实，该仓库实际采用 **MIT 许可证**，本文及后续各篇的署名信息均按 MIT 标注。

另外，仓库提供了官方多语言 README（含简体中文 localization/zh），但只覆盖主 README；各模式目录下的英文说明文档尚无官方中文版，本专栏的模式说明翻译均为编者依据英文原文的完整翻译。

README 的开头还有一句值得注意的信息（全译）："用不同语言阅读：简体中文（zh）、繁体中文（zh-TW）、韩语、法语、土耳其语、阿拉伯语、西班牙语、葡萄牙语、印尼语、俄语、德语、日语、越南语、孟加拉语、尼泊尔语、意大利语、丹麦语。"主 README 已由社区翻译成包括简体中文在内的 17 种语言，但各模式目录下的详细说明文档（本专栏的翻译对象）仍以英文为准。

## 二、如何使用这个仓库学习（编者导读）

结合 README 的建议与仓库结构，推荐如下学习路径：

1. **先立原则，再学模式**。README 强调"所有设计都应尽可能简单"，模式是应对实际扩展需求的工具而非炫耀的资本。建议先阅读其网站 java-design-patterns.com/principles/ 上的软件设计原则（KISS、YAGNI、DRY、关注点分离等）。
2. **按"分类 → 标签 → 单模式"三级导航**。仓库共有约 190 个模式目录，每个目录自成一个 Maven 模块，包含 README.md（意图、真实世界类比、程序化示例、适用场景、利弊权衡、关联模式）、`etc/` 下的 UML/时序图，以及 `src/main/java` 与 `src/test/java` 下的可运行实现与单元测试。README 给出的三种导航方式分别是：按名称搜索特定模式（找不到可以在仓库 issue 里提议新增）；按标签浏览（如 Performance 性能、Gang of Four 四人帮、Data access 数据访问）；按分类浏览（创建型、行为型等）。仓库配套网站 java-design-patterns.com 也提供同样的索引。
3. **每个模式按 README 的固定结构学习**：Intent（意图）→ Real-world example（真实世界类比）→ Programmatic example（代码示例）→ When to use（何时使用）→ Real-world applications（真实框架中的应用）→ Benefits and trade-offs（收益与代价）→ Related patterns（关联模式）。本专栏后续四篇对每个模式的讲解即按此结构展开。
4. **跑代码，而非只看图**。仓库的每个模块都可以独立编译运行，示例大量使用 Java 8+ 的 Lambda、Stream、record、switch 表达式等特性，是学习现代 Java 惯用法的好素材。每个模式都配有单元测试（`src/test/java`），把测试当作该模式行为的"可执行规格说明"来读，往往比读图更快建立直觉。
5. **从关联模式走出去**。每个 README 末尾的 Related patterns 一节会把相邻模式串成网——例如从抽象工厂可以走到工厂方法、单例与工厂套件。沿着这张网学习，比按字母序逐个击破更接近模式在真实设计中的组织方式。

## 三、全仓库模式总索引（190 个，按仓库官方分类）

仓库根目录下共有 196 个顶级目录，其中 190 个为模式目录（另有 component、serialized-entity 两个模式目录未标注分类，以及 .github、.mvn、assets、localization 四个非模式目录）。以下按每个模式 README frontmatter 中标注的官方 category 归类列全。表中模式名即仓库目录名，可直接拼接浏览：`https://github.com/iluwatar/java-design-patterns/tree/master/<目录名>`。

每个模式目录的标准结构如下（以仓库文件树核实）：`README.md`（说明文档，正文结构见前文）、`etc/`（UML 类图、时序图、URM 图等图片资源）、`pom.xml`（独立 Maven 模块）、`src/main/java`（模式实现，包名 `com.iluwatar.<模式名>`）与 `src/test/java`（单元测试）。仓库整体是一个多模块 Maven 工程，根目录的 `mvnw` 可直接构建全部模式；据根 `pom.xml`，代码以 Java 21（source/target 21）编译，并大量使用 Lombok 与 record、switch 表达式、var 等现代语法。

按仓库官方分类统计：行为型 41 个、结构型 34 个、架构 28 个、并发 23 个、创建型 14 个、数据访问 12 个、弹性 8 个、函数式 8 个、集成 6 个、消息 4 个、测试 4 个、性能优化 3 个、资源管理 3 个，另有服务发现 1 个、惯用法 1 个——合计 190 个。体量上它已远超任何一本模式教科书：GoF 只给出 23 个"类级"模式，而这个仓库把同一方法论推到了并发、架构、云原生与测试的尺度。

编者建议的选型姿势：遇到"对象怎么造"的问题先查创建型表；遇到"结构怎么搭"查结构型与架构表；遇到"职责怎么传"查行为型表；遇到"系统集成、数据一致性、弹性"则去 Integration、Data access、Resilience 分类找——这些正是传统 GoF 教材不覆盖、而本仓库最有工程价值的部分。

### GoF 23 经典模式对照

《设计模式：可复用面向对象软件的基础》（GoF，1994）提出的 23 个经典模式在仓库中全部有独立实现，对照如下：

| 分类 | GoF 模式 | 仓库目录 |
| --- | --- | --- |
| 创建型（5） | 工厂方法 | factory-method |
| | 抽象工厂 | abstract-factory |
| | 建造者 | builder |
| | 原型 | prototype |
| | 单例 | singleton |
| 结构型（7） | 适配器 | adapter |
| | 桥接 | bridge |
| | 组合 | composite |
| | 装饰器 | decorator |
| | 外观 | facade |
| | 享元 | flyweight |
| | 代理 | proxy |
| 行为型（11） | 责任链 | chain-of-responsibility |
| | 命令 | command |
| | 解释器 | interpreter |
| | 迭代器 | iterator |
| | 中介者 | mediator |
| | 备忘录 | memento |
| | 观察者 | observer |
| | 状态 | state |
| | 策略 | strategy |
| | 模板方法 | template-method |
| | 访问者 | visitor |

GoF 23 之外，仓库最大的增量在于企业级内容：它把 Eric Evans《领域驱动设计》、Martin Fowler《企业应用架构模式》（PoEAA）、微软 Azure 云设计模式文库以及微服务社区的众多模式悉数收录（见下表 Architectural、Data access、Integration、Resilience 等分类），这也是它区别于一般模式教程的核心价值。


### 创建型模式（Creational，14 个）

| 模式 | 中文 | 模式 | 中文 |
| --- | --- | --- | --- |
| abstract-factory | 抽象工厂 | object-pool | 对象池 |
| builder | 建造者 | prototype | 原型 |
| dependency-injection | 依赖注入 | registry | 注册表 |
| factory | 工厂 | singleton | 单例 |
| factory-kit | 工厂套件 | step-builder | 步进建造者 |
| factory-method | 工厂方法 | type-object | 类型对象 |
| monostate | 单态 | multiton | 多例 |

### 结构型模式（Structural，34 个）

| 模式 | 中文 | 模式 | 中文 |
| --- | --- | --- | --- |
| abstract-document | 抽象文档 | money | 货币 |
| adapter | 适配器 | parameter-object | 参数对象 |
| bridge | 桥接 | private-class-data | 私有类数据 |
| business-delegate | 业务委托 | proxy | 代理 |
| composite | 组合 | role-object | 角色对象 |
| composite-entity | 复合实体 | separated-interface | 分离接口 |
| composite-view | 复合视图 | servant | 仆人 |
| converter | 转换器 | service-locator | 服务定位器 |
| curiously-recurring-template-pattern | 奇异递归模板 | session-facade | 会话外观 |
| dao-factory | DAO 工厂 | spatial-partition | 空间分区 |
| data-access-object | 数据访问对象 | special-case | 特例 |
| data-transfer-object | 数据传输对象 | strangler | 绞杀者 |
| decorator | 装饰器 | twin | 孪生 |
| domain-model | 领域模型 | value-object | 值对象 |
| dynamic-proxy | 动态代理 | virtual-proxy | 虚代理 |
| extension-objects | 扩展对象 | marker-interface | 标记接口 |
| facade | 外观 | flyweight | 享元 |

### 行为型模式（Behavioral，41 个）

| 模式 | 中文 | 模式 | 中文 |
| --- | --- | --- | --- |
| acyclic-visitor | 无环访问者 | fluent-interface | 流式接口 |
| bytecode | 字节码 | game-loop | 游戏循环 |
| chain-of-responsibility | 责任链 | health-check | 健康检查 |
| client-session | 客户端会话 | identity-map | 同一性映射 |
| collecting-parameter | 收集参数 | interpreter | 解释器 |
| command | 命令 | iterator | 迭代器 |
| commander | 指挥官 | mediator | 中介者 |
| context-object | 上下文对象 | memento | 备忘录 |
| data-mapper | 数据映射器 | mute-idiom | 静默惯用法 |
| delegation | 委托 | notification | 通知 |
| dirty-flag | 脏标记 | null-object | 空对象 |
| double-buffer | 双缓冲 | observer | 观察者 |
| double-dispatch | 双重分派 | partial-response | 部分响应 |
| execute-around | 环绕执行 | pipeline | 管道 |
| feature-toggle | 功能开关 | rate-limiting-pattern | 限流 |
| rule-engine | 规则引擎 | specification | 规格 |
| state | 状态 | strategy | 策略 |
| subclass-sandbox | 子类沙盒 | template-method | 模板方法 |
| templateview | 模板视图 | update-method | 更新方法 |
| visitor | 访问者 | property | 属性 |

### 并发模式（Concurrency，23 个）

active-object（活动对象）、actor-model（Actor 模型）、async-method-invocation（异步方法调用）、backpressure（背压）、balking（阻塞/退缩）、double-checked-locking（双重检查锁）、event-based-asynchronous（基于事件的异步）、event-queue（事件队列）、fanout-fanin（扇出扇入）、fork-join（分治合并）、guarded-suspension（保护性暂挂）、half-sync-half-async（半同步半异步）、leader-election（领导者选举）、leader-followers（领导者跟随者）、lockable-object（可锁定对象）、master-worker（主从）、monitor（管程）、poison-pill（毒丸）、producer-consumer（生产者消费者）、promise（承诺）、reactor（反应器）、thread-pool-executor（线程池执行器）、thread-specific-storage（线程特有存储）。

### 架构模式（Architectural，28 个）

backends-for-frontends（前后端各一后端）、bloc、clean-architecture（整洁架构）、command-query-responsibility-segregation（命令查询职责分离，CQRS）、event-driven-architecture（事件驱动架构）、event-sourcing（事件溯源）、flux、front-controller（前端控制器）、hexagonal-architecture（六边形架构）、intercepting-filter（拦截过滤器）、layered-architecture（分层架构）、microservices-aggregrator（微服务聚合器）、microservices-client-side-ui-composition（微服务客户端 UI 组合）、microservices-distributed-tracing（微服务分布式追踪）、model-view-controller（MVC）、model-view-intent（MVI）、model-view-presenter（MVP）、model-view-viewmodel（MVVM）、monolithic-architecture（单体架构）、naked-objects、onion-architecture（洋葱架构）、page-controller（页面控制器）、polling-publisher（轮询发布者）、presentation-model（表现模型）、service-layer（服务层）、service-to-worker、transactional-outbox（事务性发件箱）、view-helper（视图助手）。

### 数据访问模式（Data access，12 个）

metadata-mapping（元数据映射）、optimistic-offline-lock（乐观离线锁）、repository（仓储）、serialized-lob（序列化大对象）、sharding（分片）、single-table-inheritance（单表继承）、table-inheritance（表继承）、table-module（表模块）、transaction-script（事务脚本）、unit-of-work（工作单元）、version-number（版本号）、write-ahead-log（预写日志）。

### 集成模式（Integration，6 个）

ambassador（大使）、anti-corruption-layer（防腐层）、gateway（网关）、microservices-api-gateway（微服务 API 网关）、microservices-log-aggregation（微服务日志聚合）、microservices-messaging（微服务消息传递）。

### 消息模式（Messaging，4 个）

data-bus（数据总线）、event-aggregator（事件聚合器）、microservices-idempotent-consumer（微服务幂等消费者）、publish-subscribe（发布订阅）。

### 弹性模式（Resilience，8 个）

circuit-breaker（熔断器）、fallback（回退）、microservices-bulkhead（微服务舱壁隔离）、microservices-load-shedding（微服务负载削减）、queue-based-load-leveling（基于队列的负载均衡）、retry（重试）、saga、tolerant-reader（宽容读者）。

### 性能优化模式（Performance optimization，3 个）

caching（缓存）、data-locality（数据局部性）、lazy-loading（惰性加载）。

### 函数式模式（Functional，8 个）

callback（回调）、collection-pipeline（集合管道）、combinator（组合子）、currying（柯里化）、function-composition（函数组合）、map-reduce（映射归约）、monad（单子）、trampoline（蹦床）。

### 其他分类

- **测试（Testing，4 个）**：arrange-act-assert（准备-执行-断言）、object-mother（对象母体）、page-object（页面对象）、service-stub（服务桩）。
- **资源管理（Resource management，3 个）**：resource-acquisition-is-initialization（RAII）、server-session（服务器会话）、throttling（节流）。
- **服务发现（Service Discovery，1 个）**：microservices-self-registration（微服务自注册）。
- **惯用法（Idiom，1 个）**：immutable（不可变）。
- **未标注分类**：component（组件）、serialized-entity（序列化实体）。

## 四、本专栏篇目与本篇使用说明

后续四篇按"创建 → 结构 → 行为 → 架构"的经典次序展开，每一篇都可独立阅读：你可以直接跳到当下工作最需要的分类，也可以按顺序通读建立完整的模式坐标系。四篇共精讲 37 个模式，全部出自仓库实际存在的目录，全部附真实 Java 代码；未被精讲的模式，可循本篇的总索引按图索骥。

| 篇目 | 内容 |
| --- | --- |
| 02 创建型模式 | singleton、factory-method、abstract-factory、builder、prototype、object-pool、factory-kit、lazy-loading |
| 03 结构型模式 | adapter、bridge、composite、decorator、facade、flyweight、proxy、private-class-data |
| 04 行为型模式 | strategy、observer、chain-of-responsibility、command、template-method、state、visitor、mediator、memento、interpreter、iterator、null-object |
| 05 企业级架构模式 | ambassador、anti-corruption-layer、actor-model、arrange-act-assert、data-transfer-object、unit-of-work、monostate、event-driven-architecture、layered-architecture（附 CQRS、repository 延伸阅读） |

需要提醒的是，仓库官方分类与本专栏的"经典四分法"并不完全重合：例如 lazy-loading 在仓库中被归入性能优化（Performance optimization）类，data-transfer-object 被归入结构型，monostate 被归入创建型，actor-model 被归入并发类。专栏第 02 篇把 lazy-loading、第 05 篇把 monostate、DTO 与 actor-model 收进来，是按教学脉络的编排，各篇中均以仓库官方分类为准作出标注。

---

> **来源**：本文基于 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns) 仓库原文（MIT 许可证）翻译整理，Java 代码引自仓库实现，版权归原仓库作者所有。
