# Work App Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the `工作` launcher while deleting the dedicated Work app implementation, assets, tooling, and release artifacts.

**Architecture:** Let `工作` fall through to the app shell's existing generic page instead of routing to `WorkAppScreen`. Delete the isolated feature tree and office-only dependencies, then narrow the shared Pages sync contract so deployment no longer expects `work-office-v2`.

**Tech Stack:** React 19, Vite 6, Node test runner, GitHub Pages

## Global Constraints

- Preserve the home-screen `工作` icon and label.
- Do not modify `.superpowers/sdd/progress.md` or `tmp/`.
- Release version is exactly `0.2.99`.

---

### Task 1: Lock The Launcher Boundary

**Files:**
- Create: `src/App.launcher.test.js`
- Delete: `src/App.work.test.js`

**Interfaces:**
- Consumes: the `appGroups` launcher declaration and `OpenedApp` routing in `src/App.jsx`
- Produces: a regression contract that preserves the launcher and rejects dedicated Work routing

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("keeps the Work launcher without a dedicated Work implementation", () => {
  assert.match(app, /\{ title: "工作", icon: Briefcase, variant: "line" \}/);
  assert.doesNotMatch(app, /WorkAppScreen|\.\/work\//);
  assert.doesNotMatch(app, /work-opening/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/App.launcher.test.js`

Expected: FAIL because `WorkAppScreen` and `work-opening` still exist.

- [ ] **Step 3: Remove the dedicated route**

Delete the Work imports, `isWork` branch, and `work-opening` surface class from `src/App.jsx`. Delete `src/App.work.test.js`; the launcher entry remains unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/App.launcher.test.js`

Expected: PASS.

### Task 2: Delete The Work Subsystem

**Files:**
- Delete: `src/work/`
- Delete: `public/work-office-v2/`
- Delete: `docs/work-office-v2/`
- Delete: `scripts/*office*`
- Delete: old office files under `docs/superpowers/specs/`, `docs/superpowers/plans/`, and `docs/superpowers/qa/`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `scripts/pages-sync-contract.mjs`
- Modify: `scripts/pages-sync-contract.test.mjs`

**Interfaces:**
- Consumes: the shared `syncPages({ repositoryRoot })` deployment helper
- Produces: a deployment bundle containing only shared assets and no Work app resources

- [ ] **Step 1: Remove office-only files and dependencies**

Delete the listed source, asset, script, and documentation trees. Remove `pixi.js` and `pathfinding`, and change the test command to `node --test scripts/pages-sync-contract.test.mjs src/*.test.js`.

- [ ] **Step 2: Narrow the Pages sync contract**

Set the copied asset directory list to `assets` and `worldbook-assets`, then update its test to expect those two directories and confirm stale generated content is removed by the sync.

- [ ] **Step 3: Check for residual feature references**

Run: `rg -n "WorkAppScreen|work-office-v2|src/work|pixi\.js|pathfinding|work-opening" src scripts public package.json package-lock.json`

Expected: no matches.

### Task 3: Release And Deploy V0.2.99

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Regenerate: `docs/`

**Interfaces:**
- Consumes: `npm test`, `npm run build`, and `npm run deploy:pages`
- Produces: GitHub Pages release `0.2.99`

- [ ] **Step 1: Update release markers**

Set package and lockfile versions to `0.2.99`, visible text to `Ccat OS V0.2.99`, and worldbook cache markers to `v=0.2.99`.

- [ ] **Step 2: Verify locally**

Run: `npm test && npm run build && npm run deploy:pages`

Expected: all tests pass, Vite exits successfully, and `docs/.deploy-version` contains `0.2.99`.

- [ ] **Step 3: Verify the deletion boundary**

Run: `test ! -e src/work && test ! -e public/work-office-v2 && test ! -e docs/work-office-v2 && rg -n 'title: "工作"' src/App.jsx`

Expected: deleted paths do not exist and the launcher line is printed.

- [ ] **Step 4: Commit and deploy**

Run: `git add -A -- . ':!.superpowers/sdd/progress.md' ':!tmp' && git commit -m "Deploy V0.2.99" && git push origin HEAD:main`

Expected: the release commit is pushed to `origin/main` without staging user-owned files.

- [ ] **Step 5: Verify GitHub Pages**

Fetch `.deploy-version`, the root page, and `/work-office-v2/scenes/office.webp` with cache busting.

Expected: version marker is `0.2.99`, root returns `200`, and the removed office asset returns `404`.
