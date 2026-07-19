# Real Office Pixi Two-Scene Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current rug-based DOM office with a high-definition PixiJS office and lounge simulation that has identical employee desks, physical collision, continuous alternating-leg walking, desk-side conversations, concrete workplace activities, and conversation-only records.

**Architecture:** React retains the Work shell, assignment flow, controls, names, statuses, speech bubbles, and record panel. A PixiJS v8 renderer owns two persistent scene graphs and consumes a pure serializable office-world state; `pathfinding` supplies A* routes over collision-expanded grids. Environment and character art use manifest-driven lazy bundles so only the visible scenes, five assigned characters, locomotion sheets, and active action strips are decoded.

**Tech Stack:** React 19, PixiJS `8.19.0`, `pathfinding` `0.4.18`, Vite 6, Node test runner, Sharp-based asset scripts, Playwright 1.61, GitHub Pages.

## Global Constraints

- Release version is exactly `0.2.98`.
- The office has one upper-center boss desk and four identical employee desks in a `2 x 2` layout.
- The office background has no rugs, carpet rectangles, cubicle walls, or employee-specific floor zones.
- The office door is at the lower-right and leads to a persistent lounge containing pantry, dining, sofa, and television zones.
- Characters cross scenes only through paired door anchors.
- Every solid object has a collision shape; characters must never stand in furniture or overlap one another.
- Character art is body-only. No character frame contains furniture, food, screens, books, phones, files, or other props.
- Walking uses eight frames per direction at exactly `9 FPS` and visibly alternates left and right legs.
- Source character frames are at least `512 x 512`; production action strips use `384 x 384` cells after full-size and runtime-size QA.
- Scene architecture masters are `2160 x 3840`; runtime rendering uses device resolution capped at `2`.
- The palette is pearl white, light neutral gray, mist blue, muted lavender, and restrained dusty rose; green is not dominant.
- The three-dot panel records conversations only. Non-conversation activities are never persisted as records.
- Boss profiles come from the selected Me protagonist; employee profiles come from selected Character main-character or NPC profiles.
- Existing `.superpowers/sdd/progress.md` changes are user-owned and must remain uncommitted and untouched.

---

## File Structure

### New Pure Domain Modules

- `src/work/officeSceneManifest.js`: scene dimensions, object instances, colliders, anchors, depth zones, and door pairs.
- `src/work/officeActivityManifest.js`: authoritative activity-to-scene, anchor, clip, prop, duration, and participant rules.
- `src/work/officePathfinding.js`: collision-grid construction, capsule expansion, A* route generation, path smoothing, and world/grid conversion.
- `src/work/officeReservations.js`: atomic single- and multi-anchor reservations.
- `src/work/officeWorld.js`: cross-scene routes, continuous movement sampling, legal activity placement, and world-to-overlay snapshots.
- `src/work/officeConversationRecords.js`: conversation-only persistence, migration, grouping, and filtering.

### New Pixi Modules

- `src/work/pixi/officeAssetManifest.js`: Pixi bundle aliases and character clip sources.
- `src/work/pixi/createOfficeRenderer.js`: Pixi Application lifecycle and scene graph roots.
- `src/work/pixi/OfficeActorView.js`: body-only actor sprites, action strips, facing, frame timing, and depth sorting.
- `src/work/pixi/OfficeSceneView.js`: environment objects, rear/front layers, occlusion masks, props, doors, and scene visibility.
- `src/work/pixi/OfficeCanvas.jsx`: React mount point and state/command bridge.

### React Modules

- `src/work/OfficeScene.jsx`: replace DOM art rendering with `OfficeCanvas` plus React overlays.
- `src/work/OfficeActorOverlay.jsx`: names, statuses, and speech bubbles from renderer coordinates.
- `src/work/OfficeConversationPanel.jsx`: conversation-only record UI.
- `src/work/WorkAppScreen.jsx`: world ticker, scene switching, scheduling, assignment integration, and runtime cleanup.

### Asset Tooling

- `scripts/office-v2-art-spec.mjs`: authoritative asset IDs, dimensions, clip IDs, and no-furniture constraints.
- `scripts/normalize-office-v2-art.mjs`: crop, sharpen, alpha-clean, resize, and slice generated masters.
- `scripts/build-office-v2-contact-sheets.mjs`: full-size and runtime-size contact sheets.
- `scripts/verify-office-v2-assets.mjs`: dimensions, alpha, gutters, populated frames, duplicate-desk, and file inventory checks.

### Asset Trees

- `public/work-office-v2/scenes/`
- `public/work-office-v2/furniture/`
- `public/work-office-v2/props/`
- `public/work-office-v2/characters/<character-id>/`

### Replaced Or Removed After Migration

- `src/work/OfficeCharacter.jsx`
- `src/work/OfficeActivityPanel.jsx`
- `src/work/officeNavigation.js`
- `src/work/officeStations.js`
- `public/work-office-assets/`

---

### Task 1: Install Rendering Dependencies And Define The Scene Contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/work/officeSceneManifest.js`
- Create: `src/work/officeSceneManifest.test.js`

**Interfaces:**
- Produces: `OFFICE_WORLD_SIZE`, `OFFICE_SCENES`, `OFFICE_DOOR_PAIRS`, `getSceneAnchor(sceneId, anchorId)`, and `getSceneObject(sceneId, objectId)`.
- Consumers: Tasks 2-5 and 11-14.

- [ ] **Step 1: Write the failing scene-contract tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFICE_DOOR_PAIRS,
  OFFICE_SCENES,
  OFFICE_WORLD_SIZE,
  getSceneAnchor,
} from "./officeSceneManifest.js";

test("defines two physical scenes and four identical employee desk instances", () => {
  assert.deepEqual(OFFICE_WORLD_SIZE, { width: 1080, height: 1920 });
  assert.deepEqual(Object.keys(OFFICE_SCENES).sort(), ["lounge", "office"]);
  const desks = OFFICE_SCENES.office.objects.filter((object) => object.templateId === "employee-desk");
  assert.equal(desks.length, 4);
  assert.equal(new Set(desks.map((desk) => desk.assetId)).size, 1);
  assert.deepEqual(desks.map((desk) => desk.slotId), ["employee1", "employee2", "employee3", "employee4"]);
});

test("pairs the lower-right office door with the lounge return door", () => {
  assert.deepEqual(OFFICE_DOOR_PAIRS["office:exit"], { sceneId: "lounge", anchorId: "entry" });
  assert.deepEqual(OFFICE_DOOR_PAIRS["lounge:exit"], { sceneId: "office", anchorId: "entry" });
  assert.ok(getSceneAnchor("office", "exit").x > 850);
  assert.ok(getSceneAnchor("office", "exit").y > 1600);
});

