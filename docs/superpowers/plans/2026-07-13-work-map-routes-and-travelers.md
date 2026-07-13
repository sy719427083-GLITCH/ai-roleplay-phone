# Work Map Routes and Travelers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eight selectable, detailed Q-style travelers and rebuild all work-map route data so every traveler follows a real visible road from the protagonist home to each of five correctly marked work buildings, with second-accurate travel and work timing.

**Architecture:** Keep theme and job metadata in `workThemes.js`, store the 125 calibrated route records in five independently authored modules under `workRouteBatches/`, aggregate them through the public `workRouteData.js` registry, and put traveler metadata and persistence normalization in `workTravelers.js`. Each route stores a full sampled motion path plus one or more SVG display segments so the traveler can move continuously while the dashed route can disappear behind foreground objects. `App.jsx` owns selection and session orchestration; static generated maps and transparent traveler sprites live in `public/work-map-assets/`.

**Tech Stack:** React 19, Vite 6, CSS, Node test runner, Playwright, localStorage, generated PNG assets, SVG paths, GitHub Pages.

## Global Constraints

- Preserve the 25 existing world-tag themes and their five jobs.
- Every 9:16 map contains exactly five identifiable work buildings and one protagonist home.
- The upper-right selector clearance must contain no building, building entrance, route junction, job marker, or home marker.
- Every route follows a visible road centerline from the home entrance to the selected building entrance; it cannot cross scenery, water, grass, walls, roofs, or roadless ground.
- Do not reuse a generic route template. Store 25 independently calibrated home points, 125 independently calibrated job points, and 125 independently calibrated routes.
- All girls have long hair. Each of the eight travelers has distinct clothing construction, accessories, bag, shoes, and silhouette rather than a recolor.
- All countdowns update and display to the exact second.
- Leave the untracked `designs/` directory untouched.
- Increment the patch version from `0.2.90` and deploy the built result to GitHub Pages.

---

### Task 1: Traveler Registry and Second-Accurate Time Helpers

**Files:**
- Create: `src/workTravelers.js`
- Create: `src/workTravelers.test.js`
- Modify: `src/workThemes.js`
- Modify: `src/workThemes.test.js`

**Interfaces:**

```js
export const WORK_TRAVELER_GROUPS = [
  {
    id: "campus",
    label: "校园清新",
    travelers: [
      { id: "campus-female", gender: "female", name: "晴栀", asset: "work-map-assets/traveler-campus-female.png" },
      { id: "campus-male", gender: "male", name: "屿川", asset: "work-map-assets/traveler-campus-male.png" },
    ],
  },
  {
    id: "trend",
    label: "甜酷潮流",
    travelers: [
      { id: "trend-female", gender: "female", name: "绯可", asset: "work-map-assets/traveler-trend-female.png" },
      { id: "trend-male", gender: "male", name: "北野", asset: "work-map-assets/traveler-trend-male.png" },
    ],
  },
  {
    id: "literary",
    label: "温柔文艺",
    travelers: [
      { id: "literary-female", gender: "female", name: "书遥", asset: "work-map-assets/traveler-literary-female.png" },
      { id: "literary-male", gender: "male", name: "言舟", asset: "work-map-assets/traveler-literary-male.png" },
    ],
  },
  {
    id: "luxe",
    label: "轻奢日常",
    travelers: [
      { id: "luxe-female", gender: "female", name: "明珠", asset: "work-map-assets/traveler-luxe-female.png" },
      { id: "luxe-male", gender: "male", name: "景珩", asset: "work-map-assets/traveler-luxe-male.png" },
    ],
  },
];

export const DEFAULT_WORK_TRAVELER_ID = "campus-female";
export const getWorkTraveler = (travelerId) => traveler;
export const normalizeWorkTravelerId = (travelerId) => string;
export const formatWorkDuration = (milliseconds) => string;
```

- [ ] **Step 1: Write failing traveler tests** for four groups, exactly two travelers per group, unique ids and assets, female long-hair metadata, fallback normalization, and `formatWorkDuration` output at `0`, `59`, `60`, `3599`, `3600`, and `3661` seconds.
- [ ] **Step 2: Run `node --test src/workTravelers.test.js`** and verify failure because the module does not exist.
- [ ] **Step 3: Implement all eight registry entries** under groups `campus`, `trend`, `literary`, and `luxe`; include `hair`, `headwear`, `bag`, `outfit`, and `accent` metadata so tests prevent simple recolor variants.
- [ ] **Step 4: Implement `formatWorkDuration`** with `Math.max(0, Math.ceil(ms / 1000))`; return `MM:SS` below one hour and `HH:MM:SS` from one hour onward.
- [ ] **Step 5: Extend session tests** to prove travel and work remaining values preserve sub-minute seconds and the work timer begins only after `arriveAt`.
- [ ] **Step 6: Run `node --test src/workTravelers.test.js src/workThemes.test.js`** and require all focused tests to pass.
- [ ] **Step 7: Commit** with message `Add work travelers and second timers`.

