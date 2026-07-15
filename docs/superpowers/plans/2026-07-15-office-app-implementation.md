# Office App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a low-saturation animated office simulator with one boss, four employees, concrete activities, collision-aware walking, and isolated concurrent API conversations.

**Architecture:** Keep office behavior in pure modules under `src/work/` and let one React screen render reducer state. A deterministic scheduler creates activities, a small navigation graph routes characters, and each API conversation owns a separate session, transcript, request sequence, abort controller, and speech-bubble queue.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Node test runner, CSS animations, Lucide React, Playwright, browser `localStorage`, OpenAI-compatible `/chat/completions` endpoint.

## Global Constraints

- Preserve the approved low-saturation palette: warm white, fog gray, pale oak, sage green, dusty blue, muted coral, and small champagne-gold accents.
- Render exactly one boss and four employees; unassigned slots display the name `NPC`.
- Boss options come from Main Characters; employee options come from Characters or NPCs.
- Support 16 built-in chibi designs: four female employees, four male employees, four female bosses, and four male bosses.
- Every visible character has a name label above the head.
- Work, slack off, eat, play games, chat, and walking must use visibly different poses and props.
- Eating must show visible food and utensils; hot food shows steam and the meal amount reduces during the activity.
- Allow group conversations and multiple simultaneous disjoint groups without sharing prompts, transcripts, responses, or bubble queues.
- Do not add a new runtime dependency for state management, pathfinding, or animation.
- Keep existing untracked `artifacts/` and `designs/` content untouched.
- Increment version `0.2.94` to `0.2.95` and deploy the verified build to `https://sy719427083-glitch.github.io/ai-roleplay-phone/`.

## File Map

- Create `src/work/officeProfiles.js`: read and normalize character options, assignments, and NPC fallbacks.
- Create `src/work/officeProfiles.test.js`: profile and assignment tests.
- Modify `package.json`: include `src/work/*.test.js` in the full test command.
- Create `src/work/officeState.js`: pure office reducer, persistence normalization, timers, reservations, and state transitions.
- Create `src/work/officeState.test.js`: legal transitions, recovery, and persistence tests.
- Create `src/work/officeNavigation.js`: office navigation graph, route search, anchor reservations, and directional output.
- Create `src/work/officeNavigation.test.js`: routing and conflict tests.
- Create `src/work/officeScheduler.js`: mode and personality weighted event selection.
- Create `src/work/officeScheduler.test.js`: deterministic eligibility and concurrent-group tests.
- Create `src/work/officeConversationApi.js`: endpoint selection, prompt isolation, response validation, and local fallbacks.
- Create `src/work/officeConversationApi.test.js`: prompt, stale response, foreign speaker, and failure tests.
- Create `src/work/officeAssets.js`: 16-character atlas manifest and activity frame mapping.
- Create `src/work/officeAssets.test.js`: manifest completeness and asset existence tests.
- Create `src/work/OfficeCharacter.jsx`: one character, name, state, props, direction, and speech bubble.
- Create `src/work/OfficeScene.jsx`: office furniture, activity stations, characters, and conversation layers.
- Create `src/work/WorkAppScreen.jsx`: reducer lifecycle, scheduler, API effects, assignments, timer, controls, and tabs.
- Create `src/work/office.css`: responsive office styling and all activity animations.
- Create `src/App.work.test.js`: Work app integration source assertions.
- Modify `src/App.jsx`: import and open `WorkAppScreen`.
- Modify `src/styles.css`: import-independent shell rules for the work overlay and versioned asset query.
- Create `public/work-office-assets/chibi/*.png`: 16 transparent 3x3 activity atlases.
- Create `public/work-office-assets/office-bg.png`: low-saturation office background without people or UI.
- Create `scripts/verify-office.mjs`: Playwright desktop/mobile screenshots and canvas-pixel checks.
- Create `scripts/sync-pages.mjs`: safely sync Vite output into `docs/` without deleting `docs/superpowers/`.
- Modify `package.json`, `package-lock.json`, `docs/.deploy-version`: version and scripts.

---

### Task 1: Profile and Assignment Adapter

