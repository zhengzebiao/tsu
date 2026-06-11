import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publishablePackages = [
  {
    name: "@tsuz/cli",
    path: "cli",
    entry: ".",
    files: ["dist/*.js", "dist/*.d.ts"]
  },
  {
    name: "@tsuz/template",
    path: "template",
    entry: ".",
    files: ["dist/*.js", "dist/*.d.ts"]
  },
  {
    name: "@tsuz/components",
    path: "components",
    entry: ["./vue", "./react"],
    files: ["dist/vue/index.js", "dist/vue/index.d.ts", "dist/react/index.js", "dist/react/index.d.ts"]
  },
  {
    name: "@tsuz/utils",
    path: "utils",
    entry: ["./js"],
    files: ["dist/js/index.js", "dist/js/index.d.ts"]
  },
  {
    name: "@tsuz/sdk",
    path: "sdk",
    entry: ".",
    files: ["dist/index.js", "dist/index.d.ts"]
  }
];
const privatePackages = [
  "tests",
  "script",
  "components/vue",
  "components/react",
  "utils/js"
];

for (const pkg of publishablePackages) {
  const manifest = await readPackageJson(pkg.path);
  assertPackage(manifest, pkg);
}

for (const path of privatePackages) {
  const manifest = await readPackageJson(path);

  if (manifest.private !== true) {
    throw new Error(`${path}/package.json must be private`);
  }
}

process.stdout.write("npm release preflight ok\n");

async function readPackageJson(packagePath) {
  return JSON.parse(await readFile(join(repoRoot, packagePath, "package.json"), "utf8"));
}

function assertPackage(manifest, expected) {
  if (manifest.name !== expected.name) {
    throw new Error(`${expected.path}/package.json must be ${expected.name}`);
  }

  if (manifest.private) {
    throw new Error(`${expected.path}/package.json must be publishable`);
  }

  if (manifest.type !== "module") {
    throw new Error(`${expected.path}/package.json must set type=module`);
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`${expected.path}/package.json must define files`);
  }

  const actualFiles = JSON.stringify(manifest.files);
  const expectedFiles = JSON.stringify(expected.files);
  if (actualFiles !== expectedFiles) {
    throw new Error(`${expected.path}/package.json files mismatch: expected ${expectedFiles}, got ${actualFiles}`);
  }

  if (expected.entry === ".") {
    if (!manifest.exports?.["."]) {
      throw new Error(`${expected.path}/package.json must export .`);
    }
  } else {
    for (const entry of expected.entry) {
      if (!manifest.exports?.[entry]) {
        throw new Error(`${expected.path}/package.json must export ${entry}`);
      }
    }
  }
}
