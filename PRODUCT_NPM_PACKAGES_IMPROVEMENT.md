# Tsu npm 包产品与用户提升方案

> 日期：2026-06-02  
> 范围：基于当前仓库内 `cli`、`template`、`components`、`utils`、`sdk` 等包规划，从产品价值、用户体验和落地路线角度提出提升建议。  
> 关联文档：[prd.md](prd.md)、[PRODUCT_ANALYSIS.md](PRODUCT_ANALYSIS.md)、[PRODUCT_PRD_ROADMAP.md](PRODUCT_PRD_ROADMAP.md)、[CLI_USAGE.md](CLI_USAGE.md)

## 1. 核心结论

当前仓库不应被包装成“多个 npm 包的集合”，而应该被产品化为：

> **Tsu 是一套面向前端团队的标准工程套件：CLI 负责创建项目，template 负责场景模板，components / utils / sdk 负责生成项目后的标准开发体验。**

短期内，真正有产品雏形和用户入口的是 **CLI + template**。`components`、`utils`、`sdk` 当前能力还较薄，不建议作为独立主卖点推广，而应先作为模板生态的配套能力，服务于“生成一个可运行、可构建、可部署、可持续维护的标准前端工程”这个核心价值。

## 2. 当前 npm 包定位评估

| 包 | 当前角色 | 当前问题 | 建议产品定位 |
| --- | --- | --- | --- |
| `@tsuz/cli` | 项目初始化 CLI | 用户入口已有，但帮助、模板列表、交互体验仍需增强 | 主入口：创建标准工程 |
| `@tsuz/template` | CLI 模板源 | 不应作为用户侧 npm 包暴露 | 内部模板资产，不对外发布 |
| `@tsuz/components` | Vue / React 子路径组件包 | 当前仅有 preset，独立价值不足 | 模板配套 UI 基础组件与页面骨架 |
| `@tsuz/utils` | JS 工具函数包 | 当前函数数量少，场景价值不明显 | 模板项目里的高频工程工具 |
| `@tsuz/sdk` | 基础 SDK 包 | 当前仅保存 `baseUrl`，不足以支撑 SDK 价值 | 模板默认 API Client / 请求层 |

用户更容易理解的表达不是：

> 我们有 CLI、组件库、工具库、SDK。

而是：

> 用 Tsu 创建项目后，项目已经内置团队常用的 UI、工具函数、请求 SDK、CI、Docker、Lint、TypeScript 规范。

## 3. 产品叙事建议

### 3.1 推荐定位

> **Tsu 是一个面向前端团队的可版本化工程模板 CLI，用于快速生成带 CI、Docker、TypeScript、Lint、路由、状态管理、基础组件、工具函数和请求 SDK 的标准前端工程。**

### 3.2 不建议定位为

- 通用组件库
- lodash 替代品
- 通用 SDK
- 又一个简单 create-app
- 个人模板集合

原因：这些方向已有强竞品，且当前项目在这些领域的独立能力还不足。Tsu 的优势应放在“团队工程标准化”和“模板生态闭环”。

## 4. `components` 提升方案

### 4.1 产品定位

`@tsuz/components` 不建议直接对标 Element Plus、Ant Design、Naive UI、Arco Design 等成熟组件库。

更适合的定位是：

> **面向 Tsu 模板的轻量基础组件与页面骨架。**

也就是说，它不是为了覆盖所有 UI 场景，而是为了让生成项目一开始就具备统一的后台布局、状态展示和基础交互体验。

### 4.2 推荐优先组件

| 组件 | 用户价值 |
| --- | --- |
| `AppLayout` / `AdminLayout` | 新项目直接有后台骨架 |
| `PageContainer` | 页面标题、描述、操作区统一 |
| `EmptyState` | 空数据展示统一 |
| `LoadingState` | 加载态统一 |
| `ErrorState` | 错误态统一 |
| `ConfirmDialog` | 删除、危险操作统一 |
| `ThemeProvider` / `ThemeTokens` | 为后续主题体系铺路 |
| Form helpers | 支撑后台系统常用表单体验 |

### 4.3 Vue / React 策略

当前 `@tsuz/components` 通过 subpath 暴露：

- `@tsuz/components/vue`
- `@tsuz/components/react`

这个方向可以保留，但产品上要明确：

1. Vue 模板默认推荐 `@tsuz/components/vue`。
2. React 模板默认推荐 `@tsuz/components/react`。
3. 两边 API 尽量语义一致。
4. 不强求实现完全一致，但文档结构和使用方式应保持一致。
5. 组件包应设置合理的 `peerDependencies`，避免把 Vue / React 直接打进包内。

### 4.4 用户体验增强

建议补齐：

