import assert from "node:assert/strict";
import test from "node:test";
import { clearWorkCache, WORK_CACHE_STORAGE_KEYS } from "./workCache.js";

test("declares only the three Work cache keys", () => {
  assert.deepEqual(WORK_CACHE_STORAGE_KEYS, [
    "ccatWorkCompanyV1",
    "ccatWorkOfficeV1",
    "ccatWorkProjectsV1",
  ]);
});

test("clears Work cache without touching unrelated data", () => {
  const values = new Map([
    ["ccatWorkCompanyV1", "company"],
    ["ccatWorkOfficeV1", "office"],
    ["ccatWorkProjectsV1", "projects"],
    ["ccatWalletV1", "wallet"],
    ["ccat-api-configs", "api"],
    ["apiCharacters", "characters"],
  ]);
  const removed = [];

  clearWorkCache({
    removeItem(key) {
      removed.push(key);
      values.delete(key);
    },
  });

  assert.deepEqual(removed, WORK_CACHE_STORAGE_KEYS);
  assert.equal(values.get("ccatWalletV1"), "wallet");
  assert.equal(values.get("ccat-api-configs"), "api");
  assert.equal(values.get("apiCharacters"), "characters");
});

test("reports storage removal failures", () => {
  assert.throws(
    () => clearWorkCache({ removeItem() { throw new Error("denied"); } }),
    /denied/,
  );
});
