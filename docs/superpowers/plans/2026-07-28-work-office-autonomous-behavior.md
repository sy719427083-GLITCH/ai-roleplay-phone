# Work Office Autonomous Behavior Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time, persona-aware autonomous office simulation in which all assigned profiles move, work, socialize, print, rest, and entertain themselves with readable status labels and contextual speech bubbles.

**Architecture:** Pure modules derive deterministic time blocks, persona affinities, local scene plans, resource-safe assignments, and validated AI plans. A focused React hook executes the current plan, owns per-character routes and timers, and exposes resolved render state to the existing office scene; the existing geometry/pathfinding layer remains authoritative for collision safety. Versioned Work office state persists the selected mode and reconstruction inputs so reopening derives the current interval without replay or background API traffic.

**Tech Stack:** React 19, Vite 6, browser localStorage, OpenAI-compatible `/v1/chat/completions`, Node.js built-in test runner, Playwright.

## Global Constraints

- Preserve the selected Pastel Orbit Office layout, all seven slots, existing furniture geometry, and the approved same-column desk avoidance rule.
- Use China local time and a shared deterministic global timeline; do not run hidden API calls while the Work APP is closed.
- Mode `A` is the default and recommended local scheduler; it calls AI only when a conversation begins.
- Mode `B` requests bounded AI scene plans; invalid or unavailable B plans fall back to A without freezing the office.
- The assigned Me profile is autonomous, but a furniture click interrupts it immediately with the highest priority.
- Keep `摸鱼ing` and `刷抖音` as separate states and exact separate display labels.
- Show activity below each character; show one visually emphasized 2-4 person conversation group with short alternating bubbles above participants.
- The print station has capacity one; routes and activity points must avoid furniture and character overlap.
- Support `375x812` and `390x844`, long Chinese text, reduced motion, zero occupants, one occupant, and seven occupants.
- Bump the application patch version from `0.3.17` to `0.3.18` only in the final delivery task.

## File Structure

- Create `src/work/officeProfileContext.js`: normalize persona text and relationship records into scheduler affinities and prompt-safe context.
- Create `src/work/officeSimulation.js`: China-time periods, deterministic seeds, activity catalog, durations, and Mode A scene generation.
- Create `src/work/officeScenePlan.js`: activity-point capacities, group/resource validation, AI-plan sanitation, and fallback decisions.
- Create `src/work/officeConversation.js`: endpoint selection, contextual prompts, bounded JSON parsing, local fallback dialogue, and Mode B scene requests.
- Create `src/work/useOfficeSimulation.js`: React orchestration, plan refresh, all-character movement, timers, conversations, persistence dispatch, and manual Me interruption.
- Modify `src/work/officeGeometry.js`: add safe semantic activity and waiting points without changing furniture bounds.
- Modify `src/work/officeNavigation.js`: accept every registered activity destination.
- Modify `src/work/officeProfiles.js`: attach normalized relationship/persona context without mutating source profile records.
- Modify `src/work/officeState.js`: migrate to schema version 2 and persist mode, seed/interval, active scene, next transition, bounded dialogue cache, and manual state.
- Modify `src/work/WorkAppScreen.jsx`: connect settings, current projects, simulation hook, notices, and manual furniture commands.
- Modify `src/work/WorkSettings.jsx`: render the accessible A/B selector and preserve cache reset.
- Modify `src/work/OfficeScene.jsx`: render resolved per-character simulation nodes and the active conversation.
- Modify `src/work/OfficeCharacter.jsx`: render activity labels and speaker bubbles.
- Modify `src/work/office.css`: activity, bubble, gathering, settings-selector, motion, and responsive styles.
- Modify `src/work/workCache.js`: ensure the versioned simulation remains included in Work-only clearing.
- Modify `scripts/verify-work-office.mjs`: exercise the autonomous scene and settings at both approved mobile sizes.
- Modify `src/App.jsx`, `package.json`, and `package-lock.json`: publish `0.3.18` after all implementation checks pass.

---

### Task 1: Normalize Persona and Relationship Context

**Files:**
- Create: `src/work/officeProfileContext.js`
- Create: `src/work/officeProfileContext.test.js`
- Modify: `src/work/officeProfiles.js`
- Modify: `src/work/officeProfiles.test.js`

