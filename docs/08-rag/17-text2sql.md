---
title: Text2SQL 的方法与评测：schema 链接、少样本选择与执行自修复
source_url: https://arxiv.org/abs/2305.03111
author: Jinyang Li 等（BIRD-SQL 团队，HKUST-GZ）；Breno W. Carvalho 等（DIN-SQL）；Vanna AI（Vanna 项目）
license: 署名转载（arXiv 论文按原文许可引用）；MIT（Vanna）
fetched_at: 2026-09-19
translated: true
versions: BIRD-SQL 基准（95 库 / 12751 题，2026-09 榜单口径）；vanna 2.0.2；SQLite 3.x（Python 标准库 sqlite3）；openai SDK 3.x
order: 17
group: 进阶范式
---

## 为什么"接个大模型问数据库"远远不够

让业务方用一句话查库，是所有做数据平台的人都被提过的需求。真正上线过一次就会发现：模型写出的 SQL 语法基本都对，**错在语义**——表选错了、`status` 写成 `'active'` 而库里存的是 `1`、该 JOIN 的没 JOIN、把「上月」算成 `now() - 30 day`。BIRD-SQL 基准（95 个真实数据库、12751 个问题、33.4GB 数据）测出的结果很直白：人类专家的执行正确率（Execution Accuracy, EX）是 **92.96%**，而 GPT-4 当时只有 **54.89%**，Claude-2 为 **49.02%**。差距的来源不是"不会写 SQL"，而是**不了解你的库**。

所以 Text2SQL 的正确抽象不是"提示词技巧"，而是一条**检索 + 生成 + 校验 + 反馈**的管线，并且要有可复现的评测口径。Vanna、DB-GPT、WrenAI 这些框架本质上都是这条管线的某种工程化封装——它们不是方法论本身，本篇先把方法论讲透，最后再说 Vanna 提供了什么。

## 一、任务的四个难点

| 难点 | 具体表现 | 对应手段 |
| --- | --- | --- |
| Schema linking | 库里有 800 张表，问题只涉及 3 张；列名 `is_del`、`cust_no` 与自然语言不匹配 | 把「表.列 + 注释 + 样例值」做成检索单元，先用词法/语义检索选出候选子图 |
| 值对齐 | 用户说"上海机房"，库里 `city='上海'`；说"已确认"，库里是 `acked=1` | 枚举列的 DISTINCT 值入库，做值链接；高基数列建倒排或向量索引 |
| 方言与函数 | MySQL 的 `DATE_FORMAT` vs PG 的 `to_char`；SQLite 没有窗口函数旧版本 | 提示词里锁定方言并给 3-5 个"本库惯用写法"示例；执行前用 `EXPLAIN` 探测 |
| 语义歧义 | "最高的三个机柜"是按功率还是按负载率？ | 不猜：把歧义写进"需要澄清"分支，或把口径固化为视图/指标层 |

DIN-SQL 论文把这套流程拆成四步：**模式链接（schema linking）→ 按问题复杂度分类 → 少样本示例选择 → 生成后自检（self-correction）**。这个分解至今仍是各家实现的主骨架。

## 二、评测：先定口径再谈效果

- **执行正确率 EX（Execution Accuracy）**：预测 SQL 与标准 SQL 各跑一遍，结果集合一致即算对。这是 BIRD/Spider 的主指标，比"字符串匹配"合理得多——同一语义可以有很多种写法。
- **R-VES / VES（有效性效率分）**：不仅结果要对，还要在合理时间内跑出来。BIRD 引入它就是为了惩罚"暴力嵌套子查询也能对"的情况。
- **子集指标**：EX-Dev、EX-Test、按难度分（simple/moderate/challenging）。challenging 子集往往 EX 只有 30% 左右，是你真正需要盯的数字。
- **自建评测集的三条纪律**：
  1. 题目要**能执行**，标准 SQL 必须真实跑过并保存结果指纹；
  2. 每题标注**歧义说明**（口径、时间范围、是否含空值），否则模型每次"错"都说不清；
  3. **回归集版本化**，schema 每次变更都要重跑，别用三个月前的分数说服自己。

