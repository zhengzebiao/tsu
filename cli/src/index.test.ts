import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { compareTemplateVersions, createCliMessage, createDoctorMessage, createHelpMessage, createRemoteTemplateInfoMessage, createTemplateInfoHelpMessage, createTemplateInfoMessage, createTemplateListMessage, createTemplateMetadata, createTemplateVersionsMessage, createUpgradeCheckMessage, createVersionMessage, doctorProject, findRemoteTemplateDefinition, findTemplateAsset, findTemplateVersionsFromReleases, getReleaseTag, initProject, newestTemplateVersion, normalizeEntrypointPath, normalizeTemplateVersion, parseDoctorArgs, parseInitArgs, parseTemplateAssetVersion, parseTemplateInfoArgs, parseTemplateVersionsArgs, parseUpgradeCheckArgs, remoteManifestIncludesTemplate, remoteManifestTemplateNames, runCli, runInteractiveInit, upgradeCheckProject } from "./index.js";

const execFileAsync = promisify(execFile);
const cliPackageJson = createRequire(import.meta.url)("../package.json") as { version: string };

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function assertMfeCiWorkflow(content: string) {
  assert.match(content, /name: CI/);
  assert.match(content, /pull_request/);
  assert.match(content, /push/);
  assert.match(content, /main/);
  assert.match(content, /master/);
  assert.match(content, /actions\/checkout@v4/);
  assert.match(content, /pnpm\/action-setup@v4/);
  assert.match(content, /version: 8\.15\.9/);
  assert.match(content, /actions\/setup-node@v4/);
  assert.match(content, /node-version: 20/);
  assert.match(content, /cache: pnpm/);
  assert.match(content, /pnpm install --frozen-lockfile/);
  assert.match(content, /pnpm lint/);
  assert.match(content, /pnpm format:check/);
  assert.match(content, /pnpm test/);
  assert.match(content, /pnpm build/);
  assert.match(content, /pnpm exec playwright install --with-deps chromium/);
  assert.match(content, /pnpm test:e2e/);
}

function assertMfeDeployWorkflow(content: string) {
  assert.match(content, /name: Deploy/);
  assert.match(content, /test-v\*\.\*\.\*/);
  assert.match(content, /product-v\*\.\*\.\*/);
  assert.match(content, /workflow_dispatch/);
  assert.match(content, /environment/);
  assert.match(content, /image_tag/);
  assert.match(content, /version/);
  assert.match(content, /should_build/);
  assert.match(content, /packages: write/);
  assert.match(content, /docker build/);
  assert.match(content, /docker push/);
  assert.match(content, /DOCKER_REGISTRY_TOKEN/);
  assert.match(content, /SSH_PRIVATE_KEY/);
  assert.match(content, /VITE_API_BASE_URL/);
  assert.match(content, /VITE_MFE_APP_ENTRY/);
  assert.match(content, /VITE_APP_ENV/);
  assert.match(content, /docker-compose\.yml/);
  assert.match(content, /scp/);
  assert.match(content, /ssh/);
  assert.match(content, /docker compose --env-file \.env -f docker-compose\.yml pull app/);
  assert.match(content, /docker compose --env-file \.env -f docker-compose\.yml up -d --no-build app/);
  assert.match(content, /Refusing to deploy a latest tag/);
}

