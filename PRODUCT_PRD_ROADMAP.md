# Tsu 产品 PRD / Roadmap

> 版本：v0.1  
> 日期：2026-06-02  
> 关联分析：[PRODUCT_ANALYSIS.md](PRODUCT_ANALYSIS.md)  
> 项目定位：面向前端团队的可版本化工程模板 CLI。

## 1. 背景

当前仓库已经具备以下基础能力：

- 使用 `pnpm + Turborepo + Changesets` 管理多包工程。
- `@tsuz/cli` 支持 `init` 初始化项目。
- 模板支持 `default`、`vue3`、`react`、`mfe`、`monorepo`。
- 模板可通过 GitHub Release asset 按版本分发。
- npm 发布面规划为 `@tsuz/cli`、`@tsuz/template`、`@tsuz/components`、`@tsuz/utils`、`@tsuz/sdk`。

但当前产品仍偏工程实现，缺少清晰的用户入口、CLI 体验、模板解释、模板质量验证和市场差异化表达。

本 PRD 目标是把 Tsu 从“可运行的脚手架工程”推进为“用户愿意使用、团队可以推广的工程模板产品”。

## 2. 产品愿景

Tsu 希望成为前端团队的标准项目初始化入口。

> **让团队用一条命令生成可运行、可构建、可部署、可持续维护的标准前端工程。**

长期来看，Tsu 不只是一个模板生成器，而是一个面向团队的模板体系：

- 模板可版本化
- 模板可私有化
- 模板可验证
- 模板可描述
- 模板可升级
- 模板可扩展

## 3. 产品定位

### 3.1 推荐定位

> **Tsu 是一个面向前端团队的可版本化工程模板 CLI，用于快速生成带 CI、Docker、TypeScript、Lint、路由、状态管理和发布规范的标准项目。**

### 3.2 不建议的定位

不建议定位为：

- 又一个 `create-app`
- 通用组件库
- 通用 SDK
- 通用工具函数库
- 个人模板集合

原因：这些方向已有强竞品，且当前项目在这些领域的独立价值还不够强。

### 3.3 核心差异化

| 维度 | 普通脚手架 | Tsu 推荐差异化 |
| --- | --- | --- |
| 模板分发 | 通常内置在 CLI 包中 | GitHub Release asset 独立分发 |
| 模板版本 | 多数不强调 | 支持模板版本锁定 |
| 团队使用 | 需要二次改造 | 面向团队标准化 |
| 工程完整度 | 多为最小模板 | CI / Docker / Lint / Router / State 组合能力 |
| 企业私有化 | 不一定支持 | 支持 `--repo` 指向私有模板仓库 |
| 长期演进 | 初始化后基本结束 | 未来支持模板升级与健康检查 |

## 4. 目标用户

### 4.1 Persona A：前端开发者

#### 用户画像

- 需要快速启动 Vue / React 项目。
- 不想重复配置 ESLint、TypeScript、Docker、CI。
- 更关心“生成后能不能马上跑起来”。

#### 用户目标

- 1 分钟内创建项目。
- 复制命令后可以直接启动开发。
- 出错时知道怎么解决。

#### 核心场景

```bash
tsu-cli init web-app --template vue3
cd web-app
pnpm install
pnpm dev
```

### 4.2 Persona B：前端团队负责人 / 架构师

#### 用户画像

- 负责团队工程规范。
- 希望统一项目目录、依赖版本、CI、Docker、Lint、发布流程。
- 关注模板是否可维护、可升级、可推广。

#### 用户目标

- 新项目统一从标准模板创建。
- 模板版本可控。
- 模板变更有记录、有验证。
- 新人能通过模板快速进入团队规范。

#### 核心场景

```bash
tsu-cli init admin-console --template vue3 --version 1.0.4
tsu-cli init platform --template monorepo --repo company/frontend-templates
```

### 4.3 Persona C：内部平台 / 工程效能团队

#### 用户画像

- 维护公司内部 CLI 和模板体系。
- 需要支持多个业务线、多个技术栈、多个版本。
- 关注私有仓库、模板版本、自动化验证、可观测指标。

#### 用户目标

- 能集中管理模板。
- 能通过 release 分发模板。
- 能记录模板 changelog。
- 能验证每个模板生成后可用。

#### 核心场景

