import assert from "node:assert/strict";
import test from "node:test";
import { assertTemplateReleaseAssetAvailable } from "./template-release-publish.mjs";

test("allows publishing when no release exists", () => {
  assert.doesNotThrow(() => assertTemplateReleaseAssetAvailable(undefined, "template-v1.0.0", "tsu-templates-v1.0.0.tar.gz"));
});

test("allows retrying an existing release without the versioned asset", () => {
  assert.doesNotThrow(() => assertTemplateReleaseAssetAvailable({ assets: [] }, "template-v1.0.0", "tsu-templates-v1.0.0.tar.gz"));
});

test("refuses to replace an existing template release asset", () => {
  assert.throws(
    () =>
      assertTemplateReleaseAssetAvailable(
        { assets: [{ name: "tsu-templates-v1.0.0.tar.gz" }] },
        "template-v1.0.0",
        "tsu-templates-v1.0.0.tar.gz"
      ),
    /Refusing to replace existing asset tsu-templates-v1\.0\.0\.tar\.gz/
  );
});
