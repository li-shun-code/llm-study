---
title: 结构型模式：组合优于继承的工程实践
source_url: https://github.com/iluwatar/java-design-patterns
author: iluwatar/java-design-patterns 社区
license: MIT（仓库 LICENSE.md 原文核实；代码与说明文档教学性翻译转载，逐篇署名）
fetched_at: 2026-09-13
translated: true
order: 3
---

# 结构型模式：组合优于继承的工程实践

结构型模式回答"对象如何组装成更大的结构"：用组合、包装与接口适配替代继承膨胀。仓库在结构型（Structural）分类下收录 34 个模式（如 adapter、bridge、composite、decorator、facade、flyweight、proxy、private-class-data、twin、extension-objects、dynamic-proxy、value-object 等）。本篇从中讲解 8 个 GoF 核心与扩展结构型模式。每个模式的意图与适用场景译自该模式目录 README 原文，代码引自仓库真实实现并标注路径。

## 一、适配器（adapter）

> 别名：Wrapper（包装器）。仓库分类：Structural。

**意图（README "Intent of Adapter Design Pattern" 全译）**：适配器模式将一个类的接口转换成客户端所期待的另一个接口，使原本不兼容的类可以协同工作。

**通俗解释（"In plain words" 译）**：适配器模式让你把一个不兼容的对象包装进适配器，使它与另一个类兼容。README 的真实世界类比：内存卡与电脑之间需要读卡器；三脚插头插不进两孔插座，需要电源适配器；以及译者把一个人的话翻译给另一个人。

**仓库实现解析**。场景：船长只会划船（`RowingBoat`），海盗来袭时只有一条渔船（`FishingBoat`，只会 `sail()`）。适配器把渔船"翻译"成划船接口：

```java
// adapter/src/main/java/com/iluwatar/adapter/FishingBoatAdapter.java（全量，略去许可头与 Javadoc）
public class FishingBoatAdapter implements RowingBoat {

  private final FishingBoat boat = new FishingBoat();

  public final void row() {
    boat.sail();
  }
}
```

```java
// adapter/src/main/java/com/iluwatar/adapter/Captain.java（节选）
public final class Captain {

  private RowingBoat rowingBoat;

  void row() {
    rowingBoat.row();
  }
}
```

客户端 `Captain` 只依赖 `RowingBoat` 接口，对背后是渔船毫无感知。

**何时使用（译）**：当你想使用一个已有类但其接口与你需要的不匹配；当你想创建一个可与无关或 unforeseen（不可预见的）类协作的可复用类；当你需要使用若干既有子类、但逐一子类化来适配它们的接口并不现实——对象适配器可以适配其父类的接口。README 还补充了工程实践：多数使用第三方库的应用都会用适配器作为应用与库之间的中间层来解耦，将来换库时只需为新库写一个适配器，应用代码无需改动。

**真实世界应用（README "Real-World Applications" 全译）**：Java IO 库中的 java.io.InputStreamReader 与 java.io.OutputStreamWriter；允许以插件或适配器在不同 GUI 组件接口间转换的 GUI 组件库；以及 JDK 的 java.util.Arrays#asList()、java.util.Collections#list()、java.util.Collections#enumeration()、javax.xml.bind.annotation.adapters.XmlAdapter。

## 二、桥接（bridge）

> 别名：Handle/Body。仓库分类：Structural。

**意图（全译）**：桥接模式将抽象与实现解耦，使二者可以独立变化。这一模式对开发灵活、可扩展的软件系统至关重要。

**通俗解释（"In Plain Words" 译）**：桥接模式的核心是**优先组合而非继承**：把实现细节从一个类层次推送到另一个独立的类层次中。README 的类比是万能遥控器（抽象）与各品牌电视（实现）：遥控器提供一致的开关机、换台、音量接口，各品牌电视各自实现这些操作；新增电视型号无需改遥控器代码。

**仓库实现解析**。仓库的示例是武器与附魔：`Sword`、`Hammer` 是抽象侧的武器层次，`FlyingEnchantment`、`SoulEatingEnchantment` 是实现侧的附魔层次，武器持有附魔（组合）：

