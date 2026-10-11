# GuguWiki

GuguWiki 是一个面向团队的知识库与检索问答项目。目标是让管理员维护 Wiki 文档，让团队成员浏览和搜索已发布内容，并通过带来源引用的问答快速查找资料。

项目采用前后端分离的多服务架构：React 提供读者端和管理端；Java Spring Boot BFF 负责认证、用户与业务 API；Python 服务承载文档处理和检索问答流程；PostgreSQL（pgvector）保存业务数据并支持全文与向量检索，Redis 保存登录会话等临时状态。

## 当前进度

- **前端**：React、TypeScript、Vite；读者端与管理端页面可通过内置 Mock 数据体验。
- **Java BFF**：Spring Boot；已包含登录、Redis 登录态、角色校验和管理员用户管理的初版实现，并使用 Flyway 管理数据库迁移。
- **Python Retrieval Service**：FastAPI 工程骨架和 `/healthz` 存活检查已具备；文档解析、切片、向量生成、授权召回、重排与回答生成仍待实现。
- **本地基础设施**：Docker Compose 启动 Nginx 前端、PostgreSQL（pgvector）和 Redis。Java 与 Python 服务需分别运行；Compose 当前默认使用 Mock 前端模式。

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

需要 Docker Compose；本机前端开发还需要 Node.js/npm。首次启动时，从示例配置创建本地配置，并替换数据库和 Redis 密码：

```powershell
Copy-Item .env.example .env
# 编辑 .env，设置 POSTGRES_PASSWORD 和 REDIS_PASSWORD
docker compose --env-file .env up -d --build
```

默认前端地址为 <http://127.0.0.1:18080>，API 文档页面为 <http://127.0.0.1:18080/api-docs/>。默认 `VITE_API_MODE=mock`，无需启动 Java 或 Python 服务即可体验前端演示。Mock 演示账号密码均为 `demo123`：

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

## 文档

- [项目书](docs/项目书.md)：产品目标、角色权限、数据流和检索设计。
- [数据库表设计](docs/数据库表设计.md)：业务表、权限语义和迁移说明。
- [接口文档](docs/接口文档.md)：前端与 Java、Java 与 Python 的接口契约。
- [Retrieval Service 说明](backend/retrieval-service/README.md)：Python 服务环境、启动和构建。

## 开源许可

本项目采用 [MIT License](LICENSE)。你可以免费使用、修改、分发，也可以用于商业项目；再分发时请保留版权声明和许可文本。许可全文见 [LICENSE](LICENSE)。

该许可适用于本仓库项目内容；第三方依赖及组件仍遵循各自的许可条款。
