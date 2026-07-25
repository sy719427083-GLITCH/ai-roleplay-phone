# Project Countdown Full-Screen Design QA

- Source visual truth: `designs/project-countdown-fullscreen-reference.png`
- Implementation screenshot: `artifacts/project-countdown-fullscreen/implementation-floating-action-390x844.jpg`
- Combined comparison: `artifacts/project-countdown-fullscreen/comparison-floating-action-390x844.png`
- Browser: Codex in-app browser
- Viewport: 390 x 844 CSS px at device pixel ratio 1
- Normalization: source resized from 853 x 1844 px to 390 x 844 px. The in-app browser's viewport capture surface pads below 720 px, so the implementation was captured as two non-overlapping browser-rendered clips at y=0..124 and y=124..844 and joined without resizing or content alteration.
- State: running project, 74% progress, 18:42:16 remaining

## Full-view comparison

The reference and browser-rendered implementation were placed side by side in a single 800 x 884 px comparison image. Both use the same mobile viewport, project data, cool-white paper surface, navy text, coral timer accent, botanical background, colored circular icons, the four project facts in both required locations, and three contract sections. The source's outlined footer action is intentionally replaced by the approved coral circular floating action.

## Focused-region comparison

No separate crop was needed because all typography, icons, values, contract rows, and botanical edges remain legible in the original-size comparison. The final comparison specifically verifies the colored icons, three numbered scope lines, repeated contract facts, the white-on-coral floating action, top vines, and the newly visible bottom flowers.

## Findings and fixes

1. P1 fixed: oversized progress ring. Reduced it to the left column and moved the four project facts into a two-by-two summary on the right.
2. P1 fixed: acceptance criteria fell below the initial viewport. Tightened card padding, typography, and clause rhythm so project content, deliverables, and acceptance criteria are visible together.
3. P2 fixed: first-pass card radii and vertical spacing were softer and larger than the selected contract direction. Reduced radii and spacing to match the reference.
4. P1 fixed: previous implementation omitted the four repeated contract fact rows. Added contract reward, duration, mapped difficulty, and localized completion time below the clauses.
5. P1 fixed: previous contract content used one paragraph. The API schema now requires exactly three concrete scope items and the screen renders them as the numbered contract range shown in the source.
6. P2 fixed: monochrome/incorrect icons. Replaced them with source-matching colored circular receipt, clock, bar-chart, calendar, document, package, shield, and briefcase icons.
7. P2 fixed: card content overflowed its 366 px source width and clipped the completion value. Added border-box sizing and tuned the metadata tracks; the full `7月28日 18:30` value now fits.
8. P1 fixed: the previous 358 x 52 px red outlined footer action was rejected. Running state now uses the approved 58 x 58 px coral circular action with a white document icon, no visible text, and accessible name `打开完整合同`.
9. P1 fixed: the background asset existed but the opaque footer and cards hid the botanical artwork. The running footer is now transparent, cards use 0.64/0.68 white alpha with 3 px backdrop blur, and the background is bottom-aligned. Top vines and bottom flowers are visibly present in the final comparison while contract text remains legible.
10. Intentional product constraint: the reference's decorative arc does not represent 74%, while the implementation arc truthfully renders the real project progress and exposes progress value 74 to accessibility APIs.
11. Passed: back button is 48 x 48 px and the running action is 58 x 58 px; both resolved uniquely, were clicked in the browser, and produced no error or warning logs.
12. Passed: browser-rendered DOM exposes all source content and contract facts. The fresh full suite passed 113/113, the Vite production build completed, and `git diff --check` returned no errors.

## Final result

passed
