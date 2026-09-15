---
title: 行为型模式：对象间的职责分配与协作
source_url: https://github.com/iluwatar/java-design-patterns
author: iluwatar/java-design-patterns 社区
license: MIT（仓库 LICENSE.md 原文核实；代码与说明文档教学性翻译转载，逐篇署名）
fetched_at: 2026-09-13
translated: true
order: 4
---

# 行为型模式：对象间的职责分配与协作

行为型模式关注对象之间的职责分配与消息协作：算法可以替换、事件可以广播、请求可以排队、状态可以外化。仓库在行为型（Behavioral）分类下收录 41 个模式，是最大的一个官方分类。本篇覆盖任务规划的 12 个核心模式——strategy、observer、chain-of-responsibility、command、template-method、state、visitor、mediator、memento、interpreter、iterator、null-object，全部为仓库实际存在的行为型模式。各模式意图与适用场景译自该模式目录 README 原文，代码引自仓库真实实现并标注路径。

## 一、策略（strategy）

> 别名：Policy（政策）。仓库分类：Behavioral。

**意图（README "Intent of Strategy Design Pattern" 全译）**：定义一族算法，封装每个算法，并使它们可以互换。策略让算法独立于使用它的客户端而变化。

**通俗解释（"In plain words" 译）**：策略模式允许在运行时选择最合适的算法。README 的真实世界类比是车载导航：最短路线、最快路线、风景路线是三个可互换的算法，用户按偏好切换而无需更换导航系统本身。

**仓库实现解析**。屠龙者持有一个可替换的策略：

```java
// strategy/src/main/java/com/iluwatar/strategy/DragonSlayingStrategy.java（全量）
@FunctionalInterface
public interface DragonSlayingStrategy {

  void execute();
}
```

```java
// strategy/src/main/java/com/iluwatar/strategy/DragonSlayer.java（全量）
public class DragonSlayer {

  private DragonSlayingStrategy strategy;

  public DragonSlayer(DragonSlayingStrategy strategy) {
    this.strategy = strategy;
  }

  public void changeStrategy(DragonSlayingStrategy strategy) {
    this.strategy = strategy;
  }

  public void goToBattle() {
    strategy.execute();
  }
}
```

```java
// strategy/src/main/java/com/iluwatar/strategy/MeleeStrategy.java（节选）
@Slf4j
public class MeleeStrategy implements DragonSlayingStrategy {

  @Override
  public void execute() {
    LOGGER.info("With your Excalibur you sever the dragon's head!");
  }
}
```

接口标注 `@FunctionalInterface`，因此 `DragonSlayer` 也可以直接接收 Lambda（仓库的 `LambdaStrategy` 演示了这种写法）。

**何时使用（译）**：当对象内需要同一算法的多种变体、并希望在运行时切换；当存在多个仅行为不同的相关类；当算法使用了客户端不应知道的数据；当类定义了多种行为、且这些行为在操作中以多个条件语句的形式出现时。

## 二、观察者（observer）

> 别名：Dependents（依赖者）。仓库分类：Behavioral。

**意图（全译）**：观察者模式定义对象之间的一对多关系：当一个对象更新自身状态时，所有依赖于它的观察者都会得到通知并自动更新。

**通俗解释**：实现观察者接口，主动监听并响应状态变化。维基百科表述：主体（subject）维护一份观察者列表，状态变化时自动逐个通知（通常调用其方法）。README 的类比是通讯社与各新闻媒体：通讯社发稿，所有订阅的媒体自动收到更新，通讯社无需了解每家的更新细节。

**仓库实现解析**。天气是被观察的主体，兽人与霍比特人是观察者：

