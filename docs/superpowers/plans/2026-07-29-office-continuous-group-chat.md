# Work APP Continuous Group Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build finite, non-repeating 2–4 person office conversations with API continuation, a stationary host, approaching guests, compact horizontal bubbles, and immediate release into other activities when dialogue ends.

**Architecture:** Keep API parsing and history validation in `officeConversation.js`, add pure gathering geometry in `officeConversationLayout.js`, and move asynchronous batch playback into a focused `useOfficeConversation.js` hook. `useOfficeSimulation.js` remains responsible for scene movement and replaces a completed conversation with a fresh non-chat plan.

**Tech Stack:** React 18 hooks, Vite 6, Node `node:test`, Playwright browser QA, CSS, GitHub Pages `docs/` publishing.

## Global Constraints

- Every conversation has 2–4 distinct assigned profiles.
- The first participant is the host and must stay at the position occupied when gathering starts.
- Guests move to distinct nearby points; fixed `chat-1` through `chat-4` points are not used for conversation gathering.
- Bubble width is 112px, approximately two 50px avatars plus spacing, and must remain visually compact on 375px and 390px viewports.
- API batches contain 2–6 turns and `shouldContinue`; one conversation is limited to 3 batches.
- Dialogue never loops and no normalized line may repeat within one conversation.
- A speaker cannot take two consecutive turns, including across batch boundaries.
- API failure produces one unique local closing batch and then ends the conversation.
- Completed conversation participants are released into a fresh non-chat activity plan.
- Preserve A/B modes, the 10-second manual Me rule, exact activity labels including `摸鱼ing` and `刷抖音`, project management, employee management, and countdown behavior.
- Do not modify or add the user's untracked files under `artifacts/cover-alignment/` or `designs/`.

---

### Task 1: Parse and request bounded continuation batches

**Files:**
- Modify: `src/work/officeConversation.js`
- Modify: `src/work/officeConversation.test.js`

**Interfaces:**
- Consumes: existing participant profiles and API configuration.
- Produces: `normalizeOfficeLine(value)`, `parseOfficeConversation(content, participants, options)`, `generateOfficeConversation({ apiState, context, fetchImpl })`, and `createLocalConversation(options)` returning `{ id, participantIds, turns, shouldContinue, batchIndex, startsAt, endsAt }`.

- [ ] **Step 1: Write failing parser tests for continuation, history de-duplication, and speaker alternation**

```js
test("parses continuation metadata and removes repeated history", () => {
  const result = parseOfficeConversation(JSON.stringify({
    shouldContinue: true,
    turns: [
      { speakerId: "character:c2", text: "进度不错！" },
      { speakerId: "character:c2", text: "我继续调整配色。" },
      { speakerId: "character:c1", text: "我看完再告诉你。" },
    ],
  }), participants, {
    now: 1_000,
    history: [{ speakerId: "character:c1", text: "进度不错" }],
    batchIndex: 2,
  });
  assert.equal(result.shouldContinue, true);
  assert.equal(result.batchIndex, 2);
  assert.deepEqual(result.turns.map((turn) => turn.text), ["我继续调整配色。", "我看完再告诉你。"]);
});

test("rejects a batch that continues with the previous speaker", () => {
  assert.throws(() => parseOfficeConversation(JSON.stringify({
    shouldContinue: false,
    turns: [
      { speakerId: "character:c1", text: "我再补一句。" },
      { speakerId: "character:c2", text: "可以。" },
    ],
  }), participants, { history: [{ speakerId: "character:c1", text: "先这样处理。" }] }), /连续说话/);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test src/work/officeConversation.test.js`

Expected: FAIL because the current parser ignores `shouldContinue`, `batchIndex`, and `history`.

- [ ] **Step 3: Implement normalized de-duplication and bounded batch parsing**

