---
title: 长上下文的有效利用：Lost in the Middle 与位置偏置
source_url: https://arxiv.org/abs/2307.03172
author: Nelson F. Liu、Kevin Lin、John Hewitt、Ashwin Paranjape、Michele Bevilacqua、Fabio Petroni、Percy Liang（TACL 2023）· 本站编译
license: MIT（官方代码仓库 nelson-liu/lost-in-the-middle）· arXiv 预印本署名编译
fetched_at: 2026-09-19
translated: true
versions: TACL 2023 版 · RULER（arXiv:2404.06654）· NoLiMa（arXiv:2502.05167）· MRCR 长上下文检索口径
order: 9
group: 开发者必知的模型行为
---
## 一、为什么需要它：窗口是容量，不是性能

《Token 与上下文窗口》已经讲清了一个事实：上下文窗口决定你**装得下**多少内容。但"装得下"和"用得上的"是两件事。DeepSeek 在介绍 V4 的一百万 token 窗口时说得很直白：

> 一百万 token 的上下文窗口只是容量（capacity），不是性能。你能否真的用上它，取决于在这个深度上每次前向传播的成本。

还有第二重折扣：**即使算得起，模型也不会均匀地看你塞进去的每一段**。信息放在开头、中间还是结尾，会显著改变模型对它的利用率。这正是 2023 年那篇被引用最多的长上下文论文——*Lost in the Middle: How Language Models Use Long Contexts*（Liu et al., TACL 2023）——的结论，也是本篇的主题。

为什么开发者要在意这个？因为今天几乎所有长文本工作负载都建立在"把资料塞进上下文"这个假设上：整仓代码、整本合同、几十轮 Agent 轨迹、RAG 召回的 top-k 片段。如果这段内容落在上下文中段，它可能**等于没给**，甚至**比不给更糟**——这是排查"模型明明拿到了资料却答非所问"时最容易被忽略的一条原因。

## 二、论文在测什么：两个任务，一条 U 形曲线

### 2.1 多文档问答：把答案文档放到不同位置

协议很干净：给模型 10 / 20 / 30 篇文档（Wikipedia 段落，每篇至多 100 token），恰好一篇含答案，其余是按相关性排下来的干扰文档；把**含答案的那篇**换到第 1 篇到第 n 篇的不同位置，看准确率怎么变。作者还特意做了对照：**把干扰文档随机打乱、并在任务描述里声明顺序是随机的，结论不变**——U 形不是"检索结果按相关性排"这个先验造成的。

结论：**性能曲线是 U 形的**——相关信息出现在上下文**开头（primacy bias，首因效应）或结尾（recency bias，近因效应）**时表现最好，落在**中间**时显著下降。量级不是统计噪声：

- GPT-3.5-Turbo 在这个任务上会因位置变化**掉超过 20 个百分点**；最坏情况下，20/30 文档设置中段的准确率**比完全不给文档的闭卷还低**（闭卷基线 56.1%）；
- 论文的另一层结论同样重要：**扩大窗口的模型并不更会用上下文**。GPT-3.5-Turbo 与 16K 版本在窗口都装得下的 10/20 文档设置里，两条位置曲线几乎重合——把窗口从 4K 扩到 16K，买到的只是"塞得下"，不是"用得好"。

对照基准（论文 Table 1）：**闭卷 vs 只给那篇正确文档（oracle）**。

| 模型 | 闭卷 | Oracle |
| ---- | ---- | ------ |
| LongChat-13B (16K) | 35.0% | 83.4% |
| MPT-30B-Instruct | 31.5% | 81.9% |
| GPT-3.5-Turbo | 56.1% | 88.3% |
| GPT-3.5-Turbo (16K) | 56.0% | 88.6% |
| Claude-1.3 | 48.3% | 76.1% |
| Claude-1.3 (100K) | 48.2% | 76.4% |

Oracle 与"塞满文档"之间的落差，就是"位置税"的空间。

### 2.2 合成 KV 检索：把语言语义全部抽空

