---
title: Embedding API 与文本相似度
source_url: https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Get_embeddings_from_dataset.ipynb
author: OpenAI Cookbook（Get embeddings from dataset、Semantic text search using embeddings）
license: MIT
fetched_at: 2026-09-13
translated: true
order: 9
versions: text-embedding-3-small（当前主力 Embedding 模型）；tiktoken o200k_base / cl100k_base
---

Embedding（嵌入）把任意文本映射成一个固定长度的浮点向量，**语义相近的文本在向量空间里距离更近**。这是语义搜索、聚类、推荐、分类与整个 RAG 体系（模块 8）的地基。本篇讲两件事：怎么批量拿到 Embedding，以及怎么用它做文本相似度检索。

## 一、调用 Embedding API

Embedding 端点比对话端点简单得多——没有消息角色，直接喂文本、返回向量（当前主力模型 `text-embedding-3-small`）：

```python
from openai import OpenAI

client = OpenAI()

def get_embedding(value, model="text-embedding-3-small"):
    embeddings = client.embeddings.create(
        model=model,
        input=value,
        encoding_format="float"
    )
    return embeddings.data[0].embedding
```

 Cookbook 的多工具编排示例中同样用这一调用确定向量维度：

```python
MODEL = "text-embedding-3-small"
sample_embedding_resp = client.embeddings.create(
    input=["一段示例文本"],
    model=MODEL
)
embed_dim = len(sample_embedding_resp.data[0].embedding)
print(f"Embedding dimension: {embed_dim}")
# 输出：Embedding dimension: 1536
```

`text-embedding-3-small` 输出 1536 维向量，单条输入上限 8191 个 token（下文原文常量 `max_tokens = 8000` 即留了余量）。

## 二、从数据集批量取 Embedding 并存盘

