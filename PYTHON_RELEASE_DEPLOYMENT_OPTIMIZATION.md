# Python 模板发布部署优化方案

## 目标

`python-main` 和 `python-app` 后续发布链路希望向 `mfe-main` / `mfe-app` 对齐：

- 支持 `test-v*.*.*` / `product-v*.*.*` tag 发布。
- 支持 GitHub Actions 手动回退历史 `image_tag`。
- 发布和回退都基于不可变 Docker image tag，不使用 `latest`。
- `product` 环境也可以像 `test` 一样使用 Docker 运行 PostgreSQL / Redis。
- 但 `product` 的 PostgreSQL / Redis 不能跟随每次应用发布被重建或回退，应该作为长期运行的 Docker 基础设施独立维护。

核心原则：

> Python 应用镜像可以随版本发布和回退；PostgreSQL / Redis 数据基础设施也可以用 Docker，但生命周期应和应用发布流程解耦。

---

## 背景对比

### MFE 当前发布模型

`mfe-main` / `mfe-app` 已具备完整发布链路：

- tag 发布：
  - `test-v1.0.1` 发布到 `test`
  - `product-v1.0.1` 发布到 `product`
- workflow 手动回退：
  - `environment = test | product`
  - `image_tag = 历史镜像 tag`
- Docker image 使用不可变版本 tag。
- 服务器执行：
  - `docker compose pull`
  - `docker compose up -d --no-build`
- rollback 不重新构建，只拉取历史 image。

MFE 是静态前端资源容器，没有数据库迁移和持久化状态，所以回退相对简单。

### Python 发布的额外复杂点

`python-main` / `python-app` 是后端服务，除应用镜像外还涉及：

- PostgreSQL schema 和数据
- Redis session / blacklist 状态
- JWT 私钥 / 公钥
- Alembic migration
- seed 数据
- 服务之间的 token / scope / role 兼容性

因此 Python 的回退应该分成两层：

1. **应用镜像回退**：代码、依赖、启动逻辑回退到历史 Docker image。
2. **数据基础设施不自动回退**：PostgreSQL / Redis 不随应用 image rollback 自动回退。

---

## 推荐总体设计

建议为 `python-main` / `python-app` 增加三类部署产物：

```text
.github/workflows/deploy.yml       # tag 发布 + workflow_dispatch 回退
docker-compose.infra.yml           # product/test 可选 Docker 基础设施：PostgreSQL / Redis
docker-compose.deploy.yml          # 应用发布 compose：api + 可选 nginx
.env.deploy.example                # 远端应用运行时环境变量示例
```

同时保留当前本地开发文件：

```text
docker-compose.yml                 # 本地开发，一键启动 api/postgres/redis/nginx
.env.test.example
.env.product.example
```

推荐职责划分：

| 文件 | 用途 | 生命周期 |
|---|---|---|
| `docker-compose.yml` | 本地开发 / 临时 test 验证 | 可以频繁重建 |
| `docker-compose.infra.yml` | test/product 的 PostgreSQL / Redis Docker 基础设施 | 长期运行，少变更 |
| `docker-compose.deploy.yml` | test/product 的 Python API 应用发布 | 随版本发布和回退 |
| `.github/workflows/deploy.yml` | 自动构建、推送、部署、回退应用镜像 | 每次 tag / 手动触发 |
| `.env.deploy.example` | 远端部署环境变量模板 | 随应用模板生成 |

---

## Docker 环境模型

### 本地开发

本地继续使用当前 `docker-compose.yml`：

```text
api + postgres + redis + nginx
```

特点：

- 快速启动；
- 使用 `uvicorn --reload`；
- 可以挂载源码；
- 可以随时 `docker compose down -v` 重建；
- 适合开发和模板验证。

### test 环境

test 环境可以有两种模式。

#### 模式 A：一体化 Docker

适合临时测试服务器：

```text
api + postgres + redis + nginx
```

优点：简单。

缺点：如果部署脚本管理不严，应用发布可能影响数据库容器。

#### 模式 B：基础设施和应用拆分

推荐用于长期 test 环境：

```text
docker-compose.infra.yml   # postgres + redis
docker-compose.deploy.yml  # api + nginx
```

优点：test 更接近 product，回退行为也更真实。

### product 环境

product 希望也使用 Docker，可以使用：

```text
docker-compose.infra.yml   # product-postgres + product-redis，长期运行
docker-compose.deploy.yml  # product API 应用，随版本发布/回退
```

