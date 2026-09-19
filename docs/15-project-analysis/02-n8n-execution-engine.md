---
title: n8n 执行引擎源码解析——任务运行器与节点式自动化
source_url: https://github.com/n8n-io/n8n
author: n8n.io
license: Sustainable Use License（本文为教学性源码分析，代码片段少量引用）
fetched_at: 2026-09-13
translated: false
order: 2
---
本文是「优质项目源码分析」模块第 2 篇：我们 clone 了 n8n 官方仓库（`n8n-io/n8n`，main 分支，commit `8bff5da5`），精读它最核心的组件——执行引擎，回答四个问题：一张节点图如何被调度执行、items（数据条目）如何在节点间流动与汇合、节点生命周期由谁驱动、用户的 Code 节点脚本为什么要在独立进程里跑。文中代码片段均逐字引自该 commit 的原始文件并标注 monorepo 相对路径，省略处以 `…` 标示。

# 一、项目定位：n8n 是什么，为什么值得读

n8n（★204K）是节点式工作流自动化平台：画布上拖拽节点、连线成图，数百个内置集成节点连接各类 SaaS、数据库与 AI 模型，触发器拉起执行、数据逐节点变换。执行在这里是一等公民：每次运行的完整输入输出、每个节点的耗时与报错都被记录成可回放的执行历史，失败可从出错节点单独重跑。与 Dify 面向「LLM 应用编排」不同，n8n 的主战场是自动化流水线——Webhook 触发、定时轮询、失败重试、错误分支、人工审批挂起。这塑造了它执行引擎的独特气质：**不是并行图调度器，而是一个确定性的线性执行栈**。

值得读的理由有三。其一，它是 TypeScript 写执行引擎的标杆：执行状态全部是 JSON 可序列化的纯数据，「暂停、恢复、从中间节点重跑、执行历史回放」都被化归为数据问题。其二，它的任务运行器（Task Runner）架构是「如何安全执行不可信用户代码」的完整工程范本，从进程隔离到协议设计一应俱全。其三，它的执行顺序语义（`executionOrder: v0/v1`）演示了一个实现细节如何被逐步升级为用户可依赖的产品承诺。

一个前提说明：n8n 采用 Sustainable Use License——源码公开、允许内部业务使用，但禁止将其包装成产品再分发；仓库中 `.ee.` 后缀的文件属企业版许可，本文不涉及。以下分析均为教学性少量引用。

# 二、整体架构：monorepo 导览

n8n 是 pnpm monorepo，与执行直接相关的包有五个（路径均相对仓库根）：

| 包 | 职责 |
| --- | --- |
| `packages/workflow/` | 领域模型（npm 包名 n8n-workflow）：`Workflow` 类、双向连接索引、表达式求值、`INodeExecutionData` 等核心类型；零执行依赖，前端编辑器也复用它 |
| `packages/core/` | 执行引擎本体：`src/execution-engine/workflow-execute.ts`（约 3200 行的 `WorkflowExecute` 主类）、`node-execution-context/`（各类节点执行上下文）、`requests-response.ts`（挂起-恢复协议） |
| `packages/cli/` | 主进程装配：HTTP API、`src/workflow-runner.ts` 执行调度，以及任务运行器主进程侧的 `src/task-runners/`（task-broker 经纪人、子进程管理、OOM 检测） |
| `packages/@n8n/task-runner/` | 任务运行器独立进程：`src/task-runner.ts`（broker 协议与 offer 机制）、`src/js-task-runner/`（JS 沙箱硬化）；姊妹包 `task-runner-python` 提供 Python 版 |
| `packages/nodes-base/` | 全部内置节点实现，每个节点导出 `execute(context)` 方法 |

分层的意图很清楚：`packages/workflow` 是纯领域层，只回答「图长什么样」；`packages/core` 知道「怎么执行」但不知道「谁来触发」；`packages/cli` 把引擎、数据库、API、任务运行器装配成完整主进程；任务运行器则被刻意推到进程边界之外。另外值得注意 `packages/@n8n/engine/`，其 package.json 自述为「n8n workflow execution engine (v2)」——官方正把执行引擎从单体中抽出，做成可独立部署的服务，这说明引擎边界在当前代码里已经被刻意收得很干净。

# 三、两个基础模型：图与 item

## 3.1 图：一对反向连接索引

