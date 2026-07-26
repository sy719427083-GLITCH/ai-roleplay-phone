# Work APP Breakroom Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a navigable tea room / employee restaurant scene with generated matching artwork, independently clickable facilities, collision-free walking, and a clickable print station replacing the office tea counter.

**Architecture:** Keep the new room isolated behind `BreakroomScene`, a declarative asset/facility module, and pure geometry/navigation modules. `WorkAppScreen` owns the transient `office` / `breakroom` view and the single controllable “Me” movement lifecycle, while both scenes consume the same character rendering and path timing primitives.

**Tech Stack:** React 19, lucide-react, CSS, Vite 6, Node test runner, existing A* pathfinding, built-in ImageGen, PNG chroma-key removal helper.

## Global Constraints

- Tea room and employee restaurant are one combined scene; there is no scene selection page.
- Use the approved zoned layout: appliances at the top and sides, one chairless dining table in the lower middle, and a continuous central walkway.
- Only the assigned “Me APP” profile is controllable.
- Every facility is a semantic button backed by a separate transparent PNG.
- The new background must match `orbit-office-background.png`: white futuristic architecture, rounded walls, blue-sky windows, soft natural light, pale blue and lavender accents.
- The office tea counter must be replaced by a clickable smart print/document station.
- Clicking a facility walks the character beside it without crossing visible furniture, then shows the approved two-second message.
- The office entry and breakroom return controls must provide at least 44 × 44px touch targets.
- Do not add a storage key or change the three-key Work cache reset boundary.
- Do not bump the release version, sync `docs/`, push, or deploy unless the user separately requests deployment.

---

### Task 1: Generate and validate the scene artwork

**Files:**
- Create: `public/work-office-assets/orbit-breakroom-background.png`
- Create: `public/work-office-assets/orbit-drink-counter.png`
- Create: `public/work-office-assets/orbit-coffee-machine.png`
- Create: `public/work-office-assets/orbit-fridge.png`
- Create: `public/work-office-assets/orbit-microwave.png`
- Create: `public/work-office-assets/orbit-snack-cabinet.png`
- Create: `public/work-office-assets/orbit-dining-table.png`
- Create: `public/work-office-assets/orbit-print-station.png`
- Create: `src/work/breakroomArtwork.test.js`

**Interfaces:**
- Consumes: `public/work-office-assets/orbit-office-background.png` as the style reference.
- Produces: one 852 × 1846 opaque RGB/RGBA background and seven non-empty RGBA facility PNGs for Tasks 3–5.

- [ ] **Step 1: Write the failing PNG contract test**

Create `src/work/breakroomArtwork.test.js`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ASSET_ROOT = new URL("../../public/work-office-assets/", import.meta.url);

