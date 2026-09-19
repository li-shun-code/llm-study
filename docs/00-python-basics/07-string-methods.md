---
title: 字符串处理方法族与文本清洗
source_url: https://docs.python.org/zh-cn/3/library/stdtypes.html
author: Python Software Foundation
license: PSF 许可证第 2 版（转载署名）
fetched_at: 2026-09-19
translated: true
versions: Python 3.14 文档
order: 7
group: 变量与类型
---
做大模型相关的代码，输入和输出几乎都是字符串：网页抓来的正文、用户粘贴的带格式文本、检索回来的片段、要塞进模板的变量。Python 的 `str` 类型自带六十多个方法，其中真正天天用的不到二十个，但用错了就会写出「看起来没问题、遇到一条脏数据就崩」的代码。

这一篇按**你要做的事**给方法分组，然后给出一条完整可跑的清洗流水线。前置概念（字符串是不可变序列、编码与 f-string）见《数字与字符串（f-string 与 UTF-8 编码）》。

## 第一件事：字符串不可变，所有方法都返回新串

```python
name = "  rag  "
name.strip()
print(repr(name))         # '  rag  ' —— 原串没变
name = name.strip()
print(repr(name))         # 'rag'
```

由此推出两条纪律：

- 需要「反复拼接」时用列表收集再 `''.join(parts)`，不要 `s += piece` 循环拼接。`+=` 形式在 CPython 里有原地优化但不保证跨实现有效，PEP 8 明确不建议依赖它。
- 链式调用是安全的：`s.strip().lower().replace(" ", "")` 每步都是新对象。

## 按用途分组的方法速查

### 大小写与规范化

```python
print("straße".lower())        # straße —— 已经小写，ß 不变
print("straße".casefold())     # strasse —— 用于「忽略大小写的比较/去重」
print("http error".title())    # Http Error   （注意：缩写会被切碎）
print("hello world".capitalize())   # Hello world
print("Py3".swapcase())        # pY3
```

`casefold()` 比 `lower()` 更激进，专门用来做**无大小写区分的匹配**；`title()` 会把 `IOError` 变成 `Ioerror`，别拿它做正式排版（`capwords` 或自己处理更稳）。

### 裁剪与填充

```python
print("  带空白  ".strip())             # 带空白      默认去首尾空白
print("xxhelloxx".strip("x"))           # hello
print("...a.b...".strip("."))           # a.b
print("/api/v1/".rstrip("/"))           # /api/v1
print(str(42).zfill(6))                 # 000042      数字编号
print("id".center(9, "-"))              # ----id-----
print(repr("id".ljust(6, ".")))         # 'id....'
print(repr(" ".ljust(4, " ")))          # '    ' —— 尾随空白看不见，所以下面都用 repr
```

**`strip(chars)` 的参数是「字符集合」而不是前缀**：`"axbxcx".strip("abc")` 会把首尾所有属于 `{a,b,c,x}` 的字符都剥掉，结果为空串。要去掉确定前缀/后缀请用 3.9 起的 `removeprefix()` / `removesuffix()`：

```python
print("Bearer abc123".removeprefix("Bearer "))   # abc123
print("photo.jpeg".removesuffix(".jpeg"))         # photo
print("jpeg.jpeg".strip(".jpeg"))                 # ''   —— 首尾所有 .jpeg 字符全被剥掉
print("greetings.jpg".strip(".jpeg"))             # 'reetings'   连开头的 g 也被剥掉（它也在集合里）
```

### 查找、判断与计数

```python
text = "system: 你好，world"
print(len(text))                  # 16
print("world" in text)            # True —— 只判断存在，优先用 in
print(text.find("你好"))           # 8    找不到返回 -1
print(text.index("你好"))          # 8    找不到抛 ValueError
print(text.count("o"))            # 1
print(text.startswith("system"))  # True
print(text.endswith("world"))     # True
print(text.islower(), text.isupper(), text.isspace())   # False False False
print("1234".isdigit(), "²".isdigit(), "²".isnumeric(), "½".isdecimal())
# True True True False
```

`isdigit()` / `isnumeric()` / `isdecimal()` 的差别在于对 Unicode 数字的接受程度：上标 `²` 是 digit 也是 numeric 但不是 decimal；需要「能不能转成整数」时用 `str.isdecimal()` 或直接 `try: int(s)`。中文数字「一二三」`isnumeric()` 为真而 `isdigit()` 为假。

`in` 是子串判断，`find`/`index` 才给位置；只需要位置又关心可读性时，用 `partition()` 一次拿到三段（见下）。

