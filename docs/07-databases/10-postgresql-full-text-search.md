---
title: PostgreSQL 全文检索（含中文分词）
source_url: https://www.postgresql.org/docs/current/textsearch.html
author: PostgreSQL Global Development Group；amutu（zhparser）；Pan Jiamin（pg_jieba）
license: PostgreSQL Licence；zhparser 为 PostgreSQL 许可风格许可；pg_jieba 为 BSD-3-Clause
fetched_at: 2026-09-13
translated: true
versions: PostgreSQL 18 官方文档第 12 章 Full Text Search（12.1–12.4、12.7–12.9、12.11 节）
order: 10
group: PostgreSQL 与工程化
---
## 全文检索是什么

本章来源为 PostgreSQL 官方文档第 12 章 Full Text Search。全文检索（Full Text Searching，或简称**文本检索 / text search**）提供这样一种能力：找出满足某个**查询（query）**的自然语言**文档（document）**，并可选地按与查询的相关度排序。最常见的搜索是找出所有包含给定**查询词**的文档，并按与查询的**相似度**排序返回。`query` 与 `similarity` 的含义非常灵活，取决于具体应用：最简单的搜索把 query 视为一组词，把 similarity 视为查询词在文档中出现的频率。

文本搜索算子在数据库里已存在多年。PostgreSQL 为文本类型提供了 `~`、`~*`、`LIKE` 和 `ILIKE` 算子，但它们缺少现代信息系统所需的许多关键性质：

- 没有语言学支持，哪怕对英语也没有。正则表达式不够用，因为它们无法方便地处理派生词，例如 `satisfies` 和 `satisfy`。搜索 `satisfy` 时你很可能希望找出包含 `satisfies` 的文档，但可能会漏掉。虽然可以用 `OR` 罗列多个派生形式，但这既繁琐又易错（有些词的派生形式多达数千个）。
- 不提供搜索结果的排序（ranking），当匹配文档成千上万时基本不可用。
- 它们往往很慢，因为没有索引支持，每次搜索都要扫描全部文档。

全文索引允许对文档做**预处理**并把索引保存下来供日后快速搜索。预处理包括：

- **把文档解析成词元（token）**。区分各类 token 很有用，比如数字、单词、复合词、电子邮件地址，以便分别处理。原则上 token 类别取决于具体应用，但对多数场景使用一组预定义类别就足够了。PostgreSQL 用**解析器（parser）**完成这一步：发行版自带标准解析器，也可以按需创建自定义解析器。
- **把 token 转换成词位（lexeme）**。lexeme 和 token 一样是字符串，但经过**归一化（normalized）**处理，使同一个词的不同形式变得一致。例如归一化几乎总包括大小写折叠，通常还包括去后缀（如英语的 `s`、`es`）。这样搜索就能命中同一个词的各种变体，而无须穷举所有形式。这一步通常还会剔除**停用词（stop words）**——那些太常见、对搜索毫无价值的词。（简言之：token 是文档文本的原始碎片，lexeme 是被认为对索引和搜索有用的词。）PostgreSQL 用**词典（dictionary）**完成这一步：提供多种标准词典，也可按需创建自定义词典。
- **存储为利于搜索的预处理文档**。例如每个文档可以表示为排序后的归一化 lexeme 数组。除 lexeme 外，通常还想保存位置信息用于**邻近度排序（proximity ranking）**——查询词"密集"出现的文档比查询词散落各处的文档获得更高的排名。

词典让 token 归一化的控制可以做到很细。配合恰当的词典，你可以：

- 定义不参与索引的停用词。
- 用 Ispell 词典把同义词映射到同一个词。
- 用同义词典（thesaurus）把短语映射到单个词。
- 用 Ispell 词典把一个词的不同变体映射到规范形式。
- 用 Snowball 词干规则把一个词的不同变体映射到规范形式。

PostgreSQL 提供存储预处理文档的 `tsvector` 类型与表示处理后查询的 `tsquery` 类型（8.11 节"文本搜索类型"），并为这两种类型提供了大量函数和算子（9.13 节），其中最重要的是匹配算子 `@@`（下一节介绍）。全文搜索还可以用索引加速（12.9 节）。

### 什么是文档

**文档**是全文检索系统中的搜索单位，例如一篇杂志文章或一封邮件。文本搜索引擎必须能解析文档，并把 lexeme（关键词）与其所属文档的关联保存下来；之后用这些关联搜索包含查询词的文档。

在 PostgreSQL 里做搜索时，文档通常是数据库表一行内的文本字段，或这类字段的组合（拼接）——它们可能分散在多个表中，甚至是动态计算的。换句话说，文档可以由不同部分拼起来去建索引，本身并不需要作为整体存储。例如：

```sql
SELECT title || ' ' ||  author || ' ' ||  abstract || ' ' || body AS document
FROM messages
WHERE mid = 12;

SELECT m.title || ' ' || m.author || ' ' || m.abstract || ' ' || d.body AS document
FROM messages m, docs d
WHERE m.mid = d.did AND m.mid = 12;
```

> **注意**：实际上，这些示例查询应当使用 `coalesce`，防止某个 `NULL` 属性导致整个文档变成 `NULL`。

另一种做法是把文档以纯文本文件存在文件系统里。此时数据库只保存全文索引并执行搜索，用某个唯一标识符再从文件系统取回文档。但从数据库外部取文件需要超级用户权限或特殊的函数支持，通常不如把数据都放进 PostgreSQL 方便。而且数据都在库里时，文档元数据也易于访问，便于索引与展示。

就文本检索而言，每个文档都必须归约为预处理后的 `tsvector` 格式。搜索与排序完全在文档的 `tsvector` 表示上进行——只有当文档被选中要展示给用户时才需要取回原文。所以我们常说 `tsvector` 就是"文档"，当然它只是完整文档的紧凑表示。

### 基本文本匹配

PostgreSQL 的全文检索建立在匹配算子 `@@` 之上：当 `tsvector`（文档）匹配 `tsquery`（查询）时返回 `true`。两种数据类型谁写在前面都可以：

```sql
SELECT 'a fat cat sat on a mat and ate a fat rat'::tsvector @@ 'cat & rat'::tsquery;
 ?column?
----------
 t

SELECT 'fat & cow'::tsquery @@ 'a fat cat sat on a mat and ate a fat rat'::tsvector;
 ?column?
----------
 f
```

正如上面的例子所示，`tsquery` 不是原始文本，`tsvector` 也不是。`tsquery` 包含搜索词，这些搜索词必须是已归一化的 lexeme，并且可以用 AND、OR、NOT、FOLLOWED BY 算子组合多个词（语法细节见 8.11.2 节）。`to_tsquery`、`plainto_tsquery`、`phraseto_tsquery` 这几个函数能把用户输入的文本转成规范的 `tsquery`，主要手段就是把文本里的词做归一化。类似地，`to_tsvector` 用于解析并归一化文档字符串。所以实际使用中的匹配更像这样：

```sql
SELECT to_tsvector('fat cats ate fat rats') @@ to_tsquery('fat & rat');
 ?column?
----------
 t
```

注意，如果写成下面这样，匹配就不会成功：

```sql
SELECT 'fat cats ate fat rats'::tsvector @@ to_tsquery('fat & rat');
 ?column?
----------
 f
```

因为这里 `rats` 没有被归一化。`tsvector` 的元素是 lexeme，默认已归一化，所以 `rats` 匹配不上 `rat`。

`@@` 算子也支持 `text` 输入，简单场景可以省去把文本串显式转换为 `tsvector` 或 `tsquery` 的步骤。可用形式有：

```text
tsvector @@ tsquery
tsquery  @@ tsvector
text @@ tsquery
text @@ text
```

前两种已经见过。`text @@ tsquery` 等价于 `to_tsvector(x) @@ y`；`text @@ text` 等价于 `to_tsvector(x) @@ plainto_tsquery(y)`。

在 `tsquery` 中，`&`（AND）要求两个参数都出现在文档里才匹配；`|`（OR）要求至少出现一个；`!`（NOT）要求参数**不**出现才匹配。例如查询 `fat & ! rat` 匹配包含 `fat` 但不包含 `rat` 的文档。

短语搜索可以借助 `<->`（FOLLOWED BY）算子：只有当两个参数的匹配相邻且顺序一致时才算命中。例如：

```sql
SELECT to_tsvector('fatal error') @@ to_tsquery('fatal <-> error');
 ?column?
----------
 t

SELECT to_tsvector('error is not fatal') @@ to_tsquery('fatal <-> error');
 ?column?
----------
 f
```

FOLLOWED BY 还有更一般的形式 `<N>`，其中 N 是整数，表示匹配 lexeme 之间的位置差。`<1>` 等价于 `<->`；`<2>` 允许两个匹配之间恰好隔一个其他 lexeme，依此类推。`phraseto_tsquery` 就利用这个算子构造 `tsquery`，使得短语中的部分词是停用词时也能匹配多词短语：

```sql
SELECT phraseto_tsquery('cats ate rats');
       phraseto_tsquery
-------------------------------
 'cat' <-> 'ate' <-> 'rat'

SELECT phraseto_tsquery('the cats ate the rats');
       phraseto_tsquery
-------------------------------
 'cat' <-> 'ate' <2> 'rat'
```

