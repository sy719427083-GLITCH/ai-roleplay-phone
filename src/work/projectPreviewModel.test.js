import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectPreviewState,
  refreshPreviewProjects,
  startPreviewProject,
} from "./projectPreviewModel.js";

test("creates exactly five Chinese sample projects with the required fields", () => {
  const state = createProjectPreviewState();

  assert.equal(state.projects.length, 5);
  assert.equal(state.startedProjectId, null);
  assert.equal(state.revision, 0);
  for (const project of state.projects) {
    assert.equal(typeof project.id, "string");
    assert.match(project.name, /[\u4e00-\u9fff]/);
    for (const field of ["duration", "amount", "description", "difficulty"]) {
      assert.ok(project[field], `${field} should be present`);
    }
  }
});

test("starts only a project that exists in the preview", () => {
  const state = createProjectPreviewState();
  const started = startPreviewProject(state, state.projects[2].id);

  assert.equal(started.startedProjectId, state.projects[2].id);
  assert.equal(startPreviewProject(state, "missing-project"), state);
});

test("refresh rotates unstarted projects and increments revision", () => {
  const state = createProjectPreviewState();
  const refreshed = refreshPreviewProjects(state);

  assert.equal(refreshed.revision, 1);
  assert.deepEqual(refreshed.projects.map((project) => project.id), [
    ...state.projects.slice(1),
    state.projects[0],
  ].map((project) => project.id));
});

test("does not refresh after a project has started", () => {
  const state = createProjectPreviewState();
  const started = startPreviewProject(state, state.projects[0].id);

  assert.equal(refreshPreviewProjects(started), started);
});
