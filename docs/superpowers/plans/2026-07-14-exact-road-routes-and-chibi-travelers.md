# Exact Road Routes and Chibi Travelers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the semi-realistic work travelers with large, cute 2.5-head chibi characters and recalibrate all 125 work routes so the visible white dotted line and traveler movement follow the exact roads painted into each map.

**Architecture:** Keep the existing 25 map assets, five route batch modules, and `WorkMap` rendering contract. Generate eight new transparent traveler sprites, strengthen route validation against sparse shortcut data, then use the existing route calibrator to trace every road manually in five reviewable batches. The visible route and movement continue to consume the same `samples` array so they cannot drift apart.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Node test runner, SVG route rendering, Playwright screenshot verification, built-in image generation plus local chroma-key removal.

## Global Constraints

- Keep all 25 existing 9:16 map illustrations and all five jobs per map.
- Keep four traveler groups with one female and one male character in each group.
- Every traveler uses an unmistakable cute 2.5-head chibi style with round face, large eyes, short limbs, and no realistic body proportions or skin rendering.
- Every female traveler has long hair; all eight travelers retain distinct hair, accessories, bags, shoes, and layered clothing.
- Render the moving traveler at approximately 60px instead of the old 38-42px size, with a small-screen cap that does not cover buildings.
- Show a white dotted route before travel begins.
- The white dotted route and the moving traveler must use the same road-center sample points.
- Manually calibrate all 125 routes; do not accept generic templates, automatic path guesses, sparse endpoint shortcuts, or curves crossing non-road pixels.
- Preserve unrelated user-owned files, including the untracked `designs/` directory.

---

## File Structure

- Modify `public/work-map-assets/traveler-*.png`: eight replacement chibi sprites with transparent backgrounds.
- Modify `docs/work-map-assets/traveler-*.png`: deployed copies of the eight replacement sprites.
- Modify `src/styles.css`: larger map traveler and selector preview dimensions.
- Modify `src/workRouteData.js`: route-density and route-shape validation helpers.
- Modify `src/workRouteData.test.js`: validation tests for sparse shortcut rejection and sample-backed visible paths.
- Modify `src/workRouteBatches/batch-a.js`: 25 manually traced routes for prehistoric, ancient, western regions, xianxia, and xuanhuan maps.
- Modify `src/workRouteBatches/batch-b.js`: 25 manually traced routes for mystic realm, underworld, medieval, western fantasy, and fantasy maps.
- Modify `src/workRouteBatches/batch-c.js`: 25 manually traced routes for magic world, magic academy, island, ocean, and republican maps.
- Modify `src/workRouteBatches/batch-d.js`: 25 manually traced routes for Hong Kong, modern, campus, ice age, and wasteland maps.
- Modify `src/workRouteBatches/batch-e.js`: 25 manually traced routes for cyberpunk, science fiction, alien civilization, online game, and Cthulhu maps.
- Modify `scripts/work-route-calibrator.html`: road-center tracing guidance and point-count display.
- Modify `scripts/verify-work-routes.mjs`: route screenshot metadata and complete 125-route output.
- Modify `src/workTravelers.test.js`: traveler asset and presentation contract tests.
- Modify `package.json`, `package-lock.json`, `src/App.jsx`, `docs/.deploy-version`, and `docs/index.html`: release version and production deployment payload.

---

### Task 1: Reject Sparse Shortcut Routes

**Files:**
- Modify: `src/workRouteData.js`
- Modify: `src/workRouteData.test.js`
- Modify: `scripts/work-route-calibrator.html`

**Interfaces:**
- Consumes: `routeRecord.samples: Array<{x: number, y: number}>` and `routeRecord.visibleSegments: string[]`.
- Produces: `getWorkRouteSampleMetrics(samples)` returning `{ maxSegmentLength, sampleCount, totalLength }` and validation errors for visually unsafe sparse routes.

- [ ] **Step 1: Write failing route-metric tests**

