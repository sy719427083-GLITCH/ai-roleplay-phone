import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import { getSceneAnchor } from "./officeSceneManifest.js";
import { buildWorldRoute, sampleWorldRoute } from "./officeWorld.js";
import {
  createOfficeState,
  createWorkSessionId,
  officeReducer,
  restoreOfficeState,
  serializeOfficeState,
} from "./officeState.js";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
}

const slotIds = ["boss", "employee1", "employee2", "employee3", "employee4"];
const assignments = Object.fromEntries(slotIds.map((id) => [id, {
  profileId: id,
  profile: { id, name: id },
}]));

const pointAt = (sceneId, anchorId) => {
  const anchor = getSceneAnchor(sceneId, anchorId);
  return { sceneId, x: anchor.x, y: anchor.y };
};

const startEvent = ({
  slotId = "employee1",
  activityId = "eating",
  sceneId = "lounge",
  targetAnchorId = "dining:seat-1",
  now = 1_100,
  endsAt = 9_000,
  reservationGroupId = "group-meal",
} = {}) => {
  const from = pointAt("office", `${slotId}:seat-approach`);
  const to = pointAt(sceneId, targetAnchorId);
  return {
    type: "START_WORLD_ROUTE",
    slotId,
    activityId,
    route: buildWorldRoute({ from, to }),
    targetAnchorId,
    reservationGroupId,
    propState: { category: "meal", variant: "noodles", actorRoles: { [slotId]: "actor" } },
    semanticContext: {
      eventId: `event-${activityId}`,
      activityId,
      status: "用餐中",
      semanticFallback: { subject: "午餐", summary: "吃午餐", insightOrResult: "恢复精力" },
    },
    travelStatus: "前往休息区",
    activeStatus: "用餐中",
    now,
    endsAt,
  };
};

test("fresh state places all five actors at exact legal office home anchors", () => {
  const state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });

  assert.equal(state.visibleSceneId, "office");
  for (const slotId of slotIds) {
    const homeAnchorId = `${slotId}:seat-approach`;
    const anchor = getSceneAnchor("office", homeAnchorId);
    assert.deepEqual(state.characters[slotId], {
      slotId,
      profileId: slotId,
      profile: { id: slotId, name: slotId },
      sceneId: "office",
      position: { x: anchor.x, y: anchor.y },
      homeAnchorId,
      targetAnchorId: "",
      phase: "idle",
      activity: "idle",
      status: "空闲中",
      conversationId: "",
      route: [],
      routeSegmentIndex: 0,
      routeStartedAt: 0,
      reservationGroupId: "",
      activityStartedAt: 0,
      activityEndsAt: 0,
      propState: null,
      semanticContext: null,
    });
  }
});

test("changing the visible scene leaves both simulations and routes untouched", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  state = officeReducer(state, startEvent());
  const characters = state.characters;
  const route = state.characters.employee1.route;
  const startedAt = state.characters.employee1.routeStartedAt;

  state = officeReducer(state, { type: "SET_VISIBLE_SCENE", sceneId: "lounge" });

  assert.equal(state.visibleSceneId, "lounge");
  assert.strictEqual(state.characters, characters);
  assert.strictEqual(state.characters.employee1.route, route);
  assert.equal(state.characters.employee1.routeStartedAt, startedAt);
  assert.equal(state.characters.employee1.sceneId, "office");
  assert.deepEqual(state.characters.employee1.position, getSceneAnchor("office", "employee1:seat-approach"));
  assert.strictEqual(officeReducer(state, { type: "SET_VISIBLE_SCENE", sceneId: "missing" }), state);
});

