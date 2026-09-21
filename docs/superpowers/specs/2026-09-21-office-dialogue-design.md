# Office communication and management

User authorized lowering avatars, API/local dialogue settings, visible actual speech, supervisor/employee management and photo/URL avatars.

Characters stand centered at desk fronts. Keep all scene artwork. Team mode and hierarchy persist independently; supervisors can assign desk work to direct reports, queued until return if the employee is away. Demotion removes invalid manager links. Existing per-seat photo/URL overrides remain isolated from source profiles.

Local mode is the default and explicitly labeled. AI mode uses the selected saved main API/model and participating characters' relevant public context, office roles, managers and assigned work. One request returns a bounded multi-speaker exchange; every participant must appear and foreign speaker IDs are rejected. No unrelated private conversation/wallet/career data is sent.

Groups remain together while waiting for the rate window/request and during 5.5-second-per-line playback. Errors show reasons with retry/dismiss; failed groups remain recoverable for 90 simulated seconds. Requests abort on mode/identity change/unmount; deferred dispatch avoids StrictMode duplicate traffic and suspends new requests on hidden/internal pages. Transcript pauses scene playback and exposes full current exchange.

Validation includes pure API protocol mocks/errors, team persistence, manager authorization, queued tasks, held groups, browser mode/role/avatar/transcript checks. Test browser lacks a saved main API, so successful external-provider generation cannot be claimed.
