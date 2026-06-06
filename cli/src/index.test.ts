import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { compareTemplateVersions, createCliMessage, createDoctorMessage, createHelpMessage, createRemoteTemplateInfoMessage, createTemplateInfoMessage, createTemplateListMessage, createTemplateMetadata, createTemplateVersionsMessage, createUpgradeCheckMessage, createVersionMessage, doctorProject, findRemoteTemplateDefinition, findTemplateAsset, findTemplateVersionsFromReleases, getReleaseTag, initProject, newestTemplateVersion, normalizeEntrypointPath, normalizeTemplateVersion, parseDoctorArgs, parseInitArgs, parseTemplateAssetVersion, parseTemplateInfoArgs, parseTemplateVersionsArgs, parseUpgradeCheckArgs, remoteManifestIncludesTemplate, remoteManifestTemplateNames, runCli, upgradeCheckProject } from "./index.js";

const execFileAsync = promisify(execFile);
const cliPackageJson = createRequire(import.meta.url)("../package.json") as { version: string };

test("createCliMessage reports CLI usage", () => {
  assert.equal(createCliMessage(), createHelpMessage());
  assert.match(createCliMessage(), /tsu-cli init \[project-name\]/);
});

test("createVersionMessage reports package version", () => {
  assert.equal(createVersionMessage(), cliPackageJson.version);
});

test("createTemplateListMessage reports available templates", () => {
  const message = createTemplateListMessage();

  assert.match(message, /Available templates:/);
  assert.match(message, /Template\s+Description\s+Recommended for/);
  assert.match(message, /default\s+Minimal Node\.js starter\s+node, minimal/);
  assert.match(message, /vue3\s+Vue 3 app.*admin, dashboard, web app/);
  assert.match(message, /react\s+React app.*react app, dashboard, web app/);
  assert.match(message, /mfe\s+Micro frontend workspace.*micro frontend, multi app/);
  assert.match(message, /monorepo\s+Multi-package workspace.*workspace, packages, team standard/);
});

test("createDoctorMessage reports checks and next steps", () => {
  const message = createDoctorMessage({
    cwd: "/workspace/app",
    projectName: "demo",
    templateName: "vue3",
    status: "warning",
    checks: [
      { label: "package.json", status: "pass", details: "Found demo" },
      { label: "Template files", status: "warn", details: "Missing vite.config.ts" }
    ],
    warnings: ["Template version metadata is not recorded in this project yet."],
    nextSteps: ["Compare the project against a fresh template generation before upgrading."]
  });

  assert.match(message, /Tsu doctor: WARNING/);
  assert.match(message, /Package: demo/);
  assert.match(message, /Template: vue3/);
  assert.match(message, /PASS package\.json - Found demo/);
  assert.match(message, /WARN Template files - Missing vite\.config\.ts/);
  assert.match(message, /Template version metadata is not recorded/);
});

test("createUpgradeCheckMessage reports upgrade suggestions", () => {
  const message = createUpgradeCheckMessage({
    cwd: "/workspace/app",
    status: "update_available",
    templateName: "vue3",
    currentVersion: "1.0.0",
    latestVersion: "1.2.0",
    repository: "company/templates",
    availableVersions: ["1.0.0", "1.2.0"],
    warnings: [],
    nextSteps: ["Run tsu-cli template info vue3 --version 1.2.0 --repo company/templates"]
  });

  assert.match(message, /Template upgrade check: UPDATE_AVAILABLE/);
  assert.match(message, /Template: vue3/);
  assert.match(message, /Current version: 1\.0\.0/);
  assert.match(message, /Latest version: 1\.2\.0/);
  assert.match(message, /Available versions: 1\.0\.0, 1\.2\.0/);
  assert.match(message, /template info vue3 --version 1\.2\.0/);
});

