# Office V2 V0.2.98 Release QA

Date: 2026-07-21

Status: release code, local QA, and Pages sync are complete; push, online access, and live verification remain. The deploy marker is 0.2.98.

## Automated Evidence

- Viewports: 375x812, 390x844, 1280x720 at deviceScaleFactor 2.
- Pixi: exactly one nonblank canvas per viewport; office and lounge each passed pixel variation and 2x backing checks, with the fallback absent.
- World: 4 employee desks share `employee-desk`; 9 cross-door route entries cover office and lounge.
- Activities: 32 manifest entries and 51 prop variants checked; 47 variants require visible props and 77 prop sprites resolve onto existing furniture with zero generated furniture.
- Physical probes: desk visit, boss report, printer, whiteboard, dining chat, sofa TV, and two isolated simultaneous conversations passed; live screenshots exercise printing, whiteboard work, desk chat, dining chat, sofa chat/rest, and TV viewing.
- Motion: all viewports exposed live Canvas actor pixels at old and new positions, old-region clearing, continuous route samples, changing locomotion crop fingerprints, and alternating lower-body evidence.
- Overlays and records: five legal actor colliders per dynamic scene; bounded, mutually disjoint bubble/name/status stacks stay above heads and avoid actor bodies plus fixed furniture; long dialogue containment and strict conversation-only history passed.
- Runtime hygiene: zero console errors, page errors, failed images, and unexpected API requests.

## Screenshots

| Viewport | Scene | File | Bytes |
| --- | --- | --- | ---: |
| 375x812 | office: printing + whiteboard + desk chat | `docs/superpowers/qa/office-v2-375x812-office.png` | 1054465 |
| 375x812 | lounge: dining chat + sofa chat/rest | `docs/superpowers/qa/office-v2-375x812-lounge.png` | 1174338 |
| 390x844 | office: printing + whiteboard + desk chat | `docs/superpowers/qa/office-v2-390x844-office.png` | 1126107 |
| 390x844 | lounge: dining chat + sofa chat/rest | `docs/superpowers/qa/office-v2-390x844-lounge.png` | 1257991 |
| 1280x720 | office: printing + whiteboard + desk chat | `docs/superpowers/qa/office-v2-1280x720-office.png` | 986052 |
| 1280x720 | lounge: dining chat + sofa chat/rest | `docs/superpowers/qa/office-v2-1280x720-lounge.png` | 1090864 |

## Release Boundary

Package, lockfile, visible version, worldbook cache markers, and the synchronized Pages deploy marker are 0.2.98. This report does not claim live deployment until the controller pushes and completes the online checks.
