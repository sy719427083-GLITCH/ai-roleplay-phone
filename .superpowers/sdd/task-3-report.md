# Task 3 Report: Extend The Scheduler With Concrete New Activities

## Status

- Completed on July 16, 2026.
- Scope kept to the requested owned files plus this report.

## Files

- Modified `src/work/officeScheduler.js`
- Modified `src/work/officeScheduler.test.js`
- Modified `src/work/officeState.js`
- Modified `src/work/officeState.test.js`
- Modified `.superpowers/sdd/task-3-report.md`

## RED

### Command

```bash
node --test src/work/officeScheduler.test.js src/work/officeState.test.js
```

### Evidence

Initial run failed in the intended task areas:

- `officeScheduler.test.js`
  - `exports reachable weights for all eight activity types`
  - `free mode selects the new desk activities with deterministic prop variants`
  - `personality keywords shift activity selection deterministically`
- `officeState.test.js`
  - `new desk-local activities enter their exact active statuses and keep prop variants`
  - `restore resets the new desk-local phases back to idle`

Representative failures:

- scheduler still exported the old five-activity weight tables
- free-mode reading selection returned an old activity instead of `reading`
- new reducer arrivals fell back to `闲聊中`
- restore left `reading` phase characters active instead of resetting them to idle

## GREEN

### Command

```bash
node --test src/work/officeScheduler.test.js src/work/officeState.test.js
```

### Output

```text
1..45
# tests 45
# pass 45
# fail 0
```

## Full Suite

### Command

```bash
node --test src/work/officeScheduler.test.js src/work/officeState.test.js && npm test
```

### Output

```text
Focused scheduler/state tests: 45 passed, 0 failed
npm test: 135 passed, 0 failed
```

## Implementation Summary

- Expanded scheduler mode weights to the exact eight-activity 100-point tables from the task brief.
- Added deterministic desk-local prop variants for:
  - `reading` via `paperback` / `hardcover` / `magazine`
  - `watchingSeries` via `phone-landscape` / `tablet` / `second-screen`
  - `watchingShortVideo` via `phone-portrait-light` / `phone-portrait-dark`
- Extended personality modifiers so:
  - `自律` and `沉静` bias toward work/reading
  - `追剧` biases toward `watchingSeries`
  - `短视频` biases toward `watchingShortVideo`
  - `外向` and `话多` still bias toward chat
  - final weights clamp to at least `1`
- Added reducer statuses for `reading`, `watchingSeries`, and `watchingShortVideo`.
- Treated the three new activities as desk-local active phases during restore reset handling.

## Self-Review

- Re-checked the weighted-activity order against the brief. The order now matches the required selection thresholds instead of the exported activity list order.
- Verified existing group-chat and reservation behavior stayed intact through the existing chat and anchor tests.
- Kept the reducer changes narrow: exact statuses plus restore handling only.
- Confirmed no unrelated files were edited.

## Concerns

- `src/work/WorkAppScreen.jsx` still has the older `DESK_ACTIVITIES` set (`working`, `slacking`, `gaming`). That means the scheduler and reducer now understand the new desk-local activities, but the live UI will not start them until the consumer-side follow-up task lands.
- Personality modifier magnitudes were chosen to satisfy the task intent and deterministic tests because the brief specified the direction of each bias, not exact delta values.