第二个任务更极端：给一个 JSON，键和值都是随机 UUID，问"这个键对应的值是什么"。它只考一件事——**从上下文里做精确定位与照抄**。论文用 75 / 140 / 300 对键值、每组 500 个样本。

- Claude-1.3 与 100K 版近乎完美；
- GPT-3.5-Turbo（含 16K 版）与 MPT-30B-Instruct 在 140/300 对时**中段最差**，依旧 U 形；
- LongChat-13B (16K) 在 140 对设置里出现了一种很典型的失败：**当目标在开头时，它倾向于去"写一段检索代码"而不是直接输出值**。长上下文退化的表现未必是"忘记"，也常是"改用别的方式糊过去"。

### 2.3 三个机理观察（论文第 4 节）

1. **编码器-解码器模型相对更抗位置变化**——但只在训练时长度以内的序列上；一旦超过训练时见过的长度，U 形照样出现。所谓"长上下文能力"很大程度是外推问题。
2. **Query-aware contextualization（把问题同时放在资料开头和结尾）**能让合成 KV 检索接近完美，但对多文档问答这种需要真正推理的任务**收益有限**。也就是说：位置技巧能救"照抄"，救不了"理解"。
3. **基座模型（未经指令微调）也有 U 形**——这不是对话微调引入的毛病，而是自回归注意力的固有偏置。

### 2.4 对检索系统的直接推论

论文还做了 retriever-reader 的实证：在 NaturalQuestions-Open 上，**模型性能的饱和远早于召回率的饱和**——从 20 篇检索文档加到 50 篇，GPT-3.5-Turbo 只涨 1.5%、claude-1.3 只涨 1%。

翻译成工程语言：**"多召回一点让模型自己挑"是有天花板的**。第 21 篇之后加进来的内容，很多时候只是在稀释注意力。分块与重排的具体做法见《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《重排序（Rerank）：LLM 打分与 Cross-Encoder 精排》，检索侧该配多少条见《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》。

## 三、2026 年了，这件事过时了吗：没有，只是换了考卷

论文用的模型早已退役，但"位置/长度 → 准确率"的评测协议留了下来，并且成了各家长上下文榜单的骨架：

- **RULER**（NVIDIA，arXiv:2404.06654）把"大海捞针"扩展成多针、多跳追踪与聚合任务，评测 17 个长上下文模型后的结论是： vanilla 捞针几乎所有人满分，但**声称 32K 以上的模型里只有一半能撑住**；
- **NoLiMa**（arXiv:2502.05167）指出捞针测试的漏洞——问题和"针"之间往往有字面词可匹配。把字面重合拿掉后，13 个自称 ≥128K 的模型在 32K 处**有 11 个跌破自己短上下文基线的一半**；
- **MRCR 8-needle**（多针长文阅读理解）已进入现代模型卡。以 DeepSeek-V4 公布的曲线为例：8 针检索在 256K 以内保持在 0.82 以上，**到 1M 时降到 0.59**——同一个模型，长度上去以后有效检索能力掉了三成以上。

结论：**今天读模型卡的正确姿势是把"上下文窗口"和"长上下文检索曲线"当成两个指标**。前者是配额，后者是能力。本站的版本与窗口数字统一维护在《主流模型生态对比（2026-09）》；本篇的判读方法对任何一代模型都适用。

## 四、可运行实验：位置对检索准确率的影响

下面这段脚本复现论文的 KV 检索协议：把目标键值对插到上下文的指定分位，其余全部是干扰对；扫一遍位置，输出准确率和 ASCII U 形曲线。**只用 Python 标准库**（`urllib` 直连任意 OpenAI 兼容端点：OpenAI / DeepSeek / GLM / vLLM / Ollama 皆可），无需 `pip install`。

