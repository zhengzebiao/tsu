# 私有模板仓库使用指南

本文档说明团队如何用自己的 GitHub 仓库分发 Tsu 模板。这里的“私有化”仅指私有 GitHub 模板仓库和 GitHub Release asset，不包含完整企业私有化平台、后台服务或私有部署版 Tsu 服务。

## 适用场景

- 公司内部平台团队维护统一工程模板。
- 模板仓库是 private repository，需要 token 访问。
- 不希望把内部模板发布到公开 npm 包或公开 GitHub Release。
- 希望继续使用 `tsu-cli init`、`template info`、`template versions`、`doctor`、`upgrade-check` 等 CLI 工作流。

## 发布约定

私有模板仓库需要按下面的 GitHub Release 约定发布模板包：

| 项目 | 约定 |
| --- | --- |
| GitHub release tag | `template-v<version>` |
| Release asset | `tsu-templates-v<version>.tar.gz` |
| 压缩包根目录 | `tsu-templates-v<version>/` |
| Manifest 文件 | `tsu-templates-v<version>/manifest.json` |
| 模板目录 | `tsu-templates-v<version>/<template-name>/...` |

示例：

```text
tsu-templates-v1.0.4/
├── manifest.json
├── vue3/
│   ├── package.json
│   └── src/
├── react/
│   ├── package.json
│   └── src/
└── monorepo/
    ├── package.json
    └── pnpm-workspace.yaml
```

## Manifest v0.5 schema

`manifest.json` 当前使用 schema version `0.5`。建议每个模板条目都提供完整描述，方便 `tsu-cli template info` 在初始化前展示模板用途。

```json
{
  "name": "tsuz-template",
  "schemaVersion": "0.5",
  "version": "1.0.4",
  "asset": "tsu-templates-v1.0.4.tar.gz",
  "changelog": [
    "Add Docker deployment workflow.",
    "Refresh Vue and React template documentation."
  ],
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

字段说明：

| 字段 | 说明 |
| --- | --- |
| `name` | manifest 名称，当前建议使用 `tsuz-template` |
| `schemaVersion` | manifest schema 版本，当前为 `0.5` |
| `version` | 模板 release 版本，应与 tag / asset 中的版本一致 |
| `asset` | release asset 文件名 |
| `changelog` | release 级变更说明，`template info` 会展示；旧 manifest 可不提供 |
| `templates[].name` | 模板命令名，例如 `vue3` |
| `templates[].title` | 面向用户展示的模板标题 |
| `templates[].description` | 模板能力说明 |
| `templates[].tags` | 模板标签 |
| `templates[].recommendedFor` | 推荐使用场景 |
| `templates[].node` | Node.js 版本要求；Python-only 模板可写 `not required` |
| `templates[].packageManagers` | 推荐包管理器，例如 `pnpm` / `pdm` |
| `templates[].nextSteps` | 初始化成功后的建议命令 |

## Token 配置

访问 private repository 或提高 GitHub API 额度时，在 shell 或 CI 中设置其中一个环境变量：

```bash
export GITHUB_TOKEN=ghp_xxx
# 或
export GH_TOKEN=ghp_xxx
```

要求：

- token 需要能读取目标 GitHub 仓库和 Release asset。
- CLI 只会把 token 放到 GitHub API / GitHub Release asset 请求头里。
- 不要把 token 写入模板文件。
- Tsu 不会把 token 写入生成项目的 `.tsu/template.json`。

生成项目 metadata 示例：

```json
{
  "template": {
    "name": "vue3",
    "version": "1.0.4",
    "source": "remote",
    "repository": "company/frontend-templates"
  },
  "generatedAt": "2026-07-13T12:00:00.000Z"
}
```

## 使用方式

### 1. 单次指定仓库

```bash
tsu-cli init crm-web --template vue3 --repo company/frontend-templates
```

指定版本：

```bash
tsu-cli init crm-web --template vue3 --version 1.0.4 --repo company/frontend-templates
```

查看模板详情和 release changelog：

```bash
tsu-cli template info vue3 --version 1.0.4 --repo company/frontend-templates
```

查看模板版本：

```bash
tsu-cli template versions vue3 --repo company/frontend-templates
```

### 2. 配置默认模板仓库

```bash
export TSU_TEMPLATE_REPOSITORY=company/frontend-templates

