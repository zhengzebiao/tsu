# tsu-cli 操作说明

## 安装依赖

```bash
pnpm install
```

## 本地构建 CLI

```bash
pnpm --filter @tsuz/cli build
```

## 初始化项目

```bash
tsu-cli init <projectName>
```

本地开发时也可以直接运行构建后的入口：

```bash
node cli/dist/index.js init demo-app --local
```

默认会使用 `default` 模板，在当前目录创建 `demo-app`：

```text
demo-app/
├── package.json
└── src/
    └── index.js
```

## 内置模板

| 模板 | 命令 | 说明 |
| --- | --- | --- |
| `default` | `tsu-cli init demo-app --template default` | 最小 Node ESM 项目模板 |
| `vue3` | `tsu-cli init web-app --template vue3` | Vue 3 + Vite + Router + Pinia 前端项目模板 |
| `react` | `tsu-cli init react-app --template react` | React + Vite + TypeScript + Router 前端项目模板 |
| `mfe` | `tsu-cli init mfe-app --template mfe` | Vue 3 + Vite + qiankun 微前端主子应用模板 |
| `mfe-main` | `tsu-cli init mfe-main-platform --template mfe-main` | React + Vite + qiankun 主应用 / 基座，内置登录态、CI、Docker/nginx/compose、tag 发布和回滚文档 |
| `mfe-app` | `tsu-cli init mfe-business-app --template mfe-app` | React + Vite + qiankun 子应用 / 业务应用，支持独立运行和 host 挂载，内置 CI、Docker/nginx/compose、tag 发布和回滚文档 |
| `monorepo` | `tsu-cli init platform --template monorepo` | 符合当前 PRD 的 pnpm + Turborepo + Changesets 多包仓库模板 |
| `python-main` | `tsu-cli init auth-service --template python-main` | FastAPI 认证服务模板，内置 PostgreSQL、Redis、Alembic、JWT、Docker、Nginx、CI、tag 发布、镜像回滚、独立 migration workflow 和发布后 health/smoke 检查 |
| `python-app` | `tsu-cli init business-service --template python-app` | FastAPI 业务服务模板，内置受保护 API、PostgreSQL、Redis 黑名单、Docker、Nginx、CI、tag 发布、镜像回滚、独立 migration workflow 和发布后 health/smoke 检查 |

默认情况下，CLI 会尝试从 GitHub Release asset 拉取模板；如果提供了 `--local`，则使用本地模板生成。

`vue3` 模板会生成以下核心结构：

```text
web-app/
├── package.json
├── pnpm-workspace.yaml
├── Dockerfile
├── .dockerignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── nginx.conf
├── index.html
├── vite.config.ts
├── eslint.config.js
├── tsconfig.json
├── tsconfig.app.json
└── src/
    ├── App.vue
    ├── main.ts
    ├── env.d.ts
    ├── router/
    ├── stores/
    │   ├── dashboard.ts
    │   └── dashboard.test.ts
    ├── styles/
    └── views/
        ├── HomeView.vue
        └── HomeView.test.ts
```

`vue3` 模板内置 GitHub CI、Vitest 测试和 Docker 静态部署基础配置。生成后可以执行：

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
pnpm docker:build
pnpm docker:run
```

`nginx.conf` 已包含 Vue Router history 模式刷新回退配置。`HomeView` 使用 Pinia dashboard store 串起 Tsu components、SDK 和 utils；`dashboard.test.ts` / `HomeView.test.ts` 提供生成项目后的测试样例。

`react` 模板会生成以下核心结构：

```text
react-app/
├── package.json
├── pnpm-workspace.yaml
├── Dockerfile
├── .dockerignore
├── .github/
│   └── workflows/
│       └── ci.yml
├── nginx.conf
├── index.html
├── vite.config.ts
├── eslint.config.js
├── tsconfig.json
├── tsconfig.app.json
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── vite-env.d.ts
    ├── styles/
    └── views/
