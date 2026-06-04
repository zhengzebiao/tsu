import assert from "node:assert/strict";
import test from "node:test";

import { QuickStartSdk, SdkError, createClient } from "../dist/index.js";

test("keeps QuickStartSdk base URL helper", () => {
  const sdk = new QuickStartSdk({ baseUrl: "https://api.example.com" });

  assert.equal(sdk.getBaseUrl(), "https://api.example.com");
});

test("creates a client with normalized base URL", () => {
  const client = createClient({ baseUrl: "https://api.example.com/" });

  assert.equal(client.getBaseUrl(), "https://api.example.com");
});

test("uses adapter for typed get requests", async () => {
  const client = createClient({
    baseUrl: "https://api.example.com",
    async adapter({ method, path, url }) {
      assert.equal(method, "GET");
      assert.equal(path, "/users");
      assert.equal(url, "https://api.example.com/users");
      return [{ id: 1, name: "Tsu" }];
    }
  });

  assert.deepEqual(await client.get("users"), [{ id: 1, name: "Tsu" }]);
});

test("throws SdkError for non-ok fetch responses", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({})
  });

  try {
    const client = createClient({ baseUrl: "https://api.example.com" });

    await assert.rejects(() => client.get("/health"), (error) => error instanceof SdkError && error.status === 503);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
