# Work Office Layout Correction Design

## Goal

Correct the published Work office scene without changing its seven-desk structure or management behavior.

## Approved visual changes

- Remove all three door objects from the scene.
- Move the tea counter down by approximately four percentage points of scene height and right by approximately three percentage points of scene width.
- Keep the tea counter right-aligned rather than centering it with the boss desk.
- Move the boss desk down by approximately three percentage points of scene height.
- Move each assigned avatar's home waypoint approximately five percentage points upward, farther behind its desk, so the circular avatar remains visible instead of being covered by the desk art.
- Leave all six employee desk positions and sizes unchanged.

## Interaction changes

- Door destinations and door routes are removed together with the door PNG objects.
- The boss desk, six employee desks, and tea counter remain clickable destinations.
- Clicking a remaining destination continues to move the assigned Me profile along the office route.

## Implementation boundaries

- Update the furniture inventory so it contains only seven desks and the tea counter.
- Remove door-only asset declarations, waypoints, destination mappings, and route edges.
- Adjust only the tea counter, boss desk, and avatar home positions in the office scene and navigation data.
- Keep the existing background and separate alpha PNG assets for all remaining clickable objects.

## Verification

- Asset tests must assert eight clickable furniture objects, seven desks, and zero doors.
- Navigation tests must assert that no door destinations remain and that routes to all desks and the tea counter still resolve.
- Browser QA must confirm the adjusted positions at 375x812 and 390x844 without avatar/desk overlap.
- The full test suite and production build must pass before publishing.
