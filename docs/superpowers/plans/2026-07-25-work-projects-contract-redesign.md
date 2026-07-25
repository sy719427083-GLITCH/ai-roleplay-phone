# Work Projects Formal Contract Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the five-project preview as formal paper contracts with signature lines and a signed seal while preserving all project behavior.

**Architecture:** Keep `projectPreviewModel.js` unchanged. Recompose `ProjectManagementPreview.jsx` around semantic contract fields and deterministic display-only contract numbers, then replace the project-page CSS with paper, double-border, signature, and seal treatments. Extend existing source and Playwright contracts to verify both unsigned and signed states.

**Tech Stack:** React 19, CSS, lucide-react, Node test runner, Playwright

## Global Constraints

- Keep exactly five items, the 650ms refresh skeleton, and the signed-state refresh lock.
- Use warm-grey desktop background, ivory contract paper, ink-black text, and a red signed seal.
- Keep `projectPreviewModel.js` and its function signatures unchanged.
- Add no external fonts or dependencies; all touch targets remain at least 44px.
- Use fixed “今日生效” display copy, not a runtime date.
- Do not connect the real API, publish online, or modify other Work APP pages.

---

### Task 1: Formal contract component and styling

**Files:**
- Modify: `src/work/ProjectManagementPreview.jsx`
- Modify: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: existing preview state and project fields `id`, `name`, `duration`, `amount`, `description`, and `difficulty`.
- Produces: `.work-contract-number`, `.work-contract-parties`, `.work-contract-terms`, `.work-contract-signatures`, `.work-contract-seal`, and `.is-muted` hooks.

- [ ] **Step 1: Write the failing source-contract test**

```js
test("project preview renders formal contract fields and signed state", () => {
  for (const text of ["项目合同", "待签署合同", "委托方", "CCAT 工作中心", "承接方", "合同总额：人民币", "交付期限", "甲方签章", "乙方签章", "签署合同并开始", "已签署", "今日生效"]) {
    assert.match(source, new RegExp(text));
  }
  for (const className of ["work-contract-number", "work-contract-parties", "work-contract-terms", "work-contract-signatures", "work-contract-seal"]) {
    assert.match(source, new RegExp(className));
  }
  assert.match(styles, /--work-contract-seal:\s*#a92c2c/);
  assert.match(styles, /\.work-project-card::after/);
  assert.doesNotMatch(source, /WORK BOARD|ASSIGNMENT/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: FAIL because formal contract copy and class hooks are absent.

- [ ] **Step 3: Recompose contract markup without changing handlers**

Use the existing `locked`, `isStarted`, and `isMuted` values. Build each card as:

```jsx
<article className={`work-project-card${isStarted ? " is-started" : ""}${isMuted ? " is-muted" : ""}`}>
  <div className="work-contract-heading">
    <span className="work-contract-number">合同编号 CCAT-2026-{String(previewState.revision * 5 + index + 1).padStart(3, "0")}</span>
    <h2>{project.name}</h2>
    {isStarted && <span className="work-contract-seal">已签署<small>今日生效</small></span>}
  </div>
  <dl className="work-contract-parties">
    <div><dt>委托方（甲方）</dt><dd>CCAT 工作中心</dd></div>
    <div><dt>承接方（乙方）</dt><dd>{isStarted ? "已确认承接" : "待签署"}</dd></div>
  </dl>
  <dl className="work-contract-terms">
    <div><dt>合同总额</dt><dd>人民币 {project.amount}</dd></div>
    <div><dt>交付期限</dt><dd>{project.duration}</dd></div>
    <div><dt>难度等级</dt><dd>{project.difficulty}</dd></div>
  </dl>
  <section className="work-contract-scope"><h3>第一条 · 项目内容</h3><p>{project.description}</p></section>
  <div className="work-contract-signatures"><span>甲方签章</span><span>乙方签章</span></div>
  <button className="work-project-start" ...>{isStarted ? "合同执行中" : locked ? "本合同不可签署" : "签署合同并开始"}</button>
</article>
```

Change the page title to “项目合同”, normal status to “待签署合同 5 份”, signed status to “合同已生效，本批合同已锁定”, and refresh copy to “换一批”/“已锁定”.

- [ ] **Step 4: Replace the project CSS with the formal paper system**

Define `--work-contract-paper: #fbf7ea`, `--work-contract-ink: #252522`, `--work-contract-rule: #77736a`, and `--work-contract-seal: #a92c2c`. Use a warm-grey desk background, `border-radius: 3px`, a double-line effect via `box-shadow: inset 0 0 0 3px var(--work-contract-paper), inset 0 0 0 4px rgba(37,37,34,.35)`, and a subtle paper-line texture. Style `.work-contract-seal` as a rotated red outlined stamp; render the signature row with top rules and preserve readable contrast on `.is-muted` cards.

- [ ] **Step 5: Verify focused and full tests**

Run: `node --test src/work/ProjectManagementPreview.test.js && npm test`

Expected: focused tests and all repository tests pass with zero failures.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/work/ProjectManagementPreview.jsx src/work/ProjectManagementPreview.test.js src/work/office.css
git commit -m "feat(work): present projects as formal contracts"
```

### Task 2: Contract browser QA and screenshots

**Files:**
- Modify: `scripts/verify-work-projects-preview.mjs`
- Modify: `scripts/verify-work-office.mjs`
- Modify: `artifacts/work-projects-preview/projects-ready-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-ready-390x844.png`
- Modify: `artifacts/work-projects-preview/projects-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-390x844.png`

**Interfaces:**
- Consumes: contract page headings and class hooks from Task 1.
- Produces: ready and signed contract screenshots for both supported phone sizes.

- [ ] **Step 1: Update browser assertions**

```js
await page.getByRole("heading", { name: "项目合同", level: 1 }).waitFor();
assert.equal(await page.locator(".work-contract-number").count(), 5);
assert.equal(await page.locator(".work-contract-parties").count(), 5);
assert.equal(await page.locator(".work-contract-signatures").count(), 5);
```

After signing, require one seal, four muted contracts, and disabled refresh:

```js
await page.getByText("合同已生效，本批合同已锁定", { exact: true }).waitFor();
assert.equal(await page.locator(".work-contract-seal").count(), 1);
assert.equal(await page.locator(".work-project-card.is-muted").count(), 4);
assert.equal(await refreshButton.isDisabled(), true);
```

- [ ] **Step 2: Generate both visual states**

Run: `node scripts/verify-work-projects-preview.mjs`

Expected: QA passes at 375×812 and 390×844 and replaces all four project preview images.

- [ ] **Step 3: Inspect 390×844 screenshots**

Confirm the ready image shows contract number, parties, terms, signature lines, and “签署合同并开始”. Confirm the signed image shows one readable red “已签署 / 今日生效” seal and four de-emphasized but legible contracts.

- [ ] **Step 4: Run final regression**

Run: `npm run build && node scripts/verify-work-office.mjs && git diff --check`

Expected: build succeeds, both office viewport flows pass, and whitespace validation is clean.

- [ ] **Step 5: Commit Task 2**

```bash
git add scripts/verify-work-projects-preview.mjs scripts/verify-work-office.mjs artifacts/work-projects-preview
git commit -m "test(work): verify formal contract previews"
```
