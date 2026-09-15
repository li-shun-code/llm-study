---
title: 创建型模式：单例、工厂与对象的受控诞生
source_url: https://github.com/iluwatar/java-design-patterns
author: iluwatar/java-design-patterns 社区
license: MIT（仓库 LICENSE.md 原文核实；代码与说明文档教学性翻译转载，逐篇署名）
fetched_at: 2026-09-13
translated: true
order: 2
---

# 创建型模式：单例、工厂与对象的受控诞生

创建型模式关注"对象如何被造出来"：把实例化的职责从调用方剥离，交给受控的构造逻辑。仓库在创建型（Creational）分类下共收录 14 个模式：abstract-factory、builder、dependency-injection、factory、factory-kit、factory-method、monostate、multiton、object-pool、prototype、registry、singleton、step-builder、type-object（monostate 见第 05 篇）。本篇完整讲解其中 8 个最具代表性的模式（另含仓库归入性能优化类的 lazy-loading），每个模式均译自该模式目录 README 的原文，代码引自仓库真实实现。

## 一、单例（singleton）

> 别名：Single Instance（单实例）。仓库分类：Creational。

**意图（README "Intent of Singleton Design Pattern" 全译）**：确保一个 Java 类只有一个实例，并为该单例提供一个全局访问点。

**通俗解释（"In plain words" 译）**：确保某个特定类只会创建一个对象。维基百科称：单例模式将一个类的实例化限制为单个对象，当系统恰好需要一个对象来协调动作时，这会很有用。

**仓库实现解析**。仓库在一个模式里并排给出五种写法。最朴素的 `IvoryTower`（饿汉式）：

```java
// singleton/src/main/java/com/iluwatar/singleton/IvoryTower.java（节选）
public final class IvoryTower {

  /** Private constructor so nobody can instantiate the class. */
  private IvoryTower() {
    // to prevent instantiating by Reflection call
    if (INSTANCE != null) {
      throw new IllegalStateException("Already initialized.");
    }
  }

  /** Static to class instance of the class. */
  private static final IvoryTower INSTANCE = new IvoryTower();

  public static IvoryTower getInstance() {
    return INSTANCE;
  }
}
```

需要延迟加载又要线程安全时，可用双重检查锁 `ThreadSafeDoubleCheckLocking`：

```java
// singleton/src/main/java/com/iluwatar/singleton/ThreadSafeDoubleCheckLocking.java（节选）
  public static ThreadSafeDoubleCheckLocking getInstance() {
    // local variable increases performance by 25 percent
    // Joshua Bloch "Effective Java, Second Edition", p. 283-284

    var result = instance;
    // Check if singleton instance is initialized.
    // If it is initialized then we can return the instance.
    if (result == null) {
      // It is not initialized, but we cannot be sure because some other thread might have
      // initialized it in the meanwhile.
      // So to make sure we need to lock on an object to get mutual exclusion.
      synchronized (ThreadSafeDoubleCheckLocking.class) {
        // Again assign the instance to local variable to check if it was initialized by some
        // other thread while current thread was blocked to enter the locked zone.
        // If it was initialized then we can return the previously created instance
        // just like the previous null check.
        result = instance;
        if (result == null) {
          // The instance is still not initialized, so we can safely
          // (no other thread can enter this zone)
          // create an instance and make it our singleton instance.
          result = new ThreadSafeDoubleCheckLocking();
          instance = result;
        }
      }
    }
    return result;
  }
```

其中 `instance` 字段以 `volatile` 修饰，防止指令重排导致其他线程看到"半初始化"对象。README 还引用了《Effective Java》第 2 版第 18 页的论断："单元素枚举类型是实现单例的最佳方式"，对应仓库中的 `EnumIvoryTower`：

```java
// singleton/src/main/java/com/iluwatar/singleton/EnumIvoryTower.java（节选）
public enum EnumIvoryTower {
  /** The singleton instance of the class, created by the Java enum singleton pattern. */
  INSTANCE;
}
```

**何时使用（"When to Use" 译）**：当某个类必须恰好只有一个实例，且必须通过一个众所周知的访问点向客户端开放；当这个唯一实例应可通过子类化进行扩展，且客户端无需修改代码即可使用扩展后的实例时。README 同时提醒权衡：全局状态导致难以测试、生命周期管理更复杂、并发场景下若不加谨慎的同步可能引入瓶颈。

**真实世界应用（README "Real-World Applications" 全译）**：日志类；许多应用中的配置类；连接池；文件管理器；以及 JDK 中的 java.lang.Runtime#getRuntime()、java.awt.Desktop#getDesktop()、java.lang.System#getSecurityManager()。

