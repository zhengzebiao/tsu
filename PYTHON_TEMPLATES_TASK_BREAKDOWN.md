# Python 后端模板分阶段任务拆解

> 生成日期：2026-06-30  
> 来源方案：[PYTHON_TEMPLATES_ARCHITECTURE.md](PYTHON_TEMPLATES_ARCHITECTURE.md)  
> 目标：将 `python-main` 与 `python-app` 两个 FastAPI 后端模板的建设工作拆分为可执行、可验收的阶段任务。

## 0. 当前执行状态

> 状态更新时间：2026-07-05
> 当前实现分支：`implement-python-templates`
> 当前推进阶段：发布部署优化 Phase 2：独立 migration workflow（在 Phase 9 发布/回滚链路基础上新增手动 Alembic migration workflow）

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| 阶段 0：模板范围确认与目录准备 | ✅ 已完成 | 已注册 `python-main` / `python-app`，并建立生成文件结构 |
| 阶段 1：公共 FastAPI 工程骨架 | ✅ 已完成 | 已生成 FastAPI 入口、PDM 依赖与脚本管理、配置、PostgreSQL、SQLAlchemy、Alembic、Redis、健康检查和 pytest 基础结构 |
| 阶段 2：Swagger / OpenAPI 支持 | ✅ 已完成 | 已支持 `OPENAPI_ENABLED` / `DOCS_ENABLED` / `REDOC_ENABLED`，test 默认开启，product 默认关闭 |
| 阶段 3：日志记录基础设施 | ✅ 已完成 | 已生成 JSON 日志基础设施和 `X-Request-ID` middleware |
| 阶段 4：`python-main` 认证中心核心能力 | ✅ 已完成核心版 | 已接入 DB 用户校验、bcrypt hash password 校验、DB session 创建/吊销、roles/permissions 查询、RBAC-derived `roles`/`scope` claims、刷新时重新读取 DB 权限、`/auth/me` 返回真实用户；已补登录失败、logout、refresh reuse 等安全日志脱敏断言 |
| 阶段 5：Redis Token 状态管理 | ✅ 已完成基础版 | 已补 refresh token hash 的 `created_at`/`rotated_at`/`replaced_by` 元数据、rotation、reuse grace 判定、超出宽限期复用吊销 Redis session 并同步吊销 DB session、jti blacklist TTL 和 session revoke key 检查、refresh token 明文不落 Redis 断言；基础模板明确采用安全优先策略：grace window 内 401 不吊销、grace window 后吊销 session，前端用 single-flight refresh 配合，不默认做服务端幂等响应缓存 |
| 阶段 6：`python-app` 业务服务鉴权能力 | ✅ 已完成基础版 | 已生成 Bearer Token 解析、公钥校验、issuer/audience/exp 校验、Redis 黑名单读取、revoked session 检查、`sub`/`sid`/`jti`/`roles`/`scope` claim 规范化、`require_scope`/`require_scopes`/`require_any_scope`/`require_role`/`require_any_role` 依赖、细分鉴权失败日志、claim 边界测试、组合鉴权 helper 测试和 OpenAPI Bearer Auth 测试；基础模板不引入复杂 `require_policy` / deny 系列 |
| 阶段 7：Alembic、Seed 与数据库策略 | ✅ 已完成基础版 | 已生成 Alembic 环境、`python-main` / `python-app` 初始 migration、默认数据幂等 seed、README migration/seed/downgrade/product 边界说明，并补充模板/CLI/release 校验；本轮将 `sessions.user_id` 对齐为 DB user 外键 |
| 阶段 8：Docker 与 Nginx | ✅ 已完成基础版 | 已生成 Dockerfile、开发 compose、Nginx 反向代理、安全响应头和 Request ID 透传；Dockerfile 使用生产 Gunicorn + Uvicorn Worker，compose 使用开发 Uvicorn `--reload` |
| 阶段 9：GitHub Actions / Secrets / Environments | ✅ 已完成发布回滚与 migration 链路优化 | 已生成 CI-only workflow、独立 Deploy workflow、独立 Migrate workflow、`test-v*.*.*` / `product-v*.*.*` tag 发布、`workflow_dispatch` 历史 `image_tag` 回滚、Docker image build/push、SSH 上传 deploy compose/env/nginx；migration 通过手动 workflow_dispatch + GitHub Environment approval + `backup_confirmed` 执行，并保持 deploy/rollback 不自动 migration、seed 不自动执行 |
| 阶段 10：测试覆盖与验收 | ✅ 已完成基础验收 | 已补模板生成测试、CLI 初始化测试、release bundle 校验、生成文件 Python 语法 smoke check、`python-main` auth/token/refresh rotation/DB-backed auth service pytest、共享日志脱敏/Request ID pytest、Redis state service pytest、`python-app` profile/auth/session revoke/malformed claim/role dependency/任意 scope/role helper/细分日志/OpenAPI pytest，并通过 `validate:generated-python` 在本地 Redis 上完成生成项目与跨服务验证 |
| 阶段 11：README 与模板使用文档 | ✅ 已完成发布部署文档优化 | 已生成 README 基础说明、PDM 依赖管理说明、开发/生产 app server 说明、安全说明、Release Deploy and Rollback、Docker infra/app compose 拆分、GitHub Environments、tag 发布、rollback、migration policy、seed policy，并补齐 `python-main` 认证接口/JWT/Redis/migration/seed/FAQ 与 `python-app` 受保护接口/public key/issuer/audience/scope/roles/FAQ 文档 |

