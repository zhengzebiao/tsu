# Python 后端模板方案：python-main 与 python-app

> 生成日期：2026-06-29  
> 目标：新增 `python-main` 与 `python-app` 两个联动后端模板，提供 FastAPI + PostgreSQL + Alembic + Redis + JWT + Docker + Nginx + GitHub CI/CD 的标准工程基础。

## 1. 方案定位

新增两个模板：

| 模板 | 定位 | 核心职责 |
| --- | --- | --- |
| `python-main` | 认证主服务 / Auth Service | 登录、签发 JWT、刷新 Token、注销、写入黑名单、管理会话 |
| `python-app` | 业务 API 服务 / Resource Service | 校验 JWT、读取 Redis 黑名单、处理业务 API，不签发 Token |

整体架构：

```text
用户 / 前端
   |
   | 登录、刷新、注销
   v
python-main
   |
   | 签发 Access Token
   | 管理 Refresh Token / Session / Blacklist
   v
Redis + PostgreSQL

用户 / 前端
   |
   | Authorization: Bearer <access_token>
   v
python-app
   |
   | 校验 JWT 签名
   | 校验 jti 黑名单
   | 校验权限
   v
业务接口
```

## 2. 技术栈

两个模板统一采用：

- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- Seed 数据
- Pydantic
- pytest
- Redis
- Docker
- Nginx
- GitHub Actions / GitHub Secrets / GitHub Environments

运行环境固定为两套：

```text
test
product
```

## 3. 认证与 Token 方案

### 3.1 JWT 签名方式

JWT 使用 **RS256**。

准确说，RS256 是 JWT 签名算法，不是加密算法。JWT 内容默认可以被解码查看，但不能被篡改。

职责划分：

| 服务 | 持有私钥 | 持有公钥 | 能否签发 Token | 能否验证 Token |
| --- | ---: | ---: | ---: | ---: |
| `python-main` | 是 | 是 | 是 | 是 |
| `python-app` | 否 | 是 | 否 | 是 |

也就是：

```text
python-main 用私钥签发 JWT
python-app 用公钥验证 JWT
```

这样可以保证：

- 只有 `python-main` 能签发 token
- `python-app` 即使拿到公钥，也不能伪造 token
- 服务边界清晰
- 适合后续扩展更多业务服务

### 3.2 公钥私钥存储方式

公钥私钥存放在环境变量中。

`python-main`：

```env
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

`python-app`：

```env
JWT_ALGORITHM=RS256
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

注意：

- `python-main` 才能读取 `JWT_PRIVATE_KEY`
- `python-app` 只能读取 `JWT_PUBLIC_KEY`
- test 和 product 必须使用不同 RSA key
- 环境变量建议放 GitHub Secrets，不写进代码仓库
- 多行 key 在 GitHub Secrets 里可以用原始多行，也可以用 `\n` 转义，模板代码需要兼容解析

## 4. JWT Payload 设计

Access Token payload 建议包含：