**Interfaces:**
- Consumes: raw `apiMeProfiles`, `apiCharacters`, and `apiRelations` records from localStorage.
- Produces: `deriveOfficeAffinities(profile): { focus: number, social: number, discipline: number, entertainment: number, night: number }`; `readOfficeRelations(storage): object`; `buildOfficeProfileContext(profile, relations): { affinities, identity, persona, relationshipSummary }`.

- [ ] **Step 1: Write failing affinity and immutability tests**

```js
test("derives bounded persona affinities without mutating the profile", () => {
  const profile = { name: "林序", identity: "财务主管", personality: "认真、自律、少言", persona: "习惯早起做报表" };
  const original = structuredClone(profile);
  const context = buildOfficeProfileContext(profile, {});
  assert.ok(context.affinities.focus > context.affinities.entertainment);
  assert.ok(Object.values(context.affinities).every((value) => value >= 0 && value <= 1));
  assert.deepEqual(profile, original);
});

test("summarizes known relationships for office prompts", () => {
  const relations = { c1: { c2: { label: "好友", description: "经常一起讨论设计" } } };
  assert.match(buildOfficeProfileContext({ sourceId: "c1" }, relations).relationshipSummary, /好友/);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test src/work/officeProfileContext.test.js src/work/officeProfiles.test.js`

Expected: FAIL because `officeProfileContext.js` and the exported helpers do not exist.

- [ ] **Step 3: Implement bounded trait extraction and relationship reading**

```js
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const score = (text, positive, negative = []) => clamp01(0.5 + positive.filter((word) => text.includes(word)).length * 0.12 - negative.filter((word) => text.includes(word)).length * 0.12);

export function deriveOfficeAffinities(profile = {}) {
  const text = [profile.identity, profile.role, profile.personality, profile.persona, profile.background].filter(Boolean).join(" ");
  return {
    focus: score(text, ["认真", "负责", "自律", "专注", "报表"], ["散漫"]),
    social: score(text, ["开朗", "健谈", "社交", "热情"], ["少言", "内向"]),
    discipline: score(text, ["守时", "自律", "严谨"], ["摸鱼", "随性"]),
    entertainment: score(text, ["游戏", "抖音", "娱乐", "爱玩"], ["严肃"]),
    night: score(text, ["夜猫", "熬夜", "晚睡"], ["早睡", "早起"]),
  };
}
```

Read invalid `apiRelations` JSON as `{}`. Build summaries only from names, labels, and descriptions present in stored relationship records; cap the final summary at 240 characters.

- [ ] **Step 4: Attach context during office profile normalization**

Update `readOfficeProfiles(storage)` to read relationships once, map each profile to a fresh object, and add `officeContext: buildOfficeProfileContext(profile, relations)`. Preserve existing `id`, `sourceId`, `source`, name, avatar, identity, personality, persona, and background fields.

- [ ] **Step 5: Run tests and commit**

Run: `node --test src/work/officeProfileContext.test.js src/work/officeProfiles.test.js`

Expected: PASS.

```bash
git add src/work/officeProfileContext.js src/work/officeProfileContext.test.js src/work/officeProfiles.js src/work/officeProfiles.test.js
git commit -m "feat(work): derive office behavior from personas"
```

### Task 2: Build the Deterministic Real-Time Timeline

**Files:**
- Create: `src/work/officeSimulation.js`
- Create: `src/work/officeSimulation.test.js`

**Interfaces:**
- Consumes: normalized occupants, China-local `Date`, project summary, daily seed, and previous plan.
- Produces: `getChinaOfficePeriod(date): string`; `createOfficeDailySeed(date, companyId): string`; `getOfficeIntervalKey(date): string`; `createLocalOfficePlan({ occupants, now, seed, projectContext, previousPlan }): OfficeScenePlan`.
- `OfficeScenePlan`: `{ id, modeUsed, startsAt, endsAt, characters: Record<profileId, PlannedActivity>, conversation: ConversationPlan|null }`.
- `PlannedActivity`: `{ activity, label, destination, startsAt, endsAt, priority, resourceId?, groupId? }`.

- [ ] **Step 1: Write failing clock, determinism, and label-separation tests**