### 拆分、连接与切段

```python
print("a,b,,c".split(","))            # ['a', 'b', '', 'c']  按分隔符，保留空串
print("  a   b \t c\n".split())        # ['a', 'b', 'c']      不传参：按任意空白切并丢弃空串
print("a.b.c".split(".", 1))           # ['a', 'b.c']         最多切 1 次
print("a\nb\nc".splitlines())           # ['a', 'b', 'c']      按行切，不保留换行符
print("GET /api/v1".partition(" "))      # ('GET', ' ', '/api/v1')
print("GET /api/v1".rpartition("/"))     # ('GET /api', '/', 'v1')
```

`split()` 与 `split(" ")` 语义完全不同，是这一族里最容易搞混的一条：**无参数** = 「按连续空白切、忽略首尾空白与空项」；**给了分隔符** = 严格按该字符切，会产生空字符串元素。读取按空格分隔的命令行、按行读取文本时，前一种几乎总是你想要的。

连接永远是「分隔符.join(可迭代对象)」，注意 join 是字符串方法而不是列表方法：

```python
parts = ["role", "user", "content", "你好"]
print(", ".join(parts))
print("\n".join(f"{i}. {t}" for i, t in enumerate(["RAG", "Agent"], 1)))
print("".join(c for c in "a1b2" if c.isdigit()))     # 12
# 需要类型安全时可写 " ".join(map(str, [1, 2, 3]))，join 不会自动转 str
```

### 替换、去缩进与排版

```python
print("aaaa".replace("a", "b", 2))     # 只替换前两次 -> 'bbaa'
print(repr("\ta\tb".expandtabs(4)))    # 制表符按 4 列展开 -> '    a   b'
```

`textwrap` 标准库在拼装提示词时很好用：

```python
import textwrap

raw = """    你是检索助手。
    请依据下列资料回答，资料中不含答案时明确说明不知道。
    """
prompt = textwrap.dedent(raw).strip()
print(prompt)
# 你是检索助手。
# 请依据下列资料回答，资料中不含答案时明确说明不知道。

long_doc = "检索增强生成把检索与生成结合，先召回相关片段，再让模型基于片段作答。"
print(textwrap.shorten(long_doc, width=24, placeholder="……"))
# 检索增强生成把检索与生成结合，……
```

`textwrap.fill` / `textwrap.wrap` 用于把长文本折成定宽行（写日志、终端展示时常见）。注意 `dedent` 依据的是**所有非空行的公共前导空白**，混用制表符与空格时结果会不如预期，先 `expandtabs()` 再 `dedent()`。

### 单字符级别的批量替换：translate

`str.maketrans()` + `translate()` 是「一次性替换/删除大量单字符」的正解，比循环 `replace` 快且不会互相污染：

```python
table = str.maketrans("", "", "\u200b\u200c\ufeff")     # 删除零宽字符与 BOM
dirty = "重\u200b要\u200c信\u200b息"
print(dirty.translate(table))                            # 重要信息

swap = str.maketrans("aeiou", "12345")
print("hello".translate(swap))                           # h2ll5
```

### 编码转换

```python
raw_bytes = "中文".encode("utf-8")        # b'\xe4\xb8\xad\xe6\x96\x87'
print(raw_bytes.decode("utf-8"))          # 中文
print("café".encode("ascii", errors="replace"))   # b'caf?'
print("café".encode("unicode_escape"))            # 转义序列，写调试输出时有用
```

`encode()` 的 `errors` 取值（`strict`/`ignore`/`replace`/`xmlcharrefreplace`/`backslashreplace`）在读不明来源的文件时会决定「崩掉还是丢字」，务必显式写出来而不是依赖默认 `strict`。参见《文件 IO》。

### 模板：什么时候不用 f-string

一次性拼装用 f-string；**同一模板要喂很多份数据**、或模板来自外部（用户可编辑）时，用 `string.Template` 或 `str.format_map`，避免把外部文本里的 `{}` 当格式说明符解析而抛 `KeyError`/`ValueError`：

```python
from string import Template

tpl = Template("请用$language回答，风格：$tone。\n资料：$context\n问题：$question")
print(tpl.substitute(language="中文", tone="简洁", context="…", question="什么是 RAG？"))
print(tpl.safe_substitute(language="中文", question="缺参数时不抛错"))
```

## 最小项目：把粘贴进来的网页文本洗成可用的上下文

真实场景：用户从网页复制了一段带零宽字符、不间断空格、多余空行和 markdown 残留的文本，要拼进提示词。清洗顺序很重要——**先规范化、再切分、最后截断**：

