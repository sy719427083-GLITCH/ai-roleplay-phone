# Work Office Layered PNG Interaction Design

## Goal

Implement the selected “Pastel Orbit Office” as a genuinely layered scene. The room shell is a people-free, furniture-free background. Every interactive office object is a separately positioned transparent PNG. Clicking an object sends the assigned Me APP avatar to that object through the existing waypoint graph.

## Scene layers

1. The background contains only permanent room surfaces and non-interactive scenery: white floor, curved sky windows, walls, plants, lighting, and decorative trim.
2. Interactive architecture and furniture are transparent PNG overlays: the boss computer desk, six employee computer desks, tea counter, and the three door targets. Each overlay owns its visible art and its hit target; CSS must not redraw these objects.
3. Assigned occupants render above or behind the matching desk according to the selected mock. The scene starts with all seven slots empty.
4. Floating back/settings controls and the three bottom controls remain above the scene.

## Interaction

- Clicking any interactive PNG resolves its object destination and asks the existing movement controller to route the assigned Me APP occupant there.
- Only a Me APP occupant moves. Character APP and NPC occupants remain at their assigned desks.
- If no Me APP occupant is assigned, clicking an object shows the existing assignment notice and does not change office state.
- Repeated clicks may replace the current route with a new route. The latest clicked destination wins.
- Every PNG object remains keyboard reachable, has an accessible label, and gives subtle pressed feedback.

## Asset rules

- Each overlay is a real PNG with alpha transparency and no baked-in room background.
- Computer desks include their computer and desktop accessories as one PNG per visual color/layout variant.
- The tea area is one transparent PNG, visually matching the selected mock.
- Door targets use independent PNG art or another separately layered PNG architectural element; they must not be baked into the background.
- The background must not duplicate any overlay object, preventing doubled desks, tea counters, or doors.

## Data and routing

- Keep the seven slot IDs: `boss`, `employee1` through `employee6`.
- `officeAssets.js` is the single mapping from object IDs to PNG paths, placement classes, accessible labels, and navigation destinations.
- `officeNavigation.js` remains the single source of waypoint coordinates and graph edges.
- Clicking an object flows through `OfficeScene` to `WorkAppScreen`, which invokes the current Me-only movement controller.

## Verification

- Unit tests assert seven desk overlays, a separate tea overlay, separate door targets, and a destination for every interactive asset.
- Interaction tests assert that an object click moves an assigned Me APP avatar, does not move Character APP/NPC occupants, and produces the assignment notice when no Me APP occupant exists.
- Browser QA compares 375x812 and 390x844 captures with the selected mock and checks that the background has no duplicated interactive furniture.
- Run the full test suite and a production build under a Node version supported by Vite before deployment.
