# Task 9 Report: Modern Campus and Survival Route Batch

## Status

Implemented route batch D for `hong_kong`, `modern`, `campus`, `ice_age`, and `wasteland`.

All five audited maps were redrawn with the built-in `image_gen` workflow, resized to exact 9:16 PNGs, and calibrated with 25 independently authored route sample arrays. The modern cafe route now terminates at the cafe entrance, not the flower shop or a flower bed.

## Built-In Image Generation

- Mode: built-in `image_gen` tool only.
- One full-map generation call per theme.
- No SVG/manual illustration and no CLI image generation fallback.
- Built-in source folder: `/Users/mypc/.codex/generated_images/019f5b67-da98-7ea0-bc47-2f4300120b1a/`.
- Final normalization: `sips -z 1664 936 <source> --out <asset>` so the committed maps are exact 936x1664 portrait PNGs.

## Redraw List

- `public/work-map-assets/map-hong-kong.png`
- `public/work-map-assets/map-modern.png`
- `public/work-map-assets/map-campus.png`
- `public/work-map-assets/map-ice-age.png`
- `public/work-map-assets/map-wasteland.png`

## Final Prompts

### map-hong-kong.png

```text
Use case: stylized-concept
Asset type: mobile game work-map background, final portrait map art
Primary request: Create a clean detailed illustrated 9:16 vertical map for a Hong Kong harbor hillside work district.
Scene/backdrop: soft watercolor-anime isometric coastal Hong Kong neighborhood with sea on the left, hills and retaining walls, warm daylight, smooth shading, controlled texture, low visual noise.
Subject: exactly six prominent destination buildings in the upper and middle area: 1) cha chaan teng cafe with visible street-level entrance, 2) ferry pier terminal with visible boarding entrance, 3) record shop with visible shop door, 4) neon arcade with visible entrance and arcade machines seen inside, 5) rooftop laundry building with visible stair/roof access entrance, 6) one visually distinct small protagonist home with visible blue front door. Home should sit in the middle-lower road network but still above the lower scenic dock area.
Composition/framing: full 9:16 portrait, no destructive cropping, all six buildings fully visible and separated. Keep the upper-right 12 percent by 12 percent of the canvas as scenery only: pale sky/sea/hills/trees only, absolutely no building, entrance, route junction, road fork, marker-like object, sign, or destination there. Buildings occupy upper and middle regions; lower third remains mostly scenic hillside road, water, mist, trees, and empty road space for a phone job dock.
Road network: real visible connected roads and steps from the protagonist home door to every work building door. Include theme-appropriate curving hillside roads, stair flights, one small bridge/overpass, and a small bend/turnaround, not five direct spokes. Every building door must connect to the same visible network. Roads must be wide and readable for tracing.
Style/medium: polished hand-painted illustration, clean linework, smooth shading, subtle texture, mobile game map background.
Text: no text.
Constraints: exactly six prominent buildings total, all six entrances visible, no people or characters, no UI, no labels, no text, no route overlay, no pins, no markers, no icons. Avoid any building or route junction in the upper-right clearance zone. Avoid clutter, noisy details, and ambiguous fake paths.
```

### map-modern.png

```text
Use case: stylized-concept
Asset type: mobile game work-map background, final portrait map art
Primary request: Create a clean detailed illustrated 9:16 vertical map for a modern neighborhood work district.
Scene/backdrop: bright contemporary urban park district with small streets, crosswalks, storefronts, shrubs, smooth shading, controlled texture, low visual noise.
Subject: exactly six prominent destination buildings in the upper and middle area: 1) bookstore with visible book displays and a clear front door, 2) flower shop with visible door and flower buckets, 3) clinic with visible glass entrance, 4) parcel station with visible loading entrance, 5) cafe with a visually unmistakable cafe door and outdoor table area, 6) one visually distinct small protagonist home with a visible blue front door. The cafe entrance must be a real building doorway, not a flower bed, garden, or decoration.
Composition/framing: full 9:16 portrait, all six buildings fully visible and separated. Keep the upper-right 12 percent by 12 percent of the canvas as scenery only: treetops, sky, soft grass, or plain road edge only, absolutely no building, entrance, route junction, road fork, marker-like object, sign, or destination there. Buildings occupy upper and middle regions; lower third remains mostly scenic park grass, curving sidewalks, trees, and empty road space for a phone job dock.
Road network: real visible connected roads and sidewalks from the protagonist home door to every work building door. Include a central roundabout park, curved side streets, crosswalks, and short garden paths connected to the street network, not five direct spokes. Every building door must connect to the same visible network. Roads and sidewalks must be wide and readable for tracing.
Style/medium: polished hand-painted anime city-map illustration, clean linework, smooth shading, subtle texture, mobile game map background.
Text: no text.
Constraints: exactly six prominent buildings total, all six entrances visible, no people or characters, no UI, no labels, no readable text, no route overlay, no pins, no markers, no icons. Avoid any building or route junction in the upper-right clearance zone. Avoid clutter, noisy details, and ambiguous fake paths. Make the cafe distinct from the flower shop.
```