**Files:**
- Create: `src/work/officeProfiles.js`
- Test: `src/work/officeProfiles.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: storage keys `apiCharacters` and `apiRelations`.
- Produces: `readOfficeProfiles(storage)`, `normalizeOfficeAssignments(value, profiles)`, `createNpcProfile(slotId, kind)`, `OFFICE_ASSIGNMENT_KEY`.

- [ ] **Step 1: Write the failing profile tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createNpcProfile, normalizeOfficeAssignments, readOfficeProfiles } from "./officeProfiles.js";

const storage = (data) => ({ getItem: (key) => data[key] ?? null });

test("separates main-character boss options and npc employee options", () => {
  const result = readOfficeProfiles(storage({
    apiCharacters: JSON.stringify({
      boss: { type: "main", name: "顾言", personality: "克制" },
      staff: { type: "npc", name: "林夏", personality: "活泼" },
    }),
    apiRelations: JSON.stringify({ r1: { charA: "boss", charB: "staff", type: "同事" } }),
  }));
  assert.deepEqual(result.bossOptions.map((item) => item.id), ["boss"]);
  assert.deepEqual(result.employeeOptions.map((item) => item.id), ["staff"]);
  assert.equal(result.relations.r1.type, "同事");
});

test("fills missing and deleted assignments with named npc profiles", () => {
  const profiles = { bossOptions: [], employeeOptions: [] };
  const result = normalizeOfficeAssignments({ boss: "deleted" }, profiles);
  assert.equal(result.boss.profile.name, "NPC");
  assert.equal(result.employee1.profile.name, "NPC");
  assert.equal(createNpcProfile("employee4", "employee").id, "npc-employee4");
});
```

- [ ] **Step 2: Run the tests and verify module absence**

Run: `node --test src/work/officeProfiles.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `officeProfiles.js`.

- [ ] **Step 3: Implement normalization and NPC fallbacks**

```js
export const OFFICE_ASSIGNMENT_KEY = "ccatOfficeAssignmentsV1";
export const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];

const readObject = (storage, key) => {
  try { return JSON.parse(storage.getItem(key) || "{}"); } catch { return {}; }
};

const normalizeProfile = (id, value = {}) => ({
  ...value,
  id,
  name: String(value.name || "NPC"),
  identity: String(value.identity || value.role || "角色"),
  personality: String(value.personality || "自然"),
  persona: String(value.persona || ""),
});

export const createNpcProfile = (slotId, kind) => ({
  id: `npc-${slotId}`,
  name: "NPC",
  identity: kind === "boss" ? "临时老板" : "临时员工",
  personality: "自然、友好",
  persona: "办公室临时角色",
  generated: true,
});

export function readOfficeProfiles(storage = window.localStorage) {
  const characters = readObject(storage, "apiCharacters");
  const all = Object.entries(characters).map(([id, value]) => normalizeProfile(id, value));
  return {
    bossOptions: all.filter((item) => item.type === "main" || item.type === "主角"),
    employeeOptions: all.filter((item) => item.type !== "main" && item.type !== "主角"),
    relations: readObject(storage, "apiRelations"),
  };
}

