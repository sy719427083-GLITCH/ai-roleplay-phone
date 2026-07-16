import assert from "node:assert/strict";
import test from "node:test";
import { createOfficeActivityEvent } from "./officeActivities.js";
import { createOfficeState, officeReducer, restoreOfficeState, serializeOfficeState } from "./officeState.js";

const slotIds = ["boss", "employee1", "employee2", "employee3", "employee4"];

const assignments = Object.fromEntries(slotIds.map((id) => [id, {
  profileId: id,
  profile: { id, name: id },
}]));

test("walks to a meal, eats visible food, and returns home", () => {
  let state = createOfficeState({ assignments, now: 1000, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "START_ACTIVITY",
    slotId: "employee1",
    activity: "eating",
    anchorId: "break-1",
    route: ["employee1-exit", "aisle", "break-1"],
    now: 1100,
  });
  assert.equal(state.characters.employee1.phase, "walkingToActivity");
  assert.equal(state.characters.employee1.status, "前往用餐");

  state = officeReducer(state, {
    type: "ARRIVE_ACTIVITY",
    slotId: "employee1",
    now: 2000,
    endsAt: 9000,
    meal: "noodles",
  });
  assert.equal(state.characters.employee1.activity, "eating");
  assert.equal(state.characters.employee1.props.meal, "noodles");

  state = officeReducer(state, {
    type: "START_RETURN",
    slotId: "employee1",
    route: ["break-1", "aisle", "employee1-home"],
  });
  state = officeReducer(state, { type: "FINISH_RETURN", slotId: "employee1" });
  assert.equal(state.characters.employee1.positionNode, "employee1-home");
});

test("keeps simultaneous conversation transcripts isolated", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "a",
      memberIds: ["employee1", "employee2"],
      transcript: [],
      promptContext: { summary: "组A", members: ["employee1", "employee2"] },
      lastResponse: { speakerId: "employee1", text: "上一句A" },
    },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "b",
      memberIds: ["employee3", "employee4"],
      transcript: [],
      promptContext: { summary: "组B", members: ["employee3", "employee4"] },
      lastResponse: { speakerId: "employee3", text: "上一句B" },
    },
  });
  state = officeReducer(state, {
    type: "APPEND_CONVERSATION",
    conversationId: "a",
    entry: { speakerId: "employee1", text: "A组" },
  });
  state = officeReducer(state, {
    type: "UPDATE_CONVERSATION_IO",
    conversationId: "a",
    promptContext: { summary: "组A-更新", members: ["employee1", "employee2"], turn: 2 },
    lastResponse: { speakerId: "employee2", text: "只更新A" },
  });
  assert.equal(state.conversations.a.transcript.length, 1);
  assert.equal(state.conversations.b.transcript.length, 0);
  assert.equal(state.conversations.a.promptContext.summary, "组A-更新");
  assert.equal(state.conversations.b.promptContext.summary, "组B");
  assert.equal(state.conversations.a.lastResponse.text, "只更新A");
  assert.equal(state.conversations.b.lastResponse.text, "上一句B");
});

test("updates sequence and turn counters only for the targeted conversation", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "a",
      memberIds: ["employee1", "employee2"],
      requestSequence: 0,
      turnIndex: 0,
      transcript: [],
    },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "b",
      memberIds: ["employee3", "employee4"],
      requestSequence: 7,
      turnIndex: 8,
      transcript: [],
    },
  });
  const untouchedConversation = state.conversations.b;

  state = officeReducer(state, {
    type: "UPDATE_CONVERSATION_IO",
    conversationId: "a",
    requestSequence: 1,
  });
  assert.equal(state.conversations.a.requestSequence, 1);
  assert.equal(state.conversations.a.turnIndex, 0);
  assert.equal(state.conversations.b, untouchedConversation);

  state = officeReducer(state, {
    type: "UPDATE_CONVERSATION_IO",
    conversationId: "a",
    turnIndex: 1,
    promptContext: { stage: "reply" },
    lastResponse: { speakerId: "employee1", text: "收到" },
  });
  assert.equal(state.conversations.a.requestSequence, 1);
  assert.equal(state.conversations.a.turnIndex, 1);
  assert.equal(state.conversations.a.promptContext.stage, "reply");
  assert.equal(state.conversations.a.lastResponse.text, "收到");
  assert.equal(state.conversations.b, untouchedConversation);
  assert.equal(state.conversations.b.requestSequence, 7);
  assert.equal(state.conversations.b.turnIndex, 8);
});