一个偶尔有用的特例：`<0>` 可用于要求两个模式匹配同一个词。

可以用括号控制 `tsquery` 算子的嵌套。不加括号时，`|` 结合得最松，其次是 `&`，然后 `<->`，`!` 最紧。

值得注意的是：AND/OR/NOT 出现在 FOLLOWED BY 参数内部时，含义有微妙差别，因为 FOLLOWED BY 内匹配的精确位置是有意义的。比如通常 `!x` 只匹配全文不含 `x` 的文档；但 `!x <-> y` 匹配的是"y 的前面不是紧挨着一个 x"的文档——x 出现在文档其他位置并不妨碍匹配。又如 `x & y` 通常只要求 x、y 都出现在文档某处，而 `(x & y) <-> z` 要求 x、y 在同一位置匹配且紧挨在 z 之前。因此该查询与 `x <-> z & y <-> z` 行为不同，后者匹配的是分别含有 `x z` 和 `y z` 两个序列的文档。（这个具体查询按字面写并无用处，因为 x 和 y 不可能在同一位置匹配；但在更复杂的场景——如前缀匹配模式下——这类查询可能有用。）

### 配置

以上都是简单的文本搜索例子。如前所述，全文检索还能做更多：跳过某些词的索引（停用词）、处理同义词、使用更复杂的解析（例如不只是按空白切分）。这些行为由**文本搜索配置（text search configuration）**控制。PostgreSQL 为多种语言预置了配置，也很容易创建自己的配置（psql 的 `\dF` 命令可列出全部可用配置）。

安装时会选定一个合适的配置，并在 `postgresql.conf` 里相应设置 `default_text_search_config`。如果整个集群用同一套文本搜索配置，直接用 `postgresql.conf` 里的值即可。若集群内各数据库用不同配置、而单个数据库内一致，用 `ALTER DATABASE ... SET`；否则可在每个会话中设置 `default_text_search_config`。

每个依赖配置的文本搜索函数都有一个可选的 `regconfig` 参数，可显式指定配置；只有省略该参数时才使用 `default_text_search_config`。

为了便于构建自定义配置，配置由更简单的数据库对象组合而成。PostgreSQL 的文本搜索设施提供四类与配置相关的数据库对象：

- **文本搜索解析器（parser）**：把文档拆成 token 并给每个 token 分类（例如是单词还是数字）。
- **文本搜索词典（dictionary）**：把 token 转换成归一化形式，并过滤停用词。
- **文本搜索模板（template）**：提供词典底层的函数。（词典只是指定一个模板加一组参数。）
- **文本搜索配置（configuration）**：选定一个解析器和一组词典，用于归一化解析器产出的 token。

解析器和模板由底层 C 函数构成，开发新的需要 C 编程能力，安装进数据库需要超级用户权限（PostgreSQL 发行版的 `contrib/` 目录里有一些附加解析器和模板的示例）。词典和配置只是对底层解析器和模板做参数化并组装，创建它们不需要特殊权限。本章稍后有创建自定义词典与配置的例子。

## 表和索引

上一节用简单常量字符串演示了全文匹配。本节展示如何搜索表数据，并可选地使用索引。

### 搜索一张表

不建索引也可以做全文搜索。一个简单查询——打印 `body` 字段含单词 `friend` 的每一行的 `title`：

```sql
SELECT title
FROM pgweb
WHERE to_tsvector('english', body) @@ to_tsquery('english', 'friend');
```

它也能命中 `friends`、`friendly` 这类相关词，因为它们都被归约成了同一个归一化 lexeme。

上面的查询指定用 `english` 配置来解析和归一化字符串。也可以省略配置参数：

```sql
SELECT title
FROM pgweb
WHERE to_tsvector(body) @@ to_tsquery('friend');
```

此时使用 `default_text_search_config` 所设置的配置。

更复杂的例子：选出 `title` 或 `body` 里同时含 `create` 与 `table` 的最近十篇文档：

```sql
SELECT title
FROM pgweb
WHERE to_tsvector(title || ' ' || body) @@ to_tsquery('create & table')
ORDER BY last_mod_date DESC
LIMIT 10;
```

为清晰起见省略了 `coalesce` 调用——要找出两个字段任一为 `NULL` 的行时需要它。

这类查询不建索引也能跑，但除偶发的临时查询外，多数应用都会嫌它太慢。文本搜索的实战使用通常需要建索引。

### 创建索引

我们可以建 GIN 索引（见 12.9 节）来加速文本搜索：

```sql
CREATE INDEX pgweb_idx ON pgweb USING GIN (to_tsvector('english', body));
```

注意这里用的是双参数版 `to_tsvector`。只有指定了配置名的文本搜索函数才能用于表达式索引（11.7 节），因为索引内容必须不受 `default_text_search_config` 影响；否则索引内容可能不一致——不同条目可能是用不同文本搜索配置生成的 `tsvector`，而且无从分辨。这种索引也无法正确地转储与恢复。

因为上面的索引用的是双参数版 `to_tsvector`，查询也只有使用**同名配置**的双参数版 `to_tsvector` 才会走该索引。也就是说 `WHERE to_tsvector('english', body) @@ 'a & b'` 能用索引，而 `WHERE to_tsvector(body) @@ 'a & b'` 不能。这保证了索引只会被创建它时所用的同一配置的查询使用。

还可以建更复杂的表达式索引，把配置名放到另一列中，例如：

```sql
CREATE INDEX pgweb_idx ON pgweb USING GIN (to_tsvector(config_name, body));
```

其中 `config_name` 是 `pgweb` 表的一列。这样同一个索引里可以混用多种配置，同时记录每个索引条目用的配置。如果文档集里有多语言文档，这就很有用。同样，想走索引的查询必须写成匹配的形式，如 `WHERE to_tsvector(config_name, body) @@ 'a & b'`。

索引甚至可以拼接多列：

```sql
CREATE INDEX pgweb_idx ON pgweb USING GIN (to_tsvector('english', title || ' ' || body));
```

另一种做法是单开一列 `tsvector` 存放 `to_tsvector` 的输出。要让该列随源数据自动保持最新，可用存储生成列（stored generated column）。下例拼接 `title` 与 `body`，并用 `coalesce` 保证一个字段为 `NULL` 时另一个字段仍会被索引：

```sql
ALTER TABLE pgweb
    ADD COLUMN textsearchable_index_col tsvector
               GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) STORED;
```

然后建 GIN 索引加速搜索：

```sql
CREATE INDEX textsearch_idx ON pgweb USING GIN (textsearchable_index_col);
```

现在可以执行快速的全文搜索了：

```sql
SELECT title
FROM pgweb
WHERE textsearchable_index_col @@ to_tsquery('create & table')
ORDER BY last_mod_date DESC
LIMIT 10;
```

与表达式索引相比，独立列方案的优势是：查询无须显式指定文本搜索配置即可走索引（如上例，查询可以依赖 `default_text_search_config`）；而且搜索更快，因为验证索引命中时无须重新执行 `to_tsvector`（这一点用 GiST 索引时比 GIN 索引更重要，见 12.9 节）。表达式索引方案则搭建更简单，磁盘占用更少，因为不用显式存储 `tsvector` 表示。

## 控制文本搜索

实现全文检索，需要能把文档转成 `tsvector`、把用户查询转成 `tsquery` 的函数；还需要按相关度给出有用的排序，这要求一个比较文档与查询相关度的函数；把结果漂亮地展示出来也很重要。PostgreSQL 对这一切都提供了支持。

### 解析文档

PostgreSQL 提供 `to_tsvector` 函数把文档转成 `tsvector` 类型：

```text
to_tsvector([ config regconfig, ] document text) returns tsvector
```

`to_tsvector` 把文本文档解析成 token、把 token 归约为 lexeme，返回一个列出各 lexeme 及其在文档中位置的 `tsvector`。文档按指定的（或缺省的）文本搜索配置处理。一个简单例子：

```sql
SELECT to_tsvector('english', 'a fat  cat sat on a mat - it ate a fat rats');
                 to_tsvector
-----------------------------------------------------
 'ate':9 'cat':3 'fat':2,11 'mat':7 'rat':12 'sat':4
```

从上例可见：结果 `tsvector` 不含 `a`、`on`、`it`；`rats` 变成了 `rat`；标点 `-` 被忽略。

`to_tsvector` 内部调用解析器把文档文本拆成 token 并给每个 token 定类型。对每个 token，按其类型查一列词典（见 12.6 节），**识别（recognize）**该 token 的第一个词典会产出一个或多个归一化 lexeme 来表示它。比如 `rats` 变成 `rat`，就是因为某个词典识别出 `rats` 是 `rat` 的复数。有些词被识别为**停用词**（见 12.6.1 节），因为出现太频繁、对搜索没有价值而被忽略——本例中是 `a`、`on` 和 `it`。如果列表中没有任何词典识别该 token，它也会被忽略——本例的标点 `-` 就是这种情形：它的 token 类型（Space symbols）根本没有配置任何词典，空白类 token 因此永远不会被索引。解析器、词典以及索引哪些类型的 token，都由所选的文本搜索配置决定（见 12.7 节）。同一个数据库里可以有许多不同配置，各种语言也有预置配置。本例用的是英语的默认配置 `english`。

