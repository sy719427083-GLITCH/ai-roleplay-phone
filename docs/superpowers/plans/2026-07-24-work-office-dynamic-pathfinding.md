# Work Office Dynamic Pathfinding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center office avatars behind their desks and replace fixed waypoint movement with slower, smoothed A* routes that avoid desk and tea-counter PNGs.

**Architecture:** Add a viewport-aware geometry module that reproduces the scene's CSS sizing and PNG alpha bounds, then use a pure A* module to plan and simplify collision-free paths. Keep React responsible only for measuring the scene, requesting a route, and advancing through timed path segments.

**Tech Stack:** React, JavaScript ES modules, CSS, Node test runner, Playwright, Vite, GitHub Pages

## Global Constraints

- Boss home center stays at `x: 50%`; left employee centers become `x: 22%`; right employee centers become `x: 78%`.
- Tea counter becomes `64% × 18%` and retains `top: 6%; right: 2%`.
- A* uses an eight-direction grid with a `2%` step and viewport-pixel movement cost.
- Smoothed segments may replace grid nodes only when the replacement stays outside every furniture collision rectangle.
- Travel timing is `700 ms` per `12%` of scene distance with a `240 ms` minimum segment duration.
- Existing untracked PNG files and generated QA drift must not be staged or deleted.

---

### Task 1: Viewport-aware office geometry

**Files:**
- Create: `src/work/officeGeometry.js`
- Create: `src/work/officeGeometry.test.js`

**Interfaces:**
- Produces: `OFFICE_HOME_POINTS`, `OFFICE_INTERACTION_POINTS`, `OFFICE_LAYOUT`, `getOfficeGeometry(viewport)`, and `getOfficePoint(id)`.
- `getOfficeGeometry({ width, height })` returns `{ obstacles, homePoints, interactionPoints }`, with all point and rectangle coordinates normalized to percentages.
- `officeState.js` derives valid persisted waypoint ids from `Object.keys(OFFICE_HOME_POINTS)` and `Object.keys(OFFICE_INTERACTION_POINTS)`; geometry does not reintroduce the old fixed route graph.

- [ ] **Step 1: Write the failing geometry tests**

Create tests that express the approved centers and responsive furniture bounds:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_HOME_POINTS,
  OFFICE_LAYOUT,
  getOfficeGeometry,
  getOfficePoint,
} from "./officeGeometry.js";

test("centers avatars behind the visible desk art", () => {
  assert.deepEqual(OFFICE_HOME_POINTS["boss-home"], { x: 50, y: 24 });
  assert.deepEqual([1, 3, 5].map((number) => OFFICE_HOME_POINTS[`employee${number}-home`].x), [22, 22, 22]);
  assert.deepEqual([2, 4, 6].map((number) => OFFICE_HOME_POINTS[`employee${number}-home`].x), [78, 78, 78]);
});

test("uses the approved smaller tea counter layout", () => {
  assert.deepEqual(OFFICE_LAYOUT.tea, { top: 6, right: 2, width: 64, height: 18 });
});

test("derives responsive visible furniture bounds", () => {
  const narrow = getOfficeGeometry({ width: 375, height: 812 });
  const wide = getOfficeGeometry({ width: 390, height: 844 });
  assert.equal(narrow.obstacles.length, 8);
  assert.equal(wide.obstacles.length, 8);
  assert.notDeepEqual(narrow.obstacles, wide.obstacles);
  assert.deepEqual(getOfficePoint("employee6-home"), { x: 78, y: 72 });
});
```

- [ ] **Step 2: Run the geometry test and verify RED**

Run:

```bash
node --test src/work/officeGeometry.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because the geometry module does not exist.

- [ ] **Step 3: Implement the geometry module**

Define the CSS-equivalent layout and alpha bounds:

```js
export const OFFICE_HOME_POINTS = Object.freeze({
  "boss-home": { x: 50, y: 24 },
  "employee1-home": { x: 22, y: 40 },
  "employee2-home": { x: 78, y: 40 },
  "employee3-home": { x: 22, y: 56 },
  "employee4-home": { x: 78, y: 56 },
  "employee5-home": { x: 22, y: 72 },
  "employee6-home": { x: 78, y: 72 },
});

export const OFFICE_LAYOUT = Object.freeze({
  boss: { top: 23, left: 50, width: { min: 222, vw: 62, max: 258 }, height: { min: 138, vh: 19, max: 164 }, alpha: [41 / 720, 67 / 480, 676 / 720, 405 / 480] },
  employee: { width: { min: 164, vw: 48, max: 198 }, height: { min: 108, vh: 15, max: 132 }, alpha: [55 / 520, 41 / 360, 449 / 520, 303 / 360] },
  tea: { top: 6, right: 2, width: 64, height: 18, alpha: [79 / 900, 9 / 520, 820 / 900, 505 / 520] },
});
```

