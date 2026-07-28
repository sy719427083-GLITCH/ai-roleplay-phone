import assert from "node:assert/strict";
import test from "node:test";
import { deriveCurrentSimulation, interruptMePlan } from "./useOfficeSimulation.js";

const occupants = [{ slotId: "boss", profile: { id: "me:m1" } }, { slotId: "employee1", profile: { id: "character:c1" } }];

test("reuses only a matching current persisted interval", () => {
  const createPlan = () => ({ id: "new", characters: {} });
  const current = deriveCurrentSimulation({ persisted: { intervalKey: "current", plan: { id: "saved", characters: { "me:m1": {}, "character:c1": {} } } }, intervalKey: "current", occupants, createPlan });
  const stale = deriveCurrentSimulation({ persisted: { intervalKey: "old", plan: { id: "saved" } }, intervalKey: "current", occupants, createPlan });
  assert.equal(current.id, "saved");
  assert.equal(stale.id, "new");
});

test("manual Me interruption releases chat and applies priority", () => {
  const plan = { characters: { "me:m1": { activity: "chatting", destination: "social-left" }, "character:c1": { activity: "chatting", destination: "social-left" } }, conversation: { participantIds: ["me:m1", "character:c1"] } };
  const next = interruptMePlan(plan, "me:m1", { destination: "print-station", now: 2000, label: "查看打印机" });
  assert.equal(next.conversation, null);
  assert.equal(next.characters["me:m1"].priority, "manual");
  assert.equal(next.characters["me:m1"].destination, "print-station");
});