test("ignores malformed or regressive conversation counters independently", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "a",
      memberIds: ["employee1", "employee2"],
      requestSequence: 3,
      turnIndex: 4,
      transcript: [],
    },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "b",
      memberIds: ["employee3", "employee4"],
      requestSequence: 9,
      turnIndex: 10,
      transcript: [],
    },
  });
  const untouchedConversation = state.conversations.b;

  for (const update of [
    { requestSequence: 2, turnIndex: 3 },
    { requestSequence: -1, turnIndex: -1 },
    { requestSequence: 3.5, turnIndex: "5" },
    { requestSequence: Number.NaN, turnIndex: Number.POSITIVE_INFINITY },
  ]) {
    state = officeReducer(state, {
      type: "UPDATE_CONVERSATION_IO",
      conversationId: "a",
      ...update,
    });
    assert.equal(state.conversations.a.requestSequence, 3);
    assert.equal(state.conversations.a.turnIndex, 4);
    assert.equal(state.conversations.b, untouchedConversation);
  }

  state = officeReducer(state, {
    type: "UPDATE_CONVERSATION_IO",
    conversationId: "a",
    requestSequence: 4,
    turnIndex: 3,
  });
  assert.equal(state.conversations.a.requestSequence, 4);
  assert.equal(state.conversations.a.turnIndex, 4);
  assert.equal(state.conversations.b, untouchedConversation);
});

test("reload closes network conversations and returns characters home", () => {
  const restored = restoreOfficeState(JSON.stringify({
    conversations: { a: { id: "a" } },
    characters: { employee1: { phase: "chatting" } },
  }), assignments, 5000);

  assert.deepEqual(restored.conversations, {});
  assert.equal(restored.characters.employee1.phase, "idle");
});

test("stores and enriches only the active event for a slot", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const readingEvent = createOfficeActivityEvent({
    eventId: "evt-read",
    workSessionId: state.workSessionId,
    actorId: "employee1",
    participantIds: ["employee1"],
    profileSnapshots: [assignments.employee1.profile],
    activityType: "reading",
    startedAt: 1000,
    requestSequence: 1,
  });

  state = officeReducer(state, { type: "CREATE_ACTIVITY_EVENT", event: readingEvent });
  assert.equal(state.activeEventBySlot.employee1, "evt-read");

  state = officeReducer(state, { type: "ENRICH_ACTIVITY_EVENT", detail: {
    eventId: "evt-read",
    activityType: "reading",
    requestSequence: 1,
    title: "阅读记录",
    subject: "《沉思录》",
    summary: "读到自省",
    insightOrResult: "先处理可控之事",
  } });
  assert.equal(state.activityEvents[0].subject, "《沉思录》");

  state = officeReducer(state, { type: "COMPLETE_ACTIVITY_EVENT", eventId: "evt-read", endedAt: 5000 });
  assert.equal(state.activeEventBySlot.employee1, undefined);
  assert.equal(state.activityEvents[0].endedAt, 5000);
});

test("serializes only current-session events and restores in-flight records as local fallbacks", () => {
  let state = createOfficeState({ assignments, now: 1000, durationMs: 60_000 });
  const inFlightEvent = createOfficeActivityEvent({
    eventId: "evt-read",
    workSessionId: state.workSessionId,
    actorId: "employee1",
    participantIds: ["employee1"],
    profileSnapshots: [assignments.employee1.profile],
    activityType: "reading",
    startedAt: 1100,
    requestSequence: 2,
  });
  const oldEvent = createOfficeActivityEvent({
    eventId: "evt-old",
    workSessionId: "old-session",
    actorId: "employee2",
    participantIds: ["employee2"],
    profileSnapshots: [assignments.employee2.profile],
    activityType: "working",
    startedAt: 900,
    requestSequence: 1,
  });

  state = officeReducer(state, { type: "CREATE_ACTIVITY_EVENT", event: inFlightEvent });
  state = {
    ...state,
    activityEvents: [...state.activityEvents, oldEvent],
  };

  const snapshot = JSON.parse(serializeOfficeState(state));
  assert.equal(snapshot.workSessionId, state.workSessionId);
  assert.deepEqual(snapshot.activityEvents.map(({ eventId }) => eventId), ["evt-read"]);
  assert.deepEqual(snapshot.activeEventBySlot, { employee1: "evt-read" });

  const restored = restoreOfficeState(JSON.stringify(snapshot), assignments, 5000);
  assert.equal(restored.workSessionId, state.workSessionId);
  assert.deepEqual(restored.activeEventBySlot, {});
  assert.equal(restored.activityEvents.length, 1);
  assert.equal(restored.activityEvents[0].eventId, "evt-read");
  assert.equal(restored.activityEvents[0].endedAt, 5000);
  assert.equal(restored.activityEvents[0].detailStatus, "complete");
  assert.match(restored.activityEvents[0].subject, /\S/u);
});

