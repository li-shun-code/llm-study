---
title: 排序算法
source_url: https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/bubble_sort.md
author: krahets
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
order: 19
group: 查找、排序与数组技巧
---
## 评价排序算法的维度


<u>排序算法（sorting algorithm）</u>用于对一组数据按照特定顺序进行排列。排序算法有着广泛的应用，因为有序数据通常能够被更高效地查找、分析和处理。

如下图所示，排序算法中的数据类型可以是整数、浮点数、字符或字符串等。排序的判断规则可根据需求设定，如数字大小、字符 ASCII 码顺序或自定义规则。

![数据类型和判断规则示例](assets/csorting__sorting_algorithm__sorting_examples.png)

### 评价维度

**运行效率**：我们期望排序算法的时间复杂度尽量低，且总体操作数量较少（时间复杂度中的常数项变小）。对于大数据量的情况，运行效率显得尤为重要。

**就地性**：顾名思义，<u>原地排序</u>通过在原数组上直接操作实现排序，无须借助额外的辅助数组，从而节省内存。通常情况下，原地排序的数据搬运操作较少，运行速度也更快。

**稳定性**：<u>稳定排序</u>在完成排序后，相等元素在数组中的相对顺序不发生改变。

稳定排序是多级排序场景的必要条件。假设我们有一个存储学生信息的表格，第 1 列和第 2 列分别是姓名和年龄。在这种情况下，<u>非稳定排序</u>可能导致输入数据的有序性丧失：

```shell
# 输入数据是按照姓名排序好的
# (name, age)
  ('A', 19)
  ('B', 18)
  ('C', 21)
  ('D', 19)
  ('E', 23)

# 假设使用非稳定排序算法按年龄排序列表，
# 结果中 ('D', 19) 和 ('A', 19) 的相对位置改变，
# 输入数据按姓名排序的性质丢失
  ('B', 18)
  ('D', 19)
  ('A', 19)
  ('C', 21)
  ('E', 23)
```

**自适应性**：<u>自适应排序</u>能够利用输入数据已有的顺序信息来减少计算量，达到更优的时间效率。自适应排序算法的最佳时间复杂度通常优于平均时间复杂度。

**是否基于比较**：<u>基于比较的排序</u>依赖比较运算符（<、=、>）来判断元素的相对顺序，从而排序整个数组，其最坏时间复杂度的下界为 Ω(n log n) 。而<u>非比较排序</u>不使用比较运算符，时间复杂度可达 O(n) ，但其通用性相对较差。

### 理想排序算法

**运行快、原地、稳定、自适应、通用性好**。显然，迄今为止尚未发现兼具以上所有特性的排序算法。因此，在选择排序算法时，需要根据具体的数据特点和问题需求来决定。

接下来，我们将共同学习各种排序算法，并基于上述评价维度对各个排序算法的优缺点进行分析。

## 冒泡排序


<u>冒泡排序（bubble sort）</u>通过连续地比较与交换相邻元素实现排序。这个过程就像气泡从底部升到顶部一样，因此得名冒泡排序。

如下图所示，冒泡过程可以利用元素交换操作来模拟：从数组最左端开始向右遍历，依次比较相邻元素大小，如果“左元素 > 右元素”就交换二者。遍历完成后，最大的元素会被移动到数组的最右端。

### 算法流程

设数组的长度为 n ，冒泡排序的步骤如下图所示。

1. 首先，对 n 个元素执行“冒泡”，**将数组的最大元素交换至正确位置**。
2. 接下来，对剩余 n - 1 个元素执行“冒泡”，**将第二大元素交换至正确位置**。
3. 以此类推，经过 n - 1 轮“冒泡”后，**前 n - 1 大的元素都被交换至正确位置**。
4. 仅剩的一个元素必定是最小元素，无须排序，因此数组排序完成。

![冒泡排序流程](assets/csorting__bubble_sort__bubble_sort_overview.png)

示例代码如下：

```python
def bubble_sort(nums: list[int]):
    """冒泡排序"""
    n = len(nums)
    # 外循环：未排序区间为 [0, i]
    for i in range(n - 1, 0, -1):
        # 内循环：将未排序区间 [0, i] 中的最大元素交换至该区间的最右端
        for j in range(i):
            if nums[j] > nums[j + 1]:
                # 交换 nums[j] 与 nums[j + 1]
                nums[j], nums[j + 1] = nums[j + 1], nums[j]
```


### 效率优化

我们发现，如果某轮“冒泡”中没有执行任何交换操作，说明数组已经完成排序，可直接返回结果。因此，可以增加一个标志位 `flag` 来监测这种情况，一旦出现就立即返回。

经过优化，冒泡排序的最差时间复杂度和平均时间复杂度仍为 O(n²) ；但当输入数组完全有序时，可达到最佳时间复杂度 O(n) 。

```python
def bubble_sort_with_flag(nums: list[int]):
    """冒泡排序（标志优化）"""
    n = len(nums)
    # 外循环：未排序区间为 [0, i]
    for i in range(n - 1, 0, -1):
        flag = False  # 初始化标志位
        # 内循环：将未排序区间 [0, i] 中的最大元素交换至该区间的最右端
        for j in range(i):
            if nums[j] > nums[j + 1]:
                # 交换 nums[j] 与 nums[j + 1]
                nums[j], nums[j + 1] = nums[j + 1], nums[j]
                flag = True  # 记录交换元素
        if not flag:
            break  # 此轮“冒泡”未交换任何元素，直接跳出
```


