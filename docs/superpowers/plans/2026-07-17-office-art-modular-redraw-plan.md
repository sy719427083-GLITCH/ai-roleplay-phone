# Office Art And Modular Station Redraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the office background and all sixteen chibi atlases with sharp, detailed art, integrate furniture and props through modular station states, slow every motion loop, and deploy release `0.2.97` to GitHub Pages.

**Architecture:** Keep the existing reducer, scheduler, profile sources, activity events, navigation graph, and isolated conversation sessions. Add a pure station-state resolver, render architecture and full-canvas transparent furniture modules below characters, move all seated furniture and props into atlas frames, and sample each 2048 atlas through integer pixel offsets in a stable 104px viewport.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Node test runner, CSS, Playwright, built-in Image Gen, chroma-key alpha removal helper, WebP bitmap assets, GitHub Pages.

## Global Constraints

- Release target is exactly `0.2.97`.
- Replace every existing office background and all sixteen existing chibi atlases; retain no old office artwork.
- Ship exactly four female bosses, four male bosses, four female employees, and four male employees.
- All eight female characters have long hair in every frame; at least four use distinct short A-line, pleated short, fitted short, and dress or midi silhouettes.
- All eight male characters are handsome and visually varied; generic suit clones are not acceptable.
- Keep the strict `8 x 8` atlas row contract and produce `2048 x 2048` masters with `256 x 256` cells and at least `12px` transparent gutters.
- Render built-in characters at an integer `104px` square with integer atlas offsets and smooth antialiasing.
- Route speed is `10` office units per second, walking cadence is `8fps`, four-frame activity cadence is `320ms`, and CSS action loops stay between `1.3s` and `1.8s`.
- The architecture-only base is `1080 x 1920`, white-dominant and low-saturation, with no freestanding desks, chairs, stools, computers, food, loose props, people, text, or UI.
- Render layers in this order: architecture background, station and break modules, character animation, names/status/bubbles/UI.
- Each of five stations has `empty` and `active-shell` states. The break area has `both-empty`, `left-occupied`, `right-occupied`, and `both-occupied` states.
- A station uses `active-shell` only while its assigned character is at home in a seated action. Walking, chatting, listening, meeting, and returning use standing frames and the `empty` station.
- An eating frame supplies exactly one stool, meal, utensils, and character. A seated desk frame supplies exactly one chair and its current props.
- Module failures fall back to `empty` and suppress chair-bearing frames until the matching `active-shell` has loaded.
- Preserve current Me-app boss profile sourcing, Character-app employee sourcing, `NPC` fallbacks, API activity details, and isolated concurrent conversations.
- Do not add a runtime dependency for animation, image rendering, or station state.
- Use built-in Image Gen once per distinct asset. For transparent assets, generate on a flat chroma key, use the installed alpha-removal helper, and validate the result before committing.
- If chroma removal fails on long hair or detailed edges, stop and request explicit approval before any CLI `gpt-image-1.5` native-transparency fallback.
- Leave unrelated changes and the main checkout's untracked artifacts untouched.
- Deploy to `https://sy719427083-glitch.github.io/ai-roleplay-phone/` only after tests, build, asset audit, and both mobile viewport checks pass.

## File Map

- Create `src/work/officeStations.js`: station asset manifest, seated activity rules, break occupancy mapping, module-load fallback, and scene-state resolver.
- Create `src/work/officeStations.test.js`: pure state matrix for home, movement, chat, eating, concurrent diners, and load failures.
- Modify `src/work/officeAssets.js`: 2048 atlas metadata and integer frame offsets.
- Modify `src/work/officeAssets.test.js`: atlas dimensions, unique assets, module inventory, and integer frame-style tests.
- Modify `src/work/OfficeScene.jsx`: architecture layer, dynamic station modules, break module, module load state, and per-character furniture suppression.
- Modify `src/work/OfficeCharacter.jsx`: `furnitureReady` input, 320ms activity cadence, removal of duplicate CSS props, and deterministic sprite data attributes.
- Modify `src/work/officeMotion.js`: 8fps walk cadence while preserving frame-synchronized interpolation.
- Modify `src/work/officeMotion.test.js`: exact 125ms frame cadence and constant-speed assertions.
- Modify `src/work/office.css`: stable 104px sprite viewport, integer atlas translation, slower loops, module layers, and non-overlapping labels/bubbles.
- Create `scripts/office-art-spec.mjs`: reproducible visual direction, exact character identities/outfits, and asset IDs.
- Create `scripts/office-art-spec.test.mjs`: coverage for all 16 identities, female long-hair/skirt constraints, and module IDs.
- Create `scripts/normalize-office-art.mjs`: Playwright-canvas crop, placement, exact-size encoding, and atlas gutter validation without adding a runtime dependency.
- Replace `public/work-office-assets/office-bg.webp`: new architecture-only 1080x1920 background.
- Create `public/work-office-assets/stations/*.webp`: ten transparent 1080x1920 station overlays.
- Create `public/work-office-assets/break/*.webp`: four transparent 1080x1920 break overlays.
- Replace `public/work-office-assets/chibi/*.webp`: sixteen new transparent 2048x2048 atlases.
- Refresh `docs/superpowers/qa/office-chibis-contact-sheet.webp`, `office-375x812.png`, and `office-390x844.png`.
- Modify `scripts/verify-office.mjs`: new dimensions, gutters, layer states, module fallback, no-duplication, pace, and browser geometry checks.
- Modify `package.json`, `package-lock.json`, `src/App.jsx`, and `src/styles.css`: release `0.2.97` and cache markers.
- Regenerate `docs/` with `npm run deploy:pages`; never hand-edit generated bundles.

---

### Task 1: Define The Modular Station Contract

**Files:**
- Create: `src/work/officeStations.js`
- Create: `src/work/officeStations.test.js`