test("world route actions preserve exact samples, timing, activity context, and door continuity", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  const action = startEvent();
  state = officeReducer(state, action);
  const started = state.characters.employee1;

  assert.equal(started.phase, "walkingToActivity");
  assert.equal(started.activity, "eating");
  assert.equal(started.status, "前往休息区");
  assert.equal(started.routeStartedAt, 1_100);
  assert.equal(started.targetAnchorId, "dining:seat-1");
  assert.equal(started.reservationGroupId, "group-meal");
  assert.deepEqual(started.position, { x: action.route[0].x, y: action.route[0].y });
  assert.deepEqual(started.propState, action.propState);
  assert.deepEqual(started.semanticContext, action.semanticContext);
  assert.notStrictEqual(started.route, action.route);

  const officeSample = sampleWorldRoute({ route: action.route, startedAt: 1_100, now: 1_200, speed: 100 });
  assert.equal(officeSample.sceneId, "office");
  state = officeReducer(state, {
    type: "ADVANCE_WORLD_ROUTE",
    slotId: "employee1",
    position: officeSample,
    segmentIndex: officeSample.segmentIndex,
  });
  assert.equal(state.characters.employee1.sceneId, "office");
  assert.deepEqual(state.characters.employee1.position, { x: officeSample.x, y: officeSample.y });

  let loungeSample = null;
  for (let now = 20_000; now < 80_000; now += 100) {
    const sample = sampleWorldRoute({ route: action.route, startedAt: 1_100, now, speed: 100 });
    if (sample.sceneId === "lounge" && !sample.done) {
      loungeSample = sample;
      break;
    }
  }
  assert.ok(loungeSample, "route must cross through the paired lounge door before arrival");
  const transition = action.route.find((entry) => entry.transition === true);
  state = officeReducer(state, {
    type: "CROSS_SCENE_DOOR",
    slotId: "employee1",
    transition,
    position: loungeSample,
    segmentIndex: loungeSample.segmentIndex,
  });
  assert.equal(state.characters.employee1.sceneId, "lounge");
  assert.deepEqual(state.characters.employee1.position, { x: loungeSample.x, y: loungeSample.y });
  assert.equal(state.characters.employee1.routeStartedAt, 1_100, "door crossing must not restart the route clock");
  assert.deepEqual(state.characters.employee1.route, action.route, "door crossing must retain remaining route distance");
  assert.deepEqual(state.characters.employee1.semanticContext, action.semanticContext);

  const arrival = sampleWorldRoute({ route: action.route, startedAt: 1_100, now: 200_000, speed: 100 });
  state = officeReducer(state, {
    type: "ARRIVE_ACTIVITY",
    slotId: "employee1",
    position: arrival,
    now: 200_000,
  });
  assert.equal(state.characters.employee1.phase, "eating");
  assert.equal(state.characters.employee1.status, "用餐中");
  assert.equal(state.characters.employee1.sceneId, "lounge");
  assert.deepEqual(state.characters.employee1.position, { x: arrival.x, y: arrival.y });
  assert.equal(state.characters.employee1.activityEndsAt, 9_000);
  assert.deepEqual(state.characters.employee1.route, []);
});

test("door actions require the transition stored in the active world route", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  state = officeReducer(state, startEvent());
  const before = state;
  const entry = pointAt("lounge", "entry");

  state = officeReducer(state, {
    type: "CROSS_SCENE_DOOR",
    slotId: "employee1",
    transition: { transition: true, from: { sceneId: "office", anchorId: "fake" }, to: { sceneId: "lounge", anchorId: "entry" } },
    position: entry,
  });

  assert.strictEqual(state, before);
});

test("return actions release only owned reservations and finish at the exact home anchor", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "dining:seat-1": { anchorId: "dining:seat-1", slotId: "employee1", reservationGroupId: "group-meal", sceneId: "lounge", expiresAt: 20_000 },
      "printer:front": { anchorId: "printer:front", slotId: "employee2", reservationGroupId: "group-print", sceneId: "office", expiresAt: 20_000 },
    },
  };
  state = officeReducer(state, startEvent());
  const arrival = pointAt("lounge", "dining:seat-1");
  state = officeReducer(state, { type: "ARRIVE_ACTIVITY", slotId: "employee1", position: arrival, now: 2_000 });
  const home = pointAt("office", "employee1:seat-approach");
  const returnRoute = buildWorldRoute({ from: arrival, to: home });

  state = officeReducer(state, {
    type: "START_RETURN",
    slotId: "employee1",
    route: returnRoute,
    position: arrival,
    now: 9_100,
  });
  assert.equal(state.characters.employee1.phase, "returning");
  assert.equal(state.characters.employee1.activity, "returning");
  assert.equal(state.characters.employee1.status, "返回工位");
  assert.equal(state.characters.employee1.targetAnchorId, "employee1:seat-approach");
  assert.equal(state.characters.employee1.routeStartedAt, 9_100);
  assert.equal(state.reservations["dining:seat-1"], undefined);
  assert.equal(state.reservations["printer:front"].reservationGroupId, "group-print");

  state = officeReducer(state, { type: "FINISH_RETURN", slotId: "employee1", position: home });
  assert.equal(state.characters.employee1.phase, "idle");
  assert.equal(state.characters.employee1.sceneId, "office");
  assert.deepEqual(state.characters.employee1.position, getSceneAnchor("office", "employee1:seat-approach"));
  assert.equal(state.characters.employee1.propState, null);
  assert.equal(state.characters.employee1.semanticContext, null);
  assert.equal(state.characters.employee1.reservationGroupId, "");
});

