# Work APP Content Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the desktop `工作` launcher while replacing the Work APP with a blank white return page that clears exactly its three owned caches, then remove every previous Work feature and asset.

**Architecture:** Move the retained boundary out of `src/work/` into a small root-level `WorkPlaceholder.jsx` plus a pure `workPlaceholder.js` cache helper. After the launcher uses that boundary, delete the entire old Work subsystem and its published assets, then tighten Pages synchronization so only remaining asset directories are deployed.

**Tech Stack:** React 19, JavaScript ES modules, Node `node:test`, Vite 6, Playwright browser QA, GitHub Pages.

## Global Constraints

- Keep the desktop `工作` icon and its opening route.
- Opening Work shows a plain white page with only an accessible return-to-desktop control.
- Opening Work removes exactly `ccatWorkCompanyV1`, `ccatWorkOfficeV1`, and `ccatWorkProjectsV1`.
- Storage failures must not crash the app, and no unrelated cache may be changed.
- Remove all prior Work UI, behavior, tests, scripts, styles, generated QA screenshots, source assets, and published assets.
- Do not edit or delete historical specifications and plans under `docs/superpowers/`.
- Preserve all unrelated APP behavior and user-owned untracked files under `artifacts/` and `designs/`.
- Publish the result as `Ccat OS V0.3.26`.

---

### Task 1: Add the retained blank Work boundary and exact cache cleanup

**Files:**
- Create: `src/workPlaceholder.js`
- Create: `src/workPlaceholder.test.js`
- Create: `src/WorkPlaceholder.jsx`
- Modify: `src/App.jsx`
- Modify: `src/App.work.test.js`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `WORK_APP_CACHE_KEYS: readonly string[]` and `clearWorkAppCache(storage): string[]`, where the return value contains keys whose removal failed.
- Produces: `WorkPlaceholder({ onClose })`, a white full-page React component that clears Work caches on mount and renders only a return button.
- Consumes: the existing `isWork` route in `AppScreen` and its `onClose` callback.

- [ ] **Step 1: Write failing pure cache tests**

Create `src/workPlaceholder.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { WORK_APP_CACHE_KEYS, clearWorkAppCache } from "./workPlaceholder.js";

test("declares exactly the three Work-owned caches", () => {
  assert.deepEqual(WORK_APP_CACHE_KEYS, [
    "ccatWorkCompanyV1",
    "ccatWorkOfficeV1",
    "ccatWorkProjectsV1",
  ]);
});

test("clears only Work caches and preserves unrelated APP data", () => {
  const values = new Map([
    ["ccatWorkCompanyV1", "company"],
    ["ccatWorkOfficeV1", "office"],
    ["ccatWorkProjectsV1", "projects"],
    ["apiCharacters", "characters"],
    ["ccat-wallet-v1", "wallet"],
  ]);
  const storage = { removeItem: (key) => values.delete(key) };
  assert.deepEqual(clearWorkAppCache(storage), []);
  assert.deepEqual([...values], [["apiCharacters", "characters"], ["ccat-wallet-v1", "wallet"]]);
});

test("continues clearing after one storage failure", () => {
  const attempted = [];
  const storage = { removeItem(key) {
    attempted.push(key);
    if (key === "ccatWorkOfficeV1") throw new Error("quota");
  } };
  assert.deepEqual(clearWorkAppCache(storage), ["ccatWorkOfficeV1"]);
  assert.deepEqual(attempted, WORK_APP_CACHE_KEYS);
});
```

- [ ] **Step 2: Update launcher contracts before implementation**

Replace the Work-specific test in `src/App.work.test.js` with assertions for the retained boundary:

```js
test("work launcher opens the blank cache-clearing placeholder", () => {
  const source = readFileSync("src/App.jsx", "utf8");
  const placeholder = readFileSync("src/WorkPlaceholder.jsx", "utf8");
  assert.match(source, /import \{ WorkPlaceholder \} from "\.\/WorkPlaceholder\.jsx"/);
  assert.match(source, /if \(isWork\) return <WorkPlaceholder onClose=\{onClose\} \/>/);
  assert.match(placeholder, /clearWorkAppCache\(window\.localStorage\)/);
  assert.match(placeholder, /aria-label="返回桌面"/);
  assert.doesNotMatch(placeholder, /项目|员工|倒计时|办公室|AI 导演/);
});
```

