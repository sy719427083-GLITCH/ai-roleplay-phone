# Work Contract Real API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and persist five real project contracts through the configured secondary API with automatic main-API fallback, replacing all sample project data.

**Architecture:** Add one pure state module for cache validation and transitions, and one API module for endpoint selection, OpenAI-compatible requests, response parsing, and failover. The React page coordinates these modules and owns only transient loading/error UI. Browser QA intercepts the API to prove first-load generation, cache reuse, refresh, and signed-state locking without calling an external service.

**Tech Stack:** React 19, existing `apiConfig.js`, Fetch API, localStorage, Node test runner, Playwright

## Global Constraints

- Prefer an enabled valid secondary API; if absent use the main API; if secondary fails retry the main API once.
- Generate exactly five contracts and never fall back to sample data.
- Cache only normalized contracts, revision, source, generation timestamp, and signed project ID under `ccatWorkProjectsV1`.
- Never persist or display API keys, endpoint URLs, raw headers, or raw model responses.
- Preserve the approved white contract UI and all non-project Work APP behavior.
- Do not add dependencies or publish online.

---

### Task 1: Persistent work-project state

**Files:**
- Create: `src/work/workProjectState.js`
- Create: `src/work/workProjectState.test.js`

**Interfaces:**
- Produces: `WORK_PROJECTS_STORAGE_KEY`, `createEmptyWorkProjectState()`, `restoreWorkProjectState(raw)`, `replaceWorkProjects(state, projects, source)`, `startWorkProject(state, projectId)`, and `serializeWorkProjectState(state)`.
- State shape: `{ projects: WorkProject[], startedProjectId: string|null, revision: number, source: "secondary"|"main"|null, generatedAt: string|null }`.

- [ ] **Step 1: Write failing state tests**

```js
test("restores only a complete five-project cache", () => {
  const restored = restoreWorkProjectState(JSON.stringify({
    projects: makeProjects(5), startedProjectId: null, revision: 2,
    source: "secondary", generatedAt: "2026-07-25T00:00:00.000Z",
  }));
  assert.equal(restored.projects.length, 5);
  assert.equal(restoreWorkProjectState("bad json").projects.length, 0);
  assert.equal(restoreWorkProjectState(JSON.stringify({ projects: makeProjects(4) })).projects.length, 0);
});

test("replaces contracts atomically and persists a valid signature", () => {
  const state = replaceWorkProjects(createEmptyWorkProjectState(), makeProjects(5), "main", "2026-07-25T00:00:00.000Z");
  assert.equal(state.revision, 1);
  assert.equal(state.source, "main");
  const signed = startWorkProject(state, state.projects[0].id);
  assert.equal(signed.startedProjectId, state.projects[0].id);
  assert.equal(startWorkProject(signed, state.projects[1].id), signed);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test src/work/workProjectState.test.js`

Expected: FAIL because `workProjectState.js` does not exist.

- [ ] **Step 3: Implement validation and transitions**

```js
export const WORK_PROJECTS_STORAGE_KEY = "ccatWorkProjectsV1";

export function createEmptyWorkProjectState() {
  return { projects: [], startedProjectId: null, revision: 0, source: null, generatedAt: null };
}

export function replaceWorkProjects(state, projects, source, generatedAt = new Date().toISOString()) {
  if (!isCompleteProjectList(projects) || !["secondary", "main"].includes(source)) return state;
  return { projects, startedProjectId: null, revision: state.revision + 1, source, generatedAt };
}

export function startWorkProject(state, projectId) {
  if (state.startedProjectId || !state.projects.some((project) => project.id === projectId)) return state;
  return { ...state, startedProjectId: projectId };
}
```

`restoreWorkProjectState` must reject invalid project counts, invalid sources, missing fields, duplicate IDs, and signed IDs absent from the project list. `serializeWorkProjectState` must emit only the five documented state fields.

- [ ] **Step 4: Verify state tests and commit**

Run: `node --test src/work/workProjectState.test.js`

Expected: all state tests pass.

```bash
git add src/work/workProjectState.js src/work/workProjectState.test.js
git commit -m "feat(work): persist generated contract state"
```

### Task 2: Secondary-first contract API client

**Files:**
- Create: `src/work/workProjectApi.js`
- Create: `src/work/workProjectApi.test.js`