### Task 2: Exact Route Data Contract and Validation

**Files:**
- Create: `src/workRouteData.js`
- Create: `src/workRouteData.test.js`
- Modify: `src/workThemes.js`
- Modify: `src/workThemes.test.js`

**Interfaces:**

```js
export const WORK_ROUTE_DATA = {
  modern: {
    home: { x: 50, y: 10 },
    routes: {
      cafe: {
        pin: { x: 18, y: 19 },
        distanceMeters: 420,
        samples: [
          { x: 50, y: 10 }, { x: 50, y: 12 }, { x: 49, y: 14 },
          { x: 46, y: 16 }, { x: 42, y: 17 }, { x: 38, y: 17 },
          { x: 34, y: 17.5 }, { x: 30, y: 18 }, { x: 27, y: 18.5 },
          { x: 24, y: 19 }, { x: 21, y: 19 }, { x: 18, y: 19 },
        ],
        visibleSegments: ["M 50 10 C 50 14, 46 17, 38 17 C 31 17, 25 19, 18 19"],
      },
    },
  },
};

export const getWorkRouteTheme = (themeId) => routeTheme;
export const validateWorkRouteTheme = (themeId, theme, routeTheme) => string[];
export const interpolateWorkRoute = (samples, progress) => ({ x, y });
```

- [ ] **Step 1: Write failing route-contract tests** against a complete theme fixture, requiring five route keys matching that theme's five place types, finite normalized coordinates, at least 12 motion samples per route, valid `M`-prefixed SVG segments, positive distance, matching home start and matching pin end.
- [ ] **Step 2: Add uniqueness tests** proving no two routes share the same serialized sample list and no theme uses one five-route pattern translated to different pins.
- [ ] **Step 3: Run `node --test src/workRouteData.test.js`** and verify the missing module failure.
- [ ] **Step 4: Implement the registry and validators** with the current `modern` route data migrated first; use complete values rather than fallbacks for every migrated entry, and let an uncalibrated theme return no route record until its batch task supplies one.
- [ ] **Step 5: Update `workThemes.js`** to merge `home`, `pin`, `distanceMeters`, `routeSamples`, and `routeSegments` only for calibrated themes; retain the old data path temporarily for uncalibrated themes and delete it in Task 10 after all 25 themes are present.
- [ ] **Step 6: Update interpolation** to consume dense samples and weight movement by segment length so speed remains constant through bends.
- [ ] **Step 7: Run focused route/theme tests** and commit with message `Define calibrated work route schema`.

### Task 3: Browser Route Calibration and Screenshot Tooling

**Files:**
- Create: `scripts/work-route-calibrator.html`
- Create: `scripts/work-route-calibrator.js`
- Create: `scripts/verify-work-routes.mjs`
- Modify: `package.json`

**Interfaces:**

```json
{
  "scripts": {
    "calibrate:routes": "vite --host 127.0.0.1",
    "verify:routes": "node scripts/verify-work-routes.mjs"
  }
}
```

- [ ] **Step 1: Create a calibration page** that loads a selected 9:16 map at its native aspect ratio, overlays normalized coordinates, and switches between `home` plus the five real place types for that theme.
- [ ] **Step 2: Add point editing**: click appends a road-center sample, drag adjusts a sample, Delete removes the selected sample, Undo removes the last sample, and Clear resets only the active route.
- [ ] **Step 3: Render the active route** with rounded dashed SVG strokes and render all six markers so point and entrance alignment can be checked together.
- [ ] **Step 4: Add optional visible-segment breaks** that split the dashed line without splitting `samples`; export a complete route object containing `pin`, `distanceMeters`, `samples`, and `visibleSegments`.
- [ ] **Step 5: Add a Playwright verification script** that opens the app at `390x844`, selects each theme and each of its five jobs through localStorage/test hooks, and writes 125 screenshots to `artifacts/work-routes/<theme>/<place>.png`.
- [ ] **Step 6: Add tool tests or parser assertions** that exported normalized points remain in `0..100`, all segment breaks reference valid sample indices, and each screenshot filename is deterministic.
- [ ] **Step 7: Run the calibration page and one modern five-route screenshot batch**, verify the outputs visually, and commit with message `Add work route calibration tools`.

