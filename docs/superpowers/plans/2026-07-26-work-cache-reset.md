# Work APP Cache Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guarded Work-only cache reset to Work Settings that returns the user home and restarts Work APP onboarding on the next open.

**Architecture:** Put the exact storage-key removal in a small pure module so it can be tested without React. Render the Work Settings UI and its in-app confirmation dialog in a focused component, then integrate it into `WorkAppScreen` with `onClose` as the successful reset boundary so stale in-memory office/project state is discarded by unmounting.

**Tech Stack:** React 19, lucide-react, CSS, localStorage, Node test runner, Vite 6.

## Global Constraints

- Delete only `ccatWorkCompanyV1`, `ccatWorkOfficeV1`, and `ccatWorkProjectsV1`.
- Never delete wallet, API, role, NPC, “我 APP”, or other application data.
- Use an in-app confirmation dialog; do not use browser-native `confirm`.
- Cancel and backdrop clicks must not delete data.
- On success, close Work APP; the next open must start at the Work launch animation and company creation.
- On failure, remain in Work Settings and show `清除失败，请重试`.
- All action buttons must have at least a 44px touch target.

---

### Task 1: Add an exact Work-cache clearing boundary

**Files:**
- Create: `src/work/workCache.js`
- Create: `src/work/workCache.test.js`

**Interfaces:**
- Consumes: `WORK_COMPANY_STORAGE_KEY`, `OFFICE_STORAGE_KEY`, and `WORK_PROJECTS_STORAGE_KEY`.
- Produces: `WORK_CACHE_STORAGE_KEYS: readonly string[]` and `clearWorkCache(storage?: Storage): void`.

- [ ] **Step 1: Write the failing tests**

Create `src/work/workCache.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { clearWorkCache, WORK_CACHE_STORAGE_KEYS } from "./workCache.js";

test("declares only the three Work cache keys", () => {
  assert.deepEqual(WORK_CACHE_STORAGE_KEYS, [
    "ccatWorkCompanyV1",
    "ccatWorkOfficeV1",
    "ccatWorkProjectsV1",
  ]);
});

test("clears Work cache without touching unrelated data", () => {
  const values = new Map([
    ["ccatWorkCompanyV1", "company"],
    ["ccatWorkOfficeV1", "office"],
    ["ccatWorkProjectsV1", "projects"],
    ["ccatWalletV1", "wallet"],
    ["ccat-api-configs", "api"],
    ["apiCharacters", "characters"],
  ]);
  const removed = [];
  clearWorkCache({ removeItem(key) { removed.push(key); values.delete(key); } });
  assert.deepEqual(removed, WORK_CACHE_STORAGE_KEYS);
  assert.equal(values.get("ccatWalletV1"), "wallet");
  assert.equal(values.get("ccat-api-configs"), "api");
  assert.equal(values.get("apiCharacters"), "characters");
});

test("reports storage removal failures", () => {
  assert.throws(() => clearWorkCache({ removeItem() { throw new Error("denied"); } }), /denied/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/work/workCache.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `workCache.js`.

- [ ] **Step 3: Implement the pure clearing function**

Create `src/work/workCache.js`:

```js
import { OFFICE_STORAGE_KEY } from "./officeState.js";
import { WORK_COMPANY_STORAGE_KEY } from "./workCompanyState.js";
import { WORK_PROJECTS_STORAGE_KEY } from "./workProjectState.js";

export const WORK_CACHE_STORAGE_KEYS = [
  WORK_COMPANY_STORAGE_KEY,
  OFFICE_STORAGE_KEY,
  WORK_PROJECTS_STORAGE_KEY,
];

export function clearWorkCache(storage = window.localStorage) {
  WORK_CACHE_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
}
```

- [ ] **Step 4: Run the tests and commit**

Run: `node --test src/work/workCache.test.js`

Expected: 3 tests pass.

```bash
git add src/work/workCache.js src/work/workCache.test.js
git commit -m "feat(work): add cache reset boundary"
```

### Task 2: Build Work Settings and the confirmation dialog

**Files:**
- Create: `src/work/WorkSettings.jsx`
- Create: `src/work/WorkSettings.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `clearWorkCache(window.localStorage)` from Task 1.
- Produces: `<WorkSettings onBack: () => void, onCleared: () => void />`.

- [ ] **Step 1: Write the failing source contract test**