```java
// observer/src/main/java/com/iluwatar/observer/Weather.java（节选）
@Slf4j
public class Weather {

  private WeatherType currentWeather;
  private final List<WeatherObserver> observers;

  public void addObserver(WeatherObserver obs) {
    observers.add(obs);
  }

  public void removeObserver(WeatherObserver obs) {
    observers.remove(obs);
  }

  /** Makes time pass for weather. */
  public void timePasses() {
    var enumValues = WeatherType.values();
    currentWeather = enumValues[(currentWeather.ordinal() + 1) % enumValues.length];
    LOGGER.info("The weather changed to {}.", currentWeather);
    notifyObservers();
  }

  private void notifyObservers() {
    for (var obs : observers) {
      obs.update(currentWeather);
    }
  }
}
```

```java
// observer/src/main/java/com/iluwatar/observer/WeatherObserver.java（全量）
public interface WeatherObserver {

  void update(WeatherType currentWeather);
}
```

仓库在 `observer/generic` 子包还提供了一个泛型化的 `Observable/Observer` 实现，可适配任意事件类型。

**何时使用（译）**：当一个抽象有两个方面、其中一个依赖于另一个，把两方面分别封装可使它们独立变化与复用；当一个对象的改变需要同时改变其他对象、且不知道究竟有多少对象需要改变；当一个对象必须能通知其他对象、又不能对这些对象是谁做任何假设（不希望紧耦合）时。

## 三、责任链（chain-of-responsibility）

> 别名：Chain of Command（指挥链）等。仓库分类：Behavioral。

**意图（全译）**：责任链模式将请求的发送者与接收者解耦：给多个对象处理请求的机会，接收对象连成一条链，请求沿链传递直到某个对象处理它。

**通俗解释**：构建一条对象链，请求从一端进入，逐个对象传递，直到找到合适的处理者。README 的类比是技术支持呼叫中心：一线接听简单问题，复杂的逐级上转，直到专家解决。

**仓库实现解析**。兽人王的请求按优先级在军官链上流转：

```java
// chain-of-responsibility/src/main/java/com/iluwatar/chain/RequestHandler.java（全量）
public interface RequestHandler {

  boolean canHandleRequest(Request req);

  int getPriority();

  void handle(Request req);

  String name();
}
```

```java
// chain-of-responsibility/src/main/java/com/iluwatar/chain/OrcKing.java（节选）
public class OrcKing {

  private List<RequestHandler> handlers;

  private void buildChain() {
    handlers = Arrays.asList(new OrcCommander(), new OrcOfficer(), new OrcSoldier());
  }

  /** Handle request by the chain. */
  public void makeRequest(Request req) {
    handlers.stream()
        .sorted(Comparator.comparing(RequestHandler::getPriority))
        .filter(handler -> handler.canHandleRequest(req))
        .findFirst()
        .ifPresent(handler -> handler.handle(req));
  }
}
```

这版实现用 Stream 把"沿链传递"表达为排序 → 过滤 → 取第一个可处理者；仓库各处理器的 `canHandleRequest` 依据 `RequestType`（如 DEFEND_CASTLE、TAX_COLLECTION）判断。

**何时使用（译）**：当不止一个对象可能处理某个请求，而处理者无法预知、应自动确定时；当想向若干对象中的一个发出请求而不想显式指定接收者；当可处理请求的对象集合需要动态指定时。

## 四、命令（command）

> 别名：Action、Transaction。仓库分类：Behavioral。

**意图（全译）**：命令模式把请求封装为对象，从而可以用不同的请求、队列和操作对客户端进行参数化，并支持可撤销的操作。

**通俗解释**：把请求存成命令对象，就可以在之后的任意时刻执行它或撤销它。

**仓库实现解析**。巫师对地精施法，用两个双端队列实现撤销/重做栈（命令对象在这里是 `Runnable`）：

