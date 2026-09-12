---
title: E-R 建模与范式：以"会话-消息"表设计为例
source_url: https://eng.libretexts.org/Bookshelves/Computer_Science/Databases_and_Data_Structures/Database_Design_2e_(Watt)/01%3A_Chapters/1.08%3A_The_Entity_Relationship_Data_Model
author: Adrienne Watt / Nelson Eng（Database Design - 2nd Edition）
license: CC BY 4.0
fetched_at: 2026-09-13
translated: true
order: 2
versions: 概念性内容，适用于所有关系数据库
---

> **来源**：本文翻译自 [1.8: The Entity Relationship Data Model](https://eng.libretexts.org/Bookshelves/Computer_Science/Databases_and_Data_Structures/Database_Design_2e_(Watt)/01%3A_Chapters/1.08%3A_The_Entity_Relationship_Data_Model)，作者 Adrienne Watt / Nelson Eng（Database Design - 2nd Edition），许可 CC BY 4.0。抓取于 2026-09-13。

> **补充来源**：本文"范式"一节翻译自同一本开放教科书的 [1.12: Normalization](https://eng.libretexts.org/Bookshelves/Computer_Science/Databases_and_Data_Structures/Database_Design_2e_(Watt)/01%3A_Chapters/1.12%3A_Normalization)，许可同上；文末"站内实战"小节为本站编者补充。原文配图已删去，图示信息以文字或表格转写说明。

## E-R 数据模型

实体关系（ER，Entity Relationship）数据模型已存在超过 35 年。它相当抽象、易于讨论和解释，又可以直接翻译成关系（表），因此非常适合数据库的数据建模。ER 模型（也称 ER 模式，ER Schema）用 ER 图（ERD，ER Diagram）表示。

ER 建模基于两个概念：

- **实体（Entity）**：存放特定信息（数据）的表；
- **联系（Relationship）**：实体之间的关联或交互。

两者组合的例子：Ba 教授（实体）—讲授（联系）—数据库系统课程（实体）。

原文用一个示例数据库 COMPANY 贯穿全章，它包含员工、部门与项目的信息：公司有多个部门，每个部门有唯一编号、名称、办公地点和一名管理者；一个部门控制若干项目，每个项目有唯一名称、唯一编号和预算；每名员工有姓名、编号、地址、工资和出生日期，归属于一个部门但可参与多个项目（并记录参加每个项目的开始日期），还需记录每名员工的直接主管；此外要跟踪每名员工的家眷（Dependent），每个家眷有姓名、出生日期和与员工的关系。

### 实体、实体集与实体类型

**实体（Entity）**是现实世界中独立存在、可与其他对象区分的对象。它可以是物理存在的对象（如讲师、学生、汽车），也可以是概念存在的对象（如课程、岗位、职位）。

实体按"强弱"分类：如果一个实体的表在存在性上依赖别的表，它就是**弱实体（Weak Entity）**——离开与另一实体的联系就无法存在，其主键派生自父实体的主键。例如 COMPANY 库中的 Spouse（配偶）表，没有对应的员工记录，配偶记录就无从谈起。能独立于相关实体存在的则是**强实体（Strong Entity）**；没有外键的表，或外键允许为空的表，都是强实体。

**实体类型（Entity Type）**定义相似实体的集合；**实体集（Entity Set）**是某一时刻某实体类型的实体的集合。ER 图中实体类型画成一个带名字的方框（如 EMPLOYEE）。

**存在依赖（Existence Dependency）**：若一个实体拥有强制外键（不允许为空的外键），它就是存在依赖的——Spouse 实体依赖 Employee 实体正是如此。

### 实体的种类

**独立实体（Independent Entity）**又称内核（Kernel），是数据库的骨架，其他表以它为基础。特点：是数据库的构建单元；主键可以是简单主键或复合主键；主键不是外键；不依赖其他实体存在。COMPANY 库中的 Customer、Employee、Product 表都是独立实体。

**依赖实体（Dependent Entity）**又称派生实体（Derived Entity），意义依赖其他表。特点：用于把两个内核连接起来；在存在性上依赖两张以上的表；多对多联系会变成带有至少两个外键的关联表（Associative Table）；可以包含其他属性；外键标识各被关联的表；主键有三种选择——用被关联表外键的组合（若能唯一）、用外键组合再加一个限定列、或新建一个简单主键。

**特征实体（Characteristic Entity）**为另一张表提供更多信息。特点：表示多值属性；描述其他实体；通常是一对多联系；外键用于进一步标识被描述的表；主键可用"外键+限定列"或新建简单主键。COMPANY 库中的例子：`Employee (EID, Name, Address, Age, Salary)` 中 EID 是简单主键；`EmployeePhone (EID, Phone)` 中 EID 是复合主键的一部分，同时也是外键。

## 属性

每个实体由一组属性描述，如 `Employee = (Name, Address, Birthdate, Salary)`。每个属性有名字，关联一个实体和一个合法值域——但属性的域不画在 ER 图上；ER 图中属性用带名字的椭圆表示。

### 属性的类型

**简单属性（Simple Attribute）**取自原子值域，也称单值属性。例如 `Name = {John}`、`Age = {23}`。

**复合属性（Composite Attribute）**由属性的层次结构组成。例如地址（Address）可再分为门牌号、街道、区：`Address = {59 + 'Meek Street' + 'Kingsford'}`。

**多值属性（Multivalued Attribute）**对每个实体有一组值。例如员工拥有多个学位：BSc、MIT、PhD。

**派生属性（Derived Attribute）**的值由其他属性计算而来。例如年龄（Age）可以从出生日期（Birthdate）推出；此时的 Birthdate 称为**存储属性（Stored Attribute）**，被物理保存到数据库中。

## 键

**键（Key）**是能唯一标识实体集中单个实体的属性或属性组，是实体上的重要约束。常见类型：

- **候选键（Candidate Key）**：唯一且最小化的简单或复合键。"唯一"指任意时刻表中两行不会有相同取值；"最小"指其中每一列对保证唯一性都必不可少。对 `Employee (EID, FirstName, LastName, SIN, Address, Phone, BirthDate, Salary, DepartmentID)` 而言，候选键可以是 EID、SIN（社会保险号），或者——在"公司内无重名"的假设下——姓+名，或姓+部门号。
- **复合键（Composite Key）**：由两个或更多属性组成，且必须最小化。
- **主键（Primary Key）**：被设计者选中、作为整个实体集标识机制的候选键，必须能唯一标识元组且不允许为空。ER 模型中主键属性加下划线表示。
- **次键（Secondary Key）**：严格用于检索目的的属性（可为复合），如 Phone + LastName。
- **备选键（Alternate Key）**：未被选为主键的所有候选键。
- **外键（Foreign Key, FK）**：引用另一张表主键的属性，也可以为空；外键与被引用主键必须是相同数据类型。上例中 DepartmentID 就是外键。

## 空值

**空值（Null）**是独立于数据类型的特殊符号，表示"未知"或"不适用"，不等于零或空串。其特性包括：没有数据录入；主键中不允许出现；其他属性中应尽量避免；可表示未知值、已知但缺失的值、"不适用"三种情形；会让 COUNT/AVERAGE/SUM 之类的函数出问题；关联表时也可能造成逻辑问题。

注意：比较或算术运算的任一参数为 null 时结果也为 null（忽略 null 的函数除外）。

原文用工资表演示了 null 的实际影响：查询"Sales 部门工资加提成大于 30000 的员工"时，`WHERE jobName = 'Sales' AND (commission + salary) > 30000` 会漏掉提成列为 null 的员工 E13（加法结果为 null，不满足条件）。解决办法是逐字段判断：`WHERE ... (commission > 30000 OR salary > 30000 OR (commission + salary) > 30000)`，这样 E13 才会被查出来。

## 联系

**联系（Relationship）**是把表"粘合"在一起的东西，用于跨表连接相关信息。

**联系强度（Relationship Strength）**由被关联实体主键的定义方式决定：若子实体的主键不包含父实体的主键成分，是弱联系（非标识联系），如 `Customer(CustID, CustName)` 与 `Order(OrderID, CustID, Date)`；若子实体主键包含父实体主键成分，则是强联系（标识联系），如 `Course(CrsCode, DeptCode, Description)` 与 `Class(CrsCode, Section, ClassTime…)`。

### 联系的类型

**一对多（1:M）**：任何关系数据库设计中的常态，如一个部门有多名员工。

**一对一（1:1）**：一个实体只对应另一个实体，反之亦然。在关系数据库设计中应当少见——它的出现往往暗示两个实体其实可以放进同一张表。COMPANY 库的例子是一名员工对应一名配偶。

**多对多（M:N）**：注意——它无法在关系模型中直接实现，必须拆成两个 1:M。要点：通过引入复合实体（Composite Entity，也叫桥接实体 Bridge Entity）来拆分；复合实体表至少要包含原两张表的主键；连接表中会有外键值的多次出现；可按需增加其他属性。例如员工可以参与多个项目、项目也可以有多名员工；学生可以选多门课、课堂里有多个学生。原文进一步给出例子：员工在不同项目有不同的开始日期，因此需要一张 JOIN 表，包含 EID、项目编号（Code）和开始日期（StartDate）。

映射 M:N 二元联系的步骤：对每个 M:N 二元联系，设 A、B 为参与联系 R 的两个实体类型，新建关系 S 来表示 R；S 需要包含 A 和 B 的主键——它们合起来可以作为 S 的主键，或与另一个简单属性组合成主键。

**一元联系（Unary/递归联系）**：同一实体集的诸实例之间发生的联系。此时主键与外键同源，但代表同一实体的两种不同角色；可为这种实体单独建一列引用同一实体集的主键（如"员工的直接主管也是员工"）。

**三元联系（Ternary Relationship）**：三个表之间的多对多联系。对每个 n 元（n > 2）联系，应新建一个关系来表示；新关系的主键是持有"多"方的参与实体主键的组合；大多数 n 元联系中所有参与实体都持有"多"方。

## 范式

以下一节翻译自同书 1.12 章。

**规范化（Normalization）**应当成为数据库设计流程的一部分，但它与 E-R 建模难以割裂，两种技术应同时使用：用 ERD 提供组织数据需求与业务运作的宏观视图（通过识别实体、属性、联系的迭代过程建立），而规范化聚焦具体实体的特征，是 ERD 内实体的微观视图。

规范化是关系理论中提供设计洞察的分支，即"确定一张表中存在多少冗余"的过程。其目标是：能够刻画关系模式的冗余级别；提供转换模式以消除冗余的机制。规范化理论大量借助函数依赖（Functional Dependency）理论，定义了六种范式（NF，Normal Form）。每种范式规定模式必须满足的一组依赖性质，并对更新异常（Update Anomaly）的存在与否给出保证——范式越高，冗余越少，更新问题也越少。原文讨论前四种：1NF、2NF、3NF 与 BCNF（BCNF 很少使用）。

理想情况下，我们只希望保留主键到外键的最小冗余，其他一切都应能从别的表推导出来。

### 第一范式（1NF）

1NF 只允许行与列的交叉处出现单值，即不存在重复组（Repeating Group）。

要把含重复组的关系规范化，就移除重复组、拆成两个新关系；新关系的主键是"原关系主键 + 新关系中的某属性"的组合，以保证唯一标识。

原文以 School 库的 Student_Grade_Report 表为例：

```text
Student_Grade_Report (StudentNo, StudentName, Major,
    CourseNo, CourseName, InstructorNo, InstructorName,
    InstructorLocation, Grade)
```

一个学生可以选多门课，课程信息就是重复组。移除它并确定新表主键（StudentNo + CourseNo），得到两张表：

```text
Student       (StudentNo, StudentName, Major)
StudentCourse (StudentNo, CourseNo, CourseName, InstructorNo,
               InstructorName, InstructorLocation, Grade)
```

Student 表去掉重复组后已满足 1NF。但 1NF 的 StudentCourse 仍有更新异常：新增一门课时必须有学生；更新课程信息可能造成不一致；删除学生可能连带删除课程的关键信息。

### 第二范式（2NF）

2NF 要求先满足 1NF。当且仅当主键只含单个属性时，关系自动满足 2NF；若主键是复合主键，则每个非键属性必须完全函数依赖于整个主键，而不能只依赖主键的子集（即不存在部分依赖，Partial Dependency）。

上例中 Student 表主键是单列，已属 2NF；检查 StudentCourse 发现并非所有属性都完全依赖主键——课程信息只依赖 CourseNo，唯一完全依赖整个主键的是成绩 Grade。拆分后得到三张表：

```text
Student           (StudentNo, StudentName, Major)
CourseGrade       (StudentNo, CourseNo, Grade)
CourseInstructor  (CourseNo, CourseName, InstructorNo,
                   InstructorName, InstructorLocation)
```

但 2NF 下仍有异常：新增讲师需要先有课程；更新课程信息可能导致讲师信息不一致；删除课程可能连带删除讲师信息。

### 第三范式（3NF）

3NF 要求先满足 2NF，并消除所有传递依赖（Transitive Dependency）——非键属性不得函数依赖于另一个非键属性。做法：从每个存在传递依赖的表中消除传递依赖的属性，为被移除的依赖建立新表，再检查新表与修改后的表，确保每张表都有决定子（Determinant）且不含不适当的依赖。结果得到四张表：

```text
Student      (StudentNo, StudentName, Major)
CourseGrade  (StudentNo, CourseNo, Grade)
Course       (CourseNo, CourseName, InstructorNo)
Instructor   (InstructorNo, InstructorName, InstructorLocation)
```

**表：School 数据库规范化流程小结（依赖图相关缩写）**

| 缩写 | 含义 |
| --- | --- |
| PD | 部分依赖（Partial Dependency） |
| TD | 传递依赖（Transitive Dependency） |
| FD | 完全依赖（Full Dependency，仅原文依赖图中如此使用；FD 通常指函数依赖） |

到这里，3NF 下应当不再有异常。

### BC 范式（BCNF）

当一张表有多个候选键时，即使已属 3NF 也可能出现异常。BCNF 是 3NF 的特例：当且仅当每一个决定子都是候选键时，关系属于 BCNF。

原文以 St_Maj_Adv 表（Student_id, Major, Advisor）为例，业务规则是：每个学生可选多个专业；对每个专业，一个学生只有一名导师；每个专业有多名导师；每名导师只指导一个专业；每名导师在同一专业中指导多名学生。函数依赖有两条：`Student_id, Major → Advisor`（候选键）与 `Advisor → Major`（非候选键）。异常包括：删除学生会连带删除导师信息、新导师出现需要先有学生、更新可能不一致。

由于不存在单属性候选键（主键只能取 Student_id+Major 或 Student_id+Advisor），将 St_Maj_Adv 化为 BCNF 的办法是拆成两张表：`St_Adv (Student_id, Advisor)` 与 `Adv_Maj (Advisor, Major)`。

原文还给出了 Client_Interview（客户面试安排）表的第二个例子：该表有多个候选键（如 ClientNo+InterviewDate，StaffNo+InterviewDate+InterviewTime，RoomNo+InterviewDate+InterviewTime），而 `StaffNo, InterviewDate → RoomNo` 的决定子不是候选键，违反 BCNF。解决方案同样是拆表：把前三条函数依赖收进 Client_Interview2，把第四条单独放进 StaffRoom。

### 规范化与数据库设计

在数据库设计的规范化过程中，应当在创建表结构之前确认拟议实体满足所需范式。许多真实世界的数据库设计不当，或在长期演进中被不当地修改而背上异常包袱。你可能会被要求重新设计、修改既有数据库——若表没有恰当规范化，这将是一项浩大工程。

## 站内实战：把"会话-消息"设计到 3NF

> 本小节为本站编者补充，将上文方法应用到一个典型的 LLM 对话应用，便于对照理解。

**第一步（ERD 宏观视图）**：识别实体——`Conversation`（会话）与 `Message`（消息），都是独立实体（内核）；二者之间是 1:M 联系（一次会话有多条消息）。

**第二步（检查重复组，进 1NF）**：如果为了省表，把一条会话的所有消息塞进 conversations 表的一列里（如 `messages TEXT` 存 JSON 数组），就违反了 1NF——行与列的交叉处出现了多值。修法与原文一致：移除重复组，独立出 messages 表。

**第三步（检查部分依赖，进 2NF）**：假设消息表用复合主键 `(conversation_id, seq)`，而表里又存了 `conversation_title` 这类只依赖 `conversation_id` 的属性，就存在部分依赖，应把会话级属性留在 conversations 表。

**第四步（检查传递依赖，进 3NF）**：如果 messages 表里存了 `model_name` 和 `model_vendor`（厂商可由模型推出），`model_name → model_vendor` 就是传递依赖，应把模型信息独立成 `models` 表，消息表只保留外键 `model_id`。

最终骨架：

```sql
CREATE TABLE conversations (
    id         BIGINT PRIMARY KEY,
    title      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE models (
    id     BIGINT PRIMARY KEY,
    name   TEXT NOT NULL UNIQUE,
    vendor TEXT NOT NULL
);

CREATE TABLE messages (
    id              BIGINT PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id),
    seq             INTEGER NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT NOT NULL,
    model_id        BIGINT REFERENCES models(id),
    UNIQUE (conversation_id, seq)
);
```

要不要为"查某用户的全部会话"再加一层 `users` 表并通过复合外键建立强联系，取决于你的业务规则——这正是原文反复强调的：范式之外，最终决定权在业务。
