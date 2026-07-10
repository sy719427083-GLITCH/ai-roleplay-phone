# Work App Illustrated Map Design QA

Source visual truth: `/Users/mypc/.codex/generated_images/019f2c6f-b568-7851-8d93-8ae795b49bde/exec-f86ee3cb-057c-49f3-9bca-f59e35fa6bda.png`

Implementation screenshots:

- `tmp/design-qa/work-modern-390x844.png`
- `tmp/design-qa/work-xuanhuan-390x844.png`
- `tmp/design-qa/work-xuanhuan-375x812.png`
- Combined comparison: `tmp/design-qa/work-comparison.png`

Prototype: `http://127.0.0.1:4173/ai-roleplay-phone/`

Viewport and state:

- 390 x 844, reality work source, first job selected.
- 390 x 844, worldbook source `云澜界`, `xuanhuan` theme, first job selected.
- 375 x 812, persisted `xuanhuan` theme, first job selected.

Full-view comparison evidence:

- The implementation and source use the same hierarchy: safe-area header, two source tabs, large illustrated map, five location points, grouped job rows, and bottom start/stop actions.
- The implementation intentionally gives rows more vertical space than the generated source so 14px task titles, durations and rewards remain legible on a 375px device. Remaining rows are available by vertical scroll.
- Reality and xuanhuan screenshots use separate generated bitmap maps rather than recoloring one background.

Focused region comparison evidence:

- Header controls measure 44px high; source tabs measure 48px high.
- Map pins measure at least 44px high and the active pin exposes the matching location and task label.
- At 375px, document `scrollWidth` equals viewport width, so there is no horizontal overflow.
- The active row expands to show task copy, level, hourly rate and progress while inactive rows remain compact.

**Findings**

- No actionable P0/P1/P2 visual findings remain.
- [P3] The implementation omits the source mock's duplicated standalone task summary and keeps one expanded list row instead.
  Evidence: the source repeats the selected job above and inside the list; the implementation presents it once.
  Rationale: this improves scan speed and avoids card-inside-card density without removing information.

**Required fidelity surfaces**

- Fonts and typography: system Chinese sans-serif is retained; hierarchy, weight and truncation are readable at 375px and 390px.
- Spacing and layout rhythm: 10-16px gutters and 44px touch targets are consistent; sticky actions remain visible without horizontal clipping.
- Colors and visual tokens: milky white, powder blue, mint, coral, gold, lavender and navy match the approved direction with adequate contrast.
- Image quality and asset fidelity: all six maps are 1536 x 1024 generated bitmap assets with matching clean gouache art direction; no CSS or inline-SVG placeholder map is used.
- Copy and content: reality and xuanhuan location labels, work titles and list rows match their map theme and structured `placeType` data.

**Interaction verification**

- Worldbook creation exposes the new `工作地图风格` selector.
- Selecting `云澜界` changes the full map to `玄幻仙境` and replaces all five jobs with xuanhuan work.
- Starting work enables stop and disables refresh while the timer is active.

**Patches made during QA**

- Moved the fourth stable map anchor from the lower center to the lower-right landmark.
- Added 375px grid tightening while preserving 44px minimum interaction size.

**Follow-up polish**

- P3 only: future theme packs can add per-place thumbnail crops if the user wants richer list imagery.

final result: passed
