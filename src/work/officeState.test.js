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
  assert.equal(restoreOfficeState(JSON.stringify({ meWaypoint: "print-station" }), profiles).meWaypoint, "print-station");
  assert.equal(restoreOfficeState(JSON.stringify({ meWaypoint: "tea-counter" }), profiles).meWaypoint, "print-station");
  assert.equal(restoreOfficeState(JSON.stringify({ meWaypoint: "aisle-center" }), profiles).meWaypoint, "boss-home");
});

test("migrates version one state to local autonomous scheduling", () => {
  const state = restoreOfficeState(JSON.stringify({ version: 1, assignments: {}, meWaypoint: "boss-home" }), profiles);
  assert.equal(state.version, 2);
  assert.equal(state.simulation.mode, "local");
  assert.equal(state.simulation.plan, null);
});

test("updates mode and caps cached dialogue", () => {
  let state = createOfficeState(profiles);
  state = officeReducer(state, { type: "SET_SIMULATION_MODE", mode: "ai" });
  assert.equal(state.simulation.mode, "ai");
  state = officeReducer(state, { type: "CACHE_CONVERSATION", conversation: { turns: Array.from({ length: 10 }, (_, index) => ({ speakerId: "c", text: `第${index}句`.repeat(30) })) } });
  assert.equal(state.simulation.conversationCache.turns.length, 6);
  assert.ok(state.simulation.conversationCache.turns.every((turn) => turn.text.length <= 42));
});
