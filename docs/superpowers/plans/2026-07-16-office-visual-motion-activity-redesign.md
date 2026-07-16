# Office Visual, Motion, and Activity Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing office art and stepped movement with a soft-white premium office, 16 new animated chibi sets, profile-driven activities and dialogue, and a current-session activity timeline that always matches visible behavior.

**Architecture:** Keep the existing reducer, scheduler, navigation graph, and conversation-session boundaries, then add a pure activity-event model and a dedicated activity-detail API adapter. Render routes by sampling continuous linear progress on animation frames, map every character to a fixed 8x8 sprite atlas contract, and keep React components focused on assignment flow, scene rendering, and the activity bottom sheet.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Node test runner, CSS, Lucide React, Playwright, browser `localStorage`, OpenAI-compatible `/chat/completions`, generated WebP bitmap assets.

## Global Constraints

- The boss profile source is `apiMeProfiles` from the Me app.
- Employee profile choices include both main characters and NPCs from `apiCharacters`.
- Missing or deleted profiles render a named `NPC` fallback and cannot leave empty slots.
- Keep the existing boss-top and employee 2x2 office coordinates, route nodes, and anchors.
- Move top UI below `--app-safe-top-clearance` without moving or resizing the office scene coordinate frame.
- Replace all 16 built-in chibi sets: four female bosses, four male bosses, four female employees, and four male employees.
- Use the approved low-saturation premium Japanese game chibi direction.
- Use a white-dominant office background with dusty rose gray accents; green cannot be a dominant color.
- Walking uses eight right, eight front, and eight back frames; left mirrors right.
- Work, slack, eat, game, read, series, short-video, and chat actions each use at least three purpose-built character frames and distinct props.
- Activity animation, status, props, API detail, and timeline entries share one authoritative event.
- Multiple conversation groups keep separate participants, prompts, transcripts, requests, and bubble queues.
- Speech bubbles show complete content; long unbroken digits wrap inside the viewport.
- Do not add a runtime dependency for state management, routing, animation, or API access.
- Leave unrelated user changes and the main checkout's `artifacts/` and `designs/` directories untouched.
- Update version `0.2.95` to `0.2.96` and deploy the verified result to `https://sy719427083-glitch.github.io/ai-roleplay-phone/`.

## File Map

- Modify `src/work/officeProfiles.js`: split Me-app boss profiles from Character-app employee profiles and normalize profile snapshots.
- Modify `src/work/officeProfiles.test.js`: source separation, main/NPC employee inclusion, snapshots, and fallback coverage.
- Create `src/work/officeActivities.js`: activity definitions, event creation, detail merge, fallback detail, filtering, and sorting.
- Create `src/work/officeActivities.test.js`: event identity, activity schema, fallback, stale merge, and timeline filtering tests.
- Modify `src/work/officeState.js`: persist activity events and active-event ownership with legal event transitions.
- Modify `src/work/officeState.test.js`: event lifecycle, persistence, and stale-response tests.
- Modify `src/work/officeScheduler.js`: add read, series, and short-video scheduling and personality weights.
- Modify `src/work/officeScheduler.test.js`: deterministic new-activity selection and reachability tests.
- Create `src/work/officeActivityApi.js`: activity prompt construction, strict response validation, request execution, and local fallback.
- Create `src/work/officeActivityApi.test.js`: profile prompt, response matching, API failure, and activity-detail tests.
- Create `src/work/officeMotion.js`: route distance calculation, frame-synchronized route sampling, facing, and walk-frame selection.
- Create `src/work/officeMotion.test.js`: continuity, constant speed, waypoint crossing, completion, and direction tests.
- Modify `src/work/officeAssets.js`: 8x8 atlas manifest and directional/activity frame map.
- Modify `src/work/officeAssets.test.js`: 16 WebP atlases, exact grid mapping, and file existence tests.
- Replace `public/work-office-assets/chibi/*`: 16 new transparent 8x8 WebP atlases.
- Replace `public/work-office-assets/office-bg.png` with `public/work-office-assets/office-bg.webp`: white and dusty-rose-gray office background without people or UI.
- Modify `src/work/OfficeCharacter.jsx`: continuous position input, directional frames, new activity props, status, and full speech bubbles.
- Modify `src/work/OfficeScene.jsx`: new background, motion sampling, activity props, and unchanged scene coordinates.
- Modify `src/work/office.css`: safe-area overlay, new atlas sizing, concrete action loops, bubble wrapping, assignment flow, and activity sheet.
- Create `src/work/OfficeAssignmentFlow.jsx`: assignment overview and dedicated role/chibi selection view with explicit back navigation.
- Create `src/work/OfficeActivityPanel.jsx`: current-session filters and timeline rendering.
- Modify `src/work/WorkAppScreen.jsx`: animation clock, event/API lifecycle, new panels, three-dot button, storage refresh, and removal of route-step timers.
- Modify `src/work/WorkAppScreen.test.js`: source wiring, safe-area controls, assignment flow, event runtime, and panel assertions.
- Modify `scripts/verify-office.mjs`: mobile geometry, smooth movement, action props, bubble wrapping, panel, asset, console, and network checks.
- Modify `package.json`, `package-lock.json`, `src/App.jsx`, and `src/styles.css`: version `0.2.96` and versioned asset references.
- Refresh `docs/` through `npm run deploy:pages`; do not edit generated bundles manually.

---

### Task 1: Correct Profile Sources And Snapshots

**Files:**
- Modify: `src/work/officeProfiles.js`
- Modify: `src/work/officeProfiles.test.js`

**Interfaces:**
- Consumes: `apiMeProfiles`, `apiCharacters`, and `apiRelations` storage objects.
- Produces: `readOfficeProfiles(storage)`, `normalizeOfficeAssignments(value, profiles)`, `createOfficeProfileSnapshot(profile, source)`, `createNpcProfile(slotId, kind)`.

- [ ] **Step 1: Replace the old source-separation test with failing Me/Character source tests**

