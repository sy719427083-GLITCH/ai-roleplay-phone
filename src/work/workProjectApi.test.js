import assert from "node:assert/strict";
import test from "node:test";
import { generateWorkProjects, parseWorkProjectResponse, selectWorkProjectEndpoints } from "./workProjectApi.js";

const endpoint = (id, baseUrl, model = "gpt-test") => ({ id, apiKey: `${id}-key`, baseUrl, model, customModel: "", temperature: 0.6 });
const apiState = {
  mainConfigs: [endpoint("main", "https://main.example/v1/")], selectedMainId: "main",
  secondaryConfigs: [endpoint("secondary", "https://secondary.example")], selectedSecondaryId: "secondary",
  mainDraft: {}, secondaryDraft: {}, secondaryEnabled: true,
};
const payload = { projects: Array.from({ length: 5 }, (_, index) => ({
  name: `真实项目 ${index + 1}`, duration: `${index + 2}天`, amount: `¥${index + 1}000`,
  description: `这是项目 ${index + 1} 的实际工作内容`, difficulty: ["简单", "中等", "困难"][index % 3],
})) };

test("selects enabled secondary before main and ignores disabled secondary", () => {
  assert.deepEqual(selectWorkProjectEndpoints(apiState).map((item) => item.source), ["secondary", "main"]);
  assert.deepEqual(selectWorkProjectEndpoints({ ...apiState, secondaryEnabled: false }).map((item) => item.source), ["main"]);
});

test("falls back to valid drafts when no saved endpoint is selected", () => {
  const state = { ...apiState, mainConfigs: [], selectedMainId: "", mainDraft: endpoint("draft", "https://draft.example"), secondaryEnabled: false };
  assert.equal(selectWorkProjectEndpoints(state)[0].endpoint.id, "draft");
});

test("parses plain or fenced JSON and assigns revision based ids", () => {
  const plain = parseWorkProjectResponse(JSON.stringify(payload), 3);
  const fenced = parseWorkProjectResponse(`\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\`\n`, 0);
  assert.equal(plain[0].id, "api-4-1");
  assert.equal(fenced[4].id, "api-1-5");
});

test("rejects malformed, incomplete, or unsupported generated projects", () => {
  assert.throws(() => parseWorkProjectResponse("not json", 0));
  assert.throws(() => parseWorkProjectResponse(JSON.stringify({ projects: payload.projects.slice(1) }), 0));
  assert.throws(() => parseWorkProjectResponse(JSON.stringify({ projects: payload.projects.map((item, index) => index ? item : { ...item, difficulty: "极难" }) }), 0));
});

test("trims and safely truncates generated fields", () => {
  const long = structuredClone(payload);
  long.projects[0].name = `  ${"长".repeat(30)}  `;
  long.projects[0].description = "内容".repeat(80);
  const parsed = parseWorkProjectResponse(JSON.stringify(long), 0);
  assert.equal(parsed[0].name.length, 24);
  assert.equal(parsed[0].description.length, 100);
});

test("retries main once after secondary fails", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("secondary")) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) };
  };
  const result = await generateWorkProjects({ apiState, revision: 2, fetchImpl });
  assert.equal(result.source, "main");
  assert.deepEqual(calls.map((call) => call.url), ["https://secondary.example/v1/chat/completions", "https://main.example/v1/chat/completions"]);
  assert.equal(calls[1].options.headers.Authorization, "Bearer main-key");
  assert.equal(JSON.parse(calls[1].options.body).model, "gpt-test");
});

test("reports a setup error when no valid API exists", async () => {
  await assert.rejects(
    generateWorkProjects({ apiState: { mainConfigs: [], secondaryConfigs: [], mainDraft: {}, secondaryDraft: {}, secondaryEnabled: true }, revision: 0, fetchImpl: async () => {} }),
    /请先在 API 设置中配置主 API 或副 API/,
  );
});
