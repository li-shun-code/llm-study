---
title: Docker 容器化 Python 应用
source_url: https://docs.docker.com/language/python/containerize/
author: Docker Inc. 及 Docker 文档贡献者
license: Apache License 2.0
fetched_at: 2026-09-13
translated: true
order: 12
versions: Docker Engine / Docker Compose 当前稳定版，Python 3.12 基础镜像
---

> **来源**：本文翻译自 [Containerize a Python application — Docker Docs](https://docs.docker.com/language/python/containerize/)，作者 Docker Inc. 及 Docker 文档贡献者，许可 Apache License 2.0。抓取于 2026-09-13。

> 编者注：本篇节选翻译 Docker 官方 Python 语言指南的"容器化"部分（Dockerfile / Compose / 构建 / 运行）。Docker 是模块 10 中 vLLM、Ollama 等模型服务部署的通用载体，也是模块 9 中 LangGraph、数据库等本地开发环境的标准打包方式。

## 为什么 LLM 应用需要 Docker

"在我机器上能跑"是工程协作中最贵的借口。你的 FastAPI 服务依赖特定版本的 Python、特定版本的库，还要连 Redis、向量数据库——Docker 把这一切打包成镜像（image）：一次构建，处处运行；开发、测试、生产用同一个环境。

本指南中，你将把一个简单的 FastAPI Web 应用容器化：编写一个描述如何构建镜像的 `Dockerfile`，添加一个定义 Docker 如何运行容器的 `compose.yaml` 文件，然后用一条命令构建并启动应用程序。

## 创建应用程序

按官方指南创建项目 `python-docker-example`，包含三个核心文件。

**`app.py`** —— 一个最小的 FastAPI 应用（见本模块第 11 篇）：

```python
# A minimal FastAPI application.
# The root endpoint (GET /) returns a JSON "Hello World" response.

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}
```

**`requirements.txt`** —— 应用的 Python 依赖，为可重现构建固定版本：

```text
fastapi==0.115.12
uvicorn==0.34.3
```

## 创建 Docker 资产

向 `python-docker-example` 目录添加以下三个文件。`Dockerfile` 描述如何构建镜像，`compose.yaml` 定义 Docker 如何运行容器，`.dockerignore` 则把不需要的文件挡在构建上下文之外。

### Dockerfile

以下是官方指南当前版本的 Dockerfile（使用 Docker Hardened Images（DHI）以增强安全性，构建前需 `docker login dhi.io` 登录 DHI 镜像仓库；可用的 Python 镜像见 Docker Hub 的 hardened-images catalog）：

```dockerfile
# syntax=docker/dockerfile:1

# 此 Dockerfile 使用 Docker Hardened Images (DHI) 以增强安全性。

# 使用 dev 镜像来构建并安装依赖（构建阶段）。
FROM dhi.io/python:3.12-dev AS builder

WORKDIR /app

RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# 把下载依赖作为独立步骤，以利用 Docker 的缓存。
# 利用 cache mount 挂载 /root/.cache/pip 以加速后续构建。
# 利用 bind mount 挂载 requirements.txt，避免把它拷贝进该层。
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install -r requirements.txt

# 使用最小运行时镜像（构建阶段 2）。它默认以非 root 用户运行。
FROM dhi.io/python:3.12

WORKDIR /app

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

# 把源代码复制进容器。
COPY . .

# 声明应用监听的端口。
EXPOSE 8000

# 运行应用程序。
CMD ["/venv/bin/python3", "-m", "uvicorn", "app:app", "--host=0.0.0.0", "--port=8000"]
```

> 编者注：这是一个**多阶段构建**（multi-stage build）：第一阶段在 `dev` 镜像里装依赖，第二阶段只把装好的 `/venv` 拷进精简的运行时镜像——最终镜像更小、攻击面更小。社区中更常见的写法是用公共基础镜像，例如把两处 `FROM` 分别换成 `python:3.12-slim`（此时无需分阶段也可以单阶段完成，但多阶段仍是最佳实践）。理解每个指令：`FROM` 选择基础镜像、`WORKDIR` 设置工作目录、`COPY` 拷贝文件、`EXPOSE` 声明端口、`CMD` 指定容器启动命令。

### compose.yaml

```yaml
# 这里把你的应用定义为一个名为 "server" 的服务。
# 该服务由当前目录中的 Dockerfile 构建。
# 你可以在这里添加应用依赖的其他服务，例如数据库或缓存。
services:
  server:
    build:
      context: .
    ports:
      - 8000:8000
```

### .dockerignore

`.dockerignore` 的作用类似 `.gitignore`：把本地构建产物、临时文件、虚拟环境等排除在构建上下文之外。官方模板的关键条目包括：

```text
**/.DS_Store
**/__pycache__
**/.venv
**/.dockerignore
**/.env
**/.git
**/.gitignore
# Environments
.env
.venv
env/
venv/
ENV/
venv.bak/
# Secrets
db/password.txt
```

> 编者注意：`**/.env` 与密码文件被排除是**安全要求**——API Key 等敏感信息绝不能被 `COPY . .` 打进镜像（模块 0 的环境变量方案 + 运行时注入才是正解，模型服务篇会再次强调）。

## 运行应用程序

在 `python-docker-example` 目录中，在终端运行以下命令：

```console
$ docker compose up --build
```

`--build` 表示构建（或重建）镜像再启动容器。打开浏览器访问 [http://localhost:8000](http://localhost:8000)，你应当看到这个简单的 FastAPI 应用。在终端中按 `ctrl`+`c` 停止应用程序。

### 在后台运行应用程序

添加 `-d` 选项可以让应用程序以分离（detached）模式运行：

```console
$ docker compose up --build -d
```

要查看 OpenAPI 文档，可以访问 [http://localhost:8000/docs](http://localhost:8000/docs)。用以下命令停止应用程序：

```console
$ docker compose down
```

更多 Compose 命令请参阅官方 Compose CLI reference。

## 在开发中使用容器（编者摘要）

官方指南的下一部分《Use containers for Python development》展示了开发工作流的容器化：在 `compose.yaml` 中加入 PostgreSQL 数据库服务、用**命名卷（named volume）**持久化数据库数据、启用 **Compose Watch** 让编辑器里保存的改动无需手动重建即可被运行中的容器感知。对 LLM 应用开发而言，这个模式非常实用——`server`（FastAPI 应用）+ `db`（PostgreSQL/pgvector）+ `cache`（Redis）在一条 `docker compose up` 里一起拉起，团队成员零配置上手。

## 常用命令速查（编者补充）

| 命令 | 作用 |
| --- | --- |
| `docker build -t myapp .` | 按当前目录 Dockerfile 构建镜像并打标签 |
| `docker run -p 8000:8000 --env-file .env myapp` | 从镜像启动容器，映射端口、注入环境变量 |
| `docker ps` | 查看运行中的容器 |
| `docker logs -f <容器>` | 跟踪容器日志（排障第一入口，结合本模块 logging 篇） |
| `docker compose up --build` | 按编排构建并启动全部服务 |
| `docker compose down` | 停止并删除编排中的容器与网络 |

延伸阅读：官方 Get Started 的《Build and run your first image》《Publish your image》等章节，以及《Dockerfile reference》。当你读完模块 10 的"vLLM 高吞吐部署"，回头看 Docker 只是那篇里的一条 `FROM` 而已。
