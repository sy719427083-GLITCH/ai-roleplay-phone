import test from "node:test";
import assert from "node:assert/strict";
import {
  WORK_MAP_THEMES,
  buildWorkGenerationPrompt,
  getWorkTheme,
  inferWorkMapTheme,
  normalizeThemeJobs,
  resolveWorkMapView,
  withWorkMapTheme,
} from "./workThemes.js";

test("infers themed work maps from worldbook genres", () => {
  assert.equal(inferWorkMapTheme({ genre: "古代宫廷" }), "ancient_cn");
  assert.equal(inferWorkMapTheme({ genre: "东方玄幻修真" }), "xuanhuan");
  assert.equal(inferWorkMapTheme({ genre: "科幻殖民" }), "scifi");
  assert.equal(inferWorkMapTheme({ genre: "雾港悬疑" }), "modern");
});

test("only a manual theme overrides automatic worldbook inference", () => {
  assert.equal(inferWorkMapTheme({ genre: "玄幻", workMapTheme: "ancient_cn" }), "xuanhuan");
  assert.equal(inferWorkMapTheme({
    genre: "玄幻",
    workMapTheme: "ancient_cn",
    workMapThemeMode: "manual",
  }), "ancient_cn");
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

test("each illustrated map defines building-sized hit areas", () => {
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
