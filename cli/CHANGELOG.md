# @tsuz/cli

## 1.0.0

### Major Changes

- 7dde020: Stabilize the v1 template contract across local and remote generation, concrete version provenance, runtime manifest and metadata validation, safe project paths, template-aware doctor and upgrade checks, CLI process behavior, and immutable template release publishing.

### Patch Changes

- Updated dependencies [7dde020]
  - @tsuz/template@1.0.0

## 1.0.0-next.0

### Major Changes

- 7dde020: Stabilize the v1 template contract across local and remote generation, concrete version provenance, runtime manifest and metadata validation, safe project paths, template-aware doctor and upgrade checks, CLI process behavior, and immutable template release publishing.

### Patch Changes

- Updated dependencies [7dde020]
  - @tsuz/template@1.0.0-next.0

## 0.5.0

### Minor Changes

- 21d6329: Complete the Milestone 3 versioned template workflow.

  - Add manifest v0.5 metadata including schemaVersion, title, tags, recommended scenarios, next steps, and release-level changelog.
  - Record generated project metadata with generatedAt timestamps.
  - Document private template repository setup, token usage, release asset conventions, cache controls, and troubleshooting.
  - Improve template info, template versions, and upgrade-check guidance for versioned and private template repositories.
  - Strengthen template release validation for manifest metadata and generated project provenance.

### Patch Changes

- Updated dependencies [21d6329]
  - @tsuz/template@0.5.0

## 0.4.0

### Minor Changes

- Add Python template deploy, rollback, migration, and production hardening artifacts to generated projects and CLI doctor expectations.

### Patch Changes

- Updated dependencies
  - @tsuz/template@0.4.0

## 0.3.0

### Minor Changes

- Publish the React MFE template suite with generated `mfe-main` and `mfe-app` templates, shared package scaffolding, CI/deploy workflows, release archive validation, and complete generated README guidance.

### Patch Changes

- Updated dependencies
  - @tsuz/template@0.3.0

## 0.2.6

### Patch Changes

- Updated dependencies
  - @tsuz/template@0.2.0

## 0.2.5

### Patch Changes

- 42826af: Improve remote template downloads with direct versioned Release assets, GitHub token support, and local cache controls.
- Updated dependencies [8661a04]
  - @tsuz/template@0.1.2

## 0.2.4

### Patch Changes

- Updated dependencies [e7ffee4]
  - @tsuz/template@0.1.1

## 0.2.3

### Patch Changes

- e429979: Publish the template core package and make the CLI reuse it for local template generation.
- Updated dependencies [e429979]
  - @tsuz/template@0.1.0

## 0.2.2

### Patch Changes

- Fix MFE template runtime active-app detection and cross-application theme events.

## 0.2.1

### Patch Changes

- Improve the bundled MFE template with production-safe sub app entries, ESLint and Vitest validation, shared communication examples, automated generated-project validation, and expanded usage documentation.

## 0.2.0

### Minor Changes

- 617d83a: Add template release tooling and project diagnostics to the CLI.

  - `tsu-cli template versions [name]` lists template release versions from GitHub releases.
  - `tsu-cli template info <name> --version <value>` shows template details from a specific release.
  - `tsu-cli doctor` checks whether a directory is a generated Tsu project and reports template metadata and expected files.
  - `tsu-cli upgrade-check` compares the recorded template version against available releases and reports upgrade suggestions.
  - Generated projects now include `.tsu/template.json` recording the template name, version, source, and repository.

## 0.1.3

### Patch Changes

- Fix CLI entrypoint detection when launched through global npm shims on Windows and Git Bash.

## 0.1.2

### Patch Changes

- Include all CLI runtime modules in the published npm package.

## 0.1.1

### Patch Changes

- Validate trusted publishing with a patch release.

## 0.1.0

### Minor Changes

- ac755d9: Prepare the initial npm release with subpath exports and release workflow support.