本轮已验证：

```bash
pnpm --filter @tsuz/template lint
pnpm --filter @tsuz/template build
pnpm --filter @tsuz/template test
pnpm --filter @tsuz/cli lint
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
pnpm template:release:build --version=0.0.0
TEMPLATE_VERSION=0.0.0 pnpm validate:template-release
REDIS_URL=redis://localhost:6379/15 pnpm validate:generated-python
```

`validate:generated-python` 已覆盖：通过本地 CLI 生成 `auth-service` / `backend-api`、检查 `.github/workflows/deploy.yml`、`.github/workflows/migrate.yml`、`docker-compose.deploy.yml`、`docker-compose.infra.yml`、`.env.deploy.example` 和 README 发布/回滚/migration markers、`compileall`、Alembic upgrade、seed 幂等、Ruff、pytest、启动两个生成服务并验证 DB-backed login、`/auth/me`、`/api/profile`、wrong scope `403`、malformed claims `401`、logout 后 profile `401`、Request ID 透传和敏感日志不泄露。

## 1. 总体目标

新增两个联动后端模板：

| 模板 | 定位 | 核心职责 |
| --- | --- | --- |
| `python-main` | 认证主服务 / Auth Service | 登录、签发 RS256 JWT、刷新 Token、注销、Session 管理、Redis 黑名单写入 |
| `python-app` | 业务 API 服务 / Resource Service | 校验 JWT、读取 Redis 黑名单、处理业务 API，不签发 Token |

整体建设目标：

- 提供生产可用的 FastAPI + PostgreSQL + SQLAlchemy + Alembic + Redis 模板。
- 固定支持 `test` / `product` 两套环境。
- `python-main` 持有私钥并签发 Token。
- `python-app` 只持有公钥并验证 Token。
- Access Token 不存 Redis。
- Refresh Token / Session / Blacklist 存 Redis。
- 支持 Swagger / OpenAPI、Docker、Nginx、GitHub Actions、日志记录和测试。

---

## 阶段 0：模板范围确认与目录准备

### 目标

明确两个模板的边界，并让模板生成系统能够识别 `python-main` 与 `python-app`。

### 任务

1. 确认现有模板系统的注册方式。
2. 新增 `python-main` 模板目录。
3. 新增 `python-app` 模板目录。
4. 按架构文档建立基础目录结构：
   - `app/api`
   - `app/core`
   - `app/models`
   - `app/schemas`
   - `app/services`
   - `alembic`
   - `tests`
   - `nginx`
   - `Dockerfile`
   - `docker-compose.yml`
   - `.env.test.example`
   - `.env.product.example`
   - `README.md`

### 交付物

- 两个模板目录存在。
- 两个模板可被模板生成系统发现或注册。
- 基础目录结构与方案文档一致。

---

## 阶段 1：公共 FastAPI 工程骨架

### 目标

