import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_PROJECT_TASKS,
  hasRunningOfficeProject,
  normalizeProjectOfficePlan,
  selectOfficeProjectTask,
} from "./officeProjectTasks.js";

const project = {
  id: "p-data",
  name: "数据中台指标体系优化",
  description: "梳理指标口径并优化数据模型",
  scopeItems: ["收集业务数据", "制作管理看板", "输出分析报告"],
  deliverables: "数据报表、演示 PPT 与交付文档",
  acceptanceCriteria: "数据准确且通过验收",
};

const runningProject = { status: "running", project };
const occupants = [
  { slotId: "boss", profile: { id: "me:1" } },
  { slotId: "employee1", profile: { id: "character:1" } },
];

test("exposes the ten approved concrete labels", () => {
  assert.deepEqual(OFFICE_PROJECT_TASKS.map((item) => item.label), [
    "做 PPT", "做表格", "写项目方案", "整理项目资料", "收集项目数据",
    "分析项目数据", "制作项目报表", "核对项目预算", "编写交付文档", "检查项目成果",
  ]);
});

test("requires a running project with usable contract content", () => {
  assert.equal(hasRunningOfficeProject(runningProject), true);
  assert.equal(hasRunningOfficeProject({ status: "finished", project }), false);
  assert.equal(hasRunningOfficeProject({ status: "idle", project: null }), false);
  assert.equal(hasRunningOfficeProject({ status: "running", project: { id: "broken" } }), false);
});

test("selects a stable task and diversifies coworkers", () => {
  const first = selectOfficeProjectTask({ project, profileId: "me:1", intervalKey: "2026-07-31:40" });
  const again = selectOfficeProjectTask({ project, profileId: "me:1", intervalKey: "2026-07-31:40" });
  const second = selectOfficeProjectTask({ project, profileId: "character:1", intervalKey: "2026-07-31:40", usedLabels: new Set([first.label]) });
  assert.deepEqual(again, first);
  assert.ok(OFFICE_PROJECT_TASKS.some((item) => item.label === first.label));
  assert.notEqual(second.label, first.label);
});

test("uses every contract field to prefer a matching task", () => {
  const base = { id: "focused", name: "普通项目", description: "普通内容", scopeItems: ["普通工作"], deliverables: "普通文件", acceptanceCriteria: "通过" };
  for (const [field, value, expected] of [
    ["name", "品牌演示", "做 PPT"],
    ["description", "建立预算测算", "核对项目预算"],
    ["scopeItems", ["分析经营数据"], "分析项目数据"],
    ["deliverables", "编写交付文档", "编写交付文档"],
    ["acceptanceCriteria", "检查成果并验收", "检查项目成果"],
  ]) {
    const result = selectOfficeProjectTask({ project: { ...base, [field]: value }, profileId: "me:1", intervalKey: "fixed" });
    assert.equal(result.label, expected, field);
  }
});

test("removes work and printing without a running project", () => {
  const plan = { characters: {
    "me:1": { activity: "working", label: "工作中", destination: "boss-home" },
    "character:1": { activity: "printing", label: "打印中", destination: "print-station" },
  }, conversation: null };
  const result = normalizeProjectOfficePlan(plan, { occupants, projectContext: null, intervalKey: "idle", now: 1000 });
  for (const [id, slotId] of [["me:1", "boss"], ["character:1", "employee1"]]) {
    assert.equal(result.characters[id].activity, "idle");
    assert.equal(result.characters[id].label, "待命中");
    assert.equal(result.characters[id].destination, `${slotId}-home`);
  }
});

test("maps generic work and reporting to concrete project tasks", () => {
  const plan = { characters: {
    "me:1": { activity: "working", label: "工作中", destination: "rest-left" },
    "character:1": { activity: "reporting", label: "做报表", destination: "rest-right" },
  }, conversation: null };
  const result = normalizeProjectOfficePlan(plan, { occupants, projectContext: runningProject, intervalKey: "active", now: 1000 });
  for (const [id, slotId] of [["me:1", "boss"], ["character:1", "employee1"]]) {
    assert.equal(result.characters[id].activity, "working");
    assert.notEqual(result.characters[id].label, "工作中");
    assert.ok(OFFICE_PROJECT_TASKS.some((item) => item.label === result.characters[id].label));
    assert.equal(result.characters[id].destination, `${slotId}-home`);
  }
});
