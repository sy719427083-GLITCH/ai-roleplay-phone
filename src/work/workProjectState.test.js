import assert from "node:assert/strict";
import test from "node:test";
import {
  WORK_PROJECTS_STORAGE_KEY,
  clearCompletedWorkProject,
  createEmptyWorkProjectState,
  replaceWorkProjects,
  restoreWorkProjectState,
  serializeWorkProjectState,
  startWorkProject,
} from "./workProjectState.js";

const projects = Array.from({ length: 5 }, (_, index) => ({
  id: `api-1-${index + 1}`,
  name: `项目 ${index + 1}`,
  durationHours: index === 0 ? 72 : (index + 2) * 24,
  amountValue: (index + 1) * 1000,
  duration: index === 0 ? "3 天" : `${index + 2} 天`,
  amount: `¥${(index + 1).toLocaleString()}000`.replace(",000", ",000"),
  description: `第 ${index + 1} 份项目内容`,
  difficulty: ["简单", "中等", "困难"][index % 3],
}));
projects.forEach((project) => { project.amount = `¥${project.amountValue.toLocaleString("en-US")}`; });

const generatedState = () => replaceWorkProjects(createEmptyWorkProjectState(), projects, "main", "2026-07-25T00:00:00.000Z");

test("starts empty and exposes a stable storage key", () => {
  assert.equal(WORK_PROJECTS_STORAGE_KEY, "ccatWorkProjectsV1");
  assert.deepEqual(createEmptyWorkProjectState(), {
    projects: [], startedProjectId: null, startedAt: null, endsAt: null,
    revision: 0, source: null, generatedAt: null,
  });
});

test("replaces only with five valid generated projects", () => {
  const empty = createEmptyWorkProjectState();
  const replaced = replaceWorkProjects(empty, projects, "secondary", "2026-07-25T00:00:00.000Z");
  assert.equal(replaced.revision, 1);
  assert.equal(replaced.source, "secondary");
  assert.equal(replaced.startedAt, null);
  assert.strictEqual(replaceWorkProjects(empty, projects.slice(0, 4), "main"), empty);
});

test("signing records absolute project timestamps and locks the batch", () => {
  const ready = generatedState();
  const startMs = Date.parse("2026-07-25T00:00:00Z");
  const signed = startWorkProject(ready, projects[0].id, startMs);
  assert.equal(signed.startedProjectId, projects[0].id);
  assert.equal(signed.startedAt, "2026-07-25T00:00:00.000Z");
  assert.equal(signed.endsAt, "2026-07-28T00:00:00.000Z");
  assert.strictEqual(startWorkProject(signed, projects[1].id, startMs), signed);
  assert.strictEqual(startWorkProject(ready, "missing", startMs), ready);
});

test("migrates unsigned and signed legacy contract caches", () => {
  const legacyProjects = projects.map(({ durationHours, amountValue, ...project }) => project);
  const base = { projects: legacyProjects, startedProjectId: null, revision: 2, source: "main", generatedAt: null };
  const unsigned = restoreWorkProjectState(JSON.stringify(base), Date.parse("2026-07-25T00:00:00Z"));
  assert.equal(unsigned.projects[0].durationHours, 72);
  assert.equal(unsigned.projects[0].amountValue, 1000);
  const signed = restoreWorkProjectState(JSON.stringify({ ...base, startedProjectId: projects[0].id }), Date.parse("2026-07-25T00:00:00Z"));
  assert.equal(signed.startedAt, "2026-07-25T00:00:00.000Z");
  assert.equal(signed.endsAt, "2026-07-28T00:00:00.000Z");
});

test("rejects incomplete, duplicate, or inconsistent caches", () => {
  const state = { ...generatedState(), startedProjectId: projects[0].id, startedAt: "2026-07-26T00:00:00.000Z", endsAt: "2026-07-25T00:00:00.000Z" };
  assert.deepEqual(restoreWorkProjectState("not json"), createEmptyWorkProjectState());
  assert.deepEqual(restoreWorkProjectState(JSON.stringify({ ...state, projects: projects.slice(1) })), createEmptyWorkProjectState());
  assert.deepEqual(restoreWorkProjectState(JSON.stringify({ ...state, startedProjectId: "missing" })), createEmptyWorkProjectState());
  assert.deepEqual(restoreWorkProjectState(JSON.stringify(state)), createEmptyWorkProjectState());
});

test("clears only a completed project and preserves revision", () => {
  const startMs = Date.parse("2026-07-25T00:00:00Z");
  const signed = startWorkProject(generatedState(), projects[0].id, startMs);
  assert.strictEqual(clearCompletedWorkProject(signed, startMs + 1000), signed);
  const cleared = clearCompletedWorkProject(signed, Date.parse(signed.endsAt));
  assert.deepEqual(cleared, { ...createEmptyWorkProjectState(), revision: signed.revision });
});

test("serializes only the safe project cache fields", () => {
  const signed = { ...startWorkProject(generatedState(), projects[0].id, 0), apiKey: "secret" };
  const saved = JSON.parse(serializeWorkProjectState(signed));
  assert.deepEqual(Object.keys(saved), ["projects", "startedProjectId", "startedAt", "endsAt", "revision", "source", "generatedAt"]);
  assert.equal(JSON.stringify(saved).includes("secret"), false);
  assert.deepEqual(restoreWorkProjectState(serializeWorkProjectState({ ...createEmptyWorkProjectState(), revision: 4 })), { ...createEmptyWorkProjectState(), revision: 4 });
});