**Interfaces:**
- Consumes: parsed API state from `parseConfigs`, a numeric `revision`, and injected `fetchImpl`.
- Produces: `selectWorkProjectEndpoints(apiState)`, `parseWorkProjectResponse(content, revision)`, and `generateWorkProjects({ apiState, revision, fetchImpl }) -> Promise<{ projects, source }>`.

- [ ] **Step 1: Write failing endpoint and failover tests**

```js
test("prefers enabled secondary and falls back to main after failure", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (calls.length === 1) return { ok: false, status: 503 };
    return okResponse(validProjectJson());
  };
  const result = await generateWorkProjects({ apiState: configuredState(), revision: 3, fetchImpl });
  assert.equal(result.source, "main");
  assert.equal(calls.length, 2);
});

test("uses main directly when secondary is disabled", async () => {
  const endpoints = selectWorkProjectEndpoints({ ...configuredState(), secondaryEnabled: false });
  assert.deepEqual(endpoints.map((item) => item.source), ["main"]);
});
```

- [ ] **Step 2: Write failing response parser tests**

```js
test("parses five projects from plain or fenced JSON", () => {
  assert.equal(parseWorkProjectResponse(validProjectJson(), 2).length, 5);
  assert.equal(parseWorkProjectResponse(````json\n${validProjectJson()}\n````, 2).length, 5);
});

test("rejects wrong counts, missing fields, and invalid difficulty", () => {
  assert.throws(() => parseWorkProjectResponse(JSON.stringify({ projects: [] }), 0), /五份/);
  assert.throws(() => parseWorkProjectResponse(invalidDifficultyJson(), 0), /难度/);
});
```

- [ ] **Step 3: Run RED**

Run: `node --test src/work/workProjectApi.test.js`

Expected: FAIL because the client module is absent.

- [ ] **Step 4: Implement endpoint selection and API request**

```js
export function selectWorkProjectEndpoints(apiState) {
  const secondary = resolveEndpoint(apiState.secondaryConfigs, apiState.selectedSecondaryId, apiState.secondaryDraft);
  const main = resolveEndpoint(apiState.mainConfigs, apiState.selectedMainId, apiState.mainDraft);
  return [
    ...(apiState.secondaryEnabled && secondary ? [{ source: "secondary", endpoint: secondary }] : []),
    ...(main ? [{ source: "main", endpoint: main }] : []),
  ];
}

export async function generateWorkProjects({ apiState, revision, fetchImpl = fetch }) {
  const candidates = selectWorkProjectEndpoints(apiState);
  if (!candidates.length) throw new Error("请先在 API 设置中配置主 API 或副 API");
  let lastError;
  for (const candidate of candidates) {
    try {
      const content = await requestProjectJson(candidate.endpoint, fetchImpl);
      return { projects: parseWorkProjectResponse(content, revision), source: candidate.source };
    } catch (error) {
      lastError = sanitizeWorkProjectError(error);
    }
  }
  throw lastError || new Error("合同生成失败");
}
```

Normalize the URL to one `/v1/chat/completions`, request strict JSON in the system/user prompts, use `choices[0].message.content`, and expose only safe Chinese errors. Normalize five strings, enforce difficulty values, truncate documented lengths, and generate IDs `api-${revision + 1}-${index + 1}`.

- [ ] **Step 5: Verify API tests and commit**

Run: `node --test src/work/workProjectApi.test.js`

Expected: endpoint, parser, request, and failover tests pass.

```bash
git add src/work/workProjectApi.js src/work/workProjectApi.test.js
git commit -m "feat(work): generate contracts through configured APIs"
```

### Task 3: Real API page integration and removal of samples

**Files:**
- Modify: `src/work/ProjectManagementPreview.jsx`
- Modify: `src/work/ProjectManagementPreview.test.js`
- Modify: `src/work/office.css`
- Delete: `src/work/projectPreviewModel.js`
- Delete: `src/work/projectPreviewModel.test.js`

**Interfaces:**
- Consumes: API config from `parseConfigs(localStorage.getItem(STORAGE_KEY))`, Task 1 state functions, and Task 2 `generateWorkProjects`.
- Produces: first-load, cached, refresh, error, source, and signed UI states.

- [ ] **Step 1: Update source-contract tests to fail**