Add tests that assert dense road samples pass and a three-point shortcut with a 28-unit jump fails:

```js
import { getWorkRouteSampleMetrics, validateWorkRouteTheme } from "./workRouteData.js";

test("getWorkRouteSampleMetrics reports the longest jump", () => {
  assert.deepEqual(
    getWorkRouteSampleMetrics([{ x: 10, y: 10 }, { x: 13, y: 14 }, { x: 13, y: 20 }]),
    { maxSegmentLength: 6, sampleCount: 3, totalLength: 11 },
  );
});

test("validateWorkRouteTheme rejects sparse road shortcuts", () => {
  const issues = validateWorkRouteTheme("sample", sampleTheme, {
    home: { x: 10, y: 10 },
    routes: {
      cafe: {
        pin: { x: 60, y: 60 },
        distanceMeters: 500,
        samples: [{ x: 10, y: 10 }, { x: 38, y: 38 }, { x: 60, y: 60 }],
        visibleSegments: ["M 10 10 L 38 38 L 60 60"],
      },
    },
  });
  assert.ok(issues.some((issue) => issue.includes("segment jump")));
});
```

- [ ] **Step 2: Run the tests and confirm red state**

Run: `node --test src/workRouteData.test.js`

Expected: FAIL because `getWorkRouteSampleMetrics` does not exist and sparse segment jumps are not validated.

- [ ] **Step 3: Implement deterministic route metrics**

Add the exported helper and reject any consecutive sample jump greater than `8` map-coordinate units:

```js
export const getWorkRouteSampleMetrics = (samples = []) => {
  const lengths = samples.slice(1).map((pointValue, index) => (
    Math.hypot(pointValue.x - samples[index].x, pointValue.y - samples[index].y)
  ));
  return {
    maxSegmentLength: Math.round(Math.max(0, ...lengths) * 100) / 100,
    sampleCount: samples.length,
    totalLength: Math.round(lengths.reduce((sum, length) => sum + length, 0) * 100) / 100,
  };
};
```

In `validateWorkRouteTheme`, append `${themeId}:${place.type} segment jump exceeds 8` when `maxSegmentLength > 8`.

- [ ] **Step 4: Add calibrator feedback**

Display sample count and maximum segment jump beside the export button. Use red text when `maxSegmentLength > 8`, and block route export until all jumps are at most `8`.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test src/workRouteData.test.js scripts/work-route-tools.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/workRouteData.js src/workRouteData.test.js scripts/work-route-calibrator.html
git commit -m "Validate dense work road routes"
```

---

### Task 2: Generate Eight True Chibi Traveler Sprites

**Files:**
- Modify: `public/work-map-assets/traveler-campus-female.png`
- Modify: `public/work-map-assets/traveler-campus-male.png`
- Modify: `public/work-map-assets/traveler-trend-female.png`
- Modify: `public/work-map-assets/traveler-trend-male.png`
- Modify: `public/work-map-assets/traveler-literary-female.png`
- Modify: `public/work-map-assets/traveler-literary-male.png`
- Modify: `public/work-map-assets/traveler-luxe-female.png`
- Modify: `public/work-map-assets/traveler-luxe-male.png`
- Modify: `docs/work-map-assets/traveler-*.png`
- Modify: `src/workTravelers.test.js`

**Interfaces:**
- Consumes: the existing traveler IDs and filenames in `src/workTravelers.js`.
- Produces: eight square transparent PNG sprites, at least `512x512`, with one centered full-body character and generous edge padding.

- [ ] **Step 1: Add failing asset-quality tests**

Extend `src/workTravelers.test.js` to assert all eight public and docs assets exist, are PNG files, are at least `512x512`, and have an alpha channel. Use the existing PNG metadata helper already used by traveler tests.

- [ ] **Step 2: Run the traveler tests and confirm red state**

Run: `node --test src/workTravelers.test.js`

Expected: FAIL because the current assets do not satisfy the new minimum-size and alpha contract.

- [ ] **Step 3: Generate one sprite per traveler with the built-in image tool**

Use this shared prompt for every sprite:

```text
Use case: stylized-concept
Asset type: full-body mobile game traveler sprite
Primary request: Create one unmistakably cute 2.5-head chibi character, full body, centered, round face, very large expressive eyes, tiny nose and mouth, short arms and legs, compact silhouette, polished modern anime illustration, clean outlines, soft cel shading, detailed accessories and layered clothing. The result must not look photorealistic, semi-realistic, fashion-model-like, or anatomically realistic.
Background: perfectly flat solid #00ff00 chroma-key background with no shadow, gradient, texture, reflection, floor, or lighting variation.
Composition: single character only, standing pose, complete hair and shoes visible, generous padding on all sides.
Output constraints: no text, no watermark, no cropped body, no extra people, no #00ff00 in the character.
```

Append the exact traveler details from `src/workTravelers.js` for each call. Female prompts must explicitly state long hair. Generate eight separate images, not one contact sheet.

- [ ] **Step 4: Remove chroma key and validate alpha**

For each generated source, run this explicit loop after saving the sources with matching filenames:

```bash
for traveler in \
  traveler-campus-female traveler-campus-male \
  traveler-trend-female traveler-trend-male \
  traveler-literary-female traveler-literary-male \
  traveler-luxe-female traveler-luxe-male; do
  python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
    --input "tmp/imagegen/${traveler}-source.png" \
    --out "public/work-map-assets/${traveler}.png" \
    --auto-key border --soft-matte --transparent-threshold 12 \
    --opaque-threshold 220 --despill --edge-contract 1
