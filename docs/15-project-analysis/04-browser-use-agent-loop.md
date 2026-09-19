---
title: browser-use 源码解析：浏览器 Agent 的控制循环与 DOM 提取
source_url: https://github.com/browser-use/browser-use
author: browser-use（Gregor Zunic 及社区）· 本站编者源码分析
license: MIT
fetched_at: 2026-09-13
translated: false
order: 4
---
browser-use 是当前最热门的浏览器 Agent 框架（约 115K 星，本文分析基于 2026-09-13 clone 的 main 分支，版本 v0.13.10，MIT 许可）。它的用法只有几行：把一句自然语言任务交给 `Agent`，它就会自己开浏览器、看页面、点按钮、填表单，直到任务完成。但"会看、会点"四个字背后是两套精心设计的系统：**把任意网页压缩成 LLM 可读文本的 DOM 提取管线**，以及**围绕这套文本组织感知-决策-行动的 Agent 控制循环**。本文拆解这两套系统的核心实现，所有代码片段均引自仓库原文并标注相对路径。

## 一、项目定位与一个重要的事实修正

browser-use 定位是"让 AI 操控浏览器"的通用层：往下对接真实浏览器（本地 Chrome 或远程 CDP 端点），往上把"页面状态 + 动作清单"交给任意 LangChain 风格的 LLM，再把 LLM 的结构化输出翻译成浏览器操作。

一个必须先澄清的事实：网上大量教程（甚至仓库历史文档）都说它"基于 Playwright"，但当前版本的 `browser_use/browser/` 里**已经没有 Playwright 依赖**——`pyproject.toml` 中的浏览器通信依赖是 `cdp-use==1.4.5`，`session.py` 直接 `from cdp_use import CDPClient`，通过 Chrome DevTools Protocol 与浏览器对话；`browser/profile.py` 里仅存的 "Playwright" 字样只是注释，说明默认启动参数抄了 Playwright 的 Chromium flags。本文按当前代码为准。这次迁移的动机藏在代码注释与架构里：DOM 快照、多标签页管理、watchdog 事件体系都需要细粒度 CDP 控制，套一层 Playwright 反而碍事。

## 二、整体架构：五个子系统

| 子系统 | 目录 | 职责 |
|---|---|---|
| Agent | `browser_use/agent/service.py` | 主循环：感知 → LLM 决策 → 行动 → 历史压缩 |
| DOM 服务 | `browser_use/dom/` | CDP 抓取三棵树 → 过滤 → 序列化为 LLM 文本 + 元素索引 |
| 浏览器会话 | `browser_use/browser/` | CDP 连接、多标签页（`session_manager.py`）、截图/下载/验证码等 watchdog |
| 动作系统 | `browser_use/tools/` | `@action` 注册表、参数 Pydantic 化、动作执行与超时 |
| 消息管理 | `browser_use/agent/message_manager/` | 把浏览器状态、历史动作结果组装成消息，并周期性摘要压缩 |

一次 `Agent.run()` 的时序大致是：初始化 `BrowserSession`（CDP 连接 + watchdog 挂载）→ 循环调用 `step()` 直到 `done` 动作或步数耗尽 → 产出 `AgentHistoryList`。下面先进入这个循环。

浏览器会话层的组织方式也值得先交代一笔：`BrowserSession` 并不直接写业务逻辑，而是把"截图、下载、弹窗、验证码、DOM 抓取、存储状态"等横切关注点拆给十来个**watchdog**（`attach_all_watchdogs()` 里逐个挂载：`ScreenshotWatchdog`、`DownloadsWatchdog`、`PopupsWatchdog`、`CaptchaWatchdog`、`DOMWatchdog`、`StorageStateWatchdog` 等），通过事件总线（`event_bus.dispatch(...)`）异步协作。前文 `get_browser_state_summary` 里"dispatch 一个 `BrowserStateRequestEvent` 再等结果"的写法就是这套体系的入口——DOM 抓取的实际执行者是 `DOMWatchdog`，它内部才调用 `DomService`。理解了这一点，后面看到的所有"会话方法"都能找到真正的责任人。

## 三、Agent 循环详解：一个 step 的四阶段

### 3.1 精读：step() 的骨架

`browser_use/agent/service.py` 里 `Agent` 类有 4000 余行，但主循环 `step()` 意外地短——它只是把一个 step 分成三个 Phase 加一个统一出口：

