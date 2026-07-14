import { access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTemplateReleaseVersion } from "./template-release-version.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const normalizedVersion = readTemplateReleaseVersion();
const requiredPaths = [
  join(repoRoot, "script", "build-template-release.mjs"),
  join(repoRoot, "script", "generated-app-validation.mjs"),
  join(repoRoot, "script", "publish-template-release.mjs"),
  join(repoRoot, "script", "validate-generated-apps.mjs"),
  join(repoRoot, "script", "validate-generated-python.mjs"),
  join(repoRoot, "script", "validate-template-release.mjs"),
  join(repoRoot, ".github", "workflows", "template-release.yml"),
  join(repoRoot, "cli", "src", "index.ts"),
  join(repoRoot, "template", "src", "index.ts"),
  join(repoRoot, "template", "src", "python-deploy.ts")
];

for (const path of requiredPaths) {
  await access(path);
}

process.stdout.write(`Preflight ok for template-v${normalizedVersion}\n`);
process.stdout.write(`Expected asset: tsu-templates-v${normalizedVersion}.tar.gz\n`);
process.stdout.write(`Expected tag: template-v${normalizedVersion}\n`);
process.stdout.write("Next: pnpm validate:generated-apps\n");
process.stdout.write("Then: REDIS_URL=redis://localhost:6379/15 pnpm validate:generated-python\n");
process.stdout.write(`Then: pnpm template:release:build --version=${normalizedVersion}\n`);
process.stdout.write(`Then: TEMPLATE_VERSION=${normalizedVersion} pnpm validate:template-release\n`);
process.stdout.write(`Then: pnpm template:release:publish --version=${normalizedVersion}\n`);
