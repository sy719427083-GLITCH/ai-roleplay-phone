# Task 15 Report

## Scope

- Kept the standalone React actor overlay and upgraded its deterministic collision layout so each actor's bubble and label remain disjoint, bounded, and separated even when all five actors share a top-edge coordinate.
- Kept the accessible office/lounge Lucide door controls, real scene switching, and post-switch focus restoration.
- Replaced declaration-only custom animation acceptance with actual image fetch, decode, geometry, transparency, and per-frame occupancy inspection.
- Hardened decoded-image inspection with per-frame opaque/transparent coverage and coarse alpha/luminance fingerprints, so copied frames and one-pixel transparency tricks cannot satisfy the animation contract.
- Keyed both inspection caching and Pixi texture loading by complete strip geometry, preventing a shared source URL with changed layout metadata from reusing stale validation or crop frames.
- Unified overlay collision geometry with the rendered DOM through deterministic CJK-aware text measurement and CSS height variables. Five long top-edge bubbles remain readable, bounded, and disjoint.
- Added hosted JSON manifests and real JSON/ZIP bundle uploads. ZIP extraction uses `fflate`, enforces compressed, entry, and total uncompressed limits, and rejects unsafe paths, duplicate entries, missing clips, multiple manifests, unsupported compression, and malformed archives.
- Converts verified local PNG/WebP bundle entries to bounded persistent data URLs. No blob URL is stored, and failed validation leaves the built-in chibi assignment unchanged.
- Preserved Pixi custom locomotion, idle, named action, and generic action fallback resolution for both hosted and embedded manifests.

## TDD Evidence

### RED

- First review-focused run: 12 tests, 7 passed, 5 failed. Failures reproduced top-edge overlay overlap, acceptance of a three-frame idle fallback, missing real-image inspection, incorrect redirect base handling, and missing streaming byte enforcement.
- Second review-focused run after adding real `fflate` ZIP fixtures and Work assertions: 30 tests, 20 passed, 10 failed. Additional failures reproduced absent ZIP upload parsing, absent persistent embedded resources, ZIP file rejection, unresolved local JSON paths, and missing JSON/ZIP Work input wiring.
- Third review-focused run: 51 tests, 42 passed, 9 failed. Failures reproduced acceptance of copied frames plus token transparency, source-only inspection caching, source/facing-only Pixi texture reuse, missing shared text-height measurement, and fixed-height top-edge bubble collisions. A dedicated adversarial assertion confirmed the former validator accepted the copied-frame fixture before implementation changed.

### GREEN

- Third review-focused overlay, Work, and actor-view tests: 51 passed, 0 failed.
- Review-focused Work and all Pixi tests: 70 passed, 0 failed.
- Hosted manifests use `response.url` after redirects and stream response bodies. A manifest without `Content-Length` is cancelled immediately when its byte cap is crossed.
- Full repository suite: 223 passed, 0 failed.
- Vite production build completed successfully (2549 modules transformed). The pre-existing unresolved worldbook runtime asset and chunk-size notices remain warnings only.
- Final `git diff --check` passed.

## Validation Contract

- Every validator result remains exactly `{ok, reason, manifest}` with only `still-image`, `low-resolution`, `invalid-clip-manifest`, or `oversized` on rejection.
- Locomotion requires front/back/left/right clips with at least eight frames each. Idle, generic action, and named action clips require at least four frames each.
- Every required source/geometry pair is fetched and decoded before acceptance. Actual bitmap dimensions must exactly match the declared grid, every frame needs at least 2% opaque subject coverage, and the full clip needs at least 5% meaningful transparent coverage.
- The real inspector computes an 8x8 alpha/luminance fingerprint for every frame. Locomotion needs at least four perceptually distinct frames; idle and action clips need at least two, in addition to their declared eight/four frame minima.
- Inspection cache keys include source, frame size, bitmap width/height, columns, rows, and frame count. Pixi loaded/pending identities additionally include facing, row mapping, mirroring, and legal facings.
- Hosted relative clips resolve against the final response URL. Uploaded JSON with relative clips has no resource base and is rejected.
- ZIP files are capped at 8 MiB compressed, 6 MiB per entry, and 12 MiB total uncompressed. The manifest remains capped at 2 MiB.
- ZIP bundles must contain exactly one `manifest.json`; every relative PNG/WebP clip must map to a real safe archive entry. Embedded sources are persisted as data URLs and remain valid after reload.
- Direct image uploads, image data URLs, and static image URLs remain rejected. Legacy still-image assignment fields are not migrated.

## Work And Accessibility

- Assignment upload accepts `application/json`, `application/zip`, `.json`, and `.zip`, with keyboard-accessible activation and precise Chinese rejection messages.
- Upload work owns an abortable FileReader plus AbortController. Replaced or unmounted work cannot commit stale validation results.
- Door focus restoration and pointer-safe actor overlays remain covered at the Work layer.
- Bubble text keeps the existing 80-character boundary without hidden overflow. The same conservative CJK/ASCII wrapping model supplies collision rectangles and the CSS heights for bubble, name, and status DOM elements.

## Residual Risk

- Browser image verification depends on `fetch`, CORS access, `createImageBitmap`, and canvas pixel reads. Any unavailable or blocked stage rejects the custom animation and preserves the built-in chibi.
- Perceptual validation deliberately rejects clips whose motion is only sub-threshold pixel noise. Extremely subtle legitimate animation may need clearer frame-to-frame changes to pass.
- Embedded bundles can exceed the browser's storage quota after base64 expansion even when they pass archive limits. Assignment persistence then fails atomically and keeps the previous built-in/custom assignment.
