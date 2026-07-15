import assert from "node:assert/strict";
import test from "node:test";
import { STORAGE_KEY } from "../apiConfig.js";
import {
  buildOfficeConversationMessages,
  getOfficeEndpoint,
  getOfficeFallbackReply,
  parseOfficeConversationReply,
  requestOfficeConversationTurn,
} from "./officeConversationApi.js";

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
      model: "",
      customModel: "office-chat-model",
      temperature: 0.35,
      ...endpoint,
    }],
    selectedMainId: "main-office",
  }),
});

const session = (overrides = {}) => ({
  id: "group-a",
  memberIds: ["a", "b"],
  topic: "午饭",
  transcript: [],
  turnIndex: 0,
  requestSequence: 3,
  ...overrides,
});

test("selects the saved main endpoint using the shared API config storage", () => {
  const reads = [];
  const storage = {
    getItem(key) {
      reads.push(key);
      return createApiStorage().getItem(key);
    },
  };

  const endpoint = getOfficeEndpoint(storage);

  assert.deepEqual(reads, [STORAGE_KEY]);
  assert.equal(endpoint.id, "main-office");
  assert.equal(endpoint.model, "office-chat-model");
  assert.equal(endpoint.temperature, 0.35);
  assert.equal(getOfficeEndpoint(createStorage()), null);
});

test("includes only current-session profiles, relationships, and the last twelve transcript entries", () => {
  const transcript = Array.from({ length: 14 }, (_, index) => ({
    speakerId: index % 2 ? "b" : "a",
    text: index === 0 ? "DROP_ZERO" : index === 1 ? "DROP_ONE" : `KEEP_${index}`,
    privateMetadata: `metadata-${index}`,
  }));
  const currentSession = session({ transcript });
  const messages = buildOfficeConversationMessages(
    currentSession,
    {
      a: { id: "profile-a", name: "甲", identity: "设计师", personality: "自律" },
      b: { id: "profile-b", name: "乙", persona: "喜欢面食" },
      c: { id: "profile-c", name: "丙", persona: "不应出现" },
    },
    {
      inside: { charA: "profile-a", charB: "profile-b", type: "同事" },
      outside: { charA: "profile-a", charB: "profile-c", type: "旧友", viewA: "不应泄漏" },
    },
  );
  const text = JSON.stringify(messages);
  const systemPrompt = messages[0].content;

  assert.match(text, /甲/);
  assert.match(text, /乙/);
  assert.match(text, /同事/);
  assert.match(text, /KEEP_2/);
  assert.match(text, /KEEP_13/);
  assert.match(systemPrompt, /\{"conversationId":"group-a","requestSequence":3,"speakerId":"a","text":"一句简短自然的职场对话","end":false\}/);
  assert.doesNotMatch(text, /丙|不应出现|旧友|不应泄漏/);
  assert.doesNotMatch(text, /DROP_ZERO|DROP_ONE|privateMetadata|metadata-/);
});

test("accepts only the exact five-key reply for the current session and caps text", () => {
  const currentSession = session();
  const parsed = parseOfficeConversationReply(JSON.stringify({
    conversationId: "group-a",
    requestSequence: 3,
    speakerId: "b",
    text: `  ${"你".repeat(85)}  `,
    end: false,
  }), currentSession);

  assert.deepEqual(parsed, {
    conversationId: "group-a",
    requestSequence: 3,
    speakerId: "b",
    text: "你".repeat(80),
    end: false,
  });
});

test("rejects stale, foreign, malformed, missing-key, and extra-key replies", () => {
  const currentSession = session();
  const invalidReplies = [
    { conversationId: "group-b", requestSequence: 3, speakerId: "a", text: "错组", end: false },
    { conversationId: "group-a", requestSequence: 4, speakerId: "a", text: "旧请求", end: false },
    { conversationId: "group-a", requestSequence: "3", speakerId: "a", text: "类型错误", end: false },
    { conversationId: "group-a", requestSequence: 3, speakerId: "c", text: "外人", end: false },
    { conversationId: "group-a", requestSequence: 3, speakerId: "a", text: "缺少结束标记" },
    { conversationId: "group-a", requestSequence: 3, speakerId: "a", text: "多余键", end: false, extra: true },
    { conversationId: "group-a", requestSequence: 3, speakerId: "a", text: "   ", end: false },
    { conversationId: "group-a", requestSequence: 3, speakerId: "a", text: "结束类型错误", end: "false" },
  ];

  for (const reply of invalidReplies) {
    assert.equal(parseOfficeConversationReply(JSON.stringify(reply), currentSession), null);
  }
  assert.equal(parseOfficeConversationReply("not json", currentSession), null);
});

test("posts an isolated request with injectable fetch and abort signal", async () => {
  const calls = [];
  const controller = new AbortController();
  const currentSession = session({ transcript: [{ speakerId: "a", text: "吃什么" }] });
  const fetchImpl = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      async json() {
        return {
          choices: [{
            message: {
              content: '{"conversationId":"group-a","requestSequence":3,"speakerId":"b","text":"去楼下看看吧。","end":false}',
            },
          }],
        };
      },
    };
  };

  const reply = await requestOfficeConversationTurn({
    session: currentSession,
    profileMap: {
      a: { name: "甲" },
      b: { name: "乙" },
      outsider: { name: "外组成员" },
    },
    relationships: {},
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
  assert.equal(body.model, "office-chat-model");
  assert.equal(body.temperature, 0.35);
  assert.doesNotMatch(JSON.stringify(body.messages), /外组成员/);
  assert.deepEqual(reply, {
    conversationId: "group-a",
    requestSequence: 3,
    speakerId: "b",
    text: "去楼下看看吧。",
    end: false,
  });
});

test("returns a fallback scoped to the failed session without making unconfigured requests", async () => {
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error("network down");
  };
  const profileMap = {
    a: { name: "甲", personality: "自律" },
    b: { name: "乙", personality: "外向" },
    c: { name: "外组成员", personality: "贪吃" },
  };

  const failedReply = await requestOfficeConversationTurn({
    session: session(),
    profileMap,
    storage: createApiStorage(),
    fetchImpl,
  });
  const unconfiguredReply = await requestOfficeConversationTurn({
    session: session({ id: "group-b", memberIds: ["b"], requestSequence: 9 }),
    profileMap,
    storage: createStorage(),
    fetchImpl,
  });

  assert.equal(fetchCount, 1);
  assert.equal(failedReply.conversationId, "group-a");
  assert.equal(failedReply.requestSequence, 3);
  assert.ok(["a", "b"].includes(failedReply.speakerId));
  assert.equal(unconfiguredReply.conversationId, "group-b");
  assert.equal(unconfiguredReply.requestSequence, 9);
  assert.equal(unconfiguredReply.speakerId, "b");
});

test("builds deterministic, member-only local fallback replies", () => {
  const reply = getOfficeFallbackReply(
    session({ memberIds: ["a"], turnIndex: 7 }),
    { a: { personality: "贪吃" }, outsider: { personality: "话多" } },
  );

  assert.deepEqual(Object.keys(reply), ["conversationId", "requestSequence", "speakerId", "text", "end"]);
  assert.equal(reply.speakerId, "a");
  assert.match(reply.text, /吃/);
  assert.ok(Array.from(reply.text).length <= 80);
  assert.equal(getOfficeFallbackReply(session({ memberIds: [] }), {}), null);
});
