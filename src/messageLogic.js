const proactiveLines = [
  "你现在方便回我吗？",
  "刚才想到你，就发一条消息过来。",
  "我有点事想和你说。",
  "你今天过得怎么样？",
  "看到一件事，忽然想问问你。",
  "在吗？",
  "刚刚想起我们之前聊的事。",
  "你忙完了吗？",
];

const getCharacterName = (id, charactersById, meProfiles = {}) => {
  if (meProfiles[id]?.name) return meProfiles[id].name;
  if (charactersById[id]?.name) return charactersById[id].name;
  if (id === "__USER__") return "我";
  return "未知角色";
};

const getRelationLabel = (relation, direction) => {
  const typeKey = direction === "A" ? "typeA" : "typeB";
  const customKey = direction === "A" ? "customTypeA" : "customTypeB";
  const type = relation?.[typeKey] || relation?.type || "关系未命名";
  if (type !== "custom") return type;
  return relation?.[customKey]?.trim() || relation?.customType?.trim() || "自定义关系";
};

export const pickProactiveMessages = (character, options = {}) => {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const minute = Number.isFinite(options.minute) ? options.minute : new Date().getMinutes();
  const seed = String(character?.name || "").length + minute;
  const count = Math.min(10, Math.max(1, Math.floor(random() * 10) + 1));
  return Array.from({ length: count }, (_, index) => proactiveLines[(seed + index) % proactiveLines.length]);
};

export const PROACTIVE_MESSAGE_FREQUENCIES = {
  frequent: { label: "频繁", cooldownMs: 10 * 60 * 1000 },
  medium: { label: "中等", cooldownMs: 45 * 60 * 1000 },
  low: { label: "少量", cooldownMs: 3 * 60 * 60 * 1000 },
  none: { label: "无", cooldownMs: Infinity },
};

export const normalizeProactiveMessageSettings = (settings = {}) => {
  const frequency = PROACTIVE_MESSAGE_FREQUENCIES[settings?.frequency] ? settings.frequency : "medium";
  return {
    enabled: settings?.enabled !== false,
    quietByRealTime: settings?.quietByRealTime !== false,
    frequency,
  };
};

const getChinaTimeParts = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
};

export const buildRealTimeContext = (date = new Date()) => {
  const parts = getChinaTimeParts(date);
  return `现实时间：${parts.year}-${parts.month}-${parts.day} ${parts.weekday} ${parts.hour}:${parts.minute}（Asia/Shanghai）。角色需要据此判断早晚、工作日、深夜与是否适合主动打扰，但不要生硬报时。`;
};

export const isRealTimeQuietForProactive = (date = new Date()) => {
  const hour = Number(getChinaTimeParts(date).hour);
  return Number.isFinite(hour) && (hour >= 23 || hour < 7);
};

export const getProactiveCooldownMs = (settings = {}) => {
  const normalized = normalizeProactiveMessageSettings(settings);
  return PROACTIVE_MESSAGE_FREQUENCIES[normalized.frequency].cooldownMs;
};

export const canSendProactiveMessageNow = ({ settings = {}, lastAt = 0, now = new Date() } = {}) => {
  const normalized = normalizeProactiveMessageSettings(settings);
  if (!normalized.enabled || normalized.frequency === "none") {
    return { allowed: false, reason: "主动消息已关闭。" };
  }
  if (normalized.quietByRealTime && isRealTimeQuietForProactive(now)) {
    return { allowed: false, reason: "现在是休息时间，角色不会主动打扰。" };
  }
  const cooldownMs = getProactiveCooldownMs(normalized);
  const lastTime = Number(lastAt) || 0;
  const nowTime = now instanceof Date ? now.getTime() : Number(now) || Date.now();
  if (Number.isFinite(cooldownMs) && lastTime && nowTime - lastTime < cooldownMs) {
    const label = PROACTIVE_MESSAGE_FREQUENCIES[normalized.frequency].label;
    return { allowed: false, reason: `主动消息频率为${label}，角色还不会这么快再主动发来。` };
  }
  return { allowed: true, reason: "" };
};

