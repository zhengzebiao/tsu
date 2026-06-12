# npm 发布流程复盘与踩坑记录

本文档记录本仓库从 npm 发布流程搭建到最终成功发布 `@tsuz/*` 包的过程、最终配置，以及期间遇到的问题和解决方式。

## 最终发布结果

最终已成功发布以下 npm 包：

- `@tsuz/cli`
- `@tsuz/components`
- `@tsuz/sdk`
- `@tsuz/utils`

最终成功版本：

```text
0.1.1
```

发布方式：

```text
GitHub Actions + Changesets + npm Trusted Publishing + OIDC provenance
```

## 最终包结构

npm 发布 5 个顶层包：

```text
@tsuz/cli
@tsuz/template
@tsuz/components
@tsuz/sdk
@tsuz/utils
```

不发布：

```text
tests
script
components/vue
components/react
utils/js
```

其中：

```js
import { vueComponentPreset } from "@tsuz/components/vue";
import { reactComponentPreset } from "@tsuz/components/react";
import { isPlainObject } from "@tsuz/utils/js";
```

`components/vue`、`components/react`、`utils/js` 只是源码子目录，不是独立 npm 包。

## 最终 workflow 配置要点

文件：

```text
.github/workflows/npm-release.yml
```

关键配置：

```yaml
permissions:
  contents: write
  pull-requests: write
  id-token: write
```

其中：

- `contents: write`：允许 changesets/action 提交 Version PR 分支
- `pull-requests: write`：允许 changesets/action 创建 Version PR
- `id-token: write`：允许 GitHub Actions 获取 OIDC token，用于 npm Trusted Publishing

release job 中需要先升级 npm CLI 到最新版。Trusted Publishing / OIDC 发布依赖较新的 npm 行为，不能只依赖 Node 20 自带的 npm：

```yaml
- run: npm install -g npm@latest
- run: npm --version
- run: pnpm install --frozen-lockfile
- run: pnpm build
```

并通过：

```yaml
NPM_CONFIG_PROVENANCE: true
```

启用 provenance / Trusted Publishing。

不再需要：

```yaml
NPM_TOKEN
NODE_AUTH_TOKEN
```

## npm Trusted Publisher 配置

每个发布包都需要配置 Trusted Publisher：

```text
@tsuz/cli
@tsuz/components
@tsuz/sdk
@tsuz/utils
```

每个包的配置都应该是：

```text
Publisher: GitHub Actions
Organization or user: zhengzebiao
Repository: tsu
Workflow filename: npm-release.yml
Environment name: 留空
Allowed actions: Allow npm publish
```

注意：

- `Repository` 是 GitHub 仓库名 `tsu`
- 不是 npm scope `tsuz`
- `Workflow filename` 填 `npm-release.yml`
- 如果 workflow 没有配置 `environment:`，npm 的 `Environment name` 必须留空

## package.json repository 要求

使用 npm Trusted Publishing + provenance 时，发布包的 `package.json` 必须包含和 GitHub provenance 匹配的仓库地址。

最终需要：

```json
"repository": {
  "type": "git",
  "url": "https://github.com/zhengzebiao/tsu"
}
```

这个字段需要加到 4 个发布包：

```text
cli/package.json
components/package.json
sdk/package.json
utils/package.json
```

否则 npm 会报：

```text
E422 Unprocessable Entity
Error verifying sigstore provenance bundle
package.json: "repository.url" is "", expected to match "https://github.com/zhengzebiao/tsu" from provenance
```

## 正常发布流程

### 1. 开发变更

修改代码后执行：

```bash
pnpm build
pnpm lint
pnpm test
pnpm npm:release:preflight
pnpm npm:release:pack
```

### 2. 创建 changeset

```bash
pnpm changeset
```

选择需要发布的包和版本类型：

```text
patch
minor
major
```

### 3. 提交并推送

```bash
git add .
git commit -m "..."
git push origin master
```

### 4. GitHub Actions 创建 Version PR

`changesets/action` 会创建或更新：

```text
Version Packages
```

### 5. 合并 Version PR

合并后会再次触发 `push -> master`。

### 6. 自动发布 npm

`changesets/action` 会执行：

```bash
pnpm release:publish
```

最终发布到 npm。