```js
export const MAX_OFFICE_CONVERSATION_BATCHES = 3;

export function normalizeOfficeLine(value) {
  return cleanLine(value).toLocaleLowerCase("zh-CN").replace(/[\s，。！？、,.!?：:；;“”‘’（）()\-—]/g, "");
}

export function parseOfficeConversation(content, participants, {
  now = Date.now(), history = [], batchIndex = 1,
} = {}) {
  const profiles = participantProfiles(participants);
  const known = new Set(profiles.map((item) => item.id));
  const parsed = stripJson(content);
  const seen = new Set(history.map((turn) => normalizeOfficeLine(turn.text)).filter(Boolean));
  const turns = [];
  let lastSpeakerId = history.at(-1)?.speakerId || "";
  for (const raw of Array.isArray(parsed.turns) ? parsed.turns : []) {
    const turn = { speakerId: raw?.speakerId, text: cleanLine(raw?.text) };
    const key = normalizeOfficeLine(turn.text);
    if (!known.has(turn.speakerId) || !key || seen.has(key)) continue;
    if (turn.speakerId === lastSpeakerId) throw new Error("办公室聊天不能由同一人物连续说话");
    turns.push(turn);
    seen.add(key);
    lastSpeakerId = turn.speakerId;
    if (turns.length === 6) break;
  }
  if (getDistinctConversationIds(turns.map((turn) => turn.speakerId), known).length < 2) throw new Error("办公室聊天至少需要两名人物");
  return {
    id: `chat:${now}:${batchIndex}`,
    participantIds: profiles.map((item) => item.id).slice(0, 4),
    turns,
    shouldContinue: Boolean(parsed.shouldContinue) && batchIndex < MAX_OFFICE_CONVERSATION_BATCHES,
    batchIndex,
    startsAt: now,
    endsAt: now + turns.length * 6_500,
  };
}
```

- [ ] **Step 4: Add history to the API prompt and make local fallback terminal**

```js
export async function generateOfficeConversation({ apiState, context, fetchImpl = fetch }) {
  const profiles = participantProfiles(context.participants);
  const content = await requestWithFailover(apiState, [
    { role: "system", content: "你在扮演办公室角色。只返回 JSON：{\"shouldContinue\":布尔值,\"turns\":[{\"speakerId\":\"已知ID\",\"text\":\"自然中文短句\"}]}。仅使用已知ID，2到6句，每句不超过42字；不能复述 history；同一人物不能连续说话；话题自然结束时 shouldContinue=false。" },
    { role: "user", content: JSON.stringify({ participants: profiles.map(profilePrompt), project: context.projectContext || "", time: new Date(context.now || Date.now()).toISOString(), history: context.history || [], batchIndex: context.batchIndex || 1 }) },
  ], fetchImpl, OFFICE_CONVERSATION_TIMEOUT_MS);
  return parseOfficeConversation(content, profiles, context);
}
```

Update `createLocalConversation` to accept `history` and `batchIndex`, filter lines through `normalizeOfficeLine`, alternate speakers, and always return `shouldContinue: false`.

- [ ] **Step 5: Run focused and full conversation tests**

Run: `node --test src/work/officeConversation.test.js src/work/officeState.test.js`

Expected: PASS with no repeated normalized lines, no consecutive speaker, and bounded continuation metadata.

- [ ] **Step 6: Commit the batch protocol**

```bash
git add src/work/officeConversation.js src/work/officeConversation.test.js
git commit -m "feat(work): add bounded AI conversation batches"
```

---

### Task 2: Keep a host in place and route guests nearby

**Files:**
- Create: `src/work/officeConversationLayout.js`
- Create: `src/work/officeConversationLayout.test.js`
- Modify: `src/work/officeNavigation.js`
- Modify: `src/work/officeNavigation.test.js`
- Modify: `src/work/officeSimulation.js`
- Modify: `src/work/officeSimulation.test.js`

**Interfaces:**
- Consumes: `participantIds`, runtime `currentNodes`, and the existing viewport-aware pathfinder.
- Produces: `createConversationGatherLayout({ participantIds, currentNodes }) -> { hostId, targets }`; `createOfficeRoute` accepts optional `destinationPoint`.

- [ ] **Step 1: Write failing layout tests for 2–4 participants**

```js
test("keeps the first participant in place and gives guests distinct nearby targets", () => {
  const currentNodes = { a: { x: 24, y: 56 }, b: { x: 78, y: 56 }, c: { x: 22, y: 72 }, d: { x: 78, y: 72 } };
  const layout = createConversationGatherLayout({ participantIds: ["a", "b", "c", "d"], currentNodes });
  assert.equal(layout.hostId, "a");
  assert.deepEqual(layout.targets.a, currentNodes.a);
  assert.equal(new Set(["b", "c", "d"].map((id) => `${layout.targets[id].x}:${layout.targets[id].y}`)).size, 3);
  for (const id of ["b", "c", "d"]) {
    assert.ok(Math.abs(layout.targets[id].x - currentNodes.a.x) <= 11);
    assert.ok(Math.abs(layout.targets[id].y - currentNodes.a.y) <= 8);
  }
});
```