```java
// bridge/src/main/java/com/iluwatar/bridge/Weapon.java（全量）
public interface Weapon {

  void wield();

  void swing();

  void unwield();

  Enchantment getEnchantment();
}
```

```java
// bridge/src/main/java/com/iluwatar/bridge/Sword.java（节选）
@Slf4j
@AllArgsConstructor
public class Sword implements Weapon {

  private final Enchantment enchantment;

  @Override
  public void wield() {
    LOGGER.info("The sword is wielded.");
    enchantment.onActivate();
  }

  @Override
  public void swing() {
    LOGGER.info("The sword is swung.");
    enchantment.apply();
  }
}
```

```java
// bridge/src/main/java/com/iluwatar/bridge/FlyingEnchantment.java（节选）
@Slf4j
public class FlyingEnchantment implements Enchantment {

  @Override
  public void onActivate() {
    LOGGER.info("The item begins to glow faintly.");
  }

  @Override
  public void apply() {
    LOGGER.info("The item flies and strikes the enemies finally returning to owner's hand.");
  }
}
```

两把武器 × 两种附魔，继承需要 2×2 个子类，桥接只要 2+2 个类——这正是"避免抽象与实现之间的永久绑定"的量化收益。

**利弊（README "Benefits and Trade-offs" 全译）**：收益——解耦接口与实现、增强模块化；抽象与实现两个层次可独立扩展；客户端只见抽象接口、不见实现细节。代价——增加系统架构与代码的复杂性；多一层抽象会带来运行时开销（实践中通常可以忽略）。

**真实世界应用（README "Real-World Applications" 全译）**：GUI 框架——抽象是窗口，实现是底层操作系统窗口系统；数据库驱动——抽象是通用数据库接口，实现是各数据库专属驱动；设备驱动——抽象是设备无关代码，实现是设备相关代码。

**何时使用（译）**：当需要避免抽象与其实现之间的永久绑定，例如实现必须在运行时选择或切换；当抽象及其实现都应能通过子类化独立扩展；当实现的改动不应影响客户端（客户端代码无需重新编译）；当类层次中类数量过多（Rumbaugh 称之为"嵌套泛化"），需要把一个对象拆成两部分；当想在多个对象间共享实现（如引用计数）且对客户端隐藏这一细节。

## 三、组合（composite）

> 别名：Object Tree（对象树）、Composite Structure。仓库分类：Structural。

**意图（全译）**：将对象组合成树形结构以表示"部分-整体"的层次结构。组合模式使客户端对单个对象和对象组合的使用具有一致性。

**通俗解释**：一组对象可以像单个对象实例一样被对待。README 的类比是公司组织架构：部门可包含子部门直至员工，计算总薪资或打印组织架构图时，对"单个员工"和"整个部门"一视同仁。

**仓库实现解析**。仓库用"字母 → 单词 → 句子"构造树，`LetterComposite` 是统一的构件基类：

```java
// composite/src/main/java/com/iluwatar/composite/LetterComposite.java（全量）
public abstract class LetterComposite {

  private final List<LetterComposite> children = new ArrayList<>();

  public void add(LetterComposite letter) {
    children.add(letter);
  }

  public int count() {
    return children.size();
  }

  protected void printThisBefore() {}

  protected void printThisAfter() {}

  /** Print. */
  public void print() {
    printThisBefore();
    children.forEach(LetterComposite::print);
    printThisAfter();
  }
}
```

```java
// composite/src/main/java/com/iluwatar/composite/Word.java（节选）
public class Word extends LetterComposite {

  /** Constructor. */
  public Word(List<Letter> letters) {
    letters.forEach(this::add);
  }

  @Override
  protected void printThisBefore() {
    System.out.print(" ");
  }
}
```

`Word` 由 `Letter` 组成，`Sentence` 由 `Word` 组成，全部经过 `print()` 递归输出——叶节点与容器节点接口完全一致。

**利弊（README "Benefits and Trade-offs" 摘译）**：收益——客户端可统一对待组合结构与单个对象，代码得以简化；新增组件种类更容易，既有代码无需改动。代价——设计可能过于泛化，限制组合中的组件类型会变困难。