```python
import re
import unicodedata

# 故意放一条脏数据：零宽字符、不间断空格、全角空格、markdown 链接、连续空行
dirty = """  检索增强生成（RAG）\u200b \u00a0是一种\u3000范式。

参见[官方文档](https://example.org/docs)。

"""

def clean_for_prompt(text: str, *, max_chars: int = 500) -> str:
    """把外部粘贴的文本规范化成适合拼进提示词的纯文本。"""
    # 1. Unicode 规范化：合并兼容字符（全角/半角、预组合符号），NFKC 顺带处理兼容形式
    text = unicodedata.normalize("NFKC", text)
    # 2. 删除控制字符与零宽字符（保留 \n\t 以便后续按行切分）
    text = "".join(ch for ch in text if ch in "\n\t" or ch.isprintable())
    # 3. 所有空白折叠为单个空格，并把 markdown 链接压成锚文本
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"\s+", " ", text)
    # 4. 去首尾空白
    text = text.strip()
    # 5. 超长时从尾部截断，避免撑爆上下文
    if len(text) > max_chars:
        text = text[:max_chars].rstrip() + "……"
    return text


cleaned = clean_for_prompt(dirty)
print(repr(cleaned))
# '检索增强生成(RAG) 是一种 范式。 参见官方文档。'

prompt = "\n\n".join([
    "你是检索助手，请仅依据资料回答。",
    "资料：\n" + cleaned,
    "问题：RAG 的核心思想是什么？",
])
print(f"提示词总长度：{len(prompt)} 字符")
```

几个设计要点：`isprintable()` 过滤掉不可见控制符；`\s+` 的正则会把 `\u00a0`（不间断空格）和 `\u3000`（全角空格）一并折叠，因为它们在 Unicode 里都算空白；上面输出里可以直接看到 `NFKC` 的效果：全角括号 `（）` 变成了半角 `()`，全角空格 `\u3000` 被折成一个普通空格；它还会把兼容字形（如 ﬁ 连字）拆成普通字母。反过来，它**不会**改动中文标点里的顿号、句号 `。`，因为那些没有半角兼容形式——需要更彻底的标点归一时得自己补一张映射表。

## 常见坑

**1. 以为 `strip()` 会改原串。** 字符串不可变，返回值必须接住。

**2. `strip(".jpeg")` 当 `removesuffix(".jpeg")` 用。** 参数是字符集合，会把首尾任意一个 `.`、`j`、`p`、`e`、`g` 都剥掉。用 3.9+ 的 `removeprefix()` / `removesuffix()`。

**3. `split()` 与 `split(" ")` 混用。** 前者忽略连续空白、后者产生空串。读 `splitlines()` 与 `split("\n")` 的差别也在这里：末行有换行时后者会多出一个空元素。

**4. 用切片判断前缀。** `if s[:3] == "bar":` 短字符串会静默失败且难读，写 `s.startswith("bar")`（PEP 8 明确要求）。

**5. 在循环里 `s += piece` 拼接。** 见上文；改用列表收集 + `join`，或 `io.StringIO`。

**6. 用 `title()` 做专有名词规范化。** `IOError`.title() → `Ioerror`。

**7. 忘了 f-string 的表达式语义。** f-string 里的 `{}` 会当真表达式求值，字符串里有大括号时要么写 `&#123;&#123;`/`}}` 转义，要么干脆别用 f-string（模板来自外部时尤其重要）。

**8. 拿 `len(s)` 估 token。** 字符数与模型 token 数没有稳定比例，中文尤其明显。做预算控制时按字符数粗筛可以，最终要用各家的 tokenizer 或 API 返回的 `usage` 字段核对。

**9. `isalpha()` 判「是不是中文」。** 它对任何字母文字都为真（含拉丁、假名），且对汉字也返回真——因为 CJK 汉字属于字母类。要判断脚本类型请用 `unicodedata.name(ch)` 或 `regex` 的 `\p{Han}`。

## 延伸阅读

- 文本序列类型 — str 与 String Methods：<https://docs.python.org/zh-cn/3/library/stdtypes.html#string-methods>
- 文本处理服务（含 `textwrap`、`unicodedata`、`re`）：<https://docs.python.org/zh-cn/3/library/text.html>
- 字符串模板 <https://docs.python.org/zh-cn/3/library/string.html> 与格式化语法（含 f-string 语法）
- 站内相邻文章：《数字与字符串（f-string 与 UTF-8 编码）》《正则表达式》《文件 IO》《列表推导式》《迭代与解包技巧》

