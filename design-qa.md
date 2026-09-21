# White office correction QA — 0.3.36

## Previous assessment withdrawn
The 0.3.35 pass was incorrect. The user correctly rejected visible furniture and perspective differences. Separately generated desk/cabinet/tea sprites materially changed the selected mock; this was a P1 fidelity issue, not P3 polish.

## Source and evidence
- Approved source: `designs/white-office-approved.png`, 853×1844.
- Source-preserving image edit: `public/office-white/scene-atlas.webp`, 853×1844. Only seven floating avatars and their editable labels were removed by ImageGen; original furniture/room/camera retained.
- Current implementation: `artifacts/white-office/corrected-mobile.png`, 390×844 at DPR 1.
- Full comparison: `artifacts/white-office/corrected-comparison.png`, normalized approved image (left) and browser implementation (right), both 390×844.
- Narrow-screen evidence: `artifacts/white-office/corrected-small.png`, 320×568.
- State: office main view, no overlays; current browser has no source avatar images, so seven neutral user icons appear instead of invented people.

## Corrections and recheck
1. P1 furniture mismatch: replaced independently regenerated sprites with the edited approved atlas. Eighteen interactive raster regions now share exactly one image camera and coordinate system. Preserved tea bar, desk cabinetry, stationery, whiteboard, shelves, umbrella rack, bin, plants and floor lighting. The full side-by-side comparison now retains the selected scene composition and desk arrangement.
2. P2 raster UI leakage: identified exact scene bounds as y=96 through y=1702, not 1734. Crop excludes original toolbar/footer; header, navigation, avatar badges and labels remain native controls.
3. P2 focus-induced scrolling: closing the last avatar editor then shrinking viewport caused overflow:hidden to scroll the stage by 41.5px, exposing raster footer. Changed stage to overflow:clip. Repeated close/resize checks at 320×568 and 390×844; scrollTop stays zero, original UI strips stay excluded.

## Fidelity surfaces
- Typography: native Apple/PingFang sans serif. Title, desk labels, footer labels retain original hierarchy and fit. Original artwork signage remains in the atlas.
- Spacing/layout: common approved coordinate system, correct boss/employee positions, preserved desk proportions. 390×844 scene fits almost 1:1 after density normalization. All seats remain visible at 320×568.
- Color: original white/wood/green palette and shadows retained.
- Image fidelity: actual approved scene retouched with ImageGen, then WebP conversion; no synthetic CSS drawings or independently styled furniture. Object slices align with the shared room image.
- Copy/content: 工作, 老板, 员工01–06, original three footer controls, Settings menu unchanged. No raster UI duplicated.

Full-view combined comparison is sufficient to judge camera/room/desk fidelity at this resolution. Readable avatar and footer controls were additionally checked in browser; no speculative portrait identities are substituted for missing profiles.

## Interaction/regression evidence
- Seven independent avatar buttons; employee06 editor opens and closes without moving scene. Existing source selection/upload/URL persistence code unchanged.
- Eighteen object buttons provide slight brightness feedback, using real raster regions. Reduced-motion behavior preserved.
- Geometry tests ensure crop excludes UI strips, all regions stay inside scene and avatars track their own desks under scaling.
- Independent code review found no P1/P2 issues; confirmed atlas mapping, clip bounds and avatar hit-layer priority.
- Unit tests: 101 pass. Production build succeeds (existing unrelated worldbook asset warning remains).
- Native iOS installed-PWA behavior is not device-tested.

final result: passed


# Autonomous office QA — 0.3.37

- User approved circular avatars moving through the existing scene. Atlas, furniture and camera remain unchanged.
- Added floor-anchor routes, independent work/coffee/print tasks and coordinated two/three-person chats. Labels show travel, waiting, active task and returning separately. Chat action appears before names so narrow labels retain their meaning.
- Mobile browser observation at 390×844 confirmed coffee at the counter, chats at the lower floor, printing and return travel. At 320×568 the entire scene and navigation fit; narrow bubbles truncate partner names, while accessible names/tooltips retain full text. Evidence: `artifacts/white-office/autonomy-mobile.png`, `autonomy-small.png`.
- Avatar editor opens via pointer and keyboard. Actor styles remained identical during an editor pause, then movement resumed after close. Pointer capture keeps a moving target's release associated with its button.
- Independent review found one identity-reassignment issue; fixed by ending duplicate-identity groups along continuous return routes. Re-review passed, including walking participants.
- 106 automated tests pass, including walkway desk exclusion, exclusive destinations, rendezvous timing, arrival/return continuity, status participants and identity changes. Production build passes with the pre-existing unrelated worldbook asset warning.
- No API, source profile, wallet, worldbook or legacy career writes added. Internal placeholder pages remain empty. Native installed-iOS behavior remains outside this browser validation.

final result: passed

# Activity variety QA — 0.3.38

- User-approved desk center alignment replaces the previous left-side positions. Own desk approach exits via its front before entering shared walkways; tests exclude crossings of every other desk.
- Added 36 activity entries, weighted work/rest/leisure and free-resource scene selection. Startup uses random warmup with the current roster; repeated browser entry showed different states.
- TV, Douyin and games have distinct badges and subtle animations. Existing reduced-motion rule disables these animations.
- Browser inspection at 390×844 and 320×568 confirmed centered seated avatars, whole office/navigation, new filing/printing/reporting/watering status. Evidence: `artifacts/white-office/variety-mobile.png`, `variety-small.png`. No browser console errors.
- 109 tests passed; production build passed with the existing unrelated worldbook asset warning. New tests cover startup diversity, all leisure types, chores, resource capacity and immediate-repeat avoidance. Independent review found no P1/P2 issues.
- Scene artwork and source data remain unchanged. Native device motion and media playback are not claimed; the leisure visuals are ambient icons/status, not embedded TV/video/game apps.

