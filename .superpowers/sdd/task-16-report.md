# Task 16 Report

## Result

Prepared the local Office V2 `0.2.98` release code and QA evidence. The release verifier now observes the real Pixi canvas and both scenes at three viewports, validates physical activity and conversation contracts, and fails on the fallback UI, blank rendering, actor-overlay body coverage, or unexpected network activity.

This phase intentionally did not run Pages sync, deploy, push, online access, or live verification. The controller retains those post-review steps, including writing `docs/.deploy-version`.

## RED To GREEN

- The replaced verifier first rejected the previous DOM and legacy character-atlas assumptions.
- Browser QA exposed screenshots containing only labels and `场景暂时无法加载`. Investigation traced the production-only render failure to the CommonJS `pathfinding` smoother assigning an undeclared variable under Vite ESM strict mode. `officePathfinding.js` now uses the local safe smoother, and the verifier explicitly rejects the fallback and blank or single-color canvas output.
- Same-origin scene and character requests were separated from the blocked external-request path; only the expected Office API is intercepted and no test traffic can leave the local Vite origin.
- Visual review then rejected labels centered over actors and desks. The focused overlay tests failed before implementation because no head anchor existed. The final layout derives a screen-space head anchor, places each bubble/name/status stack fully above it, clamps stacks to scene bounds, and rejects mutual overlap. Browser geometry independently verifies the rendered DOM against every actor head.
- `node --test src/work/OfficeActorOverlay.test.js`: PASS, 24/24 after the head-anchor implementation.

## Owned Changes

- Rewrote `scripts/verify-office.mjs` around real Pixi, scene, door, overlay, motion, physical probe, conversation history, request, and screenshot observations at `375x812`, `390x844`, and `1280x720`, all at device scale 2. It owns and reliably terminates its temporary Vite process.
- Added release and Pages synchronization contracts in `scripts/office-release-contract.mjs`, `scripts/office-release-contract.test.mjs`, `scripts/pages-sync-contract.mjs`, and `scripts/pages-sync-contract.test.mjs`.
- Updated `scripts/sync-pages.mjs` to replace `assets`, `work-office-v2`, and `worldbook-assets`, remove the retired office asset directory, compare synchronized files with `dist`, and leave deploy-marker writing to the actual sync invocation.
- Removed the retired `public` office asset tree and its obsolete contact-sheet builder.
- Fixed Vite-safe path smoothing, hidden overlay behavior, actor head metadata, and bounded head-above overlay layout. Added focused tests for the new release and overlay contracts.
- Kept package and lock metadata at `0.2.98`; updated the visible app version and worldbook cache markers to `0.2.98`.
- Generated the six fresh scene screenshots and `docs/superpowers/qa/office-v2-release.md`.

## Verification

- Focused release suite: PASS, 93/93 tests, 0 failures.
- `npm test`: PASS, 230/230 tests, 0 failures.
- `npm run build`: PASS, Vite 6.4.2 transformed 2,549 modules and completed the production build. Existing warnings remain for the runtime-resolved versioned worldbook URL and chunks larger than 500 kB.
- `npm run verify:office`: PASS at `375x812`, `390x844`, and `1280x720`; each reported Pixi, scenes, overlays, motion, records, and physical probes as passing.
- `node scripts/verify-office-v2-assets.mjs --all`: PASS for 2 scenes, 16 furniture layers, 20 props, all constraints, and all four 4-character cohorts with 168 strips each.
- `rg -n 'work-office-assets|office-module-layer|office-character-atlas-sprite|OfficeActivityPanel' src scripts public`: zero matches (expected exit 1).
- `git diff --check`: PASS with no output.
- Version check: `package.json`, both package-lock version fields, visible `Ccat OS V0.2.98`, and both worldbook cache markers are `0.2.98`.

## Visual QA

Fresh screenshots:

- `docs/superpowers/qa/office-v2-375x812-office.png`
- `docs/superpowers/qa/office-v2-375x812-lounge.png`
- `docs/superpowers/qa/office-v2-390x844-office.png`
- `docs/superpowers/qa/office-v2-390x844-lounge.png`
- `docs/superpowers/qa/office-v2-1280x720-office.png`
- `docs/superpowers/qa/office-v2-1280x720-lounge.png`

All six were inspected at original resolution. Both scenes are visibly rendered with detailed furniture and nonblank backgrounds; no fallback text is present. In every office viewport, all five name/status stacks sit above the corresponding head, remain inside the scene, do not cover the actor or desk, and do not overlap another stack.

## Release Boundary

- `docs/.deploy-version` was not modified because the final sync was explicitly reserved for the controller.
- `npm run deploy:pages`, push, remote access, and live verification were not run.
- `.superpowers/sdd/progress.md` and `tmp/` are unowned and excluded from this task's commit.