test("updates mode profile routing expiry and serialization state", () => {
  let state = createOfficeState({ assignments, now: 1000, durationMs: 60_000 });
  state = officeReducer(state, { type: "SET_MODE", mode: "rest" });
  state = officeReducer(state, {
    type: "ASSIGN_PROFILE",
    slotId: "employee2",
    assignment: {
      profileId: "employee2-new",
      profile: { id: "employee2-new", name: "新同事" },
    },
  });
  state = officeReducer(state, {
    type: "START_ACTIVITY",
    slotId: "employee2",
    activity: "eating",
    anchorId: "break-2",
    route: ["employee2-home", "aisle", "break-2"],
    now: 1100,
  });
  state = officeReducer(state, { type: "ADVANCE_ROUTE", slotId: "employee2" });
  assert.equal(state.characters.employee2.positionNode, "aisle");

  state = officeReducer(state, {
    type: "ARRIVE_ACTIVITY",
    slotId: "employee2",
    now: 1200,
    endsAt: 1300,
    meal: "rice",
  });
  state = officeReducer(state, { type: "TICK", now: 5000 });
  state = officeReducer(state, { type: "RESET_EXPIRED", now: 5000 });

  assert.equal(state.mode, "rest");
  assert.equal(state.now, 5000);
  assert.equal(state.characters.employee2.profileId, "employee2-new");
  assert.equal(state.characters.employee2.phase, "idle");
  assert.equal(state.characters.employee2.positionNode, "employee2-home");

  state = { ...state, reservations: { "break-2": { slotId: "employee2", anchorId: "break-2" } } };
  const snapshot = JSON.parse(serializeOfficeState(state));
  assert.equal(snapshot.mode, "rest");
  assert.equal(snapshot.durationMs, 60_000);
  assert.equal(snapshot.characters.employee2.profileId, "employee2-new");
  assert.equal(snapshot.reservations, undefined);

  const restored = restoreOfficeState(JSON.stringify(snapshot), assignments, 6000);
  assert.deepEqual(restored.reservations, {});
});

test("set reservations installs a deep-cloned map", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const reservations = {
    "break-1": {
      anchorId: "break-1",
      slotId: "employee1",
      details: {
        meal: "noodles",
        tags: ["warm", { priority: 2 }],
        note: null,
      },
    },
  };

  const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });

  assert.deepEqual(next.reservations, reservations);
  assert.notEqual(next.reservations, reservations);
  assert.notEqual(next.reservations["break-1"], reservations["break-1"]);
  assert.notEqual(next.reservations["break-1"].details, reservations["break-1"].details);
  assert.notEqual(next.reservations["break-1"].details.tags, reservations["break-1"].details.tags);
});

test("set reservations accepts null-prototype maps with serializable nested metadata", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const metadata = Object.assign(Object.create(null), {
    tags: ["quiet", { priority: 1 }],
    enabled: true,
    note: null,
  });
  const reservation = Object.assign(Object.create(null), {
    anchorId: "break-1",
    slotId: "employee1",
    metadata,
  });
  const reservations = Object.assign(Object.create(null), { "break-1": reservation });

  const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });

  assert.equal(next.reservations["break-1"].anchorId, "break-1");
  assert.equal(next.reservations["break-1"].slotId, "employee1");
  assert.deepEqual(next.reservations["break-1"].metadata.tags, ["quiet", { priority: 1 }]);
  assert.equal(next.reservations["break-1"].metadata.enabled, true);
  assert.equal(next.reservations["break-1"].metadata.note, null);
  assert.notEqual(next.reservations, reservations);
  assert.notEqual(next.reservations["break-1"], reservation);
  assert.notEqual(next.reservations["break-1"].metadata, metadata);
});