```java
// command/src/main/java/com/iluwatar/command/Wizard.java（节选）
@Slf4j
public class Wizard {

  private final Deque<Runnable> undoStack = new LinkedList<>();
  private final Deque<Runnable> redoStack = new LinkedList<>();

  /** Cast spell. */
  public void castSpell(Runnable runnable) {
    runnable.run();
    undoStack.offerLast(runnable);
  }

  /** Undo last spell. */
  public void undoLastSpell() {
    if (!undoStack.isEmpty()) {
      var previousSpell = undoStack.pollLast();
      redoStack.offerLast(previousSpell);
      previousSpell.run();
    }
  }

  /** Redo last spell. */
  public void redoLastSpell() {
    if (!redoStack.isEmpty()) {
      var previousSpell = redoStack.pollLast();
      undoStack.offerLast(previousSpell);
      previousSpell.run();
    }
  }
}
```

施法命令在两个栈之间搬移，重做时命令自身再次运行——请求对象独立于原始请求存在，这正是命令模式的精髓。

**何时使用（译）**：当需要用动作参数化对象（回调的面向对象替代）；当需要在不同时刻指定、排队和执行请求（命令甚至可以跨进程传输）；当需要支持撤销——`execute` 保存状态并提供反操作，配合历史列表实现无限撤销/重做；当需要记录变更日志以便系统崩溃后重放；当需要围绕基本操作构建高层操作（事务系统）；当需要保留请求历史或实现回调功能时。

## 五、模板方法（template-method）

**意图（全译）**：在操作中定义算法的骨架，把某些步骤推迟到子类实现。模板方法让子类在不改变算法结构的前提下重新定义算法的某些步骤。

**通俗解释**：父类把"做一件事的流程"定型为 `final` 方法，流程中的若干环节留作抽象方法给子类填空。

**仓库实现解析**。偷窃算法的三步骨架定死，瞄准目标、迷惑目标、偷取物品由子类实现：

```java
// template-method/src/main/java/com/iluwatar/templatemethod/StealingMethod.java（节选）
@Slf4j
public abstract class StealingMethod {

  protected abstract String pickTarget();

  protected abstract void confuseTarget(String target);

  protected abstract void stealTheItem(String target);

  /** Steal. */
  public final void steal() {
    var target = pickTarget();
    LOGGER.info("The target has been chosen as {}.", target);
    confuseTarget(target);
    stealTheItem(target);
  }
}
```

```java
// template-method/src/main/java/com/iluwatar/templatemethod/SubtleMethod.java（节选）
@Slf4j
public class SubtleMethod extends StealingMethod {

  @Override
  protected String pickTarget() {
    return "shop keeper";
  }

  @Override
  protected void confuseTarget(String target) {
    LOGGER.info("Approach the {} with tears running and hug him!", target);
  }

  @Override
  protected void stealTheItem(String target) {
    LOGGER.info("While in close contact grab the {}'s wallet.", target);
  }
}
```

`steal()` 标记为 `final`：算法结构不许子类改写，只能改写步骤。`HalflingThief` 持有 `StealingMethod` 并可运行时 `changeMethod` 切换。

**何时使用（译）**：当希望把算法的不变部分实现一次、把可变行为留给子类；当子类间的公共行为应被抽取并局部化到一个公共类中以避免代码重复；当要控制子类扩展——定义只在特定"钩子"点允许扩展的模板方法。

## 六、状态（state）

> 别名：Objects for States（状态对象）。仓库分类：Behavioral。

**意图（全译）**：使对象在其内部状态改变时能够动态改变自身行为。

**通俗解释**：状态模式让对象改变"自己看起来的样子"——把每个状态封装成一个对象，上下文把行为委托给当前状态对象。README 还引用维基百科的观察：该模式接近有限状态机的概念，可解读为"能通过调用模式接口中定义的方法来切换策略"的策略模式。README 的类比是红绿灯：绿、黄、红三种状态各自定义行为，灯（上下文）随状态切换而改变行为。

**仓库实现解析**。猛犸象在平静与愤怒之间摇摆：

```java
// state/src/main/java/com/iluwatar/state/Mammoth.java（全量）
public class Mammoth {

  private State state;

  public Mammoth() {
    state = new PeacefulState(this);
  }

  /** Makes time pass for the mammoth. */
  public void timePasses() {
    if (state.getClass().equals(PeacefulState.class)) {
      changeStateTo(new AngryState(this));
    } else {
      changeStateTo(new PeacefulState(this));
    }
  }

  private void changeStateTo(State newState) {
    this.state = newState;
    this.state.onEnterState();
  }

  public void observe() {
    this.state.observe();
  }
}
```

