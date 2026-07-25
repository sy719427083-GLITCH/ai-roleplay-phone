# Work Project Countdown Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind signed work contracts to a real-time persistent countdown and credit the exact project reward to the wallet only after the user explicitly claims it.

**Architecture:** Canonical numeric contract fields feed a persistent project state with absolute start/end timestamps. Pure timer derivation computes `idle`, `running`, and `finished` from `Date.now()`, while a shared wallet store performs idempotent reward credits before the project batch is cleared. `WorkAppScreen` owns the project state so signing, the office navigation tile, the countdown detail page, and reward claiming stay synchronized.

**Tech Stack:** React 19, JavaScript ES modules, browser `localStorage`, Node test runner, Playwright, Vite.

## Global Constraints

- Reality-based timing continues while the app, tab, or browser is closed.
- Three days displays as cumulative hours from `72:00:00`; completion clamps to `00:00:00`.
- The wallet is credited only after an explicit click on “点击领取报酬”.
- The same signed project can never increase wallet balance more than once.
- A successful claim clears the completed batch; the next project-management entry generates five new API contracts.
- Secondary API remains first, main API remains the one-time fallback, and sample contracts remain forbidden.
- Preserve all unrelated tracked and untracked workspace changes.

---

## File Map

- Create `src/walletStore.js`: shared safe wallet reads/writes, normal transactions, and idempotent project income.
- Create `src/walletStore.test.js`: wallet normalization, write failure, and duplicate reward tests.
- Create `src/work/workProjectContract.js`: canonical numeric contract normalization, legacy parsing, and display labels.
- Create `src/work/workProjectContract.test.js`: numeric and legacy contract tests.
- Modify `src/work/workProjectApi.js` and `src/work/workProjectApi.test.js`: require numeric API fields and derive display strings.
- Modify `src/work/workProjectState.js` and `src/work/workProjectState.test.js`: timestamps, migration, signing, and batch clearing.
- Create `src/work/workProjectTimer.js` and `src/work/workProjectTimer.test.js`: pure countdown state and formatting.
- Create `src/work/ProjectCountdownView.jsx`: countdown detail UI.
- Modify `src/work/ProjectManagementPreview.jsx`: use lifted state and timestamped signing.
- Modify `src/work/WorkAppScreen.jsx`, `src/work/workScreen.test.js`, and `src/work/office.css`: live navigation countdown, detail page, and reward claim.
- Modify `src/App.jsx`: consume shared wallet helpers without changing wallet UI.
- Modify `scripts/verify-work-projects-preview.mjs` and `scripts/verify-work-office.mjs`: seed canonical project data.
- Create `scripts/verify-work-project-reward.mjs`: end-to-end countdown and wallet settlement QA.
- Modify `package.json`: include the new reward browser verification command.

---

### Task 1: Shared Idempotent Wallet Store

**Files:**
- Create: `src/walletStore.js`
- Create: `src/walletStore.test.js`
- Modify: `src/App.jsx:284-323,506-513,4678-4745`

**Interfaces:**
- Produces: `WALLET_STORAGE_KEY`, `readWalletData(storage?)`, `writeWalletData(wallet, storage?)`, `applyWalletTransaction({ type, amount, desc, id? }, storage?)`, `addWalletIncomeOnce({ id, amount, desc }, storage?)`.
- `addWalletIncomeOnce` returns `{ wallet, credited, duplicate }`; it throws if storage write fails.

- [ ] **Step 1: Write failing wallet tests**

```js
test("credits a project reward exactly once", () => {
  const storage = createMemoryStorage({ roleplayWallet: JSON.stringify({ balance: 100, transactions: [] }) });
  const first = addWalletIncomeOnce({ id: "work:p1:start", amount: 2100, desc: "项目报酬 · 真实项目" }, storage);
  const second = addWalletIncomeOnce({ id: "work:p1:start", amount: 2100, desc: "项目报酬 · 真实项目" }, storage);
  assert.equal(first.wallet.balance, 2200);
  assert.equal(first.credited, true);
  assert.equal(second.wallet.balance, 2200);
  assert.equal(second.duplicate, true);
  assert.equal(second.wallet.transactions.length, 1);
});

test("throws without inventing success when wallet persistence fails", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.throws(() => addWalletIncomeOnce({ id: "work:p1:start", amount: 10, desc: "项目报酬" }, storage), /钱包写入失败/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test src/walletStore.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `walletStore.js`.

- [ ] **Step 3: Implement the shared wallet store**

```js
export const WALLET_STORAGE_KEY = "roleplayWallet";