test("set reservations safely rejects non-plain map inputs", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  class ReservationCollection {}
  const classInstance = new ReservationCollection();
  classInstance["break-1"] = { anchorId: "break-1", slotId: "employee1" };

  for (const [label, reservations] of [
    ["undefined", undefined],
    ["null", null],
    ["array", []],
    ["string", "invalid"],
    ["number", 42],
    ["boolean", true],
    ["bigint", 1n],
    ["function", () => {}],
    ["symbol", Symbol("invalid")],
    ["date", new Date("2026-01-01T00:00:00.000Z")],
    ["map", new Map([["break-1", { anchorId: "break-1", slotId: "employee1" }]])],
    ["class instance", classInstance],
  ]) {
    assert.doesNotThrow(() => {
      const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });
      assert.equal(next, state);
    }, label);
  }
});

test("set reservations safely rejects cyclic and non-serializable nested values", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  class ReservationMetadata {}
  const cyclicMap = {
    "break-1": { anchorId: "break-1", slotId: "employee1" },
  };
  cyclicMap.self = cyclicMap;
  const cyclicMetadata = {};
  cyclicMetadata.self = cyclicMetadata;
  const makeReservations = (metadata) => ({
    "break-1": { anchorId: "break-1", slotId: "employee1", metadata },
  });

  for (const [label, reservations] of [
    ["cyclic map", cyclicMap],
    ["cyclic metadata", makeReservations(cyclicMetadata)],
    ["bigint", makeReservations({ value: 1n })],
    ["function", makeReservations({ value: () => {} })],
    ["symbol", makeReservations({ value: Symbol("invalid") })],
    ["undefined", makeReservations({ value: undefined })],
    ["NaN", makeReservations({ value: Number.NaN })],
    ["infinity", makeReservations({ value: Number.POSITIVE_INFINITY })],
    ["date", makeReservations({ value: new Date("2026-01-01T00:00:00.000Z") })],
    ["map", makeReservations({ value: new Map([["key", "value"]]) })],
    ["class instance", makeReservations({ value: new ReservationMetadata() })],
  ]) {
    assert.doesNotThrow(() => {
      const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });
      assert.equal(next, state);
    }, label);
  }
});

test("set reservations rejects malformed or key-mismatched reservation records", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });

  for (const reservations of [
    { "break-1": null },
    { "break-1": { anchorId: "break-1" } },
    { "break-1": { slotId: "employee1" } },
    { "break-1": { anchorId: 1, slotId: "employee1" } },
    { "break-1": { anchorId: "break-1", slotId: 1 } },
    { "break-1": { anchorId: "break-2", slotId: "employee1" } },
  ]) {
    const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });
    assert.equal(next, state);
  }
});

test("set reservations isolates state from later caller mutation", () => {
  const state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const reservations = {
    "break-1": {
      anchorId: "break-1",
      slotId: "employee1",
      details: { meal: "rice" },
    },
  };

  const next = officeReducer(state, { type: "SET_RESERVATIONS", reservations });
  reservations["break-1"].slotId = "boss";
  reservations["break-1"].details.meal = "sandwich";
  reservations["break-2"] = { anchorId: "break-2", slotId: "employee2" };

  assert.deepEqual(next.reservations, {
    "break-1": {
      anchorId: "break-1",
      slotId: "employee1",
      details: { meal: "rice" },
    },
  });
});