下面这份脚本把「schema 链接 + 值链接 + 少样本选择 + 校验 + 自修复」全部实现了一遍，用 SQLite 建一个运维 CMDB 库，**不依赖任何第三方包、也不需要 API Key**（LLM 位置用桩函数占位，换成真实调用只改一行）。

```bash
# Python 3.10+，只用标准库
python3 -m venv .venv && source .venv/bin/activate
pip install "openai>=2.0"      # 只有真实调用 LLM 时才需要
```

### 1. 准备一个可执行的库

```python
import math
import re
import sqlite3
from collections import Counter

DB = "ops_cmdb.db"

DDL = """
CREATE TABLE dc_room (
    room_id     INTEGER PRIMARY KEY,   -- 机房编号
    room_name   TEXT,                  -- 机房名称
    city        TEXT,                  -- 所在城市
    tier        TEXT,                  -- 机房等级：A/B/C
    power_kw    REAL,                  -- 额定总功率，单位 kW
    built_year  INTEGER                -- 投产年份
);
CREATE TABLE rack (
    rack_id     INTEGER PRIMARY KEY,   -- 机柜编号
    room_id     INTEGER,               -- 所属机房
    rack_no     TEXT,                  -- 机柜标签
    design_kw   REAL,                  -- 设计功率 kW
    used_kw     REAL,                  -- 实际使用功率 kW
    status      TEXT                   -- 状态：online/maintenance/offline
);
CREATE TABLE device (
    device_id   INTEGER PRIMARY KEY,   -- 设备主键
    rack_id     INTEGER,               -- 所在机柜
    sn          TEXT,                  -- 设备序列号
    device_type TEXT,                  -- 设备类型：server/storage/network/switch
    brand       TEXT,                  -- 品牌
    model       TEXT,                  -- 型号
    cpu_core    INTEGER,               -- CPU 逻辑核数
    mem_gb      REAL,                  -- 内存容量 GB
    online_at   TEXT                   -- 上架时间，格式 YYYY-MM-DD
);
CREATE TABLE alarm (
    alarm_id    INTEGER PRIMARY KEY,
    device_id   INTEGER,               -- 关联设备
    severity    TEXT,                  -- 告警级别：P1/P2/P3/P4
    metric      TEXT,                  -- 触发指标：temp/power/fan/net_err
    value       REAL,                  -- 触发值
    created_at  TEXT,                  -- 发生时间
    acked       INTEGER                -- 是否已确认 0/1
);
-- 把口径固化成视图，比让模型每次现算 load_pct 稳得多
CREATE VIEW v_rack_load AS
SELECT r.rack_id, r.rack_no, r.design_kw, r.used_kw,
       ROUND(100.0 * r.used_kw / r.design_kw, 2) AS load_pct, d.room_name
FROM rack r JOIN dc_room d ON r.room_id = d.room_id;
"""


def build_db():
    con = sqlite3.connect(DB)
    con.executescript(
        "DROP VIEW IF EXISTS v_rack_load; "
        "DROP TABLE IF EXISTS alarm; DROP TABLE IF EXISTS device; "
        "DROP TABLE IF EXISTS rack; DROP TABLE IF EXISTS dc_room; " + DDL
    )
    con.executemany("INSERT INTO dc_room VALUES (?,?,?,?,?,?)", [
        (1, "亦庄 A 机房", "北京", "A", 4800.0, 2019),
        (2, "顺义 B 机房", "北京", "B", 3200.0, 2016),
        (3, "张江 A 机房", "上海", "A", 5600.0, 2021),
        (4, "松江 C 机房", "上海", "C", 1800.0, 2012),
        (5, "廊坊 B 机房", "廊坊", "B", 4000.0, 2020)])
    con.executemany("INSERT INTO rack VALUES (?,?,?,?,?,?)", [
        (1, 1, "A01-03", 8.0, 7.4, "online"), (2, 1, "A01-04", 8.0, 2.1, "online"),
        (3, 2, "B02-11", 6.0, 5.8, "maintenance"), (4, 3, "C01-02", 10.0, 9.3, "online"),
        (5, 3, "C01-03", 10.0, 4.2, "online"), (6, 4, "D05-07", 4.0, 3.9, "offline"),
        (7, 5, "E02-01", 8.0, 6.6, "online"), (8, 5, "E02-02", 8.0, 7.9, "online")])
    con.executemany("INSERT INTO device VALUES (?,?,?,?,?,?,?,?,?)", [
        (1, 1, "SN2019A001", "server", "H3C", "R4900G5", 128, 512.0, "2019-05-12"),
        (2, 1, "SN2019A002", "server", "H3C", "R4900G5", 128, 512.0, "2019-05-12"),
        (3, 3, "SN2016B101", "storage", "Huawei", "OceanStor5310", 32, 256.0, "2016-09-01"),
        (4, 4, "SN2021C201", "server", "Dell", "R750", 192, 1024.0, "2021-03-20"),
        (5, 4, "SN2021C202", "network", "Huawei", "CE6881", 16, 32.0, "2021-03-25"),
        (6, 6, "SN2012D301", "switch", "H3C", "S5560", 8, 16.0, "2012-07-07"),
        (7, 7, "SN2020E401", "server", "Inspur", "NF5280M6", 160, 768.0, "2020-11-11"),
        (8, 8, "SN2020E402", "server", "Inspur", "NF5280M6", 160, 768.0, "2020-11-11")])
    con.executemany("INSERT INTO alarm VALUES (?,?,?,?,?,?,?)", [
        (1, 1, "P1", "temp", 31.5, "2026-08-01 03:12:00", 1),
        (2, 2, "P2", "power", 7.9, "2026-08-01 09:40:00", 0),
        (3, 4, "P1", "fan", 0.0, "2026-08-02 11:05:00", 1),
        (4, 5, "P3", "net_err", 12.0, "2026-08-03 22:18:00", 1),
        (5, 7, "P2", "temp", 28.9, "2026-08-04 05:33:00", 0),
        (6, 8, "P1", "power", 8.1, "2026-08-04 06:00:00", 0),
        (7, 3, "P4", "net_err", 3.0, "2026-08-05 14:20:00", 1),
        (8, 6, "P2", "temp", 29.4, "2026-08-06 01:11:00", 0)])
    con.commit()
    return con
```

