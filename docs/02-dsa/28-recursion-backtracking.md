---
title: 回溯算法（面试选学）
source_url: https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_backtracking/backtracking_algorithm.md
author: krahets
license: CC BY-NC-SA 4.0
fetched_at: 2026-09-13
translated: false
versions: Python 3.12（无需第三方库）
order: 28
group: 算法策略（面试选学）
---
## 回溯算法

> **难度**：★★★☆（面试选学）。回溯是“把递归用满”的题型，需要先掌握《递归入门》中的递归三要素与调用栈，再本篇把它推进到“多分支 + 状态回退”。
> **适合**：需要手写所有排列、组合、子集、棋盘类题目的读者；日常后端开发很少直接用回溯，但它是理解搜索类算法（含部分剪枝优化）的地基。
> **前置**：《递归入门》讲清了递归的“递 / 归”、尾递归与用栈模拟递归，本篇不再重复这些内容，只讨论递归之上的**多分支搜索与状态撤销**。



<u>回溯算法（backtracking algorithm）</u>是一种通过穷举来解决问题的方法，它的核心思想是从一个初始状态出发，暴力搜索所有可能的解决方案，当遇到正确的解则将其记录，直到找到解或者尝试了所有可能的选择都无法找到解为止。

回溯算法通常采用“深度优先搜索”来遍历解空间。在《二叉树遍历》中我们提到，前序、中序和后序遍历都属于深度优先搜索。接下来，我们利用前序遍历构造一个回溯问题，逐步了解回溯算法的工作原理。

> **【例题一】**
> 给定一棵二叉树，搜索并记录所有值为 7 的节点，请返回节点列表。

对于此题，我们前序遍历这棵树，并判断当前节点的值是否为 7 ，若是，则将该节点的值加入结果列表 `res` 之中。相关过程实现如下图和以下代码所示：

```python
def pre_order(root: TreeNode):
    """前序遍历：例题一"""
    if root is None:
        return
    if root.val == 7:
        # 记录解
        res.append(root)
    pre_order(root.left)
    pre_order(root.right)
```


![在前序遍历中搜索节点](assets/cbacktracking__backtracking_algorithm__preorder_find_nodes.png)

### 尝试与回退

**之所以称之为回溯算法，是因为该算法在搜索解空间时会采用“尝试”与“回退”的策略**。当算法在搜索过程中遇到某个状态无法继续前进或无法得到满足条件的解时，它会撤销上一步的选择，退回到之前的状态，并尝试其他可能的选择。

对于例题一，访问每个节点都代表一次“尝试”，而越过叶节点或返回父节点的 `return` 则表示“回退”。

值得说明的是，**回退并不仅仅包括函数返回**。为解释这一点，我们对例题一稍作拓展。

> **【例题二】**
> 在二叉树中搜索所有值为 7 的节点，**请返回根节点到这些节点的路径**。

在例题一代码的基础上，我们需要借助一个列表 `path` 记录访问过的节点路径。当访问到值为 7 的节点时，则复制 `path` 并添加进结果列表 `res` 。遍历完成后，`res` 中保存的就是所有的解。代码如下所示：

```python
def pre_order(root: TreeNode):
    """前序遍历：例题二"""
    if root is None:
        return
    # 尝试
    path.append(root)
    if root.val == 7:
        # 记录解
        res.append(list(path))
    pre_order(root.left)
    pre_order(root.right)
    # 回退
    path.pop()
```


在每次“尝试”中，我们通过将当前节点添加进 `path` 来记录路径；而在“回退”前，我们需要将该节点从 `path` 中弹出，**以恢复本次尝试之前的状态**。

观察下图所示的过程，**我们可以将尝试和回退理解为“前进”与“撤销”**，两个操作互为逆向。

### 剪枝

复杂的回溯问题通常包含一个或多个约束条件，**约束条件通常可用于“剪枝”**。

> **【例题三】**
> 在二叉树中搜索所有值为 7 的节点，请返回根节点到这些节点的路径，**并要求路径中不包含值为 3 的节点**。

为了满足以上约束条件，**我们需要添加剪枝操作**：在搜索过程中，若遇到值为 3 的节点，则提前返回，不再继续搜索。代码如下所示：