为两个模板建立统一的 FastAPI 工程基础。

### 任务

1. 初始化 FastAPI 应用入口 `app/main.py`。
2. 增加配置模块 `app/core/config.py`。
3. 支持基础配置：
   - `APP_ENV`
   - `DEBUG`
   - `LOG_LEVEL`
   - `LOG_FORMAT`
   - `REQUEST_ID_HEADER`
   - `WEB_CONCURRENCY`
   - `GUNICORN_TIMEOUT`
   - `GUNICORN_GRACEFUL_TIMEOUT`
   - `SERVICE_NAME`
   - `API_PREFIX`
4. 增加 PostgreSQL 数据库配置。
5. 增加 SQLAlchemy 2.x ORM 基础封装。
6. 增加 Alembic 初始化配置。
7. 增加 Redis client 初始化。
8. 增加健康检查接口：
   - `GET /health`
9. 增加 CORS 配置。
10. 增加 pytest 基础测试结构。
11. 使用 PDM 管理依赖、虚拟环境和项目脚本。
12. 增加 `.env.test.example` 和 `.env.product.example`。

### 交付物

- 两个模板都可以启动 FastAPI 应用。
- 健康检查接口可访问。
- 数据库和 Redis 配置路径清晰。
- 可以通过 `pdm run test` 执行基础测试。

---

## 阶段 2：Swagger / OpenAPI 支持

### 目标

两个模板都支持可配置的接口文档，并区分 test / product 行为。

### 任务

1. 增加配置项：
   - `OPENAPI_ENABLED`
   - `DOCS_ENABLED`
   - `REDOC_ENABLED`
2. test 环境默认开启：
   - `/docs`
   - `/redoc`
   - `/openapi.json`
3. product 环境默认关闭公开文档。
4. 如 product 确需开启文档，README 中说明必须加访问控制。
5. 定义 Bearer Auth 安全方案。
6. 为接口补充：
   - `summary`
   - `description`
   - request schema
   - response schema
   - 401 / 403 错误响应

### 交付物

- test 环境 Swagger 可访问。
- product 环境默认不公开 Swagger。
- OpenAPI 文档能展示 Bearer Token 认证方式。

---

## 阶段 3：日志记录基础设施

### 目标

两个模板都具备统一、可追踪、可脱敏的日志能力。

### 任务

1. 增加日志配置模块，例如 `app/core/logging.py`。
2. 支持配置项：
   - `LOG_LEVEL`
   - `LOG_FORMAT`
   - `REQUEST_ID_HEADER`
3. 支持文本日志和 JSON 结构化日志。
4. product 推荐 JSON 日志。
5. 增加 Request ID 中间件：
   - 读取 `X-Request-ID`
   - 不存在时生成 UUID
   - 响应头返回 `X-Request-ID`
   - 日志中带上 `request_id`
6. HTTP 请求日志记录：
   - method
   - path
   - status_code
   - duration_ms
   - request_id
7. 增加敏感信息脱敏规则。
8. 禁止记录：
   - 明文密码
   - access token 全文
   - refresh token 全文
   - Authorization header 全文
   - JWT private key
   - JWT public key 原文
   - 数据库密码
   - Redis 密码
   - GitHub Secrets 值

### 交付物

- 两个模板都有统一日志初始化逻辑。
- 每个请求都有 `X-Request-ID`。
- 日志不会输出敏感 token、密码或密钥。
- 日志测试用例覆盖脱敏行为。

---

## 阶段 4：`python-main` 认证中心核心能力

### 目标

实现认证中心的登录、签发 Token、刷新 Token、注销、当前用户能力。

### 任务

#### 4.1 JWT RS256 支持

1. 支持 `JWT_ALGORITHM=RS256`。
2. 从环境变量读取：
   - `JWT_PRIVATE_KEY`
   - `JWT_PUBLIC_KEY`
3. 兼容 GitHub Secrets 中的原始多行 key 和 `\n` 转义 key。
4. 生成 Access Token payload：
   - `sub`
   - `iss`
   - `aud`
   - `iat`
   - `exp`
   - `jti`
   - `sid`
   - `roles`
   - `scope`

#### 4.2 用户、角色、权限、会话模型

