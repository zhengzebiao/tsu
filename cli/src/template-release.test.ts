import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { decodeRemoteTemplateManifest } from "./contracts.js";
import {
  compareTemplateVersions,
  createGitHubHeaders,
  downloadFile,
  fetchGitHubRelease,
  findRemoteTemplateDefinition,
  findTemplateAsset,
  findTemplateVersionsFromReleases,
  getTemplateAssetName,
  getTemplateCachePaths,
  getTemplateReleaseAssetUrl,
  getReleaseTag,
  isExplicitTemplateVersion,
  ensureTemplateBundle,
  newestTemplateVersion,
  normalizeTemplateVersion,
  parseTemplateAssetVersion,
  remoteManifestIncludesTemplate,
  remoteManifestTemplateNames
} from "./template-release.js";

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test("normalizeTemplateVersion accepts strict SemVer selectors", () => {
  assert.equal(normalizeTemplateVersion("v1.2.3"), "1.2.3");
  assert.equal(normalizeTemplateVersion("1.2.3-rc.1"), "1.2.3-rc.1");
  assert.equal(normalizeTemplateVersion("latest"), "latest");
  assert.throws(() => normalizeTemplateVersion("1.2"), /complete SemVer/);
  assert.throws(() => normalizeTemplateVersion("1.2.3+build.1"), /complete SemVer/);
});

test("getReleaseTag maps versions to release tags", () => {
  assert.equal(getReleaseTag("latest"), "latest");
  assert.equal(getReleaseTag("1.2.3"), "template-v1.2.3");
  assert.equal(getReleaseTag("v1.2.3"), "template-v1.2.3");
});

test("parseTemplateAssetVersion reads only valid template archive versions", () => {
  assert.equal(parseTemplateAssetVersion("tsu-templates-v1.2.3.tar.gz"), "1.2.3");
  assert.equal(parseTemplateAssetVersion("tsu-templates-v1.2.3-rc.1.tar.gz"), "1.2.3-rc.1");
  assert.equal(parseTemplateAssetVersion("tsu-templates-vnot-a-version.tar.gz"), undefined);
  assert.equal(parseTemplateAssetVersion("other.tar.gz"), undefined);
});

test("template asset helpers build direct release URLs", () => {
  assert.equal(isExplicitTemplateVersion("1.2.3"), true);
  assert.equal(isExplicitTemplateVersion("v1.2.3"), true);
  assert.equal(isExplicitTemplateVersion("latest"), false);
  assert.equal(isExplicitTemplateVersion(undefined), false);
  assert.equal(getTemplateAssetName("v1.2.3"), "tsu-templates-v1.2.3.tar.gz");
  assert.equal(getTemplateReleaseAssetUrl("company/templates", "v1.2.3"), "https://github.com/company/templates/releases/download/template-v1.2.3/tsu-templates-v1.2.3.tar.gz");
  assert.throws(() => getTemplateAssetName("latest"), /Cannot build a template asset name for latest/);
});

test("createGitHubHeaders includes token for GitHub hosts", () => {
  const originalGithubToken = process.env.GITHUB_TOKEN;
  const originalGhToken = process.env.GH_TOKEN;

  try {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    assert.deepEqual(createGitHubHeaders("application/vnd.github+json"), {
      Accept: "application/vnd.github+json",
      "User-Agent": "tsu-cli"
    });

    process.env.GH_TOKEN = "gh-token";
    assert.equal(createGitHubHeaders("application/vnd.github+json").Authorization, "Bearer gh-token");
    assert.equal(createGitHubHeaders("application/octet-stream", "https://github.com/company/templates/releases/download/template-v1.2.3/tsu-templates-v1.2.3.tar.gz").Authorization, "Bearer gh-token");
    assert.equal(createGitHubHeaders("application/octet-stream", "https://example.com/template.tar.gz").Authorization, undefined);

    process.env.GITHUB_TOKEN = "github-token";
    assert.equal(createGitHubHeaders("application/vnd.github+json").Authorization, "Bearer github-token");
  } finally {
    restoreEnv("GITHUB_TOKEN", originalGithubToken);
    restoreEnv("GH_TOKEN", originalGhToken);
  }
});

