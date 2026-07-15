# Office App Behavior Design

Date: 2026-07-15
Status: Approved for implementation

## Goal

Add a low-saturation, clean, premium office simulation to the existing Work app. One boss and four employees should visibly work, slack off, eat real meals, play, move around, and hold API-driven conversations that match their character profiles.

The office must feel alive without requiring the player to select a specific worker for every action. Global controls influence behavior probabilities while each character continues acting independently.

## Screen Layout

- A compact header shows the remaining work time and the current global mode.
- The boss area occupies the top of the office and uses a larger desk, computer, and higher-quality furniture.
- Four employee desks form a clear 2 by 2 layout below the boss area.
- A small shared break area sits beside the walking aisle. It includes a table or counter, seats, a water dispenser, and a visible meal pickup point.
- A central aisle and short side paths connect all desks and the break area.
- A compact action toolbar provides `认真干活`, `自由行动`, `休息一下`, and `开会`.
- Bottom navigation provides `办公室`, `员工`, `任务`, and `仓库`.

The visual style uses warm white, fog gray, pale oak, sage green, dusty blue, muted coral, and small champagne-gold accents. UI surfaces are light and restrained, with thin dividers, modest corner radii, small linear icons, and no heavy black-and-gold ornament.

## Character Assignment

- The boss is selected from Main Characters.
- Four employees are selected from Characters or NPCs.
- If a slot has no assigned character, it renders a generated placeholder named `NPC`.
- Every person always has a compact name label above their head.
- The initial avatar library contains 16 chibi designs: four female employees, four male employees, four female bosses, and four male bosses.
- Uploaded or externally hosted avatar assets may replace built-in characters.

Each selectable chibi requires directional and activity variants rather than a single static pose:

- idle front or seated idle
- walk left and walk right
- work
- slack off
- eat
- play games
- chat and listen
- return-to-desk transition

Directional movement flips to the correct left or right artwork. Walking uses at least a two-step loop plus body bounce; activity loops use their own frames and props.

## Concrete Activities

Status changes must be visible in the character pose, props, and environment. Changing only the text label is not acceptable.

### Work

- The character sits squarely at their assigned desk.
- Hands alternate between keyboard, mouse, and a document action.
- The monitor shows a quiet changing work interface.
- Each character asset supplies at least two work loops chosen from typing, using the mouse, turning a page, writing a note, or stamping a document.
- Status reads `工作中`.

### Slack Off

- The character turns away from the monitor or leans back instead of using the work pose.
- The character visibly holds a phone, comic, or handheld console.
- The prop screen and tapping fingers animate.
- Each character asset supplies at least two slacking loops, and props rotate between sessions so all slacking does not look identical.
- Status reads `摸鱼中`.

### Eat

- The character leaves the desk and walks to a reserved seat in the shared break area.
- A real meal appears: a filled bento box, rice bowl, noodles, sandwich plate, or other visible food selected for the session.
- The character uses chopsticks, a spoon, or their hands as appropriate to the meal.
- The visible meal amount reduces across the loop. Hot meals include subtle steam.
- After eating, the character clears the meal prop, stands, and walks back to the desk.
- Status changes through `前往用餐`, `吃饭中`, and `返回工位`.

### Play Games

- The character visibly uses a handheld console, phone game, or computer game screen.
- The pose, screen content, and hand loop differ from normal work and phone slacking.
- Status reads `游戏中`.

### Chat

- Visitors walk to a conversation anchor near the host, lounge, or aisle.
- Participants face the current speaker or conversation center.
- The current speaker uses a talk loop; other members use listening or reaction loops.
- The active speaker has a speech bubble above the name label.
- Status changes through `前往闲聊`, `闲聊中`, and `返回工位`.

## Character State Machine

Each character has one authoritative activity state:

`idle -> walkingToActivity -> working | slacking | eating | gaming | chatting -> returning -> previousOrScheduledState`

The character record contains:

- `characterId`
- `assignedSlotId`
- `homePosition`
- `position`
- `facing`
- `activity`
- `activityStartedAt`
- `activityEndsAt`
- `previousActivity`
- `conversationId`
- `reservedAnchorId`

Movement and activity are separate concerns. A character can be walking toward a meal or conversation while the destination activity remains known. The displayed status derives from both movement phase and destination.

## Scheduler

An office scheduler evaluates available characters at varied intervals and starts activities according to weighted probabilities.

- `认真干活` strongly favors work and suppresses leisure without fully disabling natural behavior.
- `自由行动` uses balanced personality-weighted probabilities.
- `休息一下` favors meals, slacking, games, and conversations.
- `开会` gathers available characters at a meeting anchor and creates a dedicated group conversation.

