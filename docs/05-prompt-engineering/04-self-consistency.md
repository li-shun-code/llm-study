---
title: 自洽性与多路采样（Self-Consistency）
source_url: https://www.promptingguide.ai/techniques/consistency
author: DAIR.AI（Elvis Saravia）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 4
versions: 提示技术通用
---

> **来源**：本文翻译自 [Self-Consistency](https://www.promptingguide.ai/techniques/consistency)，作者 DAIR.AI（Elvis Saravia），许可 MIT。抓取于 2026-09-13。

**自洽**（self-consistency）可以说是提示词工程中较为进阶的技术之一，由 Wang et al. (2022) 提出，目标 是"替换思维链提示中朴素 的贪心解码"。其思想是：通过少样本 CoT **采样多条、多样化的推理路径**，再利用这些生成结果选出最一致的答案。这有助于提升 CoT 提示在算术与常识推理任务上的表现。

## 一个先失败的例子

来试一道算术推理题：

_提示词：_

```
When I was 6 my sister was half my age. Now
I'm 70 how old is my sister?
```

_输出：_

```
35
```

输出错了！（"我 6 岁时妹妹是我年龄的一半"即妹妹 3 岁，比我小 3 岁；我 70 岁时她应为 67 岁。）如何用自洽性改进？往下看。

## 用少样本 CoT 示例 + 多路采样

我们使用 Wang et al. 2022（表 17）中的少样本示例：

_提示词：_

```
Q: There are 15 trees in the grove. Grove workers will plant trees in the grove today. After they are done,
there will be 21 trees. How many trees did the grove workers plant today?
A: We start with 15 trees. Later we have 21 trees. The difference must be the number of trees they planted.
So, they must have planted 21 - 15 = 6 trees. The answer is 6.

Q: If there are 3 cars in the parking lot and 2 more cars arrive, how many cars are in the parking lot?
A: There are 3 cars in the parking lot already. 2 more arrive. Now there are 3 + 2 = 5 cars. The answer is 5.

Q: Leah had 32 chocolates and her sister had 42. If they ate 35, how many pieces do they have left in total?
A: Leah had 32 chocolates and Leah's sister had 42. That means there were originally 32 + 42 = 74
chocolates. 35 have been eaten. So in total they still have 74 - 35 = 39 chocolates. The answer is 39.

Q: Jason had 20 lollipops. He gave Denny some lollipops. Now Jason has 12 lollipops. How many lollipops
did Jason give to Denny?
A: Jason had 20 lollipops. Since he only has 12 now, he must have given the rest to Denny. The number of
lollipops he has given to Denny must have been 20 - 12 = 8 lollipops. The answer is 8.

Q: Shawn has five toys. For Christmas, he got two toys each from his mom and dad. How many toys does
he have now?
A: He has 5 toys. He got 2 from mom, so after that he has 5 + 2 = 7 toys. Then he got 2 more from dad, so
in total he has 7 + 2 = 9 toys. The answer is 9.

Q: There were nine computers in the server room. Five more computers were installed each day, from
monday to thursday. How many computers are now in the server room?
A: There are 4 days from monday to thursday. 5 computers were added each day. That means in total 4 * 5 =
20 computers were added. There were 9 computers in the beginning, so now there are 9 + 20 = 29 computers.
The answer is 29.

Q: Michael had 58 golf balls. On tuesday, he lost 23 golf balls. On wednesday he lost 2 more. How many
golf balls did he have at the end of wednesday?
A: Michael initially had 58 balls. He lost 23 on Tuesday, so after that he has 58 - 23 = 35 balls. On
Wednesday he lost 2 more so now he has 35 - 2 = 33 balls. The answer is 33.

Q: Olivia has $23. She bought five bagels for $3 each. How much money does she have left?
A: She bought 5 bagels for $3 each. This means she spent $15. She has $8 left.

Q: When I was 6 my sister was half my age. Now I'm 70 how old is my sister?
A:
```

在 temperature 大于 0 的采样设定下，对同一提示词多次生成，会得到不同的推理路径：

_输出 1：_

```
When I was 6 my sister was half my age, so she was 3. Now I am 70, so she is 70 - 3 = 67. The answer is 67.
```

_输出 2：_

```
When the narrator was 6, his sister was half his age, which is 3. Now that the narrator is 70, his sister would be 70 - 3 = 67 years old. The answer is 67.
```

_输出 3：_

```
When I was 6 my sister was half my age, so she was 3. Now I am 70, so she is 70/2 = 35. The answer is 35.
```

计算最终答案还涉及若干步骤（细节见论文），但就本文而言，关键是：**三条路径中"67"占了多数**，于是它就成为最终答案——正确！

> **译注**：工程实现上，自洽性 = "多路采样 + 多数投票"。现代 API 有两种做法：一是对同一提示并发调用 N 次（配合 temperature/top_p 制造多样性，或用采样参数的 `reasoning` 温度档）；二是部分 API 提供"一次请求多候选"的参数（如 Chat Completions 的 `n`）。得到 N 个答案后按最终答案聚合计数，取众数。代价是成本与延迟近似放大 N 倍，通常只用于正确性优先、可离线的场景，或配合"仅对难题触发"的路由策略使用。

## 小结

- 自洽性 = CoT + **多路采样**（multiple reasoning paths）+ **一致性聚合**（majority vote）；
- 它利用了一个事实：错误答案往往各自错得五花八门，而正确答案倾向于殊途同归；
- 采样多样性来自解码温度与不同的推理路径本身；示例中的三路采样里，两路给出 67、一路给出 35，多数投票救回了正确答案。