done
```

Validate transparent corners, clean hair edges, full-body coverage, and absence of green fringe using a checkerboard contact sheet.

- [ ] **Step 5: Sync deploy assets and run tests**

Copy the eight final PNG files into `docs/work-map-assets/`, then run `node --test src/workTravelers.test.js`.

Expected: all traveler tests PASS.

- [ ] **Step 6: Commit**

```bash
git add public/work-map-assets/traveler-*.png docs/work-map-assets/traveler-*.png src/workTravelers.test.js
git commit -m "Replace work travelers with cute chibi sprites"
```

---

### Task 3: Increase Map Traveler and Picker Scale

**Files:**
- Modify: `src/styles.css`
- Modify: `src/App.work.test.js`

**Interfaces:**
- Consumes: `.work-map-traveler`, `.work-traveler-button img`, and `.work-traveler-option img`.
- Produces: a responsive 56-60px map traveler with unchanged route anchoring.

- [ ] **Step 1: Add a failing CSS contract test**

Read `src/styles.css` in `src/App.work.test.js` and assert the final `.work-map-traveler` rule contains `width: clamp(54px, 15.4vw, 60px)` and `height: clamp(54px, 15.4vw, 60px)`.

- [ ] **Step 2: Run the focused test and confirm red state**

Run: `node --test src/App.work.test.js`

Expected: FAIL because the current dimensions are `38px`.

- [ ] **Step 3: Apply the responsive chibi dimensions**

Replace the final dimensions with:

```css
.work-map-traveler {
  width: clamp(54px, 15.4vw, 60px);
  height: clamp(54px, 15.4vw, 60px);
  transform: translate(-50%, -78%);
}
```

Set `.work-traveler-option` to `52px` square and its child image to `40px` square. Keep the transparent top-right opener at `40px` with its child image at `30px` so it remains clear of map buildings.

- [ ] **Step 4: Run tests and mobile screenshot smoke checks**

Run: `node --test src/App.work.test.js src/workTravelers.test.js`

Capture the work page at `375x667` and `390x844`; verify the traveler is visibly larger but does not cover the selected pin or the top-right picker.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/App.work.test.js
git commit -m "Increase work map chibi scale"
```

---

### Task 4: Manually Recalibrate Route Batch A

**Files:**
- Modify: `src/workRouteBatches/batch-a.js`
- Modify: `src/workRouteBatchA.test.js`
- Create: `docs/superpowers/qa/routes-exact-batch-a-contact-sheet.png`