Personality changes weights. A sociable character chats more often, a disciplined character works longer, and a food-oriented character is more likely to take a meal break. The scheduler never reassigns a character who is already walking, eating, or participating in another conversation.

## Movement and Collision Rules

The office uses a small navigation graph instead of free-form random movement. Nodes cover desk exits, the central aisle, conversation anchors, the break area, and the meeting point.

- A route is a list of waypoints rendered through position transforms.
- Characters reserve destination anchors before walking.
- A character may belong to only one activity reservation and one conversation at a time.
- Short start delays and lane offsets prevent multiple walkers from perfectly overlapping.
- If a destination becomes unavailable, the scheduler retries another anchor or cancels the activity cleanly.
- Returning always targets the character's assigned home position.

## Concurrent and Group Conversations

The office permits group chats and multiple simultaneous conversation groups. The boss and all four employees are eligible participants. With five on-screen characters, this normally means one group of up to five people or two disjoint groups.

Every conversation owns an isolated session object:

- `conversationId`
- `memberIds`
- `topic`
- `anchorId`
- `transcript`
- `turnIndex`
- `requestSequence`
- `status`
- `startedAt`
- `endsAt`

Rules:

- A character cannot appear in two conversation sessions simultaneously.
- A session prompt contains only that session's members, profiles, topic, and transcript.
- No transcript, topic, request sequence, or speech-bubble queue is shared between sessions.
- Each API response must include the expected `conversationId`, `speakerId`, `text`, and whether the session should end.
- The client accepts a response only when its conversation ID and request sequence still match the active session.
- Responses naming a non-member speaker are rejected.
- Stale responses arriving after a group ends are discarded.
- Each session owns its own abort controller and speech-bubble queue.

The API receives the selected characters' names, identities, personalities, backgrounds, relationships, the current office activity, and only the current group's recent transcript. The prompt asks for brief natural workplace dialogue that stays in character and avoids narration.

## Speech Bubbles

- Only the current speaker in a group shows the primary bubble.
- A bubble contains one short message, normally one or two lines.
- Long API text is split into queued bubbles for the same session.
- The bubble is anchored above the speaker and name label, with collision-aware horizontal adjustment.
- Different groups may display bubbles simultaneously because their queues and anchors are independent.
- Listening characters may show a small non-text reaction without replacing the speaker bubble.

## API Failure Handling

- Missing API configuration uses short local fallback lines selected from the characters' personality tags.
- A timeout ends only the affected conversation turn, not other groups.
- Repeated failure closes the affected group with a natural fallback line.
- All visitors then return to their desks and restore a valid scheduled state.
- No character remains stuck in a walking or chatting state after a rejected or aborted request.

## Persistence

Persist assignments, selected chibi assets, global work mode, remaining work time, and active activity deadlines. Do not persist in-flight API promises.

On reload:

- Expired activities resolve immediately.
- Active conversations are closed rather than replayed from partial network state.
- Characters return to their assigned home positions.
- The scheduler resumes from a valid idle or work state.

## Component Boundaries

- `WorkAppScreen`: screen composition, timer, global controls, and assignment entry points.
- `OfficeScene`: renders the office, activity stations, movement layer, and bubbles.
- `OfficeCharacter`: renders one character from state and direction.
- `officeState`: pure reducer for character activities, reservations, and conversations.
- `officeScheduler`: chooses eligible activities and participants.
- `officeNavigation`: resolves waypoint routes and anchor reservations.
- `officeConversationApi`: builds isolated prompts, validates responses, and handles fallback dialogue.
- `officeAssets`: maps boss and employee variants to directional/activity frames.

The behavior reducer and scheduler remain independent of React so concurrency and return-state rules can be tested without rendering the UI.

## Testing

Unit tests cover:

- role assignment and `NPC` fallback naming
- legal character state transitions
- distinct concrete activity variants and required props
- route completion and return-to-desk behavior
- destination reservation conflicts
- group creation with two to five members
- simultaneous disjoint conversation groups
- prevention of one character joining two groups
- prompt and transcript isolation between conversation IDs
- stale or foreign API response rejection
- timeout and fallback recovery
- work timer persistence and version migration

Browser tests cover 375x812 and 390x844 layouts, verify that names and speech bubbles do not overlap controls, and use screenshots plus pixel checks to confirm the office, chibi assets, meal props, and walking characters render visibly.

## Delivery

- Increment the application version from `0.2.94` to the next patch version.
- Build and test the application.
- Update the GitHub Pages output in `docs/`.
- Deploy to `https://sy719427083-glitch.github.io/ai-roleplay-phone/` after verification.