```js
test("uses Me profiles for bosses and all Character profiles for employees", () => {
  const result = readOfficeProfiles(storage({
    apiMeProfiles: JSON.stringify({ me1: { name: "沈知白", personality: "克制", persona: "投资人" } }),
    apiCharacters: JSON.stringify({
      main1: { type: "main", name: "程砚", personality: "自律" },
      npc1: { type: "npc", name: "林夏", personality: "外向" },
    }),
    apiRelations: JSON.stringify({ r1: { charA: "main1", charB: "npc1", type: "同事" } }),
  }));

  assert.deepEqual(result.bossOptions.map(({ id }) => id), ["me1"]);
  assert.deepEqual(result.employeeOptions.map(({ id }) => id), ["main1", "npc1"]);
  assert.equal(result.bossOptions[0].source, "me");
  assert.equal(result.employeeOptions[0].source, "character");
  assert.equal(result.relations.r1.type, "同事");
});

test("snapshots preserve source-specific role fields", () => {
  assert.deepEqual(createOfficeProfileSnapshot({
    id: "main1", type: "main", name: "程砚", identity: "律师", worldview: "近未来",
    appearance: "黑发", personality: "自律", persona: "背景", avatar: "a.png",
  }, "character"), {
    id: "main1", source: "character", type: "main", name: "程砚", identity: "律师",
    worldview: "近未来", appearance: "黑发", personality: "自律", persona: "背景", avatar: "a.png",
  });
});
```

- [ ] **Step 2: Run the focused tests and verify the old behavior fails**

Run: `node --test src/work/officeProfiles.test.js`

Expected: FAIL because the boss still comes from `apiCharacters`, main characters are excluded from employees, and `createOfficeProfileSnapshot` is not exported.

- [ ] **Step 3: Implement source-specific normalization**

```js
export const createOfficeProfileSnapshot = (profile = {}, source = "character") => ({
  id: String(profile.id || ""),
  source,
  ...(source === "character" ? { type: String(profile.type || "npc") } : {}),
  name: String(profile.name || "NPC"),
  identity: String(profile.identity || profile.role || "角色"),
  ...(source === "character" ? { worldview: String(profile.worldview || "") } : {}),
  appearance: String(profile.appearance || ""),
  personality: String(profile.personality || "自然"),
  persona: String(profile.persona || ""),
  avatar: String(profile.avatar || ""),
});

export function readOfficeProfiles(storage = defaultStorage) {
  const meProfiles = readObject(storage, "apiMeProfiles");
  const characters = readObject(storage, "apiCharacters");
  return {
    bossOptions: Object.entries(meProfiles).map(([id, value]) => (
      createOfficeProfileSnapshot({ ...value, id }, "me")
    )),
    employeeOptions: Object.entries(characters).map(([id, value]) => (
      createOfficeProfileSnapshot({ ...value, id }, "character")
    )),
    relations: readObject(storage, "apiRelations"),
  };
}
```

Update `createNpcProfile` to include `source: "fallback"`, `appearance: ""`, `avatar: ""`, and a stable personality/persona. Keep `normalizeOfficeAssignments` source-specific maps so a Me profile cannot be assigned to an employee and a Character profile cannot be assigned to the boss.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/work/officeProfiles.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeProfiles.js src/work/officeProfiles.test.js
git commit -m "fix: source office roles from their owning apps"
```

### Task 2: Add The Authoritative Activity Event Model

**Files:**
- Create: `src/work/officeActivities.js`
- Create: `src/work/officeActivities.test.js`
- Modify: `src/work/officeState.js`
- Modify: `src/work/officeState.test.js`

**Interfaces:**
- Consumes: profile snapshots from Task 1.
- Produces: `OFFICE_ACTIVITY_TYPES`, `ACTIVITY_DEFINITIONS`, `createOfficeActivityEvent(input)`, `mergeOfficeActivityDetail(event, detail)`, `createLocalActivityDetail(event)`, `filterOfficeActivityEvents(events, filters)`, and reducer actions `CREATE_ACTIVITY_EVENT`, `ENRICH_ACTIVITY_EVENT`, `COMPLETE_ACTIVITY_EVENT`.

- [ ] **Step 1: Write failing event identity and detail tests**

```js
test("creates one event shared by animation status props and API detail", () => {
  const event = createOfficeActivityEvent({
    eventId: "evt-1", workSessionId: "work-1", actorId: "employee1",
    participantIds: ["employee1"], profileSnapshots: [{ id: "c1", personality: "自律" }],
    activityType: "reading", propVariant: "paperback", startedAt: 1000, requestSequence: 1,
  });
  assert.equal(event.activityType, "reading");
  assert.equal(event.status, "看书中");
  assert.equal(event.propVariant, "paperback");
  assert.equal(event.detailStatus, "pending");
});

test("rejects stale detail without changing the event", () => {
  const event = createOfficeActivityEvent({
    eventId: "evt-1", workSessionId: "work-1", actorId: "employee1",
    activityType: "reading", startedAt: 1000, requestSequence: 3,
  });
  assert.strictEqual(mergeOfficeActivityDetail(event, {
    eventId: "evt-1", activityType: "reading", requestSequence: 2,
    title: "旧响应", subject: "旧书", summary: "旧", insightOrResult: "旧",
  }), event);
});

test("filters the newest current-session events", () => {
  const events = [
    { eventId: "a", workSessionId: "w", actorId: "boss", activityType: "working", startedAt: 10 },
    { eventId: "b", workSessionId: "w", actorId: "employee1", activityType: "reading", startedAt: 20 },
    { eventId: "c", workSessionId: "old", actorId: "employee1", activityType: "reading", startedAt: 30 },
  ];
  assert.deepEqual(filterOfficeActivityEvents(events, {
    workSessionId: "w", actorId: "employee1", activityType: "reading",
  }).map(({ eventId }) => eventId), ["b"]);
});
```

- [ ] **Step 2: Run focused tests and verify missing-module failure**

Run: `node --test src/work/officeActivities.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `officeActivities.js`.