```bash
TSU_TEMPLATE_REPOSITORY=company/frontend-templates tsu-cli init crm-web --template vue3 --version 2.1.0
```

## 5. 产品目标

### 5.1 近期目标：v0.2

让 Tsu 成为一个“用户看得懂、跑得通、愿意试”的 CLI 产品。

关键目标：

- 有根目录 README。
- CLI 有帮助信息。
- CLI 有模板列表。
- 初始化成功后有下一步提示。
- 主力模板生成后可安装、可 lint、可 build。

### 5.2 中期目标：v0.5

让 Tsu 成为一个“团队能推广”的工程模板工具。

关键目标：

- 模板 manifest 具备描述、标签、推荐场景。
- 支持查看远程模板详情。
- 支持模板版本查询。
- 每个模板都有 README。
- CI 自动验证模板生成质量。

### 5.3 长期目标：v1.0

让 Tsu 成为一个“可版本化、可私有化、可演进”的模板平台。

关键目标：

- 支持企业私有模板仓库最佳实践。
- 支持模板升级检查。
- 支持项目健康检查。
- 支持组织级 preset。
- 形成稳定 API 与 CLI 语义。

## 6. 成功指标

### 6.1 产品体验指标

| 指标 | v0.2 目标 | v0.5 目标 | v1.0 目标 |
| --- | --- | --- | --- |
| 首次初始化成功率 | ≥ 80% | ≥ 90% | ≥ 95% |
| 主力模板生成后 build 通过率 | ≥ 90% | ≥ 95% | ≥ 98% |
| CLI 帮助覆盖率 | 核心命令 | 全部命令 | 全部命令 + 示例 |
| 模板 README 覆盖率 | 重点模板 | 全部模板 | 全部模板 + FAQ |

### 6.2 工程质量指标

| 指标 | 目标 |
| --- | --- |
| `pnpm build` | 必须通过 |
| `pnpm lint` | 必须通过 |
| `pnpm test` | 必须通过 |
| 模板 release preflight | 必须通过 |
| npm pack 校验 | 必须通过 |
| 远程模板初始化 smoke test | 每次 release 必须覆盖主力模板 |

### 6.3 增长指标

如果作为开源产品：

- npm weekly downloads
- GitHub stars
- README 访问转化
- issue / discussion 活跃度
- 外部项目使用案例

如果作为内部产品：

- 新项目中 Tsu 初始化占比
- 模板复用项目数
- 初始化耗时下降
- 新人上手耗时下降
- 模板版本升级覆盖率

## 7. 范围定义

### 7.1 v0.2 范围

#### 必做

- 根目录 README。
- CLI `--help`。
- CLI `--version`。
- CLI `templates` 或 `template list`。
- `init` 成功后的 next steps。
- 模板列表与模板说明文档。
- Vue3 / React / MFE / Monorepo 模板 README。
- 模板生成后的基础验证脚本。

#### 可选

- 彩色终端输出。
- 简单交互式 init。
- npm 包 README 优化。

#### 不做

- 模板升级。
- 插件系统。
- 图形界面。
- 组件库大规模建设。
- SDK 大规模建设。

### 7.2 v0.5 范围

#### 必做

- 远程模板 manifest 扩展。
- CLI 展示模板详情。
- CLI 查询模板版本。
- 私有模板仓库使用文档。
- release 自动验证所有模板。
- 更完整的错误提示。

#### 可选

- 交互式 init 完整体验。
- 初始化后自动安装依赖。
- 初始化后自动 git init。
- 模板标签筛选。

#### 不做

- 模板自动升级写文件。
- 完整模板市场。
- 多语言模板生态。

### 7.3 v1.0 范围

#### 必做

- CLI 命令语义稳定。
- 模板 manifest schema 稳定。
- 项目生成元信息稳定。
- 模板 release / npm release 流程稳定。
- 企业私有模板方案稳定。
- 项目健康检查 MVP。

#### 可选

- 模板升级检查。
- 模板迁移建议。
- 组织级 preset。
- 插件机制 MVP。

## 8. 用户故事

### 8.1 初始化项目

作为前端开发者，我希望通过一条命令初始化一个 Vue3 项目，以便快速开始业务开发。

#### 验收标准

- 可以执行：

```bash
tsu-cli init web-app --template vue3
```