`setweight` 函数可给 `tsvector` 的条目打上给定的**权重（weight）**标签，权重是字母 `A`、`B`、`C`、`D` 之一。典型用途是标记条目来自文档的不同部分，比如标题或正文；之后这些信息可用于搜索结果排序。

由于 `to_tsvector(NULL)` 会返回 `NULL`，字段可能为空时建议总是套一层 `coalesce`。从结构化文档创建 `tsvector` 的推荐写法：

```sql
UPDATE tt SET ti =
    setweight(to_tsvector(coalesce(title,'')), 'A')    ||
    setweight(to_tsvector(coalesce(keyword,'')), 'B')  ||
    setweight(to_tsvector(coalesce(abstract,'')), 'C') ||
    setweight(to_tsvector(coalesce(body,'')), 'D');
```

这里先用 `setweight` 给最终 `tsvector` 中每个 lexeme 标注来源，再用 `tsvector` 拼接算子 `||` 合并带标签的 `tsvector`（细节见 12.4.1 节）。

### 解析查询

PostgreSQL 提供 `to_tsquery`、`plainto_tsquery`、`phraseto_tsquery`、`websearch_to_tsquery` 四个函数把查询转成 `tsquery` 类型。`to_tsquery` 的能力比 `plainto_tsquery`/`phraseto_tsquery` 更全，但对输入更挑剔；`websearch_to_tsquery` 是 `to_tsquery` 的简化版，语法类似网络搜索引擎。

```text
to_tsquery([ config regconfig, ] querytext text) returns tsquery
```

`to_tsquery` 从 `querytext` 创建 `tsquery` 值。`querytext` 必须由单个 token 组成，token 之间用 `tsquery` 算子 `&`（AND）、`|`（OR）、`!`（NOT）、`<->`（FOLLOWED BY）连接，并可用括号分组。换言之，`to_tsquery` 的输入必须已经符合 `tsquery` 的基本输入规则（8.11.2 节）。区别在于：基本的 `tsquery` 输入按字面取 token，而 `to_tsquery` 会按指定（或缺省）配置把每个 token 归一化成 lexeme，并按配置丢弃停用词。例如：

```sql
SELECT to_tsquery('english', 'The & Fat & Rats');
  to_tsquery
---------------
 'fat' & 'rat'
```

与基本 `tsquery` 输入一样，可以给 lexeme 附上权重，限制只匹配 `tsvector` 中带这些权重的 lexeme：

```sql
SELECT to_tsquery('english', 'Fat | Rats:AB');
    to_tsquery
------------------
 'fat' | 'rat':AB
```

还可以给 lexeme 附 `*` 表示前缀匹配：

```sql
SELECT to_tsquery('supern:*A & star:A*B');
        to_tsquery
--------------------------
 'supern':*A & 'star':*AB
```

这样的 lexeme 会匹配 `tsvector` 中所有以给定字符串开头的词。

`to_tsquery` 也接受单引号括起的短语，主要用在配置了可触发该短语的同义词典（thesaurus）时。下例中，词典里有规则 `supernovae stars : sn`：

```sql
SELECT to_tsquery('''supernovae stars'' & !crab');
  to_tsquery
---------------
 'sn' & !'crab'
```

不加引号时，未被 AND/OR/FOLLOWED BY 分隔的 token 会让 `to_tsquery` 抛出语法错误。

```text
plainto_tsquery([ config regconfig, ] querytext text) returns tsquery
```

`plainto_tsquery` 把无格式的文本 `querytext` 变成 `tsquery` 值。文本的解析与归一化与 `to_tsvector` 基本一致，然后在保留下来的词之间插入 `&`（AND）算子。示例：

```sql
SELECT plainto_tsquery('english', 'The Fat Rats');
 plainto_tsquery
-----------------
 'fat' & 'rat'
```

注意 `plainto_tsquery` 不识别输入中的 `tsquery` 算子、权重标签或前缀匹配标签：

```sql
SELECT plainto_tsquery('english', 'The Fat & Rats:C');
   plainto_tsquery
---------------------
 'fat' & 'rat' & 'c'
```

这里所有标点都被丢弃了。

```text
phraseto_tsquery([ config regconfig, ] querytext text) returns tsquery
```

`phraseto_tsquery` 与 `plainto_tsquery` 行为类似，只是在保留下来的词之间插入 `<->`（FOLLOWED BY）而非 `&`（AND）。而且停用词不是简单丢弃，而是插入 `<N>` 算子来计入。这个函数适合搜索确切的 lexeme 序列，因为 FOLLOWED BY 算子检查 lexeme 顺序，而不只是检查 lexeme 是否齐全。示例：

```sql
SELECT phraseto_tsquery('english', 'The Fat Rats');
 phraseto_tsquery
------------------
 'fat' <-> 'rat'
```

与 `plainto_tsquery` 一样，`phraseto_tsquery` 也不识别输入中的 `tsquery` 算子、权重标签或前缀匹配标签：

```sql
SELECT phraseto_tsquery('english', 'The Fat & Rats:C');
      phraseto_tsquery
-----------------------------
 'fat' <-> 'rat' <-> 'c'
```

```text
websearch_to_tsquery([ config regconfig, ] querytext text) returns tsquery
```

`websearch_to_tsquery` 用另一种语法从 `querytext` 创建 `tsquery`，在这种语法里简单的未格式化文本就是合法查询。与 `plainto_tsquery`、`phraseto_tsquery` 不同，它还能识别一些算子；并且该函数永远不会抛语法错误，因此可以直接用用户提交的原始输入做搜索。支持的语法：

- `unquoted text`：不在引号内的文本会转成用 `&` 连接的词项，效果如同 `plainto_tsquery` 处理。
- `"quoted text"`：引号内的文本转成用 `<->` 连接的词项，效果如同 `phraseto_tsquery` 处理。
- `OR`："or" 一词转成 `|` 算子。
- `-`：减号转成 `!` 算子。

其他标点一律忽略。所以与 `plainto_tsquery`、`phraseto_tsquery` 相同，`websearch_to_tsquery` 不识别输入中的 `tsquery` 算子、权重标签或前缀匹配标签。示例：

```sql
SELECT websearch_to_tsquery('english', 'The fat rats');
 websearch_to_tsquery
----------------------
 'fat' & 'rat'
(1 row)

SELECT websearch_to_tsquery('english', '"supernovae stars" -crab');
       websearch_to_tsquery
----------------------------------
 'supernova' <-> 'star' & !'crab'
(1 row)

SELECT websearch_to_tsquery('english', '"sad cat" or "fat rat"');
       websearch_to_tsquery
-----------------------------------
 'sad' <-> 'cat' | 'fat' <-> 'rat'
(1 row)

SELECT websearch_to_tsquery('english', 'signal -"segmentation fault"');
         websearch_to_tsquery
---------------------------------------
 'signal' & !( 'segment' <-> 'fault' )
(1 row)

SELECT websearch_to_tsquery('english', '""" )( dummy \\ query <->');
 websearch_to_tsquery
----------------------
 'dummi' & 'queri'
(1 row)
```

### 搜索结果排序

排序试图度量文档与特定查询的相关程度，以便在匹配很多时优先展示最相关的。PostgreSQL 提供两个预置排序函数，它们考虑词汇、邻近度和结构信息——即查询词在文档中出现多频繁、彼此多接近、出现在文档的哪个重要部位。但"相关度"本身是模糊且强依赖应用的：不同应用可能需要额外信息（如文档修改时间）参与排序。内置排序函数只是示例；你完全可以编写自己的排序函数，或把内置结果与其他因子组合以契合自身需求。

目前可用的两个排序函数是：

```text
ts_rank([ weights float4[], ] vector tsvector, query tsquery [, normalization integer ]) returns float4
```

基于匹配 lexeme 的频率对向量排序。

```text
ts_rank_cd([ weights float4[], ] vector tsvector, query tsquery [, normalization integer ]) returns float4
```

该函数按**覆盖密度（cover density）**对给定文档向量与查询排序，出自 Clarke、Cormack、Tudhope 发表于《Information Processing and Management》1999 年的论文"Relevance Ranking for One to Three Term Queries"。覆盖密度与 `ts_rank` 类似，但考虑了匹配 lexeme 之间的邻近度。

`ts_rank_cd` 需要 lexeme 的位置信息才能计算，因此会忽略 `tsvector` 中被"剥离（stripped）"的 lexeme；若输入中没有任何未剥离的 lexeme，结果为零（`strip` 函数与 `tsvector` 位置信息的更多信息见 12.4.1 节）。

对这两个函数，可选的 `weights` 参数允许按标签对不同位置的词区别加权。权重数组按以下顺序规定各类词的权重：

```text
{D-weight, C-weight, B-weight, A-weight}
```

不提供 `weights` 时使用默认值：

```text
{0.1, 0.2, 0.4, 1.0}
```

权重常用于标记文档特殊区域（如标题或开篇摘要）的词，使其比正文词更重要或更不重要。