```python
def pre_order(root: TreeNode):
    """前序遍历：例题三"""
    # 剪枝
    if root is None or root.val == 3:
        return
    # 尝试
    path.append(root)
    if root.val == 7:
        # 记录解
        res.append(list(path))
    pre_order(root.left)
    pre_order(root.right)
    # 回退
    path.pop()
```


“剪枝”是一个非常形象的名词。如下图所示，在搜索过程中，**我们“剪掉”了不满足约束条件的搜索分支**，避免许多无意义的尝试，从而提高了搜索效率。

![根据约束条件剪枝](assets/cbacktracking__backtracking_algorithm__preorder_find_constrained_paths.png)

### 框架代码

接下来，我们尝试将回溯的“尝试、回退、剪枝”的主体框架提炼出来，提升代码的通用性。

在以下框架代码中，`state` 表示问题的当前状态，`choices` 表示当前状态下可以做出的选择：


```python title=""
def backtrack(state: State, choices: list[choice], res: list[state]):
    """回溯算法框架"""
    # 判断是否为解
    if is_solution(state):
        # 记录解
        record_solution(state, res)
        # 不再继续搜索
        return
    # 遍历所有选择
    for choice in choices:
        # 剪枝：判断选择是否合法
        if is_valid(state, choice):
            # 尝试：做出选择，更新状态
            make_choice(state, choice)
            backtrack(state, choices, res)
            # 回退：撤销选择，恢复到之前的状态
            undo_choice(state, choice)
```

接下来，我们基于框架代码来解决例题三。状态 `state` 为节点遍历路径，选择 `choices` 为当前节点的左子节点和右子节点，结果 `res` 是路径列表：

```python
def backtrack(
    state: list[TreeNode], choices: list[TreeNode], res: list[list[TreeNode]]
):
    """回溯算法：例题三"""
    # 检查是否为解
    if is_solution(state):
        # 记录解
        record_solution(state, res)
    # 遍历所有选择
    for choice in choices:
        # 剪枝：检查选择是否合法
        if is_valid(state, choice):
            # 尝试：做出选择，更新状态
            make_choice(state, choice)
            # 进行下一轮选择
            backtrack(state, [choice.left, choice.right], res)
            # 回退：撤销选择，恢复到之前的状态
            undo_choice(state, choice)
```


根据题意，我们在找到值为 7 的节点后应该继续搜索，**因此需要将记录解之后的 `return` 语句删除**。下图对比了保留或删除 `return` 语句的搜索过程。

![保留与删除 return 的搜索过程对比](assets/cbacktracking__backtracking_algorithm__backtrack_remove_return_or_not.png)

相比基于前序遍历的代码实现，基于回溯算法框架的代码实现虽然显得啰唆，但通用性更好。实际上，**许多回溯问题可以在该框架下解决**。我们只需根据具体问题来定义 `state` 和 `choices` ，并实现框架中的各个方法即可。

### 常用术语

为了更清晰地分析算法问题，我们总结一下回溯算法中常用术语的含义，并对照例题三给出对应示例，如下表所示。

**表：常见的回溯算法术语**

| 名词                   | 定义                                                                       | 例题三                                                               |
| ---------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 解（solution）         | 解是满足问题特定条件的答案，可能有一个或多个                               | 根节点到节点 7 的满足约束条件的所有路径                            |
| 约束条件（constraint） | 约束条件是问题中限制解的可行性的条件，通常用于剪枝                         | 路径中不包含节点 3                                                 |
| 状态（state）          | 状态表示问题在某一时刻的情况，包括已经做出的选择                           | 当前已访问的节点路径，即 `path` 节点列表                             |
| 尝试（attempt）        | 尝试是根据可用选择来探索解空间的过程，包括做出选择，更新状态，检查是否为解 | 递归访问左（右）子节点，将节点添加进 `path` ，判断节点的值是否为 7 |
| 回退（backtracking）   | 回退指遇到不满足约束条件的状态时，撤销前面做出的选择，回到上一个状态       | 当越过叶节点、结束节点访问、遇到值为 3 的节点时终止搜索，函数返回  |
| 剪枝（pruning）        | 剪枝是根据问题特性和约束条件避免无意义的搜索路径的方法，可提高搜索效率     | 当遇到值为 3 的节点时，则不再继续搜索                              |

