---
title: 企业级架构模式：从 Ambassador 到 Anti-Corruption Layer
source_url: https://github.com/iluwatar/java-design-patterns
author: iluwatar/java-design-patterns 社区
license: MIT（仓库 LICENSE.md 原文核实；代码与说明文档教学性翻译转载，逐篇署名）
fetched_at: 2026-09-13
translated: true
order: 5
---

# 企业级架构模式：从 Ambassador 到 Anti-Corruption Layer

企业级模式的尺度不再是单个类，而是模块、服务乃至整个系统。仓库按官方分类把这类内容散布在 Integration（集成，6 个）、Architectural（架构，28 个）、Data access（数据访问，12 个）、Resilience（弹性，8 个）、Concurrency（并发，23 个）、Testing（测试，4 个）等多个分类中。本篇精选 9 个最具工程代表性的模式精讲：ambassador、anti-corruption-layer、actor-model、arrange-act-assert、data-transfer-object、unit-of-work、monostate、event-driven-architecture、layered-architecture，文末附 CQRS 与 repository 两个延伸模式。各模式意图与适用场景译自该模式目录 README 原文，代码引自仓库真实实现并标注路径。

## 一、大使（ambassador）

> 仓库分类：Integration（集成）。

**意图（README "Intent of Ambassador Design Pattern" 全译）**：大使模式帮助把监控、日志、路由等公共功能性任务从共享资源卸载到辅助服务实例（协进程）中，提升分布式系统的性能与可维护性。

**通俗解释（"In plain words" 译）**：借助大使模式，我们可以实现更低频的客户端轮询，以及延迟检查与日志。README 的类比是酒店礼宾：客人（客户端服务）不必逐一直接联系餐厅、票务、车队（远程服务），一切外部交互由礼宾（大使）代办。微软文档表述：大使服务可以看作与客户端同址部署的进程外代理，用于以语言无关的方式卸载监控、日志、路由、安全（如 TLS）与弹性等客户端连接性任务，常用于难以修改的遗留应用。

**仓库实现解析**。`ServiceAmbassador` 在客户端与远程服务之间加入延迟测量、日志与重试：

```java
// ambassador/src/main/java/com/iluwatar/ambassador/ServiceAmbassador.java（节选）
@Slf4j
public class ServiceAmbassador implements RemoteServiceInterface {

  private static final int RETRIES = 3;
  private static final int DELAY_MS = 3000;

  @Override
  public long doRemoteFunction(int value) {
    return safeCall(value);
  }

  private long checkLatency(int value) {
    var startTime = System.currentTimeMillis();
    var result = RemoteService.getRemoteService().doRemoteFunction(value);
    var timeTaken = System.currentTimeMillis() - startTime;
    LOGGER.info("Time taken (ms): {}", timeTaken);
    return result;
  }

  private long safeCall(int value) {
    var retries = 0;
    var result = FAILURE.getRemoteServiceStatusValue();
    for (int i = 0; i < RETRIES; i++) {
      if (retries >= RETRIES) {
        return FAILURE.getRemoteServiceStatusValue();
      }
      if ((result = checkLatency(value)) == FAILURE.getRemoteServiceStatusValue()) {
        LOGGER.info("Failed to reach remote: ({})", i + 1);
        retries++;
        try {
          sleep(DELAY_MS);
        } catch (InterruptedException e) {
          LOGGER.error("Thread sleep state interrupted", e);
          Thread.currentThread().interrupt();
        }
      } else {
        break;
      }
    }
    return result;
  }
}
```

```java
// ambassador/src/main/java/com/iluwatar/ambassador/Client.java（全量）
@Slf4j
public class Client {

  private final ServiceAmbassador serviceAmbassador = new ServiceAmbassador();

  long useService(int value) {
    var result = serviceAmbassador.doRemoteFunction(value);
    LOGGER.info("Service result: {}", result);
    return result;
  }
}
```

客户端只面对大使；重试节奏（3 次、间隔 3 秒）与延迟遥测完全收敛在大使内部。

**何时使用（译）**：该模式对云原生与微服务架构特别有益，可用于监控、日志与保护服务间通信；遗留系统集成——代办必要但非核心的功能以便与新服务通信；性能增强——缓存结果或压缩数据以提高通信效率。典型用例：控制对另一对象的访问、实现日志、实现熔断、卸载远程服务任务、简化网络连接。

