---
title: 内存管理与垃圾回收：引用计数与 gc 模块
source_url: https://docs.python.org/zh-cn/3/c-api/refcounting.html
author: Python 软件基金会（PSF）文档团队
license: PSF 许可证第 2 版
fetched_at: 2026-09-13
translated: false
versions: Python 3.14 官方文档
order: 4
group: 语言机制进阶
---
本节介绍的函数和宏被用于管理 Python 对象的引用计数。

**Py\_ssize\_t Py\_REFCNT(PyObject \*o)
**

_属于 稳定 ABI 自 3.14 版起._

获取 Python 对象 _o_ 的引用计数。

请注意返回的值可能并不真正反映实际持有的对象引用数。例如，有些对象属于 immortal 对象并具有并不反映实际引用数的非常高的 refcount 值。因此，除了 0 或 1 这两个值，不要依赖返回值的准确性。

使用 `Py_SET_REFCNT()` 函数来设置一个对象引用计数。

备注

在 Python 的 自由线程构建版，返回 1 并不足以确定是否能安全地将 _o_ 视为不可被其他线程访问。对于此类场景请改用 `PyUnstable_Object_IsUniquelyReferenced()`。

另请参阅 `PyUnstable_Object_IsUniqueReferencedTemporary()` 函数。

在 3.10 版本发生变更: `Py_REFCNT()` 被改为内联的静态函数。

在 3.11 版本发生变更: 形参类型不再是 const PyObject\*。

**void Py\_SET\_REFCNT(PyObject \*o, Py\_ssize\_t refcnt)
**

将对象 _o_ 的引用计数器设为 _refcnt_。

在 启用自由线程的 Python 编译版 中，如果 _refcnt_ 大于 `UINT32_MAX`，该对象将被设为 immortal 对象。

此函数对 immortal 对象没有效果。

版本 3.9 中新增。

在 3.12 版本发生变更: 永生对象不会被修改。

**void Py\_INCREF(PyObject \*o)
**

表示为对象 _o_ 获取一个新的 strong reference，指明该对象正在被使用且不应被销毁。

此函数对 immortal 对象没有效果。

此函数通常被用来将 borrowed reference 原地转换为 strong reference。 `Py_NewRef()` 函数可被用来创建新的 strong reference。

当对象使用完毕后，可调用 `Py_DECREF()` 来释放它。

此对象必须不为 `NULL`；如果你不能确定它不为 `NULL`，请使用 `Py_XINCREF()`。