工作流 JSON 里 `connections` 只记录「从谁出发」，`Workflow` 类在构造时把它整理成一正一反两个索引（`packages/workflow/src/workflow.ts`）：

```ts
	nodes: INodes = {};

	connectionsBySourceNode: IConnections = {};

	connectionsByDestinationNode: IConnections = {};
	…
	setConnections(connections: IConnections) {
		this.connectionsBySourceNode = connections;
		this.connectionsByDestinationNode = mapConnectionsByDestination(this.connectionsBySourceNode);
	}
```

正向索引用于「执行完 A，找 A 的所有后继」；反向索引用于「B 有几条输入连线、数据是否到齐」——后文的汇合逻辑完全建立在它之上。节点本身存进 `nodes` 字典，按键名取用，所以 n8n 图结构是**以节点名为键的邻接表**，而非邻接矩阵或边列表。

## 3.2 item：数据流动的原子

节点间传递的数据是 `INodeExecutionData` 数组，每个 item 就是「一行数据」（`packages/workflow/src/interfaces.ts`）：

```ts
export interface INodeExecutionData {
	[key: string]:
		| IDataObject
		| IBinaryKeyData
		| INodeExecutionRedactionInfo
		| IPairedItemData
		| IPairedItemData[]
		| NodeApiError
		| NodeOperationError
		| number
		| string
		| undefined;
	/**
	 * JSON output.
	 * In `continueErrorOutput` mode, engine will try to read item.error or fallback to item.json.error with allowed optional keys: message, details.
	 */
	json: IDataObject;
	binary?: IBinaryKeyData;
	error?: NodeApiError | NodeOperationError;
	pairedItem?: IPairedItemData | IPairedItemData[] | number;
	…
}
```

三个字段值得记住：`json` 是主体业务数据；`binary` 挂文件等二进制内容；`pairedItem` 是**血缘指针**——声明「这个输出 item 来自上游第几个输入 item」。它是 n8n 调试体验（点一个输出高亮对应输入）的数据基础，也是与 Dify「全局变量池」模型的本质差异：n8n 不维护可被任意节点按名引用的变量空间，数据只能沿连线**推送**。

## 3.3 参数：加载时补默认值，执行时惰性求值

节点参数的解析分两步。第一步在图加载时：`Workflow` 构造函数遍历节点，用 `NodeHelpers.getNodeParameters(节点类型声明的 properties, 节点参数, …)` 把类型声明里的默认值补齐——用户没填的参数此刻就有了确定值。第二步是求值：参数里的表达式（n8n 语法是用双花括号包裹的表达式）并不在加载时解析，而是推迟到节点真正执行时，由 `workflow.expression.getParameterValue(...)` 拿着 runData、上游 connectionInputData、mode 等完整上下文逐参数求值。所以同一个节点被循环执行多轮时，每轮参数都可以引用「当前这一条 item」。「加载时归一化、执行时惰性求值」的分工，是引擎必须把大量上下文一路传进执行上下文（Context）的根本原因。

## 3.4 挂起：EngineRequest 协议

Agent 工具调用、人工审批这类「执行到一半要等外部回来」的场景，n8n 用一个类型表达（`packages/workflow/src/interfaces.ts`）：

```ts
export type EngineRequest<T = object> = {
	/** Array of actions that the requesting node wants the engine to fulfill */
	actions: Array<EngineAction<T>>;
	/** Metadata associated with this request */
	metadata: T;
};
```

节点可以返回「数据」，也可以返回「请求」。返回请求意味着主循环要重新排列执行栈、把控制权交出去，等响应回来再恢复——「暂停」被建模为请求-响应协议，而不是异常或新线程。

# 四、一次工作流执行的完整链路

以一次手动「Execute Workflow」为例（触发器执行只是入口不同，主循环完全一致）：