## 二、防腐层（anti-corruption-layer）

> 仓库分类：Integration（集成）。

**意图（全译）**：防腐层（ACL）是 Java 开发中系统集成与数据完整性保护的关键模式：在不共享相同语义的子系统之间实现外观或适配器层。它在不同数据格式与系统之间做转换，确保系统集成不会腐蚀业务逻辑或破坏数据完整性。

**通俗解释**：用中介翻译层保护系统免受外部系统的复杂性与变更影响。微软文档（README 引用）表述：在不共享语义的子系统之间实现外观或适配器层，翻译一方对另一方发出的请求，确保应用设计不受外部子系统依赖的制约。该模式最早由 Eric Evans 在《领域驱动设计》中描述。

**仓库实现解析**。场景是遗留商店系统与现代商店系统共存：`AntiCorruptionLayer` 把遗留订单翻译成现代领域模型：

```java
// anti-corruption-layer/src/main/java/com/iluwatar/corruption/system/AntiCorruptionLayer.java（节选）
@Service
public class AntiCorruptionLayer {

  @Autowired private LegacyShop legacyShop;

  /**
   * The method converts the order from the legacy system to the modern system.
   */
  public Optional<ModernOrder> findOrderInLegacySystem(String id) {
    return legacyShop
        .findOrder(id)
        .map(
            o ->
                new ModernOrder(
                    o.getId(),
                    new Customer(o.getCustomer()),
                    new Shipment(o.getItem(), o.getQty(), o.getPrice()),
                    ""));
  }
}
```

```java
// anti-corruption-layer/src/main/java/com/iluwatar/corruption/system/modern/ModernShop.java（节选）
  public void placeOrder(ModernOrder order) throws ShopException {
    String id = order.getId();
    // check if the order is already present in the legacy system
    Optional<ModernOrder> orderInObsoleteSystem = acl.findOrderInLegacySystem(id);
    if (orderInObsoleteSystem.isPresent()) {
      var legacyOrder = orderInObsoleteSystem.get();
      if (!order.equals(legacyOrder)) {
        throw ShopException.throwIncorrectData(legacyOrder.toString(), order.toString());
      }
    } else {
      store.put(id, order);
    }
  }
```

现代系统通过 ACL 读取遗留订单并做一致性校验，`LegacyOrder` 的字段结构从不渗入 `ModernShop` 的领域模型——"防腐"防的就是模型互相污染。

**何时使用（译）**：当迁移计划分多个阶段进行、但新旧系统需要持续集成；当两个及以上子系统语义不同却必须通信；当与遗留或外部系统集成时直接对接可能污染新系统领域模型；当较大系统内各子系统使用不同数据格式或结构；当需要确保子系统/外部服务之间松耦合以便维护与扩展时。

## 三、Actor 模型（actor-model）

> 仓库分类：Concurrency（并发）。

**意图（README "Intent of Actor Model Pattern" 全译）**：Actor 模型通过使用彼此隔离的构件（actor）、并让它们仅通过异步消息传递进行交互，来构建高度并发、分布式与容错的系统。

**通俗解释（README 原文译）**："Actor 就像独立工人：从不共享内存，只通过消息沟通。" 维基百科表述：Actor 模型是一种并发计算的数学模型，把"actor"当作并发计算的通用原语。

**仓库实现解析**。仓库不依赖 Akka，用 `BlockingQueue` 当邮箱、线程池调度 actor，几十行实现内核：

```java
// actor-model/src/main/java/com/iluwatar/actormodel/Actor.java（节选）
public abstract class Actor implements Runnable {

  @Setter @Getter private String actorId;
  private final BlockingQueue<Message> mailbox = new LinkedBlockingQueue<>();
  private volatile boolean active =
      true; // always read from main memory and written back to main memory,

  // rather than being cached in a thread's local memory. To make it consistent to all Actors

  public void send(Message message) {
    mailbox.add(message); // Add message to queue
  }

  public void stop() {
    active = false; // Stop the actor loop
  }

  @Override
  public void run() {
    while (active) {
      try {
        Message message = mailbox.take(); // Wait for a message
        onReceive(message); // Process it
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }

  // Child classes must define what to do with a message
  protected abstract void onReceive(Message message);
}
```