```js
test("maps China workday periods and weekend rhythm", () => {
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T02:00:00Z")), "focus-am");
  assert.equal(getChinaOfficePeriod(new Date("2026-07-27T04:30:00Z")), "lunch");
  assert.equal(getChinaOfficePeriod(new Date("2026-08-01T02:00:00Z")), "weekend-day");
});

test("reconstructs the same interval from the same inputs", () => {
  const input = { occupants, now: new Date("2026-07-27T07:00:00Z"), seed: "company:2026-07-27", projectContext: "品牌改版" };
  assert.deepEqual(createLocalOfficePlan(input), createLocalOfficePlan(input));
});

test("keeps slacking and Douyin independent", () => {
  assert.equal(OFFICE_ACTIVITIES.slacking.label, "摸鱼ing");
  assert.equal(OFFICE_ACTIVITIES.scrolling.label, "刷抖音");
  assert.notEqual(OFFICE_ACTIVITIES.slacking.id, OFFICE_ACTIVITIES.scrolling.id);
});
```

- [ ] **Step 2: Run the timeline tests and verify failure**

Run: `node --test src/work/officeSimulation.test.js`

Expected: FAIL because the timeline exports are missing.

- [ ] **Step 3: Implement China-time period selection and seeded randomness**

Use `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", ... })` to derive weekday, date, hour, and minute. Use 15-minute interval keys and a string hash plus Mulberry32 generator so render frequency does not alter choices.

```js
export const OFFICE_ACTIVITIES = Object.freeze({
  working: { id: "working", label: "工作中", minMinutes: 12, maxMinutes: 35 },
  reporting: { id: "reporting", label: "做报表", minMinutes: 10, maxMinutes: 25 },
  printing: { id: "printing", label: "打印中", minMinutes: 3, maxMinutes: 8 },
  chatting: { id: "chatting", label: "聊天中", minMinutes: 4, maxMinutes: 10 },
  resting: { id: "resting", label: "休息中", minMinutes: 8, maxMinutes: 25 },
  gaming: { id: "gaming", label: "打游戏", minMinutes: 8, maxMinutes: 20 },
  scrolling: { id: "scrolling", label: "刷抖音", minMinutes: 6, maxMinutes: 18 },
  slacking: { id: "slacking", label: "摸鱼ing", minMinutes: 5, maxMinutes: 16 },
  offDuty: { id: "offDuty", label: "已下班", minMinutes: 30, maxMinutes: 120 },
});
```

- [ ] **Step 4: Implement weighted global scene generation**

Create period base weights for arrival, focus morning, lunch, focus afternoon, evening, overnight, and weekend. Multiply them by each profile's `officeContext.affinities`, apply a repetition penalty from `previousPlan`, reserve at most one tentative print user, and form at most one 2-4 person conversation when enough social candidates exist. Desk work destinations must be `${slotId}-home`; shared activities use semantic destination IDs defined in Task 3.

- [ ] **Step 5: Add boundary tests and commit**

Add tests for zero occupants, one occupant without conversation, seven occupants, overnight off-duty bias, weekend entertainment bias, activity durations, and variation across different interval seeds.

Run: `node --test src/work/officeSimulation.test.js`

Expected: PASS.

```bash
git add src/work/officeSimulation.js src/work/officeSimulation.test.js
git commit -m "feat(work): add deterministic office timeline"
```

### Task 3: Add Safe Activity Points and Scene Validation

**Files:**
- Create: `src/work/officeScenePlan.js`
- Create: `src/work/officeScenePlan.test.js`
- Modify: `src/work/officeGeometry.js`
- Modify: `src/work/officeGeometry.test.js`
- Modify: `src/work/officeNavigation.js`
- Modify: `src/work/officeNavigation.test.js`

**Interfaces:**
- Consumes: candidate `OfficeScenePlan`, active profile IDs, geometry point registry, and mode.
- Produces: `OFFICE_ACTIVITY_POINTS`; `validateOfficeScenePlan(plan, context): { valid: boolean, plan, issues: string[] }`; `allocateOfficeActivities(plan, occupants): OfficeScenePlan`.
- Point metadata: `{ id, point: { x, y }, capacity, activities: string[] }`.

- [ ] **Step 1: Write failing geometry, capacity, and invalid-plan tests**

