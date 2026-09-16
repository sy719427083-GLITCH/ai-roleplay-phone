# Work Simulation Implementation Plan

**Goal:** Turn the existing Work launcher into a playable worldbook-linked career simulation.
**Architecture:** WorkSimulation.jsx owns UI and persistence; workSimulation.js owns pure state transitions, source selection and context; workSimulationApi.js reuses the selected main API configuration. Original worldbooks and characters remain read-only.
**Tech Stack:** Existing React, CSS, lucide-react, Node test runner, Vite.

## Constraints
- Read ccat-worldbook-worlds-v1 and apiCharacters; write only ccat-work-simulation-v1.
- Existing character identities win; supplementary workplace roles are editable and labeled.
- Four views: office, desk, communications, career. Browsing does not advance simulation time.
- No automatic external messages, original-worldbook writes, or real wallet transactions.
- Fail visibly on storage/API errors; retain draft; abort requests on unmount.

## Tasks
- [x] Add src/workSimulation.test.js. Verify world isolation, deduplication, invalid saves, task prerequisites, edits requiring re-review, one-time delivery, next-day progression, private-context isolation, source immutability.
- [x] Run node --test src/workSimulation.test.js and observe missing implementation failure.
- [x] Implement src/workSimulation.js: readSources(storage), createCareer(world, people, job, assignments), transition(career, action), buildWorkContext(world, character, career), loadCareer(storage).
- [x] Implement src/workSimulationApi.js using parseConfigs/STORAGE_KEY, fetch with AbortSignal and timeout, plain character replies only.
- [x] Build src/WorkSimulation.jsx and src/workSimulation.css. Provide empty-source recovery, onboarding, editable assignments, office hotspots, actionable multi-stage project, drafts, review feedback, per-person chat, saved career, next day and switching careers.
- [x] Replace only WorkPlaceholder routing in src/App.jsx; update obsolete launcher contract and AGENTS.md approved product direction.
- [x] Run npm test and npm run build. Start local Vite; inspect browser layout and exercise an isolated fixture through project completion, reload, and next day; remove fixture after verification.

## Verification evidence

- `npm test`: 77 passed, 0 failed.
- Vite production build passed; existing atlas asset URL warning remains.
- In-app browser, isolated fixture on port 5186: onboarding, source identities, project prerequisites, draft persistence after reload, single delivery, career archive and next day verified.
- Missing API retains input and shows setup guidance; API request/empty response/HTTP failure tested with a mock endpoint. No live user API request made.
- Visual inspection at 390x844 and 1100x850; fixed retained scroll position between onboarding and main views.
- First version uses explicit occupation templates, public world context and private per-person chat history; basic submission checks are not semantic AI grading.
