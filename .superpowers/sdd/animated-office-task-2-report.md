# Animated Office Task 2 Report: Pure Character and Conversation State

## Implementation

- Added `src/work/officeState.js` with:
  - `ACTIVITY_STATUS`
  - `TRAVEL_STATUS`
  - `createOfficeState({ assignments, now, durationMs })`
  - `officeReducer(state, action)`
  - `serializeOfficeState(state)`
  - `restoreOfficeState(raw, assignments, now)`
- Implemented immutable reducer handling for:
  - `SET_MODE`
  - `TICK`
  - `ASSIGN_PROFILE`
  - `START_ACTIVITY`
  - `ADVANCE_ROUTE`
  - `ARRIVE_ACTIVITY`
  - `START_RETURN`
  - `FINISH_RETURN`
  - `OPEN_CONVERSATION`
  - `APPEND_CONVERSATION`
  - `QUEUE_BUBBLE`
  - `SHIFT_BUBBLE`
  - `CLOSE_CONVERSATION`
  - `RESET_EXPIRED`
- Added `src/work/officeState.test.js` covering:
  - meal travel, arrival, and return-home flow
  - simultaneous conversation transcript isolation
  - reload cleanup of live conversations
  - mode/profile/tick/route/expiry/serialization behavior
  - per-session bubble queue isolation
  - rejection of overlapping conversation membership
  - closing one concurrent session without disturbing the other

## Files

- Added `src/work/officeState.js`
- Added `src/work/officeState.test.js`

## RED

### Command

```bash
node --test src/work/officeState.test.js
```

### Output

```text
TAP version 13
# node:internal/errors:496
#     ErrorCaptureStackTrace(err);
#     ^
# Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeState.js' imported from /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeState.test.js
#     at new NodeError (node:internal/errors:405:5)
#     at finalizeResolution (node:internal/modules/esm/resolve:327:11)
#     at moduleResolve (node:internal/modules/esm/resolve:980:10)
#     at defaultResolve (node:internal/modules/esm/resolve:1193:11)
#     at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:403:12)
#     at ModuleLoader.resolve (node:internal/modules/esm/loader:372:25)
#     at ModuleLoader.getModuleJob (node:internal/modules/esm/loader:249:38)
#     at ModuleWrap.<anonymous> (node:internal/modules/esm/module_job:76:39)
#     at link (node:internal/modules/esm/module_job:75:36) {
#   url: 'file:///Users/mypc/Desktop/Ccat%20OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeState.js',
#   code: 'ERR_MODULE_NOT_FOUND'
# }
# Node.js v18.19.0
# Subtest: /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeState.test.js
not ok 1 - /Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeState.test.js
  ---
  duration_ms: 28.723125
  location: '/Users/mypc/Desktop/Ccat OS/ai-roleplay-phone/.worktrees/animated-office/src/work/officeState.test.js:1:1'
  failureType: 'testCodeFailure'
  exitCode: 1
  error: 'test failed'
  code: 'ERR_TEST_FAILURE'
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 31.29275
```

Failure matched the intended TDD red step: the new reducer module did not exist yet.

## GREEN

### Focused Command

```bash
node --test src/work/officeState.test.js
```

### Focused Output

```text
TAP version 13
# Subtest: walks to a meal, eats visible food, and returns home
ok 1 - walks to a meal, eats visible food, and returns home
  ---
  duration_ms: 0.54725
  ...
# Subtest: keeps simultaneous conversation transcripts isolated
ok 2 - keeps simultaneous conversation transcripts isolated
  ---
  duration_ms: 0.376417
  ...
# Subtest: reload closes network conversations and returns characters home
ok 3 - reload closes network conversations and returns characters home
  ---
  duration_ms: 0.28525
  ...
# Subtest: updates mode profile routing expiry and serialization state
ok 4 - updates mode profile routing expiry and serialization state
  ---
  duration_ms: 0.225083
  ...
# Subtest: queues and shifts bubbles per conversation without crossing sessions
ok 5 - queues and shifts bubbles per conversation without crossing sessions
  ---
  duration_ms: 0.077875
  ...
# Subtest: rejects opening a conversation when any member is already busy in another session
ok 6 - rejects opening a conversation when any member is already busy in another session
  ---
  duration_ms: 0.078333
  ...
# Subtest: closing one concurrent session returns only that group and leaves the other session active
ok 7 - closing one concurrent session returns only that group and leaves the other session active
  ---
  duration_ms: 0.080167
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 38.732292
```

### Full Command

```bash
npm test
```

### Full Output

```text
> ai-roleplay-phone@0.2.94 test
> node --test src/*.test.js src/work/*.test.js

1..53
# tests 53
# suites 0
# pass 53
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 67.928541
```

## Commit

`feat: add office activity state machine` (exact final HEAD hash recorded in the task response)

## Self-Review

- Kept the change surface inside the two owned source files plus this report.
- Used normalized Task 1 assignments as the only profile source of truth for reducer-created characters.
- Enforced the brief's session-isolation rule by rejecting `OPEN_CONVERSATION` when any requested member already has a `conversationId`.
- Made `CLOSE_CONVERSATION` session-specific so one group can return home while unrelated groups remain active.
- Kept restore conservative: persisted live conversations are dropped and characters are snapped back to valid home/idle state unless they already represent a safe resumed desk state.

## Concerns

- `RESET_EXPIRED` currently resolves expired activities immediately back to home/idle rather than converting them into a visible return walk. That matches the persistence brief, but later runtime choreography may want a softer handoff once navigation is wired in.
- `START_ACTIVITY` uses the explicit travel labels from the brief and falls back to the meeting travel label for unknown routed activities; if later tasks introduce routed `gaming` or `slacking`, the scheduler/navigation layer should pass an explicit travel intent or extend the mapping.
