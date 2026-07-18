# Real Office Pixi Two-Scene Redesign

## Goal

Replace the current office presentation with a physically coherent, high-definition two-scene workplace simulation. The office must use four identical real employee desks, a separate boss desk, obstacle-aware movement, body-only character animation, correct furniture occlusion, desk-side conversations, and a door to a second restaurant, pantry, and lounge scene. The activity panel becomes a conversation-only record.

The release target is GitHub Pages version `0.2.98`.

## Confirmed Direction

The selected architecture is a PixiJS 2D scene engine embedded below the existing React interface. React continues to own the Work header, timer, assignment flow, mode controls, names, statuses, speech bubbles, and conversation record. PixiJS owns room rendering, furniture, characters, props, animation, depth, hitboxes, route movement, and transitions between scenes.

A proven grid pathfinding library supplies A* routing. Scene-specific collision and reservation rules wrap the library so movement remains deterministic and testable.

## Scene Model

The Work app contains two persistent scenes:

1. `office`: the boss and four employee workstations.
2. `lounge`: a combined restaurant, pantry, and rest room.

Only one scene is visible at a time, but both retain their state. Changing the visible scene does not pause activities, conversations, timers, or routes in the other scene.

### Office Layout

- The boss desk sits at the upper center and remains visually distinct from the employee desks.
- Four identical standard employee desks use one shared furniture asset and are placed in a `2 x 2` arrangement.
- Every employee desk has the same dimensions, computer, keyboard, task light, storage, chair, and desk accessories.
- A wide central aisle connects every desk to the office door.
- The office door is fixed at the lower-right corner.
- The room has no rugs, carpet rectangles, cubicle walls, or decorative floor zones that separate individual employees.
- Shared facilities include a printer/copier, file cabinet, whiteboard or planning board, and a delivery handoff point near the door.

Each desk exposes one seat anchor, one desk-surface prop anchor, and three visitor anchors at the front, left, and right. The boss desk exposes equivalent visitor, report, and document-signing anchors.

### Lounge Layout

The lounge contains:

- A return door connected to the office door.
- A pantry counter with sink, refrigerator, coffee machine, water dispenser, storage, and pickup surface.
- One existing dining table with real chairs and fixed food anchors.
- A sofa zone with an existing sofa and coffee table.
- A fixed television and viewing area.
- Clear walking lanes between the entrance, pantry, dining table, sofa, and television.

Characters eat only at the existing dining table. Characters watching television use the existing sofa and television. No activity creates a second table, chair, sofa, or screen.

## Scene Transition

The office door and lounge return door are interactive scene-switch controls. A user click changes the visible scene while preserving simulation state.

Characters moving between scenes must:

1. Route to the current scene's door approach anchor.
2. Enter the reserved door trigger.
3. Transfer to the paired entrance anchor in the destination scene.
4. Continue along a destination-scene route to the reserved activity anchor.

The transfer is the only coordinate discontinuity. It occurs inside the door transition and is never shown as a character teleporting directly to a table, sofa, or workstation.

## Rendering And Occlusion

The Pixi scene uses stable logical coordinates based on a `1080 x 1920` artboard. It renders at the device pixel ratio, capped at `2`, with integer anchors and rounded output pixels.

The render stack is:

1. Architecture-only room background.
2. Furniture rear layers.
3. Rear props and effects.
4. Characters, sorted by foot position inside each walkable depth zone.
5. Furniture front layers and occlusion masks.
6. Foreground props and effects.
7. React name, status, and speech-bubble overlay.

A workstation is split into a rear layer, an interaction layer, and a front layer. Chair backs remain behind seated characters. Desk surfaces, monitor masks, and desk fronts occlude the correct parts of the body. Sofa and dining furniture use the same split-layer contract.

Furniture never appears in a character atlas. Activities select a body clip and manipulate the existing scene prop anchors.

## Collision And Navigation

Every solid scene object has an explicit collision polygon or rectangle:

- Room boundaries and non-walkable architecture.
- Desks, chairs, cabinets, counters, printer, whiteboard stand, dining table, sofa, coffee table, television cabinet, and door frames.

Characters use a foot-level capsule collider. Paths are produced on a scene navigation grid and then converted into continuous waypoints. Runtime movement combines A* routes with local character separation so people do not walk through one another.

The following rules are mandatory:

- A character may never stand inside a furniture collider.
- A seated pose is legal only at the matching reserved seat anchor.
- A desk action is legal only at that character's home workstation.
- A lounge action is legal only at its matching lounge anchor.
- Doors, visitor positions, seats, printer access points, whiteboard positions, and shared props use reservations.
- If a route becomes blocked, the character waits, replans, or selects another activity. It never teleports.
- Depth is derived from foot position plus explicit furniture masks, not arbitrary activity-specific z-index values.