注意：这里的 PostgreSQL / Redis 仍然是 Docker 容器，但不是每次应用发布都重新创建的容器。

---

## 推荐 product Docker 拓扑

```text
product-backend network
├── product-postgres       # 长期运行
├── product-redis          # 长期运行
├── auth-service-api       # python-main，随版本发布/回退
├── business-service-api   # python-app，随版本发布/回退
└── nginx                  # 可选，反向代理 API
```

也可以每个服务独立部署：

```text
python-main deploy path
├── docker-compose.infra.yml
├── docker-compose.deploy.yml
├── nginx/default.conf
└── .env

python-app deploy path
├── docker-compose.deploy.yml
├── nginx/default.conf
└── .env
```

如果 `python-main` 和 `python-app` 共用同一个 PostgreSQL / Redis，需要统一 network 和连接地址。

---

## `docker-compose.infra.yml` 建议

用于长期运行 PostgreSQL / Redis。

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: ${POSTGRES_CONTAINER_NAME:-product-postgres}
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-app}
      POSTGRES_USER: ${POSTGRES_USER:-app_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    networks:
      - backend
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: ${REDIS_CONTAINER_NAME:-product-redis}
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "${REDIS_PORT:-6379}:6379"
    networks:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  backend:
    name: ${DOCKER_NETWORK_NAME:-product-backend}
```

启动基础设施：

```bash
docker compose --env-file .env.infra -f docker-compose.infra.yml up -d
```

查看状态：

```bash
docker compose --env-file .env.infra -f docker-compose.infra.yml ps
```

停止基础设施时不要默认删除 volume：

```bash
docker compose --env-file .env.infra -f docker-compose.infra.yml down
```

高危命令，product 环境禁止随意执行：

```bash
docker compose --env-file .env.infra -f docker-compose.infra.yml down -v
```

---

## `docker-compose.deploy.yml` 建议

用于应用发布和回退。

```yaml
services:
  api:
    image: ${DOCKER_IMAGE_NAME}:${APP_VERSION}
    container_name: ${CONTAINER_NAME}
    env_file:
      - .env
    ports:
      - "${APP_PORT:-8000}:8000"
    networks:
      - backend
    restart: unless-stopped
    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
        ]
      interval: 30s
      timeout: 5s
      retries: 3

  nginx:
    image: nginx:1.27-alpine
    container_name: ${NGINX_CONTAINER_NAME:-${CONTAINER_NAME}-nginx}
    ports:
      - "${NGINX_PORT:-8080}:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - api
    networks:
      - backend
    restart: unless-stopped

networks:
  backend:
    external: true
    name: ${DOCKER_NETWORK_NAME:-product-backend}
```

发布或回退时只更新应用服务：

```bash
docker compose --env-file .env -f docker-compose.deploy.yml pull api
docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-build api nginx
```

---

## `.env.deploy.example` 建议

### 通用字段

```env
# Docker image
DOCKER_IMAGE_NAME=ghcr.io/owner/service-name
APP_VERSION=local
CONTAINER_NAME=service-name

# Runtime
APP_ENV=product
APP_PORT=8000
NGINX_PORT=8080
DOCKER_NETWORK_NAME=product-backend

# Infrastructure connection
DATABASE_URL=postgresql+psycopg://app_user:change-me@product-postgres:5432/app
REDIS_URL=redis://product-redis:6379/0

