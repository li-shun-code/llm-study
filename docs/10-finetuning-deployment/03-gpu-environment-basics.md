---
title: GPU 环境基础：CUDA、显存估算与 AutoDL 上手
source_url: https://www.autodl.com/docs/quick_start/
author: AutoDL 帮助文档
license: 署名转载（原文页面未附开源许可，仅作教学署名转载）
fetched_at: 2026-09-13
translated: false
order: 3
---

微调大模型的第一道门槛不是算法，而是算力环境：选什么卡、装什么 CUDA、数据放哪、任务怎么跑起来。本文以国内常用的 GPU 租用平台 AutoDL 为例走通全流程，并补充一张显存估算速查表。

## 一、快速开始（AutoDL）

> AutoDL 实例中的数据（包括环境）在关机后将全部保存，开机后无需再次配置和上传数据。总而言之，实例在数据在，但连续关机 15 天实例将被释放。详见[实例数据保留说明](https://www.autodl.com/docs/instance_data/)。

### 创建实例

注册后进入控制台，在我的实例菜单下，点击「租用新实例」。

在租用实例页面：选择**计费方式**、**地区**、**GPU 型号**、**GPU 数量**，然后选择合适的**空闲主机**和**镜像**（内置了不同的深度学习框架的基础镜像和社区镜像），最后创建即可。

> 如果你需要更大的硬盘用于存放数据，那么请留意「硬盘」这列「可扩容」大小。数据盘的路径请参考[环境文档](https://www.autodl.com/docs/env/)。

创建完成后等待自动开机，今后主要用到的操作入口都在实例列表中。

> 请注意实例状态显示「运行中」开始计费，如不使用请及时关机停止计费。计费规则详见[计费说明](https://www.autodl.com/docs/price/)。

### 上传数据

开机后在正在运行中的实例上找到快捷工具：「JupyterLab」，点击打开，找到上传按钮，即可上传数据。如需上传文件夹或更高级的上传方式（scp、FileZilla、公网网盘等），请查阅[上传数据文档](https://www.autodl.com/docs/scp/)。

### 终端训练

在打开的 JupyterLab 页面中打开终端，在终端中执行您的 Python 命令等完成训练。如需使用其他 IDE 远程开发，请参考[VSCode（推荐）](https://www.autodl.com/docs/vscode/)和[PyCharm](https://www.autodl.com/docs/pycharm/)。

## 二、GPU 选型

AutoDL 平台分配 GPU、CPU、内存的机制为：按租用的 GPU 数量成比例分配 CPU 和内存，算力市场显示的 CPU 和内存均为每 GPU 分配的 CPU 和内存，如果租用两块 GPU，那么 CPU 和内存就 x2。此外 GPU 非共享，每个实例对 GPU 是独占的。

### 选择 CPU

CPU 非常重要！尽管 CPU 并不直接参与深度学习模型计算，但 CPU 需要提供大于模型训练吞吐的数据处理能力。我们通常为每块 GPU 分配固定数量的 CPU 逻辑核心。理想情况下，模型计算吞吐随 GPU 数量线性增长。每块 GPU 应配备至少 4~8 核心的 CPU，以满足多线程的异步数据读取。分配更多的核心通常不会再有很大的收益，此时的数据读取瓶颈通常源于 Python 的多进程切换与数据通信开销（如使用 PyTorch DataLoader）。

> 服务器的 CPU 一般不如桌面 CPU 的主频高，但是核心数量多。因此从桌面 CPU 切换到服务器 CPU 上后，需要充分利用多核心的性能，否则无法发挥服务器 CPU 的性能。

### 选择 GPU

AutoDL 平台上提供的 GPU 型号很多，按照 GPU 架构大致分为五类：

1. **NVIDIA Pascal 架构**的 GPU，如 TitanXp，GTX 10 系列等。这类 GPU 缺乏低精度的硬件加速能力，但却具备中等的单精度算力。由于价格便宜，适合用来练习训练小模型或调试模型代码。
2. **NVIDIA Volta/Turing 架构**的 GPU，如 GTX 20 系列、Tesla V100 等。这类 GPU 搭载专为低精度（int8/float16）计算加速的 TensorCore，但单精度算力相较于上代提升不大。建议在实例上启用深度学习框架的**混合精度训练**来加速模型计算。相较于单精度训练，混合精度训练通常能够提供 2 倍以上的训练加速。
3. **NVIDIA Ampere 及之后架构**的 GPU，如 GTX 30 系列、Tesla A40/A100，以及 40 系列、Hopper（H 系列）等。这类 GPU 搭载第三代及更新 TensorCore，支持 TensorFloat-32 格式，可直接加速单精度训练（PyTorch 已默认开启）。但仍建议使用 float16/bfloat16 半精度训练模型，可获得更显著的性能提升。
4. **寒武纪 MLU 200 系列加速卡**：推理需量化为 int8 进行计算，并需要安装适配寒武纪 MLU 的深度学习框架。
5. **华为 Ascend 系列加速卡**：支持模型训练及推理，但需安装 MindSpore 框架进行计算。

GPU 型号的选择并不困难。对于常用的深度学习模型，根据 GPU 对应精度的算力可大致推算 GPU 训练模型的性能。GPU 的数量选择与训练任务有关，一般我们认为模型的一次训练应当在 24 小时内完成，这样隔天就能训练改进之后的模型：

- **1 块 GPU**：适合数据集较小的训练任务，也适合 LoRA 微调 7B 级模型。
- **2 块 GPU**：可以一次跑两组参数或者把 Batch Size 扩大。
- **4 块 GPU**：适合中等数据集的训练任务。
- **8 块 GPU**：经典配置！适合各种训练任务，也非常方便复现论文结果。
- **更多**：用于训练大参数模型、大规模调参或超快地完成模型训练。

> 注意：3060、3090、3080Ti、4090、4090D、A4000、A5000、A40、A100、A800、L20、H20、H800 等安培架构及之后的卡需要 **CUDA 11.1 及以上**才能使用（TitanXp、1080Ti、2080Ti、P40、V100 没有要求），请使用较高版本的框架。

### 选择内存

内存在充足的情况下一般不影响性能，但是租用实例对内存的使用有更严格的上限限制（本地电脑内存不足会使用硬盘虚拟内存，影响是速度下降；而实例超限进程会被系统直接 Kill 导致程序中断）。如果对内存的容量要求大，请选择分配内存更多的主机或者租用多 GPU 实例。如果不确定内存的使用，可以在实例监控中观察内存使用情况。

## 三、CUDA/cuDNN

> 注意：如果没有二次编译代码的需求，正常情况下**不需要单独安装 CUDA/cuDNN**，因为框架都内置了编译好的 CUDA，框架版本和 CUDA 版本是对应的，只需要关注框架版本即可，无需独立关注 CUDA 版本。

### 查询默认 CUDA/cuDNN 版本

> 注意：通过 nvidia-smi 命令查看到的 CUDA 版本只是**驱动支持的最高 CUDA 版本**，不代表实例中安装的是该版本 CUDA。

终端中执行查看默认镜像自带的 CUDA 版本（安装目录为 /usr/local/）：

```bash
# 查询平台内置镜像中的 cuda 版本
ldconfig -p | grep cuda
#   libnvrtc.so.11.0 => /usr/local/cuda-11.0/targets/x86_64-linux/lib/libnvrtc.so.11.0

# 查询平台内置镜像中的 cudnn 版本
ldconfig -p | grep cudnn
```

上边输出日志 `.so` 后的数字即为版本号。如果你通过 conda 安装了 cuda，可以通过以下命令查看：

```bash
conda list | grep cudatoolkit
conda list | grep cudnn
```

### 安装其他版本的 CUDA/cuDNN

**方法一：使用 conda 进行安装**。优点：简单；缺点：一般不会带头文件，如果需要做编译，则需用方法二。

```bash
conda install cudatoolkit=11.x -c conda-forge
```

**方法二：从 NVIDIA 官网下载安装包安装**。优点：版本全面、带编译头文件；缺点：操作步骤多。从 [NVIDIA CUDA Toolkit Archive](https://developer.nvidia.com/cuda-toolkit-archive) 下载对应版本的 runfile 安装即可（详见[原文档](https://www.autodl.com/docs/cuda/)）。

::: tip 编者注：显存估算速查
微调显存估算没有精确公式，但有可靠的工程近似。以参数量为 P（十亿，B）、优化器为 AdamW、混合精度（bf16 权重 + fp32 主权重副本）为例：

- **模型加载（仅推理）**：约 2P GB（FP16/BF16，每参数 2 字节）；4-bit 量化后约 0.5P GB。
- **全参微调（AdamW）**：权重 2P + 梯度 2P + fp32 参数副本 4P + Adam 一/二阶动量 8P ≈ **16P–20P GB**。7B 模型全参微调实际需要 112–140 GB 显存，单张消费级卡放不下，必须多卡（ZeRO 切分）。
- **LoRA 微调**：冻结权重 2P + 极少量 LoRA 参数/梯度/动量 + 激活值。7B 模型在合理序列长度（2–4K）下 16–24 GB 基本够用；配合 4-bit 底座（QLoRA）可压到 8–12 GB。
- **激活值与序列长度强相关**：长上下文（如 32K）训练时，即使 LoRA 也可能 OOM，优先调小 batch size、开启 gradient checkpointing。

以上为经验值，实际还受框架版本、注意力实现（FlashAttention 可显著降激活显存）影响；建议以试跑 10 步后的 `nvidia-smi` 实测为准。
:::

::: tip 编者注：不想花钱？先试 Google Colab
Google [Colab](https://colab.research.google.com/) 提供免费 T4 GPU（16 GB）与付费 A100/V100，浏览器内即用即走，配 Jupyter Notebook，适合本模块的 TRL/LoRA 入门实验（7B 以下模型 + QLoRA 完全跑得动）。免费额度有每日/连续使用时长限制，任务会随会话断开而丢失环境，长期训练仍建议租用 AutoDL 这类按小时计费的实例。
:::

## 小结

- 按任务选卡：小模型/调试用入门卡，微调优先 Ampere 及之后架构 + 混合精度。
- 框架自带 CUDA 运行时，通常无需单独装 CUDA；`nvidia-smi` 显示的是驱动上限。
- 全参微调显存 ≈ 16–20P GB，LoRA ≈ 2P GB 底座 + 少量开销；QLoRA 是单卡微调 7B+ 的现实路径。

---

> **来源**：本文转载自 [AutoDL 帮助文档](https://www.autodl.com/docs/quick_start/)（《快速开始》《GPU 选型》《CUDA/cuDNN》三篇，作者 AutoDL 帮助文档，许可署名转载（原文页面未附开源许可，仅作教学署名转载）。抓取于 2026-09-13。文中"显存估算"与"Colab"两节为编者补充，已显式标注。