```js
test("registers safe social, rest, entertainment, print queue, and exit points", () => {
  for (const id of ["social-left", "social-center", "social-right", "rest-left", "rest-right", "play-left", "play-right", "print-wait", "off-duty"]) {
    assert.ok(getOfficePoint(id), id);
  }
});

test("allows only one active printer user", () => {
  const result = allocateOfficeActivities(planWithTwoPrinters, occupants);
  assert.equal(Object.values(result.characters).filter((item) => item.destination === "print-station").length, 1);
});

test("rejects unknown profiles and unsafe destinations from AI plans", () => {
  const result = validateOfficeScenePlan(unsafePlan, { profileIds: new Set(["character:c1"]), now: 1_000 });
  assert.equal(result.valid, false);
  assert.match(result.issues.join(" "), /profile|destination/);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test src/work/officeScenePlan.test.js src/work/officeGeometry.test.js src/work/officeNavigation.test.js`

Expected: FAIL because shared points and validators do not exist.

- [ ] **Step 3: Register semantic points and route every point**

Add immutable point definitions to `officeGeometry.js` and expose them through `getOfficePoint`. Choose positions only in currently open floor pockets and verify each at both target viewports using `getOfficeGeometry(viewport).obstacles`. Update `createOfficeRoute` to continue resolving all destinations through `getOfficePoint` without special-casing AI output.

- [ ] **Step 4: Implement plan normalization and capacity allocation**

```js
const VALID_ACTIVITIES = new Set(["working", "reporting", "printing", "chatting", "resting", "gaming", "scrolling", "slacking", "offDuty"]);

export function validateOfficeScenePlan(plan, { profileIds, now }) {
  const issues = [];
  if (!plan || typeof plan !== "object") issues.push("plan");
  for (const [profileId, activity] of Object.entries(plan?.characters || {})) {
    if (!profileIds.has(profileId)) issues.push(`profile:${profileId}`);
    if (!VALID_ACTIVITIES.has(activity?.activity)) issues.push(`activity:${profileId}`);
    if (!getOfficePoint(activity?.destination)) issues.push(`destination:${profileId}`);
    if (!(activity?.endsAt > Math.max(now, activity?.startsAt || 0))) issues.push(`time:${profileId}`);
  }
  return { valid: issues.length === 0, plan, issues };
}
```

Allocation enforces point capacity, printer exclusivity, group sizes of 2-4, a single emphasized conversation, and deterministic alternate destinations. Profiles that cannot receive a safe point fall back to their assigned desk or `off-duty` point.

- [ ] **Step 5: Prove every point and representative route is collision-safe**

For `375x812` and `390x844`, assert every activity point lies outside inflated furniture rectangles. Generate routes from all seven home points to every shared point and assert each simplified segment remains collision-free. Preserve the existing purple-to-green and yellow-to-orange same-column regression cases.

- [ ] **Step 6: Run tests and commit**

Run: `node --test src/work/officeScenePlan.test.js src/work/officeGeometry.test.js src/work/officeNavigation.test.js src/work/officePathfinding.test.js`

Expected: PASS.

```bash
git add src/work/officeScenePlan.js src/work/officeScenePlan.test.js src/work/officeGeometry.js src/work/officeGeometry.test.js src/work/officeNavigation.js src/work/officeNavigation.test.js
git commit -m "feat(work): add safe office activity points"
```

### Task 4: Generate Contextual Conversations and Mode B Plans

**Files:**
- Create: `src/work/officeConversation.js`
- Create: `src/work/officeConversation.test.js`

**Interfaces:**
- Consumes: selected API configuration, participants, time/period, project context, relationship summaries, and candidate B-plan context.
- Produces: `createLocalConversation(context): ConversationPlan`; `parseOfficeConversation(content, participants): ConversationPlan`; `generateOfficeConversation({ apiState, context, fetchImpl }): Promise<ConversationPlan>`; `parseAiOfficePlan(content, context): OfficeScenePlan`; `generateAiOfficePlan({ apiState, context, fetchImpl }): Promise<OfficeScenePlan>`.
- `ConversationPlan`: `{ id, participantIds: string[], turns: Array<{ speakerId, text }>, startsAt, endsAt }` with 2-4 participants and 1-3 rounds.

- [ ] **Step 1: Write failing parser, endpoint, and fallback tests**

