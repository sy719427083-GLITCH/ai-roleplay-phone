export const WORLD_TAGS = Object.freeze([
  "上古",
  "古代",
  "西域",
  "仙侠",
  "玄幻",
  "秘境",
  "地府幽冥",
  "中世纪",
  "西幻",
  "奇幻",
  "魔法世界",
  "魔法学院",
  "海岛",
  "海洋",
  "民国",
  "港风",
  "现代",
  "校园",
  "冰河时代",
  "废土末世",
  "赛博朋克",
  "科幻星际",
  "外星文明",
  "网游",
  "克苏鲁",
]);

const DEFAULT_WORLD_TAG = "现代";
const WORLD_TAG_LIMIT = 3;

const normalizeLimit = (limit) => {
  const value = Number(limit);
  if (!Number.isFinite(value)) return WORLD_TAG_LIMIT;
  return Math.max(0, Math.min(WORLD_TAG_LIMIT, Math.floor(value)));
};

const orderWorldTags = (tags, limit = WORLD_TAG_LIMIT) => {
  const selected = new Set((Array.isArray(tags) ? tags : []).filter((tag) => WORLD_TAGS.includes(tag)));
  return WORLD_TAGS.filter((tag) => selected.has(tag)).slice(0, normalizeLimit(limit));
};

const parseLegacyGenre = (genre) => String(genre || "")
  .split(/[\/、·,，\s]+/)
  .flatMap((part) => WORLD_TAGS.filter((tag) => part.includes(tag)));

export const normalizeWorldTags = (world = {}) => {
  const selected = orderWorldTags(world.tags);
  if (selected.length) return selected;

  const migrated = orderWorldTags(parseLegacyGenre(world.genre));
  return migrated.length ? migrated : [DEFAULT_WORLD_TAG];
};

export const serializeWorldGenre = (tags) => orderWorldTags(tags).join("/");

export const toggleWorldTag = (tags, tag, limit = WORLD_TAG_LIMIT) => {
  const selected = orderWorldTags(tags, limit);
  if (!WORLD_TAGS.includes(tag)) return selected;
  if (selected.includes(tag)) return selected.filter((selectedTag) => selectedTag !== tag);
  if (selected.length >= normalizeLimit(limit)) return selected;
  return orderWorldTags([...selected, tag], limit);
};