# JWT common config
JWT_ISSUER=tsu-auth
JWT_AUDIENCE=tsu-services
ACCESS_TOKEN_EXPIRE_MINUTES=15
```

### `python-main` 额外字段

```env
JWT_PRIVATE_KEY=replace-with-product-private-key
JWT_PUBLIC_KEY=replace-with-product-public-key
REFRESH_TOKEN_EXPIRE_DAYS=30
REFRESH_TOKEN_REUSE_GRACE_SECONDS=30
```

### `python-app` 额外字段

```env
JWT_PUBLIC_KEY=replace-with-product-public-key
SESSION_PREFIX=session:
BLACKLIST_PREFIX=blacklist:
```

约束：

- `python-main` 可以持有 `JWT_PRIVATE_KEY`。
- `python-app` 不应该持有 `JWT_PRIVATE_KEY`。
- `python-app` 只需要 `JWT_PUBLIC_KEY` 验签。

---

## GitHub Environment 配置建议

为每个生成项目配置两个 GitHub Environments：

```text
test
product
```

### Variables

| 名称 | 说明 |
|---|---|
| `DOCKER_REGISTRY` | 镜像仓库，例如 `ghcr.io` |
| `DOCKER_IMAGE_NAME` | 完整镜像名，例如 `ghcr.io/owner/auth-service` |
| `DOCKER_REGISTRY_USERNAME` | registry 用户名 |
| `DEPLOY_HOST` | 远端服务器地址 |
| `DEPLOY_PORT` | SSH 端口 |
| `DEPLOY_USER` | SSH 用户 |
| `DEPLOY_PATH` | 远端部署目录 |
| `CONTAINER_NAME` | API 容器名 |
| `APP_PORT` | API 暴露端口 |
| `NGINX_PORT` | nginx 暴露端口 |
| `APP_ENV` | `test` 或 `product` |
| `DOCKER_NETWORK_NAME` | Docker 网络名 |
| `JWT_ISSUER` | JWT issuer |
| `JWT_AUDIENCE` | JWT audience |

### Secrets

| 名称 | 说明 |
|---|---|
| `DOCKER_REGISTRY_TOKEN` | 推送/拉取镜像 token |
| `SSH_PRIVATE_KEY` | SSH 部署私钥 |
| `SSH_KNOWN_HOSTS` | 可选，固定服务器 host key |
| `DATABASE_URL` | 数据库连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_PUBLIC_KEY` | JWT 公钥 |
| `JWT_PRIVATE_KEY` | 仅 `python-main` 需要 |

建议：

- `product` Environment 开启 protection rules。
- `product` 发布和 migration 需要人工 approval。
- `DATABASE_URL` / `REDIS_URL` 放 Secrets，不放 Variables。

---

## Deploy workflow 建议

`.github/workflows/deploy.yml` 对齐 MFE：

```yaml
name: Deploy

on:
  push:
    tags:
      - "test-v*.*.*"
      - "product-v*.*.*"
  workflow_dispatch:
    inputs:
      environment:
        description: Deployment environment for rollback
        required: true
        type: choice
        options:
          - test
          - product
      image_tag:
        description: Historical immutable image tag to deploy, for example product-v1.0.1
        required: true
        type: string
```

核心步骤：

1. 解析 tag：
   - `test-v*.*.*` -> `test`
   - `product-v*.*.*` -> `product`
2. 禁止 `latest`。
3. 禁止跨环境部署：
   - `test` 不能部署 `product-v...`
   - `product` 不能部署 `test-v...`
4. tag 发布时构建并推送 Docker image。
5. rollback 时跳过 build，只部署历史 image。
6. 自动上传：
   - `docker-compose.deploy.yml`
   - `nginx/default.conf`
   - 生成的远端 `.env`
7. SSH 执行：
   - `docker compose pull api`
   - `docker compose up -d --no-build api nginx`
8. 可选 health check：
   - 请求 `/health`

---

## 回退模型

### 正常发布

```bash
git tag test-v1.0.1
git push origin test-v1.0.1
```

发布 test。

```bash
git tag product-v1.0.1
git push origin product-v1.0.1
```

发布 product。

### 回退

GitHub Actions -> Deploy -> Run workflow：

```text
environment = product
image_tag = product-v1.0.0
```

workflow 行为：

- 不重新构建；
- 不重新推送；
- 拉取历史镜像；
- 重启 API / nginx；
- PostgreSQL / Redis 不回退、不重建。

---

## Migration 策略

Python 和 MFE 最大不同是数据库迁移。

### 短期策略

不建议 product 发布时默认自动执行 migration。

推荐：

| 环境 | migration 策略 |
|---|---|
| local | 手动 `pdm run migrate` |
| test | 可以手动或可选自动执行 |
| product | 默认不自动执行，需要人工审批 |

原因：

- image rollback 不能自动回退 schema；
- destructive migration 可能导致旧代码无法运行；
- product 数据需要备份和审批。

### 独立 migration workflow

后续可新增：

```text
.github/workflows/migrate.yml
```

手动触发：

```text
environment = test | product
revision = head | <revision_id>
```

执行：

```bash
docker compose --env-file .env -f docker-compose.deploy.yml run --rm api alembic upgrade head
```

product migration 应启用 GitHub Environment approval。

### 长期策略：expand-contract

为了支持可靠回退，数据库变更建议遵循：

1. **Expand**：只新增字段、表、索引，不删除旧字段。
2. **Switch**：代码开始读写新结构，同时兼容旧结构。
3. **Contract**：稳定后再删除旧字段或旧逻辑。

