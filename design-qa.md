# Work APP Pastel Orbit Design QA

- Source visual truth: `designs/work-office-pastel-orbit-selected.png`
- Implementation screenshot: `artifacts/work-office-qa/orbit-implementation-pass1.png`
- Combined comparison: `artifacts/work-office-qa/orbit-comparison-pass1.png`
- Viewport: 390 × 844 CSS px at device scale 1
- Source pixels: 852 × 1846, normalized to 390 × 844
- Implementation pixels: 390 × 844
- State: persisted single-occupant office; empty or partially occupied desks are an intentional product state

## Comparison History

### Pass 1

**Findings**

- [P2] Employee desks render too small compared with the selected visual.
  - Location: `.office-object.desk`.
  - Evidence: the source desks occupy roughly 44–47% of the screen width per pair, while the implementation leaves noticeably larger central and side gaps.
  - Impact: the implementation feels sparse and loses the selected mock’s lively office density.
  - Fix: increase employee and boss desk widths while preserving the paired aisle.
- [P2] Side-door arrow controls are visually prominent but absent from the selected visual.
  - Location: `.office-door-arrow`.
  - Evidence: three opaque blue circular arrows compete with the source’s two top controls.
  - Impact: creates extra navigation chrome and weakens visual fidelity.
  - Fix: retain semantic click targets but make their visual indicator nearly transparent until press or keyboard focus.
- [P2] Bottom navigation is undersized.
  - Location: `.work-bottom-nav`.
  - Evidence: source icons and labels form a clear final visual row; implementation icons and copy are much smaller.
  - Impact: persistent actions have insufficient hierarchy.
  - Fix: enlarge icons, labels, and countdown copy without adding boxes or a footer band.

**Required fidelity surfaces**

- Typography: Chinese labels use the existing PingFang/Avenir stack and match the clean sans-serif direction; sizes need adjustment at the bottom navigation.
- Spacing/layout: full-bleed composition matches; desk scale and bottom hierarchy need correction.
- Colors/tokens: white, blue, green, purple, coral, and pale wood align with the source.
- Image quality: generated PNG assets are sharp at 390 × 844; desk and tea assets have clean transparency.
- Copy/content: required Chinese labels are correct. The single visible occupant is a persisted runtime state, not baked artwork.

**Focused region evidence**

- The top tea-counter/boss region and bottom navigation were readable in the normalized combined comparison; no additional crops were required for this pass.

**Implementation Checklist**

1. Increase desk footprint.
2. De-emphasize side-door indicators.
3. Increase bottom action hierarchy.
4. Recapture and compare at the same viewport.

**Follow-up Polish**

- Recheck avatar-ring contrast when all seven positions are populated.

### Pass 2 — layered PNG implementation

**Evidence**

- `artifacts/work-office-qa/office-375x812.png`
- `artifacts/work-office-qa/office-390x844.png`

**Findings**

- [PASS] The room background is now a clean shell. It contains no baked-in desk, computer, tea counter, door, avatar, or navigation control.
- [PASS] Seven computer-desk PNG buttons render as independent layers: one larger boss desk and six paired employee desks.
- [PASS] The tea counter is a separate transparent PNG and appears once in the upper office area.
- [PASS] Three separately layered doorway PNG buttons render at the left, upper-right, and middle-right edges without CSS-drawn arrows.
- [PASS] The central walking lane remains open at both target viewport sizes.
- [PASS] Back/settings and the three bottom controls float above the room without introducing header or footer bands.
- [PASS] Browser QA verifies all eleven PNGs load, empty-office clicks show the assignment notice, and tea/employee-desk clicks move the assigned Me APP avatar to different destinations.
- [PASS] The assigned avatar lands adjacent to the selected employee desk and remains visually above the floor while non-Me occupants remain stationary by design.

**Residual polish**

- Recheck avatar-ring contrast only when a real seven-occupant state is available; this does not block the empty/partial office implementation.

final result: pass