export function normalizeOfficeAssignments(value = {}, profiles) {
  const bossMap = new Map(profiles.bossOptions.map((item) => [item.id, item]));
  const employeeMap = new Map(profiles.employeeOptions.map((item) => [item.id, item]));
  return Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => {
    const kind = slotId === "boss" ? "boss" : "employee";
    const profile = (kind === "boss" ? bossMap : employeeMap).get(value[slotId]) || createNpcProfile(slotId, kind);
    return [slotId, { profileId: profile.id, profile }];
  }));
}
```

Change the package test script to `node --test src/*.test.js src/work/*.test.js` so every later `npm test` command includes the new modules.

- [ ] **Step 4: Run the focused and full tests**

Run: `node --test src/work/officeProfiles.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeProfiles.js src/work/officeProfiles.test.js package.json
git commit -m "feat: add office profile assignments"
```

### Task 2: Pure Character and Conversation State

**Files:**
- Create: `src/work/officeState.js`
- Test: `src/work/officeState.test.js`

**Interfaces:**
- Consumes: normalized assignments from Task 1.
- Produces: `createOfficeState({ assignments, now, durationMs })`, `officeReducer(state, action)`, `serializeOfficeState(state)`, `restoreOfficeState(raw, assignments, now)`.

- [ ] **Step 1: Write failing state transition tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createOfficeState, officeReducer, restoreOfficeState } from "./officeState.js";

const assignments = Object.fromEntries(["boss", "employee1", "employee2", "employee3", "employee4"].map((id) => [id, { profileId: id, profile: { id, name: id } }]));

test("walks to a meal, eats visible food, and returns home", () => {
  let state = createOfficeState({ assignments, now: 1000, durationMs: 60_000 });
  state = officeReducer(state, { type: "START_ACTIVITY", slotId: "employee1", activity: "eating", anchorId: "break-1", route: ["employee1-exit", "aisle", "break-1"], now: 1100 });
  assert.equal(state.characters.employee1.phase, "walkingToActivity");
  assert.equal(state.characters.employee1.status, "前往用餐");
  state = officeReducer(state, { type: "ARRIVE_ACTIVITY", slotId: "employee1", now: 2000, endsAt: 9000, meal: "noodles" });
  assert.equal(state.characters.employee1.activity, "eating");
  assert.equal(state.characters.employee1.props.meal, "noodles");
  state = officeReducer(state, { type: "START_RETURN", slotId: "employee1", route: ["break-1", "aisle", "employee1-home"] });
  state = officeReducer(state, { type: "FINISH_RETURN", slotId: "employee1" });
  assert.equal(state.characters.employee1.positionNode, "employee1-home");
});

test("keeps simultaneous conversation transcripts isolated", () => {
  let state = createOfficeState({ assignments, now: 0, durationMs: 60_000 });
  state = officeReducer(state, { type: "OPEN_CONVERSATION", session: { id: "a", memberIds: ["employee1", "employee2"], transcript: [] } });
  state = officeReducer(state, { type: "OPEN_CONVERSATION", session: { id: "b", memberIds: ["employee3", "employee4"], transcript: [] } });
  state = officeReducer(state, { type: "APPEND_CONVERSATION", conversationId: "a", entry: { speakerId: "employee1", text: "A组" } });
  assert.equal(state.conversations.a.transcript.length, 1);
  assert.equal(state.conversations.b.transcript.length, 0);
});

test("reload closes network conversations and returns characters home", () => {
  const restored = restoreOfficeState(JSON.stringify({ conversations: { a: { id: "a" } }, characters: { employee1: { phase: "chatting" } } }), assignments, 5000);
  assert.deepEqual(restored.conversations, {});
  assert.equal(restored.characters.employee1.phase, "idle");
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/work/officeState.test.js`

Expected: FAIL because the state module does not exist.

- [ ] **Step 3: Implement the reducer with explicit phases**

Implement these immutable actions: `SET_MODE`, `TICK`, `ASSIGN_PROFILE`, `START_ACTIVITY`, `ADVANCE_ROUTE`, `ARRIVE_ACTIVITY`, `START_RETURN`, `FINISH_RETURN`, `OPEN_CONVERSATION`, `APPEND_CONVERSATION`, `QUEUE_BUBBLE`, `SHIFT_BUBBLE`, `CLOSE_CONVERSATION`, and `RESET_EXPIRED`.

Use the exact status mapping:

```js
export const ACTIVITY_STATUS = {
  working: "工作中",
  slacking: "摸鱼中",
  eating: "吃饭中",
  gaming: "游戏中",
  chatting: "闲聊中",
};

export const TRAVEL_STATUS = {
  eating: "前往用餐",
  chatting: "前往闲聊",
  meeting: "前往开会",
  returning: "返回工位",
};
```

Reject `OPEN_CONVERSATION` when any requested member already has a `conversationId`. On `CLOSE_CONVERSATION`, clear only that session and start return routes for visitors; keep unrelated sessions unchanged.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/work/officeState.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeState.js src/work/officeState.test.js
git commit -m "feat: add office activity state machine"
```

### Task 3: Navigation Graph and Reservations

**Files:**
- Create: `src/work/officeNavigation.js`
- Test: `src/work/officeNavigation.test.js`

**Interfaces:**
- Produces: `OFFICE_NODES`, `findOfficeRoute(fromId, toId)`, `getFacing(fromId, toId)`, `claimAnchor(reservations, anchorId, ownerId)`, `releaseAnchor(reservations, anchorId, ownerId)`.

- [ ] **Step 1: Write route and reservation tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { claimAnchor, findOfficeRoute, getFacing } from "./officeNavigation.js";

test("routes an employee through the aisle to the break area", () => {
  assert.deepEqual(findOfficeRoute("employee1-home", "break-1"), ["employee1-home", "employee1-exit", "aisle-upper", "aisle-lower", "break-1"]);
});

test("prevents two activities from owning the same anchor", () => {
  const first = claimAnchor({}, "break-1", "employee1");
  assert.equal(claimAnchor(first, "break-1", "employee2"), null);
});

test("faces the destination horizontally", () => {
  assert.equal(getFacing("employee1-exit", "aisle-upper"), "right");
  assert.equal(getFacing("employee2-exit", "aisle-upper"), "left");
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/work/officeNavigation.test.js`

Expected: FAIL because the navigation module does not exist.

- [ ] **Step 3: Implement a fixed graph and breadth-first search**

Define percentage coordinates for five homes, five desk exits, two aisle nodes, two break seats, four chat anchors, and one meeting anchor. Use breadth-first search over explicit `neighbors` arrays. Return `[]` for unknown or disconnected nodes. Do not use random pixel movement.

- [ ] **Step 4: Run tests**

Run: `node --test src/work/officeNavigation.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeNavigation.js src/work/officeNavigation.test.js
git commit -m "feat: add office navigation routes"
```

### Task 4: Deterministic Activity Scheduler

**Files:**
- Create: `src/work/officeScheduler.js`
- Test: `src/work/officeScheduler.test.js`

**Interfaces:**
- Consumes: reducer state and profile personalities.
- Produces: `chooseOfficeEvent({ state, profiles, random, now })`, `buildConversationSession({ memberIds, anchorId, now, random })`, `MODE_WEIGHTS`.

- [ ] **Step 1: Write scheduler tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildConversationSession, chooseOfficeEvent } from "./officeScheduler.js";

const fixtureState = (mode) => ({
  mode,
  reservations: {},
  characters: Object.fromEntries(["boss", "employee1", "employee2", "employee3", "employee4"].map((id) => [id, {
    slotId: id,
    phase: "idle",
    activity: "idle",
    conversationId: "",
    positionNode: `${id}-home`,
  }])),
});

const fixtureProfiles = () => Object.fromEntries(["boss", "employee1", "employee2", "employee3", "employee4"].map((id) => [id, {
  id,
  name: id,
  personality: id === "employee1" ? "外向、贪吃" : "自律",
}]));

test("rest mode can choose a concrete meal activity", () => {
  const event = chooseOfficeEvent({ state: fixtureState("rest"), profiles: fixtureProfiles(), random: () => 0.35, now: 1000 });
  assert.equal(event.activity, "eating");
  assert.match(event.meal, /bento|rice|noodles|sandwich/);
});

test("never schedules a busy character into another group", () => {
  const state = fixtureState("free");
  state.characters.employee1.conversationId = "existing";
  const event = chooseOfficeEvent({ state, profiles: fixtureProfiles(), random: () => 0.82, now: 1000 });
  assert.ok(!event.memberIds?.includes("employee1"));
});

test("creates unique isolated session ids", () => {
  const a = buildConversationSession({ memberIds: ["employee1", "employee2"], anchorId: "chat-1", now: 1000, random: () => 0.1 });
  const b = buildConversationSession({ memberIds: ["employee3", "employee4"], anchorId: "chat-2", now: 1001, random: () => 0.2 });
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.transcript, b.transcript);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/work/officeScheduler.test.js`

Expected: FAIL because the scheduler module does not exist.

- [ ] **Step 3: Implement mode and personality weights**

Use exact base weights:

```js
export const MODE_WEIGHTS = {
  focus: { working: 72, slacking: 5, eating: 8, gaming: 3, chatting: 12 },
  free: { working: 35, slacking: 16, eating: 14, gaming: 10, chatting: 25 },
  rest: { working: 8, slacking: 22, eating: 28, gaming: 16, chatting: 26 },
};
```

Apply small keyword modifiers for `外向`, `社恐`, `自律`, `贪吃`, `游戏`, and `话多`. Choose only idle or working characters whose current activity may be interrupted. Reserve a break seat before returning an eating event and reserve a chat anchor before returning a conversation event.

- [ ] **Step 4: Run tests**

Run: `node --test src/work/officeScheduler.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeScheduler.js src/work/officeScheduler.test.js
git commit -m "feat: schedule concrete office activities"
```

### Task 5: Isolated Conversation API

**Files:**
- Create: `src/work/officeConversationApi.js`
- Test: `src/work/officeConversationApi.test.js`

**Interfaces:**
- Consumes: `parseConfigs`, `STORAGE_KEY`, one conversation session, and its member profiles.
- Produces: `getOfficeEndpoint(storage)`, `buildOfficeConversationMessages(session, profileMap, relationships)`, `parseOfficeConversationReply(raw, session)`, `requestOfficeConversationTurn(options)`, `getOfficeFallbackReply(session, profileMap)`.

- [ ] **Step 1: Write isolation and validation tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficeConversationMessages, parseOfficeConversationReply } from "./officeConversationApi.js";

test("includes only current-session members and transcript", () => {
  const session = { id: "group-a", memberIds: ["a", "b"], topic: "午饭", transcript: [{ speakerId: "a", text: "吃什么" }], requestSequence: 3 };
  const messages = buildOfficeConversationMessages(
    session,
    { a: { name: "甲" }, b: { name: "乙" }, c: { name: "丙", persona: "不应出现" } },
    { inside: { charA: "a", charB: "b", type: "同事" }, outside: { charA: "a", charB: "c", type: "旧友" } },
  );
  const text = JSON.stringify(messages);
  assert.match(text, /甲/);
  assert.match(text, /乙/);
  assert.match(text, /同事/);
  assert.doesNotMatch(text, /丙|不应出现/);
  assert.doesNotMatch(text, /旧友/);
});

test("rejects foreign speakers and mismatched conversation ids", () => {
  const session = { id: "group-a", memberIds: ["a", "b"], requestSequence: 3 };
  assert.equal(parseOfficeConversationReply('{"conversationId":"group-b","requestSequence":3,"speakerId":"a","text":"错组"}', session), null);
  assert.equal(parseOfficeConversationReply('{"conversationId":"group-a","requestSequence":3,"speakerId":"c","text":"外人"}', session), null);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/work/officeConversationApi.test.js`

Expected: FAIL because the API module does not exist.

- [ ] **Step 3: Implement endpoint selection and strict JSON responses**

The system prompt must require exactly:

```json
{"conversationId":"group-a","requestSequence":3,"speakerId":"a","text":"一句简短自然的职场对话","end":false}
```

Send only the current member profiles, relationships whose two endpoints are both current members, and the last 12 entries from that session. Validate all five keys, trim text to 80 Chinese characters, reject non-members, and return `null` for stale IDs or sequences. `requestOfficeConversationTurn` accepts `fetchImpl` and `signal`, so tests do not make network calls. A failed request returns `getOfficeFallbackReply` for that session only.

- [ ] **Step 4: Run tests**

Run: `node --test src/work/officeConversationApi.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/officeConversationApi.js src/work/officeConversationApi.test.js
git commit -m "feat: isolate office conversation sessions"
```

### Task 6: Chibi and Office Visual Assets

**Files:**
- Create: `src/work/officeAssets.js`
- Test: `src/work/officeAssets.test.js`
- Create: `public/work-office-assets/office-bg.png`
- Create: `public/work-office-assets/chibi/boss-f-01.png` through `boss-f-04.png`
- Create: `public/work-office-assets/chibi/boss-m-01.png` through `boss-m-04.png`
- Create: `public/work-office-assets/chibi/employee-f-01.png` through `employee-f-04.png`
- Create: `public/work-office-assets/chibi/employee-m-01.png` through `employee-m-04.png`

**Interfaces:**
- Produces: `OFFICE_CHIBIS`, `getOfficeChibi(id, kind)`, `getActivityFrame(activity, phase)`.

- [ ] **Step 1: Write the manifest completeness test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { access } from "node:fs/promises";
import { OFFICE_CHIBIS } from "./officeAssets.js";

test("ships all sixteen categorized chibi atlases", async () => {
  assert.equal(OFFICE_CHIBIS.length, 16);
  for (const [kind, gender] of [["boss", "female"], ["boss", "male"], ["employee", "female"], ["employee", "male"]]) {
    assert.equal(OFFICE_CHIBIS.filter((item) => item.kind === kind && item.gender === gender).length, 4);
  }
  await Promise.all(OFFICE_CHIBIS.map((item) => access(new URL(`../../public${item.src}`, import.meta.url))));
});
```

- [ ] **Step 2: Verify the test fails before assets exist**

Run: `node --test src/work/officeAssets.test.js`

Expected: FAIL because the manifest or PNG files do not exist.

- [ ] **Step 3: Generate the background using the imagegen skill**

Use the built-in image generation path and save the final project asset to `public/work-office-assets/office-bg.png` with this prompt:

```text
Use case: stylized-concept
Asset type: portrait 9:16 mobile office game background without characters or UI
Primary request: bright low-saturation contemporary office, one premium boss desk at top, four employee desks in a 2 by 2 grid, central walking aisle, small shared break counter with two seats, visible meal pickup shelf, clean premium composition
Style: soft 2.5D Japanese game illustration, delicate linework, matte shading
Palette: warm white, fog gray, pale oak, sage green, dusty blue, muted coral, tiny champagne gold accents
Constraints: no people, no labels, no text, no UI, every desk and route unobstructed, mobile portrait framing
Avoid: black and gold theme, heavy wood, photorealism, gradients, clutter, watermark
```

- [ ] **Step 4: Generate 16 transparent 3x3 atlases**

For each required filename, invoke the imagegen skill with a distinct hair, outfit, and color description while preserving this exact frame grid:

```text
Create one consistent full-body cute anime chibi office character as a precise 3 by 3 sprite atlas on a perfectly flat solid #00ff00 chroma-key background. Equal cells, centered character, identical scale and identity in every cell. Row 1: idle, walk step 1 facing left, walk step 2 facing left. Row 2: typing at a computer, handling a paper document, slacking with a phone. Row 3: eating a visible meal with utensils, playing a handheld game, talking with one hand gesture. Clean low-saturation 2.5D illustration, crisp edges, no text, no shadow, no watermark. Do not use #00ff00 in the character.
```

After each sequential image generation call, remove chroma key from the newest generated image. Set `TARGET_PATH` to the current required filename before running:

```bash
SOURCE_PATH="$(find "$HOME/.codex/generated_images" -type f -name '*.png' -print0 | xargs -0 ls -t | head -1)"
TARGET_PATH="public/work-office-assets/chibi/boss-f-01.png"
python "${CODEX_HOME:-$HOME/.codex}/skills/.system/imagegen/scripts/remove_chroma_key.py" --input "$SOURCE_PATH" --out "$TARGET_PATH" --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

Repeat with `TARGET_PATH` set in this order: `boss-f-01.png` through `boss-f-04.png`, `boss-m-01.png` through `boss-m-04.png`, `employee-f-01.png` through `employee-f-04.png`, and `employee-m-01.png` through `employee-m-04.png`. Generate one image immediately before each command so the newest file is unambiguous.

Validate each PNG has an alpha channel, transparent corners, all nine occupied cells, and no clipped hair or props.

- [ ] **Step 5: Implement the manifest**

Each item has `{ id, name, kind, gender, src }`. `getActivityFrame` maps `idle` to cell 0, walking step to cells 1 and 2, working variants to cells 3 and 4, slacking to 5, eating to 6, gaming to 7, and chatting to 8. Right-facing walking mirrors the sprite with CSS rather than duplicating files.

- [ ] **Step 6: Run tests and commit**

Run: `node --test src/work/officeAssets.test.js && npm test`

Expected: all tests PASS.

```bash
git add src/work/officeAssets.js src/work/officeAssets.test.js public/work-office-assets
git commit -m "feat: add animated office chibi assets"
```

### Task 7: Office Scene and Concrete Activity Rendering

**Files:**
- Create: `src/work/OfficeCharacter.jsx`
- Create: `src/work/OfficeScene.jsx`
- Create: `src/work/office.css`

**Interfaces:**
- Consumes: office reducer state, profile assignments, and asset manifest.
- Produces: `<OfficeScene state={state} assignments={assignments} onSlotSelect={fn} />` and `<OfficeCharacter character={stateCharacter} assignment={assignment} conversation={session} />`.

- [ ] **Step 1: Build `OfficeCharacter` with explicit activity markup**

Render a fixed-size character layer with `data-slot`, `data-phase`, `data-activity`, and `data-facing`. Include:

```jsx
<div className="office-character-name">{assignment.profile.name || "NPC"}</div>
<div className="office-character-sprite" style={frameStyle}></div>
{character.activity === "eating" && <div className={`office-meal meal-${character.props.meal}`}><i className="food"></i><i className="utensil"></i><i className="steam"></i></div>}
{character.activity === "slacking" && <div className={`office-slack-prop prop-${character.props.slackProp}`}></div>}
{character.activity === "gaming" && <div className="office-game-screen"></div>}
{bubble && <div className="office-speech-bubble">{bubble.text}</div>}
<div className="office-character-status"><i></i>{character.status}</div>
```

Use route-node coordinates for `left` and `top`. Advance the atlas frame through CSS custom properties. Mirror only the sprite for right-facing movement; keep name, props, and bubbles unmirrored.

- [ ] **Step 2: Build `OfficeScene`**

Render the generated office background as the scene base, then add semantic furniture hit areas, meal reduction stages, five characters, and independent conversation bubble layers. Sort character layers by current Y coordinate so lower walkers visually pass in front of upper furniture.

- [ ] **Step 3: Add distinct animation rules**

Define these named keyframes in `office.css`: `office-walk-bob`, `office-type`, `office-paper`, `office-phone-tap`, `office-game-tap`, `office-eat-bite`, `office-meal-steam`, `office-talk`, `office-listen`, and `office-bubble-in`. Use `prefers-reduced-motion` to disable movement interpolation while preserving final positions and state changes.

- [ ] **Step 4: Verify the CSS parses in the production build**

Run: `npm run build`

Expected: Vite exits 0 and emits `dist/index.html`.

- [ ] **Step 5: Commit**

```bash
git add src/work/OfficeCharacter.jsx src/work/OfficeScene.jsx src/work/office.css
git commit -m "feat: render animated office activities"
```

### Task 8: Work App Lifecycle, Assignments, Timer, and API Effects

**Files:**
- Create: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: all Tasks 1-7 modules.
- Produces: default export `<WorkAppScreen onClose={fn} />`.

- [ ] **Step 1: Initialize persistent reducer state**

Read profiles and assignments once, restore `ccatOfficeStateV1`, and use `useReducer(officeReducer, initialState)`. Persist serializable state after reducer changes. Tick at 250 ms and evaluate the scheduler on a randomized 4-8 second cadence.

- [ ] **Step 2: Implement timer and global mode controls**

Render the exact labels `认真干活`, `自由行动`, `休息一下`, and `开会`. Dispatch `SET_MODE` for the first three. `开会` selects all currently available characters, reserves `meeting-1`, opens one isolated session, and routes visitors to it.

- [ ] **Step 3: Implement assignment and chibi selectors**

The `员工` tab opens a full-height selector with one boss row and four employee rows. Each row selects a role and one compatible built-in chibi. Missing roles remain `NPC`. Reject duplicate assignment of the same stored profile to two slots and show the existing slot name in the selector.

Each row also provides an image upload control and a URL field. Read uploaded `image/*` files as data URLs; accept only `https://`, `http://`, or `data:image/` values in the URL field. Store the selected built-in ID or `customAssetSrc` in `ccatOfficeAssignmentsV1`. On image load failure, clear the custom source and fall back to the selected built-in chibi without changing the assigned profile.

- [ ] **Step 4: Run independent conversation effects**

Keep `Map<conversationId, AbortController>` in a ref. For every active session that is ready for a turn and not in flight, increment only its `requestSequence`, call `requestOfficeConversationTurn`, validate the response against the current session, queue its bubble, and schedule the next turn. Closing one session aborts only its controller.

- [ ] **Step 5: Recover activity completion**

When an activity deadline expires, start a return route for meals and conversations, clear visible food after the eating loop, and restore work or idle only after `FINISH_RETURN`. Work, slack, and game sessions that occur at a home desk can transition without a route.

- [ ] **Step 6: Build and commit**

Run: `npm test && npm run build`

Expected: all tests PASS and build exits 0.

```bash
git add src/work/WorkAppScreen.jsx src/work/office.css
git commit -m "feat: add live office simulation screen"
```

### Task 9: App Integration and Regression Test

**Files:**
- Modify: `src/App.jsx`
- Create: `src/App.work.test.js`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `WorkAppScreen`.
- Produces: opening the existing `工作` icon renders the office and the back button closes it.

- [ ] **Step 1: Write the failing integration source test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("./App.jsx", import.meta.url), "utf8");

test("opens the dedicated animated Work app", () => {
  assert.match(app, /import WorkAppScreen from "\.\/work\/WorkAppScreen\.jsx"/);
  assert.match(app, /const isWork = app\.title === "工作"/);
  assert.match(app, /if \(isWork\) return <WorkAppScreen onClose=\{onClose\} \/>/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/App.work.test.js`

Expected: FAIL because `App.jsx` does not yet import or route the Work screen.

- [ ] **Step 3: Add the Work route**

Import `WorkAppScreen` and `./work/office.css`. In `OpenedApp`, add `const isWork = app.title === "工作";` and return `<WorkAppScreen onClose={onClose} />` before the generic app page. Add `work-opening` to the shell class when the Work app is active so the phone stage uses transparent full-bleed overflow rules.

- [ ] **Step 4: Run integration and full tests**

Run: `node --test src/App.work.test.js && npm test && npm run build`

Expected: all tests PASS and build exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.work.test.js src/styles.css
git commit -m "feat: open the animated office from Work"
```

### Task 10: Browser QA and Responsive Verification

**Files:**
- Create: `scripts/verify-office.mjs`
- Create: `docs/superpowers/qa/office-375x812.png`
- Create: `docs/superpowers/qa/office-390x844.png`

**Interfaces:**
- Produces: `npm run verify:office` and repeatable QA screenshots.

- [ ] **Step 1: Add the Playwright verifier**

The script must spawn Vite on `127.0.0.1:4173`, open the home screen, unlock if necessary, click the `工作` icon, and verify:

```js
import { chromium } from "playwright";

const expectCount = async (locator, expected) => {
  const actual = await locator.count();
  if (actual !== expected) throw new Error(`expected ${expected} elements, received ${actual}`);
};

const browser = await chromium.launch();
for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => { Math.random = () => 0.35; });
  await page.goto("http://127.0.0.1:4173/ai-roleplay-phone/");
  const unlock = page.getByRole("button", { name: "上划解锁" });
  if (await unlock.count()) await unlock.click();
  await page.getByRole("button", { name: "工作" }).click();
  await page.getByText("工作剩余").waitFor();
  await page.getByRole("button", { name: "休息一下" }).click();
  await page.locator(".office-meal").first().waitFor({ timeout: 20_000 });
  await expectCount(page.locator(".office-character"), 5);
  await expectCount(page.locator(".office-character-name"), 5);
  const screenshotPath = `docs/superpowers/qa/office-${viewport.width}x${viewport.height}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const nonBlank = await page.locator(".office-scene").screenshot().then((buffer) => buffer.length > 20_000);
  if (!nonBlank) throw new Error("office scene screenshot is blank");
  await page.close();
}
await browser.close();
```

Run the same assertions at 375x812 and 390x844. Check every name and bubble bounding box stays within `.office-scene` and does not overlap `.office-toolbar`.

- [ ] **Step 2: Add the package script**

Add `"verify:office": "node scripts/verify-office.mjs"` to `package.json`.

- [ ] **Step 3: Run QA and inspect both screenshots**

Run: `npm run verify:office`

Expected: exits 0 and writes both PNG files. Inspect with `view_image`; verify the generated background is visible, five characters are framed, food is visible in an eating state, walking direction is correct, and no text overlaps.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-office.mjs package.json package-lock.json docs/superpowers/qa
git commit -m "test: verify office layouts in browser"
```

### Task 11: Version, Pages Sync, Deployment, and Live Check

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Create: `scripts/sync-pages.mjs`
- Modify: `docs/.deploy-version`
- Modify: `docs/index.html`
- Replace: generated files under `docs/assets/`
- Copy: `public/work-office-assets/` into `docs/work-office-assets/`

**Interfaces:**
- Produces: `npm run deploy:pages`, version `0.2.95`, and a pushed `main` branch that GitHub Pages serves from `docs/`.

- [ ] **Step 1: Add a safe Pages sync script**

`scripts/sync-pages.mjs` must:

1. Read the version from `package.json`.
2. Remove and recreate only `docs/assets/`.
3. Copy `dist/assets/` to `docs/assets/`.
4. Copy `dist/index.html` to `docs/index.html`.
5. Recursively copy `dist/work-office-assets/` and `dist/worldbook-assets/` to their matching `docs/` directories.
6. Write the version plus a trailing newline to `docs/.deploy-version`.
7. Never delete `docs/superpowers/`.

Add `"deploy:pages": "npm run build && node scripts/sync-pages.mjs"` to `package.json`.

- [ ] **Step 2: Bump every version reference**

Change `package.json`, both package-lock version fields, `Ccat OS V0.2.94`, `?v=0.2.94` in `src/App.jsx`, and the worldbook CSS asset query to `0.2.95`. Change `docs/.deploy-version` through the sync script.

- [ ] **Step 3: Run final verification before deployment**

Run:

```bash
npm test
npm run build
npm run verify:office
npm run deploy:pages
git diff --check
```

Expected: tests PASS, Vite build exits 0, browser QA exits 0, `docs/.deploy-version` is `0.2.95`, and `git diff --check` prints nothing.

- [ ] **Step 4: Commit the release build**

```bash
git add package.json package-lock.json src/App.jsx src/styles.css scripts/sync-pages.mjs docs
git commit -m "Deploy V0.2.95"
```

- [ ] **Step 5: Push and verify the live site**

Run: `git push origin HEAD:main`

Expected: push succeeds.

Open `https://sy719427083-glitch.github.io/ai-roleplay-phone/`, hard refresh, open `工作`, and confirm the live page displays version `V0.2.95`, five characters, timer, concrete activity props, and independent group bubbles. Compare the deployed asset filenames in `docs/index.html` with the network-loaded filenames.
