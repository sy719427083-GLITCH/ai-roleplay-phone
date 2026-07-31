import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { allocateOfficeActivities } from "./officeScenePlan.js";
import { ME_MANUAL_IDLE_MS, deriveCurrentSimulation, getRuntimeConversationParticipants, interruptMePlan, releaseOfficeConversationPlan, resumeMeAutonomy } from "./useOfficeSimulation.js";

const occupants = [{ slotId: "boss", profile: { id: "me:m1" } }, { slotId: "employee1", profile: { id: "character:c1" } }];
const runningProject = { status: "running", project: { id: "p", name: "品牌方案", description: "制作品牌方案" } };

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

test("a restored stale chat is normalized before runtime movement", () => {
  const soloOccupants = [{ slotId: "boss", profile: { id: "me:1" } }];
  const persistedPlan = {
    characters: { "me:1": { activity: "chatting", label: "聊天中", destination: "social-center" } },
    conversation: { id: "stale", participantIds: ["missing", "me:1"] },
  };
  const restored = deriveCurrentSimulation({
    persisted: { intervalKey: "same", plan: persistedPlan },
    intervalKey: "same",
    occupants: soloOccupants,
    createPlan: () => assert.fail("matching interval should reuse the saved plan"),
  });
  const safe = allocateOfficeActivities(restored, soloOccupants);
  assert.equal(safe.conversation, null);
  assert.equal(safe.characters["me:1"].activity, "idle");
  assert.equal(safe.characters["me:1"].destination, "boss-home");
});

test("manual Me interruption cannot leave the other participant chatting alone", () => {
  const plan = {
    id: "group",
    characters: {
      "me:m1": { activity: "chatting", label: "聊天中", destination: "boss-home" },
      "character:c1": { activity: "chatting", label: "聊天中", destination: "employee1-home" },
    },
    conversation: { id: "chat", participantIds: ["me:m1", "character:c1"] },
  };
  const interrupted = interruptMePlan(plan, "me:m1", { destination: "print-station", now: 100 });
  const safe = allocateOfficeActivities(interrupted, occupants);
  assert.equal(safe.conversation, null);
  assert.equal(safe.characters["character:c1"].activity, "idle");
  assert.equal(safe.characters["character:c1"].destination, "employee1-home");
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

test("automatic AI fallback keeps the concrete failure reason", () => {
  const source = readFileSync("src/work/useOfficeSimulation.js", "utf8");
  assert.match(source, /buildOfficeAiContext/);
  assert.match(source, /formatOfficeAiError/);
  assert.match(source, /AI 导演暂不可用：\$\{reason\}。已使用本地调度/);
  assert.doesNotMatch(source, /\.catch\(\(\) =>/);
});

test("simulation delegates finite group chat and runtime gathering", () => {
  const source = readFileSync("src/work/useOfficeSimulation.js", "utf8");
  assert.match(source, /createConversationGatherLayout/);
  assert.match(source, /useOfficeConversation/);
  assert.match(source, /conversationReadyId/);
  assert.match(source, /destinationPoint/);
  assert.match(source, /after-chat/);
  assert.doesNotMatch(source, /% conversation\.turns\.length/);
});

test("completed conversations release chatters into non-chat activities", () => {
  const generatedPlan = {
    id: "fresh",
    characters: {
      "me:m1": { activity: "chatting", label: "聊天中", destination: "social-left" },
      "character:c1": { activity: "printing", label: "打印中", destination: "print-station" },
    },
    conversation: { participantIds: ["me:m1", "character:c1"] },
  };
  const released = releaseOfficeConversationPlan({ generatedPlan, occupants, projectContext: runningProject, intervalKey: "active", completedAt: 9_000 });
  assert.equal(released.conversation, null);
  assert.equal(released.characters["me:m1"].activity, "working");
  assert.notEqual(released.characters["me:m1"].label, "工作中");
  assert.equal(released.characters["me:m1"].destination, "boss-home");
  assert.equal(released.characters["character:c1"].activity, "printing");
  assert.match(released.id, /after-chat:9000/);
});
