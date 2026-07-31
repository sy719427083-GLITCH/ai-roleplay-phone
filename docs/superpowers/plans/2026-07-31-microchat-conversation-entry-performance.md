# Microchat Conversation Entry Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long microchat conversations open quickly by initially rendering only the most recent 120 messages while preserving access to every older message.

**Architecture:** Add a pure history-window helper in `messageState.js`, then have `MessageAppScreen` render the helper's recent slice and expand it in 120-message increments. Preserve the user's reading anchor by compensating for the chat list's scroll-height increase after older messages mount.

**Tech Stack:** React 19 hooks, JavaScript ES modules, Node test runner, Vite, Playwright mobile browser verification, GitHub Pages.

## Global Constraints

- Initial visible history is exactly 120 messages.
- Each “加载更早消息” action adds at most 120 older messages.
- Existing `ccatMessageState` data is never migrated, cleared, truncated, or rewritten into a reduced form.
- Sending, API conversation, transfers, recall, regenerate, continue, and proactive-message behavior remain unchanged.
- Loading older messages must preserve the current reading anchor.
- Do not add a third-party virtualization dependency.

---

### Task 1: Pure history window

**Files:**
- Modify: `src/messageState.js`
- Test: `src/messageState.test.js`

**Interfaces:**
- Consumes: a history value and requested visible count.
- Produces: `CHAT_HISTORY_PAGE_SIZE = 120` and `getVisibleChatHistory(history, visibleCount) -> { messages, hiddenCount }`.

- [ ] **Step 1: Write the failing tests**

Extend the `messageState.js` import in `src/messageState.test.js`, then add:

```js
test("returns only the recent chat history window", () => {
  const history = Array.from({ length: 250 }, (_, index) => ({ id: `m-${index}` }));
  const result = getVisibleChatHistory(history, CHAT_HISTORY_PAGE_SIZE);
  assert.equal(result.messages.length, 120);
  assert.equal(result.messages[0].id, "m-130");
  assert.equal(result.hiddenCount, 130);
});

test("expands chat history and safely handles invalid input", () => {
  const history = Array.from({ length: 250 }, (_, index) => ({ id: `m-${index}` }));
  assert.deepEqual(getVisibleChatHistory(history, 240), {
    messages: history.slice(10),
    hiddenCount: 10,
  });
  assert.deepEqual(getVisibleChatHistory(null), { messages: [], hiddenCount: 0 });
  assert.equal(getVisibleChatHistory(history, 0).messages.length, 120);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/messageState.test.js`

Expected: FAIL because `CHAT_HISTORY_PAGE_SIZE` and `getVisibleChatHistory` are not exported.

- [ ] **Step 3: Implement the minimal pure helper**

Add to `src/messageState.js`:

```js
export const CHAT_HISTORY_PAGE_SIZE = 120;

export function getVisibleChatHistory(history, visibleCount = CHAT_HISTORY_PAGE_SIZE) {
  const normalizedHistory = Array.isArray(history) ? history : [];
  const parsedCount = Math.floor(Number(visibleCount));
  const safeCount = Number.isFinite(parsedCount) && parsedCount > 0
    ? parsedCount
    : CHAT_HISTORY_PAGE_SIZE;
  const startIndex = Math.max(0, normalizedHistory.length - safeCount);
  return {
    messages: normalizedHistory.slice(startIndex),
    hiddenCount: startIndex,
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/messageState.test.js`

Expected: all `messageState` tests pass.

- [ ] **Step 5: Commit the pure helper**

```bash
git add src/messageState.js src/messageState.test.js
git commit -m "feat(messages): add recent history window helper"
```

---

### Task 2: Incremental chat rendering and stable scroll anchor

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Create: `src/App.message.performance.test.js`

**Interfaces:**
- Consumes: `CHAT_HISTORY_PAGE_SIZE` and `getVisibleChatHistory` from Task 1.
- Produces: recent-message rendering, `.chat-load-earlier`, and 120-message incremental expansion.

- [ ] **Step 1: Write a failing component contract test**

Create `src/App.message.performance.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("microchat renders recent history and exposes incremental older messages", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  assert.match(app, /useState\(CHAT_HISTORY_PAGE_SIZE\)/);
  assert.match(app, /getVisibleChatHistory\(history, visibleMessageCount\)/);
  assert.match(app, /setVisibleMessageCount\(\(current\) => current \+ CHAT_HISTORY_PAGE_SIZE\)/);
  assert.match(app, /加载更早消息（剩余 \{hiddenCount\} 条）/);
  assert.match(styles, /\.chat-load-earlier\s*\{/);
});
```

- [ ] **Step 2: Run the component contract test and verify RED**

Run: `node --test src/App.message.performance.test.js`

Expected: FAIL because the component does not yet use a visible history window.

