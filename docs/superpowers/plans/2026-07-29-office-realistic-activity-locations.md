# Work APP Realistic Activity Locations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep work, reporting, Douyin, gaming, and slacking at each character's own workstation in both local and AI-directed office scenes.

**Architecture:** Add one shared activity-to-destination resolver in `officeScenePlan.js`. Local plan generation uses it when creating activities, and `allocateOfficeActivities` applies it again as the authoritative safety boundary for local, cached, and AI plans.

**Tech Stack:** JavaScript, Node `node:test`, React/Vite production build, Playwright browser QA, GitHub Pages `docs/` publishing.

## Global Constraints

- `working`, `reporting`, `scrolling`, `gaming`, and `slacking` always use that occupant's `${slotId}-home` destination.
- `printing`, `chatting`, `resting`, and `offDuty` retain their existing specialized destination behavior.
- Preserve exact labels `摸鱼ing` and `刷抖音` as separate activities.
- Apply the rule to A local scheduling, B AI direction, cached plans passing through allocation, and post-chat replanning.
- Do not change activity probabilities, durations, API continuation, group-chat gathering, printer capacity, or the 10-second manual Me rule.
- Do not modify the user's untracked files under `artifacts/cover-alignment/` or `designs/`.

---

### Task 1: Centralize and enforce realistic activity destinations

**Files:**
- Modify: `src/work/officeScenePlan.js`
- Modify: `src/work/officeScenePlan.test.js`
- Modify: `src/work/officeSimulation.js`
- Modify: `src/work/officeSimulation.test.js`

**Interfaces:**
- Consumes: an activity id, an occupant with `slotId`, and an existing fallback destination.
- Produces: `OFFICE_DESK_ACTIVITIES` and `resolveOfficeActivityDestination(activity, occupant, fallbackDestination)`.

- [ ] **Step 1: Write failing tests for all five workstation activities and distinct slots**

```js
test("keeps desk activities at each occupant's own workstation", () => {
  const deskActivities = ["working", "reporting", "scrolling", "gaming", "slacking"];
  assert.deepEqual([...OFFICE_DESK_ACTIVITIES], deskActivities);
  for (const activity of deskActivities) {
    assert.equal(resolveOfficeActivityDestination(activity, { slotId: "boss" }, "rest-left"), "boss-home");
    assert.equal(resolveOfficeActivityDestination(activity, { slotId: "employee4" }, "play-right"), "employee4-home");
  }
});

test("preserves specialized destinations for non-desk activities", () => {
  for (const [activity, destination] of [["printing", "print-station"], ["chatting", "social-left"], ["resting", "rest-right"], ["offDuty", "off-duty"]]) {
    assert.equal(resolveOfficeActivityDestination(activity, { slotId: "employee2" }, destination), destination);
  }
});
```

- [ ] **Step 2: Write a failing allocation test that represents an incorrect AI response**

```js
test("normalizes AI desk activities without changing their metadata", () => {
  const plan = { characters: {
    c1: { activity: "gaming", label: "打游戏", destination: "play-left", startsAt: 10, endsAt: 20, priority: "scheduled" },
    c2: { activity: "scrolling", label: "刷抖音", destination: "rest-right", startsAt: 10, endsAt: 20, priority: "scheduled" },
    c3: { activity: "slacking", label: "摸鱼ing", destination: "social-center", startsAt: 10, endsAt: 20, priority: "scheduled" },
  } };
  const occupants = [
    { slotId: "boss", profile: { id: "c1" } },
    { slotId: "employee1", profile: { id: "c2" } },
    { slotId: "employee2", profile: { id: "c3" } },
  ];
  const result = allocateOfficeActivities(plan, occupants);
  assert.equal(result.characters.c1.destination, "boss-home");
  assert.equal(result.characters.c2.destination, "employee1-home");
  assert.equal(result.characters.c3.destination, "employee2-home");
  assert.deepEqual({ ...result.characters.c1, destination: "play-left" }, plan.characters.c1);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `node --test src/work/officeScenePlan.test.js src/work/officeSimulation.test.js`

Expected: FAIL because the shared resolver does not exist and AI gaming/scrolling/slacking destinations are not corrected.

- [ ] **Step 4: Implement the shared destination resolver**

```js
export const OFFICE_DESK_ACTIVITIES = new Set(["working", "reporting", "scrolling", "gaming", "slacking"]);

