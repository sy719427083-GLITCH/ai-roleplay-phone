import assert from "node:assert/strict";
import test from "node:test";
import { findOfficeRoute } from "./officeNavigation.js";
import {
  MODE_WEIGHTS,
  buildConversationSession,
  chooseOfficeEvent,
} from "./officeScheduler.js";

const SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];

const createCharacter = (slotId, overrides = {}) => ({
  slotId,
  phase: "idle",
  activity: "idle",
  conversationId: "",
  positionNode: `${slotId}-home`,
  profileId: slotId,
  profile: null,
  ...overrides,
});

const createState = (mode = "free", overrides = {}) => ({
  mode,
  reservations: {},
  characters: Object.fromEntries(SLOT_IDS.map((slotId) => [
    slotId,
    createCharacter(slotId, overrides[slotId]),
  ])),
});

const createProfiles = (overrides = {}) => Object.fromEntries(SLOT_IDS.map((slotId) => [
  slotId,
  {
    id: slotId,
    name: slotId,
    personality: "自然",
    ...overrides[slotId],
  },
]));

const createSequenceRandom = (values) => {
  const queue = [...values];
  return () => {
    assert.ok(queue.length > 0, "random sequence exhausted");
    return queue.shift();
  };
};

test("exports the exact office mode weights", () => {
  assert.deepEqual(MODE_WEIGHTS, {
    focus: { working: 72, slacking: 5, eating: 8, gaming: 3, chatting: 12 },
    free: { working: 35, slacking: 16, eating: 14, gaming: 10, chatting: 25 },
    rest: { working: 8, slacking: 22, eating: 28, gaming: 16, chatting: 26 },
  });
});

test("rest mode chooses meals with concrete food values and reserves the break anchor", () => {
  const meals = [
    [0.00, "bento"],
    [0.26, "rice"],
    [0.51, "noodles"],
    [0.76, "sandwich"],
  ];

  for (const [mealRoll, expectedMeal] of meals) {
    const state = createState("rest", {
      boss: { phase: "walkingToActivity", activity: "eating" },
      employee2: { phase: "returning", activity: "eating" },
      employee3: { phase: "gaming", activity: "gaming" },
      employee4: { conversationId: "busy-session" },
    });
    const profiles = createProfiles({
      employee1: { personality: "外向、贪吃" },
    });

    const event = chooseOfficeEvent({
      state,
      profiles,
      random: createSequenceRandom([0.0, 0.40, 0.0, mealRoll]),
      now: 1000,
    });

    assert.deepEqual(event, {
      slotId: "employee1",
      memberIds: ["employee1"],
      activity: "eating",
      anchorId: "break-1",
      meal: expectedMeal,
      route: findOfficeRoute("employee1-home", "break-1"),
      reservations: {
        "break-1": { anchorId: "break-1", slotId: "employee1" },
      },
      now: 1000,
    });
  }
});

test("personality keywords shift activity selection deterministically", () => {
  const cases = [
    { personality: "自律", roll: 0.40, expected: "working" },
    { personality: "贪吃", roll: 0.48, expected: "eating" },
    { personality: "游戏", roll: 0.62, expected: "gaming" },
    { personality: "外向", roll: 0.68, expected: "chatting" },
    { personality: "话多", roll: 0.68, expected: "chatting" },
    { personality: "社恐", roll: 0.90, expected: "gaming" },
  ];

  for (const { personality, roll, expected } of cases) {
    const state = createState("free", {
      boss: expected === "chatting"
        ? { phase: "working", activity: "working" }
        : { phase: "walkingToActivity", activity: "eating" },
      employee2: { phase: "returning", activity: "eating" },
      employee3: { phase: "gaming", activity: "gaming" },
      employee4: { conversationId: "busy-session" },
    });
    const profiles = createProfiles({
      employee1: { personality },
    });

    const event = chooseOfficeEvent({
      state,
      profiles,
      random: createSequenceRandom([
        expected === "chatting" ? 0.51 : 0.0,
        roll,
        0.0,
        0.0,
        0.1,
        0.2,
      ]),
      now: 1500,
    });

    assert.equal(event?.activity, expected, personality);
  }
});

test("creates chat groups with deterministic sizes from two to five members", () => {
  const expectations = [
    [0.00, 2],
    [0.26, 3],
    [0.51, 4],
    [0.76, 5],
  ];
  const profiles = createProfiles();

  for (const [sizeRoll, expectedSize] of expectations) {
    const event = chooseOfficeEvent({
      state: createState("free"),
      profiles,
      random: createSequenceRandom([0.0, 0.95, 0.0, sizeRoll, 0.1, 0.2]),
      now: 2000,
    });

    assert.equal(event.activity, "chatting");
    assert.equal(event.memberIds.length, expectedSize);
    assert.equal(new Set(event.memberIds).size, expectedSize);
    assert.equal(event.anchorId, "chat-1");
    assert.deepEqual(Object.keys(event.routesByMember), event.memberIds);
  }
});

