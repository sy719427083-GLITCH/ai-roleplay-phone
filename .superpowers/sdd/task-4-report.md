# Task 4 Report: Redraw The Modular Office Environment

## Scope

- Replaced `public/work-office-assets/office-bg.webp` with a low-saturation pearl-white, dusty-rose, mist-blue, and muted-lavender architecture-only office.
- Added ten transparent station modules under `public/work-office-assets/stations/`.
- Added four transparent break states under `public/work-office-assets/break/`.
- Added reproducible art prompts and immutable 1080x1920 slot rectangles in `scripts/office-art-spec.mjs`.
- Added `scripts/normalize-office-art.mjs` for background cover fitting, paired-station splitting, transparent-bound fitting, chroma cleanup, and break-state splitting.
- Extended asset and browser verification for six selected runtime modules.

## Art Generation

- Used the built-in image generator for the architecture background, boss pair, four employee pairs, and break state sheet.
- Rejected and regenerated the lower-right employee pair when its orientation did not match the right-side bay.
- Rejected and regenerated the break sheet when it repeated a counter already baked into the background.
- Final break modules contain only stools and food. `break-both-occupied.webp` is intentionally transparent so the fixed counter remains unobstructed.
- Source PNGs and alpha intermediates remain temporary and are not release assets.

## TDD Evidence

- RED: the station fixture failed its aspect-ratio assertion with a distorted `278x232` subject.
- GREEN: transparent bounds are now contain-fitted into each immutable slot while preserving source aspect ratio.
- RED: the empty fourth break cell failed with `Sheet cell 3 is empty`.
- GREEN: only the explicitly configured `both-occupied` target accepts an empty source cell.
- RED: decoded inspection found one residual green fringe pixel in the boss module.
- GREEN: pixels with alpha at or below eight are cleared to transparent black before WebP encoding.
- RED: the old break prompt still required an identical counter in every cell.
- GREEN: the prompt now states that the fixed counter belongs to the background and the dynamic sheet must never redraw it.

## Verification

- `node --test --test-reporter=spec scripts/office-art-spec.test.mjs src/work/officeAssets.test.js`: 14 passed, 0 failed.
- `npm test`: 176 passed, 0 failed.
- `npm run build`: passed; Vite transformed 1,800 modules.
- `git diff --check`: passed.
- In-app Browser at 390x844: five workstations align with existing character positions, the central aisle stays open, and the lower break area shows one fixed counter only.

## Notes

- Character atlases are intentionally unchanged in this task and will be fully redrawn in Task 5.
- The existing runtime-resolved worldbook atlas warning remains unrelated to Office art.
