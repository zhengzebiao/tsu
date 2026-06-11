# Monorepo 多包仓库技术规范

## 1. 目标

- 统一管理 `cli`、`template`、`components`、`utils`、`sdk`
- `cli` 作为 npm 发布包，负责模板拉取、初始化和命令入口
- `template` 作为共享模板核心包发布到 npm，同时用于构建 GitHub Release asset
- npm 发布面收敛为 `@tsuz/cli`、`@tsuz/template`、`@tsuz/components`、`@tsuz/utils`、`@tsuz/sdk`
- 统一使用 `pnpm + Turborepo + Changesets`
- 所有可发布包统一使用 ESM 输出
- npm scope 统一命名为 `@tsuz`

## 2. 范围

| 目录 | 角色 | 发布到 npm |
| --- | --- | --- |
| `cli` | CLI 工具包 | 是 |
| `template` | 共享模板核心包，发布为 `@tsuz/template` | 是 |
| `components` | Vue / React 组件包，发布为 `@tsuz/components` | 是 |
| `utils` | JS 工具包，发布为 `@tsuz/utils` | 是 |
| `sdk` | SDK 包 | 是 |
| `tests` | 测试资源 | 否 |
| `script` | 构建/发布脚本 | 否 |

## 3. 仓库结构

```text
.
├── cli/
├── template/
├── components/
│   ├── vue/
│   └── react/
├── utils/
│   └── js/
├── sdk/
├── tests/
└── script/
```

- `components` 和 `utils` 保留二级源码目录，通过 npm subpath exports 暴露 `@tsuz/components/vue`、`@tsuz/components/react`、`@tsuz/utils/js`
- 实际 npm 包只发布 `@tsuz/components` 和 `@tsuz/utils`，不拆成 `@tsuz/components-vue`、`@tsuz/components-react`、`@tsuz/utils-js`
- `cli`、`template`、`sdk` 均作为独立 package 发布
- `tests/script` 为内部目录，必须标记为 `private`

## 4. 技术栈

- **pnpm**：workspace 和依赖管理
- **Turborepo**：任务编排、缓存、增量构建
- **Changesets**：版本管理、changelog、发布流程
- **ESM**：统一模块输出格式

## 5. Package 规范

每个可发布 package 必须满足：

- 存在独立 `package.json`
- 使用 `type: module`
- 通过 `exports` 暴露入口
- 产物输出到 `dist`
- 保留 `types` 声明（如适用）
- 通过 `files` 控制发布内容
- 不输出 CJS 产物

内部目录必须满足：

- `package.json` 中设置 `private: true`
- 不作为 release target 参与版本发布
- 不进入 `npm pack` / `npm publish` 产物

## 6. Template 分发

- `template/` 是内置模板定义和渲染逻辑的唯一源码目录
- CLI 本地生成通过 `@tsuz/template` 复用模板核心逻辑
- GitHub Release asset 从同一模板核心构建，CLI 可按名称/版本拉取
- 模板需保证本地生成和远程拉取后都可直接初始化运行

## 7. 构建与发布

### 7.1 构建

- 使用 `turbo run build test lint`
- package 间依赖通过 workspace 解析
- 构建产物仅输出 `dist`

### 7.2 版本管理

- 版本由 Changesets 驱动
- 变更以 changeset 记录
- 按 package 独立升级和发布
- 仅发布发生变更的 package

### 7.3 发布流程

1. 开发变更代码
2. 生成 changeset
3. 执行测试和构建
4. 执行 `changeset version`
5. 执行 `changeset publish`
6. 发布后验证安装和导入

## 8. 质量门槛

- `build` 通过
- `test` 通过
- npm install / import 通过
- CLI 模板下载和初始化通过
- 发布包仅包含公开 API
- `tests/script` 不进入 tarball

## 9. 验收标准

- `@tsuz/cli`、`@tsuz/template`、`@tsuz/components`、`@tsuz/utils`、`@tsuz/sdk` 可作为 npm 包正常安装和使用
- `@tsuz/components/vue`、`@tsuz/components/react`、`@tsuz/utils/js` 可作为 subpath import 正常导入
- `@tsuz/cli` 可复用 `@tsuz/template` 进行本地模板初始化
- 模板可通过 GitHub Release asset 被 CLI 拉取并初始化
- 仓库采用 `pnpm + Turborepo + Changesets`
- 所有可发布包均为 ESM
- `tests/script` 不参与发布
