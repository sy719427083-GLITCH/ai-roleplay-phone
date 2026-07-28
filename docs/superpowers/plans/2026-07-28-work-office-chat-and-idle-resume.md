# Work Office Chat and Idle Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent solo office conversations and restore Me autonomy exactly 10 seconds after the latest furniture click.

**Architecture:** Strengthen the existing conversation contract at parser, scene validator, and runtime boundaries by counting distinct assigned profile IDs. Replace the current long manual activity lifetime with a resettable 10-second run-ID timer inside `useOfficeSimulation`, persisting the same expiry in office state and immediately creating a fresh local plan when the latest timer fires.

**Tech Stack:** React 19, browser timers and localStorage, Node.js built-in test runner, Playwright, Vite 6.

## Global Constraints

- A conversation always requires at least two distinct, currently assigned profiles.
- Two turns from the same speaker never create a conversation or speech bubble.
- Every valid Me furniture click starts or resets an exact `10_000 ms` inactivity window.
- The latest inactivity timeout immediately restores autonomous planning; it does not wait for the next 15-minute interval.
- Older timeouts cannot override a newer click command.
- Other Work pages do not reset the furniture-click idle timer.
- Preserve V0.3.18 office layout, routing, A/B modes, project management, and existing user artifacts.
- Publish the completed correction as V0.3.19.

## File Structure

- Modify `src/work/officeConversation.js`: enforce two distinct known speakers after dialogue sanitation.
- Modify `src/work/officeScenePlan.js`: normalize participant IDs and reject duplicate-only conversations.
- Modify `src/work/useOfficeSimulation.js`: validate runtime participants and own the resettable 10-second manual timer/replan.
- Modify `src/work/officeState.js`: preserve an unexpired `manualMe.endsAt` and discard expired state.
- Modify corresponding `*.test.js` files: prove all conversation and timer boundaries.
- Modify `scripts/verify-work-office.mjs`: verify one-person no-bubble behavior and latest-click 10-second resume.
- Modify release markers and Pages output for V0.3.19.

---

### Task 1: Enforce Two Distinct Conversation Participants

**Files:**
- Modify: `src/work/officeConversation.js`
- Modify: `src/work/officeConversation.test.js`
- Modify: `src/work/officeScenePlan.js`
- Modify: `src/work/officeScenePlan.test.js`

**Interfaces:**
- Consumes: normalized AI turns, candidate scene participant IDs, and the current assigned profile set.
- Produces: `getDistinctConversationIds(ids, validIds): string[]`; dialogue and scene plans only when the distinct participant count is 2-4.

- [ ] **Step 1: Write failing duplicate-speaker and duplicate-participant tests**

```js
test("rejects two AI turns from one speaker", () => {
  const content = JSON.stringify({ turns: [
    { speakerId: "character:c1", text: "我先核一下。" },
    { speakerId: "character:c1", text: "已经核完了。" },
  ] });
  assert.throws(() => parseOfficeConversation(content, participants, { now: 1_000 }), /至少两名人物/);
});

test("rejects duplicate-only scene participants", () => {
  const result = validateOfficeScenePlan({ characters: validCharacters, conversation: { participantIds: ["character:c1", "character:c1"] } }, { profileIds, now: 1_000 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /conversation/);
});
```

- [ ] **Step 2: Run tests and confirm the expected red phase**

Run: `node --test src/work/officeConversation.test.js src/work/officeScenePlan.test.js`

Expected: both new tests fail because raw turn count and raw array length currently permit duplicate-only conversations.

- [ ] **Step 3: Implement one shared distinct-ID rule**

```js
export function getDistinctConversationIds(ids = [], validIds = null) {
  return [...new Set(ids.filter((id) => typeof id === "string" && id && (!validIds || validIds.has(id))))].slice(0, 4);
}
```

Use this helper after AI-turn sanitation and during scene-plan validation. `parseOfficeConversation` throws `办公室聊天至少需要两名人物` when fewer than two distinct known speakers remain. Scene validation adds `conversation` to `issues` when the normalized list has fewer than two IDs.

- [ ] **Step 4: Verify valid two-person and 2-4 person cases remain green**

