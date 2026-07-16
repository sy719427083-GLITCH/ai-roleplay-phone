# Office Visual, Motion, and Activity Redesign

Date: 2026-07-16
Status: Approved design, pending written-spec review

## Goal

Redesign the existing Work app office without changing its established spatial layout. The result should use a low-saturation premium anime-game style, newly drawn chibi characters, smooth directional walking, concrete activity animations, character-specific API dialogue, and a session activity timeline whose details always match the visible action.

The release must replace the old office character art, update the application version to `0.2.96`, and deploy the verified build to `https://sy719427083-glitch.github.io/ai-roleplay-phone/`.

## Scope Boundaries

- Keep the boss desk at the top and the four employee desks in a 2 by 2 arrangement below it.
- Keep the current office scene coordinate system, route graph, desk positions, and activity anchor positions. Moving the top UI must not reflow, resize, or shift the office scene.
- Redraw the office background, all 16 built-in chibi characters, and the activity props described in this specification.
- Replace the previous chibi assets rather than retaining them as alternate choices.
- Continue to support uploaded or externally hosted replacement character art.
- Preserve the current work timer and global activity controls unless a change is explicitly described here.

## Visual Direction

### Character Art

The approved direction is a low-saturation premium Japanese game chibi style.

- Faces are attractive and refined without looking excessively infantile.
- Female characters should read as beautiful and distinctive; male characters should read as handsome and distinctive.
- Boss variants should have stronger presence and more polished clothing than employee variants without relying on black-and-gold luxury styling.
- Hair, face shape, silhouette, outfit category, accessories, and color accents must visibly differ between variants.
- Clothing should cover multiple styles, including formal tailoring, modern business casual, knitwear, fashion-forward office wear, relaxed creative wear, and restrained street or tech influences.
- The palette remains low saturation and must not collapse into a single hue family.

The built-in library contains exactly 16 newly drawn sets:

- four female bosses
- four male bosses
- four female employees
- four male employees

### Office Background

The approved office direction is `soft white + dusty rose gray`.

- White, pearl white, and fog white are the dominant colors.
- Dusty rose gray appears only in restrained soft furnishings, wall art, or small furniture accents.
- Pale gray wood, light neutral flooring, and cool gray hardware provide structure.
- Green must not be a dominant color. Plants, if present, are small secondary details and cannot control the palette.
- Lighting should feel soft and bright rather than sterile, overexposed, creamy beige, or strongly pink.
- The boss desk remains visibly more substantial and luxurious through material, silhouette, monitor scale, and chair design.
- The background includes stable prop landing areas for meals, books, phones, tablets, game devices, and chat gatherings.

The new background is a production bitmap asset with separate foreground props where animation or state changes require layering. It must retain the current route and anchor geometry.

## Top UI And Safe Area

- Move the back button, remaining work time, assignment entry, and overflow menu below the Dynamic Island and system safe area.
- Do not move or resize the office scene to compensate. The header remains an overlay layer above the existing scene coordinate frame.
- Add a three-dot overflow button at the top right.
- The three-dot button opens the current work session activity panel directly.
- All header controls require fixed dimensions, accessible labels, and non-overlapping layouts at `375x812` and `390x844`.

## Character Assignment

### Profile Sources

The role source changes are authoritative:

- The boss can be selected only from profiles created in the Me app and stored in `apiMeProfiles`.
- Each employee can be selected from any profile created in the Character app and stored in `apiCharacters`.
- Employee choices include both `main` characters and NPC characters. Main characters must not be filtered out.
- `apiRelations` may provide relationship context only when a relationship exists between current activity participants. It does not replace either participant's profile.

If a profile is missing, deleted, invalid, or not assigned, the slot renders a stable fallback named `NPC`. A missing profile must never leave an empty desk or crash API prompt construction.

### Assignment Flow

Assignment uses two navigation levels:

1. The assignment overview lists the boss slot and four employee slots.
2. Selecting a slot opens a dedicated chibi and profile selection screen.