## 二、工厂方法（factory-method）

> 别名：Virtual Constructor（虚构造器）。仓库分类：Creational。

**意图（全译）**：定义一个用于创建对象的接口，但让子类决定实例化哪个类。工厂方法让一个类把实例化推迟到子类，提升代码的灵活性与可维护性。

**通俗解释**：它提供了一种把实例化逻辑委托给子类的方式。README 给出的真实世界类比是物流公司：中央系统只声明 `createPackage()`，`StandardDelivery`、`ExpressDelivery`、`OversizedDelivery` 等子类各自知道如何创建与处理对应的包裹类型。

**仓库实现解析**。场景是铁匠铺：接口 `Blacksmith` 就是工厂方法所在，精灵铁匠与兽人铁匠各自决定产出什么武器。

```java
// factory-method/src/main/java/com/iluwatar/factory/method/Blacksmith.java（全量）
public interface Blacksmith {

  Weapon manufactureWeapon(WeaponType weaponType);
}
```

```java
// factory-method/src/main/java/com/iluwatar/factory/method/ElfBlacksmith.java（节选）
public class ElfBlacksmith implements Blacksmith {

  private static final Map<WeaponType, ElfWeapon> ELFARSENAL;

  static {
    ELFARSENAL = new EnumMap<>(WeaponType.class);
    Arrays.stream(WeaponType.values()).forEach(type -> ELFARSENAL.put(type, new ElfWeapon(type)));
  }

  @Override
  public Weapon manufactureWeapon(WeaponType weaponType) {
    return ELFARSENAL.get(weaponType);
  }
}
```

`ElfBlacksmith` 用 `EnumMap` 预先备好"军械库"，`manufactureWeapon` 直接按类型取用；`OrcBlacksmith` 则演示了另一种实现——每次现造。两个子类同接口不同实现，正是"延迟到子类决定"的含义。

**何时使用（译）**：当类无法预料它必须创建的对象的类；当类希望由其子类来指定它所创建的对象；当类将职责委托给若干辅助子类之一，而你希望把"哪个子类是受托者"这一知识局部化时。

**利弊（README "Benefits and Trade-offs" 全译）**：收益——为子类提供挂钩（hook），增强代码灵活性与可维护性；连接平行的类层次；免除把应用专用类绑定进代码的需要，代码只面向产品接口，因而能配合任意用户定义的具体产品类。代价——可能因新增子类来实现扩展的工厂方法而使代码复杂化。

**真实世界应用（README "Real-World Applications" 全译）**：JDK 中的 java.util.Calendar#getInstance、java.util.ResourceBundle#getBundle、java.text.NumberFormat#getInstance、java.nio.charset.Charset#forName、java.net.URLStreamHandlerFactory#createURLStreamHandler、java.util.EnumSet#of，以及在运行时动态配置应用组件的各类框架。

## 三、抽象工厂（abstract-factory）

> 别名：Kit（套件）。仓库分类：Creational。

**意图（全译）**：抽象工厂模式提供一个接口，用于创建一系列相关或相互依赖的对象，而无需指定它们的具体类，从而增强软件设计的模块化与灵活性。

**通俗解释**：工厂的工厂；把一组彼此相关/依赖的单独工厂组合起来，而不指定它们的具体类。README 的真实世界类比是家具公司：现代、维多利亚、乡村三种风格各含椅子、桌子、沙发，每个具体工厂负责一整套风格一致的产品。

**仓库实现解析**。仓库用"王国"作示例：一个工厂同时生产国王、城堡、军队三类配套产品。

```java
// abstract-factory/src/main/java/com/iluwatar/abstractfactory/KingdomFactory.java（全量）
public interface KingdomFactory {

  Castle createCastle();

  King createKing();

  Army createArmy();
}
```

```java
// abstract-factory/src/main/java/com/iluwatar/abstractfactory/ElfKingdomFactory.java（全量）
public class ElfKingdomFactory implements KingdomFactory {

  @Override
  public Castle createCastle() {
    return new ElfCastle();
  }

  @Override
  public King createKing() {
    return new ElfKing();
  }

  @Override
  public Army createArmy() {
    return new ElfArmy();
  }
}
```

客户端 `Kingdom` 持有一套 `King/Castle/Army`，配合 `FactoryMaker.makeFactory(KingdomType)` 即可在精灵王国与兽人王国之间整体切换，产品族的一致性由工厂保证。

**何时使用（译）**：当系统应独立于其产品的创建、组合与表示方式；当需要以多个产品族中的一个来配置系统；当同一产品族的对象必须一起使用、需强制一致性；当只想暴露产品接口而非实现的类库；当依赖的生命周期短于消费者、需以运行时参数构建依赖、需在运行时从产品族中挑选产品，或新增产品/产品族不应改动既有代码时。