```python
# browser_use/agent/service.py
			# Phase 1: Prepare context and timing
			browser_state_summary = await self._prepare_context(step_info)

			# Clear previous step state after context preparation (which needs
			# them for the "previous action result" prompt) but before the LLM
			# call, so a timeout during _get_next_action or _execute_actions
			# won't leave stale data from the previous step.
			self.state.last_model_output = None
			self.state.last_result = None

			# Phase 2: Get model output and execute actions
			await self._get_next_action(browser_state_summary)
			await self._execute_actions()

			# Phase 3: Post-processing
			await self._post_process()

		except Exception as e:
			# Handle ALL exceptions in one place
			await self._handle_step_error(e)

		finally:
			await self._finalize(browser_state_summary)
```

三个 Phase 分别对应"感知 → 决策 → 行动与善后"，而 `try/except/finally` 的形状暴露了这个框架最重要的稳健性哲学：**任何一步失败都不允许炸掉整个循环**。Phase 0（代码在节选之前）还会先等待可能正在进行的验证码求解（`wait_if_captcha_solving`），把结果作为一条 `ActionResult` 注入历史让 LLM 知情。注释里那句"清空上一步状态要放在上下文准备之后、LLM 调用之前"是典型的踩坑注释：状态清早了，拼"上一步动作结果"的 prompt 就没了数据；清晚了，LLM 超时又会把陈旧状态带进下一步。

**感知**（`_prepare_context`）：调用 `browser_session.get_browser_state_summary()` 拿到页面 URL、标题、所有标签页列表、DOM 序列化文本与截图；随后 `create_state_messages()`（`message_manager/service.py`）把它渲染成一条"状态消息"（`AgentMessagePrompt.get_user_message`），其中 DOM 文本、可用动作、任务进度、敏感数据占位说明各就各位。截图按 `use_vision` 三态（True / False / 'auto'）决定是否附带——`'auto'` 模式只在动作（如 `screenshot`）显式要求时才附带图片，省 token。

**决策**（`_get_next_action`）：把消息列表交给 LLM。外层包了 `asyncio.wait_for(..., timeout=self.settings.llm_timeout)`，LLM 输出被解析成强类型的 `AgentOutput`（Pydantic 模型：`evaluation_previous_goal`、`memory`、`next_goal`、`action: list[ActionModel]`），解析失败会带着"应该如何输出"的提示重试。

**行动与善后**：`_execute_actions` 调 `multi_act` 执行动作列表；`_post_process` 跟踪下载、更新计划状态、维护循环检测；`finally` 里 `_finalize` 统一收尾。

### 3.2 精读：multi_act 的双层"页面已变"守卫

LLM 一次可能输出多个动作（例如"输入用户名 → 输入密码 → 点登录"），`multi_act` 顺序执行它们。危险在于：队列里的第 2、3 个动作是基于执行第 1 个动作**之前**的页面快照生成的，如果第 1 个动作导致跳转，后续动作的元素索引就全错了。它用了两层防线：

```python
# browser_use/agent/service.py
	@time_execution_async('--multi_act')
	async def multi_act(self, actions: list[ActionModel]) -> list[ActionResult]:
		"""Execute multiple actions with page-change guards.

		Two layers of protection prevent executing actions against stale DOM:
		  1. Static flag: actions tagged with terminates_sequence=True (navigate, search, go_back, switch)
		     automatically abort remaining queued actions.
		  2. Runtime detection: after every action, the current URL and focused target are compared
		     to pre-action values. Any change aborts the remaining queue.
		"""
```

```python
# browser_use/agent/service.py
				# Capture pre-action state for runtime page-change detection
				pre_action_url = await self.browser_session.get_current_page_url()
				pre_action_focus = self.browser_session.agent_focus_target_id

				result = await self.tools.act(
					action=action,
					browser_session=self.browser_session,
					file_system=self.file_system,
					page_extraction_llm=self.settings.page_extraction_llm,
					sensitive_data=self.sensitive_data,
					available_file_paths=self.available_file_paths,
					extraction_schema=self.extraction_schema,
				)
```

第一层是**静态声明**：注册动作时打上 `terminates_sequence=True` 的（navigate、switch 等）执行后直接清空队列；第二层是**运行时检测**：每个动作执行前后对比 URL 与焦点标签页 target id，一旦变化立即中止剩余动作。另外 `done`（任务完成）动作只允许单独出现——队列中途出现 `done` 会直接截断。这套机制让"多动作输出"这个大杀器的风险被压到可控。

### 3.3 精读：失败处理与终止条件

`_handle_step_error` 是所有异常的唯一汇聚点，体现了"区分可恢复与不可恢复"的思路（节选）：

```python
# browser_use/agent/service.py
		# Handle all other exceptions
		include_trace = self.logger.isEnabledFor(logging.DEBUG)
		error_msg = AgentError.format_error(error, include_trace=include_trace)
		max_total_failures = self.settings.max_failures + int(self.settings.final_response_after_failure)
		prefix = f'❌ Result failed {self.state.consecutive_failures + 1}/{max_total_failures} times: '
		self.state.consecutive_failures += 1

		# Use WARNING for partial failures, ERROR only when max failures reached
		is_final_failure = self.state.consecutive_failures >= max_total_failures
		log_level = logging.ERROR if is_final_failure else logging.WARNING
```