Require imports from `apiConfig.js`, `workProjectApi.js`, and `workProjectState.js`; require loading/error copy, `ccatWorkProjectsV1`, and API source labels; forbid `projectPreviewModel` and `SAMPLE_PROJECTS`.

```js
assert.match(source, /generateWorkProjects/);
assert.match(source, /WORK_PROJECTS_STORAGE_KEY/);
assert.match(source, /副 API 生成|主 API 生成/);
assert.match(source, /重新获取合同/);
assert.doesNotMatch(source, /projectPreviewModel|SAMPLE_PROJECTS/);
```

- [ ] **Step 2: Run RED**

Run: `node --test src/work/ProjectManagementPreview.test.js`

Expected: FAIL because the preview page still imports the sample model.

- [ ] **Step 3: Integrate persistent async state**

Initialize from `restoreWorkProjectState`. On mount, request contracts only when `projects.length !== 5`. Persist every valid state change with a guarded localStorage write. `handleRefresh` keeps old projects visible while loading and calls API with the current revision; success uses `replaceWorkProjects`, failure preserves the state and displays the safe error. `handleStart` uses `startWorkProject` and persists the signed state.

Render:

```jsx
{loading && !projectState.projects.length ? <ContractSkeletonList /> : null}
{error && !projectState.projects.length ? <ContractError message={error} onRetry={loadProjects} /> : null}
{projectState.projects.length === 5 ? <ContractList ... /> : null}
```

Add a small source label using `projectState.source === "secondary" ? "副 API 生成" : "主 API 生成"`. When a refresh fails with existing contracts, render a dismissible inline error above the unchanged list.

- [ ] **Step 4: Remove sample modules and verify tests**

Delete `projectPreviewModel.js` and its test after the component no longer imports them.

Run: `npm test`

Expected: all remaining tests pass, and no repository source references `projectPreviewModel` or sample project IDs.

- [ ] **Step 5: Commit integration**

```bash
git add src/work/ProjectManagementPreview.jsx src/work/ProjectManagementPreview.test.js src/work/office.css
git rm src/work/projectPreviewModel.js src/work/projectPreviewModel.test.js
git commit -m "feat(work): load contracts from real APIs"
```

### Task 4: Browser contract generation and persistence QA

**Files:**
- Modify: `scripts/verify-work-projects-preview.mjs`
- Modify: `scripts/verify-work-office.mjs`
- Modify: `artifacts/work-projects-preview/projects-ready-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-ready-390x844.png`
- Modify: `artifacts/work-projects-preview/projects-375x812.png`
- Modify: `artifacts/work-projects-preview/projects-390x844.png`

**Interfaces:**
- Consumes: `/v1/chat/completions` requests and `ccatWorkProjectsV1` state.
- Produces: deterministic API-backed ready and signed screenshots plus request-count assertions.

- [ ] **Step 1: Seed API config and intercept requests**

Before navigation, write `ccat-ai-api-configs` with enabled secondary and main endpoints. Route `**/v1/chat/completions` so the secondary response fails once with HTTP 503, then the main response returns five deterministic “API 合同” projects. Record request URLs.

- [ ] **Step 2: Verify first load, fallback, cache, refresh, and signing**

Assert first entry makes two calls and displays “主 API 生成”. Return to the office and re-enter; assert the request count is unchanged. Click “换一批合同”; assert two more calls and five refreshed contracts. Sign the first contract, return and re-enter; assert the request count remains unchanged, refresh is disabled, and one signed seal remains.

- [ ] **Step 3: Preserve visual screenshots**

Capture ready state before signing and signed state after signing at 375×812 and 390×844. Both must show white contract paper and API-generated names.

- [ ] **Step 4: Update office regression fixture**

Seed a valid cached `ccatWorkProjectsV1` in `verify-work-office.mjs` so navigation regression does not call a network API. Continue asserting five contract cards and the “项目合同” heading.

- [ ] **Step 5: Final verification**

Run: `npm test && npm run build && node scripts/verify-work-projects-preview.mjs && node scripts/verify-work-office.mjs && git diff --check`

Expected: unit tests, production build, API browser QA, office browser QA, and whitespace validation pass.

- [ ] **Step 6: Commit QA**

```bash
git add scripts/verify-work-projects-preview.mjs scripts/verify-work-office.mjs artifacts/work-projects-preview
git commit -m "test(work): verify real API contract generation"
```