- 成功后生成 `web-app` 目录。
- 输出 next steps。
- 用户执行 `pnpm install && pnpm dev` 后能启动项目。

### 8.2 查看模板列表

作为开发者，我希望先查看有哪些模板，以便选择合适的模板。

#### 验收标准

- 可以执行：

```bash
tsu-cli templates
```

- 输出模板名、描述、推荐场景。
- 输出至少包含 `default`、`vue3`、`react`、`mfe`、`monorepo`。

### 8.3 锁定模板版本

作为团队负责人，我希望初始化项目时锁定模板版本，以便保证不同项目的工程基础一致。

#### 验收标准

- 可以执行：

```bash
tsu-cli init admin --template vue3 --version 1.0.4
```

- CLI 从 `template-v1.0.4` 对应 release 拉取模板。
- 初始化输出中明确展示模板版本。

### 8.4 使用私有模板仓库

作为内部平台团队，我希望使用公司自己的模板仓库，以便维护私有模板。

#### 验收标准

- 可以执行：

```bash
tsu-cli init admin --template vue3 --repo company/frontend-templates
```

- 可以通过环境变量配置默认模板仓库：

```bash
TSU_TEMPLATE_REPOSITORY=company/frontend-templates
```

- 文档说明 GitHub token / 私有仓库访问方式。

### 8.5 验证模板质量

作为维护者，我希望每次发布模板前自动验证生成项目，以便避免发布不可用模板。

#### 验收标准

- release 前自动生成每个模板项目。
- 对主力模板执行 install / lint / build。
- 验证失败时阻断 release。
- 验证日志可追踪。

## 9. 功能需求

### 9.1 CLI 基础命令

#### 9.1.1 `tsu-cli --help`

输出内容：

- 产品简介
- 常用命令
- 示例
- 文档链接

示例：

```text
Tsu CLI - versioned frontend project templates for teams

Usage:
  tsu-cli init [projectName] [options]
  tsu-cli templates
  tsu-cli --version

Examples:
  tsu-cli init web-app --template vue3
  tsu-cli init platform --template monorepo --version 1.0.4
```

#### 9.1.2 `tsu-cli --version`

输出当前 CLI 包版本。

#### 9.1.3 `tsu-cli templates`

输出内置模板列表。

v0.2 可以只展示本地内置模板；v0.5 再支持远程 manifest。

#### 9.1.4 `tsu-cli init`

继续作为核心命令。

增强点：

- 成功后输出 next steps。
- 错误时给出修复建议。
- 明确展示模板、版本、目标目录。

### 9.2 模板 manifest

#### v0.2 manifest

```json
{
  "version": "1.0.4",
  "templates": ["default", "vue3", "react", "mfe", "monorepo"]
}
```

#### v0.5 manifest

```json
{
  "version": "1.1.0",
  "templates": [
    {
      "name": "vue3",
      "title": "Vue 3 Web App",
      "description": "Vite + Vue Router + Pinia + ESLint + Docker + CI",
      "tags": ["vue", "vite", "spa", "docker"],
      "recommendedFor": ["admin", "web-app", "dashboard"],
      "node": ">=20",
      "packageManagers": ["pnpm"]
    }
  ]
}
```

### 9.3 模板 README

每个模板生成后应包含 `README.md`。

基础结构：

```md
# <projectName>

Generated by Tsu.

## Tech Stack

## Getting Started

## Scripts

## Project Structure

## Deployment

## FAQ
```

### 9.4 模板验证

每个模板应有验证级别。

| 模板 | install | lint | build | dev smoke | docker build |
| --- | --- | --- | --- | --- | --- |
| default | 可选 | 可选 | 可选 | 必须 | 无 |
| vue3 | 必须 | 必须 | 必须 | 建议 | 建议 |
| react | 必须 | 必须 | 必须 | 建议 | 建议 |
| mfe | 必须 | 必须 | 必须 | 建议 | 建议 |
| monorepo | 必须 | 必须 | 必须 | 无 | 无 |

## 10. 非功能需求

### 10.1 性能

- CLI 基础命令应在 1 秒内返回。
- 本地模板初始化应在 2 秒内完成，不包含安装依赖。
- 远程模板下载时间取决于网络，但应展示进度或阶段性提示。

### 10.2 兼容性

