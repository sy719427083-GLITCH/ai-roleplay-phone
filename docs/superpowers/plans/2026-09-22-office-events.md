# Office choice events

Approved scope: employees approach the player with small local incidents; three choices affect mood/trust and preserve character-specific memories for later local/AI conversation. Keep office atlas, wallet and project deadlines unchanged.

Implementation: officeEvents.js handles bounded independent history, active event and cooldown; OfficeEvents.jsx presents pending event and history with save-failure feedback. officeLife reserves report destination and returns employees after response. officeDialogue includes only participants memories and relationship context. Source records are read-only.

Validation: unit tests cover once-only resolution, bounded history, identity isolation, cooldown, invalid choice, storage failure, approach/hold/return status and local/AI memory integration. Browser checks cover selection, modal choice and persistent history. Deploy patch through existing Pages workflow.
