---
title: 生产可观测性：OpenTelemetry GenAI 语义约定与调用侧埋点
source_url: https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-spans.md
author: OpenTelemetry（semantic-conventions-genai 仓库，Apache 2.0）
license: Apache 2.0
fetched_at: 2026-09-19
translated: true
versions: OpenTelemetry GenAI semantic conventions（独立仓库 semantic-conventions-genai，字段状态为 Development）；示例模型 gpt-5.4；opentelemetry-sdk 2026-09 稳定版
order: 20
group: 可靠性、安全与成本
---
应用一旦上了多模型、多供应商，"这次请求花了多少 token、慢在哪、为什么降级了"就从日志问题变成**指标问题**。Agent 框架侧的观察平台方案（LangSmith / Langfuse / OTel 后端）本站在《可观测性与 Tracing：Agent 生产排障的第一工具（LangSmith / Langfuse / OpenTelemetry）》里讲过；本篇往下沉一层：**在调用侧（你自己写的 `client.responses.create`）按 OpenTelemetry GenAI 语义约定打点**，让不同模型、不同 SDK 的数据长得一样。

## 一、为什么需要"语义约定"

裸埋点的结果是每家字段都不一样：OpenAI 叫 `usage.prompt_tokens`、另一家叫 `input_token_count`；同一次调用的 span 名可能是 `openai.chat`、`chat gpt-5.4`、`invoke_model`。语义约定（semantic conventions）就是把这些命名定死：

- **span 名**：`{gen_ai.operation.name} {gen_ai.request.model}`，例如 `chat gpt-5.4`、`embeddings text-embedding-3-small`；
- **`gen_ai.operation.name` 取值**：`chat`、`embeddings`、`text_completion`、`generate_content`、`execute_tool`、`invoke_agent`、`create_agent`、`fetch_response`、`create_memory` 等（有预定义值就必须用预定义值）；
- **`gen_ai.provider.name`**（Required）：`openai`、`anthropic`、`aws.bedrock`、`gcp.gen_ai` 等，作为多供应商仪表盘里的判别字段。

一句话记法：**跨供应商做聚合，靠的是这三个字段，而不是你随手起的属性名。**

> 版本状态提醒：GenAI 语义约定已从 OpenTelemetry 主语义约定仓库**迁到独立仓库** `open-telemetry/semantic-conventions-genai`，且文中大量字段仍标注为 `Development`。这意味着属性名可能继续调整——把它当"当前事实标准"来打点，但**别把它当稳定 API**：字段变更要靠埋点层收敛，不要渗透到业务代码里。

## 二、三类信号各自记什么

**表：GenAI 语义约定的信号分工**

| 信号 | 名称 | 类型/单位 | 记什么 |
| --- | --- | --- | --- |
| Trace | span `chat {model}` | — | 一次调用的耗时、错误、模型、token 用量、会话与工具信息 |
| Metric | `gen_ai.client.token.usage` | Histogram，`{token}` | 输入/输出 token 分布（`gen_ai.token.type` 区分 input/output） |
| Metric | `gen_ai.client.operation.duration` | Histogram，`s` | 客户端观察到的调用时长分布 |
| Metric | `gen_ai.server.request.duration` / `time_to_first_token` / `time_per_output_token` | Histogram | 服务端视角的时长与首 token 延迟（流式体验关键） |
| Event | `gen_ai.client.inference.operation.details` | Opt-In 事件 | 请求输入输出细节（含对话历史），**默认不记** |
| Event | `gen_ai.evaluation.result` | Opt-In 事件 | 评估结果（分数、判据），把评测数据与调用串起来 |

调用侧最常打的关键属性（语义约定里的必带/推荐档）：

