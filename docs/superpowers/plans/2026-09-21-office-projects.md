# Office projects implementation plan

User requests at least five projects with name, amount, time and details; top-right refresh has five free uses then costs 200 from the existing Wallet.

Assumption pending optional answer: five free refreshes per local calendar day. Initial generation is free and does not count. Show five unique randomized projects from a larger local catalog, with explicit expected work durations and rewards; persist board and quota in ccat-office-projects-v1. No acceptance, countdown or settlement flow requested in this increment.

1. Implement/test project generation, persistent initial board, free quota boundary, midnight reset, insufficient funds and storage failures in officeProjects.js/test.js.
2. Extend walletStore with durable expense receipt IDs and idempotent debit; preserve existing income receipts. Journal paid refresh before debit, recover a committed debit without charging again after a final save failure. Use navigator.locks for concurrent project tabs.
3. Add OfficeProjects page with five white project cards, top-right refresh, free count, paid price, current wallet balance, live errors and status. Preserve scene and existing internal pages.
4. Run unit suite/build, inspect 390px browser layout and free refresh count persistence, review changes, increment patch and deploy through existing main Pages workflow.