```json
{
  "sub": "user_123",
  "iss": "auth-service",
  "aud": "backend-api",
  "iat": 1710000000,
  "exp": 1710001800,
  "jti": "6f5c87d0-31ad-4a9e-9134-0a7c0c7f91a1",
  "sid": "sess_abc",
  "roles": ["admin"],
  "scope": "user:read order:write"
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `sub` | 用户 ID |
| `iss` | 签发方 |
| `aud` | token 目标服务 |
| `iat` | 签发时间 |
| `exp` | 过期时间 |
| `jti` | token 唯一 ID，用于 Redis 黑名单 |
| `sid` | 会话 ID，用于会话管理 |
| `roles` | 用户角色 |
| `scope` | 权限范围 |

## 5. Audience 设计

当前确认 audience 只有一个服务，因此模板默认不需要做多 audience 设计。

推荐配置：

### test 环境

```env
JWT_ISSUER=auth-service-test
JWT_AUDIENCE=backend-api-test
```

### product 环境

```env
JWT_ISSUER=auth-service
JWT_AUDIENCE=backend-api
```

不要默认写死成：

```env
JWT_AUDIENCE=python-app
```

因为 `python-app` 是模板名，不一定是生成后的真实服务名。

推荐统一使用：

```env
JWT_AUDIENCE=backend-api
```

含义是：这个 token 是签发给后端 API 服务使用的。

## 6. Redis 使用方案

Token 存放在 Redis 指的是 Refresh Token / 会话状态 / 黑名单放 Redis，不是把 Access Token 本体存入 Redis。

Redis 中建议存三类数据：

1. Refresh Token
2. Session 状态
3. Access Token 黑名单

不建议存完整 access token。

### 6.1 Redis Key 设计

建议统一加环境前缀，避免 test 和 product 混用。

### test

```text
auth:test:blacklist:jti:<jti>
auth:test:refresh:<refresh_token_hash>
auth:test:session:<sid>
auth:test:user:sessions:<user_id>
```

### product

```text
auth:product:blacklist:jti:<jti>
auth:product:refresh:<refresh_token_hash>
auth:product:session:<sid>
auth:product:user:sessions:<user_id>
```

### 6.2 黑名单使用 jti

Redis 黑名单使用 `jti`。

具体流程：

#### 签发 Access Token 时

`python-main` 生成唯一 `jti`：

```text
jti = uuid
```

写入 JWT payload。

#### 注销 / 吊销 Token 时

`python-main` 写 Redis：

```text
auth:product:blacklist:jti:<jti> = 1
TTL = access token 剩余有效期
```

#### 校验 Token 时

`python-main` 和 `python-app` 都可以读黑名单：

```text
EXISTS auth:product:blacklist:jti:<jti>
```

如果存在，返回：

```http
401 Unauthorized
```

### 6.3 黑名单共享状态

黑名单是 `python-app` 和 `python-main` 都要读的共享状态。

职责建议：

| 服务 | 读黑名单 | 写黑名单 |
| --- | ---: | ---: |
| `python-main` | 是 | 是 |
| `python-app` | 是 | 否 |

`python-main` 读黑名单用于：

- logout 前检查 token 是否已经失效
- 获取当前用户时校验 token 状态
- 管理后台强制下线时校验状态

`python-app` 读黑名单用于：

- 每次业务接口鉴权时拒绝已注销 / 已吊销 token

## 7. Refresh Token 方案

Refresh Token 采用 **被动刷新 + 单飞锁**。

### 7.1 被动刷新

流程：

```text
前端请求 python-app
   |
   v
Access Token 过期
   |
   v
python-app 返回 401
   |
   v
前端请求 python-main /auth/refresh
   |
   v
python-main 返回新的 Access Token
   |
   v
前端重试原请求
```

优点：

- 实现简单
- 不需要前端定时器
- 不需要前端精确计算 token 过期时间

### 7.2 单飞锁

如果多个请求同时遇到 401，前端不能同时发多个 refresh 请求。

应该这样：

```text
第一个 401 触发 refresh
其他请求等待同一个 refresh Promise
refresh 成功后，所有请求统一重试
```

避免：

- 多次刷新导致 refresh token 被重复使用
- refresh token rotation 误判为 token 泄露
- 用户被异常踢出

### 7.3 Refresh Token Rotation

如果旧 refresh token 被再次使用，采用 **refresh token 轮换 + 短暂重试窗口**。

推荐策略：

```env
REFRESH_TOKEN_ROTATE=true
REFRESH_TOKEN_REUSE_GRACE_SECONDS=10
```

流程：

```text
refresh_token_A
   |
   | /auth/refresh
   v
校验成功
   |
   v
