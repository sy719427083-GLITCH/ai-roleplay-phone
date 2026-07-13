# Task 7 Report: Mystic and Western Fantasy Route Batch

## Status

- Implemented `WORK_ROUTE_BATCH_B` for exactly five themes: `mystic_realm`, `underworld`, `medieval`, `western_fantasy`, and `fantasy`.
- Calibrated 25 routes with authored `home`, `pin`, `distanceMeters`, 12+ normalized road-center `samples`, and uppercase `M`/`L` visible SVG segments.
- Generated `docs/superpowers/qa/routes-batch-b-contact-sheet.png` as a 5x5 route QA sheet with home markers, destination markers, and dashed paths.
- Final commit SHA is reported in the task response. Embedding the SHA in this committed report would change the SHA.

## Redraw Decisions

- Redrawn with built-in `image_gen`: `mystic_realm`, `underworld`, `fantasy`.
- Kept and exact-ratio normalized only: `medieval`, `western_fantasy`.
- All five owned map PNGs were normalized to exact 9:16 at 945x1680.

## Image Generation Workflow

- Used the built-in `image_gen` tool, one full map per call.
- Did not use SVG, Canvas, manual illustration, or CLI fallback for redraws.
- Copied selected generated outputs from `/Users/mypc/.codex/generated_images/019f5b67-da15-71f1-9d88-290eefed3075/` into `public/work-map-assets/`.
- Resampled with `sips -z 1680 945` to preserve the full image without cropping while making the ratio exact.

## Redraw Prompts

### mystic_realm

```text
Use case: stylized-concept
Asset type: 9:16 mobile game work-route map background
Primary request: Redraw the mystic_realm work map as a clean detailed illustrated vertical fantasy realm map for Ccat OS.
Scene/backdrop: floating stone terraces, ancient luminous ruins, soft mist, waterfalls, crystal plants, and pale mountain voids; lower 20% must be scenic road/flowers/waterfall background with no destination building for the job dock.
Subject: exactly six prominent destinations total: five work buildings plus one visually distinct protagonist home. Place the visible doors/entrances at these approximate normalized map coordinates: protagonist home door at 50%,36%; realm gate door at 15%,15%; crystal grotto entrance at 50%,12%; floating bridge maintenance pavilion entrance at 82%,15%; relic vault door at 17%,43%; mist pond shrine entrance at 84%,43%.
Style/medium: polished hand-painted isometric mobile game map illustration, smooth shading, low noise, controlled fine texture, readable roads.
Composition/framing: portrait 9:16, buildings in upper and middle map only, top-down/isometric view; preserve full map without UI. Upper-right 12% width by 12% height must be scenery-only empty sky/cliff/mist: no building, door, route junction, marker destination, bridge endpoint, or focal object there.
Road network: real visible connected pale stone roads from home door to every work door. Use a shared curving terrace road with arches, bridges, steps, a small circular plaza, and gentle switchbacks; do not make five direct spokes. Every road must visibly touch each door/entrance.
Constraints: exactly six prominent buildings/structures, all six doors visible, no text, no labels, no UI, no markers, no route overlays, no characters or creatures, no watermark. Avoid clutter, noisy textures, tiny unreadable destinations, cropped buildings, hidden doors, disconnected roads, and any destination in the upper-right clearance zone.
```

### underworld

```text
Use case: stylized-concept
Asset type: 9:16 mobile game work-route map background
Primary request: Redraw the underworld work map as a clean detailed illustrated vertical ghostly underworld route map for Ccat OS.
Scene/backdrop: dark blue-violet underworld river valley with mist, lanterns, stone bridges, cliffs, ghost-fire flowers, and layered temple platforms; lower 20% must be scenic foggy riverbank and road only with no destination building for the job dock.
Subject: exactly six prominent destinations total: five work buildings plus one visually distinct protagonist home. Place the visible doors/entrances at these approximate normalized map coordinates: protagonist home door at 18%,21%; ghost gate door at 49%,8%; judgment hall door at 78%,22%; forgotten river ferry entrance/dock at 15%,47%; spirit registry archive door at 52%,39%; Mengpo soup pavilion entrance at 84%,47%.
Style/medium: polished hand-painted isometric mobile game map illustration, smooth shading, low noise, controlled texture, readable stone roads and bridges.
Composition/framing: portrait 9:16, buildings in upper and middle map only, top-down/isometric view; preserve full map without UI. Upper-right 12% width by 12% height must be scenery-only empty mist/night sky: no building, door, route junction, marker destination, bridge endpoint, or focal object there.
Road network: real visible connected pale stone roads from home door to every work door. Use curved roads, arched bridges over the river, short stair sections, a small lantern roundabout, and shared branches; do not make five direct spokes. Every road must visibly touch each door/entrance.
Constraints: exactly six prominent buildings/structures, all six doors visible, no text, no labels, no UI, no markers, no route overlays, no characters or creatures, no watermark. Avoid missing buildings, extra prominent buildings, hidden entrances, disconnected roads, direct spokes, clutter, noisy texture, and any destination in the upper-right clearance zone.
```