Implement clamp sizing, visible alpha rectangles, directional walking clearance, and clear destination points. Use `AVATAR_CLEARANCE_PX = 28`: inflate desk rectangles on the left, right, and bottom only, leaving their alpha-derived top edge uninflated so the approved behind-desk home points remain legal; inflate the tea rectangle on all four sides. Define the tea interaction point at `{ x: 93, y: 28 }`, below and to the right of the visible counter art. Assert in tests that every home/interaction point is outside every returned obstacle.

- [ ] **Step 4: Run the geometry test and verify GREEN**

Run:

```bash
node --test src/work/officeGeometry.test.js
```

Expected: all geometry tests PASS.

- [ ] **Step 5: Commit geometry**

```bash
git add src/work/officeGeometry.js src/work/officeGeometry.test.js
git commit -m "feat: model responsive office geometry"
```

### Task 2: A* routing, collision checks, and smoothing

**Files:**
- Create: `src/work/officePathfinding.js`
- Create: `src/work/officePathfinding.test.js`

**Interfaces:**
- Consumes: normalized points and obstacle rectangles from `getOfficeGeometry(viewport)`.
- Produces: `planOfficePath({ start, goal, viewport, obstacles, gridStep })`, `segmentIntersectsRect(from, to, rect, viewport)`, `simplifyOfficePath(path, obstacles, viewport)`, `getSegmentDuration(from, to, viewport)`, and `getSegmentFacing(from, to)`.

- [ ] **Step 1: Write failing pathfinder tests**

Cover route existence, collision avoidance, dynamic rerouting, timing, and facing:

```js
test("plans and smooths collision-free routes between office destinations", () => {
  const viewport = { width: 390, height: 844 };
  const geometry = getOfficeGeometry(viewport);
  for (const fromId of Object.keys(geometry.homePoints)) {
    for (const toId of [...Object.keys(geometry.homePoints), "tea-counter"]) {
      if (fromId === toId) continue;
      const path = planOfficePath({
        start: geometry.homePoints[fromId],
        goal: toId === "tea-counter" ? geometry.interactionPoints[toId] : geometry.homePoints[toId],
        viewport,
        obstacles: geometry.obstacles,
      });
      assert.ok(path.length >= 2, `${fromId} routes to ${toId}`);
      for (let index = 1; index < path.length; index += 1) {
        assert.equal(geometry.obstacles.some((rect) => segmentIntersectsRect(path[index - 1], path[index], rect, viewport)), false);
      }
    }
  }
});

test("reroutes when a new obstacle blocks the direct line", () => {
  const viewport = { width: 390, height: 844 };
  const direct = planOfficePath({ start: { x: 10, y: 90 }, goal: { x: 90, y: 90 }, viewport, obstacles: [] });
  const blocked = planOfficePath({ start: { x: 10, y: 90 }, goal: { x: 90, y: 90 }, viewport, obstacles: [{ id: "block", left: 44, top: 82, right: 56, bottom: 98 }] });
  assert.notDeepEqual(blocked, direct);
  assert.ok(blocked.length > direct.length);
});

test("uses approved distance timing and horizontal facing", () => {
  const viewport = { width: 390, height: 844 };
  assert.equal(getSegmentDuration({ x: 10, y: 50 }, { x: 22, y: 50 }, viewport), 700);
  assert.equal(getSegmentFacing({ x: 50, y: 50 }, { x: 40, y: 50 }), "left");
});
```

- [ ] **Step 2: Run the pathfinder test and verify RED**

Run:

```bash
node --test src/work/officePathfinding.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because the pathfinder module does not exist.

- [ ] **Step 3: Implement A* and safe smoothing**

Implement an eight-neighbor grid at `gridStep = 2`, pixel-distance edge costs and heuristic, a binary-minimum open set or sorted frontier suitable for the roughly 2,500 grid cells, and parent reconstruction. Insert the exact start and goal points as temporary graph nodes and connect each only to traversable grid cells reachable by collision-free line of sight; this preserves non-grid-aligned desk centers without weakening collision checks.

Implement simplification in two passes:

```js
export function simplifyOfficePath(path, obstacles, viewport) {
  const collinear = removeCollinearPoints(path);
  const simplified = [collinear[0]];
  let anchor = 0;
  while (anchor < collinear.length - 1) {
    let candidate = collinear.length - 1;
    while (candidate > anchor + 1 && obstacles.some((rect) => segmentIntersectsRect(collinear[anchor], collinear[candidate], rect, viewport))) candidate -= 1;
    simplified.push(collinear[candidate]);
    anchor = candidate;
  }
  return simplified;
}
```

Return an empty array when no route exists. Calculate timing from pixel distance normalized so a horizontal `12%` move on the current viewport is exactly `700 ms`, with a `240 ms` minimum.

- [ ] **Step 4: Run the pathfinder tests and verify GREEN**

Run:

```bash
node --test src/work/officeGeometry.test.js src/work/officePathfinding.test.js
```

Expected: all geometry and pathfinding tests PASS.

- [ ] **Step 5: Commit pathfinding**

```bash
git add src/work/officePathfinding.js src/work/officePathfinding.test.js
git commit -m "feat: add smoothed office A star routing"
```

### Task 3: Integrate dynamic movement with the office UI

**Files:**
- Modify: `src/work/officeNavigation.js`
- Modify: `src/work/officeNavigation.test.js`
- Modify: `src/work/officeState.js`
- Modify: `src/work/officeState.test.js`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/OfficeCharacter.jsx`
- Modify: `src/work/office.css`
- Modify: `src/work/workScreen.test.js`
- Modify: `scripts/verify-work-office.mjs`

**Interfaces:**
- `createOfficeRoute({ from, destination, viewport })` returns an array of `{ point, durationMs, facing }` segments.
- `OfficeScene` accepts `sceneRef` and applies it to the scene `<main>`.
- `OfficeCharacter` accepts `node`, `durationMs`, `moving`, and `facing`.

- [ ] **Step 1: Write failing integration tests**

Replace fixed-graph assertions with the dynamic route contract and add source/CSS contracts:

```js
test("creates timed collision-free routes for every clickable destination", () => {
  const viewport = { width: 390, height: 844 };
  for (const fromId of Object.values(OBJECT_DESTINATIONS)) {
    for (const destination of Object.values(OBJECT_DESTINATIONS)) {
      const route = createOfficeRoute({ from: getOfficePoint(fromId), destination, viewport });
      if (fromId === destination) assert.deepEqual(route, []);
      else assert.ok(route.every((segment) => segment.durationMs >= 240 && ["left", "right"].includes(segment.facing)));
    }
  }
});
```

Add source checks for `sceneRef`, `durationMs`, `createOfficeRoute`, the `700` ms timing contract, employee centers `22/78`, and CSS tea size `64% × 18%`. Remove checks tied to `OFFICE_NODES` and fixed BFS edges.

Update browser QA before changing production code: sample `.office-character-body` bounds every `100 ms` during a boss-to-employee-six and employee-six-to-tea route, derive visible furniture rectangles from the known PNG alpha bounds, and fail if a moving sample overlaps furniture outside its starting or final reserved pocket. Assert that movement remains active beyond the former `430 ms` step duration.

- [ ] **Step 2: Run integration tests and verify RED**

Run:

```bash
node --test src/work/officeNavigation.test.js src/work/workScreen.test.js
npm run verify:work
```

Expected: unit tests FAIL because the fixed `OFFICE_NODES` BFS route and fixed `430 ms` timer still exist; browser QA FAILS when the old route crosses furniture or completes a step too quickly.

- [ ] **Step 3: Implement navigation adapter and measured scene routing**

Keep `OBJECT_DESTINATIONS` stable. Replace `findOfficeRoute` with `createOfficeRoute`, which calls `getOfficeGeometry`, chooses the destination point, calls `planOfficePath`, and converts every point after the start into a timed segment.

Update `officeState.js` to derive `VALID_WAYPOINTS` with `new Set([...Object.keys(OFFICE_HOME_POINTS), ...Object.keys(OFFICE_INTERACTION_POINTS)])` instead of importing `OFFICE_NODES`. Keep the persisted `meWaypoint` schema unchanged so existing V1 storage restores without migration.

In `WorkAppScreen.jsx`:

```js
const sceneRef = useRef(null);
const [meMovement, setMeMovement] = useState({ point: getOfficePoint(state.meWaypoint), moving: false, facing: "right", durationMs: 0 });

const moveMe = (destination) => {
  if (!meOccupant) return showNotice("请先在员工管理中安排“我 APP”的角色");
  const bounds = sceneRef.current?.getBoundingClientRect();
  if (!bounds) return showNotice("办公室路线暂时不可用");
  const route = createOfficeRoute({ from: meMovement.point, destination, viewport: { width: bounds.width, height: bounds.height } });
  if (!route.length) return showNotice("这里暂时没有可通行的路线");
  // Advance through route segments using each segment.durationMs.
};
```

Update state only at the final named destination so persisted state continues to contain valid destination ids. Pass `sceneRef` through `OfficeScene`; resolve non-Me occupant homes through `getOfficePoint`; and pass dynamic transition duration to `OfficeCharacter` through `--walk-duration`.

- [ ] **Step 4: Apply approved CSS movement and tea sizing**

Set `.office-object.tea` to `width: 64%; height: 18%`. Change `.office-character` transition durations to `var(--walk-duration, 700ms)` and slow `.office-character.is-moving .office-character-body` to a walking bob duration that matches the new speed. Do not change desk CSS sizes or positions.

- [ ] **Step 5: Run integration and full unit tests**

Run:

```bash
node --test src/work/officeGeometry.test.js src/work/officePathfinding.test.js src/work/officeNavigation.test.js src/work/workScreen.test.js
npm test
npm run verify:work
```

Expected: all focused tests, the full suite, and collision-sampling browser QA PASS.

- [ ] **Step 6: Commit UI integration**

```bash
git add src/work/officeNavigation.js src/work/officeNavigation.test.js src/work/officeState.js src/work/officeState.test.js src/work/WorkAppScreen.jsx src/work/OfficeScene.jsx src/work/OfficeCharacter.jsx src/work/office.css src/work/workScreen.test.js scripts/verify-work-office.mjs
git commit -m "feat: integrate collision-free office walking"
```

### Task 4: Browser collision QA and V0.3.3 release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/App.launcher.test.js`
- Update: `artifacts/work-office-qa/office-375x812.png`
- Update: `artifacts/work-office-qa/office-390x844.png`
- Update: `docs/.deploy-version`
- Update: `docs/index.html`
- Replace: `docs/assets/index-*.js`
- Replace: `docs/assets/index-*.css`
- Sync: `docs/work-office-assets/`

**Interfaces:**
- Consumes: the complete dynamic movement implementation and existing Pages sync/deploy workflow.
- Produces: release `0.3.3` on `main`, with both Pages deployment paths serving identical office assets.

- [ ] **Step 1: Add the failing release-marker test**

Change `src/App.launcher.test.js` to expect `0.3.3` package, label, and cache markers. Browser collision QA is already added test-first in Task 3.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test src/App.launcher.test.js
```

Expected: release test FAILS on `0.3.2`.

- [ ] **Step 3: Update release markers**

Set package and lockfile versions, app label, and cache queries to `0.3.3`.

- [ ] **Step 4: Run complete local verification and sync Pages**

Run:

```bash
set -e
npm test
npm run verify:work
npm run deploy:pages
npm test
git diff --check
```

Expected: all tests PASS, both mobile QA sizes PASS, Vite build succeeds, and `docs/.deploy-version` equals `0.3.3`.

- [ ] **Step 5: Commit release without unrelated files**

Stage the release sources, generated bundles, official `office-background.png` and `orbit-*.png` assets, and deterministic QA screenshots. Do not stage the untracked legacy `boss-desk.png`, `employee-desk.png`, or `tea-counter.png` files.

```bash
git add package.json package-lock.json src/App.jsx src/styles.css src/App.launcher.test.js scripts/verify-work-office.mjs docs/.deploy-version docs/index.html docs/assets docs/work-office-assets/office-background.png docs/work-office-assets/orbit-*.png artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "chore: publish dynamic office walking V0.3.3"
```

- [ ] **Step 6: Publish and verify both deployment paths**

```bash
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
```

Wait until both `Deploy GitHub Pages` and `pages build and deployment` for the pushed commit complete successfully. Then verify the live V0.3.3 bundle, all office image URLs return `200`, all eight object images decode with nonzero natural dimensions, and a live route completes without crossing furniture.