标记 refresh_token_A 已使用
生成 refresh_token_B
返回新的 access_token + refresh_token_B
```

如果 `refresh_token_A` 再次被使用：

- 如果在 10 秒宽限期内：允许或返回当前新 token 状态
- 如果超过宽限期：认为存在泄露风险，吊销当前 session

### 7.4 Refresh Token Redis 存储

Refresh Token 不建议明文存储。

建议存 hash：

```text
auth:product:refresh:<sha256(refresh_token)>
```

value 示例：

```json
{
  "user_id": "user_123",
  "sid": "sess_abc",
  "status": "active",
  "created_at": "2026-06-29T10:00:00Z",
  "expires_at": "2026-07-29T10:00:00Z",
  "rotated_at": null,
  "replaced_by": null
}
```

## 8. python-main 接口设计

建议模板默认提供以下接口，并且全部接入 FastAPI 自动生成的 Swagger / OpenAPI 文档。

### 8.1 Swagger / OpenAPI 支持

`python-main` 和 `python-app` 都需要支持接口文档：

| 环境 | Swagger UI | ReDoc | OpenAPI JSON | 建议 |
| --- | --- | --- | --- | --- |
| `test` | 开启 | 开启 | 开启 | 方便联调、验收和接口测试 |
| `product` | 默认关闭或加鉴权 | 默认关闭或加鉴权 | 可关闭或只允许内网访问 | 避免公开暴露接口结构 |

推荐配置项：

```env
OPENAPI_ENABLED=true
DOCS_ENABLED=true
REDOC_ENABLED=true
```

FastAPI 文档路径建议保持默认语义：

```text
/docs          Swagger UI
/redoc         ReDoc
/openapi.json  OpenAPI schema
```

在 `product` 环境中建议：

- 默认关闭公开 Swagger：`DOCS_ENABLED=false`
- 如确需开启，必须加访问控制，例如 Basic Auth、网关鉴权、IP 白名单或内网访问限制
- OpenAPI JSON 不应对公网匿名开放

### 8.2 登录

```http
POST /auth/login
```

Swagger 文档要求：

- 标注接口说明：用户登录并签发 access token / refresh token
- 标注 request body schema
- 标注 response schema
- 标注 401 错误响应
- 不需要 Bearer 鉴权

请求示例：

```json
{
  "username": "admin@example.com",
  "password": "password"
}
```

响应示例：

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<refresh_token>",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

职责：

- 校验账号密码
- 创建 session
- 生成 access token
- 生成 refresh token
- 保存 refresh token hash 到 Redis
- 返回 token

### 8.3 刷新

```http
POST /auth/refresh
```

Swagger 文档要求：

- 标注接口说明：使用 refresh token 被动刷新 access token
- 标注 request body schema 或 Cookie 参数，按模板最终实现选择其一
- 标注 response schema
- 标注 401 错误响应
- 不需要 Bearer 鉴权

请求示例：

```json
{
  "refresh_token": "<refresh_token>"
}
```

响应示例：

```json
{
  "access_token": "<new_jwt>",
  "refresh_token": "<new_refresh_token>",
  "token_type": "Bearer",
  "expires_in": 1800
}
```

职责：

- 校验 refresh token
- 判断是否过期
- 判断是否 revoked
- 判断是否重复使用
- 执行 refresh token rotation
- 签发新的 access token
- 返回新的 token

### 8.4 注销

```http
POST /auth/logout
Authorization: Bearer <access_token>
```

Swagger 文档要求：

- 标注接口说明：注销当前会话并将当前 access token 的 `jti` 写入 Redis 黑名单
- 声明 Bearer Auth 安全方案
- 标注 401 错误响应
- 标注成功响应 schema

响应示例：

```json
{
  "message": "logged out"
}
```

职责：

- 校验 access token
- 读取 `jti`
- 将 `jti` 写入 Redis 黑名单
- 吊销当前 refresh token / session
- 返回注销成功

### 8.5 当前用户

```http
GET /auth/me
Authorization: Bearer <access_token>
```

Swagger 文档要求：

- 标注接口说明：返回当前登录用户信息
- 声明 Bearer Auth 安全方案
- 标注 response schema
- 标注 401 错误响应

响应示例：

```json
{
  "id": "user_123",
  "username": "admin@example.com",
  "roles": ["admin"]
}
```

职责：

- 校验 token
- 查 Redis 黑名单
- 返回当前用户信息

## 9. python-app 鉴权设计

`python-app` 不提供登录、刷新、注销能力。

它只做：

```text
读取 Authorization Bearer Token
校验 RS256 签名
校验 iss
校验 aud
校验 exp
校验 jti 是否在 Redis 黑名单
校验 roles / scope
放行业务接口
```

### 9.1 Swagger / OpenAPI 支持

`python-app` 的业务接口也需要接入 Swagger / OpenAPI 文档。

Swagger 文档要求：

- 受保护接口必须声明 Bearer Auth 安全方案
- 每个接口必须声明 request schema、response schema 和错误响应
- 示例接口需要展示如何携带 `Authorization: Bearer <access_token>`
- `test` 环境默认开启 `/docs`、`/redoc`、`/openapi.json`
- `product` 环境默认关闭公开文档，或通过网关鉴权、Basic Auth、IP 白名单、内网访问等方式限制访问

### 9.2 示例业务接口

```http
GET /api/profile
Authorization: Bearer <access_token>
```

Swagger 文档要求：

- 标注接口说明：返回当前 token 对应的业务用户资料
- 声明 Bearer Auth 安全方案
- 标注 200 响应 schema
- 标注 401 / 403 错误响应

如果 token 有效：

```json
{
  "user_id": "user_123",
  "message": "authorized"
}
```

如果 token 被拉黑：

```http
401 Unauthorized
```

## 10. Alembic 迁移与 downgrade 策略

Alembic `downgrade` 用于回退数据库迁移版本，但生产环境中的数据库回滚可能造成数据丢失。默认推荐使用向前兼容迁移，并把 `downgrade` 作为开发和预发布环境的回退手段。

推荐命令：

```bash
# 查看当前数据库版本
alembic current