**真实世界应用（README "Real-World Applications" 全译）**：组件可包含组件的图形界面（面板里放按钮、标签、其他面板）；目录可包含文件与子目录的文件系统表示；部门可包含子部门与员工的组织结构；以及 JDK 的 java.awt.Container 与 java.awt.Component、Apache Wicket 的组件树（Component 与 MarkupContainer）。

**何时使用（译）**：当你想表示对象的"部分-整体"层次结构；当你希望客户端忽略组合对象与单个对象的差异、以统一方式对待组合结构中的所有对象。

## 四、装饰器（decorator）

> 别名：Smart Proxy、Wrapper。仓库分类：Structural。

**意图（全译）**：装饰器模式允许在**不修改既有代码**的前提下，为对象动态添加职责。它通过"用同类接口的对象包裹对象"实现这一点。

**通俗解释**：装饰器模式让你在运行时把对象包进装饰器类的对象，从而动态改变对象行为。README 的类比是咖啡店点单：从基础咖啡开始，依次包上牛奶、糖、奶油装饰，每层装饰都在原有行为上追加新特性。维基百科补充：该模式有助于遵守单一职责原则与开闭原则。

**仓库实现解析**。场景是"被打的巨魔"：`SimpleTroll` 提供基础行为，`ClubbedTroll` 装饰后攻击力 +10：

```java
// decorator/src/main/java/com/iluwatar/decorator/Troll.java（全量）
public interface Troll {

  void attack();

  int getAttackPower();

  void fleeBattle();
}
```

```java
// decorator/src/main/java/com/iluwatar/decorator/ClubbedTroll.java（全量）
@Slf4j
@RequiredArgsConstructor
public class ClubbedTroll implements Troll {

  private final Troll decorated;

  @Override
  public void attack() {
    decorated.attack();
    LOGGER.info("The troll swings at you with a club!");
  }

  @Override
  public int getAttackPower() {
    return decorated.getAttackPower() + 10;
  }

  @Override
  public void fleeBattle() {
    decorated.fleeBattle();
  }
}
```

装饰器与被装饰者实现同一接口、持有被装饰者引用：`attack` 先委托再追加，`getAttackPower` 直接增强，`fleeBattle` 纯转发。Java IO 中层层包裹的 `InputStream` 就是该模式的官方应用。

**利弊（README "Benefits and Trade-offs" 摘译）**：收益——比静态继承更灵活；避免层次顶端堆满特性的类；可在运行时增删职责（装饰器与其组件并非同一对象）。

**真实世界应用（README "Real-World Applications" 全译）**：GUI 工具包常用装饰器为组件动态添加滚动、边框、布局管理等行为；java.io.InputStream、OutputStream、Reader、Writer 系列类是装饰器模式最著名的应用；以及 java.util.Collections 的 synchronizedXXX()、unmodifiableXXX()、checkedXXX() 三组包装方法。

**何时使用（译）**：动态且透明地为单个对象添加职责（不影响其他对象）；对可撤销的职责；当继承扩展会导致子类数量爆炸而不切实际时；当类定义被隐藏或无法被子类化时。

## 五、外观（facade）

**意图（全译）**：外观模式为子系统中的一组接口提供一个统一的高层接口，简化复杂系统的交互。

**通俗解释**：为复杂子系统提供一个简单接口。README 的真实世界类比：顾客在网上商店下单后拨打客服电话，客服人员就是商店的"外观"——退换货、支付、物流等子系统的细节都由这个统一入口处理。

**仓库实现解析**。场景是矮人金矿：矿工、推车工、掘进工三种工人各司其职，外观类把它们编排成"一天的工作流"：

```java
// facade/src/main/java/com/iluwatar/facade/DwarvenGoldmineFacade.java（全量）
public class DwarvenGoldmineFacade {

  private final List<DwarvenMineWorker> workers;

  /** Constructor. */
  public DwarvenGoldmineFacade() {
    workers =
        List.of(new DwarvenGoldDigger(), new DwarvenCartOperator(), new DwarvenTunnelDigger());
  }

  public void startNewDay() {
    makeActions(workers, DwarvenMineWorker.Action.WAKE_UP, DwarvenMineWorker.Action.GO_TO_MINE);
  }

  public void digOutGold() {
    makeActions(workers, DwarvenMineWorker.Action.WORK);
  }

  public void endDay() {
    makeActions(workers, DwarvenMineWorker.Action.GO_HOME, DwarvenMineWorker.Action.GO_TO_SLEEP);
  }

  private static void makeActions(
      Collection<DwarvenMineWorker> workers, DwarvenMineWorker.Action... actions) {
    workers.forEach(worker -> worker.action(actions));
  }
}
```

