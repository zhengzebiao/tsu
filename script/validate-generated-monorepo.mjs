import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "cli", "dist", "index.js");

const tempRoot = await mkdtemp(join(tmpdir(), "tsu-monorepo-"));
const projectRoot = join(tempRoot, "platform");

try {
  await runNode(cliEntry, ["init", "platform", "--template", "monorepo", "--local", "--cwd", tempRoot]);
  await runPnpm(["install"], projectRoot);
  await runPnpm(["build"], projectRoot);
  await runPnpm(["lint"], projectRoot);
  await runPnpm(["test"], projectRoot);
  process.stdout.write(`Validated generated monorepo at ${projectRoot}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function runNode(entry, args) {
  await execFileAsync(process.execPath, [entry, ...args], {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
}

async function runPnpm(args, cwd) {
  if (process.env.npm_execpath) {
    await execFileAsync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024
    });
    return;
  }

  await execFileAsync("pnpm", args, {
    cwd,
    env: process.env,
    maxBuffer: 10 * 1024 * 1024
  });
}