# 升级到最新版本
alembic upgrade head

# 回退一步
alembic downgrade -1

# 回退到指定版本
alembic downgrade <revision_id>
```

生产原则：

1. 应用镜像可以快速回滚
2. 数据库迁移采用向前兼容
3. 生产问题优先通过新 migration 修复
4. downgrade 主要用于 test 环境、开发调试和预发布验证

## 11. test / product 环境配置

只有两套环境：

```text
test
product
```

因此模板建议生成：

```text
.env.test.example
.env.product.example
```

两个模板都应该有。

### 11.1 python-main test 示例

```env
APP_ENV=test
DEBUG=true
LOG_LEVEL=debug

SERVICE_NAME=auth-service
API_PREFIX=/api

DATABASE_URL=postgresql+psycopg://test_user:test_password@test-postgres:5432/test_auth
DB_SSLMODE=disable

REDIS_URL=redis://test-redis:6379/0
REDIS_KEY_PREFIX=auth:test:

JWT_ALGORITHM=RS256
JWT_ISSUER=auth-service-test
JWT_AUDIENCE=backend-api-test
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
REFRESH_TOKEN_ROTATE=true
REFRESH_TOKEN_REUSE_GRACE_SECONDS=10

TOKEN_BLACKLIST_PREFIX=auth:test:blacklist:jti:
REFRESH_TOKEN_PREFIX=auth:test:refresh:
SESSION_PREFIX=auth:test:session:

CORS_ALLOW_ORIGINS=https://test.example.com,http://localhost:5173
CORS_ALLOW_CREDENTIALS=true

COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=Lax
COOKIE_PATH=/auth/refresh

OPENAPI_ENABLED=true
DOCS_ENABLED=true
REDOC_ENABLED=true
```

### 11.2 python-main product 示例

```env
APP_ENV=product
DEBUG=false
LOG_LEVEL=info

SERVICE_NAME=auth-service
API_PREFIX=/api

DATABASE_URL=postgresql+psycopg://product_user:strong_password@product-postgres:5432/product_auth
DB_SSLMODE=require

REDIS_URL=rediss://product-redis:6379/0
REDIS_KEY_PREFIX=auth:product:

JWT_ALGORITHM=RS256
JWT_ISSUER=auth-service
JWT_AUDIENCE=backend-api
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_TOKEN_ROTATE=true
REFRESH_TOKEN_REUSE_GRACE_SECONDS=10

TOKEN_BLACKLIST_PREFIX=auth:product:blacklist:jti:
REFRESH_TOKEN_PREFIX=auth:product:refresh:
SESSION_PREFIX=auth:product:session:

CORS_ALLOW_ORIGINS=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=true

COOKIE_SECURE=true
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=Lax
COOKIE_PATH=/auth/refresh

OPENAPI_ENABLED=false
DOCS_ENABLED=false
REDOC_ENABLED=false
```

### 11.3 python-app test 示例

```env
APP_ENV=test
DEBUG=true
LOG_LEVEL=debug

SERVICE_NAME=backend-api
API_PREFIX=/api

DATABASE_URL=postgresql+psycopg://test_user:test_password@test-postgres:5432/test_app
DB_SSLMODE=disable

REDIS_URL=redis://test-redis:6379/0
REDIS_KEY_PREFIX=auth:test:

JWT_ALGORITHM=RS256
JWT_ISSUER=auth-service-test
JWT_AUDIENCE=backend-api-test
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

TOKEN_BLACKLIST_PREFIX=auth:test:blacklist:jti:

CORS_ALLOW_ORIGINS=https://test.example.com,http://localhost:5173
CORS_ALLOW_CREDENTIALS=true

OPENAPI_ENABLED=true
DOCS_ENABLED=true
REDOC_ENABLED=true
```

### 11.4 python-app product 示例

```env
APP_ENV=product
DEBUG=false
LOG_LEVEL=info

SERVICE_NAME=backend-api
API_PREFIX=/api

DATABASE_URL=postgresql+psycopg://product_user:strong_password@product-postgres:5432/product_app
DB_SSLMODE=require

REDIS_URL=rediss://product-redis:6379/0
REDIS_KEY_PREFIX=auth:product:

JWT_ALGORITHM=RS256
JWT_ISSUER=auth-service
JWT_AUDIENCE=backend-api
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"

TOKEN_BLACKLIST_PREFIX=auth:product:blacklist:jti:

CORS_ALLOW_ORIGINS=https://app.example.com,https://admin.example.com
CORS_ALLOW_CREDENTIALS=true

OPENAPI_ENABLED=false
DOCS_ENABLED=false
REDOC_ENABLED=false
```

## 12. Docker / Nginx / 回滚方案

### 12.1 Docker 镜像版本化

不要只用：

```text
latest
```

建议使用：

```text
service-name:test-<git-sha>
service-name:product-<version>
service-name:product-<git-sha>
```

示例：

```text
auth-service:test-a1b2c3d
auth-service:product-v1.2.0
auth-service:product-a1b2c3d
backend-api:product-v1.2.0
```

### 12.2 回滚方式

应用回滚：

```bash
docker pull registry.example.com/auth-service:product-v1.1.9
docker compose up -d auth-service
```

注意：应用镜像回滚简单，但数据库 migration 回滚不一定安全。

因此模板 README 需要明确：

- Docker 支持版本 tag 回滚
- Alembic downgrade 不作为 product 默认回滚手段
- product 数据库变更要使用向前兼容策略

### 12.3 Nginx 职责

Nginx 用于：

- 反向代理 FastAPI
- 设置安全响应头
- 限制请求体大小
- 统一健康检查入口
- 可选 TLS 终止

建议默认安全头：

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;
```

product 如果由 Nginx 负责 HTTPS，可以增加：

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 13. GitHub 配置方案

用到的配置都配置在 GitHub。

建议使用 GitHub Environments：

```text
test
product
```

分别配置不同 secrets。

### 13.1 test secrets

```text
TEST_DATABASE_URL
TEST_REDIS_URL
TEST_JWT_PRIVATE_KEY
TEST_JWT_PUBLIC_KEY
TEST_CORS_ALLOW_ORIGINS
TEST_DOCKER_REGISTRY_TOKEN
```

### 13.2 product secrets

```text
PRODUCT_DATABASE_URL
PRODUCT_REDIS_URL
PRODUCT_JWT_PRIVATE_KEY
PRODUCT_JWT_PUBLIC_KEY
PRODUCT_CORS_ALLOW_ORIGINS
PRODUCT_DOCKER_REGISTRY_TOKEN
```

### 13.3 product 保护规则

product 环境建议启用：

- 需要人工审批
- 只允许 master / release tag 部署
- 限制谁可以触发 product deploy
- product secrets 只允许 product job 读取

## 14. Seed 数据方案

两个模板都可以内置 seed。

### 14.1 python-main seed

适合初始化：

- 默认管理员
- 默认角色
- 默认权限
- 默认客户端配置

示例命令：

```bash
python -m app.seed
```

要求：

- 幂等
- 可重复执行
- 不覆盖 product 已修改数据
- product 默认不自动 seed

### 14.2 python-app seed

适合初始化：

- 示例业务数据
- 默认配置项
- 测试数据

test 环境可以自动 seed。  
product 环境建议手动执行，并需要明确确认。

## 15. 模板生成内容建议

### 15.1 python-main 目录结构

```text
python-main/
  app/
    api/
      auth.py
      health.py
    core/
      config.py
      security.py
      redis.py
      database.py
    models/
      user.py
      role.py
      session.py
    schemas/
      auth.py
      user.py
    services/
      auth_service.py
      token_service.py
      refresh_token_service.py
      blacklist_service.py
    seed/
      seed_admin.py
    main.py
  alembic/
  tests/
  nginx/
  Dockerfile
  docker-compose.yml
  .env.test.example
  .env.product.example
  README.md
```