Run: `node --test src/work/officeConversation.test.js src/work/officeScenePlan.test.js src/work/officeSimulation.test.js`

Expected: all tests pass; one-person and duplicate-only inputs fail validation while genuine two-person conversations remain valid.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeConversation.js src/work/officeConversation.test.js src/work/officeScenePlan.js src/work/officeScenePlan.test.js
git commit -m "fix(work): require two office chat participants"
```

### Task 2: Resume Me Autonomy Ten Seconds After the Latest Click

**Files:**
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/useOfficeSimulation.test.js`
- Modify: `src/work/officeState.js`
- Modify: `src/work/officeState.test.js`

**Interfaces:**
- Consumes: a valid furniture target, current scene plan, assigned Me profile, current time, and the latest manual run ID.
- Produces: `ME_MANUAL_IDLE_MS = 10_000`; `interruptMePlan(...).characters[meId].endsAt = now + 10_000`; `resumeMeAutonomy({ plan, meId, autonomousActivity, now }): OfficeScenePlan`.

- [ ] **Step 1: Write failing exact-expiry and resume tests**

```js
test("manual Me state expires exactly ten seconds after a click", () => {
  const next = interruptMePlan(plan, "me:m1", { destination: "print-station", now: 2_000, label: "查看打印机" });
  assert.equal(next.characters["me:m1"].endsAt, 12_000);
});

test("resume replaces manual Me activity and keeps other profiles", () => {
  const next = resumeMeAutonomy({ plan: manualPlan, meId: "me:m1", autonomousActivity: { activity: "working", label: "工作中", destination: "boss-home", startsAt: 12_000, endsAt: 30_000, priority: "scheduled" }, now: 12_000 });
  assert.equal(next.characters["me:m1"].priority, "scheduled");
  assert.deepEqual(next.characters["character:c1"], manualPlan.characters["character:c1"]);
  assert.match(next.id, /resume:12000/);
});
```

Add state tests that restore `manualMe` before expiry with an injected `now`, discard it at/after expiry, and verify `END_MANUAL_ME` clears it.

- [ ] **Step 2: Run tests and confirm failure**

Run: `node --test src/work/useOfficeSimulation.test.js src/work/officeState.test.js`

Expected: the duration assertion receives `122_000`, and the resume helper is missing.

- [ ] **Step 3: Implement exact manual lifetime and pure resume helper**

```js
export const ME_MANUAL_IDLE_MS = 10_000;

export function resumeMeAutonomy({ plan, meId, autonomousActivity, now }) {
  return {
    ...plan,
    id: `${plan.id}:resume:${now}`,
    characters: { ...plan.characters, [meId]: autonomousActivity },
  };
}
```

Set manual `endsAt` from the click timestamp plus `ME_MANUAL_IDLE_MS`. Extend `restoreOfficeState(raw, profiles, now = Date.now())` so tests and runtime use the same expiry boundary without changing existing callers.

- [ ] **Step 4: Add a resettable run-ID timer to the hook**

Add `manualTimer` and `manualRun` refs. On each valid furniture click:

```js
window.clearTimeout(manualTimer.current);
const run = manualRun.current + 1;
manualRun.current = run;
manualTimer.current = window.setTimeout(() => {
  if (manualRun.current !== run) return;
  dispatch({ type: "END_MANUAL_ME" });
  setPlan((current) => resumeMeAutonomy({ plan: current, meId: me.profile.id, autonomousActivity: createCurrentMeActivity(), now: Date.now() }));
}, ME_MANUAL_IDLE_MS);
```

`createCurrentMeActivity` derives one fresh Mode A plan for the current interval and selects only Me's allocated activity; other character entries remain unchanged. Clear the timer and increment `manualRun` on unmount and when the assigned Me ID changes.

- [ ] **Step 5: Test a second click invalidating the first timer**

Extract or inject timer scheduling so a test records two callbacks. Assert the first callback does nothing after the second click increments the run ID, while the second callback clears manual state and creates a `resume` plan. Assert settings/project navigation has no call path to the reset function.