不要预期此函数会以任何方式实际地改变 _o_。至少对 [**某些对象**](https://peps.python.org/pep-0683/) 来说，此函数将没有任何效果。

在 3.12 版本发生变更: 永生对象不会被修改。

**void Py\_XINCREF(PyObject \*o)
**

与 `Py_INCREF()` 类似，但对象 _o_ 可以为 `NULL`，在这种情况下此函数将没有任何效果。

另请参阅 `Py_XNewRef()`。

**PyObject \*Py\_NewRef(PyObject \*o)
**

_属于 稳定 ABI 自 3.10 版起._

为对象创建一个新的 strong reference: 在 _o_ 上调用 `Py_INCREF()` 并返回对象 _o_。

当不再需要这个 strong reference 时，应当在其上调用 `Py_DECREF()` 来释放引用。

对象 _o_ 必须不为 `NULL`；如果 _o_ 可以为 `NULL` 则应改用 `Py_XNewRef()`。

例如：

```c
Py_INCREF(obj);
self->attr = obj;
```

可以写成:

```c
self->attr = Py_NewRef(obj);
```

另请参阅 `Py_INCREF()`。

版本 3.10 中新增。

**PyObject \*Py\_XNewRef(PyObject \*o)
**

_属于 稳定 ABI 自 3.10 版起._

类似于 `Py_NewRef()`，但对象 _o_ 可以为 NULL。

如果对象 _o_ 为 `NULL`，该函数也将返回 `NULL`。

版本 3.10 中新增。

**void Py\_DECREF(PyObject \*o)
**

释放一个指向对象 _o_ 的 strong reference，表明该引用不再被使用。

此函数对 immortal 对象没有效果。

当最后一个 strong reference 被释放时 (即对象的引用计数变为 0)，将会调用该对象所属类型的 deallocation 函数 (它必须不为 `NULL`)。

此函数通常被用于在退出作用域之前删除一个 strong reference。

此对象必须不为 `NULL`；如果你不能确定它不为 `NULL`，请使用 `Py_XDECREF()`。

不要预期此函数会以任何方式实际地改变 _o_。至少对 [**某些对象**](https://peps.python.org/pep-0683/) 来说，此函数将没有任何效果。

警告

释放函数会导致任意 Python 代码被调用（例如当一个带有 `__del__()` 方法的类实例被释放时就是如此）。 虽然这些代码中的异常不会被传播，但被执行的代码能够自由访问所有 Python 全局变量。这意味着在调用 `Py_DECREF()` 之前任何可通过全局变量获取的对象都应该处于完好的状态。 例如，从一个列表中删除对象的代码应该将被删除对象的引用拷贝到一个临时变量中，更新列表数据结构，然后再为临时变量调用 `Py_DECREF()`.

在 3.12 版本发生变更: 永生对象不会被修改。

**void Py\_XDECREF(PyObject \*o)
**

与 `Py_DECREF()` 类似，但对象 _o_ 可以为 `NULL`，在这种情况下此函数将没有任何效果。来自 `Py_DECREF()` 的警告同样适用于此处。

**void Py\_CLEAR(PyObject \*o)
**

释放一个指向对象 _o_ 的 strong reference。对象可以为 `NULL`，在此情况下该宏将没有任何效果；在其他情况下其效果与 `Py_DECREF()` 相同，区别在于其参数也会被设为 `NULL`。针对 `Py_DECREF()` 的警告不适用于所传递的对象，因为该宏会细心地使用一个临时变量并在释放引用之前将参数设为 `NULL`.

当需要释放指向一个在垃圾回收期间可能会被遍历的对象的引用时使用该宏是一个好主意。

在 3.12 版本发生变更: 该宏参数现在只会被求值一次。如果该参数具有附带影响，它们将不会再被复制。

**void Py\_IncRef(PyObject \*o)
**

_属于 稳定 ABI._

表示获取一个指向对象 _o_ 的新 strong reference。 `Py_XINCREF()` 的函数版本。 它可被用于 Python 的运行时动态嵌入。

**void Py\_DecRef(PyObject \*o)
**

_属于 稳定 ABI._

释放一个指向对象 _o_ 的 strong reference。 `Py_XDECREF()` 的函数版本。它可被用于 Python 的运行时动态嵌入。

**Py\_SETREF(dst, src)
**

该宏可安全地释放一个指向对象 _dst_ 的 strong reference，并将 _dst_ 设为 _src_。

在 `Py_CLEAR()` 的情况中，这样“直观”的代码可能会是致命的:

```c
Py_DECREF(dst);
dst = src;
```

安全的方式是这样:

```c
Py_SETREF(dst, src);
```

这样使得在释放对旧 _dst_ 值的引用 _之前_ 将 _dst_ 设为 _src_，从而让任何因 _dst_ 被去除而触发的代码不再相信 _dst_ 指向一个有效的对象。

版本 3.6 中新增。

在 3.12 版本发生变更: 该宏参数现在只会被求值一次。如果某个参数具有附带影响，它们将不会再被复制。

**Py\_XSETREF(dst, src)
**

使用 `Py_XDECREF()` 代替 `Py_DECREF()` 的 `Py_SETREF` 宏的变种。

版本 3.6 中新增。

在 3.12 版本发生变更: 该宏参数现在只会被求值一次。如果某个参数具有附带影响，它们将不会再被复制。


## 对象、类型和引用计数（扩展与嵌入视角）

## 对象、类型和引用计数

多数 Python/C API 函数都有一个或多个参数以及一个 PyObject\* 类型的返回值。这种类型是指向任意 Python 对象的不透明数据类型的指针。由于所有 Python 对象类型在大多数情况下都被 Python 语言用相同的方式处理（例如，赋值、作用域规则和参数传递等），因此用单个 C 类型来表示它们是很适宜的。几乎所有 Python 对象都存在于堆中：你不可声明一个类型为 `PyObject` 的自动或静态的变量，只能声明类型为 PyObject\* 的指针变量。唯一的例外是 type 对象；因为这种对象永远不能被释放，所以它们通常都是静态的 `PyTypeObject` 对象。

所有 Python 对象（甚至 Python 整数）都有一个  和一个 _reference count_。对象的类型确定它是什么类型的对象（例如整数、列表或用户定义函数；还有更多，如 标准类型层级结构 中所述）。对于每个众所周知的类型，都有一个宏来检查对象是否属于该类型；例如，当（且仅当） _a_ 所指的对象是 Python 列表时 `PyList_Check(a)` 为真。

### 引用计数

引用计数之所以重要是因为现有计算机的内存大小是有限的（并且往往限制得很严格）；它会计算有多少不同的地方对一个对象进行了 strong reference。这些地方可以是另一个对象，也可以是全局（或静态）C 变量，或是某个 C 函数中的局部变量。当某个对象的最后一个 strong reference 被释放时（即其引用计数变为零），该对象就会被取消分配。如果该对象包含对其他对象的引用，则会释放这些引用。如果不再有对其他对象的引用，这些对象也会同样地被取消分配，依此类推。（在这里对象之间的相互引用显然是个问题；目前的解决办法，就是“不要这样做”。）

对于引用计数总是会显式地执行操作。通常的做法是使用 `Py_INCREF()` 宏来获取对象的新引用（即让引用计数加一），并使用 `Py_DECREF()` 宏来释放引用（即让引用计数减一）。`Py_DECREF()` 宏比 incref 宏复杂得多，因为它必须检查引用计数是否为零然后再调用对象的释放器。释放器是一个函数指针，它包含在对象的类型结构体中。如果对象是复合对象类型，如列表，则特定于类型的释放器会负责释放对象中包含的其他对象的引用，并执行所需的其他终结化操作。引用计数不会发生溢出；用于保存引用计数的位数至少会与虚拟内存中不同内存位置的位数相同 (假设 `sizeof(Py_ssize_t) >= sizeof(void*)`)。因此，引用计数的递增是一个简单的操作。

没有必要为每个包含指向对象指针的局部变量持有 strong reference (即增加引用计数)。理论上说，当变量指向对象时对象的引用计数就会加一，而当变量离开其作用域时引用计数就会减一。不过，这两种情况会相互抵消，所以最后引用计数并没有改变。使用引用计数的唯一真正原因在于只要我们的变量指向对象就可以防止对象被释放。只要我们知道至少还有一个指向某对象的引用与我们的变量同时存在，就没有必要临时获取一个新的 strong reference (即增加引用计数)。出现引用计数增加的一种重要情况是对象作为参数被传递给扩展模块中的 C 函数而这些函数又在 Python 中被调用；调用机制会保证在调用期间对每个参数持有一个引用。

然而，一个常见的陷阱是从列表中提取对象并在不获取新引用的情况下将其保留一段时间。某个其他操作可能在无意中从列表中移除该对象，释放这个引用，并可能撤销分配其资源。真正的危险在于看似无害的操作可能会调用任意的 Python 代码来做这件事；有一条代码路径允许控制权从 `Py_DECREF()` 流回到用户，因此几乎任何操作都有潜在的危险。

安全的做法是始终使用泛型操作（名称以 `PyObject_`, `PyNumber_`, `PySequence_` 或 `PyMapping_` 开头的函数）。这些操作总是为其返回的对象创建一个新的 strong reference (即增加引用计数)。这使得调用者有责任在获得结果之后调用 `Py_DECREF()`；这种做法很快就能习惯成自然。

#### 引用计数细节

Python/C API 中函数的引用计数最好是使用 _引用所有权_ 来解释。所有权是关联到引用，而不是对象（对象不能被拥有：它们总是会被共享）。“拥有一个引用”意味着当不再需要该引用时必须在其上调用 Py\_DECREF。所有权也可以被转移，这意味着接受该引用所有权的代码在不再需要它时必须通过调用 `Py_DECREF()` 或 `Py_XDECREF()` 来最终释放它 --- 或是继续转移这个责任（通常是转给其调用方）。当一个函数将引用所有权转给其调用方时，则称调用方收到一个 _新的_ 引用。当未转移所有权时，则称调用方是 _借入_ 这个引用。对于 borrowed reference 来说不需要任何额外操作。

反过来，当调用方把一个对象的引用传入某个函数时，会有两种可能：该函数_窃取_这个对象的引用，或者不窃取。

_窃取引用_是指：当你把引用传给某个函数后，该函数会认定自己已经拥有了这个引用。由于新的拥有者可以自行决定何时调用 `Py_DECREF()`，你（调用方）在调用之后就不能再使用这个引用了。

很少有函数会窃取引用；两个重要的例外是 `PyList_SetItem()` 和 `PyTuple_SetItem()`，它们会窃取对条目的引用（但不是条目所在的元组或列表！）。这些函数被设计为会窃取引用是因为在使用新创建的对象来填充元组或列表时有一个通常的惯例；例如，创建元组 `(1, 2, "three")` 的代码看起来可以是这样的（暂时不要管错误处理；下面会显示更好的代码编写方式）:

```c
PyObject *t;

t = PyTuple_New(3);
PyTuple_SetItem(t, 0, PyLong_FromLong(1L));
PyTuple_SetItem(t, 1, PyLong_FromLong(2L));
PyTuple_SetItem(t, 2, PyUnicode_FromString("three"));
```

在这里，`PyLong_FromLong()` 返回了一个新的引用并且它立即被 `PyTuple_SetItem()` 所窃取。 当你想要继续使用一个对象而对它的引用将被窃取时，请在调用窃取引用的函数之前使用 `Py_INCREF()` 来抓取另一个引用。

顺便提一下，`PyTuple_SetItem()` 是设置元组条目的 _唯一_ 方式；`PySequence_SetItem()` 和 `PyObject_SetItem()` 会拒绝这样做因为元组是不可变数据类型。你应当只对你自己创建的元组使用 `PyTuple_SetItem()`。

等价于填充一个列表的代码可以使用 `PyList_New()` 和 `PyList_SetItem()` 来编写。

然而，在实践中，你很少会使用这些创建和填充元组或列表的方式。有一个通用的函数 `Py_BuildValue()` 可以根据 C 值来创建大多数常用对象，由一个 _格式字符串_ 来指明。例如，上面的两个代码块可以用下面的代码来代替（还会负责错误检测）:

```c
PyObject *tuple, *list;

tuple = Py_BuildValue("(iis)", 1, 2, "three");
list = Py_BuildValue("[iis]", 1, 2, "three");
```

在对条目使用 `PyObject_SetItem()` 等操作时更常见的做法是只借入引用，比如将参数传递给你正在编写的函数。在这种情况下，它们在引用方面的行为更为清晰，因为你不必为了把引用转走而获取一个新的引用（“让它被偷取”）。例如，这个函数将列表（实际上是任何可变序列）中的所有条目都设为给定的条目:

```c
int
set_all(PyObject *target, PyObject *item)
{
    Py_ssize_t i, n;

    n = PyObject_Length(target);
    if (n < 0)
        return -1;
    for (i = 0; i < n; i++) {
        PyObject *index = PyLong_FromSsize_t(i);
        if (!index)
            return -1;
        if (PyObject_SetItem(target, index, item) < 0) {
            Py_DECREF(index);
            return -1;
        }
        Py_DECREF(index);
    }
    return 0;
}
```

对于函数返回值的情况略有不同。虽然向大多数函数传递一个引用不会改变你对该引用的所有权责任，但许多返回一个引用的函数会给你该引用的所有权。原因很简单：在许多情况下，返回的对象是临时创建的，而你得到的引用是对该对象的唯一引用。因此，返回对象引用的通用函数，如 `PyObject_GetItem()` 和 `PySequence_GetItem()`，将总是返回一个新的引用（调用方将成为该引用的所有者）。

一个需要了解的重点在于你是否拥有一个由函数返回的引用只取决于你所调用的函数 --- _附带物_ (作为参数传给函数的对象的类型) _不会带来额外影响！_ 因此，如果你使用 `PyList_GetItem()` 从一个列表提取条目，你并不会拥有其引用 --- 但是如果你使用 `PySequence_GetItem()` (它恰好接受完全相同的参数) 从同一个列表获取同样的条目，你就会拥有一个对所返回对象的引用。

下面是说明你要如何编写一个函数来计算一个整数列表中条目的示例；一个是使用 `PyList_GetItem()`，而另一个是使用 `PySequence_GetItem()` 函数:

```c
long
sum_list(PyObject *list)
{
    Py_ssize_t i, n;
    long total = 0, value;
    PyObject *item;

    n = PyList_Size(list);
    if (n < 0)
        return -1; /* Not a list */
    for (i = 0; i < n; i++) {
        item = PyList_GetItem(list, i); /* 不能失败 */
        if (!PyLong_Check(item)) continue; /* 跳过非整数 */
        value = PyLong_AsLong(item);
        if (value == -1 && PyErr_Occurred())
            /* 太大的整数无法适应 C long 类型，放弃 */
            return -1;
        total += value;
    }
    return total;
}
```

```c
long
sum_sequence(PyObject *sequence)
{
    Py_ssize_t i, n;
    long total = 0, value;
    PyObject *item;
    n = PySequence_Length(sequence);
    if (n < 0)
        return -1; /* 没有长度 */
    for (i = 0; i < n; i++) {
        item = PySequence_GetItem(sequence, i);
        if (item == NULL)
            return -1; /* 不是序列，或其他错误 */
        if (PyLong_Check(item)) {
            value = PyLong_AsLong(item);
            Py_DECREF(item);
            if (value == -1 && PyErr_Occurred())
                /* 太大的整数无法适应 C long 类型，放弃 */
                return -1;
            total += value;
        }
        else {
            Py_DECREF(item); /* 丢弃引用所有权 */
        }
    }
    return total;
}
```

### 类型

在 Python/C API 中扮演重要角色的其他数据类型很少；大多为简单 C 类型如 int, long, double 和 char\* 等。有一些结构类型被用来描述静态表格以列出模块所导出的函数或新对象类型的数据属性，还有一个结构类型被用来描述复数的值。这些结构类型将与使用它们的函数放到一起讨论。

**type Py\_ssize\_t
**

_属于 稳定 ABI._

一个使得 `sizeof(Py_ssize_t) == sizeof(size_t)` 的有符号整数类型。C99 没有直接定义这样的东西（size\_t 是一个无符号整数类型）。请参阅 [**PEP 353**](https://peps.python.org/pep-0353/) 了解详情。`PY_SSIZE_T_MAX` 是 `Py_ssize_t` 类型的最大正数值。


## gc —— 垃圾回收器接口

* * *

此模块提供可选的垃圾回收器的接口，提供的功能包括：关闭收集器、调整收集频率、设置调试选项。它同时提供对回收器找到但是无法释放的不可达对象的访问。由于 Python 使用了带有引用计数的回收器，如果你确定你的程序不会产生循环引用，你可以关闭回收器。可以通过调用 `gc.disable()` 关闭自动垃圾回收。若要调试一个存在内存泄漏的程序，调用 `gc.set_debug(gc.DEBUG_LEAK)`；需要注意的是，它包含 `gc.DEBUG_SAVEALL`，使得被垃圾回收的对象会被存放在 gc.garbage 中以待检查。

`gc` 模块提供了下列函数：

**gc.enable()**

启用自动垃圾回收

**gc.disable()**

停用自动垃圾回收

**gc.isenabled()**

如果启用了自动回收则返回 `True`。

**gc.collect(_generation\=2_)**

不带参数时，将运行完全的回收。 可选的参数 _generation_ 是一个指定要回收哪一代 (从 0 到 2) 的整数值。 如果 generation 值无效则会引发 `ValueError`。 返回值为已回收对象和不可回收对象的总数。

每当运行完整收集或最高代 (2) 收集时，为多个内置类型所维护的空闲列表会被清空。由于特定类型特别是 `float` 的实现，在某些空闲列表中并非所有项都会被释放。

当解释器已经在执行收集任务时调用 `gc.collect()` 的效果是未定义的。

在 3.14 版本发生变更: `generation=1` 执行一次增量回收。

在 3.14.5 版本发生变更: `generation=1` 执行中间代的回收。

**gc.set\_debug(_flags_)**

设置垃圾回收器的调试标识位。调试信息会被写入 `sys.stderr` 。此文档末尾列出了各个标志位及其含义；可以使用位操作对多个标志位进行设置以控制调试。

**gc.get\_debug()**

返回当前调试标识位。

**gc.get\_objects(_generation\=None_)**

返回一个由垃圾回收器所跟踪的所有对象组成的列表，不包括已返回对象的列表。 如果 _generation_ 不为 `None`，则只返回垃圾回收器所跟踪的属于该 generation 的对象。

在 3.8 版本发生变更: 新的 _generation_ 形参。

在 3.14 版本发生变更: 第 1 代已被移除

在 3.14.5 版本发生变更: 世代 1 被重新引入以保持 3.13 的 GC 行为。

引发一个 审计事件 `gc.get_objects` 并附带参数 `generation`。

**gc.get\_stats()**

返回一个包含三个字典对象的列表，每个字典分别包含对应代的从解释器开始运行的垃圾回收统计数据。字典的键的数目在将来可能发生改变，目前每个字典包含以下内容：

-   `collections` 是该代被回收的次数；

-   `collected` 是该代中被回收的对象总数；

-   `uncollectable` 是在这一代中被发现无法收集的对象总数（因此被移动到 `garbage` 列表中）。


版本 3.4 中新增。

**gc.set\_threshold(_threshold0_\[, _threshold1_\[, _threshold2_\]\])**

设置垃圾回收阈值（收集频率）。将 _threshold0_ 设为零会禁用回收。

垃圾回收器把所有对象分类为三代，其依据是对象在多少次垃圾回收后幸存。 新建对象会被放在最年轻代（第 `0` 代）。 如果一个对象在一次垃圾回收后幸存，它会被移入下一个较老代。 由于第 `2` 代是最老代，这一代的对象在一次垃圾回收后仍会保留原样。 为了确定何时要运行，垃圾回收器会跟踪自上一次回收后对象分配和释放的数量。 当分配数量减去释放数量的结果值大于 _threshold0_ 时，垃圾回收就会开始。 初始时只有第 `0` 代会被检查。 如果自第 `1` 代被检查后第 `0` 代已被检查超过 _threshold1_ 次，则第 `1` 也会被检查。 对于第三代来说情况还会更复杂，请参阅 [Collecting the oldest generation](https://github.com/python/cpython/blob/ff0ef0a54bef26fc507fbf9b7a6009eb7d3f17f5/InternalDocs/garbage_collector.md#collecting-the-oldest-generation) 来了解详情。

在自由线程构建中，在运行回收器之前还会检查进程内存使用量的增加。如果自上次回收以来内存使用量没有增加 10%，并且对象分配的净数量没有超过 40 倍 _threshold0_，则不会运行回收。

请参阅 [垃圾回收器设计](https://github.com/python/cpython/blob/3.14/InternalDocs/garbage_collector.md) 了解详情。

在 3.14 版本发生变更: _threshold2_ 将被忽略

在 3.14.5 版本发生变更: _threshold2_ is restored to match Python 3.13 behavior.

**gc.get\_count()**

将当前回收计数以形为 `(count0, count1, count2)` 的元组返回。

**gc.get\_threshold()**

将当前回收阈值以形为 `(threshold0, threshold1, threshold2)` 的元组返回。

**gc.get\_referrers(_\*objs_)**

返回直接引用任意一个 _objs_ 的对象列表。这个函数只定位支持垃圾回收的容器；引用了其它对象但不支持垃圾回收的扩展类型不会被找到。

需要注意的是，已经解除对 _objs_ 引用的对象，但仍存在于循环引用中未被回收时，仍然会被作为引用者出现在返回的列表当中。若要获取当前正在引用 _objs_ 的对象，需要调用 `collect()` 然后再调用 `get_referrers()`。

警告

在使用 `get_referrers()` 返回的对象时必须要小心，因为其中一些对象可能仍在构造中因此处于暂时的无效状态。不要把 `get_referrers()` 用于调试以外的其它目的。

引发一个 审计事件 `gc.get_referrers` 并附带参数 `objs`。

**gc.get\_referents(_\*objs_)**

返回被任意一个参数中的对象直接引用的对象的列表。返回的被引用对象是被参数中的对象的 C 语言级别方法（若存在） `tp_traverse` 访问到的对象，可能不是所有的实际直接可达对象。只有支持垃圾回收的对象支持 `tp_traverse` 方法，并且此方法只会在需要访问涉及循环引用的对象时使用。因此，可以有以下例子：一个整数对其中一个参数是直接可达的，这个整数有可能出现或不出现在返回的结果列表当中。

引发一个 审计事件 `gc.get_referents` 并附带参数 `objs`。

**gc.is\_tracked(_obj_)**

当对象正在被垃圾回收器监控时返回 `True`，否则返回 `False` 。一般来说，原子类的实例不会被监控，而非原子类（如容器、用户自定义的对象）会被监控。然而，会有一些特定类型的优化以便减少垃圾回收器在简单实例（如只含有原子性的键和值的字典）上的消耗:

```python
>>> gc.is_tracked(0)
False
>>> gc.is_tracked("a")
False
>>> gc.is_tracked([])
True
>>> gc.is_tracked({})
False
>>> gc.is_tracked({"a": 1})
True
```

版本 3.1 中新增。

**gc.is\_finalized(_obj_)**

如果给定对象已被垃圾回收器终结则返回 `True`，否则返回 `False`。

```python
>>> x = None
>>> class Lazarus:
...     def __del__(self):
...         global x
...         x = self
...
>>> lazarus = Lazarus()
>>> gc.is_finalized(lazarus)
False
>>> del lazarus
>>> gc.is_finalized(x)
True
```

版本 3.9 中新增。

**gc.freeze()**

冻结由垃圾回收器追踪的所有对象；将它们移至永久代并在所有未来的回收操作中忽略它们。

如果一个进程将执行 `fork()` 而不执行 `exec()`，则在子进程中避免不必要的写入时拷贝将最大化内存共享并减少总体内存使用。 这需要同时在父进程的内存页中避免创建已释放的“空洞”并确保在子进程中的 GC 回收不会触及源自父进程的长寿对象的 `gc_refs` 计数器。 要同时达成这两个目标，请在父进程中尽早调用 `gc.disable()`，在 `fork()` 之前调用 `gc.freeze()`，并在子进程中尽早调用 `gc.enable()`。

版本 3.7 中新增。

**gc.unfreeze()**

解冻永久代中的对象，并将它们放回到年老代中。

版本 3.7 中新增。

**gc.get\_freeze\_count()**

返回永久代中的对象数量。

版本 3.7 中新增。

提供以下变量仅供只读访问（你可以修改但不应该重绑定它们）：

**gc.garbage**

一个回收器发现不可达而又无法被释放的对象（不可回收对象）列表。从 Python 3.4 开始，该列表在大多数时候都应该是空的，除非使用了含有非 `NULL` `tp_del` 空位的 C 扩展类型的实例。

如果设置了 `DEBUG_SAVEALL`，则所有不可访问对象将被添加至该列表而不会被释放。

在 3.2 版本发生变更: 当 interpreter shutdown 即解释器关闭时，若此列表非空，会产生 `ResourceWarning` ，默认情况下此警告是静默的。如果设置了 `DEBUG_UNCOLLECTABLE`，所有无法被回收的对象会被打印。

在 3.4 版本发生变更: 根据 [**PEP 442**](https://peps.python.org/pep-0442/)，具有 `__del__()` 方法的对象不会再出现在 `gc.garbage` 中。

**gc.callbacks**

在垃圾回收器开始前和完成后会被调用的一系列回调函数。这些回调函数在被调用时使用两个参数： _phase_ 和 _info_ 。

_phase_ 可为以下两值之一：

> "start": 垃圾回收即将开始。
>
> "stop": 垃圾回收已结束。

_info_ 是一个字典，提供了回调函数更多信息。已有定义的键有：

> "generation"（代）：正在被回收的最久远的一代。
>
> "collected"（已回收的）：当 _phase_ 为 "stop" 时，被成功回收的对象的数目。
>
> "uncollectable"（不可回收的）：当 _phase_ 为 "stop" 时，不能被回收并被放入 `garbage` 的对象的数目。

应用程序可以把自己的回调函数加入此列表。主要的使用场景有：

> 统计垃圾回收的数据，如：不同代的回收频率、回收所花费的时间。
>
> 使应用程序可以识别和清理自身在 `garbage` 中的不可回收类型的对象。

版本 3.3 中新增。

以下常量被用于 `set_debug()`：

**gc.DEBUG\_STATS**

在回收期间打印统计信息。在调整回收频率时，这些信息会比较有用。

**gc.DEBUG\_COLLECTABLE**

当发现可回收对象时打印信息。

**gc.DEBUG\_UNCOLLECTABLE**

打印找到的不可回收对象的信息（指不能被回收器回收的不可达对象）。这些对象会被添加到 `garbage` 列表中。

在 3.2 版本发生变更: 当 interpreter shutdown 时，即解释器关闭时，若 `garbage` 列表中存在对象，这些对象也会被打印输出。

**gc.DEBUG\_SAVEALL**

设置后，所有回收器找到的不可达对象会被添加进 _garbage_ 而不是直接被释放。这在调试一个内存泄漏的程序时会很有用。

**gc.DEBUG\_LEAK**

调试内存泄漏的程序时，使回收器打印信息的调试标识位。（等价于 `DEBUG_COLLECTABLE | DEBUG_UNCOLLECTABLE | DEBUG_SAVEALL`).

---

> **来源**：本文由 Python 官方文档三部分组成并完整翻译：① [引用计数](https://docs.python.org/zh-cn/3/c-api/refcounting.html)（C API 参考手册）；② [在 C API 中扩展和嵌入 Python —— 对象、类型和引用计数](https://docs.python.org/zh-cn/3/c-api/intro.html#objects-types-and-reference-counts) 一节；③ [gc —— 垃圾回收器接口](https://docs.python.org/zh-cn/3/library/gc.html)。作者 Python 软件基金会（PSF），许可 PSF 许可证第 2 版。抓取于 2026-09-13（Python 3.14 官方文档）。