```

`react` 模板内置 GitHub CI 和 Docker 静态部署基础配置。生成后可以执行：

```bash
pnpm install
pnpm lint
pnpm build
pnpm docker:build
pnpm docker:run
```

`nginx.conf` 已包含 React Router history 模式刷新回退配置。状态管理暂未内置，后续可以按需添加。

`mfe` 模板会生成以下核心结构：

```text
mfe-app/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── host/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── micro-apps.ts
│   │       └── styles.css
│   ├── subapp/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   │       ├── main.ts
│   │       ├── App.vue
│   │       ├── lifecycle.ts
│   │       └── styles.css
│   └── subapp-two/
│       ├── package.json
│       ├── vite.config.ts
│       └── src/
│           ├── main.ts
│           ├── App.vue
│           ├── lifecycle.ts
│           └── styles.css
└── packages/
    ├── shared/
    │   └── src/index.ts
    └── ui/
        └── src/index.ts
```

`mfe` 模板默认生成一个 host 和两个子应用：`subapp`、`subapp-two`。生成后可以执行：

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm docker:build
pnpm docker:run
```

默认端口：

- host: `http://localhost:7100`
- subapp: `http://localhost:7101`
- subapp-two: `http://localhost:7102`

子应用端口使用 `--strictPort`，避免端口被占用时 Vite 自动漂移导致 qiankun host 配置失配。

`monorepo` 模板会生成以下核心结构：

```text
platform/
├── cli/
├── template/
├── components/
│   ├── vue/
│   └── react/
├── utils/
│   └── js/
├── sdk/
├── tests/
├── script/
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## CLI 命令别名

模板列表推荐使用：

```bash
tsu-cli templates
```

兼容别名：

```bash
tsu-cli list
tsu-cli template list
```

查看 `template info` 子命令帮助：

```bash
tsu-cli template info --help
```

## 参数说明

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `<projectName>` | `tsu-cli init demo-app` | 项目目录名，默认 `quick-start-app` |
| `--template` / `-t` | `tsu-cli init platform --template monorepo` | 指定模板名，目前支持 `default`、`vue3`、`react`、`mfe`、`mfe-main`、`mfe-app`、`monorepo`、`python-main`、`python-app` |
| `--version` / `-v` | `tsu-cli init platform --template monorepo --version 1.2.3` | 指定模板 Release 版本；明确指定版本时会直接下载对应的 GitHub Release asset |
| `--repo` | `tsu-cli init platform --repo owner/repo` | 指定 GitHub 仓库，默认读取 `TSU_TEMPLATE_REPOSITORY`、`GITHUB_REPOSITORY`，否则使用 `zhengzebiao/tsu` |
| `--local` | `tsu-cli init demo-app --local` | 强制使用本地模板，适合离线或开发调试 |
| `--cwd` | `tsu-cli init demo-app --cwd ./apps` | 指定项目生成的父目录 |
| `--force` / `-f` | `tsu-cli init demo-app --force` | 目标目录已存在时先删除再重新生成 |

明确指定 `--version` 时，CLI 会直接下载对应的 GitHub Release asset；`latest` 仍然会先访问 GitHub API 查找最新 release。CLI 会自动读取 `GITHUB_TOKEN` 或 `GH_TOKEN` 作为认证头，并把已下载的模板包缓存到本地复用。

如果想控制缓存行为，可以在 `init`、`template info`、`template versions` 里使用：

- `--no-cache`：本次不读写本地缓存，直接走临时目录
- `--refresh`：忽略已缓存内容，强制重新下载并刷新缓存

示例：

```bash
tsu-cli init demo --template vue3 --version 1.2.3 --refresh
tsu-cli template info vue3 --version 1.2.3 --no-cache
tsu-cli template versions vue3 --refresh
```

## 覆盖保护

默认情况下，如果目标目录已存在，CLI 会终止并提示：

```text
Target directory already exists: <path>. Use --force to overwrite.
```

确认可以覆盖时再追加 `--force`：

```bash
tsu-cli init demo-app --force
```

## 常用开发命令

```bash
pnpm build
pnpm lint
pnpm test
```

只验证 CLI 包：

```bash
pnpm --filter @tsuz/cli build
pnpm --filter @tsuz/cli test
```

## 本地验证模板生成

```bash
pnpm build
node cli/dist/index.js init demo-app --template default --cwd ./tmp
node cli/dist/index.js init web-app --template vue3 --cwd ./tmp
node cli/dist/index.js init react-app --template react --cwd ./tmp
node cli/dist/index.js init mfe-app --template mfe --cwd ./tmp
node cli/dist/index.js init mfe-main-platform --template mfe-main --cwd ./tmp
node cli/dist/index.js init mfe-business-app --template mfe-app --cwd ./tmp
node cli/dist/index.js init platform --template monorepo --cwd ./tmp
node cli/dist/index.js init auth-service --template python-main --cwd ./tmp
node cli/dist/index.js init business-service --template python-app --cwd ./tmp
```

## 验证生成后的 monorepo

```bash
pnpm validate:generated-monorepo
```

该命令会生成一个临时 `monorepo` 模板项目，并依次执行：

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
```

