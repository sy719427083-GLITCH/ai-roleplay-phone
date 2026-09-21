# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Approved Work app direction

The Work app is a career simulation inside CCAT OS: read existing worldbooks and linked characters; offer an interactive office, actionable projects, character dialogue, and a separate persistent career save. Keep original worldbook/character records unchanged. Use warm 2D office visuals and readable mobile work tools. The user approved implementation on 2026-09-16.

Work app follow-up: wages settle into the existing Wallet app after a timed project delivery. Countdown persists across reloads and app switches; settlement must be idempotent and survive wallet-history clearing. Keep the Work top bar flat, with no blur or shadow.

Use Apple system sans-serif with tabular numerals for Work clocks/countdowns. Avoid black-translucent PWA status-bar mode: user screenshot shows a native top blur obscuring toolbar text even with CSS shadows disabled. Use the non-translucent default status bar.

Settings release label must read package.json version rather than a hardcoded label. Work countdown expiry should show the exact next prerequisite with a navigation button; distinguish instantaneous workflow checks from the real countdown.

Work v0.3.32 supersedes the manual draft/review workflow: start work, optionally cooperate with a worldbook character, then finish and collect wages after countdown. No required writing, word count, research click, or review gate. Character API responses become persisted opening/support/closing scenes; a successful delegation can shorten the countdown once, and shared work is available to that character in chat. API failures never block salary eligibility. Preserve existing career, wallet receipts, and optional legacy notes.

Work top-edge follow-up: keep document/body/root theme color identical to the Work surface (#f5f4ec). Header spacing must add 12px after the top safe area instead of consuming that margin with max(). CSS checks cannot verify iOS native status-bar effects; do not claim a device-level fix without device evidence.

Work v0.3.34: approved living-office UI uses one user plus up to three linked characters as animated chibi figures, avatar heads with illustrated fallback, clickable people, desk/meeting/coffee destinations and an in-office conversation panel. Keep OfficeScene and one WorkShift mounted across internal tabs to preserve activity and pending requests. Payroll stays exclusively in settle/completePaidWork. Scene animations never authorize wages. Respect prefers-reduced-motion; timer uses Apple system numerals. Office invitations are lightweight scene prompts, not fabricated AI history. Latest AI scene appears in an office speech bubble; full records remain in Work desk.

## Work v0.3.35 — current direction (supersedes earlier Work UI)

The user selected the first white office mock on 2026-09-18 and emphasized neat desks. WorkOffice replaces the old career UI: six employee desks in two aligned columns and three rows, one boss desk, pale wood tea counter at top, white floor/desks, no chairs or rugs. Raster furniture are independently clickable with gentle feedback. Use read-only Me/Character sources and store uploaded/URL avatar overrides only under ccat-office-avatars-v1. No writes to source profiles, worldbooks, wallets or old career saves. Three-dot menu contains Settings; Settings, Project management, Work countdown and Employee management pages are intentionally empty. Bottom countdown button is widest. Work theme is pure white. Release version follows package.json; deploy to existing GitHub Pages via main workflow.

Work v0.3.36 visual correction: user rejected separately regenerated furniture as crooked and unlike the approved preview. Preserve the exact first mock camera, furniture silhouettes, proportions and scene coordinates. Use the retouched approved scene as a shared raster atlas for clickable object slices; crop out its header/footer and render real controls/avatars. Do not approve changed furniture/perspective as minor polish. Compare same-size screenshots to the approved image before release.

Work v0.3.37: user chose circular source avatars moving autonomously through the existing approved office. Preserve the atlas/layout; use walkway routes, coordinated two/three-person chats, exclusive coffee/printer use, return to own desk and live above-head activity labels. This is local ambient behavior, without API calls, fabricated dialogue history or source/save mutations. Pause while an internal page, menu or avatar editor is open and when document is hidden; respect reduced motion. Keep the four placeholder pages empty.

Work v0.3.38: center each seated circular avatar over its own desk (horizontal desk midpoint), with an approach/exit at the desk front. User approved richer weighted random work, collaboration, office chores, rest and occasional TV/Douyin/game leisure. Randomize initial scene state and subsequent activities/durations; avoid immediate repeat desk activity. Preserve the scene atlas and no-API/source-isolation boundaries. Leisure has distinct icons and subtle reduced-motion-safe feedback.