test("start return releases only the eating character's matching reservation", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "break-1": { anchorId: "break-1", slotId: "employee1" },
      "break-2": { anchorId: "break-2", slotId: "employee2" },
      "chat-1": { anchorId: "chat-1", slotId: "boss" },
    },
    characters: {
      ...state.characters,
      employee1: {
        ...state.characters.employee1,
        phase: "eating",
        activity: "eating",
        status: "吃饭中",
        positionNode: "break-1",
        reservedAnchorId: "break-1",
        activityEndsAt: 5000,
        props: { meal: "noodles" },
      },
    },
  };

  const next = officeReducer(state, {
    type: "START_RETURN",
    slotId: "employee1",
    route: ["break-1", "aisle-lower", "employee1-home"],
  });

  assert.deepEqual(next.reservations, {
    "break-2": { anchorId: "break-2", slotId: "employee2" },
    "chat-1": { anchorId: "chat-1", slotId: "boss" },
  });
  assert.deepEqual(state.reservations, {
    "break-1": { anchorId: "break-1", slotId: "employee1" },
    "break-2": { anchorId: "break-2", slotId: "employee2" },
    "chat-1": { anchorId: "chat-1", slotId: "boss" },
  });
  assert.equal(next.characters.employee1.phase, "returning");
  assert.equal(next.characters.employee1.status, "返回工位");
  assert.equal(next.characters.employee1.reservedAnchorId, "");
  assert.deepEqual(next.characters.employee1.route, ["break-1", "aisle-lower", "employee1-home"]);
  assert.equal(next.characters.employee1.routeIndex, 0);
});

test("start return preserves an active conversation owner's reservation for close", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "chat-1": { anchorId: "chat-1", slotId: "employee1" },
      "break-2": { anchorId: "break-2", slotId: "employee3" },
    },
  };
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "a",
      memberIds: ["employee1", "employee2"],
      anchorId: "chat-1",
      anchorOwnerId: "employee1",
      transcript: [],
    },
  });

  state = officeReducer(state, { type: "START_RETURN", slotId: "employee1" });

  assert.deepEqual(state.reservations, {
    "chat-1": { anchorId: "chat-1", slotId: "employee1" },
    "break-2": { anchorId: "break-2", slotId: "employee3" },
  });
  assert.equal(state.conversations.a.anchorOwnerId, "employee1");

  state = officeReducer(state, { type: "CLOSE_CONVERSATION", conversationId: "a" });
  assert.deepEqual(state.reservations, {
    "break-2": { anchorId: "break-2", slotId: "employee3" },
  });
});

test("start return preserves a chatting reservation without a conversation id", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "chat-1": { anchorId: "chat-1", slotId: "employee1" },
    },
    characters: {
      ...state.characters,
      employee1: {
        ...state.characters.employee1,
        phase: "chatting",
        activity: "chatting",
        reservedAnchorId: "chat-1",
      },
    },
  };

  const next = officeReducer(state, { type: "START_RETURN", slotId: "employee1" });

  assert.equal(next.reservations, state.reservations);
  assert.equal(next.reservations["chat-1"].slotId, "employee1");
});

test("start return preserves a conversation reservation outside the chatting phase", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "chat-1": { anchorId: "chat-1", slotId: "employee1" },
    },
    characters: {
      ...state.characters,
      employee1: {
        ...state.characters.employee1,
        phase: "eating",
        activity: "eating",
        conversationId: "a",
        reservedAnchorId: "chat-1",
      },
    },
  };

  const next = officeReducer(state, { type: "START_RETURN", slotId: "employee1" });

  assert.equal(next.reservations, state.reservations);
  assert.equal(next.reservations["chat-1"].slotId, "employee1");
});

test("start return preserves a wrong-owner reservation and finish return still resets home", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "break-1": { anchorId: "break-1", slotId: "boss" },
      "break-2": { anchorId: "break-2", slotId: "employee2" },
    },
    characters: {
      ...state.characters,
      employee1: {
        ...state.characters.employee1,
        phase: "eating",
        activity: "eating",
        status: "吃饭中",
        positionNode: "break-1",
        reservedAnchorId: "break-1",
      },
    },
  };

  state = officeReducer(state, { type: "START_RETURN", slotId: "employee1" });
  assert.deepEqual(state.reservations, {
    "break-1": { anchorId: "break-1", slotId: "boss" },
    "break-2": { anchorId: "break-2", slotId: "employee2" },
  });
  assert.equal(state.characters.employee1.phase, "returning");
  assert.deepEqual(state.characters.employee1.route, ["break-1", "employee1-home"]);

  state = officeReducer(state, { type: "FINISH_RETURN", slotId: "employee1" });
  assert.deepEqual(state.reservations, {
    "break-1": { anchorId: "break-1", slotId: "boss" },
    "break-2": { anchorId: "break-2", slotId: "employee2" },
  });
  assert.equal(state.characters.employee1.phase, "idle");
  assert.equal(state.characters.employee1.activity, "idle");
  assert.equal(state.characters.employee1.positionNode, "employee1-home");
  assert.equal(state.characters.employee1.reservedAnchorId, "");
});

