# Task 6 Report: Ancient and Eastern Route Batch A

## Status

Implemented batch A as a standalone route export in `src/workRouteBatches/batch-a.js`, with batch-local tests in `src/workRouteBatchA.test.js` and a 25-panel QA contact sheet at `docs/superpowers/qa/routes-batch-a-contact-sheet.png`.

## Independent Review Follow-up

- Recalibrated `xianxia/sword_peak` through the lower-left road fork, bridge, and destination stairs instead of cutting across the bamboo and cliff edge.
- Recalibrated `xianxia/talisman_hall`, `xianxia/spirit_beast_garden`, and `xianxia/scripture_pavilion` along the shared curved road east of the home to the upper junction, then along each destination's visible bridge or stair branch.
- Moved the four xianxia pins from building or scenery centers to their visible entrance, gate, or stair landing and regenerated their `visibleSegments` from the corrected samples.
- Reassigned the exact `prehistoric/riverbank` job key to the previously unused animal enclosure, ending at its visible southeast gate rather than on the lower scenic road. No map art was redrawn in this follow-up.
- Added a regression test for the five corrected entrance pins and critical road-center waypoints.

## Map Audit

| Theme | Result | Action |
| --- | --- | --- |
| `prehistoric` | Six usable destinations including a central home, visible route network, clear upper-right selector area. | Kept art; normalized final PNG to exact `945x1680`. |
| `ancient` | Original had five work buildings and roads, but no distinct protagonist home with visible home entrance. | Redrawn with built-in `image_gen`; normalized to exact `945x1680`. |
| `western_regions` | Original had a destination in the upper-right selector clearance. | Redrawn with built-in `image_gen`; normalized to exact `945x1680`. |
| `xianxia` | Central home, five visible work destinations, bridge/stair network, clear upper-right selector area. | Kept art; normalized final PNG to exact `945x1680`. |
| `xuanhuan` | Lower home, five visible destinations, central ring/bridge routes, clear upper-right selector area. | Kept art; normalized final PNG to exact `945x1680`. |

## Redrawn Map Prompts

### `map-ancient.png`

```text
Use case: historical-scene
Asset type: mobile game work-route map PNG, portrait 9:16
Primary request: Create a clean detailed illustrated ancient Chinese town work map for route calibration.
Scene/backdrop: riverside ancient Chinese city blocks with stone walkways, arched bridges, bamboo groves, willows, water channels, and garden courtyards.
Subject: exactly six prominent buildings, all in the upper and middle area: 1 visually distinct small protagonist home with a clear front door in the lower-middle of the building cluster, plus 5 work buildings matching these types: yamen government hall, inn/guesthouse, medical hall, academy/library hall, escort agency compound. All six doors or entrances must be clearly visible from the map view.
Composition/framing: vertical 9:16 full map, isometric/top-down illustrated route-map view. Buildings occupy upper and middle 60 percent. Lower 35 percent is scenic bamboo, river, path, mist, stones, and empty background reserved for a job dock, with no destination buildings. Leave the upper-right 12 percent by 12 percent of the image as scenery only: sky/water/trees/mountains only, no building, no door, no road junction, no destination, no marker-like object.
Road network: draw real visible connected stone roads from the protagonist home door to every work-building door. Roads must include a curved main path, at least one arched bridge over water, a small round plaza or turning node away from the upper-right clearance, and gentle branch paths, not five direct spokes. Paths must be wide and readable for dashed route overlays.
Style/medium: polished hand-painted mobile game map illustration, clean edges, smooth shading, controlled texture, low noise, high readability, cohesive ancient Chinese architecture.
Lighting/mood: bright soft daylight, calm and inviting.
Constraints: exactly six prominent buildings, no extra prominent buildings. No people, animals, characters, text, labels, signs with readable writing, UI, markers, route overlays, arrows, dotted paths, symbols, or watermarks baked into the art. No destructive crop; preserve all entrances and roads inside the frame.
```

### `map-western-regions.png`

```text
Use case: historical-scene
Asset type: mobile game work-route map PNG, portrait 9:16
Primary request: Create a clean detailed illustrated Western Regions / Silk Road oasis work map for route calibration.
Scene/backdrop: desert oasis settlement with pale stone paths, turquoise water channels, reeds, date palms, dunes, rocky outcrops, woven awnings, and warm sandstone architecture.
Subject: exactly six prominent buildings or destinations, all in the upper and middle area: 1 visually distinct small protagonist home with a blue door in the lower-middle of the building cluster, plus 5 work destinations matching these types: caravanserai guesthouse, oasis well platform, silk bazaar, desert observatory, beacon tower. All six doors/entrances/access points must be clearly visible from the map view.
Composition/framing: vertical 9:16 full map, isometric/top-down illustrated route-map view. Buildings occupy upper and middle 60 percent. Lower 35 percent is scenic dunes, winding path, sparse palms, rocks, and empty background reserved for a job dock, with no destination buildings. The upper-right 12 percent by 12 percent of the image must be scenery only: open sky, distant dunes, or soft clouds only, no building, no door, no route junction, no destination, no marker-like object.
Road network: draw real visible connected pale stone roads from the protagonist home door to every work door/access point. Roads must include theme-appropriate curves, small bridges over oasis channels, a roundabout or market plaza away from the upper-right clearance, and branching paths, not five direct spokes. Paths must be broad and readable for dashed route overlays.
Style/medium: polished hand-painted mobile game map illustration, clean edges, smooth shading, controlled texture, low noise, high readability, cohesive Silk Road desert architecture.
Lighting/mood: bright warm daylight, clear desert air, inviting travel-route feel.
Constraints: exactly six prominent destinations, no extra prominent buildings. No people, animals, characters, text, labels, signs with readable writing, UI, markers, route overlays, arrows, dotted paths, symbols, or watermarks baked into the art. Do not place any building or road junction in the upper-right selector clearance. No destructive crop; preserve all entrances and roads inside the frame.
```

