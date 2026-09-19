---
title: Embedding 模型选型：四轴决策与本地实测
source_url: https://github.com/FlagOpen/FlagEmbedding
author: BAAI（BGE / FlagEmbedding）；Qwen 团队（Qwen3-Embedding）；MTEB 团队（embeddings-benchmark）；阿里云百炼（API 价目与规格）
license: MIT（FlagEmbedding 代码与 bge-*-zh / bge-m3 权重）；Apache-2.0（mteb、sentence-transformers、Qwen3-Embedding、bge-reranker-v2-m3 权重）；阿里云百炼规格与单价取自官方文档
fetched_at: 2026-09-19
translated: true
versions: 官方仓库 FlagEmbedding master / QwenLM/Qwen3-Embedding main / embeddings-benchmark/mteb main（2026-09 抓取）；实测环境 sentence-transformers 6.1.0、torch 2.14.0(CPU)、transformers 5.17.0、Python 3.14、Apple M4 16GB
order: 7
group: 摄取层：解析、分块与嵌入
---

## 先给结论：什么场景选什么

选型不是"挑榜单第一"，是在**中文能力、长文档、成本、延迟**四条轴上做取舍。下表是本站实测 + 官方参数核对后的结论，后面几节给出依据与可复现脚本：

| 你的场景 | 首选 | 次选 / 不选 | 一句话理由 |
| --- | --- | --- | --- |
| 中文知识库问答，块长 ≤ 400 token，要自托管 | `BAAI/bge-base-zh-v1.5`（768 维） | 预算更紧用 `bge-small-zh-v1.5`（512 维） | 实测 recall@5 0.800 vs small 0.750，CPU 单查询 12ms vs 2ms，是"效果/成本"最平衡的一档 |
| 极致省成本：CPU 上线、并发高、检索阶段要 <10ms | `bge-small-zh-v1.5` | 别上 `bge-large-zh-v1.5` | 2ms/查询、24M 参数、向量 2KB，recall@5 只比 base 低 5 个点（见实测表） |
| 效果优先、有 GPU、还想一份权重多语言/代码通吃 | `Qwen3-Embedding-0.6B` 起步，再评估 4B / 8B | 只有 CPU 就别上（实测单查询 163ms，见第三节） | 本模块实测 0.6B 已超 `bge-large-zh-v1.5`（recall@5 0.933 vs 0.833）；官方 C-MTEB 检索分 4B/8B 是 77.03 / 78.21（bge-large-zh-v1.5 为 70.46），代价是参数量与显存再翻数倍 |
| 整篇 SOP / 长文档必须一次编进一个向量 | `BAAI/bge-m3`（8192 token） | `Qwen3-Embedding`（32K，但要重新算成本与延迟） | bge-m3 一份模型同时给稠密、稀疏（SPLADE 式）、多向量（ColBERT）三种检索 |
| 混合检索想少建一条链路（稠密+词法同源） | `BAAI/bge-m3` 的 sparse 输出 + 稠密输出 | 只靠嵌入模型替代 BM25 | 论文与官方 README 都强调 Multi-Functionality，但实测 recall 不必然更高（见下） |
| 不想自己托管、要 SLA 与合规 | 阿里云百炼 `text-embedding-v4`（官方说明属 Qwen3-Embedding 系列，¥0.0005/千 token） | 追求便宜用 `qwen3.7-text-embedding-flash`（¥0.000125/千 token） | 单价、维度可选项、单条 8192 token 限制均为官方文档所列 |
| 领域黑话多、召回死活上不去 | **先换检索结构**（混合检索 + 重排 + 改分块），再谈换模型 | 直接换更大的通用模型 | 换模型救不了"词不在同一空间"和"关键信息被截断"这两类失败 |

**选型顺序建议**：先用四轴把候选压到 2-3 个 → 用**你自己的 100-200 条标注查询**跑一次下节的脚本 → 再决定要不要付 API 费或买 GPU。没有自有评测集时，任何"某某模型更强"的结论都只适用于别人的语料。

## 一、四轴怎么量化

### 轴一：中文能力

三个可查信号，按可信度排序：

1. **官方语言列**（FlagEmbedding README 的 Model List 明确区分 `Chinese` / `Multilingual`）；
2. **中文检索子集分数**：C-MTEB 的 Retrieval 列（T2Retrieval、DuRetrieval、CmedqaRetrieval…，指标 nDCG@10），或 MTEB 官方新版的 `MTEB(cmn, v1)`；
3. **是否需要 query 指令**：这决定你线上代码里要不要给查询加前缀。

指令前缀是中文模型的高频坑。官方给出的 `bge-*-zh-v1.5` 检索指令是 `为这个句子生成表示以用于检索相关文章：`，而 `bge-m3` **不需要**指令（官方 Model List 的 instruction 列为空）。给错了不会报错，只会**静默掉召回**。Qwen3-Embedding 反过来——官方建议写指令，并给出经验值：

> 评估表明，多数下游任务使用指令（instruct）通常比不用提升 1%–5%。……多语言场景下建议用英文写指令，因为模型训练时使用的指令大多以英文撰写。（译自 QwenLM/Qwen3-Embedding README）

### 轴二：长文档

看的是 `max_position_embeddings` / 官方标注的序列长度，不是宣传页上的"支持超长上下文"。核对到的硬数字（官方仓库 + 模型 `config.json`）：

| 模型 | 最大输入 | 依据 |
| --- | --- | --- |
| `bge-small/base/large-zh-v1.5` | 512 token | 模型文件里的 sentence-transformers 配置与 `config.json`（实测 `max_seq_length` = 512） |
| `BAAI/bge-m3` | 8192 token | 官方 README："Multi-Granularity(8192 tokens)"；`config.json` 的 `max_position_embeddings` = 8194 |
| `Qwen3-Embedding-0.6B/4B/8B` | 32K（官方示例代码里用 `max_length = 8192`） | 官方 README 模型表；`config.json` 的 `max_position_embeddings` = 32768 |
| 百炼 `text-embedding-v4` | 单条 8192 token，单次最多 10 条 | 官方 API 文档（v3/v4 同） |
| 百炼 `qwen3.7-text-embedding` | 单条 128,000 token，单次最多 20 条 | 官方 API 文档 |