```text
1. 主进程收到执行请求
   packages/cli/src/workflow-runner.ts   WorkflowRunner
      └─ new WorkflowExecute(additionalData, mode, runExecutionData).run({ workflow, startNode, … })
2. 引擎入口（下种子）
   packages/core/src/execution-engine/workflow-execute.ts
      run() → 起始节点 + 一个空 item 压入 nodeExecutionStack → processRunExecutionData()
3. 主循环（单线程 while，一次处理一个节点）
      popExecutionStack()       取出栈顶（shift，先进先出）
      addPairedItemLineage()    执行前补全 item 血缘
      runNode() → executeNode() → nodeType.execute(context)
      processNodeOutput() → upsertTaskData()   结果写入 resultData.runData
      addNodeToBeExecuted()     后继节点连数据入栈（多输入未到齐则先进 waitingExecution）
4. 挂起场景
      EngineRequest → handleEngineRequest() 重排栈，等外部响应回来恢复
      waitTill   → 执行持久化挂起，到点唤醒后从栈顶继续
5. 用户代码（Code 节点）
      packages/cli/src/task-runners/task-broker/   主进程侧经纪人（WebSocket 服务）
      packages/@n8n/task-runner                    独立进程，连回 broker 领任务
6. 收尾
      栈空 → resolve(IRun)，resultData.runData 里是全部节点执行记录
```

三个全局观察先记下，精读时会反复呼应。**第一，引擎状态全部挂在 `IRunExecutionData` 上**：待执行栈（`nodeExecutionStack`）、等待汇合的数据（`waitingExecution`）、执行结果（`resultData.runData`）、挂起时间点（`waitTill`）都是纯数据对象，因此「换个进程把它加载回来从栈顶继续」就是全部的恢复机制。**第二，执行是单线程线性循环**：主循环一次只跑一个节点，并行分支在模型上是「两条队列轮流走」，天然免掉并发写执行数据的全部烦恼。**第三，与节点的接口是 Context 对象**：节点实现的 `execute(context)` 拿到的 `IExecuteFunctions` 是引擎递进来的能力集合（取凭证、取上游数据、发辅助请求），节点自身不持有任何引擎引用。

主循环内还藏着三类横切机制，都不需要节点感知：**重试**——`getRetryParams()` 给出最大尝试次数与重试间隔，节点抛错或输出里带 `error` 字段都会触发；**钉选输出（pinData）**——调试时把某个节点的输出「钉」住，主循环发现钉选数据就直接跳过真实执行；**错误路由**——节点异常被 `reportNodeExecutionError` 归一为 `ExecutionBaseError`，再按节点配置走「停止执行」「继续走错误输出分支」「忽略」三种出路。执行策略与业务逻辑的分离，就体现在这些机制全部住在循环里而不是节点里。

# 五、核心代码精读

## 5.1 WorkflowExecute.run()：给执行栈「下种子」

引擎入口只做一件事：确定起始节点，把它的初始执行数据压进栈，然后进入主循环（`packages/core/src/execution-engine/workflow-execute.ts`，下同）：

```ts
	// IMPORTANT: Do not add "async" to this function, it will then convert the
	//            PCancelable to a regular Promise and does so not allow canceling
	//            active executions anymore
	// eslint-disable-next-line @typescript-eslint/promise-function-async
	run({
		workflow,
		startNode,
		destinationNode,
		pinData,
		triggerToStartFrom,
		additionalRunFilterNodes,
	}: RunWorkflowOptions): PCancelable<IRun> {
		this.status = 'running';

		// Get the nodes to start workflow execution from
		startNode = startNode || workflow.getStartNode(destinationNode?.nodeName);

		if (startNode === undefined) {
			throw new UserError('No node to start the workflow from could be found');
		}
		…
		// Initialize the data of the start nodes
		const nodeExecutionStack: IExecuteData[] = [
			{
				node: startNode,
				data: triggerToStartFrom?.data?.data ?? {
					main: [
						[
							{
								json: {},
							},
						],
					],
				},
				source: null,
			},
		];
		…
		return this.processRunExecutionData(workflow);
	}
```

两个细节。其一，起始节点的初始数据是一个空 item（`json: {}`）——在 n8n 的世界里「没有数据」也要表示成「一个空对象组成的数组」，这让所有节点共享同一套 items-in / items-out 心智模型。其二，头注释郑重警告**不要给这个函数加 `async`**：一旦加上，返回值退化为普通 Promise，`PCancelable` 的取消能力就丢了，用户点「停止执行」将无法即时中断。把可取消性写进类型签名与代码规约，是并发工程里少见的严谨。

## 5.2 processRunExecutionData：一条 while 循环走完整张图

主循环是引擎的心脏（省去日志与遥测）：