长文档更有机会包含查询词，所以考虑文档长度是合理的：一篇 100 词的文档出现 5 次搜索词，大概率比 1000 词的文档出现 5 次更相关。两个排序函数都接受整数 `normalization` 选项，规定文档长度是否以及如何影响排名。这个整数控制多种行为，因此是位掩码：可用 `|` 组合多个行为（例如 `2|4`）。

- 0（默认）：忽略文档长度
- 1：排名除以 1 + 文档长度的对数
- 2：排名除以文档长度
- 4：排名除以词块间平均调和距离（仅 `ts_rank_cd` 实现）
- 8：排名除以文档中唯一词数
- 16：排名除以 1 + 文档中唯一词数的对数
- 32：排名除以自身 + 1

指定多个标志位时，变换按上面列出的顺序依次应用。

重要：排序函数不使用任何全局信息，因此无法做到有时期望的"归一化到 1% 或 100%"那样的公平刻度。归一化选项 32（`rank/(rank+1)`）可以把所有排名缩放进 0 到 1，但这只是表面变化，不会影响搜索结果的顺序。

下面这个例子只选出排名最高的十条匹配：

```sql
SELECT title, ts_rank_cd(textsearch, query) AS rank
FROM apod, to_tsquery('neutrino|(dark & matter)') query
WHERE query @@ textsearch
ORDER BY rank DESC
LIMIT 10;
                     title                     |   rank
-----------------------------------------------+----------
 Neutrinos in the Sun                          |      3.1
 The Sudbury Neutrino Detector                 |      2.4
 A MACHO View of Galactic Dark Matter          |  2.01317
 Hot Gas and Dark Matter                       |  1.91171
 The Virgo Cluster: Hot Plasma and Dark Matter |  1.90953
 Rafting for Solar Neutrinos                   |      1.9
 NGC 4650A: Strange Galaxy and Dark Matter     |  1.85774
 Hot Gas and Dark Matter                       |   1.6123
 Ice Fishing for Cosmic Neutrinos              |      1.6
 Weak Lensing Distorts the Universe            | 0.818218
```

同样的例子改用归一化排序：

```sql
SELECT title, ts_rank_cd(textsearch, query, 32 /* rank/(rank+1) */ ) AS rank
FROM apod, to_tsquery('neutrino|(dark & matter)') query
WHERE  query @@ textsearch
ORDER BY rank DESC
LIMIT 10;
                     title                     |        rank
-----------------------------------------------+-------------------
 Neutrinos in the Sun                          | 0.756097569485493
 The Sudbury Neutrino Detector                 | 0.705882361190954
 A MACHO View of Galactic Dark Matter          | 0.668123210574724
 Hot Gas and Dark Matter                       |  0.65655958650282
 The Virgo Cluster: Hot Plasma and Dark Matter | 0.656301290640973
 Rafting for Solar Neutrinos                   | 0.655172410958162
 NGC 4650A: Strange Galaxy and Dark Matter     | 0.650072921219637
 Hot Gas and Dark Matter                       | 0.617195790024749
 Ice Fishing for Cosmic Neutrinos              | 0.615384618911517
 Weak Lensing Distorts the Universe            | 0.450010798361481
```

排序可能很昂贵：它要查看每个匹配文档的 `tsvector`，可能受 I/O 限制而变慢。遗憾的是这几乎无法避免，因为实际查询常常产生大量匹配。

### 结果高亮

展示搜索结果时，最理想的是呈现每个文档的一个片段及其与查询的关联。搜索引擎通常展示文档片段并标记搜索词。PostgreSQL 提供 `ts_headline` 函数实现这一功能。

```text
ts_headline([ config regconfig, ] document text, query tsquery [, options text ]) returns text
```

`ts_headline` 接受文档与查询，返回文档的一个摘录并高亮查询词。具体地说，函数用查询选出相关的文本片段，然后高亮所有出现在查询中的词——即使这些词的位置不满足查询的限制。解析文档所用的配置可用 `config` 指定；省略时使用 `default_text_search_config`。

如果指定 `options` 字符串，必须由一或多个 `option=value` 对以逗号分隔组成。可用选项：

- `MaxWords`、`MinWords`（整数）：决定输出标题的最长与最短长度，默认 35 与 15。
- `ShortWord`（整数）：该长度及以下的词会从标题的首尾丢弃（查询词除外）。默认值 3 会消除常见的英语冠词。
- `HighlightAll`（布尔）：为 `true` 时整个文档作为标题输出，忽略前三个参数；默认 `false`。
- `MaxFragments`（整数）：展示的最大文本片段数。默认值 0 选择非片段式标题生成方法；大于 0 选择片段式生成（见下）。
- `StartSel`、`StopSel`（字符串）：用于定界文档中出现的查询词的字符串，使其区别于摘录中的其他词。默认 `<b>` 与 `</b>`，适合 HTML 输出（但注意下方警告）。
- `FragmentDelimiter`（字符串）：展示多个片段时的分隔符，默认 ` ... `。

> **警告：跨站脚本（XSS）安全**：`ts_headline` 的输出不保证可以安全地直接放进网页。当 `HighlightAll` 为 `false`（默认）时，会从文档移除一些简单的 XML 标签，但不保证移除所有 HTML 标记。因此在处理不可信输入时，这并不足以防御跨站脚本（XSS）等攻击。要防范此类攻击，应把输入文档中的所有 HTML 标记移除，或对输出使用 HTML 消毒器。

选项名不区分大小写。字符串值含空格或逗号时必须用双引号括起来。

非片段式生成时，`ts_headline` 找到给定 `query` 的匹配并选出单个展示，偏好在允许的标题长度内包含更多查询词的匹配。片段式生成时，`ts_headline` 找到查询匹配并把每个匹配拆成不超过 `MaxWords` 个词的"片段"，偏好查询词更多的片段，并尽量"延展"片段把周边词包括进来。查询匹配跨越文档大段内容、或希望展示多个匹配时，片段式更有用。两种模式下，若找不到任何查询匹配，则展示文档开头 `MinWords` 个词组成的一个片段。例如：

```sql
SELECT ts_headline('english',
  'The most common type of search
is to find all documents containing given query terms
and return them in order of their similarity to the
query.',
  to_tsquery('english', 'query & similarity'));
                        ts_headline
------------------------------------------------------------
 containing given <b>query</b> terms                       +
 and return them in order of their <b>similarity</b> to the+
 <b>query</b>.

SELECT ts_headline('english',
  'Search terms may occur
many times in a document,
requiring ranking of the search matches to decide which
occurrences to display in the result.',
  to_tsquery('english', 'search & term'),
  'MaxFragments=10, MaxWords=7, MinWords=3, StartSel=<<, StopSel=>>');
                        ts_headline
------------------------------------------------------------
 <<Search>> <<terms>> may occur                            +
 many times ... ranking of the <<search>> matches to decide
```

`ts_headline` 使用原始文档而非 `tsvector` 摘要，所以可能较慢，应谨慎使用。

## 附加功能

本节介绍与文本搜索配合使用的其他函数与算子。

### 操作文档

12.3.1 节展示了如何把原始文本转成 `tsvector`。PostgreSQL 还提供操作已处于 `tsvector` 形式的文档的函数与算子。

`tsvector || tsvector`：`tsvector` 拼接算子返回合并两个向量的 lexeme 与位置信息的向量。拼接时保留位置与权重标签；右侧向量中的位置会加上左侧向量出现的最大位置的偏移，因此结果几乎等价于对两个原始文档字符串拼接后执行 `to_tsvector`（不完全等价：从左侧参数尾部移除的停用词不影响结果，而文本拼接则会影响右侧 lexeme 的位置）。

以向量形式而非先拼接文本再做 `to_tsvector` 的一个好处是：可以对文档的不同部分用不同配置解析。另外，`setweight` 会把给定向量所有 lexeme 标成一样的权重，所以想给文档不同部分打不同权重时，必须先各自解析并 `setweight` 再拼接。

`setweight(vector tsvector, weight "char") returns tsvector`：返回输入向量的副本，其中每个位置都标上给定权重 `A`、`B`、`C`、`D` 之一（`D` 是新向量的默认值，输出时不显示）。拼接时标签保留，排序函数因此可以对文档不同部分的词区别加权。注意权重标签作用于**位置**而非 lexeme：输入向量若已剥离位置，`setweight` 不做任何事。

`length(vector tsvector) returns integer`：返回向量存储的 lexeme 数。

`strip(vector tsvector) returns tsvector`：返回列出同样 lexeme 但不含任何位置与权重信息的向量。结果通常比未剥离的小得多，但也更不有用：剥离后的向量排序效果变差，且 `<->`（FOLLOWED BY）`tsquery` 算子永远匹配不了剥离后的输入，因为它无法确定 lexeme 出现之间的距离。

`tsvector` 相关函数的完整清单见官方文档表 9.43。

### 操作查询

12.3.2 节展示了如何把原始文本查询转成 `tsquery`。PostgreSQL 还提供操作已处于 `tsquery` 形式的查询的函数与算子。