**利弊（README "Benefits and Trade-offs" 摘译）**：收益——不改动代码即可在产品族之间切换；客户端只与抽象接口交互，可移植、易维护；工厂与产品便于跨项目复用；单个产品族的变更被局部化。代价——定义抽象接口与具体工厂有初始开销；客户端经由工厂间接使用产品，透明度略降。

**真实世界应用（README "Real-World Applications" 全译）**：Java Swing 的 LookAndFeel 类族（提供不同观感）；Java AWT 中创建不同 GUI 组件的多种实现；以及 JDK 的 javax.xml.parsers.DocumentBuilderFactory、javax.xml.transform.TransformerFactory、javax.xml.xpath.XPathFactory。README 的"关联模式"一节还指出：抽象工厂常用工厂方法创建产品、其工厂类常实现为单例，而 factory-kit 是它"专注于以灵活方式配置与管理一组相关对象"的近亲。

## 四、建造者（builder）

**意图（全译）**：建造者模式支持分步骤构造复杂对象。它将复杂对象的构造过程与其表示分离，使同一构造过程可以创建不同的表示。

**通俗解释**：让你创建一个对象的不同"口味"，同时避免构造器污染（telescoping constructor antipattern，重叠构造器反模式）。README 特别展示了一个参数不断膨胀的构造器：

```java
public Hero(Profession profession,String name,HairType hairType,HairColor hairColor,Armor armor,Weapon weapon){
    // Value assignments
}
```

README 评述：构造器参数数量会迅速变得难以招架，参数排列难以理解，而且将来增加选项时这个列表还会继续增长——这就是重叠构造器反模式。

**仓库实现解析**。核心是 `Hero` 及其静态内部类 `Builder`（链式设置可选参数，必选参数进 Builder 构造器）：

```java
// builder/src/main/java/com/iluwatar/builder/Hero.java（节选）
public record Hero(
    Profession profession,
    String name,
    HairType hairType,
    HairColor hairColor,
    Armor armor,
    Weapon weapon) {

  private Hero(Builder builder) {
    this(
        builder.profession,
        builder.name,
        builder.hairType,
        builder.hairColor,
        builder.armor,
        builder.weapon);
  }

  /** The builder class. */
  public static class Builder {
    private final Profession profession;
    private final String name;
    private HairType hairType;
    private HairColor hairColor;
    private Armor armor;
    private Weapon weapon;

    /** Constructor. */
    public Builder(Profession profession, String name) {
      if (profession == null || name == null) {
        throw new IllegalArgumentException("profession and name can not be null");
      }
      this.profession = profession;
      this.name = name;
    }

    public Builder withHairType(HairType hairType) {
      this.hairType = hairType;
      return this;
    }

    public Builder withWeapon(Weapon weapon) {
      this.weapon = weapon;
      return this;
    }

    public Hero build() {
      return new Hero(this);
    }
  }
}
```

使用端为 `new Hero.Builder(Profession.WARRIOR, "Bob").withWeapon(Weapon.SWORD).build()`，可读性远胜六参构造器。仓库另有 step-builder（步进建造者）模式，用多个接口强制建造步骤的先后顺序。

**何时使用（译）**：当创建复杂对象的算法应独立于组成对象的部件及部件的装配方式；当构造过程必须允许被构造对象有不同的表示；当产品需要很多步骤才能创建、且这些步骤需要按特定顺序执行时，建造者尤为适用。

**真实世界应用（README "Real-World Applications" 全译）**：Java 中构造字符串的 StringBuilder；创建可变字符串对象的 java.lang.StringBuffer；java.nio.ByteBuffer 及 FloatBuffer、IntBuffer 等同类缓冲区；javax.swing.GroupLayout.Group#addComponent()；IDE 中构建 UI 组件的各类 GUI 构建器；java.lang.Appendable 的全部实现；Apache Camel 的 builders；Apache Commons CLI 的 Option.Builder。

## 五、原型（prototype）

> 别名：Clone（克隆）。仓库分类：Creational。

**意图（全译）**：原型模式用原型实例指定要创建对象的种类，并通过拷贝这些原型来创建新对象。

**通俗解释**：基于已有对象通过克隆来创建新对象。README 的类比是定制家具厂：为畅销设计保留原型，接到订单就克隆原型再做定制，省时省力且质量一致。

**仓库实现解析**。抽象基类把 `Object.clone()` 包装成类型安全的 `copy()`：