### 算法特性

- **时间复杂度为 O(n²)、自适应排序**：各轮“冒泡”遍历的数组长度依次为 n - 1、n - 2、…、2、1 ，总和为 (n - 1) n / 2 。在引入 `flag` 优化后，最佳时间复杂度可达到 O(n) 。
- **空间复杂度为 O(1)、原地排序**：指针 i 和 j 使用常数大小的额外空间。
- **稳定排序**：由于在“冒泡”中遇到相等元素不交换。

## 插入排序


<u>插入排序（insertion sort）</u>是一种简单的排序算法，它的工作原理与手动整理一副牌的过程非常相似。

具体来说，我们在未排序区间选择一个基准元素，将该元素与其左侧已排序区间的元素逐一比较大小，并将该元素插入到正确的位置。

下图展示了数组插入元素的操作流程。设基准元素为 `base` ，我们需要将从目标索引到 `base` 之间的所有元素向右移动一位，然后将 `base` 赋值给目标索引。

![单次插入操作](assets/csorting__insertion_sort__insertion_operation.png)

### 算法流程

插入排序的整体流程如下图所示。

1. 初始状态下，数组的第 1 个元素已完成排序。
2. 选取数组的第 2 个元素作为 `base` ，将其插入到正确位置后，**数组的前 2 个元素已排序**。
3. 选取第 3 个元素作为 `base` ，将其插入到正确位置后，**数组的前 3 个元素已排序**。
4. 以此类推，在最后一轮中，选取最后一个元素作为 `base` ，将其插入到正确位置后，**所有元素均已排序**。

![插入排序流程](assets/csorting__insertion_sort__insertion_sort_overview.png)

示例代码如下：

```python
def insertion_sort(nums: list[int]):
    """插入排序"""
    # 外循环：已排序区间为 [0, i-1]
    for i in range(1, len(nums)):
        base = nums[i]
        j = i - 1
        # 内循环：将 base 插入到已排序区间 [0, i-1] 中的正确位置
        while j >= 0 and nums[j] > base:
            nums[j + 1] = nums[j]  # 将 nums[j] 向右移动一位
            j -= 1
        nums[j + 1] = base  # 将 base 赋值到正确位置
```


### 算法特性

- **时间复杂度为 O(n²)、自适应排序**：在最差情况下，每次插入操作分别需要循环 n - 1、n-2、…、2、1 次，求和得到 (n - 1) n / 2 ，因此时间复杂度为 O(n²) 。在遇到有序数据时，插入操作会提前终止。当输入数组完全有序时，插入排序达到最佳时间复杂度 O(n) 。
- **空间复杂度为 O(1)、原地排序**：指针 i 和 j 使用常数大小的额外空间。
- **稳定排序**：在插入操作过程中，我们会将元素插入到相等元素的右侧，不会改变它们的顺序。

### 插入排序的优势

插入排序的时间复杂度为 O(n²) ，而我们即将学习的快速排序的时间复杂度为 O(n log n) 。尽管插入排序的时间复杂度更高，**但在数据量较小的情况下，插入排序通常更快**。

这个结论与线性查找和二分查找的适用情况的结论类似。快速排序这类 O(n log n) 的算法属于基于分治策略的排序算法，往往包含更多单元计算操作。而在数据量较小时，n² 和 n log n 的数值比较接近，复杂度不占主导地位，每轮中的单元操作数量起到决定性作用。

实际上，许多编程语言（例如 Java）的内置排序函数采用了插入排序，大致思路为：对于长数组，采用基于分治策略的排序算法，例如快速排序；对于短数组，直接使用插入排序。

虽然冒泡排序、选择排序和插入排序的时间复杂度都为 O(n²) ，但在实际情况中，**插入排序的使用频率显著高于冒泡排序和选择排序**，主要有以下原因。

- 冒泡排序基于元素交换实现，需要借助一个临时变量，共涉及 3 个单元操作；插入排序基于元素赋值实现，仅需 1 个单元操作。因此，**冒泡排序的计算开销通常比插入排序更高**。
- 选择排序在任何情况下的时间复杂度都为 O(n²) 。**如果给定一组部分有序的数据，插入排序通常比选择排序效率更高**。
- 选择排序不稳定，无法应用于多级排序。

## 选择排序


<u>选择排序（selection sort）</u>的工作原理非常简单：开启一个循环，每轮从未排序区间选择最小的元素，将其放到已排序区间的末尾。

设数组的长度为 n ，选择排序的算法流程如下图所示。

1. 初始状态下，所有元素未排序，即未排序（索引）区间为 [0, n-1] 。
2. 选取区间 [0, n-1] 中的最小元素，将其与索引 0 处的元素交换。完成后，数组前 1 个元素已排序。
3. 选取区间 [1, n-1] 中的最小元素，将其与索引 1 处的元素交换。完成后，数组前 2 个元素已排序。
4. 以此类推。经过 n - 1 轮选择与交换后，数组前 n - 1 个元素已排序。
5. 仅剩的一个元素必定是最大元素，无须排序，因此数组排序完成。

