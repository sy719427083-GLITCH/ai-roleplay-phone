# Task 7 Report

## Result

Implemented smooth office route rendering, authoritative activity-event action rendering, directional atlas frames, static custom-image handling, and complete speech bubbles.

## TDD Evidence

### Red

Command:

```bash
node --test src/work/WorkAppScreen.test.js
```

Result: exit 1, 7 passed and 2 failed.

- `renders every concrete office action from the authoritative event` failed with `missing BookProps`.
- `removes hard route-step and bubble-clamp rendering` failed because `routeStepDurationMs` was still present.
- The failures were caused by the missing Task 7 behavior, not a test setup or syntax error.

### Green

Command:

```bash
node --test src/work/WorkAppScreen.test.js
```

Result: exit 0, 9 passed and 0 failed.

Final combined verification:

```bash
node --test src/work/WorkAppScreen.test.js && npm test && npm run build
```

Result: exit 0.

- Focused test: 9 passed, 0 failed.
- Full test suite: 151 passed, 0 failed.
- Production build: 1,796 modules transformed; Vite build completed in 977 ms.
- Built bundle contains the new office background and chibi asset references.

## Files

- `src/work/OfficeCharacter.jsx`
  - Uses `getWalkFrame` for eight-frame walking and a supplied `motionNow` four-frame active clock.
  - Renders built-in atlas actions for all eight activity types.
  - Adds `BookProps`, `SeriesProps`, and `ShortVideoProps`.
  - Supplies event subject and prop variant to work, slack, meal, game, reading, video, and chat props.
  - Mirrors only left-facing built-in sprites; uploaded images remain static assets with subtle idle motion.
  - Removes hard route-step-duration positioning.
- `src/work/OfficeScene.jsx`
  - Samples moving routes from `routeStartedAt` and supplied `motionNow` at `OFFICE_WALK_SPEED`.
  - Resolves the active event through `activeEventBySlot` and `activityEvents` with actor ownership validation.
  - Passes `motion`, `motionNow`, and `activityEvent` to each character.
  - Uses `/ai-roleplay-phone/work-office-assets/office-bg.webp`.
  - Adds viewport-aware bubble center clamping while preserving group offsets and ownership.
- `src/work/office.css`
  - Adds purpose-specific book, series, and short-video prop styling.
  - Removes line clamping and the fixed five-member bubble width.
  - Allows complete wrapping with `overflow-wrap: anywhere` and `word-break: break-word`.
  - Keeps conversation-specific placements and applies the viewport clamp to five-member overrides.
- `src/work/WorkAppScreen.test.js`
  - Adds the required action/source contract and route-step/bubble contract tests.

## Commit

- SHA: `48ca54a`
- Message: `feat: render smooth office actions and bubbles`
- Commit contents: exactly the four owned Task 7 files.

## Self-Review

- Confirmed Task 7 adds no timer or `requestAnimationFrame`; `motionNow` is supplied externally with `state.now` only as the compatibility fallback until Task 8.
- Confirmed moving positions come directly from `sampleOfficeRoute` and use zero-duration CSS position updates.
- Confirmed active event lookup rejects an event owned by another slot.
- Confirmed all prop labels and variants use the matching activity event when present and no longer choose random render-time props.
- Confirmed custom uploads do not use atlas frames or left-facing mirroring.
- Confirmed `git diff --check` passes.
- Confirmed unrelated Task 6 changes and public assets were not staged or committed.

## Concerns

- No Task 7 implementation concerns.
- The build emits an existing warning for `/ai-roleplay-phone/worldbook-assets/hero-worldbook-atlas.png?v=0.2.95`, which is left for runtime resolution. It is unrelated to office assets and does not fail the build.
- Task 8 still owns the live animation clock and route-completion dispatch as required.

## Fix Follow-up

### Review Findings Addressed

- Active props, status labels, and activity atlas rows now require a non-ended event with an event ID, supported activity type, and exact `actorId` match. Absent or unowned events render idle state; moving characters continue to render the walk atlas and their travel status.
- Bubble placement now combines conversation placement, member compensation, and the five-member `-50/0/+50` spread in `getClampedBubbleLayout` before applying the viewport clamp. CSS receives one final offset and contains no five-member positional overrides.
- Tests now server-render absent, unowned, and owned event cases and execute the final five-member clamp with nonzero placement/member offsets at both viewport boundaries.

### Red Evidence

Command:

```bash
node --test src/work/WorkAppScreen.test.js
```

Result after correcting the SSR test harness: exit 1, 9 passed and 2 failed.

- The event-authority render contract received `data-activity="reading"`, atlas row 5, and `office-book-prop` without an event instead of idle rendering.
- The final-clamp contract failed because `getClampedBubbleLayout` was not yet exported or implemented.

### Verification

Commands:

```bash
node --test src/work/WorkAppScreen.test.js
npm test
npm run build
```

Results:

- Focused test: 11 passed, 0 failed, exit 0.
- Full test suite: 153 passed, 0 failed, exit 0.
- Production build: exit 0; 1,796 modules transformed; built in 1.04 seconds.
- The existing unrelated worldbook runtime-asset warning remains; no office asset import was unresolved.

### Files

- `src/work/OfficeCharacter.jsx`: added defensive exact event ownership validation and removed stale character activity/status fallback from active rendering.
- `src/work/OfficeScene.jsx`: exported the executable final-clamp helper and collapsed all bubble placement offsets into its result.
- `src/work/office.css`: reduced bubble placement to one JS-provided CSS variable and removed five-member positional selectors.
- `src/work/WorkAppScreen.test.js`: added executable server-render and pure-helper regressions.

### Commit

- SHA: `da02eaf`
- Message: `fix: enforce authoritative office rendering`
- Commit contents: exactly the four owned Task 7 source/test files.

### Self-Review

- Verified absent, unowned, ended, malformed, or unsupported events cannot select active props or active atlas rows; the executable regression directly covers absent and wrong-owner cases.
- Verified moving characters do not require an activity event to retain walk frames and travel status.
- Verified five-member offsets are applied once in JS and removed from CSS.
- Verified the clamp test includes base placement, member compensation, and five-member offsets before asserting exact left and right boundaries.
- Verified `git diff --check` and staged-path checks pass.
- Verified Task 6 `officeAssets` changes and public WebP assets were neither edited nor staged by this follow-up.