```java
// prototype/src/main/java/com/iluwatar/prototype/Prototype.java（节选）
@Slf4j
public abstract class Prototype<T> implements Cloneable {

  /** Object a shallow copy of this object or null if this object is not Cloneable. */
  @SuppressWarnings("unchecked")
  @SneakyThrows
  public T copy() {
    return (T) super.clone();
  }
}
```

工厂持有三个原型，每次"创建"都是克隆：

```java
// prototype/src/main/java/com/iluwatar/prototype/HeroFactoryImpl.java（节选）
@RequiredArgsConstructor
public class HeroFactoryImpl implements HeroFactory {

  private final Mage mage;
  private final Warlord warlord;
  private final Beast beast;

  /** Create mage. */
  public Mage createMage() {
    return mage.copy();
  }

  /** Create warlord. */
  public Warlord createWarlord() {
    return warlord.copy();
  }

  /** Create beast. */
  public Beast createBeast() {
    return beast.copy();
  }
}
```

**何时使用（译）**：当要实例化的类在运行时才确定（例如动态加载）；当要避免建造与产品类层次平行的工厂类层次；当类实例只有少数几种状态组合，安装相应数量的原型并克隆比每次手动以合适状态实例化更方便；当对象创建的开销远大于克隆时；当具体要实例化的类直到运行时才可知时。

**真实世界应用（README "Real-World Applications" 全译）**：Java 中 Object.clone() 方法即原型模式的经典实现；GUI 库常用原型创建按钮、窗口等部件；游戏开发中批量创建属性相似的敌人角色。README 的利弊小结：原型隐藏了实例化新对象的复杂性、减少类数量、支持运行时增删对象，代价是需要实现可能复杂的克隆机制。

## 六、对象池（object-pool）

**意图（全译）**：对象池模式管理一个可复用对象的池子，通过回收对象而非反复创建销毁，优化内存管理与应用性能。

**通俗解释**：对象池管理一组实例，而不是按需创建与销毁它们。README 的类比是图书馆的自习室：学生从池中借一间，用完归还给下一个人，而不是每次都新盖一间。

**仓库实现解析**。泛型抽象池只用两个集合就完成了借用/归还语义：

```java
// object-pool/src/main/java/com/iluwatar/object/pool/ObjectPool.java（节选）
public abstract class ObjectPool<T> {

  private final Set<T> available = new HashSet<>();
  private final Set<T> inUse = new HashSet<>();

  protected abstract T create();

  /** Checkout object from pool. */
  public synchronized T checkOut() {
    if (available.isEmpty()) {
      available.add(create());
    }
    var instance = available.iterator().next();
    available.remove(instance);
    inUse.add(instance);
    return instance;
  }

  public synchronized void checkIn(T instance) {
    inUse.remove(instance);
    available.add(instance);
  }
}
```

`OliphauntPool extends ObjectPool<Oliphaunt>` 只需实现 `create()`，具体对象类型对池完全透明。

**何时使用（译）**：当对象的频繁创建销毁带来高昂的资源分配与释放成本；当对象创建维护代价大（如数据库连接、线程池）；当需要控制固定数量的对象（如连接池化）；当对象复用能显著改善系统性能与资源管理时。

**真实世界应用（README "Real-World Applications" 全译）**：Java 应用中的数据库连接池化；Java 并发编程中的线程池化；网络应用中套接字连接的池化；游戏开发中对频繁创建销毁的游戏对象做对象池管理。

## 七、工厂套件（factory-kit）

**意图（全译）**：工厂套件模式帮助创建"建造者接口与工厂接口分离"的工厂，适用于复杂对象创建场景的管理。

**通俗解释**：factory kit 是可配置的对象建造器，是"创造工厂的工厂"。README 的类比是餐厅厨房：中央站点登记了各菜品的原料与配方，订单来了按登记的配方备餐，厨师无需了解每道配方的细节。

**仓库实现解析**。整个模式浓缩在一个接口的两个方法里：

```java
// factory-kit/src/main/java/com/iluwatar/factorykit/WeaponFactory.java（节选）
public interface WeaponFactory {

  Weapon create(WeaponType name);

  static WeaponFactory factory(Consumer<Builder> consumer) {
    var map = new HashMap<WeaponType, Supplier<Weapon>>();
    consumer.accept(map::put);
    return name -> map.get(name).get();
  }
}
```

```java
// factory-kit/src/main/java/com/iluwatar/factorykit/Builder.java（全量）
import java.util.function.Supplier;

public interface Builder {

  void add(WeaponType name, Supplier<Weapon> supplier);
}
```

