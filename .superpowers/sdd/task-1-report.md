# Task 1 Report: Define The Modular Station Contract

Implemented the pure office station/break state model in `src/work/officeStations.js` and added focused tests in `src/work/officeStations.test.js`.

What changed:
- Added the station asset contract for five slots and two station states each.
- Added the break asset contract for the four break states.
- Added `SEATED_HOME_ACTIVITIES`.
- Added `resolveStationVisualState(input)`.
- Added `resolveBreakVisualState(input)`.
- Added `resolveOfficeModuleState(input)`.

TDD evidence:
- Red: `node --test src/work/officeStations.test.js` failed with `ERR_MODULE_NOT_FOUND` for `src/work/officeStations.js`.
- Green: implemented the module minimally to satisfy the contract.
- Verification: `node --test src/work/officeStations.test.js` passed.
- Full verification: `npm test` passed.

Scope notes:
- No React, CSS, runtime rendering, generated assets, or version changes were touched.
- Existing profile, scheduler, activity-event, navigation, and conversation logic was left alone.

Concerns:
- None from this task.

Follow-up fix evidence:
- RED command: `node --test src/work/officeStations.test.js`
- RED result: `uses active shell only for a seated activity at home` failed with `Expected values to be strictly equal: + actual - expected + 'active-shell' - 'empty'` when `phase` was `listening` / `meeting`.
- GREEN command: `node --test src/work/officeStations.test.js`
- GREEN result: all 4 subtests passed.
- Full verification command: `npm test`
- Full verification result: all 172 subtests passed.
