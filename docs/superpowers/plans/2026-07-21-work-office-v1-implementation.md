# Work Office V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the Work app as a layered portrait office with five optional assignments, isolated avatar overrides, one controllable Me character, three placeholder management pages, and automatic GitHub Pages deployment.

**Architecture:** Keep source-profile adaptation, persisted office state, and waypoint routing in pure modules under `src/work/`. React components render a generated people-free background with independent furniture and character layers; only the assigned Me profile consumes object-click routes. The existing `App.jsx` retains top-level app routing and opens the isolated Work screen.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Node test runner, CSS transforms and animations, localStorage, Playwright, GitHub Actions Pages.

## Global Constraints

- Start with all five office slots empty; never synthesize placeholder NPCs.
- Boss and employee slots may select Me, Character app, or NPC profiles.
- A profile may occupy only one slot, and the Me profile may occupy at most one slot.
- Only the assigned Me profile is controllable; other profiles remain at their desks in V1.
- Work-only avatar overrides must never mutate `apiMeProfiles` or `apiCharacters`.
- Use the approved central-order layout, larger desks, far-side characters, raised doors, raised tea counter, and exactly three bottom controls.
- Settings, Project Management, and Work Countdown are intentionally blank management pages with a title and back control.
- Do not add a runtime dependency for state, routing, or animation.
- Preserve untracked `artifacts/` and `designs/` content.
- Increment version from `0.2.94` to `0.2.95`.

---

### Task 1: Profile Adapter and Empty Assignment Model

**Files:**
- Create: `src/work/officeProfiles.js`
- Create: `src/work/officeProfiles.test.js`

**Interfaces:**
- Consumes: localStorage keys `apiMeProfiles` and `apiCharacters`.
- Produces: `OFFICE_SLOT_IDS`, `readOfficeProfiles(storage)`, `normalizeAssignments(value, profileMap)`, `getAvailableProfiles(profiles, assignments, slotId)`.

- [ ] **Step 1: Write failing adapter tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getAvailableProfiles, normalizeAssignments, readOfficeProfiles } from "./officeProfiles.js";

const storage = (values) => ({ getItem: (key) => values[key] ?? null });

test("offers Me, main characters, and NPCs to every office slot", () => {
  const result = readOfficeProfiles(storage({
    apiMeProfiles: JSON.stringify({ me1: { name: "我", avatar: "me.png" } }),
    apiCharacters: JSON.stringify({ c1: { name: "顾言", type: "main" }, n1: { name: "小林", type: "npc" } }),
  }));
  assert.deepEqual(result.map((item) => [item.id, item.source]), [["me:me1", "me"], ["character:c1", "character"], ["character:n1", "npc"]]);
});

test("starts empty and clears missing or duplicate profiles", () => {
  const profiles = readOfficeProfiles(storage({ apiMeProfiles: "{}", apiCharacters: JSON.stringify({ c1: { name: "顾言" } }) }));
  assert.deepEqual(normalizeAssignments({}, profiles), { boss: null, employee1: null, employee2: null, employee3: null, employee4: null });
  assert.deepEqual(normalizeAssignments({ boss: "character:c1", employee1: "character:c1", employee2: "missing" }, profiles), {
    boss: "character:c1", employee1: null, employee2: null, employee3: null, employee4: null,
  });
});