### 2. Schema linking：检索"列"而不是检索"表"

粒度是关键。以表为单位检索，命中一张宽表就把 40 个列全塞进提示词；以「表.列 + 注释 + 3 个样例值」为单位检索，8 个单元就能覆盖问题的核心。**这里必须用 BM25 而不是纯向量**：列名往往是 `is_del`、`cust_no` 这种缩写，向量模型和它"语义不像"，词法精确匹配才顶得住。

```python
def tok(s):
    """粗分词：英文/数字按词，中文额外做单字切分，零依赖也能召回。"""
    s = re.sub(r"[_\s]+", " ", str(s).lower())
    out = []
    for w in re.split(r"[ ,，。/()：]+", s):
        if not w:
            continue
        out.append(w)
        if re.search(r"[一-鿿]", w) and len(w) > 1:
            out.extend(list(w))          # 中文再切单字，补足无分词器的召回
    return out


class BM25:
    """Okapi BM25（k1=1.5, b=0.75），避免'只数词频'的伪 BM25。"""

    def __init__(self, docs, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.toks = [Counter(tok(d)) for d in docs]
        self.df = Counter(t for c in self.toks for t in c)
        self.n = len(docs)
        self.avg = sum(sum(c.values()) for c in self.toks) / max(self.n, 1)

    def search(self, q, k=8):
        q = Counter(tok(q))
        scored = []
        for i, c in enumerate(self.toks):
            s, dl = 0.0, sum(c.values()) or 1
            for t, _tf in q.items():
                if t not in c:
                    continue
                idf = math.log(1 + (self.n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                s += idf * c[t] * (self.k1 + 1) / (
                    c[t] + self.k1 * (1 - self.b + self.b * dl / self.avg))
            scored.append((s, i))
        scored.sort(reverse=True)
        return [(i, round(s, 3)) for s, i in scored[:k] if s > 0]


def parse_schema(con):
    """把列、注释、样例值展开成检索单元。生产环境用 information_schema / PRAGMA。"""
    units = []
    names = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'")]
    for t in sorted(names):
        for _, col, ctype, *_ in con.execute(f"PRAGMA table_info({t})"):
            m = re.search(rf"{col}\s+\w+,\s*--\s*(.+)", DDL)      # 从 DDL 里取行内注释
            comment = m.group(1) if m else ""
            sample = ""
            if t != "v_rack_load":
                got = con.execute(f"SELECT {col} FROM {t} LIMIT 3").fetchall()
                sample = ",".join(str(g[0]) for g in got if g[0] is not None)
            units.append({"table": t, "column": col, "comment": comment, "sample": sample})
    return units


def expand_join_closure(units, picked):
    """命中列里出现 xxx_id，就把该表全部 *_id 列补齐，避免 JOIN 键漏检。"""
    hit = {p["table"] for p in picked}
    return picked + [u for u in units
                     if u["table"] in hit and u["column"].endswith("_id") and u not in picked]
```

