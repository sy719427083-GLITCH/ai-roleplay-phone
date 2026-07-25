import assert from "node:assert/strict";
import test from "node:test";
import { formatProjectAmount, formatProjectDuration, normalizeWorkProject } from "./workProjectContract.js";

const base = { name: "真实项目", description: "项目内容", difficulty: "中等" };

test("normalizes numeric API fields and derives display labels", () => {
  assert.deepEqual(normalizeWorkProject({ ...base, durationHours: 72, amountValue: 2100 }, "api-1-1"), {
    id: "api-1-1", ...base, durationHours: 72, amountValue: 2100, duration: "3 天", amount: "¥2,100",
  });
  assert.equal(formatProjectDuration(50), "50 小时");
  assert.equal(formatProjectAmount(2100.5), "¥2,100.5");
});

test("migrates supported legacy duration and money labels", () => {
  const migrated = normalizeWorkProject({ id: "old", ...base, duration: "48 小时", amount: "¥2,100.50" });
  assert.equal(migrated.durationHours, 48);
  assert.equal(migrated.amountValue, 2100.5);
  assert.equal(normalizeWorkProject({ id: "old-days", ...base, duration: "3 天", amount: "人民币 800" }).durationHours, 72);
});

test("rejects invalid numeric or required contract fields", () => {
  for (const project of [
    { ...base, durationHours: 0, amountValue: 10 },
    { ...base, durationHours: 1.5, amountValue: 10 },
    { ...base, durationHours: 24, amountValue: 0 },
    { ...base, durationHours: 24, amountValue: Infinity },
    { ...base, durationHours: 24, amountValue: 10, name: "" },
    { ...base, durationHours: 24, amountValue: 10, difficulty: "极难" },
  ]) assert.equal(normalizeWorkProject(project, "id"), null);
});

test("does not hide invalid new numeric fields behind legacy labels", () => {
  assert.equal(normalizeWorkProject({ ...base, durationHours: 0, duration: "3 天", amountValue: 20, amount: "¥20" }, "id"), null);
});

test("trims and truncates safe text fields", () => {
  const project = normalizeWorkProject({ ...base, name: `  ${"长".repeat(30)}  `, description: "内容".repeat(80), durationHours: 24, amountValue: 100 }, "id");
  assert.equal(project.name.length, 24);
  assert.equal(project.description.length, 100);
});
