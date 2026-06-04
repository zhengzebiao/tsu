import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "cli", "dist", "index.js");
const appTemplates = [
  { name: "vue3", projectName: "web-app" },
  { name: "react", projectName: "react-app" }
];
const tempRoot = join(repoRoot, "tmp", "validate-generated-apps");

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  for (const template of appTemplates) {
    const projectRoot = join(tempRoot, template.projectName);

    await runNode(cliEntry, ["init", template.projectName, "--template", template.name, "--local", "--cwd", tempRoot]);
    await runPnpm(["install"], projectRoot);
    await installLocalPackages(projectRoot);
    await runPnpm(["lint"], projectRoot);
    await runPnpm(["build"], projectRoot);
    process.stdout.write(`Validated generated ${template.name} app at ${projectRoot}\n`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function installLocalPackages(cwd) {
  await runPnpm(
    [
      "add",
      "-w",
      `@tsuz/components@file:${join(repoRoot, "components")}`,
      `@tsuz/utils@file:${join(repoRoot, "utils")}`,
      `@tsuz/sdk@file:${join(repoRoot, "sdk")}`
    ],
    cwd
  );
}

async function runNode(entry, args) {
  await execFileAsync(process.execPath, [entry, ...args], {
    cwd: repoRoot,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  });
}

async function runPnpm(args, cwd) {
  if (process.env.npm_execpath) {
    await execFileAsync(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024
    });
    return;
  }

  await execFileAsync("pnpm", args, {
    cwd,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  });
}