```ts
			const returnPromise = (async () => {
				await this.initializeExecution(workflow, hooks);

				executionLoop: while (this.isExecutionStackNotEmpty()) {
					if (this.shouldStopExecuting()) {
						return;
					}
					…
					executionData = this.popExecutionStack();
					executionNode = executionData.node;
					…
					// Update the pairedItem information on items
					executionData.data = this.addPairedItemLineage(executionData);

					runIndex = this.computeRunIndex(executionData);

					currentExecutionTry = `${executionNode.name}:${runIndex}`;
					if (currentExecutionTry === lastExecutionTry) {
						throw new UserError('Stopped execution because it seems to be in an endless loop');
					}
```

几个点值得展开。`popExecutionStack()` 的实现只有一行——`nodeExecutionStack.shift()`，从栈头取；配合后文入栈时 `push` / `unshift` 之别，就是 n8n 两代执行顺序（v0/v1）的全部秘密。`ensureInputData()` 是空输入守卫：上游输出为空时不再推进该分支，直接进入下一轮循环。`currentExecutionTry === lastExecutionTry` 的死循环哨兵朴素而有效：同一个节点、同一个运行轮次连续出现两次，直接判死——因为 Loop Over Items 这类节点会把自己反复压回栈，正常的重复必须伴随 `runIndex` 递增。`addPairedItemLineage()` 在每个节点执行前统一补全 item 的 `pairedItem` 血缘，让任何输出 item 都能回答「我来自哪个上游输入」。

节点返回值也可能是一个 `EngineRequest`，此时主循环把控制权交给 `handleEngineRequest()` 并 `continue` 跳出本轮：

```ts
								// if runNodeData is Request
								if (isEngineRequest(runNodeData)) {
									this.handleEngineRequest({
										workflow,
										currentNode: executionNode,
										request: runNodeData,
										runIndex,
										executionData,
										runData: this.runExecutionData.resultData.runData,
									});

									continue executionLoop;
								}
```

挂起-恢复因此完全不需要为每种场景写特例：Agent 工具调用、等待人工输入、等待 Webhook 回调，走的都是同一条「请求入队、响应唤醒」路径。

## 5.3 runNode 与 executeNode：节点生命周期与 Context 注入

`runNode()` 先做一段按能力分发，再进入 `executeNode()`。分发逻辑读起来非常直白：

```ts
		if (nodeType.poll) {
			return await this.executePollNode(workflow, node, nodeType, additionalData, mode, inputData);
		}

		if (nodeType.trigger) {
			return await this.executeTriggerNode(
				workflow,
				node,
				additionalData,
				mode,
				inputData,
				abortSignal,
			);
		}

		if (nodeType.supplyData) {
			throw new UnexpectedError(
				`The node "${node.type}" has a "supplyData" method but no "execute" method.`,
			);
		}

		const isDeclarativeNode = nodeType.description.requestDefaults !== undefined;
		if (nodeType.webhook && !isDeclarativeNode) {
			// Check if the node have requestDefaults(Declarative Node),
			// else for webhook nodes always simply pass the data through
			// as webhook method would be called by WebhookService
			return { data: inputData.main as INodeExecutionData[][] };
		}
```

有 `execute` 走常规执行，`poll` 是轮询触发，`trigger` 是事件触发，webhook 节点（非声明式）直接透传数据，带 `requestDefaults` 的声明式节点走通用 HTTP 管线——一套引擎兼容四代节点 API，靠的是「方法是否存在」而不是节点类型枚举。这是插件系统演进的常见正解：新 API 形态可以不断增加，旧节点永远能跑。

`executeNode()` 负责构造 Context 并调用节点：

```ts
		const closeFunctions: CloseFunction[] = [];
		const context = new ExecuteContext(
			workflow,
			node,
			additionalData,
			mode,
			runExecutionData,
			runIndex,
			connectionInputData,
			inputData,
			executionData,
			closeFunctions,
			abortSignal,
			subNodeExecutionResults,
		);
		…
			if (customOperation) {
				data = await customOperation.call(context);
			} else if (nodeType.execute) {
				data = isNodeClassInstance(nodeType)
					? await nodeType.execute(context, subNodeExecutionResults)
					: await nodeType.execute.call(context, subNodeExecutionResults);
			}
		…
		} finally {
			if (closeFunctions.length > 0) {
				const closeFunctionsResults = await Promise.allSettled(
					closeFunctions.map(async (fn) => await fn()),
				);

				// Only throw close function errors if the execution itself succeeded,
				// to avoid masking the original execution error.
```