- `@tsuz/components` README。
- Vue / React 最小使用示例。
- 组件列表与适用场景。
- 模板内实际使用示例。
- 文档站，例如 VitePress、Storybook 或 Histoire。
- 每个组件的 props、slots、events / callbacks 文档。

## 5. `utils` 提升方案

### 5.1 产品定位

`@tsuz/utils` 不建议走“堆通用函数”的路线，也不建议做 lodash 替代品。

更适合的定位是：

> **服务于 Tsu 模板项目的高频工程工具集合。**

每个工具函数都应该能回答：

> 它在 Tsu 生成的项目里解决什么问题？

如果回答不了，就不应优先加入。

### 5.2 推荐模块

| 模块 | 示例能力 | 用户价值 |
| --- | --- | --- |
| `env` | `getEnv`、`requireEnv`、`parseBooleanEnv` | 解决 Vite 环境变量处理 |
| `url` | `joinUrl`、`withQuery`、`parseQuery` | SDK / 路由通用 |
| `storage` | `createStorage`、JSON 序列化、本地偏好存取 | 登录态、主题偏好、用户设置 |
| `object` | `pick`、`omit`、`compactObject` | 表单提交前数据清洗 |
| `async` | `sleep`、`retry`、`withTimeout` | 请求、轮询、异步任务 |
| `error` | `toErrorMessage`、`isErrorLike` | 统一错误展示 |
| `browser` | `copyText`、`downloadBlob` | 后台系统常用能力 |
| `route` | `normalizeMenuRoutes` | 后台布局和菜单配套 |

### 5.3 包设计建议

建议保持子路径导出，例如：

```ts
import { retry } from "@tsuz/utils/js";
```

后续如果能力变多，可以进一步拆分：

```ts
import { retry } from "@tsuz/utils/js/async";
import { createStorage } from "@tsuz/utils/js/storage";
```

但早期不建议拆太细，避免增加使用成本。

## 6. `sdk` 提升方案

### 6.1 产品定位

当前 `@tsuz/sdk` 只有基础配置能力，无法形成清晰用户价值。建议扩展为：

> **Tsu 模板默认的 API Client 基础层，负责请求、错误、认证、拦截器和类型友好封装。**

### 6.2 MVP 能力

| 能力 | 用户价值 |
| --- | --- |
| `createClient({ baseUrl })` | 项目生成后有统一请求入口 |
| `get` / `post` / `put` / `delete` | 不用每个项目重复封装 fetch |
| request interceptor | 统一加 token、trace id 等 |
| response interceptor | 统一处理错误和响应格式 |
| timeout | 避免请求长时间挂起 |
| retry | 提升弱网或临时失败场景稳定性 |
| typed response | TypeScript 友好 |
| SDK error class | UI 层可识别错误类型 |
| auth token provider | 适配登录态 |
| mock adapter 可选 | 模板开发阶段可用 |

### 6.3 推荐使用形态

```ts
import { createClient } from "@tsuz/sdk";

const api = createClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
  getToken: () => localStorage.getItem("token")
});

const users = await api.get<User[]>("/users");
```

这比单纯暴露 `getBaseUrl()` 更容易让用户理解 SDK 的价值。

## 7. 包之间的闭环体验

理想用户体验不是分别安装多个包，而是：

```bash
tsu-cli init admin-web --template vue3
cd admin-web
pnpm install
pnpm dev
```

生成后的项目应该已经具备：

- `@tsuz/components/vue` 或 `@tsuz/components/react`
- `@tsuz/utils/js`
- `@tsuz/sdk`
- 示例页面
- 示例请求
- 示例布局
- 示例错误处理
- 示例环境变量

### 7.1 推荐模板示例闭环

在 Vue3 / React 模板中内置一个最小业务闭环：

1. 页面使用 `PageContainer`。
2. 页面通过 `@tsuz/sdk` 请求 mock 数据。
3. 请求错误用 `@tsuz/utils/js` 格式化。
4. 列表为空显示 `EmptyState`。
5. 加载中显示 `LoadingState`。
6. 模板 README 告诉用户如何替换或删除示例。

这样用户能马上感知：

> 这不是空模板，而是一个可以继续开发的工程起点。

## 8. 用户分层与价值表达

### 8.1 普通前端开发者

核心诉求：快速创建可运行项目。

应突出：

- 一条命令创建项目。
- 不用重复配置 CI / Docker / Lint / Router / State。
- 生成后直接运行。
- 内置常用 UI、请求 SDK、工具函数。
- 出错时有明确提示。

### 8.2 前端团队负责人 / 架构师

核心诉求：团队工程标准化。

应突出：

