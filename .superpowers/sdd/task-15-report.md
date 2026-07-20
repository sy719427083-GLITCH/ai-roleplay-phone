# Task 15 Report

## Scope

- Added a standalone React actor overlay with strict five-slot snapshots, scene visibility, renderer-aligned coordinates, current-speaker bubbles, and deterministic bounded collision layout.
- Added accessible office/lounge door controls with Lucide icons, real scene switching, and post-switch focus restoration.
- Replaced still-image customization with validated hosted animation manifests and uploaded JSON manifest bundles.
- Connected validated custom locomotion, idle, named action, and generic action fallbacks to the Pixi actor renderer.
- Removed legacy still-image assignment migration and preserved built-in chibis whenever validation fails.

## TDD Evidence

### RED

- Initial Task 15 focused run: 34 tests, 25 passed, 9 failed because the overlay helpers, animation validator, door interface, and custom Pixi clip resolution did not exist.
- Legacy still-image migration test failed because `normalizeStoredAssignments` was not exposed for the required boundary assertion.
- Hostile manifest test failed on a throwing getter.
- Edge-bubble render test failed because the React overlay did not consume the helper's clamped horizontal coordinates.

### GREEN

- Overlay, Work, profile, actor, and renderer focused suite passes.
- Full repository test suite passes.
- Vite production build passes.
- `git diff --check` passes.

## Browser QA

- Verified at 390 x 844 with one Pixi canvas and five actor overlays.
- Clicking `进入休息区` changes the control to `返回办公室` and keeps focus on the same door control.
- Returning to the office restores all five visible actor labels within the scene.
- Assignment upload accepts only `application/json,.json`; no `image/*` upload remains.

## Validation Contract

- Stable result shape: `{ok, reason, manifest}`.
- Rejection reasons: `still-image`, `low-resolution`, `invalid-clip-manifest`, and `oversized`.
- Requires declared alpha, four-direction locomotion with at least eight frames per direction, at least 384 x 384 per frame, and idle/action fallbacks.
- Hosted manifests are fetched, parsed, normalized relative to their manifest URL, and saved only after full validation.
- Uploaded JSON manifests use bounded text reads with stale-reader cancellation. ZIP is intentionally unsupported, so no extension-only ZIP acceptance exists.

## Residual Risk

- The manifest validator verifies declared frame geometry and alpha metadata. Actual texture fetch/decode remains a Pixi responsibility; a decode failure clears the custom manifest and restores the built-in chibi.
- Cross-origin clip hosts must permit browser image loading.