- [ ] **Step 2: Run layout tests and verify RED**

Run: `node --test src/work/officeConversationLayout.test.js src/work/officeNavigation.test.js src/work/officeSimulation.test.js`

Expected: FAIL because the layout module and point-based route do not exist and local plans still assign `chat-*` destinations.

- [ ] **Step 3: Implement compact gathering geometry**

```js
const GUEST_OFFSETS = Object.freeze([
  Object.freeze({ x: 9, y: 1 }),
  Object.freeze({ x: -9, y: 1 }),
  Object.freeze({ x: 0, y: 7 }),
]);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createConversationGatherLayout({ participantIds = [], currentNodes = {} } = {}) {
  const ids = [...new Set(participantIds)].slice(0, 4);
  if (ids.length < 2 || !currentNodes[ids[0]]) return { hostId: null, targets: {} };
  const hostId = ids[0];
  const host = currentNodes[hostId];
  const targets = { [hostId]: host };
  ids.slice(1).forEach((id, index) => {
    const offset = GUEST_OFFSETS[index];
    targets[id] = { x: clamp(host.x + offset.x, 8, 92), y: clamp(host.y + offset.y, 14, 88) };
  });
  return { hostId, targets };
}
```

- [ ] **Step 4: Allow routes to end at a runtime point**

```js
export function createOfficeRoute({ from, destination, destinationPoint, viewport }) {
  const goal = destinationPoint || getOfficePoint(destination);
  if (!from || !goal || !viewport) return [];
  const geometry = getOfficeGeometry(viewport);
  const path = planOfficePath({ start: from, goal, viewport, obstacles: geometry.obstacles });
  return path.slice(1).map((point, index) => ({
    point,
    durationMs: getSegmentDuration(path[index], point, viewport),
    facing: getSegmentFacing(path[index], point),
  }));
}
```

- [ ] **Step 5: Stop assigning fixed chat points in local plans**

Remove the `chatters.forEach(... destination: \`chat-${index + 1}\`)` mutation. Preserve participant order so `participantIds[0]` is the host. Replace the old fixed-point test with assertions that chat destinations do not start with `chat-`.

- [ ] **Step 6: Run the focused movement tests**

Run: `node --test src/work/officeConversationLayout.test.js src/work/officeNavigation.test.js src/work/officeSimulation.test.js`

Expected: PASS for 2-, 3-, and 4-person layouts, point-based routes, and no fixed chat destinations.

- [ ] **Step 7: Commit gathering behavior**

```bash
git add src/work/officeConversationLayout.js src/work/officeConversationLayout.test.js src/work/officeNavigation.js src/work/officeNavigation.test.js src/work/officeSimulation.js src/work/officeSimulation.test.js
git commit -m "feat(work): gather guests around a stationary chat host"
```

---

### Task 3: Play finite batches and release participants

**Files:**
- Create: `src/work/officeConversationFlow.js`
- Create: `src/work/officeConversationFlow.test.js`
- Create: `src/work/useOfficeConversation.js`
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/useOfficeSimulation.test.js`

**Interfaces:**
- Consumes: Task 1 batches and Task 2 gathering targets.
- Produces: `appendConversationBatch(session, batch)`, `shouldRequestNextBatch(session)`, `isConversationComplete(session)`, and `useOfficeConversation({ ready, participants, projectContext, apiState, dispatch, onComplete })`.

- [ ] **Step 1: Write failing finite-flow tests**

```js
test("appends unique turns without looping and stops after three batches", () => {
  let session = createConversationSession();
  session = appendConversationBatch(session, { batchIndex: 1, shouldContinue: true, turns: [{ speakerId: "a", text: "第一句" }, { speakerId: "b", text: "第二句" }] });
  session = advanceConversationTurn(session);
  session = advanceConversationTurn(session);
  assert.equal(shouldRequestNextBatch(session), true);
  session = appendConversationBatch(session, { batchIndex: 2, shouldContinue: true, turns: [{ speakerId: "a", text: "第三句" }, { speakerId: "b", text: "第四句" }] });
  session = appendConversationBatch(session, { batchIndex: 3, shouldContinue: true, turns: [{ speakerId: "a", text: "第五句" }, { speakerId: "b", text: "第六句" }] });
  assert.equal(session.shouldContinue, false);
  assert.equal(session.turns.filter((turn) => turn.text === "第一句").length, 1);
});
```

- [ ] **Step 2: Run flow tests and verify RED**

Run: `node --test src/work/officeConversationFlow.test.js src/work/useOfficeSimulation.test.js`

Expected: FAIL because finite session helpers do not exist and the current player uses modulo to loop.

- [ ] **Step 3: Implement the pure finite session state machine**

```js
export const createConversationSession = () => ({ turns: [], turnIndex: 0, batchIndex: 0, shouldContinue: false, requesting: false, complete: false });

