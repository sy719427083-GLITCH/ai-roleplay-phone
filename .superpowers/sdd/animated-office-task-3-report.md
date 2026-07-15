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

## RED Evidence

Exact command run before implementation:

```bash
node --test src/work/officeNavigation.test.js
```

Relevant failing output:

```text
TAP version 13
# node:internal/errors:496
#     ErrorCaptureStackTrace(err);
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeNavigation.js' imported from /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeNavigation.test.js
# ...
# Subtest: /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeNavigation.test.js
not ok 1 - /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeNavigation.test.js
```

Why this was expected: the navigation module did not exist yet, so the test file could not import `officeNavigation.js`.

## GREEN Evidence

Exact focused command:

```bash
node --test src/work/officeNavigation.test.js
```

Passing output:

```text
1..5
# tests 5
# pass 5
# fail 0
```

## Full Test Run

Exact command:

```bash
npm test
```

Passing output:

```text
1..60
# tests 60
# pass 60
# fail 0
```

## Commit

- SHA: `d0ad42b`
- Subject: `feat: add office navigation routes`

## Files Changed

- `src/work/officeNavigation.js`
- `src/work/officeNavigation.test.js`
- `.superpowers/sdd/animated-office-task-3-report.md`

## Self-Review Findings

- The route search is deterministic breadth-first search over explicit neighbor lists.
- Unknown nodes and disconnected destinations return an empty route.
- `getFacing` uses node coordinates and returns horizontal directions for the office routes covered by the tests.
- `claimAnchor` and `releaseAnchor` return new reservation objects and do not mutate the input object.
- The disconnected-node test uses a dedicated isolated node instead of relying on incidental graph gaps.

## Concerns

- None.

## Review Fixes

### RED Evidence

Exact reproduction command used against the pre-fix module state:

```bash
tmpdir=$(mktemp -d)
mkdir -p "$tmpdir/src/work"
cp package.json "$tmpdir/package.json"
cp src/work/officeNavigation.test.js "$tmpdir/src/work/officeNavigation.test.js"
git show HEAD:src/work/officeNavigation.js > "$tmpdir/src/work/officeNavigation.js"
node --test "$tmpdir/src/work/officeNavigation.test.js"
```

Relevant failing output:

```text
# Subtest: faces the destination horizontally
not ok 5 - faces the destination horizontally
  error: |-
    Expected values to be strictly equal:

    'right' !== null

# Subtest: claims and releases anchors without mutating the source reservations
not ok 6 - claims and releases anchors without mutating the source reservations
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

      {
        'break-1': {
          anchorId: 'break-1',
    +     ownerId: 'employee1'
    -     slotId: 'employee1'
        }
      }
1..6
# tests 6
# pass 4
# fail 2
```

Why this was expected: the pre-fix module still returned a non-null facing value for unknown nodes and stored reservation records under `ownerId` instead of the office-state contract's `slotId`.

### GREEN Evidence

Exact focused command:

```bash
node --test src/work/officeNavigation.test.js
```

Passing output:

```text
1..6
# tests 6
# pass 6
# fail 0
```

### Full NPM Test

Exact command:

```bash
npm test
```

Passing output:

```text
1..61
# tests 61
# pass 61
# fail 0
```

### Commit

- SHA: `a101cf5`
- Subject: `fix: tighten office navigation reservations`

### Files Changed

- `src/work/officeNavigation.js`
- `src/work/officeNavigation.test.js`
- `.superpowers/sdd/animated-office-task-3-report.md`

### Self-Review Findings

- `claimAnchor` now rejects a second reservation for the same slot even when a different anchor is free.
- Reservation records now use `{ anchorId, slotId }`, matching the office state contract.
- `releaseAnchor` only removes a record when the same slot releases it and otherwise returns an unchanged clone.
- `getFacing` now returns `null` for unknown nodes.
- The graph contract tests now enforce the required node categories and bidirectional edges.

### Concerns

- None.
