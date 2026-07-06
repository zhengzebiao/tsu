# 微前端模板分阶段执行方案

## 1. 目标

按阶段推进 `mfe-main` 与 `mfe-app` 模板落地，确保每一阶段都可验证、可回退、可交付。

本方案默认与模板生成方案一致，核心约定如下：

- 新增两个模板：`mfe-main`、`mfe-app`
- 微前端技术栈：React + TS + Vite + qiankun
- 主应用负责登录与登录态管理
- 子应用负责业务场景
- 公共包先放 UI、类型、工具，再逐步扩展
- CI / Deploy 分离
- Docker 不使用 `latest`
- 发布 tag：`test-v1.0.1`、`product-v1.0.1`
- 单一 `docker-compose.yml`
- `deploy.yml` 自动上传 compose 文件到服务器

---

## Phase 1：模板注册与基础骨架（已完成）

**状态：已完成**

### 目标

让模板库识别 `mfe-main` 和 `mfe-app`，并可以正常生成最小骨架。

### 任务

- [x] 新增模板文件：
  - [x] `template/src/mfe-main.ts`
  - [x] `template/src/mfe-app.ts`
- [x] 修改 [template/src/index.ts](template/src/index.ts)：
  - [x] 扩展 `TemplateName`
  - [x] 添加 `templateDefinitions`
  - [x] 添加 `createTemplateSourceFiles()` 分支
- [x] 更新测试：
  - [x] [template/src/index.test.ts](template/src/index.test.ts)
  - [x] [cli/src/index.test.ts](cli/src/index.test.ts)
- [x] 更新生成脚本验证：
  - [x] [script/validate-generated-apps.mjs](script/validate-generated-apps.mjs)

### 验收标准

- [x] `listTemplates()` 中能看到 `mfe-main`、`mfe-app`
- [x] CLI 可以正常展示模板信息
- [x] 模板可被生成
- [x] 基础测试通过

### 已验证命令

```sh
pnpm --filter @tsuz/template build
pnpm --filter @tsuz/template test
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
node cli/dist/index.js template list
node cli/dist/index.js template info mfe-main
node cli/dist/index.js template info mfe-app
node cli/dist/index.js init mfe-main-demo --template mfe-main --local --cwd ./tmp --force
node cli/dist/index.js init mfe-app-demo --template mfe-app --local --cwd ./tmp --force
pnpm validate:generated-apps
```

---

## Phase 2：生成 `mfe-main` 主应用骨架（已完成）

**状态：已完成**

### 目标

生成一个可安装、可启动、可构建的主应用工程。

### 任务

- [x] 生成 workspace 文件：
  - [x] `package.json`
  - [x] `pnpm-workspace.yaml`
  - [x] `turbo.json`
  - [x] `tsconfig.base.json`
- [x] 生成主应用目录：
  - [x] `apps/main/package.json`
  - [x] `apps/main/src/main.tsx`
  - [x] `apps/main/src/App.tsx`
  - [x] `apps/main/vite.config.ts`
- [x] 接入依赖：
  - [x] React
  - [x] Vite
  - [x] TypeScript
  - [x] React Router
  - [x] Ant Design
  - [x] Tailwind CSS
- [x] 生成基础配置：
  - [x] ESLint
  - [x] Prettier
  - [x] `.gitignore`
  - [x] `.dockerignore`

### 验收标准

- [x] `pnpm install` 成功
- [x] `pnpm dev` 可启动
- [x] `pnpm build` 成功
- [x] `pnpm lint` 成功

### 已验证命令

```sh
pnpm --filter @tsuz/template build
pnpm --filter @tsuz/template test
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
pnpm validate:generated-apps
```

`pnpm validate:generated-apps` 已覆盖 `mfe-main` 生成项目的 `pnpm install`、`pnpm lint`、`pnpm build` 和 dev server smoke check（`http://127.0.0.1:7200/`）。

---

## Phase 3：主应用登录态与 qiankun 接入（已完成）

**状态：已完成**

### 目标

主应用具备登录、登录态管理和子应用注册能力。

### 任务

- [x] 增加登录页：
  - [x] `apps/main/src/pages/LoginPage.tsx`
- [x] 增加 auth store：
  - [x] `apps/main/src/stores/auth.store.ts`
- [x] 增加 auth service：
  - [x] `apps/main/src/services/auth.service.ts`
- [x] 增加 React Query 相关封装：
  - [x] `apps/main/src/providers/query-client.ts`
  - [x] `apps/main/src/providers/AppProviders.tsx`
- [x] 增加 qiankun 注册：
  - [x] `apps/main/src/micro-apps/config.ts`
  - [x] `apps/main/src/micro-apps/registry.ts`
