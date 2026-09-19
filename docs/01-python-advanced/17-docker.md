---
title: Docker 容器化：Python 语言指南
source_url: https://docs.docker.com/language/python/
author: Docker Inc. 文档团队（社区贡献：Esteban Maya、Igor Aleksandrov）
license: Apache 许可证 2.0
fetched_at: 2026-09-13
translated: true
versions: Docker 文档当前版（Docker Hardened Images / Compose Watch）
order: 17
group: 工程化与交付
---
*编者导读：本篇是 Docker 官方《Python 语言指南》（docs.docker.com/language/python/）的完整翻译，涵盖"容器化 Python 应用"（构建与运行）与"用容器进行开发"两大部分。原文以交互式文件浏览器逐节罗列全部项目文件，为避免大量重复，本翻译在每个步骤只展示**新增或修改**的文件，未变化的文件不再重复贴出。*

Python 语言指南教你如何用 Docker 容器化 Python 应用。在本指南中，你将学到：

- 容器化并运行 Python 应用
- 搭建基于容器的本地开发环境
- Lint、格式化、类型检查与最佳实践

从容器化一个现有的 Python 应用开始。

## 容器化 Python 应用（Containerize）

### 前置条件

- 你已安装最新版的 [Docker Desktop](https://docs.docker.com/get-started/get-docker/)。

### 概览

容器化你的应用，指的是把应用连同其依赖、配置和运行时一起打包成一个可移植的单元——容器镜像（container image）。运行该镜像即创建一个容器：一个在任意机器上行为一致的隔离进程，无论是你的笔记本、CI runner 还是生产服务器。

本节将容器化一个简单的 [FastAPI](https://fastapi.tiangolo.com) Web 应用。你要编写一个描述如何构建镜像的 `Dockerfile`，添加一个定义 Docker 如何运行容器的 `compose.yaml`，然后用一条命令构建并启动应用。

你将使用 [Docker Hardened Images](https://docs.docker.com/dhi/)（DHI）作为基础镜像——它们是 Docker 维护的最小化、安全的 Python 镜像。

### 创建应用

示例应用是一个极简 FastAPI 服务，只有一个返回 JSON 问候语的端点。在新的 `python-docker-example` 目录中创建以下文件。

**`app.py`**：

```python
# A minimal FastAPI application.
# The root endpoint (GET /) returns a JSON "Hello World" response.
# See https://fastapi.tiangolo.com/ for the framework reference.

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}
```

**`requirements.txt`**：

```text
# Python package dependencies for the application, pinned for reproducible builds.
# See https://pip.pypa.io/en/stable/reference/requirements-file-format/

fastapi==0.115.12
uvicorn==0.34.3
```

**`.gitignore`**：采用标准 Python 模板（覆盖字节码、构建产物、虚拟环境、IDE 设置，见 https://git-scm.com/docs/gitignore ），并包含 `db/password.txt` 等敏感文件条目。

如果本机装了 Python、想在容器化前验证应用可用，可以在本地运行：

```console
$ python3 -m venv .venv
$ source .venv/bin/activate
$ pip install -r requirements.txt
$ uvicorn app:app --reload
```

> **注**：Windows 上激活虚拟环境请用 `.venv\Scripts\activate`，而不是 `source .venv/bin/activate`。

如果本机没有 Python，直接跳到下一节即可：后续步骤都在容器中运行应用，无需本地 Python。

### 创建 Docker 资产

先登录 DHI 镜像仓库，Docker 才能在构建期间拉取 Python 基础镜像。可用的 Python 镜像见 [DHI 目录](https://hub.docker.com/hardened-images/catalog/dhi/python)：

```console
$ docker login dhi.io
```

然后向 `python-docker-example` 目录添加三个文件：`Dockerfile` 描述如何构建镜像，`compose.yaml` 定义 Docker 如何运行容器，`.dockerignore` 把不需要的文件挡在构建上下文之外。

> **提示**：[Gordon](https://docs.docker.com/ai/gordon/)（Docker 的 AI 助手）可以为你的项目生成 Docker 资产——让它为你创建量身定制的 Dockerfile、Compose 文件和 `.dockerignore`。

**`Dockerfile`**（新增）：

```dockerfile
# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# This Dockerfile uses Docker Hardened Images (DHI) for enhanced security.
# For more information, see https://docs.docker.com/dhi/

# Use the dev image to build and install dependencies.
FROM dhi.io/python:3.12-dev AS builder

WORKDIR /app

RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.cache/pip to speed up subsequent builds.
# Leverage a bind mount to requirements.txt to avoid having to copy them into
# this layer.
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install -r requirements.txt

# Use the minimal runtime image. It runs as nonroot by default.
FROM dhi.io/python:3.12

WORKDIR /app

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

# Copy the source code into the container.
COPY . .

# Expose the port that the application listens on.
EXPOSE 8000

# Run the application.
CMD ["/venv/bin/python3", "-m", "uvicorn", "app:app", "--host=0.0.0.0", "--port=8000"]
```

**`compose.yaml`**（新增）：

```yaml
# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Docker Compose reference guide at
# https://docs.docker.com/go/compose-spec-reference/

# Here the instructions define your application as a service called "server".
# This service is built from the Dockerfile in the current directory.
# You can add other services your application may depend on here, such as a
# database or a cache. For examples, see the Awesome Compose repository:
# https://github.com/docker/awesome-compose
services:
  server:
    build:
      context: .
    ports:
      - 8000:8000
```

**`.dockerignore`**（新增）：列出所有不希望被拷入容器的文件或目录（本地构建产物、临时文件等），典型条目包括 `**/__pycache__`、`**/.venv`、`**/.git`、`**/.env`、`**/node_modules`、`**/Dockerfile*`、`**/compose.y*ml` 等。

想深入了解各文件，参见官方的 Dockerfile 参考、`.dockerignore` 参考与 Compose 文件参考。

### 运行应用

在 `python-docker-example` 目录内的终端中运行：

```console
$ docker compose up --build
```

打开浏览器访问 [http://localhost:8000](http://localhost:8000)，应能看到一个简单的 FastAPI 应用。

在终端按 `ctrl`+`c` 停止应用。

#### 在后台运行应用

加 `-d` 选项可以脱离终端运行。在 `python-docker-example` 目录中运行：

```console
$ docker compose up --build -d
```

浏览器访问 [http://localhost:8000](http://localhost:8000) 查看应用；访问 [http://localhost:8000/docs](http://localhost:8000/docs) 可查看 OpenAPI 文档。

在终端运行以下命令停止应用：

```console
$ docker compose down
```

Compose 命令的更多信息见 Compose CLI 参考。

## 用容器进行 Python 开发（Develop）

### 前置条件

完成上一节"容器化 Python 应用"。

### 概览

应用跑进容器之后，下一步是让容器成为日常开发工作流的一部分：代码改动要能快速生效，应用依赖的服务（如数据库）也要能与它并肩运行。

本节将在上一节项目的基础上：向 `compose.yaml` 添加 PostgreSQL 数据库服务、用命名卷持久化数据库数据、启用 Compose Watch 让编辑器里保存的改动直接被运行中的容器接收而无需手动重建。

### 更新应用

接下来让应用连接 PostgreSQL 数据库。继续在 `python-docker-example` 目录中工作，替换 `app.py` 和 `requirements.txt`，并新增 `config.py`。

> **注**：这一步之后应用还跑不起来——它试图连接一个尚不存在的 PostgreSQL 数据库。接下来两节会补上数据库服务和所需的 Docker 配置。

**`app.py`**（修改）：

```python
# FastAPI application backed by a PostgreSQL database via SQLModel.
# The FastAPI lifespan handler creates database tables at startup.
# Endpoints: GET / (greeting), POST /heroes/ (create), GET /heroes/ (list).
# See https://fastapi.tiangolo.com/ and https://sqlmodel.tiangolo.com/

from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Field, Session, SQLModel, create_engine, select

from config import settings


class Hero(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    secret_name: str
    age: int | None = Field(default=None, index=True)


engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    create_db_and_tables()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def hello() -> str:
    return "Hello, Docker!"


@app.post("/heroes/")
def create_hero(hero: Hero) -> Hero:
    with Session(engine) as session:
        session.add(hero)
        session.commit()
        session.refresh(hero)
        return hero


@app.get("/heroes/")
def read_heroes() -> Sequence[Hero]:
    with Session(engine) as session:
        heroes = session.exec(select(Hero)).all()
        return heroes
```

**`config.py`**（新增）：

```python
# Pydantic settings that read PostgreSQL connection details from the
# environment. Supports a password file (Docker secrets) via
# POSTGRES_PASSWORD_FILE in addition to POSTGRES_PASSWORD.
# See https://docs.pydantic.dev/latest/concepts/pydantic_settings/

import os
from typing import Any

from pydantic import (
    PostgresDsn,
    computed_field,
    field_validator,
    model_validator,
)
from pydantic_core import MultiHostUrl
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_PASSWORD_FILE: str | None = None
    POSTGRES_DB: str

    @model_validator(mode="before")
    @classmethod
    def check_postgres_password(cls, data: Any) -> Any:
        """Validate that either POSTGRES_PASSWORD or POSTGRES_PASSWORD_FILE is set."""
        if isinstance(data, dict):
            password_file: str | None = data.get("POSTGRES_PASSWORD_FILE")  # type: ignore
            password: str | None = data.get("POSTGRES_PASSWORD")  # type: ignore
            if password_file is None and password is None:
                raise ValueError(
                    "At least one of POSTGRES_PASSWORD_FILE and POSTGRES_PASSWORD must be set."
                )
        return data  # type: ignore

    @field_validator("POSTGRES_PASSWORD_FILE", mode="before")
    @classmethod
    def read_password_from_file(cls, v: str | None) -> str | None:
        if v is not None:
            file_path = v
            if os.path.exists(file_path):
                with open(file_path) as file:
                    return file.read().strip()
            raise ValueError(f"Password file {file_path} does not exist.")
        return v

    @computed_field
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> PostgresDsn:
        url = MultiHostUrl.build(
            scheme="postgresql+psycopg",
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD
            if self.POSTGRES_PASSWORD
            else self.POSTGRES_PASSWORD_FILE,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            path=self.POSTGRES_DB,
        )
        return PostgresDsn(url)


settings = Settings()  # type: ignore
```

**`requirements.txt`**（修改）：

```text
# Python package dependencies for the application, pinned for reproducible builds.
# See https://pip.pypa.io/en/stable/reference/requirements-file-format/

fastapi==0.115.12
sqlmodel==0.0.24
psycopg[binary]==3.2.9
pydantic-settings==2.9.1
uvicorn==0.34.3
```

### 更新 Docker 资产

用以下内容替换 `Dockerfile` 与 `compose.yaml`。

**`Dockerfile`**（修改）：与此前版本相比，构建阶段（builder stage）现在加入了 `COPY . .` 与 `CMD` 指令，使其可直接运行——这样开发期间 Compose 可以直接以 builder 阶段为目标，而无需重建生产阶段；底部的生产阶段保持不变，仍然产出一个最小化、非 root 的运行时镜像用于交付：

```dockerfile
# syntax=docker/dockerfile:1

# This Dockerfile uses Docker Hardened Images (DHI) for enhanced security.

# Use the dev image to build and install dependencies.
# The builder stage is also used directly in development (see compose.yaml).
FROM dhi.io/python:3.12-dev AS builder

WORKDIR /app

RUN python3 -m venv /venv
ENV PATH="/venv/bin:$PATH"

# Download dependencies as a separate step to take advantage of Docker's caching.
RUN --mount=type=cache,target=/root/.cache/pip \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    pip install -r requirements.txt

# Copy the source code into the container.
COPY . .

# Expose the port that the application listens on.
EXPOSE 8000

# Run the application.
CMD ["/venv/bin/python3", "-m", "uvicorn", "app:app", "--host=0.0.0.0", "--port=8000"]


# Use the minimal runtime image for production. It runs as nonroot by default.
FROM dhi.io/python:3.12

WORKDIR /app

COPY --from=builder /venv /venv
ENV PATH="/venv/bin:$PATH"

COPY --from=builder /app .

EXPOSE 8000

CMD ["/venv/bin/python3", "-m", "uvicorn", "app:app", "--host=0.0.0.0", "--port=8000"]
```

**`compose.yaml`**（修改）：新增 `target: builder` 行，让 Compose 在开发期间构建并运行 Dockerfile 的 builder 阶段。与最小化的生产镜像不同，开发镜像包含 shell 和便于调试的额外工具。如果需要在运行中的生产容器里调试，请改用 [Docker Debug](https://docs.docker.com/reference/cli/docker/debug/)：

```yaml
services:
  server:
    build:
      context: .
      target: builder
    ports:
      - 8000:8000
```

### 添加本地数据库并持久化数据

可以用容器搭建本地服务，比如数据库。本节更新 `compose.yaml`，定义数据库服务与持久化数据的卷，并添加存放数据库密码的 `db/password.txt` 文件。

**`compose.yaml`**（修改）：

```yaml
services:
  # Application service. The `target: builder` line builds the development
  # image (includes a shell and tools); the production stage of the
  # Dockerfile is unused in development.
  server:
    build:
      context: .
      target: builder
    ports:
      - 8000:8000
    environment:
      - POSTGRES_SERVER=db
      - POSTGRES_USER=postgres
      - POSTGRES_DB=example
      - POSTGRES_PASSWORD_FILE=/run/secrets/db-password
    depends_on:
      db:
        condition: service_healthy
    secrets:
      - db-password
  # Database service. Reads the password from a Docker secret mounted at
  # /run/secrets/db-password. Compose waits for the healthcheck to pass
  # before starting the server, via the server's depends_on.
  db:
    image: dhi.io/postgres:18
    restart: always
    user: postgres
    secrets:
      - db-password
    volumes:
      - db-data:/var/lib/postgresql
    environment:
      - POSTGRES_DB=example
      - POSTGRES_PASSWORD_FILE=/run/secrets/db-password
    expose:
      - 5432
    healthcheck:
      test: ["CMD", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5
volumes:
  db-data:
secrets:
  db-password:
    file: db/password.txt
```

**`db/password.txt`**（新增）：内容为数据库密码（如 `mysecretpassword`），经由 Docker secret 挂载到 `/run/secrets/db-password`。

> **注**：Compose 文件中各指令的更多说明见官方 Compose 文件参考。

现在运行以下命令启动应用：

```console
$ docker compose up --build
```

测试 API 端点：开一个新终端，用 curl 请求服务器。

用 POST 创建对象：

```console
$ curl -X 'POST' \
  'http://localhost:8000/heroes/' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "id": 1,
  "name": "my hero",
  "secret_name": "austing",
  "age": 12
}'
```

应收到如下响应：

```json
{
  "age": 12,
  "id": 1,
  "name": "my hero",
  "secret_name": "austing"
}
```

再发一个 GET 请求：

```console
$ curl -X 'GET' \
  'http://localhost:8000/heroes/' \
  -H 'accept: application/json'
```

应收到与上面相同的响应，因为它是数据库中唯一的对象。

在终端按 `ctrl+c` 停止应用。

### 自动更新服务（Compose Watch）

用 Compose Watch 在你编辑并保存代码时自动更新运行中的 Compose 服务。更多细节见官方《Use Compose Watch》。

在 IDE 或文本编辑器中打开 `compose.yaml`，加入 Compose Watch 指令（server 服务下）：

```yaml
    develop:
      watch:
        - action: rebuild
          path: .
```

运行以下命令以 Compose Watch 模式启动应用：

```console
$ docker compose watch
```

在终端 curl 应用以获得响应：

```console
$ curl http://localhost:8000
Hello, Docker!
```

现在，本地源文件的任何改动都会立即反映到运行中的容器里。

在 IDE 中打开 `python-docker-example/app.py`，给 `Hello, Docker!` 字符串多加几个感叹号：

```diff
-    return 'Hello, Docker!'
+    return 'Hello, Docker!!!'
```

保存 `app.py`，等几秒让应用重建，再 curl 一次验证更新后的文本出现：

```console
$ curl http://localhost:8000
Hello, Docker!!!
```

在终端按 `ctrl+c` 停止应用。

## Python 的 Lint、格式化与类型检查

### 前置条件

完成上一节"用容器进行 Python 开发"。本主题需要本地 Python 安装，因为这里介绍的工具与 Git 钩子运行在宿主机上。不想装本地 Python 的话可以跳过，也可以在 CI 里运行同样的检查。

### 概览

Lint、格式化与类型检查是自动发现 bug、统一风格、在代码运行前发现类型错误的手段。在每次提交、CI 和编辑器里运行它们，能在修复成本最低的时候尽早抓住问题。

本节为 Python 应用配置三个工具：Ruff 在一次高速过程中同时完成 lint 与格式化；Pyright 静态检查类型错误；pre-commit 钩子在每次 Git 提交前自动运行前两者，让问题在提交前就被本地捕获。

### 用 Ruff 做 lint 与格式化

Ruff 是用 Rust 编写的极快 Python linter 与格式化工具，用一个统一工具取代 flake8、isort、black 等多个工具。

在 `python-docker-example` 目录创建 `pyproject.toml`：

```toml
# Configuration for code-quality tools.
# - [tool.ruff]: linting and formatting (https://docs.astral.sh/ruff/)
# - [tool.pyright]: static type checking (https://microsoft.github.io/pyright/)

[tool.ruff]
target-version = "py312"

[tool.ruff.lint]
select = [
    "E",  # pycodestyle errors
    "W",  # pycodestyle warnings
    "F",  # pyflakes
    "I",  # isort
    "B",  # flake8-bugbear
    "C4",  # flake8-comprehensions
    "UP",  # pyupgrade
    "ARG001", # unused arguments in functions
]
ignore = [
    "E501",  # line too long, handled by black
    "B008",  # do not perform function calls in argument defaults
    "W191",  # indentation contains tabs
    "B904",  # Allow raising exceptions without from e, for HTTPException
]
```

安装 Ruff（使用虚拟环境时先激活，保证 `ruff` 命令可用）：

```console
$ pip install ruff
```

运行这些命令检查并格式化代码：

```console
# Check for errors
$ ruff check .

# Automatically fix fixable errors
$ ruff check --fix .

# Format code
$ ruff format .
```

### 用 Pyright 做类型检查

Pyright 是快速的 Python 静态类型检查器，与现代 Python 特性配合良好。在 `pyproject.toml` 底部追加：

```toml
[tool.pyright]
typeCheckingMode = "strict"
pythonVersion = "3.12"
exclude = [".venv"]
```

安装并运行：

```console
$ pip install pyright
$ pyright
```

### 设置 pre-commit 钩子

pre-commit 钩子在本地每次提交前自动运行检查。在项目目录创建 `.pre-commit-config.yaml` 配置 Ruff 钩子：

```yaml
# Pre-commit hook configuration. Runs Ruff (lint + format) on every
# `git commit`. See https://pre-commit.com/

repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.15.15
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
```

安装与使用：

```console
$ pip install pre-commit
$ pre-commit install
$ git commit -m "Test commit"  # Automatically runs checks
```

### 小结

本节你学会了：

- 配置并使用 Ruff 做 lint 与格式化
- 用 Pyright 做静态类型检查
- 用 pre-commit 钩子自动执行检查

这些工具有助于维持代码质量、在开发早期捕获错误。更多信息见 [Ruff 文档](https://docs.astral.sh/ruff/)、[Pyright 文档](https://microsoft.github.io/pyright/)、[pre-commit 框架](https://pre-commit.com/)。

### 下一步

- 定制 lint 规则以符合团队的风格偏好
- 探索高级类型检查特性

---

> **来源**：本文为 Docker 官方《[Python 语言指南](https://docs.docker.com/language/python/)》（含 containerize / develop / run 各节，对应指南总览页与 language/python 子页面）的完整翻译，作者 Docker Inc. 文档团队（社区贡献者 Esteban Maya、Igor Aleksandrov），许可 Apache 许可证 2.0。示例代码取自官方仓库 `content/guides/python.md`。抓取于 2026-09-13。

---

> 编者注：① 原指南的文件浏览器会在每个步骤重复列出全部项目文件，本翻译做了去重：每个步骤只展示新增/修改的文件，`app.py`、`config.py`、`requirements.txt`、`.gitignore`、`.dockerignore` 的完整内容只在首次出现时贴出。② 官方当前版指南使用 Docker Hardened Images（`dhi.io/python:3.12`），社区更常见的写法是 `python:3.12-slim`（Docker 官方镜像）——替换 FROM 行即可，其余步骤一致。③ 指南内置的 Ruff/Pyright/pre-commit 一节与本模块《代码质量工具链》一篇互为补充。
