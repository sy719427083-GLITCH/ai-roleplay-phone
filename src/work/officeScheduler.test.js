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
  const keys = [
    "activityId", "actorIds", "endsAt", "propState", "reservationGroupId", "routesByActor",
    "sceneId", "semanticContext", "startedAt", "targetAnchors",
  ];
  if (["chatting", "diningChat", "sofaChat"].includes(event.activityId)) {
    keys.push("anchorByMember", "hostId", "locationId", "visitorIds");
  }
  assert.deepEqual(Object.keys(event).sort(), keys.sort());
  assert.ok(OFFICE_ACTIVITY_MANIFEST[event.activityId]);
  assert.ok(event.actorIds.length > 0);
  assert.ok(event.targetAnchors.length > 0);
  assert.equal(event.startedAt, 1_000);
  assert.ok(event.endsAt > event.startedAt);
  for (const actorId of event.visitorIds || event.actorIds) assert.ok(event.routesByActor[actorId]?.length > 0, actorId);
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

test("unwraps normalizeOfficeAssignments-style profiles before applying personality weighting", () => {
  const state = createState({
    mode: "focus",
    characters: { employee1: createCharacter("employee1") },
  });
  const profiles = {
    employee1: {
      profileId: "character-game",
      profile: { id: "character-game", name: "小林", personality: "游戏" },
    },
  };

  const event = chooseOfficeEvent({ state, profiles, random: sequence(0, 0.45, 0, 0), now: 1_000 });
  assertPhysicalEvent(event);
  assert.equal(event.activityId, "gaming");
});

test("commits successful printer reservations atomically and leaves failures unchanged", () => {
  const state = createState({ forcedActivityId: "printing" });
  const first = chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0), now: 1_000 });
  assertPhysicalEvent(first);
  assert.deepEqual(state.reservations["printer:front"], {
    anchorId: "printer:front",
    slotId: first.actorIds[0],
    reservationGroupId: first.reservationGroupId,
    sceneId: "office",
    expiresAt: first.endsAt,
  });
  const committed = structuredClone(state.reservations);
  assert.equal(chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0), now: 1_001 }), null);
  assert.deepEqual(state.reservations, committed);

  const invalidRouteState = createState({
    forcedActivityId: "printing",
    characters: { employee1: createCharacter("employee1", { position: { x: Number.NaN, y: 990 } }) },
  });
  assert.equal(chooseOfficeEvent({ state: invalidRouteState, profiles: createProfiles(), random: sequence(0), now: 1_000 }), null);
  assert.deepEqual(invalidRouteState.reservations, {});
});

test("rejects an already occupied printer without mutating reservations", () => {
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

test("assigns host and visitor roles for screen collaboration, help and whiteboard work", () => {
  const cases = [
    ["screenCollaboration", "screen-collaboration-host", "screen-collaboration-visitor"],
    ["computerHelp", "computer-help-host", "computer-help-visitor"],
    ["whiteboardWork", "whiteboard-writing", "whiteboard-discussing"],
  ];
  for (const [activityId, hostClip, visitorClip] of cases) {
    const event = chooseOfficeEvent({ state: createState({ forcedActivityId: activityId }), profiles: createProfiles(), random: sequence(0, 0, 0), now: 1_000 });
    assertPhysicalEvent(event);
    assert.equal(event.activityId, activityId);
    assert.equal(OFFICE_ACTIVITY_MANIFEST[activityId].clips[event.propState.actorRoles[event.actorIds[0]]], hostClip);
    assert.equal(OFFICE_ACTIVITY_MANIFEST[activityId].clips[event.propState.actorRoles[event.actorIds[1]]], visitorClip);
  }
});

test("makes employees report and submit while the boss listens or signs", () => {
  for (const [activityId, hostClip, visitorClip] of [
    ["reporting", "reporting", "listening"],
    ["documentDelivery", "document-submit", "document-sign"],
  ]) {
    const event = chooseOfficeEvent({ state: createState({ forcedActivityId: activityId }), profiles: createProfiles(), random: sequence(0, 0, 0), now: 1_000 });
    assertPhysicalEvent(event);
    assert.deepEqual(event.actorIds, ["employee1", "boss"]);
    assert.deepEqual(event.propState.actorRoles, { employee1: "host", boss: "visitor" });
    assert.equal(OFFICE_ACTIVITY_MANIFEST[activityId].clips[event.propState.actorRoles.employee1], hostClip);
    assert.equal(OFFICE_ACTIVITY_MANIFEST[activityId].clips[event.propState.actorRoles.boss], visitorClip);
  }

  const signing = chooseOfficeEvent({ state: createState({ forcedActivityId: "documentSigning" }), profiles: createProfiles(), random: sequence(0), now: 1_000 });
  assertPhysicalEvent(signing);
  assert.deepEqual(signing.actorIds, ["boss"]);
  assert.deepEqual(signing.propState.actorRoles, { boss: "actor" });
  assert.equal(OFFICE_ACTIVITY_MANIFEST.documentSigning.clips[signing.propState.actorRoles.boss], "document-sign");

  const noEmployee = createState({ forcedActivityId: "reporting", characters: { boss: createCharacter("boss") } });
  assert.equal(chooseOfficeEvent({ state: noEmployee, profiles: createProfiles(), random: sequence(0), now: 1_000 }), null);
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

test("plans desk conversations around a stationary host and reserves only visitor anchors", () => {
  const state = createState({
    forcedActivityId: "chatting",
    characters: { ...createState().characters, boss: createCharacter("boss", { conversationId: "busy" }) },
  });
  const event = chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0, 0, 0, 0), now: 1_000 });

  assert.equal(event.hostId, "employee1");
  assert.deepEqual(event.visitorIds, ["employee2"]);
  assert.equal(event.locationId, "employee1:desk");
  assert.deepEqual(event.anchorByMember, {
    employee1: "employee1:seat-approach",
    employee2: "employee1:visitor-front",
  });
  assert.deepEqual(Object.keys(event.routesByActor), ["employee2"]);
  assert.deepEqual(event.targetAnchors, ["employee1:visitor-front"]);
  assert.equal(state.reservations["employee1:visitor-front"].reservationGroupId, event.reservationGroupId);
});

test("falls back to legal shared anchors when a desk visitor anchor is occupied", () => {
  const state = createState({
    forcedActivityId: "chatting",
    characters: { ...createState().characters, boss: createCharacter("boss", { conversationId: "busy" }) },
    reservations: {
      "employee1:visitor-front": { anchorId: "employee1:visitor-front", slotId: "employee4", reservationGroupId: "other", sceneId: "office", expiresAt: 9_000 },
    },
  });
  const event = chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0, 0, 0, 0), now: 1_000 });

  assert.equal(event.locationId, "whiteboard");
  assert.deepEqual(Object.keys(event.routesByActor).sort(), ["employee1", "employee2"]);
  assert.deepEqual(event.targetAnchors, ["whiteboard:1", "whiteboard:2"]);
});