## Conversation Placement

Two-person office conversation defaults to a desk visit:

- One character is selected as the host and remains at the workstation.
- The other character is the visitor and walks to a reserved desk-front or desk-side anchor.
- The host turns toward the visitor.
- The visitor returns to the previous activity or home workstation after the conversation.

Desk visits can also represent reports, document handoff, computer help, and screen collaboration.

Group conversations reserve multiple visitor anchors. If a target workstation cannot fit the group, the scheduler moves the conversation to the whiteboard, lounge dining table, or sofa area. Multiple conversation groups may exist simultaneously, but each owns a separate reservation set, API controller, transcript, bubble queue, and request sequence.

## Character Art And Animation

All sixteen built-in characters are redrawn from scratch:

- Four female bosses.
- Four male bosses.
- Four female employees.
- Four male employees.

Female characters retain long hair, attractive sweet styling, varied skirts, dresses, shorts, and trousers. Male characters retain varied handsome and cool styling. Every character has a distinct face, hairstyle, silhouette, outfit, and palette.

The visual treatment changes to crisp high-definition chibi animation with clean line work, readable facial features, controlled cel shading, and sharp clothing edges. Painterly haze, soft-focus faces, and blurred limbs are rejected.

Character assets contain only body, hair, clothing, hands, and feet. They contain no desk, chair, computer, sofa, dining table, food, phone, book, file, screen, or other scene furniture and props.

### Animation Bundles

Character animation is split into lazy-loaded bundles instead of one monolithic atlas:

- Locomotion: left, right, front, and back walking.
- Office desk actions.
- Office shared-object actions.
- Lounge seated and standing actions.
- Conversation and listening actions.

Source frames are mastered at a minimum of `512 x 512` per frame. Production atlases may use `384 x 384` cells after full-size and runtime-size comparison confirms no clarity loss. Transparent gutters prevent cell bleed. Only the five assigned characters and their required bundles are decoded.

Walking uses at least eight frames per direction and must visibly show:

- Alternating left and right leg strides.
- Heel or foot placement.
- Knee bend and weight transfer.
- Opposing arm swing.
- Head, long-hair, coat, skirt, and dress follow-through.

The walk clip runs at `9 FPS`, while position is interpolated continuously on every render frame. A character changes horizontal facing when route direction changes.

### Custom Character Assets

Custom uploads and hosted assets remain supported only through the validated animation-bundle contract. A single low-resolution still image is not stretched into an animated character. Invalid or undersized uploads produce a clear validation message and retain the currently selected built-in animated character until a valid bundle is supplied.

## Furniture And Prop Assets

Office and lounge architecture masters are created at `2160 x 3840` and exported as high-quality WebP runtime assets. Furniture and props use transparent high-resolution WebP assets aligned to the same logical artboard and lighting direction.

The palette is pearl white, light neutral gray, mist blue, muted lavender, and restrained dusty rose. Green is not a dominant color.

The employee workstation asset is authored once and instantiated four times. The runtime must not contain four separately drawn employee desks.

Props are separate scene objects with named anchors. Examples include phone, book, headphones, keyboard hands, document folder, pen, sticky notes, coffee cup, meal tray, printer paper, delivery parcel, and television content. An activity may activate, animate, or replace a prop at an existing anchor, but it may not create furniture.

## Activity Catalog

### Existing Office Activities

- Working.
- Slacking.
- Reading.
- Watching a series at the workstation.
- Watching short video content.
- Gaming.
- Desk-side chatting.
- Idle.

Eating moves from the office to the lounge dining table.

### Added Office Activities

1. Phone call or video meeting.
2. Printing or copying documents.
3. Filing and organizing documents.
4. Whiteboard discussion.
5. Reporting at the boss desk.
6. Stretching or briefly zoning out.
7. Collaborating at a colleague's screen.
8. Delivering documents for review and signature.
9. Online training with headphones and notes.
10. Computer trouble and colleague assistance.
11. Writing sticky notes or planning tasks.
12. Tidying the workstation.
13. Receiving a document or parcel at the office door.
14. Briefly resting on the existing desk.

### Lounge Activities

- Picking up food.
- Eating a meal.
- Drinking coffee, water, or another beverage.
- Dining-table conversation while eating.
- Sofa rest.
- Watching television.
- Sofa conversation or group conversation.
- Quiet rest.

Every activity is defined by a manifest entry containing scene, legal actors, target object, target anchor, reservations, route phases, body clip, prop states, duration, status, API context, and fallback content.

