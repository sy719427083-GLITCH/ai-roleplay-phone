# Task 4 Report: Traveler Selector State and Interaction

## Status

Implemented the dedicated work traveler selector in the owned files only:

- `src/App.jsx`
- `src/styles.css`
- `src/workTravelers.js`
- `src/workTravelers.test.js`

## TDD Evidence

1. Added failing persistence helper test first:
   - Command: `node --test src/workTravelers.test.js`
   - Red result: failed because `readStoredWorkTravelerId` / `persistWorkTravelerId` helper API did not exist.
   - Green result after implementation: `6` focused tests passed.

2. Added failing fallback asset helper test before UI fallback wiring:
   - Command: `node --test src/workTravelers.test.js`
   - Red result: failed because `getWorkTravelerFallbackAsset` did not exist.
   - Green result after implementation: `6` focused tests passed.

## Commands

- `node --test src/workTravelers.test.js`
  - Result: pass, `6` tests.
- `npm test`
  - Result: pass, `90` tests.
- `npm run build`
  - Result: pass.
  - Note: existing Vite warning remains for `/ai-roleplay-phone/worldbook-assets/hero-worldbook-atlas.png?v=0.2.90` unresolved at build time and left for runtime.
- `npm run dev -- --port 4174`
  - Used for mobile smoke screenshots.

## Visual QA

Screenshots:

- `docs/superpowers/qa/task-4-traveler-selector-390x844.png`
- `docs/superpowers/qa/task-4-traveler-selector-375x812.png`

Observed:

- Top-right traveler control measured `40x40`; avatar image measured `28x28`.
- Dialog is centered at both `390x844` and `375x812`, not bottom-sheet positioned.
- Four labeled rows render with two avatar-only controls each.
- One selected state is visible.
- Eight selector images loaded; current generic male/female images appeared as error fallbacks because Task 5 PNGs are not present yet.
- Selection smoke: choosing `luxe-male` persisted `ccat-work-traveler=luxe-male` and closed the dialog.
- Escape smoke: pressing Escape closed the dialog.

## Self-Review

- Dedicated key is `ccat-work-traveler`.
- Invalid ids normalize to `campus-female`.
- Removed profile-gender inference from `WorkAppScreen`.
- Traveler registry asset paths are wired as primary image sources.
- Generic `traveler-female.png` / `traveler-male.png` are used only in `onError` fallback handling.
- Header button has no text frame and stops click propagation.
- Modal backdrop and dialog stop map click leakage.
- Dialog uses `role="dialog"`, `aria-modal`, labeled title, button labels, `aria-pressed`, and focus-visible styling.
- No route modules, scripts, map assets, version/deployment, or `designs/` files were edited.

## Concerns

- The eight final traveler PNGs are still pending Task 5, so visual QA currently shows the generic fallback images.
- The local raw invalid saved id is normalized in app state; storage is overwritten on the next explicit selection.

## Follow-up: Complete Modal Focus Management

### Focus TDD Evidence

1. Reproduced the missing initial-focus behavior in the browser before editing:
   - Viewport: `390x844`.
   - Opened the traveler dialog from the top-right control.
   - Red assertion result: `{ activeLabel: "选择工作主角，当前：晴栀", insideDialog: false }`.
   - This proved focus remained on the opener and did not enter the dialog.
2. Added opener, dialog, and selected-option refs plus a single open-state keyboard effect.
3. Re-ran the browser assertion after a clean reload:
   - Green initial-focus result: `{ label: "选择校园清新女生主角：晴栀", pressed: "true", insideDialog: true }`.
   - `Shift+Tab` from the close button wrapped to `选择轻奢日常男生主角：景珩`.
   - `Tab` from the last traveler wrapped to `关闭工作主角选择`.
   - Escape result: `{ dialogCount: 0, activeLabel: "选择工作主角，当前：晴栀" }`.

### Focus Implementation

- The top-right traveler control is retained in `travelerPickerOpenerRef`.
- Opening focuses the selected enabled traveler option; the close button is the fallback when no selected option is available.
- One `keydown` listener exists only while the dialog is open. It handles every `Tab` / `Shift+Tab` move among enabled focusable controls and handles Escape dismissal.
- Effect cleanup removes that listener and restores focus to the opener. The same cleanup path runs after selection, close-button, Escape, and backdrop dismissal.
- Browser assertions separately confirmed opener focus restoration after close-button click, traveler selection, Escape, and backdrop click.

### Follow-up Browser Smoke

Screenshots:

- `docs/superpowers/qa/task-4-traveler-selector-clearance-390x844.png`
- `docs/superpowers/qa/task-4-traveler-selector-clearance-375x812.png`

`390x844` evidence:

- Selector bounds: `left 338`, `top 13`, `right 378`, `bottom 53`, exactly `40x40`.
- Home marker bounds: `left 183`, `top 72.4`, `right 207`, `bottom 96.4`.
- Closest upper-right job marker, the flower shop: `left 300`, `top 148.4`, `right 324`, `bottom 172.4`.
- The selected upper-right dashed route begins at normalized point `(50,10)` and ends at `(80,19)`, so its first pixel row is approximately `84.4`, below the selector bottom at `53`.
- Browser focus assertions passed for initial focus, forward/backward Tab cycling, Escape close, and opener restoration.

`375x812` evidence:

- Selector bounds: `left 323`, `top 13`, `right 363`, `bottom 53`, exactly `40x40`.
- Home marker bounds: `left 175.5`, `top 69.2`, `right 199.5`, `bottom 93.2`.
- Closest upper-right job marker, the flower shop: `left 288`, `top 142.3`, `right 312`, `bottom 166.3`.
- The same selected route starts at approximately pixel row `81.2`, below the selector bottom at `53`.
- Initial focus entered the selected `景珩` control, `Tab` wrapped to the close button, and Escape closed with focus restored to the `景珩` opener.

Explicit overlap inspection at both sizes:

- Building entrance: no overlap; the top-right facade and entrance begin below the selector, with the entrance aligned near the flower-shop marker.
- Route junction: no overlap; the nearest junction is centered well left and below the selector.
- Job marker: no overlap; measured marker rectangles do not intersect the selector rectangle.
- Home marker: no overlap; it begins `16.2px` below the selector at the tighter `375x812` viewport.
- Dashed route: no overlap; all five modern routes start at `(50,10)` and stay at normalized `y >= 10`, while the selector occupies the upper-right edge above that line.
- The selector visually covers only background foliage / edge roadway. No listed interactive or route landmark is obscured in either screenshot.

### Follow-up Verification Commands

- `node --test src/workTravelers.test.js`
  - Result: pass, `6/6`, `0` failures.
- `npm test`
  - Result: pass, `90/90`, `0` failures.
- `npm run build`
  - Result: pass, `1787` modules transformed.
  - The pre-existing unresolved-at-build-time warning for `hero-worldbook-atlas.png?v=0.2.90` remains.
- `sips -g pixelWidth -g pixelHeight ...`
  - Result: confirmed exact screenshot dimensions `390x844` and `375x812`.

### Follow-up Concerns

- Task 5 traveler PNGs are still absent, so the smoke captures continue to show the permitted generic image fallback.
- When a dashed SVG route was selected, the in-app browser screenshot compositor produced a large black central region. The DOM route points, marker geometry, and unselected-map captures remained correct; no route or map files were changed because redraw/rendering work belongs to Task 9.