test("rejecting an invalid return route does not release its reservation group", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "dining:seat-1": { anchorId: "dining:seat-1", slotId: "employee1", reservationGroupId: "group-meal", sceneId: "lounge", expiresAt: 20_000 },
    },
  };
  state = officeReducer(state, startEvent());
  const arrival = pointAt("lounge", "dining:seat-1");
  state = officeReducer(state, { type: "ARRIVE_ACTIVITY", slotId: "employee1", position: arrival, now: 2_000 });
  const before = state;

  state = officeReducer(state, { type: "START_RETURN", slotId: "employee1", route: [], position: arrival, now: 9_100 });

  assert.strictEqual(state, before);
  assert.equal(state.reservations["dining:seat-1"].reservationGroupId, "group-meal");
});

test("conversation groups remain isolated and release only their own reservation on close", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "whiteboard:1": { anchorId: "whiteboard:1", slotId: "employee1", reservationGroupId: "group-a", sceneId: "office", expiresAt: 50_000 },
      "whiteboard:2": { anchorId: "whiteboard:2", slotId: "employee3", reservationGroupId: "group-b", sceneId: "office", expiresAt: 50_000 },
    },
    characters: {
      ...state.characters,
      employee1: { ...state.characters.employee1, position: { ...getSceneAnchor("office", "whiteboard:1") } },
      employee2: { ...state.characters.employee2, position: { ...getSceneAnchor("office", "whiteboard:2") } },
    },
  };
  for (const session of [{
    id: "a", memberIds: ["employee1", "employee2"], reservationGroupId: "group-a", sceneId: "office",
    targetAnchorIds: ["whiteboard:1"], transcript: [], promptContext: { summary: "A" },
  }, {
    id: "b", memberIds: ["employee3", "employee4"], reservationGroupId: "group-b", sceneId: "office",
    targetAnchorIds: ["whiteboard:2"], transcript: [], promptContext: { summary: "B" },
  }]) state = officeReducer(state, { type: "OPEN_CONVERSATION", session });

  state = officeReducer(state, { type: "APPEND_CONVERSATION", conversationId: "a", entry: { speakerId: "employee1", text: "only A" } });
  state = officeReducer(state, { type: "QUEUE_BUBBLE", conversationId: "b", bubble: { speakerId: "employee4", text: "only B" } });
  assert.equal(state.conversations.a.transcript.length, 1);
  assert.equal(state.conversations.b.transcript.length, 0);
  assert.equal(state.conversations.a.bubbleQueue.length, 0);
  assert.equal(state.conversations.b.bubbleQueue.length, 1);

  const home1 = pointAt("office", "employee1:seat-approach");
  const home2 = pointAt("office", "employee2:seat-approach");
  state = officeReducer(state, {
    type: "CLOSE_CONVERSATION",
    conversationId: "a",
    now: 2_000,
    returnRoutes: {
      employee1: buildWorldRoute({ from: pointAt("office", "whiteboard:1"), to: home1 }),
      employee2: buildWorldRoute({ from: pointAt("office", "whiteboard:2"), to: home2 }),
    },
  });
  assert.equal(state.conversations.a, undefined);
  assert.ok(state.conversations.b);
  assert.equal(state.characters.employee1.phase, "returning");
  assert.equal(state.characters.employee3.conversationId, "b");
  assert.equal(state.reservations["whiteboard:1"], undefined);
  assert.equal(state.reservations["whiteboard:2"].reservationGroupId, "group-b");
});

test("closing a conversation without supplied routes builds exact direct world returns", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "whiteboard:1": { anchorId: "whiteboard:1", slotId: "employee1", reservationGroupId: "group-chat", sceneId: "office", expiresAt: 50_000 },
    },
    characters: {
      ...state.characters,
      employee1: { ...state.characters.employee1, position: { ...getSceneAnchor("office", "whiteboard:1") } },
      employee2: { ...state.characters.employee2, position: { ...getSceneAnchor("office", "whiteboard:2") } },
    },
  };
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "chat", memberIds: ["employee1", "employee2"], reservationGroupId: "group-chat" },
  });

  state = officeReducer(state, { type: "CLOSE_CONVERSATION", conversationId: "chat", now: 2_000 });

  assert.equal(state.conversations.chat, undefined);
  assert.equal(state.reservations["whiteboard:1"], undefined);
  for (const slotId of ["employee1", "employee2"]) {
    assert.equal(state.characters[slotId].phase, "returning");
    assert.equal(state.characters[slotId].conversationId, "");
    assert.ok(state.characters[slotId].route.length > 0);
    assert.equal(state.characters[slotId].route.at(-1).sceneId, "office");
    assert.deepEqual(
      { x: state.characters[slotId].route.at(-1).x, y: state.characters[slotId].route.at(-1).y },
      getSceneAnchor("office", `${slotId}:seat-approach`),
    );
  }
});

