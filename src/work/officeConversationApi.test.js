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
import { createOfficeProfileSnapshot } from "./officeProfiles.js";

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

const getPromptContext = (messages) => {
  const marker = "当前会话上下文：\n";
  const systemPrompt = messages[0].content;
  return JSON.parse(systemPrompt.slice(systemPrompt.indexOf(marker) + marker.length));
};

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

test("preserves richer Me and Character profile snapshots only for current members", () => {
  const meSnapshot = {
    ...createOfficeProfileSnapshot({
      id: "profile-me",
      name: "我",
      identity: "产品经理",
      personality: "谨慎",
      appearance: "白衬衫",
      persona: "习惯先问清楚目标",
    }, "me"),
    worldview: "不应出现在 Me 档案",
  };
  const characterSnapshot = createOfficeProfileSnapshot({
    id: "profile-character",
    type: "main",
    name: "林岚",
    identity: "工程师",
    personality: "直接",
    appearance: "黑色外套",
    persona: "喜欢把复杂问题拆开",
    worldview: "所有系统都应该先定义边界",
  }, "character");
  const outsiderSnapshot = createOfficeProfileSnapshot({
    id: "profile-outsider",
    type: "npc",
    name: "未参与角色",
    identity: "销售",
    personality: "热络",
    appearance: "红色围巾",
    persona: "不应进入提示词",
    worldview: "外部世界观不应泄漏",
  }, "character");
  const messages = buildOfficeConversationMessages(
    session({ memberIds: ["me-1", "char-1"] }),
    {
      "me-1": { profile: meSnapshot },
      "char-1": characterSnapshot,
      outsider: outsiderSnapshot,
    },
  );
  const context = getPromptContext(messages);
  const text = JSON.stringify(messages);

  assert.deepEqual(context.members, [
    {
      memberId: "me-1",
      profileId: "profile-me",
      source: "me",
      name: "我",
      identity: "产品经理",
      personality: "谨慎",
      appearance: "白衬衫",
      persona: "习惯先问清楚目标",
    },
    {
      memberId: "char-1",
      profileId: "profile-character",
      source: "character",
      type: "main",
      name: "林岚",
      identity: "工程师",
      personality: "直接",
      appearance: "黑色外套",
      persona: "喜欢把复杂问题拆开",
      worldview: "所有系统都应该先定义边界",
    },
  ]);
  assert.doesNotMatch(text, /未参与角色|外部世界观不应泄漏|不应进入提示词|不应出现在 Me 档案/);
});

test("filters foreign tagged transcript entries before keeping the last twelve current-session entries", () => {
  const currentEntries = Array.from({ length: 14 }, (_, index) => ({
    ...(index % 2 === 0 ? { conversationId: "group-a" } : {}),
    speakerId: index % 2 ? "b" : "a",
    text: `CURRENT_${index}`,
  }));
  const foreignEntries = Array.from({ length: 8 }, (_, index) => ({
    conversationId: "group-b",
    speakerId: index % 2 ? "b" : "a",
    text: `FOREIGN_${index}`,
  }));
  const messages = buildOfficeConversationMessages(session({
    transcript: [
      ...currentEntries.slice(0, 7),
      { conversationId: "group-b", speakerId: "a", text: "FOREIGN_SHARED_MEMBER" },
      ...currentEntries.slice(7),
      ...foreignEntries,
    ],
  }));
  const transcript = getPromptContext(messages).transcript;

  assert.equal(transcript.length, 12);
  assert.deepEqual(transcript.map((entry) => entry.text), currentEntries.slice(2).map((entry) => entry.text));
  assert.equal(transcript[1].text, "CURRENT_3");
  assert.doesNotMatch(JSON.stringify(messages), /FOREIGN_/);
});

