import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv.find((arg) => arg.startsWith("--version="))?.slice("--version=".length) ?? process.env.TEMPLATE_VERSION;

if (!version) {
  throw new Error("Missing template version. Use --version=<version> or TEMPLATE_VERSION.");
}

const normalizedVersion = version.replace(/^v/, "");
const requiredPaths = [
  join(repoRoot, "script", "build-template-release.mjs"),
  join(repoRoot, "script", "publish-template-release.mjs"),
  join(repoRoot, "script", "validate-template-release.mjs"),
  join(repoRoot, ".github", "workflows", "template-release.yml"),
  join(repoRoot, "cli", "src", "index.ts"),
  join(repoRoot, "template", "src", "index.ts")
];

for (const path of requiredPaths) {
  await access(path);
}

process.stdout.write(`Preflight ok for template-v${normalizedVersion}\n`);
process.stdout.write(`Expected asset: tsu-templates-v${normalizedVersion}.tar.gz\n`);
process.stdout.write(`Expected tag: template-v${normalizedVersion}\n`);
process.stdout.write(`Next: pnpm template:release:build --version=${normalizedVersion}\n`);
process.stdout.write(`Then: pnpm template:release:publish --version=${normalizedVersion}\n`);
