# Work APP Project-Specific Office Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic office work labels with ten deterministic, project-relevant tasks, suppress every work/print state when no project is running, and end printing after 15–30 seconds.

**Architecture:** Add a pure `officeProjectTasks.js` policy module that decides whether work is allowed, scores the ten approved task labels from the active contract, and normalizes scene activities. Pass the full active project through local and AI planning, then add a runtime expiry path for printing so it no longer waits for the 15-minute scene interval. Keep rendering, pathfinding, chat gathering, and project contract flows unchanged.

**Tech Stack:** React 19, JavaScript ES modules, Node `node:test`, Vite 6, Playwright 1.61, GitHub Pages.

## Global Constraints

- Work activities are allowed only while `deriveProjectTimer(...).status === "running"`.
- The exact task labels are: `做 PPT`, `做表格`, `写项目方案`, `整理项目资料`, `收集项目数据`, `分析项目数据`, `制作项目报表`, `核对项目预算`, `编写交付文档`, `检查项目成果`.
- No running project means no generic work, reporting, project-task, printing, or print-wait state; the workstation fallback label is `待命中`.
- Printing lasts from 15,000 through 30,000 milliseconds, remains single-user, and expires independently of the 15-minute scene interval.
- Use project contract data locally; do not add API calls.
- Preserve existing office art, layout, furniture, routes, chat bubbles, 2–4-person conversation rule, and 10-second manual Me release.
- Preserve user-owned untracked `artifacts/` and `designs/` files.

---

### Task 1: Build the pure project-task policy

**Files:**
- Create: `src/work/officeProjectTasks.js`
- Create: `src/work/officeProjectTasks.test.js`

**Interfaces:**
- Consumes: normalized project objects from `workProjectContract.js`, profile IDs, slot IDs, and office interval keys.
- Produces: `OFFICE_PROJECT_TASKS`, `hasRunningOfficeProject(project)`, `selectOfficeProjectTask({ project, profileId, intervalKey, usedLabels })`, `normalizeProjectOfficePlan(plan, { occupants, project, intervalKey, now })`, and `isOfficeWorkActivity(activity)`.

- [ ] **Step 1: Write failing policy tests**

Create `src/work/officeProjectTasks.test.js` with these cases:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICE_PROJECT_TASKS,
  hasRunningOfficeProject,
  normalizeProjectOfficePlan,
  selectOfficeProjectTask,
} from "./officeProjectTasks.js";

const project = {
  id: "p-data",
  name: "数据中台指标体系优化",
  description: "梳理指标口径并优化数据模型",
  scopeItems: ["收集业务数据", "制作管理看板", "输出分析报告"],
  deliverables: "数据报表、演示 PPT 与交付文档",
  acceptanceCriteria: "数据准确且通过验收",
};

const occupants = [
  { slotId: "boss", profile: { id: "me:1" } },
  { slotId: "employee1", profile: { id: "character:1" } },
];

test("exposes the ten approved concrete labels", () => {
  assert.deepEqual(OFFICE_PROJECT_TASKS.map((item) => item.label), [
    "做 PPT", "做表格", "写项目方案", "整理项目资料", "收集项目数据",
    "分析项目数据", "制作项目报表", "核对项目预算", "编写交付文档", "检查项目成果",
  ]);
});

test("requires a complete running project context", () => {
  assert.equal(hasRunningOfficeProject({ status: "running", project }), true);
  assert.equal(hasRunningOfficeProject({ status: "finished", project }), false);
  assert.equal(hasRunningOfficeProject({ status: "idle", project: null }), false);
});

test("selects a stable project-relevant task and diversifies coworkers", () => {
  const first = selectOfficeProjectTask({ project, profileId: "me:1", intervalKey: "2026-07-31:40" });
  const again = selectOfficeProjectTask({ project, profileId: "me:1", intervalKey: "2026-07-31:40" });
  const second = selectOfficeProjectTask({ project, profileId: "character:1", intervalKey: "2026-07-31:40", usedLabels: new Set([first.label]) });
  assert.deepEqual(again, first);
  assert.ok(OFFICE_PROJECT_TASKS.some((item) => item.label === first.label));
  assert.notEqual(second.label, first.label);
});

