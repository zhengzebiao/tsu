import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "cli", "dist", "index.js");
const appTemplates = [
  { name: "vue3", projectName: "web-app", useLocalPackages: true, commands: [["lint"], ["test"], ["build"]] },
  { name: "react", projectName: "react-app", useLocalPackages: true, commands: [["lint"], ["build"]] },
  { name: "mfe", projectName: "mfe-platform", useLocalPackages: false, commands: [["lint"], ["build"]] },
  { name: "mfe-main", projectName: "mfe-main-platform", useLocalPackages: false, commands: [["lint"], ["build"]] },
  { name: "mfe-app", projectName: "mfe-business-app", useLocalPackages: false, commands: [["lint"], ["build"]] }
];
const tempRoot = join(repoRoot, "tmp", "validate-generated-apps");

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  for (const template of appTemplates) {
    const projectRoot = join(tempRoot, template.projectName);

    await runNode(cliEntry, ["init", template.projectName, "--template", template.name, "--local", "--cwd", tempRoot]);
    if (template.useLocalPackages) {
      await useLocalPackages(projectRoot);
    }
    await runPnpm(["install"], projectRoot);
    for (const command of template.commands) {
      await runPnpm(command, projectRoot);
    }
    process.stdout.write(`Validated generated ${template.name} app at ${projectRoot}\n`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function useLocalPackages(projectRoot) {
  const packageJsonPath = join(projectRoot, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

  packageJson.dependencies = {
    ...packageJson.dependencies,
    "@tsuz/components": `file:${join(repoRoot, "components")}`,
    "@tsuz/utils": `file:${join(repoRoot, "utils")}`,
    "@tsuz/sdk": `file:${join(repoRoot, "sdk")}`
  };

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
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