test("contains no rug or carpet objects", () => {
  const ids = Object.values(OFFICE_SCENES).flatMap((scene) => scene.objects.map((object) => object.id));
  assert.equal(ids.some((id) => /rug|carpet/i.test(id)), false);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test src/work/officeSceneManifest.test.js`

Expected: FAIL because `officeSceneManifest.js` does not exist.

- [ ] **Step 3: Install pinned dependencies**

Run: `npm install pixi.js@8.19.0 pathfinding@0.4.18`

Expected: `package.json` and `package-lock.json` contain both exact resolved dependency versions with no audit installation error.

- [ ] **Step 4: Implement the scene manifest**

Create frozen records with this public shape:

```js
export const OFFICE_WORLD_SIZE = Object.freeze({ width: 1080, height: 1920 });

const object = ({ id, templateId, assetId, slotId = "", x, y, width, height, colliders = [] }) => Object.freeze({
  id, templateId, assetId, slotId, x, y, width, height,
  colliders: Object.freeze(colliders.map((collider) => Object.freeze({ ...collider }))),
});

export const OFFICE_SCENES = Object.freeze({
  office: Object.freeze({
    id: "office",
    backgroundAssetId: "scene-office",
    objects: Object.freeze([
      object({ id: "boss-desk", templateId: "boss-desk", assetId: "boss-desk", slotId: "boss", x: 330, y: 350, width: 420, height: 250, colliders: [{ x: 330, y: 420, width: 420, height: 170 }] }),
      ...["employee1", "employee2", "employee3", "employee4"].map((slotId, index) => object({
        id: `${slotId}-desk`, templateId: "employee-desk", assetId: "employee-desk", slotId,
        x: index % 2 ? 610 : 90, y: index < 2 ? 720 : 1110, width: 380, height: 250,
        colliders: [{ x: index % 2 ? 610 : 90, y: index < 2 ? 790 : 1180, width: 380, height: 170 }],
      })),
    ]),
    anchors: Object.freeze({ entry: { x: 940, y: 1700 }, exit: { x: 940, y: 1770 } }),
  }),
  lounge: Object.freeze({
    id: "lounge",
    backgroundAssetId: "scene-lounge",
    objects: Object.freeze([]),
    anchors: Object.freeze({ entry: { x: 130, y: 1710 }, exit: { x: 90, y: 1780 } }),
  }),
});

export const OFFICE_DOOR_PAIRS = Object.freeze({
  "office:exit": Object.freeze({ sceneId: "lounge", anchorId: "entry" }),
  "lounge:exit": Object.freeze({ sceneId: "office", anchorId: "entry" }),
});
```

Use these remaining object and anchor coordinates exactly for the first implementation; art alignment may move an object and all of its colliders/anchors together, but may not change their relative geometry:

```js
const OFFICE_SHARED_OBJECTS = [
  object({ id: "printer", templateId: "printer", assetId: "printer", x: 45, y: 1430, width: 210, height: 190, colliders: [{ x: 45, y: 1490, width: 210, height: 130 }] }),
  object({ id: "file-cabinet", templateId: "file-cabinet", assetId: "file-cabinet", x: 45, y: 310, width: 190, height: 300, colliders: [{ x: 45, y: 390, width: 190, height: 220 }] }),
  object({ id: "whiteboard", templateId: "whiteboard", assetId: "whiteboard", x: 800, y: 330, width: 220, height: 300, colliders: [{ x: 800, y: 560, width: 220, height: 70 }] }),
  object({ id: "office-door", templateId: "door", assetId: "office-door", x: 875, y: 1640, width: 170, height: 280, colliders: [{ x: 875, y: 1640, width: 25, height: 280 }, { x: 1020, y: 1640, width: 25, height: 280 }] }),
];

const LOUNGE_OBJECTS = [
  object({ id: "pantry", templateId: "pantry", assetId: "pantry", x: 90, y: 250, width: 900, height: 280, colliders: [{ x: 90, y: 390, width: 900, height: 140 }] }),
  object({ id: "dining-table", templateId: "dining-table", assetId: "dining-table", x: 260, y: 720, width: 560, height: 330, colliders: [{ x: 260, y: 850, width: 560, height: 190 }] }),
  object({ id: "sofa", templateId: "sofa", assetId: "sofa", x: 90, y: 1240, width: 570, height: 300, colliders: [{ x: 90, y: 1390, width: 570, height: 150 }] }),
  object({ id: "coffee-table", templateId: "coffee-table", assetId: "coffee-table", x: 270, y: 1510, width: 330, height: 170, colliders: [{ x: 270, y: 1550, width: 330, height: 130 }] }),
  object({ id: "television", templateId: "television", assetId: "television", x: 790, y: 1260, width: 210, height: 240, colliders: [{ x: 790, y: 1360, width: 210, height: 140 }] }),
  object({ id: "lounge-door", templateId: "door", assetId: "lounge-door", x: 35, y: 1640, width: 170, height: 280, colliders: [{ x: 35, y: 1640, width: 25, height: 280 }, { x: 180, y: 1640, width: 25, height: 280 }] }),
];

const OFFICE_ANCHORS = {
  entry: { x: 940, y: 1700 }, exit: { x: 940, y: 1770 }, delivery: { x: 840, y: 1690 },
  "boss:seat": { x: 540, y: 410 }, "boss:seat-approach": { x: 540, y: 655 },
  "boss:visitor-front": { x: 540, y: 680 }, "boss:visitor-left": { x: 440, y: 665 }, "boss:visitor-right": { x: 640, y: 665 },
  "employee1:seat": { x: 280, y: 770 }, "employee1:seat-approach": { x: 280, y: 990 },
  "employee1:visitor-front": { x: 280, y: 1010 }, "employee1:visitor-left": { x: 70, y: 930 }, "employee1:visitor-right": { x: 500, y: 930 },
  "employee2:seat": { x: 800, y: 770 }, "employee2:seat-approach": { x: 800, y: 990 },
  "employee2:visitor-front": { x: 800, y: 1010 }, "employee2:visitor-left": { x: 580, y: 930 }, "employee2:visitor-right": { x: 1010, y: 930 },
  "employee3:seat": { x: 280, y: 1160 }, "employee3:seat-approach": { x: 280, y: 1380 },
  "employee3:visitor-front": { x: 280, y: 1400 }, "employee3:visitor-left": { x: 70, y: 1320 }, "employee3:visitor-right": { x: 500, y: 1320 },
  "employee4:seat": { x: 800, y: 1160 }, "employee4:seat-approach": { x: 800, y: 1380 },
  "employee4:visitor-front": { x: 800, y: 1400 }, "employee4:visitor-left": { x: 580, y: 1320 }, "employee4:visitor-right": { x: 1010, y: 1320 },
  "printer:front": { x: 300, y: 1540 }, "file-cabinet:front": { x: 285, y: 500 },
  "whiteboard:1": { x: 760, y: 690 }, "whiteboard:2": { x: 850, y: 700 }, "whiteboard:3": { x: 940, y: 710 },
};

const LOUNGE_ANCHORS = {
  entry: { x: 130, y: 1710 }, exit: { x: 90, y: 1780 },
  "pantry:pickup": { x: 300, y: 600 }, "pantry:coffee": { x: 540, y: 600 }, "pantry:water": { x: 760, y: 600 },
  "dining:seat-1": { x: 330, y: 790 }, "dining:seat-2": { x: 750, y: 790 },
  "dining:seat-3": { x: 330, y: 1110 }, "dining:seat-4": { x: 750, y: 1110 },
  "dining:visitor-1": { x: 200, y: 1080 }, "dining:visitor-2": { x: 880, y: 1080 },
  "sofa:seat-1": { x: 230, y: 1370 }, "sofa:seat-2": { x: 380, y: 1370 }, "sofa:seat-3": { x: 530, y: 1370 },
  "sofa:visitor-1": { x: 180, y: 1710 }, "sofa:visitor-2": { x: 670, y: 1710 }, "tv:view": { x: 690, y: 1500 },
};
```

- [ ] **Step 5: Run the scene tests and full suite**

Run: `node --test src/work/officeSceneManifest.test.js`

Expected: PASS, 3 tests.

Run: `npm test`

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/work/officeSceneManifest.js src/work/officeSceneManifest.test.js
git commit -m "feat: define physical office and lounge scenes"
```

### Task 2: Add Collision-Expanded A* Navigation

**Files:**
- Create: `src/work/officePathfinding.js`
- Create: `src/work/officePathfinding.test.js`
- Create: `src/work/officeReservations.js`
- Create: `src/work/officeReservations.test.js`

**Interfaces:**
- Consumes: `OFFICE_SCENES`, `getSceneAnchor(sceneId, anchorId)`.
- Produces: `buildNavigationGrid(scene, capsule)`, `findScenePath({sceneId, from, to, dynamicObstacles})`, `isLegalCharacterPosition(sceneId, point)`, `reserveAnchors(reservations, request)`, and `releaseReservationGroup(reservations, reservationGroupId)`.

- [ ] **Step 1: Write failing path and reservation tests**

```js
test("routes around every employee desk without crossing colliders", () => {
  const path = findScenePath({ sceneId: "office", from: { x: 540, y: 650 }, to: { x: 940, y: 1770 } });
  assert.ok(path.length > 2);
  for (const point of path) assert.equal(isLegalCharacterPosition("office", point), true);
});

test("atomically reserves all desk visitor anchors or none", () => {
  const request = { sceneId: "office", reservationGroupId: "chat-1", slotId: "employee1", anchorIds: ["employee2:visitor-front", "employee2:visitor-left"] };
  const claimed = reserveAnchors({}, request);
  assert.deepEqual(Object.keys(claimed).sort(), request.anchorIds.slice().sort());
  assert.equal(reserveAnchors(claimed, { ...request, reservationGroupId: "chat-2" }), null);
  assert.deepEqual(releaseReservationGroup(claimed, "chat-1"), {});
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/officePathfinding.test.js src/work/officeReservations.test.js`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement grid routing with physical-width expansion**

Use a `30` logical-pixel grid, expand each collider by the capsule radius `26`, construct `new PF.Grid(matrix)`, and run:

```js
const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
const grid = new PF.Grid(matrix);
const cells = finder.findPath(startCell.x, startCell.y, endCell.x, endCell.y, grid.clone());
return PF.Util.smoothenPath(grid, cells).map(gridToWorldPoint);
```

Reject a route when start or destination is inside an expanded collider. Validate every smoothed segment by sampling at `10` logical-pixel intervals before returning it.

- [ ] **Step 4: Implement atomic reservation groups**

Store each reservation as:

```js
{
  anchorId: "employee2:visitor-front",
  slotId: "employee1",
  reservationGroupId: "office-chat-123",
  sceneId: "office",
  expiresAt: 1780000000000,
}
```

Clone inputs, reject duplicate owners and occupied anchors, and commit only when every requested anchor is free.

- [ ] **Step 5: Run tests**

Run: `node --test src/work/officePathfinding.test.js src/work/officeReservations.test.js`

Expected: PASS with no route point inside a collider and no partial reservation.

- [ ] **Step 6: Commit**

```bash
git add src/work/officePathfinding.js src/work/officePathfinding.test.js src/work/officeReservations.js src/work/officeReservations.test.js
git commit -m "feat: add collision-aware office navigation"
```

### Task 3: Build Cross-Scene World Movement

**Files:**
- Create: `src/work/officeWorld.js`
- Create: `src/work/officeWorld.test.js`
- Modify: `src/work/officeMotion.js`
- Modify: `src/work/officeMotion.test.js`

**Interfaces:**
- Consumes: scene manifest, pathfinding, reservations.
- Produces: `buildWorldRoute({from, to})`, `sampleWorldRoute({route, startedAt, now, speed})`, `separateActors(actors)`, and `createOverlaySnapshot(world, visibleSceneId)`.

- [ ] **Step 1: Write failing world-route tests**

```js
test("crosses scenes only through paired doors", () => {
  const route = buildWorldRoute({
    from: { sceneId: "office", x: 250, y: 980 },
    to: { sceneId: "lounge", x: 540, y: 820 },
  });
  const transfer = route.filter((point) => point.transition);
  assert.equal(transfer.length, 1);
  assert.deepEqual(transfer[0], {
    transition: true,
    from: { sceneId: "office", anchorId: "exit" },
    to: { sceneId: "lounge", anchorId: "entry" },
  });
});

test("samples movement continuously and alternates walk frames at 9 FPS", () => {
  const route = [
    { sceneId: "office", x: 540, y: 650 },
    { sceneId: "office", x: 540, y: 850 },
  ];
  const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
  const samples = Array.from({ length: 90 }, (_, index) => sampleWorldRoute({ route, startedAt: 0, now: index * 16, speed: 92 }));
  assert.ok(Math.max(...samples.slice(1).map((sample, index) => distance(sample, samples[index]))) < 4);
  assert.deepEqual([0, 112, 223, 334].map((now) => getWalkFrame({ startedAt: 0, now })), [0, 1, 2, 3]);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/officeWorld.test.js src/work/officeMotion.test.js`

Expected: FAIL because cross-scene routes and 9 FPS timing do not exist.

- [ ] **Step 3: Implement world routes and movement sampling**

Represent route entries as either `{sceneId, x, y}` or one explicit transition record. Preserve linear interpolation within each scene. At transition completion, emit the destination entry coordinate and continue using remaining elapsed route distance.

Set `WALK_FRAME_MS = 1000 / 9` and return `Math.floor(elapsed / WALK_FRAME_MS) % 8`.

- [ ] **Step 4: Add local actor separation**

For moving actors in the same scene, enforce a `52` logical-pixel foot-capsule center distance. Apply equal and opposite lateral displacement only when the adjusted points remain legal; otherwise make the later route owner wait for the frame.

- [ ] **Step 5: Run tests and commit**

Run: `node --test src/work/officeWorld.test.js src/work/officeMotion.test.js`

Expected: PASS.

```bash
git add src/work/officeWorld.js src/work/officeWorld.test.js src/work/officeMotion.js src/work/officeMotion.test.js
git commit -m "feat: add continuous cross-scene movement"
```

### Task 4: Create The PixiJS Runtime And React Bridge

**Files:**
- Create: `src/work/pixi/officeAssetManifest.js`
- Create: `src/work/pixi/createOfficeRenderer.js`
- Create: `src/work/pixi/OfficeSceneView.js`
- Create: `src/work/pixi/OfficeCanvas.jsx`
- Create: `src/work/pixi/officeRenderer.test.js`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/office.css`

**Interfaces:**
- Produces: `createOfficeRenderer({host, onFrame, onDoorSelect, onActorSelect})` returning `{sync(world), setVisibleScene(sceneId), worldToScreen(point), destroy()}`.
- `OfficeCanvas` props: `{world, visibleSceneId, onFrame, onDoorSelect, onActorSelect, onReady, onError}`.

- [ ] **Step 1: Write failing source and browser smoke tests**

Assert that the renderer initializes `Application.init`, sets `autoDensity: true`, caps resolution at `2`, and destroys the application on unmount. Add a Playwright smoke assertion for one canvas with `data-office-renderer="pixi"` and nonzero backing dimensions.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/pixi/officeRenderer.test.js`

Expected: FAIL because the Pixi modules do not exist.

- [ ] **Step 3: Implement renderer lifecycle**

```js
const app = new Application();
await app.init({
  resizeTo: host,
  autoDensity: true,
  resolution: Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1)),
  antialias: true,
  backgroundAlpha: 0,
  preference: "webgl",
});
app.canvas.dataset.officeRenderer = "pixi";
host.replaceChildren(app.canvas);
```

Create persistent `office` and `lounge` root containers. Toggle `visible` and `eventMode` without destroying inactive scene state. On cleanup, remove the ticker callback, unload character action strips, and call `app.destroy(true, { children: true, texture: true })`.

- [ ] **Step 4: Replace DOM furniture rendering with the canvas bridge**

Keep `OfficeScene.jsx` as a React shell. Remove `.office-scene-background`, `.office-module-layer`, and DOM character sprites. Render `OfficeCanvas` and a dedicated overlay container only.

- [ ] **Step 5: Run focused tests and build**

Run: `node --test src/work/pixi/officeRenderer.test.js src/work/WorkAppScreen.test.js`

Expected: PASS.

Run: `npm run build`

Expected: Vite build succeeds with PixiJS included.

- [ ] **Step 6: Commit**

```bash
git add src/work/pixi src/work/OfficeScene.jsx src/work/office.css
git commit -m "feat: mount persistent Pixi office scenes"
```

### Task 5: Create High-Definition Environment, Furniture, And Props

**Files:**
- Create: `scripts/office-v2-art-spec.mjs`
- Create: `scripts/office-v2-art-spec.test.mjs`
- Create: `scripts/normalize-office-v2-art.mjs`
- Create: `scripts/verify-office-v2-assets.mjs`
- Create: `public/work-office-v2/scenes/*`
- Create: `public/work-office-v2/furniture/*`
- Create: `public/work-office-v2/props/*`

**Interfaces:**
- Produces all non-character aliases consumed by `officeAssetManifest.js`.
- Asset IDs include `scene-office`, `scene-lounge`, `employee-desk-rear`, `employee-desk-front`, `boss-desk-rear`, `boss-desk-front`, `printer`, `whiteboard`, `file-cabinet`, `office-door`, `pantry`, `dining-table-rear`, `dining-table-front`, `sofa-rear`, `sofa-front`, `television`, and manifest prop IDs.

- [ ] **Step 1: Write failing asset inventory tests**

Require exactly two `2160 x 3840` opaque scene masters, one reusable employee-desk rear/front pair, transparent furniture/prop WebPs, and zero filenames containing `rug`, `carpet`, `employee1-desk`, `employee2-desk`, `employee3-desk`, or `employee4-desk`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test scripts/office-v2-art-spec.test.mjs`

Expected: FAIL with missing `public/work-office-v2` assets.

- [ ] **Step 3: Generate the office environment with imagegen**

Use the imagegen skill and this exact direction:

```text
High-definition vertical 9:16 open-plan modern office, pearl white and light neutral gray,
mist-blue and restrained dusty-rose accents, straight front-facing perspective, no rugs,
no carpet rectangles, no cubicle walls, no people, no freestanding desks or chairs baked in.
Upper-center executive area, clear 2x2 employee workstation floor positions, wide central aisles,
real lower-right office door, printer/file/whiteboard wall zones, crisp professional 2D illustration,
clean controlled cel shading, sharp edges, realistic furniture scale, no green-dominant palette,
no text, no watermark. Architecture-only master.
```

Generate the lounge with the same perspective and lighting: pantry at the upper zone, existing dining table zone, sofa/coffee-table/television zone, return door, and clear unobstructed aisles. Generate each furniture object and prop as a transparent isolated asset in matching perspective.

- [ ] **Step 4: Normalize and audit**

Run: `node scripts/normalize-office-v2-art.mjs tmp/office-v2-source public/work-office-v2`

Expected: two `2160 x 3840` scene WebPs, transparent furniture/props, no clipped bounds, and one employee-desk pair reused by the manifest.

Run: `node scripts/verify-office-v2-assets.mjs --environment`

Expected: PASS with zero rugs, zero slot-specific desks, and zero alpha violations.

- [ ] **Step 5: Visually inspect full-size assets**

Use `view_image` on both scene masters, the shared employee desk, boss desk, dining table, sofa, and composited office/lounges. Reject any asset that is soft-focused, skewed, mismatched in perspective, or visually contains a duplicate chair/table.

- [ ] **Step 6: Commit**

```bash
git add scripts/office-v2-art-spec.mjs scripts/office-v2-art-spec.test.mjs scripts/normalize-office-v2-art.mjs scripts/verify-office-v2-assets.mjs public/work-office-v2
git commit -m "feat: add high-definition physical office environments"
```

### Task 6: Define And Validate Body-Only Character Animation Strips

**Files:**
- Modify: `scripts/office-v2-art-spec.mjs`
- Modify: `scripts/office-v2-art-spec.test.mjs`
- Create: `scripts/build-office-v2-contact-sheets.mjs`
- Create: `src/work/pixi/officeCharacterClips.js`
- Create: `src/work/pixi/officeCharacterClips.test.js`

**Interfaces:**
- Produces: `OFFICE_CHARACTER_IDS`, `OFFICE_CLIP_IDS`, `getCharacterClipSource(characterId, clipId)`, and frame metadata `{cellSize:384, frameCount, fps, loop}`.

- [ ] **Step 1: Write failing clip-contract tests**

Require 16 IDs, four-direction eight-frame locomotion, exact `9 FPS` walking, and these body-only action clip IDs:

```js
[
  "idle-seated", "idle-standing", "working", "slacking", "reading", "watching-series",
  "watching-short-video", "gaming", "phone-call", "video-meeting", "online-training",
  "sticky-planning", "tidy-desk", "desk-rest", "printing", "filing", "whiteboard-writing",
  "whiteboard-discussing", "reporting", "stretching", "screen-collaboration-host",
  "screen-collaboration-visitor", "document-submit", "document-sign", "computer-help-host",
  "computer-help-visitor", "parcel-receive", "chatting", "listening", "meal-pickup",
  "tray-carry", "eating", "drinking", "dining-chat", "dining-listen", "sofa-rest",
  "watching-tv", "sofa-chat", "sofa-listen", "quiet-rest", "waiting"
]
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test scripts/office-v2-art-spec.test.mjs src/work/pixi/officeCharacterClips.test.js`

Expected: FAIL because clip metadata and character files are absent.

- [ ] **Step 3: Implement the clip manifest**

Locomotion files are `3072 x 1536` with `8 x 4` cells. Every action is a lazy `1536 x 384` four-frame strip. The manifest must map each clip to frame count, FPS, loop behavior, and legal facing.

- [ ] **Step 4: Implement normalization and contact-sheet generation**

The normalizer accepts generated masters, slices transparent cells, centers feet on a shared anchor, applies edge-preserving sharpening, writes WebP quality `95`, and verifies at least `24` transparent pixels around each frame edge. The contact-sheet script emits one full-size and one `104px` runtime sample per character and clip family.

- [ ] **Step 5: Run contract tests**

Expected at this point: manifest tests PASS; asset inventory remains RED until Tasks 7-10 create all character files.

- [ ] **Step 6: Commit**

```bash
git add scripts/office-v2-art-spec.mjs scripts/office-v2-art-spec.test.mjs scripts/build-office-v2-contact-sheets.mjs src/work/pixi/officeCharacterClips.js src/work/pixi/officeCharacterClips.test.js
git commit -m "feat: define body-only office animation clips"
```

### Task 7: Redraw Four Female Boss Characters

**Files:**
- Create: `public/work-office-v2/characters/boss-f-01/*`
- Create: `public/work-office-v2/characters/boss-f-02/*`
- Create: `public/work-office-v2/characters/boss-f-03/*`
- Create: `public/work-office-v2/characters/boss-f-04/*`

- [ ] **Step 1: Run the asset verifier and capture RED**

Run: `node scripts/verify-office-v2-assets.mjs --characters boss-f`

Expected: FAIL listing four missing character directories and clips.

- [ ] **Step 2: Generate consistent body-only masters**

Use imagegen with the shared clip list and this fixed art direction:

```text
Four distinct adult female executive chibi characters, all with long hair, beautiful sweet faces,
crisp clean anime line art, controlled cel shading, detailed eyes and clothing edges, varied elegant
skirts/dresses/trousers, consistent identity and outfit across every frame. Body only on transparent
background. No desk, chair, computer, phone, book, food, screen, text, border, room, shadow platform,
or watermark. Walking must visibly alternate left and right legs with arm swing and weight transfer.
Seated clips use the same shared hip and foot anchors without drawing furniture.
```

Generate locomotion and action master grids separately for each identity to preserve consistency.

- [ ] **Step 3: Normalize and verify**

Run: `node scripts/normalize-office-v2-art.mjs tmp/office-v2-source/boss-f public/work-office-v2/characters`

Run: `node scripts/verify-office-v2-assets.mjs --characters boss-f`

Expected: PASS for dimensions, alpha, gutters, frame population, and furniture-color exclusion diagnostics.

- [ ] **Step 4: Inspect contact sheets**

Run: `node scripts/build-office-v2-contact-sheets.mjs --characters boss-f`

Use `view_image` at original detail. Reject blurred faces, repeated identities, changing outfits, short hair, broken hands, nonalternating legs, furniture, or clipped clothing.

- [ ] **Step 5: Commit**

```bash
git add public/work-office-v2/characters/boss-f-* docs/superpowers/qa/office-v2-boss-f-contact-sheet.webp
git commit -m "feat: add sharp female boss animation set"
```

### Task 8: Redraw Four Male Boss Characters

**Files:**
- Create: `public/work-office-v2/characters/boss-m-01/*`
- Create: `public/work-office-v2/characters/boss-m-02/*`
- Create: `public/work-office-v2/characters/boss-m-03/*`
- Create: `public/work-office-v2/characters/boss-m-04/*`

- [ ] **Step 1: Run the verifier and capture RED**

Run: `node scripts/verify-office-v2-assets.mjs --characters boss-m`

Expected: FAIL listing four missing character directories and clips.

- [ ] **Step 2: Generate body-only masters**

Use imagegen for four distinct handsome adult male executives: tailored executive, quiet intellectual, fashion-forward creative, and relaxed founder. Require crisp clean anime line art, controlled cel shading, consistent faces and outfits, shared body anchors, transparent background, and visibly alternating walk legs. Explicitly forbid facial-hair obstruction, cloned suits, furniture, props, soft focus, text, borders, and room scenery.

- [ ] **Step 3: Normalize and verify**

Run: `node scripts/normalize-office-v2-art.mjs tmp/office-v2-source/boss-m public/work-office-v2/characters`

Run: `node scripts/verify-office-v2-assets.mjs --characters boss-m`

Expected: PASS for dimensions, alpha, gutters, frame population, and body-only diagnostics.

- [ ] **Step 4: Inspect contact sheets**

Run: `node scripts/build-office-v2-contact-sheets.mjs --characters boss-m`

Inspect the original-size sheet with `view_image`. Reject repeated faces, broken hands, changing outfits, nonalternating legs, furniture, props, or blurred facial edges.

- [ ] **Step 5: Commit**


```bash
git add public/work-office-v2/characters/boss-m-* docs/superpowers/qa/office-v2-boss-m-contact-sheet.webp
git commit -m "feat: add sharp male boss animation set"
```

### Task 9: Redraw Four Female Employee Characters

**Files:**
- Create: `public/work-office-v2/characters/employee-f-01/*`
- Create: `public/work-office-v2/characters/employee-f-02/*`
- Create: `public/work-office-v2/characters/employee-f-03/*`
- Create: `public/work-office-v2/characters/employee-f-04/*`

- [ ] **Step 1: Run the verifier and capture RED**

Run: `node scripts/verify-office-v2-assets.mjs --characters employee-f`

Expected: FAIL listing four missing character directories and clips.

- [ ] **Step 2: Generate body-only masters**

Use imagegen for four distinct adult female employees with long hair and sweet, polished styling. Assign one stable garment silhouette per identity: short A-line skirt, pleated short skirt, fitted skirt, and dress or midi skirt. Require professional footwear, adult proportions, crisp line art, transparent backgrounds, consistent garment length, and alternating legs. Forbid furniture, props, soft focus, short hair, text, borders, and room scenery.

- [ ] **Step 3: Normalize and verify**

Run: `node scripts/normalize-office-v2-art.mjs tmp/office-v2-source/employee-f public/work-office-v2/characters`

Run: `node scripts/verify-office-v2-assets.mjs --characters employee-f`

Expected: PASS for dimensions, alpha, gutters, frame population, garment continuity, and body-only diagnostics.

- [ ] **Step 4: Inspect contact sheets**

Run: `node scripts/build-office-v2-contact-sheets.mjs --characters employee-f`

Inspect the original-size sheet with `view_image`. Reject short hair, repeated faces, changing skirt/dress silhouettes, broken hands, nonalternating legs, furniture, props, or blurred facial edges.

- [ ] **Step 5: Commit**


```bash
git add public/work-office-v2/characters/employee-f-* docs/superpowers/qa/office-v2-employee-f-contact-sheet.webp
git commit -m "feat: add sharp female employee animation set"
```

### Task 10: Redraw Four Male Employee Characters

**Files:**
- Create: `public/work-office-v2/characters/employee-m-01/*`
- Create: `public/work-office-v2/characters/employee-m-02/*`
- Create: `public/work-office-v2/characters/employee-m-03/*`
- Create: `public/work-office-v2/characters/employee-m-04/*`

- [ ] **Step 1: Run the verifier and capture RED**

Run: `node scripts/verify-office-v2-assets.mjs --characters employee-m`

Expected: FAIL listing four missing character directories and clips.

- [ ] **Step 2: Generate body-only masters**

Use imagegen for four distinct handsome adult male employees: clean-cut professional, streetwear designer, elegant technical lead, and understated artist. Require crisp line art, controlled cel shading, stable outfits and body anchors, transparent backgrounds, opposing arm swing, and clearly alternating legs. Forbid cloned hairstyles, furniture, props, soft focus, text, borders, and room scenery.

- [ ] **Step 3: Normalize and verify**

Run: `node scripts/normalize-office-v2-art.mjs tmp/office-v2-source/employee-m public/work-office-v2/characters`

Run: `node scripts/verify-office-v2-assets.mjs --characters employee-m`

Expected: PASS.

Run: `node scripts/verify-office-v2-assets.mjs --all`

Expected: PASS for all sixteen identities and every required clip strip.

- [ ] **Step 4: Inspect contact sheets**

Run: `node scripts/build-office-v2-contact-sheets.mjs --characters employee-m`

Inspect the original-size sheet with `view_image`. Reject repeated faces, broken hands, changing outfits, nonalternating legs, furniture, props, or blurred facial edges.

- [ ] **Step 5: Commit**


```bash
git add public/work-office-v2/characters/employee-m-* docs/superpowers/qa/office-v2-employee-m-contact-sheet.webp
git commit -m "feat: add sharp male employee animation set"
```

### Task 11: Render Actors, Props, And Physical Occlusion

**Files:**
- Create: `src/work/pixi/OfficeActorView.js`
- Create: `src/work/pixi/OfficeActorView.test.js`
- Modify: `src/work/pixi/OfficeSceneView.js`
- Modify: `src/work/pixi/officeAssetManifest.js`
- Delete: `src/work/OfficeCharacter.jsx`
- Delete: `src/work/officeStations.js`
- Delete: `src/work/officeStations.test.js`
- Delete: `src/work/officeAssets.js`
- Delete: `src/work/officeAssets.test.js`

**Interfaces:**
- `OfficeActorView.sync({actor, motion, clip, frameIndex, furnitureAnchor})`.
- `OfficeSceneView.syncProps(activityStates)` activates scene props without creating furniture.

- [ ] **Step 1: Write failing renderer-contract tests**

Assert that actor textures come only from `work-office-v2/characters`, that four employee desks use one alias, and that `working`, `eating`, `watching-tv`, and `desk-rest` activate props on existing object anchors without creating desk/chair/sofa/table display objects.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/pixi/OfficeActorView.test.js`

Expected: FAIL because `OfficeActorView` is missing.

- [ ] **Step 3: Implement actor clips and depth**

Use `AnimatedSprite` with four- or eight-frame textures. Set actor anchor to `(0.5, 0.92)`, frame timing from the clip manifest, horizontal scale from facing, and `zIndex` from the actor's foot `y`. Scene rear/front containers and object-specific masks establish chair, desk, sofa, and table occlusion.

- [ ] **Step 4: Implement prop anchoring**

Map activity prop state to `sceneId`, `objectId`, and named anchor. For example, eating attaches meal/tray/utensils to `lounge:dining-table:seat-1:surface`; watching TV changes `lounge:television:screen`; desk actions attach phone/book/documents to the assigned desk surface.

- [ ] **Step 5: Run tests and build**

Run: `node --test src/work/pixi/OfficeActorView.test.js src/work/officeSceneManifest.test.js`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no imports of deleted DOM sprite modules.

- [ ] **Step 6: Commit**

```bash
git add src/work/pixi src/work/OfficeCharacter.jsx src/work/officeStations.js src/work/officeAssets.js src/work/officeAssets.test.js
git commit -m "feat: render body-only actors in physical furniture"
```

### Task 12: Expand The Activity Manifest And Personality Scheduler

**Files:**
- Create: `src/work/officeActivityManifest.js`
- Create: `src/work/officeActivityManifest.test.js`
- Modify: `src/work/officeScheduler.js`
- Modify: `src/work/officeScheduler.test.js`
- Modify: `src/work/officeActivityApi.js`
- Modify: `src/work/officeActivityApi.test.js`

**Interfaces:**
- Produces: `OFFICE_ACTIVITY_MANIFEST`, `getActivityDefinition(id)`, `chooseOfficeEvent({state, profiles, random, now})`.
- Every scheduled event returns `{activityId, actorIds, sceneId, targetAnchors, reservationGroupId, routesByActor, propState, semanticContext, startedAt, endsAt}`.

- [ ] **Step 1: Write failing manifest coverage tests**

Require every existing, added, and lounge activity from the design specification. For every entry assert a valid scene, clip ID, target object/anchor, reservation policy, prop state, duration range, participant range, status, travel status, and local fallback semantic content.

- [ ] **Step 2: Write failing scheduler behavior tests**

Cover personality weighting, printer contention, desk-only actions, lounge-only eating, screen-collaboration host/visitor roles, boss reports, computer help, whiteboard groups, delivery at the door, and no scheduled route point inside a collider.

- [ ] **Step 3: Run tests and verify RED**

Run: `node --test src/work/officeActivityManifest.test.js src/work/officeScheduler.test.js src/work/officeActivityApi.test.js`

Expected: FAIL because the manifest and expanded events do not exist.

- [ ] **Step 4: Implement the authoritative manifest and scheduler**

Move weights, activity order, target selection, and prop pools into manifest data. Select actors only after checking legal scene, role, interruptibility, anchor availability, and route existence. Atomically reserve all required anchors before returning an event.

- [ ] **Step 5: Restrict API output to semantics**

The activity API reply may return only:

```js
{
  eventId: "activity-id",
  subject: "具体工作或内容",
  summary: "角色正在做的事",
  insightOrResult: "结果或启示"
}
```

Reject replies that attempt to alter activity ID, scene, anchors, actor IDs, clip, or prop category. Store semantics in transient actor activity context only.

- [ ] **Step 6: Run tests and commit**

Run: `node --test src/work/officeActivityManifest.test.js src/work/officeScheduler.test.js src/work/officeActivityApi.test.js`

Expected: PASS.

```bash
git add src/work/officeActivityManifest.js src/work/officeActivityManifest.test.js src/work/officeScheduler.js src/work/officeScheduler.test.js src/work/officeActivityApi.js src/work/officeActivityApi.test.js
git commit -m "feat: add concrete physical workplace activities"
```

### Task 13: Migrate Reducer State To The Two-Scene World

**Files:**
- Modify: `src/work/officeState.js`
- Modify: `src/work/officeState.test.js`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/WorkAppScreen.test.js`
- Delete: `src/work/officeNavigation.js`
- Delete: `src/work/officeNavigation.test.js`

**Interfaces:**
- Character position becomes `{sceneId, x, y}` with `homeAnchorId`, `targetAnchorId`, and world routes.
- State adds `visibleSceneId: "office"` and keeps both scene simulations active.
- Non-conversation semantic activity data remains transient and is excluded from serialization.

- [ ] **Step 1: Write failing state and migration tests**

Assert that new state places all five characters at office seat anchors, `SET_VISIBLE_SCENE` does not change routes, door transfers preserve activity, restore resets illegal legacy node routes to safe home anchors, and serialized JSON contains no `activityEvents` or `activeEventBySlot`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/officeState.test.js src/work/WorkAppScreen.test.js`

Expected: FAIL on legacy node positions and persisted activity events.

- [ ] **Step 3: Implement the new reducer actions**

Add `SET_VISIBLE_SCENE`, `START_WORLD_ROUTE`, `ADVANCE_WORLD_ROUTE`, `CROSS_SCENE_DOOR`, `ARRIVE_ACTIVITY`, `START_RETURN`, and `FINISH_RETURN`. Character state keeps exact position, scene, route start time, activity, phase, reservation group, and transient prop state.

- [ ] **Step 4: Replace the Work screen route loop**

Use `sampleWorldRoute` inside the animation frame. Dispatch only phase/transition completion events; pass sampled positions directly to Pixi for smooth rendering. Keep scheduling on the existing coarse timer.

- [ ] **Step 5: Run tests and commit**

Run: `node --test src/work/officeState.test.js src/work/WorkAppScreen.test.js src/work/officeWorld.test.js`

Expected: PASS.

```bash
git add src/work/officeState.js src/work/officeState.test.js src/work/WorkAppScreen.jsx src/work/WorkAppScreen.test.js src/work/officeNavigation.js src/work/officeNavigation.test.js
git commit -m "feat: migrate Work state to a persistent two-scene world"
```

### Task 14: Implement Desk Visits, Lounge Conversations, And Conversation-Only Records

**Files:**
- Create: `src/work/officeConversationRecords.js`
- Create: `src/work/officeConversationRecords.test.js`
- Create: `src/work/OfficeConversationPanel.jsx`
- Modify: `src/work/officeConversationApi.js`
- Modify: `src/work/officeConversationApi.test.js`
- Modify: `src/work/officeScheduler.js`
- Modify: `src/work/officeState.js`
- Modify: `src/work/WorkAppScreen.jsx`
- Delete: `src/work/OfficeActivityPanel.jsx`
- Delete: `src/work/officeActivities.js` after moving transient semantic helpers to `officeActivityManifest.js`.
- Delete: `src/work/officeActivities.test.js`.

**Interfaces:**
- Closed record shape: `{conversationId, workSessionId, sceneId, locationId, topic, participantSnapshots, startedAt, endedAt, transcript}`.
- `OfficeConversationPanel` consumes both `activeConversations` and `conversationRecords`, using active sessions for real-time display and records for completed groups.
- Produces: `normalizeConversationRecord`, `appendConversationRecord`, `serializeConversationRecords`, `restoreConversationRecords`.

- [ ] **Step 1: Write failing desk-visit and record tests**

Cover one host staying at a desk while one visitor routes to the front anchor, three visitor anchors for groups, fallback to whiteboard/dining/sofa, simultaneous isolated transcripts, eating while chatting, and closed records containing only conversation data.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/officeConversationRecords.test.js src/work/officeConversationApi.test.js src/work/officeScheduler.test.js src/work/officeState.test.js`

Expected: FAIL because desk visits and conversation records are absent.

- [ ] **Step 3: Implement host/visitor conversation sessions**

Session state includes explicit `hostId`, `visitorIds`, `sceneId`, `locationId`, `anchorByMember`, `reservationGroupId`, and isolated API sequence. Only visitors travel for a two-person desk conversation; the host turns toward the visitor.

- [ ] **Step 4: Implement conversation-only persistence**

On close, append an immutable record before removing the active session. During migration, discard all legacy non-conversation activity events. Migrate only transcripts with a conversation ID, member list, and ordered valid speaker entries.

- [ ] **Step 5: Replace the panel**

Rename accessible labels and title to `对话记录`. Render grouped conversations with time, location, participants, topic, and ordered messages. Remove actor/activity filters, activity summaries, insights, and `本地记录` labels.

- [ ] **Step 6: Run tests and commit**

Run: `node --test src/work/officeConversationRecords.test.js src/work/officeConversationApi.test.js src/work/officeScheduler.test.js src/work/officeState.test.js src/work/WorkAppScreen.test.js`

Expected: PASS with no non-conversation records.

```bash
git add src/work/officeConversationRecords.js src/work/officeConversationRecords.test.js src/work/OfficeConversationPanel.jsx src/work/officeConversationApi.js src/work/officeConversationApi.test.js src/work/officeScheduler.js src/work/officeState.js src/work/WorkAppScreen.jsx src/work/OfficeActivityPanel.jsx src/work/officeActivities.js src/work/officeActivities.test.js
git commit -m "feat: add physical conversations and dialogue-only records"
```

### Task 15: Add React Overlays, Door Controls, And Animated Upload Validation

**Files:**
- Create: `src/work/OfficeActorOverlay.jsx`
- Create: `src/work/OfficeActorOverlay.test.js`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/OfficeAssignmentFlow.jsx`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/office.css`

**Interfaces:**
- Overlay snapshot entries: `{slotId, visible, screenX, screenY, name, status, bubble, facing, sceneId}`.
- Custom bundle validator returns `{ok, reason, manifest}` and never accepts a single still image as an animated character.

- [ ] **Step 1: Write failing overlay and upload tests**

Assert five visible labels in the active scene, collision-aware bubble offsets, hidden labels for the inactive scene, accessible door buttons, focus restoration, and rejection reasons `still-image`, `low-resolution`, `invalid-clip-manifest`, and `oversized`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test src/work/OfficeActorOverlay.test.js src/work/WorkAppScreen.test.js`

Expected: FAIL because the overlay and animated bundle validation do not exist.

- [ ] **Step 3: Implement overlays and scene controls**

Render names, statuses, and one bubble per conversation above Pixi coordinates. Resolve label overlap by testing bounded rectangles and applying deterministic vertical offsets. Render an icon-only door hotspot with tooltip and accessible name `进入休息区` or `返回办公室`.

- [ ] **Step 4: Replace still-image custom upload behavior**

Accept a hosted animation manifest URL or uploaded ZIP/manifest bundle only after verifying clip files, source dimensions, alpha, and required locomotion frames. Preserve the current built-in chibi when validation fails and show the exact reason in the assignment flow.

- [ ] **Step 5: Run tests and commit**

Run: `node --test src/work/OfficeActorOverlay.test.js src/work/WorkAppScreen.test.js src/work/officeProfiles.test.js`

Expected: PASS.

```bash
git add src/work/OfficeActorOverlay.jsx src/work/OfficeActorOverlay.test.js src/work/OfficeScene.jsx src/work/OfficeAssignmentFlow.jsx src/work/WorkAppScreen.jsx src/work/office.css
git commit -m "feat: add scene-aware overlays and animated uploads"
```

### Task 16: Replace Visual QA, Remove Legacy Assets, And Release V0.2.98

**Files:**
- Modify: `scripts/verify-office.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `docs/.deploy-version`
- Delete: `public/work-office-assets/`
- Delete: corresponding `docs/work-office-assets/` through Pages sync.
- Create: `docs/superpowers/qa/office-v2-release.md`
- Create: fresh office and lounge screenshots under `docs/superpowers/qa/`.

- [ ] **Step 1: Extend the verifier before deleting legacy assets**

The verifier must fail unless it observes:

- one nonblank Pixi canvas with backing resolution at least `2x` CSS size;
- two switchable scenes;
- four employee desk objects sharing one asset alias;
- no rug/carpet assets or DOM layers;
- five legal character colliders;
- alternating locomotion frames and continuous position samples;
- office-to-lounge door traversal;
- desk visit, boss report, printer, whiteboard, dining chat, sofa TV, and two simultaneous isolated conversations;
- zero furniture duplication during every activity manifest entry;
- only conversation records in the three-dot panel;
- no console errors, failed image requests, or unexpected API requests.

- [ ] **Step 2: Run verifier and capture RED**

Run: `npm run verify:office`

Expected: FAIL until all new scene, action, and record probes are complete.

- [ ] **Step 3: Remove legacy rendering and assets**

Delete `public/work-office-assets`, old station/background/chibi references, obsolete CSS props, and old verifier assumptions. Use `rg "work-office-assets|office-module-layer|office-character-atlas-sprite|OfficeActivityPanel" src scripts public` and require zero matches outside migration documentation.

- [ ] **Step 4: Run full verification**

Run: `npm test`

Expected: all tests pass with zero failures.

Run: `npm run build`

Expected: Vite production build succeeds.

Run: `npm run verify:office`

Expected: PASS at `375 x 812`, `390 x 844`, and `1280 x 720`, including canvas-pixel and movement checks.

Run: `node scripts/verify-office-v2-assets.mjs --all`

Expected: PASS for both scenes, shared furniture, all props, sixteen characters, and all clip strips.

- [ ] **Step 5: Perform manual visual QA**

Inspect both scenes and every generated contact sheet with `view_image`. Use Playwright screenshots to confirm realistic office scale, no rugs, crisp faces, correct chair/desk/sofa/table occlusion, no duplicate props, and labels that fit at both phone sizes.

- [ ] **Step 6: Bump and deploy version 0.2.98**

Update package version, `Ccat OS V0.2.98`, cache markers, and `docs/.deploy-version` to `0.2.98`.

Run: `npm run deploy:pages`

Expected: production build succeeds and `dist/` is synchronized to `docs/` without stale legacy office assets.

- [ ] **Step 7: Commit and push**

```bash
git add package.json package-lock.json src scripts public docs
git commit -m "Deploy V0.2.98"
git push origin HEAD:main
```

- [ ] **Step 8: Verify the live release**

Run: `curl -fsSL https://sy719427083-glitch.github.io/ai-roleplay-phone/.deploy-version`

Expected: `0.2.98`.

Fetch the live HTML, JS/CSS bundle, both scene backgrounds, every shared furniture/prop asset, five representative character bundles, and then the complete asset manifest. Require HTTP `200`, correct content types, and nontrivial byte lengths. Open the live Work app in the in-app browser, traverse both doors, capture the live office and lounge, and confirm zero application console errors.

---

## Plan Self-Review

- Every confirmed scene, collision, animation, activity, conversation, record, upload, QA, and deployment requirement maps to at least one task.
- New module names and interfaces are consistent across producing and consuming tasks.
- The plan contains no deferred behavior, optional implementation, or unresolved migration choice.
- The four employee desks are one shared asset instance contract, not four art files.
- Character clarity is addressed by crisp redraw direction, 512-pixel masters, 384-pixel production cells, runtime contact sheets, and lazy strip loading rather than atlas enlargement alone.
- The legacy activity record is explicitly removed, and only valid conversation transcripts migrate.