## 本次踩坑记录

### 1. npm scope 权限问题：`@tsu` 无法发布

最初使用：

```text
@tsu/cli
@tsu/components
@tsu/sdk
@tsu/utils
```

但 npm scope `@tsu` 不属于当前账号，导致发布权限受限。

解决方式：

```text
@tsu -> @tsuz
```

同时同步修改：

- package name
- Changesets 配置
- docs
- template 生成逻辑
- preflight 校验脚本
- changelog

### 2. scoped package 默认 private，首次手动发布需要 `--access public`

如果执行：

```bash
npm publish ./sdk
```

可能报：

```text
E402 Payment Required
You must sign up for private packages
```

原因是 scoped package 默认按 private 发布。

正确方式：

```bash
npm publish ./sdk --access public
```

### 3. 本机未登录 npm：`ENEEDAUTH`

报错：

```text
ENEEDAUTH
This command requires you to be logged in
```

解决：

```bash
npm login
npm whoami
```

### 4. scope 不存在：`Scope not found`

报错：

```text
E404 Scope not found
```

说明 npm 上还没有对应 scope，或当前账号没有该 scope 权限。

解决方式：

- 创建 npm organization / scope
- 或改成自己可控的 scope，例如本次改为 `@tsuz`

### 5. GitHub Actions 无法创建 Version PR

报错：

```text
GitHub Actions is not permitted to create or approve pull requests
```

原因是仓库 Actions 权限不足。

解决：

```text
GitHub repo -> Settings -> Actions -> General -> Workflow permissions
```

开启：

```text
Read and write permissions
Allow GitHub Actions to create and approve pull requests
```

### 6. Changesets ignore 不能写目录名

错误配置：

```json
"ignore": ["template", "tests", "script"]
```

CI 报错：

```text
The package or glob expression "template" is specified in the ignore option but it is not found in the project
```

原因：Changesets 这里校验的是 package name，不是目录名。

正确配置应使用 package name。当前 `@tsuz/template` 已作为模板核心包发布，因此只忽略内部测试和脚本包：

```json
"ignore": ["@tsuz/tests", "@tsuz/script"]
```

### 7. release job 没有 build，导致发布包缺少 dist

现象：发布时出现类似：

```text
No bin file found at dist/index.js
```

原因：validate job build 过，但 release job 是独立环境，没有构建产物。

解决：在 release job 中也执行：

```yaml
- run: pnpm build
```

### 8. npm CLI 路径写死导致 CI 找不到 npm

最初 pack 校验脚本尝试通过 Node 安装目录拼接 npm CLI：

```text
.../node_modules/npm/bin/npm-cli.js
```

在 GitHub Actions Linux 环境中报：

```text
Cannot find module '/opt/hostedtoolcache/node/.../node_modules/npm/bin/npm-cli.js'
```

解决：直接调用系统 `npm`：

```js
execFileAsync("npm", ["pack", "--json", "--dry-run"], {
  shell: process.platform === "win32"
});
```

### 9. NPM_TOKEN + 2FA 发布失败

报错：

```text
E403 Forbidden
Two-factor authentication or granular access token with bypass 2fa enabled is required
```

原因：传统 token 不满足 2FA / CI 发布要求。

最终解决：改用 npm Trusted Publishing，不再依赖 `NPM_TOKEN`。

### 10. Trusted Publisher repo 填错

错误理解：把 npm scope `tsuz` 当成 GitHub repo 填到 Trusted Publisher。

错误配置：

```text
Organization or user: zhengzebiao
Repository: tsuz
```

正确配置：

```text
Organization or user: zhengzebiao
Repository: tsu
```

### 11. Trusted Publisher 配置页面必须保存

在 npm package settings 中，如果仍看到：

```text
Save changes
```

说明还在编辑页，配置可能尚未保存。

保存后应该显示卡片：

```text
zhengzebiao/tsu
npm-release.yml
Permissions: npm publish
```

### 12. 只配置一个包不够

workflow 会一次发布 4 个包：

```text
@tsuz/cli
@tsuz/components
@tsuz/sdk
@tsuz/utils
```

所以 4 个包都要配置 Trusted Publisher。

只配置 `@tsuz/cli`，其他包仍会失败。