## 验证生成后的 MFE 模板

```bash
pnpm validate:generated-apps
```

该命令会生成 `mfe-main` 和 `mfe-app` 项目，安装依赖，执行 `lint`、`format:check`、`test`、`build`、`test:e2e`，检查 Docker/nginx/compose、CI、Deploy 和 README 文档 markers，并运行 host + sub-app 集成 E2E。生成项目 README 会指导本地开发、GitHub Environment 配置、`test-v*.*.*` / `product-v*.*.*` tag 发布、`workflow_dispatch` 回滚、`VITE_API_BASE_URL` 构建期变量，以及 `deploy.yml` 自动上传 `docker-compose.yml`。

如果要验证模板 release archive 中的 MFE 生成物：

```bash
pnpm template:release:build --version=1.0.0
TEMPLATE_VERSION=1.0.0 pnpm validate:template-release
```

## 验证生成后的 Python 模板

```bash
REDIS_URL=redis://localhost:6379/15 pnpm validate:generated-python
```

该命令会生成 `python-main` 和 `python-app` 项目，检查 deploy workflow、migrate workflow、发布后 health/smoke、`docker-compose.deploy.yml`、`docker-compose.infra.yml`、`.env.deploy.example` 和 README 发布部署/生产 runbook markers，然后执行 Python 语法检查、Alembic upgrade、seed 幂等、Ruff、pytest，并启动两个生成服务验证登录、资源访问、注销后拒绝访问、Request ID 透传和敏感日志不泄露。

生成的 Python 项目包含：

- `.github/workflows/deploy.yml`：`test-v*.*.*` / `product-v*.*.*` tag 发布，以及 `workflow_dispatch` 输入历史 `image_tag` 回滚；部署后等待 Docker health、执行容器内 `/health` smoke，并可选检查 `DEPLOY_PUBLIC_HEALTH_URL`。
- `.github/workflows/migrate.yml`：手动触发 Alembic migration，输入 `environment` / `revision` / `backup_confirmed`，product 通过 GitHub Environment 审批和备份确认保护。
- `docker-compose.infra.yml`：长期运行 PostgreSQL / Redis Docker 基础设施，product/test 可用 Docker，但不跟随应用发布重建。
- `docker-compose.deploy.yml`：只发布/回滚 `api` + `nginx`，执行 `docker compose pull api` 和 `docker compose up -d --no-build api nginx`。
- `.env.deploy.example`：远端运行时环境变量示例；`python-main` 包含 `JWT_PRIVATE_KEY`，`python-app` 只包含 `JWT_PUBLIC_KEY`。

## npm 发布包

完整发布流程见 [npm-release-flow.zh-CN.md](npm-release-flow.zh-CN.md)。

npm 发布以下顶层包：

- `@tsuz/cli`
- `@tsuz/template`
- `@tsuz/components`
- `@tsuz/utils`
- `@tsuz/sdk`

不发布 `tests`、`script`，也不拆分发布 `@tsuz/components-vue`、`@tsuz/components-react`、`@tsuz/utils-js`。

组件和工具通过 subpath exports 使用：

```js
import { vueComponentPreset } from "@tsuz/components/vue";
import { reactComponentPreset } from "@tsuz/components/react";
import { isPlainObject } from "@tsuz/utils/js";
```