### Task 4: Traveler Selector State and Interaction

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `src/workTravelers.test.js`

**State contract:**

```js
const WORK_TRAVELER_STORAGE_KEY = "ccat-work-traveler";
const [workTravelerId, setWorkTravelerId] = useState(() =>
  normalizeWorkTravelerId(localStorage.getItem(WORK_TRAVELER_STORAGE_KEY))
);
```

- [ ] **Step 1: Add a failing persistence test** proving an invalid saved id falls back and a valid id round-trips unchanged.
- [ ] **Step 2: Replace profile-gender inference** in `App.jsx` with explicit `workTravelerId` state and persist on every selection.
- [ ] **Step 3: Add a transparent top-right avatar button** with a stable `40x40` hit target, a `28x28` image, no text frame, and safe-area-aware placement.
- [ ] **Step 4: Add a centered selection dialog** with four labeled rows; each row shows the female and male traveler side by side, uses a visible selected state, closes after selection, and supports backdrop/Escape dismissal.
- [ ] **Step 5: Keep the selector above map art but outside route and marker layers**; use `aria-label`, `role="dialog"`, and keyboard-focus styling.
- [ ] **Step 6: Confirm at `390x844` and `375x812`** that the selector does not overlap any building, entrance, marker, or path.
- [ ] **Step 7: Run tests and commit** with message `Add grouped work traveler selector`.

### Task 5: Generate Eight Detailed Q-Style Traveler Assets

**Files:**
- Create: `public/work-map-assets/traveler-campus-female.png`
- Create: `public/work-map-assets/traveler-campus-male.png`
- Create: `public/work-map-assets/traveler-trend-female.png`
- Create: `public/work-map-assets/traveler-trend-male.png`
- Create: `public/work-map-assets/traveler-literary-female.png`
- Create: `public/work-map-assets/traveler-literary-male.png`
- Create: `public/work-map-assets/traveler-luxe-female.png`
- Create: `public/work-map-assets/traveler-luxe-male.png`
- Delete after replacement: `public/work-map-assets/traveler-female.png`
- Delete after replacement: `public/work-map-assets/traveler-male.png`
- Modify: `src/workTravelers.test.js`

**Art direction:**

- `campus`: long braided ponytail with ribbon, blazer/cardigan layers, pleated skirt or tailored trousers, school satchel, decorated socks and sneakers.
- `trend`: long high ponytail or long wolf-cut extensions, cap/metal hair clips, layered streetwear, crossbody utility bag, charms and platform shoes.
- `literary`: long loose waves or long side braid, beret/floral clip, textured knit and long skirt or vest/shirt layers, book tote and detailed loafers.
- `luxe`: long polished curls or long low ponytail, pearl/metal hair ornament, structured coat and dress or refined jacket/trousers, miniature handbag and embellished shoes.

- [ ] **Step 1: Extend asset tests** to require all eight declared PNGs, transparent alpha, square dimensions, and non-trivial file size.
- [ ] **Step 2: Generate each traveler as a full-body front/three-quarter Q character** on flat `#00ff00`, with clean illustration, smooth shading, refined edges, low noise, and no text.
- [ ] **Step 3: Remove chroma key** with `remove_chroma_key.py`, crop consistently, resize to `256x256`, and retain transparent padding around hair, hats, and bags.
- [ ] **Step 4: Build a contact sheet** and reject any pair whose silhouette, long-hair treatment, bag, head accessory, or garment construction is only a recolor.
- [ ] **Step 5: Inspect all eight at selector size and moving-map size**, then delete the two superseded sprites.
- [ ] **Step 6: Run asset tests and commit** with message `Add detailed selectable work travelers`.

### Task 6: Map Audit and Route Calibration Batch A

**Themes:** `prehistoric`, `ancient`, `western_regions`, `xianxia`, `xuanhuan`

**Files:**
- Modify or replace: `public/work-map-assets/map-prehistoric.png`
- Modify or replace: `public/work-map-assets/map-ancient.png`
- Modify or replace: `public/work-map-assets/map-western-regions.png`
- Modify or replace: `public/work-map-assets/map-xianxia.png`
- Modify or replace: `public/work-map-assets/map-xuanhuan.png`
- Create: `src/workRouteBatches/batch-a.js`
- Create: `src/workRouteBatchA.test.js`

