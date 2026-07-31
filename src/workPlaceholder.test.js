import assert from "node:assert/strict";
import test from "node:test";
import { WORK_APP_CACHE_KEYS, clearWorkAppCache } from "./workPlaceholder.js";

test("declares exactly the three Work-owned caches", () => {
  assert.deepEqual(WORK_APP_CACHE_KEYS, [
    "ccatWorkCompanyV1",
    "ccatWorkOfficeV1",
    "ccatWorkProjectsV1",
  ]);
});

test("clears only Work caches and preserves unrelated APP data", () => {
  const values = new Map([
    ["ccatWorkCompanyV1", "company"],
    ["ccatWorkOfficeV1", "office"],
    ["ccatWorkProjectsV1", "projects"],
    ["apiCharacters", "characters"],
    ["ccat-wallet-v1", "wallet"],
  ]);
  const storage = { removeItem: (key) => values.delete(key) };
  assert.deepEqual(clearWorkAppCache(storage), []);
  assert.deepEqual([...values], [["apiCharacters", "characters"], ["ccat-wallet-v1", "wallet"]]);
});

test("continues clearing after one storage failure", () => {
  const attempted = [];
  const storage = { removeItem(key) {
    attempted.push(key);
    if (key === "ccatWorkOfficeV1") throw new Error("quota");
  } };
  assert.deepEqual(clearWorkAppCache(storage), ["ccatWorkOfficeV1"]);
  assert.deepEqual(attempted, WORK_APP_CACHE_KEYS);
});