function readPngHeader(fileName) {
  const bytes = readFileSync(new URL(fileName, ASSET_ROOT));
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${fileName} is PNG`);
  return {
    bytes,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

test("breakroom background matches the office portrait canvas", () => {
  const image = readPngHeader("orbit-breakroom-background.png");
  assert.equal(image.width, 852);
  assert.equal(image.height, 1846);
  assert.ok([2, 6].includes(image.colorType));
});

test("every clickable replacement is a substantial alpha PNG", () => {
  for (const fileName of [
    "orbit-drink-counter.png",
    "orbit-coffee-machine.png",
    "orbit-fridge.png",
    "orbit-microwave.png",
    "orbit-snack-cabinet.png",
    "orbit-dining-table.png",
    "orbit-print-station.png",
  ]) {
    const image = readPngHeader(fileName);
    assert.equal(image.colorType, 6, `${fileName} has RGBA pixels`);
    assert.ok(image.width >= 512, `${fileName} has production width`);
    assert.ok(image.height >= 320, `${fileName} has production height`);
    assert.ok(image.bytes.length >= 40_000, `${fileName} is not an empty placeholder`);
  }
});
```

- [ ] **Step 2: Run the artwork test to verify it fails**

Run: `node --test src/work/breakroomArtwork.test.js`

Expected: FAIL with `ENOENT` for `orbit-breakroom-background.png`.

- [ ] **Step 3: Generate the empty architectural background with built-in ImageGen**

First inspect the style reference with `view_image` at original detail. Then call built-in ImageGen with:

```text
Use case: stylized-concept
Asset type: portrait mobile game environment background
Input image: orbit-office-background.png is a strict style, lighting, perspective, material, and color reference only
Primary request: create an empty combined office tea room and employee restaurant interior in exactly the same visual world
Scene/backdrop: white futuristic rounded architecture, large blue-sky window, soft clouds, glossy pale floor, subtle pale-blue and lavender wall insets, a few non-interactive edge plants
Composition/framing: very tall portrait room, eye-level elevated game-camera perspective matching the reference, clear open floor, upper and side zones available for later furniture overlays, continuous central walking aisle, lower-left entrance space
Lighting/mood: bright soft daylight, airy, calm, clean
Constraints: architecture and fixed decorative plants only; no counter, no coffee machine, no refrigerator, no microwave, no snack cabinet, no table, no chairs, no people, no labels, no text, no watermark
Avoid: photorealistic office photography, dark shadows, wood-dominant decor, busy floor patterns, built-in furniture, perspective mismatch
```

Use `referenced_image_paths` with the absolute path `/Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/public/work-office-assets/orbit-office-background.png`. Copy the generated result into `tmp/imagegen/orbit-breakroom-background-source.png`, then normalize it without distortion:

```bash
mkdir -p tmp/imagegen
sips --resampleHeight 1846 tmp/imagegen/orbit-breakroom-background-source.png --out tmp/imagegen/orbit-breakroom-background-tall.png
sips --cropToHeightWidth 1846 852 tmp/imagegen/orbit-breakroom-background-tall.png --out public/work-office-assets/orbit-breakroom-background.png
```

- [ ] **Step 4: Generate each facility separately on a chroma-key background**

Issue one built-in ImageGen call per row. Use the office background as a style reference, and append this common constraint to every prompt:

```text
Use case: background-extraction
Asset type: isolated mobile game furniture overlay
Style/medium: polished soft 3D illustration matching the white futuristic office reference, same elevated perspective and daylight direction
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background
Constraints: one complete isolated object, centered, generous padding, grounded front-facing three-quarter view, crisp silhouette; the background is one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation; do not use #00ff00 in the object
Avoid: people, labels, text, watermark, chairs, cropped edges, cast shadow, contact shadow, background architecture
```

| Output source filename | Exact primary request |
| --- | --- |
| `orbit-drink-counter-source.png` | A compact curved white-and-pale-blue beverage counter with a clean serving top and subtle lavender accent, no appliances attached |
| `orbit-coffee-machine-source.png` | A compact futuristic white automatic coffee machine with pale-blue display details and rounded housing |
| `orbit-fridge-source.png` | A rounded upright white employee refrigerator with pale-blue glass-like accent panel, closed doors |
| `orbit-microwave-source.png` | A compact rounded white microwave unit on a low integrated pale-blue cabinet, closed door |
| `orbit-snack-cabinet-source.png` | A compact rounded white snack display cabinet with pastel packaged silhouettes behind glass, no readable text |
| `orbit-dining-table-source.png` | One long rounded white employee dining table with pale-lavender edge trim, absolutely no chairs or stools |
| `orbit-print-station-source.png` | A wide smart office print and document station with a central white printer, pale-blue screen, and low rounded filing cabinets on both sides |

Copy each returned image into `tmp/imagegen/` using the exact source filename in the table.

- [ ] **Step 5: Remove chroma key and validate transparency**

Run the installed helper once per source:

```bash
for asset in drink-counter coffee-machine fridge microwave snack-cabinet dining-table print-station; do
  python /Users/mypc/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py \
    --input "tmp/imagegen/orbit-${asset}-source.png" \
    --out "public/work-office-assets/orbit-${asset}.png" \
    --auto-key border \
    --soft-matte \
    --transparent-threshold 12 \
    --opaque-threshold 220 \
    --despill
done
```

Inspect all eight final images with `view_image`. If one extracted object has a thin green fringe, rerun only that object with `--edge-contract 1`; do not replace accepted assets while correcting another.

- [ ] **Step 6: Run tests and commit the artwork**

Run: `node --test src/work/breakroomArtwork.test.js`

Expected: 2 tests pass.

```bash
git add public/work-office-assets/orbit-breakroom-*.png \
  public/work-office-assets/orbit-drink-counter.png \
  public/work-office-assets/orbit-coffee-machine.png \
  public/work-office-assets/orbit-fridge.png \
  public/work-office-assets/orbit-microwave.png \
  public/work-office-assets/orbit-snack-cabinet.png \
  public/work-office-assets/orbit-dining-table.png \
  public/work-office-assets/orbit-print-station.png \
  src/work/breakroomArtwork.test.js
git commit -m "feat(work): add breakroom scene artwork"
```

### Task 2: Add pure breakroom geometry and collision-free navigation

**Files:**
- Create: `src/work/breakroomGeometry.js`
- Create: `src/work/breakroomNavigation.js`
- Create: `src/work/breakroomNavigation.test.js`

**Interfaces:**
- Consumes: `planOfficePath`, `getSegmentDuration`, and `getSegmentFacing` from `officePathfinding.js`.
- Produces: `BREAKROOM_ENTRY_POINT`, `BREAKROOM_INTERACTION_POINTS`, `BREAKROOM_LAYOUT`, `getBreakroomPoint(id)`, `getBreakroomGeometry(viewport)`, `BREAKROOM_DESTINATIONS`, and `createBreakroomRoute({ from, destination, viewport })`.

- [ ] **Step 1: Write the failing navigation tests**

Create `src/work/breakroomNavigation.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { getBreakroomGeometry, getBreakroomPoint } from "./breakroomGeometry.js";
import { BREAKROOM_DESTINATIONS, createBreakroomRoute } from "./breakroomNavigation.js";

const viewport = { width: 390, height: 844 };

function inside(point, obstacle) {
  return point.x > obstacle.left && point.x < obstacle.right
    && point.y > obstacle.top && point.y < obstacle.bottom;
}

test("declares the approved zoned room destinations", () => {
  assert.deepEqual(BREAKROOM_DESTINATIONS, {
    drinkCounter: "drink-counter",
    coffeeMachine: "coffee-machine",
    fridge: "fridge",
    microwave: "microwave",
    snackCabinet: "snack-cabinet",
    diningTable: "dining-table",
  });
  assert.equal(Object.keys(BREAKROOM_DESTINATIONS).some((key) => key.toLowerCase().includes("chair")), false);
});

test("routes from the entrance to every facility without crossing furniture", () => {
  const geometry = getBreakroomGeometry(viewport);
  for (const destination of Object.values(BREAKROOM_DESTINATIONS)) {
    const route = createBreakroomRoute({
      from: getBreakroomPoint("entry"),
      destination,
      viewport,
    });
    assert.ok(route.length > 0, `entry routes to ${destination}`);
    assert.deepEqual(route.at(-1).point, getBreakroomPoint(destination));
    assert.equal(route.every((segment) => geometry.obstacles.every((obstacle) => !inside(segment.point, obstacle))), true);
    assert.equal(route.every((segment) => segment.durationMs >= 240), true);
  }
});

test("routes between every facility and rejects missing destinations", () => {
  for (const fromId of Object.values(BREAKROOM_DESTINATIONS)) {
    for (const destination of Object.values(BREAKROOM_DESTINATIONS)) {
      const route = createBreakroomRoute({ from: getBreakroomPoint(fromId), destination, viewport });
      if (fromId === destination) assert.deepEqual(route, []);
      else assert.deepEqual(route.at(-1).point, getBreakroomPoint(destination));
    }
  }
  assert.deepEqual(createBreakroomRoute({ from: getBreakroomPoint("entry"), destination: "missing", viewport }), []);
});
```

- [ ] **Step 2: Run the navigation test to verify it fails**

Run: `node --test src/work/breakroomNavigation.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `breakroomGeometry.js`.

- [ ] **Step 3: Implement normalized geometry**

Create `src/work/breakroomGeometry.js`:

```js
const AVATAR_CLEARANCE_PX = 28;

export const BREAKROOM_ENTRY_POINT = Object.freeze({ x: 12, y: 83 });

export const BREAKROOM_INTERACTION_POINTS = Object.freeze({
  "drink-counter": Object.freeze({ x: 48, y: 31 }),
  "coffee-machine": Object.freeze({ x: 58, y: 31 }),
  fridge: Object.freeze({ x: 43, y: 40 }),
  microwave: Object.freeze({ x: 57, y: 40 }),
  "snack-cabinet": Object.freeze({ x: 57, y: 77 }),
  "dining-table": Object.freeze({ x: 50, y: 53 }),
});

export const BREAKROOM_LAYOUT = Object.freeze({
  drinkCounter: Object.freeze({ left: 0, top: 7, width: 55, height: 18 }),
  coffeeMachine: Object.freeze({ left: 70, top: 9, width: 26, height: 15 }),
  fridge: Object.freeze({ left: 1, top: 26, width: 29, height: 20 }),
  microwave: Object.freeze({ left: 70, top: 28, width: 29, height: 17 }),
  diningTable: Object.freeze({ left: 15, top: 57, width: 70, height: 16 }),
  snackCabinet: Object.freeze({ left: 71, top: 69, width: 28, height: 17 }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function obstacle(id, layout, viewport) {
  const horizontal = (AVATAR_CLEARANCE_PX / viewport.width) * 100;
  const vertical = (AVATAR_CLEARANCE_PX / viewport.height) * 100;
  return {
    id,
    left: clamp(layout.left - horizontal, 0, 100),
    top: clamp(layout.top - vertical, 0, 100),
    right: clamp(layout.left + layout.width + horizontal, 0, 100),
    bottom: clamp(layout.top + layout.height + vertical, 0, 100),
    visible: {
      id,
      left: layout.left,
      top: layout.top,
      right: layout.left + layout.width,
      bottom: layout.top + layout.height,
    },
  };
}

export function getBreakroomPoint(id) {
  if (id === "entry") return BREAKROOM_ENTRY_POINT;
  return BREAKROOM_INTERACTION_POINTS[id] ?? null;
}

export function getBreakroomGeometry(viewport) {
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) {
    throw new TypeError("A positive breakroom viewport is required");
  }
  return {
    obstacles: Object.entries(BREAKROOM_LAYOUT).map(([id, layout]) => obstacle(id, layout, viewport)),
    entryPoint: BREAKROOM_ENTRY_POINT,
    interactionPoints: BREAKROOM_INTERACTION_POINTS,
  };
}
```

- [ ] **Step 4: Implement timed route creation**

Create `src/work/breakroomNavigation.js`:

```js
import { getBreakroomGeometry, getBreakroomPoint } from "./breakroomGeometry.js";
import { getSegmentDuration, getSegmentFacing, planOfficePath } from "./officePathfinding.js";

export const BREAKROOM_DESTINATIONS = Object.freeze({
  drinkCounter: "drink-counter",
  coffeeMachine: "coffee-machine",
  fridge: "fridge",
  microwave: "microwave",
  snackCabinet: "snack-cabinet",
  diningTable: "dining-table",
});

export function createBreakroomRoute({ from, destination, viewport }) {
  const goal = getBreakroomPoint(destination);
  if (!from || !goal || !viewport) return [];
  const geometry = getBreakroomGeometry(viewport);
  const path = planOfficePath({ start: from, goal, viewport, obstacles: geometry.obstacles });
  return path.slice(1).map((point, index) => {
    const previous = path[index];
    return {
      point,
      durationMs: getSegmentDuration(previous, point, viewport),
      facing: getSegmentFacing(previous, point),
    };
  });
}
```

- [ ] **Step 5: Run navigation tests and commit**

Run: `node --test src/work/breakroomNavigation.test.js src/work/officeNavigation.test.js`

Expected: all navigation tests pass. If the new collision assertions reveal an unreachable stop point, adjust only the normalized layout or interaction points and rerun until every approved destination is reachable.

```bash
git add src/work/breakroomGeometry.js src/work/breakroomNavigation.js src/work/breakroomNavigation.test.js
git commit -m "feat(work): add breakroom navigation"
```

### Task 3: Declare facilities and render the breakroom scene

**Files:**
- Create: `src/work/breakroomAssets.js`
- Create: `src/work/BreakroomScene.jsx`
- Create: `src/work/BreakroomScene.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `BREAKROOM_DESTINATIONS`, `BREAKROOM_LAYOUT`, `OfficeCharacter`, one optional `meOccupant`, and movement state `{ point, moving, facing, durationMs }`.
- Produces: `BREAKROOM_BACKGROUND_URL`, `BREAKROOM_FACILITIES`, and `<BreakroomScene sceneRef meOccupant movement onFacilityClick onBack />`.

- [ ] **Step 1: Write the failing source contract test**

Create `src/work/BreakroomScene.test.js`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const assets = readFileSync("src/work/breakroomAssets.js", "utf8");
const scene = readFileSync("src/work/BreakroomScene.jsx", "utf8");
const styles = readFileSync("src/work/office.css", "utf8");

test("renders all approved chairless clickable facilities", () => {
  for (const text of [
    "饮品吧台", "咖啡机", "冰箱", "微波炉", "零食柜", "员工餐桌",
    "正在挑选饮品", "正在制作咖啡", "正在查看冰箱",
    "正在加热餐食", "正在挑选零食", "正在用餐",
  ]) assert.match(assets, new RegExp(text));
  assert.doesNotMatch(assets, /椅子|chair/i);
  assert.match(scene, /BREAKROOM_FACILITIES\.map/);
  assert.match(scene, /<button/);
  assert.match(scene, /<OfficeCharacter/);
  assert.match(scene, /aria-label="返回办公室"/);
});

test("breakroom layout follows the approved zones and touch sizes", () => {
  assert.match(styles, /\.breakroom-scene\s*\{/);
  assert.match(styles, /\.breakroom-object\.drink-counter\s*\{[^}]*top:\s*7%;[^}]*left:\s*0;[^}]*width:\s*55%;[^}]*height:\s*18%/s);
  assert.match(styles, /\.breakroom-object\.dining-table\s*\{[^}]*top:\s*57%;[^}]*left:\s*15%;[^}]*width:\s*70%;[^}]*height:\s*16%/s);
  assert.match(styles, /\.breakroom-back\s*\{[^}]*width:\s*46px;[^}]*height:\s*46px/s);
});
```

- [ ] **Step 2: Run the scene test to verify it fails**

Run: `node --test src/work/BreakroomScene.test.js`

Expected: FAIL because `breakroomAssets.js` does not exist.

- [ ] **Step 3: Declare background and facility contracts**

Create `src/work/breakroomAssets.js`:

```js
import { BREAKROOM_LAYOUT } from "./breakroomGeometry.js";
import { BREAKROOM_DESTINATIONS } from "./breakroomNavigation.js";