Create `src/work/WorkSettings.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/work/WorkSettings.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("settings explains and confirms the Work-only reset", () => {
  for (const text of [
    "工作设置", "存储与重置", "清除工作缓存", "清除工作缓存？",
    "公司名称、员工安排、项目列表和倒计时", "钱包、API 和角色资料不会被删除",
    "取消", "确认清除", "清除失败，请重试",
  ]) assert.match(source, new RegExp(text));
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /clearWorkCache\(window\.localStorage\)/);
  assert.match(styles, /\.work-settings-clear\s*\{[^}]*min-height:\s*48px/s);
  assert.match(styles, /\.work-cache-confirm-action\s*\{[^}]*min-height:\s*48px/s);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/work/WorkSettings.test.js`

Expected: FAIL because `WorkSettings.jsx` does not exist.

- [ ] **Step 3: Implement the settings component**

Create `src/work/WorkSettings.jsx` with this behavior:

```jsx
import { useState } from "react";
import { ChevronLeft, Database, Trash2, X } from "lucide-react";
import { clearWorkCache } from "./workCache.js";

export function WorkSettings({ onBack, onCleared }) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  const confirmClear = () => {
    if (clearing) return;
    setClearing(true);
    setError("");
    try {
      clearWorkCache(window.localStorage);
      setConfirming(false);
      onCleared();
    } catch {
      setConfirming(false);
      setClearing(false);
      setError("清除失败，请重试");
    }
  };

  return (
    <section className="work-app-screen work-subpage work-settings-page">
      <header className="work-page-header">
        <button type="button" onClick={onBack} aria-label="返回办公室"><ChevronLeft size={21} /></button>
        <h1>工作设置</h1><span />
      </header>
      <main className="work-settings-content">
        <section className="work-settings-section">
          <span className="work-settings-icon"><Database size={22} /></span>
          <div><h2>存储与重置</h2><p>清除公司、办公室安排和项目进度，其他 APP 数据不会受到影响</p></div>
          <button className="work-settings-clear" type="button" onClick={() => { setError(""); setConfirming(true); }}>
            <Trash2 size={18} />清除工作缓存
          </button>
          {error && <p className="work-settings-error" role="alert">{error}</p>}
        </section>
      </main>
      {confirming && (
        <div className="work-cache-confirm-backdrop" onClick={() => setConfirming(false)}>
          <section className="work-cache-confirm" role="dialog" aria-modal="true" aria-labelledby="work-cache-confirm-title" onClick={(event) => event.stopPropagation()}>
            <button className="work-cache-confirm-close" type="button" onClick={() => setConfirming(false)} aria-label="关闭确认"><X size={20} /></button>
            <h2 id="work-cache-confirm-title">清除工作缓存？</h2>
            <p>公司名称、员工安排、项目列表和倒计时会被删除。</p>
            <strong>钱包、API 和角色资料不会被删除</strong>
            <div className="work-cache-confirm-actions">
              <button className="work-cache-confirm-action is-cancel" type="button" onClick={() => setConfirming(false)}>取消</button>
              <button className="work-cache-confirm-action is-danger" type="button" onClick={confirmClear} disabled={clearing}>{clearing ? "正在清除" : "确认清除"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add Work Settings styles**

Add scoped styles to `src/work/office.css`:

```css
.work-settings-page { background:linear-gradient(180deg,#f5f9ff,#eef3fb); }
.work-settings-content { padding:22px 16px calc(28px + env(safe-area-inset-bottom,0px)); }
.work-settings-section { display:grid; grid-template-columns:auto 1fr; gap:12px; border:1px solid rgba(107,133,177,.16); border-radius:22px; background:rgba(255,255,255,.92); padding:18px; box-shadow:0 14px 36px rgba(60,86,132,.09); }
.work-settings-icon { display:grid; width:44px; height:44px; place-items:center; border-radius:15px; background:#edf4ff; color:#3977e6; }
.work-settings-section h2 { margin:1px 0 5px; font-size:16px; }
.work-settings-section p { margin:0; color:var(--work-muted); font-size:12px; line-height:1.55; }
.work-settings-clear { grid-column:1/-1; display:flex; min-height:48px; align-items:center; justify-content:center; gap:8px; border:1px solid rgba(198,68,68,.32); border-radius:15px; background:#fff7f7; color:#ba3d3d; font-weight:800; }
.work-settings-error { grid-column:1/-1; color:#bd3d3d !important; }
.work-cache-confirm-backdrop { position:fixed; inset:0; z-index:130; display:grid; place-items:end center; background:rgba(31,44,70,.34); padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px)); backdrop-filter:blur(8px); }
.work-cache-confirm { position:relative; width:min(100%,430px); border:1px solid rgba(255,255,255,.8); border-radius:26px; background:#fff; padding:27px 22px 20px; box-shadow:0 28px 70px rgba(30,46,75,.24); }
.work-cache-confirm h2 { margin:0 42px 9px 0; font-family:Georgia,"Songti SC",serif; font-size:23px; }
.work-cache-confirm p { color:#68748a; font-size:13px; line-height:1.65; }
.work-cache-confirm strong { display:block; color:#2f7054; font-size:12px; }
.work-cache-confirm-close { position:absolute; top:14px; right:14px; display:grid; width:44px; height:44px; place-items:center; border:0; border-radius:50%; background:#f0f3f8; }
.work-cache-confirm-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:22px; }
.work-cache-confirm-action { min-height:48px; border-radius:14px; font-weight:800; }
.work-cache-confirm-action.is-cancel { border:0; background:#edf1f7; color:#596579; }
.work-cache-confirm-action.is-danger { border:0; background:#c74747; color:#fff; }
```

- [ ] **Step 5: Run tests and commit**

Run: `node --test src/work/workCache.test.js src/work/WorkSettings.test.js`

Expected: all tests pass.

```bash
git add src/work/WorkSettings.jsx src/work/WorkSettings.test.js src/work/office.css
git commit -m "feat(work): add cache reset settings"
```

### Task 3: Integrate reset into Work APP lifecycle

**Files:**
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: `<WorkSettings onBack onCleared />` from Task 2.
- Produces: successful clear calls the existing `WorkAppScreen.onClose` to force a clean remount next time.

- [ ] **Step 1: Write the failing integration test**

Add to `src/work/workScreen.test.js`:

```js
test("work settings clears cache through a clean app remount", () => {
  assert.match(screen, /import \{ WorkSettings \} from "\.\/WorkSettings\.jsx"/);
  assert.match(screen, /view === "settings"/);
  assert.match(screen, /<WorkSettings/);
  assert.match(screen, /onBack=\{\(\) => setView\("office"\)\}/);
  assert.match(screen, /onCleared=\{onClose\}/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL because Work Settings is still a placeholder.

- [ ] **Step 3: Integrate Work Settings**

Import the component:

```jsx
import { WorkSettings } from "./WorkSettings.jsx";
```

Add this branch before the generic subpage branch:

```jsx
if (view === "settings") {
  return <WorkSettings onBack={() => setView("office")} onCleared={onClose} />;
}
```

Keep the employees branch unchanged and remove Settings from the placeholder path.

- [ ] **Step 4: Run focused tests and build**

Run: `node --test src/work/workCache.test.js src/work/WorkSettings.test.js src/work/workScreen.test.js`

Expected: all focused tests pass.

Run: `npm run build`

Expected: Vite build exits with code 0.

- [ ] **Step 5: Commit the integration**

```bash
git add src/work/WorkAppScreen.jsx src/work/workScreen.test.js
git commit -m "feat(work): restart app after cache reset"
```

### Task 4: Verify reset scope and first-run restart

**Files:**
- Verify only: `src/work/workCache.js`
- Verify only: `src/work/WorkSettings.jsx`
- Verify only: `src/work/WorkAppScreen.jsx`

**Interfaces:**
- Consumes: all deliverables from Tasks 1–3.
- Produces: automated and browser verification evidence.

- [ ] **Step 1: Run the full suite and production build**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, Vite exits with code 0, and no whitespace errors are reported.

- [ ] **Step 2: Verify at 390 × 844**

Use the local app on a fresh origin and verify:

1. create a company;
2. arrange at least one office occupant and generate or start a project if available;
3. open Work Settings and confirm the new section and 48px clear button;
4. click clear, cancel, and verify the company/office/project state remains;
5. reopen the dialog and click Confirm Clear;
6. verify Work APP closes to the phone home screen;
7. verify wallet/API/character data remains available;
8. reopen Work and verify the full-screen launch animation and company creation appear;
9. recreate a company and verify the office is empty and project state has no active countdown;
10. inspect console errors and confirm none are present.

- [ ] **Step 3: Verify storage failure behavior**

Use the pure-function failure test as the storage exception proof and confirm the component source catches the exception, keeps `onCleared` inside the success path, and renders `清除失败，请重试` with `role="alert"`.

- [ ] **Step 4: Review repository state**

Run: `git status --short && git log --oneline -6`

Expected: only the user's pre-existing untracked design/artifact files remain outside the committed feature changes.

