# 工作 APP 插画地图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将工作 APP 实现为可连接世界书、按主题切换完整插画底图、并保证 API 工作与地图地点严格匹配的可交互页面。

**Architecture:** 新建独立的工作主题模块，集中维护主题识别、地点白名单、API 结果校验和地图资源映射。世界书持久化增加 `workMapTheme`，工作页根据现实或选中世界书构造受限 API 提示词，并用主题底图、地点点位和分组任务列表渲染第 6 版布局。

**Tech Stack:** React 18、Vite、CSS、Lucide React、Node test runner、localStorage、OpenAI-compatible chat completions API。

## Global Constraints

- 保留现有工作计时、停止按比例结算、完成领取和钱包入账行为。
- 版本从 `0.2.73` 递增到 `0.2.74`。
- 顶部与底部必须使用 iOS safe area，主要触控目标不小于 44 x 44px。
- 不新增底部导航，不使用渐变、玻璃拟态、emoji 结构图标或嵌套卡片。
- 每个主题切换完整底图、建筑语义、地点白名单和工作词库。
- `designs/` 为用户未跟踪内容，禁止修改或提交。

---

### Task 1: 工作主题与地点协议

**Files:**
- Create: `src/workThemes.js`
- Create: `src/workThemes.test.js`

**Interfaces:**
- Produces: `WORK_MAP_THEMES`, `inferWorkMapTheme(world)`, `getWorkTheme(themeId)`, `normalizeThemeJobs(items, themeId, fallbackFactory)`。
- Consumes: 世界书对象中的 `genre`、`tone`、`workMapTheme`。

- [ ] **Step 1: Write failing tests for theme inference**

```js
test("infers ancient and xuanhuan world themes", () => {
  assert.equal(inferWorkMapTheme({ genre: "古代宫廷" }), "ancient_cn");
  assert.equal(inferWorkMapTheme({ genre: "东方玄幻修真" }), "xuanhuan");
  assert.equal(inferWorkMapTheme({ genre: "科幻殖民" }), "scifi");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/workThemes.test.js`

Expected: FAIL because `src/workThemes.js` does not exist.

- [ ] **Step 3: Implement theme metadata and inference**

```js
export const inferWorkMapTheme = (world = {}) => {
  if (world.workMapTheme && WORK_MAP_THEMES[world.workMapTheme]) return world.workMapTheme;
  const source = `${world.genre || ""} ${world.tone || ""}`;
  if (/玄幻|仙侠|修真|高魔东方/.test(source)) return "xuanhuan";
  if (/古代|宫廷|武侠|江湖/.test(source)) return "ancient_cn";
  if (/西幻|魔法|中世纪/.test(source)) return "western_fantasy";
  if (/科幻|星际|赛博|未来/.test(source)) return "scifi";
  if (/末世|废土|灾变/.test(source)) return "wasteland";
  return "modern";
};
```

- [ ] **Step 4: Add failing tests for location validation**

```js
test("replaces a job that does not belong to the selected theme", () => {
  const jobs = normalizeThemeJobs([{ placeType: "cafe", title: "咖啡馆整理" }], "xuanhuan", () => ({ placeType: "alchemy", title: "整理丹方" }));
  assert.equal(jobs[0].placeType, "alchemy");
});
```

- [ ] **Step 5: Implement normalization and run tests GREEN**

Run: `node --test src/workThemes.test.js`

Expected: all theme tests pass.

### Task 2: 世界书地图主题持久化与编辑入口

**Files:**
- Modify: `src/App.jsx`
- Test: `src/workThemes.test.js`

**Interfaces:**
- Consumes: `inferWorkMapTheme(world)` and `WORK_MAP_THEMES`.
- Produces: every saved world has `workMapTheme`; the world editor exposes an automatic/manual selector.

- [ ] **Step 1: Add failing migration test**

```js
test("an existing world without a map theme receives an inferred theme", () => {
  assert.equal(withWorkMapTheme({ id: "a", genre: "高魔史诗" }).workMapTheme, "xuanhuan");
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/workThemes.test.js`

Expected: FAIL because `withWorkMapTheme` is missing.

- [ ] **Step 3: Implement migration helper and apply it on load/save**

```js
export const withWorkMapTheme = (world = {}) => ({
  ...world,
  workMapTheme: inferWorkMapTheme(world),
});
```

- [ ] **Step 4: Add the world editor field**

Use a labeled native `select` with options from `WORK_MAP_THEMES`; choosing “自动匹配” clears the explicit override and shows the inferred theme name.

- [ ] **Step 5: Run theme and existing tests**

Run: `npm test`

Expected: all tests pass.