`ExecuteContext`（`node-execution-context/execute-context.ts`）实现了庞大的 `IExecuteFunctions` 接口：节点取凭证调 `context.getCredentials()`，上游数据就是构造时注入的 `connectionInputData`，想注册清理回调就往 `closeFunctions` 里塞函数。注意 `finally` 里的处理：清理函数用 `Promise.allSettled` 收敛，且注释明确写着**只有执行本身成功时才上抛清理错误**——失败路径上的错误不该被清理噪音掩盖，这是错误处理的细节功力。节点生命周期里没有魔法钩子，「执行前 / 执行后」事件由外层循环的 `hooks.runHook('nodeExecuteBefore' / 'nodeExecuteAfter')` 统一广播，持久化与前端进度条都是这些钩子的订阅者。

## 5.4 addNodeToBeExecuted：多输入汇合与 v0/v1 执行顺序

节点成功后，引擎遍历正向连接索引，把每个有数据到达的输出所连接的后继交给 `addNodeToBeExecuted()`。它要解决自动化平台最经典的问题：**下游节点有多条输入连线时，必须等所有输入到齐才能执行**：

```ts
		let stillDataMissing = false;
		const enqueueFn = workflow.settings.executionOrder === 'v1' ? 'unshift' : 'push';
		let waitingNodeIndex: number | undefined;

		// Check if node has multiple inputs as then we have to wait for all input data
		// to be present before we can add it to the node-execution-stack
		…
		// Add the data of the current execution
		if (nodeSuccessData === null) {
			connectionDataArray[connectionData.index] = null;
		} else {
			connectionDataArray[connectionData.index] = nodeSuccessData[outputIndex];
		}
```

数据传递的谜底在这里：后继节点拿到的不是引用共享的「变量池」，而是引擎为它**逐输入拼装**的 `connectionDataArray`——第 N 条输入连线的数据写入数组第 N 位；没到的输入先在 `waitingExecution` 里占位为 `null`，引擎用反向索引数出该节点共有几条输入，逐一核对。等最后一条输入到达，节点才真正入栈：

```ts
		if (stillDataMissing) {
			waitingNodeIndex = waitingNodeIndex!;
			…
		} else if (workflow.nodes[connectionData.node]) {
			// All data is there so add it directly to stack
			this.runExecutionData.executionData!.nodeExecutionStack[enqueueFn]({
				node: workflow.nodes[connectionData.node],
				data: {
					main: connectionDataArray,
				},
				source: {
					main: [
						{
							previousNode: parentNodeName,
							previousNodeOutput: outputIndex ?? undefined,
							previousNodeRun: runIndex ?? undefined,
						},
					],
				},
				runIndex: newRunIndex,
				metadata,
			});
		}
	}
```

入栈的每个条目都带着 `source` 血缘（上游节点名、输出序号、运行轮次），所以执行历史里每个节点都能回答「我的输入来自哪次执行」。`enqueueFn` 那一行则定义了多分支的顺序语义：旧版 v0 用 `push`（配合 `shift` 是先进先出，分支顺序取决于连线顺序）；新版 v1 用 `unshift`（后进先出），配合主循环中按画布位置排序入栈（源码注释原话：「Always execute the node that is more to the top-left first」），保证多分支时**画布左上的分支先执行完再走右下**。执行顺序从「实现细节」升级为「用户可在设置里选择并依赖的语义」，是引擎演进非常典型的一课。

## 5.5 任务运行器：把用户代码请出主进程

Code 节点允许用户写任意 JS/Python，这在 SaaS 化部署里是最大的安全面。n8n 的解法是任务运行器：主进程侧用 `spawn` 拉起独立 Node 子进程（`packages/cli/src/task-runners/task-runner-process-js.ts`）：

```ts
	startProcess(grantToken: string, taskBrokerUri: string, runnerId: string): ChildProcess {
		const startScript = require.resolve('@n8n/task-runner/start');
		const flags = this.runnerConfig.insecureMode
			? []
			: ['--disallow-code-generation-from-strings', '--disable-proto=delete'];

		return spawn('node', [...flags, startScript], {
			env: this.getProcessEnvVars(grantToken, taskBrokerUri, runnerId),
		});
	}
```

