import assert from "node:assert/strict";
import test from "node:test";
import * as officeScenePlan from "./officeScenePlan.js";
import { getOfficePoint } from "./officeGeometry.js";

const { allocateOfficeActivities, validateOfficeScenePlan } = officeScenePlan;
const runningProject = { status: "running", project: { id: "p", name: "项目方案", description: "制作项目方案" } };

test("keeps desk activities at each occupant's own workstation", () => {
  assert.equal(typeof officeScenePlan.resolveOfficeActivityDestination, "function");
  assert.deepEqual([...officeScenePlan.OFFICE_DESK_ACTIVITIES], ["idle", "working", "reporting", "scrolling", "gaming", "slacking"]);
  for (const activity of officeScenePlan.OFFICE_DESK_ACTIVITIES) {
    assert.equal(officeScenePlan.resolveOfficeActivityDestination(activity, { slotId: "boss" }, "rest-left"), "boss-home");
    assert.equal(officeScenePlan.resolveOfficeActivityDestination(activity, { slotId: "employee4" }, "play-right"), "employee4-home");
  }
});

test("preserves specialized destinations for non-desk activities", () => {
  assert.equal(typeof officeScenePlan.resolveOfficeActivityDestination, "function");
  for (const [activity, destination] of [["printing", "print-station"], ["chatting", "social-left"], ["resting", "rest-right"], ["offDuty", "off-duty"]]) {
    assert.equal(officeScenePlan.resolveOfficeActivityDestination(activity, { slotId: "employee2" }, destination), destination);
  }
});

test("normalizes AI desk activities without changing their metadata", () => {
  const plan = { characters: {
    c1: { activity: "gaming", label: "打游戏", destination: "play-left", startsAt: 10, endsAt: 20, priority: "scheduled" },
    c2: { activity: "scrolling", label: "刷抖音", destination: "rest-right", startsAt: 10, endsAt: 20, priority: "scheduled" },
    c3: { activity: "slacking", label: "摸鱼ing", destination: "social-center", startsAt: 10, endsAt: 20, priority: "scheduled" },
  } };
  const occupants = [
    { slotId: "boss", profile: { id: "c1" } },
    { slotId: "employee1", profile: { id: "c2" } },
    { slotId: "employee2", profile: { id: "c3" } },
  ];
  const result = allocateOfficeActivities(plan, occupants);
  assert.equal(result.characters.c1.destination, "boss-home");
  assert.equal(result.characters.c2.destination, "employee1-home");
  assert.equal(result.characters.c3.destination, "employee2-home");
  assert.deepEqual({ ...result.characters.c1, destination: "play-left" }, plan.characters.c1);
  assert.deepEqual({ ...result.characters.c2, destination: "rest-right" }, plan.characters.c2);
  assert.deepEqual({ ...result.characters.c3, destination: "social-center" }, plan.characters.c3);
});

test("turns an orphaned chatting activity into idle at the assigned workstation without a project", () => {
  const plan = {
    id: "solo",
    characters: {
      c1: { activity: "chatting", label: "聊天中", destination: "social-center", startsAt: 10, endsAt: 20, priority: "scheduled" },
    },
    conversation: null,
  };
  const result = allocateOfficeActivities(plan, [{ slotId: "employee3", profile: { id: "c1" } }]);
  assert.deepEqual(result.characters.c1, {
    activity: "idle", label: "待命中", destination: "employee3-home", startsAt: 10, endsAt: 20, priority: "scheduled",
  });
  assert.equal(result.conversation, null);
});

test("removes stale participants instead of moving one remaining person to chat alone", () => {
  const plan = {
    id: "stale",
    characters: {
      c1: { activity: "chatting", label: "聊天中", destination: "social-left", startsAt: 10, endsAt: 20 },
    },
    conversation: { id: "stale-chat", participantIds: ["missing", "c1", "c1"], turns: [], startsAt: 10, endsAt: 20 },
  };
  const result = allocateOfficeActivities(plan, [{ slotId: "boss", profile: { id: "c1" } }]);
  assert.equal(result.conversation, null);
  assert.deepEqual(result.characters.c1, { activity: "idle", label: "待命中", destination: "boss-home", startsAt: 10, endsAt: 20 });
});