export function appendConversationBatch(session, batch) {
  const turns = [...session.turns, ...batch.turns];
  return { ...session, turns, batchIndex: batch.batchIndex, shouldContinue: Boolean(batch.shouldContinue) && batch.batchIndex < 3, requesting: false };
}

export const currentConversationTurn = (session) => session.turns[session.turnIndex] || null;
export const shouldRequestNextBatch = (session) => session.shouldContinue && !session.requesting && session.turnIndex >= Math.max(0, session.turns.length - 2);
export const isConversationComplete = (session) => session.turns.length > 0 && session.turnIndex >= session.turns.length && !session.shouldContinue && !session.requesting;
export const advanceConversationTurn = (session) => ({ ...session, turnIndex: session.turnIndex + 1 });
```

- [ ] **Step 4: Implement `useOfficeConversation` with prefetch and one terminal fallback**

The hook must start only when `ready` is true, call `generateOfficeConversation` with `history: session.turns` and `batchIndex: session.batchIndex + 1`, schedule each visible turn for 6,500ms, request near the penultimate turn, call `createLocalConversation` once on API failure, and invoke `onComplete()` exactly once after the final turn. It must never use `% conversation.turns.length`.

- [ ] **Step 5: Integrate arrival readiness and conversation completion into the simulation**

In `useOfficeSimulation.js`:

```js
const [conversationReadyId, setConversationReadyId] = useState("");
const gatherLayout = useMemo(() => createConversationGatherLayout({
  participantIds: plan?.conversation?.participantIds || [],
  currentNodes: Object.fromEntries(occupants.map((item) => [item.profile.id, characterStates[item.profile.id]?.node || getOfficePoint(`${item.slotId}-home`)])),
}), [plan?.conversation?.id]);
```

The host receives no movement segments. Each guest route receives `destinationPoint: gatherLayout.targets[profileId]`. Count guest arrivals for the current plan and set `conversationReadyId` only when all guests arrive.

On completion, build a fresh local plan with a seed suffix `:after-chat:<timestamp>`, set `conversation: null`, replace any newly selected `chatting` activity with `working` at that profile's home point, then `setPlan` and dispatch `SET_SCENE_PLAN`.

- [ ] **Step 6: Add source and pure behavior tests**

Assert that `useOfficeSimulation.js` imports the new hook/layout, contains no modulo-based turn loop, starts conversation only from `conversationReadyId`, and releases to a plan with `conversation: null`. Test that manual Me interruption still cancels a conversation and that a one-person office still cannot start one.

- [ ] **Step 7: Run flow, simulation, and full unit tests**

Run: `node --test src/work/officeConversationFlow.test.js src/work/useOfficeSimulation.test.js src/work/officeSimulation.test.js src/work/officeConversation.test.js && npm test`

Expected: all tests pass; the full count is greater than the V0.3.21 baseline of 171.

- [ ] **Step 8: Commit finite playback and release**

```bash
git add src/work/officeConversationFlow.js src/work/officeConversationFlow.test.js src/work/useOfficeConversation.js src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js
git commit -m "feat(work): continue and finish office conversations"
```

---

### Task 4: Make bubbles compact horizontal bars and verify the interaction

**Files:**
- Modify: `src/work/office.css`
- Modify: `src/work/OfficeCharacter.jsx`
- Modify: `src/work/workScreen.test.js`
- Modify: `scripts/verify-work-office.mjs`
- Modify: `artifacts/work-office-qa/office-375x812.png`
- Modify: `artifacts/work-office-qa/office-390x844.png`

**Interfaces:**
- Consumes: current speaker bubble from Task 3.
- Produces: a 112px compact bubble and browser evidence for host/guest movement, non-repetition, finite completion, and 2–4 participant API payloads.

- [ ] **Step 1: Write a failing CSS contract test**

```js
test("chat bubbles are compact two-avatar horizontal bars", () => {
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(styles, /\.office-character-bubble\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*112px[^}]*white-space:\s*nowrap/s);
  assert.doesNotMatch(styles, /\.office-character-bubble\s*\{[^}]*max-width:\s*126px/s);
  const character = readFileSync("src/work/OfficeCharacter.jsx", "utf8");
  assert.match(character, /is-near-left/);
  assert.match(character, /is-near-right/);
});
```

- [ ] **Step 2: Run the UI contract and verify RED**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL because the current bubble uses variable `min-width`/`max-width` and wraps text.

- [ ] **Step 3: Implement the compact horizontal bubble**

```css
.office-character-bubble {
  position: relative;
  box-sizing: border-box;
  width: 112px;
  margin-bottom: 7px;
  overflow: hidden;
  border: 1px solid rgba(96,112,151,.14);
  border-radius: 999px;
  background: rgba(255,255,255,.97);
  color: #31394b;
  padding: 7px 10px;
  font-size: 9px;
  font-weight: 650;
  line-height: 1.35;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 8px 22px rgba(57,72,111,.16);
}
.office-character.is-near-left .office-character-bubble { transform: translateX(28px); }
.office-character.is-near-right .office-character-bubble { transform: translateX(-28px); }
```

In `OfficeCharacter.jsx`, add `is-near-left` when `node.x < 16` and `is-near-right` when `node.x > 84`. Keep the existing movement, activity, and bubble classes unchanged. This shifts only edge bubbles and prevents the 112px bar from being clipped.

- [ ] **Step 4: Extend browser QA with a deterministic conversation**

Seed a current 3-person conversation in `ccatWorkOfficeV1`, intercept two API batches, and record all returned texts. Assert:

```js
assert.equal(await page.locator(".office-character-bubble").evaluate((node) => Math.round(node.getBoundingClientRect().width)), 112);
assert.deepEqual(new Set(observedBubbleTexts).size, observedBubbleTexts.length, "dialogue never repeats");
assert.equal(requestedHistories[1].length > 0, true, "continuation receives prior history");
assert.deepEqual(await readCharacterAnchor(host), hostBefore, "host stays in place");
assert.notDeepEqual(await readCharacterAnchor(guest), guestBefore, "guest walks to host");
```

Return `shouldContinue: false` from the second batch and wait until the participant activity labels no longer all equal `聊天中`.

- [ ] **Step 5: Run build and both mobile viewport QA**

Run: `npm run build && npm run verify:work`

Expected: `Work office browser QA passed for 375x812 and 390x844` and updated screenshots show the compact bubble without clipping.

- [ ] **Step 6: Commit visual and browser verification**

```bash
git add src/work/office.css src/work/OfficeCharacter.jsx src/work/workScreen.test.js scripts/verify-work-office.mjs artifacts/work-office-qa/office-375x812.png artifacts/work-office-qa/office-390x844.png
git commit -m "test(work): verify compact finite group chats"
```

---

### Task 5: Publish and verify V0.3.22

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Modify: `docs/.deploy-version`
- Modify: generated files under `docs/assets/` and `docs/index.html`

**Interfaces:**
- Consumes: all completed feature tasks.
- Produces: synchronized V0.3.22 production assets and a verified GitHub Pages release.

- [ ] **Step 1: Update release markers to `0.3.22`**

Change package versions, the visible `Ccat OS V0.3.22` label, release marker tests, deploy marker, and versioned atlas URL together.

- [ ] **Step 2: Run the full release gate**

Run:

```bash
node --test src/App.launcher.test.js
npm test
npm run build
npm run verify:work
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: all unit tests pass, both phone viewports pass, and `docs/` matches `dist/`.

- [ ] **Step 3: Commit the release bundle**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css docs
git commit -m "chore(release): publish continuous group chat 0.3.22"
```

- [ ] **Step 4: Merge, push, and verify the live assets**

Fast-forward the approved implementation branch into `main`, push `main`, then poll `https://sy719427083-glitch.github.io/ai-roleplay-phone/?release=0.3.22` until the HTML references the new asset hashes. Fetch the deployed JS and CSS and verify `Ccat OS V0.3.22`, `shouldContinue`, the 3-batch cap, and `width:112px` are present. Confirm `git ls-remote origin refs/heads/main` equals local `HEAD`.

- [ ] **Step 5: Remove the completed feature worktree**

After live verification, remove the feature worktree, prune worktree metadata, and delete the merged local feature branch. Leave all unrelated worktrees and untracked user files untouched.