关键逻辑：错误被格式化成 `ActionResult(error=...)` 写回历史——**下一步 LLM 会看到这条错误**，从而有机会换路走，这是"失败重试"的真实形态：不是框架自动重放，而是把失败信息喂给 LLM 让它自愈。中断类错误（用户 Ctrl+C）被温和吞掉；连接类错误则先等自动重连（`is_reconnecting`）再判断是否真的浏览器已关闭。连续失败达到 `max_failures` 上限循环才终止；在 `run()` 层面还有 `max_steps`（默认 500）硬上限与 `_force_done_after_last_step` 的兜底，保证 Agent 永远会退出。

### 3.4 精读：历史压缩（compaction）

步数一多，消息历史就会撑爆上下文。`message_manager/service.py` 的 `maybe_compact_messages()` 在每个 step 的感知阶段被调用，用"步数节奏 + 字符地板"双门槛触发：

```python
# browser_use/agent/message_manager/service.py
		steps_since = step_info.step_number - (self.state.last_compaction_step or 0)
		if steps_since < settings.compact_every_n_steps:
			return False

		# Char floor gate
		history_items = self.state.agent_history_items
		full_history_text = '\n'.join(item.to_string() for item in history_items).strip()
		trigger_char_count = settings.trigger_char_count if settings.trigger_char_count is not None else 40000
		if len(full_history_text) < trigger_char_count:
			return False
```

```python
# browser_use/agent/message_manager/service.py
		self.state.compacted_memory = summary
		self.state.compaction_count += 1
		self.state.last_compaction_step = step_info.step_number

		# Keep first item + most recent items
		keep_last = max(0, settings.keep_last_items)
		if len(history_items) > keep_last + 1:
			if keep_last == 0:
				self.state.agent_history_items = [history_items[0]]
			else:
				self.state.agent_history_items = [history_items[0]] + history_items[-keep_last:]
```

触发后，它把全部历史（连同已压缩过的 `<previous_compacted_memory>`）交给一个摘要 LLM 压成一段"紧凑记忆"，然后**历史只保留首条任务记录 + 最近 N 条**。摘要 prompt 里有一句非常清醒的约束："只有历史中出现明确的成功确认才能把步骤标成 completed，绝不允许从上下文推断完成"——防止摘要阶段引入幻觉，让 Agent 误以为任务已推进。相比之下，每步的状态消息（当前页面 DOM）永远是新鲜的，被压缩的只是"过去发生了什么"。

### 3.5 循环检测：不禁止，只"轻推"

长任务最大的杀手不是报错，而是"看起来在干活"的死循环：反复点同一个按钮、在同一页面来回滚动。browser-use 的对策不是硬中断，而是给 LLM 递纸条。`step()` 的感知阶段会把页面状态（URL、DOM 文本指纹、可交互元素数）和上一步动作都记录进一个 `loop_detector`：

```python
# browser_use/agent/service.py
	def _update_loop_detector_actions(self) -> None:
		"""Record the actions from the latest step into the loop detector."""
		if not self.settings.loop_detection_enabled:
			return
		if self.state.last_model_output is None:
			return
		# Actions to exclude: wait always hashes identically (instant false positive),
		# done is terminal, go_back is navigation recovery
		_LOOP_EXEMPT_ACTIONS = {'wait', 'done', 'go_back'}
		for action in self.state.last_model_output.action:
			action_data = action.model_dump(exclude_unset=True)
			action_name = next(iter(action_data.keys()), 'unknown')
			if action_name in _LOOP_EXEMPT_ACTIONS:
				continue
			params = action_data.get(action_name, {})
			if not isinstance(params, dict):
				params = {}
			self.state.loop_detector.record_action(action_name, params)
```

检测器同时盯两类信号：**动作重复**（同名动作同参数反复出现）与**页面停滞**（连续多步 DOM 指纹不变）。一旦触发，`_inject_loop_detection_nudge()` 把一条升级式提示注入上下文，告诉 LLM "你可能在循环，请换一种方式"；连续失败达到阈值还会注入 `_inject_replan_nudge`，建议模型重写计划（`plan_update`）；步数预算用到 75% 时 `_inject_budget_warning` 提醒它"该收尾保存部分结果了"。注意 `wait/done/go_back` 被豁免——注释写明 `wait` 每次哈希都相同会造成误报，`go_back` 本身就是导航恢复手段。这套"记录-检测-轻推"的设计把纠正权留给 LLM，框架只负责让它看得见自己的行为模式，比"检测到循环就强制终止"温和且有效得多。