test("continues from a blocked whiteboard to lounge conversation anchors", () => {
  const state = createState({
    forcedActivityId: "chatting",
    characters: { ...createState().characters, boss: createCharacter("boss", { conversationId: "busy" }) },
    reservations: {
      "employee1:visitor-front": { anchorId: "employee1:visitor-front", slotId: "employee4", reservationGroupId: "desk", sceneId: "office", expiresAt: 9_000 },
      "whiteboard:1": { anchorId: "whiteboard:1", slotId: "employee3", reservationGroupId: "board", sceneId: "office", expiresAt: 9_000 },
      "whiteboard:2": { anchorId: "whiteboard:2", slotId: "employee4", reservationGroupId: "board", sceneId: "office", expiresAt: 9_000 },
    },
  });
  const event = chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0, 0, 0, 0), now: 1_000 });

  assert.equal(event.locationId, "dining");
  assert.deepEqual(event.targetAnchors, ["dining:seat-1", "dining:seat-2"]);
});

test("keeps group conversation reservations and routes independent", () => {
  const firstState = createState({ forcedActivityId: "chatting" });
  const first = chooseOfficeEvent({ state: firstState, profiles: createProfiles(), random: sequence(0, 0.999, 0, 0), now: 1_000 });
  const secondState = createState({ forcedActivityId: "diningChat" });
  const second = chooseOfficeEvent({ state: secondState, profiles: createProfiles(), random: sequence(0.75, 0, 0, 0), now: 1_001 });
  assert.equal(first.visitorIds.length, 3);
  assert.equal(new Set(Object.values(first.anchorByMember)).size, 4);
  assert.equal(second.locationId, "dining");
  assert.equal(second.propState.variant, "meal");
  assert.notEqual(first.reservationGroupId, second.reservationGroupId);
  assert.notStrictEqual(first.routesByActor, second.routesByActor);
});

test("uses deterministic participant counts and atomic anchors for whiteboard and chat groups", () => {
  for (const activityId of ["whiteboardWork", "chatting"]) {
    for (const [countRoll, expectedCount] of [[0, 2], [0.999, activityId === "chatting" ? 4 : 3]]) {
      const state = createState({ forcedActivityId: activityId });
      const event = chooseOfficeEvent({ state, profiles: createProfiles(), random: sequence(0, countRoll, 0, 0), now: 1_000 });
      assertPhysicalEvent(event);
      assert.equal(event.actorIds.length, expectedCount, activityId);
      assert.equal(event.targetAnchors.length, activityId === "chatting" ? expectedCount - 1 : expectedCount, activityId);
      assert.equal(new Set(event.actorIds).size, expectedCount, activityId);
      assert.equal(new Set(event.targetAnchors).size, event.targetAnchors.length, activityId);
      for (const [anchorId, reservation] of Object.entries(state.reservations)) {
        assert.ok(event.targetAnchors.includes(anchorId));
        assert.equal(reservation.reservationGroupId, event.reservationGroupId);
      }
      for (const route of Object.values(event.routesByActor)) {
        assert.ok(route.every((point) => point.transition || isLegalCharacterPosition(point.sceneId, point)));
      }
    }
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