```js
test("parses only bounded turns from known participants", () => {
  const plan = parseOfficeConversation(JSON.stringify({ turns: [
    { speakerId: "character:c1", text: "这份报表我核完了。" },
    { speakerId: "character:c2", text: "我再看一下趋势图。" },
    { speakerId: "unknown", text: "不应出现" },
  ] }), participants);
  assert.deepEqual(plan.turns.map((turn) => turn.speakerId), ["character:c1", "character:c2"]);
});

test("local fallback uses persona and project context", () => {
  const plan = createLocalConversation({ participants, projectContext: "品牌改版", now: 1_000 });
  assert.ok(plan.turns.length >= 2 && plan.turns.length <= 6);
  assert.match(plan.turns.map((turn) => turn.text).join(" "), /品牌改版|进度|方案/);
});

test("rejects an AI scene that reserves one printer twice", () => {
  assert.throws(() => parseAiOfficePlan(doublePrinterJson, context), /scene plan/i);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test src/work/officeConversation.test.js`

Expected: FAIL because the conversation service is missing.

- [ ] **Step 3: Implement shared OpenAI-compatible endpoint failover**

Use `selectWorkProjectEndpoints(apiState)` for secondary-then-main selection. POST to the normalized `/v1/chat/completions` URL with `Authorization: Bearer ...`, the saved model, bounded temperature, and `AbortSignal.timeout(12_000)`. Try each usable endpoint once and throw a concise final error after all fail.

- [ ] **Step 4: Implement strict prompts, JSON parsing, and local dialogue**

The conversation system prompt requires JSON only, known `speakerId` values, one short natural Chinese line per turn, no narration, and persona/relationship/time/project consistency. Strip Markdown fences, cap each line at 42 Chinese characters, remove empty/unknown turns, and cap output to six turns. The local generator chooses persona-aware line templates based on work, report, social, rest, and entertainment context and always returns readable content when AI fails.

- [ ] **Step 5: Implement Mode B bounded scene requests**

Send only current assigned profile IDs and prompt-safe persona summaries, valid activity IDs, valid destination IDs, current interval boundaries, capacities, and project summary. Parse JSON, pass it through `validateOfficeScenePlan`, and reject the response when validation cannot produce a coherent safe plan. Coordinates, animation durations, routing, persistence, and manual control remain local.

- [ ] **Step 6: Test failed HTTP, malformed JSON, unknown IDs, sanitization, and failover**

Use injected `fetchImpl` stubs to assert request shape, secondary-to-main failover, timeout/error propagation, fenced JSON parsing, excessive turns, long Chinese text truncation, and local conversation fallback.

Run: `node --test src/work/officeConversation.test.js src/work/workProjectApi.test.js`

Expected: PASS.

```bash
git add src/work/officeConversation.js src/work/officeConversation.test.js
git commit -m "feat(work): add contextual office conversations"
```

### Task 5: Persist Simulation State and Add Mode Settings

**Files:**
- Modify: `src/work/officeState.js`
- Modify: `src/work/officeState.test.js`
- Modify: `src/work/WorkSettings.jsx`
- Modify: `src/work/WorkSettings.test.js`
- Modify: `src/work/workCache.js`
- Modify: `src/work/workCache.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: existing version 1 office JSON and simulation updates.
- Produces: office schema version 2 with `simulation: { mode, dateKey, seed, intervalKey, plan, nextTransitionAt, conversationCache, manualMe }`; reducer actions `SET_SIMULATION_MODE`, `SET_SCENE_PLAN`, `CACHE_CONVERSATION`, `START_MANUAL_ME`, `END_MANUAL_ME`.
- `WorkSettings` receives `{ simulationMode, onSimulationModeChange, onBack, onCleared }`.

- [ ] **Step 1: Write failing migration and settings tests**

```js
test("migrates version one office state to local scheduling", () => {
  const state = restoreOfficeState(JSON.stringify({ version: 1, assignments: {}, meWaypoint: "boss-home" }), profiles);
  assert.equal(state.version, 2);
  assert.equal(state.simulation.mode, "local");
  assert.equal(state.simulation.plan, null);
});

test("persists only bounded conversation turns", () => {
  const next = officeReducer(createOfficeState(profiles), { type: "CACHE_CONVERSATION", conversation: oversizedConversation });
  assert.ok(next.simulation.conversationCache.turns.length <= 6);
});
```

Extend source tests to require `自主行为模式`, `A 本地调度（推荐）`, `B AI 导演`, radiogroup semantics, and 44px minimum mode-control height.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test src/work/officeState.test.js src/work/WorkSettings.test.js src/work/workCache.test.js`

Expected: FAIL on version, missing simulation fields, and missing mode controls.

- [ ] **Step 3: Implement safe version 2 restoration and reducer actions**

