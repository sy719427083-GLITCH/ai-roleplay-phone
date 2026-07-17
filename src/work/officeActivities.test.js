import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVITY_DEFINITIONS,
  OFFICE_ACTIVITY_TYPES,
  createLocalActivityDetail,
  createOfficeActivityEvent,
  filterOfficeActivityEvents,
  mergeOfficeActivityDetail,
} from "./officeActivities.js";

test("exports the authoritative activity type list and labels", () => {
  assert.deepEqual(OFFICE_ACTIVITY_TYPES, [
    "working",
    "slacking",
    "eating",
    "gaming",
    "reading",
    "watchingSeries",
    "watchingShortVideo",
    "chatting",
  ]);
  assert.deepEqual(ACTIVITY_DEFINITIONS.reading, {
    status: "看书中",
    title: "阅读记录",
  });
  assert.deepEqual(ACTIVITY_DEFINITIONS.watchingShortVideo, {
    status: "看抖音中",
    title: "短视频记录",
  });
});

test("creates one event shared by animation status props and API detail", () => {
  const profileSnapshots = [{ id: "c1", personality: "自律" }];
  const event = createOfficeActivityEvent({
    eventId: "evt-1",
    workSessionId: "work-1",
    actorId: "employee1",
    participantIds: ["employee1", "employee1"],
    profileSnapshots,
    activityType: "reading",
    propVariant: "paperback",
    conversationTopic: "项目进度",
    startedAt: 1000,
    requestSequence: 1,
  });

  assert.equal(event.activityType, "reading");
  assert.equal(event.status, "看书中");
  assert.equal(event.title, "阅读记录");
  assert.equal(event.propVariant, "paperback");
  assert.equal(event.conversationTopic, "项目进度");
  assert.equal(event.detailStatus, "pending");
  assert.deepEqual(event.participantIds, ["employee1"]);
  assert.notEqual(event.profileSnapshots, profileSnapshots);
});

test("creates context-specific local details for visible props and chat topics", () => {
  const createDetail = (activityType, propVariant, conversationTopic = "") => (
    createLocalActivityDetail(createOfficeActivityEvent({
      eventId: `${activityType}-${propVariant || conversationTopic}`,
      workSessionId: "work-1",
      actorId: "employee1",
      profileSnapshots: [{ name: "小林", personality: "自律" }],
      activityType,
      propVariant,
      conversationTopic,
      startedAt: 1000,
      requestSequence: 1,
    }))
  );

  const rice = createDetail("eating", "rice");
  const noodles = createDetail("eating", "noodles");
  const projectChat = createDetail("chatting", "", "项目进度");
  const weekendChat = createDetail("chatting", "", "周末安排");

  assert.match(rice.subject, /米饭/u);
  assert.match(noodles.subject, /面条/u);
  assert.notEqual(rice.subject, noodles.subject);
  assert.match(projectChat.subject, /项目进度/u);
  assert.match(weekendChat.subject, /周末安排/u);
  assert.notEqual(projectChat.subject, weekendChat.subject);
});

test("rejects stale detail without changing the event", () => {
  const event = createOfficeActivityEvent({
    eventId: "evt-1",
    workSessionId: "work-1",
    actorId: "employee1",
    activityType: "reading",
    startedAt: 1000,
    requestSequence: 3,
  });

  assert.strictEqual(mergeOfficeActivityDetail(event, {
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: "旧响应",
    subject: "旧书",
    summary: "旧",
    insightOrResult: "旧",
  }), event);
});

test("merges matching detail immutably", () => {
  const event = createOfficeActivityEvent({
    eventId: "evt-2",
    workSessionId: "work-1",
    actorId: "employee2",
    activityType: "watchingSeries",
    startedAt: 1000,
    requestSequence: 4,
  });

  const merged = mergeOfficeActivityDetail(event, {
    eventId: "evt-2",
    activityType: "watchingSeries",
    requestSequence: 4,
    title: "追剧记录",
    subject: "《深夜办公室》",
    summary: "跟上了最新一集",
    insightOrResult: "暂时忘掉报表",
  });

  assert.notStrictEqual(merged, event);
  assert.equal(merged.detailStatus, "complete");
  assert.equal(merged.subject, "《深夜办公室》");
  assert.equal(merged.summary, "跟上了最新一集");
  assert.equal(merged.insightOrResult, "暂时忘掉报表");
  assert.equal(event.subject, "");
});

test("creates local detail from the first profile snapshot", () => {
  const detail = createLocalActivityDetail(createOfficeActivityEvent({
    eventId: "evt-local",
    workSessionId: "work-1",
    actorId: "employee1",
    profileSnapshots: [{ id: "employee1", name: "小林", personality: "自律" }],
    activityType: "reading",
    startedAt: 1000,
    requestSequence: 2,
  }));

  assert.equal(detail.eventId, "evt-local");
  assert.equal(detail.activityType, "reading");
  assert.equal(detail.requestSequence, 2);
  assert.equal(detail.title, "阅读记录");
  assert.match(detail.subject, /\S/u);
  assert.match(detail.summary, /小林/u);
  assert.match(detail.insightOrResult, /自律/u);
});

test("filters the newest current-session events", () => {
  const events = [
    { eventId: "a", workSessionId: "w", actorId: "boss", activityType: "working", startedAt: 10 },
    { eventId: "b", workSessionId: "w", actorId: "employee1", activityType: "reading", startedAt: 20 },
    { eventId: "c", workSessionId: "old", actorId: "employee1", activityType: "reading", startedAt: 30 },
    { eventId: "d", workSessionId: "w", actorId: "employee1", activityType: "reading", startedAt: 40 },
  ];

  assert.deepEqual(filterOfficeActivityEvents(events, {
    workSessionId: "w",
    actorId: "employee1",
    activityType: "reading",
  }).map(({ eventId }) => eventId), ["d", "b"]);
});
