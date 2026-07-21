# Work App Removal Design

**Goal:** Remove every dedicated Work app implementation and visual asset while preserving the existing `工作` launcher icon.

## Behavior

- The home screen keeps the existing `工作` icon and label.
- Opening `工作` uses the ordinary generic app page with the existing header and back button.
- No office scene, character simulation, API activity, conversation records, assignment controls, or office-specific styling remains.

## Cleanup Boundary

- Remove `src/work/` and its tests.
- Remove office-only scripts, contracts, and the PixiJS/pathfinding dependencies.
- Remove `public/work-office-v2/` and the synchronized `docs/work-office-v2/` tree.
- Remove superseded office specs, plans, QA screenshots, contact sheets, and release notes.
- Keep shared Pages synchronization, but stop expecting or copying the removed office asset directory.
- Keep unrelated user-owned `.superpowers/sdd/progress.md` and `tmp/` changes untouched.

## Release

- Bump the application to `0.2.99`.
- Run the full test suite and production build.
- Synchronize `dist/` to `docs/`, push the release to `main`, and verify the live version marker plus a representative removed asset returning `404`.
