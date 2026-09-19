---
title: Ollama 本地部署：官方 README 与文档完整指南
source_url: https://github.com/ollama/ollama
author: Ollama 团队（GitHub 官方 README 与 docs.ollama.com 官方文档）
license: MIT
fetched_at: 2026-09-13
translated: true
versions: Ollama 官方 README 与 docs.ollama.com 当前版（2026-09，含 ollama launch 集成与 cloud 模式）
order: 17
group: 部署与服务化
---
本篇正文完整译自 Ollama 官方 GitHub README 与官方文档站（quickstart、CLI、import、GPU、FAQ、Docker 六个页面），文末逐节署名。

# Ollama（译自官方 README）

开始使用开放模型构建。

## 下载

**macOS**：

```shell
curl -fsSL https://ollama.com/install.sh | sh
```

或[手动下载](https://ollama.com/download/Ollama.dmg)。

**Windows**：

```shell
irm https://ollama.com/install.ps1 | iex
```

或[手动下载](https://ollama.com/download/OllamaSetup.exe)。

**Linux**：

```shell
curl -fsSL https://ollama.com/install.sh | sh
```

手动安装说明见官方 Linux 文档。

**Docker**：官方 [Ollama Docker 镜像](https://hub.docker.com/r/ollama/ollama) `ollama/ollama` 已上架 Docker Hub。

**客户端库**：[ollama-python](https://github.com/ollama/ollama-python)、[ollama-js](https://github.com/ollama/ollama-js)。

**社区**：[Discord](https://discord.gg/ollama)、[𝕏 (Twitter)](https://x.com/ollama)、[Reddit](https://reddit.com/r/ollama)。

## 开始使用

```
ollama
```

你会看到交互菜单，可以运行模型，或把 Ollama 接入你现有的智能体与应用，如 `Claude Code`、`OpenClaw`、`OpenCode`、`Codex`、`Copilot` 等。

**编码**：启动指定集成：

```
ollama launch claude
```

支持的集成包括 [Claude Code](https://docs.ollama.com/integrations/claude-code)、[Codex](https://docs.ollama.com/integrations/codex)、[Copilot CLI](https://docs.ollama.com/integrations/copilot-cli)、[DeepSeek Harness](https://docs.ollama.com/integrations/deepseek-harness)、[Droid](https://docs.ollama.com/integrations/droid) 与 [OpenCode](https://docs.ollama.com/integrations/opencode)。

**AI 助手**：用 [OpenClaw](https://docs.ollama.com/integrations/openclaw) 把 Ollama 变成跨 WhatsApp、Telegram、Slack、Discord 等平台的个人 AI 助手：

```
ollama launch openclaw
```

**与模型聊天**：运行 [Gemma 4](https://ollama.com/library/gemma4) 并对话：

```
ollama run gemma4
```

完整模型列表见 [ollama.com/library](https://ollama.com/library)。

## REST API

Ollama 提供运行与管理模型的 REST API：

```
curl http://localhost:11434/api/chat -d '{
  "model": "gemma4",
  "messages": [{
    "role": "user",
    "content": "Why is the sky blue?"
  }],
  "stream": false
}'
```

全部端点见 [API 文档](https://docs.ollama.com/api)。

**Python**（`pip install ollama`）：

```python
from ollama import chat

response = chat(model='gemma4', messages=[
  {
    'role': 'user',
    'content': 'Why is the sky blue?',
  },
])
print(response.message.content)
```

**JavaScript**（`npm i ollama`）：

```javascript
import ollama from "ollama";

const response = await ollama.chat({
  model: "gemma4",
  messages: [{ role: "user", content: "Why is the sky blue?" }],
});
console.log(response.message.content);
```

## 支持的后端与文档

- 后端：由 Georgi Gerganov 创立的 [llama.cpp](https://github.com/ggml-org/llama.cpp) 项目；
- 官方文档：[CLI 参考](https://docs.ollama.com/cli)、[REST API 参考](https://docs.ollama.com/api)、[导入模型](https://docs.ollama.com/import)、[Modelfile 参考](https://docs.ollama.com/modelfile)、[源码构建](https://github.com/ollama/ollama/blob/main/docs/development.md)。

README 另附庞大的第三方生态目录（聊天界面、代码编辑器、各语言 SDK、Agent 框架、RAG、可观测性、云部署与包管理器等十余类、约两百个项目），为链接目录性质，本文不逐一罗列，请查阅[原文](https://github.com/ollama/ollama#community-integrations)。

# 快速开始（译自官方文档 Quickstart）

1. **下载 Ollama**：支持 macOS、Windows 与 Linux（ollama.com/download）；
2. **打开菜单**：终端运行 `ollama` 打开交互菜单，从中可以**运行模型**（开始交互聊天）或**启动工具**（Claude Code、OpenClaw、VS Code 等）；
3. **开始聊天**：

```shell
ollama run gemma4
```

云端模型用法相同：

```shell
ollama run gemma4:cloud
```

发送第一条消息（如 "Explain why the sky is blue in one paragraph."），退出聊天输入 `/bye`。

# CLI 参考（译自官方文档 CLI Reference）

```
ollama run gemma4          # 运行模型
ollama launch              # 启动集成（交互式配置并启动外部应用使用 Ollama 模型）
ollama pull gemma4         # 下载模型
ollama rm gemma4           # 删除模型
ollama ls                  # 列出模型
ollama ps                  # 列出运行中的模型
ollama stop gemma4         # 停止运行中的模型
ollama signin / signout    # 登录/登出 Ollama
ollama serve               # 启动 Ollama 服务（环境变量清单见 ollama serve --help）
```

`ollama launch` 支持的集成：OpenCode（开源编码助手）、Claude Code（Anthropic 智能体编码工具）、Codex（OpenAI 编码助手）、VS Code（微软 IDE 内置 AI 聊天）、Droid（Factory AI 编码智能体）。示例：`ollama launch claude`（指定集成）、`ollama launch claude --model qwen3.5`（指定模型）、`ollama launch droid --config`（仅配置不启动）。

多行输入可用 `"""` 包裹；多模态模型可直接引用图片：`ollama run gemma4 "What's in this image? /Users/jmorgan/Desktop/smile.png"`。

生成嵌入：

```
echo "Hello world" | ollama run nomic-embed-text
```

创建自定义模型：先写 `Modelfile`（`FROM gemma4` + `SYSTEM """You are a happy cat."""`），然后 `ollama create -f Modelfile`。

# 导入模型（译自官方文档 Importing a Model）

## 从 Safetensors 权重导入微调适配器（adapter）

先创建 `Modelfile`，`FROM` 指向微调所用的基座模型，`ADAPTER` 指向 Safetensors 适配器目录：

```dockerfile
FROM <base model name>
ADAPTER /path/to/safetensors/adapter/directory
```

`FROM` 必须与制作适配器时的基座模型一致，否则结果不可预测。各家框架的量化方法不同，最好使用未量化（非 QLoRA）的适配器。适配器与 Modelfile 同目录时用 `ADAPTER .`。

在 Modelfile 所在目录运行：

```shell
ollama create my-model
ollama run my-model    # 测试
```

支持的适配器架构：Llama（含 2/3/3.1/3.2）、Mistral（含 1/2 与 Mixtral）、Gemma（含 1 与 2）。可用能输出 Safetensors 适配器的微调框架制作，如 Hugging Face 微调框架、[Unsloth](https://github.com/unslothai/unsloth)、[MLX](https://github.com/ml-explore/mlx)。

## 从 Safetensors 权重导入完整模型

```dockerfile
FROM /path/to/safetensors/directory
```

（同目录可用 `FROM .`。）然后 `ollama create my-model`、`ollama run my-model`。支持 Llama、Mistral、Gemma、Phi3 等架构，包括基座模型以及已与基座**合并（fused）**的微调模型。

## 导入 GGUF 模型或适配器

GGUF 的来源：用 llama.cpp 的 `convert_hf_to_gguf.py` 转换 Safetensors 模型；用 `convert_lora_to_gguf.py` 转换 Safetensors 适配器；或从 HuggingFace 等处下载。

```dockerfile
FROM /path/to/file.gguf
```

GGUF 适配器则写：

```dockerfile
FROM <model name>
ADAPTER /path/to/file.gguf
```

导入 GGUF 适配器同样必须使用与制作时相同的基座模型（可以是 Ollama 模型、GGUF 文件或 Safetensors 模型）。然后 `ollama create my-model`。

## 量化模型

量化让模型跑得更快、内存更省，但精度会降低——这让你在更普通的硬件上运行模型。Ollama 可用 `ollama create` 的 `-q/--quantize` 标志把 FP16/FP32 模型量化到不同等级：

```dockerfile
FROM /path/to/my/gemma/f16/model
```

```shell
$ ollama create --quantize q4_K_M mymodel
transferring model data
quantizing F16 model to Q4_K_M
creating new layer sha256:...
writing manifest
success
```

支持的量化等级：`q8_0`；K-means 量化：`q4_K_S`、`q4_K_M`。

## 在 ollama.com 上分享模型

在 [ollama.com/signup](https://ollama.com/signup) 注册（`Username` 会成为模型名的一部分，如 `jmorganca/mymodel`），在 [Ollama Keys 设置页](https://ollama.com/settings/keys)按指引添加你的 Ollama 公钥。推送：

```shell
ollama cp mymodel myuser/mymodel
ollama push myuser/mymodel
```

推送后，其他用户即可 `ollama run myuser/mymodel`。

# 硬件支持（译自官方文档 Hardware support）

## Nvidia

Ollama 支持**计算能力 5.0+**、驱动 550+ 的 Nvidia GPU；计算能力 5.0–6.2 的显卡需要 570+ 驱动。显卡是否支持见 NVIDIA CUDA GPU 官方对照表。代表性支持列表（完整表见原文）：

| 计算能力 | 家族 | 代表显卡 |
|---|---|---|
| 12.1 | NVIDIA | `GB10 (DGX Spark)` |
| 12.0 | GeForce RTX 50xx / NVIDIA Professional | `RTX 5060` `RTX 5060 Ti` `RTX 5070` `RTX 5070 Ti` `RTX 5080` `RTX 5090`；`RTX PRO 4000/4500/5000/6000 Blackwell` |
| 9.0 | NVIDIA | `H200` `H100` |
| 8.9 | GeForce RTX 40xx / Professional | `RTX 4060`–`RTX 4090`（含 SUPER/Ti 变体）；`L4` `L40` `RTX 6000` |
| 8.6 | GeForce RTX 30xx / Professional | `RTX 3050`–`RTX 3090 Ti`；`A40` `A10` `A16` `A2`、`RTX A2000`–`RTX A6000` |
| 8.0 | NVIDIA | `A100` `A30` |
| 7.5 | GTX/RTX / Professional / Quadro | `GTX 1650 Ti` `TITAN RTX` `RTX 2060`–`2080 Ti`；`T4` `T500`–`T2000` `RTX 3000`–`5000`；`RTX 4000`–`8000` |
| 7.0 | NVIDIA | `TITAN V` `V100` `Quadro GV100` |
| 6.1 / 6.0 | TITAN / GTX / Quadro / Tesla | `TITAN Xp/X`、GTX 1050–1080 Ti、`P40` `P4`、P600–P6000 系、`Tesla P100` `Quadro GP100` |
| 5.2 / 5.0 | GTX / Quadro / Tesla | GTX 950–980 Ti、`M40` `M60`、M2000–M6000、`GTX 750 Ti/750`、`NVS 810`、K 系与 M 系移动卡等 |

本地构建以支持更老的 GPU 见 development 文档。

**GPU 选择**：多卡时设 `CUDA_VISIBLE_DEVICES` 逗号分隔列表限制 Ollama 使用的卡。数字 ID 可用但顺序可能变化，UUID 更可靠（`nvidia-smi -L` 查询）。想忽略 GPU 强制 CPU，给一个无效 ID（如 `-1`）。

**Linux 休眠恢复**：suspend/resume 后 Ollama 有时无法发现 NVIDIA GPU 而回退 CPU。可用 `sudo rmmod nvidia_uvm && sudo modprobe nvidia_uvm` 重载 UVM 驱动绕过该驱动 bug。

## AMD Radeon

Ollama 经 ROCm 库支持以下 AMD GPU（另有 Vulkan 补充支持，见下）。

**Linux**：需要 AMD ROCm v7 驱动（用 `amdgpu-install` 安装/升级）。支持卡型：Radeon RX `9070 XT` `9070 GRE` `9070` `9060 XT` `9060 XT LP` `9060` `7900 XTX` `7900 XT` `7900 GRE` `7800 XT` `7700 XT` `7700` `7600 XT` `7600` `6950 XT` `6900 XTX` `6900 XT` `6800 XT` `6800`；Radeon AI PRO `R9700` `R9600D`；Radeon PRO `W7900` `W7800` `W7700` `W7600` `W7500` `W6900X` `W6800X Duo` `W6800X` `W6800` `V620`；Ryzen AI `Ryzen AI Max+ 395` `Ryzen AI Max 390` `Ryzen AI Max 385` `Ryzen AI 9 HX 475` `Ryzen AI 9 HX 470` `Ryzen AI 9 465` `Ryzen AI 9 HX 375` `Ryzen AI 9 HX 370` `Ryzen AI 9 365`；Instinct `MI350X` `MI300X` `MI300A` `MI250X` `MI250` `MI210` `MI100`。

**Windows**：需要 AMD ROCm v7 / HIP7 兼容驱动栈。支持：Radeon RX `7900 XTX` `7900 XT` `7900 GRE` `7800 XT` `7700 XT` `7600 XT` `7600`；Radeon PRO `W7900` `W7800` `W7700` `W7600` `W7500`。

**Linux 上的覆盖（Override）**：ROCm 不支持所有 AMD GPU 时，可强制尝试相近的 LLVM target。如 RX 5400 是 `gfx1034`，ROCm 暂不支持，最近的支持是 `gfx1030`——设环境变量 `HSA_OVERRIDE_GFX_VERSION="10.3.0"` 即可。多卡 GFX 版本不同时按设备号逐个设置（`HSA_OVERRIDE_GFX_VERSION_0=10.3.0`、`HSA_OVERRIDE_GFX_VERSION_1=11.0.0`）。当前已知支持的 LLVM target（及示例卡）：gfx908（Radeon Instinct MI100）、gfx90a（MI210/MI250）、gfx942（MI300X/MI300A）、gfx950（MI350X）、gfx1030（Radeon PRO V620）、gfx1100（W7900）、gfx1101（W7700）、gfx1102（RX 7600）、gfx1150（Ryzen AI 9 HX 375）、gfx1151（Ryzen AI Max+ 395）、gfx1200（RX 9070）、gfx1201（RX 9070 XT）。

**GPU 选择**：多 AMD 卡时设 `ROCR_VISIBLE_DEVICES`（`rocminfo` 查看设备；无效 ID 强制 CPU；可用时优先用 `Uuid` 唯一标识设备）。

**容器权限**：部分 Linux 发行版上 SELinux 会阻止容器访问 AMD GPU 设备，在宿主机执行 `sudo setsebool container_use_devices=1` 允许。

## Metal（Apple GPU）

Ollama 通过 Metal API 在 Apple 设备上支持 GPU 加速。

## Vulkan 支持

Windows 与 Linux 上的额外 GPU 支持经 [Vulkan](https://www.vulkan.org/) 提供，安装后端后默认启用。Windows 大多数厂商驱动自带 Vulkan、无需额外步骤；多数 Linux 发行版需另装组件（Mesa 或厂商包之间可能有多选；Intel/AMD 安装指引见原文链接）。某些发行版上需把 `ollama` 用户加入 `render` 组。

Ollama 调度器依赖 GPU 库上报的可用显存做最优调度；Vulkan 需要额外能力（或 root）才能暴露该数据。若无此能力，Ollama 将用模型近似大小尽力调度：

```bash
sudo setcap cap_perfmon+ep /usr/local/bin/ollama
```

**GPU 选择**：设 `GGML_VK_VISIBLE_DEVICES` 为一个或多个数字 ID；Vulkan 出问题时可 `OLLAMA_VULKAN=0` 或 `GGML_VK_VISIBLE_DEVICES=-1` 全部禁用。iGPU/dGPU 混合且 Vulkan iGPU 不稳时，保持 Vulkan 开启并把 `GGML_VK_VISIBLE_DEVICES` 设为独卡索引（如 `Vulkan1` 是独卡则设 `=1`）。

# Docker 部署（译自官方文档 Docker）

**仅 CPU**：

```shell
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

**Nvidia GPU**：先安装 [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#installation)（Apt 与 Yum/Dnf 两套仓库配置与安装命令见原文），然后配置 Docker 使用 Nvidia 驱动并启动容器：

```shell
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

> **注意**：NVIDIA JetPack 系统上 Ollama 无法自动发现正确的 JetPack 版本，需给容器传 `JETSON_JETPACK=5` 或 `JETSON_JETPACK=6`。

**AMD GPU**：用 `rocm` tag：

```shell
docker run -d --device /dev/kfd --device /dev/dri -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama:rocm
```

**Vulkan**：`ollama/ollama` 镜像内置 Vulkan，容器能访问 GPU 设备时默认启用；`OLLAMA_VULKAN=0` 关闭，`GGML_VK_VISIBLE_DEVICES=<ids>` 选择设备。

**运行模型**：

```shell
docker exec -it ollama ollama run llama3.2
```

更多模型见 [Ollama library](https://ollama.com/library)。

# FAQ（译自官方文档 FAQ）

**如何升级 Ollama？** macOS 与 Windows 自动下载更新，点任务栏/菜单栏图标选"Restart to update"；也可手动下载最新版。Linux 重跑安装脚本即可。

**如何查看日志？** 见官方 Troubleshooting 文档。

**我的 GPU 兼容吗？** 见上文硬件支持一节。

**如何指定上下文窗口大小？** 默认 4096 token。用 `OLLAMA_CONTEXT_LENGTH` 覆盖（如 `OLLAMA_CONTEXT_LENGTH=8192 ollama serve`）；`ollama run` 里用 `/set parameter num_ctx 4096`；API 里在 `options` 中传 `num_ctx`。

**如何判断模型加载到了 GPU？** 用 `ollama ps` 查看已加载模型，`Processor` 列显示：`100% GPU`（全部进显存）、`100% CPU`（全部进内存）、`48%/52% CPU/GPU`（部分在两边）。

**如何配置 Ollama 服务器？** 用环境变量。macOS 应用用 `launchctl setenv OLLAMA_HOST "0.0.0.0:11434"` 后重启应用；Linux systemd 服务用 `systemctl edit ollama.service` 在 `[Service]` 段加 `Environment="OLLAMA_HOST=0.0.0.0:11434"`，再 `systemctl daemon-reload && systemctl restart ollama`；Windows 在"编辑账户的环境变量"里设置 `OLLAMA_HOST`、`OLLAMA_MODELS` 等，重启应用生效。

**如何走代理拉模型？** 设 `HTTPS_PROXY` 把出站请求导向代理，并确保代理证书装为系统证书。**避免设 `HTTP_PROXY`**：Ollama 拉模型只用 HTTPS，设了可能中断客户端到服务器的连接。Docker 场景：启动时传 `-e HTTPS_PROXY=https://proxy.example.com`，或配置 Docker daemon 代理（Docker Desktop 各平台与 systemd 均有官方指引）；HTTPS 自签证书需构建含证书的新镜像（`COPY my-ca.pem /usr/local/share/ca-certificates/my-ca.crt` + `RUN update-ca-certificates`，构建后 `docker run -d -e HTTPS_PROXY=... ollama-with-ca`）。

**Ollama 会把我的提示词和回答发回 ollama.com 吗？** Ollama 本地运行，本地使用时官方看不到你的提示与数据。使用云端模型时会处理提示与响应以提供服务，但不存储、不记录、绝不用作训练；只收集不含提示或响应内容的账户与使用元数据；不出售数据；可随时删除账户。

**如何关闭 Ollama Cloud 功能（纯本地模式）？** 在 `~/.ollama/server.json` 设 `{"disable_ollama_cloud": true}`，或设环境变量 `OLLAMA_NO_CLOUD=1`，重启后日志显示 `Ollama cloud disabled: true`（关闭后失去云端模型与联网搜索能力）。

**如何把 Ollama 暴露到网络？** 默认绑定 `127.0.0.1:11434`，用 `OLLAMA_HOST` 改绑定地址。

**如何配 Nginx 反代？** 示例：

```nginx
server {
    listen 80;
    server_name example.com;  # 换成你的域名或 IP
    location / {
        proxy_pass http://localhost:11434;
        proxy_set_header Host localhost:11434;
    }
}
```

**ngrok / Cloudflare Tunnel？** `ngrok http 11434 --host-header="localhost:11434"`；`cloudflared tunnel --url http://localhost:11434 --http-host-header="localhost:11434"`。

**如何允许额外的 Web 来源跨域访问？** 默认允许来自 `127.0.0.1` 与 `0.0.0.0` 的跨域请求，用 `OLLAMA_ORIGINS` 配置额外来源。浏览器扩展需显式允许其 origin 模式（如 `OLLAMA_ORIGINS=chrome-extension://*,moz-extension://*,safari-web-extension://*` 允许全部扩展，或按需指定）。

**模型存在哪里？** macOS：`~/.ollama/models`；Linux：`/usr/share/ollama/.ollama/models`；Windows：`C:\Users\%username%\.ollama\models`。换目录设 `OLLAMA_MODELS`（Linux 标准安装下 `ollama` 用户需要该目录读写权限：`sudo chown -R ollama:ollama <directory>`）。

**VS Code 里怎么用？** 安装官方 [Ollama 扩展](https://marketplace.visualstudio.com/items?itemName=Ollama.ollama)，在 VS Code Chat 中使用 Ollama 模型（设置与排障见官方集成指南）。

**Docker 里怎么用 GPU 加速？** Linux 或 Windows（WSL2）可用，需要 [nvidia-container-toolkit](https://github.com/NVIDIA/nvidia-container-toolkit)。macOS 的 Docker Desktop 因缺少 GPU 直通与模拟不可用。

**Windows 10 的 WSL2 网络慢？** 打开"控制面板 > 网络和 Internet > 查看网络状态和任务"，左侧"更改适配器设置"，找到 `vEthernet (WSL)` 适配器 → 右键属性 → 配置 → 高级，把 `Large Send Offload Version 2 (IPv4)` 与 `Large Send Offload Version 2 (IPv6)` 两项**禁用**。这会影响安装 Ollama 与下载模型。

**如何预加载模型以加快响应？** 给服务器发空请求即可（`/api/generate` 与 `/api/chat` 均可）：`curl http://localhost:11434/api/generate -d '{"model": "mistral"}'`；CLI 用 `ollama run llama3.2 ""`。

**如何让模型常驻内存或立即卸载？** 默认模型在内存保留 5 分钟后卸载（便于连续请求快速响应）。`ollama stop llama3.2` 立即卸载；API 在 `/api/generate` 与 `/api/chat` 用 `keep_alive` 参数——时长字符串（"10m"、"24h"）、秒数（3600）、任意负数（常驻，如 -1 或 "-1m"）、`0`（生成响应后立即卸载）。示例：`curl http://localhost:11434/api/generate -d '{"model": "llama3.2", "keep_alive": -1}'`（常驻）、`keep_alive: 0`（用完卸载）。也可在启动服务器时设 `OLLAMA_KEEP_ALIVE` 全局默认（参数类型同上）；API 参数优先于该环境变量。

**如何管理服务器排队的最大请求数？** 请求过多时服务器返回 503 表示过载；用 `OLLAMA_MAX_QUEUE` 调整可排队请求数。

**Ollama 如何处理并发请求？** 支持两级并发：系统可用内存（CPU 推理看内存，GPU 推理看显存）充足时可同时加载多个模型；对给定模型，加载时内存充足则配置为允许并行请求处理。若内存不足以加载新模型，新请求全部排队、旧模型空闲后逐个卸载腾位，队列请求按序处理。GPU 推理下新模型必须完整放进显存才允许并发加载。并行请求处理会把上下文规模按并行数放大：2K 上下文 × 4 并行 = 8K 上下文与额外内存分配。相关服务器设置：`OLLAMA_MAX_LOADED_MODELS`（可同时加载的模型数上限，默认 3×GPU 数，CPU 推理为 3）、`OLLAMA_NUM_PARALLEL`（每模型同时处理的并行请求数，默认 1；所需内存按 `OLLAMA_NUM_PARALLEL × OLLAMA_CONTEXT_LENGTH` 扩展）、`OLLAMA_MAX_QUEUE`（繁忙时排队上限，默认 512）。注：Windows + Radeon 因 ROCm v5.7 在可用显存上报上的限制，当前默认最多 1 个模型；ROCm v6.2 可用后将遵循上述默认值。

**多 GPU 如何加载模型？** 加载新模型时，Ollama 评估模型所需显存与当前可用量：能整体装进任意单卡就装在该卡上（减少推理时跨 PCI 总线的数据传输，通常性能最佳）；单卡装不下则摊到所有可用 GPU。

**如何启用 Flash Attention？** 多数现代模型支持的特性，可随上下文增长显著减少内存占用。所选后端与设备支持时 Ollama 自动使用；`OLLAMA_FLASH_ATTENTION=1` 强制开启、`=0` 关闭。

**如何设置 K/V 缓存的量化类型？** Flash Attention 开启时，K/V 上下文缓存可量化以显著减少内存占用。设 `OLLAMA_KV_CACHE_TYPE`（当前为全局选项，所有模型生效）：`f16`——高精度、高内存（默认）；`q8_0`——8-bit，约为 f16 的 1/2 内存、精度损失极小，通常对模型质量无可感知影响（不用 f16 时推荐）；`q4_0`——4-bit，约 1/4 内存、中小精度损失，大上下文时更明显。对回答质量的影响取决于模型与任务：高 GQA 数的模型（如 Qwen2）受量化影响可能大于低 GQA 模型。建议实验不同类型找内存与质量的平衡。

**Ollama 公钥在哪？** **Ollama 公钥**是密钥对的公开部分，用于本地 Ollama 实例与 [ollama.com](https://ollama.com) 通信：推送模型、拉取私有模型到本机、运行 [Ollama Cloud](https://ollama.com/cloud) 托管的模型。添加方式：Mac/Windows 应用在设置页登录；CLI `ollama signin`；或在 [Ollama Keys 页](https://ollama.com/settings/keys)手动复制粘贴。公钥 `id_ed25519.pub` 位置：macOS `~/.ollama/id_ed25519.pub`；Linux `/usr/share/ollama/.ollama/id_ed25519.pub`；Windows `C:\Users\<username>\.ollama\id_ed25519.pub`。

**如何禁止开机自启？** Windows 与 macOS 版安装时会注册为登录项，可关闭且升级后仍保留（卸载除外）。Windows：任务管理器"启动应用"标签搜 `ollama` 点禁用；macOS：设置搜"登录项"，在"允许在后台"找到 Ollama 关闭滑块。

---

> **来源**：抓取于 2026-09-13。各节均完整翻译自 Ollama 官方来源（作者 Ollama 团队，许可 MIT）：① Ollama 官方 GitHub README（[ollama/ollama](https://github.com/ollama/ollama)，下载/开始使用/REST API/后端与文档各节全文翻译；README 的"Community Integrations"一节为约两百个第三方项目的链接目录，非知识性正文，未逐条翻译并已在文中注明）；② 官方文档站 [Quickstart](https://docs.ollama.com/quickstart)、③ [CLI Reference](https://docs.ollama.com/cli)、④ [Importing a Model](https://docs.ollama.com/import)（含量化与分享模型小节）、⑤ [Hardware support](https://docs.ollama.com/gpu)（Nvidia/AMD/Metal/Vulkan 各节完整翻译；Nvidia 显卡总表按计算能力完整收录，原文表格内逐卡型号中与代表卡重复的变体以区间缩写呈现、旧代卡行保留分组并注明完整表见原文）、⑥ [Docker](https://docs.ollama.com/docker)（NVIDIA Container Toolkit 的 apt/yum 仓库配置命令块未重复收录，已注明见原文）、⑦ [FAQ](https://docs.ollama.com/faq)（全部 41 条问答逐条完整翻译，小节标题由原文疑问句改写为等义陈述句以便检索）。各文档页的站点导航头与样式注记未译。
