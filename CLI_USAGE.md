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
| `monorepo` | `tsu-cli init platform --template monorepo` | 符合当前 PRD 的 pnpm + Turborepo + Changesets 多包仓库模板 |

默认情况下，CLI 会尝试从 GitHub Release asset 拉取模板；如果提供了 `--local`，则使用本地模板生成。

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

## 参数说明

| 参数 | 示例 | 说明 |
| --- | --- | --- |
| `<projectName>` | `tsu-cli init demo-app` | 项目目录名，默认 `quick-start-app` |
| `--template` / `-t` | `tsu-cli init platform --template monorepo` | 指定模板名，目前支持 `default`、`monorepo` |
| `--version` / `-v` | `tsu-cli init platform --template monorepo --version 1.2.3` | 指定模板 Release 版本，不传时使用最新版本 |
| `--repo` | `tsu-cli init platform --repo owner/repo` | 指定 GitHub 仓库，默认读取 `TSU_TEMPLATE_REPOSITORY`、`GITHUB_REPOSITORY`，否则使用 `zhengzebiao/tsu` |
| `--local` | `tsu-cli init demo-app --local` | 强制使用本地模板，适合离线或开发调试 |
| `--cwd` | `tsu-cli init demo-app --cwd ./apps` | 指定项目生成的父目录 |
| `--force` / `-f` | `tsu-cli init demo-app --force` | 目标目录已存在时先删除再重新生成 |

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
node cli/dist/index.js init platform --template monorepo --cwd ./tmp
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

## npm 发布包

完整发布流程见 [npm-release-flow.zh-CN.md](npm-release-flow.zh-CN.md)。

npm 只发布以下顶层包：

- `@tsuz/cli`
- `@tsuz/components`
- `@tsuz/utils`
- `@tsuz/sdk`

不发布 `template`、`tests`、`script`，也不拆分发布 `@tsuz/components-vue`、`@tsuz/components-react`、`@tsuz/utils-js`。

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

CLI 使用远程模板：

```bash
tsu-cli init platform --template monorepo
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init platform --template monorepo
TSU_TEMPLATE_REPOSITORY=owner/repo tsu-cli init platform --template monorepo --version 1.0.0
```

默认仓库会回退到 `zhengzebiao/tsu`。