test("queues and shifts bubbles per conversation without crossing sessions", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "a", memberIds: ["employee1", "employee2"], transcript: [] },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "b", memberIds: ["employee3", "employee4"], transcript: [] },
  });
  state = officeReducer(state, {
    type: "QUEUE_BUBBLE",
    conversationId: "a",
    bubble: { speakerId: "employee1", text: "先说一句" },
  });
  state = officeReducer(state, {
    type: "QUEUE_BUBBLE",
    conversationId: "b",
    bubble: { speakerId: "employee3", text: "另一组" },
  });
  state = officeReducer(state, { type: "SHIFT_BUBBLE", conversationId: "a" });

  assert.equal(state.conversations.a.bubbleQueue.length, 0);
  assert.equal(state.conversations.b.bubbleQueue.length, 1);
});

test("rejects opening a conversation when any member is already busy in another session", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "a", memberIds: ["employee1", "employee2"], transcript: [] },
  });

  const next = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "b", memberIds: ["employee2", "employee3"], transcript: [] },
  });

  assert.equal(next, state);
  assert.deepEqual(Object.keys(next.conversations), ["a"]);
  assert.equal(next.characters.employee3.conversationId, "");
});

test("opening a conversation preserves the anchor owner from the caller session", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const session = {
    id: "a",
    memberIds: ["employee1", "employee2"],
    anchorId: "chat-1",
    anchorOwnerId: "employee1",
    transcript: [],
  };

  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session,
  });
  session.anchorOwnerId = "employee2";

  assert.equal(state.conversations.a.anchorOwnerId, "employee1");
});

test("closing one concurrent session returns only that group and leaves the other session active", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "a", memberIds: ["employee1", "employee2"], anchorId: "chat-1", transcript: [] },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "b", memberIds: ["employee3", "employee4"], anchorId: "chat-2", transcript: [] },
  });

  state = officeReducer(state, {
    type: "CLOSE_CONVERSATION",
    conversationId: "a",
    returnRoutes: {
      employee1: ["chat-1", "aisle", "employee1-home"],
      employee2: ["chat-1", "aisle", "employee2-home"],
    },
  });

  assert.deepEqual(Object.keys(state.conversations), ["b"]);
  assert.equal(state.characters.employee1.phase, "returning");
  assert.equal(state.characters.employee1.conversationId, "");
  assert.equal(state.characters.employee2.phase, "returning");
  assert.equal(state.characters.employee3.phase, "chatting");
  assert.equal(state.characters.employee3.conversationId, "b");
  assert.equal(state.characters.employee4.conversationId, "b");
});

test("closing one conversation releases only that session reservation owner match", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "chat-1": { anchorId: "chat-1", slotId: "employee1" },
      "chat-2": { anchorId: "chat-2", slotId: "employee3" },
      "break-1": { anchorId: "break-1", slotId: "boss" },
    },
  };
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "a", memberIds: ["employee1", "employee2"], anchorId: "chat-1", anchorOwnerId: "employee1", transcript: [] },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "b", memberIds: ["employee3", "employee4"], anchorId: "chat-2", anchorOwnerId: "employee3", transcript: [] },
  });

  state = officeReducer(state, {
    type: "CLOSE_CONVERSATION",
    conversationId: "a",
    returnRoutes: {
      employee1: ["chat-1", "aisle", "employee1-home"],
      employee2: ["chat-1", "aisle", "employee2-home"],
    },
  });

  assert.deepEqual(state.reservations, {
    "chat-2": { anchorId: "chat-2", slotId: "employee3" },
    "break-1": { anchorId: "break-1", slotId: "boss" },
  });
  assert.deepEqual(Object.keys(state.conversations), ["b"]);
});

test("closing a conversation without supplied routes still starts a direct return trip", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "a", memberIds: ["employee1", "employee2"], anchorId: "chat-1", transcript: [] },
  });
  state = {
    ...state,
    characters: {
      ...state.characters,
      employee1: { ...state.characters.employee1, positionNode: "chat-1" },
      employee2: { ...state.characters.employee2, positionNode: "chat-1-side" },
    },
  };

  state = officeReducer(state, {
    type: "CLOSE_CONVERSATION",
    conversationId: "a",
  });

  assert.equal(state.characters.employee1.phase, "returning");
  assert.equal(state.characters.employee1.status, "返回工位");
  assert.deepEqual(state.characters.employee1.route, ["chat-1", "employee1-home"]);
  assert.equal(state.characters.employee2.phase, "returning");
  assert.deepEqual(state.characters.employee2.route, ["chat-1-side", "employee2-home"]);
});

