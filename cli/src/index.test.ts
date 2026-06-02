import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createCliMessage, findTemplateAsset, getReleaseTag, initProject, normalizeEntrypointPath, normalizeTemplateVersion, parseInitArgs, runCli } from "./index.js";

test("createCliMessage reports template support", () => {
  assert.equal(createCliMessage(), "tsu-cli is ready to pull templates");
});

test("normalizeEntrypointPath resolves equivalent shim paths", () => {
  const windowsPath = "C:/nvm4w/nodejs/node_modules/@tsuz/cli/dist/index.js";
  const gitBashPath = "/c/nvm4w/nodejs/node_modules/@tsuz/cli/dist/index.js";

  assert.equal(normalizeEntrypointPath(gitBashPath), normalizeEntrypointPath(windowsPath));
});

test("parseInitArgs supports template cwd version source and force options", () => {
  assert.deepEqual(parseInitArgs(["demo", "--template", "default", "--version", "v1.2.3", "--cwd", "apps", "--local", "--force"], "/workspace"), {
    cwd: resolve("/workspace", "apps"),
    projectName: "demo",
    templateName: "default",
    version: "1.2.3",
    force: true,
    source: "local",
    repository: process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu"
  });
});

test("release helpers normalize versions and find assets", () => {
  assert.equal(normalizeTemplateVersion("v1.2.3"), "1.2.3");
  assert.equal(getReleaseTag("latest"), "latest");
  assert.equal(getReleaseTag("1.2.3"), "template-v1.2.3");
  assert.equal(
    findTemplateAsset({
      tag_name: "template-v1.2.3",
      assets: [{ name: "tsu-templates-v1.2.3.tar.gz", browser_download_url: "https://example.com/template.tar.gz" }]
    }).name,
    "tsu-templates-v1.2.3.tar.gz"
  );
});

test("parseInitArgs rejects unknown options", () => {
  assert.throws(() => parseInitArgs(["demo", "--unknown"]), /Unknown option: --unknown/);
});

test("initProject writes template files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "Demo App" });
    const packageJson = await readFile(join(result.targetDir, "package.json"), "utf8");
    const entry = await readFile(join(result.targetDir, "src/index.js"), "utf8");

    assert.deepEqual(result.files, ["package.json", "src/index.js"]);
    assert.match(packageJson, /"name": "demo-app"/);
    assert.equal(entry, "console.log(\"demo-app is ready\");\n");
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("initProject rejects existing directories without force", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    await mkdir(join(cwd, "demo"));
    await assert.rejects(() => initProject({ cwd, source: "local", projectName: "demo" }), /Use --force to overwrite/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("initProject overwrites existing directories with force", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    await mkdir(join(cwd, "demo"));
    await writeFile(join(cwd, "demo", "old.txt"), "old", "utf8");
    await initProject({ cwd, source: "local", projectName: "demo", force: true });

    assert.equal(await readFile(join(cwd, "demo", "src/index.js"), "utf8"), "console.log(\"demo is ready\");\n");
    await assert.rejects(() => readFile(join(cwd, "demo", "old.txt"), "utf8"));
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "demo", "--local"], cwd);

    assert.match(message, /^Created demo from default@latest at /);
    assert.equal(await readFile(join(cwd, "demo", "src/index.js"), "utf8"), "console.log(\"demo is ready\");\n");
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes vue3 projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "web-app", "--template", "vue3", "--local"], cwd);

    assert.match(message, /^Created web-app from vue3@latest at /);
    assert.match(await readFile(join(cwd, "web-app", "package.json"), "utf8"), /"vue-router": "\^4\.5\.1"/);
    assert.match(await readFile(join(cwd, "web-app", "package.json"), "utf8"), /"docker:build": "docker build -t web-app \./);
    assert.match(await readFile(join(cwd, "web-app", "pnpm-workspace.yaml"), "utf8"), /packages: \[\]/);
    assert.match(await readFile(join(cwd, "web-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "web-app", "nginx.conf"), "utf8"), /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(await readFile(join(cwd, "web-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "web-app", "src", "router", "index.ts"), "utf8"), /@\/views\/HomeView\.vue/);
    assert.match(await readFile(join(cwd, "web-app", "src", "stores", "counter.ts"), "utf8"), /reset\(\)/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes react projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "react-app", "--template", "react", "--local"], cwd);

    assert.match(message, /^Created react-app from react@latest at /);
    assert.match(await readFile(join(cwd, "react-app", "package.json"), "utf8"), /"react": "\^19\.1\.0"/);
    assert.match(await readFile(join(cwd, "react-app", "package.json"), "utf8"), /"docker:build": "docker build -t react-app \./);
    assert.match(await readFile(join(cwd, "react-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "react-app", "nginx.conf"), "utf8"), /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(await readFile(join(cwd, "react-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "react-app", "src", "App.tsx"), "utf8"), /React \+ Router \+ Vite/);
    assert.match(await readFile(join(cwd, "react-app", "src", "views", "HomeView.tsx"), "utf8"), /Current count:/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes mfe projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "mfe-app", "--template", "mfe", "--local"], cwd);

    assert.match(message, /^Created mfe-app from mfe@latest at /);
    assert.match(await readFile(join(cwd, "mfe-app", "package.json"), "utf8"), /"name": "mfe-app"/);
    assert.match(await readFile(join(cwd, "mfe-app", "package.json"), "utf8"), /"docker:build": "docker build -t mfe-app \./);
    assert.match(await readFile(join(cwd, "mfe-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "mfe-app", "Dockerfile"), "utf8"), /apps\/subapp-two\/dist/);
    assert.match(await readFile(join(cwd, "mfe-app", "nginx.conf"), "utf8"), /listen 7100/);
    assert.match(await readFile(join(cwd, "mfe-app", "nginx.conf"), "utf8"), /listen 7102/);
    assert.match(await readFile(join(cwd, "mfe-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "mfe-app", "apps", "host", "src", "micro-apps.ts"), "utf8"), /microAppMetas\.map/);
    assert.match(await readFile(join(cwd, "mfe-app", "apps", "subapp", "src", "lifecycle.ts"), "utf8"), /export function mount/);
    assert.match(await readFile(join(cwd, "mfe-app", "apps", "subapp-two", "src", "App.vue"), "utf8"), /Sub App Two is ready/);
    assert.match(await readFile(join(cwd, "mfe-app", "packages", "shared", "src", "index.ts"), "utf8"), /subapp-two/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes monorepo projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "platform", "--template", "monorepo", "--local"], cwd);

    assert.match(message, /^Created platform from monorepo@latest at /);
    assert.match(await readFile(join(cwd, "platform", "package.json"), "utf8"), /"name": "platform"/);
    assert.match(await readFile(join(cwd, "platform", "pnpm-workspace.yaml"), "utf8"), /"components"/);
    assert.match(await readFile(join(cwd, "platform", "cli", "package.json"), "utf8"), /"name": "@tsuz\/cli"/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