### fantasy

```text
Use case: stylized-concept
Asset type: 9:16 mobile game work-route map background
Primary request: Redraw the fantasy work map as a clean detailed illustrated vertical floating-island fantasy route map for Ccat OS.
Scene/backdrop: bright dreamlike sky archipelago with floating grassy islands, clouds, waterfalls, glowing crystals, moonwell water, and graceful bridges; lower 20% must be scenic clouds, crystals, flowers, and a road approach only with no destination building for the job dock.
Subject: exactly six prominent destinations total: five work buildings plus one visually distinct protagonist home. Place the visible doors/entrances at these approximate normalized map coordinates: protagonist home door at 70%,34%; dragon library door at 22%,11%; sky harbor dock entrance at 55%,14%; enchantment market entrance at 81%,10%; ranger lodge door at 30%,31%; moonwell shrine entrance at 50%,47%.
Style/medium: polished hand-painted isometric mobile game map illustration, smooth shading, low noise, controlled texture, readable glowing roads and bridges.
Composition/framing: portrait 9:16, buildings in upper and middle map only, top-down/isometric view; preserve full map without UI. Upper-right 12% width by 12% height must be scenery-only empty sky/cloud/moonlight: no building, door, route junction, marker destination, bridge endpoint, or focal object there.
Road network: real visible connected luminous stone roads from home door to every work door. Use sweeping S-curves, floating bridges, stair steps, a small circular island junction, and shared branches; do not make five direct spokes. Every road must visibly touch each door/entrance.
Constraints: exactly six prominent buildings/structures, all six doors visible, no text, no labels, no UI, no markers, no route overlays, no characters or creatures, no watermark. Avoid palette-swapping the mystic map, avoid top-right destination intrusion, avoid hidden doors, disconnected bridges, direct spokes, extra prominent buildings, and noisy overdetail.
```

## Route Calibration Method

- Inspected each original map at full resolution before deciding which maps to redraw.
- Re-inspected the final 945x1680 assets before route calibration.
- Authored route samples in normalized percentage coordinates over the final PNGs.
- Used actual visible doors or road-mouth entrances for `home` and each route `pin`, then traced the visible road center through curves, bridges, stairs, loops, and shared road portions.
- Added split `visibleSegments` where bridge, ledge, gate, or foreground occlusion should interrupt the route overlay.
- Did not copy legacy/generated `placeMeta.route` arrays.

## Tests

- `node --test src/workRouteBatchB.test.js`: 4 tests passed.
- `npm test`: 95 tests passed.

## Visual QA

- Contact sheet: `docs/superpowers/qa/routes-batch-b-contact-sheet.png`.
- Inspected all 25 panels.
- Corrected underworld dock/registry/pavilion routes to follow the bridge and lantern-roundabout road network.
- Corrected the medieval stable route to travel through the plaza/gate road instead of cutting across the wall area.

## Files

- Added `src/workRouteBatches/batch-b.js`.
- Added `src/workRouteBatchB.test.js`.
- Added `docs/superpowers/qa/routes-batch-b-contact-sheet.png`.
- Replaced or normalized:
  - `public/work-map-assets/map-mystic-realm.png`
  - `public/work-map-assets/map-underworld.png`
  - `public/work-map-assets/map-medieval.png`
  - `public/work-map-assets/map-western-fantasy.png`
  - `public/work-map-assets/map-fantasy.png`
- Added this report: `.superpowers/sdd/task-7-report.md`.

## Concerns

- `WORK_ROUTE_BATCH_B` is standalone by design because this task forbids edits to `workRouteData.js`.
- `fantasy` keeps a moon in the upper-right selector-clearance area; it is scenery only, with no building, door, route junction, or destination marker.
- `medieval` retains non-human stable animals from the pre-existing passing map; there are no baked UI elements or human characters.
