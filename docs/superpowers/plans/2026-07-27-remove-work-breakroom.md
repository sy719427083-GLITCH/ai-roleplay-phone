# Remove Work Breakroom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Work APP breakroom completely while preserving a smaller, slightly lower smart print station with aligned navigation.

**Architecture:** Collapse `WorkAppScreen` back to one office scene and one office route factory, then delete the now-unreachable breakroom component, geometry, route, styles, tests, and image assets. Keep print-station ownership in the existing office asset and geometry modules so its visual placement, obstacle, and interaction point remain consistent.

**Tech Stack:** React 19, plain CSS, Node.js built-in test runner, Vite 6, PNG assets

## Global Constraints

- Delete the breakroom entry, scene, scene state, route logic, styles, tests, and seven breakroom-only images.
- Preserve `public/work-office-assets/orbit-print-station.png` and its `docs` copy.
- Set the print station to `top: 11%`, `right: 0`, `width: 48%`, and `height: 14%`.
- Set the print-station interaction point to `{ x: 93, y: 31 }` and keep its obstacle derived from the same `OFFICE_LAYOUT.printStation` object.
- Preserve historical breakroom design and implementation documents.
- Do not modify or stage user-owned untracked files under `artifacts/` or `designs/`.
- Do not deploy or bump the release version unless the user separately asks.

---

## File Map

- Modify `src/work/WorkAppScreen.jsx`: remove scene switching and make movement office-only.
- Modify `src/work/OfficeScene.jsx`: remove the breakroom entry and its callback.
- Modify `src/work/office.css`: remove breakroom styles and resize/reposition the print station.
- Modify `src/work/officeGeometry.js`: update print layout and interaction point.
- Modify `src/work/workScreen.test.js`: assert the single-scene UI and new print-station CSS.
- Modify `src/work/officeGeometry.test.js`: assert the new print geometry.
- Create `src/work/officeArtwork.test.js`: preserve production-quality coverage for the print-station PNG.
- Delete `src/work/BreakroomScene.jsx`, `src/work/BreakroomScene.test.js`, `src/work/breakroomAssets.js`, `src/work/breakroomGeometry.js`, `src/work/breakroomNavigation.js`, `src/work/breakroomNavigation.test.js`, and `src/work/breakroomArtwork.test.js`.
- Delete the seven breakroom-only PNGs from both `public/work-office-assets/` and `docs/work-office-assets/`.

---

### Task 1: Collapse Work APP to the Office and Reposition the Print Station

**Files:**
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/officeGeometry.test.js`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/office.css`
- Modify: `src/work/officeGeometry.js`

**Interfaces:**
- Consumes: `OfficeScene({ occupants, meMovement, onObjectClick, sceneRef })`, `createOfficeRoute({ from, destination, viewport })`, and `getOfficePoint(id)`.
- Produces: a single office scene; `OFFICE_LAYOUT.printStation = { top: 11, right: 0, width: 48, height: 14, alpha }`; `OFFICE_INTERACTION_POINTS["print-station"] = { x: 93, y: 31 }`.

- [ ] **Step 1: Replace the breakroom integration assertion with failing removal and layout assertions**

In `src/work/workScreen.test.js`, change the print-station CSS expectation and replace the breakroom test with:

```js
assert.match(styles, /\.office-object\.print-station\s*\{[^}]*top:\s*11%;[^}]*right:\s*0;[^}]*width:\s*48%;[^}]*height:\s*14%/s);

test("office has no breakroom entry or scene switching", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const officeScene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  for (const source of [screen, officeScene, styles]) {
    assert.doesNotMatch(source, /breakroom|茶水间/i);
  }
  assert.match(screen, /<OfficeScene/);
  assert.match(screen, /aria-label="返回主页"/);
  assert.doesNotMatch(officeScene, /ChevronRight|onEnterBreakroom/);
});
```

In `src/work/officeGeometry.test.js`, use:

```js
assert.deepEqual(OFFICE_LAYOUT.printStation, {
  top: 11,
  right: 0,
  width: 48,
  height: 14,
  alpha: [79 / 900, 9 / 520, 820 / 900, 505 / 520],
});
assert.deepEqual(OFFICE_INTERACTION_POINTS["print-station"], { x: 93, y: 31 });
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeGeometry.test.js
```