Cookbook 的标准示例数据集是 [Amazon 美食评论（fine-food reviews）](https://www.kaggle.com/snap/amazon-fine-food-reviews)（568,454 条评论，示例取最近 1,000 条）。第一步：把标题与正文拼成一列 `combined`：

```python
import pandas as pd
import tiktoken

embedding_model = "text-embedding-3-small"
embedding_encoding = "cl100k_base"
max_tokens = 8000  # text-embedding-3-small 的上限是 8191

# 加载并检查数据集
input_datapath = "data/fine_food_reviews_1k.csv"  # 官方提供的预筛选数据集
df = pd.read_csv(input_datapath, index_col=0)
df = df[["Time", "ProductId", "UserId", "Score", "Summary", "Text"]]
df = df.dropna()
df["combined"] = (
    "Title: " + df.Summary.str.strip() + "; Content: " + df.Text.str.strip()
)
```

第二步：先数 token、过滤超长评论，再批量请求 Embedding，**存盘复用**（Embedding 是按 token 计费的，别对同一批数据反复付费）：

```python
# 子采样最近 1000 条评论，并剔除过长样本
top_n = 1000
df = df.sort_values("Time").tail(top_n * 2)  # 先粗切 2k 条，假设不到一半会被过滤
df.drop("Time", axis=1, inplace=True)

encoding = tiktoken.get_encoding(embedding_encoding)

# 剔除长到无法嵌入的评论
df["n_tokens"] = df.combined.apply(lambda x: len(encoding.encode(x)))
df = df[df.n_tokens <= max_tokens].tail(top_n)
len(df)
# 输出：1000
```

```python
# 获取 Embedding 并保存，供日后复用（可能需要几分钟）
df["embedding"] = df.combined.apply(lambda x: get_embedding(x, model=embedding_model))
df.to_csv("data/fine_food_reviews_with_embeddings_1k.csv")
```

读回来时别忘了一个坑：CSV 里的向量是字符串，要用 `literal_eval` 还原成 NumPy 数组：

```python
import pandas as pd
import numpy as np
from ast import literal_eval

datafile_path = "data/fine_food_reviews_with_embeddings_1k.csv"

df = pd.read_csv(datafile_path)
df["embedding"] = df.embedding.apply(literal_eval).apply(np.array)
```

## 三、余弦相似度（Cosine Similarity）

衡量两个向量方向的接近程度，是文本相似度的标准度量。语义检索的做法（Cookbook 原文）：**把查询也嵌入成向量，然后与文档向量逐一算余弦相似度、按分数排序取 Top-N**。

```python
import numpy as np

def cosine_similarity(a, b):
    """计算两个向量的余弦相似度（本站按 numpy 标准实现补全）。"""
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
```

```python
# 在评论中做语义搜索
def search_reviews(df, product_description, n=3, pprint=True):
    product_embedding = get_embedding(
        product_description,
        model="text-embedding-3-small"
    )
    df["similarity"] = df.embedding.apply(lambda x: cosine_similarity(x, product_embedding))

    results = (
        df.sort_values("similarity", ascending=False)
        .head(n)
        .combined.str.replace("Title: ", "")
        .str.replace("; Content:", ": ")
    )
    if pprint:
        for r in results:
            print(r[:200])
            print()
    return results
```

Cookbook 的原始检索效果——查询 `"delicious beans"`（好吃的豆子）：

```text
Delicious!:  I enjoy this white beans seasoning, it gives a rich flavor to the beans I just love it, ...

Fantastic Instant Refried beans:  Fantastic Instant Refried Beans have been a staple for my family now for nearly 20 years. ...
```

查询 `"bad delivery"`（配送糟糕）——注意匹配到的是一条标题夸产品、抱怨配送的评论，这正是关键词搜索做不到的语义理解：

```text
great product, poor delivery:  The coffee is excellent and I am a repeat buyer. Problem this time was with the UPS delivery. ...
```

查询 `"spoilt"`（变质）与 `"pet food"`（宠物食品）同样精准命中语义相关评论。

## 四、规模放大：从 NumPy 到向量数据库

Cookbook 在语义检索篇末尾提到：要加速大规模检索，可以使用**针对 Embedding 快速搜索的特殊算法**——也就是向量数据库（ANN 近似最近邻索引）的领域。示例中的关键词去重（把新关键词与既有关键词表算相似度、超阈值即合并）也是同一套原语（`Tag_caption_images_with_GPT4V.ipynb` 演示）：

```python
def replace_keyword(keyword, threshold=0.6):
    most_similar = compare_keyword(keyword)  # 与既有关键词表逐一算余弦相似度
    if most_similar['similarity'] > threshold:
        print(f"Replacing '{keyword}' with existing keyword: '{most_similar['keyword']}'")
        return most_similar['keyword']
    return keyword
```

原始输出：

```text
Replacing 'bed frame' with existing keyword: 'bed'
Replacing 'wooden' with existing keyword: 'wood'
Replacing 'metallic' with existing keyword: 'metal'
```

> 编者注：示例中 1,000 条 × 1536 维用 pandas + NumPy 全量扫一遍毫无压力；到百万级向量就该引入 Milvus/Chroma/Qdrant/pgvector 等向量数据库（模块 7、8 展开），或用 `text-embedding-3-small` 支持的 `dimensions` 参数压缩维度换取速度。

## 五、Embedding 的更多玩法

同一批向量稍作变化就能支撑不同任务（Cookbook 的 embeddings 系列其他 notebook 标题即目录）：

- **语义搜索**（本篇）；代码搜索（`Code_search_using_embeddings`）；
- **聚类**（`Clustering`）：无标签把相似评论分组；
- **分类**（`Classification_using_embeddings`）：用向量作为特征训练传统分类器；
- **推荐**（`Recommendation_using_embeddings`）：找与已喜欢 item 最相近的；
- **零样本分类**（`Zero-shot_classification_with_embeddings`）：把类别描述嵌入后比距离。

## 六、本篇小结

- `client.embeddings.create(model, input)` 一步拿向量；`text-embedding-3-small` 为 1536 维、单条上限 8191 token；
- 先用 tiktoken 数 token、过滤超长文本；Embedding 算一次存盘复用，避免重复付费；
- 余弦相似度 + 排序 = 语义搜索；查询与文档必须用**同一个模型**嵌入；
- CSV 读回向量要 `literal_eval`；规模大了换向量数据库。

下一篇给 Embedding 找个"眼睛"的搭档：视觉理解 API。

---

> **来源**：本文翻译自 [Get embeddings from dataset](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Get_embeddings_from_dataset.ipynb) 与 [Semantic text search using embeddings](https://raw.githubusercontent.com/openai/openai-cookbook/main/examples/Semantic_text_search_using_embeddings.ipynb)（OpenAI Cookbook，MIT），作者 OpenAI，许可 MIT。抓取于 2026-09-13。
