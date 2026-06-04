# Tsu

[中文文档](README.zh-CN.md)

Tsu is a versioned frontend project template CLI for teams. It helps developers create standard projects with TypeScript, linting, CI, Docker, routing, state management, and release-friendly structure already in place.

Use it when a team wants new projects to start from the same engineering baseline instead of rebuilding the same setup in every repository.

## Quick Start

Install the CLI globally or run the built package in this repository.

```bash
npm install -g @tsuz/cli
```

Create a Vue 3 project:

```bash
tsu-cli init web-app --template vue3
cd web-app
pnpm install
pnpm dev
```

Create a React project:

```bash
tsu-cli init react-app --template react
cd react-app
pnpm install
pnpm dev
```

## Templates

| Template | Recommended For | Built In |
| --- | --- | --- |
| `default` | Minimal Node.js starter | `package.json`, `src/index.js` |
| `vue3` | Admin consoles, dashboards, web apps | Vite, Vue Router, Pinia, TypeScript, ESLint, Docker, CI |
| `react` | React web apps and dashboards | Vite, React Router, TypeScript, ESLint, Docker, CI |
| `mfe` | Micro frontend workspaces | Host app, Vue sub apps, qiankun, shared packages, Docker, CI |
| `monorepo` | Multi-package team repositories | pnpm workspace, Turbo, Changesets, TypeScript packages |

List templates from the CLI:

```bash
tsu-cli templates
```

## CLI Commands

```bash
tsu-cli --help
tsu-cli --version
tsu-cli templates
tsu-cli template list
tsu-cli init <project-name> --template <template-name>
```

### `init`

Create a project from a template.

```bash
tsu-cli init admin-console --template vue3
```

Useful options:

| Option | Description |
| --- | --- |
| `-t, --template <name>` | Template name: `default`, `vue3`, `react`, `mfe`, `monorepo` |
| `-v, --version <value>` | Template release version, for example `1.0.3` or `latest` |
| `--repo <owner/repo>` | GitHub repository that hosts template release assets |
| `--cwd <path>` | Directory where the project should be created |
| `--local` | Use bundled templates instead of GitHub release assets |
| `-f, --force` | Overwrite the target directory |

If you run `tsu-cli` without arguments in an interactive terminal, it asks for the project name and template.

## Template Versions

Tsu can lock project creation to a template release version:

```bash
tsu-cli init admin-console --template vue3 --version 1.0.4
```

The CLI resolves that to the GitHub release tag `template-v1.0.4` and downloads the matching template asset. Use `latest` to resolve the latest template release.

## Private Template Repositories

Teams can host their own template releases and point Tsu at that repository:

```bash
tsu-cli init crm-web --template vue3 --repo company/frontend-templates
```

You can also set a default repository with an environment variable:

```bash
TSU_TEMPLATE_REPOSITORY=company/frontend-templates tsu-cli init crm-web --template vue3
```

For private GitHub repositories, provide a token through the normal GitHub environment used by your shell or CI. Do not write tokens into generated projects.

## Generated Project Workflow

Most templates are designed to support this flow:

```bash
pnpm install
pnpm lint
pnpm build
pnpm dev
```

The generated project README includes template-specific scripts, structure notes, and deployment hints.

## Package Roles

Tsu is organized as a small product suite:

| Package | Role |
| --- | --- |
| `@tsuz/cli` | User-facing project creation CLI |
| `@tsuz/template` | Internal template release asset source |
| `@tsuz/components` | Template-oriented UI components and page building blocks |
| `@tsuz/utils` | Template-oriented frontend utility functions |
| `@tsuz/sdk` | Template-oriented API client foundation |

Short term, the main user value is `@tsuz/cli` plus the project templates. Components, utils, and SDK packages are intended to become default capability layers inside generated projects.

## Roadmap

Current focus:

- Make the CLI easy to understand in one minute.
- Keep templates installable, lintable, and buildable.
- Add template README files and generated-project guidance.
- Strengthen Vue 3 and React templates as the primary app starters.
- Expand template versioning and private repository workflows for teams.

Future work:

- Template detail and version query commands.
- Richer template manifest with descriptions, tags, and recommended scenarios.
- Template health checks and upgrade guidance.
- Organization presets and private template platform support.

## FAQ

### Is Tsu another create-app tool?

Not quite. Tsu focuses on team-standard engineering templates, releaseable template versions, and private template repositories.

### Which package manager should I use?

Tsu templates are designed around pnpm.

### Can I use a company-owned template repository?

Yes. Pass `--repo owner/name` or set `TSU_TEMPLATE_REPOSITORY`.

### Can I overwrite an existing directory?

Yes, pass `--force`. Use it carefully because the target directory is removed before files are written.