**关键认知：截断是静默失败。** 512 token 的模型遇到 700 token 的块不会报错，只会把后半段丢掉，而丢掉的往往正是"处置步骤""参数表"这类真正被问到的内容。本节的实测里就有一条这样的查询（`q7`，见第四节）。

量化方法：把分块结果用**候选模型自己的分词器**统计长度分布，要求 P95 块长 ≤ 模型上限的 80%。超了有两条路——改分块（见《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《句子窗口与父子块检索：用小块召回、大块作答》），或者换长上下文模型。**先算长度再换模型，通常能省下一大笔。**

```python
from transformers import AutoTokenizer

tk = AutoTokenizer.from_pretrained("BAAI/bge-base-zh-v1.5")
lens = sorted(len(tk(t, truncation=False)["input_ids"]) - 2 for t in chunks)  # 去掉 [CLS]/[SEP]
p95 = lens[int(len(lens) * 0.95)]
print(f"块数 {len(lens)} P95 {p95} 最长 {lens[-1]} 超过 512 的块数 {sum(x > 512 for x in lens)}")
```

### 轴三：成本

成本分三笔，很多人只算第一笔：

**1）建库一次性编码费。** 有官方单价时直接算：百炼 `text-embedding-v4` 为 `0.0005 元/千 Token`（Batch 调用 `0.00025 元/千 Token`），`qwen3.7-text-embedding-flash` 为 `0.000125 元/千 Token`（Batch 减半）。换算成常用单位：

| 语料规模 | 平均块长 | 总 token | v4 建库费 | flash 建库费 | v4 Batch |
| --- | --- | --- | --- | --- | --- |
| 500 万块 | 400 token | 20 亿 | 1,000 元 | 250 元 | 500 元 |
| 500 万块 | 800 token | 40 亿 | 2,000 元 | 500 元 | 1,000 元 |
| 5,000 万块 | 400 token | 200 亿 | 10,000 元 | 2,500 元 | 5,000 元 |

自托管没有 token 费，但要用"卡时"替换：把下节脚本测到的 `corpus_s` 除以块数得到单块秒数，再乘你的卡时价。

**2）向量存储费。** 维度直接决定这块，且它随数据量线性增长，比编码费更难省：

| 维度 | 100 万向量 fp32 | 1000 万 fp32 | 1000 万 int8 |
| --- | --- | --- | --- |
| 512（bge-small-zh-v1.5） | 2.0 GB | 20.5 GB | 5.1 GB |
| 768（bge-base-zh-v1.5） | 3.1 GB | 30.7 GB | 7.7 GB |
| 1024（bge-large-zh-v1.5 / bge-m3 / Qwen3-0.6B） | 4.1 GB | 41.0 GB | 10.2 GB |
| 2048 / 4096（Qwen3-4B / 8B 满维） | 8.2 / 16.4 GB | 81.9 / 163.8 GB | 20.5 / 41.0 GB |

（fp32 按 `维度 × 4 字节` 计，未含 HNSW 图结构开销；int8 量化后按 `维度 × 1 字节`。）

**支持 MRL（Matryoshka Representation Learning）的模型可以把维度当成本旋钮**：官方说明 Qwen3-Embedding 全系"支持在所有维度上灵活定义向量"；百炼 `text-embedding-v4` 的可选项为 `2048、1536、1024（默认）、768、512、256、128、64`。把 1024 维截到 256 维通常只掉一点点召回——**但必须在自己的评测集上验证**，别照搬别人的结论：

```python
def mrl_truncate(emb, dim):        # emb 已 L2 归一化时，截断后需重新归一化
    out = emb[..., :dim]
    return out / out.norm(dim=-1, keepdim=True)
```

**3）重排与查询侧的边际成本。** 检索层之外还有 rerank 阶段，见《重排序：Cross-Encoder 精排与 LLM 打分成本对照》。

### 轴四：延迟

一次检索的延迟 = 查询编码 + ANN 检索 + （网络往返）+ 重排。要分开算：

- **查询编码**：本评测实测（CPU、M4、batch=8 摊薄到单查询）见第三节表——BERT 骨干：24M 参数 2ms、102M 12ms、325M 44ms、bge-m3 25ms；LLM 骨干：`Qwen3-Embedding-0.6B`（596M / 28 层）**163ms**。参数量相近（325M vs 596M）时 LLM 骨干慢 4 倍，**这一项随"参数量 × 层数 × 序列长度"增长**，是"效果换延迟"的主战场。
- **ANN 检索**：百万级向量、HNSW 典型 <5ms，不是瓶颈（见《向量检索与相似度：欧氏距离、点积与余弦相似度》）。
- **网络往返**：走 API 时每次请求多一跳，且延迟尾部长尾更明显；离线/内网场景是自托管的硬理由。
- **重排**：Cross-Encoder 要为每个候选对跑一次前向，候选 20 条时通常**比重排前整个检索阶段还贵**——这也是"初检 k 不要开太大"的原因（数字见《重排序：Cross-Encoder 精排与 LLM 打分成本对照》）。

倒推方法：先定检索阶段 P95 预算（例：150ms），再按 `查询编码 + 重排 ≤ 预算 - ANN - 网络` 分配。

## 二、候选模型硬参数（官方口径核对）

| 模型 | 参数 | 输出维度 | 最大输入 | 中文 | 检索用指令 | 许可 |
| --- | --- | --- | --- | --- | --- | --- |
| `BAAI/bge-small-zh-v1.5` | 24.0M（实测权重） | 512 | 512 token | ✅ | `为这个句子生成表示以用于检索相关文章：` | MIT |
| `BAAI/bge-base-zh-v1.5` | 102.3M | 768 | 512 token | ✅ | 同上 | MIT |
| `BAAI/bge-large-zh-v1.5` | 325.5M | 1024 | 512 token | ✅ | 同上 | MIT |
| `BAAI/bge-m3` | 567.8M | 1024（稠密） | 8192 token | ✅ 多语言 100+ | 无 | MIT（权重）/ MIT（代码） |
| `Qwen/Qwen3-Embedding-0.6B` | 0.6B，28 层 | 1024（MRL 可选维度） | 32K | ✅ 多语言 | 建议写（英文） | Apache-2.0 |
| `Qwen/Qwen3-Embedding-4B` | 4B，36 层 | 2560 | 32K | ✅ | 同上 | Apache-2.0 |
| `Qwen/Qwen3-Embedding-8B` | 8B，36 层 | 4096 | 32K | ✅ | 同上 | Apache-2.0 |
| 百炼 `text-embedding-v4` | 官方未公布 | 2048/1536/1024/768/512/256/128/64 | 单条 8192 token | ✅ 100+ 语言 | 控制台调用，无需前缀 | 商业 API |
| 百炼 `qwen3.7-text-embedding`(-flash) | 官方未公布 | 2560…256（flash 1024/768/512/256） | 单条 128,000 token | ✅ 201 语种 | 同上 | 商业 API |

