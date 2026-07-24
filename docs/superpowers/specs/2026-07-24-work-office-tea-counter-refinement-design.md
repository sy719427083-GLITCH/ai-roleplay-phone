# Work Office Tea Counter Refinement Design

## Goal

Make the tea counter visibly smaller and move it farther upward and rightward without changing desks, character home positions, or the A* walking behavior.

## Approved Layout

| Property | Current V0.3.3 | Approved V0.3.4 |
| --- | ---: | ---: |
| Width | 64% | 58% |
| Height | 18% | 16% |
| Top | 6% | 4% |
| Right | 2% | 0% |
| Tea interaction point | x 93%, y 28% | x 92%, y 24% |

The interaction point remains below and near the right side of the counter art, but stays far enough inside the viewport that the 58px character is not clipped by the screen edge.

## Geometry and Routing

`OFFICE_LAYOUT.tea` is the single source of truth for the counter container. The CSS and geometry values must stay identical. The geometry module continues to derive the visible collision rectangle from the PNG alpha bounds, with horizontal clearance and the existing directional vertical rules.

The tea interaction point moves with the counter. All home-to-home and home-to-tea A* route combinations must remain available, and every middle route segment must stay outside the updated furniture collision rectangles.

## Verification and Release

- Update geometry and source-contract tests before production values.
- Run the complete Node test suite.
- Run browser QA at 375x812 and 390x844, including employee-six-to-tea movement.
- Confirm the smaller counter renders at `58% x 16%`, `top: 4%`, `right: 0%`.
- Publish as V0.3.4 and verify both GitHub Pages workflows, live bundle identity, and office image HTTP status.

## Non-goals

- Do not change any boss or employee desk size or position.
- Do not change character home centers, avatar size, walking speed, or A* grid settings.
- Do not add, delete, or replace office PNG assets.
- Do not stage or delete the six untracked legacy desk and tea PNG files.