test("never schedules busy characters into another conversation and never duplicates members", () => {
  const state = createState("free", {
    boss: { phase: "working", activity: "working" },
    employee2: { phase: "walkingToActivity", activity: "eating" },
    employee3: { phase: "eating", activity: "eating" },
    employee4: { phase: "returning", activity: "chatting" },
  });
  const event = chooseOfficeEvent({
    state,
    profiles: createProfiles(),
    random: createSequenceRandom([0.0, 0.95, 0.0, 0.0, 0.1, 0.2]),
    now: 2500,
  });

  assert.deepEqual(event.memberIds, ["boss", "employee1"]);
  assert.equal(new Set(event.memberIds).size, 2);
  assert.ok(!event.memberIds.includes("employee2"));
  assert.ok(!event.memberIds.includes("employee3"));
  assert.ok(!event.memberIds.includes("employee4"));
});

test("conversation sessions create unique ids and isolated arrays", () => {
  const input = ["employee1", "employee2", "employee3"];
  const first = buildConversationSession({
    memberIds: input,
    anchorId: "chat-1",
    now: 3000,
    random: createSequenceRandom([0.1, 0.2]),
  });
  const second = buildConversationSession({
    memberIds: ["employee3", "employee4"],
    anchorId: "chat-2",
    now: 3001,
    random: createSequenceRandom([0.2, 0.3]),
  });

  assert.notEqual(first.id, second.id);
  assert.notStrictEqual(first.memberIds, input);
  assert.notStrictEqual(first.memberIds, second.memberIds);
  assert.notStrictEqual(first.transcript, second.transcript);
  assert.notStrictEqual(first.bubbleQueue, second.bubbleQueue);
  assert.notStrictEqual(first.promptContext.members, second.promptContext.members);

  input.push("boss");
  first.memberIds.push("employee4");

  assert.deepEqual(first.memberIds, ["employee1", "employee2", "employee3", "employee4"]);
  assert.deepEqual(second.memberIds, ["employee3", "employee4"]);
  assert.deepEqual(first.promptContext.members, ["employee1", "employee2", "employee3"]);
});

test("returns null when required anchors are unavailable", () => {
  const breakBlocked = chooseOfficeEvent({
    state: {
      ...createState("rest", {
        boss: { phase: "walkingToActivity", activity: "eating" },
        employee2: { phase: "returning", activity: "eating" },
        employee3: { phase: "gaming", activity: "gaming" },
        employee4: { conversationId: "busy-session" },
      }),
      reservations: {
        "break-1": { anchorId: "break-1", slotId: "boss" },
        "break-2": { anchorId: "break-2", slotId: "employee2" },
      },
    },
    profiles: createProfiles({
      employee1: { personality: "贪吃" },
    }),
    random: createSequenceRandom([0.0, 0.40]),
    now: 4000,
  });

  assert.equal(breakBlocked, null);

  const chatBlocked = chooseOfficeEvent({
    state: {
      ...createState("free"),
      reservations: {
        "chat-1": { anchorId: "chat-1", slotId: "boss" },
        "chat-2": { anchorId: "chat-2", slotId: "employee1" },
        "chat-3": { anchorId: "chat-3", slotId: "employee2" },
        "chat-4": { anchorId: "chat-4", slotId: "employee3" },
      },
    },
    profiles: createProfiles(),
    random: createSequenceRandom([0.0, 0.95]),
    now: 4001,
  });

  assert.equal(chatBlocked, null);
});

test("rejects invalid scheduler inputs", () => {
  assert.equal(chooseOfficeEvent({ state: null, profiles: {}, random: () => 0, now: 0 }), null);
  assert.equal(chooseOfficeEvent({ state: createState(), profiles: null, random: () => 0, now: 0 }), null);
  assert.equal(chooseOfficeEvent({ state: createState(), profiles: createProfiles(), random: null, now: 0 }), null);

  assert.equal(buildConversationSession({ memberIds: [], anchorId: "chat-1", now: 0, random: () => 0 }), null);
  assert.equal(buildConversationSession({ memberIds: ["employee1", "employee1"], anchorId: "chat-1", now: 0, random: () => 0 }), null);
  assert.equal(buildConversationSession({ memberIds: ["employee1", "employee2"], anchorId: "", now: 0, random: () => 0 }), null);
  assert.equal(buildConversationSession({ memberIds: ["employee1", "employee2"], anchorId: "chat-1", now: 0, random: null }), null);
});
