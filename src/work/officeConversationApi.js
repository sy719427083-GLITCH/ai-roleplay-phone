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

const getSessionId = (session) => {
  try {
    return isPlainObject(session) && typeof session.id === "string" ? session.id : "";
  } catch {
    return "";
  }
};

const getRequestSequence = (session) => {
  try {
    return isPlainObject(session) && Number.isInteger(session.requestSequence)
      ? session.requestSequence
      : null;
  } catch {
    return null;
  }
};

const getDefaultStorage = () => {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
};

const getMemberIds = (session) => {
  try {
    return isPlainObject(session) && Array.isArray(session.memberIds)
      ? [...new Set(session.memberIds.filter((memberId) => typeof memberId === "string" && memberId.trim()))]
      : [];
  } catch {
    return [];
  }
};

const getUsableSession = (session) => {
  if (!isPlainObject(session)) return null;
  const id = getSessionId(session);
  const requestSequence = getRequestSequence(session);
  const memberIds = getMemberIds(session);
  if (!id.trim() || requestSequence === null || !memberIds.length) return null;
  return { id, requestSequence, memberIds };
};

const sanitizePromptText = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;
  const sanitized = value.replace(/\s+/g, " ").trim();
  return sanitized || fallback;
};

const getCurrentActivity = (session) => {
  try {
    const promptContext = isPlainObject(session?.promptContext) ? session.promptContext : {};
    const candidates = [session?.currentActivity, session?.activity, promptContext.activity];
    for (const candidate of candidates) {
      const activity = sanitizePromptText(candidate);
      if (activity) return activity;
    }
  } catch {
    return "chatting";
  }
  return "chatting";
};

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

const getIsolatedTranscript = (session, sessionId, memberIds) => {
  const transcript = Array.isArray(session?.transcript) ? session.transcript : [];
  const memberSet = new Set(memberIds);
  return transcript
    .filter((entry) => isPlainObject(entry)
      && memberSet.has(entry.speakerId)
      && (!Object.hasOwn(entry, "conversationId") || entry.conversationId === sessionId))
    .slice(-MAX_TRANSCRIPT_ENTRIES)
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
    return { ...endpoint, apiKey, baseUrl, model };
  } catch {
    return null;
  }
}

export function buildOfficeConversationMessages(session = {}, profileMap = {}, relationships = {}) {
  try {
    const safeSession = isPlainObject(session) ? session : {};
    const conversationId = getSessionId(safeSession);
    const requestSequence = getRequestSequence(safeSession) ?? 0;
    const memberIds = getMemberIds(safeSession);
    const members = memberIds.map((memberId) => normalizeMemberProfile(memberId, getMappedValue(profileMap, memberId)));
    const isolatedRelationships = getIsolatedRelationships(relationships, members);
    const transcript = getIsolatedTranscript(safeSession, conversationId, memberIds);
    const exampleSpeakerId = members[0]?.memberId || "";
    const responseExample = JSON.stringify({
      conversationId,
      requestSequence,
      speakerId: exampleSpeakerId,
      text: "一句简短自然的职场对话",
      end: false,
    });
    const context = {
      conversationId,
      requestSequence,
      topic: sanitizePromptText(safeSession.topic, "办公室日常"),
      currentActivity: getCurrentActivity(safeSession),
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
  } catch {
    return [];
  }
}

export function parseOfficeConversationReply(raw, session = {}) {
  try {
    const usableSession = getUsableSession(session);
    if (!usableSession) return null;
    const parsed = typeof raw === "string" ? JSON.parse(stripJsonFence(raw)) : raw;

    if (!isPlainObject(parsed)) return null;
    const keys = Object.keys(parsed);
    if (keys.length !== REPLY_KEYS.length || REPLY_KEYS.some((key) => !keys.includes(key))) return null;
    if (typeof parsed.conversationId !== "string" || parsed.conversationId !== usableSession.id) return null;
    if (!Number.isInteger(parsed.requestSequence) || parsed.requestSequence !== usableSession.requestSequence) return null;
    if (typeof parsed.speakerId !== "string" || !usableSession.memberIds.includes(parsed.speakerId)) return null;
    if (typeof parsed.text !== "string" || !parsed.text.trim()) return null;
    if (typeof parsed.end !== "boolean") return null;

    return {
      conversationId: parsed.conversationId,
      requestSequence: parsed.requestSequence,
      speakerId: parsed.speakerId,
      text: capReplyText(parsed.text),
      end: parsed.end,
    };
  } catch {
    return null;
  }
}

export function getOfficeFallbackReply(session = {}, profileMap = {}) {
  try {
    const usableSession = getUsableSession(session);
    if (!usableSession) return null;
    const turnIndex = Number.isInteger(session.turnIndex) ? session.turnIndex : 0;
    const speakerId = usableSession.memberIds[
      ((turnIndex % usableSession.memberIds.length) + usableSession.memberIds.length) % usableSession.memberIds.length
    ];
    const profile = unwrapProfile(getMappedValue(profileMap, speakerId));
    const personality = typeof profile.personality === "string" ? profile.personality : "";

    let text = "听起来不错，继续说吧。";
    if (personality.includes("贪吃")) text = "说到这个，我都有点想吃东西了。";
    else if (personality.includes("游戏")) text = "忙完这段要不要来一局？";
    else if (personality.includes("外向") || personality.includes("话多")) text = "这个话题我正好也有不少想法。";
    else if (personality.includes("社恐")) text = "嗯，我先听你们说。";
    else if (personality.includes("自律")) text = "这件事我们尽快定下来吧。";

    return {
      conversationId: usableSession.id,
      requestSequence: usableSession.requestSequence,
      speakerId,
      text: capReplyText(text),
      end: false,
    };
  } catch {
    return null;
  }
}

export async function requestOfficeConversationTurn(options = {}) {
  let fallback = null;
  try {
    if (!isPlainObject(options)) return null;
    const session = options.session;
    if (!getUsableSession(session)) return null;
    const profileMap = options.profileMap ?? {};
    const relationships = options.relationships ?? {};
    const fetchImpl = options.fetchImpl === undefined ? globalThis.fetch : options.fetchImpl;
    fallback = getOfficeFallbackReply(session, profileMap);
    if (!fallback) return null;

    const endpoint = getOfficeEndpoint(options.storage);
    if (!endpoint || typeof fetchImpl !== "function") return fallback;
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
      signal: options.signal,
    });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || "unknown"}`);
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    return (typeof raw === "string" ? parseOfficeConversationReply(raw, session) : null) || fallback;
  } catch {
    return fallback;
  }
}