```java
// state/src/main/java/com/iluwatar/state/PeacefulState.java（节选）
@Slf4j
public class PeacefulState implements State {

  private final Mammoth mammoth;

  public PeacefulState(Mammoth mammoth) {
    this.mammoth = mammoth;
  }

  @Override
  public void observe() {
    LOGGER.info("{} is calm and peaceful.", mammoth);
  }

  @Override
  public void onEnterState() {
    LOGGER.info("{} calms down.", mammoth);
  }
}
```

状态对象持有上下文引用，`onEnterState`/`observe` 两个动作随状态对象切换而整体替换。

**何时使用（译）**：当对象的行为取决于其状态，且必须在运行时根据状态改变行为；当操作中存在依赖对象状态的大型多分支条件语句时（状态模式把它们摊平成一组状态类）。

## 七、访问者（visitor）

**意图（全译）**：表示一个作用于某对象结构中各元素的操作。访问者让开发者可以在不改变元素类的前提下定义新操作。

**通俗解释**：结构稳定、操作多变时，把操作从元素类抽到访问者里，元素只需提供一个 `accept` 入口。

**仓库实现解析**。军队由士兵、中士、指挥官组成，三种访问者各有所好：

```java
// visitor/src/main/java/com/iluwatar/visitor/UnitVisitor.java（全量）
public interface UnitVisitor {

  void visit(Soldier soldier);

  void visit(Sergeant sergeant);

  void visit(Commander commander);
}
```

```java
// visitor/src/main/java/com/iluwatar/visitor/CommanderVisitor.java（节选）
@Slf4j
public class CommanderVisitor implements UnitVisitor {

  @Override
  public void visit(Soldier soldier) {
    // Do nothing
  }

  @Override
  public void visit(Sergeant sergeant) {
    // Do nothing
  }

  @Override
  public void visit(Commander commander) {
    LOGGER.info("Good to see you {}", commander);
  }
}
```

`CommanderVisitor` 只对指挥官作响应，对其他类型留空；`Unit.accept(visitor)` 借助双重分派把调用路由到匹配的重载。

**何时使用（译）**：当需要对一组相似对象高效执行某操作、又不想把该操作污染进这些类时；当类结构稳定、但需要在不改动结构的前提下增加新操作时；当类的集合固定、只有操作需要扩展时。

## 八、中介者（mediator）

> 别名：Controller（控制器）。仓库分类：Behavioral。

**意图（全译）**：中介者模式旨在降低系统中多对象/多类之间通信的复杂度：提供一个集中化的中介类来处理各对象之间的交互，从而减少它们对彼此的直接依赖。

**通俗解释**：强迫一组类的通信都流经一个中介对象，以此解耦它们。README 的类比是机场塔台：所有飞机不互相直接通话，全部请求经塔台处理后得到有序指令。维基百科补充：对象不再直接互相通信，而是通过中介者通信，这减少了通信对象之间的依赖、降低了耦合。

**仓库实现解析**。小队成员行动时，中介把动作广播给其他队员：

```java
// mediator/src/main/java/com/iluwatar/mediator/PartyImpl.java（全量）
public class PartyImpl implements Party {

  private final List<PartyMember> members;

  public PartyImpl() {
    members = new ArrayList<>();
  }

  @Override
  public void act(PartyMember actor, Action action) {
    for (var member : members) {
      if (!member.equals(actor)) {
        member.partyAction(action);
      }
    }
  }

  @Override
  public void addMember(PartyMember member) {
    members.add(member);
    member.joinedParty(this);
  }
}
```

