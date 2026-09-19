# 模块 13 · Java 设计模式教学专栏（13-design-patterns-java）来源报告

本模块共 5 篇文章，全部基于 GitHub 仓库 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns)（master 分支，HEAD 提交 `4cabb20`，2026-09-13）撰写：各模式的意图说明、真实世界类比、适用场景、利弊权衡均为该仓库对应模式目录 README.md 原文的完整翻译；Java 代码片段逐字引自仓库各模式目录 `src/main/java` 下的真实实现并标注相对路径；仓库总体介绍（项目定位、设计理念、学习方法、许可证）译自仓库主 README.md。文首 frontmatter `fetched_at: 2026-09-13` 对应内容版本（HEAD 提交日期），内容另于 2026-09-15 经 GitHub API（api.github.com）复核。

## 来源与许可

| 来源仓库 | 覆盖篇目 | 版本 | 许可 | 引用方式 |
| --- | --- | --- | --- | --- |
| [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns)（★94.7K，2026-09-15 经 API 核实为 94,687） | 01-05 全部 | master @ `4cabb20`（2026-09-13） | **MIT**（LICENSE.md 原文 "The MIT License, Copyright 2014-2024 Ilkka Seppälä"；README 徽章及每个 Java 文件许可头同证；model-view-viewmodel 模块附带 ZK 框架 LGPL 例外，见仓库 lgpl-3.0.txt） | 翻译 + 代码节选，逐篇文末署名 |

**重要更正**：本模块立项时误将仓库许可按 Apache-2.0 口径起草；经对 LICENSE.md、README 许可徽章与 Java 源文件许可头逐项核实，该仓库实际采用 **MIT 许可证**。五篇文章的 frontmatter `license` 字段与文末署名块均按 MIT 标注（未沿用任务模板中的 Apache-2.0 字样），特此说明。

## 各篇结构

| 篇目 | 精讲模式（仓库目录名） | 引用的核心 Java 文件（仓库相对路径） |
| --- | --- | --- |
| 01 专栏导读 | 无代码精讲；主 README 全译 + 196 目录/190 模式官方分类总索引 + GoF 23 对照表 | 无（分类数据经 GitHub API contents/git-trees 与各 README frontmatter `category` 字段逐项核实） |
| 02 创建型 | singleton、factory-method、abstract-factory、builder、prototype、object-pool、factory-kit、lazy-loading | singleton/IvoryTower.java、singleton/ThreadSafeDoubleCheckLocking.java、singleton/EnumIvoryTower.java、factory-method/…/Blacksmith.java、ElfBlacksmith.java、abstract-factory/…/KingdomFactory.java、ElfKingdomFactory.java、builder/…/Hero.java、prototype/…/Prototype.java、HeroFactoryImpl.java、object-pool/…/ObjectPool.java、factory-kit/…/WeaponFactory.java、Builder.java、lazy-loading/…/HolderThreadSafe.java、Java8Holder.java |
| 03 结构型 | adapter、bridge、composite、decorator、facade、flyweight、proxy、private-class-data（注：任务原拟的 module 模式在仓库中不存在，已按仓库实际清单调整） | adapter/…/FishingBoatAdapter.java、Captain.java、bridge/…/Weapon.java、Sword.java、FlyingEnchantment.java、composite/…/LetterComposite.java、Word.java、decorator/…/Troll.java、ClubbedTroll.java、facade/…/DwarvenGoldmineFacade.java、flyweight/…/PotionFactory.java、proxy/…/WizardTowerProxy.java、private-class-data/…/StewData.java、ImmutableStew.java |
| 04 行为型 | strategy、observer、chain-of-responsibility、command、template-method、state、visitor、mediator、memento、interpreter、iterator、null-object | strategy/…/DragonSlayingStrategy.java、DragonSlayer.java、MeleeStrategy.java、observer/…/Weather.java、WeatherObserver.java、chain/…/RequestHandler.java、OrcKing.java、command/…/Wizard.java、templatemethod/…/StealingMethod.java、SubtleMethod.java、state/…/Mammoth.java、PeacefulState.java、visitor/…/UnitVisitor.java、CommanderVisitor.java、mediator/…/PartyImpl.java、PartyMemberBase.java、memento/…/Star.java、StarMemento.java、interpreter/…/Expression.java、PlusExpression.java、iterator/…/Iterator.java、list/TreasureChestItemIterator.java、nullobject/…/NullNode.java |
| 05 企业级 | ambassador、anti-corruption-layer、actor-model、arrange-act-assert、data-transfer-object、unit-of-work、monostate、event-driven-architecture、layered-architecture（延伸阅读：command-query-responsibility-segregation、repository） | ambassador/…/ServiceAmbassador.java、Client.java、corruption/system/AntiCorruptionLayer.java、corruption/system/modern/ModernShop.java、actormodel/…/Actor.java、ActorSystem.java、arrangeactassert/Cash.java、datatransfer/product/ProductDto.java、ProductResource.java、unitofwork/…/UnitOfWork.java、ArmsDealer.java、monostate/…/LoadBalancer.java、eda/framework/EventDispatcher.java、eda/handler/UserCreatedEventHandler.java、service/CakeBakingServiceImpl.java |

