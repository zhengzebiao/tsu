import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = readVersion();
const tag = `template-v${version}`;
const archivePath = join(repoRoot, "dist", "template-release", `tsu-templates-v${version}.tar.gz`);

await ensureRelease(tag);
await execGh(["release", "upload", tag, archivePath, "--clobber"]);
process.stdout.write(`Published ${archivePath} to GitHub Release ${tag}\n`);

function readVersion() {
  const versionArg = process.argv.find((arg) => arg.startsWith("--version="));
  const value = versionArg?.slice("--version=".length) ?? process.env.TEMPLATE_VERSION;

  if (!value) {
    throw new Error("Missing template release version. Use --version=<version> or TEMPLATE_VERSION.");
  }

  return value.replace(/^v/, "");
}

async function ensureRelease(tagName) {
  const releaseFile = join(repoRoot, "dist", "template-release", `${tagName}.json`);

  try {
    await execGh(["release", "view", tagName]);
  } catch {
    await execGh(["release", "create", tagName, "--title", tagName, "--notes", `Template release ${tagName}`]);
  }

  await writeFile(releaseFile, `${JSON.stringify({ tag: tagName, archive: archivePath }, null, 2)}\n`, "utf8");
}

async function execGh(args) {
  await execFileAsync("gh", args, {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
}
