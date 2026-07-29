import { selectWorkProjectEndpoints } from "./workProjectApi.js";
import { OFFICE_ACTIVITY_POINTS } from "./officeGeometry.js";
import { getDistinctConversationIds, validateOfficeScenePlan } from "./officeScenePlan.js";

export const OFFICE_SCENE_TIMEOUT_MS = 30_000;
export const OFFICE_CONVERSATION_TIMEOUT_MS = 12_000;
export const MAX_OFFICE_CONVERSATION_BATCHES = 3;

function stripJson(content) {
  const text = String(content || "").trim();
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  try { return JSON.parse(match ? match[1] : text); } catch { throw new Error("AI 返回的 JSON 格式不正确"); }
}

const cleanLine = (value) => String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 42);
const participantProfiles = (participants = []) => participants.map((item) => item.profile || item).filter((item) => item?.id);

export function normalizeOfficeLine(value) {
  return cleanLine(value).toLocaleLowerCase("zh-CN").replace(/[\s，。！？、,.!?：:；;“”‘’（）()\-—]/g, "");
}

export function parseOfficeConversation(content, participants, { now = Date.now(), history = [], batchIndex = 1 } = {}) {
  const profiles = participantProfiles(participants);
  const known = new Set(profiles.map((item) => item.id));
  const parsed = stripJson(content);
  const seen = new Set(history.map((turn) => normalizeOfficeLine(turn?.text)).filter(Boolean));
  const turns = [];
  let lastSpeakerId = history.at(-1)?.speakerId || "";
  for (const raw of Array.isArray(parsed.turns) ? parsed.turns : []) {
    const turn = { speakerId: raw?.speakerId, text: cleanLine(raw?.text) };
    const key = normalizeOfficeLine(turn.text);
    if (!known.has(turn.speakerId) || !key || seen.has(key)) continue;
    if (turn.speakerId === lastSpeakerId) throw new Error("办公室聊天不能由同一人物连续说话");
    turns.push(turn);
    seen.add(key);
    lastSpeakerId = turn.speakerId;
    if (turns.length === 6) break;
  }
  const participantIds = getDistinctConversationIds(turns.map((turn) => turn.speakerId), known);
  if (participantIds.length < 2) throw new Error("办公室聊天至少需要两名人物");
  return {
    id: `chat:${now}:${batchIndex}`,
    participantIds: profiles.map((item) => item.id).slice(0, 4),
    turns,
    shouldContinue: Boolean(parsed.shouldContinue) && batchIndex < MAX_OFFICE_CONVERSATION_BATCHES,
    batchIndex,
    startsAt: now,
    endsAt: now + turns.length * 6_500,
  };
}

export function createLocalConversation({ participants = [], projectContext = "当前项目", now = Date.now(), history = [], batchIndex = 1 } = {}) {
  const profiles = participantProfiles(participants).slice(0, 4);
  const topic = cleanLine(projectContext) || "当前项目";
  const seen = new Set(history.map((turn) => normalizeOfficeLine(turn?.text)).filter(Boolean));
  const lines = [
    `刚看了${topic}，进度还顺利吗？`,
    "整体不错，我再把方案细节收一下。",
    "好，等会儿一起确认最后一版。",
    `我会继续核对${topic}的重点。`,
    "有需要调整的地方直接告诉我。",
    "那就先按刚才说的方向推进。",
    "我整理好以后发给大家确认。",
    "可以，剩下的细节我们边做边看。",
  ].filter((text) => !seen.has(normalizeOfficeLine(text)));
  const desiredCount = Math.min(4, Math.max(2, profiles.length + 1));
  let speakerIndex = profiles.findIndex((profile) => profile.id === history.at(-1)?.speakerId) + 1;
  const turns = profiles.length < 2 ? [] : lines.slice(0, desiredCount).map((text) => {
    const speakerId = profiles[speakerIndex % profiles.length].id;
    speakerIndex += 1;
    return { speakerId, text };
  });
  return {
    id: `local-chat:${now}:${batchIndex}`,
    participantIds: profiles.map((item) => item.id),
    turns,
    shouldContinue: false,
    batchIndex,
    startsAt: now,
    endsAt: now + turns.length * 6_500,
  };
}

function completionUrl(baseUrl) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  return `${base.endsWith("/v1") ? base : `${base}/v1`}/chat/completions`;
}

async function requestJson(candidate, messages, fetchImpl, timeoutMs) {
  const endpoint = candidate.endpoint;
  const response = await fetchImpl(completionUrl(endpoint.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.apiKey.trim()}` },
    body: JSON.stringify({ model: (endpoint.model || endpoint.customModel).trim(), temperature: Math.min(1, Number(endpoint.temperature ?? .7)), messages }),
    signal: typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  if (!response.ok) throw new Error(`请求失败（${response.status}）`);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content;
}

async function requestWithFailover(apiState, messages, fetchImpl, timeoutMs) {
  const candidates = selectWorkProjectEndpoints(apiState);
  if (!candidates.length) throw new Error("请先配置可用 API");
  let lastError;
  for (const candidate of candidates) {
    try { return await requestJson(candidate, messages, fetchImpl, timeoutMs); } catch (error) { lastError = error; }
  }
  throw lastError || new Error("AI 请求失败");
}

function profilePrompt(profile) {
  const context = profile.officeContext || {};
  return { id: profile.id, name: profile.name, identity: context.identity || profile.identity || "", personality: profile.personality || "", persona: context.persona || profile.persona || "", relations: context.relationshipSummary || "" };
}

export function buildOfficeAiContext({ occupants = [], now = Date.now(), endsAt = now + 900_000, projectContext = "" } = {}) {
  return {
    occupants,
    now,
    endsAt,
    projectContext,
    destinations: [...new Set([
      ...Object.keys(OFFICE_ACTIVITY_POINTS),
      ...occupants.map((item) => `${item.slotId}-home`),
      "print-station",
    ])],
  };
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
  if (/请先在员工管理中安排至少一名人物/.test(message)) return message;
  if (/请先配置可用 API/.test(message)) return "主 API 配置不完整，请检查 API Key、Base URL 和模型";
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
    { role: "system", content: "你在扮演办公室角色。只返回 JSON：{\"shouldContinue\":布尔值,\"turns\":[{\"speakerId\":\"已知ID\",\"text\":\"自然中文短句\"}]}。仅使用已知ID，2到6句，每句不超过42字，不写旁白；不能复述 history；同一人物不能连续说话；内容符合人设、关系、时间和项目；话题自然结束时 shouldContinue=false。" },
    { role: "user", content: JSON.stringify({ participants: profiles.map(profilePrompt), project: context.projectContext || "", time: new Date(context.now || Date.now()).toISOString(), history: context.history || [], batchIndex: context.batchIndex || 1 }) },
  ], fetchImpl, OFFICE_CONVERSATION_TIMEOUT_MS);
  return parseOfficeConversation(content, profiles, context);
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
  ], fetchImpl, OFFICE_SCENE_TIMEOUT_MS);
  return parseAiOfficePlan(content, context);
}

export async function testOfficeAiDirector({ apiState, context, fetchImpl = fetch }) {
  if (!context?.occupants?.length) throw new Error("请先在员工管理中安排至少一名人物");
  const endpoint = requireMainEndpoint(apiState);
  const mainOnlyState = { ...apiState, mainConfigs: [endpoint], selectedMainId: endpoint.id, mainDraft: endpoint, secondaryEnabled: false };
  await generateAiOfficePlan({ apiState: mainOnlyState, context, fetchImpl });
  return { source: "main", model: (endpoint.model || endpoint.customModel).trim() };
}