**Interfaces:**
- Consumes: route calibrator point exports for `prehistoric`, `ancient`, `western_regions`, `xianxia`, and `xuanhuan`.
- Produces: 25 independent road-center route arrays with maximum segment jump at most `8`.

- [ ] **Step 1: Trace each route over its real road**

Open the calibrator for each of the five themes. Start at the home marker, click along the visible road center at every bend and junction, finish at the matching work pin, and export the generated `point(x, y)` array. Do this independently for all 25 jobs.

- [ ] **Step 2: Replace all batch A sample arrays**

Use only `L` segments built from the exported samples. Preserve intentional visibility breaks only where the route passes under a foreground object; do not use a break to hide a route that leaves the road.

- [ ] **Step 3: Strengthen batch-specific tests**

Assert each route has at least 16 samples, `maxSegmentLength <= 8`, starts at the theme home, ends at the pin, and has a sample signature unique within the batch.

- [ ] **Step 4: Run tests and generate screenshots**

Run:

```bash
node --test src/workRouteBatchA.test.js src/workRouteData.test.js
npm run verify:routes -- --theme prehistoric --output-dir artifacts/exact-routes-a
npm run verify:routes -- --theme ancient --output-dir artifacts/exact-routes-a
npm run verify:routes -- --theme western_regions --output-dir artifacts/exact-routes-a
npm run verify:routes -- --theme xianxia --output-dir artifacts/exact-routes-a
npm run verify:routes -- --theme xuanhuan --output-dir artifacts/exact-routes-a
```

Combine the 25 screenshots into the batch A contact sheet and inspect every line at original resolution. Correct any point that leaves the painted road before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/workRouteBatches/batch-a.js src/workRouteBatchA.test.js docs/superpowers/qa/routes-exact-batch-a-contact-sheet.png
git commit -m "Trace batch A routes on painted roads"
```

---

### Task 5: Manually Recalibrate Route Batch B

**Files:**
- Modify: `src/workRouteBatches/batch-b.js`
- Modify: `src/workRouteBatchB.test.js`
- Create: `docs/superpowers/qa/routes-exact-batch-b-contact-sheet.png`

**Interfaces:**
- Consumes: route calibrator exports for `mystic_realm`, `underworld`, `medieval`, `western_fantasy`, and `fantasy`.
- Produces: 25 independent road-center route arrays using the Task 1 metrics contract.

- [ ] **Step 1: Trace all 25 real roads**

For every job, follow the road center through each visible curve, bridge, stair, and fork. Add points before and after every direction change; never connect two distant visible road sections with a straight shortcut.

- [ ] **Step 2: Replace batch B samples and remove shortcut paths**

Generate visible segments from the same samples used for movement. Remove manually authored curves that diverge from the exported road-center points.

- [ ] **Step 3: Add density, endpoint, and uniqueness assertions**

Assert each route has at least 16 samples, `getWorkRouteSampleMetrics(route.samples).maxSegmentLength <= 8`, `route.samples[0]` equals the theme home, `route.samples.at(-1)` equals its pin, and `JSON.stringify(route.samples)` is unique within the batch.

- [ ] **Step 4: Verify and inspect 25 screenshots**

Run:

```bash
node --test src/workRouteBatchB.test.js src/workRouteData.test.js
for theme in mystic_realm underworld medieval western_fantasy fantasy; do
  npm run verify:routes -- --theme "$theme" --output-dir artifacts/exact-routes-b
