# Office dialogue and management

User requested lower avatars, actual API conversations with visible speech, selectable AI/local mode, supervisor/employee positions and management, and local/URL avatar entry points.

- Move centered home anchors down to the front of each desk; preserve desk/atlas artwork.
- Persist Work-only mode and hierarchy under a new key. Default local; validate supervisors and remove obsolete reporting relationships on demotion. Employee management exposes the existing avatar editor.
- Add bounded main-API dialogue requests using selected participant character context only. Validate speaker IDs and require every participant, clear errors, abort on mode/roster change/unmount, one request per group with a minimum interval. Local dialogue is visibly labeled.
- Hold active groups during generation/playback. Render the current speaker bubble and an expandable read-only conversation transcript. Preserve pause/reduced-motion behavior.
- Supervisors assign a concrete desk task to their reports; queue it until the employee returns if away. Include roles/assignments in AI context.
- Add tests for persistence/normalization, API payload/response/failures, held chats, task queuing and avatar geometry. Browser QA, patch version, deploy and verify.
