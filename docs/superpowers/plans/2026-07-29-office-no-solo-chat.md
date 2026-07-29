# Work APP No-Solo-Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent every one-person or stale office chat from showing “聊天中” or moving to a public chat point, while preserving valid group gathering and dialogue.

**Architecture:** Normalize conversation membership at the shared `allocateOfficeActivities` boundary, converting every orphaned `chatting` activity to `working` at its assigned workstation. Apply that boundary to generated local plans, restored interval plans, AI plans, and manual-interruption plans before movement derives participant routes.

**Tech Stack:** JavaScript, React hooks, Node `node:test`, Playwright browser QA, Vite, GitHub Pages.

## Global Constraints

- Every visible chat requires 2–4 distinct profiles that are currently assigned to office slots.
- A `chatting` activity that is not part of a valid conversation becomes `working`, label `工作中`, destination `${slotId}-home`.
- Valid chats keep the first participant in place; only the other participants approach the host.
- Dialogue requests and bubbles start only after every valid guest arrives.
- Do not change chat probability, activity duration, API continuation, mode A/B selection, printer capacity, workstation activity rules, or the 10-second manual Me timer.
- Preserve `摸鱼ing` and `刷抖音` as distinct activities and exact labels.
- Do not modify the user's untracked files under `artifacts/cover-alignment/` or `designs/`.

---

### Task 1: Normalize solo and stale conversations before movement

**Files:**
- Modify: `AGENTS.md`
- Modify: `src/work/officeScenePlan.js`
- Modify: `src/work/officeScenePlan.test.js`
- Modify: `src/work/officeSimulation.js`
- Modify: `src/work/officeSimulation.test.js`
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/useOfficeSimulation.test.js`

**Interfaces:**
- Consumes: `{ characters, conversation }` scene plans and current `occupants` entries shaped as `{ slotId, profile }`.
- Produces: `normalizeOfficeConversation(plan, occupants)` and an idempotent `allocateOfficeActivities(plan, occupants)` result that never contains orphaned `chatting` activities.

- [ ] **Step 1: Add failing shared-boundary tests for solo and stale chat plans**

Extend `src/work/officeScenePlan.test.js`:

```js
test("turns an orphaned chatting activity into work at the assigned workstation", () => {
  const plan = {
    id: "solo",
    characters: {
      c1: { activity: "chatting", label: "聊天中", destination: "social-center", startsAt: 10, endsAt: 20, priority: "scheduled" },
    },
    conversation: null,
  };
  const result = allocateOfficeActivities(plan, [{ slotId: "employee3", profile: { id: "c1" } }]);
  assert.deepEqual(result.characters.c1, {
    activity: "working", label: "工作中", destination: "employee3-home", startsAt: 10, endsAt: 20, priority: "scheduled",
  });
  assert.equal(result.conversation, null);
});

test("removes stale participants instead of moving one remaining person to chat alone", () => {
  const plan = {
    id: "stale",
    characters: {
      c1: { activity: "chatting", label: "聊天中", destination: "social-left", startsAt: 10, endsAt: 20 },
    },
    conversation: { id: "stale-chat", participantIds: ["missing", "c1", "c1"], turns: [], startsAt: 10, endsAt: 20 },
  };
  const result = allocateOfficeActivities(plan, [{ slotId: "boss", profile: { id: "c1" } }]);
  assert.equal(result.conversation, null);
  assert.deepEqual(result.characters.c1, { activity: "working", label: "工作中", destination: "boss-home", startsAt: 10, endsAt: 20 });
});

