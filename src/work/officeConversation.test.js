import assert from "node:assert/strict";
import test from "node:test";
import { MAX_OFFICE_CONVERSATION_BATCHES, OFFICE_CONVERSATION_TIMEOUT_MS, OFFICE_SCENE_TIMEOUT_MS, buildOfficeAiContext, createLocalConversation, formatOfficeAiError, generateOfficeConversation, normalizeOfficeLine, parseAiOfficePlan, parseOfficeConversation, testOfficeAiDirector } from "./officeConversation.js";

const participants = [
  { profile: { id: "character:c1", name: "林序", personality: "认真", officeContext: { identity: "财务", persona: "严谨", relationshipSummary: "与周夏是好友" } } },
  { profile: { id: "character:c2", name: "周夏", personality: "开朗", officeContext: { identity: "设计师", persona: "爱聊天" } } },
];

const mainApiState = { mainConfigs: [{ id: "m", apiKey: "key", baseUrl: "https://example.com/v1", model: "model" }], selectedMainId: "m", mainDraft: {}, secondaryConfigs: [], secondaryDraft: {}, secondaryEnabled: false };

test("parses bounded turns from known participants", () => {
  const plan = parseOfficeConversation(JSON.stringify({ turns: [
    { speakerId: "character:c1", text: "这份报表我核完了。" },
    { speakerId: "character:c2", text: "我再看一下趋势图。" },
    { speakerId: "unknown", text: "不应出现" },
  ] }), participants, { now: 1000 });
  assert.deepEqual(plan.turns.map((turn) => turn.speakerId), ["character:c1", "character:c2"]);
  assert.equal(plan.shouldContinue, false);
  assert.equal(plan.batchIndex, 1);
});

test("parses continuation metadata and removes repeated history", () => {
  const result = parseOfficeConversation(JSON.stringify({
    shouldContinue: true,
    turns: [
      { speakerId: "character:c2", text: "进度不错！" },
      { speakerId: "character:c2", text: "我继续调整配色。" },
      { speakerId: "character:c1", text: "我看完再告诉你。" },
    ],
  }), participants, {
    now: 1_000,
    history: [{ speakerId: "character:c1", text: "进度不错" }],
    batchIndex: 2,
  });
  assert.equal(result.shouldContinue, true);
  assert.equal(result.batchIndex, 2);
  assert.deepEqual(result.turns.map((turn) => turn.text), ["我继续调整配色。", "我看完再告诉你。"]);
  assert.equal(normalizeOfficeLine("进度不错！"), normalizeOfficeLine(" 进度，不错。 "));
});

test("rejects a batch that continues with the previous speaker", () => {
  assert.throws(() => parseOfficeConversation(JSON.stringify({
    shouldContinue: false,
    turns: [
      { speakerId: "character:c1", text: "我再补一句。" },
      { speakerId: "character:c2", text: "可以。" },
    ],
  }), participants, { history: [{ speakerId: "character:c1", text: "先这样处理。" }] }), /连续说话/);
});

test("caps continuation at three batches", () => {
  const result = parseOfficeConversation(JSON.stringify({ shouldContinue: true, turns: [
    { speakerId: "character:c1", text: "第三批第一句。" },
    { speakerId: "character:c2", text: "第三批第二句。" },
  ] }), participants, { batchIndex: 3 });
  assert.equal(MAX_OFFICE_CONVERSATION_BATCHES, 3);
  assert.equal(result.shouldContinue, false);
});

test("rejects two AI turns from one speaker", () => {
  const content = JSON.stringify({ turns: [
    { speakerId: "character:c1", text: "我先核一下。" },
    { speakerId: "character:c1", text: "已经核完了。" },
  ] });
  assert.throws(() => parseOfficeConversation(content, participants, { now: 1_000 }), /连续说话/);
});

test("creates persona-aware local fallback dialogue", () => {
  const plan = createLocalConversation({ participants, projectContext: "品牌改版", now: 1000 });
  assert.ok(plan.turns.length >= 2);
  assert.match(plan.turns.map((turn) => turn.text).join(" "), /品牌改版|进度|方案/);
  assert.equal(plan.shouldContinue, false);
  const continued = createLocalConversation({ participants, projectContext: "品牌改版", now: 2000, batchIndex: 2, history: plan.turns });
  assert.equal(continued.turns.some((turn) => plan.turns.some((previous) => normalizeOfficeLine(previous.text) === normalizeOfficeLine(turn.text))), false);
});

test("rejects unsafe AI scene plans", () => {
  const content = JSON.stringify({ characters: {
    "character:c1": { activity: "printing", destination: "print-station", startsAt: 1000, endsAt: 5000 },
    "character:c2": { activity: "flying", destination: "wall", startsAt: 1000, endsAt: 5000 },
  } });
  assert.throws(() => parseAiOfficePlan(content, { occupants: participants, now: 1000 }), /scene plan/i);
});