在代码中，我们用 k 来记录未排序区间内的最小元素：

```python
def selection_sort(nums: list[int]):
    """选择排序"""
    n = len(nums)
    # 外循环：未排序区间为 [i, n-1]
    for i in range(n - 1):
        # 内循环：找到未排序区间内的最小元素
        k = i
        for j in range(i + 1, n):
            if nums[j] < nums[k]:
                k = j  # 记录最小元素的索引
        # 将该最小元素与未排序区间的首个元素交换
        nums[i], nums[k] = nums[k], nums[i]
```


### 算法特性

- **时间复杂度为 O(n²)、非自适应排序**：外循环共 n - 1 轮，第一轮内循环执行 n - 1 次，最后一轮执行 1 次，即各轮内循环分别执行 n - 1、n - 2、…、2、1 次，求和为 n(n - 1) / 2 。
- **空间复杂度为 O(1)、原地排序**：指针 i 和 j 使用常数大小的额外空间。
- **非稳定排序**：如下图所示，元素 `nums[i]` 有可能被交换至与其相等的元素的右边，导致两者的相对顺序发生改变。

![选择排序非稳定示例](assets/csorting__selection_sort__selection_sort_instability.png)

## 快速排序


<u>快速排序（quick sort）</u>是一种基于分治策略的排序算法，运行高效，应用广泛。

快速排序的核心操作是“哨兵划分”，其目标是：选择数组中的某个元素作为“基准数”，将所有小于基准数的元素移到其左侧，而大于基准数的元素移到其右侧。具体来说，哨兵划分的流程如下图所示。

1. 选取数组最左端元素作为基准数，初始化两个指针 `i` 和 `j` 分别指向数组的两端。
2. 设置一个循环，在每轮中使用 `i`（`j`）分别寻找第一个比基准数大（小）的元素，然后交换这两个元素。
3. 循环执行步骤 `2.` ，直到 `i` 和 `j` 相遇时停止，最后将基准数交换至两个子数组的分界线。

哨兵划分完成后，原数组被划分成三部分：左子数组、基准数、右子数组，且满足“左子数组任意元素 ≤ 基准数 ≤ 右子数组任意元素”。因此，我们接下来只需对这两个子数组进行排序。

> 以下代码块均为 `QuickSort` 类的方法。该类不保存状态，只作为命名空间：方法通过参数接收待排序数组 `nums` 与左右边界索引，调用入口是 `QuickSort().quick_sort(nums, 0, len(nums) - 1)` 。

```python
    def partition(self, nums: list[int], left: int, right: int) -> int:
        """哨兵划分"""
        # 以 nums[left] 为基准数
        i, j = left, right
        while i < j:
            while i < j and nums[j] >= nums[left]:
                j -= 1  # 从右向左找首个小于基准数的元素
            while i < j and nums[i] <= nums[left]:
                i += 1  # 从左向右找首个大于基准数的元素
            # 元素交换
            nums[i], nums[j] = nums[j], nums[i]
        # 将基准数交换至两子数组的分界线
        nums[i], nums[left] = nums[left], nums[i]
        return i  # 返回基准数的索引

    def quick_sort(self, nums: list[int], left: int, right: int):
        """快速排序"""
        # 子数组长度为 1 时终止递归
        if left >= right:
            return
        # 哨兵划分
        pivot = self.partition(nums, left, right)
        # 递归左子数组、右子数组
        self.quick_sort(nums, left, pivot - 1)
        self.quick_sort(nums, pivot + 1, right)
```

> **【快速排序的分治策略】**
> 哨兵划分的实质是将一个较长数组的排序问题简化为两个较短数组的排序问题。


### 算法流程

快速排序的整体流程如下图所示。

1. 首先，对原数组执行一次“哨兵划分”，得到未排序的左子数组和右子数组。
2. 然后，对左子数组和右子数组分别递归执行“哨兵划分”。
3. 持续递归，直至子数组长度为 1 时终止，从而完成整个数组的排序。

![快速排序流程](assets/csorting__quick_sort__quick_sort_overview.png)

```python
    def quick_sort(self, nums: list[int], left: int, right: int):
        """快速排序"""
        # 子数组长度为 1 时终止递归
        if left >= right:
            return
        # 哨兵划分
        pivot = self.partition(nums, left, right)
        # 递归左子数组、右子数组
        self.quick_sort(nums, left, pivot - 1)
        self.quick_sort(nums, pivot + 1, right)
```


### 算法特性

- **时间复杂度为 O(n log n)、非自适应排序**：在平均情况下，哨兵划分的递归层数为 log n ，每层中的总循环数为 n ，总体使用 O(n log n) 时间。在最差情况下，每轮哨兵划分操作都将长度为 n 的数组划分为长度为 0 和 n - 1 的两个子数组，此时递归层数达到 n ，每层中的循环数为 n ，总体使用 O(n²) 时间。
- **空间复杂度为 O(n)、原地排序**：在输入数组完全倒序的情况下，达到最差递归深度 n ，使用 O(n) 栈帧空间。排序操作是在原数组上进行的，未借助额外数组。
- **非稳定排序**：在哨兵划分的最后一步，基准数可能会被交换至相等元素的右侧。

