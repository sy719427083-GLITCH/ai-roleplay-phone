import { parseConfigs, STORAGE_KEY } from "../apiConfig.js";

const MAX_TRANSCRIPT_ENTRIES = 12;
const MAX_REPLY_CHARACTERS = 80;
const REPLY_KEYS = ["conversationId", "requestSequence", "speakerId", "text", "end"];
const RELATION_FIELDS = [
  "charA",
  "charB",
  "type",
  "typeA",
  "typeB",
  "customType",
  "customTypeA",
  "customTypeB",
  "viewA",
  "viewB",
];

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getDefaultStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
};

const getMemberIds = (session = {}) => Array.isArray(session.memberIds)
  ? [...new Set(session.memberIds.filter((memberId) => typeof memberId === "string" && memberId))]
  : [];

const getMappedValue = (valueMap, key) => {
  if (valueMap instanceof Map) return valueMap.get(key);
  return isPlainObject(valueMap) ? valueMap[key] : undefined;
};

const unwrapProfile = (value = {}) => {
  if (!isPlainObject(value)) return {};
  if (!isPlainObject(value.profile)) return value;
  return {
    ...value.profile,
    id: value.profile.id || value.profileId || "",
  };
};

const normalizeMemberProfile = (memberId, value) => {
  const profile = unwrapProfile(value);
  return {
    memberId,
    profileId: String(profile.id || memberId),
    name: String(profile.name || "NPC"),
    identity: String(profile.identity || profile.role || "角色"),
    personality: String(profile.personality || "自然"),
    appearance: String(profile.appearance || ""),
    persona: String(profile.persona || profile.background || ""),
  };
};

const getRelationEntries = (relationships) => {
  if (relationships instanceof Map) return [...relationships.entries()];
  if (Array.isArray(relationships)) {
    return relationships.map((relation, index) => [relation?.id || String(index), relation]);
  }
  return isPlainObject(relationships) ? Object.entries(relationships) : [];
};

const normalizeRelationship = (id, relationship) => ({
  id,
  ...Object.fromEntries(
    RELATION_FIELDS
      .filter((field) => relationship[field] !== undefined)
      .map((field) => [field, relationship[field]]),
  ),
});

const getIsolatedRelationships = (relationships, members) => {
  const memberReferences = new Set();
  for (const member of members) {
    memberReferences.add(member.memberId);
    memberReferences.add(member.profileId);
  }

  return getRelationEntries(relationships)
    .filter(([, relationship]) => isPlainObject(relationship)
      && memberReferences.has(relationship.charA)
      && memberReferences.has(relationship.charB))
    .map(([id, relationship]) => normalizeRelationship(id, relationship));
};

const getIsolatedTranscript = (session, memberIds) => {
  const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
  const memberSet = new Set(memberIds);
  return transcript
    .slice(-MAX_TRANSCRIPT_ENTRIES)
    .filter((entry) => isPlainObject(entry) && memberSet.has(entry.speakerId))
    .map((entry) => ({
      speakerId: entry.speakerId,
      text: String(entry.text || ""),
    }));
};

const capReplyText = (text) => Array.from(text.trim()).slice(0, MAX_REPLY_CHARACTERS).join("");

const stripJsonFence = (raw) => raw
  .trim()
  .replace(/^```(?:json)?\s*/i, "")
  .replace(/\s*```$/, "")
  .trim();

const getChatCompletionsUrl = (baseUrl) => {
  let url = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!url.endsWith("/v1")) url += "/v1";
  return `${url}/chat/completions`;
};

export function getOfficeEndpoint(storage = getDefaultStorage()) {
  try {
    const apiState = parseConfigs(storage?.getItem?.(STORAGE_KEY));
    const endpoint = apiState.mainConfigs.find((item) => item.id === apiState.selectedMainId)
      || apiState.mainDraft;
    const model = String(endpoint?.model || endpoint?.customModel || "").trim();
    const apiKey = String(endpoint?.apiKey || "").trim();
    const baseUrl = String(endpoint?.baseUrl || "").trim();
    if (!apiKey || !baseUrl || !model) return null;
    return { ...endpoint, baseUrl, model };
  } catch {
    return null;
  }
}