### Task 3: API prompt and worldbook source selection

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/workThemes.js`
- Test: `src/workThemes.test.js`

**Interfaces:**
- Consumes: selected world, selected theme metadata, theme location whitelist.
- Produces: `buildWorkGenerationPrompt({ world, theme })` and validated five-job results.

- [ ] **Step 1: Write failing prompt test**

```js
test("xuanhuan prompt lists only xuanhuan locations", () => {
  const prompt = buildWorkGenerationPrompt({ world: { name: "云澜界", genre: "玄幻" }, themeId: "xuanhuan" });
  assert.match(prompt, /炼丹阁/);
  assert.doesNotMatch(prompt, /咖啡馆/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/workThemes.test.js`

Expected: FAIL because `buildWorkGenerationPrompt` is missing.

- [ ] **Step 3: Implement structured prompt and parser contract**

Require five JSON jobs with `placeType`, `placeName`, `title`, `content`, `durationMinutes`, `hourlyRate`, `reward`, `level`, and `icon`; include the selected world's name, genre and tone plus exact allowed places.

- [ ] **Step 4: Add source selector behavior**

The work page provides `现实` and `当前世界书`; selecting the latter opens a centered worldbook picker populated from `readWorldbookWorldsForSelect()` and persists the chosen world id.

- [ ] **Step 5: Preserve loading and fallback behavior**

Keep the previous round visible while loading. Invalid API rows are replaced with local jobs from the same theme; complete API failure generates a full local themed round.

- [ ] **Step 6: Run all tests**

Run: `npm test`

Expected: all tests pass.

### Task 4: Six illustrated map assets

**Files:**
- Create: `public/work-map-assets/map-modern.png`
- Create: `public/work-map-assets/map-ancient-cn.png`
- Create: `public/work-map-assets/map-xuanhuan.png`
- Create: `public/work-map-assets/map-western-fantasy.png`
- Create: `public/work-map-assets/map-scifi.png`
- Create: `public/work-map-assets/map-wasteland.png`

**Interfaces:**
- Consumes: map asset names from `WORK_MAP_THEMES`.
- Produces: six 1536 x 1024 low-noise landscape illustrations with no embedded UI labels.

- [ ] **Step 1: Generate each themed map as an independent image**

Use the selected visual's flat gouache style, fixed top-down/orthographic perspective, five clear landmark regions and safe negative space for HTML point labels.

- [ ] **Step 2: Inspect every asset**

Check subject, theme accuracy, absence of modern objects in ancient/fantasy maps, absence of fantasy objects in modern/scifi maps, and consistent palette/rendering.

- [ ] **Step 3: Place assets in the project**

Copy the selected outputs into `public/work-map-assets/` and keep source aspect ratios unchanged.

### Task 5: Work page visual implementation

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: normalized jobs, theme metadata, selected map asset.
- Produces: responsive selected Option 6 layout.

- [ ] **Step 1: Replace the radar map with the themed illustrated map**

Render a full-width image using `object-fit: cover`, overlay five buttons at stable percentage anchors, and connect the selected point with a CSS dashed route only when reduced motion is not requested.

- [ ] **Step 2: Replace the five-card choice panel with one grouped list**

Each row shows location icon, title, duration and reward. Only the selected row expands to show description, level and progress.

- [ ] **Step 3: Match the selected visual hierarchy**

Use milky white, powder blue, mint, soft peach, butter yellow and navy; retain Lucide icons; keep the task panel and action bar free of nested cards and glass effects.

- [ ] **Step 4: Apply safe areas and responsive bounds**

Use `padding-top: max(12px, env(safe-area-inset-top))` for interactive header content and include `env(safe-area-inset-bottom)` in the sticky action area.

- [ ] **Step 5: Preserve all work interactions**

Verify refresh count, paid refresh, task selection, start, stop with proportional payout, completion claim, localStorage persistence and wallet credit.

### Task 6: Version, QA, build and deployment

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `docs/.deploy-version`
- Modify: `docs/` build output
- Modify: `design-qa.md`

**Interfaces:**
- Produces: version `0.2.74` deployed from `main/docs`.

- [ ] **Step 1: Bump all visible and cache-busting versions**

Replace `0.2.73` with `0.2.74` in package metadata, settings label and asset query strings.

- [ ] **Step 2: Run unit tests and build**

Run: `npm test && npm run build`

Expected: tests report zero failures and Vite exits 0.

- [ ] **Step 3: Run visual QA**

Compare the 390 x 844 implementation against Option 6 and the xuanhuan variation. Verify 375px small phone, long iPhone viewport, theme switching, safe areas, no clipping and reduced motion. Update `design-qa.md` until `final result: passed`.

- [ ] **Step 4: Sync deployment without deleting design specs**

Run: `rsync -a --delete --exclude='.nojekyll' --exclude='.deploy-version' --exclude='superpowers/' dist/ docs/`

- [ ] **Step 5: Commit and push**

Commit only implementation, generated map assets, tests, deployment output and specs; leave `designs/` untouched. Push `main` to `origin`.

- [ ] **Step 6: Verify the live site**

Open the GitHub Pages URL with a cache-busting query and confirm version `0.2.74`, new hashed assets and themed map behavior.
