# npm 发布流程说明

本文档说明 `tsu` monorepo 的 npm 包发布方式、Changesets 工作流，以及 GitHub Actions 所需配置。

## 发布包范围

npm 只发布 4 个顶层包：

- `@tsuz/cli`
- `@tsuz/components`
- `@tsuz/utils`
- `@tsuz/sdk`

不发布以下目录：

- `template`
- `tests`
- `script`
- `components/vue`
- `components/react`
- `utils/js`

其中 `components/vue`、`components/react`、`utils/js` 只是源码子目录，不是独立 npm 包。

## 导入方式

`@tsuz/components` 通过 subpath exports 暴露：

```js
import { vueComponentPreset } from "@tsuz/components/vue";
import { reactComponentPreset } from "@tsuz/components/react";
```

`@tsuz/utils` 通过 subpath exports 暴露：

```js
import { isPlainObject, pick } from "@tsuz/utils/js";
```

## 本地发布前校验

发布前建议执行：

```bash
pnpm build
pnpm lint
pnpm test
pnpm npm:release:preflight
pnpm npm:release:pack
```

说明：

- `pnpm build`：构建所有包
- `pnpm lint`：TypeScript 无输出校验
- `pnpm test`：运行测试
- `pnpm npm:release:preflight`：检查只有 4 个顶层包参与 npm 发布
- `pnpm npm:release:pack`：执行 dry-run pack，确认 tarball 内容符合预期

## NPM_TOKEN 配置

自动发布需要在 GitHub 仓库配置 `NPM_TOKEN`：

1. 登录 npmjs.com
2. 进入 `Access Tokens`
3. 创建 `Automation` token
4. 进入 GitHub 仓库 `Settings -> Secrets and variables -> Actions`
5. 新增 repository secret：

```text
Name: NPM_TOKEN
Secret: npmjs 生成的 token
```

workflow 会通过以下环境变量使用它：

```yaml
NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## PR 校验流程

当创建或更新指向 `master` 的 PR 时，会触发：

```text
pull_request -> master
```

执行内容：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm npm:release:preflight
pnpm npm:release:pack
```

PR 阶段只做校验，不会发布 npm。

## master 发布流程

当代码 push 到 `master` 后，会触发：

```text
push -> master
```

流程分两步：

1. 先执行和 PR 相同的校验
2. 校验通过后执行 `changesets/action`

`changesets/action` 会根据 `.changeset/*.md` 判断下一步动作：

- 如果有未消费的 changeset：创建或更新 Version PR
- 如果 Version PR 合并后：执行 `pnpm release:publish` 发布 npm

## Changeset 是什么

每次修改了需要发布到 npm 的包，都应该提交一个 changeset 文件。

可以运行：

```bash
pnpm changeset
```

它会询问：

1. 哪些包发生变更
2. 版本升级类型是 `patch`、`minor` 还是 `major`
3. changelog 内容

生成文件示例：

```md
---
"@tsuz/components": patch
"@tsuz/utils": patch
---

Add subpath exports for components and utils.
```

版本类型说明：

- `patch`：修复或小调整，例如 `0.0.1 -> 0.0.2`
- `minor`：新增兼容功能，例如 `0.0.1 -> 0.1.0`
- `major`：破坏性变更，例如 `0.1.0 -> 1.0.0`

如果没有 changeset 文件，Actions 会完成校验，但不会发布 npm。

## 推荐操作顺序

日常开发：

```text
修改代码
-> pnpm changeset
-> 提交代码和 .changeset/*.md
-> 创建 PR 到 master
-> 等待 PR 校验通过
-> 合并 PR
-> Actions 创建/更新 Version PR
-> 合并 Version PR
-> Actions 发布 npm
```

## 发布后验证

发布完成后可检查：

```bash
npm view @tsuz/cli version
npm view @tsuz/components version
npm view @tsuz/utils version
npm view @tsuz/sdk version
```

也可以在测试项目中验证导入：

```js
import { vueComponentPreset } from "@tsuz/components/vue";
import { reactComponentPreset } from "@tsuz/components/react";
import { isPlainObject } from "@tsuz/utils/js";
```
