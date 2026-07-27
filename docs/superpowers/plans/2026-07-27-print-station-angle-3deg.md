# Print Station 3 Degree Angle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lower only the right end of the office print station by increasing its left-bottom-anchored clockwise rotation from `2°` to `3°`.

**Architecture:** Keep the existing CSS transform and pure geometry model aligned through the shared literal angle value in their respective files. Update source-level regression tests first, then adjust the CSS and collision geometry together so the visual placement and walking obstacle remain consistent.

**Tech Stack:** React 19, CSS, Node.js built-in test runner, Vite 6, GitHub Pages

## Global Constraints

- Keep `top: 11%`, `right: 0`, `width: 48%`, and `height: 14%` unchanged.
- Keep `transform-origin: left bottom` unchanged so the left side remains anchored.
- Use exactly `3deg` for default and pressed-state CSS rotation.
- Use exactly `rotation: 3` for collision geometry.
- Do not modify other furniture, backgrounds, character positions, or walking speed.
- Release the verified change as version `0.3.16` only after local visual QA passes.

---

### Task 1: Lock the 3 Degree Visual and Geometry Contract

**Files:**
- Modify: `src/work/workScreen.test.js:39-40`
- Modify: `src/work/officeGeometry.test.js:26-52`

**Interfaces:**
- Consumes: `OFFICE_LAYOUT.printStation` and `getOfficeGeometry({ width, height })` from `src/work/officeGeometry.js`.
- Produces: Regression assertions for the exact CSS angle, pressed-state angle, geometry angle, and rotated visible bounds at `390 × 844`.

- [ ] **Step 1: Update the CSS source assertions to require 3 degrees**

```js
assert.match(styles, /\.office-object\.print-station\s*\{[^}]*transform-origin:\s*left bottom;[^}]*transform:\s*rotate\(3deg\)/s);
assert.match(styles, /\.office-object\.print-station:active\s*\{[^}]*transform:\s*rotate\(3deg\) scale\(\.975\)/s);
```

- [ ] **Step 2: Update the geometry contract and exact rotated bounds**

```js
assert.deepEqual(OFFICE_LAYOUT.printStation, {
  top: 11,
  right: 0,
  width: 48,
  height: 14,
  rotation: 3,
  alpha: [79 / 900, 9 / 520, 820 / 900, 505 / 520],
});

assertNear(print.visible.left, 56.22869478106918, "rotated left");
assertNear(print.visible.top, 11.481670960442923, "rotated top");
assertNear(print.visible.right, 96.39342030255264, "rotated right");
assertNear(print.visible.bottom, 26.885533122963604, "right edge moves down");
```

- [ ] **Step 3: Run the focused tests and verify the expected failure**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeGeometry.test.js
```

Expected: FAIL because the production CSS and geometry still use `2deg` and `rotation: 2`.

- [ ] **Step 4: Commit the failing contract tests**

```bash
git add src/work/workScreen.test.js src/work/officeGeometry.test.js
git commit -m "test(work): require 3 degree print station angle"
```

---

### Task 2: Apply the 3 Degree Rotation

**Files:**
- Modify: `src/work/office.css:38-39`
- Modify: `src/work/officeGeometry.js:29-37`

**Interfaces:**
- Consumes: The exact assertions introduced in Task 1.
- Produces: A `3deg` left-bottom-anchored CSS transform and matching `rotation: 3` collision model.

- [ ] **Step 1: Change the default and pressed-state transforms**

```css
.office-object.print-station { z-index: 2; top: 11%; right: 0; width: 48%; height: 14%; transform-origin: left bottom; transform: rotate(3deg); }
.office-object.print-station:active { transform: rotate(3deg) scale(.975); }
```

- [ ] **Step 2: Change the print-station geometry angle**

```js
printStation: Object.freeze({
  top: 11,
  right: 0,
  width: 48,
  height: 14,
  rotation: 3,
  alpha: Object.freeze([79 / 900, 9 / 520, 820 / 900, 505 / 520]),
}),
```

- [ ] **Step 3: Run the focused tests**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeGeometry.test.js
```

Expected: PASS with all focused Work screen and geometry tests green.

- [ ] **Step 4: Run the complete test suite and production build**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: 135 tests pass, Vite builds successfully, and `git diff --check` prints no errors.

- [ ] **Step 5: Verify the 390 by 844 visual result**

Run the Vite development server and inspect the Work office at a `390 × 844` viewport. Confirm the computed print-station transform is approximately `matrix(0.99863, 0.052336, -0.052336, 0.99863, 0, 0)`, the transform origin begins at `0px`, the left-side anchor is unchanged, the right end is slightly lower than the `2°` version, and the console contains no warnings or errors.

- [ ] **Step 6: Commit the implementation**

```bash
git add src/work/office.css src/work/officeGeometry.js
git commit -m "fix(work): lower print station right edge"
```

---

### Task 3: Release Version 0.3.16 to GitHub Pages

**Files:**
- Modify: `package.json:3`
- Modify: `package-lock.json:3,9`
- Modify: `src/App.jsx:133,2041`
- Modify: `src/App.launcher.test.js:17-21`
- Modify: `src/styles.css:14`
- Modify generated release files under `docs/`

**Interfaces:**
- Consumes: The visually verified Task 2 implementation.
- Produces: GitHub Pages assets and release markers for `0.3.16`.

- [ ] **Step 1: Update every current release marker from 0.3.15 to 0.3.16**

Run:

```bash
npm version 0.3.16 --no-git-tag-version
```

Then change the source markers to these exact values:

```js
const worldbookAsset = (fileName) => `${import.meta.env.BASE_URL}worldbook-assets/${fileName}?v=0.3.16`;
```

```jsx
<p className="version-label">Ccat OS V0.3.16</p>
```

```css
--wb-hero-image: url("/ai-roleplay-phone/worldbook-assets/hero-worldbook-atlas.png?v=0.3.16");
```

```js
test("publishes the 0.3.16 release markers", () => {
  assert.equal(packageJson.version, "0.3.16");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.16/);
  assert.match(app, /Ccat OS V0\.3\.16/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.16/);
});
```

Leave historical design and plan documents unchanged.

- [ ] **Step 2: Build and synchronize the Pages output**

Run:

```bash
npm run deploy:pages
```

Expected: Vite completes successfully and `docs/index.html`, `docs/.deploy-version`, and hashed `docs/assets/` files match the new build.

- [ ] **Step 3: Re-run the complete release verification**

Run:

```bash
npm test
git diff --check
```

Expected: 135 tests pass, including the Pages sync contract and `0.3.16` release-marker test; `git diff --check` prints no errors.

- [ ] **Step 4: Commit only the release files**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs/.deploy-version docs/index.html docs/assets
git commit -m "chore: release 0.3.16"
```

- [ ] **Step 5: Push main and wait for the Pages workflow**

```bash
git push origin main
run_id=$(gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$run_id" --exit-status
```

Expected: the run for the pushed release commit completes with `success`.

- [ ] **Step 6: Verify the live release**

Fetch `https://sy719427083-glitch.github.io/ai-roleplay-phone/` with a cache-busting query. Confirm the HTML references the newly generated CSS and JS hashes, the live CSS contains `transform-origin:left bottom` and `transform:rotate(3deg)`, and the live JS contains `Ccat OS V0.3.16`.