test("conversation counters reject regressions without changing another session", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  for (const session of [
    { id: "a", memberIds: ["employee1", "employee2"], requestSequence: 3, turnIndex: 4 },
    { id: "b", memberIds: ["employee3", "employee4"], requestSequence: 9, turnIndex: 10 },
  ]) state = officeReducer(state, { type: "OPEN_CONVERSATION", session });
  const untouched = state.conversations.b;

  state = officeReducer(state, { type: "UPDATE_CONVERSATION_IO", conversationId: "a", requestSequence: 2, turnIndex: 5 });
  assert.equal(state.conversations.a.requestSequence, 3);
  assert.equal(state.conversations.a.turnIndex, 5);
  assert.strictEqual(state.conversations.b, untouched);
});

test("restore migrates every legacy or transient actor to its exact safe home anchor", () => {
  const restored = restoreOfficeState(JSON.stringify({
    visibleSceneId: "lounge",
    activityEvents: [{ eventId: "legacy-summary", summary: "must disappear" }],
    activeEventBySlot: { employee1: "legacy-summary" },
    characters: {
      boss: { positionNode: "boss-home", route: ["boss-home", "meeting-1"], phase: "walkingToActivity" },
      employee1: { sceneId: "office", position: { x: -100, y: -100 }, route: [{ sceneId: "legacy", x: 1, y: 2 }], phase: "returning" },
      employee2: { sceneId: "lounge", position: { x: 670, y: 1710 }, phase: "eating", semanticContext: { summary: "transient" } },
    },
  }), assignments, 5_000);

  assert.equal(restored.visibleSceneId, "office");
  assert.equal(restored.activityEvents, undefined);
  assert.equal(restored.activeEventBySlot, undefined);
  for (const slotId of slotIds) {
    assert.equal(restored.characters[slotId].sceneId, "office");
    assert.deepEqual(restored.characters[slotId].position, getSceneAnchor("office", `${slotId}:seat-approach`));
    assert.deepEqual(restored.characters[slotId].route, []);
    assert.equal(restored.characters[slotId].phase, "idle");
    assert.equal(restored.characters[slotId].semanticContext, null);
  }
});

test("serialization excludes transient routes, props, and every non-conversation activity summary", () => {
  let state = createOfficeState({ assignments, now: 1_000, durationMs: 60_000 });
  state = officeReducer(state, startEvent());
  state = {
    ...state,
    activityEvents: [{ eventId: "legacy", subject: "do not persist" }],
    activeEventBySlot: { employee1: "legacy" },
  };
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "chat", memberIds: ["employee3", "employee4"], transcript: [{ text: "keep conversation semantics" }] },
  });

  const serialized = serializeOfficeState(state);
  const snapshot = JSON.parse(serialized);
  assert.equal(snapshot.activityEvents, undefined);
  assert.equal(snapshot.activeEventBySlot, undefined);
  assert.doesNotMatch(serialized, /do not persist|semanticContext|semanticFallback|propState|routesByActor/u);
  assert.match(serialized, /keep conversation semantics/u);
  assert.equal(snapshot.visibleSceneId, "office");

  const restored = restoreOfficeState(serialized, assignments, 5_000);
  assert.deepEqual(restored.conversations, {});
  assert.equal(restored.characters.employee1.phase, "idle");
});

test("set reservations installs a validated deep-cloned map", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const reservations = Object.create(null);
  reservations["printer:front"] = {
    anchorId: "printer:front",
    slotId: "employee1",
    reservationGroupId: "group-print",
    sceneId: "office",
    expiresAt: 1_000,
  };

  const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });
  reservations["printer:front"].slotId = "employee2";
  assert.equal(next.reservations["printer:front"].slotId, "employee1");
  assert.notStrictEqual(next.reservations, reservations);
  assert.strictEqual(officeReducer(next, { type: "SET_RESERVATIONS", reservations: [] }), next);
});

test("creates secure unique work session ids and restores an existing id", () => {
  let seed = 0;
  const cryptoSource = {
    getRandomValues(bytes) {
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = seed + index;
      seed += bytes.length;
      return bytes;
    },
  };
  const first = createWorkSessionId(1_000, cryptoSource);
  const second = createWorkSessionId(1_000, cryptoSource);
  assert.match(first, /^work-session-1000-[0-9a-f]{32}$/u);
  assert.notEqual(first, second);
  assert.throws(() => createWorkSessionId(1_000, {}), /Secure random generation is unavailable/u);

  const restored = restoreOfficeState(JSON.stringify({ workSessionId: first }), assignments, 5_000);
  assert.equal(restored.workSessionId, first);
});