### 3.6 多标签页管理：target_id 时代的会话账本

多标签页是浏览器 Agent 的刚需（点开新链接、比对两个页面、清理弹窗页）。CDP 世界里每个页面是一个 target，`browser/session_manager.py` 的 `TargetManager` 维护着 `Target → CDPSession` 的映射账本，`BrowserSession` 用一个 `agent_focus_target_id` 字段记录"Agent 当前焦点在哪个标签页"，所有 DOM 抓取、截图、动作都作用于焦点 target——前文 `get_serialized_dom_tree` 开头那句 `assert self.browser_session.agent_focus_target_id is not None` 就是这条约定的注脚。对 LLM 暴露的则是两个动作：`switch`（按 tab_id 切换焦点）与 `close`（关页），状态消息里的 `tabs` 列表会带上每个标签页 URL、标题与 tab_id（target_id 的后 4 位），供模型引用。`switch` 动作的实现值得一看，错误信息被精心构造为可回读的记忆：

```python
# browser_use/tools/service.py
		async def switch(params: SwitchTabAction, browser_session: BrowserSession):
			# Simple switch tab logic
			try:
				target_id = await browser_session.get_target_id_from_tab_id(params.tab_id)

				event = browser_session.event_bus.dispatch(SwitchTabEvent(target_id=target_id))
				await event
				# raise_if_any=True so a handler failure surfaces its real cause here instead
				# of silently becoming a "produced no result" below.
				new_target_id = await event.event_result(raise_if_any=True, raise_if_none=False)
			except Exception as e:
				logger.warning(f'Tab switch failed: {e}')
				# Preserve the concrete cause (e.g. a stale tab_id) instead of a generic
				# message, so the agent gets actionable failure info in both memories.
				memory = f'Failed to switch to tab #{params.tab_id}: {e}'
				raise BrowserError(memory, short_term_memory=memory, long_term_memory=memory)
```

注释点明意图：失败要保留具体原因（比如 tab_id 已失效）而不是一句泛泛的"切换失败"，这样"短期记忆"（当步结果）与"长期记忆"（历史）里的 LLM 都能拿到可行动的信息。与此配套的还有 `_detect_new_tab_opened`（点击可能打开新标签页后自动检测）和 target 关闭时的焦点自动恢复（`recover_agent_focus`）——用户手动关掉焦点页，Agent 也不会跟着失焦崩溃。多标签页管理在这里不是一堆 API，而是一条"账本（TargetManager）— 焦点（agent_focus_target_id）— 动作（switch/close）— 兜底（自动恢复）"的完整链路。

## 四、DOM 提取原理：从三棵树到一段文本

### 4.1 三棵树与两层过滤

`dom/service.py` 的 `DomService.get_serialized_dom_tree()` 是感知管线的入口：先经 `get_dom_tree()` 用 CDP 一次性取回**三棵树**——DOM Snapshot（含计算样式与几何 bounds）、完整 DOM 树、无障碍树（AX Tree）——合成为带 `is_visible / is_scrollable / ax_node / snapshot_node` 注解的 `EnhancedDOMTreeNode` 树（跨域 iframe 会被递归下钻）；再交给 `DOMTreeSerializer` 序列化。由此可见 browser-use 的一个核心取向：**优先用无障碍树与样式快照这些"浏览器自己认为可见/可交互"的信息，而不是自己模拟渲染**。

可见性判定的第一层在 `is_element_visible_according_to_all_parents()`，先看 CSS 三件套：

```python
# browser_use/dom/service.py
		computed_styles = node.snapshot_node.computed_styles or {}

		display = computed_styles.get('display', '').lower()
		visibility = computed_styles.get('visibility', '').lower()
		opacity = computed_styles.get('opacity', '1')

		if display == 'none' or visibility == 'hidden':
			return False

		try:
			if float(opacity) <= 0:
				return False
		except (ValueError, TypeError):
			pass

		if not node.snapshot_node.bounds:
			return False  # If there are no bounds, the element is not visible
```

第二层处理嵌套 frame 的视口裁剪：元素坐标要逐层减去 iframe 偏移与滚动偏移，落到每层 HTML frame 的视口内（外加 `viewport_threshold=1000px` 的余量，"接近视口"的元素保留，方便滚动后可用）才算可见：