test("excludes profiles assigned to another slot", () => {
  const profiles = [{ id: "me:me1" }, { id: "character:c1" }];
  assert.deepEqual(getAvailableProfiles(profiles, { boss: "me:me1", employee1: null }, "employee1").map((item) => item.id), ["character:c1"]);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test src/work/officeProfiles.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `officeProfiles.js`.

- [ ] **Step 3: Implement profile normalization and uniqueness**

```js
export const OFFICE_SLOT_IDS = ["boss", "employee1", "employee2", "employee3", "employee4"];

const readObject = (storage, key) => {
  try { return JSON.parse(storage.getItem(key) || "{}"); } catch { return {}; }
};

export function readOfficeProfiles(storage = window.localStorage) {
  const me = Object.entries(readObject(storage, "apiMeProfiles")).map(([id, profile]) => ({ ...profile, id: `me:${id}`, sourceId: id, source: "me" }));
  const characters = Object.entries(readObject(storage, "apiCharacters")).map(([id, profile]) => ({
    ...profile,
    id: `character:${id}`,
    sourceId: id,
    source: profile.type === "npc" || profile.type === "NPC" ? "npc" : "character",
  }));
  return [...me, ...characters].filter((profile) => profile.name || profile.avatar);
}

export function normalizeAssignments(value = {}, profiles = []) {
  const validIds = new Set(profiles.map((profile) => profile.id));
  const used = new Set();
  return Object.fromEntries(OFFICE_SLOT_IDS.map((slotId) => {
    const profileId = validIds.has(value?.[slotId]) && !used.has(value[slotId]) ? value[slotId] : null;
    if (profileId) used.add(profileId);
    return [slotId, profileId];
  }));
}

export function getAvailableProfiles(profiles, assignments, slotId) {
  const occupied = new Set(Object.entries(assignments).filter(([id]) => id !== slotId).map(([, value]) => value).filter(Boolean));
  return profiles.filter((profile) => !occupied.has(profile.id));
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/work/officeProfiles.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the adapter**

```bash
git add src/work/officeProfiles.js src/work/officeProfiles.test.js
git commit -m "feat: add office profile adapter"
```

### Task 2: Persisted Assignments and Work-Only Avatars

**Files:**
- Create: `src/work/officeState.js`
- Create: `src/work/officeState.test.js`

**Interfaces:**
- Consumes: normalized profiles and assignments from Task 1.
- Produces: `OFFICE_STORAGE_KEY`, `createOfficeState(profiles)`, `restoreOfficeState(raw, profiles)`, `officeReducer(state, action)`, `resolveOfficeAvatar(profile, overrides)`.

- [ ] **Step 1: Write failing state tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createOfficeState, officeReducer, resolveOfficeAvatar, restoreOfficeState } from "./officeState.js";

const profiles = [{ id: "me:m1", source: "me", avatar: "me.png" }, { id: "character:c1", source: "character", avatar: "c.png" }];

test("assigns profiles once and moves them between slots", () => {
  let state = createOfficeState(profiles);
  state = officeReducer(state, { type: "ASSIGN", slotId: "boss", profileId: "me:m1" });
  state = officeReducer(state, { type: "ASSIGN", slotId: "employee1", profileId: "me:m1" });
  assert.equal(state.assignments.boss, null);
  assert.equal(state.assignments.employee1, "me:m1");
});

test("keeps avatar overrides separate from source profiles", () => {
  const original = structuredClone(profiles[0]);
  let state = createOfficeState(profiles);
  state = officeReducer(state, { type: "SET_AVATAR_OVERRIDE", profileId: "me:m1", value: { type: "url", value: "work.png" } });
  assert.equal(resolveOfficeAvatar(profiles[0], state.avatarOverrides), "work.png");
  assert.deepEqual(profiles[0], original);
});

test("restores safely and removes deleted profile assignments", () => {
  const restored = restoreOfficeState(JSON.stringify({ version: 1, assignments: { boss: "missing" }, avatarOverrides: {}, meWaypoint: "bad" }), profiles);
  assert.equal(restored.assignments.boss, null);
  assert.equal(restored.meWaypoint, "boss-home");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test src/work/officeState.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the versioned reducer**

```js
import { normalizeAssignments } from "./officeProfiles.js";

export const OFFICE_STORAGE_KEY = "ccatWorkOfficeV1";
export const OFFICE_STATE_VERSION = 1;
export const VALID_WAYPOINTS = new Set(["boss-home", "employee1-home", "employee2-home", "employee3-home", "employee4-home", "aisle-top", "aisle-center", "aisle-bottom", "door-left", "door-right-top", "door-right-mid", "tea-counter"]);

export const createOfficeState = (profiles = []) => ({
  version: OFFICE_STATE_VERSION,
  assignments: normalizeAssignments({}, profiles),
  avatarOverrides: {},
  meWaypoint: "boss-home",
});

export function restoreOfficeState(raw, profiles) {
  let parsed = {};
  try { parsed = JSON.parse(raw || "{}"); } catch { parsed = {}; }
  return {
    version: OFFICE_STATE_VERSION,
    assignments: normalizeAssignments(parsed.assignments, profiles),
    avatarOverrides: parsed.avatarOverrides && typeof parsed.avatarOverrides === "object" ? parsed.avatarOverrides : {},
    meWaypoint: VALID_WAYPOINTS.has(parsed.meWaypoint) ? parsed.meWaypoint : "boss-home",
  };
}

export function officeReducer(state, action) {
  if (action.type === "ASSIGN") {
    const assignments = Object.fromEntries(Object.entries(state.assignments).map(([slotId, profileId]) => [slotId, profileId === action.profileId ? null : profileId]));
    assignments[action.slotId] = action.profileId || null;
    return { ...state, assignments };
  }
  if (action.type === "SET_AVATAR_OVERRIDE") return { ...state, avatarOverrides: { ...state.avatarOverrides, [action.profileId]: action.value } };
  if (action.type === "CLEAR_AVATAR_OVERRIDE") {
    const avatarOverrides = { ...state.avatarOverrides };
    delete avatarOverrides[action.profileId];
    return { ...state, avatarOverrides };
  }
  if (action.type === "SET_WAYPOINT" && VALID_WAYPOINTS.has(action.waypoint)) return { ...state, meWaypoint: action.waypoint };
  return state;
}

export const resolveOfficeAvatar = (profile, overrides) => overrides[profile.id]?.value || profile.avatar || "";
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/work/officeState.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit persisted state**

```bash
git add src/work/officeState.js src/work/officeState.test.js
git commit -m "feat: persist office staffing and avatars"
```

### Task 3: Deterministic Office Navigation

**Files:**
- Create: `src/work/officeNavigation.js`
- Create: `src/work/officeNavigation.test.js`

**Interfaces:**
- Produces: `OFFICE_NODES`, `OBJECT_DESTINATIONS`, `findOfficeRoute(fromId, toId)`, `getRouteFacing(fromId, toId)`.

- [ ] **Step 1: Write failing route tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { findOfficeRoute, getRouteFacing, OBJECT_DESTINATIONS } from "./officeNavigation.js";

test("routes around desks to the raised tea counter", () => {
  assert.deepEqual(findOfficeRoute("boss-home", OBJECT_DESTINATIONS.tea), ["boss-home", "aisle-top", "aisle-center", "aisle-bottom", "tea-counter"]);
});

test("returns an empty route for invalid destinations", () => {
  assert.deepEqual(findOfficeRoute("boss-home", "missing"), []);
});

test("derives horizontal facing from waypoint coordinates", () => {
  assert.equal(getRouteFacing("aisle-center", "door-right-mid"), "right");
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/work/officeNavigation.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement a fixed graph and breadth-first route search**

```js
export const OFFICE_NODES = {
  "boss-home": { x: 50, y: 18, edges: ["aisle-top"] },
  "employee1-home": { x: 29, y: 43, edges: ["aisle-center"] },
  "employee2-home": { x: 67, y: 43, edges: ["aisle-center"] },
  "employee3-home": { x: 29, y: 66, edges: ["aisle-bottom"] },
  "employee4-home": { x: 67, y: 66, edges: ["aisle-bottom"] },
  "aisle-top": { x: 50, y: 29, edges: ["boss-home", "aisle-center", "door-left", "door-right-top"] },
  "aisle-center": { x: 50, y: 51, edges: ["aisle-top", "aisle-bottom", "employee1-home", "employee2-home", "door-right-mid"] },
  "aisle-bottom": { x: 50, y: 76, edges: ["aisle-center", "employee3-home", "employee4-home", "tea-counter"] },
  "door-left": { x: 8, y: 23, edges: ["aisle-top"] },
  "door-right-top": { x: 92, y: 20, edges: ["aisle-top"] },
  "door-right-mid": { x: 92, y: 40, edges: ["aisle-center"] },
  "tea-counter": { x: 76, y: 74, edges: ["aisle-bottom"] },
};

export const OBJECT_DESTINATIONS = { bossDesk: "boss-home", employee1Desk: "employee1-home", employee2Desk: "employee2-home", employee3Desk: "employee3-home", employee4Desk: "employee4-home", leftDoor: "door-left", rightTopDoor: "door-right-top", rightMidDoor: "door-right-mid", tea: "tea-counter" };

export function findOfficeRoute(fromId, toId) {
  if (!OFFICE_NODES[fromId] || !OFFICE_NODES[toId]) return [];
  const queue = [[fromId]];
  const seen = new Set([fromId]);
  while (queue.length) {
    const path = queue.shift();
    const current = path.at(-1);
    if (current === toId) return path;
    for (const next of OFFICE_NODES[current].edges) if (!seen.has(next)) { seen.add(next); queue.push([...path, next]); }
  }
  return [];
}

export function getRouteFacing(fromId, toId) {
  return OFFICE_NODES[toId].x < OFFICE_NODES[fromId].x ? "left" : "right";
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `node --test src/work/officeNavigation.test.js && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit navigation**

```bash
git add src/work/officeNavigation.js src/work/officeNavigation.test.js
git commit -m "feat: add office waypoint navigation"
```

### Task 4: Generate Layered Office Assets

**Files:**
- Create: `public/work-office-assets/office-background.png`
- Create: `src/work/officeAssets.js`
- Create: `src/work/officeAssets.test.js`

**Interfaces:**
- Produces: `OFFICE_BACKGROUND_URL`, `OFFICE_FURNITURE` with stable IDs and destination waypoint IDs.

- [ ] **Step 1: Generate the people-free background**

Use the image-generation tool with this exact prompt:

```text
Portrait 9:16 mobile game office background, straight-on slightly elevated view, warm white walls, cream floor, pale yellow oak details, restrained sage and warm-gray accents, clean premium cozy style. Leave the center open for layered furniture and five characters. No people, no desks, no chairs, no text, no UI, no carpet grid. One subtle doorway recess on the upper left wall and two doorway recesses on the upper and middle-right wall. Soft even daylight, crisp readable shapes, no perspective distortion, no shadows that imply missing furniture.
```

Save the selected output as `public/work-office-assets/office-background.png`.

- [ ] **Step 2: Write the failing asset-manifest test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE } from "./officeAssets.js";

test("declares every clickable furniture destination", () => {
  assert.equal(OFFICE_BACKGROUND_URL, "/ai-roleplay-phone/work-office-assets/office-background.png");
  assert.deepEqual(OFFICE_FURNITURE.map((item) => item.id), ["leftDoor", "rightTopDoor", "rightMidDoor", "bossDesk", "employee1Desk", "employee2Desk", "employee3Desk", "employee4Desk", "tea"]);
  assert.equal(existsSync("public/work-office-assets/office-background.png"), true);
});
```

- [ ] **Step 3: Run the asset test and verify failure**

Run: `node --test src/work/officeAssets.test.js`

Expected: FAIL because `officeAssets.js` is absent.

- [ ] **Step 4: Implement the furniture manifest**

```js
import { OBJECT_DESTINATIONS } from "./officeNavigation.js";

export const OFFICE_BACKGROUND_URL = "/ai-roleplay-phone/work-office-assets/office-background.png";
export const OFFICE_FURNITURE = [
  { id: "leftDoor", kind: "door", label: "左侧门", destination: OBJECT_DESTINATIONS.leftDoor },
  { id: "rightTopDoor", kind: "door", label: "右上门", destination: OBJECT_DESTINATIONS.rightTopDoor },
  { id: "rightMidDoor", kind: "door", label: "右侧门", destination: OBJECT_DESTINATIONS.rightMidDoor },
  { id: "bossDesk", kind: "desk boss", label: "老板桌", destination: OBJECT_DESTINATIONS.bossDesk },
  ...[1, 2, 3, 4].map((number) => ({ id: `employee${number}Desk`, kind: `desk employee employee-${number}`, label: `员工桌 ${number}`, destination: OBJECT_DESTINATIONS[`employee${number}Desk`] })),
  { id: "tea", kind: "tea", label: "茶水吧台", destination: OBJECT_DESTINATIONS.tea },
];
```

- [ ] **Step 5: Run the test and commit assets**

Run: `node --test src/work/officeAssets.test.js && npm test`

Expected: all tests PASS.

```bash
git add public/work-office-assets/office-background.png src/work/officeAssets.js src/work/officeAssets.test.js
git commit -m "feat: add layered office assets"
```

### Task 5: Employee Manager and Avatar Overrides

**Files:**
- Create: `src/work/EmployeeManager.jsx`
- Create: `src/work/WorkAvatarEditor.jsx`
- Create: `src/work/employeeManager.test.js`

**Interfaces:**
- Consumes: `profiles`, `state.assignments`, `state.avatarOverrides`, and reducer `dispatch`.
- Produces: accessible assignment selects, upload/URL/restore controls, and `resizeOfficeAvatar(file): Promise<string>`.

- [ ] **Step 1: Write source-level integration tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("employee manager exposes five slots and all override actions", () => {
  const source = readFileSync("src/work/EmployeeManager.jsx", "utf8");
  for (const text of ["老板", "员工 1", "员工 2", "员工 3", "员工 4", "上传图片", "图片 URL", "恢复原头像"]) assert.match(source, new RegExp(text));
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test src/work/employeeManager.test.js`

Expected: FAIL with `ENOENT`.

- [ ] **Step 3: Implement the avatar editor**

```jsx
export async function resizeOfficeAvatar(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 320;
  const context = canvas.getContext("2d");
  const scale = Math.max(320 / bitmap.width, 320 / bitmap.height);
  context.drawImage(bitmap, (320 - bitmap.width * scale) / 2, (320 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.82);
}

export function WorkAvatarEditor({ profile, override, onChange, onClear, onError }) {
  return <div className="work-avatar-editor">
    <label>上传图片<input type="file" accept="image/*" onChange={async (event) => { try { onChange({ type: "upload", value: await resizeOfficeAvatar(event.target.files[0]) }); } catch { onError("头像上传失败"); } }} /></label>
    <label>图片 URL<input value={override?.type === "url" ? override.value : ""} onChange={(event) => onChange({ type: "url", value: event.target.value.trim() })} /></label>
    <button type="button" onClick={onClear}>恢复原头像</button>
  </div>;
}
```

- [ ] **Step 4: Implement five assignment rows**

```jsx
import { getAvailableProfiles, OFFICE_SLOT_IDS } from "./officeProfiles.js";
import { WorkAvatarEditor } from "./WorkAvatarEditor.jsx";

const LABELS = { boss: "老板", employee1: "员工 1", employee2: "员工 2", employee3: "员工 3", employee4: "员工 4" };

export function EmployeeManager({ profiles, state, dispatch, onError }) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  return <div className="employee-manager">{OFFICE_SLOT_IDS.map((slotId) => {
    const profileId = state.assignments[slotId];
    const profile = profileMap.get(profileId);
    return <section className="employee-slot" key={slotId}>
      <label>{LABELS[slotId]}<select value={profileId || ""} onChange={(event) => dispatch({ type: "ASSIGN", slotId, profileId: event.target.value || null })}>
        <option value="">未安排</option>
        {getAvailableProfiles(profiles, state.assignments, slotId).map((item) => <option key={item.id} value={item.id}>{item.name || "未命名角色"}</option>)}
      </select></label>
      {profile && <WorkAvatarEditor profile={profile} override={state.avatarOverrides[profile.id]} onChange={(value) => dispatch({ type: "SET_AVATAR_OVERRIDE", profileId: profile.id, value })} onClear={() => dispatch({ type: "CLEAR_AVATAR_OVERRIDE", profileId: profile.id })} onError={onError} />}
    </section>;
  })}</div>;
}
```

- [ ] **Step 5: Run tests and commit the manager**

Run: `node --test src/work/employeeManager.test.js && npm test`

Expected: all tests PASS.

```bash
git add src/work/EmployeeManager.jsx src/work/WorkAvatarEditor.jsx src/work/employeeManager.test.js
git commit -m "feat: add office employee manager"
```

### Task 6: Office Scene, Movement, and Blank Pages

**Files:**
- Create: `src/work/OfficeCharacter.jsx`
- Create: `src/work/OfficeScene.jsx`
- Create: `src/work/WorkAppScreen.jsx`
- Create: `src/work/office.css`
- Create: `src/work/workScreen.test.js`

**Interfaces:**
- Consumes: Tasks 1-5 modules and localStorage.
- Produces: `WorkAppScreen({ onClose })`.

- [ ] **Step 1: Write screen source assertions**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("work screen contains the approved controls and placeholder views", () => {
  const source = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  for (const text of ["•••", "项目管理", "工作倒计时", "员工管理", "暂时留空"]) assert.match(source, new RegExp(text.replaceAll("•", "\\u2022")));
});

test("office scene uses semantic object buttons", () => {
  const source = readFileSync("src/work/OfficeScene.jsx", "utf8");
  assert.match(source, /<button/);
  assert.match(source, /aria-label=/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL with `ENOENT`.

- [ ] **Step 3: Implement the character and scene layers**

```jsx
export function OfficeCharacter({ profile, avatar, node, facing = "right", moving = false }) {
  return <div className={`office-character ${moving ? "is-moving" : "is-working"}`} data-facing={facing} style={{ "--x": `${node.x}%`, "--y": `${node.y}%` }}>
    <span className="office-character-name">{profile.name || "未命名角色"}</span>
    {avatar ? <img src={avatar} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /> : <span className="office-character-fallback">{(profile.name || "?").slice(0, 1)}</span>}
  </div>;
}
```

```jsx
import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE } from "./officeAssets.js";
import { OFFICE_NODES } from "./officeNavigation.js";
import { OfficeCharacter } from "./OfficeCharacter.jsx";

export function OfficeScene({ occupants, meMovement, onObjectClick }) {
  return <main className="office-scene" style={{ backgroundImage: `url(${OFFICE_BACKGROUND_URL})` }}>
    {OFFICE_FURNITURE.map((item) => <button type="button" key={item.id} className={`office-object ${item.kind}`} aria-label={item.label} onClick={() => onObjectClick(item.destination)}><span aria-hidden="true" /></button>)}
    {occupants.map((occupant) => <OfficeCharacter key={occupant.profile.id} {...occupant} node={OFFICE_NODES[occupant.profile.source === "me" ? meMovement.nodeId : `${occupant.slotId}-home`]} moving={occupant.profile.source === "me" && meMovement.moving} facing={meMovement.facing} />)}
  </main>;
}
```

- [ ] **Step 4: Implement the screen controller and blank pages**

Use a reducer initialized from `restoreOfficeState(localStorage.getItem(OFFICE_STORAGE_KEY), profiles)`, persist state in an effect, advance movement routes with one timeout per waypoint, cancel the previous timeout when a new destination is clicked, and render `EmployeeManager` only for the employee view. Render this exact placeholder for Settings, Project Management, and Work Countdown:

```jsx
<section className="work-placeholder-page">
  <button type="button" onClick={() => setView("office")}>返回</button>
  <h2>{title}</h2>
  <p>暂时留空</p>
</section>
```

The office footer must be:

```jsx
<nav className="work-bottom-nav" aria-label="工作导航">
  <button type="button" onClick={() => setView("projects")}>项目管理</button>
  <button className="is-wide" type="button" onClick={() => setView("timer")}>工作倒计时</button>
  <button type="button" onClick={() => setView("employees")}>员工管理</button>
</nav>
```

- [ ] **Step 5: Style and test the approved layout**

In `office.css`, use CSS custom properties for the warm-white/oak palette, absolute percentage positions matching `OFFICE_NODES`, desk sizes of `clamp(74px, 25vw, 112px)` with the boss desk 18% wider, `grid-template-columns: 1fr 1.5fr 1fr` for the bottom navigation, 44px minimum touch targets, a two-frame working motion, transform transitions for walking, and a `prefers-reduced-motion: reduce` override that disables loops and transitions.

Run: `node --test src/work/workScreen.test.js && npm test && npm run build`

Expected: tests PASS and Vite production build completes.

- [ ] **Step 6: Commit the screen**

```bash
git add src/work/OfficeCharacter.jsx src/work/OfficeScene.jsx src/work/WorkAppScreen.jsx src/work/office.css src/work/workScreen.test.js
git commit -m "feat: build interactive work office"
```

### Task 7: Reconnect Work App and Add Browser QA

**Files:**
- Modify: `src/App.jsx`
- Create: `src/App.work.test.js`
- Create: `scripts/verify-work-office.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `WorkAppScreen` from Task 6.
- Produces: launcher-to-office integration and `npm run verify:work`.

- [ ] **Step 1: Write a failing App integration test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("work launcher opens the isolated Work screen", () => {
  const source = readFileSync("src/App.jsx", "utf8");
  assert.match(source, /import \{ WorkAppScreen \} from "\.\/work\/WorkAppScreen\.jsx"/);
  assert.match(source, /<WorkAppScreen/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test src/App.work.test.js`

Expected: FAIL because the import and screen usage are absent.

- [ ] **Step 3: Reconnect the existing Work launcher**

Add the import:

```js
import { WorkAppScreen } from "./work/WorkAppScreen.jsx";
```

Use the existing homepage `工作` item to set a local `workOpen` state and conditionally render:

```jsx
{workOpen && <WorkAppScreen onClose={() => setWorkOpen(false)} />}
```

Do not rename or remove the existing `工作` launcher item.

- [ ] **Step 4: Add Playwright mobile verification**

Create `scripts/verify-work-office.mjs` to launch Chromium against the local preview, test 375x812 and 390x844 viewports, open the `工作` launcher, assert exactly three bottom navigation buttons, assert five empty desks and no `.office-character`, assign one Me profile through Employee Management, return to the office, click the tea counter, verify the Me character transform changes, open all three placeholder pages, and save screenshots under `artifacts/work-office-qa/`.

- [ ] **Step 5: Register QA and run all checks**

Add these scripts to `package.json`:

```json
"test": "node --test src/*.test.js src/work/*.test.js",
"verify:work": "node scripts/verify-work-office.mjs"
```

Run: `npm test && npm run build && npm run verify:work`

Expected: all Node tests PASS, build completes, both mobile viewport checks PASS, and screenshots exist.

- [ ] **Step 6: Commit integration and QA**

```bash
git add src/App.jsx src/App.work.test.js scripts/verify-work-office.mjs package.json package-lock.json artifacts/work-office-qa
git commit -m "test: verify work office integration"
```

### Task 8: Version and Automatic GitHub Pages Deployment

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Produces: version `0.2.95` and automatic Pages deployment from successful pushes to `main`.

- [ ] **Step 1: Update the application version**

Run: `npm version 0.2.95 --no-git-tag-version`

Update the visible version string in `src/App.jsx` from `0.2.94` to `0.2.95`.

- [ ] **Step 2: Add the Pages workflow**

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Verify version, workflow, tests, and build**

Run: `node -p "require('./package.json').version" && npm test && npm run build && git diff --check`

Expected: first line is `0.2.95`; all tests PASS; build completes; diff check emits no errors.

- [ ] **Step 4: Commit deployment automation**

```bash
git add package.json package-lock.json src/App.jsx .github/workflows/deploy-pages.yml
git commit -m "ci: automate GitHub Pages deployment"
```

- [ ] **Step 5: Push and verify the live deployment**

Run: `git push origin main`

Wait for the `Deploy GitHub Pages` workflow to succeed, then open `https://sy719427083-glitch.github.io/ai-roleplay-phone/` and verify the visible version is `0.2.95`, the Work launcher opens, the five slots start empty, and the generated background plus furniture assets return HTTP 200.
