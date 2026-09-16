# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Approved Work app direction

The Work app is a career simulation inside CCAT OS: read existing worldbooks and linked characters; offer an interactive office, actionable projects, character dialogue, and a separate persistent career save. Keep original worldbook/character records unchanged. Use warm 2D office visuals and readable mobile work tools. The user approved implementation on 2026-09-16.

Work app follow-up: wages settle into the existing Wallet app after a timed project delivery. Countdown persists across reloads and app switches; settlement must be idempotent and survive wallet-history clearing. Keep the Work top bar flat, with no blur or shadow.

Use Apple system sans-serif with tabular numerals for Work clocks/countdowns. Avoid black-translucent PWA status-bar mode: user screenshot shows a native top blur obscuring toolbar text even with CSS shadows disabled. Use the non-translucent default status bar.