- Node.js：建议支持 Node 20+。
- 包管理器：主推 pnpm。
- 平台：macOS、Linux、Windows。
- Shell：需要兼容 PowerShell、CMD、Git Bash。

### 10.3 安全

- `--force` 删除目录前必须明确行为。
- 下载模板只从指定 GitHub Release asset 获取。
- 私有仓库 token 不应写入生成项目。
- 错误日志不应泄漏 token。

### 10.4 可维护性

- CLI 与 template 包中重复的模板定义需要逐步收敛。
- 模板 schema 需要版本化。
- Release 校验脚本需要覆盖主路径。
- 文档与命令行为要保持同步。

## 11. Roadmap

## 11.1 Milestone 1：产品最小闭环（0-2 周）

目标：让用户能看懂、装上、生成、跑起来。

### 交付项

| 编号 | 事项 | 优先级 | 说明 |
| --- | --- | --- | --- |
| M1-01 | 根目录 README | P0 | 面向用户，不是技术规范 |
| M1-02 | CLI `--help` | P0 | 展示命令与示例 |
| M1-03 | CLI `--version` | P0 | 输出 npm 包版本 |
| M1-04 | CLI `templates` | P0 | 展示模板列表 |
| M1-05 | init next steps | P0 | 创建成功后提示下一步 |
| M1-06 | 模板说明表 | P0 | README / CLI_USAGE 同步 |
| M1-07 | 模板 README | P1 | 至少覆盖 vue3 / react / mfe / monorepo |
| M1-08 | 生成模板验证脚本 | P1 | install / lint / build |

### 验收标准

- 用户只看 README 能完成一次 `vue3` 项目初始化。
- `tsu-cli --help` 有清晰示例。
- `tsu-cli templates` 能展示模板用途。
- `vue3` 和 `react` 生成后能 `pnpm install && pnpm build`。

## 11.2 Milestone 2：模板质量强化（2-4 周）

目标：让主力模板达到团队可用标准。

### 交付项

| 编号 | 事项 | 优先级 | 说明 |
| --- | --- | --- | --- |
| M2-01 | Vue3 模板完善 | P0 | 主力模板，补 README / FAQ / 结构说明 |
| M2-02 | React 模板完善 | P0 | 补齐到 Vue3 同等级别 |
| M2-03 | MFE 模板完善 | P1 | 强化运行说明、端口说明、部署说明 |
| M2-04 | Monorepo 模板完善 | P1 | 增加发布流程示例 |
| M2-05 | 模板验证 CI | P0 | Release 前自动生成并验证 |
| M2-06 | 错误提示优化 | P1 | 网络、模板不存在、目录存在等场景 |
| M2-07 | 文档重构 | P1 | README、CLI_USAGE、发布文档分层 |

### 验收标准

- 每个模板有 README。
- CI 能阻断不可用模板发布。
- 常见错误有可操作修复建议。

## 11.3 Milestone 3：版本化模板能力（1-2 个月）

目标：把“模板版本化”做成核心差异化。

### 交付项

| 编号 | 事项 | 优先级 | 说明 |
| --- | --- | --- | --- |
| M3-01 | 远程 manifest 扩展 | P0 | 模板描述、标签、推荐场景 |
| M3-02 | `template info` | P0 | 查看远程模板详情 |
| M3-03 | `template versions` | P1 | 查看可用模板版本 |
| M3-04 | 私有仓库文档 | P0 | 企业场景关键能力 |
| M3-05 | 生成元信息 | P1 | 记录模板来源、版本、生成时间 |
| M3-06 | 模板 changelog | P1 | 用户知道版本变化 |

### 验收标准

- 用户可以查询模板详情后再初始化。
- 用户可以锁定指定模板版本。
- 企业用户能按照文档配置自己的模板仓库。

## 11.4 Milestone 4：团队模板平台 MVP（2-3 个月）

目标：从 CLI 工具升级为团队模板体系。

### 交付项

| 编号 | 事项 | 优先级 | 说明 |
| --- | --- | --- | --- |
| M4-01 | 组织级 preset | P1 | `--preset company-vue-admin` |
| M4-02 | 项目健康检查 | P1 | 检查生成项目依赖、脚本、配置 |
| M4-03 | 模板升级检查 | P2 | 只检查，不自动改文件 |
| M4-04 | 插件机制调研 | P2 | 暂不强做 |
| M4-05 | 案例文档 | P1 | 展示团队使用方式 |