- [ ] **Step 1: Audit each map** for six distinct buildings, six visible entrances, five complete road connections from home, thematic specificity, 9:16 framing, and upper-right selector clearance.
- [ ] **Step 2: Redraw every failing map** with the same clean illustrated style; place all six buildings in the upper area and reserve the lower area for scenery and the five-job dock.
- [ ] **Step 3: Calibrate home and five pins** at the visible entrance centers, then trace each road bend through every fork, bridge, stair, or roundabout using the calibration tool.
- [ ] **Step 4: Add visible-segment breaks** wherever foreground rocks, gates, trees, bridge rails, or architecture should cover the route.
- [ ] **Step 5: Generate and inspect 25 route screenshots** for this batch; correct every marker or dashed segment that does not sit on the road.
- [ ] **Step 6: Run route and asset tests and commit** with message `Calibrate ancient and eastern work routes`.

### Task 7: Map Audit and Route Calibration Batch B

**Themes:** `mystic_realm`, `underworld`, `medieval`, `western_fantasy`, `fantasy`

**Files:**
- Modify or replace: `public/work-map-assets/map-mystic-realm.png`
- Modify or replace: `public/work-map-assets/map-underworld.png`
- Modify or replace: `public/work-map-assets/map-medieval.png`
- Modify or replace: `public/work-map-assets/map-western-fantasy.png`
- Modify or replace: `public/work-map-assets/map-fantasy.png`
- Create: `src/workRouteBatches/batch-b.js`
- Create: `src/workRouteBatchB.test.js`

- [ ] **Step 1: Apply the six-building, entrance, road-completeness, 9:16, and selector-clearance audit** to all five themes.
- [ ] **Step 2: Redraw failing maps** so mystic, underworld, medieval, western-fantasy, and fantasy compositions are visually distinct and not palette-swapped copies.
- [ ] **Step 3: Calibrate five independent routes per map** from the real home door to each real job door, including all visible curves and elevation transitions.
- [ ] **Step 4: Inspect all 25 screenshots** and correct line/marker/occlusion mismatches.
- [ ] **Step 5: Run tests and commit** with message `Calibrate mystic and western fantasy routes`.

### Task 8: Map Audit and Route Calibration Batch C

**Themes:** `magic_world`, `magic_academy`, `island`, `ocean`, `republican`

**Files:**
- Modify or replace: `public/work-map-assets/map-magic-world.png`
- Modify or replace: `public/work-map-assets/map-magic-academy.png`
- Modify or replace: `public/work-map-assets/map-island.png`
- Modify or replace: `public/work-map-assets/map-ocean.png`
- Modify or replace: `public/work-map-assets/map-republican.png`
- Create: `src/workRouteBatches/batch-c.js`
- Create: `src/workRouteBatchC.test.js`

- [ ] **Step 1: Audit and redraw as required**, ensuring island/ocean routes use visible boardwalks, bridges, piers, or paths rather than crossing water.
- [ ] **Step 2: Keep magic world and magic academy architecturally distinct**, and keep republican-era structures, streets, and props historically legible.
- [ ] **Step 3: Calibrate 25 independent routes and all six markers per map** against actual entrance geometry.
- [ ] **Step 4: Inspect all 25 screenshots**, including foreground occlusion and upper-right selector clearance.
- [ ] **Step 5: Run tests and commit** with message `Calibrate magic coastal and republican routes`.

### Task 9: Map Audit and Route Calibration Batch D

**Themes:** `hong_kong`, `modern`, `campus`, `ice_age`, `wasteland`

**Files:**
- Modify or replace: `public/work-map-assets/map-hong-kong.png`
- Modify or replace: `public/work-map-assets/map-modern.png`
- Modify or replace: `public/work-map-assets/map-campus.png`
- Modify or replace: `public/work-map-assets/map-ice-age.png`
- Modify or replace: `public/work-map-assets/map-wasteland.png`
- Create: `src/workRouteBatches/batch-d.js`
- Create: `src/workRouteBatchD.test.js`

- [ ] **Step 1: Re-audit modern cafe alignment** and correct the known case where the marker/path identifies a flower bed instead of the cafe entrance.
- [ ] **Step 2: Redraw failing maps** so Hong Kong, modern city, campus, ice-age settlement, and wasteland have distinct street/path networks and a clear home.
- [ ] **Step 3: Calibrate all 25 routes**, preserving road curves and avoiding plazas or scenery that only resemble roads.
- [ ] **Step 4: Inspect all 25 screenshots** at phone size and correct every entrance and path mismatch.
- [ ] **Step 5: Run tests and commit** with message `Calibrate modern campus and survival routes`.

### Task 10: Map Audit and Route Calibration Batch E

**Themes:** `cyberpunk`, `scifi`, `alien_civilization`, `online_game`, `cthulhu`