export function buildOfficeConversationMessages(session = {}, profileMap = {}, relationships = {}) {
  const memberIds = getMemberIds(session);
  const members = memberIds.map((memberId) => normalizeMemberProfile(memberId, getMappedValue(profileMap, memberId)));
  const isolatedRelationships = getIsolatedRelationships(relationships, members);
  const transcript = getIsolatedTranscript(session, memberIds);
  const exampleSpeakerId = members[0]?.memberId || "";
  const responseExample = JSON.stringify({
    conversationId: session.id,
    requestSequence: session.requestSequence,
    speakerId: exampleSpeakerId,
    text: "一句简短自然的职场对话",
    end: false,
  });
  const context = {
    conversationId: session.id,
    requestSequence: session.requestSequence,
    topic: String(session.topic || "办公室日常"),
    members,
    relationships: isolatedRelationships,
    transcript,
  };

  return [
    {
      role: "system",
      content: `你正在生成一组独立办公室会话的下一句对话。只能使用当前会话上下文，不得引入其他角色、关系或聊天记录。\n直接输出一句自然、简短、符合人设的职场对话，不要写旁白、动作、Markdown 或解释。\n必须严格只返回一个 JSON 对象，且只能包含 conversationId、requestSequence、speakerId、text、end 这五个键，格式如下：\n${responseExample}\nconversationId 必须是当前会话 ID，requestSequence 必须是当前请求序号，speakerId 必须是当前成员之一，text 最多 80 个字符，end 必须是布尔值。\n当前会话上下文：\n${JSON.stringify(context)}`,
    },
    {
      role: "user",
      content: "请根据当前话题和最近对话，生成这一组办公室会话的下一句。",
    },
  ];
}

export function parseOfficeConversationReply(raw, session = {}) {
  let parsed;
  try {
    parsed = typeof raw === "string" ? JSON.parse(stripJsonFence(raw)) : raw;
  } catch {
    return null;
  }

  if (!isPlainObject(parsed)) return null;
  const keys = Object.keys(parsed);
  if (keys.length !== REPLY_KEYS.length || REPLY_KEYS.some((key) => !keys.includes(key))) return null;
  if (typeof parsed.conversationId !== "string" || parsed.conversationId !== session.id) return null;
  if (!Number.isInteger(parsed.requestSequence) || parsed.requestSequence !== session.requestSequence) return null;
  if (typeof parsed.speakerId !== "string" || !getMemberIds(session).includes(parsed.speakerId)) return null;
  if (typeof parsed.text !== "string" || !parsed.text.trim()) return null;
  if (typeof parsed.end !== "boolean") return null;

  return {
    conversationId: parsed.conversationId,
    requestSequence: parsed.requestSequence,
    speakerId: parsed.speakerId,
    text: capReplyText(parsed.text),
    end: parsed.end,
  };
}

export function getOfficeFallbackReply(session = {}, profileMap = {}) {
  const memberIds = getMemberIds(session);
  if (!memberIds.length) return null;
  const turnIndex = Number.isInteger(session.turnIndex) ? session.turnIndex : 0;
  const speakerId = memberIds[((turnIndex % memberIds.length) + memberIds.length) % memberIds.length];
  const profile = unwrapProfile(getMappedValue(profileMap, speakerId));
  const personality = String(profile.personality || "");

  let text = "听起来不错，继续说吧。";
  if (personality.includes("贪吃")) text = "说到这个，我都有点想吃东西了。";
  else if (personality.includes("游戏")) text = "忙完这段要不要来一局？";
  else if (personality.includes("外向") || personality.includes("话多")) text = "这个话题我正好也有不少想法。";
  else if (personality.includes("社恐")) text = "嗯，我先听你们说。";
  else if (personality.includes("自律")) text = "这件事我们尽快定下来吧。";

  return {
    conversationId: session.id,
    requestSequence: session.requestSequence,
    speakerId,
    text: capReplyText(text),
    end: false,
  };
}

export async function requestOfficeConversationTurn({
  session = {},
  profileMap = {},
  relationships = {},
  storage,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  const fallback = () => getOfficeFallbackReply(session, profileMap);
  const endpoint = getOfficeEndpoint(storage);
  if (!endpoint || typeof fetchImpl !== "function") return fallback();

  try {
    const response = await fetchImpl(getChatCompletionsUrl(endpoint.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${endpoint.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages: buildOfficeConversationMessages(session, profileMap, relationships),
        temperature: Number(endpoint.temperature ?? 0.7),
      }),
      signal,
    });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || "unknown"}`);
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    return parseOfficeConversationReply(raw, session) || fallback();
  } catch {
    return fallback();
  }
}