### map-campus.png

```text
Use case: stylized-concept
Asset type: mobile game work-map background, final portrait map art
Primary request: Create a clean detailed illustrated 9:16 vertical map for a modern university campus.
Scene/backdrop: bright leafy campus with academic buildings, paths, a small lake or lawn, trees, smooth shading, controlled texture, low visual noise.
Subject: exactly six prominent destination buildings in the upper and middle area: 1) campus library with visible main steps and entrance, 2) cafeteria/dining hall with visible entrance, 3) science lab building with visible glass entrance and small observatory dome or lab equipment detail, 4) gymnasium with visible entrance, 5) mailroom/receiving office with visible loading or service entrance, 6) one visually distinct small student home or dorm cottage with visible blue front door. All six doors must face a visible path or road.
Composition/framing: full 9:16 portrait, all six buildings fully visible and separated. Keep the upper-right 12 percent by 12 percent of the canvas as scenery only: treetops, open sky, lawn, or lake edge only, absolutely no building, entrance, route junction, road fork, marker-like object, sign, or destination there. Buildings occupy upper and middle regions; lower third remains scenic lawn, lake edge, curving walkway, trees, and empty foreground space for a phone job dock.
Road network: real visible connected pedestrian paths and campus roads from the protagonist home door to every work building door. Include a central quad path loop, curved lakeside path, small bridge over a stream, steps to the library, and branching sidewalks, not five direct spokes. Every building door must connect to the same visible network. Paths must be wide and readable for tracing.
Style/medium: polished hand-painted anime campus-map illustration, clean linework, smooth shading, subtle texture, mobile game map background.
Text: no text.
Constraints: exactly six prominent buildings total, all six entrances visible, no people or characters, no UI, no labels, no readable text, no route overlay, no pins, no markers, no icons. Avoid any building or route junction in the upper-right clearance zone. Avoid clutter, noisy details, and ambiguous fake paths.
```

### map-ice-age.png

```text
Use case: stylized-concept
Asset type: mobile game work-map background, final portrait map art
Primary request: Create a clean detailed illustrated 9:16 vertical map for an ice-age settlement.
Scene/backdrop: snowy glacial valley with blue ice cliffs, frost, steam, mammoth tracks, warm firelight accents, smooth shading, controlled texture, low visual noise.
Subject: exactly six prominent destination structures in the upper and middle area: 1) glacier supply camp with visible tent entrance, 2) mammoth corral with visible gate entrance, 3) ice cave with visible dark cave mouth entrance, 4) hot spring shelter with visible doorway and steaming pool edge, 5) signal ridge beacon tower with visible stair/entrance, 6) one visually distinct small protagonist igloo home with visible glowing door. All six entrances must face a visible packed-snow road or ice path.
Composition/framing: full 9:16 portrait, all six structures fully visible and separated. Keep the upper-right 12 percent by 12 percent of the canvas as scenery only: pale sky, distant ice, or empty snowy ridge only, absolutely no building, entrance, route junction, road fork, marker-like object, sign, or destination there. Buildings occupy upper and middle regions; lower third remains scenic snowfield, cracked ice stream, trees, and empty path space for a phone job dock.
Road network: real visible connected packed-snow roads and ice bridges from the protagonist home door to every work entrance. Include curved snow tracks, one ice bridge across a chasm, stairs cut into ice, and a small round snowy fork, not five direct spokes. Every destination entrance must connect to the same visible network. Roads must be readable against the snow.
Style/medium: polished hand-painted fantasy survival map illustration, clean linework, smooth shading, subtle texture, mobile game map background.
Text: no text.
Constraints: exactly six prominent structures total, all six entrances visible, no people or characters, no UI, no labels, no text, no route overlay, no pins, no markers, no icons. Avoid any building or route junction in the upper-right clearance zone. Avoid clutter, noisy details, and ambiguous fake paths.
```

### map-wasteland.png