- [x] 主应用向子应用传递：
  - [x] `apiBaseUrl`
  - [x] `getAccessToken`
  - [x] `getCurrentUser`
  - [x] `logout`
- [x] 增加单元测试：
  - [x] `apps/main/src/services/auth.service.test.ts`
  - [x] `apps/main/src/micro-apps/config.test.ts`
- [x] 补齐 CLI help 和 doctor 对 `mfe-main` / `mfe-app` 的基础覆盖
- [x] 更新 `validate:generated-apps`，为 `mfe-main` 增加 `pnpm test`

### 验收标准

- [x] 登录流程可运行
- [x] 子应用注册逻辑可运行
- [x] 登录态可传递给子应用
- [x] 单测通过

### 已验证命令

```sh
pnpm --filter @tsuz/template build
pnpm --filter @tsuz/template test
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
pnpm validate:generated-apps
```

> 说明：本阶段已完成主应用登录态、qiankun 注册配置和 props 传递的模板生成与单测验证；真实子应用完整加载和浏览器 E2E 留到 Phase 5 / Phase 6。

---

## Phase 4：公共包 `packages/shared`、`packages/ui`、`packages/api`（已完成）

**状态：已完成**

### 目标

抽出可复用的基础能力，减少主应用和子应用重复代码。

### 任务

- [x] 新增 `packages/shared`
- [x] 新增 `packages/ui`
- [x] 新增 `packages/api`
- [x] 配置 workspace 依赖
- [x] 配置 tsconfig path alias
- [x] 配置 Vite alias
- [x] 更新模板测试覆盖公共包文件、依赖和 alias
- [x] 更新 CLI doctor / init 测试覆盖 `mfe-main` 与 `mfe-app`
- [x] 更新生成物验证脚本，为 `mfe-app` 增加 `pnpm test`
- [x] 更新模板发布验证脚本，检查公共包发布产物

### 包职责

- `packages/shared`：类型、常量、工具
- `packages/ui`：Logo、页面容器、空状态、错误状态
- `packages/api`：通用 API client

### 验收标准

- [x] 主应用和子应用都可引用公共包
- [x] 公共包不包含具体业务逻辑
- [x] 依赖关系清晰

### 已验证命令

```sh
pnpm --filter @tsuz/template build
pnpm --filter @tsuz/template test
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
pnpm validate:generated-apps
```

---

## Phase 5：生成 `mfe-app` 子应用骨架（已完成）

**状态：已完成**

### 目标

生成可独立启动、可被 qiankun 加载的子应用工程。

### 任务

- [x] 生成 `apps/app`
- [x] 增加入口：
  - [x] `main.tsx`
  - [x] `bootstrap.tsx`
  - [x] `qiankun.ts`
- [x] 支持独立运行和 qiankun mount/unmount/update
- [x] 增加业务首页：
  - [x] `BusinessHomePage.tsx`
- [x] 增加状态和查询封装：
  - [x] `AppProviders.tsx`
  - [x] `query-client.ts`
  - [x] `app.store.ts`
  - [x] `business-home.query.ts`
- [x] 增加测试：
  - [x] `qiankun.test.ts`
  - [x] `api-client.test.ts`
  - [x] `app.store.test.ts`
  - [x] `business-home.query.test.ts`
- [x] 更新 `mfe-main` outlet，确保登录跳转到 `/apps/mfe-app` 后 qiankun 可在容器出现后触发挂载
- [x] 更新 CLI doctor、模板结构测试、生成物验证和模板发布验证

### 验收标准

- [x] 独立运行可用
- [x] 被主应用加载可用
- [x] 生命周期正常
- [x] 单测通过

### 已验证命令

```sh
pnpm --filter @tsuz/template build
pnpm --filter @tsuz/template test
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
pnpm validate:generated-apps
pnpm template:release:build --version=0.0.0
TEMPLATE_VERSION=0.0.0 pnpm validate:template-release
```

### 浏览器验证

- `mfe-app` 独立启动在 `http://127.0.0.1:7201/`，可看到 Phase 5 `Business home`、standalone 状态、业务指标和 query 数据。
- `mfe-main` 启动在 `http://127.0.0.1:7200/`，登录 `admin / password123` 后进入 `/apps/mfe-app`，可看到子应用以 `qiankun mount` 模式挂载，并接收 host user `Demo Admin` 与 auth bridge。

---

## Phase 6：测试体系

### 目标

将单元测试和 E2E 纳入模板默认能力。

### 任务

