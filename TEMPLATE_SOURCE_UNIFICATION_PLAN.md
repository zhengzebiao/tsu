# Template Source Unification Plan

> Date: 2026-06-11  
> Status: Implemented and verified  
> Related docs: [PRODUCT_PRD_ROADMAP.md](PRODUCT_PRD_ROADMAP.md), [PRODUCT_NPM_PACKAGES_IMPROVEMENT.md](PRODUCT_NPM_PACKAGES_IMPROVEMENT.md), [CLI_USAGE.md](CLI_USAGE.md), [npm-release-flow.zh-CN.md](npm-release-flow.zh-CN.md)

## Goal

Unify local CLI template generation and template release assets around one source of truth.

Before this change, the CLI carried duplicated template source files and used a sync script to copy MFE template code into the CLI package. That made template maintenance risky because one template change could require updates in multiple places.

The target architecture is:

- `@tsuz/template` owns all built-in template definitions and rendering logic.
- `@tsuz/cli` depends on `@tsuz/template` for local template generation.
- GitHub template release assets continue to use the same template core logic.
- npm release checks verify both packages are publishable and complete.

## Decisions

### 1. Publish `@tsuz/template`

`@tsuz/template` is a publishable infrastructure package, not just an internal directory. It is not the primary user-facing entry point, but publishing it makes the CLI dependency explicit and keeps npm installs reproducible.

Expected package role:

| Package | Role |
| --- | --- |
| `@tsuz/cli` | User-facing project creation CLI |
| `@tsuz/template` | Shared template core used by CLI local generation and template release assets |

### 2. Make CLI reuse the template package

`cli/src/template.ts` should re-export the public template API from `@tsuz/template`. The CLI should not keep separate copies of MFE or React template source files.

Required dependency:

```json
{
  "dependencies": {
    "@tsuz/template": "workspace:*"
  }
}
```

### 3. Remove sync-only template code

The following duplicate or sync-only files should not exist after unification:

- `cli/src/mfe.ts`
- `cli/src/react.ts`
- `script/sync-mfe-template.mjs`

The root package scripts should not expose `template:sync:mfe` or `template:sync:mfe:check` anymore.

### 4. Update release validation

npm release validation must treat `@tsuz/template` as one of the publishable packages.

Publishable npm packages:

- `@tsuz/cli`
- `@tsuz/template`
- `@tsuz/components`
- `@tsuz/utils`
- `@tsuz/sdk`

Private or non-published package directories:

- `tests`
- `script`
- `components/vue`
- `components/react`
- `utils/js`

Pack validation should verify:

- `@tsuz/cli` includes `dist/index.js` and `dist/template.js`.
- `@tsuz/template` includes `dist/index.js`, `dist/index.d.ts`, `dist/mfe.js`, and `dist/react.js`.
- Pack output does not include forbidden source directories such as `template/`, `tests/`, or `script/`.

### 5. Record the release impact

Changesets should bump:

- `@tsuz/template`: minor, because it becomes a publishable template core package.
- `@tsuz/cli`: patch, because it changes internal dependency wiring without changing CLI command semantics.

## Implementation Status

Completed:

- `@tsuz/template` is publishable and exports the template runtime from `dist/`.
- `@tsuz/cli` depends on and reuses `@tsuz/template`.
- Duplicate CLI template source files were removed.
- The MFE template sync script and root sync scripts were removed.
- npm preflight and pack validation include `@tsuz/template`.
- Documentation was updated to describe the 5-package npm release surface.
- Changeset was added for `@tsuz/template` and `@tsuz/cli`.

## Verification

Required verification before merging:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm npm:release:preflight
pnpm npm:release:pack
```

Current local result:

- `pnpm build`: passed
- `pnpm lint`: passed
- `pnpm test`: passed
- `pnpm npm:release:preflight`: passed
- `pnpm npm:release:pack`: passed

Note: after adding the workspace dependency, `pnpm install --frozen-lockfile` may be needed locally so `cli` can resolve `@tsuz/template` through the workspace link.

## Remaining Follow-ups

- Create a focused commit after reviewing the final diff.
- Open a PR and let Changesets create the Version PR after merge.
