import assert from "node:assert/strict";
import test from "node:test";
import {
  WORLD_TAGS,
  normalizeWorldTags,
  resolveWorldTagSelection,
  serializeWorldGenre,
  toggleWorldTag,
} from "./worldTags.js";

test("lists the 25 world tags in approved historical order", () => {
  assert.deepEqual(WORLD_TAGS, [
    "上古", "古代", "西域", "仙侠", "玄幻", "秘境", "地府幽冥", "中世纪", "西幻", "奇幻",
    "魔法世界", "魔法学院", "海岛", "海洋", "民国", "港风", "现代", "校园", "冰河时代", "废土末世",
    "赛博朋克", "科幻星际", "外星文明", "网游", "克苏鲁",
  ]);
});

test("migrates legacy genres split by supported separators and matches concrete tags", () => {
  assert.deepEqual(
    normalizeWorldTags({ genre: "科幻星际 / 古代、玄幻·海洋,港风，校园" }),
    ["古代", "玄幻", "海洋"],
  );
  assert.deepEqual(normalizeWorldTags({ genre: "古代宫廷" }), ["古代"]);
  assert.deepEqual(normalizeWorldTags({ genre: "高魔史诗" }), ["现代"]);
});

test("uses valid tags as authoritative, removes duplicates, and serializes selected tags", () => {
  const tags = normalizeWorldTags({
    tags: ["校园", "古代", "校园", "科幻星际", "玄幻"],
    genre: "海洋",
  });

  assert.deepEqual(tags, ["古代", "玄幻", "校园"]);
  assert.equal(serializeWorldGenre(tags), "古代/玄幻/校园");
});

test("recovers empty or invalid stored tags from legacy genre or the default tag", () => {
  assert.deepEqual(normalizeWorldTags({ tags: [], genre: "古代" }), ["古代"]);
  assert.deepEqual(normalizeWorldTags({ tags: ["不存在"], genre: "玄幻" }), ["玄幻"]);
  assert.deepEqual(normalizeWorldTags({ tags: [], genre: "高魔史诗" }), ["现代"]);
});

test("toggles only valid tags and never selects more than three", () => {
  let tags = toggleWorldTag([], "校园", 3);
  tags = toggleWorldTag(tags, "古代", 3);
  tags = toggleWorldTag(tags, "玄幻", 3);

  assert.deepEqual(tags, ["古代", "玄幻", "校园"]);
  assert.deepEqual(toggleWorldTag(tags, "科幻星际", 3), tags);
  assert.deepEqual(toggleWorldTag(tags, "玄幻", 3), ["古代", "校园"]);
  assert.deepEqual(toggleWorldTag(["古代"], "不存在", 3), ["古代"]);
});

test("restores a persisted tag when it still belongs to the selected world", () => {
  const world = { tags: ["玄幻", "现代", "校园"] };
  assert.equal(resolveWorldTagSelection(world, "校园"), "校园");
  assert.equal(resolveWorldTagSelection(world, "赛博朋克"), "玄幻");
});