```python
#!/usr/bin/env python3
"""位置对检索准确率的影响：复现 Lost in the Middle 的 key-value 检索协议。

只依赖标准库。默认打任意 OpenAI 兼容端点（vLLM / Ollama / DeepSeek / OpenAI）。
API Key 一律从环境变量读取，不要写进文件。

    export OPENAI_API_KEY=sk-...
    python3 position_retrieval_eval.py --keys 120 --positions 0,0.25,0.5,0.75,1 --repeats 3
    python3 position_retrieval_eval.py --dry-run      # 不联网，只看构造出来的提示
    python3 position_retrieval_eval.py --self-test    # 用假模型自检统计与画曲线链路
"""
import argparse
import json
import os
import random
import sys
import urllib.request
import urllib.error

PROMPT = 'Extract the value corresponding to the specified key in the JSON object below.\n\n' \
         'JSON data:\n{records}\n\nKey: "{key}"\nCorresponding value:'
SANDWICH = 'Extract the value corresponding to the specified key in the JSON object below.\n\n' \
           'Key: "{key}"\n\nJSON data:\n{records}\n\nKey: "{key}"\nCorresponding value:'


def make_case(n_keys: int, position: float, rng: random.Random):
    """造 n_keys 个 UUID 键值对，把目标对插到上下文的 position 分位处。"""
    def uid():
        return "%08x-%04x-%04x-%04x-%012x" % (rng.getrandbits(32), rng.getrandbits(16),
                                               rng.getrandbits(16), rng.getrandbits(16),
                                               rng.getrandbits(48))
    pairs = {uid(): uid() for _ in range(n_keys)}
    target_key, target_value = uid(), uid()
    items = list(pairs.items())
    index = min(len(items), max(0, round(position * len(items))))
    items.insert(index, (target_key, target_value))
    records = json.dumps(dict(items), indent=None).replace(", ", ",\n")
    return records, target_key, target_value


def curve(results):
    """把 {位置: [命中, 总数]} 画成 ASCII U 形曲线。"""
    print("\n位置".ljust(10) + "准确率".ljust(10) + "曲线")
    for pos in sorted(results):
        hit, total = results[pos]
        acc = hit / total
        print(f"{pos:<10.2f}{acc:<10.3f}" + "#" * int(round(acc * 40)))


class HttpClient:
    """最小的 OpenAI 兼容客户端（chat/completions），temperature 固定 0 以排除采样噪声。"""

    def __init__(self, model, base_url, timeout):
        self.model = model
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.timeout = timeout

    def __call__(self, prompt):
        body = json.dumps({
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": 64,
        }).encode()
        req = urllib.request.Request(self.url, data=body, headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY', '')}",
        })
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            sys.exit(f"HTTP {exc.code}：{exc.read().decode()[:300]}")
        except Exception as exc:                      # 超时 / DNS / 连接被拒
            sys.exit(f"请求失败：{exc}（检查 OPENAI_BASE_URL 与网络）")
        return data["choices"][0]["message"]["content"] or ""


class StubClient:
    """自检用假模型：只有当目标键值对落在上下文后 1/4 时才答对，用来验证统计与画图链路。"""

    def __call__(self, prompt):
        _, _, tail = prompt.partition("JSON data:")
        body, _, key_line = tail.partition("\nKey:")
        key = key_line.strip().splitlines()[0].strip('"')
        records = json.loads(body)
        order = list(records)
        idx = order.index(key)
        return records[key] if idx / len(order) > 0.75 else "unknown"


def main():
    ap = argparse.ArgumentParser(description="needle position → retrieval accuracy")
    ap.add_argument("--keys", type=int, default=120, help="上下文里的键值对条数（控制长度）")
    ap.add_argument("--positions", default="0,0.25,0.5,0.75,1", help="逗号分隔的分位位置")
    ap.add_argument("--repeats", type=int, default=3, help="每个位置重复次数（不同随机内容）")
    ap.add_argument("--model", default=os.environ.get("OPENAI_MODEL", "gpt-5.4-mini"))
    ap.add_argument("--base-url", default=os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1"))
    ap.add_argument("--sandwich", action="store_true", help="把问题同时放在上下文开头和结尾（query-aware）")
    ap.add_argument("--dry-run", action="store_true", help="只打印构造结果，不发请求")
    ap.add_argument("--self-test", action="store_true", help="用假模型走通整条统计链路")
    ap.add_argument("--timeout", type=float, default=120)
    args = ap.parse_args()

    positions = [float(x) for x in args.positions.split(",")]
    rng = random.Random(20260919)
    if args.self_test:
        print("[self-test] StubClient 只验证统计与画图链路，其结果不代表任何真实模型的能力\n")
    client = StubClient() if args.self_test else HttpClient(args.model, args.base_url, args.timeout)
    results = {p: [0, 0] for p in positions}

    for p in positions:
        for r in range(args.repeats):
            records, key, value = make_case(args.keys, p, rng)
            prompt = (SANDWICH if args.sandwich else PROMPT).format(records=records, key=key)
            if args.dry_run:
                print(f"位置 {p} 第 {r} 次：{len(records):,} 字符 ≈ {len(records) // 4:,} token，"
                      f"目标 key={key}\n{prompt[:200]}…\n{prompt[-120:]}\n")
                continue
            hit = value in client(prompt)            # 判分只看"期望值是否出现在回答里"
            results[p][0] += hit
            results[p][1] += 1
            print(f"位置 {p:<5.2f} 第 {r} 次 → {'命中' if hit else '未命中'}（期望 {value[:8]}…）")

    if not args.dry_run:
        print(f"\n模型 {args.model} | 每位置 {args.repeats} 次 | "
              f"{'sandwich' if args.sandwich else '标准'} 提示")
        curve(results)


if __name__ == "__main__":
    main()
```