```java
// actor-model/src/main/java/com/iluwatar/actormodel/ActorSystem.java（节选）
public class ActorSystem {

  private final ExecutorService executor = Executors.newCachedThreadPool();
  private final ConcurrentHashMap<String, Actor> actorRegister = new ConcurrentHashMap<>();
  private final AtomicInteger idCounter = new AtomicInteger(0);

  public void startActor(Actor actor) {
    String actorId = "actor-" + idCounter.incrementAndGet(); // Generate a new and unique ID
    actor.setActorId(actorId); // assign the actor it's ID
    actorRegister.put(actorId, actor); // Register and save the actor with it's ID
    executor.submit(actor); // Run the actor in a thread
  }
}
```

每个 actor 串行处理自己邮箱里的消息，状态从不跨线程共享；`ExampleActor` 收到消息后还能按 `senderId` 回信。

**何时使用（译）**：构建并发或分布式系统时；想要零共享可变状态时；需要异步、消息驱动的通信时；希望组件彼此隔离、松耦合时。

## 四、准备-执行-断言（arrange-act-assert）

> 仓库分类：Testing（测试）。

**意图（全译）**：Arrange/Act/Assert 模式是 Java 单元测试的重要模式：把单元测试清晰地组织为三个不同阶段——准备（Arrange）、执行（Act）、验证（Assert）。

**通俗解释**：AAA 是组织单元测试方法代码的格式模式。README 的类比是筹办活动：先布置场地与席位（Arrange），按计划执行活动（Act），活动后核对反馈与完成度（Assert）。

**仓库实现解析**。被测对象是一个极简的现金类：

```java
// arrange-act-assert/src/main/java/com/iluwatar/arrangeactassert/Cash.java（节选）
@AllArgsConstructor
public class Cash {

  private int amount;

  // plus
  void plus(int addend) {
    amount += addend;
  }

  // minus
  boolean minus(int subtrahend) {
    if (amount >= subtrahend) {
      amount -= subtrahend;
      return true;
    } else {
      return false;
    }
  }

  // count
  int count() {
    return amount;
  }
}
```

README 展示的测试写法为：Arrange 阶段 `var cash = new Cash(5)` 并执行 `cash.plus(6)`；Act 阶段调用 `var result = cash.minus(3)`；Assert 阶段以 `assertTrue(result)`、`assertEquals(8, cash.count())` 验证。三个阶段在测试方法内上下分明。

**何时使用（译）**：单元测试（尤其在 TDD 与 BDD 语境下）；任何需要在测试用例中保持清晰与结构的场合。

## 五、数据传输对象（data-transfer-object）

> 仓库分类：Structural。

**意图（全译）**：DTO 模式用于在软件应用的子系统或层之间传输数据，尤其常见于网络调用或数据库读取场景。它把数据聚合到单次传输中，减少方法调用次数。

**通俗解释（"In plain words" 译）**：使用 DTO，一次后端查询即可取回一组相关信息。维基百科表述（README 引用）：进程间通信通常经由远程接口（如 Web 服务），每次调用都开销不菲；由于每次调用的大头是客户端与服务器之间的往返时间，减少调用次数的方法之一就是用一个对象（DTO）聚合本需多次调用传输的数据。

**仓库实现解析**。仓库用枚举命名空间组织嵌套 DTO 家族，同一产品对管理员与顾客暴露不同视图：

```java
// data-transfer-object/src/main/java/com/iluwatar/datatransfer/product/ProductDto.java（节选）
/**
 * {@link ProductDto} is a data transfer object POJO. Instead of sending individual information to
 * client We can send related information together in POJO.
 *
 * <p>Dto will not have any business logic in it.
 */
public enum ProductDto {
  ;

  public enum Request {
    ;

    /** This is Create dto class for requesting create new product. */
    public static final class Create implements Name, Price, Cost, Supplier {
      private String name;
      private Double price;
      private Double cost;
      private String supplier;
    }
  }
}
```

