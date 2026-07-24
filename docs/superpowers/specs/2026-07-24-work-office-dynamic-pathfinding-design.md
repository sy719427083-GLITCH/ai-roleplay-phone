# Work Office Dynamic Pathfinding Design

## Goal

Make office movement feel like real walking: assigned avatars are centered behind their desks, move more slowly, and dynamically route around every visible desk and the tea counter instead of crossing furniture art.

## Approved visual changes

- Keep the boss avatar centered at `x: 50%`.
- Center left-side employee avatars at `x: 22%` and right-side employee avatars at `x: 78%`, matching the visible centers of their desk PNGs.
- Keep the existing home-row heights so avatars remain visible behind the desks.
- Reduce the tea counter from `76% × 22%` to `64% × 18%` while retaining its current top-right placement.
- Keep all seven desk sizes and positions unchanged.

## Dynamic route planner

- Replace the fixed waypoint BFS graph with an A* planner operating in normalized scene-percent coordinates.
- Use an eight-direction grid with a two-percentage-point cell size so diagonal movement is available without becoming visually jagged. Calculate movement cost and the A* heuristic in viewport pixels so portrait aspect ratio does not distort route choice.
- Derive the visible, alpha-bounded rectangles of the boss desk, six employee desks, and tea counter from the current viewport size, the same CSS clamp rules used by the scene, and each PNG's known alpha bounds.
- Inflate every collision rectangle by the avatar clearance radius before pathfinding so the circular avatar does not clip the furniture edge.
- Keep each desk home point and each destination interaction point in an explicit clear pocket outside the inflated obstacle.
- If the current position or goal falls in a reserved clear pocket, connect it to the nearest traversable grid cell without opening a path through the rest of the obstacle.
- If no valid path exists, leave the avatar in place and show a short movement failure notice.

## Path smoothing

- Run A* for collision-safe grid nodes.
- Remove collinear intermediate nodes.
- Apply line-of-sight simplification only when the replacement segment, including avatar clearance, does not intersect any furniture rectangle.
- Preserve meaningful corners around furniture, producing smooth diagonal or straight walking segments rather than raw grid stair-steps.

## Movement timing and facing

- Use distance-based timing equivalent to `700 ms` per `12%` of scene travel.
- Calculate each segment duration as `max(240 ms, segmentDistance / 12 × 700 ms)`.
- Store the active segment duration on the moving avatar and use the same value for its CSS position transition and JavaScript advance timer.
- Derive left/right facing from the horizontal direction of each smoothed segment.
- Keep the existing walking bob animation, slowed enough to match the lower travel speed.

## Components and data flow

- `officeGeometry.js` accepts viewport width and height and owns the matching responsive furniture rectangles, PNG alpha bounds, avatar clearance, home points, and interaction points.
- `officePathfinding.js` owns A*, collision checks, path simplification, segment timing, and facing helpers.
- `officeNavigation.js` remains the public destination mapping layer and delegates route generation to the pathfinder.
- `WorkAppScreen.jsx` requests a route on each furniture click and advances through the returned timed segments.
- `OfficeCharacter.jsx` receives the current coordinate and transition duration without knowing how the route was calculated.

## Verification

- Unit tests cover desk-center coordinates, tea counter dimensions, obstacle inflation, unreachable goals, and representative routes between every desk and the tea counter.
- Every simplified route segment must be asserted collision-free against all inflated furniture rectangles.
- A regression test must prove that adding an obstacle changes the calculated route rather than allowing the avatar to cross it.
- Browser QA at `375×812` and `390×844` must assign a Me profile, move it between distant destinations, and verify that rendered movement checkpoints do not overlap furniture bounds.
- The full test suite, production build, both GitHub Pages deployments, and live image decoding must pass before completion is reported.