test("createTemplateInfoMessage reports template details", () => {
  const message = createTemplateInfoMessage("vue3");

  assert.match(message, /Template: vue3/);
  assert.match(message, /Description: Vue 3 app/);
  assert.match(message, /Tags: vue, vite, spa, docker/);
  assert.match(message, /Recommended for: admin, dashboard, web app/);
  assert.match(message, /Node: >=20/);
  assert.match(message, /Package managers: pnpm/);
  assert.match(message, /pnpm install/);
});

test("createRemoteTemplateInfoMessage reports versioned template details", () => {
  const message = createRemoteTemplateInfoMessage(
    { repository: "company/templates", templateName: "vue3", version: "1.2.3" },
    {
      name: "vue3",
      description: "Versioned Vue starter",
      tags: ["vue", "vite"],
      recommendedFor: ["admin"],
      node: ">=20",
      packageManagers: ["pnpm"],
      nextSteps: ["pnpm install", "pnpm dev"]
    }
  );

  assert.match(message, /Template: vue3/);
  assert.match(message, /Version: 1\.2\.3/);
  assert.match(message, /Repository: company\/templates/);
  assert.match(message, /Description: Versioned Vue starter/);
  assert.match(message, /Tags: vue, vite/);
  assert.match(message, /Recommended for: admin/);
  assert.match(message, /Node: >=20/);
  assert.match(message, /Package managers: pnpm/);
  assert.match(message, /pnpm install/);
});

test("createTemplateVersionsMessage reports release versions", () => {
  const message = createTemplateVersionsMessage(
    { repository: "company/templates", templateName: "vue3" },
    [
      {
        version: "1.2.3",
        tag: "template-v1.2.3",
        asset: "tsu-templates-v1.2.3.tar.gz",
        assetUrl: "https://example.com/tsu-templates-v1.2.3.tar.gz"
      }
    ]
  );

  assert.match(message, /Available versions for template "vue3" from company\/templates:/);
  assert.match(message, /Version\s+Tag\s+Asset/);
  assert.match(message, /1\.2\.3\s+template-v1\.2\.3\s+tsu-templates-v1\.2\.3\.tar\.gz/);
});

test("createTemplateVersionsMessage reports empty release lists", () => {
  assert.match(createTemplateVersionsMessage({ repository: "company/templates" }, []), /No template release assets found/);
});

