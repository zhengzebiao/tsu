import assert from "node:assert/strict";
import test from "node:test";
import {
  compareTemplateVersions,
  findRemoteTemplateDefinition,
  findTemplateAsset,
  findTemplateVersionsFromReleases,
  getReleaseTag,
  newestTemplateVersion,
  normalizeTemplateVersion,
  parseTemplateAssetVersion,
  remoteManifestIncludesTemplate,
  remoteManifestTemplateNames
} from "./template-release.js";

test("normalizeTemplateVersion strips v prefix and keeps latest", () => {
  assert.equal(normalizeTemplateVersion("v1.2.3"), "1.2.3");
  assert.equal(normalizeTemplateVersion("1.2.3"), "1.2.3");
  assert.equal(normalizeTemplateVersion("latest"), "latest");
});

test("getReleaseTag maps versions to release tags", () => {
  assert.equal(getReleaseTag("latest"), "latest");
  assert.equal(getReleaseTag("1.2.3"), "template-v1.2.3");
  assert.equal(getReleaseTag("v1.2.3"), "template-v1.2.3");
});

test("parseTemplateAssetVersion reads template archive versions", () => {
  assert.equal(parseTemplateAssetVersion("tsu-templates-v1.2.3.tar.gz"), "1.2.3");
  assert.equal(parseTemplateAssetVersion("other.tar.gz"), undefined);
});

test("findTemplateAsset finds the template archive", () => {
  assert.equal(
    findTemplateAsset({
      tag_name: "template-v1.2.3",
      assets: [{ name: "tsu-templates-v1.2.3.tar.gz", browser_download_url: "https://example.com/template.tar.gz" }]
    }).name,
    "tsu-templates-v1.2.3.tar.gz"
  );
  assert.throws(() => findTemplateAsset({ tag_name: "template-v1.2.3", assets: [] }), /No tsu template asset found/);
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

test("remote manifest helpers support old and rich template shapes", () => {
  assert.deepEqual(remoteManifestTemplateNames({ version: "1.0.0", templates: ["default", "vue3"] }), ["default", "vue3"]);
  assert.deepEqual(remoteManifestTemplateNames({ version: "1.0.0", templates: [{ name: "default" }, { name: "react" }] }), ["default", "react"]);
  assert.equal(remoteManifestIncludesTemplate({ version: "1.0.0", templates: [{ name: "react" }] }, "react"), true);
  assert.equal(remoteManifestIncludesTemplate({ version: "1.0.0", templates: [{ name: "react" }] }, "vue3"), false);
  assert.deepEqual(findRemoteTemplateDefinition({ version: "1.0.0", templates: ["vue3"] }, "vue3"), { name: "vue3" });
  assert.deepEqual(findRemoteTemplateDefinition({ version: "1.0.0", templates: [{ name: "vue3", description: "Vue release" }] }, "vue3"), {
    name: "vue3",
    description: "Vue release"
  });
  assert.equal(findRemoteTemplateDefinition({ version: "1.0.0", templates: [{ name: "react" }] }, "vue3"), undefined);
});

test("version comparison orders numeric segments", () => {
  assert.equal(compareTemplateVersions("1.10.0", "1.2.0") > 0, true);
  assert.equal(compareTemplateVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareTemplateVersions("1.2.0", "1.10.0") < 0, true);
  assert.equal(newestTemplateVersion(["1.0.0", "1.10.0", "1.2.0"]), "1.10.0");
  assert.equal(newestTemplateVersion([]), undefined);
});
