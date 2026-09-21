# AI project board and single active project

User requests one accepted project at a time, better project layout, API-generated different projects every time. Keep daily three cap, real deadlines/payroll and existing daily5/free then200 refresh policy.

- Replace local catalog generation with saved-main API /chat/completions. Request five named detailed projects with category,15–120 integer real minutes, distinct industries/deliverables. Compute amount40/min client-side. Validate schema and duplicates against current/recent boards; retry repeated/invalid response once, never fallback to templates.
- Read legacy boards safely; existing accepted jobs remain untouched, but old local offers require a free first AI generation before acceptance. Persist batch identity and recent name/content fingerprints. Generation uses per-page request guard plus optimistic cross-tab batch check; only snapshot/commit hold wallet lock, allowing payroll while network awaits. Compare batch at commit, no charge on invalid, timeout, abort, conflict or insufficient balance. Paid commit journal retained.
- Enforce active-job constraint inside accept transaction and UI. Preserve preexisting parallel jobs to completion; block all new accepts until none remain.
- Redesign white project board: clear top stats, restrained green accents, concise title/reward/duration/category hierarchy, expandable briefs and compact action row, active-project shortcut. Show API loading/errors and retry; no credential edits in this feature.
- Update tests for AI schemas/repetition/failure/cancel/stale commits, existing journal guarantees and sequential daily allowance. Mock protocol browser fixture for generated layout + true missing-config behavior. Full tests/build/review and patch Pages deploy.
