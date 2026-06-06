# 阶段二：统一所有模板源

## 目标

统一 CLI 本地模板和 GitHub Release 模板的源码来源，避免现在 `cli/src/*` 和 `template/src/*` 双份维护。

## 选择方案

采用 **方案 B：发布并复用 `@tsuz/template`**。

也就是让：

- `@tsuz/template` 成为唯一模板源；
- `@tsuz/cli --local` 直接复用 `@tsuz/template`；
- GitHub Release asset 仍然由 `@tsuz/template` 构建；
- CLI 默认远程模板下载逻辑保持不变。

## 接下来要做什么

### 1. 调整 `@tsuz/template` 包定位

- 移除 `template/package.json` 中的 `private: true`。
- 确认 `exports`、`types`、`files` 包含运行所需的 dist 文件。
- 补齐 `repository` 信息。

### 2. 让 `@tsuz/template` 参与 npm 发布

- 修改 `.changeset/config.json`。
- 从 `ignore` 里移除 `@tsuz/template`。

当前：

```json
"ignore": ["@tsuz/template", "@tsuz/tests", "@tsuz/script"]
```

目标：

```json
"ignore": ["@tsuz/tests", "@tsuz/script"]
```

### 3. 让 CLI 依赖 `@tsuz/template`

在 `cli/package.json` 增加：

```json
"dependencies": {
  "@tsuz/template": "workspace:*"
}
```

### 4. 改造 CLI 本地模板逻辑

- 让 `cli/src/template.ts` 从 `@tsuz/template` 引入模板 API。
- 删除 CLI 内部重复模板实现。
- `--local` 初始化继续保留，但模板内容来自 `@tsuz/template`。

重点清理：

- `cli/src/mfe.ts`
- `cli/src/react.ts`
- `cli/src/template.ts` 里重复的 default / vue3 / monorepo 模板实现

### 5. 删除临时同步脚本

方案 B 落地后删除：

- `script/sync-mfe-template.mjs`
- `pnpm template:sync:mfe`
- `pnpm template:sync:mfe:check`
- `cli/package.json` 里 build 前同步 MFE 的逻辑

### 6. 更新发布校验脚本

让 npm 发布校验允许 5 个包：

- `@tsuz/cli`
- `@tsuz/template`
- `@tsuz/components`
- `@tsuz/utils`
- `@tsuz/sdk`

需要更新：

- `script/npm-release-preflight.mjs`
- `script/validate-npm-pack.mjs`
- 相关发布文档

### 7. 更新测试

- `template` 包继续负责模板结构测试。
- `cli` 包只验证 CLI 能通过 `@tsuz/template` 初始化项目。
- 保留并运行：

```bash
pnpm validate:generated-apps
```

确保 vue3 / react / mfe 都能生成、安装、lint、test、build。

### 8. 增加 changeset

建议：

```md
---
"@tsuz/template": minor
"@tsuz/cli": patch
---

Publish the template core package and make the CLI reuse it for local template generation.
```

### 9. 发布前验证

执行：

```bash
pnpm install
pnpm build
pnpm lint
pnpm test
pnpm validate:generated-apps
pnpm npm:release:preflight
pnpm npm:release:pack
```

### 10. 发布后验证

验证 npm：

```bash
npm view @tsuz/template version
npm view @tsuz/cli version
```

验证 CLI 本地模板：

```bash
npm install -g @tsuz/cli@latest
tsu-cli init local-mfe --template mfe --local
cd local-mfe
pnpm install
pnpm lint
pnpm test
pnpm build
```

验证远程模板仍可用：

```bash
tsu-cli init remote-mfe --template mfe --version <template-version>
```

## 验收标准

- `@tsuz/template` 已发布为 npm 包。
- `@tsuz/cli` 依赖 `@tsuz/template`。
- CLI `--local` 不再使用自己的重复模板源码。
- `cli/src/mfe.ts`、`cli/src/react.ts` 被删除或不再作为模板源。
- `pnpm validate:generated-apps` 通过。
- npm pack 校验通过。
- 远程 template release 流程不受影响。
