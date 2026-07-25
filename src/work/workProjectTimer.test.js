import assert from "node:assert/strict";
import test from "node:test";
import { createProjectRewardId, deriveProjectTimer, formatRemainingTime, getActiveWorkProject } from "./workProjectTimer.js";

const project = { id: "p1", name: "真实项目", durationHours: 72, amountValue: 2100 };
const startMs = Date.parse("2026-07-25T00:00:00Z");
const endMs = Date.parse("2026-07-28T00:00:00Z");
const runningState = {
  projects: [project], startedProjectId: "p1",
  startedAt: new Date(startMs).toISOString(), endsAt: new Date(endMs).toISOString(),
};

test("returns idle when no project is signed", () => {
  assert.deepEqual(deriveProjectTimer({ projects: [], startedProjectId: null }, startMs), {
    status: "idle", remainingSeconds: null, display: "--:--:--", project: null,
  });
  assert.equal(getActiveWorkProject({ projects: [], startedProjectId: null }), null);
});

test("formats cumulative hours and the final second", () => {
  assert.equal(formatRemainingTime(259200), "72:00:00");
  assert.equal(deriveProjectTimer(runningState, startMs).display, "72:00:00");
  assert.deepEqual(deriveProjectTimer(runningState, endMs - 1), {
    status: "running", remainingSeconds: 1, display: "00:00:01", project,
  });
});

test("clamps completed work to zero", () => {
  assert.deepEqual(deriveProjectTimer(runningState, endMs + 5000), {
    status: "finished", remainingSeconds: 0, display: "00:00:00", project,
  });
});

test("creates a stable reward transaction id", () => {
  assert.equal(createProjectRewardId(runningState), "work-project:p1:2026-07-25T00:00:00.000Z");
  assert.equal(createProjectRewardId({ projects: [], startedProjectId: null }), null);
});