test("reset expired releases only the expired session reservation owner match", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = {
    ...state,
    reservations: {
      "chat-1": { anchorId: "chat-1", slotId: "employee1" },
      "chat-2": { anchorId: "chat-2", slotId: "employee3" },
      "break-1": { anchorId: "break-1", slotId: "boss" },
    },
  };
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "a",
      memberIds: ["employee1", "employee2"],
      anchorId: "chat-1",
      anchorOwnerId: "employee1",
      endsAt: 1000,
      transcript: [],
    },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: {
      id: "b",
      memberIds: ["employee3", "employee4"],
      anchorId: "chat-2",
      anchorOwnerId: "employee3",
      endsAt: 8000,
      transcript: [],
    },
  });

  state = officeReducer(state, {
    type: "RESET_EXPIRED",
    now: 5000,
    returnRoutes: {
      employee1: ["chat-1", "aisle", "employee1-home"],
      employee2: ["chat-1", "aisle", "employee2-home"],
    },
  });

  assert.deepEqual(state.reservations, {
    "chat-2": { anchorId: "chat-2", slotId: "employee3" },
    "break-1": { anchorId: "break-1", slotId: "boss" },
  });
  assert.deepEqual(Object.keys(state.conversations), ["b"]);
  assert.equal(state.characters.employee3.phase, "chatting");
});

test("clones caller-owned payloads so later mutation cannot leak into reducer state", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  const assignment = {
    profileId: "employee1-new",
    profile: { id: "employee1-new", name: "初始", meta: { mood: "calm" } },
  };
  const session = {
    id: "a",
    memberIds: ["employee1", "employee2"],
    transcript: [],
    promptContext: { topic: "预算", detail: { stage: 1 } },
    lastResponse: { speakerId: "employee1", text: "初始回复", extra: { tone: "flat" } },
  };
  const entry = { speakerId: "employee1", text: "第一句", meta: { emphasis: "low" } };
  const bubble = { speakerId: "employee2", text: "气泡", meta: { color: "blue" } };
  const ioUpdate = {
    promptContext: { topic: "预算更新", detail: { stage: 2 } },
    lastResponse: { speakerId: "employee2", text: "更新回复", extra: { tone: "warm" } },
  };

  state = officeReducer(state, { type: "ASSIGN_PROFILE", slotId: "employee1", assignment });
  state = officeReducer(state, { type: "OPEN_CONVERSATION", session });
  state = officeReducer(state, { type: "APPEND_CONVERSATION", conversationId: "a", entry });
  state = officeReducer(state, { type: "QUEUE_BUBBLE", conversationId: "a", bubble });
  state = officeReducer(state, { type: "UPDATE_CONVERSATION_IO", conversationId: "a", ...ioUpdate });

  assignment.profile.name = "被污染";
  assignment.profile.meta.mood = "chaotic";
  session.promptContext.detail.stage = 999;
  session.lastResponse.extra.tone = "loud";
  entry.text = "被改了";
  entry.meta.emphasis = "high";
  bubble.text = "被改了";
  bubble.meta.color = "red";
  ioUpdate.promptContext.detail.stage = 404;
  ioUpdate.lastResponse.text = "串台";

  assert.equal(state.assignments.employee1.profile.name, "初始");
  assert.equal(state.assignments.employee1.profile.meta.mood, "calm");
  assert.equal(state.conversations.a.promptContext.topic, "预算更新");
  assert.equal(state.conversations.a.promptContext.detail.stage, 2);
  assert.equal(state.conversations.a.lastResponse.text, "更新回复");
  assert.equal(state.conversations.a.lastResponse.extra.tone, "warm");
  assert.equal(state.conversations.a.transcript[0].text, "第一句");
  assert.equal(state.conversations.a.transcript[0].meta.emphasis, "low");
  assert.equal(state.conversations.a.bubbleQueue[0].text, "气泡");
  assert.equal(state.conversations.a.bubbleQueue[0].meta.color, "blue");
});