test("normalizes work labels from every contract field", () => {
  for (const [field, value, expected] of [
    ["name", "品牌演示", "做 PPT"],
    ["description", "建立预算测算", "核对项目预算"],
    ["scopeItems", ["分析经营数据"], "分析项目数据"],
    ["deliverables", "完整交付文档", "编写交付文档"],
    ["acceptanceCriteria", "检查成果并验收", "检查项目成果"],
  ]) {
    const focused = { ...project, name: "普通项目", description: "普通内容", scopeItems: ["普通工作"], deliverables: "普通文件", acceptanceCriteria: "通过" , [field]: value };
    const result = selectOfficeProjectTask({ project: focused, profileId: "me:1", intervalKey: "fixed" });
    assert.equal(result.label, expected, field);
  }
});

test("removes work and printing without a running project", () => {
  const plan = { characters: {
    "me:1": { activity: "working", label: "工作中", destination: "boss-home" },
    "character:1": { activity: "printing", label: "打印中", destination: "print-station" },
  }, conversation: null };
  const result = normalizeProjectOfficePlan(plan, { occupants, project: null, intervalKey: "idle", now: 1000 });
  for (const [id, slotId] of [["me:1", "boss"], ["character:1", "employee1"]]) {
    assert.equal(result.characters[id].activity, "idle");
    assert.equal(result.characters[id].label, "待命中");
    assert.equal(result.characters[id].destination, `${slotId}-home`);
  }
});

test("maps generic work and reporting to concrete project tasks", () => {
  const plan = { characters: {
    "me:1": { activity: "working", label: "工作中", destination: "rest-left" },
    "character:1": { activity: "reporting", label: "做报表", destination: "rest-right" },
  }, conversation: null };
  const result = normalizeProjectOfficePlan(plan, { occupants, project, intervalKey: "active", now: 1000 });
  for (const [id, slotId] of [["me:1", "boss"], ["character:1", "employee1"]]) {
    assert.equal(result.characters[id].activity, "working");
    assert.notEqual(result.characters[id].label, "工作中");
    assert.ok(OFFICE_PROJECT_TASKS.some((item) => item.label === result.characters[id].label));
    assert.equal(result.characters[id].destination, `${slotId}-home`);
  }
});
```

- [ ] **Step 2: Run the new test and observe RED**

Run:

```bash
node --test src/work/officeProjectTasks.test.js
```

Expected: FAIL because `officeProjectTasks.js` does not exist.

- [ ] **Step 3: Implement the policy module**

Create `src/work/officeProjectTasks.js` with:

```js
export const OFFICE_PROJECT_TASKS = Object.freeze([
  { id: "slides", label: "做 PPT", keywords: ["ppt", "演示", "汇报", "品牌", "设计", "展示"] },
  { id: "spreadsheet", label: "做表格", keywords: ["表格", "台账", "清单", "统计", "excel"] },
  { id: "proposal", label: "写项目方案", keywords: ["方案", "策划", "规划", "设计", "建设"] },
  { id: "materials", label: "整理项目资料", keywords: ["资料", "素材", "归档", "整理", "迁移"] },
  { id: "collect-data", label: "收集项目数据", keywords: ["采集", "收集", "调研", "数据源"] },
  { id: "analyze-data", label: "分析项目数据", keywords: ["分析", "指标", "趋势", "模型", "数据"] },
  { id: "report", label: "制作项目报表", keywords: ["报表", "看板", "报告", "可视化"] },
  { id: "budget", label: "核对项目预算", keywords: ["预算", "金额", "成本", "采购", "报价"] },
  { id: "deliverable", label: "编写交付文档", keywords: ["交付", "文档", "说明书", "手册"] },
  { id: "qa", label: "检查项目成果", keywords: ["验收", "检查", "测试", "质量", "校验"] },
]);

const WORK_ACTIVITY_IDS = new Set(["working", "reporting", "printing"]);

const hashString = (value) => {
  let hash = 2166136261;
  for (const character of String(value)) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
};

const projectText = (project) => [
  project?.name,
  project?.description,
  ...(Array.isArray(project?.scopeItems) ? project.scopeItems : []),
  project?.deliverables,
  project?.acceptanceCriteria,
].filter(Boolean).join(" ").toLocaleLowerCase("zh-CN");

export const hasRunningOfficeProject = (context) => Boolean(
  context?.status === "running" && context.project?.id && projectText(context.project),
);

export const isOfficeWorkActivity = (activity) => WORK_ACTIVITY_IDS.has(activity);