Update the first test in `src/App.launcher.test.js` so it keeps the icon contract but expects `WorkPlaceholder` instead of `WorkAppScreen` and no longer reads `src/work/office.css`.

- [ ] **Step 3: Run the focused tests and observe RED**

Run:

```bash
node --test src/workPlaceholder.test.js src/App.work.test.js src/App.launcher.test.js
```

Expected: FAIL because `workPlaceholder.js` and `WorkPlaceholder.jsx` do not exist and `App.jsx` still imports `WorkAppScreen`.

- [ ] **Step 4: Implement the pure cache boundary**

Create `src/workPlaceholder.js`:

```js
export const WORK_APP_CACHE_KEYS = Object.freeze([
  "ccatWorkCompanyV1",
  "ccatWorkOfficeV1",
  "ccatWorkProjectsV1",
]);

export function clearWorkAppCache(storage) {
  const failedKeys = [];
  for (const key of WORK_APP_CACHE_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      failedKeys.push(key);
    }
  }
  return failedKeys;
}
```

- [ ] **Step 5: Implement the blank page and launcher integration**

Create `src/WorkPlaceholder.jsx`:

```jsx
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { clearWorkAppCache } from "./workPlaceholder.js";

export function WorkPlaceholder({ onClose }) {
  useEffect(() => {
    clearWorkAppCache(window.localStorage);
  }, []);

  return (
    <section className="full-page work-placeholder-page" aria-label="工作">
      <button className="work-placeholder-back" type="button" onClick={onClose} aria-label="返回桌面">
        <ChevronLeft size={22} />
      </button>
    </section>
  );
}
```

In `src/App.jsx`, replace the old import and route with:

```jsx
import { WorkPlaceholder } from "./WorkPlaceholder.jsx";
// ...
if (isWork) return <WorkPlaceholder onClose={onClose} />;
```

Append minimal styles to `src/styles.css`:

```css
.work-placeholder-page { position: relative; background: #fff; }
.work-placeholder-back { position: absolute; top: max(14px, env(safe-area-inset-top, 0px)); left: 14px; display: grid; width: 44px; height: 44px; place-items: center; border: 0; border-radius: 50%; background: transparent; color: #111; }
.work-placeholder-back:focus-visible { outline: 3px solid rgba(40,110,220,.55); outline-offset: 2px; }
```

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
node --test src/workPlaceholder.test.js src/App.work.test.js src/App.launcher.test.js
npm test
```

Expected: focused tests pass; the full suite still passes before subsystem deletion.

- [ ] **Step 7: Commit the retained boundary**

```bash
git add src/workPlaceholder.js src/workPlaceholder.test.js src/WorkPlaceholder.jsx src/App.jsx src/App.work.test.js src/App.launcher.test.js src/styles.css
git commit -m "feat(work): replace Work APP with blank placeholder"
```

---

### Task 2: Delete the previous Work subsystem and prevent its return

**Files:**
- Create: `src/workRemoval.test.js`
- Delete: `src/work/`
- Delete: `public/work-office-assets/`
- Delete: `docs/work-office-assets/`
- Delete: `artifacts/work-office-qa/`
- Delete: `scripts/verify-work-office.mjs`
- Delete: `scripts/verify-work-project-reward.mjs`
- Delete: `scripts/verify-work-projects-preview.mjs`
- Modify: `package.json`
- Modify: `scripts/pages-sync-contract.mjs`
- Modify: `scripts/pages-sync-contract.test.mjs`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: Task 1's root-level Work placeholder, which must have no import from `src/work/`.
- Produces: a repository contract that forbids the deleted Work source, assets, QA scripts, and Pages directory.
- Produces: `PAGE_ASSET_DIRECTORIES === ["assets", "worldbook-assets"]`.

- [ ] **Step 1: Write the failing removal contract**

Create `src/workRemoval.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const removedPaths = [
  "src/work",
  "public/work-office-assets",
  "docs/work-office-assets",
  "artifacts/work-office-qa",
  "scripts/verify-work-office.mjs",
  "scripts/verify-work-project-reward.mjs",
  "scripts/verify-work-projects-preview.mjs",
];