Built-in generated sources were selected from `/Users/mypc/.codex/generated_images/019f5b67-d9d1-7713-a426-02709443c20c/`:

- `call_LoK7fj00HbMd1TbRGFWxnKco.png` -> `public/work-map-assets/map-ancient.png`
- `call_XLAVV9PrlMG3geQMbTkG7ebz.png` -> `public/work-map-assets/map-western-regions.png`

No CLI image-generation fallback was used. Temporary copied sources under `tmp/` were deleted before commit.

## Route Calibration Method

- Inspected all five maps at original resolution before deciding redraws.
- Used the final `945x1680` worktree PNGs for route coordinates.
- Calibrated one home entrance and five destination entrances per theme in normalized `0..100` coordinates.
- Authored every route as 12 or more road-center samples, following the visible road network through curves, forks, bridges, steps, and central rings.
- Added `visibleSegments` via explicit uppercase `M/L` path strings generated from the authored samples; break indices split routes near bridge rails, central crystals, trees, fences, or other foreground areas where a future layered renderer can occlude route strokes.
- Corrected two xuanhuan routes after the contact-sheet pass because they branched toward `herb_garden` and `forge` too early; both now travel up the shared central bridge/ring before branching.
- During the independent review follow-up, recalibrated four xianxia routes around the home loop and through the upper or lower visible forks, and moved prehistoric `riverbank` to the animal-enclosure gate.

## QA Contact Sheet

- Generated: `docs/superpowers/qa/routes-batch-a-contact-sheet.png`
- Dimensions: `1480x2540`
- Layout: 5 columns x 5 rows, one panel per route, final map underneath, cyan home marker, pink destination marker, yellow dashed route with dark outline.
- Visual inspection: all 25 panels were reviewed after regeneration. The five review-targeted panels were also inspected in enlarged crops; the xianxia overlays remain on roads, forks, bridges, and stairs, and prehistoric `riverbank` reaches the enclosure gate.

## Tests

### RED

Command:

```bash
node --test src/workRouteBatchA.test.js
```

Initial result:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../src/workRouteBatches/batch-a.js
```

This was the expected failing test before adding the batch module.

### Focused GREEN

Command:

```bash
node --test src/workRouteBatchA.test.js
```

Result:

```text
1..4
# tests 4
# pass 4
# fail 0
```

### Full Suite

Command:

```bash
npm test
```

Result:

```text
1..95
# tests 95
# pass 95
# fail 0
```

### Independent Review Follow-up

Focused command:

```bash
node --test src/workRouteBatchA.test.js
```

Result:

```text
1..5
# tests 5
# pass 5
# fail 0
```

Full command:

```bash
npm test
```

Result:

```text
1..96
# tests 96
# pass 96
# fail 0
```

## Files

- Created `src/workRouteBatches/batch-a.js`
- Created `src/workRouteBatchA.test.js`
- Created `docs/superpowers/qa/routes-batch-a-contact-sheet.png`
- Modified `public/work-map-assets/map-prehistoric.png`
- Modified `public/work-map-assets/map-ancient.png`
- Modified `public/work-map-assets/map-western-regions.png`
- Modified `public/work-map-assets/map-xianxia.png`
- Modified `public/work-map-assets/map-xuanhuan.png`
- Created `.superpowers/sdd/task-6-report.md`

## Commit

Initial commit message: `Calibrate ancient and eastern work routes`.

Follow-up commit message: `Fix reviewed batch A route calibration`.

The final commit SHA is reported in the task response.

## Concerns

- The current global `workRouteData.js` validator still expects route pins to match legacy theme pin metadata. This batch intentionally keeps true calibrated entrance pins in the standalone batch file, matching the route-batch plan; Task 10 is the planned aggregation point.
- Exact 9:16 testing required normalizing the three non-redrawn maps from `941x1672` to `945x1680`; the art was not redrawn for those maps.
- The generated ancient map contains tiny decorative plaque-like marks on buildings. They are not route labels or UI, but they may read as ornamental sign detail at original size.