Run: `node --test src/work/useOfficeSimulation.test.js src/work/officeState.test.js src/work/workScreen.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js src/work/officeState.js src/work/officeState.test.js
git commit -m "fix(work): resume Me autonomy after ten seconds"
```

### Task 3: Verify Runtime Boundaries in Mobile Browser QA

**Files:**
- Modify: `scripts/verify-work-office.mjs`
- Modify: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: deterministic one-person and two-person localStorage fixtures and the rendered Work office.
- Produces: browser evidence for no solo bubble and latest-click idle resumption at 375x812 and 390x844.

- [ ] **Step 1: Add source contract tests for runtime distinct-participant checks and timer cleanup**

Require `useOfficeSimulation.js` to contain a distinct runtime participant set, `ME_MANUAL_IDLE_MS`, `manualRun`, `manualTimer`, `END_MANUAL_ME`, and unmount cleanup.

- [ ] **Step 2: Add a one-person no-bubble browser case**

Seed only `me:qaMe`, inject a cached same-speaker dialogue, open Work, wait through one dialogue-turn duration, and assert `.office-character-bubble` count remains zero. Also assert the network request counter for `/chat/completions` remains zero.

- [ ] **Step 3: Add latest-click timer behavior**

In the seven-person fixture, click one desk, wait 6 seconds, click a second furniture target, wait 6 seconds, and assert Me remains under manual priority. Then wait just over 4 additional seconds and assert Me's visible status/destination changes to a non-manual autonomous activity. Read persisted office state and assert `simulation.manualMe === null`.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
node --test src/work/*.test.js
npm test
npm run build
npm run verify:work
git diff --check
```

Expected: Node tests pass, Vite builds successfully, and both approved mobile sizes complete the corrected QA flow.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-work-office.mjs src/work/workScreen.test.js
git commit -m "test(work): verify chat and idle resume corrections"
```

### Task 4: Publish and Verify V0.3.19

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Generated: `docs/index.html`, `docs/.deploy-version`, `docs/assets/*`

**Interfaces:**
- Consumes: verified correction commits.
- Produces: V0.3.19 on the configured GitHub Pages URL.

- [ ] **Step 1: Change the release test first and verify red**

Update `src/App.launcher.test.js` to require package version and visible/asset markers `0.3.19` / `V0.3.19`.

Run: `node --test src/App.launcher.test.js`

Expected: FAIL because production markers remain V0.3.18.

- [ ] **Step 2: Update release markers**

Set `package.json`, both root package entries in `package-lock.json`, `src/App.jsx`, and `src/styles.css` from `0.3.18` to `0.3.19`.

- [ ] **Step 3: Run release gates and synchronize Pages**

Run:

```bash
npm test
npm run build
npm run verify:work
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: 0 failures, successful production build, both mobile QA sizes pass, and Pages assets match the V0.3.19 build.

- [ ] **Step 4: Commit, push, and wait for deployment**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs/index.html docs/.deploy-version docs/assets
git commit -m "chore(release): publish office corrections 0.3.19"
git push origin main
```

Wait for the `Deploy GitHub Pages` workflow for the release commit to complete successfully.

- [ ] **Step 5: Verify the live bundle**

Open `https://sy719427083-glitch.github.io/ai-roleplay-phone/?release=0.3.19`, confirm the HTML references the new hashed JS/CSS, and confirm the fetched assets contain `Ccat OS V0.3.19`, `ME_MANUAL_IDLE_MS` behavior, `办公室聊天至少需要两名人物`, and the activity/bubble styles. Report commit SHA, test count, build result, both mobile QA sizes, workflow result, and live URL.

## Self-Review Results

- Spec coverage: distinct participants, duplicate-speaker rejection, runtime bubble clearing, exact 10-second expiry, latest-click reset, unmount/reassignment cleanup, persisted expiry, browser QA, versioning, deployment, and live verification are covered.
- Placeholder scan: every step contains concrete files, commands, assertions, and expected outcomes.
- Type consistency: `ME_MANUAL_IDLE_MS`, `resumeMeAutonomy`, `manualRun`, `manualTimer`, `END_MANUAL_ME`, `participantIds`, and the `local`/`ai` modes use consistent names throughout.