test("removes the previous Work implementation and assets", () => {
  for (const path of removedPaths) assert.equal(existsSync(path), false, path);
});

test("keeps no deploy or package references to Work office assets", () => {
  const packageJson = readFileSync("package.json", "utf8");
  const pages = readFileSync("scripts/pages-sync-contract.mjs", "utf8");
  assert.doesNotMatch(packageJson, /verify:work/);
  assert.doesNotMatch(pages, /work-office-assets/);
});
```

- [ ] **Step 2: Run the removal test and observe RED**

Run:

```bash
node --test src/workRemoval.test.js
```

Expected: FAIL because the old Work directories and scripts still exist.

- [ ] **Step 3: Resolve the exact tracked deletion set**

Run these read-only checks before deletion:

```bash
git ls-files src/work public/work-office-assets docs/work-office-assets artifacts/work-office-qa scripts/verify-work-office.mjs scripts/verify-work-project-reward.mjs scripts/verify-work-projects-preview.mjs
git status --short
```

Expected: only tracked Work-owned paths appear in the first command; unrelated untracked `artifacts/` and `designs/` entries remain visible in status and are not deletion targets.

- [ ] **Step 4: Delete only the resolved Work-owned paths**

From the repository root, remove exactly:

```bash
git rm -r src/work public/work-office-assets docs/work-office-assets artifacts/work-office-qa
git rm scripts/verify-work-office.mjs scripts/verify-work-project-reward.mjs scripts/verify-work-projects-preview.mjs
```

Do not run a broad recursive deletion against `artifacts/`, `designs/`, `public/`, `docs/`, or the repository root.

- [ ] **Step 5: Remove Work scripts and the obsolete test glob**

Change `package.json` scripts to:

```json
"scripts": {
  "dev": "vite --host 127.0.0.1",
  "build": "vite build",
  "deploy:pages": "npm run build && node scripts/sync-pages.mjs",
  "preview": "vite preview --host 127.0.0.1",
  "test": "node --test scripts/pages-sync-contract.test.mjs src/*.test.js"
}
```

- [ ] **Step 6: Remove Work assets from Pages synchronization**

Change `PAGE_ASSET_DIRECTORIES` in `scripts/pages-sync-contract.mjs` to:

```js
export const PAGE_ASSET_DIRECTORIES = Object.freeze([
  "assets",
  "worldbook-assets",
]);
```

In `scripts/pages-sync-contract.test.mjs`, delete the `dist/work-office-assets` and `docs/work-office-assets` fixtures and their assertions. Change the expected directory list to:

```js
assert.deepEqual(result.assetDirectories, ["assets", "worldbook-assets"]);
```

- [ ] **Step 7: Remove obsolete durable Work rules**

In `AGENTS.md`, retain `# Prototype Instructions` and its general prototype guidance, but delete the full sections:

```text
## Selected Work APP office direction (2026-07-24)
## Work APP autonomous office behavior (2026-07-28)
```

Do not modify historical files under `docs/superpowers/`.

- [ ] **Step 8: Run removal searches and tests**

Run:

```bash
node --test src/workRemoval.test.js src/workPlaceholder.test.js src/App.work.test.js src/App.launcher.test.js
npm test
rg -n "WorkAppScreen|work-office-assets|verify:work|ccatWorkCompanyV1|ccatWorkOfficeV1|ccatWorkProjectsV1" src scripts package.json AGENTS.md public docs --glob '!docs/superpowers/**' --glob '!docs/assets/**'
git status --short
git diff --check
```

Expected: all tests pass; the search finds the three keys only in `workPlaceholder.js` and its test, plus the intentional placeholder contract. Status still lists every unrelated user-owned untracked asset untouched.

- [ ] **Step 9: Build and inspect the production bundle**

Run:

```bash
npm run build
test ! -d dist/work-office-assets
rg -n "办公室|项目管理|员工管理|AI 导演|打印中|聊天中" dist/assets/index-*.js
```

Expected: build succeeds, `dist/work-office-assets` is absent, and the final search returns no matches from the removed subsystem.

- [ ] **Step 10: Perform local mobile browser QA**