```text
Use case: stylized-concept
Asset type: mobile game work-map background, final portrait map art
Primary request: Create a clean detailed illustrated 9:16 vertical map for a wasteland survival settlement.
Scene/backdrop: sun-bleached post-apocalyptic mesa settlement with cracked asphalt, scrap metal, canyons, dust haze, sparse dry brush, smooth shading, controlled texture, low visual noise.
Subject: exactly six prominent destination buildings in the upper and middle area: 1) reinforced shelter bunker with visible entrance, 2) supply station market with visible counter/door, 3) medical camp tent with visible entrance, 4) watch post tower with visible stair/entry, 5) repair station garage with visible open doorway and parts, 6) one visually distinct small protagonist shack/home with visible blue front door. All six entrances must face a visible cracked road or boardwalk.
Composition/framing: full 9:16 portrait, all six buildings fully visible and separated. Keep the upper-right 12 percent by 12 percent of the canvas as scenery only: empty desert sky, far canyon wall, dust, or barren ground only, absolutely no building, entrance, route junction, road fork, marker-like object, sign, or destination there. Buildings occupy upper and middle regions; lower third remains scenic cracked road, canyon edge, wreck debris, dry shrubs, and empty foreground space for a phone job dock.
Road network: real visible connected cracked roads and scrap-board walkways from the protagonist home door to every work building door. Include curved road bends, a small roundabout of tires, a bridge over a fissure, stairs or ramp up to the watch post, and branching streets, not five direct spokes. Every destination entrance must connect to the same visible network. Roads must be wide and readable for tracing.
Style/medium: polished hand-painted survival map illustration, clean linework, smooth shading, subtle texture, mobile game map background.
Text: no text.
Constraints: exactly six prominent buildings total, all six entrances visible, no people or characters, no UI, no labels, no readable text, no route overlay, no pins, no markers, no icons. Avoid any building or route junction in the upper-right clearance zone. Avoid clutter, noisy details, and ambiguous fake paths.
```

## Route Calibration Method

- Inspected the original five PNGs at original resolution before deciding; all five matched the audit's selector-clearance redraw candidates.
- Inspected each generated final at original resolution after resizing to 936x1664.
- Authored route coordinates in normalized 0-100 image coordinates so they remain independent of pixel size.
- Used the route object home point as the exact first sample for every route and the destination entrance as the exact final sample/pin.
- Traced visible roads, sidewalks, steps, bridges, roundabout edges, packed-snow tracks, and cracked asphalt/boardwalk centers. I avoided grass, water, rooftops, walls, building interiors, and decorative landscaping.
- Built `visibleSegments` directly from the authored samples so each dashed route follows the same calibrated centerline used for motion.
- Visual QA pass 1 found the first contact-sheet render had missing map backgrounds; regenerated it with embedded PNG data URLs.
- Visual QA pass 2 found overly direct paths around modern's roundabout and wasteland's watch post; adjusted those samples to follow road/boardwalk centers and regenerated the contact sheet.

## Tests

TDD red state:

```bash
node --test src/workRouteBatchD.test.js
```

Expected failure observed before implementation: `ERR_MODULE_NOT_FOUND` for `src/workRouteBatches/batch-d.js`.

Focused green:

```bash
node --test src/workRouteBatchD.test.js
```

Result: 5 tests passed, 0 failed.

Full suite:

```bash
npm test
```

Result: 96 tests passed, 0 failed.

## Visual Checks

- Contact sheet: `docs/superpowers/qa/routes-batch-d-contact-sheet.png`.
- Format: 5 columns x 5 rows, one panel per route.
- Each panel includes the final map, green home marker, red destination marker, and dashed yellow path.
- Reviewed all 25 panels after the final regeneration.
- Modern cafe route ends at the cafe building entrance on the lower-left cafe, not at the flower shop or its flower display.
- Upper-right selector clearance is scenery-only on all five redrawn maps.

## Files

- Created:
  - `src/workRouteBatches/batch-d.js`
  - `src/workRouteBatchD.test.js`
  - `docs/superpowers/qa/routes-batch-d-contact-sheet.png`
  - `.superpowers/sdd/task-9-report.md`
- Modified:
  - `public/work-map-assets/map-hong-kong.png`
  - `public/work-map-assets/map-modern.png`
  - `public/work-map-assets/map-campus.png`
  - `public/work-map-assets/map-ice-age.png`
  - `public/work-map-assets/map-wasteland.png`

## Commit

- Intended commit message: `Calibrate modern campus and survival routes`.
- Commit SHA: recorded in the final task response after commit creation.

## Concerns

- `WORK_ROUTE_BATCH_D` is intentionally standalone because Task 9 explicitly forbids editing `src/workRouteData.js`; integration into the live registry remains outside this batch's ownership.
- The committed maps are exact 936x1664 outputs resampled from built-in 941x1672 sources. This avoided destructive manual cropping while satisfying exact 9:16 asset checks.
