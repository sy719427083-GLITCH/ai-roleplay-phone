import { createLocalActivityDetail } from "./officeActivities.js";
import { getOfficeEndpoint } from "./officeConversationApi.js";

const MAX_DETAIL_CHARACTERS = 120;
const DETAIL_KEYS = [
  "eventId",
  "activityType",
  "requestSequence",
  "title",
  "subject",
  "summary",
  "insightOrResult",
];

const DETAIL_FIELDS = {
  working: ["任务", "过程", "成果"],
  slacking: ["摸鱼内容", "细节", "反应"],
  eating: ["食物名称", "用餐细节", "反应"],
  gaming: ["游戏或类型", "发生的事", "结果"],
  reading: ["书名", "阅读内容", "启示"],
  watchingSeries: ["剧名", "当前情节", "角色感想"],
  watchingShortVideo: ["视频主题", "内容", "角色反应"],
  chatting: ["聊天主题", "具体内容", "角色反应"],
};

const isPlainObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getChatCompletionsUrl = (baseUrl) => {
  let url = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!url.endsWith("/v1")) url += "/v1";
  return `${url}/chat/completions`;
};

const stripJsonFence = (raw) => raw
  .trim()
  .replace(/^```(?:json)?\s*/i, "")
  .replace(/\s*```$/, "")
  .trim();

const capDetailText = (value) => {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, MAX_DETAIL_CHARACTERS).join("");
};

const withFallbackStatus = (event) => ({
  ...createLocalActivityDetail(event),
  detailStatus: "fallback",
});

export function buildOfficeActivityMessages(event = {}) {
  try {
    const context = {
      eventId: event.eventId,
      activityType: event.activityType,
      requestSequence: event.requestSequence,
      profiles: Array.isArray(event.profileSnapshots) ? event.profileSnapshots : [],
      requiredMeaning: DETAIL_FIELDS[event.activityType] || DETAIL_FIELDS.working,
    };

    return [{
      role: "system",
      content: `根据角色档案补全当前办公室活动。内容必须符合角色性格、身份、背景和语言习惯，不得改变 activityType。只返回 eventId、activityType、requestSequence、title、subject、summary、insightOrResult 七个键的 JSON。\n${JSON.stringify(context)}`,
    }, {
      role: "user",
      content: "生成本次活动的具体记录。",
    }];
  } catch {
    return [];
  }
}

export function parseOfficeActivityReply(raw, event = {}) {
  try {
    const parsed = typeof raw === "string" ? JSON.parse(stripJsonFence(raw)) : raw;
    if (!isPlainObject(parsed)) return null;

    const keys = Object.keys(parsed);
    if (keys.length !== DETAIL_KEYS.length || DETAIL_KEYS.some((key) => !keys.includes(key))) return null;
    if (typeof parsed.eventId !== "string" || parsed.eventId !== String(event.eventId || "")) return null;
    if (parsed.activityType !== event.activityType) return null;
    if (!Number.isInteger(parsed.requestSequence) || parsed.requestSequence !== Number(event.requestSequence)) return null;

    const title = capDetailText(parsed.title);
    const subject = capDetailText(parsed.subject);
    const summary = capDetailText(parsed.summary);
    const insightOrResult = capDetailText(parsed.insightOrResult);
    if (!title || !subject || !summary || !insightOrResult) return null;

    return {
      eventId: parsed.eventId,
      activityType: parsed.activityType,
      requestSequence: parsed.requestSequence,
      title,
      subject,
      summary,
      insightOrResult,
    };
  } catch {
    return null;
  }
}

export async function requestOfficeActivityDetail(options = {}) {
  let fallback = null;
  try {
    if (!isPlainObject(options)) return null;
    const event = isPlainObject(options.event) ? options.event : {};
    fallback = withFallbackStatus(event);
    const fetchImpl = options.fetchImpl === undefined ? globalThis.fetch : options.fetchImpl;
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
        messages: buildOfficeActivityMessages(event),
        temperature: Number(endpoint.temperature ?? 0.7),
      }),
      signal: options.signal,
    });
    if (!response?.ok) throw new Error(`HTTP ${response?.status || "unknown"}`);
    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? parseOfficeActivityReply(raw, event) : null;
    return parsed ? { ...parsed, detailStatus: "complete" } : fallback;
  } catch {
    return fallback;
  }
}
