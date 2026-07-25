# Work APP Company Fullscreen Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two first-run Work APP animations with full-screen continuous camera scenes that match the existing Orbit office background.

**Architecture:** Keep the existing `launch → create → enter` state machine and company persistence unchanged. Add two versioned scene assets through `officeAssets.js`, render them as full-viewport layers in `WorkCompanyOnboarding`, and animate only transforms, opacity, clouds, and door overlays in CSS so the final frame can dissolve into the current office.

**Tech Stack:** React 19, CSS animations, PNG scene assets, Node test runner, Vite 6.

## Global Constraints

- The visual reference is `public/work-office-assets/orbit-office-background.png`.
- Use bright white rounded architecture, blue sky, soft clouds, pastel globe lights, pale lavender accents, and plants in the same soft 3D anime environment render.
- Do not use photographic realism, abstract gradient-only backgrounds, black-and-gold styling, cyberpunk, a centered launch card, or a reduced-size scene frame.
- Launch duration is approximately 2.2 seconds; enter duration is approximately 2.4 seconds.
- Preserve the company form, five-character prefix limit, fixed `有限公司` suffix, persistence, and direct-to-office behavior after creation.
- Preserve a visible skip control with at least a 44px touch target.
- Reduced motion uses a 150ms fade without long-distance camera or cloud movement.
- Do not modify the project contract UI or office furniture/navigation behavior.

---

### Task 1: Add the two approved Orbit scene assets

**Files:**
- Create: `public/work-office-assets/work-company-launch-background.png`
- Create: `public/work-office-assets/work-company-enter-background.png`
- Modify: `src/work/officeAssets.js`
- Test: `src/work/officeAssets.test.js`

**Interfaces:**
- Consumes: `OFFICE_BACKGROUND_URL` as the style reference path.
- Produces: `WORK_COMPANY_SCENE_ASSETS: { launch: string, enter: string }` for the onboarding component.

- [ ] **Step 1: Write the failing asset contract test**

Change the import and add this test to `src/work/officeAssets.test.js`:

```js
import {
  OFFICE_BACKGROUND_URL,
  OFFICE_FURNITURE,
  OFFICE_OBJECT_ASSETS,
  WORK_COMPANY_SCENE_ASSETS,
} from "./officeAssets.js";

const pngDimensions = (path) => {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

test("declares portrait fullscreen company animation scenes", () => {
  assert.deepEqual(WORK_COMPANY_SCENE_ASSETS, {
    launch: "/ai-roleplay-phone/work-office-assets/work-company-launch-background.png",
    enter: "/ai-roleplay-phone/work-office-assets/work-company-enter-background.png",
  });
  for (const url of Object.values(WORK_COMPANY_SCENE_ASSETS)) {
    const path = publicPath(url);
    assert.equal(existsSync(path), true, `${url} exists`);
    const { width, height } = pngDimensions(path);
    assert.ok(height > width, `${url} is portrait`);
    assert.ok(width >= 1024, `${url} is high resolution`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/work/officeAssets.test.js`

Expected: FAIL because `WORK_COMPANY_SCENE_ASSETS` is not exported.

- [ ] **Step 3: Generate two separate project-bound PNGs**

Use the built-in image generation tool twice with `public/work-office-assets/orbit-office-background.png` as the reference image.

Launch prompt:

```text
Create a single portrait 9:16 fullscreen mobile background in exactly the same soft polished 3D anime environment style as the reference. Show a white rounded sky walkway leading straight toward the curved entrance of the same cloud office, vivid blue sky, fluffy clouds, pastel globe lights visible inside, pale lavender accents, plants and flowers, glossy white floor, centered forward camera path, no people, no text, no UI, no logo, no frame, no photography, no watermark. Keep the entrance in the center safe area for a slow camera push.
```

Enter prompt:

```text
Create a single portrait 9:16 fullscreen mobile background in exactly the same soft polished 3D anime environment style and same building as the reference. Show a first-person view immediately inside the curved white entrance, with open space toward the recognizable Orbit office: blue-sky window, white curved walls, pale lavender inset wall, pastel globe lights and plants. Leave room for separate white curved door overlays at the left and right edges and for a company-name overlay near the lower safe area. No people, no text, no UI, no logo, no frame, no photography, no watermark.
```