**Interfaces:**
- Consumes: office `characters`, `reservations`, and loaded module IDs.
- Produces: `OFFICE_STATION_ASSETS`, `OFFICE_BREAK_ASSETS`, `SEATED_HOME_ACTIVITIES`, `resolveStationVisualState(input)`, `resolveBreakVisualState(input)`, and `resolveOfficeModuleState(input)`.

- [ ] **Step 1: Write the failing station-state matrix**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_BREAK_ASSETS,
  OFFICE_STATION_ASSETS,
  resolveOfficeModuleState,
} from "./officeStations.js";

const character = (overrides = {}) => ({
  phase: "active",
  activity: "working",
  positionNode: "employee1-home",
  homeNode: "employee1-home",
  ...overrides,
});

test("ships ten station states and four break states", () => {
  assert.equal(Object.keys(OFFICE_STATION_ASSETS).length, 5);
  assert.equal(Object.values(OFFICE_STATION_ASSETS).flatMap(Object.values).length, 10);
  assert.deepEqual(Object.keys(OFFICE_BREAK_ASSETS), [
    "both-empty", "left-occupied", "right-occupied", "both-occupied",
  ]);
});

test("uses active shell only for a seated activity at home", () => {
  const state = resolveOfficeModuleState({
    characters: { employee1: character() },
    reservations: {},
    loadedModuleIds: new Set(["employee1-active-shell"]),
  });
  assert.equal(state.stations.employee1.state, "active-shell");
  assert.equal(state.characters.employee1.furnitureReady, true);

  for (const moving of ["walkingToActivity", "returning", "chatting"]) {
    const next = resolveOfficeModuleState({
      characters: { employee1: character({ phase: moving }) },
      reservations: {},
      loadedModuleIds: new Set(["employee1-active-shell"]),
    });
    assert.equal(next.stations.employee1.state, "empty");
    assert.equal(next.characters.employee1.furnitureReady, true);
  }
});

test("keeps two break seats independent", () => {
  const state = resolveOfficeModuleState({
    characters: {
      employee1: character({ activity: "eating", positionNode: "break-1" }),
      employee2: character({ activity: "eating", positionNode: "break-2", homeNode: "employee2-home" }),
    },
    reservations: {
      "break-1": { anchorId: "break-1", slotId: "employee1" },
      "break-2": { anchorId: "break-2", slotId: "employee2" },
    },
    loadedModuleIds: new Set(["break-both-occupied"]),
  });
  assert.equal(state.breakArea.state, "both-occupied");
  assert.equal(state.characters.employee1.furnitureReady, true);
  assert.equal(state.characters.employee2.furnitureReady, true);
});

