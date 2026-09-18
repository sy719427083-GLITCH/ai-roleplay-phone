# White office implementation plan

**Goal:** Replace the old Work UI with the selected first white office mock, six aligned employee desks and one boss desk.
**Architecture:** WorkOffice owns the scene, blank destination panels and avatar editor. officeProfiles owns read-only source profiles and a separate versioned Work override record. Raster furniture are independent buttons; existing app navigation and deployment workflow stay in place.
**Stack:** React, Vite, existing Lucide icons, generated raster assets, localStorage.

## Constraints
- Source: exec-e17baa4e-f1c1-47e9-9513-06eccd019e26.png; first image explicitly selected.
- No chairs or carpets; white floor/desks, pale wood tea bar; 2 columns x 3 employee rows, boss above.
- Three-dot settings and bottom project/countdown/employee panels blank; countdown control widest.
- Avatar selection from Me or Characters, local upload, HTTP(S) URL, saved only to ccat-office-avatars-v1.
- Do not delete profile/worldbook/wallet/legacy career data or unrelated untracked files.

## Tasks
- [x] Add meaningful tests for separate avatar persistence, source mapping, malformed records, URL validation, storage failures. Run red.
- [x] Implement officeProfiles.js and WorkOffice avatar editor with image decode validation, upload downsize, error recovery, accessible dialog.
- [x] Generate independent desk/tea/cabinet/plant/room assets and assemble scene matching first image. Remove obsolete mounted Work UI and update launcher.
- [x] Update version via npm version patch --no-git-tag-version; document selected direction in AGENTS.md.
- [x] Run unit tests and build. Open local app in in-app browser; check 7 seats, source/local avatar changes, reload persistence, blank pages, three-dot settings and clickable props. Compare reference and browser screenshot.
- [x] Record design-qa.md; commit scoped files. Integrate with origin/main without overwriting remote changes, push and wait for Pages success, verify live version and scene.
