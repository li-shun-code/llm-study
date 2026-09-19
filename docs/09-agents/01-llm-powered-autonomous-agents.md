---
title: LLM 驱动的自主智能体（Agent）全景：规划、记忆与工具使用
source_url: https://lilianweng.github.io/posts/2023-06-23-agent/
author: Lilian Weng
license: CC BY-NC 4.0
fetched_at: 2026-09-13
translated: true
order: 1
group: 奠基：智能体如何思考
vPre: true
---
以大语言模型（LLM）为核心控制器来构建智能体（Agent）是一个很酷的概念。AutoGPT、GPT-Engineer、BabyAGI 等一批概念验证（Proof-of-Concept） demos 是极具启发性的例子。LLM 的潜力不止于生成写得不错的文案、故事、散文和程序——它还可以被构架为一个强大的通用问题求解器（General Problem Solver）。

# Agent 系统总览

在一个 LLM 驱动的自主智能体系统中，LLM 充当智能体的"大脑"，辅以若干关键组件：

- **规划（Planning）**
  - 子目标与分解：Agent 将大型任务拆解为更小、更易管理的子目标，从而高效处理复杂任务。
  - 反思与完善：Agent 可以对过去的行动进行自我批评与自我反思，从错误中学习并改进后续步骤，提升最终结果的质量。
- **记忆（Memory）**
  - 短期记忆（Short-term Memory）：我认为所有上下文内学习（In-context Learning，参见[提示工程](https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/)一文）都可以看作是利用模型的短期记忆来学习。
  - 长期记忆（Long-term Memory）：为 Agent 提供长时间保留与召回（近乎无限）信息的能力，通常借助外部向量存储（Vector Store）和快速检索实现。
- **工具使用（Tool Use）**
  - Agent 学习调用外部 API，以获取模型权重中缺失的信息（权重在预训练后往往难以更改），包括实时信息、代码执行能力、专有数据源访问等。

