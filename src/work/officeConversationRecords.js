const MAX_TEXT_CHARACTERS = 80;
const RECORD_KEYS = [
  "conversationId", "workSessionId", "sceneId", "locationId", "topic",
  "participantSnapshots", "startedAt", "endedAt", "transcript",
];

const isPlainObject = (value) => {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

const read = (value, key) => {
  try { return value?.[key]; } catch { return undefined; }
};

const cloneValue = (value, seen = new WeakSet()) => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const cloned = [];
      for (let index = 0; index < value.length; index += 1) cloned.push(cloneValue(value[index], seen));
      return cloned;
    }
    if (!isPlainObject(value)) return null;
    const cloned = {};
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) return null;
      cloned[key] = cloneValue(descriptor.value, seen);
    }
    return cloned;
  } catch {
    return null;
  } finally {
    seen.delete(value);
  }
};

const text = (value) => (typeof value === "string" ? value.trim() : "");
const cappedText = (value) => Array.from(text(value)).slice(0, MAX_TEXT_CHARACTERS).join("");
const finiteTime = (value) => (Number.isFinite(value) ? value : null);

const normalizeSnapshots = (snapshots) => {
  if (!Array.isArray(snapshots) || !snapshots.length) return null;
  const memberIds = new Set();
  const normalized = [];
  for (const snapshot of snapshots) {
    if (!isPlainObject(snapshot)) return null;
    const memberId = text(read(snapshot, "memberId"));
    if (!memberId || memberIds.has(memberId)) return null;
    const cloned = cloneValue(snapshot);
    if (!cloned || typeof cloned !== "object") return null;
    cloned.memberId = memberId;
    memberIds.add(memberId);
    normalized.push(cloned);
  }
  return { memberIds, snapshots: normalized };
};

const normalizeTranscript = (transcript, memberIds, conversationId) => {
  if (!Array.isArray(transcript)) return null;
  const normalized = [];
  for (const entry of transcript) {
    if (!isPlainObject(entry)) return null;
    const entryConversationId = read(entry, "conversationId");
    if (entryConversationId !== undefined && entryConversationId !== conversationId) return null;
    const speakerId = text(read(entry, "speakerId"));
    const entryText = cappedText(read(entry, "text"));
    if (!memberIds.has(speakerId) || !entryText) return null;
    normalized.push({ speakerId, text: entryText });
  }
  return normalized;
};

const normalizedShape = (value) => {
  if (!isPlainObject(value) || read(value, "activityType") !== undefined || read(value, "eventId") !== undefined) return null;
  const conversationId = text(read(value, "conversationId"));
  const workSessionId = text(read(value, "workSessionId"));
  const sceneId = text(read(value, "sceneId"));
  const locationId = text(read(value, "locationId"));
  const topic = cappedText(read(value, "topic"));
  const startedAt = finiteTime(read(value, "startedAt"));
  const endedAt = finiteTime(read(value, "endedAt"));
  const snapshotResult = normalizeSnapshots(read(value, "participantSnapshots"));
  if (!conversationId || !sceneId || !locationId || !topic || startedAt === null || endedAt === null || endedAt < startedAt || !snapshotResult) return null;
  const transcript = normalizeTranscript(read(value, "transcript"), snapshotResult.memberIds, conversationId);
  if (!transcript) return null;
  return {
    conversationId,
    workSessionId,
    sceneId,
    locationId,
    topic,
    participantSnapshots: snapshotResult.snapshots,
    startedAt,
    endedAt,
    transcript,
  };
};

const normalizeLegacyRecord = (value) => {
  if (!isPlainObject(value)) return null;
  if (read(value, "activityType") !== undefined || read(value, "eventId") !== undefined) return null;
  const conversationId = text(read(value, "conversationId") ?? read(value, "id"));
  const memberIds = Array.isArray(read(value, "memberIds"))
    ? read(value, "memberIds")
    : Array.isArray(read(value, "members")) ? read(value, "members") : null;
  const transcript = read(value, "transcript");
  if (!conversationId || !memberIds?.length || !Array.isArray(transcript)) return null;
  const participantSnapshots = memberIds.map((member) => ({ memberId: text(typeof member === "string" ? member : read(member, "memberId")) }));
  if (participantSnapshots.some(({ memberId }) => !memberId)) return null;
  return normalizedShape({
    conversationId,
    workSessionId: text(read(value, "workSessionId")),
    sceneId: text(read(value, "sceneId")) || "office",
    locationId: text(read(value, "locationId")) || text(read(value, "anchorId")) || "legacy",
    topic: text(read(value, "topic")) || "办公室日常",
    participantSnapshots,
    startedAt: finiteTime(read(value, "startedAt")) ?? 0,
    endedAt: finiteTime(read(value, "endedAt")) ?? finiteTime(read(value, "startedAt")) ?? 0,
    transcript,
  });
};

export function normalizeConversationRecord(value) {
  try { return normalizedShape(value); } catch { return null; }
}

export function appendConversationRecord(records, record) {
  try {
    const normalized = normalizeConversationRecord(record);
    const current = Array.isArray(records) ? records.map(normalizeConversationRecord).filter(Boolean) : [];
    if (!normalized || current.some((item) => item.conversationId === normalized.conversationId)) return records;
    return [...current, normalized];
  } catch {
    return records;
  }
}

export function serializeConversationRecords(records) {
  try {
    const normalized = Array.isArray(records) ? records.map(normalizeConversationRecord).filter(Boolean) : [];
    return JSON.stringify(normalized);
  } catch {
    return "[]";
  }
}

export function restoreConversationRecords(raw) {
  try {
    let parsed = raw;
    if (typeof raw === "string") parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : (isPlainObject(parsed) && Array.isArray(read(parsed, "conversationRecords"))
      ? read(parsed, "conversationRecords") : []);
    const result = [];
    for (const candidate of records) {
      const record = normalizeConversationRecord(candidate) || normalizeLegacyRecord(candidate);
      if (record && !result.some((item) => item.conversationId === record.conversationId)) result.push(record);
    }
    return result;
  } catch {
    return [];
  }
}

export const OFFICE_CONVERSATION_RECORD_KEYS = Object.freeze([...RECORD_KEYS]);