> 说明：`HttpClient` 走的是 OpenAI 兼容的 `chat/completions`，`temperature=0` 是为了把采样噪声从结果里剔出去（见《采样参数：temperature 与 top_p》）。如果你要测的是 OpenAI 侧推理模型，改用 Responses API 并把 `reasoning_effort` 设为 `none`——思考预算会污染"检索"这项能力本身的读数（见《推理模型（o1/R1 类）》）。

先确认链路是通的（不需要 Key，也不联网）：

```bash
python3 position_retrieval_eval.py --self-test --keys 80 --repeats 2
```

脚本会先逐条打印每个位置的命中情况，最后汇总成曲线。下面是汇总部分：

```
[self-test] StubClient 只验证统计与画图链路，其结果不代表任何真实模型的能力

模型 gpt-5.4-mini | 每位置 2 次 | 标准 提示

位置       准确率       曲线
0.00      0.000
0.25      0.000
0.50      0.000
0.75      0.000
1.00      1.000     ########################################
```

这个假模型故意"只答得对尾部"，用来验证插入位置、判分与曲线渲染都对。换成真模型：

```bash
export OPENAI_API_KEY=sk-...                     # 不要写进代码
export OPENAI_BASE_URL=https://api.deepseek.com  # 或本地 vLLM/Ollama 的 /v1
export OPENAI_MODEL=<你要测的长上下文模型 ID>      # 具体 ID 见《主流模型生态对比（2026-09）》
python3 position_retrieval_eval.py --keys 300 --repeats 5
```

读结果的方法：把 `--keys` 从 20 逐步拉到 100、300、1000，你会同时看到两件事——**整条曲线下降**（长度税），以及**中段比两端掉得更快**（位置税）。再对比 `--sandwich` 与非 `--sandwich` 两次运行，就是论文第 4.2 节那个"照抄类任务能被位置技巧救回来"的实验。想更贴近真实负载，把 UUID 换成你自己的文档片段与问题即可——协议不变，曲线才可信。

## 五、工程缓解清单

按"改动成本从低到高"：

1. **排序即优化**：RAG 重排后，**把最相关的片段放在开头和结尾各一部分**，中间放次要材料。别按分数单调排完就塞进去。
2. **关键指令与输出格式放最后**（紧邻生成位置）；把"不许编造、必须引用编号"这类约束写进最后一次出现的段落里。
3. **问题复述（query-aware）**：在资料块前后各写一遍问题/检索键。对抽取、字段回填、KV 类任务收益明显；对需要跨段综合的问答别期待太多。
4. **少给，给准**：控制 k 而不是无脑塞满。参考论文的饱和结论——超过约 20 篇文档，收益接近零，而成本与位置税线性上升。
5. **结构化压缩**：长会话/长轨迹先做摘要或抽取成"事实清单"再进上下文（Agent 侧做法见《上下文工程：为 AI Agent 管理稀缺的注意力》），而不是原样堆积工具输出。
6. **改任务形状**：把"在 100 页里找答案"变成"分块并行作答 → 汇总"（map-reduce），中段风险就消失了；这本质上是承认模型的位置偏置、绕开它。
7. **自建评测**：任何"这个模型能处理我的长文档吗"的判断，都该用第四节的扫描脚本在你的数据上跑一遍，而不是信模型卡上那个窗口数字。