参数与维度核对方式：官方仓库 README 的表格（`curl -sSL https://raw.githubusercontent.com/<org>/<repo>/<branch>/README.md`）、官方模型文件（`config.json` 的 `max_position_embeddings`、`num_hidden_layers`、`hidden_size`）、官方文档页（百炼的模型概览表）；参数量以本地加载权重后 `sum(p.numel())` 实测为准。三处口径不一致时以**模型文件**为准，并在文中标注。

补充两点容易忽略的：

- **bge-m3 的一个模型三种输出**：官方描述为 "Multi-Functionality(dense retrieval, sparse retrieval, multi-vector(colbert))"。想用 SPLADE 式稀疏检索又不想再训一个模型，它是当前最省事的开源选择（多向量用法见《多向量检索与 ColBERT/ColPali：后期交互的用法与选型》）。
- **`bge-multilingual-gemma2` / `bge-en-icl`** 是 LLM 骨干（gemma-2-9b 级）的嵌入模型，官方称在多语言基准上取过 SOTA；`bge-en-icl` 靠"给少样本示例"来增强查询表示，属于"效果换工程复杂度"的路线，中文场景一般先不上。

## 三、可复现的本地评测脚本

这份脚本是本模块的**共用评测集**：45 篇中文运维/后端知识块、10 条查询、分级标注（2=完全相关、1=部分相关）。《重排序：Cross-Encoder 精排与 LLM 打分成本对照》与《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》都基于它。

### 1. 环境

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install "sentence-transformers>=6.1" "transformers>=4.51" numpy "rank-bm25==0.2.2" "jieba>=0.42.1"
# 权重走 Hugging Face；国内网络不可达时改用 ModelScope 镜像（同一批官方权重）
pip install modelscope
python -c "from modelscope import snapshot_download; print(snapshot_download('BAAI/bge-base-zh-v1.5'))"
```

### 2. 评测集：`corpus_zh.py`

```python
# -*- coding: utf-8 -*-
"""45 篇中文运维/后端知识 + 10 条查询 + 分级标注（2=完全相关 / 1=部分相关）。"""

LONG_SOP = (
    "### 冷机群控失效应急处置 SOP（节选，全文 12 页）\n"
    "适用范围：A/B 数据楼冷冻水系统，3 台离心式冷机 + 2 台变频基载泵，群控由 BA 系统承担。\n"
    "第 1 步 判断群控是否失联：在 BA 前端查看冷机控制器的 Modbus 心跳寄存器，心跳值 5 秒内应自增一次；"
    "若三个心跳寄存器全部静止，说明群控网关与控制器之间通讯中断，此时冷机不会按负荷需求加减机，"
    "回水温度将持续上升。\n"
    "第 2 步 立即切手动：把群控面板上三台冷机的控制权开关全部打到 LOCAL，手动启两台基载机、"
    "维持 7℃ 供水 12℃ 回水的设定值，先保证供冷不断，再排查通讯。\n"
    "第 3 步 检查网关供电与光纤：网关电源模块常见故障是 24V 直流电源适配器烧损，看面板指示灯；"
    "光纤收发器对光时用红光笔逐芯打光，注意法兰盘污损会导致误码率升高而非完全断链，"
    "表现为心跳寄存器偶发自增、控制指令时通时不通。\n"
    "第 4 步 核对 Modbus 点表版本：冷机厂家在 2023 年的固件升级里把“加减机使能”寄存器地址从 "
    "40021 挪到了 40155，BA 侧若沿用旧点表，会出现“心跳正常但机组不动作”的现象，"
    "这是本次故障最容易被误判为冷机本体问题的一步。此时应当用 Modbus Poll 直连控制器读原始寄存器，"
    "与点表逐条比对，改点后必须重新做 5 分钟持续写入测试，确认无 CRC 校验错误。\n"
    "第 5 步 通讯恢复后的复盘项：确认加减机逻辑恢复正常、检查夜间低负荷时段是否发生过冷冻水旁通阀全开、"
    "核对群控历史趋势中供水温度的偏差是否超过 ±0.5℃，并把误判时长、人工介入时刻写入事件单。\n"
    "第 6 步 升级：若 30 分钟内无法恢复群控，联系厂家远程接入，同时保持两台冷机手动运行、"
    "开启备用精密空调，重点关注 IT 负荷最高机柜列的回风温度是否突破 32℃ 的 P1 阈值。\n"
    "附注：本 SOP 的冷机切换时间常数为 6 分钟，群控自动模式下加减机间隔不得低于该值，否则会触发压缩机防喘振保护。"
)

