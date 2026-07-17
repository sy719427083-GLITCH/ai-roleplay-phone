import assert from "node:assert/strict";
import test from "node:test";
import { STORAGE_KEY } from "../apiConfig.js";
import { createLocalActivityDetail } from "./officeActivities.js";
import {
  buildOfficeActivityMessages,
  parseOfficeActivityReply,
  requestOfficeActivityDetail,
} from "./officeActivityApi.js";

const createStorage = (data = {}) => ({
  getItem(key) {
    return data[key] ?? null;
  },
});

const createApiStorage = (endpoint = {}) => createStorage({
  [STORAGE_KEY]: JSON.stringify({
    mainConfigs: [{
      id: "main-office",
      apiKey: "office-secret",
      baseUrl: "https://office.example.test/",
      model: "office-activity-model",
      temperature: 0.25,
      ...endpoint,
    }],
    selectedMainId: "main-office",
  }),
});

const readingEvent = {
  eventId: "evt-1",
  activityType: "reading",
  requestSequence: 2,
  title: "阅读记录",
  profileSnapshots: [{
    id: "char-a",
    name: "沈知白",
    identity: "投资人",
    personality: "克制",
    appearance: "深灰西装",
    persona: "习惯在压力下保持冷静",
  }],
  unrelatedProfile: {
    name: "未参与角色",
    personality: "不应进入提示词",
  },
};

test("builds a reading prompt from only the assigned profile snapshot", () => {
  const [system, user] = buildOfficeActivityMessages(readingEvent);

  assert.equal(system.role, "system");
  assert.equal(user.role, "user");
  assert.match(system.content, /沈知白/);
  assert.match(system.content, /克制/);
  assert.match(system.content, /投资人/);
  assert.match(system.content, /reading/);
  assert.match(system.content, /书名/);
  assert.doesNotMatch(system.content, /未参与角色|不应进入提示词/);
});

test("binds activity prompts to the visible prop and exact conversation topic", () => {
  const buildContent = (overrides) => buildOfficeActivityMessages({
    ...readingEvent,
    ...overrides,
  })[0].content;

  const rice = buildContent({ activityType: "eating", propVariant: "rice" });
  const noodles = buildContent({ activityType: "eating", propVariant: "noodles" });
  const projectChat = buildContent({
    activityType: "chatting",
    propVariant: "",
    conversationTopic: "项目进度",
  });
  const weekendChat = buildContent({
    activityType: "chatting",
    propVariant: "",
    conversationTopic: "周末安排",
  });

  assert.match(rice, /rice|米饭/u);
  assert.match(noodles, /noodles|面条/u);
  assert.notEqual(rice, noodles);
  assert.match(projectChat, /项目进度/u);
  assert.match(weekendChat, /周末安排/u);
  assert.notEqual(projectChat, weekendChat);
});

test("accepts only matching event activity and sequence", () => {
  const valid = JSON.stringify({
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: "阅读记录",
    subject: "《沉思录》",
    summary: "读到责任章节",
    insightOrResult: "先做好能控制的事",
  });

  assert.equal(parseOfficeActivityReply(valid, readingEvent).subject, "《沉思录》");
  assert.equal(parseOfficeActivityReply(valid.replace('"reading"', '"gaming"'), readingEvent), null);
  assert.equal(parseOfficeActivityReply(valid.replace('"requestSequence":2', '"requestSequence":1'), readingEvent), null);
});

test("rejects API detail that changes an authoritative visible context", () => {
  const riceEvent = {
    ...readingEvent,
    activityType: "eating",
    propVariant: "rice",
  };
  const buildReply = (subject) => JSON.stringify({
    eventId: "evt-1",
    activityType: "eating",
    requestSequence: 2,
    title: "用餐记录",
    subject,
    summary: "认真吃完午餐",
    insightOrResult: "补充体力后继续工作",
  });

  assert.equal(parseOfficeActivityReply(buildReply("热腾腾的面条"), riceEvent), null);
  assert.equal(parseOfficeActivityReply(buildReply("一碗米饭"), riceEvent)?.subject, "一碗米饭");

  const chatEvent = {
    ...readingEvent,
    activityType: "chatting",
    conversationTopic: "项目进度",
  };
  const chatReply = (subject) => JSON.stringify({
    eventId: "evt-1",
    activityType: "chatting",
    requestSequence: 2,
    title: "聊天记录",
    subject,
    summary: "大家交换了看法",
    insightOrResult: "明确了下一步",
  });

  assert.equal(parseOfficeActivityReply(chatReply("周末安排"), chatEvent), null);
  assert.equal(parseOfficeActivityReply(chatReply("项目进度讨论"), chatEvent)?.subject, "项目进度讨论");
});