- `tsquery && tsquery`：返回两个查询的 AND 组合。
- `tsquery || tsquery`：返回两个查询的 OR 组合。
- `!! tsquery`：返回查询的否定（NOT）。
- `tsquery <-> tsquery`：返回"匹配第一个查询后紧跟匹配第二个查询"的查询（用 `<->` FOLLOWED BY 算子）。例如：

```sql
SELECT to_tsquery('fat') <-> to_tsquery('cat | rat');
          ?column?
----------------------------
 'fat' <-> ( 'cat' | 'rat' )
```

`tsquery_phrase(query1 tsquery, query2 tsquery [, distance integer ]) returns tsquery`：返回"第一个查询的匹配之后隔恰好 `distance` 个 lexeme 匹配第二个查询"的查询（用 `<N>` 算子）。例如：

```sql
SELECT tsquery_phrase(to_tsquery('fat'), to_tsquery('cat'), 10);
  tsquery_phrase
------------------
 'fat' <10> 'cat'
```

`numnode(query tsquery) returns integer`：返回 `tsquery` 的节点数（lexeme 加算子）。可用来判断查询是否有意义（大于 0）还是只含停用词（等于 0）。示例：

```sql
SELECT numnode(plainto_tsquery('the any'));
NOTICE:  query contains only stopword(s) or doesn't contain lexeme(s), ignored
 numnode
---------
       0

SELECT numnode('foo & bar'::tsquery);
 numnode
---------
       3
```

`querytree(query tsquery) returns text`：返回 `tsquery` 中可用于索引搜索的部分。用于检测不可索引的查询，例如只含停用词或只含否定词的查询。示例：

```sql
SELECT querytree(to_tsquery('defined'));
 querytree
-----------
 'defin'

SELECT querytree(to_tsquery('!defined'));
 querytree
-----------
 T
```

#### 查询改写

`ts_rewrite` 函数族在给定 `tsquery` 中搜索目标子查询的出现处，并把每处替换为替代子查询。本质上就是 `tsquery` 版的子串替换。一组"目标 + 替代"可视为一条**查询改写规则**；这样的规则集合是强大的搜索辅助。例如可以用同义词扩展搜索（`new york`、`big apple`、`nyc`、`gotham`），或收窄搜索把用户导向某个热点话题。该功能与同义词典（12.6.4 节）有部分重叠，但改写规则可以即时修改而无需重建索引，更新同义词典则需要重建索引才生效。

`ts_rewrite (query tsquery, target tsquery, substitute tsquery) returns tsquery`：这种形式只应用单条改写规则——`query` 中出现的 `target` 替换为 `substitute`。例如：

```sql
SELECT ts_rewrite('a & b'::tsquery, 'a'::tsquery, 'c'::tsquery);
 ts_rewrite
------------
 'b' & 'c'
```

`ts_rewrite (query tsquery, select text) returns tsquery`：这种形式接受起始 `query` 和一个以文本串给出的 SQL `select` 命令。`select` 必须产出两列 `tsquery`。对结果的每一行，当前 `query` 中出现的第一列值（目标）被替换为第二列值（替代）。例如：

```sql
CREATE TABLE aliases (t tsquery PRIMARY KEY, s tsquery);
INSERT INTO aliases VALUES('a', 'c');

SELECT ts_rewrite('a & b'::tsquery, 'SELECT t,s FROM aliases');
 ts_rewrite
------------
 'b' & 'c'
```

注意：这样应用多条改写规则时，应用顺序可能很重要，实践中应让源查询按某个排序键 `ORDER BY`。

看一个真实的天文学例子，用表驱动规则扩展查询 `supernovae`：

```sql
CREATE TABLE aliases (t tsquery primary key, s tsquery);
INSERT INTO aliases VALUES(to_tsquery('supernovae'), to_tsquery('supernovae|sn'));

SELECT ts_rewrite(to_tsquery('supernovae & crab'), 'SELECT * FROM aliases');
           ts_rewrite
---------------------------------
 'crab' & ( 'supernova' | 'sn' )
```

改写规则可以只靠更新表来修改：

```sql
UPDATE aliases
SET s = to_tsquery('supernovae|sn & !nebulae')
WHERE t = to_tsquery('supernovae');

SELECT ts_rewrite(to_tsquery('supernovae & crab'), 'SELECT * FROM aliases');
                 ts_rewrite
---------------------------------------------
 'crab' & ( 'supernova' | 'sn' & !'nebula' )
```

改写规则很多时会变慢，因为每条规则都要检查可能匹配。可以用 `tsquery` 类型的包含算子过滤掉明显不相关的规则。下例只选出可能匹配原查询的规则：

```sql
SELECT ts_rewrite('a & b'::tsquery,
                  'SELECT t,s FROM aliases WHERE ''a & b''::tsquery @> t');
 ts_rewrite
------------
 'b' & 'c'
```

### 自动更新的触发器

> **注意**：本节描述的方法已被 12.2.2 节介绍的存储生成列取代。

当用独立列存储文档的 `tsvector` 表示时，需要创建触发器在文档内容列变化时更新 `tsvector` 列。有两个内置触发器函数可用，也可以自己写：

```text
tsvector_update_trigger(tsvector_column_name, config_name, text_column_name [, ... ])
tsvector_update_trigger_column(tsvector_column_name, config_column_name, text_column_name [, ... ])
```

这两个触发器函数在 `CREATE TRIGGER` 命令参数的控制下，从一个或多个文本列自动计算 `tsvector` 列。用法示例：

```sql
CREATE TABLE messages (
    title       text,
    body        text,
    tsv         tsvector
);

CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON messages FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(tsv, 'pg_catalog.english', title, body);

INSERT INTO messages VALUES('title here', 'the body text is here');

SELECT * FROM messages;
   title    |         body          |            tsv
------------+-----------------------+----------------------------
 title here | the body text is here | 'bodi':4 'text':5 'titl':1

SELECT title, body FROM messages WHERE tsv @@ to_tsquery('title & body');
   title    |         body
------------+-----------------------
 title here | the body text is here
```

建好触发器后，`title` 或 `body` 的任何变化都会自动反映到 `tsv`，应用程序不必操心。

触发器第一个参数必须是要更新的 `tsvector` 列名。第二个参数指定转换所用的文本搜索配置：对 `tsvector_update_trigger`，配置名直接作为第二个触发器参数给出，必须如上例一样带 schema 限定，使触发器行为不随 `search_path` 改变；对 `tsvector_update_trigger_column`，第二个参数是另一列的列名（类型必须为 `regconfig`），从而可按行选择配置。其余参数是文本列名（`text`、`varchar` 或 `char` 类型），按给定顺序纳入文档，`NULL` 值跳过（其他列仍被索引）。

内置触发器的局限是对所有输入列一视同仁。要区别处理各列——比如标题权重与正文不同——需要写自定义触发器。下面是一个用 PL/pgSQL 作触发器语言的例子：

```sql
CREATE FUNCTION messages_trigger() RETURNS trigger AS $$
begin
  new.tsv :=
     setweight(to_tsvector('pg_catalog.english', coalesce(new.title,'')), 'A') ||
     setweight(to_tsvector('pg_catalog.english', coalesce(new.body,'')), 'D');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
    ON messages FOR EACH ROW EXECUTE FUNCTION messages_trigger();
```

记住：在触发器里创建 `tsvector` 值时显式指定配置名很重要，这样列内容才不会受 `default_text_search_config` 变化的影响；否则容易在转储恢复后出现搜索结果变化之类的麻烦。

### 收集文档统计信息

`ts_stat` 函数可用于检查配置、寻找停用词候选。

```text
ts_stat(sqlquery text, [ weights text, ]
        OUT word text, OUT ndoc integer,
        OUT nentry integer) returns setof record
```

`sqlquery` 是一个文本值，包含必须返回单个 `tsvector` 列的 SQL 查询。`ts_stat` 执行该查询，返回其中每个不同 lexeme（词）的统计信息。返回的列：

- `word` `text`——lexeme 的值
- `ndoc` `integer`——该词出现过的文档（`tsvector`）数
- `nentry` `integer`——该词出现的总次数

若提供 `weights`，只统计具有这些权重之一的出现。例如找文档集中最高频的十个词：

```sql
SELECT * FROM ts_stat('SELECT vector FROM apod')
ORDER BY nentry DESC, ndoc DESC, word
LIMIT 10;
```

同样，但只统计权重为 `A` 或 `B` 的出现：

```sql
SELECT * FROM ts_stat('SELECT vector FROM apod', 'ab')
ORDER BY nentry DESC, ndoc DESC, word
LIMIT 10;
```

## 配置示例

文本搜索配置规定了把文档变成 `tsvector` 所需的全部选项：用什么解析器把文本拆成 token，用什么词典把 token 转成 lexeme。每次调用 `to_tsvector` 或 `to_tsquery` 都需要一个文本搜索配置来完成处理。配置参数 `default_text_search_config` 指定默认配置的名字，文本搜索函数在省略显式配置参数时使用它。它可以在 `postgresql.conf` 中设置，也可以在会话中用 `SET` 命令设置。

