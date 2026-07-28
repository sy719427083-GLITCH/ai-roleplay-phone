# Work Office Autonomous Behavior Design

Date: 2026-07-28

Status: Approved for specification review

## Goal

Turn the Work APP office from a mostly static staffing scene into a small real-time workplace simulation. Every assigned Me, Character, or NPC profile should move and behave autonomously, gather for believable conversations, use the print station, work, make reports, rest, play games, scroll Douyin, or slack off according to the current time and its established persona.

The feature must remain legible on a portrait phone screen. Each character shows its current activity below the avatar, conversations use short speech bubbles above the participating characters, and all routes remain collision-safe around the selected Pastel Orbit Office furniture.

## Approved Product Decisions

- Use one shared global timeline rather than independent random timers for each character.
- Base the simulation on real China time and distinguish workdays from weekends.
- Continue the timeline while the Work APP is closed. On reopen, calculate the reasonable current state directly; do not replay missed events and do not call AI in the background.
- Include the assigned Me profile in autonomous behavior. A user furniture click interrupts Me immediately and has higher priority than any scheduled activity.
- Add two selectable autonomous behavior modes to Work Settings:
  - **A - Local scheduling:** deterministic local planning controls all behavior; AI is called only when a conversation begins. This is the default and recommended mode.
  - **B - AI director:** AI returns a bounded scene plan that selects activities, destinations, groups, and conversation intent for a time window.
- If B has no usable AI configuration, fails, times out, or returns invalid data, fall back to A and show a concise non-blocking notice.
- Keep `摸鱼ing` and `刷抖音` as two independent activities with separate probabilities, durations, persona affinity, and display labels. Never display a merged phrase such as `摸鱼刷抖音`.

## Workday Rhythm

The timeline uses local China time with weighted variation inside each period:

| Time | Primary rhythm |
| --- | --- |
| 08:30-09:30 | Arrival, warm-up work, printing, and short conversations |
| 09:30-12:00 | Focused work, reports, printing, and project conversations |
| 12:00-14:00 | Rest, socializing, scrolling Douyin, gaming, or leaving the scene |
| 14:00-18:00 | Main work block, reports, printing, and targeted conversations |
| 18:00-20:00 | Leaving work, overtime, entertainment, or slacking |
| 20:00-08:30 | Most profiles are off duty; selected night-oriented profiles may work or entertain themselves |

Weekends use the same clock foundation but strongly reduce formal work and reports while increasing rest, entertainment, social activity, and off-duty states. The scheduler should introduce bounded day-to-day variation without producing constant or incoherent movement.

## Persona-Driven Behavior

Normalize each assigned profile's available identity, personality, persona/background, and relationship data into local behavior affinities such as:

- conscientiousness and focus;
- sociability and preferred conversation partners;
- discipline and likelihood of slacking;
- entertainment interests;
- morning, evening, and rest preferences.

These affinities modify the current time block's base activity weights. A serious or highly responsible profile should work and make reports more often; a social profile should initiate or join conversations more often; a playful profile may game or scroll Douyin more often; a night-oriented profile may remain active after others leave.

The output is intentionally probabilistic, not a permanent character classification. Even a diligent profile may rest, and an entertaining profile may complete focused work when the time block calls for it.

## Simulation Model

Each simulated character has a current state with at least:

- profile and assigned office slot;
- activity type and concise display label;
- destination or occupied activity point;
- start time, planned end time, and transition priority;
- movement route and facing direction when walking;
- optional conversation group and dialogue turn;
- optional resource reservation, such as the print station.

Supported visible activities include `offDuty`, `walking`, `working`, `reporting`, `printing`, `chatting`, `resting`, `gaming`, `scrolling`, and `slacking`. Display labels use natural concise Chinese, including `做报表`, `打印中`, `休息中`, `打游戏`, `刷抖音`, and the explicitly approved `摸鱼ing`.

Plans last minutes rather than seconds. A planner tick resolves completed activities, resource contention, conversation transitions, and newly available profiles. Rendering and movement may update more frequently, but neither mode should request or recompute a new scene every second.

Use a stable daily seed plus the current planning interval so that reopening the APP during the same interval reconstructs a consistent scene instead of reshuffling every render.

## Activity Points, Routing, and Occupancy

Reuse the existing collision-safe office navigation and add invisible semantic activity points outside furniture bounds:

- each profile's assigned desk work point;
- multiple shared conversation points distributed through safe open floor areas;
- rest and entertainment points;
- the print-station interaction point and one or more waiting points;
- safe aisle or staging points for entering, leaving, and rerouting.

Every movement route must avoid the boss desk, all six employee desks, the print station, and any other registered obstacle. Same-column paths retain the approved rule that they go around the upper desk rather than through it.

An activity point has a capacity. Exclusive points, especially the print-station interaction point, may have only one active occupant. A second profile either waits at a safe queue point or receives another valid activity. Shared conversation points have a small group capacity. The planner prevents characters from occupying the same visual coordinate and may apply small collision-safe offsets inside a shared area.

## Conversations

Conversations normally contain two to four available profiles and one to three short dialogue rounds. Group selection considers proximity, sociability, known relationships, recent pairings, current time, and project context so the same pair does not dominate every scene.

Conversation content must combine:

- each speaker's identity, personality, and persona/background;
- known relationship context between participants;
- current time and activity context;
- relevant Work APP project context when available.

Mode A builds the group, setting, and intent locally, then calls AI only when the conversation actually starts. Mode B may include these choices in its scene plan. Both modes validate and normalize dialogue output before display. Failed conversation generation falls back to short persona-aware local lines so the simulation continues.

Only one conversation group is visually emphasized at a time on the mobile scene. Participants remain gathered while short bubbles alternate above the current speaker. Each bubble is limited to one or two compact lines, remains long enough to read, and clears automatically. Other characters may continue non-conversation activities without competing bubbles.