test("parses fenced JSON, rejects missing or extra keys, and caps human-readable fields", () => {
  const longText = "阅".repeat(140);
  const parsed = parseOfficeActivityReply(`\n\`\`\`json\n${JSON.stringify({
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: longText,
    subject: longText,
    summary: longText,
    insightOrResult: longText,
  })}\n\`\`\``, readingEvent);

  assert.deepEqual(Object.keys(parsed), [
    "eventId",
    "activityType",
    "requestSequence",
    "title",
    "subject",
    "summary",
    "insightOrResult",
  ]);
  assert.equal(parsed.title, "阅".repeat(120));
  assert.equal(parsed.subject, "阅".repeat(120));
  assert.equal(parsed.summary, "阅".repeat(120));
  assert.equal(parsed.insightOrResult, "阅".repeat(120));
  assert.equal(parseOfficeActivityReply(JSON.stringify({
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: "阅读记录",
    subject: "《沉思录》",
    summary: "缺少启示",
  }), readingEvent), null);
  assert.equal(parseOfficeActivityReply(JSON.stringify({
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: "阅读记录",
    subject: "《沉思录》",
    summary: "读到责任章节",
    insightOrResult: "先做好能控制的事",
    extra: true,
  }), readingEvent), null);
  assert.equal(parseOfficeActivityReply(JSON.stringify({
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: 42,
    subject: "《沉思录》",
    summary: "读到责任章节",
    insightOrResult: "先做好能控制的事",
  }), readingEvent), null);
});

test("posts activity detail requests with injectable fetch and abort signal", async () => {
  const calls = [];
  const controller = new AbortController();
  const fetchImpl = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                eventId: "evt-1",
                activityType: "reading",
                requestSequence: 2,
                title: "阅读记录",
                subject: "《沉思录》",
                summary: "读到责任章节",
                insightOrResult: "先做好能控制的事",
              }),
            },
          }],
        };
      },
    };
  };

  const detail = await requestOfficeActivityDetail({
    event: readingEvent,
    storage: createApiStorage(),
    fetchImpl,
    signal: controller.signal,
  });

  assert.equal(calls.length, 1);
  const [url, request] = calls[0];
  const body = JSON.parse(request.body);
  assert.equal(url, "https://office.example.test/v1/chat/completions");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, "Bearer office-secret");
  assert.equal(request.signal, controller.signal);
  assert.equal(body.model, "office-activity-model");
  assert.equal(body.temperature, 0.25);
  assert.match(JSON.stringify(body.messages), /沈知白/);
  assert.doesNotMatch(JSON.stringify(body.messages), /未参与角色/);
  assert.deepEqual(detail, {
    eventId: "evt-1",
    activityType: "reading",
    requestSequence: 2,
    title: "阅读记录",
    subject: "《沉思录》",
    summary: "读到责任章节",
    insightOrResult: "先做好能控制的事",
    detailStatus: "complete",
  });
});

test("returns local fallback detail for configuration, network, HTTP, JSON, and validation failures", async () => {
  const expectedFallback = {
    ...createLocalActivityDetail(readingEvent),
    detailStatus: "fallback",
  };
  let unconfiguredFetchCount = 0;
  const unconfigured = await requestOfficeActivityDetail({
    event: readingEvent,
    storage: createStorage(),
    fetchImpl: async () => {
      unconfiguredFetchCount += 1;
      throw new Error("must not request");
    },
  });
  assert.deepEqual(unconfigured, expectedFallback);
  assert.equal(unconfiguredFetchCount, 0);

  const failureFetches = [
    async () => {
      throw new Error("network down");
    },
    async () => ({ ok: false, status: 503 }),
    async () => ({
      ok: true,
      async json() {
        throw new Error("invalid response json");
      },
    }),
    async () => ({
      ok: true,
      async json() {
        return { choices: [{ message: { content: "not json" } }] };
      },
    }),
    async () => ({
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: JSON.stringify({
                eventId: "evt-1",
                activityType: "gaming",
                requestSequence: 2,
                title: "错活动",
                subject: "错",
                summary: "错",
                insightOrResult: "错",
              }),
            },
          }],
        };
      },
    }),
  ];

  for (const fetchImpl of failureFetches) {
    const detail = await requestOfficeActivityDetail({
      event: readingEvent,
      storage: createApiStorage(),
      fetchImpl,
    });
    assert.deepEqual(detail, expectedFallback);
  }
});
