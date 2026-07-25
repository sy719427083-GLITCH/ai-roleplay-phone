# Countdown Floating Action And Visible Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the running-state red outlined footer control with a coral circular floating action and reveal the existing botanical background without changing countdown, contract, navigation, or reward behavior.

**Architecture:** Keep `ProjectCountdownView` behavior intact and expose the timer status as a footer modifier class. Apply the approved visual change through the countdown component's existing CSS, then verify the running state in the 390 x 844 browser fixture and keep the finished reward state unchanged.

**Tech Stack:** React 19, CSS, Lucide React, Node test runner, Vite, Codex in-app browser.

## Global Constraints

- Running action is a coral solid circular button with a white contract icon and no visible text.
- Running action remains at least 52 x 52 CSS pixels and retains accessible name `打开完整合同`.
- Remove the running state's red long outline and opaque white footer surface.
- Continue using `public/work-office-assets/project-countdown-background.png`.
- Make top vines and bottom flowers clearly visible while keeping contract text readable.
- Finished state keeps the existing `点击领取报酬` action and behavior.
- Do not change project API, countdown math, wallet behavior, contract copy, navigation, version number, or deployment state.

---

### Task 1: Encode The Approved Running Footer State

**Files:**
- Modify: `src/work/ProjectCountdownView.test.js`
- Modify: `src/work/ProjectCountdownView.jsx`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `finished: boolean` already derived from `timer.status` in `ProjectCountdownView`.
- Produces: footer class `work-countdown-action-bar is-running|is-finished`; existing callbacks and accessible names remain unchanged.

- [ ] **Step 1: Write the failing visual contract test**

Add this test to `src/work/ProjectCountdownView.test.js`:

```js
test("uses the approved coral floating action and transparent running footer", () => {
  assert.match(source, /work-countdown-action-bar \$\{finished \? "is-finished" : "is-running"\}/);
  assert.match(styles, /\.work-countdown-action-bar\.is-running\s*\{[^}]*background:\s*transparent/s);
  assert.match(styles, /\.work-countdown-action-bar\.is-running \.work-countdown-fixed-action\s*\{[^}]*width:\s*58px[^}]*height:\s*58px[^}]*border:\s*0[^}]*border-radius:\s*50%[^}]*background:\s*var\(--countdown-live\)[^}]*color:\s*#fff/s);
  assert.match(styles, /\.work-countdown-hero\s*\{[^}]*background:\s*rgba\(255,255,255,\.72\)/s);
  assert.match(styles, /\.work-countdown-contract\s*\{[^}]*background:\s*rgba\(255,255,255,\.76\)/s);
});
```

- [ ] **Step 2: Run the focused test and verify the new contract fails**

Run `node --test src/work/ProjectCountdownView.test.js`.

Expected: the new test fails because the footer has no state modifier and the running button is still a 358 px outlined control.

- [ ] **Step 3: Add the status modifier to the existing footer**

Replace the footer opening tag in `src/work/ProjectCountdownView.jsx` with:

```jsx
<footer className={`work-countdown-action-bar ${finished ? "is-finished" : "is-running"}`}>
```

Do not change either button's callback, disabled state, text, icon, or accessible name.

- [ ] **Step 4: Implement the approved CSS state**

Update the relevant rules in `src/work/office.css` to these values:

```css
.work-countdown-hero {
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(7px);
}

.work-countdown-contract {
  background: rgba(255,255,255,.76);
  backdrop-filter: blur(7px);
}

.work-countdown-action-bar.is-running {
  background: transparent;
  pointer-events: none;
}

.work-countdown-action-bar.is-running .work-countdown-fixed-action {
  width: 58px;
  height: 58px;
  min-height: 58px;
  border: 0;
  border-radius: 50%;
  background: var(--countdown-live);
  color: #fff;
  box-shadow: 0 12px 28px rgba(189,52,53,.3);
  pointer-events: auto;
}

.work-countdown-action-bar.is-running .work-countdown-fixed-action:active {
  background: var(--countdown-live-dark);
  opacity: 1;
}
```

Keep the existing default action bar and claim-button rules so the finished reward action stays unchanged.

- [ ] **Step 5: Run focused tests and verify the state passes**

Run `node --test src/work/ProjectCountdownView.test.js src/work/workScreen.test.js`.

Expected: all countdown view and work screen tests pass.

- [ ] **Step 6: Commit the isolated visual change**

```bash
git add src/work/ProjectCountdownView.jsx src/work/ProjectCountdownView.test.js src/work/office.css
git commit -m "style: reveal countdown background and float contract action"
```

### Task 2: Verify Background Visibility And Preserve Behavior

**Files:**
- Modify: `design-qa.md`
- Create: `artifacts/project-countdown-fullscreen/implementation-floating-action-390x844.jpg`
- Create: `artifacts/project-countdown-fullscreen/comparison-floating-action-390x844.png`

**Interfaces:**
- Consumes: local fixture URL `http://127.0.0.1:4173/ai-roleplay-phone/qa-countdown.html` and source `designs/project-countdown-fullscreen-reference.png`.
- Produces: browser-rendered evidence and a `design-qa.md` whose final result is exactly `passed`.

- [ ] **Step 1: Capture the approved running state in the in-app browser**

Open the fixture at a 390 x 844 viewport and capture the visible viewport to `artifacts/project-countdown-fullscreen/implementation-floating-action-390x844.jpg`.

Verify:

```text
button accessible name: 打开完整合同
button visible text: empty
button width: 58
button height: 58
top vines: visible
bottom flowers: visible
```

- [ ] **Step 2: Exercise the primary controls and inspect logs**

Use the current DOM snapshot to locate exactly one `打开完整合同` button and exactly one `返回办公室` button. Click each once and read browser warning and error logs.

Expected: both controls are enabled, each resolves uniquely, and warning/error logs are empty.

- [ ] **Step 3: Create and inspect the normalized comparison**

Normalize the existing 853 x 1844 source to 390 x 844 and place it beside the implementation in `artifacts/project-countdown-fullscreen/comparison-floating-action-390x844.png`.

Inspect the combined image. The footer difference is intentional: the source outlined action is replaced by the approved coral circle. Confirm the existing botanical image is visible at the top and bottom and that no contract text loses contrast.

- [ ] **Step 4: Update the blocking design QA record**

Update `design-qa.md` with the new screenshot and comparison paths, browser viewport, button dimensions, background visibility, interaction checks, console check, comparison history, intentional source deviation, and this final line:

```text
final result: passed
```

- [ ] **Step 5: Run the full regression suite and production build**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, Vite production build succeeds, and `git diff --check` returns no output.

- [ ] **Step 6: Commit QA evidence and report**

```bash
git add design-qa.md artifacts/project-countdown-fullscreen/implementation-floating-action-390x844.jpg artifacts/project-countdown-fullscreen/comparison-floating-action-390x844.png
git commit -m "test: verify countdown floating action design"
```