### 快速排序为什么快

从名称上就能看出，快速排序在效率方面应该具有一定的优势。尽管快速排序的平均时间复杂度与“归并排序”和“堆排序”相同，但通常快速排序的效率更高，主要有以下原因。

- **出现最差情况的概率很低**：虽然快速排序的最差时间复杂度为 O(n²) ，没有归并排序稳定，但在绝大多数情况下，快速排序能在 O(n log n) 的时间复杂度下运行。
- **缓存使用效率高**：在执行哨兵划分操作时，系统可将整个子数组加载到缓存，因此访问元素的效率较高。而像“堆排序”这类算法需要跳跃式访问元素，从而缺乏这一特性。
- **复杂度的常数系数小**：在上述三种算法中，快速排序的比较、赋值、交换等操作的总数量最少。这与“插入排序”比“冒泡排序”更快的原因类似。

### 基准数优化

> 本小节代码属于 `QuickSortMedian` 类，与 `QuickSort` 的差别仅在于基准数的选取。

**快速排序在某些输入下的时间效率可能降低**。举一个极端例子，假设输入数组是完全倒序的，由于我们选择最左端元素作为基准数，那么在哨兵划分完成后，基准数被交换至数组最右端，导致左子数组长度为 n - 1、右子数组长度为 0 。如此递归下去，每轮哨兵划分后都有一个子数组的长度为 0 ，分治策略失效，快速排序退化为“冒泡排序”的近似形式。

为了尽量避免这种情况发生，**我们可以优化哨兵划分中的基准数的选取策略**。例如，我们可以随机选取一个元素作为基准数。然而，如果运气不佳，每次都选到不理想的基准数，效率仍然不尽如人意。

需要注意的是，编程语言通常生成的是“伪随机数”。如果我们针对伪随机数序列构建一个特定的测试样例，那么快速排序的效率仍然可能劣化。

为了进一步改进，我们可以在数组中选取三个候选元素（通常为数组的首、尾、中点元素），**并将这三个候选元素的中位数作为基准数**。这样一来，基准数“既不太小也不太大”的概率将大幅提升。当然，我们还可以选取更多候选元素，以进一步提高算法的稳健性。采用这种方法后，时间复杂度劣化至 O(n²) 的概率大大降低。

示例代码如下：

```python
    def partition(self, nums: list[int], left: int, right: int) -> int:
        """哨兵划分（三数取中值）"""
        # 以 nums[left] 为基准数
        med = self.median_three(nums, left, (left + right) // 2, right)
        # 将中位数交换至数组最左端
        nums[left], nums[med] = nums[med], nums[left]
        # 以 nums[left] 为基准数
        i, j = left, right
        while i < j:
            while i < j and nums[j] >= nums[left]:
                j -= 1  # 从右向左找首个小于基准数的元素
            while i < j and nums[i] <= nums[left]:
                i += 1  # 从左向右找首个大于基准数的元素
            # 元素交换
            nums[i], nums[j] = nums[j], nums[i]
        # 将基准数交换至两子数组的分界线
        nums[i], nums[left] = nums[left], nums[i]
        return i  # 返回基准数的索引

    def quick_sort(self, nums: list[int], left: int, right: int):
        """快速排序"""
        # 子数组长度为 1 时终止递归
        if left >= right:
            return
        # 哨兵划分
        pivot = self.partition(nums, left, right)
        # 递归左子数组、右子数组
        self.quick_sort(nums, left, pivot - 1)
        self.quick_sort(nums, pivot + 1, right)
```


### 递归深度优化

> 本小节代码属于 `QuickSortTailCall` 类，通过“尾递归优化”把一层递归改写为循环。

**在某些输入下，快速排序可能占用空间较多**。以完全有序的输入数组为例，设递归中的子数组长度为 m ，每轮哨兵划分操作都将产生长度为 0 的左子数组和长度为 m - 1 的右子数组，这意味着每一层递归调用减少的问题规模非常小（只减少一个元素），递归树的高度会达到 n - 1 ，此时需要占用 O(n) 大小的栈帧空间。

为了防止栈帧空间的累积，我们可以在每轮哨兵排序完成后，比较两个子数组的长度，**仅对较短的子数组进行递归**。由于较短子数组的长度不会超过 n / 2 ，因此这种方法能确保递归深度不超过 log n ，从而将最差空间复杂度优化至 O(log n) 。代码如下所示：

```python
    def quick_sort(self, nums: list[int], left: int, right: int):
        """快速排序（递归深度优化）"""
        # 子数组长度为 1 时终止
        while left < right:
            # 哨兵划分操作
            pivot = self.partition(nums, left, right)
            # 对两个子数组中较短的那个执行快速排序
            if pivot - left < right - pivot:
                self.quick_sort(nums, left, pivot - 1)  # 递归排序左子数组
                left = pivot + 1  # 剩余未排序区间为 [pivot + 1, right]
            else:
                self.quick_sort(nums, pivot + 1, right)  # 递归排序右子数组
                right = pivot - 1  # 剩余未排序区间为 [left, pivot - 1]
```