```java
// data-transfer-object/src/main/java/com/iluwatar/datatransfer/product/ProductResource.java（节选）
public record ProductResource(List<Product> products) {

  public List<ProductDto.Response.Private> getAllProductsForAdmin() {
    return products.stream()
        .map(
            p ->
                new ProductDto.Response.Private()
                    .setId(p.getId())
                    .setName(p.getName())
                    .setCost(p.getCost())
                    .setPrice(p.getPrice()))
        .toList();
  }

  public List<ProductDto.Response.Public> getAllProductsForCustomer() {
    return products.stream()
        .map(
            p ->
                new ProductDto.Response.Public()
                    .setId(p.getId())
                    .setName(p.getName())
                    .setPrice(p.getPrice()))
        .toList();
  }
}
```

`Private` 视图含成本、`Public` 视图隐去成本——同一份数据按消费者裁剪传输对象，且 DTO 本身不含业务逻辑。

**何时使用（译）**：当需要通过减少调用次数优化网络流量（尤其客户端-服务器架构）；当偏好对数据做批量而非逐条处理；当使用远程接口、需要把传输数据封装进可序列化对象时。

## 六、工作单元（unit-of-work）

> 仓库分类：Data access（数据访问）。

**意图（README "Intent of Unit Of Work Design Pattern" 全译）**：工作单元模式专业地管理并维护一份受业务事务影响的对象列表，协调数据库变更的写出并有效解决并发问题。

**通俗解释**：事务期间跟踪对象的全部变更，最后作为一个整体一次性提交。MartinFowler.com（README 引用）定义：维护一份被业务事务影响的对象列表，协调变更的写出与并发问题的解决。README 的类比是图书馆管理员：不是每笔借还都更新库存系统，而是记录全天变更、日终一次性更新。

**仓库实现解析**。接口只有四个方法，语义全部压在"commit 才生效"上：

```java
// unit-of-work/src/main/java/com/iluwatar/unitofwork/UnitOfWork.java（节选）
public interface UnitOfWork<T> {

  /** Any register new operation occurring on UnitOfWork is only going to be performed on commit. */
  void registerNew(T entity);

  void registerModified(T entity);

  void registerDeleted(T entity);

  /** All UnitOfWork operations batched together executed in commit only. */
  void commit();
}
```

```java
// unit-of-work/src/main/java/com/iluwatar/unitofwork/ArmsDealer.java（节选）
@Slf4j
@RequiredArgsConstructor
public class ArmsDealer implements UnitOfWork<Weapon> {

  private final Map<String, List<Weapon>> context;
  private final WeaponDatabase weaponDatabase;

  @Override
  public void registerNew(Weapon weapon) {
    LOGGER.info("Registering {} for insert in context.", weapon.getName());
    register(weapon, UnitActions.INSERT.getActionValue());
  }

  /** All UnitOfWork operations are batched and executed together on commit only. */
  @Override
  public void commit() {
    if (context == null || context.isEmpty()) {
      return;
    }
    LOGGER.info("Commit started");
    if (context.containsKey(UnitActions.INSERT.getActionValue())) {
      commitInsert();
    }
    if (context.containsKey(UnitActions.MODIFY.getActionValue())) {
      commitModify();
    }
    if (context.containsKey(UnitActions.DELETE.getActionValue())) {
      commitDelete();
    }
  }
}
```

`register*` 只往 context 的操作桶里记账，`commit()` 按插入/修改/删除分批落库——Hibernate 的 Session、EF 的 DbContext 皆源于此。

**何时使用（译）**：当多个数据库操作必须作为单一事务执行，以保证数据一致性完整性；当业务对象的变更需要被跟踪并以协调方式保存；当与 Hibernate 等 ORM 框架协作时。

## 七、单态（monostate）

> 仓库分类：Creational（创建型）。

**意图（全译）**：单态模式是在面向对象设计中实现"单例式行为"的另一种途径：它强制所有实例共享同一状态。与把类限制为单个实例的单例不同，单态允许任意多实例，但保证它们共享状态。

**通俗解释**：维基百科式表述（README 引用 c2 wiki）：单态是"概念上的单例"——它的数据成员全是静态的，因此所有实例使用同一份（静态）数据；应用可以随意创建任意数量的实例。README 的类比是图书馆的多个查询台：每个台面看似独立，但对目录的任何修改立即反映在所有台面上。