Copy the chosen generated files to the two exact `public/work-office-assets/` paths. Leave the built-in generated originals in place.

- [ ] **Step 4: Export the scene URLs**

Add to `src/work/officeAssets.js`:

```js
export const WORK_COMPANY_SCENE_ASSETS = {
  launch: "/ai-roleplay-phone/work-office-assets/work-company-launch-background.png",
  enter: "/ai-roleplay-phone/work-office-assets/work-company-enter-background.png",
};
```

- [ ] **Step 5: Inspect and validate the scene files**

Use `view_image` on both PNGs. Confirm the scenes match the reference, are the same building, contain no text or people, and keep the camera route centered.

Run: `node --test src/work/officeAssets.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the asset contract and scenes**

```bash
git add src/work/officeAssets.js src/work/officeAssets.test.js public/work-office-assets/work-company-launch-background.png public/work-office-assets/work-company-enter-background.png
git commit -m "feat(work): add fullscreen company scenes"
```

### Task 2: Replace the compact launch and entry markup

**Files:**
- Modify: `src/work/WorkCompanyOnboarding.jsx`
- Test: `src/work/WorkCompanyOnboarding.test.js`

**Interfaces:**
- Consumes: `WORK_COMPANY_SCENE_ASSETS.launch` and `.enter` from Task 1.
- Produces: semantic `.work-company-scene`, `.work-company-camera`, `.work-company-door`, and `.work-company-copy` elements for CSS.

- [ ] **Step 1: Write the failing component contract test**

Add these assertions to `src/work/WorkCompanyOnboarding.test.js`:

```js
test("launch and enter use fullscreen Orbit camera scenes", () => {
  assert.match(source, /WORK_COMPANY_SCENE_ASSETS/);
  assert.match(source, /const LAUNCH_DURATION_MS = 2200/);
  assert.match(source, /const ENTER_DURATION_MS = 2400/);
  assert.match(source, /work-company-scene is-launch-scene/);
  assert.match(source, /work-company-scene is-enter-scene/);
  assert.match(source, /work-company-camera/);
  assert.match(source, /work-company-door is-left/);
  assert.match(source, /work-company-door is-right/);
  assert.doesNotMatch(source, /work-company-launch-icon/);
  assert.doesNotMatch(source, /work-company-entry"/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/work/WorkCompanyOnboarding.test.js`

Expected: FAIL on the missing scene import and old durations/markup.

- [ ] **Step 3: Replace the launch phase**

Import the scene map and set the durations:

```jsx
import { WORK_COMPANY_SCENE_ASSETS } from "./officeAssets.js";

const LAUNCH_DURATION_MS = 2200;
const ENTER_DURATION_MS = 2400;
```

Render the launch phase as:

```jsx
<section className="work-company-onboarding is-launch" aria-label="工作 APP 启动">
  <div
    className="work-company-scene is-launch-scene"
    style={{ "--work-company-scene-image": `url(${WORK_COMPANY_SCENE_ASSETS.launch})` }}
    aria-hidden="true"
  >
    <span className="work-company-cloud is-one" />
    <span className="work-company-cloud is-two" />
    <span className="work-company-camera" />
  </div>
  <button className="work-company-skip" type="button" onClick={() => setPhase("create")}>跳过动画</button>
  <div className="work-company-copy is-launch-copy">
    <strong>工作中心</strong>
    <span>CCAT WORK</span>
  </div>
</section>
```

- [ ] **Step 4: Replace the enter phase**

Render the enter phase as:

```jsx
<section className="work-company-onboarding is-enter" aria-label="正在进入公司">
  <div
    className="work-company-scene is-enter-scene"
    style={{ "--work-company-scene-image": `url(${WORK_COMPANY_SCENE_ASSETS.enter})` }}
    aria-hidden="true"
  >
    <span className="work-company-camera" />
    <span className="work-company-door is-left" />
    <span className="work-company-door is-right" />
    <span className="work-company-office-dissolve" />
  </div>
  <button className="work-company-skip" type="button" onClick={() => onComplete(createdCompany)}>跳过动画</button>
  <div className="work-company-copy is-enter-copy">
    <strong>{createdCompany.fullName}</strong>
    <span>正在进入公司</span>
  </div>
</section>
```

- [ ] **Step 5: Run the component tests**

Run: `node --test src/work/WorkCompanyOnboarding.test.js src/work/workScreen.test.js`

Expected: PASS.

- [ ] **Step 6: Commit the semantic scene markup**

```bash
git add src/work/WorkCompanyOnboarding.jsx src/work/WorkCompanyOnboarding.test.js
git commit -m "feat(work): render fullscreen company camera scenes"
```

### Task 3: Animate the full-screen camera, clouds, doors, and office dissolve

**Files:**
- Modify: `src/work/office.css`
- Test: `src/work/WorkCompanyOnboarding.test.js`

**Interfaces:**
- Consumes: the semantic class names produced by Task 2.
- Produces: full-viewport visual behavior and the 150ms reduced-motion fallback.

- [ ] **Step 1: Write the failing visual contract test**

Read the stylesheet in `WorkCompanyOnboarding.test.js` and add:

```js
const styles = readFileSync("src/work/office.css", "utf8");

test("company animations fill the viewport and respect reduced motion", () => {
  assert.match(styles, /\.work-company-scene\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s);
  assert.match(styles, /background-image:\s*var\(--work-company-scene-image\)/);
  assert.match(styles, /@keyframes work-company-camera-launch/);
  assert.match(styles, /@keyframes work-company-camera-enter/);
  assert.match(styles, /@keyframes work-company-door-open-left/);
  assert.match(styles, /@keyframes work-company-door-open-right/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*\.15s/);
  assert.match(styles, /\.work-company-skip\s*\{[^}]*min-height:\s*44px/s);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/work/WorkCompanyOnboarding.test.js`

Expected: FAIL because the full-screen scene rules do not exist.

- [ ] **Step 3: Replace only the launch/enter animation CSS**

Keep the create-form rules intact. Remove the old compact icon, glow, entry-card, plaque, and their keyframes. Add rules with these behaviors:

```css
.work-company-scene { position:absolute; inset:0; overflow:hidden; background:#f4f8ff; }
.work-company-camera { position:absolute; inset:-4%; background-image:var(--work-company-scene-image); background-position:center; background-size:cover; background-repeat:no-repeat; will-change:transform,opacity; }
.is-launch-scene .work-company-camera { animation:work-company-camera-launch 2.2s cubic-bezier(.2,.7,.2,1) both; }
.is-enter-scene .work-company-camera { animation:work-company-camera-enter 2.4s cubic-bezier(.2,.72,.18,1) both; }
.work-company-copy { position:absolute; z-index:3; right:28px; bottom:max(54px,calc(28px + env(safe-area-inset-bottom,0px))); left:28px; color:#fff; text-align:center; text-shadow:0 3px 22px rgba(40,83,133,.34); }
.work-company-copy strong { display:block; overflow:hidden; font-family:Georgia,"Songti SC",serif; font-size:clamp(24px,7vw,34px); text-overflow:ellipsis; white-space:nowrap; }
.work-company-copy span { display:block; margin-top:8px; font-size:10px; font-weight:800; letter-spacing:.24em; }
.work-company-door { position:absolute; z-index:2; top:0; bottom:0; width:51%; background:linear-gradient(100deg,#fff,#eaf0fa 62%,#d5def0); box-shadow:inset 0 0 0 1px rgba(108,131,168,.16); }
.work-company-door.is-left { left:0; transform-origin:left center; animation:work-company-door-open-left 2.4s cubic-bezier(.72,0,.22,1) both; }
.work-company-door.is-right { right:0; transform-origin:right center; animation:work-company-door-open-right 2.4s cubic-bezier(.72,0,.22,1) both; }
@keyframes work-company-camera-launch { from { opacity:.55; transform:scale(1.04) translateY(1%); } to { opacity:1; transform:scale(1.18) translateY(-2%); } }
@keyframes work-company-camera-enter { 0% { transform:scale(1.02); } 100% { transform:scale(1.2) translateY(-2%); } }
@keyframes work-company-door-open-left { 0%,18% { transform:translateX(0); } 100% { transform:translateX(-104%); } }
@keyframes work-company-door-open-right { 0%,18% { transform:translateX(0); } 100% { transform:translateX(104%); } }
```

Add subtle cloud motion and a final dissolve into the existing office image:

```css
.work-company-cloud { position:absolute; z-index:1; width:42vw; height:18vw; border-radius:50%; background:rgba(255,255,255,.2); filter:blur(18px); }
.work-company-cloud.is-one { top:14%; left:-24%; animation:work-company-cloud-drift 2.2s linear both; }
.work-company-cloud.is-two { top:34%; right:-28%; animation:work-company-cloud-drift-reverse 2.2s linear both; }
.work-company-office-dissolve { position:absolute; inset:0; z-index:1; background:url("/ai-roleplay-phone/work-office-assets/orbit-office-background.png") center/cover no-repeat; opacity:0; animation:work-company-office-dissolve 2.4s ease both; }
@keyframes work-company-cloud-drift { to { transform:translateX(42vw); } }
@keyframes work-company-cloud-drift-reverse { to { transform:translateX(-42vw); } }
@keyframes work-company-office-dissolve { 0%,72% { opacity:0; } 100% { opacity:1; } }
```

Keep a white-blue gradient on `.work-company-onboarding::before` as the failed-image fallback:

```css
.work-company-onboarding::before { position:absolute; inset:0; z-index:-1; background:linear-gradient(165deg,#eaf6ff,#ffffff 58%,#eef0ff); content:""; }
```

- [ ] **Step 4: Add the reduced-motion override**

Inside the existing reduced-motion media query, make the camera, clouds, doors, copy, and dissolve use a 150ms fade with no translated or scaled end state:

```css
.work-company-camera,.work-company-cloud,.work-company-door,.work-company-copy,.work-company-office-dissolve { animation-duration:.15s !important; transform:none !important; }
```

- [ ] **Step 5: Run focused tests and build**

Run: `node --test src/work/WorkCompanyOnboarding.test.js src/work/officeAssets.test.js src/work/workScreen.test.js`

Expected: PASS.

Run: `npm run build`

Expected: Vite build succeeds and both new PNG URLs are present in the output.

- [ ] **Step 6: Commit the animation styling**

```bash
git add src/work/office.css src/work/WorkCompanyOnboarding.test.js
git commit -m "feat(work): animate fullscreen company entry"
```

### Task 4: Verify the complete first-run flow on mobile

**Files:**
- Verify only: `src/work/WorkCompanyOnboarding.jsx`
- Verify only: `src/work/office.css`
- Verify only: `public/work-office-assets/work-company-launch-background.png`
- Verify only: `public/work-office-assets/work-company-enter-background.png`

**Interfaces:**
- Consumes: all deliverables from Tasks 1–3.
- Produces: verification evidence; no new runtime API.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run a fresh production build**

Run: `npm run build`

Expected: Vite exits with code 0 and emits `dist/index.html`, CSS, JS, and both Work company scene PNGs.

- [ ] **Step 3: Exercise the flow at 390 × 844**

Start the local app and use browser control with a 390 × 844 viewport on a fresh origin. Verify:

1. unlock the phone and open Work;
2. the sky-walk launch scene fills the screen for about 2.2 seconds;
3. no compact icon card or exposed background edge appears;
4. the unchanged create form enforces five characters and appends `有限公司`;
5. submit and verify the curved doors open over the full-screen entry scene;
6. the company name remains inside the lower safe area;
7. the final frame dissolves into the existing office without a white flash;
8. close and reopen Work, then reload and reopen Work, and verify both go directly to the office;
9. verify both skip buttons advance the flow;
10. inspect console errors and confirm none are present.

- [ ] **Step 4: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce`, reload on a fresh origin, and confirm both animation stages complete through short fades without long camera or door movement.

- [ ] **Step 5: Review repository state**

Run: `git diff --check && git status --short && git log --oneline -6`

Expected: no whitespace errors, only the user's pre-existing untracked design/artifact files remain, and the feature commits are present.