PASSAGES = [
    ("d01", "机房温度告警的默认阈值是回风温度 27℃，连续 5 分钟超过即触发 P2 告警。湿度低于 20% 时静电风险上升，需要开启加湿。"),
    ("d02", "UPS 电池组巡检重点看单节浮充电压离散度和内阻趋势，内阻较出厂值上升 20% 以上就该整组评估更换，不要只换落后单体。"),
    ("d03", "机柜功率密度超过 8kW 时建议改用行级空调或冷通道封闭，避免局部热点。传统房间级空调在高密度场景下制冷效率明显下降。"),
    ("d04", "双路供电的 A/B 路必须来自不同变压器母线，否则市电闪断时两路同时失电，冗余形同虚设。验收时要核对配电柜一次系统图。"),
    ("d05", "柴油发电机带载测试建议每月空载 15 分钟、每季度带载 30 分钟，长期只空载会造成湿堆积，实际市电中断时无法顶上来。"),
    ("d06", "防静电地板下的走线要区分强弱电并分侧布置，线缆开孔处必须做防火封堵，空调静压箱兼做走线空间时要核算送风量损失。"),
    ("d07", "动环监控采集失败常见原因是串口服务器掉线或 Modbus 点表地址被厂家升级后改动，先读原始寄存器再判断设备本体是否故障。"),
    ("d08", LONG_SOP),
    ("d10", "Kubernetes 中 Pod 被 OOMKilled 时 lastState.reason 为 OOMKilled，容器退出码 137。JVM 容器化要把 MaxRAMPercentage 设为 75 左右，避免堆外内存把容器顶爆。"),
    ("d11", "kubectl top nodes 依赖 metrics-server，指标缺失时优先看 apiserver 到 kubelet 的 10250 端口连通性，而不是重启节点。"),
    ("d12", "Deployment 滚动更新卡住时先查 Pod 的 Events：镜像拉取失败、PVC 未绑定、就绪探针 404 是三类最常见原因。"),
    ("d13", "集群网络插件选 Calico 时，BGP Peer 全 Established 只代表控制面正常，转发问题要看节点间 ICMP 与 MTU 是否一致（VXLAN 模式下 MTU 需下调 50）。"),
    ("d14", "节点 NotReady 且 kubelet 日志报 PLEG 超时，多半是容器运行时僵死或磁盘 IO 打满，先 crictl ps 确认运行时响应再决定驱逐。"),
    ("d15", "Helm 升级报 release name conflicts 时，检查是否残留 failed 状态的 release，用 helm history 与 helm rollback 而不是删 Secret。"),
    ("d20", "Java 进程 CPU 100% 的排查顺序：top -H 找线程号、printf 转 16 进制、jstack 抓栈匹配 nid，热点通常集中在 GC 线程或正则回溯。"),
    ("d21", "Full GC 频繁的判别：jstat -gcutil 看到 O 区回收后仍接近 100%，是内存泄漏；O 区能降下来但 Young GC 频繁，是分配速率过高或晋升阈值不合理。"),
    ("d22", "G1 回收器的目标是最长停顿时间，-XX:MaxGCPauseMillis 设得过小会让年轻代被压缩、GC 次数反而上升。堆大于 8GB 时再考虑 ZGC。"),
    ("d23", "线程池要把核心线程数与队列长度一起配置，无界队列会让最大线程数永远不生效，故障表现为任务堆积而不是拒绝异常。"),
    ("d24", "NPE 上线前的兜底：对外部接口返回的嵌套对象统一用 Optional 或空对象模式，别指望 IDE 的空值注解在运行时生效。"),
    ("d30", "MySQL 主从复制延迟可用 Seconds_Behind_Master 观测，但该值在大事务或 DDL 场景下会失真，更可靠的判断是比对主从的 GTID 执行集合。"),
    ("d31", "MySQL 事务隔离级别默认 REPEATABLE READ，RR 下靠间隙锁防幻读；线上改成 READ COMMITTED 前要确认 binlog_format=ROW，否则不确定语句会写坏从库。"),
    ("d32", "慢查询里出现 Using filesort 且扫描行数很大时，先看索引顺序能否覆盖 order by，再考虑调大 sort_buffer_size，后者只是止痛。"),
    ("d33", "在线加字段用 pt-online-schema-change 或 gh-ost，直接 ALTER 大表会长时间持有元数据锁，把后面的业务查询全部堵住。"),
    ("d34", "连接池打满时先看应用侧空闲连接回收时间是否长于 MySQL 的 wait_timeout，两边不匹配会稳定产生 Communications link failure。"),
    ("d40", "Redis 集群模式下跨 slot 的多 key 命令会报 CROSSSLOT，需要用 hash tag 把相关 key 落到同一 slot，例如 user:{1001}:profile。"),
    ("d41", "Redis 大 key 会造成命令阻塞与迁移失败，用 redis-cli --bigkeys 或 SCAN 加 MEMORY USAGE 排查。String 超过 10KB、集合元素超过 5000 建议拆分。"),
    ("d42", "缓存与数据库一致性优先做“更新库后删缓存 + 延迟双删”，不要试图在一个事务里同时改两者；读多写少场景再加 binlog 订阅兜底。"),
    ("d43", "Redis 内存达到 maxmemory 且策略为 allkeys-lru 时，带 EXPIRE 的 key 也可能被驱逐，别把缓存实例当持久存储用。"),
    ("d50", "Kafka 消费堆积先看是分区数不足还是单线程处理能力到顶： Lag 均匀分布且只有一两个消费者有延迟，通常是消费逻辑里有同步外部调用。"),
    ("d51", "Kafka 副本 ISR 频繁收缩，网络维度上排查 broker 间带宽与 acks 配置，磁盘维度看 recovery 线程是否在被大 segment 拖累。"),
    ("d52", "消息重复消费无法靠 Kafka 本身避免，幂等要在业务侧落地：唯一键 + 去重表或按业务主键做 upsert。"),
    ("d53", "RocketMQ 事务消息的回查逻辑必须幂等且快速，回查超时会不断重试，半消息堆积在队列里会放大故障面。"),
    ("d60", "Nginx 502 与 504 的区别：502 多为上游连接被拒或协议不匹配，504 是 proxy_read_timeout 到点；先确认上游端口连通性再改超时。"),
    ("d61", "upstream keepalive 必须配合 proxy_http_version 1.1 与清空 Connection 头，否则每次请求重新握手，峰值时 TIME_WAIT 堆积。"),
    ("d62", "内网 DNS 解析抖动的定位顺序：resolv.conf 的 options 配置、conntrack 表是否满导致 UDP 53 丢包、上游 DNS 转发链路 RTT。"),
    ("d63", "TLS 证书链不完整在 Android 与 curl 上表现不一致，验证方式是从服务端抓全链并用 openssl s_client -servername 逐段核对。"),
    ("d64", "安全组只放行到业务端口的入方向规则，管理端口通过堡垒机跳转，别把 0.0.0.0/0 的临时规则留到生产。"),
    ("d70", "告警分级按三条线划分：是否影响可用性、用户是否可感知、是否需要即时介入。P1 只留给大面积不可用，其余降级处理。"),
    ("d71", "值班群里几十条告警同时炸、真正要处理的只有一件，这就是告警疲劳。治理手段是收敛同源告警、按服务拓扑做根因归并、给低优先级告警做静默窗口。"),
    ("d72", "Prometheus 抓取目标突然消失，先看 target 的 endpoints 是否随 Service 标签变化被重建，再看 relabel_configs 是否把新 Pod 过滤掉了。"),
    ("d73", "日志采集链路容量核算：峰值每秒行数 × 平均字节数 × 副本数，任何一段队列的缓冲时间要覆盖下游最长得多的恢复时间。"),
    ("d74", "Trace 采样不能只按比例，错误与慢请求必须强制保留，否则最需要看链路的场景恰好没有数据。"),
    ("d80", "磁盘 IO 高但吞吐量不高时，用 iostat -x 看 await 与 %util 并配合 biosnoop 定位随机小 IO，通常是 fsync 密集的数据库刷盘。"),
    ("d81", "Linux 的 dirty ratio 配置过高会让写回一次性爆发，表现为周期性卡顿；把 dirty_background_ratio 压到 5 左右通常能消掉毛刺。"),
    ("d82", "TCP 连接大量 CLOSE_WAIT 是应用没 close 套接字，属于代码问题；TIME_WAIT 多则是主动关闭方的正常状态，可用 tw_reuse 缓解但要评估 NAT 场景。"),
]

