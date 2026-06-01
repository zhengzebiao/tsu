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

  if (!manifest.templates.includes("default") || !manifest.templates.includes("monorepo") || !manifest.templates.includes("vue3") || !manifest.templates.includes("mfe")) {
    throw new Error("Release manifest does not include expected templates.");
  }

  await access(join(bundleDir, "default", "package.json"));
  await access(join(bundleDir, "monorepo", "package.json"));
  await access(join(bundleDir, "vue3", "package.json"));
  await access(join(bundleDir, "mfe", "package.json"));
  process.stdout.write(`Validated release archive ${archivePath}\n`);
} finally {
  await rm(tempDir, { force: true, recursive: true });
}

async function ensureArchive() {
  await access(archivePath).catch(() => {
    throw new Error(`Missing release archive: ${archivePath}. Run pnpm template:release:build --version=${version} first.`);
  });
}
