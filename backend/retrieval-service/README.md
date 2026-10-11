# GuguWiki Retrieval Service

这是 Python 内部服务的 uv 工程骨架。当前仅提供进程存活检查；PDF 提取、切片/向量生成、授权召回编排、RRF、重排、证据判断、回答生成及协作取消尚未实现。接口契约见仓库根目录 `docs/接口文档.md` 的第 7、8 节。

## 环境与启动

在本目录执行：

```powershell
uv sync --locked
uv run --locked retrieval-service
```

默认监听 `127.0.0.1:8001`，存活检查为 `GET http://127.0.0.1:8001/healthz`。监听地址和端口可通过仓库根目录 `.env` 中的 `RETRIEVAL_SERVICE_HOST`、`RETRIEVAL_SERVICE_PORT` 配置。若需加载同一份配置文件：

```powershell
uv run --locked --env-file ../../.env retrieval-service
```

`/healthz` 只表示 Python 进程正在运行，不表示 Java 授权接口、数据库或模型服务已就绪。默认只监听本机回环地址；实现内部接口后，需按项目书配置 Java↔Python 的服务凭据和网络边界。

## 构建

```powershell
uv build
```

产物在本目录 `dist/`。`pyproject.toml` 管理直接依赖，`uv.lock` 固定完整依赖树。新增依赖使用 `uv add <包名>`，随后提交这两个文件。Python 不直接访问 PostgreSQL/Redis；授权 FTS 与向量候选由 Java 内部接口提供。模型供应商尚未确定，暂不绑定特定 SDK，可用 `httpx` 对接选定的 HTTP 服务。

已备依赖：FastAPI/uvicorn（HTTP 与 SSE）、httpx（调用 Java 与模型服务）、pydantic-settings（配置）、pypdf（可提取文字的 PDF）、python-multipart（PDF 上传）、jieba（中文分词）。
