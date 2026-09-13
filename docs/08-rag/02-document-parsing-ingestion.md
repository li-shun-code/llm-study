---
title: 文档解析与摄取：把 PDF、扫描件和表格变成干净的 Markdown
source_url: https://raw.githubusercontent.com/docling-project/docling/main/README.md
author: Docling 项目（IBM Research）／MinerU 项目（OpenDataLab）／Unstructured 项目
license: MIT（Docling）／MinerU 开源许可（基于 Apache 2.0 + 附加条款）／Apache 2.0（Unstructured）
fetched_at: 2026-09-13
translated: true
order: 2
---

在 RAG 系统里，文档解析（Document Parsing）是"第一公里"，也是最脏的一公里。Garbage in, garbage out：解析阶段丢掉的表格结构、读错的阅读顺序、识别不出的扫描文字，会在检索和生成阶段被成倍放大。本篇介绍三个当前最主流的开源解析工具，覆盖文本型 PDF、扫描件（OCR）、表格与公式三类硬骨头。

## 一、Docling：IBM 开源的统一文档解析库

> 以下内容翻译自 Docling 官方 README（MIT 许可）。

Docling 通过解析多种格式的文档来简化文档处理——包括对 PDF 的高级理解——并与生成式 AI 生态无缝集成。

### 特性

- 解析多种文档格式：PDF、DOCX、PPTX、XLSX、HTML、EPUB、Apple Pages、WAV、MP3、WebVTT、Box Notes、电子邮件格式（EML、MSG）、图片（PNG、TIFF、JPEG 等）、LaTeX、DocLang、纯文本等；
- 高级 PDF 理解：页面布局、阅读顺序（Reading Order）、表格结构、代码、公式、图片分类等；
- 统一而富有表现力的 DoclingDocument 表示格式；
- 多种导出格式与选项：Markdown、HTML、WebVTT、DocLang、DocTags 与无损 JSON；
- 支持多种应用专属 XML 模式：DocLang、USPTO 专利、JATS 文章、XBRL 财报；
- 支持本地执行，适合敏感数据与物理隔离（air-gapped）环境；
- 即插即用的集成：LangChain、LlamaIndex、CrewAI、Haystack 等智能体 AI 框架；
- 对扫描 PDF 与图片提供广泛的 OCR 支持；
- 支持多种视觉语言模型（VLM），如 GraniteDocling；
- 通过自动语音识别（ASR）模型支持音频；
- 提供 MCP server，可接入任意 Agent；
- 可以 docling-serve（API server）形式作为服务运行；
- 简单好用的命令行界面（CLI）。

近期新增能力还包括：视频文件解析（MP4、AVI、MOV、MKV、WebM，含 ASR 字幕与关键帧）、ODF 文档/表格/演示文稿、XBRL 财报、电子邮件、EPUB 电子书、Apple Pages，以及图表理解（柱状图/饼图/折线图可转为表格或代码并附详细描述）。

### 快速上手

安装（Python 3.10+，支持 macOS、Linux、Windows 的 x86_64 与 arm64）：

```bash
pip install docling
```

用 CLI 转换一个文档（直接给 URL 或本地路径都行）：

```bash
docling https://arxiv.org/pdf/2206.01062
```

这会在当前目录生成一个 .md 文件，内含结构化的文档内容。也可以通过 CLI 使用 GraniteDocling 等 VLM 流水线：

```bash
docling --pipeline vlm --vlm-model granite_docling https://arxiv.org/pdf/2206.01062
```

Python 用法（官方推荐）：

```python
from docling.document_converter import DocumentConverter

source = "https://arxiv.org/pdf/2408.09869"  # 本地路径或 URL 均可
converter = DocumentConverter()
result = converter.convert(source)
print(result.document.export_to_markdown())  # 输出："## Docling Technical Report[...]"
```

