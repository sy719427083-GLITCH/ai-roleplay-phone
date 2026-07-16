# Task 4 Report: Profile-Aware Activity Detail API

## Status

Implemented Task 4 in the animated-office worktree.

Changed files:

- `src/work/officeActivityApi.js`
- `src/work/officeActivityApi.test.js`
- `src/work/officeConversationApi.js`
- `src/work/officeConversationApi.test.js`

Report file:

- `.superpowers/sdd/task-4-report.md`

## RED Evidence

1. Activity API missing-module RED:

Command:

```bash
node --test src/work/officeActivityApi.test.js
```

Result:

- Exit code: `1`
- Expected failure: `Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../src/work/officeActivityApi.js`
- TAP summary: `pass 0`, `fail 1`

2. Conversation richer-profile RED:

Command:

```bash
node --test src/work/officeConversationApi.test.js
```

Result:

- Exit code: `1`
- Expected failing test: `preserves richer Me and Character profile snapshots only for current members`
- Failure showed `source`, `type`, and Character `worldview` missing from normalized prompt members.
- TAP summary: `pass 11`, `fail 1`

3. Parser strictness follow-up RED:

Command:

```bash
node --test src/work/officeActivityApi.test.js
```

Result:

- Exit code: `1`
- Expected failing test: `parses fenced JSON, rejects missing or extra keys, and caps human-readable fields`
- Failure showed numeric `title: 42` was incorrectly accepted as string `"42"`.
- TAP summary: `pass 4`, `fail 1`

## GREEN Evidence

Focused API command:

```bash
node --test src/work/officeActivityApi.test.js src/work/officeConversationApi.test.js
```

Result:

- Exit code: `0`
- TAP summary: `tests 17`, `pass 17`, `fail 0`

Full suite command:

```bash
npm test
```

Result:

- Exit code: `0`
- Script: `node --test src/*.test.js src/work/*.test.js`
- TAP summary: `tests 141`, `pass 141`, `fail 0`

## Implementation Notes

- Added `buildOfficeActivityMessages(event)` with activity-specific required meanings and prompt context limited to `event.profileSnapshots`.
- Added `parseOfficeActivityReply(raw, event)` with fenced/plain JSON parsing, exact seven-key validation, exact event/activity/sequence matching, required string detail fields, and 120-character caps.
- Added `requestOfficeActivityDetail(options)` using `getOfficeEndpoint(storage)`, injectable `fetchImpl`, and injectable `signal`.
- All configuration, missing fetch, network, HTTP, response JSON, and response validation failures return `createLocalActivityDetail(event)` plus `detailStatus: "fallback"`.
- Successful activity API responses return the strict parsed detail plus `detailStatus: "complete"`.
- Updated conversation member normalization to preserve `source`, `type`, and Character `worldview` while keeping existing member, transcript, and relationship isolation behavior.

## Self-Review

- Checked the diff after implementation: only the requested API/test files plus this required report changed.
- Confirmed the accidental parent-workspace test file created during patching was removed: `stray-parent-file-absent`.
- Reviewed strict parser behavior against the brief: missing keys, extra keys, wrong activity, stale sequence, non-string detail fields, malformed JSON, and fenced JSON are covered.
- Reviewed endpoint behavior against existing conversation API shape: endpoint selection remains delegated to `getOfficeEndpoint`, and conversation request behavior was not changed.
- Searched tool discovery for a reviewer subagent; only unrelated Figma tools were available, so the review here is manual self-review.

## Concerns

- `officeActivityApi.js` has its own small `getChatCompletionsUrl` helper because `officeConversationApi.js` does not export that internal helper. This preserves the existing conversation API surface.
- Character `worldview` is preserved for Character profiles only; Me worldview-like fields are intentionally excluded from the conversation prompt test to avoid leaking unrelated Me-only metadata.

## Fix Review Evidence

Review issue fixed on 2026-07-16:

- Confirmed `createOfficeProfileSnapshot(profile, "character")` produces the production shape `source: "character"` with `type: "main"` or `"npc"`.
- Root cause: `normalizeMemberProfile` preferred `type` over `source` and compared only with synthetic uppercase `"Character"`, so a real Character snapshot was treated as kind `"main"` or `"npc"` and lost `worldview`.
- Fix: prefer the snapshot's `source`, fall back to `type` only when source is absent, and compare the selected kind case-insensitively.
- Replaced the synthetic richer-profile fixture with snapshots produced by `createOfficeProfileSnapshot`. The test now covers lowercase `source: "character"`, `type: "main"`, Character worldview preservation, Me worldview exclusion, and outsider isolation.

### RED

Command:

```bash
node --test src/work/officeConversationApi.test.js
```

Result before the production fix:

- Exit code: `1`
- Expected failing test: `preserves richer Me and Character profile snapshots only for current members`
- Failure showed the real `source: "character", type: "main"` member was missing `worldview`.
- TAP summary: `tests 12`, `pass 11`, `fail 1`

### GREEN

Conversation regression command:

```bash
node --test src/work/officeConversationApi.test.js
```

Result:

- Exit code: `0`
- TAP summary: `tests 12`, `pass 12`, `fail 0`

Focused Task 4 command:

```bash
node --test src/work/officeActivityApi.test.js src/work/officeConversationApi.test.js
```

Result:

- Exit code: `0`
- TAP summary: `tests 17`, `pass 17`, `fail 0`

Full suite command:

```bash
npm test
```

Result:

- Exit code: `0`
- Script: `node --test src/*.test.js src/work/*.test.js`
- TAP summary: `tests 141`, `pass 141`, `fail 0`

### Fix Review

- Changed only `src/work/officeConversationApi.js`, `src/work/officeConversationApi.test.js`, and this required report.
- `git diff --check` completed with no output.
- The updated member/outsider isolation assertion passed; existing relationship, transcript, request-sequence, and conversation-session isolation tests remained unchanged and passed in both focused and full runs.
- Activity API files and the accepted duplicate `getChatCompletionsUrl` helper were not changed.
- No reviewer subagent was available in this environment; performed a manual diff and requirements review instead.

### Remaining Concerns

- None for this compatibility fix. The existing duplicated URL helper remains the accepted Task 4 minor note and was intentionally left out of scope.