test("preserves a valid group and normalizes unrelated chatting characters", () => {
  const characters = Object.fromEntries(["c1", "c2", "c3"].map((id) => [id, {
    activity: "chatting", label: "聊天中", destination: "social-center", startsAt: 10, endsAt: 20,
  }]));
  const plan = { characters, conversation: { id: "group", participantIds: ["c1", "c2", "c2"], turns: [], startsAt: 10, endsAt: 20 } };
  const occupants = [
    { slotId: "boss", profile: { id: "c1" } },
    { slotId: "employee1", profile: { id: "c2" } },
    { slotId: "employee2", profile: { id: "c3" } },
  ];
  const result = allocateOfficeActivities(plan, occupants);
  assert.deepEqual(result.conversation.participantIds, ["c1", "c2"]);
  assert.equal(result.characters.c1.activity, "chatting");
  assert.equal(result.characters.c2.activity, "chatting");
  assert.deepEqual(result.characters.c3, { activity: "working", label: "工作中", destination: "employee2-home", startsAt: 10, endsAt: 20 });
});
```

- [ ] **Step 2: Add a failing local-generator regression test**

Extend `src/work/officeSimulation.test.js` with a deterministic search that finds a raw one-chatter case and asserts the public API never exposes it:

```js
test("never exposes a single locally scheduled chatter", () => {
  for (let index = 0; index < 500; index += 1) {
    const plan = createLocalOfficePlan({
      occupants,
      now: new Date("2026-07-27T04:30:00Z"),
      seed: `solo-chat-${index}`,
    });
    const chatting = Object.entries(plan.characters).filter(([, item]) => item.activity === "chatting");
    assert.notEqual(chatting.length, 1, `seed solo-chat-${index}`);
    if (chatting.length === 0) assert.equal(plan.conversation, null);
    if (chatting.length >= 2) assert.ok(plan.conversation?.participantIds.length >= 2);
  }
});
```

- [ ] **Step 3: Add failing restored-plan and manual-interruption tests**

In `src/work/useOfficeSimulation.test.js`, import `interruptMePlan` and `deriveCurrentSimulation`. Add:

```js
test("a restored stale chat is normalized before runtime movement", () => {
  const occupants = [{ slotId: "boss", profile: { id: "me:1" } }];
  const persistedPlan = {
    characters: { "me:1": { activity: "chatting", label: "聊天中", destination: "social-center" } },
    conversation: { id: "stale", participantIds: ["missing", "me:1"] },
  };
  const restored = deriveCurrentSimulation({
    persisted: { intervalKey: "same", plan: persistedPlan },
    intervalKey: "same",
    occupants,
    createPlan: () => assert.fail("matching interval should reuse the saved plan"),
  });
  const safe = allocateOfficeActivities(restored, occupants);
  assert.equal(safe.conversation, null);
  assert.equal(safe.characters["me:1"].activity, "working");
  assert.equal(safe.characters["me:1"].destination, "boss-home");
});

