# Task 2 Report: Exact Route Data Contract and Validation

## Implementation

- Added `src/workRouteData.js` with:
  - `WORK_ROUTE_DATA`
  - `getWorkRouteTheme(themeId)`
  - `validateWorkRouteTheme(themeId, theme, routeTheme)`
  - `interpolateWorkRoute(samples, progress)`
- Migrated only `modern` into the calibrated route registry with:
  - explicit `home`
  - five place-keyed routes
  - dense `samples`
  - `distanceMeters`
  - `visibleSegments`
- Updated `src/workThemes.js` to:
  - re-export the new interpolator for existing callers
  - merge `home`, `pin`, `distanceMeters`, `routeSamples`, and `routeSegments` from calibrated route themes
  - keep the legacy temporary route path in place for uncalibrated themes
  - continue exposing `route` for compatibility by aliasing calibrated `routeSamples`
  - surface `distanceMeters`, `routeSamples`, and `routeSegments` through normalized jobs
- Added `src/workRouteData.test.js` covering:
  - exact calibrated route contract validation against a full five-place modern fixture
  - uniqueness of serialized route samples
  - uniqueness guard for translated five-route theme patterns
  - constant-speed interpolation through bends
- Extended `src/workThemes.test.js` to verify:
  - calibrated themes expose route metadata while legacy themes do not
  - generic theme assertions accept either calibrated `routeSamples` or legacy `route`

## Files

- Added `src/workRouteData.js`
- Added `src/workRouteData.test.js`
- Modified `src/workThemes.js`
- Modified `src/workThemes.test.js`

## RED

### Command

```bash
node --test src/workRouteData.test.js
```

### Output

```text
TAP version 13
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/src/workRouteData.js' imported from /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/src/workRouteData.test.js
not ok 1 - /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/src/workRouteData.test.js
1..1
# tests 1
# pass 0
# fail 1
```

Failure matched the intended TDD red step: the new route registry module did not exist yet.

## GREEN

### Command

```bash
node --test src/workRouteData.test.js src/workThemes.test.js
```

### Output

```text
1..20
# tests 20
# pass 20
# fail 0
# duration_ms 65.188375
```

Focused green covered the new route registry tests plus the theme integration assertions.

## Full-Suite Result

### Command

```bash
npm test
```

### Output

```text
> ai-roleplay-phone@0.2.90 test
> node --test src/*.test.js

1..66
# tests 66
# pass 66
# fail 0
# duration_ms 81.698875
```

## Self-Review

- Kept the change surface inside Task 2 ownership only.
- Migrated only `modern` into the new strict contract and left every other theme on the temporary route generator path, matching the corrected rollout plan.
- Preserved compatibility for current callers by continuing to expose `route` from calibrated themes while adding the stricter `routeSamples` and `routeSegments` fields.
- Added tests that lock down both the data shape and the sequencing rule that future tasks must not backfill fake route records for uncalibrated themes.

## Concerns

- The modern calibrated samples are a dense migration of the current temporary modern geometry, not the later screenshot-audited calibration that Tasks 3 and 9 will refine. The schema is now strict, but the art-to-road alignment still depends on those later audit tasks.

## Review Fix: Legacy Bypass and Exact Cardinality

### Fixes

- Guarded both legacy initialization paths in `src/workThemes.js` with `getWorkRouteTheme(...)`, so every theme present in `WORK_ROUTE_DATA` bypasses the generic layout mutation and the explicit coordinate/route generator.
- Removed the duplicated `modern` entry, including its five explicit legacy route arrays, from `GENERATED_MAP_COORDINATES`.
- Kept both legacy generators active for uncalibrated themes.
- Updated `validateWorkRouteTheme` to report independently when the theme does not contain exactly five places or the route registry does not contain exactly five keys.
- Added regressions proving calibrated `modern` retains its declared building hit area, uncalibrated `xuanhuan` still receives generated geometry, and four-place/four-route inputs fail the fixed cardinality contract independently.

### Review-Fix RED

Command:

```bash
node --test src/workRouteData.test.js src/workThemes.test.js
```

Evidence before the production fix:

```text
not ok 2 - route validation independently requires exactly five theme places and route keys
error: 'false == true'
not ok 17 - modern merges calibrated route fields while uncalibrated themes stay on the temporary path
expected: { x: 22, y: 26, width: 40, height: 18 }
actual:   { x: 18, y: 19, width: 14, height: 10 }
1..21
# tests 21
# pass 19
# fail 2
```

Both failures matched the review findings: arbitrary matching counts were accepted, and modern had already been mutated by legacy coordinate generation.

The first post-fix run passed both new production regressions but exposed an incorrect control expectation in the test: `alchemy` is xuanhuan's second place and its generated pin is `{ x: 50, y: 11 }`. After correcting that test-only expectation, the exact focused command was rerun.

### Review-Fix GREEN

Command:

```bash
node --test src/workRouteData.test.js src/workThemes.test.js
```

Evidence:

```text
1..21
# tests 21
# suites 0
# pass 21
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 52.126334
```

### Review-Fix Self-Review

- Diff is limited to the four Task 2-owned source/test files and this report.
- `modern` no longer appears in `GENERATED_MAP_COORDINATES`.
- No version, deployment, `App.jsx`, asset, traveler, or `designs/` files were changed.
- The pre-existing untracked `designs/` directory remains untouched.
