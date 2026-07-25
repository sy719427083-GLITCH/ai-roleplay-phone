import assert from "node:assert/strict";
import test from "node:test";
import {
  WORK_COMPANY_STORAGE_KEY,
  createWorkCompany,
  limitWorkCompanyPrefix,
  normalizeWorkCompanyPrefix,
  restoreWorkCompany,
  serializeWorkCompany,
} from "./workCompanyState.js";

test("uses an isolated company storage key", () => {
  assert.equal(WORK_COMPANY_STORAGE_KEY, "ccatWorkCompanyV1");
});

test("limits company prefixes by Unicode characters", () => {
  assert.equal(limitWorkCompanyPrefix("星河设计事务所"), "星河设计事");
  assert.equal(limitWorkCompanyPrefix("A😀BCDZ"), "A😀BCD");
  assert.equal(normalizeWorkCompanyPrefix("  星河  "), "星河");
});

test("creates and restores a complete company", () => {
  const company = createWorkCompany("星河", "2026-07-26T10:00:00.000Z");
  assert.deepEqual(company, {
    version: 1,
    prefix: "星河",
    fullName: "星河有限公司",
    createdAt: "2026-07-26T10:00:00.000Z",
  });
  assert.deepEqual(restoreWorkCompany(serializeWorkCompany(company)), company);
});

test("rejects empty, malformed, mismatched, or oversized companies", () => {
  assert.throws(() => createWorkCompany("   "), /请输入公司名称/);
  assert.equal(restoreWorkCompany("broken"), null);
  assert.equal(restoreWorkCompany(JSON.stringify({ version: 1, prefix: "星河", fullName: "错误公司", createdAt: "2026-07-26T10:00:00.000Z" })), null);
  assert.equal(restoreWorkCompany(JSON.stringify({ version: 1, prefix: "一二三四五六", fullName: "一二三四五六有限公司", createdAt: "2026-07-26T10:00:00.000Z" })), null);
});