### 13. npm 版本过旧导致 Trusted Publishing 行为异常

虽然日志显示：

```text
No NPM_TOKEN found, but OIDC is available - using npm trusted publishing
```

但旧 npm 可能只完成 provenance 签名，publish 认证仍不完整。

解决：release job 中升级 npm：

```yaml
- run: npm install -g npm@latest
- run: npm --version
```

升级后错误从权限类问题前进到 provenance repository 校验问题，说明 OIDC 发布链路已经生效。

### 14. package repository.url 缺失导致 E422

报错：

```text
E422 Unprocessable Entity
Error verifying sigstore provenance bundle
package.json: "repository.url" is "", expected to match "https://github.com/zhengzebiao/tsu" from provenance
```

原因：npm Trusted Publishing 会校验包元数据中的 repository 和 GitHub OIDC provenance 是否一致。

解决：给发布包补：

```json
"repository": {
  "type": "git",
  "url": "https://github.com/zhengzebiao/tsu"
}
```

## 发布成功后的验证命令

```bash
npm view @tsuz/cli version
npm view @tsuz/template version
npm view @tsuz/components version
npm view @tsuz/sdk version
npm view @tsuz/utils version
```

也可以验证安装：

```bash
npm install @tsuz/cli
npm install @tsuz/template
npm install @tsuz/components
npm install @tsuz/sdk
npm install @tsuz/utils
```

## 2026-06-11 发布记录：`@tsuz/template` 首次发布

本次发布内容：

- `@tsuz/cli@0.2.3`
- `@tsuz/template@0.1.0`

发布过程：

1. `template-source-unification` 合并到 `master` 后，Changesets 生成 Version Packages 提交。
2. Version Packages 提交合并到 `master` 后触发 npm 发布。
3. `@tsuz/cli@0.2.3` 由 GitHub Actions / Changesets 成功发布。
4. `@tsuz/template@0.1.0` 首次发布时报错：

```text
E404 Not Found - PUT https://registry.npmjs.org/@tsuz%2ftemplate - Not found
The requested resource '@tsuz/template@0.1.0' could not be found or you do not have permission to access it.
```

判断：`@tsuz/template` 是首次发布包，npm scope/package 权限或 trusted publishing 配置未完全就绪，导致 CI 无法创建该 package。

处理：

1. 本地使用有权限的 npm 账号登录。
2. 在 `template/` 目录执行手动发布：

```bash
npm publish --access public
```

3. 发布成功后手动补充 git tag：

```bash
git tag @tsuz/template@0.1.0 995636c
git push origin @tsuz/template@0.1.0
```

4. 在 npm 上补齐 `@tsuz/template` 的 Trusted Publishing 配置，后续应由 GitHub Actions 自动发布。

最终校验：

```bash
npm view @tsuz/cli version
npm view @tsuz/template version
npm view @tsuz/cli@0.2.3 dependencies --json
git ls-remote --tags origin '@tsuz/cli@0.2.3' '@tsuz/template@0.1.0'
```

结果：

- `@tsuz/cli` latest 为 `0.2.3`。
- `@tsuz/template` latest 为 `0.1.0`。
- `@tsuz/cli@0.2.3` 依赖 `@tsuz/template@0.1.0`。
- `@tsuz/cli@0.2.3` 和 `@tsuz/template@0.1.0` git tag 均存在。
- 使用发布版 CLI 生成 MFE 模板通过。
- 生成的 MFE 项目 `pnpm install && pnpm test && pnpm build` 通过。

后续验证：

- `@tsuz/template` 的 Trusted Publishing 已补齐配置；下一次包含 `@tsuz/template` 的 changeset 发布时，应确认它能由 GitHub Actions 自动发布。
- 如果 GitHub Actions 已成功发布部分包但中途失败，需检查是否存在“npm 已发布但 git tag 未创建”的半完成状态，并手动补齐缺失 tag。

## 当前结论

最终成功路径是：

```text
@tsuz scope
+ Changesets
+ GitHub Actions
+ npm Trusted Publishing
+ id-token: write
+ NPM_CONFIG_PROVENANCE=true
+ npm@latest
+ package.json repository.url 匹配 GitHub repo
```

这套流程已经通过 `0.1.1` 版本发布验证。