export function selectOfficeProjectTask({ project, profileId = "", intervalKey = "", usedLabels = new Set() }) {
  const text = projectText(project);
  const scored = OFFICE_PROJECT_TASKS.map((task, index) => ({
    ...task,
    score: task.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 12 : 0), 1)
      + ((hashString(`${project?.id}:${profileId}:${intervalKey}:${task.id}`) + index) % 7),
  })).sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return scored.find((task) => !usedLabels.has(task.label)) || scored[0];
}

export function normalizeProjectOfficePlan(plan, { occupants = [], project: projectContext = null, intervalKey = "", now = Date.now() } = {}) {
  const next = { ...plan, characters: Object.fromEntries(Object.entries(plan?.characters || {}).map(([id, item]) => [id, { ...item }])) };
  const running = hasRunningOfficeProject(projectContext);
  const usedLabels = new Set();
  for (const occupant of occupants) {
    const id = occupant.profile.id;
    const current = next.characters[id];
    if (!current || !isOfficeWorkActivity(current.activity)) continue;
    if (!running) {
      next.characters[id] = { ...current, activity: "idle", label: "待命中", destination: `${occupant.slotId}-home`, startsAt: current.startsAt ?? now };
      continue;
    }
    if (current.activity === "printing") continue;
    const task = selectOfficeProjectTask({ project: projectContext.project, profileId: id, intervalKey, usedLabels });
    usedLabels.add(task.label);
    next.characters[id] = { ...current, activity: "working", label: task.label, destination: `${occupant.slotId}-home` };
  }
  return next;
}
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
node --test src/work/officeProjectTasks.test.js
npm test
```

Expected: the focused tests pass; existing tests may fail only where they still assert generic `工作中`, identifying Task 2 integration points.

- [ ] **Step 5: Commit the policy module**

```bash
git add src/work/officeProjectTasks.js src/work/officeProjectTasks.test.js
git commit -m "feat(work): add project-specific task policy"
```

---

### Task 2: Integrate project gating into local, AI, cached, and fallback plans

**Files:**
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/officeSimulation.js`
- Modify: `src/work/officeScenePlan.js`
- Modify: `src/work/officeConversation.js`
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/officeSimulation.test.js`
- Modify: `src/work/officeScenePlan.test.js`
- Modify: `src/work/officeConversation.test.js`
- Modify: `src/work/useOfficeSimulation.test.js`

**Interfaces:**
- Consumes: Task 1 policy exports and `projectTimer` from `WorkAppScreen.jsx`.
- Produces: a `projectContext` object shaped as `{ status: "idle" | "running" | "finished", project: object | null }` through every planning and normalization boundary.

- [ ] **Step 1: Add failing integration tests**

Update existing test fixtures so they pass `projectContext: { status: "running", project }` when asserting work/printing. Add assertions that:

```js
const idlePlan = createLocalOfficePlan({ occupants, now, seed: "idle", projectContext: { status: "idle", project: null } });
assert.equal(Object.values(idlePlan.characters).some((item) => ["working", "reporting", "printing"].includes(item.activity)), false);
assert.equal(Object.values(idlePlan.characters).some((item) => item.label === "工作中" || item.label === "做报表" || item.label === "打印中"), false);

