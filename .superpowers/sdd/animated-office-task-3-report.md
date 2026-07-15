# Task 3 Report

Implemented `src/work/officeNavigation.js` and `src/work/officeNavigation.test.js` for the office navigation graph and anchor reservation helpers.

What changed:

- Added a deterministic office graph with percentage coordinates and explicit neighbor lists.
- Implemented breadth-first route lookup with `findOfficeRoute(fromId, toId)`.
- Implemented direction detection with `getFacing(fromId, toId)`.
- Implemented immutable anchor ownership helpers with `claimAnchor(reservations, anchorId, ownerId)` and `releaseAnchor(reservations, anchorId, ownerId)`.
- Added focused tests for route search, unknown and disconnected nodes, wrong-owner and correct-owner release behavior, and input immutability.

Verification:

- `node --test src/work/officeNavigation.test.js`
- `npm test`

Notes:

- A single isolated `storage-closet` node is included to exercise the disconnected-node case without affecting the main office routes.