更多进阶用法与配置见[官方文档](https://docling-project.github.io/docling/)。Docling 的原理详见其技术报告 [Docling Technical Report](https://arxiv.org/abs/2408.09869)（arXiv:2408.09869）。Docling 代码库采用 MIT 许可；单个模型的使用请参照各模型自身的许可。

## 二、MinerU：面向 LLM / RAG / Agent 的高精度文档解析引擎

> 以下内容翻译自 MinerU 官方 README（MinerU 开源许可：基于 Apache 2.0 的自定义许可；2026 年 3 月起已从 AGPLv3 迁移）。

MinerU 是一个文档解析工具，把 `PDF`、图片、`DOCX`、`PPTX`、`XLSX` 输入转换为 Markdown、JSON 等机器可读格式，供下游检索、抽取与处理使用。MinerU 诞生于书生·浦语（InternLM）预训练过程，专注于解决科学文献中的符号转换问题。

### 核心解析能力

- 原生支持 `DOCX`、`PPTX`、`XLSX` 解析；
- 公式 → LaTeX、表格 → HTML，精确还原版面；
- 支持扫描件、手写内容、多栏（multi-column）排版、跨页表格合并；
- 按人类阅读顺序输出，自动去除页眉/页脚；
- VLM + OCR 双引擎，OCR 支持 109 种语言。

### 关键特性

- 支持 `PDF`、图片、`DOCX`、`PPTX`、`XLSX` 输入；
- 去除页眉、页脚、脚注、页码等，保证语义连贯；
- 以人类可读的顺序输出文本，适配单栏、多栏与复杂版面；
- 保留原文档结构：标题、段落、列表等；
- 抽取图片、图片说明、表格、表题与脚注；
- 自动识别文档中的公式并转换为 LaTeX 格式；
- 自动识别文档中的表格并转换为 HTML 格式；
- 自动检测扫描版 PDF 与乱码 PDF 并启用 OCR；
- 多种输出格式：多模态/NLP Markdown、按阅读顺序排序的 JSON，以及丰富的中间格式；
- 多种可视化结果（版面可视化、span 可视化），便于高效确认输出质量；
- 内置 CLI、FastAPI、Gradio WebUI，支持本地编排与多服务部署；
- 支持纯 CPU 环境运行，也支持 GPU/MPS 加速；兼容 Windows、Linux、Mac。

### 解析后端怎么选

**表：MinerU 解析后端对比（OmniDocBench v1.6 精度数据来自官方 README，2026-06）**

| 后端 | 特点 | 适用场景 |
| --- | --- | --- |
| pipeline | 兼容性好，速度快且稳定、无幻觉，纯 CPU 可跑 | CPU 环境、批量稳定处理（官方精度 86.47） |
| vlm-engine（含 hybrid） | 精度最高（约 95.3+），需 GPU，支持 vLLM / LMDeploy / mlx 生态 | 复杂版面、图表理解、追求最高精度 |
| *-http-client | 面向 OpenAI 兼容服务器的客户端模式 | 已有推理服务、多机部署 |

3.x 版本的重要演进：原生 `DOCX` 解析（相比"先转 PDF 再解析"提速数十倍）、滑动窗口机制显著降低长文档解析的内存峰值（数万页文档无需手动切分）、多线程并发推理与 `mineru-router` 多 GPU 负载均衡（一键部署高并发解析服务）、异步任务接口 `POST /tasks` 等。

### 快速上手

官方建议先在[在线 Demo](https://mineru.net/) 评估解析质量，再按需选择部署方式。本地安装后，最简的命令行用法形如：

```bash
# 安装（详见官方文档的安装指引）
uv pip install -U "mineru[all]"

# 解析单个 PDF，输出 Markdown/JSON 到指定目录
mineru -p <input_path> -o <output_path>

# 指定 pipeline 后端
mineru -p <input_path> -o <output_path> -b pipeline
```

> 编者注：MinerU 3.x 将 CLI 重构为基于 `mineru-api` 的编排客户端（未指定 `--api-url` 时自动拉起本地临时服务），具体安装与模型下载参数以[官方文档](https://opendatalab.github.io/MinerU/)为准。若你的文档样本解析效果不佳，官方鼓励携带样例文件提 issue。

## 三、Unstructured：面向 LLM 的预处理工具链

> 以下内容翻译自 Unstructured 官方 README（Apache 2.0）。

`unstructured` 库为图像与文本文档（PDF、HTML、Word 等[更多格式](https://docs.unstructured.io/open-source/core-functionality/partitioning)）的摄取与预处理提供开源组件。它的用例围绕"为 LLM 简化与优化数据处理工作流"展开：模块化的函数与连接器组成一套完整系统，简化数据摄取与预处理，使其可适配不同平台、高效地把非结构化数据转成结构化输出。

围绕 `unstructured` 的核心概念是**分区（Partitioning）**：把原始文档拆成带类型标签的"元素（Element）"——如 `Title`、`NarrativeText`、`Table`、`Image`——再由下游决定如何清洗、分块（Chunking）与嵌入。最新的 Unstructured Transform 还以 MCP server 形式把生产级文档处理带给 Agent：支持 60+ 文件类型（PDF、邮件、图片、扫描件等），Agent 可以在会话中直接对文件做解析、富化、分块与嵌入。

本地运行最省事的方式是官方 Docker 镜像：

```bash
docker pull downloads.unstructured.io/unstructured-io/unstructured:latest

# 创建容器并进入 shell
docker run -dt --name unstructured downloads.unstructured.io/unstructured:latest
docker exec -it unstructured bash
```

> 编者注：Unstructured 官方文档当前将开源库定位为"分区能力"，而分块、嵌入、图像/表格富化等进阶能力主要在商业版 Pipelines 中提供。若你的场景以"PDF→干净 Markdown"为核心，Docling/MinerU 的开箱即用程度更高。

## 四、怎么选（编者注）

**表：三个文档解析工具对比**

| 维度 | Docling | MinerU | Unstructured |
| --- | --- | --- | --- |
| 许可 | MIT | 基于 Apache 2.0 的自定义许可（达到商业规模阈值需另获商业授权） | Apache 2.0 |
| 最大强项 | PDF 深度理解 + 统一 DoclingDocument + 生态集成最全 | 扫描件/手写/多栏/跨页表格的中文场景精度，OCR 109 语 | 通用"元素流"预处理框架，格式覆盖广（60+） |
| 输出 | Markdown / JSON / HTML / DocTags | Markdown / JSON | 元素列表（Title/Table/Text…） |
| 部署 | 本地 / docling-serve / CLI | 本地 / API 服务 / 多 GPU 路由 | 本地库 / Docker / MCP server |
| 典型场景 | 生成式 AI 应用摄取层，公式与表格还原 | 学术文献、中文文档、超长文档批量解析 | 多格式混合管道、需要细粒度元素控制 |

实践建议：先用你的真实文档做小样本评测（同一份 PDF 分别转 Markdown，人工检查阅读顺序、表格与公式），再定工具；扫描件优先测 OCR 通道；表格密集型文档务必检查输出是 HTML 还是 Markdown 表格，这直接影响后续分块与检索质量。

---

> **来源**：本文整合翻译自三份官方 README——[Docling](https://raw.githubusercontent.com/docling-project/docling/main/README.md)（MIT）、[MinerU](https://raw.githubusercontent.com/opendatalab/MinerU/master/README.md)（MinerU 开源许可，基于 Apache 2.0 + 附加条款）、[Unstructured](https://raw.githubusercontent.com/Unstructured-IO/unstructured/main/README.md)（Apache 2.0），作者分别为 Docling 项目（IBM Research）、MinerU 项目（OpenDataLab）、Unstructured 项目。抓取于 2026-09-13。
> 本文按"为什么难 → 三个工具各自的定位与实战 → 怎么选"组织，各工具章节忠实翻译原文，衔接性文字（标注"编者注"）为本站补充。
