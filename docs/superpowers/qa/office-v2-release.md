# Office V2 V0.2.98 Release QA

Date: 2026-07-20

Status: release code and local QA ready; Pages sync, push, online access, and live verification were intentionally not run in this phase. The deploy marker will be written by the later sync step.

## Automated Evidence

- Viewports: 375x812, 390x844, 1280x720 at deviceScaleFactor 2.
- Pixi: exactly one nonblank canvas per viewport; office and lounge each passed pixel variation and 2x backing checks.
- World: 4 employee desks share `employee-desk`; 12 cross-door route entries cover office and lounge.
- Activities: 30 manifest entries checked; 13 visible prop placements attach to existing furniture with no duplicated furniture.
- Physical probes: desk visit, boss report, printer, whiteboard, dining chat, sofa TV, and two isolated simultaneous conversations passed.
- Motion: all viewports exposed continuous live position samples, advancing locomotion frames, and alternating lower-body evidence.
- Overlays and records: five legal actor colliders; bounded, non-overlapping bubble/name/status stacks remain above their actor heads; long dialogue containment and strict conversation-only history passed.
- Runtime hygiene: zero console errors, page errors, failed images, and unexpected API requests.

## Screenshots

| Viewport | Scene | File | Bytes |
| --- | --- | --- | ---: |
| 375x812 | office | `docs/superpowers/qa/office-v2-375x812-office.png` | 1021078 |
| 375x812 | lounge | `docs/superpowers/qa/office-v2-375x812-lounge.png` | 1075797 |
| 390x844 | office | `docs/superpowers/qa/office-v2-390x844-office.png` | 1091433 |
| 390x844 | lounge | `docs/superpowers/qa/office-v2-390x844-lounge.png` | 1149461 |
| 1280x720 | office | `docs/superpowers/qa/office-v2-1280x720-office.png` | 952951 |
| 1280x720 | lounge | `docs/superpowers/qa/office-v2-1280x720-lounge.png` | 1016147 |

## Release Boundary

Package, lockfile, visible version, and worldbook cache markers are 0.2.98. This report does not claim deployment; the controller will run the final Pages sync and live checks after review.