## Scheduler And Personality

The boss profile is read from the selected protagonist in the Me app. Employees are read from the selected main-character or NPC profiles in the Character app. Missing profiles use independent named NPC fallbacks.

Activity weighting considers:

- Profile personality, occupation, habits, and speech style.
- Relationships among assigned characters.
- Current work mode and remaining time.
- Current scene and available anchors.
- Recent activity history held only in transient scheduler state.

Personality weighting makes serious characters more likely to train, plan, report, and organize; helpful characters more likely to assist colleagues; social characters more likely to chat; and relaxed characters more likely to rest or slack. Hard rules still prevent illegal locations and occupied-object conflicts.

## API Contract

The local activity manifest is authoritative for visible behavior. The API may provide structured semantic content such as the task being handled, training topic, book, video, conversation topic, or work result. It may not change the selected scene, target object, animation, prop category, participants, or reservation ownership.

Conversation requests include only the exact conversation's member profiles, relationships, topic, recent transcript, scene, and current activity context. Replies require the current conversation ID and request sequence. Stale, malformed, foreign, or extra-key responses are rejected.

API failure uses a profile-aware local fallback and does not freeze the activity. Route failure returns the character to a safe wait or home state. Asset failure preserves furniture and replaces the character clip with a furniture-safe neutral standing pose.

## Conversation-Only Record

The three-dot panel is renamed `对话记录`.

It records only conversations. Working, slacking, eating, reading, training, printing, and other non-conversation activities are never added to the persistent record.

Records are grouped by conversation session and contain:

- Start and end time.
- Scene and conversation location.
- Participant names and profile snapshots.
- Topic.
- Ordered transcript entries with speaker identity.

Ongoing conversations are visible in real time. Concurrent conversations remain isolated. The current work-session boundary is preserved, and NPC fallbacks display their assigned NPC names.

## React Interface

The Work header and mode controls remain visually restrained and compact. The right-side actions remain employee assignment and the three-dot conversation record.

React positions names, statuses, and speech bubbles from Pixi world-to-screen coordinates. Labels use collision-aware offsets so names and bubbles do not cover one another at conversation anchors. Switching scenes changes the visible overlay set without changing simulation state.

## Verification

### Unit And Integration Tests

- Furniture collider coverage and legal walkable space.
- A* routing around every workstation and lounge object.
- Continuous movement and maximum per-frame displacement.
- Alternating walk-frame leg order.
- Door transition route continuity.
- Seat, visitor, door, printer, whiteboard, and shared-object reservations.
- Desk-visit conversation routing and return routes.
- Simultaneous conversation isolation.
- Activity manifest completeness for every listed activity.
- API response ownership and fallback behavior.
- Conversation-only persistence with no non-conversation event records.
- One shared employee desk asset instantiated four times.

### Asset Audits

- Both backgrounds meet master and runtime resolution requirements.
- The office contains no rugs or employee-specific floor zones.
- Character bundles contain no furniture or activity props.
- Every character and action frame has alpha transparency, clean gutters, populated pixels, and valid dimensions.
- Full-size contact sheets verify identity, hands, legs, hair, clothing continuity, and crisp edges.
- Runtime-size contact sheets verify clear faces and limbs without blur.

### Browser And Canvas QA

Playwright verifies `375 x 812`, `390 x 844`, and a wide desktop viewport. Required checks include:

- Nonblank Pixi canvas pixels in both scenes.
- Correct framing and high-DPI resolution.
- Visible continuous animation and movement.
- No character inside furniture geometry.
- No standing on desks or tables.
- Correct chair, desk, sofa, and table occlusion.
- No duplicated furniture or props during any activity.
- Office door and lounge return transition.
- Desk-front conversation, report, assistance, whiteboard, dining chat, and sofa chat.
- Multiple simultaneous conversation groups with isolated content.
- No overlapping names, statuses, bubbles, or controls.
- Zero application console errors and zero failed production assets.

Each activity receives a captured runtime frame for visual comparison against its manifest and anchor definition.

## Migration And Release

- Replace the current architecture background, rug-based composition, slot-specific employee stations, furniture-bearing character atlases, central-only chat anchors, and activity-history panel.
- Preserve existing role assignment data where valid.
- Discard legacy non-conversation activity records. Migrate only structurally valid conversation transcripts with a conversation ID, member list, and ordered speaker entries.
- Update package, runtime, cache, and deployment markers to `0.2.98`.
- Run the full test suite, production build, Pages sync, office verifier, and live asset audit.
- Push the verified release to `main` and poll `https://sy719427083-glitch.github.io/ai-roleplay-phone/` until the live version marker and new bundles are active.
