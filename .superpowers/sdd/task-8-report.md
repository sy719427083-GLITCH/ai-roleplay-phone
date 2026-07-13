# Task 8 Report: Magic Coastal and Republican Route Batch

## Scope

- Worktree: `/Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/batch-c`
- Branch: `codex/route-batch-c`
- Themes: `magic_world`, `magic_academy`, `island`, `ocean`, `republican`
- Export created: `WORK_ROUTE_BATCH_C`
- Route total: 5 themes, 25 routes

## Redraw And Asset Work

Redrawn with built-in `image_gen`, one full-map call per generated candidate. No SVG, canvas, manual illustration, CLI fallback, or project-local generated temp source was used.

Accepted redraws:

- `magic_world`
  - Source: `/Users/mypc/.codex/generated_images/019f5b67-da53-77e1-86d2-8431b11e223c/call_oDVdVAei3BAkLpGk1IXqTK1y.png`
  - Prompt: clean detailed illustrated 9:16 magical city work-map background; exactly six prominent buildings total: protagonist home plus spell bureau, broom station, charm workshop, potion greenhouse, portal plaza; all entrances visible; connected curved roads with bridges and a roundabout; upper-right 12% by 12% scenery-only selector clearance; upper/middle buildings and lower scenic canal/park area; no text, labels, UI, markers, route overlays, people, logos, or watermark.

- `magic_academy`
  - Source: `/Users/mypc/.codex/generated_images/019f5b67-da53-77e1-86d2-8431b11e223c/call_9hE30TBFIAZFFTlaC6iAijXW.png`
  - Prompt: empty clean detailed illustrated 9:16 magic academy campus map; exactly six prominent buildings total, not five and not seven: academy dorm tower, alchemy classroom, observatory, academy library, empty dueling arena, and protagonist cottage/faculty residence; all entrances visible; connected curved campus paths with forks, plaza, and steps; upper-right 12% by 12% scenery-only selector clearance; lower scenic lawn/path area; no people, characters, silhouettes, labels, UI, markers, route overlays, logos, or watermark.
  - Note: earlier academy generations were rejected because one had only five prominent buildings and another included figure-like arena details.

- `republican`
  - Source: `/Users/mypc/.codex/generated_images/019f5b67-da53-77e1-86d2-8431b11e223c/call_P8B5low4idh65GSFgBWvU81p.png`
  - Prompt: clean detailed illustrated 9:16 Republican-era old Shanghai street work-map background; exactly six prominent buildings total: protagonist brick lane-house home plus newspaper office, tea house, tram depot, film studio, tailor shop; all entrances visible; connected curved streets, sidewalks, tram-track bends, plaza, and side-street forks; upper-right 12% by 12% scenery-only selector clearance; lower scenic streets/trees/plaza area; no readable signage, text, labels, UI, markers, route overlays, people, logos, or watermark.

Non-redrawn assets:

- `island`: original art passed functional map audit; mechanically normalized from `941x1672` to exact `945x1680`.
- `ocean`: original art passed functional map audit; mechanically normalized from `941x1672` to exact `945x1680`.

All five final batch-C map PNGs are exact `945x1680` portrait assets.

## Route Calibration Method

- Inspected each final map at original resolution before route authoring.
- Used normalized coordinates over the final `945x1680` art.
- Chose each theme home at the visually distinct protagonist-home entrance.
- Chose each route pin at the corresponding workplace door/entrance.
- Authored each sample list independently with at least 12 road-center samples.
- Traced visible roads, sidewalks, paths, bridges, boardwalks, piers, or underwater tubes only.
- Split selected visible segments where foreground detail or tube/platform overlap suggested occlusion.
- Did not copy legacy/generated `placeMeta.route`.

Calibration corrections after first contact-sheet review:

- Reauthored ocean routes to follow the transparent tube network instead of diagonal water cuts.
- Shifted republican `tram_depot` samples onto the visible tram-track street bend.
- Re-curved `magic_world.portal_plaza` along the lower bridge/path approach.
- Removed a duplicate island coconut-grove endpoint sample.

## Visual QA

- Generated contact sheet: `docs/superpowers/qa/routes-batch-c-contact-sheet.png`
- Contact sheet layout: 5 columns by 5 rows, one panel per route, final map underneath, dashed route, home marker, and destination marker.
- Inspected all 25 panels after regeneration.
- Verified:
  - Redrawn maps show exactly six prominent buildings.
  - `magic_academy` has exactly six prominent buildings, not seven.
  - Upper-right selector clearance is scenery-only in redrawn maps.
  - Island and ocean paths do not cross open water without a visible boardwalk/path/tube.
  - Routes start on home entrances and end on work entrances.
  - Lower map areas remain primarily scenic for the job dock.

## Tests

- `node --test src/workRouteBatchC.test.js`
  - Result: pass, 3/3 tests.
- `npm test`
  - Result: pass, 94/94 tests.

## Files

Changed or added owned files only:

- `src/workRouteBatches/batch-c.js`
- `src/workRouteBatchC.test.js`
- `public/work-map-assets/map-magic-world.png`
- `public/work-map-assets/map-magic-academy.png`
- `public/work-map-assets/map-island.png`
- `public/work-map-assets/map-ocean.png`
- `public/work-map-assets/map-republican.png`
- `docs/superpowers/qa/routes-batch-c-contact-sheet.png`
- `.superpowers/sdd/task-8-report.md`

## Commit

- Commit message: `Calibrate magic coastal and republican routes`
- Final commit SHA is returned in the task response; this report is included in that commit.

## Concerns

- Per task ownership, batch C is not wired into `src/workRouteData.js`; the final aggregation task must import the batch for app runtime usage.
- Per ownership, mirrored `docs/work-map-assets/*` files were not updated.