## Visual and Interaction Design

Preserve the selected Pastel Orbit Office composition, furniture positions, white floor, and floating controls.

- Keep the character name in its existing visual position.
- Add the current activity directly below the character in a compact rounded label with sufficient contrast over the scene.
- Place conversation bubbles above their speakers with a small pointer, restrained shadow, and width limits suitable for Chinese text.
- Prevent activity labels and speech bubbles from covering the bottom navigation, settings control, important furniture, or another character whenever a safe placement is available.
- Truncate or wrap unusually long status text without changing the canonical activity state.
- Keep walking, working, resting, gaming, and phone-use motion restrained and readable. Respect the operating system's reduced-motion preference by removing decorative bobbing and shortening or eliminating nonessential transitions.

## Manual Interruption

The Me profile uses the same timeline as every other assigned profile until the user clicks office furniture.

1. Cancel Me's pending autonomous route and release any reserved activity point or conversation membership.
2. Route Me immediately to the clicked furniture's safe interaction point using the existing collision-aware navigation.
3. Show the corresponding manual activity while the command is active.
4. After the manual action completes or is superseded, rejoin the next valid global planning interval.

Manual control never moves a Character or NPC profile. If no Me profile is assigned, preserve the existing assignment prompt behavior.

## Settings

Add an `自主行为模式` control to Work Settings with two clear choices:

- `A 本地调度（推荐）`
- `B AI 导演`

Changing the setting applies immediately by safely ending the current non-manual plan and producing a new plan in the selected mode. Existing manual Me movement completes unless the user issues another command.

When B cannot run, retain the user's selected preference but execute the current interval through A and display a concise fallback notice. The next eligible interval may try B again with bounded retry behavior; it must not enter a rapid retry loop.

## Persistence and Catch-Up

Store simulation data separately from source profile records. Persist only the minimum required to reconstruct stable current behavior:

- schema version and selected A/B mode;
- current simulation date, daily seed, and planning interval;
- current scene plan and next transition time;
- profile activity state and resource reservations;
- small bounded conversation cache when needed for the active interval;
- manual Me interruption state when it remains valid.

Do not store API keys, raw model responses, hidden reasoning, or unbounded conversation history.

When opening the Work APP, compare the persisted planning interval with the current China time. If the state is current and valid, restore it. If time advanced, profiles changed, assignments changed, or data is invalid, derive the current interval directly from the daily seed and current context. Do not animate or generate every missed activity.

## AI Director Contract

Mode B requests a compact scene plan for a bounded interval, not continuous coordinates or per-frame animation. The response must be validated against currently assigned profile IDs, known activity types, safe destination IDs, group-size limits, and resource capacities.

Invalid profiles, unknown activities, unsafe destinations, overlapping exclusive resources, excessive dialogue, or malformed output invalidate or sanitize the affected plan. If a coherent safe plan cannot be recovered, use Mode A for that interval.

The local engine remains authoritative for routing, collision avoidance, capacities, timing bounds, rendering, manual interruption, and persistence even in Mode B.

## Edge Cases and Failure Handling

- An empty office shows no generated people or autonomous events.
- A one-person office never starts a conversation but still supports individual work, printing, rest, and entertainment.
- Deleted or reassigned profiles are removed from active groups, routes, and reservations before the next render.
- Missing personality or relationship data uses neutral weights rather than blocking simulation.
- Unreachable destinations leave the character at the last safe coordinate and trigger local replanning.
- A full conversation area or busy print station uses waiting or alternative activities rather than visual overlap.
- AI failure never freezes movement or leaves a permanent loading state.
- Background time advancement performs no hidden network request.

## Architecture Boundaries

- A pure timeline/scheduler module owns time blocks, deterministic seeds, persona weights, activity duration, and local planning.
- A pure scene validator owns capacities, participant validation, activity normalization, and safe fallback decisions.
- A conversation module owns group context, AI prompts, output normalization, local fallback dialogue, and bounded caching.
- Existing office geometry and navigation modules own points, obstacles, route generation, segment timing, and collision safety.
- Office state owns the versioned persisted simulation payload and migration.
- `WorkAppScreen` coordinates settings, timers, manual interruption, and scene planning without embedding the scheduling rules.
- `OfficeScene` and `OfficeCharacter` render resolved simulation state, status labels, and dialogue bubbles without deciding behavior.

## Testing and Verification

Pure automated tests must cover:

- workday, weekend, lunch, overtime, and overnight time blocks;
- deterministic reconstruction from date, interval, and seed;
- persona and relationship weights without permanently locking a profile to one behavior;
- independent `slacking` and `scrolling` activities and exact labels `摸鱼ing` and `刷抖音`;
- conversation group size, participant validity, pairing variation, and fallback dialogue;
- activity-point capacity, print-station queuing, collision-free routing, and character separation;
- Me manual interruption, reservation release, and autonomous re-entry;
- mode switching, B validation, failure fallback, and retry bounds;
- persistence migration, invalid data recovery, profile reassignment, and direct catch-up without event replay;
- zero-, one-, and seven-person offices.

Browser QA at `375x812` and `390x844` verifies seven simultaneous occupants, readable activity labels, alternating Chinese speech bubbles, safe group gathering, print queuing, desk avoidance, manual Me interruption, A/B settings, long Chinese text, off-duty states, and reduced motion.

Before completion, run the focused and full test suites, production build, and mobile browser QA. After versioning and deployment, verify the live GitHub Pages bundle and visible behavior at `https://sy719427083-glitch.github.io/ai-roleplay-phone/`.

## Delivery Boundary

This specification defines the feature and its verification contract. Implementation begins only after this committed specification is reviewed and an implementation plan is approved.