注意两个 Node 启动旗标：`--disallow-code-generation-from-strings` 禁掉运行时 `eval` 与 `new Function`，`--disable-proto=delete` 切断原型链污染的经典入口——**进程级硬化比在沙箱库里逐个堵洞可靠**。子进程内还有第二层防御：`js-task-runner/prototype-hardening.ts` 会冻结 `EventEmitter` 等内部对象的原型方法，防止用户脚本覆写 `process.emit` 逃逸。子进程随后通过 WebSocket 连回主进程的 Task Broker，凭 `grantToken` 鉴权，注册成功后进入「揽活」模式（`packages/@n8n/task-runner/src/task-runner.ts`）：

```ts
	private startTaskOffers() {
		this.canSendOffers = true;
		if (this.offerInterval) {
			clearInterval(this.offerInterval);
		}
		this.offerInterval = setInterval(() => this.sendOffers(), 250);
	}
	…
	sendOffers() {
		this.deleteStaleOffers();

		if (!this.canSendOffers) {
			return;
		}

		const offersToSend = this.maxConcurrency - (this.openOffers.size + this.runningTasks.size);

		for (let i = 0; i < offersToSend; i++) {
			// Add a bit of randomness so that not all offers expire at the same time
			const validForInMs = OFFER_VALID_TIME_MS + randomInt(500);
```

运行器每 250ms 向 broker 广播一批带时效的 offer（「我有空，还能接 N 个任务」），broker 把 offer 派给等待执行的任务；任务运行期间，用户代码对凭证、上游数据的每次访问都通过 request/response RPC 回主进程取数——**数据不预拷贝给运行器，能力按需授予**。运行器崩溃（主进程连 OOM 检测都有，见 `node-process-oom-detector.ts`）只损失当前任务，重启一个新运行器即可。部署上它分两种模式：上面这种由主进程自己 `spawn` 的是 internal 模式，类注释直言「NOT recommended for production」；生产推荐 external 模式——运行器作为独立部署单元连到 broker，牺牲零部署成本换更强的隔离与独立扩缩容。与 Dify 的容器级沙箱相比这是另一种取舍：粒度更细、部署更轻，隔离强度也弱一档；但两个项目不约而同的结论一致——**用户代码永不进主进程**。

# 六、设计思想总结

1. **线性执行栈是一种美德。** n8n 没有并行图调度，靠「栈 + 汇合等待 + 位置排序」覆盖了分支、循环、多输入，换来完全确定的顺序语义与零并发缺陷。除非业务真的需要并行吞吐，先做线性模型是对的一半。

2. **执行数据扁平化且可序列化。** `runData[节点名][runIndex]` 记录每次执行、`nodeExecutionStack` / `waitingExecution` 是待办与在途、`waitTill` 表示挂起——全部是 JSON 友好的纯数据。暂停恢复、部分重跑、历史回放因此都是「换个地方继续跑同一个数据结构」，官方把引擎抽成可独立部署的 v2 服务（`packages/@n8n/engine/`）也得益于这条边界。

3. **item 模型与血缘追踪。** `INodeExecutionData.pairedItem` 让每条输出可回溯输入，`addPairedItemLineage` 在执行前统一补全。做数据流水线值得照抄这个字段——它是调试体验的根基。与 Dify 的对照也在此：n8n 是「items 推送 + 逐输入拼装」，Dify 是「全局变量池 + selector 拉取」，前者适配数据逐站变换的自动化，后者适配随处引用上游的 LLM 应用。

4. **隔离用户代码：进程边界 + 能力收缩。** 启动旗标硬化、原型冻结、offer 轮询、grantToken 鉴权、RPC 按需取数、OOM 检测，n8n 给出了「不信任用户代码」的完整工程清单。

5. **把挂起建模为协议而不是异常。** `EngineRequest` 让 Agent 工具调用、人工审批、等待 Webhook 共用一条「请求-恢复」路径，主循环不为任何一种暂停写特例。与之配套的是「执行前 / 执行后」钩子：持久化、进度上报都订阅同一组事件，引擎核心因此可以对存储与前端保持无感。

6. **许可即商业模式。** Sustainable Use License 保住源码可得与生态繁荣，同时禁止「拿去做竞品」；企业版功能以 `.ee.` 文件隔离在同一仓库内。对「开源核心 + 商业增值」的产品，这是一种值得研究的许可形态。

---

> **来源**：本文基于 [n8n](https://github.com/n8n-io/n8n) 开源源码（Sustainable Use License）撰写教学性源码分析，代码片段少量引用，版权归项目方。分析视角为本站编者。
