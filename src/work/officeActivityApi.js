import { getOfficeEndpoint } from "./officeConversationApi.js";

const MAX_DETAIL_CHARACTERS = 120;
const SEMANTIC_KEYS = ["eventId", "subject", "summary", "insightOrResult"];

const isPlainObject = (value) => {
  try {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  } catch {
    return false;
  }
};
const readProperty = (value, key) => {
  try {
    return value?.[key];
  } catch {
    return undefined;
  }
};
const cap = (value) => typeof value === "string" ? Array.from(value.trim()).slice(0, MAX_DETAIL_CHARACTERS).join("") : "";
const stripJsonFence = (raw) => raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
const getEventId = (event) => {
  try {
    return String(readProperty(readProperty(event, "semanticContext"), "eventId") || "");
  } catch {
    return "";
  }
};
const getFallback = (event) => {
  const semanticContext = readProperty(event, "semanticContext");
  const fallbackCandidate = readProperty(semanticContext, "semanticFallback");
  const fallback = isPlainObject(fallbackCandidate)
    ? fallbackCandidate
    : {};
  const profileSnapshots = readProperty(event, "profileSnapshots");
  let profile = {};
  try {
    if (Array.isArray(profileSnapshots)) profile = profileSnapshots.find(isPlainObject) || {};
  } catch {
    profile = {};
  }
  const name = cap(readProperty(profile, "name"));
  const personality = cap(readProperty(profile, "personality"));
  const subject = cap(readProperty(fallback, "subject")) || "当前事项";
  const summary = cap(`${name}${personality ? `以${personality}的方式` : ""}${cap(readProperty(fallback, "summary")) || "正在推进当前事项"}`);
  const insightOrResult = cap(readProperty(fallback, "insightOrResult")) || "形成下一步";
  return { eventId: getEventId(event), subject, summary, insightOrResult };
};
const getChatCompletionsUrl = (baseUrl) => `${String(baseUrl || "").trim().replace(/\/+$/, "").replace(/\/v1$/, "")}/v1/chat/completions`;

export function buildOfficeActivityMessages(event = {}) {
  try {
    if (!isPlainObject(event)) return [];
    const context = isPlainObject(event.semanticContext) ? event.semanticContext : {};
    const profiles = Array.isArray(event.profileSnapshots) ? event.profileSnapshots : [];
    if (!getEventId(event)) return [];
    return [{
      role: "system",
      content: `根据参与角色档案补全当前办公室活动的语义记录。只返回 eventId、subject、summary、insightOrResult 四个键的 JSON。不得返回或改变 activityId、sceneId、targetAnchors、actorIds、clipId、propState、reservationGroupId。\n${JSON.stringify({ eventId: context.eventId, activityId: context.activityId, status: context.status, profiles, semanticFallback: context.semanticFallback })}`,
    }, { role: "user", content: "生成本次活动的具体记录。" }];
  } catch {
    return [];
  }
}

export function parseOfficeActivityReply(raw, event = {}) {
  try {
    if (!isPlainObject(event)) return null;
    const parsed = typeof raw === "string" ? JSON.parse(stripJsonFence(raw)) : raw;
    if (!isPlainObject(parsed)) return null;
    const keys = Object.keys(parsed);
    if (keys.length !== SEMANTIC_KEYS.length || SEMANTIC_KEYS.some((key) => !keys.includes(key))) return null;
    if (parsed.eventId !== getEventId(event)) return null;
    const result = Object.fromEntries(SEMANTIC_KEYS.map((key) => [key, key === "eventId" ? parsed[key] : cap(parsed[key]) ]));
    return result.subject && result.summary && result.insightOrResult ? result : null;
  } catch {
    return null;
  }
}

export async function requestOfficeActivityDetail(options = {}) {
  const normalizedOptions = isPlainObject(options) ? options : {};
  let event;
  try {
    event = isPlainObject(normalizedOptions.event) ? normalizedOptions.event : {};
  } catch {
    return getFallback({});
  }
  const fallback = getFallback(event);
  try {
    const endpoint = getOfficeEndpoint(normalizedOptions.storage);
    const fetchImpl = normalizedOptions.fetchImpl === undefined ? globalThis.fetch : normalizedOptions.fetchImpl;
    const messages = buildOfficeActivityMessages(event);
    if (!endpoint || typeof fetchImpl !== "function" || !messages.length) return fallback;
    const response = await fetchImpl(getChatCompletionsUrl(endpoint.baseUrl), {
      method: "POST",
      headers: { Authorization: `Bearer ${endpoint.apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: endpoint.model, messages, temperature: Number(endpoint.temperature ?? 0.7) }),
      signal: normalizedOptions.signal,
    });
    if (!response?.ok) return fallback;
    const raw = (await response.json())?.choices?.[0]?.message?.content;
    const detail = parseOfficeActivityReply(raw, event);
    return detail || fallback;
  } catch {
    return fallback;
  }
}