系统提供若干预定义配置，你也可以轻松创建自定义配置。为便于管理文本搜索对象，系统提供了一组 SQL 命令，psql 也有几条显示文本搜索对象信息的命令（12.10 节）。

作为示例，我们创建配置 `pg`，从复制内置 `english` 配置开始：

```sql
CREATE TEXT SEARCH CONFIGURATION public.pg ( COPY = pg_catalog.english );
```

我们将使用一个 PostgreSQL 专用的同义词表，存放在 `$SHAREDIR/tsearch_data/pg_dict.syn`。文件内容形如：

```text
postgres    pg
pgsql       pg
postgresql  pg
```

这样定义同义词词典：

```sql
CREATE TEXT SEARCH DICTIONARY pg_dict (
    TEMPLATE = synonym,
    SYNONYMS = pg_dict
);
```

接着注册 Ispell 词典 `english_ispell`，它有自己的配置文件：

```sql
CREATE TEXT SEARCH DICTIONARY english_ispell (
    TEMPLATE = ispell,
    DictFile = english,
    AffFile = english,
    StopWords = english
);
```

现在为配置 `pg` 建立词的映射：

```sql
ALTER TEXT SEARCH CONFIGURATION pg
    ALTER MAPPING FOR asciiword, asciihword, hword_asciipart,
                      word, hword, hword_part
    WITH pg_dict, english_ispell, english_stem;
```

我们选择不索引、不搜索内置配置会处理的某些 token 类型：

```sql
ALTER TEXT SEARCH CONFIGURATION pg
    DROP MAPPING FOR email, url, url_path, sfloat, float;
```

现在测试配置：

```sql
SELECT * FROM ts_debug('public.pg', '
PostgreSQL, the highly scalable, SQL compliant, open source object-relational
database management system, is now undergoing beta testing of the next
version of our software.
');
```

下一步把会话切换到新配置——它创建在 `public` schema 里：

```text
=> \dF
   List of text search configurations
 Schema  | Name | Description
---------+------+-------------
 public  | pg   |

SET default_text_search_config = 'public.pg';
SET

SHOW default_text_search_config;
 default_text_search_config
----------------------------
 public.pg
```

## 测试与调试文本搜索

自定义文本搜索配置的行为很容易变得难以捉摸。本节介绍的函数对测试文本搜索对象很有用：可以测试完整配置，也可以单独测试解析器与词典。

### 配置测试

`ts_debug` 函数可以方便地测试文本搜索配置。

```text
ts_debug([ config regconfig, ] document text,
         OUT alias text,
         OUT description text,
         OUT token text,
         OUT dictionaries regdictionary[],
         OUT dictionary regdictionary,
         OUT lexemes text[])
         returns setof record
```

`ts_debug` 展示 `document` 的每个 token 经解析器产出、再由配置的词典处理后的信息。使用 `config` 指定的配置；省略该参数时用 `default_text_search_config`。

解析器在文本中识别出的每个 token 返回一行，返回的列：

- `alias` `text`——token 类型的短名
- `description` `text`——token 类型的描述
- `token` `text`——token 文本
- `dictionaries` `regdictionary[]`——配置为该 token 类型选定的词典
- `dictionary` `regdictionary`——识别该 token 的词典，无则 `NULL`
- `lexemes` `text[]`——识别该 token 的词典产出的 lexeme，无则 `NULL`；空数组（`{}`）表示被识别为停用词

一个简单例子：

```sql
SELECT * FROM ts_debug('english', 'a fat  cat sat on a mat - it ate a fat rats');
   alias   |   description   | token |  dictionaries  |  dictionary  | lexemes
-----------+-----------------+-------+----------------+--------------+---------
 asciiword | Word, all ASCII | a     | {english_stem} | english_stem | {}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | fat   | {english_stem} | english_stem | {fat}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | cat   | {english_stem} | english_stem | {cat}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | sat   | {english_stem} | english_stem | {sat}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | on    | {english_stem} | english_stem | {}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | a     | {english_stem} | english_stem | {}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | mat   | {english_stem} | english_stem | {mat}
 blank     | Space symbols   |       | {}             |              |
 blank     | Space symbols   | -     | {}             |              |
 asciiword | Word, all ASCII | it    | {english_stem} | english_stem | {}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | ate   | {english_stem} | english_stem | {ate}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | a     | {english_stem} | english_stem | {}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | fat   | {english_stem} | english_stem | {fat}
 blank     | Space symbols   |       | {}             |              |
 asciiword | Word, all ASCII | rats  | {english_stem} | english_stem | {rat}
```

更完整的演示：先为英语创建 `public.english` 配置和 Ispell 词典：

```sql
CREATE TEXT SEARCH CONFIGURATION public.english ( COPY = pg_catalog.english );

CREATE TEXT SEARCH DICTIONARY english_ispell (
    TEMPLATE = ispell,
    DictFile = english,
    AffFile = english,
    StopWords = english
);

ALTER TEXT SEARCH CONFIGURATION public.english
   ALTER MAPPING FOR asciiword WITH english_ispell, english_stem;

SELECT * FROM ts_debug('public.english', 'The Brightest supernovaes');
   alias   |   description   |    token    |         dictionaries          |   dictionary   |   lexemes
-----------+-----------------+-------------+-------------------------------+----------------+-------------
 asciiword | Word, all ASCII | The         | {english_ispell,english_stem} | english_ispell | {}
 blank     | Space symbols   |             | {}                            |                |
 asciiword | Word, all ASCII | Brightest   | {english_ispell,english_stem} | english_ispell | {bright}
 blank     | Space symbols   |             | {}                            |                |
 asciiword | Word, all ASCII | supernovaes | {english_ispell,english_stem} | english_stem   | {supernova}
```

本例中，`Brightest` 被解析器识别为 `ASCII word`（别名 `asciiword`）。对该 token 类型，词典列表是 `english_ispell` 与 `english_stem`。该词被 `english_ispell` 识别，并归约为名词 `bright`。`supernovaes` 不被 `english_ispell` 词典认识，于是传给下一个词典，幸运地被识别了（事实上 `english_stem` 是一个认识一切的 Snowball 词典，所以放在词典列表末尾）。

`The` 被 `english_ispell` 词典识别为停用词，不会被索引。空格也被丢弃，因为配置没有为它们提供任何词典。

显式指定想看哪些列可以收窄输出宽度：

```sql
SELECT alias, token, dictionary, lexemes
FROM ts_debug('public.english', 'The Brightest supernovaes');
   alias   |    token    |   dictionary   |   lexemes
-----------+-------------+----------------+-------------
 asciiword | The         | english_ispell | {}
 blank     |             |                |
 asciiword | Brightest   | english_ispell | {bright}
 blank     |             |                |
 asciiword | supernovaes | english_stem   | {supernova}
```

### 解析器测试

下面的函数可直接测试文本搜索解析器。

```text
ts_parse(parser_name text, document text,
         OUT tokid integer, OUT token text) returns setof record
ts_parse(parser_oid oid, document text,
         OUT tokid integer, OUT token text) returns setof record
```

`ts_parse` 解析给定的 `document`，对解析产出的每个 token 返回一条记录：`tokid` 是分配的 token 类型编号，`token` 是 token 文本。（`ts_token_type` 函数可列出解析器支持的全部 token 类型及编号，配合 `ts_parse` 使用即可核对每个 token 的归类——调试中文解析器时尤其有用。）

### 词典测试

`lexize` 函数可单独测试词典：

```text
lexize(dictionary regdictionary, token text) returns text[]
```

若词典认识该 token，`lexize` 返回其产出的 lexeme 数组；若是停用词则返回空数组；若不认识则返回 `NULL`。示例：

```sql
SELECT lexize('english_stem', 'stars');
 lexize
--------
 {star}
```

（官方文档 12.8 节还包含 `ts_parse`/`ts_token_type` 的更多示例，此处从略，请参见原文。）

## 文本搜索推荐的索引类型

有两种索引可以加速全文搜索：GIN 与 GiST。注意全文检索并不强制要求索引，但某列被经常搜索时，通常还是应当建索引。

创建索引的方式二选一：

```sql
CREATE INDEX name ON table USING GIN (column);
```

创建基于 GIN（Generalized Inverted Index，广义倒排索引）的索引，`column` 必须是 `tsvector` 类型。

```sql
CREATE INDEX name ON table USING GIST (column [ { DEFAULT | tsvector_ops } (siglen = number) ] );
```

创建基于 GiST（Generalized Search Tree，广义搜索树）的索引，`column` 可以是 `tsvector` 或 `tsquery` 类型。可选整数参数 `siglen` 决定签名长度（字节），详见下文。

GIN 索引是文本搜索的推荐索引类型。作为倒排索引，它为每个词（lexeme）保存一个索引条目，附压缩的匹配位置列表。多词搜索可以先找到第一个匹配，再用索引剔除缺少其他词的行。GIN 索引只存 `tsvector` 值中的词（lexeme），不存权重标签，因此查询涉及权重时需要回表复查。