### 验收标准

- 团队可以定义自己的初始化规范。
- 已生成项目可以检查是否符合模板规范。
- 用户知道当前项目是否落后于最新模板。

## 12. 优先级矩阵

| 功能 | 用户价值 | 实现成本 | 风险 | 推荐优先级 |
| --- | --- | --- | --- | --- |
| 根 README | 高 | 低 | 低 | P0 |
| `--help` | 高 | 低 | 低 | P0 |
| `--version` | 中 | 低 | 低 | P0 |
| `templates` | 高 | 低 | 低 | P0 |
| init next steps | 高 | 低 | 低 | P0 |
| 模板 README | 高 | 中 | 低 | P1 |
| 模板验证 CI | 高 | 中 | 中 | P0 |
| 远程 manifest 扩展 | 高 | 中 | 中 | P1 |
| 私有仓库文档 | 高 | 低 | 低 | P1 |
| 交互式 init | 中 | 中 | 中 | P2 |
| 自动安装依赖 | 中 | 中 | 中 | P2 |
| 模板升级 | 高 | 高 | 高 | P3 |
| 插件系统 | 中 | 高 | 高 | P3 |

## 13. 发布策略

### 13.1 v0.2 发布

主题：开发者体验补齐。

发布内容：

- CLI help / version / templates
- README
- next steps
- 基础模板 README
- 基础模板验证

推荐宣传语：

> Tsu now provides a clearer CLI experience and documented frontend templates for team-ready project starts.

### 13.2 v0.5 发布

主题：版本化模板分发。

发布内容：

- 远程模板详情
- manifest 扩展
- 私有仓库指南
- release 验证增强

推荐宣传语：

> Tsu now supports richer versioned templates for teams and private repositories.

### 13.3 v1.0 发布

主题：团队工程模板 CLI 稳定版。

发布内容：

- 稳定 CLI 命令
- 稳定 manifest schema
- 稳定模板 release 流程
- 企业私有模板方案
- 项目健康检查 MVP

推荐宣传语：

> Tsu 1.0 is a stable versioned frontend template CLI for teams.

## 14. 风险与应对

### 14.1 风险：定位继续发散

表现：同时宣传 CLI、组件库、SDK、工具库，导致用户不知道核心价值。

应对：

- v1.0 前主线只宣传 CLI + 模板。
- components / utils / sdk 作为模板生态配套，不作为首页主卖点。

### 14.2 风险：模板维护成本失控

表现：模板越来越多，但验证不充分，生成后不可用。

应对：

- 每个新增模板必须有 README 和验证脚本。
- Release 前自动生成项目并运行质量门槛。
- 模板数量先少后精。

### 14.3 风险：与成熟脚手架差异不足

表现：用户认为不如直接用 Vite / Next / Nx。

应对：

- 强调团队标准化、模板版本化、私有模板仓库。
- 主打“工程完整模板”，不是“最小示例模板”。

### 14.4 风险：远程模板下载失败影响体验

表现：GitHub 网络不可用、Release 缺失、asset 格式错误。

应对：

- 错误提示给出 `--local` 或 `--repo` 解决方案。
- 文档说明模板 release 规范。
- 可考虑提供 fallback 策略。

## 15. 待决策问题

1. 项目品牌是否继续使用 `Tsu` / `tsu-cli`？
2. 默认模板仓库是否继续使用 `zhengzebiao/tsu`？
3. `components`、`utils`、`sdk` 是否继续作为公开 npm 包维护？
4. v0.2 是否要加入交互式 init？
5. 是否需要支持 npm / yarn / bun，还是短期只主推 pnpm？
6. 企业私有仓库是否需要 token 认证内置支持？
7. 模板生成后是否要记录 `.tsu/template.json` 元信息？

## 16. 下一步建议

建议立即进入 Milestone 1：

1. 新增根目录 README。
2. 实现 `tsu-cli --help`。
3. 实现 `tsu-cli --version`。
4. 实现 `tsu-cli templates`。
5. 优化 `init` 成功输出。
6. 给主力模板生成 README。
7. 增加模板生成验证脚本。

这 7 项完成后，项目会从“工程可运行”提升到“产品可试用”。