```python
# browser_use/dom/service.py
			if (
				frame.node_type == NodeType.ELEMENT_NODE
				and frame.node_name == 'HTML'
				and frame.snapshot_node
				and frame.snapshot_node.scrollRects
				and frame.snapshot_node.clientRects
			):
				# For iframe content, we need to check visibility within the iframe's viewport
				# The scrollRects represent the current scroll position
				# The clientRects represent the viewport size
				# Elements are visible if they fall within the viewport after accounting for scroll

				# The viewport of the frame (what's actually visible)
				viewport_left = 0  # Viewport always starts at 0 in frame coordinates
				viewport_top = 0
				viewport_right = frame.snapshot_node.clientRects.width
				viewport_bottom = frame.snapshot_node.clientRects.height

				# Adjust element bounds by the scroll offset to get position relative to viewport
				# When scrolled down, scrollRects.y is positive, so we subtract it from element's y
				adjusted_x = current_bounds.x - frame.snapshot_node.scrollRects.x
				adjusted_y = current_bounds.y - frame.snapshot_node.scrollRects.y

				frame_intersects = (
					adjusted_x < viewport_right
					and adjusted_x + current_bounds.width > viewport_left
					and adjusted_y < viewport_bottom + viewport_threshold
					and adjusted_y + current_bounds.height > viewport_top - viewport_threshold
				)

				if not frame_intersects:
					return False
```

### 4.2 精读：交互性判定的多级启发

"可见"不等于"可操作"。`dom/serializer/clickable_elements.py` 的 `ClickableElementDetector.is_interactive()` 用一组由强到弱的启发式层层兜底，节选首尾两段：

```python
# browser_use/dom/serializer/clickable_elements.py
		# Check for JavaScript click event listeners detected via CDP (without DOM mutation)
		# this handles vue.js @click, react onClick, angular (click), etc.
		if node.has_js_click_listener:
			return True

		# IFRAME elements should be interactive if they're large enough to potentially need scrolling
		# Small iframes (< 100px width or height) are unlikely to have scrollable content
		if node.tag_name and node.tag_name.upper() == 'IFRAME' or node.tag_name.upper() == 'FRAME':
			if node.snapshot_node and node.snapshot_node.bounds:
				width = node.snapshot_node.bounds.width
				height = node.snapshot_node.bounds.height
				# Only include iframes larger than 100x100px
				if width > 100 and height > 100:
					return True
```

```python
# browser_use/dom/serializer/clickable_elements.py
		interactive_tags = {
			'button',
			'input',
			'select',
			'textarea',
			'a',
			'details',
			'summary',
			'option',
			'optgroup',
		}
		# Check with case-insensitive comparison
		if node.tag_name and node.tag_name.lower() in interactive_tags:
			return True
```

完整的判定阶梯是：JS click 监听器（CDP 在**不改 DOM** 的前提下探测到 React/Vue/Angular 的合成事件）→ 大 iframe → label/span 包装的表单控件（深挖两层子树，处理 Ant Design 这类组件库）→ 搜索类 class/id 关键词 → AX 属性（focusable/editable/checked/disabled/hidden）→ 原生交互标签 → `onclick/tabindex` 属性 → ARIA role → AX role → 10-50px 的"图标尺寸"元素带任意交互属性 → 最终兜底：CSS `cursor: pointer`。每一条阶梯都对应一类真实网站的反模式——这正是它能在各种魔改前端上保持点得动的原因，也解释了为什么这段代码几乎每个分支都带着一个"案例注释"（如 apartments.com 的 label 覆盖问题）。

### 4.3 精读：序列化五步与文本格式

`DOMTreeSerializer.serialize_accessible_elements()`（`dom/serializer/serializer.py`）把过滤后的树变成最终产物：

```python
# browser_use/dom/serializer/serializer.py
		# Step 1: Create simplified tree (includes clickable element detection)
		start_step1 = time.time()
		simplified_tree = self._create_simplified_tree(self.root_node)
		end_step1 = time.time()
		self.timing_info['create_simplified_tree'] = end_step1 - start_step1

		# Step 2: Remove elements based on paint order
		start_step3 = time.time()
		if self.paint_order_filtering and simplified_tree:
			PaintOrderRemover(simplified_tree).calculate_paint_order()
		end_step3 = time.time()
		self.timing_info['calculate_paint_order'] = end_step3 - start_step3

		# Step 3: Optimize tree (remove unnecessary parents)
		start_step2 = time.time()
		optimized_tree = self._optimize_tree(simplified_tree)
		end_step2 = time.time()
		self.timing_info['optimize_tree'] = end_step2 - start_step2

		# Step 3: Apply bounding box filtering (NEW)
		if self.enable_bbox_filtering and optimized_tree:
			start_step3 = time.time()
			filtered_tree = self._apply_bounding_box_filtering(optimized_tree)
			end_step3 = time.time()
			self.timing_info['bbox_filtering'] = end_step3 - start_step3
		else:
			filtered_tree = optimized_tree

		# Step 4: Assign interactive indices to clickable elements
		start_step4 = time.time()
		self._reserve_backend_node_ids(filtered_tree)
		self._assign_interactive_indices_and_mark_new_nodes(filtered_tree)
		end_step4 = time.time()
		self.timing_info['assign_interactive_indices'] = end_step4 - start_step4

		end_total = time.time()
		self.timing_info['serialize_accessible_elements_total'] = end_total - start_total

		return SerializedDOMState(_root=filtered_tree, selector_map=self._selector_map), self.timing_info
```