1. 增加用户模型。
2. 增加角色模型。
3. 增加权限模型。
4. 增加用户角色关联。
5. 增加角色权限关联。
6. 增加 session 模型。
7. 增加 Alembic 初始化迁移。

#### 4.3 登录接口

实现：

```http
POST /auth/login
```

任务：

1. 校验用户名密码。
2. 创建 session。
3. 生成 access token。
4. 生成 refresh token。
5. 保存 refresh token hash 到 Redis。
6. 记录登录成功 / 失败安全日志。
7. 返回 token 响应。

#### 4.4 刷新接口

实现：

```http
POST /auth/refresh
```

任务：

1. 校验 refresh token。
2. 判断是否过期。
3. 判断是否 revoked。
4. 支持 refresh token rotation。
5. 支持短暂重试窗口。
6. 签发新的 access token。
7. 返回新的 refresh token。
8. 记录 refresh 成功、失败、重复使用日志。

#### 4.5 注销接口

实现：

```http
POST /auth/logout
```

任务：

1. 校验 Bearer access token。
2. 读取 `jti`。
3. 将 `jti` 写入 Redis 黑名单。
4. 吊销当前 refresh token / session。
5. 记录 logout 和 blacklist 写入日志。
6. 返回注销成功。

#### 4.6 当前用户接口

实现：

```http
GET /auth/me
```

任务：

1. 校验 token。
2. 查询 Redis 黑名单。
3. 返回当前用户信息。
4. token 无效或命中黑名单时返回 401。

### 交付物

- `python-main` 具备完整认证主服务能力。
- 只有 `python-main` 持有私钥并能签发 Token。
- Swagger 中认证接口文档完整。
- 认证安全日志完整且已脱敏。

---

## 阶段 5：Redis Token 状态管理

### 目标

实现 Refresh Token、Session、Blacklist 的 Redis 状态管理。

### 任务

1. 明确 Access Token 不存 Redis。
2. Redis 中只存：
   - Refresh Token hash
   - Session 状态
   - Access Token 黑名单 jti
3. 实现统一 key 前缀：
   - `auth:test:`
   - `auth:product:`
4. 实现黑名单 key：
   - `auth:<env>:blacklist:jti:<jti>`
5. 黑名单 TTL 使用 access token 剩余有效期。
6. Refresh Token 存储使用 hash：
   - `sha256(refresh_token)`
7. Refresh Token value 保存：
   - `user_id`
   - `sid`
   - `status`
   - `created_at`
   - `expires_at`
   - `rotated_at`
   - `replaced_by`
8. 实现 refresh token rotation。
9. 实现 `REFRESH_TOKEN_REUSE_GRACE_SECONDS` 宽限期逻辑。
10. 超出宽限期重复使用时吊销 session。
11. 简单模板推荐的 refresh token 并发策略：
   - 保持 refresh token rotation：旧 refresh token 成功刷新后立即标记为 `rotated`，返回新的 refresh token。
   - grace window 内旧 refresh token 再次使用：返回 401，但不吊销 session，用于容忍正常并发请求或网络重试。
   - grace window 后旧 refresh token 再次使用：视为疑似泄露或重放攻击，吊销 Redis session 与 DB session，用户需要重新登录。
   - 不在基础模板中实现“并发刷新幂等返回同一份新 refresh token”。
   - 不把新 refresh token 明文或可恢复响应默认缓存到 Redis，避免扩大 Redis 泄露后的风险面。
12. 前端 / 客户端推荐配合方案：
   - 实现 refresh single-flight：同一时间只允许一个 refresh 请求在飞。
   - 如果已有 refresh 请求进行中，其他 API 请求等待同一个 refresh Promise，而不是再次发起 refresh。
   - refresh 成功后统一更新本地 access token / refresh token，再重放等待中的业务请求。
   - refresh 返回 401 时清理本地 token 并跳转登录页。
   - 如果遇到 grace window 内旧 refresh token replay 返回的 401，客户端不应覆盖已经成功刷新得到的新 token。
   - 多标签页场景建议用 BroadcastChannel / storage event / 共享锁同步刷新结果，避免多个标签页同时 refresh。

### 交付物

