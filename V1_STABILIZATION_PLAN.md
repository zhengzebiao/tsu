# Tsu v1.0 稳定化计划

> 范围冻结：本阶段只做 v1.0 稳定化、发布流程和文档收口；不做 preset、插件、市场、自动升级/迁移、新模板、完整企业私有化平台或后台服务。
>
> 版本统一：`@tsuz/cli`、`@tsuz/template` 与远程模板 Release 使用同一稳定版本 `1.0.0`。
>
> 远程清理：计划精确删除历史 GitHub Releases 和 remote tags `template-v1.0.0`～`template-v1.0.7`，再以当前稳定实现重新发布 `template-v1.0.0`。
>
> **强制前置条件：删除任何旧 Release 或 tag 前，必须先导出并核对 tag commit SHA、Release URL、发布时间、asset 名称/大小/digest，并把审计记录写入本文档。**

## Context

v0.5.0 已完成并成功发布，但当前行为还不适合直接冻结成 v1.0 公共契约。审计发现：默认远程 `latest` 没有记录实际模板版本，`upgrade-check` 可能推荐不含当前模板的 Release，自定义私有模板生成后可能在成功输出阶段报错，`doctor` 会误判 Python/私有模板，manifest 与 `.tsu/template.json` 缺少运行时校验，JSON/退出码尚未稳定，`--force` 允许项目名逃逸 `--cwd`；同时模板 Release 可覆盖同版本资产、CI 仅跑 quick 校验，npm 校验与发布环境没有完全对齐，文档也包含旧行为、旧示例和相互矛盾的 Roadmap。

本阶段只做 v1.0 稳定化、发布流程和文档收口；不做 preset、插件、市场、自动升级/迁移、新模板、完整企业私有化平台或后台服务。

版本决策：

- `@tsuz/cli`、`@tsuz/template` 与远程模板 Release 使用同一稳定版本 `1.0.0`。
- 远程 tag、archive 和 npm 版本保持一致：`template-v1.0.0`、`tsu-templates-v1.0.0.tar.gz`、npm `1.0.0`。
- 今后 CLI/template npm 与远程模板 bundle 采用同一 release train；涉及其中任何一项的稳定发布都同步升同一 SemVer。
- 删除远端历史 GitHub Releases 和 remote tags `template-v1.0.0`～`template-v1.0.7`，清理被占用的版本线，再以当前稳定实现重新发布 `template-v1.0.0`。
- 删除前先导出每个旧 tag 的 commit SHA、Release URL、发布时间、asset 名称/大小/digest，保留一份迁移审计记录；不删除其他 `template-v*` 版本。
- manifest 继续稳定现有 `schemaVersion: "0.5"` wire format，显式兼容 legacy manifest；manifest schema 版本不与产品/npm/template Release 版本混为一谈。

## 0. 先导出计划文档

实施获批后的第一步、任何代码或远端 Release 修改之前：

- 将本计划原样导出到项目根目录 `V1_STABILIZATION_PLAN.md`。
- 在文档顶部标明范围冻结、版本统一决策、旧远程 `template-v1.0.0`～`template-v1.0.7` 删除计划，以及“删除前必须先导出审计清单”。
- 后续实施进度、验证结果和仍需人工完成的 GitHub/npm 配置都在该文档维护；计划文档本身不触发 push 或发布。

## 1. 清理旧远程 1.0 模板版本线

这是不可逆的外部操作，严格按以下顺序执行：

1. 通过 GitHub API 和 Git 导出 `template-v1.0.0`～`template-v1.0.7` 的 tag SHA、Release 元数据与 asset digest，写入 `V1_STABILIZATION_PLAN.md` 的迁移审计附录。
2. 核对只命中这 8 个精确版本，不使用模糊匹配，不触碰 `template-v0.*` 或其他 tag。
3. 删除这 8 个 GitHub Releases，再删除对应 remote tags；清理本地同名 tags，避免后续创建稳定 `template-v1.0.0` 冲突。
4. 重新查询 GitHub Release 与 remote refs，证明 8 个旧版本均不存在；把验证结果写入计划文档。
5. 在 v1.0 稳定实现完成和所有 gates 通过前，不创建新的 `template-v1.0.0`。

旧 URL/asset 将失效，文档中所有历史 `1.0.x` 示例必须同步移除或改为明确的历史说明。

## 2. 冻结 CLI、schema 与进程契约

### 2.1 运行时 schema 与 SemVer