## 六、常见坑

- **把"窗口 1M"当"1M 内等质量"**：模型卡给的是上限，检索曲线给的是能力，两者都要看；
- **用 vanilla 捞针自证能力**：字面匹配太强，几乎所有模型都满分——这正是 NoLiMa 针对的漏洞；要测就多针 + 去掉字面重合 + 加聚合任务；
- **只测一次**：位置与随机内容都会波动，`--repeats` 至少 5 次，报告均值；
- **让推理模型"边想边找"**：思考 token 会掩盖检索失败，测长上下文时把推理关掉或分档对比；
- **忘了中段还有截断风险**：窗口打满时输出可能被截成 `incomplete`（见《推理模型（o1/R1 类）》第四节），别把截断当成位置偏置；
- **只加不改**：加了 30 篇文档却不做重排/去重，召回率上去了、准确率反而掉——这是"位置税 + 干扰项"的双重效应。

## 七、延伸阅读

- 窗口与计费的基础：《Token 与上下文窗口》
- 检索侧怎么把"该给的"给准：《文档分块策略：从固定切分到上下文检索（Contextual Retrieval）》《重排序（Rerank）：LLM 打分与 Cross-Encoder 精排》《检索层 IR 指标：recall@k、MRR、nDCG 与截断阈值怎么定》
- 多轮长任务的上下文压缩：《上下文工程：为 AI Agent 管理稀缺的注意力》
- 架构侧为什么长上下文贵：《注意力机制》《MoE 与稀疏注意力：读现代模型卡的先修知识》

## 参考来源

1. Liu, N. F., Lin, K., Hewitt, J., Paranjape, A., Bevilacqua, M., Petroni, F., Liang, P. (2023). *Lost in the Middle: How Language Models Use Long Contexts.* TACL 2023 / arXiv:2307.03172。官方代码与数据：[nelson-liu/lost-in-the-middle](https://github.com/nelson-liu/lost-in-the-middle)（MIT）。
2. Hsieh, C.-P. et al. (2024). *RULER: What's the Real Context Size of Your Long-Context Language Models?* arXiv:2404.06654。
3. Modarressi, A. et al. (2025). *NoLiMa: Long-Context Evaluation Beyond Literal Matching.* arXiv:2502.05167。
4. Hugging Face Blog, *DeepSeek-V4: a million-token context that agents can actually use*——"窗口只是容量"的论述与 MRCR 8-needle 曲线。
5. 论文内部引用的同类工作：Papailiopoulos et al. (2023), *The Little Retrieval Test*；Li et al. (2023), 细粒度行检索任务——见 arXiv:2307.03172 §3 的对照讨论。

---

> **来源**：本文编译自 [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)（Nelson F. Liu 等，TACL 2023）及其[官方代码仓库](https://github.com/nelson-liu/lost-in-the-middle)（MIT License，2023 Nelson Liu），第二、三节的数据与结论均出自论文正文（§2.3、§3.2、§4、§5）与 Table 1。抓取于 2026-09-19。
> 论文原文用 2023 年的模型（GPT-3.5-Turbo、Claude-1.3、LongChat-13B、MPT-30B）给出这些数字，本站原样引用并注明时点；第三节 2024–2026 年的三条后续证据（RULER、NoLiMa、MRCR）分别引自对应论文与官方博客。第四节的脚本为本站编写，用 Python 标准库实现并实测运行（`--dry-run` 与 `--self-test` 两条路径的输出均为真实运行结果）；示例中出现的假模型结果已就地标注，不用于说明任何真实模型的能力。