### 15.2 python-app 目录结构

```text
python-app/
  app/
    api/
      health.py
      example.py
    core/
      config.py
      security.py
      redis.py
      database.py
    deps/
      auth.py
    models/
    schemas/
    services/
    main.py
  alembic/
  tests/
  nginx/
  Dockerfile
  docker-compose.yml
  .env.test.example
  .env.product.example
  README.md
```

## 16. 优化点汇总

### 16.1 明确 Access Token 不存 Redis

优化前容易误解为所有 token 都存 Redis。  
优化后明确为：

```text
Access Token 不存 Redis
Refresh Token / Session / Blacklist 存 Redis
```

好处：

- 保留 JWT 无状态优势
- Redis 只承载可撤销状态
- 性能和存储成本更合理

### 16.2 黑名单统一使用 jti

优化点：

```text
blacklist:jti:<jti>
```

而不是存整串 JWT。

好处：

- Redis key 更短
- 不暴露完整 token
- 更利于排查和审计
- TTL 更容易控制

### 16.3 明确黑名单是共享状态

优化后：

- `python-main` 写黑名单
- `python-main` 读黑名单
- `python-app` 读黑名单

好处：

- 注销后所有服务立即生效
- 认证主服务和业务服务状态一致
- 支持未来强制下线、风险冻结等场景

### 16.4 RS256 职责边界更清晰

优化后：

- `python-main` 有私钥
- `python-app` 只有公钥

好处：

- 业务服务不能伪造 token
- 降低密钥泄露影响面
- 更适合多服务扩展
- 后续可平滑升级到 JWKS

### 16.5 公钥私钥通过环境变量管理

优化点：

- 不落代码仓库
- 不放模板文件
- 通过 GitHub Secrets 注入

好处：

- 更符合 CI/CD 管理方式
- test/product 可完全隔离
- 方便后续密钥轮换

### 16.6 Refresh Token 策略更完整

优化后采用：

```text
被动刷新 + 单飞锁 + refresh token rotation + 短暂重试窗口
```

好处：

- 前端实现简单
- 避免并发刷新问题
- 支持 refresh token 泄露检测
- 减少误踢用户

### 16.7 明确 audience 只有一个服务

优化前可能设计成多 audience。  
现在简化为：

```env
JWT_AUDIENCE=backend-api
```

test：

```env
JWT_AUDIENCE=backend-api-test
```

product：

```env
JWT_AUDIENCE=backend-api
```

好处：

- 模板更简单
- 用户更容易理解
- 仍然保留环境隔离能力

### 16.8 test / product 完全隔离

优化后明确：

- 不同数据库
- 不同 Redis
- 不同 JWT key
- 不同 issuer
- 不同 audience
- 不同 Redis key prefix
- 不同 GitHub Environment Secrets

好处：

- test token 不能访问 product
- test Redis 不会污染 product
- test 数据库不会误操作 product
- product 部署权限可控

### 16.9 Alembic downgrade 定位更安全

优化后明确：

```text
downgrade 主要用于 test / 开发 / 预发布
product 默认推荐向前兼容迁移
```

好处：

- 避免误以为数据库可以随便回滚
- 降低生产数据丢失风险
- 和 Docker 镜像回滚策略区分清楚

### 16.10 Docker 回滚方案更明确

优化后要求：

- 镜像不可变
- 镜像带版本 tag
- 回滚时重新部署旧 tag
- 不依赖 `latest`

好处：

- 可追踪
- 可审计
- 可快速回滚
- 符合 CI/CD 发布规范

## 17. 最终推荐方案总结

这两个模板最终可以定义为：

> `python-main` 是认证中心，负责登录、签发 RS256 JWT、Refresh Token Rotation、Session 管理和 Redis 黑名单写入；`python-app` 是业务 API 服务，只负责用公钥验证 JWT、读取 Redis 黑名单和执行业务逻辑。Refresh Token、Session、Blacklist 存 Redis，Access Token 不存 Redis。运行环境固定为 test / product，两套环境的数据库、Redis、JWT key、issuer、audience 和 GitHub Secrets 完全隔离。生产回滚优先回滚 Docker 镜像，数据库迁移采用向前兼容策略，Alembic downgrade 主要用于开发和测试环境。
