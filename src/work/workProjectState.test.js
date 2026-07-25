import assert from "node:assert/strict";
import test from "node:test";
import {
  WORK_PROJECTS_STORAGE_KEY,
  createEmptyWorkProjectState,
  replaceWorkProjects,
  restoreWorkProjectState,
  serializeWorkProjectState,
  startWorkProject,
} from "./workProjectState.js";

const projects = Array.from({ length: 5 }, (_, index) => ({
  id: `api-1-${index + 1}`,
  name: `项目 ${index + 1}`,
  duration: `${index + 2} 天`,
  amount: `¥${(index + 1) * 1000}`,
  description: `第 ${index + 1} 份项目内容`,
  difficulty: ["简单", "中等", "困难"][index % 3],
}));

test("starts empty and exposes a stable storage key", () => {
  assert.equal(WORK_PROJECTS_STORAGE_KEY, "ccatWorkProjectsV1");
  assert.deepEqual(createEmptyWorkProjectState(), {
    projects: [], startedProjectId: null, revision: 0, source: null, generatedAt: null,
  });
});

test("replaces only with five valid generated projects", () => {
  const empty = createEmptyWorkProjectState();
  const replaced = replaceWorkProjects(empty, projects, "secondary", "2026-07-25T00:00:00.000Z");
  assert.equal(replaced.revision, 1);
  assert.equal(replaced.source, "secondary");
  assert.equal(replaced.projects.length, 5);
  assert.equal(replaced.startedProjectId, null);
  assert.strictEqual(replaceWorkProjects(empty, projects.slice(0, 4), "main"), empty);
  assert.strictEqual(replaceWorkProjects(empty, projects, "unknown"), empty);
});

test("signing a valid contract locks the batch", () => {
  const ready = replaceWorkProjects(createEmptyWorkProjectState(), projects, "main");
  const signed = startWorkProject(ready, projects[2].id);
  assert.equal(signed.startedProjectId, projects[2].id);
  assert.strictEqual(startWorkProject(signed, projects[0].id), signed);
  assert.strictEqual(startWorkProject(ready, "missing"), ready);
});

test("restores only complete and internally consistent caches", () => {
  const state = { projects, startedProjectId: projects[0].id, revision: 3, source: "main", generatedAt: "2026-07-25T00:00:00.000Z" };
  assert.deepEqual(restoreWorkProjectState(JSON.stringify(state)), state);
  assert.deepEqual(restoreWorkProjectState("not json"), createEmptyWorkProjectState());
  assert.deepEqual(restoreWorkProjectState(JSON.stringify({ ...state, projects: projects.slice(1) })), createEmptyWorkProjectState());
  assert.deepEqual(restoreWorkProjectState(JSON.stringify({ ...state, startedProjectId: "missing" })), createEmptyWorkProjectState());
  assert.deepEqual(restoreWorkProjectState(JSON.stringify({ ...state, projects: projects.map((item) => ({ ...item, id: projects[0].id })) })), createEmptyWorkProjectState());
});

test("serializes only the safe project cache fields", () => {
  const state = { projects, startedProjectId: null, revision: 2, source: "secondary", generatedAt: null, apiKey: "secret" };
  const saved = JSON.parse(serializeWorkProjectState(state));
  assert.deepEqual(Object.keys(saved), ["projects", "startedProjectId", "revision", "source", "generatedAt"]);
  assert.equal(JSON.stringify(saved).includes("secret"), false);
});
