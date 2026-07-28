import assert from "node:assert/strict";
import test from "node:test";
import { createLocalConversation, generateOfficeConversation, parseAiOfficePlan, parseOfficeConversation } from "./officeConversation.js";

const participants = [
  { profile: { id: "character:c1", name: "林序", personality: "认真", officeContext: { identity: "财务", persona: "严谨", relationshipSummary: "与周夏是好友" } } },
  { profile: { id: "character:c2", name: "周夏", personality: "开朗", officeContext: { identity: "设计师", persona: "爱聊天" } } },
];

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
  const apiState = { mainConfigs: [{ id: "m", apiKey: "key", baseUrl: "https://example.com/v1", model: "model" }], selectedMainId: "m", mainDraft: {}, secondaryConfigs: [], secondaryDraft: {}, secondaryEnabled: false };
  const result = await generateOfficeConversation({ apiState, context: { participants, projectContext: "品牌改版", now: 1000 }, fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"turns":[{"speakerId":"character:c1","text":"进度不错。"},{"speakerId":"character:c2","text":"继续完善方案。"}]}' } }] }) }) });
  assert.equal(result.turns.length, 2);
});