QUERIES = {
    "q1": "机柜功率密度太高怎么降温",
    "q2": "Pod 内存超限被杀是什么原因",
    "q3": "MySQL 主从同步延迟怎么看",
    "q4": "告警太多值班疲于应对，怎么治理",
    "q5": "Redis 集群报 CROSSSLOT",
    "q6": "网关偶尔 504，上游没响应",
    "q7": "群控没指令、机组不动作，怀疑点表被改",   # 正确答案在 d08 的中后段
    "q8": "Full GC 之后老年代还是满的",
    "q9": "消息队列消费越堆越多",
    "q10": "内网域名解析时好时坏",
}

QRELS = {
    "q1": {"d03": 2, "d01": 1, "d06": 1},
    "q2": {"d10": 2, "d14": 1},
    "q3": {"d30": 2, "d31": 1},
    "q4": {"d71": 2, "d70": 1, "d72": 1},
    "q5": {"d40": 2, "d41": 1},
    "q6": {"d60": 2, "d61": 1, "d63": 1},
    "q7": {"d08": 2, "d07": 1},
    "q8": {"d21": 2, "d22": 1, "d20": 1},
    "q9": {"d50": 2, "d53": 1, "d51": 1},
    "q10": {"d62": 2, "d82": 1},
}

IDS = [d for d, _ in PASSAGES]
TEXTS = dict(PASSAGES)
```

### 3. 指标与两个检索器

指标实现与《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》一致（分级增益 `2^g-1`，折扣 `log2(rank+1)`）：

```python
import math
import re

import jieba
import numpy as np

import corpus_zh as C

jieba.setLogLevel(60)
STOP = set("的 了 是 在 和 与 会 要 可 以 及 对 中 上 下 时 为 个 这 那 也 都 就 不 吗 呢 ".split())
KS = (1, 3, 5, 10)


def tok(text):
    """jieba 切词 + 去停用词/单字：BM25 基线用。"""
    text = re.sub(r"\s+", "", text.lower())
    return [t for t in jieba.lcut(text) if len(t) > 1 and t not in STOP]


def recall_at_k(ranked, qrel, k):
    rel = {d for d, g in qrel.items() if g > 0}
    return len({d for d, _ in ranked[:k]} & rel) / len(rel)


def precision_at_k(ranked, qrel, k):
    rel = {d for d, g in qrel.items() if g > 0}
    return len({d for d, _ in ranked[:k]} & rel) / k


def mrr_at_k(ranked, qrel, k):
    for pos, (d, _) in enumerate(ranked[:k], start=1):
        if qrel.get(d, 0) > 0:
            return 1.0 / pos
    return 0.0


