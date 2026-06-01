import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateFiles, createTemplateSourceFiles, listTemplates, renderTemplateFiles, templateManifest, templateProjectNameToken } from "./index.js";

test("template manifest exposes package metadata", () => {
  assert.equal(templateManifest.name, "quick-start-template");
  assert.deepEqual(templateManifest.templates, ["default", "monorepo", "vue3", "mfe"]);
});

test("listTemplates returns available templates", () => {
  assert.deepEqual(listTemplates(), ["default", "monorepo", "vue3", "mfe"]);
});

test("default template normalizes project names", () => {
  const files = createTemplateFiles({ projectName: "My App" });
  const packageJson = files.find((file) => file.path === "package.json");

  assert.ok(packageJson);
  assert.match(packageJson.content, /"name": "my-app"/);
  assert.deepEqual(
    files.map((file) => file.path),
    ["package.json", "src/index.js"]
  );
});

test("monorepo template creates workspace files", () => {
  const files = createTemplateFiles({ projectName: "My Platform", templateName: "monorepo" });
  const paths = files.map((file) => file.path);
  const rootPackageJson = files.find((file) => file.path === "package.json");

  assert.ok(rootPackageJson);
  assert.match(rootPackageJson.content, /"name": "my-platform"/);
  assert.match(rootPackageJson.content, /"private": true/);
  assert.ok(paths.includes("pnpm-workspace.yaml"));
  assert.ok(paths.includes(".changeset/config.json"));
  assert.ok(paths.includes("cli/package.json"));
  assert.ok(paths.includes("components/package.json"));
  assert.ok(paths.includes("utils/package.json"));
  assert.ok(paths.includes("sdk/package.json"));
  assert.ok(paths.includes("tests/package.json"));
  assert.ok(paths.includes("script/package.json"));
  assert.match(files.find((file) => file.path === "components/package.json")?.content ?? "", /"\.\/vue"/);
  assert.match(files.find((file) => file.path === "components/package.json")?.content ?? "", /"\.\/react"/);
  assert.match(files.find((file) => file.path === "utils/package.json")?.content ?? "", /"\.\/js"/);
});

