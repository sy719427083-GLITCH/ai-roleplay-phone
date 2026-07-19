import assert from "node:assert/strict";
import test from "node:test";
import { STORAGE_KEY } from "../apiConfig.js";
import {
  buildOfficeActivityMessages,
  parseOfficeActivityReply,
  requestOfficeActivityDetail,
} from "./officeActivityApi.js";

const createStorage = (data = {}) => ({ getItem: (key) => data[key] ?? null });
const createApiStorage = () => createStorage({
  [STORAGE_KEY]: JSON.stringify({
    mainConfigs: [{ id: "main-office", apiKey: "office-secret", baseUrl: "https://office.example.test/", model: "office-activity-model", temperature: 0.25 }],
    selectedMainId: "main-office",
  }),
});

const event = {
  activityId: "reading",
  semanticContext: {
    eventId: "office-reading-1000-employee1",
    activityId: "reading",
    status: "阅读中",
    semanticFallback: { subject: "项目资料", summary: "整理关键段落", insightOrResult: "明确下一步" },
  },
  profileSnapshots: [{ id: "employee1", name: "沈知白", identity: "投资人", personality: "克制", persona: "习惯在压力下保持冷静" }],
};

test("builds prompts from assigned profiles and immutable semantic context", () => {
  const [system] = buildOfficeActivityMessages(event);
  assert.match(system.content, /沈知白|克制|阅读中/u);
  assert.match(system.content, /eventId、subject、summary、insightOrResult/u);
  assert.doesNotMatch(system.content.split("\n").at(-1), /targetAnchors|routesByActor/u);
});

test("accepts exactly semantic fields and rejects every structural override", () => {
  const semanticReply = { eventId: "office-reading-1000-employee1", subject: "《沉思录》", summary: "读到责任章节", insightOrResult: "先做好能控制的事" };
  assert.deepEqual(parseOfficeActivityReply(JSON.stringify(semanticReply), event), semanticReply);
  for (const field of ["activityId", "sceneId", "targetAnchors", "actorIds", "clipId", "propState", "reservationGroupId"]) {
    assert.equal(parseOfficeActivityReply(JSON.stringify({ ...semanticReply, [field]: field }), event), null, field);
  }
});

test("caps semantic text, rejects malformed replies, and falls back to local semantics", async () => {
  const long = "阅".repeat(140);
  const parsed = parseOfficeActivityReply(JSON.stringify({ eventId: event.semanticContext.eventId, subject: long, summary: long, insightOrResult: long }), event);
  assert.deepEqual(Object.keys(parsed), ["eventId", "subject", "summary", "insightOrResult"]);
  assert.equal(parsed.subject, "阅".repeat(120));
  assert.equal(parseOfficeActivityReply(JSON.stringify({ eventId: event.semanticContext.eventId, subject: "x", summary: "y" }), event), null);
  assert.equal(parseOfficeActivityReply(JSON.stringify({ eventId: "wrong", subject: "x", summary: "y", insightOrResult: "z" }), event), null);

  const fallback = await requestOfficeActivityDetail({ event, storage: createStorage(), fetchImpl: async () => { throw new Error("must not fetch"); } });
  assert.deepEqual(fallback, {
    eventId: event.semanticContext.eventId,
    subject: "项目资料",
    summary: "沈知白以克制的方式整理关键段落",
    insightOrResult: "明确下一步",
  });
});

test("normalizes capped profile-aware local fallback without structural fields", async () => {
  const oversizedFallbackEvent = {
    ...event,
    semanticContext: {
      ...event.semanticContext,
      semanticFallback: {
        subject: "题".repeat(140),
        summary: 42,
        insightOrResult: "果".repeat(140),
        sceneId: "office",
      },
    },
    profileSnapshots: [{ name: "沈知白", personality: "克制" }],
  };
  const fallback = await requestOfficeActivityDetail({ event: oversizedFallbackEvent, storage: createStorage() });
  assert.deepEqual(Object.keys(fallback), ["eventId", "subject", "summary", "insightOrResult"]);
  assert.equal(fallback.eventId, event.semanticContext.eventId);
  assert.equal(fallback.subject, "题".repeat(120));
  assert.match(fallback.summary, /沈知白|克制/u);
  assert.ok(fallback.summary.length <= 120);
  assert.equal(fallback.insightOrResult, "果".repeat(120));
  assert.doesNotMatch(JSON.stringify(fallback), /sceneId|activityId|targetAnchors/u);
});

test("posts semantic-only requests and returns semantic-only remote detail", async () => {
  const calls = [];
  const fetchImpl = async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ eventId: event.semanticContext.eventId, subject: "《沉思录》", summary: "读到责任章节", insightOrResult: "先做好能控制的事" }) } }] }) };
  };
  const detail = await requestOfficeActivityDetail({ event, storage: createApiStorage(), fetchImpl });
  assert.equal(calls[0][0], "https://office.example.test/v1/chat/completions");
  assert.doesNotMatch(JSON.parse(calls[0][1].body).messages[0].content.split("\n").at(-1), /targetAnchors|routesByActor/u);
  assert.deepEqual(detail, { eventId: event.semanticContext.eventId, subject: "《沉思录》", summary: "读到责任章节", insightOrResult: "先做好能控制的事" });
});

test("keeps abort, endpoint, HTTP, and invalid-JSON failures within semantic fallback", async () => {
  const controller = new AbortController();
  const calls = [];
  const expectedFallback = {
    eventId: event.semanticContext.eventId,
    subject: "项目资料",
    summary: "沈知白以克制的方式整理关键段落",
    insightOrResult: "明确下一步",
  };
  const response = await requestOfficeActivityDetail({
    event,
    storage: createApiStorage(),
    signal: controller.signal,
    fetchImpl: async (...args) => {
      calls.push(args);
      return { ok: false, status: 503 };
    },
  });
  assert.equal(calls[0][1].signal, controller.signal);
  assert.equal(calls[0][1].headers.Authorization, "Bearer office-secret");
  assert.deepEqual(response, expectedFallback);

  for (const fetchImpl of [
    async () => { throw new Error("network"); },
    async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } }),
    async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "not json" } }] }) }),
  ]) {
    assert.deepEqual(await requestOfficeActivityDetail({ event, storage: createApiStorage(), fetchImpl }), expectedFallback);
  }
});