- 新增轻量内部 contracts/decoder 模块（手写 `unknown` 校验与 type guards，不引入完整 schema 框架），统一解析：
  - legacy manifest：无 `schemaVersion`、`templates: string[]`；
  - rich manifest：`schemaVersion: "0.5"`、rich template entries；
  - legacy metadata：允许缺少 `generatedAt`、允许历史 `version: "latest"`；
  - 新 metadata：来源、具体版本、仓库、时间格式必须一致。
- 未知 future schema 给出明确兼容错误；JSON 语法/字段错误转成可操作诊断，不能以 `TypeError` 崩溃。
- 引入并锁定成熟 `semver` 依赖，在 CLI 与 release scripts 中复用；统一校验、排序、去重、prerelease 规则和 leading `v` 归一化。
- 关键文件：`cli/src/template-release.ts`、建议新增 `cli/src/contracts.ts`、`template/src/index.ts`、`script/build-template-release.mjs`、`script/template-release-preflight.mjs`、`script/publish-template-release.mjs`。

### 2.2 初始化使用统一 resolved context

- 将远程/本地解析收口为内部 `ResolvedTemplateContext`，携带实际 source、concrete version、repository、tag/asset、validated definition、nextSteps、files。
- 复用 `resolveTemplateAssetSource`、`ensureTemplateBundle`、`templateDefinitions`；禁止远程失败后静默回退本地。
- `latest` 只作为输入 selector；远程生成和 `template info --version latest` 必须展示/记录实际解析版本。
- 本地生成记录安装的 `@tsuz/template` 版本并省略 repository；不再写 `local + latest` 或默认远程仓库。
- 自定义私有模板使用远程 manifest 的 `nextSteps`；未知模板没有 nextSteps 时只输出正确的 `cd` 提示，不再查内置定义后报错。
- `.tsu/template.json`、成功输出与真实生成内容全部来自同一个 resolved context。
- 关键文件：`cli/src/index.ts`、`cli/src/template.ts`、`cli/src/template-release.ts`、`cli/src/index.test.ts`。

### 2.3 参数、路径和公开 API

- 将 `project-name` 冻结为单个目录名：允许空格，拒绝空值、`.`、`..`、绝对路径、`/`、`\\`、NUL；在任何下载或 `rm` 前验证 resolved target 的父目录就是 resolved `--cwd`。
- 拒绝无意义组合：`--local` 与 `--version`/`--repo`/cache flags，及 `--no-cache --refresh`。
- 修正 trailing args、子命令 help、`--cwd` 下 `cd` 路径等现有语义不一致。
- v1 明确 `@tsuz/cli` 的稳定契约是 CLI binary；收窄/标注意外导出的 parser/message/cache internals，`@tsuz/template` 保持有意的程序化 API。
- 关键文件：`cli/src/index.ts`、`cli/package.json`、`cli/src/index.test.ts`。

### 2.4 JSON 与退出码

- `--json` 继续只用于 `doctor` 与 `upgrade-check`；成功结果保持当前 domain object，数组字段始终存在，可选 scalar 缺失时省略。
- fatal JSON invocation 只在 stdout 输出一个稳定 error envelope，stderr 为空：`{ "status": "error", "error": { "code", "message" } }`。
- 冻结退出码：
  - `0`：help/version/list/init 成功；doctor `ok|warning`；upgrade `current|update_available`；
  - `1`：doctor `error`；upgrade `unknown`；
  - `2`：参数、网络、schema、integrity 或其他执行失败。
- 新增独立 child-process contract tests，验证 stdout/stderr/newline/exit code，而不只调用 `runCli`。
- 关键文件：`cli/src/index.ts`、建议新增 `cli/src/cli-process.test.ts`。

## 3. 修复 doctor、upgrade-check 与版本发现

- `upgrade-check` 调用现有 `resolveTemplateVersions` 时传入 metadata template name，只考虑实际包含该模板的 Release；结果按 SemVer 降序、去重。
- `latest` 不再依赖 GitHub repository-wide `/releases/latest`：分页枚举 Release，过滤合法 tag/asset、draft、prerelease，并按模板与稳定 SemVer 选择最高版本；显式 prerelease 仍可直接指定。
- 为 legacy `version: "latest"` metadata 保留可读兼容并返回 unresolved warning；local source 不与远程模板版本比较；记录版本高于远端时返回明确 `unknown/ahead` 语义而非误报 current。
- `doctor` 以有效 metadata 为主要身份依据：
  - 内置 Node 模板检查 `package.json` 和既有 profile；
  - Python 模板检查 `pyproject.toml` 和既有 Python profile；
  - 自定义私有模板不强制内置 README marker 或 Node 文件；
  - 无 metadata 时才用 README marker 做 legacy fallback；
  - malformed metadata 变成诊断结果，不崩溃。