## 归并排序


<u>归并排序（merge sort）</u>是一种基于分治策略的排序算法，包含下图所示的“划分”和“合并”阶段。

1. **划分阶段**：通过递归不断地将数组从中点处分开，将长数组的排序问题转换为短数组的排序问题。
2. **合并阶段**：当子数组长度为 1 时终止划分，开始合并，持续地将左右两个较短的有序数组合并为一个较长的有序数组，直至结束。

![归并排序的划分与合并阶段](assets/csorting__merge_sort__merge_sort_overview.png)

### 算法流程

如下图所示，“划分阶段”从顶至底递归地将数组从中点切分为两个子数组。

1. 计算数组中点 `mid` ，递归划分左子数组（区间 `[left, mid]` ）和右子数组（区间 `[mid + 1, right]` ）。
2. 递归执行步骤 `1.` ，直至子数组区间长度为 1 时终止。

“合并阶段”从底至顶地将左子数组和右子数组合并为一个有序数组。需要注意的是，从长度为 1 的子数组开始合并，合并阶段中的每个子数组都是有序的。

观察发现，归并排序与二叉树后序遍历的递归顺序是一致的。

- **后序遍历**：先递归左子树，再递归右子树，最后处理根节点。
- **归并排序**：先递归左子数组，再递归右子数组，最后处理合并。

归并排序的实现如以下代码所示。请注意，`nums` 的待合并区间为 `[left, right]` ，而 `tmp` 的对应区间为 `[0, right - left]` 。

```python
def merge(nums: list[int], left: int, mid: int, right: int):
    """合并左子数组和右子数组"""
    # 左子数组区间为 [left, mid], 右子数组区间为 [mid+1, right]
    # 创建一个临时数组 tmp ，用于存放合并后的结果
    tmp = [0] * (right - left + 1)
    # 初始化左子数组和右子数组的起始索引
    i, j, k = left, mid + 1, 0
    # 当左右子数组都还有元素时，进行比较并将较小的元素复制到临时数组中
    while i <= mid and j <= right:
        if nums[i] <= nums[j]:
            tmp[k] = nums[i]
            i += 1
        else:
            tmp[k] = nums[j]
            j += 1
        k += 1
    # 将左子数组和右子数组的剩余元素复制到临时数组中
    while i <= mid:
        tmp[k] = nums[i]
        i += 1
        k += 1
    while j <= right:
        tmp[k] = nums[j]
        j += 1
        k += 1
    # 将临时数组 tmp 中的元素复制回原数组 nums 的对应区间
    for k in range(0, len(tmp)):
        nums[left + k] = tmp[k]




def merge_sort(nums: list[int], left: int, right: int):
    """归并排序"""
    # 终止条件
    if left >= right:
        return  # 当子数组长度为 1 时终止递归
    # 划分阶段
    mid = (left + right) // 2 # 计算中点
    merge_sort(nums, left, mid)  # 递归左子数组
    merge_sort(nums, mid + 1, right)  # 递归右子数组
    # 合并阶段
    merge(nums, left, mid, right)
```


### 算法特性

- **时间复杂度为 O(n log n)、非自适应排序**：划分产生高度为 log n 的递归树，每层合并的总操作数量为 n ，因此总体时间复杂度为 O(n log n) 。
- **空间复杂度为 O(n)、非原地排序**：递归深度为 log n ，使用 O(log n) 大小的栈帧空间。合并操作需要借助辅助数组实现，使用 O(n) 大小的额外空间。
- **稳定排序**：在合并过程中，相等元素的次序保持不变。

### 链表排序

对于链表，归并排序相较于其他排序算法具有显著优势，**可以将链表排序任务的空间复杂度优化至 O(1)** 。

- **划分阶段**：可以使用“迭代”替代“递归”来实现链表划分工作，从而省去递归使用的栈帧空间。
- **合并阶段**：在链表中，节点增删操作仅需改变引用（指针）即可实现，因此合并阶段（将两个短有序链表合并为一个长有序链表）无须创建额外链表。

具体实现细节比较复杂，有兴趣的读者可以查阅相关资料进行学习。

## 堆排序

<u>堆排序（heap sort）</u>是一种基于堆数据结构实现的高效排序算法。我们可以利用《堆》中讲过的“建堆操作”和“元素出堆操作”实现堆排序：先输入数组并建堆，再不断执行出堆操作，依次记录出堆元素即可得到有序序列。

但上述做法需要额外数组来保存弹出的元素，比较浪费空间。实际中通常使用一种更优雅的实现方式。设数组长度为 n ，流程如下。

1. 输入数组并建立大顶堆。完成后，最大元素位于堆顶。
2. 将堆顶元素（第一个元素）与堆底元素（最后一个元素）交换。完成交换后，堆的长度减 1 ，已排序元素数量加 1 。
3. 从堆顶元素开始，从顶至底执行堆化操作（sift down）。完成堆化后，堆的性质得到修复。
4. 循环执行步骤 `2.` 和 `3.` 。循环 n - 1 轮后，即可完成数组排序。

实际上，“元素出堆操作”就包含步骤 `2.` 和 `3.` ，只是多了一个弹出元素的步骤。代码实现复用了《堆》中的从顶至底堆化函数，只是需要额外传入一个长度参数 n ，用于指定堆当前的有效长度（堆的长度会随着提取最大元素而减小）：

