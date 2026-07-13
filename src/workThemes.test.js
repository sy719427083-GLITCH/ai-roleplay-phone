import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";
import * as workThemes from "./workThemes.js";

const {
  TAG_WORK_THEME_IDS,
  WORK_MAP_THEMES,
  buildWorkGenerationPrompt,
  createWorkSession,
  getThemeIdForTag,
  getWorkTheme,
  inferWorkMapTheme,
  interpolateWorkRoute,
  normalizeThemeJobs,
  resolveDisplayedWorkJob,
  resolveWorkMapView,
  resolveWorkSessionState,
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
      assert.ok(place.pin.y <= 48, `${theme.id}:${place.type} must stay above the work list`);
      const routeSamples = place.routeSamples || place.route;
      assert.ok(Array.isArray(routeSamples) && routeSamples.length >= 3);
      assert.deepEqual(routeSamples[0], theme.home);
      assert.deepEqual(routeSamples.at(-1), place.pin);
      if (place.routeSegments) {
        assert.ok(place.distanceMeters > 0);
        assert.ok(place.routeSamples.length >= 12);
        assert.ok(place.routeSegments.every((segment) => segment.startsWith("M ")));
      }
    }
  }
});

test("every work map is a real portrait 9:16 asset and outlines are no longer required", () => {
  for (const theme of Object.values(WORK_MAP_THEMES)) {
    const mapUrl = new URL(`../public/work-map-assets/${theme.asset}`, import.meta.url);
    assert.ok(existsSync(mapUrl), `missing map asset: ${theme.asset}`);
    assert.ok(statSync(mapUrl).size > 1000, `empty map asset: ${theme.asset}`);
    const png = readFileSync(mapUrl);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.ok(height > width, `${theme.asset} must be portrait`);
    assert.ok(Math.abs(width / height - 9 / 16) < 0.08, `${theme.asset} must be close to 9:16`);
  }
});

test("work sessions travel first and only then consume work time", () => {
  const job = { key: "job-a", durationMinutes: 60 };
  const session = createWorkSession(job, 1_000, 30_000);
  assert.equal(session.arriveAt, 31_000);
  assert.equal(session.endAt, 3_631_000);
  assert.deepEqual(resolveWorkSessionState(session, 16_000), {
    phase: "travel",
    progress: 0.5,
    remainingMs: 15_000,
  });
  assert.equal(resolveWorkSessionState(session, 31_000).phase, "work");
  assert.equal(resolveWorkSessionState(session, 31_000).remainingMs, 3_600_000);
  assert.equal(resolveWorkSessionState(session, 3_631_000).phase, "complete");
});

test("work sessions preserve second-level remaining time around arrival", () => {
  const job = { key: "job-b", durationMinutes: 60 };
  const session = createWorkSession(job, 1_000, 35_500);
  assert.equal(session.arriveAt, 36_500);
  assert.equal(session.workStartAt, 36_500);
  assert.equal(session.endAt, 3_636_500);
  assert.equal(resolveWorkSessionState(session, 35_500).phase, "travel");
  assert.equal(resolveWorkSessionState(session, 35_500).remainingMs, 1_000);
  assert.equal(resolveWorkSessionState(session, 36_499).phase, "travel");
  assert.equal(resolveWorkSessionState(session, 36_499).remainingMs, 1);
  assert.equal(resolveWorkSessionState(session, 36_500).phase, "work");
  assert.equal(resolveWorkSessionState(session, 36_500).remainingMs, 3_600_000);
  assert.equal(resolveWorkSessionState(session, 36_501).remainingMs, 3_599_999);
});

test("route interpolation follows every road turn instead of drawing a straight shortcut", () => {
  const route = [{ x: 10, y: 40 }, { x: 10, y: 20 }, { x: 70, y: 20 }];
  assert.deepEqual(interpolateWorkRoute(route, 0.25), { x: 10, y: 20 });
  assert.deepEqual(interpolateWorkRoute(route, 0.5), { x: 30, y: 20 });
});

test("modern merges calibrated route fields while uncalibrated themes stay on the temporary path", () => {
  const modern = getWorkTheme("modern");
  const bookstore = modern.places.find((place) => place.type === "bookstore");
  assert.deepEqual(modern.home, { x: 50, y: 10 });
  assert.equal(bookstore.distanceMeters, 420);
  assert.ok(bookstore.routeSamples.length >= 12);
  assert.deepEqual(bookstore.route, bookstore.routeSamples);
  assert.deepEqual(bookstore.routeSamples[0], modern.home);
  assert.deepEqual(bookstore.routeSamples.at(-1), bookstore.pin);
  assert.ok(bookstore.routeSegments.every((segment) => segment.startsWith("M ")));

  const xuanhuan = getWorkTheme("xuanhuan");
  const alchemy = xuanhuan.places.find((place) => place.type === "alchemy");
  assert.equal("routeSamples" in alchemy, false);
  assert.equal("routeSegments" in alchemy, false);
  assert.equal("distanceMeters" in alchemy, false);
  assert.ok(Array.isArray(alchemy.route) && alchemy.route.length >= 3);
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
