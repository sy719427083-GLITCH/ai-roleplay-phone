# Work Office Layout Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the three office doors, reposition the tea counter and boss desk, and move avatars farther behind desks so they remain visible.

**Architecture:** Keep the existing layered office renderer and change its declarative furniture inventory, route graph, and CSS coordinates. Protect the new layout with focused source-contract tests, then publish it as Ccat OS V0.3.1 through the existing GitHub Pages workflow.

**Tech Stack:** React, JavaScript ES modules, CSS, Node test runner, Vite, GitHub Pages

## Global Constraints

- The office keeps exactly one boss desk and six employee desks.
- The tea counter remains right-aligned and moves down four scene-height percentage points and right three scene-width percentage points.
- The boss desk moves down three scene-height percentage points.
- Avatar home waypoints move upward five scene-height percentage points behind their desks.
- Existing untracked files must not be staged or removed.

---

### Task 1: Remove door objects and routes

**Files:**
- Modify: `src/work/officeAssets.test.js`
- Modify: `src/work/officeNavigation.test.js`
- Modify: `src/work/officeAssets.js`
- Modify: `src/work/officeNavigation.js`

**Interfaces:**
- Consumes: `OFFICE_FURNITURE`, `OFFICE_OBJECT_ASSETS`, `OFFICE_NODES`, `OBJECT_DESTINATIONS`, and `findOfficeRoute`.
- Produces: an eight-object furniture inventory containing seven desks and one tea counter, with no door destinations or graph nodes.

- [ ] **Step 1: Write failing furniture and navigation tests**

Update the furniture expectation to:

```js
assert.deepEqual(OFFICE_FURNITURE.map((item) => item.id), [
  "bossDesk", "employee1Desk", "employee2Desk", "employee3Desk",
  "employee4Desk", "employee5Desk", "employee6Desk", "tea",
]);
assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("door")).length, 0);
assert.deepEqual(Object.keys(OFFICE_OBJECT_ASSETS).sort(), ["bossDesk", "employeeDesk", "tea"]);
```

Add a navigation assertion:

```js
test("removes every door destination and waypoint", () => {
  assert.equal(Object.keys(OBJECT_DESTINATIONS).some((key) => key.toLowerCase().includes("door")), false);
  assert.equal(Object.keys(OFFICE_NODES).some((key) => key.includes("door")), false);
  assert.equal(Object.values(OFFICE_NODES).flatMap((node) => node.edges).some((edge) => edge.includes("door")), false);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test src/work/officeAssets.test.js src/work/officeNavigation.test.js
```

Expected: FAIL because the three door objects, asset keys, destinations, nodes, and edges still exist.

- [ ] **Step 3: Remove the door declarations and routes**

In `officeAssets.js`, remove `doorLeft`, `doorRight`, and the three door entries from `OFFICE_FURNITURE`. In `officeNavigation.js`, remove the three door nodes and destination mappings, and remove their ids from aisle edge arrays. Import `OFFICE_NODES` in the navigation test.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
node --test src/work/officeAssets.test.js src/work/officeNavigation.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the door removal**

```bash
git add src/work/officeAssets.js src/work/officeAssets.test.js src/work/officeNavigation.js src/work/officeNavigation.test.js
git commit -m "feat: remove office doors"
```

### Task 2: Correct furniture and avatar positions

**Files:**
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/officeNavigation.test.js`
- Modify: `src/work/office.css`
- Modify: `src/work/officeNavigation.js`

**Interfaces:**
- Consumes: CSS classes `.office-object.desk.boss` and `.office-object.tea`, plus home nodes in `OFFICE_NODES`.
- Produces: boss desk `top: 23%`, tea counter `top: 6%; right: 2%`, employee home y values `40, 56, 72`, boss home y `24`, and tea waypoint `{ x: 79, y: 24 }`.

- [ ] **Step 1: Write failing position tests**

Add CSS contract assertions to `workScreen.test.js`:

```js
assert.match(styles, /\.office-object\.desk\.boss\s*\{[^}]*top:\s*23%/s);
assert.match(styles, /\.office-object\.tea\s*\{[^}]*top:\s*6%;[^}]*right:\s*2%/s);
```

Add node assertions to `officeNavigation.test.js`:

```js
assert.deepEqual(OFFICE_NODES["boss-home"], { x: 50, y: 24, edges: ["aisle-top"] });
assert.deepEqual([1, 2, 3, 4, 5, 6].map((number) => OFFICE_NODES[`employee${number}-home`].y), [40, 40, 56, 56, 72, 72]);
assert.deepEqual(OFFICE_NODES["tea-counter"], { x: 79, y: 24, edges: ["aisle-top"] });
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeNavigation.test.js
```

Expected: FAIL with the old boss, tea, and avatar coordinates.

- [ ] **Step 3: Apply the approved coordinates**

Change the boss CSS `top` from `20%` to `23%`, tea CSS from `top: 2%; right: 5%` to `top: 6%; right: 2%`, and update the navigation node coordinates to the exact values asserted above. Leave every employee desk CSS rule unchanged.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
node --test src/work/workScreen.test.js src/work/officeNavigation.test.js
```

Expected: all focused tests PASS.

- [ ] **Step 5: Commit the position correction**

```bash
git add src/work/office.css src/work/workScreen.test.js src/work/officeNavigation.js src/work/officeNavigation.test.js
git commit -m "fix: align office furniture and avatars"
```

### Task 3: Publish and verify V0.3.1

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/App.launcher.test.js`
- Modify: `docs/index.html`
- Modify: `docs/.deploy-version`
- Replace: `docs/assets/index-*.js`
- Replace: `docs/assets/index-*.css`

**Interfaces:**
- Consumes: the existing `npm test`, `npm run verify:work`, `npm run deploy:pages`, and GitHub Pages workflow.
- Produces: release version `0.3.1` on `main` and the deployed public office scene.

- [ ] **Step 1: Write the failing release-marker test**

Change `src/App.launcher.test.js` to expect package version and cache markers `0.3.1`.

- [ ] **Step 2: Run the release test and verify RED**

Run:

```bash
node --test src/App.launcher.test.js
```

Expected: FAIL while production markers remain `0.3.0`.

- [ ] **Step 3: Update release markers**

Set `package.json` and `package-lock.json` versions to `0.3.1`; update the `Ccat OS V0.3.1` label and worldbook asset query in `src/App.jsx`; update the worldbook hero query in `src/styles.css`.

- [ ] **Step 4: Verify the full release locally**

Run:

```bash
npm test
npm run verify:work
npm run deploy:pages
npm test
git diff --check
```

Expected: 62 tests PASS, browser QA passes at 375x812 and 390x844, Vite build succeeds, and generated Pages files identify V0.3.1.

- [ ] **Step 5: Commit and publish**

```bash
git add package.json package-lock.json src/App.jsx src/styles.css src/App.launcher.test.js docs/.deploy-version docs/index.html docs/assets
git commit -m "chore: publish Work office V0.3.1"
git fetch origin
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
```

- [ ] **Step 6: Verify GitHub Pages and the live scene**

Wait for the `Deploy GitHub Pages` run for the pushed commit to succeed. Open the live Work APP and verify that it exposes only `老板桌`, `员工桌 1` through `员工桌 6`, and `茶水吧台`; visually confirm the boss desk and tea counter positions and that an assigned avatar is visible behind its desk.