```python
def sift_down(nums: list[int], n: int, i: int):
    """堆的长度为 n ，从节点 i 开始，从顶至底堆化"""
    while True:
        # 判断节点 i, l, r 中值最大的节点，记为 ma
        l = 2 * i + 1
        r = 2 * i + 2
        ma = i
        if l < n and nums[l] > nums[ma]:
            ma = l
        if r < n and nums[r] > nums[ma]:
            ma = r
        # 若节点 i 最大或索引 l, r 越界，则无须继续堆化，跳出
        if ma == i:
            break
        # 交换两节点
        nums[i], nums[ma] = nums[ma], nums[i]
        # 循环向下堆化
        i = ma


def heap_sort(nums: list[int]):
    """堆排序"""
    # 建堆操作：堆化除叶节点以外的其他所有节点
    for i in range(len(nums) // 2 - 1, -1, -1):
        sift_down(nums, len(nums), i)
    # 从堆中提取最大元素，循环 n-1 轮
    for i in range(len(nums) - 1, 0, -1):
        # 交换根节点与最右叶节点（交换首元素与尾元素）
        nums[0], nums[i] = nums[i], nums[0]
        # 以根节点为起点，从顶至底进行堆化
        sift_down(nums, i, 0)
```

算法特性如下。

- **时间复杂度为 O(n log n)、非自适应排序**：建堆操作使用 O(n) 时间；从堆中提取最大元素的时间复杂度为 O(log n) ，共循环 n - 1 轮。
- **空间复杂度为 O(1)、原地排序**：几个指针变量使用 O(1) 空间，元素交换和堆化都在原数组上进行。
- **非稳定排序**：交换堆顶元素和堆底元素时，相等元素的相对位置可能发生变化。

值得一提的是，Python 标准库并没有提供“原地堆排序”，但 `heapq` 模块的 `heapreplace()` 与手动建堆可以组合出同样效果的实现；工程上更常见的做法是直接用 `list.sort()`（Timsort），把堆排序留给“需要边排序边取极值”的流式场景。

## 计数排序

前述几种排序算法都属于“基于比较的排序算法”，它们通过比较元素大小来实现排序，最坏情况的时间下界为 Ω(n log n) 。接下来介绍的计数、桶、基数排序属于“非比较排序算法”，时间复杂度可以达到线性阶。

<u>计数排序（counting sort）</u>通过统计元素数量来实现排序，通常应用于整数数组。先来看一个简单的例子。给定长度为 n 的数组 `nums` ，其中元素都是“非负整数”，流程如下。

1. 遍历数组找出最大数字，记为 m ，然后创建长度为 m + 1 的辅助数组 `counter` 。
2. **借助 `counter` 统计各数字的出现次数**，其中 `counter[num]` 对应数字 `num` 的出现次数。
3. **由于 `counter` 的各索引天然有序，相当于所有数字已经排好**。遍历 `counter` ，根据出现次数从小到大填入 `nums` 。

![计数排序流程](assets/csorting__counting_sort__counting_sort_overview.png)

```python
def counting_sort_naive(nums: list[int]):
    """计数排序（简单实现）"""
    # 简单实现，无法用于排序对象
    # 1. 统计数组最大元素 m
    m = max(nums)
    # 2. 统计各数字的出现次数
    # counter[num] 代表 num 的出现次数
    counter = [0] * (m + 1)
    for num in nums:
        counter[num] += 1
    # 3. 遍历 counter ，将各元素填入原数组 nums
    i = 0
    for num in range(m + 1):
        for _ in range(counter[num]):
            nums[i] = num
            i += 1
```

> **计数排序与桶排序的联系**：从桶排序的角度看，可以把计数数组 `counter` 的每个索引视为一个桶，把统计数量的过程看作将各元素分配到对应的桶中。本质上，计数排序是桶排序在整型数据下的特例。

如果输入数据是对象（例如按价格排序的商品列表），上面的步骤 `3.` 就失效了，因为它只能给出价格的排序结果。解决办法是先计算 `counter` 的“前缀和”。索引 i 处的前缀和 `prefix[i]` 等于数组前 i 个元素之和：

**prefix[i] = counter[0] + counter[1] + … + counter[i]**

**前缀和具有明确的意义：`prefix[num] - 1` 代表元素 `num` 在结果数组 `res` 中最后一次出现的索引**。接下来倒序遍历 `nums` 的每个元素 `num` ，每轮执行两步：把 `num` 填入 `res` 的索引 `prefix[num] - 1` 处；令 `prefix[num]` 减 1 ，得到下次放置 `num` 的索引。遍历完成后 `res` 就是排好序的结果，最后覆盖 `nums` 。

