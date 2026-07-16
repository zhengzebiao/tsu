# @tsuz/template

## 1.0.0

### Major Changes

- 7dde020: Stabilize the v1 template contract across local and remote generation, concrete version provenance, runtime manifest and metadata validation, safe project paths, template-aware doctor and upgrade checks, CLI process behavior, and immutable template release publishing.

## 1.0.0-next.0

### Major Changes

- 7dde020: Stabilize the v1 template contract across local and remote generation, concrete version provenance, runtime manifest and metadata validation, safe project paths, template-aware doctor and upgrade checks, CLI process behavior, and immutable template release publishing.

## 0.5.0

### Minor Changes

- 21d6329: Complete the Milestone 3 versioned template workflow.

  - Add manifest v0.5 metadata including schemaVersion, title, tags, recommended scenarios, next steps, and release-level changelog.
  - Record generated project metadata with generatedAt timestamps.
  - Document private template repository setup, token usage, release asset conventions, cache controls, and troubleshooting.
  - Improve template info, template versions, and upgrade-check guidance for versioned and private template repositories.
  - Strengthen template release validation for manifest metadata and generated project provenance.

## 0.4.0

### Minor Changes

- Add production-ready Python template release workflows with immutable tag deploys, image rollback, manual Alembic migration workflows, post-deploy health/smoke checks, Docker infra/app compose separation, and generated production runbooks.

## 0.3.0

### Minor Changes

- Publish the React MFE template suite with generated `mfe-main` and `mfe-app` templates, shared package scaffolding, CI/deploy workflows, release archive validation, and complete generated README guidance.

## 0.2.0

### Minor Changes

- Add python-app any-scope and any-role authorization helpers.

## 0.1.2

### Patch Changes

- 8661a04: Update generated Vue and React templates to depend on the current `@tsuz/components`, `@tsuz/sdk`, and `@tsuz/utils` package versions.

## 0.1.1

### Patch Changes

- e7ffee4: Enhance the MFE template README with sub app, communication, deployment, and remote version verification guidance.

## 0.1.0

### Minor Changes

- e429979: Publish the template core package and make the CLI reuse it for local template generation.
