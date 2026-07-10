import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkGenerationPrompt,
  getWorkTheme,
  inferWorkMapTheme,
  normalizeThemeJobs,
  withWorkMapTheme,
} from "./workThemes.js";

test("infers themed work maps from worldbook genres", () => {
  assert.equal(inferWorkMapTheme({ genre: "古代宫廷" }), "ancient_cn");
  assert.equal(inferWorkMapTheme({ genre: "东方玄幻修真" }), "xuanhuan");
  assert.equal(inferWorkMapTheme({ genre: "科幻殖民" }), "scifi");
  assert.equal(inferWorkMapTheme({ genre: "雾港悬疑" }), "modern");
});

test("an explicit valid theme overrides automatic worldbook inference", () => {
  assert.equal(inferWorkMapTheme({ genre: "玄幻", workMapTheme: "ancient_cn" }), "ancient_cn");
  assert.equal(withWorkMapTheme({ id: "world-a", genre: "高魔史诗" }).workMapTheme, "xuanhuan");
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