```js
const createSimulationState = () => ({
  mode: "local",
  dateKey: "",
  seed: "",
  intervalKey: "",
  plan: null,
  nextTransitionAt: 0,
  conversationCache: null,
  manualMe: null,
});
```

Accept only modes `local` and `ai`. Sanitize plans through the scene validator using restored assignments, cap cached turns at six and text at 42 characters, discard expired manual state, and keep invalid JSON recovery behavior. Never place API configuration or raw model responses in office state.

- [ ] **Step 4: Build the accessible A/B selector**

Render a separate settings section with `role="radiogroup"` and two `button role="radio"` controls. Use `aria-checked`, visible selected treatment, concise descriptions, and `onSimulationModeChange("local"|"ai")`. Keep storage reset intact and explain that B falls back to A when AI is unavailable.

- [ ] **Step 5: Verify Work-only cache clearing and commit**

Keep the existing `OFFICE_STORAGE_KEY` in `WORK_CACHE_STORAGE_KEYS`; assert one removal clears assignments and the embedded simulation state without touching `ccat-ai-api-configs` or `apiCharacters`.

Run: `node --test src/work/officeState.test.js src/work/WorkSettings.test.js src/work/workCache.test.js`

Expected: PASS.

```bash
git add src/work/officeState.js src/work/officeState.test.js src/work/WorkSettings.jsx src/work/WorkSettings.test.js src/work/workCache.js src/work/workCache.test.js src/work/office.css
git commit -m "feat(work): persist autonomous behavior settings"
```

### Task 6: Execute Plans, Move Every Character, and Interrupt Me

**Files:**
- Create: `src/work/useOfficeSimulation.js`
- Create: `src/work/useOfficeSimulation.test.js`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: `{ occupants, officeState, dispatch, projectState, sceneRef, now, showNotice }`.
- Produces: `{ characterStates, activeConversation, commandMe, replanNow }` where each render state contains `{ node, moving, facing, durationMs, activity, label, bubble }`.
- `commandMe(target)` cancels Me's autonomous reservation/group, runs the manual collision-safe route, persists `manualMe`, then rejoins the next global interval.

- [ ] **Step 1: Write failing controller tests using fake timers and injected planners**

```js
test("reopens directly in the current interval without replaying missed plans", () => {
  const result = deriveCurrentSimulation({ persisted: oldState, now: currentTime, occupants, createPlan });
  assert.equal(result.intervalKey, getOfficeIntervalKey(currentTime));
  assert.equal(createPlan.mock.calls.length, 1);
});

test("manual Me commands release autonomous chat and printer reservations", () => {
  const next = interruptMePlan(activePlan, "me:m1", { destination: "print-station", now: 2_000 });
  assert.equal(next.conversation?.participantIds.includes("me:m1"), false);
  assert.equal(next.characters["me:m1"].priority, "manual");
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test src/work/useOfficeSimulation.test.js src/work/workScreen.test.js`

Expected: FAIL because the simulation controller and integration are missing.

- [ ] **Step 3: Implement pure catch-up and interruption helpers**

`deriveCurrentSimulation` restores only when date, interval, profiles, assignments, destinations, and timing remain valid; otherwise it derives exactly one current plan. `interruptMePlan` removes Me from conversations/resources, applies manual priority, and does not alter Character or NPC activities.

- [ ] **Step 4: Implement the React orchestration hook**

Maintain a timer map keyed by profile ID and a monotonically increasing run ID per character. For every activity transition, request a collision-safe route using current rendered node, destination, and measured scene viewport; advance the returned segments using their exact `durationMs`. Resolve simultaneous arrivals with the capacity allocator before movement begins.

At each plan boundary, generate Mode A synchronously. In Mode B, show the valid prior/local plan while requesting one bounded AI plan; validate before applying it. On missing config, network failure, timeout, or invalid output, apply Mode A, call `showNotice("AI 导演暂不可用，已使用本地调度")`, and retry no more than once in the next eligible interval.

Only call `generateOfficeConversation` when a conversation becomes active and the Work APP is mounted. Cache normalized turns for the current interval, advance one bubble every 5-8 seconds, and fall back locally on failure.

- [ ] **Step 5: Replace the single-Me movement block in WorkAppScreen**

Pass the current project name/status as prompt-safe `projectContext`, pass mode and mode-change callbacks into `WorkSettings`, and pass hook output into `OfficeScene`. Replace the current `moveMe` timer with `commandMe`, preserving existing no-Me, no-route, arrival-message, and reward behavior.