发布前本地校验：

```bash
pnpm build
pnpm lint
pnpm test
pnpm npm:release:preflight
pnpm npm:release:pack
```

npm 自动发布使用 Trusted Publisher / OIDC。每个 npm 包（例如 `@tsuz/cli`、`@tsuz/template`）都需要在 npm 后台配置：

```text
Publisher: GitHub Actions
Organization or user: zhengzebiao
Repository: tsu
Workflow filename: npm-release.yml
Environment name: 留空
```

`.github/workflows/npm-release.yml` 需要 `id-token: write`，并且发布环境不要传 `NPM_TOKEN` / `NODE_AUTH_TOKEN`，否则会退回传统 token publish，npm 账号开启 2FA 时会要求 OTP。

如果 Windows 本地并行 `pnpm lint` 因 Node OOM 失败，可以先用串行方式确认类型检查：

```bash
pnpm turbo run lint --concurrency=1
```

### CLI npm 打包注意事项

`@tsuz/cli` 的入口文件 `dist/index.js` 会运行时导入内部模块，例如：

- `dist/template.js`

模板实现由 `@tsuz/template` 提供，不再由 CLI 包内的 `dist/mfe.js` / `dist/react.js` 维护。

因此 `cli/package.json` 的 `files` 不能只包含 `dist/index.js` 和 `dist/index.d.ts`，否则全局安装后会出现：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '<global-node_modules>/@tsuz/cli/dist/template.js'
```

当前应发布：

```json
"files": [
  "dist/*.js",
  "dist/*.d.ts"
]
```

`pnpm npm:release:pack` 会检查 `@tsuz/cli` 的 npm pack 产物必须包含运行时文件：

```text
dist/index.js
dist/template.js
```

同时会检查 `@tsuz/template` 的 npm pack 产物包含模板运行时文件：

```text
dist/index.js
dist/index.d.ts
dist/mfe.js
dist/react.js
```

### 全局 CLI 更新和验证

发布新版 npm 包后，重新安装全局 CLI：

```bash
npm uninstall -g @tsuz/cli
npm install -g @tsuz/cli@latest
npm list -g @tsuz/cli --depth=0
where tsu-cli
```

验证基础输出：

```bash
tsu-cli
```

预期输出：

```text
tsu-cli is ready to pull templates
```

验证远程模板：

```bash
tsu-cli init react-test --template react --version 1.0.4 --force
tsu-cli init mfe-test --template mfe --version 1.0.4 --force
```

#### Git Bash / nvm4w 下 `tsu-cli` 无输出问题

现象：

```bash
tsu-cli
# 没有任何输出，但退出码是 0

