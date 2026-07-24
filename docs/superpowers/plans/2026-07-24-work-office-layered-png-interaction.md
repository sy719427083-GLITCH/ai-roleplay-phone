# Work Office Layered PNG Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every clickable office object a separately layered transparent PNG and keep object clicks routing the assigned Me APP avatar to the selected destination.

**Architecture:** `officeAssets.js` remains the declarative asset/destination registry consumed by `OfficeScene.jsx`. A clean room-shell background sits below transparent PNG buttons for seven computer desks, the tea counter, and three door targets; `WorkAppScreen.jsx` continues to own Me-only route execution through `officeNavigation.js`.

**Tech Stack:** React 19, Vite 6, JavaScript ES modules, Node test runner, Playwright, PNG alpha assets, CSS absolute positioning, built-in image generation and local chroma-key removal.

## Global Constraints

- The background contains no desks, computers, tea counter, doors, characters, or app controls.
- The boss computer desk, six employee computer desks, tea counter, and three doors are separately clickable PNG overlays.
- All seven staffing slots start empty and accept Me APP, Character APP, or NPC profiles.
- Only the assigned Me APP occupant moves; Character APP and NPC occupants remain at their desks.
- The latest clicked destination replaces any in-progress route.
- Without an assigned Me APP occupant, object clicks show the existing assignment notice and do not change office state.
- Preserve the selected Pastel Orbit Office composition and full-bleed floating controls.
- Do not add runtime dependencies; preserve existing `artifacts/` and `designs/`; keep version `0.2.96`.

---

### Task 1: Enforce the PNG Overlay Contract

**Files:**
- Modify: `src/work/officeAssets.test.js`
- Modify: `src/work/officeAssets.js`

**Interfaces:**
- Consumes: `OBJECT_DESTINATIONS` from `officeNavigation.js`.
- Produces: `OFFICE_OBJECT_ASSETS` and `OFFICE_FURNITURE`, with one PNG path and one destination on every entry.

- [ ] **Step 1: Write the failing contract test**

Replace the current test body with:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { OFFICE_BACKGROUND_URL, OFFICE_FURNITURE, OFFICE_OBJECT_ASSETS } from "./officeAssets.js";

const publicPath = (url) => `public${url.replace("/ai-roleplay-phone", "")}`;
const pngColorType = (path) => readFileSync(path)[25];