export function readWalletData(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(WALLET_STORAGE_KEY) || "{}");
    return {
      balance: Number(parsed.balance) || 0,
      transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    };
  } catch {
    return { balance: 0, transactions: [] };
  }
}

export function addWalletIncomeOnce({ id, amount, desc }, storage = window.localStorage) {
  const wallet = readWalletData(storage);
  if (wallet.transactions.some((item) => item.id === id)) return { wallet, credited: false, duplicate: true };
  const value = Number(amount);
  if (!id || !Number.isFinite(value) || value <= 0) throw new Error("报酬金额无效");
  const next = { balance: wallet.balance + value, transactions: [{ id, type: "add", amount: value, desc, date: formatWalletDate() }, ...wallet.transactions] };
  try { storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(next)); } catch { throw new Error("钱包写入失败，请重试"); }
  return { wallet: next, credited: true, duplicate: false };
}
```

Also move the existing generic transaction implementation into this module, preserve its boolean return contract, import the shared symbols at the top of `App.jsx`, remove the duplicate constant/helpers, and replace the wallet page initializer with `useState(readWalletData)` plus persistence through `writeWalletData`.

- [ ] **Step 4: Run wallet and existing app tests**

Run: `node --test src/walletStore.test.js src/App.test.js src/messageLogic.test.js`

Expected: all selected tests PASS and existing message transfer behavior remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/walletStore.js src/walletStore.test.js src/App.jsx
git commit -m "refactor(wallet): share idempotent wallet storage"
```

---

### Task 2: Canonical Numeric Project Contracts

**Files:**
- Create: `src/work/workProjectContract.js`
- Create: `src/work/workProjectContract.test.js`
- Modify: `src/work/workProjectApi.js`
- Modify: `src/work/workProjectApi.test.js`

**Interfaces:**
- Produces: `normalizeWorkProject(project, id)`, `formatProjectDuration(hours)`, `formatProjectAmount(amount)`.
- Canonical project shape: `{ id, name, durationHours, amountValue, duration, amount, description, difficulty }`.
- `workProjectApi.parseWorkProjectResponse(content, revision)` continues returning five canonical projects.

- [ ] **Step 1: Write failing canonicalization tests**

```js
test("normalizes numeric API fields and derives labels", () => {
  assert.deepEqual(normalizeWorkProject({
    name: "真实项目", durationHours: 72, amountValue: 2100,
    description: "项目内容", difficulty: "中等",
  }, "api-1-1"), {
    id: "api-1-1", name: "真实项目", durationHours: 72, amountValue: 2100,
    duration: "3 天", amount: "¥2,100", description: "项目内容", difficulty: "中等",
  });
});

test("migrates supported legacy duration and money labels", () => {
  const migrated = normalizeWorkProject({ id: "old", name: "旧合同", duration: "48 小时", amount: "¥2,100.50", description: "内容", difficulty: "简单" }, "old");
  assert.equal(migrated.durationHours, 48);
  assert.equal(migrated.amountValue, 2100.5);
});
```