- `gen_ai.request.model` / `gen_ai.response.model`（请求的模型名 vs 实际服务你的模型名，降级时二者会不同——这是排查降级链路的关键）；
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`；细分项 `gen_ai.usage.cache_read.input_tokens`、`gen_ai.usage.cache_write.input_tokens`、`gen_ai.usage.reasoning.output_tokens`、`gen_ai.usage.image.*`、`gen_ai.usage.audio.*` 都**应当已包含**在总输入/输出里（不要重复相加，否则成本统计翻倍）；
- `gen_ai.response.finish_reasons`（数组，`["stop"]`、`["stop","length"]`——`length` 意味着被截断，通常是 `max_completion_tokens`/`max_output_tokens` 设小了）；
- `gen_ai.conversation.id`（服务端有会话标识时才填，例如 Responses API 的 `conv_...`）、`gen_ai.request.previous_response.id`（链式续接的上游 id）；
- `gen_ai.request.stream`（布尔，流式与否——流式与非流式的时长指标不能混在一个桶里比）、`gen_ai.request.reasoning.level`（`low`/`medium`/`high`）；
- `gen_ai.prompt.name` / `gen_ai.prompt.version`：用了命名提示模板时填，这是"提示词版本化到调用侧"的落地字段；
- `error.type`（`timeout`、`429`、`500` 等，Stable 字段）；`server.address` / `server.port`。

OpenAI 侧还有专属字段：`openai.request.service_tier`（`auto` / `default` / `flex` / `priority`，非 auto 时填）。

## 三、可运行的调用侧埋点

装依赖：

```sh
pip install openai opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc python-dotenv
```

下面这个包装器把一次 `responses.create` 变成"span + 两个直方图 + 可选内容事件"，是**零第三方埋点库**的写法（社区确有成型的 instrumentor，例如 OpenLLMetry 走 OTel 语义约定、OpenInference 用自己的语义约定需要后端转换；但自己写 60 行能彻底掌控隐私与字段）：

```python
import json
import os
import time
from contextlib import contextmanager

import openai
from openai import OpenAI
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

CAPTURE_CONTENT = os.getenv("LLM_TRACE_CAPTURE_CONTENT", "0") == "1"  # 默认不记提示词正文

client = OpenAI()  # Key 从 .env 读取（全站约定）


