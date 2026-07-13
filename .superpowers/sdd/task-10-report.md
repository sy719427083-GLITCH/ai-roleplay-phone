# Task 10 Report: Future Game and Cthulhu Route Batch

## Scope

Implemented batch E for these themes:

- `cyberpunk`
- `scifi`
- `alien_civilization`
- `online_game`
- `cthulhu`

Owned files changed:

- `src/workRouteBatches/batch-e.js`
- `src/workRouteBatchE.test.js`
- `public/work-map-assets/map-cyberpunk.png`
- `public/work-map-assets/map-scifi.png`
- `public/work-map-assets/map-alien-civilization.png`
- `public/work-map-assets/map-online-game.png`
- `public/work-map-assets/map-cthulhu.png`
- `docs/superpowers/qa/routes-batch-e-contact-sheet.png`
- `.superpowers/sdd/task-10-report.md`

I did not edit `src/workRouteData.js`, `src/workThemes.js`, `src/App.jsx`, `src/styles.css`, package files, other batch modules/tests/assets, version/deployment files, or `designs/`.

## Map Audit Decisions

- `cyberpunk`: retained after original-resolution inspection. It has six clear structures, visible doors, connected elevated roads, and upper-right selector clearance. Resampled from 941x1672 to exact 945x1680 without cropping.
- `scifi`: retained after original-resolution inspection. It has six clear structures, visible station corridors, and selector clearance. Resampled from 941x1672 to exact 945x1680 without cropping.
- `alien_civilization`: retained after original-resolution inspection. It has six clear structures, visible alien causeways, and selector clearance. Resampled from 941x1672 to exact 945x1680 without cropping.
- `online_game`: redrawn because the audit identified selector/quality concerns and the previous art was a redraw candidate. Final asset was generated with the built-in `image_gen` tool, then resampled to exact 945x1680.
- `cthulhu`: redrawn because the audit identified selector/quality concerns and the previous art was a redraw candidate. A first generated pass merged the archive/observatory into one destination and was rejected. The final asset was generated with the built-in `image_gen` tool, then resampled to exact 945x1680.

No generated or rejected image variants were placed in the worktree. Temporary calibration overlays stayed under `/tmp`.

## Final Redraw Prompts

### `online_game`

```text
Use case: stylized-concept
Asset type: mobile work-map game background, final app asset
Primary request: Create a clean detailed illustrated 9:16 portrait map for an online fantasy MMORPG main city, completely empty of people. Exactly six prominent destination buildings and no other prominent buildings: 1) quest guild hall with blank notice-board shapes and no readable writing, 2) player market pavilion with still-life item stalls but no shopkeepers, 3) raid gate portal building, 4) crafting forge/workshop, 5) ranking tower/arena monument with no humanoid statues, and 6) a visually distinct cozy protagonist home. All six buildings must be in the upper and middle portions of the image. Make every door or entrance clearly visible.
Scene/backdrop: bright fantasy game-world meadow city with mountains, pines, waterfalls, glowing crystals, and soft game-like lighting. The lower third must stay mostly scenic meadow/path background with no buildings so app UI can sit over it.
Composition/framing: bird's-eye/isometric illustrated map, portrait 9:16, full map visible without destructive cropping. Upper-right 12% by 12% of the image must be scenery-only clearance: sky/mountain/trees only, no building, door, marker destination, or road junction there.
Road network: visible connected stone/game-world paths from the home entrance to every work-building entrance. Use a believable shared network with curves, a small plaza roundabout, bridge/steps/branching path, and gentle bends; do not make five direct spokes. Entrances connect to roads.
Style/medium: polished mobile game map illustration, smooth shading, low visual noise, controlled texture, readable road edges.
Constraints: exactly six prominent buildings total; six visible entrances; no humans; no NPCs; no avatars; no animals; no creatures; no humanoid statues; no UI; no markers; no path overlays; no baked route lines; no text, letters, labels, signs, numbers, logos, watermark, captions, speech bubbles, or interface elements.
Avoid: extra buildings, unreadable clutter, straight radial spokes, blocked doors, roads crossing through grass/water/walls/roofs, cropped buildings, top-right destination clutter.
```