![LLM 驱动的自主智能体系统总览](https://lilianweng.github.io/posts/2023-06-23-agent/agent-overview.png)

*图：LLM 驱动的自主智能体系统总览。*

# 组件一：规划

复杂的任务通常包含许多步骤，Agent 需要弄清楚这些步骤是什么，并提前做好规划。

## 任务分解（Task Decomposition）

[思维链](https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/#chain-of-thought-cot)（Chain of Thought，CoT；Wei et al. 2022）已成为提升模型在复杂任务上表现的标准提示技术。模型被要求"一步一步思考（think step by step）"，利用更多的测试时计算把困难任务分解为更小、更简单的步骤。CoT 把大任务转化为多个可管理的子任务，也让模型的思考过程变得可解释。

**思维树**（Tree of Thoughts，Yao et al. 2023）扩展了 CoT：它在每一步探索多条推理可能性。它先将问题分解为多个思考步骤，并在每一步生成多个候选思考，形成一棵树状结构。搜索过程可以用广度优先搜索（BFS）或深度优先搜索（DFS），每个状态由分类器（通过提示词实现）或多数投票来评估。

任务分解可以通过以下方式完成：(1) 用简单的提示词让 LLM 完成，例如 `"Steps for XYZ.\n1."`、`"What are the subgoals for achieving XYZ?"`；(2) 使用任务特定的指令，例如写小说时用 `"Write a story outline."`（"写一个故事大纲"）；(3) 由人类输入补充。

另一个截然不同的思路是 **LLM+P**（Liu et al. 2023）：依赖外部经典规划器（Classical Planner）来做长程规划。该方法使用规划领域定义语言（Planning Domain Definition Language，PDDL）作为中间接口描述规划问题：LLM 先把问题翻译成"Problem PDDL"，再请求经典规划器基于已有的"Domain PDDL"生成 PDDL 计划，最后把 PDDL 计划翻译回自然语言。本质上，规划步骤被外包给外部工具，这要求领域内已有 PDDL 建模和合适的规划器——这在某些机器人场景中常见，但在许多其他领域并不具备。

## 自我反思（Self-Reflection）

自我反思让自主智能体能够通过完善过去的行动决策、纠正之前的错误来迭代改进，这在试错不可避免的现实任务中至关重要。

**ReAct**（Yao et al. 2023）在 LLM 中整合了推理（Reasoning）与行动（Acting）：把动作空间扩展为"任务特定的离散动作"与"语言空间"的组合。前者让 LLM 能与环境交互（例如调用维基百科搜索 API），后者让 LLM 用自然语言生成推理轨迹（Reasoning Trace）。

ReAct 的提示模板包含让 LLM 显式思考的步骤，大致格式如下：

```
Thought: ...
Action: ...
Observation: ...
... (Repeated many times)
```

![ReAct 推理轨迹示例](https://lilianweng.github.io/posts/2023-06-23-agent/react.png)

*图：知识密集型任务（如 HotpotQA、FEVER）与决策类任务（如 AlfWorld 环境、WebShop）的推理轨迹示例。（图片来源：Yao et al. 2023）*

在知识密集型任务和决策类任务的实验中，`ReAct` 的表现都优于去掉 `Thought: …` 步骤的纯 `Act` 基线。

**Reflexion**（Shinn & Labash 2023）是一个为 Agent 装备动态记忆与自我反思能力、以提升推理技能的框架。Reflexion 采用标准的强化学习（RL）设置：奖励模型提供简单的二元奖励，动作空间沿用 ReAct 的设定——在任务特定动作空间之上加入语言，以支持复杂的推理步骤。执行每个动作 $a_t$ 后，Agent 计算一个启发式量 $h_t$，并可以根据自我反思的结果选择性地*重置环境*、开始新一轮尝试。

![Reflexion 框架示意](https://lilianweng.github.io/posts/2023-06-23-agent/reflexion.png)

*图：Reflexion 框架示意。（图片来源：Shinn & Labash, 2023）*

启发式函数决定轨迹何时低效或出现幻觉（Hallucination）而应停止。低效规划指耗时过长却未成功的轨迹；幻觉则被定义为遇到一串连续相同动作、且在环境中得到相同观察的情形。

自我反思通过给 LLM 展示两个双样本（two-shot）例子来生成，每个例子是一对（失败的轨迹，用于指导未来计划修改的理想反思）。反思会被加入 Agent 的工作记忆，最多三条，作为查询 LLM 时的上下文。

![Reflexion 实验结果](https://lilianweng.github.io/posts/2023-06-23-agent/reflexion-exp.png)

*图：在 AlfWorld 环境与 HotpotQA 上的实验。AlfWorld 中幻觉是比低效规划更常见的失败原因。（图片来源：Shinn & Labash, 2023）*

**后见之明链**（Chain of Hindsight，CoH；Liu et al. 2023）鼓励模型通过显式地向它展示一连串带反馈标注的历史输出，来改进自己的输出。人类反馈数据是一组集合 $D_h = \{(x, y_i , r_i , z_i)\}_{i=1}^n$，其中 $x$ 是提示词，每个 $y_i$ 是模型补全，$r_i$ 是人类对 $y_i$ 的评分，$z_i$ 是对应的人类事后反馈。假设反馈元组按奖励排序 $r_n \geq r_{n-1} \geq \dots \geq r_1$，过程是监督微调：数据形如序列 $\tau_h = (x, z_i, y_i, z_j, y_j, \dots, z_n, y_n)$，其中 $1 \leq i \leq j \leq n$。模型被微调为只在序列前缀条件下预测 $y_n$，使模型能基于反馈序列自我反思、产生更好的输出。测试时模型可以选择性地接受人类标注员的多轮指令。

为避免过拟合，CoH 在预训练数据集的对数似然上加了正则化项；为避免走捷径和照抄（反馈序列里有很多常见词），训练时随机遮蔽（mask）0%-5% 的历史 token。

他们实验中的训练数据集组合了 WebGPT 对比数据、人类反馈摘要数据和人类偏好数据集。

![CoH 微调效果](https://lilianweng.github.io/posts/2023-06-23-agent/CoH.png)

*图：经过 CoH 微调后，模型可以按指令在一个序列里产出逐步改进的输出。（图片来源：Liu et al. 2023）*

CoH 的想法是在上下文中呈现一段"顺序改进的输出历史"，训练模型跟随这一趋势产出更好的输出。**算法蒸馏**（Algorithm Distillation，AD；Laskin et al. 2023）把同样的想法应用到强化学习任务的跨回合（cross-episode）轨迹上：*算法*被封装在一个以长历史为条件的策略中。考虑到 Agent 会与环境交互多次、且每个回合都比上一回合稍有进步，AD 把这些学习历史拼接起来喂给模型，于是我们可以期待下一次预测的动作会比之前的尝试表现更好。它的目标是学习 RL 的"过程"本身，而不是训练一个任务特定策略。

![算法蒸馏示意](https://lilianweng.github.io/posts/2023-06-23-agent/algorithm-distillation.png)

*图：算法蒸馏（AD）工作原理。（图片来源：Laskin et al. 2023）*

该论文假设：任何能生成一组学习历史的算法，都可以通过对动作做行为克隆（Behavioral Cloning）被蒸馏进一个神经网络。历史数据由一组源策略（Source Policy）生成，每个源策略针对特定任务训练。训练阶段，每次 RL 运行会随机采样一个任务，用多回合历史的一个子序列来训练，从而学到的策略是任务无关（task-agnostic）的。

现实中模型上下文窗口长度有限，回合必须足够短才能构造多回合历史。2-4 个回合的多回合上下文是学到近优的上下文内 RL 算法所必需的——上下文内 RL 的涌现需要足够长的上下文。

与三个基线（包括 ED（专家蒸馏：用专家轨迹代替学习历史做行为克隆）、源策略（用于生成蒸馏轨迹，采用 UCB）、RL²（Duan et al. 2017，因需要在线 RL 而作为上限））相比，AD 仅用离线 RL 就展示了接近 RL² 的上下文内 RL 性能，且学习速度远快于其他基线。在以源策略的部分训练历史为条件时，AD 也比 ED 基线提升得快得多。

![AD 与基线对比](https://lilianweng.github.io/posts/2023-06-23-agent/algorithm-distillation-results.png)

*图：在需要记忆与探索的环境中比较 AD、ED、源策略与 RL²。只给二元奖励。源策略在"dark"环境用 A3C 训练、watermaze 用 DQN 训练。（图片来源：Laskin et al. 2023）*

# 组件二：记忆

（特别感谢 ChatGPT 帮助我起草这一节。在与 ChatGPT 的对话中，我学到了很多关于人脑和快速 MIPS 数据结构的知识。）

## 记忆类型

记忆可以被定义为：获取、存储、保留并随后提取信息的过程。人脑中有几种类型的记忆。

1. **感觉记忆（Sensory Memory）**：记忆的最早期阶段，能在原始刺激结束后保留感觉信息（视觉、听觉等）的印象，通常只持续几秒。子类包括图像记忆（视觉）、声像记忆（听觉）和触觉记忆（触觉）。

2. **短期记忆（Short-Term Memory，STM）**或**工作记忆（Working Memory）**：存储我们当前正在感知、并用于完成学习与推理等复杂认知任务的信息。短期记忆被认为容量约为 7 个条目（Miller 1956），持续 20-30 秒。

3. **长期记忆（Long-Term Memory，LTM）**：能把信息保存极长时间（几天到几十年），存储容量几乎无限。长期记忆有两个子类：
   - 外显/陈述性记忆（Explicit / Declarative Memory）：对事实和事件的记忆，可以被有意识地回忆，包括情景记忆（事件与经历）和语义记忆（事实与概念）。
   - 内隐/程序性记忆（Implicit / Procedural Memory）：无意识的记忆，涉及自动执行的技能与惯例，例如骑自行车、敲键盘。

![人类记忆分类](https://lilianweng.github.io/posts/2023-06-23-agent/memory.png)

*图：人类记忆的分类。*

我们可以粗略建立如下映射：

- 感觉记忆：为原始输入（文本、图像或其他模态）学习嵌入表示（Embedding）；
- 短期记忆：上下文内学习。它短且有限，受 Transformer 有限的上下文窗口长度约束；
- 长期记忆：Agent 在查询时可以关注的外部向量存储，通过快速检索访问。

## 最大内积检索（MIPS）

外部记忆可以缓解有限注意力跨度的限制。标准做法是把信息的嵌入表示存入支持快速最大内积检索（Maximum Inner Product Search，MIPS）的向量数据库。为了优化检索速度，常见选择是*近似最近邻（Approximate Nearest Neighbors，ANN）*算法：返回近似的前 k 个最近邻，用一点精度损失换取巨大加速。

常用的快速 MIPS ANN 算法有：

- **LSH**（局部敏感哈希，Locality-Sensitive Hashing）：引入一种*哈希*函数，使相似的输入项以高概率被映射到同一个桶，桶的数量远小于输入数量。
- **ANNOY**（Approximate Nearest Neighbors Oh Yeah）：核心数据结构是*随机投影树*（Random Projection Tree）——一组二叉树，每个非叶节点代表一个把输入空间对半切开的超平面，每个叶子存储一个数据点。树是独立随机构建的，因此某种程度上模拟了哈希函数。ANNOY 在所有树中搜索，迭代地进入离查询最近的半边并聚合结果。思路与 KD 树很接近，但可扩展性高得多。
- **HNSW**（分层可导航小世界图，Hierarchical Navigable Small World）：灵感来自[小世界网络](https://en.wikipedia.org/wiki/Small-world_network)——大多数节点可以在少数几步内从任意其他节点到达（如社交网络的"六度分隔"）。HNSW 构建这些小世界图的分层结构：底层包含真实数据点，中间层创建加速搜索的"捷径"。搜索时从顶层随机节点出发朝目标导航，当无法更接近时就下沉到下一层，直到最底层。上层每一步都可能跨越数据空间中的大距离，下层每一步则细化搜索质量。
- **FAISS**（Facebook AI Similarity Search）：其假设是在高维空间中节点间距离服从高斯分布，因而应存在数据点的*聚类*。FAISS 通过把向量空间划分为簇来做向量量化，再在簇内细化量化。搜索先用粗量化找簇候选，再用细量化在簇内深入。
- **ScaNN**（Scalable Nearest Neighbors）：主要创新是*各向异性向量量化*（Anisotropic Vector Quantization）：把数据点 $x_i$ 量化为 $\tilde{x}_i$，使得内积 $\langle q, x_i \rangle$ 尽量接近 $q$ 与原始 $x_i$ 的角度距离，而不是简单地选取最近的量化质心。

![MIPS 算法对比](https://lilianweng.github.io/posts/2023-06-23-agent/mips.png)

*表：MIPS 算法对比（recall@10 指标）。（图片来源：Google Blog, 2020）*

更多 MIPS 算法与性能对比参见 [ann-benchmarks.com](https://ann-benchmarks.com/)。

# 组件三：工具使用（Tool Use）

工具使用是人类显著且独具的特征。我们创造、改造并利用外部物体，去做超越我们身体与认知极限的事情。为 LLM 装备外部工具可以显著扩展模型能力。

![使用工具的海獭](https://lilianweng.github.io/posts/2023-06-23-agent/sea-otter.png)

*图：一只海獭漂浮在水中用石头敲开贝壳。虽然一些动物也会使用工具，但其复杂度无法与人类相比。（图片来源：Animals using tools）*

**MRKL**（Karpas et al. 2022，"Modular Reasoning, Knowledge and Language" 的缩写）是一种面向自主智能体的神经符号（Neuro-Symbolic）架构。一个 MRKL 系统包含一组"专家"模块，通用 LLM 充当路由器，把询问路由到最合适的专家模块。模块可以是神经的（如深度学习模型），也可以是符号的（如数学计算器、货币转换器、天气 API）。

他们做了微调 LLM 调用计算器的实验，以算术为测试用例。实验表明，口头数学应用题比显式陈述的数学题更难解，因为 LLM（7B 的 Jurassic1-large 模型）无法可靠地抽取基础算术所需的正确参数。结果凸显：当外部符号工具可以可靠工作时，*知道何时以及如何使用工具*才是关键，而这取决于 LLM 的能力。

**TALM**（Tool Augmented Language Models；Parisi et al. 2022）和 **Toolformer**（Schick et al. 2023）都对 LM 做微调使其学会使用外部工具 API。数据集根据"新加入的 API 调用标注是否能提升模型输出质量"来扩展。更多细节参见[提示工程一文的"External APIs"小节](https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/#external-apis)。

ChatGPT 插件与 OpenAI API 的[函数调用](https://platform.openai.com/docs/guides/function-calling)是 LLM 增强了工具使用能力并投入实际运行的范例。工具 API 集合可以由其他开发者提供（如插件），也可以自定义（如函数调用）。

**HuggingGPT**（Shen et al. 2023）是一个以 ChatGPT 为任务规划器、根据模型描述挑选 HuggingFace 平台上可用模型、再根据执行结果汇总回复的框架。

![HuggingGPT 工作方式](https://lilianweng.github.io/posts/2023-06-23-agent/hugging-gpt.png)

*图：HuggingGPT 的工作方式。（图片来源：Shen et al. 2023）*

系统包含 4 个阶段：

**(1) 任务规划**：LLM 充当大脑，把用户请求解析为多个任务。每个任务有四个属性：任务类型、ID、依赖、参数。他们用少样本示例引导 LLM 做任务解析与规划。其指令如下：

```
The AI assistant can parse user input to several tasks: [{"task": task, "id", task_id, "dep": dependency_task_ids, "args": {"text": text, "image": URL, "audio": URL, "video": URL}}]. The "dep" field denotes the id of the previous task which generates a new resource that the current task relies on. A special tag "-task_id" refers to the generated text image, audio and video in the dependency task with id as task_id. The task MUST be selected from the following options: {{ Available Task List }}. There is a logical relationship between tasks, please note their order. If the user input can't be parsed, you need to reply empty JSON. Here are several cases for your reference: {{ Demonstrations }}. The chat history is recorded as {{ Chat History }}. From this chat history, you can find the path of the user-mentioned resources for your task planning.
```

**(2) 模型选择**：LLM 把任务分发给专家模型，请求被表述为一道多选题：LLM 面对一列模型进行选择。由于上下文长度有限，需要按任务类型过滤候选。其指令如下：

```
Given the user request and the call command, the AI assistant helps the user to select a suitable model from a list of models to process the user request. The AI assistant merely outputs the model id of the most appropriate model. The output must be in a strict JSON format: "id": "id", "reason": "your detail reason for the choice". We have a list of models for you to choose from {{ Candidate Models }}. Please select one model from the list.
```

**(3) 任务执行**：专家模型在特定任务上执行并记录结果。其指令如下：

```
With the input and the inference results, the AI assistant needs to describe the process and results. The previous stages can be formed as - User Input: {{ User Input }}, Task Planning: {{ Tasks }}, Model Selection: {{ Model Assignment }}, Task Execution: {{ Predictions }}. You must first answer the user's request in a straightforward manner. Then describe the task process and show your analysis and model inference results to the user in the first person. If inference results contain a file path, must tell the user the complete file path.
```

**(4) 响应生成**：LLM 接收执行结果，向用户输出汇总结果。

要把 HuggingGPT 投入真实使用，还需解决几个挑战：(1) 需要提升效率，因为 LLM 推理轮次和与其他模型的交互都会拖慢流程；(2) 它依赖长上下文窗口来传递复杂任务内容；(3) LLM 输出和外部模型服务的稳定性有待提升。

**API-Bank**（Li et al. 2023）是评估工具增强型 LLM 表现的基准。它包含 53 个常用 API 工具、一套完整的工具增强 LLM 工作流，以及 264 段涉及 568 次 API 调用的标注对话。API 的选择相当多样：搜索引擎、计算器、日历查询、智能家居控制、日程管理、健康数据管理、账号认证流程等。由于 API 数量众多，LLM 先访问 API 搜索引擎找到要调用的 API，再阅读相应文档发起调用。

![API-Bank 调用流程伪代码](https://lilianweng.github.io/posts/2023-06-23-agent/api-bank-process.png)

*图：API-Bank 中 LLM 进行 API 调用的伪代码。（图片来源：Li et al. 2023）*

在 API-Bank 工作流中，LLM 需要做多个决策，每一步都可以评估决策的准确性。决策包括：

1. 是否需要调用 API。
2. 识别要调用的正确 API：若结果不够好，LLM 需要迭代修改 API 输入（例如为搜索引擎 API 决定搜索关键词）。
3. 基于 API 结果给出响应：若结果不满意，模型可以选择优化后再次调用。

该基准从三个层级评估 Agent 的工具使用能力：

- Level-1 评估*调用 API*的能力：给定某个 API 的描述，模型需要判断是否调用给定 API、正确调用它、并恰当地响应 API 返回。
- Level-2 考察*检索 API*的能力：模型需要搜索可能解决用户需求的 API，并通过阅读文档学会使用它们。
- Level-3 评估*在检索与调用之外规划 API*的能力：面对不够明确的用户请求（例如安排小组会议、为旅行预订机票/酒店/餐厅），模型可能需要规划多次 API 调用才能解决。

# 案例研究

## 科学发现 Agent

**ChemCrow**（Bran et al. 2023）是一个领域特定的例子：LLM 被 13 个专家设计的工具增强，用以完成有机合成、药物发现与材料设计等任务。其工作流用 LangChain 实现，体现了前文所述的 ReAct 与 MRKL 思想，把 CoT 推理与任务相关工具结合在一起：

- LLM 会获得一份工具名称列表、每个工具用途的描述，以及预期输入/输出的细节。
- 然后被指示在必要时使用这些工具来回答用户给出的提示。指令建议模型遵循 ReAct 格式：`Thought, Action, Action Input, Observation`。

一个有趣的观察是：基于 LLM 的评估认为 GPT-4 与 ChemCrow 表现几乎相当，但面向解法完整性与化学正确性的专家人工评估显示，ChemCrow 大幅领先 GPT-4。这表明用 LLM 来评估自己在需要深度专业知识的领域上的表现存在潜在问题：专业知识的缺乏可能让 LLM 意识不到自身的缺陷，从而无法正确判断任务结果的正确性。

Boiko et al.（2023）同样研究了面向科学发现的 LLM 智能体，让它们自主设计、规划并执行复杂的科学实验。该 Agent 能使用工具浏览互联网、阅读文档、执行代码、调用机器人实验 API 并利用其他 LLM。

例如，当被要求"开发一种新型抗癌药物"时，模型给出了如下推理步骤：

1. 查询抗癌药物发现的当前趋势；
2. 选择一个靶点；
3. 请求针对这些化合物的分子骨架；
4. 化合物确定后，模型尝试对其进行合成。

他们也讨论了风险，尤其是非法药物与生物武器。他们构造了一个包含已知化学毒剂清单的测试集，并要求 Agent 合成它们：11 个请求中有 4 个（36%）被接受并给出了合成方案，Agent 还试图查阅文档来执行流程；7 个被拒绝，其中 5 次发生在网络搜索之后，2 次仅基于提示词就被拒绝。

## 生成式智能体模拟（Generative Agents Simulation）

**Generative Agents**（Park et al. 2023）是个非常有趣的实验：25 个虚拟角色（每个都由 LLM 驱动的 Agent 控制）在一个类似《模拟人生》的沙盒环境中生活与互动。生成式智能体为交互式应用创造出可信的人类行为拟像。

生成式智能体的设计把 LLM 与记忆、规划和反思机制结合，使 Agent 能基于过去经验行动，并与其他 Agent 交互。

- **记忆流（Memory Stream）**：长期记忆模块（外部数据库），以自然语言完整记录 Agent 的经历列表。
  - 每个元素是一条*观察*（Observation），即 Agent 直接经历的事件；Agent 之间的通信也可以触发新的自然语言陈述。
- **检索（Retrieval）模型**：根据相关性、时近性与重要性，把上下文浮出水面以指导 Agent 行为。
  - 时近性（Recency）：越近的事件分数越高。
  - 重要性（Importance）：区分平凡记忆与核心记忆。直接让 LM 打分。
  - 相关性（Relevance）：与当前情境/查询的关联程度。
- **反思（Reflection）机制**：随时间把记忆合成为更高层的推断，指导 Agent 的未来行为。反思是*对过去事件的高层总结*（注意：这与上文[自我反思](#自我反思self-reflection)略有不同）。
  - 给 LM 最近的 100 条观察，让它针对这组观察/陈述生成 3 个最突出的高层问题，再让 LM 回答这些问题。
- **规划与反应（Planning & Reacting）**：把反思与环境信息转化为行动。
  - 规划本质上是权衡"当下的可信度"与"长期的可信度"。
  - 提示模板：`{Intro of an agent X}. Here is X's plan today in broad strokes: 1)`（"关于智能体 X 的简介。以下是 X 今天的大致计划：1)"）。
  - Agent 之间的关系、以及一个 Agent 对另一个 Agent 的观察，都会被纳入规划与反应的考量。
  - 环境信息以树状结构呈现。

![生成式智能体架构](https://lilianweng.github.io/posts/2023-06-23-agent/generative-agents.png)

*图：生成式智能体架构。（图片来源：Park et al. 2023）*

这个有趣的模拟产生了涌现的社会行为，例如信息扩散、关系记忆（例如两个 Agent 延续之前的话题）以及社会活动的协调（例如举办聚会并邀请很多人）。

## 概念验证示例

AutoGPT 把"用 LLM 作主控制器搭建自主智能体"的可能性带入了大众视野。受制于自然语言接口，它有相当多的可靠性问题，但仍是一个很酷的概念验证 demo。AutoGPT 的很多代码其实都在做输出格式解析。

下面是 AutoGPT 使用的系统消息，其中双大括号占位符是用户输入：

```
You are {{ai-name}}, {{user-provided AI bot description}}.
Your decisions must always be made independently without seeking user assistance. Play to your strengths as an LLM and pursue simple strategies with no legal complications.

GOALS:

1. {{user-provided goal 1}}
2. {{user-provided goal 2}}
3. ...
4. ...
5. ...

Constraints:
1. ~4000 word limit for short term memory. Your short term memory is short, so immediately save important information to files.
2. If you are unsure how you previously did something or want to recall past events, thinking about similar events will help you remember.
3. No user assistance
4. Exclusively use the commands listed in double quotes e.g. "command name"
5. Use subprocesses for commands that will not terminate within a few minutes

Commands:
1. Google Search: "google", args: "input": "<search>"
2. Browse Website: "browse_website", args: "url": "<url>", "question": "<what_you_want_to_find_on_website>"
3. Start GPT Agent: "start_agent", args: "name": "<name>", "task": "<short_task_desc>", "prompt": "<prompt>"
4. Message GPT Agent: "message_agent", args: "key": "<key>", "message": "<message>"
5. List GPT Agents: "list_agents", args:
6. Delete GPT Agent: "delete_agent", args: "key": "<key>"
7. Clone Repository: "clone_repository", args: "repository_url": "<url>", "clone_path": "<directory>"
8. Write to file: "write_to_file", args: "file": "<file>", "text": "<text>"
9. Read file: "read_file", args: "file": "<file>"
10. Append to file: "append_to_file", args: "file": "<file>", "text": "<text>"
11. Delete file: "delete_file", args: "key": "<key>"
12. Search Files: "search_files", args: "directory": "<directory>"
13. Analyze Code: "analyze_code", args: "code": "<full_code_string>"
14. Get Improved Code: "improve_code", args: "suggestions": "<list_of_suggestions>", "code": "<full_code_string>"
15. Write Tests: "write_tests", args: "code": "<full_code_string>", "focus": "<list_of_focus_areas>"
16. Execute Python File: "execute_python_file", args: "file": "<file>"
17. Generate Image: "generate_image", args: "prompt": "<prompt>"
18. Send Tweet: "send_tweet", args: "text": "<text>"
19. Do Nothing: "do_nothing", args:
20. Task Complete (Shutdown): "task_complete", args: "reason": "<reason>"

Resources:
1. Internet access for searches and information gathering.
2. Long Term memory management.
3. GPT-3.5 powered Agents for delegation of simple tasks.
4. File output.

Performance Evaluation:
1. Continuously review and analyze your actions to ensure you are performing to the best of your abilities.
2. Constructively self-criticize your big-picture behavior constantly.
3. Reflect on past decisions and strategies to refine your approach.
4. Every command has a cost, so be smart and efficient. Aim to complete tasks in the least number of steps.

You should only respond in JSON format as described below
Response Format:
{
    "thoughts": {
        "text": "thought",
        "reasoning": "reasoning",
        "plan": "- short bulleted\n- list that conveys\n- long-term plan",
        "criticism": "constructive self-criticism",
        "speak": "thoughts summary to say to user"
    },
    "command": {
        "name": "command name",
        "args": {
            "arg name": "value"
        }
    }
}
Ensure the response can be parsed by Python json.loads
```

GPT-Engineer 是另一个项目：给定用自然语言描述的任务，生成一整个代码仓库。GPT-Engineer 被指示先思考需要构建的较小组件列表，并在需要时向用户提问澄清。

下面是 GPT-Engineer 发送到 OpenAI Chat Completion 端点的任务澄清对话示例。用户输入用双大括号占位符（user input text）包裹：

```
[
  {
    "role": "system",
    "content": "You will read instructions and not carry them out, only seek to clarify them.\nSpecifically you will first summarise a list of super short bullets of areas that need clarification.\nThen you will pick one clarifying question, and wait for an answer from the user.\n"
  },
  {
    "role": "user",
    "content": "We are writing {{a Super Mario game in python. MVC components split in separate files. Keyboard control.}}\n"
  },
  {
    "role": "assistant",
    "content": "Summary of areas that need clarification:\n1. Specifics of the Super Mario game (e.g. level design, characters, gameplay mechanics)\n2. Details about the MVC components (e.g. which components are in each file)\n3. Keyboard control implementation (e.g. which keys to use, how to handle input)\n\nClarifying question:\nCan you provide more details about the Super Mario game, such as level design, characters, and gameplay mechanics?"
  },
  {
    "role": "user",
    "content": "{{There are 10 levels in total. The main character is a plumber named Mario, who can walk and jump. It is a classical platform game just like Super Mario. The main character moves from left to right, trying to get to the destination, where there are many obstacles and attacks from enemies in the process.}}\n\nIs anything else unclear? If yes, only answer in the form:\n{remaining unclear areas} remaining questions.\n{Next question}\nIf everything is sufficiently clear, only answer \"Nothing more to clarify.\"."
  },
  {
    "role": "assistant",
    "content": "Remaining unclear areas: 2 remaining questions.\nCan you provide more information about how the MVC components are split into separate files?"
  },
  {
    "role": "user",
    "content": "{{Make your own assumptions and state them explicitly before starting}}"
  }
]
```

澄清完成后，该智能体会切换到代码编写模式，使用另一条系统消息：

> 你将收到要编写代码的指令。你会给出非常长的回答。请确保架构的每个细节最终都以代码实现。请一步一步思考并自行推理出正确的决策，确保我们把事情做对。你首先要列出必需的核心类、函数、方法的名称，并附上一句说明其用途的注释。然后你要输出每个文件的内容，包含全部代码。每个文件必须严格遵循如下 Markdown 代码块格式，其中 FILENAME 替换为带扩展名的小写文件名，LANG 替换为代码语言的标记，CODE 替换为代码。
>
> 你要从"入口（entrypoint）"文件开始，然后是它导入的文件，依此类推。请注意代码必须是完全可运行的，不能有占位符。遵循对应语言与框架的最佳实践命名约定。确保文件包含所有 import、类型等。确保不同文件间的代码互相兼容。必须实现全部代码；如果不确定，写一个合理的实现。附上模块依赖或包管理器依赖定义文件。结束前，请再次检查架构的所有部分是否都已在文件中。
>
> 有用须知：你几乎总是把不同的类放进不同的文件。对 Python，你总是创建合适的 requirements.txt；对 NodeJS，总是创建合适的 package.json。你总是为函数定义加一句简短注释说明用途；对特别复杂的逻辑补充解释性注释。你总是遵循所请求语言描述代码/项目的最佳实践。
>
> Python 工具箱偏好：pytest、dataclasses。

对话示例如下：

```
[
  {
    "role": "system",
    "content": "You will get instructions for code to write.\nYou will write a very long answer. Make sure that every detail of the architecture, in the end, is implemented as code.\n\nThink step by step and reason yourself to the right decisions to make sure we get it right.\nYou will first lay out the names of the core classes, functions, methods that will be necessary, as well as a quick comment on their purpose.\n\nThen you will output the content of each file including ALL code.\nEach file must strictly follow a markdown code block format:\nFILENAME\n```LANG\nCODE\n```\n\nYou will start with the \"entrypoint\" file, then go to the ones that are imported by that file, and so on.\nPlease note that the code should be fully functional. No placeholders.\n\nPython toolbelt preferences:\n- pytest\n- dataclasses\n"
  },
  #  ……对话与前面的澄清环节相同，以 "Make your own assumptions and state them explicitly before starting" 结束。
  {
    "role": "assistant",
    "content": "Assumptions:\n1. Model: The model will contain the game's data, such as level information, character states, and enemy positions.\n2. View: The view will handle the game's visuals, including rendering the game objects, backgrounds, and updating the display.\n3. Controller: The controller will manage user input, such as keyboard controls, and update the model accordingly.\n\nWith these assumptions in mind, is there any specific aspect of the keyboard control implementation you would like me to clarify?"
  },
  {
    "role": "user",
    "content": "Please now remember the steps:\n\nThink step by step and reason yourself to the right decisions to make sure we get it right.\nFirst lay out the names of the core classes, functions, methods that will be necessary, as well as a quick comment on their purpose.\n\nThen you will output the content of each file including ALL code.\nEach file must strictly follow a markdown code block format.\n\nPlease note that the code should be fully functional. No placeholders.\n\nYou will start with the \"entrypoint\" file, then go to the ones that are imported by that file, and so on.\nFollow a language and framework appropriate best practice file naming convention.\nMake sure that files contain all imports, types etc. The code should be fully functional. Make sure that code in different files are compatible with each other.\nBefore you finish, double check that all parts of the architecture is present in the files.\n"
  }
]
```

# 挑战

在梳理了构建以 LLM 为中心智能体的关键思路与 demo 之后，我发现了几个常见的局限：

- **上下文长度有限**：受限的上下文容量限制了历史信息、详细指令、API 调用上下文与响应的容纳量。系统设计必须适应这一有限的"通信带宽"；而自我反思这类从过去错误中学习的机制，若拥有长甚至无限的上下文窗口会受益良多。尽管向量存储与检索可以提供更大的知识池，但其表征能力仍不及完整注意力（Full Attention）。

- **长程规划与任务分解的挑战**：在漫长历史之上做规划、并有效探索解空间依然困难。LLM 面对意外错误时难以调整计划，与能够从试错中学习的人类相比健壮性不足。

- **自然语言接口的可靠性**：当前 Agent 系统依赖自然语言作为 LLM 与外部组件（如记忆和工具）之间的接口。但模型输出的可靠性存疑：LLM 可能出现格式错误，偶尔还会"叛逆"（例如拒绝执行指令）。因此大量 Agent demo 代码都在解析模型输出。

# 引用

引用格式：

> Weng, Lilian. (Jun 2023). "LLM-powered Autonomous Agents". Lil'Log. https://lilianweng.github.io/posts/2023-06-23-agent/

```
@article{weng2023agent,
  title   = "LLM-powered Autonomous Agents",
  author  = "Weng, Lilian",
  journal = "lilianweng.github.io",
  year    = "2023",
  month   = "Jun",
  url     = "https://lilianweng.github.io/posts/2023-06-23-agent/"
}
```

---

> **来源**：本文翻译自 [LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)，作者 Lilian Weng，许可 CC BY-NC 4.0。抓取于 2026-09-13。

---

> **编者注**：本文写于 2023 年 6 月，是智能体（Agent）领域公认的概念奠基之作。文中提出的"规划 + 记忆 + 工具使用"三大组件框架至今仍是理解 Agent 的最佳起点。文中提到的 AutoGPT、ChatGPT Plugins 等产品如今多已演进或停服，属于历史脉络；核心概念部分（ReAct、Reflexion、记忆分层、MIPS 检索）并未过时，本模块后续文章将按 2025-2026 年的最新工具链（LangGraph、MCP、OpenAI Agents SDK 等）逐一展开。