- [ ] **Step 3: Implement exact activity definitions and event helpers**

```js
export const OFFICE_ACTIVITY_TYPES = [
  "working", "slacking", "eating", "gaming", "reading",
  "watchingSeries", "watchingShortVideo", "chatting",
];

export const ACTIVITY_DEFINITIONS = {
  working: { status: "工作中", title: "工作记录" },
  slacking: { status: "摸鱼中", title: "摸鱼记录" },
  eating: { status: "吃饭中", title: "用餐记录" },
  gaming: { status: "游戏中", title: "游戏记录" },
  reading: { status: "看书中", title: "阅读记录" },
  watchingSeries: { status: "刷剧中", title: "追剧记录" },
  watchingShortVideo: { status: "看抖音中", title: "短视频记录" },
  chatting: { status: "闲聊中", title: "聊天记录" },
};

export function createOfficeActivityEvent(input = {}) {
  const definition = ACTIVITY_DEFINITIONS[input.activityType] || ACTIVITY_DEFINITIONS.working;
  return {
    eventId: String(input.eventId || ""),
    workSessionId: String(input.workSessionId || ""),
    actorId: String(input.actorId || ""),
    participantIds: [...new Set(input.participantIds || [input.actorId].filter(Boolean))],
    profileSnapshots: structuredClone(input.profileSnapshots || []),
    activityType: input.activityType,
    movementPhase: String(input.movementPhase || "active"),
    status: definition.status,
    title: definition.title,
    subject: "",
    summary: "",
    insightOrResult: "",
    propVariant: String(input.propVariant || ""),
    conversationId: String(input.conversationId || ""),
    startedAt: Number(input.startedAt || 0),
    endedAt: 0,
    requestSequence: Number(input.requestSequence || 0),
    detailStatus: "pending",
  };
}
```

Implement `mergeOfficeActivityDetail` as an immutable exact match on `eventId`, `activityType`, and `requestSequence`. Implement `createLocalActivityDetail` with non-empty activity-specific `subject`, `summary`, and `insightOrResult`, using the first snapshot's name and personality. Implement filtering by current session, actor, and activity, then sort descending by `startedAt`.

- [ ] **Step 4: Add reducer ownership and persistence tests**

```js
test("stores and enriches only the active event for a slot", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, { type: "CREATE_ACTIVITY_EVENT", event: readingEvent });
  assert.equal(state.activeEventBySlot.employee1, "evt-read");
  state = officeReducer(state, { type: "ENRICH_ACTIVITY_EVENT", detail: {
    eventId: "evt-read", activityType: "reading", requestSequence: 1,
    title: "阅读记录", subject: "《沉思录》", summary: "读到自省", insightOrResult: "先处理可控之事",
  } });
  assert.equal(state.activityEvents[0].subject, "《沉思录》");
  state = officeReducer(state, { type: "COMPLETE_ACTIVITY_EVENT", eventId: "evt-read", endedAt: 5000 });
  assert.equal(state.activeEventBySlot.employee1, undefined);
});
```

Add `workSessionId`, `activityEvents`, and `activeEventBySlot` to `createOfficeState`, `serializeOfficeState`, and `restoreOfficeState`. Keep only the current session's serializable events; restore in-flight events as completed fallback records and clear live request ownership.

- [ ] **Step 5: Run all event and reducer tests**

Run: `node --test src/work/officeActivities.test.js src/work/officeState.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/work/officeActivities.js src/work/officeActivities.test.js src/work/officeState.js src/work/officeState.test.js
git commit -m "feat: add office activity event timeline state"
```

### Task 3: Extend The Scheduler With Concrete New Activities

**Files:**
- Modify: `src/work/officeScheduler.js`
- Modify: `src/work/officeScheduler.test.js`
- Modify: `src/work/officeState.js`

**Interfaces:**
- Consumes: `OFFICE_ACTIVITY_TYPES` and the current reducer state.
- Produces: scheduler events for `reading`, `watchingSeries`, and `watchingShortVideo` in addition to existing actions.

- [ ] **Step 1: Write failing exact-weight and deterministic-selection tests**

```js
test("exports reachable weights for all eight activity types", () => {
  assert.deepEqual(MODE_WEIGHTS.focus, {
    working: 58, reading: 12, slacking: 4, eating: 7,
    gaming: 3, watchingSeries: 3, watchingShortVideo: 3, chatting: 10,
  });
  for (const mode of Object.values(MODE_WEIGHTS)) {
    assert.equal(Object.values(mode).reduce((sum, value) => sum + value, 0), 100);
    for (const activity of OFFICE_ACTIVITY_TYPES) assert.ok(mode[activity] > 0);
  }
});

test("free mode can select reading series and short videos", () => {
  assert.equal(scheduleOfficeEvent(freeState, { random: sequenceRandom([0.27]), now: 1000 }).activity, "reading");
  assert.equal(scheduleOfficeEvent(freeState, { random: sequenceRandom([0.77]), now: 2000 }).activity, "watchingSeries");
  assert.equal(scheduleOfficeEvent(freeState, { random: sequenceRandom([0.85]), now: 3000 }).activity, "watchingShortVideo");
});
```

- [ ] **Step 2: Run the scheduler tests and verify failure**

Run: `node --test src/work/officeScheduler.test.js`

Expected: FAIL because the three new activities and exact weights do not exist.

- [ ] **Step 3: Implement the eight-activity weights and personality modifiers**

```js
export const MODE_WEIGHTS = {
  focus: { working: 58, reading: 12, slacking: 4, eating: 7, gaming: 3, watchingSeries: 3, watchingShortVideo: 3, chatting: 10 },
  free: { working: 25, reading: 10, slacking: 12, eating: 12, gaming: 9, watchingSeries: 8, watchingShortVideo: 9, chatting: 15 },
  rest: { working: 6, reading: 12, slacking: 14, eating: 18, gaming: 12, watchingSeries: 12, watchingShortVideo: 12, chatting: 14 },
};
```