调用方只需 `new DwarvenGoldmineFacade().startNewDay()`，与三个工人类型的依赖被外观切断。

**真实世界应用（README "Real-World Applications" 全译）**：java.net.URL 与 javax.faces.context.FacesContext 等 Java 库用外观简化复杂的底层类；许多 Java 框架都以外观简化 API 的使用方式。README 亦提醒代价：实现不当的外观可能变成与应用所有类耦合的"上帝对象"（god object）。

**何时使用（译）**：当你想为复杂子系统提供简单接口；当子系统日益复杂、依赖多个类，而多数客户端只需要其中一部分功能；当需要对子系统分层，用外观为每层定义入口；当想减少依赖、提升代码可读性时。

## 六、享元（flyweight）

**意图（全译）**：享元模式通过在多个对象间共享状态的公共部分（内在状态），把内存占用降到最低，只保留外在状态在对象之外。

**通俗解释**：让大量细粒度对象共享公共状态，而非各自持有一份。README 说明：享元模式的有效性高度依赖于"如何以及在哪里使用它"。

**仓库实现解析**。场景是炼金商店：货架上摆着成排的药水，但同一配方的药水实例只需一份。工厂用 `EnumMap` 做共享池：

```java
// flyweight/src/main/java/com/iluwatar/flyweight/PotionFactory.java（全量）
public class PotionFactory {

  private final Map<PotionType, Potion> potions;

  public PotionFactory() {
    potions = new EnumMap<>(PotionType.class);
  }

  Potion createPotion(PotionType type) {
    var potion = potions.get(type);
    if (potion == null) {
      switch (type) {
        case HEALING -> potion = new HealingPotion();
        case HOLY_WATER -> potion = new HolyWaterPotion();
        case INVISIBILITY -> potion = new InvisibilityPotion();
        case POISON -> potion = new PoisonPotion();
        case STRENGTH -> potion = new StrengthPotion();
        default -> {}
      }
      if (potion != null) {
        potions.put(type, potion);
      }
    }
    return potion;
  }
}
```

`AlchemistShop` 内部两次调用 `createPotion(HEALING)` 得到的是同一个对象——"许多对象组被相对少量的共享对象替换"。

**真实世界应用（README "Real-World Applications" 全译）**：java.lang.Integer#valueOf(int) 及 Byte、Character 等其他包装类型的缓存；Java 的 String 类用享元高效管理字符串字面量；GUI 应用常以享元共享字体或图形组件以节约内存、提升性能。

**何时使用（译）**。当以下条件**全部**满足时应用：应用使用了大量对象；由于对象数量巨大造成存储开销高；对象状态的大部分可以外置（extrinsic）；移除外在状态后，许多对象组可被相对少量的共享对象替换；应用不依赖对象同一性——由于享元会被共享，对概念上不同的对象做同一性测试会返回 true。

## 七、代理（proxy）

> 别名：Surrogate（代理者）。仓库分类：Structural。

**意图（全译）**：代理模式为一个对象提供代理或占位符，以有效地控制对它的访问，增强安全性与资源管理。

**通俗解释**：一个类封装另一个类的功能。维基百科表述：代理是客户端调用以访问幕后真实服务对象的包装或代理对象，可以简单转发，也可以提供额外逻辑——例如对开销大的操作做缓存，或在操作执行前检查前置条件。

**仓库实现解析**。场景是"法师塔限流"：塔本身来者不拒，代理在门口限流 3 人：

```java
// proxy/src/main/java/com/iluwatar/proxy/WizardTowerProxy.java（全量）
@Slf4j
public class WizardTowerProxy implements WizardTower {

  private static final int NUM_WIZARDS_ALLOWED = 3;

  private int numWizards;

  private final WizardTower tower;

  public WizardTowerProxy(WizardTower tower) {
    this.tower = tower;
  }

  @Override
  public void enter(Wizard wizard) {
    if (numWizards < NUM_WIZARDS_ALLOWED) {
      tower.enter(wizard);
      numWizards++;
    } else {
      LOGGER.info("{} is not allowed to enter!", wizard);
    }
  }
}
```