五步各司其职：建简化树（剔除 SVG 内部节点、`data-browser-use-exclude` 标记、不可见内容，保留 shadow DOM——注释明说"SPA 的真实交互内容常在 shadow DOM 里"）→ **按绘制顺序剔除被遮挡元素**（弹窗下层被盖住的按钮对 LLM 隐藏，否则模型会试图去点一个根本点不到的元素）→ 折叠无意义的中间父节点 → 视口外裁剪 → 给可交互元素分配**从 1 开始的稳定索引**并标记新增元素（`is_new`，让 LLM 识别"这是刚出现的元素"）。产物有两个：供 LLM 看的文本树，和 `selector_map: index → EnhancedDOMTreeNode`——索引与 DOM 节点的双向闭环，动作执行时按索引取回真实节点做 CDP 点击。

文本格式由 `serialize_tree()` 生成，核心行格式是 `[索引]<标签` 前缀体系：

```python
# browser_use/dom/serializer/serializer.py
				if should_show_scroll and not node.is_interactive:
					# Scrollable container but not clickable
					line = f'{depth_str}{shadow_prefix}|scroll element|<{node.original_node.tag_name}'
				elif node.is_interactive:
					assert node.selector_index is not None
					new_prefix = '*' if node.is_new else ''
					scroll_prefix = '|scroll element[' if should_show_scroll else '['
					line = f'{depth_str}{shadow_prefix}{new_prefix}{scroll_prefix}{node.selector_index}]<{node.original_node.tag_name}'
				elif node.original_node.tag_name.upper() == 'IFRAME':
					# Iframe element (not interactive)
					line = f'{depth_str}{shadow_prefix}|IFRAME|<{node.original_node.tag_name}'
				elif node.original_node.tag_name.upper() == 'FRAME':
					# Frame element (not interactive)
					line = f'{depth_str}{shadow_prefix}|FRAME|<{node.original_node.tag_name}'
				else:
					line = f'{depth_str}{shadow_prefix}<{node.original_node.tag_name}'

				if attributes_html_str:
					line += f' {attributes_html_str}'

				line += ' />'
```

LLM 最终看到的是一棵缩进文本树：可点元素形如 `[23]<button`，新出现的带 `*`，可滚动容器带 `|scroll element[` 与滚动信息，shadow DOM 有 `|SHADOW(open)|` 边界，SVG 折叠成一行注释。每行可选附加白名单属性（`_build_attributes_string`）与下拉框选项摘要（`_extract_select_options` 只取前 4 个 option，防止千项下拉刷爆上下文）。相比截图 + 坐标点击的纯视觉方案，这套"文本树 + 整数索引"对纯文本 LLM 也有效、token 成本低一个数量级、且索引到 CDP backendNodeId 的执行链路远比坐标点击稳定。

### 4.4 跨步增量与超时兜底

两个稳健性细节为这条感知管线收尾。其一是**跨步增量标记**：`DOMTreeSerializer` 构造时接收上一步的 `previous_cached_state`（见 `DomService.get_serialized_dom_tree` 传参），分配索引时会把当前页元素与上一步的 `selector_map` 对比，新出现的元素打上 `is_new`——于是序列化文本里的 `*` 前缀能告诉 LLM"这是刚才那步操作后新冒出来的东西"，模型无需自己 diff 两步文本来发现变化。其二是**超时时宁可给空状态**：`get_browser_state_summary` 若等待 DOM 抓取超时，不会把上一步的旧状态凑合给 LLM 用，而是返回空的 `SerializedDOMState` 并附上一句状态错误——"当前 DOM 与截图均不可用，任何元素索引都不安全，请改用导航、等待等不依赖索引的动作恢复"，同时把本地缓存的 selector_map 一并清空。这个"宁可失明，不给过期地图"的选择，杜绝了 LLM 拿着陈旧索引在新页面上自信点按的最坏情形。

## 五、动作系统：装饰器注册 + Pydantic 参数化

动作在 `tools/service.py` 的 `Tools` 类上用 `@registry.action` 装饰器注册（`click`、`input`、`navigate`、`extract`、`scroll`、`switch_tab`、`done` 等数十个）。注册时（`tools/registry/service.py`）函数签名被动态转成 Pydantic 参数模型：