Add desk-local event builders for the new activities. Use deterministic prop pools:

```js
const BOOK_PROPS = ["paperback", "hardcover", "magazine"];
const SERIES_PROPS = ["phone-landscape", "tablet", "second-screen"];
const SHORT_VIDEO_PROPS = ["phone-portrait-light", "phone-portrait-dark"];
```

Extend personality modifiers so `自律` and `沉静` favor work/reading, `追剧` favors series, `短视频` favors short videos, and `外向`/`话多` continue to favor chat. Clamp every final weight to at least `1`.

- [ ] **Step 4: Extend reducer status transitions**

Add exact statuses to `ACTIVITY_STATUS` and treat the three new activities as desk-local active phases:

```js
reading: "看书中",
watchingSeries: "刷剧中",
watchingShortVideo: "看抖音中",
```

- [ ] **Step 5: Run scheduler, reducer, and full tests**

Run: `node --test src/work/officeScheduler.test.js src/work/officeState.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/work/officeScheduler.js src/work/officeScheduler.test.js src/work/officeState.js src/work/officeState.test.js
git commit -m "feat: schedule reading and video activities"
```

### Task 4: Add Profile-Aware Activity Detail API

**Files:**
- Create: `src/work/officeActivityApi.js`
- Create: `src/work/officeActivityApi.test.js`
- Modify: `src/work/officeConversationApi.js`
- Modify: `src/work/officeConversationApi.test.js`

**Interfaces:**
- Consumes: activity events from Task 2 and `getOfficeEndpoint(storage)` from `officeConversationApi.js`.
- Produces: `buildOfficeActivityMessages(event)`, `parseOfficeActivityReply(raw, event)`, `requestOfficeActivityDetail(options)`.

- [ ] **Step 1: Write failing prompt and strict-response tests**

```js
test("builds a reading prompt from only the assigned profile snapshot", () => {
  const [system] = buildOfficeActivityMessages(readingEvent);
  assert.match(system.content, /沈知白/);
  assert.match(system.content, /克制/);
  assert.match(system.content, /投资人/);
  assert.match(system.content, /reading/);
  assert.doesNotMatch(system.content, /未参与角色/);
});

test("accepts only matching event activity and sequence", () => {
  const valid = JSON.stringify({
    eventId: "evt-1", activityType: "reading", requestSequence: 2,
    title: "阅读记录", subject: "《沉思录》", summary: "读到责任章节", insightOrResult: "先做好能控制的事",
  });
  assert.equal(parseOfficeActivityReply(valid, readingEvent).subject, "《沉思录》");
  assert.equal(parseOfficeActivityReply(valid.replace('"reading"', '"gaming"'), readingEvent), null);
  assert.equal(parseOfficeActivityReply(valid.replace('"requestSequence":2', '"requestSequence":1'), readingEvent), null);
});
```

- [ ] **Step 2: Run focused tests and verify missing-module failure**

Run: `node --test src/work/officeActivityApi.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `officeActivityApi.js`.

- [ ] **Step 3: Implement activity-specific prompt requirements**

```js
const DETAIL_FIELDS = {
  working: ["任务", "过程", "成果"],
  slacking: ["摸鱼内容", "细节", "反应"],
  eating: ["食物名称", "用餐细节", "反应"],
  gaming: ["游戏或类型", "发生的事", "结果"],
  reading: ["书名", "阅读内容", "启示"],
  watchingSeries: ["剧名", "当前情节", "角色感想"],
  watchingShortVideo: ["视频主题", "内容", "角色反应"],
  chatting: ["聊天主题", "具体内容", "角色反应"],
};

export function buildOfficeActivityMessages(event) {
  const context = {
    eventId: event.eventId,
    activityType: event.activityType,
    requestSequence: event.requestSequence,
    profiles: event.profileSnapshots,
    requiredMeaning: DETAIL_FIELDS[event.activityType],
  };
  return [{
    role: "system",
    content: `根据角色档案补全当前办公室活动。内容必须符合角色性格、身份、背景和语言习惯，不得改变 activityType。只返回 eventId、activityType、requestSequence、title、subject、summary、insightOrResult 七个键的 JSON。\n${JSON.stringify(context)}`,
  }, { role: "user", content: "生成本次活动的具体记录。" }];
}
```

Parse fenced or plain JSON, reject extra/missing keys, cap each human-readable field at 120 characters, and require exact event ID, activity type, and sequence. `requestOfficeActivityDetail` calls the selected endpoint with injectable `fetchImpl` and `signal`; all configuration, network, HTTP, JSON, and validation failures return `createLocalActivityDetail(event)` with `detailStatus: "fallback"`.

- [ ] **Step 4: Strengthen conversation profile assertions**

Add a conversation test with one Me snapshot and one Character snapshot. Assert that name, identity, personality, appearance, persona, and Character `worldview` are present only for current members. Update `normalizeMemberProfile` to preserve `source`, `type`, and `worldview` while retaining existing transcript and relation isolation.

- [ ] **Step 5: Run API tests and full suite**

Run: `node --test src/work/officeActivityApi.test.js src/work/officeConversationApi.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/work/officeActivityApi.js src/work/officeActivityApi.test.js src/work/officeConversationApi.js src/work/officeConversationApi.test.js
git commit -m "feat: generate profile-aware office activity details"
```

### Task 5: Replace Waypoint Steps With Continuous Route Motion

**Files:**
- Create: `src/work/officeMotion.js`
- Create: `src/work/officeMotion.test.js`
- Modify: `src/work/officeState.js`
- Modify: `src/work/officeState.test.js`

**Interfaces:**
- Consumes: route node IDs and `OFFICE_NODES` from `officeNavigation.js`.
- Produces: `getRouteDistance(route, nodes)`, `sampleOfficeRoute({ route, startedAt, now, speed, nodes })`, `getWalkFrame({ startedAt, now, fps })`.

- [ ] **Step 1: Write failing continuity and frame tests**

```js
test("moves linearly through a waypoint without teleporting", () => {
  const nodes = { a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, c: { x: 10, y: 10 } };
  const before = sampleOfficeRoute({ route: ["a", "b", "c"], startedAt: 0, now: 999, speed: 10, nodes });
  const after = sampleOfficeRoute({ route: ["a", "b", "c"], startedAt: 0, now: 1001, speed: 10, nodes });
  assert.ok(Math.abs(before.x - after.x) < 0.03);
  assert.ok(Math.abs(before.y - after.y) < 0.03);
  assert.equal(before.facing, "right");
  assert.equal(after.facing, "front");
});