<details>
<summary>参考：str 类型方法全表（译自官方库文档）</summary>

以下译自 [String Methods — Python 标准库](https://docs.python.org/zh-cn/3/library/stdtypes.html#string-methods)。字符串同时实现全部[通用序列操作](https://docs.python.org/zh-cn/3/library/stdtypes.html#common-sequence-operations)（`len`、`+`、`in`、切片、`count`、`index`）。

**变形类**

| 方法 | 说明 |
| --- | --- |
| `capitalize()` | 首字符大写、其余小写（首字符按 titlecase 处理） |
| `casefold()` | 激进小写化，用于忽略大小写的匹配 |
| `lower()` / `upper()` / `swapcase()` | 大小写转换 |
| `title()` | 每个单词首字母大写（不处理引号与缩写） |
| `center(w[, fill])` / `ljust(w[, fill])` / `rjust(w[, fill])` | 定宽对齐 |
| `zfill(width)` | 左侧补零到指定宽度，符号位保持在最前 |
| `expandtabs(tabsize=8)` | 制表符展开为空格 |
| `replace(old, new[, count])` | 替换，最多 `count` 次 |
| `translate(table)` | 按 `str.maketrans()` 生成的表做单字符映射/删除 |
| `removeprefix(p)` / `removesuffix(s)` | 去掉精确前缀/后缀（3.9+），不含该前后缀时原样返回 |
| `encode(encoding='utf-8', errors='strict')` | 转 `bytes` |
| `format(*args, **kwargs)` / `format_map(mapping)` | 按格式化语法渲染 |

**裁剪类**

| 方法 | 说明 |
| --- | --- |
| `strip([chars])` / `lstrip([chars])` / `rstrip([chars])` | 去除首尾**属于 chars 集合**的字符（不是子串）；`chars` 省略时去除空白 |

**查找与计数类**

| 方法 | 说明 |
| --- | --- |
| `find(sub[, start[, end]])` / `rfind(...)` | 返回下标，找不到返回 `-1` |
| `index(sub[, start[, end]])` / `rindex(...)` | 同 `find`/`rfind`，找不到抛 `ValueError` |
| `count(sub[, start[, end]])` | 非重叠出现次数 |
| `startswith(prefix[, start[, end]])` / `endswith(suffix[, start[, end]])` | 前缀/后缀判断，参数可为元组（任一匹配即为真） |
| `partition(sep)` / `rpartition(sep)` | 返回 `(前, sep, 后)` 三元组；未找到时 `sep` 为空串 |

**拆分与连接类**

| 方法 | 说明 |
| --- | --- |
| `split(sep=None, maxsplit=-1)` | `sep` 为 `None` 时按连续空白切分且不产生空串 |
| `rsplit(...)` | 从右开始切，参数含义相同 |
| `splitlines(keepends=False)` | 按多种换行符切分，不产生末尾空行 |
| `join(iterable)` | 用该字符串作分隔符连接可迭代对象中的字符串 |

**判断类**（对空串一律返回 `False`；「空白」定义为 Unicode 空白加控制字符）

| 方法 | 为真的条件 |
| --- | --- |
| `isalpha()` | 全是不为空的字符且至少一个是字母 |
| `isascii()` | 全为 ASCII 字符或为空串 |
| `isdecimal()` / `isdigit()` / `isnumeric()` | 严格程度递增：十进制数字 ⊂ 数字 ⊂ 数值字符 |
| `isidentifier()` | 是合法标识符（不查关键字） |
| `islower()` / `isupper()` | 含至少一个区分大小写的字符，且这类字符全小写/全大写 |
| `isprintable()` | 全部字符可打印（空格可打印，`\t`、`\n` 不可打印） |
| `isspace()` | 全为空白且非空 |
| `istitle()` | 是 titlecase（大小写不敏感的字符不作词首字符） |

同标准库 `re` 与 `unicodedata` 提供的能力不在此表内，见《正则表达式》。

</details>

---

> **来源**：抓取于 2026-09-19。译自 [String Methods — Python 标准库（中文）](https://docs.python.org/zh-cn/3/library/stdtypes.html#string-methods)（Python Software Foundation，PSF 许可证第 2 版），并引 [文本处理服务](https://docs.python.org/zh-cn/3/library/text.html)、[string — 常见字符串操作](https://docs.python.org/zh-cn/3/library/string.html)（作者与许可同上）；官方中文页该节为英文原文，中文表述由本站译出。文本清洗流水线、常见坑与 token 估算提示为本站编者注。