- 关键文件：`cli/src/index.ts`、`cli/src/template-release.ts`、两份现有 test files。

## 4. 固化模板资产完整性与不可变发布

- build archive 后用 Node `crypto` 生成 companion `tsu-templates-v<version>.tar.gz.sha256`，避免把自身 digest 放进 archive 造成循环定义。
- 新稳定契约从 `template-v1.0.0` 开始要求 companion checksum；CLI 下载后、缓存前、解压前校验 SHA-256，缓存 archive 与 checksum 并在复用时再次校验。
- 保留未删除旧版本的兼容读取；无 checksum 的旧资产明确视为“未验证 legacy release”。
- 发布器改为不可变：同 tag/release/asset 已存在即失败，不再 DELETE/replace；先创建本次 draft、上传 archive+checksum，全部成功后再 publish；失败只能清理本次未发布 draft，已发布版本用新 patch 修复。
- 发布脚本校验 tag、asset、manifest version、npm CLI/template 版本与当前 commit 一致；新增 source commit/build 信息到 release metadata（不写 secrets）。
- 关键文件：`script/build-template-release.mjs`、`script/publish-template-release.mjs`、`cli/src/template-release.ts`、对应 tests。

## 5. 对齐 release gates

### 5.1 Template Release

- PR 快速层：build/lint/unit tests、docs check、真实 archive+checksum、manifest/layout、通过 remote archive path 生成全部模板并验证 concrete metadata。
- tag 阻断层：对将发布的同一份 archive 运行现有 full MFE validation、monorepo validation、Python validation（Redis service）、默认/Vue/React/MFE smoke；复用 `generated-app-validation.mjs` 的 generation callback 模式扩展 monorepo/Python，避免复制检查逻辑。
- workflow build archive 一次并用 Actions artifact 在验证/发布 jobs 间传递；publish 依赖全部阻断 job；发布后重新下载 GitHub asset+checksum，显式版本与 latest 各做 smoke，验证 metadata 记录 `1.0.0`。
- 将 workflow permission 下放：默认/validation `contents: read`，仅 publish `contents: write`；增加 per-tag concurrency 与 job timeouts，不取消已开始的发布。
- 关键文件：`.github/workflows/template-release.yml`、`script/validate-template-release.mjs`、`script/generated-app-validation.mjs`、`script/validate-generated-monorepo.mjs`、`script/validate-generated-python.mjs`。

### 5.2 npm Release

- Node/pnpm/npm 工具链固定为已验证组合（Node 20.20.2、pnpm 8.15.9、npm 11.18.0），validate/release 两个 job 一致。
- workflow permission 下放：validate 只读；release 才有 `contents/pull-requests/id-token`；继续禁止 `NPM_TOKEN` 与 `NODE_AUTH_TOKEN`。
- 增加 concurrency 与 timeouts；release job 在 Changesets 发布前重新执行 build、preflight、pack/consumer smoke，避免只验证另一份构建。
- 强化 `npm-release-preflight.mjs` / `validate-npm-pack.mjs`：检查每个 `exports`/types/bin target 与 CLI runtime imports；生成真实 tarballs，在干净 consumer 中一起安装五个包，import documented exports/subpaths，运行 installed `tsu-cli --help/--version/init --local/doctor --json`。
- 定义版本耦合：本次 major Changeset 覆盖 `@tsuz/cli` 与 `@tsuz/template` 到 `1.0.0`；同一 verified commit 再发布 `template-v1.0.0`；components/utils/sdk 不因本阶段机械升 major。
- 关键文件：`.github/workflows/npm-release.yml`、`script/npm-release-preflight.mjs`、`script/validate-npm-pack.mjs`、`.changeset/config.json`、package manifests。

### 5.3 仓库外操作清单

代码不能直接保证以下配置，因此写入 operator runbook，在真正 v1 发布前人工完成并核对：

- 保护 `master` 并要求 build/test/docs/pack checks；
- 在新 `template-v1.0.0` 发布后禁止 `template-v*` tag force update/delete；
- 如使用 GitHub Environment，npm 每个 Trusted Publisher 配置必须使用完全相同 environment name；
- 核查五个 npm packages 的 Trusted Publisher 配置；
- 限制 release workflow 审批/触发权限。