test("suppresses chair frames when an active shell is unavailable", () => {
  const state = resolveOfficeModuleState({
    characters: { employee1: character() },
    reservations: {},
    loadedModuleIds: new Set(),
  });
  assert.equal(state.stations.employee1.state, "empty");
  assert.equal(state.characters.employee1.furnitureReady, false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/work/officeStations.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `officeStations.js`.

- [ ] **Step 3: Implement the pure module resolver**

```js
const BASE_URL = import.meta.env?.BASE_URL || "/ai-roleplay-phone/";
const asset = (folder, name) => `${BASE_URL}work-office-assets/${folder}/${name}.webp`;

export const SEATED_HOME_ACTIVITIES = new Set([
  "idle", "working", "slacking", "gaming", "reading",
  "watchingSeries", "watchingShortVideo",
]);

export const OFFICE_STATION_ASSETS = Object.fromEntries(
  ["boss", "employee1", "employee2", "employee3", "employee4"].map((slotId) => [slotId, {
    empty: { id: `${slotId}-empty`, src: asset("stations", `${slotId}-empty`) },
    "active-shell": { id: `${slotId}-active-shell`, src: asset("stations", `${slotId}-active-shell`) },
  }]),
);

export const OFFICE_BREAK_ASSETS = Object.fromEntries(
  ["both-empty", "left-occupied", "right-occupied", "both-occupied"].map((state) => [state, {
    id: `break-${state}`,
    src: asset("break", state),
  }]),
);

const isAtHome = (slotId, character) => (
  character?.positionNode === (character?.homeNode || `${slotId}-home`)
);

export function resolveStationVisualState(slotId, character = {}, loadedModuleIds = new Set()) {
  const wantsShell = isAtHome(slotId, character)
    && !["walkingToActivity", "returning", "chatting"].includes(character.phase)
    && SEATED_HOME_ACTIVITIES.has(character.activity || "idle");
  const shellId = `${slotId}-active-shell`;
  if (!wantsShell) return { state: "empty", furnitureReady: true };
  return loadedModuleIds.has(shellId)
    ? { state: "active-shell", furnitureReady: true }
    : { state: "empty", furnitureReady: false };
}

export function resolveBreakVisualState(reservations = {}, characters = {}, loadedModuleIds = new Set()) {
  const owns = (anchorId) => {
    const owner = reservations?.[anchorId]?.slotId;
    const actor = owner && characters?.[owner];
    return Boolean(owner && actor?.activity === "eating" && actor?.positionNode === anchorId);
  };
  const left = owns("break-1");
  const right = owns("break-2");
  const state = left && right ? "both-occupied" : left ? "left-occupied" : right ? "right-occupied" : "both-empty";
  const loaded = loadedModuleIds.has(`break-${state}`);
  return {
    state: loaded ? state : "both-empty",
    furnitureReadyBySlot: Object.fromEntries([
      reservations?.["break-1"]?.slotId && [reservations["break-1"].slotId, !left || loaded],
      reservations?.["break-2"]?.slotId && [reservations["break-2"].slotId, !right || loaded],
    ].filter(Boolean)),
  };
}

export function resolveOfficeModuleState({ characters = {}, reservations = {}, loadedModuleIds = new Set() } = {}) {
  const stations = {};
  const characterStates = {};
  for (const slotId of Object.keys(OFFICE_STATION_ASSETS)) {
    stations[slotId] = resolveStationVisualState(slotId, characters[slotId], loadedModuleIds);
    characterStates[slotId] = { furnitureReady: stations[slotId].furnitureReady };
  }
  const breakArea = resolveBreakVisualState(reservations, characters, loadedModuleIds);
  for (const [slotId, ready] of Object.entries(breakArea.furnitureReadyBySlot)) {
    characterStates[slotId] = { furnitureReady: ready };
  }
  return { stations, breakArea, characters: characterStates };
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/work/officeStations.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the station contract**

```bash
git add src/work/officeStations.js src/work/officeStations.test.js
git commit -m "feat: define modular office station states"
```

### Task 2: Render Architecture, Modules, And Furniture-Safe Characters

**Files:**
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/OfficeCharacter.jsx`
- Modify: `src/work/WorkAppScreen.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `resolveOfficeModuleState()` and module manifests from Task 1.
- Produces: `.office-module-layer`, `data-module-state`, `data-furniture-ready`, and module load/error behavior.

- [ ] **Step 1: Add failing source-contract assertions**

```js
test("renders architecture and dynamic furniture below furniture-safe characters", () => {
  assert.match(sceneSource, /resolveOfficeModuleState/);
  assert.match(sceneSource, /office-module-layer/);
  assert.match(sceneSource, /data-module-state/);
  assert.match(sceneSource, /furnitureReady=/);
  assert.match(characterSource, /data-furniture-ready/);
  assert.match(characterSource, /furnitureReady \? spriteActivity : "listening"/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/work/WorkAppScreen.test.js`

Expected: FAIL because the scene has no modular asset layer or furniture readiness input.

- [ ] **Step 3: Render full-canvas overlays and track successful loads**

Add a module image component and module-load set in `OfficeScene.jsx`:

```jsx
import { useCallback, useState } from "react";

function OfficeModuleImage({ module, state, onLoad, onError }) {
  return (
    <img
      className="office-module-image"
      src={module.src}
      alt=""
      aria-hidden="true"
      draggable={false}
      data-module-id={module.id}
      data-module-state={state}
      onLoad={() => onLoad(module.id)}
      onError={() => onError(module.id)}
    />
  );
}

const [loadedModuleIds, setLoadedModuleIds] = useState(() => new Set());
const markModuleLoaded = useCallback((id) => {
  setLoadedModuleIds((current) => new Set(current).add(id));
}, []);
const markModuleFailed = useCallback((id) => {
  setLoadedModuleIds((current) => {
    const next = new Set(current);
    next.delete(id);
    return next;
  });
}, []);
const moduleState = resolveOfficeModuleState({
  characters,
  reservations: state.reservations,
  loadedModuleIds,
});
```

Render an `aria-hidden` preload bank containing all fourteen module URLs so an `active-shell` can become ready before it is selected. Render the five selected station images and selected break image between the background and hit areas. Pass `moduleState.characters[slotId]?.furnitureReady !== false` to each `OfficeCharacter`.

```jsx
<div className="office-module-preload" hidden aria-hidden="true">
  {[...Object.values(OFFICE_STATION_ASSETS).flatMap(Object.values), ...Object.values(OFFICE_BREAK_ASSETS)]
    .map((module) => (
      <img
        key={module.id}
        src={module.src}
        alt=""
        onLoad={() => markModuleLoaded(module.id)}
        onError={() => markModuleFailed(module.id)}
      />
    ))}
</div>
```

- [ ] **Step 4: Suppress chair-bearing frames when their shell is unavailable**

In `OfficeCharacter.jsx`, accept `furnitureReady = true`, expose it as `data-furniture-ready`, and resolve the frame without introducing another chair:

```js
const chairBearing = !isMoving && [
  "idle", "working", "slacking", "eating", "gaming", "reading",
  "watchingSeries", "watchingShortVideo",
].includes(spriteActivity);
const renderedActivity = chairBearing && !furnitureReady ? "listening" : spriteActivity;
const frame = getActivityFrame(renderedActivity, framePhase, facing);
```

Remove `WorkProps`, `SlackProps`, `GameProps`, `MealProps`, `BookProps`, `SeriesProps`, and `ShortVideoProps` rendering because those props are now part of the atlas. Keep only the semantic `data-prop` attribute and chat/listen bubble indicators, which do not duplicate furniture.

- [ ] **Step 5: Add stable full-canvas module CSS**

```css
.office-scene-background,
.office-module-layer,
.office-furniture-layer,
.office-character-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.office-module-layer { z-index: 1; pointer-events: none; }
.office-furniture-layer { z-index: 2; }
.office-character-layer { z-index: 3; }
.office-module-image {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
}
```

- [ ] **Step 6: Run tests and commit**

Run: `npm test`

Expected: all tests PASS.

```bash
git add src/work/OfficeScene.jsx src/work/OfficeCharacter.jsx src/work/WorkAppScreen.test.js src/work/office.css
git commit -m "feat: render furniture-safe office modules"
```

### Task 3: Make Atlas Sampling Sharp And Motion Calm

**Files:**
- Modify: `src/work/officeAssets.js`
- Modify: `src/work/officeAssets.test.js`
- Modify: `src/work/officeMotion.js`
- Modify: `src/work/officeMotion.test.js`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/OfficeCharacter.jsx`
- Modify: `src/work/office.css`
- Modify: `scripts/verify-office.mjs`

**Interfaces:**
- Consumes: 2048x2048 atlases with 256px cells.
- Produces: `getActivityFrame()` values `frameX`, `frameY`, `backgroundWidth`, and `backgroundHeight`; `getWalkFrame()` at 8fps.

- [ ] **Step 1: Replace percentage-frame expectations with integer-pixel expectations**

```js
const frame = (row, column) => ({
  index: (row * 8) + column,
  row,
  column,
  frameX: column * 104,
  frameY: row * 104,
  backgroundWidth: 832,
  backgroundHeight: 832,
  "--office-frame-index": (row * 8) + column,
  "--office-frame-row": row,
  "--office-frame-column": column,
});

test("uses integer CSS pixels for every atlas frame", () => {
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const value = getActivityFrame(row < 3 ? "walking" : "working", column, row === 1 ? "front" : row === 2 ? "back" : "right");
      for (const key of ["frameX", "frameY", "backgroundWidth", "backgroundHeight"]) {
        assert.equal(Number.isInteger(value[key]), true, `${row}:${column} ${key}`);
      }
    }
  }
});
```

Add a motion test:

```js
test("walk frames advance every 125ms", () => {
  assert.equal(getWalkFrame({ startedAt: 1000, now: 1124 }), 0);
  assert.equal(getWalkFrame({ startedAt: 1000, now: 1125 }), 1);
  assert.equal(getWalkFrame({ startedAt: 1000, now: 1999 }), 7);
  assert.equal(getWalkFrame({ startedAt: 1000, now: 2000 }), 0);
});
```

- [ ] **Step 2: Run focused tests and verify cadence and frame-style failures**

Run: `node --test src/work/officeAssets.test.js src/work/officeMotion.test.js`

Expected: FAIL because the current atlas API returns percentage positions and walking uses 12fps.

- [ ] **Step 3: Return integer frame coordinates and slow cadence**

```js
export const OFFICE_FRAME_SIZE = 104;
export const OFFICE_ATLAS_SIZE = OFFICE_FRAME_SIZE * 8;

export function getActivityFrame(activity, phase = 0, facing = "front") {
  const parsedPhase = Math.abs(Number.parseInt(phase, 10) || 0);
  const isWalking = activity === "walking";
  const block = ACTIVITY_BLOCKS[activity] || ACTIVITY_BLOCKS.idle;
  const row = isWalking ? (WALKING_ROWS[facing] ?? WALKING_ROWS.front) : block.row;
  const column = isWalking
    ? parsedPhase % 8
    : block.offset + (ACTIVITY_BLOCKS[activity] ? parsedPhase % 4 : 0);
  const index = (row * 8) + column;
  return {
    index,
    row,
    column,
    frameX: column * OFFICE_FRAME_SIZE,
    frameY: row * OFFICE_FRAME_SIZE,
    backgroundWidth: OFFICE_ATLAS_SIZE,
    backgroundHeight: OFFICE_ATLAS_SIZE,
    "--office-frame-index": index,
    "--office-frame-row": row,
    "--office-frame-column": column,
  };
}

export const getWalkFrame = ({ startedAt = 0, now = 0 } = {}) => (
  Math.floor(Math.max(0, now - startedAt) / 125) % 8
);
```

Set `OFFICE_WALK_SPEED = 10` in `OfficeScene.jsx` and `scripts/verify-office.mjs`. Change active frames to `Math.floor(time / 320) % 4`.

- [ ] **Step 4: Apply exact sprite dimensions and slower loops**

```js
const frameStyle = {
  backgroundImage: `url(${builtInAsset.src})`,
  backgroundSize: `${frame.backgroundWidth}px ${frame.backgroundHeight}px`,
  backgroundPosition: `-${frame.frameX}px -${frame.frameY}px`,
};
```

```css
.office-character {
  width: 104px;
  height: 104px;
}
.office-character-atlas-sprite {
  width: 104px;
  height: 104px;
  background-repeat: no-repeat;
  image-rendering: auto;
}
.office-character[data-phase="walkingToActivity"] .office-character-motion,
.office-character[data-phase="returning"] .office-character-motion {
  animation-duration: 1.5s;
}
.office-character[data-activity="working"] .office-character-motion { animation-duration: 1.45s; }
.office-character[data-activity="slacking"] .office-character-motion { animation-duration: 1.6s; }
.office-character[data-activity="gaming"] .office-character-motion { animation-duration: 1.35s; }
.office-character[data-activity="chatting"] .office-character-motion { animation-duration: 1.7s; }
```

Keep route coordinates percentage-based so movement remains continuous, but use `translate(-52px, -82px)` for the fixed sprite anchor and never scale the 104px sprite wrapper.

- [ ] **Step 5: Run focused, full, and verifier unit-mode tests**

Run: `node --test src/work/officeAssets.test.js src/work/officeMotion.test.js && npm test`

Expected: all tests PASS and no `800%`, `/ 180`, `speed = 18`, or `OFFICE_WALK_SPEED = 18` remains in office runtime code.

- [ ] **Step 6: Commit sharp rendering and timing**

```bash
git add src/work/officeAssets.js src/work/officeAssets.test.js src/work/officeMotion.js src/work/officeMotion.test.js src/work/OfficeScene.jsx src/work/OfficeCharacter.jsx src/work/office.css scripts/verify-office.mjs
git commit -m "fix: sharpen and slow office animation"
```

### Task 4: Generate The Architecture And Modular Furniture Art

**Files:**
- Create: `scripts/office-art-spec.mjs`
- Create: `scripts/office-art-spec.test.mjs`
- Create: `scripts/normalize-office-art.mjs`
- Replace: `public/work-office-assets/office-bg.webp`
- Create: `public/work-office-assets/stations/boss-empty.webp`
- Create: `public/work-office-assets/stations/boss-active-shell.webp`
- Create: `public/work-office-assets/stations/employee1-empty.webp`
- Create: `public/work-office-assets/stations/employee1-active-shell.webp`
- Create: `public/work-office-assets/stations/employee2-empty.webp`
- Create: `public/work-office-assets/stations/employee2-active-shell.webp`
- Create: `public/work-office-assets/stations/employee3-empty.webp`
- Create: `public/work-office-assets/stations/employee3-active-shell.webp`
- Create: `public/work-office-assets/stations/employee4-empty.webp`
- Create: `public/work-office-assets/stations/employee4-active-shell.webp`
- Create: `public/work-office-assets/break/both-empty.webp`
- Create: `public/work-office-assets/break/left-occupied.webp`
- Create: `public/work-office-assets/break/right-occupied.webp`
- Create: `public/work-office-assets/break/both-occupied.webp`
- Modify: `src/work/officeAssets.test.js`
- Modify: `scripts/verify-office.mjs`

**Interfaces:**
- Consumes: approved pearl-white low-saturation direction and fixed office node layout.
- Produces: one opaque 1080x1920 base and fourteen alpha 1080x1920 full-canvas overlays.

- [ ] **Step 1: Record exact reproducible art identities and asset inventory**

Create `scripts/office-art-spec.mjs` exporting the exact IDs plus these immutable shared directions:

```js
export const OFFICE_BACKGROUND_PROMPT = `Use case: stylized-concept
Asset type: portrait mobile game office architecture background
Primary request: redraw a premium airy office as architecture only, 1080 by 1920 portrait, orthographic three-quarter top-down mobile-game perspective. Keep a luxurious boss zone at the top, four employee bays in a clear 2 by 2 arrangement, a wide central conversation aisle, and a lower break counter zone.
Style/medium: high-detail polished Japanese mobile-game environment illustration, clean precise edges, soft controlled shading, elegant and fresh.
Color palette: pearl white dominant, pale cool gray, dusty rose, mist blue, muted lavender, restrained charcoal; green only as tiny plant accents and never dominant.
Materials/textures: white oak, frosted glass, pale stone, brushed silver, soft woven rugs.
Constraints: architecture and built-ins only; walls, windows, floor, rugs, lighting, built-in cabinets, shelves, plants and fixed counter architecture are allowed. Leave clear contact-light zones for later furniture overlays.
Avoid: freestanding desks, office chairs, stools, computers, books, phones, food, game devices, loose props, people, silhouettes, text, UI, watermark, dark green theme, heavy gradients.`;

export const OFFICE_MODULE_IDS = [
  "boss-empty", "boss-active-shell",
  "employee1-empty", "employee1-active-shell",
  "employee2-empty", "employee2-active-shell",
  "employee3-empty", "employee3-active-shell",
  "employee4-empty", "employee4-active-shell",
  "break-both-empty", "break-left-occupied", "break-right-occupied", "break-both-occupied",
];
```

For every station, the `empty` prompt requires the complete desk, one empty chair, idle computer, desk lamp, and restrained accessories. The paired `active-shell` prompt requires the identical desk and lighting but removes the chair, computer, books, phone, food, controller, and loose props. Every module is isolated on perfectly flat `#00ff00` with no cast shadow beyond its soft local contact shadow and no key color inside the object.

- [ ] **Step 2: Test the art manifest before generation**

```js
test("defines ten station and four break assets without duplicates", () => {
  assert.equal(OFFICE_MODULE_IDS.length, 14);
  assert.equal(new Set(OFFICE_MODULE_IDS).size, 14);
  assert.equal(OFFICE_MODULE_IDS.filter((id) => id.includes("active-shell")).length, 5);
  assert.equal(OFFICE_MODULE_IDS.filter((id) => id.startsWith("break-")).length, 4);
});
```

Run: `node --test scripts/office-art-spec.test.mjs`

Expected: PASS.

- [ ] **Step 3: Generate and inspect the architecture background**

Use one built-in Image Gen call with `OFFICE_BACKGROUND_PROMPT`. Copy the selected output from `$CODEX_HOME/generated_images/` into `tmp/imagegen/office-bg-source.png`, inspect it with `view_image`, then run:

```bash
node scripts/normalize-office-art.mjs background \
  --input tmp/imagegen/office-bg-source.png \
  --output public/work-office-assets/office-bg.webp \
  --width 1080 --height 1920
```

The command uses a Playwright browser canvas with `imageSmoothingEnabled = true`, high smoothing quality, center-crop cover sizing, and `canvas.toDataURL("image/webp", 0.96)`. Reject and regenerate if any freestanding furniture, person, UI, text, dominant green, or dark theme appears.

- [ ] **Step 4: Generate five paired workstation sheets**

Issue one built-in Image Gen call per station. Each call requests a side-by-side `empty` and `active-shell` pair in the exact station perspective, on uniform `#00ff00`, with identical desk geometry and lighting between states. Boss furniture is larger and more luxurious; employee stations vary subtly in accessories and dusty-rose, mist-blue, muted-lavender, and neutral-charcoal accents while sharing the same office material family.

Copy each selected source into `tmp/imagegen/`, split the left and right halves, remove chroma with:

```bash
for station in boss employee1 employee2 employee3 employee4; do
  python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
    --input "tmp/imagegen/${station}-pair-source.png" \
    --out "tmp/imagegen/${station}-pair-alpha.png" \
    --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
  node scripts/normalize-office-art.mjs station-pair \
    --input "tmp/imagegen/${station}-pair-alpha.png" \
    --slot "$station" \
    --out-dir public/work-office-assets/stations
done
```

`station-pair` splits the source at its exact horizontal midpoint and places both halves onto otherwise transparent `1080 x 1920` canvases using the fixed slot rectangles exported by the art manifest. It writes `${slot}-empty.webp` and `${slot}-active-shell.webp`. Validate transparent corners, matching desk bounds, no green fringe, and exact alignment between paired states.

- [ ] **Step 5: Generate the four-state break module**

Use one built-in Image Gen call for a strict `2 x 2` state sheet: both seats empty, left occupied, right occupied, both occupied. “Occupied” means the corresponding stool and loose food are removed while the fixed counter remains identical. Copy it to `tmp/imagegen/break-sheet-source.png`, then run:

```bash
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
  --input tmp/imagegen/break-sheet-source.png \
  --out tmp/imagegen/break-sheet-alpha.png \
  --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
node scripts/normalize-office-art.mjs break-sheet \
  --input tmp/imagegen/break-sheet-alpha.png \
  --out-dir public/work-office-assets/break
```

`break-sheet` crops cells in reading order and writes `both-empty.webp`, `left-occupied.webp`, `right-occupied.webp`, and `both-occupied.webp` as transparent 1080x1920 overlays at the fixed break rectangle.

- [ ] **Step 6: Extend automated asset validation**

Update `officeAssets.test.js` and `verify-office.mjs` to assert one opaque 1080x1920 background, ten transparent 1080x1920 station overlays, four transparent 1080x1920 break overlays, transparent corners, unique hashes, and decoded opaque subject pixels. Browser QA must assert exactly six selected module images at runtime: five station states plus one break state.

- [ ] **Step 7: Inspect the composed empty office and commit**

Run: `node --test scripts/office-art-spec.test.mjs src/work/officeAssets.test.js`

Expected: PASS, with no legacy background or module image present.

Open the local app at 390x844, verify that architecture and all-empty modules compose into one coherent office with no visible green fringe or doubled furniture, then commit:

```bash
git add scripts/office-art-spec.mjs scripts/office-art-spec.test.mjs scripts/normalize-office-art.mjs public/work-office-assets/office-bg.webp public/work-office-assets/stations public/work-office-assets/break src/work/officeAssets.test.js scripts/verify-office.mjs
git commit -m "feat: redraw modular office environment"
```

### Task 5: Redraw And Validate All Sixteen Chibi Atlases

**Files:**
- Modify: `scripts/office-art-spec.mjs`
- Modify: `scripts/office-art-spec.test.mjs`
- Replace: `public/work-office-assets/chibi/boss-f-01.webp`
- Replace: `public/work-office-assets/chibi/boss-f-02.webp`
- Replace: `public/work-office-assets/chibi/boss-f-03.webp`
- Replace: `public/work-office-assets/chibi/boss-f-04.webp`
- Replace: `public/work-office-assets/chibi/boss-m-01.webp`
- Replace: `public/work-office-assets/chibi/boss-m-02.webp`
- Replace: `public/work-office-assets/chibi/boss-m-03.webp`
- Replace: `public/work-office-assets/chibi/boss-m-04.webp`
- Replace: `public/work-office-assets/chibi/employee-f-01.webp`
- Replace: `public/work-office-assets/chibi/employee-f-02.webp`
- Replace: `public/work-office-assets/chibi/employee-f-03.webp`
- Replace: `public/work-office-assets/chibi/employee-f-04.webp`
- Replace: `public/work-office-assets/chibi/employee-m-01.webp`
- Replace: `public/work-office-assets/chibi/employee-m-02.webp`
- Replace: `public/work-office-assets/chibi/employee-m-03.webp`
- Replace: `public/work-office-assets/chibi/employee-m-04.webp`
- Modify: `src/work/officeAssets.test.js`
- Modify: `scripts/verify-office.mjs`
- Replace: `docs/superpowers/qa/office-chibis-contact-sheet.webp`

**Interfaces:**
- Consumes: exact 8x8 row contract and character identity specs.
- Produces: sixteen unique transparent 2048x2048 WebP atlases and one contact sheet.

- [ ] **Step 1: Define all sixteen immutable character identities**

Add this exact identity table to `scripts/office-art-spec.mjs`:

```js
export const OFFICE_CHARACTER_SPECS = [
  { id: "boss-f-01", hair: "long glossy black waves with pearl side pin", outfit: "dusty-rose blazer, ivory blouse, fitted charcoal short skirt, sheer tights, pointed ankle boots", persona: "elegant executive" },
  { id: "boss-f-02", hair: "long chestnut half-up curls with ribbon barrette", outfit: "mist-blue belted midi dress, cropped ivory jacket, slingback heels", persona: "soft romantic founder" },
  { id: "boss-f-03", hair: "very long ash-brown straight hair with face-framing layers", outfit: "muted-lavender blouse, pearl-white tailored trousers, silver loafers", persona: "modern fashion director" },
  { id: "boss-f-04", hair: "long dark-plum low ponytail with curled ends", outfit: "ivory knit top, charcoal short A-line skirt, dusty-rose long vest, knee boots", persona: "refined creative chief" },
  { id: "boss-m-01", hair: "clean swept black hair", outfit: "charcoal tailored double-breasted suit, pearl-white open-collar shirt, black loafers", persona: "decisive executive" },
  { id: "boss-m-02", hair: "soft dark-brown side-part with fine fringe", outfit: "mist-blue turtleneck, pale-gray tailored coat, charcoal trousers, leather sneakers", persona: "quiet intellectual founder" },
  { id: "boss-m-03", hair: "textured ash-black crop", outfit: "muted-lavender overshirt, ivory tee, tapered black trousers, designer trainers", persona: "fashion-forward creative" },
  { id: "boss-m-04", hair: "slightly long wavy raven hair tucked behind one ear", outfit: "pearl-white knit polo, dusty-rose relaxed blazer, slate trousers, suede loafers", persona: "relaxed charismatic founder" },
  { id: "employee-f-01", hair: "long honey-brown twin low ponytails with soft curled ends", outfit: "mist-blue cardigan, ivory blouse, charcoal pleated short skirt, loafers", persona: "sweet preppy analyst" },
  { id: "employee-f-02", hair: "long straight blue-black hair with airy bangs", outfit: "dusty-rose blouse, pearl-white tailored shorts, ankle socks, Mary Jane shoes", persona: "gentle office planner" },
  { id: "employee-f-03", hair: "long warm-brown braid over one shoulder with loose wisps", outfit: "muted-lavender knit, ivory short A-line skirt, pale-gray boots", persona: "chic minimalist designer" },
  { id: "employee-f-04", hair: "long dark-auburn loose curls with velvet headband", outfit: "pearl-white blouse, dusty-rose suspender dress at the knee, low heels", persona: "graceful vintage editor" },
  { id: "employee-m-01", hair: "neat black comma hair", outfit: "mist-blue shirt jacket, ivory tee, charcoal chinos, white sneakers", persona: "clean-cut professional" },
  { id: "employee-m-02", hair: "spiky dark-brown undercut", outfit: "charcoal cropped jacket, muted-lavender hoodie, black cargo trousers, high-top sneakers", persona: "streetwear designer" },
  { id: "employee-m-03", hair: "smooth ash-brown layered hair", outfit: "pearl-white shirt, slate knit vest, tailored trousers, oxford shoes", persona: "elegant technical lead" },
  { id: "employee-m-04", hair: "medium wavy black hair with long fringe", outfit: "dusty-rose workwear overshirt, charcoal tee, loose pale-gray trousers, canvas shoes", persona: "understated artist" },
];
```

- [ ] **Step 2: Test identity coverage before generation**

```js
test("defines sixteen distinct office characters and required female silhouettes", () => {
  assert.equal(OFFICE_CHARACTER_SPECS.length, 16);
  assert.equal(new Set(OFFICE_CHARACTER_SPECS.map(({ id }) => id)).size, 16);
  const women = OFFICE_CHARACTER_SPECS.filter(({ id }) => id.includes("-f-"));
  assert.equal(women.length, 8);
  assert.equal(women.every(({ hair }) => hair.includes("long")), true);
  for (const garment of ["fitted charcoal short skirt", "midi dress", "short A-line skirt", "pleated short skirt"] ) {
    assert.equal(women.some(({ outfit }) => outfit.includes(garment)), true, garment);
  }
});
```

Run: `node --test scripts/office-art-spec.test.mjs`

Expected: PASS.

- [ ] **Step 3: Generate one strict atlas per character in four review groups**

For each identity, issue a separate built-in Image Gen call. Generate in this order and inspect after every four: female bosses, female employees, male bosses, male employees. Use the identity row verbatim with this exact shared prompt:

```text
Use case: stylized-concept
Asset type: production chibi character animation atlas for a mobile office simulation
Primary request: create one single consistent character across a strict 8 by 8 grid, 64 populated cells, 2048 by 2048 square master. Every cell is exactly 256 by 256 with at least 12 pixels of clear inner gutter. Keep face, hair, outfit, footwear, accessories, colors and proportions identical in all cells.
Style/medium: high-detail polished Japanese mobile-game chibi illustration, sweet and beautiful for women, handsome and cool for men, refined adult proportions, clean line work, detailed eyes and hair strands, soft controlled shading, crisp mobile-readable edges.
Rows: row 1 eight-frame side walk with alternating stride, arm swing, weight shift and hair or cloth follow-through; row 2 eight-frame front walk; row 3 eight-frame back walk; row 4 four working frames with one chair and active computer plus four slacking frames with one chair and handheld prop; row 5 four eating frames with one stool, real meal and utensils plus four gaming frames with one chair and device; row 6 four reading frames with one chair and book plus four watching-series frames with one chair and screen device; row 7 four short-video frames with one chair and phone plus four standing chatting frames with no furniture; row 8 four seated idle frames with one chair plus four standing listening frames with no furniture.
Scene/backdrop: perfectly flat uniform #00ff00 chroma-key background only.
Constraints: every action must use a genuinely different pose; all feet, hair, chair and props remain within each cell; no cell bleed; no duplicate chair or prop within a cell; female skirt hems remain consistent and move naturally; side walk faces right and will be mirrored for left.
Avoid: text, labels, borders, room scenery, floor plane, cast shadow, watermark, extra people, empty cells, short-haired women, childlike anatomy, generic repeated faces, blurry edges, pixel art, changing garments between frames, #00ff00 inside the character or props.
```

Reject a group before proceeding if any identity repeats, female hair becomes short, garment category changes, cells are empty, actions reuse the same body, or the grid is not readable.

- [ ] **Step 4: Remove chroma, normalize grid, and encode each approved atlas**

For each source image, run the installed helper with soft matte and despill. If a green fringe remains, retry once with `--edge-contract 1`. Normalize without changing grid order and reject any atlas whose gutter audit fails:

```bash
for id in boss-f-01 boss-f-02 boss-f-03 boss-f-04 boss-m-01 boss-m-02 boss-m-03 boss-m-04 employee-f-01 employee-f-02 employee-f-03 employee-f-04 employee-m-01 employee-m-02 employee-m-03 employee-m-04; do
  python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" \
    --input "tmp/imagegen/${id}-source.png" \
    --out "tmp/imagegen/${id}-alpha.png" \
    --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
  node scripts/normalize-office-art.mjs atlas \
    --input "tmp/imagegen/${id}-alpha.png" \
    --output "public/work-office-assets/chibi/${id}.webp" \
    --size 2048 --columns 8 --rows 8 --gutter 12
done
```

The atlas mode scales the complete square source once to `2048 x 2048`, encodes WebP at quality `0.98`, samples all sixty-four cell centers for opaque coverage, and scans a 12px strip on every internal cell edge. It exits nonzero instead of writing the output if any cell is empty or any gutter contains opaque pixels. Do not downsample to 1024.

- [ ] **Step 5: Expand asset audits to the 2048 contract**

Update tests and Playwright canvas checks to assert:

```js
assert.equal(width, 2048);
assert.equal(height, 2048);
assert.equal(cellSize, 256);
assert.equal(gutterSize >= 12, true);
assert.equal(populatedCells, 64);
```

Also assert sixteen unique SHA-256 hashes, alpha declarations, transparent corners, and no PNG files in the production chibi folder.

- [ ] **Step 6: Build and inspect the contact sheet at two scales**

Create `docs/superpowers/qa/office-chibis-contact-sheet.webp` with one labeled preview per identity plus representative walk, seated, and standing-chat frames. Inspect full resolution for identity/outfit/action consistency, then inspect the same frames at 104px for eye, hair, garment, hand, prop, and silhouette clarity.

- [ ] **Step 7: Run asset tests and commit all sixteen replacements**

Run: `node --test scripts/office-art-spec.test.mjs src/work/officeAssets.test.js && npm run verify:office -- --assets-only`

Expected: PASS for exactly sixteen 2048x2048 atlases, 64 populated cells each, transparent gutters, and unique art.

```bash
git add scripts/office-art-spec.mjs scripts/office-art-spec.test.mjs public/work-office-assets/chibi src/work/officeAssets.test.js scripts/verify-office.mjs docs/superpowers/qa/office-chibis-contact-sheet.webp
git commit -m "feat: redraw all office chibi atlases"
```

### Task 6: Validate Mobile Composition, Walking, And Concurrent Activities

**Files:**
- Modify: `scripts/verify-office.mjs`
- Modify: `src/work/office.css`
- Replace: `docs/superpowers/qa/office-375x812.png`
- Replace: `docs/superpowers/qa/office-390x844.png`

**Interfaces:**
- Consumes: final architecture, modules, atlases, runtime module state, and seeded API mock.
- Produces: deterministic screenshots and browser evidence for every required visual/runtime state.

- [ ] **Step 1: Add failing browser assertions for module transitions and duplicates**

Extend the verifier to capture selected `data-module-state` values and require:

```js
assert.equal(moduleImages.length, 6, "five workstation modules plus one break module");
assert.equal(new Set(moduleImages.map(({ id }) => id)).size, 6);
assert.equal(characters.every(({ width, height }) => width === 104 && height === 104), true);
assert.equal(duplicateFurniturePixels, 0, "no duplicate chair, computer, stool, meal, book, phone, or game device");
```

Add scenarios for employee walking from an empty station, working at an active shell, one diner on each side, two simultaneous diners, two isolated chat groups, reading, series, short video, and module image failure. Replace old standalone CSS-prop selectors with `data-activity`, `data-prop`, selected module state, and atlas-frame assertions because seated props now live inside the bitmap atlas.

- [ ] **Step 2: Run the verifier and observe the first visual failures**

Run: `npm run verify:office`

Expected: FAIL until module transitions, geometry, and updated screenshot thresholds are aligned with the new art.

- [ ] **Step 3: Tune only layout values revealed by browser evidence**

At both `375 x 812` and `390 x 844`, verify five visible names and statuses, full long-number bubbles, no name/status/bubble overlap, no clipped 104px sprite, exact module alignment, no furniture duplication, and no green fringe. Keep the office frame itself fixed while adjusting only sprite anchor, label offsets, bubble bounds, hit-area bounds, and module z-order.

- [ ] **Step 4: Verify continuous natural movement at the new speed**

Sample character positions every animation frame for at least 1500ms. Require maximum displacement no greater than `10 * elapsedSeconds + oneScenePixel`, at least ten distinct intermediate positions, no jump larger than two expected frame distances, and the correct eight-frame facing sequence. Record that walking hair, coat, skirt, legs, and arms alternate rather than bobbing a static body.

- [ ] **Step 5: Refresh screenshots and run the full verification suite**

Run:

```bash
npm test
npm run build
npm run verify:office
```

Expected: all Node tests PASS, Vite production build succeeds, and Playwright reports PASS at `375x812` and `390x844` with no console, network, geometry, asset, conversation-isolation, pace, or duplicate-furniture failure.

- [ ] **Step 6: Commit browser-approved polish**

```bash
git add scripts/verify-office.mjs src/work/office.css docs/superpowers/qa/office-375x812.png docs/superpowers/qa/office-390x844.png
git commit -m "test: verify modular office visuals"
```

### Task 7: Release Version 0.2.97 And Deploy GitHub Pages

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Regenerate: `docs/**`
- Create: `docs/superpowers/qa/office-0.2.97-release.md`

**Interfaces:**
- Consumes: verified release candidate from Tasks 1-6.
- Produces: pushed `main`, Pages bundle, `Ccat OS V0.2.97`, and live asset evidence.

- [ ] **Step 1: Update every runtime and package version marker**

Change the root package version, lockfile root versions, visible label, and cache-busting asset markers from `0.2.96` to `0.2.97`:

```json
"version": "0.2.97"
```

```jsx
<p className="version-label">Ccat OS V0.2.97</p>
```

- [ ] **Step 2: Prove that no stale version marker remains**

Run: `rg -n "0\.2\.96|V0\.2\.96" package.json package-lock.json src public scripts index.html`

Expected: no output.

- [ ] **Step 3: Run the final local release gate**

Run:

```bash
npm test
npm run build
npm run verify:office
npm run deploy:pages
git diff --check
```

Expected: all tests and browser checks PASS, Vite build succeeds, `docs/` exactly matches the new `dist/`, and `git diff --check` prints no errors.

- [ ] **Step 4: Record release evidence and commit**

Write `docs/superpowers/qa/office-0.2.97-release.md` with the exact test count, bundle filename, 16 atlas URLs, 14 module URLs, background URL, screenshot paths, and local commit SHA.

```bash
git add package.json package-lock.json src/App.jsx src/styles.css docs
git commit -m "Deploy V0.2.97"
```

- [ ] **Step 5: Push the verified feature branch to main**

Fetch the remote, confirm `origin/main` has not advanced unexpectedly, then push without force:

```bash
git fetch origin main
git push origin HEAD:main
```

Expected: push succeeds and the remote `main` SHA equals local `HEAD`.

- [ ] **Step 6: Poll and smoke-test the live Pages release**

Poll `https://sy719427083-glitch.github.io/ai-roleplay-phone/` until it contains `Ccat OS V0.2.97`. Open the emitted JS bundle and verify the `0.2.97` marker, then request the background, all sixteen chibi atlases, ten station overlays, and four break overlays. Every URL must return `200`, a nonzero body, and the expected content type.

Open the live office at 390x844 and verify one walking route, one seated action, one eating action, and concurrent conversations. Do not claim deployment complete until the live page, not only local `docs/`, passes.

- [ ] **Step 7: Append live evidence if Pages propagation changed the observed bundle**

Update the release evidence with the live bundle URL, final remote SHA, HTTP result summary, and deployment timestamp. Commit and push only if the evidence file changed.