Expected: FAIL because the old source still contains breakroom imports/state/entry/styles and the print station is still `9% / 54% / 16%` with interaction point `{ x: 93, y: 29 }`.

- [ ] **Step 3: Make WorkAppScreen office-only**

In `src/work/WorkAppScreen.jsx`:

- Delete the `BreakroomScene`, `getBreakroomPoint`, and `createBreakroomRoute` imports.
- Delete `activeScene`, `breakroomSceneRef`, `enterBreakroom`, and `returnToOffice`.
- Replace the scene-dependent beginning of `moveMe` with:

```js
const bounds = sceneRef.current?.getBoundingClientRect();
if (!bounds) return showNotice("办公室路线暂时不可用");
const route = createOfficeRoute({
  from: meMovement.point,
  destination: target.destination,
  viewport: { width: bounds.width, height: bounds.height },
});
if (!route.length) {
  const point = getOfficePoint(target.destination);
  const alreadyThere = point && point.x === meMovement.point.x && point.y === meMovement.point.y;
  if (!alreadyThere) showNotice("这里暂时没有可通行的路线");
  else if (target.message) showNotice(target.message, 2000);
  return;
}
```

- In the completed route branch, always persist the office waypoint:

```js
dispatch({ type: "SET_WAYPOINT", waypoint: target.destination });
```

- Render the top-left home button directly and replace the scene conditional with:

```jsx
<button type="button" onClick={onClose} aria-label="返回主页"><ChevronLeft size={21} /></button>
```

```jsx
<OfficeScene
  sceneRef={sceneRef}
  occupants={occupants}
  meMovement={meMovement}
  onObjectClick={moveMe}
/>
```

- [ ] **Step 4: Remove the office entry and update print geometry/styles**

In `src/work/OfficeScene.jsx`, delete the `ChevronRight` import, remove `onEnterBreakroom` from the props, and delete the `work-breakroom-entry` button.

In `src/work/office.css`, replace the print rule with:

```css
.office-object.print-station { z-index: 2; top: 11%; right: 0; width: 48%; height: 14%; }
```

Delete all `.breakroom-*` and `.work-breakroom-entry*` rules.

In `src/work/officeGeometry.js`, update only these office-owned values:

```js
export const OFFICE_INTERACTION_POINTS = Object.freeze({
  "print-station": Object.freeze({ x: 93, y: 31 }),
});
```

```js
printStation: Object.freeze({
  top: 11,
  right: 0,
  width: 48,
  height: 14,
  alpha: Object.freeze([79 / 900, 9 / 520, 820 / 900, 505 / 520]),
}),
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeGeometry.test.js src/work/officeNavigation.test.js
```

Expected: all focused tests PASS; route geometry still has eight obstacles and the new print destination remains traversable.

- [ ] **Step 6: Commit the office-only behavior**

```bash
git add src/work/WorkAppScreen.jsx src/work/OfficeScene.jsx src/work/office.css src/work/officeGeometry.js src/work/workScreen.test.js src/work/officeGeometry.test.js
git commit -m "refactor(work): remove breakroom access"
```

---

### Task 2: Delete Breakroom Modules and Assets Without Deleting the Print Station

**Files:**
- Create: `src/work/officeArtwork.test.js`
- Delete: `src/work/breakroomArtwork.test.js`
- Delete: `src/work/BreakroomScene.jsx`
- Delete: `src/work/BreakroomScene.test.js`
- Delete: `src/work/breakroomAssets.js`
- Delete: `src/work/breakroomGeometry.js`
- Delete: `src/work/breakroomNavigation.js`
- Delete: `src/work/breakroomNavigation.test.js`
- Delete: `public/work-office-assets/orbit-breakroom-background.png`
- Delete: `public/work-office-assets/orbit-drink-counter.png`
- Delete: `public/work-office-assets/orbit-coffee-machine.png`
- Delete: `public/work-office-assets/orbit-fridge.png`
- Delete: `public/work-office-assets/orbit-microwave.png`
- Delete: `public/work-office-assets/orbit-snack-cabinet.png`
- Delete: `public/work-office-assets/orbit-dining-table.png`
- Delete: the same seven filenames under `docs/work-office-assets/`

