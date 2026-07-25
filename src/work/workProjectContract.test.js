import assert from "node:assert/strict";
import test from "node:test";
import { formatProjectAmount, formatProjectDuration, normalizeWorkProject } from "./workProjectContract.js";

const base = {
  name: "真实项目",
  description: "项目内容",
  scopeItems: ["范围一", "范围二", "范围三"],
  deliverables: "交付成果",
  acceptanceCriteria: "验收标准",
  difficulty: "中等",
};

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

test("keeps older cached contracts readable when detailed API clauses are absent", () => {
  const legacy = normalizeWorkProject({
    name: "旧项目", description: "旧合同正文", difficulty: "简单", durationHours: 24, amountValue: 800,
  }, "legacy");
  assert.equal(legacy.description, "旧合同正文");
  assert.deepEqual(legacy.scopeItems, ["旧合同正文"]);
  assert.equal(legacy.deliverables, null);
  assert.equal(legacy.acceptanceCriteria, null);
});

test("rejects malformed new scope lists and trims valid scope items", () => {
  assert.equal(normalizeWorkProject({ ...base, scopeItems: ["一", "二"], durationHours: 24, amountValue: 100 }, "id"), null);
  assert.equal(normalizeWorkProject({ ...base, scopeItems: ["一", "", "三"], durationHours: 24, amountValue: 100 }, "id"), null);
  const project = normalizeWorkProject({ ...base, scopeItems: [" 范围一 ", "范围二", "范围三"], durationHours: 24, amountValue: 100 }, "id");
  assert.deepEqual(project.scopeItems, ["范围一", "范围二", "范围三"]);
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
  const project = normalizeWorkProject({
    ...base,
    name: `  ${"长".repeat(30)}  `,
    description: "内容".repeat(80),
    deliverables: "交付".repeat(80),
    acceptanceCriteria: "验收".repeat(80),
    durationHours: 24,
    amountValue: 100,
  }, "id");
  assert.equal(project.name.length, 24);
  assert.equal(project.description.length, 100);
  assert.equal(project.deliverables.length, 100);
  assert.equal(project.acceptanceCriteria.length, 100);
});
