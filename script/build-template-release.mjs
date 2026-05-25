import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createTemplateSourceFiles, listTemplates, templateManifest } from "../template/dist/index.js";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readVersion();
const releaseDir = join(repoRoot, "dist", "template-release");
const bundleDir = join(releaseDir, `tsu-templates-v${version}`);
const archivePath = join(releaseDir, `tsu-templates-v${version}.tar.gz`);

await rm(releaseDir, { force: true, recursive: true });
await mkdir(bundleDir, { recursive: true });

await writeJson(join(bundleDir, "manifest.json"), {
  name: templateManifest.name,
  version,
  templates: listTemplates(),
  asset: `tsu-templates-v${version}.tar.gz`
});

for (const templateName of listTemplates()) {
  for (const file of createTemplateSourceFiles(templateName)) {
    const filePath = join(bundleDir, templateName, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf8");
  }
}

await createTarball(bundleDir, archivePath, releaseDir);
process.stdout.write(`${archivePath}\n`);

function readVersion() {
  const versionArg = process.argv.find((arg) => arg.startsWith("--version="));
  const value = versionArg?.slice("--version=".length) ?? process.env.TEMPLATE_VERSION;

  if (!value) {
    throw new Error("Missing template release version. Use --version=<version> or TEMPLATE_VERSION.");
  }

  return value.replace(/^v/, "");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createTarball(sourceDir, archive, cwdForArchive) {
  const archiveName = archive.split(/[\\/]/).at(-1);
  const sourceName = basename(sourceDir);

  await execFileAsync("tar", ["-czf", archiveName, "-C", dirname(sourceDir), sourceName], {
    cwd: cwdForArchive,
    maxBuffer: 10 * 1024 * 1024
  });
}

function basename(path) {
  return path.split(/[\\/]/).at(-1);
}