- Redis key 与架构文档一致。
- logout 后 token 立即被拒绝。
- refresh token 不明文落 Redis。
- 并发刷新场景可控。
- 文档明确基础模板采用“grace window 内 401 不吊销、grace window 后吊销 session”的安全优先策略。
- 文档明确前端通过 single-flight refresh 配合，避免依赖服务端缓存 refresh token 明文或可恢复响应。

---

## 阶段 6：`python-app` 业务服务鉴权能力

### 目标

实现业务服务只验证 Token，不签发 Token。

### 任务

1. `python-app` 只读取：
   - `JWT_PUBLIC_KEY`
   - `JWT_ISSUER`
   - `JWT_AUDIENCE`
2. 不提供：
   - 登录
   - 刷新
   - 注销
3. 不包含：
   - `JWT_PRIVATE_KEY`
   - `create_access_token()` 签发逻辑
4. 实现 Bearer Token 解析。
5. 校验：
   - RS256 签名
   - `iss`
   - `aud`
   - `exp`
   - `jti`
   - roles / scope
6. 查询 Redis 黑名单。
7. 增加鉴权依赖：
   - `app/deps/auth.py`
8. 增加示例业务接口：

```http
GET /api/profile
```

9. token 缺失、无效、过期、命中黑名单时返回 401。
10. 权限不足返回 403。
11. 记录鉴权失败、权限不足、黑名单命中日志。
12. 简单模板推荐的策略组合能力：
   - 保留 `require_scope("scope:name")`：必须拥有单个 scope。
   - 保留 `require_scopes("a", "b")`：必须同时拥有全部 scopes。
   - 新增 `require_any_scope("a", "b")`：拥有任意一个 scope 即可。
   - 保留 `require_role("role-name")`：必须拥有单个 role。
   - 新增 `require_any_role("admin", "operator")`：拥有任意一个 role 即可。
13. 不在基础模板中引入复杂策略：
   - 暂不提供 `require_policy(...)`。
   - 暂不提供 `require_all_roles(...)` / `require_all_scopes(...)` 别名。
   - 暂不提供 `deny_role(...)` / `deny_scope(...)` / deny-any 系列。
   - 原因：保持模板简单、易读，覆盖常见 90% 后端鉴权场景即可。

### 交付物

- `python-app` 不能签发 Token。
- `python-app` 只能用公钥验证 Token。
- 业务接口可通过 Bearer Token 访问。
- 注销后的 Token 在 `python-app` 中会被拒绝。
- 鉴权依赖提供简单易懂的 scope/role 组合：单个必需、全部 scopes、任意 scope、单个 role、任意 role。

---

## 阶段 7：Alembic、Seed 与数据库策略

### 目标

完善数据库迁移、初始化数据和安全回滚策略。

### 任务

1. 为两个模板初始化 Alembic。
2. 增加基础 migration。
3. 在 README 中说明常用命令：
   - `alembic current`
   - `alembic upgrade head`
   - `alembic downgrade -1`
   - `alembic downgrade <revision_id>`
4. 明确 product 不默认依赖 downgrade 回滚。
5. `python-main` 增加 seed：
   - 默认管理员
   - 默认角色
   - 默认权限
6. `python-app` 增加 seed：
   - 示例业务数据
   - 默认配置项
7. seed 必须幂等。
8. product 默认不自动 seed，需要明确手动执行。
9. 数据库和 seed 日志不输出完整连接串或密码。

### 交付物

- migration 可执行。
- seed 可重复执行。
- README 明确 downgrade 的安全边界。
- migration / seed 过程有可追踪日志。

---

## 阶段 8：Docker 与 Nginx

### 目标

让两个模板具备容器化、本地编排、反向代理和安全响应头能力。

### 任务

1. 为两个模板增加 `Dockerfile`。
2. Dockerfile 默认使用生产启动方式：Gunicorn + Uvicorn Worker。
3. 为两个模板增加 `docker-compose.yml`。
4. 默认 compose 使用开发启动方式：Uvicorn `--reload`。
5. compose 中包含：
   - FastAPI 服务
   - PostgreSQL
   - Redis
   - Nginx
6. 镜像 tag 不默认只用 `latest`。
7. README 中说明推荐 tag：
   - `test-v1.0.1`
   - `product-v1.0.1`
   - 历史 `image_tag` 用于 workflow_dispatch 回滚
