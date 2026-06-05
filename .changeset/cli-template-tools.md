---
"@tsuz/cli": minor
---

Add template release tooling and project diagnostics to the CLI.

- `tsu-cli template versions [name]` lists template release versions from GitHub releases.
- `tsu-cli template info <name> --version <value>` shows template details from a specific release.
- `tsu-cli doctor` checks whether a directory is a generated Tsu project and reports template metadata and expected files.
- `tsu-cli upgrade-check` compares the recorded template version against available releases and reports upgrade suggestions.
- Generated projects now include `.tsu/template.json` recording the template name, version, source, and repository.