> **【提示】**
> 问题、解、状态等概念是通用的，在分治、回溯、动态规划、贪心等算法中都有涉及。

### 优点与局限性

回溯算法本质上是一种深度优先搜索算法，它尝试所有可能的解决方案直到找到满足条件的解。这种方法的优点在于能够找到所有可能的解决方案，而且在合理的剪枝操作下，具有很高的效率。

然而，在处理大规模或者复杂问题时，**回溯算法的运行效率可能难以接受**。

- **时间**：回溯算法通常需要遍历状态空间的所有可能，时间复杂度可以达到指数阶或阶乘阶。
- **空间**：在递归调用中需要保存当前的状态（例如路径、用于剪枝的辅助变量等），当深度很大时，空间需求可能会变得很大。

即便如此，**回溯算法仍然是某些搜索问题和约束满足问题的最佳解决方案**。对于这些问题，由于无法预测哪些选择可生成有效的解，因此我们必须对所有可能的选择进行遍历。在这种情况下，**关键是如何优化效率**，常见的效率优化方法有两种。

- **剪枝**：避免搜索那些肯定不会产生解的路径，从而节省时间和空间。
- **启发式搜索**：在搜索过程中引入一些策略或者估计值，从而优先搜索最有可能产生有效解的路径。

### 回溯典型例题

回溯算法可用于解决许多搜索问题、约束满足问题和组合优化问题。

**搜索问题**：这类问题的目标是找到满足特定条件的解决方案。

- 全排列问题：给定一个集合，求出其所有可能的排列组合。
- 子集和问题：给定一个集合和一个目标和，找到集合中所有和为目标和的子集。
- 汉诺塔问题：给定三根柱子和一系列大小不同的圆盘，要求将所有圆盘从一根柱子移动到另一根柱子，每次只能移动一个圆盘，且不能将大圆盘放在小圆盘上。

**约束满足问题**：这类问题的目标是找到满足所有约束条件的解。

- n 皇后：在 n × n 的棋盘上放置 n 个皇后，使得它们互不攻击。
- 数独：在 9 × 9 的网格中填入数字 1 ~ 9 ，使得每行、每列和每个 3 × 3 子网格中的数字不重复。
- 图着色问题：给定一个无向图，用最少的颜色给图的每个顶点着色，使得相邻顶点颜色不同。

**组合优化问题**：这类问题的目标是在一个组合空间中找到满足某些条件的最优解。

- 0-1 背包问题：给定一组物品和一个背包，每个物品有一定的价值和重量，要求在背包容量限制内，选择物品使得总价值最大。
- 旅行商问题：在一个图中，从一个点出发，访问所有其他点恰好一次后返回起点，求最短路径。
- 最大团问题：给定一个无向图，找到最大的完全子图，即子图中的任意两个顶点之间都有边相连。

请注意，对于许多组合优化问题，回溯不是最优解决方案。

- 0-1 背包问题通常使用动态规划解决，以达到更高的时间效率。
- 旅行商是一个著名的 NP-Hard 问题，常用解法有遗传算法和蚁群算法等。
- 最大团问题是图论中的一个经典问题，可用贪心算法等启发式算法来解决。

## 示例：n 皇后问题


> **【问题】**
> 根据国际象棋的规则，皇后可以攻击与同处一行、一列或一条斜线上的棋子。给定 n 个皇后和一个 n × n 大小的棋盘，寻找使得所有皇后之间无法相互攻击的摆放方案。

如下图所示，当 n = 4 时，共可以找到两个解。从回溯算法的角度看，n × n 大小的棋盘共有 n² 个格子，给出了所有的选择 `choices` 。在逐个放置皇后的过程中，棋盘状态在不断地变化，每个时刻的棋盘就是状态 `state` 。

![4 皇后问题的解](assets/cbacktracking__n_queens_problem__solution_4_queens.png)