test("createCliMessage reports CLI usage", () => {
  assert.equal(createCliMessage(), createHelpMessage());
  assert.match(createCliMessage(), /tsu-cli init \[project-name\]/);
  assert.match(createCliMessage(), /tsu-cli list/);
  assert.match(createCliMessage(), /tsu-cli template list/);
  assert.match(createCliMessage(), /aliases: list, template list/);
  assert.match(createCliMessage(), /mfe-main/);
  assert.match(createCliMessage(), /mfe-app/);
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
  assert.match(message, /mfe-main\s+React qiankun host shell starter.*micro frontend host, auth shell, app container/);
  assert.match(message, /mfe-app\s+React qiankun sub application starter.*micro frontend sub app, business app, remote module/);
  assert.match(message, /monorepo\s+Multi-package workspace.*workspace, packages, team standard/);
  assert.match(message, /python-main\s+FastAPI auth service.*auth service, jwt issuer, backend api/);
  assert.match(message, /python-app\s+FastAPI resource service.*resource service, business api, jwt verifier/);
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

test("createTemplateInfoHelpMessage reports template info usage", () => {
  const message = createTemplateInfoHelpMessage();

  assert.match(message, /tsu-cli template info <name> \[options\]/);
  assert.match(message, /--version <value>/);
  assert.match(message, /--repo <owner\/repo>/);
  assert.match(message, /--no-cache/);
  assert.match(message, /--refresh/);
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

test("createTemplateInfoMessage reports MFE template details", () => {
  const mainMessage = createTemplateInfoMessage("mfe-main");
  const appMessage = createTemplateInfoMessage("mfe-app");

  assert.match(mainMessage, /Template: mfe-main/);
  assert.match(mainMessage, /Description: React qiankun host shell starter/);
  assert.match(mainMessage, /Tags: mfe, qiankun, react, host, vite/);
  assert.match(mainMessage, /Recommended for: micro frontend host, auth shell, app container/);
  assert.match(mainMessage, /pnpm install/);
  assert.match(mainMessage, /pnpm dev/);
  assert.match(appMessage, /Template: mfe-app/);
  assert.match(appMessage, /Description: React qiankun sub application starter/);
  assert.match(appMessage, /Tags: mfe, qiankun, react, sub app, vite/);
  assert.match(appMessage, /Recommended for: micro frontend sub app, business app, remote module/);
  assert.match(appMessage, /pnpm install/);
  assert.match(appMessage, /pnpm dev/);
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
    cache: true,
    refresh: false,
    repository: process.env.TSU_TEMPLATE_REPOSITORY || process.env.GITHUB_REPOSITORY || "zhengzebiao/tsu"
  });
  assert.deepEqual(parseInitArgs(["demo", "--no-cache", "--refresh"], "/workspace"), {
    cwd: "/workspace",
    projectName: "demo",
    templateName: "default",
    version: "latest",
    force: false,
    source: "remote",
    cache: false,
    refresh: true,
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
    templateName: "vue3",
    cache: true,
    refresh: false
  });
  assert.deepEqual(parseTemplateInfoArgs(["vue3", "--version", "v1.2.3", "--repo", "company/templates", "--no-cache", "--refresh"]), {
    repository: "company/templates",
    templateName: "vue3",
    version: "1.2.3",
    cache: false,
    refresh: true
  });
  assert.throws(() => parseTemplateInfoArgs([]), /Missing value for template info/);
  assert.throws(() => parseTemplateInfoArgs(["vue3", "react"]), /Unexpected argument: react/);
  assert.throws(() => parseTemplateInfoArgs(["vue3", "--unknown"]), /Unknown option: --unknown/);
});

test("parseTemplateVersionsArgs supports optional template and repo", () => {
  assert.deepEqual(parseTemplateVersionsArgs(["vue3", "--repo", "company/templates", "--no-cache", "--refresh"]), {
    repository: "company/templates",
    templateName: "vue3",
    cache: false,
    refresh: true
  });
  assert.deepEqual(parseTemplateVersionsArgs(["--repo", "company/templates"]), {
    repository: "company/templates",
    cache: true,
    refresh: false
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

test("runCli reports help version templates and aliases", async () => {
  assert.equal(await runCli(["--help"]), createHelpMessage());
  assert.equal(await runCli(["--version"]), createVersionMessage());
  assert.equal(await runCli(["templates"]), createTemplateListMessage());
  assert.equal(await runCli(["list"]), createTemplateListMessage());
  assert.equal(await runCli(["template", "list"]), createTemplateListMessage());
  assert.equal(await runCli(["template", "info", "--help"]), createTemplateInfoHelpMessage());
  assert.equal(await runCli(["template", "info", "-h"]), createTemplateInfoHelpMessage());
  assert.equal(await runCli(["template", "info", "vue3"]), createTemplateInfoMessage("vue3"));
  await assert.rejects(() => runCli(["template", "info"]), /Missing value for template info/);
});

test("runCli reports template versions from GitHub releases", async () => {
  const originalFetch = globalThis.fetch;
  const originalGithubToken = process.env.GITHUB_TOKEN;
  const requestedUrls: string[] = [];
  const requestedAuthorization: Array<string | undefined> = [];

  process.env.GITHUB_TOKEN = "test-token";
  globalThis.fetch = async (input, init) => {
    requestedUrls.push(String(input));
    requestedAuthorization.push((init?.headers as Record<string, string> | undefined)?.Authorization);

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
    assert.deepEqual(requestedAuthorization, ["Bearer test-token"]);
    assert.match(message, /Available template versions from company\/templates:/);
    assert.match(message, /1\.2\.3\s+template-v1\.2\.3\s+tsu-templates-v1\.2\.3\.tar\.gz/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("GITHUB_TOKEN", originalGithubToken);
  }
});

test("runCli reports remote template info from a versioned release", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-release-"));
  const cacheDir = await mkdtemp(join(tmpdir(), "quick-start-cache-"));
  const originalFetch = globalThis.fetch;
  const originalCacheDir = process.env.TSU_TEMPLATE_CACHE_DIR;
  const archiveName = "tsu-templates-v1.2.3.tar.gz";
  const bundleDir = join(cwd, "tsu-templates-v1.2.3");
  const archivePath = join(cwd, archiveName);
  const requestedUrls: string[] = [];

  try {
    process.env.TSU_TEMPLATE_CACHE_DIR = cacheDir;
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

      return new Response(archiveBytes, { status: 200 });
    };

    const message = await runCli(["template", "info", "vue3", "--version", "1.2.3", "--repo", "company/templates"]);

    assert.deepEqual(requestedUrls, ["https://github.com/company/templates/releases/download/template-v1.2.3/tsu-templates-v1.2.3.tar.gz"]);
    assert.match(message, /Template: vue3/);
    assert.match(message, /Version: 1\.2\.3/);
    assert.match(message, /Repository: company\/templates/);
    assert.match(message, /Description: Remote Vue starter/);
    assert.match(message, /Tags: vue, vite/);
    assert.match(message, /Recommended for: admin, dashboard/);
    assert.match(message, /pnpm dev/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("TSU_TEMPLATE_CACHE_DIR", originalCacheDir);
    await rm(cwd, { force: true, recursive: true });
    await rm(cacheDir, { force: true, recursive: true });
  }
});

test("runCli keeps latest template info on the GitHub Release API path", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-release-"));
  const cacheDir = await mkdtemp(join(tmpdir(), "quick-start-cache-"));
  const originalFetch = globalThis.fetch;
  const originalCacheDir = process.env.TSU_TEMPLATE_CACHE_DIR;
  const archiveName = "tsu-templates-v1.2.3.tar.gz";
  const bundleDir = join(cwd, "tsu-templates-v1.2.3");
  const archivePath = join(cwd, archiveName);
  const requestedUrls: string[] = [];

  try {
    process.env.TSU_TEMPLATE_CACHE_DIR = cacheDir;
    await mkdir(bundleDir, { recursive: true });
    await writeFile(join(bundleDir, "manifest.json"), JSON.stringify({ version: "1.2.3", templates: [{ name: "vue3", description: "Latest Vue starter" }] }), "utf8");
    await execFileAsync("tar", ["-czf", archiveName, "-C", dirname(bundleDir), "tsu-templates-v1.2.3"], { cwd });
    const archiveBytes = await readFile(archivePath);

    globalThis.fetch = async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url === "https://api.github.com/repos/company/templates/releases/latest") {
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

    const message = await runCli(["template", "info", "vue3", "--version", "latest", "--repo", "company/templates"]);

    assert.deepEqual(requestedUrls, ["https://api.github.com/repos/company/templates/releases/latest", "https://example.com/template.tar.gz"]);
    assert.match(message, /Template: vue3/);
    assert.match(message, /Description: Latest Vue starter/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("TSU_TEMPLATE_CACHE_DIR", originalCacheDir);
    await rm(cwd, { force: true, recursive: true });
    await rm(cacheDir, { force: true, recursive: true });
  }
});

test("runCli initializes remote templates from direct URLs and reuses cache", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));
  const archiveRoot = await mkdtemp(join(tmpdir(), "quick-start-release-"));
  const cacheDir = await mkdtemp(join(tmpdir(), "quick-start-cache-"));
  const originalFetch = globalThis.fetch;
  const originalCacheDir = process.env.TSU_TEMPLATE_CACHE_DIR;
  const archiveName = "tsu-templates-v1.2.3.tar.gz";
  const bundleDir = join(archiveRoot, "tsu-templates-v1.2.3");
  const archivePath = join(archiveRoot, archiveName);
  const requestedUrls: string[] = [];

  try {
    process.env.TSU_TEMPLATE_CACHE_DIR = cacheDir;
    await mkdir(join(bundleDir, "vue3", "src"), { recursive: true });
    await writeFile(join(bundleDir, "manifest.json"), JSON.stringify({ version: "1.2.3", templates: ["vue3"] }), "utf8");
    await writeFile(join(bundleDir, "vue3", "package.json"), '{"name":"remote-template"}\n', "utf8");
    await writeFile(join(bundleDir, "vue3", "src", "index.js"), 'console.log("remote-template");\n', "utf8");
    await execFileAsync("tar", ["-czf", archiveName, "-C", dirname(bundleDir), "tsu-templates-v1.2.3"], { cwd: archiveRoot });
    const archiveBytes = await readFile(archivePath);

    globalThis.fetch = async (input) => {
      requestedUrls.push(String(input));
      return new Response(archiveBytes, { status: 200 });
    };

    const firstMessage = await runCli(["init", "demo-one", "--template", "vue3", "--version", "1.2.3", "--repo", "company/templates"], cwd);
    const secondMessage = await runCli(["init", "demo-two", "--template", "vue3", "--version", "1.2.3", "--repo", "company/templates"], cwd);

    assert.deepEqual(requestedUrls, ["https://github.com/company/templates/releases/download/template-v1.2.3/tsu-templates-v1.2.3.tar.gz"]);
    assert.match(firstMessage, /^Created demo-one from vue3@1\.2\.3/);
    assert.match(secondMessage, /^Created demo-two from vue3@1\.2\.3/);
    assert.equal(await readFile(join(cwd, "demo-one", "package.json"), "utf8"), '{"name":"remote-template"}\n');
    assert.equal(await readFile(join(cwd, "demo-two", "src", "index.js"), "utf8"), 'console.log("remote-template");\n');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("TSU_TEMPLATE_CACHE_DIR", originalCacheDir);
    await rm(cwd, { force: true, recursive: true });
    await rm(archiveRoot, { force: true, recursive: true });
    await rm(cacheDir, { force: true, recursive: true });
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

test("doctorProject reports generated mfe-main projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "mfe-main-platform", templateName: "mfe-main" });
    const doctor = await doctorProject({ cwd: result.targetDir });

    assert.equal(doctor.status, "ok");
    assert.equal(doctor.projectName, "mfe-main-platform");
    assert.equal(doctor.templateName, "mfe-main");
    assert.deepEqual(
      doctor.checks.map((check) => [check.label, check.status]),
      [
        ["package.json", "pass"],
        ["Tsu README marker", "pass"],
        ["Template metadata", "pass"],
        ["Template files", "pass"]
      ]
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("doctorProject reports generated mfe-app projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const result = await initProject({ cwd, source: "local", projectName: "mfe-business-app", templateName: "mfe-app" });
    const doctor = await doctorProject({ cwd: result.targetDir });

    assert.equal(doctor.status, "ok");
    assert.equal(doctor.projectName, "mfe-business-app");
    assert.equal(doctor.templateName, "mfe-app");
    assert.deepEqual(
      doctor.checks.map((check) => [check.label, check.status]),
      [
        ["package.json", "pass"],
        ["Tsu README marker", "pass"],
        ["Template metadata", "pass"],
        ["Template files", "pass"]
      ]
    );
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

test("runInteractiveInit uses default answers", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));
  const prompts = {
    answers: ["", ""],
    closed: false,
    async question() {
      return this.answers.shift() ?? "";
    },
    close() {
      this.closed = true;
    }
  };

  try {
    const message = await runInteractiveInit(cwd, prompts, "local");

    assert.equal(prompts.closed, true);
    assert.match(message, /^Created quick-start-app from default@latest\nLocation: /);
    assert.match(message, /Next steps:\n  cd quick-start-app\n  pnpm dev/);
    assert.equal(await readFile(join(cwd, "quick-start-app", "src/index.js"), "utf8"), "console.log(\"quick-start-app is ready\");\n");
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
    const dashboardStore = await readFile(join(cwd, "web-app", "src", "stores", "dashboard.ts"), "utf8");

    assert.match(readme, /Generated by Tsu from the `vue3` template/);
    assert.match(readme, /Sample Dashboard Flow/);
    assert.match(readme, /Replacing the Mock API/);
    assert.match(readme, /Testing/);
    assert.match(packageJson, /"@tsuz\/components": "\^0\.2\.0"/);
    assert.match(packageJson, /"@tsuz\/sdk": "\^0\.2\.0"/);
    assert.match(packageJson, /"@tsuz\/utils": "\^0\.2\.0"/);
    assert.match(packageJson, /"vue-router": "\^4\.5\.1"/);
    assert.match(packageJson, /"test": "vitest run"/);
    assert.match(packageJson, /"@vue\/test-utils": "\^2\.4\.6"/);
    assert.match(packageJson, /"docker:build": "docker build -t web-app \./);
    assert.match(await readFile(join(cwd, "web-app", "pnpm-workspace.yaml"), "utf8"), /packages: \[\]/);
    assert.match(await readFile(join(cwd, "web-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "web-app", "nginx.conf"), "utf8"), /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(await readFile(join(cwd, "web-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "web-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm test/);
    assert.match(await readFile(join(cwd, "web-app", "src", "router", "index.ts"), "utf8"), /@\/views\/HomeView\.vue/);
    assert.match(homeView, /@tsuz\/components\/vue/);
    assert.match(homeView, /useDashboardStore/);
    assert.match(homeView, /storeToRefs/);
    assert.match(homeView, /Dashboard starter/);
    assert.match(dashboardStore, /defineStore\("dashboard"/);
    assert.match(dashboardStore, /@tsuz\/sdk/);
    assert.match(dashboardStore, /@tsuz\/utils\/js/);
    assert.match(await readFile(join(cwd, "web-app", "src", "stores", "dashboard.test.ts"), "utf8"), /loads dashboard summaries/);
    assert.match(await readFile(join(cwd, "web-app", "src", "views", "HomeView.test.ts"), "utf8"), /renders the dashboard starter actions/);
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
    const dashboardHook = await readFile(join(cwd, "react-app", "src", "hooks", "useDashboardSummary.ts"), "utf8");

    assert.match(readme, /Generated by Tsu from the `react` template/);
    assert.match(readme, /Sample Dashboard Flow/);
    assert.match(readme, /Replacing the Mock API/);
    assert.match(readme, /Adding Pages/);
    assert.match(packageJson, /"@tsuz\/components": "\^0\.2\.0"/);
    assert.match(packageJson, /"@tsuz\/sdk": "\^0\.2\.0"/);
    assert.match(packageJson, /"@tsuz\/utils": "\^0\.2\.0"/);
    assert.match(packageJson, /"react": "\^19\.1\.0"/);
    assert.match(packageJson, /"docker:build": "docker build -t react-app \./);
    assert.match(await readFile(join(cwd, "react-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "react-app", "nginx.conf"), "utf8"), /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(await readFile(join(cwd, "react-app", ".github", "workflows", "ci.yml"), "utf8"), /pnpm install --frozen-lockfile/);
    assert.match(await readFile(join(cwd, "react-app", "src", "App.tsx"), "utf8"), /React \+ Router \+ Vite/);
    assert.match(homeView, /@tsuz\/components\/react/);
    assert.match(homeView, /useDashboardSummary/);
    assert.match(homeView, /Show empty/);
    assert.match(homeView, /Dashboard starter/);
    assert.match(dashboardHook, /@tsuz\/sdk/);
    assert.match(dashboardHook, /@tsuz\/utils\/js/);
    assert.match(dashboardHook, /DashboardSummaryMode = "success" \| "empty" \| "error"/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes mfe-main projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "mfe-main-platform", "--template", "mfe-main", "--local"], cwd);

    assert.match(message, /^Created mfe-main-platform from mfe-main@latest\nLocation: /);
    assert.match(message, /pnpm install/);
    assert.match(message, /pnpm dev/);
    const projectRoot = join(cwd, "mfe-main-platform");
    const packageJson = await readFile(join(projectRoot, "package.json"), "utf8");
    const workspace = await readFile(join(projectRoot, "pnpm-workspace.yaml"), "utf8");
    const appPackageJson = await readFile(join(projectRoot, "apps", "main", "package.json"), "utf8");
    const appTsConfig = await readFile(join(projectRoot, "apps", "main", "tsconfig.json"), "utf8");
    const appViteConfig = await readFile(join(projectRoot, "apps", "main", "vite.config.ts"), "utf8");
    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    const main = await readFile(join(projectRoot, "apps", "main", "src", "main.tsx"), "utf8");
    const app = await readFile(join(projectRoot, "apps", "main", "src", "App.tsx"), "utf8");
    const styles = await readFile(join(projectRoot, "apps", "main", "src", "styles", "main.css"), "utf8");
    const config = await readFile(join(projectRoot, "apps", "main", "src", "micro-apps", "config.ts"), "utf8");
    const registry = await readFile(join(projectRoot, "apps", "main", "src", "micro-apps", "registry.ts"), "utf8");
    const authStore = await readFile(join(projectRoot, "apps", "main", "src", "stores", "auth.store.ts"), "utf8");
    const authService = await readFile(join(projectRoot, "apps", "main", "src", "services", "auth.service.ts"), "utf8");
    const apiClient = await readFile(join(projectRoot, "apps", "main", "src", "services", "api-client.ts"), "utf8");
    const shared = await readFile(join(projectRoot, "packages", "shared", "src", "index.ts"), "utf8");
    const ui = await readFile(join(projectRoot, "packages", "ui", "src", "index.tsx"), "utf8");
    const api = await readFile(join(projectRoot, "packages", "api", "src", "index.ts"), "utf8");
    const dockerfile = await readFile(join(projectRoot, "Dockerfile"), "utf8");
    const nginxConfig = await readFile(join(projectRoot, "nginx", "nginx.conf"), "utf8");
    const compose = await readFile(join(projectRoot, "docker-compose.yml"), "utf8");
    const deployEnv = await readFile(join(projectRoot, ".env.deploy.example"), "utf8");
    const dockerignore = await readFile(join(projectRoot, ".dockerignore"), "utf8");
    const appEnv = await readFile(join(projectRoot, "apps", "main", ".env.example"), "utf8");
    const viteEnv = await readFile(join(projectRoot, "apps", "main", "src", "vite-env.d.ts"), "utf8");
    const workflow = await readFile(join(projectRoot, ".github", "workflows", "ci.yml"), "utf8");
    const deployWorkflow = await readFile(join(projectRoot, ".github", "workflows", "deploy.yml"), "utf8");

    assert.match(packageJson, /"lint": "eslint \. --max-warnings 0 && turbo run lint"/);
    assert.match(packageJson, /"test": "turbo run test"/);
    assert.match(packageJson, /"test:e2e": "playwright test"/);
    assert.match(packageJson, /"docker:build": "docker build -t mfe-main-platform:\$\{APP_VERSION:-local\} \./);
    assert.match(packageJson, /"docker:run": "docker run --rm -p 7200:80 mfe-main-platform:\$\{APP_VERSION:-local\}"/);
    assert.match(packageJson, /"compose:up": "docker compose up --build"/);
    assert.match(packageJson, /"compose:down": "docker compose down"/);
    assert.match(packageJson, /"@playwright\/test"/);
    assert.match(packageJson, /"format": "prettier --ignore-unknown --write/);
    assert.match(packageJson, /"format:check": "prettier --ignore-unknown --check/);
    assert.match(packageJson, /\.github\/workflows\/deploy\.yml/);
    assertMfeCiWorkflow(workflow);
    assertMfeDeployWorkflow(deployWorkflow);
    assert.doesNotMatch(deployWorkflow, /:latest/);
    assert.match(workspace, /packages\/\*/);
    assert.match(appPackageJson, /"@tsuz\/api": "workspace:\*"/);
    assert.match(appPackageJson, /"@tsuz\/shared": "workspace:\*"/);
    assert.match(appPackageJson, /"@tsuz\/ui": "workspace:\*"/);
    assert.match(appPackageJson, /"tailwindcss"/);
    assert.match(appPackageJson, /"postcss"/);
    assert.match(appPackageJson, /"autoprefixer"/);
    assert.match(appPackageJson, /"@testing-library\/jest-dom"/);
    assert.match(appPackageJson, /"@testing-library\/react"/);
    assert.match(appPackageJson, /"@testing-library\/user-event"/);
    assert.match(appPackageJson, /"jsdom"/);
    assert.match(appPackageJson, /"test": "vitest run"/);
    assert.match(appPackageJson, /"vitest": "\^3\.0\.5"/);
    assert.match(appTsConfig, /@tsuz\/shared/);
    assert.match(appTsConfig, /@tsuz\/ui/);
    assert.match(appTsConfig, /@tsuz\/api/);
    assert.match(appViteConfig, /@tsuz\/shared/);
    assert.match(appViteConfig, /@tsuz\/ui/);
    assert.match(appViteConfig, /@tsuz\/api/);
    assert.match(appViteConfig, /vitest\/config/);
    assert.match(appViteConfig, /environment: "jsdom"/);
    assert.match(appViteConfig, /setupFiles: "\.\/src\/test\/setup\.ts"/);
    assert.match(readme, /production-ready React qiankun host shell starter/);
    assert.match(readme, /Generate the Project/);
    assert.match(readme, /Local development/);
    assert.match(readme, /Local quality gates/);
    assert.match(readme, /GitHub Actions CI/);
    assert.match(readme, /GitHub Actions Deploy/);
    assert.match(readme, /GitHub Environments/);
    assert.match(readme, /test-v\*\.\*\.\*/);
    assert.match(readme, /product-v\*\.\*\.\*/);
    assert.match(readme, /test-v1\.0\.1/);
    assert.match(readme, /product-v1\.0\.1/);
    assert.match(readme, /workflow_dispatch/);
    assert.match(readme, /image_tag/);
    assert.match(readme, /rollback/);
    assert.match(readme, /docker compose up -d --no-build/);
    assert.match(readme, /deploy\.yml automatically uploads docker-compose\.yml/);
    assert.match(readme, /DOCKER_REGISTRY_TOKEN/);
    assert.match(readme, /SSH_PRIVATE_KEY/);
    assert.match(readme, /Docker and nginx/);
    assert.match(readme, /Docker Compose/);
    assert.match(readme, /VITE_APP_ENV/);
    assert.match(readme, /APP_VERSION/);
    assert.match(readme, /pnpm docker:build/);
    assert.match(readme, /pnpm compose:up/);
    assert.match(readme, /Testing Library/);
    assert.match(readme, /Playwright/);
    assert.match(readme, /pnpm test:e2e/);
    assert.match(readme, /Shared Workspace Packages/);
    assert.match(readme, /Demo credentials/);
    assert.match(readme, /VITE_API_BASE_URL is a build-time variable/);
    assert.match(readme, /VITE_MFE_APP_ENTRY/);
    assert.match(dockerfile, /FROM node:20-alpine AS build/);
    assert.match(dockerfile, /FROM nginx:1\.27-alpine/);
    assert.match(dockerfile, /ARG VITE_API_BASE_URL=\/api/);
    assert.match(dockerfile, /ARG VITE_MFE_APP_ENTRY=\/\/localhost:7201/);
    assert.match(dockerfile, /ARG VITE_APP_ENV=production/);
    assert.match(dockerfile, /COPY --from=build \/app\/apps\/main\/dist \/usr\/share\/nginx\/html/);
    assert.match(nginxConfig, /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(nginxConfig, /Cache-Control "no-store, no-cache, must-revalidate"/);
    assert.match(nginxConfig, /Cache-Control "public, immutable"/);
    assert.doesNotMatch(nginxConfig, /Access-Control-Allow-Origin/);
    assert.match(compose, /\$\{DOCKER_IMAGE_NAME:-mfe-main-platform\}:\$\{APP_VERSION:-local\}/);
    assert.match(compose, /\$\{CONTAINER_NAME:-mfe-main-platform\}/);
    assert.match(compose, /"\$\{APP_PORT:-7200\}:80"/);
    assert.match(compose, /VITE_APP_ENV: \$\{APP_ENV:-local\}/);
    assert.match(deployEnv, /DOCKER_IMAGE_NAME=mfe-main-platform/);
    assert.match(deployEnv, /APP_VERSION=local/);
    assert.match(deployEnv, /APP_PORT=7200/);
    assert.match(deployEnv, /VITE_MFE_APP_ENTRY=\/\/localhost:7201/);
    assert.match(dockerignore, /apps\/\*\/dist/);
    assert.match(dockerignore, /!\.env\.deploy\.example/);
    assert.match(appEnv, /VITE_APP_ENV=local/);
    assert.match(viteEnv, /VITE_APP_ENV/);
    assert.match(await readFile(join(projectRoot, "eslint.config.js"), "utf8"), /react-hooks/);
    assert.match(await readFile(join(projectRoot, "eslint.config.js"), "utf8"), /react-refresh/);
    assert.match(await readFile(join(projectRoot, "prettier.config.js"), "utf8"), /printWidth/);
    assert.match(await readFile(join(projectRoot, "apps", "main", ".env.example"), "utf8"), /VITE_MFE_APP_ENTRY=\/\/localhost:7201/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "tailwind.config.js"), "utf8"), /\.\/src\/\*\*\/\*\.\{ts,tsx\}/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "postcss.config.js"), "utf8"), /tailwindcss/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "vite-env.d.ts"), "utf8"), /VITE_API_BASE_URL/);
    assert.match(await readFile(join(projectRoot, "playwright.config.ts"), "utf8"), /MFE_INTEGRATION_E2E/);
    assert.match(await readFile(join(projectRoot, "e2e", "host-login.spec.ts"), "utf8"), /Waiting for mfe-app/);
    assert.match(await readFile(join(projectRoot, "e2e", "host-load-subapp.spec.ts"), "utf8"), /Auth bridge: provided/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "test", "setup.ts"), "utf8"), /@testing-library\/jest-dom/);
    await assert.rejects(() => readFile(join(projectRoot, "apps", "main", "src", "types", "auth.ts"), "utf8"));
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "pages", "LoginPage.tsx"), "utf8"), /Username: admin \/ Password: password123/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "pages", "LoginPage.test.tsx"), "utf8"), /renders demo credentials/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "components", "RequireAuth.tsx"), "utf8"), /Navigate to="\/login"/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "providers", "AppProviders.tsx"), "utf8"), /QueryClientProvider/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "providers", "query-client.ts"), "utf8"), /staleTime/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "services", "auth.service.test.ts"), "utf8"), /returns a demo session/);
    assert.match(await readFile(join(projectRoot, "apps", "main", "src", "micro-apps", "config.test.ts"), "utf8"), /matches active rules/);
    assert.match(styles, /@tailwind base/);
    assert.match(styles, /@tailwind components/);
    assert.match(styles, /@tailwind utilities/);
    assert.match(main, /AppProviders/);
    assert.match(main, /registerMicroFrontendApps/);
    assert.match(app, /LoginPage/);
    assert.match(app, /RequireAuth/);
    assert.match(app, /@tsuz\/ui/);
    assert.match(app, /id="subapp-container"/);
    assert.match(app, /getAccessToken/);
    assert.doesNotMatch(app, /qiankun will mount sub applications here in Phase 3/);
    assert.match(config, /@tsuz\/shared/);
    assert.match(config, /VITE_MFE_APP_ENTRY/);
    assert.match(config, /VITE_API_BASE_URL/);
    assert.match(config, /matchesActiveRoute/);
    assert.match(config, /#subapp-container/);
    assert.match(config, /getCurrentUser/);
    assert.match(registry, /registerMicroApps/);
    assert.match(registry, /prefetch: false/);
    assert.match(authStore, /@tsuz\/shared/);
    assert.match(authStore, /authBridge/);
    assert.match(authStore, /getAccessToken/);
    assert.match(authStore, /getCurrentUser/);
    assert.match(authService, /@tsuz\/shared/);
    assert.match(authService, /password123/);
    assert.match(apiClient, /createApiClient/);
    assert.match(shared, /export interface MicroAppProps/);
    assert.match(ui, /export function Logo/);
    assert.match(ui, /export function EmptyState/);
    assert.match(api, /export function createApiClient/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes mfe-app projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "mfe-business-app", "--template", "mfe-app", "--local"], cwd);

    assert.match(message, /^Created mfe-business-app from mfe-app@latest\nLocation: /);
    assert.match(message, /pnpm install/);
    assert.match(message, /pnpm dev/);
    const projectRoot = join(cwd, "mfe-business-app");
    const packageJson = await readFile(join(projectRoot, "package.json"), "utf8");
    const workspace = await readFile(join(projectRoot, "pnpm-workspace.yaml"), "utf8");
    const appPackageJson = await readFile(join(projectRoot, "apps", "app", "package.json"), "utf8");
    const appTsConfig = await readFile(join(projectRoot, "apps", "app", "tsconfig.json"), "utf8");
    const appViteConfig = await readFile(join(projectRoot, "apps", "app", "vite.config.ts"), "utf8");
    const readme = await readFile(join(projectRoot, "README.md"), "utf8");
    const app = await readFile(join(projectRoot, "apps", "app", "src", "App.tsx"), "utf8");
    const businessHomePage = await readFile(join(projectRoot, "apps", "app", "src", "pages", "BusinessHomePage.tsx"), "utf8");
    const appProviders = await readFile(join(projectRoot, "apps", "app", "src", "providers", "AppProviders.tsx"), "utf8");
    const queryClient = await readFile(join(projectRoot, "apps", "app", "src", "providers", "query-client.ts"), "utf8");
    const appStore = await readFile(join(projectRoot, "apps", "app", "src", "stores", "app.store.ts"), "utf8");
    const businessHomeQuery = await readFile(join(projectRoot, "apps", "app", "src", "queries", "business-home.query.ts"), "utf8");
    const bootstrap = await readFile(join(projectRoot, "apps", "app", "src", "bootstrap.tsx"), "utf8");
    const qiankun = await readFile(join(projectRoot, "apps", "app", "src", "qiankun.ts"), "utf8");
    const apiClient = await readFile(join(projectRoot, "apps", "app", "src", "services", "api-client.ts"), "utf8");
    const shared = await readFile(join(projectRoot, "packages", "shared", "src", "index.ts"), "utf8");
    const ui = await readFile(join(projectRoot, "packages", "ui", "src", "index.tsx"), "utf8");
    const api = await readFile(join(projectRoot, "packages", "api", "src", "index.ts"), "utf8");
    const dockerfile = await readFile(join(projectRoot, "Dockerfile"), "utf8");
    const nginxConfig = await readFile(join(projectRoot, "nginx", "nginx.conf"), "utf8");
    const compose = await readFile(join(projectRoot, "docker-compose.yml"), "utf8");
    const deployEnv = await readFile(join(projectRoot, ".env.deploy.example"), "utf8");
    const dockerignore = await readFile(join(projectRoot, ".dockerignore"), "utf8");
    const appEnv = await readFile(join(projectRoot, "apps", "app", ".env.example"), "utf8");
    const prettierConfig = await readFile(join(projectRoot, "prettier.config.js"), "utf8");
    const workflow = await readFile(join(projectRoot, ".github", "workflows", "ci.yml"), "utf8");
    const deployWorkflow = await readFile(join(projectRoot, ".github", "workflows", "deploy.yml"), "utf8");

    assert.match(packageJson, /"test": "turbo run test"/);
    assert.match(packageJson, /"test:e2e": "playwright test"/);
    assert.match(packageJson, /"format": "prettier --ignore-unknown --write/);
    assert.match(packageJson, /"format:check": "prettier --ignore-unknown --check/);
    assert.match(packageJson, /\.github\/workflows\/deploy\.yml/);
    assert.match(packageJson, /"docker:build": "docker build -t mfe-business-app:\$\{APP_VERSION:-local\} \./);
    assert.match(packageJson, /"docker:run": "docker run --rm -p 7201:80 mfe-business-app:\$\{APP_VERSION:-local\}"/);
    assert.match(packageJson, /"compose:up": "docker compose up --build"/);
    assert.match(packageJson, /"compose:down": "docker compose down"/);
    assert.match(packageJson, /"@playwright\/test"/);
    assert.match(packageJson, /"prettier"/);
    assertMfeCiWorkflow(workflow);
    assertMfeDeployWorkflow(deployWorkflow);
    assert.doesNotMatch(deployWorkflow, /:latest/);
    assert.match(workspace, /packages\/\*/);
    assert.match(appPackageJson, /"@tsuz\/api": "workspace:\*"/);
    assert.match(appPackageJson, /"@tsuz\/shared": "workspace:\*"/);
    assert.match(appPackageJson, /"@tsuz\/ui": "workspace:\*"/);
    assert.match(appPackageJson, /"vite-plugin-qiankun": "\^1\.0\.15"/);
    assert.match(appPackageJson, /"@testing-library\/jest-dom"/);
    assert.match(appPackageJson, /"@testing-library\/react"/);
    assert.match(appPackageJson, /"@testing-library\/user-event"/);
    assert.match(appPackageJson, /"jsdom"/);
    assert.match(appPackageJson, /"test": "vitest run"/);
    assert.match(appPackageJson, /"vitest": "\^3\.0\.5"/);
    assert.match(appTsConfig, /@tsuz\/shared/);
    assert.match(appTsConfig, /@tsuz\/ui/);
    assert.match(appTsConfig, /@tsuz\/api/);
    assert.match(appViteConfig, /@tsuz\/shared/);
    assert.match(appViteConfig, /@tsuz\/ui/);
    assert.match(appViteConfig, /@tsuz\/api/);
    assert.match(appViteConfig, /vitest\/config/);
    assert.match(appViteConfig, /environment: "jsdom"/);
    assert.match(appViteConfig, /setupFiles: "\.\/src\/test\/setup\.ts"/);
    assert.match(appViteConfig, /vite-plugin-qiankun/);
    assert.match(readme, /production-ready React qiankun sub application starter/);
    assert.match(readme, /Generate the Project/);
    assert.match(readme, /Local development/);
    assert.match(readme, /Local quality gates/);
    assert.match(readme, /GitHub Actions CI/);
    assert.match(readme, /GitHub Actions Deploy/);
    assert.match(readme, /GitHub Environments/);
    assert.match(readme, /test-v\*\.\*\.\*/);
    assert.match(readme, /product-v\*\.\*\.\*/);
    assert.match(readme, /test-v1\.0\.1/);
    assert.match(readme, /product-v1\.0\.1/);
    assert.match(readme, /workflow_dispatch/);
    assert.match(readme, /image_tag/);
    assert.match(readme, /rollback/);
    assert.match(readme, /docker compose up -d --no-build/);
    assert.match(readme, /deploy\.yml automatically uploads docker-compose\.yml/);
    assert.match(readme, /DOCKER_REGISTRY_TOKEN/);
    assert.match(readme, /SSH_PRIVATE_KEY/);
    assert.match(readme, /VITE_API_BASE_URL is a build-time variable/);
    assert.match(readme, /pnpm format:check/);
    assert.match(readme, /Docker and nginx/);
    assert.match(readme, /Docker Compose/);
    assert.match(readme, /VITE_APP_ENV/);
    assert.match(readme, /APP_VERSION/);
    assert.match(readme, /pnpm docker:build/);
    assert.match(readme, /pnpm compose:up/);
    assert.match(readme, /Testing Library/);
    assert.match(readme, /Playwright/);
    assert.match(readme, /pnpm test:e2e/);
    assert.match(readme, /Shared Workspace Packages/);
    assert.match(readme, /apps\/app\/src\/pages\/BusinessHomePage\.tsx/);
    assert.match(app, /BusinessHomePage/);
    assert.match(app, /@tsuz\/ui/);
    assert.match(dockerfile, /FROM node:20-alpine AS build/);
    assert.match(dockerfile, /FROM nginx:1\.27-alpine/);
    assert.match(dockerfile, /ARG VITE_API_BASE_URL=\/api/);
    assert.match(dockerfile, /ARG VITE_MFE_APP_ENTRY=\/\/localhost:7201/);
    assert.match(dockerfile, /ARG VITE_APP_ENV=production/);
    assert.match(dockerfile, /COPY --from=build \/app\/apps\/app\/dist \/usr\/share\/nginx\/html/);
    assert.match(nginxConfig, /try_files \$uri \$uri\/ \/index\.html/);
    assert.match(nginxConfig, /Cache-Control "no-store, no-cache, must-revalidate"/);
    assert.match(nginxConfig, /Cache-Control "public, immutable"/);
    assert.match(nginxConfig, /Access-Control-Allow-Origin "\*"/);
    assert.match(nginxConfig, /Access-Control-Allow-Methods "GET, HEAD, OPTIONS"/);
    assert.match(compose, /\$\{DOCKER_IMAGE_NAME:-mfe-business-app\}:\$\{APP_VERSION:-local\}/);
    assert.match(compose, /\$\{CONTAINER_NAME:-mfe-business-app\}/);
    assert.match(compose, /"\$\{APP_PORT:-7201\}:80"/);
    assert.match(compose, /VITE_APP_ENV: \$\{APP_ENV:-local\}/);
    assert.match(deployEnv, /DOCKER_IMAGE_NAME=mfe-business-app/);
    assert.match(deployEnv, /APP_VERSION=local/);
    assert.match(deployEnv, /APP_PORT=7201/);
    assert.match(deployEnv, /VITE_MFE_APP_ENTRY=\/\/localhost:7201/);
    assert.match(dockerignore, /apps\/\*\/dist/);
    assert.match(dockerignore, /!\.env\.deploy\.example/);
    assert.match(prettierConfig, /printWidth/);
    assert.match(appEnv, /VITE_APP_ENV=local/);
    assert.match(apiClient, /resolveDefaultApiBaseUrl/);
    assert.match(apiClient, /import\.meta\.env\.VITE_API_BASE_URL/);
    assert.match(await readFile(join(projectRoot, "playwright.config.ts"), "utf8"), /127\.0\.0\.1:7201/);
    assert.match(await readFile(join(projectRoot, "e2e", "standalone.spec.ts"), "utf8"), /Standalone mode/);
    assert.match(await readFile(join(projectRoot, "apps", "app", "src", "test", "setup.ts"), "utf8"), /@testing-library\/jest-dom/);
    assert.match(await readFile(join(projectRoot, "apps", "app", "src", "pages", "BusinessHomePage.test.tsx"), "utf8"), /deterministic business data/);
    assert.match(businessHomePage, /useQuery/);
    assert.match(businessHomePage, /PageContainer/);
    assert.match(appProviders, /QueryClientProvider/);
    assert.match(queryClient, /new QueryClient/);
    assert.match(appStore, /create<AppStore>/);
    assert.match(businessHomeQuery, /businessHomeQueryKey/);
    assert.match(bootstrap, /createMfeApiClient/);
    assert.match(bootstrap, /useAppStore/);
    assert.match(qiankun, /@tsuz\/shared/);
    assert.match(qiankun, /Partial<MicroAppProps>/);
    assert.match(qiankun, /render\(props\)/);
    assert.match(apiClient, /createApiClient/);
    assert.match(shared, /export interface MicroAppProps/);
    assert.match(ui, /export function Logo/);
    assert.match(ui, /export function ErrorState/);
    assert.match(api, /export function createApiClient/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes python-main projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "auth-service", "--template", "python-main", "--local"], cwd);

    assert.match(message, /^Created auth-service from python-main@latest\nLocation: /);
    assert.match(message, /pdm install/);
    assert.match(message, /pdm run dev/);
    const readme = await readFile(join(cwd, "auth-service", "README.md"), "utf8");
    const workflow = await readFile(join(cwd, "auth-service", ".github", "workflows", "ci.yml"), "utf8");
    const nginx = await readFile(join(cwd, "auth-service", "nginx", "default.conf"), "utf8");

    assert.match(readme, /Generated by Tsu from the `python-main` template/);
    assert.match(readme, /GitHub Actions, Secrets, and Environments/);
    assert.match(readme, /auth-service:test-<git-sha>/);
    assert.match(readme, /production rollback/);
    assert.match(readme, /## Auth API/);
    assert.match(readme, /POST \/auth\/login/);
    assert.match(readme, /## JWT Configuration/);
    assert.match(readme, /JWT_PRIVATE_KEY/);
    assert.match(readme, /## Redis Token State/);
    assert.match(readme, /REFRESH_TOKEN_REUSE_GRACE_SECONDS/);
    assert.match(readme, /revokes the session/);
    assert.match(readme, /## Database Migrations and Seed/);
    assert.match(readme, /alembic downgrade -1/);
    assert.match(readme, /alembic downgrade <revision_id>/);
    assert.match(readme, /seed is idempotent/);
    assert.match(readme, /Product does not auto-run seed/);
    assert.match(readme, /## FAQ/);
    assert.match(workflow, /docker-build:/);
    assert.match(workflow, /deploy-test:/);
    assert.match(workflow, /environment: test/);
    assert.match(workflow, /TEST_DOCKER_REGISTRY_TOKEN/);
    assert.match(workflow, /deploy-product:/);
    assert.match(workflow, /environment: product/);
    assert.match(workflow, /PRODUCT_DOCKER_REGISTRY_TOKEN/);
    assert.match(workflow, /TEST_JWT_PRIVATE_KEY/);
    assert.match(workflow, /PRODUCT_JWT_PRIVATE_KEY/);
    assert.match(nginx, /log_format safe_json/);
    assert.doesNotMatch(nginx, /\$http_authorization|\$http_cookie/);
    assert.match(await readFile(join(cwd, "auth-service", "pyproject.toml"), "utf8"), /name = "auth-service"/);
    assert.match(await readFile(join(cwd, "auth-service", "pyproject.toml"), "utf8"), /\[tool\.pdm\.scripts\]/);
    assert.match(await readFile(join(cwd, "auth-service", "pyproject.toml"), "utf8"), /gunicorn/);
    assert.match(await readFile(join(cwd, "auth-service", "Dockerfile"), "utf8"), /pdm install --prod --no-self/);
    assert.match(await readFile(join(cwd, "auth-service", "Dockerfile"), "utf8"), /uvicorn_worker\.UvicornWorker/);
    assert.match(await readFile(join(cwd, "auth-service", "docker-compose.yml"), "utf8"), /uvicorn app\.main:app --reload/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "api", "auth.py"), "utf8"), /def login/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "api", "auth.py"), "utf8"), /HTTP_401_UNAUTHORIZED/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "services", "auth_service.py"), "utf8"), /password123/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "services", "auth_service.py"), "utf8"), /rotate_refresh_token/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "services", "refresh_token_service.py"), "utf8"), /refresh_token_reuse_grace_seconds/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "services", "refresh_token_service.py"), "utf8"), /replaced_by/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "services", "session_service.py"), "utf8"), /ensure_session_active/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "models", "permission.py"), "utf8"), /class Permission/);
    assert.match(await readFile(join(cwd, "auth-service", "alembic", "versions", "0001_initial_auth_schema.py"), "utf8"), /role_permissions/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "seed", "__main__.py"), "utf8"), /ensure_admin_user/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "seed", "__main__.py"), "utf8"), /DEFAULT_PERMISSIONS/);
    assert.match(await readFile(join(cwd, "auth-service", "app", "services", "token_service.py"), "utf8"), /jwt.encode/);
    assert.match(await readFile(join(cwd, "auth-service", "tests", "test_auth_api.py"), "utf8"), /test_login_failure_returns_401/);
    assert.match(await readFile(join(cwd, "auth-service", "tests", "test_auth_api.py"), "utf8"), /test_me_revoked_session_returns_401/);
    assert.match(await readFile(join(cwd, "auth-service", "tests", "test_refresh_token_service.py"), "utf8"), /test_rotated_refresh_token_after_grace_revokes_session/);
    assert.match(await readFile(join(cwd, "auth-service", "tests", "test_token_service.py"), "utf8"), /required_payload_claims/);
    assert.match(await readFile(join(cwd, "auth-service", ".env.test.example"), "utf8"), /JWT_PRIVATE_KEY/);
    assert.match(await readFile(join(cwd, "auth-service", ".env.product.example"), "utf8"), /DOCS_ENABLED=false/);
    assert.match(await readFile(join(cwd, "auth-service", "nginx", "default.conf"), "utf8"), /X-Request-ID/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes python-app projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "backend-api", "--template", "python-app", "--local"], cwd);

    assert.match(message, /^Created backend-api from python-app@latest\nLocation: /);
    assert.match(message, /pdm run dev/);
    const readme = await readFile(join(cwd, "backend-api", "README.md"), "utf8");
    const workflow = await readFile(join(cwd, "backend-api", ".github", "workflows", "ci.yml"), "utf8");
    const nginx = await readFile(join(cwd, "backend-api", "nginx", "default.conf"), "utf8");

    assert.match(readme, /Generated by Tsu from the `python-app` template/);
    assert.match(readme, /GitHub Actions, Secrets, and Environments/);
    assert.match(readme, /backend-api:test-<git-sha>/);
    assert.match(readme, /## Protected API Usage/);
    assert.match(readme, /Authorization: Bearer <access-token>/);
    assert.match(readme, /## Auth Integration with python-main/);
    assert.match(readme, /JWT_PUBLIC_KEY/);
    assert.match(readme, /SESSION_PREFIX/);
    assert.match(readme, /sessions revoked by logout or refresh-token reuse/);
    assert.match(readme, /## Scopes and Permissions/);
    assert.match(readme, /require_scope\("user:read"\)/);
    assert.match(readme, /## Database Migrations and Seed/);
    assert.match(readme, /alembic downgrade -1/);
    assert.match(readme, /pdm run seed/);
    assert.match(readme, /seed is idempotent/);
    assert.match(readme, /Product does not auto-run seed/);
    assert.match(readme, /## FAQ/);
    assert.match(workflow, /docker-build:/);
    assert.match(workflow, /deploy-test:/);
    assert.match(workflow, /environment: test/);
    assert.match(workflow, /deploy-product:/);
    assert.match(workflow, /environment: product/);
    assert.match(workflow, /TEST_DOCKER_REGISTRY_TOKEN/);
    assert.match(workflow, /PRODUCT_DOCKER_REGISTRY_TOKEN/);
    assert.doesNotMatch(workflow, /TEST_JWT_PRIVATE_KEY|PRODUCT_JWT_PRIVATE_KEY/);
    assert.match(nginx, /log_format safe_json/);
    assert.doesNotMatch(nginx, /\$http_authorization|\$http_cookie/);
    assert.match(await readFile(join(cwd, "backend-api", "pyproject.toml"), "utf8"), /name = "backend-api"/);
    assert.match(await readFile(join(cwd, "backend-api", "pyproject.toml"), "utf8"), /uvicorn-worker/);
    assert.match(await readFile(join(cwd, "backend-api", "pyproject.toml"), "utf8"), /\[dependency-groups\]/);
    assert.match(await readFile(join(cwd, "backend-api", "Dockerfile"), "utf8"), /pip install --no-cache-dir pdm/);
    assert.match(await readFile(join(cwd, "backend-api", "Dockerfile"), "utf8"), /gunicorn app\.main:app/);
    assert.match(await readFile(join(cwd, "backend-api", "docker-compose.yml"), "utf8"), /uvicorn app\.main:app --reload/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "api", "example.py"), "utf8"), /\/api/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "api", "example.py"), "utf8"), /require_scope/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "deps", "auth.py"), "utf8"), /jwt.decode/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "deps", "auth.py"), "utf8"), /SessionService/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "deps", "auth.py"), "utf8"), /HTTP_403_FORBIDDEN/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "services", "session_service.py"), "utf8"), /ensure_session_active/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "models", "app_setting.py"), "utf8"), /class AppSetting/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "models", "sample_profile.py"), "utf8"), /class SampleProfile/);
    assert.match(await readFile(join(cwd, "backend-api", "alembic", "versions", "0001_initial_app_schema.py"), "utf8"), /sample_profiles/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "seed", "__main__.py"), "utf8"), /ensure_setting/);
    assert.match(await readFile(join(cwd, "backend-api", "app", "seed", "__main__.py"), "utf8"), /DEFAULT_SAMPLE_PROFILES/);
    assert.match(await readFile(join(cwd, "backend-api", "tests", "test_profile_api.py"), "utf8"), /test_profile_rejects_revoked_session/);
    assert.match(await readFile(join(cwd, "backend-api", "tests", "test_profile_api.py"), "utf8"), /test_profile_rejects_insufficient_scope/);
    assert.doesNotMatch(await readFile(join(cwd, "backend-api", ".env.test.example"), "utf8"), /JWT_PRIVATE_KEY/);
    assert.doesNotMatch(await readFile(join(cwd, "backend-api", ".env.test.example"), "utf8"), /REFRESH_TOKEN_EXPIRE_DAYS|REFRESH_TOKEN_PREFIX/);
    assert.match(await readFile(join(cwd, "backend-api", ".env.test.example"), "utf8"), /JWT_PUBLIC_KEY/);
    assert.match(await readFile(join(cwd, "backend-api", ".env.test.example"), "utf8"), /SESSION_PREFIX/);
    assert.match(await readFile(join(cwd, "backend-api", "tests", "test_health.py"), "utf8"), /X-Request-ID/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("runCli initializes mfe projects", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "quick-start-"));

  try {
    const message = await runCli(["init", "mfe-app", "--template", "mfe", "--local"], cwd);

    assert.match(message, /^Created mfe-app from mfe@latest\nLocation: /);
    const readme = await readFile(join(cwd, "mfe-app", "README.md"), "utf8");

    assert.match(readme, /Generated by Tsu from the `mfe` template/);
    assert.match(readme, /Sub App Entry Configuration/);
    assert.match(readme, /Host and Sub App Communication/);
    assert.match(readme, /Adding a Sub App/);
    assert.match(readme, /Host\/Sub App Communication Example/);
    assert.match(readme, /Docker and nginx Deployment Notes/);
    assert.match(readme, /Remote Template Version Verification/);
    assert.match(readme, /Micro Frontend Choice Guide/);
    assert.match(await readFile(join(cwd, "mfe-app", "package.json"), "utf8"), /"name": "mfe-app"/);
    assert.match(await readFile(join(cwd, "mfe-app", "package.json"), "utf8"), /"docker:build": "docker build -t mfe-app \./);
    assert.match(await readFile(join(cwd, "mfe-app", "Dockerfile"), "utf8"), /FROM nginx:1\.27-alpine/);
    assert.match(await readFile(join(cwd, "mfe-app", "Dockerfile"), "utf8"), /apps\/subapp-two\/dist/);
    assert.match(await readFile(join(cwd, "mfe-app", "nginx.conf"), "utf8"), /listen 7100/);
    assert.match(await readFile(join(cwd, "mfe-app", "nginx.conf"), "utf8"), /listen 7102/);
    const ci = await readFile(join(cwd, "mfe-app", ".github", "workflows", "ci.yml"), "utf8");
    const microApps = await readFile(join(cwd, "mfe-app", "apps", "host", "src", "micro-apps.ts"), "utf8");
    const lifecycle = await readFile(join(cwd, "mfe-app", "apps", "subapp", "src", "lifecycle.ts"), "utf8");
    const shared = await readFile(join(cwd, "mfe-app", "packages", "shared", "src", "index.ts"), "utf8");

    assert.match(ci, /run: pnpm install\n/);
    assert.doesNotMatch(ci, /--frozen-lockfile/);
    assert.match(ci, /pnpm test/);
    assert.match(await readFile(join(cwd, "mfe-app", "package.json"), "utf8"), /"test": "vitest run"/);
    assert.match(await readFile(join(cwd, "mfe-app", "eslint.config.js"), "utf8"), /flat\/recommended/);
    assert.match(await readFile(join(cwd, "mfe-app", ".env.example"), "utf8"), /VITE_ENTRY_SUBAPP_TWO=/);
    assert.match(microApps, /microAppMetas\.map/);
    assert.match(microApps, /VITE_ENTRY_/);
    assert.match(microApps, /container: "#subapp-container"/);
    const hostApp = await readFile(join(cwd, "mfe-app", "apps", "host", "src", "App.vue"), "utf8");

    assert.match(hostApp, /hostEventBus\.emit/);
    assert.match(hostApp, /matchesActiveRule/);
    assert.doesNotMatch(hostApp, /startsWith\(app\.activeRule\)/);
    assert.match(lifecycle, /export function mount/);
    assert.match(lifecycle, /export function update/);
    assert.match(await readFile(join(cwd, "mfe-app", "apps", "subapp-two", "src", "App.vue"), "utf8"), /Sub App Two is ready/);
    assert.match(await readFile(join(cwd, "mfe-app", "apps", "subapp-two", "src", "App.vue"), "utf8"), /hostEventBus\.on/);
    assert.match(shared, /subapp-two/);
    assert.match(shared, /export const hostEventBus/);
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
    const cliPackageJson = await readFile(join(cwd, "platform", "cli", "package.json"), "utf8");

    assert.match(cliPackageJson, /"name": "@tsuz\/cli"/);
    assert.match(cliPackageJson, /"@tsuz\/template": "workspace:\*"/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