test("uses all eight walk frames at twelve fps", () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => (
    getWalkFrame({ startedAt: 0, now: index * 84, fps: 12 })
  )), [0, 1, 2, 3, 4, 5, 6, 7]);
});
```

- [ ] **Step 2: Run focused tests and verify missing-module failure**

Run: `node --test src/work/officeMotion.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `officeMotion.js`.

- [ ] **Step 3: Implement distance-based sampling**

```js
export function sampleOfficeRoute({ route = [], startedAt = 0, now = 0, speed = 18, nodes = {} }) {
  const segments = route.slice(0, -1).map((fromId, index) => {
    const from = nodes[fromId];
    const to = nodes[route[index + 1]];
    const distance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
    return { fromId, toId: route[index + 1], from, to, distance };
  }).filter(({ from, to, distance }) => from && to && distance > 0);
  let remaining = Math.max(0, (now - startedAt) / 1000) * speed;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (remaining <= segment.distance) {
      const progress = remaining / segment.distance;
      const dx = segment.to.x - segment.from.x;
      const dy = segment.to.y - segment.from.y;
      return { x: segment.from.x + dx * progress, y: segment.from.y + dy * progress,
        facing: Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "back" : "front"),
        segmentIndex: index, done: false };
    }
    remaining -= segment.distance;
  }
  const end = segments.at(-1)?.to || nodes[route.at(-1)] || { x: 50, y: 50 };
  return { x: end.x, y: end.y, facing: "front", segmentIndex: segments.length, done: true };
}
```

`getWalkFrame` returns `Math.floor(Math.max(0, now - startedAt) / 1000 * fps) % 8`. Return a stable home position for invalid or single-node routes.

- [ ] **Step 4: Store route start time instead of timer-owned route indexes**

On `START_ACTIVITY` and `START_RETURN`, set `routeStartedAt` from `action.now`, keep the full route, and reset `routeIndex` only for backward-compatible persistence. Add `COMPLETE_ROUTE` as the only action that changes from walking to active activity or finishes a return. Preserve old `ADVANCE_ROUTE` handling only for restored `V1` state migration, then remove its live timer usage in Task 8.

- [ ] **Step 5: Run motion, reducer, and full tests**

Run: `node --test src/work/officeMotion.test.js src/work/officeState.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/work/officeMotion.js src/work/officeMotion.test.js src/work/officeState.js src/work/officeState.test.js
git commit -m "feat: add continuous office route motion"
```

### Task 6: Generate And Install The New Office Art Library

**Files:**
- Modify: `src/work/officeAssets.js`
- Modify: `src/work/officeAssets.test.js`
- Delete: `public/work-office-assets/chibi/*.png`
- Create: `public/work-office-assets/chibi/*.webp`
- Delete: `public/work-office-assets/office-bg.png`
- Create: `public/work-office-assets/office-bg.webp`

**Interfaces:**
- Produces: exactly 16 8x8 atlases and one 9:16 office background consumed by Tasks 7 and 8.

- [ ] **Step 1: Update the manifest tests before replacing assets**

```js
test("ships sixteen transparent 8x8 WebP atlases", async () => {
  assert.equal(OFFICE_CHIBIS.length, 16);
  for (const item of OFFICE_CHIBIS) {
    assert.match(item.src, /\/work-office-assets\/chibi\/(boss|employee)-[fm]-\d{2}\.webp$/);
    assert.equal(item.columns, 8);
    assert.equal(item.rows, 8);
    await access(publicAssetUrl(item.src));
  }
});

test("maps every direction and activity to the fixed atlas contract", () => {
  assert.deepEqual(getActivityFrame("walking", 7, "right"), frame(0, 7));
  assert.deepEqual(getActivityFrame("walking", 7, "front"), frame(1, 7));
  assert.deepEqual(getActivityFrame("walking", 7, "back"), frame(2, 7));
  assert.deepEqual(getActivityFrame("working", 3, "front"), frame(3, 3));
  assert.deepEqual(getActivityFrame("slacking", 3, "front"), frame(3, 7));
  assert.deepEqual(getActivityFrame("eating", 3, "front"), frame(4, 3));
  assert.deepEqual(getActivityFrame("gaming", 3, "front"), frame(4, 7));
  assert.deepEqual(getActivityFrame("reading", 3, "front"), frame(5, 3));
  assert.deepEqual(getActivityFrame("watchingSeries", 3, "front"), frame(5, 7));
  assert.deepEqual(getActivityFrame("watchingShortVideo", 3, "front"), frame(6, 3));
  assert.deepEqual(getActivityFrame("chatting", 3, "front"), frame(6, 7));
});
```

- [ ] **Step 2: Run the asset tests and verify they fail against the 3x3 PNG library**

Run: `node --test src/work/officeAssets.test.js`

Expected: FAIL because assets are PNG, omit grid metadata, and use 3x3 frame mapping.

- [ ] **Step 3: Generate the white and dusty-rose-gray office background**

Use the image-generation editing workflow with `public/work-office-assets/office-bg.png` as the geometry reference. Generate a people-free and UI-free 9:16 bitmap using this exact art direction:

```text
Completely redraw this mobile game office background while preserving the exact boss desk, four 2x2 employee desks, aisle, meal area, and open route geometry. Premium low-saturation Japanese mobile-game background illustration. Pearl white and fog white dominate; pale gray wood and cool gray hardware add structure; dusty rose gray appears only in restrained chairs, wall art, and small soft furnishings. Bright soft daylight, elegant female-friendly but not sweet, clean executive boss desk, recognizable computers, no green-dominant palette, no people, no text, no UI, no speech bubbles, no perspective distortion, crisp inspectable furniture.
```

Inspect the result, iterate until desk and aisle geometry match the reference, then convert to `1080x1920` WebP at quality `90` as `public/work-office-assets/office-bg.webp`.

- [ ] **Step 4: Generate 16 consistent 8x8 character atlases**

For each category, generate four visually distinct characters with transparent backgrounds. Every atlas is `1024x1024`, eight equal columns by eight equal rows, one centered full-body chibi per cell, consistent scale and identity across all 64 cells:

```text
Low-saturation premium Japanese mobile-game chibi sprite atlas, attractive refined face, clean anime linework, transparent background, exact 8 by 8 grid, identical character identity and clothing in all cells, no labels, no grid lines, no cropped hair or feet. Rows: 1 eight-frame walk facing right; 2 eight-frame walk facing front; 3 eight-frame walk facing back; 4 four typing/work frames then four clearly different slacking frames; 5 four eating-with-food frames then four gaming-with-controller frames; 6 four reading-and-page-turn frames then four horizontal-screen drama-watching frames; 7 four vertical-phone short-video scrolling frames then four speaking/chatting frames; 8 four idle frames then four listening/reaction frames. Natural contact, recoil, passing, and high-point walk poses; animated arms, legs, hips, hair, and clothing.
```

Use four female-boss prompts, four male-boss prompts, four female-employee prompts, and four male-employee prompts with distinct hair, silhouettes, accessories, and clothes. Boss prompts use polished formal or executive creative clothing. Employee prompts cover business casual, knitwear, fashion office wear, creative casual, and restrained tech/street styling. Reject and regenerate any atlas with identity drift, duplicate outfits, missing direction, clipped cells, opaque backgrounds, or repeated generic poses.

- [ ] **Step 5: Install the exact 8x8 manifest and frame map**

```js
return {
  id, name: `${label} ${number}`, kind, gender,
  src: `${ASSET_BASE}/${id}.webp`, columns: 8, rows: 8,
};

const ACTIVITY_BLOCKS = {
  working: { row: 3, offset: 0 }, slacking: { row: 3, offset: 4 },
  eating: { row: 4, offset: 0 }, gaming: { row: 4, offset: 4 },
  reading: { row: 5, offset: 0 }, watchingSeries: { row: 5, offset: 4 },
  watchingShortVideo: { row: 6, offset: 0 }, chatting: { row: 6, offset: 4 },
  idle: { row: 7, offset: 0 }, listening: { row: 7, offset: 4 },
};
```

`getActivityFrame(activity, phase, facing)` uses rows `0`, `1`, and `2` with eight phases for walking and the fixed four-frame blocks for activities. Return `backgroundSize: "800% 800%"` and exact percentage positions based on seven intervals.

- [ ] **Step 6: Validate assets and run tests**

Run: `node --test src/work/officeAssets.test.js && npm test && npm run build`

Expected: all tests PASS; the production build includes one background WebP and exactly 16 chibi WebP files with no old office PNG files.

- [ ] **Step 7: Commit**

```bash
git add src/work/officeAssets.js src/work/officeAssets.test.js public/work-office-assets
git commit -m "feat: replace office art and chibi atlases"
```

### Task 7: Render New Actions, Smooth Motion, And Complete Bubbles

**Files:**
- Modify: `src/work/OfficeCharacter.jsx`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/office.css`
- Modify: `src/work/WorkAppScreen.test.js`

**Interfaces:**
- Consumes: `sampleOfficeRoute`, `getWalkFrame`, atlas mapping, activity events, and assignments.
- Produces: a continuously positioned scene character with matching action props, status, labels, and bubbles.

- [ ] **Step 1: Add failing source and render-contract assertions**

```js
test("renders every concrete office action from the authoritative event", () => {
  for (const token of [
    "BookProps", "SeriesProps", "ShortVideoProps", "MealProps", "GameProps",
    "activityEvent", "sampleOfficeRoute", "motionNow", "getWalkFrame",
  ]) assert.ok(characterAndSceneSource.includes(token), `missing ${token}`);
});

test("removes hard route-step and bubble-clamp rendering", () => {
  assert.doesNotMatch(characterAndSceneSource, /routeStepDurationMs/);
  assert.match(cssSource, /overflow-wrap:\s*anywhere/);
  assert.match(cssSource, /word-break:\s*break-word/);
  assert.doesNotMatch(cssSource, /-webkit-line-clamp/);
});
```

- [ ] **Step 2: Run focused tests and verify the new contract fails**

Run: `node --test src/work/WorkAppScreen.test.js`

Expected: FAIL because the new props and continuous-motion inputs are absent and bubbles remain clamped.

- [ ] **Step 3: Render continuous route samples and directional frames**

In `OfficeScene`, sample moving characters from `character.routeStartedAt` and `motionNow`:

```js
const motion = MOVING_PHASES.has(character.phase)
  ? sampleOfficeRoute({ route: character.route, startedAt: character.routeStartedAt,
      now: motionNow, speed: OFFICE_WALK_SPEED, nodes: OFFICE_NODES })
  : null;
const sceneLayout = motion || getConversationLayout(character, conversation, slotId, node);
```

Pass `motionNow`, `motion`, and the matching `activityEvent` to `OfficeCharacter`. Select walk frame with `getWalkFrame`; select active frame with a four-frame clock. Mirror only left-facing built-in sprites. Preserve custom uploaded images as static assets with subtle non-walk idle motion.

- [ ] **Step 4: Add purpose-specific prop components**

```jsx
function BookProps({ subject }) {
  return <div className="office-book-prop office-activity-prop" role="img" aria-label={`正在阅读${subject || "书籍"}`}><i></i><i></i><b></b></div>;
}

