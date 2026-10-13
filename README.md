# GuguWiki

GuguWiki 是一个面向团队的知识库与检索问答项目。目标是让管理员维护 Wiki 文档，让团队成员浏览和搜索已发布内容，并通过带来源引用的问答快速查找资料。

项目采用前后端分离的多服务架构：React 提供读者端和管理端；Java Spring Boot BFF 负责认证、用户与业务 API；Python 服务承载文档处理和检索问答流程；PostgreSQL（pgvector）保存业务数据并支持全文与向量检索，Redis 保存登录会话等临时状态。

## 当前进度

当前处于基础工程、认证和用户管理阶段，尚未完成真实 Wiki 检索问答链路。以下进度以当前 `master` 的源码为准。

| 模块 | 当前已具备 | 尚待实现或验证 |
| --- | --- | --- |
| 前端 | React、TypeScript、Vite；读者端和管理端页面、Mock 数据、HTTP 适配器 | Wiki、发布、问答和检索实验室页面与真实后端的完整联调 |
| Java BFF | BCrypt 登录校验、Redis Token、会话恢复与续期、退出登录、ADMIN 角色校验、创建和查询用户 | 知识库、目录、文档、版本发布、会话问答及授权检索业务 API |
| Python 检索服务 | FastAPI/uv 工程骨架、配置监听地址和端口、`GET /healthz` | PDF 解析、切片、向量生成、授权召回编排、RRF、重排、证据判断和回答生成 |
| 数据库 | Flyway 建表与注释迁移；`users`、`knowledge_bases`、`folders`、`documents`、`document_versions` 五张表 | 与后续检索、问答和评测功能配套的数据结构与读写逻辑 |
| 本地基础设施 | Compose 编排 Nginx 前端、PostgreSQL（pgvector）和 Redis | Java、Python 仍需单独启动；完整业务链路与模型连通性需后续验证 |

当前 Java 已有以下接口实现：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | 验证账号密码及登录入口，返回用户信息和 Token |
| GET | `/api/v1/auth/me` | 查询当前登录用户 |
| POST | `/api/v1/auth/logout` | 删除 Redis 登录 Token |
| POST | `/api/v1/admin/users` | 管理员创建用户并存储 BCrypt 密码哈希 |
| GET | `/api/v1/admin/users` | 管理员查询用户列表 |

Redis 登录态保存用户 ID，默认有效期为 30 分钟；后续请求使用 `Authorization: <Token>`。真实数据库不会自动创建 Mock 演示账号，首个管理员需显式运行 `AdminSeedTest`。

接口文档描述了更完整的目标契约，文档中的接口不代表这些功能都已实现或可用于生产环境。

## 项目结构

```text
backend/
  bff/GuguWiki/          Java Spring Boot BFF
  retrieval-service/     Python 检索服务
docs/                    项目书、数据库设计和接口契约
frontend/                React + TypeScript 前端与 Nginx 配置
infra/postgres/          PostgreSQL 初始化脚本
compose.yaml             本地基础设施编排
```

## 快速开始

需要 Docker Compose；本机前端开发需要 Node.js/npm，Java 服务需要 JDK 21，Python 服务使用 uv。首次启动时，从示例配置创建本地配置，并替换数据库和 Redis 密码。已有 `.env` 时保留原配置：

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# 编辑 .env，设置 POSTGRES_PASSWORD 和 REDIS_PASSWORD
docker compose --env-file .env up -d --build
```

默认前端地址为 <http://127.0.0.1:18080>，API 文档页面为 <http://127.0.0.1:18080/api-docs/>。默认 `VITE_API_MODE=mock`，无需启动 Java 或 Python 服务即可体验前端演示。页面中的问答和检索结果来自 Mock 数据。Mock 演示账号密码均为 `demo123`：

| 账号 | 演示角色 |
| --- | --- |
| `reader@guguwiki.dev` | 读者 |
| `admin@guguwiki.dev` | 管理员 |
| `platform@guguwiki.dev` | 读者 |

停止服务但保留数据库数据卷：

```powershell
docker compose --env-file .env down
```

`.env` 仅供本机使用，已加入 Git 忽略规则。请勿提交真实密码、令牌或其他凭据。

## 本地开发

### 前端

```powershell
cd frontend
npm ci
npm run dev
```

开发服务器默认地址为 <http://127.0.0.1:5173>。前端 API 契约和 Mock/HTTP 适配器位于 `frontend/src/`。

### Java BFF

先启动 Compose 中的 PostgreSQL 和 Redis，再运行：

```powershell
cd backend/bff/GuguWiki
./mvnw.cmd spring-boot:run
```

### Python 检索服务

请先安装 [uv](https://docs.astral.sh/uv/)，然后在仓库根目录运行：

```powershell
cd backend/retrieval-service
uv sync --locked
uv run --locked --env-file ../../.env retrieval-service
```

默认存活检查为 <http://127.0.0.1:8001/healthz>。它只表示 Python 进程可用，不表示检索、模型或 Java 服务已就绪。

### 模型配置与接入进度

三类模型的配置应保存在本地 `.env` 中，后续接入使用以下变量：

| 用途 | 配置变量 |
| --- | --- |
| 向量模型 | `RETRIEVAL_EMBEDDING_MODEL`、`RETRIEVAL_EMBEDDING_BASE_URL`、`RETRIEVAL_EMBEDDING_API_KEY`、`RETRIEVAL_EMBEDDING_DIMENSIONS` |
| 重排模型 | `RETRIEVAL_RERANK_MODEL`、`RETRIEVAL_RERANK_URL`、`RETRIEVAL_RERANK_API_KEY` |
| 对话模型 | `RETRIEVAL_GENERATION_MODEL`、`RETRIEVAL_GENERATION_BASE_URL`、`RETRIEVAL_GENERATION_API_KEY` |

当前 Python `Settings` 只读取 `RETRIEVAL_SERVICE_HOST` 和 `RETRIEVAL_SERVICE_PORT`，尚未实现上述三类模型配置的读取和调用。填写模型名称、地址与 Key 不表示模型调用或完整检索问答已经可用；`.env.example` 当前也尚未包含这些模型变量。

## 文档

- [项目书](docs/项目书.md)：产品目标、角色权限、数据流和检索设计。
- [数据库表设计](docs/数据库表设计.md)：业务表、权限语义和迁移说明。
- [接口文档](docs/接口文档.md)：前端与 Java、Java 与 Python 的接口契约。
- [Retrieval Service 说明](backend/retrieval-service/README.md)：Python 服务环境、启动和构建。

`docs` 目录只跟踪上述三份 Markdown 文档。文档生成用的 `.mjs` 文件保留在本地并由 `.gitignore` 忽略，不随当前版本分发。

## 开源许可

本项目采用 [MIT License](LICENSE)。你可以免费使用、修改、分发，也可以用于商业项目；再分发时请保留版权声明和许可文本。许可全文见 [LICENSE](LICENSE)。

该许可适用于本仓库项目内容；第三方依赖及组件仍遵循各自的许可条款。