test("preserves a valid group and normalizes unrelated chatting characters", () => {
  const characters = Object.fromEntries(["c1", "c2", "c3"].map((id) => [id, {
    activity: "chatting", label: "聊天中", destination: "social-center", startsAt: 10, endsAt: 20,
  }]));
  const plan = { characters, conversation: { id: "group", participantIds: ["c1", "c2", "c2"], turns: [], startsAt: 10, endsAt: 20 } };
  const occupants = [
    { slotId: "boss", profile: { id: "c1" } },
    { slotId: "employee1", profile: { id: "c2" } },
    { slotId: "employee2", profile: { id: "c3" } },
  ];
  const result = allocateOfficeActivities(plan, occupants);
  assert.deepEqual(result.conversation.participantIds, ["c1", "c2"]);
  assert.equal(result.characters.c1.activity, "chatting");
  assert.equal(result.characters.c2.activity, "chatting");
  assert.deepEqual(result.characters.c3, { activity: "idle", label: "待命中", destination: "employee2-home", startsAt: 10, endsAt: 20 });
});

test("registers every shared activity point", () => {
  for (const id of ["social-left", "social-center", "social-right", "rest-left", "rest-right", "play-left", "play-right", "print-wait", "off-duty"]) assert.ok(getOfficePoint(id), id);
});

test("allows only one active printer user", () => {
  const plan = { characters: {
    c1: { activity: "printing", destination: "print-station" },
    c2: { activity: "printing", destination: "print-station" },
  } };
  const result = allocateOfficeActivities(plan, [{ slotId: "boss", profile: { id: "c1" } }, { slotId: "employee1", profile: { id: "c2" } }], { projectContext: runningProject });
  assert.equal(Object.values(result.characters).filter((item) => item.destination === "print-station").length, 1);
  assert.equal(result.characters.c2.destination, "print-wait");
});

test("rejects unknown profiles, activities, and destinations", () => {
  const result = validateOfficeScenePlan({ characters: { bad: { activity: "flying", destination: "wall", startsAt: 1, endsAt: 2 } } }, { profileIds: new Set(["c1"]), now: 1 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /profile/);
  assert.match(result.issues.join(" "), /activity/);
  assert.match(result.issues.join(" "), /destination/);
});

test("rejects duplicate-only conversation participants", () => {
  const plan = { characters: {
    c1: { activity: "chatting", destination: "chat-1", startsAt: 1, endsAt: 5 },
    c2: { activity: "chatting", destination: "chat-2", startsAt: 1, endsAt: 5 },
  }, conversation: { participantIds: ["c1", "c1"] } };
  const result = validateOfficeScenePlan(plan, { profileIds: new Set(["c1", "c2"]), now: 1 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /conversation/);
});

test("normalizes cached work and print states to idle without a running project", () => {
  const plan = { characters: {
    c1: { activity: "working", label: "工作中", destination: "boss-home" },
    c2: { activity: "printing", label: "打印中", destination: "print-station" },
  }, conversation: null };
  const occupants = [
    { slotId: "boss", profile: { id: "c1" } },
    { slotId: "employee1", profile: { id: "c2" } },
  ];
  const result = allocateOfficeActivities(plan, occupants, { projectContext: null, intervalKey: "idle", now: 1000 });
  assert.deepEqual(result.characters.c1, { activity: "idle", label: "待命中", destination: "boss-home", startsAt: 1000 });
  assert.deepEqual(result.characters.c2, { activity: "idle", label: "待命中", destination: "employee1-home", startsAt: 1000 });
});