Start the local app with `npm run dev -- --port 4174 --strictPort`, then use the in-app browser at 375×812 and 390×844 to verify:

1. Seed the three Work keys plus `apiCharacters` and wallet data in local storage.
2. Unlock the phone and confirm the `工作` launcher is still present.
3. Open `工作`; confirm the viewport is white and only the return button is present.
4. Confirm all three Work keys are absent while the character and wallet keys are unchanged.
5. Activate the return button and confirm the desktop reappears.

Expected: all five checks pass at both viewport sizes.

- [ ] **Step 11: Commit the deletion**

```bash
git add -A src/work public/work-office-assets docs/work-office-assets artifacts/work-office-qa scripts package.json AGENTS.md src/workRemoval.test.js
git commit -m "refactor(work): remove Work APP implementation and assets"
```

---

### Task 3: Publish and verify V0.3.26

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Regenerate: `docs/index.html`
- Regenerate: `docs/assets/index-*.js`
- Regenerate: `docs/assets/index-*.css`
- Modify: `docs/.deploy-version`

**Interfaces:**
- Consumes: the verified placeholder and deletion contract from Tasks 1–2.
- Produces: synchronized `Ccat OS V0.3.26` Pages output with no Work office asset directory.

- [ ] **Step 1: Make the release marker test fail first**

Change `src/App.launcher.test.js` to expect:

```js
test("publishes the 0.3.26 release markers", () => {
  assert.equal(packageJson.version, "0.3.26");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.26/);
  assert.match(app, /Ccat OS V0\.3\.26/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.26/);
});
```

Run:

```bash
node --test src/App.launcher.test.js
```

Expected: FAIL because current release markers are still `0.3.25`.

- [ ] **Step 2: Update current release markers only**

Set the root package version, root lockfile version entries, `worldbookAsset` query, visible settings version, and active atlas CSS query to `0.3.26`. Do not change dependency ranges such as `@jridgewell/trace-mapping` and do not edit historical specs/plans.

- [ ] **Step 3: Run the complete release gate**

Run:

```bash
npm test
npm run build
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: zero test failures, successful builds, `docs/.deploy-version` equals `0.3.26`, and `docs/index.html` references one current JS and one current CSS hash.

- [ ] **Step 4: Inspect generated output and removed assets**

Run:

```bash
rg -o "Ccat OS V0\.3\.26|ccatWorkCompanyV1|ccatWorkOfficeV1|ccatWorkProjectsV1" docs/assets/index-*.js | sort -u
rg -o "hero-worldbook-atlas\.png\?v=0\.3\.26" docs/assets/index-*.css
test ! -d docs/work-office-assets
rg -n "办公室|项目管理|员工管理|AI 导演|打印中|聊天中" docs/assets/index-*.js
```

Expected: the version and three cleanup keys exist; the atlas query exists; the Work asset directory is absent; removed Work content strings are absent.

- [ ] **Step 5: Commit the release**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs
git commit -m "chore(release): publish blank Work APP 0.3.26"
```

- [ ] **Step 6: Integrate and push main**

Fast-forward the verified implementation branch into `main`, preserving unrelated untracked assets, then run `npm test` on the merged result and push:

```bash
git push origin main
git ls-remote origin refs/heads/main
```

Expected: local `main`, remote `main`, and the V0.3.26 release commit are identical.

- [ ] **Step 7: Verify GitHub Pages and the live app**

Wait for the `Deploy GitHub Pages` workflow for the release SHA to succeed. Fetch the cache-busted live page and verify:

- live HTML hashes equal `docs/index.html` hashes;
- live JS contains `Ccat OS V0.3.26` and exactly the three Work cleanup keys;
- live JS does not contain removed Work content strings;
- a removed asset such as `/ai-roleplay-phone/work-office-assets/orbit-office-background.png` returns HTTP 404;
- live mobile interaction still opens the blank Work page, clears only the three Work caches, and returns to the desktop;
- remote `main` still equals the local release SHA.

- [ ] **Step 8: Clean up only the implementation worktree**

After verified deployment, remove only the dedicated worktree created for this plan, prune registrations, and delete its merged feature branch. Preserve all other existing worktrees and all unrelated untracked assets.
