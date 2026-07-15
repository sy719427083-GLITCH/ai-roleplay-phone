import assert from "node:assert/strict";
import test from "node:test";
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
    session: { id: "a", memberIds: ["employee1", "employee2"], transcript: [] },
  });
  state = officeReducer(state, {
    type: "OPEN_CONVERSATION",
    session: { id: "b", memberIds: ["employee3", "employee4"], transcript: [] },
  });
  state = officeReducer(state, {
    type: "APPEND_CONVERSATION",
    conversationId: "a",
    entry: { speakerId: "employee1", text: "A组" },
  });
  assert.equal(state.conversations.a.transcript.length, 1);
  assert.equal(state.conversations.b.transcript.length, 0);
});

test("reload closes network conversations and returns characters home", () => {
  const restored = restoreOfficeState(JSON.stringify({
    conversations: { a: { id: "a" } },
    characters: { employee1: { phase: "chatting" } },
  }), assignments, 5000);

  assert.deepEqual(restored.conversations, {});
  assert.equal(restored.characters.employee1.phase, "idle");
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

  const snapshot = JSON.parse(serializeOfficeState(state));
  assert.equal(snapshot.mode, "rest");
  assert.equal(snapshot.durationMs, 60_000);
  assert.equal(snapshot.characters.employee2.profileId, "employee2-new");
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
