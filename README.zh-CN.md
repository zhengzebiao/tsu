# Tsu

Tsu 是一个面向团队的可版本化工程模板 CLI。它用于快速生成已经内置 Lint、CI、Docker、部署结构和发布元数据的标准前端与后端工程。

当团队希望新项目从同一套工程基线开始，而不是每次重复配置项目结构、构建、校验和部署流程时，可以使用 Tsu。

## 快速开始

全局安装 CLI，或在当前仓库中使用已构建的 CLI 包。

```bash
npm install -g @tsuz/cli
```

创建 Vue 3 项目：

```bash
tsu-cli init web-app --template vue3
cd web-app
pnpm install
pnpm dev
```

创建 React 项目：

```bash
tsu-cli init react-app --template react
cd react-app
pnpm install
pnpm dev
```

创建 FastAPI 认证服务：

```bash
tsu-cli init auth-service --template python-main
cd auth-service
pdm install
pdm run dev
```

创建验证 `python-main` 签发 Token 的 FastAPI 业务服务：

```bash
tsu-cli init backend-api --template python-app
cd backend-api
pdm install
pdm run dev
```

## 模板列表

| 模板 | 适合场景 | 内置能力 |
| --- | --- | --- |
| `default` | 最小 Node.js 项目 | `package.json`、`src/index.js` |
| `vue3` | 中后台、仪表盘、Web App | Vite、Vue Router、Pinia dashboard store、Vitest、TypeScript、ESLint、Docker、CI |
| `react` | React Web App、仪表盘 | Vite、React Router、TypeScript、ESLint、Docker、CI |
| `mfe` | 微前端工作区 | Host 应用、Vue 子应用、qiankun、共享包、Docker、CI |
| `mfe-main` | React 微前端主应用 / 基座 | React、Vite、qiankun 主应用占位、Zustand、TanStack Query、Ant Design、Turbo |
| `mfe-app` | React 微前端子应用 / 业务应用 | React、Vite、qiankun 生命周期占位、Zustand、TanStack Query、Ant Design、Turbo |
| `monorepo` | 多包团队仓库 | pnpm workspace、Turbo、Changesets、TypeScript packages |
| `python-main` | FastAPI 认证服务 | PDM、PostgreSQL、Redis、Alembic、RS256 JWT 签发、Docker、Nginx、CI/CD Environments |
| `python-app` | FastAPI 业务服务 | PDM、PostgreSQL、Redis 黑名单校验、RS256 JWT 验证、Docker、Nginx、CI/CD Environments |

通过 CLI 查看模板：

```bash
tsu-cli templates
```

## CLI 命令

```bash
tsu-cli --help
tsu-cli --version
tsu-cli doctor [--cwd <path>] [--json]
tsu-cli upgrade-check [--cwd <path>] [--repo <owner/repo>] [--json]
tsu-cli templates
tsu-cli list
tsu-cli template list
tsu-cli template info --help
tsu-cli template info <template-name>
tsu-cli template info <template-name> --version <version>
tsu-cli template versions [template-name]
tsu-cli init <project-name> --template <template-name>
```

`tsu-cli templates` 是推荐的模板列表命令。`tsu-cli list` 和 `tsu-cli template list` 是兼容别名。

### `init`

从指定模板创建项目。

```bash
tsu-cli init admin-console --template vue3
```

常用参数：

| 参数 | 说明 |
| --- | --- |
| `-t, --template <name>` | 模板名称：`default`、`vue3`、`react`、`mfe`、`mfe-main`、`mfe-app`、`monorepo`、`python-main`、`python-app` |
| `-v, --version <value>` | 模板发布版本，例如 `1.0.3` 或 `latest` |
| `--repo <owner/repo>` | 承载模板 release asset 的 GitHub 仓库 |
| `--cwd <path>` | 项目创建目录 |
| `--local` | 使用 CLI 内置模板，而不是 GitHub release asset |
| `-f, --force` | 覆盖目标目录 |

如果在交互式终端中直接运行 `tsu-cli` 且不带参数，CLI 会询问项目名称和模板。

### `doctor`

检查某个目录是否像是由 Tsu 生成的项目，以及预期模板文件是否仍然存在。

```bash
tsu-cli doctor --cwd admin-console
```

当前版本只做本地静态检查。它会读取 `.tsu/template.json` 展示模板名称、版本、来源和仓库，并检查预期模板文件是否仍然存在。

加 `--json` 可输出机器可读结果，便于 CI 流水线消费：

```bash
tsu-cli doctor --cwd admin-console --json
```

JSON 包含 `status`（`ok` / `warning` / `error`）、解析出的模板元数据，以及完整的 `checks` 数组。

### `upgrade-check`

检查生成项目是否有更新的模板 release 可用。该命令只读，不会修改项目文件。

```bash
tsu-cli upgrade-check --cwd admin-console
```