function SeriesProps({ subject }) {
  return <div className="office-series-prop office-activity-prop" role="img" aria-label={`正在观看${subject || "剧集"}`}><i className="screen"></i><i className="hands"></i></div>;
}

function ShortVideoProps({ subject }) {
  return <div className="office-short-video-prop office-activity-prop" role="img" aria-label={`正在看${subject || "短视频"}`}><i className="phone"></i><i className="thumb"></i></div>;
}
```

Render props from `activityEvent.activityType` and `activityEvent.propVariant`. Work, slack, meal, game, and chat must also receive their subject/variant from the same event rather than separate random state.

- [ ] **Step 5: Replace bubble clipping with complete wrapping**

```css
.office-speech-bubble {
  width: max-content;
  min-width: 0;
  max-width: min(180px, calc(100vw - 24px));
  height: auto;
  max-height: none;
  overflow: visible;
  overflow-wrap: anywhere;
  word-break: break-word;
  white-space: normal;
  -webkit-line-clamp: unset;
}
```

Retain conversation-specific offsets and group ownership. Remove the special five-member fixed `112px` width and use collision-aware viewport clamping.

- [ ] **Step 6: Run focused tests and full suite**

Run: `node --test src/work/WorkAppScreen.test.js && npm test && npm run build`

Expected: all tests PASS and the build contains no unresolved office asset imports.

- [ ] **Step 7: Commit**

```bash
git add src/work/OfficeCharacter.jsx src/work/OfficeScene.jsx src/work/office.css src/work/WorkAppScreen.test.js
git commit -m "feat: render smooth office actions and bubbles"
```

### Task 8: Add Assignment Navigation, Activity Sheet, And Runtime Wiring

**Files:**
- Create: `src/work/OfficeAssignmentFlow.jsx`
- Create: `src/work/OfficeActivityPanel.jsx`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/WorkAppScreen.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: profile adapters, event reducer, scheduler, activity API, motion sampling, and scene rendering.
- Produces: the complete Work app interaction and API lifecycle.

- [ ] **Step 1: Add failing screen-wiring assertions**

```js
test("ships safe-area tools assignment back navigation and activity history", () => {
  for (const token of [
    "Ellipsis", "活动记录", "OfficeActivityPanel", "OfficeAssignmentFlow",
    "assignmentView", "selectedAssignmentSlotId", "requestOfficeActivityDetail",
    "activityControllersRef", "requestAnimationFrame",
  ]) assert.ok(source.includes(token), `missing Work screen wiring: ${token}`);
  assert.doesNotMatch(source, /ROUTE_STEP_MS/);
  assert.doesNotMatch(source, /setInterval\(advanceRoutes/);
});
```

- [ ] **Step 2: Run the screen tests and verify failure**

Run: `node --test src/work/WorkAppScreen.test.js`

Expected: FAIL because the two new panels, overflow button, activity runtime, and animation clock do not exist.

- [ ] **Step 3: Build the two-level assignment flow**

`OfficeAssignmentFlow` receives this exact contract:

```jsx
<OfficeAssignmentFlow
  view={assignmentView}
  selectedSlotId={selectedAssignmentSlotId}
  slots={SLOT_DETAILS}
  assignments={assignments}
  profiles={profiles}
  occupiedProfiles={occupiedProfiles}
  onOpenSlot={setSelectedAssignmentSlotId}
  onBack={() => selectedAssignmentSlotId ? setSelectedAssignmentSlotId("") : closeAssignmentPanel()}
  onProfileChange={handleProfileChange}
  onChibiChange={handleChibiChange}
  onUpload={handleUpload}
  onCustomDraftChange={handleCustomDraftChange}
/>
```

The overview renders five fixed-height slot buttons. The selection view renders one slot's profile selector, eight compatible built-in chibis, upload control, and URL control. Both headers use an `ArrowLeft` icon with `aria-label="返回员工安排"` or `aria-label="返回办公室"`.

- [ ] **Step 4: Build the current-session activity panel**

```jsx
<OfficeActivityPanel
  open={activityPanelOpen}
  events={state.activityEvents}
  workSessionId={state.workSessionId}
  assignments={assignments}
  onClose={() => setActivityPanelOpen(false)}
/>
```

The bottom sheet has one close icon, `全部` plus character and activity filters, newest-first entries, and visible fields for time, character, action, subject, summary, and insight/result. Active entries show `进行中`; fallback entries show `本地记录`. It traps focus while open and restores focus to the three-dot button on close.

- [ ] **Step 5: Wire scheduler events and API requests by event ID**

When a scheduler event starts, create and dispatch an activity event before rendering the action:

```js
const activityEvent = createOfficeActivityEvent({
  eventId: `activity-${state.workSessionId}-${activityCounterRef.current++}`,
  workSessionId: state.workSessionId,
  actorId: event.slotId,
  participantIds: event.memberIds || [event.slotId],
  profileSnapshots: (event.memberIds || [event.slotId]).map((slotId) => (
    createOfficeProfileSnapshot(assignmentsRef.current[slotId].profile,
      slotId === "boss" ? "me" : "character")
  )),
  activityType: event.activity,
  propVariant: event.meal || event.propVariant || "",
  startedAt: now,
  requestSequence: 1,
  conversationId: event.session?.id || "",
});
dispatchOffice({ type: "CREATE_ACTIVITY_EVENT", event: activityEvent });
```

Use one `AbortController` per `eventId`. On resolution, dispatch `ENRICH_ACTIVITY_EVENT`; the reducer performs exact matching. Abort controllers on unmount only. Completing or switching an action archives the event and prevents its response from changing current character state.

- [ ] **Step 6: Replace route intervals with one animation clock**

```js
const timestampOriginRef = useRef(Date.now() - performance.now());

useEffect(() => {
  let frameId = 0;
  const frame = (timestamp) => {
    setMotionNow(timestampOriginRef.current + timestamp);
    frameId = window.requestAnimationFrame(frame);
  };
  frameId = window.requestAnimationFrame(frame);
  return () => window.cancelAnimationFrame(frameId);
}, []);
```

At each render, sample only five characters. When a sample first reports `done`, dispatch `COMPLETE_ROUTE` once using a `completedRouteKeysRef` keyed by `slotId:routeStartedAt`. Remove `ROUTE_STEP_MS`, the route interval, and `routeStepDurationMs` props.

- [ ] **Step 7: Move top tools below the safe area without reflowing the scene**

Render header columns as back, timer, assignment, and overflow:

```jsx
<button aria-label="员工安排"><Users /></button>
<button aria-label="活动记录" aria-expanded={activityPanelOpen}><Ellipsis /></button>
```

Use absolute overlay geometry:

```css
.work-app-header { position: absolute; z-index: var(--work-z-toolbar); top: var(--app-safe-top-clearance); left: 0; right: 0; height: 52px; grid-template-columns: 48px minmax(0, 1fr) 44px 44px; }
.work-mode-control { position: absolute; z-index: var(--work-z-toolbar); top: calc(var(--app-safe-top-clearance) + 52px); left: 0; right: 0; height: 48px; }
.work-office-surface { position: absolute; inset: 100px 0 0; }
```

The `100px` office-surface top preserves the pre-redesign `52px + 48px` scene position. Add panel safe-area padding separately; do not change scene node percentages.

- [ ] **Step 8: Refresh profiles while preserving valid assignments**

On Work app open and `storage` events for `apiMeProfiles`, `apiCharacters`, or `apiRelations`, call `readOfficeProfiles`, normalize current assignment IDs, keep valid choices, and replace deleted choices with the correct NPC fallback. Existing activity events retain their stored snapshots.

- [ ] **Step 9: Run screen tests and full suite**

Run: `node --test src/work/WorkAppScreen.test.js && npm test && npm run build`

Expected: all tests PASS; no unused route timer or old one-page assignment markup remains.

- [ ] **Step 10: Commit**

```bash
git add src/work/OfficeAssignmentFlow.jsx src/work/OfficeActivityPanel.jsx src/work/WorkAppScreen.jsx src/work/WorkAppScreen.test.js src/work/office.css
git commit -m "feat: add office activity history and assignment flow"
```

### Task 9: Mobile QA, Version, Pages Sync, And Deployment

**Files:**
- Modify: `scripts/verify-office.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Refresh: `docs/index.html`
- Refresh: `docs/assets/*`
- Replace: `docs/work-office-assets/*`
- Modify: `docs/.deploy-version`
- Refresh: `docs/superpowers/qa/office-375x812.png`
- Refresh: `docs/superpowers/qa/office-390x844.png`

**Interfaces:**
- Consumes: complete Tasks 1 through 8.
- Produces: verified version `0.2.96` in the repository and on GitHub Pages.

- [ ] **Step 1: Extend Playwright verification before changing the release version**

Add checks that:

```js
await expectCount(page.locator(".office-character"), 5, "office characters");
await expectCount(page.locator('img.office-scene-background[src$="office-bg.webp"]'), 1, "new office background");
await page.getByRole("button", { name: "活动记录" }).click();
await page.getByRole("dialog", { name: "活动记录" }).waitFor({ state: "visible" });
```

Seed deterministic assignments and mocked API events in `localStorage`. Verify:

- header top is at or below computed `--app-safe-top-clearance`
- `.work-office-surface` retains the baseline top position of `100px`
- overview back returns to office and selection back returns to overview
- boss options contain only Me profiles; employee options contain main and NPC Character profiles
- all 16 built-in WebP assets decode with non-zero natural dimensions
- position samples taken every `50ms` during a multi-node walk never jump more than `OFFICE_WALK_SPEED * elapsed + 1px tolerance`
- work, slack, meal, game, book, series, short-video, and chat props each appear under their matching status
- two disjoint conversation IDs keep disjoint member bubbles
- a 40-digit bubble wraps within the scene and its `scrollHeight` equals its visible content height
- activity filters show only matching current-session events
- no console errors, page errors, failed asset requests, or unexpected API requests occur

- [ ] **Step 2: Run tests, build, and browser QA before version churn**

Run: `npm test && npm run build && npm run verify:office`

Expected: all unit tests PASS, Vite build succeeds, both mobile viewport checks PASS, and screenshots are refreshed.

- [ ] **Step 3: Update every version source of truth to `0.2.96`**

```json
{
  "version": "0.2.96"
}
```

Update `package.json` and the root package entry in `package-lock.json`. Replace `V0.2.95` with `V0.2.96` in `src/App.jsx`, and replace versioned `?v=0.2.95` asset references with `?v=0.2.96` in `src/App.jsx` and `src/styles.css`.

- [ ] **Step 4: Run final verification and sync Pages output**

Run: `npm test && npm run deploy:pages && npm run verify:office`

Expected: all tests PASS; build succeeds; `docs/.deploy-version` contains exactly `0.2.96`; `docs/work-office-assets/chibi` contains 16 WebP files and no old PNG files; final screenshots pass visual inspection.

- [ ] **Step 5: Commit the release**

```bash
git add package.json package-lock.json src/App.jsx src/styles.css scripts/verify-office.mjs public/work-office-assets docs
git commit -m "Deploy V0.2.96"
```

- [ ] **Step 6: Push and verify GitHub Pages**

Run:

```bash
git push origin feature/animated-office:main
```

Poll `https://sy719427083-glitch.github.io/ai-roleplay-phone/.deploy-version` until it returns `0.2.96`, then open the live app with a cache-busting query. Verify the visible version, office background, five named characters, smooth walking, one detailed activity record, one group conversation, long-number wrapping, and zero console/network failures.

- [ ] **Step 7: Record final evidence**

Record the deployed commit hash, live `.deploy-version`, total passing test count, build result, viewport screenshot paths, and online verification result in the final response.
