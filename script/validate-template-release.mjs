import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.TEMPLATE_VERSION ?? "0.0.0";
const releaseDir = join(repoRoot, "dist", "template-release");
const archiveName = `tsu-templates-v${version}.tar.gz`;
const archivePath = join(releaseDir, archiveName);
const tempDir = await mkdtemp(join(tmpdir(), "tsu-release-"));

try {
  await ensureArchive();
  await execFileAsync("tar", ["-tzf", archiveName], { cwd: releaseDir, maxBuffer: 10 * 1024 * 1024 });
  const bundleDir = join(tempDir, `tsu-templates-v${version}`);
  await cp(join(releaseDir, `tsu-templates-v${version}`), bundleDir, { recursive: true });
  const manifest = JSON.parse(await readFile(join(bundleDir, "manifest.json"), "utf8"));

  const templateNames = manifest.templates.map((template) => template.name);

  const expectedTemplates = ["default", "monorepo", "vue3", "mfe", "react", "python-main", "python-app"];
  const missingTemplates = expectedTemplates.filter((templateName) => !templateNames.includes(templateName));

  if (missingTemplates.length > 0) {
    throw new Error(`Release manifest does not include expected templates: ${missingTemplates.join(", ")}.`);
  }

  if (!manifest.templates.find((template) => template.name === "vue3")?.description) {
    throw new Error("Release manifest does not include template details.");
  }

  await access(join(bundleDir, "default", "package.json"));
  await access(join(bundleDir, "monorepo", "package.json"));
  await access(join(bundleDir, "vue3", "package.json"));
  await access(join(bundleDir, "mfe", "package.json"));
  await access(join(bundleDir, "react", "package.json"));
  await access(join(bundleDir, "python-main", "pyproject.toml"));
  await access(join(bundleDir, "python-main", "app", "main.py"));
  await access(join(bundleDir, "python-main", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "python-main", "tests", "test_auth_api.py"));
  await access(join(bundleDir, "python-main", "tests", "test_token_service.py"));
  await access(join(bundleDir, "python-app", "pyproject.toml"));
  await access(join(bundleDir, "python-app", "app", "main.py"));
  await access(join(bundleDir, "python-app", ".github", "workflows", "ci.yml"));
  await access(join(bundleDir, "python-app", "tests", "test_profile_api.py"));
  process.stdout.write(`Validated release archive ${archivePath}\n`);
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

async function ensureArchive() {
  await access(archivePath).catch(() => {
    throw new Error(`Missing release archive: ${archivePath}. Run pnpm template:release:build --version=${version} first.`);
  });
}