# Dialogue and team QA — 0.3.39

- Lowered centered home anchors to desk fronts; mobile screenshot confirms avatar circles no longer cover monitors. Office atlas remains unchanged.
- Employee management supports supervisor/employee roles, direct-report selection, collapsed management controls and task assignments. Browser verified promotion, report assignment, save across reload, assignment confirmation, demotion cleanup and existing local-photo/URL editor entry. Test hierarchy restored afterward.
- Work settings switches local/AI modes. Actual bubble playback and full transcript verified with explicitly labeled local dialogue; photo/URL source isolation unchanged.
- Browser has no saved main API, so AI mode correctly displayed setup instructions and retry/end controls. Successful external-provider generation was not tested. Unit tests verify configured API payload/selected model, actual response parsing, errors, participant restrictions and exclusion of unrelated private data.
- Independent review identified StrictMode dispatch duplication and timeout retry loss; fixed with deferred cleanup-safe launch and recoverable held groups. Current assigned tasks are read when sending after any cooldown wait.
- 114 tests pass; production build passes with pre-existing worldbook asset warning. Evidence: `team-management.png`, `dialogue-settings.png`, `dialogue-speech.png`, `dialogue-api-config-required.png` under `artifacts/white-office/`.


# Desk visit QA — 0.3.40

- Added randomly selected two-person desk cooperation, questions and casual conversation alongside existing shared-floor chats. Host stays home; visitor approaches a separate aisle-facing anchor.
- Existing AI/local conversation hook is reused unchanged. The host desk is included in the topic sent to dialogue generation. Host returns directly to working without a route loop; visitor walks back.
- 115 tests pass, covering all new visit routes, fixed host position, arrival rendezvous, prolonged conversation hold and distinct completion behavior. Independent review additionally verified 40 seeds of cancellation plus queued tasks without errors.
- Mobile browser QA used a temporary seed 7 opening to reliably capture the real WorkOffice component. Two avatars remain visibly separate beside employee01's desk and spoken dialogue is readable. Only the host shows the shared activity label, avoiding overlapping duplicate labels. Evidence: `artifacts/white-office/desk-visit.png`. The temporary seed was removed before the final build; production remains randomized.
- Existing third-party API validation limitation remains: provider completion was not tested in this browser lacking main API configuration.

## v0.3.41 project management
- 390×844 screenshot: artifacts/white-office/projects.png. Five distinct project cards include name, reward, minutes, full brief; fixed top-right refresh remains visible during list scrolling.
- Browser verified free quota 5→0, sixth refresh with zero balance gives an error and leaves all five projects unchanged, recovery button and reopening preserve board/quota. No browser console errors.
- Unit tests cover paid debit, wallet receipt preservation, insufficient balance, next local day reset, journal/save/wallet failures and recovery even after visible wallet history clearing. No live user funds used for QA.
- Independent review identified retry-after-save-failure could buy another batch; refresh now disabled on error until the explicit read/recovery succeeds.

## v0.3.42 acceptance and automatic payroll
- Main localhost: accepted three projects; remaining allowance 3→0 and other buttons become 今日接取已满. HMR/reload retained jobs; center office button showed 3 active and earliest remaining real time. Countdown screenshot at 390×844: artifacts/white-office/countdown.png.
- Isolated localhost:5174 temporary QA HTML mounted actual App + global provider and accepted a timestamped job with 20 seconds remaining. While Wallet stayed open its balance changed 0→1,000 with one 项目报酬 ledger entry, then manual expense100 produced900 and retained salary. Screenshot artifacts/white-office/automatic-payroll.png clearly identifies test. No console errors. Fixture removed and temporary server stopped before publication; no production wallet changed.
- Unit tests cover acceptance cap, duplicate/stale offers, refresh retention, wall-time reload, next-day quota, offline catch-up, interrupted wallet/ledger writes, durable receipt retry and serialized concurrent settlement/spending. 130 tests pass.
- Independent review found cross-tab Wallet writes outside payroll lock; all live writers now use shared lock. Re-review reported no remaining material findings.

## v0.3.43 API project redesign
- 390×844 mock-provider browser screenshot artifacts/white-office/ai-projects.png. Improved header/quota strip, compact reward/title cards, native expandable briefs and actionable footer.
- Isolated localhost5174 actual App with test-only loopback /chat/completions at5199: first generated5 leaves free quota5; replacing with different5 reduces to4; acceptingone disables other4; repeating prior fixture responses returns error, quota remains4 and board retained. No console errors. This validates mocked protocol/integration, not a real external model response. Temporary HTML and both servers removed/stopped.
- 137 tests cover schema, repeats, HTTP failure, missing config, abort, stale batch, unlocked network, first generation, paid journal recovery and single-active plus sequential daily quota. Independent review passed22 focused tests and found no material issues. No production wallet/profile mutations for QA.

## v0.3.45 selected staff and full-width office
- Browser QA at 390×844 and 430×932: the office stage covers the entire content rectangle between header/footer, with no side gutters and unchanged furniture proportions. Screenshot: artifacts/white-office/selected-staff-full-width.png. This is browser verification, not native iOS PWA verification.
- All seven empty seats show 不选择（不显示）. Selecting the existing test character for employee01 immediately produced exactly one avatar; clearing selection immediately removed it. Original source profile was unchanged.
- Unit coverage verifies empty roster, explicit sources, actor add/remove/replacement, affected conversation cancellation and absent-supervisor fallback without saved team mutation. Pending AI transcript cancellation now ends loading when participants disappear.
