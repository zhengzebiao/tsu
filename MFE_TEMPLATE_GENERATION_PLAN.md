# 微前端模板生成方案

## 1. 目标

在现有模板库中新增两个 React 微前端模板：

- `mfe-main`：qiankun 主应用 / 基座
- `mfe-app`：qiankun 子应用 / 业务应用

统一技术栈如下：

- React + TypeScript
- Vite
- qiankun
- Vitest（单元测试）
- Playwright（E2E）
- Turbo
- Zustand
- TanStack Query（React Query）
- Tailwind CSS
- Ant Design 5.x
- ESLint + Prettier
- pnpm 管理依赖版本
- Docker + nginx 部署
- GitHub Actions 管理发布配置

环境约定：

- `test`：测试环境
- `product`：正式环境

发布约定：

- 通过 Git tag 触发发布
- `test-v1.0.1` 发布测试环境
- `product-v1.0.1` 发布正式环境
- Docker 镜像不使用 `latest`
- 正式环境也重新构建，因此 `VITE_API_BASE_URL` 等构建期变量会生效

---

## 2. 模板注册方式

> Phase 1 状态：已完成。`mfe-main` 与 `mfe-app` 已完成模板注册和最小骨架生成能力，后续阶段继续补齐主应用、子应用、公共包、测试、Docker 与 CI/CD 能力。

在模板库中新增：

- `template/src/mfe-main.ts`
- `template/src/mfe-app.ts`

并修改模板入口：

- [template/src/index.ts](template/src/index.ts)

需要新增：

- `TemplateName` 类型：加入 `mfe-main`、`mfe-app`
- `templateDefinitions`：加入两个模板描述
- `createTemplateSourceFiles()`：加入两个分支
- 测试：更新 [template/src/index.test.ts](template/src/index.test.ts)
- CLI 展示测试：更新 [cli/src/index.test.ts](cli/src/index.test.ts)

---

## 3. `mfe-main` 模板设计

### 3.1 职责

主应用负责：

1. 登录页
2. 登录接口调用
3. token / 用户信息 / 权限管理
4. 退出登录
5. qiankun 子应用注册
6. 传递登录态给子应用
7. 主布局与菜单
8. 公共 UI 包接入
9. Docker 容器部署
10. GitHub Actions 发布

### 3.2 建议目录结构

```txt
mfe-main-project/
├── apps/
│   └── main/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── routes/
│       │   ├── layouts/
│       │   ├── pages/
│       │   ├── stores/
│       │   ├── queries/
│       │   ├── services/
│       │   ├── micro-apps/
│       │   └── styles/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
├── packages/
│   ├── shared/
│   ├── ui/
│   └── api/
├── e2e/
├── nginx/
├── .github/workflows/
├── Dockerfile
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
└── README.md
```

### 3.3 主应用核心实现

#### 登录态管理

使用 Zustand 保存：

- `accessToken`
- `refreshToken`
- `user`
- `permissions`
- `isAuthenticated`

#### API 调用

公共请求封装放在 `packages/api`，主应用通过注入 token 的方式调用：

```ts
createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  getAccessToken: () => authStore.getState().accessToken,
  onUnauthorized: () => authStore.getState().logout()
});
```

#### qiankun 注册

主应用通过 props 传给子应用：

- `apiBaseUrl`
- `getAccessToken`
- `getCurrentUser`
- `logout`

---

## 4. `mfe-app` 模板设计

### 4.1 职责

子应用负责：

1. 业务页面
2. 业务路由
3. 业务 API 调用
4. 局部状态管理
5. React Query 数据流
6. 独立运行
7. 被 qiankun 主应用加载
8. 接收主应用登录态
9. Docker 容器部署
10. GitHub Actions 发布

### 4.2 建议目录结构