def init_otel(endpoint: str = "http://localhost:4317") -> tuple[trace.Tracer, metrics.Meter]:
    resource = Resource.create({"service.name": "llm-caller", "deployment.environment": os.getenv("ENV", "dev")})
    tp = TracerProvider(resource=resource)
    tp.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    trace.set_tracer_provider(tp)
    mp = MeterProvider(resource=resource, metric_readers=[PeriodicMetricReader(OTLPMetricExporter(endpoint=endpoint))]  # 周期性推送到 OTLP Collector)
    metrics.set_meter_provider(mp)
    return trace.get_tracer("llm-caller"), metrics.get_meter("llm-caller")


tracer, meter = init_otel()

TOKEN_HIST = meter.create_histogram(
    name="gen_ai.client.token.usage", unit="{token}", description="Number of input and output tokens used."
)
DURATION_HIST = meter.create_histogram(
    name="gen_ai.client.operation.duration", unit="s", description="GenAI operation duration."
)


def traced_chat(model: str, **kwargs):
    """按 OpenTelemetry GenAI 语义约定埋点的一次调用。"""
    started = time.perf_counter()
    with tracer.start_as_current_span(f"chat {model}") as span:
        span.set_attribute("gen_ai.operation.name", "chat")
        span.set_attribute("gen_ai.provider.name", "openai")
        span.set_attribute("gen_ai.request.model", model)
        span.set_attribute("gen_ai.output.type", "text")
        span.set_attribute("gen_ai.request.stream", bool(kwargs.get("stream")))
        if kwargs.get("instructions"):
            span.set_attribute("gen_ai.input.messages", str(kwargs["instructions"])[:500])  # 开关控制
        try:
            resp = client.responses.create(model=model, **kwargs)
        except openai.RateLimitError as exc:
            DURATION_HIST.record(time.perf_counter() - started, {"gen_ai.request.model": model, "error.type": "429"})
            span.set_attribute("error.type", "429")
            span.record_exception(exc)
            raise
        except openai.APIConnectionError as exc:
            DURATION_HIST.record(time.perf_counter() - started, {"gen_ai.request.model": model, "error.type": "timeout"})
            span.set_attribute("error.type", "timeout")
            span.record_exception(exc)
            raise

        dur = time.perf_counter() - started
        DURATION_HIST.record(dur, {"gen_ai.request.model": model})
        span.set_attribute("gen_ai.response.model", resp.model)
        span.set_attribute("gen_ai.response.id", resp.id)
        if resp.usage:
            span.set_attribute("gen_ai.usage.input_tokens", resp.usage.input_tokens)
            span.set_attribute("gen_ai.usage.output_tokens", resp.usage.output_tokens)
            TOKEN_HIST.record(resp.usage.input_tokens, {"gen_ai.request.model": model, "gen_ai.token.type": "input"})
            TOKEN_HIST.record(resp.usage.output_tokens, {"gen_ai.request.model": model, "gen_ai.token.type": "output"})
            details = getattr(resp.usage, "output_tokens_details", None)
            if details and getattr(details, "reasoning_tokens", None):
                span.set_attribute("gen_ai.usage.reasoning.output_tokens", details.reasoning_tokens)
        cached = getattr(getattr(resp.usage, "input_tokens_details", None), "cached_tokens", None)
        if cached is not None:
            span.set_attribute("gen_ai.usage.cache_read.input_tokens", cached)
        if CAPTURE_CONTENT:  # 对应 inference.operation.details 事件的 Opt-In 立场：默认关
            span.add_event("gen_ai.client.inference.operation.details", {
                "gen_ai.operation.name": "chat",
                "gen_ai.provider.name": "openai",
                "gen_ai.input.messages": json.dumps(kwargs.get("input"), ensure_ascii=False)[:8000],
                "gen_ai.output.messages": resp.output_text[:8000],
            })
        return resp
```

用法与裸 SDK 一致，只是多了观测：

```python
resp = traced_chat("gpt-5.4", input="用三句话解释向量数据库", max_output_tokens=200)
print(resp.output_text)
```

生产上再加两件小事：把 `request_id` 记进 span（`response.headers` 里的 `x-request-id`，OpenAI 排障工单要它，见《错误处理、重试与限流》），以及把 `gen_ai.conversation.id` / `gen_ai.request.previous_response.id` 带上——**没有会话字段，你无法把一个慢请求归因到某条长对话**。

## 四、把这组字段变成日常可答的问题

字段打全之后，这几类问题就是一条查询的事：

1. **成本归因**：按 `gen_ai.request.model` × 业务标签聚合 `gen_ai.usage.input_tokens/output_tokens`，再乘单价——比事后翻账单快得多。落库版本（按天/按模型统计）见《PostgreSQL 窗口函数与 CTE：按天按模型算 token 与延迟》。
2. **缓存是否命中**：`cache_read.input_tokens` 占 `input_tokens` 的比例就是命中率；Prompt Caching 的写法见《成本与 Token 优化：Prompt Caching 与 Batch API》。
3. **推理成本占比**：`gen_ai.usage.reasoning.output_tokens` / `output_tokens` 异常高，说明 `reasoning.effort` 给大了——推理模型的降本抓手。
4. **首字延迟**：流式请求要看 `gen_ai.server.time_to_first_token`（服务端语义）或自己埋 TTFT；只看 `operation.duration` 会把"整体快但首字慢"的体验问题完全掩盖。
5. **降级链路**：`gen_ai.request.model` 与 `gen_ai.response.model` 不一致的次数，就是 fallback 触发次数。

## 五、部署与采样：埋点之外的那半件事

- **出口统一走 Collector**。应用只负责产生 span/metrics，采样、脱敏、路由（同一份数据既要进 APM 又要进数仓）交给 OTel Collector 的 processor 链：`batch`（必开，别每条都发）、`memory_limiter`、`transform`（删字段做脱敏）、`filter`。应用侧关掉导出器就没了，事后无从补救。
- **采样要留错误全量**。头部采样 `parentbased_traceidratio` 便宜但会丢掉"只出错的稀有路径"；对 LLM 调用这类高价值、低频的请求，常用做法是把比率设低（10%）+ 用 Collector tail sampling 对 `error.type` 非空的 trace 全留。
- **指标与 trace 的维度分工**。模型、供应商、operation.name、是否流式——这些进 metric 维度；`response_id`、`conversation_id`、`request_id` 只进 span，靠 trace 关联去查细节。
- **本地起步**：`docker run -p 4317:4317 -p 16686:16686 jaegertracing/all-in-one:latest` 就能收到 OTLP，把 `LLM_TRACE_CAPTURE_CONTENT=1` 打开看一轮真实数据，再决定线上记什么。

## 六、常见坑

1. **把提示词正文默认打开**。`gen_ai.client.inference.operation.details` 在规范里明确是 **Opt-In**——它装着对话历史，等于把用户数据复制一份进可观测后端。默认关、按环境开、开启时截断与脱敏。
2. **属性基数爆炸**。别把 `user_id`、完整 URL 之类高基数字段塞成指标维度（span 属性可以，metric 维度会打爆时间线）。用户维度放 span 或用 trace 关联。
3. **重复统计 token**。`cache_read`/`reasoning`/`image` 等细分项**已包含**在总项里，再加一次成本翻倍。
4. **重试产生多个 span 却当成一次调用**。SDK 默认自动重试 2 次；要打"业务调用成功率"就在最外层再包一个 span，内层 span 记录每次尝试。
5. **流式与非流式混桶**。`gen_ai.request.stream` 不加区分，p99 会互相污染。
6. **只埋 happy path**。异常分支同样要 `record` 时长 + `error.type`，否则你的 p99 永远好看。
7. **把 Development 字段当契约**。语义约定还在演进，埋点层要做字段映射与兜底，别把 `gen_ai.usage.input_tokens` 直接写进 BI 报表 SQL。

## 七、小结

- GenAI 语义约定住在独立仓库，字段状态仍为 `Development`：可依赖，别当稳定 API；
- 三个字段撑起跨供应商聚合：`gen_ai.operation.name`、`gen_ai.provider.name`、`gen_ai.request.model`，span 名为 `{operation} {model}`；
- 客户端两个直方图：`gen_ai.client.token.usage`、`gen_ai.client.operation.duration`；服务端三个补上体验视角；
- 内容捕获默认关闭（Opt-In），细分 token 已含在总项里，重试与流式要能区分；
- 观测数据的落库与聚合分析，交给《EXPLAIN 与 pg_stat_statements》和窗口函数那一篇。

---

> **来源**：抓取于 2026-09-19。本文译自/依据 OpenTelemetry GenAI 语义约定（Apache 2.0，作者 OpenTelemetry 项目）：[gen-ai-spans.md](https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-spans.md)（span 命名与属性要求等级）、[gen-ai-metrics.md](https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-metrics.md)（指标名、instrument 类型与单位）、[gen-ai-events.md](https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/gen-ai-events.md)（`inference.operation.details` 为 Opt-In）、[openai.md](https://raw.githubusercontent.com/open-telemetry/semantic-conventions-genai/main/docs/gen-ai/openai.md)（`openai.request.service_tier`）。规范已从 opentelemetry.io 的 `docs/specs/semconv/gen-ai/` 迁移至该独立仓库（迁移公告页保留索引），作者 OpenTelemetry，许可 Apache 2.0。埋点包装器、成本归因清单与常见坑为本站编者整理。
