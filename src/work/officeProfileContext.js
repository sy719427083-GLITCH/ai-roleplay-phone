const clamp01 = (value) => Math.max(0, Math.min(1, value));
const score = (text, positive, negative = []) => clamp01(
  0.5 + positive.filter((word) => text.includes(word)).length * 0.12 - negative.filter((word) => text.includes(word)).length * 0.12,
);

export function deriveOfficeAffinities(profile = {}) {
  const text = [profile.identity, profile.role, profile.personality, profile.persona, profile.background].filter(Boolean).join(" ");
  return {
    focus: score(text, ["认真", "负责", "自律", "专注", "报表", "严谨"], ["散漫", "摸鱼"]),
    social: score(text, ["开朗", "健谈", "社交", "热情", "好友"], ["少言", "内向"]),
    discipline: score(text, ["守时", "自律", "严谨", "负责"], ["摸鱼", "随性", "散漫"]),
    entertainment: score(text, ["游戏", "抖音", "娱乐", "爱玩"], ["严肃", "自律"]),
    night: score(text, ["夜猫", "熬夜", "晚睡"], ["早睡", "早起"]),
  };
}

export function readOfficeRelations(storage = window.localStorage) {
  try {
    const value = JSON.parse(storage.getItem("apiRelations") || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function relationText(value, depth = 0) {
  if (depth > 3 || value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => relationText(item, depth + 1));
  if (typeof value === "object") return Object.values(value).flatMap((item) => relationText(item, depth + 1));
  return [];
}

export function buildOfficeProfileContext(profile = {}, relations = {}) {
  const relation = relations[profile.sourceId] ?? relations[profile.id] ?? {};
  return {
    affinities: deriveOfficeAffinities(profile),
    identity: String(profile.identity || profile.role || "").slice(0, 80),
    persona: String(profile.persona || profile.background || "").slice(0, 240),
    relationshipSummary: relationText(relation).filter(Boolean).join("、").slice(0, 240),
  };
}
