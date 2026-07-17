# Task 3: Make Atlas Sampling Sharp And Motion Calm

Base commit: `095be21` (`docs: record task 2 verification`).

## RED

Command run before production changes:

```sh
node --test --test-reporter=spec src/work/officeAssets.test.js src/work/officeMotion.test.js
```

Exit code: `1`

Exact failure summary:

```text
✖ maps every direction and activity to the fixed atlas contract
+   backgroundPosition: '100% 0%'
+   backgroundSize: '800% 800%'
-   backgroundHeight: 832
-   backgroundWidth: 832
-   frameX: 728
-   frameY: 0

✖ returns background-grid values that can be spread into a sprite style
+   backgroundPosition: '14.285714285714285% 42.857142857142854%'
+   backgroundSize: '800% 800%'
-   backgroundHeight: 832
-   backgroundWidth: 832
-   frameX: 104
-   frameY: 312

✖ uses integer CSS pixels for every atlas frame
AssertionError [ERR_ASSERTION]: 0:0 frameX

✖ walk frames advance every 125ms
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
1 !== 0

ℹ tests 13
ℹ pass 9
ℹ fail 4
```

The failures prove the old percentage atlas API and 12fps cadence were present before implementation.

## GREEN

Focused command after implementation:

```sh
node --test --test-reporter=spec src/work/officeAssets.test.js src/work/officeMotion.test.js
```

Exit code: `0`; `13` tests passed, `0` failed. This includes `uses integer CSS pixels for every atlas frame` and `walk frames advance every 125ms`.

Full suite:

```sh
npm test
```

Exit code: `0`; `174` tests passed, `0` failed.

Build:

```sh
npm run build
```

Exit code: `0`; Vite built the production bundle successfully.

Verifier unit mode:

```sh
node scripts/verify-office.mjs --probe-signal-cleanup
```

Exit code: `0`; all four cleanup ownership and signal checks reported `PASS`.

## Self-Review

- Replaced percentage atlas output with integer 104px frame offsets and an 832px atlas background, without changing the 1024px asset-dimension assertions.
- Set route speed to 10 in the scene, motion fallback, and verifier while retaining continuous route interpolation.
- Set walking frames to 125ms and active frames to 320ms; character action loops are all within 1.3s-1.8s.
- Used a fixed 104px sprite wrapper and `translate(-52px, -82px)` anchor; module rendering and furniture fallback remain covered by the full suite.
- `git diff --check` completed with no output. A static scan found no remaining `800%`, `/ 180`, `speed = 18`, or `OFFICE_WALK_SPEED = 18` in office runtime code.

## Concern

The successful production build still emits the existing unresolved-at-build-time warning for `worldbook-assets/hero-worldbook-atlas.png?v=0.2.96`; it is outside this task's office scope.
