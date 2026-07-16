import { access, mkdtemp, readFile, rm } from "node:fs/promises";
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
  await validateBuildArtifacts(projectRoot);
  await runPnpm(["lint"], projectRoot);
  await runPnpm(["test"], projectRoot);
  process.stdout.write(`Validated generated monorepo at ${projectRoot}\n`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function validateBuildArtifacts(projectRoot) {
  const packages = [
    {
      directory: "components",
      exports: {
        "./vue": ["./dist/vue/index.js", "./dist/vue/index.d.ts"],
        "./react": ["./dist/react/index.js", "./dist/react/index.d.ts"]
      }
    },
    {
      directory: "utils",
      exports: {
        "./js": ["./dist/js/index.js", "./dist/js/index.d.ts"]
      }
    },
    {
      directory: "template",
      exports: {
        ".": ["./dist/index.js", "./dist/index.d.ts"]
      }
    }
  ];

  for (const packageDefinition of packages) {
    const packageRoot = join(projectRoot, packageDefinition.directory);
    const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));

    for (const [subpath, expectedTargets] of Object.entries(packageDefinition.exports)) {
      const exported = packageJson.exports?.[subpath];
      const actualTargets = [exported?.import, exported?.types];

      if (actualTargets.some((target, index) => target !== expectedTargets[index])) {
        throw new Error(`Generated ${packageDefinition.directory} export ${subpath} does not match its build artifacts.`);
      }

      for (const target of actualTargets) {
        await access(join(packageRoot, target));
      }
    }
  }
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
