# Work Contract White Paper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change only the contract paper surface from ivory to pure white while preserving the grey outer background and all contract behavior.

**Architecture:** Update the contract paper design token in `office.css`; component markup and project state remain unchanged. A source-contract assertion protects the exact white token, and existing Playwright QA regenerates both ready and signed screenshots.

**Tech Stack:** CSS, Node test runner, Playwright

## Global Constraints

- Set `--work-contract-paper` to exactly `#ffffff`.
- Keep the outer contract-page background `#dedbd3`.
- Do not change contract lines, shadows, red seal, copy, layout, or interactions.
- Do not connect the real API or publish online.

---

### Task 1: White contract paper and visual verification

**Files:**
- Modify: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/office.css`
- Modify: `artifacts/work-projects-preview/projects-ready-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-ready-390x844.png`
- Modify: `artifacts/work-projects-preview/projects-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-390x844.png`

**Interfaces:**
- Consumes: existing `.work-projects-page` contract tokens.
- Produces: `--work-contract-paper: #ffffff` with unchanged `background-color: #dedbd3`.

- [ ] **Step 1: Write the failing token assertion**

```js
assert.match(styles, /--work-contract-paper:\s*#ffffff/);
assert.match(styles, /background-color:\s*#dedbd3/);
assert.doesNotMatch(styles, /--work-contract-paper:\s*#fbf7ea/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: FAIL because the paper token is still `#fbf7ea`.

- [ ] **Step 3: Change only the paper token**

```css
.work-projects-page {
  --work-contract-paper: #ffffff;
  /* every other token and background declaration remains unchanged */
}
```

- [ ] **Step 4: Verify tests and screenshots**

Run: `npm test && node scripts/verify-work-projects-preview.mjs`

Expected: all tests pass and both phone sizes regenerate ready and signed screenshots with white contract paper.

- [ ] **Step 5: Inspect the 390×844 screenshots**

Confirm contract sheets are pure white, outer background remains grey, and black rules plus the red signed seal remain legible.

- [ ] **Step 6: Build and office regression**

Run: `npm run build && node scripts/verify-work-office.mjs && git diff --check`

Expected: build and both office viewport flows pass with no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add src/work/ProjectManagementPreview.test.js src/work/office.css artifacts/work-projects-preview
git commit -m "style(work): make contract paper white"
```
