# Print Station Angle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rotate the Work APP print station clockwise by 2 degrees around its left-bottom anchor while keeping character navigation outside the rotated artwork.

**Architecture:** Keep the visual angle in the existing print-station CSS and declare the same numeric angle in `OFFICE_LAYOUT.printStation`. Convert the print station's alpha-derived visible rectangle into a rotated axis-aligned bounding box before the existing avatar clearance is applied, so rendering and navigation follow the same approved B option.

**Tech Stack:** React 19, plain CSS, JavaScript geometry, Node.js built-in test runner, Vite 6

## Global Constraints

- Preserve `top: 11%`, `right: 0`, `width: 48%`, and `height: 14%`.
- Use clockwise `2deg` rotation with `transform-origin: left bottom`.
- Keep `rotate(2deg)` during the active `scale(.975)` state.
- Preserve `OFFICE_INTERACTION_POINTS["print-station"] = { x: 93, y: 31 }` unless tests prove that point overlaps the rotated visible artwork.
- Do not modify the print-station PNG, office background, desks, characters, or other facilities.
- Do not modify or stage user-owned untracked files under `artifacts/` or `designs/`.
- Do not deploy or bump the version unless the user separately requests it.

---

## File Map

- Modify `src/work/office.css`: apply the selected B angle, fixed left-bottom origin, and rotation-preserving active state.
- Modify `src/work/workScreen.test.js`: lock the approved visual CSS contract.
- Modify `src/work/officeGeometry.js`: declare the shared angle and rotate the visible collision rectangle around the same left-bottom pivot.
- Modify `src/work/officeGeometry.test.js`: lock the angle, rotated bounds, fixed destination, and traversability.
- Verify `src/work/officeNavigation.test.js`: ensure office routes remain valid around the rotated obstacle.

---

### Task 1: Apply the B Angle and Rotate the Collision Bounds