**Interfaces:**
- Consumes: the standalone `orbit-print-station.png` office asset.
- Produces: no breakroom runtime modules or assets; a focused PNG integrity test for the retained print station.

- [ ] **Step 1: Write the failing deletion test and retained print-art test**

Create `src/work/officeArtwork.test.js`:

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const ASSET_ROOT = new URL("../../public/work-office-assets/", import.meta.url);
const BREAKROOM_FILES = [
  "orbit-breakroom-background.png",
  "orbit-drink-counter.png",
  "orbit-coffee-machine.png",
  "orbit-fridge.png",
  "orbit-microwave.png",
  "orbit-snack-cabinet.png",
  "orbit-dining-table.png",
];

test("retains the production smart print station artwork", () => {
  const bytes = readFileSync(new URL("orbit-print-station.png", ASSET_ROOT));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(bytes.readUInt8(25), 6);
  assert.ok(bytes.readUInt32BE(16) >= 512);
  assert.ok(bytes.readUInt32BE(20) >= 320);
  assert.ok(bytes.length >= 40_000);
});

test("removes every breakroom-only source and published image", () => {
  for (const fileName of BREAKROOM_FILES) {
    assert.equal(existsSync(new URL(fileName, ASSET_ROOT)), false, `${fileName} removed from public`);
    assert.equal(existsSync(new URL(`../../docs/work-office-assets/${fileName}`, import.meta.url)), false, `${fileName} removed from docs`);
  }
});
```

- [ ] **Step 2: Run the asset test and verify RED**

Run:

```bash
node --test src/work/officeArtwork.test.js
```

Expected: the print-station test PASSes and the deletion test FAILs because the seven breakroom images still exist.

- [ ] **Step 3: Delete the breakroom-only files**

Delete the seven JavaScript/test modules listed in this task, the seven explicit source PNGs, and their seven explicit `docs` copies. Do not delete either copy of `orbit-print-station.png`.

- [ ] **Step 4: Verify deletion and retained print coverage**

Run:

```bash
node --test src/work/officeArtwork.test.js src/work/workScreen.test.js src/work/officeNavigation.test.js
```

Expected: all tests PASS.

Run:

```bash
rg -n "breakroom|Breakroom|茶水间|orbit-(breakroom|drink|coffee|fridge|microwave|snack|dining)" src public scripts package.json .github --glob '!**/*.png'
```

Expected: no matches. Matches inside the two historical documents under `docs/superpowers/` are allowed and intentionally excluded from this runtime search.

- [ ] **Step 5: Commit the module and asset deletion**

```bash
git add -A src/work public/work-office-assets docs/work-office-assets
git commit -m "chore(work): delete breakroom assets and modules"
```

Before committing, inspect `git status --short` and confirm no `artifacts/` or `designs/` path is staged.

---

### Task 3: Full Regression and Production-Bundle Verification

**Files:**
- Verify only: `src/`
- Verify only: `public/work-office-assets/`
- Verify only: `docs/work-office-assets/`
- Verify only: `dist/`

**Interfaces:**
- Consumes: the office-only Work APP produced by Tasks 1–2.
- Produces: verified tests and a production bundle with no breakroom code or assets.

- [ ] **Step 1: Run the full test suite**

```bash
node --test --test-reporter=dot scripts/pages-sync-contract.test.mjs src/*.test.js src/work/*.test.js
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Build the production bundle**

```bash
npm run build
```

Expected: Vite exits 0 and writes `dist/index.html` plus hashed CSS/JS assets.

- [ ] **Step 3: Verify the built bundle and repository state**

```bash
rg -n "breakroom|Breakroom|茶水间|orbit-(breakroom|drink|coffee|fridge|microwave|snack|dining)" dist src public scripts package.json .github --glob '!**/*.png'
git diff --check
git status --short --branch
```

Expected: the runtime search has no matches, `git diff --check` exits 0, `main` contains only the intended commits, and user-owned untracked `artifacts/` / `designs/` files remain untouched.

- [ ] **Step 4: Record verification without deploying**

Do not modify `package.json` version, `docs/.deploy-version`, or push/deploy in this task. Report the exact test count, build result, and current commit IDs to the user; deploy only after an explicit deployment request.
