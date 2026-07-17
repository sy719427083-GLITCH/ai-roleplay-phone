# Task 6 Report: Office Art Library

## Result

- Replaced the previous 3x3 PNG library with exactly sixteen unique 8x8 WebP atlases.
- Replaced the office PNG with a 1080x1920 WebP background.
- Removed every old office PNG after validating the replacements.
- Added a 4x4 contact sheet at `docs/superpowers/qa/office-chibis-contact-sheet.webp`.

## Art Direction

- Female characters are all long-haired, sweet, polished, and highly detailed. Hairstyles include long waves, a high ponytail, twin tails, a waist-length braid, a side braid, and long gradient braids.
- Male characters cover cool executive, creative director, startup, lifestyle, business-casual, tech, warm designer, and fashion-forward styles. Every face was generated to read as handsome at chibi scale.
- Every atlas uses the same row contract: right/front/back walks; work/slack; eat/game; read/series; short-video/chat; idle/listen.
- The office background is pearl and fog white with pale gray wood/hardware and restrained dusty rose accents. It preserves the boss desk, four employee desks, central aisle, and visible meal area without people or UI.

## Image Generation

- Used the built-in `image_gen` tool, one distinct atlas per character.
- Generated each atlas on a flat chroma background, removed it with the installed `remove_chroma_key.py` helper, then resized to exact 1024x1024 WebP with alpha.
- The first parallel generation attempt stalled and was discarded. No CLI model fallback was used.
- Prompt variants kept the exact shared 8x8 action specification while changing hair, face, clothing, accessories, and boss/employee styling per character.

## Validation

- Exactly 16 chibi WebPs.
- Every atlas is 1024x1024, RGBA, and has transparent corner pixels.
- All 16 SHA-256 hashes are unique.
- Background is 1080x1920 WebP.
- No `public/work-office-assets/**/*.png` files remain.

## Tests

```bash
node --test src/work/officeAssets.test.js
npm test
npm run build
```

- Asset tests: 4 passed, 0 failed.
- Full suite: 162 passed, 0 failed.
- Vite production build: passed, 1799 modules transformed.
- Existing unrelated worldbook atlas runtime warning remains.

## Files

- Modified `src/work/officeAssets.js`.
- Modified `src/work/officeAssets.test.js`.
- Replaced `public/work-office-assets/office-bg.png` with `office-bg.webp`.
- Replaced sixteen `public/work-office-assets/chibi/*.png` files with sixteen unique `*.webp` files.
- Added `docs/superpowers/qa/office-chibis-contact-sheet.webp`.

## Concerns

- None. The generated contact sheet and individual atlas inspections show all requested directions and distinct action rows.

## Review Follow-up

- Corrected `boss-f-01` row 7, columns 5-8 so all four frames show face-to-face conversation gestures without a monitor or popcorn prop.
- Regenerated the 4x4 contact sheet from the corrected atlases.
- Strengthened the asset test to inspect the WebP container, 1024x1024 dimensions, declared alpha channel, embedded alpha data, exact filename set, and SHA-256 uniqueness.
- Re-ran the focused asset test, all 162 project tests, and the production build successfully.
- A second visual review found the first male boss source had eleven sprites across its walking rows despite the 8x8 file metadata. Replaced it with a genuinely eight-column, eight-row atlas and inspected the transparent output at full resolution.
- Added a regression test for the office background's WebP container, exact 1080x1920 dimensions, and absence of root-level legacy PNG files.