8. Nginx 增加：
   - 反向代理 FastAPI
   - 健康检查入口
   - 请求体大小限制
   - 安全响应头
   - `X-Request-ID` 透传
9. product 可选 HSTS。
10. Nginx access log 不记录 Authorization header 或 Cookie 全文。
11. Docker 容器日志输出到 stdout / stderr。

### 交付物

- 两个模板都可以通过 Docker Compose 以开发模式启动。
- 生产镜像默认使用 Gunicorn + Uvicorn Worker 启动 FastAPI。
- Nginx 可代理服务。
- Nginx 可透传 Request ID。
- README 说明应用镜像回滚方式。
- 不鼓励依赖数据库 downgrade 做 product 回滚。

---

## 阶段 9：GitHub Actions / Secrets / Environments

### 目标

提供 test/product 两套 CI/CD 配置模板。

### 任务

1. 增加 GitHub Actions workflow。
2. workflow 使用 PDM 安装依赖和执行脚本：
   - `pdm install`
   - `pdm run lint`
   - `pdm run test`
3. CI workflow 支持：
   - 安装依赖
   - lint
   - test
   - alembic current 检查
   - docker build
4. Deploy workflow 支持：
   - `test-v*.*.*` 发布到 test
   - `product-v*.*.*` 发布到 product
   - `workflow_dispatch` 输入历史 `image_tag` 回滚
   - docker build / docker push 只在 tag 发布时执行
   - rollback 只 pull 历史 image 并 `docker compose up -d --no-build`
5. 使用 GitHub Environments：
   - `test`
   - `product`
6. Environment Variables：
   - `DOCKER_REGISTRY`
   - `DOCKER_IMAGE_NAME`
   - `DEPLOY_HOST` / `DEPLOY_PORT` / `DEPLOY_USER` / `DEPLOY_PATH`
   - `CONTAINER_NAME` / `APP_PORT` / `NGINX_PORT`
   - `APP_ENV` / `DOCKER_NETWORK_NAME`
   - `JWT_ISSUER` / `JWT_AUDIENCE` / `CORS_ALLOW_ORIGINS`
7. Environment Secrets：
   - `DOCKER_REGISTRY_TOKEN`
   - `SSH_PRIVATE_KEY`
   - `SSH_KNOWN_HOSTS`
   - `DATABASE_URL`
   - `REDIS_URL`
   - `JWT_PUBLIC_KEY`
   - `JWT_PRIVATE_KEY`（仅 `python-main`）
8. product 环境增加保护建议：
   - 人工审批
   - 只允许 `product-v*.*.*` tag 或经过审批的 rollback 部署
   - 限制 deploy 权限
   - product secrets 只允许 product job 读取
9. CI/CD 日志中不打印 `.env` 完整内容或 secrets 值。

### 交付物

- CI 可跑测试。
- 可构建 Docker 镜像。
- test/product secrets 分离。
- product 部署有保护规则说明。
- GitHub Actions 日志不泄露敏感信息。

---

## 阶段 10：测试覆盖与验收

### 目标

确保模板生成后可运行、可测试、可联调。

### `python-main` 测试任务

1. 登录成功。
2. 登录失败返回 401。
3. access token payload 正确。
4. refresh token 可刷新。
5. refresh token rotation 生效。
6. refresh token 重复使用在宽限期内行为正确。
7. refresh token 超出宽限期重复使用会吊销 session。
8. logout 后 jti 写入黑名单。
9. `/auth/me` 可返回当前用户。
10. 被黑名单 token 访问 `/auth/me` 返回 401。
11. 登录失败、logout、refresh 重复使用会产生安全日志。

### `python-app` 测试任务

1. 无 token 返回 401。
2. 无效签名 token 返回 401。
3. issuer 不匹配返回 401。
4. audience 不匹配返回 401。
5. expired token 返回 401。
6. 黑名单 token 返回 401。
7. 权限不足返回 403。
8. 有效 token 可以访问 `/api/profile`。
9. 黑名单 token 被拒绝时会产生日志。

### 集成测试任务

