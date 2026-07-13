# Task 3 Report: Browser Route Calibration and Screenshot Tooling

## Implementation

- Added `scripts/work-route-calibrator.html` and `scripts/work-route-calibrator.js` with:
  - theme switching across the existing `WORK_MAP_THEMES` registry
  - route switching between `home` and each of the five place routes
  - normalized `0..100` coordinate editing
  - click-to-add route samples
  - drag editing for `home`, active route `pin`, and interior samples
  - `Delete`, `Undo`, and `Clear` behavior scoped to the active route
  - visible-segment break toggles that split exported `visibleSegments` without splitting `samples`
  - deterministic route export and theme export JSON
  - all six markers rendered together for alignment checking
- Added `scripts/verify-work-routes.mjs` with:
  - focused mode for today: `--theme <id>` and optional `--place <type>` / `--job <type>`
  - full-registry planning that reports missing calibrated themes instead of fabricating screenshots
  - deterministic screenshot paths under `artifacts/work-routes/<theme>/<place>.png`
  - bounded verification timeout support via `--timeout-ms`
  - detached child-server process-group management
  - cleanup in `finally` for both Playwright and the spawned dev server
- Added `scripts/work-route-tools.test.mjs` covering:
  - deterministic route export and visible-segment generation
  - normalized bounds and break-index assertions
  - deterministic screenshot path generation
  - focused/full verification planning
  - timeout cleanup hook execution
  - process-group teardown for a detached child plus spawned descendant
- Updated `package.json` scripts:
  - `calibrate:routes`
  - `verify:routes`
  - `test` now includes the new script-level test file

## Files

- Added `scripts/work-route-calibrator.html`
- Added `scripts/work-route-calibrator.js`
- Added `scripts/verify-work-routes.mjs`
- Added `scripts/work-route-tools.test.mjs`
- Added `.superpowers/sdd/task-3-report.md`
- Modified `package.json`

## Root Cause

- The verifier originally launched the local server through `npm`, but only tracked the immediate child PID.
- When the verifier finished or was interrupted, descendant Vite/esbuild processes could survive as orphans because the script did not kill the whole process group.
- There was no explicit end-to-end verification timeout, so selector hangs or cleanup stalls could leave the parent verifier running until manually terminated.

## RED

### Command

```bash
node --test scripts/work-route-tools.test.mjs
```

### Output

```text
TAP version 13
# file:///Users/mypc/Desktop/Ccat%20OS/ai-roleplay-phone/scripts/work-route-tools.test.mjs:14
#   isProcessAlive,
#   ^^^^^^^^^^^^^^
# SyntaxError: The requested module './verify-work-routes.mjs' does not provide an export named 'isProcessAlive'
not ok 1 - /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/scripts/work-route-tools.test.mjs
1..1
# tests 1
# pass 0
# fail 1
```

This was the intended red step for the lifecycle fix: the verifier did not yet expose the timeout/process-group primitives needed to lock down reliable shutdown.

## GREEN

### Command

```bash
node --test scripts/work-route-tools.test.mjs
```

### Output

```text
1..7
# tests 7
# pass 7
# fail 0
# duration_ms 320.221458
```

The focused green confirms deterministic export helpers, verification planning, timeout cleanup, and detached process-group teardown.

## Bounded Smoke

### Command

```bash
node scripts/verify-work-routes.mjs --theme modern --place bookstore --timeout-ms 30000
```

### Output

```text
Verified 1 route screenshot(s) via http://127.0.0.1:4173
artifacts/work-routes/modern/bookstore.png
```

The verifier exited on its own after the screenshot write.

## Full-Suite Result

### Command

```bash
npm test
```

### Output

```text
> ai-roleplay-phone@0.2.90 test
> node --test src/*.test.js scripts/*.test.mjs

1..80
# tests 80
# pass 80
# fail 0
```

## Cleanup Verification