### 3. 值链接：把"上海机房"翻译成 `city='上海'`

```python
VALUE_COLS = {"dc_room": ["city", "tier"], "rack": ["status"],
              "device": ["device_type", "brand"], "alarm": ["severity", "metric"]}


def link_values(con, question):
    """枚举型列直接把取值拿去和问题做子串匹配；高基数列改用倒排/向量索引。"""
    hits = []
    for t, cols in VALUE_COLS.items():
        for col in cols:
            for (v,) in con.execute(f"SELECT DISTINCT {col} FROM {t} WHERE {col} IS NOT NULL"):
                if len(str(v)) >= 2 and str(v) in question:
                    hits.append((t, col, str(v)))
    return hits
```

### 4. 少样本选择：给"最像的 3 题"，而不是"随机的 3 题"

示例选择对结果的影响比换模型还大。DIN-SQL 与后续工作的共识是：**按 schema 重叠度 + 问题相似度**挑最近邻，示例要覆盖本次要用到的表和 JOIN 写法。

```python
TRAIN = [  # 生产里这三元组就是 Vanna 说的 "训练数据"
    ("北京有哪些机房", "SELECT room_name FROM dc_room WHERE city = '北京'"),
    ("机柜 A01-03 用了多少功率", "SELECT used_kw FROM rack WHERE rack_no = 'A01-03'"),
    ("服务器设备有多少台", "SELECT COUNT(*) FROM device WHERE device_type = 'server'"),
    ("2021 年以后上架的设备", "SELECT sn FROM device WHERE online_at >= '2021-01-01'"),
    ("P1 告警有几条", "SELECT COUNT(*) FROM alarm WHERE severity = 'P1'"),
    ("各机房设备数量", "SELECT d.room_name, COUNT(*) FROM device dev "
                      "JOIN rack r ON dev.rack_id=r.rack_id "
                      "JOIN dc_room d ON r.room_id=d.room_id GROUP BY d.room_name"),
]


def jaccard(a, b):
    A, B = set(tok(a)), set(tok(b))
    return len(A & B) / len(A | B) if A | B else 0.0


def pick_examples(question, n=3):
    return sorted(TRAIN, key=lambda p: -jaccard(question, p[0]))[:n]
```

### 5. 校验与自修复：这一环才让 Text2SQL 能上生产

「生成 → 执行 → 把数据库真实报错回灌给模型 → 再生成」是收益最大的一段，因为它把"看起来对不对"变成"跑不跑得通"。校验要分三层：

1. **静态安全**：只允许 `SELECT/WITH`；禁写操作关键字；禁多语句；强制 `LIMIT`/行数上限。
2. **计划探测**：`EXPLAIN` 能查出表名列名拼错、类型不匹配，代价极低。
3. **执行与结果体检**：真跑（只读账号！），0 行、超时、行爆炸都当作可反馈的信号。

