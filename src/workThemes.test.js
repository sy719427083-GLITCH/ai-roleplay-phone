import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import * as workThemes from "./workThemes.js";

const {
  TAG_WORK_THEME_IDS,
  WORK_MAP_THEMES,
  buildWorkGenerationPrompt,
  getThemeIdForTag,
  getWorkTheme,
  inferWorkMapTheme,
  normalizeThemeJobs,
  resolveDisplayedWorkJob,
  resolveWorkMapView,
  withWorkMapTheme,
} = workThemes;

const APPROVED_WORLD_TAGS = [
  "上古", "古代", "西域", "仙侠", "玄幻", "秘境", "地府幽冥", "中世纪", "西幻", "奇幻",
  "魔法世界", "魔法学院", "海岛", "海洋", "民国", "港风", "现代", "校园", "冰河时代", "废土末世",
  "赛博朋克", "科幻星际", "外星文明", "网游", "克苏鲁",
];

const hitAreaSignature = (theme) => theme.places
  .map(({ hitArea }) => [hitArea.x, hitArea.y, hitArea.width, hitArea.height].join(":"))
  .join("|");

test("every approved world tag resolves to a distinct five-place work theme", () => {
  assert.equal(typeof TAG_WORK_THEME_IDS, "object");
  assert.equal(typeof getThemeIdForTag, "function");
  assert.deepEqual(Object.keys(TAG_WORK_THEME_IDS), APPROVED_WORLD_TAGS);
  assert.equal(Object.keys(WORK_MAP_THEMES).length, APPROVED_WORLD_TAGS.length);

  for (const tag of APPROVED_WORLD_TAGS) {
    const themeId = getThemeIdForTag(tag);
    const theme = getWorkTheme(themeId);
    assert.ok(themeId);
    assert.equal(theme.tag, tag);
    assert.equal(theme.places.length, 5);
    assert.equal(new Set(theme.places.map((place) => place.type)).size, 5);
    assert.equal(new Set(theme.places.map((place) => place.name)).size, 5);
    assert.ok(theme.places.every((place) => place.title && place.content && place.pin && place.hitArea));
  }

  assert.equal(
    new Set(Object.values(WORK_MAP_THEMES).map((theme) => theme.asset)).size,
    APPROVED_WORLD_TAGS.length,
  );
  assert.equal(
    new Set(Object.values(WORK_MAP_THEMES).map(hitAreaSignature)).size,
    APPROVED_WORLD_TAGS.length,
  );
});

test("explicit tag selection and legacy theme ids resolve to tag-addressable maps", () => {
  assert.equal(inferWorkMapTheme({ tags: ["古代", "赛博朋克"] }, "赛博朋克"), "cyberpunk");
  assert.equal(inferWorkMapTheme({ workMapThemeMode: "manual", workMapTheme: "ancient_cn" }), "ancient");
  assert.equal(getWorkTheme("scifi").tag, "科幻星际");
});

test("manual legacy themes outrank stored tags unless an explicit tag is selected", () => {
  const world = {
    tags: ["赛博朋克", "科幻星际"],
    workMapThemeMode: "manual",
    workMapTheme: "ancient_cn",
  };
  assert.equal(inferWorkMapTheme(world), "ancient");
  assert.equal(inferWorkMapTheme(world, "赛博朋克"), "cyberpunk");
});

test("infers themed work maps from worldbook genres", () => {
  assert.equal(inferWorkMapTheme({ genre: "古代宫廷" }), "ancient");
  assert.equal(inferWorkMapTheme({ genre: "东方玄幻修真" }), "xuanhuan");
  assert.equal(inferWorkMapTheme({ genre: "科幻殖民" }), "scifi");
  assert.equal(inferWorkMapTheme({ genre: "雨夜悬疑" }), "modern");
});

test("only a manual theme overrides automatic worldbook inference", () => {
  assert.equal(inferWorkMapTheme({ genre: "玄幻", workMapTheme: "ancient_cn" }), "xuanhuan");
  assert.equal(inferWorkMapTheme({
    genre: "玄幻",
    workMapTheme: "ancient_cn",
    workMapThemeMode: "manual",
  }), "ancient");
  assert.equal(withWorkMapTheme({ id: "world-a", genre: "高魔史诗" }).workMapTheme, "xuanhuan");
  assert.equal(withWorkMapTheme({ id: "world-a", genre: "高魔史诗" }).workMapThemeMode, "auto");
});