test("uses configured endpoint and returns normalized conversation", async () => {
  let request;
  const history = [{ speakerId: "character:c2", text: "先确认方向。" }];
  const result = await generateOfficeConversation({ apiState: mainApiState, context: { participants, projectContext: "品牌改版", now: 1000, history, batchIndex: 2 }, fetchImpl: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '{"shouldContinue":true,"turns":[{"speakerId":"character:c1","text":"进度不错。"},{"speakerId":"character:c2","text":"继续完善方案。"}]}' } }] }) };
  } });
  assert.equal(result.turns.length, 2);
  assert.equal(result.shouldContinue, true);
  assert.deepEqual(JSON.parse(request.messages[1].content).history, history);
  assert.equal(JSON.parse(request.messages[1].content).batchIndex, 2);
});

test("builds the same full context for testing and live AI direction", () => {
  const occupants = [
    { slotId: "boss", profile: { id: "me:m1", name: "我" } },
    { slotId: "employee1", profile: { id: "character:c1", name: "甲" } },
    { slotId: "employee2", profile: { id: "character:c2", name: "乙" } },
  ];
  const context = buildOfficeAiContext({ occupants, now: 1_000, endsAt: 901_000, projectContext: "品牌项目" });
  assert.deepEqual(context.occupants, occupants);
  assert.equal(context.projectContext, "品牌项目");
  assert.ok(context.destinations.includes("boss-home"));
  assert.ok(context.destinations.includes("employee1-home"));
  assert.equal(OFFICE_SCENE_TIMEOUT_MS, 30_000);
  assert.equal(OFFICE_CONVERSATION_TIMEOUT_MS, 12_000);
});

test("realistic AI test sends every current occupant and rejects an empty office", async () => {
  const occupants = [
    { slotId: "boss", profile: { id: "character:c1", name: "林序" } },
    { slotId: "employee1", profile: { id: "character:c2", name: "周夏" } },
  ];
  const context = buildOfficeAiContext({ occupants, now: 1_000, endsAt: 901_000, projectContext: "品牌项目" });
  let request;
  const result = await testOfficeAiDirector({ apiState: mainApiState, context, fetchImpl: async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      id: "realistic-test", startsAt: 1_000, endsAt: 901_000,
      characters: {
        "character:c1": { activity: "working", label: "工作中", destination: "boss-home", startsAt: 1_000, endsAt: 901_000 },
        "character:c2": { activity: "reporting", label: "做报表", destination: "employee1-home", startsAt: 1_000, endsAt: 901_000 },
      },
      conversation: null,
    }) } }] }) };
  } });
  assert.deepEqual(result, { source: "main", model: "model" });
  assert.equal(request.url, "https://example.com/v1/chat/completions");
  assert.deepEqual(JSON.parse(request.body.messages[1].content).profiles.map((item) => item.id), ["character:c1", "character:c2"]);
  await assert.rejects(
    testOfficeAiDirector({ apiState: mainApiState, context: buildOfficeAiContext({ occupants: [], now: 1_000, endsAt: 901_000 }), fetchImpl: async () => assert.fail("must not request") }),
    /至少一名人物/,
  );
});

test("reports missing main fields before requesting", async () => {
  const context = buildOfficeAiContext({ occupants: [{ slotId: "boss", profile: { id: "character:c1" } }], now: 1_000, endsAt: 901_000 });
  await assert.rejects(
    testOfficeAiDirector({ apiState: { ...mainApiState, mainConfigs: [{ ...mainApiState.mainConfigs[0], model: "" }], mainDraft: {} }, context, fetchImpl: async () => assert.fail("must not request") }),
    /主 API 未选择模型/,
  );
});

test("formats office API failures for people", () => {
  assert.equal(formatOfficeAiError(new Error("请先在员工管理中安排至少一名人物")), "请先在员工管理中安排至少一名人物");
  assert.equal(formatOfficeAiError(new Error("请先配置可用 API")), "主 API 配置不完整，请检查 API Key、Base URL 和模型");
  assert.equal(formatOfficeAiError(new Error("请求失败（401）")), "API Key 无效或没有访问权限");
  assert.equal(formatOfficeAiError(new Error("请求失败（404）")), "接口地址不兼容，请检查 Base URL");
  assert.equal(formatOfficeAiError(new Error("请求失败（429）")), "请求过于频繁或额度不足");
  assert.equal(formatOfficeAiError(new DOMException("timeout", "TimeoutError")), "请求超时，请检查网络或接口速度");
  assert.equal(formatOfficeAiError(new Error("Invalid AI scene plan: plan")), "API 返回的办公室场景格式不正确");
});