test("createTemplateMetadata records template provenance", () => {
  assert.deepEqual(JSON.parse(createTemplateMetadata({ cwd: "/workspace", projectName: "demo", templateName: "vue3", version: "v1.2.3", source: "remote", repository: "company/templates" })), {
    template: {
      name: "vue3",
      version: "1.2.3",
      source: "remote",
      repository: "company/templates"
    }
  });
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

test("parseDoctorArgs supports cwd and json", () => {
  assert.deepEqual(parseDoctorArgs([], "/workspace"), { cwd: "/workspace" });
  assert.deepEqual(parseDoctorArgs(["--cwd", "apps/demo"], "/workspace"), { cwd: resolve("/workspace", "apps/demo") });
  assert.deepEqual(parseDoctorArgs(["--cwd", "apps/demo", "--json"], "/workspace"), { cwd: resolve("/workspace", "apps/demo"), json: true });
  assert.throws(() => parseDoctorArgs(["demo"], "/workspace"), /Unexpected argument: demo/);
  assert.throws(() => parseDoctorArgs(["--unknown"], "/workspace"), /Unknown option: --unknown/);
});

test("parseUpgradeCheckArgs supports cwd repo and json", () => {
  assert.deepEqual(parseUpgradeCheckArgs([], "/workspace"), { cwd: "/workspace" });
  assert.deepEqual(parseUpgradeCheckArgs(["--cwd", "apps/demo", "--repo", "company/templates"], "/workspace"), {
    cwd: resolve("/workspace", "apps/demo"),
    repository: "company/templates"
  });
  assert.deepEqual(parseUpgradeCheckArgs(["--cwd", "apps/demo", "--json"], "/workspace"), {
    cwd: resolve("/workspace", "apps/demo"),
    json: true
  });
  assert.throws(() => parseUpgradeCheckArgs(["demo"], "/workspace"), /Unexpected argument: demo/);
  assert.throws(() => parseUpgradeCheckArgs(["--unknown"], "/workspace"), /Unknown option: --unknown/);
});

test("parseTemplateInfoArgs supports template version and repo", () => {
  assert.deepEqual(parseTemplateInfoArgs(["vue3"]), {
    repository: process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu",
    templateName: "vue3"
  });
  assert.deepEqual(parseTemplateInfoArgs(["vue3", "--version", "v1.2.3", "--repo", "company/templates"]), {
    repository: "company/templates",
    templateName: "vue3",
    version: "1.2.3"
  });
  assert.throws(() => parseTemplateInfoArgs([]), /Missing value for template info/);
  assert.throws(() => parseTemplateInfoArgs(["vue3", "react"]), /Unexpected argument: react/);
  assert.throws(() => parseTemplateInfoArgs(["vue3", "--unknown"]), /Unknown option: --unknown/);
});

test("parseTemplateVersionsArgs supports optional template and repo", () => {
  assert.deepEqual(parseTemplateVersionsArgs(["vue3", "--repo", "company/templates"]), {
    repository: "company/templates",
    templateName: "vue3"
  });
  assert.deepEqual(parseTemplateVersionsArgs(["--repo", "company/templates"]), {
    repository: "company/templates"
  });
  assert.throws(() => parseTemplateVersionsArgs(["vue3", "react"]), /Unexpected argument: react/);
  assert.throws(() => parseTemplateVersionsArgs(["--unknown"]), /Unknown option: --unknown/);
});

test("release helpers normalize versions and find assets", () => {
  assert.equal(normalizeTemplateVersion("v1.2.3"), "1.2.3");
  assert.equal(getReleaseTag("latest"), "latest");
  assert.equal(getReleaseTag("1.2.3"), "template-v1.2.3");
  assert.equal(compareTemplateVersions("1.10.0", "1.2.0") > 0, true);
  assert.equal(compareTemplateVersions("1.0.0", "1.0.0"), 0);
  assert.equal(newestTemplateVersion(["1.0.0", "1.10.0", "1.2.0"]), "1.10.0");
  assert.equal(parseTemplateAssetVersion("tsu-templates-v1.2.3.tar.gz"), "1.2.3");
  assert.equal(parseTemplateAssetVersion("other.tar.gz"), undefined);
  assert.equal(
    findTemplateAsset({
      tag_name: "template-v1.2.3",
      assets: [{ name: "tsu-templates-v1.2.3.tar.gz", browser_download_url: "https://example.com/template.tar.gz" }]
    }).name,
    "tsu-templates-v1.2.3.tar.gz"
  );
  assert.deepEqual(
    findTemplateVersionsFromReleases([
      {
        tag_name: "template-v1.2.3",
        assets: [
          { name: "readme.txt", browser_download_url: "https://example.com/readme.txt" },
          { name: "tsu-templates-v1.2.3.tar.gz", browser_download_url: "https://example.com/template.tar.gz" }
        ]
      }
    ]),
    [
      {
        version: "1.2.3",
        tag: "template-v1.2.3",
        asset: "tsu-templates-v1.2.3.tar.gz",
        assetUrl: "https://example.com/template.tar.gz"
      }
    ]
  );
});

test("remote manifest helpers support old and rich template shapes", () => {
  assert.deepEqual(remoteManifestTemplateNames({ version: "1.0.0", templates: ["default", "vue3"] }), ["default", "vue3"]);
  assert.deepEqual(remoteManifestTemplateNames({ version: "1.0.0", templates: [{ name: "default" }, { name: "react" }] }), ["default", "react"]);
  assert.equal(remoteManifestIncludesTemplate({ version: "1.0.0", templates: [{ name: "default" }, { name: "react" }] }, "react"), true);
  assert.equal(remoteManifestIncludesTemplate({ version: "1.0.0", templates: [{ name: "default" }, { name: "react" }] }, "vue3"), false);
  assert.deepEqual(findRemoteTemplateDefinition({ version: "1.0.0", templates: ["vue3"] }, "vue3"), { name: "vue3" });
  assert.deepEqual(findRemoteTemplateDefinition({ version: "1.0.0", templates: [{ name: "vue3", description: "Vue release" }] }, "vue3"), {
    name: "vue3",
    description: "Vue release"
  });
  assert.equal(findRemoteTemplateDefinition({ version: "1.0.0", templates: [{ name: "react" }] }, "vue3"), undefined);
});

test("parseInitArgs rejects unknown options", () => {
  assert.throws(() => parseInitArgs(["demo", "--unknown"]), /Unknown option: --unknown/);
});

test("runCli reports help version and templates", async () => {
  assert.equal(await runCli(["--help"]), createHelpMessage());
  assert.equal(await runCli(["--version"]), createVersionMessage());
  assert.equal(await runCli(["templates"]), createTemplateListMessage());
  assert.equal(await runCli(["template", "list"]), createTemplateListMessage());
  assert.equal(await runCli(["template", "info", "vue3"]), createTemplateInfoMessage("vue3"));
  await assert.rejects(() => runCli(["template", "info"]), /Missing value for template info/);
});

test("runCli reports template versions from GitHub releases", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  globalThis.fetch = async (input) => {
    requestedUrls.push(String(input));

    return new Response(
      JSON.stringify([
        {
          tag_name: "template-v1.2.3",
          assets: [{ name: "tsu-templates-v1.2.3.tar.gz", browser_download_url: "https://example.com/template.tar.gz" }]
        },
        {
          tag_name: "v0.1.0",
          assets: [{ name: "source.zip", browser_download_url: "https://example.com/source.zip" }]
        }
      ]),
      { status: 200 }
    );
  };

  try {
    const message = await runCli(["template", "versions", "--repo", "company/templates"]);

    assert.deepEqual(requestedUrls, ["https://api.github.com/repos/company/templates/releases?per_page=100"]);
    assert.match(message, /Available template versions from company\/templates:/);
    assert.match(message, /1\.2\.3\s+template-v1\.2\.3\s+tsu-templates-v1\.2\.3\.tar\.gz/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("runCli reports remote template info from a versioned release", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-release-"));
  const originalFetch = globalThis.fetch;
  const archiveName = "tsu-templates-v1.2.3.tar.gz";
  const bundleDir = join(cwd, "tsu-templates-v1.2.3");
  const archivePath = join(cwd, archiveName);
  const requestedUrls: string[] = [];

  try {
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "manifest.json"),
      JSON.stringify(
        {
          version: "1.2.3",
          templates: [
            {
              name: "vue3",
              description: "Remote Vue starter",
              tags: ["vue", "vite"],
              recommendedFor: ["admin", "dashboard"],
              node: ">=20",
              packageManagers: ["pnpm"],
              nextSteps: ["pnpm install", "pnpm dev"]
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    await execFileAsync("tar", ["-czf", archiveName, "-C", dirname(bundleDir), "tsu-templates-v1.2.3"], { cwd });
    const archiveBytes = await readFile(archivePath);

    globalThis.fetch = async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url === "https://api.github.com/repos/company/templates/releases/tags/template-v1.2.3") {
        return new Response(
          JSON.stringify({
            tag_name: "template-v1.2.3",
            assets: [{ name: archiveName, browser_download_url: "https://example.com/template.tar.gz" }]
          }),
          { status: 200 }
        );
      }

      return new Response(archiveBytes, { status: 200 });
    };

    const message = await runCli(["template", "info", "vue3", "--version", "1.2.3", "--repo", "company/templates"]);

    assert.deepEqual(requestedUrls, ["https://api.github.com/repos/company/templates/releases/tags/template-v1.2.3", "https://example.com/template.tar.gz"]);
    assert.match(message, /Template: vue3/);
    assert.match(message, /Version: 1\.2\.3/);
    assert.match(message, /Repository: company\/templates/);
    assert.match(message, /Description: Remote Vue starter/);
    assert.match(message, /Tags: vue, vite/);
    assert.match(message, /Recommended for: admin, dashboard/);
    assert.match(message, /pnpm dev/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(cwd, { force: true, recursive: true });
  }
});

test("upgradeCheckProject reports available updates", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];

  try {
    const result = await initProject({ cwd, source: "local", projectName: "demo", templateName: "vue3" });
    await writeFile(join(result.targetDir, ".tsu/template.json"), createTemplateMetadata({ cwd, source: "remote", projectName: "demo", templateName: "vue3", version: "1.0.0", repository: "company/templates" }), "utf8");

    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input));

      return new Response(
        JSON.stringify([
          {
            tag_name: "template-v1.0.0",
            assets: [{ name: "tsu-templates-v1.0.0.tar.gz", browser_download_url: "https://example.com/1.0.0.tar.gz" }]
          },
          {
            tag_name: "template-v1.2.0",
            assets: [{ name: "tsu-templates-v1.2.0.tar.gz", browser_download_url: "https://example.com/1.2.0.tar.gz" }]
          }
        ]),
        { status: 200 }
      );
    };

    const upgrade = await upgradeCheckProject({ cwd: result.targetDir });

    assert.deepEqual(requestedUrls, ["https://api.github.com/repos/company/templates/releases?per_page=100"]);
    assert.equal(upgrade.status, "update_available");
    assert.equal(upgrade.templateName, "vue3");
    assert.equal(upgrade.currentVersion, "1.0.0");
    assert.equal(upgrade.latestVersion, "1.2.0");
    assert.deepEqual(upgrade.availableVersions, ["1.0.0", "1.2.0"]);
    assert.match(createUpgradeCheckMessage(upgrade), /Template upgrade check: UPDATE_AVAILABLE/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(cwd, { force: true, recursive: true });
  }
});

test("upgradeCheckProject reports missing metadata", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const upgrade = await upgradeCheckProject({ cwd });

    assert.equal(upgrade.status, "unknown");
    assert.match(createUpgradeCheckMessage(upgrade), /Missing \.tsu\/template\.json/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli reports upgrade-check results", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));
  const originalFetch = globalThis.fetch;

  try {
    const result = await initProject({ cwd, source: "local", projectName: "demo", templateName: "vue3" });
    await writeFile(join(result.targetDir, ".tsu/template.json"), createTemplateMetadata({ cwd, source: "remote", projectName: "demo", templateName: "vue3", version: "1.0.0", repository: "company/templates" }), "utf8");

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            tag_name: "template-v1.2.0",
            assets: [{ name: "tsu-templates-v1.2.0.tar.gz", browser_download_url: "https://example.com/1.2.0.tar.gz" }]
          }
        ]),
        { status: 200 }
      );

    const message = await runCli(["upgrade-check", "--cwd", result.targetDir], cwd);

    assert.match(message, /Template upgrade check: UPDATE_AVAILABLE/);
    assert.match(message, /Current version: 1\.0\.0/);
    assert.match(message, /Latest version: 1\.2\.0/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(cwd, { force: true, recursive: true });
  }
});