```java
// mediator/src/main/java/com/iluwatar/mediator/PartyMemberBase.java（节选）
  @Override
  public void act(Action action) {
    if (party != null) {
      LOGGER.info("{} {}", this, action);
      party.act(this, action);
    }
  }
```

成员只认识 `party`，从不引用其他成员——网状 N×N 通信被压成 N 条到中介的连线。

**何时使用（译）**：当一组对象以定义良好但复杂的方式通信，产生的相互依赖既无结构又难以理解；当对象因为引用并通信太多其他对象而难以复用；当分布在多个类中的行为需要可定制、又不希望生成大量子类时。

## 九、备忘录（memento）

> 别名：Snapshot（快照）、Token（令牌）。仓库分类：Behavioral。

**意图（全译）**：备忘录模式在不破坏封装的前提下，捕获并外部化一个对象的内部状态，使对象可以在之后恢复到该状态。

**通俗解释**：把对象内部状态存成快照，随时取回。README 的类比是文本编辑器的撤销：每次修改前存下文档快照放入历史列表，点撤销就恢复到最近一份快照，且编辑器内部结构不对外暴露。

**仓库实现解析**。恒星的演化与回滚：

```java
// memento/src/main/java/com/iluwatar/memento/Star.java（节选）
public class Star {

  private StarType type;
  private int ageYears;
  private int massTons;

  StarMemento getMemento() {
    var state = new StarMementoInternal();
    state.setAgeYears(ageYears);
    state.setMassTons(massTons);
    state.setType(type);
    return state;
  }

  void setMemento(StarMemento memento) {
    var state = (StarMementoInternal) memento;
    this.type = state.getType();
    this.ageYears = state.getAgeYears();
    this.massTons = state.getMassTons();
  }
}
```

```java
// memento/src/main/java/com/iluwatar/memento/StarMemento.java（全量）
/** External interface to memento. */
public interface StarMemento {}
```

对外只有一个空接口 `StarMemento`，内部状态类 `StarMementoInternal` 是私有实现——外部拿到快照却读不到内容，封装不破。

**何时使用（译）**：当需要捕获对象状态以便日后恢复、又不暴露其内部结构（维护封装的关键）；当提供获取状态的直接接口会暴露实现细节、破坏对象封装时。

## 十、解释器（interpreter）

**意图（全译）**：解释器模式为一种语言定义文法表示，并提供一个解释器来处理该文法。适用于需要对特定规则/文法进行解释与执行的场景，如算术表达式或脚本语言。

**通俗解释**：把语言的每种文法规则实现为一个类，语句组织成抽象语法树，解释即沿树递归求值。

**仓库实现解析**。加减乘表达式：

```java
// interpreter/src/main/java/com/iluwatar/interpreter/Expression.java（全量）
public abstract class Expression {

  public abstract int interpret();

  @Override
  public abstract String toString();
}
```

```java
// interpreter/src/main/java/com/iluwatar/interpreter/PlusExpression.java（节选）
public class PlusExpression extends Expression {

  private final Expression leftExpression;
  private final Expression rightExpression;

  public PlusExpression(Expression leftExpression, Expression rightExpression) {
    this.leftExpression = leftExpression;
    this.rightExpression = rightExpression;
  }

  @Override
  public int interpret() {
    return leftExpression.interpret() + rightExpression.interpret();
  }
}
```

`NumberExpression` 是终结符表达式，`PlusExpression`/`MinusExpression`/`MultiplyExpression` 是非终结符，组合 `new PlusExpression(new NumberExpression(1), new NumberExpression(2))` 即得可求值的语法树。

**何时使用（译）**：当存在需要解释的语言、且可以把语句表示为抽象语法树时。最有效的前提：文法简单（复杂文法的类层次会庞大到失控，解析器生成器是更好选择）；效率不是关键关注点（最快的解释器通常先把语法树翻译成其他形式——如正则转状态机——但翻译器本身仍可用解释器模式实现）。

## 十一、迭代器（iterator）

> 别名：Cursor（游标）。仓库分类：Behavioral。

