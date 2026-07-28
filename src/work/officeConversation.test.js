import assert from "node:assert/strict";
import test from "node:test";
import { createLocalConversation, formatOfficeAiError, generateOfficeConversation, parseAiOfficePlan, parseOfficeConversation, testOfficeAiDirector } from "./officeConversation.js";

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
});

test("rejects two AI turns from one speaker", () => {
  const content = JSON.stringify({ turns: [
    { speakerId: "character:c1", text: "我先核一下。" },
    { speakerId: "character:c1", text: "已经核完了。" },
  ] });
  assert.throws(() => parseOfficeConversation(content, participants, { now: 1_000 }), /至少需要两名人物/);
});

test("creates persona-aware local fallback dialogue", () => {
  const plan = createLocalConversation({ participants, projectContext: "品牌改版", now: 1000 });
  assert.ok(plan.turns.length >= 2);
  assert.match(plan.turns.map((turn) => turn.text).join(" "), /品牌改版|进度|方案/);
});

test("rejects unsafe AI scene plans", () => {
  const content = JSON.stringify({ characters: {
    "character:c1": { activity: "printing", destination: "print-station", startsAt: 1000, endsAt: 5000 },
    "character:c2": { activity: "flying", destination: "wall", startsAt: 1000, endsAt: 5000 },
  } });
  assert.throws(() => parseAiOfficePlan(content, { occupants: participants, now: 1000 }), /scene plan/i);
});

test("uses configured endpoint and returns normalized conversation", async () => {
  const result = await generateOfficeConversation({ apiState: mainApiState, context: { participants, projectContext: "品牌改版", now: 1000 }, fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"turns":[{"speakerId":"character:c1","text":"进度不错。"},{"speakerId":"character:c2","text":"继续完善方案。"}]}' } }] }) }) });
  assert.equal(result.turns.length, 2);
});

test("tests the selected main endpoint with the real office scene contract", async () => {
  const calls = [];
  const result = await testOfficeAiDirector({
    apiState: mainApiState,
    now: 1_000,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        id: "test-plan",
        startsAt: 1_000,
        endsAt: 901_000,
        characters: { "office-api-test": { activity: "working", label: "工作中", destination: "boss-home", startsAt: 1_000, endsAt: 901_000 } },
        conversation: null,
      }) } }] }) };
    },
  });
  assert.deepEqual(result, { source: "main", model: "model" });
  assert.equal(calls[0].url, "https://example.com/v1/chat/completions");
  assert.equal(JSON.parse(calls[0].options.body).model, "model");
});

test("reports missing main fields before requesting", async () => {
  await assert.rejects(
    testOfficeAiDirector({ apiState: { ...mainApiState, mainConfigs: [{ ...mainApiState.mainConfigs[0], model: "" }], mainDraft: {} }, fetchImpl: async () => assert.fail("must not request") }),
    /主 API 未选择模型/,
  );
});

test("formats office API failures for people", () => {
  assert.equal(formatOfficeAiError(new Error("请求失败（401）")), "API Key 无效或没有访问权限");
  assert.equal(formatOfficeAiError(new Error("请求失败（404）")), "接口地址不兼容，请检查 Base URL");
  assert.equal(formatOfficeAiError(new Error("请求失败（429）")), "请求过于频繁或额度不足");
  assert.equal(formatOfficeAiError(new DOMException("timeout", "TimeoutError")), "请求超时，请检查网络或接口速度");
  assert.equal(formatOfficeAiError(new Error("Invalid AI scene plan: plan")), "API 返回的办公室场景格式不正确");
});