## 6. 文档与 Roadmap 收口

- 统一定位为“面向团队的前后端工程模板 CLI”，不再写 frontend-only。
- 更新 `README.md`、`README.zh-CN.md`、`CLI_USAGE.md`：真实 no-arg TTY/non-TTY 行为；本地示例补 `--local`；当前示例统一使用 `1.0.0` 或 `<template-version>`；说明 npm CLI/template、remote bundle 与 schema 的关系；写清 checksum、immutability、JSON/exit-code 与 source option contract。
- 新增 `PRIVATE_TEMPLATE_REPOSITORY.md` 与中文指南对齐，英文 README 不再跳到中文-only contract。
- 重写 `PRODUCT_PRD_ROADMAP.md` 为当前 v1 稳定化状态；明确所有可选增强不做；将旧分析/实现计划标记 Archived，避免继续充当当前承诺。
- 收口 npm/template release runbooks：五个 npm 包配置与验证一致；历史事故总结明确标记为历史，不再作为当前配置；Release 验证矩阵与 CI 实际层级一致。
- 增加 support matrix：Node/pnpm/npm、Python/PDM、Docker/Compose、GitHub.com private Release；明确 GHES 不在 v1 支持范围。
- 新增聚焦的 `script/validate-public-docs.mjs` 与 `docs:check`：本地链接、模板名、五个 npm 包、help option markers、过期 no-arg 输出、废弃版本示例、local examples 的 `--local`、中英文指南链接、Roadmap defer list；不建设文档站或新平台。
- 代表性文件：`README*.md`、`CLI_USAGE.md`、`PRODUCT_PRD_ROADMAP.md`、`PRIVATE_TEMPLATE_REPOSITORY*.md`、`npm-release-flow.zh-CN.md`、release verification docs、`package.json`、`V1_STABILIZATION_PLAN.md`。

## 7. 版本化与发布顺序

1. 第一提交只导出并确认 `V1_STABILIZATION_PLAN.md`，不修改功能代码。
2. 导出旧远程 `template-v1.0.0`～`template-v1.0.7` 审计清单并按第 1 节删除 Releases/tags，记录验证结果。
3. 完成稳定化代码、测试、workflow、文档并提交 major Changeset（CLI/template）。
4. 运行全部本地/CI gate；合并 Changesets Version PR，从同一 verified commit 发布 `@tsuz/cli@1.0.0` 与 `@tsuz/template@1.0.0`。
5. 从该 commit 创建新的 `template-v1.0.0`，由 full workflow 发布 archive+checksum。
6. 发布后执行 registry/GitHub smoke；失败发布新的 patch 版本，绝不修改已发布资产。

## Verification

基础与契约：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm docs:check
pnpm npm:release:preflight
pnpm npm:release:pack
```

模板 Release：

```bash
pnpm template:release:preflight --version=1.0.0
pnpm template:release:build --version=1.0.0
TEMPLATE_RELEASE_VALIDATE_MODE=contract TEMPLATE_VERSION=1.0.0 pnpm validate:template-release
REDIS_URL=redis://localhost:6379/15 TEMPLATE_RELEASE_VALIDATE_MODE=full TEMPLATE_VERSION=1.0.0 pnpm validate:template-release
shasum -a 256 -c dist/template-release/tsu-templates-v1.0.0.tar.gz.sha256
```

最终端到端验收：

- 旧 remote Releases/tags `template-v1.0.0`～`template-v1.0.7` 的审计记录已保存，精确删除已验证；
- child-process tests 证明 JSON/stdout/stderr/exit-code 契约；
- traversal sentinel 未被 `--force` 删除；
- remote latest metadata 记录 concrete `1.0.0`；
- custom private template 成功并使用 remote nextSteps；
- Python/private doctor 不误报；legacy manifest/metadata 仍可读；
- upgrade-check 只建议含该模板的版本；
- checksum mismatch 和 duplicate publish 必须失败；
- tag workflow 验证并发布同一份 artifact；
- 干净 consumer 可安装五个 npm tarball、import 支持 API、执行 installed CLI；
- `@tsuz/cli@1.0.0`、`@tsuz/template@1.0.0` 与新 `template-v1.0.0` 来自同一 verified commit，版本一致，发布后 smoke 通过。

## 迁移审计附录

尚未导出。删除任何历史 GitHub Release 或 remote tag 前，必须先填写本节并完成人工核对。