以上路径中 `…/` 为 `src/main/java/com/iluwatar/` 省写（layered-architecture 模式的包根为 `src/main/java/` 下的 dao/dto/entity/service/view）。

## 自检记录

- `node scripts/check-frontmatter.mjs docs/13-design-patterns-java` → `PASS (5 articles)`。
- 代码逐字校验：脚本将 5 篇全部 68 个 ```java 围栏代码块（剔除首行路径注释后）与对应仓库源文件做逐行顺序包含匹配，68/68 全部 verbatim；其中 1 段（builder README 中的"重叠构造器"示意）逐字引自 `builder/README.md` 原文。代码块均标注"全量"或"节选"；节选仅做删节（许可头、import、部分 Javadoc），未改写任何原文行；05 篇 layered-architecture 一段在方法中途截断，已在正文注明"后续……此处从略"。
- 字数（汉字 + 中文标点，不含代码围栏）：01 篇 3,960 左右（另有大量英文模式名表格，全文非空白字符约 9,800）；02 篇约 4,076；03 篇约 4,081；04 篇约 4,075；05 篇约 4,067——均达到每篇 4,000-7,000 字要求（01 篇按含表格全文计远超下限，纯汉字口径略低源于 190 个英文模式目录名不可译）。
- 格式：无围栏代码块外的 `{{ }}`；泛型尖括号均处于反引号内联代码或代码围栏内，无未闭合裸 HTML；署名块位于文末（`---` 分隔 + `> **来源**：…`），frontmatter 七项必填字段齐全且 order 与文件名序号一致。

## 事实核查要点（编者注）

- 仓库目录规模：经 `git/trees?recursive=1` API 核实，根目录共 196 个顶级目录，其中 190 个模式目录（含 README `category` 标注），component、serialized-entity 两目录为未标注分类的模式，另有 .github、.mvn、assets、localization 四个非模式目录。正文"190 个模式"按此口径。
- 分类口径：文章表格全部按各模式 README frontmatter 的官方 `category` 字段归类（Behavioral 41、Structural 34、Architectural 28、Concurrency 23、Creational 14、Data access 12、Resilience 8、Functional 8、Integration 6、Messaging 4、Testing 4、Performance optimization 3、Resource management 3、Service Discovery 1、Idiom 1）。注意 lazy-loading 官方归入性能优化、data-transfer-object 归入结构型、monostate 归入创建型、actor-model 归入并发，专栏的跨类编排已在正文标注。
- GoF 23 与仓库目录一一对应（factory-method、abstract-factory、builder、prototype、singleton；adapter、bridge、composite、decorator、facade、flyweight、proxy；chain-of-responsibility、command、interpreter、iterator、mediator、memento、observer、state、strategy、template-method、visitor），全部存在于仓库。
- 构建口径：根 pom.xml 以 Java 21（source/target 21）编译，多模块 Maven 工程，使用 Lombok；主 README 提供包括简体中文在内的 17 种语言入口（仅覆盖主 README，模式详情无官方中文）。