test("manual Me interruption cannot leave the other participant chatting alone", () => {
  const occupants = [
    { slotId: "boss", profile: { id: "me:1" } },
    { slotId: "employee1", profile: { id: "c1" } },
  ];
  const plan = {
    id: "group",
    characters: {
      "me:1": { activity: "chatting", label: "聊天中", destination: "boss-home" },
      c1: { activity: "chatting", label: "聊天中", destination: "employee1-home" },
    },
    conversation: { id: "chat", participantIds: ["me:1", "c1"] },
  };
  const interrupted = interruptMePlan(plan, "me:1", { destination: "print-station", now: 100 });
  const safe = allocateOfficeActivities(interrupted, occupants);
  assert.equal(safe.conversation, null);
  assert.equal(safe.characters.c1.activity, "working");
  assert.equal(safe.characters.c1.destination, "employee1-home");
});
```

- [ ] **Step 4: Run the focused tests and verify RED**

Run:

```bash
node --test src/work/officeScenePlan.test.js src/work/officeSimulation.test.js src/work/useOfficeSimulation.test.js
```

Expected: the boundary tests fail because orphaned chatting activities remain unchanged; the deterministic local test fails on a seed with exactly one chatter.

- [ ] **Step 5: Implement `normalizeOfficeConversation` at the shared boundary**

Add to `src/work/officeScenePlan.js`:

```js
export function normalizeOfficeConversation(plan, occupants = []) {
  const next = {
    ...plan,
    characters: Object.fromEntries(Object.entries(plan?.characters || {}).map(([id, item]) => [id, { ...item }])),
  };
  const assignedIds = new Set(occupants.map((occupant) => occupant.profile.id));
  const participantIds = getDistinctConversationIds(next.conversation?.participantIds || [], assignedIds);
  const hasConversation = Boolean(next.conversation) && participantIds.length >= 2;
  next.conversation = hasConversation ? { ...next.conversation, participantIds } : null;
  const activeChatters = new Set(hasConversation ? participantIds : []);
  for (const occupant of occupants) {
    const profileId = occupant.profile.id;
    const activity = next.characters[profileId];
    if (activity?.activity === "chatting" && !activeChatters.has(profileId)) {
      next.characters[profileId] = {
        ...activity,
        activity: "working",
        label: "工作中",
        destination: `${occupant.slotId}-home`,
      };
    }
  }
  return next;
}
```

Change `allocateOfficeActivities` to call `normalizeOfficeConversation(next, occupants)` after workstation and printer normalization, and return that normalized plan. Remove the old participant slicing branch because `getDistinctConversationIds` already deduplicates, validates, and caps at four.

- [ ] **Step 6: Make local generation return a normalized plan**

In `src/work/officeSimulation.js`, import `allocateOfficeActivities`. Build the current plan into `const plan`, then return:

```js
return allocateOfficeActivities(plan, occupants);
```

This converts a single locally selected chatter before the plan can be persisted, without changing the activity selection weights.

- [ ] **Step 7: Normalize reused and manually interrupted plans before movement**

In `src/work/useOfficeSimulation.js`, immediately after `deriveCurrentSimulation` assign:

```js
localPlan = allocateOfficeActivities(localPlan, occupants);
```

In `commandMe`, wrap the interrupted plan before dispatching or calling `setPlan`:

```js
const next = allocateOfficeActivities(
  interruptMePlan(plan, me.profile.id, { destination: target.destination, now: Date.now(), label: target.message || "前往指定位置" }),
  occupants,
);
```

The normalized conversation IDs are then the only IDs consumed by the existing gather-layout, guest-arrival, and bubble-ready logic.

- [ ] **Step 8: Record the durable rule in `AGENTS.md`**

Extend the autonomous-office section with:

```markdown
- A visible `chatting` activity must belong to a valid 2–4 person conversation. Orphaned, stale, or single-person chatting states normalize to `working` at that occupant's own workstation before any route or bubble is rendered.
```

- [ ] **Step 9: Run focused and full tests**

Run:

```bash
node --test src/work/officeScenePlan.test.js src/work/officeSimulation.test.js src/work/useOfficeSimulation.test.js src/work/officeConversationLayout.test.js
npm test
git diff --check
```

Expected: all focused tests pass, the full count exceeds the V0.3.23 baseline of 187, and there are no whitespace errors.

- [ ] **Step 10: Commit the planning-boundary fix**

```bash
git add AGENTS.md src/work/officeScenePlan.js src/work/officeScenePlan.test.js src/work/officeSimulation.js src/work/officeSimulation.test.js src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js
git commit -m "fix(work): prevent solo office chats"
```

---

### Task 2: Reproduce the opening-app regression in both mobile viewports

**Files:**
- Modify: `scripts/verify-work-office.mjs`
- Modify: `artifacts/work-office-qa/office-375x812.png`
- Modify: `artifacts/work-office-qa/office-390x844.png`

**Interfaces:**
- Consumes: persisted Work state under `ccatWorkOfficeV1` and the normalized scene plan from Task 1.
- Produces: browser evidence that a stale one-person chat opens as work at the assigned workstation, while the existing valid three-person gathering still works.

- [ ] **Step 1: Replace the final one-person fixture with an explicit stale solo-chat plan**

In the final `page.evaluate` block of `scripts/verify-work-office.mjs`, calculate the current China interval and persist:

```js
const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).formatToParts(new Date()).map(({ type, value }) => [type, value]));
const dateKey = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
const minutes = Number(dateParts.hour) * 60 + Number(dateParts.minute);
const intervalKey = `${dateKey}:${String(Math.floor(minutes / 15)).padStart(2, "0")}`;
const startsAt = Date.now();
const endsAt = startsAt + 120_000;
office.assignments = { boss: "me:qaMe", employee1: null, employee2: null, employee3: null, employee4: null, employee5: null, employee6: null };
office.simulation = {
  ...office.simulation,
  mode: "local",
  dateKey,
  intervalKey,
  plan: {
    id: `qa-stale-solo:${startsAt}`,
    modeUsed: "local",
    startsAt,
    endsAt,
    characters: {
      "me:qaMe": { activity: "chatting", label: "聊天中", destination: "social-center", startsAt, endsAt, priority: "scheduled" },
    },
    conversation: { id: `qa-stale-chat:${startsAt}`, participantIds: ["missing", "me:qaMe"], turns: [], startsAt, endsAt },
  },
  conversationCache: null,
  manualMe: null,
};
```

- [ ] **Step 2: Assert opening behavior before and after a movement window**

After reopening Work APP, read the one character's anchor and assert:

```js
const solo = page.locator('.office-character[data-profile-id="me:qaMe"]');
await solo.waitFor();
const beforeSolo = await readCharacterAnchor(solo);
assert.equal(await solo.getAttribute("data-activity"), "working");
assert.equal(await solo.locator(".office-character-activity").innerText(), "工作中");
assert.equal(await page.locator(".office-character-bubble").count(), 0);
await page.waitForTimeout(2500);
const afterSolo = await readCharacterAnchor(solo);
assert.ok(Math.abs(afterSolo.x - beforeSolo.x) <= 1 && Math.abs(afterSolo.y - beforeSolo.y) <= 1, "stale solo chatter stays at the boss workstation");
assert.equal(await page.locator(".office-character-bubble").count(), 0, "stale solo chat never displays a bubble");
await page.screenshot({ path: `artifacts/work-office-qa/office-${viewport.width}x${viewport.height}.png`, fullPage: true });
```

Keep the earlier valid three-person assertions that the host stays, guests approach, four unique lines play, and participants leave after dialogue.

- [ ] **Step 3: Run production build and browser QA**

Run:

```bash
npm run build
npm run verify:work
```

Expected: `Work office browser QA passed for 375x812 and 390x844`. Both screenshots show ordinary workstation activity rather than a lone person in the bottom social area.

- [ ] **Step 4: Inspect both generated screenshots**

Open:

```text
artifacts/work-office-qa/office-375x812.png
artifacts/work-office-qa/office-390x844.png
```

Confirm the only character is at the boss workstation with `工作中`, no bubble or lone figure appears in the bottom social area, no character is clipped, and the bottom navigation remains unobstructed.

- [ ] **Step 5: Commit browser regression coverage**

```bash
git add scripts/verify-work-office.mjs artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "test(work): verify opening never shows a solo chat"
```

---

### Task 3: Publish and verify V0.3.24

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Modify: `docs/.deploy-version`
- Modify: generated `docs/index.html` and `docs/assets/*`

**Interfaces:**
- Consumes: the unit-tested and browser-verified fix from Tasks 1–2.
- Produces: a synchronized and publicly verified `Ccat OS V0.3.24` GitHub Pages release.

- [ ] **Step 1: Update every release marker to `0.3.24`**

Update package versions, visible `Ccat OS V0.3.24`, launcher-test expectations, deploy marker, and both versioned worldbook atlas URLs. Do not edit historical design or plan documents that intentionally mention older releases.

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

Expected: version tests pass, all unit tests pass, both mobile viewport checks pass, production build succeeds, and `docs/` exactly matches `dist/`.

- [ ] **Step 3: Verify the generated bundle before commit**

Run:

```bash
rg -n "assets/index-.*\.(js|css)" docs/index.html
rg -o "Ccat OS V0\.3\.24|聊天中|工作中|participantIds|boss-home" docs/assets/index-*.js | sort -u
rg -o "hero-worldbook-atlas\.png\?v=0\.3\.24" docs/assets/index-*.css | sort -u
```

Expected: HTML references exactly one current JS and one current CSS bundle; the JS contains the release label and normalized chat/work markers; CSS contains the V0.3.24 atlas URL.

- [ ] **Step 4: Commit the release bundle**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs
git commit -m "chore(release): publish no-solo-chat fix 0.3.24"
```

- [ ] **Step 5: Merge, push, and verify GitHub Pages**

Fast-forward the feature branch into `main`, run `npm test` and the Pages synchronization contract on merged `main`, then push. Wait for the `Deploy GitHub Pages` workflow for the pushed commit to succeed.

Fetch `https://sy719427083-glitch.github.io/ai-roleplay-phone/?release=0.3.24` with cache-busting and assert that its HTML references the newly generated JS/CSS hashes. Fetch those live assets and verify `Ccat OS V0.3.24`, `聊天中`, `工作中`, all five workstation activity ids, and `hero-worldbook-atlas.png?v=0.3.24`. Confirm `git ls-remote origin refs/heads/main` equals local `HEAD`.

- [ ] **Step 6: Clean up only this feature worktree**

From the main repository root, remove `.worktrees/no-solo-chat`, prune worktree metadata, and delete the merged local `feature/no-solo-chat` branch. Preserve every unrelated worktree and all user-owned untracked assets.
