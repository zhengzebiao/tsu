# 当前阶段与下一步计划

## 当前阶段

项目当前已经进入 **可发布、可验证、可通过 npm 和 GitHub Release 分发模板的前端工程脚手架阶段**。

目前已经具备：

- CLI 初始化项目能力；
- npm 包发布能力；
- GitHub Release 模板版本化分发能力；
- 远程模板下载初始化能力；
- 生成项目自动验证能力；
- MFE 模板可安装、lint、test、build；
- npm 包和 MFE 模板 release 均已发布并验证。

## 已完成内容

### 1. npm 发布

当前已发布版本：

- `@tsuz/cli@0.2.1`
- `@tsuz/components@0.2.0`
- `@tsuz/utils@0.2.0`
- `@tsuz/sdk@0.2.0`

### 2. 模板 Release 发布

当前最新模板版本：

- `template-v1.0.5`

已验证：

```bash
node cli/dist/index.js template info mfe --version 1.0.5
node cli/dist/index.js init verify-mfe --template mfe --version 1.0.5
```

### 3. MFE 模板完善

MFE 模板已完成：

- 修复子应用 entry 写死 localhost；
- 增加 `VITE_ENTRY_*` 环境变量；
- host 改为单一 `#subapp-container`；
- 修复导航整页刷新问题；
- 修复 qiankun lifecycle；
- 增加 ESLint；
- 增加 Vitest；
- 增加 `hostEventBus` 通信示例；
- 增加 `BrandBadge` 共享 UI 组件；
- 增加 MFE 生成项目自动验证；
- 增强 MFE README 使用文档和选型说明。

### 4. 自动化验证

已验证通过：

```bash
pnpm build
pnpm lint
pnpm test
pnpm validate:generated-apps
pnpm npm:release:preflight
pnpm npm:release:pack
```

`validate-generated-apps` 当前覆盖：

- vue3；
- react；
- mfe。

## 当前主要问题

### 1. 模板源仍未完全统一

虽然 MFE 已通过同步脚本降低漂移风险，但整体仍存在重复模板源：

- `template/src/*`
- `cli/src/*`

当前 MFE 已有同步机制，但 React、Vue3、default、monorepo 等模板仍需要进一步统一。

### 2. `@tsuz/template` 仍未作为公共模板核心包发布

当前 `@tsuz/template` 主要用于构建 GitHub Release asset，还不是正式 npm 发布包。

下一阶段将把它调整为统一模板源。

## 接下来要做什么

## 阶段一：MFE 运行时验证

目标：确认用户真实运行 MFE 模板时体验稳定。

要做：

1. 使用远程模板初始化：

```bash
tsu-cli init mfe-runtime-check --template mfe --version 1.0.5
```

2. 安装并启动：

```bash
cd mfe-runtime-check
pnpm install
pnpm dev
```

3. 浏览器验证：

- host 是否正常打开；
- `subapp` 是否正常挂载；
- `subapp-two` 是否正常挂载；
- 导航切换是否无整页刷新；
- theme 事件是否能从 host 传到子应用；
- 控制台是否无 qiankun / CORS / mount 错误。

4. 可选 Docker 验证：

```bash
pnpm docker:build
pnpm docker:run
```

## 阶段二：统一所有模板源

目标：让 CLI 本地模板和 GitHub Release 模板使用同一份源码。

采用方案：**方案 B：发布并复用 `@tsuz/template`**。

详细方案见：

- [TEMPLATE_SOURCE_UNIFICATION_PLAN.md](TEMPLATE_SOURCE_UNIFICATION_PLAN.md)

阶段二要点：

- 让 `@tsuz/template` 成为唯一模板源；
- 让 `@tsuz/cli` 依赖 `@tsuz/template`；
- 删除 CLI 内部重复模板实现；
- 移除临时同步脚本；
- 让 `@tsuz/template` 参与 npm 发布；
- 更新 npm pack / preflight 校验；
- 保证远程 template release 流程不受影响。

## 阶段三：完善 CLI 用户体验

目标：提升首次使用体验。

建议做：

- `init` 支持交互式模板选择；
- 成功初始化后按模板输出更具体 next steps；
- `doctor` 增加模板特定检查；
- `upgrade-check` 增加模板升级建议；
- `templates` 命令展示远程 latest version；
- `template info` 展示更多模板能力摘要。

## 阶段四：完善项目对外文档

目标：让用户快速理解 Tsu 的定位和使用方式。

建议更新根 README：

- npm 安装方式；
- 快速开始；
- 模板列表；
- MFE 模板亮点；
- 模板版本说明；
- npm 发布链路；
- GitHub Release 模板发布链路；
- 常见问题。

## 推荐下一步

优先做：

1. **MFE 浏览器级运行验证**；
2. **阶段二：统一所有模板源**，具体方案见 [TEMPLATE_SOURCE_UNIFICATION_PLAN.md](TEMPLATE_SOURCE_UNIFICATION_PLAN.md)。