def ndcg_at_k(ranked, qrel, k):
    """第 i 名（从 0 数起）的折扣是 1/log2(i+2)：名次 1 折扣 1.0、名次 2 折扣 0.63。"""
    dcg = sum((2 ** qrel.get(d, 0) - 1) / math.log2(i + 2) for i, (d, _) in enumerate(ranked[:k]))
    ideal = sorted(qrel.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else 0.0


def bm25_search():
    """BM25 基线：必须剔除 0 分文档，否则指标会被并列 0 分的随机项污染。"""
    from rank_bm25 import BM25Okapi

    bm25 = BM25Okapi([tok(t) for _, t in C.PASSAGES], k1=1.2, b=0.4)

    def search(query, k):
        scores = bm25.get_scores(tok(query))
        order = [i for i in np.argsort(-scores) if scores[i] > 0]
        return [(C.IDS[i], float(scores[i])) for i in order[:k]]

    return search


def embedding_search(model, query_prefix=""):
    """稠密检索：文档侧不加指令、查询侧按需加指令，顺带把延迟量出来。

    返回 (search, stats)。search(query, k) -> [(doc_id, 相似度), ...]，已按分数降序。
    """
    import time

    docs = [t for _, t in C.PASSAGES]
    qtexts = list(C.QUERIES.values())
    qindex = {q: i for i, q in enumerate(qtexts)}

    t0 = time.perf_counter()
    d_emb = model.encode(docs, batch_size=8, normalize_embeddings=True)
    corpus_s = time.perf_counter() - t0

    t0 = time.perf_counter()
    q_emb = model.encode([query_prefix + q for q in qtexts], batch_size=8, normalize_embeddings=True)
    query_ms = (time.perf_counter() - t0) / len(qtexts) * 1000

    sims = q_emb @ d_emb.T          # 归一化后内积 == 余弦相似度

    def search(query, k):
        i = qindex[query]
        order = np.argsort(-sims[i])[:k]
        return [(C.IDS[j], float(sims[i][j])) for j in order]

    stats = {
        "dim": int(d_emb.shape[1]),
        "params_M": sum(p.numel() for p in model.parameters()) / 1e6,
        "max_seq": int(model.max_seq_length),
        "corpus_s": corpus_s,
        "query_ms": query_ms,
    }
    return search, stats
```

### 4. 主流程：跑指标 + 量延迟 + 查截断

把 §3.2 存成 `corpus_zh.py`、§3.3 存成 `emb_bench.py`，下面这段存成 `run_bench.py` 放在同一目录运行：

```python
import numpy as np
import torch
from sentence_transformers import SentenceTransformer

import corpus_zh as C
from emb_bench import KS, bm25_search, embedding_search, mrr_at_k, ndcg_at_k, recall_at_k

torch.set_num_threads(8)                      # 固定线程数，否则同机对比不可比

MODEL_IDS = [
    ("BAAI/bge-small-zh-v1.5", "为这个句子生成表示以用于检索相关文章："),
    ("BAAI/bge-base-zh-v1.5", "为这个句子生成表示以用于检索相关文章："),
    ("BAAI/bge-large-zh-v1.5", "为这个句子生成表示以用于检索相关文章："),
    ("BAAI/bge-m3", ""),                       # 官方：bge-m3 检索无需指令
    ("Qwen/Qwen3-Embedding-0.6B", ""),         # 更规范的写法是 model.encode(q, prompt_name="query")
]


def evaluate(search, label, extra=""):
    ranked = {qid: search(q, max(KS)) for qid, q in C.QUERIES.items()}
    mean = lambda k, fn: np.mean([fn(ranked[q], C.QRELS[q], k) for q in C.QUERIES])
    print(f"{label}{extra} | R@1 {mean(1, recall_at_k):.3f} R@3 {mean(3, recall_at_k):.3f} "
          f"R@5 {mean(5, recall_at_k):.3f} R@10 {mean(10, recall_at_k):.3f} "
          f"nDCG@10 {mean(10, ndcg_at_k):.3f} MRR@10 {mean(10, mrr_at_k):.3f}")
    return ranked


evaluate(bm25_search(), "BM25(jieba)")

for name, prefix in MODEL_IDS:
    # 国内网络取不到 Hugging Face 时：modelscope.snapshot_download(name) 后把返回的本地路径传进来
    model = SentenceTransformer(name, device="cpu")
    search, st = embedding_search(model, prefix)

    # 用本模型自己的分词器数一遍块长，判断谁被静默截断
    lens = {d: len(model.tokenizer(t, truncation=False)["input_ids"]) for d, t in C.PASSAGES}
    trunc = sum(v > st["max_seq"] for v in lens.values())

    evaluate(search, name,
             extra=f"[{st['params_M']:.1f}M {st['dim']}d seq{st['max_seq']} 截断{trunc} "
                   f"最长{lens['d08']} 语料{st['corpus_s']:.2f}s 单查询{st['query_ms']:.0f}ms]")
```

### 5. 实测结果（本机 macOS / Apple M4 / 16GB / CPU 推理，2026-09-19）

同一份 `corpus_zh.py`，用 §3.2—§3.4 的代码原样执行（`torch.set_num_threads(8)`）。延迟列在同机多次运行间有 ±40% 波动，量级可信、个位数别较真：

| 模型 | 参数(M) | 维度 | max_seq | 被截断块数 | 最长块 token | recall@1 | recall@3 | recall@5 | recall@10 | nDCG@10 | MRR@10 | 语料编码(s) | 单查询(ms) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BM25(jieba) | — | — | — | — | — | 0.317 | 0.533 | 0.583 | 0.583 | 0.709 | 0.850 | ≈0 | ≈0 |
| `bge-small-zh-v1.5` | 24.0 | 512 | 512 | 1 | 718 | 0.417 | 0.717 | 0.750 | 0.850 | 0.882 | 1.000 | 0.55 | 2 |
| `bge-base-zh-v1.5` | 102.3 | 768 | 512 | 1 | 718 | 0.367 | 0.650 | 0.800 | 0.900 | 0.893 | 0.950 | 3.00 | 12 |
| `bge-large-zh-v1.5` | 325.5 | 1024 | 512 | 1 | 718 | 0.383 | 0.800 | 0.833 | 0.900 | 0.915 | 0.950 | 11.38 | 44 |
| `bge-m3` | 567.8 | 1024 | 8192 | 0 | 633 | 0.333 | 0.650 | 0.817 | 0.850 | 0.859 | 0.900 | 9.60 | 25 |
| `Qwen3-Embedding-0.6B` | 595.8 | 1024 | 32768 | 0 | 623 | 0.417 | 0.817 | 0.933 | 1.000 | 0.977 | 1.000 | 149.20 | 163 |

（表内 `Qwen3-Embedding-0.6B` 一行按 §3.4 代码的写法：查询侧不拼指令前缀。改成官方推荐的 `model.encode(queries, prompt_name="query")` 后，本例变为 recall@5 0.900、nDCG@10 0.960——**指令在这份中文短块语料上不但没带来官方经验值说的 1~5% 提升，反而降了 3 个点**。这正是第五节"指令/前缀用法不同"那条偏差的现场版本：任何经验值都要在自己语料上重跑一次。）

这张表是**这台机器、这份语料**的结果，别当成通用结论。它真正说明的是下面几件事：

1. **中文语义检索完胜 BM25**：recall@5 从 0.583 → 0.75~0.93。差距全部来自"用户口语与文档措辞不共享词"的查询（`q4 告警太多值班疲于应对` 对应文档里的"告警疲劳"、`q9 消息越堆越多` 对应"消费堆积"）。这类失败 BM25 无解，见《混合检索：真正的 BM25、RRF 融合与生产实现》。
2. **small → base → large 收益递减、延迟上升更快**：recall@5 0.750 / 0.800 / 0.833，单查询 2ms / 12ms / 44ms。参数放大 13 倍换 8 个点、延迟放大 22 倍，**CPU 场景 base 是甜点**（small 的 2ms 适合高并发兜底）。
3. **bge-m3 在这份中文短块语料上没赢过 bge-large-zh-v1.5**：recall@5 0.817 vs 0.833、nDCG@10 0.859 vs 0.915（参数量 1.7 倍，实测查询延迟反而更低：25ms vs 44ms）。原因很朴素：它的主场是**多语言 + 8192 长文本 + 一份模型同时给稠密/稀疏/多向量三种检索**，而这份语料平均每块只有 66 token（中位 51）。**用不上长文与多路检索时，选它是拿排序质量换一份"以后可能用得上"的能力。**
4. **`Qwen3-Embedding-0.6B` 是这份表里的效果冠军（recall@5 0.933、recall@10 1.000、nDCG@10 0.977、MRR@10 1.000），也是延迟冠军的反面：单查询 163ms、45 块语料编码 149 秒**——分别是 `bge-large-zh-v1.5` 的 3.7 倍与 13 倍。它是 0.6B 的**因果 LM**（last-token pooling，28 层），序列里每个 token 都要过一次解码；整库编码 13 倍的差距就是建库时要付的钱。**结论："要不要上 LLM 骨干的嵌入模型"本质是一道部署题**——有 GPU（或直接走同为 Qwen3-Embedding 系列的托管 API）值得试，只有 CPU 就得先看这条延迟。
5. **`q7` 这条查询是截断的教科书案例**：45 个块里只有 `d08`（冷机群控 SOP，718 token）超 512，三个 512 窗口的 bge 模型都把它截断（脚本"被截断块数"列 = 1），答案所在的"第 4 步 核对 Modbus 点表版本"落在被丢掉的后半段；bge-m3 的窗口是 8192，同一篇块在它自己的分词器下是 633 token，**不截断**。**结论：这份语料里"换长上下文模型"能直接解决的只有 1/10 的查询；剩下 9/10 该靠模型规模或检索结构，别为一个个例付全局的延迟。**

## 四、MTEB 榜单怎么读

MTEB（Massive Text Embedding Benchmark）是"多模态评测工具箱 + Hugging Face 上的交互式排行榜"（`pip install mteb`）。读它的正确姿势：

1. **先选 benchmark，再看分数**。MTEB 已不是一个榜单，而是一族：`MTEB(eng, v2)`、`MTEB(cmn, v1)`、`MMTEB`、`MTEB(Code)`……论文自己说得很清楚——MTEB 覆盖 **8 类任务、58 个数据集、112 种语言**，并且"没有哪种嵌入方法能在所有任务上占优"（arXiv:2210.07316 摘要）。后来的 MMTEB（arXiv:2502.13595）扩到 **500+ 任务、250+ 语言**，并新增了指令跟随、**长文档检索**、代码检索。选错 benchmark，看到的排名就是无效信息。
2. **`Mean(Type)` 与 `Mean(Task)` 不是一回事**。前者先按任务类型取平均再平均（8 类任务权重相同），后者把所有任务直接平均（任务多的类型权重大）。官方 Qwen3-Embedding README 的三张表就同时给了两列，例如 MTEB(Eng v2) 里 `Qwen3-Embedding-0.6B` 是 Mean(Task) 70.70 / Mean(Type) 64.88——同一个模型两个"总分"差 5.8 分。**看到"平均分"先问是哪一种。**
3. **检索只是其中一类**。同一张表里 Retri. 这一列才是你要的：`Qwen3-Embedding-0.6B` 在 C-MTEB 上 Mean(Type) 67.45、Retr. 71.03，而 `bge-multilingual-gemma2`（9B）Retr. 73.73。**总分高不代表检索高。**
4. **中文要看 C-MTEB 的检索列**。官方 C-MTEB 榜单（FlagEmbedding 仓库内表）节选：

   | 模型 | 维度 | 总 Avg | Retrieval | STS | Classification |
   | --- | --- | --- | --- | --- | --- |
   | `bge-large-zh-v1.5` | 1024 | 64.53 | 70.46 | 56.25 | 69.13 |
   | `bge-base-zh-v1.5` | 768 | 63.13 | 69.49 | 53.72 | 68.07 |
   | `bge-small-zh-v1.5` | 512 | 57.82 | 61.77 | 49.11 | 63.96 |
   | `m3e-base` | 768 | 57.10 | 56.91 | 50.47 | 67.52 |
   | `multilingual-e5-large` | 1024 | 58.79 | 63.66 | 48.44 | 67.34 |

   注意"总 Avg"与"Retrieval"经常不排序一致——`m3e-base` 的 Avg 比 `multilingual-e5-large` 还低一点，Retrieval 也更低，但**它 Retrieval 列的 56.91 完全掩盖了下面这句话**：C-MTEB 的检索是 8 个子数据集，`m3e-base` 在 `CmedqaRetrieval`（医疗问答检索）上只有 **30.33**，在 `T2Retrieval` 上有 **73.14**。**同一个模型在同一语言的不同领域能差 40+ 个点。** 这就是"榜单分数不能直接搬进业务"最直观的证据。
5. **看分数来自谁的手**。排行榜的提交是自助的（作者自己跑、自己上传），MTEB 团队不做逐条复算；官方 README 甚至专门给出"如何把模型提交到排行榜"的文档章节。跨作者、跨硬件、跨 `max_seq` 设置跑出的分数被放在同一列里排序。

## 五、榜单分数为什么不等于你的业务效果

| 偏差来源 | 机制 | 怎么自查 |
| --- | --- | --- |
| **任务类型错位** | 榜单总平均分把聚类、STS、重排、分类混在一起；RAG 主要吃"句子到段落检索" | 只看 Retrieval 列，最好只看你语言/你领域的子集 |
| **域分布错位** | 榜单检索数据集多为**短查询 + 单跳事实 + 维基百科式段落**；你的语料是内部 SOP、工单、代码注释 | 用自有查询集复测（下节配方）；IRB 论文《Moving Beyond Downstream Task Accuracy for Information Retrieval Benchmarking》（arXiv:2212.01340）专讲这件事 |
| **只测准确率、不测代价** | IRB 的核心主张：主流 IR 基准只报下游精度，掩盖了**延迟与硬件成本**；换不同代价预算，最优系统会变。本模块实测里 bge-m3 vs bge-large-zh-v1.5 就是活例：分数相近、代价差 1.7 倍 | 报告里永远同时写 `recall@k + 延迟 + 维度`，只比"同代价档"内的分数 |
| **块长与截断设定不同** | 有人 512、有人 8192；榜单不会告诉你作者把长文档截了几刀 | 用第四节脚本打印"被截断块数"，与你的真实块长分布对照 |
| **指令/前缀用法不同** | bge-*-zh 要指令、bge-m3 不要、Qwen3 建议要；漏掉或多加都能刷出分 | 同一份代码里对每个模型按官方口径处理（本文脚本已如此） |
| **标注口径不同** | 榜单用现成 qrels；你业务的"相关"可能是"这份 SOP 的第 4 步"，粒度不同 | 用分级标注（2/1/0），并让写查询的人不看文档 |
| **训练数据污染** | 公开基准的样本可能进了预训练语料，分数虚高在"背过"的部分 | 用**内部新查询**（上线后一周的真实提问）定期重测 |
| **版本与快照** | 榜单快照会变（官方 README 注明对比模型的分数是"2025-06-06 抓自在线排行榜"）；模型也可能被静默更新 | 记录 `snapshot revision` 与抓取日期，写进你的选型结论 |

**最小可用自查方案**：100-200 条真实查询 + 每查询 2-4 篇分级标注（1 小时人工），复用本模块的 `corpus_zh.py` 结构换成你的语料，跑第四节脚本 → 得到一张"只有你自己的数字"的表。它的绝对值不好看没关系，**用它做 A/B**：换模型、换分块、加不加 BM25、加不加 rerank，都在同一张表上比。指标的算法与阈值取法见《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》，端到端指标见《RAG 评估实战：RAGAS 指标、LLM 裁判与可跑的确定性兜底》。

## 常见坑

1. **只在"能不能跑通"层面换模型**：换个 embedding 模型要重建整个索引（不同模型的向量空间不通用，`bge-small` 的索引不能被 `bge-large` 查询）。上线前先确认你能承担**双写 + 灰度**：新旧索引并存、按流量切换，见《生产化 RAG：可靠管线与常见问题排查》。
2. **忘了查询侧与文档侧要同模型同指令**：文档侧加了指令、查询侧没加（或反过来），召回会莫名其妙变差且没有报错。
3. **把 `normalize_embeddings=True` 省掉**：归一化后用内积即等于余弦；不归一化时用内积等于"点积相似度"，长块分数天然更高（见《向量检索与相似度：欧氏距离、点积与余弦相似度》）。**度量必须与模型训练时一致。**
4. **模型名与库版本对不上**：`Qwen3-Embedding` 系列要求 `transformers>=4.51`（低版本会 `KeyError: 'qwen3'`）、`sentence-transformers>=2.7` 才支持它的 `prompt_name="query"` 用法；`FlagEmbedding` 与 `sentence-transformers` 对同一模型的指令处理方式不同，混用时务必打印一次向量余弦自检。
5. **用 `float16` 省显存却抱怨分数**：`use_fp16=True` 有轻微精度损失（官方注释原话），线上要固定精度并在评测集上量一次差值；同一条坑适用于 int8 向量量化。
6. **只测检索、不测重排后的收益**：召回 0.85 时 rerank 有肉，召回 0.95 时 rerank 是纯加延迟（见《重排序：Cross-Encoder 精排与 LLM 打分成本对照》）。
7. **拿英文榜单推中文**：`MTEB(eng, v2)` 里没有你的中文查询；反过来 C-MTEB 也无法说明它的多语言表现。
8. **把 API 当"零运维"**：批量回填历史文档时，8192 token/条、10 条/请求这类**接口限制**会决定实际耗时；百炼 v3/v4 的单次 10 条上限意味着 500 万块要 50 万次请求（Batch 通道更划算）。

## 延伸阅读

- [FlagOpen/FlagEmbedding](https://github.com/FlagOpen/FlagEmbedding)（MIT）：BGE 全系模型清单、指令写法、`FlagAutoModel` / 评估示例。
- [QwenLM/Qwen3-Embedding](https://github.com/QwenLM/Qwen3-Embedding)（Apache-2.0）：尺寸表、MRL、指令建议、与三家 reranker 的对照分数；技术报告 arXiv:2506.05176。
- [embeddings-benchmark/mteb](https://github.com/embeddings-benchmark/mteb)（Apache-2.0）与 [排行榜](https://huggingface.co/spaces/mteb/leaderboard)：如何选 benchmark、如何提交结果。
- MTEB（arXiv:2210.07316）、MMTEB（arXiv:2502.13595）、IRB（arXiv:2212.01340）：读榜单前值得各读一遍摘要。
- [阿里云百炼：通用文本向量同步接口](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)：维度可选项、单条 token 上限、批量上限与单价。
- 站内相关：《Embedding 深入：从语义向量到语义搜索》《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《混合检索：真正的 BM25、RRF 融合与生产实现》《重排序：Cross-Encoder 精排与 LLM 打分成本对照》《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》《多向量检索与 ColBERT/ColPali：后期交互的用法与选型》。

---

> **来源**：抓取于 2026-09-19。模型参数与许可核对自以下一手来源，逐节署名如下：BGE 模型清单、指令写法与里程碑——[FlagOpen/FlagEmbedding README](https://github.com/FlagOpen/FlagEmbedding)（BAAI，MIT）；C-MTEB 分数表——[FlagEmbedding/research/C_MTEB](https://github.com/FlagOpen/FlagEmbedding/tree/master/research/C_MTEB)（MIT）；Qwen3-Embedding 尺寸表、指令经验值、MTEB/C-MTEB/Reranker 对照分数——[QwenLM/Qwen3-Embedding README](https://github.com/QwenLM/Qwen3-Embedding)（Qwen 团队，Apache-2.0）；MTEB 定位、安装与引用说明——[embeddings-benchmark/mteb README](https://github.com/embeddings-benchmark/mteb)（Apache-2.0）；跨模型权重许可同时核对了官方仓库 LICENSE 文件与模型注册表元数据（bge-*-zh-v1.5/bge-m3 为 MIT，bge-reranker-v2-m3/Qwen3-Embedding 为 Apache-2.0）；API 规格与单价——[阿里云百炼通用文本向量 API 文档](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)、[文本排序 API 文档](https://help.aliyun.com/zh/model-studio/text-rerank-api)。
> 编者注：第三节的评测集（45 块 / 10 查询 / 分级标注）由本站编写，不含真实生产数据；第五列起的表格数字为同一脚本在 macOS + Apple M4 + 16GB + CPU 推理、`sentence-transformers 6.1.0` / `torch 2.14.0` 下的实测输出，换硬件与线程数延迟会明显变化，指标列可复现。原仓库 README 中的徽章、二维码、视频链接与纯装饰元素未收录；`bge-m3` 的稀疏/多向量输出与 `Qwen3-Embedding-4B/8B` 未纳入本地实测（受本机内存限制），其参数仅按官方口径列出。
