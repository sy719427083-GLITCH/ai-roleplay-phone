# White office design QA — 0.3.35

Source visual truth: `designs/white-office-approved.png` (first mock, explicitly selected; user emphasized neat workstations).
Implementation: `artifacts/white-office/mobile.png`, in-app browser at http://127.0.0.1:5173/ai-roleplay-phone/.
Comparison: `artifacts/white-office/comparison.png`; source 853×1844 normalized to 390×844 alongside actual 390×844 browser capture, DPR 1.
Small-screen capture: `artifacts/white-office/small.png`, 320×568.
State: Work main office, default avatars where local profiles have no image, no menu/dialog open.

## Findings and history
- Initial P2: employee rows sat too low and left too little white floor below. Moved row tops from 40/59/78% to 36/53/70%; boss to 19%. Recaptured and inspected the combined comparison after changes.
- Initial P2: tea/cabinets appeared too narrow because generated transparent assets include natural padding. Enlarged tea and cabinet placements; adjusted tea height to avoid boss monitor overlap. Current comparison has separate visual layers and aligned desks.
- Review P2: Save silently ignored a pasted URL unless Preview was used. Save now validates/loads a pending URL; failed load leaves editor open. Unit test and browser direct-save regression passed.
- No remaining actionable P0/P1/P2 findings. Individual furniture silhouettes differ from the conceptual render because real independently generated sprites replace the one-piece mock; style, white/wood palette, seven positions and ordered layout are maintained.

## Five fidelity surfaces
- Typography: Apple/PingFang sans serif, restrained 19px title, 12/14px footer labels. All navigation labels visible, central countdown control widest. No mock slogans added.
- Layout: six desks in two aligned columns, same row Y values, central boss above, top tea bar, peripheral whiteboard/clock/cabinets/plants; full-scene fits viewport. At 320×568 scene scales to preserve all seats and footer remains visible.
- Colors: pure-white app chrome, white room/desks, light natural wood bar, subtle gray labels and muted avatar backgrounds; no chairs, carpets or floor grids.
- Image fidelity: seven real WebP assets, transparent raster furnishings and room background. All visible image elements decode successfully. UI icons use existing Lucide library. Empty source profiles use a neutral user icon, not invented identities.
- Copy: 工作 / 老板 / 员工01–06 / 项目管理 / 工作倒计时 / 员工管理 / 设置. Four destination pages intentionally blank beneath their headers, per user scope.

## Interaction evidence
- Seven independently editable avatars. Existing Character source selected successfully; Me/Character source mapping covered by tests.
- Local WebP upload decoded and downsized to 384×384, saved in Work only.
- HTTP URL preview, direct save without preview, refresh persistence, source switch, and restore default checked in browser. Test overrides restored afterward.
- Each furniture sprite is a semantic button with press-scale/brightness feedback; reduced motion removes transition.
- Three footer destinations and three-dot Settings menu each opened and returned to office; no old career UI mounted.
- Unit coverage includes unsafe URL rejection, failed image load, malformed storage, deleted sources, explicit unlink, storage quota failure, source-record immutability.
- Browser runtime error log was empty before review fix; a transient HMR syntax error during editing was corrected and production build rerun. Live deployment verification will use a fresh page.

## Follow-up polish
- P3: extra stationery variants and minor decorative signs from the concept can be added later; repeated desk sprite intentionally keeps workstations orderly.
- Native iOS installed-PWA safe area behavior is not device-verified; no device-specific claim made.

final result: passed