GiST 索引是**有损（lossy）**的：索引可能产生假匹配，需要检查实际表行来排除（PostgreSQL 会在需要时自动做这件事）。GiST 索引有损是因为每个文档在索引中用定长签名表示。签名字节长度由可选整数参数 `siglen` 决定：默认（不指定 `siglen` 时）124 字节，最大 2024 字节。签名的生成方式是把每个词哈希到 n 位字符串中的某一位，所有位 OR 起来形成 n 位文档签名。两个词哈希到同一位就会产生假匹配。查询中所有词都有匹配（真或假）时必须取回表行确认匹配是否正确。签名越长搜索越精确（扫描的索引比例与堆页数更少），代价是索引更大。

GiST 索引可以是覆盖式（covering）的，即使用 `INCLUDE` 子句。被包含列的数据类型可以没有 GiST 算子类；被包含属性以未压缩形式存储。

有损会因不必要的表记录取回（结果是假匹配）造成性能下降。由于对表记录的随机访问很慢，这限制了 GiST 索引的用处。假匹配的概率取决于若干因素，尤其是唯一词的数量，因此建议用词典减少唯一词数。

注意：增大 `maintenance_work_mem` 通常能缩短 GIN 索引的构建时间，GiST 索引构建时间对该参数不敏感。

对大集合做分区并正确使用 GIN/GiST 索引，可以实现带在线更新的极快搜索。分区可以在数据库层用表继承完成，也可以把文档分散到多台服务器再汇合外部搜索结果（例如通过外部数据 / Foreign Data 访问）。后者之所以可行，是因为排序函数只使用本地信息。

## 中文分词：zhparser