下图展示了本题的三个约束条件：**多个皇后不能在同一行、同一列、同一条对角线上**。值得注意的是，对角线分为主对角线 `\` 和次对角线 `/` 两种。

![n 皇后问题的约束条件](assets/cbacktracking__n_queens_problem__n_queens_constraints.png)

#### 逐行放置策略

皇后的数量和棋盘的行数都为 n ，因此我们容易得到一个推论：**棋盘每行都允许且只允许放置一个皇后**。

也就是说，我们可以采取逐行放置策略：从第一行开始，在每行放置一个皇后，直至最后一行结束。

下图所示为 4 皇后问题的逐行放置过程。受画幅限制，下图仅展开了第一行的其中一个搜索分支，并且将不满足列约束和对角线约束的方案都进行了剪枝。

![逐行放置策略](assets/cbacktracking__n_queens_problem__n_queens_placing.png)

从本质上看，**逐行放置策略起到了剪枝的作用**，它避免了同一行出现多个皇后的所有搜索分支。

#### 列与对角线剪枝

为了满足列约束，我们可以利用一个长度为 n 的布尔型数组 `cols` 记录每一列是否有皇后。在每次决定放置前，我们通过 `cols` 将已有皇后的列进行剪枝，并在回溯中动态更新 `cols` 的状态。

> **【提示】**
> 请注意，矩阵的起点位于左上角，其中行索引从上到下增加，列索引从左到右增加。

那么，如何处理对角线约束呢？设棋盘中某个格子的行列索引为 (row, col) ，选定矩阵中的某条主对角线，我们发现该对角线上所有格子的行索引减列索引都相等，**即主对角线上所有格子的 row - col 为恒定值**。

也就是说，如果两个格子满足 row₁ - col₁ = row₂ - col₂ ，则它们一定处在同一条主对角线上。利用该规律，我们可以借助下图所示的数组 `diags1` 记录每条主对角线上是否有皇后。

同理，**次对角线上的所有格子的 row + col 是恒定值**。我们同样也可以借助数组 `diags2` 来处理次对角线约束。

![处理列约束和对角线约束](assets/cbacktracking__n_queens_problem__n_queens_cols_diagonals.png)

#### 代码实现

请注意，n 维方阵中 row - col 的范围是 [-n + 1, n - 1] ，row + col 的范围是 [0, 2n - 2] ，所以主对角线和次对角线的数量都为 2n - 1 ，即数组 `diags1` 和 `diags2` 的长度都为 2n - 1 。

```python
def backtrack(
    row: int,
    n: int,
    state: list[list[str]],
    res: list[list[list[str]]],
    cols: list[bool],
    diags1: list[bool],
    diags2: list[bool],
):
    """回溯算法：n 皇后"""
    # 当放置完所有行时，记录解
    if row == n:
        res.append([list(row) for row in state])
        return
    # 遍历所有列
    for col in range(n):
        # 计算该格子对应的主对角线和次对角线
        diag1 = row - col + n - 1
        diag2 = row + col
        # 剪枝：不允许该格子所在列、主对角线、次对角线上存在皇后
        if not cols[col] and not diags1[diag1] and not diags2[diag2]:
            # 尝试：将皇后放置在该格子
            state[row][col] = "Q"
            cols[col] = diags1[diag1] = diags2[diag2] = True
            # 放置下一行
            backtrack(row + 1, n, state, res, cols, diags1, diags2)
            # 回退：将该格子恢复为空位
            state[row][col] = "#"
            cols[col] = diags1[diag1] = diags2[diag2] = False