- [ ] **Step 3: Add component state and scroll-anchor bookkeeping**

Update React imports to include `useLayoutEffect`. Import the two Task 1 exports from `messageState.js`. Add inside `MessageAppScreen`:

```js
const [visibleMessageCount, setVisibleMessageCount] = useState(CHAT_HISTORY_PAGE_SIZE);
const historyLoadAnchorRef = useRef(null);

const loadEarlierMessages = () => {
  const list = chatListRef.current;
  historyLoadAnchorRef.current = list
    ? { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop }
    : null;
  setVisibleMessageCount((current) => current + CHAT_HISTORY_PAGE_SIZE);
};

useLayoutEffect(() => {
  const anchor = historyLoadAnchorRef.current;
  const list = chatListRef.current;
  if (!anchor || !list) return;
  list.scrollTop = anchor.scrollTop + (list.scrollHeight - anchor.scrollHeight);
  historyLoadAnchorRef.current = null;
}, [visibleMessageCount, chatId]);
```

Reset `visibleMessageCount` to `CHAT_HISTORY_PAGE_SIZE` in both `openChat` before setting the new `chatId` and `closeChat` before clearing it.

- [ ] **Step 4: Render only the window and add the older-message control**

After resolving the full `history`, add:

```js
const { messages: visibleHistory, hiddenCount } = getVisibleChatHistory(history, visibleMessageCount);
```

At the top of `.chat-list`, add:

```jsx
{hiddenCount > 0 && (
  <button type="button" className="chat-load-earlier" onClick={loadEarlierMessages}>
    加载更早消息（剩余 {hiddenCount} 条）
  </button>
)}
```

Change only the message-row mapping from `history.map(...)` to `visibleHistory.map(...)`. Keep transfer lookup and all message actions on the full `history`.

- [ ] **Step 5: Style the control without changing chat layout**

Add near the chat-list styles:

```css
.chat-load-earlier {
  align-self: center;
  margin: 0 auto 14px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #7a7a80;
  font-size: 12px;
  line-height: 1.2;
}
```

- [ ] **Step 6: Verify focused and complete tests**

Run:

```bash
node --test src/messageState.test.js src/App.message.performance.test.js
npm test
```

Expected: focused tests pass; full suite reports zero failures.

- [ ] **Step 7: Run mobile performance verification**

Start production preview, seed one conversation with 2500 messages, open microchat, click that conversation, and measure through two animation frames. Assert:

```js
assert.equal(document.querySelectorAll(".chat-bubble-row").length, 120);
assert.ok(document.querySelector(".chat-load-earlier"));
assert.ok(entryDurationMs < 120);
```

Then click `.chat-load-earlier`, assert 240 message rows, and assert the first previously visible row stays at the same visual position within 2px.

- [ ] **Step 8: Commit the UI optimization**

```bash
git add src/App.jsx src/styles.css src/App.message.performance.test.js
git commit -m "perf(messages): render long chats incrementally"
```

---

### Task 3: Release, deploy, and verify V0.3.29

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/App.launcher.test.js`
- Update generated Pages assets under `docs/`

**Interfaces:**
- Consumes: the completed incremental chat renderer.
- Produces: public GitHub Pages release `0.3.29`.

- [ ] **Step 1: Change release expectations first and verify RED**

Update `src/App.launcher.test.js` expectations from `0.3.28` to `0.3.29`.

Run: `node --test src/App.launcher.test.js`

Expected: FAIL because production version markers remain `0.3.28`.

- [ ] **Step 2: Update release markers**

Change only current release markers to `0.3.29` in:

- root version fields in `package.json` and `package-lock.json`;
- `worldbookAsset` and visible `Ccat OS V0.3.29` in `src/App.jsx`;
- worldbook atlas query in `src/styles.css`.

- [ ] **Step 3: Generate and verify the release**

Run:

```bash
npm test
npm run build
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: 63 or more tests pass, production build succeeds, Pages synchronization passes, and diff check is clean.

- [ ] **Step 4: Commit and push**

Stage only tracked release files, the newly generated `docs/assets/index-*.js` and `docs/assets/index-*.css`, while preserving user-owned untracked `artifacts/` and `designs/`.

```bash
git commit -m "chore(release): publish faster microchat entry 0.3.29"
git push origin main
```

- [ ] **Step 5: Verify GitHub Pages and the public app**

Wait for the `Deploy GitHub Pages` workflow for the release SHA. Verify the live JS/CSS hashes match `docs/assets`, the bundle includes `Ccat OS V0.3.29`, and the remote `main` SHA matches local `HEAD`.

Repeat the 2500-message mobile test against the public URL. Expected: exactly 120 initial message rows, entry under 120ms, 240 rows after one older-message load, stable scroll anchor, and normal back navigation.

