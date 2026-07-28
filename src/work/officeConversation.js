import { selectWorkProjectEndpoints } from "./workProjectApi.js";
import { getDistinctConversationIds, validateOfficeScenePlan } from "./officeScenePlan.js";

function stripJson(content) {
  const text = String(content || "").trim();
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try { return JSON.parse(match ? match[1] : text); } catch { throw new Error("AI 返回的 JSON 格式不正确"); }
}

const cleanLine = (value) => String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 42);
const participantProfiles = (participants = []) => participants.map((item) => item.profile || item).filter((item) => item?.id);

export function parseOfficeConversation(content, participants, { now = Date.now() } = {}) {
  const profiles = participantProfiles(participants);
  const known = new Set(profiles.map((item) => item.id));
  const parsed = stripJson(content);
  const turns = (Array.isArray(parsed.turns) ? parsed.turns : [])
    .map((turn) => ({ speakerId: turn?.speakerId, text: cleanLine(turn?.text) }))
    .filter((turn) => known.has(turn.speakerId) && turn.text)
    .slice(0, 6);
  const participantIds = getDistinctConversationIds(turns.map((turn) => turn.speakerId), known);
  if (participantIds.length < 2) throw new Error("办公室聊天至少需要两名人物");
  return { id: `chat:${now}`, participantIds, turns, startsAt: now, endsAt: now + Math.max(30_000, turns.length * 6_000) };
}

export function createLocalConversation({ participants = [], projectContext = "当前项目", now = Date.now() } = {}) {
  const profiles = participantProfiles(participants).slice(0, 4);
  const topic = cleanLine(projectContext) || "当前项目";
  const lines = [
    `刚看了${topic}，进度还顺利吗？`,
    "整体不错，我再把方案细节收一下。",
    "好，等会儿一起确认最后一版。",
  ];
  const turns = profiles.length < 2 ? [] : lines.slice(0, Math.min(3, profiles.length + 1)).map((text, index) => ({ speakerId: profiles[index % profiles.length].id, text }));
  return { id: `local-chat:${now}`, participantIds: profiles.map((item) => item.id), turns, startsAt: now, endsAt: now + Math.max(30_000, turns.length * 6_000) };
}

function completionUrl(baseUrl) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  return `${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`;
}