### Commands

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
lsof -nP -iTCP:4174 -sTCP:LISTEN
ps -axo pid,ppid,command | rg 'verify-work-routes\.mjs|node_modules/.bin/vite --host 127.0.0.1 --port 4173|node_modules/.bin/vite --host 127.0.0.1 --port 4174'
```

### Output

```text
lsof 4173: exit 1, no listeners
lsof 4174: exit 1, no listeners
ps: only the transient `ps | rg` command itself matched
```

No verifier or dev-server process remained after the bounded smoke and full test run.

## Self-Review

- Kept the production code changes inside the Task 3-owned files plus the requested report.
- Fixed the actual shutdown boundary instead of adding manual cleanup steps:
  - detached server spawn
  - process-group kill
  - bounded timeout wrapper
  - unconditional `finally` cleanup for Playwright and server state
- Verified the cleanup fix with both unit-style lifecycle tests and a real smoke run.
- Confirmed the modern/bookstore smoke leaves no listeners on ports `4173` or `4174`.

## Concerns

- The calibrator exports deterministic `M/L` segment chains from the current sample list. That is stable and schema-compatible, but it does not try to preserve hand-simplified sparse path authoring if future calibrations want more compact `visibleSegments`.
- Full `25 x 5` screenshot mode still correctly fails until Tasks 6-10 populate the remaining route registry entries; that is now explicit behavior rather than silent fallback.

## Review Fixes (2026-07-13)

### Changes

- Enforced the Task 2 minimum of 12 normalized samples in calibrator validation and serialization. Two-point and cleared routes now fail with a count and the number of samples still needed.
- Added explicit `authored` draft state. Only route records loaded from `WORK_ROUTE_DATA` start authored; `placeMeta.route` and synthesized `[home, pin]` data are no longer imported as calibration samples.
- Changed Clear to reset the active route to `authored: false`, `samples: []`, and `breakIndices: []` while retaining its marker pin and distance metadata.
- Made theme export aggregate and reject every unauthored or invalid route with `theme:place` labels. The UI disables route/theme copy buttons until their respective exports are valid.
- Marked every route selector option as `ready`, `unauthored`, `incomplete N/12`, or `invalid`; the active route also shows actionable validation text and an unauthored empty state.
- Added an editable-target keyboard guard for `input`, `textarea`, `select`, inherited/direct contenteditable targets, so Delete/Backspace and Undo shortcuts do not alter calibration while editing controls.
- Validated raw coordinates before normalization so export cannot clamp an out-of-bounds input into an apparently valid record.

### RED Evidence

Command:

```bash
node --test scripts/work-route-tools.test.mjs
```

Initial output:

```text
SyntaxError: The requested module './work-route-calibrator.js' does not provide an export named 'buildRouteDraft'
1..1
# tests 1
# pass 0
# fail 1
```

Clear-transition RED output:

```text
SyntaxError: The requested module './work-route-calibrator.js' does not provide an export named 'clearRouteDraft'
1..1
# tests 1
# pass 0
# fail 1
```

### Focused GREEN

Command:

```bash
node --test scripts/work-route-tools.test.mjs
```

Output:

```text
1..12
# tests 12
# pass 12
# fail 0
```

The focused tests prove two-point and actual cleared drafts reject export, legacy route metadata stays unauthored, theme export reports all invalid routes, complete 12-sample routes export, and editable targets are recognized.

### Full Suite

Command:

```bash
npm test
```

Output:

```text
1..85
# tests 85
# pass 85
# fail 0
```

### Bounded Smoke And Cleanup

Command:

```bash
node scripts/verify-work-routes.mjs --theme modern --place bookstore --timeout-ms 30000
```

Output:

```text
Verified 1 route screenshot(s) via http://127.0.0.1:4173
artifacts/work-routes/modern/bookstore.png
```

Cleanup commands:

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
lsof -nP -iTCP:4174 -sTCP:LISTEN
ps -axo pid=,ppid=,command= | rg '[v]erify-work-routes\.mjs|[v]ite .*--port 417[34]'
```

Exact result: all three commands exited `1` with no output. No verifier, Vite process, or listener remained.

### Review Self-Check

- Scope remained limited to `scripts/work-route-calibrator.js`, `scripts/work-route-tools.test.mjs`, and this report.
- No `src` production module, asset, version, deployment file, or `designs/` content was changed.
- Exported schema remains exactly `pin`, `distanceMeters`, `samples`, and `visibleSegments`; draft-only `authored` state is never serialized.

### Remaining Concerns

- Full `25 x 5` mode remains intentionally unavailable until later tasks add the missing calibrated route themes.
- Deterministic calibrator segment output remains point-for-point `M/L` geometry rather than preserving hand-simplified paths from an imported calibrated record after editing.