**Files:**
- Modify or replace: `public/work-map-assets/map-cyberpunk.png`
- Modify or replace: `public/work-map-assets/map-scifi.png`
- Modify or replace: `public/work-map-assets/map-alien-civilization.png`
- Modify or replace: `public/work-map-assets/map-online-game.png`
- Modify or replace: `public/work-map-assets/map-cthulhu.png`
- Create: `src/workRouteBatches/batch-e.js`
- Create: `src/workRouteBatchE.test.js`
- Modify after all five batches land: `src/workRouteData.js`
- Modify after all five batches land: `src/workRouteData.test.js`
- Modify after all five batches land: `src/workThemes.js`

- [ ] **Step 1: Audit and redraw as required**, using visible neon streets, station corridors, alien causeways, game-world paths, or occult port roads rather than implied straight travel.
- [ ] **Step 2: Keep the five themes compositionally distinct**, with different road topology and building silhouettes rather than repeated left-center-right layouts.
- [ ] **Step 3: Calibrate all 25 routes and marker entrances**, including visible-segment breaks for foreground structures.
- [ ] **Step 4: Inspect all 25 screenshots** and correct all mismatches.
- [ ] **Step 5: Import all five batch modules into `workRouteData.js`**, add the final completeness test requiring exactly 25 route themes and 125 routes, then delete `MAP_PLACE_LAYOUTS`, `GENERATED_MAP_COORDINATES`, and `buildGeneratedRoadRoute` so no generic route fallback remains.
- [ ] **Step 6: Run tests and commit** with message `Calibrate future game and cthulhu routes`.

### Task 11: Work Map Rendering, Travel Motion, and Exact Countdown

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/workThemes.js`
- Test: `src/workThemes.test.js`
- Test: `src/workRouteData.test.js`

- [ ] **Step 1: Add failing rendering-state tests** for travel, work, complete, and stopped sessions; assert that travel uses `routeSamples`, work locks other start buttons, and stopping travel earns zero.
- [ ] **Step 2: Replace the SVG `<polyline>`** with one `<path>` per `routeSegments` entry, using rounded dashed strokes; keep markers and traveler on separate layers.
- [ ] **Step 3: Drive traveler position from `interpolateWorkRoute(routeSamples, progress)`** and switch to work only at the final entrance sample.
- [ ] **Step 4: Use `formatWorkDuration` everywhere** for travel and work labels; update the ticking state at a boundary-aligned interval so the visible value changes every second without minute rounding.
- [ ] **Step 5: Render all five jobs in the lower dock without covering the map's six buildings**; selected job shows distance, current phase, and the smaller stop/start controls required by the existing work design.
- [ ] **Step 6: Allow browsing and selecting another building while work is active but disable every second start action** until the active job completes or is stopped.
- [ ] **Step 7: Run all tests and commit** with message `Render exact routed work travel`.

### Task 12: Full Visual QA, Version Bump, and Deployment

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx` if the displayed version is hardcoded
- Regenerate: `dist/`
- Regenerate: `docs/` excluding `docs/superpowers/`
- Modify: `docs/.deploy-version`
- Create: `docs/superpowers/qa/work-routes-contact-sheet.png`
- Create: `docs/superpowers/qa/work-travelers-contact-sheet.png`

- [ ] **Step 1: Run `npm test`** and require the full suite to pass.
- [ ] **Step 2: Run `npm run build`** and require a clean Vite build.
- [ ] **Step 3: Run `npm run verify:routes`** to capture all 125 route states at `390x844`; assemble a readable contact sheet grouped by theme.
- [ ] **Step 4: Verify all eight travelers** in the selector and on-map movement, persistence after reload, long-hair/detail requirements, and no selector/building overlap at `390x844` and `375x812`.
- [ ] **Step 5: Verify session timing** at `00:59`, `01:00`, `59:59`, `01:00:00`, arrival, completion, stop during travel, and stop during work.
- [ ] **Step 6: Bump version to `0.2.91`** in `package.json`, `package-lock.json`, displayed asset query strings/version labels, and `docs/.deploy-version`; rebuild after the bump.
- [ ] **Step 7: Sync `dist/` to `docs/`** with `rsync -a --delete --exclude='.nojekyll' --exclude='.deploy-version' --exclude='superpowers/' dist/ docs/`.
- [ ] **Step 8: Run `git diff --check` and `git status --short`**, stage explicit implementation and deployment files, and confirm `designs/` remains untracked and unstaged.
- [ ] **Step 9: Commit with message `Add calibrated work travel maps` and push `main`**.
- [ ] **Step 10: Verify live deployment** by checking `https://sy719427083-glitch.github.io/ai-roleplay-phone/.deploy-version`, the hashed JS/CSS assets, all eight traveler PNGs, and representative maps from every calibration batch.
