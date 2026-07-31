# Work APP Content Removal Design

## Goal

Keep the launcher icon and opening route for the Work APP, while removing all Work-specific UI, behavior, assets, tests, and published resources. Opening the retained Work APP entry displays a plain white placeholder page with only a return-to-desktop control.

## User-visible behavior

- The desktop launcher continues to show the existing `工作` icon.
- Opening `工作` shows a plain white, otherwise empty page.
- The page keeps one accessible control for returning to the desktop.
- No office, characters, movement, chat bubbles, projects, countdown, employee management, settings, AI director, notices, or Work navigation remains visible or executable.

## Cache removal

Opening the retained Work placeholder removes exactly these Work-owned local-storage entries:

- `ccatWorkCompanyV1`
- `ccatWorkOfficeV1`
- `ccatWorkProjectsV1`

The removal must tolerate missing keys and storage failures without crashing the app. No character, message, API configuration, wallet, worldbook, or other APP storage is read, changed, or deleted.

## Source and asset removal

- Replace the current Work screen integration with a minimal placeholder component.
- Remove the office, project, employee, countdown, settings, simulation, AI director, conversation, cache-management, and Work onboarding implementation.
- Remove Work-only styles, tests, browser QA scripts, generated QA screenshots, and package scripts.
- Remove Work-only image directories from source/public and the synchronized GitHub Pages output.
- Preserve the launcher icon implementation and any shared components or assets used by other APPs.
- Preserve unrelated user-owned untracked files under `artifacts/` and `designs/`.

## Verification

- A focused launcher test proves the `工作` icon still opens the placeholder.
- A cache test proves only the three Work keys are removed.
- Repository searches prove removed Work modules and assets have no dangling imports or published copies.
- The complete automated test suite and production build pass.
- Mobile browser QA proves the launcher opens a blank white page, the return control works, and unrelated caches remain unchanged.
- Publish a new version through the existing GitHub Pages workflow and verify the live bundle and removed assets.

## Out of scope

- Removing the desktop `工作` icon.
- Replacing the Work APP with a new feature.
- Clearing non-Work browser data.
- Redesigning any other APP.