`factory(Consumer<Builder>)` 接收一段配置代码：调用方通过 `builder.add(WeaponType.SWORD, Sword::new)` 注册"类型 → 构造器"映射，返回的工厂是一个 Lambda，`create` 时查表调用对应 `Supplier`。与工厂方法的差异在于：产品类型集合由使用者在运行时注册，而非编译期固定在类层次中。

**何时使用（译）**：当工厂类无法预料它必须创建的对象类型、需要定制 builder 的新实例而非全局实例；当工厂能建造的对象类型需要在类的外部定义；当 builder 与创建者接口需要分离；以及游戏开发等存在用户自定义需求的应用。

**利弊（README "Benefits and Trade-offs" 全译）**：收益——免除把应用专用类绑定进代码，促进松耦合；把实例化职责移交给工厂对象，简化代码。代价——引入额外的类与接口，可能增加代码复杂度；管理不当会造成依赖问题。

**真实世界应用（README "Real-World Applications" 全译）**：JDK 这类 Java 库会依据运行环境实例化不同的渲染引擎；大量使用依赖注入的 Spring 之类框架，也常实现该模式以更灵活地管理对象创建。

## 八、惰性加载（lazy-loading）

> 仓库分类：Performance optimization（性能优化）。

**意图（全译）**：惰性加载把对象的初始化推迟到真正需要它的时候，从而把内存占用降到最低、缩短启动时间。这是优化 Java 应用性能的关键技术。

**通俗解释**：把对象或资源的创建延迟到实际需要时进行，优化内存使用并提升性能。README 的类比是智能家居：进门时不会点亮所有灯，而是由传感器只打开有人使用的房间的灯。

**仓库实现解析**。`HolderThreadSafe` 展示了最直接的写法——`synchronized` 方法内判空再建：

```java
// lazy-loading/src/main/java/com/iluwatar/lazy/loading/HolderThreadSafe.java（节选）
@Slf4j
public class HolderThreadSafe {

  private Heavy heavy;

  /** Get heavy object. */
  public synchronized Heavy getHeavy() {
    if (heavy == null) {
      heavy = new Heavy();
    }
    return heavy;
  }
}
```

`Java8Holder` 则给出无锁的函数式写法：字段是一个可替换的 `Supplier`，首次访问后替换为直接返回缓存实例的实现：

```java
// lazy-loading/src/main/java/com/iluwatar/lazy/loading/Java8Holder.java（节选）
@Slf4j
public class Java8Holder {

  private Supplier<Heavy> heavy = this::createAndCacheHeavy;

  public Heavy getHeavy() {
    return heavy.get();
  }

  private synchronized Heavy createAndCacheHeavy() {
    class HeavyFactory implements Supplier<Heavy> {
      private final Heavy heavyInstance = new Heavy();

      @Override
      public Heavy get() {
        return heavyInstance;
      }
    }
    if (!(heavy instanceof HeavyFactory)) {
      heavy = new HeavyFactory();
    }
    return heavy.get();
  }
}
```

首次调用走 `createAndCacheHeavy`（方法引用），之后 `heavy` 已是 `HeavyFactory`，直接返回缓存值——把"判空"变成了"类型判断"，日常读取路径完全无锁。

**何时使用（译）**：当对象创建资源消耗大且未必会被用到；当需要延迟对象创建以优化内存或缩短启动时间；当数据或资源应当"按需即时"加载而非在应用启动时全量加载。

**利弊（README "Benefits and Trade-offs" 全译）**：收益——只在需要时初始化对象，降低内存占用；推迟高开销对象创建，改善启动性能。代价——对象相互依赖时实现复杂；若初始化发生在意料之外的时刻，可能出现延迟尖峰。

**真实世界应用（README "Real-World Applications" 全译）**：Hibernate（Java ORM 框架）把关联对象的加载推迟到真正访问时；JPA 的 @OneToOne、@OneToMany、@ManyToOne、@ManyToMany 注解配合 fetch = FetchType.LAZY；Spring 框架（依赖注入）只在需要时装配 bean，缩短应用启动时间。

## 小结

创建型模式的主线只有一句话：**把 new 的决定权从使用方移走**。单例控制"造几个"，工厂方法把"造什么"下放给子类，抽象工厂绑定"一族配套产品"，建造者拆解"多步骤装配"，原型用克隆替代重建，对象池回收复用，工厂套件把产品类型注册权交给运行时，惰性加载把创建时机推迟到最后一刻。下一讲进入结构型模式：对象造出来之后，如何用组合搭出更大的结构。

---

> **来源**：本文基于 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns) 仓库原文（MIT 许可证）翻译整理，Java 代码引自仓库实现，版权归原仓库作者所有。