```python
# browser_use/tools/registry/service.py
		def decorator(func: Callable):
			# Skip registration if action is in exclude_actions
			if func.__name__ in self.exclude_actions:
				return func

			# Normalize the function signature
			normalized_func, actual_param_model = self._normalize_action_function_signature(func, description, param_model)

			action = RegisteredAction(
				name=func.__name__,
				description=description,
				function=normalized_func,
				param_model=actual_param_model,
				domains=final_domains,
				terminates_sequence=terminates_sequence,
			)
			self.registry.actions[func.__name__] = action

			# Return the normalized function so it can be called with kwargs
			return normalized_func
```

这个设计一石三鸟：参数模型自动拼接成 LLM 的工具 schema（`create_action_model` 动态生成 Union 类型，每个动作一个字段）；LLM 输出的 JSON 在执行前被 Pydantic 校验；`domains` 白名单让自定义动作只在指定站点生效，`page_url` 过滤则把页面专属动作动态注入 prompt（`get_prompt_description`）。执行侧 `execute_action()` 先校验参数、再替换敏感数据占位符（`<password>` 这类占位符在动作入参里被实时替换为真值，替换前还校验当前 URL 是否在敏感数据声明的域名内），`browser_session / page_extraction_llm / file_system` 等特殊参数由框架注入而非 LLM 提供：

```python
# browser_use/tools/registry/service.py
		if action_name not in self.registry.actions:
			raise ValueError(f'Action {action_name} not found')

		action = self.registry.actions[action_name]
		try:
			# Create the validated Pydantic model
			try:
				validated_params = action.param_model(**params)
			except Exception as e:
				raise ValueError(f'Invalid parameters {params} for action {action_name}: {type(e)}: {e}') from e

			if sensitive_data:
				# Get current URL if browser_session is provided
				current_url = None
				if browser_session and browser_session.agent_focus_target_id:
					try:
						# Get current page info from session_manager
						target = browser_session.session_manager.get_target(browser_session.agent_focus_target_id)
						if target:
							current_url = target.url
					except Exception:
						pass
				validated_params = self._replace_sensitive_data(validated_params, sensitive_data, current_url)
```

外层 `Tools.act()`（`tools/service.py`）再为每个动作套上**每动作级超时**（默认 180 秒）：远程浏览器 CDP WebSocket 静默挂起是常见故障，超时被转换成一条"浏览器可能无响应，换招吧"的 `ActionResult(error=...)` 交还给 LLM——错误依旧走"喂给模型自愈"的老路。

## 六、设计思想小结

1. **为 LLM 重新序列化页面，而不是把 HTML 扔给它**。DOM 序列化的每一步（样式过滤、绘制顺序遮挡剔除、viewport 裁剪、SVG 折叠、shadow DOM 保留、下拉选项截断）都在回答同一个问题："哪些信息值得占用 LLM 的 token？"整数索引则是文本世界与真实 DOM 之间最小的那座桥。
2. **感知-决策-行动分离，且失败信息回流**。`step()` 的三 Phase 结构 + `ActionResult(error=...)` 进历史，让"重试"本质上是 LLM 的再决策；框架只负责把可恢复（重连）与不可恢复（浏览器已关）区分开，并在步数/失败上限处硬性止损。
3. **纠正优先于禁止**。循环检测不终止任务而是注入提示，失败不重放动作而是喂回错误，预算耗尽前先警告——框架的姿态始终是"让模型看见后果、自己改道"，只在最外层保留 `max_steps` / `max_failures` 两条不可逾越的硬边界。这比"检测到异常行为就接管"的方案更符合 LLM 的能力现状：它的自我纠错能力其实很强，前提是你把问题说给它听。
4. **防御性上下文管理**。多动作队列的静态/运行时双层守卫、`done` 仅限单动作、LLM 调用超时、每动作超时、历史压缩的"不推断完成"约束——所有机制都在防同一个敌人：LLM 的输出不可靠，但系统必须可靠。
5. **架构与浏览器对话方式的深度绑定**。从 Playwright 迁到裸 CDP 后，JS 监听器探测、DOM Snapshot、多 target 标签页管理、watchdog 事件总线都成了第一公民——选型的变化直接换取了感知管线的保真度。
6. **类型驱动的动作协议**。装饰器 + 动态 Pydantic 模型让"新增一个动作"与"LLM 工具 schema 更新"自动同步，用户扩展动作时完全不碰 Agent 主循环代码。

如果说 RAG 式系统的核心抽象是"检索",浏览器 Agent 的核心抽象就是"把世界（页面）折叠进上下文，再把上下文里的意图展开成动作"。browser-use 的全部源码，就是这两个方向上反复打磨的工程注脚。