The selection screen has a visible top-left back button that returns to the assignment overview. The overview has its own back button that returns to the office. Closing the flow must not silently discard a confirmed assignment.

### Labels

- Every character has a name label above the character.
- The fallback label is `NPC`.
- A compact status label below the character displays the current movement or activity phase.
- Name, status, and speech bubbles must not overlap the safe-area controls.

## Profile Snapshots And Language Style

Each assigned role resolves to a normalized profile snapshot.

Boss snapshots read from the selected `apiMeProfiles` entry:

- `id`
- `name`
- `identity`
- `appearance`
- `personality`
- `persona`
- `avatar`

Employee snapshots read from the selected `apiCharacters` entry:

- `id`
- `type`
- `name`
- `identity`
- `worldview`
- `appearance`
- `personality`
- `persona`
- `avatar`

The app refreshes assignments from storage when the Work app opens and when a local profile change is observed. Each activity event stores the profile snapshot used to create it so later profile edits do not rewrite past activity records.

Every dialogue or activity-detail API prompt includes only the relevant selected participants and their normalized snapshots. The API must derive vocabulary, sentence length, tone, verbal habits, reactions, and opinions from the supplied personality and background fields. A generic shared office personality is not acceptable when a real profile exists.

## Smooth Movement

The navigation graph and route ownership rules remain, but route rendering changes from timed waypoint jumps to continuous movement.

- Position is interpolated continuously with `requestAnimationFrame` or an equivalent frame-synchronized loop.
- Segment movement uses constant linear speed instead of easing in and out at every waypoint.
- Position is rendered with transforms to avoid layout-driven jitter.
- Crossing a waypoint continues into the next segment without stopping for a scheduler interval.
- Facing is derived from the current movement vector.
- The character faces right when moving right, mirrors the right artwork when moving left, uses front-facing art when moving down, and back-facing art when moving up.
- A route cancellation, destination conflict, or activity change resolves to a valid state and cannot leave the character between nodes indefinitely.
- A character walking to a colleague or group anchor returns to the assigned desk after the conversation ends.

### Walk Frames

Each of the 16 character sets contains:

- an eight-frame right-facing walk cycle
- an eight-frame front-facing walk cycle
- an eight-frame back-facing walk cycle
- a left-facing cycle produced by mirroring the right-facing cycle

The walk cycle targets approximately 10 to 12 sprite frames per second while screen translation remains frame synchronized. Frames include contact, recoil, passing, and high-point poses so feet, hips, arms, clothing, and hair move naturally rather than bobbing a static image.

## Activities And Concrete Animation

Every activity requires its own pose, props, status text, and animation loop. Reusing one generic arm motion for unrelated activities is not acceptable. Activity loops use purpose-built frames and prop motion appropriate to the action.

Each listed activity uses at least three purpose-built character frames. Additional layered prop frames may extend the loop, but prop-only movement cannot replace the required character pose changes.

### Work

- The character types, uses a mouse, reads a document, writes, or completes another visible desk task.
- The monitor or document changes subtly.
- The activity record names the task, the work performed, and the result.

### Slack Off

- The character visibly leans back, rests, stares away, or hides a non-work distraction.
- The pose differs from work, phone video, and gaming.
- The activity record explains what the character did while slacking and their reaction.

### Eat

- Real food and appropriate utensils appear at the reserved eating position.
- Meals may include rice, noodles, a bento, a sandwich, dessert, or another recognizable dish.
- The character takes food from the meal, and the visible amount may reduce over the loop.
- The character clears the prop and returns to the assigned desk afterward.

### Play Games

- A controller, handheld console, phone game, or clearly game-oriented computer screen is visible.
- Hand position and screen state differ from work and short-video actions.
- The activity record names the game or game type and what happened.

### Read

- The character holds an open book and uses a page-turning loop.
- The event includes the book title, topic or passage, and an in-character insight.

### Watch A Series