```python
def counting_sort(nums: list[int]):
    """计数排序（完整实现，可排序对象，稳定）"""
    # 1. 统计数组最大元素 m
    m = max(nums)
    # 2. 统计各数字的出现次数
    counter = [0] * (m + 1)
    for num in nums:
        counter[num] += 1
    # 3. 求 counter 的前缀和，将“出现次数”转换为“尾索引”
    # 即 counter[num]-1 是 num 在 res 中最后一次出现的索引
    for i in range(m):
        counter[i + 1] += counter[i]
    # 4. 倒序遍历 nums ，将各元素填入结果数组 res
    n = len(nums)
    res = [0] * n
    for i in range(n - 1, -1, -1):
        num = nums[i]
        res[counter[num] - 1] = num  # 将 num 放置到对应索引处
        counter[num] -= 1  # 令前缀和自减 1 ，得到下次放置 num 的索引
    # 使用结果数组 res 覆盖原数组 nums
    for i in range(n):
        nums[i] = res[i]
```

算法特性与局限性如下。

- **时间复杂度为 O(n + m)、非自适应排序**：遍历 `nums` 与遍历 `counter` 都是线性时间。一般 n ≫ m ，时间复杂度趋于 O(n) 。
- **空间复杂度为 O(n + m)、非原地排序**：借助了长度分别为 n 和 m 的数组 `res` 和 `counter` 。
- **稳定排序**：向 `res` 填充元素的顺序是“从右向左”，倒序遍历 `nums` 避免了改变相等元素的相对位置。正序遍历结果虽正确但不稳定。
- **只适用于非负整数，且要求数据范围有限**。含负数时可先统一加上一个常数变为正数，排完再减回去；当 n ≪ m 时，O(m) 可能比 O(n log n) 更慢。

## 桶排序

<u>桶排序（bucket sort）</u>是分治策略的典型应用：设置一些具有大小顺序的桶，每个桶对应一个数据范围，把数据平均分配到各桶；然后分别对每个桶内部排序；最终按桶的顺序合并所有数据。

考虑长度为 n 的数组，元素是范围 [0, 1) 内的浮点数，流程如下图所示。

1. 初始化 k 个桶，将 n 个元素分配到 k 个桶中。
2. 对每个桶分别执行排序（这里采用编程语言的内置排序函数）。
3. 按照桶从小到大的顺序合并结果。

![桶排序算法流程](assets/csorting__bucket_sort__bucket_sort_overview.png)

```python
def bucket_sort(nums: list[float]):
    """桶排序"""
    # 初始化 k = n/2 个桶，预期向每个桶分配 2 个元素
    k = len(nums) // 2
    buckets = [[] for _ in range(k)]
    # 1. 将数组元素分配到各个桶中
    for num in nums:
        # 输入数据范围为 [0, 1)，使用 num * k 映射到索引范围 [0, k-1]
        i = int(num * k)
        buckets[i].append(num)
    # 2. 对各个桶执行排序
    for bucket in buckets:
        # 使用内置排序函数，也可以替换成其他排序算法
        bucket.sort()
    # 3. 遍历桶合并结果
    i = 0
    for bucket in buckets:
        for num in bucket:
            nums[i] = num
            i += 1
```

桶排序适用于处理体量很大的数据。例如输入 100 万个元素，内存无法一次性加载，可把数据分成 1000 个桶，分别排序后合并。

- **时间复杂度为 O(n + k)** ：假设元素在各桶平均分布，每桶 n / k 个元素，排序单个桶使用 O((n/k) log(n/k)) 时间，所有桶合计 O(n log(n/k)) ，**当桶数量 k 较大时趋于 O(n)** ；合并结果需要遍历所有桶和元素，花费 O(n + k) 。最差情况下所有数据落入同一个桶，排序该桶使用 O(n²) 时间。
- **空间复杂度为 O(n + k)、非原地排序**：需要 k 个桶和总共 n 个元素的额外空间。
- 桶排序是否稳定取决于桶内排序算法是否稳定。

**关键在于把元素均匀分配到各桶**，而实际数据往往不均匀。例如想把电商商品按价格平均分到 10 个桶，但低价商品极多、高价商品极少，平均切分价格区间会让各桶数量差距悬殊。可行的做法是先设一条大致分界线把数据粗略分到 3 个桶，**再把商品较多的桶继续划分为 3 个桶，直至各桶元素数量大致相等**，本质上是一棵让叶节点尽量平均的递归树。

![递归划分桶](assets/csorting__bucket_sort__scatter_in_buckets_recursively.png)

如果事先知道数据的概率分布，则可以直接按分布设定分桶边界。例如假设商品价格服从正态分布，就能合理地设定区间，把商品平均分配到各桶。

![根据概率分布划分桶](assets/csorting__bucket_sort__scatter_in_buckets_distribution.png)

## 基数排序

计数排序适用于 n 较大但数据范围 m 较小的情况。假设要对 n = 10⁶ 个 8 位学号排序，数据范围 m = 10⁸ 非常大，计数排序需要分配海量空间，而基数排序可以避免这个问题。

<u>基数排序（radix sort）</u>的核心思想与计数排序一致，也通过统计个数实现排序；在此基础上，它利用数字各位之间的递进关系，依次对每一位排序，从而得到最终结果。以学号为例，设最低位是第 1 位、最高位是第 8 位，流程如下。

1. 初始化位数 k = 1 。
2. 对学号的第 k 位执行“计数排序”，完成后数据会根据第 k 位从小到大排序。
3. 将 k 增加 1 ，返回步骤 `2.` 继续迭代，直到所有位都排序完成。

