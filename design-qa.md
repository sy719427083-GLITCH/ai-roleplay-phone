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