可以用 `--repo` 覆盖 `.tsu/template.json` 中记录的仓库：

```bash
tsu-cli upgrade-check --cwd admin-console --repo company/frontend-templates
```

加 `--json` 供 CI 消费，JSON 包含 `status`（`current` / `update_available` / `unknown`）、`currentVersion`、`latestVersion` 和 `availableVersions`：

```bash
tsu-cli upgrade-check --cwd admin-console --json
```

## 模板元数据

生成项目会包含 `.tsu/template.json`，方便后续工具识别它的模板来源：

```json
{
  "template": {
    "name": "vue3",
    "version": "1.0.4",
    "source": "remote",
    "repository": "company/frontend-templates"
  }
}
```

该元数据会被 `tsu-cli doctor` 使用，也可以支撑后续的模板升级检查。

## 模板版本

Tsu 支持在初始化时锁定模板版本：

```bash
tsu-cli init admin-console --template vue3 --version 1.0.4
```

CLI 会解析到 GitHub release tag `template-v1.0.4`，并直接下载 `tsu-templates-v1.0.4.tar.gz` 这个 GitHub Release asset。明确指定版本时会跳过 GitHub Release API 查询；使用 `latest` 时仍会通过 GitHub API 解析最新模板 release。

已下载的模板包会缓存在本地；后续请求同一仓库和版本时会复用缓存。可以使用 `--no-cache` 跳过缓存，或者使用 `--refresh` 强制重新下载并刷新缓存。

查看可用模板 release 版本：

```bash
tsu-cli template versions
```

只查看包含某个模板的版本：

```bash
tsu-cli template versions vue3
```

查看指定 release 版本里的模板详情：

```bash
tsu-cli template info vue3 --version 1.0.4
```

## 私有模板仓库

团队可以维护自己的模板 release 仓库，并让 Tsu 指向该仓库：

```bash
tsu-cli init crm-web --template vue3 --repo company/frontend-templates
```

也可以通过环境变量设置默认模板仓库：

```bash
TSU_TEMPLATE_REPOSITORY=company/frontend-templates tsu-cli init crm-web --template vue3
```

如果使用私有 GitHub 仓库，或者需要更高的 GitHub API 额度，请在 shell 或 CI 环境设置 `GITHUB_TOKEN` 或 `GH_TOKEN`。CLI 会自动把它用于 GitHub API 和 Release asset 请求。不要把 token 写入生成项目。

## 生成项目后的工作流

大多数模板都面向下面的工作流设计：

```bash
pnpm install
pnpm lint
pnpm build
pnpm dev
```

生成项目内的 README 会包含该模板对应的脚本说明、目录结构说明和部署提示。

## 包定位

Tsu 由多个包组成，但产品入口和短期核心价值集中在 CLI 与模板上。

| 包 | 角色 |
| --- | --- |
| `@tsuz/cli` | 面向用户的项目创建 CLI |
| `@tsuz/template` | CLI 本地生成与模板 release asset 共用的模板核心包 |
| `@tsuz/components` | 面向模板项目的 UI 组件和页面骨架 |
| `@tsuz/utils` | 面向模板项目的前端工具函数 |
| `@tsuz/sdk` | 面向模板项目的 API Client 基础层 |

短期内，主要用户价值是 `@tsuz/cli` 加项目模板。components、utils、sdk 后续应逐步成为生成项目里的默认能力层。

## 模板源状态

模板源统一已在 `master` 完成。`@tsuz/template` 是内置模板定义和渲染逻辑的唯一源头；`@tsuz/cli` 在 `--local` 本地生成项目时依赖它，GitHub Release 模板资产也由同一个 template 包构建。

旧的 CLI 内部重复模板源码和 MFE 同步脚本流程不再是当前架构。

## Roadmap

当前重点：

- 让用户 1 分钟内理解 CLI 并成功创建项目。
- 保证模板生成后可安装、可 lint、可 build。
- 给模板补充 README 和生成后的开发指引。
- 强化 Vue 3 和 React 作为主力应用模板。
- 完善模板版本化和企业私有模板仓库使用流程。

后续方向：

- 模板详情和模板版本查询命令。
- 更丰富的模板 manifest，包含描述、标签和推荐场景。
- 模板健康检查和升级建议。
- 组织级 preset 与私有模板平台能力。

## 常见问题

### Tsu 是另一个 create-app 工具吗？

不完全是。Tsu 更关注团队工程标准化、可发布的模板版本，以及私有模板仓库能力。

### 应该使用哪个包管理器？

Tsu 模板主推 pnpm。

### 可以使用公司自己的模板仓库吗？

可以。传入 `--repo owner/name`，或设置 `TSU_TEMPLATE_REPOSITORY`。

### 可以覆盖已有目录吗？

可以，传入 `--force`。请谨慎使用，因为目标目录会先被删除再重新写入文件。
