# Work Projects Editorial Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current pastel project preview with the approved editorial task-board visual while preserving every existing project interaction.

**Architecture:** Keep `projectPreviewModel.js` unchanged and restyle the existing `ProjectManagementPreview` view. Markup changes provide the editorial hierarchy and stable state hooks; CSS owns the paper, navy, and acid-green presentation. Browser QA captures ready and locked states at both supported phone sizes.

**Tech Stack:** React 19, CSS, lucide-react, Node test runner, Playwright

## Global Constraints

- Keep exactly five projects and preserve refresh, 650ms skeleton, start, and refresh-lock behavior.
- Use warm ivory surfaces, deep navy text, and acid-green state emphasis.
- Do not add external fonts or dependencies.
- Keep all interactive targets at least 44px.
- Do not connect the real API or publish online.
- Do not modify the office, employee manager, timer, settings, or project data model.

---

### Task 1: Editorial project board component and style

**Files:**
- Modify: `src/work/ProjectManagementPreview.jsx`
- Modify: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `createProjectPreviewState()`, `refreshPreviewProjects(state)`, and `startPreviewProject(state, projectId)` without signature changes.
- Produces: `.work-projects-kicker`, `.work-projects-count`, `.work-project-price`, `.work-project-ticket-meta`, and `.is-muted` presentation hooks for browser QA and styling.

- [ ] **Step 1: Add failing source-contract assertions**

Add assertions that require the approved hierarchy and prohibit the old gradient button:

```js
for (const text of ["WORK BOARD", "今日项目", "个新项目等待认领", "刷新"]) {
  assert.match(source, new RegExp(text));
}
for (const className of ["work-projects-kicker", "work-projects-count", "work-project-price", "work-project-ticket-meta", "is-muted"]) {
  assert.match(source, new RegExp(className));
}
assert.match(styles, /--work-editorial-navy:\s*#17233d/);
assert.match(styles, /--work-editorial-acid:\s*#b9ee43/);
assert.doesNotMatch(styles, /\.work-project-start\s*\{[^}]*linear-gradient/s);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: FAIL because the editorial copy, hooks, and tokens do not exist yet.

- [ ] **Step 3: Recompose the existing component markup**

Keep the state handlers unchanged. Replace the header/summary/card hierarchy with this structure:

```jsx
<header className="work-projects-header">
  <button className="work-projects-back" type="button" onClick={onBack} aria-label="返回工作室">...</button>
  <div className="work-projects-title-block">
    <span className="work-projects-kicker">WORK BOARD</span>
    <h1>今日项目</h1>
  </div>
  <button className="work-projects-refresh" type="button" disabled={locked || refreshing} ...>
    <RefreshCw ... /><span>{locked ? "进行中" : "刷新"}</span>
  </button>
</header>
<div className={`work-projects-summary${locked ? " is-locked" : ""}`}>
  <strong>{locked ? "项目进行中，今日列表已锁定" : `${previewState.projects.length} 个新项目等待认领`}</strong>
  <span>{locked ? "完成当前项目后可获取新项目" : "选择一项工作，开始今天的创作"}</span>
</div>
```

For each card, add `is-muted` when another project is active, render the amount in `.work-project-price`, and group duration/difficulty in `.work-project-ticket-meta`. Preserve the existing semantic `article`, headings, buttons, disabled attributes, and accessible labels.

- [ ] **Step 4: Replace only the project-page CSS block**

Define the editorial tokens and use flat paper surfaces:

```css
.work-projects-page {
  --work-editorial-paper: #f3efe4;
  --work-editorial-card: #fffdf7;
  --work-editorial-navy: #17233d;
  --work-editorial-acid: #b9ee43;
  --work-editorial-muted: #697186;
  background: var(--work-editorial-paper);
}
.work-project-card {
  border: 1px solid rgba(23,35,61,.18);
  border-radius: 10px;
  background: var(--work-editorial-card);
  box-shadow: 4px 4px 0 rgba(23,35,61,.08);
}
.work-project-start {
  min-height: 46px;
  background: var(--work-editorial-navy);
  color: #fffdf7;
}
.work-project-card.is-started .work-project-start {
  background: var(--work-editorial-acid);
  color: var(--work-editorial-navy);
}
```

Use an 8px spacing rhythm, ensure both icon controls remain at least 44px, and keep the existing reduced-motion rule for refresh and skeleton animations.

- [ ] **Step 5: Run focused and full automated tests**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: all project preview tests pass.

Run: `npm test`

Expected: 76 tests pass with zero failures.

- [ ] **Step 6: Commit the editorial UI**

```bash
git add src/work/ProjectManagementPreview.jsx src/work/ProjectManagementPreview.test.js src/work/office.css
git commit -m "feat(work): redesign projects as editorial board"
```

### Task 2: Browser visual verification and preview artifacts

**Files:**
- Modify: `scripts/verify-work-projects-preview.mjs`
- Modify: `artifacts/work-projects-preview/projects-ready-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-ready-390x844.png`
- Modify: `artifacts/work-projects-preview/projects-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-390x844.png`

**Interfaces:**
- Consumes: current project page selectors and state behavior.
- Produces: verified ready and locked screenshots at 375×812 and 390×844.

- [ ] **Step 1: Extend browser assertions for the new style**

After opening the page, assert the new title and hooks:

```js
await page.getByText("WORK BOARD", { exact: true }).waitFor();
await page.getByRole("heading", { name: "今日项目", level: 1 }).waitFor();
assert.equal(await page.locator(".work-project-price").count(), 5);
assert.equal(await page.locator(".work-project-ticket-meta").count(), 5);
```

After starting the first project, assert four muted cards:

```js
assert.equal(await page.locator(".work-project-card.is-muted").count(), 4);
```

- [ ] **Step 2: Run browser QA and regenerate screenshots**

Run: `node scripts/verify-work-projects-preview.mjs`

Expected: `Work projects preview QA passed for 375x812 and 390x844` and all four screenshots show the editorial style.

- [ ] **Step 3: Visually inspect both states**

Open `projects-ready-390x844.png` and `projects-390x844.png`. Confirm the ready view exposes the navy start buttons and the locked view exposes one acid-green active card plus four visibly de-emphasized cards without reducing body text below readable contrast.

- [ ] **Step 4: Run final regression checks**

Run: `npm run build && node scripts/verify-work-office.mjs && git diff --check`

Expected: production build succeeds, both office phone-size flows pass, and `git diff --check` emits no output.

- [ ] **Step 5: Commit verified artifacts**

```bash
git add scripts/verify-work-projects-preview.mjs artifacts/work-projects-preview
git commit -m "test(work): verify editorial project previews"
```