```python
FORBIDDEN = re.compile(r"\b(insert|update|delete|drop|alter|truncate|grant|attach|vacuum)\b", re.I)


def validate_sql(sql, con, max_rows=200):
    """返回 (是否通过, 反馈信息)。反馈信息会原样回灌给模型。"""
    if not sql.strip().lower().startswith(("select", "with")):
        return False, "只允许 SELECT/WITH 开头"
    if FORBIDDEN.search(sql):
        return False, "包含被禁止的写操作关键字"
    if ";" in sql.rstrip().rstrip(";"):
        return False, "禁止多语句执行"
    try:
        con.execute("EXPLAIN " + sql).fetchall()
    except sqlite3.Error as e:
        return False, f"语法/计划失败: {e}"
    try:
        rows = con.execute(sql).fetchmany(max_rows + 1)
    except sqlite3.Error as e:
        return False, f"执行失败: {e}"
    if len(rows) > max_rows:
        return False, f"结果超过 {max_rows} 行，请加 LIMIT 或收紧条件"
    return True, f"OK，返回 {len(rows)} 行"


PROMPT = """你是 {dialect} 数据分析师。只输出一条可执行 SQL，不要解释。
【可用列（含注释与样例值）】
{schema}
【值映射】{values}
【写法示例】
{examples}
【上次尝试失败】{error}
问题：{question}
"""


def llm_sql(prompt):
    """真实实现：换 gpt-5.5 或本地 Qwen3-Coder。此处为离线可跑的桩。"""
    # from openai import OpenAI
    # client = OpenAI()                      # 密钥来自环境变量，切勿写进代码
    # r = client.chat.completions.create(
    #     model="gpt-5.5",
    #     messages=[{"role": "user", "content": prompt}],
    #     max_completion_tokens=512)
    # return r.choices[0].message.content
    q, err = prompt["_q"], prompt["_err"]
    if "上海" in q and err is None:          # 故意复现最常见的幻觉：表名加了 s
        return ("SELECT COUNT(*) FROM alarms a JOIN device dv ON a.device_id = dv.device_id "
                "JOIN rack r ON dv.rack_id = r.rack_id JOIN dc_room d ON r.room_id = d.room_id "
                "WHERE d.city = '上海' AND a.severity = 'P1'")
    if "上海" in q:
        return ("SELECT COUNT(*) FROM alarm a JOIN device dv ON a.device_id = dv.device_id "
                "JOIN rack r ON dv.rack_id = r.rack_id JOIN dc_room d ON r.room_id = d.room_id "
                "WHERE d.city = '上海' AND a.severity = 'P1'")
    if "负载率" in q or "使用率" in q:
        return "SELECT rack_no, load_pct FROM v_rack_load ORDER BY load_pct DESC LIMIT 3"
    if "未确认" in q:
        return "SELECT COUNT(*) FROM alarm WHERE acked = 0 AND severity IN ('P1','P2')"
    return "SELECT room_name FROM dc_room WHERE city = '北京'"


def ask(con, question, max_retry=2):
    units = SCHEMA
    idx = BM25([f"{u['table']}.{u['column']} {u['comment']} 样例:{u['sample']}" for u in units])
    picked = expand_join_closure(units, [units[i] for i, _ in idx.search(question, k=8)])
    schema = "\n".join(f"{p['table']}.{p['column']} -- {p['comment']} (样例 {p['sample']})"
                       for p in picked)
    values = ", ".join(f"{t}.{c}={v}" for t, c, v in link_values(con, question)) or "无"
    examples = "\n".join(f"-- {q}\n{s}" for q, s in pick_examples(question))
    print(f"\n问题：{question}")
    print("  schema 命中：" + ", ".join(f"{p['table']}.{p['column']}" for p in picked))
    print(f"  值链接：{values}")
    err = None
    for attempt in range(max_retry + 1):
        prompt = {"_q": question, "_err": err, "dialect": "SQLite",
                  "schema": schema, "values": values, "examples": examples,
                  "question": question}
        sql = llm_sql(prompt)
        ok, msg = validate_sql(sql, con)
        print(f"  第 {attempt + 1} 次 SQL：{sql}")
        print(f"  校验：{msg}")
        if ok:
            rows = con.execute(sql).fetchmany(5)
            print(f"  结果预览：{rows}")
            return sql, rows
        err = msg                       # ← 数据库的真实报错成为下一轮的上下文
    return None, None


if __name__ == "__main__":
    con = build_db()
    SCHEMA = parse_schema(con)
    print(f"=== 列级检索单元数量：{len(SCHEMA)}")
    for q in ["上海机房有多少条 P1 告警", "机柜负载率最高的三个机柜", "未确认的 P1 和 P2 告警有几条"]:
        ask(con, q)
```