test("includes only the sanitized current activity from the supported session fields", () => {
  const directContext = getPromptContext(buildOfficeConversationMessages(session({
    currentActivity: "  planning  ",
    activity: "FOREIGN_ACTIVITY",
    promptContext: {
      activity: "FOREIGN_PROMPT_ACTIVITY",
      secret: "PROMPT_CONTEXT_LEAK",
    },
  })));
  const activityContext = getPromptContext(buildOfficeConversationMessages(session({
    currentActivity: null,
    activity: "  eating  ",
    promptContext: { activity: "FOREIGN_PROMPT_ACTIVITY" },
  })));
  const promptContextActivity = getPromptContext(buildOfficeConversationMessages(session({
    currentActivity: { unsafe: true },
    activity: null,
    promptContext: { activity: "  gaming  ", secret: "PROMPT_CONTEXT_LEAK" },
  })));
  const defaultContext = getPromptContext(buildOfficeConversationMessages(session({
    currentActivity: 42,
    activity: {},
    promptContext: { activity: [] },
  })));

  assert.equal(directContext.currentActivity, "planning");
  assert.equal(activityContext.currentActivity, "eating");
  assert.equal(promptContextActivity.currentActivity, "gaming");
  assert.equal(defaultContext.currentActivity, "chatting");
  assert.doesNotMatch(JSON.stringify(directContext), /FOREIGN_|PROMPT_CONTEXT_LEAK|secret/);
  assert.doesNotMatch(JSON.stringify(promptContextActivity), /PROMPT_CONTEXT_LEAK|secret|unsafe/);
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

test("handles null, non-object, and malformed sessions without throwing or requesting", async () => {
  const validRawReply = JSON.stringify({
    conversationId: "group-a",
    requestSequence: 3,
    speakerId: "a",
    text: "不应接受",
    end: false,
  });
  const unusableSessions = [
    null,
    "group-a",
    42,
    [],
    {},
    { id: "", memberIds: ["a"], requestSequence: 3 },
    { id: "group-a", memberIds: [], requestSequence: 3 },
    { id: "group-a", memberIds: ["a"], requestSequence: "3" },
  ];
  let fetchCount = 0;
  const fetchImpl = async () => {
    fetchCount += 1;
    throw new Error("must not request");
  };

  for (const unusableSession of unusableSessions) {
    assert.doesNotThrow(() => buildOfficeConversationMessages(unusableSession));
    assert.equal(parseOfficeConversationReply(validRawReply, unusableSession), null);
    assert.equal(getOfficeFallbackReply(unusableSession), null);
    assert.equal(await requestOfficeConversationTurn({
      session: unusableSession,
      storage: createApiStorage(),
      fetchImpl,
    }), null);
  }
  assert.equal(await requestOfficeConversationTurn(null), null);
  assert.equal(fetchCount, 0);
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

test("returns a valid current-session fallback for storage, HTTP, JSON, and content failures", async () => {
  const currentSession = session({ memberIds: ["a"], turnIndex: 0 });
  const expectedFallback = getOfficeFallbackReply(currentSession);
  let storageFetchCount = 0;
  const storageReply = await requestOfficeConversationTurn({
    session: currentSession,
    storage: {
      getItem() {
        throw new Error("storage unavailable");
      },
    },
    fetchImpl: async () => {
      storageFetchCount += 1;
      throw new Error("must not request");
    },
  });
  assert.deepEqual(storageReply, expectedFallback);
  assert.equal(storageFetchCount, 0);

  let nonOkJsonCount = 0;
  const failureFetches = [
    async () => ({
      ok: false,
      status: 503,
      async json() {
        nonOkJsonCount += 1;
        return {};
      },
    }),
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
        return { choices: [{ message: { content: { unexpected: true } } }] };
      },
    }),
  ];

  for (const fetchImpl of failureFetches) {
    const reply = await requestOfficeConversationTurn({
      session: currentSession,
      storage: createApiStorage(),
      fetchImpl,
    });
    assert.deepEqual(reply, expectedFallback);
    assert.deepEqual(parseOfficeConversationReply(reply, currentSession), expectedFallback);
  }
  assert.equal(nonOkJsonCount, 0);
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