代理与真实主题实现同一 `WizardTower` 接口，客户端无感切换。仓库另收录 virtual-proxy（虚代理，延迟创建大对象）与 dynamic-proxy（动态代理，运行时生成代理类）两个专题模式。

**利弊（README "Benefits and Trade-offs" 摘译）**：收益——代理控制对真实对象的访问，可插入检查、日志等操作；支持把重资源对象的创建与初始化推迟到真正需要时（惰性初始化）。

**真实世界应用（README "Real-World Applications" 摘译）**：虚代理——需要大图片、复杂计算等重资源的应用按需实例化对象；远程代理——远程方法调用（RMI）中管理与远程对象的交互；保护代理——控制对原对象的访问以完成鉴权。JDK 的 java.lang.reflect.Proxy、Apache Commons Proxy，以及 Mockito、PowerMock、EasyMock 等 Mock 框架都是这一模式的实现。

**何时使用（译）**：凡是需要比简单指针更灵活、更复杂的对象引用时都适用。典型场景：控制对另一对象的访问；惰性初始化；实现日志；简化网络连接；统计对象的引用计数；为位于不同地址空间的对象提供本地代表。

## 八、私有类数据（private-class-data）

> 别名：Data Hiding（数据隐藏）、Encapsulation（封装）。仓库分类：Structural。

**意图（全译）**：私有类数据模式聚焦于限制对对象内部状态的访问，通过受控的方法访问增强安全性、降低数据被破坏的风险。

**通俗解释**：该模式把数据与使用数据的方法分离——将数据收进一个专门维护状态的类，防止本应不可变的数据被方法篡改。README 的类比是银行对客户账户信息的保护：敏感数据只能通过 ATM、网银等明确定义的接口访问，访问过程中强制执行安全与校验规则。

**仓库实现解析**。仓库对比了可变的 `Stew`（炖菜）与受该模式保护的 `ImmutableStew`。数据被收进一个不可变 record：

```java
// private-class-data/src/main/java/com/iluwatar/privateclassdata/StewData.java（全量）
public record StewData(int numPotatoes, int numCarrots, int numMeat, int numPeppers) {}
```

```java
// private-class-data/src/main/java/com/iluwatar/privateclassdata/ImmutableStew.java（节选）
@Slf4j
public class ImmutableStew {

  private final StewData data;

  public ImmutableStew(int numPotatoes, int numCarrots, int numMeat, int numPeppers) {
    data = new StewData(numPotatoes, numCarrots, numMeat, numPeppers);
  }

  /** Mix the stew. */
  public void mix() {
    LOGGER.info(
        "Mixing the immutable stew we find: {} potatoes, {} carrots, {} meat and {} peppers",
        data.numPotatoes(),
        data.numCarrots(),
        data.numMeat(),
        data.numPeppers());
  }
}
```

`ImmutableStew` 只读 `data` 的访问器、没有任何修改入口，字段即便想被误改也无路径可走。

**何时使用（译）**：当你想保护对象状态的完整性；当需要限制对象内部数据的可见性以防止意外修改；当多个类需要共享访问某些公共数据、但又不想将其直接暴露时。

**真实世界应用（README "Real-World Applications" 全译）**：通过 getter/setter 访问属性的 Java Bean；众多 Java 库中为了一致性与安全性而对用户隐藏内部状态的设计；需要保护敏感数据免遭直接访问的企业应用。

## 小结

结构型模式的共同哲学是**组合优于继承**：适配器用组合转译接口，桥接把两个变化维度拆成两个可组合的层次，装饰器用同接口包装叠加职责，外观用组合收敛子系统入口，享元共享实例，代理拦截访问，组合模式让树形结构统一对外，私有类数据把"状态"本身也封进组合件。下一讲进入行为型模式：结构搭好后，对象之间如何分配职责、传递消息。

---

> **来源**：本文基于 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns) 仓库原文（MIT 许可证）翻译整理，Java 代码引自仓库实现，版权归原仓库作者所有。
