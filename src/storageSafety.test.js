import test from "node:test";
import assert from "node:assert/strict";
import { tryWriteJson } from "./storageSafety.js";

test("returns success after JSON data is written", () => {
  const writes = [];
  const storage = { setItem: (key, value) => writes.push([key, value]) };
  const result = tryWriteJson(storage, "characters", { a: { name: "角色" } });
  assert.deepEqual(result, { ok: true, error: null });
  assert.deepEqual(writes, [["characters", '{"a":{"name":"角色"}}']]);
});

test("catches quota errors instead of allowing the app to crash", () => {
  const quotaError = new Error("QuotaExceededError");
  const storage = { setItem: () => { throw quotaError; } };
  const result = tryWriteJson(storage, "characters", { avatar: "large-data" });
  assert.equal(result.ok, false);
  assert.equal(result.error, quotaError);
});