test("automatic themes are recalculated when the worldbook genre changes", () => {
  const modern = withWorkMapTheme({ id: "world-a", genre: "现代都市" });
  const xuanhuan = withWorkMapTheme({ ...modern, genre: "东方玄幻修真" });
  assert.equal(xuanhuan.workMapTheme, "xuanhuan");
});

test("switching worldbooks resolves a new theme and image immediately", () => {
  const worlds = [
    { id: "city", genre: "现代都市" },
    { id: "cultivation", genre: "东方玄幻修真" },
  ];
  const city = resolveWorkMapView(worlds, "city", "worldbook");
  const cultivation = resolveWorkMapView(worlds, "cultivation", "worldbook");
  assert.equal(city.themeId, "modern");
  assert.equal(cultivation.themeId, "xuanhuan");
  assert.notEqual(city.theme.asset, cultivation.theme.asset);
  assert.equal(cultivation.selectedWorld.id, "cultivation");
});

test("each work map defines building-sized hit areas", () => {
  for (const theme of Object.values(WORK_MAP_THEMES)) {
    assert.equal(theme.places.length, 5);
    for (const place of theme.places) {
      assert.ok(place.hitArea.width >= 14);
      assert.ok(place.hitArea.height >= 8);
      assert.ok(place.hitArea.x >= 0 && place.hitArea.x <= 100);
      assert.ok(place.hitArea.y >= 0 && place.hitArea.y <= 100);
    }
  }
});

test("every work map and building outline asset exists", () => {
  for (const theme of Object.values(WORK_MAP_THEMES)) {
    const mapUrl = new URL(`../public/work-map-assets/${theme.asset}`, import.meta.url);
    assert.ok(existsSync(mapUrl), `missing map asset: ${theme.asset}`);
    assert.ok(statSync(mapUrl).size > 1000, `empty map asset: ${theme.asset}`);
    for (const place of theme.places) {
      const outlineName = `${theme.id}-${place.type}.png`;
      const outlineUrl = new URL(`../public/work-map-outlines/${outlineName}`, import.meta.url);
      assert.ok(existsSync(outlineUrl), `missing outline asset: ${outlineName}`);
      assert.ok(statSync(outlineUrl).size > 100, `empty outline asset: ${outlineName}`);
    }
  }
});

test("replaces work that does not belong to the selected theme", () => {
  const fallback = () => ({ placeType: "alchemy", title: "整理丹方" });
  const jobs = normalizeThemeJobs([{ placeType: "cafe", title: "咖啡馆整理" }], "xuanhuan", fallback);
  assert.equal(jobs[0].placeType, "alchemy");
  assert.equal(jobs[0].title, "整理丹方");
});

test("theme normalization preserves supported places and assigns stable pins", () => {
  const jobs = normalizeThemeJobs([
    { placeType: "bookstore", title: "新书上架", durationMinutes: 90, reward: 70, level: 2 },
  ], "modern", () => null);
  assert.equal(jobs[0].placeType, "bookstore");
  assert.deepEqual(jobs[0].pin, getWorkTheme("modern").places[0].pin);
  assert.equal(jobs[0].placeName, "书店");
});

test("xuanhuan API prompt lists only xuanhuan locations", () => {
  const prompt = buildWorkGenerationPrompt({
    world: { name: "云澜界", genre: "玄幻", tone: "清灵仙境" },
    themeId: "xuanhuan",
  });
  assert.match(prompt, /炼丹阁/);
  assert.match(prompt, /云澜界/);
  assert.doesNotMatch(prompt, /咖啡馆/);
});

test("completed work remains displayable after browsing another tag map", () => {
  const completedJob = { key: "old-job", title: "已完成工作" };
  const currentJobs = [{ key: "new-job", title: "新地图工作" }];
  assert.equal(resolveDisplayedWorkJob(currentJobs, "", { jobKey: "old-job", job: completedJob }, true), completedJob);
  assert.equal(resolveDisplayedWorkJob(currentJobs, "new-job", { jobKey: "old-job", job: completedJob }, true), currentJobs[0]);
});
