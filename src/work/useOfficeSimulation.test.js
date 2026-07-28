import assert from "node:assert/strict";
import test from "node:test";
import { ME_MANUAL_IDLE_MS, deriveCurrentSimulation, getRuntimeConversationParticipants, interruptMePlan, resumeMeAutonomy } from "./useOfficeSimulation.js";

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
  assert.equal(ME_MANUAL_IDLE_MS, 10_000);
  assert.equal(next.characters["me:m1"].endsAt, 12_000);
});

test("resume replaces only Me manual activity", () => {
  const plan = { id: "manual", characters: { "me:m1": { priority: "manual" }, "character:c1": { activity: "working", priority: "scheduled" } }, conversation: null };
  const autonomousActivity = { activity: "working", label: "工作中", destination: "boss-home", startsAt: 12_000, endsAt: 30_000, priority: "scheduled" };
  const next = resumeMeAutonomy({ plan, meId: "me:m1", autonomousActivity, now: 12_000 });
  assert.deepEqual(next.characters["me:m1"], autonomousActivity);
  assert.deepEqual(next.characters["character:c1"], plan.characters["character:c1"]);
  assert.match(next.id, /resume:12000/);
});

test("runtime conversation requires two distinct assigned profiles", () => {
  assert.deepEqual(getRuntimeConversationParticipants(occupants, ["me:m1", "me:m1"]), []);
  assert.deepEqual(getRuntimeConversationParticipants(occupants, ["me:m1", "character:c1"]).map((item) => item.profile.id), ["me:m1", "character:c1"]);
});
