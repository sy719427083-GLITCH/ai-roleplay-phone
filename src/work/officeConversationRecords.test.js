import assert from "node:assert/strict";
import test from "node:test";
import {
  appendConversationRecord,
  normalizeConversationRecord,
  restoreConversationRecords,
  serializeConversationRecords,
} from "./officeConversationRecords.js";

const completeRecord = () => ({
  conversationId: "chat-1",
  workSessionId: "work-1",
  sceneId: "office",
  locationId: "employee1:desk",
  topic: "项目进度",
  participantSnapshots: [
    { memberId: "employee1", profileId: "p-1", name: "小一", personality: "自律" },
    { memberId: "employee2", profileId: "p-2", name: "小二", personality: "外向" },
  ],
  startedAt: 100,
  endedAt: 200,
  transcript: [
    { speakerId: "employee1", text: "先看一下进度。" },
    { speakerId: "employee2", text: "我已经整理好了。" },
  ],
});

test("normalizes the exact closed conversation shape without sharing nested values", () => {
  const source = completeRecord();
  const record = normalizeConversationRecord(source);

  assert.deepEqual(Object.keys(record), [
    "conversationId", "workSessionId", "sceneId", "locationId", "topic",
    "participantSnapshots", "startedAt", "endedAt", "transcript",
  ]);
  assert.deepEqual(record, source);
  record.participantSnapshots[0].name = "changed";
  record.transcript[0].text = "changed";
  assert.equal(source.participantSnapshots[0].name, "小一");
  assert.equal(source.transcript[0].text, "先看一下进度。");
});

test("rejects malformed, nonconversation, foreign-speaker, and hostile records", () => {
  assert.equal(normalizeConversationRecord({ ...completeRecord(), activityType: "eating" }), null);
  assert.equal(normalizeConversationRecord({ ...completeRecord(), transcript: [{ speakerId: "other", text: "wrong" }] }), null);
  assert.equal(normalizeConversationRecord({ ...completeRecord(), transcript: [{ speakerId: "employee1", text: "" }] }), null);
  assert.doesNotThrow(() => normalizeConversationRecord(new Proxy({}, { get() { throw new Error("nope"); } })));
  assert.equal(normalizeConversationRecord(new Proxy({}, { get() { throw new Error("nope"); } })), null);
});

test("contains revoked proxies at every public records boundary", () => {
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  assert.doesNotThrow(() => appendConversationRecord(proxy, completeRecord()));
  assert.doesNotThrow(() => serializeConversationRecords(proxy));
  assert.doesNotThrow(() => restoreConversationRecords(proxy));
  assert.equal(serializeConversationRecords(proxy), "[]");
  assert.deepEqual(restoreConversationRecords(proxy), []);
});

test("appends immutable records once and serialization restores only valid conversations", () => {
  const record = completeRecord();
  const records = appendConversationRecord([], record);
  const duplicate = appendConversationRecord(records, record);
  assert.equal(records.length, 1);
  assert.strictEqual(duplicate, records);

  const serialized = serializeConversationRecords([
    record,
    { eventId: "activity", activityType: "working", summary: "discard" },
  ]);
  assert.deepEqual(JSON.parse(serialized), [record]);
  const restored = restoreConversationRecords(JSON.stringify([
    record,
    { conversationId: "legacy", memberIds: ["employee1", "employee2"], transcript: record.transcript, startedAt: 1, endedAt: 2 },
    { conversationId: "activity-with-id", activityType: "chatting", memberIds: ["employee1", "employee2"], transcript: record.transcript },
    { eventId: "activity", participantIds: ["employee1"], transcript: record.transcript },
  ]));
  assert.equal(restored.length, 2);
  assert.equal(restored[1].conversationId, "legacy");
  assert.deepEqual(restored[1].participantSnapshots.map(({ memberId }) => memberId), ["employee1", "employee2"]);
});
