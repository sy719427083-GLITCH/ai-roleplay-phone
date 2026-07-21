# Work Office V1 Design

Date: 2026-07-21
Status: Approved for specification review

## Goal

Restore the Work app as a warm, interactive office scene for one boss and four employees. The first release focuses on staffing the five desks, Work-only avatar overrides, and moving the user's `Me` character to clickable office objects. Project management, the timer, settings, and autonomous behavior for other characters are intentionally reserved for later releases.

## Visual Direction

Use the approved `A - Central Order` composition. The office is a portrait mobile scene dominated by warm white, cream, and pale yellow oak, with small amounts of sage green and warm gray.

- The larger boss desk sits at the upper center.
- Four employee desks use a clear two-by-two arrangement below it.
- Desks have no chairs. Every assigned character stands or sits on the far side of the desk, faces away from the camera, and appears to work toward the desk.
- One door sits on the upper-left wall. Two doors sit on the upper and middle-right wall. No door appears in the lower part of the room.
- The tea counter sits on the right in the lower-middle portion of the room, leaving the bottom clear for walking.
- There is no carpet grid or room subdivision.

The office uses a generated background image for walls, flooring, lighting, and atmosphere. Desks, doors, the tea counter, characters, labels, and interaction targets remain independent web layers. The background image contains no people and does not bake interactive furniture into the artwork.

## Main Screen

The office fills the available phone screen beneath the app shell.

- A three-dot button appears at the top-right and opens Settings.
- Bottom navigation contains exactly three controls: `项目管理`, `工作倒计时`, and `员工管理`.
- `工作倒计时` is the widest of the three bottom controls.
- Settings, Project Management, and Work Countdown are intentional blank management pages in V1. Each page contains its title and a back control, but no management form or behavior.
- Employee Management is the only complete management page in V1.

## Staffing Rules

The initial office has no assigned boss and no assigned employees. All five desks remain visually empty until the user makes assignments.

Employee Management contains five independent slots: `老板` and `员工 1` through `员工 4`.

- Every slot may select a character from `Me`, the Character app, or available NPC records.
- A character may occupy only one office slot at a time.
- The `Me` character may be assigned as either boss or employee, but may occupy only one slot.
- Removing an assignment immediately empties the corresponding desk.
- Changing an assignment updates only Work app state and never mutates the source character record.
- Character app and NPC characters remain at their desks with a restrained working animation. Autonomous walking or leisure behavior is outside V1 scope.

Each occupied desk shows the assigned avatar and a compact name label. Empty desks show no placeholder person or generated NPC.

## Work-Only Avatar Overrides

Every assigned character can use a Work-only avatar override. Employee Management offers three actions for each occupied slot:

1. Upload a local image.
2. Enter a public web image URL.
3. Restore the avatar inherited from the source app.

Overrides are stored by character identity rather than by desk, so moving a character between boss and employee slots preserves that character's Work avatar. Replacing an assigned character does not transfer the previous character's override.

Uploading or entering a URL never changes the avatar in the Me app, Character app, or NPC source data. If an upload cannot be decoded or a URL cannot load, the UI reports the failure and continues showing the source avatar.

## Interaction and Movement

Only the assigned `Me` character is controllable in V1. Other characters and NPCs cannot be selected or moved.

- Clicking any visible room prop, including a door, desk, tea counter, plant, shelf, or cabinet, directly commands the `Me` character to walk there; no character-selection step is required.
- The destination is the clear floor point immediately in front of the clicked object, not on top of its artwork.
- Movement follows fixed office waypoints so the character does not cross through desks or walls.
- The character faces the direction of travel and stops at the destination.
- Clicking a new object while moving replaces the current route from the nearest valid waypoint.
- When no `Me` character is assigned, clickable objects remain visually responsive but show a short prompt asking the user to assign the Me character in Employee Management. No other character moves.

Furniture and doors require semantic buttons or equivalent keyboard-operable hit targets. Visible focus treatment and reduced-motion behavior are required.

## State and Persistence

Store Work app data separately from all source apps. The persisted model contains:

- the five slot-to-character assignments;
- Work-only avatar override type and value per character;
- the `Me` character's last valid office waypoint;
- a schema version for safe migration.

Do not copy or rewrite source character objects. At render time, resolve the latest source name and avatar, then apply a valid Work-only override if present. If a source character was deleted, clear its assignment without generating a replacement.

Local image uploads must be resized and encoded to a storage-safe format before persistence. URL avatars remain external URLs. Failed or unavailable external images fall back to the latest source avatar.

## Component Boundaries

- `WorkAppScreen`: route composition, blank management pages, and bottom navigation.
- `OfficeScene`: background, furniture layers, interaction targets, and character layers.
- `OfficeCharacter`: avatar, name label, working state, movement direction, and reduced-motion rendering.
- `EmployeeManager`: five assignment slots and avatar override controls.
- `officeProfiles`: reads and normalizes Me, Character app, and NPC sources without mutation.
- `officeState`: assignments, uniqueness rules, persistence migration, and current waypoint.
- `officeNavigation`: fixed waypoints, object destinations, and route selection.
- `officeAssets`: generated background and furniture asset manifest.

Behavior and persistence logic remain independent of React where practical so the assignment and routing rules can be unit tested.

## Failure Handling

- Invalid saved JSON restores an empty office rather than breaking the Work app.
- Deleted source characters are removed from their slots on the next normalization pass.
- Duplicate saved assignments keep the first valid slot and clear later duplicates.
- Failed avatar uploads and URLs preserve the source avatar and show a concise error.
- A missing or invalid movement destination leaves the `Me` character at the last valid waypoint.

## Testing and Visual QA

Unit tests cover:

- all five slots starting empty;
- all three source types being valid for boss and employee slots;
- one-character-per-slot and one-slot-per-character constraints;
- `Me` occupying at most one slot;
- avatar overrides remaining isolated from source records;
- failed image fallback;
- assignment cleanup after source deletion;
- route selection, rerouting, and invalid destinations;
- persistence restoration and schema migration.

Browser QA covers representative 375x812 and 390x844 phone sizes. It verifies the approved central-order layout, larger desks, characters on the far side of desks, all doors above the lower room, the raised tea counter, the three-button bottom navigation, blank placeholder pages, touch targets, and the controllable `Me` route to each interactive object.

## Delivery and Automatic Deployment

- Increment the application patch version from `0.2.94`.
- Preserve the existing Work launcher icon and reconnect it to the new screen.
- Generate and add the office background plus any separate furniture assets required by the layered scene.
- Run the full unit test suite, production build, and mobile browser QA.
- Add or update GitHub Pages automation so a successful push of the implementation to the repository's publishing branch builds and deploys the site automatically.
- Verify the live result at `https://sy719427083-glitch.github.io/ai-roleplay-phone/` after deployment.

## Explicitly Deferred

- Project creation, editing, progress tracking, or other project-management behavior.
- Countdown configuration, start, pause, reset, or notification behavior.
- Settings controls.
- Autonomous walking or activities for Character app and NPC characters.
- Conversations, meetings, meals, or other simulation systems.