**意图（全译）**：迭代器模式提供一种顺序访问聚合对象中元素的方法，而不暴露其底层表示。

**通俗解释**：给容器一个统一的"逐个给我下一个"的游标接口。README 的类比是图书馆导览手册：你按手册逐区浏览书籍，无需知道书架上如何排列。

**仓库实现解析**。仓库自定义了 `Iterator` 接口并给出宝箱按物品类型过滤的迭代器实现：

```java
// iterator/src/main/java/com/iluwatar/iterator/Iterator.java（全量）
public interface Iterator<T> {

  boolean hasNext();

  T next();
}
```

```java
// iterator/src/main/java/com/iluwatar/iterator/list/TreasureChestItemIterator.java（节选）
public class TreasureChestItemIterator implements Iterator<Item> {

  private final TreasureChest chest;
  private int idx;
  private final ItemType type;

  @Override
  public boolean hasNext() {
    return findNextIdx() != -1;
  }

  @Override
  public Item next() {
    idx = findNextIdx();
    if (idx != -1) {
      return chest.getItems().get(idx);
    }
    return null;
  }

  private int findNextIdx() {
    var items = chest.getItems();
    var tempIdx = idx;
    while (true) {
      tempIdx++;
      if (tempIdx >= items.size()) {
        tempIdx = -1;
        break;
      }
      if (type.equals(ItemType.ANY) || items.get(tempIdx).getType().equals(type)) {
        break;
      }
    }
    return tempIdx;
  }
}
```

遍历逻辑（含按类型过滤）全部收进迭代器，宝箱内部列表对外保持私有；仓库的 `bst` 子包还演示了对二叉搜索树做中序迭代，与列表迭代器共用同一接口——这正是"为遍历不同聚合结构提供统一接口"的直接示范。

**何时使用（译）**：当需要访问聚合对象的内容而不暴露其内部表示；当需要对聚合对象支持多次遍历；当需要为遍历不同的聚合结构提供统一接口。

## 十二、空对象（null-object）

> 别名：Active Nothing、Stub（桩）。仓库分类：Behavioral。

**意图（全译）**：空对象模式提供一种无需判空即可优雅处理"对象缺席"的方式，消除散落各处的 null 检查。

**通俗解释**：用"什么都不做"的对象替代 null。README 的类比是客服系统的"空代表"：没有人可派单时派给它，它返回默认响应而不让系统崩溃。

**仓库实现解析**。二叉树节点的空实现，以单例存在：

```java
// null-object/src/main/java/com/iluwatar/nullobject/NullNode.java（节选）
public final class NullNode implements Node {

  private static final NullNode instance = new NullNode();

  private NullNode() {}

  public static NullNode getInstance() {
    return instance;
  }

  @Override
  public int getTreeSize() {
    return 0;
  }

  @Override
  public String getName() {
    return null;
  }

  @Override
  public void walk() {
    // Do nothing
  }
}
```

`NodeImpl` 的左右孩子永远返回 `Node`（可能为 `NullNode`），于是 `getTreeSize()` 可以写成无判空的 `1 + left.getTreeSize() + right.getTreeSize()`——多态取代了 if 判断。

**何时使用（译）**：当需要以默认行为替代 null 对象；当希望通过消除 null 检查简化客户端代码；当默认动作优于处理空引用时。

## 小结

行为型模式可以按"变化的是什么"来记忆：策略变算法、模板方法变步骤、状态变行为、访问者变操作；观察者与中介者变通信拓扑（一对多广播 vs 多对多中心化）；责任链与命令变请求的流转（沿链查找 vs 封装排队）；备忘录变时间（快照回滚）；解释器与迭代器变遍历（语法树求值 vs 容器游标）；空对象变默认值。最后一讲，我们把视角从类与对象拉升到架构：企业级模式如何组织整个系统。

---

> **来源**：本文基于 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns) 仓库原文（MIT 许可证）翻译整理，Java 代码引自仓库实现，版权归原仓库作者所有。
