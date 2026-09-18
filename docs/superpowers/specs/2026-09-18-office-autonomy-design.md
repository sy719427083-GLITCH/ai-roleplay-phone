# Autonomous office avatars

User selected option1: retain circular avatars and approved office artwork. Employees move on walkways between assigned desks, shared chat spots, tea bar and printer. Above-head status describes the actual phase/person/activity.

Scope: local ambient simulation, no API calls or generated conversation records. Seven seat actors use current Work avatar overrides/Me/Character identity; empty seats use generic seat labels. Do not mutate source profiles, worldbooks, wallet or career data. Existing footer pages and Settings remain empty.

Behavior: staggered work/rest choices; two or three people rendezvous before chatting; coffee and printer each capacity1; dwell at destination then return to own desk. Use waypoint routes, not straight lines through desks. Pause when document hidden, editor/menu/subpage open; respect reduced motion. Status text and names stay readable inside scene; long names truncate visually with full accessible text. Click avatar still opens editor.

Validation: tests for routes avoiding furniture, arrival-gated status, shared resource capacity, group rendezvous, return to correct seat, pause/time handling and finite coordinates. Browser observe startup, travel, coffee/chat, return, small viewport, editing and reduced-motion mode. Update patch version and deploy through existing main workflow.