**仓库实现解析**。负载均衡器把服务器列表与游标都声明为静态：

```java
// monostate/src/main/java/com/iluwatar/monostate/LoadBalancer.java（节选）
public class LoadBalancer {

  private static final List<Server> SERVERS = new ArrayList<>();
  private static int lastServedId;

  static {
    var id = 0;
    for (var port : new int[] {8080, 8081, 8082, 8083, 8084}) {
      SERVERS.add(new Server("localhost", port, ++id));
    }
  }

  /** Handle request. */
  public synchronized void serverRequest(Request request) {
    if (lastServedId >= SERVERS.size()) {
      lastServedId = 0;
    }
    var server = SERVERS.get(lastServedId++);
    server.serve(request);
  }
}
```

`new` 出多少个 `LoadBalancer` 都行——轮询游标 `lastServedId` 是静态的，所有实例接力推进同一条轮询序列。

**何时使用（README 六条要点摘译）**：当类的所有实例必须共享同一状态（一处修改处处可见）；当希望比单例更"透明"的用法——客户端像使用普通对象一样使用实例，感知不到共享状态；当需要通过子类化扩展行为而不破坏共享状态（单例的构造私有使继承无从谈起，单态则天然支持）；当想避免全局变量但仍需共享状态；当集成期望常规实例语义的既有系统；当需要跨模块的一致配置/状态管理时。

## 八、事件驱动架构（event-driven-architecture）

> 仓库分类：Architectural（架构）。

**意图（全译）**：事件驱动架构（EDA）围绕事件的产生、检测、消费与反应来编排系统行为。该架构使事件生产者与消费者之间实现高度解耦、可扩展的动态互联。

**通俗解释**：系统行为由特定事件的发生驱动，从而实现动态、高效、解耦的响应。README 的类比是空中交通管制系统：飞机进入空域、天气变化、地面车辆移动等事件触发改变航路、分配登机口、更新跑道使用等响应。

**仓库实现解析**。事件沿"事件 → 分发器 → 处理器"流动，分发器维护类型到处理器的映射：

```java
// event-driven-architecture/src/main/java/com/iluwatar/eda/framework/EventDispatcher.java（节选）
public class EventDispatcher {

  private final Map<Class<? extends Event>, Handler<? extends Event>> handlers;

  public <E extends Event> void registerHandler(Class<E> eventType, Handler<E> handler) {
    handlers.put(eventType, handler);
  }

  @SuppressWarnings("unchecked")
  public <E extends Event> void dispatch(E event) {
    var handler = (Handler<E>) handlers.get(event.getClass());
    if (handler != null) {
      handler.onEvent(event);
    }
  }
}
```

```java
// event-driven-architecture/src/main/java/com/iluwatar/eda/handler/UserCreatedEventHandler.java（全量）
@Slf4j
public class UserCreatedEventHandler implements Handler<UserCreatedEvent> {

  @Override
  public void onEvent(UserCreatedEvent event) {
    LOGGER.info("User '{}' has been Created!", event.getUser().username());
  }
}
```

`App` 中先 `registerHandler(UserCreatedEvent.class, new UserCreatedEventHandler())` 再 `dispatch(new UserCreatedEvent(user))`——生产者与消费者互不相识，只共享事件类型。

**何时使用（译）**：变更检测至关重要的系统；需要实时特性与响应式系统的应用；需要高效处理高吞吐与突发负载的系统；与微服务集成以提升敏捷性与可扩展性时。

## 九、分层架构（layered-architecture）

> 仓库分类：Architectural（架构）。

**意图（全译）**：分层架构模式把应用组织成位于不同抽象层级上的子任务分组，便于各层的独立开发与维护。

**通俗解释**：把软件按职责划成层层相叠的分组，各组彼此交互但保持独立。维基百科表述（README 引用）：多层架构（n 层架构）是一种表示、应用处理与数据管理功能在物理上分离的客户端-服务器架构。README 的类比是高层建筑：地基（数据层）、结构层（服务层）、居住层（表示层）、屋顶（API 层）各司其职，装修居住层不必动地基。

