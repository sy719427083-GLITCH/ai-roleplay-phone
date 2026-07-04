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
  const count = Math.min(5, Math.max(1, Math.floor(random() * 5) + 1));
  return Array.from({ length: count }, (_, index) => proactiveLines[(seed + index) % proactiveLines.length]);
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