### 6. 真实运行输出

上面脚本在本机跑出的结果（SQLite 文件库，仅对超长 SQL 做了折行省略）：

```text
=== 列级检索单元数量：34

问题：上海机房有多少条 P1 告警
  schema 命中：alarm.severity, dc_room.city, dc_room.room_name, v_rack_load.room_name,
              rack.room_id, dc_room.room_id, dc_room.tier, v_rack_load.rack_no,
              alarm.alarm_id, alarm.device_id, rack.rack_id, v_rack_load.rack_id
  值链接：dc_room.city=上海, alarm.severity=P1
  第 1 次 SQL：SELECT COUNT(*) FROM alarms a JOIN device dv ON a.device_id = dv.device_id ...
  校验：语法/计划失败: no such table: alarms
  第 2 次 SQL：SELECT COUNT(*) FROM alarm a JOIN device dv ON a.device_id = dv.device_id ...
  校验：OK，返回 1 行
  结果预览：[(1,)]

问题：机柜负载率最高的三个机柜
  schema 命中：v_rack_load.rack_no, v_rack_load.rack_id, rack.rack_id, device.rack_id,
              rack.rack_no, v_rack_load.design_kw, v_rack_load.used_kw, dc_room.room_name, ...
  值链接：无
  第 1 次 SQL：SELECT rack_no, load_pct FROM v_rack_load ORDER BY load_pct DESC LIMIT 3
  校验：OK，返回 3 行
  结果预览：[('E02-02', 98.75), ('D05-07', 97.5), ('B02-11', 96.67)]

问题：未确认的 P1 和 P2 告警有几条
  schema 命中：alarm.severity, alarm.alarm_id, alarm.device_id
  值链接：alarm.severity=P1, alarm.severity=P2
  第 1 次 SQL：SELECT COUNT(*) FROM alarm WHERE acked = 0 AND severity IN ('P1','P2')
  校验：OK，返回 1 行
  结果预览：[(4,)]
```

（SQL 行做了换行省略，其余为原样输出。）

三个细节值得注意：

1. 第一次检索漏了 `alarm.device_id`（问题里没有任何词能命中它），补上 `expand_join_closure` 后 JOIN 键才齐——**schema linking 必须做"外键闭包"**，这是纯检索解决不了的结构问题。
2. 表名幻觉（`alarms`）被 `EXPLAIN` 阶段就拦下，不需要真的执行；反馈里带着数据库原始报错，模型第二轮基本都能修对。
3. "负载率"直接命中视图 `v_rack_load`：把口径固化成视图/指标层，比让模型每次现算 `used/design` 稳定得多。

## 三、框架是手段：Vanna 提供了什么

Vanna 2.0（MIT）的核心不是"提示词模板"，而是把上面第 2、4 步做成了持久化组件：你把 **DDL、文档、(问题, SQL) 对**喂给它训练，它用向量库检索后拼装提示词。等价于本片的 `parse_schema` + `TRAIN`，只是带了一个 Web/SSE 前端。2.0 版本的变化是从 0.x 的 `ask()` 单体方法改为 Agent + 工具（`Tool`）组装，便于接你自己的 FastAPI 与鉴权：

```python
# pip install "vanna>=2.0.2"（各模型/数据库适配器按官方文档补 extras）
import base64
import json

from fastapi import FastAPI
from vanna import Agent
from vanna.core.registry import ToolRegistry
from vanna.core.user import UserResolver, User, RequestContext
from vanna.integrations.anthropic import AnthropicLlmService
from vanna.integrations.sqlite import SqliteRunner
from vanna.servers.base import ChatHandler
from vanna.servers.fastapi.routes import register_chat_routes
from vanna.tools import RunSqlTool

app = FastAPI()


class MyUserResolver(UserResolver):
    """行级权限的落点：从你自己的 cookie / JWT 里解析出用户与所属组。"""

    async def resolve_user(self, request_context: RequestContext) -> User:
        token = request_context.get_header("Authorization").split()[-1]
        # 仅示意：生产环境请用你的鉴权库校验签名，不要直接信任 payload
        data = json.loads(base64.b64decode(token.split(".")[1] + "=="))
        return User(id=data["sub"], email=data["email"], group_memberships=data["groups"])


llm = AnthropicLlmService(model="claude-sonnet-4-6")
tools = ToolRegistry()
tools.register(RunSqlTool(sql_runner=SqliteRunner("ops_cmdb.db")))

agent = Agent(llm_service=llm, tool_registry=tools, user_resolver=MyUserResolver())
register_chat_routes(app, ChatHandler(agent))
# 得到：POST /api/vanna/v2/chat_sse（流式）与可选 Web UI（GET /）
```

