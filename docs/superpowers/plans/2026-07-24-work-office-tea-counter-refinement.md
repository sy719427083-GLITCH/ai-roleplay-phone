# Work Office Tea Counter Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Work office tea counter smaller and move it upward/rightward while keeping its A* destination aligned and collision-free.

**Architecture:** Keep `OFFICE_LAYOUT.tea` and `OFFICE_INTERACTION_POINTS` as the geometry source of truth, mirror the approved container values in CSS, and rely on the existing responsive collision derivation and A* route planner. Release the verified change through the existing Vite-to-`docs/` GitHub Pages workflow.

**Tech Stack:** React, JavaScript ES modules, CSS, Node test runner, Playwright, Vite, GitHub Pages

## Global Constraints

- Tea counter changes from `64% × 18%`, `top: 6%`, `right: 2%` to `58% × 16%`, `top: 4%`, `right: 0%`.
- Tea interaction point changes from `{ x: 93, y: 28 }` to `{ x: 92, y: 24 }`.
- Boss/employee desks, character home points, avatar size, movement timing, and A* grid settings do not change.
- No office PNG is added, replaced, deleted, or staged.
- The six untracked legacy desk/tea PNG files remain untouched.

---

### Task 1: Align tea counter CSS, geometry, and destination

**Files:**
- Modify: `src/work/officeGeometry.test.js`
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/officeGeometry.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `OFFICE_LAYOUT.tea`, `OFFICE_INTERACTION_POINTS["tea-counter"]`, and `getOfficeGeometry(viewport)`.
- Produces: the approved responsive counter rectangle and `{ x: 92, y: 24 }` destination used by `createOfficeRoute`.

- [ ] **Step 1: Change the geometry and CSS contract tests first**

Update the tea assertions in `src/work/officeGeometry.test.js`:

```js
test("uses the approved smaller raised tea counter and lower-right approach", () => {
  assert.deepEqual(OFFICE_LAYOUT.tea, {
    top: 4,
    right: 0,
    width: 58,
    height: 16,
    alpha: [79 / 900, 9 / 520, 820 / 900, 505 / 520],
  });
  assert.deepEqual(OFFICE_INTERACTION_POINTS["tea-counter"], { x: 92, y: 24 });
});
```

Update the CSS contract in `src/work/workScreen.test.js`:

```js
assert.match(styles, /\.office-object\.tea\s*\{[^}]*top:\s*4%;[^}]*right:\s*0;[^}]*width:\s*58%;[^}]*height:\s*16%/s);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test src/work/officeGeometry.test.js src/work/workScreen.test.js
```

Expected: FAIL because production still exposes `top: 6`, `right: 2`, `width: 64`, `height: 18`, and `{ x: 93, y: 28 }`.

- [ ] **Step 3: Apply the approved geometry values**

Change only the tea constants in `src/work/officeGeometry.js`:

```js
export const OFFICE_INTERACTION_POINTS = Object.freeze({
  "tea-counter": Object.freeze({ x: 92, y: 24 }),
});

// Inside OFFICE_LAYOUT
tea: Object.freeze({
  top: 4,
  right: 0,
  width: 58,
  height: 16,
  alpha: Object.freeze([79 / 900, 9 / 520, 820 / 900, 505 / 520]),
}),
```

- [ ] **Step 4: Apply the matching CSS values**

Replace the tea rule in `src/work/office.css`:

```css
.office-object.tea { z-index: 2; top: 4%; right: 0; width: 58%; height: 16%; }
```

Do not modify desk rules, character rules, or walking animation values.

- [ ] **Step 5: Run focused routing and source tests**

Run:

```bash
node --test src/work/officeGeometry.test.js src/work/officePathfinding.test.js src/work/officeNavigation.test.js src/work/workScreen.test.js
```

Expected: all tests PASS, including every office destination route combination.

- [ ] **Step 6: Run full and browser verification**

Run:

```bash
npm test
npm run verify:work
git diff --check
```

Expected: 68 or more Node tests PASS; browser QA passes at 375x812 and 390x844; employee-six-to-tea movement finishes without the anchor crossing non-endpoint furniture.

- [ ] **Step 7: Commit the refinement**

```bash
git add src/work/officeGeometry.test.js src/work/workScreen.test.js src/work/officeGeometry.js src/work/office.css artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "fix: refine office tea counter placement"
```

### Task 2: Publish V0.3.4 and verify GitHub Pages

**Files:**
- Modify: `src/App.launcher.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Update: `docs/.deploy-version`
- Update: `docs/index.html`
- Replace: `docs/assets/index-*.js`
- Replace: `docs/assets/index-*.css`

**Interfaces:**
- Consumes: the tested tea-counter refinement from Task 1 and the existing `npm run deploy:pages` sync contract.
- Produces: V0.3.4 on `main`, deployed from the same production bundle verified locally.

- [ ] **Step 1: Add the failing V0.3.4 release test**

Change only the release test in `src/App.launcher.test.js`:

```js
test("publishes the 0.3.4 release markers", () => {
  assert.equal(packageJson.version, "0.3.4");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.4/);
  assert.match(app, /Ccat OS V0\.3\.4/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.4/);
});
```

- [ ] **Step 2: Run the release test and verify RED**

Run:

```bash
node --test src/App.launcher.test.js
```

Expected: FAIL because package and cache markers still say `0.3.3`.

- [ ] **Step 3: Update all release markers**

Set package and lockfile versions to `0.3.4`. Change the two markers in `src/App.jsx` to `?v=0.3.4` and `Ccat OS V0.3.4`, and change the worldbook image cache query in `src/styles.css` to `?v=0.3.4`.

- [ ] **Step 4: Verify release markers GREEN**

Run:

```bash
node --test src/App.launcher.test.js
```

Expected: both launcher/release tests PASS.

- [ ] **Step 5: Build, sync Pages, and verify the synchronized release**

Run:

```bash
set -e
npm test
npm run verify:work
npm run deploy:pages
npm test
git diff --check
test "$(cat docs/.deploy-version)" = "0.3.4"
```

Expected: all tests and both browser sizes PASS, Vite build succeeds, and `docs/.deploy-version` is exactly `0.3.4`.

- [ ] **Step 6: Commit only release sources and generated artifacts**

```bash
git add package.json package-lock.json src/App.jsx src/styles.css src/App.launcher.test.js docs/.deploy-version docs/index.html docs/assets
git commit -m "chore: publish tea counter refinement V0.3.4"
```

Do not stage `docs/work-office-assets/boss-desk.png`, `employee-desk.png`, `tea-counter.png`, or their `public/` copies.

- [ ] **Step 7: Integrate and publish**

From the main checkout, fetch and verify that `origin/main` is an ancestor of the feature branch, fast-forward `main`, run `npm test`, and push `main`:

```bash
git fetch origin
git merge-base --is-ancestor origin/main feature/work-office-v1
git pull --ff-only origin main
git merge --ff-only feature/work-office-v1
npm test
git push origin main
```

- [ ] **Step 8: Verify the live deployment**

Wait for both `Deploy GitHub Pages` and `pages build and deployment` for the pushed commit to finish successfully. Confirm:

```text
https://sy719427083-glitch.github.io/ai-roleplay-phone/?v=0.3.4 returns 200
the live JS and CSS SHA-256 hashes equal docs/assets
the live CSS contains top:4%; right:0; width:58%; height:16%
every current work-office asset URL returns HTTP 200
```

Keep the feature worktree if its six untracked legacy PNG files prevent safe cleanup.