1. 接入 Vitest
2. 接入 Testing Library
3. 接入 Playwright
4. 主应用 E2E：
   - 登录
   - 加载子应用
5. 子应用 E2E：
   - 独立启动
   - 页面渲染

### 验收标准

- `pnpm test` 通过
- `pnpm test:e2e` 通过
- CI 中可稳定运行

---

## Phase 7：Docker、nginx、compose

### 目标

模板生成的项目可以直接容器化部署。

### 任务

1. 生成 `Dockerfile`
2. 生成 `nginx/nginx.conf`
3. 生成单一 `docker-compose.yml`
4. Dockerfile 支持 build args：
   - `VITE_API_BASE_URL`
   - `VITE_MFE_APP_ENTRY`
   - `VITE_APP_ENV`
5. `docker-compose.yml` 使用环境变量：
   - `DOCKER_IMAGE_NAME`
   - `APP_VERSION`
   - `CONTAINER_NAME`
   - `APP_PORT`
   - `APP_ENV`

### 验收标准

- 镜像可构建
- 容器可启动
- nginx 可正常提供 SPA
- compose 可正常编排

---

## Phase 8：CI 工作流

### 目标

为模板内置质量门禁。

### 任务

1. 新增 `.github/workflows/ci.yml`
2. 触发：
   - PR
   - push 到 `main` / `master`
3. 执行：
   - install
   - lint
   - format check
   - test
   - build
   - E2E

### 验收标准

- PR 自动跑 CI
- 主分支推送自动跑 CI
- CI 失败时能准确阻断合并

---

## Phase 9：Deploy 工作流

### 目标

支持通过 tag 发布 test / product，并支持手动回滚。

### 任务

1. 新增 `.github/workflows/deploy.yml`
2. 支持 tag：
   - `test-v*.*.*`
   - `product-v*.*.*`
3. 根据 tag 解析：
   - `environment`
   - `image_tag`
   - `version`
4. 使用 GitHub Environment 变量
5. 构建并推送 Docker 镜像
6. 自动上传 `docker-compose.yml`
7. SSH 部署到服务器
8. 支持 `workflow_dispatch` 回滚历史镜像

### 验收标准

- `git tag test-v1.0.1` 可以发布测试环境
- `git tag product-v1.0.1` 可以发布正式环境
- 回滚可指定历史 `image_tag`
- 服务器不需要手工维护 compose 文件

---

## Phase 10：发布验证

### 目标

确保模板生成后真实可用。

### 任务

1. 更新 [script/validate-generated-apps.mjs](script/validate-generated-apps.mjs)
2. 增加 `mfe-main`、`mfe-app`
3. 对生成项目执行：
   - `pnpm install`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm build`

### 验收标准

- 生成项目可安装
- 可构建
- 可测试
- 可部署

---

## Phase 11：文档完善

### 目标

让用户拿到模板后可以直接上手。

### 任务

1. 更新模板 README
2. 写清楚本地开发
3. 写清楚 GitHub Environment 配置
4. 写清楚 tag 发布流程
5. 写清楚回滚流程
6. 写清楚 `VITE_API_BASE_URL` 是构建期变量
7. 写清楚 `deploy.yml` 自动上传 `docker-compose.yml`

### 验收标准

- README 能指导用户完成从生成到部署的全部流程
- test / product 的发布说明清晰
- 回滚说明清晰

---

## 2. 推荐执行顺序

建议按下面顺序落地：

1. 模板注册
2. 主应用骨架
3. 主应用登录与 qiankun
4. 公共包
5. 子应用骨架
6. 测试体系
7. Docker / nginx / compose
8. CI
9. Deploy
10. 发布验证
11. 文档

---

## 3. 每阶段交付物

### Phase 1

- 模板可识别
- 基础测试更新

### Phase 2

- 主应用骨架生成完成

### Phase 3

- 主应用可以登录并注册子应用

### Phase 4

- 公共包可复用

### Phase 5

- 子应用可独立运行并被主应用加载

### Phase 6

- 单测与 E2E 可用

### Phase 7

- 容器化部署可用

### Phase 8

- CI 可用

### Phase 9

- Tag 发布和回滚可用

### Phase 10

- 生成物验证通过

### Phase 11

- README 完整

---

## 4. 最终验收命令

建议最终至少满足：

```sh
pnpm build
pnpm test
pnpm validate:generated-apps
```

如果启用了 E2E：

```sh
pnpm test:e2e
```

---

## 5. 备注

如果后续想把主应用和子应用拆成独立仓库，建议直接把：

- `packages/shared`
- `packages/ui`
- `packages/api`

演进为可发布的私有 npm 包，以减少微前端之间的仓库耦合。