选型判断：**只要你的库超过 50 张表、或需要行级权限，就必须自建"schema 检索 + 值链接 + 校验"这几层**（框架默认实现通常只做表级粗筛），否则 Text2SQL 的失败会以"看起来很自信的错误数字"形式出现在业务面前。

## 常见坑

1. **只检索表不检索列**：宽表一塞就是几千 token，模型抓到哪列算哪列。改成列级检索单元。
2. **用向量做列名匹配**：`is_del`、`cust_no` 这类缩写的语义向量很虚。列名/枚举值一律走 BM25 或子串，语义向量只兜住"业务说法"。
3. **不做值链接**：模型写 `status='active'`，库里是 `online`。要么给 DISTINCT 值，要么给值字典视图。
4. **拿 ` Rows_returned` 当成功**：0 行往往意味着过滤条件写错，应该回灌"结果为空"信号让模型重查，而不是回答"没有数据"。
5. **忘了只读账号与行数上限**：LLM 生成的 SQL 一旦带上 `DELETE`，代价是生产事故。用只读角色 + 语句白名单 + `LIMIT` + 超时四道闸。
6. **方言串台**：同一个 Agent 服务多个库时，提示词里必须锁死 `dialect`，否则 MySQL 里写出 `LIMIT n OFFSET m` 的 PG 变体。
7. **没有时间口径**：「本月」「近 7 天」必须由系统注入当前日期（今天几号），别让模型用它训练截止时的那一年。
8. **不评 challenging 子集**：整体 EX 90% 可能全靠 simple 题撑。按难度分桶看，并单独盯"多表 JOIN + 聚合 + 子查询"的题目。
9. **把自修复做成无限重试**：2 次不通过就转人工/转澄清，第 3 次以后成功率提升很有限，成本却翻倍。

## 延伸阅读

- BIRD-SQL 论文与榜单：*Can LLM Already Serve as A Database Interface?*（arXiv:2305.03111），EX 与 VES 指标定义看原文。
- DIN-SQL：*Decomposed In-Context Learning of Text-to-SQL with Self-Correction*（arXiv:2304.11015），四步分解的出处。
- 综述与工程取舍见《RAG 检索增强生成综述》语境下的 Text2SQL 章节，以及本站《元数据过滤与多维过滤检索》《混合检索》两篇——schema 检索本质就是一次混合检索。
- 权限与审计的落地方式，参考本站《Agent 安全与权限、生产化部署与成本管理》。

---

> **来源**：抓取于 2026-09-19。方法论主要依据 [BIRD-SQL 基准论文](https://arxiv.org/abs/2305.03111)（Jinyang Li 等，HKUST-GZ，arXiv 预印本署名转载）与 [DIN-SQL](https://arxiv.org/abs/2304.11015)（Breno W. Carvalho 等，arXiv 预印本署名转载），框架部分参考 [Vanna 项目](https://github.com/vanna-ai/vanna)（Vanna AI，MIT 许可）2.0.2 版 README 与官方文档。
> **编者注**：文中的 schema linking、值链接、RRF、校验与自修复代码，以及"真实运行输出"一节的全部数字，均为按上述论文思路重写的实现在本机（macOS，Python 3.14 + 标准库 sqlite3）跑出的结果；LLM 生成为离线桩函数，代码中已给出换成 `gpt-5.5` 真实调用的位置与参数名。BIRD 的人类 92.96% / GPT-4 54.89% / Claude-2 49.02% 为榜单公布数字。