tsu-cli init react-test --template react --version 1.0.4
# 也没有任何输出，且没有生成预期项目
```

原因：

- Windows 全局安装 npm bin 时会生成多个 shim：`tsu-cli`、`tsu-cli.cmd`、`tsu-cli.ps1`。
- 在 Git Bash / nvm4w 环境里，shell shim 可能会用 `/c/.../node_modules/@tsuz/cli/dist/index.js` 这种 Git Bash 风格路径启动入口文件。
- 旧版本 CLI 用 `fileURLToPath(import.meta.url) === resolve(process.argv[1])` 判断“当前模块是否作为 CLI 入口运行”。
- `import.meta.url` 得到的是 Windows 路径，例如 `C:\...\dist\index.js`；`process.argv[1]` 可能是 `/c/.../dist/index.js`。
- 两者字符串不相等时，CLI 入口逻辑不会执行 `runCli(...)`，因此不会打印任何内容，也不会执行 `init`，但进程仍会正常退出。

处理方案：

1. 升级到 `@tsuz/cli@0.1.3` 或更高版本：

   ```bash
   npm uninstall -g @tsuz/cli
   npm install -g @tsuz/cli@latest
   npm list -g @tsuz/cli --depth=0
   ```

2. 确认 `PATH` 里实际执行的是当前 nvm Node 版本下的 shim：

   ```bash
   where tsu-cli
   ```

3. 验证基础输出：

   ```bash
   tsu-cli
   ```

   预期输出：

   ```text
   tsu-cli is ready to pull templates
   ```

4. 如果仍异常，直接用 Node 执行全局安装目录下的入口文件，判断是 shim 问题还是包入口问题：

   ```bash
   node C:\Users\<User>\AppData\Local\nvm\v20.20.2\node_modules\@tsuz\cli\dist\index.js
   ```

   如果直接执行有输出，而 `tsu-cli` 无输出，优先检查 `where tsu-cli` 指向和全局安装目录。

`0.1.3` 的修复方式：入口判断会先把 `/c/...` 归一化为 Windows 路径，再通过真实路径比较，兼容 Git Bash、`.cmd`、`.ps1` 等 shim 形态。

## 发布模板 Release asset

模板 Release 使用当前仓库的 GitHub Release asset：

- tag 格式：`template-v<version>`
- asset 格式：`tsu-templates-v<version>.tar.gz`
- 不传 `--version` 时，CLI 默认读取 GitHub latest release

首次发布前可以先检查发布入口是否齐全：

```bash
pnpm template:release:preflight --version=1.0.0
```

本地构建和验证模板压缩包：

```bash
pnpm build
pnpm validate:generated-apps
REDIS_URL=redis://localhost:6379/15 pnpm validate:generated-python
pnpm template:release:build --version=1.0.0
TEMPLATE_VERSION=1.0.0 pnpm validate:template-release
```

发布到 GitHub Release：

```bash
GITHUB_TOKEN=... pnpm template:release:publish --version=1.0.0
```

也可以推送 tag 触发 GitHub Actions 自动发布：

```bash
git tag template-v1.0.0
git push origin template-v1.0.0
```

本地执行发布脚本时，需要提供：

- `GITHUB_TOKEN` 或 `GH_TOKEN`
- `TSU_TEMPLATE_REPOSITORY` 或 `GITHUB_REPOSITORY`

脚本会通过 GitHub API 创建或复用 `template-v<version>` Release，并上传 `tsu-templates-v<version>.tar.gz`。

完整配置、token 和排障说明见 [私有模板仓库使用指南](PRIVATE_TEMPLATE_REPOSITORY.zh-CN.md)。

模板压缩包内需要包含 `tsu-templates-v<version>/manifest.json`。当前 manifest schema version 为 `0.5`，示例：

```json
{
  "name": "tsuz-template",
  "schemaVersion": "0.5",
  "version": "1.0.4",
  "asset": "tsu-templates-v1.0.4.tar.gz",
  "templates": [
    {
      "name": "vue3",
      "title": "Vue 3 Web App",
      "description": "Vue 3 app with Vite, Router, Pinia, ESLint, Docker, and CI",
      "tags": ["vue", "vite", "spa", "docker"],
      "recommendedFor": ["admin", "dashboard", "web app"],
      "node": ">=20",
      "packageManagers": ["pnpm"],
      "nextSteps": ["pnpm install", "pnpm dev"]
    }
  ]
}
```

私有模板仓库排查重点：

- `Failed to resolve GitHub Release`：检查仓库、tag、权限和 `GITHUB_TOKEN` / `GH_TOKEN`。
- `No tsu template asset found`：确认 Release asset 名称是 `tsu-templates-v<version>.tar.gz`。
- `Template "<name>" is not available`：确认 manifest 和压缩包目录都包含该模板。
- 缓存内容过旧：使用 `--refresh` 或 `--no-cache`。

CLI 使用远程模板：

```bash
tsu-cli init web-app --template vue3
tsu-cli init react-app --template react --version 1.0.4
tsu-cli init mfe-app --template mfe --version 1.0.4
tsu-cli init mfe-main-platform --template mfe-main --version 1.0.4
tsu-cli init mfe-business-app --template mfe-app --version 1.0.4
tsu-cli init platform --template monorepo
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init web-app --template vue3
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init react-app --template react --version 1.0.4
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init mfe-main-platform --template mfe-main --version 1.0.4
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init mfe-business-app --template mfe-app --version 1.0.4
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init platform --template monorepo --version 1.0.0
```

默认仓库会回退到 `zhengzebiao/tsu`。