- The character watches a horizontal phone, tablet, or secondary screen.
- The event includes the series title, current plot point, and an in-character reaction.

### Watch Short Videos

- The character holds a phone vertically and performs a distinct single-hand scrolling loop.
- The event includes the video topic and an in-character reaction.
- This action is labeled `看抖音` in the current Chinese UI while remaining represented internally by a provider-neutral activity type.

### Chat

- A visitor walks to the colleague or group conversation anchor.
- Participants face the speaker or group center.
- The speaker uses a talk loop; listeners use listening or reaction loops.
- The group returns to valid desk or scheduled states after the session closes.

## Scheduler And Character State

The scheduler supports these destination activities:

- `work`
- `slack`
- `eat`
- `game`
- `read`
- `watchSeries`
- `watchShortVideo`
- `chat`

Global controls adjust activity weights without requiring the user to choose a specific person. Personality fields also adjust weights in restrained ways. For example, a disciplined role tends to work or read more, while a sociable role tends to chat more. Personality weighting must not make any required activity unreachable.

Movement phase and destination activity remain separate:

`idle -> walkingToActivity -> activeActivity -> returning -> scheduledOrHomeState`

A character may own only one active activity event and participate in only one conversation at a time.

## Activity Event Model

Animation, status, visible props, API content, and the activity timeline consume one authoritative event object.

Each event contains at least:

- `eventId`
- `workSessionId`
- `actorId`
- `participantIds`
- `profileSnapshots`
- `activityType`
- `movementPhase`
- `status`
- `title`
- `subject`
- `summary`
- `insightOrResult`
- `propVariant`
- `conversationId`
- `startedAt`
- `endedAt`
- `requestSequence`

The scheduler creates the event and fixes `activityType` before requesting API enrichment. An API response must match the expected `eventId`, `activityType`, and `requestSequence`. Invalid, foreign, or stale responses are ignored for live rendering.

If the character changes activities before a response arrives, the response may enrich only the original archived event. It cannot change the new animation, status, props, or current record.

## Activity Detail API

The app uses the selected main API configuration already used elsewhere in the application. The prompt requests structured JSON for the fixed activity type and current role snapshot.

Examples of required activity-specific fields:

- reading: book title, reading detail, insight
- series: title, plot detail, reaction
- short video: topic or creator category, clip detail, reaction
- work: task, method, deliverable or result
- meal: food name, eating detail, reaction
- game: game or genre, event, result
- slack: distraction, detail, reaction
- chat: topic, speaker, message, optional reaction

The client validates required fields before using the payload. A response cannot switch the requested action to a different one.

When API configuration is missing, a request times out, JSON is invalid, or validation fails:

- movement and animation continue normally
- a profile-aware local fallback fills the required fields
- the timeline marks the entry as local fallback; this release does not automatically retry completed fallback events
- failures remain isolated to the affected event or conversation

## Activity Timeline Panel

The top-right overflow button opens a bottom sheet for the current work session.

- The panel keeps the top toolbar visible and provides an explicit close control.
- Entries are ordered newest first.
- Filters include all activity, individual character, and activity type.
- Each entry shows time, character name and avatar, visible action, subject, concrete detail, and insight or result.
- Active events show an in-progress state and update in place when API enrichment arrives.
- Finished events retain the profile snapshot and details used at the time.
- The timeline covers only the current work session; it does not mix events from previous sessions.

## Concurrent And Group Conversations

Multiple independent groups and group chats remain supported.

Each conversation owns:

- a unique `conversationId`
- a disjoint participant list
- participant profile snapshots
- an isolated topic and transcript
- an isolated request sequence
- an isolated speech-bubble queue
- its own abort controller and lifecycle state

Only that group's participant snapshots, relationship context, activity context, and recent transcript enter its API prompt. A character cannot belong to two active groups. Responses naming non-members, stale sequences, or another conversation ID are rejected.

## Speech Bubbles

