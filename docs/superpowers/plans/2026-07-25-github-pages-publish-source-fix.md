# GitHub Pages Publish Source Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the current project-management build from GitHub Actions and release it as Ccat OS `0.3.8` without the legacy `docs` source overwriting it.

**Architecture:** Keep `.github/workflows/deploy-pages.yml` as the sole deployment pipeline and switch the repository Pages setting from `legacy` to `workflow`. Update every user-visible and cache-busting release marker together, then verify the deployed HTML and hashed JS directly.

**Tech Stack:** React 19, Vite 7, Node.js test runner, GitHub Actions, GitHub Pages REST API

## Global Constraints

- GitHub Pages must report `build_type: workflow` before the release push.
- The release version and every existing release marker must be exactly `0.3.8`.
- Existing untracked files under `artifacts/` and `designs/` must remain untouched.
- Completion requires live HTML and JS verification, not only a successful workflow status.

---

### Task 1: Release Version 0.3.8

**Files:**
- Modify: `src/App.launcher.test.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: the existing release marker contract in `src/App.launcher.test.js`
- Produces: one consistent `0.3.8` release version for package metadata, visible UI, and asset cache queries

- [ ] **Step 1: Write the failing release-marker test**

Replace the release-marker test with:

```js
test("publishes the 0.3.8 release markers", () => {
  assert.equal(packageJson.version, "0.3.8");
  assert.match(app, /worldbook-assets\/\$\{fileName\}\?v=0\.3\.8/);
  assert.match(app, /Ccat OS V0\.3\.8/);
  assert.match(styles, /worldbook-assets\/hero-worldbook-atlas\.png\?v=0\.3\.8/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/App.launcher.test.js`

Expected: FAIL because package and source markers still contain `0.3.7`.

- [ ] **Step 3: Update all release markers**

Set the root versions in `package.json` and `package-lock.json` to `0.3.8`. Change both markers in `src/App.jsx` to `?v=0.3.8` and `Ccat OS V0.3.8`; change the worldbook hero query in `src/styles.css` to `?v=0.3.8`.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test src/App.launcher.test.js`

Expected: 2 tests PASS and 0 tests FAIL.

- [ ] **Step 5: Commit the release marker change**

```bash
git add package.json package-lock.json src/App.jsx src/styles.css src/App.launcher.test.js
git commit -m "chore: bump release to 0.3.8"
```

### Task 2: Select GitHub Actions as the Sole Pages Source

**Files:**
- Verify: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: the existing `deploy-pages.yml` workflow that uploads `dist`
- Produces: repository Pages configuration with `build_type: workflow`

- [ ] **Step 1: Capture the current Pages setting**

Run: `gh api repos/sy719427083-GLITCH/ai-roleplay-phone/pages`

Expected before the fix: `"build_type":"legacy"` and source path `"/docs"`.

- [ ] **Step 2: Switch Pages to workflow mode**

Run:

```bash
gh api --method PUT repos/sy719427083-GLITCH/ai-roleplay-phone/pages -f build_type=workflow
```

Expected: the request completes without an API error.

- [ ] **Step 3: Verify the setting changed**

Run: `gh api repos/sy719427083-GLITCH/ai-roleplay-phone/pages --jq '{build_type, html_url}'`

Expected: `build_type` is `workflow` and `html_url` is the project Pages URL.

### Task 3: Validate and Publish

**Files:**
- Generated locally: `dist/**`

**Interfaces:**
- Consumes: source at the release commit and the corrected Pages configuration
- Produces: a successful deployment whose public files match the local production build

- [ ] **Step 1: Run the complete automated test suite**

Run: `npm test`

Expected: all tests PASS with 0 failures.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: Vite exits with status 0 and prints the generated hashed JS and CSS names.

- [ ] **Step 3: Confirm the working tree contains only intended tracked changes**

Run: `git status --short --branch`

Expected: `main` is ahead only by the committed spec, plan, and version commits; the pre-existing untracked `artifacts/` and `designs/` entries remain untouched.

- [ ] **Step 4: Commit the implementation plan**

```bash
git add docs/superpowers/plans/2026-07-25-github-pages-publish-source-fix.md
git commit -m "docs: plan GitHub Pages source fix"
```

- [ ] **Step 5: Push the release**

Run: `git push origin main`

Expected: `origin/main` advances to the local release commit and starts `Deploy GitHub Pages`.

- [ ] **Step 6: Wait for the deployment workflow**

Run: `gh run watch $(gh run list --workflow deploy-pages.yml --branch main --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status`

Expected: the workflow concludes `success`.

- [ ] **Step 7: Verify the public deployment**

Fetch the live HTML with a unique cache-busting query, extract its JS and CSS names, and compare them with the local `dist/index.html`. Then download the live JS and search it for `项目倒计时`, `工作结束`, and `点击领取报酬`.

Expected: live and local asset names match, all three feature strings exist in the live JS, and the live page visibly reports `Ccat OS V0.3.8` when opened.