test("declares a separate alpha PNG for every clickable office object", () => {
  assert.equal(OFFICE_BACKGROUND_URL, "/ai-roleplay-phone/work-office-assets/orbit-office-background.png");
  assert.deepEqual(OFFICE_FURNITURE.map((item) => item.id), [
    "leftDoor", "rightTopDoor", "rightMidDoor", "bossDesk",
    "employee1Desk", "employee2Desk", "employee3Desk", "employee4Desk",
    "employee5Desk", "employee6Desk", "tea",
  ]);
  assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("desk")).length, 7);
  assert.equal(OFFICE_FURNITURE.filter((item) => item.kind.includes("door")).length, 3);
  for (const item of OFFICE_FURNITURE) {
    assert.match(item.asset, /\.png$/);
    assert.ok(item.destination);
    const path = publicPath(item.asset);
    assert.equal(existsSync(path), true, `${item.id} PNG exists`);
    assert.ok([4, 6].includes(pngColorType(path)), `${item.id} PNG has alpha`);
  }
  assert.equal(Object.keys(OFFICE_OBJECT_ASSETS).length, 5);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test src/work/officeAssets.test.js`

Expected: FAIL because door entries currently lack assets and `OFFICE_OBJECT_ASSETS` is not exported.

- [ ] **Step 3: Add the complete registry**

Export this registry from `officeAssets.js`:

```js
export const OFFICE_OBJECT_ASSETS = {
  bossDesk: "/ai-roleplay-phone/work-office-assets/orbit-boss-desk.png",
  employeeDesk: "/ai-roleplay-phone/work-office-assets/orbit-employee-desk.png",
  tea: "/ai-roleplay-phone/work-office-assets/orbit-tea-counter.png",
  doorLeft: "/ai-roleplay-phone/work-office-assets/orbit-door-left.png",
  doorRight: "/ai-roleplay-phone/work-office-assets/orbit-door-right.png",
};
```

Assign `doorLeft` to `leftDoor`, `doorRight` to both right-side doors, `bossDesk` to the boss desk, `employeeDesk` to all six employee desks, and `tea` to the tea counter.

- [ ] **Step 4: Verify the test now fails only for missing door files**

Run: `node --test src/work/officeAssets.test.js`

Expected: FAIL only for `orbit-door-left.png` and `orbit-door-right.png`.

### Task 2: Produce the Clean Room and Transparent Cutouts

**Files:**
- Replace: `public/work-office-assets/orbit-office-background.png`
- Validate: `public/work-office-assets/orbit-boss-desk.png`
- Validate: `public/work-office-assets/orbit-employee-desk.png`
- Validate: `public/work-office-assets/orbit-tea-counter.png`
- Create: `public/work-office-assets/orbit-door-left.png`
- Create: `public/work-office-assets/orbit-door-right.png`

**Interfaces:**
- Consumes: `designs/work-office-pastel-orbit-selected.png` as visual reference.
- Produces: an 852x1846 furniture-free background plus alpha PNG cutouts at the exact paths declared in Task 1.

- [ ] **Step 1: Edit the selected reference into the clean background**

Use the built-in image tool with the selected reference and this prompt:

```text
Use case: precise-object-edit. Asset type: portrait mobile office background, 852x1846. Create the empty Pastel Orbit Office room shell. Keep the bright white floor, curved sky windows, blue sky and clouds, white curved architecture, plants, hanging lights, soft pastel lighting, and open central walking space. Remove every character/avatar, computer desk/computer, tea counter/cups/appliances, door/exit marker, top control, bottom navigation control, text, and logo. Reconstruct removed areas as continuous floor, window, wall, or planting. No furniture silhouettes, ghosting, text, watermark, or UI.
```

Inspect the result and copy the selected output to `public/work-office-assets/orbit-office-background.png`.

- [ ] **Step 2: Validate existing desk and tea cutouts**

Run `sips -g pixelWidth -g pixelHeight -g hasAlpha public/work-office-assets/orbit-{boss-desk,employee-desk,tea-counter}.png`.

Expected: all three report `hasAlpha: yes`; visual inspection shows no rectangular room background.

- [ ] **Step 3: Generate two chroma-key doorway cutouts**

Generate left and right variants separately on flat `#ff00ff` with this normalized prompt, changing orientation for each call:

```text
Use case: background-extraction. Asset type: transparent office architectural overlay. A compact left-facing or right-facing curved white futuristic office doorway portal matching the Pastel Orbit Office reference, with pale blue glass inset and a small cyan accent light. Full doorway visible, front three-quarter view, generous padding, perfectly flat solid #ff00ff background. No people, furniture, words, arrows, exit icon, cast shadow, reflection, watermark, or #ff00ff in the doorway.
```

- [ ] **Step 4: Remove chroma key and validate transparency**

Copy the built-in outputs to `tmp/imagegen/orbit-door-left-chroma.png` and `tmp/imagegen/orbit-door-right-chroma.png`. Then run:

```bash
python /Users/mypc/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py \
  --input tmp/imagegen/orbit-door-left-chroma.png \
  --out public/work-office-assets/orbit-door-left.png \
  --auto-key border --soft-matte --transparent-threshold 12 \
  --opaque-threshold 220 --despill

python /Users/mypc/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py \
  --input tmp/imagegen/orbit-door-right-chroma.png \
  --out public/work-office-assets/orbit-door-right.png \
  --auto-key border --soft-matte --transparent-threshold 12 \
  --opaque-threshold 220 --despill
```

Save to the exact left/right paths above. Inspect transparent corners and rerun once with `--edge-contract 1` only if a magenta fringe remains.

- [ ] **Step 5: Run the asset test and verify GREEN**

Run: `node --test src/work/officeAssets.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the asset layer**

Stage `officeAssets.js`, its test, the clean background, three existing validated cutouts, and both door cutouts. Commit with `feat: layer office objects as png assets`.

### Task 3: Render PNG Buttons and Verify Click Routing

**Files:**
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/office.css`
- Modify: `scripts/verify-work-office.mjs`

