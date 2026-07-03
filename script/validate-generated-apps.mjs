import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliEntry = join(repoRoot, "cli", "dist", "index.js");
const appTemplates = [
  { name: "vue3", projectName: "web-app", useLocalPackages: true, commands: [["lint"], ["test"], ["build"]] },
  { name: "react", projectName: "react-app", useLocalPackages: true, commands: [["lint"], ["build"]] },
  { name: "mfe", projectName: "mfe-platform", useLocalPackages: false, commands: [["lint"], ["build"]] },
  {
    name: "mfe-main",
    projectName: "mfe-main-platform",
    useLocalPackages: false,
    commands: [["lint"], ["build"]],
    devSmoke: { command: ["dev"], url: "http://127.0.0.1:7200/" }
  },
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
    if (template.devSmoke) {
      await runDevSmoke(template, projectRoot);
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

  await execFileAsync(resolvePnpmCommand(), args, {
    cwd,
    env: process.env,
    maxBuffer: 20 * 1024 * 1024
  });
}

async function runDevSmoke(template, projectRoot) {
  const child = spawnPnpm(template.devSmoke.command, projectRoot);
  let output = "";

  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    await waitForHttp(template.devSmoke.url, 45_000);
  } catch (error) {
    throw new Error(`Dev smoke check failed for ${template.name}: ${error.message}\n${output}`);
  } finally {
    await stopProcess(child);
  }
}

function spawnPnpm(args, cwd) {
  if (process.env.npm_execpath) {
    return spawn(process.execPath, [process.env.npm_execpath, ...args], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
  }

  return spawn(resolvePnpmCommand(), args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);

      if (response.status >= 200 && response.status < 400) {
        await response.body?.cancel();
        return;
      }

      lastError = new Error(`Unexpected HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await sleep(500);
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function stopProcess(child) {
  if (!child.pid || child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/pid", String(child.pid), "/T", "/F"]).catch(() => undefined);
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(2_000).then(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    })
  ]);
}

function resolvePnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