**Files:**
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/officeGeometry.test.js`
- Modify: `src/work/office.css`
- Modify: `src/work/officeGeometry.js`
- Test: `src/work/officeNavigation.test.js`

**Interfaces:**
- Consumes: `OFFICE_LAYOUT.printStation`, `visibleRectangle(id, container, alpha)`, and `inflateRectangle(visible, viewport, options)`.
- Produces: `OFFICE_LAYOUT.printStation.rotation = 2`, CSS `rotate(2deg)`, and a print-station obstacle whose `visible` field is the rotated axis-aligned bounding box.

- [ ] **Step 1: Write the failing visual CSS assertions**

In `src/work/workScreen.test.js`, extend the full-bleed office test with:

```js
assert.match(styles, /\.office-object\.print-station\s*\{[^}]*transform-origin:\s*left bottom;[^}]*transform:\s*rotate\(2deg\)/s);
assert.match(styles, /\.office-object\.print-station:active\s*\{[^}]*transform:\s*rotate\(2deg\) scale\(\.975\)/s);
```

- [ ] **Step 2: Write the failing geometry assertions**

In `src/work/officeGeometry.test.js`, add `rotation: 2` to the approved layout assertion. Add this helper and test:

```js
function assertNear(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

test("rotates the print station bounds clockwise around its left-bottom anchor", () => {
  const geometry = getOfficeGeometry({ width: 390, height: 844 });
  const print = geometry.obstacles.find((obstacle) => obstacle.id === "printStation");
  assert.ok(print);
  assertNear(print.visible.left, 56.224860712021595, "rotated left");
  assertNear(print.visible.top, 11.397731719514338, "rotated top");
  assertNear(print.visible.right, 96.18682870562813, "rotated right");
  assertNear(print.visible.bottom, 26.122671180775257, "right edge moves down");
  assert.equal(pointInsideRect(OFFICE_INTERACTION_POINTS["print-station"], print.visible), false);
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeGeometry.test.js
```

Expected: FAIL because the CSS has no rotation/origin/active override, the layout has no `rotation` value, and the obstacle still uses unrotated bounds.

- [ ] **Step 4: Implement the selected CSS angle**

In `src/work/office.css`, replace the current print-station rule with:

```css
.office-object.print-station { z-index: 2; top: 11%; right: 0; width: 48%; height: 14%; transform-origin: left bottom; transform: rotate(2deg); }
.office-object.print-station:active { transform: rotate(2deg) scale(.975); }
```

- [ ] **Step 5: Declare and apply the shared geometry rotation**

In `src/work/officeGeometry.js`, add `rotation: 2` to `OFFICE_LAYOUT.printStation` after `height: 14`.

Add these private helpers after `visibleRectangle`:

```js
function rotatePoint(point, pivot, degrees) {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const x = point.x - pivot.x;
  const y = point.y - pivot.y;
  return {
    x: pivot.x + x * cosine - y * sine,
    y: pivot.y + x * sine + y * cosine,
  };
}

function rotateRectangle(rectangle, pivot, degrees) {
  const corners = [
    { x: rectangle.left, y: rectangle.top },
    { x: rectangle.right, y: rectangle.top },
    { x: rectangle.right, y: rectangle.bottom },
    { x: rectangle.left, y: rectangle.bottom },
  ].map((point) => rotatePoint(point, pivot, degrees));
  return {
    id: rectangle.id,
    left: Math.min(...corners.map((point) => point.x)),
    top: Math.min(...corners.map((point) => point.y)),
    right: Math.max(...corners.map((point) => point.x)),
    bottom: Math.max(...corners.map((point) => point.y)),
  };
}
```

Replace `getPrintStationObstacle` with:

```js
function getPrintStationObstacle(viewport) {
  const layout = OFFICE_LAYOUT.printStation;
  const container = {
    left: 100 - layout.right - layout.width,
    top: layout.top,
    width: layout.width,
    height: layout.height,
  };
  const visible = visibleRectangle("printStation", container, layout.alpha);
  const pivot = { x: container.left, y: container.top + container.height };
  const rotatedVisible = rotateRectangle(visible, pivot, layout.rotation);
  return inflateRectangle(rotatedVisible, viewport, { includeTop: true, includeBottom: false });
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeGeometry.test.js src/work/officeNavigation.test.js
```

Expected: all focused tests PASS; every office destination remains reachable and the print interaction point remains outside the rotated visible bounds.

- [ ] **Step 7: Commit the angle and collision update**

```bash
git add src/work/office.css src/work/officeGeometry.js src/work/workScreen.test.js src/work/officeGeometry.test.js
git commit -m "fix(work): angle print station toward planter"
```

---

### Task 2: Full Regression, Build, and Mobile Visual Verification

**Files:**
- Verify only: `src/`
- Verify only: `public/work-office-assets/`
- Verify only: `dist/`

**Interfaces:**
- Consumes: the rotated print station and collision bounds from Task 1.
- Produces: automated and visual evidence that the selected B angle works without regressions.

- [ ] **Step 1: Run the full test suite**

```bash
node --test --test-reporter=dot scripts/pages-sync-contract.test.mjs src/*.test.js src/work/*.test.js
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Build the production bundle**

```bash
npm run build
```

Expected: Vite exits 0 and writes hashed CSS/JS assets under `dist/assets/`.

- [ ] **Step 3: Verify repository and bundle contracts**

```bash
rg -n "print-station.*rotate\(2deg\)|transform-origin:left bottom" dist/assets/*.css
git diff --check
git status --short --branch
```

Expected: the built CSS contains the selected angle and fixed origin, `git diff --check` exits 0, and only user-owned untracked `artifacts/` / `designs/` files remain outside committed work.

- [ ] **Step 4: Verify the real UI at 390 × 844**

Start the local Vite server, open the Work APP at a `390 × 844` browser viewport, and verify:

```text
breakroom entry count = 0
print-station computed transform includes a 2 degree rotation matrix
print-station transform-origin resolves to its left-bottom corner
left-bottom anchor remains at the existing top/right/width/height layout
right end visually lowers toward the right planter base
browser console errors = 0
```

Capture one screenshot for visual inspection, then stop the server and reset the temporary browser viewport.

- [ ] **Step 5: Do not deploy without a separate request**

Do not modify the `0.3.14` release markers, sync `docs/`, push, or deploy. Report the test count, build result, visual result, and commit ID; deployment requires an explicit user instruction.