test("release resolution errors include private repository guidance", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => new Response("forbidden", { status: 403, statusText: "Forbidden" });

    await assert.rejects(() => fetchGitHubRelease("company/templates", "1.2.3"), /set GITHUB_TOKEN or GH_TOKEN with repository read access/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("template asset download errors include release asset guidance", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () => new Response("missing", { status: 404, statusText: "Not Found" });

    await assert.rejects(() => downloadFile("https://github.com/company/templates/releases/download/template-v1.2.3/tsu-templates-v1.2.3.tar.gz", "/tmp/tsu-missing-template.tar.gz"), /tsu-templates-v<version>\.tar\.gz/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getTemplateCachePaths keeps repositories isolated", () => {
  const originalCacheDir = process.env.TSU_TEMPLATE_CACHE_DIR;

  try {
    process.env.TSU_TEMPLATE_CACHE_DIR = "/cache";
    assert.deepEqual(getTemplateCachePaths("company/templates", "tsu-templates-v1.2.3.tar.gz"), {
      repositoryDir: join("/cache", "company", "templates"),
      archivePath: join("/cache", "company", "templates", "tsu-templates-v1.2.3.tar.gz"),
      bundleDir: join("/cache", "company", "templates", "tsu-templates-v1.2.3"),
      bundleName: "tsu-templates-v1.2.3"
    });
  } finally {
    restoreEnv("TSU_TEMPLATE_CACHE_DIR", originalCacheDir);
  }
});

test("findTemplateAsset finds the template archive", () => {
  assert.equal(
    findTemplateAsset({
      tag_name: "template-v1.2.3",
      assets: [{ name: "tsu-templates-v1.2.3.tar.gz", browser_download_url: "https://example.com/template.tar.gz" }]
    }).name,
    "tsu-templates-v1.2.3.tar.gz"
  );
  assert.throws(() => findTemplateAsset({ tag_name: "template-v1.2.3", assets: [] }), /Upload an asset named tsu-templates-v<version>\.tar\.gz/);
});

test("findTemplateVersionsFromReleases keeps only template assets", () => {
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

test("remote manifest helpers support normalized legacy and rich template shapes", () => {
  const legacy = decodeRemoteTemplateManifest({ version: "1.0.0", templates: ["default", "vue3"] }, { location: "legacy manifest" });

  assert.deepEqual(remoteManifestTemplateNames(legacy), ["default", "vue3"]);
  assert.deepEqual(remoteManifestTemplateNames({ version: "1.0.0", templates: [{ name: "default" }, { name: "react" }] }), ["default", "react"]);
  assert.equal(remoteManifestIncludesTemplate({ version: "1.0.0", templates: [{ name: "react" }] }, "react"), true);
  assert.equal(remoteManifestIncludesTemplate({ version: "1.0.0", templates: [{ name: "react" }] }, "vue3"), false);
  assert.deepEqual(findRemoteTemplateDefinition(legacy, "vue3"), { name: "vue3" });
  assert.deepEqual(findRemoteTemplateDefinition({ version: "1.0.0", templates: [{ name: "vue3", description: "Vue release" }] }, "vue3"), {
    name: "vue3",
    description: "Vue release"
  });
  assert.equal(findRemoteTemplateDefinition({ version: "1.0.0", templates: [{ name: "react" }] }, "vue3"), undefined);
});

test("cached malformed manifests fail instead of becoming cache misses", async () => {
  const root = await mkdtemp(join(tmpdir(), "tsu-contract-cache-"));
  const originalCacheDir = process.env.TSU_TEMPLATE_CACHE_DIR;
  const assetName = "tsu-templates-v1.2.3.tar.gz";

  try {
    process.env.TSU_TEMPLATE_CACHE_DIR = root;
    const cachePaths = getTemplateCachePaths("company/templates", assetName);
    await mkdir(cachePaths.bundleDir, { recursive: true });
    await writeFile(join(cachePaths.bundleDir, "manifest.json"), JSON.stringify({ version: "1.2.3", templates: {} }), "utf8");

    await assert.rejects(
      () => ensureTemplateBundle("company/templates", assetName, "https://example.com/template.tar.gz"),
      (error: unknown) => error instanceof Error && /templates must be a non-empty array/.test(error.message)
    );
  } finally {
    restoreEnv("TSU_TEMPLATE_CACHE_DIR", originalCacheDir);
    await rm(root, { force: true, recursive: true });
  }
});

test("version comparison follows SemVer precedence", () => {
  assert.equal(compareTemplateVersions("1.10.0", "1.2.0") > 0, true);
  assert.equal(compareTemplateVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareTemplateVersions("1.0.0-alpha", "1.0.0") < 0, true);
  assert.equal(compareTemplateVersions("1.0.0-beta.2", "1.0.0-beta.11") < 0, true);
  assert.equal(newestTemplateVersion(["1.0.0-alpha", "1.0.0", "1.0.0-beta.11"]), "1.0.0");
  assert.throws(() => compareTemplateVersions("1.foo.2", "1.0.0"), /complete SemVer/);
  assert.equal(newestTemplateVersion([]), undefined);
});