- [ ] **Step 6: Test cleanup, reassignment, fallback, and commit**

Assert all timers and abort controllers clear on unmount; assignment changes discard removed profiles; zero occupants create no API request; a one-person scene creates no conversation; manual commands supersede an active route; mode changes replan immediately; closed/unmounted state triggers no request.

Run: `node --test src/work/useOfficeSimulation.test.js src/work/workScreen.test.js src/work/officeState.test.js`

Expected: PASS.

```bash
git add src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js src/work/WorkAppScreen.jsx src/work/workScreen.test.js
git commit -m "feat(work): run autonomous office scenes"
```

### Task 7: Render Activities and Conversation Bubbles

**Files:**
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/OfficeCharacter.jsx`
- Modify: `src/work/office.css`
- Modify: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: `characterStates` keyed by profile ID and `activeConversation` from Task 6.
- Produces: accessible character activity labels and one active speaker bubble without behavior decisions in render components.

- [ ] **Step 1: Write failing source-level rendering and CSS tests**

```js
test("characters render activity below the avatar and bubbles above it", () => {
  const source = readFileSync("src/work/OfficeCharacter.jsx", "utf8");
  assert.match(source, /office-character-bubble/);
  assert.match(source, /office-character-activity/);
  assert.match(source, /role="status"/);
});

