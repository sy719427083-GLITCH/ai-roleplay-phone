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