**仓库实现解析**。示例是一个烤蛋糕应用，包结构即层次：`entity`（实体）→ `dao`（数据访问）→ `service`（业务）→ `dto`（传输对象）→ `view`（视图）。服务层组合三个 DAO 完成烘焙：

```java
// layered-architecture/src/main/java/service/CakeBakingServiceImpl.java（节选）
@Service
@Transactional
public class CakeBakingServiceImpl implements CakeBakingService {

  private final CakeDao cakeDao;
  private final CakeLayerDao cakeLayerDao;
  private final CakeToppingDao cakeToppingDao;

  @Autowired
  public CakeBakingServiceImpl(
      CakeDao cakeDao, CakeLayerDao cakeLayerDao, CakeToppingDao cakeToppingDao) {
    this.cakeDao = cakeDao;
    this.cakeLayerDao = cakeLayerDao;
    this.cakeToppingDao = cakeToppingDao;
  }

  @Override
  public void bakeNewCake(CakeInfo cakeInfo) throws CakeBakingException {
    var allToppings = getAvailableToppingEntities();
    var matchingToppings =
        allToppings.stream()
            .filter(t -> t.getName().equals(cakeInfo.cakeToppingInfo.name))
            .toList();
    if (matchingToppings.isEmpty()) {
      throw new CakeBakingException(
          String.format("Topping %s is not available", cakeInfo.cakeToppingInfo.name));
    }
    var topping = cakeToppingDao.findById(matchingToppings.iterator().next().getId());
    if (topping.isPresent()) {
      var cake = new Cake();
      cake.setTopping(topping.get());
      cake.setLayers(foundLayers);
      cakeDao.save(cake);
```

注意 `bakeNewCake` 的入参是 DTO `CakeInfo`、DAO 返回的是实体 `Cake/CakeLayer`——层与层之间各有专用对象类型，正是分层架构的纪律（方法后续部分校验蛋糕坯层并落库，此处从略）。视图层 `CakeViewImpl` 只依赖 `CakeBakingService` 接口，看不到任何 DAO。

**何时使用（README 原文译）**：该模式适用于可以按"每组一个明确职责"划分的应用，常见于企业应用，可简化依赖、增强可维护性、支持扩展与技术栈隔离。具体而言：当想把软件职责清晰地划分到程序的不同部分；当想防止一处改动在整个应用中扩散；当想让应用更易维护、更可测试时。

## 延伸阅读：CQRS 与仓储（repository）

**CQRS（command-query-responsibility-segregation，仓库分类 Architectural）**的意图（README 全译）：把修改应用状态的操作（命令）与读取状态的操作（查询）分离开来，从而提升复杂系统的可扩展性、性能与可维护性。适用场景（README 译）：读写需要不同模型以求扩展性与可维护性的系统（电商平台、高流量网站）；更新对象与读取对象差异显著的复杂领域模型（金融服务、医疗应用）；读操作性能优化至关重要、读写可用不同数据模型甚至不同数据库的场景。

**Repository（仓储，仓库分类 Data access）**的意图（README 全译）：仓储模式充当管理全部数据访问逻辑的中央枢纽，把数据存储与检索的细节从应用其余部分抽象出去。适用场景（README 译）：让业务逻辑与数据访问层解耦；可能使用多种数据源而业务逻辑应对数据源细节无感；便于测试（可用 mock 仓储替代真实数据源）。

## 小结

企业级模式的共同母题是**边界**：大使守住客户端与远程服务的边界，防腐层守住新旧领域的边界，DTO 守住进程/层的传输边界，工作单元守住事务边界，单态守住"共享状态、多实例"的语义边界，事件驱动守住生产者与消费者的时间边界，分层守住抽象层级边界，CQRS 守住读写边界。把这些边界画对，系统的复杂度就有了存放的位置。至此，本专栏四类模式讲解完结——建议回到第 01 篇的索引，选一个与你当前工程问题最接近的模式，去仓库里把示例跑起来。

---

> **来源**：本文基于 [iluwatar/java-design-patterns](https://github.com/iluwatar/java-design-patterns) 仓库原文（MIT 许可证）翻译整理，Java 代码引自仓库实现，版权归原仓库作者所有。