tsu-cli init crm-web --template vue3 --version 1.0.4
tsu-cli template info vue3 --version 1.0.4
tsu-cli template versions vue3
```

### 3. CI 中使用

```yaml
- name: Generate project from private templates
  env:
    TSU_TEMPLATE_REPOSITORY: company/frontend-templates
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: tsu-cli init crm-web --template vue3 --version 1.0.4
```

如果模板仓库不在当前 workflow 仓库里，确认 `GITHUB_TOKEN` 有跨仓库读取权限；必要时使用独立 GitHub token 存到 Actions secret。

## 缓存控制

Tsu 会按仓库和 asset 名称缓存已下载模板包。常用参数：

```bash
# 不读写本地缓存，单次直接下载到临时目录
tsu-cli init crm-web --template vue3 --version 1.0.4 --repo company/frontend-templates --no-cache

# 强制重拉并刷新缓存
tsu-cli template info vue3 --version 1.0.4 --repo company/frontend-templates --refresh
```

可以用 `TSU_TEMPLATE_CACHE_DIR` 指定缓存目录：

```bash
export TSU_TEMPLATE_CACHE_DIR=/tmp/tsu-template-cache
```

## 常见错误排查

### `Failed to resolve GitHub Release`

重点检查：

- `--repo` 或 `TSU_TEMPLATE_REPOSITORY` 是否是正确的 `owner/repo`。
- Release tag 是否存在，例如 `template-v1.0.4`。
- 私有仓库是否设置了 `GITHUB_TOKEN` 或 `GH_TOKEN`。
- token 是否有读取该仓库和 Release 的权限。

### `No tsu template asset found`

说明 Release 存在，但没有找到符合命名规则的 asset。

检查 Release asset 是否叫：

```text
tsu-templates-v<version>.tar.gz
```

例如：

```text
tsu-templates-v1.0.4.tar.gz
```

### `Failed to download template asset`

重点检查：

- token 是否有权限下载 private release asset。
- asset URL 是否属于 GitHub。
- Release asset 是否被删除或替换。
- 可用 `--refresh` 避免使用旧缓存。

### `Template "<name>" is not available`

说明压缩包已下载并读取 manifest，但 manifest 中没有该模板名。

检查：

- `manifest.json` 的 `templates[].name` 是否包含该模板。
- 压缩包内是否存在同名目录。
- CLI 命令里的 `--template` 是否拼写正确。

### 生成内容不是最新

可能是本地缓存命中旧 asset。可以用：

```bash
tsu-cli init crm-web --template vue3 --version 1.0.4 --repo company/frontend-templates --refresh
```

或单次跳过缓存：

```bash
tsu-cli init crm-web --template vue3 --version 1.0.4 --repo company/frontend-templates --no-cache
```

## 发布前自检清单

- [ ] GitHub Release tag 使用 `template-v<version>`。
- [ ] Release asset 使用 `tsu-templates-v<version>.tar.gz`。
- [ ] 压缩包根目录是 `tsu-templates-v<version>/`。
- [ ] 根目录包含 `manifest.json`。
- [ ] `manifest.json` 写入 `schemaVersion: "0.5"`。
- [ ] `manifest.json` 写入 release 级 `changelog`，方便用户升级前查看版本变化。
- [ ] 每个模板都有同名目录。
- [ ] 每个模板条目都包含 `title`、`description`、`tags`、`recommendedFor`、`node`、`packageManagers`、`nextSteps`。
- [ ] 私有仓库 token 只存在于 shell / CI secret，不写入模板和生成项目。