export function resolveOfficeActivityDestination(activity, occupant, fallbackDestination) {
  if (OFFICE_DESK_ACTIVITIES.has(activity) && occupant?.slotId) return `${occupant.slotId}-home`;
  return fallbackDestination;
}
```

- [ ] **Step 5: Enforce the resolver inside `allocateOfficeActivities`**

```js
for (const occupant of occupants) {
  const item = next.characters[occupant.profile.id];
  if (!item) continue;
  const corrected = {
    ...item,
    destination: resolveOfficeActivityDestination(item.activity, occupant, item.destination),
  };
  next.characters[occupant.profile.id] = corrected;
  if (corrected.destination === "print-station") {
    if (printerTaken) next.characters[occupant.profile.id] = { ...corrected, destination: "print-wait", label: "等待打印" };
    printerTaken = true;
  }
}
```

- [ ] **Step 6: Use the same resolver during local plan creation**

Import `resolveOfficeActivityDestination` into `officeSimulation.js`. Remove `gaming`, `scrolling`, and `slacking` from the public-location branches in `sharedDestination`, then assign:

```js
const fallbackDestination = sharedDestination(activity, index) || `${occupant.slotId}-home`;
characters[occupant.profile.id] = {
  activity,
  label: definition.label,
  destination: resolveOfficeActivityDestination(activity, occupant, fallbackDestination),
  startsAt,
  endsAt: startsAt + minutes * 60_000,
  priority: "scheduled",
};
```

- [ ] **Step 7: Add a local-plan invariant test across deterministic seeds**

Generate 300 deterministic plans covering work hours, lunch, evenings, nights, and weekends. For every character whose activity belongs to `OFFICE_DESK_ACTIVITIES`, assert `destination === `${occupant.slotId}-home``. Also retain existing exact-label and group-chat tests.

- [ ] **Step 8: Run focused and full unit tests**

Run:

```bash
node --test src/work/officeScenePlan.test.js src/work/officeSimulation.test.js src/work/useOfficeSimulation.test.js
npm test
```

Expected: all tests pass and the full count exceeds the V0.3.22 baseline of 183.

- [ ] **Step 9: Commit the realistic destination rule**

```bash
git add src/work/officeScenePlan.js src/work/officeScenePlan.test.js src/work/officeSimulation.js src/work/officeSimulation.test.js
git commit -m "fix(work): keep desk activities at assigned workstations"
```

---

### Task 2: Verify both scheduling modes in the browser

**Files:**
- Modify: `scripts/verify-work-office.mjs`
- Modify: `artifacts/work-office-qa/office-375x812.png`
- Modify: `artifacts/work-office-qa/office-390x844.png`

**Interfaces:**
- Consumes: the shared resolver from Task 1.
- Produces: mobile-browser evidence that local and AI plans put gaming, scrolling, and slacking occupants at their own workstations.

- [ ] **Step 1: Extend the intercepted AI scene with incorrect public destinations**

For the AI scene response, assign the first three profiles:

```js
const qaActivities = [
  { activity: "gaming", label: "打游戏", destination: "play-left" },
  { activity: "scrolling", label: "刷抖音", destination: "rest-right" },
  { activity: "slacking", label: "摸鱼ing", destination: "social-center" },
];
```

The remaining profiles return `working` with deliberately incorrect `boss-home` destinations. All seven must be corrected by the app to their assigned workstation homes.

- [ ] **Step 2: Add browser assertions after B mode receives the AI plan**

Keep API requests successful for this assertion. Wait for movement to finish, then compare every character's anchor against the percentage point for its slot home. Assert the three activity labels remain `打游戏`, `刷抖音`, and `摸鱼ing`, while destinations are corrected. After the assertion, switch the route to failure mode and retain the existing concrete fallback-notice test.

- [ ] **Step 3: Run production build and both viewport QA**

Run: `npm run build && npm run verify:work`

Expected: `Work office browser QA passed for 375x812 and 390x844`, with each desk activity anchored at the correct workstation on both viewports.

- [ ] **Step 4: Commit browser evidence**

```bash
git add scripts/verify-work-office.mjs artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "test(work): verify realistic workstation activities"
```

---

### Task 3: Publish and verify V0.3.23

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Modify: `docs/.deploy-version`
- Modify: generated files under `docs/assets/` and `docs/index.html`

**Interfaces:**
- Consumes: verified implementation from Tasks 1–2.
- Produces: synchronized V0.3.23 Pages assets and a verified live release.

- [ ] **Step 1: Update every release marker to `0.3.23`**

Change package versions, visible `Ccat OS V0.3.23`, launcher tests, deploy marker, and the versioned atlas URL together.

- [ ] **Step 2: Run the complete release gate**

```bash
node --test src/App.launcher.test.js
npm test
npm run build
npm run verify:work
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: all unit tests, both mobile viewports, production build, and Pages synchronization pass.

- [ ] **Step 3: Commit the release bundle**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs
git commit -m "chore(release): publish realistic activity locations 0.3.23"
```

- [ ] **Step 4: Fast-forward, push, and verify production**

Fast-forward the implementation branch into `main`, push `main`, and poll `https://sy719427083-glitch.github.io/ai-roleplay-phone/?release=0.3.23` until its HTML references the new hashes. Fetch deployed JS/CSS and verify `Ccat OS V0.3.23`, the five desk activity ids, and the versioned atlas URL. Confirm remote `main` equals local `HEAD`.

- [ ] **Step 5: Clean up only this completed feature worktree**

Remove the feature worktree under `.worktrees/`, prune metadata, and delete the merged local feature branch. Preserve every unrelated worktree and all untracked user assets.
