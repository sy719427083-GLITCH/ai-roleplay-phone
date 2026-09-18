# Autonomous office implementation

Approved: circular avatar movement; scene unchanged.

- Add officeLife.js with waypoint paths, deterministic seeded scheduling, phase/status rules and capacity management. Test real timeline invariants before wiring UI.
- Add useOfficeLife.js for foreground-only time and paced rendering; state owned by WorkOffice so internal panels pause instead of resetting activities.
- Add OfficeActors.jsx and scoped CSS for moving avatars and above-head status. Native avatar editor remains unchanged.
- Test source layout plus lifecycle, visually verify scene at390x844 and320x568 across several real activity phases, review code.
- Increment version, build, commit and deploy, verify live version and runtime.
