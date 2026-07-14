import assert from "node:assert/strict";
import test from "node:test";
import {
  ContractError,
  decodeGitHubRelease,
  decodeRemoteTemplateManifest,
  decodeTemplateMetadata,
  normalizeConcreteTemplateVersion,
  parseRemoteTemplateManifest,
  parseTemplateMetadata,
  stringifyTemplateMetadata
} from "./contracts.js";

const richTemplate = {
  name: "vue3",
  title: "Vue 3 Web App",
  description: "Vue release",
  tags: ["vue"],
  recommendedFor: ["web app"],
  node: ">=20",
  packageManagers: ["pnpm"],
  nextSteps: ["pnpm install"]
};

const manifestContext = {
  location: "/cache/tsu-templates-v1.2.3/manifest.json",
  expectedVersion: "1.2.3",
  expectedAsset: "tsu-templates-v1.2.3.tar.gz"
};

test("concrete template versions use strict SemVer", () => {
  assert.equal(normalizeConcreteTemplateVersion("1.2.3"), "1.2.3");
  assert.equal(normalizeConcreteTemplateVersion("v1.2.3-rc.1"), "1.2.3-rc.1");

  for (const version of ["latest", "1", "1.2", "V1.2.3", "vv1.2.3", "=1.2.3", " 1.2.3", "1.2.3 ", "01.2.3", "1.2.3+build.1", "../1.2.3"]) {
    assert.throws(() => normalizeConcreteTemplateVersion(version), (error: unknown) => error instanceof ContractError && error.code === "TEMPLATE_VERSION_INVALID");
  }
});

test("manifest decoder normalizes legacy string and partial rich entries", () => {
  assert.deepEqual(
    decodeRemoteTemplateManifest(
      {
        version: "1.2.3",
        templates: ["default", { name: "vue3", description: "Historical definition", nextSteps: ["pnpm dev"] }]
      },
      manifestContext
    ),
    {
      version: "1.2.3",
      templates: [{ name: "default" }, { name: "vue3", description: "Historical definition", nextSteps: ["pnpm dev"] }]
    }
  );
});

test("manifest decoder validates and normalizes schema v0.5", () => {
  assert.deepEqual(
    decodeRemoteTemplateManifest(
      {
        name: "tsuz-template",
        schemaVersion: "0.5",
        version: "v1.2.3",
        asset: "tsu-templates-v1.2.3.tar.gz",
        changelog: ["Stable contracts"],
        templates: [richTemplate],
        ignored: true
      },
      manifestContext
    ),
    {
      name: "tsuz-template",
      schemaVersion: "0.5",
      version: "1.2.3",
      asset: "tsu-templates-v1.2.3.tar.gz",
      changelog: ["Stable contracts"],
      templates: [richTemplate]
    }
  );
});

test("manifest decoder rejects invalid JSON and future schemas with coded errors", () => {
  assert.throws(
    () => parseRemoteTemplateManifest("{", manifestContext),
    (error: unknown) => error instanceof ContractError && error.code === "TEMPLATE_MANIFEST_INVALID_JSON" && error.location === manifestContext.location
  );
  assert.throws(
    () => decodeRemoteTemplateManifest({ schemaVersion: "1.0", version: "1.2.3", templates: [richTemplate] }, manifestContext),
    (error: unknown) => error instanceof ContractError && error.code === "TEMPLATE_MANIFEST_SCHEMA_UNSUPPORTED" && /supports schemaVersion "0\.5"/.test(error.message)
  );
});

test("manifest decoder rejects malformed shapes and archive mismatches", () => {
  const valid = {
    name: "tsuz-template",
    schemaVersion: "0.5",
    version: "1.2.3",
    asset: "tsu-templates-v1.2.3.tar.gz",
    templates: [richTemplate]
  };

  for (const value of [null, [], {}, { version: "1.2.3", templates: {} }, { ...valid, templates: ["vue3"] }, { ...valid, templates: [{ ...richTemplate, title: undefined }] }]) {
    assert.throws(
      () => decodeRemoteTemplateManifest(value, manifestContext),
      (error: unknown) => error instanceof ContractError && error.code === "TEMPLATE_MANIFEST_INVALID" && !/TypeError/.test(error.message)
    );
  }

  assert.throws(() => decodeRemoteTemplateManifest({ ...valid, version: "1.2.4" }, manifestContext), /does not match archive version/);
  assert.throws(() => decodeRemoteTemplateManifest({ ...valid, asset: "tsu-templates-v1.2.4.tar.gz" }, manifestContext), /does not match archive asset/);
  assert.throws(() => decodeRemoteTemplateManifest({ ...valid, templates: [richTemplate, richTemplate] }, manifestContext), /duplicate name/);
});

test("metadata decoder preserves supported legacy metadata", () => {
  assert.deepEqual(
    decodeTemplateMetadata({ template: { name: "vue3", version: "latest", source: "local", repository: "historical/repository" }, extra: true }),
    { template: { name: "vue3", version: "latest", source: "local", repository: "historical/repository" } }
  );
  assert.deepEqual(decodeTemplateMetadata({ template: { name: "private", version: "1.2.3", source: "remote" } }), {
    template: { name: "private", version: "1.2.3", source: "remote" }
  });
});

test("metadata decoder rejects malformed JSON, shapes, versions, and timestamps", () => {
  assert.throws(
    () => parseTemplateMetadata("{"),
    (error: unknown) => error instanceof ContractError && error.code === "TEMPLATE_METADATA_INVALID_JSON"
  );

  for (const value of [null, [], {}, { template: null }, { template: { name: "", version: "1.2.3", source: "remote" } }, { template: { name: "vue3", version: "1.2", source: "remote" } }, { template: { name: "vue3", version: "1.2.3", source: "other" } }, { template: { name: "vue3", version: "1.2.3", source: "remote" }, generatedAt: "2026-02-30T00:00:00.000Z" }]) {
    assert.throws(
      () => decodeTemplateMetadata(value),
      (error: unknown) => error instanceof ContractError && error.code === "TEMPLATE_METADATA_INVALID" && !/TypeError/.test(error.message)
    );
  }
});

test("metadata serializer validates, pretty prints, and adds one newline", () => {
  const metadata = {
    template: { name: "vue3", version: "v1.2.3", source: "remote" as const, repository: "company/templates" },
    generatedAt: "2026-07-14T12:00:00.000Z"
  };
  const serialized = stringifyTemplateMetadata(metadata);

  assert.equal(serialized.endsWith("\n"), true);
  assert.equal(serialized.endsWith("\n\n"), false);
  assert.deepEqual(JSON.parse(serialized), {
    template: { name: "vue3", version: "1.2.3", source: "remote", repository: "company/templates" },
    generatedAt: "2026-07-14T12:00:00.000Z"
  });
});

test("GitHub response decoder rejects malformed API payloads", () => {
  assert.deepEqual(
    decodeGitHubRelease({ tag_name: "template-v1.2.3", assets: [{ name: "archive", browser_download_url: "https://example.com/archive" }] }, "release endpoint"),
    { tag_name: "template-v1.2.3", assets: [{ name: "archive", browser_download_url: "https://example.com/archive" }] }
  );
  assert.throws(
    () => decodeGitHubRelease({ tag_name: "template-v1.2.3", assets: {} }, "release endpoint"),
    (error: unknown) => error instanceof ContractError && error.code === "GITHUB_RESPONSE_INVALID"
  );
});