test("mobile labels and bubbles are bounded and reduced-motion safe", () => {
  assert.match(styles, /\.office-character-bubble\s*\{[^}]*max-width:/s);
  assert.match(styles, /\.office-character-activity\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.office-character/s);
});
```

- [ ] **Step 2: Run rendering tests and verify failure**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL because activity and bubble markup/styles are absent.

- [ ] **Step 3: Render resolved simulation state**

Update `OfficeScene` to look up each occupant's resolved render state, falling back to its home point and `工作中` only while state initializes. Pass `activity`, `label`, and `bubble` to `OfficeCharacter`. Preserve the empty-office message and semantic furniture buttons.

In `OfficeCharacter`, render the name above the body, the active speaker bubble above the name, and activity below the body. Set `data-activity` for restrained activity-specific CSS and use `aria-live="polite"` only on the active bubble container to avoid repeated screen-reader announcements.

- [ ] **Step 4: Add restrained mobile visual states**

Use a small white/translucent pill for activity text, maximum one line with ellipsis, and a two-line white speech bubble with a pointer and quiet shadow. Add subtle separate animations for working, resting, gaming, and phone use; do not merge their displayed text. Raise or horizontally shift a bubble only through bounded CSS classes computed from scene quadrant so it stays clear of edges, top controls, and bottom navigation.

- [ ] **Step 5: Add reduced-motion and responsive assertions**

Disable bobbing and decorative activity animations under `prefers-reduced-motion: reduce`; retain instantaneous state updates and readable labels. Verify CSS has explicit max widths, line clamping, `pointer-events: none`, and scene-edge constraints for both approved phone sizes.

- [ ] **Step 6: Run tests and commit**

Run: `node --test src/work/workScreen.test.js src/work/officeArtwork.test.js`

Expected: PASS.

```bash
git add src/work/OfficeScene.jsx src/work/OfficeCharacter.jsx src/work/office.css src/work/workScreen.test.js
git commit -m "feat(work): show office activities and dialogue"
```

### Task 8: Extend Automated Mobile Browser QA

**Files:**
- Modify: `scripts/verify-work-office.mjs`
- Modify: `src/work/WorkSettings.test.js`
- Modify: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: built Vite app plus deterministic localStorage fixtures.
- Produces: reproducible screenshots and runtime assertions for both approved mobile viewports.

- [ ] **Step 1: Add deterministic seven-person QA fixtures**

Before page load, seed one Me profile, six Character/NPC profiles with distinct personalities, all seven assignments, a fixed local-mode interval seed, company data, a current project, and relationships. Freeze browser time separately for a workday focus period, lunch, and evening case so screenshots do not depend on wall-clock timing.

- [ ] **Step 2: Add visible behavior and collision assertions**

At `375x812` and `390x844`, wait for seven `.office-character` nodes and seven nonempty `.office-character-activity` labels. Assert exact independent labels when their deterministic fixtures select `摸鱼ing` and `刷抖音`. Sample rendered character/furniture rectangles during movement and fail on furniture intersection or same-point character overlap.

- [ ] **Step 3: Exercise conversations, printing, and manual Me interruption**

Inject a deterministic conversation cache, assert only one visible bubble and a known participant line, then advance browser time to the next turn. Verify only one profile occupies `print-station` while a second uses `print-wait`. Click a distant desk during Me's autonomous activity and assert Me's destination changes immediately without moving the clicked desk's assigned Character/NPC.

- [ ] **Step 4: Exercise settings, fallback, edge cases, and reduced motion**

Open Work Settings, choose B, return to the office with no usable API config, and assert the fallback notice plus continuing local activity. Repeat with one occupant and zero occupants; assert no bubbles for one and the existing empty-office copy for zero. Run one viewport with `reducedMotion: "reduce"` and confirm readable final positions without decorative animation dependency.

- [ ] **Step 5: Run focused, full, build, and browser verification**

Run:

```bash
node --test src/work/*.test.js
npm test
npm run build
npm run verify:work
```

Expected: all Node tests pass, Vite production build succeeds, and browser QA reports success for `375x812` and `390x844` with screenshots under `artifacts/work-office-qa/`.

- [ ] **Step 6: Commit QA coverage**

```bash
git add scripts/verify-work-office.mjs src/work/WorkSettings.test.js src/work/workScreen.test.js
git commit -m "test(work): verify autonomous office behavior"
```

### Task 9: Version, Deploy, and Verify the Live Release

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Generated by deploy command: `docs/index.html`, `docs/assets/*`

**Interfaces:**
- Consumes: fully verified implementation from Tasks 1-8.
- Produces: GitHub Pages release `0.3.18` at the configured live URL.

- [ ] **Step 1: Re-run the complete pre-release gate**

Run:

```bash
npm test
npm run build
npm run verify:work
git diff --check
```

Expected: every command succeeds before any version file changes.

- [ ] **Step 2: Update the patch version consistently**

Set `package.json` and `package-lock.json` to `0.3.18`. Replace the visible settings label in `src/App.jsx` with `Ccat OS V0.3.18`. Search for stale release strings:

Run: `rg -n '0\.3\.17|V0\.3\.17' package.json package-lock.json src docs/superpowers`

Expected: matches remain only in historical design/plan documentation that intentionally describes the previous release.

- [ ] **Step 3: Build and synchronize the Pages artifact**

Run: `npm run deploy:pages`

Expected: Vite build succeeds and `docs/index.html` references newly generated hashed assets containing `Ccat OS V0.3.18`.

- [ ] **Step 4: Run the release gate against synchronized output**

Run:

```bash
npm test
npm run verify:work
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: tests and browser QA pass, the Pages contract reports synchronized output, and no whitespace errors exist.

- [ ] **Step 5: Commit implementation release files without user artifacts**

Review `git status --short`; exclude pre-existing untracked files under `artifacts/` and `designs/` unless the QA script intentionally created a tracked fixture.

```bash
git add package.json package-lock.json src/App.jsx docs/index.html docs/assets
git commit -m "chore(release): publish autonomous office 0.3.18"
```

- [ ] **Step 6: Push and verify automatic deployment**

Run: `git push origin main`

Wait for the configured GitHub Pages workflow to finish. Open `https://sy719427083-glitch.github.io/ai-roleplay-phone/?release=0.3.18`, confirm the HTML references the new hashed bundle, confirm the visible version is `Ccat OS V0.3.18`, assign/restore all seven occupants, and verify status labels, conversation bubbles, printing capacity, A/B settings, and manual Me interruption on the live site.

- [ ] **Step 7: Record final evidence**

Report the final commit SHA, test count, successful production build, both mobile QA viewports, Pages workflow result, live version string, and live URL. Keep existing untracked user design artifacts untouched.

## Self-Review Results

- Spec coverage: all approved time blocks, weekend behavior, persona weighting, relationships, A/B modes, fallback, no-background-API catch-up, all-character movement, Me interruption, separate labels, conversations, capacity, persistence, edge cases, accessibility, mobile QA, and deployment are assigned to Tasks 1-9.
- Placeholder scan: every implementation and verification step contains concrete commands, signatures, expected results, and bounded behavior.
- Type consistency: `OfficeScenePlan`, `PlannedActivity`, `ConversationPlan`, activity IDs, mode values (`local`, `ai`), destination IDs, hook output, reducer actions, and settings props use the same names across tasks.