test("vue3 template creates vite-based app files", () => {
  const files = createTemplateFiles({ projectName: "My App", templateName: "vue3" });
  const paths = files.map((file) => file.path);
  const packageJson = files.find((file) => file.path === "package.json");

  assert.ok(packageJson);
  assert.match(packageJson.content, /"name": "my-app"/);
  assert.match(packageJson.content, /"dev": "vite"/);
  assert.match(packageJson.content, /"docker:build": "docker build -t my-app \./);
  assert.match(packageJson.content, /"docker:run": "docker run --rm -p 8080:80 my-app"/);
  assert.match(packageJson.content, /"vue": "\^3\.5\.13"/);
  assert.match(packageJson.content, /"pinia": "\^3\.0\.1"/);
  assert.match(packageJson.content, /"vue-router": "\^4\.5\.1"/);
  assert.match(packageJson.content, /"eslint": "\^9\.21\.0"/);
  assert.match(packageJson.content, /"@eslint\/js": "\^9\.21\.0"/);
  assert.match(packageJson.content, /"eslint-plugin-vue": "\^9\.32\.0"/);
  assert.match(packageJson.content, /"@types\/node": "\^20\.17\.57"/);
  assert.ok(paths.includes("pnpm-workspace.yaml"));
  assert.ok(paths.includes(".dockerignore"));
  assert.ok(paths.includes(".gitignore"));
  assert.ok(paths.includes("Dockerfile"));
  assert.ok(paths.includes("nginx.conf"));
  assert.ok(paths.includes(".github/workflows/ci.yml"));
  assert.ok(paths.includes("index.html"));
  assert.ok(paths.includes("vite.config.ts"));
  assert.ok(paths.includes("eslint.config.js"));
  assert.ok(paths.includes("tsconfig.json"));
  assert.ok(paths.includes("tsconfig.app.json"));
  assert.ok(paths.includes("src/env.d.ts"));
  assert.ok(paths.includes("src/main.ts"));
  assert.ok(paths.includes("src/App.vue"));
  assert.ok(paths.includes("src/router/index.ts"));
  assert.ok(paths.includes("src/stores/counter.ts"));
  assert.ok(paths.includes("src/styles/base.css"));
  assert.ok(paths.includes("src/styles/main.css"));
  assert.ok(paths.includes("src/views/HomeView.vue"));
  assert.ok(paths.includes("src/views/AboutView.vue"));
  assert.ok(paths.includes("src/vite-env.d.ts"));
  assert.match(files.find((file) => file.path === "Dockerfile")?.content ?? "", /FROM node:20-alpine AS build/);
  assert.match(files.find((file) => file.path === "Dockerfile")?.content ?? "", /FROM nginx:1\.27-alpine/);
  assert.match(files.find((file) => file.path === "nginx.conf")?.content ?? "", /try_files \$uri \$uri\/ \/index\.html/);
  assert.match(files.find((file) => file.path === ".github/workflows/ci.yml")?.content ?? "", /pnpm install --frozen-lockfile/);
  assert.match(files.find((file) => file.path === ".github/workflows/ci.yml")?.content ?? "", /pnpm build/);
  assert.match(files.find((file) => file.path === "eslint.config.js")?.content ?? "", /flat\/recommended/);
  assert.match(files.find((file) => file.path === "tsconfig.json")?.content ?? "", /"@\/\*": \[\s*"src\/\*"\s*\]/);
  assert.match(files.find((file) => file.path === "src/env.d.ts")?.content ?? "", /declare module "\*\.vue"/);
  assert.match(files.find((file) => file.path === "src/styles/main.css")?.content ?? "", /@import "\.\/base\.css";/);
  assert.match(files.find((file) => file.path === "src/App.vue")?.content ?? "", /Vue 3 \+ Router \+ Pinia/);
  assert.match(files.find((file) => file.path === "src/views/HomeView.vue")?.content ?? "", /Current count:/);
  assert.match(files.find((file) => file.path === "src/views/HomeView.vue")?.content ?? "", /Reset/);
  assert.match(files.find((file) => file.path === "src/views/AboutView.vue")?.content ?? "", /includes routing and Pinia/);
});

test("mfe template creates qiankun workspace files", () => {
  const files = createTemplateFiles({ projectName: "MFE Platform", templateName: "mfe" });
  const paths = files.map((file) => file.path);
  const packageJson = files.find((file) => file.path === "package.json");

  assert.ok(packageJson);
  assert.match(packageJson.content, /"name": "mfe-platform"/);
  assert.match(packageJson.content, /"dev": "pnpm --parallel --filter/);
  assert.ok(paths.includes("pnpm-workspace.yaml"));
  assert.ok(paths.includes("tsconfig.base.json"));
  assert.ok(paths.includes("apps/host/package.json"));
  assert.ok(paths.includes("apps/host/src/micro-apps.ts"));
  assert.ok(paths.includes("apps/subapp/package.json"));
  assert.ok(paths.includes("apps/subapp/src/lifecycle.ts"));
  assert.ok(paths.includes("packages/shared/src/index.ts"));
  assert.ok(paths.includes("packages/ui/src/index.ts"));
  assert.match(files.find((file) => file.path === "apps/host/package.json")?.content ?? "", /"qiankun": "\^2\.10\.16"/);
  assert.match(files.find((file) => file.path === "apps/host/src/micro-apps.ts")?.content ?? "", /entry: "\/\/localhost:7101"/);
  assert.match(files.find((file) => file.path === "apps/subapp/package.json")?.content ?? "", /"vite-plugin-qiankun": "\^1\.0\.15"/);
  assert.match(files.find((file) => file.path === "apps/subapp/src/lifecycle.ts")?.content ?? "", /export function mount/);
});

test("template source files use project name token", () => {
  const sourceFiles = createTemplateSourceFiles("default");
  const packageJson = sourceFiles.find((file) => file.path === "package.json");

  assert.ok(packageJson);
  assert.match(packageJson.content, new RegExp(templateProjectNameToken));
  assert.match(renderTemplateFiles(sourceFiles, "My App")[0].content, /"name": "my-app"/);
});

test("createTemplateFiles rejects unknown templates", () => {
  assert.throws(
    () => createTemplateFiles({ projectName: "demo", templateName: "missing" }),
    /Available templates: default, monorepo, vue3, mfe/
  );
});
