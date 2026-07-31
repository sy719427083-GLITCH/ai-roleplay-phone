# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Selected Work APP office direction (2026-07-24)

- Use the selected “Pastel Orbit Office” mock at `designs/work-office-pastel-orbit-selected.png` as the visual source of truth.
- The office fills the entire phone page; top and bottom controls float over the scene instead of reserving header/footer bands.
- Avoid a rectangular boxed-room feeling. Use bright white flooring, curved sky windows, rounded cloud-shaped desks, pale wood tea counter, and vivid pastel blue, green, pink, yellow, lilac, and coral accents.
- Support one boss slot plus six employee slots. All seven slots start empty and can use Me APP, Character APP, or NPC profiles.
- No chairs, carpet, or floor grid. Visible office props remain individually clickable and provide subtle press feedback.
- Keep the tea counter at the approved compact `54% × 16%` size and right alignment; its current vertical position is `top: 9%`. This narrower footprint lets it sit lower without covering the centered boss avatar at `y: 24%`.
- Same-column walking between the purple and green desks and between the yellow and orange desks must leave from behind the upper desk and go around its side; never use a direct vertical segment through either desk PNG.

## Work APP autonomous office behavior (2026-07-28)

- All assigned Me, Character, and NPC profiles participate in a shared real-time office timeline. Closing the Work APP must not freeze the simulation; reopening derives the current scene directly without replaying missed events or making hidden API calls.
- Work Settings exposes two selectable modes: A uses a deterministic local scheduler and calls AI only when a conversation starts; B asks AI for bounded scene plans. A is the default and fallback when B is unavailable or returns invalid data.
- Behavior is driven by current China time, weekday/weekend rhythm, profile identity, personality, persona/background, and known relationships. The Me profile follows the same autonomous system, but a user furniture click interrupts it immediately and has the highest priority.
- Supported visible states include walking, working, making reports, printing, chatting, resting, gaming, scrolling Douyin, slacking, and off duty. Keep `摸鱼ing` and `刷抖音` as separate activities and separate display labels; never merge them into one phrase.
- Keep `working`, `reporting`, `gaming`, `scrolling`, and `slacking` at each occupant's own assigned workstation in both local scheduling and AI direction. Printing, chatting, resting, and off-duty states retain their specialized destinations.
- Show the current activity below each character. During a 2-4 person conversation, show short alternating speech bubbles above participants whose content fits their personas, relationships, current time, and project context.
- Route every activity through collision-safe points. Characters must not overlap furniture or each other; the print station has one active user and a queue/waiting rule, and mobile scenes should visually emphasize at most one conversation group at a time.
- A conversation requires at least two distinct assigned profiles at planning, parsed-dialogue, and render boundaries. Two turns from the same speaker never count as a conversation and must not produce a speech bubble.
- A visible `chatting` activity must belong to a valid 2–4 person conversation. Orphaned, stale, or single-person chatting states normalize at that occupant's own workstation before any route or bubble is rendered: to a concrete project task when a project is running, otherwise to `待命中`.
- A Me furniture click starts or resets a 10-second manual-control idle timer. If no further furniture click occurs during those 10 seconds, release the manual state and immediately return Me to autonomous planning; each new click restarts the full 10-second window.
- Office work is project-gated: only a running accepted project may produce printing or the ten approved concrete task labels. With no running project, all work/report/print states normalize to `待命中` at the assigned workstation. Printing lasts 15–30 seconds independently of the 15-minute scene interval, and expired cached printing must never render.