- 统一项目结构。
- 统一依赖与工程规范。
- 模板版本可控。
- 新项目标准化。
- 降低新人上手成本。
- 组件、工具、SDK 都可作为团队标准能力沉淀。

### 8.3 内部平台 / 工程效能团队

核心诉求：维护公司内部模板体系。

应突出：

- 支持私有模板仓库。
- 支持 GitHub Release asset 分发。
- 支持模板版本锁定。
- 支持未来模板升级检查。
- 支持组织级 preset。
- 可以把 components / utils / sdk 作为组织级标准库。

## 9. 文档提升方案

当前文档更偏工程流程和发布规范，后续需要增加用户上手文档。

### 9.1 根 README 建议结构

1. Tsu 是什么。
2. 适合谁。
3. 快速开始。
4. 模板列表。
5. npm 包说明。
6. 生成项目后能得到什么。
7. 和 Vite / create-vue / create-react-app 的区别。
8. 企业私有模板使用。
9. Roadmap。
10. FAQ。

### 9.2 npm 包 README 建议结构

每个包都回答 5 个问题：

1. 这个包解决什么问题？
2. 适合什么用户？
3. 如何安装？
4. 最小使用示例是什么？
5. 在 Tsu 模板里如何使用？

尤其是 `components`、`utils`、`sdk`，不要只写 API，要写场景。

## 10. 优先级路线

### 10.1 P0：先让用户看懂、跑通

目标：让 Tsu 成为一个“用户看得懂、跑得通、愿意试”的 CLI 产品。

建议优先做：

1. 根目录 README。
2. CLI `--help`。
3. CLI `--version`。
4. CLI `templates` 或 `template list`。
5. 初始化成功后的 next steps。
6. 每个模板 README。
7. Vue3 / React 模板生成后自动验证。
8. npm 包 README 最小示例。

### 10.2 P1：让 npm 包有真实使用价值

目标：让 `components`、`utils`、`sdk` 不只是占位，而是在模板项目中可被真实使用。

建议优先做：

1. `@tsuz/sdk` 扩展为请求 client。
2. `@tsuz/utils` 增加 env、storage、error、async、url 等工程工具。
3. `@tsuz/components` 增加 5-8 个基础布局 / 状态组件。
4. 在 Vue3 / React 模板里实际使用这些包。
5. 增加完整 TypeScript 类型与示例。
6. 增加基础单元测试。

### 10.3 P2：让团队愿意推广

目标：让 Tsu 成为团队可以内部推广的工程模板工具。

建议继续做：

1. 模板 manifest 增加描述、标签、适用场景。
2. CLI 支持查看模板详情。
3. CLI 支持查看模板版本。
4. 私有模板仓库文档。
5. 模板 changelog。
6. 企业 preset。
7. release 自动验证所有模板。

### 10.4 P3：形成平台能力

目标：从脚手架升级为可持续演进的模板平台。

长期建议：

1. 模板升级检查。
2. 项目健康检查。
3. 组织级配置。
4. 模板市场。
5. 组件 / SDK / utils 的版本兼容矩阵。
6. 项目初始化和模板使用指标统计。

## 11. 推荐近期落地清单

如果只选择最近 2-3 周最值得做的事情，建议按下面顺序推进：

1. 新增根 README，把产品定位讲清楚。
2. 为 `@tsuz/cli` 增加 `--help`、`--version`、`templates`。
3. 为 Vue3 / React 模板补 README 和生成后 next steps。
4. 把 `@tsuz/sdk` 改造成最小请求 client。
5. 为 `@tsuz/utils` 增加 env、error、async、storage 基础工具。
6. 为 `@tsuz/components` 增加 `PageContainer`、`EmptyState`、`LoadingState`、`ErrorState`。
7. 在 Vue3 / React 模板中做一个示例页面，串联 components / utils / sdk。
8. 增加模板生成后的 smoke test，验证 install / lint / build。

## 12. 最终建议

Tsu 当前最关键的产品取舍是：

> **短期不要把 `components`、`utils`、`sdk` 当成独立增长点，而是把它们做成 Tsu 模板生成项目后的“默认能力层”。**

原因：

- CLI + template 已经有比较明确的用户场景。
- components / utils / sdk 当前还比较薄，单独发布吸引力不足。
- 如果这些包能在模板中形成闭环，用户会更容易感知价值。
- 对团队用户来说，“标准工程 + 标准组件 + 标准请求层 + 标准工具函数”比“几个 npm 包”更有吸引力。

一句话总结：

> **Tsu 的产品提升方向应该是从“多包 monorepo”升级为“前端团队标准工程套件”：CLI 负责创建，template 负责场景，components / utils / sdk 负责生成项目后的标准开发体验。**