async function requestJson(candidate, messages, fetchImpl) {
  const endpoint = candidate.endpoint;
  const response = await fetchImpl(completionUrl(endpoint.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.apiKey.trim()}` },
    body: JSON.stringify({ model: (endpoint.model || endpoint.customModel).trim(), temperature: Math.min(1, Number(endpoint.temperature ?? .7)), messages }),
    signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(12_000) : undefined,
  });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content;
}

async function requestWithFailover(apiState, messages, fetchImpl) {
  const candidates = selectWorkProjectEndpoints(apiState);
  if (!candidates.length) throw new Error("请先配置可用 API");
  let lastError;
  for (const candidate of candidates) {
    try { return await requestJson(candidate, messages, fetchImpl); } catch (error) { lastError = error; }
  }
  throw lastError || new Error("AI 请求失败");
}

function profilePrompt(profile) {
  const context = profile.officeContext || {};
  return { id: profile.id, name: profile.name, identity: context.identity || profile.identity || "", personality: profile.personality || "", persona: context.persona || profile.persona || "", relations: context.relationshipSummary || "" };
}

function selectedMainEndpoint(apiState = {}) {
  return apiState.mainConfigs?.find((item) => item.id === apiState.selectedMainId) || apiState.mainDraft || null;
}

function requireMainEndpoint(apiState) {
  const endpoint = selectedMainEndpoint(apiState);
  if (!endpoint?.apiKey?.trim()) throw new Error("主 API 未填写 API Key");
  if (!endpoint?.baseUrl?.trim()) throw new Error("主 API 未填写 Base URL");
  if (!(endpoint.model || endpoint.customModel)?.trim()) throw new Error("主 API 未选择模型");
  return endpoint;
}

export function formatOfficeAiError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/401|403/.test(message)) return "API Key 无效或没有访问权限";
  if (/404/.test(message)) return "接口地址不兼容，请检查 Base URL";
  if (/429/.test(message)) return "请求过于频繁或额度不足";
  if (["AbortError", "TimeoutError"].includes(error?.name) || /timeout|超时/i.test(message)) return "请求超时，请检查网络或接口速度";
  if (/JSON|scene plan|办公室聊天至少需要/.test(message)) return "API 返回的办公室场景格式不正确";
  if (/主 API/.test(message)) return message;
  const status = message.match(/请求失败（(\d+)）/)?.[1];
  if (status) return `API 请求失败（${status}）`;
  return "网络请求失败，请检查接口地址、跨域设置或网络状态";
}

export async function generateOfficeConversation({ apiState, context, fetchImpl = fetch }) {
  const profiles = participantProfiles(context.participants);
  const content = await requestWithFailover(apiState, [
    { role: "system", content: "你在扮演办公室角色。只返回 JSON：{\"turns\":[{\"speakerId\":\"已知ID\",\"text\":\"自然中文短句\"}]}。仅使用已知ID，2到6句，每句不超过42字，不写旁白，内容符合人设、关系、时间和项目。" },
    { role: "user", content: JSON.stringify({ participants: profiles.map(profilePrompt), project: context.projectContext || "", time: new Date(context.now || Date.now()).toISOString() }) },
  ], fetchImpl);
  return parseOfficeConversation(content, profiles, { now: context.now });
}

export function parseAiOfficePlan(content, { occupants = [], now = Date.now() } = {}) {
  const plan = stripJson(content);
  const profileIds = new Set(participantProfiles(occupants).map((item) => item.id));
  const result = validateOfficeScenePlan(plan, { profileIds, now });
  const printerUsers = Object.values(plan.characters || {}).filter((item) => item.destination === "print-station").length;
  if (!result.valid || printerUsers > 1) throw new Error(`Invalid AI scene plan: ${[...result.issues, ...(printerUsers > 1 ? ["printer-capacity"] : [])].join(",")}`);
  return { ...plan, modeUsed: "ai" };
}

export async function generateAiOfficePlan({ apiState, context, fetchImpl = fetch }) {
  const profiles = participantProfiles(context.occupants);
  const content = await requestWithFailover(apiState, [
    { role: "system", content: "你是办公室场景导演。只返回 JSON，不要解释或 Markdown。顶层结构必须是 {\"id\":\"scene-id\",\"startsAt\":数字,\"endsAt\":数字,\"characters\":{\"人物ID\":{\"activity\":\"working\",\"label\":\"工作中\",\"destination\":\"目的地ID\",\"startsAt\":数字,\"endsAt\":数字}},\"conversation\":null}。characters 必须包含用户提供的每个人物ID。活动仅可用 working,reporting,printing,chatting,resting,gaming,scrolling,slacking,offDuty；目的地仅使用用户提供的ID；打印机最多一人；聊天时 conversation 使用 {\"id\":\"chat-id\",\"participantIds\":[\"人物ID\"],\"turns\":[],\"startsAt\":数字,\"endsAt\":数字} 且必须有2到4名不同人物；不聊天时 conversation 必须为 null。" },
    { role: "user", content: JSON.stringify({ profiles: profiles.map(profilePrompt), destinations: context.destinations, startsAt: context.now, endsAt: context.endsAt, project: context.projectContext || "" }) },
  ], fetchImpl);
  return parseAiOfficePlan(content, context);
}

export async function testOfficeAiDirector({ apiState, fetchImpl = fetch, now = Date.now() }) {
  const endpoint = requireMainEndpoint(apiState);
  const mainOnlyState = { ...apiState, mainConfigs: [endpoint], selectedMainId: endpoint.id, mainDraft: endpoint, secondaryEnabled: false };
  const occupant = { slotId: "boss", profile: { id: "office-api-test", name: "测试角色", personality: "认真负责" } };
  await generateAiOfficePlan({
    apiState: mainOnlyState,
    context: { occupants: [occupant], now, endsAt: now + 900_000, projectContext: "连接测试", destinations: ["boss-home"] },
    fetchImpl,
  });
  return { source: "main", model: (endpoint.model || endpoint.customModel).trim() };
}
