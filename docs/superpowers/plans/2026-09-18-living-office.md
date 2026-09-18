# Living Office Implementation Plan

> Execute inline using executing-plans; user approved implementation.

**Goal:** An animated office with actionable chibi characters and existing role-driven work.
**Architecture:** OfficeScene renders scenery and actors; WorkShift shares its actions with a compact office presentation. WorkSimulation retains persistence and payroll ownership.
**Tech Stack:** React, CSS animations, inline SVG, existing Vite/node tests.

- [x] Build pure office actor state selection with tests for idle, working, support, break and delivered priorities.
- [x] Render one user and up to three real characters, furniture, clickable destinations, keyboard accessible actions and reduced-motion support.
- [x] Add compact WorkShift presentation and activity callbacks; retain request cancellation, API errors and salary safeguards.
- [x] Replace office dashboard cards with scene and compact clock. Keep lore/colleague access and detailed work view.
- [x] Run tests/build, inspect mobile browser layout and work interactions, increment release and deploy to existing GitHub Pages.

Validation: 92 node tests pass; production build passes. In an isolated local fixture with a mock API, verified begin/intro, support across tab switches (12s saved on 60s shift), salary receipt/closing response, day reset, persistent coffee destination, person-specific office chat and 320px no horizontal overflow. Real API responses and native iOS effects were not tested.