### `cthulhu`

```text
Use case: stylized-concept
Asset type: mobile work-map game background, final app asset
Primary request: Create a clean detailed illustrated 9:16 portrait map for a Cthulhu-inspired foggy coastal old town. Exactly six prominent destination buildings total, all clearly separated and all with visible entrances: 1) fog lighthouse on an upper-left rock, 2) forbidden archive as a dark domed library in the upper-middle, 3) hill observatory with telescope dome on an upper-right hill but below the top-right clearance zone, 4) old docks warehouse on a middle-right quay, 5) sunken chapel in middle-left flooded ruins, and 6) a visually distinct protagonist home in the lower-middle/right portion. No other prominent buildings.
Scene/backdrop: eerie stormy island port with dark water, rocky causeways, marsh pools, mist bands, dead trees, distant tentacle silhouettes only in the far ocean background, lantern glow, smooth painterly shading. The lower third must stay mostly scenic marsh/stone path/water background with no work buildings so app UI can sit over it; the home may sit just above the lower third with its door visible.
Composition/framing: bird's-eye/isometric illustrated map, portrait 9:16, full map visible without destructive cropping. The upper-right 12% by 12% of the image must be scenery-only clearance: foggy sky/ocean/rock only, no building, door, marker destination, or road junction there.
Road network: visible connected wet cobblestone roads and stone causeways from the home door to every work-building entrance. Use a believable shared network with curves, bridges over water, steps up cliffs, a forked quay, and a small curved junction; do not make five direct spokes. Entrances connect to roads.
Style/medium: polished dark gothic mobile map illustration, low visual noise, smooth shading, controlled fog texture, readable road edges and doorways.
Constraints: exactly six prominent buildings total; six visible entrances; no characters; no UI; no markers; no path overlays; no baked route lines; no text, letters, labels, signs, numbers, logos, watermark, captions, speech bubbles, or interface elements.
Avoid: merged buildings, missing observatory, extra buildings, clutter, straight radial spokes, blocked doors, roads crossing through open water without bridges, roads through roofs/walls, cropped buildings, top-right destination clutter.
```

## Route Calibration Method

- Inspected all five maps at original resolution.
- Built temporary 5%/10% coordinate-grid overlays with Playwright screenshots under `/tmp/route-batch-e-grids`.
- Authored route samples by hand against the final exact-ratio map pixels.
- Used the home door or home stair as the first sample and each work-building door/entrance as the final sample.
- Kept every route at 12+ normalized finite road-center samples.
- Used shared initial samples only where the visible road network is shared.
- Used independent, non-identical sample arrays for all 25 routes.
- Added uppercase `M`/`L`/`C` visible segment strings, with split segments where foreground structures or terrain visually interrupt the route.
- Generated the 5x5 QA contact sheet and corrected route samples after inspection. The main correction pass adjusted `online_game` routes to leave the home via the visible curved path and adjusted the `cyberpunk` drone route around the central tower.

## Visual QA

Generated and inspected:

- `docs/superpowers/qa/routes-batch-e-contact-sheet.png`

Panel review:

- 25/25 panels present.
- Home markers and destination markers are visible.
- Dashed paths follow visible roads, bridges, causeways, elevated roads, or station corridors.
- No complete route sample arrays are identical.
- Final online-game and Cthulhu maps show exactly six prominent destinations with visible entrances and upper-right selector clearance.

## Tests

Focused batch test:

```text
node --test src/workRouteBatchE.test.js
pass 4, fail 0
```

Full suite:

```text
npm test
pass 95, fail 0
```

The first TDD red run failed as expected with `ERR_MODULE_NOT_FOUND` for `src/workRouteBatches/batch-e.js` before implementation.

## Commit

Commit message planned: `Calibrate future game and cthulhu routes`

The final commit SHA is reported by Codex after creating the commit; embedding the final SHA in this committed file would change the SHA.

## Concerns

- Batch E is intentionally not imported into `src/workRouteData.js` because the user explicitly excluded that shared integration file from this worktree's ownership.
- `cyberpunk`, `scifi`, and `alien_civilization` were not redrawn; they were resampled to exact 9:16 only.
