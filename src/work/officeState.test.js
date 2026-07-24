import assert from "node:assert/strict";
import test from "node:test";
import { createOfficeState, officeReducer, resolveOfficeAvatar, restoreOfficeState } from "./officeState.js";

const profiles = [{ id: "me:m1", source: "me", avatar: "me.png" }, { id: "character:c1", source: "character", avatar: "c.png" }];

test("assigns profiles once and moves them between slots", () => {
  let state = createOfficeState(profiles);
  state = officeReducer(state, { type: "ASSIGN", slotId: "boss", profileId: "me:m1" });
  state = officeReducer(state, { type: "ASSIGN", slotId: "employee1", profileId: "me:m1" });
  assert.equal(state.assignments.boss, null);
  assert.equal(state.assignments.employee1, "me:m1");
});

test("keeps avatar overrides separate from source profiles", () => {
  const original = structuredClone(profiles[0]);
  let state = createOfficeState(profiles);
  state = officeReducer(state, { type: "SET_AVATAR_OVERRIDE", profileId: "me:m1", value: { type: "url", value: "work.png" } });
  assert.equal(resolveOfficeAvatar(profiles[0], state.avatarOverrides), "work.png");
  assert.deepEqual(profiles[0], original);
});

test("restores safely and removes deleted profile assignments", () => {
  const restored = restoreOfficeState(JSON.stringify({ version: 1, assignments: { boss: "missing" }, avatarOverrides: {}, meWaypoint: "bad" }), profiles);
  assert.equal(restored.assignments.boss, null);
  assert.equal(restored.meWaypoint, "boss-home");
});

test("persists named destinations but rejects removed fixed-route aisles", () => {
  assert.equal(restoreOfficeState(JSON.stringify({ meWaypoint: "tea-counter" }), profiles).meWaypoint, "tea-counter");
  assert.equal(restoreOfficeState(JSON.stringify({ meWaypoint: "aisle-center" }), profiles).meWaypoint, "boss-home");
});
