import assert from "node:assert/strict";
import test from "node:test";

import { isPlainObject, pick, sleep, toErrorMessage } from "../dist/js/index.js";

test("detects plain objects", () => {
  assert.equal(isPlainObject({ ok: true }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
});

test("picks selected keys", () => {
  assert.deepEqual(pick({ id: 1, name: "Tsu", internal: true }, ["id", "name"]), { id: 1, name: "Tsu" });
});

test("converts unknown errors to messages", () => {
  assert.equal(toErrorMessage(new Error("boom")), "boom");
  assert.equal(toErrorMessage("plain"), "plain");
  assert.equal(toErrorMessage({ message: "from object" }), "from object");
  assert.equal(toErrorMessage({ reason: "missing" }), "Unexpected error");
});

test("sleeps for a delay", async () => {
  const startedAt = Date.now();

  await sleep(5);

  assert.equal(Date.now() >= startedAt, true);
});