**Interfaces:**
- Consumes: `OFFICE_FURNITURE`, `OFFICE_NODES`, `onObjectClick(destination)`, and `meMovement`.
- Produces: eleven accessible PNG buttons and browser evidence that object clicks move only the Me APP avatar.

- [ ] **Step 1: Strengthen browser verification before rendering changes**

In the empty office assert exactly eleven `.office-object` elements, eleven direct `img.office-object-art` children, and that every image has `complete === true` and `naturalWidth > 0`. Click `老板桌` and wait for the existing assignment notice. After assigning Me APP and verifying tea-counter movement, click `员工桌 6`, wait 1800 ms, and assert the avatar's computed `left`/`top` changed again.

- [ ] **Step 2: Run browser verification and verify RED**

Run: `npm run verify:work`

Expected: FAIL because current door buttons render CSS arrow markup rather than PNG images.

- [ ] **Step 3: Render only asset images inside each object button**

Make every mapped button body exactly:

```jsx
<img className="office-object-art" src={item.asset} alt="" draggable="false" />
```

Remove the `ArrowUpLeft` and `ArrowUpRight` imports and delete the CSS-arrow markup. Keep `onClick={() => onObjectClick(item.destination)}` unchanged because `moveMe` already enforces Me-only routing and replaces the active timer/route.

- [ ] **Step 4: Position PNG door art**

Use `clamp(74px, 22vw, 92px)` width and `clamp(116px, 17vh, 148px)` height. Place left at `top: 11%; left: -18px`, right-top at `top: 10%; right: -18px`, and right-mid at `top: 31%; right: -22px`. Delete `.office-door-arrow` rules; keep focus outlines and subtle `:active` scaling on the PNG button.

- [ ] **Step 5: Verify focused behavior and browser QA**

Run:

```bash
node --test src/work/officeAssets.test.js src/work/officeNavigation.test.js src/work/workScreen.test.js
npm run verify:work
```

Expected: focused tests PASS; browser QA PASS at 375x812 and 390x844; both screenshots update.

- [ ] **Step 6: Commit rendering and interaction evidence**

Stage `OfficeScene.jsx`, `office.css`, `verify-work-office.mjs`, and the two updated viewport screenshots. Commit with `feat: route avatar from png object clicks`.

### Task 4: Visual QA, Full Verification, and Delivery

**Files:**
- Modify: `design-qa.md`
- Verify and commit existing related changes: `AGENTS.md`, `package.json`, `package-lock.json`, `src/App.jsx`, `src/styles.css`, `src/work/EmployeeManager.jsx`, `src/work/officeNavigation.js`, `src/work/officeProfiles.js`, and their tests.

**Interfaces:**
- Consumes: the completed layered office and the existing Pages workflow.
- Produces: reviewable screenshots, passing tests, a compatible production build, and a branch ready for integration/deployment.

- [ ] **Step 1: Compare both captures with the selected mock**

Inspect the selected mock and both viewport screenshots. Record pass/fail notes in `design-qa.md` for: clean background, no duplicated tea/desks/doors, seven desk overlays, three door overlays, open walking space, floating controls, tap-target visibility, and avatar destination alignment.

- [ ] **Step 2: Fix only observed visual defects**

Restrict fixes to `office.css`, placement data, or one regenerated asset. After each fix rerun `npm run verify:work` and inspect both screenshots.

- [ ] **Step 3: Run all verification under compatible Node**

Load Node 20.19+ or 22.12+ using the workspace dependency locator, then run `npm test`, `npm run verify:work`, and `npm run build`.

Expected: all tests and browser QA PASS; Vite produces `dist/` without an engine warning.

- [ ] **Step 4: Review and commit the remaining approved Pastel Orbit changes**

Run `git status --short`, `git diff --check`, and `git diff --stat`. Stage only the related changed files listed above, skipping paths with no diff and preserving unrelated `artifacts/` or `designs/`. Commit with `feat: complete pastel orbit office`.

- [ ] **Step 5: Finish and deploy**

Invoke `superpowers:finishing-a-development-branch`, verify the branch base, and present integration choices. Only after the user chooses deployment, push to the branch watched by `.github/workflows/deploy-pages.yml`, wait for Pages, then verify the live `/ai-roleplay-phone/` version and Work APP interaction before claiming deployment complete.
