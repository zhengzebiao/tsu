import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishablePackages = ["cli", "template", "components", "utils", "sdk"];
const forbiddenPackages = ["tests", "script", "components/vue", "components/react", "utils/js"];

for (const packagePath of publishablePackages) {
  const manifest = await readPackageJson(packagePath);
  await validatePack(packagePath, manifest.name);
}

for (const packagePath of forbiddenPackages) {
  const manifest = await readPackageJson(packagePath);

  if (manifest.private !== true) {
    throw new Error(`${packagePath}/package.json must remain private`);
  }
}

process.stdout.write("npm pack validation ok\n");

async function validatePack(packagePath, packageName) {
  const { stdout } = await execFileAsync("npm", ["pack", "--json", "--dry-run"], {
    cwd: join(repoRoot, packagePath),
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === "win32"
  });

  const [result] = JSON.parse(stdout);
  const files = (result.files ?? []).map((file) => file.path);
  const unexpected = files.filter((file) => file.startsWith("template/") || file.startsWith("tests/") || file.startsWith("script/"));

  if (unexpected.length > 0) {
    throw new Error(`${packageName} pack output contains forbidden paths: ${unexpected.join(", ")}`);
  }

  if (result.name !== packageName) {
    throw new Error(`npm pack returned ${result.name} for ${packagePath}, expected ${packageName}`);
  }

  if (packageName === "@tsuz/cli") {
    const requiredCliFiles = ["dist/index.js", "dist/template.js"];
    const missing = requiredCliFiles.filter((file) => !files.includes(file));

    if (missing.length > 0) {
      throw new Error(`${packageName} pack output is missing runtime files: ${missing.join(", ")}`);
    }
  }

  if (packageName === "@tsuz/template") {
    const requiredTemplateFiles = ["dist/index.js", "dist/index.d.ts", "dist/mfe.js", "dist/react.js"];
    const missing = requiredTemplateFiles.filter((file) => !files.includes(file));

    if (missing.length > 0) {
      throw new Error(`${packageName} pack output is missing template runtime files: ${missing.join(", ")}`);
    }
  }
}

async function readPackageJson(packagePath) {
  return JSON.parse(await readFile(join(repoRoot, packagePath, "package.json"), "utf8"));
}
