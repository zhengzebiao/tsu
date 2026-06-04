# Tsu

Tsu 是一个面向前端团队的可版本化工程模板 CLI。它用于快速生成已经内置 TypeScript、Lint、CI、Docker、路由、状态管理和发布基础结构的标准前端工程。

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

## 模板列表

| 模板 | 适合场景 | 内置能力 |
| --- | --- | --- |
| `default` | 最小 Node.js 项目 | `package.json`、`src/index.js` |
| `vue3` | 中后台、仪表盘、Web App | Vite、Vue Router、Pinia、TypeScript、ESLint、Docker、CI |
| `react` | React Web App、仪表盘 | Vite、React Router、TypeScript、ESLint、Docker、CI |
| `mfe` | 微前端工作区 | Host 应用、Vue 子应用、qiankun、共享包、Docker、CI |
| `monorepo` | 多包团队仓库 | pnpm workspace、Turbo、Changesets、TypeScript packages |

通过 CLI 查看模板：

```bash
tsu-cli templates
```

## CLI 命令

```bash
tsu-cli --help
tsu-cli --version
tsu-cli templates
tsu-cli template list
tsu-cli init <project-name> --template <template-name>
```

### `init`

从指定模板创建项目。

```bash
tsu-cli init admin-console --template vue3
```

常用参数：

| 参数 | 说明 |
| --- | --- |
| `-t, --template <name>` | 模板名称：`default`、`vue3`、`react`、`mfe`、`monorepo` |
| `-v, --version <value>` | 模板发布版本，例如 `1.0.3` 或 `latest` |
| `--repo <owner/repo>` | 承载模板 release asset 的 GitHub 仓库 |
| `--cwd <path>` | 项目创建目录 |
| `--local` | 使用 CLI 内置模板，而不是 GitHub release asset |
| `-f, --force` | 覆盖目标目录 |

如果在交互式终端中直接运行 `tsu-cli` 且不带参数，CLI 会询问项目名称和模板。

## 模板版本

Tsu 支持在初始化时锁定模板版本：

```bash
tsu-cli init admin-console --template vue3 --version 1.0.4
```

CLI 会解析到 GitHub release tag `template-v1.0.4`，并下载对应的模板资源。使用 `latest` 可以拉取最新模板 release。

## 私有模板仓库

团队可以维护自己的模板 release 仓库，并让 Tsu 指向该仓库：

```bash
tsu-cli init crm-web --template vue3 --repo company/frontend-templates
```

也可以通过环境变量设置默认模板仓库：

```bash
TSU_TEMPLATE_REPOSITORY=company/frontend-templates tsu-cli init crm-web --template vue3
```

如果使用私有 GitHub 仓库，请通过 shell 或 CI 中的标准 GitHub token 环境提供访问权限。不要把 token 写入生成项目。

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
| `@tsuz/template` | 内部模板 release asset 源 |
| `@tsuz/components` | 面向模板项目的 UI 组件和页面骨架 |
| `@tsuz/utils` | 面向模板项目的前端工具函数 |
| `@tsuz/sdk` | 面向模板项目的 API Client 基础层 |

短期内，主要用户价值是 `@tsuz/cli` 加项目模板。components、utils、sdk 后续应逐步成为生成项目里的默认能力层。

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