test("doctorProject reports generated projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "demo", templateName: "vue3" });
    const doctor = await doctorProject({ cwd: result.targetDir });

    assert.equal(doctor.status, "ok");
    assert.equal(doctor.projectName, "demo");
    assert.equal(doctor.templateName, "vue3");
    assert.equal(doctor.templateVersion, "latest");
    assert.equal(doctor.templateSource, "local");
    assert.deepEqual(
      doctor.checks.map((check) => [check.label, check.status]),
      [
        ["package.json", "pass"],
        ["Tsu README marker", "pass"],
        ["Template metadata", "pass"],
        ["Template files", "pass"]
      ]
    );
    assert.match(createDoctorMessage(doctor), /Tsu doctor: OK/);
    assert.match(createDoctorMessage(doctor), /Version: latest/);
    assert.match(createDoctorMessage(doctor), /Source: local/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("doctorProject reports non generated directories", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const doctor = await doctorProject({ cwd });

    assert.equal(doctor.status, "error");
    assert.deepEqual(
      doctor.checks.map((check) => [check.label, check.status]),
      [
        ["package.json", "fail"],
        ["Tsu README marker", "fail"],
        ["Template metadata", "warn"]
      ]
    );
    assert.match(createDoctorMessage(doctor), /Run this command inside a project generated by tsu-cli/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli reports doctor results", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "demo" });
    const message = await runCli(["doctor", "--cwd", result.targetDir], cwd);

    assert.match(message, /Tsu doctor: OK/);
    assert.match(message, /Package: demo/);
    assert.match(message, /Template: default/);
    assert.match(message, /Version: latest/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli reports doctor results as JSON", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "demo" });
    const message = await runCli(["doctor", "--cwd", result.targetDir, "--json"], cwd);
    const parsed = JSON.parse(message);

    assert.equal(parsed.status, "ok");
    assert.equal(parsed.projectName, "demo");
    assert.equal(parsed.templateName, "default");
    assert.equal(parsed.templateVersion, "latest");
    assert.ok(Array.isArray(parsed.checks));
    assert.doesNotMatch(message, /Tsu doctor:/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli reports upgrade-check results as JSON", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));
  const originalFetch = globalThis.fetch;

  try {
    const result = await initProject({ cwd, source: "local", projectName: "demo", templateName: "vue3" });
    await writeFile(join(result.targetDir, ".tsu/template.json"), createTemplateMetadata({ cwd, source: "remote", projectName: "demo", templateName: "vue3", version: "1.0.0", repository: "company/templates" }), "utf8");

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          {
            tag_name: "template-v1.2.0",
            assets: [{ name: "tsu-templates-v1.2.0.tar.gz", browser_download_url: "https://example.com/1.2.0.tar.gz" }]
          }
        ]),
        { status: 200 }
      );

    const message = await runCli(["upgrade-check", "--cwd", result.targetDir, "--json"], cwd);
    const parsed = JSON.parse(message);

    assert.equal(parsed.status, "update_available");
    assert.equal(parsed.currentVersion, "1.0.0");
    assert.equal(parsed.latestVersion, "1.2.0");
    assert.deepEqual(parsed.availableVersions, ["1.2.0"]);
    assert.doesNotMatch(message, /Template upgrade check:/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(cwd, { force: true, recursive: true });
  }
});

test("initProject writes template files", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "Demo App" });
    const packageJson = await readFile(join(result.targetDir, "package.json"), "utf8");
    const entry = await readFile(join(result.targetDir, "src/index.js"), "utf8");

    assert.deepEqual(result.files, ["package.json", "README.md", "src/index.js", ".tsu/template.json"]);
    assert.match(await readFile(join(result.targetDir, "README.md"), "utf8"), /Generated by Tsu from the `default` template/);
    assert.deepEqual(JSON.parse(await readFile(join(result.targetDir, ".tsu/template.json"), "utf8")), {
      template: {
        name: "default",
        version: "latest",
        source: "local"
      }
    });
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

    assert.match(message, /^Created demo from default@latest\nLocation: /);
    assert.match(message, /Next steps:\n  cd demo\n  pnpm dev/);
    assert.equal(await readFile(join(cwd, "demo", "src/index.js"), "utf8"), "console.log(\"demo is ready\");\n");
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes vue3 projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "web-app", "--template", "vue3", "--local"], cwd);

    assert.match(message, /^Created web-app from vue3@latest\nLocation: /);
    const readme = await readFile(join(cwd, "web-app", "README.md"), "utf8");
    const packageJson = await readFile(join(cwd, "web-app", "package.json"), "utf8");
    const homeView = await readFile(join(cwd, "web-app", "src", "views", "HomeView.vue"), "utf8");

    assert.match(readme, /Generated by Tsu from the `vue3` template/);
    assert.match(readme, /sample business loop/);
    assert.match(packageJson, /"@tsuz\/components": "\^0\.1\.1"/);
    assert.match(packageJson, /"@tsuz\/sdk": "\^0\.1\.1"/);
    assert.match(packageJson, /"@tsuz\/utils": "\^0\.1\.1"/);
    assert.match(packageJson, /"vue-router": "\^4\.5\.1"/);
    assert.match(packageJson, /"docker:build": "docker build -t web-app \./);
    assert.match(await readFile(join(cwd, "web-app", "pnpm-workspace.yaml"), "utf8"), /packages: \[\]/);
    assert.match(await readFile(join(cwd, "web-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "web-app", "nginx.conf"), "utf8"), /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(await readFile(join(cwd, "web-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "web-app", "src", "router", "index.ts"), "utf8"), /@\/views\/HomeView\.vue/);
    assert.match(homeView, /@tsuz\/components\/vue/);
    assert.match(homeView, /@tsuz\/sdk/);
    assert.match(homeView, /@tsuz\/utils\/js/);
    assert.match(homeView, /Dashboard starter/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes react projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "react-app", "--template", "react", "--local"], cwd);

    assert.match(message, /^Created react-app from react@latest\nLocation: /);
    const readme = await readFile(join(cwd, "react-app", "README.md"), "utf8");
    const packageJson = await readFile(join(cwd, "react-app", "package.json"), "utf8");
    const homeView = await readFile(join(cwd, "react-app", "src", "views", "HomeView.tsx"), "utf8");

    assert.match(readme, /Generated by Tsu from the `react` template/);
    assert.match(readme, /sample business loop/);
    assert.match(packageJson, /"@tsuz\/components": "\^0\.1\.1"/);
    assert.match(packageJson, /"@tsuz\/sdk": "\^0\.1\.1"/);
    assert.match(packageJson, /"@tsuz\/utils": "\^0\.1\.1"/);
    assert.match(packageJson, /"react": "\^19\.1\.0"/);
    assert.match(packageJson, /"docker:build": "docker build -t react-app \./);
    assert.match(await readFile(join(cwd, "react-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "react-app", "nginx.conf"), "utf8"), /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(await readFile(join(cwd, "react-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "react-app", "src", "App.tsx"), "utf8"), /React \+ Router \+ Vite/);
    assert.match(homeView, /@tsuz\/components\/react/);
    assert.match(homeView, /@tsuz\/sdk/);
    assert.match(homeView, /@tsuz\/utils\/js/);
    assert.match(homeView, /Dashboard starter/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes mfe projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "mfe-app", "--template", "mfe", "--local"], cwd);

    assert.match(message, /^Created mfe-app from mfe@latest\nLocation: /);
    assert.match(await readFile(join(cwd, "mfe-app", "README.md"), "utf8"), /Generated by Tsu from the `mfe` template/);
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

    assert.match(message, /^Created platform from monorepo@latest\nLocation: /);
    assert.match(await readFile(join(cwd, "platform", "README.md"), "utf8"), /Generated by Tsu from the `monorepo` template/);
    assert.match(await readFile(join(cwd, "platform", "package.json"), "utf8"), /"name": "platform"/);
    assert.match(await readFile(join(cwd, "platform", "pnpm-workspace.yaml"), "utf8"), /"components"/);
    assert.match(await readFile(join(cwd, "platform", "cli", "package.json"), "utf8"), /"name": "@tsuz\/cli"/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