这样即使应用镜像回退，旧代码仍有机会兼容当前 schema。

---

## Seed 策略

`python-main` / `python-app` 都有 seed 逻辑，但 product 不应该自动 seed。

建议：

| 环境 | seed 策略 |
|---|---|
| local | 可以执行 `pdm run seed` |
| test | 可以手动 seed |
| product | 默认不自动 seed |

product 如需初始化数据，应该：

- 通过单独人工步骤执行；
- 保证 seed idempotent；
- 执行前确认不会覆盖真实数据。

---

## python-main / python-app 差异

### python-main

职责：认证中心。

部署关注点：

- 持有 `JWT_PRIVATE_KEY` 和 `JWT_PUBLIC_KEY`；
- 负责 login / refresh / logout / me；
- 写 session / refresh token / blacklist；
- migration 涉及用户、角色、权限、session 等表；
- product 发布更需要谨慎处理 token 兼容性。

### python-app

职责：业务服务。

部署关注点：

- 只持有 `JWT_PUBLIC_KEY`；
- 校验 `python-main` 签发的 access token；
- 读取 Redis session / blacklist 状态；
- migration 主要影响业务表；
- 需要和 `python-main` 的 JWT issuer/audience/scope 保持一致。

---

## 模板实现建议

建议新增模板源码文件：

```text
template/src/python-deploy.ts
```

提供 helper：

```ts
createPythonDockerComposeDeploy()
createPythonDockerComposeInfra()
createPythonDeployEnvExample()
createPythonDeployWorkflow()
createPythonDeployReadmeSection()
```

然后在：

```text
template/src/python.ts
```

中为 `python-main` / `python-app` 注入这些文件。

---

## 验证建议

模板测试应新增断言：

- 生成 `.github/workflows/deploy.yml`
- 生成 `docker-compose.deploy.yml`
- 生成 `docker-compose.infra.yml`
- 生成 `.env.deploy.example`
- workflow 包含：
  - `test-v*.*.*`
  - `product-v*.*.*`
  - `workflow_dispatch`
  - `image_tag`
  - `docker build`
  - `docker push`
  - `docker compose pull api`
  - `docker compose up -d --no-build api`
  - `Refusing to deploy a latest tag`
- README 包含：
  - GitHub Environments
  - tag release
  - rollback
  - Docker infra
  - migration policy
  - product 不自动 seed
  - `python-main` 的 `JWT_PRIVATE_KEY`
  - `python-app` 只使用 `JWT_PUBLIC_KEY`

release archive validation 也应覆盖这些 marker。

---

## 难度评估

### 第一阶段：发布链路对齐 MFE

难度：中等。

预计工作量：1-2 天。

内容：

- deploy workflow
- deploy compose
- infra compose
- env example
- README
- 模板测试和 release marker

### 第二阶段：独立 migration workflow

难度：中高。

预计工作量：2-4 天。

内容：

- `migrate.yml`
- product approval
- revision 参数
- migration 前检查
- 文档补齐

### 第三阶段：生产增强

难度：高。

预计工作量：1 周以上。

内容：

- deploy 后 health check
- smoke test
- 数据备份建议
- 多服务联动发布
- 日志/监控建议
- rollback playbook

---

## 推荐落地顺序

### Step 1：先完成 deploy/rollback

先让 `python-main` / `python-app` 和 MFE 一样支持：

```bash
git tag test-v1.0.1
git push origin test-v1.0.1
```

```bash
git tag product-v1.0.1
git push origin product-v1.0.1
```

以及手动 rollback：

```text
environment = product
image_tag = product-v1.0.0
```

### Step 2：product Docker infra 独立化

让 product 也能用 Docker 跑 PostgreSQL / Redis，但通过 `docker-compose.infra.yml` 独立维护。

### Step 3：补 migration workflow

在第一版稳定后，再做单独 migration workflow。

### Step 4：生产增强

最后补 health check、smoke test、备份和多服务发布说明。

---

## 结论

建议 Python 模板对齐 MFE 的发布体验，但不要把数据库/Redis 和应用发布强绑定。

最终目标：

```text
应用层：像 MFE 一样 tag 发布、image 回退。
数据层：也可以用 Docker，但作为长期运行 infra 独立维护。
迁移层：独立审批，避免 product 自动 destructive migration。
```

这样既满足 product 也能 Docker 化，又能避免应用回退时误伤 PostgreSQL / Redis 数据。