![基数排序算法流程](assets/csorting__radix_sort__radix_sort_overview.png)

对于 d 进制数字 x ，要获取其第 k 位 x_k ，可以使用公式 **x_k = ⌊x / d^(k-1)⌋ mod d** ，其中 ⌊·⌋ 表示向下取整，mod 表示取余。对学号数据而言 d = 10 且 k ∈ [1, 8] 。据此改动计数排序，使其按第 k 位排序：

```python
def digit(num: int, exp: int) -> int:
    """获取元素 num 的第 k 位，其中 exp = 10^(k-1)"""
    # 传入 exp 而非 k 可以避免在此重复执行昂贵的次方计算
    return (num // exp) % 10


def counting_sort_digit(nums: list[int], exp: int):
    """计数排序（根据 nums 第 k 位排序）"""
    # 十进制的位范围为 0~9 ，因此需要长度为 10 的桶数组
    counter = [0] * 10
    n = len(nums)
    # 统计 0~9 各数字的出现次数
    for i in range(n):
        d = digit(nums[i], exp)  # 获取 nums[i] 第 k 位，记为 d
        counter[d] += 1
    # 求前缀和，将“出现个数”转换为“数组索引”
    for i in range(1, 10):
        counter[i] += counter[i - 1]
    # 倒序遍历，根据桶内统计结果，将各元素填入 res
    res = [0] * n
    for i in range(n - 1, -1, -1):
        d = digit(nums[i], exp)
        j = counter[d] - 1  # 获取 d 在数组中的索引 j
        res[j] = nums[i]
        counter[d] -= 1
    for i in range(n):
        nums[i] = res[i]


def radix_sort(nums: list[int]):
    """基数排序"""
    # 获取数组的最大元素，用于判断最大位数
    m = max(nums)
    # 按照从低位到高位的顺序遍历
    exp = 1
    while exp <= m:
        # 对数组元素的第 k 位执行计数排序
        # k = 1 -> exp = 1；k = 2 -> exp = 10，即 exp = 10^(k-1)
        counting_sort_digit(nums, exp)
        exp *= 10
```

**为什么必须从最低位开始排序**？因为对高位排序时，低位的有序性会被打乱；只有先保证低位有序，再按高位排序（且高位排序使用稳定排序），才能在“高位相同”时保留低位的相对次序，最终得到整体有序的结果。基数排序的时间复杂度为 O(n × d) ，其中 d 为最大元素的位数。

## 排序算法对比小结

#### 重点回顾

- 冒泡排序通过交换相邻元素来实现排序。通过添加一个标志位来实现提前返回，我们可以将冒泡排序的最佳时间复杂度优化到 O(n) 。
- 插入排序每轮将未排序区间内的元素插入到已排序区间的正确位置，从而完成排序。虽然插入排序的时间复杂度为 O(n²) ，但由于单元操作相对较少，因此在小数据量的排序任务中非常受欢迎。
- 快速排序基于哨兵划分操作实现排序。在哨兵划分中，有可能每次都选取到最差的基准数，导致时间复杂度劣化至 O(n²) 。引入中位数基准数或随机基准数可以降低这种劣化的概率。通过优先递归较短子区间，可有效减小递归深度，将空间复杂度优化到 O(log n) 。
- 归并排序包括划分和合并两个阶段，典型地体现了分治策略。在归并排序中，排序数组需要创建辅助数组，空间复杂度为 O(n) ；然而排序链表的空间复杂度可以优化至 O(1) 。
- 桶排序包含三个步骤：数据分桶、桶内排序和合并结果。它同样体现了分治策略，适用于数据体量很大的情况。桶排序的关键在于对数据进行平均分配。
- 计数排序是桶排序的一个特例，它通过统计数据出现的次数来实现排序。计数排序适用于数据量大但数据范围有限的情况，并且要求数据能够转换为正整数。
- 基数排序通过逐位排序来实现数据排序，要求数据能够表示为固定位数的数字。
- 总的来说，我们希望找到一种排序算法，具有高效率、稳定、原地以及自适应性等优点。然而，正如其他数据结构和算法一样，没有一种排序算法能够同时满足所有这些条件。在实际应用中，我们需要根据数据的特性来选择合适的排序算法。
- 下图对比了主流排序算法的效率、稳定性、就地性和自适应性等。

![排序算法对比](assets/csorting__summary__sorting_algorithms_comparison.png)

---

> **来源**：本文转载自 [排序算法](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/sorting_algorithm.md)，作者 krahets，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
> 本文整合原书多个小节，其余章节：[冒泡排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/bubble_sort.md)、[插入排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/insertion_sort.md)、[选择排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/selection_sort.md)、[快速排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/quick_sort.md)、[归并排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/merge_sort.md)、[堆排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/heap_sort.md)、[计数排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/counting_sort.md)、[桶排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/bucket_sort.md)、[基数排序](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/radix_sort.md)、[小结](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_sorting/summary.md)。图片已下载到本模块 `assets/` 目录并以相对路径引用。
> 原文中指向仓库完整代码的引用块已省略，完整可运行 Python 代码见 [hello-algo/codes/python](https://github.com/krahets/hello-algo/tree/main/codes/python)。