export const sanitizeOnlineChatText = (text) =>
  String(text || "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\*[^*]+\*/g, "")
    .replace(/【[^】]*】/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/^\s*(旁白|动作|心理|表情)\s*[:：].*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

export const splitChatMessages = (text) => {
  const cleaned = sanitizeOnlineChatText(text);
  if (!cleaned) return [];
  return cleaned
    .split(/\n+|(?<=[。！？!?])\s+/)
    .map((part) => sanitizeOnlineChatText(part))
    .filter(Boolean);
};

export const parseRoleTransferReply = (content) => {
  const raw = String(content || "").trim();
  const transferMatch = raw.match(/(?:TRANSFER_AMOUNT|转账金额)\s*[:：]\s*¥?\s*(\d+(?:\.\d{1,2})?)/i);
  const hasTransferIntent = /(?:转账|转了|转给你|发红包|红包|发给你|打给你|给你转|我转给你|收下|碎银|银钱|银子|拿去买)/i.test(raw);
  const amountMatch = raw.match(/¥\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:块|元|rmb|RMB)/i);
  const noteMatch = raw.match(/(?:TRANSFER_NOTE|转账备注)\s*[:：]\s*(.+)$/im);
  const cleaned = raw
    .replace(/(?:TRANSFER_AMOUNT|转账金额)\s*[:：]\s*¥?\s*\d+(?:\.\d{1,2})?/gi, "")
    .replace(/(?:TRANSFER_NOTE|转账备注)\s*[:：]\s*.+$/gim, "")
    .trim();
  const amount = transferMatch
    ? Number(transferMatch[1])
    : hasTransferIntent && amountMatch
      ? Number(amountMatch[1] || amountMatch[2])
      : hasTransferIntent
        ? 66
        : 0;
  const messages = splitChatMessages(cleaned || (amount > 0 ? "给你转了一笔钱。" : raw));
  return {
    text: messages[0] || "",
    messages,
    transfer: amount > 0 ? { amount, note: noteMatch?.[1]?.trim() || "角色转账" } : null,
  };
};

export const buildMeProfileChatContext = (profile = {}) => {
  const name = String(profile?.name || "").trim();
  const identity = String(profile?.identity || profile?.role || "").trim();
  const appearance = String(profile?.appearance || "").trim();
  const personality = String(profile?.personality || "").trim();
  const persona = String(profile?.persona || profile?.background || "").trim();
  const lines = [
    `聊天对象：${name || "我"}`,
    identity ? `身份：${identity}` : "",
    appearance ? `外貌：${appearance}` : "",
    personality ? `性格：${personality}` : "",
    persona ? `背景：${persona}` : "",
  ].filter(Boolean);
  return `你正在和以下“我 APP”身份聊天：\n${lines.join("\n")}`;
};

const createCommentId = (prefix, idSeed = "") => (
  idSeed ? `${prefix}-${idSeed}` : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
);

export const getMomentReplyDelayMs = ({ random = Math.random } = {}) => {
  const safeRandom = typeof random === "function" ? random : Math.random;
  return (3 * 60 * 1000) + Math.floor(safeRandom() * 3 * 60 * 1000);
};

export const buildMomentUserComment = ({ text, replyTarget = null, now = () => new Date().toISOString(), idSeed = "" } = {}) => {
  const cleanText = String(text || "").trim();
  if (!cleanText) return null;
  const replyTo = String(replyTarget?.author || replyTarget?.characterName || "").trim();
  return {
    id: createCommentId("comment", idSeed),
    author: "我",
    text: cleanText,
    createdAt: now(),
    ...(replyTo ? { replyTo, replyVerb: "回复" } : {}),
  };
};

export const buildMomentRoleReplyComment = ({
  replyText,
  characterName = "角色",
  replyTo = "我",
  now = () => new Date().toISOString(),
  idSeed = "",
} = {}) => {
  const cleanText = String(replyText || "").trim();
  if (!cleanText) return null;
  return {
    id: createCommentId("comment", idSeed || "reply"),
    author: characterName || "角色",
    text: cleanText,
    replyTo,
    replyVerb: "回复",
    createdAt: now(),
  };
};

export const buildMomentLikeNames = (moment = {}) => {
  const names = [
    ...(moment.liked ? ["我"] : []),
    ...(Array.isArray(moment.likeNames) ? moment.likeNames : []),
    ...(Array.isArray(moment.likes) ? moment.likes : []),
  ].map((name) => String(name || "").trim()).filter(Boolean);
  return [...new Set(names)];
};

const formatMomentCommentForContext = (comment = {}) => {
  const author = comment.author || "未知";
  const replyText = comment.replyTo ? ` 回复 ${comment.replyTo}` : "";
  return `${author}${replyText}：${comment.text || ""}`;
};

export const buildCharacterMomentContext = ({ characterId, momentState = {} } = {}) => {
  if (!characterId) return "";
  const moments = (Array.isArray(momentState.items) ? momentState.items : [])
    .filter((moment) => moment?.characterId === characterId)
    .slice(-5);
  if (!moments.length) return "";
  const lines = moments.flatMap((moment) => {
    const base = `${moment.characterName || "角色"}发布：${moment.text || ""}`;
    const comments = (Array.isArray(moment.comments) ? moment.comments : [])
      .slice(-12)
      .map((comment) => `- ${formatMomentCommentForContext(comment)}`);
    return comments.length ? [base, "评论：", ...comments] : [base];
  });
  return `你能记得并知道自己发过的朋友圈内容和其评论，但不知道其他角色发的朋友圈。\n${lines.join("\n")}`;
};

export const buildRelationshipContext = ({ character, characters = [], meProfiles = {}, relations = {} } = {}) => {
  if (!character?.id) return "暂无明确关系列表。";
  const charactersById = Object.fromEntries(characters.map((item) => [item.id, item]));
  const lines = Object.values(relations || {})
    .filter((relation) => relation?.charA === character.id || relation?.charB === character.id)
    .flatMap((relation) => {
      const nameA = getCharacterName(relation.charA, charactersById, meProfiles);
      const nameB = getCharacterName(relation.charB, charactersById, meProfiles);
      const lineA = `${nameA} 对 ${nameB}：${getRelationLabel(relation, "A")}${relation.viewA ? `。认知：${relation.viewA}` : ""}`;
      const lineB = `${nameB} 对 ${nameA}：${getRelationLabel(relation, "B")}${relation.viewB ? `。认知：${relation.viewB}` : ""}`;
      return [lineA, lineB];
    });

  return lines.length
    ? `关系列表与关系认知：\n${lines.join("\n")}`
    : "暂无明确关系列表。";
};

const getWorldKey = (character = {}) => String(character.worldbookId || character.worldId || character.worldview || "").trim();

export const buildWorldbookContext = ({ character, worlds = [], characters = [] } = {}) => {
  const worldKey = getWorldKey(character);
  if (!worldKey) return "世界书：暂无关联。";
  const world = worlds.find((item) => item?.id === worldKey || item?.name === worldKey || item?.genre === worldKey);
  if (!world) return `世界书：${worldKey}`;
  const sameWorldCharacters = characters
    .filter((item) => item?.id && item.id !== character?.id)
    .filter((item) => {
      const key = getWorldKey(item);
      return key === world.id || key === world.name || key === world.genre;
    })
    .slice(0, 8)
    .map((item) => `${item.name || "未命名角色"}（${item.identity || item.role || "角色"}）`);
  const parts = [
    `世界书：${world.name || world.id}`,
    world.genre ? `世界类型：${world.genre}` : "",
    world.tone ? `世界简介：${world.tone}` : "",
    sameWorldCharacters.length ? `同世界角色：${sameWorldCharacters.join("、")}` : "同世界角色：暂无其他已同步角色。",
  ].filter(Boolean);
  return parts.join("\n");
};