const activePlan = createLocalOfficePlan({ occupants, now, seed: "active", projectContext: { status: "running", project } });
assert.equal(Object.values(activePlan.characters).some((item) => item.label === "工作中"), false);
```

Add `officeScenePlan.test.js` coverage for orphan chat normalization with and without a running project. The expected fallback is a concrete project task for the running case and `{ activity: "idle", label: "待命中", destination: "<slot>-home" }` for the idle case.

Add source-contract assertions in `useOfficeSimulation.test.js` proving `allocateOfficeActivities` receives `projectContext`, and in `officeConversation.test.js` proving the full project object reaches the AI user payload while the chat topic still uses the project name.

- [ ] **Step 2: Run integration tests and observe RED**

```bash
node --test src/work/officeSimulation.test.js src/work/officeScenePlan.test.js src/work/officeConversation.test.js src/work/useOfficeSimulation.test.js
```

Expected: FAIL because the scheduler still treats `projectContext` as a string and generic fallbacks remain.

- [ ] **Step 3: Pass the active project object from the screen**

In `WorkAppScreen.jsx`, create:

```js
const officeProjectContext = useMemo(() => ({
  status: projectTimer.status,
  project: projectTimer.status === "running" ? projectTimer.project : null,
}), [projectTimer.status, projectTimer.project?.id]);
```

Pass `officeProjectContext` to `useOfficeSimulation`. For conversation text and the AI test payload, use `officeProjectContext.project?.name || ""` only where a human-readable topic string is required.

- [ ] **Step 4: Add idle as a valid desk state and gate local weights**

In `officeScenePlan.js`, add `idle` to `VALID_OFFICE_ACTIVITIES` and `OFFICE_DESK_ACTIVITIES`. Change `allocateOfficeActivities` to accept a third options object and normalize in this order:

```js
export function allocateOfficeActivities(plan, occupants = [], options = {}) {
  // existing destination and printer-capacity normalization
  const conversationSafe = normalizeOfficeConversation(next, occupants, options);
  return normalizeProjectOfficePlan(conversationSafe, {
    occupants,
    project: options.projectContext,
    intervalKey: options.intervalKey || plan?.id || "",
    now: options.now,
  });
}
```

Change orphan-chat fallback inside `normalizeOfficeConversation` to an intermediate `working` item; the final project normalizer then chooses a concrete task or `待命中`.

In `officeSimulation.js`:

- Set printing minutes to the equivalent millisecond-safe range through a dedicated helper, not the old `[3, 8]` minute definition.
- Remove `working`, `reporting`, and `printing` entries from the selected period weights when `hasRunningOfficeProject(projectContext)` is false; add `idle` with a practical base weight so an employee may remain at a workstation.
- Keep personality affinities and all non-work activities unchanged.
- Call `allocateOfficeActivities(plan, occupants, { projectContext, intervalKey, now: startsAt })`.
- Seed with a stable serialization of the project ID and revision-relevant contract text rather than `[object Object]`.

- [ ] **Step 5: Normalize AI and restored plans**

In `officeConversation.js`, keep the API scene vocabulary backward-compatible (`working`, `reporting`, `printing`, and non-work ids), but include this explicit instruction in the system prompt:

```text
没有进行中的项目时不要安排 working、reporting 或 printing；本地规则会把通用工作状态改成具体项目任务。
```

Send the normalized project contract object in the AI user payload as `project`, and continue sending `project.name` to conversation generation.

In every `allocateOfficeActivities(...)` call in `useOfficeSimulation.js`, pass:

```js
{ projectContext, intervalKey, now: Number(now) }
```

Include project status and ID in the hook plan key so starting or completing a project immediately replans without waiting for the 15-minute interval:

```js
const projectKey = `${projectContext?.status || "idle"}:${projectContext?.project?.id || "none"}`;
const key = `${getOfficeIntervalKey(new Date(now))}:${simulation.mode}:${projectKey}:${occupantKey}`;
```

Change default rendered states in `useOfficeSimulation.js` and `OfficeScene.jsx` from `working/工作中` to `idle/待命中`; planned concrete work states overwrite that default immediately.

- [ ] **Step 6: Run focused and full tests**

```bash
node --test src/work/officeProjectTasks.test.js src/work/officeSimulation.test.js src/work/officeScenePlan.test.js src/work/officeConversation.test.js src/work/useOfficeSimulation.test.js
npm test
```

Expected: all focused tests pass and the full suite reports zero failures; update stale test fixtures only when they intentionally represent a running project.

- [ ] **Step 7: Commit integration**

```bash
git add src/work/WorkAppScreen.jsx src/work/officeSimulation.js src/work/officeScenePlan.js src/work/officeConversation.js src/work/useOfficeSimulation.js src/work/OfficeScene.jsx src/work/*.test.js
git commit -m "feat(work): bind office work to active projects"
```

---

### Task 3: Expire printing after 15–30 seconds and persist the replacement plan

**Files:**
- Modify: `src/work/officeProjectTasks.js`
- Modify: `src/work/officeProjectTasks.test.js`
- Modify: `src/work/officeSimulation.js`
- Modify: `src/work/useOfficeSimulation.js`
- Modify: `src/work/useOfficeSimulation.test.js`

**Interfaces:**
- Consumes: normalized scene plans from Task 2.
- Produces: `OFFICE_PRINT_MIN_MS = 15_000`, `OFFICE_PRINT_MAX_MS = 30_000`, `getNextOfficePrintExpiry(plan, now)`, and a hook timer that replaces and persists expired printing.

- [ ] **Step 1: Write failing print-lifecycle tests**

Add:

```js
test("bounds printing to fifteen through thirty seconds", () => {
  assert.equal(OFFICE_PRINT_MIN_MS, 15_000);
  assert.equal(OFFICE_PRINT_MAX_MS, 30_000);
  for (let index = 0; index < 300; index += 1) {
    const plan = createLocalOfficePlan({ occupants, now, seed: `print-${index}`, projectContext: runningProject });
    for (const item of Object.values(plan.characters).filter((value) => value.activity === "printing")) {
      assert.ok(item.endsAt - item.startsAt >= OFFICE_PRINT_MIN_MS);
      assert.ok(item.endsAt - item.startsAt <= OFFICE_PRINT_MAX_MS);
    }
  }
});

test("returns only a future print expiry", () => {
  assert.equal(getNextOfficePrintExpiry({ characters: { a: { activity: "printing", endsAt: 900 } } }, 1000), null);
  assert.equal(getNextOfficePrintExpiry({ characters: { a: { activity: "printing", endsAt: 1200 }, b: { activity: "printing", endsAt: 1500 } } }, 1000), 1200);
});
```

Add a `useOfficeSimulation.test.js` source contract that asserts the hook owns a `printTimer`, clears it on cleanup, and dispatches `SET_SCENE_PLAN` after a print expiry.

- [ ] **Step 2: Run the tests and observe RED**

```bash
node --test src/work/officeProjectTasks.test.js src/work/officeSimulation.test.js src/work/useOfficeSimulation.test.js
```

Expected: FAIL because the print constants, expiry helper, and runtime timer are absent.

- [ ] **Step 3: Implement exact print duration and expiry lookup**

Export from `officeProjectTasks.js`:

```js
export const OFFICE_PRINT_MIN_MS = 15_000;
export const OFFICE_PRINT_MAX_MS = 30_000;

export function getNextOfficePrintExpiry(plan, now = Date.now()) {
  const expiries = Object.values(plan?.characters || {})
    .filter((item) => item?.activity === "printing" && Number(item.endsAt) > now)
    .map((item) => Number(item.endsAt));
  return expiries.length ? Math.min(...expiries) : null;
}
```

In `createLocalOfficePlan`, calculate printing duration directly in milliseconds:

```js
const durationMs = activity === "printing"
  ? OFFICE_PRINT_MIN_MS + Math.floor(random() * (OFFICE_PRINT_MAX_MS - OFFICE_PRINT_MIN_MS + 1))
  : minutes * 60_000;
```

- [ ] **Step 4: Add a dedicated runtime print timer**

In `useOfficeSimulation.js`, add `const printTimer = useRef(null)` and clear it on unmount and before rescheduling. Add an effect keyed by `plan?.id` and `projectKey`:

```js
useEffect(() => {
  window.clearTimeout(printTimer.current);
  const expiresAt = getNextOfficePrintExpiry(plan, Date.now());
  if (!expiresAt) return undefined;
  const expire = () => {
    const completedAt = Date.now();
    const intervalKey = getOfficeIntervalKey(new Date(completedAt));
    const seed = simulation.seed || createOfficeDailySeed(new Date(completedAt), companyName);
    const replacement = allocateOfficeActivities(createLocalOfficePlan({
      occupants,
      now: new Date(completedAt),
      seed: `${seed}:after-print:${completedAt}`,
      projectContext,
      previousPlan: plan,
    }), occupants, { projectContext, intervalKey, now: completedAt });
    setPlan(replacement);
    dispatch({ type: "SET_SCENE_PLAN", value: {
      dateKey: seed.split(":").at(-1), seed, intervalKey,
      plan: replacement, nextTransitionAt: replacement.endsAt,
    } });
  };
  printTimer.current = window.setTimeout(expire, Math.max(0, expiresAt - Date.now()));
  return () => window.clearTimeout(printTimer.current);
}, [plan?.id, projectKey]);
```

Before rendering a restored plan, detect an already expired printing entry. Generate the replacement synchronously through the same local-plan path so stale `打印中` never flashes on screen.

- [ ] **Step 5: Run focused and full tests**

```bash
node --test src/work/officeProjectTasks.test.js src/work/officeSimulation.test.js src/work/useOfficeSimulation.test.js
npm test
```

Expected: all tests pass with zero failures; print durations are always within 15–30 seconds.

- [ ] **Step 6: Commit print expiry**

```bash
git add src/work/officeProjectTasks.js src/work/officeProjectTasks.test.js src/work/officeSimulation.js src/work/useOfficeSimulation.js src/work/useOfficeSimulation.test.js
git commit -m "fix(work): shorten and expire office printing"
```

---

### Task 4: Add browser regression coverage and durable project rules

**Files:**
- Modify: `scripts/verify-work-office.mjs`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: the complete project-aware simulation from Tasks 1–3.
- Produces: reproducible mobile QA for active, absent, completed, cached, and short-print states.

- [ ] **Step 1: Extend the Playwright fixture**

Add one running project fixture whose contract includes data, PPT, budget, and delivery keywords. Assert that visible work labels belong to the approved ten labels and never equal `工作中`.

Add an idle fixture with cached `working`, `reporting`, and `printing` characters. Reopen Work APP and assert every cached work item becomes `待命中`, uses its own workstation, and no `.office-character` has `data-activity="printing"`.

Add a running-project fixture with a printer whose `endsAt` is 1.5 seconds in the future. Wait for expiry, assert the printer leaves `print-station`, the label changes from `打印中`, and persisted `ccatWorkOfficeV1.simulation.plan` contains no expired printer.

- [ ] **Step 2: Record the durable rule**

Append to `AGENTS.md` under the autonomous office section:

```markdown
- Office work is project-gated: only a running accepted project may produce printing or the ten approved concrete task labels. With no running project, all work/report/print states normalize to `待命中` at the assigned workstation. Printing lasts 15–30 seconds independently of the 15-minute scene interval, and expired cached printing must never render.
```

- [ ] **Step 3: Run browser QA at both required sizes**

```bash
npm run build
npm run verify:work
```

Expected: Vite build succeeds; Playwright reports success for 375×812 and 390×844, including active-project labels, no-project gating, print expiry, valid group chat, and manual Me behavior.

- [ ] **Step 4: Run the complete gate**

```bash
npm test
npm run build
npm run verify:work
```

Expected: zero test failures, successful production build, and both mobile QA sizes pass.

- [ ] **Step 5: Commit QA and rules**

```bash
git add scripts/verify-work-office.mjs AGENTS.md
git commit -m "test(work): verify project-gated office tasks"
```

---

### Task 5: Publish and verify V0.3.25

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/App.launcher.test.js`
- Modify: `src/styles.css`
- Modify: `scripts/sync-pages.mjs`
- Regenerate: `docs/index.html`
- Regenerate: `docs/assets/index-*.js`
- Regenerate: `docs/assets/index-*.css`

**Interfaces:**
- Consumes: verified implementation and browser QA.
- Produces: synchronized and publicly verified `Ccat OS V0.3.25` GitHub Pages release.

- [ ] **Step 1: Update every current release marker**

Set package versions, visible `Ccat OS V0.3.25`, launcher-test expectations, Pages deploy marker, and active versioned atlas URLs to `0.3.25`. Do not edit historical specs or plans that intentionally mention older versions.

- [ ] **Step 2: Run the release gate and generate Pages output**

```bash
npm test
npm run build
npm run verify:work
npm run deploy:pages
node --test scripts/pages-sync-contract.test.mjs
git diff --check
```

Expected: zero failures; `docs/index.html` references one current hashed JS bundle and one current hashed CSS bundle.

- [ ] **Step 3: Inspect generated artifacts**

```bash
rg -o "Ccat OS V0\.3\.25|做 PPT|做表格|写项目方案|待命中|打印中" docs/assets/index-*.js | sort -u
rg -o "hero-worldbook-atlas\.png\?v=0\.3\.25" docs/assets/index-*.css
```

Expected: the JS contains the release label and new task/status strings; the CSS contains the V0.3.25 atlas URL.

- [ ] **Step 4: Commit the release**

```bash
git add package.json package-lock.json src/App.jsx src/App.launcher.test.js src/styles.css scripts/sync-pages.mjs docs
git commit -m "chore(release): publish project-specific office tasks 0.3.25"
```

- [ ] **Step 5: Integrate and push main**

Fast-forward the implementation branch into `main`, preserving the user's untracked assets. Push `main` and confirm:

```bash
git ls-remote origin refs/heads/main
```

Expected: remote `main` equals the local V0.3.25 release commit.

- [ ] **Step 6: Verify GitHub Pages and live assets**

Wait for the `Deploy GitHub Pages` workflow for the V0.3.25 SHA to succeed. Fetch `https://sy719427083-glitch.github.io/ai-roleplay-phone/?release=0.3.25` with cache-busting, extract the live JS/CSS paths, and verify:

- the JS contains `Ccat OS V0.3.25`, all ten approved task labels, `待命中`, and the 15–30 second print constants;
- the CSS contains `hero-worldbook-atlas.png?v=0.3.25`;
- live HTML hashes match the generated `docs/index.html` references;
- remote `main` still equals the local release commit.

