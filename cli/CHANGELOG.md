# @tsuz/cli

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
