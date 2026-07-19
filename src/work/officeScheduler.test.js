import assert from "node:assert/strict";
import test from "node:test";
import { isLegalCharacterPosition, isLegalCharacterSegment } from "./officePathfinding.js";
import { OFFICE_ACTIVITY_MANIFEST } from "./officeActivityManifest.js";
import { buildConversationSession, chooseOfficeEvent } from "./officeScheduler.js";

const SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];

const createCharacter = (slotId, overrides = {}) => ({
  slotId,
  profileId: slotId,
  phase: "idle",
  activity: "idle",
  conversationId: "",
  sceneId: "office",
  position: { x: slotId === "boss" ? 540 : slotId.endsWith("1") || slotId.endsWith("3") ? 280 : 800, y: slotId === "boss" ? 655 : slotId.endsWith("1") || slotId.endsWith("2") ? 990 : 1380 },
  ...overrides,
});

const createState = (overrides = {}) => ({
  mode: "free",
  reservations: {},
  characters: Object.fromEntries(SLOT_IDS.map((slotId) => [slotId, createCharacter(slotId)])),
  ...overrides,
});

const createProfiles = (overrides = {}) => Object.fromEntries(SLOT_IDS.map((slotId) => [
  slotId,
  { id: slotId, name: slotId, personality: "自然", identity: slotId === "boss" ? "主管" : "员工", ...overrides[slotId] },
]));

const sequence = (...values) => () => values.length ? values.shift() : 0;

const assertPhysicalEvent = (event) => {
  assert.deepEqual(Object.keys(event).sort(), [
    "activityId", "actorIds", "endsAt", "propState", "reservationGroupId", "routesByActor",
    "sceneId", "semanticContext", "startedAt", "targetAnchors",
  ]);
  assert.ok(OFFICE_ACTIVITY_MANIFEST[event.activityId]);
  assert.ok(event.actorIds.length > 0);
  assert.ok(event.targetAnchors.length > 0);
  assert.equal(event.startedAt, 1_000);
  assert.ok(event.endsAt > event.startedAt);
  for (const actorId of event.actorIds) assert.ok(event.routesByActor[actorId]?.length > 0, actorId);
};

test("returns only the required physical event fields and applies personality weighting", () => {
  const event = chooseOfficeEvent({
    state: createState({ characters: { ...createState().characters, boss: createCharacter("boss", { phase: "working", activity: "working" }) } }),
    profiles: createProfiles({ employee1: { personality: "自律、沉静" } }),
    random: sequence(0.25, 0.01, 0, 0),
    now: 1_000,
  });

  assertPhysicalEvent(event);
  assert.equal(event.activityId, "working");
  assert.deepEqual(event.actorIds, ["employee1"]);
  assert.equal(event.sceneId, "office");
});

test("uses atomic reservations for printer contention and rejects an occupied printer without mutating state", () => {
  const state = createState({
    forcedActivityId: "printing",
    reservations: { "printer:front": { anchorId: "printer:front", slotId: "employee2", sceneId: "office", reservationGroupId: "other", expiresAt: 9_000 } },
  });
  const before = structuredClone(state.reservations);
  assert.equal(chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0), now: 1_000 }), null);
  assert.deepEqual(state.reservations, before);
});

test("keeps desk activities in the office and lounge eating in the lounge", () => {
  const desk = chooseOfficeEvent({ state: createState({ forcedActivityId: "reading" }), profiles: createProfiles(), random: sequence(0.25, 0, 0), now: 1_000 });
  const meal = chooseOfficeEvent({ state: createState({ forcedActivityId: "eating" }), profiles: createProfiles(), random: sequence(0.25, 0, 0), now: 1_000 });
  assertPhysicalEvent(desk);
  assertPhysicalEvent(meal);
  assert.equal(desk.sceneId, "office");
  assert.match(desk.targetAnchors[0], /employee1:seat/);
  assert.equal(meal.sceneId, "lounge");
  assert.match(meal.targetAnchors[0], /dining:seat/);
});