1. 使用 `python-main` 登录。
2. 拿 access token 访问 `python-app`。
3. 使用 `python-main` 注销。
4. 再访问 `python-app` 应返回 401。
5. 全链路响应都包含 `X-Request-ID`。
6. 日志中不包含 access token / refresh token / password / private key。

### 交付物

- pytest 测试通过。
- 两个模板可以完成端到端认证流程。
- Swagger 文档能正确展示接口和 Bearer Auth。
- 日志、脱敏和 Request ID 行为通过测试验证。

---

## 阶段 11：README 与模板使用文档

### 目标

让使用者能直接根据生成模板启动、配置、部署。

### 任务

#### `python-main` README

需要说明：

1. 项目定位。
2. 环境变量。
3. 本地启动：Uvicorn `--reload`。
4. 生产启动：Gunicorn + Uvicorn Worker。
5. 登录 / 刷新 / 注销 / 当前用户接口。
6. JWT 私钥、公钥配置方式。
7. Redis key 说明。
8. Refresh Token Rotation 说明。
9. Alembic 说明。
10. seed 说明。
11. 日志与 Request ID 说明。
12. Docker 说明。
13. GitHub Secrets 说明。

#### `python-app` README

需要说明：

1. 项目定位。
2. 环境变量。
3. 如何配置公钥。
4. 如何访问受保护接口。
5. Redis 黑名单说明。
6. 权限校验说明。
7. 日志与 Request ID 说明。
8. 本地启动：Uvicorn `--reload`。
9. 生产启动：Gunicorn + Uvicorn Worker。
10. Docker 说明。
11. GitHub Secrets 说明。

#### 安全原则

README 中必须明确：

1. 私钥只给 `python-main`。
2. `python-app` 只能拿公钥。
3. Access Token 不存 Redis。
4. Refresh Token 不明文存 Redis。
5. product 默认关闭公开 Swagger。
6. product 数据库迁移优先向前兼容。
7. 开发环境使用 Uvicorn，生产环境使用 Gunicorn + Uvicorn Worker。
8. 日志中不能记录 token、密码、密钥和 secrets。

### 交付物

- 两个模板都有完整 README。
- 新用户可以按 README 跑起来。
- 安全边界解释清楚。

---

## 推荐执行顺序

建议按下面顺序推进：

1. 阶段 0：模板范围确认与目录准备
2. 阶段 1：公共 FastAPI 工程骨架
3. 阶段 2：Swagger / OpenAPI 支持
4. 阶段 3：日志记录基础设施
5. 阶段 4：`python-main` 认证中心核心能力
6. 阶段 5：Redis Token 状态管理
7. 阶段 6：`python-app` 业务服务鉴权能力
8. 阶段 7：Alembic、Seed 与数据库策略
9. 阶段 8：Docker 与 Nginx
10. 阶段 9：GitHub Actions / Secrets / Environments
11. 阶段 10：测试覆盖与验收
12. 阶段 11：README 与模板使用文档

---

## 可并行任务

以下任务可以并行推进：

- `python-main` README 与 `python-app` README 初稿
- Dockerfile 与 Nginx 配置
- GitHub Actions 模板
- pytest 用例设计
- `.env.test.example` / `.env.product.example`
- Swagger schema 与 response schema 补充
- 日志格式和脱敏测试

---

## 第一批最小可交付 MVP

如果希望先快速落地，建议第一版只做这些：

1. 两个模板目录可生成。
2. 两个模板 FastAPI 可启动。
3. 使用 PDM 管理依赖、虚拟环境和项目脚本。
4. 开发环境使用 Uvicorn `--reload`，生产镜像使用 Gunicorn + Uvicorn Worker。
5. 两个模板支持基础日志和 `X-Request-ID`。
6. `python-main` 支持：
   - `/auth/login`
   - `/auth/me`
   - RS256 JWT 签发
7. `python-app` 支持：
   - Bearer Token 验证
   - `/api/profile`
8. Redis 支持 jti 黑名单读取。
9. test 环境 Swagger 开启。
10. pytest 覆盖登录、鉴权、黑名单和日志脱敏核心流程。

后续再补：

- refresh token rotation
- seed
- Docker / Nginx
- GitHub Actions
- product 部署保护
- 完整 README