export const BREAKROOM_BACKGROUND_URL = "/ai-roleplay-phone/work-office-assets/orbit-breakroom-background.png";

export const BREAKROOM_FACILITIES = Object.freeze([
  { id: "drinkCounter", kind: "drink-counter", label: "饮品吧台", destination: BREAKROOM_DESTINATIONS.drinkCounter, message: "正在挑选饮品", asset: "/ai-roleplay-phone/work-office-assets/orbit-drink-counter.png", layout: BREAKROOM_LAYOUT.drinkCounter },
  { id: "coffeeMachine", kind: "coffee-machine", label: "咖啡机", destination: BREAKROOM_DESTINATIONS.coffeeMachine, message: "正在制作咖啡", asset: "/ai-roleplay-phone/work-office-assets/orbit-coffee-machine.png", layout: BREAKROOM_LAYOUT.coffeeMachine },
  { id: "fridge", kind: "fridge", label: "冰箱", destination: BREAKROOM_DESTINATIONS.fridge, message: "正在查看冰箱", asset: "/ai-roleplay-phone/work-office-assets/orbit-fridge.png", layout: BREAKROOM_LAYOUT.fridge },
  { id: "microwave", kind: "microwave", label: "微波炉", destination: BREAKROOM_DESTINATIONS.microwave, message: "正在加热餐食", asset: "/ai-roleplay-phone/work-office-assets/orbit-microwave.png", layout: BREAKROOM_LAYOUT.microwave },
  { id: "snackCabinet", kind: "snack-cabinet", label: "零食柜", destination: BREAKROOM_DESTINATIONS.snackCabinet, message: "正在挑选零食", asset: "/ai-roleplay-phone/work-office-assets/orbit-snack-cabinet.png", layout: BREAKROOM_LAYOUT.snackCabinet },
  { id: "diningTable", kind: "dining-table", label: "员工餐桌", destination: BREAKROOM_DESTINATIONS.diningTable, message: "正在用餐", asset: "/ai-roleplay-phone/work-office-assets/orbit-dining-table.png", layout: BREAKROOM_LAYOUT.diningTable },
]);
```

- [ ] **Step 4: Render the scene and return control**

Create `src/work/BreakroomScene.jsx`:

```jsx
import { ChevronLeft } from "lucide-react";
import { BREAKROOM_BACKGROUND_URL, BREAKROOM_FACILITIES } from "./breakroomAssets.js";
import { OfficeCharacter } from "./OfficeCharacter.jsx";