Update API tests so each generated item supplies `durationHours` and `amountValue`; assert that zero, negative, non-finite, fractional hours, or missing numeric fields rejects the entire response.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test src/work/workProjectContract.test.js src/work/workProjectApi.test.js`

Expected: FAIL because the canonicalization module and numeric parsing do not exist.

- [ ] **Step 3: Implement canonical normalization and API schema**

```js
export function formatProjectDuration(hours) {
  return hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小时`;
}

export function formatProjectAmount(value) {
  return `¥${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function normalizeWorkProject(project, id = project?.id) {
  const durationHours = Number.isInteger(project?.durationHours)
    ? project.durationHours
    : parseLegacyDuration(project?.duration);
  const amountValue = Number.isFinite(Number(project?.amountValue))
    ? Number(project.amountValue)
    : parseLegacyAmount(project?.amount);
  if (!id || durationHours <= 0 || amountValue <= 0 || !DIFFICULTIES.has(project?.difficulty)) return null;
  return { id, name: clean(project.name, 24), durationHours, amountValue: Math.round(amountValue * 100) / 100,
    duration: formatProjectDuration(durationHours), amount: formatProjectAmount(amountValue),
    description: clean(project.description, 100), difficulty: project.difficulty };
}
```

Change the system prompt contract to:

```json
{"projects":[{"name":"项目名称","durationHours":72,"amountValue":2100,"description":"具体项目内容","difficulty":"简单|中等|困难"}]}
```

Map all five items through `normalizeWorkProject(project, `api-${revision + 1}-${index + 1}`)` and throw `API 返回的项目时间或金额无效` if any result is null.

- [ ] **Step 4: Run canonical and API tests**

Run: `node --test src/work/workProjectContract.test.js src/work/workProjectApi.test.js`

Expected: all selected tests PASS, including secondary-to-main fallback.

- [ ] **Step 5: Commit**

```bash
git add src/work/workProjectContract.js src/work/workProjectContract.test.js src/work/workProjectApi.js src/work/workProjectApi.test.js
git commit -m "feat(work): normalize project time and rewards"
```

---

### Task 3: Persistent Project Timing State

**Files:**
- Modify: `src/work/workProjectState.js`
- Modify: `src/work/workProjectState.test.js`
- Create: `src/work/workProjectTimer.js`
- Create: `src/work/workProjectTimer.test.js`

**Interfaces:**
- `restoreWorkProjectState(raw, now = Date.now())` migrates legacy projects and timestamps.
- `startWorkProject(state, projectId, now = Date.now())` records ISO `startedAt` and `endsAt`.
- `clearCompletedWorkProject(state, now = Date.now())` returns an empty state only after completion.
- `getActiveWorkProject(state)` returns the signed project or null.
- `deriveProjectTimer(state, now = Date.now())` returns `{ status, remainingSeconds, display, project }`.
- `createProjectRewardId(state)` returns `work-project:<projectId>:<startedAt>` or null.

- [ ] **Step 1: Extend state tests and write timer tests first**

```js
test("signing records absolute project timestamps", () => {
  const started = startWorkProject(readyState, "api-1-1", Date.parse("2026-07-25T00:00:00Z"));
  assert.equal(started.startedAt, "2026-07-25T00:00:00.000Z");
  assert.equal(started.endsAt, "2026-07-28T00:00:00.000Z");
});

test("formats cumulative hours and clamps completion to zero", () => {
  assert.deepEqual(deriveProjectTimer(runningState, startMs), {
    status: "running", remainingSeconds: 259200, display: "72:00:00", project: runningState.projects[0],
  });
  assert.equal(deriveProjectTimer(runningState, endMs).display, "00:00:00");
  assert.equal(deriveProjectTimer(runningState, endMs + 1000).status, "finished");
});
```

Add cases for `idle`, last second, clearing before completion returning the same object, clearing after completion, safe serialized fields, unsigned legacy migration, and signed legacy migration beginning at the provided `now`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test src/work/workProjectState.test.js src/work/workProjectTimer.test.js`

Expected: FAIL for missing timestamp fields and missing timer module.

- [ ] **Step 3: Implement absolute timing and pure derivation**

```js
export function startWorkProject(state, projectId, now = Date.now()) {
  const project = state.projects.find((item) => item.id === projectId);
  if (state.startedProjectId || !project) return state;
  const startedAt = new Date(now).toISOString();
  const endsAt = new Date(now + project.durationHours * 60 * 60 * 1000).toISOString();
  return { ...state, startedProjectId: projectId, startedAt, endsAt };
}

export function formatRemainingTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function deriveProjectTimer(state, now = Date.now()) {
  const project = getActiveWorkProject(state);
  if (!project || !state.endsAt) return { status: "idle", remainingSeconds: null, display: "--:--:--", project: null };
  const remainingSeconds = Math.max(0, Math.ceil((Date.parse(state.endsAt) - now) / 1000));
  return { status: remainingSeconds === 0 ? "finished" : "running", remainingSeconds, display: formatRemainingTime(remainingSeconds), project };
}
```

Normalize every restored project through `normalizeWorkProject`. Add `startedAt` and `endsAt` to empty, replacement, restoration, and serialization shapes. For a valid signed legacy state with no timestamps, derive both from the supplied `now`; reject inconsistent or invalid timestamp pairs.

- [ ] **Step 4: Run state and timer tests**

Run: `node --test src/work/workProjectState.test.js src/work/workProjectTimer.test.js`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/work/workProjectState.js src/work/workProjectState.test.js src/work/workProjectTimer.js src/work/workProjectTimer.test.js
git commit -m "feat(work): persist real project countdowns"
```

---

### Task 4: Countdown UI and Reward Claim Flow

**Files:**
- Create: `src/work/ProjectCountdownView.jsx`
- Modify: `src/work/ProjectManagementPreview.jsx`
- Modify: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- `ProjectManagementPreview({ onBack, projectState, onProjectStateChange })` uses lifted state.
- `ProjectCountdownView({ timer, endsAt, claiming, error, onBack, onOpenProjects, onClaim })` renders the detail page.
- `WorkAppScreen` owns and persists project state and calls `addWalletIncomeOnce` for completed work.

- [ ] **Step 1: Write source contract tests for the new UI flow**

```js
test("work screen exposes a real project countdown and explicit reward claim", () => {
  for (const text of ["项目倒计时", "工作结束", "点击领取报酬", "暂无进行中的项目"]) {
    assert.match(screen, new RegExp(text));
  }
  assert.match(screen, /deriveProjectTimer/);
  assert.match(screen, /addWalletIncomeOnce/);
  assert.match(screen, /setInterval/);
  assert.doesNotMatch(screen, /02:45:30|工作倒计时|暂时留空/);
});
```

Update project preview source tests to require lifted `projectState`, `onProjectStateChange`, and timestamped `startWorkProject` use.

- [ ] **Step 2: Run UI contract tests and verify failure**

Run: `node --test src/work/workScreen.test.js src/work/ProjectManagementPreview.test.js`

Expected: FAIL because the placeholder timer and hard-coded `02:45:30` still exist.

- [ ] **Step 3: Lift project state into `WorkAppScreen`**

Initialize once with `restoreWorkProjectState(localStorage.getItem(WORK_PROJECTS_STORAGE_KEY))`, persist with `serializeWorkProjectState`, and pass the state/setter into `ProjectManagementPreview`. Refactor its generation and signing handlers to call `onProjectStateChange(nextState)` instead of owning a separate cache state.

- [ ] **Step 4: Add the ticking timer and claim handler**

```js
const [now, setNow] = useState(() => Date.now());
useEffect(() => {
  const timerId = window.setInterval(() => setNow(Date.now()), 1000);
  return () => window.clearInterval(timerId);
}, []);
const projectTimer = deriveProjectTimer(projectState, now);

function claimReward() {
  if (claiming || projectTimer.status !== "finished") return;
  setClaiming(true);
  setRewardError("");
  try {
    addWalletIncomeOnce({
      id: createProjectRewardId(projectState),
      amount: projectTimer.project.amountValue,
      desc: `项目报酬 · ${projectTimer.project.name}`,
    });
    setProjectState((current) => clearCompletedWorkProject(current, Date.now()));
  } catch (error) {
    setRewardError(error instanceof Error ? error.message : "报酬领取失败，请重试");
  } finally {
    setClaiming(false);
  }
}
```

Persist the cleared state explicitly through the existing state effect. Treat a duplicate reward result as success and still clear the completed batch.

- [ ] **Step 5: Render the three navigation states and detail page**

Use a non-nested control structure:

```jsx
<div className={`work-timer-nav is-${projectTimer.status}`}>
  <button type="button" onClick={() => setView("timer")} aria-label="项目倒计时">
    <Timer size={27} />
    <strong>{projectTimer.display}</strong>
    <span>{projectTimer.status === "finished" ? "工作结束" : "项目倒计时"}</span>
  </button>
  {projectTimer.status === "finished" && (
    <button type="button" className="work-reward-claim-small" onClick={claimReward} disabled={claiming}>点击领取报酬</button>
  )}
</div>
```

Render `ProjectCountdownView` for `view === "timer"`; show project name, `amount`, `duration`, formatted end time, large countdown, and the claim action. In idle state provide a button that sets `view` to `projects`.

- [ ] **Step 6: Add responsive visual styles**

Add `.work-timer-nav`, `.work-project-countdown-page`, `.work-countdown-clock`, `.work-countdown-meta`, `.work-countdown-status`, `.work-reward-claim`, and `.work-reward-error`. Keep the center navigation footprint compatible with 375px width, use tabular numerals for the clock, give every action at least 44px height, and make the finished claim text visibly clickable without nesting buttons.

- [ ] **Step 7: Run UI and full unit tests**

Run: `npm test`

Expected: all tests PASS; the old timer placeholder assertions are removed and no other app behavior regresses.

- [ ] **Step 8: Commit**

```bash
git add src/work/ProjectCountdownView.jsx src/work/ProjectManagementPreview.jsx src/work/ProjectManagementPreview.test.js src/work/WorkAppScreen.jsx src/work/workScreen.test.js src/work/office.css
git commit -m "feat(work): claim rewards after project countdown"
```

---

### Task 5: Browser QA for Countdown, Claim, and New Batch

**Files:**
- Modify: `scripts/verify-work-projects-preview.mjs`
- Modify: `scripts/verify-work-office.mjs`
- Create: `scripts/verify-work-project-reward.mjs`
- Modify: `package.json`
- Create or update: `artifacts/work-project-reward/*.png`

**Interfaces:**
- Consumes canonical project fields, `ccatWorkProjectsV1`, and `roleplayWallet`.
- Produces command `npm run verify:work-reward`.

- [ ] **Step 1: Update existing browser fixtures**

Change every mocked API project and cached project to include numeric fields:

```js
durationHours: (index + 3) * 24,
amountValue: Number(`${batch}${index + 1}00`),
```

Keep existing assertions for five contracts, API fallback, cache reuse, signed lock, office routing, and image loading.

- [ ] **Step 2: Write the reward browser flow**

Seed one finished signed project and a wallet balance of 100:

```js
localStorage.setItem("ccatWorkProjectsV1", JSON.stringify({
  projects: [finishedProject, ...fourOtherProjects],
  startedProjectId: finishedProject.id,
  startedAt: "2026-07-24T00:00:00.000Z",
  endsAt: "2026-07-25T00:00:00.000Z",
  revision: 1, source: "main", generatedAt: "2026-07-24T00:00:00.000Z",
}));
localStorage.setItem("roleplayWallet", JSON.stringify({ balance: 100, transactions: [] }));
```

For both viewports, verify:

1. Office center tile shows `00:00:00`, “工作结束”, and “点击领取报酬”.
2. Countdown detail displays the signed project and same finished state.
3. Clicking claim returns the tile to `--:--:--` and removes the claim control.
4. Wallet storage becomes balance 2200 with exactly one `项目报酬 · <name>` transaction.
5. Reopening work and wallet does not add a second transaction.
6. Entering project management calls the mocked project endpoint and displays five new contracts.
7. Capture finished and claimed screenshots at 375×812 and 390×844.

- [ ] **Step 3: Add the command and run all verification**

Add:

```json
"verify:work-reward": "node scripts/verify-work-project-reward.mjs"
```

Run:

```bash
npm test
npm run build
node scripts/verify-work-projects-preview.mjs
node scripts/verify-work-office.mjs
npm run verify:work-reward
git diff --check
```

Expected: unit tests, production build, all three browser flows, and diff check PASS. The existing unresolved-at-build `hero-worldbook-atlas.png` warning may appear; no new build warning is accepted.

- [ ] **Step 4: Visually inspect screenshots**

Open the four screenshots and confirm clocks are not clipped, the 44px claim target is reachable, the finished and idle states are distinct, and the office furniture remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/verify-work-projects-preview.mjs scripts/verify-work-office.mjs scripts/verify-work-project-reward.mjs artifacts/work-project-reward
git commit -m "test(work): verify countdown reward settlement"
```

---

### Task 6: Final Branch Verification

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Confirms the branch is ready for the selected integration method.

- [ ] **Step 1: Run fresh verification from the committed branch**

```bash
npm test
npm run build
npm run verify:work-reward
git diff --check
git status --short --branch
```

Expected: all commands PASS and the feature worktree is clean. Unrelated user-owned untracked files may remain only in the main workspace and must not be staged.

- [ ] **Step 2: Review the final commit series**

Run: `git log --oneline --max-count=8`

Expected: separate commits for shared wallet storage, canonical project data, persistent countdown state, UI reward flow, and browser QA.