## 七、可以照搬的设计手法

下面这些手法与浏览器无关，做任何"LLM + 外部世界"的系统都能直接搬。

1. **给模型看的表示层单独建一个模块，不要复用给机器看的那份**。`browser_use/dom/` 里 `DOMTreeSerializer` 的序列化五步（建简化树 → 按绘制顺序剔除遮挡 → 折叠无意义父节点 → 视口外裁剪 → 分配索引）全部集中在这一条管线，产物才分成"给 LLM 的文本树"和"给执行用的 `selector_map`"两份。落到你的项目：为 LLM 定义一个专门的 `renderForModel()` 视图（Java 侧就是一个独立 DTO + 序列化器），过滤规则、裁剪阈值、属性白名单集中一处，再配"同一份状态、两种表示"的黄金样例快照测试。调 prompt 成本时只改一处，这是收益最快的一条。
2. **用"上下文内整数索引"当 LLM 与真实实体的唯一契约**。模型只看见 `[23]<button` 这样的索引，执行时按 `selector_map: index → EnhancedDOMTreeNode` 取回真实节点再发起 CDP 操作，索引每步重建、绝不跨步复用。这比让模型输出 XPath、CSS 选择器或 DOM id 健壮得多：幻觉成本低、校验简单（越界就是错）、日志可回放。更值得抄的是它的兜底——DOM 抓取超时时返回**空状态**并清空 `selector_map`，附一句"任何元素索引都不安全，请改用不依赖索引的动作恢复"，宁可失明也不给过期地图。对应到你的工具调用（工单号、资源 ID、文件路径）：先做一层"本轮上下文内的短标识"映射，映射失效时明确报错要求重新感知，而不是拿旧 ID 去猜。
3. **让模型看见后果：失败与重复都作为反馈喂回上下文，而不是抛给上层重试**。两条机制同构——`ActionResult(error=...)` 与成功结果一样进入历史，模型下一步就看得见"上次那招失败了"（外层 `Tools.act()` 的每动作超时也被转换成这种可回读的错误）；`loop_detector` 记录动作重复（同名同参）与页面停滞（DOM 文本指纹连续多步不变），触发后注入升级式提示：`_inject_loop_detection_nudge` → 连续失败时 `_inject_replan_nudge` → 步数预算用到 75% 时 `_inject_budget_warning`。工程做法：定义统一的 `StepResult{ok, output, error, observation}`，错误分"可自愈"（喂回模型）与"必须中止"（熔断）两类，只有后者抛异常；重试次数、超时、步数预算这些硬边界放在循环外，不放节点里。检测器还豁免了 `wait/done/go_back`（注释写明 `wait` 每次哈希相同会立刻误报）——任何检测器都要先设计白名单，并把"停滞率""动作重复率"做成监控指标，它们是 Agent 质量最有用的先行信号。
4. **历史压缩用双门槛触发，并给摘要器一条反幻觉约束**。`maybe_compact_messages()` 要求"距上次压缩满 `compact_every_n_steps` 步"**且**"历史文本满 `trigger_char_count`（默认 4 万字符）"才动手：步数门槛保证不会每步都调摘要 LLM，字符门槛保证短任务根本不触发，两个判断都很便宜。压缩后只留 `history_items[0] + 最近 keep_last_items` 条——首条是原始任务，防目标漂移；摘要 prompt 里那句"只有历史中出现明确的成功确认才能标 completed，绝不允许从上下文推断完成"是防摘要阶段引入幻觉的关键。落地再加两条：摘要失败退回"只截断不摘要"，别把主循环挂住；压缩前后各存一份原始历史便于对拍。
5. **动作协议由类型系统生成，扩展动作不碰主循环**。`@registry.action` 注册时把函数签名动态转成 Pydantic 参数模型（`_normalize_action_function_signature`），再由 `create_action_model` 拼成 Union 类型的工具 schema：新增一个动作，schema 自动同步，模型输出的 JSON 在执行前自动被校验。三类横切能力都挂在注册元数据上——`domains` 白名单（动作只在指定站点生效）、`page_url` 过滤（页面专属动作才进 prompt）、特殊参数由框架注入而非 LLM 提供。对应做法：工具用带注解的方法声明，启动期统一校验"参数必须有类型、必须有描述"，schema 由反射生成，禁止手写 JSON 与代码两头维护。

---

> **来源**：本文为基于开源项目 [browser-use](https://github.com/browser-use/browser-use)（browser-use，MIT 许可）的源码分析，代码片段引自 2026-09-13 clone 的 main 分支（v0.13.10，commit 843819c），均在文中标注仓库相对路径；分析视角与文字组织为本站编者撰写。依据 MIT 许可引用并注明出处。