test("assigns host and visitor roles for screen collaboration, reports, help, whiteboard and deliveries", () => {
  const cases = [
    ["screenCollaboration", "screen-collaboration-host", "screen-collaboration-visitor"],
    ["reporting", "reporting", "listening"],
    ["computerHelp", "computer-help-host", "computer-help-visitor"],
    ["whiteboardWork", "whiteboard-writing", "whiteboard-discussing"],
    ["documentDelivery", "document-submit", "document-sign"],
  ];
  for (const [activityId, hostClip, visitorClip] of cases) {
    const event = chooseOfficeEvent({ state: createState({ forcedActivityId: activityId }), profiles: createProfiles(), random: sequence(0, 0, 0), now: 1_000 });
    assertPhysicalEvent(event);
    assert.equal(event.activityId, activityId);
    assert.equal(OFFICE_ACTIVITY_MANIFEST[activityId].clips[event.propState.actorRoles[event.actorIds[0]]], hostClip);
    assert.equal(OFFICE_ACTIVITY_MANIFEST[activityId].clips[event.propState.actorRoles[event.actorIds[1]]], visitorClip);
  }
});

test("selects a door delivery route and no route point or segment enters a collider", () => {
  const event = chooseOfficeEvent({ state: createState({ forcedActivityId: "parcelReceive" }), profiles: createProfiles(), random: sequence(0), now: 1_000 });
  assertPhysicalEvent(event);
  assert.equal(event.targetAnchors[0], "delivery");
  for (const route of Object.values(event.routesByActor)) {
    let previous = null;
    for (const point of route) {
      if (point.transition) { previous = null; continue; }
      assert.equal(isLegalCharacterPosition(point.sceneId, point), true);
      if (previous && previous.sceneId === point.sceneId) assert.equal(isLegalCharacterSegment(point.sceneId, previous, point), true);
      previous = point;
    }
  }
});

test("does not schedule interrupted, wrong-role, or unrouteable actors", () => {
  const state = createState({
    forcedActivityId: "reporting",
    characters: {
      ...createState().characters,
      boss: createCharacter("boss", { conversationId: "busy" }),
      employee1: createCharacter("employee1", { phase: "walkingToActivity" }),
    },
  });
  assert.equal(chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0), now: 1_000 }), null);
});

test("supports office and lounge conversation-compatible group events", () => {
  for (const activityId of ["chatting", "diningChat", "sofaChat"]) {
    const event = chooseOfficeEvent({ state: createState({ forcedActivityId: activityId }), profiles: createProfiles(), random: sequence(0, 0, 0), now: 1_000 });
    assertPhysicalEvent(event);
    assert.ok(event.actorIds.length >= 2, activityId);
  }
});

test("schedules every manifest activity through legal world routes", () => {
  for (const activityId of Object.keys(OFFICE_ACTIVITY_MANIFEST)) {
    const event = chooseOfficeEvent({ state: createState({ forcedActivityId: activityId }), profiles: createProfiles(), random: sequence(0, 0, 0, 0), now: 1_000 });
    assertPhysicalEvent(event);
    assert.equal(event.activityId, activityId);
  }
});

test("preserves conversation session validation and isolated participant context", () => {
  assert.equal(buildConversationSession({ memberIds: ["employee1", "employee1"], anchorId: "chat", now: 0, random: () => 0 }), null);
  const input = ["employee1", "employee2"];
  const rolls = [0.25, 0.51];
  const session = buildConversationSession({ memberIds: input, anchorId: "chat", now: 1_000, random: () => rolls.shift() });
  assert.equal(session.anchorOwnerId, "employee1");
  assert.equal(session.topic, "周末安排");
  input.push("employee3");
  assert.deepEqual(session.memberIds, ["employee1", "employee2"]);
  assert.deepEqual(session.promptContext, { anchorId: "chat", topic: "周末安排", members: ["employee1", "employee2"] });
});
