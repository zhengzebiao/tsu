import assert from "node:assert/strict";
import test from "node:test";
import { isTemplateReleasePrerelease, normalizeTemplateReleaseVersion, readTemplateReleaseVersion } from "./template-release-version.mjs";

test("normalizes stable and prerelease template versions", () => {
  assert.equal(normalizeTemplateReleaseVersion("1.0.0"), "1.0.0");
  assert.equal(normalizeTemplateReleaseVersion("v1.0.0-rc.1"), "1.0.0-rc.1");
  assert.equal(isTemplateReleasePrerelease("1.0.0"), false);
  assert.equal(isTemplateReleasePrerelease("1.0.0-rc.1"), true);
});

test("rejects missing, malformed, partial, and ambiguous versions", () => {
  for (const version of [undefined, "", "latest", "1", "1.0", "V1.0.0", "vv1.0.0", "=1.0.0", " 1.0.0", "1.0.0 ", "01.0.0", "1.0.0+build.1", "../1.0.0"]) {
    assert.throws(() => normalizeTemplateReleaseVersion(version), /Missing template release version|Invalid template release version/);
  }
});

test("argv version takes precedence over the environment", () => {
  assert.equal(readTemplateReleaseVersion({ argv: ["node", "script", "--version=v1.2.3"], env: { TEMPLATE_VERSION: "2.0.0" } }), "1.2.3");
  assert.equal(readTemplateReleaseVersion({ argv: ["node", "script"], env: { TEMPLATE_VERSION: "v2.0.0-rc.1" } }), "2.0.0-rc.1");
});
