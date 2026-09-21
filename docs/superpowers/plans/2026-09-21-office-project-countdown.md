# Project acceptance and real-time payroll

User authorizes accepting projects, max three per local calendar day, real elapsed time, synced center countdown and automatic Wallet earnings. Preserve current board refresh and all original sources/saves.

- Add independent ccat-office-jobs-v1 ledger: accepted project snapshot, startedAt, endsAt, acceptedDay and paid flag. Three accepts per local day, no repeated acceptance of same current project today or while active. Allow concurrent projects. Refresh board never touches ledger. Rewards use 40 per minute; migrate unaccepted board amounts without changing accepted snapshots.
- Add acceptance, remaining time, daily quota, and idempotent settlement functions/tests. Save accepted job before starting, credit with existing durable income receipt, then mark paid. Retry after either Wallet or final ledger write failure without double credit, even after wallet history clearing.
- Global OfficeWorkProvider runs while App mounted, every second and on focus/visibility/storage. Serialize with same project lock; no dependence on office scene pause/mount. Closed browser catches up on next launch. Context feeds WorkOffice nav, Project management and countdown.
- Wallet listens to store change events and uses latest persisted wallet for manual edits; remove stale state auto-write effect so visible Wallet cannot overwrite automatic earnings.
- Add accept buttons, daily quota, jump to countdown, active progress and paid history. Validate pure money/time logic, mobile browser accept/limit/reopen synchronization, unit suite/build, review and Pages patch deployment.