export function BreakroomScene({ sceneRef, meOccupant, movement, onFacilityClick, onBack }) {
  return (
    <main ref={sceneRef} className="breakroom-scene" style={{ backgroundImage: `url(${BREAKROOM_BACKGROUND_URL})` }}>
      <button className="breakroom-back" type="button" onClick={onBack} aria-label="返回办公室">
        <ChevronLeft size={22} />
      </button>
      {BREAKROOM_FACILITIES.map((facility) => (
        <button
          type="button"
          key={facility.id}
          className={`breakroom-object ${facility.kind}`}
          aria-label={facility.label}
          onClick={() => onFacilityClick(facility)}
        >
          <img src={facility.asset} alt="" draggable="false" />
        </button>
      ))}
      {meOccupant && <OfficeCharacter {...meOccupant} node={movement.point} durationMs={movement.durationMs} moving={movement.moving} facing={movement.facing} />}
    </main>
  );
}
```

- [ ] **Step 5: Add the zoned CSS and transition primitives**

Append to `src/work/office.css`:

```css
.breakroom-scene { position:relative; min-height:0; overflow:hidden; background-color:#f8fbff; background-position:center; background-size:100% 100%; background-repeat:no-repeat; isolation:isolate; animation:work-scene-slide-in .28s cubic-bezier(.2,.72,.2,1) both; }
.breakroom-back { position:absolute; z-index:20; top:calc(14px + env(safe-area-inset-top,0px)); left:14px; display:grid; width:46px; height:46px; place-items:center; border:1px solid rgba(255,255,255,.88); border-radius:50%; background:rgba(255,255,255,.78); color:#417ad4; box-shadow:0 8px 24px rgba(58,92,153,.16); backdrop-filter:blur(11px); }
.breakroom-object { position:absolute; z-index:3; min-width:44px; min-height:44px; border:0; background:transparent; padding:0; -webkit-tap-highlight-color:transparent; }
.breakroom-object img { width:100%; height:100%; object-fit:contain; pointer-events:none; }
.breakroom-object:focus-visible { outline:3px solid rgba(69,143,245,.78); outline-offset:3px; border-radius:24px; }
.breakroom-object:active { transform:scale(.975); }
.breakroom-object.drink-counter { top:7%; left:0; width:55%; height:18%; }
.breakroom-object.coffee-machine { top:9%; left:70%; width:26%; height:15%; }
.breakroom-object.fridge { top:26%; left:1%; width:29%; height:20%; }
.breakroom-object.microwave { top:28%; left:70%; width:29%; height:17%; }
.breakroom-object.dining-table { top:57%; left:15%; width:70%; height:16%; }
.breakroom-object.snack-cabinet { top:69%; left:71%; width:28%; height:17%; }
.work-breakroom-entry { position:absolute; z-index:19; top:50%; right:8px; display:grid; width:46px; height:46px; place-items:center; border:1px solid rgba(255,255,255,.9); border-radius:50%; background:rgba(255,255,255,.76); color:#417ad4; box-shadow:0 8px 24px rgba(58,92,153,.18); backdrop-filter:blur(11px); transform:translateY(-50%); }
.work-breakroom-entry:active { transform:translateY(-50%) scale(.94); }
@keyframes work-scene-slide-in { from { opacity:.5; transform:translateX(8%); } to { opacity:1; transform:translateX(0); } }
```

- [ ] **Step 6: Run the scene tests and commit**

Run: `node --test src/work/BreakroomScene.test.js src/work/breakroomArtwork.test.js src/work/breakroomNavigation.test.js`

Expected: all tests pass.

```bash
git add src/work/breakroomAssets.js src/work/BreakroomScene.jsx src/work/BreakroomScene.test.js src/work/office.css
git commit -m "feat(work): render breakroom scene"
```

### Task 4: Replace the office tea counter with the print station

**Files:**
- Modify: `src/work/officeAssets.js`
- Modify: `src/work/officeGeometry.js`
- Modify: `src/work/officeNavigation.js`
- Modify: `src/work/officeNavigation.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `orbit-print-station.png` from Task 1.
- Produces: office furniture item `{ id: "printStation", destination: "print-station", message: "正在处理文件" }` and matching geometry/navigation.

- [ ] **Step 1: Update the office navigation test first**

Replace the destination-key assertion in `src/work/officeNavigation.test.js` with:

```js
test("keeps every desk and replaces the tea counter with a print station", () => {
  assert.deepEqual(Object.keys(OBJECT_DESTINATIONS), [
    "bossDesk",
    "employee1Desk",
    "employee2Desk",
    "employee3Desk",
    "employee4Desk",
    "employee5Desk",
    "employee6Desk",
    "printStation",
  ]);
  assert.equal(OBJECT_DESTINATIONS.printStation, "print-station");
  assert.equal(Object.keys(OBJECT_DESTINATIONS).includes("tea"), false);
});
```

Add this source contract:

```js
test("office declares the clickable smart print station", () => {
  const assets = readFileSync("src/work/officeAssets.js", "utf8");
  assert.match(assets, /智能打印资料区/);
  assert.match(assets, /正在处理文件/);
  assert.match(assets, /orbit-print-station\.png/);
  assert.doesNotMatch(assets, /茶水吧台|orbit-tea-counter\.png/);
});
```

Add `import { readFileSync } from "node:fs";` to the test file.

- [ ] **Step 2: Run the office navigation test to verify it fails**

Run: `node --test src/work/officeNavigation.test.js`

Expected: FAIL because the destination is still named `tea`.

- [ ] **Step 3: Replace the office asset and interaction contract**

In `src/work/officeAssets.js`:

```js
export const OFFICE_OBJECT_ASSETS = {
  bossDesk: "/ai-roleplay-phone/work-office-assets/orbit-boss-desk.png",
  employeeDesk: "/ai-roleplay-phone/work-office-assets/orbit-employee-desk.png",
  printStation: "/ai-roleplay-phone/work-office-assets/orbit-print-station.png",
};

// Keep the existing desk entries, then use this final item:
{ id: "printStation", kind: "print-station", label: "智能打印资料区", destination: OBJECT_DESTINATIONS.printStation, message: "正在处理文件", asset: OFFICE_OBJECT_ASSETS.printStation }
```

In `src/work/officeGeometry.js`, rename `OFFICE_LAYOUT.tea` to `OFFICE_LAYOUT.printStation`, rename `getTeaObstacle` to `getPrintStationObstacle`, use obstacle id `printStation`, and replace the interaction point with:

```js
export const OFFICE_INTERACTION_POINTS = Object.freeze({
  "print-station": Object.freeze({ x: 93, y: 29 }),
});
```

In `src/work/officeNavigation.js`, replace the final destination with:

```js
printStation: "print-station",
```

- [ ] **Step 4: Rename the scoped office CSS hook**

Replace `.office-object.tea` with:

```css
.office-object.print-station { z-index:2; top:9%; right:0; width:54%; height:16%; }
```

- [ ] **Step 5: Run office tests and commit**

Run: `node --test src/work/officeNavigation.test.js src/work/officeGeometry.test.js src/work/officeAssets.test.js src/work/workScreen.test.js`

Expected: all tests pass after updating any existing source-contract wording from tea counter to print station.

```bash
git add src/work/officeAssets.js src/work/officeGeometry.js src/work/officeNavigation.js src/work/officeNavigation.test.js src/work/office.css src/work/officeGeometry.test.js src/work/officeAssets.test.js src/work/workScreen.test.js
git commit -m "feat(work): replace tea counter with print station"
```

### Task 5: Integrate scene switching, movement, and arrival notices

**Files:**
- Modify: `src/work/OfficeScene.jsx`
- Modify: `src/work/WorkAppScreen.jsx`
- Modify: `src/work/workScreen.test.js`
- Modify: `src/work/office.css`

**Interfaces:**
- Consumes: `<BreakroomScene />`, `createBreakroomRoute`, `getBreakroomPoint`, and facility/office target objects containing `{ destination, message }`.
- Produces: transient `activeScene: "office" | "breakroom"`, right-edge scene entry, safe route cancellation, scene-aware movement, and two-second notices.

- [ ] **Step 1: Add failing integration assertions**

Add to `src/work/workScreen.test.js`:

```js
test("office switches to a navigable breakroom without changing persistent state", () => {
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  const officeScene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  const styles = readFileSync("src/work/office.css", "utf8");
  assert.match(screen, /import \{ BreakroomScene \} from "\.\/BreakroomScene\.jsx"/);
  assert.match(screen, /activeScene/);
  assert.match(screen, /createBreakroomRoute/);
  assert.match(screen, /getBreakroomPoint\("entry"\)/);
  assert.match(screen, /<BreakroomScene/);
  assert.match(officeScene, /aria-label="进入茶水间和员工餐厅"/);
  assert.match(styles, /\.work-breakroom-entry\s*\{[^}]*width:\s*46px;[^}]*height:\s*46px/s);
  assert.doesNotMatch(screen, /localStorage[^\n]*breakroom|BREAKROOM_STORAGE_KEY/i);
});

test("scene targets carry their approved arrival messages", () => {
  const officeScene = readFileSync("src/work/OfficeScene.jsx", "utf8");
  const screen = readFileSync("src/work/WorkAppScreen.jsx", "utf8");
  assert.match(officeScene, /onObjectClick\(item\)/);
  assert.match(screen, /target\.message/);
  assert.match(screen, /window\.setTimeout\(.*2000/s);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `node --test src/work/workScreen.test.js`

Expected: FAIL because `BreakroomScene` is not imported or rendered.

- [ ] **Step 3: Expose the office entry and complete target object**

Change `OfficeScene` to accept `onEnterBreakroom`, pass `item` to `onObjectClick`, and render the entry after furniture:

```jsx
<button className="work-breakroom-entry" type="button" onClick={onEnterBreakroom} aria-label="进入茶水间和员工餐厅">
  <ChevronRight size={22} />
</button>
```

Import `ChevronRight` from `lucide-react`.

- [ ] **Step 4: Add transient scene and movement setup**

In `WorkAppScreen.jsx`, import:

```jsx
import { BreakroomScene } from "./BreakroomScene.jsx";
import { getBreakroomPoint } from "./breakroomGeometry.js";
import { createBreakroomRoute } from "./breakroomNavigation.js";
```

Add state and refs beside the existing office movement state:

```jsx
const [activeScene, setActiveScene] = useState("office");
const breakroomSceneRef = useRef(null);
const noticeTimer = useRef(null);
```

Extend unmount cleanup:

```js
window.clearTimeout(noticeTimer.current);
```

Add a route-cancellation helper:

```js
const cancelMovement = () => {
  movementRun.current += 1;
  window.clearTimeout(movementTimer.current);
};
```

- [ ] **Step 5: Make movement scene-aware and show arrival messages**

Replace `moveMe(destination)` with `moveMe(target)` so it selects the active ref and route factory:

```js
const moveMe = (target) => {
  if (!meOccupant) return showNotice("请先在员工管理中安排“我 APP”的角色");
  if (meMovement.moving) return;
  const activeRef = activeScene === "breakroom" ? breakroomSceneRef : sceneRef;
  const bounds = activeRef.current?.getBoundingClientRect();
  if (!bounds) return showNotice(activeScene === "breakroom" ? "茶水间路线暂时不可用" : "办公室路线暂时不可用");
  const routeFactory = activeScene === "breakroom" ? createBreakroomRoute : createOfficeRoute;
  const route = routeFactory({
    from: meMovement.point,
    destination: target.destination,
    viewport: { width: bounds.width, height: bounds.height },
  });
  if (!route.length) {
    const point = activeScene === "breakroom" ? getBreakroomPoint(target.destination) : getOfficePoint(target.destination);
    const alreadyThere = point && point.x === meMovement.point.x && point.y === meMovement.point.y;
    if (!alreadyThere) showNotice("这里暂时没有可通行的路线");
    else if (target.message) showNotice(target.message, 2000);
    return;
  }
  window.clearTimeout(movementTimer.current);
  const run = movementRun.current + 1;
  movementRun.current = run;
  const advance = () => {
    if (movementRun.current !== run) return;
    const segment = route.shift();
    if (!segment) {
      setMeMovement((value) => ({ ...value, moving: false, durationMs: 0 }));
      if (activeScene === "office") dispatch({ type: "SET_WAYPOINT", waypoint: target.destination });
      if (target.message) showNotice(target.message, 2000);
      return;
    }
    setMeMovement({ point: segment.point, moving: true, facing: segment.facing, durationMs: segment.durationMs });
    movementTimer.current = window.setTimeout(advance, segment.durationMs);
  };
  advance();
};
```

Update `showNotice` to accept a duration and clear the previous notice timer:

```js
const showNotice = (text, durationMs = 2200) => {
  setNotice(text);
  window.clearTimeout(noticeTimer.current);
  noticeTimer.current = window.setTimeout(() => setNotice(""), durationMs);
};
```

- [ ] **Step 6: Add safe enter and return transitions**

Add:

```js
const enterBreakroom = () => {
  cancelMovement();
  setActiveScene("breakroom");
  setMeMovement({ point: getBreakroomPoint("entry"), moving: false, facing: "right", durationMs: 0 });
};

const returnToOffice = () => {
  cancelMovement();
  setActiveScene("office");
  const home = meOccupant ? `${meOccupant.slotId}-home` : state.meWaypoint;
  setMeMovement({ point: getOfficePoint(home), moving: false, facing: "right", durationMs: 0 });
};
```

In the office shell, replace the scene render with:

```jsx
{activeScene === "breakroom" ? (
  <BreakroomScene
    sceneRef={breakroomSceneRef}
    meOccupant={meOccupant}
    movement={meMovement}
    onFacilityClick={moveMe}
    onBack={returnToOffice}
  />
) : (
  <OfficeScene
    sceneRef={sceneRef}
    occupants={occupants}
    meMovement={meMovement}
    onObjectClick={moveMe}
    onEnterBreakroom={enterBreakroom}
  />
)}
```

Keep the existing Work bottom navigation and notice after this conditional so both scenes share them.

- [ ] **Step 7: Run focused tests and commit**

Run:

```bash
node --test \
  src/work/breakroomArtwork.test.js \
  src/work/breakroomNavigation.test.js \
  src/work/BreakroomScene.test.js \
  src/work/officeNavigation.test.js \
  src/work/workScreen.test.js
npm run build
```

Expected: all focused tests pass and Vite exits with code 0.

```bash
git add src/work/OfficeScene.jsx src/work/WorkAppScreen.jsx src/work/workScreen.test.js src/work/office.css
git commit -m "feat(work): navigate between office and breakroom"
```

### Task 6: Full regression and 390 × 844 visual QA

**Files:**
- Verify only: `src/work/WorkAppScreen.jsx`
- Verify only: `src/work/BreakroomScene.jsx`
- Verify only: `src/work/breakroomGeometry.js`
- Verify only: `public/work-office-assets/orbit-breakroom-background.png`
- Verify only: all seven generated facility PNGs.

**Interfaces:**
- Consumes: all Tasks 1–5 deliverables.
- Produces: test, build, source-state, and browser evidence ready for branch completion.

- [ ] **Step 1: Run the complete automated verification**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: the full Node suite has zero failures, Vite exits with code 0, and `git diff --check` prints nothing.

- [ ] **Step 2: Verify image and source boundaries**

Run:

```bash
node --test src/work/breakroomArtwork.test.js
rg -n "BREAKROOM_STORAGE_KEY|localStorage.*breakroom|椅子|chair" src/work public/work-office-assets
rg -n "ccatWorkCompanyV1|ccatWorkOfficeV1|ccatWorkProjectsV1" src/work/workCache.js src/work/workCache.test.js
```

Expected: artwork tests pass; the forbidden breakroom storage/chair search has no product-code matches outside deliberate negative test assertions; the cache boundary still lists exactly the existing three keys.

- [ ] **Step 3: Verify the complete mobile interaction at 390 × 844**

Use the in-app browser against the local Vite server and verify:

1. unlock the phone and open Work;
2. create a company only if the test origin has no company;
3. confirm the office tea counter is gone and the smart print/document station is visible;
4. confirm the right-edge arrow is visible, at least 44 × 44px, and does not cover furniture or bottom navigation;
5. click the arrow and confirm the combined room uses the approved white-futuristic background and zoned layout;
6. confirm the table has no chairs and all six facilities are separate clickable objects;
7. with no “Me APP” occupant, click a facility and verify the employee-management prompt;
8. with a “Me APP” occupant, click every facility and confirm the avatar walks around rather than through each visible PNG;
9. confirm each approved arrival message appears and disappears after about two seconds;
10. return while moving and verify no old movement continues in the office;
11. confirm the avatar returns to its assigned desk and employee/project state is unchanged;
12. inspect browser console errors and confirm none are present.

- [ ] **Step 4: Review repository state**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: the feature files and generated assets are committed; only the user's pre-existing untracked `artifacts/` and `designs/` files remain.
