import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateFiles, createTemplateSourceFiles, listTemplates, renderTemplateFiles, templateManifest, templateProjectNameToken } from "./index.js";

test("template manifest exposes package metadata", () => {
  assert.equal(templateManifest.name, "quick-start-template");
  assert.deepEqual(templateManifest.templates, ["default", "monorepo"]);
});

test("listTemplates returns available templates", () => {
  assert.deepEqual(listTemplates(), ["default", "monorepo"]);
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
    /Available templates: default, monorepo/
  );
});