```txt
mfe-app-project/
├── apps/
│   └── app/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── bootstrap.tsx
│       │   ├── qiankun.ts
│       │   ├── App.tsx
│       │   ├── routes/
│       │   ├── pages/
│       │   ├── stores/
│       │   ├── queries/
│       │   ├── services/
│       │   ├── types/
│       │   └── styles/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
├── packages/
│   ├── shared/
│   ├── ui/
│   └── api/
├── e2e/
├── nginx/
├── .github/workflows/
├── Dockerfile
├── docker-compose.yml
├── pnpm-workspace.yaml
├── turbo.json
├── eslint.config.js
├── prettier.config.js
├── playwright.config.ts
└── README.md
```

### 4.3 qiankun 生命周期

子应用需要支持：

- `bootstrap`
- `mount`
- `unmount`

并支持独立运行模式：

```ts
if (!window.__POWERED_BY_QIANKUN__) {
  render();
}
```

### 4.4 子应用 API 调用

子应用不要依赖主应用内部实现，而是：

1. 从主应用 props 读取登录态
2. 自己创建 API client
3. 通过 `@shared/api` 发请求

---

## 5. 公共包设计

### 5.1 `packages/shared`

先放基础类型、常量、工具：

- auth 类型
- className 工具
- 常量

### 5.2 `packages/ui`

先放 UI 相关内容：

- Logo
- 页面容器
- 空状态
- 错误状态

### 5.3 `packages/api`

提供通用请求封装，不绑定主应用业务逻辑。

主应用和子应用都可以依赖它。

---

## 6. 配置方案

### 6.1 本地配置文件

模板只提交示例文件：

- `.env.test.local.example`
- `.env.product.local.example`

真实文件不提交 Git：

- `.env.test.local`
- `.env.product.local`

### 6.2 GitHub Environments

仓库中创建：

- `test`
- `product`

环境变量示例：

```txt
VITE_APP_ENV=test | product
VITE_API_BASE_URL=...
VITE_MFE_APP_ENTRY=...
DOCKER_REGISTRY=...
DOCKER_IMAGE_NAME=...
DEPLOY_HOST=...
DEPLOY_USER=...
DEPLOY_PATH=...
APP_PORT=...
CONTAINER_NAME=...
```

Secrets：

```txt
DOCKER_REGISTRY_USERNAME
DOCKER_REGISTRY_PASSWORD
SSH_PRIVATE_KEY
```

---

## 7. CI 方案

保留独立的 [ci.yml](.github/workflows/ci.yml)。

### 触发方式

- Pull Request
- push 到 `main` / `master`

### 执行内容

- pnpm install
- lint
- format check
- unit test
- build
- E2E

---

## 8. 部署方案

保留独立的 [deploy.yml](.github/workflows/deploy.yml)。

### 发布规则

- `test-v1.0.1`：发布测试环境
- `product-v1.0.1`：发布正式环境

### 镜像 tag

不使用 `latest`，使用带环境前缀的 tag：

- `mfe-main:test-v1.0.1`
- `mfe-main:product-v1.0.1`

### compose 文件

只保留一个：

- `docker-compose.yml`

由 `deploy.yml` 自动上传到服务器。

---

## 9. Docker 与 nginx

### Dockerfile

- 使用多阶段构建
- 构建阶段接收 `VITE_API_BASE_URL`、`VITE_MFE_APP_ENTRY`、`VITE_APP_ENV`
- 运行阶段使用 nginx

### nginx

- SPA fallback
- 静态资源缓存
- `index.html` 不强缓存

---

## 10. 回滚方案

回滚通过手动触发 `deploy.yml` 实现：

- 指定 `environment`
- 指定 `image_tag`
- 不重新构建
- 直接部署历史镜像

不需要单独执行本地回滚脚本。

---

## 11. 验收命令

模板生成后，建议至少验证：

```sh
pnpm build
pnpm test
pnpm validate:generated-apps
```

---

## 12. 输出物

生成模板时应包含：

- `mfe-main`
- `mfe-app`
- 对应 README
- CI / Deploy workflow
- Dockerfile
- docker-compose.yml
- nginx 配置
- 环境示例文件