PostgreSQL 内置解析器对中文这样的"无空格语言"无能为力——整句会被当作一个 token。社区的解决方案是把中文分词器实现为自定义文本搜索解析器。以下内容翻译自 [zhparser](https://github.com/amutu/zhparser) 仓库 README。

zhparser 是一个 PostgreSQL 中文（普通话）全文检索扩展，基于[简单中文分词 SCWS（Simple Chinese Word Segmentation）](https://github.com/hightman/scws)实现中文解析器。项目主页：http://blog.amutu.com/zhparser/ 。对分词结果不满意或需要调试的，可以在 http://www.xunsearch.com/scws/demo/v48.php 页面调试。

Docker 快速体验：

```text
docker run --name pgzhparser -d -e POSTGRES_PASSWORD=somepassword zhparser/zhparser:bookworm-16
docker exec -it pgzhparser psql postgres postgres
```

创建扩展并使用：

```sql
CREATE EXTENSION zhparser;
CREATE TEXT SEARCH CONFIGURATION testzhcfg (PARSER = zhparser);
ALTER TEXT SEARCH CONFIGURATION testzhcfg ADD MAPPING FOR n,v,a,i,e,l WITH simple;
SELECT * FROM ts_parse('zhparser', 'hello world! 2010年保障房建设在全国范围内获全面启动');
```

将得到：

```text
 tokid | token
-------+-------
   101 | hello
   101 | world
   117 | !
   101 | 2010
   113 | 年
   118 | 保障
   110 | 房建
   118 | 设在
   110 | 全国
   110 | 范围
   102 | 内
   118 | 获
    97 | 全面
   118 | 启动
(14 行记录)
```

更多 Docker 镜像信息见 zhparser 的 Docker Hub 页面；zhparser 的 Docker 镜像基于 PostgreSQL 官方 Docker 镜像构建。

安装步骤（官方 README"INSTALL"节）：前置条件为 PostgreSQL 9.2 及以上；RedHat/CentOS 需要安装 `postgresql-devel` 等相关库与头文件。第一步安装 SCWS（从 xunsearch 下载 scws-1.2.3 源码包，`./configure ; make install`，FreeBSD 10+ 需要 `--with-pic` 选项）；第二步 `git clone https://github.com/amutu/zhparser.git` 下载源码；第三步 `make && make install` 编译安装（SCWS 不在默认 `/usr/local` 时设置 `SCWS_HOME`；多版本 PostgreSQL 共存时用 `PG_CONFIG` 指定版本；*BSD 上用 `gmake`）；第四步 `CREATE EXTENSION zhparser` 创建扩展。

配置项（以下选项控制词典加载与分词行为，均非必需，默认 false，PG 9.2+ 可用）：

- 忽略所有的标点等特殊符号：`zhparser.punctuation_ignore = f`
- 闲散文字自动以二字分词法聚合：`zhparser.seg_with_duality = f`
- 将词典全部加载到内存里：`zhparser.dict_in_memory = f`
- 短词复合：`zhparser.multi_short = f`
- 散字二元复合：`zhparser.multi_duality = f`
- 重要单字复合：`zhparser.multi_zmain = f`
- 全部单字复合：`zhparser.multi_zall = f`

除了 zhparser 自带的词典，用户可以增加自定义词典，自定义词典的优先级高于自带词典。自定义词典文件必须放在 `share/tsearch_data` 目录中，zhparser 根据扩展名确定格式：`.txt` 为文本格式，`.xdb` 为 xdb 格式；多个文件用逗号分隔，分词优先级由低到高，如 `zhparser.extra_dicts = 'dict_extra.txt,mydict.xdb'`。注意：`zhparser.extra_dicts` 与 `zhparser.dict_in_memory` 需要在 backend 启动前设置（可在配置文件修改后 reload，对新建连接生效），其他选项可随时在会话中设置生效。zhparser 的选项与 SCWS 相关选项一一对应，含义参见 SCWS 文档。

使用示例（官方 README"EXAMPLE"节）：

```sql
-- create the extension
CREATE EXTENSION zhparser;

-- make test configuration using parser
CREATE TEXT SEARCH CONFIGURATION testzhcfg (PARSER = zhparser);

-- add token mapping
ALTER TEXT SEARCH CONFIGURATION testzhcfg ADD MAPPING FOR n,v,a,i,e,l WITH simple;

-- ts_parse
SELECT * FROM ts_parse('zhparser', 'hello world! 2010年保障房建设在全国范围内获全面启动，从中央到地方纷纷加大 了保障房的建设和投入力度 。2011年，保障房进入了更大规模的建设阶段。住房城乡建设部党组书记、部长姜伟新去年底在全国住房城乡建设工作会议上表示，要继续推进保障性安居工程建设。');

-- test to_tsvector
SELECT to_tsvector('testzhcfg','“今年保障房新开工数量虽然有所下调，但实际的年度在建规模以及竣工规模会超以往年份，相对应的对资金的需求也会创历史纪录。”陈国强说。在他看来，与2011年相比，2012年的保障房建设在资金配套上的压力将更为严峻。');

-- test to_tsquery
SELECT to_tsquery('testzhcfg', '保障房资金压力');
```

自定义 TXT 词库写法详解（TXT 词库兼容 `cli/scws_gen_dict` 所用文本词库）：

1. 每行一条记录，以 `#` 或分号开头相当于注释，忽略跳过。
2. 每行 4 个字段，依次为"词语"（由中文字或 3 个以下的字母合成）、"TF"、"IDF"、"词性"，字段用空格或制表符分隔，数量不限，可自行对齐美化。
3. 除"词语"外其他字段可省略，此时 TF 和 IDF 默认 1.0，词性为 `@`。
4. TXT 库是动态加载的（内部监测文件修改时间自动转换成 xdb 存于系统临时目录），建议 TXT 词库不要过大。
5. 删除词做法：把词性设为 `!`，表示该词无效——即使其他核心库中存在该词也视为无效。

注意：自定义词典格式可以是文本 TXT，也可以是二进制 XDB；XDB 效率更高，适合大辞典，可用 scws 自带的 `scws-gen-dict` 把文本词典转成 XDB。zhparser 默认词典是简体中文，需要繁体可在 SCWS 官网下载现成的 XDB 词典。自定义词典示例见仓库的 `dict_extra.txt`。

自定义词库 2.1（增强易用性并兼容 1.0 功能）：自定义词库需要 superuser 权限；自定义库是数据库级别的（不是实例级），每个数据库拥有自己的自定义分词，存储在 data 目录下 `base/数据库ID` 下。生产环境升级（新环境直接安装即可）用 `ALTER EXTENSION zhparser UPDATE;`。用法：

```sql
test=# SELECT * FROM ts_parse('zhparser', '保障房资金压力');
 tokid | token
-------+-------
   118 | 保障
   110 | 房
   110 | 资金
   110 | 压力

test=# INSERT INTO zhparser.zhprs_custom_word VALUES('资金压力');
-- 删除词：INSERT INTO zhprs_custom_word(word, attr) VALUES('word', '!');
-- \d zhprs_custom_word 查看其表结构，支持 TF、IDF
test=# SELECT sync_zhprs_custom_word();
 sync_zhprs_custom_word
------------------------

(1 row)

test=# \q  -- sync 后重新建立连接
-- 重新连接后：
test=# SELECT * FROM ts_parse('zhparser', '保障房资金压力');
 tokid |  token
-------+----------
   118 | 保障
   110 | 房
   120 | 资金压力
```

## 中文分词：pg_jieba

以下内容翻译自 [pg_jieba](https://github.com/jaiminpan/pg_jieba) 仓库 README（BSD 许可）。

pg_jieba 是一个 PostgreSQL 中文全文检索扩展（基于 CppJieba，要求 C++11，即 gcc4.8+；编译器不支持 C++11 的系统请使用 v1.0.1 分支的旧版 pg_jieba）。已在 CentOS 7 的 PostgreSQL 9.6.3 与 macOS Mojave 的 PostgreSQL 11.1 上测试。

准备：确保已安装 PostgreSQL 且 `pg_config` 命令可用（可从 postgresql.org 下载页安装，CentOS 用 `sudo yum install postgresql postgresql-server postgresql-devel`，或从 EnterpriseDB 下载安装包）。

安装：

1. 下载：`git clone https://github.com/jaiminpan/pg_jieba`
2. 初始化子模块：`cd pg_jieba && git submodule update --init --recursive`
3. 编译：`mkdir build && cd build && cmake .. && make && make install`（`make install` 报错时试试 `sudo make install`）。

编译失败问答：PostgreSQL 为自定义安装时，用 `cmake -DCMAKE_PREFIX_PATH=/PATH/TO/PGSQL_INSTALL_DIR ..`；Ubuntu 指定版本（缺少 PostgreSQL_TYPE_INCLUDE_DIR）用 `cmake -DPostgreSQL_TYPE_INCLUDE_DIR=/usr/include/postgresql/10/server ..`；部分系统需要 `cmake -DCMAKE_CXX_FLAGS="-Wall -std=c++11" ..`。

用法与示例：

```sql
jieba=# create extension pg_jieba;
CREATE EXTENSION

jieba=# select * from to_tsquery('jiebacfg', '是拖拉机学院手扶拖拉机专业的。不用多久，我就会升职加薪，当上CEO，走上人生巅峰。');
                                          to_tsquery
-----------------------------------------------------------------------------------------------
 '拖拉机' & '学院' & '手扶拖拉机' & '专业' & '不用' & '多久' & '会' & '升职' & '加薪' & '当上' & 'ceo' & '走上' & '人生' & '巅峰'
(1 row)

jieba=# select * from to_tsvector('jiebacfg', '是拖拉机学院手扶拖拉机专业的。不用多久，我就会升职加薪，当上CEO，走上人生巅峰。');
                                            to_tsvector
-----------------------------------------------------------------------------------------------------
 'ceo':18 '不用':8 '专业':5 '人生':21 '会':13 '加薪':15 '升职':14 '多久':9 '学院':3 '巅峰':22 '当上':17 '手扶拖拉机':4 '拖拉机':2 '走上':20
(1 row)
```

token 类型与词性标注可用 `ts_token_type('jieba')` 列出（`eng` 字母、`nz` 其他专有名词、`n` 名词等 56 种），并用 `ts_debug('jiebacfg', ...)` 逐词查看（上句"是拖拉机学院……"中：`是` 为动词 v、`拖拉机` 为名词 n、`手扶拖拉机` 为名词 n、`CEO` 为字母 eng、`加薪` 被标为人名 nr 等——`ts_debug` 的完整输出见原 README）。

可选配置（配置名即文本搜索配置名）：

- `jiebamp`：使用 mp 模式
- `jiebahmm`：使用 hmm 模式
- `jiebacfg`：混合 MP&HMM。多数场景使用（推荐）
- `jiebaqry`：先用 Mix 再用 full，类似网络搜索引擎

四种配置在三个例句上的分词对比（节选自原 README 表格）：

```text
jiebamp  | 我来到北京清华大学                                   | '来到' & '北京' & '清华大学'
jiebamp  | 他来到了网易杭研大厦                                 | '来到' & '网易' & '杭' & '研' & '大厦'
jiebamp  | 小明硕士毕业于中国科学院计算所，后在日本京都大学深造 | '明' & '硕士' & '毕业' & '中国科学院' & '计算所' & '日本京都大学' & '深造'

jiebahmm | 我来到北京清华大学                                   | '我来' & '北京' & '清华大学'
jiebahmm | 他来到了网易杭研大厦                                 | '他来' & '网易' & '杭' & '研大厦'
jiebahmm | 小明硕士毕业于中国科学院计算所，后在日本京都大学深造 | '小明' & '硕士' & '毕业于' & '中国' & '科学院' & '计算' & '日' & '本京' & '大学' & '深造'

jiebacfg | 我来到北京清华大学                                   | '来到' & '北京' & '清华大学'
jiebacfg | 他来到了网易杭研大厦                                 | '来到' & '网易' & '杭研' & '大厦'
jiebacfg | 小明硕士毕业于中国科学院计算所，后在日本京都大学深造 | '小明' & '硕士' & '毕业' & '中国科学院' & '计算所' & '日本京都大学' & '深造'

jiebaqry | 我来到北京清华大学                                   | '来到' & '北京' & '清华' & '华大' & '大学' & '清华大学'
jiebaqry | 他来到了网易杭研大厦                                 | '来到' & '网易' & '杭研' & '大厦'
jiebaqry | 小明硕士毕业于中国科学院计算所，后在日本京都大学深造 | '小明' & '硕士' & '毕业' & '中国' & '科学' & '学院' & '科学院' & '中国科学院' & '计算' & '计算所' & '日本' & '京都' & '大学' & '日本京都大学' & '深造'
```

用户自定义词典：

- 词典格式：`词 权重 词性`、`词 词性` 或仅 `词`。例如：

```text
云计算
韩玉鉴赏
蓝翔 nz
区块链 10 nz
```

格式可参考仓库的 `jieba_user.dict`。

- 使用自己的词典：把词典文件复制到 PostgreSQL 安装目录的 `share/postgresql/tsearch_data`（或 `share/tsearch_data`）下，命名为 `jieba_user.dict`。

参数（`pg_jieba` 经 `shared_preload_libraries` 加载时，可写入 postgresql.conf）：`pg_jieba.hmm_model`（HMM 模型文件，需重启）、`pg_jieba.base_dict`（基础词典，需重启）、`pg_jieba.user_dict`（用户词典名列表，不含 `.dict` 后缀，须位于 `tsearch_data` 目录，需重启）。相关 PostgreSQL 参数：`shared_preload_libraries = 'pg_jieba.so'`（需重启）；`default_text_search_config` 默认为 `pg_catalog.simple`，取消注释 `default_text_search_config='jiebacfg'` 可把 `jiebacfg` 设为默认。

依赖：cppjieba v5.1。社区另有 Docker 镜像（@ssfdust 提供）：

```bash
docker run --name testjieba -e POSTGRES_PASSWORD=passwd -e POSTGRES_USER=test -e POSTGRES_DB=testdb -d ssfdust/psql_jieba_swsc
docker exec -ti testjieba psql -U test testdb
```

## 限制

PostgreSQL 文本搜索功能当前的限制：

- 每个 lexeme 的长度必须小于 2 KB
- 一个 `tsvector` 的长度（lexeme + 位置）必须小于 1 MB
- lexeme 数必须小于 264
- `tsvector` 中的位置值必须大于 0 且不超过 16,383
- `<N>`（FOLLOWED BY）`tsquery` 算子的匹配距离不能超过 16,384
- 每个 lexeme 最多 256 个位置
- 一个 `tsquery` 的节点数（lexeme + 算子）必须小于 32,768

作为对比：PostgreSQL 8.1 文档包含 10,441 个唯一词、总计 335,420 个词，最高频词 "postgresql" 在 655 篇文档中出现 6,127 次。另一个例子——PostgreSQL 邮件列表归档在 461,020 封消息中包含 910,989 个唯一词、57,491,343 个 lexeme。

---

> **来源**：本文翻译自 PostgreSQL 18 官方文档第 12 章 Full Text Search（[12.1 Introduction](https://www.postgresql.org/docs/current/textsearch-intro.html)、[12.2 Tables and Indexes](https://www.postgresql.org/docs/current/textsearch-tables.html)、[12.3 Controlling Text Search](https://www.postgresql.org/docs/current/textsearch-controls.html)、[12.4 Additional Features](https://www.postgresql.org/docs/current/textsearch-features.html)、[12.7 Configuration Example](https://www.postgresql.org/docs/current/textsearch-configuration.html)、[12.8 Testing and Debugging](https://www.postgresql.org/docs/current/textsearch-debugging.html)、[12.9 Preferred Index Types](https://www.postgresql.org/docs/current/textsearch-indexes.html)、[12.11 Limitations](https://www.postgresql.org/docs/current/textsearch-limitations.html)），作者 PostgreSQL Global Development Group，许可 PostgreSQL Licence。抓取于 2026-09-13。
> "中文分词：zhparser"一节翻译自 [amutu/zhparser README](https://github.com/amutu/zhparser)（PostgreSQL 许可风格的自由许可）；"中文分词：pg_jieba"一节翻译自 [jaiminpan/pg_jieba README](https://github.com/jaiminpan/pg_jieba)（BSD-3-Clause）。两节均为原文完整翻译，仅对 Docker/安装等环境命令保留了原文行文。
> 收录范围说明：本章 12.5（解析器内部）、12.6（词典内部）、12.10（psql 支持）三节讲内置对象的实现细节与 psql 命令，篇幅所限未收录，请直接阅读官方文档对应小节；"解析器测试""词典测试"小节按原文收录，个别纯演示性输出从略并已注明。