```


逐行放置 n 次，考虑列约束，则从第一行到最后一行分别有 n、n-1、…、2、1 个选择，使用 O(n!) 时间。当记录解时，需要复制矩阵 `state` 并添加进 `res` ，复制操作使用 O(n²) 时间。因此，**总体时间复杂度为 O(n! · n²)** 。实际上，根据对角线约束的剪枝也能够大幅缩小搜索空间，因而搜索效率往往优于以上时间复杂度。

数组 `state` 使用 O(n²) 空间，数组 `cols`、`diags1` 和 `diags2` 皆使用 O(n) 空间。最大递归深度为 n ，使用 O(n) 栈帧空间。因此，**空间复杂度为 O(n²)** 。

## 示例：全排列问题

n 皇后是“在约束下放置元素”，全排列则是“把所有顺序都枚举出来”，它是回溯最典型的入门题。

> **【问题】**
> 给定一个不含重复元素的整数数组 `nums` ，请返回该数组的所有可能排列，可以按任意顺序返回。

**第一步：定义状态**。根据排列的性质，当状态长度等于数组长度时，即得到一个排列，因此状态 `state` 为已选出的元素列表。

**第二步：定义选择**。针对当前状态，所有未被选过的元素都可以作为下一个选择，因此 `choices` 为数组 `nums` 的所有元素。注意元素能否被重复选取由题意决定，本题不允许重复选取。

**第三步：设计约束**。不允许重复选取元素，因此需要引入一个 `selected` 数组来记录各元素是否已被选中，`selected[i]` 对应 `nums[i]` 。

![全排列的剪枝示意](assets/cbacktracking__permutations_problem__permutations_i_pruning.png)

把这三步填进前面的回溯框架，就得到完整解法：

```python
def backtrack(
    state: list[int], choices: list[int], selected: list[bool], res: list[list[int]]
):
    """回溯算法：全排列 I"""
    # 当状态长度等于元素数量时，记录解
    if len(state) == len(choices):
        res.append(list(state))
        return
    # 遍历所有选择
    for i, choice in enumerate(choices):
        # 剪枝：不允许重复选择元素
        if not selected[i]:
            # 尝试：做出选择，更新状态
            selected[i] = True
            state.append(choice)
            # 进行下一轮选择
            backtrack(state, choices, selected, res)
            # 回退：撤销选择，恢复到之前的状态
            selected[i] = False
            state.pop()


def permutations_i(nums: list[int]) -> list[list[int]]:
    """全排列 I"""
    res = []
    backtrack(state=[], choices=nums, selected=[False] * len(nums), res=res)
    return res
```

如果题目变成「数组中**含重复元素**」（全排列 II），只需在每轮选择里加一层去重：用一个哈希集合记录本轮已经试过的元素值，值相同的分支只走一次。

```python
def backtrack_permutations_ii(
    state: list[int], choices: list[int], selected: list[bool], res: list[list[int]]
):
    """回溯算法：全排列 II（元素可重复，但排列不可重复）"""
    # 当状态长度等于元素数量时，记录解
    if len(state) == len(choices):
        res.append(list(state))
        return
    duplicated = set[int]()  # 记录本轮已选择过的元素值
    for i, choice in enumerate(choices):
        # 剪枝：不允许重复选择元素，且不允许重复选择相等元素
        if not selected[i] and choice not in duplicated:
            duplicated.add(choice)
            # 尝试：做出选择，更新状态
            selected[i] = True
            state.append(choice)
            backtrack_permutations_ii(state, choices, selected, res)
            # 回退：撤销选择，恢复到之前的状态
            selected[i] = False
            state.pop()
```

## 示例：子集和问题

> **【问题】**
> 给定一个正整数数组 `nums` 和一个目标正整数 `target` ，请找出所有满足条件的组合，即元素之和等于 `target` 的组合。给定数组中各个元素可无限次选取，但同一个组合内的元素不能重复，若不存在满足条件的组合则返回空列表。

**第一步：定义状态**。和 n 皇后、全排列一样，状态 `state` 为当前已选出的元素列表。

**第二步：定义选择**。每轮可以选择任意元素，直到子集和等于 `target` 。

**第三步：设计约束**。约束有两个：子集和不能超过 `target` ；同一组合不能包含重复元素（`[1, 5]` 和 `[5, 1]` 视为同一组合）。

第一个约束对应**剪枝一**：先对 `nums` 排序，一旦 `target - choices[i] < 0` 就可以直接跳出循环，因为后面的元素更大。第二个约束对应**剪枝二**：开启一个变量 `start` ，记录遍历 `nums` 的起始索引，从而避免生成重复组合。

![子集和的两类剪枝](assets/cbacktracking__subset_sum_problem__subset_sum_i_pruning.png)

```python
def backtrack(
    state: list[int], target: int, choices: list[int], start: int, res: list[list[int]]
):
    """回溯算法：子集和 I"""
    # 子集和等于 target 时，记录解
    if target == 0:
        res.append(list(state))
        return
    # 遍历所有选择
    # 剪枝二：从 start 开始遍历，避免生成重复子集
    for i in range(start, len(choices)):
        # 剪枝一：若子集和超过 target ，则直接结束循环
        # 这是因为数组已排序，后边元素更大，子集和一定超过 target
        if target - choices[i] < 0:
            break
        # 尝试：做出选择，更新 target 和 start
        state.append(choices[i])
        # 进行下一轮选择
        backtrack(state, target - choices[i], choices, i, res)
        # 回退：撤销选择，恢复到之前的状态
        state.pop()