done
```

Build and inspect the 25-image contact sheet at original resolution.

- [ ] **Step 5: Commit**

```bash
git add src/workRouteBatches/batch-b.js src/workRouteBatchB.test.js docs/superpowers/qa/routes-exact-batch-b-contact-sheet.png
git commit -m "Trace batch B routes on painted roads"
```

---

### Task 6: Manually Recalibrate Route Batch C

**Files:**
- Modify: `src/workRouteBatches/batch-c.js`
- Modify: `src/workRouteBatchC.test.js`
- Create: `docs/superpowers/qa/routes-exact-batch-c-contact-sheet.png`

**Interfaces:**
- Consumes: route calibrator exports for `magic_world`, `magic_academy`, `island`, `ocean`, and `republican`.
- Produces: 25 independent road-center route arrays using the Task 1 metrics contract.

- [ ] **Step 1: Trace all 25 real roads**

Calibrate each route independently. For water and island themes, use only bridges, piers, walkways, or clearly painted travel lanes; never cross open water unless the map visibly paints the route there.

- [ ] **Step 2: Replace sample and visible segment data**

Use the exported dense samples as the single source for both traveler interpolation and white dotted paths.

- [ ] **Step 3: Add density, endpoint, and uniqueness assertions**

Require at least 16 samples, maximum jump `8`, exact home start, exact pin end, and a unique sample signature per route.

- [ ] **Step 4: Verify and inspect 25 screenshots**

Run `node --test src/workRouteBatchC.test.js src/workRouteData.test.js`, then generate five theme screenshot sets under `artifacts/exact-routes-c`. Build and inspect the original-resolution contact sheet.

- [ ] **Step 5: Commit**

```bash
git add src/workRouteBatches/batch-c.js src/workRouteBatchC.test.js docs/superpowers/qa/routes-exact-batch-c-contact-sheet.png
git commit -m "Trace batch C routes on painted roads"
```

---

### Task 7: Manually Recalibrate Route Batch D

**Files:**
- Modify: `src/workRouteBatches/batch-d.js`
- Modify: `src/workRouteBatchD.test.js`
- Create: `docs/superpowers/qa/routes-exact-batch-d-contact-sheet.png`

**Interfaces:**
- Consumes: route calibrator exports for `hong_kong`, `modern`, `campus`, `ice_age`, and `wasteland`.
- Produces: 25 independent road-center route arrays using the Task 1 metrics contract.

- [ ] **Step 1: Trace all 25 real roads**

Use sidewalks, streets, campus paths, snow tracks, and wasteland roads actually visible in each map. Trace around planters, medians, buildings, and other obstacles rather than crossing them.

- [ ] **Step 2: Replace sample and visible segment data**

Delete any old curves or sparse paths that do not match the road-center export.

- [ ] **Step 3: Add density, endpoint, and uniqueness assertions**

Require at least 16 samples, maximum jump `8`, exact home start, exact pin end, and a unique sample signature per route.

- [ ] **Step 4: Verify and inspect 25 screenshots**

Run `node --test src/workRouteBatchD.test.js src/workRouteData.test.js`, generate five theme screenshot sets under `artifacts/exact-routes-d`, and inspect the contact sheet at original resolution.

- [ ] **Step 5: Commit**

```bash
git add src/workRouteBatches/batch-d.js src/workRouteBatchD.test.js docs/superpowers/qa/routes-exact-batch-d-contact-sheet.png
git commit -m "Trace batch D routes on painted roads"
```

---

### Task 8: Manually Recalibrate Route Batch E

**Files:**
- Modify: `src/workRouteBatches/batch-e.js`
- Modify: `src/workRouteBatchE.test.js`
- Create: `docs/superpowers/qa/routes-exact-batch-e-contact-sheet.png`

**Interfaces:**
- Consumes: route calibrator exports for `cyberpunk`, `scifi`, `alien_civilization`, `online_game`, and `cthulhu`.
- Produces: 25 independent road-center route arrays using the Task 1 metrics contract.

- [ ] **Step 1: Trace all 25 real roads**

Follow painted neon streets, station corridors, alien walkways, game paths, and Cthulhu roads exactly. Do not infer a shortcut through decorative light beams, roofs, voids, or terrain without a visible lane.

- [ ] **Step 2: Replace sample and visible segment data**

Remove the batch's old manually authored `C` curves and generate the white dotted segments from the same dense sample arrays used by traveler movement.

- [ ] **Step 3: Add density, endpoint, and uniqueness assertions**

Require at least 16 samples, maximum jump `8`, exact home start, exact pin end, and a unique sample signature per route.

- [ ] **Step 4: Verify and inspect 25 screenshots**

Run `node --test src/workRouteBatchE.test.js src/workRouteData.test.js`, generate five theme screenshot sets under `artifacts/exact-routes-e`, and inspect the contact sheet at original resolution.

- [ ] **Step 5: Commit**

```bash
git add src/workRouteBatches/batch-e.js src/workRouteBatchE.test.js docs/superpowers/qa/routes-exact-batch-e-contact-sheet.png
git commit -m "Trace batch E routes on painted roads"
```

---

### Task 9: Full Route and Mobile Visual Verification

**Files:**
- Modify: `scripts/verify-work-routes.mjs`
- Create: `docs/superpowers/qa/routes-exact-all-contact-sheet.png`
- Create: `docs/superpowers/qa/chibi-travelers-final-contact-sheet.png`

**Interfaces:**
- Consumes: all 125 verified routes and eight final traveler sprites.
- Produces: a complete 125-route audit sheet and mobile screenshots proving scale, route visibility, and movement alignment.

- [ ] **Step 1: Add screenshot metadata**

Write `themeId`, `placeType`, sample count, and maximum segment jump into each screenshot caption so every route can be traced back to its data record.

- [ ] **Step 2: Run all automated tests**

Run: `npm test`

Expected: all route, traveler, timing, and application tests PASS.

- [ ] **Step 3: Generate all 125 route screenshots**

Run: `npm run verify:routes -- --output-dir artifacts/exact-routes-all`

Expected: exactly 125 PNG screenshots and no missing themes or places.

- [ ] **Step 4: Perform original-resolution visual audit**

Build one contact sheet grouped by theme. Inspect each screenshot and compare the complete white dotted path to the visible painted road. Any route touching grass, water, roof, courtyard decoration, or empty terrain returns to its batch task for correction.

- [ ] **Step 5: Verify mobile movement**

At `375x667` and `390x844`, start one curved route in each batch. Capture the traveler near 25%, 50%, and 75% progress and confirm its anchor remains centered on the same dotted road.

- [ ] **Step 6: Commit**

```bash
git add scripts/verify-work-routes.mjs docs/superpowers/qa/routes-exact-all-contact-sheet.png docs/superpowers/qa/chibi-travelers-final-contact-sheet.png
git commit -m "Verify exact road routes and chibi travelers"
```

---

### Task 10: Release and Deploy

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `docs/.deploy-version`
- Modify: `docs/index.html`
- Modify: `docs/assets/*`

**Interfaces:**
- Consumes: the verified source application and public assets.
- Produces: the next patch release deployed to GitHub Pages.

- [ ] **Step 1: Bump the patch version**

Change `0.2.91` to `0.2.92` in package metadata, asset cache keys, and `docs/.deploy-version`.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
npm run build
npm run verify:routes -- --output-dir /tmp/ccat-exact-route-verification-0.2.92
git diff --check
```

Expected: all tests PASS, production build succeeds, 125 screenshots are generated, and `git diff --check` prints nothing.

- [ ] **Step 3: Sync production payload**

Replace the generated files under `docs/` with the current `dist/` output while preserving `.deploy-version`. Confirm `docs/index.html` references the newly built JavaScript and CSS hashes and all eight chibi sprites exist under `docs/work-map-assets/`.

- [ ] **Step 4: Commit and push**

```bash
git add package.json package-lock.json src/App.jsx docs
git commit -m "Release V0.2.92 exact work routes"
git push origin main
```

- [ ] **Step 5: Verify GitHub Pages**

Poll `https://sy719427083-glitch.github.io/ai-roleplay-phone/.deploy-version` until it returns `0.2.92`, then open the live work page and verify one Q traveler and one curved road route on an iPhone-sized viewport.
