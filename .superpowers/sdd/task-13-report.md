# Task 13 Report

## RED

Required command:

```sh
node --test src/work/officeState.test.js src/work/WorkAppScreen.test.js
```

Result before implementation: FAIL (7 pass, 13 fail). The failures showed the intended missing behavior: no `visibleSceneId`, no exact world-position character model, no world-route reducer actions, no physical scheduler boundary helper, legacy route sampling and navigation imports still active, sampled actor positions not reaching Pixi, and activity events still persisted.

The Task 12 P1 regression specifically failed because `createPhysicalSchedulerRuntime` did not exist and `WorkAppScreen` did not consume `activityId`, `actorIds`, `targetAnchors`, `routesByActor`, `reservationGroupId`, `propState`, or `semanticContext`.

Self-review added two more failing reducer regressions:

```sh
node --test src/work/officeState.test.js
# pass 11, fail 2
```

They proved that an invalid return route released its reservation group before route acceptance and that closing a conversation without supplied routes stranded members in `chatting`.

## GREEN

```sh
node --test src/work/officeState.test.js src/work/WorkAppScreen.test.js
# pass 22, fail 0

node --test src/work/officeState.test.js src/work/WorkAppScreen.test.js src/work/officeWorld.test.js
# pass 34, fail 0

npm test
# pass 186, fail 0

npm run build
# PASS, Vite transformed 2546 modules
```

The build retained the existing unresolved `hero-worldbook-atlas.png?v=0.2.97` runtime warning and the existing chunk-size warning; neither blocks output generation.

## Implementation

- Fresh state now places all five assigned characters at exact legal office `:seat-approach` anchors with `{ sceneId, position }`, `homeAnchorId`, `targetAnchorId`, immutable world routes, route timing, reservation group ownership, and transient prop/semantic context.
- `SET_VISIBLE_SCENE` changes only the rendered scene. RAF sampling continues for every moving actor in both scenes and sends sampled coordinates directly into the Pixi world.
- `START_WORLD_ROUTE`, `ADVANCE_WORLD_ROUTE`, `CROSS_SCENE_DOOR`, `ARRIVE_ACTIVITY`, `START_RETURN`, and `FINISH_RETURN` preserve exact samples and route clocks. Door actions must match transition data stored in the active world route.
- The Task 12 scheduler contract is consumed without legacy aliases. Successful scheduler reservations are installed through the reducer, every actor starts its route, and every actor profile is attached to transient semantic API work.
- Per-frame coordinate dispatch is avoided. Reducer dispatch occurs only at route segment progress, paired-door crossing, activity arrival, return start, and return completion.
- Reservation groups are released only after a valid return state exists. Conversation closure releases only its own group and builds direct legal world returns when caller routes are absent.
- Restore resets legacy node routes, illegal positions, conversations, and transient activities to exact safe home anchors. Serialization excludes activity events, ownership maps, routes, props, and non-conversation semantic summaries.
- `officeNavigation.js` and its test were deleted, and all source imports/references were removed.

## Changed Paths

Task-owned paths:

- `.superpowers/sdd/task-13-report.md`
- `src/work/officeState.js`
- `src/work/officeState.test.js`
- `src/work/WorkAppScreen.jsx`
- `src/work/WorkAppScreen.test.js`
- deleted `src/work/officeNavigation.js`
- deleted `src/work/officeNavigation.test.js`

Directly required integration edits:

- `src/work/OfficeScene.jsx`: accepts already sampled world actors and removes legacy node sampling before Pixi sync.
- `src/work/officeMotion.js`: removes the deleted navigation-module import while preserving the standalone legacy motion helper tests.

## Self-review And Concerns

- RAF reads current reducer state through `stateRef`, owns one cancellable frame, de-duplicates segment/door/completion transitions, and clears stale transition keys.
- Hidden actors remain in the world and are sampled independently of `visibleSceneId`; visibility changes do not rewrite character state.
- Cross-scene samples retain the original `routeStartedAt`, full route, and carried distance after the paired-door transition. Arrival accepts only the exact target anchor.
- Semantic replies update actors only when their event IDs still match and are never serialized.
- `.superpowers/sdd/progress.md` and untracked `tmp/` were pre-existing user changes and were not edited or staged. No assets, deployment output, or docs output were changed.
- `OfficeScene.jsx` and `officeMotion.js` were outside the nominal ownership list but were unavoidable direct integration/import changes required to pass sampled positions to Pixi and delete the navigation module without broken imports.