def subset_sum_i(nums: list[int], target: int) -> list[list[int]]:
    """求解子集和 I（元素可重复选取）"""
    state = []  # 状态（子集）
    nums.sort()  # 对 nums 进行排序
    start = 0  # 遍历起始点
    res = []  # 结果列表（子集列表）
    backtrack(state, target, nums, start, res)
    return res
```

如果题意改成「每个元素只能使用一次」（LeetCode 40 组合总和 II），就要再加两条剪枝：递归时传入 `i + 1` 而非 `i` ，以及“当某个元素与左邻元素相等时跳过该分支”。

```python
def backtrack_subset_sum_ii(
    state: list[int], target: int, choices: list[int], start: int, res: list[list[int]]
):
    """回溯算法：子集和 II（元素不可重复选取，组合不可重复）"""
    if target == 0:
        res.append(list(state))
        return
    for i in range(start, len(choices)):
        # 剪枝一：数组已排序，后面的元素更大，子集和必然超过 target
        if target - choices[i] < 0:
            break
        # 剪枝四：该元素与左邻元素相等，说明此分支重复，直接跳过
        if i > start and choices[i] == choices[i - 1]:
            continue
        state.append(choices[i])
        # 注意这里是 i + 1 ：本层之后的递归不再考虑 choices[i]
        backtrack_subset_sum_ii(state, target - choices[i], choices, i + 1, res)
        state.pop()
```

## 回溯的三个通用要点

把 n 皇后、全排列、子集和放在一起看，所有回溯题都归结为三件事。

1. **状态怎么编码**。`state` 可以是棋盘（二维列表）、已选序列、也可以只是一个索引；它必须足以判断“是否到达解”。
2. **选择怎么枚举**。`choices` 是当前状态下所有合法的下一步；把“不可行”的判断尽量前移（排序后 `break`、`start` 收窄、`duplicated` 集合去重），剪枝强度决定实际耗时。
3. **撤销必须成对**。`make_choice()` 改了什么，`undo_choice()` 就要一字不差地改回来。最常见的 bug 是 `state.append(x)` 之后忘记 `state.pop()` ，或 `res.append(state)` 忘记复制（`list(state)` 或 `[row[:] for row in state]` ）——Python 列表是引用，不复制的话回溯结束后 `res` 里所有解都会变成空列表。

> **【易错】** 上面第三条在 Python 里格外隐蔽：`res.append(state)` 加入的是同一个对象。判断自己有没有踩坑，只要在函数末尾 `print(len(res[0]))` ，若为 0 就是忘记复制了。


---

> **来源**：本文转载自 [回溯算法](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_backtracking/backtracking_algorithm.md)，作者 krahets，许可 CC BY-NC-SA 4.0。抓取于 2026-09-13。
> 本文整合原书多个小节，其余章节：[n 皇后问题](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_backtracking/n_queens_problem.md)、[全排列问题](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_backtracking/permutations_problem.md)、[子集和问题](https://raw.githubusercontent.com/krahets/hello-algo/main/docs/chapter_backtracking/subset_sum_problem.md)。图片已下载到本模块 `assets/` 目录并以相对路径引用。
> 原文中指向仓库完整代码的引用块已省略，完整可运行 Python 代码见 [hello-algo/codes/python](https://github.com/krahets/hello-algo/tree/main/codes/python)。