- Different conversation groups may show bubbles simultaneously.
- Bubble position follows the active speaker and applies collision-aware horizontal adjustment.
- Bubble width is constrained to the viewport, but height grows to fit the complete message.
- Remove hard two-line clipping.
- Use `overflow-wrap: anywhere`, an appropriate word-break fallback, and a zero minimum inline size so long digit strings and unbroken text wrap instead of being cut off.
- Bubble content must remain fully readable without horizontal scrolling or escaping the phone viewport.

## Component Boundaries

- `WorkAppScreen`: screen composition, timer, safe-area toolbar, assignment entry, and activity-panel entry.
- `OfficeAssignmentFlow`: assignment overview, role selection, chibi selection, and back navigation.
- `OfficeScene`: unchanged coordinate frame, new background, activity anchors, character layer, props, and bubbles.
- `OfficeCharacter`: one character's transform position, facing, sprite frame, name, and status.
- `OfficeActivityPanel`: filters and current-session event timeline.
- `officeProfiles`: source-specific profile resolution, normalization, fallback NPCs, and snapshots.
- `officeActivityState`: pure event and character state transitions.
- `officeScheduler`: activity weighting, eligibility, reservations, and participant selection.
- `officeNavigation`: graph routes, continuous segment progress, facing, and return-to-desk behavior.
- `officeActivityApi`: structured activity prompts, response validation, event matching, and fallback details.
- `officeConversationApi`: isolated character-driven conversation prompts and response validation.
- `officeAssets`: new background, 16 chibi sprite sets, activity frames, and prop mappings.

State reducers, movement calculations, response validation, and scheduler selection remain testable without rendering React components.

## Persistence And Recovery

Persist assignments, selected chibi variants, work session identity, remaining time, global mode, activity deadlines, and completed timeline events. Do not persist live promises or abort controllers.

On reload:

- re-resolve assigned profiles from the correct source storage
- replace deleted profiles with NPC fallback records
- close partial conversations rather than replaying incomplete API turns
- resolve expired activities
- return characters to valid route nodes or assigned desks
- resume the scheduler from a valid state

## Testing And Visual QA

Unit tests cover:

- boss choices resolve only from `apiMeProfiles`
- employee choices include main and NPC records from `apiCharacters`
- missing and deleted profiles become named NPC fallbacks
- profile snapshots include the correct personality and background fields
- legal state transitions for every activity
- continuous route interpolation and return-to-desk completion
- facing and sprite-row selection in every direction
- activity-to-pose, prop, status, and detail-schema mapping
- stale or mismatched activity API response rejection
- independent simultaneous conversations and group membership rules
- participant-specific profile prompts and transcript isolation
- fallback recovery after API failure
- current-session timeline ordering and filtering

Browser tests at `375x812` and `390x844` cover:

- toolbar placement below the safe area while the office scene coordinates remain unchanged
- assignment overview and both back-navigation steps
- all 16 new character sets loading without blank frames
- smooth multi-segment walking without waypoint teleporting
- concrete rendering for work, slack, eat, game, read, series, short-video, and chat actions
- multiple simultaneous chat groups with non-overlapping ownership
- complete wrapping of long unbroken numbers and text in speech bubbles
- activity panel open, close, filtering, in-progress update, and completed details
- soft-white and dusty-rose-gray background rendering without green dominance
- no incoherent overlap, horizontal overflow, blank canvas, or missing asset requests

Final visual QA includes Playwright screenshots, console-error checks, failed-request checks, and pixel checks for the background, characters, props, and movement layer.

## Delivery

1. Remove the old built-in chibi assets and replace them with the approved 16-set library.
2. Update the app version from `0.2.95` to `0.2.96` in every user-visible and build/deploy source of truth.
3. Run the full unit test suite and production build.
4. Run mobile browser QA and inspect final screenshots.
5. Sync the verified production output to the GitHub Pages `docs/` target.
6. Deploy and verify `https://sy719427083-glitch.github.io/ai-roleplay-phone/`, including the displayed version, new assets, activity panel, and absence of console or network failures.
